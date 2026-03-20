import { getApproved, updateStatus } from '../store/queue.js';
import { getProjectConfig, parseSchedule, shouldPublishNow } from '../store/project-config.js';
import { getEnabledAdapters } from '../publishers/registry.js';
import { type PublishResult } from '../publishers/types.js';
import { recordPost } from '../store/post-history.js';
import { logActivity } from '../activity/log.js';

// Track last publish time per project to enforce one-per-window
const lastPublished: Record<string, string> = {};

const INTERVAL_MS = 60_000; // check every minute

async function publishPost(post: Parameters<typeof getApproved>[0] extends (infer T)[] ? T : never): Promise<void> {
  const config = getProjectConfig(post.project);

  // Determine which adapters to use — project targets filtered by what's configured
  const allAdapters = getEnabledAdapters();
  const adapters = post.platforms.length > 0
    ? allAdapters.filter(a => post.platforms.includes(a.platform))
    : allAdapters;

  if (adapters.length === 0) {
    console.warn(`[scheduler] No adapters available for ${post.project}`);
    updateStatus(post.id, 'published'); // mark done so it doesn't loop
    return;
  }

  // Append project tagline if set
  const draft = { ...post.draft };
  if (config.tagline) {
    draft.body = draft.body.trimEnd() + '\n\n' + config.tagline;
  }

  const results = await Promise.allSettled(adapters.map(a => a.publish(draft)));

  const publishResults: PublishResult[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      platform: adapters[i].platform,
      success: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  for (const r of publishResults) {
    if (r.success) console.log(`[scheduler] Published ${post.project} → ${r.platform}: ${r.url}`);
    else console.error(`[scheduler] Failed ${post.project} → ${r.platform}: ${r.error}`);
  }

  updateStatus(post.id, 'published');
  lastPublished[post.project] = new Date().toISOString();
  recordPost(post.project, post.draft.headline, post.draft.philosophyPoint, post.draft.body);
  logActivity({ project: post.project, worthy: true, reason: post.draft.philosophyPoint, results: publishResults });
}

async function tick(): Promise<void> {
  const approved = getApproved();
  if (approved.length === 0) return;

  // Group by project, take oldest first
  const byProject: Record<string, typeof approved> = {};
  for (const post of approved) {
    if (!byProject[post.project]) byProject[post.project] = [];
    byProject[post.project].push(post);
  }

  for (const [project, posts] of Object.entries(byProject)) {
    const config = getProjectConfig(project);
    const spec = parseSchedule(config.schedule);

    if (!shouldPublishNow(spec, lastPublished[project])) continue;

    // Publish the oldest approved post for this project
    const next = posts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    try {
      await publishPost(next);
    } catch (err) {
      console.error(`[scheduler] Error publishing ${project}:`, err);
    }
  }
}

export function startScheduler(): void {
  console.log('[scheduler] Started');
  setInterval(() => {
    tick().catch(err => console.error('[scheduler] Tick error:', err));
  }, INTERVAL_MS);

  // Also run immediately on start to pick up any approved posts
  tick().catch(err => console.error('[scheduler] Initial tick error:', err));
}

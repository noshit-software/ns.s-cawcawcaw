import { getApproved, updateStatus } from '../store/queue.js';
import { getProjectConfig, parseSchedule, shouldPublishNow } from '../store/project-config.js';
import { getEnabledAdapters } from '../publishers/registry.js';
import { type PublishResult } from '../publishers/types.js';
import { recordPost } from '../store/post-history.js';
import { logActivity } from '../activity/log.js';

// Track last publish time globally — one post per day across all projects
let lastPublishedGlobal: string | undefined;

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
  lastPublishedGlobal = new Date().toISOString();
  recordPost(post.project, post.draft.headline, post.draft.philosophyPoint, post.draft.body);
  logActivity({ project: post.project, worthy: true, reason: post.draft.philosophyPoint, results: publishResults });
}

async function tick(): Promise<void> {
  const approved = getApproved();
  if (approved.length === 0) return;

  // Global rate limit — one post per day across all projects
  if (lastPublishedGlobal) {
    const last = new Date(lastPublishedGlobal);
    const now = new Date();
    if (last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()) return;
  }

  // Find the oldest approved post across all projects, respecting each project's schedule
  const candidates = [];
  for (const post of approved) {
    const config = getProjectConfig(post.project);
    const spec = parseSchedule(config.schedule);
    if (shouldPublishNow(spec, undefined)) {
      candidates.push(post);
    }
  }

  if (candidates.length === 0) return;

  // Round-robin by project — pick the project that published least recently
  // For now, just take the oldest approved post overall
  const next = candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  try {
    await publishPost(next);
  } catch (err) {
    console.error(`[scheduler] Error publishing ${next.project}:`, err);
  }
}

export function publishNow(postId: string): Promise<void> {
  const approved = getApproved();
  const post = approved.find(p => p.id === postId);
  if (!post) throw new Error('Post not found or not approved');
  return publishPost(post);
}

export function startScheduler(): void {
  console.log('[scheduler] Started (1 post/day per project)');
  setInterval(() => {
    tick().catch(err => console.error('[scheduler] Tick error:', err));
  }, INTERVAL_MS);
}

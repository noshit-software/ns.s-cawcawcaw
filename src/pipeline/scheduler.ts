import { getApproved, getQueue, updateStatus, addPublishedPlatforms, type QueuedPost } from '../store/queue.js';
import { getProjectConfig, parseSchedule, shouldPublishNow } from '../store/project-config.js';
import { getEnabledAdapters } from '../publishers/registry.js';
import { type PublishResult } from '../publishers/types.js';
import { recordPost, getPostHistory } from '../store/post-history.js';
import { logActivity } from '../activity/log.js';

function frequencyToDays(frequency: string): number {
  switch (frequency) {
    case 'every2days': return 2;
    case 'every3days': return 3;
    case 'weekly': return 7;
    case 'biweekly': return 14;
    default: return 1; // daily
  }
}

function projectReadyToPublish(project: string, frequency: string): boolean {
  const history = getPostHistory(project, 1);
  if (history.length === 0) return true;
  const daysSince = (Date.now() - new Date(history[0].timestamp).getTime()) / 86_400_000;
  return daysSince >= frequencyToDays(frequency);
}

const INTERVAL_MS = 60_000; // check every minute

async function publishPost(post: QueuedPost, platformOverride?: string[]): Promise<void> {
  const config = getProjectConfig(post.project);
  const alreadyPublished = post.publishedTo ?? [];

  // Determine which adapters to use
  const allAdapters = getEnabledAdapters();
  let adapters;

  if (platformOverride && platformOverride.length > 0) {
    // Explicit platform selection (from per-platform publish)
    adapters = allAdapters.filter(a => platformOverride.includes(a.platform));
  } else if (post.platforms.length > 0) {
    // Project-configured platforms, minus already published
    adapters = allAdapters.filter(a => post.platforms.includes(a.platform) && !alreadyPublished.includes(a.platform));
  } else {
    // All configured platforms, minus already published
    adapters = allAdapters.filter(a => !alreadyPublished.includes(a.platform));
  }

  if (adapters.length === 0) {
    console.warn(`[scheduler] No adapters available for ${post.project}`);
    updateStatus(post.id, 'published');
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

  // Track which platforms succeeded
  const succeeded = publishResults.filter(r => r.success).map(r => r.platform);
  if (succeeded.length > 0) {
    addPublishedPlatforms(post.id, succeeded);
  }

  for (const r of publishResults) {
    if (r.success) console.log(`[scheduler] Published ${post.project} → ${r.platform}: ${r.url}`);
    else console.error(`[scheduler] Failed ${post.project} → ${r.platform}: ${r.error}`);
  }

  updateStatus(post.id, 'published');
  recordPost(post.project, post.draft.headline, post.draft.philosophyPoint, post.draft.body);
  logActivity({ project: post.project, worthy: true, reason: post.draft.philosophyPoint, results: publishResults });
}

async function tick(): Promise<void> {
  const approved = getApproved();
  if (approved.length === 0) return;

  // Find candidates: each project's oldest approved post, if schedule + frequency allow
  const candidates = [];
  for (const post of approved) {
    const config = getProjectConfig(post.project);
    const spec = parseSchedule(config.schedule);
    if (shouldPublishNow(spec, undefined) && projectReadyToPublish(post.project, config.frequency)) {
      candidates.push(post);
    }
  }

  if (candidates.length === 0) return;

  const next = candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  try {
    await publishPost(next);
  } catch (err) {
    console.error(`[scheduler] Error publishing ${next.project}:`, err);
  }
}

export function publishNow(postId: string, platforms?: string[]): Promise<void> {
  const allPosts = getQueue();
  const post = allPosts.find(p => p.id === postId && (p.status === 'approved' || p.status === 'published'));
  if (!post) throw new Error('Post not found or not approved/published');
  return publishPost(post, platforms);
}

export function startScheduler(): void {
  console.log('[scheduler] Started (per-project frequency)');
  setInterval(() => {
    tick().catch(err => console.error('[scheduler] Tick error:', err));
  }, INTERVAL_MS);
}

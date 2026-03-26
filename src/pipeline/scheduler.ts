import { getApproved, updateStatus, addPublishedPlatforms, type QueuedPost } from '../store/queue.js';
import { getProjectConfig, parseSchedule, shouldPublishNow } from '../store/project-config.js';
import { getEnabledAdapters } from '../publishers/registry.js';
import { type PublishResult } from '../publishers/types.js';
import { recordPost } from '../store/post-history.js';
import { logActivity } from '../activity/log.js';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CAWCAWCAW_DIR } from '../store/paths.js';

// Track last publish time globally — one post per day across all projects, persisted to disk
const LAST_PUBLISH_PATH = join(CAWCAWCAW_DIR, 'last-publish.txt');

function getLastPublishedGlobal(): string | undefined {
  try { return existsSync(LAST_PUBLISH_PATH) ? readFileSync(LAST_PUBLISH_PATH, 'utf-8').trim() || undefined : undefined; }
  catch { return undefined; }
}

function setLastPublishedGlobal(ts: string): void {
  try { writeFileSync(LAST_PUBLISH_PATH, ts, 'utf-8'); } catch {}
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
  setLastPublishedGlobal(new Date().toISOString());
  recordPost(post.project, post.draft.headline, post.draft.philosophyPoint, post.draft.body);
  logActivity({ project: post.project, worthy: true, reason: post.draft.philosophyPoint, results: publishResults });
}

async function tick(): Promise<void> {
  const approved = getApproved();
  if (approved.length === 0) return;

  // Global rate limit — one post per day across all projects
  const lastPublished = getLastPublishedGlobal();
  if (lastPublished) {
    const last = new Date(lastPublished);
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

  const next = candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  try {
    await publishPost(next);
  } catch (err) {
    console.error(`[scheduler] Error publishing ${next.project}:`, err);
  }
}

export function publishNow(postId: string, platforms?: string[]): Promise<void> {
  const approved = getApproved();
  const post = approved.find(p => p.id === postId);
  if (!post) throw new Error('Post not found or not approved');
  return publishPost(post, platforms);
}

export function startScheduler(): void {
  console.log('[scheduler] Started (1 post/day per project)');
  setInterval(() => {
    tick().catch(err => console.error('[scheduler] Tick error:', err));
  }, INTERVAL_MS);
}

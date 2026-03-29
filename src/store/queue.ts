import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { type PostDraft } from '../publishers/types.js';
import { PATHS } from './paths.js';

const QUEUE_PATH = PATHS.queue;

export type QueueStatus = 'pending_review' | 'approved' | 'published' | 'rejected';
export type QueueSource = 'live' | 'catchup';

export interface QueuedPost {
  id: string;
  project: string;
  draft: PostDraft;
  status: QueueStatus;
  source: QueueSource;
  platforms: string[];   // which platforms to target
  publishedTo: string[]; // which platforms have already published this post
  createdAt: string;
  updatedAt: string;
}

type Store = QueuedPost[];

function load(): Store {
  if (!existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(QUEUE_PATH, 'utf-8')) as Store;
  } catch {
    return [];
  }
}

function save(store: Store): void {
  writeFileSync(QUEUE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function enqueue(
  project: string,
  draft: PostDraft,
  source: QueueSource,
  platforms: string[],
  reviewRequired: boolean
): QueuedPost {
  const store = load();
  const safeDraft: PostDraft = {
    headline: draft.headline ?? '',
    body: draft.body ?? '',
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    projectName: draft.projectName ?? project,
    philosophyPoint: draft.philosophyPoint ?? '',
  };
  const post: QueuedPost = {
    id: id(),
    project,
    draft: safeDraft,
    status: reviewRequired ? 'pending_review' : 'approved',
    source,
    platforms,
    publishedTo: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.push(post);
  save(store);
  return post;
}

export function getQueue(project?: string): QueuedPost[] {
  const store = load();
  return project ? store.filter(p => p.project === project) : store;
}

export function getApproved(): QueuedPost[] {
  return load().filter(p => p.status === 'approved');
}

export function updateStatus(postId: string, status: QueueStatus): void {
  const store = load();
  const post = store.find(p => p.id === postId);
  if (!post) return;
  post.status = status;
  post.updatedAt = new Date().toISOString();
  save(store);
}

export function updateDraft(postId: string, draft: Partial<PostDraft>): void {
  const store = load();
  const post = store.find(p => p.id === postId);
  if (!post) return;
  post.draft = { ...post.draft, ...draft };
  post.updatedAt = new Date().toISOString();
  save(store);
}

export function addPublishedPlatforms(postId: string, platforms: string[]): void {
  const store = load();
  const post = store.find(p => p.id === postId);
  if (!post) return;
  const existing = post.publishedTo ?? [];
  post.publishedTo = [...new Set([...existing, ...platforms])];
  post.updatedAt = new Date().toISOString();
  save(store);
}

export function renameProjectInQueue(oldName: string, newName: string): void {
  const store = load();
  for (const post of store) {
    if (post.project === oldName) {
      post.project = newName;
      if (post.draft.projectName === oldName) post.draft.projectName = newName;
    }
  }
  save(store);
}

export function removeFromQueue(postId: string): void {
  save(load().filter(p => p.id !== postId));
}

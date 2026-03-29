import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';

const HISTORY_PATH = PATHS.history;

export interface PostRecord {
  timestamp: string;
  project: string;
  headline: string;
  philosophyPoint: string;
  excerpt: string; // first ~300 chars of body
}

type History = Record<string, PostRecord[]>;

const MAX_PER_PROJECT = 20;

function load(): History {
  if (!existsSync(HISTORY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as History;
  } catch {
    return {};
  }
}

function save(h: History): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(h, null, 2), 'utf-8');
}

export function recordPost(project: string, headline: string, philosophyPoint: string, body: string): void {
  const h = load();
  const record: PostRecord = {
    timestamp: new Date().toISOString(),
    project,
    headline,
    philosophyPoint,
    excerpt: body.slice(0, 300).trimEnd() + (body.length > 300 ? '...' : ''),
  };
  h[project] = [record, ...(h[project] ?? [])].slice(0, MAX_PER_PROJECT);
  save(h);
}

export function getPostHistory(project: string, limit = 5): PostRecord[] {
  return (load()[project] ?? []).slice(0, limit);
}

export function renameProjectInHistory(oldName: string, newName: string): void {
  const h = load();
  if (!h[oldName]) return;
  h[newName] = [...(h[newName] ?? []), ...h[oldName]].slice(0, MAX_PER_PROJECT);
  for (const r of h[newName]) r.project = newName;
  delete h[oldName];
  save(h);
}

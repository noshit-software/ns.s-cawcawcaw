import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CAWCAWCAW_DIR } from '../store/paths.js';

export interface ActivityEntry {
  id: string;
  timestamp: string;
  project: string;
  worthy: boolean;
  reason: string;
  results?: { platform: string; success: boolean; url?: string; error?: string }[];
}

const MAX_ENTRIES = 200;
const ACTIVITY_PATH = join(CAWCAWCAW_DIR, 'activity.json');

function load(): ActivityEntry[] {
  if (!existsSync(ACTIVITY_PATH)) return [];
  try { return JSON.parse(readFileSync(ACTIVITY_PATH, 'utf-8')) as ActivityEntry[]; }
  catch { return []; }
}

function save(entries: ActivityEntry[]): void {
  writeFileSync(ACTIVITY_PATH, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf-8');
}

export function logActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): void {
  const entries = load();
  entries.unshift({
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  save(entries);
}

export function getActivity(limit = 50): ActivityEntry[] {
  return load().slice(0, Math.min(limit, MAX_ENTRIES));
}

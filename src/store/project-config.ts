import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';
import { renameProjectInQueue } from './queue.js';
import { renameProjectInHistory } from './post-history.js';
import { renameProjectInBuffer } from './commit-buffer.js';
import { renameProjectInActivity } from '../activity/log.js';

const CONFIG_PATH = PATHS.projects;

export interface ProjectConfig {
  schedule: string;       // 'immediate' | 'HH:MM' | 'HH:MM weekdays' | 'HH:MM weekends'
  reviewRequired: boolean;
  platforms: string[];    // empty = all configured platforms
  githubRepo: string;     // owner/repo — used for catchup via GitHub API
  philosophy: string;     // guiding philosophy for post generation
  tagline: string;        // fixed sign-off appended to every post
  voice: string;          // writing voice/perspective — injected into system prompt
  detailLevel: string;    // how technical/deep posts should go
  visibility: 'public' | 'private'; // public = visible to unauthenticated users
  lastCatchupCommit: string; // SHA of the last commit processed by catchup
}

export const DEFAULT_CONFIG: ProjectConfig = {
  schedule: '05:00',
  reviewRequired: true,
  platforms: [],
  githubRepo: '',
  philosophy: '',
  tagline: '',
  voice: 'First person singular ("I", never "we"). Present tense. Confident but not arrogant.',
  detailLevel: 'high-level',
  visibility: 'private' as const,
  lastCatchupCommit: '',
};

type Store = Record<string, ProjectConfig>;

function load(): Store {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function normalize(name: string): string {
  return name.toUpperCase();
}

export function getProjectConfig(project: string): ProjectConfig {
  return { ...DEFAULT_CONFIG, ...(load()[normalize(project)] ?? {}) };
}

export function setProjectConfig(project: string, config: Partial<ProjectConfig>): void {
  const store = load();
  const key = normalize(project);
  // Filter out undefined values so they don't override existing/default fields
  const defined = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined)
  );
  store[key] = { ...DEFAULT_CONFIG, ...(store[key] ?? {}), ...defined };
  save(store);
}

export function deleteProject(project: string): void {
  const store = load();
  delete store[normalize(project)];
  save(store);
}

export function renameProject(oldName: string, newName: string): void {
  const store = load();
  const oldKey = normalize(oldName);
  const newKey = normalize(newName);
  if (!store[oldKey]) return;
  store[newKey] = store[oldKey];
  delete store[oldKey];
  save(store);
  // Update all stores that reference project by name
  renameProjectInQueue(oldName, newName);
  renameProjectInHistory(oldName, newName);
  renameProjectInBuffer(oldName, newName);
  renameProjectInActivity(oldName, newName);
}

export function getAllProjectConfigs(): Record<string, ProjectConfig> {
  const store = load();
  for (const name of Object.keys(store)) {
    store[name] = { ...DEFAULT_CONFIG, ...store[name] };
  }
  return store;
}

// Schedule parsing

export interface ScheduleSpec {
  type: 'immediate' | 'timed';
  hour?: number;
  minute?: number;
  days?: 'all' | 'weekdays' | 'weekends';
}

export function parseSchedule(schedule: string): ScheduleSpec {
  if (!schedule || schedule === 'immediate') return { type: 'immediate' };
  const match = schedule.trim().match(/^(\d{1,2}):(\d{2})(?:\s+(weekdays|weekends))?$/);
  if (!match) return { type: 'immediate' };
  return {
    type: 'timed',
    hour: parseInt(match[1], 10),
    minute: parseInt(match[2], 10),
    days: (match[3] as 'weekdays' | 'weekends') ?? 'all',
  };
}

export function shouldPublishNow(spec: ScheduleSpec, lastPublishedAt?: string): boolean {
  if (spec.type === 'immediate') return true;

  const now = new Date();
  const day = now.getDay(); // 0=Sun 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isWeekend = day === 0 || day === 6;

  if (spec.days === 'weekdays' && !isWeekday) return false;
  if (spec.days === 'weekends' && !isWeekend) return false;
  if (now.getHours() !== spec.hour) return false;

  // Only publish once per hour window
  if (lastPublishedAt) {
    const last = new Date(lastPublishedAt);
    if (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate() &&
      last.getHours() === now.getHours()
    ) return false;
  }

  return true;
}

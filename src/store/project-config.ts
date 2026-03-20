import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';

const CONFIG_PATH = PATHS.projects;

export interface ProjectConfig {
  schedule: string;       // 'immediate' | 'HH:MM' | 'HH:MM weekdays' | 'HH:MM weekends'
  reviewRequired: boolean;
  platforms: string[];    // empty = all configured platforms
  githubRepo: string;     // owner/repo — used for catchup via GitHub API
  philosophy: string;     // guiding philosophy for post generation
  tagline: string;        // fixed sign-off appended to every post
  lastCatchupCommit: string; // SHA of the last commit processed by catchup
}

export const DEFAULT_CONFIG: ProjectConfig = {
  schedule: '05:00',
  reviewRequired: false,
  platforms: [],
  githubRepo: '',
  philosophy: '',
  tagline: '',
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

export function getProjectConfig(project: string): ProjectConfig {
  return { ...DEFAULT_CONFIG, ...(load()[project] ?? {}) };
}

export function setProjectConfig(project: string, config: Partial<ProjectConfig>): void {
  const store = load();
  store[project] = { ...DEFAULT_CONFIG, ...(store[project] ?? {}), ...config };
  save(store);
}

export function getAllProjectConfigs(): Record<string, ProjectConfig> {
  return load();
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

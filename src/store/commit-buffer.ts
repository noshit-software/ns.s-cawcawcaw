import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { type CommitSummary } from '../webhook/github.js';
import { PATHS } from './paths.js';

const BUFFER_PATH = PATHS.buffer;

export interface ProjectBuffer {
  commits: CommitSummary[];
  notes: string; // Claude's own notes about where this narrative is heading
}

type Store = Record<string, ProjectBuffer>;

function load(): Store {
  if (!existsSync(BUFFER_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BUFFER_PATH, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  writeFileSync(BUFFER_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function addCommits(project: string, commits: CommitSummary[]): void {
  const store = load();
  const existing = store[project] ?? { commits: [], notes: '' };
  store[project] = { ...existing, commits: [...existing.commits, ...commits] };
  save(store);
}

export function getBuffer(project: string): ProjectBuffer {
  return load()[project] ?? { commits: [], notes: '' };
}

export function updateNotes(project: string, notes: string): void {
  const store = load();
  const existing = store[project] ?? { commits: [], notes: '' };
  store[project] = { ...existing, notes };
  save(store);
}

export function clearBuffer(project: string): void {
  const store = load();
  delete store[project];
  save(store);
}

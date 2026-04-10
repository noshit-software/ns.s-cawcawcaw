import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';

export interface GlobalSettings {
  postFrequencyDays: number; // minimum days between any two posts globally
}

const DEFAULTS: GlobalSettings = {
  postFrequencyDays: 1,
};

function load(): GlobalSettings {
  if (!existsSync(PATHS.settings)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(PATHS.settings, 'utf-8')) as Partial<GlobalSettings> };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: GlobalSettings): void {
  writeFileSync(PATHS.settings, JSON.stringify(s, null, 2), 'utf-8');
}

export function getSettings(): GlobalSettings {
  return load();
}

export function updateSettings(patch: Partial<GlobalSettings>): void {
  const current = load();
  save({ ...current, ...patch });
}

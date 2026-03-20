import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CAWCAWCAW_DIR = join(__dirname, '..', '..', 'data');

// Ensure directory exists on first import
mkdirSync(CAWCAWCAW_DIR, { recursive: true });

export const PATHS = {
  credentials:   join(CAWCAWCAW_DIR, 'credentials.json'),
  accounts:      join(CAWCAWCAW_DIR, 'accounts.json'),
  buffer:        join(CAWCAWCAW_DIR, 'buffer.json'),
  history:       join(CAWCAWCAW_DIR, 'history.json'),
  queue:         join(CAWCAWCAW_DIR, 'queue.json'),
  projects:      join(CAWCAWCAW_DIR, 'projects.json'),
};

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, '..', 'data', 'projects.json');

if (!existsSync(path)) {
  console.log('No projects.json found — nothing to migrate.');
  process.exit(0);
}

const store = JSON.parse(readFileSync(path, 'utf-8'));
let changed = 0;

for (const [name, cfg] of Object.entries(store) as [string, any][]) {
  if (cfg.detailLevel === 'high-level') {
    cfg.detailLevel = 'narrative';
    console.log(`${name}: high-level → narrative`);
    changed++;
  } else if (cfg.detailLevel === 'moderate') {
    cfg.detailLevel = 'conceptual';
    console.log(`${name}: moderate → conceptual`);
    changed++;
  }
}

if (changed === 0) {
  console.log('Nothing to migrate.');
} else {
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`Done. ${changed} project(s) updated.`);
}

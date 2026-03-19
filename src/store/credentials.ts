import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';

const STORE_PATH = PATHS.credentials;

type CredentialStore = Record<string, Record<string, string>>;

function loadStore(): CredentialStore {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as CredentialStore;
  } catch {
    return {};
  }
}

function saveStore(store: CredentialStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function getCredential(platform: string, key: string): string | undefined {
  // Env var takes precedence — format: PLATFORM_KEY (e.g. LINKEDIN_ACCESS_TOKEN)
  const envKey = `${platform.toUpperCase()}_${key.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey]) return process.env[envKey];
  return loadStore()[platform]?.[key] || undefined;
}

export function getPlatformCredentials(platform: string): Record<string, string> {
  return loadStore()[platform] ?? {};
}

export function setCredentials(platform: string, creds: Record<string, string>): void {
  const store = loadStore();
  store[platform] = { ...(store[platform] ?? {}), ...creds };
  // Remove empty-string values
  for (const key of Object.keys(store[platform])) {
    if (!store[platform][key]) delete store[platform][key];
  }
  saveStore(store);
}

export function clearCredentials(platform: string): void {
  const store = loadStore();
  delete store[platform];
  saveStore(store);
}

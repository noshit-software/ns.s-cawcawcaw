import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from './paths.js';

const STORE_PATH = PATHS.accounts;

export interface PlatformAccount {
  id: string;          // e.g. 'linkedin-personal'
  type: string;        // manifest key, e.g. 'linkedin'
  label: string;       // display name, e.g. 'Personal'
}

type Store = PlatformAccount[];

function load(): Store {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as Store;
  } catch {
    return [];
  }
}

function save(store: Store): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function getAllAccounts(): PlatformAccount[] {
  return load();
}

export function getAccountsByType(type: string): PlatformAccount[] {
  return load().filter(a => a.type === type);
}

export function getAccount(id: string): PlatformAccount | undefined {
  return load().find(a => a.id === id);
}

export function addAccount(type: string, label: string): PlatformAccount {
  const store = load();
  const id = type + '-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/,'');
  // Don't duplicate
  const existing = store.find(a => a.id === id);
  if (existing) return existing;
  const account: PlatformAccount = { id, type, label };
  store.push(account);
  save(store);
  return account;
}

export function removeAccount(id: string): void {
  save(load().filter(a => a.id !== id));
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  project: string;
  worthy: boolean;
  reason: string;
  results?: { platform: string; success: boolean; url?: string; error?: string }[];
}

const MAX_ENTRIES = 100;
const entries: ActivityEntry[] = [];

export function logActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): void {
  entries.unshift({
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

export function getActivity(limit = 50): ActivityEntry[] {
  return entries.slice(0, Math.min(limit, MAX_ENTRIES));
}

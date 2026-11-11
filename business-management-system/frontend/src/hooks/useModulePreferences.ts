import { useCallback, useSyncExternalStore } from 'react';

/**
 * Shared, localStorage-backed store for the two personalisation features:
 *
 *  - Pins    : modules the user pinned to the dashboard for one-click launch.
 *  - Usage   : per-module launch counters that drive the "Frequently Used" list.
 *
 * The store is module-level and consumed through `useSyncExternalStore`, so the
 * dashboard and the top navigation bar always render the same snapshot. A plain
 * `useState` hook per component (the previous behaviour) silently desynchronised
 * the two views until a full page reload.
 */

export interface ModuleUsageEntry {
  count: number;
  lastUsedAt: number;
}

export interface ModulePreferencesSnapshot {
  pins: string[];
  usage: Record<string, ModuleUsageEntry>;
}

const PINS_STORAGE_KEY = 'bms_user_pins';
const LEGACY_FAVOURITES_STORAGE_KEY = 'bms_user_favourites';
const USAGE_STORAGE_KEY = 'bms_module_usage';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizePinList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    pins.push(id);
  }
  return pins;
};

const sanitizeUsageMap = (value: unknown): Record<string, ModuleUsageEntry> => {
  if (!isPlainObject(value)) return {};
  const usage: Record<string, ModuleUsageEntry> = {};
  for (const [id, rawEntry] of Object.entries(value)) {
    if (!isPlainObject(rawEntry)) continue;
    const rawCount = rawEntry.count;
    const rawLastUsedAt = rawEntry.lastUsedAt;
    const count =
      typeof rawCount === 'number' && Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
    const lastUsedAt =
      typeof rawLastUsedAt === 'number' && Number.isFinite(rawLastUsedAt) ? rawLastUsedAt : 0;
    if (count === 0) continue;
    usage[id] = { count, lastUsedAt };
  }
  return usage;
};

const readJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read "${key}" from localStorage`, error);
    return null;
  }
};

const readSnapshot = (): ModulePreferencesSnapshot => {
  const storedPins = readJson(PINS_STORAGE_KEY);
  // First run after the upgrade: carry over pins saved under the old key.
  const pins =
    storedPins === null
      ? sanitizePinList(readJson(LEGACY_FAVOURITES_STORAGE_KEY))
      : sanitizePinList(storedPins);
  return { pins, usage: sanitizeUsageMap(readJson(USAGE_STORAGE_KEY)) };
};

let snapshot: ModulePreferencesSnapshot = readSnapshot();
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

const commit = (next: ModulePreferencesSnapshot): void => {
  snapshot = next;
  try {
    window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(next.pins));
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next.usage));
  } catch (error) {
    console.warn('Could not persist module preferences to localStorage', error);
  }
  notify();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ModulePreferencesSnapshot => snapshot;

// Keep two open browser tabs consistent with each other.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== PINS_STORAGE_KEY && event.key !== USAGE_STORAGE_KEY) return;
    snapshot = readSnapshot();
    notify();
  });
}

export const pinModule = (id: string): void => {
  if (!id || snapshot.pins.includes(id)) return;
  commit({ ...snapshot, pins: [...snapshot.pins, id] });
};

export const unpinModule = (id: string): void => {
  if (!snapshot.pins.includes(id)) return;
  commit({ ...snapshot, pins: snapshot.pins.filter((pin) => pin !== id) });
};

export const toggleModulePin = (id: string): void => {
  if (snapshot.pins.includes(id)) {
    unpinModule(id);
  } else {
    pinModule(id);
  }
};

export const recordModuleUsage = (id: string): void => {
  if (!id) return;
  const previous = snapshot.usage[id];
  const nextEntry: ModuleUsageEntry = {
    count: (previous?.count ?? 0) + 1,
    lastUsedAt: Date.now(),
  };
  commit({ ...snapshot, usage: { ...snapshot.usage, [id]: nextEntry } });
};

export const resetModuleUsage = (): void => {
  if (Object.keys(snapshot.usage).length === 0) return;
  commit({ ...snapshot, usage: {} });
};

export interface ModulePreferences extends ModulePreferencesSnapshot {
  isPinned: (id: string) => boolean;
  getUsageCount: (id: string) => number;
  togglePin: (id: string) => void;
  pin: (id: string) => void;
  unpin: (id: string) => void;
  resetUsage: () => void;
}

export const useModulePreferences = (): ModulePreferences => {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isPinned = useCallback((id: string) => current.pins.includes(id), [current.pins]);
  const getUsageCount = useCallback(
    (id: string) => current.usage[id]?.count ?? 0,
    [current.usage]
  );

  return {
    pins: current.pins,
    usage: current.usage,
    isPinned,
    getUsageCount,
    togglePin: toggleModulePin,
    pin: pinModule,
    unpin: unpinModule,
    resetUsage: resetModuleUsage,
  };
};
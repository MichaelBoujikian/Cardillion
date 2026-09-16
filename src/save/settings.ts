/**
 * Settings — spec.md §10. Two persisted toggles for now; fullscreen is a browser state and
 * the rest of the panel (show seed, abandon, reset) are actions, not values.
 */
import type { KeyValueStore } from './store';

export const SETTINGS_KEY = 'cardillion.settings.v1';

export interface Settings {
  /** Camera shake on hits (spec §4.8). */
  screenShake: boolean;
  /** Reduce motion & flashing: no grain, no shake, no shimmer or flicker; the vignette stays. */
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = { screenShake: true, reduceMotion: false };

export function readSettings(store: KeyValueStore): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (raw === null) return out;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return out;
    const p = parsed as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (typeof p[key] === 'boolean') out[key] = p[key];
    }
  } catch {
    // Unreadable settings are just defaults.
  }
  return out;
}

export function writeSettings(store: KeyValueStore, settings: Settings): void {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last for the session only.
  }
}

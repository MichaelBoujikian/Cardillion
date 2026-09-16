/**
 * Settings — spec.md §10. Stored beside the save; defaults fill in whatever is missing.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, readSettings, writeSettings } from './settings';
import { MemoryStore } from './store';

describe('settings', () => {
  it('reads defaults from an empty store', () => {
    expect(readSettings(new MemoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ screenShake: true, reduceMotion: false });
  });

  it('round-trips, and fills in keys a newer build added', () => {
    const store = new MemoryStore();
    writeSettings(store, { ...DEFAULT_SETTINGS, reduceMotion: true });
    expect(readSettings(store)).toEqual({ screenShake: true, reduceMotion: true });
    store.setItem(SETTINGS_KEY, JSON.stringify({ screenShake: false }));
    expect(readSettings(store)).toEqual({ screenShake: false, reduceMotion: false });
  });

  it('ignores junk values and unparsable JSON', () => {
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ screenShake: 'yes', reduceMotion: 1, extra: 3 }));
    expect(readSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.setItem(SETTINGS_KEY, '{');
    expect(readSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('survives a store that throws', () => {
    const store = new MemoryStore();
    store.failing = true;
    expect(() => writeSettings(store, DEFAULT_SETTINGS)).not.toThrow();
    expect(readSettings(store)).toEqual(DEFAULT_SETTINGS);
  });
});

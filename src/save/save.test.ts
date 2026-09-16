/**
 * The autosave slot — spec.md §10. Pure functions over a key-value store, exercised here with
 * an in-memory one; the browser passes localStorage.
 */
import { createRun } from '@engine/run';
import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, clearSave, readSave, writeSave } from './save';
import { MemoryStore } from './store';

describe('the autosave slot', () => {
  it('round-trips a run exactly, RNG streams included', () => {
    const store = new MemoryStore();
    const run = createRun('save-1');
    writeSave(store, run);
    const back = readSave(store);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.run).toEqual(run);
  });

  it('reports no save on an empty store and after clearing', () => {
    const store = new MemoryStore();
    expect(readSave(store)).toEqual({ ok: false, reason: 'none' });
    writeSave(store, createRun('save-2'));
    clearSave(store);
    expect(readSave(store)).toEqual({ ok: false, reason: 'none' });
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it('discards a save from another version, and removes it', () => {
    const store = new MemoryStore();
    writeSave(store, createRun('save-3'));
    const raw = JSON.parse(store.getItem(SAVE_KEY)!) as { version: number };
    raw.version = SAVE_VERSION + 1;
    store.setItem(SAVE_KEY, JSON.stringify(raw));
    expect(readSave(store)).toEqual({ ok: false, reason: 'outdated', version: SAVE_VERSION + 1 });
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it('discards a corrupt or foreign save, and removes it', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{not json');
    expect(readSave(store)).toEqual({ ok: false, reason: 'corrupt' });
    expect(store.getItem(SAVE_KEY)).toBeNull();

    store.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, run: { seed: 1 } }));
    expect(readSave(store)).toEqual({ ok: false, reason: 'corrupt' });

    // A run that references a card the content no longer has is as good as corrupt.
    const run = createRun('save-4');
    run.deck[0]!.def = 'card-that-was-removed';
    writeSave(store, run);
    expect(readSave(store)).toEqual({ ok: false, reason: 'corrupt' });
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it('a finished run is never saved', () => {
    const store = new MemoryStore();
    const run = createRun('save-5');
    writeSave(store, { ...run, phase: 'victory' });
    expect(readSave(store)).toEqual({ ok: false, reason: 'none' });
    writeSave(store, { ...run, phase: 'death' });
    expect(readSave(store)).toEqual({ ok: false, reason: 'none' });
  });

  it('survives a store that throws (private mode, quota)', () => {
    const store = new MemoryStore();
    store.failing = true;
    expect(() => writeSave(store, createRun('save-6'))).not.toThrow();
    expect(readSave(store)).toEqual({ ok: false, reason: 'none' });
    expect(() => clearSave(store)).not.toThrow();
  });
});

describe('save shape', () => {
  it('a save missing a field the current RunState has is set aside as outdated', () => {
    const store = new MemoryStore();
    const run = createRun('save-7') as unknown as Record<string, unknown>;
    delete run['snailTrail'];
    writeSave(store, run as unknown as ReturnType<typeof createRun>);
    const back = readSave(store);
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.reason).toBe('outdated');
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });
});

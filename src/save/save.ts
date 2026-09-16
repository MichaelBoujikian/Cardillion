/**
 * The autosave slot — spec.md §10. One slot, written after every engine action, deleted when a
 * run ends. A run's state is plain JSON with every RNG stream inside it (ADR 0003), so the
 * save is the state object plus a version stamp. A save from another version, or one that
 * does not look like a run, is discarded with a reason the title screen can show.
 */
import { CARDS } from '@content/cards';
import type { RunPhase, RunState } from '@engine/run';
import type { KeyValueStore } from './store';

export const SAVE_KEY = 'cardillion.save.v1';
/** Bump when RunState's shape or the content it references changes incompatibly. */
export const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  savedAt: string;
  run: RunState;
}

export type ReadResult =
  | { ok: true; run: RunState; savedAt: string }
  | { ok: false; reason: 'none' }
  | { ok: false; reason: 'outdated'; version: number }
  | { ok: false; reason: 'corrupt' };

const FINISHED: readonly RunPhase[] = ['victory', 'death'];

/** Persist a run in progress. A finished run clears the slot instead (spec §10: no save-scumming). */
export function writeSave(store: KeyValueStore, run: RunState): void {
  try {
    if (FINISHED.includes(run.phase)) {
      store.removeItem(SAVE_KEY);
      return;
    }
    const file: SaveFile = { version: SAVE_VERSION, savedAt: new Date().toISOString(), run };
    store.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Storage blocked or full: the game plays on without a save.
  }
}

export function clearSave(store: KeyValueStore): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do; there was nothing to remove.
  }
}

/** Read the slot. Anything unusable is removed so the same notice is not shown twice. */
export function readSave(store: KeyValueStore): ReadResult {
  let raw: string | null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: 'none' };
  }
  if (raw === null) return { ok: false, reason: 'none' };
  let file: unknown;
  try {
    file = JSON.parse(raw);
  } catch {
    clearSave(store);
    return { ok: false, reason: 'corrupt' };
  }
  if (!isRecord(file) || typeof file['version'] !== 'number') {
    clearSave(store);
    return { ok: false, reason: 'corrupt' };
  }
  if (file['version'] !== SAVE_VERSION) {
    clearSave(store);
    return { ok: false, reason: 'outdated', version: file['version'] };
  }
  const run = file['run'];
  if (!looksLikeRun(run)) {
    clearSave(store);
    return { ok: false, reason: 'corrupt' };
  }
  if (FINISHED.includes(run.phase)) {
    clearSave(store);
    return { ok: false, reason: 'none' };
  }
  return { ok: true, run, savedAt: typeof file['savedAt'] === 'string' ? file['savedAt'] : '' };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** A shallow shape check plus the one reference that breaks everything: card ids. */
function looksLikeRun(x: unknown): x is RunState {
  if (!isRecord(x)) return false;
  if (typeof x['seed'] !== 'string' || typeof x['phase'] !== 'string') return false;
  if (!isRecord(x['map']) || !isRecord(x['rng'])) return false;
  if (!Array.isArray(x['deck'])) return false;
  for (const card of x['deck'] as unknown[]) {
    if (!isRecord(card) || typeof card['def'] !== 'string' || !(card['def'] in CARDS)) return false;
  }
  return true;
}

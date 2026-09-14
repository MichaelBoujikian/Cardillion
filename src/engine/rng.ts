/**
 * Deterministic random number generation for the rules engine.
 *
 * Every run is seeded. The engine never calls Math.random(); it draws from an Rng whose
 * state is a plain integer, so it can be saved, restored and forked into independent
 * streams (map, combat, rewards) without one stream perturbing another.
 *
 * Algorithm: mulberry32 (32-bit state, good statistical quality for game use, tiny).
 */

/** Hash any string to a 32-bit unsigned integer (xmur3 finaliser). */
export function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export type RngState = number;

export class Rng {
  private s: number;

  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  }

  /** Current state; store it in a save file and pass to `Rng.fromState` to resume. */
  get state(): RngState {
    return this.s;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new RangeError(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p` (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Weighted pick: `weights[i]` is the relative weight of `items[i]`. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError(
        'Rng.pickWeighted: items and weights must be non-empty and equal length',
      );
    }
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** New array, Fisher-Yates shuffled. Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /**
   * Derive an independent stream from this one. Forking with the same label from the same
   * state always yields the same child, so `run.rng.fork('map')` is reproducible.
   */
  fork(label: string): Rng {
    return new Rng(hashSeed(`${label}:${this.s.toString(16)}`));
  }
}

import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from './rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng('garden');
    const b = new Rng('garden');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    const a = new Rng('garden');
    const b = new Rng('thicket');
    expect(a.next()).not.toEqual(b.next());
  });

  it('resumes from a saved state', () => {
    const a = new Rng(12345);
    a.next();
    a.next();
    const resumed = Rng.fromState(a.state);
    expect(resumed.next()).toEqual(a.next());
  });

  it('int() stays within inclusive bounds', () => {
    const rng = new Rng('bounds');
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('shuffle() is a permutation and leaves the input untouched', () => {
    const rng = new Rng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('pickWeighted() respects weights', () => {
    const rng = new Rng('weights');
    let rare = 0;
    for (let i = 0; i < 10_000; i++) {
      if (rng.pickWeighted(['common', 'rare'], [93, 7]) === 'rare') rare++;
    }
    expect(rare / 10_000).toBeGreaterThan(0.05);
    expect(rare / 10_000).toBeLessThan(0.09);
  });

  it('fork() is reproducible and independent of the parent', () => {
    const parent = new Rng('run');
    const childA = parent.fork('map');
    const childB = new Rng('run').fork('map');
    expect(childA.next()).toEqual(childB.next());
    expect(new Rng('run').fork('combat').next()).not.toEqual(new Rng('run').fork('map').next());
  });

  it('hashSeed() is stable', () => {
    expect(hashSeed('cardillion')).toEqual(hashSeed('cardillion'));
    expect(hashSeed('cardillion')).not.toEqual(hashSeed('Cardillion'));
  });
});

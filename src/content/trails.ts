/**
 * Trail flavours — spec.md §8.4. A signpost names one of these; the numbers drive map
 * generation (§8.2) and rewards (§9).
 */

export type Flavor = 'thorny' | 'sunny' | 'market' | 'shadow';

export interface TrailFlavor {
  id: Flavor;
  name: string;
  /** Nodes on the trail before the boss, inclusive range. */
  length: [number, number];
  elites: number;
  shops: number;
  /** Cocoons besides the guaranteed one before the boss. */
  cocoons: number;
  crumbMultiplier: number;
  greebleChance: number;
  /** Added to the rare-card percentage on this trail's rewards. */
  rareBonus: number;
  blurb: string;
}

export const FLAVORS: Readonly<Record<Flavor, TrailFlavor>> = {
  thorny: {
    id: 'thorny',
    name: 'Thorny Trail',
    length: [11, 12],
    elites: 2,
    shops: 1,
    cocoons: 0,
    crumbMultiplier: 1.25,
    greebleChance: 0.2,
    rareBonus: 0,
    blurb: 'Long and mean. More fights, more crumbs.',
  },
  sunny: {
    id: 'sunny',
    name: 'Sunny Meadow',
    length: [8, 9],
    elites: 1,
    shops: 1,
    cocoons: 1,
    crumbMultiplier: 1,
    greebleChance: 0.2,
    rareBonus: 0,
    blurb: 'Short and gentle. An extra cocoon.',
  },
  market: {
    id: 'market',
    name: 'Market Road',
    length: [9, 10],
    elites: 1,
    shops: 2,
    cocoons: 0,
    crumbMultiplier: 1,
    greebleChance: 0.2,
    rareBonus: 0,
    blurb: 'The Snail keeps two stalls here.',
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow Path',
    length: [9, 10],
    elites: 2,
    shops: 1,
    cocoons: 0,
    crumbMultiplier: 1,
    greebleChance: 0.5,
    rareBonus: 8,
    blurb: 'Two elites, rarer finds, and something unseen.',
  },
};

/** 0-based trail indices where trails share a node (spec §8.2: around the 4th and 8th node). */
export const CROSSINGS: readonly [number, number] = [3, 7];

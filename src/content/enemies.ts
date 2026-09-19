/**
 * Enemy definitions — spec.md §7. Move weights are relative; rules like `noRepeat` and
 * `maxUses` are applied by the engine when it rolls intents. The Moose (act 2) is roadmap
 * and deliberately absent.
 */
import type { EnemyDef } from '@engine/types';

/** Ids `<prefix>-01` .. `<prefix>-NN`, as the video cutter writes them. */
const frames = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

const ENEMY_LIST: EnemyDef[] = [
  {
    id: 'rat',
    name: 'Rat',
    hp: 11,
    tier: 'common',
    traits: [],
    moves: [
      { id: 'gnaw', name: 'Gnaw', weight: 65, effects: [{ kind: 'attack', amount: 4 }] },
      {
        id: 'frenzy',
        name: 'Frenzy',
        weight: 35,
        effects: [{ kind: 'attack', amount: 2, times: 2 }],
      },
    ],
    // The mutant rat, approved 2026-09-17 (docs/art-pipeline.md "The recipe"): the loop is a
    // local Wan 2.2 clip of the still (only the tentacles sway), the one fidget is the Sora clip's
    // startle - the only movement from any model that came back to its own first frame - and
    // the strike and hit are stills from the gpt-image-2.5 pose sheet. All frames are tone-matched
    // to the v1 possum (`--tone enemy-possum`, the brightness every creature now shares); the v1
    // `enemy-rat` sprite stays on disk as a master and no longer ships.
    art: 'enemy-rat-loop-01',
    poses: {
      windup: 'enemy-rat-windup',
      attack: 'enemy-rat-attack',
      hit: 'enemy-rat-hit',
      loop: { frames: frames('enemy-rat-loop', 45), fps: 12 },
      fidgets: [{ frames: frames('enemy-rat-startle', 17), fps: 12 }],
    },
  },
  {
    id: 'possum',
    name: 'Possum',
    hp: 24,
    tier: 'common',
    traits: ['playDead'],
    reviveHp: 6,
    moves: [
      { id: 'bite', name: 'Bite', weight: 50, effects: [{ kind: 'attack', amount: 6 }] },
      {
        id: 'hiss',
        name: 'Hiss',
        weight: 25,
        effects: [{ kind: 'apply', status: 'weak', amount: 1 }],
      },
      {
        id: 'lunge',
        name: 'Lunge',
        weight: 25,
        noRepeat: true,
        effects: [{ kind: 'attack', amount: 9 }],
      },
    ],
    // The mutant possum, approved 2026-09-18: a gpt edit of the v1 sprite (belly-to-eye tentacle,
    // wounds), then a local klein edit (seed 4) that put skin back over the ribs; strike and hit
    // from a gpt pose sheet; Play Dead is the same mutations on the v1 dead pose (`deadArt`, now
    // the real dead sprite). The loop is a local Wan clip (only the tentacles sway,
    // possum2-loop-11 0.3-3.0 s); the one fidget is a retch - guts out and sucked back in
    // (possum2-retch-201 0.75-1.92 s forward then back). Tone-matched to the v1 possum, which
    // stays on disk as a master and no longer ships.
    art: 'enemy-possum-loop-01',
    deadArt: 'enemy-possum-dead',
    poses: {
      windup: 'enemy-possum-windup',
      attack: 'enemy-possum-attack',
      hit: 'enemy-possum-hit',
      loop: { frames: frames('enemy-possum-loop', 33), fps: 12 },
      fidgets: [{ frames: frames('enemy-possum-retch', 28), fps: 12 }],
    },
  },
  {
    id: 'spider',
    name: 'Spider',
    hp: 18,
    tier: 'common',
    traits: [],
    moves: [
      { id: 'bite', name: 'Bite', weight: 50, effects: [{ kind: 'attack', amount: 5 }] },
      {
        id: 'spin-web',
        name: 'Spin Web',
        weight: 50,
        maxUses: 3,
        effects: [{ kind: 'cobweb', count: 1 }],
      },
    ],
    // The mutant tarantula, approved 2026-09-18: a gpt edit of the v1 spider (eggs and spiderlings
    // on its back, a front leg torn off), then a local klein edit that took every wound off - dark
    // and morbid, not gory; strike and hit from a gpt sheet in the thicket-morbid style, the
    // wind-up after the owner's photo of a rearing funnel-web. The loop is the still tail of a Sora
    // jaws clip; the fidgets are that clip's jaws spreading and a local Wan rear-up (both front
    // pairs spread and rise, played forward then back so it lands home); a Wan clip of both back
    // legs rising for Spin Web was cut and taken out again. The raised legs need headroom, so the frames sit on
    // an 848x848 canvas with the rest pose at 56% of it; `height` puts the spider back at a common
    // creature's size (spec §11.4). The v1 sprite stays on disk as a master and no longer ships.
    art: 'enemy-spider-loop-01',
    height: 3.8,
    poses: {
      windup: 'enemy-spider-windup',
      attack: 'enemy-spider-attack',
      hit: 'enemy-spider-hit',
      loop: { frames: frames('enemy-spider-loop', 15), fps: 12 },
      fidgets: [
        { frames: frames('enemy-spider-jaws', 30), fps: 12 },
        { frames: frames('enemy-spider-rear', 38), fps: 12 },
      ],
    },
  },
  {
    id: 'scorpion',
    name: 'Scorpion',
    hp: 22,
    tier: 'common',
    traits: [],
    moves: [
      {
        id: 'sting',
        name: 'Sting',
        weight: 50,
        effects: [
          { kind: 'attack', amount: 3 },
          { kind: 'apply', status: 'poison', amount: 3 },
        ],
      },
      { id: 'pincer', name: 'Pincer', weight: 50, effects: [{ kind: 'attack', amount: 7 }] },
    ],
    art: 'enemy-scorpion',
  },
  {
    id: 'greeble',
    name: 'Greeble',
    hp: 14,
    tier: 'common',
    traits: ['unseen'],
    moves: [
      { id: 'pilfer', name: 'Pilfer', weight: 100, effects: [{ kind: 'pilfer', amount: 4 }] },
    ],
    art: 'enemy-greeble',
  },
  {
    id: 'rat-king',
    name: 'Rat King',
    hp: 48,
    tier: 'elite',
    traits: [],
    moves: [
      {
        id: 'summon',
        name: 'Summon Rat',
        weight: 40,
        effects: [{ kind: 'summon', enemy: 'rat', maxPresent: 2 }],
      },
      { id: 'gnaw', name: 'Gnaw', weight: 40, effects: [{ kind: 'attack', amount: 8 }] },
      {
        id: 'frenzy',
        name: 'Frenzy',
        weight: 20,
        effects: [{ kind: 'attack', amount: 3, times: 3 }],
      },
    ],
    art: 'enemy-rat-king',
  },
  {
    id: 'wolf-spider',
    name: 'Wolf Spider',
    hp: 55,
    tier: 'elite',
    traits: [],
    moves: [
      {
        id: 'double-web',
        name: 'Double Web',
        weight: 35,
        maxUses: 3,
        effects: [{ kind: 'cobweb', count: 2 }],
      },
      { id: 'pounce', name: 'Pounce', weight: 35, effects: [{ kind: 'attack', amount: 11 }] },
      {
        id: 'bite',
        name: 'Bite',
        weight: 30,
        effects: [
          { kind: 'attack', amount: 6 },
          { kind: 'apply', status: 'weak', amount: 1 },
        ],
      },
    ],
    art: 'enemy-wolf-spider',
  },
  {
    id: 'bear',
    name: 'Bear',
    hp: 130,
    tier: 'boss',
    traits: [],
    moves: [
      { id: 'swipe', name: 'Swipe', weight: 0, effects: [{ kind: 'attack', amount: 9 }] },
      {
        id: 'roar',
        name: 'Roar',
        weight: 0,
        effects: [
          { kind: 'apply', status: 'weak', amount: 2 },
          { kind: 'block', amount: 8 },
        ],
      },
      { id: 'maul', name: 'Maul', weight: 0, effects: [{ kind: 'attack', amount: 18 }] },
    ],
    pattern: ['swipe', 'roar', 'swipe', 'maul'],
    enrage: { atHpFraction: 0.5, bonusDamage: 3, pattern: ['swipe', 'maul'] },
    art: 'boss-bear',
  },
];

export const ENEMIES: Readonly<Record<string, EnemyDef>> = Object.fromEntries(
  ENEMY_LIST.map((e) => [e.id, e]),
);

export function enemyDef(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error(`unknown enemy "${id}"`);
  return def;
}

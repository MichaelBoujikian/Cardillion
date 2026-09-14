/**
 * Card definitions — spec.md §5.3 (base roster) and §4.5 (Cobweb). Numbers are the spec's
 * first balance pass; change them in spec.md first, then here.
 */
import type { CardDef, CardForm } from '@engine/types';

const CARD_LIST: CardDef[] = [
  {
    id: 'wormillion',
    name: 'Wormillion',
    bug: 'wormillion',
    rarity: 'common',
    type: 'attack',
    targeting: 'enemy',
    base: { cost: 1, text: 'Deal 4.', effects: [{ kind: 'damage', amount: 4 }] },
    upgraded: { cost: 0, text: 'Deal 4.', effects: [{ kind: 'damage', amount: 4 }] },
    art: 'card-wormillion',
  },
  {
    id: 'roly-poly',
    name: 'Roly Poly',
    bug: 'roly-poly',
    rarity: 'common',
    type: 'skill',
    targeting: 'none',
    base: { cost: 1, text: 'Gain 5 Block.', effects: [{ kind: 'block', amount: 5 }] },
    upgraded: { cost: 1, text: 'Gain 8 Block.', effects: [{ kind: 'block', amount: 8 }] },
    art: 'card-roly-poly',
  },
  {
    id: 'caterpillar',
    name: 'Caterpillar',
    bug: 'caterpillar',
    rarity: 'common',
    type: 'attack',
    targeting: 'enemy',
    base: {
      cost: 1,
      text: 'Deal 2. Apply 3 Poison.',
      effects: [
        { kind: 'damage', amount: 2 },
        { kind: 'apply', status: 'poison', amount: 3, to: 'target' },
      ],
    },
    upgraded: {
      cost: 1,
      text: 'Deal 3. Apply 5 Poison.',
      effects: [
        { kind: 'damage', amount: 3 },
        { kind: 'apply', status: 'poison', amount: 5, to: 'target' },
      ],
    },
    art: 'card-caterpillar',
  },
  {
    id: 'ladybug',
    name: 'Ladybug',
    bug: 'ladybug',
    rarity: 'uncommon',
    type: 'attack',
    targeting: 'all-enemies',
    base: { cost: 2, text: 'Deal 4 to ALL enemies.', effects: [{ kind: 'damage', amount: 4 }] },
    upgraded: { cost: 2, text: 'Deal 6 to ALL enemies.', effects: [{ kind: 'damage', amount: 6 }] },
    art: 'card-ladybug',
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    bug: 'butterfly',
    rarity: 'uncommon',
    type: 'skill',
    targeting: 'none',
    base: {
      cost: 1,
      text: 'Draw 2. Apply 1 Weak to ALL enemies.',
      effects: [
        { kind: 'draw', amount: 2 },
        { kind: 'apply', status: 'weak', amount: 1, to: 'all-enemies' },
      ],
    },
    upgraded: {
      cost: 1,
      text: 'Draw 3. Apply 2 Weak to ALL enemies.',
      effects: [
        { kind: 'draw', amount: 3 },
        { kind: 'apply', status: 'weak', amount: 2, to: 'all-enemies' },
      ],
    },
    art: 'card-butterfly',
  },
  {
    id: 'chameleon',
    name: 'Chameleon',
    bug: 'chameleon',
    rarity: 'uncommon',
    type: 'attack',
    targeting: 'enemy',
    base: { cost: 2, text: 'Deal 9.', effects: [{ kind: 'damage', amount: 9 }] },
    upgraded: { cost: 2, text: 'Deal 13.', effects: [{ kind: 'damage', amount: 13 }] },
    art: 'card-chameleon',
  },
  {
    id: 'cat',
    name: 'Cat',
    bug: 'cat',
    rarity: 'rare',
    type: 'attack',
    targeting: 'enemy',
    canTargetUnseen: true,
    base: {
      cost: 1,
      text: 'Deal 6. Can target Unseen enemies.',
      effects: [{ kind: 'damage', amount: 6 }],
    },
    upgraded: {
      cost: 1,
      text: 'Deal 8. Unseen enemies it kills return double crumbs.',
      effects: [{ kind: 'damage', amount: 8, doubleStolenOnKill: true }],
    },
    art: 'card-cat',
  },
  {
    id: 'cobweb',
    name: 'Cobweb',
    bug: null,
    rarity: 'common',
    type: 'status',
    targeting: 'none',
    unplayable: true,
    ethereal: true,
    base: { cost: 0, text: 'Unplayable. Exhausts at end of turn.', effects: [] },
    upgraded: null,
    art: 'card-cobweb',
  },
];

export const CARDS: Readonly<Record<string, CardDef>> = Object.fromEntries(
  CARD_LIST.map((c) => [c.id, c]),
);

export function cardDef(id: string): CardDef {
  const def = CARDS[id];
  if (!def) throw new Error(`unknown card "${id}"`);
  return def;
}

/** The form a card plays as: upgraded if the copy is upgraded or its bug's titled unlock is owned. */
export function cardForm(def: CardDef, upgraded: boolean): CardForm {
  return upgraded && def.upgraded ? def.upgraded : def.base;
}

/** Starting deck — spec.md §5.5. */
export const STARTING_DECK: readonly string[] = [
  'wormillion',
  'wormillion',
  'wormillion',
  'wormillion',
  'wormillion',
  'wormillion',
  'roly-poly',
  'roly-poly',
  'roly-poly',
  'ladybug',
];

/**
 * Habitats — spec.md §8.9. A patch of ground under a Fight or Elite node that suits one bug
 * family and, sometimes, one kind of vermin. The effects are expressed as combat mods the
 * engine already understands; the map only stores the habitat id.
 */
import type { CombatMods } from '@engine/types';

export type HabitatId = 'soil' | 'flowers' | 'stone' | 'crevice';

export interface HabitatDef {
  id: HabitatId;
  name: string;
  /** Map glyph. */
  glyph: string;
  /** One line for the fight HUD and the map tooltip. */
  blurb: string;
  mods: Partial<CombatMods>;
  /** Multiplies the trail's Greeble chance for fights here. */
  greebleMultiplier: number;
}

const HABITAT_LIST: HabitatDef[] = [
  {
    id: 'soil',
    name: 'Damp Soil',
    glyph: '⛰',
    blurb: 'Wormillion attacks +1 · Roly Poly Block +2',
    mods: { familyAttackBonus: { wormillion: 1 }, familyBlockBonus: { 'roly-poly': 2 } },
    greebleMultiplier: 1,
  },
  {
    id: 'flowers',
    name: 'Flower Patch',
    glyph: '❀',
    blurb: 'First Butterfly card each turn refunds its cost',
    mods: { familyRefund: 'butterfly' },
    greebleMultiplier: 1,
  },
  {
    id: 'stone',
    name: 'Dry Stone',
    glyph: '☀',
    blurb: 'Chameleon attacks +2 · Poison on you +1',
    mods: { familyAttackBonus: { chameleon: 2 }, enemyPoisonBonus: 1 },
    greebleMultiplier: 1,
  },
  {
    id: 'crevice',
    name: 'Dark Crevice',
    glyph: '◐',
    blurb: 'Cat attacks +2 · Spiders spin +1 Cobweb · Greebles likelier',
    mods: { familyAttackBonus: { cat: 2 }, enemyCobwebBonus: 1 },
    greebleMultiplier: 2,
  },
];

export const HABITATS: Readonly<Record<HabitatId, HabitatDef>> = Object.fromEntries(
  HABITAT_LIST.map((h) => [h.id, h]),
) as Record<HabitatId, HabitatDef>;

export const HABITAT_IDS: readonly HabitatId[] = HABITAT_LIST.map((h) => h.id);

/** Share of Fight and Elite nodes that get a habitat (spec §8.9, tuning). */
export const HABITAT_CHANCE = 0.5;

export function habitatDef(id: string): HabitatDef {
  const def = HABITATS[id as HabitatId];
  if (!def) throw new Error(`unknown habitat "${id}"`);
  return def;
}

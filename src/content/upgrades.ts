/**
 * Titled unlocks, general upgrades, and Wormillionaire — spec.md §6. Prices and effect
 * descriptions live here as data; the effects themselves are wired into the engine
 * (`combat.ts`'s `CombatMods`, `run.ts`'s purchase and reward logic).
 */
import type { BugId } from '@engine/types';

export const TITLED_UNLOCK_PRICE = 65;
export const GENERAL_UPGRADE_PRICE = 70;
export const WORMILLIONAIRE_PRICE = 85;
/** Wormillion+ copies added to the deck by Wormillionaire. */
export const WORMILLIONAIRE_COUNT = 5;

/** The gentlemanly title each bug's unlock carries (spec §6.1). */
export const TITLED_UNLOCKS: Readonly<Record<BugId, string>> = {
  wormillion: 'Mr. Wormsley',
  'roly-poly': 'Sir Rollsalot',
  caterpillar: 'Professor Pillar',
  ladybug: 'Lady Bugsworth',
  butterfly: 'Madame Butterfly',
  chameleon: 'Doctor Chameleon',
  cat: 'Sir Reginald V',
};

export type UpgradeId =
  | 'solar-panel'
  | 'thick-thorax'
  | 'crumb-magnet'
  | 'spare-parts'
  | 'sharpened-mandibles'
  | 'cats-whisker';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  text: string;
}

const UPGRADE_LIST: UpgradeDef[] = [
  {
    id: 'solar-panel',
    name: 'Solar Panel',
    text: '+1 Charge on the first turn of every fight.',
  },
  {
    id: 'thick-thorax',
    name: 'Thick Thorax',
    text: '+10 max HP (and heal 10).',
  },
  {
    id: 'crumb-magnet',
    name: 'Crumb Magnet',
    text: '+25% crumbs from fights.',
  },
  {
    id: 'spare-parts',
    name: 'Spare Parts',
    text: 'Heal 4 HP after every fight.',
  },
  {
    id: 'sharpened-mandibles',
    name: 'Sharpened Mandibles',
    text: 'Attacks deal +1 damage.',
  },
  {
    id: 'cats-whisker',
    name: "Cat's Whisker",
    text: 'See the roaming Greeble on the map. Greebles steal 1 fewer crumb per turn.',
  },
];

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = Object.fromEntries(
  UPGRADE_LIST.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

export const UPGRADE_IDS = UPGRADE_LIST.map((u) => u.id);

export function upgradeDef(id: string): UpgradeDef {
  const def = UPGRADES[id as UpgradeId];
  if (!def) throw new Error(`unknown upgrade "${id}"`);
  return def;
}

/**
 * Encounter tables — spec.md §7.5. Which enemies appear at which depth along a trail.
 * Choosing from a pool is the engine's job (seeded); the pools are data.
 */

export type Encounter = readonly string[];

export const ENCOUNTERS = {
  /** Trail nodes 1–3. */
  early: [['rat', 'rat'], ['spider'], ['scorpion'], ['possum']] as readonly Encounter[],
  /** Trail nodes 4–7. */
  mid: [
    ['rat', 'rat', 'rat'],
    ['possum', 'rat'],
    ['spider', 'scorpion'],
    ['spider', 'spider'],
  ] as readonly Encounter[],
  /** Trail nodes 8 and beyond. */
  late: [
    ['possum', 'spider'],
    ['scorpion', 'scorpion', 'rat'],
    ['possum', 'possum'],
    ['spider', 'rat', 'rat'],
  ] as readonly Encounter[],
  elite: [['rat-king'], ['wolf-spider']] as readonly Encounter[],
  boss: [['bear']] as readonly Encounter[],
} as const;

/** Chance a non-boss fight gets a Greeble attached — spec.md §7.2 (tuning). */
export const GREEBLE_CHANCE = 0.2;

/** Bonus crumbs for killing a Greeble, on top of getting the stolen ones back (tuning). */
export const GREEBLE_KILL_BONUS = 15;

export function encounterPool(depth: number): readonly Encounter[] {
  if (depth <= 3) return ENCOUNTERS.early;
  if (depth <= 7) return ENCOUNTERS.mid;
  return ENCOUNTERS.late;
}

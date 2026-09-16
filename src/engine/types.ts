/**
 * Engine types. Plain JSON throughout: a CombatState can be structuredClone'd, serialised for
 * a save, or diffed in a test. Rules that use these types live in `combat.ts`; the data that
 * fills them lives in `src/content`. Numbers come from spec.md §4-§7.
 */
import type { RngState } from './rng';

export type BugId =
  'wormillion' | 'roly-poly' | 'caterpillar' | 'ladybug' | 'butterfly' | 'chameleon' | 'cat';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type CardType = 'attack' | 'skill' | 'status';
/** `enemy`: one chosen enemy. `all-enemies`: every seen enemy. `none`: no target. */
export type Targeting = 'enemy' | 'all-enemies' | 'none';

/** Timed conditions on a creature (spec §4.5). Cobweb is a card, not a status. */
export type Status = 'block' | 'poison' | 'weak';
export type Statuses = Record<Status, number>;

export type CardEffect =
  | {
      kind: 'damage';
      amount: number;
      times?: number;
      ignoreBlock?: boolean;
      /** Sir Reginald V: an Unseen enemy killed by this hit returns double its stolen crumbs. */
      doubleStolenOnKill?: boolean;
      /** Spot Barrage: each hit re-picks a random seen enemy instead of using the card's target. */
      randomTarget?: boolean;
    }
  | { kind: 'block'; amount: number }
  | {
      kind: 'apply';
      status: 'poison' | 'weak';
      amount: number;
      /** Flutter: a random seen enemy, re-picked at play time (not per-hit). */
      to: 'target' | 'all-enemies' | 'random-enemy';
    }
  | { kind: 'draw'; amount: number };

/** One playable form of a card: the base form or the upgraded form. */
export interface CardForm {
  cost: number;
  text: string;
  effects: CardEffect[];
}

export interface CardDef {
  id: string;
  name: string;
  /** Null for status cards (Cobweb) that belong to no bug. */
  bug: BugId | null;
  rarity: Rarity;
  type: CardType;
  targeting: Targeting;
  base: CardForm;
  /** Null when the card has no upgraded form (status cards). */
  upgraded: CardForm | null;
  /** Cat-family cards may target Unseen enemies and reveal them while held. */
  canTargetUnseen?: boolean;
  /** Leaves the fight instead of going to discard when played. */
  exhaust?: boolean;
  /** Exhausts at end of turn if still in hand (Cobweb). */
  ethereal?: boolean;
  unplayable?: boolean;
  /** Never offered by rewards or shops; enters the deck another way (Chrysalis via Pupate). */
  special?: boolean;
  /** Asset id for the art contract (spec §11.4). */
  art: string;
  /** Art for the upgraded form when it has its own (Sir Reginald V's top hat); else `art`. */
  upgradedArt?: string;
}

export interface CardInstance {
  uid: string;
  def: string;
  /** Injected upgraded copies (Wormillionaire) carry their own flag; titled unlocks upgrade by bug. */
  upgraded: boolean;
  /** A Chrysalis: the card def it becomes after the next won fight (spec §8.8). */
  emerges?: string;
}

export type EnemyEffect =
  | { kind: 'attack'; amount: number; times?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'apply'; status: 'poison' | 'weak'; amount: number }
  | { kind: 'cobweb'; count: number }
  | { kind: 'pilfer'; amount: number }
  | { kind: 'summon'; enemy: string; maxPresent: number };

export interface EnemyMove {
  id: string;
  name: string;
  /** Relative weight when rolling the next intent. */
  weight: number;
  effects: EnemyEffect[];
  /** Never rolled twice in a row (Possum's Lunge). */
  noRepeat?: boolean;
  /** Never rolled again after this many uses in one fight (Spider's webs). */
  maxUses?: number;
}

export type EnemyTrait = 'unseen' | 'playDead';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  tier: 'common' | 'elite' | 'boss';
  moves: EnemyMove[];
  traits: EnemyTrait[];
  /** When set, intents follow this cycle of move ids instead of weighted rolls (the Bear). */
  pattern?: string[];
  /** Boss enrage: at or below this HP fraction, attacks gain the bonus and the cycle switches. */
  enrage?: { atHpFraction: number; bonusDamage: number; pattern: string[] };
  /** HP the creature gets back up with when Play Dead triggers. */
  reviveHp?: number;
  art: string;
  /** Art shown from the moment Play Dead triggers until the creature next acts. */
  deadArt?: string;
}

export interface EnemyInstance {
  uid: string;
  def: string;
  hp: number;
  maxHp: number;
  statuses: Statuses;
  /** Move id of the shown intent; null once dead. */
  intent: string | null;
  lastMove: string | null;
  uses: Record<string, number>;
  /** Play Dead has been spent. */
  playedDead: boolean;
  /** Position in a boss's move cycle. */
  patternIndex: number;
  /** Boss enrage has triggered. */
  enraged: boolean;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  charge: number;
  chargePerTurn: number;
  statuses: Statuses;
}

/** General-upgrade effects that modify combat rules directly (spec §6.2). All default to 0. */
export interface CombatMods {
  /** Sharpened Mandibles: added to every player damage effect. */
  attackBonus: number;
  /** Solar Panel: added to Charge on turn 1 only. */
  firstTurnCharge: number;
  /** Cat's Whisker: subtracted (floored at 0) from every Greeble pilfer amount. */
  pilferReduction: number;
}

export type Phase = 'player' | 'won' | 'lost';

export interface CombatState {
  rng: RngState;
  turn: number;
  phase: Phase;
  mods: CombatMods;
  player: PlayerState;
  enemies: EnemyInstance[];
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
  /** Bugs whose titled unlock the run owns: every copy of those bugs is upgraded. */
  unlocks: BugId[];
  crumbs: number;
  /** Crumbs currently held by Greebles; returned if they die, lost if they escape. */
  stolen: number;
  /** Crumbs recovered from Greeble kills this fight (bonus included). */
  recovered: number;
  nextUid: number;
}

export type CombatAction = { type: 'playCard'; uid: string; target?: string } | { type: 'endTurn' };

/** Everything the renderer animates from. The renderer never diffs state (ADR 0003). */
export type CombatEvent =
  | { type: 'combatStarted' }
  | { type: 'turnStarted'; turn: number }
  | { type: 'chargeChanged'; charge: number }
  | { type: 'cardDrawn'; uid: string }
  | { type: 'deckReshuffled' }
  | { type: 'cardPlayed'; uid: string; target?: string }
  | { type: 'cardDiscarded'; uid: string }
  | { type: 'cardExhausted'; uid: string }
  | { type: 'cardAdded'; uid: string; def: string; pile: 'draw' | 'discard' }
  | { type: 'damageDealt'; source: string; target: string; amount: number; blocked: number }
  | { type: 'blockGained'; target: string; amount: number }
  | { type: 'statusApplied'; target: string; status: 'poison' | 'weak'; amount: number }
  | { type: 'poisonTicked'; target: string; amount: number }
  | { type: 'enemyDied'; uid: string }
  | { type: 'enemyRevived'; uid: string; hp: number }
  | { type: 'enemySummoned'; uid: string; def: string }
  | { type: 'enemyActed'; uid: string; move: string }
  | { type: 'intentRolled'; uid: string; move: string }
  | { type: 'crumbsStolen'; uid: string; amount: number }
  | { type: 'crumbsRecovered'; uid: string; amount: number }
  | { type: 'greebleEscaped'; uid: string; amount: number }
  | { type: 'playerDamaged'; amount: number; blocked: number }
  | { type: 'combatWon'; crumbsRecovered: number }
  | { type: 'combatLost' };

export interface StepResult {
  state: CombatState;
  events: CombatEvent[];
}

/** Target id used in events for the player, as opposed to an enemy uid. */
export const PLAYER = 'player';

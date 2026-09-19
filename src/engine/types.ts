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
      /** Worm Swarm: hit once per card of this card's bug in hand, itself included (ADR 0007). */
      perFamilyInHand?: boolean;
    }
  | { kind: 'block'; amount: number }
  | {
      kind: 'apply';
      status: 'poison' | 'weak';
      amount: number;
      /** Flutter: a random seen enemy, re-picked at play time (not per-hit). */
      to: 'target' | 'all-enemies' | 'random-enemy';
    }
  | { kind: 'draw'; amount: number }
  /** Scavenge: crumbs found mid-fight. */
  | { kind: 'crumbs'; amount: number }
  /** Burrow: a hit that lands at the start of the next turn on a random seen enemy. */
  | { kind: 'delayedDamage'; amount: number; ignoreBlock?: boolean };

/** A Burrow waiting underground (spec §5.4): resolved at the start of the player's turn. */
export interface PendingEffect {
  /** The player turn on which it resolves. */
  turn: number;
  /** Card that set it up: reported as the damage source. */
  uid: string;
  def: string;
  bug: BugId | null;
  amount: number;
  ignoreBlock: boolean;
}

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

/** Art ids played in order at a frame rate, all on the creature's canvas. */
export interface FrameSequence {
  frames: string[];
  fps: number;
}

/** Every art id a creature's poses name, whatever their shape. */
export function poseArtIds(poses: EnemyDef['poses']): string[] {
  if (!poses) return [];
  const ids = (v: string | FrameSequence): string[] => (typeof v === 'string' ? [v] : v.frames);
  const { moves, ...rest } = poses;
  return [
    ...Object.values(rest).flatMap((v) => (Array.isArray(v) ? v.flatMap(ids) : ids(v))),
    ...Object.values(moves ?? {}).flatMap(ids),
  ];
}

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
  /**
   * Billboard height in world units (spec §11.4): the tier's default (2.6 / 3.3 / 4.2) unless
   * the creature's frames sit on a canvas with headroom for a clip that rears up, in which
   * case this puts its rest pose back at the tier's size. Presentation, not a stat.
   */
  height?: number;
  /** Art shown from the moment Play Dead triggers until the creature next acts. */
  deadArt?: string;
  /**
   * Keyframe poses (spec §11.2), each an art id on the same canvas as `art` so the creature
   * keeps its size: shown during the wind-up and strike of a lunge, for a moment after a hit,
   * and `idle` frames cross-faded in a slow loop with `art` while it waits. Any missing pose
   * keeps whatever is showing.
   */
  poses?: {
    windup?: string;
    attack?: string;
    hit?: string;
    idle?: string[];
    /** Frames played back and forth while the creature waits (cut from a clip). */
    loop?: FrameSequence;
    /**
     * Short movements, one played now and then in turn; each should end where the loop
     * starts. One or more, cut from clips onto the loop's canvas.
     */
    fidgets?: FrameSequence[];
    /**
     * A clip per move id, played once in place of the loop while that move's body motion
     * runs (the spider raising its back legs to spin a web). A move without one keeps the
     * body motion alone; a lunge keeps its keyframes.
     */
    moves?: Record<string, FrameSequence>;
  };
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
  /** Lying in the Play Dead pose right now: from the revive until it next acts. */
  playingDead: boolean;
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

/**
 * Rule modifiers a fight starts with: general upgrades (spec §6.2) and the node's habitat
 * (spec §8.9). Everything defaults to 0 / empty / null.
 */
export interface CombatMods {
  /** Sharpened Mandibles: added to every player damage effect. */
  attackBonus: number;
  /** Solar Panel: added to Charge on turn 1 only. */
  firstTurnCharge: number;
  /** Cat's Whisker: subtracted (floored at 0) from every Greeble pilfer amount. */
  pilferReduction: number;
  /** Habitat: added to damage effects of cards of that bug. */
  familyAttackBonus: Partial<Record<BugId, number>>;
  /** Habitat: added to block effects of cards of that bug. */
  familyBlockBonus: Partial<Record<BugId, number>>;
  /** Habitat: the first card of this bug played each turn refunds its cost. */
  familyRefund: BugId | null;
  /** Habitat: added to every Poison an enemy applies to the player. */
  enemyPoisonBonus: number;
  /** Habitat: added to every Cobweb count an enemy spins. */
  enemyCobwebBonus: number;
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
  /** The habitat's family refund has been used this turn. */
  refundUsed: boolean;
  /** Delayed effects waiting to resolve (Burrow). */
  pending: PendingEffect[];
  nextUid: number;
}

export type CombatAction = { type: 'playCard'; uid: string; target?: string } | { type: 'endTurn' };

/** Everything the renderer animates from. The renderer never diffs state (ADR 0003). */
export type CombatEvent =
  | { type: 'combatStarted' }
  | { type: 'turnStarted'; turn: number }
  | { type: 'chargeChanged'; charge: number }
  /** A habitat refunded a card's cost (spec §8.9). */
  | { type: 'chargeRefunded'; uid: string; amount: number }
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
  /** The enemy begins its move: the wind-up, before any of the move's effects land. */
  | { type: 'enemyActing'; uid: string; move: string }
  | { type: 'enemyActed'; uid: string; move: string }
  | { type: 'intentRolled'; uid: string; move: string }
  | { type: 'crumbsStolen'; uid: string; amount: number }
  | { type: 'crumbsRecovered'; uid: string; amount: number }
  /** Crumbs found by a card (Scavenge). */
  | { type: 'crumbsFound'; amount: number }
  /** A delayed effect (Burrow) is resolving; the damageDealt that follows carries its uid. */
  | { type: 'delayedEffect'; uid: string; def: string }
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

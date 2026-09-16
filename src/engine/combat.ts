/**
 * Combat rules — spec.md §4 (turns, resources, deck, damage, statuses, intents, fight end),
 * §7.2 (the Greeble). A pure reducer: `applyAction(state, action)` returns a new state and the
 * events that explain it. Randomness comes only from the state's own Rng stream.
 */
import { cardDef, cardForm } from '@content/cards';
import { enemyDef } from '@content/enemies';
import { GREEBLE_KILL_BONUS } from '@content/encounters';
import { Rng } from './rng';
import {
  PLAYER,
  type BugId,
  type CardDef,
  type CardForm,
  type CardInstance,
  type CombatAction,
  type CombatEvent,
  type CombatMods,
  type CombatState,
  type EnemyDef,
  type EnemyInstance,
  type EnemyMove,
  type StepResult,
} from './types';

export const HAND_SIZE = 5;
export const MAX_HAND = 10;
export const WEAK_MULTIPLIER = 0.75;
/** What a Greeble does when there is nothing left to steal (spec §7.2). */
export const GREEBLE_HUNGRY_DAMAGE = 2;

export interface CombatSetup {
  /** Seed for this fight's RNG stream (already forked from the run seed). */
  seed: number | string;
  deck: (string | { def: string; upgraded: boolean })[];
  enemies: string[];
  hp: number;
  maxHp?: number;
  chargePerTurn: number;
  crumbs: number;
  unlocks: BugId[];
  /** General-upgrade effects (spec §6.2). Any field left out defaults to 0. */
  mods?: Partial<CombatMods>;
}

const DEFAULT_MODS: CombatMods = {
  attackBonus: 0,
  firstTurnCharge: 0,
  pilferReduction: 0,
  familyAttackBonus: {},
  familyBlockBonus: {},
  familyRefund: null,
  enemyPoisonBonus: 0,
  enemyCobwebBonus: 0,
};

export class IllegalAction extends Error {}

export type PlayCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'over' | 'unknown' | 'unplayable' | 'charge' | 'target' | 'dead' | 'unseen';
    };

// ---------- queries (safe for UI use) ----------

export function isUpgraded(state: CombatState, card: CardInstance): boolean {
  const def = cardDef(card.def);
  return card.upgraded || (def.bug !== null && state.unlocks.includes(def.bug));
}

export function formOf(state: CombatState, card: CardInstance): CardForm {
  return cardForm(cardDef(card.def), isUpgraded(state, card));
}

export function isUnseen(enemy: EnemyInstance): boolean {
  return enemyDef(enemy.def).traits.includes('unseen');
}

export function aliveEnemies(state: CombatState): EnemyInstance[] {
  return state.enemies.filter((e) => e.hp > 0);
}

export function seenEnemies(state: CombatState): EnemyInstance[] {
  return aliveEnemies(state).filter((e) => !isUnseen(e));
}

export function canPlay(state: CombatState, uid: string, target?: string): PlayCheck {
  if (state.phase !== 'player') return { ok: false, reason: 'over' };
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: 'unknown' };
  const def = cardDef(card.def);
  if (def.unplayable) return { ok: false, reason: 'unplayable' };
  if (formOf(state, card).cost > state.player.charge) return { ok: false, reason: 'charge' };
  if (def.targeting === 'enemy') {
    if (!target) return { ok: false, reason: 'target' };
    const enemy = state.enemies.find((e) => e.uid === target);
    if (!enemy || enemy.hp <= 0) return { ok: false, reason: 'dead' };
    if (isUnseen(enemy) && !def.canTargetUnseen) return { ok: false, reason: 'unseen' };
  }
  return { ok: true };
}

// ---------- setup ----------

export function createCombat(setup: CombatSetup): StepResult {
  const rng = new Rng(setup.seed);
  const events: CombatEvent[] = [];
  const state: CombatState = {
    rng: rng.state,
    turn: 0,
    phase: 'player',
    mods: { ...DEFAULT_MODS, ...setup.mods },
    player: {
      hp: setup.hp,
      maxHp: setup.maxHp ?? setup.hp,
      charge: 0,
      chargePerTurn: setup.chargePerTurn,
      statuses: { block: 0, poison: 0, weak: 0 },
    },
    enemies: [],
    draw: [],
    hand: [],
    discard: [],
    exhausted: [],
    unlocks: [...setup.unlocks],
    crumbs: setup.crumbs,
    stolen: 0,
    recovered: 0,
    refundUsed: false,
    pending: [],
    nextUid: 1,
  };
  for (const entry of setup.deck) {
    const { def, upgraded } = typeof entry === 'string' ? { def: entry, upgraded: false } : entry;
    cardDef(def); // validate
    state.draw.push({ uid: `c${state.nextUid++}`, def, upgraded });
  }
  for (const id of setup.enemies) state.enemies.push(spawnEnemy(state, id));
  if (seenEnemies(state).length === 0) throw new Error('encounter has no seen enemy');

  state.draw = rng.shuffle(state.draw);
  events.push({ type: 'combatStarted' });
  for (const enemy of state.enemies) rollIntent(state, events, rng, enemy);
  startPlayerTurn(state, events, rng);
  state.rng = rng.state;
  return { state, events };
}

function spawnEnemy(state: CombatState, def: string): EnemyInstance {
  const d = enemyDef(def);
  return {
    uid: `e${state.nextUid++}`,
    def,
    hp: d.hp,
    maxHp: d.hp,
    statuses: { block: 0, poison: 0, weak: 0 },
    intent: null,
    lastMove: null,
    uses: {},
    playedDead: false,
    playingDead: false,
    patternIndex: 0,
    enraged: false,
  };
}

// ---------- actions ----------

export function applyAction(state: CombatState, action: CombatAction): StepResult {
  if (state.phase !== 'player') throw new IllegalAction('the fight is over');
  const s = structuredClone(state);
  const events: CombatEvent[] = [];
  const rng = Rng.fromState(s.rng);
  switch (action.type) {
    case 'playCard': {
      const check = canPlay(s, action.uid, action.target);
      if (!check.ok) throw new IllegalAction(playRefusal(check.reason));
      playCard(s, events, rng, action.uid, action.target);
      break;
    }
    case 'endTurn':
      endTurn(s, events, rng);
      break;
  }
  s.rng = rng.state;
  return { state: s, events };
}

function playRefusal(reason: Exclude<PlayCheck, { ok: true }>['reason']): string {
  switch (reason) {
    case 'over':
      return 'the fight is over';
    case 'unknown':
      return 'that card is not in hand';
    case 'unplayable':
      return 'that card is unplayable';
    case 'charge':
      return 'not enough charge';
    case 'target':
      return 'that card needs a target';
    case 'dead':
      return 'that target is gone';
    case 'unseen':
      return 'only a Cat can target an Unseen enemy';
  }
}

// ---------- player turn ----------

function startPlayerTurn(s: CombatState, events: CombatEvent[], rng: Rng): void {
  s.turn++;
  events.push({ type: 'turnStarted', turn: s.turn });
  s.player.statuses.block = 0;
  s.refundUsed = false;
  s.player.charge = s.player.chargePerTurn + (s.turn === 1 ? s.mods.firstTurnCharge : 0);
  events.push({ type: 'chargeChanged', charge: s.player.charge });
  if (s.player.statuses.poison > 0) {
    const amount = s.player.statuses.poison;
    s.player.hp = Math.max(0, s.player.hp - amount);
    s.player.statuses.poison--;
    events.push({ type: 'poisonTicked', target: PLAYER, amount });
    if (s.player.hp === 0) {
      lose(s, events);
      return;
    }
  }
  resolvePending(s, events, rng);
  if (s.phase !== 'player') return;
  drawCards(s, events, rng, HAND_SIZE);
}

/** Burrows strike at the start of the turn: a random seen enemy, with today's bonuses. */
function resolvePending(s: CombatState, events: CombatEvent[], rng: Rng): void {
  const due = s.pending.filter((p) => p.turn <= s.turn);
  s.pending = s.pending.filter((p) => p.turn > s.turn);
  const weakMult = s.player.statuses.weak > 0 ? WEAK_MULTIPLIER : 1;
  for (const p of due) {
    const pool = seenEnemies(s);
    if (pool.length === 0) break;
    events.push({ type: 'delayedEffect', uid: p.uid, def: p.def });
    const familyAttack = p.bug ? (s.mods.familyAttackBonus[p.bug] ?? 0) : 0;
    const amount = Math.floor((p.amount + s.mods.attackBonus + familyAttack) * weakMult);
    damageEnemy(s, events, rng.pick(pool), amount, p.uid, {
      ignoreBlock: p.ignoreBlock,
      doubleStolen: false,
    });
    checkWin(s, events);
    if (s.phase !== 'player') return;
  }
}

function drawCards(s: CombatState, events: CombatEvent[], rng: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    if (s.draw.length === 0) {
      if (s.discard.length === 0) return;
      s.draw = rng.shuffle(s.discard);
      s.discard = [];
      events.push({ type: 'deckReshuffled' });
    }
    const card = s.draw.pop() as CardInstance;
    if (s.hand.length >= MAX_HAND) {
      s.discard.push(card);
      events.push({ type: 'cardDiscarded', uid: card.uid });
    } else {
      s.hand.push(card);
      events.push({ type: 'cardDrawn', uid: card.uid });
    }
  }
}

function playCard(
  s: CombatState,
  events: CombatEvent[],
  rng: Rng,
  uid: string,
  target?: string,
): void {
  const card = s.hand.find((c) => c.uid === uid) as CardInstance;
  const def = cardDef(card.def);
  const form = formOf(s, card);
  s.player.charge -= form.cost;
  events.push({ type: 'cardPlayed', uid, ...(target ? { target } : {}) });
  events.push({ type: 'chargeChanged', charge: s.player.charge });
  // Habitat refund: the first card of the favoured family each turn costs nothing after all.
  if (def.bug && s.mods.familyRefund === def.bug && !s.refundUsed && form.cost > 0) {
    s.refundUsed = true;
    s.player.charge += form.cost;
    events.push({ type: 'chargeRefunded', uid, amount: form.cost });
    events.push({ type: 'chargeChanged', charge: s.player.charge });
  }
  const familyAttack = def.bug ? (s.mods.familyAttackBonus[def.bug] ?? 0) : 0;
  const familyBlock = def.bug ? (s.mods.familyBlockBonus[def.bug] ?? 0) : 0;

  const weakMult = s.player.statuses.weak > 0 ? WEAK_MULTIPLIER : 1;
  const targetsFor = (scope: 'target' | 'all-enemies'): EnemyInstance[] => {
    if (scope === 'all-enemies' || def.targeting === 'all-enemies') return seenEnemies(s);
    if (def.targeting === 'enemy') {
      const e = s.enemies.find((x) => x.uid === target);
      return e && e.hp > 0 ? [e] : [];
    }
    return [];
  };

  for (const effect of form.effects) {
    switch (effect.kind) {
      case 'damage': {
        const times = effect.perFamilyInHand
          ? s.hand.filter((c) => cardDef(c.def).bug === def.bug).length
          : (effect.times ?? 1);
        const amount = Math.floor((effect.amount + s.mods.attackBonus + familyAttack) * weakMult);
        const opts = {
          ignoreBlock: effect.ignoreBlock ?? false,
          doubleStolen: effect.doubleStolenOnKill ?? false,
        };
        if (effect.randomTarget) {
          // Spot Barrage: each hit re-picks among the seen enemies (Unseen is never a random target).
          for (let i = 0; i < times; i++) {
            const pool = seenEnemies(s);
            if (pool.length === 0) break;
            damageEnemy(s, events, rng.pick(pool), amount, uid, opts);
          }
        } else {
          for (const enemy of targetsFor('target')) {
            for (let i = 0; i < times && enemy.hp > 0; i++) {
              damageEnemy(s, events, enemy, amount, uid, opts);
            }
          }
        }
        break;
      }
      case 'block': {
        const amount = effect.amount + familyBlock;
        s.player.statuses.block += amount;
        events.push({ type: 'blockGained', target: PLAYER, amount });
        break;
      }
      case 'apply': {
        // Flutter: 'random-enemy' picks once at play time, not once per target.
        const targets =
          effect.to === 'random-enemy'
            ? (() => {
                const pool = seenEnemies(s);
                return pool.length > 0 ? [rng.pick(pool)] : [];
              })()
            : targetsFor(effect.to);
        for (const enemy of targets) {
          enemy.statuses[effect.status] += effect.amount;
          events.push({
            type: 'statusApplied',
            target: enemy.uid,
            status: effect.status,
            amount: effect.amount,
          });
        }
        break;
      }
      case 'draw':
        drawCards(s, events, rng, effect.amount);
        break;
      case 'crumbs':
        s.crumbs += effect.amount;
        events.push({ type: 'crumbsFound', amount: effect.amount });
        break;
      case 'delayedDamage':
        s.pending.push({
          turn: s.turn + 1,
          uid,
          def: card.def,
          bug: def.bug,
          amount: effect.amount,
          ignoreBlock: effect.ignoreBlock ?? false,
        });
        break;
    }
  }

  // The card leaves the hand after resolving.
  const idx = s.hand.findIndex((c) => c.uid === uid);
  if (idx >= 0) {
    s.hand.splice(idx, 1);
    if (def.exhaust) {
      s.exhausted.push(card);
      events.push({ type: 'cardExhausted', uid });
    } else {
      s.discard.push(card);
      events.push({ type: 'cardDiscarded', uid });
    }
  }
  checkWin(s, events);
}

function endTurn(s: CombatState, events: CombatEvent[], rng: Rng): void {
  if (s.player.statuses.weak > 0) s.player.statuses.weak--;
  discardHand(s, events);
  s.player.charge = 0;
  events.push({ type: 'chargeChanged', charge: 0 });

  // Enemies summoned this turn wait until the next one.
  const acting = aliveEnemies(s).map((e) => e.uid);
  for (const uid of acting) {
    const enemy = s.enemies.find((e) => e.uid === uid);
    if (!enemy || enemy.hp <= 0) continue;
    enemyTurn(s, events, rng, enemy);
    if (s.phase !== 'player') return;
  }
  startPlayerTurn(s, events, rng);
}

function discardHand(s: CombatState, events: CombatEvent[]): void {
  for (const card of s.hand) {
    if (cardDef(card.def).ethereal) {
      s.exhausted.push(card);
      events.push({ type: 'cardExhausted', uid: card.uid });
    } else {
      s.discard.push(card);
      events.push({ type: 'cardDiscarded', uid: card.uid });
    }
  }
  s.hand = [];
}

// ---------- enemy turn ----------

function enemyTurn(s: CombatState, events: CombatEvent[], rng: Rng, enemy: EnemyInstance): void {
  const def = enemyDef(enemy.def);
  enemy.statuses.block = 0;
  if (enemy.statuses.poison > 0) {
    const amount = enemy.statuses.poison;
    enemy.statuses.poison--;
    events.push({ type: 'poisonTicked', target: enemy.uid, amount });
    enemy.hp -= amount;
    if (resolveDeath(s, events, enemy, false)) {
      checkWin(s, events);
      return;
    }
  }
  const move = def.moves.find((m) => m.id === enemy.intent);
  if (!move) return;
  events.push({ type: 'enemyActing', uid: enemy.uid, move: move.id });

  const enraged = isEnraged(def, enemy);
  const bonus = enraged ? (def.enrage?.bonusDamage ?? 0) : 0;
  const weakMult = enemy.statuses.weak > 0 ? WEAK_MULTIPLIER : 1;
  for (const effect of move.effects) {
    switch (effect.kind) {
      case 'attack': {
        const times = effect.times ?? 1;
        for (let i = 0; i < times && s.phase === 'player'; i++) {
          damagePlayer(s, events, Math.floor((effect.amount + bonus) * weakMult));
        }
        break;
      }
      case 'block':
        enemy.statuses.block += effect.amount;
        events.push({ type: 'blockGained', target: enemy.uid, amount: effect.amount });
        break;
      case 'apply': {
        const amount = effect.amount + (effect.status === 'poison' ? s.mods.enemyPoisonBonus : 0);
        s.player.statuses[effect.status] += amount;
        events.push({ type: 'statusApplied', target: PLAYER, status: effect.status, amount });
        break;
      }
      case 'cobweb':
        for (let i = 0; i < effect.count + s.mods.enemyCobwebBonus; i++) {
          const card: CardInstance = { uid: `c${s.nextUid++}`, def: 'cobweb', upgraded: false };
          // Shuffled into the draw pile at a random position.
          s.draw.splice(rng.int(0, s.draw.length), 0, card);
          events.push({ type: 'cardAdded', uid: card.uid, def: 'cobweb', pile: 'draw' });
        }
        break;
      case 'pilfer': {
        const wanted = Math.max(0, effect.amount - s.mods.pilferReduction);
        const take = Math.min(wanted, s.crumbs);
        if (take > 0) {
          s.crumbs -= take;
          s.stolen += take;
          events.push({ type: 'crumbsStolen', uid: enemy.uid, amount: take });
        } else {
          damagePlayer(s, events, Math.floor(GREEBLE_HUNGRY_DAMAGE * weakMult));
        }
        break;
      }
      case 'summon': {
        const present = s.enemies.filter((e) => e.def === effect.enemy && e.hp > 0).length;
        if (present < effect.maxPresent) {
          const spawned = spawnEnemy(s, effect.enemy);
          s.enemies.splice(s.enemies.indexOf(enemy) + 1, 0, spawned);
          events.push({ type: 'enemySummoned', uid: spawned.uid, def: spawned.def });
          rollIntent(s, events, rng, spawned);
        }
        break;
      }
    }
    if (s.phase !== 'player') return;
  }
  enemy.uses[move.id] = (enemy.uses[move.id] ?? 0) + 1;
  enemy.lastMove = move.id;
  enemy.patternIndex++;
  enemy.playingDead = false;
  events.push({ type: 'enemyActed', uid: enemy.uid, move: move.id });
  rollIntent(s, events, rng, enemy);
  if (enemy.statuses.weak > 0) enemy.statuses.weak--;
}

function isEnraged(def: EnemyDef, enemy: EnemyInstance): boolean {
  return def.enrage !== undefined && enemy.hp <= enemy.maxHp * def.enrage.atHpFraction;
}

function rollIntent(s: CombatState, events: CombatEvent[], rng: Rng, enemy: EnemyInstance): void {
  const def = enemyDef(enemy.def);
  if (enemy.hp <= 0) return;
  let move: EnemyMove | undefined;
  if (def.pattern) {
    const enraged = isEnraged(def, enemy);
    if (enraged && !enemy.enraged) {
      enemy.enraged = true;
      enemy.patternIndex = 0;
    }
    const cycle = enemy.enraged && def.enrage ? def.enrage.pattern : def.pattern;
    const id = cycle[enemy.patternIndex % cycle.length];
    move = def.moves.find((m) => m.id === id);
  } else {
    const candidates = def.moves.filter((m) => {
      if (m.noRepeat && enemy.lastMove === m.id) return false;
      if (m.maxUses !== undefined && (enemy.uses[m.id] ?? 0) >= m.maxUses) return false;
      const summon = m.effects.find((e) => e.kind === 'summon');
      if (summon && summon.kind === 'summon') {
        const present = s.enemies.filter((e) => e.def === summon.enemy && e.hp > 0).length;
        if (present >= summon.maxPresent) return false;
      }
      return true;
    });
    if (candidates.length === 0) return;
    move = rng.pickWeighted(
      candidates,
      candidates.map((m) => m.weight),
    );
  }
  if (!move) return;
  enemy.intent = move.id;
  events.push({ type: 'intentRolled', uid: enemy.uid, move: move.id });
}

// ---------- damage & death ----------

function damageEnemy(
  s: CombatState,
  events: CombatEvent[],
  enemy: EnemyInstance,
  amount: number,
  source: string,
  opts: { ignoreBlock: boolean; doubleStolen: boolean },
): void {
  let blocked = 0;
  let through = amount;
  if (!opts.ignoreBlock && enemy.statuses.block > 0) {
    blocked = Math.min(enemy.statuses.block, amount);
    enemy.statuses.block -= blocked;
    through = amount - blocked;
  }
  const hpLost = Math.min(enemy.hp, through);
  enemy.hp -= hpLost;
  events.push({ type: 'damageDealt', source, target: enemy.uid, amount: hpLost, blocked });
  resolveDeath(s, events, enemy, opts.doubleStolen);
}

/** Handles hp <= 0: Play Dead once, otherwise death (and Greeble loot). Returns true if dead. */
function resolveDeath(
  s: CombatState,
  events: CombatEvent[],
  enemy: EnemyInstance,
  doubleStolen: boolean,
): boolean {
  if (enemy.hp > 0) return false;
  const def = enemyDef(enemy.def);
  if (def.traits.includes('playDead') && !enemy.playedDead) {
    enemy.playedDead = true;
    enemy.playingDead = true;
    enemy.hp = def.reviveHp ?? 1;
    events.push({ type: 'enemyRevived', uid: enemy.uid, hp: enemy.hp });
    return false;
  }
  enemy.hp = 0;
  enemy.intent = null;
  events.push({ type: 'enemyDied', uid: enemy.uid });
  if (def.traits.includes('unseen')) {
    const amount = s.stolen * (doubleStolen ? 2 : 1) + GREEBLE_KILL_BONUS;
    s.crumbs += amount;
    s.recovered += amount;
    s.stolen = 0;
    events.push({ type: 'crumbsRecovered', uid: enemy.uid, amount });
  }
  return true;
}

function damagePlayer(s: CombatState, events: CombatEvent[], amount: number): void {
  let blocked = 0;
  let through = amount;
  if (s.player.statuses.block > 0) {
    blocked = Math.min(s.player.statuses.block, amount);
    s.player.statuses.block -= blocked;
    through = amount - blocked;
  }
  const hpLost = Math.min(s.player.hp, through);
  s.player.hp -= hpLost;
  events.push({ type: 'playerDamaged', amount: hpLost, blocked });
  if (s.player.hp === 0) lose(s, events);
}

function lose(s: CombatState, events: CombatEvent[]): void {
  s.phase = 'lost';
  events.push({ type: 'combatLost' });
}

function checkWin(s: CombatState, events: CombatEvent[]): void {
  if (s.phase !== 'player' || seenEnemies(s).length > 0) return;
  for (const enemy of aliveEnemies(s)) {
    // Only Unseen enemies can still be standing here: they slip away with the loot.
    events.push({ type: 'greebleEscaped', uid: enemy.uid, amount: s.stolen });
    enemy.hp = 0;
    enemy.intent = null;
  }
  s.stolen = 0;
  s.phase = 'won';
  events.push({ type: 'combatWon', crumbsRecovered: s.recovered });
}

export type { CardDef };

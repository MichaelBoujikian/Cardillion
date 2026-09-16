/**
 * Fuzz: many seeded runs played to the end by a random-but-seeded policy, with the engine's
 * invariants checked after every action. This is the "bug testing" pass in durable form — a
 * regression here names a seed and a step, so it is reproducible.
 */
import { CARDS, PUPATION, cardDef } from '@content/cards';
import { enemyDef } from '@content/enemies';
import { describe, expect, it } from 'vitest';
import { MAX_HAND, canPlay, seenEnemies } from './combat';
import { nodeAt } from './map';
import { Rng } from './rng';
import { applyRunAction, createRun, type RunAction, type RunState } from './run';
import type { CardDef, CombatState, EnemyInstance } from './types';

const RUNS = 120;
const MAX_STEPS = 4000;
/** Whole runs are slow on CI runners; well above the default 5 s. */
const BUDGET_MS = 60_000;

type Policy = 'random' | 'greedy';

/** Every legal card play in the current hand. */
function playOptions(c: CombatState): { uid: string; target?: string; def: CardDef }[] {
  const options: { uid: string; target?: string; def: CardDef }[] = [];
  for (const card of c.hand) {
    const def = cardDef(card.def);
    if (def.targeting === 'enemy') {
      for (const e of c.enemies) {
        if (canPlay(c, card.uid, e.uid).ok) options.push({ uid: card.uid, target: e.uid, def });
      }
    } else if (canPlay(c, card.uid).ok) options.push({ uid: card.uid, def });
  }
  return options;
}

const rank = (r: string) => (r === 'rare' ? 2 : r === 'uncommon' ? 1 : 0);

/**
 * A competent-but-simple player: attacks the weakest seen enemy, blocks when a hit is coming,
 * rests when hurt, buys upgrades first. What a new player does in their first hour.
 */
function greedyAction(run: RunState, rng: Rng): RunAction | null {
  switch (run.phase) {
    case 'map': {
      const next = nodeAt(run.map, run.position).next;
      const byType = (t: string) => next.find((e) => nodeAt(run.map, e.id).type === t);
      const cocoon = byType('cocoon');
      const shop = byType('shop');
      if (run.hp < run.maxHp * 0.5 && cocoon) return { type: 'travel', to: cocoon.id };
      if (run.crumbs >= 70 && shop) return { type: 'travel', to: shop.id };
      return { type: 'travel', to: rng.pick(next).id };
    }
    case 'fight': {
      const c = run.combat!;
      const options = playOptions(c);
      if (options.length === 0) return { type: 'combat', action: { type: 'endTurn' } };
      const attacks = (e: EnemyInstance) =>
        enemyDef(e.def)
          .moves.find((m) => m.id === e.intent)
          ?.effects.some((x) => x.kind === 'attack') ?? false;
      const incoming = c.enemies.some((e) => e.hp > 0 && attacks(e));
      const seen = seenEnemies(c);
      const weakest = seen.length > 0 ? seen.reduce((a, b) => (a.hp <= b.hp ? a : b)) : null;
      const isBlock = (o: (typeof options)[number]) =>
        o.def.type === 'skill' && o.def.base.effects.some((x) => x.kind === 'block');
      const chosen =
        (incoming && c.player.statuses.block === 0 ? options.find(isBlock) : undefined) ??
        (weakest
          ? options.find((o) => o.def.type === 'attack' && o.target === weakest.uid)
          : undefined) ??
        options.find((o) => o.def.type === 'attack') ??
        options[0]!;
      return {
        type: 'combat',
        action: chosen.target
          ? { type: 'playCard', uid: chosen.uid, target: chosen.target }
          : { type: 'playCard', uid: chosen.uid },
      };
    }
    case 'reward': {
      const offer = run.reward!;
      const best = [...offer.cards].sort(
        (a, b) => rank(cardDef(b).rarity) - rank(cardDef(a).rarity),
      )[0]!;
      const take = cardDef(best).rarity !== 'common' || run.deck.length < 14;
      return { type: 'takeReward', card: take ? best : null };
    }
    case 'shop': {
      const shop = run.shop!;
      const upgrade = shop.upgrades.findIndex((u) => !u.sold && u.price <= run.crumbs);
      if (upgrade >= 0) return { type: 'buyUpgrade', index: upgrade };
      const unlock = shop.unlocks.findIndex((u) => !u.sold && u.price <= run.crumbs);
      if (unlock >= 0) return { type: 'buyUnlock', index: unlock };
      const card = shop.cards.findIndex(
        (k) => !k.sold && k.price <= run.crumbs && cardDef(k.def).rarity !== 'common',
      );
      if (card >= 0) return { type: 'buyCard', index: card };
      return { type: 'leave' };
    }
    case 'cocoon': {
      if (run.hp < run.maxHp * 0.7) return { type: 'rest' };
      const pupatable = run.deck.find((c) => c.def in PUPATION);
      if (pupatable) return { type: 'pupate', uid: pupatable.uid };
      return { type: 'forage' };
    }
    case 'victory':
    case 'death':
      return null;
  }
}

/** Pick one legal action for the current phase, or null if the run is over. */
function chooseAction(run: RunState, rng: Rng): RunAction | null {
  switch (run.phase) {
    case 'map': {
      const next = nodeAt(run.map, run.position).next;
      return { type: 'travel', to: rng.pick(next).id };
    }
    case 'fight': {
      const c = run.combat!;
      // Mostly play, sometimes end the turn early, so both branches are exercised.
      if (rng.chance(0.15)) return { type: 'combat', action: { type: 'endTurn' } };
      const options = playOptions(c);
      if (options.length === 0) return { type: 'combat', action: { type: 'endTurn' } };
      const o = rng.pick(options);
      return {
        type: 'combat',
        action: o.target
          ? { type: 'playCard', uid: o.uid, target: o.target }
          : { type: 'playCard', uid: o.uid },
      };
    }
    case 'reward': {
      const offer = run.reward!;
      return { type: 'takeReward', card: rng.chance(0.7) ? rng.pick(offer.cards) : null };
    }
    case 'shop': {
      const shop = run.shop!;
      const buys: RunAction[] = [];
      shop.cards.forEach((c, index) => {
        if (!c.sold && c.price <= run.crumbs) buys.push({ type: 'buyCard', index });
      });
      shop.unlocks.forEach((u, index) => {
        if (!u.sold && u.price <= run.crumbs) buys.push({ type: 'buyUnlock', index });
      });
      shop.upgrades.forEach((u, index) => {
        if (!u.sold && u.price <= run.crumbs) buys.push({ type: 'buyUpgrade', index });
      });
      if (
        shop.wormillionaire &&
        !shop.wormillionaire.sold &&
        shop.wormillionaire.price <= run.crumbs
      )
        buys.push({ type: 'buyWormillionaire' });
      if (shop.removalPrice !== null && shop.removalPrice <= run.crumbs && run.deck.length > 1)
        buys.push({ type: 'removeCard', uid: rng.pick(run.deck).uid });
      if (buys.length > 0 && rng.chance(0.6)) return rng.pick(buys);
      return { type: 'leave' };
    }
    case 'cocoon': {
      const pupatable = run.deck.filter((c) => c.def in PUPATION);
      const roll = rng.next();
      if (roll < 0.35) return { type: 'rest' };
      if (roll < 0.6) return { type: 'forage' };
      if (roll < 0.85 && pupatable.length > 0)
        return { type: 'pupate', uid: rng.pick(pupatable).uid };
      return { type: 'leave' };
    }
    case 'victory':
    case 'death':
      return null;
  }
}

function checkInvariants(run: RunState, where: string): void {
  const at = (msg: string) => `${where}: ${msg}`;
  expect(run.hp, at('hp ≥ 0')).toBeGreaterThanOrEqual(0);
  expect(run.hp, at('hp ≤ maxHp')).toBeLessThanOrEqual(run.maxHp);
  expect(run.crumbs, at('crumbs ≥ 0')).toBeGreaterThanOrEqual(0);
  expect(run.deck.length, at('deck non-empty')).toBeGreaterThan(0);
  for (const card of run.deck) {
    expect(card.def in CARDS, at(`deck card ${card.def} exists`)).toBe(true);
    if (card.emerges) expect(card.def, at('only a Chrysalis emerges')).toBe('chrysalis');
  }
  expect(run.map.nodes[run.position], at('position is a node')).toBeDefined();
  expect(
    run.greebleNode !== run.map.start && run.greebleNode !== run.map.boss,
    at('Greeble marker off Start/Boss'),
  ).toBe(true);
  if (run.snailNode !== null)
    expect(run.map.nodes[run.snailNode], at('Snail on a node')).toBeDefined();
  expect(run.snailTrail.length, at('trail length')).toBeLessThanOrEqual(3);
  if (run.phase === 'fight') {
    const c = run.combat!;
    expect(c.player.hp, at('combat hp ≥ 0')).toBeGreaterThanOrEqual(0);
    expect(c.player.charge, at('charge ≥ 0')).toBeGreaterThanOrEqual(0);
    expect(c.hand.length, at('hand ≤ max')).toBeLessThanOrEqual(MAX_HAND);
    expect(c.crumbs, at('combat crumbs ≥ 0')).toBeGreaterThanOrEqual(0);
    for (const e of c.enemies) expect(e.hp, at('enemy hp ≥ 0')).toBeGreaterThanOrEqual(0);
    const uids = [...c.hand, ...c.draw, ...c.discard, ...c.exhausted].map((k) => k.uid);
    expect(new Set(uids).size, at('no duplicate card uids in the fight')).toBe(uids.length);
    for (const p of c.pending)
      expect(p.turn, at('pending is for a future turn')).toBeGreaterThan(c.turn - 1);
  } else {
    expect(run.combat, at('no combat outside a fight')).toBeNull();
  }
  if (run.phase === 'reward') expect(run.reward, at('a reward is pending')).not.toBeNull();
  if (run.phase === 'shop') expect(run.shop, at('a shop is open')).not.toBeNull();
}

/** Play a whole run; returns the final state and the actions taken. */
function playRun(seed: string, policy: Policy = 'random'): { run: RunState; actions: RunAction[] } {
  const rng = new Rng(`policy:${seed}`);
  let run = createRun(seed);
  const actions: RunAction[] = [];
  checkInvariants(run, `${seed} start`);
  for (let step = 0; step < MAX_STEPS; step++) {
    const action = policy === 'greedy' ? greedyAction(run, rng) : chooseAction(run, rng);
    if (!action) return { run, actions };
    actions.push(action);
    try {
      run = applyRunAction(run, action).run;
    } catch (err) {
      throw new Error(`${seed} step ${step} ${JSON.stringify(action)}: ${(err as Error).message}`, {
        cause: err,
      });
    }
    checkInvariants(run, `${seed} step ${step} after ${action.type}`);
  }
  throw new Error(`${seed}: run did not finish in ${MAX_STEPS} steps (phase ${run.phase})`);
}

describe('fuzz: whole runs under a random policy', () => {
  it(
    'every run ends in victory or death with the invariants intact',
    () => {
      for (let i = 0; i < RUNS; i++) {
        const { run } = playRun(`fuzz-${i}`);
        expect(['victory', 'death']).toContain(run.phase);
      }
    },
    BUDGET_MS,
  );

  it(
    'a greedy player wins some runs and loses some (a balance smoke test, not a target)',
    () => {
      let victories = 0;
      for (let i = 0; i < RUNS; i++) {
        const { run } = playRun(`greedy-${i}`, 'greedy');
        expect(['victory', 'death']).toContain(run.phase);
        if (run.phase === 'victory') victories++;
      }
      expect(victories).toBeGreaterThan(0);
      expect(victories).toBeLessThan(RUNS);
    },
    BUDGET_MS,
  );

  it(
    'is deterministic: the same seed and actions replay to the identical final state',
    () => {
      for (let i = 0; i < 10; i++) {
        const seed = `replay-${i}`;
        const first = playRun(seed);
        let run = createRun(seed);
        for (const action of first.actions) run = applyRunAction(run, action).run;
        expect(run).toEqual(first.run);
      }
    },
    BUDGET_MS,
  );
});

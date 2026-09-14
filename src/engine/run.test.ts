/**
 * The run loop — spec.md §3, §8.3, §9. Scenarios walk real generated maps with a strong test
 * deck so fights resolve deterministically.
 */
import { CARDS } from '@content/cards';
import { FLAVORS } from '@content/trails';
import { describe, expect, it } from 'vitest';
import { seenEnemies } from './combat';
import { BOSS, START, nodeAt, type GameMap } from './map';
import {
  COCOON_HEAL_FRACTION,
  ELITE_CRUMBS,
  FIGHT_CRUMBS,
  SHOP_REMOVAL_PRICE,
  SHOP_REMOVAL_STEP,
  applyRunAction,
  createRun,
  type RunAction,
  type RunEvent,
  type RunState,
} from './run';

const STRONG_DECK = Array<string>(10).fill('chameleon');

function step(run: RunState, action: RunAction) {
  return applyRunAction(run, action);
}

/** Play every affordable attack at the first seen enemy, then end the turn, until the fight ends. */
function winFight(run: RunState): { run: RunState; events: RunEvent[] } {
  let r = run;
  const all: RunEvent[] = [];
  for (let guard = 0; guard < 200 && r.phase === 'fight'; guard++) {
    const c = r.combat!;
    const target = seenEnemies(c)[0];
    const card = c.hand.find((k) => {
      const def = CARDS[k.def]!;
      return def.type === 'attack' && def.base.cost <= c.player.charge;
    });
    const action: RunAction =
      card && target
        ? { type: 'combat', action: { type: 'playCard', uid: card.uid, target: target.uid } }
        : { type: 'combat', action: { type: 'endTurn' } };
    const s = step(r, action);
    r = s.run;
    all.push(...s.events);
  }
  return { run: r, events: all };
}

/** Shortest path of node ids from `from` to `to`. */
function pathTo(map: GameMap, from: string, to: string): string[] {
  const prev = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === to) break;
    for (const e of nodeAt(map, id).next) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      prev.set(e.id, id);
      queue.push(e.id);
    }
  }
  const path: string[] = [];
  for (let id = to; id !== from; id = prev.get(id)!) path.unshift(id);
  return path;
}

/** Travel to `target`, resolving every node on the way (fights won, rewards skipped, stops left). */
function advanceTo(run: RunState, target: string, events: RunEvent[] = []): RunState {
  let r = run;
  for (const id of pathTo(r.map, r.position, target)) {
    const s = step(r, { type: 'travel', to: id });
    r = s.run;
    events.push(...s.events);
    if (id === target) break;
    r = settle(r, events);
  }
  return r;
}

function settle(run: RunState, events: RunEvent[] = []): RunState {
  let r = run;
  if (r.phase === 'fight') {
    const w = winFight(r);
    r = w.run;
    events.push(...w.events);
  }
  if (r.phase === 'reward') r = step(r, { type: 'takeReward', card: null }).run;
  if (r.phase === 'shop' || r.phase === 'cocoon') r = step(r, { type: 'leave' }).run;
  return r;
}

const firstOfType = (run: RunState, type: string): string => {
  for (const t of run.map.trails) {
    const id = t.nodes.find((n) => nodeAt(run.map, n).type === type);
    if (id) return id;
  }
  throw new Error(`no ${type} node`);
};

describe('createRun', () => {
  it('starts on the map at Start with the starting deck, HP and crumbs', () => {
    const run = createRun('run-1');
    expect(run.phase).toBe('map');
    expect(run.position).toBe(START);
    expect(run.deck).toHaveLength(10);
    expect(run.hp).toBe(60);
    expect(run.crumbs).toBe(25);
    expect(run.map.trails).toHaveLength(3);
  });

  it('is deterministic', () => {
    expect(createRun('same')).toEqual(createRun('same'));
  });
});

describe('travel and fights', () => {
  it('only allows travel along an edge, and entering a fight node starts a fight', () => {
    const run = createRun('run-2', { deck: STRONG_DECK });
    const first = nodeAt(run.map, START).next[0]!.id;
    expect(() => step(run, { type: 'travel', to: BOSS })).toThrow(/reachable/);
    const { run: r2, events } = step(run, { type: 'travel', to: first });
    expect(r2.phase).toBe('fight');
    expect(r2.combat).not.toBeNull();
    expect(r2.combat!.player.hp).toBe(60);
    expect(r2.combat!.crumbs).toBe(25);
    expect(events.map((e) => e.type)).toEqual(['traveled', 'fightStarted', 'combat']);
    expect(r2.visited).toContain(first);
  });

  it('early fights draw from the early pool', () => {
    for (let i = 0; i < 20; i++) {
      const run = createRun(`pool-${i}`, { deck: STRONG_DECK });
      const { run: r2 } = step(run, { type: 'travel', to: nodeAt(run.map, START).next[i % 3]!.id });
      const defs = r2.combat!.enemies.map((e) => e.def).filter((d) => d !== 'greeble');
      expect(['rat', 'spider', 'scorpion', 'possum']).toContain(defs[0]);
    }
  });

  it('winning offers crumbs and three cards, carries HP and crumbs back to the run', () => {
    const run = createRun('run-3', { deck: STRONG_DECK });
    const first = nodeAt(run.map, START).next[0]!.id;
    const r2 = step(run, { type: 'travel', to: first }).run;
    const { run: r3, events } = winFight(r2);
    expect(r3.phase).toBe('reward');
    expect(r3.combat).toBeNull();
    const won = events.find((e) => e.type === 'fightWon');
    expect(won).toBeDefined();
    const offer = r3.reward!;
    const flavor = FLAVORS[r3.map.trails[nodeAt(r3.map, first).trails[0]!]!.flavor];
    expect(offer.crumbs).toBeGreaterThanOrEqual(
      Math.round(FIGHT_CRUMBS[0] * flavor.crumbMultiplier),
    );
    expect(offer.crumbs).toBeLessThanOrEqual(Math.round(FIGHT_CRUMBS[1] * flavor.crumbMultiplier));
    expect(offer.cards).toHaveLength(3);
    for (const id of offer.cards) expect(CARDS[id]!.type).not.toBe('status');
    expect(r3.crumbs).toBeGreaterThanOrEqual(25 + offer.crumbs - 20); // a Greeble may have stolen some
    expect(r3.hp).toBeLessThanOrEqual(60);
    expect(r3.stats.fights).toBe(1);
  });

  it('taking a reward adds the card; skipping adds nothing; both return to the map', () => {
    const run = createRun('run-4', { deck: STRONG_DECK });
    const first = nodeAt(run.map, START).next[0]!.id;
    const r3 = winFight(step(run, { type: 'travel', to: first }).run).run;
    const pick = r3.reward!.cards[0]!;
    const taken = step(r3, { type: 'takeReward', card: pick });
    expect(taken.run.deck).toHaveLength(11);
    expect(taken.run.deck.at(-1)!.def).toBe(pick);
    expect(taken.run.phase).toBe('map');
    expect(() => step(r3, { type: 'takeReward', card: 'cobweb' })).toThrow(/offered/);
    const skipped = step(r3, { type: 'takeReward', card: null });
    expect(skipped.run.deck).toHaveLength(10);
    expect(skipped.run.phase).toBe('map');
    expect(skipped.events[0]).toEqual({ type: 'rewardSkipped' });
  });

  it('elite fights pay the elite bounty', () => {
    const run = createRun('run-5', { deck: STRONG_DECK, hp: 999 });
    const elite = firstOfType(run, 'elite');
    const events: RunEvent[] = [];
    let r = advanceTo(run, elite, events);
    expect(r.phase).toBe('fight');
    expect(r.combat!.enemies.some((e) => ['rat-king', 'wolf-spider'].includes(e.def))).toBe(true);
    r = winFight(r).run;
    const flavor = FLAVORS[r.map.trails[nodeAt(r.map, elite).trails[0]!]!.flavor];
    expect(r.reward!.crumbs).toBe(Math.round(ELITE_CRUMBS * flavor.crumbMultiplier));
    expect(r.stats.elites).toBe(1);
  });
});

describe('shops', () => {
  const atShop = (seed: string) => {
    const run = createRun(seed, { deck: STRONG_DECK, hp: 999, crumbs: 500 });
    return advanceTo(run, firstOfType(run, 'shop'));
  };

  it('opens with three priced cards and a removal service', () => {
    const r = atShop('shop-1');
    expect(r.phase).toBe('shop');
    expect(r.shop!.cards).toHaveLength(3);
    for (const c of r.shop!.cards) {
      expect(c.price).toBeGreaterThan(0);
      expect(c.sold).toBe(false);
    }
    expect(r.shop!.removalPrice).toBe(SHOP_REMOVAL_PRICE);
  });

  it('buying takes crumbs and adds the card once; removal costs more each time', () => {
    const r = atShop('shop-2');
    const crumbs = r.crumbs;
    const price = r.shop!.cards[0]!.price;
    const bought = step(r, { type: 'buyCard', index: 0 });
    expect(bought.run.crumbs).toBe(crumbs - price);
    expect(bought.run.deck).toHaveLength(r.deck.length + 1);
    expect(() => step(bought.run, { type: 'buyCard', index: 0 })).toThrow(/nothing/);
    const uid = bought.run.deck[0]!.uid;
    const removed = step(bought.run, { type: 'removeCard', uid });
    expect(removed.run.deck.some((c) => c.uid === uid)).toBe(false);
    expect(removed.run.crumbs).toBe(crumbs - price - SHOP_REMOVAL_PRICE);
    expect(removed.run.shop!.removalPrice).toBe(SHOP_REMOVAL_PRICE + SHOP_REMOVAL_STEP);
    const left = step(removed.run, { type: 'leave' });
    expect(left.run.phase).toBe('map');
    expect(left.run.shop).toBeNull();
  });

  it('refuses purchases the player cannot afford', () => {
    const run = createRun('shop-3', { deck: STRONG_DECK, hp: 999, crumbs: 0 });
    const r = advanceTo(run, firstOfType(run, 'shop'));
    // Fights on the way paid some crumbs; spend them down by checking against price.
    const poor = { ...r, crumbs: 1 };
    expect(() => step(poor, { type: 'buyCard', index: 0 })).toThrow(/crumbs/);
    expect(() => step(poor, { type: 'removeCard', uid: poor.deck[0]!.uid })).toThrow(/crumbs/);
  });
});

describe('cocoons', () => {
  it('rest heals 30% of max HP, capped at max', () => {
    const run = createRun('cocoon-1', { deck: STRONG_DECK, hp: 999 });
    const cocoon = firstOfType(run, 'cocoon');
    let r = advanceTo(run, cocoon);
    expect(r.phase).toBe('cocoon');
    r = { ...r, hp: 10, maxHp: 60 };
    const rested = step(r, { type: 'rest' });
    expect(rested.run.hp).toBe(10 + Math.ceil(60 * COCOON_HEAL_FRACTION));
    expect(rested.run.phase).toBe('map');
    const full = step({ ...r, hp: 55, maxHp: 60 }, { type: 'rest' });
    expect(full.run.hp).toBe(60);
    expect(full.events[0]).toEqual({ type: 'rested', healed: 5 });
  });
});

describe('the end of a run', () => {
  it('killing the Bear wins the run', () => {
    const run = createRun('boss-1', { deck: STRONG_DECK, hp: 9999 });
    const events: RunEvent[] = [];
    let r = advanceTo(run, BOSS, events);
    expect(r.phase).toBe('fight');
    expect(r.combat!.enemies.map((e) => e.def)).toEqual(['bear']);
    const w = winFight(r);
    r = w.run;
    expect(r.phase).toBe('victory');
    expect(w.events.some((e) => e.type === 'runWon')).toBe(true);
  });

  it('dying in a fight ends the run', () => {
    const run = createRun('death-1', { hp: 1 });
    const first = nodeAt(run.map, START).next[0]!.id;
    let r = step(run, { type: 'travel', to: first }).run;
    let lost = false;
    for (let i = 0; i < 20 && r.phase === 'fight'; i++) {
      const s = step(r, { type: 'combat', action: { type: 'endTurn' } });
      r = s.run;
      lost ||= s.events.some((e) => e.type === 'runLost');
    }
    expect(r.phase).toBe('death');
    expect(lost).toBe(true);
    expect(() => step(r, { type: 'travel', to: BOSS })).toThrow(/phase/);
  });
});

/**
 * The run loop — spec.md §3, §6, §8, §9. Scenarios walk real generated maps with a strong test
 * deck so fights resolve deterministically.
 */
import { CARDS } from '@content/cards';
import { FLAVORS } from '@content/trails';
import { describe, expect, it } from 'vitest';
import { seenEnemies } from './combat';
import { BOSS, START, nodeAt, type GameMap } from './map';
import { Rng } from './rng';
import {
  COCOON_HEAL_FRACTION,
  CRUMB_MAGNET_MULTIPLIER,
  ELITE_CRUMBS,
  FIGHT_CRUMBS,
  FORAGE_CRUMBS,
  IllegalRunAction,
  GREEBLE_RELOCATE_DISTANCE,
  SHOP_CARD_PRICES,
  SHOP_REMOVAL_PRICE,
  SHOP_REMOVAL_STEP,
  SNAIL_ABSENCE,
  SPARE_PARTS_HEAL,
  THICK_THORAX_HP,
  TRAVELING_DISCOUNT,
  applyRunAction,
  canSeeGreebleMarker,
  createRun,
  rollCards,
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

/** Resolve whatever the current node put on screen until the run is back on the map (or over). */
function settle(run: RunState, events: RunEvent[] = []): RunState {
  let r = run;
  for (let guard = 0; guard < 10 && !['map', 'victory', 'death'].includes(r.phase); guard++) {
    if (r.phase === 'fight') {
      const w = winFight(r);
      r = w.run;
      events.push(...w.events);
    } else if (r.phase === 'reward') r = step(r, { type: 'takeReward', card: null }).run;
    else if (r.phase === 'shop' || r.phase === 'cocoon') r = step(r, { type: 'leave' }).run;
  }
  return r;
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

/** advanceTo, then clear a Greeble ambush that landed on the target so its own content shows. */
function arriveAt(run: RunState, target: string): RunState {
  let r = advanceTo(run, target);
  if (r.phase === 'fight' && r.deferredNodeType) {
    r = winFight(r).run;
    if (r.phase === 'reward') r = step(r, { type: 'takeReward', card: null }).run;
  }
  return r;
}

const firstOfType = (run: RunState, type: string): string => {
  for (const t of run.map.trails) {
    const id = t.nodes.find((n) => nodeAt(run.map, n).type === type);
    if (id) return id;
  }
  throw new Error(`no ${type} node`);
};

/** Undirected shortest-path distance, the metric the Greeble's relocation rule uses. */
function dist(map: GameMap, a: string, b: string): number {
  const seen = new Map<string, number>([[a, 0]]);
  const q = [a];
  while (q.length) {
    const id = q.shift()!;
    if (id === b) return seen.get(id)!;
    const n = nodeAt(map, id);
    for (const x of [...n.next.map((e) => e.id), ...n.prev]) {
      if (!seen.has(x)) {
        seen.set(x, seen.get(id)! + 1);
        q.push(x);
      }
    }
  }
  return Infinity;
}

describe('createRun', () => {
  it('starts on the map at Start with the starting deck, HP and crumbs', () => {
    const run = createRun('run-1');
    expect(run.phase).toBe('map');
    expect(run.position).toBe(START);
    expect(run.deck).toHaveLength(10);
    expect(run.hp).toBe(60);
    expect(run.crumbs).toBe(25);
    expect(run.map.trails).toHaveLength(3);
    expect(run.unlocks).toEqual([]);
    expect(run.upgrades).toEqual([]);
  });

  it('is deterministic, markers included', () => {
    expect(createRun('same')).toEqual(createRun('same'));
    const a = createRun('same', { deck: STRONG_DECK, hp: 999 });
    const b = createRun('same', { deck: STRONG_DECK, hp: 999 });
    let ra = a;
    let rb = b;
    for (let i = 0; i < 3 && ra.phase === 'map'; i++) {
      const next = nodeAt(ra.map, ra.position).next[0]!.id;
      ra = settle(step(ra, { type: 'travel', to: next }).run);
      rb = settle(step(rb, { type: 'travel', to: next }).run);
    }
    expect(ra).toEqual(rb);
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

  it('rewards can offer family cards now that they exist', () => {
    const offered = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const run = createRun(`family-${i}`, { deck: STRONG_DECK, hp: 999 });
      const first = nodeAt(run.map, START).next[0]!.id;
      const r = winFight(step(run, { type: 'travel', to: first }).run).run;
      for (const id of r.reward!.cards) offered.add(id);
    }
    const families = [
      'drill-worm',
      'roly-pounce',
      'munch',
      'spot-barrage',
      'flutter',
      'tongue-lash',
    ];
    expect(families.some((id) => offered.has(id))).toBe(true);
  });

  it('taking a reward adds the card; skipping adds nothing; both return to the map', () => {
    const run = createRun('run-4', { deck: STRONG_DECK });
    const first = nodeAt(run.map, START).next[0]!.id;
    const r3 = winFight(step(run, { type: 'travel', to: first }).run).run;
    const pick = r3.reward!.cards[0]!;
    const taken = step(r3, { type: 'takeReward', card: pick });
    expect(taken.run.deck).toHaveLength(11);
    expect(taken.run.deck.at(-1)!.def).toBe(pick);
    expect(['map', 'shop']).toContain(taken.run.phase); // 'shop' if the Snail was standing here
    expect(() => step(r3, { type: 'takeReward', card: 'cobweb' })).toThrow(/offered/);
    const skipped = step(r3, { type: 'takeReward', card: null });
    expect(skipped.run.deck).toHaveLength(10);
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
  const atShop = (seed: string, deck: string[] = STRONG_DECK) => {
    const run = createRun(seed, { deck, hp: 999, crumbs: 500 });
    return arriveAt(run, firstOfType(run, 'shop'));
  };

  it('opens with three priced cards and a removal service', () => {
    const r = atShop('shop-1');
    expect(r.phase).toBe('shop');
    expect(r.shop!.traveling).toBe(false);
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
    const r = arriveAt(run, firstOfType(run, 'shop'));
    const poor = { ...r, crumbs: 1 };
    expect(() => step(poor, { type: 'buyCard', index: 0 })).toThrow(/crumbs/);
    expect(() => step(poor, { type: 'removeCard', uid: poor.deck[0]!.uid })).toThrow(/crumbs/);
    expect(() => step(poor, { type: 'buyWormillionaire' })).toThrow(/crumbs/);
  });

  it('a fixed stall stocks titled unlocks for deck bugs only, two upgrades and Wormillionaire', () => {
    const r = atShop('stock-1', [...Array<string>(8).fill('wormillion'), 'cat', 'roly-poly']);
    expect(r.shop!.unlocks.length).toBeGreaterThanOrEqual(1);
    expect(r.shop!.unlocks.length).toBeLessThanOrEqual(2);
    for (const u of r.shop!.unlocks) {
      expect(['wormillion', 'cat', 'roly-poly']).toContain(u.bug);
      expect(u.price).toBe(65);
    }
    expect(r.shop!.upgrades).toHaveLength(2);
    expect(new Set(r.shop!.upgrades.map((u) => u.id)).size).toBe(2);
    for (const u of r.shop!.upgrades) expect(u.price).toBe(70);
    expect(r.shop!.wormillionaire).toEqual({ price: 85, sold: false });
  });

  it('never offers a titled unlock the run already owns', () => {
    for (let i = 0; i < 10; i++) {
      const run = createRun(`owned-${i}`, {
        deck: [...Array<string>(9).fill('wormillion'), 'roly-poly'],
        hp: 999,
        crumbs: 500,
      });
      const owned = { ...run, unlocks: ['wormillion' as const] };
      const r = arriveAt(owned, firstOfType(owned, 'shop'));
      for (const u of r.shop!.unlocks) expect(u.bug).toBe('roly-poly');
    }
  });

  it('buying a titled unlock records it, charges 65, and cannot be bought twice', () => {
    const r = atShop('stock-2', [...Array<string>(9).fill('wormillion'), 'drill-worm']);
    const i = r.shop!.unlocks.findIndex((u) => u.bug === 'wormillion');
    expect(i).toBeGreaterThanOrEqual(0);
    const { run: bought, events } = step(r, { type: 'buyUnlock', index: i });
    expect(bought.unlocks).toEqual(['wormillion']);
    expect(bought.crumbs).toBe(r.crumbs - 65);
    expect(events[0]).toEqual({ type: 'unlockBought', bug: 'wormillion', price: 65 });
    expect(() => step(bought, { type: 'buyUnlock', index: i })).toThrow(/nothing/);
  });

  it('Thick Thorax raises max HP and heals on purchase', () => {
    const r = atShop('stock-5');
    const staged = {
      ...r,
      hp: 500,
      maxHp: 999,
      shop: { ...r.shop!, upgrades: [{ id: 'thick-thorax' as const, price: 70, sold: false }] },
    };
    const bought = step(staged, { type: 'buyUpgrade', index: 0 }).run;
    expect(bought.maxHp).toBe(999 + THICK_THORAX_HP);
    expect(bought.hp).toBe(500 + THICK_THORAX_HP);
    expect(bought.upgrades).toEqual(['thick-thorax']);
    expect(bought.crumbs).toBe(staged.crumbs - 70);
    expect(() => step(bought, { type: 'buyUpgrade', index: 0 })).toThrow(/nothing/);
  });

  it('Wormillionaire adds five Wormillion+ and is once per visit', () => {
    const r = atShop('stock-6');
    const { run: bought, events } = step(r, { type: 'buyWormillionaire' });
    const worms = bought.deck.filter((c) => c.def === 'wormillion' && c.upgraded);
    expect(worms).toHaveLength(5);
    expect(bought.crumbs).toBe(r.crumbs - 85);
    expect(bought.stats.cardsGained).toBe(r.stats.cardsGained + 5);
    expect(events[0]).toEqual({ type: 'wormillionaireBought', price: 85, added: 5 });
    expect(() => step(bought, { type: 'buyWormillionaire' })).toThrow(/nothing/);
  });
});

describe('general upgrades outside combat (spec §6.2)', () => {
  it('Spare Parts heals 4 after a fight; Crumb Magnet adds 25% to the bounty', () => {
    const run = createRun('stock-7', { deck: STRONG_DECK, hp: 999 });
    const upgraded = {
      ...run,
      hp: 100,
      upgrades: ['spare-parts' as const, 'crumb-magnet' as const],
    };
    const first = nodeAt(run.map, START).next[0]!.id;
    const r = winFight(step(upgraded, { type: 'travel', to: first }).run).run;
    expect(r.hp).toBe(Math.min(999, r.lastCombat!.player.hp + SPARE_PARTS_HEAL));
    const flavor = FLAVORS[r.map.trails[nodeAt(r.map, first).trails[0]!]!.flavor];
    const mult = flavor.crumbMultiplier * CRUMB_MAGNET_MULTIPLIER;
    expect(r.reward!.crumbs).toBeGreaterThanOrEqual(Math.round(FIGHT_CRUMBS[0] * mult));
    expect(r.reward!.crumbs).toBeLessThanOrEqual(Math.round(FIGHT_CRUMBS[1] * mult));
  });

  it('combat-side upgrades reach the fight as mods', () => {
    const run = createRun('stock-8', { deck: STRONG_DECK, hp: 999 });
    const upgraded = {
      ...run,
      upgrades: ['solar-panel' as const, 'sharpened-mandibles' as const, 'cats-whisker' as const],
    };
    const first = nodeAt(run.map, START).next[0]!.id;
    const r = step(upgraded, { type: 'travel', to: first }).run;
    expect(r.combat!.mods).toEqual({ attackBonus: 1, firstTurnCharge: 1, pilferReduction: 1 });
    expect(r.combat!.player.charge).toBe(4);
  });
});

describe('the roaming Greeble (spec §8.5)', () => {
  it('starts off Start and Boss and moves one node per travel', () => {
    for (let i = 0; i < 40; i++) {
      const run = createRun(`greeble-${i}`, { deck: STRONG_DECK, hp: 999 });
      expect([START, BOSS]).not.toContain(run.greebleNode);
      const first = nodeAt(run.map, START).next[0]!.id;
      const before = run.greebleNode;
      const r = step(run, { type: 'travel', to: first }).run;
      expect([START, BOSS]).not.toContain(r.greebleNode);
      if (first !== before) expect(dist(run.map, before, r.greebleNode)).toBeLessThanOrEqual(1);
    }
  });

  it('landing on it adds a Greeble to the fight and relocates it at least 4 nodes away', () => {
    for (let i = 0; i < 30; i++) {
      const run = createRun(`ambush-${i}`, { deck: STRONG_DECK, hp: 999 });
      const first = nodeAt(run.map, START).next[0]!.id;
      const { run: r, events } = step(
        { ...run, greebleNode: first },
        { type: 'travel', to: first },
      );
      expect(r.phase).toBe('fight');
      expect(r.combat!.enemies.filter((e) => e.def === 'greeble')).toHaveLength(1);
      expect(events.find((e) => e.type === 'fightStarted')).toMatchObject({ ambush: true });
      expect([START, BOSS, first]).not.toContain(r.greebleNode);
      expect(dist(r.map, first, r.greebleNode)).toBeGreaterThanOrEqual(GREEBLE_RELOCATE_DISTANCE);
    }
  });

  it('ambushing a Shop or Cocoon fights first, then opens that content', () => {
    const run = createRun('ambush-stop', { deck: STRONG_DECK, hp: 999, crumbs: 500 });
    for (const type of ['shop', 'cocoon'] as const) {
      const target = firstOfType(run, type);
      const path = pathTo(run.map, START, target);
      const beforeLast = path.length > 1 ? path[path.length - 2]! : START;
      const r = settle(advanceTo(run, beforeLast));
      const staged = { ...r, greebleNode: target, snailNode: null, snailReturnIn: 99 };
      let s = step(staged, { type: 'travel', to: target }).run;
      expect(s.phase).toBe('fight');
      expect(s.combat!.enemies.some((e) => e.def === 'greeble')).toBe(true);
      expect(seenEnemies(s.combat!).length).toBeGreaterThan(0);
      expect(s.deferredNodeType).toBe(type);
      s = winFight(s).run;
      expect(s.phase).toBe('reward');
      s = step(s, { type: 'takeReward', card: null }).run;
      expect(s.phase).toBe(type);
      expect(s.deferredNodeType).toBeNull();
      if (type === 'shop') expect(s.shop!.traveling).toBe(false);
    }
  });

  it('is visible only with a Cat-family card in the deck or Cat’s Whisker', () => {
    const run = createRun('see-1', { deck: STRONG_DECK });
    expect(canSeeGreebleMarker(run)).toBe(false);
    expect(canSeeGreebleMarker({ ...run, upgrades: ['cats-whisker'] })).toBe(true);
    expect(canSeeGreebleMarker(createRun('see-1', { deck: [...STRONG_DECK, 'pounce'] }))).toBe(
      true,
    );
  });
});

describe('the wandering Snail (spec §8.6)', () => {
  it('starts in the middle third of the map and wanders one node per move', () => {
    for (let i = 0; i < 30; i++) {
      const run = createRun(`snail-${i}`, { deck: STRONG_DECK, hp: 999 });
      expect(run.snailNode).not.toBeNull();
      const node = nodeAt(run.map, run.snailNode!);
      expect(node.index).toBeGreaterThanOrEqual(2);
      expect(node.index).toBeLessThanOrEqual(run.map.depth - 2);
      const first = nodeAt(run.map, START).next[0]!.id;
      const before = run.snailNode!;
      const r = step(run, { type: 'travel', to: first }).run;
      if (r.snailNode !== null) expect(dist(run.map, before, r.snailNode)).toBeLessThanOrEqual(1);
    }
  });

  it('on a non-Shop node it opens a travelling stall after the node resolves, then leaves for 4 moves', () => {
    const run = createRun('stall-1', { deck: STRONG_DECK, hp: 999, crumbs: 500 });
    const first = nodeAt(run.map, START).next[0]!.id;
    let r = step({ ...run, snailNode: first }, { type: 'travel', to: first }).run;
    expect(r.phase).toBe('fight');
    expect(r.pendingTravelingStall).toBe(true);
    expect(r.snailNode).toBeNull();
    r = winFight(r).run;
    expect(r.phase).toBe('reward');
    r = step(r, { type: 'takeReward', card: null }).run;
    expect(r.phase).toBe('shop');
    const stall = r.shop!;
    expect(stall.traveling).toBe(true);
    expect(stall.cards).toHaveLength(2);
    expect(stall.upgrades).toHaveLength(1);
    expect(stall.unlocks).toHaveLength(0);
    expect(stall.wormillionaire).toBeNull();
    expect(stall.removalPrice).toBeNull();
    expect(stall.upgrades[0]!.price).toBe(Math.round(70 * TRAVELING_DISCOUNT));
    for (const c of stall.cards) {
      expect(c.price).toBe(Math.round(SHOP_CARD_PRICES[CARDS[c.def]!.rarity] * TRAVELING_DISCOUNT));
    }
    expect(() => step(r, { type: 'removeCard', uid: r.deck[0]!.uid })).toThrow(/removal/);
    expect(() => step(r, { type: 'buyWormillionaire' })).toThrow(/nothing/);
    const bought = step(r, { type: 'buyUpgrade', index: 0 }).run;
    expect(bought.upgrades).toEqual([stall.upgrades[0]!.id]);

    r = step(bought, { type: 'leave' }).run;
    expect(r.phase).toBe('map');
    expect(r.snailNode).toBeNull();
    expect(r.snailReturnIn).toBe(SNAIL_ABSENCE);
    for (let m = 1; m <= SNAIL_ABSENCE && r.phase === 'map'; m++) {
      const next = nodeAt(r.map, r.position).next[0]!.id;
      r = settle(step(r, { type: 'travel', to: next }).run);
      if (m < SNAIL_ABSENCE) expect(r.snailNode).toBeNull();
      else {
        expect(r.snailNode).not.toBeNull();
        expect(r.snailNode).not.toBe(r.position);
      }
    }
  });

  it('standing on a fixed Shop is just its stall: no travelling stall, and it keeps wandering', () => {
    const run = createRun('stall-2', { deck: STRONG_DECK, hp: 999, crumbs: 500 });
    const shop = firstOfType(run, 'shop');
    const path = pathTo(run.map, START, shop);
    const beforeLast = path.length > 1 ? path[path.length - 2]! : START;
    let r = settle(advanceTo(run, beforeLast));
    const elsewhere = nodeAt(run.map, START).next[0]!.id;
    r = { ...r, snailNode: shop, greebleNode: r.greebleNode === shop ? elsewhere : r.greebleNode };
    r = step(r, { type: 'travel', to: shop }).run;
    expect(r.phase).toBe('shop');
    expect(r.shop!.traveling).toBe(false);
    expect(r.pendingTravelingStall).toBe(false);
    expect(r.snailNode).not.toBeNull();
  });
});

describe('cocoons', () => {
  it('rest heals 30% of max HP, capped at max', () => {
    const run = createRun('cocoon-1', { deck: STRONG_DECK, hp: 999 });
    const cocoon = firstOfType(run, 'cocoon');
    let r = arriveAt(run, cocoon);
    expect(r.phase).toBe('cocoon');
    r = { ...r, hp: 10, maxHp: 60, snailNode: null, snailReturnIn: 99 };
    const rested = step(r, { type: 'rest' });
    expect(rested.run.hp).toBe(10 + Math.ceil(60 * COCOON_HEAL_FRACTION));
    expect(rested.run.phase).toBe('map');
    const full = step({ ...r, hp: 55, maxHp: 60 }, { type: 'rest' });
    expect(full.run.hp).toBe(60);
    expect(full.events[0]).toEqual({ type: 'rested', healed: 5 });
  });

  it('forage pays 18-28 crumbs from the rewards stream, once, then returns to the map', () => {
    const run = createRun('cocoon-2', { deck: STRONG_DECK, hp: 999 });
    const r = arriveAt(run, firstOfType(run, 'cocoon'));
    const before = r.crumbs;
    const a = step(r, { type: 'forage' });
    const gained = a.run.crumbs - before;
    expect(gained).toBeGreaterThanOrEqual(FORAGE_CRUMBS[0]);
    expect(gained).toBeLessThanOrEqual(FORAGE_CRUMBS[1]);
    expect(a.events).toEqual([{ type: 'foraged', crumbs: gained }]);
    expect(a.run.phase).toBe('map');
    expect(a.run.rng.rewards).not.toBe(r.rng.rewards);
    expect(step(r, { type: 'forage' }).run.crumbs).toBe(a.run.crumbs); // deterministic
    expect(() => step(a.run, { type: 'forage' })).toThrow(IllegalRunAction);
  });

  it('pupate turns a Caterpillar-family card into a Chrysalis that emerges after the next won fight', () => {
    const run = createRun('cocoon-3', { deck: [...STRONG_DECK, 'caterpillar', 'munch'], hp: 999 });
    const r = arriveAt(run, firstOfType(run, 'cocoon'));
    const cat = r.deck.find((c) => c.def === 'caterpillar')!;
    const munch = r.deck.find((c) => c.def === 'munch')!;
    const worm = r.deck.find((c) => c.def === 'chameleon')!;
    expect(() => step(r, { type: 'pupate', uid: worm.uid })).toThrow(IllegalRunAction);
    expect(() => step(r, { type: 'pupate', uid: 'nope' })).toThrow(IllegalRunAction);

    const p = step(r, { type: 'pupate', uid: cat.uid });
    expect(p.events).toEqual([{ type: 'pupated', uid: cat.uid, from: 'caterpillar' }]);
    expect(p.run.phase).toBe('map');
    const chrysalis = p.run.deck.find((c) => c.uid === cat.uid)!;
    expect(chrysalis.def).toBe('chrysalis');
    expect(chrysalis.emerges).toBe('butterfly');
    expect(p.run.deck.find((c) => c.uid === munch.uid)!.def).toBe('munch');
    // A second pupation needs another Cocoon.
    expect(() => step(p.run, { type: 'pupate', uid: munch.uid })).toThrow(IllegalRunAction);

    // Win the next fight: the Chrysalis emerges before the reward is offered.
    const events: RunEvent[] = [];
    let q = p.run;
    const fight = q.map.nodes[q.position]!.next.find((e) =>
      ['fight', 'elite'].includes(nodeAt(q.map, e.id).type),
    );
    if (fight) {
      q = step(q, { type: 'travel', to: fight.id }).run;
      q = winFight(q).run;
      expect(q.phase).toBe('reward');
    } else {
      // Pre-boss cocoon: the Bear is the next fight; it emerges on victory too.
      q = step(q, { type: 'travel', to: BOSS }).run;
      const w = winFight(q);
      q = w.run;
      events.push(...w.events);
    }
    const emerged = q.deck.find((c) => c.uid === cat.uid)!;
    expect(emerged.def).toBe('butterfly');
    expect(emerged.emerges).toBeUndefined();
  });

  it('Munch pupates into Flutter, and the emergence is announced with the fight', () => {
    const run = createRun('cocoon-4', { deck: [...STRONG_DECK, 'munch'], hp: 999 });
    let r = arriveAt(run, firstOfType(run, 'cocoon'));
    const munch = r.deck.find((c) => c.def === 'munch')!;
    r = step(r, { type: 'pupate', uid: munch.uid }).run;
    expect(r.deck.find((c) => c.uid === munch.uid)!.emerges).toBe('flutter');
    const next = r.map.nodes[r.position]!.next[0]!;
    const events: RunEvent[] = [];
    const t = step(r, { type: 'travel', to: next.id });
    events.push(...t.events);
    const w = winFight(t.run);
    events.push(...w.events);
    const fightWon = events.findIndex((e) => e.type === 'fightWon');
    const emerged = events.findIndex((e) => e.type === 'emerged');
    expect(emerged).toBeGreaterThanOrEqual(0);
    expect(emerged).toBeGreaterThan(fightWon);
    expect(events[emerged]).toEqual({ type: 'emerged', uid: munch.uid, to: 'flutter' });
  });

  it('a Chrysalis is never offered by rewards or shops', () => {
    const rng = new Rng('pools');
    for (let i = 0; i < 300; i++) {
      for (const id of rollCards(rng, 'fight', 8, 3)) expect(id).not.toBe('chrysalis');
      for (const id of rollCards(rng, 'shop', 0, 3)) expect(id).not.toBe('chrysalis');
    }
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

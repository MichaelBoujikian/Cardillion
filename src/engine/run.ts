/**
 * The run — spec.md §3 (screen flow), §8 (map & markers), §9 (economy). A pure reducer over
 * RunState that owns the map, the deck, HP and crumbs, and delegates fights to `combat.ts`.
 * Same seed, same actions, same run.
 */
import { CARDS, STARTING_DECK, cardDef } from '@content/cards';
import { ENCOUNTERS, encounterPool } from '@content/encounters';
import { FLAVORS } from '@content/trails';
import { applyAction as applyCombatAction, createCombat } from './combat';
import {
  START,
  canTravel,
  depthOf,
  flavorOf,
  generateMap,
  nodeAt,
  type GameMap,
  type MapNode,
  type NodeType,
} from './map';
import { Rng, type RngState } from './rng';
import type { BugId, CardInstance, CombatAction, CombatEvent, CombatState, Rarity } from './types';

export type RunPhase = 'map' | 'fight' | 'reward' | 'shop' | 'cocoon' | 'victory' | 'death';

export interface RewardOffer {
  crumbs: number;
  /** Card def ids offered; pick one or skip. */
  cards: string[];
}

export interface ShopCard {
  def: string;
  price: number;
  sold: boolean;
}

export interface ShopStock {
  cards: ShopCard[];
  removalPrice: number;
}

export interface RunStats {
  fights: number;
  elites: number;
  cardsGained: number;
  crumbsEarned: number;
}

export interface RunState {
  seed: string;
  rng: { encounters: RngState; rewards: RngState; shop: RngState };
  hp: number;
  maxHp: number;
  chargePerTurn: number;
  deck: CardInstance[];
  unlocks: BugId[];
  crumbs: number;
  map: GameMap;
  position: string;
  /** Trail of the edge last travelled; decides the flavour on shared nodes. */
  arrivedBy: number | null;
  visited: string[];
  phase: RunPhase;
  combat: CombatState | null;
  /** Final state of the last fight, kept so its closing events can still be animated. */
  lastCombat: CombatState | null;
  reward: RewardOffer | null;
  shop: ShopStock | null;
  removalsBought: number;
  nextUid: number;
  stats: RunStats;
}

export type RunAction =
  | { type: 'travel'; to: string }
  | { type: 'combat'; action: CombatAction }
  | { type: 'takeReward'; card: string | null }
  | { type: 'buyCard'; index: number }
  | { type: 'removeCard'; uid: string }
  | { type: 'rest' }
  | { type: 'leave' };

export type RunEvent =
  | { type: 'traveled'; to: string; nodeType: NodeType }
  | { type: 'fightStarted'; enemies: string[]; elite: boolean; boss: boolean }
  | { type: 'combat'; events: CombatEvent[] }
  | { type: 'fightWon'; crumbs: number }
  | { type: 'rewardOffered'; offer: RewardOffer }
  | { type: 'cardGained'; def: string; uid: string }
  | { type: 'rewardSkipped' }
  | { type: 'shopOpened'; stock: ShopStock }
  | { type: 'cardBought'; def: string; price: number }
  | { type: 'cardRemoved'; uid: string; price: number }
  | { type: 'rested'; healed: number }
  | { type: 'left' }
  | { type: 'runWon' }
  | { type: 'runLost' };

export interface RunStep {
  run: RunState;
  events: RunEvent[];
}

export class IllegalRunAction extends Error {}

// Spec §4.2, §8.3, §9 — all (tuning).
export const STARTING_HP = 60;
export const STARTING_CRUMBS = 25;
export const CHARGE_PER_TURN = 3;
export const COCOON_HEAL_FRACTION = 0.3;
export const FIGHT_CRUMBS: [number, number] = [12, 18];
export const ELITE_CRUMBS = 35;
export const SHOP_CARD_PRICES: Record<Rarity, number> = { common: 35, uncommon: 55, rare: 90 };
export const SHOP_REMOVAL_PRICE = 50;
export const SHOP_REMOVAL_STEP = 15;
export const SHOP_CARD_COUNT = 3;
export const REWARD_CARD_COUNT = 3;
/** Common / uncommon / rare weights — spec §5.2. */
export const RARITY_ODDS = {
  fight: [60, 33, 7],
  elite: [40, 45, 15],
  shop: [50, 35, 15],
} as const;

export interface RunOptions {
  deck?: (string | { def: string; upgraded: boolean })[];
  hp?: number;
  crumbs?: number;
}

export function createRun(seed: string, options: RunOptions = {}): RunState {
  const root = new Rng(seed);
  const map = generateMap(root.fork('map'));
  const run: RunState = {
    seed,
    rng: {
      encounters: root.fork('encounters').state,
      rewards: root.fork('rewards').state,
      shop: root.fork('shop').state,
    },
    hp: options.hp ?? STARTING_HP,
    maxHp: options.hp ?? STARTING_HP,
    chargePerTurn: CHARGE_PER_TURN,
    deck: [],
    unlocks: [],
    crumbs: options.crumbs ?? STARTING_CRUMBS,
    map,
    position: START,
    arrivedBy: null,
    visited: [START],
    phase: 'map',
    combat: null,
    lastCombat: null,
    reward: null,
    shop: null,
    removalsBought: 0,
    nextUid: 1,
    stats: { fights: 0, elites: 0, cardsGained: 0, crumbsEarned: 0 },
  };
  for (const entry of options.deck ?? [...STARTING_DECK]) {
    const { def, upgraded } = typeof entry === 'string' ? { def: entry, upgraded: false } : entry;
    addCard(run, def, upgraded);
  }
  return run;
}

function addCard(run: RunState, def: string, upgraded = false): CardInstance {
  cardDef(def);
  const card: CardInstance = { uid: `c${run.nextUid++}`, def, upgraded };
  run.deck.push(card);
  return card;
}

export function currentNode(run: RunState): MapNode {
  return nodeAt(run.map, run.position);
}

// ---------- actions ----------

export function applyRunAction(run: RunState, action: RunAction): RunStep {
  const r = structuredClone(run);
  const events: RunEvent[] = [];
  const need = (phase: RunPhase) => {
    if (r.phase !== phase) throw new IllegalRunAction(`not in the ${phase} phase`);
  };
  switch (action.type) {
    case 'travel': {
      need('map');
      if (!canTravel(r.map, r.position, action.to))
        throw new IllegalRunAction('that node is not reachable');
      const edge = nodeAt(r.map, r.position).next.find((e) => e.id === action.to);
      r.position = action.to;
      r.arrivedBy = edge ? edge.trail : null;
      r.visited.push(action.to);
      const node = currentNode(r);
      events.push({ type: 'traveled', to: node.id, nodeType: node.type });
      enterNode(r, events);
      break;
    }
    case 'combat': {
      need('fight');
      if (!r.combat) throw new IllegalRunAction('no fight in progress');
      const { state, events: ce } = applyCombatAction(r.combat, action.action);
      r.combat = state;
      events.push({ type: 'combat', events: ce });
      if (state.phase === 'won') afterFight(r, events);
      else if (state.phase === 'lost') {
        r.hp = 0;
        r.lastCombat = state;
        r.combat = null;
        r.phase = 'death';
        events.push({ type: 'runLost' });
      }
      break;
    }
    case 'takeReward': {
      need('reward');
      if (!r.reward) throw new IllegalRunAction('no reward pending');
      if (action.card !== null) {
        if (!r.reward.cards.includes(action.card))
          throw new IllegalRunAction('that card was not offered');
        const card = addCard(r, action.card);
        r.stats.cardsGained++;
        events.push({ type: 'cardGained', def: card.def, uid: card.uid });
      } else events.push({ type: 'rewardSkipped' });
      r.reward = null;
      r.phase = 'map';
      break;
    }
    case 'buyCard': {
      need('shop');
      const item = r.shop?.cards[action.index];
      if (!item || item.sold) throw new IllegalRunAction('nothing to buy there');
      if (r.crumbs < item.price) throw new IllegalRunAction('not enough crumbs');
      r.crumbs -= item.price;
      item.sold = true;
      const card = addCard(r, item.def);
      r.stats.cardsGained++;
      events.push({ type: 'cardBought', def: card.def, price: item.price });
      break;
    }
    case 'removeCard': {
      need('shop');
      if (!r.shop) throw new IllegalRunAction('no shop open');
      const idx = r.deck.findIndex((c) => c.uid === action.uid);
      if (idx < 0) throw new IllegalRunAction('that card is not in the deck');
      if (r.deck.length <= 1) throw new IllegalRunAction('the deck cannot be emptied');
      if (r.crumbs < r.shop.removalPrice) throw new IllegalRunAction('not enough crumbs');
      const price = r.shop.removalPrice;
      r.crumbs -= price;
      r.deck.splice(idx, 1);
      r.removalsBought++;
      r.shop.removalPrice = SHOP_REMOVAL_PRICE + SHOP_REMOVAL_STEP * r.removalsBought;
      events.push({ type: 'cardRemoved', uid: action.uid, price });
      break;
    }
    case 'rest': {
      need('cocoon');
      const healed = Math.min(r.maxHp - r.hp, Math.ceil(r.maxHp * COCOON_HEAL_FRACTION));
      r.hp += healed;
      events.push({ type: 'rested', healed });
      r.phase = 'map';
      break;
    }
    case 'leave': {
      if (r.phase !== 'shop' && r.phase !== 'cocoon')
        throw new IllegalRunAction('nothing to leave');
      r.shop = null;
      r.phase = 'map';
      events.push({ type: 'left' });
      break;
    }
  }
  return { run: r, events };
}

// ---------- nodes ----------

function enterNode(r: RunState, events: RunEvent[]): void {
  const node = currentNode(r);
  switch (node.type) {
    case 'fight':
    case 'elite':
    case 'boss':
      startFight(r, events);
      break;
    case 'shop':
      openShop(r, events);
      break;
    case 'cocoon':
      r.phase = 'cocoon';
      break;
    case 'start':
      break;
  }
}

function startFight(r: RunState, events: RunEvent[]): void {
  const node = currentNode(r);
  const boss = node.type === 'boss';
  const elite = node.type === 'elite';
  const enc = Rng.fromState(r.rng.encounters);
  let enemies: string[];
  if (boss) enemies = [...(ENCOUNTERS.boss[0] as readonly string[])];
  else if (elite) enemies = [...enc.pick(ENCOUNTERS.elite)];
  else enemies = [...enc.pick(encounterPool(depthOf(node)))];
  if (!boss && enc.chance(FLAVORS[flavorOf(r.map, node, r.arrivedBy)].greebleChance))
    enemies.push('greeble');
  r.rng.encounters = enc.state;

  const { state, events: ce } = createCombat({
    seed: `${r.seed}:combat:${node.id}`,
    deck: r.deck.map((c) => ({ def: c.def, upgraded: c.upgraded })),
    enemies,
    hp: r.hp,
    maxHp: r.maxHp,
    chargePerTurn: r.chargePerTurn,
    crumbs: r.crumbs,
    unlocks: r.unlocks,
  });
  r.combat = state;
  r.phase = 'fight';
  events.push({ type: 'fightStarted', enemies, elite, boss });
  events.push({ type: 'combat', events: ce });
}

function afterFight(r: RunState, events: RunEvent[]): void {
  const combat = r.combat as CombatState;
  const node = currentNode(r);
  r.hp = combat.player.hp;
  r.crumbs = combat.crumbs; // theft and recoveries already applied
  r.lastCombat = combat;
  r.combat = null;
  r.stats.fights++;
  if (node.type === 'elite') r.stats.elites++;
  if (node.type === 'boss') {
    events.push({ type: 'fightWon', crumbs: 0 });
    r.phase = 'victory';
    events.push({ type: 'runWon' });
    return;
  }
  const flavor = FLAVORS[flavorOf(r.map, node, r.arrivedBy)];
  const rewards = Rng.fromState(r.rng.rewards);
  const elite = node.type === 'elite';
  const base = elite ? ELITE_CRUMBS : rewards.int(FIGHT_CRUMBS[0], FIGHT_CRUMBS[1]);
  const crumbs = Math.round(base * flavor.crumbMultiplier);
  r.crumbs += crumbs;
  r.stats.crumbsEarned += crumbs;
  const cards = rollCards(rewards, elite ? 'elite' : 'fight', flavor.rareBonus, REWARD_CARD_COUNT);
  r.rng.rewards = rewards.state;
  r.reward = { crumbs, cards };
  r.phase = 'reward';
  events.push({ type: 'fightWon', crumbs });
  events.push({ type: 'rewardOffered', offer: r.reward });
}

function openShop(r: RunState, events: RunEvent[]): void {
  const shop = Rng.fromState(r.rng.shop);
  const cards = rollCards(shop, 'shop', 0, SHOP_CARD_COUNT).map((def) => ({
    def,
    price: SHOP_CARD_PRICES[cardDef(def).rarity],
    sold: false,
  }));
  r.rng.shop = shop.state;
  r.shop = { cards, removalPrice: SHOP_REMOVAL_PRICE + SHOP_REMOVAL_STEP * r.removalsBought };
  r.phase = 'shop';
  events.push({ type: 'shopOpened', stock: r.shop });
}

/** Roll `n` card def ids by rarity odds, avoiding duplicates while the pool allows. */
export function rollCards(
  rng: Rng,
  tier: keyof typeof RARITY_ODDS,
  rareBonus: number,
  n: number,
): string[] {
  const pool = Object.values(CARDS).filter((c) => c.type !== 'status');
  const [common, uncommon, rare] = RARITY_ODDS[tier];
  const weights = [Math.max(0, common - rareBonus), uncommon, rare + rareBonus];
  const rarities: Rarity[] = ['common', 'uncommon', 'rare'];
  const picked: string[] = [];
  for (let i = 0; i < n; i++) {
    const rarity = rng.pickWeighted(rarities, weights);
    const fresh = pool.filter((c) => c.rarity === rarity && !picked.includes(c.id));
    const candidates = fresh.length > 0 ? fresh : pool.filter((c) => c.rarity === rarity);
    picked.push(rng.pick(candidates).id);
  }
  return picked;
}

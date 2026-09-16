/**
 * The run — spec.md §3 (screen flow), §6 (upgrades), §8 (map & markers), §9 (economy). A pure
 * reducer over RunState that owns the map, the deck, HP and crumbs, and delegates fights to
 * `combat.ts`. Same seed, same actions, same run.
 */
import { CARDS, PUPATION, STARTING_DECK, cardDef } from '@content/cards';
import { ENCOUNTERS, encounterPool } from '@content/encounters';
import { HABITATS, type HabitatId } from '@content/habitats';
import { FLAVORS } from '@content/trails';
import {
  GENERAL_UPGRADE_PRICE,
  TITLED_UNLOCK_PRICE,
  UPGRADE_IDS,
  WORMILLIONAIRE_COUNT,
  WORMILLIONAIRE_PRICE,
  type UpgradeId,
} from '@content/upgrades';
import { applyAction as applyCombatAction, createCombat } from './combat';
import {
  BOSS,
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

export interface ShopUnlock {
  bug: BugId;
  price: number;
  sold: boolean;
}

export interface ShopUpgrade {
  id: UpgradeId;
  price: number;
  sold: boolean;
}

export interface ShopWormillionaire {
  price: number;
  sold: boolean;
}

export interface ShopStock {
  cards: ShopCard[];
  /** null at a travelling stall — no removal on the road (spec §8.6). */
  removalPrice: number | null;
  /** Empty at a travelling stall — titled unlocks are sold at fixed stalls only. */
  unlocks: ShopUnlock[];
  upgrades: ShopUpgrade[];
  /** null at a travelling stall. */
  wormillionaire: ShopWormillionaire | null;
  /** The Snail's discounted roadside stall (spec §8.6) rather than a fixed Shop node. */
  traveling: boolean;
}

export interface RunStats {
  fights: number;
  elites: number;
  cardsGained: number;
  crumbsEarned: number;
}

export interface RunState {
  seed: string;
  rng: { encounters: RngState; rewards: RngState; shop: RngState; markers: RngState };
  hp: number;
  maxHp: number;
  chargePerTurn: number;
  deck: CardInstance[];
  /** Titled unlocks owned: every card of these bugs plays upgraded (spec §6.1). */
  unlocks: BugId[];
  /** General upgrades owned (spec §6.2). */
  upgrades: UpgradeId[];
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

  // ---- map markers (spec §8.5, §8.6) ----
  /** Node the roaming Greeble marker is on. Never Start or Boss. */
  greebleNode: string;
  /** Node the wandering Snail is on, or null while it is off the map after a travelling stall. */
  snailNode: string | null;
  /** Moves left until the Snail reappears; meaningful only while `snailNode` is null. */
  snailReturnIn: number;
  /** The last nodes the Snail passed, oldest first (spec §8.6). Empty while it is off the map. */
  snailTrail: string[];
  /** Set by a move onto the Greeble's node; consumed by the node's fight. */
  pendingGreeble: boolean;
  /** The Greeble ambushed a Shop/Cocoon: open that content once the ambush fight resolves. */
  deferredNodeType: 'shop' | 'cocoon' | null;
  /** The Snail was on this non-Shop node: open its travelling stall once the node resolves. */
  pendingTravelingStall: boolean;
}

export type RunAction =
  | { type: 'travel'; to: string }
  | { type: 'combat'; action: CombatAction }
  | { type: 'takeReward'; card: string | null }
  | { type: 'buyCard'; index: number }
  | { type: 'removeCard'; uid: string }
  | { type: 'buyUnlock'; index: number }
  | { type: 'buyUpgrade'; index: number }
  | { type: 'buyWormillionaire' }
  | { type: 'rest' }
  | { type: 'forage' }
  | { type: 'pupate'; uid: string }
  | { type: 'leave' };

export type RunEvent =
  | { type: 'traveled'; to: string; nodeType: NodeType }
  | {
      type: 'fightStarted';
      enemies: string[];
      elite: boolean;
      boss: boolean;
      ambush: boolean;
      habitat?: HabitatId;
    }
  | { type: 'combat'; events: CombatEvent[] }
  | { type: 'fightWon'; crumbs: number }
  | { type: 'rewardOffered'; offer: RewardOffer }
  | { type: 'cardGained'; def: string; uid: string }
  | { type: 'rewardSkipped' }
  | { type: 'shopOpened'; stock: ShopStock }
  | { type: 'cardBought'; def: string; price: number }
  | { type: 'cardRemoved'; uid: string; price: number }
  | { type: 'unlockBought'; bug: BugId; price: number }
  | { type: 'upgradeBought'; id: UpgradeId; price: number }
  | { type: 'wormillionaireBought'; price: number; added: number }
  | { type: 'rested'; healed: number }
  | { type: 'foraged'; crumbs: number }
  | { type: 'pupated'; uid: string; from: string }
  /** A Chrysalis became its Butterfly-family card after a won fight (spec §8.8). */
  | { type: 'emerged'; uid: string; to: string }
  | { type: 'left' }
  | { type: 'runWon' }
  | { type: 'runLost' };

export interface RunStep {
  run: RunState;
  events: RunEvent[];
}

export class IllegalRunAction extends Error {}

// Spec §4.2, §6, §8, §9 — all (tuning).
export const STARTING_HP = 60;
export const STARTING_CRUMBS = 25;
export const CHARGE_PER_TURN = 3;
export const COCOON_HEAL_FRACTION = 0.3;
/** Forage at a Cocoon (spec §8.8). */
export const FORAGE_CRUMBS: [number, number] = [18, 28];
export const FIGHT_CRUMBS: [number, number] = [12, 18];
export const ELITE_CRUMBS = 35;
export const SHOP_CARD_PRICES: Record<Rarity, number> = { common: 35, uncommon: 55, rare: 90 };
export const SHOP_REMOVAL_PRICE = 50;
export const SHOP_REMOVAL_STEP = 15;
export const SHOP_CARD_COUNT = 3;
export const SHOP_UNLOCK_COUNT = 2;
export const SHOP_UPGRADE_COUNT = 2;
export const REWARD_CARD_COUNT = 3;
/** The Snail's travelling stall: 2 cards + 1 general upgrade at 20% off (spec §8.6). */
export const TRAVELING_CARD_COUNT = 2;
export const TRAVELING_DISCOUNT = 0.8;
/** Moves the Snail spends off the map after a travelling stall (spec §8.6). */
export const SNAIL_ABSENCE = 4;
/** Nodes of pheromone trail the Snail leaves behind it (spec §8.6). */
export const SNAIL_TRAIL_LENGTH = 3;
/** The Greeble marker relocates at least this far after an ambush (spec §8.5). */
export const GREEBLE_RELOCATE_DISTANCE = 4;
/** General upgrades that act outside combat (spec §6.2). */
export const THICK_THORAX_HP = 10;
export const SPARE_PARTS_HEAL = 4;
export const CRUMB_MAGNET_MULTIPLIER = 1.25;
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
  const markers = root.fork('markers');
  const run: RunState = {
    seed,
    rng: {
      encounters: root.fork('encounters').state,
      rewards: root.fork('rewards').state,
      shop: root.fork('shop').state,
      markers: 0,
    },
    hp: options.hp ?? STARTING_HP,
    maxHp: options.hp ?? STARTING_HP,
    chargePerTurn: CHARGE_PER_TURN,
    deck: [],
    unlocks: [],
    upgrades: [],
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
    greebleNode: pickAnyNode(map, markers),
    snailNode: pickMiddleThirdNode(map, markers),
    snailReturnIn: 0,
    snailTrail: [],
    pendingGreeble: false,
    deferredNodeType: null,
    pendingTravelingStall: false,
  };
  run.rng.markers = markers.state;
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

/** The distinct bugs the deck holds at least one card of. */
export function bugsInDeck(run: RunState): BugId[] {
  const seen = new Set<BugId>();
  for (const c of run.deck) {
    const bug = cardDef(c.def).bug;
    if (bug) seen.add(bug);
  }
  return [...seen];
}

/** Whether the roaming Greeble marker shows on the map: a Cat in the deck, or Cat's Whisker. */
export function canSeeGreebleMarker(run: RunState): boolean {
  return run.upgrades.includes('cats-whisker') || bugsInDeck(run).includes('cat');
}

// ---------- actions ----------

export function applyRunAction(run: RunState, action: RunAction): RunStep {
  const r = structuredClone(run);
  const events: RunEvent[] = [];
  const need = (phase: RunPhase) => {
    if (r.phase !== phase) throw new IllegalRunAction(`not in the ${phase} phase`);
  };
  const shopItem = <T extends { sold: boolean; price: number }>(item: T | null | undefined): T => {
    need('shop');
    if (!item || item.sold) throw new IllegalRunAction('nothing to buy there');
    if (r.crumbs < item.price) throw new IllegalRunAction('not enough crumbs');
    return item;
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
      updateMarkers(r);
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
      returnToMap(r, events);
      break;
    }
    case 'buyCard': {
      const item = shopItem(r.shop?.cards[action.index]);
      r.crumbs -= item.price;
      item.sold = true;
      const card = addCard(r, item.def);
      r.stats.cardsGained++;
      events.push({ type: 'cardBought', def: card.def, price: item.price });
      break;
    }
    case 'removeCard': {
      need('shop');
      if (!r.shop || r.shop.removalPrice === null)
        throw new IllegalRunAction('no removal service here');
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
    case 'buyUnlock': {
      const item = shopItem(r.shop?.unlocks[action.index]);
      r.crumbs -= item.price;
      item.sold = true;
      r.unlocks.push(item.bug);
      events.push({ type: 'unlockBought', bug: item.bug, price: item.price });
      break;
    }
    case 'buyUpgrade': {
      const item = shopItem(r.shop?.upgrades[action.index]);
      r.crumbs -= item.price;
      item.sold = true;
      r.upgrades.push(item.id);
      if (item.id === 'thick-thorax') {
        r.maxHp += THICK_THORAX_HP;
        r.hp = Math.min(r.maxHp, r.hp + THICK_THORAX_HP);
      }
      events.push({ type: 'upgradeBought', id: item.id, price: item.price });
      break;
    }
    case 'buyWormillionaire': {
      const item = shopItem(r.shop?.wormillionaire);
      r.crumbs -= item.price;
      item.sold = true;
      for (let i = 0; i < WORMILLIONAIRE_COUNT; i++) addCard(r, 'wormillion', true);
      r.stats.cardsGained += WORMILLIONAIRE_COUNT;
      events.push({ type: 'wormillionaireBought', price: item.price, added: WORMILLIONAIRE_COUNT });
      break;
    }
    case 'rest': {
      need('cocoon');
      const healed = Math.min(r.maxHp - r.hp, Math.ceil(r.maxHp * COCOON_HEAL_FRACTION));
      r.hp += healed;
      events.push({ type: 'rested', healed });
      returnToMap(r, events);
      break;
    }
    case 'forage': {
      need('cocoon');
      const rewards = Rng.fromState(r.rng.rewards);
      const crumbs = rewards.int(FORAGE_CRUMBS[0], FORAGE_CRUMBS[1]);
      r.rng.rewards = rewards.state;
      r.crumbs += crumbs;
      r.stats.crumbsEarned += crumbs;
      events.push({ type: 'foraged', crumbs });
      returnToMap(r, events);
      break;
    }
    case 'pupate': {
      need('cocoon');
      const card = r.deck.find((c) => c.uid === action.uid);
      if (!card) throw new IllegalRunAction('that card is not in the deck');
      const emerges = PUPATION[card.def];
      if (!emerges)
        throw new IllegalRunAction('only a card with a Butterfly counterpart can pupate');
      events.push({ type: 'pupated', uid: card.uid, from: card.def });
      card.def = 'chrysalis';
      card.emerges = emerges;
      returnToMap(r, events);
      break;
    }
    case 'leave': {
      if (r.phase !== 'shop' && r.phase !== 'cocoon')
        throw new IllegalRunAction('nothing to leave');
      r.shop = null;
      events.push({ type: 'left' });
      returnToMap(r, events);
      break;
    }
  }
  return { run: r, events };
}

/**
 * Where a node hands control back. Usually the map — unless a Greeble ambushed a Shop/Cocoon
 * (that content still has to open) or the Snail was standing here (its stall opens last).
 */
function returnToMap(r: RunState, events: RunEvent[]): void {
  if (r.deferredNodeType) {
    const deferred = r.deferredNodeType;
    r.deferredNodeType = null;
    if (deferred === 'shop') openShop(r, events, false);
    else r.phase = 'cocoon';
    return;
  }
  if (r.pendingTravelingStall) {
    r.pendingTravelingStall = false;
    openShop(r, events, true);
    return;
  }
  r.phase = 'map';
}

// ---------- nodes ----------

function enterNode(r: RunState, events: RunEvent[]): void {
  const node = currentNode(r);
  const ambush = r.pendingGreeble;
  r.pendingGreeble = false;
  switch (node.type) {
    case 'fight':
    case 'elite':
    case 'boss':
      startFight(r, events, ambush);
      break;
    case 'shop':
    case 'cocoon':
      // The Greeble ambushes a stop: a fight for this depth (plus the Greeble) comes first,
      // and the node's own content opens once it is over (see returnToMap).
      if (ambush) {
        r.deferredNodeType = node.type;
        startFight(r, events, true);
      } else if (node.type === 'shop') openShop(r, events, false);
      else r.phase = 'cocoon';
      break;
    case 'start':
      break;
  }
}

function startFight(r: RunState, events: RunEvent[], ambush: boolean): void {
  const node = currentNode(r);
  const boss = node.type === 'boss';
  const elite = node.type === 'elite';
  const enc = Rng.fromState(r.rng.encounters);
  const habitat = node.habitat ? HABITATS[node.habitat] : null;
  let enemies: string[];
  if (boss) enemies = [...(ENCOUNTERS.boss[0] as readonly string[])];
  else if (elite) enemies = [...enc.pick(ENCOUNTERS.elite)];
  else enemies = [...enc.pick(encounterPool(depthOf(node)))];
  const greebleChance =
    FLAVORS[flavorOf(r.map, node, r.arrivedBy)].greebleChance * (habitat?.greebleMultiplier ?? 1);
  if (!boss && enc.chance(greebleChance)) enemies.push('greeble');
  r.rng.encounters = enc.state;
  // The roaming Greeble joins the fight on its node; never at the Boss, never twice.
  if (ambush && !boss && !enemies.includes('greeble')) enemies.push('greeble');

  const { state, events: ce } = createCombat({
    seed: `${r.seed}:combat:${node.id}`,
    deck: r.deck.map((c) => ({ def: c.def, upgraded: c.upgraded })),
    enemies,
    hp: r.hp,
    maxHp: r.maxHp,
    chargePerTurn: r.chargePerTurn,
    crumbs: r.crumbs,
    unlocks: r.unlocks,
    mods: {
      attackBonus: r.upgrades.includes('sharpened-mandibles') ? 1 : 0,
      firstTurnCharge: r.upgrades.includes('solar-panel') ? 1 : 0,
      pilferReduction: r.upgrades.includes('cats-whisker') ? 1 : 0,
      ...habitat?.mods,
    },
  });
  r.combat = state;
  r.phase = 'fight';
  events.push({
    type: 'fightStarted',
    enemies,
    elite,
    boss,
    ambush: ambush && !boss,
    ...(node.habitat ? { habitat: node.habitat } : {}),
  });
  events.push({ type: 'combat', events: ce });
}

function afterFight(r: RunState, events: RunEvent[]): void {
  const combat = r.combat as CombatState;
  const node = currentNode(r);
  r.hp = combat.player.hp;
  // Theft, recoveries and Scavenge are already applied; a net gain counts as earned.
  r.stats.crumbsEarned += Math.max(0, combat.crumbs - r.crumbs);
  r.crumbs = combat.crumbs;
  if (r.upgrades.includes('spare-parts')) r.hp = Math.min(r.maxHp, r.hp + SPARE_PARTS_HEAL);
  r.lastCombat = combat;
  r.combat = null;
  r.stats.fights++;
  if (node.type === 'elite') r.stats.elites++;
  if (node.type === 'boss') {
    // A Chrysalis still in the deck here never emerges (spec §8.8); the run is over.
    events.push({ type: 'fightWon', crumbs: 0 });
    r.phase = 'victory';
    events.push({ type: 'runWon' });
    return;
  }
  const flavor = FLAVORS[flavorOf(r.map, node, r.arrivedBy)];
  const rewards = Rng.fromState(r.rng.rewards);
  const elite = node.type === 'elite';
  const base = elite ? ELITE_CRUMBS : rewards.int(FIGHT_CRUMBS[0], FIGHT_CRUMBS[1]);
  const magnet = r.upgrades.includes('crumb-magnet') ? CRUMB_MAGNET_MULTIPLIER : 1;
  const crumbs = Math.round(base * flavor.crumbMultiplier * magnet);
  r.crumbs += crumbs;
  r.stats.crumbsEarned += crumbs;
  const cards = rollCards(rewards, elite ? 'elite' : 'fight', flavor.rareBonus, REWARD_CARD_COUNT);
  r.rng.rewards = rewards.state;
  r.reward = { crumbs, cards };
  r.phase = 'reward';
  events.push({ type: 'fightWon', crumbs });
  emerge(r, events);
  events.push({ type: 'rewardOffered', offer: r.reward });
}

/** Every Chrysalis in the deck becomes its Butterfly-family card (spec §8.8). */
function emerge(r: RunState, events: RunEvent[]): void {
  for (const card of r.deck) {
    if (!card.emerges) continue;
    const to = card.emerges;
    card.def = to;
    delete card.emerges;
    events.push({ type: 'emerged', uid: card.uid, to });
  }
}

function openShop(r: RunState, events: RunEvent[], traveling: boolean): void {
  const shop = Rng.fromState(r.rng.shop);
  const price = (p: number) => (traveling ? Math.round(p * TRAVELING_DISCOUNT) : p);
  const cards = rollCards(shop, 'shop', 0, traveling ? TRAVELING_CARD_COUNT : SHOP_CARD_COUNT).map(
    (def) => ({ def, price: price(SHOP_CARD_PRICES[cardDef(def).rarity]), sold: false }),
  );
  const availableUpgrades = UPGRADE_IDS.filter((id) => !r.upgrades.includes(id));
  const upgrades = shop
    .shuffle(availableUpgrades)
    .slice(0, traveling ? 1 : SHOP_UPGRADE_COUNT)
    .map((id) => ({ id, price: price(GENERAL_UPGRADE_PRICE), sold: false }));
  let unlocks: ShopUnlock[] = [];
  let wormillionaire: ShopWormillionaire | null = null;
  if (!traveling) {
    // Titled unlocks are drawn from bugs the deck actually holds and doesn't already own.
    const eligibleBugs = bugsInDeck(r).filter((b) => !r.unlocks.includes(b));
    unlocks = shop
      .shuffle(eligibleBugs)
      .slice(0, SHOP_UNLOCK_COUNT)
      .map((bug) => ({ bug, price: TITLED_UNLOCK_PRICE, sold: false }));
    wormillionaire = { price: WORMILLIONAIRE_PRICE, sold: false };
  }
  r.rng.shop = shop.state;
  r.shop = {
    cards,
    removalPrice: traveling ? null : SHOP_REMOVAL_PRICE + SHOP_REMOVAL_STEP * r.removalsBought,
    unlocks,
    upgrades,
    wormillionaire,
    traveling,
  };
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
  const pool = Object.values(CARDS).filter((c) => c.type !== 'status' && !c.special);
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

// ---------- map markers (spec §8.5, §8.6) ----------

/** Nodes one step away in either direction along a trail (the map is a DAG; markers ignore that). */
function neighborsOf(map: GameMap, id: string): string[] {
  const node = nodeAt(map, id);
  return [...new Set([...node.next.map((e) => e.id), ...node.prev])];
}

const isMarkerNode = (id: string) => id !== START && id !== BOSS;

function pickAnyNode(map: GameMap, rng: Rng, exclude?: string): string {
  const candidates = Object.keys(map.nodes).filter((id) => isMarkerNode(id) && id !== exclude);
  return rng.pick(candidates);
}

/** A node from the middle third of the map by depth (spec §8.6). */
function pickMiddleThirdNode(map: GameMap, rng: Rng): string {
  const ids = Object.values(map.nodes)
    .filter((n) => isMarkerNode(n.id))
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
    .map((n) => n.id);
  const third = Math.floor(ids.length / 3);
  const middle = ids.slice(third, ids.length - third);
  return rng.pick(middle.length > 0 ? middle : ids);
}

function stepMarker(map: GameMap, rng: Rng, from: string): string {
  const candidates = neighborsOf(map, from).filter(isMarkerNode);
  return candidates.length > 0 ? rng.pick(candidates) : from;
}

/** Shortest-path distance in nodes from `from` to every node, over next and prev edges. */
function distancesFrom(map: GameMap, from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of neighborsOf(map, id)) {
        if (dist.has(n)) continue;
        dist.set(n, (dist.get(id) as number) + 1);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

/** After an ambush the Greeble relocates at least GREEBLE_RELOCATE_DISTANCE away, or as far as the map allows. */
function relocateGreeble(map: GameMap, rng: Rng, from: string): string {
  const valid = [...distancesFrom(map, from)].filter(([id]) => isMarkerNode(id) && id !== from);
  const far = valid.filter(([, d]) => d >= GREEBLE_RELOCATE_DISTANCE).map(([id]) => id);
  if (far.length > 0) return rng.pick(far);
  if (valid.length === 0) return from;
  const maxDist = Math.max(...valid.map(([, d]) => d));
  return rng.pick(valid.filter(([, d]) => d === maxDist).map(([id]) => id));
}

/**
 * Advance both markers by one player move. Called once per travel, after `r.position` moved.
 * Landing on the Greeble sets `pendingGreeble` for `enterNode`; landing on the Snail at a
 * non-Shop node sets `pendingTravelingStall` for `returnToMap`.
 */
function updateMarkers(r: RunState): void {
  const rng = Rng.fromState(r.rng.markers);

  if (r.position === r.greebleNode) {
    r.pendingGreeble = true;
    r.greebleNode = relocateGreeble(r.map, rng, r.greebleNode);
  } else {
    r.greebleNode = stepMarker(r.map, rng, r.greebleNode);
  }

  if (r.snailNode === null) {
    r.snailReturnIn--;
    if (r.snailReturnIn <= 0) r.snailNode = pickAnyNode(r.map, rng, r.position);
  } else if (r.position === r.snailNode && currentNode(r).type !== 'shop') {
    r.pendingTravelingStall = true;
    r.snailNode = null;
    r.snailReturnIn = SNAIL_ABSENCE;
    r.snailTrail = [];
  } else {
    r.snailTrail = [...r.snailTrail, r.snailNode].slice(-SNAIL_TRAIL_LENGTH);
    r.snailNode = stepMarker(r.map, rng, r.snailNode);
  }

  r.rng.markers = rng.state;
}

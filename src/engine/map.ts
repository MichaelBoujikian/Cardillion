/**
 * Map generation — spec.md §8.2–§8.4. Three trails from Start to Boss, each with a signpost
 * flavour, crossing at two points so the player can switch. Pure: same Rng, same map.
 */
import { CROSSINGS, FLAVORS, type Flavor } from '@content/trails';
import type { Rng } from './rng';

export type NodeType = 'start' | 'fight' | 'elite' | 'shop' | 'cocoon' | 'boss';

export interface MapEdge {
  /** Destination node id. */
  id: string;
  /** Which trail this edge follows (index into `GameMap.trails`). */
  trail: number;
}

export interface MapNode {
  id: string;
  type: NodeType;
  /** 0-based position along its trail; -1 for Start, the map depth for Boss. */
  index: number;
  /** Trails that pass through this node (two for a crossing). */
  trails: number[];
  crossing: boolean;
  /** Layout, 0..1 across the garden and 0 (near) .. 1 (the forest edge). */
  x: number;
  y: number;
  next: MapEdge[];
  prev: string[];
}

export interface Trail {
  index: number;
  flavor: Flavor;
  /** Node ids from the first node after Start to the cocoon before Boss. */
  nodes: string[];
}

export interface GameMap {
  nodes: Record<string, MapNode>;
  trails: Trail[];
  start: string;
  boss: string;
  /** Longest trail, in nodes. */
  depth: number;
}

export const START = 'start';
export const BOSS = 'boss';
/** How many steps ahead node types are visible (spec §8.4). */
export const FOG_STEPS = 2;

export function generateMap(rng: Rng): GameMap {
  const flavors = rng.shuffle(Object.keys(FLAVORS) as Flavor[]).slice(0, 3);
  const lengths = flavors.map((f) => rng.int(FLAVORS[f].length[0], FLAVORS[f].length[1]));

  // Crossing 1 joins one adjacent pair of trails, crossing 2 the other pair.
  const firstPair: [number, number] = rng.chance(0.5) ? [0, 1] : [1, 2];
  const secondPair: [number, number] = firstPair[0] === 0 ? [1, 2] : [0, 1];
  const pairMin = (p: [number, number]) =>
    Math.min(lengths[p[0]] as number, lengths[p[1]] as number);
  const crossingIndex: [number, number] = [
    Math.min(CROSSINGS[0], pairMin(firstPair) - 2),
    Math.min(CROSSINGS[1], pairMin(secondPair) - 2),
  ];
  const crossingOf = (t: number, i: number): number => {
    if (firstPair.includes(t) && i === crossingIndex[0]) return 0;
    if (secondPair.includes(t) && i === crossingIndex[1]) return 1;
    return -1;
  };

  // Node types per trail.
  const types: NodeType[][] = flavors.map((f, t) => {
    const L = lengths[t] as number;
    const row: NodeType[] = Array.from({ length: L }, () => 'fight');
    row[L - 1] = 'cocoon';
    const free = (i: number) => row[i] === 'fight' && crossingOf(t, i) < 0 && i < L - 1;
    const fl = FLAVORS[f];
    // Elites: never before the 4th node, never adjacent. Short trails leave few valid layouts,
    // so choose among the valid combinations rather than picking greedily.
    const eliteSlots: number[] = [];
    for (let i = 3; i <= L - 2; i++) if (free(i)) eliteSlots.push(i);
    const combos: number[][] = [];
    const pickCombo = (startAt: number, chosen: number[]) => {
      if (chosen.length === fl.elites) {
        combos.push([...chosen]);
        return;
      }
      for (let k = startAt; k < eliteSlots.length; k++) {
        const i = eliteSlots[k] as number;
        if (chosen.length > 0 && i - (chosen[chosen.length - 1] as number) < 2) continue;
        chosen.push(i);
        pickCombo(k + 1, chosen);
        chosen.pop();
      }
    };
    pickCombo(0, []);
    if (combos.length === 0) throw new Error(`no elite layout for a ${L}-node ${f} trail`);
    for (const i of rng.pick(combos)) row[i] = 'elite';
    const place = (type: NodeType, count: number, minIndex: number) => {
      for (let n = 0; n < count; n++) {
        const candidates: number[] = [];
        for (let i = minIndex; i <= L - 2; i++) if (free(i)) candidates.push(i);
        if (candidates.length === 0)
          throw new Error(`no room for a ${type} on a ${L}-node ${f} trail`);
        row[rng.pick(candidates)] = type;
      }
    };
    place('shop', fl.shops, 2);
    place('cocoon', fl.cocoons, 2);
    return row;
  });

  const depth = Math.max(...lengths);
  const nodes: Record<string, MapNode> = {};
  const lane = (t: number) => 0.2 + t * 0.3;
  const yOf = (i: number) => (i + 1) / (depth + 1);
  nodes[START] = {
    id: START,
    type: 'start',
    index: -1,
    trails: [0, 1, 2],
    crossing: false,
    x: 0.5,
    y: 0,
    next: [],
    prev: [],
  };
  nodes[BOSS] = {
    id: BOSS,
    type: 'boss',
    index: depth,
    trails: [0, 1, 2],
    crossing: false,
    x: 0.5,
    y: 1,
    next: [],
    prev: [],
  };

  const trails: Trail[] = flavors.map((flavor, t) => ({ index: t, flavor, nodes: [] }));
  const idAt = (t: number, i: number): string => {
    const k = crossingOf(t, i);
    return k >= 0 ? `x${k}` : `t${t}-${i}`;
  };
  for (let t = 0; t < 3; t++) {
    const L = lengths[t] as number;
    for (let i = 0; i < L; i++) {
      const id = idAt(t, i);
      const k = crossingOf(t, i);
      let node = nodes[id];
      if (!node) {
        const pair = k === 0 ? firstPair : secondPair;
        const x =
          k >= 0 ? (lane(pair[0]) + lane(pair[1])) / 2 : lane(t) + (rng.next() - 0.5) * 0.08;
        node = {
          id,
          type: k >= 0 ? 'fight' : (types[t]?.[i] as NodeType),
          index: i,
          trails: [],
          crossing: k >= 0,
          x,
          y: yOf(i),
          next: [],
          prev: [],
        };
        nodes[id] = node;
      }
      node.trails.push(t);
      trails[t]?.nodes.push(id);
    }
  }

  const link = (from: string, to: string, trail: number) => {
    const a = nodes[from] as MapNode;
    const b = nodes[to] as MapNode;
    if (!a.next.some((e) => e.id === to && e.trail === trail)) a.next.push({ id: to, trail });
    if (!b.prev.includes(from)) b.prev.push(from);
  };
  for (const trail of trails) {
    let prev = START;
    for (const id of trail.nodes) {
      link(prev, id, trail.index);
      prev = id;
    }
    link(prev, BOSS, trail.index);
  }
  return { nodes, trails, start: START, boss: BOSS, depth };
}

export function nodeAt(map: GameMap, id: string): MapNode {
  const n = map.nodes[id];
  if (!n) throw new Error(`no map node "${id}"`);
  return n;
}

/** 1-based depth used by encounter tables (spec §7.5). */
export function depthOf(node: MapNode): number {
  return node.index + 1;
}

export function canTravel(map: GameMap, from: string, to: string): boolean {
  return nodeAt(map, from).next.some((e) => e.id === to);
}

/** Node ids whose type the player can see: within FOG_STEPS ahead, already visited, and the Boss. */
export function visibleNodes(
  map: GameMap,
  position: string,
  visited: readonly string[],
): Set<string> {
  const seen = new Set<string>([...visited, position, map.start, map.boss]);
  let frontier = [position];
  for (let step = 0; step < FOG_STEPS; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of nodeAt(map, id).next) {
        if (!seen.has(e.id)) next.push(e.id);
        seen.add(e.id);
      }
    }
    frontier = next;
  }
  return seen;
}

export interface Signpost {
  to: string;
  trail: number;
  flavor: Flavor;
}

/** What the signpost at `position` says about each way forward. */
export function signposts(map: GameMap, position: string): Signpost[] {
  return nodeAt(map, position).next.map((e) => ({
    to: e.id,
    trail: e.trail,
    flavor: (map.trails[e.trail] as Trail).flavor,
  }));
}

/** The flavour governing a node's rewards: its trail's, or for shared nodes the trail you arrived by. */
export function flavorOf(map: GameMap, node: MapNode, arrivedBy: number | null): Flavor {
  const t =
    node.trails.length === 1
      ? (node.trails[0] as number)
      : (arrivedBy ?? (node.trails[0] as number));
  return (map.trails[t] as Trail).flavor;
}

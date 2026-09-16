/**
 * Map generation — the structural constraints of spec.md §8.2 and the fog/signpost rules of
 * §8.4, checked across many seeds.
 */
import { HABITAT_IDS } from '@content/habitats';
import { FLAVORS } from '@content/trails';
import { describe, expect, it } from 'vitest';
import {
  BOSS,
  START,
  canTravel,
  generateMap,
  nodeAt,
  signposts,
  visibleNodes,
  type GameMap,
} from './map';
import { Rng } from './rng';

const SEEDS = Array.from({ length: 150 }, (_, i) => `map-${i}`);
const maps = SEEDS.map((s) => generateMap(new Rng(s).fork('map')));

function reachesBoss(map: GameMap, from: string, seen = new Set<string>()): boolean {
  if (from === BOSS) return true;
  if (seen.has(from)) return true; // already verified along another path (the map is a DAG)
  seen.add(from);
  return nodeAt(map, from).next.every((e) => reachesBoss(map, e.id, seen));
}

describe('generateMap', () => {
  it('is deterministic for a seed', () => {
    expect(generateMap(new Rng('x').fork('map'))).toEqual(generateMap(new Rng('x').fork('map')));
  });

  it('keeps the g52 layout HANDOFF documents (habitats never perturb the layout)', () => {
    const m = generateMap(new Rng('g52').fork('map'));
    const trails = m.trails.map(
      (t) => `${t.flavor}:` + t.nodes.map((id) => `${id}=${nodeAt(m, id).type}`).join(','),
    );
    expect(trails).toEqual([
      'sunny:t0-0=fight,t0-1=fight,t0-2=shop,t0-3=cocoon,t0-4=elite,t0-5=fight,t0-6=fight,x1=fight,t0-8=cocoon',
      'market:t1-0=fight,t1-1=fight,t1-2=fight,x0=fight,t1-4=elite,t1-5=shop,t1-6=shop,x1=fight,t1-8=cocoon',
      'thorny:t2-0=fight,t2-1=fight,t2-2=fight,x0=fight,t2-4=elite,t2-5=fight,t2-6=fight,t2-7=fight,t2-8=elite,t2-9=shop,t2-10=fight,t2-11=cocoon',
    ]);
  });

  it('gives habitats only to Fight and Elite nodes, to about half of them (spec §8.9)', () => {
    let fights = 0;
    let withHabitat = 0;
    for (const map of maps) {
      for (const n of Object.values(map.nodes)) {
        if (n.type === 'fight' || n.type === 'elite') {
          fights++;
          if (n.habitat) {
            withHabitat++;
            expect(HABITAT_IDS).toContain(n.habitat);
          }
        } else expect(n.habitat).toBeUndefined();
      }
    }
    expect(withHabitat / fights).toBeGreaterThan(0.4);
    expect(withHabitat / fights).toBeLessThan(0.6);
  });

  it('builds three trails with distinct flavours and lengths in range', () => {
    for (const map of maps) {
      expect(map.trails).toHaveLength(3);
      const flavors = map.trails.map((t) => t.flavor);
      expect(new Set(flavors).size).toBe(3);
      for (const t of map.trails) {
        const [lo, hi] = FLAVORS[t.flavor].length;
        expect(t.nodes.length).toBeGreaterThanOrEqual(lo);
        expect(t.nodes.length).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('respects every per-trail placement constraint', () => {
    for (const map of maps) {
      for (const t of map.trails) {
        const types = t.nodes.map((id) => nodeAt(map, id).type);
        const fl = FLAVORS[t.flavor];
        expect(types[0]).toBe('fight');
        expect(types[1]).toBe('fight');
        expect(types[types.length - 1]).toBe('cocoon');
        const count = (k: string) => types.filter((x) => x === k).length;
        expect(count('elite')).toBe(fl.elites);
        expect(count('shop')).toBe(fl.shops);
        expect(count('cocoon')).toBe(fl.cocoons + 1);
        types.forEach((type, i) => {
          if (type === 'elite') {
            expect(i).toBeGreaterThanOrEqual(3);
            expect(types[i - 1]).not.toBe('elite');
            expect(types[i + 1]).not.toBe('elite');
          }
          if (type === 'shop') expect(i).toBeGreaterThanOrEqual(2);
        });
      }
    }
  });

  it('has exactly two crossings, each shared by two trails and always a fight', () => {
    for (const map of maps) {
      const crossings = Object.values(map.nodes).filter((n) => n.crossing);
      expect(crossings).toHaveLength(2);
      for (const c of crossings) {
        expect(c.trails).toHaveLength(2);
        expect(c.type).toBe('fight');
        expect(c.next.length).toBe(2);
      }
      // Every trail passes through at least one crossing, so every trail can be switched from.
      for (const t of map.trails) expect(t.nodes.some((id) => nodeAt(map, id).crossing)).toBe(true);
    }
  });

  it('connects Start to Boss along every path with no dead ends', () => {
    for (const map of maps) {
      expect(nodeAt(map, START).next).toHaveLength(3);
      expect(nodeAt(map, BOSS).next).toHaveLength(0);
      expect(reachesBoss(map, START)).toBe(true);
      for (const node of Object.values(map.nodes)) {
        if (node.id === BOSS) continue;
        expect(node.next.length).toBeGreaterThan(0);
        for (const e of node.next) expect(canTravel(map, node.id, e.id)).toBe(true);
      }
    }
  });

  it('lays nodes out in 0..1 with Start nearest and Boss farthest', () => {
    for (const map of maps) {
      for (const n of Object.values(map.nodes)) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(1);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeLessThanOrEqual(1);
      }
      expect(nodeAt(map, START).y).toBe(0);
      expect(nodeAt(map, BOSS).y).toBe(1);
    }
  });
});

describe('fog and signposts', () => {
  it('shows two steps ahead, visited nodes and the Boss from Start', () => {
    const map = maps[0]!;
    const seen = visibleNodes(map, START, []);
    for (const t of map.trails) {
      expect(seen.has(t.nodes[0]!)).toBe(true);
      expect(seen.has(t.nodes[1]!)).toBe(true);
      expect(seen.has(t.nodes[2]!)).toBe(false);
    }
    expect(seen.has(BOSS)).toBe(true);
    const later = visibleNodes(map, map.trails[0]!.nodes[2]!, [
      START,
      map.trails[0]!.nodes[0]!,
      map.trails[0]!.nodes[1]!,
    ]);
    expect(later.has(map.trails[0]!.nodes[0]!)).toBe(true);
    expect(later.has(map.trails[0]!.nodes[4]!)).toBe(true);
    expect(later.has(map.trails[0]!.nodes[5]!)).toBe(false);
  });

  it('names a distinct flavour for each way forward at Start', () => {
    for (const map of maps) {
      const posts = signposts(map, START);
      expect(posts).toHaveLength(3);
      expect(new Set(posts.map((p) => p.flavor)).size).toBe(3);
      for (const p of posts) expect(map.trails[p.trail]!.flavor).toBe(p.flavor);
    }
  });
});

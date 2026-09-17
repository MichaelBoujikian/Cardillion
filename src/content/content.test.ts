/**
 * Content schema tests — spec.md §12.3: tables are validated, not hand-checked.
 */
import { describe, expect, it } from 'vitest';
import { CARDS, STARTING_DECK } from './cards';
import { ENCOUNTERS } from './encounters';
import { ENEMIES } from './enemies';

describe('cards', () => {
  it('every card is keyed by its id, has art, sane cost and text', () => {
    for (const [key, card] of Object.entries(CARDS)) {
      expect(card.id).toBe(key);
      expect(card.art).toMatch(/^card-/);
      expect(card.name.length).toBeGreaterThan(0);
      for (const form of [card.base, card.upgraded]) {
        if (!form) continue;
        expect(form.cost).toBeGreaterThanOrEqual(0);
        expect(form.text.length).toBeGreaterThan(0);
        for (const e of form.effects) {
          if ('amount' in e) expect(e.amount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('single-target and all-enemy attacks are attacks; unplayable cards have no effects', () => {
    for (const card of Object.values(CARDS)) {
      if (card.targeting === 'enemy') expect(card.type).toBe('attack');
      if (card.unplayable) expect(card.base.effects).toHaveLength(0);
      if (card.type !== 'status') expect(card.upgraded).not.toBeNull();
    }
  });

  it('upgraded-form art is a card art id, distinct from the base art, and Cat and Wormillion have it', () => {
    for (const card of Object.values(CARDS)) {
      if (card.upgradedArt === undefined) continue;
      expect(card.upgraded).not.toBeNull();
      expect(card.upgradedArt).toMatch(/^card-/);
      expect(card.upgradedArt).not.toBe(card.art);
    }
    expect(CARDS['cat']?.upgradedArt).toBe('card-cat-plus');
    expect(CARDS['wormillion']?.upgradedArt).toBe('card-wormillion-plus');
  });

  it('the starting deck only uses real cards and has ten of them', () => {
    expect(STARTING_DECK).toHaveLength(10);
    for (const id of STARTING_DECK) expect(CARDS[id]).toBeDefined();
  });
});

describe('enemies', () => {
  it('every enemy is keyed by its id, has art, HP and at least one move', () => {
    for (const [key, enemy] of Object.entries(ENEMIES)) {
      expect(enemy.id).toBe(key);
      expect(enemy.art).toMatch(/^(enemy|boss)-/);
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.moves.length).toBeGreaterThan(0);
      const ids = enemy.moves.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const move of enemy.moves) {
        for (const e of move.effects) {
          if ('amount' in e) expect(e.amount).toBeGreaterThan(0);
          if (e.kind === 'summon') expect(ENEMIES[e.enemy]).toBeDefined();
        }
      }
    }
  });

  it('weighted enemies have positive weights; pattern enemies reference real moves', () => {
    for (const enemy of Object.values(ENEMIES)) {
      const ids = new Set(enemy.moves.map((m) => m.id));
      if (enemy.pattern) {
        for (const id of enemy.pattern) expect(ids.has(id)).toBe(true);
        if (enemy.enrage) for (const id of enemy.enrage.pattern) expect(ids.has(id)).toBe(true);
      } else {
        expect(enemy.moves.reduce((a, m) => a + m.weight, 0)).toBeGreaterThan(0);
      }
      if (enemy.traits.includes('playDead')) expect(enemy.reviveHp).toBeGreaterThan(0);
    }
  });

  it('a Play Dead pose is an enemy art id and only Play Dead enemies have one', () => {
    for (const enemy of Object.values(ENEMIES)) {
      if (enemy.deadArt === undefined) continue;
      expect(enemy.traits).toContain('playDead');
      expect(enemy.deadArt).toMatch(/^enemy-/);
      expect(enemy.deadArt).not.toBe(enemy.art);
    }
    expect(ENEMIES['possum']?.deadArt).toBe('enemy-possum-dead');
  });

  it('poses are distinct enemy art ids', () => {
    for (const enemy of Object.values(ENEMIES)) {
      if (!enemy.poses) continue;
      const ids = Object.values(enemy.poses).flat();
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(id).toMatch(/^(enemy|boss)-/);
        expect(id).not.toBe(enemy.art);
      }
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('encounters', () => {
  it('only reference real enemies and always include a seen enemy', () => {
    for (const pool of Object.values(ENCOUNTERS)) {
      for (const encounter of pool) {
        expect(encounter.length).toBeGreaterThan(0);
        for (const id of encounter) expect(ENEMIES[id]).toBeDefined();
        expect(encounter.some((id) => !ENEMIES[id]!.traits.includes('unseen'))).toBe(true);
      }
    }
  });
});

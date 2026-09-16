/**
 * Combat rules — one test per rule in spec.md §4–§7. Every scenario is seeded, so a failure
 * here is reproducible by seed.
 */
import { describe, expect, it } from 'vitest';
import { applyAction, canPlay, createCombat, type CombatSetup } from './combat';
import type { CombatEvent, CombatState } from './types';

function start(over: Partial<CombatSetup> = {}) {
  const setup: CombatSetup = {
    seed: 'test',
    deck: ['wormillion', 'wormillion', 'wormillion', 'roly-poly', 'roly-poly', 'ladybug'],
    enemies: ['rat'],
    hp: 60,
    chargePerTurn: 3,
    crumbs: 25,
    unlocks: [],
    ...over,
  };
  return createCombat(setup);
}

const hand = (s: CombatState, def: string) => s.hand.find((c) => c.def === def);
const play = (s: CombatState, def: string, target?: string) => {
  const card = hand(s, def);
  if (!card) throw new Error(`no ${def} in hand`);
  return applyAction(
    s,
    target ? { type: 'playCard', uid: card.uid, target } : { type: 'playCard', uid: card.uid },
  );
};
const endTurn = (s: CombatState) => applyAction(s, { type: 'endTurn' });
const ofType = <T extends CombatEvent['type']>(events: CombatEvent[], type: T) =>
  events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);

describe('createCombat', () => {
  it('starts turn 1 with a full hand, full charge and an intent on every enemy', () => {
    const { state, events } = start({ deck: Array<string>(10).fill('wormillion') });
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('player');
    expect(state.hand).toHaveLength(5);
    expect(state.draw).toHaveLength(5);
    expect(state.player.charge).toBe(3);
    expect(state.player.statuses.block).toBe(0);
    for (const e of state.enemies) expect(e.intent).not.toBeNull();
    expect(ofType(events, 'combatStarted')).toHaveLength(1);
    expect(ofType(events, 'cardDrawn')).toHaveLength(5);
  });

  it('is deterministic for the same seed', () => {
    const a = start({ seed: 'garden', enemies: ['rat', 'rat'] });
    const b = start({ seed: 'garden', enemies: ['rat', 'rat'] });
    expect(a).toEqual(b);
    const a2 = endTurn(a.state);
    const b2 = endTurn(b.state);
    expect(a2).toEqual(b2);
  });

  it('refuses a fight with no seen enemy', () => {
    expect(() => start({ enemies: ['greeble'] })).toThrow(/seen/);
  });
});

describe('playing cards', () => {
  it('Wormillion deals 4, costs 1 Charge and goes to discard', () => {
    const { state } = start();
    const rat = state.enemies[0]!;
    const { state: s2, events } = play(state, 'wormillion', rat.uid);
    expect(s2.enemies[0]!.hp).toBe(rat.hp - 4);
    expect(s2.player.charge).toBe(2);
    expect(s2.hand).toHaveLength(4);
    expect(s2.discard.some((c) => c.def === 'wormillion')).toBe(true);
    expect(ofType(events, 'damageDealt')[0]).toMatchObject({
      target: rat.uid,
      amount: 4,
      blocked: 0,
    });
  });

  it('refuses a card the player cannot afford', () => {
    const { state } = start({ deck: Array<string>(10).fill('ladybug') });
    const s2 = play(state, 'ladybug').state; // 3 -> 1
    const card = hand(s2, 'ladybug')!;
    expect(canPlay(s2, card.uid)).toMatchObject({ ok: false, reason: 'charge' });
    expect(() => play(s2, 'ladybug')).toThrow(/charge/);
  });

  it('requires a target for single-target cards and ignores one for the rest', () => {
    const { state } = start({
      deck: ['wormillion', 'roly-poly', 'wormillion', 'roly-poly', 'wormillion'],
    });
    expect(canPlay(state, hand(state, 'wormillion')!.uid)).toMatchObject({
      ok: false,
      reason: 'target',
    });
    expect(canPlay(state, hand(state, 'roly-poly')!.uid)).toMatchObject({ ok: true });
    expect(() => play(state, 'roly-poly', state.enemies[0]!.uid)).not.toThrow();
  });

  it('Ladybug hits every seen enemy', () => {
    const { state } = start({
      enemies: ['rat', 'rat', 'spider'],
      deck: Array<string>(10).fill('ladybug'),
    });
    const before = state.enemies.map((e) => e.hp);
    const { state: s2 } = play(state, 'ladybug');
    s2.enemies.forEach((e, i) => expect(e.hp).toBe(before[i]! - 4));
  });

  it('a titled unlock makes every copy of that bug play as its upgraded form', () => {
    const { state } = start({ unlocks: ['wormillion'] });
    const { state: s2 } = play(state, 'wormillion', state.enemies[0]!.uid);
    expect(s2.player.charge).toBe(3);
  });

  it('an injected upgraded copy plays upgraded on its own', () => {
    const { state } = start({ deck: [{ def: 'wormillion', upgraded: true }, 'roly-poly'] });
    const { state: s2 } = play(state, 'wormillion', state.enemies[0]!.uid);
    expect(s2.player.charge).toBe(3);
  });

  it('refuses actions once the fight is over', () => {
    const { state } = start({
      enemies: ['rat'],
      deck: Array<string>(10).fill('chameleon'),
      chargePerTurn: 9,
    });
    const s2 = play(state, 'chameleon', state.enemies[0]!.uid).state;
    const s3 = play(s2, 'chameleon', s2.enemies[0]!.uid).state;
    expect(s3.phase).toBe('won');
    expect(() => endTurn(s3)).toThrow(/over/);
  });
});

describe('block', () => {
  it('Roly Poly grants 5 Block which absorbs the next hit', () => {
    const { state } = start({ deck: Array<string>(10).fill('roly-poly') });
    const s2 = play(state, 'roly-poly').state;
    expect(s2.player.statuses.block).toBe(5);
    // Force the rat's intent to Gnaw (4) for a deterministic hit.
    s2.enemies[0]!.intent = 'gnaw';
    const { state: s3, events } = endTurn(s2);
    expect(s3.player.hp).toBe(60);
    expect(ofType(events, 'playerDamaged')[0]).toMatchObject({ amount: 0, blocked: 4 });
  });

  it('Block resets at the start of the player’s next turn', () => {
    const { state } = start({ deck: Array<string>(10).fill('roly-poly') });
    const s2 = play(play(state, 'roly-poly').state, 'roly-poly').state;
    expect(s2.player.statuses.block).toBe(10);
    s2.enemies[0]!.intent = 'gnaw';
    const s3 = endTurn(s2).state;
    expect(s3.player.statuses.block).toBe(0);
  });

  it('applies Block per hit of a multi-hit attack', () => {
    const { state } = start({ deck: Array<string>(10).fill('roly-poly') });
    const s2 = play(state, 'roly-poly').state; // 5 block
    s2.enemies[0]!.intent = 'frenzy'; // 2 x 2
    const { state: s3, events } = endTurn(s2);
    expect(ofType(events, 'playerDamaged')).toHaveLength(2);
    expect(s3.player.hp).toBe(60);
  });
});

describe('turn structure', () => {
  it('end turn discards the hand, enemies act, then a fresh hand and full Charge arrive', () => {
    const { state } = start({ deck: Array<string>(10).fill('wormillion') });
    const { state: s2, events } = endTurn(state);
    expect(s2.turn).toBe(2);
    expect(s2.hand).toHaveLength(5);
    expect(s2.draw).toHaveLength(0);
    expect(s2.discard).toHaveLength(5);
    expect(s2.player.charge).toBe(3);
    expect(ofType(events, 'enemyActed')).toHaveLength(1);
    expect(ofType(events, 'intentRolled')).toHaveLength(1);
    expect(ofType(events, 'turnStarted')[0]).toMatchObject({ turn: 2 });
  });

  it('reshuffles the discard pile into the draw pile when it runs dry', () => {
    const { state } = start({ deck: Array<string>(10).fill('wormillion') });
    const s2 = endTurn(state).state; // draw pile now empty
    const { state: s3, events } = endTurn(s2);
    expect(ofType(events, 'deckReshuffled')).toHaveLength(1);
    expect(s3.hand).toHaveLength(5);
    expect(s3.draw).toHaveLength(5);
    expect(s3.discard).toHaveLength(0);
  });

  it('caps the hand at 10 and discards extra draws', () => {
    const deck = [
      ...Array<string>(9).fill('roly-poly'),
      'butterfly',
      ...Array<string>(10).fill('wormillion'),
    ];
    const { state } = start({ deck, seed: 'cap', chargePerTurn: 9 });
    // Fill the hand to 9 by drawing with butterflies would need several; instead set it up directly.
    const s = structuredClone(state);
    while (s.hand.length < 9) s.hand.push(s.draw.pop()!);
    const bf =
      s.draw.find((c) => c.def === 'butterfly') ?? s.hand.find((c) => c.def === 'butterfly');
    if (!bf) throw new Error('no butterfly');
    if (!s.hand.includes(bf)) {
      s.draw.splice(s.draw.indexOf(bf), 1);
      s.hand.push(bf);
    }
    // Hand is now 9 or 10 cards including butterfly; playing it leaves ≤ 9 then draws 2.
    const { state: s2, events } = applyAction(s, { type: 'playCard', uid: bf.uid });
    expect(s2.hand.length).toBeLessThanOrEqual(10);
    const drawn = ofType(events, 'cardDrawn').length + ofType(events, 'cardDiscarded').length;
    expect(drawn).toBeGreaterThanOrEqual(2);
  });
});

describe('statuses', () => {
  it('Poison ticks at the start of the enemy’s turn, ignores Block, then decrements', () => {
    const { state } = start({ enemies: ['rat'], deck: Array<string>(10).fill('caterpillar') });
    const rat = state.enemies[0]!;
    const s2 = play(state, 'caterpillar', rat.uid).state; // 2 dmg + 3 poison
    expect(s2.enemies[0]!.statuses.poison).toBe(3);
    s2.enemies[0]!.statuses.block = 50; // poison must ignore this
    const hpBefore = s2.enemies[0]!.hp;
    const { state: s3, events } = endTurn(s2);
    expect(ofType(events, 'poisonTicked')[0]).toMatchObject({ target: rat.uid, amount: 3 });
    expect(s3.enemies[0]!.hp).toBe(hpBefore - 3);
    expect(s3.enemies[0]!.statuses.poison).toBe(2);
  });

  it('Poison on the player ticks at the start of the player’s turn', () => {
    const { state } = start({ enemies: ['scorpion'] });
    state.enemies[0]!.intent = 'sting'; // 3 dmg + 3 poison
    const { state: s2 } = endTurn(state);
    expect(s2.player.hp).toBe(60 - 3 - 3); // sting, then the tick at the start of turn 2
    expect(s2.player.statuses.poison).toBe(2);
  });

  it('Weak on an enemy cuts its damage by 25% and wears off at the end of its turn', () => {
    const { state } = start({ enemies: ['rat'], deck: Array<string>(10).fill('butterfly') });
    const s2 = play(state, 'butterfly').state; // 1 weak to all
    expect(s2.enemies[0]!.statuses.weak).toBe(1);
    s2.enemies[0]!.intent = 'gnaw';
    const { state: s3, events } = endTurn(s2);
    expect(ofType(events, 'playerDamaged')[0]).toMatchObject({ amount: 3 });
    expect(s3.enemies[0]!.statuses.weak).toBe(0);
  });

  it('Weak on the player cuts card damage and wears off at the end of the player’s turn', () => {
    const { state } = start({ enemies: ['possum'] });
    state.enemies[0]!.intent = 'hiss';
    const s2 = endTurn(state).state;
    expect(s2.player.statuses.weak).toBe(1);
    const possum = s2.enemies[0]!;
    const { state: s3 } = play(s2, 'wormillion', possum.uid);
    expect(s3.enemies[0]!.hp).toBe(possum.hp - 3);
    const s4 = endTurn(s3).state;
    expect(s4.player.statuses.weak).toBe(0);
  });
});

describe('enemies', () => {
  it('rolls intents by weight, never repeating a noRepeat move', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = start({
        seed,
        enemies: ['possum'],
        hp: 9999,
        deck: Array<string>(10).fill('roly-poly'),
      }).state;
      let prev = s.enemies[0]!.intent;
      for (let t = 0; t < 12; t++) {
        s = endTurn(s).state;
        const cur = s.enemies[0]!.intent;
        if (prev === 'lunge') expect(cur).not.toBe('lunge');
        prev = cur;
      }
    }
  });

  it('Spider spins at most 3 webs per fight; Cobwebs are unplayable and exhaust at end of turn', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = start({
        seed,
        enemies: ['spider'],
        hp: 9999,
        deck: Array<string>(10).fill('roly-poly'),
      }).state;
      let cobwebs = 0;
      for (let t = 0; t < 15; t++) {
        const r = endTurn(s);
        s = r.state;
        cobwebs += ofType(r.events, 'cardAdded').filter((e) => e.def === 'cobweb').length;
        const inHand = s.hand.find((c) => c.def === 'cobweb');
        if (inHand)
          expect(canPlay(s, inHand.uid)).toMatchObject({ ok: false, reason: 'unplayable' });
      }
      expect(cobwebs).toBeLessThanOrEqual(3);
      expect(s.enemies[0]!.uses['spin-web'] ?? 0).toBeLessThanOrEqual(3);
      // Ethereal: a cobweb never sits in the discard pile.
      expect(s.discard.some((c) => c.def === 'cobweb')).toBe(false);
    }
  });

  it('Possum plays dead once, then dies for real', () => {
    const { state } = start({
      enemies: ['possum'],
      deck: Array<string>(10).fill('chameleon'),
      chargePerTurn: 9,
    });
    const uid = state.enemies[0]!.uid;
    let s = state;
    let revived: CombatEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const r = play(s, 'chameleon', uid);
      s = r.state;
      revived = revived.concat(ofType(r.events, 'enemyRevived'));
    }
    expect(revived).toHaveLength(1);
    expect(revived[0]).toMatchObject({ uid, hp: 6 });
    expect(s.enemies[0]!.playedDead).toBe(true);
    expect(s.phase).toBe('player');
    const r = play(s, 'chameleon', uid);
    expect(r.state.enemies[0]!.hp).toBe(0);
    expect(r.state.phase).toBe('won');
  });

  it('Rat King never summons beyond two rats present', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = start({
        seed,
        enemies: ['rat-king'],
        hp: 9999,
        deck: Array<string>(10).fill('roly-poly'),
      }).state;
      for (let t = 0; t < 12; t++) {
        s = endTurn(s).state;
        const rats = s.enemies.filter((e) => e.def === 'rat' && e.hp > 0).length;
        expect(rats).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the Bear follows its pattern and enrages at half HP', () => {
    const { state } = start({
      enemies: ['bear'],
      hp: 9999,
      deck: Array<string>(10).fill('roly-poly'),
    });
    expect(state.enemies[0]!.intent).toBe('swipe');
    let s = endTurn(state).state;
    expect(s.enemies[0]!.intent).toBe('roar');
    s = endTurn(s).state;
    expect(s.enemies[0]!.intent).toBe('swipe');
    s = endTurn(s).state;
    expect(s.enemies[0]!.intent).toBe('maul');
    // Enrage: drop to half HP by hand, then its swipe should hit for 9 + 3.
    s = structuredClone(s);
    s.enemies[0]!.hp = 60;
    s.enemies[0]!.intent = 'swipe';
    s.player.statuses.block = 0;
    const hp = s.player.hp;
    const { state: s2 } = endTurn(s);
    expect(hp - s2.player.hp).toBe(12);
    expect(['swipe', 'maul']).toContain(s2.enemies[0]!.intent);
  });
});

describe('the Greeble', () => {
  const setup = (over: Partial<CombatSetup> = {}) =>
    start({
      enemies: ['rat', 'greeble'],
      deck: Array<string>(10).fill('wormillion'),
      crumbs: 25,
      ...over,
    });

  it('cannot be targeted by non-Cat cards and is skipped by all-enemy attacks', () => {
    const { state } = start({
      enemies: ['rat', 'greeble'],
      deck: ['wormillion', 'ladybug', 'cat', 'roly-poly', 'roly-poly'],
      chargePerTurn: 9,
    });
    const greeble = state.enemies.find((e) => e.def === 'greeble')!;
    expect(canPlay(state, hand(state, 'wormillion')!.uid, greeble.uid)).toMatchObject({
      ok: false,
      reason: 'unseen',
    });
    expect(canPlay(state, hand(state, 'cat')!.uid, greeble.uid)).toMatchObject({ ok: true });
    const { state: s2 } = play(state, 'ladybug');
    expect(s2.enemies.find((e) => e.def === 'greeble')!.hp).toBe(greeble.hp);
  });

  it('steals crumbs each turn and escapes with them when the seen enemies die', () => {
    const { state } = setup({ chargePerTurn: 9 });
    const { state: s2, events } = endTurn(state);
    expect(ofType(events, 'crumbsStolen')[0]).toMatchObject({ amount: 4 });
    expect(s2.crumbs).toBe(21);
    expect(s2.stolen).toBe(4);
    const rat = s2.enemies.find((e) => e.def === 'rat')!;
    let s = s2;
    let result = endTurn(s);
    for (let i = 0; i < 3 && s.phase === 'player'; i++) {
      result = play(s, 'wormillion', rat.uid);
      s = result.state;
    }
    expect(s.phase).toBe('won');
    expect(ofType(result.events, 'greebleEscaped')[0]).toMatchObject({ amount: 4 });
    expect(ofType(result.events, 'combatWon')[0]).toMatchObject({ crumbsRecovered: 0 });
    expect(s.stolen).toBe(0);
    expect(s.crumbs).toBe(21);
  });

  it('gnaws for 2 instead when there is nothing to steal', () => {
    const { state } = setup({ crumbs: 0 });
    const { state: s2, events } = endTurn(state);
    expect(ofType(events, 'crumbsStolen')).toHaveLength(0);
    expect(s2.player.hp).toBeLessThan(60);
  });

  it('killed by a Cat: returns the stolen crumbs plus the bonus; Sir Reginald V doubles the return', () => {
    for (const [unlocks, expectedReturn] of [
      [[], 4 + 15],
      [['cat'], 8 + 15],
    ] as const) {
      const { state } = start({
        enemies: ['rat', 'greeble'],
        deck: Array<string>(10).fill('cat'),
        chargePerTurn: 9,
        crumbs: 25,
        unlocks: [...unlocks],
      });
      const s2 = endTurn(state).state; // greeble steals 4
      const greeble = s2.enemies.find((e) => e.def === 'greeble')!;
      let s = s2;
      for (let i = 0; i < 3 && s.enemies.find((e) => e.def === 'greeble')!.hp > 0; i++)
        s = play(s, 'cat', greeble.uid).state;
      expect(s.enemies.find((e) => e.def === 'greeble')!.hp).toBe(0);
      expect(s.stolen).toBe(0);
      expect(s.crumbs).toBe(21 + expectedReturn);
    }
  });
});

describe('losing', () => {
  it('ends the fight when the player’s HP reaches 0', () => {
    const { state } = start({
      enemies: ['bear'],
      hp: 5,
      deck: Array<string>(10).fill('wormillion'),
    });
    const { state: s2, events } = endTurn(state);
    expect(s2.phase).toBe('lost');
    expect(s2.player.hp).toBe(0);
    expect(ofType(events, 'combatLost')).toHaveLength(1);
  });
});

describe('family cards (spec §5.4)', () => {
  it('Spot Barrage hits a random seen enemy 3 times, never the Unseen', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = start({
        seed,
        enemies: ['rat', 'rat', 'greeble'],
        deck: Array<string>(10).fill('spot-barrage'),
        chargePerTurn: 9,
      });
      const { state: s2, events } = play(state, 'spot-barrage');
      const hits = ofType(events, 'damageDealt');
      expect(hits).toHaveLength(3);
      const totalDamage = hits.reduce((a, h) => a + h.amount, 0);
      expect(totalDamage).toBeGreaterThan(0);
      const greeble = s2.enemies.find((e) => e.def === 'greeble')!;
      expect(hits.every((h) => h.target !== greeble.uid)).toBe(true);
    }
  });

  it('Flutter draws and applies Weak to one random seen enemy, not all', () => {
    const { state } = start({ enemies: ['rat', 'rat'], deck: Array<string>(10).fill('flutter') });
    const before = state.hand.length;
    const { state: s2, events } = play(state, 'flutter');
    expect(s2.hand.length).toBe(before - 1 + 1); // played card leaves, one card drawn
    const applied = ofType(events, 'statusApplied');
    expect(applied).toHaveLength(1);
    const weakened = s2.enemies.filter((e) => e.statuses.weak > 0);
    expect(weakened).toHaveLength(1);
  });

  it('Drill Worm ignores Block', () => {
    const { state } = start({ enemies: ['rat'], deck: Array<string>(10).fill('drill-worm') });
    const rat = state.enemies[0]!;
    rat.statuses.block = 50;
    const { state: s2 } = play(state, 'drill-worm', rat.uid);
    expect(s2.enemies[0]!.hp).toBe(rat.hp - 3);
    expect(s2.enemies[0]!.statuses.block).toBe(50);
  });

  it('a titled unlock upgrades the whole family, not just the base card', () => {
    const { state } = start({
      unlocks: ['wormillion'],
      deck: ['drill-worm', 'roly-poly', 'roly-poly', 'roly-poly', 'roly-poly'],
    });
    const { state: s2 } = play(state, 'drill-worm', state.enemies[0]!.uid);
    // Drill Worm+ deals 5, not 3.
    expect(state.enemies[0]!.hp - s2.enemies[0]!.hp).toBe(5);
  });
});

describe('general-upgrade mods (spec §6.2)', () => {
  it('Sharpened Mandibles adds +1 to every player damage effect', () => {
    const { state } = start({
      enemies: ['rat'],
      deck: Array<string>(10).fill('wormillion'),
      mods: { attackBonus: 1 },
    });
    const { state: s2 } = play(state, 'wormillion', state.enemies[0]!.uid);
    expect(state.enemies[0]!.hp - s2.enemies[0]!.hp).toBe(5); // 4 base + 1
  });

  it('Solar Panel grants +1 Charge on turn 1 only', () => {
    const { state } = start({ chargePerTurn: 3, mods: { firstTurnCharge: 1 } });
    expect(state.player.charge).toBe(4);
    const s2 = endTurn(state).state;
    expect(s2.player.charge).toBe(3);
  });

  it("Cat's Whisker reduces every Greeble pilfer by 1", () => {
    const { state } = start({
      enemies: ['rat', 'greeble'],
      deck: Array<string>(10).fill('wormillion'),
      chargePerTurn: 9,
      crumbs: 25,
      mods: { pilferReduction: 1 },
    });
    const { state: s2, events } = endTurn(state);
    expect(ofType(events, 'crumbsStolen')[0]).toMatchObject({ amount: 3 });
    expect(s2.crumbs).toBe(22);
  });
});

describe('habitat mods (spec §8.9)', () => {
  it('family attack and Block bonuses apply to that family only', () => {
    const { state } = start({
      deck: ['wormillion', 'chameleon', 'roly-poly', 'roly-poly', 'roly-poly'],
      enemies: ['possum'],
      mods: { familyAttackBonus: { wormillion: 1 }, familyBlockBonus: { 'roly-poly': 2 } },
    });
    const enemy = state.enemies[0]!.uid;
    const worm = state.hand.find((c) => c.def === 'wormillion')!;
    const a = applyAction(state, { type: 'playCard', uid: worm.uid, target: enemy });
    expect(a.events).toContainEqual({
      type: 'damageDealt',
      source: worm.uid,
      target: enemy,
      amount: 5,
      blocked: 0,
    });
    const roly0 = a.state.hand.find((c) => c.def === 'roly-poly')!;
    const a2 = applyAction(a.state, { type: 'playCard', uid: roly0.uid });
    expect(a2.events).toContainEqual({ type: 'blockGained', target: 'player', amount: 7 });
    const a3 = applyAction(a2.state, { type: 'endTurn' });
    const cham = a3.state.hand.find((c) => c.def === 'chameleon')!;
    const b = applyAction(a3.state, { type: 'playCard', uid: cham.uid, target: enemy });
    expect(b.events).toContainEqual({
      type: 'damageDealt',
      source: cham.uid,
      target: enemy,
      amount: 9,
      blocked: 0,
    });
  });

  it('the family refund returns the cost of the first such card each turn', () => {
    const { state } = start({
      deck: ['butterfly', 'butterfly', 'butterfly', 'butterfly', 'butterfly'],
      enemies: ['possum'],
      mods: { familyRefund: 'butterfly' },
    });
    const first = state.hand[0]!;
    const a = applyAction(state, { type: 'playCard', uid: first.uid });
    expect(a.state.player.charge).toBe(3);
    expect(a.events).toContainEqual({ type: 'chargeRefunded', uid: first.uid, amount: 1 });
    const second = a.state.hand[0]!;
    const b = applyAction(a.state, { type: 'playCard', uid: second.uid });
    expect(b.state.player.charge).toBe(2);
    const c = applyAction(b.state, { type: 'endTurn' });
    const third = c.state.hand[0]!;
    const d = applyAction(c.state, { type: 'playCard', uid: third.uid });
    expect(d.state.player.charge).toBe(3);
  });

  it('enemy Poison and Cobweb bonuses reach the player', () => {
    const { state } = start({
      deck: ['roly-poly'],
      enemies: ['scorpion', 'spider'],
      mods: { enemyPoisonBonus: 1, enemyCobwebBonus: 1 },
    });
    const forced = structuredClone(state);
    forced.enemies[0]!.intent = 'sting';
    forced.enemies[1]!.intent = 'spin-web';
    const { state: after, events } = applyAction(forced, { type: 'endTurn' });
    expect(events).toContainEqual({
      type: 'statusApplied',
      target: 'player',
      status: 'poison',
      amount: 4,
    });
    expect(events.filter((e) => e.type === 'cardAdded' && e.def === 'cobweb')).toHaveLength(2);
    expect([...after.draw, ...after.hand].filter((c) => c.def === 'cobweb')).toHaveLength(2);
  });
});

describe('second card wave (spec §5.4)', () => {
  it('Worm Swarm hits once per Wormillion-family card in hand, itself included', () => {
    const { state } = start({
      deck: ['worm-swarm', 'wormillion', 'drill-worm', 'roly-poly', 'chameleon'],
      enemies: ['possum'],
    });
    const enemy = state.enemies[0]!.uid;
    const swarm = state.hand.find((c) => c.def === 'worm-swarm')!;
    const { state: after, events } = applyAction(state, {
      type: 'playCard',
      uid: swarm.uid,
      target: enemy,
    });
    const hits = ofType(events, 'damageDealt');
    expect(hits).toHaveLength(3);
    for (const h of hits) expect(h.amount).toBe(2);
    expect(after.enemies[0]!.hp).toBe(24 - 6);
  });

  it('Scavenge adds crumbs and exhausts', () => {
    const { state } = start({ deck: ['scavenge'], enemies: ['rat'] });
    const card = state.hand[0]!;
    const { state: after, events } = applyAction(state, { type: 'playCard', uid: card.uid });
    expect(after.crumbs).toBe(25 + 5);
    expect(events).toContainEqual({ type: 'crumbsFound', amount: 5 });
    expect(after.exhausted.map((c) => c.uid)).toEqual([card.uid]);
    expect(after.player.charge).toBe(3);
  });

  it('Molt gives 11 Block and exhausts; Stink Cloud poisons every seen enemy', () => {
    const { state } = start({ deck: ['molt', 'stink-cloud'], enemies: ['rat', 'rat', 'greeble'] });
    const molt = state.hand.find((c) => c.def === 'molt')!;
    const a = applyAction(state, { type: 'playCard', uid: molt.uid });
    expect(a.state.player.statuses.block).toBe(11);
    expect(a.state.exhausted).toHaveLength(1);
    const stink = a.state.hand.find((c) => c.def === 'stink-cloud')!;
    const b = applyAction(a.state, { type: 'playCard', uid: stink.uid });
    const poisoned = ofType(b.events, 'statusApplied').filter((e) => e.status === 'poison');
    expect(poisoned).toHaveLength(2); // the Unseen Greeble is passed over
    for (const e of b.state.enemies.filter((e) => e.def === 'rat')) {
      expect(e.statuses.poison).toBe(2);
    }
  });
});

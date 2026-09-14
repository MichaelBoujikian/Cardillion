/**
 * App boot for milestone M2: one fight at a time. Picks a seeded early-trail encounter, wires
 * the engine to the scene and UI, and animates every batch of events in order.
 */
import { CARDS, STARTING_DECK } from '@content/cards';
import { encounterPool, GREEBLE_CHANCE } from '@content/encounters';
import { ENEMIES } from '@content/enemies';
import { cardDef } from '@content/cards';
import { isUnseen } from '@engine/combat';
import { Rng } from '@engine/rng';
import type { CombatState } from '@engine/types';
import { BattleScene } from '@render/battle/scene';
import { loadArt } from '@render/battle/textures';
import { BattleUI } from '@ui/battle-ui';
import * as THREE from 'three';
import { animateEvents } from './animate';
import { Fight } from './fight';

const REFUSALS: Record<string, string> = {
  over: 'The fight is over.',
  unknown: 'That card is gone.',
  unplayable: 'Cobwebs can’t be played — they exhaust at end of turn.',
  charge: 'Not enough Charge.',
  target: 'Drag it onto an enemy.',
  dead: 'That one is already down.',
  unseen: 'Only a Cat can strike the Unseen.',
};

export async function boot(root: HTMLElement): Promise<void> {
  const artIds = [
    ...Object.values(CARDS).map((c) => c.art),
    ...Object.values(ENEMIES).map((e) => e.art),
  ];
  const art = await loadArt(artIds);
  const scene = new BattleScene(root, art);

  let fight: Fight | null = null;
  let prev: CombatState | null = null;
  let busy = false;
  let queue: Promise<void> = Promise.resolve();

  const ui = new BattleUI(root, art, scene, {
    onPlay(uid, target) {
      if (!fight || busy) return;
      const r = fight.play(uid, target);
      if (!r.ok) ui.refuse(uid, REFUSALS[r.reason] ?? r.reason);
    },
    onEndTurn() {
      if (!fight || busy) return;
      fight.endTurn();
    },
    onNewFight() {
      newFight();
    },
    onHold(uid) {
      if (!fight) return;
      const state = fight.current;
      const card = uid ? state.hand.find((c) => c.uid === uid) : undefined;
      const canSeeUnseen = card ? (cardDef(card.def).canTargetUnseen ?? false) : false;
      const forbidden: string[] = [];
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || !isUnseen(enemy)) continue;
        scene.setRevealed(enemy.uid, uid !== null && canSeeUnseen);
        if (card && !canSeeUnseen) forbidden.push(enemy.uid);
      }
      ui.setForbiddenTargets(forbidden);
    },
  });

  function run(state: CombatState, events: Parameters<typeof animateEvents>[0]): Promise<void> {
    return (queue = queue.then(async () => {
      busy = true;
      ui.setInputEnabled(false);
      await animateEvents(events, prev ?? state, state, ui, scene);
      prev = state;
      scene.setEnemies(state.enemies);
      ui.render(state);
      busy = false;
      ui.setInputEnabled(state.phase === 'player');
    }));
  }

  function newFight(seed?: string): void {
    const s = seed ?? Math.floor(Math.random() * 0xffffffff).toString(36);
    const rng = new Rng(s);
    const enc = rng.fork('encounters');
    const enemies = [...enc.pick(encounterPool(1))];
    if (enc.chance(GREEBLE_CHANCE)) enemies.push('greeble');
    // Debug: `?deck=cat,cat,roly-poly` overrides the starting deck (unknown ids are ignored).
    const deckParam = new URLSearchParams(window.location.search).get('deck');
    const deck = deckParam
      ? deckParam
          .split(',')
          .map((d) => d.trim())
          .filter((d) => d in CARDS)
      : [...STARTING_DECK];
    fight = new Fight({
      seed: rng.fork('combat').state,
      deck: deck.length > 0 ? deck : [...STARTING_DECK],
      enemies,
      hp: 60,
      chargePerTurn: 3,
      crumbs: 25,
      unlocks: [],
    });
    prev = null;
    ui.hideOverlay();
    ui.setSeed(s);
    const url = new URL(window.location.href);
    url.searchParams.set('seed', s);
    window.history.replaceState(null, '', url);
    scene.clearEnemies();
    scene.setEnemies(fight.current.enemies);
    ui.render(fight.current);
    fight.subscribe((state, events) => void run(state, events));
    fight.start();
  }

  // Frame loop.
  let w = 1;
  let h = 1;
  const resize = () => {
    w = root.clientWidth || window.innerWidth;
    h = root.clientHeight || window.innerHeight;
    scene.resize(w, h);
  };
  resize();
  window.addEventListener('resize', resize);
  const timer = new THREE.Timer();
  const frame = () => {
    timer.update();
    scene.update(timer.getDelta(), timer.getElapsed());
    scene.render();
    ui.update();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  newFight(new URLSearchParams(window.location.search).get('seed') ?? undefined);
}

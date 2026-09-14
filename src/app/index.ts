/**
 * App boot: loads art, builds the battle scene and the DOM layers, and hands control to a
 * RunController. The title screen starts a run; `?seed=` prefills the seed, and `?deck=` (ids,
 * comma-separated), `?hp=` and `?crumbs=` override the start of a run for testing.
 */
import { CARDS } from '@content/cards';
import { ENEMIES } from '@content/enemies';
import type { RunOptions } from '@engine/run';
import { BattleScene } from '@render/battle/scene';
import { loadArt } from '@render/battle/textures';
import { BattleUI } from '@ui/battle-ui';
import { CardFaces } from '@ui/card-faces';
import { RunScreens } from '@ui/run-screens';
import * as THREE from 'three';
import { RunController } from './run-controller';

const EXTRA_ART = ['npc-snail', 'bg-map', 'bg-battle', 'enemy-possum-dead'];

function debugOptions(): RunOptions {
  const params = new URLSearchParams(window.location.search);
  const deck = params.get('deck');
  const options: RunOptions = {};
  if (deck) {
    const ids = deck
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d in CARDS);
    if (ids.length > 0) options.deck = ids;
  }
  const hp = Number(params.get('hp'));
  if (Number.isFinite(hp) && hp > 0) options.hp = hp;
  const crumbs = Number(params.get('crumbs'));
  if (Number.isFinite(crumbs) && crumbs >= 0 && params.has('crumbs')) options.crumbs = crumbs;
  return options;
}

function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}

export async function boot(root: HTMLElement): Promise<void> {
  const artIds = [
    ...Object.values(CARDS).map((c) => c.art),
    ...Object.values(ENEMIES).map((e) => e.art),
    ...EXTRA_ART,
  ];
  const art = await loadArt(artIds);
  const scene = new BattleScene(root, art);
  const faces = new CardFaces(art);

  // The controller is created after the layers whose handlers call into it.
  // eslint-disable-next-line prefer-const -- assigned once the layers exist (a two-way binding)
  let controller!: RunController;

  const battle = new BattleUI(root, faces, scene, {
    onPlay: (uid, target) => controller.play(uid, target),
    onEndTurn: () => controller.endTurn(),
    onContinue: () => controller.continueFromBattle(),
    onHold: (uid) => controller.hold(uid),
  });

  const screens = new RunScreens(root, faces, art, {
    onNewRun(seed) {
      const s = seed ?? randomSeed();
      const url = new URL(window.location.href);
      url.searchParams.set('seed', s);
      window.history.replaceState(null, '', url);
      controller.newRun(s, debugOptions());
    },
    onTravel: (to) => controller.dispatch({ type: 'travel', to }),
    onTakeReward: (card) => controller.dispatch({ type: 'takeReward', card }),
    onBuy: (index) => controller.dispatch({ type: 'buyCard', index }),
    onRemove: (uid) => controller.dispatch({ type: 'removeCard', uid }),
    onRest: () => controller.dispatch({ type: 'rest' }),
    onLeave: () => controller.dispatch({ type: 'leave' }),
    onBackToTitle() {
      battle.hide();
      screens.showTitle(null);
    },
  });

  controller = new RunController(scene, battle, screens);
  battle.hide();
  screens.showTitle(new URLSearchParams(window.location.search).get('seed'));
  if (import.meta.env.DEV) installDevHooks(controller, screens);

  // Frame loop: the scene always renders (it is the backdrop of every screen).
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
    battle.update();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Dev-only console helpers (`window.__cardillion`): `autoFight()` plays the current fight with
 * the first affordable attack each step, `autoRun(stopAt?)` walks the map, skipping rewards and
 * stops, until victory, death or a node of the given type. For verification, not for play.
 */
function installDevHooks(controller: RunController, screens: RunScreens): void {
  const step = (): boolean => {
    const run = controller.current;
    if (!run || controller.isBusy) return true;
    if (run.phase === 'fight' && run.combat) {
      const c = run.combat;
      const target = c.enemies.find((e) => e.hp > 0 && !ENEMIES[e.def]?.traits.includes('unseen'));
      const card = c.hand.find((k) => {
        const def = CARDS[k.def];
        return def && def.type === 'attack' && def.base.cost <= c.player.charge;
      });
      if (card && target) controller.play(card.uid, target.uid);
      else controller.endTurn();
      return true;
    }
    return false;
  };
  const hooks = {
    controller,
    screens,
    autoFight(): void {
      const timer = window.setInterval(() => {
        if (!step()) window.clearInterval(timer);
      }, 250);
    },
    autoRun(stopAt?: string): Promise<string> {
      return new Promise((resolve) => {
        const timer = window.setInterval(() => {
          const run = controller.current;
          if (!run || controller.isBusy) return;
          if (step()) return;
          const overlay = document.querySelector<HTMLElement>('.bui .overlay.on .again');
          if (overlay) {
            overlay.click();
            return;
          }
          if (run.phase === 'victory' || run.phase === 'death') {
            window.clearInterval(timer);
            resolve(run.phase);
            return;
          }
          if (stopAt && run.phase === stopAt) {
            window.clearInterval(timer);
            resolve(run.phase);
            return;
          }
          if (run.phase === 'reward') controller.dispatch({ type: 'takeReward', card: null });
          else if (run.phase === 'shop' || run.phase === 'cocoon')
            controller.dispatch({ type: 'leave' });
          else if (run.phase === 'map') {
            const next = run.map.nodes[run.position]?.next[0];
            if (next) controller.dispatch({ type: 'travel', to: next.id });
          }
        }, 250);
      });
    },
  };
  (window as unknown as { __cardillion: typeof hooks }).__cardillion = hooks;
}

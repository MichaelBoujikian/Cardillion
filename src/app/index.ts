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
import { clearSave, readSave, writeSave } from '@save/save';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type Settings } from '@save/settings';
import { MemoryStore, type KeyValueStore } from '@save/store';
import { BattleUI } from '@ui/battle-ui';
import { CardFaces } from '@ui/card-faces';
import { RunScreens, type TitleOptions } from '@ui/run-screens';
import * as THREE from 'three';
import { RunController } from './run-controller';

const EXTRA_ART = ['npc-snail', 'bg-map', 'bg-battle', 'bg-shop', 'bg-cocoon'];

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

/** localStorage when the browser allows it; otherwise the game runs with a session-only store. */
function storage(): KeyValueStore {
  try {
    const probe = '__cardillion_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStore();
  }
}

const NOTICES = {
  outdated: 'A save from an older version was found and set aside.',
  corrupt: 'A saved run could not be read and was set aside.',
} as const;

export async function boot(root: HTMLElement): Promise<void> {
  const artIds = [
    ...Object.values(CARDS).flatMap((c) => (c.upgradedArt ? [c.art, c.upgradedArt] : [c.art])),
    ...Object.values(ENEMIES).flatMap((e) => (e.deadArt ? [e.art, e.deadArt] : [e.art])),
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

  // Persistence (spec §10): one autosave slot and the settings, both in localStorage.
  const store = storage();
  let settings: Settings = readSettings(store);
  const applySettings = () => {
    scene.setMotion(settings);
    battle.setReduceMotion(settings.reduceMotion);
  };
  /** The title, with CONTINUE when a valid save exists and a notice when one was set aside. */
  // (`screens` is assigned just below; both closures run only after boot has finished.)
  const showTitle = (seedHint: string | null) => {
    const saved = readSave(store);
    const opts: TitleOptions = { canContinue: saved.ok };
    if (!saved.ok && saved.reason !== 'none') opts.notice = NOTICES[saved.reason];
    battle.hide();
    screens.showTitle(seedHint, opts);
  };

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
    onBuyUnlock: (index) => controller.dispatch({ type: 'buyUnlock', index }),
    onBuyUpgrade: (index) => controller.dispatch({ type: 'buyUpgrade', index }),
    onBuyWormillionaire: () => controller.dispatch({ type: 'buyWormillionaire' }),
    onRest: () => controller.dispatch({ type: 'rest' }),
    onForage: () => controller.dispatch({ type: 'forage' }),
    onPupate: (uid) => controller.dispatch({ type: 'pupate', uid }),
    onLeave: () => controller.dispatch({ type: 'leave' }),
    onBackToTitle: () => showTitle(null),
    onContinue() {
      const saved = readSave(store);
      if (saved.ok) controller.resume(saved.run);
      else showTitle(null);
    },
    onOpenSettings() {
      const run = controller.current;
      const inRun = run !== null && run.phase !== 'victory' && run.phase !== 'death';
      screens.showSettings({ settings, seed: run?.seed ?? null, inRun });
    },
    onSettingsChanged(next) {
      settings = next;
      writeSettings(store, settings);
      applySettings();
    },
    onFullscreen() {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    },
    onAbandon() {
      controller.abandon();
      showTitle(null);
    },
    onResetSave() {
      clearSave(store);
      settings = { ...DEFAULT_SETTINGS };
      writeSettings(store, settings);
      applySettings();
      controller.abandon();
      showTitle(null);
    },
  });

  controller = new RunController(scene, battle, screens, {
    write: (run) => writeSave(store, run),
    clear: () => clearSave(store),
  });
  applySettings();
  showTitle(new URLSearchParams(window.location.search).get('seed'));
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

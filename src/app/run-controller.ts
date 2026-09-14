/**
 * Drives one run: applies actions to the run reducer, animates the fight events through the
 * battle scene/UI, and shows the screen for whatever phase the run is in.
 */
import { cardDef } from '@content/cards';
import { enemyDef } from '@content/enemies';
import { IllegalAction, canPlay } from '@engine/combat';
import {
  applyRunAction,
  createRun,
  IllegalRunAction,
  type RunAction,
  type RunEvent,
  type RunOptions,
  type RunState,
} from '@engine/run';
import type { CombatState } from '@engine/types';
import type { BattleScene } from '@render/battle/scene';
import type { BattleUI } from '@ui/battle-ui';
import type { RunScreens } from '@ui/run-screens';
import { animateEvents } from './animate';

const REFUSALS: Record<string, string> = {
  over: 'The fight is over.',
  unknown: 'That card is gone.',
  unplayable: 'Cobwebs can’t be played — they exhaust at end of turn.',
  charge: 'Not enough Charge.',
  target: 'Drag it onto an enemy.',
  dead: 'That one is already down.',
  unseen: 'Only a Cat can strike the Unseen.',
};

export class RunController {
  private run: RunState | null = null;
  private busy = false;
  private queue: Promise<void> = Promise.resolve();
  /** A fight just ended: the battle overlay is up and waits for the player's click. */
  private awaitingContinue = false;

  constructor(
    private readonly scene: BattleScene,
    private readonly battle: BattleUI,
    private readonly screens: RunScreens,
  ) {}

  get current(): RunState | null {
    return this.run;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  newRun(seed: string, options: RunOptions = {}): void {
    this.run = createRun(seed, options);
    this.awaitingContinue = false;
    this.battle.hide();
    this.battle.setSeed(seed);
    this.render();
  }

  /** Play a card from the battle UI; refusals are shown, never thrown. */
  play(uid: string, target?: string): void {
    const combat = this.run?.combat;
    if (!combat || this.busy) return;
    const check = canPlay(combat, uid, target);
    if (!check.ok) {
      this.battle.refuse(uid, REFUSALS[check.reason] ?? check.reason);
      return;
    }
    this.dispatch({
      type: 'combat',
      action: target ? { type: 'playCard', uid, target } : { type: 'playCard', uid },
    });
  }

  endTurn(): void {
    if (!this.run?.combat || this.busy) return;
    this.dispatch({ type: 'combat', action: { type: 'endTurn' } });
  }

  /** A card is held in the hand: reveal Unseen enemies to a Cat, mark forbidden targets otherwise. */
  hold(uid: string | null): void {
    const combat = this.run?.combat;
    if (!combat) return;
    const card = uid ? combat.hand.find((c) => c.uid === uid) : undefined;
    const seesUnseen = card ? cardSeesUnseen(card.def) : false;
    const forbidden: string[] = [];
    for (const enemy of combat.enemies) {
      if (enemy.hp <= 0) continue;
      if (!isUnseenDef(enemy.def)) continue;
      this.scene.setRevealed(enemy.uid, uid !== null && seesUnseen);
      if (card && !seesUnseen) forbidden.push(enemy.uid);
    }
    this.battle.setForbiddenTargets(forbidden);
  }

  continueFromBattle(): void {
    if (!this.awaitingContinue) return;
    this.awaitingContinue = false;
    this.battle.hideOverlay();
    this.render();
  }

  dispatch(action: RunAction): void {
    if (!this.run || this.busy) return;
    let step;
    try {
      step = applyRunAction(this.run, action);
    } catch (err) {
      if (err instanceof IllegalRunAction || err instanceof IllegalAction) {
        console.warn('[run] refused:', err.message);
        return;
      }
      throw err;
    }
    const prev = this.run;
    this.run = step.run;
    this.queue = this.queue.then(() => this.play_(prev, step.run, step.events));
  }

  private async play_(prev: RunState, next: RunState, events: RunEvent[]): Promise<void> {
    this.busy = true;
    this.battle.setInputEnabled(false);
    let before: CombatState | null = prev.combat;
    for (const ev of events) {
      switch (ev.type) {
        case 'fightStarted': {
          const combat = next.combat ?? next.lastCombat;
          if (!combat) break;
          this.screens.hideAll();
          this.scene.clearEnemies();
          this.scene.setEnemies(combat.enemies);
          this.battle.hideOverlay();
          this.battle.show();
          this.battle.render(combat);
          before = null;
          break;
        }
        case 'combat': {
          const after = next.combat ?? next.lastCombat;
          if (!after) break;
          await animateEvents(ev.events, before ?? after, after, this.battle, this.scene);
          before = after;
          this.scene.setEnemies(after.enemies);
          this.battle.render(after);
          break;
        }
        case 'fightWon':
        case 'runLost':
          // The animator has put the battle overlay up; the player's click continues.
          this.awaitingContinue = true;
          break;
        default:
          break;
      }
    }
    this.busy = false;
    this.battle.setInputEnabled(next.phase === 'fight' && next.combat?.phase === 'player');
    this.render();
  }

  /** Show whatever the run's phase calls for. */
  private render(): void {
    const run = this.run;
    if (!run || this.awaitingContinue) return;
    switch (run.phase) {
      case 'map':
        this.battle.hide();
        this.screens.showMap(run);
        break;
      case 'fight':
        this.screens.hideAll();
        this.battle.show();
        break;
      case 'reward':
        this.battle.hide();
        this.screens.showReward(run);
        break;
      case 'shop':
        this.battle.hide();
        this.screens.showShop(run);
        break;
      case 'cocoon':
        this.battle.hide();
        this.screens.showCocoon(run);
        break;
      case 'victory':
      case 'death':
        this.battle.hide();
        this.screens.showResult(run, run.phase);
        break;
    }
  }
}

function cardSeesUnseen(def: string): boolean {
  return cardDef(def).canTargetUnseen ?? false;
}

function isUnseenDef(def: string): boolean {
  return enemyDef(def).traits.includes('unseen');
}

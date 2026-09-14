/**
 * Fight controller: owns one CombatState, forwards actions to the engine and hands each
 * resulting (state, events) pair to subscribers. Illegal actions never throw out of here —
 * the UI asks `check` first and shows why.
 */
import {
  applyAction,
  canPlay,
  createCombat,
  type CombatSetup,
  type PlayCheck,
} from '@engine/combat';
import type { CombatAction, CombatEvent, CombatState } from '@engine/types';

export type FightListener = (state: CombatState, events: CombatEvent[]) => void;

export class Fight {
  private state: CombatState;
  private readonly initialEvents: CombatEvent[];
  private readonly listeners = new Set<FightListener>();

  constructor(setup: CombatSetup) {
    const { state, events } = createCombat(setup);
    this.state = state;
    this.initialEvents = events;
  }

  get current(): CombatState {
    return this.state;
  }

  subscribe(listener: FightListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Replays the opening events (intents, first draw) to subscribers. Call once after subscribing. */
  start(): void {
    this.emit(this.initialEvents);
  }

  check(uid: string, target?: string): PlayCheck {
    return canPlay(this.state, uid, target);
  }

  play(uid: string, target?: string): PlayCheck {
    const check = this.check(uid, target);
    if (!check.ok) return check;
    this.dispatch(target ? { type: 'playCard', uid, target } : { type: 'playCard', uid });
    return check;
  }

  endTurn(): boolean {
    if (this.state.phase !== 'player') return false;
    this.dispatch({ type: 'endTurn' });
    return true;
  }

  private dispatch(action: CombatAction): void {
    const { state, events } = applyAction(this.state, action);
    this.state = state;
    this.emit(events);
  }

  private emit(events: CombatEvent[]): void {
    for (const l of this.listeners) l(this.state, events);
  }
}

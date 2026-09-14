/**
 * Rules engine - pure TypeScript, no DOM, no three.js.
 *
 * Everything that decides *what happens* lives here: combat resolution, deck operations,
 * map generation, run state, rewards, upgrades. Rendering and UI only *display* engine
 * state and dispatch actions into it. See spec.md (Tech architecture) and CLAUDE.md.
 */
export { Rng, hashSeed } from './rng';
export type { RngState } from './rng';

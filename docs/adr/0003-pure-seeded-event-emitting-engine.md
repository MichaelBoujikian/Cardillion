# The rules engine is a pure, seeded reducer that emits events; rendering only animates

Game developers often let the scene graph own game state. We deliberately do the opposite:
`src/engine` is plain TypeScript with no DOM or three.js imports (ESLint enforces it),
`applyAction(state, action) → { state, events }` (the RNG state is carried inside the state —
`src/engine/combat.ts:171`, `types.ts:225` — so there is no separate `rng` argument), and all
randomness comes from seeded, forkable `Rng` streams. The renderer animates from the emitted
events and never mutates state.

Why: agents build this game test-first, so every rule must be checkable in Node in milliseconds;
seeded determinism makes bugs reproducible from a seed and makes save/resume a matter of
serialising one object; and keeping rendering out of the rules is what makes the Godot fallback
(ADR 0001) cheap — the engine would port unchanged.

## Consequences

- Content (cards, enemies, upgrades) is data in `src/content`, interpreted by the engine, so
  adding content is adding rows.
- The renderer must never derive "what happened" by diffing state; if an animation needs
  information, the engine emits an event carrying it.

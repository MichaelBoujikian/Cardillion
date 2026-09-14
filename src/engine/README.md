# `src/engine` - rules engine

Pure TypeScript. No imports from `three`, the DOM, `@render`, `@ui`, `@app`, or `@save`
(ESLint enforces this). Every function is deterministic given its inputs and an `Rng`.

- State in, action in, new state + events out. The renderer animates from events.
- All randomness comes from `Rng` (`rng.ts`), never `Math.random()`.
- Tests live beside the code as `*.test.ts` and run in Node (`npm test`).

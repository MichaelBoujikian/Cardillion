# Cardillion

Card-battler roguelike: cyborg garden bugs vs. creepy vermin. Web, TypeScript, three.js.

`spec.md` is the source of truth for every rule and number. Read the relevant section before
implementing a mechanic; when a number or rule changes, edit `spec.md` first (and its tuning
log), then the code. `docs/adr/` records why the architecture is the way it is — read the
matching ADR before changing an architectural choice, and add one when you make a new choice.

## Layering (enforced by ESLint)

```
engine ← content        pure rules + data. No DOM, no three.js, no Math.random().
render, ui, save        display engine state / persist it. Never mutate it.
app                     wires everything; the only layer that imports all others.
prototype               throwaway. Nothing in the game imports it.
```

Each `src/<layer>/README.md` states that layer's responsibility. The engine is a reducer:
`applyAction(state, action, rng) → { state, events }`. State is plain JSON. The renderer
animates from **events**, never by diffing state. Randomness comes only from `Rng`
(`src/engine/rng.ts`), forked per stream (`map`, `combat`, `rewards`, …) so runs are
**seeded**: same seed, same run.

## Working here

- **Engine and content are test-first.** Write the Vitest test beside the code (`*.test.ts`),
  watch it fail, then implement. Determinism tests replay a seed and compare event logs.
- **Content is data.** Cards, enemies, upgrades and encounters are typed tables in
  `src/content` with stable string ids; the engine interprets them. Adding content means adding
  a row, not a branch.
- **Art is keyed by id.** The loader tries `assets/art/<id>.png` and falls back to a generated
  `assets/placeholders/<id>.svg`, so the game always runs without generated art. Prompts live in
  `art/manifest.json`; `docs/art-pipeline.md` covers generation — reach for it only when
  generating or approving art.
- **Done means `npm run check` passes** (typecheck, lint, format, tests, build). CI runs the
  same on every push.
- Commit straight to `main` with small, single-purpose commits during pre-alpha.
- Two-world presentation is the identity: Garden (near, warm, painterly) fading into Thicket
  (far, dark, grainy). Every screen keeps that gradient legible. Keep enemies menacing, never gory.

## Verifying visuals

Run the dev server with the `dev` launch config and look at it in the browser pane; screenshot
before and after a visual change. Render and UI have no unit tests — the screenshot is the test.

## Current milestone

M1–M4 are done (2026-09-15). Next is **M5 systems** — save/resume, seeds, settings — see
`spec.md` §13 and §10. Engine: `combat.ts` (fight reducer, `CombatMods` for upgrade effects),
`map.ts`, `run.ts` (run reducer: shops, upgrades, the two map markers). Screens live in
`src/ui/run-screens.ts`; `src/app/run-controller.ts` sequences events into animations. In dev,
`window.__cardillion.autoRun()` / `autoFight()` play the game from the console, and
`?seed= ?deck= ?hp= ?crumbs=` override a run's start.

Tool note: the Bash tool truncates commands past roughly 8 KB (the failure looks like an
unterminated quote). Write large files with the Write tool; keep heredocs small.

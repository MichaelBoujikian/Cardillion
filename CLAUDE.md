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

M1 (look prototype) passed the owner's review on 2026-09-13; web + three.js is settled. Next is
**M2, the first playable fight** — see `spec.md` §13 for its done-criteria. The art pipeline is
live (`docs/art-pipeline.md`); generated PNGs in `assets/art/` are committed only after the
owner approves them, and `art/out/` holds raw renders and rejected versions.

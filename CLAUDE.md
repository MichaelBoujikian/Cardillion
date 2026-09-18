# Cardillion

Card-battler roguelike: cyborg garden bugs vs. creepy vermin. Web, TypeScript, three.js.

`spec.md` is the source of truth for every rule and number. Read the relevant section before
implementing a mechanic; when a number or rule changes, edit `spec.md` first (and its tuning
log), then the code. `docs/adr/` records why the architecture is the way it is — read the
matching ADR before changing an architectural choice, and add one when you make a new choice.

## Layering

```
engine ← content        pure rules + data. No DOM, no three.js, no Math.random().
render, ui, save        display engine state / persist it. Never mutate it.
app                     wires everything; the only layer that imports all others.
prototype               throwaway. Nothing in the game imports it.
```

ESLint enforces the engine/content restrictions (`eslint.config.js`); the other layers are held
to this by convention only.

Each `src/<layer>/README.md` states that layer's responsibility. The engine is a reducer:
`applyAction(state, action) → { state, events }`; the RNG state rides inside the state. State is
plain JSON. The renderer animates from **events**, never by diffing state. Randomness comes only
from `Rng` (`src/engine/rng.ts`). A run forks one stream each for `map` (which forks
`habitats`), `markers`, `encounters`, `rewards` and `shop`; each fight is seeded from the string
`<seed>:combat:<node id>` rather than forked. So runs are **seeded**: same seed, same run.

## Working here

- **Engine and content are test-first.** Write the Vitest test beside the code (`*.test.ts`),
  watch it fail, then implement. Determinism tests replay a seed's action list and compare the
  resulting state.
- **Content is data.** Cards, enemies, upgrades and encounters are typed tables in
  `src/content` with stable string ids; the engine interprets them. Adding content means adding
  a row, not a branch.
- **Art is keyed by id.** The game loads `public/art/<id>.webp`, which `npm run art:optimize`
  writes from the PNG masters in `assets/art`; a missing id falls back to a placeholder drawn in
  code (`makeVerminPlaceholder` in `src/render/battle/textures.ts`), so the game always runs
  without generated art. Prompts live in `art/manifest.json`; `docs/art-pipeline.md` covers
  generation, and `docs/local-video.md` / `docs/local-image.md` cover the owner's local ComfyUI
  rig — reach for them only when generating or approving art.
- Never `git add -A` — unapproved art sits uncommitted in `assets/art` and `public/art`.
- **Done means `npm run check` passes** (typecheck, lint, format, tests, build). CI runs the
  same on every push.
- Commit straight to `main` with small, single-purpose commits during pre-alpha.
- Two-world presentation is the identity: Garden (near, warm, painterly) fading into Thicket
  (far, dark, grainy). Every screen keeps that gradient legible. Enemies are menacing, gross and gory (spec §11.1).

## Verifying visuals

Run the dev server with the `dev` launch config and look at it in the browser pane; screenshot
before and after a visual change. Render and UI have no unit tests — the screenshot is the test.

## Current milestone

**New to this repo? Read `HANDOFF.md` first** — where things stand, how the owner works, the
tool gotchas, and what to build next.

M1–M6 are done (M5 systems and M6 v1 art on 2026-09-16). Current work is the **enemy art
pass** — every vermin redone as a mutant with a clip-driven waiting state (spec §11.2,
`docs/art-pipeline.md` "The recipe"); the rat is the worked example, and its art + content row
are uncommitted pending the owner's approval. Engine: `combat.ts` (fight reducer, `CombatMods`
for upgrade effects), `map.ts`, `run.ts` (run reducer: shops, upgrades, the two map markers).
Screens live in `src/ui/run-screens.ts`; `src/app/run-controller.ts` sequences events into
animations. In dev, `window.__cardillion.autoRun()` / `autoFight()` play the game from the
console, and `?seed= ?deck= ?hp= ?crumbs=` override a run's start. Art scripts: `npm run art`,
`art:poses`, `art:video`, `art:optimize`, `video:local`, `image:local`.

Tool note: the Bash tool truncates commands past roughly 8 KB (the failure looks like an
unterminated quote). Write large files with the Write tool; keep heredocs small.

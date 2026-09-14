# Cardillion

A card-battler roguelike. Cheerful cyborg garden bugs versus the creepy vermin creeping in from
the woods. Slay-the-Spire bones, an Inscryption-dark far side, a sunlit Diceomancer-bright near
side, and a worm called Wormillion.

- **Design:** [`spec.md`](spec.md) — rules, numbers, content, milestones.
- **Vocabulary:** [`CONTEXT.md`](CONTEXT.md).
- **Why it's built this way:** [`docs/adr/`](docs/adr/).
- **For agents working in this repo:** [`CLAUDE.md`](CLAUDE.md).

## Run it

```bash
npm install
npm run dev
```

`npm run check` runs typecheck, lint, format check, tests and a production build — the same
thing CI runs.

## Status

- **M1 look prototype: passed.** Web + three.js is the engine (ADR 0001).
- **M2 first playable fight: done.** Drag a card onto an enemy (or click the card, then the
  enemy), End Turn, win or lose.
- **M3 run loop: done.** Title → a seeded map of three signposted trails with fog → fights,
  rewards, the Snail's stall (cards and removal), cocoons → the Bear → victory or death.
  `npm run dev` and press New Run. Test overrides: `?seed=`, `?deck=cat,cat`, `?hp=`,
  `?crumbs=`; in dev, `window.__cardillion.autoRun()` plays a run out from the console.
- **Art**: the full v1 roster is generated and approved (`assets/art/`).
- **Next: M4 content** — card families, titled unlocks, general upgrades, Wormillionaire,
  the roaming Greeble and the wandering Snail.

## Licence

Private, all rights reserved (for now).

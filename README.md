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
- **M2 first playable fight: done.** `npm run dev` starts a seeded early-trail fight:
  drag a card onto an enemy (or click the card, then the enemy), End Turn, win or lose, New
  Fight. `?seed=abc` fixes the encounter; `?deck=cat,cat,roly-poly` overrides the deck for
  testing. Engine rules are fully tested (`npm test`).
- **Art pipeline is live**; generated PNGs land in `assets/art/` and are picked up automatically.

## Licence

Private, all rights reserved (for now).

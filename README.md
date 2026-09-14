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

Milestone **M1 — look prototype** built and awaiting the owner's review; it decides whether web + three.js
hits the visual bar (see ADR 0001). `npm run dev` shows it; `?t=0.95` freezes the card mid-flight.

## Licence

Private, all rights reserved (for now).

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

- **M1 look prototype: passed.** Web + three.js is the engine (ADR 0001). `npm run dev` shows the
  battle table; `?t=0.95` freezes the card mid-flight.
- **Art pipeline is live.** `OPENAI_API_KEY` is set in the owner's local `.env`. Style anchors
  and the first two assets (`card-wormillion`, `enemy-rat`) are generated and sit in
  `assets/art/` **uncommitted, awaiting the owner's approval** — see `docs/art-pipeline.md`.
- **Next:** M2, the first playable fight (engine, test-first), and/or the remaining art batch on
  the approved anchors.

## Licence

Private, all rights reserved (for now).

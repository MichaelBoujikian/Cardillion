# `src/content` - game data

Typed data tables: cards, upgraded forms, titled unlocks, general upgrades, enemies, encounter
tables, habitats, the pupation table (`PUPATION`), trail flavours (`trails.ts`). No logic
beyond simple lookups. The engine interprets this data. Same import restrictions as
`src/engine` (no three.js, no DOM). The card and enemy row types (`CardDef`, `EnemyDef`) live
in `src/engine/types.ts`, so a new field on one of those rows is an engine-types change; the
upgrade, habitat, trail and encounter rows are typed beside their tables.

Every content entry has a stable string `id`; art assets are keyed by that id
(see `art/manifest.json` and `docs/art-pipeline.md`).

# `src/content` - game data

Typed data tables: cards, upgraded forms, titled unlocks, general upgrades, enemies, encounter
tables, route flavours. No logic beyond simple lookups. The engine interprets this data.
Same import restrictions as `src/engine` (no three.js, no DOM).

Every content entry has a stable string `id`; art assets are keyed by that id
(see `art/manifest.json` and `docs/art-pipeline.md`).

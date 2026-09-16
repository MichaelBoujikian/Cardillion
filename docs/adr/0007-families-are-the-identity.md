# Families are the game's identity: systems act on a bug's family, not on single cards

Cardillion's cards were always grouped by bug (ADR 0005 upgrades a whole family at once), and
every family card now has its own art showing the same bug in a different act. The owner
named this as the distinctive idea he was looking for: "different types of cards all share the
same family type". So from here, new mechanics are built to act on **families**:

- **Habitats** (spec §8.9) favour a family per fight node: worms on damp soil, butterflies in
  flowers, chameleons on dry stone, cats in a crevice.
- **Metamorphosis** (spec §8.8) moves a card _between_ families: Caterpillar → Chrysalis →
  Butterfly, with the family cards mapped pairwise (Munch → Flutter).
- **Swarm** cards scale with how many of their family are in hand.
- The type line names the family on every card, and the titled unlocks are the family's
  "gentleman".

Consequences:

- A card's `bug` is a first-class key. Engine rules that vary by family read
  `CombatMods.family*` maps keyed by `BugId`; content never branches on a card id.
- Per-card exceptions stay out (ADR 0005 already bans per-copy upgrades). If a mechanic wants to
  single out one card, it is usually a family mechanic in disguise.
- Content growth means adding a family member (a row with a `bug`), not a new subsystem.

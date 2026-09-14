# Upgrades apply to a whole bug type, never to a single card copy

Slay the Spire upgrades cards one copy at a time. Cardillion instead sells a **titled unlock**
per bug (Mr. Wormsley, Sir Reginald V, …) that upgrades every current and future copy of that
bug for the run, and items like Wormillionaire inject already-upgraded copies. This is the
owner's distinctive mechanic and it simplifies the data model: upgrade state lives on the run
(a set of unlocked bug ids) plus a per-card-instance `upgraded` flag for injected copies, not on
each card's history. Per-copy upgrading is deliberately out; do not add it as a "convenience".

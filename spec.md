# Cardillion — Game Specification

**Status:** v1 design, agreed 2026-09-13. **Build target:** the "v1" scope in this document.
Numbers marked _(tuning)_ are first guesses — change them freely, but change them here first.
Anything under **Roadmap** is explicitly _not_ v1.

Decisions that shaped this spec and the reasoning behind them live in `docs/adr/`.

---

## 1. Vision

**Cardillion** is a single-player card-battler roguelike. You hold a deck of cheerful cyborg
garden bugs and use them to fight the creepy vermin creeping in from the woods. Runs are short,
seeded, and permadeath: die and you start over with a fresh map.

The game lives in the tension between two worlds sharing one screen:

- **The Garden** (near, bright, yours) — Diceomancer-warm: painterly, sunlit, cute.
  Your bugs are cyborgs — brass gears, glass lenses, springs — and they are happy about it.
- **The Thicket** (far, dark, theirs) — Inscryption-dark: grainy, desaturated, wrong.
  Rats, possums, spiders, scorpions, and worse. Menace, no gore. ~T rating.

The battle screen is staged with **depth**: your hand and your bugs live in the sunlit
foreground; the enemies stand in the fog at the back; the scene fades from one world into the
other across the table.

### Premise _(placeholder — rewrite freely)_

> A tinkerer's garden. Something in the woods past the fence has been sending the vermin in.
> The tinkerer rebuilt the garden's bugs from scrap and springs to push it back.
> You hold the deck.

### Pillars

1. **Slay the Spire bones.** Energy, hand, deck, intents, a branching map. Proven loop; no
   experimentation there.
2. **Two-world presentation.** The gradient from garden to thicket _is_ the game's identity.
   It must read in every screen.
3. **Unique where it's cheap.** Sun-powered Charge, Greebles only Cats can see, a snail that
   carries the shop, titled upgrades like _Mr. Wormsley_. Small twists on a solid base.
4. **Built for iteration by agents.** Pure rules engine, seeded determinism, data-driven
   content, a fixed art contract so pictures can be swapped without code changes.

---

## 2. Glossary

The canonical vocabulary lives in [`CONTEXT.md`](CONTEXT.md) — one definition per term, with
the words to avoid. This document uses those terms exactly.

---

## 3. Screen flow

```
Title ──► New Run ──► Map ──► [Fight | Elite | Shop | Cocoon] ──► (Reward) ──► Map ──► … ──► Boss ──► Victory ──► Title
  │                                                                                          └──► Death ──► Title
  └──► Continue (if a save exists)
  └──► Settings
```

- **Title:** New Run, Continue (only if a save exists), Settings, run seed entry (optional).
- **Map:** the garden trails, your position, fog, signposts, the roaming Greeble marker (if you
  own a Cat), the Snail marker. Tap a reachable node to travel.
- **Fight / Elite / Boss:** the battle screen (§4).
- **Reward:** crumbs, then pick 1 of 3 cards (skip allowed). Elites add a choice of 1 of 2
  general upgrades.
- **Shop:** stock in §9. Leaving is free.
- **Cocoon:** choose one of Rest, Forage or Pupate (§8.8), or leave.
- **Victory / Death:** stats (turns, damage, crumbs, cards), seed shown with copy button, back
  to Title. The save is deleted either way.

Desktop landscape (16:9) is the design target; layout scales. Touch is roadmap.

---

## 4. Combat rules

Slay the Spire model. One player (no avatar — hits land on the screen), 1–3 enemies.

### 4.1 Turn structure

1. **Start of your turn:** Block resets to 0. Gain 3 Charge _(tuning)_. Draw 5 cards.
   Poison on you ticks (see 4.5).
2. **Your turn:** play any number of cards you can afford. Drag a card onto an enemy for a
   targeted card; drag it upward (anywhere above the hand) for untargeted. Click-card-then-
   click-target also works.
3. **End turn:** discard your whole hand (Cobwebs exhaust instead). Unspent Charge is lost.
4. **Enemy turn:** left to right, each enemy: Poison ticks, then it performs its shown intent,
   then rolls its next intent. Weak on enemies decrements at the end of their turn.
5. Repeat until all _seen_ enemies are dead (win) or your HP ≤ 0 (death).

### 4.2 Resources

| Resource | Start | Notes                                                                 |
| -------- | ----- | --------------------------------------------------------------------- |
| HP       | 60    | _(tuning)_ Max HP can be raised by general upgrades.                  |
| Charge   | 3/trn | Sun icon. Lost at end of turn. Mr. Wormsley makes Wormillions cost 0. |
| Hand     | 5     | Max 10; extra draws are discarded.                                    |
| Crumbs   | 25    | _(tuning)_ Starting purse.                                            |

### 4.3 Deck

Draw pile → hand → discard pile; when the draw pile is empty, shuffle the discard into it.
**Exhaust**: some cards (and all Cobwebs) leave the fight instead of going to discard.
Combat starts with the deck shuffled by the fight's RNG stream.

### 4.4 Damage

`damage = (base + flat bonuses) × (Weak on attacker ? 0.75 : 1)`, rounded down, then applied
to Block first, then HP. Poison ignores Block.

### 4.5 Status effects (v1)

| Status     | On whom | Effect                                                                                        |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| **Block**  | anyone  | Absorbs damage before HP. Resets at the start of the owner's turn.                            |
| **Poison** | anyone  | At the start of the owner's turn, take Poison damage (ignores Block), then Poison −1.         |
| **Weak**   | anyone  | Attacks deal 25% less. −1 at the end of the owner's turn.                                     |
| **Cobweb** | you     | A status _card_ shuffled into your draw pile. Unplayable. Exhausts at end of turn if in hand. |

Enemy traits (not statuses): **Unseen** (§7.2), **Play Dead** (Possum).

### 4.6 Intents

Every enemy shows its next action above its head: an icon plus a number (e.g. ⚔ 6, ⚔ 2×2,
🛡 8, ☠ Poison 3, 🕸 Cobweb, 🍞 Pilfer 4). Intents are rolled from the enemy's move table (§7)
and are always honest.

### 4.7 Fight end

- **Win:** every _seen_ enemy is dead. A surviving Greeble escapes with whatever it stole.
  Rewards follow (§3).
- **Death:** HP ≤ 0. The run ends; the save is deleted.

### 4.8 Hit feedback (player)

Damage to you: screen shake (toggle), claw-mark overlay, red vignette pulse, HP bar shake.
Damage fully absorbed by Block: a curled-shell flash at the screen edge instead.

---

## 5. Cards

### 5.1 Anatomy

Portrait, 5:7. Top-left: **Charge cost** in a sun gem. Art window. **Name**. Type line
(_Attack_ / _Skill_, family icon). **Effect text**. Frame colour by rarity: cream (common),
sage (uncommon), gold (rare). Upgraded forms carry a brass "+" rivet and a small title banner
(_Mr. Wormsley_). Every card is a cyborg garden creature.

### 5.2 Rarity & reward odds

| Source          | Common | Uncommon | Rare            |
| --------------- | ------ | -------- | --------------- |
| Fight reward    | 60%    | 33%      | 7%              |
| Elite reward    | 40%    | 45%      | 15%             |
| Boss (act end)  | —      | —        | 3 rares offered |
| Shop card stock | 50%    | 35%      | 15%             |

_Shadow Path_ signposts add +8 to rare odds on that trail.

### 5.3 Base roster (v1 — the seven bugs)

| Card            | Rarity   | Type   | Cost | Effect                                                      | Upgraded form (+)                                                              |
| --------------- | -------- | ------ | ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Wormillion**  | Common   | Attack | 1    | Deal 4.                                                     | Cost **0**. Deal 4.                                                            |
| **Roly Poly**   | Common   | Skill  | 1    | Gain 5 Block.                                               | Gain **8** Block.                                                              |
| **Caterpillar** | Common   | Attack | 1    | Deal 2. Apply 3 Poison.                                     | Deal 3. Apply **5** Poison.                                                    |
| **Ladybug**     | Uncommon | Attack | 2    | Deal 4 to ALL enemies.                                      | Deal **6** to ALL enemies.                                                     |
| **Butterfly**   | Uncommon | Skill  | 1    | Draw 2. Apply 1 Weak to ALL enemies.                        | Draw **3**. Apply **2** Weak to ALL enemies.                                   |
| **Chameleon**   | Uncommon | Attack | 2    | Deal 9.                                                     | Deal **13**.                                                                   |
| **Cat**         | Rare     | Attack | 1    | Deal 6. Can target Unseen enemies. Holding it reveals them. | **Sir Reginald V** — Deal 8. Unseen enemies it kills return **double** crumbs. |

Cat's upgraded art: top hat and gold monocle over the robotic eye.

All numbers _(tuning)_.

### 5.4 Families (v1 — one extra card per bug, 14 cards total)

| Card         | Family      | Rarity   | Type   | Cost | Effect                              | Upgraded form (+)                   |
| ------------ | ----------- | -------- | ------ | ---- | ----------------------------------- | ----------------------------------- |
| Drill Worm   | Wormillion  | Common   | Attack | 1    | Deal 3. Ignores Block.              | Deal 5. Ignores Block.              |
| Roly Pounce  | Roly Poly   | Common   | Attack | 1    | Deal 3. Gain 3 Block.               | Deal 3. Gain 5 Block.               |
| Munch        | Caterpillar | Common   | Attack | 0    | Deal 2. Apply 1 Poison.             | Deal 3. Apply 2 Poison.             |
| Spot Barrage | Ladybug     | Uncommon | Attack | 1    | Deal 2 to a random enemy, 3 times.  | Deal 3 to a random enemy, 3 times.  |
| Flutter      | Butterfly   | Common   | Skill  | 0    | Draw 1. Apply 1 Weak to an enemy.   | Draw 2. Apply 2 Weak to an enemy.   |
| Tongue Lash  | Chameleon   | Common   | Attack | 1    | Deal 5.                             | Deal 7.                             |
| Pounce       | Cat         | Rare     | Attack | 2    | Deal 10. Can target Unseen enemies. | Deal 14. Can target Unseen enemies. |

Family cards are upgraded by the same titled unlock as their bug (Mr. Wormsley upgrades Drill
Worm too), and by Wormillionaire/whole-family injection where applicable. Each family card has
its **own art** (`card-<card>`, e.g. `card-drill-worm`): the same bug caught in a different
act, so a family reads as one character with a repertoire rather than one picture repeated.
Family cards have no separate upgraded-form art; their "+" form is the base art with the rivet
and title banner (§5.1). All numbers _(tuning)_.

**First playable (M2) shipped with only the seven base cards; families ship in M4.**

### 5.5 Starting deck

6 × Wormillion, 3 × Roly Poly, 1 × Ladybug. (10 cards.)

---

## 6. Upgrades

One system, whole-bug-type only. There is no upgrading of a single copy.

### 6.1 Titled unlocks (per bug) — sold at shops, 65 crumbs _(tuning)_

| Bug         | Titled unlock        | What it does                                                                 |
| ----------- | -------------------- | ---------------------------------------------------------------------------- |
| Wormillion  | **Mr. Wormsley**     | Every Wormillion-family card you have or gain this run is its upgraded form. |
| Roly Poly   | **Sir Rollsalot**    | Same, for Roly Poly.                                                         |
| Caterpillar | **Professor Pillar** | Same, for Caterpillar.                                                       |
| Ladybug     | **Lady Bugsworth**   | Same, for Ladybug.                                                           |
| Butterfly   | **Madame Butterfly** | Same, for Butterfly.                                                         |
| Chameleon   | **Doctor Chameleon** | Same, for Chameleon.                                                         |
| Cat         | **Sir Reginald V**   | Same, for Cat. He gets a monocle and a top hat.                              |

A titled unlock can be bought once per run. Shops stock 2 of them at a time, drawn from bugs
you actually own cards of.

### 6.2 General upgrades — sold at shops, 70 crumbs _(tuning)_

| Name                    | Effect                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **Solar Panel**         | +1 Charge on the first turn of every fight.                                                              |
| **Thick Thorax**        | +10 max HP (and heal 10).                                                                                |
| **Crumb Magnet**        | +25% crumbs from fights.                                                                                 |
| **Spare Parts**         | Heal 4 HP after every fight.                                                                             |
| **Sharpened Mandibles** | Attacks deal +1 damage.                                                                                  |
| **Cat's Whisker**       | The roaming Greeble is visible on the map even without a Cat, and Greebles steal 1 fewer crumb per turn. |

Each can be bought once per run. Shops stock 2 at a time. Elite rewards offer a choice of 2.

### 6.3 Wormillionaire — sold at shops, 85 crumbs _(tuning)_

Adds **5 × Wormillion+** (cost 0) to your deck. One per shop visit; can be bought again at
another shop. They are upgraded regardless of whether you own Mr. Wormsley.

---

## 7. Enemies

All enemies live in the Thicket: dark, grainy, amber eyes. Intents are rolled from the move
table each turn using the fight's RNG stream; rules like "never twice in a row" apply after
the roll.

### 7.1 Common vermin

| Enemy        | HP  | Moves (weight)                                                                      | Trait / notes                                                            |
| ------------ | --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Rat**      | 11  | Gnaw ⚔4 (65) · Frenzy ⚔2×2 (35)                                                     | Comes in packs of 2–3.                                                   |
| **Possum**   | 24  | Bite ⚔6 (50) · Hiss: 1 Weak (25) · Lunge ⚔9 (25, never twice in a row)              | **Play Dead:** the first time it would die, it survives at 6 HP instead. |
| **Spider**   | 18  | Bite ⚔5 (50) · Spin Web: shuffle 1 Cobweb into your draw pile (50, max 3 per fight) |                                                                          |
| **Scorpion** | 22  | Sting ⚔3 + 3 Poison (50) · Pincer ⚔7 (50)                                           |                                                                          |

### 7.2 The Greeble

| HP  | Moves                                                            | Trait                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Pilfer: steal 4 crumbs (100). If you have none, Gnaw ⚔2 instead. | **Unseen.** Only Cat-family cards can target or damage it; "all enemies" effects pass through it. Rendered as a floating HP bar and a heat-shimmer. While you hold a Cat card its true form fades in; drop the card and it fades out. |

- **Appears in** ~20% of non-boss fights _(tuning)_, and always in the fight on the roaming
  marker's node (§8.5). Never more than one per fight.
- **Escapes** when every seen enemy is dead, taking the stolen crumbs.
- **Killed:** you get the stolen crumbs back **+15 bonus** _(tuning)_. Sir Reginald V doubles
  the returned amount.
- A fight with a Greeble is always winnable without a Cat — you just lose the crumbs.

### 7.3 Elites

| Elite           | HP  | Moves (weight)                                                                          |
| --------------- | --- | --------------------------------------------------------------------------------------- |
| **Rat King**    | 48  | Summon Rat (40, only while fewer than 2 Rats present) · Gnaw ⚔8 (40) · Frenzy ⚔3×3 (20) |
| **Wolf Spider** | 55  | Double Web: 2 Cobwebs (35, max 6 per fight) · Pounce ⚔11 (35) · Bite ⚔6 + 1 Weak (30)   |

Elite rewards: 35 crumbs, a card pick at elite odds, and a choice of 1 of 2 general upgrades.

### 7.4 Boss — the Bear (act 1)

| HP  | Pattern                                                                    | Enrage (≤ 50% HP)                                            |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 130 | Swipe ⚔9 → Roar (2 Weak, gains 8 Block) → Swipe ⚔9 → **Maul ⚔18** → repeat | All attacks +3. Pattern becomes Swipe → Maul → Swipe → Maul… |

Boss reward: victory screen. (Act 2 and the **Moose** are roadmap.)

### 7.5 Encounter tables (by node index along the trail)

| Depth     | Pool                                                              |
| --------- | ----------------------------------------------------------------- |
| Early 1–3 | Rat ×2 · Spider · Scorpion · Possum                               |
| Mid 4–7   | Rat ×3 · Possum + Rat · Spider + Scorpion · Spider ×2             |
| Late 8+   | Possum + Spider · Scorpion ×2 + Rat · Possum ×2 · Spider + Rat ×2 |

Greeble attachment is rolled separately (§7.2). Elites: Rat King or Wolf Spider, equal odds.

---

## 8. Map & run

### 8.1 Act structure

v1: **one act**, one map, the Bear at the end. Later acts get their own map and boss.

### 8.2 Trail generation

- Generate **3 trails** from Start to Boss. Each trail is **8–12 nodes** long (average 10),
  excluding the boss.
- Trails **cross** at two points (around the 4th and 8th node) so you can switch trails there.
- Each trail draws a **signpost flavour** (§8.4); pick 3 of the 4 flavours per map.
- Constraints, per trail: nodes 1–2 are Fights; ≥ 1 Shop, never before node 3; elites never
  before node 4 and never adjacent; the node before the Boss is always a **Cocoon**.
- The whole map is generated from the run's `map` RNG stream at run start and never changes
  (the markers below move; the nodes don't).

### 8.3 Node types

| Node       | What happens                                           |
| ---------- | ------------------------------------------------------ |
| **Fight**  | Encounter from §7.5. Reward: 12–18 crumbs + card pick. |
| **Elite**  | Rat King or Wolf Spider. Reward per §7.3.              |
| **Shop**   | The Snail's stall (§9).                                |
| **Cocoon** | One of Rest, Forage, Pupate (§8.8).                    |
| **Boss**   | The Bear.                                              |

### 8.4 Fog & signposts

You see the **type** of every node within **2 steps** of your position. Further nodes show as
unknown markers along the trail. At every branch, a **signpost** names each trail's flavour:

| Flavour          | Length | Fights | Elites | Shops | Cocoons (+ pre-boss) | Extra                             |
| ---------------- | ------ | ------ | ------ | ----- | -------------------- | --------------------------------- |
| **Thorny Trail** | 11–12  | 7–8    | 2      | 1     | 0                    | Crumbs +25%.                      |
| **Sunny Meadow** | 8–9    | 4–5    | 1      | 1     | 1                    | Gentle.                           |
| **Market Road**  | 9–10   | 5      | 1      | 2     | 0                    | A second shop.                    |
| **Shadow Path**  | 9–10   | 5      | 2      | 1     | 0                    | Greeble chance 50%. Rare odds +8. |

### 8.5 The roaming Greeble marker

- Placed on a random non-start, non-boss node at map creation.
- After every move you make, it moves to a random adjacent node (either direction along a
  trail), never the Boss.
- **Visible only if your deck contains a Cat-family card** (or you own Cat's Whisker).
- If you enter its node, that node's fight includes a Greeble (added to a Shop/Cocoon node as an
  ambush fight first). The marker then relocates at least 4 nodes away.

### 8.6 The Snail

- The Snail shopkeeper is a friendly, always-visible marker. It starts on a random node in the
  middle third of the map and moves one node along the trails after each of your moves.
- Fixed **Shop** nodes are the Snail's proper stalls: full stock (§9).
- If you enter a non-Shop node the Snail is standing on, a **travelling stall** opens after
  that node's normal content: 2 cards + 1 general upgrade at **20% off**, no titled unlocks,
  no removal. The Snail then leaves the map for 4 moves and reappears elsewhere.

### 8.7 Win & death

Kill the Bear → Victory. HP ≤ 0 anywhere → Death. Both end the run and delete the save.

### 8.8 The Cocoon: Rest, Forage, Pupate

A Cocoon offers one of three, once per visit. Leaving without choosing is allowed.

| Choice     | Effect                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rest**   | Heal 30% max HP _(tuning)_.                                                                                                                                                                                                                                                                                            |
| **Forage** | Root through the leaf litter: gain 18–28 crumbs _(tuning)_, rolled from the `rewards` stream.                                                                                                                                                                                                                          |
| **Pupate** | Choose a Caterpillar-family card in your deck. It becomes a **Chrysalis** (Butterfly family, cost 0 Skill: _Gain 6 Block. Exhaust._; + _Gain 8 Block_) and cannot attack while in that phase. When you next **win a fight**, it emerges as its Butterfly-family counterpart: Caterpillar → Butterfly, Munch → Flutter. |

Metamorphosis is how a common Caterpillar becomes an uncommon Butterfly: one Cocoon visit and
the fight after it. The Chrysalis belongs to the Butterfly family, so Madame Butterfly upgrades
it and the card it becomes. A Chrysalis is never offered by rewards or shops. One still in the
deck at the Bear simply never emerges.

---

## 9. Economy

### Sources _(tuning)_

| Source         | Crumbs                  |
| -------------- | ----------------------- |
| Start of run   | 25                      |
| Fight          | 12–18                   |
| Elite          | 35                      |
| Greeble killed | stolen crumbs back + 15 |
| Thorny Trail   | +25% on the above       |
| Crumb Magnet   | +25% on the above       |

### Shop stock & prices _(tuning)_

| Item                         | Count | Price                                 |
| ---------------------------- | ----- | ------------------------------------- |
| Cards (odds §5.2)            | 3     | common 35 · uncommon 55 · rare 90     |
| Titled unlocks (§6.1)        | 2     | 65                                    |
| General upgrades (§6.2)      | 2     | 70                                    |
| Wormillionaire (§6.3)        | 1     | 85                                    |
| Remove a card from your deck | 1     | 50, +15 each time you use it this run |

No healing at shops — that's what Cocoons are for.

---

## 10. Save, seeds, settings

### Seeds

- A run has one 32-bit seed (random, or typed on the title screen). The seed is shown in
  Settings and on the Victory/Death screens with a copy button.
- The engine forks independent RNG streams from it: `map`, `encounters`, `combat`, `rewards`,
  `shop`, `markers`. A decision in one stream never perturbs another.
- Same seed + same inputs = same run, exactly. This is a test contract, not just a feature.

### Save & resume

- One autosave slot in `localStorage` (`cardillion.save.v1`), written after every engine action.
- Stores the full run state including every RNG stream's state and, if mid-fight, the entire
  combat state. **Continue** restores exactly where you were.
- Deleted on Death and Victory. Abandoning a run from Settings also deletes it. No save-scumming.
- Versioned; a save from an older version is discarded with a notice rather than crashing.

### Settings (v1)

Screen shake · Reduce motion & flashing (disables grain, shake, shimmer; keeps vignette) ·
Fullscreen · Show run seed (with copy) · Abandon run · Reset save data.
Stored in `localStorage` (`cardillion.settings.v1`). A volume slider arrives with audio.

---

## 11. Presentation

### 11.1 Art direction

Two palettes on one screen.

| World       | Palette                                                    | Texture & light                                                                            | Reference   |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| **Garden**  | buttery yellow, leaf green, cream, sky blue, copper/brass  | painterly, soft edges, warm key light                                                      | Diceomancer |
| **Thicket** | near-black green, umber, bruised purple, amber (eyes only) | painted realism, photobashed texture, heavy grain, crushed blacks, one cold rim light, fog | Inscryption |

The Thicket's creatures are **gross, never gory**: mange, wet matted fur, bare greasy skin, ribs,
crusted glowing eyes, one joint too many. Realistic rendering, diseased subject.

The two must never be fully separated: the Garden's warm light spills a little onto the nearest
enemy; the Thicket's fog creeps a little onto the table.

### 11.2 Battle scene composition (three.js)

- **Camera:** perspective, ~42° FOV, above and behind the player's edge of the table, looking
  slightly down toward the far side. Think "sitting at the table".
- **Table:** a long plane of moss and soil running away from the camera. Near end: flowers,
  pebbles, dappled light. Far end: roots, thorns, darkness.
- **Fog:** exponential, near-black; begins mid-table, total at the far edge. This is the
  bright→dark gradient. Nothing else is needed to create it.
- **Lights:** one warm point light near the camera (sunlight, gently flickering), a very dim
  cool hemisphere fill, enemies' eyes emissive.
- **Enemies:** painted sprites (billboards) standing on the far half of the table, spaced across
  x. Intent above, HP bar below. The Greeble is a shimmer shader + HP bar until revealed.
- **Hand:** DOM elements along the bottom edge in the bright zone. Hover lifts and enlarges.
- **Playing a card:** it lifts off the hand, becomes a textured plane in the 3D scene, flies to
  its target and hits (impact flash, sprite recoil, number pop). Untargeted cards flash at the
  table's near edge.
- **Post-processing:** vignette (always), film grain (off under Reduce motion), bloom on
  emissive only (eyes, sun gem), subtle depth-tinted colour grade: warmer near, colder far.
- **Player hits:** §4.8.

### 11.3 Map scene

Top-down garden. Trails are dirt paths between beds. The far edge is the forest's edge with the
Boss node in it. Fogged nodes are drawn as faint pebbles. Markers: Snail (visible), Greeble
(when visible: a faint pair of eyes).

### 11.4 Asset contract

Every visual asset is keyed by a stable **id** matching its content entry. Masters live in
`assets/art/<id>.png`; `npm run art:optimize` writes the web-sized `public/art/<id>.webp` the
game loads. A missing asset falls back to a procedurally drawn placeholder, so the game is
always fully playable without any generated art.

| Kind          | Id pattern            | Generated size  | Displayed as                                                         | Background  |
| ------------- | --------------------- | --------------- | -------------------------------------------------------------------- | ----------- |
| Card art      | `card-<card>`         | 1024 × 1024 PNG | contain-fit in the art window                                        | transparent |
| Upgraded card | `card-<card>-plus`    | 1024 × 1024 PNG | as above, only where the "+" form has its own look (Cat, Wormillion) | transparent |
| Enemy sprite  | `enemy-<name>`        | 1024 × 1024 PNG | billboard, height ≈ 1.6 units                                        | transparent |
| Enemy pose    | `enemy-<name>-<pose>` | 1024 × 1024 PNG | swapped onto the billboard while the pose holds (Possum's Play Dead) | transparent |
| Boss sprite   | `boss-<name>`         | 1024 × 1536 PNG | billboard, height ≈ 3 units                                          | transparent |
| NPC           | `npc-<name>`          | 1024 × 1024 PNG | map marker / shop portrait                                           | transparent |
| Backgrounds   | `bg-<scene>`          | 1536 × 1024 PNG | table texture / map backdrop                                         | opaque      |
| Icons         | `icon-<name>`         | SVG             | UI                                                                   | —           |

Content names its art explicitly (`art`, and `upgradedArt` / `deadArt` where a second image
exists); the patterns above are the naming convention, not something the loader infers.
Prompts live in `art/manifest.json`; `npm run art` renders them (see `docs/art-pipeline.md`).
All v1 assets are generated and approved; new content gets a manifest entry and plays with a
placeholder until its art is.

---

## 12. Tech architecture

**Stack:** TypeScript · Vite · three.js (scene) · DOM/CSS (UI) · Vitest · ESLint/Prettier ·
GitHub Actions. Decided provisionally, pending the **look prototype** gate (M1) — see
`docs/adr/0001-web-threejs-with-godot-fallback.md`. Fallback: Godot 4 via Godot MCP Pro.

### 12.1 Layers

```
src/engine    pure rules: state + action → state + events. No DOM, no three.js. Fully tested.
src/content   typed data tables (cards, enemies, upgrades, encounters, flavours). No logic.
src/render    three.js scenes, effects, post-processing. Reads state, animates events.
src/ui        DOM overlay: hand, HUD, map, shop, settings, title. Dispatches actions.
src/save      localStorage adapter, versioning, migrations.
src/app       router + game loop; the only layer that imports everything.
src/prototype throwaway experiments (M1 look prototype). Never imported by the game.
tools/        node scripts (art generation).
art/          prompt manifest.
assets/       art/ (generated PNGs, gitignored until approved) · placeholders/ (generated SVG).
docs/         adr/ (ADRs), art-pipeline.md.
```

Dependency direction is enforced by ESLint: `engine` and `content` may not import `three`, the
DOM globals, or any outer layer.

### 12.2 Engine contract

- `applyAction(state, action, rng) → { state, events }` — a pure reducer. `state` is plain JSON.
- Events (`CardPlayed`, `DamageDealt`, `BlockGained`, `StatusApplied`, `EnemyDied`,
  `GreebleEscaped`, `CrumbsStolen`, `IntentRolled`, `TurnStarted`, …) are the only thing the
  renderer animates from. The renderer never derives what happened by diffing state.
- The run state carries the state of every RNG stream, so a save is just the state object.
- Content is validated by a test: every card/enemy/upgrade has an id, an art id, sane numbers.

### 12.3 Testing policy

- **Engine: test-first.** Every rule in §4–§9 gets a Vitest test before or with its
  implementation. Determinism tests replay a seed and assert identical event logs.
- **Content: schema tests.** Tables are validated, not hand-checked.
- **Render/UI: manual + screenshots.** Checked in the browser during development; no unit tests.
- CI runs typecheck, lint, format check, tests and a production build on every push to `main`.

---

## 13. Milestones

| #      | Name                 | Done when                                                                                                                                                                                                                         |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** | Scaffold             | Repo, toolchain, CI, this spec, `CLAUDE.md`. ✅                                                                                                                                                                                   |
| **M1** | Look prototype       | A throwaway three.js scene: table, fog, warm light, two card planes, one enemy with glowing eyes, vignette + grain. **Gate:** you judge it in the browser. Pass → continue on web. Fail → Godot (ADR 0001). ✅ Passed 2026-09-13. |
| **M2** | First playable fight | Seven base cards, Rat pack, Charge, statuses, intents, drag-to-target, hit feedback, win/lose. Engine fully tested. ✅ 2026-09-13.                                                                                                |
| **M3** | Run loop             | Map generation (trails, fog, signposts), rewards, fixed shops, cocoon, the Bear, death/victory, title screen. ✅ 2026-09-13.                                                                                                      |
| **M4** | Content              | Families (14 cards), elites, Greeble + roaming marker, Snail travelling stall, titled unlocks, general upgrades, Wormillionaire. ✅ 2026-09-15.                                                                                   |
| **M5** | Systems              | Save/resume, seeds on title, settings menu, reduce-motion path.                                                                                                                                                                   |
| **M6** | Art                  | OpenAI Images pipeline, style anchors approved, all placeholders replaced, contact sheets in `docs/`.                                                                                                                             |

---

## 14. Roadmap (not v1)

- Acts 2–3, each with its own map and boss (**Moose** is act 2's).
- Audio and music; volume settings.
- Meta-progression: unlocks across runs (design the save format so this can be added).
- Touch / mobile layout. A Steam build via Electron/Tauri.
- Difficulty levels.
- Map ideas held back: **Dandelion spin** (random branch choice you can bribe with crumbs),
  **Trapdoor spider** node, **Weather** reshuffles, **Scout** (pay crumbs to peek through fog).
- More families, more titled unlocks with second tiers, more vermin.

---

## 15. Tuning log

Record balance changes here with a date and a one-line reason, so numbers in this document stay
the source of truth.

| Date       | Change                                    | Why                                                                                                                                                       |
| ---------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-13 | Initial numbers                           | First pass from design session.                                                                                                                           |
| 2026-09-15 | Family card upgraded forms                | Decided for M4 (spec §5.4 was draft; picked modest bumps matching each base card's own upgrade delta).                                                    |
| 2026-09-15 | Cocoon: Forage 18–28, Chrysalis Block 6/8 | New §8.8 from the owner's idea list. Forage sits between a fight's bounty and a common card's price; Chrysalis is a Roly Poly with the attack taken away. |

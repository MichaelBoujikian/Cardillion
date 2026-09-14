# Cardillion

A single-player card-battler roguelike: a deck of cyborg garden bugs against the vermin
creeping in from the woods. This glossary is the canonical vocabulary; `spec.md` defines the
rules that use it.

## Language

### The run

**Run**:
One attempt at the game, from the title screen to death or victory. Permadeath: nothing carries
over.
_Avoid_: game, playthrough, session

**Act**:
One map ending in one boss. v1 has a single act.
_Avoid_: chapter, level, world

**Seed**:
The number that fully determines a run's map, encounters and rewards.

**Node**:
A stop on the map. One of: Fight, Elite, Shop, Cocoon, Boss.
_Avoid_: room, floor, encounter (that is what happens _at_ a Fight node), location

**Trail**:
A route through the map from start to boss. Trails cross so the player can switch between them.
_Avoid_: path, branch, route

**Signpost**:
The flavour a trail advertises at a branch (Thorny Trail, Sunny Meadow, Market Road, Shadow
Path). It states the odds of what lies ahead, not the sequence.

**Cocoon**:
The rest node. Heals the player.
_Avoid_: rest site, campfire

**Snail**:
The shopkeeper. Runs the fixed Shop nodes and wanders the map offering a travelling stall.
_Avoid_: merchant, vendor

### Combat

**Charge**:
The per-turn energy that pays for cards. Bugs are solar-powered; Charge comes from the sunlit
side of the screen and is lost at end of turn.
_Avoid_: energy, mana, sun

**Crumbs**:
The currency earned from fights and spent at shops.
_Avoid_: gold, coins, money

**Card**:
A one-shot action depicting a bug. Playing it resolves its effect immediately; nothing stays on
the board.
_Avoid_: unit, creature, minion, summon

**Bug**:
A good-guy character: Wormillion, Roly Poly, Caterpillar, Ladybug, Butterfly, Chameleon, Cat.
Every bug is a cyborg. Each bug has a family of cards.
_Avoid_: hero, ally

**Family**:
All the cards belonging to one bug. A titled unlock upgrades the whole family.

**Upgraded form**:
The single stronger version each card has, marked with a brass "+" (Wormillion+).
_Avoid_: card+, level 2

**Titled unlock**:
A shop item, named like a gentleman (Mr. Wormsley), that puts every current and future card of
one bug into its upgraded form for the rest of the run.
_Avoid_: relic, upgrade token, card upgrade

**General upgrade**:
A run-wide passive bought at a shop (Solar Panel, Thick Thorax). Not tied to a bug.
_Avoid_: relic, artifact, perk

**Wormillionaire**:
A shop item that adds five Wormillion+ to the deck.

**Intent**:
The action an enemy will take on its next turn, shown above it.
_Avoid_: telegraph, plan

**Status**:
A timed condition on a creature: Block, Poison, Weak. Cobweb is a status _card_, not a status.
_Avoid_: buff, debuff, effect

**Cobweb**:
An unplayable card a spider shuffles into the player's draw pile. Exhausts at end of turn.
_Avoid_: dud, junk, curse

**Exhaust**:
Leaving the fight instead of going to the discard pile.
_Avoid_: burn, remove

### The Thicket

**Vermin**:
The enemies: Rat, Possum, Spider, Scorpion, Greeble, and their elites and bosses.
_Avoid_: monster, mob

**Elite**:
A stronger optional-by-routing fight with better rewards (Rat King, Wolf Spider).
_Avoid_: mini-boss

**Boss**:
The act's final fight (the Bear in act 1; the Moose is reserved for act 2).

**Greeble**:
The Unseen vermin that steals crumbs. Only Cat cards can target it; it escapes when the fight
ends.

**Unseen**:
An enemy trait: the enemy is invisible (drawn as a floating HP bar) and can be targeted or
damaged only by Cat-family cards.
_Avoid_: stealth, invisible, hidden

**Roaming Greeble**:
The map marker that shows where the Greeble will ambush next. Visible only when the deck
contains a Cat.

### Presentation

**Garden**:
The near, bright, painterly half of the world where the player's bugs and hand live.

**Thicket**:
The far, dark, grainy half of the world where vermin stand.

**Placeholder**:
A procedurally generated SVG stand-in for an art asset, used until generated art exists.

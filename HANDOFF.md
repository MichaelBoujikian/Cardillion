# Handoff — Cardillion

For an agent picking this project up cold. Read this, then `CLAUDE.md` (the standing rules),
then the `spec.md` section for whatever you build next. Written 2026-09-15; updated 2026-09-16
after the overnight run (see that section) at commit `44a6cfd`.

## What this is

A single-player card-battler roguelike in the browser: cheerful cyborg garden bugs (cards) versus
grim, realistic vermin (enemies). Slay-the-Spire bones; an Inscryption-dark far side of the screen
fading into a Diceomancer-bright near side. Owner: Michael (`MichaelBoujikian` on GitHub). He
directs, agents build; he judges results by eye and approves art in batches.

- **Play it:** https://michaelboujikian.github.io/Cardillion/ — deployed from `main` on every
  push by `.github/workflows/deploy.yml`. Repo is **public** (Pages needs it on his plan).
- **Design source of truth:** `spec.md`. Vocabulary: `CONTEXT.md`. Why-decisions: `docs/adr/`.
- **Stack:** TypeScript · Vite · three.js · Vitest. Node 24 on Windows 11, Git Bash.

## Where things stand

| Milestone (spec §13)    | Status                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| M0 scaffold             | done                                                                  |
| M1 look prototype       | done — owner passed the engine gate; web + three.js is settled        |
| M2 first playable fight | done                                                                  |
| M3 run loop             | done — title → map → fights/rewards/shops/cocoons → the Bear → result |
| M4 content              | done — 14 cards, titled unlocks, upgrades, Wormillionaire, markers    |
| M5 systems              | done — autosave slot + Continue, settings panel, reduce motion        |
| M6 art                  | done — all 40 assets generated and approved                           |

123 tests pass; `npm run check` is green; CI and the Pages deploy are green.

Nothing has been balanced. Every number in the spec is a first guess marked _(tuning)_. The
owner has played the live link but has not yet given balance notes.

**First balance data (2026-09-16, `src/engine/fuzz.test.ts`).** A greedy bot (attack the
weakest, block when a hit is coming, rest when hurt, buy upgrades first) played 300 seeded runs:
**win rate 0.3%**. It reached the Bear in 43% of runs and died there almost every time; the
next deadliest fights were the late `scorpion ×2 + rat` pool, `spider + scorpion` and the Wolf
Spider. A random bot never wins and dies around node 4–5. The fuzz policy is deliberately
naive, so treat these as a first reading, not a target. **The owner has decided: no balance
changes on the back of this; balance gets its own dedicated test sessions.** Do not propose
number changes in passing — when that session comes, it starts from `spec.md` §15 and this
data.

## What's next (the morning after the overnight run)

The owner reviewed the overnight run on 2026-09-16: **all nine images approved and committed;
all the new mechanics approved** (spec §5.4 second wave, §8.6 trail, §8.8, §8.9). Standing
requests from that review:

1. **Metamorphosis for more bugs.** He wants it to be a mechanic across the roster, not a
   Caterpillar-only trick. Today `PUPATION` in `src/content/cards.ts` maps Caterpillar →
   Butterfly and Munch → Flutter; the engine is already generic (any card with a mapping can
   pupate at a Cocoon and emerges after the next won fight). The design work is deciding what
   each bug becomes — Wormillion, Roly Poly, Ladybug, Chameleon and Cat have no "next stage"
   yet — and whether every stage is a Cocoon visit. Spec §14 (Roadmap) carries the note; grill
   him on the shapes before building.
2. **Balance** — dedicated test sessions later, nothing in passing (see the data above).
3. Ideas from his list not built: collectable cyborg parts, card lifespan (reasons in the
   overnight table).

## How to work here (the parts CLAUDE.md doesn't say)

**Owner's style.** He answers rounds of questions with "go with your recommendation", so offer
one clear recommendation per question. When he asks _what the next step is_, answer — don't
start building. He wants generated art shown to him (contact sheet) before it is committed, and
wants to be walked through any account/API step. His messages are often speech-to-text; ask
when a word doesn't parse.

**Pushing.** `gh` is authenticated but configured for SSH, and github.com's host key isn't
trusted on this machine. Push with:

```bash
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

Commits go straight to `main` with the attribution line the session gives you.

**The Bash tool truncates long commands** (~8 KB); the failure looks like an unterminated
quote and nothing in the command runs. Use the Write tool for big files and keep heredocs
small. Three agents lost time to this in one day.

**Verifying visuals.** Start the `dev` launch config (`.claude/launch.json`), open the Browser
pane, screenshot. URL overrides for a run: `?seed=` `?deck=cat,cat,roly-poly` `?hp=999`
`?crumbs=500`. In dev, `window.__cardillion` exposes `controller`, `screens`, `autoFight()` and
`autoRun(stopAt?)` (plays a whole run from the console; `autoRun('shop')` stops at the first
shop). `controller.run` is a plain object you can replace from the console to stage a
situation, e.g. `c.run = {...c.current, snailNode: nextId}` before dispatching a travel.
The browser JS tool times out at 45 s — poll long runs with waits. The console shows a few
stale errors from old HMR loads (`glow before initialization`, `faces.face`) — ignore them; a
fresh navigation clears them.

Useful seeds: `g52` (trail 0 is fight, fight, shop, cocoon; `t0-1` is Damp Soil; a strong deck
wins it in ~2 min of autoplay), `s0` spider, `s5` scorpion + Greeble, `s3` possum on a Flower
Patch, `garden1` two rats plus a Greeble. Deck overrides for the new cards:
`?deck=worm-swarm,wormillion,drill-worm,scavenge,molt,stink-cloud,burrow,caterpillar`.

**Art.** `docs/art-pipeline.md` is complete. What you need to know beyond it: the owner's
OpenAI key is in the gitignored `.env` on his machine (never print it); the Cat cards portray
**his real cat** from `art/refs/owner-cat.png` (gitignored — without it those two cards can't
be regenerated on another machine); every asset renders on a chroma screen and is keyed out
by the tool because the API's transparent mode drops thin dark limbs; `npm run art:optimize`
must run after new PNGs so `public/art/*.webp` (what the game loads) is current. Total spend
so far ≈ $10.

## Architecture in one screen

```
src/engine/   pure rules. rng.ts (seeded, forkable) · types.ts · combat.ts (fight reducer,
              CombatMods carry upgrade effects) · map.ts (three signposted trails, two
              crossings, fog) · run.ts (run reducer: travel, rewards, shops, upgrades, the
              roaming Greeble and wandering Snail markers)
src/content/  data tables: cards.ts (14 + Cobweb) · enemies.ts · encounters.ts · trails.ts ·
              upgrades.ts (titled unlocks, general upgrades, Wormillionaire)
src/render/battle/  three.js table scene (scene.ts), post-processing (post.ts), textures and
              card faces (textures.ts — also finds enemies' glowing eyes in the art)
src/ui/       battle-ui.ts (hand, HUD, drag/click targeting) · run-screens.ts (title, map,
              reward, shop, cocoon, result, deck list) · card-faces.ts (shared face cache)
src/app/      index.ts (boot, dev hooks) · run-controller.ts (dispatch → animate → screen)
              · animate.ts (plays combat events as animations with a running ledger)
src/save/     store.ts (KeyValueStore + MemoryStore) · save.ts (one autosave slot, versioned
              and shape-checked) · settings.ts — pure, tested; src/app/index.ts owns the
              localStorage instance and applies settings to the scene
tools/        gen-art.mjs (OpenAI Images + chroma key) · art-preview.mjs (checkerboard
              previews + alpha stats) · art-optimize.mjs (PNG masters → WebP)
```

Rules that matter when you touch it: the engine emits **events** and the renderer only
animates from them (ADR 0003); content names every image it uses (`art`, plus `upgradedArt`
on Cat/Wormillion and `deadArt` on the Possum) and `src/app/index.ts` collects those ids for
the loader — a new image means a new field or list entry, never a naming convention the
loader guesses; randomness only from `Rng` streams (`map`, `encounters`,
`combat`, `rewards`, `shop`, `markers`); `run.ts` keeps `lastCombat` so a fight's closing
events can still animate after `combat` is nulled; `returnToMap()` in `run.ts` is where a
node hands control back and where deferred content (Greeble-ambushed Shop/Cocoon, the
Snail's cart) is intercepted — route new "after this node" behaviour through it.

## Overnight run 2026-09-15 → 16 (owner asleep; agent working unattended)

The owner asked for, in this order: painted Shop and Cocoon scenes; a batch of new mechanics
from his list ("rough ideas, implement them to see how they do"); then M5; then bug testing.
Each item is one commit with spec text and tests; this list is the checkpoint — **update the
status here in the same commit as the work**, so a fresh session resumes from the right line.

| #   | Item                                                                                       | Status                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| A   | Art: `bg-shop`, `bg-cocoon`, `card-cobweb` generated; contact sheet sent to owner          | done — **image files uncommitted pending his approval** (they are on disk in `assets/art` and `public/art`; do not `git add -A`) |
| B   | Cocoon choices: Rest / Forage / Pupate (metamorphosis, spec §8.8)                          | done                                                                                                                             |
| C   | Cocoon scene on `bg-cocoon`; Shop scene on `bg-shop`                                       | done                                                                                                                             |
| D   | Habitats on fight nodes (spec §8.9): map gen, combat mods, map + HUD display               | done                                                                                                                             |
| E   | New cards: Molt, Worm Swarm, Stink Cloud, Scavenge, Chrysalis (+ art batch, contact sheet) | done — card art also uncommitted pending approval (second contact sheet sent)                                                    |
| F   | Snail pheromone trail on the map (spec §8.6)                                               | done                                                                                                                             |
| G   | Burrow (delayed damage) — only if time allows                                              | done — art uncommitted pending approval                                                                                          |
| H   | M5: save/resume, settings, reduce motion (spec §10)                                        | done                                                                                                                             |
| I   | Bug testing: engine fuzz over many seeds, browser smoke of every screen, fixes             | done — `fuzz.test.ts` (240 runs + replay), a full browser run, and a cold Opus review whose findings are fixed in `44a6cfd`      |

Ideas from his list deliberately **not** built, and why: collectable cyborg parts (a whole item
system; he offered "conditional evolution" as the alternative and Pupate is that); card
lifespan (punishes the deck for existing; Molt carries the flavour without the bookkeeping).

What the run left behind that a new session should know: the Bash tool's ~8 KB limit bit twice
more — every multi-file edit went through a Python script written with the Write tool and run
from `scratchpad/`; the other chat's dev server on :5173 was reused for verification (HMR
reloads the page on any `.ts` edit, so re-stage after editing); `resize_window` to 1280×720
before screenshots, the pane's default is 800×450.

## Known issues and loose ends

- **One unexplained one-off:** on the very first drag of one session, three cards were spent
  from a single gesture. Instrumented, never reproduced across many drags. No root cause found;
  `RunController.dispatch` now marks itself busy synchronously and the playback chain can no
  longer be poisoned by a throw, which closes every window found so far. Watch for it.
- Desktop-only layout. The page loads on phones but the title overflows and touch is untested;
  spec lists touch as roadmap. Share the desktop link.
- GitHub Pages URLs are case-sensitive: `/Cardillion/` works, `/cardillion/` 404s. Renaming
  the repo to lowercase was offered to the owner and not decided.
- Both spider sprites keep a faint half-keyed shadow under the body; the owner accepted them.
- Cosmetic, known and left: the Possum bites from its back and only then stands up (its
  `enemyActed` comes after the move's damage events); after a mid-fight reload the reward
  screen's "emerged" note is lost and the URL's `?seed=` is not refreshed.
- Reduce motion removes the film grain, which is a big part of the thicket's look. The spec
  asks for exactly that; if the owner wants a middle setting, `Post.setGrain` takes any amount.
- `SAVE_VERSION` is 1. `readSave` also sets aside any run lacking a current `RunState` field,
  so forgetting to bump it cannot crash Continue — but bump it anyway when the shape or the
  content it references changes incompatibly.

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13 (four rounds, every decision in
`spec.md` and the ADRs). The engine choice was gated on a look prototype the owner judged in
the browser. The owner later asked for enemies "more realistic and gross, like Inscryption";
that's baked into the thicket prompt prefix. The session ran across three models; a lower-
effort model began M4 when the owner had only asked what the next step was — its engine work
was sound, its big-file write hit the Bash limit, and one bug (a Greeble-only ambush that the
engine refuses) was fixed before the tests were written. Ask before starting a milestone.

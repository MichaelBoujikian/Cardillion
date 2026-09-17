# Handoff — Cardillion

For an agent picking this project up cold. Read this, then `CLAUDE.md` (the standing rules),
then the `spec.md` section for whatever you build next. Written 2026-09-15; rewritten
2026-09-16 at commit `d8806ad` after the overnight run and the owner's review of it.

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

| Milestone (spec §13)    | Status                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| M0 scaffold             | done                                                                   |
| M1 look prototype       | done — owner passed the engine gate; web + three.js is settled         |
| M2 first playable fight | done                                                                   |
| M3 run loop             | done — title → map → fights/rewards/shops/cocoons → the Bear → result  |
| M4 content              | done — now 20 cards, titled unlocks, upgrades, Wormillionaire, markers |
| M5 systems              | done — autosave slot + Continue, settings panel, reduce motion         |
| M6 art                  | done for v1 (40 assets approved) — **the enemy art is being redone**   |

Beyond the milestones (all landed 2026-09-15/16, all approved by the owner): painted Shop and
Cocoon scenes; Cocoons offer Rest / Forage / Pupate (Caterpillar → Chrysalis → Butterfly, spec
§8.8); habitats under half the fights favour a bug family (§8.9, ADR 0007); six more cards
(Molt, Scavenge, Worm Swarm, Stink Cloud, Burrow, Chrysalis, §5.4); the Snail's pheromone trail
(§8.6); enemies idle and act with body motions (§11.2).

125 tests pass; `npm run check` is green; CI and the Pages deploy are green.

**Balance:** nothing is balanced; every number is a first guess marked _(tuning)_.
`src/engine/fuzz.test.ts` plays 240 seeded runs (random and greedy policies) and gives a first
reading — greedy wins 0.3%, the Bear kills 43% of runs, then the late `scorpion ×2 + rat` pool,
`spider + scorpion`, the Wolf Spider. **The owner's decision: balance gets its own dedicated
test sessions. Do not propose or make number changes in passing.**

## NEXT: the enemy art pass

The owner wants the vermin redone as **mutants — Fallout 3 centaur** (the mutant, not the
horse-man): skin torn or sloughed away showing wet muscle and ribs, bundles of fleshy tentacles
pushing out of the mouth, that kind of wrong. **Gross and gory** (spec §11.1 — the owner dropped
"never gory" on 2026-09-16; the thicket prefix in the manifest now invites wounds), still
realistic-painted, still the glowing amber eyes. He wants the new look as **edits of the
existing sprites**, not fresh creatures — same rat, same pose, mutated.

**A sample exists and he liked the direction:** `enemy-rat-mutant` in `art/manifest.json` (an
edit of `enemy-rat`; the image is on disk in `assets/art/`, uncommitted, not a content id; the
before/after sheet is `art/out/contact-2026-09-16-rat-mutant.png`). The rat is "mid-way" —
expect him to want the Bear pushed further.

**How to do it** (`docs/art-pipeline.md`, "Editing an existing asset"):

1. For each enemy, add a manifest entry with `"subject": "<existing id>"` and a prompt that
   says only what changes. The tool sends the existing render first with a hint to keep the
   creature and alter only what is described; the thicket style prefix still applies. Prefer
   regenerating **into the same id** with `--force` once he has approved the look for that
   creature — the content and the loader key by id, so nothing else changes. Until approval,
   render to a sample id (`<id>-mutant`) so the live game is untouched.
2. `npm run art -- --only <ids>` → look at each → `npm run art:optimize` → one contact sheet
   (before/after per creature) → send it → **wait for his yes** → commit PNG + WebP.
3. The roster: `enemy-rat`, `enemy-possum` **and `enemy-possum-dead` together** (the Play Dead
   pose must be the same mutated possum — edit both from their raws in one batch and compare
   them side by side), `enemy-spider`, `enemy-scorpion`, `enemy-greeble` (it is Unseen: drawn
   as a shimmer until a Cat reveals it, so its wrongness only shows on reveal), `enemy-rat-king`,
   `enemy-wolf-spider`, `boss-bear`. `boss-moose` exists but is act 2 (roadmap).
4. Things that can bite: the eye-glow finder (`findGlowPoints` in `textures.ts`) looks for
   bright warm saturated pixels — keep the amber eyes and avoid large amber/orange areas
   elsewhere (raw wounds should read red-pink, not amber). The chroma key (`--rekey`, free) may
   need a look on pale exposed-flesh edges. Raw green-screen renders live in `art/out/*-raw.png`
   on **his machine only** (gitignored); the keyed PNG works as the subject too, just less
   reliably for the screen colour. Expect drift in fur tone — it is a guided repaint — and
   re-roll rather than accept a creature that stopped being the same animal.
5. After each creature lands, check it in the fight: the motion (`poseBody`/`act` in
   `scene.ts`) is billboard transforms and needs no change; amplitudes may want a nudge per
   creature (a Bear should lunge less far than a rat).

**Animation after the art (discussed, not started; he said "don't do this yet").** Agreed
plan, in order: (1) 4–5 **keyframe pose sheets** per creature generated in _one_ image so the
creature stays consistent (rest / wound-up / jaws open / recovering), snapped or cross-faded on
top of the procedural lunge; (2) **masked edits** (inpainting a mask over the head or a limb
only, `mask` support to be added to the tool) for "the same picture with the jaw moved" —
pixel-identical outside the mask; (3) for the Bear and elites only, **image-to-video → sprite
sheet** (OpenAI's video model on the same key, or Veo/Runway as fallbacks; confirm current
endpoint and pricing when building) for real in-betweens, plus a sheet player in the renderer.
Never rig sprites into parts. All of this derives from the final art, hence the order.

## Then: the metamorphosis grilling session

The owner wants metamorphosis to be a mechanic for **multiple bugs**, not just the Caterpillar,
and he wants it designed _with him_ (the `grilling` skill — one recommendation per question; he
answers "go with your recommendation" when he agrees). **Do not build stages for other bugs
before that session's answers are in `spec.md` §8.8.** What exists: `PUPATION` in
`src/content/cards.ts` maps Caterpillar → Butterfly and Munch → Flutter; the engine is generic
(any mapped card pupates at a Cocoon and emerges after the next won fight), so new stages are
content rows once decided. Questions the session must settle: what each bug becomes (some have
free answers — a grub → a beetle; the Ladybug already _is_ the adult, so does she get a larva
stage instead? — and some none: Roly Poly, Chameleon, Cat, who is his real cat, so "kitten →
Sir Reginald" is the obvious joke); whether a stage is always an upgrade or a sideways change
of family; whether stages chain and whether the Cocoon is the only place (Molt exists as a
card); one shared pupa card or one per bug with its own art (§5.4 says one per bug); and
whether Pupate competing with Rest and Forage for a run's one or two Cocoon visits is a
problem or the point. Record the outcome in §8.8 and the tuning log, then add rows.

## How to work here (the parts CLAUDE.md doesn't say)

**Owner's style.** He answers rounds of questions with "go with your recommendation", so offer
one clear recommendation per question. When he asks _what the next step is_, or floats an idea
with "don't do this yet", **answer — don't build**. He likes a **sample** before a decision
(one edited rat sold the whole art direction). He wants generated art shown to him (contact
sheet) before it is committed, and wants to be walked through any account/API step. His
messages are speech-to-text; ask when a word doesn't parse ("cacoon", "our direction" = art
direction). He reviews in batches, so keep a checkpoint list in this file when working
unattended, one commit per item.

**Pushing.** `gh` is authenticated but configured for SSH, and github.com's host key isn't
trusted on this machine. Push with:

```bash
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

Commits go straight to `main` with the attribution line the session gives you. CI takes ~1
minute; the fuzz tests have a 60 s budget because CI's runner is slower than this machine.

**The Bash tool truncates long commands** (~8 KB); the failure looks like an unterminated
quote and nothing in the command runs. It bit five times across two days. The pattern that
works: write a Python edit script with the Write tool into the session scratchpad (a list of
exact `(old, new)` string pairs with an `assert s.count(old) == 1`), run it with `python3`,
then `npx prettier --write` the touched files. Never `git add -A` while unapproved art is on
disk.

**Verifying visuals.** `preview_start` with the `dev` launch config; if another chat already
holds :5173 the tool says so — just `navigate` to it instead. `resize_window` to 1280×720
before screenshots (the pane's default is 800×450 or 800×600, and the layout is desktop 16:9).
HMR reloads the page on any `.ts` edit, so re-stage after editing. URL overrides for a run:
`?seed=` `?deck=cat,cat,roly-poly` `?hp=999` `?crumbs=500`. In dev, `window.__cardillion`
exposes `controller`, `screens`, `autoFight()` and `autoRun(stopAt?)` (plays a whole run from
the console; `autoRun('shop')` stops at the first shop). `controller.run` is a plain object you
can replace from the console to stage a situation — `c.run = {...c.current, position:
node.prev[0], snailNode: null, snailReturnIn: 99, greebleNode: 'boss'}` then dispatch a travel
puts you on any node without markers interfering. Private fields are reachable at runtime
(`c['scene']['sprites']`, `c['battle'].render(combat)`), which is how motion was measured:
sample `body.position/scale/rotation` per frame with `requestAnimationFrame` and report ranges —
stills don't show motion. The browser JS tool times out at 45 s.

Useful seeds: `g52` (trail 0 is fight, fight, shop, cocoon; `t0-1` is Damp Soil; a strong
deck wins it in ~2 min of autoplay), `s0` spider, `s5` scorpion + Greeble, `s3` possum on a
Flower Patch, `garden1` two rats plus a Greeble. Deck overrides for the new cards:
`?deck=worm-swarm,wormillion,drill-worm,scavenge,molt,stink-cloud,burrow,caterpillar`.

**Art.** `docs/art-pipeline.md` is complete (generate, edit with `subject`, chroma key, flags).
Beyond it: the owner's OpenAI key is in the gitignored `.env` on his machine (never print it;
`curl` the models endpoint with it to check it is alive — it was, 2026-09-15); the Cat cards
portray **his real cat** from `art/refs/owner-cat.png` (gitignored); every asset renders on a
chroma screen and is keyed out by the tool because the API's transparent mode drops thin dark
limbs; `npm run art:optimize` must run after new PNGs so `public/art/*.webp` (what the game
loads) is current; `assets/art/` is committed only after his approval. Spend so far ≈ $13.

## Architecture in one screen

```
src/engine/   pure rules. rng.ts (seeded, forkable) · types.ts · combat.ts (fight reducer;
              CombatMods carry upgrade + habitat effects; pending delayed effects) ·
              map.ts (three signposted trails, two crossings, fog, habitats) · run.ts (run
              reducer: travel, rewards, shops, cocoon choices + metamorphosis, markers, the
              Snail's trail) · fuzz.test.ts (whole runs under random/greedy policies)
src/content/  data tables: cards.ts (20 + Cobweb; PUPATION) · enemies.ts (art, deadArt) ·
              encounters.ts · trails.ts · habitats.ts · upgrades.ts
src/render/battle/  scene.ts (table, sprites with a `body` group for idle + move motion,
              setPose for the Possum, act() per move) · post.ts (bloom, grain, vignette) ·
              textures.ts (card faces, art loader, eye-glow finder)
src/ui/       battle-ui.ts (hand, HUD, honest intents, drag/click targeting) · run-screens.ts
              (title + Continue, map, reward, painted shop/cocoon, result, deck list, settings
              panel + gear) · card-faces.ts
src/app/      index.ts (boot, storage, settings, dev hooks) · run-controller.ts (dispatch →
              save → animate → screen; resume; abandon) · animate.ts (combat events →
              animations with a running ledger; enemyActing → scene.act)
src/save/     store.ts · save.ts (one slot, versioned + shape-checked) · settings.ts — pure
tools/        gen-art.mjs (OpenAI Images: generate, edit with `subject`, chroma key) ·
              art-preview.mjs · art-optimize.mjs (PNG masters → WebP)
```

Rules that matter when you touch it: the engine emits **events** and the renderer only
animates from them (ADR 0003) — when an animation needs a cue, add an event (`enemyActing` was
added for the wind-up); content names every image it uses (`art`, `upgradedArt`, `deadArt`) and
`src/app/index.ts` collects the ids for the loader — a new image is a new field, never a naming
convention the loader guesses; randomness only from `Rng` streams (`map`, `encounters`,
`combat`, `rewards`, `shop`, `markers`, plus `map.fork('habitats')`); `run.ts` keeps
`lastCombat` so a fight's closing events can still animate; `returnToMap()` in `run.ts` is
where a node hands control back and where deferred content (Greeble-ambushed Shop/Cocoon, the
Snail's cart) is intercepted; the run is saved in `RunController.dispatch` _before_ the
animation plays (engine state is authoritative), and `readSave` sets aside any save lacking a
current `RunState` field, but bump `SAVE_VERSION` anyway on incompatible changes; families are
the identity (ADR 0007) — new mechanics act on a card's `bug`, not on single cards.

## The overnight run (2026-09-15 → 16), for the record

Owner asleep, agent unattended, one commit per item with the checkpoint kept in this file:
painted Shop/Cocoon scenes · Cocoon Rest/Forage/Pupate · habitats · six cards · Snail trail ·
Burrow · M5 · fuzz test · a cold Opus review (one latent freeze — a rejected animation promise
poisoning the playback chain — and intents lying under habitat mods, both fixed in `44a6cfd`).
Everything was approved the next morning. Ideas from his list deliberately not built:
collectable cyborg parts (Pupate is the "conditional evolution" he offered instead) and card
lifespan (Molt carries the flavour without the bookkeeping). If you work unattended again, do
it the same way: spec first, tests beside, checkpoint row per item, push after each.

## Known issues and loose ends

- **One unexplained one-off:** on the very first drag of one session, three cards were spent
  from a single gesture. Instrumented, never reproduced across many drags. No root cause found;
  `RunController.dispatch` now marks itself busy synchronously and the playback chain can no
  longer be poisoned by a throw. Watch for it.
- Desktop-only layout. The page loads on phones but the title overflows and touch is untested;
  spec lists touch as roadmap. Share the desktop link.
- GitHub Pages URLs are case-sensitive: `/Cardillion/` works, `/cardillion/` 404s. Renaming
  the repo to lowercase was offered to the owner and not decided.
- Both spider sprites keep a faint half-keyed shadow under the body; the owner accepted them —
  the art pass is the moment to lose it.
- Cosmetic, known and left: after a mid-fight reload the reward screen's "emerged" note is
  lost and the URL's `?seed=` is not refreshed.
- Reduce motion removes the film grain, which is a big part of the thicket's look. The spec
  asks for exactly that; if the owner wants a middle setting, `Post.setGrain` takes any amount.
- `enemy-rat-mutant.png` (the direction sample) sits uncommitted in `assets/art/`; delete it or
  fold it into the rat's real prompt when the art pass starts.

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13 (four rounds, every decision in
`spec.md` and the ADRs). The engine choice was gated on a look prototype the owner judged in
the browser. The owner asked for enemies "more realistic and gross, like Inscryption" (baked
into the thicket prompt prefix), then, on 2026-09-16, for the mutant direction above. The work
has run across several models and sessions; the lesson each time was the same — ask before
starting a milestone, keep commits small, and write the checkpoint in this file.

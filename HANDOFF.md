# Handoff — Cardillion

For an agent picking this project up cold. Read **START HERE**, then `CLAUDE.md` (the standing
rules), then the `spec.md` section for whatever you build next. First written 2026-09-15;
rewritten 2026-09-18 after the rat shipped and the possum's art was made.

## What this is

A single-player card-battler roguelike in the browser: cheerful cyborg garden bugs (cards) versus
grim, realistic vermin (enemies). Slay-the-Spire bones; an Inscryption-dark far side of the screen
fading into a Diceomancer-bright near side. Owner: Michael (`MichaelBoujikian` on GitHub). He
directs, agents build; he judges results by eye and approves art in batches.

- **Play it:** https://michaelboujikian.github.io/Cardillion/ — deployed from `main` on every
  push by `.github/workflows/deploy.yml`. Repo is **public** (Pages needs it on his plan).
- **Design source of truth:** `spec.md`. Vocabulary: `CONTEXT.md`. Why-decisions: `docs/adr/`.
- **Stack:** TypeScript · Vite · three.js · Vitest. Node 24 on Windows 11, Git Bash. CI runs
  Node 22.

## Where things stand

| Milestone (spec §13)    | Status                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| M0 scaffold             | done                                                                    |
| M1 look prototype       | done — owner passed the engine gate; web + three.js is settled          |
| M2 first playable fight | done                                                                    |
| M3 run loop             | done — title → map → fights/rewards/shops/cocoons → the Bear → result   |
| M4 content              | done — 20 cards, titled unlocks, upgrades, Wormillionaire, markers      |
| M5 systems              | done — autosave slot + Continue, settings panel, reduce motion          |
| M6 art                  | done for v1 (40 assets) — **the enemy art is being redone** (see below) |

Beyond the milestones (2026-09-15/16, all approved): painted Shop and Cocoon scenes; Cocoons
offer Rest / Forage / Pupate (Caterpillar → Chrysalis → Butterfly, spec §8.8); habitats under
half the fights (§8.9, ADR 0007); six more cards (§5.4); the Snail's pheromone trail (§8.6);
enemies breathe, lean and act with body motions (§11.2). Then the animation system (2026-09-16
→ 18): keyframe poses, clip-driven waiting states, cross-fades, eye tracking — all in §11.2.

126 tests pass; `npm run check` is green; CI and the Pages deploy are green.

**Balance:** nothing is balanced; every number is a first guess marked _(tuning)_.
`src/engine/fuzz.test.ts` plays 240 seeded runs and gives a first reading (greedy wins under
1%, the Bear kills ~40% of runs). **The owner's decision: balance gets its own dedicated test
sessions. Do not propose or make number changes in passing.**

## START HERE (2026-09-18)

**Read `docs/art-pipeline.md` "The recipe"** (the first section), then this. The owner reviews
by eye, wants one recommendation per question, approves art in batches, and is walked through
any account or API step (see "How to work here").

### The enemy art pass, creature by creature

Every vermin is being redone as a **mutant** — Fallout 3 centaur, the mutant not the horse-man:
skin torn or sloughed away, wet muscle, bundles of fleshy tentacles, **gross and gory** (spec
§11.1), as dark as the v1 art. Each is an edit of its v1 sprite, not a new creature, and gets
a waiting-state clip (loop + fidget), pose-sheet stills (wind-up, strike, hit) and, where it
has one, its special pose.

- **Rat — done, committed** (`f53442a`, 2026-09-17). Loop = a local Wan 2.2 clip in which only
  the mouth-tentacles sway (`enemy-rat-loop-01..45`); one fidget = the Sora clip's startle
  (`enemy-rat-startle-01..17`), the only movement from any model that came back to its own
  first frame; strike/hit stills from a gpt-image-2.5 pose sheet; `enemy-rat-rest` is the cutter's
  `--like` canvas. `enemy-rat.png` (v1) stays as a master, `"ship": false`, unreferenced.
  Rejected on the way (all recorded in
  `docs/local-video.md` and `docs/runway-api.md`): three cuts of a Wan head-turn clip, a
  tentacle-lash re-roll, four Runway/Veo renders — every model drifts off the pose within a
  second of a big movement; only Sora's small startle returned home.
- **Possum — done and committed (2026-09-18)**: `enemy-possum-loop-01..33`, `-retch-01..28`,
  `-windup/-attack/-hit/-rest`, and `enemy-possum-dead` is now the mutant Play Dead frame. The
  still is a gpt edit of the v1 possum with a belly-to-eye tentacle, then a **local klein edit,
  seed 4**, to put skin back over the ribs — his call: the gpt one was "a bit much" (kept as
  `art/out/enemy-possum-mutant-v1-gpt*.png`). The sheet `enemy-possum-mutant-poses.png`, the
  1024² dead master `enemy-possum-mutant-dead.png` and the still `enemy-possum-mutant.png` stay
  as `"ship": false` records; the v1 `enemy-possum` no longer ships but stays as the tone
  reference; the v1 dead render is `art/out/enemy-possum-dead-v1.png`. Loop: local Wan,
  tentacles sway (`possum2-loop-11` 0.3–3.0 s). Fidget: a **retch**, guts out and sucked back
  in (`possum2-retch-201` 0.75–1.92 s forward then back — his idea, after a hiss whose mouth
  spilled random shapes; prompts and seeds in `docs/local-video.md`). His two fixes before the
  yes: the eye glow was too big (`EYE_GLOW_MAX` 0.26 → 0.16, the rat's size) and Play Dead
  hopped sideways — the loop was cut with the old crop-centred placement (body 35 px right of
  the slot), the dead frame bbox-centred (12 px left); re-cut with the figure-anchored `--like`
  and the dead frame re-sliced with `--shift 24`, the hop is 11 px. Every frame went through
  `tools/art-redden.py` (one amber cluster). Sora refused this still's gorier gpt version
  twice; the klein one was never tried there.
- **Spider — done and committed (2026-09-18)**: `enemy-spider-loop-01..15`, `-jaws-01..30`,
  `-rear-01..38`, `-windup/-attack/-hit/-rest`; the v1 `enemy-spider` no longer
  ships. His brief: a thick furry tarantula like the wolf spider, eggs and spiderlings on its
  back, half a leg missing — and **no gore on it: "gory doesn't have to be in everything, just
  dark/morbid/evil"**. The still is the gpt sample with every red wound taken off by a local
  klein edit (seed 2; the gpt one is `art/out/enemy-spider-mutant-v1-gpt-raw.png`); the pose
  sheet is gpt in the **`thicket-morbid`** style (a plain `thicket` sheet put the wounds straight
  back), the wind-up after his photo of a rearing funnel-web (`art/refs/spider-threat-pose.png`,
  gitignored). Loop: the still tail of the Sora jaws clip. Fidgets, his call — **jaws** (Sora)
  and the **rear-up** (Wan `spider-rear-305`, both front pairs spread and rise, a ping-pong of
  its first 1.58 s so it lands home) — and nothing else. A **Spin Web clip** (Wan
  `spider-web-501`, both back legs rise and settle) was cut in through the new `poses.moves`
  seam and **taken out at his word** — the seam stays, unused, for whenever the web move gets
  its animation (the clip is on disk). Rejected on the way: sections of the
  Sora leg-wave clip (they land off the loop — "fading into a different spot afterwards");
  two Wan single-leg lifts (`spider-leg-411`/`-412`, fine moves whose raised tip left the top
  of the video; four portrait-frame re-rolls, `spider-leg-431..434` via `video:local --size
704x1280`, kept the leg in frame but none landed home); a leg prompt that led with "holds
  still" (nothing moved); Sora rear-ups at 85 % (legs out of frame) and 60 % (reframed).
  The raised legs need headroom, so the set sits on an **848 × 848 canvas** (slicer
  `--width/--height`) with `height: 3.8` on the row. The sheet `enemy-spider-mutant-poses.png`
  and the still `enemy-spider-mutant.png` stay as `"ship": false` records.
- **Bug chapel — first render made** (`bg-chapel`, uncommitted): his brief, a place to choose a
  blessing like the cocoon and the snail's stall — inside a bright gothic cathedral of woven
  twigs, sunlight from windows on the left onto a white marble praying mantis, floor open across
  the bottom. Not wired to a node yet (no phase, no screen); the statue came out small and far,
  and the far end is as bright as the front — both flagged to him.
- **Still to do:** `enemy-scorpion`, `enemy-greeble` (Unseen: alphaTest 0, so its edges must
  be clean), `enemy-rat-king`, `enemy-wolf-spider` (the elite; same family as the spider,
  escalated), `boss-bear` (sample entries need `"size": "1024x1536"`). `boss-moose` is act 2.

### Where each clip comes from now

| Route                   | Command                | Cost                          | Takes                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local Wan 2.2 5B        | `npm run video:local`  | free, ~2.5 min per 3 s        | anything (no policy). Drifts within a second of a big movement; fine for tentacles-only loops. Prompts must lead with the action (`docs/local-video.md`).                                                                                                                                                                                                                                                                                              |
| OpenAI Sora 2 Pro       | `npm run video:sora`   | ~$2.40 per 8 s                | the rat's and the spider's stills, not the possum's (its input filter refused the eye-socket tentacle and open ribs). **Shuts down 2026-09-24.** The only model that returned to pose — for small moves (a startle, a jaw). Keep the figure at the default 85 % of the frame: at `--height 0.6` it re-framed the shot into a close-up of a redrawn spider and drifted the green to blue; at 85 % a rearing creature's legs leave the top of the frame. |
| Runway (gen4, Veo 3.1…) | `npm run video:runway` | 25–100 credits per clip       | the rat's still, not the possum's (`SAFETY.INPUT.MULTIMODAL`, charged). Draws movement better than Wan, drifts like everyone. **230 free credits left.**                                                                                                                                                                                                                                                                                               |
| Local FLUX.2 klein      | `npm run image:local`  | free, ~5 s                    | still edits with no policy (the possum's less-gore pass). Keeps the character, not the colours — say "near-black, dim light" or it bleaches.                                                                                                                                                                                                                                                                                                           |
| gpt-image-2.5           | `npm run art`          | ~$0.21 a still, $0.17 a sheet | the stills and sheets; `moderation: low`; passed everything asked of it so far.                                                                                                                                                                                                                                                                                                                                                                        |

Records: every Runway/Sora job writes `art/out/video/<out>.json`; the local prompts live in
`art/out/video/*-prompts.txt`. **All of `art/out/` is gitignored** — copy the prompt and seed of
any clip you keep into a tracked doc (`docs/local-video.md` has the rat's).

### Renderer facts (spec §11.2, `src/render/battle/scene.ts`)

- A creature's row: `art` (= `loop-01`), `deadArt`, `poses.windup/attack/hit`, `poses.loop`
  (played back and forth), `poses.fidgets` (a **list**, played in turn; each creature starts
  on a different one) and `poses.moves` (a clip per **move id**, played once instead of the
  loop while that move's body motion runs — built for the spider's Spin Web, unused since he
  dropped that clip; `act(uid, kind, move)` starts it, `endMove` hands back). `frames()` in `enemies.ts` builds the id lists;
  `poseArtIds` feeds them to the loader. `content.test.ts` enforces `loop.frames[0] === art`,
  fidgets and move clips only with a loop, no frame shared with it, a move clip's key is one of
  the creature's moves, every id distinct. `poses.idle` (cross-faded stills) still
  exists in the type but is superseded by clips — do not make idle sheets.
- Sprites stand on their picture's ground line (`findGroundLine`) via `baseY`; the shadow
  ellipse sits back; at rest a creature only breathes and leans in. Rows below the ground line
  (claw tips, a rope of guts) sink into the moss by design; the hit box's top and the head
  label follow `baseY`, its bottom and the feet anchor stay at the table.
- Keyframes cross-fade (`setPose` + ghost). Clip handovers cross-fade differently: the outgoing
  frame stays **solid** under the incoming clip (`FIDGET_IN_FADE_MS` 150, `FIDGET_OUT_FADE_MS` 300) because `alphaTest 0.35` turns a two-sided dissolve into old-only → both → new-only with
  a see-through dip. A fidget interrupted by a strike or hit ends; the loop restarts at frame 0.
- The fidget only starts as the loop turns at its first frame: a 45-frame loop turns every
  7.3 s, so that — not the 2.5–6 s offset, a per-sprite constant — sets the rhythm.
- The eye glow follows the clip (`trackEyes`, each frame's eye found once and cached; a frame
  with no findable eye keeps the last position) and glides across keyframe fades (`eyeGlide`). Creatures use their own glow material
  (`EYE_GLOW_INTENSITY` 4, `EYE_GLOW_SCALE` 3, max 0.26); the far eyes keep the brighter one.
- Play Dead: `setRestPose` makes the dead pose the rest pose until the creature acts (the hit
  hold used to snap it back to standing); the clip plays only while the pose is its own art
  (`clipArt`).
- Lights: the warm spill over the enemy row is a 0.55 rad cone so the side slots (x = ±3.6)
  are lit; before 2026-09-18 they were silhouettes.
- **Brightness policy:** frames are tone-matched to `enemy-possum` (v1, brightness 0.135), not
  to each creature's own v1 sprite — the rat matched to its own (0.088) was "so dark you can't
  see much" and was re-toned with `npm run art:tone`.
- GPU memory: one `THREE.Texture` per frame **per sprite**, 992×560 ≈ 2.9 MB each — the rat's
  62 frames ≈ 180 MB per rat on screen. Keep loops ~30–45 frames and fidgets short.

### Things that bite

- `art:video` cuts one loop and one fidget per run and crops every frame to that run's union;
  frames from two runs sit a few pixels apart. Cut a creature's loop and fidget **together**;
  a second fidget needs a repeatable `--fidget` (not built) or a PIL translation (the rat's
  startle was aligned by its rump).
- `--fidget-pingpong` ends one frame before where it began (the ends are not repeated).
- The cutter never deletes stale frames: delete the old `<out>-fidget-*` PNG + WebP before a
  re-cut with fewer frames.
- Every frame the game places a glow on must have **one** amber cluster (the finder keeps up to
  two): a wound that reads amber gets a glow. The slicer protects the eye from the tone pass;
  `python3 tools/art-redden.py <frames>` keeps the leftmost cluster and pushes the rest to red
  (run it on every new frame set; worth porting into `art-poses`).
- The v1 possum had **no** findable amber eye; every mutant prompt says "glowing amber eye".
- Sheets and direction samples stay in `assets/art` as the record with `"ship": false` in the
  manifest: `art:optimize` gives them no WebP. `npm run art` skips them only because the PNG
  exists — `--force` would regenerate (and overwrite the raw), `ship` means nothing to it.
- Regenerating an id with `subject` = itself overwrites `art/out/<id>-raw.png`: copy the raw to
  `<id>-vN-<why>-raw.png` first (the possum's gpt raw is `enemy-possum-mutant-v1-gpt-raw.png`).
- `"key": null` does not disable the chroma key; `"key": false` does.
- Wan: 5 s max useful, one movement per clip; prompts that open with "sits still … holds
  still" come out motionless; it moves jaws and tentacles readily, heads rarely.

## Then: the metamorphosis grilling session

The owner wants metamorphosis to be a mechanic for **multiple bugs**, not just the Caterpillar,
and he wants it designed _with him_ (the `grilling` skill — one recommendation per question; he
answers "go with your recommendation" when he agrees). **Do not build stages for other bugs
before that session's answers are in `spec.md` §8.8.** What exists: `PUPATION` in
`src/content/cards.ts` maps Caterpillar → Butterfly and Munch → Flutter; emergence is generic,
but the pupa card `chrysalis` is hard-coded in `run.ts` (`pupate`), the fuzz invariant, the
cocoon copy and the reward note, so one pupa per bug is more than a content row. The only
Cocoon every run guarantees is the one before the Boss, and a boss win skips `emerge` — Pupate
there is a trap; question one. Other questions: what each bug becomes (the Ladybug already _is_
the adult; Roly Poly, Chameleon and the Cat — his real cat — have no obvious stage); upgrade or
sideways change of family; chaining; whether the Cocoon is the only place (Molt exists as a
card); whether Pupate competing with Rest and Forage is a problem or the point. Two ideas from
his list were deliberately not built and are not in the spec: collectable cyborg parts (Pupate
is the "conditional evolution" offered instead) and card lifespan (Molt carries the flavour).
Record the outcome in §8.8 and the tuning log, then add rows.

## How to work here (the parts CLAUDE.md doesn't say)

**Owner's style.** He answers rounds of questions with "go with your recommendation", so offer
one clear recommendation per question. When he asks _what the next step is_, or floats an idea
with "don't do this yet", **answer — don't build**. He likes a **sample** before a decision.
He wants generated art shown to him before it is committed (`SendUserFile` — he reads on his
phone, so send a PNG grid next to any mp4), and to be walked through account/API steps. His
messages are speech-to-text; ask when a word doesn't parse ("cacoon", "our direction" = art
direction, "bard seed 103" = bark seed 103). He reviews in batches; when working unattended
keep a checkpoint list here, one commit per item.

**Pushing.** `gh` is authenticated but configured for SSH, and github.com's host key isn't
trusted on this machine. Push with:

```bash
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

Commits go straight to `main` with the attribution line the session gives you. CI takes ~1
minute; the fuzz tests have a 60 s budget because CI's runner is slower than this machine.
**Never `git add -A`**: unapproved art sits uncommitted in `assets/art` and `public/art` — add
paths by name.

**The Bash tool truncates long commands** (~8 KB); the failure looks like an unterminated
quote and nothing runs. Write a Python edit script with the Write tool into the session
scratchpad (exact `(old, new)` pairs with `assert s.count(old) == 1`), run it with `python3`
(the one with PIL; `python` is a bare 3.13), then `npx prettier --write` the touched files —
prettier reflows markdown tables, so match padded rows. Use raw strings for anything with
`C:\Users`.

**Verifying visuals.** `preview_start` with the `dev` launch config (the desktop app stops the
server between days — restart it); if another chat holds :5173 the tool says so, just
`navigate`. `resize_window` to 1280×720 before screenshots. HMR reloads the page on any `.ts`
edit, so re-stage after editing. URL overrides for a run: `?seed=` `?deck=cat,cat,roly-poly`
`?hp=999` `?crumbs=500`. In dev, `window.__cardillion` exposes `controller`, `screens`,
`autoFight()` and `autoRun(stopAt?)`. `controller.run` is a plain object you can edit from the
console: to stage any fight, enter one and replace `c['run'].combat.enemies` with hand-built
instances (`{uid, def, hp, maxHp, statuses:{}, intent, lastMove:null, uses:{},
playedDead:false, playingDead:false, patternIndex:0, enraged:false}`), then
`c['scene'].setEnemies(enemies)` and `c['battle'].render(combat)`. To stand on any map node
without markers interfering: `c['run'] = {...c.current, position: node.prev[0], snailNode: null,
snailReturnIn: 99, greebleNode: 'boss'}` then dispatch a travel. `autoRun('shop')` plays until
the run's phase is `shop` (`cocoon`, `reward`, `map` work too). Private fields are reachable
at runtime (`c['scene']['sprites']`, a sprite's `seq`, `fade`, `ghost`, `eyes`). **When the
Browser pane is hidden, `requestAnimationFrame` stops**: drive the scene by hand — `let t =
sc['now']; for (…) { t += 1/30; sc.update(1/30, t); } sc.render()` — and never let a hand
clock run ahead of the app's on a visible pane. The JS tool times out at 45 s. On-screen
brightness can be measured by drawing the renderer canvas to an offscreen one and averaging
`enemyRect` (how the lighting change was checked). JS tool results over ~250 KB land in a file
under `tool-results/`, sometimes double-encoded — return numbers, not pixels.

Useful seeds: `garden1` two rats plus a Greeble in the first fight (`t0-0`), `s3` a possum on
a Flower Patch, `s0` spider, `s5` scorpion + Greeble, `g52` a short winnable trail. Deck
overrides: `?deck=worm-swarm,wormillion,drill-worm,scavenge,molt,stink-cloud,burrow,caterpillar`.

**Keys.** `.env` (gitignored, never printed) holds `OPENAI_API_KEY` and `RUNWAYML_API_SECRET`;
`tools/lib/env.mjs` reads it. `COMFYUI_DIR` and `FFMPEG` are process-environment overrides
with working defaults (`C:\Users\smite\ComfyUI_windows_portable`, `art/out/bin/ffmpeg.exe`).
The Cat cards portray **his real cat** from `art/refs/owner-cat.png` (gitignored). Spend so
far: roughly $16–18 on OpenAI images (check the usage page), Sora ≈ $10.80 (the rat's clip and
the spider's four: jaws, wave, two failed rear-ups; the two blocked possum jobs and the rat's
blocked "vicious bite" job were probably
not billed), 270 of the 500 free Runway credits.

## Architecture in one screen

```
src/engine/   pure rules. rng.ts (seeded, forkable) · types.ts (row shapes live HERE) ·
              combat.ts (fight reducer; CombatMods carry upgrade + habitat effects; pending
              delayed effects) · map.ts (three signposted trails, two crossings, fog,
              habitats) · run.ts (run reducer: travel, rewards, shops, cocoon choices +
              metamorphosis, markers, the Snail's trail) · fuzz.test.ts
src/content/  data tables: cards.ts (20 + Cobweb; PUPATION) · enemies.ts (art, deadArt,
              poses) · encounters.ts · trails.ts · habitats.ts · upgrades.ts
src/render/battle/  scene.ts (table, lights, sprites: body group, keyframe poses, clip
              sequences, eye glow, act() per move) · post.ts (bloom, grain, vignette) ·
              textures.ts (card faces, art loader, eye and ground-line finders, placeholders)
src/ui/       battle-ui.ts (hand, HUD, intents, targeting) · run-screens.ts (title, map,
              reward, shop, cocoon, result, settings) · card-faces.ts
src/app/      index.ts (boot, art ids, storage, settings, dev hooks) · run-controller.ts
              (dispatch → save → animate → screen) · animate.ts (combat events → scene calls)
src/save/     store.ts · save.ts (one slot, versioned + shape-checked) · settings.ts — pure
tools/        gen-art.mjs (OpenAI Images: generate, edit with `subject`/`referenceRole`,
              chroma key) · art-poses.mjs (sheet slicer) · art-video.mjs (clip cutter) ·
              art-tone.mjs (re-tone frames) · art-optimize.mjs (PNG → WebP, honours
              `ship: false`) · art-preview.mjs · gen-video-local.mjs / gen-image-local.mjs
              (ComfyUI) · gen-video-runway.mjs · gen-video-sora.mjs · lib/{chroma,comfy,
              env,frames}.mjs · workflows/*.json (ComfyUI graphs)
```

Rules that matter when you touch it: the engine emits **events** and the renderer only
animates from them (ADR 0003) — when an animation needs a cue, add an event; content names
every image it uses (`art`, `upgradedArt`, `deadArt`, everything under `poses`) and
`src/app/index.ts` collects the ids for the loader, which fetches `public/art/<id>.webp` — a new
top-level image field must be added there; randomness only from `Rng` streams (`map` →
`habitats`, `markers`, `encounters`, `rewards`, `shop`; each fight is seeded from
`"<seed>:combat:<node id>"`); `applyAction(state, action)` carries the RNG state inside the
state; `returnToMap()` in `run.ts` is where deferred content (an ambushed Shop/Cocoon, the
Snail's cart) is intercepted; the run is saved in `RunController.dispatch` _before_ the
animation plays; `run.ts` keeps `lastCombat` so a fight's closing events can still animate; a
new top-level `RunState` field invalidates every existing save (the player sees a "set aside"
notice) without any `SAVE_VERSION` bump — put per-card state on `CardInstance`, or bump the
version knowingly; families are the identity (ADR 0007) — new mechanics act on a card's `bug`;
the moves' amplitudes are literals in `poseBody` (`scene.ts`) — a per-creature nudge means a
seam on `EnemyDef`, not a tweak. ESLint enforces the layering for `engine` and `content` only.

## Known issues and loose ends

- **One unexplained one-off:** on the very first drag of one session, three cards were spent
  from a single gesture. Never reproduced; `RunController.dispatch` marks itself busy
  synchronously and the playback chain can no longer be poisoned by a throw. Watch for it.
- Desktop-only layout; the title overflows on phones and touch is untested (roadmap).
- GitHub Pages URLs are case-sensitive: `/Cardillion/` works, `/cardillion/` 404s.
- Both v1 spider sprites keep a faint half-keyed shadow under the body — lose it in the spider
  pass ("no shadow under the body").
- After a mid-fight reload the reward screen's "emerged" note is lost and `?seed=` is not
  refreshed. Cosmetic.
- Reduce motion removes the film grain; `Post.setGrain` takes any amount if a middle setting
  is wanted.
- Elite-reward upgrade choice and boss rares (spec §3, §5.2, §6.2) are not implemented; the
  spec marks them.
- `disposeSprite` leaks the shadow blob's geometry/material (minor).
- Clip textures are per sprite, not per creature (see GPU memory above).

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13; the engine choice was gated on a
look prototype the owner judged in the browser; an unattended overnight run (2026-09-15 → 16)
built the Cocoon choices, habitats, six cards, the Snail trail and M5, one commit per item with
a checkpoint kept here. The owner asked for enemies "more realistic and gross, like
Inscryption", then, on 2026-09-16, for the mutant direction, and one edited rat sold it. The
rat took 2026-09-16/17: pose sheets, a Sora clip, a local rig (ComfyUI, Wan 2.2, FLUX.2 klein,
Z-Image — `docs/local-video.md`, `docs/local-image.md`), eleven Wan re-rolls, four Runway/Veo
renders, and a cross-fade for the clip handovers. The lesson each time: ask before starting a
milestone, keep commits small, write the checkpoint here, and show him a sample.

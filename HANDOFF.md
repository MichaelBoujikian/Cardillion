# Handoff — Cardillion

For an agent picking this project up cold. Read **START HERE**, then `CLAUDE.md` (the standing
rules), then the `spec.md` section for whatever you build next. First written 2026-09-15;
rewritten 2026-09-18 (morning) after the rat shipped; refreshed 2026-09-18 (night) after the
possum and the spider shipped, and 2026-09-19 after the possum's fidgets were settled.

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
→ 18): keyframe poses, clip-driven waiting states, cross-fades, eye tracking, the settle — all
in §11.2.

126 tests pass; `npm run check` is green; CI and the Pages deploy are green at `54dcf3e`.

**Balance:** nothing is balanced; every number is a first guess marked _(tuning)_.
`src/engine/fuzz.test.ts` plays 240 seeded runs and gives a first reading (greedy wins under
1%, the Bear kills ~40% of runs). **The owner's decision: balance gets its own dedicated test
sessions. Do not propose or make number changes in passing.**

## START HERE (2026-09-18, night)

**Read `docs/art-pipeline.md` "The recipe"** (the first section), then this. The owner reviews
by eye, wants one recommendation per question, approves art in batches, and is walked through
any account or API step (see "How to work here").

### What is committed, what is not

The possum's fidgets are settled and committed (2026-09-19): **bark** (`enemy-possum-bark-01..22`)
and **tug** (`enemy-possum-tug-01..72`, Wan 272 — the whole 3 s clip forward then reversed);
the retch frames (`enemy-possum-retch-01..28`) stay committed on disk but out of the row. With
them went the renderer seams (`settleMs`, the sink, the 1–2.5 s gap, and the **fidget gate
fix** — see "Renderer facts"), the cutter's `--hold-colour` and `--fidget-reverse`, and the
docs. The lesson of that tug, written down so it is not repeated: he could see the tug in the
clip and not in the game because the first cut used only the clip's opening 1.25 s (a
few-pixel dip) — **when he says "play it forwards and in reverse" he means the whole clip.**
A different tug was made along the way (klein pose + Wan release, `docs/local-video.md`) and
not applied; he had not asked for a new clip.

Still uncommitted, waiting on him:

- **The bug chapel** (`bg-chapel`, `assets/art/bg-chapel.png` + its WebP; its manifest entry
  IS committed): his brief, a place to choose a blessing like the cocoon and the snail's stall —
  a bright gothic nave of woven twigs, petal windows on the left, sunbeams on a white marble
  praying mantis, floor open across the bottom. Not wired to any node, phase or screen; he has
  seen it once and said nothing yet. Flagged to him: the statue came out small and far, and the
  far end is as bright as the front (no Garden→Thicket gradient).

Commit the chapel render on its own yes. **Next up: the scorpion** (his brief, 2026-09-19:
"a dark, sadistic scorpion, similar to what we used for the spider, a broken pincer would be
good, maybe a split back with larvae coming out").

### The enemy art pass, creature by creature

Every vermin is being redone as a **mutant** — Fallout 3 centaur, the mutant not the horse-man:
skin torn or sloughed away, wet muscle, bundles of fleshy tentacles, as dark as the v1 art.
Gore is not mandatory any more: on 2026-09-18 he said **"gory doesn't have to be in everything,
just dark/morbid/evil"** and the spider has none (the `thicket-morbid` style block in
`art/manifest.json` is the thicket look with the gore sentences removed). Each creature is an
edit of its v1 sprite, not a new creature, and gets a waiting-state clip (loop + fidgets),
pose-sheet stills (wind-up, strike, hit) and, where it has one, its special pose.

- **Rat — done, committed** (`f53442a`, 2026-09-17). Loop = a local Wan 2.2 clip in which only
  the mouth-tentacles sway (`enemy-rat-loop-01..45`); one fidget = the Sora clip's startle
  (`enemy-rat-startle-01..17`); strike/hit stills from a gpt-image-2.5 pose sheet;
  `enemy-rat-rest` is the cutter's `--like` canvas. `enemy-rat.png` (v1) stays as a master,
  `"ship": false`. The startle frames were hand-translated onto the loop (the cutter of the
  time centred each run's crop): **re-cut the rat's loop only together with its startle**, or
  they part by 83 px. Rejected on the way (`docs/local-video.md`, `docs/runway-api.md`): three
  cuts of a Wan head-turn, a tentacle-lash re-roll, four Runway/Veo renders.
- **Possum — done, committed** (`e59f1e0`, 2026-09-18): `enemy-possum-loop-01..33` (local Wan,
  only the tentacles sway), `-retch-01..28` (guts out and sucked back in — a ping-pong), stills
  `-windup/-attack/-hit/-rest`, and `enemy-possum-dead` is the mutant Play Dead frame. The
  still is a gpt edit of the v1 possum (belly-to-eye tentacle) then a **local klein edit, seed
  4**, that put skin back over the ribs — his call; the gpt version is
  `art/out/enemy-possum-mutant-v1-gpt*.png`. Records with `"ship": false`:
  `enemy-possum-mutant.png`, `-poses.png`, `-dead.png`; the v1 `enemy-possum` no longer ships
  but stays as **every creature's tone reference**. His two fixes before the yes: the eye glow
  was too big (`EYE_GLOW_MAX` 0.26 → 0.16, the rat's) and Play Dead hopped sideways (the loop
  re-cut with the figure-anchored `--like`, the dead frame re-sliced with `--shift 24`).
  **Then the fidget trial** (committed 2026-09-19, above): he wanted a retch whose guts fall to the floor
  and pile up, to fade out afterwards. Four Wan batches (`possum2-floor-211..236`, `possum3-*`,
  prompts in `art/out/video/possum-prompts.txt`): the first bowed into the heap, the second
  held the pose but bled magenta or green, the third pinned the fur in the prompt and negative
  and gave `233` — poured, piled, planted — which he called close but not it ("it would be
  perfect if it were just coming out of his mouth"); a last batch of subtle fidgets (a bark, a
  hind-leg scratch, a paw tug on the tentacle, a mouth-first retch) gave the **bark** (`252`,
  jaws snap open into a hiss; first 0.92 s forward-then-back) and the **tug** (`272`, the head
  dips toward the tentacle, then lifts with the jaws parting; the whole 3 s forward-then-back,
  72 frames — committed 2026-09-19 with the bark), both cut with `--hold-colour`. Sora blocks
  both possum stills (gpt and klein) at its input step, so the possum is Wan-only.
- **Spider — done, committed** (`54dcf3e`, 2026-09-18): `enemy-spider-loop-01..15` (the still
  tail of a Sora jaws clip), fidgets **jaws** (`-jaws-01..30`, Sora) and **rear-up**
  (`-rear-01..38`, Wan `spider-rear-305`: both front pairs spread and rise like his photo of a
  funnel-web, a ping-pong of its first 1.58 s), stills `-windup/-attack/-hit/-rest` from a gpt
  sheet in `thicket-morbid` (a plain `thicket` sheet put the wounds straight back), the wind-up
  after `art/refs/spider-threat-pose.png` (his photo, gitignored). The still is the gpt sample
  with every wound taken off by a klein edit (seed 2; gpt one:
  `art/out/enemy-spider-mutant-v1-gpt-raw.png`). The raised legs need headroom, so the set sits
  on an **848 × 848 canvas** (slicer `--width/--height`) and the row's **`height: 3.8`** puts
  the spider back at a common creature's size. A **Spin Web clip** (Wan `spider-web-501`, back
  legs rise and settle) was cut in through `poses.moves` and taken out at his word; the seam
  stays, unused; he said the cobweb move "might need some work". Rejected: sections of the Sora
  leg-wave clip (land off the loop — "fading into a different spot afterwards"), two Wan
  single-leg lifts (`spider-leg-411/-412`: good moves, raised tip left the top of the video;
  portrait re-rolls `431..434` via `video:local --size 704x1280` kept the leg in frame but none
  landed home), Sora rear-ups at 85 % (legs out of frame) and 60 % (it re-framed the shot).
- **Still to do:** `enemy-scorpion` (next), `enemy-greeble` (Unseen: alphaTest 0, so its edges
  must be clean), `enemy-rat-king`, `enemy-wolf-spider` (the elite; same family as the spider,
  escalated; its v1 sprite carries a half-keyed shadow — say "no shadow under the body"),
  `boss-bear` (sample entries need `"size": "1024x1536"`). `boss-moose` is act 2.

### Where each clip comes from now

| Route                   | Command                | Cost                          | Takes                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Wan 2.2 5B        | `npm run video:local`  | free, ~2.5 min per 3 s        | anything (no policy). Drifts within a second of a big movement; fine for tentacles-only loops and one small action. **Colour drift** after ~1.5 s (magenta or green into the fur): pin the fur in the prompt and negative, cut early, `art:video --hold-colour`. `--size 704x1280` for headroom; a smaller figure in the frame made it worse. Prompts must lead with the action. |
| OpenAI Sora 2 Pro       | `npm run video:sora`   | ~$1.20 per 4 s, $2.40 per 8 s | the rat's and the spider's stills; **not the possum's** (both stills blocked at the input step). **Shuts down 2026-09-24.** The only model that returned to pose — for small moves (a startle, a jaw). Keep the figure at the default 85 % of the frame: at `--height 0.6` it re-framed the shot; at 85 % a rearing creature's legs leave the top.                               |
| Runway (gen4, Veo 3.1…) | `npm run video:runway` | 25–100 credits per clip       | the rat's still, not the possum's (`SAFETY.INPUT.MULTIMODAL`, charged). Draws movement better than Wan, drifts like everyone. **230 free credits left.**                                                                                                                                                                                                                         |
| Local FLUX.2 klein      | `npm run image:local`  | free, ~5 s                    | still edits with no policy (the possum's less-gore pass, the spider's no-gore pass). Keeps the character, not the colours — say "near-black, dim light" or it bleaches.                                                                                                                                                                                                          |
| gpt-image-2.5           | `npm run art`          | ~$0.21 a still, $0.17 a sheet | the stills, sheets and scenes; `moderation: low`. The style prefix wins over the entry — a `thicket` sheet of a clean still gets its wounds back; use `thicket-morbid`.                                                                                                                                                                                                          |

Records: every Runway/Sora job writes `art/out/video/<out>.json`; the local prompts live in
`art/out/video/*-prompts.txt`. **All of `art/out/` is gitignored** — copy the prompt and seed of
any clip you keep into `docs/local-video.md` (it has the rat's startle, the possum's and the
spider's; the prompt behind the rat's loop clip `rat-B3-bob` was never written down).

### Renderer facts (spec §11.2, `src/render/battle/scene.ts`)

- A creature's row: `art` (= `loop-01`), `deadArt`, `poses.windup/attack/hit`, `poses.loop`
  (played back and forth), `poses.fidgets` (a **list**, played in turn; each creature starts on
  a different one; a fidget may carry `settleMs`) and `poses.moves` (a clip per **move id**,
  played once instead of the loop while that move's body motion runs; `act(uid, kind, move)`
  starts it, `endMove` hands back; nothing uses it yet). `frames()` in `enemies.ts` builds the
  id lists; `poseArtIds` feeds them to the loader. `content.test.ts` enforces
  `loop.frames[0] === art`, fidgets and move clips only with a loop, no frame shared with it, a
  move clip's key is one of the creature's moves, every id distinct. `poses.idle` still exists
  in the type but is superseded by clips — do not make idle sheets. `height` on a row overrides
  the tier's billboard height (spec §11.4) for a canvas with headroom.
- Sprites stand on their picture's ground line (`findGroundLine`) via `baseY`; the shadow
  ellipse sits back; at rest a creature only breathes and leans in. Rows below the ground line
  (claw tips, a rope of guts) sink into the moss by design.
- Keyframes cross-fade (`setPose` + ghost). Clip handovers cross-fade differently: the outgoing
  frame stays **solid** under the incoming clip (`FIDGET_IN_FADE_MS` 150, `FIDGET_OUT_FADE_MS` 300) because `alphaTest 0.35` turns a two-sided dissolve into old-only → both → new-only. A
  fidget interrupted by a strike or hit ends; the loop restarts at frame 0.
- **The settle** (2026-09-18): with `settleMs`, the outgoing frame's ghost lingers
  after the loop is fully in and fades over that time (a heap on the floor dissolving). And at
  every hand-back the **sink** compares where the clip's last frame and the loop's first put
  the eye: the loop frame arrives offset by that difference (0.065 units up for the possum's
  floor retch), plane and glow together, and eases to rest on a cosine over dissolve + settle
  (≥ 0.6 s) — the creature comes back down instead of morphing. Zero where the eyes line up.
- The fidget only starts as the loop turns at its first frame: a 45-frame loop turns every
  7.3 s, a 33-frame one every 5.3 s, so that — not the 1–2.5 s gap (was 2.5–6 s until
  2026-09-18) — sets the rhythm; in practice one fidget every turn or two. The turn is
  **counted** (`seq.turn`, 2026-09-19): a fidget used to start only when an update landed on
  the loop's first frame, an 83 ms window, and at 2 fps (the Browser pane while it is not the
  focused pane) it fired 3 times in 4 minutes; counting turns gives 30, the same as at 60 fps.
- The eye glow follows the clip (`trackEyes`, each frame's eye found once and cached; a frame
  with no findable eye keeps the last position) and glides across keyframe fades (`eyeGlide`).
  Creatures use their own glow material (`EYE_GLOW_INTENSITY` 4, `EYE_GLOW_SCALE` 3,
  `EYE_GLOW_MAX` 0.16 — the rat's size; the possum's bigger painted eye used to earn 0.24).
- Play Dead: `setRestPose` makes the dead pose the rest pose until the creature acts; the clip
  plays only while the pose is its own art (`clipArt`).
- Lights: the warm spill over the enemy row is a 0.55 rad cone so the side slots (x = ±3.6)
  are lit.
- **Brightness policy:** every creature's frames are tone-matched to `enemy-possum` (v1,
  brightness 0.135) — `--tone enemy-possum` in every slicer and cutter run.
- GPU memory: one `THREE.Texture` per frame **per sprite** — the spider's 87 frames at 848² ≈
  250 MB per spider on screen. Keep loops ~15–45 frames and fidgets short.

### The tools, as they are now

- `npm run art:poses -- --sheet <id> --names a,b,c [--out p] [--like frame] [--tone id]
[--width px] [--height px] [--shift px]` — slices a sheet onto one canvas; `--width/--height`
  ask for headroom (the spider), `--shift` moves every frame sideways (the possum's lying dead
  pose, whose bounding box is centred but whose body is not).
- `npm run art:video -- --video <mp4> --out <prefix> (--loop t0:t1 | --anchor t) [--fidget
[name=]t0:t1 …] [--fidget-video mp4] [--fidget-pingpong] [--fidget-reverse] [--like frame]
[--tone id] [--eyes 1|2] [--hold-colour]` — `--fidget` repeats and names its sections
  (`<out>-<name>-NN`); `--fidget-reverse` plays a section backwards first (a clip that starts
  in the pose becomes a fidget that starts at rest; unused so far);
  `--anchor t` cuts fidgets from a second video of the same creature with no loop, landing on
  the same placement because `--like` stands each run's first frame on the reference figure's
  bottom-centre; `--eyes 2` for a front-facing creature; a briefly-lost eye is painted where it
  was last seen (up to 8 frames); frames shared by two segments are relit once; the overflow
  warning names the canvas the slicer would need.
- `python3 tools/art-redden.py <frames>` (one amber cluster per frame, the rest pushed to red —
  gory creatures) and `python3 tools/art-unred.py <frames>` (red and pink to dark brown, eyes
  kept — clean creatures; Wan paints pink into leg tips and smears).
- `npm run video:local -- --image png --out name --prompt … [--size WxH] [--seconds n] [--seed
n] [--keep-server]`; `npm run video:sora -- … [--height 0.85]`; `npm run image:local --
--edit png …`; `npm run art:tone`, `art:optimize` (honours `"ship": false`), `art`.
- Stop ComfyUI after a batch (it holds ~2 GB VRAM idle): PowerShell
  `Get-Process python | Where-Object { $_.Path -like "*ComfyUI_windows_portable*" } | Stop-Process`.

### Things that bite

- **A hidden Browser pane freezes the game's clock** (`requestAnimationFrame` stops), and a
  showing pane that is not the app's focused pane draws **~2 frames a second** (measured
  2026-09-19 with `document.hidden === false`): no fidget, no fade, nothing moves until the
  pane is showing, and everything crawls until it is looked at. Check `document.hidden` and
  count `requestAnimationFrame` ticks before concluding an animation is broken. To test while hidden, step the scene by hand — but that
  runs the sprite's timers (`nextFidgetAt`, `q.start`) ahead of the app's clock, and on a
  visible pane nothing will fire until the real clock catches up: **reset `nextFidgetAt = 0`
  and `q.start = sc.now` after stepping, or stage a fresh fight.** This cost an hour on
  2026-09-18.
- Every frame the game places a glow on must have **one** amber cluster per eye (the finder
  keeps up to two): a wound that reads amber gets a glow. The slicer protects the eye from the
  tone pass; run `art-redden.py` on gory frame sets.
- The v1 possum had **no** findable amber eye; every mutant prompt says "glowing amber eye".
- Sheets and direction samples stay in `assets/art` as the record with `"ship": false` in the
  manifest: `art:optimize` gives them no WebP. `npm run art` skips them only because the PNG
  exists — `--force` would regenerate (and overwrite the raw), `ship` means nothing to it.
- Regenerating an id with `subject` = itself overwrites `art/out/<id>-raw.png`: copy the raw to
  `<id>-vN-<why>-raw.png` first.
- `"key": null` does not disable the chroma key; `"key": false` does.
- The cutter never deletes stale frames: delete the old `<out>-<name>-*` PNG + WebP before a
  re-cut with fewer frames. A content edit reloads the page before `art:optimize` has written
  the new WebPs — reload once more or the loader drops the fidget silently.
- `--fidget-pingpong` ends one frame before where it began (the ends are not repeated).
- Wan: 5 s max useful, one movement per clip; prompts that open with "holds still … then
  slowly" come out motionless — the action leads; it moves jaws and tentacles readily, heads
  rarely, legs when told to swing them; it regrows a torn-off leg at a peak. **It will not
  lift a paw from a rest still** (14 tries on the possum) but it brings a raised one down: have
  klein paint the pose and animate the return (`docs/local-video.md`). Its colour drift goes
  toward the screen colour, and five of twelve possum clips collapsed to green within a
  second whatever the negative said.
- A frame's WebP is what the game loads: after any frame change run `npm run art:optimize`
  before judging in the browser.

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
phone; send the mp4 and a grid or a **reel**: the scratch `reel.py` of 2026-09-18 played a
creature's cut frames over a dark table exactly as the game does, and that is what got the
spider approved), and to be walked through account/API steps. Show him **every** clip of a
batch, not just the good ones — he asked. His messages are speech-to-text; ask when a word
doesn't parse ("cacoon", "bard seed 103" = bark seed 103). He reviews in batches; when working
unattended keep a checkpoint list here, one commit per item.

**Pushing.** `gh` is authenticated but configured for SSH, and github.com's host key isn't
trusted on this machine. Push with:

```bash
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

Commits go straight to `main` with the attribution line the session gives you. CI takes ~1
minute; the fuzz tests have a 60 s budget because CI's runner is slower than this machine.
**Never `git add -A`**: unapproved art sits uncommitted in `assets/art` and `public/art` — add
paths by name. To commit one creature's row while another's is still on trial, write the
staged version of `enemies.ts` with the trial block reverted, `git add` it, then restore the
working copy (done twice on 2026-09-18).

**The Bash tool truncates long commands** (~8 KB); the failure looks like an unterminated
quote and nothing runs. Write a Python edit script with the Write tool into the session
scratchpad (exact `(old, new)` pairs with `assert s.count(old) == 1`), run it with `python3`
(the one with PIL; `python` is a bare 3.13; numpy is not installed), then `npx prettier
--write` the touched files — prettier reflows markdown, so patch **after** it has run, against
the wrapped text. Use raw strings for anything with `C:\Users`.

**Verifying visuals.** `preview_start` with the `dev` launch config (the desktop app stops the
server between days, and it died once mid-session — restart it; a tab on
`chrome-error://chromewebdata/` means the server is gone). HMR reloads the page on any `.ts`
edit, so re-stage after editing. URL overrides for a run: `?seed=` `?deck=cat,cat,pounce`
`?hp=999` `?crumbs=500`. In dev, `window.__cardillion` exposes `controller`, `screens`,
`autoFight()` and `autoRun(stopAt?)`. `controller.run` is a plain object you can edit from the
console: to stage any fight, click NEW RUN, dispatch a travel to `t0-0`, replace
`c['run'].combat.enemies` with hand-built instances in the engine's own shape (`{uid, def, hp,
maxHp, statuses:{block:0,poison:0,weak:0}, intent, lastMove:null, uses:{}, playedDead:false,
playingDead:false, patternIndex:0, enraged:false}` — `statuses:{}` turns to NaN on the first
status, and `patternIndex` is what a boss's cycle reads), then
`c['scene'].setEnemies(enemies)` and `c['battle'].render(combat)`. To shape a run for him
(done 2026-09-18): on the map, set `run.map.nodes[id].type` for the trail he wants
(`'shop'`, `'cocoon'`, `'fight'`), park the markers (`run.greebleNode = run.map.boss;
run.snailNode = null; run.snailReturnIn = 99`), mutate the content modules through Vite —
`(await import('/src/content/encounters.ts')).ENCOUNTERS.early.splice(0, 4, ['possum'])`,
`(await import('/src/content/cards.ts')).CARDS['pounce'].base.effects[0].amount = 999` — push
a card onto `run.deck`, and call `c['render']()`. Runtime only; nothing in the repo changes.
`autoRun('shop')` plays until the run's phase is `shop`. Private fields are reachable at
runtime (`c['scene']['sprites']`, a sprite's `seq`, `fade`, `ghost`, `eyes`, `sink`). The JS
tool times out at 45 s; results over ~250 KB land in a file — return numbers, not pixels, and
never a data URL. Screenshots lag the call by up to a second, so they miss short clips — prove
motion with numbers (`seq.mode`, `fade`, `lift`) or a reel.

Useful seeds: `garden1` two rats plus a Greeble in the first fight (`t0-0`), `s3` a possum on
a Flower Patch, `s0` spider, `s5` scorpion + Greeble, `g52` a short winnable trail.

**Keys.** `.env` (gitignored, never printed) holds `OPENAI_API_KEY` and `RUNWAYML_API_SECRET`;
`tools/lib/env.mjs` reads it. `COMFYUI_DIR` and `FFMPEG` are process-environment overrides
with working defaults (`C:\Users\smite\ComfyUI_windows_portable`, `art/out/bin/ffmpeg.exe`).
The Cat cards portray **his real cat** from `art/refs/owner-cat.png` (gitignored). Spend so
far: roughly $17–19 on OpenAI images (check the usage page), Sora ≈ $10.80 (the rat's clip and
the spider's four — jaws, wave, two failed rear-ups; the blocked possum jobs and the rat's
blocked "vicious bite" job were probably not billed), 270 of the 500 free Runway credits.

## Architecture in one screen

```
src/engine/   pure rules. rng.ts (seeded, forkable) · types.ts (row shapes live HERE) ·
              combat.ts (fight reducer; CombatMods carry upgrade + habitat effects; pending
              delayed effects) · map.ts (three signposted trails, two crossings, fog,
              habitats) · run.ts (run reducer: travel, rewards, shops, cocoon choices +
              metamorphosis, markers, the Snail's trail) · fuzz.test.ts
src/content/  data tables: cards.ts (20 + Cobweb; PUPATION) · enemies.ts (art, deadArt,
              height, poses) · encounters.ts · trails.ts · habitats.ts · upgrades.ts
src/render/battle/  scene.ts (table, lights, sprites: body group, keyframe poses, clip
              sequences, move clips, the settle, eye glow, act() per move) · post.ts (bloom,
              grain, vignette) · textures.ts (card faces, art loader, eye and ground-line
              finders, placeholders)
src/ui/       battle-ui.ts (hand, HUD, intents, targeting) · run-screens.ts (title, map,
              reward, shop, cocoon, result, settings) · card-faces.ts
src/app/      index.ts (boot, art ids, storage, settings, dev hooks) · run-controller.ts
              (dispatch → save → animate → screen) · animate.ts (combat events → scene calls)
src/save/     store.ts · save.ts (one slot, versioned + shape-checked) · settings.ts — pure
tools/        gen-art.mjs (OpenAI Images: generate, edit with `subject`/`referenceRole`,
              chroma key) · art-poses.mjs (sheet slicer) · art-video.mjs (clip cutter) ·
              art-tone.mjs (re-tone frames) · art-optimize.mjs (PNG → WebP, honours
              `ship: false`) · art-preview.mjs · art-redden.py · art-unred.py ·
              gen-video-local.mjs / gen-image-local.mjs (ComfyUI) · gen-video-runway.mjs ·
              gen-video-sora.mjs · lib/{chroma,comfy,env,frames}.mjs · workflows/*.json
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
seam on `EnemyDef`, not a tweak (`height` is the model). ESLint enforces the layering for
`engine` and `content` only.

## Known issues and loose ends

- **One unexplained one-off:** on the very first drag of one session, three cards were spent
  from a single gesture. Never reproduced; `RunController.dispatch` marks itself busy
  synchronously and the playback chain can no longer be poisoned by a throw. Watch for it.
- Desktop-only layout; the title overflows on phones and touch is untested (roadmap).
- GitHub Pages URLs are case-sensitive: `/Cardillion/` works, `/cardillion/` 404s.
- The v1 wolf-spider sprite keeps a faint half-keyed shadow under the body — lose it in its
  pass ("no shadow under the body").
- The spider's `legr`-type single-leg clips and the wave sections are gone from the row; the
  `spider-leg-*`, `spider-web-501`, `spider-rear-301/304` clips stay in `art/out/video/`.
- After a mid-fight reload the reward screen's "emerged" note is lost and `?seed=` is not
  refreshed. Cosmetic.
- Reduce motion removes the film grain; `Post.setGrain` takes any amount if a middle setting
  is wanted.
- Elite-reward upgrade choice and boss rares (spec §3, §5.2, §6.2) are not implemented; the
  spec marks them.
- `disposeSprite` leaks the shadow blob's geometry/material (minor).
- Clip textures are per sprite, not per creature (see GPU memory above).
- `enemy-possum-floor-*` and the wave-section frames were deleted, not kept; their clips are
  in `art/out/video/` if ever wanted.

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13; the engine choice was gated on a
look prototype the owner judged in the browser; an unattended overnight run (2026-09-15 → 16)
built the Cocoon choices, habitats, six cards, the Snail trail and M5, one commit per item with
a checkpoint kept here. The owner asked for enemies "more realistic and gross, like
Inscryption", then, on 2026-09-16, for the mutant direction, and one edited rat sold it. The
rat took 2026-09-16/17: pose sheets, a Sora clip, a local rig (ComfyUI, Wan 2.2, FLUX.2 klein,
Z-Image — `docs/local-video.md`, `docs/local-image.md`), eleven Wan re-rolls, four Runway/Veo
renders, and a cross-fade for the clip handovers. 2026-09-18 was the possum and the spider in
one long day: klein de-gore passes, the `thicket-morbid` style, a dozen Wan batches, the cutter
growing named sections, anchors, two-eye relight and colour hold, and the settle. The lesson
each time: ask before starting a milestone, keep commits small, write the checkpoint here, and
show him a sample — as a reel, every clip of the batch.

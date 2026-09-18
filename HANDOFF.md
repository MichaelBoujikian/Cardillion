# Handoff — Cardillion

For an agent picking this project up cold. Read **START HERE** below, then `CLAUDE.md` (the
standing rules), then the `spec.md` section for whatever you build next. Written 2026-09-15; rewritten
2026-09-16 (`22a9c08`) after the overnight run, and again that evening after the rat session.

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

126 tests pass; `npm run check` is green; CI and the Pages deploy are green.

**Balance:** nothing is balanced; every number is a first guess marked _(tuning)_.
`src/engine/fuzz.test.ts` plays 240 seeded runs (random and greedy policies) and gives a first
reading — greedy wins 0.3%, the Bear kills 43% of runs, then the late `scorpion ×2 + rat` pool,
`spider + scorpion`, the Wolf Spider. **The owner's decision: balance gets its own dedicated
test sessions. Do not propose or make number changes in passing.**

## START HERE (written 2026-09-17, end of a long session; the owner is switching agents)

**Read `docs/art-pipeline.md` "The recipe" first**, then this section, then the rest of this
file. The owner reviews by eye, wants one recommendation per question, and approves art in
batches (see "How to work here"). Nothing below is committed art: every mutant PNG/WebP and
the rat's content row are **uncommitted working-tree changes** — do not `git add -A`.

**What the owner decided, in his words, at the end of this session:**

- **The fidget is the Sora startle** (`enemy-rat-mutant-fidget-01..17`, translated onto the
  loop's placement as `enemy-rat-local-startle-01..17`), the owner's call late on 2026-09-17
  after every other clip — three cuts of B, the bark-103 lash, and four Runway/Veo renders
  (below) — drifted off the pose after its movement; the Sora clip is the only one from any
  model that came back to its own first frame. The lash held the slot for an hour. History: of the local rat clips (`art/out/video/rat-*.mp4`, gitignored), B (`rat-B-bob`)
  was his favourite for the passive movement every now and then — "the new twitch" — to be
  played back in reverse to return to where it started (that was `art:video --fidget-pingpong`;
  on 2026-09-17 evening, watching it, he had the tentacles "get weird at a couple parts" — Wan
  drifts from ~0.6 s on and grows a second bundle of tentacles — so it became **only the
  turn-away, 0–0.58 s of B, played forward then back**: a glance that never shows the drift
  and lands on the stance by construction. A forward-only cut to 3.33 s was tried between
  the two and rejected: it landed with more tentacles than the loop has, and fading between
  the two counts showed. The turn-away hid the tentacles, which he was trying to avoid, so B
  went too: eleven 3 s re-rolls on the local rig followed — prompts and seeds in
  `art/out/video/rat-bark-whip-prompts.txt` — and he picked **`rat-bark-103`, a sideways
  tentacle lash**, cut 0–0.83 s forward then back, and asked for room for "a couple" of
  fidgets: the row now takes a list, `poses.fidgets`, played in turn. Everything else went
  to `art/out/video/rejected/`.) **B3 (`rat-B3-bob`) is a good passive stance** because only the tentacles
  sway. **Combine them with cross-fading**, and **keep the three attack frames from the pose
  sheet** (`enemy-rat-mutant-windup` / `-attack` / `-hit`).
- **That is what the game shows now:** `enemies.ts` rat row → `art: enemy-rat-local-loop-01`,
  `poses.loop` = B3 (0.3–4.0 s, 45 frames, played back and forth), `poses.fidgets` = [the
  Sora startle, 17 frames, 1.4 s, from a different render of the same still — the handover
  differs by alpha 4/255, which the cross-fade covers], plus the sheet stills. A fidget may start no sooner
  than 2.5–6 s after the last, but only as the loop turns at its first frame, which for the
  45-frame loop is every 7.3 s — so the real rhythm is ~1.4 s of fidget, ~7.3 s of loop, repeat
  (`scene.ts` `stepSequence`). The 2.5–6 s is a per-sprite constant, not a roll.
  The Sora frame set (`enemy-rat-mutant-loop/fidget-*`) is still on disk; the row's comment
  lists both, flip by editing the ids.
- **Cross-fading at the loop↔fidget handover is built (2026-09-17 evening).** `startGhost` in
  `scene.ts` is the ghost mechanism factored out of `setPose`; at each handover the outgoing
  frame stays solid under the incoming clip while the clip keeps playing — 150 ms into the
  fidget (`FIDGET_IN_FADE_MS`, its first frame is the stance), 300 ms back to the loop
  (`FIDGET_OUT_FADE_MS`: the landing sits a few pixels off the stance, so the longer fade
  reads as a settle) (a `seq` flag on the fade record stops `stepSequence` from pausing). Keyframe
  fades (strike, hit) dissolve as before. Measured in the browser: ghost holds loop frame 1 /
  the last fidget frame at opacity 1 while the plane ramps 0→1 and the clip advances two frames
  underneath. Note for the future: the materials' `alphaTest: 0.35` cuts a picture entirely
  below 35% opacity, so a two-sided dissolve is really old-only → both → new-only, and the
  creature dips see-through at both ends; that is why the handover keeps the ghost solid
  instead.
- Per-frame **eye tracking during fidgets** is a possible refinement: the glow sprite is placed
  once from `art`, so it hangs above the head while the head dips. The cutter already finds
  the eye per frame where it can (`art-video.mjs` relight step); storing an `(u, v)` per frame
  and moving the glow would fix it. Not asked for; mention it if he notices.
- **What the 2026-09-17 evening audit found (verified against the code):**
  - (a) `--fidget-pingpong` reverses only the interior frames, so the fidget ends one frame
    before where it began; the boundary pop it left was ~2–3× an adjacent-frame difference and
    the cross-fade above covers it.
  - (b) GPU memory: `makeSequence` makes one `THREE.Texture` per frame PER SPRITE (992×560 ×
    65 frames ≈ 190 MB per rat with the 20-frame lash — it was 380 MB with the 84-frame
    ping-pong — two rats ≈ 380 MB, not shared between sprites) — decide frame
    counts for the next creatures with this in mind (shorter loop, lower fps, or a per-def
    texture cache).
  - (c) The v1 `enemy-possum.png` has NO amber cluster the eye finder can see (its prompt asked
    for "black eyes with an amber glint"), and the cutter's eye tracker can lock onto pink
    flesh: the mutant possum still must ask for clearly glowing amber eyes and keep wounds dark
    red.
  - (d) `deadArt` + `poses` together has never run: `restPose` is frozen at `makeSprite` (a
    fight resumed while playing dead loops the standing clip on a lying plane), `hitEnemy` on a
    playing-dead possum snaps back to the standing art after 0.35 s, and `animate.ts` calls
    `setPose` for Play Dead down/up with fadeMs 0 (cuts).
  - (e) The prompt and seed behind the loop clip B3 were never recorded; the fidget clip's
    (`rat-bark-103`) are in docs/local-video.md and, with all eleven re-rolls, in the
    gitignored `art/out/video/rat-bark-whip-prompts.txt`. The cut that made the current row is `npm run art:video -- --video art/out/video/rat-B3-bob.mp4
--out enemy-rat-local --loop 0.3:4.0 --fidget 0:0.83 --fidget-video
art/out/video/rat-bark-103.mp4 --fidget-pingpong --fps 12 --like enemy-rat-mutant-rest --tone
enemy-rat` (delete
    the old `enemy-rat-local-fidget-*` PNG + WebP first — the cutter never removes stale frames).
  - (f) Metamorphosis: the only Cocoon every run guarantees is the one before the Boss, and a
    boss win skips `emerge` — Pupate there is a trap; question one for the grilling.

**How the local rig works (both halves tested today, all free, no content policy):**

- `npm run video:local -- --image <png> --out <name> --prompt "..." [--seconds 5] [--seed n]`
  → Wan 2.2 5B in ComfyUI on his RTX 5070 Ti, ~5 min per 5 s clip, `art/out/video/<name>.mp4`.
  **5 s is the sweet spot; a 10 s clip smeared the tentacles and never held still.** One
  movement per clip, then combine: `npm run art:video -- --video <loop clip> --loop t0:t1
--fidget t0:t1 --fidget-video <movement clip> [--fidget-pingpong] --fps 12 --like
enemy-rat-mutant-rest --tone enemy-rat`. Details and what the rat taught: `docs/local-video.md`.
- `npm run image:local -- --out <name> --prompt "..." [--edit <png>] [--model zimage|klein]`
  → FLUX.2 klein 4B (edits + text-to-image) or Z-Image, ~25 s, `art/out/local/<name>.png`.
  Both Apache-2.0. **gpt-image-2.5-sunburst via `npm run art` stays the first choice for
  stills**; local is for gore the API refuses (klein tore the rat open with ribs and blood on
  request) and for free iteration. Details: `docs/local-image.md`.
- The rig lives outside the repo at `C:\Users\smite\ComfyUI_windows_portable` (ComfyUI v0.36.0,
  own Python + torch cu130). The tools start it headless themselves and stop it after, unless
  `--keep-server`. It holds ~2 GB VRAM idle; the game shares the GPU.
- `ffmpeg` is not on PATH; the tools use `art/out/bin/ffmpeg.exe` (gitignored copy).

**Tool gotchas learned the hard way this session:**

- The desktop app's Browser pane often stops painting when hidden: `requestAnimationFrame`
  never fires, the scene clock freezes, and sampling the game over time reads nothing. Drive
  the scene by hand instead: `const sc = window.__cardillion.controller['scene']; let t =
sc['now']; for (...) { t += 1/30; sc.update(1/30, t); sc.render(); }` then read sprite
  state or grab `sc['renderer'].domElement.toDataURL()` crops. Never let a test clock run
  ahead of the app's clock on a _visible_ pane (the sequence player now guards `t < start`).
- `javascript_tool` results over ~250 KB are written to a file under `tool-results/`; decode
  base64 crops from there with Python. The result JSON is sometimes double-encoded.
- The owner can only see files you send with `SendUserFile`; he reads on his phone, so send
  a PNG frame strip next to any mp4 (`ffmpeg -vf "fps=2,crop=...,tile=5x2"`).
- Python edit scripts: write them with the Write tool (Bash truncates ~8 KB); use raw strings
  for anything containing `C:\Users` (a `\U` escape error bit twice); prettier reformats
  markdown tables, so match the padded row or insert by regex.
- `art:optimize` converts every PNG in `assets/art` — delete the stray sheet WebPs
  (`enemy-rat-mutant.webp`, `-poses.webp`, `-idle.webp`) after running it.
- Every frame the game will place a glow on should carry exactly one amber cluster at 512 px:
  `findGlowPoints` keeps up to two clusters and places a glow on each, so "exactly one" is a
  rule for the art — a second amber patch (a wound) becomes a second glow. The slicer and
  cutter protect/relight the eye; check with a quick Python replica when in doubt
  (`docs/local-video.md`).

**Renderer facts a new agent needs (all in spec §11.2 and `scene.ts`):** sprites stand on
their picture's **ground line** (`findGroundLine`, the lowest wide alpha row) via `baseY`;
only the hit box's top edge and the head label follow `baseY` — the bottom edge and the feet
anchor stay at the table (`scene.ts` `enemyRect`/`enemyAnchor`); the shadow ellipse sits back
`height * 0.1`; at rest a creature only breathes and leans in (sway, drift, twitch removed
2026-09-17 at the owner's request); keyframes cross-fade via `setPose`; clip frames play via
`stepSequence`. Rows below the ground line (claw tips, a tail swishing low) sink into the moss
by design.

**Open with the owner:** approve the rat (then rename `enemy-rat-mutant-*`/`enemy-rat-local-*`
to the real `enemy-rat*` ids and commit art + content together); the possum next; Runway
(`docs/runway-api.md`) is optional now that local video works — he has not bought credits.

## NEXT: the enemy art pass (in progress — the rat is the worked example)

The owner wants the vermin redone as **mutants — Fallout 3 centaur** (the mutant, not the
horse-man): skin torn or sloughed away showing wet muscle and ribs, bundles of fleshy tentacles
pushing out of the mouth, that kind of wrong. **Gross and gory** (spec §11.1 — the owner dropped
"never gory" on 2026-09-16), realistic-painted, the glowing amber eyes, and **as dark as the v1
art**: he judged the `gpt-image-2.5` renders "too much colour", so every frame is tone-matched
to its v1 sprite by the slicer (below). Edits of the existing sprites, not fresh creatures.

**Decisions made 2026-09-16 (evening), all with him looking at the game:**

- **Animation = a clip for the waiting state, pose-sheet stills for the strike and hit.** He
  compared both: a Sora-2-pro clip ($2.40; the honest "vicious bite" version was blocked by
  the output moderation filter at 99%, the mild one passed) and a pose sheet on
  `gpt-image-2.5-sunburst` ($0.17). Cross-faded stills failed for the idle (a dissolve, not
  motion); the clip is real motion and the rat holds still in it. **OpenAI shuts the Sora
  API down on 2026-09-24**, no replacement named: every other creature's clip must be made
  before then, or on Veo/Runway after. The clip and its frames are in `art/out/video/`
  (gitignored); `art/out/video/sora-rat.mjs` is the script that made it.
- **Model:** `gpt-image-2.5-sunburst` (the precision-editing tier) is the manifest default;
  `-flare` is the fast tier at the same price. Quality runs `low..max`; default `max`
  (≈ $0.165 for a 1536×1024 sheet). The tool sends `moderation: low` and prints the real
  token cost.
- **What's built** (spec §11.2/§11.4): `poses` on the enemy content row — `windup`, `attack`,
  `hit`, `idle: [...]`, and, for a clip-driven creature, `loop` / `fidget` frame sequences
  (spec §11.2) — each frame on the same canvas as `art`. `scene.ts` cross-fades them:
  wind-up while the lunge pulls back, strike from the spring to the recovery, hit for 0.35 s,
  and an idle drift through rest + idle frames every 1–2 s (off under Reduce motion). The eye
  glow is sized from the eye it finds (`findGlowPoints` now returns `size`, analysed at 512 px
  — at 256 the smaller 2.5 eye vanished). `tools/art-poses.mjs` slices sheets.

**2026-09-17 — the local rig, both halves, is in and tested.** `docs/art-pipeline.md` opens with
"The recipe" — the ordered steps from a still to a living creature in the game; read that first.
The rig (outside the repo, `C:\Users\smite\ComfyUI_windows_portable`, ComfyUI v0.36.0):
`npm run video:local` (Wan 2.2 5B, docs/local-video.md, 5 s in ~5 min) and `npm run image:local`
(FLUX.2 klein 4B edits + text-to-image, Z-Image text-to-image, docs/local-image.md, ~25 s each),
both Apache-2.0, **no content policy** — the route for the gore the APIs refuse. First tests:
a klein edit tore the rat open with ribs and blood in 24 s; a Z-Image possum came out
illustrative and floaty. **gpt-image-2.5 stays the first choice for stills**; the local image
models are the fallback for gore and free iteration. Runway (docs/runway-api.md) is still
documented, key not in `.env`; the owner has not decided whether to buy its credits now that
local video works.

**2026-09-17 morning — local video works.** Runway's usage policy bans exposed muscle/bone, so
for the gory stills the owner asked for a no-policy route: **Wan 2.2 5B in ComfyUI on his RTX
5070 Ti** is installed and produced its first rat clip (5 s in ~5 min, free). `docs/local-video.md`
has the install (outside the repo, `C:\Users\smite\ComfyUI_windows_portable`), the tool
(`npm run video:local`, starts the server itself) and the gotchas. Runway stays the option for
clean stills when Veo/Seedance quality is wanted; `docs/runway-api.md` covers its setup — the
key is not yet in `.env`. Quality is a notch under Runway's best; free re-rolls compensate.

**(Superseded 2026-09-17 — local video works, Runway is optional; kept for the record.)**
**DECISION (2026-09-16, last thing): the pipeline is `gpt-image-2.5` for images, Runway for
video.** He saw the clip-driven rat in the game and liked it a lot ("not bad at all"); the
fidget now fires every 2.5–6 s at his request. The plan for every creature: generate/edit the
still on `gpt-image-2.5-sunburst` (credits already bought), then send that still to **Runway**
(image-to-video) for the passive clip — still body, only parts moving, one short fidget — and
cut it with `npm run art:video`. Sora is out (shut down 2026-09-24). **Game work is paused
until the Runway API is set up**: he wants to be walked through the account, key and credits;
the key goes in `.env` as `RUNWAYML_API_SECRET`, never printed, never committed. Then port
`art/out/video/sora-rat.mjs` into a real `tools/gen-video.mjs` against Runway.

**(Historical — the Sora ids below were replaced by the local clip set described in START
HERE; the ground-line and shadow fixes described here stand.)** **The rat as of tonight
(late):** he watched the idle cross-fades and rejected them — "it
clearly looks like a different image being switched out" — and asked for the **Sora clip
as the passive state** (the rat is still, only the tentacles slither; the clip's startle
becomes an occasional fidget, like the twitch was) with the **pose-sheet stills for the
lunge and hit**, "okay if it's slightly different". That is what is in: `poses.loop` /
`poses.fidget` frame sequences (spec §11.2; now `poses.fidgets`, a list), `tools/art-video.mjs` to cut them, and the rat
row pointing at `enemy-rat-mutant-loop-01..47` / `-fidget-01..17` plus `-windup/-attack/-hit`.
The idle sheet (`-idle1..4`) is superseded and unreferenced. **The content row and every
mutant PNG/WebP are uncommitted** pending his yes. He also flagged the sprite floating a
little above its shadow and rolling ~10° now and then; **both fixed 2026-09-17** while he was
away: `findGroundLine` (textures.ts) finds each picture's ground line — the lowest wide row —
and `baseFor` sets the plane's `baseY` so the feet meet the table whatever padding the frame
carries (only the hit box's top edge and the head label follow `baseY`; the bottom edge and
the feet anchor stay at the table — `scene.ts` `enemyRect`/`enemyAnchor`); the shadow ellipse
sits back in z so the feet stand on its front third; the idle sway, drift and twitch are gone —
breathing and the threat lean stay (spec §11.2). Known trade-off: rows below the ground line
(claw tips, a tail swishing lower in a fidget frame) sink into the moss and are hidden by the
table.
Contact sheets: `art/out/contact-2026-09-16-rat-ingame-video.png` (in-game), `-rat-video-
frames.png`, `-rat-tone.png`.

**Per creature, the recipe** (`docs/art-pipeline.md`, "Editing an existing asset" and "Pose
sheets"):

(The current, clip-based version of this recipe is `docs/art-pipeline.md` "The recipe"; the
idle sheet in steps 2–3 is optional and superseded by the clip.)

1. Mutation sample: a manifest entry `<id>-mutant` with `"subject": "<id>"` and a prompt that
   says only what changes. Show him; iterate until yes.
2. Action sheet: `<id>-mutant-poses`, `"subject": "<id>-mutant"` (its raw), 2 × 2 —
   rest / wind-up / attack / hit — on the one green screen. Idle sheet: `<id>-mutant-idle`,
   subject the poses sheet's raw, "the top-left figure four times, only the <tentacles,
   whiskers, breathing> differ".
3. `npm run art:poses -- --sheet <id>-mutant-poses --names rest,windup,attack,hit --tone <id>`
   then `... --sheet <id>-mutant-idle --names idle1,idle2,idle3,idle4 --out <id>-mutant --like
<id>-mutant-rest --tone <id>`. Check every frame finds exactly one amber cluster (the eye);
   the slicer protects the eye from the tone pass.
4. Content row: `art` = `<id>-loop-01` (the cutter's first loop frame; `content.test.ts`
   requires `loop.frames[0] === art`), `poses.windup/attack/hit`, `poses.loop` / `poses.fidgets`
   via `frames()`. `npm run art:optimize` (it converts every PNG in `assets/art`, so delete the
   stray sheet WebPs). Look at it in a fight — `END TURN` for the lunge, a card on it for the
   hit.
5. On his yes: rename the sample ids to the real ones (`enemy-<name>`, `enemy-<name>-windup`
   …), commit PNG + WebP + content together.

Roster still to do: `enemy-possum` **and `enemy-possum-dead` together** (no raw exists for the
dead pose — it edits from the keyed PNG; consider editing it from the approved mutant possum
instead), `enemy-spider`, `enemy-scorpion`, `enemy-greeble` (Unseen: alphaTest 0, so its edges
must be clean), `enemy-rat-king`, `enemy-wolf-spider`, `boss-bear` (sample entries need
`"size": "1024x1536"`; expect him to want it pushed further). `boss-moose` is act 2.

Things that bite: `--force` into an id whose `subject` is itself overwrites `art/out/<id>-raw.png`
— copy the raw to `<id>-vN-<why>.png` first. Wounds must read red-pink, never amber (the glow
finder). The moves' amplitudes are literals in `poseBody` (`scene.ts`); a per-creature nudge
means a seam on `EnemyDef`, not a tweak. Never `git add -A` while unapproved art is on disk.

**Masked edits and video** (the rest of the old animation plan): masked inpainting (`mask` on
the edits endpoint, prompt-guided) is still an option for "the same picture with the jaw
moved"; video is off the table until a provider other than Sora is chosen (Veo/Runway)
(superseded: local video via Wan 2.2 is the route, see START HERE).

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
              art-preview.mjs · art-optimize.mjs (PNG masters → WebP) · art-poses.mjs (sheet
              slicer) · art-video.mjs (clip cutter) · gen-video-local.mjs / gen-image-local.mjs
              (ComfyUI) · lib/{chroma,comfy,frames}.mjs · workflows/*.json
```

Rules that matter when you touch it: the engine emits **events** and the renderer only
animates from them (ADR 0003) — when an animation needs a cue, add an event (`enemyActing` was
added for the wind-up); content names every image it uses (`art`, `upgradedArt`, `deadArt`, and
every id under `poses`, collected by `poseArtIds`) and `src/app/index.ts` collects the ids for
the loader — a new image is a new field, never a naming convention the loader guesses;
randomness only from `Rng` streams (`map` → `habitats`, `markers`, `encounters`, `rewards`,
`shop`; there is no combat fork — each fight is seeded from `"<seed>:combat:<node id>"`,
`run.ts:517`); `run.ts` keeps
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
- The rat's mutant PNGs/WebPs and its content row are uncommitted, awaiting the owner's yes
  (see NEXT). `enemy-rat-mutant.png` (the first direction sample) is superseded by the sheets.
- The left-hand enemy slot is much darker than the middle one (the warm light sits left-front
  and close); any creature there reads as a silhouette. Noticed 2026-09-16, not addressed.
- Play Dead down/up in `animate.ts` call `setPose` with no fade (a cut, against spec §11.2
  "never a cut"); passing ~140 ms is enough once the possum's `deadArt` + `poses` combination
  is sorted out (see the audit in START HERE, point d).
- `disposeSprite` leaks the shadow blob's geometry/material (minor).

## How we got here (for context, not action)

The design came out of a `grilling` session on 2026-09-13 (four rounds, every decision in
`spec.md` and the ADRs). The engine choice was gated on a look prototype the owner judged in
the browser. The owner asked for enemies "more realistic and gross, like Inscryption" (baked
into the thicket prompt prefix), then, on 2026-09-16, for the mutant direction above. The work
has run across several models and sessions; the lesson each time was the same — ask before
starting a milestone, keep commits small, and write the checkpoint in this file.

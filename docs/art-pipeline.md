# Art pipeline

How generated art gets into the game, and how to set it up. Background: ADR 0006.

## The recipe: from a still to a living creature (read this first)

Every enemy goes through the same steps; the rat (2026-09-16/17) is the worked example. Sample
ids (`<id>-mutant…`) keep the live game untouched until the owner says yes; then rename to the
real ids and commit art + content together.

1. **The still.** `gpt-image-2.5-sunburst` through `npm run art` — a `subject` edit of the v1
   sprite ("keep this exact creature, add …"). Or locally, with no content policy, through
   `npm run image:local` (docs/local-image.md) when the gore is more than the API allows.
   Look at it; iterate; show the owner.
2. **The pose sheet** (strike and hit stills): a 2 × 2 sheet edited from the still's raw —
   rest / wind-up / attack / hit — sliced by `npm run art:poses … --tone <v1 id>`.
3. **The clip** (the passive state: body still, only parts moving, one short fidget):
   compose the still onto a pure-green frame (`art/out/video/*-first-frame-*.png` shows the
   layout; `tools/gen-video-local.mjs` does the fitting itself) and generate with
   - `npm run video:local` — Wan 2.2 on the owner's GPU, free, no policy, ~5 min per 5 s
     (docs/local-video.md); or
   - Runway image-to-video (docs/runway-api.md) for Veo/Seedance quality on a _clean_ still —
     its policy refuses exposed muscle and bone, and refusals are charged.
     Write the prompt as "holds completely still … only the tentacles writhe … locked-off camera
     … flat green background unchanged"; the sheet's tone match handles brightness later.
4. **Cut the clip** with `npm run art:video … --like <id>-mutant-rest --tone <v1 id>` (below):
   find the still stretch and the movement by frame difference, get `-loop-NN` and `-fidget-NN`
   frames on the pose frames' canvas.
5. **Content row** in `src/content/enemies.ts`: `art` = `-loop-01`, `poses.windup/attack/hit`,
   `poses.loop` / `poses.fidget` via `frames()`; `npm run art:optimize`; delete the stray sheet
   WebPs. Check every frame finds exactly one amber cluster (the eye).
6. **Look at it in the game** (`?seed=garden1&hp=999` puts two rats in the first fight): the
   loop and fidget run on their own, `END TURN` shows the strike, a card on it shows the hit.
   Screenshot before/after, show the owner, wait for the yes, then commit. The handovers
   between loop and fidget cross-fade on their own (`FIDGET_IN_FADE_MS` / `FIDGET_OUT_FADE_MS`
   in scene.ts).

## The contract

- Every asset has an **id** that matches its content entry (`card-wormillion`, `enemy-rat`,
  `boss-bear`, `npc-snail`, `bg-battle`…). Sizes and kinds are in `spec.md` §11.4.
- The game loads `public/art/<id>.webp` (written from the `assets/art/<id>.png` master by
  `npm run art:optimize`); a missing id falls back to a placeholder drawn in code, so the game
  never depends on generated art.
- Prompts live in `art/manifest.json`: two style blocks (`garden`, `thicket`, plus `scene` for
  backgrounds) and one entry per asset. Change a prompt there, never in code.
- `assets/art/` is committed only once a batch is approved by the owner.

## One-time setup (owner does this — about five minutes)

1. Go to https://platform.openai.com and sign in (or create an account). The API is billed
   separately from ChatGPT: under **Billing**, add a payment method and buy a small amount of
   credit ($10 covers the whole v1 art set with room for re-rolls).
2. Under **API keys**, create a new secret key. Copy it once — it is only shown once.
3. In the repo root, copy `.env.example` to `.env` and paste the key after `OPENAI_API_KEY=`.
   `.env` is gitignored; never paste the key anywhere else (not in chat, not in a commit).
4. Verify without spending anything: `npm run art -- --dry-run` prints every prompt.

That is the entire setup. From here the agent runs the pipeline.

## Generating (agent workflow)

1. **Style anchors first.** `npm run art -- --only style-anchor-garden,style-anchor-thicket`.
   Look at both. Re-prompt until each one _is_ the look (spec §11.1). Show the owner; iterate
   until approved. Every other image is generated with the approved anchor as a reference, so
   this step decides the whole set's coherence.
2. **Generate a batch** (e.g. the seven base cards, or all common vermin):
   `npm run art -- --only card-wormillion,card-roly-poly,...`. Open each PNG and check:
   subject reads at card size, silhouette is clean, palette matches the world, no text or
   border, background is actually transparent.
3. **Re-roll misses.** Edit the prompt in the manifest, then `npm run art -- --only <id> --force`.
4. **Contact sheet for approval.** Assemble the batch into one image (`art/out/` is gitignored
   scratch space), send it to the owner, and record approved ids in the commit message.
5. **Commit approved PNGs** to `assets/art/`, then run `npm run art:optimize` and commit the
   web-sized `public/art/<id>.webp` copies it writes — those are what the game loads; the PNG
   masters never ship. Placeholders for those ids become unused.

Model: `gpt-image-2.5-sunburst` (the precision-editing tier; `manifest.defaults.model`, or
`--model gpt-image-2.5-flare` for the fast tier at the same price). Costs at 1024×1024, from
OpenAI's calculator: about $0.006 / $0.013 / $0.05 / $0.09 / $0.21 per image at low / medium /
high / xhigh / max (landscape 1536×1024 is cheaper, ≈ $0.165 at max); the tool prints the real
`output_tokens` after each render. Use `--quality high` while iterating on prompts, `max` for
the final render. The v1 assets were made on `gpt-image-1` at its `high` (≈ $0.19).

## Editing an existing asset (`subject`)

A manifest entry with `"subject": "<id>"` is an **edit** of that asset rather than a new
picture: the model is told the first image _is_ the creature — keep its pose, size and every
detail not mentioned — and to change only what the prompt describes. The raw chroma render in
`art/out/<id>-raw.png` is sent when it exists (so the model paints on the same green screen);
`reference` images can still follow as style anchors. Expect some drift in fur and tone — it
is a guided repaint, not a pixel edit — but the creature and pose hold. This is how the mutant
direction (torn skin, mouth-tentacles) was sampled from the existing rat.

## Pose sheets (`npm run art:poses`)

Animation frames are generated as a **sheet** — one image with every pose of the creature in a
grid — because a single generation keeps it the same animal; separate renders drift. Two
sheets per creature so far: `<id>-poses` (rest / wind-up / attack / hit, 2 × 2) and `<id>-idle`
(the rest pose four times with only the tentacles, whiskers or breathing changing). The entry
is an edit (`subject`) of the creature's raw render — or of a previous sheet's raw, naming the
figure to copy — with a prompt that describes the grid and each panel, and asks for the figures
on the one green screen with clean gaps (see `enemy-rat-mutant-poses` and `-idle`). Size
1536×1024; `gpt-image-2.5` allows up to 3840×2160 if a creature needs more pixels per figure.

Then slice it:

```bash
npm run art:poses -- --sheet enemy-rat-mutant-poses --names rest,windup,attack,hit --tone enemy-rat
npm run art:poses -- --sheet enemy-rat-mutant-idle --names idle1,idle2,idle3,idle4 \
  --out enemy-rat-mutant --like enemy-rat-mutant-rest --tone enemy-rat
```

The slicer finds the figures as blobs of alpha (folding blood specks into the nearest one),
names them in reading order, and writes `assets/art/<out>-<name>.png`, all on **one canvas at
one scale** so the sprite keeps its size across frames. `--like <frame>` matches a second
sheet to the first one's canvas and figure height. `--tone <id>` matches mean brightness and
chroma to an existing asset — the 2.5 models paint about twice as bright and more colourful
than the v1 thicket art, and the owner wants the darker look — while leaving the amber eyes as
painted, so the renderer's eye-glow finder still finds them (it looks for exactly that colour).
Then point the content row at the frames (`art` = the rest frame, `poses.windup/attack/hit`,
`poses.idle: [...]`), run `npm run art:optimize`, and check it in a fight: `END TURN` for the
lunge, a card on it for the hit; the idle drift runs on its own.

## Video frames (`npm run art:video`)

For the waiting state a clip beats stills: real in-betweens, and the creature can hold
perfectly still while only part of it moves. The first rat clip came from Sora 2 Pro (8 s,
1280×720, $2.40; the API shuts down 2026-09-24 — the next clips need another provider), and the
current rat clips from the local rig (docs/local-video.md), generated from the creature's keyed
PNG composed onto a pure-green frame of the video's size, with a prompt
that asks for a locked-off camera, a flat unchanged green screen, the creature still for the
first seconds with only the tentacles moving, then one short movement and a return to rest.
Blood and "vicious bite" wording got the honest version blocked by the output filter; keep
the words mild — the picture carries the gore.

Find the segments by motion (frame-to-frame difference; the still stretches are flat, the
movement is a bump), then cut:

```bash
npm run art:video -- --video art/out/video/sora-rat-attack.mp4 --out enemy-rat-mutant \
  --loop 4.25:8.08 --fidget 2.83:4.17 --fps 12 --like enemy-rat-mutant-rest --tone enemy-rat
```

`--loop` is the still stretch the game plays back and forth (pick the one the fidget ends on,
so fidget → loop is seamless); `--fidget` the movement, played once now and then.
`--fidget-video` takes the fidget from a second clip and `--fidget-pingpong` plays it forward
then back; the reversed run drops both end frames, so the fidget ends one frame before where it
began — the renderer's handover cross-fade (spec §11.2) covers the hair that is left. It needs
`ffmpeg` (`--ffmpeg <exe>`, `$FFMPEG`, `art/out/bin/ffmpeg.exe`, or on PATH — the owner's
machine has the gitignored copy). Every frame gets one shared crop and placement, the pose
frames' scale and canvas (`--like`), the tone match, and the eye relit to amber (video
compression dulls it below what the eye-glow finder accepts). Then the content row:
`art` = `<out>-loop-01`, `poses.loop: { frames, fps }`, `poses.fidget: { frames, fps }`
(`frames()` in `enemies.ts` builds the id lists), and `npm run art:optimize`.

## Chroma-key mode (the default for both styles)

The API's native transparent mode drops thin dark limbs — rats came back with floating paws and
detached tails. So styles carry `"key": "green"` (thicket) or `"key": "blue"` (garden): the
image is rendered **opaque on a flat chroma screen** and keyed out by the tool. The key estimates
the screen's actual hue from the image corners (the model paints "pure green" in its own
palette), gates on brightness so near-black green fur survives, fills interior holes, drops
floating specks, and despills edge fringe. Green for the thicket because its rim light is cold
blue; blue for the garden because worms are pink and caterpillars are leaf-green.

Raw renders are kept in `art/out/<id>-raw.png` (gitignored) so the key can be re-tuned for free:
`npm run art -- --rekey --only <id>` re-runs only the key, no API call. A single asset can
override its style's key (`"key": "magenta"`) or disable it (`"key": false` — `null` falls
through to the style's key) in the manifest.

## Flags

```
npm run art                          generate every missing asset
npm run art -- --only a,b,c          only these ids
npm run art -- --force               regenerate even if the PNG exists
npm run art -- --quality xhigh       low | medium | high | xhigh | max
npm run art:poses -- --sheet <id> --names a,b,c [--out prefix] [--like frame] [--tone id]
npm run art:video -- --video <mp4> --out <prefix> --loop t0:t1 [--fidget t0:t1] [--fidget-video <mp4>] [--fidget-pingpong] [--fps n] [--key name] [--like frame] [--tone id] [--ffmpeg exe]
npm run art -- --model <id>          gpt-image-2.5-sunburst (default) | gpt-image-2.5-flare | gpt-image-1
npm run art -- --dry-run             print prompts, call nothing
npm run art -- --rekey --only a      re-run the chroma key on art/out/a-raw.png (free)
```

## Post-processing

Card art is generated square (1024×1024) and contain-fitted into the card's art window; keep the
subject centred with margin. Enemy sprites are generated on a transparent background and displayed as
billboards; if an image comes back with a baked-in background, re-roll rather than masking.

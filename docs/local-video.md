# Local video generation — Wan 2.2 in ComfyUI on the owner's GPU

Set up 2026-09-17 on the owner's PC (RTX 5070 Ti 16 GB, 32 GB RAM, driver 616). Image-to-video
with no API, no credits and **no content policy** — the route for gory stills that Runway/Sora
refuse. Facts below were verified against docs.comfy.org, the ComfyUI GitHub release and the
Comfy-Org Hugging Face repo before anything was downloaded.

## What is installed (outside the repo)

- `C:\Users\smite\ComfyUI_windows_portable\` — ComfyUI **v0.36.0**, the official portable NVIDIA
  build (`ComfyUI_windows_portable_nvidia.7z`, 1.92 GB, from
  https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.36.0). Bundles its own Python 3.13.14 and
  **PyTorch 2.13.0+cu130**, which carries the Blackwell (`sm_120`) kernels the 5070 Ti needs.
  Extracted with 7-Zip's standalone `7zr.exe` (https://7-zip.org/a/7zr.exe, kept in
  `C:\Users\smite\ComfyUI-downloads\`); nothing was installed system-wide.
- Models in `ComfyUI_windows_portable\ComfyUI\models\` (from
  https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged, SHA-256 verified):
  - `diffusion_models\wan2.2_ti2v_5B_fp16.safetensors` (10.0 GB)
  - `vae\wan2.2_vae.safetensors` (1.4 GB)
  - `text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors` (6.7 GB)
- The 14B I2V model (two 14.3 GB fp8 experts + `wan_2.1_vae` + optional 4-step LoRAs, same repo)
  is a possible quality step: it exceeds 16 GB VRAM and streams from RAM — unbenchmarked here.

## Using it

```bash
npm run video:local -- --image art/out/video/rat-first-frame-1280x720.png --out rat-idle --seed 7
```

`tools/gen-video-local.mjs` starts ComfyUI headless if it is not running (`--disable-auto-launch
--listen 127.0.0.1 --port 8188`, log in `art/out/video/comfyui.log`), fits the still onto Wan's
720p canvas (1280×704 — the 5B model wants multiples of 32, so a 1280×720 still gets 14 px of its
own corner colour on each side), uploads it, queues the graph in `tools/workflows/wan22-5b-i2v.json`
(the official 5B template: shift 8, 20 steps, cfg 5, `uni_pc`/`simple`, 24 fps, frames = 4n+1),
prints each sampler step, and downloads `art/out/video/<out>.mp4` (or `.webm` if the server's
SaveVideo node refuses its inputs and the tool falls back to SaveWEBM). Flags: `--prompt`,
`--negative`, `--seconds` (1–10), `--seed`, `--steps`, `--cfg`, `--server`, `--keep-server`.
Then cut it exactly like a Sora clip: `npm run art:video -- --video art/out/video/<out>.mp4 …`.

Measured on the first run: a 5 s clip takes **about 5 minutes** (≈12 s per step, ~2.3 GB VRAM in
use thanks to ComfyUI's dynamic offloading). The default negative prompt deliberately omits the
template's "static / still / motionless" terms, because a still body is what we want.

## By hand (optional)

Double-click `C:\Users\smite\ComfyUI_windows_portable\run_nvidia_gpu.bat` to open the ComfyUI
editor in a browser at http://127.0.0.1:8188 (the tool works against that server too). Templates
→ "Wan 2.2 5B video generation" is the graph the tool uses. Update with `update\update_comfyui.bat`.

## What the rat clips taught (2026-09-17)

- 5 s is the model's comfort zone: a 10 s clip lost the tentacles into a smear and never held
  still. Ask for one thing per clip — a tentacles-only loop (`rat-A2-tentacles`, seed 11) and a
  separate small movement — and combine them with `art:video --fidget-video`.
- Wan rarely returns _exactly_ to the start pose; `--fidget-pingpong` plays the movement forward
  then back so it always does (and a head dip becomes a bob). Keep the forward part short:
  Wan drifts within a second of a big movement (the rat grew a second bundle of tentacles
  from ~0.6 s), and a ping-pong through the drift shows it twice. A forward-only cut that
  ends where the creature has "settled" lands on Wan's drifted version of the stance, not
  the stance — the rat's landed with more tentacles than the loop has, and the handover
  showed. Measure frame-to-frame difference to find where the movement peaks and where
  drift begins; cut there.
- The eye fades over a clip. The cutter relights it only where it can still find it; the game
  places the glow from the first frame, which is enough for a still loop. Never paint a guessed
  box — it lands on fur as soon as the head moves.
- Record the prompt and seed of every clip you keep, in a tracked file — the one behind the
  loop clip B3 (`rat-B3-bob`) was never written down (`art/out/` is gitignored, so a note
  there does not count). The cut that made the current rat row:
  `npm run art:video -- --video art/out/video/rat-B3-bob.mp4 --out enemy-rat-local --loop 0.3:4.0 --fidget 0:0.83 --fidget-video art/out/video/rat-bark-103.mp4 --fidget-pingpong --fps 12 --like enemy-rat-rest --tone enemy-rat` (the reference frame was
  `enemy-rat-mutant-rest` at the time, renamed with the rest)
  (the fidget is the tentacle lash from re-roll `rat-bark-103`, cut to its peak at 0.83 s
  and played forward then back — 20 frames. Clip B's head turn was rejected in three cuts:
  the whole ping-pong drifted, a forward cut landed on the drift, the turn-away hid the
  tentacles).
- The fidget clip, so it can be re-rendered (Wan 2.2 5B, 3 s = 73 frames, 20 steps, cfg 5,
  still `rat-first-frame-1280x720.png`, **seed 103**, `--out rat-bark-103`). Prompt: _The
  mutant rat sits still on the flat green screen. One sudden snap of its jaws like a bark:
  the mouth flies open for an instant and the bundle of fleshy tentacles hanging from its
  mouth flings outward and whips around, then the mouth closes and the tentacles settle back
  to hanging exactly as before. The same tentacles stay attached and visible the whole time,
  the same number, never vanishing or multiplying. Body, legs and tail frozen in place.
  Locked-off camera, no camera movement, no zoom, flat bright green background unchanged._
  Negative: _bright colors, overexposed, blurry, low quality, JPEG artifacts, ugly, deformed,
  extra limbs, malformed, cluttered background, camera movement, zoom, text, watermark,
  tentacles disappearing, tentacles vanishing, extra tentacles, tentacles multiplying,
  morphing, head turning away, face hidden, walking, jumping._ (Seed 103 did not bark — it
  lashed the tentacles sideways — and that is what was kept.)
- Re-rolling for short movements (2026-09-17, eleven 3 s clips; all prompts and seeds in the
  gitignored `art/out/video/rat-bark-whip-prompts.txt`): Wan 5B moves this rat's jaw and
  tentacles readily and its head rarely — the three "bark" seeds all moved, the three "head
  whip" seeds all sat still, and a rewrite that led with the jerk instead of "sits still …
  holds still" got one whip in three. 3 s is enough for one movement and renders in
  ~2.5 min; ask for one movement per clip.
- Frames cut in separate runs do not share a placement: each run centres its own crop, so
  the Sora fidget frames sat 73 px left and 30 px up of the B3 loop's rat at the same scale
  (`--like` matches figure height, not position). They were translated onto the loop's
  placement with PIL (align the alpha bbox's top-right corner — the back, which the tentacles
  never touch) and written as `enemy-rat-local-startle-NN` (now `enemy-rat-startle-NN`). Since
  2026-09-18 the cutter stands a run's first frame on the `--like` figure's bottom-centre, so
  separate runs meet — but the **rat's committed frames predate that**: re-cutting its loop
  today lands 83 px left and 8 px down of the committed loop, off the hand-translated
  startle. Re-cut the rat's loop only together with its startle (as a `--like enemy-rat-rest`
  run of `sora-rat-attack.mp4`), never alone.
- The possum's kept clips (2026-09-18; still = the klein seed-4 raw fitted to 1280×704, negative
  prompt as for the rat plus "static, motionless"): **loop** seed 11, 5 s — _The mutant opossum
  holds completely still, its body, legs, head and tail frozen in place, while only the bundle of
  fleshy tentacles growing from its belly slowly writhes, curls and sways, and the thick one
  reaching up to its eye pulses gently. Locked-off camera, no camera movement, no zoom. The flat
  bright green background stays perfectly flat and unchanged._ **Retch** seed 201, 3 s — _One
  sudden violent retch: the mutant opossum's jaws gape wide and a wet mass of pink intestines
  and fleshy guts heaves out of its mouth and spills down toward the ground in a long
  glistening rope, then hangs there swinging. The belly tentacles stay attached and hanging as
  before. Its body, legs, head position and tail stay planted where they are. Locked-off
  camera, no zoom, flat bright green background unchanged._ Cut together: `npm run art:video --
--video art/out/video/possum2-loop-11.mp4 --out enemy-possum --loop 0.3:3.0 --fidget
0.75:1.92 --fidget-video art/out/video/possum2-retch-201.mp4 --fidget-pingpong --fps 12 --like
enemy-possum-rest --tone enemy-possum` (33 + 28 frames; the fidget frames were then renamed
  `enemy-possum-retch-NN`, and `python3 tools/art-redden.py` run on all of them). A hiss (seed 101) was cut
  first and rejected: past its first second the mouth spilled random shapes.
- The spider's Sora clips (2026-09-18, `sora-spider-jaws.json` / `sora-spider-wave.json` hold the
  prompts): the kept cut is `npm run art:video -- --video art/out/video/sora-spider-jaws.mp4
--out enemy-spider --loop 2.83:4.0 --fidget jaws=0.3:2.75 --fps 12 --like enemy-spider-rest
--tone enemy-possum --eyes 2` (the ids were `enemy-spider-mutant-*` until the 2026-09-18
  approval). Sections of the wave clip (`--anchor 0 --fidget legs1=0.33:1.33 --fidget
legs2=1.58:2.25 --fidget web=2.33:3.08`) were cut and **rejected** — they land off the loop.
  The wave's rear-leg lifts sit at 0.5 s (left), 1.1 s (right), 1.7 s (left, high), 2.4–2.8 s
  (both), 3.8 s and 5.5 s; after 2.3 s the legs settle wider.
- The spider's single-leg fidgets and web move (2026-09-18; the keyed sprite at 60% of a
  1280×704 pure-green canvas, `wan-spider-rear-still.png`; prompts in `spider-prompts.txt`):
  **leg** — _The huge shaggy black mutant tarantula lifts its rear left leg high into the air:
  the whole leg swings up and stretches straight up above its body, waves once at the top, then
  swings back down and plants itself exactly where it was. A big, clear movement of that one
  leg. The other seven legs stay planted; …_ seeds **411** (rear left) and **412** (rear right)
  kept; 413 (front right) and 414 (middle left) moved several legs or the body. The first
  wording, "holds completely still for a moment, then slowly raises its rear left leg …", made a
  clip in which nothing moved: the action must lead. A pass with the sprite at 48% of the frame
  (for headroom) was worse in every seed — one faded to green, one lifted and never lowered —
  so the raised tip leaving the frame at 60% is the lesser evil. **Web** (seed **501**, 3 s):
  _… raises both of its rear legs high into the air together, holds them up for a beat, and
  lowers them back down to exactly where they were …_ — clean, lands home; cut in as the Spin
  Web clip and then dropped by the owner, like the leg lifts. The cuts were `--anchor 0 --fidget
legl=0.08:1.83`, `--fidget legr=0.15:1.58`, `--fidget web=0.2:2.9`.
- The spider's rear-up (2026-09-18; still = the keyed sprite at 60% of a 1280×704 pure-green
  canvas, `art/out/video/wan-spider-rear-still.png`, prompt in `spider-prompts.txt`): **seed
  301**, 4 s — rears onto its back legs with all four forelegs high, holds 1.5 s, lands within a
  few pixels of where it started (d 3 against 12 for the others); cut 0–3.4 s forward. 302
  raised two legs and landed flat and wide; 303 backed away into the distance. Wan painted the
  raised leg tips pink (`tools/art-unred.py` took it off). Sora failed this move twice: at 85%
  the legs left the frame, at 60% it reframed the shot. Two more on the same prompt (the owner
  asked): **304** raises only the front pair and has not landed at 4 s; **305** spreads and
  raises both front pairs like his photo, stays in frame, and is half-landed at 4 s. He picked
  305: cut `--anchor 0 --fidget rear=0:1.58 --fidget-pingpong` (38 frames, rise to the held
  peak and back down the same way).
- Wan's **colour drift**: on the possum still most clips longer than ~1.5 s bled magenta (or
  green) into the fur — `possum2-floor-221/224/234/235`, `possum3-mouth-241`, `-bark-252`
  from 1.5 s. Pinning the fur in the prompt and the negative ("pink fur, red fur, green fur,
  colour shift, color cast, tinted") halved it; `art:video --hold-colour` removes what is left
  (per-frame channel gains to the first frame's mean). Cut short and early where you can.
- The possum's kept bark (2026-09-18): seed **252**, 3 s — _The mutant opossum gives one sharp
  bark: its head jerks forward a little, its jaws snap open wide baring the needle teeth for an
  instant, and then it snaps straight back to exactly the starting pose …_ — cut `--anchor 0
--fidget bark=0:0.92 --fidget-pingpong --hold-colour` (22 frames). Its siblings failed:
  the mouth-retch (241 magenta, 242 late and hanging), the hind-leg scratch (261 dissolved, 262
  moved a front paw and settled elsewhere) and the tentacle tug (271 walked off) — except
  **272, the kept tug**: the head dips toward the tentacle, then lifts with the jaws parting.
  It was first cut as its opening 1.25 s (`--fidget tug=0:1.25`), which is only the dip, a
  few pixels — the owner could see the tug in the clip and never in the game; on 2026-09-19
  he asked for the **whole clip forward then reversed**: `--anchor 0 --fidget tug=0:3.0
--fidget-pingpong --hold-colour`, 72 frames, `enemy-possum-tug-01..72` (the same day the
  fidget gate turned out to depend on the frame rate — fixed, spec §11.2). The tug
  prompt, seed 272: _The mutant opossum reaches up
  with one front paw, grabs the thick fleshy tentacle that runs from its belly up into its eye
  socket, and gives it a tug: the tentacle stretches and the head twitches with the pull, then
  the paw lets go and comes back down to exactly where it was, the tentacle settling back into
  place. Only that paw, the tentacle and a twitch of the head move; the body, other legs and
  tail stay planted._ (plus the fur-pinning tail and negative of take 4).
- **A tug made the other way round — the pose first (2026-09-18, late; made, shown, NOT
  applied: the owner wanted 272 kept and the game looked at, not a new clip).** The recipe
  is worth keeping.
  Twelve more Wan clips from the rest still (four wordings, all in `possum-prompts.txt`: the
  paw grabbing, seeds 281–283; the tentacle yanking, 291–293; a leg-lift-first wording,
  284–286; the original tug prompt, 273–275 — fourteen tries with the two before) never
  lifted a paw: Wan pushed the head about instead, sat still, or collapsed to green within a
  second (five of the twelve — three with a negative that added "subtle, slight", two with
  the plain one; the wording made no measurable difference). So **klein painted the end
  pose** as a still — `npm run image:local -- --out possum-tugpose-2 --edit
art/out/enemy-possum-mutant-raw.png --seed 2 --prompt …` with _The same mutant opossum, the
  same painting, on the same flat pure neon green screen background, unchanged. KEEP THE
  COLOURS AND LIGHTING: the fur stays dark - near-black, dirty greenish-grey, wet and clumped -
  under the same dim low-key lighting with crushed blacks; do not make it pale, white or
  bright. CHANGE ONLY THE POSE OF ONE FRONT LEG AND THE HEAD: the near front leg is lifted
  off the ground and its paw is raised up to the chin, the claws gripping the thick fleshy
  tentacle that runs from the belly up into the eye socket and pulling it taut downward; the
  head is bent down toward the paw with the jaws open, as if yanked. Everything else - the
  other three legs planted, the body, the tail, the belly tentacles, the wounds, the glowing
  amber eye - exactly as before._ (all four seeds raised the paw; **seed 2** grips a
  tentacle: `art/out/local/possum-tugpose-2.png`; the head did not bend and the main
  tentacle stayed put) — and **Wan animated the release from it** —
  _The mutant opossum lets go of the tentacle gripped in its raised front paw: the tentacle
  slips out of the claws and drops to hang down from its belly with the others, and the raised
  front leg swings down and plants its paw firmly on the ground beside the other front paw,
  so the opossum stands on all four legs. The head stays where it is with the jaws open. The
  body, the other legs and the tail stay planted. Its fur stays exactly the same dark
  greenish-black colour throughout and the lighting does not change. The belly tentacles stay
  attached. Locked-off camera, no zoom, flat bright green background unchanged._ Negative:
  _bright colors, overexposed, blurry, low quality, JPEG artifacts, ugly, deformed, extra
  limbs, malformed, cluttered background, camera movement, zoom, text, watermark, tentacles
  disappearing, tentacles vanishing, extra tentacles, tentacles multiplying, morphing,
  walking, jumping, turning around, lowering its head, bowing, crouching, lying down, eating,
  pink fur, red fur, green fur, colour shift, color cast, tinted, static, motionless_. A limb
  coming down is a motion it draws readily: seed **303** plants the paw inside 0.5 s (301 too,
  but greener; 302 keeps hold and fiddles). Cut `npm run art:video -- --video
art/out/video/possum5-release-303.mp4 --out enemy-possum --anchor 0 --fidget tug=0:0.67
--fidget-reverse --fidget-pingpong --fps 12 --like enemy-possum-rest --tone enemy-possum
--hold-colour` then `art-redden.py` gave 16 frames, rest → paw up at the tentacle → rest
  (`--fidget-reverse` plays the section backwards first, so a clip that starts in the pose
  becomes a fidget that starts at rest; `--anchor 0` is the pose, which sets the placement and
  the colour hold). Two seams against the loop, both at the cross-fades: **Wan shut the jaws
  as the paw landed** (the prompt asked for them open), so the fidget's first and last four
  frames have the mouth closed and the muzzle pushed 16 px forward where the loop's rest has
  the jaws wide — the 150 ms fade in and the 300 ms fade out each dissolve open to shut; and
  the clip's last 0.2 s (frames 01–03) had started to go green, so the key thinned the fur
  highlights there (mean alpha 232 against the loop's 244). The eye sits 0.02 units higher
  than the loop's; the settle sinks it. Four more release seeds with the jaws pinned in the
  prompt (_Its jaws stay gaping wide open the whole time, the needle teeth bared, the mouth
  never closing_) and the negative (_closing its mouth, jaws closing, mouth shut_), seeds
  304–307: **304** kept them open and lowered the paw over two seconds but went purple from
  0.5 s (the colour hold turns that into green fur and magenta tentacles — a per-channel gain
  cannot undo a hue split); 305 held colour and jaws and never let go; 306 and 307 went
  green. The 303 cut is not on disk; the command above remakes it.
- **Wan drifts toward the screen colour.** Re-keying the same pose still onto pure blue
  (`art/out/local/possum-tugpose-2-blue.png`; the key strips the green, sharp lays the figure on
  `#0000FF`) held the fur's colour for the whole 3 s on two seeds of three and the third
  drifted _blue_ — but none of the three let go of the tentacle, so the green 303 was kept.
  A blue screen is the move when a clip's motion is right and only the colour fails, since
  the fur has no blue for the key to take; `art:video --key blue`.
- The cutter never deletes stale frames: when a re-cut has fewer frames, delete the old
  `<out>-fidget-*.png` and `public/art/<out>-fidget-*.webp` first.

## Gotchas

- 1280×**720** is not a valid 5B size (the server does not enforce the ×32 step, the model then
  misbehaves); the tool always renders 1280×704.
- Identical graphs are cached by ComfyUI and not re-run — change the seed to re-roll.
- The first run after a reboot spends ~30 s loading the 17 GB of weights from disk.
- Timing out the tool does not cancel the job; `POST /interrupt` on the server does.
- The game and ComfyUI share the GPU; stop one before benchmarking the other.

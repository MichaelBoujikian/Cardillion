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
  `npm run art:video -- --video art/out/video/rat-B3-bob.mp4 --out enemy-rat-local --loop 0.3:4.0 --fidget 0:0.83 --fidget-video art/out/video/rat-bark-103.mp4 --fidget-pingpong --fps 12 --like enemy-rat-mutant-rest --tone enemy-rat`
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
- The cutter never deletes stale frames: when a re-cut has fewer frames, delete the old
  `<out>-fidget-*.png` and `public/art/<out>-fidget-*.webp` first.

## Gotchas

- 1280×**720** is not a valid 5B size (the server does not enforce the ×32 step, the model then
  misbehaves); the tool always renders 1280×704.
- Identical graphs are cached by ComfyUI and not re-run — change the seed to re-roll.
- The first run after a reboot spends ~30 s loading the 17 GB of weights from disk.
- Timing out the tool does not cancel the job; `POST /interrupt` on the server does.
- The game and ComfyUI share the GPU; stop one before benchmarking the other.

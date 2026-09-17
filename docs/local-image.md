# Local image generation — FLUX.2 klein and Z-Image in ComfyUI on the owner's GPU

Set up 2026-09-17 alongside the video rig (docs/local-video.md, same ComfyUI install). Stills and
**edits** with no API, no credits and **no content policy** — for the gore that the image APIs
and Runway refuse. Both models are **Apache-2.0**, so a sold game is fine. Facts verified against
docs.comfy.org, the Comfy-Org workflow templates and the model cards before downloading.

## What is installed (in `C:\Users\smite\ComfyUI_windows_portable\ComfyUI\models\`)

- `diffusion_models\flux-2-klein-4b-fp8.safetensors` (4.1 GB) — **FLUX.2 [klein] 4B**, Black
  Forest Labs, distilled (4 steps): text-to-image **and** editing (keep the reference, change
  what the prompt says). ~8.4 GB VRAM. https://huggingface.co/black-forest-labs/FLUX.2-klein-4b-fp8
- `diffusion_models\z_image_int8_convrot.safetensors` (6.2 GB) — **Z-Image** (base), Alibaba
  Tongyi-MAI, 6B: text-to-image, painterly range, takes a negative prompt, 25 steps.
  https://huggingface.co/Comfy-Org/z_image
- `text_encoders\qwen_3_4b.safetensors` (8.0 GB) — shared by both.
- `vae\flux2-vae.safetensors` (klein) and `vae\ae.safetensors` (Z-Image).
- All SHA-256s matched Hugging Face's published values.

Not installed, documented as the upgrade path for editing fidelity: **Qwen-Image-Edit-2511**
(Apache-2.0, 20.5 GB fp8 + 9.4 GB encoder — over 16 GB VRAM, streams from RAM, unbenchmarked
here). Excluded on licence: FLUX.2 dev, klein 9B, FLUX.1 Kontext (non-commercial).

## Using it

```bash
# an EDIT: keep this creature, change what the prompt says (klein, ~25 s)
npm run image:local -- --out rat-gory --edit assets/art/enemy-rat-mutant.png \
  --prompt "Keep this exact rat, its pose, fur, amber eye and the flat green background. Tear the skin open across its flank so wet red muscle and ribs show."

# a NEW still (Z-Image by default, ~25 s; --model klein for the 4-step model)
npm run image:local -- --out possum-mutant --size 1024x1024 --prompt "Grim photorealistic painted illustration ... flat pure green chroma-key screen background."
```

`tools/gen-image-local.mjs` starts ComfyUI headless if needed, uploads the reference (flattened
onto pure green — the chroma key removes it later), queues `tools/workflows/flux2-klein-4b.json`
or `tools/workflows/z-image.json`, and saves `art/out/local/<out>.png`. Flags: `--negative`
(Z-Image), `--size WxH` (multiples of 16; 1536x1024 for sheets), `--seed`, `--steps`, `--cfg`,
`--server`, `--keep-server`. Measured on the first runs: an edit in 24 s, a 1024² still in 23 s.

To take a local still into the game, use it as the `subject`-style source: the `npm run art`
pipeline expects a chroma screen, so either key the PNG with `npm run art -- --rekey` after
copying it to `art/out/<id>-raw.png`, or carry the input's alpha over for an edit whose pose did
not change.

## What the first tests showed

- **klein edit** of the mutant rat: ribs through the flank, blood on the ground, tentacles and
  amber eye kept, near-black fur — the gore no API allows. It keeps the _character_, not the
  pixels: the rat sat up slightly, and it repainted the flat green screen as a dark textured
  backdrop, which the chroma key will not like. Say "flat pure neon green screen, unchanged" in
  the prompt, or reuse the input's alpha.
- **Z-Image** possum from a prompt: right ingredients (tentacles, open ribcage, amber eye,
  green screen) but more illustrative than the gpt-image-2.5 look, and a floaty pose. Use
  gpt-image-2.5-sunburst first for stills; come here for gore, or for free iteration.

## Gotchas

- Both graphs are API-format JSON built from the official templates (node ids kept); the
  templates' resolution helpers were dropped, so sizes are exact — pass multiples of 16.
- klein is distilled: 4 steps, cfg 1, no negative prompt (it is zeroed out). Z-Image: 25 steps,
  cfg 4, `res_multistep`/`simple`, shift 3, negative prompt honoured.
- Identical graphs are cached and not re-run — change the seed.
- The video and image tools share `tools/lib/comfy.mjs` (server start, upload, queue, follow,
  download). `--keep-server` leaves the server up for the next call; it holds ~2 GB VRAM idle.

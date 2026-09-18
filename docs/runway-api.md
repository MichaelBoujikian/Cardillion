# Runway image-to-video — what the tool needs to know

Verified against Runway's own pages on 2026-09-17 (docs.dev.runwayml.com including the OpenAPI
spec at `/api/`, dev.runwayml.com, help.runwayml.com, runway.com/safety/usage-policy). Re-check
the pricing page before budgeting; models and prices change monthly.

## Account, key, credits (the owner does these)

1. Sign up at https://dev.runwayml.com/ (direct: https://dev.runwayml.com/login?screen_hint=signup —
   email, Google or GitHub). The **API account is separate from the Runway web app**; app
   credits never work for the API and vice versa.
2. Create an **organization** (offered right after sign-up); it holds the keys and billing.
3. **Billing tab** → add credits. Credits are **$0.01 each**, **minimum $10** (1,000 credits),
   card via Stripe, sales tax may apply. No free API credits are documented. Optional
   autobilling (recharge when below a threshold, min $10).
4. **API Keys tab** → create a key (shown **once**; copy it immediately). Format `key_…`.
5. Put it in `.env` as `RUNWAYML_API_SECRET=key_…` (the tool and Runway's SDK read that name).
   Never commit it. (The owner's account came with free credits on 2026-09-17, contrary to the
   "none documented" note below.)

New organizations are **Tier 1**: 1 video task at a time, 50 generations per rolling 24 h,
$100 of purchases per 30 days. Tier 2 (3 at a time, 500/day) is automatic after $50 bought.

## Prices (https://docs.dev.runwayml.com/guides/pricing/)

| Request                       | Credits | USD   |
| ----------------------------- | ------- | ----- |
| `gen4_turbo`, 5 s, mp4        | 25      | $0.25 |
| `gen4_turbo`, 10 s, mp4       | 50      | $0.50 |
| `gen4.5`, 5 s, mp4            | 60      | $0.60 |
| `gen4.5`, 10 s, mp4           | 120     | $1.20 |
| `gen4.5`, 5 s, `png_sequence` | 85      | $0.85 |

$10 buys 40 five-second `gen4_turbo` clips. **Moderated (safety-failed) generations are charged
in full and not refunded.** Every request returns `estimatedCost.credits`; the finished task
returns `cost.credits`.

## Models

Runway's own image-to-video models: **`gen4_turbo`** (fastest, 5 credits/s, image input,
`promptText` optional) and **`gen4.5`** (their "best quality", 12 credits/s, `promptText` and
`duration` required, and the only one that can return `outputFormat: "png_sequence"`, a zip
of PNG frames, +5 credits/s). `gen3a_turbo` and `gen4_aleph` were retired 2026-07-30. Fourteen
third-party models (Veo 3.1, Seedance, Hailuo, Wan, Grok, …) share the endpoint at other prices.
Plan: iterate prompt and seed on `gen4_turbo`, render the keeper on `gen4.5`. No model outputs
alpha — keep the green screen in the input and key the output with `npm run art:video`.

## The request (OpenAPI version `2024-11-06`)

- `POST https://api.dev.runwayml.com/v1/image_to_video`, headers `Authorization: Bearer
$RUNWAYML_API_SECRET`, `X-Runway-Version: 2024-11-06` (required, the only version),
  `Content-Type: application/json`.
- Body: `model`; `promptImage` — an HTTPS URL, a `runway://` upload URI, or a data URI
  `data:image/png;base64,…` (**≤ 5 MB encoded, so the PNG must be ≤ 3.3 MB**); `promptText`
  1–1000 chars; `ratio` one of `1280:720`, `720:1280`, `1104:832`, `832:1104`, `960:960`,
  `1584:672`; `duration` integer 2–10 (no default — always pass it); `seed` 0–4294967295.
- Response `{ id, estimatedCost: { credits } }`. Poll `GET /v1/tasks/{id}` **no more than every
  5 s** (add jitter): `PENDING` → `THROTTLED`/`RUNNING` (with `progress`) → `SUCCEEDED` (with
  `output: [url]`, `cost`) or `FAILED` (with `failureCode`, e.g. `SAFETY.INPUT.IMAGE`) or
  `CANCELLED`. **Output URLs expire in 24–48 h — download at once.**
- Node: `npm i @runwayml/sdk` (Node 18+); `new RunwayML()` reads the env var and sets the
  version header; chain `.waitForTaskOutput()` on the **unawaited** `create()` call.

## The tool (`npm run video:runway`, 2026-09-17 evening)

```bash
npm run video:runway -- --image art/out/video/rat-first-frame-1280x720.png --out rat-runway-1   --prompt "..." [--model gen4_turbo|gen4.5] [--seconds 5] [--seed n] [--ratio 1280:720] [--dry-run]
```

`tools/gen-video-runway.mjs` reads `RUNWAYML_API_SECRET` from `.env` (`tools/lib/env.mjs`; the
value is never printed), fits the still onto the ratio's frame on its corner colour, sends it
inline as a data URI, prints Runway's `estimatedCost`, polls the task every 5–6.5 s, and
downloads the mp4 at once to `art/out/video/<out>.mp4`. It also writes `<out>.json` — model,
prompt, seed, ratio, duration, task id, final `cost.credits`, and on failure `failureCode` +
`failure` — so a kept clip can be re-rendered (copy that record into a tracked doc). Exit code 2
on FAILED/CANCELLED. `--dry-run` builds the request and stops. Plain `fetch`, no SDK. The request
shape was checked against https://docs.dev.runwayml.com/openapi.json on 2026-09-17: the same
endpoint now also fronts `veo3.1`, `veo3.1_fast`, `seedance2*`, `wan3*`, `hailuo3`, `h3_max`,
`grok_imagine_1_5`, `gemini_omni_flash*`, `happyhorse_1_0` with their own parameters (audio,
resolution, other ratios); the tool only knows the two Runway models — extend `MODELS` and the
body builder before pointing it at one of those.

## Input image rules

PNG/JPEG/WebP (no GIF); recommended between 640×640 and 4K; the input's aspect must be within
0.5–2.358 (`gen4_turbo`) or 0.5–2 (`gen4.5`) and is **centre-cropped** to `ratio`, so send a
1280×720 PNG for `1280:720`. No logos or overlaid text (a common `INTERNAL.BAD_OUTPUT` cause).

## Gotchas that matter here

- **Moderation cannot be disabled**, runs on the image, the text and the output, charges in
  full when it fails, and too many failures suspend the org. Runway's Usage Policy (updated
  2026-03-06) bans "Gore, such as dismemberment, beheadings, mutilations, and exposed
  organs/bones/muscle", graphic violence and animal abuse. Fictional monsters are not named.
  **Test the pre-gore rat first**; the gorier stills may be refused, in which case the passive
  clip comes from a cleaner still and the gore lives in the pose-sheet frames.
- Output is opaque H.264 mp4; frame rate and exact size are undocumented.
- Commercial use: outputs are yours, no credit required (help center); the docs ask for
  "Powered by Runway" only if you attribute.

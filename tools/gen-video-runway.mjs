#!/usr/bin/env node
/**
 * Cardillion Runway video generator - image-to-video through Runway's API, for the creature
 * clips the local rig cannot get right. See docs/runway-api.md for the account, prices and
 * the moderation rules (a refused generation is charged in full).
 *
 *   npm run video:runway -- --image art/out/video/rat-first-frame-1280x720.png --out rat-runway-1 \
 *     --prompt "..." [--model gen4_turbo|gen4.5] [--seconds 5] [--seed n] [--ratio 1280:720]
 *
 *   --image <png>    the still: fitted onto the ratio's frame on its own corner colour and sent
 *                    inline as a data URI (the encoded image must stay under 5 MB)
 *   --out <name>     writes art/out/video/<name>.mp4, <name>-still.png (what was sent) and
 *                    <name>.json (the request, the task id, the cost or the failure code)
 *   --prompt <text>  what moves, 1-1000 characters (most models require it)
 *   --model <id>     gen4_turbo (default) | gen4.5 | veo3.1 | veo3.1_fast | seedance2_mini |
 *                    seedance2_5 | wan3 | h3_max - see MODELS for each one's price and rules
 *   --negative <t>   what to avoid (veo3.1 and veo3.1_fast only)
 *   --seconds <n>    clip length (default 5; veo takes 4 | 6 | 8, seedance/h3 at least 4/5)
 *   --seed <n>       0..4294967295 (default: random; always printed and recorded)
 *   --ratio <w:h>    1280:720 (default); each model has its own list (h3_max takes a resolution)
 *   --dry-run        build and print the request (without the image data), call nothing
 *
 * Needs RUNWAYML_API_SECRET in .env; it is never printed. The task is polled every five-odd
 * seconds (Runway's limit) and the output downloaded at once (its URL expires within a day).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { loadDotEnv, requireEnv } from './lib/env.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = path.join(ROOT, 'art', 'out', 'video');
const API = 'https://api.dev.runwayml.com/v1';
const VERSION = '2024-11-06';
const GEN4_RATIOS = ['1280:720', '720:1280', '1104:832', '832:1104', '960:960', '1584:672'];
const VEO_RATIOS = ['1280:720', '720:1280', '1080:1920', '1920:1080'];
const SEEDANCE_RATIOS = ['1280:720', '720:1280', '960:960', '1112:834', '834:1112', '1470:630'];
const WAN_RATIOS = ['1280:720', '720:1280', '1104:832', '832:1104', '960:960', '1920:1080'];
/**
 * What the tool knows about each model (checked against Runway's OpenAPI spec and pricing page,
 * 2026-09-17): credits per second at 720p with no audio, the durations allowed, the ratio list
 * (or, for h3_max, a resolution), and which extras the body takes. Audio is always off.
 */
const MODELS = {
  gen4_turbo: { credits: 5, seconds: (n) => n >= 2 && n <= 10, ratios: GEN4_RATIOS },
  'gen4.5': {
    credits: 12,
    seconds: (n) => n >= 2 && n <= 10,
    ratios: GEN4_RATIOS,
    promptRequired: true,
  },
  'veo3.1': {
    credits: 20,
    seconds: (n) => [4, 6, 8].includes(n),
    ratios: VEO_RATIOS,
    audio: true,
    negative: true,
  },
  'veo3.1_fast': {
    credits: 10,
    seconds: (n) => [4, 6, 8].includes(n),
    ratios: VEO_RATIOS,
    audio: true,
    negative: true,
  },
  seedance2_mini: {
    credits: 16,
    minCredits: 64,
    seconds: (n) => n >= 4 && n <= 15,
    ratios: SEEDANCE_RATIOS,
    audio: true,
  },
  seedance2_5: {
    credits: 30,
    seconds: (n) => n >= 4 && n <= 30,
    ratios: SEEDANCE_RATIOS,
    audio: true,
  },
  wan3: {
    credits: 10,
    seconds: (n) => n >= 2 && n <= 30,
    ratios: WAN_RATIOS,
    audio: true,
    promptRequired: true,
    noSeed: true,
  },
  h3_max: {
    credits: 8,
    seconds: (n) => n >= 5 && n <= 15,
    resolution: '768p',
    promptRequired: true,
    expansion: 'disabled',
  },
};
/** A data URI must stay under 5 MB encoded; base64 grows the bytes by a third. */
const MAX_IMAGE_BYTES = Math.floor((5 * 1024 * 1024 * 3) / 4) - 64;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const image = opt('image');
const outName = opt('out');
if (!image || !outName) {
  console.error(
    'usage: gen-video-runway --image <png> --out <name> [--prompt ..] [--model gen4_turbo|gen4.5] [--seconds 5] [--seed n] [--ratio 1280:720] [--dry-run]',
  );
  process.exit(1);
}
const model = opt('model') ?? 'gen4_turbo';
const spec = MODELS[model];
if (!spec) throw new Error(`unknown model ${model}; use ${Object.keys(MODELS).join(' | ')}`);
const seconds = Math.round(Number(opt('seconds') ?? 5));
if (!spec.seconds(seconds)) throw new Error(`${model} does not take --seconds ${seconds}`);
const seed = Number(opt('seed') ?? Math.floor(Math.random() * 2 ** 32));
const ratio = opt('ratio') ?? '1280:720';
if (spec.ratios && !spec.ratios.includes(ratio))
  throw new Error(`${model} takes a ratio of ${spec.ratios.join(', ')}`);
const prompt = opt('prompt');
if (spec.promptRequired && !prompt) throw new Error(`${model} requires --prompt`);
const negative = opt('negative');
if (negative && !spec.negative) throw new Error(`${model} has no negative prompt`);
if (prompt && (prompt.length < 1 || prompt.length > 1000))
  throw new Error('--prompt is 1..1000 characters');

loadDotEnv(ROOT);
const key = flag('dry-run') ? '' : requireEnv('RUNWAYML_API_SECRET', 'docs/runway-api.md');
const headers = {
  Authorization: `Bearer ${key}`,
  'X-Runway-Version': VERSION,
  'Content-Type': 'application/json',
};

// 1. The still, fitted to the ratio's frame on its top-left pixel colour (the chroma screen).
fs.mkdirSync(OUT_DIR, { recursive: true });
// h3_max sizes by resolution, not ratio: the still goes at 1280x720 and the model keeps its shape.
const [rw, rh] = (spec.ratios ? ratio : '1280:720').split(':').map(Number);
const src = sharp(path.resolve(ROOT, image));
const meta = await src.metadata();
const { data } = await src.clone().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const bg = { r: data[0], g: data[1], b: data[2] };
const fitted = src
  .resize(rw, rh, { fit: 'contain', background: bg, kernel: 'lanczos3' })
  .flatten({ background: bg });
let still = await fitted.clone().png().toBuffer();
let mime = 'image/png';
if (still.length > MAX_IMAGE_BYTES) {
  still = await fitted.clone().webp({ lossless: true }).toBuffer();
  mime = 'image/webp';
  if (still.length > MAX_IMAGE_BYTES)
    throw new Error(
      `the still is ${still.length} bytes even as lossless WebP; the data URI limit is 5 MB`,
    );
}
const stillPath = path.join(OUT_DIR, `${outName}-still.${mime === 'image/png' ? 'png' : 'webp'}`);
fs.writeFileSync(stillPath, still);
console.log(
  `still: ${meta.width}x${meta.height} -> ${rw}x${rh} ${mime} (${(still.length / 1024).toFixed(0)} KB, ${path.relative(ROOT, stillPath)})`,
);

// 2. The request.
const body = {
  model,
  promptImage: `data:${mime};base64,${still.toString('base64')}`,
  duration: seconds,
  ...(spec.ratios ? { ratio } : { resolution: spec.resolution }),
  ...(spec.noSeed ? {} : { seed }),
  ...(prompt ? { promptText: prompt } : {}),
  ...(spec.negative && negative ? { negativePrompt: negative } : {}),
  ...(spec.audio ? { audio: false } : {}),
  ...(spec.expansion ? { promptExpansionMode: spec.expansion } : {}),
};
const record = {
  model,
  prompt: prompt ?? null,
  negative: negative ?? null,
  seed: spec.noSeed ? null : seed,
  ratio: spec.ratios ? ratio : spec.resolution,
  duration: seconds,
  image,
  still: path.relative(ROOT, stillPath),
  estimatedCredits: Math.max(spec.minCredits ?? 0, spec.credits * seconds),
  requestedAt: new Date().toISOString(),
};
const recordPath = path.join(OUT_DIR, `${outName}.json`);
const save = () => fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');
console.log(
  `request: ${model}, ${seconds}s, ${record.ratio}, seed ${record.seed ?? 'n/a'}, ~${record.estimatedCredits} credits${prompt ? `\nprompt: ${prompt}` : ''}${negative ? `\nnegative: ${negative}` : ''}`,
);
if (flag('dry-run')) {
  console.log('dry run: nothing sent');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, route, payload) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `${method} ${route} -> ${res.status}: ${json.error ?? json.message ?? text}`,
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

// 3. Create the task, then poll it - no more often than every 5 s, with a little jitter.
let task;
try {
  task = await api('POST', '/image_to_video', body);
} catch (err) {
  record.error = { status: err.status, body: err.body };
  save();
  throw err;
}
record.taskId = task.id;
if (task.estimatedCost?.credits != null) record.estimatedCredits = task.estimatedCost.credits;
save();
console.log(`task ${task.id} queued; Runway estimates ${record.estimatedCredits} credits`);

const t0 = Date.now();
let last = '';
let status;
for (;;) {
  await sleep(5000 + Math.random() * 1500);
  status = await api('GET', `/tasks/${task.id}`);
  const line = `  ${status.status}${status.progress != null ? ` ${Math.round(status.progress * 100)}%` : ''} (${Math.round((Date.now() - t0) / 1000)}s)`;
  if (line !== last) console.log((last = line));
  if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status.status)) break;
  if (Date.now() - t0 > 20 * 60 * 1000)
    throw new Error(`still ${status.status} after 20 minutes: task ${task.id}`);
}
record.status = status.status;
record.finishedAt = new Date().toISOString();
if (status.cost?.credits != null) record.credits = status.cost.credits;

if (status.status !== 'SUCCEEDED') {
  record.failureCode = status.failureCode ?? null;
  record.failure = status.failure ?? null;
  save();
  console.error(
    `${status.status}: ${status.failureCode ?? 'no code'}${status.failure ? ` - ${status.failure}` : ''}${record.credits != null ? ` (${record.credits} credits charged)` : ''}`,
  );
  process.exit(2);
}

// 4. Download at once: the URL expires within a day.
const url = Array.isArray(status.output) ? status.output[0] : status.output;
if (!url) throw new Error(`SUCCEEDED but no output url: ${JSON.stringify(status)}`);
const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
const outPath = path.join(OUT_DIR, `${outName}.mp4`);
fs.writeFileSync(outPath, bytes);
record.output = path.relative(ROOT, outPath);
save();
console.log(
  `saved ${record.output} (${(bytes.length / 1024).toFixed(0)} KB) in ${Math.round((Date.now() - t0) / 1000)}s; ${record.credits ?? record.estimatedCredits} credits`,
);

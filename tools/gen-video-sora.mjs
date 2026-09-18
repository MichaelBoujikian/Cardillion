#!/usr/bin/env node
/**
 * Cardillion Sora video generator - image-to-video on OpenAI's Sora API (sora-2-pro), the one
 * model whose clips have come back to their own first frame. The API shuts down 2026-09-24.
 *
 *   npm run video:sora -- --image assets/art/enemy-possum-mutant-rest.png --out sora-possum-1 \
 *     --prompt "..." [--seconds 8] [--model sora-2-pro|sora-2] [--size 1280x720] [--dry-run]
 *   npm run video:sora -- --job <video_id> --out <name>      # poll + download an existing job
 *
 *   --image <png>    a keyed frame (alpha) or a finished still; a keyed frame is composed onto a
 *                    pure green 1280x720 screen at --height of its height (default 0.85, like the
 *                    rat's first frame; 0.6 leaves headroom for a creature that rears up)
 *   --out <name>     writes art/out/video/<name>.mp4, <name>-still.png (what was sent) and
 *                    <name>.json (the request, the job id, the status, any error)
 *   --prompt <text>  what moves; the rat's prompt is the model: three seconds at rest with the
 *                    "tendrils" swaying, one mild startle, then back to the starting pose
 *   --seconds <n>    4 | 8 | 12 (default 8)
 *   --model <id>     sora-2-pro (default, about $0.30 per second at 1280x720) or sora-2 (cheaper)
 *   --size <wxh>     1280x720 (default) | 720x1280 | 1024x1792 | 1792x1024
 *   --dry-run        compose the still and print the request, call nothing
 *
 * Needs OPENAI_API_KEY in .env (never printed). Words matter for the output filter: the rat's
 * "vicious bite" version was blocked, the "startles ... mouth open" one passed; say "tendrils".
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { loadDotEnv, requireEnv } from './lib/env.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = path.join(ROOT, 'art', 'out', 'video');
const API = 'https://api.openai.com/v1';
const SIZES = ['1280x720', '720x1280', '1024x1792', '1792x1024'];
const SECONDS = [4, 8, 12];
const PRICE = { 'sora-2-pro': 0.3, 'sora-2': 0.1 }; // USD per second at 720p, from the rat's bill
const GREEN = { r: 0, g: 255, b: 0 };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outName = opt('out');
const job = opt('job');
const image = opt('image');
if (!outName || (!image && !job)) {
  console.error(
    'usage: gen-video-sora --image <png> --out <name> --prompt <text> [--seconds 8] [--model sora-2-pro] [--size 1280x720] [--dry-run]\n       gen-video-sora --job <video_id> --out <name>',
  );
  process.exit(1);
}
const model = opt('model') ?? 'sora-2-pro';
if (!(model in PRICE))
  throw new Error(`unknown model ${model}; use ${Object.keys(PRICE).join(' | ')}`);
const seconds = Number(opt('seconds') ?? 8);
if (!SECONDS.includes(seconds)) throw new Error(`--seconds must be one of ${SECONDS.join(', ')}`);
const size = opt('size') ?? '1280x720';
if (!SIZES.includes(size)) throw new Error(`--size must be one of ${SIZES.join(', ')}`);
const prompt = opt('prompt');
const height = Number(opt('height') ?? 0.85);
if (!(height > 0.2 && height <= 0.95)) throw new Error('--height must be between 0.2 and 0.95');
if (!job && !prompt) throw new Error('--prompt is required');

loadDotEnv(ROOT);
const key = flag('dry-run') ? '' : requireEnv('OPENAI_API_KEY', 'docs/art-pipeline.md');
const auth = { Authorization: `Bearer ${key}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT_DIR, { recursive: true });
const recordPath = path.join(OUT_DIR, `${outName}.json`);
const record = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : {};
const save = () => fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');

async function api(route, init = {}) {
  const res = await fetch(`${API}${route}`, {
    ...init,
    headers: { ...auth, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${route} -> ${res.status}: ${json.error?.message ?? text}`);
    err.body = json;
    throw err;
  }
  return json;
}

let videoId = job;
if (!videoId) {
  // 1. The first frame: a keyed frame is stood on a pure green screen; a finished still is fitted.
  const [w, h] = size.split('x').map(Number);
  const src = sharp(path.resolve(ROOT, image));
  const meta = await src.metadata();
  let still;
  if (meta.hasAlpha) {
    const figureH = Math.round(h * height);
    const figure = await src.resize({ height: figureH, kernel: 'lanczos3' }).png().toBuffer();
    const fm = await sharp(figure).metadata();
    still = await sharp({ create: { width: w, height: h, channels: 3, background: GREEN } })
      .composite([
        {
          input: figure,
          left: Math.round((w - fm.width) / 2),
          top: h - figureH - Math.round(h * Math.min(0.05, (1 - height) / 2)),
        },
      ])
      .png()
      .toBuffer();
  } else {
    const { data } = await src.clone().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const bg = { r: data[0], g: data[1], b: data[2] };
    still = await src
      .resize(w, h, { fit: 'contain', background: bg })
      .flatten({ background: bg })
      .png()
      .toBuffer();
  }
  const stillPath = path.join(OUT_DIR, `${outName}-still.png`);
  fs.writeFileSync(stillPath, still);
  console.log(
    `still: ${meta.width}x${meta.height}${meta.hasAlpha ? ' keyed' : ''} -> ${size} (${path.relative(ROOT, stillPath)})`,
  );

  Object.assign(record, {
    model,
    prompt,
    seconds,
    size,
    image,
    height,
    still: path.relative(ROOT, stillPath),
    estimatedUsd: +(PRICE[model] * seconds).toFixed(2),
    requestedAt: new Date().toISOString(),
  });
  console.log(
    `request: ${model}, ${seconds}s, ${size}, ~$${record.estimatedUsd}\nprompt: ${prompt}`,
  );
  if (flag('dry-run')) {
    console.log('dry run: nothing sent');
    process.exit(0);
  }

  // 2. Create the job.
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('seconds', String(seconds));
  form.append('input_reference', new Blob([still], { type: 'image/png' }), 'first.png');
  let created;
  try {
    created = await api('/videos', { method: 'POST', body: form });
  } catch (err) {
    record.error = err.body ?? String(err);
    save();
    throw err;
  }
  videoId = created.id;
  record.jobId = videoId;
  save();
  console.log(`job ${videoId} ${created.status}`);
}

// 3. Poll (Sora jobs take minutes), then download the video and its thumbnail.
const t0 = Date.now();
let last = '';
let done;
for (;;) {
  await sleep(10_000);
  done = await api(`/videos/${videoId}`);
  const line = `  ${done.status} ${done.progress ?? 0}% (${Math.round((Date.now() - t0) / 1000)}s)`;
  if (line !== last) console.log((last = line));
  if (done.status === 'completed') break;
  if (done.status === 'failed') {
    record.status = 'failed';
    record.error = done.error ?? null;
    save();
    console.error(`FAILED: ${JSON.stringify(done.error)}`);
    process.exit(2);
  }
  if (Date.now() - t0 > 30 * 60 * 1000)
    throw new Error(`still ${done.status} after 30 minutes: job ${videoId}`);
}
record.status = 'completed';
record.finishedAt = new Date().toISOString();
for (const [variant, ext] of [
  ['video', 'mp4'],
  ['thumbnail', 'webp'],
]) {
  const res = await fetch(`${API}/videos/${videoId}/content?variant=${variant}`, {
    headers: auth,
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`download ${variant} failed ${res.status}: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT_DIR, `${outName}${variant === 'video' ? '' : '-thumb'}.${ext}`);
  fs.writeFileSync(file, buf);
  if (variant === 'video') record.output = path.relative(ROOT, file);
  console.log(`saved ${path.relative(ROOT, file)} (${(buf.length / 1024).toFixed(0)} KB)`);
}
save();
console.log(
  `done in ${Math.round((Date.now() - t0) / 1000)}s; about $${record.estimatedUsd ?? '?'}`,
);

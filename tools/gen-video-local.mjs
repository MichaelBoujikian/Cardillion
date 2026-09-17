#!/usr/bin/env node
/**
 * Cardillion local video generator - image-to-video on the owner's own GPU through ComfyUI
 * (Wan 2.2 5B), no API, no credits, no content policy. See docs/local-video.md.
 *
 *   npm run video:local -- --image art/out/video/rat-first-frame-1280x720.png --out rat-idle \
 *     --prompt "..." [--negative "..."] [--seconds 5] [--seed 7] [--steps 20] [--cfg 5]
 *
 *   --image <png>      the still (any size; fitted onto 1280x704, Wan's 720p, on its corner colour)
 *   --out <name>       writes art/out/video/<name>.mp4 (and <name>-still.png, what was sent)
 *   --prompt <text>    what moves; the default asks for a still body with only parts moving
 *   --negative <text>  what to avoid (default: the template's list minus its "static" terms)
 *   --seconds <n>      clip length, 1..10 (default 5; 24 fps, frames = 4n+1)
 *   --seed <n>         integer; same seed + same inputs = same clip (default: random)
 *   --steps / --cfg    sampler settings (defaults 20 / 5, the template's)
 *   --server <url>     ComfyUI (default http://127.0.0.1:8188); started here if not running,
 *                      from $COMFYUI_DIR or C:\Users\smite\ComfyUI_windows_portable
 *   --keep-server      leave a server this script started running
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { ensureServer, follow, output, queue, stopServer, upload } from './lib/comfy.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = path.join(ROOT, 'art', 'out', 'video');
const GRAPH = path.join(ROOT, 'tools', 'workflows', 'wan22-5b-i2v.json');
const WIDTH = 1280;
const HEIGHT = 704;
const FPS = 24;

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
    'usage: gen-video-local --image <png> --out <name> [--prompt ..] [--seconds 5] [--seed n]',
  );
  process.exit(1);
}
const seconds = Math.min(10, Math.max(1, Number(opt('seconds') ?? 5)));
const length = Math.round((seconds * FPS - 1) / 4) * 4 + 1; // Wan wants 4n+1 frames
const seed = Number(opt('seed') ?? Math.floor(Math.random() * 2 ** 31));
const steps = Number(opt('steps') ?? 20);
const cfg = Number(opt('cfg') ?? 5);
const server = (opt('server') ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const prompt =
  opt('prompt') ??
  'The creature holds completely still, its body, legs, head and tail frozen in place, while only the bundle of fleshy tentacles hanging from its mouth slowly writhes, curls and sways. Locked-off camera, no camera movement, no zoom. The flat bright green background stays perfectly flat and unchanged.';
const negative =
  opt('negative') ??
  'bright colors, overexposed, blurry, low quality, JPEG artifacts, ugly, deformed, extra limbs, extra fingers, fused fingers, malformed, cluttered background, walking backwards, camera movement, zoom, text, watermark';

const child = await ensureServer(server, path.join(OUT_DIR, 'comfyui.log'));
try {
  // The still, fitted to Wan's 720p canvas (1280x704) on the image's own corner colour.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const src = sharp(path.resolve(ROOT, image));
  const meta = await src.metadata();
  const { data } = await src.clone().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] };
  const still = await src
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: bg, kernel: 'lanczos3' })
    .flatten({ background: bg })
    .png()
    .toBuffer();
  const stillPath = path.join(OUT_DIR, `${outName}-still.png`);
  fs.writeFileSync(stillPath, still);
  console.log(
    `still: ${meta.width}x${meta.height} -> ${WIDTH}x${HEIGHT} (${path.relative(ROOT, stillPath)})`,
  );

  const graph = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));
  delete graph['$comment'];
  graph['56'].inputs.image = await upload(server, still, `${outName}-still.png`);
  graph['6'].inputs.text = prompt;
  graph['7'].inputs.text = negative;
  graph['55'].inputs.width = WIDTH;
  graph['55'].inputs.height = HEIGHT;
  graph['55'].inputs.length = length;
  graph['3'].inputs.seed = seed;
  graph['3'].inputs.steps = steps;
  graph['3'].inputs.cfg = cfg;
  graph['58'].inputs.filename_prefix = `video/${outName}`;
  const clientId = crypto.randomUUID();

  // The SaveVideo node's format inputs are a nested combo; if a build names them differently,
  // fall back to the plain SaveWEBM node (ffmpeg reads either).
  let promptId;
  try {
    promptId = await queue(server, graph, clientId);
  } catch (err) {
    if (!err.nodeErrors?.['58']) throw err;
    console.log('SaveVideo refused its inputs; using SaveWEBM instead');
    delete graph['57'];
    graph['58'] = {
      class_type: 'SaveWEBM',
      inputs: {
        images: ['8', 0],
        filename_prefix: `video/${outName}`,
        codec: 'vp9',
        fps: FPS,
        crf: 24,
      },
    };
    promptId = await queue(server, graph, clientId);
  }
  console.log(
    `queued ${promptId}: ${length} frames @ ${FPS} fps (${seconds}s), seed ${seed}, ${steps} steps, cfg ${cfg}`,
  );
  const secs = await follow(server, clientId, promptId);
  const { bytes, filename } = await output(server, promptId, /\.(mp4|webm|webp)$/i);
  const outPath = path.join(OUT_DIR, `${outName}${path.extname(filename)}`);
  fs.writeFileSync(outPath, bytes);
  console.log(
    `saved ${path.relative(ROOT, outPath)} (${(bytes.length / 1024).toFixed(0)} KB) in ${secs}s`,
  );
} finally {
  stopServer(child, flag('keep-server'));
}

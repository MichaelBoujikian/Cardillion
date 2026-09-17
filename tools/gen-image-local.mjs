#!/usr/bin/env node
/**
 * Cardillion local image generator - stills and edits on the owner's own GPU through ComfyUI,
 * no API, no credits, no content policy. See docs/local-image.md.
 *
 *   npm run image:local -- --out rat-gory --edit assets/art/enemy-rat-mutant.png \
 *     --prompt "keep this exact rat; tear the skin open across its flank showing wet red muscle"
 *   npm run image:local -- --out rat-fresh --prompt "a gaunt mutant rat, ..." [--model zimage|klein]
 *
 *   --out <name>       writes art/out/local/<name>.png
 *   --prompt <text>    what to make, or what to change
 *   --edit <png>       edit this image (FLUX.2 klein 4B): keep the picture, change what the
 *                      prompt says; the output is the input's size (multiples of 16)
 *   --model <id>       for text-to-image: zimage (default; painterly, takes a negative prompt)
 *                      or klein (fast, 4 steps)
 *   --negative <text>  Z-Image only (default: a generic list)
 *   --size WxH         text-to-image size (default 1024x1024; 1536x1024 for sheets)
 *   --seed <n>         integer; same seed + same inputs = same picture (default: random)
 *   --steps / --cfg    override the graph's sampler settings
 *   --server <url>     ComfyUI (default http://127.0.0.1:8188); started here if not running
 *   --keep-server      leave a server this script started running
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { ensureServer, follow, output, queue, stopServer, upload } from './lib/comfy.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = path.join(ROOT, 'art', 'out', 'local');
const GRAPHS = {
  klein: path.join(ROOT, 'tools', 'workflows', 'flux2-klein-4b.json'),
  zimage: path.join(ROOT, 'tools', 'workflows', 'z-image.json'),
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outName = opt('out');
const prompt = opt('prompt');
const edit = opt('edit');
if (!outName || !prompt) {
  console.error(
    'usage: gen-image-local --out <name> --prompt <text> [--edit <png>] [--model zimage|klein] [--size WxH] [--seed n]',
  );
  process.exit(1);
}
const model = edit ? 'klein' : (opt('model') ?? 'zimage');
if (!GRAPHS[model]) throw new Error(`unknown model ${model}`);
const seed = Number(opt('seed') ?? Math.floor(Math.random() * 2 ** 31));
const server = (opt('server') ?? 'http://127.0.0.1:8188').replace(/\/$/, '');
const negative =
  opt('negative') ??
  'blurry, low quality, JPEG artifacts, text, watermark, signature, logo, extra limbs, deformed, cropped, frame, border';
const round16 = (n) => Math.max(16, Math.round(n / 16) * 16);

const child = await ensureServer(server, path.join(ROOT, 'art', 'out', 'video', 'comfyui.log'));
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const graph = JSON.parse(fs.readFileSync(GRAPHS[model], 'utf8'));
  delete graph['$comment'];
  let width;
  let height;
  if (edit) {
    // The edit keeps the input's size; the reference must be opaque, so transparency becomes
    // the same flat green the chroma pipeline keys out afterwards.
    const src = sharp(path.resolve(ROOT, edit));
    const meta = await src.metadata();
    width = round16(meta.width);
    height = round16(meta.height);
    const png = await src
      .resize(width, height, { fit: 'fill' })
      .flatten({ background: { r: 0, g: 255, b: 0 } })
      .png()
      .toBuffer();
    graph['4'].inputs.image = await upload(server, png, `${outName}-input.png`);
    graph['9'].inputs.text = prompt;
    console.log(`edit ${path.relative(ROOT, edit)} (${meta.width}x${meta.height}) with klein 4B`);
  } else {
    const [w, h] = (opt('size') ?? '1024x1024').split('x').map(Number);
    width = round16(w);
    height = round16(h);
    if (model === 'klein') {
      // Text-to-image: no reference image; the prompts feed the guider directly.
      for (const id of ['4', '8', '11', '12']) delete graph[id];
      graph['15'].inputs.positive = ['9', 0];
      graph['15'].inputs.negative = ['10', 0];
      graph['9'].inputs.text = prompt;
    } else {
      graph['5'].inputs.text = prompt;
      graph['6'].inputs.text = negative;
    }
    console.log(`text-to-image with ${model} at ${width}x${height}`);
  }
  if (model === 'klein') {
    graph['7'].inputs.width = width;
    graph['7'].inputs.height = height;
    graph['14'].inputs.width = width;
    graph['14'].inputs.height = height;
    graph['16'].inputs.noise_seed = seed;
    if (opt('steps')) graph['14'].inputs.steps = Number(opt('steps'));
    if (opt('cfg')) graph['15'].inputs.cfg = Number(opt('cfg'));
    graph['19'].inputs.filename_prefix = `local/${outName}`;
  } else {
    graph['7'].inputs.width = width;
    graph['7'].inputs.height = height;
    graph['8'].inputs.seed = seed;
    if (opt('steps')) graph['8'].inputs.steps = Number(opt('steps'));
    if (opt('cfg')) graph['8'].inputs.cfg = Number(opt('cfg'));
    graph['10'].inputs.filename_prefix = `local/${outName}`;
  }

  const clientId = crypto.randomUUID();
  const promptId = await queue(server, graph, clientId);
  console.log(`queued ${promptId}: seed ${seed}`);
  const secs = await follow(server, clientId, promptId);
  const { bytes } = await output(server, promptId, /\.png$/i);
  const outPath = path.join(OUT_DIR, `${outName}.png`);
  fs.writeFileSync(outPath, bytes);
  console.log(
    `saved ${path.relative(ROOT, outPath)} (${(bytes.length / 1024).toFixed(0)} KB) in ${secs}s`,
  );
} finally {
  stopServer(child, flag('keep-server'));
}

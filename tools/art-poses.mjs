#!/usr/bin/env node
/**
 * Cardillion pose slicer - cuts a keyed pose sheet (one image, several figures of the same
 * creature) into one frame per figure, all on one shared canvas at one scale, so the creature
 * keeps its size from frame to frame in the game. See docs/art-pipeline.md, "Pose sheets".
 *
 *   npm run art:poses -- --sheet enemy-rat-mutant-poses --names rest,windup,attack,hit
 *   npm run art:poses -- --sheet enemy-rat-mutant-idle --names idle1,idle2,idle3,idle4 \
 *                        --like enemy-rat-mutant-rest --tone enemy-rat
 *
 *   --sheet <id>     assets/art/<id>.png, the keyed sheet (figures on transparency)
 *   --names a,b,c    one name per figure in reading order (rows top to bottom, left to right);
 *                    frames are written to assets/art/<out>-<name>.png
 *   --out <prefix>   output id prefix (default: the sheet id without a trailing "-poses")
 *   --like <id>      an existing frame to match: its canvas size, and the FIRST figure is scaled
 *                    to that frame's figure height (so a second sheet lands at the same scale).
 *                    Without it the sheet's own pixels are kept and the canvas height is set so
 *                    the first figure fills FILL of it, like the v1 enemies.
 *   --tone <id>      match the frames' mean brightness and saturation to this asset's figure
 *                    (the 2.5 models paint brighter and more colourful than the v1 thicket art)
 *
 * Figures are found as connected blobs of alpha; specks (blood, whisker tips) are folded into
 * the nearest figure. Every frame is bottom-aligned (feet on the canvas edge, so the sprite
 * stands on its shadow) and centred.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ART = path.join(ROOT, 'assets', 'art');
/** How much of the canvas height the first (rest) figure fills when there is no --like. */
const FILL = 0.83;
const PAD_X = 16;
const PAD_TOP = 16;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const sheetId = opt('sheet');
const names = opt('names')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!sheetId || !names?.length) {
  console.error(
    'usage: art-poses --sheet <id> --names a,b,c [--out prefix] [--like id] [--tone id]',
  );
  process.exit(1);
}
const outPrefix = opt('out') ?? sheetId.replace(/-poses$/, '');
const likeId = opt('like');
const toneId = opt('tone');

async function readRaw(id) {
  const file = path.join(ART, `${id}.png`);
  if (!fs.existsSync(file)) throw new Error(`${id}: no ${path.relative(ROOT, file)}`);
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** The eye-glow test from src/render/battle/textures.ts findGlowPoints: bright warm amber. */
const isAmber = (r, g, b, a) => a > 200 && r > 170 && g > 80 && g < 210 && b < 100 && r - b > 110;

/** Opaque bounding box and mean brightness (max channel) and chroma of the figure pixels. */
function measure({ data, w, h }) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  let v = 0;
  let s = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] <= 200) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      v += max;
      s += max - min; // chroma, which stays meaningful in the near-black
      n++;
    }
  }
  return { box: [x0, y0, x1 + 1, y1 + 1], v: v / n, s: s / n };
}

/** Connected blobs of alpha (4-connected), largest first. */
function blobs({ data, w, h }) {
  const label = new Int32Array(w * h);
  const found = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] || data[start * 4 + 3] <= 8) continue;
    const id = found.length + 1;
    const blob = { id, n: 0, x0: w, y0: h, x1: 0, y1: 0 };
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      blob.n++;
      blob.x0 = Math.min(blob.x0, x);
      blob.y0 = Math.min(blob.y0, y);
      blob.x1 = Math.max(blob.x1, x + 1);
      blob.y1 = Math.max(blob.y1, y + 1);
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || label[q] || data[q * 4 + 3] <= 8) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    found.push(blob);
  }
  found.sort((a, b) => b.n - a.n);
  return { label, found };
}

const sheet = await readRaw(sheetId);
const { label, found } = blobs(sheet);
if (found.length < names.length)
  throw new Error(`${sheetId}: found ${found.length} figures, expected ${names.length}`);
const figures = found.slice(0, names.length);
const centre = (b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
// Fold every speck into the nearest figure (its owner) and grow that figure's box.
const owner = new Int32Array(found.length + 1);
for (const blob of found) {
  let best = figures[0];
  let bestD = Infinity;
  const [cx, cy] = centre(blob);
  for (const f of figures) {
    const [fx, fy] = centre(f);
    const d = (fx - cx) ** 2 + (fy - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  owner[blob.id] = best.id;
  if (best !== blob) {
    best.x0 = Math.min(best.x0, blob.x0);
    best.y0 = Math.min(best.y0, blob.y0);
    best.x1 = Math.max(best.x1, blob.x1);
    best.y1 = Math.max(best.y1, blob.y1);
  }
}
// Reading order: rows by centre y (a row is within a quarter of the sheet), then x.
const rowOf = (f) => Math.round(centre(f)[1] / (sheet.h / 4));
figures.sort((a, b) => rowOf(a) - rowOf(b) || centre(a)[0] - centre(b)[0]);

// Scale and canvas.
let scale = 1;
let W = 0;
let H;
if (likeId) {
  const like = await readRaw(likeId);
  const m = measure(like);
  const first = figures[0];
  scale = (m.box[3] - m.box[1]) / (first.y1 - first.y0);
  W = like.w;
  H = like.h;
} else {
  const first = figures[0];
  H = Math.ceil((first.y1 - first.y0) / FILL);
}
const widest = Math.max(...figures.map((f) => (f.x1 - f.x0) * scale));
const tallest = Math.max(...figures.map((f) => (f.y1 - f.y0) * scale));
if (likeId) {
  // The canvas must be exactly the reference's: the game sizes the sprite from the image, so a
  // different canvas would make the creature jump when the frames cross-fade.
  if (widest > W || tallest > H)
    console.warn(
      `  warning: a figure (${Math.ceil(widest)}x${Math.ceil(tallest)}) overflows the ${W}x${H} canvas of ${likeId} and will be clipped`,
    );
} else {
  W = Math.ceil((widest + 2 * PAD_X) / 16) * 16;
  H = Math.ceil(Math.max(H, tallest + PAD_TOP) / 16) * 16;
}

// Tone: gains that take the sheet's figure pixels to the reference's means.
let brightness = 1;
let saturation = 1;
if (toneId) {
  const ref = measure(await readRaw(toneId));
  const cur = measure(sheet);
  brightness = ref.v / cur.v;
  saturation = ref.s / cur.s;
  // sharp's modulate works in a perceptual space, so a gain lands near the target, not on it;
  // a few correction passes from the measured result close the gap.
  for (let pass = 0; pass < 3; pass++) {
    const trial = await sharp(sheet.data, { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
      .modulate({ brightness, saturation })
      .raw()
      .toBuffer();
    const got = measure({ data: trial, w: sheet.w, h: sheet.h });
    brightness *= ref.v / got.v;
    saturation *= ref.s / got.s;
  }
  console.log(
    `tone: match ${toneId} (V ${ref.v.toFixed(3)} S ${ref.s.toFixed(3)}) from V ${cur.v.toFixed(3)} S ${cur.s.toFixed(3)} -> brightness x${brightness.toFixed(2)}, saturation x${saturation.toFixed(2)}`,
  );
}
console.log(`${sheetId}: ${figures.length} figures, scale x${scale.toFixed(3)}, canvas ${W}x${H}`);

for (const [i, f] of figures.entries()) {
  const name = names[i];
  const fw = f.x1 - f.x0;
  const fh = f.y1 - f.y0;
  // Cut the figure out with only its own pixels (a neighbour's tail can share the box).
  const cut = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const src = ((f.y0 + y) * sheet.w + (f.x0 + x)) * 4;
      const dst = (y * fw + x) * 4;
      const mine = owner[label[(f.y0 + y) * sheet.w + (f.x0 + x)]] === f.id;
      cut[dst] = sheet.data[src];
      cut[dst + 1] = sheet.data[src + 1];
      cut[dst + 2] = sheet.data[src + 2];
      cut[dst + 3] = mine ? sheet.data[src + 3] : 0;
    }
  }
  let raw = cut;
  if (brightness !== 1 || saturation !== 1) {
    raw = await sharp(cut, { raw: { width: fw, height: fh, channels: 4 } })
      .modulate({ brightness, saturation })
      .raw()
      .toBuffer();
    // The amber eyes stay as painted (plus a 2 px rim, so the anti-aliased edge keeps its
    // warmth): they are the one bright thing on a thicket creature, and the renderer's
    // eye-glow finder looks for exactly that colour (textures.ts).
    // Only the eye-sized amber blobs count: a fleck of orange flesh is amber too, but small.
    const amber = Buffer.alloc(fw * fh * 4);
    for (let i = 0; i < cut.length; i += 4)
      amber[i + 3] = isAmber(cut[i], cut[i + 1], cut[i + 2], cut[i + 3]) ? 255 : 0;
    const { label: eyeLabel, found: eyeBlobs } = blobs({ data: amber, w: fw, h: fh });
    const eyeMin = (eyeBlobs[0]?.n ?? 0) * 0.5;
    const eyeIds = new Set(eyeBlobs.filter((b) => b.n >= eyeMin).map((b) => b.id));
    const keep = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        if (!eyeIds.has(eyeLabel[y * fw + x])) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < fh && xx >= 0 && xx < fw) keep[yy * fw + xx] = 1;
          }
      }
    for (let p = 0; p < fw * fh; p++) {
      if (!keep[p]) continue;
      raw[p * 4] = cut[p * 4];
      raw[p * 4 + 1] = cut[p * 4 + 1];
      raw[p * 4 + 2] = cut[p * 4 + 2];
    }
  }
  let figure = sharp(raw, { raw: { width: fw, height: fh, channels: 4 } });
  const sw = Math.max(1, Math.round(fw * scale));
  const sh = Math.max(1, Math.round(fh * scale));
  if (scale !== 1) figure = figure.resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' });
  const png = await figure.png().toBuffer();
  const out = path.join(ART, `${outPrefix}-${name}.png`);
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: png, left: Math.round((W - sw) / 2), top: H - sh }])
    .png()
    .toFile(out);
  console.log(
    `  ${name}: sheet ${f.x0},${f.y0}-${f.x1},${f.y1} -> ${path.relative(ROOT, out)} (${sw}x${sh})`,
  );
}

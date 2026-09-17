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
 *   --tone <id>      match the frames' mean brightness and chroma to this asset's figure
 *                    (the 2.5 models paint brighter and more colourful than the v1 thicket art)
 *
 * Figures are found as connected blobs of alpha; specks (blood, whisker tips) are folded into
 * the nearest figure. Every frame is bottom-aligned (feet on the canvas edge, so the sprite
 * stands on its shadow) and centred.
 */
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import {
  ART,
  ROOT,
  applyTone,
  blobs,
  measure,
  readRaw,
  toneGains,
  writeFrame,
} from './lib/frames.mjs';

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
let gains = { brightness: 1, saturation: 1 };
if (toneId) {
  gains = await toneGains(sheet, await readRaw(toneId));
  console.log(
    `tone: match ${toneId} (V ${gains.want.v.toFixed(3)} S ${gains.want.s.toFixed(3)}) from V ${gains.have.v.toFixed(3)} S ${gains.have.s.toFixed(3)} -> brightness x${gains.brightness.toFixed(2)}, saturation x${gains.saturation.toFixed(2)}`,
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
  const toned = await applyTone(cut, fw, fh, gains);
  const sw = Math.max(1, Math.round(fw * scale));
  const sh = Math.max(1, Math.round(fh * scale));
  let raw = toned;
  if (scale !== 1)
    raw = await sharp(toned, { raw: { width: fw, height: fh, channels: 4 } })
      .resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer();
  const out = path.join(ART, `${outPrefix}-${name}.png`);
  await writeFrame(raw, sw, sh, W, H, Math.round((W - sw) / 2), H - sh, out);
  console.log(
    `  ${name}: sheet ${f.x0},${f.y0}-${f.x1},${f.y1} -> ${path.relative(ROOT, out)} (${sw}x${sh})`,
  );
}

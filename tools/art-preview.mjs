#!/usr/bin/env node
/**
 * Composite generated art onto a checkerboard so cut-outs can be judged from a PNG.
 * (Most image viewers - and the agent's image reader - flatten alpha and show whatever
 * colour sits under the mask, which hides halos and holes.)
 *
 *   npm run art:preview                        # every PNG in assets/art -> art/out/preview-<id>.png
 *   npm run art:preview -- --only rat,possum   # just these ids
 *   npm run art:preview -- --sheet             # also write one contact sheet, art/out/contact-sheet.png
 *
 * No API calls, no dependencies beyond pngjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ART_DIR = path.join(ROOT, 'assets', 'art');
const OUT_DIR = path.join(ROOT, 'art', 'out');

const args = process.argv.slice(2);
const only = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1].split(',').map((s) => s.trim()) : null;
})();
const sheet = args.includes('--sheet');
const CELL = 384; // preview size per image
const CHECK = 24; // checker square size

function checker(png, x0, y0, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dark = (Math.floor(x / CHECK) + Math.floor(y / CHECK)) % 2 === 0;
      const i = ((y0 + y) * png.width + (x0 + x)) * 4;
      png.data[i] = dark ? 255 : 63;
      png.data[i + 1] = dark ? 0 : 217;
      png.data[i + 2] = dark ? 255 : 255;
      png.data[i + 3] = 255;
    }
  }
}

/** Box-filter downscale of an RGBA image into a size x size square, letterboxed, alpha-blended. */
function blit(dst, src, x0, y0, size) {
  const k = Math.max(src.width, src.height) / size;
  const dw = Math.round(src.width / k);
  const dh = Math.round(src.height / k);
  const ox = x0 + Math.floor((size - dw) / 2);
  const oy = y0 + Math.floor((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      // Average the source box for this destination pixel.
      const sx0 = Math.floor(x * k);
      const sy0 = Math.floor(y * k);
      const sx1 = Math.min(src.width, Math.ceil((x + 1) * k));
      const sy1 = Math.min(src.height, Math.ceil((y + 1) * k));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * src.width + sx) * 4;
          const sa = src.data[i + 3];
          r += src.data[i] * sa;
          g += src.data[i + 1] * sa;
          b += src.data[i + 2] * sa;
          a += sa;
          n++;
        }
      }
      if (n === 0 || a === 0) continue;
      const alpha = a / n / 255; // coverage
      r /= a;
      g /= a;
      b /= a;
      const di = ((oy + y) * dst.width + (ox + x)) * 4;
      dst.data[di] = Math.round(r * alpha + dst.data[di] * (1 - alpha));
      dst.data[di + 1] = Math.round(g * alpha + dst.data[di + 1] * (1 - alpha));
      dst.data[di + 2] = Math.round(b * alpha + dst.data[di + 2] * (1 - alpha));
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const files = fs
  .readdirSync(ART_DIR)
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.replace(/\.png$/, ''))
  .filter((id) => !only || only.includes(id))
  .sort();
if (files.length === 0) {
  console.error('No matching PNGs in assets/art.');
  process.exit(1);
}

const loaded = files.map((id) => ({
  id,
  png: PNG.sync.read(fs.readFileSync(path.join(ART_DIR, `${id}.png`))),
}));
for (const { id, png } of loaded) {
  const out = new PNG({ width: CELL, height: CELL });
  checker(out, 0, 0, CELL, CELL);
  blit(out, png, 0, 0, CELL);
  const file = path.join(OUT_DIR, `preview-${id}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  // Alpha readout. "haze" (alpha 16-127) means a screen that was only half keyed: it hides on a
  // checkerboard and shows as a tinted square in the game, so it is called out loudly.
  let clear = 0;
  let haze = 0;
  let edge = 0;
  for (let i = 3; i < png.data.length; i += 4) {
    const a = png.data[i];
    if (a < 16) clear++;
    else if (a < 128) haze++;
    else if (a < 255) edge++;
  }
  const n = png.data.length / 4;
  const pct = (v) => `${Math.round((100 * v) / n)}%`;
  const warn =
    haze / n > 0.03 ? '  <-- HAZE: background not fully keyed, re-key or regenerate' : '';
  console.log(
    `${id}: ${png.width}x${png.height}, clear ${pct(clear)}, haze ${pct(haze)}, edge ${pct(edge)} -> ${path.relative(ROOT, file)}${warn}`,
  );
}

if (sheet) {
  const cols = Math.min(4, loaded.length);
  const rows = Math.ceil(loaded.length / cols);
  const out = new PNG({ width: cols * CELL, height: rows * CELL });
  checker(out, 0, 0, out.width, out.height);
  loaded.forEach(({ png }, i) =>
    blit(out, png, (i % cols) * CELL, Math.floor(i / cols) * CELL, CELL),
  );
  const file = path.join(OUT_DIR, 'contact-sheet.png');
  fs.writeFileSync(file, PNG.sync.write(out));
  fs.writeFileSync(
    path.join(OUT_DIR, 'contact-sheet.txt'),
    loaded
      .map(
        ({ id }, i) => `${i + 1}. (row ${Math.floor(i / cols) + 1}, col ${(i % cols) + 1}) ${id}`,
      )
      .join('\n') + '\n',
  );
  console.log(`contact sheet: ${path.relative(ROOT, file)} (order in contact-sheet.txt)`);
}

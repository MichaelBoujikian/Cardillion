/**
 * Frame helpers shared by the pose slicer (art-poses) and the video cutter (art-video): reading
 * assets as raw RGBA, measuring a figure, finding figures as blobs of alpha, and the tone match
 * that takes the bright, colourful renders of the 2.5 image models (and video) down to the v1
 * thicket look while leaving the amber eyes as painted for the renderer's eye-glow finder.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const ROOT = path.resolve(
  new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
);
export const ART = path.join(ROOT, 'assets', 'art');

/** The eye-glow test from src/render/battle/textures.ts findGlowPoints: bright warm amber. */
export const isAmber = (r, g, b, a) =>
  a > 200 && r > 170 && g > 80 && g < 210 && b < 100 && r - b > 110;

/** An asset as raw RGBA: `{ data, w, h }`. */
export async function readRaw(id) {
  const file = path.join(ART, `${id}.png`);
  if (!fs.existsSync(file)) throw new Error(`${id}: no ${path.relative(ROOT, file)}`);
  return readRawFile(file);
}

export async function readRawFile(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Opaque bounding box and mean brightness (max channel) and chroma of the figure pixels. */
export function measure({ data, w, h }) {
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
  return { box: [x0, y0, x1 + 1, y1 + 1], v: v / n, s: s / n, n };
}

/** Connected blobs of alpha (4-connected), largest first, with a label map. */
export function blobs({ data, w, h }, threshold = 8) {
  const label = new Int32Array(w * h);
  const found = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] || data[start * 4 + 3] <= threshold) continue;
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
        if (q < 0 || q >= w * h || label[q] || data[q * 4 + 3] <= threshold) continue;
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

/**
 * Brightness and saturation gains that take `cur`'s figure pixels to `ref`'s means. sharp's
 * modulate works in a perceptual space, so a gain lands near the target, not on it; a few
 * correction passes from the measured result close the gap.
 */
export async function toneGains(cur, ref) {
  const want = measure(ref);
  const have = measure(cur);
  let brightness = want.v / have.v;
  let saturation = want.s / have.s;
  for (let pass = 0; pass < 3; pass++) {
    const trial = await sharp(cur.data, { raw: { width: cur.w, height: cur.h, channels: 4 } })
      .modulate({ brightness, saturation })
      .raw()
      .toBuffer();
    const got = measure({ data: trial, w: cur.w, h: cur.h });
    brightness *= want.v / got.v;
    saturation *= want.s / got.s;
  }
  return { brightness, saturation, want, have };
}

/**
 * Apply tone gains to a raw RGBA figure, leaving the amber eyes as painted (plus a 2 px rim so
 * the anti-aliased edge keeps its warmth): they are the one bright thing on a thicket creature,
 * and the renderer's eye-glow finder looks for exactly that colour. Only eye-sized amber blobs
 * count — a fleck of orange flesh is amber too, but small.
 */
/** Mean R, G, B of the figure (opaque, not amber) - what a colour cast moves. */
export function meanColour({ data, w, h }) {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (data[i + 3] <= 200 || isAmber(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
    n++;
  }
  return n ? sum.map((v) => v / n) : [1, 1, 1];
}

/**
 * Hold a frame's colour: scale each channel so the figure's mean R, G, B match the reference
 * frame's (a video model drifting the fur magenta or green over a clip), the amber eyes left as
 * painted. Returns a new buffer.
 */
export function holdColour(cut, w, h, ref) {
  const cur = meanColour({ data: cut, w, h });
  const gain = ref.map((v, i) => Math.min(2, Math.max(0.5, v / Math.max(1, cur[i]))));
  if (gain.every((g) => Math.abs(g - 1) < 0.01)) return cut;
  const out = Buffer.from(cut);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] <= 200 || isAmber(out[i], out[i + 1], out[i + 2], out[i + 3])) continue;
    out[i] = Math.min(255, Math.round(out[i] * gain[0]));
    out[i + 1] = Math.min(255, Math.round(out[i + 1] * gain[1]));
    out[i + 2] = Math.min(255, Math.round(out[i + 2] * gain[2]));
  }
  return out;
}

export async function applyTone(cut, w, h, { brightness, saturation }) {
  if (brightness === 1 && saturation === 1) return cut;
  const raw = await sharp(cut, { raw: { width: w, height: h, channels: 4 } })
    .modulate({ brightness, saturation })
    .raw()
    .toBuffer();
  const amber = Buffer.alloc(w * h * 4);
  for (let i = 0; i < cut.length; i += 4)
    amber[i + 3] = isAmber(cut[i], cut[i + 1], cut[i + 2], cut[i + 3]) ? 255 : 0;
  const { label, found } = blobs({ data: amber, w, h });
  const eyeMin = (found[0]?.n ?? 0) * 0.5;
  const eyeIds = new Set(found.filter((b) => b.n >= eyeMin).map((b) => b.id));
  const keep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!eyeIds.has(label[y * w + x])) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) keep[yy * w + xx] = 1;
        }
    }
  for (let p = 0; p < w * h; p++) {
    if (!keep[p]) continue;
    raw[p * 4] = cut[p * 4];
    raw[p * 4 + 1] = cut[p * 4 + 1];
    raw[p * 4 + 2] = cut[p * 4 + 2];
  }
  return raw;
}

/** Write a raw RGBA figure onto a transparent canvas as a PNG, at the given top-left. */
export async function writeFrame(raw, w, h, canvasW, canvasH, left, top, file) {
  // Whatever falls outside the canvas is clipped (a placed crop may overhang an edge).
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const vw = Math.min(w - x0, canvasW - Math.max(0, left));
  const vh = Math.min(h - y0, canvasH - Math.max(0, top));
  if (vw <= 0 || vh <= 0) throw new Error(`${file}: the frame lies entirely off the canvas`);
  let img = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
  if (x0 || y0 || vw !== w || vh !== h)
    img = img.extract({ left: x0, top: y0, width: vw, height: vh });
  const png = await img.png().toBuffer();
  left = Math.max(0, left);
  top = Math.max(0, top);
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: png, left, top }])
    .png()
    .toFile(file);
}

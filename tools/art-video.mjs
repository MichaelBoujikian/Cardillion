#!/usr/bin/env node
/**
 * Cardillion video cutter - turns a green-screen clip of a creature into sprite frames the
 * game plays as a loop (the creature at rest, breathing, tentacles slithering) and a fidget
 * (a short movement it makes now and then). See docs/art-pipeline.md, "Video frames".
 *
 *   npm run art:video -- --video art/out/video/sora-rat-attack.mp4 --out enemy-rat-mutant \
 *     --loop 4.25:8.08 --fidget 2.83:4.17 --fps 12 --like enemy-rat-mutant-rest --tone enemy-rat
 *
 *   --video <file>     the clip; it must be on a flat chroma screen (the first frame decides)
 *   --out <prefix>     frames are written to assets/art/<out>-loop-NN.png and <out>-fidget-NN.png
 *   --loop t0:t1       the still stretch to play back and forth, in seconds
 *   --fidget t0:t1     a movement to play once now and then; it should end where the loop starts
 *   --fidget-video <f> take the fidget from this clip instead (its own t0:t1)
 *   --fidget-pingpong  play the fidget forward then backward, so it ends a frame from where it began
 *   --fps <n>          frames per second to keep (default 12)
 *   --key <name>       green | blue | magenta (default green)
 *   --like <id>        an existing frame: its canvas, and the first loop frame is scaled to its
 *                      figure height and stood on its figure's bottom-centre, so the clip lands
 *                      at the same size and place as the pose frames (and as a fidget cut in
 *                      another run from the same --like)
 *   --eyes <n>         glowing eyes to relight, 1 (default, a side profile) or 2 (front-facing)
 *   --tone <id>        match brightness and chroma to this asset (see art-poses)
 *   --ffmpeg <exe>     ffmpeg to use (default: $FFMPEG, then art/out/bin/ffmpeg.exe, then PATH)
 *
 * Every frame gets the same crop (the union of the figure across all frames) and the same
 * placement, so the creature does not drift between frames; only the clip's own motion remains.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { KEYS, chromaKey } from './lib/chroma.mjs';
import {
  ART,
  ROOT,
  applyTone,
  blobs,
  measure,
  readRaw,
  readRawFile,
  toneGains,
  writeFrame,
} from './lib/frames.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);
const video = opt('video');
const outPrefix = opt('out');
const fps = Number(opt('fps') ?? 12);
const range = (name) => {
  const v = opt(name);
  if (!v) return null;
  const [a, b] = v.split(':').map(Number);
  if (!(a >= 0) || !(b > a)) throw new Error(`--${name} wants t0:t1 in seconds`);
  return [a, b];
};
const loopRange = range('loop');
const fidgetRange = range('fidget');
if (!video || !outPrefix || !loopRange) {
  console.error(
    'usage: art-video --video <file> --out <prefix> --loop t0:t1 [--fidget t0:t1] [--fidget-video f] [--fps n] [--key name] [--like id] [--tone id] [--ffmpeg exe]',
  );
  process.exit(1);
}
const key = KEYS[opt('key') ?? 'green'];
if (!key) throw new Error(`unknown chroma key "${opt('key')}"`);
const likeId = opt('like');
const nEyes = Number(opt('eyes') ?? 1);
if (![1, 2].includes(nEyes)) throw new Error('--eyes must be 1 or 2');
const toneId = opt('tone');
const PAD = 8;
/** Blobs smaller than this are compression noise on the screen, not the creature. */
const MIN_BLOB = 60;

const ffmpeg = (() => {
  const local = path.join(ROOT, 'art', 'out', 'bin', 'ffmpeg.exe');
  return opt('ffmpeg') ?? process.env['FFMPEG'] ?? (fs.existsSync(local) ? local : 'ffmpeg');
})();

// 1. Extract every frame at the chosen rate; frame N (1-based) is at (N - 1) / fps seconds.
// The fidget may come from a second clip (--fidget-video), e.g. a clip of just the movement.
function extract(file, tag) {
  const videoPath = path.resolve(ROOT, file);
  const frameDir = path.join(path.dirname(videoPath), `${outPrefix}-${tag}-frames`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  execFileSync(ffmpeg, [
    '-v',
    'error',
    '-i',
    videoPath,
    '-vf',
    `fps=${fps}`,
    path.join(frameDir, 'f%04d.png'),
  ]);
  const files = fs
    .readdirSync(frameDir)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => path.join(frameDir, f));
  console.log(`${path.relative(ROOT, videoPath)}: ${files.length} frames at ${fps} fps`);
  const pick = ([t0, t1]) => {
    const a = Math.round(t0 * fps);
    const b = Math.min(files.length - 1, Math.round(t1 * fps));
    return files.slice(a, b + 1);
  };
  return pick;
}
const pickLoop = extract(video, 'loop');
const pickFidget = fidgetRange
  ? opt('fidget-video')
    ? extract(opt('fidget-video'), 'fidget')
    : pickLoop
  : null;
const segments = [{ name: 'loop', files: pickLoop(loopRange) }];
if (fidgetRange && pickFidget) {
  let files = pickFidget(fidgetRange);
  // Forward then back (the ends not repeated), so the movement ends a frame from where it began
  // and the loop's first frame follows (a dip becomes a bob).
  if (flag('fidget-pingpong')) files = [...files, ...files.slice(1, -1).reverse()];
  segments.push({ name: 'fidget', files });
}

// 2. Key every frame and find the figure's box in each; the crop is the union of them all.
const keyed = new Map();
let union = null;
let first = null;
for (const seg of segments) {
  for (const f of seg.files) {
    const raw = await readRawFile(f);
    const png = chromaKey({ width: raw.w, height: raw.h, data: raw.data }, key);
    const { found } = blobs({ data: png.data, w: raw.w, h: raw.h });
    const parts = found.filter((b) => b.n >= MIN_BLOB);
    if (!parts.length) throw new Error(`${f}: nothing left after the key`);
    const box = parts.reduce(
      (u, b) => [
        Math.min(u[0], b.x0),
        Math.min(u[1], b.y0),
        Math.max(u[2], b.x1),
        Math.max(u[3], b.y1),
      ],
      [raw.w, raw.h, 0, 0],
    );
    keyed.set(f, { data: png.data, w: raw.w, h: raw.h, box, figureH: found[0].y1 - found[0].y0 });
    union = union
      ? [
          Math.min(union[0], box[0]),
          Math.min(union[1], box[1]),
          Math.max(union[2], box[2]),
          Math.max(union[3], box[3]),
        ]
      : box;
    first ??= keyed.get(f);
  }
}
const crop = [
  Math.max(0, union[0] - PAD),
  Math.max(0, union[1] - PAD),
  Math.min(first.w, union[2] + PAD),
  Math.min(first.h, union[3] + PAD),
];
const cw = crop[2] - crop[0];
const ch = crop[3] - crop[1];

// 3. Scale and canvas from the reference frame, like art-poses --like.
let scale = 1;
let W = Math.ceil(cw / 16) * 16;
let H = Math.ceil(ch / 16) * 16;
let likeBox = null;
if (likeId) {
  const like = await readRaw(likeId);
  const m = measure(like);
  scale = (m.box[3] - m.box[1]) / first.figureH;
  W = like.w;
  H = like.h;
  likeBox = m.box;
  if (cw * scale > W || ch * scale > H)
    console.warn(
      `  warning: the crop (${Math.ceil(cw * scale)}x${Math.ceil(ch * scale)}) overflows the ${W}x${H} canvas of ${likeId} and will be clipped`,
    );
}
const sw = Math.round(cw * scale);
const sh = Math.round(ch * scale);
// The crop is centred with its bottom on the canvas edge - or, with --like, the first frame's
// figure is stood exactly where the reference figure stands, so every run from the same
// reference (a loop, a fidget cut later from another clip) meets it without a jump.
let left = Math.round((W - sw) / 2);
let top = H - sh;
if (likeBox) {
  const cx = ((first.box[0] + first.box[2]) / 2 - crop[0]) * scale;
  const bottom = (first.box[3] - crop[1]) * scale;
  left = Math.round((likeBox[0] + likeBox[2]) / 2 - cx);
  top = Math.round(likeBox[3] - bottom);
  // Warn only when creature pixels leave the canvas (the crop's padding always may).
  const fig = [
    left + (union[0] - crop[0]) * scale,
    top + (union[1] - crop[1]) * scale,
    left + (union[2] - crop[0]) * scale,
    top + (union[3] - crop[1]) * scale,
  ].map(Math.round);
  if (fig[0] < 0 || fig[1] < 0 || fig[2] > W || fig[3] > H)
    console.warn(
      `  warning: placed on ${likeId}, the figure spans ${fig[0]},${fig[1]}-${fig[2]},${fig[3]} and leaves the ${W}x${H} canvas; give art:poses --width ${Math.ceil((fig[2] - Math.min(0, fig[0])) / 16) * 16} --height ${Math.ceil((fig[3] - Math.min(0, fig[1])) / 16) * 16} or trim the clip`,
    );
}

// 4. Relight the eye. Video compression dulls the amber glow below what the renderer's eye
// finder (and the tone pass's eye protection) accept, so find it with a looser warm test -
// the largest warm blob, tracked from frame to frame - and push it back to amber.
const isWarm = (r, g, b, a) => a > 200 && r > 120 && g > 60 && b < 120 && r - b > 60 && r - g > 15;
let eyesAt = [];
let faded = 0;
// Each frame once, in the order the segments first use it: a frame shared by two segments (a
// ping-pong's turnaround, a throwaway loop that overlaps the fidget) must not be relit twice,
// since every pass paints a ring of fur amber and the eye grows.
const relitOrder = [...new Set(segments.flatMap((seg) => seg.files))];
{
  for (const f of relitOrder) {
    const k = keyed.get(f);
    const warm = Buffer.alloc(k.w * k.h * 4);
    for (let i = 0; i < k.data.length; i += 4)
      warm[i + 3] = isWarm(k.data[i], k.data[i + 1], k.data[i + 2], k.data[i + 3]) ? 255 : 0;
    const { label, found } = blobs({ data: warm, w: k.w, h: k.h });
    const centre = (b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const dist = (b, at) => Math.hypot(centre(b)[0] - at[0], centre(b)[1] - at[1]);
    const candidates = found.filter((b) => b.n >= 20).sort((p, q) => q.n - p.n);
    // The first frame's largest warm blobs are the eyes. After that each eye keeps its slot:
    // the closest pairs of (eye, candidate) within 80 px are matched first, a candidate serves
    // one eye only, and an eye whose blob is too faint this frame keeps its place for the next
    // frame - so a wound highlight never takes over, and one dull frame never loses an eye.
    let eyes;
    if (eyesAt.length) {
      const pairs = [];
      eyesAt.forEach((at, i) =>
        candidates.forEach((b) => {
          const d = dist(b, at);
          if (d < 80) pairs.push({ i, b, d });
        }),
      );
      pairs.sort((p, q) => p.d - q.d);
      const bySlot = new Array(eyesAt.length).fill(null);
      const taken = new Set();
      for (const { i, b } of pairs) {
        if (bySlot[i] || taken.has(b)) continue;
        bySlot[i] = b;
        taken.add(b);
      }
      eyes = bySlot.filter(Boolean);
      eyesAt = eyesAt.map((at, i) => (bySlot[i] ? centre(bySlot[i]) : at));
    } else {
      eyes = candidates.slice(0, nEyes);
      eyesAt = eyes.map(centre);
    }
    let box;
    let mine;
    if (eyes.length) {
      box = eyes.reduce(
        (u, b) => [
          Math.min(u[0], b.x0),
          Math.min(u[1], b.y0),
          Math.max(u[2], b.x1),
          Math.max(u[3], b.y1),
        ],
        [k.w, k.h, 0, 0],
      );
      const ids = new Set(eyes.map((b) => b.id));
      mine = (x, y) => {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < k.h && xx >= 0 && xx < k.w && ids.has(label[yy * k.w + xx]))
              return true;
          }
        return false;
      };
    } else {
      // The eye faded below the test. Leave it: the game places the glow sprite from the first
      // frame, and painting a guessed box would put amber on fur once the head moves.
      faded++;
      continue;
    }
    for (let y = Math.max(0, box[1] - 2); y < Math.min(k.h, box[3] + 2); y++)
      for (let x = Math.max(0, box[0] - 2); x < Math.min(k.w, box[2] + 2); x++) {
        if (!mine(x, y)) continue;
        const i = (y * k.w + x) * 4;
        if (k.data[i + 3] <= 200) continue;
        // Paint it back toward the amber of a fresh render (the eye fades over a clip).
        k.data[i] = Math.round(k.data[i] + (235 - k.data[i]) * 0.75);
        k.data[i + 1] = Math.round(k.data[i + 1] + (140 - k.data[i + 1]) * 0.75);
        k.data[i + 2] = Math.round(k.data[i + 2] * 0.3);
      }
  }
}
if (faded)
  console.log(`  eye: too faint to relight in ${faded} frames (the game's glow sprite covers it)`);

// 5. Tone from the first loop frame, applied identically to every frame.
const cut = (k) => {
  const buf = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++)
    k.data.copy(
      buf,
      y * cw * 4,
      ((crop[1] + y) * k.w + crop[0]) * 4,
      ((crop[1] + y) * k.w + crop[2]) * 4,
    );
  return buf;
};
let gains = { brightness: 1, saturation: 1 };
if (toneId) {
  gains = await toneGains({ data: cut(first), w: cw, h: ch }, await readRaw(toneId));
  console.log(
    `tone: match ${toneId} (V ${gains.want.v.toFixed(3)} S ${gains.want.s.toFixed(3)}) from V ${gains.have.v.toFixed(3)} S ${gains.have.s.toFixed(3)} -> brightness x${gains.brightness.toFixed(2)}, saturation x${gains.saturation.toFixed(2)}`,
  );
}
console.log(
  `crop ${cw}x${ch} at ${crop[0]},${crop[1]}; scale x${scale.toFixed(3)}; canvas ${W}x${H}`,
);

// 6. Write the frames.
for (const seg of segments) {
  let n = 0;
  for (const f of seg.files) {
    const k = keyed.get(f);
    const toned = await applyTone(cut(k), cw, ch, gains);
    let raw = toned;
    if (scale !== 1)
      raw = await sharp(toned, { raw: { width: cw, height: ch, channels: 4 } })
        .resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' })
        .raw()
        .toBuffer();
    n++;
    const id = `${outPrefix}-${seg.name}-${String(n).padStart(2, '0')}`;
    await writeFrame(raw, sw, sh, W, H, left, top, path.join(ART, `${id}.png`));
  }
  console.log(
    `  ${seg.name}: ${n} frames -> assets/art/${outPrefix}-${seg.name}-01..${String(n).padStart(2, '0')}.png`,
  );
}

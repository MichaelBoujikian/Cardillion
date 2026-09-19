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
 *   --anchor t         instead of a loop: the frame (a rest pose) that sets the scale and, with
 *                      --like, stands on the reference figure - for a run that cuts only
 *                      fidgets or move clips from a second video of the same creature
 *   --fidget [n=]t0:t1 a movement to play once now and then; it should end where the loop starts.
 *                      Repeatable: each one is written as <out>-<n>-NN (a name before '=';
 *                      unnamed ones are fidget, fidget2, fidget3 ...). A move clip (poses.moves,
 *                      played once while that move's body motion runs) is cut the same way
 *   --fidget-video <f> take the fidget from this clip instead (its own t0:t1)
 *   --fidget-pingpong  play the fidget forward then backward, so it ends a frame from where it began
 *   --fidget-reverse   play the section backwards (with --fidget-pingpong: backwards, then forwards) -
 *                      for a clip that starts in the pose and returns to rest, so the fidget goes
 *                      rest -> pose -> rest and --anchor 0 (the pose) still sets the placement
 *   --fps <n>          frames per second to keep (default 12)
 *   --key <name>       green | blue | magenta (default green)
 *   --like <id>        an existing frame: its canvas, and the first loop frame is scaled to its
 *                      figure height and stood on its figure's bottom-centre, so the clip lands
 *                      at the same size and place as the pose frames (and as a fidget cut in
 *                      another run from the same --like)
 *   --eyes <n>         glowing eyes to relight, 1 (default, a side profile) or 2 (front-facing)
 *   --hold-colour      keep every frame's figure at the first frame's mean colour (per-frame
 *                      channel gains): a video model drifting the fur magenta or green
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
  holdColour,
  meanColour,
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
const anchor = opt('anchor') !== undefined ? Number(opt('anchor')) : null;
if (anchor !== null && (!(anchor >= 0) || loopRange))
  throw new Error('--anchor wants a time in seconds, and no --loop');
// Every --fidget, in order: `[name=]t0:t1`.
const fidgetSpecs = args
  .map((a, i) => (a === '--fidget' ? args[i + 1] : null))
  .filter(Boolean)
  .map((v, i) => {
    const [name, span] = v.includes('=') ? v.split('=') : [i ? `fidget${i + 1}` : 'fidget', v];
    const [a, b] = span.split(':').map(Number);
    if (!(a >= 0) || !(b > a) || !/^[a-z][a-z0-9]*$/.test(name))
      throw new Error(`--fidget wants [name=]t0:t1 in seconds, got ${v}`);
    return { name, range: [a, b] };
  });
if (!video || !outPrefix || (!loopRange && anchor === null)) {
  console.error(
    'usage: art-video --video <file> --out <prefix> (--loop t0:t1 | --anchor t) [--fidget [name=]t0:t1 ...] [--fidget-video f] [--fidget-pingpong] [--fidget-reverse] [--fps n] [--key name] [--like id] [--tone id] [--eyes 1|2] [--hold-colour] [--ffmpeg exe]',
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
const pickFidget = fidgetSpecs.length
  ? opt('fidget-video')
    ? extract(opt('fidget-video'), 'fidget')
    : pickLoop
  : null;
// The anchor is a one-frame segment that is measured like a loop's first frame but never written.
const segments = loopRange
  ? [{ name: 'loop', files: pickLoop(loopRange) }]
  : [{ name: null, files: pickLoop([anchor, anchor]) }];
for (const { name, range: r } of fidgetSpecs) {
  let files = pickFidget(r);
  // A clip generated from the pose still (the paw up) and animating the return to rest is
  // played backwards so the fidget starts at rest; ping-pong then brings it back.
  if (flag('fidget-reverse')) files = [...files].reverse();
  // Forward then back (the ends not repeated), so the movement ends a frame from where it began
  // and the loop's first frame follows (a dip becomes a bob).
  if (flag('fidget-pingpong')) files = [...files, ...files.slice(1, -1).reverse()];
  segments.push({ name, files });
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
  if (fig[0] < 0 || fig[1] < 0 || fig[2] > W || fig[3] > H) {
    // The figure is anchored on the reference's centre and bottom, so a side overflow needs
    // twice itself added to the width, and a top overflow needs itself added to the height.
    const needW = Math.ceil((W + 2 * Math.max(0, -fig[0], fig[2] - W)) / 16) * 16;
    const needH = Math.ceil((H + Math.max(0, -fig[1], fig[3] - H)) / 16) * 16;
    console.warn(
      `  warning: placed on ${likeId}, the figure spans ${fig[0]},${fig[1]}-${fig[2]},${fig[3]} and leaves the ${W}x${H} canvas; give art:poses --width ${needW} --height ${needH} (and re-cut everything) or trim the clip`,
    );
  }
}

// 4. Relight the eye. Video compression dulls the amber glow below what the renderer's eye
// finder (and the tone pass's eye protection) accept, so find it with a looser warm test -
// the largest warm blob, tracked from frame to frame - and push it back to amber.
const isWarm = (r, g, b, a) => a > 200 && r > 120 && g > 60 && b < 120 && r - b > 60 && r - g > 15;
let eyesAt = []; // per eye: { at: [x, y], r: radius, missing: frames since it was last found }
let guessed = 0;
let lost = 0;
const MAX_GUESS = 8; // frames an eye may be painted where it was last seen before it is left alone
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
    const radius = (b) => Math.max(3, Math.sqrt(b.n / Math.PI));
    const dist = (b, at) => Math.hypot(centre(b)[0] - at[0], centre(b)[1] - at[1]);
    const candidates = found.filter((b) => b.n >= 20).sort((p, q) => q.n - p.n);
    // The first frame's largest warm blobs are the eyes. After that each eye keeps its slot:
    // the closest pairs of (eye, candidate) within 80 px are matched first, a candidate serves
    // one eye only - so a wound highlight never takes over - and an eye whose blob is too faint
    // this frame is painted where it was last seen (a disc of its last size), for a few frames
    // at most: video compression dulls an eye for a frame or two, and a socket the clip leaves
    // dark for its last frames would otherwise hand the loop a one-eyed face.
    const ids = new Set();
    const discs = [];
    if (eyesAt.length) {
      const pairs = [];
      eyesAt.forEach((e, i) =>
        candidates.forEach((b) => {
          const d = dist(b, e.at);
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
      eyesAt = eyesAt.map((e, i) => {
        const b = bySlot[i];
        if (b) {
          ids.add(b.id);
          return { at: centre(b), r: radius(b), missing: 0 };
        }
        if (e.missing < MAX_GUESS) {
          discs.push(e);
          guessed++;
        } else lost++;
        return { ...e, missing: e.missing + 1 };
      });
    } else {
      const eyes = candidates.slice(0, nEyes);
      for (const b of eyes) ids.add(b.id);
      eyesAt = eyes.map((b) => ({ at: centre(b), r: radius(b), missing: 0 }));
      if (!eyes.length) lost++;
    }
    if (!ids.size && !discs.length) continue;
    const mine = (x, y) => {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < k.h && xx >= 0 && xx < k.w && ids.has(label[yy * k.w + xx]))
            return true;
        }
      // A found blob is painted with a 2 px margin (above); a remembered eye gets the same.
      return discs.some((e) => Math.hypot(x - e.at[0], y - e.at[1]) <= e.r + 2);
    };
    const box = [k.w, k.h, 0, 0];
    for (const b of found)
      if (ids.has(b.id)) {
        box[0] = Math.min(box[0], b.x0);
        box[1] = Math.min(box[1], b.y0);
        box[2] = Math.max(box[2], b.x1);
        box[3] = Math.max(box[3], b.y1);
      }
    for (const e of discs) {
      box[0] = Math.min(box[0], e.at[0] - e.r - 2);
      box[1] = Math.min(box[1], e.at[1] - e.r - 2);
      box[2] = Math.max(box[2], e.at[0] + e.r + 2);
      box[3] = Math.max(box[3], e.at[1] + e.r + 2);
    }
    for (let y = Math.max(0, Math.floor(box[1]) - 2); y < Math.min(k.h, Math.ceil(box[3]) + 2); y++)
      for (
        let x = Math.max(0, Math.floor(box[0]) - 2);
        x < Math.min(k.w, Math.ceil(box[2]) + 2);
        x++
      ) {
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
if (guessed)
  console.log(`  eye: painted where last seen in ${guessed} frame-eyes (too faint to find)`);
if (lost)
  console.log(`  eye: left dark in ${lost} frame-eyes (missing longer than ${MAX_GUESS} frames)`);

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

// The colour to hold, from the first frame, if asked.
const holdAt = flag('hold-colour') ? meanColour({ data: cut(first), w: cw, h: ch }) : null;
if (holdAt)
  console.log(
    `  colour held at the first frame's mean (${holdAt.map((v) => v.toFixed(0)).join(', ')})`,
  );

// 6. Write the frames.
for (const seg of segments) {
  if (!seg.name) continue;
  let n = 0;
  for (const f of seg.files) {
    const k = keyed.get(f);
    const held = holdAt ? holdColour(cut(k), cw, ch, holdAt) : cut(k);
    const toned = await applyTone(held, cw, ch, gains);
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

#!/usr/bin/env node
/**
 * Cardillion art generator - renders every entry in art/manifest.json to assets/art/<id>.png
 * using the OpenAI Images API (gpt-image-1). See docs/art-pipeline.md for setup.
 *
 *   npm run art                       # generate everything that is missing
 *   npm run art -- --only rat,possum  # just these ids
 *   npm run art -- --force            # regenerate even if the file exists
 *   npm run art -- --quality medium   # low | medium | high (default: manifest.defaults.quality)
 *   npm run art -- --dry-run          # print the prompts, call nothing
 *   npm run art -- --rekey --only rat  # re-run the chroma key on art/out/<id>-raw.png, no API call
 *
 * Requires OPENAI_API_KEY in `.env` (gitignored) or the environment.
 *
 * Styles (or single assets) may set `key: "green" | "blue" | "magenta"`. Those are rendered
 * opaque on a flat chroma background and keyed out here, which keeps thin dark limbs intact —
 * the API's native transparent mode tends to drop them.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MANIFEST = path.join(ROOT, 'art', 'manifest.json');
const OUT_DIR = path.join(ROOT, 'assets', 'art');
const RAW_DIR = path.join(ROOT, 'art', 'out');
const API = 'https://api.openai.com/v1';

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt('only')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const force = flag('force');
const dryRun = flag('dry-run');
const rekey = flag('rekey');

// ---------- .env (tiny parser, no dependency) ----------
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

// ---------- manifest ----------
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const quality = opt('quality') ?? manifest.defaults?.quality ?? 'high';
const assets = manifest.assets.filter((a) => !only || only.includes(a.id));
if (assets.length === 0) {
  console.error('No matching assets in manifest.');
  process.exit(1);
}

const KEYS = {
  green: { rgb: [0, 255, 0], name: 'pure green (#00FF00)' },
  blue: { rgb: [0, 0, 255], name: 'pure blue (#0000FF)' },
  magenta: { rgb: [255, 0, 255], name: 'pure magenta (#FF00FF)' },
};

function keyFor(asset) {
  const style = manifest.styles[asset.style];
  const name = asset.key ?? style?.key;
  if (!name) return null;
  const key = KEYS[name];
  if (!key) throw new Error(`asset ${asset.id}: unknown chroma key "${name}"`);
  return key;
}

function buildPrompt(asset) {
  const style = manifest.styles[asset.style];
  if (!style) throw new Error(`asset ${asset.id}: unknown style "${asset.style}"`);
  const key = keyFor(asset);
  const suffix = key
    ? `The background is a flat, solid, BRIGHT, fully saturated neon ${key.name} chroma-key screen filling the entire frame - unaffected by the scene's lighting or palette; no ground, no shadow, no vignette, nothing else behind the subject.`
    : style.suffix;
  return [style.prefix, asset.prompt, suffix].filter(Boolean).join(' ');
}

/**
 * Chroma key. The model never paints the screen as a literal #00FF00 - it renders it in the
 * style's own palette - so the key hue is estimated from the image corners. A pixel is
 * background when its hue is near that, it is saturated, and it is reasonably bright; the
 * brightness gate is what keeps near-black green fur. A morphological pass then fills interior
 * holes and drops floating specks, and green-dominant edge pixels are despilled.
 */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function chromaKey(png, key) {
  const { width: w, height: h, data: d } = png;
  const idx = key.rgb.indexOf(255) === 0 && key.rgb[2] === 255 ? -1 : key.rgb.indexOf(255);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  // Estimate the screen hue from 16x16 patches in the four corners.
  let hx = 0;
  let hy = 0;
  for (const [cx, cy] of [
    [0, 0],
    [w - 16, 0],
    [0, h - 16],
    [w - 16, h - 16],
  ]) {
    for (let y = cy; y < cy + 16; y++) {
      for (let x = cx; x < cx + 16; x++) {
        const i = (y * w + x) * 4;
        const { h: hue } = rgbToHsv(d[i], d[i + 1], d[i + 2]);
        hx += Math.cos((hue * Math.PI) / 180);
        hy += Math.sin((hue * Math.PI) / 180);
      }
    }
  }
  let keyHue = (Math.atan2(hy, hx) * 180) / Math.PI;
  if (keyHue < 0) keyHue += 360;

  // Pass 1: per-pixel score.
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const { h: hue, s, v } = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    const dist = Math.min(Math.abs(hue - keyHue), 360 - Math.abs(hue - keyHue));
    const score = clamp01((45 - dist) / 20) * clamp01((s - 0.3) / 0.2) * clamp01((v - 0.1) / 0.12);
    alpha[p] = Math.round(255 * (1 - score));
  }

  // Pass 2: fill interior holes, remove floating specks (7x7 neighbourhood vote).
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = alpha[p] >= 128 ? 1 : 0;
  const cleaned = new Uint8Array(w * h);
  const R = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      let on = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          n++;
          on += solid[yy * w + xx];
        }
      }
      const frac = on / n;
      const p = y * w + x;
      cleaned[p] = frac >= 0.8 ? 1 : frac <= 0.15 ? 0 : solid[p];
    }
  }

  // Pass 3: write alpha (soft edge kept where the vote agrees with the score) and despill.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    let a = cleaned[p] ? Math.max(alpha[p], 128) : Math.min(alpha[p], 127);
    if (cleaned[p] && alpha[p] < 128) a = 255; // filled hole
    if (!cleaned[p] && alpha[p] >= 128) a = 0; // removed speck
    d[i + 3] = a;
    if (a > 0 && idx >= 0) {
      const c = [d[i], d[i + 1], d[i + 2]];
      const others = c.filter((_, k) => k !== idx);
      const lim = Math.max(others[0], others[1]);
      // Green-dominant and not pure dark: that's spill from the screen, pull it down.
      if (c[idx] > lim * 1.15 && c[idx] > 30) {
        c[idx] = Math.round(lim * 1.05);
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
      }
    }
  }
  return png;
}

// ---------- API ----------
async function generate(asset, prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error('OPENAI_API_KEY is not set (put it in .env - see docs/art-pipeline.md)');
  const size = asset.size ?? manifest.defaults.size;
  const key = keyFor(asset);
  const background = key ? 'opaque' : (asset.background ?? manifest.defaults.background ?? 'auto');

  let res;
  if (asset.reference) {
    // Style-anchored generation: send the reference image(s) through the edits endpoint.
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('background', background);
    for (const ref of [].concat(asset.reference)) {
      const refPath = path.join(OUT_DIR, `${ref}.png`);
      if (!fs.existsSync(refPath)) throw new Error(`reference ${ref} not generated yet`);
      form.append(
        'image[]',
        new Blob([fs.readFileSync(refPath)], { type: 'image/png' }),
        `${ref}.png`,
      );
    }
    res = await fetch(`${API}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    res = await fetch(`${API}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size,
        quality,
        background,
        output_format: 'png',
        n: 1,
      }),
    });
  }

  if (res.status === 429) throw Object.assign(new Error('rate limited'), { retry: true });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image data in response');
  const raw = Buffer.from(b64, 'base64');
  if (!key) return raw;
  // Keep the raw render so the key can be re-tuned without paying for another generation.
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, `${asset.id}-raw.png`), raw);
  return PNG.sync.write(chromaKey(PNG.sync.read(raw), key));
}

async function withRetry(fn, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!err.retry || attempt >= tries) throw err;
      const wait = 2 ** attempt * 1000;
      console.log(`  rate limited, retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ---------- main ----------
fs.mkdirSync(OUT_DIR, { recursive: true });
let made = 0;
let skipped = 0;
for (const asset of assets) {
  const out = path.join(OUT_DIR, `${asset.id}.png`);
  if (fs.existsSync(out) && !force && !rekey) {
    skipped++;
    continue;
  }
  if (rekey) {
    const rawPath = path.join(RAW_DIR, `${asset.id}-raw.png`);
    const key = keyFor(asset);
    if (!key || !fs.existsSync(rawPath)) continue;
    fs.writeFileSync(out, PNG.sync.write(chromaKey(PNG.sync.read(fs.readFileSync(rawPath)), key)));
    console.log(`[${asset.id}] re-keyed from ${path.relative(ROOT, rawPath)}`);
    made++;
    continue;
  }
  const prompt = buildPrompt(asset);
  console.log(`\n[${asset.id}] ${asset.size ?? manifest.defaults.size} ${quality}`);
  console.log(`  ${prompt}`);
  if (dryRun) continue;
  const png = await withRetry(() => generate(asset, prompt));
  fs.writeFileSync(out, png);
  made++;
  console.log(`  -> ${path.relative(ROOT, out)} (${(png.length / 1024).toFixed(0)} KB)`);
}
console.log(`\n${dryRun ? 'dry run: ' : ''}${made} generated, ${skipped} skipped (already exist).`);

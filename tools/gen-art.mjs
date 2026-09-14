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
 *
 * Requires OPENAI_API_KEY in `.env` (gitignored) or the environment. No other dependencies:
 * uses Node's built-in fetch / FormData / Blob.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MANIFEST = path.join(ROOT, 'art', 'manifest.json');
const OUT_DIR = path.join(ROOT, 'assets', 'art');
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

function buildPrompt(asset) {
  const style = manifest.styles[asset.style];
  if (!style) throw new Error(`asset ${asset.id}: unknown style "${asset.style}"`);
  return [style.prefix, asset.prompt, style.suffix].filter(Boolean).join(' ');
}

// ---------- API ----------
async function generate(asset, prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error('OPENAI_API_KEY is not set (put it in .env - see docs/art-pipeline.md)');
  const size = asset.size ?? manifest.defaults.size;
  const background = asset.background ?? manifest.defaults.background ?? 'auto';

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
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch(`${API}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
  return Buffer.from(b64, 'base64');
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
  if (fs.existsSync(out) && !force) {
    skipped++;
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

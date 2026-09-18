#!/usr/bin/env node
/**
 * Cardillion art generator - renders every entry in art/manifest.json to assets/art/<id>.png
 * using the OpenAI Images API. See docs/art-pipeline.md for setup.
 *
 *   npm run art                       # generate everything that is missing
 *   npm run art -- --only rat,possum  # just these ids
 *   npm run art -- --force            # regenerate even if the file exists
 *   npm run art -- --quality xhigh    # low | medium | high | xhigh | max (default: manifest.defaults.quality)
 *   npm run art -- --model gpt-image-2.5-flare  # override the model (default: asset.model, then manifest.defaults.model)
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
import { KEYS, chromaKey } from './lib/chroma.mjs';
import { loadDotEnv } from './lib/env.mjs';

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

// ---------- .env ----------
loadDotEnv(ROOT);

// ---------- manifest ----------
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const quality = opt('quality') ?? manifest.defaults?.quality ?? 'max';
// The model is per asset (an old asset can pin the model that made it), else the manifest default.
// gpt-image-2.5-sunburst is the precision-editing tier, which is what `subject` edits want;
// -flare is the fast tier at the same price. Quality on 2.5 runs low..max (its `high` is a
// cheap middle tier, unlike gpt-image-1's).
const modelFor = (asset) =>
  opt('model') ?? asset.model ?? manifest.defaults?.model ?? 'gpt-image-2.5-sunburst';
const assets = manifest.assets.filter((a) => !only || only.includes(a.id));
if (assets.length === 0) {
  console.error('No matching assets in manifest.');
  process.exit(1);
}

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
  // With a reference image the edits endpoint tends to redraw the reference's subject, so the
  // prompt says what the reference is for.
  // `subject` is an existing asset to keep and alter (an edit); `reference` is a style anchor.
  // `referenceRole` says what the further images are for when they are not style anchors
  // (e.g. the same creature already mutated, whose wounds a second pose must copy).
  const refHint = asset.subject
    ? `The FIRST image is the subject: keep this exact creature - its pose, size, proportions, colours and every detail not mentioned below - and change only what is described. ${asset.referenceRole ?? 'Any further images are for painting technique only.'}`
    : asset.reference
      ? 'Use the reference image only for its painting technique; the subject is described below.'
      : '';
  const suffix = key
    ? `IMPORTANT: the subject is shown floating in empty space against a flat, evenly lit, bright neon ${key.name} chroma-key screen, cut out like a sticker, with a generous margin of the same colour on every side including below its feet; the bottom edge of the image is exactly the same colour as the top edge. The screen is a perfectly flat digital colour fill, as if the subject had been pasted onto a solid colour layer in an image editor: no ambient occlusion, no cast shadow, no glow and no darkening of the screen anywhere, not even right next to the outline. There is NO floor, NO ground, NO shadow, NO gradient, NO wall, table or room anywhere - only the subject itself is painted.`
    : style.suffix;
  return [refHint, style.prefix, asset.prompt, suffix].filter(Boolean).join(' ');
}

// ---------- API ----------
async function generate(asset, prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error('OPENAI_API_KEY is not set (put it in .env - see docs/art-pipeline.md)');
  const size = asset.size ?? manifest.defaults.size;
  const model = modelFor(asset);
  const key = keyFor(asset);
  const background = key ? 'opaque' : (asset.background ?? manifest.defaults.background ?? 'auto');

  let res;
  if (asset.reference || asset.subject) {
    // Style-anchored generation or an edit: send the image(s) through the edits endpoint.
    // The subject goes first (the prompt says so); its raw chroma render is preferred so the
    // model sees the screen it must paint on.
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('background', background);
    form.append('moderation', 'low'); // the vermin are gory on purpose (spec §11.1)
    const images = [...[].concat(asset.subject ?? []), ...[].concat(asset.reference ?? [])];
    for (const ref of images) {
      // A reference is a generated asset (raw render if kept), or a local photo in art/refs.
      const candidates = [
        ...(asset.subject === ref ? [path.join(RAW_DIR, `${ref}-raw.png`)] : []),
        path.join(OUT_DIR, `${ref}.png`),
        path.join(ROOT, 'art', 'refs', `${ref}.png`),
      ];
      const refPath = candidates.find((f) => fs.existsSync(f));
      if (!refPath) throw new Error(`reference ${ref} not found in assets/art or art/refs`);
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
        model,
        prompt,
        size,
        quality,
        background,
        moderation: 'low',
        output_format: 'png',
        n: 1,
      }),
    });
  }

  if (res.status === 429) throw Object.assign(new Error('rate limited'), { retry: true });
  if (!res.ok) {
    const body = await res.text();
    let hint = '';
    try {
      const d = JSON.parse(body).error?.moderation_details;
      if (d) hint = ` (moderation ${d.moderation_stage}: ${(d.categories ?? []).join(', ')})`;
    } catch {
      /* not JSON */
    }
    throw new Error(`${res.status} ${res.statusText}${hint}: ${body}`);
  }
  const json = await res.json();
  const tokens = json.usage?.output_tokens;
  if (tokens) console.log(`  ${tokens} output tokens (~$${((tokens * 30) / 1e6).toFixed(3)})`);
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
  console.log(
    `\n[${asset.id}] ${modelFor(asset)} ${asset.size ?? manifest.defaults.size} ${quality}`,
  );
  console.log(`  ${prompt}`);
  if (dryRun) continue;
  const png = await withRetry(() => generate(asset, prompt));
  fs.writeFileSync(out, png);
  made++;
  console.log(`  -> ${path.relative(ROOT, out)} (${(png.length / 1024).toFixed(0)} KB)`);
}
console.log(`\n${dryRun ? 'dry run: ' : ''}${made} generated, ${skipped} skipped (already exist).`);

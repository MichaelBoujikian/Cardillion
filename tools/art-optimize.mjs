#!/usr/bin/env node
/**
 * Make web-sized copies of the art masters: assets/art/<id>.png (1024+ px PNG, the source of
 * truth) -> public/art/<id>.webp (what the game actually loads). Run after approving art;
 * commit both.
 *
 *   npm run art:optimize              # every master whose webp is missing or older
 *   npm run art:optimize -- --force   # everything
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SRC = path.join(ROOT, 'assets', 'art');
const OUT = path.join(ROOT, 'public', 'art');
const force = process.argv.includes('--force');

/** Longest side per asset kind - the game never shows art larger than this. */
function maxSide(id) {
  if (id.startsWith('bg-')) return 1536;
  if (id.startsWith('boss-')) return 1024;
  // Pose frames share one wide canvas per creature, so the long side needs the room.
  if (id.startsWith('enemy-') || id.startsWith('npc-')) return 1024;
  return 512; // cards, anchors
}

fs.mkdirSync(OUT, { recursive: true });
const ids = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.replace(/\.png$/, ''));
let made = 0;
for (const id of ids) {
  const src = path.join(SRC, `${id}.png`);
  const out = path.join(OUT, `${id}.webp`);
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs)
    continue;
  const side = maxSide(id);
  await sharp(src)
    .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toFile(out);
  made++;
  console.log(
    `${id}: ${(fs.statSync(src).size / 1024 / 1024).toFixed(1)} MB -> ${(fs.statSync(out).size / 1024).toFixed(0)} KB`,
  );
}
console.log(`${made} written, ${ids.length - made} up to date -> ${path.relative(ROOT, OUT)}`);

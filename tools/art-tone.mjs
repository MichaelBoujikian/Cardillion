#!/usr/bin/env node
/**
 * Cardillion re-toner - match a creature's existing frames to another asset's brightness and
 * chroma, after the fact, with ONE gain for the whole set so nothing changes between frames.
 * Same tone code as the slicer and the cutter (tools/lib/frames.mjs); the amber eyes are left
 * as painted. Overwrites the PNG masters in assets/art - run `npm run art:optimize` after.
 *
 *   npm run art:tone -- --ids enemy-rat-loop-*,enemy-rat-startle-*,enemy-rat-windup,enemy-rat-attack,enemy-rat-hit,enemy-rat-rest --tone enemy-possum
 *
 *   --ids <list>    comma-separated ids; `*` matches the numbered frames (enemy-rat-loop-*)
 *   --tone <id>     the asset whose figure brightness and chroma to match (assets/art/<id>.png)
 *   --from <id>     which of the ids to measure the gains from (default: the first)
 *   --dry-run       print the gains, write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { ART, ROOT, applyTone, readRaw, toneGains } from './lib/frames.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const idsArg = opt('ids');
const toneId = opt('tone');
if (!idsArg || !toneId) {
  console.error('usage: art-tone --ids a,b-*,c --tone <id> [--from <id>] [--dry-run]');
  process.exit(1);
}
const all = fs
  .readdirSync(ART)
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.replace(/\.png$/, ''));
const ids = idsArg.split(',').flatMap((pattern) => {
  if (!pattern.includes('*')) return [pattern];
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return all.filter((id) => re.test(id)).sort();
});
if (!ids.length) throw new Error('no ids matched');
for (const id of ids)
  if (!fs.existsSync(path.join(ART, `${id}.png`)))
    throw new Error(`${id}: no assets/art/${id}.png`);
const fromId = opt('from') ?? ids[0];

const from = await readRaw(fromId);
const gains = await toneGains(from, await readRaw(toneId));
console.log(
  `tone: match ${toneId} (V ${gains.want.v.toFixed(3)} S ${gains.want.s.toFixed(3)}) from ${fromId} (V ${gains.have.v.toFixed(3)} S ${gains.have.s.toFixed(3)}) -> brightness x${gains.brightness.toFixed(2)}, saturation x${gains.saturation.toFixed(2)}, ${ids.length} frames`,
);
if (flag('dry-run')) {
  console.log('dry run: nothing written');
  process.exit(0);
}
for (const id of ids) {
  const file = path.join(ART, `${id}.png`);
  const { data, w, h } = await readRaw(id);
  const toned = await applyTone(data, w, h, gains);
  await sharp(toned, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
}
console.log(
  `${ids.length} frames re-toned in ${path.relative(ROOT, ART)}; run npm run art:optimize`,
);

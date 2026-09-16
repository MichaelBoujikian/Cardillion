/**
 * Textures for the battle scene: the table and light gobo, card faces rendered from content
 * data, procedural placeholders for every creature (used until generated art exists), and
 * helpers for loading generated art and finding glowing eyes in it.
 */
import { cardDef } from '@content/cards';
import { TITLED_UNLOCKS } from '@content/upgrades';
import type { CardDef, CardForm } from '@engine/types';
import * as THREE from 'three';

export const CARD_W = 512;
export const CARD_H = 716;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return [c, ctx];
}

export function srgbTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- generated art ----------

/** Resolves to the image, or null if it does not exist (a placeholder is used instead). */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Generated art keyed by asset id; missing entries mean "use the placeholder". */
export type ArtCache = Map<string, HTMLImageElement>;

/**
 * Loads the web-sized copies in public/art (see tools/art-optimize.mjs); the PNG masters in
 * assets/art never ship.
 */
export async function loadArt(ids: readonly string[]): Promise<ArtCache> {
  const cache: ArtCache = new Map();
  await Promise.all(
    ids.map(async (id) => {
      const img = await loadImage(`art/${id}.webp`);
      if (img) cache.set(id, img);
    }),
  );
  return cache;
}

export function imageTexture(img: HTMLImageElement): THREE.Texture {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Find glowing amber eyes in a sprite: bright, warm, saturated pixels clustered together.
 * Returns up to two centroids in UV space (0..1, v down), largest cluster first.
 */
export function findGlowPoints(img: HTMLImageElement): [number, number][] {
  const w = 256;
  const h = Math.round((img.height / img.width) * 256);
  const [, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const cell = 8;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const hits = new Map<number, { n: number; x: number; y: number }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i] as number;
      const g = d[i + 1] as number;
      const b = d[i + 2] as number;
      const a = d[i + 3] as number;
      if (a > 200 && r > 170 && g > 80 && g < 210 && b < 100 && r - b > 110) {
        const k = Math.floor(y / cell) * cols + Math.floor(x / cell);
        const e = hits.get(k) ?? { n: 0, x: 0, y: 0 };
        e.n++;
        e.x += x;
        e.y += y;
        hits.set(k, e);
      }
    }
  }
  const seen = new Set<number>();
  const clusters: { n: number; x: number; y: number }[] = [];
  for (const [k] of hits) {
    if (seen.has(k)) continue;
    const stack = [k];
    const acc = { n: 0, x: 0, y: 0 };
    while (stack.length) {
      const cur = stack.pop() as number;
      if (seen.has(cur)) continue;
      const e = hits.get(cur);
      if (!e) continue;
      seen.add(cur);
      acc.n += e.n;
      acc.x += e.x;
      acc.y += e.y;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + (dx as number);
        const ny = cy + (dy as number);
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) stack.push(ny * cols + nx);
      }
    }
    if (acc.n >= 6) clusters.push(acc);
  }
  clusters.sort((p, q) => q.n - p.n);
  return clusters.slice(0, 2).map((e) => [e.x / e.n / w, e.y / e.n / h]);
}

// ---------- environment ----------

/** Long table: moss and flowers near the camera, soil in the middle, black earth far away. */
export function makeTableTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 2048);
  const r = rnd(7);
  const g = ctx.createLinearGradient(0, 0, 0, 2048);
  g.addColorStop(0.0, '#0a0910');
  g.addColorStop(0.3, '#1a1620');
  g.addColorStop(0.5, '#2a2218');
  g.addColorStop(0.65, '#3d4a22');
  g.addColorStop(0.82, '#5d8a35');
  g.addColorStop(1.0, '#78a842');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 2048);
  for (let i = 0; i < 26000; i++) {
    const y = r() * 2048;
    const x = r() * 1024;
    const t = y / 2048;
    const dark = r() < 0.5;
    ctx.fillStyle = dark
      ? `rgba(0,0,0,${0.12 + 0.2 * (1 - t)})`
      : `rgba(${180 + 60 * t},${220 * t + 20},${60 * t},${0.08 + 0.12 * t})`;
    const s = 1 + r() * 3;
    ctx.fillRect(x, y, s, s);
  }
  const petals = ['#ffd84a', '#ff7fa3', '#ffffff', '#ffa54a', '#c9a6ff'];
  for (let i = 0; i < 260; i++) {
    const y = 1250 + r() * 780;
    const x = r() * 1024;
    ctx.fillStyle = petals[Math.floor(r() * petals.length)] ?? '#fff';
    ctx.globalAlpha = 0.55 + r() * 0.4;
    const s = 3 + r() * 5;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const t = srgbTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Spotlight gobo: soft leaf-shadow blobs for dappled sunlight. */
export function makeGoboTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const r = rnd(11);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const rad = 18 + r() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(40,40,40,0.75)');
    g.addColorStop(1, 'rgba(40,40,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

/** Soft radial glow used for eyes in the dark, motes and the impact flash. */
export function makeGlowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- card faces ----------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

const RARITY_FRAME: Record<string, string> = {
  common: '#d9c7a0',
  uncommon: '#9fb98a',
  rare: '#e0b64a',
};

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lens = false): void {
  ctx.fillStyle = lens ? '#d8f6ff' : '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (lens) {
    ctx.strokeStyle = '#b8862b';
    ctx.lineWidth = r * 0.35;
    ctx.stroke();
  }
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function smile(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = '#4a2f1c';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function brass(ctx: CanvasRenderingContext2D): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 60, 60);
  g.addColorStop(0, '#f2d27a');
  g.addColorStop(0.5, '#b8862b');
  g.addColorStop(1, '#f2d27a');
  return g;
}

/** Placeholder doodle for a bug, drawn into a w×h window. */
function drawBugDoodle(ctx: CanvasRenderingContext2D, bug: string, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  switch (bug) {
    case 'wormillion': {
      const n = 9;
      for (let i = n - 1; i >= 0; i--) {
        const t = i / (n - 1);
        const px = 60 + t * (w - 120);
        const py = cy + 40 + Math.sin(t * Math.PI * 1.6) * 55 - t * 60;
        const r = 30 + (1 - t) * 6;
        ctx.fillStyle = i % 2 ? '#f7a6c1' : '#ee8fb0';
        ctx.strokeStyle = '#b8557a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (i === n - 1) {
          ctx.strokeStyle = '#b8862b';
          ctx.lineWidth = 5;
          ctx.beginPath();
          for (let k = 0; k <= 6; k++) ctx.lineTo(px + 24 + k * 7, py + (k % 2 ? -10 : 10));
          ctx.stroke();
        }
        if (i === 0) {
          ctx.fillStyle = brass(ctx);
          ctx.beginPath();
          ctx.arc(px, py - 8, r + 4, Math.PI, Math.PI * 2);
          ctx.fill();
          eye(ctx, px + 8, py + 2, 14, true);
          smile(ctx, px - 2, py + 8, 14);
        }
      }
      break;
    }
    case 'roly-poly': {
      ctx.fillStyle = '#7d8fa6';
      ctx.strokeStyle = '#3e4a5c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 150, 105, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const px = cx - 120 + i * 40;
        ctx.strokeStyle = '#3e4a5c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px, cy - 70);
        ctx.quadraticCurveTo(px + 12, cy + 20, px, cy + 110);
        ctx.stroke();
        ctx.fillStyle = '#e0b64a';
        ctx.beginPath();
        ctx.arc(px + 6, cy - 20, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      eye(ctx, cx + 120, cy + 10, 12);
      smile(ctx, cx + 128, cy + 30, 12);
      break;
    }
    case 'ladybug': {
      ctx.fillStyle = '#e63946';
      ctx.strokeStyle = '#7a1522';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 140, 120, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#231a1a';
      ctx.beginPath();
      ctx.arc(cx, cy - 100, 60, 0, Math.PI * 2);
      ctx.fill();
      const spots: [number, number][] = [
        [-70, -20],
        [70, -20],
        [-40, 60],
        [40, 60],
        [-95, 40],
        [95, 40],
        [0, 10],
      ];
      spots.forEach(([sx, sy], i) => {
        ctx.fillStyle = '#231a1a';
        ctx.beginPath();
        ctx.arc(cx + sx, cy + sy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0b64a';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (i === 6) eye(ctx, cx + sx, cy + sy, 18, true);
      });
      eye(ctx, cx - 22, cy - 105, 10);
      eye(ctx, cx + 22, cy - 105, 10);
      break;
    }
    case 'caterpillar': {
      for (let i = 6; i >= 0; i--) {
        const px = 70 + i * 48;
        const py = cy + 30 - Math.abs(3 - i) * 10;
        ctx.fillStyle = i % 2 ? '#8bd346' : '#6fbf35';
        ctx.strokeStyle = '#3d7a1c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, py, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#d98a3a';
        ctx.lineWidth = 3;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(px + k * 10, py - 30);
          ctx.lineTo(px + k * 14, py - 52);
          ctx.stroke();
        }
        if (i === 0) {
          eye(ctx, px + 6, py - 6, 12, true);
          smile(ctx, px + 2, py + 6, 10);
        }
      }
      break;
    }
    case 'butterfly': {
      for (const s of [-1, 1]) {
        ctx.fillStyle = s < 0 ? '#ffb347' : '#ff9a3c';
        ctx.strokeStyle = '#b8862b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx + s * 95, cy - 30, 90, 70, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.ellipse(cx + s * 70, cy + 55, 60, 45, s * -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + s * 110, cy - 40, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#4a3418';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 14, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      eye(ctx, cx - 6, cy - 55, 8);
      eye(ctx, cx + 6, cy - 55, 8);
      break;
    }
    case 'chameleon': {
      ctx.fillStyle = '#6fbf7a';
      ctx.strokeStyle = '#2f6b3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 150, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 140, cy - 10, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2f6b3a';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx - 150, cy + 60, 40, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
      eye(ctx, cx + 150, cy - 25, 22, true);
      ctx.strokeStyle = '#e05a7a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx + 190, cy + 5);
      ctx.lineTo(cx + 250, cy - 20);
      ctx.stroke();
      break;
    }
    case 'cat': {
      ctx.fillStyle = '#9a9aa8';
      ctx.strokeStyle = '#4a4a58';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 110, cy - 60);
      ctx.lineTo(cx - 90, cy - 140);
      ctx.lineTo(cx - 40, cy - 90);
      ctx.lineTo(cx + 40, cy - 90);
      ctx.lineTo(cx + 90, cy - 140);
      ctx.lineTo(cx + 110, cy - 60);
      ctx.quadraticCurveTo(cx + 120, cy + 90, cx, cy + 100);
      ctx.quadraticCurveTo(cx - 120, cy + 90, cx - 110, cy - 60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      eye(ctx, cx - 40, cy - 10, 16);
      const g = ctx.createRadialGradient(cx + 40, cy - 10, 2, cx + 40, cy - 10, 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#7ef3ff');
      g.addColorStop(1, 'rgba(126,243,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + 40, cy - 10, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8862b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx + 40, cy - 10, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e88aa0';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 25);
      ctx.lineTo(cx + 10, cy + 25);
      ctx.lineTo(cx, cy + 38);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      // Cobweb and anything unknown: a grey web.
      ctx.strokeStyle = 'rgba(200,200,210,0.8)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 170, cy + Math.sin(a) * 150);
        ctx.stroke();
      }
      for (let k = 1; k <= 5; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = k * 32;
          ctx.lineTo(cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr);
        }
        ctx.stroke();
      }
    }
  }
}

export interface CardFaceOptions {
  /** Generated art for this card, if any. */
  art?: HTMLImageElement | null;
  upgraded?: boolean;
}

/**
 * Render a full card face from content data. Layout: sun-gem cost top-left, art window,
 * name, type line, effect text. Upgraded forms get a brass "+" rivet.
 */
export function drawCardFace(
  def: CardDef,
  form: CardForm,
  opts: CardFaceOptions = {},
): HTMLCanvasElement {
  const [c, ctx] = canvas(CARD_W, CARD_H);
  const status = def.type === 'status';
  // Frame.
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 30);
  ctx.fillStyle = status ? '#4a4652' : (RARITY_FRAME[def.rarity] ?? '#d9c7a0');
  ctx.fill();
  roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 24);
  ctx.fillStyle = status ? '#2a2731' : '#f7ecd6';
  ctx.fill();
  // Art window.
  roundRect(ctx, 40, 104, 432, 400, 18);
  const sky = ctx.createLinearGradient(0, 104, 0, 504);
  if (status) {
    sky.addColorStop(0, '#1a1822');
    sky.addColorStop(1, '#3a3644');
  } else {
    sky.addColorStop(0, '#bfe3ff');
    sky.addColorStop(1, '#eaf8d2');
  }
  ctx.fillStyle = sky;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (!status) {
    ctx.fillStyle = 'rgba(255,232,140,0.9)';
    ctx.beginPath();
    ctx.arc(420, 150, 42, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.art) {
    const k = Math.min(432 / opts.art.width, 400 / opts.art.height);
    const dw = opts.art.width * k;
    const dh = opts.art.height * k;
    ctx.drawImage(opts.art, 40 + (432 - dw) / 2, 104 + (400 - dh) / 2, dw, dh);
  } else {
    ctx.save();
    ctx.translate(40, 134);
    drawBugDoodle(ctx, def.bug ?? def.id, 432, 340);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = status ? '#6a6678' : '#b8862b';
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 104, 432, 400, 18);
  ctx.stroke();
  // Cost gem (a sun).
  if (!def.unplayable) {
    ctx.save();
    ctx.translate(64, 64);
    ctx.fillStyle = '#f2b200';
    for (let i = 0; i < 10; i++) {
      ctx.rotate((Math.PI * 2) / 10);
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(8, -34);
      ctx.lineTo(-8, -34);
      ctx.closePath();
      ctx.fill();
    }
    const gem = ctx.createRadialGradient(-8, -8, 4, 0, 0, 36);
    gem.addColorStop(0, '#fff6c2');
    gem.addColorStop(1, '#f2b200');
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a06f00';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#4a3418';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(form.cost), 0, 2);
    ctx.restore();
  }
  // Upgrade rivet.
  if (opts.upgraded) {
    ctx.save();
    ctx.translate(CARD_W - 64, 64);
    ctx.fillStyle = brass(ctx);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a1c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#4a3418';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 0, 2);
    ctx.restore();
  }
  // Name, type, text.
  const ink = status ? '#d8d2e0' : '#4a3418';
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(def.name + (opts.upgraded ? '+' : ''), CARD_W / 2, 552);
  ctx.fillStyle = status ? '#9a94a8' : '#7a6a4a';
  ctx.font = 'italic 24px Georgia, serif';
  // Type line names the family (Drill Worm is "Attack · Wormillion"); an upgraded form shows
  // the family's title instead, the banner spec §5.1 asks for ("Mr. Wormsley").
  const family = def.bug ? cardDef(def.bug).name : def.name;
  const typeLine =
    def.type === 'status'
      ? 'Status'
      : opts.upgraded && def.bug
        ? `${def.type === 'attack' ? 'Attack' : 'Skill'} · ${TITLED_UNLOCKS[def.bug]}`
        : `${def.type === 'attack' ? 'Attack' : 'Skill'} · ${family}`;
  if (opts.upgraded) ctx.fillStyle = '#8a5a1c';
  ctx.fillText(typeLine, CARD_W / 2, 588);
  ctx.fillStyle = status ? '#cfc9d8' : '#3a2a18';
  ctx.font = '28px Georgia, serif';
  const words = form.text.split(' ');
  let line = '';
  let y = 640;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 400) {
      ctx.fillText(line, CARD_W / 2, y);
      line = w;
      y += 34;
    } else line = test;
  }
  ctx.fillText(line, CARD_W / 2, y);
  return c;
}

// ---------- vermin placeholders ----------

/** Eye positions (UV, v down) of the placeholder vermin drawings, for the emissive glow. */
export const PLACEHOLDER_EYES: [number, number][] = [
  [372 / 512, 262 / 512],
  [402 / 512, 256 / 512],
];

/**
 * A mangy silhouette that stands in for any vermin until generated art exists. The body
 * shape varies a little by kind so a fight of mixed enemies is still readable.
 */
export function makeVerminPlaceholder(kind: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const r = rnd(23 + kind.length);
  ctx.clearRect(0, 0, 512, 512);
  const body = '#3a3346';
  const bodyDark = '#241f2c';
  const spike = (cx: number, cy: number, rx: number, ry: number, count: number, len: number) => {
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const x0 = cx + Math.cos(a) * rx * (0.9 + r() * 0.15);
      const y0 = cy + Math.sin(a) * ry * (0.9 + r() * 0.15);
      const l = len * (0.4 + r());
      ctx.strokeStyle = r() < 0.6 ? bodyDark : body;
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(
        x0 + Math.cos(a + (r() - 0.5) * 0.8) * l,
        y0 + Math.sin(a + (r() - 0.5) * 0.8) * l,
      );
      ctx.stroke();
    }
  };
  const bodyCx = 250;
  const bodyCy = 335;
  const spidery = kind.includes('spider');
  const scorp = kind === 'scorpion';
  const rx = spidery ? 110 : 150;
  const ry = spidery ? 100 : 92;
  // Tail.
  if (!spidery) {
    ctx.lineCap = 'round';
    for (let k = 0; k < 18; k++) {
      const t = k / 18;
      const x = scorp ? 120 - t * 40 : 130 - t * 118 + Math.sin(t * 6) * 8;
      const y = scorp ? 300 - t * 170 + Math.pow(t, 2) * 60 : 352 + t * 120 + Math.cos(t * 4) * 6;
      ctx.fillStyle = k % 2 ? '#7a6470' : '#5e4a58';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 - t * 3, 5 - t * 2, t * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyCy, rx, ry, -0.1, 0, Math.PI * 2);
  ctx.fill();
  spike(bodyCx, bodyCy, rx, ry, 420, 26);
  // Legs.
  const legs = spidery ? [140, 190, 240, 290, 340, 380] : [172, 232, 300, 350];
  for (const lx of legs) {
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(
      lx,
      428,
      spidery ? 8 : 13,
      spidery ? 48 : 36,
      0.1 * (lx > 250 ? -1 : 1),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.strokeStyle = '#8d8494';
    ctx.lineWidth = 2.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(lx + k * 6, 458);
      ctx.lineTo(lx + k * 13, 482);
      ctx.stroke();
    }
  }
  // Head.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(372, 288, spidery ? 48 : 68, spidery ? 44 : 58, 0.2, 0, Math.PI * 2);
  ctx.fill();
  spike(372, 288, 60, 52, 140, 18);
  if (!spidery) {
    ctx.beginPath();
    ctx.moveTo(400, 250);
    ctx.lineTo(470, 300);
    ctx.lineTo(392, 334);
    ctx.closePath();
    ctx.fill();
    for (const [ex, ey] of [
      [338, 222],
      [394, 208],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(ex - 26, ey + 20);
      ctx.lineTo(ex - 8, ey - 28);
      ctx.lineTo(ex + 6, ey - 12);
      ctx.lineTo(ex + 22, ey - 26);
      ctx.lineTo(ex + 26, ey + 22);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (kind === 'possum') {
    const g = ctx.createRadialGradient(372, 290, 4, 372, 290, 60);
    g.addColorStop(0, 'rgba(200,190,200,0.85)');
    g.addColorStop(1, 'rgba(200,190,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(372, 290, 60, 0, Math.PI * 2);
    ctx.fill();
  }
  if (scorp) {
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(400, 320);
    ctx.quadraticCurveTo(470, 280, 480, 340);
    ctx.stroke();
  }
  // Teeth and rim light.
  ctx.fillStyle = '#d9cf9a';
  for (const tx of [428, 441, 452]) {
    ctx.beginPath();
    ctx.moveTo(tx, 314);
    ctx.lineTo(tx + 6, 314);
    ctx.lineTo(tx + 2, 332);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,170,80,0.4)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyCy, rx - 2, ry - 2, -0.1, -0.9, -0.25);
  ctx.stroke();
  for (const [u, v] of PLACEHOLDER_EYES) {
    const x = u * 512;
    const y = v * 512;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 12);
    g.addColorStop(0, 'rgba(255,190,80,1)');
    g.addColorStop(0.45, 'rgba(255,150,40,0.6)');
    g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  return srgbTexture(c);
}

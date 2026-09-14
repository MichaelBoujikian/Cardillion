/**
 * Procedurally drawn textures for the look prototype. Everything here is a stand-in for
 * generated art; the point is to test lighting, fog, composition and the two-world contrast.
 */
import * as THREE from 'three';

export type Bug = 'wormillion' | 'roly-poly' | 'ladybug' | 'caterpillar' | 'cat';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return [c, ctx];
}

function srgbTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
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

/** Long table: moss and flowers near the camera, soil in the middle, black earth far away. */
export function makeTableTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 2048);
  const r = rnd(7);
  // v=0 is the far edge, v=1 the near edge (plane UV after rotation).
  const g = ctx.createLinearGradient(0, 0, 0, 2048);
  g.addColorStop(0.0, '#0a0910');
  g.addColorStop(0.3, '#1a1620');
  g.addColorStop(0.5, '#2a2218');
  g.addColorStop(0.65, '#3d4a22');
  g.addColorStop(0.82, '#5d8a35');
  g.addColorStop(1.0, '#78a842');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 2048);
  // Soil / moss speckle.
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
  // Tiny flowers in the near half.
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
  const t = new THREE.CanvasTexture(c);
  return t;
}

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

const BUGS: Record<
  Bug,
  { name: string; type: string; cost: number; text: string; rarity: string }
> = {
  wormillion: {
    name: 'Wormillion',
    type: 'Attack · Worm',
    cost: 1,
    text: 'Deal 4.',
    rarity: '#d9c7a0',
  },
  'roly-poly': {
    name: 'Roly Poly',
    type: 'Skill · Roly Poly',
    cost: 1,
    text: 'Gain 5 Block.',
    rarity: '#d9c7a0',
  },
  ladybug: {
    name: 'Ladybug',
    type: 'Attack · Ladybug',
    cost: 2,
    text: 'Deal 4 to ALL enemies.',
    rarity: '#9fb98a',
  },
  caterpillar: {
    name: 'Caterpillar',
    type: 'Attack · Caterpillar',
    cost: 1,
    text: 'Deal 2. Apply 3 Poison.',
    rarity: '#d9c7a0',
  },
  cat: {
    name: 'Cat',
    type: 'Attack · Cat',
    cost: 1,
    text: 'Deal 6. Can target Unseen enemies.',
    rarity: '#e0b64a',
  },
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

function drawArt(
  ctx: CanvasRenderingContext2D,
  bug: Bug,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const cx = w / 2;
  const cy = h / 2;
  switch (bug) {
    case 'wormillion': {
      // Segmented pink body along a sine curve, brass head cap, lens eye, spring tail.
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
          // Spring tail.
          ctx.strokeStyle = '#b8862b';
          ctx.lineWidth = 5;
          ctx.beginPath();
          for (let k = 0; k <= 6; k++) ctx.lineTo(px + 24 + k * 7, py + (k % 2 ? -10 : 10));
          ctx.stroke();
        }
        if (i === 0) {
          // Brass cap.
          ctx.fillStyle = brass(ctx);
          ctx.beginPath();
          ctx.arc(px, py - 8, r + 4, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#7a5a1c';
          ctx.fillRect(px - 6, py - r - 22, 12, 12);
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
      ctx.strokeStyle = '#7a1522';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 60);
      ctx.lineTo(cx, cy + 140);
      ctx.stroke();
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
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(px - 8, py + 30, 6, 16);
        ctx.fillRect(px + 4, py + 30, 6, 16);
        if (i === 0) {
          eye(ctx, px + 6, py - 6, 12, true);
          smile(ctx, px + 2, py + 6, 10);
        }
      }
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
      ctx.fillStyle = brass(ctx);
      ctx.beginPath();
      ctx.moveTo(cx + 44, cy - 92);
      ctx.lineTo(cx + 88, cy - 136);
      ctx.lineTo(cx + 104, cy - 66);
      ctx.closePath();
      ctx.fill();
      eye(ctx, cx - 40, cy - 10, 16);
      // Robotic eye: glowing cyan lens.
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
      ctx.strokeStyle = '#4a4a58';
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(cx + s * 20, cy + 30 + k * 8);
          ctx.lineTo(cx + s * 120, cy + 10 + k * 18);
          ctx.stroke();
        }
      }
      break;
    }
  }
  ctx.restore();
}

/** A full card face (512 × 716). Returns the canvas so the DOM hand can reuse it as a data URL. */
export function drawCardFace(bug: Bug): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 716);
  const meta = BUGS[bug];
  // Frame.
  roundRect(ctx, 0, 0, 512, 716, 30);
  ctx.fillStyle = meta.rarity;
  ctx.fill();
  roundRect(ctx, 12, 12, 488, 692, 24);
  ctx.fillStyle = '#f7ecd6';
  ctx.fill();
  // Art window with a happy sky.
  roundRect(ctx, 40, 104, 432, 340, 18);
  const sky = ctx.createLinearGradient(0, 104, 0, 444);
  sky.addColorStop(0, '#bfe3ff');
  sky.addColorStop(1, '#eaf8d2');
  ctx.fillStyle = sky;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Sun.
  ctx.fillStyle = 'rgba(255,232,140,0.9)';
  ctx.beginPath();
  ctx.arc(420, 150, 42, 0, Math.PI * 2);
  ctx.fill();
  drawArt(ctx, bug, 40, 104, 432, 340);
  ctx.restore();
  ctx.strokeStyle = '#b8862b';
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 104, 432, 340, 18);
  ctx.stroke();
  // Cost gem: a sun.
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
  ctx.fillText(String(meta.cost), 0, 2);
  ctx.restore();
  // Name, type, text.
  ctx.fillStyle = '#4a3418';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(meta.name, 256, 500);
  ctx.fillStyle = '#7a6a4a';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText(meta.type, 256, 540);
  ctx.fillStyle = '#3a2a18';
  ctx.font = '30px Georgia, serif';
  const words = meta.text.split(' ');
  let line = '';
  let y = 610;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 400) {
      ctx.fillText(line, 256, y);
      line = w;
      y += 38;
    } else line = test;
  }
  ctx.fillText(line, 256, y);
  return c;
}

export function cardTexture(bug: Bug): THREE.CanvasTexture {
  return srgbTexture(drawCardFace(bug));
}

/** Where the rat's eyes are, in UV space, so emissive planes can sit exactly on them. */
export const RAT_EYES: [number, number][] = [
  [372 / 512, 262 / 512],
  [402 / 512, 256 / 512],
];

/** A mangy rat: spiky matted fur, bald patches, sores, ribs, a naked tail. Transparent background. */
export function makeRatTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const r = rnd(23);
  ctx.clearRect(0, 0, 512, 512);
  const body = '#3a3346';
  const bodyDark = '#241f2c';
  // Naked tail: segmented, pinkish-grey, too long.
  ctx.lineCap = 'round';
  for (let k = 0; k < 18; k++) {
    const t = k / 18;
    const x = 130 - t * 118 + Math.sin(t * 6) * 8;
    const y = 352 + t * 120 + Math.cos(t * 4) * 6;
    ctx.fillStyle = k % 2 ? '#7a6470' : '#5e4a58';
    ctx.beginPath();
    ctx.ellipse(x, y, 7 - t * 4, 5 - t * 2.5, t * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fur: many overlapping jagged strokes build a spiky, greasy silhouette.
  const bodyCx = 250;
  const bodyCy = 335;
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
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyCy, 150, 92, -0.1, 0, Math.PI * 2);
  ctx.fill();
  spike(bodyCx, bodyCy, 150, 92, 420, 26);
  // Hunched spine ridge.
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(110, 300);
  ctx.quadraticCurveTo(230, 210, 330, 250);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 120 + t * 200;
    const y = 296 - Math.sin(t * Math.PI) * 60;
    ctx.fillStyle = '#4c4358';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ribs showing through.
  ctx.strokeStyle = '#4a4156';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(190 + i * 24, 322, 52, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  }
  // Bald patches: greasy pink-grey skin.
  for (const [px, py, pr] of [
    [200, 300, 24],
    [290, 370, 20],
    [160, 360, 16],
  ] as const) {
    const g = ctx.createRadialGradient(px, py, 2, px, py, pr);
    g.addColorStop(0, 'rgba(150,110,120,0.95)');
    g.addColorStop(0.7, 'rgba(120,88,100,0.7)');
    g.addColorStop(1, 'rgba(120,88,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sores.
  for (const [sx, sy] of [
    [206, 306],
    [296, 376],
    [232, 400],
  ] as const) {
    ctx.fillStyle = '#5a1d22';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8393a';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head: narrow, snout long, ears torn.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(372, 288, 68, 58, 0.2, 0, Math.PI * 2);
  ctx.fill();
  spike(372, 288, 68, 58, 140, 18);
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
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(ex - 26, ey + 20);
    ctx.lineTo(ex - 8, ey - 28);
    ctx.lineTo(ex + 6, ey - 12);
    ctx.lineTo(ex + 22, ey - 26);
    ctx.lineTo(ex + 26, ey + 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a4a58';
    ctx.beginPath();
    ctx.ellipse(ex, ey + 2, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Legs and claws.
  for (const lx of [172, 232, 300, 350]) {
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(lx, 428, 13, 36, 0.1 * (lx > 250 ? -1 : 1), 0, Math.PI * 2);
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
  // Nose, teeth, drool.
  ctx.fillStyle = '#7a4a58';
  ctx.beginPath();
  ctx.arc(468, 300, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9cf9a';
  for (const tx of [428, 441, 452]) {
    ctx.beginPath();
    ctx.moveTo(tx, 314);
    ctx.lineTo(tx + 6, 314);
    ctx.lineTo(tx + 2, 332);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(190,200,190,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(446, 330);
  ctx.quadraticCurveTo(448, 350, 444, 366);
  ctx.stroke();
  // Warm rim light spilling from the garden onto its right edge.
  ctx.strokeStyle = 'rgba(255,170,80,0.4)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(372, 288, 66, 56, 0.2, -0.7, 1.0);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyCy, 148, 90, -0.1, -0.9, -0.25);
  ctx.stroke();
  // Eyes: crusted rims, amber glow (emissive sprites sit on top).
  for (const [u, v] of RAT_EYES) {
    const x = u * 512;
    const y = v * 512;
    ctx.fillStyle = '#1a0f12';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
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

/** Soft radial glow used for eyes in the dark and for the impact flash. */
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

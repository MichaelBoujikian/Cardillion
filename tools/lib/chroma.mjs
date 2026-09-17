/**
 * Chroma key shared by the art tools: the model never paints the screen as a literal #00FF00 -
 * it renders it in the style's own palette - so the key hue is estimated from the image
 * corners. See chromaKey for the passes.
 */
export const KEYS = {
  green: { rgb: [0, 255, 0], name: 'pure green (#00FF00)' },
  blue: { rgb: [0, 0, 255], name: 'pure blue (#0000FF)' },
  magenta: { rgb: [255, 0, 255], name: 'pure magenta (#FF00FF)' },
};

/**
 * Chroma key. The model never paints the screen as a literal #00FF00 - it renders it in the
 * style's own palette - so the key hue is estimated from the image corners. A pixel is
 * background when its hue is near that, it is saturated, and it is reasonably bright; the
 * brightness gate is what keeps near-black green fur. A morphological pass then fills interior
 * holes and drops floating specks, and green-dominant edge pixels are despilled.
 */
export function rgbToHsv(r, g, b) {
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

export function chromaKey(png, key) {
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

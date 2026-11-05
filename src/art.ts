// Chunky Cartoon art: drawn with the Canvas 2D API (gradients and rounded outlines that
// Phaser Graphics can't do), then registered as Phaser textures. Sizes are in texture units;
// every texture is rendered at S× and sprites are scaled by 1/S, same as textures.ts.
import Phaser from 'phaser';
import { S } from './config';

export type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export const INK = '#24160d';

export function ctex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * S);
  canvas.height = Math.ceil(h * S);
  const c = canvas.getContext('2d')!;
  c.scale(S, S);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  scene.textures.addCanvas(key, canvas);
}

export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function ink(c: Ctx, w: number, color = INK): void {
  c.lineWidth = w;
  c.strokeStyle = color;
  c.stroke();
}

export function radial(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.05);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

export function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Googly eye with outline, pupil and a glint. look = pupil offset as a fraction of r. */
export function eye(c: Ctx, x: number, y: number, r: number, line: number, look: [number, number] = [0.15, 0.2], lid?: string): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
  c.beginPath();
  c.arc(x + r * look[0], y + r * look[1], r * 0.56, 0, TAU);
  c.fillStyle = '#1a1008';
  c.fill();
  if (lid) {
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.clip();
    c.fillStyle = lid;
    c.fillRect(x - r, y - r, r * 2, r * 0.85);
    c.restore();
  }
  c.beginPath();
  c.arc(x - r * 0.32, y - r * 0.34, r * 0.22, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  ink(c, line);
}

/** Angry glowing enemy eye: red disc, hot core, slanted brow. dir = -1 left eye, 1 right eye. */
export function angryEye(c: Ctx, x: number, y: number, r: number, dir: number, line: number, color = '#ff4536'): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = color;
  c.fill();
  c.beginPath();
  c.arc(x + dir * r * 0.15, y + r * 0.15, r * 0.42, 0, TAU);
  c.fillStyle = '#ffd34a';
  c.fill();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  ink(c, line * 0.7);
  c.beginPath();
  // Outer end high, inner end low: reads as angry, not worried.
  c.moveTo(x + dir * r * 1.2, y - r * 1.6);
  c.lineTo(x - dir * r * 1.05, y - r * 0.8);
  ink(c, Math.max(1.2, r * 0.62));
}

// ---------- Bagels ----------
export interface BagelLook {
  base: string;
  crust: string;
  hi: string;
  seeds?: string[];
  seedCount?: number;
  seedSize?: number;
  swirl?: string;
}

export function drawBagel(c: Ctx, cx: number, cy: number, r: number, look: BagelLook): void {
  const hole = r * 0.36;
  const line = Math.max(1.6, r * 0.15);
  const ring = () => {
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.moveTo(cx + hole, cy);
    c.arc(cx, cy, hole, 0, TAU, true);
  };
  ring();
  c.fillStyle = radial(c, cx, cy, r, [
    [0, look.hi],
    [0.5, look.base],
    [1, look.crust],
  ]);
  c.fill('evenodd');
  // Darker inner lip so the hole reads as depth.
  c.beginPath();
  c.arc(cx, cy, hole + r * 0.12, 0, TAU);
  c.moveTo(cx + hole, cy);
  c.arc(cx, cy, hole, 0, TAU, true);
  c.fillStyle = look.crust;
  c.globalAlpha = 0.55;
  c.fill('evenodd');
  c.globalAlpha = 1;
  if (look.swirl) {
    c.strokeStyle = look.swirl;
    c.lineWidth = r * 0.09;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(cx, cy, hole + r * (0.18 + i * 0.16), Math.PI * (0.2 + i * 0.7), Math.PI * (1.05 + i * 0.7));
      c.stroke();
    }
  }
  c.beginPath();
  c.arc(cx, cy, r * 0.72, Math.PI * 1.1, Math.PI * 1.6);
  c.lineWidth = r * 0.13;
  c.strokeStyle = look.hi;
  c.stroke();
  if (look.seeds) {
    const rand = rng(7);
    const n = look.seedCount ?? 24;
    const sz = (look.seedSize ?? 1) * r * 0.075;
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const d = hole + r * 0.16 + rand() * (r * 0.62 - r * 0.16);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      // Keep the face area clear.
      if (y < cy - r * 0.35 && Math.abs(x - cx) < r * 0.62) continue;
      c.save();
      c.translate(x, y);
      c.rotate(rand() * Math.PI);
      c.beginPath();
      c.ellipse(0, 0, sz * 1.5, sz * 0.85, 0, 0, TAU);
      c.fillStyle = look.seeds[i % look.seeds.length];
      c.fill();
      c.restore();
    }
  }
  c.beginPath();
  c.arc(cx, cy, r, 0, TAU);
  ink(c, line);
  c.beginPath();
  c.arc(cx, cy, hole, 0, TAU);
  ink(c, line);
  eye(c, cx - r * 0.31, cy - r * 0.6, r * 0.24, line * 0.75);
  eye(c, cx + r * 0.31, cy - r * 0.6, r * 0.24, line * 0.75);
}

// ---------- Enemies ----------
function blobPath(c: Ctx, x: number, y: number, r: number, n: number, jag: number, seed: number): void {
  const rand = rng(seed);
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - jag * rand());
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

export function drawCrumb(c: Ctx, x: number, y: number, r: number): void {
  const line = Math.max(1.5, r * 0.19);
  blobPath(c, x, y, r, 9, 0.24, 11);
  c.fillStyle = radial(c, x, y, r, [
    [0, '#8a5d3b'],
    [1, '#4f321f'],
  ]);
  c.fill();
  ink(c, line);
  c.fillStyle = '#9a6a44';
  c.beginPath();
  c.arc(x + r * 0.38, y + r * 0.42, r * 0.11, 0, TAU);
  c.arc(x - r * 0.42, y + r * 0.34, r * 0.08, 0, TAU);
  c.fill();
  angryEye(c, x - r * 0.33, y - r * 0.06, r * 0.21, -1, line);
  angryEye(c, x + r * 0.33, y - r * 0.06, r * 0.21, 1, line);
}

function moldShape(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r * 0.8, 0, TAU);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const bx = x + Math.cos(a) * r * 0.64;
    const by = y + Math.sin(a) * r * 0.64;
    c.moveTo(bx + r * 0.34, by);
    c.arc(bx, by, r * 0.34, 0, TAU);
  }
}

export function drawMold(c: Ctx, x: number, y: number, r: number, cols = { body: '#78bd48', dark: '#4c8b2d', hi: '#aee07c' }): void {
  const line = Math.max(1.5, r * 0.13);
  moldShape(c, x, y, r);
  c.lineWidth = line * 2;
  c.strokeStyle = INK;
  c.stroke();
  moldShape(c, x, y, r);
  c.fillStyle = radial(c, x, y, r, [
    [0, cols.hi],
    [1, cols.body],
  ]);
  c.fill('nonzero');
  c.fillStyle = cols.dark;
  for (const [dx, dy, rr] of [
    [-0.45, 0.38, 0.14],
    [0.42, 0.44, 0.11],
    [0.52, -0.38, 0.09],
  ]) {
    c.beginPath();
    c.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
    c.fill();
  }
  eye(c, x - r * 0.27, y - r * 0.1, r * 0.21, line * 0.8, [0, 0.35], cols.dark);
  eye(c, x + r * 0.27, y - r * 0.1, r * 0.21, line * 0.8, [0, 0.35], cols.dark);
  // Frown
  c.beginPath();
  c.arc(x, y + r * 0.42, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
  ink(c, line * 0.8);
}

export function drawElite(c: Ctx, x: number, y: number, r: number): void {
  drawMold(c, x, y, r, { body: '#5c9e3a', dark: '#2f6420', hi: '#9fd46a' });
  // Fuzzy spore spikes on top so the elite reads as a tougher, older mold.
  c.fillStyle = '#c9f08e';
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.15 + i * 0.175);
    const px = x + Math.cos(a) * r * 0.98;
    const py = y + Math.sin(a) * r * 0.98;
    c.beginPath();
    c.arc(px, py, r * 0.1, 0, TAU);
    c.fill();
    ink(c, Math.max(1, r * 0.05));
  }
  // Angry brows override the sleepy look.
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + d * r * 0.08, y - r * 0.26);
    c.lineTo(x + d * r * 0.5, y - r * 0.4);
    ink(c, r * 0.09);
  }
}

// ---------- Freezer enemies ----------
// Icy, but still dark-outlined with red angry eyes, so they never read as blue XP seeds.

/** A Stage 1 crumb with a snowy cap and frost specks. */
export function drawFrostCrumb(c: Ctx, x: number, y: number, r: number): void {
  drawCrumb(c, x, y, r);
  const line = Math.max(1.5, r * 0.19);
  c.beginPath();
  c.moveTo(x - r * 0.8, y - r * 0.35);
  c.quadraticCurveTo(x - r * 0.6, y - r * 1.05, x, y - r * 0.95);
  c.quadraticCurveTo(x + r * 0.65, y - r * 1.05, x + r * 0.82, y - r * 0.32);
  c.quadraticCurveTo(x + r * 0.4, y - r * 0.55, x + r * 0.1, y - r * 0.42);
  c.quadraticCurveTo(x - r * 0.35, y - r * 0.6, x - r * 0.8, y - r * 0.35);
  c.closePath();
  c.fillStyle = '#f4fbff';
  c.fill();
  ink(c, line * 0.7);
  angryEye(c, x - r * 0.33, y - r * 0.06, r * 0.21, -1, line);
  angryEye(c, x + r * 0.33, y - r * 0.06, r * 0.21, 1, line);
}

/** A grumpy ice cube: translucent blue block with a white glint. */
export function drawIceCube(c: Ctx, x: number, y: number, r: number): void {
  const line = Math.max(1.6, r * 0.15);
  rrect(c, x - r, y - r * 0.92, r * 2, r * 1.84, r * 0.38);
  c.fillStyle = linear(c, x - r, y - r, x + r, y + r, [
    [0, '#e4f6ff'],
    [0.55, '#9fd3ee'],
    [1, '#5f9fc4'],
  ]);
  c.fill();
  ink(c, line);
  c.beginPath();
  c.moveTo(x - r * 0.62, y - r * 0.5);
  c.lineTo(x - r * 0.62, y + r * 0.1);
  c.moveTo(x - r * 0.62, y - r * 0.5);
  c.lineTo(x - r * 0.1, y - r * 0.5);
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = line * 0.9;
  c.lineCap = 'round';
  c.stroke();
  angryEye(c, x - r * 0.3, y + r * 0.1, r * 0.2, -1, line);
  angryEye(c, x + r * 0.34, y + r * 0.1, r * 0.2, 1, line);
}

/** A pea pod that shoots peas: green pod, peas showing, red eyes. */
export function drawPeaPod(c: Ctx, x: number, y: number, r: number): void {
  const line = Math.max(1.5, r * 0.15);
  c.beginPath();
  c.ellipse(x, y, r, r * 0.66, -0.25, 0, TAU);
  c.fillStyle = radial(c, x - r * 0.3, y - r * 0.3, r * 1.3, [
    [0, '#a8dc6a'],
    [1, '#4f8f2a'],
  ]);
  c.fill();
  ink(c, line);
  for (const dx of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.arc(x + dx * r, y + r * 0.22 - dx * r * 0.12, r * 0.2, 0, TAU);
    c.fillStyle = '#c9ef8c';
    c.fill();
    ink(c, line * 0.6);
  }
  // Leafy stem.
  c.beginPath();
  c.moveTo(x + r * 0.85, y - r * 0.35);
  c.quadraticCurveTo(x + r * 1.1, y - r * 0.85, x + r * 0.7, y - r * 0.95);
  ink(c, line);
  angryEye(c, x - r * 0.3, y - r * 0.2, r * 0.19, -1, line);
  angryEye(c, x + r * 0.22, y - r * 0.28, r * 0.19, 1, line);
}

/** A cherry ice pop on a stick. half: the broken top or bottom piece. */
export function drawPopsicle(c: Ctx, w: number, h: number, half: 0 | 1 | 2 = 0): void {
  const line = 1.7;
  const x = w / 2;
  const top = half === 2 ? h * 0.1 : h * 0.06;
  const bot = half === 1 ? h * 0.62 : h * 0.72;
  if (half !== 1) {
    rrect(c, x - w * 0.09, bot - h * 0.08, w * 0.18, h * 0.3, w * 0.08);
    c.fillStyle = '#e2c590';
    c.fill();
    ink(c, line);
  }
  rrect(c, x - w * 0.36, top, w * 0.72, bot - top, [w * 0.34, w * 0.34, w * 0.12, w * 0.12]);
  c.fillStyle = linear(c, 0, top, 0, bot, [
    [0, '#ff9a86'],
    [1, '#d8423a'],
  ]);
  c.fill();
  ink(c, line);
  c.fillStyle = 'rgba(255,255,255,0.65)';
  rrect(c, x - w * 0.24, top + h * 0.08, w * 0.1, (bot - top) * 0.45, w * 0.05);
  c.fill();
  const ey = half === 2 ? top + (bot - top) * 0.35 : top + (bot - top) * 0.45;
  angryEye(c, x - w * 0.14, ey, w * 0.1, -1, line);
  angryEye(c, x + w * 0.14, ey, w * 0.1, 1, line);
}

/** A tiny fast snowflake sprinkle, ink-outlined with red eyes. */
export function drawSprinkleFlake(c: Ctx, s: number): void {
  const m = s / 2;
  c.save();
  c.translate(m, m);
  c.lineCap = 'round';
  for (const [col, wdt] of [
    [INK, 3.6],
    ['#ffffff', 1.8],
  ] as [string, number][]) {
    c.strokeStyle = col;
    c.lineWidth = wdt;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      c.beginPath();
      c.moveTo(Math.cos(a) * m * 0.85, Math.sin(a) * m * 0.85);
      c.lineTo(-Math.cos(a) * m * 0.85, -Math.sin(a) * m * 0.85);
      c.stroke();
    }
  }
  c.beginPath();
  c.arc(0, 0, m * 0.42, 0, TAU);
  c.fillStyle = '#eaf7ff';
  c.fill();
  ink(c, 1.1);
  c.restore();
  angryEye(c, m - m * 0.18, m, m * 0.13, -1, 0.9);
  angryEye(c, m + m * 0.18, m, m * 0.13, 1, 0.9);
}

/** The Pea Pod's shot: a big bright pea with an ink ring, easy to see on the pale floor. */
export function drawPea(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1.5, 0, TAU);
  c.fillStyle = radial(c, m - 1.5, m - 1.5, m, [
    [0, '#dcff9a'],
    [1, '#4fae22'],
  ]);
  c.fill();
  ink(c, 1.6);
  c.beginPath();
  c.arc(m - m * 0.3, m - m * 0.3, m * 0.22, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
}

/** Warm Mug pickup: a steaming cocoa mug with a warm glow, so it reads as loot. */
export function drawWarmMug(c: Ctx, s: number): void {
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,170,80,0.55)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  const x0 = s * 0.24;
  const y0 = s * 0.38;
  const w = s * 0.42;
  const h = s * 0.42;
  c.beginPath();
  c.arc(x0 + w, y0 + h * 0.45, h * 0.24, -Math.PI / 2, Math.PI / 2);
  ink(c, 2.6, '#c84a2e');
  rrect(c, x0, y0, w, h, 3);
  c.fillStyle = linear(c, 0, y0, 0, y0 + h, [
    [0, '#ff8a5c'],
    [1, '#d2462b'],
  ]);
  c.fill();
  ink(c, 1.4);
  c.fillStyle = '#6b3a1e';
  c.fillRect(x0 + 2, y0 + 1.5, w - 4, 2.5);
  c.fillStyle = '#fff3dc';
  c.beginPath();
  c.arc(x0 + w / 2, y0 + h * 0.6, h * 0.14, 0, TAU);
  c.fill();
  // Steam
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 1.4;
  c.lineCap = 'round';
  for (const dx of [0.3, 0.7]) {
    c.beginPath();
    c.moveTo(x0 + w * dx, y0 - 2);
    c.quadraticCurveTo(x0 + w * dx - 3, y0 - 6, x0 + w * dx, y0 - 9);
    c.quadraticCurveTo(x0 + w * dx + 3, y0 - 12, x0 + w * dx, y0 - 15);
    c.stroke();
  }
}

/** Slippery ice patch (drawn once, scaled per patch). Thick white outline and sparkles so it can't be missed. */
export function drawIcePatch(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  const rx = w / 2 - 4;
  const ry = h / 2 - 4;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fillStyle = linear(c, 0, 0, w, h, [
    [0, 'rgba(235,250,255,0.95)'],
    [0.5, 'rgba(150,215,245,0.9)'],
    [1, 'rgba(110,185,230,0.9)'],
  ]);
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = '#ffffff';
  c.stroke();
  c.lineWidth = 1.5;
  c.strokeStyle = 'rgba(70,130,170,0.6)';
  c.beginPath();
  c.ellipse(x, y, rx + 3, ry + 3, 0, 0, TAU);
  c.stroke();
  // Shine streaks
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - rx * 0.55, y - ry * 0.15);
  c.lineTo(x - rx * 0.15, y - ry * 0.5);
  c.moveTo(x - rx * 0.3, y + ry * 0.15);
  c.lineTo(x + rx * 0.05, y - ry * 0.2);
  c.stroke();
}

/** Four-point twinkle that sits on ice patches. */
export function drawTwinkle(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.moveTo(m, 0);
  c.quadraticCurveTo(m, m, s, m);
  c.quadraticCurveTo(m, m, m, s);
  c.quadraticCurveTo(m, m, 0, m);
  c.quadraticCurveTo(m, m, m, 0);
  c.fillStyle = '#ffffff';
  c.fill();
}

export function drawKnife(c: Ctx, w: number, h: number): void {
  const line = 1.6;
  const my = h / 2;
  // Blade
  c.beginPath();
  c.moveTo(14, my - 4.2);
  c.lineTo(31, my - 3.6);
  c.quadraticCurveTo(38, my - 2, 39, my);
  c.quadraticCurveTo(36, my + 3.6, 31, my + 3.8);
  c.lineTo(14, my + 3.8);
  c.closePath();
  c.fillStyle = linear(c, 0, my - 4, 0, my + 4, [
    [0, '#ffffff'],
    [0.45, '#d9e1e8'],
    [1, '#98a6b2'],
  ]);
  c.fill();
  ink(c, line);
  // Handle
  rrect(c, 1.5, my - 3.6, 13, 7.2, 3);
  c.fillStyle = linear(c, 0, my - 3.6, 0, my + 3.6, [
    [0, '#8a5a34'],
    [1, '#4e2f19'],
  ]);
  c.fill();
  ink(c, line);
  c.fillStyle = '#e8e2d4';
  c.beginPath();
  c.arc(5.5, my, 1, 0, TAU);
  c.arc(10.5, my, 1, 0, TAU);
  c.fill();
  angryEye(c, 27, my + 0.4, 2, 1, 1.2);
}

export function drawAnt(c: Ctx, w: number, h: number): void {
  const my = h / 2;
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  for (const x of [8, 10.5, 13]) {
    c.beginPath();
    c.moveTo(x, my);
    c.lineTo(x - 2.2, 1.2);
    c.moveTo(x, my);
    c.lineTo(x - 2.2, h - 1.2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(17, my - 2);
  c.lineTo(19.4, my - 5);
  c.moveTo(17, my + 2);
  c.lineTo(19.4, my + 5);
  c.stroke();
  const seg = (x: number, r: number) => {
    c.beginPath();
    c.arc(x, my, r, 0, TAU);
    c.fillStyle = radial(c, x, my, r, [
      [0, '#5a4636'],
      [1, '#1c1410'],
    ]);
    c.fill();
    ink(c, 1.1);
  };
  seg(4.6, 3.6);
  seg(10.4, 2.7);
  seg(15.4, 3.1);
  c.fillStyle = '#ff4536';
  c.beginPath();
  c.arc(16.6, my - 1.2, 1, 0, TAU);
  c.arc(16.6, my + 1.2, 1, 0, TAU);
  c.fill();
}

export function drawCroissant(c: Ctx, w: number, h: number): void {
  const segs = [
    { x: 11, y: 37, rx: 8.5, ry: 11, a: -0.7 },
    { x: 61, y: 37, rx: 8.5, ry: 11, a: 0.7 },
    { x: 22.5, y: 26, rx: 9.5, ry: 14, a: -0.35 },
    { x: 49.5, y: 26, rx: 9.5, ry: 14, a: 0.35 },
    { x: 36, y: 22, rx: 11, ry: 16.5, a: 0 },
  ];
  for (const s of segs) {
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.a);
    c.beginPath();
    c.ellipse(0, 0, s.rx, s.ry, 0, 0, TAU);
    c.fillStyle = radial(c, 0, 0, s.ry, [
      [0, '#ffd484'],
      [0.55, '#e09a3a'],
      [1, '#a9601f'],
    ]);
    c.fill();
    ink(c, 2.2);
    // Layer ridge
    c.beginPath();
    c.ellipse(0, s.ry * 0.15, s.rx * 0.7, s.ry * 0.55, 0, Math.PI * 0.15, Math.PI * 0.85);
    c.lineWidth = 1.3;
    c.strokeStyle = 'rgba(122,62,16,0.7)';
    c.stroke();
    c.restore();
  }
  angryEye(c, 30.5, 21, 4.3, -1, 2);
  angryEye(c, 41.5, 21, 4.3, 1, 2);
  c.beginPath();
  c.moveTo(31.5, 30);
  c.quadraticCurveTo(36, 27, 40.5, 30);
  ink(c, 1.8);
}

export function drawToaster(c: Ctx, w: number, h: number): void {
  // Toast peeking out of the slots
  for (const x of [21, 47]) {
    rrect(c, x, 3, 16, 14, [5, 5, 1, 1]);
    c.fillStyle = linear(c, 0, 3, 0, 16, [
      [0, '#e6a75a'],
      [1, '#9b5a22'],
    ]);
    c.fill();
    ink(c, 2);
  }
  // Body
  rrect(c, 5, 13, 74, 56, 15);
  c.fillStyle = linear(c, 5, 13, 79, 69, [
    [0, '#f2f6f9'],
    [0.45, '#b8c3cc'],
    [1, '#727f8a'],
  ]);
  c.fill();
  ink(c, 3);
  // Shine
  rrect(c, 11, 17, 34, 7, 3.5);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fill();
  // Slots
  for (const x of [19, 45]) {
    rrect(c, x, 11, 20, 6, 3);
    c.fillStyle = '#2a2320';
    c.fill();
    ink(c, 1.6);
  }
  // Lever
  rrect(c, 76, 30, 7, 16, 3);
  c.fillStyle = '#3b3532';
  c.fill();
  ink(c, 1.6);
  // Glow behind the eyes
  for (const x of [30, 54]) {
    c.beginPath();
    c.arc(x, 41, 10, 0, TAU);
    c.fillStyle = 'rgba(255,90,40,0.25)';
    c.fill();
  }
  angryEye(c, 30, 41, 6.2, -1, 2.6, '#ff3b1f');
  angryEye(c, 54, 41, 6.2, 1, 2.6, '#ff3b1f');
  // Gritted grin
  rrect(c, 30, 52, 24, 8, 3);
  c.fillStyle = '#fff7ea';
  c.fill();
  ink(c, 2);
  c.beginPath();
  for (const x of [36, 42, 48]) {
    c.moveTo(x, 52);
    c.lineTo(x, 60);
  }
  c.moveTo(30, 56);
  c.lineTo(54, 56);
  ink(c, 1.3);
}

// ---------- Player projectiles ----------
export function drawSesame(c: Ctx, x: number, y: number, rx: number, ry: number, fire = false): void {
  if (fire) {
    c.beginPath();
    c.arc(x, y, rx * 1.35, 0, TAU);
    c.fillStyle = 'rgba(255,120,40,0.35)';
    c.fill();
  }
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fillStyle = fire
    ? radial(c, x, y, rx, [
        [0, '#fff6c8'],
        [0.5, '#ffbe3a'],
        [1, '#ff6a1f'],
      ])
    : radial(c, x, y, rx, [
        [0, '#ffffff'],
        [0.6, '#fbefcf'],
        [1, '#d9bf86'],
      ]);
  c.fill();
  ink(c, Math.max(1, ry * 0.42), fire ? '#7a2a08' : '#6b4a22');
}

export function drawPuddle(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1, 0, TAU);
  c.fillStyle = 'rgba(253,250,242,0.45)';
  c.fill();
  c.beginPath();
  c.arc(m, m, m * 0.8, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.fill();
  c.beginPath();
  c.arc(m, m, m - 2, 0, TAU);
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(214,200,170,0.7)';
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, r] of [
    [0.36, 0.34, 0.11],
    [0.64, 0.58, 0.07],
    [0.45, 0.66, 0.05],
  ]) {
    c.beginPath();
    c.arc(s * x, s * y, s * r, 0, TAU);
    c.fill();
  }
}

export function drawLox(c: Ctx, w: number, h: number): void {
  c.beginPath();
  c.ellipse(w / 2, h / 2, w / 2 - 1.5, h / 2 - 1.5, 0, 0, TAU);
  c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
    [0, '#ffb79c'],
    [0.6, '#f0805f'],
    [1, '#c8553a'],
  ]);
  c.fill();
  ink(c, 1.5);
  c.strokeStyle = 'rgba(255,240,230,0.9)';
  c.lineWidth = 1.2;
  for (const x of [0.25, 0.42, 0.59, 0.76]) {
    c.beginPath();
    c.moveTo(w * x - 1, h * 0.25);
    c.quadraticCurveTo(w * x + 1.5, h / 2, w * x, h * 0.78);
    c.stroke();
  }
}

export function drawPin(c: Ctx, w: number, h: number): void {
  for (const x of [1, w - 11]) {
    rrect(c, x, h / 2 - 3, 10, 6, 3);
    c.fillStyle = '#7a4a24';
    c.fill();
    ink(c, 1.4);
  }
  rrect(c, 9, 1.5, w - 18, h - 3, 6);
  c.fillStyle = linear(c, 0, 1.5, 0, h - 1.5, [
    [0, '#ecc28e'],
    [0.5, '#c8925a'],
    [1, '#9a6a3a'],
  ]);
  c.fill();
  ink(c, 1.6);
  rrect(c, 12, 3.5, w - 24, 3, 1.5);
  c.fillStyle = 'rgba(255,240,215,0.7)';
  c.fill();
}

export function drawDrop(c: Ctx, x: number, y: number, r: number, base: string, hi: string): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = radial(c, x, y, r, [
    [0, hi],
    [1, base],
  ]);
  c.fill();
  ink(c, Math.max(0.8, r * 0.25));
}

// ---------- Enemy projectiles ----------
export function drawFlake(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.moveTo(m, 1);
  c.lineTo(s - 1, m);
  c.lineTo(m, s - 1);
  c.lineTo(1, m);
  c.closePath();
  c.fillStyle = radial(c, m, m, m, [
    [0, '#ffd88a'],
    [1, '#c97a24'],
  ]);
  c.fill();
  ink(c, 1.2);
}

export function drawToast(c: Ctx, s: number): void {
  rrect(c, 1.5, 1.5, s - 3, s - 3, 5);
  c.fillStyle = '#8a4c1c';
  c.fill();
  ink(c, 1.4);
  rrect(c, 3.5, 3.5, s - 7, s - 7, 3);
  c.fillStyle = radial(c, s / 2, s / 2, s / 2, [
    [0, '#ffb15a'],
    [0.6, '#e09a52'],
    [1, '#c27b3a'],
  ]);
  c.fill();
  c.beginPath();
  c.arc(s / 2, s / 2, s * 0.17, 0, TAU);
  c.fillStyle = 'rgba(255,90,30,0.7)';
  c.fill();
}

// ---------- Pickups ----------
/** XP seed: bright, glowing, thin outline. Loot never uses the enemies' heavy ink. */
export function drawGem(c: Ctx, s: number, w: number, col: string, hi: string, edge: string): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 0.5, 0, TAU);
  const glow = c.createRadialGradient(m, m, 0, m, m, m);
  glow.addColorStop(0, col + 'aa');
  glow.addColorStop(1, col + '00');
  c.fillStyle = glow;
  c.fill();
  c.save();
  c.translate(m, m);
  c.rotate(-0.5);
  c.beginPath();
  c.ellipse(0, 0, w * 0.34, w * 0.52, 0, 0, TAU);
  c.fillStyle = radial(c, 0, 0, w * 0.5, [
    [0, hi],
    [0.55, col],
    [1, col],
  ]);
  c.fill();
  ink(c, 0.9, edge);
  c.beginPath();
  c.ellipse(-w * 0.1, -w * 0.18, w * 0.09, w * 0.16, 0, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
  c.restore();
}

export function drawCoin(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1, 0, TAU);
  c.fillStyle = radial(c, m, m, m, [
    [0, '#fff0a8'],
    [0.6, '#f2c14e'],
    [1, '#c58f22'],
  ]);
  c.fill();
  ink(c, 1.1, '#6b4810');
  c.beginPath();
  c.arc(m, m, m * 0.42, 0, TAU);
  c.moveTo(m + m * 0.14, m);
  c.arc(m, m, m * 0.14, 0, TAU, true);
  c.fillStyle = '#d9a43a';
  c.fill('evenodd');
}

export function drawHeal(c: Ctx, s: number): void {
  // A little cream cheese tub with a red cross: food that heals.
  rrect(c, 2.5, 5, s - 5, s - 7, 3.5);
  c.fillStyle = linear(c, 0, 5, 0, s - 2, [
    [0, '#ffffff'],
    [1, '#cfe0ee'],
  ]);
  c.fill();
  ink(c, 1.2, '#3b4a58');
  rrect(c, 1.5, 2.5, s - 3, 4.5, 2);
  c.fillStyle = '#7fb3e0';
  c.fill();
  ink(c, 1.2, '#3b4a58');
  c.fillStyle = '#e0453a';
  c.fillRect(s / 2 - 1.3, 8.5, 2.6, 7);
  c.fillRect(s / 2 - 3.5, 10.7, 7, 2.6);
}

export function drawMine(c: Ctx, s: number): void {
  const m = s / 2;
  c.save();
  c.translate(m, m);
  c.rotate(-0.4);
  c.beginPath();
  c.ellipse(0, 0, s * 0.34, s * 0.22, 0, 0, TAU);
  c.fillStyle = radial(c, 0, 0, s * 0.34, [
    [0, '#5a6890'],
    [1, '#1b1f2e'],
  ]);
  c.fill();
  ink(c, 0.8, '#0b0d14');
  c.restore();
}


// ---------- M8 player projectiles (thin warm outlines, like the other player shots) ----------
const PLINE = '#6b4a22';

/** Butter knife: a rounded silver blade with a smear of butter. Light and friendly, unlike the Stale's dark knives. */
export function drawButterKnife(c: Ctx, w: number, h: number): void {
  const m = h / 2;
  rrect(c, 1, m - 2.2, 11, 4.4, 2.2);
  c.fillStyle = linear(c, 0, m - 2, 0, m + 2, [
    [0, '#f8e6c4'],
    [1, '#d6b27a'],
  ]);
  c.fill();
  ink(c, 1, PLINE);
  c.beginPath();
  c.moveTo(11, m - 2.6);
  c.lineTo(w - 6, m - 3.4);
  c.quadraticCurveTo(w - 0.8, m - 1.5, w - 1.5, m + 1.2);
  c.quadraticCurveTo(w - 4, m + 3.4, w - 9, m + 3);
  c.lineTo(11, m + 2.6);
  c.closePath();
  c.fillStyle = linear(c, 0, m - 3.4, 0, m + 3.4, [
    [0, '#ffffff'],
    [0.45, '#dfe7ef'],
    [1, '#9aa8b8'],
  ]);
  c.fill();
  ink(c, 1, PLINE);
  c.beginPath();
  c.ellipse(w - 10, m - 0.6, 5, 1.8, -0.05, 0, TAU);
  c.fillStyle = '#ffe680';
  c.fill();
  c.beginPath();
  c.ellipse(w - 11.5, m - 1.2, 1.8, 0.7, 0, 0, TAU);
  c.fillStyle = '#fffbe0';
  c.fill();
}

/** Grape jam jar with a gingham lid (purple, so it never reads as the pink melt puddles that slow you). */
export function drawJamJar(c: Ctx, w: number, h: number): void {
  rrect(c, 2, 5.5, w - 4, h - 7, 4);
  c.fillStyle = radial(c, w / 2, h * 0.6, w / 2, [
    [0, '#b98ae0'],
    [0.6, '#7d3fb4'],
    [1, '#4f2380'],
  ]);
  c.fill();
  ink(c, 1.1, '#2e1450');
  rrect(c, 4, 8, 2.2, h - 13, 1.1);
  c.fillStyle = 'rgba(255,255,255,0.65)';
  c.fill();
  rrect(c, 1, 1.5, w - 2, 5, 2);
  c.fillStyle = '#fbf3e2';
  c.fill();
  c.fillStyle = '#e0533d';
  for (let x = 2.5; x < w - 2; x += 3.2) c.fillRect(x, 2, 1.6, 1.8), c.fillRect(x + 1.6, 3.9, 1.6, 1.8);
  rrect(c, 1, 1.5, w - 2, 5, 2);
  ink(c, 1, '#2e1450');
}

/** Golden buttered toast, much lighter than the Toaster Tyrant's burnt shots. */
export function drawPlayerToast(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.moveTo(2, s - 2);
  c.lineTo(2, m - 1);
  c.bezierCurveTo(1, 1, s - 1, 1, s - 2, m - 1);
  c.lineTo(s - 2, s - 2);
  c.closePath();
  c.fillStyle = '#c98a45';
  c.fill();
  ink(c, 1.1, PLINE);
  c.beginPath();
  c.moveTo(4, s - 4);
  c.lineTo(4, m - 0.5);
  c.bezierCurveTo(3.4, 3.6, s - 3.4, 3.6, s - 4, m - 0.5);
  c.lineTo(s - 4, s - 4);
  c.closePath();
  c.fillStyle = radial(c, m, m, m, [
    [0, '#fff0bf'],
    [0.7, '#f6d38c'],
    [1, '#e9b66a'],
  ]);
  c.fill();
  rrect(c, m - 3, m - 1.5, 6, 5, 1.4);
  c.fillStyle = '#fff2a0';
  c.fill();
  ink(c, 0.8, '#c99a2a');
}

/** Sticky jam pool (128 × 128, scaled to size). */
export function drawJamPool(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1, 0, TAU);
  c.fillStyle = 'rgba(120,52,180,0.42)';
  c.fill();
  c.beginPath();
  c.arc(m, m, m * 0.78, 0, TAU);
  c.fillStyle = 'rgba(150,84,210,0.4)';
  c.fill();
  c.beginPath();
  c.arc(m, m, m - 2, 0, TAU);
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(70,24,120,0.75)';
  c.stroke();
  c.fillStyle = 'rgba(222,196,250,0.75)';
  for (const [x, y, r] of [
    [0.35, 0.33, 0.1],
    [0.63, 0.6, 0.06],
    [0.44, 0.68, 0.045],
  ]) {
    c.beginPath();
    c.arc(s * x, s * y, s * r, 0, TAU);
    c.fill();
  }
  const rand = rng(7);
  c.fillStyle = 'rgba(40,10,70,0.6)';
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    const d = rand() * m * 0.75;
    c.beginPath();
    c.ellipse(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.6, 1, a, 0, TAU);
    c.fill();
  }
}

/** Waffle Smash footprint: a round golden waffle grid (128 × 128). */
export function drawStamp(c: Ctx, s: number): void {
  const m = s / 2;
  c.save();
  c.beginPath();
  c.arc(m, m, m - 2, 0, TAU);
  c.clip();
  c.fillStyle = 'rgba(244,196,110,0.55)';
  c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(160,98,36,0.75)';
  c.lineWidth = 5;
  for (let k = s / 8; k < s; k += s / 8) {
    c.beginPath();
    c.moveTo(k, 0);
    c.lineTo(k, s);
    c.moveTo(0, k);
    c.lineTo(s, k);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.arc(m, m, m - 3, 0, TAU);
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(168,106,42,0.9)';
  c.stroke();
}

/** Belgian Slam shockwave ring (128 × 128). */
export function drawShock(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 5, 0, TAU);
  c.lineWidth = 7;
  c.strokeStyle = 'rgba(255,236,190,0.95)';
  c.stroke();
  c.beginPath();
  c.arc(m, m, m - 1.5, 0, TAU);
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(242,184,75,0.9)';
  c.stroke();
}

// ---------- Hit sparks (drawn white, tinted per weapon) ----------
export function drawStar4(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? m * 0.28 : m - 0.5;
    const a = (i / 8) * TAU;
    c.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
}
export function drawStreak(c: Ctx, w: number, h: number): void {
  c.beginPath();
  c.ellipse(w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.5, 0, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
}
export function drawChip(c: Ctx, w: number, h: number): void {
  rrect(c, 1, 1, w - 2, h - 2, 1.2);
  c.fillStyle = '#e9c38e';
  c.fill();
  ink(c, 1, PLINE);
}
export function drawHitRing(c: Ctx, s: number): void {
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2 - 2, 0, TAU);
  c.lineWidth = 2.5;
  c.strokeStyle = '#ffffff';
  c.stroke();
}

// ---------- Upgrade icons (36 × 36) ----------
const IL = 1.7; // icon ink width
function fillInk(c: Ctx, fill: string | CanvasGradient, w = IL): void {
  c.fillStyle = fill;
  c.fill();
  ink(c, w);
}
export const ICONS: Record<string, (c: Ctx) => void> = {
  ic_knife: (c) => {
    c.save();
    c.translate(18, 18);
    c.rotate(-0.75);
    c.scale(1.05, 1.6);
    c.translate(-16, -5);
    drawButterKnife(c, 32, 10);
    c.restore();
  },
  ic_jar: (c) => {
    c.save();
    c.translate(18, 18);
    c.rotate(0.15);
    c.scale(1.45, 1.45);
    c.translate(-8, -10);
    drawJamJar(c, 16, 20);
    c.restore();
  },
  ic_toastpop: (c) => {
    rrect(c, 6, 20, 24, 12, 4);
    fillInk(c, linear(c, 0, 20, 0, 32, [[0, '#dfe7ef'], [1, '#8a98a8']]));
    c.save();
    c.translate(18, 13);
    c.scale(1.05, 1.05);
    c.translate(-9, -9);
    drawPlayerToast(c, 18);
    c.restore();
    c.strokeStyle = '#fff3dc';
    c.lineWidth = 1.6;
    for (const x of [6, 30]) {
      c.beginPath();
      c.moveTo(x, 12);
      c.lineTo(x + (x < 18 ? -2 : 2), 7);
      c.stroke();
    }
  },
  ic_iron: (c) => {
    rrect(c, 5, 5, 26, 26, 6);
    fillInk(c, radial(c, 18, 18, 14, [[0, '#ffd88e'], [1, '#d08a3a']]));
    c.strokeStyle = 'rgba(150,90,30,0.85)';
    c.lineWidth = 2;
    for (const k of [11.5, 18, 24.5]) {
      c.beginPath();
      c.moveTo(k, 7);
      c.lineTo(k, 29);
      c.moveTo(7, k);
      c.lineTo(29, k);
      c.stroke();
    }
  },
  ic_honey: (c) => {
    c.beginPath();
    c.moveTo(18, 5);
    c.bezierCurveTo(26, 15, 29, 21, 27, 25);
    c.arc(18, 24, 9, 0.1, Math.PI - 0.1);
    c.bezierCurveTo(7, 21, 10, 15, 18, 5);
    fillInk(c, radial(c, 18, 21, 11, [[0, '#ffe58a'], [0.6, '#f2b84b'], [1, '#c98418']]));
    c.beginPath();
    c.ellipse(14.5, 20, 2.2, 3.5, 0.3, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fill();
  },
  ic_jam: (c) => {
    c.beginPath();
    c.ellipse(18, 24, 13, 7, 0, 0, TAU);
    fillInk(c, radial(c, 18, 24, 13, [[0, '#b98ae0'], [1, '#5a2890']]));
    c.beginPath();
    c.arc(18, 14, 7, 0, TAU);
    fillInk(c, radial(c, 18, 14, 7, [[0, '#c9a0ea'], [1, '#6d34a8']]));
    c.beginPath();
    c.ellipse(15.5, 12, 2, 1.3, -0.4, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fill();
  },
  ic_seasoning: (c) => {
    c.beginPath();
    c.ellipse(18, 25, 13, 6, 0, 0, TAU);
    fillInk(c, '#7a4a24');
    const r = rng(11);
    const cols = ['#fbf3dc', '#2a1f1a', '#f0dca2', '#6b4422', '#ffffff'];
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU;
      const d = r();
      c.beginPath();
      c.ellipse(18 + Math.cos(a) * d * 11, 21 + Math.sin(a) * d * 6 - (1 - d) * 6, 1.7, 1, a, 0, TAU);
      c.fillStyle = cols[i % cols.length];
      c.fill();
    }
  },
  ic_frosting: (c) => {
    for (const [y, rx] of [[26, 12], [19, 9], [13, 6]] as const) {
      c.beginPath();
      c.ellipse(18, y, rx, 5, 0, 0, TAU);
      fillInk(c, radial(c, 18, y, rx, [[0, '#ffffff'], [1, '#e6ddc8']]));
    }
    c.beginPath();
    c.moveTo(16, 9);
    c.quadraticCurveTo(18, 3, 21, 6);
    ink(c, IL);
  },
  ic_sesame: (c) => {
    for (const [x, y, k] of [
      [12, 13, 1],
      [23, 18, 0.9],
      [14, 25, 0.8],
    ] as const)
      drawSesame(c, x, y, 5.6 * k, 3.6 * k);
  },
  ic_storm: (c) => {
    c.beginPath();
    c.arc(18, 18, 11.5, 0, TAU);
    c.setLineDash([3, 3]);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,244,214,0.6)';
    c.stroke();
    c.setLineDash([]);
    drawBagel(c, 18, 18, 5.5, { base: '#e3a24c', crust: '#b0642a', hi: '#f8d38c' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - 0.4;
      drawSesame(c, 18 + Math.cos(a) * 11.5, 18 + Math.sin(a) * 11.5, 4.2, 2.7);
    }
  },
  ic_puddle: (c) => {
    c.beginPath();
    c.ellipse(18, 22, 14, 8, 0, 0, TAU);
    fillInk(c, radial(c, 18, 22, 14, [[0, '#ffffff'], [1, '#e6ddc8']]));
    c.beginPath();
    c.ellipse(13, 20, 4.5, 2.2, 0, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
  },
  ic_lox: (c) => {
    c.save();
    c.translate(3, 9);
    drawLox(c, 30, 18);
    c.restore();
  },
  ic_coffee: (c) => {
    c.beginPath();
    c.arc(27, 20, 4.5, -Math.PI / 2, Math.PI / 2);
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 2.5;
    c.strokeStyle = '#ffffff';
    c.stroke();
    rrect(c, 7, 11, 19, 19, [3, 3, 6, 6]);
    fillInk(c, linear(c, 7, 0, 26, 0, [[0, '#ffffff'], [1, '#d8dde2']]));
    c.beginPath();
    c.ellipse(16.5, 13.5, 8, 2.4, 0, 0, TAU);
    c.fillStyle = '#6b3b1d';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(13, 9);
    c.quadraticCurveTo(11, 7, 13.5, 4.5);
    c.moveTo(19, 9);
    c.quadraticCurveTo(17, 7, 19.5, 4.5);
    c.stroke();
  },
  ic_pin: (c) => {
    c.save();
    c.translate(18, 18);
    c.rotate(-0.6);
    c.translate(-20, -8);
    drawPin(c, 40, 16);
    c.restore();
  },
  ic_butter: (c) => {
    c.beginPath();
    c.moveTo(6, 15);
    c.lineTo(12, 10);
    c.lineTo(31, 10);
    c.lineTo(31, 22);
    c.lineTo(25, 27);
    c.lineTo(6, 27);
    c.closePath();
    fillInk(c, '#e6b83c');
    rrect(c, 6, 15, 19, 12, 1);
    fillInk(c, linear(c, 0, 15, 0, 27, [[0, '#ffe58a'], [1, '#f0c64a']]));
  },
  ic_dough: (c) => {
    c.beginPath();
    c.ellipse(18, 21, 13.5, 9, 0, 0, TAU);
    fillInk(c, radial(c, 18, 21, 13.5, [[0, '#fff4df'], [1, '#e2c798']]));
    c.beginPath();
    c.ellipse(14, 18, 5, 2.5, -0.2, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fill();
  },
  ic_caffeine: (c) => {
    c.beginPath();
    c.ellipse(18, 18, 9, 13, 0.3, 0, TAU);
    fillInk(c, radial(c, 18, 18, 13, [[0, '#8a5530'], [1, '#4a2a12']]));
    c.beginPath();
    c.moveTo(14, 7.5);
    c.bezierCurveTo(21, 14, 15, 22, 22, 28.5);
    ink(c, 2, '#2a1608');
  },
  ic_oven: (c) => {
    c.beginPath();
    c.moveTo(18, 3);
    c.bezierCurveTo(26, 12, 30, 18, 28, 25);
    c.bezierCurveTo(26, 32, 10, 32, 8, 25);
    c.bezierCurveTo(6, 18, 12, 14, 18, 3);
    fillInk(c, linear(c, 0, 3, 0, 32, [[0, '#ff7a3a'], [1, '#e0402d']]));
    c.beginPath();
    c.moveTo(18, 14);
    c.bezierCurveTo(23, 20, 24, 24, 22, 27);
    c.bezierCurveTo(20, 30, 16, 30, 14, 27);
    c.bezierCurveTo(12, 24, 14, 20, 18, 14);
    c.fillStyle = '#ffd24a';
    c.fill();
  },
  ic_salt: (c) => {
    for (const [x, y, s] of [
      [8, 8, 8],
      [20, 13, 7],
      [11, 21, 9],
    ] as const) {
      c.save();
      c.translate(x + s / 2, y + s / 2);
      c.rotate(0.3);
      rrect(c, -s / 2, -s / 2, s, s, 1.5);
      fillInk(c, linear(c, -s / 2, -s / 2, s / 2, s / 2, [[0, '#ffffff'], [1, '#cfe6f2']]), 1.4);
      c.restore();
    }
  },
  ic_glaze: (c) => {
    c.beginPath();
    c.moveTo(18, 4);
    c.bezierCurveTo(23, 12, 28, 17, 28, 22);
    c.bezierCurveTo(28, 28, 23, 32, 18, 32);
    c.bezierCurveTo(13, 32, 8, 28, 8, 22);
    c.bezierCurveTo(8, 17, 13, 12, 18, 4);
    fillInk(c, radial(c, 18, 22, 11, [[0, '#ffd0e0'], [1, '#ff7fa8']]));
    c.beginPath();
    c.ellipse(14.5, 21, 2.5, 4, -0.3, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
  },
  ic_heal: (c) => {
    c.save();
    c.translate(-1, 0);
    c.scale(2, 2);
    drawHeal(c, 18);
    c.restore();
  },
  ic_coin: (c) => {
    c.save();
    c.translate(4, 4);
    c.scale(2, 2);
    drawCoin(c, 14);
    c.restore();
  },
};

// ---------- Bakery upgrades and small UI glyphs (36×36, same style as the upgrade icons) ----------
export const UI_ICONS: Record<string, (c: Ctx) => void> = {
  // Thicker Crust: a bread slice with an extra-thick crust.
  ic_bk_crust: (c) => {
    c.beginPath();
    c.moveTo(7, 31);
    c.lineTo(7, 15);
    c.bezierCurveTo(2, 13, 3, 4, 11, 4);
    c.bezierCurveTo(14, 2, 22, 2, 25, 4);
    c.bezierCurveTo(33, 4, 34, 13, 29, 15);
    c.lineTo(29, 31);
    c.closePath();
    fillInk(c, linear(c, 0, 2, 0, 31, [[0, '#c9772f'], [1, '#8c4a1c']]));
    c.beginPath();
    c.moveTo(11.5, 28);
    c.lineTo(11.5, 15.5);
    c.bezierCurveTo(8, 13.5, 9, 8.5, 13, 8.5);
    c.bezierCurveTo(15.5, 7, 20.5, 7, 23, 8.5);
    c.bezierCurveTo(27, 8.5, 28, 13.5, 24.5, 15.5);
    c.lineTo(24.5, 28);
    c.closePath();
    c.fillStyle = linear(c, 0, 7, 0, 28, [[0, '#fff1d0'], [1, '#f1d29a']]);
    c.fill();
    c.beginPath();
    c.ellipse(15, 13, 3, 1.6, -0.3, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
  },
  // Hotter Oven: an oven door with a glowing window.
  ic_bk_oven: (c) => {
    rrect(c, 4, 6, 28, 26, 5);
    fillInk(c, linear(c, 0, 6, 0, 32, [[0, '#9aa6b0'], [1, '#5d6973']]));
    for (const x of [10, 18, 26]) {
      c.beginPath();
      c.arc(x, 10.5, 2, 0, TAU);
      c.fillStyle = '#2f3840';
      c.fill();
    }
    rrect(c, 8, 15, 20, 13, 3);
    fillInk(c, radial(c, 18, 22, 12, [[0, '#ffe066'], [0.6, '#ff8a2a'], [1, '#c8381c']]), 1.6);
    c.beginPath();
    c.moveTo(14, 26);
    c.quadraticCurveTo(13, 21, 16, 18.5);
    c.quadraticCurveTo(16.5, 22, 18.5, 22.5);
    c.quadraticCurveTo(20, 20, 20, 18);
    c.quadraticCurveTo(24, 22, 22, 26);
    c.closePath();
    c.fillStyle = '#fff4c2';
    c.fill();
  },
  // Quick Rise: a dough ball lifting off with speed lines.
  ic_bk_rise: (c) => {
    c.strokeStyle = 'rgba(255,244,214,0.8)';
    c.lineWidth = 2.2;
    for (const [x, l] of [[11, 7], [18, 9], [25, 7]] as const) {
      c.beginPath();
      c.moveTo(x, 27);
      c.lineTo(x, 27 + l * 0.6);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(5, 24);
    c.bezierCurveTo(4, 10, 12, 4, 18, 4);
    c.bezierCurveTo(24, 4, 32, 10, 31, 24);
    c.quadraticCurveTo(18, 28, 5, 24);
    fillInk(c, radial(c, 18, 16, 14, [[0, '#fff4df'], [1, '#e2c798']]));
    c.beginPath();
    c.ellipse(13, 11, 4, 2.2, -0.5, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
    c.beginPath();
    c.moveTo(18, 9);
    c.lineTo(23, 15);
    c.lineTo(20, 15);
    c.lineTo(20, 20);
    c.lineTo(16, 20);
    c.lineTo(16, 15);
    c.lineTo(13, 15);
    c.closePath();
    fillInk(c, '#7fbf4d', 1.4);
  },
  // Sticky Seeds: a sesame seed dripping honey.
  ic_bk_sticky: (c) => {
    c.save();
    c.translate(17, 13);
    c.rotate(-0.5);
    c.beginPath();
    c.ellipse(0, 0, 11, 7, 0, 0, TAU);
    fillInk(c, radial(c, 0, 0, 11, [[0, '#fffaf0'], [1, '#e9d9b4']]));
    c.restore();
    c.beginPath();
    c.moveTo(9, 15);
    c.bezierCurveTo(12, 20, 19, 21, 25, 15);
    c.bezierCurveTo(26, 19, 24, 21, 23, 24);
    c.bezierCurveTo(22, 30, 18, 30, 18, 25);
    c.bezierCurveTo(18, 22, 14, 23, 13, 26);
    c.bezierCurveTo(11, 29, 8, 26, 9, 22);
    c.closePath();
    fillInk(c, linear(c, 0, 14, 0, 30, [[0, '#ffcf4a'], [1, '#e58a12']]), 1.6);
    c.beginPath();
    c.ellipse(21.5, 26.5, 1.2, 1.8, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fill();
  },
  // Lucky Seed: a sesame seed with a four-leaf sprout.
  ic_bk_luck: (c) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      c.beginPath();
      c.ellipse(18 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 5.5, 4, a, 0, TAU);
      fillInk(c, radial(c, 18 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 6, [[0, '#b6ec7a'], [1, '#5fa83a']]), 1.6);
    }
    c.beginPath();
    c.moveTo(18, 14);
    c.quadraticCurveTo(19, 21, 17, 24);
    c.lineWidth = 2;
    c.strokeStyle = '#3f7a28';
    c.stroke();
    c.beginPath();
    c.ellipse(17, 27, 7, 4.2, -0.2, 0, TAU);
    fillInk(c, radial(c, 17, 27, 7, [[0, '#fffaf0'], [1, '#e9d9b4']]), 1.6);
  },
  // Reroll Rack: two dice.
  ic_bk_reroll: (c) => {
    const die = (x: number, y: number, a: number, pips: [number, number][]) => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      rrect(c, -7.5, -7.5, 15, 15, 4);
      fillInk(c, linear(c, 0, -8, 0, 8, [[0, '#fffaf0'], [1, '#e2d2ae']]), 1.8);
      c.fillStyle = INK;
      for (const [px, py] of pips) {
        c.beginPath();
        c.arc(px, py, 1.7, 0, TAU);
        c.fill();
      }
      c.restore();
    };
    die(12, 21, -0.25, [[-3.5, -3.5], [0, 0], [3.5, 3.5]]);
    die(23, 14, 0.3, [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]);
  },
  // Second Bake: a bagel with a curved "again" arrow.
  ic_bk_revive: (c) => {
    c.beginPath();
    c.arc(18, 19, 10, 0, TAU);
    c.arc(18, 19, 3.5, 0, TAU, true);
    fillInk(c, radial(c, 18, 19, 10, [[0, '#f8d38c'], [1, '#b0642a']]), 1.8);
    c.beginPath();
    c.arc(18, 19, 14.5, -Math.PI * 0.95, -Math.PI * 0.15);
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 2.8;
    c.strokeStyle = '#7fbf4d';
    c.stroke();
    const ax = 18 + Math.cos(-Math.PI * 0.15) * 14.5;
    const ay = 19 + Math.sin(-Math.PI * 0.15) * 14.5;
    c.beginPath();
    c.moveTo(ax + 4, ay - 4);
    c.lineTo(ax + 1, ay + 5);
    c.lineTo(ax - 6, ay - 1);
    c.closePath();
    fillInk(c, '#7fbf4d', 1.4);
  },
  // Hard Crust: a crusty shield.
  ic_bk_armor: (c) => {
    c.beginPath();
    c.moveTo(18, 4);
    c.lineTo(29, 9);
    c.quadraticCurveTo(29, 25, 18, 32);
    c.quadraticCurveTo(7, 25, 7, 9);
    c.closePath();
    fillInk(c, linear(c, 0, 4, 0, 32, [[0, '#e6a75a'], [1, '#8a4c1c']]), 2);
    c.beginPath();
    c.moveTo(18, 9);
    c.lineTo(24.5, 12);
    c.quadraticCurveTo(24.5, 23, 18, 27.5);
    c.quadraticCurveTo(11.5, 23, 11.5, 12);
    c.closePath();
    c.fillStyle = '#f6d9a2';
    c.fill();
  },
  ic_lock: (c) => {
    c.beginPath();
    c.arc(18, 15, 7.5, Math.PI, 0);
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = '#c9d2d9';
    c.stroke();
    rrect(c, 7, 15, 22, 17, 4);
    fillInk(c, linear(c, 0, 15, 0, 32, [[0, '#ffd45a'], [1, '#d69416']]));
    c.beginPath();
    c.arc(18, 22, 2.6, 0, TAU);
    c.rect(17, 22, 2, 5);
    c.fillStyle = INK;
    c.fill();
  },
  ic_clock: (c) => {
    c.beginPath();
    c.arc(18, 19, 13, 0, TAU);
    fillInk(c, radial(c, 18, 19, 13, [[0, '#ffffff'], [1, '#e6dccb']]));
    c.beginPath();
    c.moveTo(18, 19);
    c.lineTo(18, 11);
    c.moveTo(18, 19);
    c.lineTo(23.5, 22);
    ink(c, 2.6);
    rrect(c, 15, 2.5, 6, 4, 1.5);
    fillInk(c, '#e0533d', 1.4);
  },
  ic_crown: (c) => {
    c.beginPath();
    c.moveTo(5, 28);
    c.lineTo(4, 11);
    c.lineTo(12, 18);
    c.lineTo(18, 7);
    c.lineTo(24, 18);
    c.lineTo(32, 11);
    c.lineTo(31, 28);
    c.closePath();
    fillInk(c, linear(c, 0, 7, 0, 28, [[0, '#fff0a0'], [0.5, '#ffc93a'], [1, '#d08a10']]));
    for (const [x, y] of [[4, 11], [18, 7], [32, 11]] as const) {
      c.beginPath();
      c.arc(x, y, 2.6, 0, TAU);
      fillInk(c, '#ff6b6b', 1.3);
    }
  },
  ic_book: (c) => {
    rrect(c, 6, 5, 24, 27, 3);
    fillInk(c, linear(c, 6, 0, 30, 0, [[0, '#d65a4a'], [1, '#a83a2e']]));
    rrect(c, 9, 27, 21, 3.5, 1);
    c.fillStyle = '#fff3dc';
    c.fill();
    c.beginPath();
    c.arc(19.5, 16, 5.5, 0, TAU);
    c.moveTo(21.5, 16);
    c.arc(19.5, 16, 2, 0, TAU, true);
    c.fillStyle = '#f2b84b';
    c.fill('evenodd');
  },
  ic_bolt: (c) => {
    c.beginPath();
    c.moveTo(21, 3);
    c.lineTo(8, 20);
    c.lineTo(17, 20);
    c.lineTo(14, 33);
    c.lineTo(28, 15);
    c.lineTo(19, 15);
    c.closePath();
    fillInk(c, linear(c, 0, 3, 0, 33, [[0, '#fff3a0'], [1, '#f2a516']]), 2);
  },
  ic_star: (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? 6.5 : 15;
      if (i) c.lineTo(18 + Math.cos(a) * r, 19 + Math.sin(a) * r);
      else c.moveTo(18 + Math.cos(a) * r, 19 + Math.sin(a) * r);
    }
    c.closePath();
    fillInk(c, linear(c, 0, 4, 0, 34, [[0, '#fff3a0'], [1, '#f0a818']]));
  },
  // Difficulty pip on the stage cards.
  ic_flame: (c) => {
    c.beginPath();
    c.moveTo(18, 3);
    c.bezierCurveTo(22, 11, 30, 15, 30, 23);
    c.bezierCurveTo(30, 30, 24, 34, 18, 34);
    c.bezierCurveTo(12, 34, 6, 30, 6, 23);
    c.bezierCurveTo(6, 17, 11, 15, 12, 9);
    c.bezierCurveTo(15, 12, 16, 15, 16, 18);
    c.bezierCurveTo(19, 14, 19, 8, 18, 3);
    c.closePath();
    fillInk(c, linear(c, 0, 3, 0, 34, [[0, '#ffd36a'], [0.6, '#f07a2a'], [1, '#d6452a']]), 2);
    c.beginPath();
    c.ellipse(18, 27, 4.5, 5.5, 0, 0, TAU);
    c.fillStyle = '#fff1b0';
    c.fill();
  },
};

// ---------- Chests ----------
function lootGlow(c: Ctx, x: number, y: number, r: number, col: string): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col + '88');
  g.addColorStop(1, col + '00');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

/** Bread basket: the normal chest. */
export function drawBasket(c: Ctx, w: number, h: number): void {
  lootGlow(c, w / 2, h / 2, w / 2, '#fff0a0');
  // Loaves poking out
  c.save();
  c.translate(11, 10);
  c.rotate(-0.5);
  c.beginPath();
  c.ellipse(0, 0, 4, 7, 0, 0, TAU);
  c.fillStyle = radial(c, 0, 0, 7, [[0, '#f6c27a'], [1, '#b8702e']]);
  c.fill();
  ink(c, 1.2);
  c.restore();
  c.save();
  c.translate(19, 9);
  c.rotate(0.45);
  c.beginPath();
  c.ellipse(0, 0, 3.6, 6.5, 0, 0, TAU);
  c.fillStyle = radial(c, 0, 0, 6.5, [[0, '#ffd99a'], [1, '#c58238']]);
  c.fill();
  ink(c, 1.2);
  c.restore();
  // Checked cloth
  c.beginPath();
  c.moveTo(4, 13);
  c.quadraticCurveTo(15, 9, 26, 13);
  c.lineTo(24, 16);
  c.lineTo(6, 16);
  c.closePath();
  c.fillStyle = '#e0453a';
  c.fill();
  c.fillStyle = '#ffffff';
  for (let x = 6; x < 25; x += 4) c.fillRect(x, 12, 2, 2), c.fillRect(x + 2, 14, 2, 2);
  c.beginPath();
  c.moveTo(4, 13);
  c.quadraticCurveTo(15, 9, 26, 13);
  ink(c, 1.1);
  // Wicker body
  c.beginPath();
  c.moveTo(3, 14.5);
  c.lineTo(27, 14.5);
  c.lineTo(24, 24);
  c.quadraticCurveTo(15, 26, 6, 24);
  c.closePath();
  c.fillStyle = linear(c, 0, 14, 0, 25, [[0, '#d9a25a'], [1, '#9a6430']]);
  c.fill();
  ink(c, 1.6);
  c.save();
  c.clip();
  c.strokeStyle = 'rgba(110,62,24,0.75)';
  c.lineWidth = 1;
  for (let y = 17.5; y < 25; y += 3) {
    c.beginPath();
    c.moveTo(2, y);
    c.lineTo(28, y);
    c.stroke();
  }
  for (let x = 6; x < 26; x += 4) {
    c.beginPath();
    c.moveTo(x, 15);
    c.lineTo(x + 1, 26);
    c.stroke();
  }
  c.restore();
  rrect(c, 2, 13.2, 26, 3, 1.5);
  c.fillStyle = '#c48a46';
  c.fill();
  ink(c, 1.2);
}

function sparkle(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = '#ffffff';
  c.fill();
}

/** Gold toaster: the rare chest. Small, gold and face-free so it never reads as the Toaster Tyrant. */
export function drawGoldToaster(c: Ctx, w: number, h: number): void {
  lootGlow(c, w / 2, h / 2 + 1, w / 2, '#ffd23f');
  // Toast popping up
  for (const x of [9, 16.5]) {
    rrect(c, x, 4, 6, 8, [2.5, 2.5, 0, 0]);
    c.fillStyle = linear(c, 0, 4, 0, 12, [[0, '#f2b766'], [1, '#b8702e']]);
    c.fill();
    ink(c, 1.2);
  }
  rrect(c, 4, 10, 22, 15, 5);
  c.fillStyle = linear(c, 4, 10, 26, 25, [
    [0, '#fff3a8'],
    [0.4, '#ffcf3a'],
    [1, '#c98a12'],
  ]);
  c.fill();
  ink(c, 1.6, '#4a2e06');
  rrect(c, 6.5, 12, 9, 2.2, 1.1);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fill();
  for (const x of [8.5, 16]) {
    rrect(c, x, 9.2, 7, 2.4, 1.2);
    c.fillStyle = '#5a3a0a';
    c.fill();
  }
  rrect(c, 25, 15, 3, 5, 1.2);
  c.fillStyle = '#7a520c';
  c.fill();
  // Gold bagel emblem
  c.beginPath();
  c.arc(15, 19.5, 3, 0, TAU);
  c.moveTo(16.2, 19.5);
  c.arc(15, 19.5, 1.2, 0, TAU, true);
  c.fillStyle = '#b07510';
  c.fill('evenodd');
  sparkle(c, 25, 7, 2.6);
  sparkle(c, 4.5, 9, 1.8);
}

/** Sticky Bun: a glazed cinnamon swirl that pulls every seed on the floor to you. */
export function drawStickyBun(c: Ctx, s: number): void {
  const m = s / 2;
  lootGlow(c, m, m, m, '#ffd23f');
  lootGlow(c, m, m, m * 0.8, '#fff3b0');
  const r = m * 0.56;
  // Bun body
  c.beginPath();
  c.arc(m, m + 1, r, 0, TAU);
  c.fillStyle = radial(c, m - r * 0.3, m - r * 0.3, r * 1.3, [[0, '#f2b469'], [0.6, '#c87a35'], [1, '#8f4f1f']]);
  c.fill();
  ink(c, 1.6);
  c.beginPath();
  c.arc(m, m + 1, r + 2.2, 0, TAU);
  c.strokeStyle = '#fff3b0';
  c.lineWidth = 1.4;
  c.stroke();
  // Cinnamon swirl
  c.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * TAU * 2.3;
    const rr = r * 0.85 * (1 - i / 66);
    const x = m + Math.cos(a) * rr;
    const y = m + 1 + Math.sin(a) * rr;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.strokeStyle = '#6b3414';
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.stroke();
  // Glaze drips
  c.fillStyle = '#fff6e0';
  c.beginPath();
  c.ellipse(m - r * 0.25, m - r * 0.35, r * 0.42, r * 0.22, -0.4, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(m + r * 0.35, m + r * 0.2, r * 0.2, r * 0.13, 0.5, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(m - r * 0.55, m - r * 0.05, r * 0.09, 0, TAU);
  c.fill();
}

// ---------- Freezer elites and bosses ----------

/** Ice Cream Scoop (elite): a big strawberry scoop with drips and sprinkles. */
export function drawScoop(c: Ctx, x: number, y: number, r: number): void {
  const line = Math.max(2, r * 0.1);
  const body = () => {
    c.beginPath();
    c.arc(x, y - r * 0.08, r * 0.92, Math.PI * 0.95, Math.PI * 2.05);
    // Drippy wavy base
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const px = x + r * 0.92 - (i / n) * r * 1.84;
      const drip = i % 2 ? r * 0.42 : r * 0.18;
      c.quadraticCurveTo(px + r * 0.15, y + drip + r * 0.2, px, y + r * 0.2);
    }
    c.closePath();
  };
  body();
  c.fillStyle = radial(c, x, y - r * 0.1, r, [
    [0, '#ffd2df'],
    [0.6, '#f59ab4'],
    [1, '#d9668a'],
  ]);
  c.fill();
  ink(c, line);
  // Sprinkles
  const cols = ['#ffffff', '#7fd0f0', '#ffe066', '#9be38a'];
  const rand = rng(7);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.1 + rand() * 0.8);
    const d = r * (0.35 + rand() * 0.45);
    const px = x + Math.cos(a) * d;
    const py = y - r * 0.1 + Math.sin(a) * d;
    c.save();
    c.translate(px, py);
    c.rotate(rand() * TAU);
    rrect(c, -r * 0.09, -r * 0.03, r * 0.18, r * 0.06, r * 0.03);
    c.fillStyle = cols[i % cols.length];
    c.fill();
    c.restore();
  }
  // Shine
  c.beginPath();
  c.ellipse(x - r * 0.42, y - r * 0.55, r * 0.2, r * 0.1, -0.6, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fill();
  angryEye(c, x - r * 0.3, y + r * 0.02, r * 0.17, -1, line);
  angryEye(c, x + r * 0.3, y + r * 0.02, r * 0.17, 1, line);
  c.beginPath();
  c.arc(x, y + r * 0.42, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
  ink(c, line * 0.8);
}

/** Melt puddle left by the scoop: pink, with a thick white outline so it reads as a hazard. */
export function drawMeltPuddle(c: Ctx, w: number, h: number): void {
  const shape = () => {
    c.beginPath();
    c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, TAU);
  };
  shape();
  c.fillStyle = 'rgba(245,154,180,0.75)';
  c.fill();
  c.lineWidth = 3.5;
  c.strokeStyle = '#ffffff';
  c.stroke();
  c.beginPath();
  c.ellipse(w * 0.38, h * 0.38, w * 0.12, h * 0.1, 0, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.65)';
  c.fill();
}

/** Stage 1's croissant, smaller, glazed with frost and icing. */
export function drawFrostedCroissant(c: Ctx, w: number, h: number): void {
  c.save();
  c.scale(w / 72, h / 56);
  drawCroissant(c, 72, 56);
  // Icy blue wash over the pastry only
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(150,205,240,0.38)';
  c.fillRect(0, 0, 72, 56);
  c.globalCompositeOperation = 'source-over';
  // Icing drizzle
  c.beginPath();
  c.moveTo(8, 34);
  for (let i = 0; i < 8; i++) c.lineTo(14 + i * 7, i % 2 ? 36 : 14);
  c.lineWidth = 2.6;
  c.strokeStyle = 'rgba(255,255,255,0.92)';
  c.stroke();
  c.restore();
  // Redraw the eyes on top so they stay bright
  c.save();
  c.scale(w / 72, h / 56);
  angryEye(c, 30.5, 21, 4.3, -1, 2);
  angryEye(c, 41.5, 21, 4.3, 1, 2);
  c.restore();
}

/** Tyrant Jr.: a small toaster with a frosty top. */
export function drawTyrantJr(c: Ctx, w: number, h: number): void {
  c.save();
  c.scale(w / 84, h / 76);
  drawToaster(c, 84, 76);
  c.restore();
  // A snow cap on the toast
  c.beginPath();
  c.ellipse(w * 0.36, h * 0.07, w * 0.13, h * 0.05, 0, 0, TAU);
  c.ellipse(w * 0.66, h * 0.07, w * 0.13, h * 0.05, 0, 0, TAU);
  c.fillStyle = '#f4fbff';
  c.fill();
}

/** Frozen Waffle (mini-boss) or one of its squares. */
export function drawWaffle(c: Ctx, s: number, small = false): void {
  const line = small ? 1.8 : 3;
  const pad = line + 1;
  const sz = s - pad * 2;
  rrect(c, pad, pad, sz, sz, sz * 0.18);
  c.fillStyle = linear(c, 0, 0, s, s, [
    [0, '#f7cd7a'],
    [0.6, '#dda04a'],
    [1, '#b37425'],
  ]);
  c.fill();
  ink(c, line);
  // Grid pockets
  const n = small ? 2 : 4;
  const cell = sz / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      rrect(c, pad + i * cell + cell * 0.18, pad + j * cell + cell * 0.18, cell * 0.64, cell * 0.64, cell * 0.12);
      c.fillStyle = 'rgba(150,90,30,0.5)';
      c.fill();
    }
  // Frost on top
  c.save();
  rrect(c, pad, pad, sz, sz, sz * 0.18);
  c.clip();
  c.fillStyle = 'rgba(225,244,255,0.85)';
  c.beginPath();
  c.moveTo(pad, pad);
  c.lineTo(pad + sz, pad);
  c.lineTo(pad + sz, pad + sz * 0.22);
  for (let i = 6; i >= 0; i--) c.lineTo(pad + (i / 6) * sz, pad + sz * (i % 2 ? 0.3 : 0.18));
  c.closePath();
  c.fill();
  c.restore();
  rrect(c, pad, pad, sz, sz, sz * 0.18);
  ink(c, line);
  const m = s / 2;
  angryEye(c, m - sz * 0.2, m + sz * 0.05, sz * (small ? 0.14 : 0.1), -1, line);
  angryEye(c, m + sz * 0.2, m + sz * 0.05, sz * (small ? 0.14 : 0.1), 1, line);
  if (!small) {
    c.beginPath();
    c.arc(m, m + sz * 0.32, sz * 0.1, Math.PI * 1.15, Math.PI * 1.85);
    ink(c, line * 0.8);
  }
}

/** The Freezer Burn: a huge, angry frozen pizza. */
export function drawFreezerBurn(c: Ctx, s: number): void {
  const m = s / 2;
  const r = m - 4;
  const line = 3.5;
  // Crust
  c.beginPath();
  c.arc(m, m, r, 0, TAU);
  c.fillStyle = radial(c, m, m, r, [
    [0, '#f2c27a'],
    [1, '#b5762f'],
  ]);
  c.fill();
  ink(c, line);
  // Sauce and cheese
  c.beginPath();
  c.arc(m, m, r * 0.82, 0, TAU);
  c.fillStyle = '#d9472e';
  c.fill();
  blobPath(c, m, m, r * 0.76, 14, 0.18, 5);
  c.fillStyle = '#ffe08a';
  c.fill();
  // Pepperoni
  const rand = rng(21);
  for (let i = 0; i < 7; i++) {
    const a = rand() * TAU;
    const d = r * (0.42 + rand() * 0.25);
    const px = m + Math.cos(a) * d;
    const py = m + Math.sin(a) * d;
    if (py < m + r * 0.05 && Math.abs(px - m) < r * 0.55) continue; // keep the face clear
    c.beginPath();
    c.arc(px, py, r * 0.11, 0, TAU);
    c.fillStyle = '#b8352a';
    c.fill();
    ink(c, 1.4);
  }
  // Frost patches
  c.fillStyle = 'rgba(220,242,255,0.8)';
  for (const [dx, dy, rx, ry] of [
    [-0.55, -0.5, 0.2, 0.1],
    [0.6, -0.35, 0.16, 0.08],
    [0.1, 0.72, 0.24, 0.08],
    [-0.62, 0.35, 0.12, 0.07],
  ]) {
    c.beginPath();
    c.ellipse(m + dx * r, m + dy * r, rx * r, ry * r, 0.3, 0, TAU);
    c.fill();
  }
  // Glowing icy eyes
  for (const d of [-1, 1]) {
    c.beginPath();
    c.arc(m + d * r * 0.28, m - r * 0.15, r * 0.2, 0, TAU);
    c.fillStyle = 'rgba(120,200,255,0.35)';
    c.fill();
    angryEye(c, m + d * r * 0.28, m - r * 0.15, r * 0.13, d, line, '#3fa9f5');
  }
  // Mouth with icicle teeth
  c.beginPath();
  c.moveTo(m - r * 0.36, m + r * 0.22);
  c.quadraticCurveTo(m, m + r * 0.5, m + r * 0.36, m + r * 0.22);
  c.closePath();
  c.fillStyle = '#3a1410';
  c.fill();
  ink(c, line * 0.8);
  c.fillStyle = '#eaf7ff';
  for (let i = 0; i < 4; i++) {
    const px = m - r * 0.27 + i * r * 0.18;
    c.beginPath();
    c.moveTo(px - r * 0.06, m + r * 0.24);
    c.lineTo(px + r * 0.06, m + r * 0.24);
    c.lineTo(px, m + r * 0.36);
    c.closePath();
    c.fill();
  }
}

/** Icicle projectile, pointing right (rotated to its heading). */
export function drawIcicle(c: Ctx, w: number, h: number): void {
  c.beginPath();
  c.moveTo(w - 1, h / 2);
  c.lineTo(3, 1.5);
  c.quadraticCurveTo(0.5, h / 2, 3, h - 1.5);
  c.closePath();
  c.fillStyle = linear(c, 0, 0, 0, h, [
    [0, '#ffffff'],
    [0.5, '#a8dcff'],
    [1, '#4f9fd6'],
  ]);
  c.fill();
  ink(c, 1.4);
}

/** Pizza slice projectile. */
export function drawPizzaSlice(c: Ctx, s: number): void {
  c.beginPath();
  c.moveTo(s / 2, s - 1.5);
  c.lineTo(1.5, 4);
  c.quadraticCurveTo(s / 2, 0, s - 1.5, 4);
  c.closePath();
  c.fillStyle = '#ffd36b';
  c.fill();
  ink(c, 1.4);
  rrect(c, 1.5, 1.5, s - 3, 4, 2);
  c.fillStyle = '#c4823a';
  c.fill();
  ink(c, 1.2);
  c.beginPath();
  c.arc(s * 0.45, s * 0.45, s * 0.1, 0, TAU);
  c.arc(s * 0.58, s * 0.66, s * 0.07, 0, TAU);
  c.fillStyle = '#c23b2a';
  c.fill();
}

// ---------- Toaster Oven enemies and hazards ----------
// Hot and bright, but enemies keep their ink outlines and angry eyes, and hazards get a white edge.

/** A crumb with glowing ember cracks. */
export function drawEmberCrumb(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r * 1.22, 0, TAU);
  c.fillStyle = 'rgba(255,120,30,0.5)';
  c.fill();
  drawCrumb(c, x, y, r);
  c.strokeStyle = '#ff9a2e';
  c.lineWidth = Math.max(1.2, r * 0.13);
  c.beginPath();
  c.moveTo(x - r * 0.55, y + r * 0.25);
  c.lineTo(x - r * 0.15, y + r * 0.5);
  c.lineTo(x + r * 0.1, y + r * 0.3);
  c.moveTo(x + r * 0.3, y + r * 0.6);
  c.lineTo(x + r * 0.6, y + r * 0.2);
  c.stroke();
  c.strokeStyle = '#ffe28a';
  c.lineWidth = Math.max(0.6, r * 0.05);
  c.stroke();
  const line = Math.max(1.5, r * 0.19);
  angryEye(c, x - r * 0.33, y - r * 0.06, r * 0.21, -1, line, '#ffb22e');
  angryEye(c, x + r * 0.33, y - r * 0.06, r * 0.21, 1, line, '#ffb22e');
}

/** A heavy burnt toast slice: dark crust, charred middle, angry eyes. */
export function drawBurntToast(c: Ctx, w: number, h: number): void {
  const line = 2.2;
  const x = w / 2;
  const top = 2;
  const bot = h - 2;
  const shape = (inset: number) => {
    c.beginPath();
    c.moveTo(3 + inset, bot - inset);
    c.lineTo(3 + inset, top + h * 0.32);
    c.bezierCurveTo(1 + inset, top - 1 + inset, x - 3, top + inset, x, top + h * 0.12 + inset);
    c.bezierCurveTo(x + 3, top + inset, w - 1 - inset, top - 1 + inset, w - 3 - inset, top + h * 0.32);
    c.lineTo(w - 3 - inset, bot - inset);
    c.closePath();
  };
  shape(0);
  c.fillStyle = '#4a2410';
  c.fill();
  ink(c, line);
  shape(3.5);
  c.fillStyle = radial(c, x, h * 0.55, w * 0.5, [
    [0, '#8a5226'],
    [0.7, '#5f3214'],
    [1, '#3e1e0c'],
  ]);
  c.fill();
  // Char marks.
  c.fillStyle = 'rgba(25,12,5,0.55)';
  c.beginPath();
  c.ellipse(x - w * 0.2, h * 0.72, w * 0.12, h * 0.06, 0.3, 0, TAU);
  c.ellipse(x + w * 0.22, h * 0.36, w * 0.08, h * 0.05, -0.4, 0, TAU);
  c.fill();
  angryEye(c, x - w * 0.18, h * 0.5, w * 0.12, -1, line);
  angryEye(c, x + w * 0.18, h * 0.5, w * 0.12, 1, line);
}

/** A hot sauce drop: a bright red teardrop with a shine. */
export function drawHotSauce(c: Ctx, w: number, h: number): void {
  const line = 2;
  const x = w / 2;
  const shape = () => {
    c.beginPath();
    c.moveTo(x, 2);
    c.bezierCurveTo(x + w * 0.18, h * 0.3, w - 2, h * 0.48, w - 2, h * 0.64);
    c.arc(x, h * 0.64, x - 2, 0, Math.PI);
    c.bezierCurveTo(2, h * 0.48, x - w * 0.18, h * 0.3, x, 2);
    c.closePath();
  };
  shape();
  c.fillStyle = radial(c, x, h * 0.6, w * 0.55, [
    [0, '#ff7a5a'],
    [0.6, '#e0331f'],
    [1, '#a8170e'],
  ]);
  c.fill();
  ink(c, line);
  c.beginPath();
  c.ellipse(x - w * 0.18, h * 0.5, w * 0.08, h * 0.1, 0.3, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fill();
  angryEye(c, x - w * 0.16, h * 0.66, w * 0.11, -1, line, '#ffd34a');
  angryEye(c, x + w * 0.16, h * 0.66, w * 0.11, 1, line, '#ffd34a');
}

/** Hot Sauce Drop's shot: a big red blob with a thick white rim, easy to see on the dark rack. */
export function drawSauceShot(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1.5, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 1.4);
  c.beginPath();
  c.arc(m, m, m - 3.6, 0, TAU);
  c.fillStyle = radial(c, m, m, m, [
    [0, '#ff8a6a'],
    [1, '#e0221a'],
  ]);
  c.fill();
  c.beginPath();
  c.arc(m - m * 0.25, m - m * 0.28, m * 0.18, 0, TAU);
  c.fillStyle = '#ffffff';
  c.fill();
}

/** A popcorn kernel about to pop: golden hull with a white puff peeking out. */
export function drawPopcorn(c: Ctx, w: number, h: number): void {
  const line = 1.9;
  const x = w / 2;
  // Puff on top
  c.beginPath();
  c.arc(x - w * 0.16, h * 0.28, w * 0.2, 0, TAU);
  c.arc(x + w * 0.14, h * 0.24, w * 0.22, 0, TAU);
  c.fillStyle = '#fff8e6';
  c.fill();
  ink(c, line);
  // Hull
  c.beginPath();
  c.moveTo(x, h - 2);
  c.bezierCurveTo(x - w * 0.62, h * 0.86, x - w * 0.5, h * 0.3, x, h * 0.32);
  c.bezierCurveTo(x + w * 0.5, h * 0.3, x + w * 0.62, h * 0.86, x, h - 2);
  c.closePath();
  c.fillStyle = radial(c, x, h * 0.6, w * 0.45, [
    [0, '#ffd66a'],
    [0.7, '#e9a52e'],
    [1, '#b8741a'],
  ]);
  c.fill();
  ink(c, line);
  angryEye(c, x - w * 0.15, h * 0.6, w * 0.1, -1, line);
  angryEye(c, x + w * 0.15, h * 0.6, w * 0.1, 1, line);
}

/** One fast popcorn bit: a white puff with tiny eyes. */
export function drawPopBit(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m - s * 0.15, m + s * 0.05, s * 0.24, 0, TAU);
  c.arc(m + s * 0.15, m + s * 0.05, s * 0.24, 0, TAU);
  c.arc(m, m - s * 0.15, s * 0.26, 0, TAU);
  c.fillStyle = '#fff6dc';
  c.fill();
  ink(c, 1.5);
  c.beginPath();
  c.arc(m, m - s * 0.15, s * 0.26, 0, TAU);
  c.arc(m - s * 0.15, m + s * 0.05, s * 0.24, 0, TAU);
  c.arc(m + s * 0.15, m + s * 0.05, s * 0.24, 0, TAU);
  c.fillStyle = '#fff6dc';
  c.fill();
  c.fillStyle = '#f2c86a';
  c.beginPath();
  c.arc(m, m + s * 0.28, s * 0.12, 0, TAU);
  c.fill();
  angryEye(c, m - s * 0.13, m, s * 0.1, -1, 1);
  angryEye(c, m + s * 0.13, m, s * 0.1, 1, 1);
}

/** Toaster Tot: the old Tyrant, shrunk down to swarm size, a little scorched. */
export function drawTot(c: Ctx, w: number, h: number): void {
  c.save();
  c.scale(w / 84, h / 76);
  drawToaster(c, 84, 76);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(80,40,20,0.18)';
  c.fillRect(0, 0, 84, 76);
  c.globalCompositeOperation = 'source-over';
  angryEye(c, 30, 41, 6.6, -1, 2.8, '#ff3b1f');
  angryEye(c, 54, 41, 6.6, 1, 2.8, '#ff3b1f');
  c.restore();
}

/** Rack post: a solid steel post seen from above, chunky and outlined so it reads as a wall. */
export function drawRackPost(c: Ctx, s: number): void {
  const m = s / 2;
  const r = m - 3;
  c.beginPath();
  c.arc(m, m, r, 0, TAU);
  c.fillStyle = radial(c, m, m, r, [
    [0, '#e4e2df'],
    [0.55, '#a19d99'],
    [1, '#605b57'],
  ]);
  c.fill();
  ink(c, 3);
  c.beginPath();
  c.arc(m, m, r * 0.55, 0, TAU);
  c.fillStyle = '#7a7470';
  c.fill();
  ink(c, 1.6);
  c.beginPath();
  c.arc(m - r * 0.2, m - r * 0.22, r * 0.18, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fill();
}

/** Ember spark left by an Ember Crumb: small, hot, and gone in a moment. */
export function drawEmberSpark(c: Ctx, s: number): void {
  const m = s / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,240,170,1)');
  g.addColorStop(0.4, 'rgba(255,150,40,0.9)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(m, m, m, 0, TAU);
  c.fill();
}

/** A bubbling grease spot: golden-brown with a thick white outline and bubbles. */
export function drawGreaseSpot(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 3, 0, TAU);
  c.fillStyle = 'rgba(214,150,40,0.7)';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = '#ffffff';
  c.stroke();
  for (const [dx, dy, r] of [
    [-0.3, -0.2, 0.18],
    [0.25, 0.1, 0.22],
    [-0.05, 0.38, 0.12],
  ]) {
    c.beginPath();
    c.arc(m + dx * m, m + dy * m, r * m, 0, TAU);
    c.fillStyle = 'rgba(255,230,150,0.85)';
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.stroke();
  }
}

/** Grease slick left by a pop: shiny amber with a dashed white edge, slippery like Freezer ice. */
export function drawSlick(c: Ctx, w: number, h: number): void {
  c.beginPath();
  c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, TAU);
  c.fillStyle = 'rgba(232,170,60,0.5)';
  c.fill();
  c.setLineDash([9, 6]);
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.ellipse(w * 0.36, h * 0.38, w * 0.14, h * 0.1, -0.3, 0, TAU);
  c.fillStyle = 'rgba(255,248,220,0.6)';
  c.fill();
}

/** A small flame that flickers on a burning enemy (Jalapeño Cheddar's Spicy). */
export function drawFlame(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  c.beginPath();
  c.moveTo(x, 1);
  c.bezierCurveTo(x + w * 0.5, h * 0.4, x + w * 0.45, h - 1, x, h - 1);
  c.bezierCurveTo(x - w * 0.45, h - 1, x - w * 0.5, h * 0.4, x, 1);
  c.fillStyle = '#ff6a1f';
  c.fill();
  c.lineWidth = 1.2;
  c.strokeStyle = INK;
  c.stroke();
  c.beginPath();
  c.moveTo(x, h * 0.35);
  c.bezierCurveTo(x + w * 0.28, h * 0.6, x + w * 0.22, h - 3, x, h - 3);
  c.bezierCurveTo(x - w * 0.22, h - 3, x - w * 0.28, h * 0.6, x, h * 0.35);
  c.fillStyle = '#ffd34a';
  c.fill();
}

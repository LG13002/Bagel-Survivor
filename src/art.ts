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

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

// ---------- Upgrade icons (36 × 36) ----------
const IL = 1.7; // icon ink width
function fillInk(c: Ctx, fill: string | CanvasGradient, w = IL): void {
  c.fillStyle = fill;
  c.fill();
  ink(c, w);
}
export const ICONS: Record<string, (c: Ctx) => void> = {
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

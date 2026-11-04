// Stage 1 background: the giant countertop. A seamless butcher-block tile, plus separate prop
// textures that GameScene scatters around the world so nothing visibly repeats.
// Scenery is drawn soft, with no heavy ink outlines, so it never competes with enemies or pickups.
import { type Ctx, linear, rng, rrect } from './art';

const TAU = Math.PI * 2;

function wrapped(size: number, x: number, y: number, r: number, fn: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const px = x + dx;
      const py = y + dy;
      if (px > -r && px < size + r && py > -r && py < size + r) fn(px, py);
    }
}

function softShadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(40,20,8,${a})`);
  g.addColorStop(1, 'rgba(40,20,8,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, TAU);
  c.fill();
  c.restore();
}

/** Seamless butcher-block counter, size × size. */
export function drawButcherBlock(c: Ctx, size: number): void {
  const rand = rng(5);
  const sw = 32;
  const tones = [
    [176, 124, 78],
    [164, 113, 70],
    [186, 134, 86],
    [158, 108, 66],
  ];
  for (let x = 0; x < size; x += sw) {
    const t = tones[(x / sw) % 4];
    const k = 0.96 + rand() * 0.08;
    c.fillStyle = `rgb(${(t[0] * k) | 0},${(t[1] * k) | 0},${(t[2] * k) | 0})`;
    c.fillRect(x, 0, sw, size);
    c.strokeStyle = 'rgba(96,58,30,0.2)';
    c.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const gx = x + 4 + rand() * (sw - 8);
      const ph = rand() * TAU;
      c.beginPath();
      c.moveTo(gx + Math.sin(ph) * 2.5, 0);
      // Whole number of waves per tile so the grain wraps seamlessly.
      for (let y = 8; y <= size; y += 8) c.lineTo(gx + Math.sin((y / size) * TAU * 3 + ph) * 2.5, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(70,40,20,0.32)';
    c.fillRect(x, 0, 1.5, size);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand() * (size / sw)) * sw;
    c.fillStyle = 'rgba(70,40,20,0.28)';
    c.fillRect(x, rand() * size, sw, 1.5);
  }
  c.strokeStyle = 'rgba(255,235,200,0.16)';
  c.lineWidth = 1.1;
  for (let i = 0; i < 7; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI;
    const l = 18 + rand() * 34;
    wrapped(size, x, y, l, (px, py) => {
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      c.stroke();
    });
  }
}

// ---------- Props (each centered in its own texture) ----------
export interface PropDef {
  key: string;
  w: number;
  h: number;
  /** Relative chance of being picked. */
  weight: number;
  /** Spin freely, or keep roughly upright (text, shadows). */
  spin: boolean;
  draw: (c: Ctx, w: number, h: number) => void;
}

function flourPile(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  const r = Math.min(w, h * 1.5) * 0.42;
  const rand = rng(9);
  for (let j = 0; j < 10; j++) {
    const ox = x + (rand() - 0.5) * r * 1.4;
    const oy = y + (rand() - 0.5) * r * 0.8;
    const rr = r * (0.3 + rand() * 0.4);
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, rr);
    g.addColorStop(0, 'rgba(255,252,244,0.32)');
    g.addColorStop(1, 'rgba(255,250,238,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ox, oy, rr, 0, TAU);
    c.fill();
  }
  c.beginPath();
  c.ellipse(x, y, r * 0.5, r * 0.3, 0, 0, TAU);
  const m = c.createRadialGradient(x - r * 0.12, y - r * 0.1, 0, x, y, r * 0.55);
  m.addColorStop(0, 'rgba(255,255,255,0.85)');
  m.addColorStop(1, 'rgba(236,226,207,0.8)');
  c.fillStyle = m;
  c.fill();
}

function sprinkleSpill(c: Ctx, w: number, h: number): void {
  const cols = ['#f48fb1', '#fff3d6', '#ffd56a', '#b39ddb', '#ff8a65'];
  const rand = rng(3);
  const r = Math.min(w, h) * 0.45;
  for (let i = 0; i < 28; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * r;
    c.save();
    c.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.75);
    c.rotate(rand() * Math.PI);
    rrect(c, -3.5, -1.2, 7, 2.4, 1.2);
    c.globalAlpha = 0.7;
    c.fillStyle = cols[i % cols.length];
    c.fill();
    c.restore();
  }
}

function spoon(c: Ctx, w: number, h: number): void {
  c.save();
  c.translate(w / 2 + 20, h / 2);
  softShadow(c, 6, 9, 80, 22, 0.24);
  rrect(c, -10, -9, 110, 18, 9);
  c.fillStyle = linear(c, 0, -9, 0, 9, [
    [0, '#f4f7fa'],
    [0.5, '#b9c4cd'],
    [1, '#8996a1'],
  ]);
  c.fill();
  c.beginPath();
  c.ellipse(-40, 0, 38, 30, 0, 0, TAU);
  c.fillStyle = linear(c, -78, -30, 0, 30, [
    [0, '#eef2f5'],
    [1, '#93a0ab'],
  ]);
  c.fill();
  c.beginPath();
  c.ellipse(-40, 2, 29, 22, 0, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fill();
  c.fillStyle = 'rgba(120,130,140,0.6)';
  c.font = 'bold 12px sans-serif';
  c.fillText('1 TBSP', 20, 4.5);
  c.restore();
}

function cookieCutter(c: Ctx, w: number, h: number, shape: 'heart' | 'star' | 'circle'): void {
  const x = w / 2;
  const y = h / 2;
  softShadow(c, x + 4, y + 7, 44, 14, 0.2);
  c.beginPath();
  if (shape === 'circle') c.arc(x, y, 34, 0, TAU);
  else if (shape === 'heart') {
    c.moveTo(x, y + 30);
    c.bezierCurveTo(x - 46, y, x - 30, y - 38, x, y - 16);
    c.bezierCurveTo(x + 30, y - 38, x + 46, y, x, y + 30);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? 16 : 36;
      if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  c.lineJoin = 'round';
  c.lineWidth = 6;
  c.strokeStyle = '#c3ccd3';
  c.stroke();
  c.lineWidth = 1.6;
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.stroke();
}

function measuringCup(c: Ctx, w: number, h: number): void {
  const x = w / 2 - 12;
  const y = h / 2;
  softShadow(c, x + 6, y + 8, 50, 18, 0.24);
  rrect(c, x + 26, y - 7, 46, 14, 7);
  c.fillStyle = '#d65a4a';
  c.fill();
  c.beginPath();
  c.arc(x, y, 34, 0, TAU);
  c.fillStyle = '#e46b5a';
  c.fill();
  c.beginPath();
  c.arc(x, y, 27, 0, TAU);
  c.fillStyle = linear(c, x - 27, y - 27, x + 27, y + 27, [
    [0, '#ffd9d2'],
    [1, '#f0a093'],
  ]);
  c.fill();
  c.beginPath();
  c.arc(x - 4, y - 3, 17, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fill();
}

function flourStreak(c: Ctx, w: number, h: number): void {
  const g = linear(c, 0, 0, w, 0, [
    [0, 'rgba(255,250,240,0)'],
    [0.2, 'rgba(255,250,240,0.2)'],
    [0.8, 'rgba(255,250,240,0.2)'],
    [1, 'rgba(255,250,240,0)'],
  ]);
  c.fillStyle = g;
  c.fillRect(0, h * 0.2, w, h * 0.6);
  c.strokeStyle = 'rgba(255,250,240,0.12)';
  c.lineWidth = 2;
  for (const yy of [0.32, 0.5, 0.68]) {
    c.beginPath();
    c.moveTo(w * 0.15, h * yy);
    c.lineTo(w * 0.85, h * yy);
    c.stroke();
  }
}

export const COUNTER_PROPS: PropDef[] = [
  { key: 'prop_spoon', w: 200, h: 90, weight: 1, spin: true, draw: spoon },
  { key: 'prop_cutter_heart', w: 100, h: 100, weight: 0.7, spin: true, draw: (c, w, h) => cookieCutter(c, w, h, 'heart') },
  { key: 'prop_cutter_star', w: 100, h: 100, weight: 0.7, spin: true, draw: (c, w, h) => cookieCutter(c, w, h, 'star') },
  { key: 'prop_cutter_circle', w: 100, h: 100, weight: 0.5, spin: true, draw: (c, w, h) => cookieCutter(c, w, h, 'circle') },
  { key: 'prop_cup', w: 150, h: 100, weight: 0.8, spin: true, draw: measuringCup },
  { key: 'prop_flour', w: 150, h: 100, weight: 1.2, spin: false, draw: flourPile },
  { key: 'prop_sprinkles', w: 110, h: 90, weight: 1.2, spin: true, draw: sprinkleSpill },
  { key: 'prop_streak', w: 300, h: 70, weight: 0.8, spin: true, draw: flourStreak },
];

/** Picture for a stage card and the menu's stage button, w × h with rounded corners and an ink edge. */
export function drawStageThumb(c: Ctx, id: string, w: number, h: number): void {
  const r = Math.min(w, h) * 0.2;
  c.save();
  rrect(c, 2, 2, w - 4, h - 4, r);
  c.clip();
  if (id === 'stage1') {
    c.save();
    c.scale(w / 160, w / 160);
    drawButcherBlock(c, 256);
    c.restore();
    // A cookie and a dusting of flour so it reads as the countertop.
    c.fillStyle = 'rgba(255,250,240,0.55)';
    c.beginPath();
    c.ellipse(w * 0.72, h * 0.68, w * 0.16, h * 0.12, 0.3, 0, TAU);
    c.fill();
    c.fillStyle = '#d9a35f';
    c.beginPath();
    c.arc(w * 0.3, h * 0.38, Math.min(w, h) * 0.17, 0, TAU);
    c.fill();
    c.fillStyle = '#5a3418';
    for (const [dx, dy] of [[-0.05, -0.04], [0.05, 0.02], [-0.01, 0.07]]) {
      c.beginPath();
      c.arc(w * (0.3 + dx), h * (0.38 + dy), Math.min(w, h) * 0.025, 0, TAU);
      c.fill();
    }
  } else if (id === 'stage2') {
    // Frosty ice tiles with a big snowflake.
    c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#cfeefc'], [1, '#8fc6e6']]);
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.5;
    const t = w / 4;
    for (let x = t; x < w; x += t) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = t; y < h; y += t) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.save();
    c.translate(w / 2, h / 2);
    c.strokeStyle = '#ffffff';
    c.lineWidth = Math.max(2, w * 0.035);
    c.lineCap = 'round';
    const a = Math.min(w, h) * 0.3;
    for (let i = 0; i < 6; i++) {
      c.rotate(TAU / 6);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -a);
      c.moveTo(0, -a * 0.6);
      c.lineTo(-a * 0.22, -a * 0.82);
      c.moveTo(0, -a * 0.6);
      c.lineTo(a * 0.22, -a * 0.82);
      c.stroke();
    }
    c.restore();
  } else {
    // Glowing heating coils under a dark oven rack.
    c.fillStyle = '#2a1a14';
    c.fillRect(0, 0, w, h);
    for (const y of [h * 0.32, h * 0.7]) {
      c.strokeStyle = 'rgba(255,120,40,0.35)';
      c.lineWidth = h * 0.16;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
      c.strokeStyle = '#ff9a3c';
      c.lineWidth = h * 0.06;
      c.stroke();
      c.strokeStyle = '#ffe08a';
      c.lineWidth = h * 0.02;
      c.stroke();
    }
    c.strokeStyle = '#8d8f94';
    c.lineWidth = Math.max(1.5, w * 0.025);
    for (let x = w / 6; x < w; x += w / 6) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
  }
  c.restore();
  rrect(c, 2, 2, w - 4, h - 4, r);
  c.strokeStyle = '#24160d';
  c.lineWidth = 3;
  c.stroke();
}

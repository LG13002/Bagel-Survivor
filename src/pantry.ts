// Stage 4, the Pantry: its floor, shelves, scenery, enemies, shots and hazards, all drawn in code.
import { INK, angryEye, ink, linear, radial, rng, rrect, drawBroiler, drawMoltenMuffin } from './art';
import type { PropDef } from './floors';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function circle(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}

function soft(c: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  circle(c, x, y, r);
  c.fill();
}

// ---------------------------------------------------------------- Floor

/**
 * Seamless pantry floor, size × size: old grey-brown boards. Kept dim and cool so the red-brown shelves, the warm
 * enemies and the blue seeds all stand out against it.
 */
export function drawPantryFloor(c: Ctx, size: number): void {
  const rand = rng(57);
  const pw = size / 4;
  for (let i = 0; i < 4; i++) {
    const x = i * pw;
    const tone = [0, -7, 5, -3][i];
    c.fillStyle = `rgb(${122 + tone},${104 + tone},${86 + tone})`;
    c.fillRect(x, 0, pw, size);
    // Grain: long faint streaks that run the whole board, so the tile repeats cleanly.
    for (let k = 0; k < 7; k++) {
      const gx = x + 5 + rand() * (pw - 10);
      c.fillStyle = rand() < 0.5 ? 'rgba(60,44,30,0.13)' : 'rgba(255,236,205,0.07)';
      c.fillRect(gx, 0, 1 + rand() * 1.6, size);
    }
    // The gap between boards.
    c.fillStyle = 'rgba(48,36,26,0.75)';
    c.fillRect(x - 1, 0, 2.4, size);
    c.fillStyle = 'rgba(255,240,215,0.1)';
    c.fillRect(x + 1.4, 0, 1, size);
    // Board ends, with two nail heads each.
    const jy = Math.floor(rand() * (size - 40)) + 20;
    c.fillStyle = 'rgba(48,36,26,0.6)';
    c.fillRect(x, jy, pw, 1.8);
    c.fillStyle = 'rgba(40,30,22,0.7)';
    for (const ny of [jy - 6, jy + 8]) {
      circle(c, x + 9, ny, 1.5);
      c.fill();
      circle(c, x + pw - 9, ny, 1.5);
      c.fill();
    }
  }
  // A few knots and worn patches.
  for (let i = 0; i < 5; i++) {
    const x = 20 + rand() * (size - 40);
    const y = 20 + rand() * (size - 40);
    soft(c, x, y, 10 + rand() * 12, '50,36,24', 0.2);
  }
  for (let i = 0; i < 4; i++) {
    const x = 26 + rand() * (size - 52);
    const y = 26 + rand() * (size - 52);
    soft(c, x, y, 18 + rand() * 14, '255,240,214', 0.07);
  }
}

// ---------------------------------------------------------------- Shelves

const LABELS = ['#d9472e', '#3f8f6a', '#e8b53a', '#4a79c9', '#b05ab5', '#e07a2e'];

/** One thing on a shelf, seen from above, centred at (x, y) and about `s` across. */
function shelfItem(c: Ctx, x: number, y: number, s: number, kind: number, col: string): void {
  if (kind === 0) {
    // A tin: silver rim, coloured top with a ring pull.
    circle(c, x, y, s * 0.5);
    c.fillStyle = '#c9d2d8';
    c.fill();
    ink(c, 2);
    circle(c, x, y, s * 0.36);
    c.fillStyle = col;
    c.fill();
    circle(c, x + s * 0.06, y - s * 0.04, s * 0.13);
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1.6;
    c.stroke();
  } else if (kind === 1) {
    // A box, lying flat: a colour band and a pale label.
    rrect(c, x - s * 0.62, y - s * 0.42, s * 1.24, s * 0.84, 2.5);
    c.fillStyle = col;
    c.fill();
    ink(c, 2);
    rrect(c, x - s * 0.36, y - s * 0.2, s * 0.72, s * 0.4, 2);
    c.fillStyle = '#fff3dc';
    c.fill();
  } else if (kind === 2) {
    // A jar: gold lid with ridges.
    circle(c, x, y, s * 0.48);
    c.fillStyle = radial(c, x, y, s * 0.48, [[0, '#f8dc7a'], [1, '#b98424']]);
    c.fill();
    ink(c, 2);
    circle(c, x, y, s * 0.3);
    c.strokeStyle = 'rgba(120,80,20,0.6)';
    c.lineWidth = 1.2;
    c.stroke();
  } else {
    // A cloth sack, tied at the top.
    c.beginPath();
    c.ellipse(x, y, s * 0.56, s * 0.46, 0, 0, TAU);
    c.fillStyle = '#e9dcc0';
    c.fill();
    ink(c, 2);
    circle(c, x, y, s * 0.13);
    c.fillStyle = '#9a7a4a';
    c.fill();
    c.strokeStyle = 'rgba(120,96,60,0.5)';
    c.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * s * 0.16, y + Math.sin(a) * s * 0.14);
      c.lineTo(x + Math.cos(a) * s * 0.44, y + Math.sin(a) * s * 0.36);
      c.stroke();
    }
  }
}

/**
 * A pantry shelf seen from above: `len` long and `wide` across, with a darker front edge below it for height.
 * `horiz` lays it left to right (texture len + 8 by wide + 16); otherwise top to bottom (wide + 8 by len + 14).
 */
export function drawShelf(c: Ctx, len: number, wide: number, horiz: boolean, seed: number): void {
  const rand = rng(seed * 31 + 7);
  const w = horiz ? len : wide;
  const h = horiz ? wide : len;
  const x0 = 4;
  const y0 = 2;
  // Front edge (the side of the shelf that faces the bottom of the screen).
  rrect(c, x0, y0 + h - 6, w, 16, 4);
  c.fillStyle = '#5a2f17';
  c.fill();
  ink(c, 3);
  // Top board.
  rrect(c, x0, y0, w, h, 5);
  c.fillStyle = linear(c, 0, y0, 0, y0 + h, [[0, '#b0683a'], [1, '#8c4c26']]);
  c.fill();
  ink(c, 3);
  c.save();
  rrect(c, x0 + 1.5, y0 + 1.5, w - 3, h - 3, 4);
  c.clip();
  // Grain along its length.
  c.strokeStyle = 'rgba(70,34,14,0.3)';
  c.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    if (horiz) {
      const y = y0 + 5 + rand() * (h - 10);
      c.moveTo(x0, y);
      c.lineTo(x0 + w, y + (rand() - 0.5) * 3);
    } else {
      const x = x0 + 5 + rand() * (w - 10);
      c.moveTo(x, y0);
      c.lineTo(x + (rand() - 0.5) * 3, y0 + h);
    }
    c.stroke();
  }
  c.fillStyle = 'rgba(255,225,180,0.18)';
  if (horiz) c.fillRect(x0, y0, w, 3);
  else c.fillRect(x0, y0, 3, h);
  c.restore();
  // What's on it: a row of tins, boxes, jars and sacks.
  const n = Math.round(len / 34);
  const step = len / n;
  for (let i = 0; i < n; i++) {
    if (rand() < 0.14) continue;
    const kind = Math.floor(rand() * 4);
    const col = LABELS[Math.floor(rand() * LABELS.length)];
    const along = (i + 0.5) * step + (rand() - 0.5) * 4;
    const across = wide / 2 + (rand() - 0.5) * 5;
    const s = kind === 1 ? 20 : 24 + rand() * 4;
    const x = horiz ? x0 + along : x0 + across;
    const y = horiz ? y0 + across : y0 + along;
    c.save();
    c.translate(x, y);
    if (kind === 1) c.rotate((horiz ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.3);
    shelfItem(c, 0, 0, s, kind, col);
    c.restore();
  }
}

// ---------------------------------------------------------------- Scenery (soft and outline-free, like every stage's props)

function rice(c: Ctx, w: number, h: number): void {
  const rand = rng(211);
  for (let i = 0; i < 26; i++) {
    const x = w / 2 + (rand() - 0.5) * w * 0.8;
    const y = h / 2 + (rand() - 0.5) * h * 0.7;
    c.save();
    c.translate(x, y);
    c.rotate(rand() * TAU);
    c.fillStyle = 'rgba(245,238,220,0.55)';
    c.beginPath();
    c.ellipse(0, 0, 3.4, 1.3, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}

function macaroni(c: Ctx, w: number, h: number): void {
  const rand = rng(223);
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = w / 2 + (rand() - 0.5) * w * 0.7;
    const y = h / 2 + (rand() - 0.5) * h * 0.6;
    const a = rand() * TAU;
    c.strokeStyle = 'rgba(40,24,12,0.18)';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(x + 1.5, y + 2.5, 7, a, a + 2.2);
    c.stroke();
    c.strokeStyle = 'rgba(226,186,98,0.7)';
    c.lineWidth = 4.5;
    c.beginPath();
    c.arc(x, y, 7, a, a + 2.2);
    c.stroke();
    c.strokeStyle = 'rgba(250,226,150,0.45)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(x, y, 8, a + 0.2, a + 2);
    c.stroke();
  }
}

function bayLeaves(c: Ctx, w: number, h: number): void {
  const rand = rng(227);
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(w / 2 + (rand() - 0.5) * w * 0.5, h / 2 + (rand() - 0.5) * h * 0.4);
    c.rotate(rand() * TAU);
    c.fillStyle = 'rgba(40,24,12,0.16)';
    c.beginPath();
    c.ellipse(2, 3, 20, 7.5, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(112,128,78,0.75)';
    c.beginPath();
    c.moveTo(-21, 0);
    c.quadraticCurveTo(0, -10, 21, 0);
    c.quadraticCurveTo(0, 10, -21, 0);
    c.fill();
    c.strokeStyle = 'rgba(70,84,48,0.6)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-19, 0);
    c.lineTo(19, 0);
    c.stroke();
    c.restore();
  }
}

function flourSpill(c: Ctx, w: number, h: number): void {
  const rand = rng(229);
  for (let j = 0; j < 12; j++) soft(c, w / 2 + (rand() - 0.5) * w * 0.62, h / 2 + (rand() - 0.5) * h * 0.5, 12 + rand() * 14, '250,246,236', 0.3);
}

function jarLid(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  soft(c, x + 4, y + 6, 30, '40,24,12', 0.28);
  circle(c, x, y, 22);
  c.fillStyle = radial(c, x, y, 22, [[0, 'rgba(214,190,120,0.85)'], [1, 'rgba(150,120,62,0.85)']]);
  c.fill();
  c.strokeStyle = 'rgba(110,84,40,0.55)';
  c.lineWidth = 2;
  circle(c, x, y, 21);
  c.stroke();
  circle(c, x, y, 14);
  c.stroke();
}

function peppercorns(c: Ctx, w: number, h: number): void {
  const rand = rng(233);
  for (let i = 0; i < 12; i++) {
    const x = w / 2 + (rand() - 0.5) * w * 0.75;
    const y = h / 2 + (rand() - 0.5) * h * 0.65;
    soft(c, x, y, 3.2 + rand() * 1.5, '40,30,26', 0.7);
  }
}

function twine(c: Ctx, w: number, h: number): void {
  c.lineCap = 'round';
  for (const [col, lw, off] of [['rgba(40,24,12,0.16)', 4, 2.5], ['rgba(206,178,128,0.7)', 2.6, 0]] as [string, number, number][]) {
    c.strokeStyle = col;
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(w * 0.1, h * 0.6 + off);
    c.bezierCurveTo(w * 0.3, h * 0.05 + off, w * 0.45, h * 0.95 + off, w * 0.6, h * 0.45 + off);
    c.bezierCurveTo(w * 0.68, h * 0.2 + off, w * 0.8, h * 0.3 + off, w * 0.9, h * 0.55 + off);
    c.stroke();
  }
}

function labelScrap(c: Ctx, w: number, h: number): void {
  c.save();
  c.translate(w / 2, h / 2);
  c.fillStyle = 'rgba(40,24,12,0.16)';
  c.fillRect(-26, -13, 56, 32);
  c.fillStyle = 'rgba(236,224,196,0.7)';
  c.beginPath();
  c.moveTo(-28, -16);
  c.lineTo(26, -14);
  c.lineTo(28, 12);
  c.lineTo(8, 16);
  c.lineTo(-4, 11);
  c.lineTo(-27, 15);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(190,70,50,0.5)';
  c.fillRect(-20, -9, 40, 6);
  c.fillStyle = 'rgba(120,100,80,0.4)';
  c.fillRect(-20, 1, 30, 2.5);
  c.fillRect(-20, 6, 20, 2.5);
  c.restore();
}

export const PANTRY_PROPS: PropDef[] = [
  { key: 'prop_rice', w: 110, h: 70, weight: 1.1, spin: true, draw: rice },
  { key: 'prop_macaroni', w: 110, h: 80, weight: 0.9, spin: true, draw: macaroni },
  { key: 'prop_bay', w: 110, h: 80, weight: 0.8, spin: true, draw: bayLeaves },
  { key: 'prop_pflour', w: 130, h: 80, weight: 1, spin: false, draw: flourSpill },
  { key: 'prop_lid', w: 70, h: 70, weight: 0.6, spin: true, draw: jarLid },
  { key: 'prop_peppercorn', w: 100, h: 70, weight: 0.9, spin: true, draw: peppercorns },
  { key: 'prop_twine', w: 150, h: 60, weight: 0.6, spin: true, draw: twine },
  { key: 'prop_label', w: 80, h: 56, weight: 0.6, spin: true, draw: labelScrap },
];

// ---------------------------------------------------------------- Stage pictures

/** The stage card's picture for the Pantry (stage4) or the Bread Bin (stage5). The caller clips and frames it. */
export function drawPantryThumb(c: Ctx, id: string, w: number, h: number): void {
  if (id === 'stage4') {
    c.save();
    c.scale(w / 170, w / 170);
    drawPantryFloor(c, 256);
    c.restore();
    c.save();
    const k = w / 120;
    c.translate(w * 0.5 - 62 * k, h * 0.3);
    c.scale(k * 0.66, k * 0.5);
    drawShelf(c, 176, 40, true, 1);
    c.restore();
    c.save();
    c.translate(w * 0.5 - 62 * k, h * 0.68);
    c.scale(k * 0.66, k * 0.5);
    drawShelf(c, 176, 40, true, 2);
    c.restore();
  } else {
    // The Bread Bin: dark, with a crown glinting in it.
    c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#2a1c14'], [1, '#120b07']]);
    c.fillRect(0, 0, w, h);
    soft(c, w / 2, h * 0.55, w * 0.42, '255,196,92', 0.26);
    const u = Math.min(w, h) * 0.2;
    c.save();
    c.translate(w / 2, h * 0.55);
    c.beginPath();
    c.moveTo(-u * 1.3, u * 0.7);
    c.lineTo(-u * 1.5, -u * 0.6);
    c.lineTo(-u * 0.7, u * 0.05);
    c.lineTo(0, -u * 1.05);
    c.lineTo(u * 0.7, u * 0.05);
    c.lineTo(u * 1.5, -u * 0.6);
    c.lineTo(u * 1.3, u * 0.7);
    c.closePath();
    c.fillStyle = linear(c, 0, -u, 0, u, [[0, '#f8d76a'], [1, '#b47a1e']]);
    c.fill();
    ink(c, Math.max(1.5, u * 0.16));
    c.fillStyle = '#fff6cf';
    circle(c, -u * 0.45, -u * 0.15, u * 0.12);
    c.fill();
    c.restore();
  }
}

// ---------------------------------------------------------------- Enemies

/** Dust Bunny: a grey ball of fluff with two tufty ears. */
export function drawDustBunny(c: Ctx, s: number): void {
  const m = s / 2;
  const r = s * 0.36;
  const line = Math.max(1.6, s * 0.08);
  c.beginPath();
  // Ears first, then a scalloped body.
  for (const dir of [-1, 1]) {
    c.moveTo(m + dir * r * 0.2, m - r * 0.6);
    c.quadraticCurveTo(m + dir * r * 0.5, m - r * 1.7, m + dir * r * 0.9, m - r * 0.45);
  }
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const px = m + Math.cos(a) * r;
    const py = m + r * 0.12 + Math.sin(a) * r * 0.92;
    if (!i) c.moveTo(px, py);
    else {
      const am = ((i - 0.5) / n) * TAU;
      c.quadraticCurveTo(m + Math.cos(am) * r * 1.28, m + r * 0.12 + Math.sin(am) * r * 1.18, px, py);
    }
  }
  c.closePath();
  c.fillStyle = radial(c, m, m, r * 1.2, [[0, '#cfc8c0'], [1, '#8d857d']]);
  c.fill();
  ink(c, line);
  angryEye(c, m - r * 0.38, m + r * 0.05, r * 0.24, -1, line);
  angryEye(c, m + r * 0.38, m + r * 0.05, r * 0.24, 1, line);
}

/** Rolling Pea Can: a tin standing up, with a green label and a scowl. */
export function drawPeaCan(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const line = 2;
  const rw = w * 0.4;
  rrect(c, x - rw, h * 0.14, rw * 2, h * 0.8, [3, 3, 6, 6]);
  c.fillStyle = linear(c, x - rw, 0, x + rw, 0, [[0, '#8f9ca6'], [0.35, '#e6edf1'], [1, '#77848e']]);
  c.fill();
  ink(c, line);
  // Label
  c.fillStyle = linear(c, x - rw, 0, x + rw, 0, [[0, '#3f8a3a'], [0.4, '#6fc05a'], [1, '#2f6f2e']]);
  c.fillRect(x - rw + 1, h * 0.3, rw * 2 - 2, h * 0.5);
  c.fillStyle = '#b7e88a';
  for (const [dx, dy] of [[-0.24, 0.72], [0, 0.75], [0.24, 0.72]]) {
    circle(c, x + w * dx, h * dy, w * 0.07);
    c.fill();
  }
  // Lid
  c.beginPath();
  c.ellipse(x, h * 0.15, rw, h * 0.09, 0, 0, TAU);
  c.fillStyle = '#dfe7ec';
  c.fill();
  ink(c, line);
  c.beginPath();
  c.ellipse(x, h * 0.15, rw * 0.62, h * 0.05, 0, 0, TAU);
  c.strokeStyle = 'rgba(90,104,114,0.7)';
  c.lineWidth = 1.2;
  c.stroke();
  angryEye(c, x - w * 0.16, h * 0.5, w * 0.1, -1, line);
  angryEye(c, x + w * 0.16, h * 0.5, w * 0.1, 1, line);
}

/** Pepper Shaker: a glass shaker full of black pepper, with a holed metal cap. */
export function drawPepperShaker(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const line = 2;
  // Glass body
  c.beginPath();
  c.moveTo(x - w * 0.24, h * 0.3);
  c.lineTo(x - w * 0.36, h - 4);
  c.quadraticCurveTo(x - w * 0.36, h - 1.5, x - w * 0.28, h - 1.5);
  c.lineTo(x + w * 0.28, h - 1.5);
  c.quadraticCurveTo(x + w * 0.36, h - 1.5, x + w * 0.36, h - 4);
  c.lineTo(x + w * 0.24, h * 0.3);
  c.closePath();
  c.fillStyle = linear(c, 0, h * 0.3, 0, h, [[0, '#6a625c'], [1, '#2a2522']]);
  c.fill();
  ink(c, line);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  rrect(c, x - w * 0.25, h * 0.4, w * 0.07, h * 0.4, 2);
  c.fill();
  // Cap
  c.beginPath();
  c.moveTo(x - w * 0.27, h * 0.32);
  c.quadraticCurveTo(x - w * 0.27, h * 0.04, x, h * 0.04);
  c.quadraticCurveTo(x + w * 0.27, h * 0.04, x + w * 0.27, h * 0.32);
  c.closePath();
  c.fillStyle = radial(c, x, h * 0.18, w * 0.3, [[0, '#f1f4f6'], [1, '#93a0a9']]);
  c.fill();
  ink(c, line);
  c.fillStyle = INK;
  for (const [dx, dy] of [[-0.1, 0.16], [0.1, 0.16], [0, 0.11], [0, 0.22]]) {
    circle(c, x + w * dx, h * dy, 1.1);
    c.fill();
  }
  angryEye(c, x - w * 0.14, h * 0.6, w * 0.1, -1, line, '#ffb22e');
  angryEye(c, x + w * 0.14, h * 0.6, w * 0.1, 1, line, '#ffb22e');
}

/** Sugar Cube (or, small, one of its crystals): a white block with a sparkle. */
export function drawSugarCube(c: Ctx, s: number, shard = false): void {
  const m = s / 2;
  const line = Math.max(1.6, s * 0.075);
  if (shard) {
    c.beginPath();
    c.moveTo(m, 1.5);
    c.lineTo(s - 2.5, m * 0.9);
    c.lineTo(m * 1.2, s - 1.5);
    c.lineTo(2.5, m * 1.15);
    c.closePath();
    c.fillStyle = linear(c, 0, 0, s, s, [[0, '#ffffff'], [1, '#c9dcec']]);
    c.fill();
    ink(c, line);
    angryEye(c, m - s * 0.13, m, s * 0.1, -1, line);
    angryEye(c, m + s * 0.15, m, s * 0.1, 1, line);
    return;
  }
  const a = s * 0.36;
  // Top face, then the front.
  c.beginPath();
  c.moveTo(m - a, m - a * 0.5);
  c.lineTo(m - a * 0.55, m - a * 1.05);
  c.lineTo(m + a * 1.05, m - a * 1.05);
  c.lineTo(m + a, m - a * 0.5);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, line);
  rrect(c, m - a, m - a * 0.5, a * 2, a * 1.6, [0, 0, 3, 3]);
  c.fillStyle = linear(c, 0, m - a * 0.5, 0, m + a * 1.1, [[0, '#f4f8fb'], [1, '#c5d6e4']]);
  c.fill();
  ink(c, line);
  // Grains
  c.fillStyle = 'rgba(150,176,198,0.7)';
  const rand = rng(41);
  for (let i = 0; i < 9; i++) c.fillRect(m - a + 2 + rand() * (a * 2 - 4), m + a * 0.45 + rand() * a * 0.55, 1.2, 1.2);
  angryEye(c, m - a * 0.42, m + a * 0.1, a * 0.27, -1, line);
  angryEye(c, m + a * 0.42, m + a * 0.1, a * 0.27, 1, line);
}

/** Mold Spore: a fuzzy green ball that floats. */
export function drawSpore(c: Ctx, s: number): void {
  const m = s / 2;
  const r = s * 0.3;
  const line = Math.max(1.5, s * 0.08);
  c.strokeStyle = INK;
  c.lineWidth = line;
  c.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    c.beginPath();
    c.moveTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
    c.lineTo(m + Math.cos(a) * r * 1.45, m + Math.sin(a) * r * 1.45);
    c.stroke();
  }
  circle(c, m, m, r);
  c.fillStyle = radial(c, m, m, r, [[0, '#c4e684'], [1, '#6c9c38']]);
  c.fill();
  ink(c, line);
  angryEye(c, m - r * 0.4, m, r * 0.26, -1, line);
  angryEye(c, m + r * 0.4, m, r * 0.26, 1, line);
}

/** Moldy Loaf (elite): a loaf of bread gone green in patches. */
export function drawMoldyLoaf(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const line = 3;
  const body = () => {
    c.beginPath();
    c.moveTo(x - w * 0.42, h - 5);
    c.lineTo(x - w * 0.42, h * 0.5);
    c.bezierCurveTo(x - w * 0.5, h * 0.3, x - w * 0.4, h * 0.08, x - w * 0.16, h * 0.12);
    c.bezierCurveTo(x - w * 0.06, h * 0.02, x + w * 0.06, h * 0.02, x + w * 0.16, h * 0.12);
    c.bezierCurveTo(x + w * 0.4, h * 0.08, x + w * 0.5, h * 0.3, x + w * 0.42, h * 0.5);
    c.lineTo(x + w * 0.42, h - 5);
    c.closePath();
  };
  body();
  c.fillStyle = radial(c, x, h * 0.5, w * 0.5, [[0, '#e3b06a'], [0.7, '#b97a38'], [1, '#8a5222']]);
  c.fill();
  ink(c, line);
  c.save();
  body();
  c.clip();
  // The cut face is paler.
  c.fillStyle = 'rgba(248,226,178,0.55)';
  rrect(c, x - w * 0.34, h * 0.5, w * 0.68, h * 0.5, 6);
  c.fill();
  // Mold patches.
  const rand = rng(77);
  for (const [px, py, pr] of [[0.2, 0.26, 0.2], [0.78, 0.36, 0.17], [0.3, 0.84, 0.16], [0.66, 0.92, 0.2], [0.5, 0.14, 0.12]]) {
    for (let k = 0; k < 4; k++) {
      circle(c, w * px + (rand() - 0.5) * w * 0.12, h * py + (rand() - 0.5) * h * 0.1, w * pr * (0.5 + rand() * 0.5));
      c.fillStyle = k % 2 ? '#8fb04e' : '#5f8a34';
      c.fill();
    }
  }
  c.restore();
  body();
  ink(c, line);
  angryEye(c, x - w * 0.15, h * 0.56, w * 0.085, -1, 2.4, '#d8ff6a');
  angryEye(c, x + w * 0.15, h * 0.56, w * 0.085, 1, 2.4, '#d8ff6a');
  c.beginPath();
  c.arc(x, h * 0.82, w * 0.09, Math.PI * 1.1, Math.PI * 1.9);
  ink(c, 2.4);
}

/** Broiler Jr.: the Broiler, shrunk. */
export function drawBroilerJr(c: Ctx, w: number, h: number): void {
  c.save();
  c.scale(w / 112, h / 96);
  drawBroiler(c, 112, 96);
  c.restore();
}

/** The regular Molten Muffin of the Pantry: the oven's elite, small. */
export function drawSmallMuffin(c: Ctx, s: number): void {
  c.save();
  c.scale(s / 60, s / 60);
  drawMoltenMuffin(c, 60);
  c.restore();
}

/** One wavy noodle strand from (x0, y0) to (x1, y1). */
function noodle(c: Ctx, pts: number[], lw: number): void {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const path = () => {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length - 2; i += 2) {
      const mx = (pts[i] + pts[i + 2]) / 2;
      const my = (pts[i + 1] + pts[i + 3]) / 2;
      c.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
    }
    c.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
  };
  path();
  c.strokeStyle = INK;
  c.lineWidth = lw + 3.2;
  c.stroke();
  path();
  c.strokeStyle = '#f2d77a';
  c.lineWidth = lw;
  c.stroke();
  path();
  c.strokeStyle = 'rgba(255,246,200,0.7)';
  c.lineWidth = lw * 0.3;
  c.stroke();
}

/** Spaghetti Tangle (mini-boss): a ball of noodles with two meatball eyes glaring out. */
export function drawTangle(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2 + 2;
  const r = Math.min(w, h) * 0.4;
  circle(c, x, y, r);
  c.fillStyle = radial(c, x, y, r, [[0, '#f0cf6c'], [1, '#b98a2c']]);
  c.fill();
  ink(c, 3);
  const rand = rng(91);
  // Loose strands whipping out.
  noodle(c, [x - r * 0.7, y - r * 0.5, x - r * 1.25, y - r * 0.9, x - r * 1.1, y - r * 0.2, x - r * 1.2, y + r * 0.1], 4.4);
  noodle(c, [x + r * 0.7, y - r * 0.5, x + r * 1.2, y - r * 1.0, x + r * 1.2, y - r * 0.2, x + r * 1.15, y + r * 0.2], 4.4);
  noodle(c, [x - r * 0.3, y + r * 0.8, x - r * 0.7, y + r * 1.25, x - r * 0.1, y + r * 1.1], 4.4);
  c.save();
  circle(c, x, y, r - 1.5);
  c.clip();
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU;
    const b = a + 1.6 + rand() * 1.6;
    const k = 0.55 + rand() * 0.5;
    noodle(c, [x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, x + Math.cos((a + b) / 2) * r * k * 0.5, y + Math.sin((a + b) / 2) * r * k * 0.5, x + Math.cos(b) * r * 1.1, y + Math.sin(b) * r * 1.1], 4.2);
  }
  c.restore();
  circle(c, x, y, r);
  ink(c, 3);
  // Meatballs with eyes.
  for (const dir of [-1, 1]) {
    circle(c, x + dir * r * 0.36, y - r * 0.05, r * 0.27);
    c.fillStyle = radial(c, x + dir * r * 0.36, y - r * 0.05, r * 0.27, [[0, '#a8603a'], [1, '#5f2e18']]);
    c.fill();
    ink(c, 2.4);
    angryEye(c, x + dir * r * 0.36, y - r * 0.03, r * 0.15, dir, 2.2);
  }
  c.beginPath();
  c.arc(x, y + r * 0.62, r * 0.2, Math.PI * 1.15, Math.PI * 1.85);
  ink(c, 2.6);
}

/**
 * Mother Dough (boss): an ancient sourdough starter in a glass jar, bulging over the rim. `risen` is her second
 * phase: out of the jar and twice the dough.
 */
export function drawMotherDough(c: Ctx, w: number, h: number, risen: boolean): void {
  const x = w / 2;
  const line = 3.4;
  const jw = w * (risen ? 0.27 : 0.36);
  const jt = h * (risen ? 0.62 : 0.42);
  const jb = h - 5;
  // The jar.
  rrect(c, x - jw, jt, jw * 2, jb - jt, [4, 4, 12, 12]);
  c.fillStyle = linear(c, x - jw, 0, x + jw, 0, [[0, 'rgba(190,224,232,0.92)'], [0.3, 'rgba(236,248,250,0.95)'], [1, 'rgba(150,196,208,0.92)']]);
  c.fill();
  ink(c, line);
  c.save();
  rrect(c, x - jw + 2, jt + 2, jw * 2 - 4, jb - jt - 4, [3, 3, 10, 10]);
  c.clip();
  c.fillStyle = '#ead7ad';
  c.fillRect(x - jw, jt + (jb - jt) * 0.12, jw * 2, jb - jt);
  // Bubbles in the starter.
  c.strokeStyle = 'rgba(150,120,70,0.6)';
  c.lineWidth = 1.5;
  const rand = rng(risen ? 131 : 127);
  for (let i = 0; i < 9; i++) {
    circle(c, x - jw + 6 + rand() * (jw * 2 - 12), jt + (jb - jt) * (0.25 + rand() * 0.7), 2 + rand() * 4);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.fillRect(x - jw + 5, jt + 4, jw * 0.22, jb - jt - 12);
  c.restore();
  // A cloth band and its label.
  rrect(c, x - jw * 0.6, jt + (jb - jt) * 0.5, jw * 1.2, (jb - jt) * 0.28, 3);
  c.fillStyle = '#fff3dc';
  c.fill();
  ink(c, 2);
  c.fillStyle = '#a8442e';
  c.fillRect(x - jw * 0.42, jt + (jb - jt) * 0.58, jw * 0.84, 3);
  c.fillRect(x - jw * 0.3, jt + (jb - jt) * 0.67, jw * 0.6, 2.4);
  // The dough, bulging out over the rim.
  const dw = w * (risen ? 0.47 : 0.44);
  const top = risen ? h * 0.05 : h * 0.07;
  const low = jt + h * (risen ? 0.1 : 0.09);
  const dough = () => {
    c.beginPath();
    c.moveTo(x - dw * 0.8, low);
    c.bezierCurveTo(x - dw * 1.12, low - h * 0.04, x - dw * 1.08, top + h * 0.14, x - dw * 0.62, top + h * 0.1);
    c.bezierCurveTo(x - dw * 0.55, top - h * 0.03, x - dw * 0.12, top - h * 0.04, x, top + h * 0.03);
    c.bezierCurveTo(x + dw * 0.14, top - h * 0.05, x + dw * 0.6, top - h * 0.02, x + dw * 0.64, top + h * 0.11);
    c.bezierCurveTo(x + dw * 1.1, top + h * 0.15, x + dw * 1.1, low - h * 0.03, x + dw * 0.8, low);
    // Drips down the glass.
    c.bezierCurveTo(x + dw * 0.72, low + h * 0.1, x + dw * 0.52, low + h * 0.1, x + dw * 0.46, low);
    c.bezierCurveTo(x + dw * 0.2, low + h * 0.05, x - dw * 0.1, low + h * 0.05, x - dw * 0.3, low);
    c.bezierCurveTo(x - dw * 0.36, low + h * 0.13, x - dw * 0.62, low + h * 0.13, x - dw * 0.8, low);
    c.closePath();
  };
  dough();
  c.fillStyle = radial(c, x, (top + low) / 2, dw * 1.05, [[0, '#fff4d8'], [0.65, '#ecd3a0'], [1, '#c79f64']]);
  c.fill();
  ink(c, line);
  c.save();
  dough();
  c.clip();
  c.strokeStyle = 'rgba(160,120,66,0.55)';
  c.lineWidth = 2;
  for (const [bx, by, br] of [[-0.6, 0.3, 0.07], [0.62, 0.36, 0.06], [0.2, 0.14, 0.05], [-0.25, 0.16, 0.04], [0.72, 0.7, 0.05], [-0.7, 0.72, 0.05]]) {
    circle(c, x + dw * bx, top + (low - top) * by, w * br);
    c.stroke();
  }
  c.restore();
  // Her face.
  const fy = top + (low - top) * 0.56;
  const er = w * (risen ? 0.075 : 0.07);
  angryEye(c, x - dw * 0.3, fy, er, -1, 3, risen ? '#ff4536' : '#ffb22e');
  angryEye(c, x + dw * 0.3, fy, er, 1, 3, risen ? '#ff4536' : '#ffb22e');
  c.beginPath();
  if (risen) {
    // A wide, open roar.
    c.ellipse(x, fy + (low - top) * 0.3, dw * 0.2, (low - top) * 0.12, 0, 0, TAU);
    c.fillStyle = '#6a2a1a';
    c.fill();
    ink(c, 2.8);
  } else {
    c.arc(x, fy + (low - top) * 0.36, dw * 0.16, Math.PI * 1.15, Math.PI * 1.85);
    ink(c, 3);
  }
}

/** Dough Ball: a little lump of Mother Dough. */
export function drawDoughBall(c: Ctx, s: number): void {
  const m = s / 2;
  const r = s * 0.4;
  const line = Math.max(1.6, s * 0.08);
  c.beginPath();
  c.moveTo(m - r, m + r * 0.3);
  c.bezierCurveTo(m - r * 1.1, m - r * 0.9, m - r * 0.2, m - r * 1.1, m, m - r * 0.85);
  c.bezierCurveTo(m + r * 0.4, m - r * 1.15, m + r * 1.15, m - r * 0.6, m + r, m + r * 0.3);
  c.bezierCurveTo(m + r * 0.9, m + r * 1.05, m - r * 0.9, m + r * 1.05, m - r, m + r * 0.3);
  c.closePath();
  c.fillStyle = radial(c, m, m, r, [[0, '#fff4d8'], [1, '#d0aa6e']]);
  c.fill();
  ink(c, line);
  angryEye(c, m - r * 0.38, m + r * 0.05, r * 0.24, -1, line);
  angryEye(c, m + r * 0.38, m + r * 0.05, r * 0.24, 1, line);
}

// ---------------------------------------------------------------- Shots

/** Pepper Shaker's shot: a black speck with a thick pale rim, so it shows on the dim floor. */
export function drawPepperShot(c: Ctx, s: number): void {
  const m = s / 2;
  circle(c, m, m, s * 0.46);
  c.fillStyle = '#fff3dc';
  c.fill();
  circle(c, m, m, s * 0.3);
  c.fillStyle = '#2a2420';
  c.fill();
  circle(c, m - s * 0.08, m - s * 0.08, s * 0.08);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fill();
}

/** Mother Dough's shot: a blob of dough with a hot red rim, like every enemy shot. */
export function drawDoughShot(c: Ctx, s: number): void {
  const m = s / 2;
  circle(c, m, m, s * 0.47);
  c.fillStyle = '#e0533d';
  c.fill();
  circle(c, m, m, s * 0.36);
  c.fillStyle = radial(c, m, m, s * 0.36, [[0, '#fff8e4'], [1, '#e2c084']]);
  c.fill();
  ink(c, 1.4);
}

/** One of Mother Dough's bubbles, as it bursts. */
export function drawBubble(c: Ctx, s: number): void {
  const m = s / 2;
  circle(c, m, m, s * 0.44);
  c.fillStyle = 'rgba(255,244,214,0.75)';
  c.fill();
  ink(c, 2.2);
  c.beginPath();
  c.arc(m, m, s * 0.3, Math.PI * 1.1, Math.PI * 1.6);
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  c.stroke();
}

// ---------------------------------------------------------------- Hazards

/** A rolling can, lying on its side and seen from above. It rolls to the right; the game turns it for other ways. */
export function drawRollingCan(c: Ctx, s: number): void {
  const m = s / 2;
  const hw = s * 0.34;
  const hh = s * 0.44;
  rrect(c, m - hw, m - hh, hw * 2, hh * 2, 5);
  c.fillStyle = linear(c, m - hw, 0, m + hw, 0, [[0, '#8f9ca6'], [0.4, '#eef3f6'], [1, '#7a8791']]);
  c.fill();
  ink(c, 3);
  // A red label: red means it hurts.
  c.fillStyle = linear(c, m - hw, 0, m + hw, 0, [[0, '#b8301e'], [0.4, '#f0624a'], [1, '#a02616']]);
  c.fillRect(m - hw + 1.5, m - hh * 0.62, hw * 2 - 3, hh * 1.24);
  c.fillStyle = '#fff3dc';
  rrect(c, m - hw * 0.5, m - hh * 0.3, hw, hh * 0.6, 2);
  c.fill();
  c.strokeStyle = 'rgba(60,70,78,0.6)';
  c.lineWidth = 1.2;
  for (const y of [m - hh * 0.8, m + hh * 0.8]) {
    c.beginPath();
    c.moveTo(m - hw + 2, y);
    c.lineTo(m + hw - 2, y);
    c.stroke();
  }
}

/** A flour sack about to burst. */
export function drawFlourSack(c: Ctx, w: number, h: number): void {
  const x = w / 2;
  c.beginPath();
  c.moveTo(x - w * 0.36, h - 3);
  c.bezierCurveTo(x - w * 0.5, h * 0.6, x - w * 0.36, h * 0.32, x - w * 0.16, h * 0.28);
  c.lineTo(x - w * 0.26, h * 0.08);
  c.lineTo(x + w * 0.26, h * 0.08);
  c.lineTo(x + w * 0.16, h * 0.28);
  c.bezierCurveTo(x + w * 0.36, h * 0.32, x + w * 0.5, h * 0.6, x + w * 0.36, h - 3);
  c.closePath();
  c.fillStyle = radial(c, x, h * 0.6, w * 0.5, [[0, '#fbf3e0'], [1, '#cbb88e']]);
  c.fill();
  ink(c, 2.6);
  // Tie
  c.beginPath();
  c.moveTo(x - w * 0.17, h * 0.28);
  c.lineTo(x + w * 0.17, h * 0.28);
  c.strokeStyle = '#a8442e';
  c.lineWidth = 3;
  c.stroke();
  // A wheat mark
  c.strokeStyle = '#b98a3c';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, h * 0.5);
  c.lineTo(x, h * 0.8);
  c.moveTo(x, h * 0.58);
  c.lineTo(x - w * 0.1, h * 0.5);
  c.moveTo(x, h * 0.58);
  c.lineTo(x + w * 0.1, h * 0.5);
  c.moveTo(x, h * 0.68);
  c.lineTo(x - w * 0.1, h * 0.6);
  c.moveTo(x, h * 0.68);
  c.lineTo(x + w * 0.1, h * 0.6);
  c.stroke();
}

/** A cloud of flour hanging over the floor. */
export function drawFlourCloud(c: Ctx, s: number): void {
  const m = s / 2;
  const rand = rng(151);
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU;
    const d = rand() * s * 0.26;
    soft(c, m + Math.cos(a) * d, m + Math.sin(a) * d, s * (0.16 + rand() * 0.12), '255,253,246', 0.5);
  }
  soft(c, m, m, s * 0.4, '255,253,246', 0.55);
}

/** A knot of noodles tying the way shut (drawn lying left to right; `tall` stands it on end). */
export function drawKnot(c: Ctx, w: number, h: number): void {
  const tall = h > w;
  c.save();
  if (tall) {
    c.translate(w, 0);
    c.rotate(Math.PI / 2);
  }
  const L = tall ? h : w;
  const T = tall ? w : h;
  const y = T / 2;
  noodle(c, [4, y - 6, L * 0.25, y + 12, L * 0.5, y - 12, L * 0.75, y + 12, L - 4, y - 5], 7);
  noodle(c, [4, y + 6, L * 0.25, y - 12, L * 0.5, y + 12, L * 0.75, y - 12, L - 4, y + 5], 7);
  // The knot in the middle.
  noodle(c, [L * 0.42, y - 9, L * 0.5, y + 14, L * 0.58, y - 9, L * 0.5, y - 14, L * 0.42, y - 9], 6);
  c.restore();
}

/** A wall of dough pushed up out of the floor. */
export function drawDoughWall(c: Ctx, w: number, h: number): void {
  const tall = h > w;
  c.save();
  if (tall) {
    c.translate(w, 0);
    c.rotate(Math.PI / 2);
  }
  const L = tall ? h : w;
  const T = tall ? w : h;
  c.beginPath();
  c.moveTo(6, T - 4);
  c.bezierCurveTo(-2, T * 0.4, 8, 3, L * 0.16, 5);
  c.bezierCurveTo(L * 0.24, -2, L * 0.36, -1, L * 0.42, 6);
  c.bezierCurveTo(L * 0.5, 0, L * 0.62, 0, L * 0.68, 6);
  c.bezierCurveTo(L * 0.78, -2, L * 0.9, 0, L - 8, 7);
  c.bezierCurveTo(L + 2, T * 0.4, L - 2, T - 6, L - 6, T - 4);
  c.closePath();
  c.fillStyle = linear(c, 0, 0, 0, T, [[0, '#fff4d8'], [1, '#cfa76a']]);
  c.fill();
  ink(c, 3);
  c.strokeStyle = 'rgba(160,120,66,0.55)';
  c.lineWidth = 1.8;
  for (const [bx, br] of [[0.14, 5], [0.34, 3.5], [0.55, 5], [0.76, 4], [0.9, 3]]) {
    circle(c, L * bx, T * 0.55, br);
    c.stroke();
  }
  c.restore();
}

// Stage 5, the Bread Bin: its floor, scenery, enemies, the Stale King, shots and hazards, all drawn in code.
import { angryEye, ink, linear, radial, rng, rrect } from './art';
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

/** A lumpy closed shape around (x, y): `n` bumps, radius r, wobbling by `amp`. */
function lump(c: Ctx, x: number, y: number, r: number, n: number, amp: number, seed: number, sy = 1): void {
  const rand = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - amp + rand() * amp * 2);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy]);
  }
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (!i) c.moveTo(mx, my);
    const r2 = pts[(i + 2) % n];
    c.quadraticCurveTo(q[0], q[1], (q[0] + r2[0]) / 2, (q[1] + r2[1]) / 2);
  }
  c.closePath();
}

// ---------------------------------------------------------------- Floor

/**
 * Seamless bread bin floor, size × size: the dark inside of the bin, crust-brown, with crumbs and the soft folds of
 * a paper bag. Dark and low in contrast, so the grey Stale, the warnings and the blue seeds all read against it.
 */
export function drawBinFloor(c: Ctx, size: number): void {
  const rand = rng(91);
  c.fillStyle = '#4a3323';
  c.fillRect(0, 0, size, size);
  // Paper folds: long soft bands, drawn so they wrap around the tile's edges.
  for (let i = 0; i < 5; i++) {
    const y = rand() * size;
    const h = 14 + rand() * 22;
    for (const oy of [-size, 0, size]) {
      const g = c.createLinearGradient(0, y + oy - h, 0, y + oy + h);
      g.addColorStop(0, 'rgba(255,214,160,0)');
      g.addColorStop(0.5, i % 2 ? 'rgba(255,214,160,0.07)' : 'rgba(20,10,4,0.16)');
      g.addColorStop(1, 'rgba(255,214,160,0)');
      c.fillStyle = g;
      c.fillRect(0, y + oy - h, size, h * 2);
    }
  }
  // Mottling.
  for (let i = 0; i < 9; i++) {
    const x = 24 + rand() * (size - 48);
    const y = 24 + rand() * (size - 48);
    soft(c, x, y, 16 + rand() * 20, i % 3 ? '24,14,8' : '150,104,62', i % 3 ? 0.22 : 0.12);
  }
  // Crumbs, kept clear of the edges so nothing is cut at the seam.
  for (let i = 0; i < 46; i++) {
    const x = 6 + rand() * (size - 12);
    const y = 6 + rand() * (size - 12);
    const r = 0.8 + rand() * 1.7;
    c.fillStyle = rand() < 0.5 ? 'rgba(196,150,96,0.5)' : 'rgba(28,17,10,0.5)';
    circle(c, x, y, r);
    c.fill();
  }
}

// ---------------------------------------------------------------- Props

function breadTag(c: Ctx, w: number, h: number): void {
  const col = ['#5aa9e6', '#e8b53a', '#e0533d'][Math.floor(w) % 3];
  rrect(c, w * 0.14, h * 0.14, w * 0.72, h * 0.72, w * 0.12);
  c.fillStyle = col;
  c.globalAlpha = 0.75;
  c.fill();
  c.globalAlpha = 1;
  ink(c, 2);
  // The notch that clips the bag.
  c.globalCompositeOperation = 'destination-out';
  circle(c, w * 0.5, h * 0.42, w * 0.15);
  c.fill();
  c.fillRect(w * 0.44, h * 0.05, w * 0.12, h * 0.34);
  c.globalCompositeOperation = 'source-over';
}

function twistTie(c: Ctx, w: number, h: number): void {
  c.lineCap = 'round';
  for (const [lw, col] of [[6, '#1c120b'], [3, '#d8d2c8']] as [number, string][]) {
    c.lineWidth = lw;
    c.strokeStyle = col;
    c.globalAlpha = lw === 6 ? 0.55 : 0.8;
    c.beginPath();
    c.moveTo(w * 0.08, h * 0.6);
    c.bezierCurveTo(w * 0.3, h * 0.05, w * 0.42, h * 0.95, w * 0.6, h * 0.45);
    c.bezierCurveTo(w * 0.7, h * 0.2, w * 0.82, h * 0.7, w * 0.93, h * 0.4);
    c.stroke();
  }
  c.globalAlpha = 1;
}

function staleCrust(c: Ctx, w: number, h: number): void {
  lump(c, w / 2, h / 2, Math.min(w, h) * 0.4, 9, 0.2, 5, 0.6);
  c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#9a8468'], [1, '#6a563f']]);
  c.globalAlpha = 0.85;
  c.fill();
  c.globalAlpha = 1;
  ink(c, 2);
  c.fillStyle = 'rgba(40,28,18,0.35)';
  for (const [x, y] of [[0.4, 0.45], [0.55, 0.55], [0.62, 0.42]]) {
    circle(c, w * x, h * y, 1.6);
    c.fill();
  }
}

function raisin(c: Ctx, w: number, h: number): void {
  lump(c, w / 2, h / 2, Math.min(w, h) * 0.34, 8, 0.25, 12, 0.8);
  c.fillStyle = radial(c, w * 0.45, h * 0.42, w * 0.4, [[0, '#5a3550'], [1, '#2a1626']]);
  c.fill();
  ink(c, 2);
  c.strokeStyle = 'rgba(20,10,18,0.6)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(w * 0.36, h * 0.4);
  c.quadraticCurveTo(w * 0.5, h * 0.52, w * 0.64, h * 0.42);
  c.stroke();
}

function crumbPile(c: Ctx, w: number, h: number): void {
  const rand = rng(33);
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * Math.min(w, h) * 0.42;
    c.fillStyle = ['rgba(196,150,96,0.7)', 'rgba(150,108,66,0.7)', 'rgba(120,112,104,0.7)'][i % 3];
    circle(c, w / 2 + Math.cos(a) * d * 1.3, h / 2 + Math.sin(a) * d * 0.8, 1.2 + rand() * 2.4);
    c.fill();
  }
}

export const BIN_PROPS: PropDef[] = [
  { key: 'prop_tag', w: 60, h: 60, weight: 0.9, spin: true, draw: breadTag },
  { key: 'prop_twist', w: 130, h: 50, weight: 0.8, spin: true, draw: twistTie },
  { key: 'prop_crust', w: 110, h: 70, weight: 1, spin: true, draw: staleCrust },
  { key: 'prop_raisin', w: 44, h: 40, weight: 0.5, spin: true, draw: raisin },
  { key: 'prop_crumbs', w: 120, h: 80, weight: 1.2, spin: true, draw: crumbPile },
];

// ---------------------------------------------------------------- Enemies

/** Stale Crumb: a hard grey crumb. The swarm of the last stage. */
export function drawStaleCrumb(c: Ctx, s: number): void {
  const m = s / 2;
  const r = s * 0.38;
  const line = Math.max(1.6, s * 0.08);
  lump(c, m, m, r, 8, 0.16, 7);
  c.fillStyle = radial(c, m - r * 0.3, m - r * 0.3, r * 1.4, [[0, '#b9b4ac'], [1, '#6f6a64']]);
  c.fill();
  ink(c, line);
  c.fillStyle = 'rgba(40,36,32,0.4)';
  circle(c, m + r * 0.35, m - r * 0.4, r * 0.1);
  c.fill();
  angryEye(c, m - r * 0.36, m + r * 0.05, r * 0.24, -1, line, '#9fe0ff');
  angryEye(c, m + r * 0.36, m + r * 0.05, r * 0.24, 1, line, '#9fe0ff');
}

/** Puff Spore: a pale green puffball, swollen and ready to pop. */
export function drawPuffSpore(c: Ctx, s: number): void {
  const m = s / 2;
  const r = s * 0.36;
  const line = Math.max(1.6, s * 0.08);
  lump(c, m, m, r, 10, 0.1, 31);
  c.fillStyle = radial(c, m - r * 0.3, m - r * 0.35, r * 1.4, [[0, '#e3f2b4'], [1, '#86a94a']]);
  c.fill();
  ink(c, line);
  // Little bumps around the rim, where the spores will fly from.
  c.fillStyle = '#f4ffd2';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - 0.4;
    circle(c, m + Math.cos(a) * r * 0.78, m + Math.sin(a) * r * 0.78, r * 0.14);
    c.fill();
  }
  angryEye(c, m - r * 0.34, m + r * 0.05, r * 0.22, -1, line);
  angryEye(c, m + r * 0.34, m + r * 0.05, r * 0.22, 1, line);
}

/** Crouton Knight: a toasted cube. With `shield`, it carries a crust shield across its front. */
export function drawKnight(c: Ctx, w: number, h: number, shield: boolean): void {
  const line = Math.max(1.8, w * 0.07);
  const bw = w * 0.62;
  const bh = h * 0.6;
  const x = (w - bw) / 2;
  const y = h * 0.2;
  rrect(c, x, y, bw, bh, bw * 0.16);
  c.fillStyle = linear(c, 0, y, 0, y + bh, [[0, '#d9a85c'], [1, '#96642c']]);
  c.fill();
  ink(c, line);
  // Toasted top edge and a few pores.
  c.fillStyle = 'rgba(96,58,22,0.55)';
  rrect(c, x + 2, y + 2, bw - 4, bh * 0.18, 3);
  c.fill();
  c.fillStyle = 'rgba(70,42,16,0.4)';
  for (const [px, py] of [[0.3, 0.75], [0.7, 0.8], [0.5, 0.9]]) {
    circle(c, x + bw * px, y + bh * py, 1.3);
    c.fill();
  }
  const er = bw * 0.15;
  angryEye(c, w / 2 - bw * 0.22, y + bh * 0.46, er, -1, line);
  angryEye(c, w / 2 + bw * 0.22, y + bh * 0.46, er, 1, line);
  if (shield) {
    // A thick heel of crust held in front, grey with a pale rim.
    c.beginPath();
    c.moveTo(w * 0.1, h * 0.62);
    c.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.9, h * 0.62);
    c.lineTo(w * 0.86, h * 0.86);
    c.quadraticCurveTo(w * 0.5, h * 1.02, w * 0.14, h * 0.86);
    c.closePath();
    c.fillStyle = linear(c, 0, h * 0.55, 0, h * 0.95, [[0, '#c9c3b8'], [1, '#77716a']]);
    c.fill();
    ink(c, line);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(w * 0.2, h * 0.67);
    c.quadraticCurveTo(w * 0.5, h * 0.58, w * 0.8, h * 0.67);
    c.stroke();
  }
}

/**
 * The Stale King: a great grey loaf with a dented gold crown. `look` 0 is whole, 1 is cracked (phase 2),
 * 2 is cracked with glowing eyes (phase 3).
 */
export function drawKing(c: Ctx, w: number, h: number, look: number): void {
  const line = Math.max(2.4, w * 0.035);
  const cx = w / 2;
  const top = h * 0.3;
  // The loaf: a domed top on a squat body.
  c.beginPath();
  c.moveTo(w * 0.1, h * 0.9);
  c.lineTo(w * 0.08, h * 0.55);
  c.bezierCurveTo(w * 0.02, top, w * 0.3, top - h * 0.06, cx, top - h * 0.04);
  c.bezierCurveTo(w * 0.7, top - h * 0.06, w * 0.98, top, w * 0.92, h * 0.55);
  c.lineTo(w * 0.9, h * 0.9);
  c.quadraticCurveTo(cx, h * 0.98, w * 0.1, h * 0.9);
  c.closePath();
  c.fillStyle = linear(c, 0, top, 0, h, [[0, '#a7a199'], [0.55, '#807a73'], [1, '#56514c']]);
  c.fill();
  ink(c, line);
  // Score marks across the top, and blotches of mould.
  c.strokeStyle = 'rgba(40,36,32,0.5)';
  c.lineWidth = line * 0.7;
  c.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    c.beginPath();
    c.moveTo(cx + k * w * 0.2 - w * 0.05, h * 0.36);
    c.lineTo(cx + k * w * 0.2 + w * 0.05, h * 0.46);
    c.stroke();
  }
  for (const [bx, by, br] of [[0.2, 0.8, 0.06], [0.82, 0.74, 0.05], [0.3, 0.58, 0.035]]) soft(c, w * bx, h * by, w * br * 2, '120,150,90', 0.5);
  if (look > 0) {
    // Cracks, lit from inside.
    c.lineJoin = 'round';
    for (const [lw, col] of [[line * 1.6, '#24160d'], [line * 0.6, look > 1 ? '#bfeaff' : '#e9dcc4']] as [number, string][]) {
      c.lineWidth = lw;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(w * 0.28, h * 0.34);
      c.lineTo(w * 0.36, h * 0.5);
      c.lineTo(w * 0.27, h * 0.6);
      c.lineTo(w * 0.34, h * 0.78);
      c.moveTo(w * 0.72, h * 0.36);
      c.lineTo(w * 0.66, h * 0.52);
      c.lineTo(w * 0.76, h * 0.66);
      c.moveTo(w * 0.5, h * 0.78);
      c.lineTo(w * 0.56, h * 0.9);
      c.stroke();
    }
  }
  // Eyes and a hard mouth.
  const er = w * 0.085;
  const ey = h * 0.6;
  if (look > 1) {
    soft(c, cx - w * 0.17, ey, er * 2.6, '160,225,255', 0.7);
    soft(c, cx + w * 0.17, ey, er * 2.6, '160,225,255', 0.7);
  }
  angryEye(c, cx - w * 0.17, ey, er, -1, line * 0.8, look > 1 ? '#dff6ff' : '#9fe0ff');
  angryEye(c, cx + w * 0.17, ey, er, 1, line * 0.8, look > 1 ? '#dff6ff' : '#9fe0ff');
  c.strokeStyle = '#24160d';
  c.lineWidth = line;
  c.beginPath();
  c.moveTo(cx - w * 0.12, h * 0.78);
  c.quadraticCurveTo(cx, h * 0.73, cx + w * 0.12, h * 0.78);
  c.stroke();
  // The crown.
  const u = w * 0.13;
  c.save();
  c.translate(cx, h * 0.21);
  c.rotate(-0.07);
  c.beginPath();
  c.moveTo(-u * 1.5, u * 0.75);
  c.lineTo(-u * 1.7, -u * 0.6);
  c.lineTo(-u * 0.8, u * 0.05);
  c.lineTo(0, -u * 1.1);
  c.lineTo(u * 0.8, u * 0.05);
  c.lineTo(u * 1.7, -u * 0.6);
  c.lineTo(u * 1.5, u * 0.75);
  c.closePath();
  c.fillStyle = linear(c, 0, -u, 0, u, [[0, '#f8d76a'], [1, '#a9731c']]);
  c.fill();
  ink(c, line);
  for (const [gx, col] of [[-u * 0.9, '#e0533d'], [0, '#6cc7f0'], [u * 0.9, '#e0533d']] as [number, string][]) {
    c.fillStyle = col;
    circle(c, gx, u * 0.4, u * 0.17);
    c.fill();
    ink(c, line * 0.5);
  }
  c.restore();
}

// ---------------------------------------------------------------- Shots and hazards

/** The King's crumb shot: a small hard grey crumb with a pale edge, so it reads against the dark floor. */
export function drawCrumbShot(c: Ctx, s: number): void {
  const m = s / 2;
  lump(c, m, m, s * 0.36, 7, 0.18, 3);
  c.fillStyle = radial(c, m - 1, m - 1, s * 0.5, [[0, '#f1ede6'], [1, '#9a948c']]);
  c.fill();
  ink(c, Math.max(1.4, s * 0.12));
}

/** A crust shard: a long pale splinter, drawn pointing right. */
export function drawShard(c: Ctx, w: number, h: number): void {
  c.beginPath();
  c.moveTo(w * 0.04, h * 0.5);
  c.lineTo(w * 0.3, h * 0.12);
  c.lineTo(w * 0.96, h * 0.5);
  c.lineTo(w * 0.3, h * 0.88);
  c.closePath();
  c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#f3ede2'], [1, '#a59d92']]);
  c.fill();
  ink(c, Math.max(1.4, h * 0.14));
}

/**
 * A patch of Stale creep, s across: a mottled grey stain with a soft edge and a few darker spots. Drawn large and
 * scaled down, since patches grow and shrink all the time.
 */
export function drawCreep(c: Ctx, s: number): void {
  const m = s / 2;
  lump(c, m, m, s * 0.44, 12, 0.1, 21);
  c.fillStyle = radial(c, m, m, s * 0.46, [[0, 'rgba(150,156,172,0.82)'], [0.75, 'rgba(120,126,142,0.76)'], [1, 'rgba(92,98,116,0.6)']]);
  c.fill();
  c.strokeStyle = 'rgba(226,232,246,0.75)';
  c.lineWidth = Math.max(2, s * 0.02);
  c.stroke();
  const rand = rng(8);
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * s * 0.34;
    c.fillStyle = i % 2 ? 'rgba(60,60,70,0.35)' : 'rgba(230,230,236,0.28)';
    circle(c, m + Math.cos(a) * d, m + Math.sin(a) * d, s * (0.012 + rand() * 0.03));
    c.fill();
  }
}

/** A chunk of crust falling from the top of the bin. */
export function drawFallingCrumb(c: Ctx, s: number): void {
  const m = s / 2;
  lump(c, m, m, s * 0.4, 9, 0.2, 14);
  c.fillStyle = linear(c, 0, 0, 0, s, [[0, '#d2b58a'], [1, '#7d6244']]);
  c.fill();
  ink(c, Math.max(2, s * 0.07));
  c.fillStyle = 'rgba(60,40,22,0.4)';
  for (const [x, y] of [[0.4, 0.4], [0.6, 0.55], [0.45, 0.65]]) {
    circle(c, s * x, s * y, s * 0.04);
    c.fill();
  }
}

/**
 * A soft round hole of light in a dark sheet: opaque dark at the edges, clear in the middle. `tight`: the Stale
 * King's spell, a small ring of light with real darkness close around it.
 */
export function drawDarkness(c: Ctx, s: number, tight = false): void {
  const m = s / 2;
  const g = c.createRadialGradient(m, m, s * (tight ? 0.1 : 0.12), m, m, s * (tight ? 0.3 : 0.5));
  g.addColorStop(0, 'rgba(8,5,3,0)');
  g.addColorStop(0.55, tight ? 'rgba(8,5,3,0.8)' : 'rgba(8,5,3,0.72)');
  g.addColorStop(1, 'rgba(8,5,3,1)');
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
}

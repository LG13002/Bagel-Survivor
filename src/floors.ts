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
    // The oven floor, with one coil flaring up so it reads as the Toaster Oven.
    c.save();
    c.scale(w / 140, w / 140);
    drawOvenFloor(c, 256);
    c.restore();
    const y = h * 0.62;
    c.fillStyle = 'rgba(255,120,40,0.45)';
    rrect(c, -4, y - h * 0.13, w + 8, h * 0.26, h * 0.1);
    c.fill();
    c.fillStyle = '#ffb04a';
    rrect(c, -4, y - h * 0.06, w + 8, h * 0.12, h * 0.06);
    c.fill();
    c.fillStyle = '#fff1b0';
    c.fillRect(0, y - h * 0.015, w, h * 0.03);
  }
  c.restore();
  rrect(c, 2, 2, w - 4, h - 4, r);
  c.strokeStyle = '#24160d';
  c.lineWidth = 3;
  c.stroke();
}

// ---------- Stage 2: the Freezer ----------
// Frosted freezer-floor tiles. Kept pale and soft so blue XP seeds and icy enemies (which have
// thick ink outlines and red eyes) both stand out against it.

/** Seamless frosted tile floor, size × size. */
export function drawFreezerFloor(c: Ctx, size: number): void {
  const rand = rng(21);
  const t = 64;
  for (let x = 0; x < size; x += t)
    for (let y = 0; y < size; y += t) {
      const k = 0.97 + rand() * 0.05;
      c.fillStyle = `rgb(${(188 * k) | 0},${(214 * k) | 0},${(228 * k) | 0})`;
      c.fillRect(x, y, t, t);
      // Soft top-left sheen on each tile.
      c.fillStyle = linear(c, x, y, x + t, y + t, [
        [0, 'rgba(255,255,255,0.22)'],
        [0.6, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(x, y, t, t);
    }
  // Grout lines.
  c.fillStyle = 'rgba(110,150,175,0.35)';
  for (let x = 0; x < size; x += t) c.fillRect(x, 0, 2, size);
  for (let y = 0; y < size; y += t) c.fillRect(0, y, size, 2);
  // Frost streaks and specks.
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI;
    const l = 14 + rand() * 30;
    wrapped(size, x, y, l, (px, py) => {
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      c.stroke();
    });
  }
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 1.2;
    wrapped(size, x, y, r, (px, py) => {
      c.beginPath();
      c.arc(px, py, r, 0, TAU);
      c.fill();
    });
  }
}

function iceTray(c: Ctx, w: number, h: number): void {
  const x0 = w / 2 - 70;
  const y0 = h / 2 - 30;
  softShadow(c, w / 2 + 4, h / 2 + 8, 80, 26, 0.18);
  rrect(c, x0, y0, 140, 60, 10);
  c.fillStyle = 'rgba(235,246,252,0.9)';
  c.fill();
  c.strokeStyle = 'rgba(120,160,185,0.6)';
  c.lineWidth = 2;
  c.stroke();
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 2; j++) {
      rrect(c, x0 + 7 + i * 22, y0 + 7 + j * 24, 18, 20, 4);
      c.fillStyle = 'rgba(170,215,240,0.75)';
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(x0 + 10 + i * 22, y0 + 10 + j * 24, 5, 3);
    }
}

/** A bag of frozen peas: a printed bag with a pea pod on it, so no loose green dots that read as pickups. */
function frozenPeas(c: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  softShadow(c, cx + 4, cy + 8, 40, 30, 0.16);
  // bag body
  c.beginPath();
  c.moveTo(cx - 30, cy - 26);
  c.lineTo(cx + 30, cy - 26);
  c.quadraticCurveTo(cx + 36, cy + 4, cx + 32, cy + 30);
  c.quadraticCurveTo(cx, cy + 36, cx - 32, cy + 30);
  c.quadraticCurveTo(cx - 36, cy + 4, cx - 30, cy - 26);
  c.closePath();
  c.fillStyle = linear(c, 0, cy - 26, 0, cy + 34, [
    [0, '#5f9a4a'],
    [1, '#477a37'],
  ]);
  c.fill();
  c.strokeStyle = 'rgba(40,70,30,0.55)';
  c.lineWidth = 2;
  c.stroke();
  // crimped top
  rrect(c, cx - 32, cy - 32, 64, 9, 3);
  c.fillStyle = '#d9e6ee';
  c.fill();
  c.strokeStyle = 'rgba(80,100,120,0.5)';
  c.lineWidth = 1.5;
  c.stroke();
  c.strokeStyle = 'rgba(80,100,120,0.35)';
  for (let i = -26; i <= 26; i += 6) {
    c.beginPath();
    c.moveTo(cx + i, cy - 31);
    c.lineTo(cx + i, cy - 24);
    c.stroke();
  }
  // white label with a pea pod
  c.beginPath();
  c.ellipse(cx, cy + 4, 22, 15, 0, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fill();
  c.beginPath();
  c.moveTo(cx - 17, cy + 6);
  c.quadraticCurveTo(cx, cy - 10, cx + 17, cy + 2);
  c.quadraticCurveTo(cx, cy + 14, cx - 17, cy + 6);
  c.fillStyle = '#7fb85e';
  c.fill();
  c.strokeStyle = '#3f6e2e';
  c.lineWidth = 1.5;
  c.stroke();
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(cx - 8 + i * 8, cy + 3 - i * 0.8, 3.2, 0, TAU);
    c.fillStyle = '#a6d97f';
    c.fill();
  }
  // frost on the bag
  c.fillStyle = 'rgba(235,248,255,0.55)';
  c.beginPath();
  c.ellipse(cx - 18, cy + 22, 10, 4, -0.3, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(cx + 22, cy - 14, 6, 3, 0.4, 0, TAU);
  c.fill();
}

function popsicleStick(c: Ctx, w: number, h: number): void {
  softShadow(c, w / 2 + 3, h / 2 + 5, 52, 10, 0.16);
  rrect(c, w / 2 - 50, h / 2 - 7, 100, 14, 7);
  c.fillStyle = '#e2c590';
  c.fill();
  c.strokeStyle = 'rgba(150,115,60,0.45)';
  c.lineWidth = 1.5;
  c.stroke();
}

function freezerBag(c: Ctx, w: number, h: number): void {
  const x0 = w / 2 - 55;
  const y0 = h / 2 - 40;
  softShadow(c, w / 2 + 4, h / 2 + 8, 62, 30, 0.16);
  rrect(c, x0, y0, 110, 80, 8);
  c.fillStyle = 'rgba(230,242,250,0.75)';
  c.fill();
  c.strokeStyle = 'rgba(120,160,185,0.55)';
  c.lineWidth = 2;
  c.stroke();
  // Zip strip.
  c.fillStyle = 'rgba(90,150,210,0.55)';
  c.fillRect(x0 + 4, y0 + 8, 102, 5);
  // Frozen berries inside.
  const rand = rng(41);
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    c.arc(x0 + 20 + rand() * 70, y0 + 30 + rand() * 40, 6 + rand() * 3, 0, TAU);
    c.fillStyle = 'rgba(150,80,130,0.55)';
    c.fill();
  }
}

function frostPile(c: Ctx, w: number, h: number): void {
  const rand = rng(57);
  for (let j = 0; j < 12; j++) {
    const ox = w / 2 + (rand() - 0.5) * 70;
    const oy = h / 2 + (rand() - 0.5) * 34;
    const r = 10 + rand() * 14;
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ox, oy, r, 0, TAU);
    c.fill();
  }
}

export const FREEZER_PROPS: PropDef[] = [
  { key: 'prop_icetray', w: 160, h: 80, weight: 1, spin: true, draw: iceTray },
  { key: 'prop_peas', w: 100, h: 80, weight: 1.1, spin: true, draw: frozenPeas },
  { key: 'prop_stick', w: 120, h: 30, weight: 0.9, spin: true, draw: popsicleStick },
  { key: 'prop_bag', w: 130, h: 100, weight: 0.8, spin: true, draw: freezerBag },
  { key: 'prop_frost', w: 120, h: 70, weight: 1.3, spin: false, draw: frostPile },
];

// ---------- Stage 3: the Toaster Oven ----------
// A dark oven rack over dim heating coils. The coils are dull red here on purpose: a coil that is
// about to flare glows bright orange with a white edge, so the hazard never blends into the floor.

/** Seamless oven floor, size × size: rack bars over dim coils. */
export function drawOvenFloor(c: Ctx, size: number): void {
  const rand = rng(33);
  c.fillStyle = linear(c, 0, 0, size, size, [
    [0, '#3b2a22'],
    [1, '#33241d'],
  ]);
  c.fillRect(0, 0, size, size);
  // Soot smudges.
  for (let i = 0; i < 10; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 30;
    wrapped(size, x, y, r, (px, py) => {
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(20,12,8,0.28)');
      g.addColorStop(1, 'rgba(20,12,8,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, r, 0, TAU);
      c.fill();
    });
  }
  // Dim heating coils: two zig-zag elements under the rack.
  for (const cy of [64, 192]) {
    c.strokeStyle = 'rgba(110,40,18,0.4)';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(0, cy);
    c.lineTo(size, cy);
    c.stroke();
    c.strokeStyle = 'rgba(150,60,28,0.45)';
    c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = 'rgba(200,100,50,0.18)';
    c.lineWidth = 2;
    c.stroke();
  }
  // Rack bars: thin steel rods every 32px, with a highlight and a soft shadow.
  for (let x = 16; x < size; x += 32) {
    c.fillStyle = 'rgba(15,8,5,0.35)';
    c.fillRect(x + 2, 0, 4, size);
    c.fillStyle = '#58524f';
    c.fillRect(x - 1.5, 0, 3, size);
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.fillRect(x - 1.5, 0, 1, size);
  }
  // Two cross bars hold the rack together.
  for (const y of [0, 128]) {
    c.fillStyle = 'rgba(15,8,5,0.35)';
    c.fillRect(0, y + 3, size, 5);
    c.fillStyle = '#625c58';
    c.fillRect(0, y - 2.5, size, 5);
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.fillRect(0, y - 2.5, size, 1.5);
  }
  // Burnt specks.
  c.fillStyle = 'rgba(25,14,8,0.5)';
  for (let i = 0; i < 30; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 1.6;
    wrapped(size, x, y, r, (px, py) => {
      c.beginPath();
      c.arc(px, py, r, 0, TAU);
      c.fill();
    });
  }
}

function crumbTray(c: Ctx, w: number, h: number): void {
  const x0 = w / 2 - 70;
  const y0 = h / 2 - 34;
  softShadow(c, w / 2 + 4, h / 2 + 8, 80, 30, 0.25);
  rrect(c, x0, y0, 140, 68, 8);
  c.fillStyle = linear(c, x0, y0, x0 + 140, y0 + 68, [
    [0, 'rgba(160,160,162,0.85)'],
    [1, 'rgba(105,104,106,0.85)'],
  ]);
  c.fill();
  c.strokeStyle = 'rgba(40,30,25,0.55)';
  c.lineWidth = 2;
  c.stroke();
  rrect(c, x0 + 7, y0 + 7, 126, 54, 5);
  c.fillStyle = 'rgba(70,60,56,0.55)';
  c.fill();
  const rand = rng(61);
  for (let i = 0; i < 26; i++) {
    c.beginPath();
    c.arc(x0 + 14 + rand() * 112, y0 + 14 + rand() * 40, 1 + rand() * 2.2, 0, TAU);
    c.fillStyle = rand() < 0.5 ? 'rgba(120,70,35,0.8)' : 'rgba(45,28,16,0.8)';
    c.fill();
  }
}

function foilScrap(c: Ctx, w: number, h: number): void {
  const rand = rng(73);
  softShadow(c, w / 2 + 3, h / 2 + 6, 46, 22, 0.2);
  c.beginPath();
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = 1 - 0.35 * rand();
    const px = w / 2 + Math.cos(a) * 42 * rr;
    const py = h / 2 + Math.sin(a) * 26 * rr;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
  c.fillStyle = linear(c, 0, 0, w, h, [
    [0, 'rgba(225,228,232,0.45)'],
    [0.5, 'rgba(160,165,172,0.45)'],
    [1, 'rgba(205,208,214,0.45)'],
  ]);
  c.fill();
  // Crinkles.
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const x = w / 2 + (rand() - 0.5) * 60;
    const y = h / 2 + (rand() - 0.5) * 30;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rand() - 0.5) * 22, y + (rand() - 0.5) * 14);
    c.stroke();
  }
}

/** A soft scatter of burnt crumbs: blurry and outline-free, so it never reads as an enemy. */
function burntCrumbs(c: Ctx, w: number, h: number): void {
  const rand = rng(89);
  for (let i = 0; i < 9; i++) {
    const x = w / 2 + (rand() - 0.5) * 80;
    const y = h / 2 + (rand() - 0.5) * 40;
    const r = 3 + rand() * 5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(30,18,10,0.7)');
    g.addColorStop(1, 'rgba(30,18,10,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
}

/** A puff of ash. */
function ashPile(c: Ctx, w: number, h: number): void {
  const rand = rng(97);
  for (let j = 0; j < 10; j++) {
    const ox = w / 2 + (rand() - 0.5) * 70;
    const oy = h / 2 + (rand() - 0.5) * 30;
    const r = 10 + rand() * 12;
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(150,140,135,0.35)');
    g.addColorStop(1, 'rgba(150,140,135,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ox, oy, r, 0, TAU);
    c.fill();
  }
}

export const OVEN_PROPS: PropDef[] = [
  { key: 'prop_tray', w: 160, h: 90, weight: 0.8, spin: true, draw: crumbTray },
  { key: 'prop_foil', w: 100, h: 70, weight: 0.7, spin: true, draw: foilScrap },
  { key: 'prop_burnt', w: 100, h: 60, weight: 1.2, spin: true, draw: burntCrumbs },
  { key: 'prop_ash', w: 110, h: 60, weight: 1, spin: false, draw: ashPile },
];

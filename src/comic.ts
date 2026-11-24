// The intro comic's four backdrops, drawn in code like the rest of the art. The moving parts (bagels, crumbs, the
// crown's glint) are sprites the Intro scene lays on top.
import { INK, angryEye, ink, linear, radial, rng, rrect } from './art';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** 1: the bakery at dawn. A big window with the sun coming up, and a shelf along the bottom for the bagels. */
export function drawDawn(c: Ctx, w: number, h: number): void {
  c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#7a5236'], [1, '#4a3222']]);
  c.fillRect(0, 0, w, h);
  // Wall tiles
  c.fillStyle = 'rgba(255,225,170,0.07)';
  for (let y = -10, row = 0; y < h; y += 34, row++) for (let x = row % 2 ? -17 : 0; x < w; x += 34) rrect(c, x + 2, y + 2, 30, 30, 4), c.fill();
  // The window: an arch full of sunrise.
  const wx = w * 0.5;
  const ww = w * 0.56;
  const wt = h * 0.08;
  const wb = h * 0.66;
  const arch = () => {
    c.beginPath();
    c.moveTo(wx - ww / 2, wb);
    c.lineTo(wx - ww / 2, wt + ww / 2);
    c.arc(wx, wt + ww / 2, ww / 2, Math.PI, 0);
    c.lineTo(wx + ww / 2, wb);
    c.closePath();
  };
  arch();
  c.fillStyle = linear(c, 0, wt, 0, wb, [[0, '#6a7fc0'], [0.45, '#f2a0a0'], [0.8, '#ffd27a'], [1, '#fff0b8']]);
  c.fill();
  c.save();
  arch();
  c.clip();
  // Sun and its rays
  const sy = wb - 4;
  c.fillStyle = 'rgba(255,244,200,0.35)';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    c.beginPath();
    c.moveTo(wx, sy);
    c.lineTo(wx + Math.cos(a - 0.07) * w, sy + Math.sin(a - 0.07) * w);
    c.lineTo(wx + Math.cos(a + 0.07) * w, sy + Math.sin(a + 0.07) * w);
    c.fill();
  }
  c.beginPath();
  c.arc(wx, sy, ww * 0.23, 0, TAU);
  c.fillStyle = radial(c, wx, sy, ww * 0.23, [[0, '#fffbe0'], [1, '#ffc94a']]);
  c.fill();
  ink(c, 2.5);
  // Far rooftops
  c.fillStyle = '#7b4a4a';
  c.beginPath();
  c.moveTo(wx - ww / 2, wb);
  for (const [fx, fy] of [[0.1, 0.9], [0.22, 0.78], [0.34, 0.9], [0.62, 0.9], [0.76, 0.8], [0.9, 0.92], [1, 0.9]]) c.lineTo(wx - ww / 2 + ww * fx, wt + (wb - wt) * fy);
  c.lineTo(wx + ww / 2, wb);
  c.fill();
  c.restore();
  // Frame and bars
  arch();
  c.lineWidth = 9;
  c.strokeStyle = INK;
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = '#c98f5a';
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(wx, wt);
  c.lineTo(wx, wb);
  c.moveTo(wx - ww / 2, wt + ww / 2);
  c.lineTo(wx + ww / 2, wt + ww / 2);
  c.stroke();
  // Warm light spilling onto the wall
  c.fillStyle = radial(c, wx, wb, w * 0.7, [[0, 'rgba(255,214,130,0.3)'], [1, 'rgba(255,214,130,0)']]);
  c.fillRect(0, 0, w, h);
  // The shelf
  const st = h * 0.84;
  c.fillStyle = '#8a5d3b';
  c.fillRect(0, st, w, h - st);
  c.fillStyle = '#b98356';
  c.fillRect(0, st, w, 5);
  c.fillStyle = INK;
  c.fillRect(0, st - 1.5, w, 3);
}

/** 2: the counter going grey. Stale creeps in from the right. */
export function drawCreep(c: Ctx, w: number, h: number): void {
  c.fillStyle = '#c99a62';
  c.fillRect(0, 0, w, h);
  // Butcher-block planks
  const r = rng(7);
  for (let y = 0; y < h; y += 30) {
    for (let x = -20 - r() * 30; x < w; ) {
      const len = 60 + r() * 60;
      c.fillStyle = ['#c08c56', '#d2a56c', '#b9834e', '#cb9c63'][Math.floor(r() * 4)];
      c.fillRect(x, y, len, 30);
      c.strokeStyle = 'rgba(60,34,16,0.5)';
      c.lineWidth = 1.5;
      c.strokeRect(x, y, len, 30);
      x += len;
    }
  }
  // The grey tide, with a ragged edge.
  c.fillStyle = linear(c, w * 0.25, 0, w, 0, [[0, 'rgba(120,118,114,0)'], [0.45, 'rgba(120,118,114,0.75)'], [1, 'rgba(84,82,80,0.95)']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(96,94,92,0.55)';
  for (let i = 0; i < 26; i++) {
    c.beginPath();
    c.arc(w * (0.42 + r() * 0.6), r() * h, 6 + r() * 16, 0, TAU);
    c.fill();
  }
  // Warm corner that's still fresh
  c.fillStyle = radial(c, 0, h * 0.55, w * 0.55, [[0, 'rgba(255,220,140,0.35)'], [1, 'rgba(255,220,140,0)']]);
  c.fillRect(0, 0, w, h);
}

/** 3: the bread bin in the dark. Its roll-top is open a crack, and something inside is looking out. */
export function drawBin(c: Ctx, w: number, h: number): void {
  c.fillStyle = radial(c, w / 2, h * 0.55, w * 0.8, [[0, '#2c2530'], [1, '#0e0b10']]);
  c.fillRect(0, 0, w, h);
  // Shelf it sits on
  c.fillStyle = '#1b1418';
  c.fillRect(0, h * 0.86, w, h * 0.14);
  c.fillStyle = INK;
  c.fillRect(0, h * 0.86 - 1.5, w, 3);
  const bw = w * 0.74;
  const bh = h * 0.56;
  const bx = (w - bw) / 2;
  const by = h * 0.86 - bh;
  // Body
  rrect(c, bx, by, bw, bh, [bh * 0.55, bh * 0.55, 10, 10]);
  c.fillStyle = linear(c, 0, by, 0, by + bh, [[0, '#5b5560'], [1, '#2f2a33']]);
  c.fill();
  ink(c, 4);
  // The opening: pitch black, lid rolled part-way up.
  const ox = bx + bw * 0.1;
  const ow = bw * 0.8;
  const oy = by + bh * 0.4;
  const oh = bh * 0.46;
  rrect(c, ox, oy, ow, oh, 8);
  c.fillStyle = '#050405';
  c.fill();
  ink(c, 3.5);
  // Lid slats above the opening
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const y = by + bh * 0.4 - i * bh * 0.085;
    const inset = bw * (0.1 + i * 0.035);
    c.beginPath();
    c.moveTo(bx + inset, y);
    c.lineTo(bx + bw - inset, y);
    c.stroke();
  }
  // Handle
  rrect(c, w / 2 - 16, oy - 9, 32, 9, 4);
  c.fillStyle = '#8d8794';
  c.fill();
  ink(c, 2.5);
  // Label
  c.fillStyle = 'rgba(255,243,220,0.2)';
  c.font = '700 13px "Titan One", sans-serif';
  c.textAlign = 'center';
  c.fillText('BREAD', w / 2, by + bh * 0.16 + 10);
  // Eyes in the dark
  const ey = oy + oh * 0.6;
  c.fillStyle = radial(c, w / 2, ey, ow * 0.4, [[0, 'rgba(255,60,40,0.22)'], [1, 'rgba(255,60,40,0)']]);
  c.fillRect(ox, oy, ow, oh);
  angryEye(c, w / 2 - ow * 0.13, ey, ow * 0.065, -1, 2.5);
  angryEye(c, w / 2 + ow * 0.13, ey, ow * 0.065, 1, 2.5);
  // Grey dust drifting out
  c.fillStyle = 'rgba(150,146,140,0.16)';
  const r = rng(3);
  for (let i = 0; i < 18; i++) {
    c.beginPath();
    c.arc(ox + r() * ow, h * 0.86 - r() * 14, 2 + r() * 5, 0, TAU);
    c.fill();
  }
}

/** 4: rolling out. A bright burst and speed lines; the bagels are sprites on top. */
export function drawRoll(c: Ctx, w: number, h: number): void {
  c.fillStyle = radial(c, w * 0.6, h * 0.5, w * 0.8, [[0, '#ffe08a'], [0.5, '#f2a03c'], [1, '#b9541f']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,250,225,0.3)';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    c.beginPath();
    c.moveTo(w * 0.6, h * 0.5);
    c.lineTo(w * 0.6 + Math.cos(a - 0.08) * w, h * 0.5 + Math.sin(a - 0.08) * w);
    c.lineTo(w * 0.6 + Math.cos(a + 0.08) * w, h * 0.5 + Math.sin(a + 0.08) * w);
    c.fill();
  }
  // Counter
  const fy = h * 0.8;
  c.fillStyle = '#c99a62';
  c.fillRect(0, fy, w, h - fy);
  c.fillStyle = '#e0b57c';
  c.fillRect(0, fy, w, 5);
  c.fillStyle = INK;
  c.fillRect(0, fy - 1.5, w, 3);
  // Speed lines
  c.strokeStyle = 'rgba(255,255,255,0.75)';
  c.lineWidth = 3;
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const y = h * (0.3 + r() * 0.45);
    const x = r() * w * 0.3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 24 + r() * 40, y);
    c.stroke();
  }
}

// ---------------------------------------------------------------- The ending's four backdrops

/** Ending 1: inside the bread bin, the King splits and light pours through. The croutons and crown are sprites on top. */
export function drawFall(c: Ctx, w: number, h: number): void {
  c.fillStyle = radial(c, w / 2, h * 0.5, w * 0.85, [[0, '#fff0b8'], [0.22, '#f2b84b'], [0.6, '#4a3323'], [1, '#17100b']]);
  c.fillRect(0, 0, w, h);
  // Light bursting out from where he stood.
  c.fillStyle = 'rgba(255,248,214,0.32)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.2;
    c.beginPath();
    c.moveTo(w / 2, h * 0.52);
    c.lineTo(w / 2 + Math.cos(a - 0.06) * w, h * 0.52 + Math.sin(a - 0.06) * w);
    c.lineTo(w / 2 + Math.cos(a + 0.06) * w, h * 0.52 + Math.sin(a + 0.06) * w);
    c.fill();
  }
  // The two halves of the loaf, falling apart.
  const half = (dir: number) => {
    c.save();
    c.translate(w / 2 + dir * w * 0.13, h * 0.56);
    c.rotate(dir * 0.22);
    const lw = w * 0.2;
    const lh = h * 0.42;
    c.beginPath();
    c.moveTo(-dir * lw * 0.5, -lh * 0.5);
    c.bezierCurveTo(dir * lw * 0.2, -lh * 0.62, dir * lw * 0.75, -lh * 0.4, dir * lw * 0.6, lh * 0.05);
    c.lineTo(dir * lw * 0.55, lh * 0.5);
    c.lineTo(-dir * lw * 0.5, lh * 0.5);
    // The broken edge.
    c.lineTo(-dir * lw * 0.3, lh * 0.25);
    c.lineTo(-dir * lw * 0.55, lh * 0.02);
    c.lineTo(-dir * lw * 0.28, -lh * 0.22);
    c.closePath();
    c.fillStyle = linear(c, 0, -lh * 0.5, 0, lh * 0.5, [[0, '#a7a199'], [0.6, '#807a73'], [1, '#56514c']]);
    c.fill();
    ink(c, 3.5);
    // One shut eye on each half.
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(dir * lw * 0.05, lh * 0.08);
    c.lineTo(dir * lw * 0.32, lh * 0.14);
    c.moveTo(dir * lw * 0.32, lh * 0.06);
    c.lineTo(dir * lw * 0.05, lh * 0.16);
    c.stroke();
    c.restore();
  };
  half(-1);
  half(1);
  // The floor of the bin.
  const fy = h * 0.84;
  c.fillStyle = '#3a271a';
  c.fillRect(0, fy, w, h - fy);
  c.fillStyle = INK;
  c.fillRect(0, fy - 1.5, w, 3);
}

/** Ending 2: the counter, warm again. The last of the grey drains away to the right. */
export function drawThaw(c: Ctx, w: number, h: number): void {
  c.fillStyle = '#c99a62';
  c.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let y = 0; y < h; y += 30) {
    for (let x = -20 - r() * 30; x < w; ) {
      const len = 60 + r() * 60;
      c.fillStyle = ['#c08c56', '#d2a56c', '#b9834e', '#cb9c63'][Math.floor(r() * 4)];
      c.fillRect(x, y, len, 30);
      c.strokeStyle = 'rgba(60,34,16,0.5)';
      c.lineWidth = 1.5;
      c.strokeRect(x, y, len, 30);
      x += len;
    }
  }
  // What is left of the grey: a thin fringe on the far side, breaking up.
  c.fillStyle = linear(c, w * 0.72, 0, w, 0, [[0, 'rgba(120,118,114,0)'], [1, 'rgba(110,108,104,0.7)']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(110,108,104,0.4)';
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    c.arc(w * (0.8 + r() * 0.2), r() * h, 5 + r() * 10, 0, TAU);
    c.fill();
  }
  // Warm light sweeping in from the left.
  c.fillStyle = radial(c, w * 0.1, h * 0.5, w * 0.95, [[0, 'rgba(255,232,150,0.55)'], [0.6, 'rgba(255,220,140,0.2)'], [1, 'rgba(255,220,140,0)']]);
  c.fillRect(0, 0, w, h);
}

/** Ending 3 and 4: the bakery in full morning light, lamps lit, the shelf along the bottom. `party` adds bunting. */
export function drawMorning(c: Ctx, w: number, h: number, party = false): void {
  c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#e9b877'], [1, '#c58a50']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,240,200,0.14)';
  for (let y = -10, row = 0; y < h; y += 34, row++) for (let x = row % 2 ? -17 : 0; x < w; x += 34) rrect(c, x + 2, y + 2, 30, 30, 4), c.fill();
  // The window, full of day.
  const wx = w * 0.5;
  const ww = w * 0.5;
  const wt = h * 0.1;
  const wb = h * 0.64;
  const arch = () => {
    c.beginPath();
    c.moveTo(wx - ww / 2, wb);
    c.lineTo(wx - ww / 2, wt + ww / 2);
    c.arc(wx, wt + ww / 2, ww / 2, Math.PI, 0);
    c.lineTo(wx + ww / 2, wb);
    c.closePath();
  };
  arch();
  c.fillStyle = linear(c, 0, wt, 0, wb, [[0, '#6cc7f0'], [0.7, '#bfe9fb'], [1, '#fff6d0']]);
  c.fill();
  c.save();
  arch();
  c.clip();
  c.beginPath();
  c.arc(wx + ww * 0.18, wt + (wb - wt) * 0.34, ww * 0.15, 0, TAU);
  c.fillStyle = radial(c, wx + ww * 0.18, wt + (wb - wt) * 0.34, ww * 0.15, [[0, '#fffbe0'], [1, '#ffd24a']]);
  c.fill();
  ink(c, 2.5);
  // A cloud, and rooftops.
  c.fillStyle = '#ffffff';
  for (const [fx, fy, fr] of [[0.2, 0.3, 0.07], [0.3, 0.27, 0.09], [0.4, 0.31, 0.06]]) {
    c.beginPath();
    c.arc(wx - ww / 2 + ww * fx, wt + (wb - wt) * fy, ww * fr, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#b9705a';
  c.beginPath();
  c.moveTo(wx - ww / 2, wb);
  for (const [fx, fy] of [[0.1, 0.9], [0.22, 0.78], [0.34, 0.9], [0.62, 0.9], [0.76, 0.8], [0.9, 0.92], [1, 0.9]]) c.lineTo(wx - ww / 2 + ww * fx, wt + (wb - wt) * fy);
  c.lineTo(wx + ww / 2, wb);
  c.fill();
  c.restore();
  arch();
  c.lineWidth = 9;
  c.strokeStyle = INK;
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = '#e0b07a';
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(wx, wt);
  c.lineTo(wx, wb);
  c.moveTo(wx - ww / 2, wt + ww / 2);
  c.lineTo(wx + ww / 2, wt + ww / 2);
  c.stroke();
  // Two hanging lamps, lit.
  for (const lx of [w * 0.13, w * 0.87]) {
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(lx, 0);
    c.lineTo(lx, h * 0.2);
    c.stroke();
    c.fillStyle = radial(c, lx, h * 0.27, w * 0.2, [[0, 'rgba(255,240,170,0.6)'], [1, 'rgba(255,240,170,0)']]);
    c.fillRect(lx - w * 0.2, h * 0.07, w * 0.4, h * 0.4);
    c.beginPath();
    c.moveTo(lx - w * 0.055, h * 0.26);
    c.quadraticCurveTo(lx, h * 0.15, lx + w * 0.055, h * 0.26);
    c.closePath();
    c.fillStyle = '#e0533d';
    c.fill();
    ink(c, 2.5);
    c.beginPath();
    c.arc(lx, h * 0.268, w * 0.02, 0, TAU);
    c.fillStyle = '#fff6c8';
    c.fill();
    ink(c, 2);
  }
  if (party) {
    // Bunting strung across the top.
    const cols = ['#e0533d', '#f2b84b', '#7fbf4d', '#6cc7f0', '#a77ee0'];
    for (let i = 0; i < 9; i++) {
      const fx = (i + 0.5) / 9;
      const x = w * fx;
      const y = h * 0.03 + Math.sin(fx * Math.PI) * h * 0.05;
      c.beginPath();
      c.moveTo(x - w * 0.04, y);
      c.lineTo(x + w * 0.04, y);
      c.lineTo(x, y + h * 0.08);
      c.closePath();
      c.fillStyle = cols[i % cols.length];
      c.fill();
      ink(c, 2);
    }
  }
  // The shelf
  const st = h * 0.84;
  c.fillStyle = '#a06c44';
  c.fillRect(0, st, w, h - st);
  c.fillStyle = '#d19a66';
  c.fillRect(0, st, w, 5);
  c.fillStyle = INK;
  c.fillRect(0, st - 1.5, w, 3);
}

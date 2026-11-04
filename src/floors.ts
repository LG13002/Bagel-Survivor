// Stage background candidates, each a seamless square tile in texture units (= world px).
// Scenery is drawn soft, with no heavy ink outlines, so it never competes with enemies or pickups.
import { type Ctx, linear, rng, rrect } from './art';

const TAU = Math.PI * 2;

/** Draw fn at (x, y) plus every wrapped copy that touches the tile, so props cross edges seamlessly. */
function wrapped(size: number, x: number, y: number, r: number, fn: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const px = x + dx;
      const py = y + dy;
      if (px > -r && px < size + r && py > -r && py < size + r) fn(px, py);
    }
}

function softShadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(40,20,8,${a})`);
  g.addColorStop(1, 'rgba(40,20,8,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, TAU);
  c.restore();
}

function flourPile(c: Ctx, x: number, y: number, r: number, rand: () => number): void {
  for (let j = 0; j < 9; j++) {
    const ox = x + (rand() - 0.5) * r * 1.6;
    const oy = y + (rand() - 0.5) * r;
    const rr = r * (0.3 + rand() * 0.45);
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, rr);
    g.addColorStop(0, 'rgba(255,252,244,0.55)');
    g.addColorStop(0.6, 'rgba(255,250,238,0.25)');
    g.addColorStop(1, 'rgba(255,250,238,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ox, oy, rr, 0, TAU);
    c.fill();
  }
  // The mound itself
  c.beginPath();
  c.ellipse(x, y, r * 0.55, r * 0.34, 0, 0, TAU);
  const m = c.createRadialGradient(x - r * 0.15, y - r * 0.12, 0, x, y, r * 0.6);
  m.addColorStop(0, '#ffffff');
  m.addColorStop(1, '#ece2cf');
  c.fillStyle = m;
  c.fill();
}

function sprinkles(c: Ctx, x: number, y: number, r: number, n: number, rand: () => number, alpha = 0.75): void {
  const cols = ['#f48fb1', '#fff3d6', '#ffd56a', '#b39ddb', '#ff8a65'];
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * r;
    c.save();
    c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7);
    c.rotate(rand() * Math.PI);
    rrect(c, -3.5, -1.2, 7, 2.4, 1.2);
    c.globalAlpha = alpha;
    c.fillStyle = cols[i % cols.length];
    c.fill();
    c.restore();
  }
}

// ---------- A. Giant countertop ----------
export function drawCountertop(c: Ctx, size: number): void {
  const rand = rng(5);
  // Butcher block: vertical strips with grain.
  const sw = 32;
  for (let x = 0; x < size; x += sw) {
    const v = rand();
    const tones = [
      [176, 124, 78],
      [164, 113, 70],
      [186, 134, 86],
      [158, 108, 66],
    ];
    const t = tones[(x / sw) % 4];
    const k = 0.96 + v * 0.08;
    c.fillStyle = `rgb(${(t[0] * k) | 0},${(t[1] * k) | 0},${(t[2] * k) | 0})`;
    c.fillRect(x, 0, sw, size);
    c.strokeStyle = 'rgba(96,58,30,0.22)';
    c.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const gx = x + 4 + rand() * (sw - 8);
      c.beginPath();
      c.moveTo(gx, 0);
      for (let y = 0; y <= size; y += 32) c.lineTo(gx + Math.sin(y * 0.02 + g + x) * 2.5, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(70,40,20,0.35)';
    c.fillRect(x, 0, 1.5, size);
  }
  // End-grain joints every so often
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * (size / sw)) * sw;
    const y = rand() * size;
    c.fillStyle = 'rgba(70,40,20,0.3)';
    c.fillRect(x, y, sw, 1.5);
  }
  // Knife scratches
  c.strokeStyle = 'rgba(255,235,200,0.18)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI;
    const l = 20 + rand() * 40;
    wrapped(size, x, y, l, (px, py) => {
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      c.stroke();
    });
  }
  // Rolling-pin flour streak
  wrapped(size, 120, 380, 200, (px, py) => {
    const g = linear(c, px - 150, py, px + 150, py, [
      [0, 'rgba(255,250,240,0)'],
      [0.2, 'rgba(255,250,240,0.22)'],
      [0.8, 'rgba(255,250,240,0.22)'],
      [1, 'rgba(255,250,240,0)'],
    ]);
    c.fillStyle = g;
    c.save();
    c.translate(px, py);
    c.rotate(-0.18);
    c.fillRect(-150, -26, 300, 52);
    c.restore();
  });
  // Flour pile
  wrapped(size, 390, 120, 70, (px, py) => flourPile(c, px, py, 60, rng(9)));
  // Giant measuring spoon
  wrapped(size, 300, 300, 140, (px, py) => {
    c.save();
    c.translate(px, py);
    c.rotate(0.6);
    softShadow(c, 6, 10, 70, 22, 0.25);
    rrect(c, -10, -9, 130, 18, 9);
    c.fillStyle = linear(c, 0, -9, 0, 9, [
      [0, '#f4f7fa'],
      [0.5, '#b9c4cd'],
      [1, '#8996a1'],
    ]);
    c.fill();
    c.beginPath();
    c.ellipse(-40, 0, 40, 32, 0, 0, TAU);
    c.fillStyle = linear(c, -80, -32, 0, 32, [
      [0, '#eef2f5'],
      [1, '#93a0ab'],
    ]);
    c.fill();
    c.beginPath();
    c.ellipse(-40, 2, 31, 24, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
    c.fillStyle = 'rgba(120,130,140,0.6)';
    c.font = 'bold 13px sans-serif';
    c.fillText('1 TBSP', 30, 5);
    c.restore();
  });
  // Cookie cutter ring
  wrapped(size, 90, 160, 50, (px, py) => {
    softShadow(c, px + 4, py + 6, 46, 14, 0.2);
    c.beginPath();
    c.arc(px, py, 38, 0, TAU);
    c.lineWidth = 6;
    c.strokeStyle = '#c9d2d9';
    c.stroke();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.beginPath();
    c.arc(px, py, 38, Math.PI * 1.1, Math.PI * 1.6);
    c.stroke();
  });
  // Sprinkle spill
  wrapped(size, 200, 70, 50, (px, py) => sprinkles(c, px, py, 42, 26, rng(3)));
  wrapped(size, 460, 450, 40, (px, py) => sprinkles(c, px, py, 30, 14, rng(4)));
}

// ---------- B. Bakery kitchen floor ----------
export function drawKitchenFloor(c: Ctx, size: number): void {
  const rand = rng(8);
  const ph = 32;
  for (let y = 0; y < size; y += ph) {
    const off = ((y / ph) % 3) * 70;
    for (let x = -off; x < size; x += 140) {
      const v = rand();
      const base = [126, 86, 56];
      const k = 0.9 + v * 0.16;
      c.fillStyle = `rgb(${(base[0] * k) | 0},${(base[1] * k) | 0},${(base[2] * k) | 0})`;
      c.fillRect(x, y, 140, ph);
      c.strokeStyle = 'rgba(70,44,24,0.25)';
      c.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gy = y + 5 + rand() * (ph - 10);
        c.beginPath();
        c.moveTo(x, gy);
        c.bezierCurveTo(x + 40, gy + 3, x + 90, gy - 3, x + 140, gy);
        c.stroke();
      }
      c.fillStyle = 'rgba(50,30,16,0.55)';
      c.fillRect(x, y, 1.6, ph);
      c.fillStyle = 'rgba(40,26,14,0.5)';
      c.beginPath();
      c.arc(x + 7, y + 7, 1.5, 0, TAU);
      c.arc(x + 7, y + ph - 7, 1.5, 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(50,30,16,0.6)';
    c.fillRect(0, y, size, 1.8);
  }
  // Braided rug
  wrapped(size, 140, 150, 110, (px, py) => {
    softShadow(c, px, py + 6, 104, 70, 0.2);
    const rings = ['#b8473a', '#e9dcc0', '#b8473a', '#6b8f71', '#e9dcc0', '#b8473a'];
    rings.forEach((col, i) => {
      c.beginPath();
      c.ellipse(px, py, 100 - i * 15, 66 - i * 10, 0, 0, TAU);
      c.fillStyle = col;
      c.fill();
    });
    c.strokeStyle = 'rgba(0,0,0,0.12)';
    c.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.ellipse(px, py, 100 - i * 15, 66 - i * 10, 0, 0, TAU);
      c.stroke();
    }
  });
  // Flour sack
  wrapped(size, 400, 330, 80, (px, py) => {
    softShadow(c, px + 6, py + 44, 60, 16, 0.3);
    c.beginPath();
    c.moveTo(px - 42, py + 44);
    c.quadraticCurveTo(px - 54, py - 6, px - 34, py - 40);
    c.quadraticCurveTo(px, py - 54, px + 34, py - 40);
    c.quadraticCurveTo(px + 54, py - 6, px + 42, py + 44);
    c.closePath();
    c.fillStyle = linear(c, px - 50, py - 50, px + 50, py + 50, [
      [0, '#efe2c4'],
      [1, '#c8b38a'],
    ]);
    c.fill();
    c.fillStyle = 'rgba(184,71,58,0.85)';
    c.font = 'bold 20px sans-serif';
    c.textAlign = 'center';
    c.fillText('FLOUR', px, py + 8);
    c.fillRect(px - 30, py + 16, 60, 3);
    c.textAlign = 'start';
  });
  wrapped(size, 440, 410, 60, (px, py) => flourPile(c, px, py, 46, rng(12)));
  // Dropped baking tray
  wrapped(size, 260, 440, 90, (px, py) => {
    c.save();
    c.translate(px, py);
    c.rotate(-0.25);
    softShadow(c, 4, 8, 80, 40, 0.25);
    rrect(c, -78, -44, 156, 88, 6);
    c.fillStyle = '#8e9aa4';
    c.fill();
    rrect(c, -70, -36, 140, 72, 4);
    c.fillStyle = linear(c, -70, -36, 70, 36, [
      [0, '#c3ccd3'],
      [1, '#9aa6b0'],
    ]);
    c.fill();
    c.restore();
  });
  wrapped(size, 60, 400, 40, (px, py) => sprinkles(c, px, py, 30, 12, rng(6), 0.6));
}

// ---------- C. Baking sheet in the oven ----------
export function drawBakingSheet(c: Ctx, size: number): void {
  const rand = rng(14);
  // Metal tray with a rolled rim every 256 px (each "sheet" panel).
  c.fillStyle = '#7f8b95';
  c.fillRect(0, 0, size, size);
  const p = 256;
  for (let y = 0; y < size; y += p)
    for (let x = 0; x < size; x += p) {
      rrect(c, x + 6, y + 6, p - 12, p - 12, 10);
      c.fillStyle = linear(c, x, y, x + p, y + p, [
        [0, '#aab5be'],
        [1, '#8a96a0'],
      ]);
      c.fill();
      // Parchment sheet
      c.save();
      c.translate(x + p / 2, y + p / 2);
      c.rotate((rand() - 0.5) * 0.06);
      rrect(c, -p / 2 + 16, -p / 2 + 16, p - 32, p - 32, 3);
      c.fillStyle = linear(c, -p / 2, -p / 2, p / 2, p / 2, [
        [0, '#f3e6c8'],
        [1, '#e2d0a8'],
      ]);
      c.fill();
      // Crinkle folds
      c.strokeStyle = 'rgba(150,120,80,0.22)';
      c.lineWidth = 1.2;
      for (let f = 0; f < 5; f++) {
        c.beginPath();
        const fx = -p / 2 + 20 + rand() * (p - 40);
        c.moveTo(fx, -p / 2 + 16);
        c.lineTo(fx + (rand() - 0.5) * 40, p / 2 - 16);
        c.stroke();
      }
      // Grease spots and toasty marks
      for (let s = 0; s < 4; s++) {
        const sx = -p / 2 + 30 + rand() * (p - 60);
        const sy = -p / 2 + 30 + rand() * (p - 60);
        const r = 10 + rand() * 18;
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(190,140,70,0.35)');
        g.addColorStop(1, 'rgba(190,140,70,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(sx, sy, r, 0, TAU);
        c.fill();
      }
      c.restore();
    }
  // A few stray toasted sesame seeds, muted
  for (let i = 0; i < 18; i++) {
    const x = rand() * size;
    const y = rand() * size;
    c.save();
    c.translate(x, y);
    c.rotate(rand() * Math.PI);
    c.beginPath();
    c.ellipse(0, 0, 3, 1.8, 0, 0, TAU);
    c.fillStyle = 'rgba(200,160,100,0.6)';
    c.fill();
    c.restore();
  }
}

// Everything drawn for the M17 weapons and Bakery upgrades: the Pizza Cutter, the Whisk Whirl, their toppings and
// evolutions, the Toast and Jam combo, Proofing and the Day-Old Bin.
import { INK, drawJamJar, drawPlayerToast, ink, linear, radial, rrect, type Ctx } from './art';

const TAU = Math.PI * 2;

function fillInk(c: Ctx, fill: string | CanvasGradient, w = 2): void {
  c.fillStyle = fill;
  c.fill();
  ink(c, w);
}

/** The Pizza Cutter's wheel: a steel disc with a hub and little notches so the spin shows (s × s). */
export function drawCutter(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1.6, 0, TAU);
  fillInk(c, radial(c, m - s * 0.15, m - s * 0.18, m, [[0, '#ffffff'], [0.6, '#cfd8e0'], [1, '#8794a2']]), 2);
  c.strokeStyle = '#6f7c8a';
  c.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    c.beginPath();
    c.moveTo(m + Math.cos(a) * m * 0.42, m + Math.sin(a) * m * 0.42);
    c.lineTo(m + Math.cos(a) * m * 0.74, m + Math.sin(a) * m * 0.74);
    c.stroke();
  }
  c.beginPath();
  c.arc(m, m, m * 0.26, 0, TAU);
  fillInk(c, '#e0533d', 1.4);
  c.beginPath();
  c.arc(m - m * 0.07, m - m * 0.08, m * 0.09, 0, TAU);
  c.fillStyle = '#ffd2c4';
  c.fill();
}

/** A whirlwind seen from above: cream spiral arms on a soft disc (s × s, scaled to its reach). */
export function drawWhirl(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 1, 0, TAU);
  c.fillStyle = radial(c, m, m, m, [[0, 'rgba(255,250,236,0.55)'], [0.7, 'rgba(255,243,214,0.3)'], [1, 'rgba(255,243,214,0)']]);
  c.fill();
  c.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    const a0 = (arm / 3) * TAU;
    for (const [w, col] of [[5, 'rgba(36,22,13,0.55)'], [2.8, '#fff6e0']] as const) {
      c.beginPath();
      for (let i = 0; i <= 14; i++) {
        const k = i / 14;
        const a = a0 + k * 2.6;
        const r = m * (0.14 + 0.72 * k);
        const x = m + Math.cos(a) * r;
        const y = m + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.lineWidth = w;
      c.strokeStyle = col;
      c.stroke();
    }
  }
  c.beginPath();
  c.arc(m, m, m * 0.12, 0, TAU);
  c.fillStyle = '#fffdf4';
  c.fill();
}

/** A dab of hot pizza sauce on the floor (128 × 128, scaled to size). Red, so it never reads as seeds. */
export function drawSaucePool(c: Ctx, s: number): void {
  const m = s / 2;
  c.beginPath();
  c.arc(m, m, m - 2, 0, TAU);
  c.fillStyle = 'rgba(206,52,30,0.62)';
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(110,22,12,0.7)';
  c.stroke();
  c.beginPath();
  c.arc(m, m, m * 0.62, 0, TAU);
  c.fillStyle = 'rgba(238,96,52,0.6)';
  c.fill();
  c.beginPath();
  c.ellipse(s * 0.38, s * 0.36, s * 0.13, s * 0.08, -0.5, 0, TAU);
  c.fillStyle = 'rgba(255,214,170,0.8)';
  c.fill();
}

/** Icons (36 × 36) for the level-up cards, the Bakery and the card bin. */
export const UTENSIL_ICONS: Record<string, (c: Ctx) => void> = {
  ic_cutter: (c) => {
    // Handle
    c.save();
    c.translate(18, 18);
    c.rotate(-0.75);
    rrect(c, 2, -3.5, 15, 7, 3.5);
    fillInk(c, linear(c, 0, -4, 0, 4, [[0, '#ef6a52'], [1, '#b8371f']]));
    rrect(c, -4, -1.6, 8, 3.2, 1.2);
    fillInk(c, '#aab6c2', 1.4);
    c.restore();
    c.save();
    c.translate(1, 9);
    drawCutter(c, 22);
    c.restore();
  },
  ic_whisk: (c) => {
    c.save();
    c.translate(18, 18);
    c.rotate(0.7);
    rrect(c, -2.6, -16, 5.2, 12, 2.4);
    fillInk(c, linear(c, 0, -16, 0, -4, [[0, '#f0c070'], [1, '#b8782a']]));
    c.lineCap = 'round';
    for (const w of [8.5, 4.5, 0]) {
      for (const [lw, col] of [[4, INK], [1.8, '#e8eef4']] as const) {
        c.beginPath();
        c.moveTo(0, -5);
        c.bezierCurveTo(-w, 0, -w, 12, 0, 15);
        c.bezierCurveTo(w, 12, w, 0, 0, -5);
        c.lineWidth = lw;
        c.strokeStyle = col;
        c.stroke();
      }
    }
    c.restore();
  },
  ic_oil: (c) => {
    // A little bottle of olive oil with a cork.
    rrect(c, 15, 3, 6, 5, 1.5);
    fillInk(c, '#c99a5a', 1.6);
    c.beginPath();
    c.moveTo(15.5, 8);
    c.lineTo(20.5, 8);
    c.lineTo(20.5, 13);
    c.quadraticCurveTo(27, 15, 27, 21);
    c.lineTo(27, 30);
    c.quadraticCurveTo(27, 33, 24, 33);
    c.lineTo(12, 33);
    c.quadraticCurveTo(9, 33, 9, 30);
    c.lineTo(9, 21);
    c.quadraticCurveTo(9, 15, 15.5, 13);
    c.closePath();
    fillInk(c, linear(c, 0, 8, 0, 33, [[0, '#dfe8a8'], [0.35, '#c6cf52'], [1, '#8e9a24']]));
    rrect(c, 12, 20, 12, 8, 1.5);
    c.fillStyle = '#fff6d8';
    c.fill();
    c.beginPath();
    c.ellipse(18, 24, 3, 2, 0, 0, TAU);
    c.fillStyle = '#5c6b1c';
    c.fill();
    c.beginPath();
    c.ellipse(12.5, 17, 1.2, 3, 0.3, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fill();
  },
  ic_vanilla: (c) => {
    // A cream vanilla flower with a pod across it.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      c.beginPath();
      c.ellipse(17 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 6.5, 4.6, a, 0, TAU);
      fillInk(c, radial(c, 17, 16, 16, [[0, '#fffdf2'], [1, '#f1e2b4']]), 1.6);
    }
    c.beginPath();
    c.arc(17, 16, 3.4, 0, TAU);
    fillInk(c, '#f2b84b', 1.4);
    c.lineCap = 'round';
    for (const [lw, col] of [[5.5, INK], [3, '#5a3418']] as const) {
      c.beginPath();
      c.moveTo(8, 32);
      c.quadraticCurveTo(20, 30, 31, 20);
      c.lineWidth = lw;
      c.strokeStyle = col;
      c.stroke();
    }
  },
  // The second secret combo: toast landing in a pool of jam, with the jar beside it.
  ic_toastjam: (c) => {
    c.beginPath();
    c.ellipse(18, 26, 14, 7, 0, 0, TAU);
    fillInk(c, radial(c, 18, 26, 14, [[0, '#b46ae0'], [1, '#6a2a9e']]));
    c.save();
    c.translate(21, 13);
    c.rotate(0.25);
    c.scale(1.15, 1.15);
    c.translate(-9, -9);
    drawPlayerToast(c, 18);
    c.restore();
    c.save();
    c.translate(2, 9);
    c.rotate(-0.2);
    c.scale(0.8, 0.8);
    drawJamJar(c, 16, 20);
    c.restore();
    c.fillStyle = '#e0c4fa';
    for (const [x, y, r] of [[9, 26, 1.6], [28, 28, 1.3], [25, 23, 1]]) {
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
  },
  // Proofing: a ball of dough rising under a cloth, with an arrow up.
  ic_bk_proof: (c) => {
    rrect(c, 5, 22, 26, 10, 4);
    fillInk(c, linear(c, 0, 22, 0, 32, [[0, '#c98a4a'], [1, '#8a5222']]));
    c.beginPath();
    c.moveTo(7, 23);
    c.quadraticCurveTo(7, 9, 18, 9);
    c.quadraticCurveTo(29, 9, 29, 23);
    c.closePath();
    fillInk(c, radial(c, 15, 14, 14, [[0, '#fff6e0'], [1, '#ecd2a0']]));
    c.strokeStyle = '#6cc7f0';
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(18, 20);
    c.lineTo(18, 13);
    c.moveTo(14.5, 16);
    c.lineTo(18, 12.5);
    c.lineTo(21.5, 16);
    c.stroke();
  },
  // Day-Old Bin: a bakery bin with a "day old" loaf poking out.
  ic_bk_bin: (c) => {
    c.beginPath();
    c.ellipse(18, 10, 8, 5.5, 0, 0, TAU);
    fillInk(c, radial(c, 16, 8, 9, [[0, '#d9b98c'], [1, '#9a7a52']]));
    c.beginPath();
    c.moveTo(7, 13);
    c.lineTo(29, 13);
    c.lineTo(26.5, 32);
    c.lineTo(9.5, 32);
    c.closePath();
    fillInk(c, linear(c, 0, 13, 0, 32, [[0, '#8fa0b0'], [1, '#56646f']]));
    rrect(c, 5, 11, 26, 4.5, 2);
    fillInk(c, '#b6c2cc', 1.6);
    c.strokeStyle = 'rgba(36,22,13,0.5)';
    c.lineWidth = 1.5;
    for (const x of [13.5, 18, 22.5]) {
      c.beginPath();
      c.moveTo(x, 18);
      c.lineTo(x + (x - 18) * 0.12, 29);
      c.stroke();
    }
  },
  // The small bin on a level-up card.
  ic_bin: (c) => {
    c.beginPath();
    c.moveTo(9, 13);
    c.lineTo(27, 13);
    c.lineTo(25, 31);
    c.lineTo(11, 31);
    c.closePath();
    fillInk(c, linear(c, 0, 13, 0, 31, [[0, '#f3e4c4'], [1, '#cdb48a']]));
    rrect(c, 6.5, 8.5, 23, 5, 2);
    fillInk(c, '#fff3dc', 1.8);
    rrect(c, 14.5, 4.5, 7, 4.5, 1.5);
    fillInk(c, '#fff3dc', 1.6);
    c.strokeStyle = INK;
    c.lineWidth = 1.7;
    c.lineCap = 'round';
    for (const x of [14.5, 18, 21.5]) {
      c.beginPath();
      c.moveTo(x, 17.5);
      c.lineTo(x + (x - 18) * 0.1, 27);
      c.stroke();
    }
  },
};

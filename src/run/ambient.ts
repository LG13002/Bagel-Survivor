import Phaser from 'phaser';
import { S, ZOOM } from '../config';
import { settings } from '../settings';
import type { GameScene } from '../scenes/GameScene';

interface Mote {
  im: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  alpha: number;
}

/** The look of each kind of stage air: the edge tint, and what floats in it. */
const AIR = {
  // The Bakery: warm edges, flour dust hanging in the light.
  warm: { tint: 0x4a2208, edge: 0.4, n: 14, color: 0xfff3dc, alpha: [0.14, 0.34], size: [0.5, 1.3], vx: [-7, 7], vy: [-4, 3], haze: 0 },
  // The Freezer: cold blue edges, frost drifting down.
  cold: { tint: 0x0b2c5c, edge: 0.46, n: 18, color: 0xe6f7ff, alpha: [0.25, 0.6], size: [0.4, 0.95], vx: [-16, -4], vy: [14, 32], haze: 0 },
  // The Toaster Oven: red-hot edges, sparks and a haze of heat rising.
  hot: { tint: 0x7a1c05, edge: 0.46, n: 12, color: 0xffa64a, alpha: [0.3, 0.6], size: [0.35, 0.8], vx: [-5, 5], vy: [-38, -18], haze: 4 },
  // The Pantry: a dim amber light at the edges and slow dust hanging in the air.
  dim: { tint: 0x2a1604, edge: 0.52, n: 16, color: 0xf2dcae, alpha: [0.12, 0.3], size: [0.4, 1.1], vx: [-4, 4], vy: [-3, 5], haze: 0 },
};

const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

/**
 * The stage's atmosphere, drawn over the world and under the HUD: a soft tint around the screen's edges (warm in the
 * Bakery and the oven, cold in the Freezer) and a few specks drifting in the air. Both are skipped with Battery
 * saver on. Nothing here touches play. Made fresh for every run.
 */
export class Ambient {
  private tint: Phaser.GameObjects.Image;
  private motes: Mote[] = [];
  private lastX = 0;
  private lastY = 0;
  private lastMs = 0;

  constructor(private g: GameScene) {
    const st = g.stage;
    const air = st.frost ? AIR.cold : st.coils ? AIR.hot : st.shelves ? AIR.dim : AIR.warm;
    this.tint = g.ui(g.add.image(0, 0, 'vignette').setOrigin(0).setTint(air.tint).setAlpha(air.edge).setDepth(-8));
    // Battery saver: no tint (a whole screen of blending every frame) and no specks.
    if (settings().saver) {
      this.tint.setVisible(false);
      return;
    }
    const W = g.scale.width;
    const H = g.scale.height;
    const add = (haze: boolean) => {
      const im = g.ui(g.add.image(0, 0, 'mote').setTint(air.color).setDepth(-7));
      const alpha = haze ? 0.07 : rnd(air.alpha);
      im.setScale(haze ? 9 + Math.random() * 5 : rnd(air.size)).setAlpha(alpha);
      this.motes.push({ im, x: Math.random() * W, y: Math.random() * H, vx: rnd(air.vx) * S, vy: (haze ? -14 : rnd(air.vy)) * S, phase: Math.random() * 6.3, alpha });
    };
    for (let i = 0; i < air.n; i++) add(false);
    for (let i = 0; i < air.haze; i++) add(true);
    this.lastX = g.player.x;
    this.lastY = g.player.y;
  }

  layout(): void {
    this.tint.setDisplaySize(this.g.scale.width, this.g.scale.height);
  }

  /** Once a frame while the run is going. The specks drift, and slide a little against the way you walk. */
  update(): void {
    if (!this.motes.length) return;
    const g = this.g;
    const now = performance.now();
    const dt = this.lastMs ? Math.min(0.05, (now - this.lastMs) / 1000) : 0;
    this.lastMs = now;
    const W = g.scale.width;
    const H = g.scale.height;
    const m = 24 * S;
    const px = (g.player.x - this.lastX) * S * ZOOM * 0.6;
    const py = (g.player.y - this.lastY) * S * ZOOM * 0.6;
    this.lastX = g.player.x;
    this.lastY = g.player.y;
    const t = now / 1000;
    for (const o of this.motes) {
      o.x += o.vx * dt - px + Math.sin(t * 0.9 + o.phase) * 5 * S * dt;
      o.y += o.vy * dt - py;
      if (o.x < -m) o.x += W + 2 * m;
      else if (o.x > W + m) o.x -= W + 2 * m;
      if (o.y < -m) o.y += H + 2 * m;
      else if (o.y > H + m) o.y -= H + 2 * m;
      o.im.setPosition(o.x, o.y);
      o.im.alpha = o.alpha * (0.7 + 0.3 * Math.sin(t * 2.2 + o.phase));
    }
  }
}

import Phaser from 'phaser';
import { settings } from '../settings';
import { S } from '../config';
import type { Enemy } from '../entities';
import type { FxId } from '../weapons';
import type { GameScene } from '../scenes/GameScene';

/**
 * Short-lived effect sprites: sparks, crumbs, trail dots and death pops. These come and go by the hundred, so finished
 * ones are kept and reused instead of being created and thrown away. Made fresh for every run.
 */
export class Effects {
  /** Effect sprites on screen right now (busy effects are skipped when there are too many). */
  particles = 0;
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(private g: GameScene) {}

  /** A pooled effect sprite. Hand it back with `done` when its animation ends. */
  fx(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    this.particles++;
    const im = this.pool.pop();
    if (!im) {
      const made = this.g.add.image(x, y, tex).setScale(1 / S).setDepth(depth);
      this.g.worldLayer.add(made);
      return made;
    }
    im.setTexture(tex).setPosition(x, y).setDepth(depth).setScale(1 / S).setRotation(0).setAlpha(1).setFlipX(false).clearTint();
    return im.setActive(true).setVisible(true);
  }

  done(im: Phaser.GameObjects.Image): void {
    this.particles--;
    im.setActive(false).setVisible(false);
    this.pool.push(im);
  }

  /** How many effect sprites may be on screen before new ones are skipped. Battery saver halves it. */
  private cap(n: number): number {
    return settings().saver ? n / 2 : n;
  }

  /** A white copy of the enemy that swells and fades where it died. */
  deathPop(e: Enemy): void {
    if (this.particles > this.cap(140)) return;
    const im = this.fx(e.sprite.texture.key, e.x, e.y, 39);
    const sc = e.sprite.scaleX;
    im.setScale(sc).setTintFill(0xffffff).setRotation(e.sprite.rotation).setFlipX(e.sprite.flipX);
    this.g.tweens.add({ targets: im, scaleX: sc * 1.6, scaleY: sc * 0.4, alpha: 0, duration: 140, ease: 'Quad.Out', onComplete: () => this.done(im) });
  }

  /** A little fading dot behind a projectile (weapons at level 5 and evolved). */
  trailDot(x: number, y: number, color: number): void {
    if (settings().saver || this.particles > 120) return;
    const im = this.fx('dot', x, y, 18).setTint(color).setAlpha(0.85);
    im.setScale(0.42 / S);
    this.g.tweens.add({ targets: im, alpha: 0, scale: 0.1 / S, duration: 240, onComplete: () => this.done(im) });
  }

  /** Each weapon's own small hit spark ("Crisp" flare: quick, small, never hides enemies). */
  hitSpark(x: number, y: number, id: FxId): void {
    if (this.particles > this.cap(110)) return;
    // Damage-over-time weapons tick a lot, so they spark less often.
    if ((id === 'puddle' || id === 'jar' || id === 'storm' || id === 'combo') && Math.random() < 0.6) return;
    const tweens = this.g.tweens;
    const part = (tex: string, tint: number, scale: number, dx: number, dy: number, ms: number, rot = 0, depth = 41) => {
      const im = this.fx(tex, x, y, depth).setTint(tint).setRotation(rot);
      im.setScale(scale / S);
      tweens.add({ targets: im, x: x + dx, y: y + dy, alpha: 0, scale: (scale * 0.4) / S, duration: ms, ease: 'Cubic.Out', onComplete: () => this.done(im) });
    };
    const pop = (tex: string, tint: number, from: number, to: number, ms: number, rot = 0) => {
      const im = this.fx(tex, x, y, 41).setTint(tint).setRotation(rot);
      im.setScale(from / S);
      tweens.add({ targets: im, scale: to / S, alpha: 0, duration: ms, ease: 'Quad.Out', onComplete: () => this.done(im) });
    };
    const rnd = () => Math.random() * Math.PI * 2;
    const spray = (tex: string, tint: number, n: number, dist: number, scale: number, ms: number, fall = 0) => {
      for (let i = 0; i < n; i++) {
        const a = rnd();
        const d = dist * (0.5 + Math.random() * 0.5);
        part(tex, tint, scale, Math.cos(a) * d, Math.sin(a) * d + fall, ms, a);
      }
    };
    switch (id) {
      case 'sesame': // a tiny white twinkle
        pop('star4', 0xfffbe8, 0.5, 1.1, 140, rnd());
        break;
      case 'storm': // golden seed sparks
        spray('dot', 0xffd34d, 2, 14, 0.35, 200);
        break;
      case 'puddle': // soft cream blobs
        spray('dot', 0xfff8ea, 2, 10, 0.45, 220);
        break;
      case 'lox': // a pink swipe
        pop('streak', 0xff9a7a, 0.7, 1.3, 160, rnd());
        break;
      case 'coffee': // hot brown droplets that fall
        spray('dot', 0x7a3f1c, 3, 14, 0.35, 260, 10);
        break;
      case 'pin': // wood chips and a white bonk ring
        spray('chip', 0xffffff, 3, 22, 0.8, 300, 6);
        pop('hitring', 0xffffff, 0.3, 0.75, 160);
        break;
      case 'knife': // a silver glint
        pop('streak', 0xe6f4ff, 0.6, 1.4, 130, rnd());
        pop('star4', 0xffffff, 0.4, 0.9, 120, rnd());
        break;
      case 'jar': // purple jam splats
        spray('dot', 0x8a4fc8, 2, 12, 0.4, 240, 4);
        break;
      case 'toastpop': // golden crumbs and a small ring
        spray('dot', 0xe9b56a, 2, 14, 0.35, 220, 6);
        pop('hitring', 0xffe2a0, 0.25, 0.6, 150);
        break;
      case 'iron': // dusty puff
        pop('hitring', 0xffd27a, 0.35, 0.9, 200);
        spray('dot', 0xf0dcb0, 2, 16, 0.45, 260);
        break;
      case 'combo': // a pink swipe through a cream splat
        if (Math.random() < 0.5) pop('streak', 0xff9a7a, 0.8, 1.4, 160, rnd());
        spray('dot', 0xfff8ea, 2, 12, 0.45, 220);
        break;
    }
  }

  /** A puff of crumbs flying out from a point. */
  burst(x: number, y: number, color: number, n: number, dist: number): void {
    if (this.particles > this.cap(160)) return;
    for (let i = 0; i < n; i++) {
      const im = this.fx('dot', x, y, 40).setTint(color);
      const s = (0.4 + Math.random() * 0.6) / S;
      im.setScale(s);
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      this.g.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0, duration: 280 + Math.random() * 160, ease: 'Cubic.Out', onComplete: () => this.done(im) });
    }
  }
}

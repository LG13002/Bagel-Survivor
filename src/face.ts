// A bagel's living eyes: two eyeballs and pupils laid over an eyeless bagel picture. They blink, look where the
// bagel is going, squint when it's hurt, and follow the picture's position, squash, spin and fade every frame.
import Phaser from 'phaser';
import { S } from './config';
import { ctex, ink } from './art';

const TAU = Math.PI * 2;
/** Where the eyes sit on a bagel of radius 1, and how big they are (the same numbers `drawBagel` uses). */
const EYE_X = 0.31;
const EYE_Y = -0.6;
const EYE_R = 0.24;

/** Eyeball and pupil pictures for a bagel drawn with radius `r` (logical px). Returns their texture keys. */
function eyeTex(scene: Phaser.Scene, r: number): { ball: string; pupil: string; d: number } {
  const er = r * EYE_R;
  const line = Math.max(1.6, r * 0.15) * 0.75;
  const d = Math.ceil((er + line) * 2 + 2);
  const id = Math.round(r * 10);
  ctex(scene, `eyeball_${id}`, d, d, (c) => {
    c.beginPath();
    c.arc(d / 2, d / 2, er, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    ink(c, line);
  });
  ctex(scene, `eyepupil_${id}`, d, d, (c) => {
    c.beginPath();
    c.arc(d / 2, d / 2, er * 0.56, 0, TAU);
    c.fillStyle = '#1a1008';
    c.fill();
    c.beginPath();
    c.arc(d / 2 - er * 0.2, d / 2 - er * 0.22, er * 0.2, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
  });
  return { ball: `eyeball_${id}`, pupil: `eyepupil_${id}`, d };
}

export type Mood = '' | 'sad' | 'happy';

export class Face {
  private balls: Phaser.GameObjects.Image[] = [];
  private pupils: Phaser.GameObjects.Image[] = [];
  private lx = 0.15;
  private ly = 0.2;
  private tx = 0.15;
  private ty = 0.2;
  private blinkIn = 1 + Math.random() * 3;
  private blinkT = 0;
  private winceT = 0;
  private glanceIn = 2 + Math.random() * 3;
  /** Sad: half-closed, looking down. Happy: wide, looking up. */
  mood: Mood = '';
  /** Look around now and then when nothing else is steering the eyes (menus). */
  idle = false;

  /**
   * @param target the eyeless bagel picture
   * @param r the bagel's radius in that picture, in logical px (15.5 for the 40px bagels, 62 for the big ones)
   * @param add puts each eye part where it belongs (a layer or a container), above the bagel
   */
  constructor(private scene: Phaser.Scene, private target: Phaser.GameObjects.Image, private r: number, add: (o: Phaser.GameObjects.Image) => void) {
    const tex = eyeTex(scene, r);
    for (let i = 0; i < 2; i++) {
      const b = scene.add.image(0, 0, tex.ball);
      const p = scene.add.image(0, 0, tex.pupil);
      add(b);
      add(p);
      this.balls.push(b);
      this.pupils.push(p);
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    target.once(Phaser.GameObjects.Events.DESTROY, () => this.destroy());
    this.sync(0, 0);
  }

  /** Look this way (a direction, length up to 1). 0, 0 goes back to the resting look. */
  look(x: number, y: number): void {
    const l = Math.hypot(x, y);
    if (l < 0.1) {
      this.tx = 0.15;
      this.ty = 0.2;
    } else {
      this.tx = (x / Math.max(1, l)) * 0.4;
      this.ty = (y / Math.max(1, l)) * 0.4;
    }
  }

  /** Squint for a moment (a hit). */
  wince(sec = 0.3): void {
    this.winceT = sec;
  }

  blink(): void {
    this.blinkT = 0.13;
  }

  setDepth(d: number): void {
    for (const o of [...this.balls, ...this.pupils]) o.setDepth(d);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    for (const o of [...this.balls, ...this.pupils]) o.destroy();
    this.balls = [];
    this.pupils = [];
  }

  private sync(_time: number, delta: number): void {
    const t = this.target;
    if (!this.balls.length || !t.scene) return;
    const dt = Math.min(0.05, delta / 1000);
    // Blinks, squints and the odd glance.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkIn = 2.2 + Math.random() * 3.2;
      this.blinkT = 0.13;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    if (this.winceT > 0) this.winceT -= dt;
    if (this.idle) {
      this.glanceIn -= dt;
      if (this.glanceIn <= 0) {
        this.glanceIn = 1.6 + Math.random() * 3;
        if (Math.random() < 0.4) this.look(0, 0);
        else this.look(Math.random() * 2 - 1, Math.random() * 1.2 - 0.5);
      }
    }
    let wantX = this.tx;
    let wantY = this.ty;
    let lid = 1;
    if (this.mood === 'sad') {
      wantX = 0;
      wantY = 0.4;
      lid = 0.5;
    } else if (this.mood === 'happy') {
      wantX = 0;
      wantY = -0.3;
      lid = 1.12;
    }
    if (this.winceT > 0) lid = Math.min(lid, 0.3);
    if (this.blinkT > 0) lid = 0.12;
    const k = 1 - Math.exp(-14 * dt);
    this.lx += (wantX - this.lx) * k;
    this.ly += (wantY - this.ly) * k;

    const sx = t.scaleX;
    const sy = t.scaleY;
    const cos = Math.cos(t.rotation);
    const sin = Math.sin(t.rotation);
    const rp = this.r * S; // bagel radius in texture px
    const er = rp * EYE_R;
    const show = t.visible && t.alpha > 0.02;
    for (let i = 0; i < 2; i++) {
      const ox = (i ? EYE_X : -EYE_X) * rp * sx;
      const oy = EYE_Y * rp * sy;
      const x = t.x + ox * cos - oy * sin;
      const y = t.y + ox * sin + oy * cos;
      const b = this.balls[i];
      b.setVisible(show).setPosition(x, y).setScale(sx, sy * lid).setRotation(t.rotation).setAlpha(t.alpha);
      const px = this.lx * er * sx;
      const py = this.ly * er * sy * lid;
      this.pupils[i]
        .setVisible(show && lid > 0.25)
        .setPosition(x + px * cos - py * sin, y + px * sin + py * cos)
        .setScale(sx, sy * Math.min(1, lid))
        .setRotation(t.rotation)
        .setAlpha(t.alpha);
    }
  }
}

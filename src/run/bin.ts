import Phaser from 'phaser';
import { S } from '../config';
import { RUN } from '../data';
import { blink as blinkAt, reducedFlash, settings } from '../settings';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

/** Stale creep: shimmer time, the size a patch appears at, how fast it spreads, its largest size, and how many at once. */
const CREEP_WARN = 1.1;
const CREEP_START = 20;
const CREEP_GROW = 5;
const CREEP_MAX = 50;
const CREEP_MAX_VAR = 16;
const CREEP_CAP = 8;
/** A patch shrunk below this is gone. */
const CREEP_GONE = 13;
/** How much of your speed is left inside a patch. */
export const CREEP_SLOW = 0.7;
/** The creep picture's stain is this many units across at full size. */
const CREEP_TEX_R = 70;
/** Falling crumbs: warning time, size, damage to you and to enemies under it. */
const CRUMB_WARN = 1.2;
const CRUMB_R = 30;
const CRUMB_DMG = 8;
const CRUMB_ENEMY_DMG = 45;
/** The dim bin: how dark the floor gets away from the bagel, and how dark the King's spells are. */
const DIM = 0.62;
const SPELL = 0.93;

interface Patch {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  max: number;
  warn: number;
  /** Burning away with the King (seconds until it starts). */
  dying: number;
}

interface Crumb {
  x: number;
  y: number;
  t: number;
  img: Phaser.GameObjects.Image | null;
}

/**
 * The Bread Bin's own hazards: Stale creep (grey patches that slow the bagel and that weapon hits burn back), crumbs
 * falling from above, and the dark (a dim floor all run, and the Stale King's spells of real darkness). Owned by
 * `Hazards`, made fresh for every run, and idle outside the Bread Bin.
 */
export class Bin {
  patches: Patch[] = [];
  private crumbs: Crumb[] = [];
  /** The Stale King's charge lanes for this step: drawn above the dark, then forgotten. */
  private lanes: { x: number; y: number; ux: number; uy: number; len: number; hw: number; k: number }[] = [];
  private creepNext: number;
  private crumbNext: number;
  private gfx?: Phaser.GameObjects.Graphics;
  private topGfx?: Phaser.GameObjects.Graphics;
  private dim?: Phaser.GameObjects.Image;
  private spell?: Phaser.GameObjects.Image;
  private darkOn = false;
  private darkA = 0;
  /** A patch has appeared this run: the first one brings its tip. */
  creepSeen = false;

  constructor(private g: GameScene) {
    this.creepNext = g.now + 16;
    this.crumbNext = g.now + 11;
    const st = g.stage;
    if (!st.creep && !st.crumbs && !st.dark) return;
    this.gfx = g.add.graphics().setDepth(3.1);
    this.topGfx = g.add.graphics().setDepth(38);
    g.worldLayer.add([this.gfx, this.topGfx]);
    if (st.dark) {
      // Battery saver: no dim layer over the floor (a whole screen of blending every frame). The spells stay.
      if (!settings().saver) this.dim = g.img('darkness', 0, 0, 1.8).setAlpha(DIM);
      this.spell = g.img('darkness2', 0, 0, 37).setAlpha(0).setVisible(false);
    }
  }

  /** Is the dark at least half down? (The King stands out against it.) */
  get isDark(): boolean {
    return this.darkA > 0.5;
  }

  /** The Stale King's spell: the bin goes dark except around the bagel, or the light comes back. */
  setDark(on: boolean): void {
    this.darkOn = on;
  }

  /** A charge lane for the Stale King, shown above the dark. `k` 0 to 1: how close the dash is. */
  lane(x: number, y: number, ux: number, uy: number, len: number, hw: number, k: number): void {
    this.lanes.push({ x, y, ux, uy, len, hw, k });
  }

  // ---------------------------------------------------------------- Stale creep

  /** Is this point in a patch of creep? */
  creepAt(x: number, y: number): boolean {
    for (const c of this.patches) {
      if (c.warn > 0) continue;
      const dx = x - c.x;
      const dy = y - c.y;
      const r = c.r * 0.92;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  /** A weapon hit landed at (x, y): every patch it is on or beside shrinks, and one shrunk to nothing is burned away. */
  burnAt(x: number, y: number, dmg: number): void {
    const g = this.g;
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const c = this.patches[i];
      if (c.warn > 0 || c.dying) continue;
      const dx = x - c.x;
      const dy = y - c.y;
      const reach = c.r + 18;
      if (dx * dx + dy * dy > reach * reach) continue;
      c.r -= Math.min(7, 1.5 + dmg * 0.12);
      if (g.effects.particles < 110 && Math.random() < 0.25) g.effects.burst(x, y, 0xffc27a, 1, 18);
      if (c.r < CREEP_GONE) {
        this.burnOff(c);
        this.patches.splice(i, 1);
        g.run.creepBurned++;
        if (g.run.creepBurned === 25 && !g.practice) g.hud.banner('25 patches of creep burned away!', '#ffc27a', 18);
      }
    }
  }

  private burnOff(c: Patch): void {
    const g = this.g;
    sfx('burnoff');
    g.effects.burst(c.x, c.y, 0xffc27a, 8, 46);
    const img = c.img;
    g.tweens.add({ targets: img, alpha: 0, scale: img.scale * 0.5, duration: 200, onComplete: () => img.destroy() });
  }

  /** A new patch: it shimmers where it will appear, then spreads. Never under the bagel, and never past the cap. */
  addCreep(x?: number, y?: number): boolean {
    const g = this.g;
    const p = g.player;
    if (this.patches.length >= CREEP_CAP) return false;
    const max = CREEP_MAX + Math.random() * CREEP_MAX_VAR;
    for (let tries = 0; tries < 6; tries++) {
      let cx = x;
      let cy = y;
      if (cx === undefined || cy === undefined) {
        const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
        const a = moving && Math.random() < 0.5 ? Math.atan2(p.moveY, p.moveX) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
        const d = max + 40 + Math.random() * 110;
        cx = p.x + Math.cos(a) * d;
        cy = p.y + Math.sin(a) * d;
      }
      // Clear of the bagel, and not on top of another patch.
      if (Math.hypot(cx - p.x, cy - p.y) < CREEP_START + p.radius + 30) {
        if (x !== undefined) return false;
        continue;
      }
      if (this.patches.some((c) => Math.hypot(cx! - c.x, cy! - c.y) < c.max + max * 0.6)) {
        if (x !== undefined) return false;
        continue;
      }
      const img = g.img('creep', cx, cy, 1.9);
      img.setRotation(Math.random() * Math.PI * 2).setScale(CREEP_START / CREEP_TEX_R / S).setAlpha(0);
      this.patches.push({ img, x: cx, y: cy, r: CREEP_START, max, warn: CREEP_WARN, dying: 0 });
      this.creepSeen = true;
      return true;
    }
    return false;
  }

  /** The King fell: every patch burns away in a wave spreading out from him. */
  burnAll(x: number, y: number): void {
    for (const c of this.patches) c.dying = 0.05 + Math.hypot(c.x - x, c.y - y) / 900;
  }

  // ---------------------------------------------------------------- Falling crumbs

  /** A crumb is about to fall: on you if you stand still, a step ahead if you are walking. */
  private addCrumb(): void {
    const p = this.g.player;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 46;
    const lead = moving ? 50 : 0;
    this.crumbs.push({ x: p.x + p.moveX * lead + Math.cos(a) * d, y: p.y + p.moveY * lead + Math.sin(a) * d, t: CRUMB_WARN, img: null });
  }

  // ---------------------------------------------------------------- Each step

  update(dt: number): void {
    const g = this.g;
    const st = g.stage;
    const gfx = this.gfx;
    const top = this.topGfx;
    if (!gfx || !top) return;
    const p = g.player;
    // Real time, like every stage's hazards; more often as the run goes on, calmer while the boss is out.
    const k = Math.min(1, g.stageT / RUN.bossAt);
    const calm = g.foes.boss ? 1.5 : 1;
    if (st.creep && g.now >= this.creepNext) {
      this.creepNext = g.now + (7.5 - 2.5 * k) * calm;
      if (this.addCreep()) sfx('creep');
    }
    if (st.crumbs && g.now >= this.crumbNext) {
      this.crumbNext = g.now + (7 - 3 * k) * calm;
      this.addCrumb();
      // Endless: two at once after 6:00.
      if (g.endless && g.stageT > 360) this.addCrumb();
    }
    gfx.clear();
    top.clear();

    for (let i = this.patches.length - 1; i >= 0; i--) {
      const c = this.patches[i];
      if (c.dying) {
        c.dying -= dt;
        if (c.dying <= 0) {
          this.burnOff(c);
          this.patches.splice(i, 1);
        }
        continue;
      }
      // Left far behind: gone quietly (not counted as burned).
      if (Math.abs(c.x - p.x) > 640 || Math.abs(c.y - p.y) > 640) {
        c.img.destroy();
        this.patches.splice(i, 1);
        continue;
      }
      if (c.warn > 0) {
        c.warn -= dt;
        // A shimmer where it will appear: a pale ring and a few glints.
        const kk = 1 - Math.max(0, c.warn) / CREEP_WARN;
        const a = blinkAt(g.now, 9, 0.75, 0.4);
        gfx.lineStyle(2, 0xe6e6f0, a * (0.4 + 0.6 * kk)).strokeCircle(c.x, c.y, CREEP_START * (0.6 + 0.4 * kk));
        gfx.fillStyle(0xffffff, 0.5 * a);
        for (let j = 0; j < 4; j++) {
          const ga = g.now * 2 + j * 1.57;
          gfx.fillCircle(c.x + Math.cos(ga) * CREEP_START * 0.6, c.y + Math.sin(ga) * CREEP_START * 0.6, 1.4);
        }
        if (c.warn <= 0) g.tweens.add({ targets: c.img, alpha: 1, duration: 260 });
        continue;
      }
      if (c.r < c.max) c.r = Math.min(c.max, c.r + CREEP_GROW * dt);
      c.img.setScale(c.r / CREEP_TEX_R / S);
      // It never sits still: a pale edge that breathes and a few glints crawling around it, so it can't be taken
      // for a crumb pile or a puddle of schmear.
      gfx.lineStyle(1.5, 0xeef2ff, 0.3 + 0.25 * Math.sin(g.now * 3 + c.x)).strokeCircle(c.x, c.y, c.r * 0.9);
      gfx.fillStyle(0xffffff, 0.7);
      for (let j = 0; j < 3; j++) {
        const ga = g.now * 0.9 + j * 2.09 + c.y;
        const gr = c.r * (0.45 + 0.3 * Math.sin(g.now * 1.3 + j));
        gfx.fillCircle(c.x + Math.cos(ga) * gr, c.y + Math.sin(ga) * gr, 1.3);
      }
    }

    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const c = this.crumbs[i];
      c.t -= dt;
      if (c.t > 0) {
        // A round shadow grows where it will land, with a bright rim so it reads on the dark floor.
        const kk = 1 - c.t / CRUMB_WARN;
        const r = CRUMB_R * (0.35 + 0.65 * kk);
        const a = blinkAt(g.now, 6 + kk * 14, 1, 0.7);
        gfx.fillStyle(0x120a06, 0.3 + 0.3 * kk).fillCircle(c.x, c.y, r);
        gfx.fillStyle(0xff5a3c, (0.1 + 0.2 * kk) * a).fillCircle(c.x, c.y, CRUMB_R);
        gfx.lineStyle(2.5, 0xffffff, 0.85).strokeCircle(c.x, c.y, CRUMB_R);
        if (this.darkA > 0.05) top.lineStyle(2.5, 0xffffff, 0.85 * this.darkA).strokeCircle(c.x, c.y, CRUMB_R);
        // The chunk itself drops in over the last quarter second.
        if (c.t < 0.25) {
          if (!c.img) c.img = g.img('fallcrumb', c.x, c.y, 46);
          const f = c.t / 0.25;
          c.img.setPosition(c.x, c.y - f * 260).setRotation(f * 2);
        }
        continue;
      }
      sfx('crumbfall');
      g.effects.burst(c.x, c.y, 0xd2b58a, 10, 60);
      g.effects.dust(c.x, c.y + 6, CRUMB_R * 0.7);
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      if (dx * dx + dy * dy < (CRUMB_R + p.radius * 0.6) ** 2) g.damagePlayer(CRUMB_DMG);
      g.foes.query(c.x, c.y, CRUMB_R, (e) => {
        const d = Math.hypot(e.x - c.x, e.y - c.y) || 1;
        g.hit(e, CRUMB_ENEMY_DMG, ((e.x - c.x) / d) * 160, ((e.y - c.y) / d) * 160, 'crumb', 0);
      });
      const img = c.img ?? g.img('fallcrumb', c.x, c.y, 46);
      img.setPosition(c.x, c.y).setRotation(0);
      g.tweens.add({ targets: img, alpha: 0, scaleX: img.scaleX * 1.3, scaleY: img.scaleY * 0.6, duration: 320, delay: 120, onComplete: () => img.destroy() });
      this.crumbs.splice(i, 1);
    }

    // The dark. With Flashing effects Reduced it comes down slowly instead of snapping.
    const rate = this.darkOn ? (reducedFlash() ? 0.8 : 3) : 2.2;
    this.darkA = Math.max(0, Math.min(1, this.darkA + (this.darkOn ? rate : -rate) * dt));
    const size = Math.max(760, Math.hypot(g.viewW(), g.viewH()) * 1.1);
    this.dim?.setPosition(p.x, p.y).setDisplaySize(size * 1.2, size * 1.2);
    if (this.spell) {
      this.spell.setVisible(this.darkA > 0.01).setPosition(p.x, p.y).setDisplaySize(size, size).setAlpha(this.darkA * SPELL);
      if (this.darkA > 0.25) {
        // Small enemies outside the ring of light show as a pair of glowing eyes.
        const hw = g.viewW() / 2 + 20;
        const hh = g.viewH() / 2 + 20;
        top.fillStyle(0xbfeaff, this.darkA);
        for (const e of g.foes.list) {
          if (!e.alive || e.boss) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          if (Math.abs(dx) > hw || Math.abs(dy) > hh || dx * dx + dy * dy < 80 * 80) continue;
          const s = Math.max(1.6, e.radius * 0.2);
          top.fillRect(e.x - e.radius * 0.36 - s / 2, e.y - s / 2, s, s);
          top.fillRect(e.x + e.radius * 0.36 - s / 2, e.y - s / 2, s, s);
        }
      }
    }

    // The King's charge lanes glow through the dark.
    for (const l of this.lanes) {
      const px = -l.uy * l.hw;
      const py = l.ux * l.hw;
      const ex = l.x + l.ux * l.len;
      const ey = l.y + l.uy * l.len;
      const a = blinkAt(g.now, 8 + l.k * 10, 1, 0.75);
      top.fillStyle(0xe0533d, (0.2 + 0.25 * l.k) * a);
      top.lineStyle(2.5, 0xffe2c4, 0.9);
      top.beginPath();
      top.moveTo(l.x + px, l.y + py);
      top.lineTo(ex + px, ey + py);
      top.lineTo(ex - px, ey - py);
      top.lineTo(l.x - px, l.y - py);
      top.closePath();
      top.fillPath();
      top.strokePath();
    }
    this.lanes.length = 0;
  }
}

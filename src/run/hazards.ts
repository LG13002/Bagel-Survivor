import Phaser from 'phaser';
import { S } from '../config';
import { RUN } from '../data';
import type { EnemyShot, Hazard } from '../entities';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';
import { inPatch, POST_R, type IcePatch } from './floor';

/** Toaster Oven coil flare-ups: warning time, strip size, damage to you and to enemies on it. */
const COIL_WARN = 1.5;
const COIL_LEN = 300;
const COIL_W = 40;
const COIL_DMG = 8;
const COIL_ENEMY_DMG = 45;
/** Grease pops: wobble time, damage, and how long the slick lasts. */
const GREASE_WARN = 1.4;
const GREASE_R = 22;
const GREASE_DMG = 4;
const SLICK_LIFE = 3;
/** The Broiler's flame lines. */
const BEAM_W = 30;
const BEAM_DMG = 14;

interface Coil {
  x: number;
  y: number;
  horiz: boolean;
  t: number;
  flare: number;
}

/**
 * Everything that hurts you apart from enemy bodies: enemy shots, the Toaster Tyrant's landing rings, the Freezer's
 * melt puddles, icicle warnings and frost circles, and the oven's coils, grease, embers and the Broiler's flame lines.
 * Made fresh for every run.
 */
export class Hazards {
  shots: EnemyShot[] = [];
  /** Grease slicks and frozen floor from frost circles: they slide like ice, then melt away. */
  tempIce: (IcePatch & { life: number })[] = [];
  private rings: Hazard[] = [];
  private melts: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; life: number }[] = [];
  private warns: { x: number; y: number; a: number; t: number; n: number }[] = [];
  private freezes: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; t: number }[] = [];
  private coils: Coil[] = [];
  private greases: { img: Phaser.GameObjects.Image; x: number; y: number; t: number }[] = [];
  private sparks: { img: Phaser.GameObjects.Image; x: number; y: number; life: number; max: number; dmg: number; size: number }[] = [];
  /** The Broiler's flame lines: a warning glow, then a burst of fire along the line. */
  private beams: { x: number; y: number; a: number; t: number; burn: number }[] = [];
  private coilPatternN = 0;
  private coilNext: number;
  private greaseNext: number;
  private bossGfx: Phaser.GameObjects.Graphics;
  private ovenGfx: Phaser.GameObjects.Graphics;
  private beamGfx: Phaser.GameObjects.Graphics;

  constructor(private g: GameScene) {
    this.bossGfx = g.add.graphics().setDepth(3);
    g.worldLayer.add(this.bossGfx);
    this.ovenGfx = g.add.graphics().setDepth(2.5);
    g.worldLayer.add(this.ovenGfx);
    this.beamGfx = g.add.graphics().setDepth(3.2);
    g.worldLayer.add(this.beamGfx);
    // Oven hazards start a little into the run (real seconds, so Quick Runs aren't swamped).
    this.coilNext = g.now + 12;
    this.greaseNext = g.now + 20;
  }

  update(dt: number): void {
    this.updateShots(dt);
    this.updateRings(dt);
    this.updateFreezer(dt);
    this.updateOven(dt);
    this.updateBeams(dt);
  }

  // ---------------------------------------------------------------- Enemy shots

  fireShot(tex: string, x: number, y: number, a: number, speed: number, dmg: number, r: number, aim = false): void {
    const sprite = this.g.img(tex, x, y, 45);
    if (aim) sprite.setRotation(a);
    this.shots.push({ sprite, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 5, spin: aim ? 0 : (Math.random() - 0.5) * 10 });
  }

  /** A ring of n shots all around, turned by a random amount. */
  ring(tex: string, x: number, y: number, n: number, speed: number, dmg: number, r: number): void {
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) this.fireShot(tex, x, y, off + (i / n) * Math.PI * 2, speed, dmg, r);
  }

  /** A fan of n shots centred on angle a, `step` radians apart. */
  fan(tex: string, x: number, y: number, a: number, n: number, step: number, speed: number, dmg: number, r: number): void {
    for (let i = 0; i < n; i++) this.fireShot(tex, x, y, a + (i - (n - 1) / 2) * step, speed, dmg, r);
  }

  /** Second Bake: clear the air so the revived bagel has a moment. */
  clearShots(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      this.shots[i].sprite.destroy();
      this.shots.splice(i, 1);
    }
    this.beams.length = 0;
  }

  /** The boss fell (Endless): its queued flame lines go with it. */
  clearBeams(): void {
    this.beams.length = 0;
  }

  private updateShots(dt: number): void {
    const p = this.g.player;
    const posts = this.g.floor.posts;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.sprite.setPosition(s.x, s.y).setRotation(s.sprite.rotation + s.spin * dt);
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const rr = s.r + p.radius - 2;
      let dead = s.life <= 0;
      if (dx * dx + dy * dy < rr * rr) {
        this.g.damagePlayer(s.dmg);
        // Second Bake clears every shot, this one included: nothing is left to move.
        if (this.shots[i] !== s) return;
        dead = true;
      }
      // Rack posts block enemy shots (but never yours), so you can duck behind one.
      if (!dead && posts.length)
        for (const po of posts) {
          const px = s.x - po.x;
          const py = s.y - po.y;
          if (px * px + py * py < (POST_R + s.r) ** 2) {
            dead = true;
            sfx('clang');
            this.g.effects.burst(s.x, s.y, 0xd8d4d0, 4, 18);
            break;
          }
        }
      if (dead) {
        s.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- Toaster Tyrant landing rings

  /** A warning ring where a giant slice of toast will land. */
  addRing(x: number, y: number): void {
    const r = 38;
    const sprite = this.g.img('ring', x, y, 3);
    sprite.setScale(((r * 2) / 64) * (1 / S) * 0.2);
    this.g.tweens.add({ targets: sprite, scale: ((r * 2) / 64) * (1 / S), duration: 300, ease: 'Back.Out' });
    this.rings.push({ sprite, x, y, r, dmg: 18, t: 1.1 });
  }

  private updateRings(dt: number): void {
    const g = this.g;
    const p = g.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const h = this.rings[i];
      h.t -= dt;
      h.sprite.setAlpha(0.6 + 0.4 * Math.sin(g.now * 25));
      if (h.t <= 0) {
        const dx = h.x - p.x;
        const dy = h.y - p.y;
        if (dx * dx + dy * dy < (h.r + p.radius) ** 2) g.damagePlayer(h.dmg);
        const toast = g.img('toast', h.x, h.y - 120, 46);
        toast.setScale(2 / S);
        const sc = 2 / S;
        g.tweens.add({
          targets: toast,
          y: h.y,
          duration: 120,
          onComplete: () => {
            g.effects.burst(h.x, h.y, 0xd59a52, 8, 50);
            g.tweens.add({ targets: toast, alpha: 0, scale: sc * 1.4, duration: 220, onComplete: () => toast.destroy() });
          },
        });
        h.sprite.destroy();
        this.rings.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- Freezer elite and boss hazards

  /** A pink melt puddle (outlined in white) that slows the bagel. */
  addMelt(x: number, y: number, audible: boolean, r = 26, life = 7): void {
    const img = this.g.img('melt', x, y, 3);
    const sc = (r * 2) / 64 / S;
    img.setScale(sc * 0.3);
    this.g.tweens.add({ targets: img, scale: sc, duration: 260, ease: 'Back.Out' });
    this.melts.push({ img, x, y, r, life });
    if (this.melts.length > 16) this.melts.shift()!.img.destroy();
    if (audible) sfx('melt');
  }

  /** A frost circle: shows where the floor will freeze, then turns to ice after 1.2s. */
  addFreeze(x: number, y: number): void {
    const r = 46;
    const img = this.g.img('frost_ring', x, y, 3);
    const sc = (r * 2) / 64 / S;
    img.setScale(sc * 0.2);
    this.g.tweens.add({ targets: img, scale: sc, duration: 300, ease: 'Back.Out' });
    this.freezes.push({ img, x, y, r, t: 1.2 });
  }

  /** An icicle volley: a warning line from (x, y) at angle a for t seconds, then n icicles fly along it. */
  addWarn(x: number, y: number, a: number, t: number, n: number): void {
    this.warns.push({ x, y, a, t, n });
  }

  /** Is this point in a melt puddle? */
  inMelt(x: number, y: number): boolean {
    for (const m of this.melts) {
      const dx = (x - m.x) / m.r;
      const dy = (y - m.y) / (m.r * 0.66);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  /** Is this point slippery: a floor ice patch, frozen floor or a grease slick? */
  iceAt(x: number, y: number): boolean {
    return this.g.floor.onIce(x, y) || inPatch(this.tempIce, x, y);
  }

  private updateFreezer(dt: number): void {
    const g = this.g;
    if (!this.melts.length && !this.warns.length && !this.freezes.length && !this.tempIce.length) {
      if (this.bossGfx.visible) this.bossGfx.clear().setVisible(false);
      return;
    }
    const p = g.player;
    for (let i = this.melts.length - 1; i >= 0; i--) {
      const m = this.melts[i];
      m.life -= dt;
      if (m.life < 1) m.img.setAlpha(Math.max(0, m.life));
      if (m.life <= 0) {
        m.img.destroy();
        this.melts.splice(i, 1);
      }
    }
    for (let i = this.freezes.length - 1; i >= 0; i--) {
      const f = this.freezes[i];
      f.t -= dt;
      f.img.setAlpha(0.6 + 0.4 * Math.sin(g.now * 25));
      if (f.t > 0) continue;
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      if (dx * dx + dy * dy < (f.r + p.radius) ** 2) g.damagePlayer(10);
      const rx = f.r * 1.25;
      const ry = f.r * 0.9;
      const base = g.img('ice_patch', f.x, f.y, 1.5);
      base.setScale((rx * 2) / 200 / S, (ry * 2) / 120 / S);
      this.tempIce.push({ x: f.x, y: f.y, rx, ry, imgs: [base], life: 9 });
      g.effects.burst(f.x, f.y, 0xdff4ff, 10, 55);
      sfx('frost');
      f.img.destroy();
      this.freezes.splice(i, 1);
    }
    for (let i = this.tempIce.length - 1; i >= 0; i--) {
      const ip = this.tempIce[i];
      ip.life -= dt;
      if (ip.life < 1) for (const im of ip.imgs) im.setAlpha(Math.max(0, ip.life));
      if (ip.life <= 0) {
        for (const im of ip.imgs) im.destroy();
        this.tempIce.splice(i, 1);
      }
    }
    // Icicle volleys: a blue warning line flashes, then icicles fly along it.
    const gfx = this.bossGfx;
    gfx.clear().setVisible(this.warns.length > 0);
    for (let i = this.warns.length - 1; i >= 0; i--) {
      const w = this.warns[i];
      w.t -= dt;
      if (w.t > 0) {
        const len = 760;
        const ex = w.x + Math.cos(w.a) * len;
        const ey = w.y + Math.sin(w.a) * len;
        const blink = Math.floor(g.now * 12) % 2 ? 0.55 : 0.3;
        gfx.lineStyle(16, 0x6cc7f0, blink).lineBetween(w.x, w.y, ex, ey);
        gfx.lineStyle(3, 0xffffff, 0.9).lineBetween(w.x, w.y, ex, ey);
        continue;
      }
      sfx('icicle');
      for (let k = 0; k < w.n; k++) this.fireShot('icicle', w.x, w.y, w.a, 300 - k * 35, 14, 6, true);
      this.warns.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- Toaster Oven hazards

  /** An ember spark where an Ember Crumb died: it stings only if you walk right into it. */
  addSpark(x: number, y: number, life = 1.1, dmg = 3, size = 1, nudge = true): void {
    if (this.sparks.length >= 32) this.sparks.shift()!.img.destroy();
    // Drawn above seeds (and nudged off the spot where the seed lands) so it always reads as a red flame.
    if (nudge) {
      const a = Math.random() * Math.PI * 2;
      x += Math.cos(a) * 10;
      y += Math.sin(a) * 10;
    }
    const img = this.g.img('ember', x, y, 11);
    this.sparks.push({ img, x, y, life, max: life, dmg, size });
  }

  /** A Broiler flame line from (x, y) at angle a; it shows its warning glow for the last 1.2s of t. */
  addBeam(x: number, y: number, a: number, t: number): void {
    this.beams.push({ x, y, a, t, burn: 0 });
  }

  /** The Broiler's floor patterns, centred on you: a box around you, a cross through you, or stripes. Takes turns. */
  coilPattern(): void {
    const p = this.g.player;
    const kind = this.coilPatternN++ % 3;
    if (kind === 0) {
      // Box: stay inside it.
      const d = 150;
      this.addCoilAt(p.x, p.y - d, true);
      this.addCoilAt(p.x, p.y + d, true);
      this.addCoilAt(p.x - d, p.y, false);
      this.addCoilAt(p.x + d, p.y, false);
    } else if (kind === 1) {
      this.addCoilAt(p.x, p.y, true);
      this.addCoilAt(p.x, p.y, false);
    } else {
      const horiz = Math.random() < 0.5;
      for (const o of [-110, 0, 110]) this.addCoilAt(horiz ? p.x : p.x + o, horiz ? p.y + o : p.y, horiz);
    }
    sfx('hiss');
  }

  /** A coil strip at a set spot (the Broiler's patterns). Unlike random flare-ups, these can be right under you. */
  private addCoilAt(x: number, y: number, horiz: boolean, warn = 1.8): void {
    this.coils.push({ x, y, horiz, t: warn, flare: 0 });
  }

  private updateBeams(dt: number): void {
    const gfx = this.beamGfx;
    if (!this.beams.length) {
      if (gfx.visible) gfx.clear().setVisible(false);
      return;
    }
    gfx.clear().setVisible(true);
    const g = this.g;
    const p = g.player;
    const len = 720;
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const ex = b.x + Math.cos(b.a) * len;
      const ey = b.y + Math.sin(b.a) * len;
      if (b.t > 0) {
        b.t -= dt;
        if (b.t > 1.2) continue; // queued in the sweep, not shown yet
        // Warning: an orange glow along the line, blinking faster as it gets close.
        const k = 1 - Math.min(1, b.t / 0.9);
        const blink = Math.floor(g.now * (8 + k * 12)) % 2 ? 0.55 : 0.3;
        gfx.lineStyle(BEAM_W, 0xff7a1f, blink * (0.5 + 0.5 * k)).lineBetween(b.x, b.y, ex, ey);
        gfx.lineStyle(3, 0xffffff, 0.9).lineBetween(b.x, b.y, ex, ey);
        if (b.t <= 0) {
          b.burn = 0.45;
          sfx('flare');
          // Distance from you to the line.
          const vx = Math.cos(b.a);
          const vy = Math.sin(b.a);
          const rx = p.x - b.x;
          const ry = p.y - b.y;
          const along = rx * vx + ry * vy;
          const across = Math.abs(rx * vy - ry * vx);
          if (along > -20 && along < len && across < BEAM_W / 2 + p.radius * 0.6) {
            g.damagePlayer(BEAM_DMG);
            // Second Bake clears every flame line, this one included.
            if (this.beams[i] !== b) return;
          }
          for (let j = 1; j <= 6; j++) g.effects.burst(b.x + vx * j * 110, b.y + vy * j * 110, 0xffb03a, 3, 30);
        }
        continue;
      }
      b.burn -= dt;
      const a = Math.max(0, b.burn / 0.45);
      gfx.lineStyle(BEAM_W + 14, 0xff5a14, 0.55 * a).lineBetween(b.x, b.y, ex, ey);
      gfx.lineStyle(BEAM_W - 8, 0xffe08a, 0.95 * a).lineBetween(b.x, b.y, ex, ey);
      if (b.burn <= 0) this.beams.splice(i, 1);
    }
  }

  /** A coil flare-up: a strip near you (never under you) glows for 1.5s, then flares. */
  private addCoil(): void {
    const p = this.g.player;
    const horiz = Math.random() < 0.5;
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = side * (55 + Math.random() * 110);
    const along = (Math.random() - 0.5) * 160 + (horiz ? p.moveX : p.moveY) * 90;
    const x = horiz ? p.x + along : p.x + off;
    const y = horiz ? p.y + off : p.y + along;
    this.coils.push({ x, y, horiz, t: COIL_WARN, flare: 0 });
    sfx('hiss');
  }

  private inCoil(c: Coil, x: number, y: number, pad: number): boolean {
    const hw = (c.horiz ? COIL_LEN : COIL_W) / 2 + pad;
    const hh = (c.horiz ? COIL_W : COIL_LEN) / 2 + pad;
    return Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh;
  }

  /** A grease spot that wobbles and bubbles, then pops and leaves a slick. */
  private addGrease(): void {
    if (this.greases.length >= 4) return;
    const p = this.g.player;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    const a = moving && Math.random() < 0.6 ? Math.atan2(p.moveY, p.moveX) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 130;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const img = this.g.img('grease', x, y, 3);
    img.setScale(((GREASE_R * 2) / 48 / S) * 0.3);
    this.greases.push({ img, x, y, t: GREASE_WARN });
    sfx('bubble');
  }

  private updateOven(dt: number): void {
    const g = this.g;
    const st = g.stage;
    const p = g.player;
    const gfx = this.ovenGfx;
    if (st.coils || st.grease) {
      // More often as the run goes on; a little calmer while the boss is out.
      const k = Math.min(1, g.stageT / RUN.bossAt);
      const calm = g.foes.boss ? 1.4 : 1;
      if (st.coils && g.now >= this.coilNext) {
        this.coilNext = g.now + (8 - 3.5 * k) * calm;
        this.addCoil();
      }
      if (st.grease && g.now >= this.greaseNext) {
        this.greaseNext = g.now + (6 - 2 * k) * calm;
        this.addGrease();
        if (k > 0.5 && Math.random() < 0.5) this.addGrease();
      }
    }
    if (!this.coils.length && !this.greases.length && !this.sparks.length) {
      if (gfx.visible) gfx.clear().setVisible(false);
      return;
    }
    gfx.clear().setVisible(true);
    for (let i = this.coils.length - 1; i >= 0; i--) {
      const c = this.coils[i];
      const w = c.horiz ? COIL_LEN : COIL_W;
      const h = c.horiz ? COIL_W : COIL_LEN;
      const x0 = c.x - w / 2;
      const y0 = c.y - h / 2;
      if (c.t > 0) {
        c.t -= dt;
        // Warning: an orange glow that brightens and blinks faster as it gets close.
        const k = 1 - Math.max(0, c.t) / COIL_WARN;
        const blink = Math.floor(g.now * (6 + k * 14)) % 2 ? 1 : 0.7;
        gfx.fillStyle(0xff7a1f, (0.18 + 0.32 * k) * blink).fillRoundedRect(x0, y0, w, h, 10);
        gfx.lineStyle(3, 0xffffff, 0.85).strokeRoundedRect(x0, y0, w, h, 10);
        gfx.lineStyle(4, 0xffc04a, 0.5 + 0.5 * k);
        if (c.horiz) gfx.lineBetween(x0 + 8, c.y, x0 + w - 8, c.y);
        else gfx.lineBetween(c.x, y0 + 8, c.x, y0 + h - 8);
        if (c.t <= 0) {
          // Flare: burns you and every enemy on the strip.
          c.flare = 0.35;
          sfx('flare');
          if (this.inCoil(c, p.x, p.y, p.radius * 0.6)) g.damagePlayer(COIL_DMG);
          for (const e of g.foes.list)
            if (e.alive && this.inCoil(c, e.x, e.y, e.radius * 0.5)) g.hit(e, COIL_ENEMY_DMG, 0, 0, 'coil', 0.5);
          for (let j = 0; j < 5; j++) {
            const f = (j + 0.5) / 5 - 0.5;
            g.effects.burst(c.horiz ? c.x + f * w : c.x, c.horiz ? c.y : c.y + f * h, 0xffb03a, 4, 34);
          }
        }
        continue;
      }
      c.flare -= dt;
      const a = Math.max(0, c.flare / 0.35);
      gfx.fillStyle(0xff5a14, 0.55 * a).fillRoundedRect(x0 - 6, y0 - 6, w + 12, h + 12, 14);
      gfx.fillStyle(0xffe08a, 0.9 * a).fillRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 8);
      if (c.flare <= 0) this.coils.splice(i, 1);
    }
    for (let i = this.greases.length - 1; i >= 0; i--) {
      const gs = this.greases[i];
      gs.t -= dt;
      const base = (GREASE_R * 2) / 48 / S;
      const k = 1 - Math.max(0, gs.t) / GREASE_WARN;
      const wob = 1 + 0.12 * Math.sin(g.now * (14 + k * 16));
      gs.img.setScale(base * Math.min(1, 0.3 + k * 2) * wob, base * Math.min(1, 0.3 + k * 2) / wob);
      if (gs.t > 0) continue;
      sfx('grease');
      const dx = gs.x - p.x;
      const dy = gs.y - p.y;
      if (dx * dx + dy * dy < (GREASE_R + p.radius) ** 2) g.damagePlayer(GREASE_DMG);
      g.effects.burst(gs.x, gs.y, 0xffd27a, 8, 40);
      const rx = 52;
      const ry = 36;
      const slick = g.img('slick', gs.x, gs.y, 1.5);
      slick.setScale((rx * 2) / 120 / S, (ry * 2) / 80 / S);
      this.tempIce.push({ x: gs.x, y: gs.y, rx, ry, imgs: [slick], life: SLICK_LIFE });
      gs.img.destroy();
      this.greases.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.img.setScale(((0.8 + 0.25 * Math.sin(g.now * 40 + i)) * s.size) / S).setAlpha(Math.min(1, s.life * 2, (s.max - s.life) * 8 + 0.3));
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy < (6 * s.size + p.radius) ** 2) g.damagePlayer(s.dmg);
      if (s.life <= 0) {
        s.img.destroy();
        this.sparks.splice(i, 1);
      }
    }
  }
}

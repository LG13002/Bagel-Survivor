import Phaser from 'phaser';
import type { Enemy, Player, Stats } from './entities';
import { WEAPONS, type WeaponDef, type WeaponId } from './data';

/** What weapons need from the game scene. */
export interface World {
  player: Player;
  stats: Stats;
  now: number;
  nearest(x: number, y: number, maxR: number): Enemy | null;
  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void;
  hit(e: Enemy, dmg: number, kx: number, ky: number, key: string, cd: number): boolean;
  img(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image;
  tweens: Phaser.Tweens.TweenManager;
}

export abstract class Weapon {
  level = 1;
  evolved = false;
  protected t = 0.3;
  readonly def: WeaponDef;
  constructor(protected w: World, id: WeaponId) {
    this.def = WEAPONS[id];
  }
  abstract update(dt: number): void;
  destroy(): void {}
  /** Fires on a timer; returns true on the frames it should fire. */
  protected tick(dt: number, cd: number): boolean {
    this.t -= dt;
    if (this.t <= 0) {
      this.t += Math.max(0.05, cd);
      if (this.t < 0) this.t = cd;
      return true;
    }
    return false;
  }
  protected aim(range: number): { x: number; y: number } {
    const p = this.w.player;
    const e = this.w.nearest(p.x, p.y, range);
    if (e) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    return { x: p.faceX, y: p.faceY };
  }
}

interface Bullet {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  hit: Set<Enemy>;
}

class SesameShot extends Weapon {
  private bullets: Bullet[] = [];
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const cd = (this.evolved ? 0.1 : lv >= 5 ? 0.55 : 0.68) * s.cooldown;
    if (this.tick(dt, cd)) {
      const dir = this.aim(440);
      const base = Math.atan2(dir.y, dir.x);
      if (this.evolved) {
        this.fire(base + (Math.random() - 0.5) * 0.16, 9, 3, 'seed_fire');
      } else {
        const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
        const dmg = 12 * (lv >= 3 ? 1.5 : 1);
        for (let i = 0; i < count; i++) this.fire(base + (i - (count - 1) / 2) * 0.16, dmg, lv >= 5 ? 2 : 1, 'seed');
      }
    }
    const p = this.w.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.img.setPosition(b.x, b.y);
      this.w.query(b.x, b.y, 6 * s.area, (e) => {
        if (b.pierce <= 0 || b.hit.has(e)) return;
        b.hit.add(e);
        b.pierce--;
        const d = Math.hypot(b.vx, b.vy) || 1;
        this.w.hit(e, (b.img.getData('dmg') as number) * s.damage, (b.vx / d) * 60, (b.vy / d) * 60, '', 0);
      });
      if (b.pierce <= 0 || b.life <= 0 || Math.abs(b.x - p.x) > 900 || Math.abs(b.y - p.y) > 900) {
        b.img.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }
  private fire(angle: number, dmg: number, pierce: number, tex: string): void {
    const p = this.w.player;
    const speed = 480;
    const img = this.w.img(tex, p.x, p.y, 20);
    img.setRotation(angle).setData('dmg', dmg);
    img.setScale(img.scaleX * this.w.stats.area);
    this.bullets.push({ img, x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.4, pierce, hit: new Set() });
  }
  destroy(): void {
    this.bullets.forEach((b) => b.img.destroy());
    this.bullets = [];
  }
}

class SeedStorm extends Weapon {
  private orbs: Phaser.GameObjects.Image[] = [];
  private angle = 0;
  private layoutKey = '';
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const rings = this.evolved
      ? [
          { r: 55, n: 3, sp: 3.6 },
          { r: 95, n: 5, sp: -2.7 },
          { r: 135, n: 7, sp: 2.1 },
        ]
      : [{ r: 62 * (lv >= 5 ? 1.3 : 1), n: 2 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0), sp: 3.2 * (lv >= 5 ? 1.3 : 1) }];
    const total = rings.reduce((a, r) => a + r.n, 0);
    const key = `${total}-${this.evolved}`;
    if (key !== this.layoutKey) {
      this.destroy();
      this.layoutKey = key;
      for (let i = 0; i < total; i++) this.orbs.push(this.w.img(this.evolved ? 'seed_fire' : 'orb', 0, 0, 21));
    }
    this.angle += dt;
    const dmg = (this.evolved ? 16 : 8 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    const p = this.w.player;
    let k = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const a = this.angle * ring.sp + (i / ring.n) * Math.PI * 2;
        const r = ring.r * s.area;
        const x = p.x + Math.cos(a) * r;
        const y = p.y + Math.sin(a) * r;
        const o = this.orbs[k++];
        o.setPosition(x, y).setRotation(a + Math.PI / 2);
        this.w.query(x, y, 9 * s.area, (e) => {
          this.w.hit(e, dmg, Math.cos(a) * 90, Math.sin(a) * 90, 'storm', 0.45);
        });
      }
    }
  }
  destroy(): void {
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    this.layoutKey = '';
  }
}

interface Puddle {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  life: number;
}

class CreamPuddle extends Weapon {
  private puddles: Puddle[] = [];
  private aura: Puddle | null = null;
  private tickT = 0;
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const p = this.w.player;
    const r = (this.evolved ? 50 : 42 * (lv >= 3 ? 1.35 : 1)) * s.area;
    const dmg = (this.evolved ? 12 : 7 * (lv >= 5 ? 1.6 : 1)) * s.damage;
    if (this.tick(dt, (this.evolved ? 2.0 : 2.6) * s.cooldown)) {
      const count = this.evolved ? 3 : 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const target = this.randomTarget();
        const life = this.evolved ? 3.5 : 3 * (lv >= 5 ? 1.5 : 1);
        const img = this.w.img('puddle', target.x, target.y, 2);
        const scale = (r * 2) / 128;
        img.setScale(0).setAlpha(0.9);
        this.w.tweens.add({ targets: img, scale: img.getData('base') * scale, duration: 180, ease: 'Back.Out' });
        this.puddles.push({ img, x: target.x, y: target.y, r, life });
      }
    }
    if (this.evolved) {
      const ar = 115 * s.area;
      if (!this.aura) {
        const img = this.w.img('puddle', p.x, p.y, 1);
        img.setAlpha(0.55);
        this.aura = { img, x: p.x, y: p.y, r: ar, life: Infinity };
      }
      this.aura.x = p.x;
      this.aura.y = p.y;
      this.aura.r = ar;
      this.aura.img.setPosition(p.x, p.y).setScale(((ar * 2) / 128) * this.aura.img.getData('base'));
    }
    this.tickT -= dt;
    const doTick = this.tickT <= 0;
    if (doTick) this.tickT = 0.5;
    const all = this.aura ? [...this.puddles, this.aura] : this.puddles;
    for (let i = all.length - 1; i >= 0; i--) {
      const pd = all[i];
      pd.life -= dt;
      this.w.query(pd.x, pd.y, pd.r, (e) => {
        e.slowUntil = this.w.now + 0.3;
        if (doTick) this.w.hit(e, dmg, 0, 0, '', 0);
      });
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const pd = this.puddles[i];
      if (pd.life <= 0) {
        const img = pd.img;
        this.w.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
        this.puddles.splice(i, 1);
      }
    }
  }
  private randomTarget(): { x: number; y: number } {
    const p = this.w.player;
    const cands: Enemy[] = [];
    this.w.query(p.x, p.y, 230, (e) => {
      if (cands.length < 30) cands.push(e);
    });
    if (cands.length) {
      const e = cands[Math.floor(Math.random() * cands.length)];
      return { x: e.x, y: e.y };
    }
    const a = Math.random() * Math.PI * 2;
    return { x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60 };
  }
  destroy(): void {
    this.puddles.forEach((p) => p.img.destroy());
    this.puddles = [];
    this.aura?.img.destroy();
    this.aura = null;
  }
}

interface Rang {
  img: Phaser.GameObjects.Image;
  dx: number;
  dy: number;
  t: number;
  phase: number;
  id: string;
}

class LoxBoomerang extends Weapon {
  private rangs: Rang[] = [];
  private seq = 0;
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const p = this.w.player;
    const range = (this.evolved ? 150 : 200 * (lv >= 5 ? 1.3 : 1)) * s.area;
    const size = (lv >= 5 || this.evolved ? 1.4 : 1) * s.area;
    const dmg = (this.evolved ? 20 : 16 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    const T = 1.1;
    if (this.evolved) {
      if (this.rangs.length !== 4) {
        this.destroy();
        for (let i = 0; i < 4; i++) {
          const img = this.w.img('lox', p.x, p.y, 21);
          img.setScale(img.scaleX * size);
          this.rangs.push({ img, dx: 0, dy: 0, t: 0, phase: (i / 4) * Math.PI * 2, id: `lox${i}` });
        }
      }
    } else if (this.tick(dt, 1.9 * s.cooldown)) {
      const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
      const dir = this.aim(320);
      const base = Math.atan2(dir.y, dir.x);
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.7;
        const img = this.w.img('lox', p.x, p.y, 21);
        img.setScale(img.scaleX * size);
        this.rangs.push({ img, dx: Math.cos(a), dy: Math.sin(a), t: 0, phase: 0, id: `lox${this.seq++}` });
      }
    }
    for (let i = this.rangs.length - 1; i >= 0; i--) {
      const r = this.rangs[i];
      r.t += dt;
      let x: number;
      let y: number;
      if (this.evolved) {
        const a = this.w.now * 2.4 + r.phase;
        const d = range * (0.75 + 0.5 * Math.sin(this.w.now * 1.7 + r.phase));
        x = p.x + Math.cos(a) * d;
        y = p.y + Math.sin(a) * d;
      } else {
        const d = range * Math.sin((Math.PI * r.t) / T);
        x = p.x + r.dx * d;
        y = p.y + r.dy * d;
      }
      r.img.setPosition(x, y).setRotation(r.t * 14);
      this.w.query(x, y, 12 * size, (e) => {
        const kd = Math.hypot(e.x - x, e.y - y) || 1;
        this.w.hit(e, dmg, ((e.x - x) / kd) * 120, ((e.y - y) / kd) * 120, r.id, 0.35);
      });
      if (!this.evolved && r.t >= T) {
        r.img.destroy();
        this.rangs.splice(i, 1);
      }
    }
  }
  destroy(): void {
    this.rangs.forEach((r) => r.img.destroy());
    this.rangs = [];
  }
}

class CoffeeSplash extends Weapon {
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const cd = (this.evolved ? 1.1 : 1.5 * (lv >= 5 ? 0.75 : 1)) * s.cooldown;
    if (!this.tick(dt, cd)) return;
    const p = this.w.player;
    const range = (this.evolved ? 140 : 105 * (lv >= 5 ? 1.3 : 1)) * s.area;
    const half = this.evolved ? 0.42 : lv >= 3 ? 0.65 : 0.45;
    const dmg = (this.evolved ? 22 : 14 * (lv >= 2 ? 1.4 : 1)) * s.damage;
    const base = Math.atan2(p.faceY, p.faceX);
    const dirs: number[] = [];
    if (this.evolved) for (let i = 0; i < 8; i++) dirs.push(base + (i / 8) * Math.PI * 2);
    else {
      dirs.push(base);
      if (lv >= 4) dirs.push(base + Math.PI);
    }
    this.w.query(p.x, p.y, range, (e) => {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      for (const d of dirs) {
        if (Math.abs(Phaser.Math.Angle.Wrap(a - d)) <= half) {
          this.w.hit(e, dmg, Math.cos(a) * 220, Math.sin(a) * 220, '', 0);
          break;
        }
      }
    });
    // Visual: droplets fanning out
    for (const d of dirs) {
      const n = this.evolved ? 6 : 12;
      for (let i = 0; i < n; i++) {
        const a = d + (Math.random() * 2 - 1) * half;
        const dist = range * (0.55 + Math.random() * 0.45);
        const img = this.w.img('splash', p.x, p.y, 22);
        const sc = img.scaleX * (0.8 + Math.random() * 1.2);
        img.setScale(sc);
        this.w.tweens.add({
          targets: img,
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          alpha: 0,
          duration: 260 + Math.random() * 120,
          ease: 'Cubic.Out',
          onComplete: () => img.destroy(),
        });
      }
    }
  }
}

interface RollingPin {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  hit: Set<Enemy>;
  size: number;
}

class RollingPinW extends Weapon {
  private pins: RollingPin[] = [];
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const p = this.w.player;
    const size = (lv >= 5 || this.evolved ? 1.5 : 1) * s.area;
    const dmg = (this.evolved ? 40 : 28 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    if (this.tick(dt, (this.evolved ? 3.2 : 3) * s.cooldown)) {
      const base = Math.atan2(p.faceY, p.faceX);
      const angles: number[] = [];
      if (this.evolved) for (let i = 0; i < 13; i++) angles.push(base + (i / 13) * Math.PI * 2);
      else {
        const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
        for (let i = 0; i < count; i++) angles.push(base + (i - (count - 1) / 2) * 0.45);
      }
      for (const a of angles) {
        const img = this.w.img('pin', p.x, p.y, 19);
        img.setScale(img.scaleX * size).setRotation(a + Math.PI / 2);
        this.pins.push({ img, x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a), life: 2.4, hit: new Set(), size });
      }
    }
    for (let i = this.pins.length - 1; i >= 0; i--) {
      const pin = this.pins[i];
      pin.x += pin.dx * 270 * dt;
      pin.y += pin.dy * 270 * dt;
      pin.life -= dt;
      pin.img.setPosition(pin.x, pin.y);
      // Wobble the pin a little to sell the roll.
      pin.img.setScale(pin.img.getData('base') * pin.size, pin.img.getData('base') * pin.size * (0.85 + 0.15 * Math.sin(pin.life * 30)));
      this.w.query(pin.x, pin.y, 30 * pin.size, (e) => {
        if (pin.hit.has(e)) return;
        const rx = e.x - pin.x;
        const ry = e.y - pin.y;
        const along = Math.abs(rx * pin.dx + ry * pin.dy);
        const lateral = Math.abs(-rx * pin.dy + ry * pin.dx);
        if (along < 8 * pin.size + e.radius && lateral < 28 * pin.size + e.radius) {
          pin.hit.add(e);
          this.w.hit(e, dmg, pin.dx * 380, pin.dy * 380, '', 0);
        }
      });
      if (pin.life <= 0) {
        pin.img.destroy();
        this.pins.splice(i, 1);
      }
    }
  }
  destroy(): void {
    this.pins.forEach((p) => p.img.destroy());
    this.pins = [];
  }
}

export function createWeapon(w: World, id: WeaponId): Weapon {
  switch (id) {
    case 'sesame':
      return new SesameShot(w, id);
    case 'storm':
      return new SeedStorm(w, id);
    case 'puddle':
      return new CreamPuddle(w, id);
    case 'lox':
      return new LoxBoomerang(w, id);
    case 'coffee':
      return new CoffeeSplash(w, id);
    case 'pin':
      return new RollingPinW(w, id);
  }
}

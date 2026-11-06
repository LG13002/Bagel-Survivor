import Phaser from 'phaser';
import type { Enemy, Player, Stats } from './entities';
import { WEAPONS, type WeaponDef, type WeaponId } from './data';
import type { Sfx } from './sfx';

/** What weapons need from the game scene. */
export interface World {
  player: Player;
  stats: Stats;
  now: number;
  nearest(x: number, y: number, maxR: number): Enemy | null;
  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void;
  hit(e: Enemy, dmg: number, kx: number, ky: number, key: string, cd: number, fx?: FxId): boolean;
  /** A small fading dot behind a projectile (level 5 and evolved looks). */
  trailDot(x: number, y: number, color: number): void;
  img(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image;
  tweens: Phaser.Tweens.TweenManager;
  shake(ms: number, intensity: number): void;
  playSfx(name: Sfx): void;
}

/** Hit sound and spark id: a weapon, or the secret Lox and Schmear combo. */
export type FxId = WeaponId | 'combo';

/** The secret combo evolution: Schmear Flood + Lox Cyclone merge into one weapon (it lives on the Lox weapon). */
export const COMBO = { name: 'Lox and Schmear', icon: 'ic_loxschmear', blurb: 'A spinning storm of lox and cream cheese that pulls enemies in.' };

const GOLD_TINT = 0xffe7a0;
/** Evolved projectiles change color (the fire seeds already have their own texture). */
const EVO_TINT: Partial<Record<WeaponId, number>> = { lox: 0xffc2a8, pin: 0xffd28a, knife: 0xbfe0ff, jar: 0xe0c8ff, toastpop: 0xfff0b0 };
const EVO_TRAIL: Record<WeaponId, number> = {
  sesame: 0xff8a3a,
  storm: 0xff7a2a,
  puddle: 0xfff6dc,
  lox: 0xff9a7a,
  coffee: 0xc8601e,
  pin: 0xf6d38c,
  knife: 0xf0f4f8, // silver, not blue: blue dots read as XP seeds
  jar: 0xb07ae0,
  toastpop: 0xffd27a,
  iron: 0xffd27a,
};

export abstract class Weapon {
  level = 1;
  evolved = false;
  /** Merged into Lox and Schmear (only ever set on the Lox weapon). */
  combo = false;
  protected t = 0.3;
  readonly def: WeaponDef;
  constructor(protected w: World, id: WeaponId) {
    this.def = WEAPONS[id];
  }
  abstract update(dt: number): void;
  destroy(): void {}
  /** Hits an enemy with this weapon's own spark and hit sound. */
  protected strike(e: Enemy, dmg: number, kx: number, ky: number, key = '', cd = 0): boolean {
    return this.w.hit(e, dmg, kx, ky, key, cd, this.combo ? 'combo' : this.def.id);
  }
  /** Icon for the HUD and pause screen (the combo has its own). */
  get icon(): string {
    return this.combo ? COMBO.icon : this.def.icon;
  }
  /** 0 = normal, 1 = level 5 (gold), 2 = evolved (new color and a trail). */
  protected get look(): number {
    return this.evolved ? 2 : this.level >= 5 ? 1 : 0;
  }
  /** Tints a projectile for its look: gold at level 5, the evolution's color when evolved. */
  protected style(img: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    const look = this.look;
    if (look === 1) img.setTint(GOLD_TINT);
    else if (look === 2 && EVO_TINT[this.def.id]) img.setTint(EVO_TINT[this.def.id]!);
    return img;
  }
  /** Leaves a light trail behind a moving projectile at level 5 and when evolved. */
  protected trail(x: number, y: number, rate = 0.3): void {
    const look = this.look;
    if (!look || Math.random() > rate) return;
    this.w.trailDot(x, y, look === 1 ? 0xffd34d : EVO_TRAIL[this.def.id]);
  }
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
      this.w.playSfx('shoot');
      const dir = this.aim(440);
      const base = Math.atan2(dir.y, dir.x);
      if (this.evolved) {
        const n = 1 + s.proj;
        const jitter = (Math.random() - 0.5) * 0.16;
        for (let i = 0; i < n; i++) this.fire(base + jitter + (i - (n - 1) / 2) * 0.12, 13, 3, 'seed_fire');
      } else {
        const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0) + s.proj;
        const dmg = 13.2 * (lv >= 3 ? 1.5 : 1);
        for (let i = 0; i < count; i++) this.fire(base + (i - (count - 1) / 2) * 0.16, dmg, lv >= 5 ? 3 : 2, 'seed');
      }
    }
    const p = this.w.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.img.setPosition(b.x, b.y);
      this.trail(b.x, b.y, 0.25);
      this.w.query(b.x, b.y, 6 * s.area, (e) => {
        if (b.pierce <= 0 || b.hit.has(e)) return;
        b.hit.add(e);
        b.pierce--;
        const d = Math.hypot(b.vx, b.vy) || 1;
        this.strike(e, (b.img.getData('dmg') as number) * s.damage, (b.vx / d) * 60, (b.vy / d) * 60, '', 0);
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
    const img = this.style(this.w.img(tex, p.x, p.y, 20));
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
      : [{ r: 62 * (lv >= 5 ? 1.3 : 1), n: 3 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0), sp: 3.2 * (lv >= 5 ? 1.3 : 1) }];
    const total = rings.reduce((a, r) => a + r.n, 0);
    const key = `${total}-${this.evolved}-${this.look}`;
    if (key !== this.layoutKey) {
      this.destroy();
      this.layoutKey = key;
      for (let i = 0; i < total; i++) this.orbs.push(this.style(this.w.img(this.evolved ? 'seed_fire' : 'orb', 0, 0, 21)));
    }
    this.angle += dt;
    this.w.playSfx('storm'); // throttled to an occasional shimmer
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
        this.trail(x, y, 0.08);
        this.w.query(x, y, 9 * s.area, (e) => {
          this.strike(e, dmg, Math.cos(a) * 90, Math.sin(a) * 90, 'storm', 0.45);
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
        const life = (this.evolved ? 3.5 : 3 * (lv >= 5 ? 1.5 : 1)) * s.dur;
        const img = this.w.img('puddle', target.x, target.y, 2);
        if (this.look === 1) img.setTint(0xfff0c0);
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
        if (doTick) this.strike(e, dmg, 0, 0, '', 0);
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
  /** Lox and Schmear: the schmear storm around you. */
  private storm: Phaser.GameObjects.Image | null = null;
  private stormTick = 0;
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const p = this.w.player;
    const range = (this.combo ? 150 : this.evolved ? 150 : 200 * (lv >= 5 ? 1.3 : 1)) * s.area;
    const size = (this.combo ? 1.6 : lv >= 5 || this.evolved ? 1.4 : 1) * s.area;
    const dmg = (this.combo ? 20 : this.evolved ? 20 : 16 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    const T = 1.1 * s.dur;
    if (this.combo) this.updateStorm(dt);
    if (this.evolved) {
      const n = (this.combo ? 6 : 4) + s.proj;
      if (this.rangs.length !== n) {
        this.rangs.forEach((rg) => rg.img.destroy());
        this.rangs = [];
        for (let i = 0; i < n; i++) {
          const img = this.style(this.w.img('lox', p.x, p.y, 21));
          img.setScale(img.scaleX * size);
          this.rangs.push({ img, dx: 0, dy: 0, t: 0, phase: (i / n) * Math.PI * 2, id: `lox${i}` });
        }
      }
    } else if (this.tick(dt, 1.9 * s.cooldown)) {
      const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0) + s.proj;
      this.w.playSfx('lox');
      const dir = this.aim(320);
      const base = Math.atan2(dir.y, dir.x);
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.7;
        const img = this.style(this.w.img('lox', p.x, p.y, 21));
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
        const a = this.w.now * (this.combo ? 3 : 2.4) + r.phase;
        const d = range * (0.75 + 0.5 * Math.sin(this.w.now * 1.7 + r.phase));
        x = p.x + Math.cos(a) * d;
        y = p.y + Math.sin(a) * d;
      } else {
        const d = range * Math.sin((Math.PI * r.t) / T);
        x = p.x + r.dx * d;
        y = p.y + r.dy * d;
      }
      r.img.setPosition(x, y).setRotation(r.t * 14);
      this.trail(x, y, 0.35);
      this.w.query(x, y, 12 * size, (e) => {
        const kd = Math.hypot(e.x - x, e.y - y) || 1;
        this.strike(e, dmg, ((e.x - x) / kd) * 120, ((e.y - y) / kd) * 120, r.id, 0.35);
      });
      if (!this.evolved && r.t >= T) {
        r.img.destroy();
        this.rangs.splice(i, 1);
      }
    }
  }
  /** The schmear storm: a swirling cream-cheese ring that slows, hurts and pulls enemies in toward the circling lox. */
  private updateStorm(dt: number): void {
    const s = this.w.stats;
    const p = this.w.player;
    const r = 180 * s.area;
    if (!this.storm) {
      this.storm = this.w.img('loxstorm', p.x, p.y, 1).setAlpha(0.5);
    }
    this.storm.setPosition(p.x, p.y).setScale(((r * 2) / 128) * this.storm.getData('base')).setRotation(this.w.now * 1.6);
    this.stormTick -= dt;
    const doTick = this.stormTick <= 0;
    if (doTick) this.stormTick = 0.35;
    const dmg = 18 * s.damage;
    this.w.query(p.x, p.y, r, (e) => {
      e.slowUntil = this.w.now + 0.3;
      // Pull toward the ring of lox (not onto you), never bosses or heavy elites.
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!e.boss && e.mass < 5 && d > r * 0.55) {
        e.kx -= ((dx / d) * 780 * dt) / e.mass;
        e.ky -= ((dy / d) * 780 * dt) / e.mass;
      }
      if (doTick) this.strike(e, dmg, 0, 0, '', 0);
    });
  }
  destroy(): void {
    this.rangs.forEach((r) => r.img.destroy());
    this.rangs = [];
    this.storm?.destroy();
    this.storm = null;
  }
}

class CoffeeSplash extends Weapon {
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const cd = (this.evolved ? 1.1 : 1.5 * (lv >= 5 ? 0.75 : 1)) * s.cooldown;
    if (!this.tick(dt, cd)) return;
    const p = this.w.player;
    const range = (this.evolved ? 190 : 150 * (lv >= 5 ? 1.3 : 1)) * s.area;
    const half = this.evolved ? 0.42 : lv >= 3 ? 0.65 : 0.45;
    const dmg = (this.evolved ? 22 : 14 * (lv >= 2 ? 1.4 : 1)) * s.damage;
    // Aim at the nearest enemy in reach (falls back to the direction of travel).
    const aim = this.aim(range * 1.2);
    const base = Math.atan2(aim.y, aim.x);
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
          this.strike(e, dmg, Math.cos(a) * 220, Math.sin(a) * 220, '', 0);
          break;
        }
      }
    });
    this.w.playSfx('splash');
    // Visual: droplets fanning out
    for (const d of dirs) {
      const n = this.evolved ? 6 : 12;
      for (let i = 0; i < n; i++) {
        const a = d + (Math.random() * 2 - 1) * half;
        const dist = range * (0.55 + Math.random() * 0.45);
        const img = this.w.img('splash', p.x, p.y, 22);
        if (this.look === 1) img.setTint(GOLD_TINT);
        else if (this.look === 2) img.setTint(0xff9a4a);
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
    const dmg = (this.evolved ? 34 : 26 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    if (this.tick(dt, (this.evolved ? 3.8 : 3) * s.cooldown)) {
      // Roll toward the nearest enemy (falls back to the direction of travel).
      const aim = this.aim(420);
      const base = Math.atan2(aim.y, aim.x);
      const angles: number[] = [];
      if (this.evolved) for (let i = 0, n = 13 + s.proj; i < n; i++) angles.push(base + (i / n) * Math.PI * 2);
      else {
        const count = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0) + s.proj;
        for (let i = 0; i < count; i++) angles.push(base + (i - (count - 1) / 2) * 0.45);
      }
      this.w.shake(60, 0.0015);
      this.w.playSfx('pin');
      for (const a of angles) {
        const img = this.style(this.w.img('pin', p.x, p.y, 19));
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
      this.trail(pin.x, pin.y, 0.35);
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
          this.strike(e, dmg, pin.dx * 250, pin.dy * 250, '', 0);
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


/** Up to n different enemies within r of the player, then random spots near it. */
function pickTargets(w: World, n: number, r: number): { x: number; y: number }[] {
  const p = w.player;
  const cands: Enemy[] = [];
  w.query(p.x, p.y, r, (e) => {
    if (cands.length < 60) cands.push(e);
  });
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (i < cands.length) out.push({ x: cands[i].x, y: cands[i].y });
    else {
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * r * 0.5;
      out.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
    }
  }
  return out;
}

/** Something thrown in an arc that lands after T seconds. */
interface Lob {
  img: Phaser.GameObjects.Image;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  T: number;
  h: number;
  spin: number;
  land: (x: number, y: number) => void;
}

function updateLobs(lobs: Lob[], dt: number, trail?: (x: number, y: number) => void): void {
  for (let i = lobs.length - 1; i >= 0; i--) {
    const l = lobs[i];
    l.t += dt;
    const k = Math.min(1, l.t / l.T);
    const x = l.x0 + (l.x1 - l.x0) * k;
    const y = l.y0 + (l.y1 - l.y0) * k - Math.sin(Math.PI * k) * l.h;
    l.img.setPosition(x, y).setRotation(l.img.rotation + l.spin * dt);
    if (trail && l.t > 0) trail(x, y);
    if (k >= 1) {
      l.img.destroy();
      lobs.splice(i, 1);
      l.land(l.x1, l.y1);
    }
  }
}

class ButterKnife extends Weapon {
  private knives: Bullet[] = [];
  private fanT = 1;
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const fast = lv >= 5 || this.evolved;
    const dmg = this.evolved ? 22 : 14 * (lv >= 3 ? 1.5 : 1);
    if (this.tick(dt, (this.evolved ? 1.1 : lv >= 5 ? 1.15 : 1.4) * s.cooldown)) {
      const dir = this.aim(460);
      const base = Math.atan2(dir.y, dir.x);
      const n = (this.evolved ? 3 : 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0)) + s.proj;
      for (let i = 0; i < n; i++) this.throw(base + (i - (n - 1) / 2) * 0.1, dmg, fast);
      this.w.playSfx('knife');
    }
    if (this.evolved) {
      // Cutlery Drawer: fans of knives in four directions, on top of the normal throws.
      this.fanT -= dt;
      if (this.fanT <= 0) {
        this.fanT += 2.2 * s.cooldown;
        const p = this.w.player;
        const base = Math.atan2(p.faceY, p.faceX);
        const n = 5 + s.proj;
        for (let d = 0; d < 4; d++) for (let i = 0; i < n; i++) this.throw(base + (d * Math.PI) / 2 + (i - (n - 1) / 2) * 0.16, dmg, true);
        this.w.playSfx('clatter');
      }
    }
    const p = this.w.player;
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const b = this.knives[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.img.setPosition(b.x, b.y);
      this.trail(b.x, b.y, 0.3);
      this.w.query(b.x, b.y, 10 * s.area, (e) => {
        if (b.hit.has(e)) return;
        b.hit.add(e);
        const d = Math.hypot(b.vx, b.vy) || 1;
        this.strike(e, (b.img.getData('dmg') as number) * s.damage, (b.vx / d) * 50, (b.vy / d) * 50, '', 0);
      });
      if (b.life <= 0 || Math.abs(b.x - p.x) > 900 || Math.abs(b.y - p.y) > 900) {
        b.img.destroy();
        this.knives.splice(i, 1);
      }
    }
  }
  private throw(angle: number, dmg: number, fast: boolean): void {
    const p = this.w.player;
    const speed = fast ? 640 : 520;
    const img = this.style(this.w.img('knife_w', p.x, p.y, 20));
    img.setRotation(angle).setData('dmg', dmg);
    img.setScale(img.scaleX * this.w.stats.area * (fast ? 1.2 : 1));
    this.knives.push({ img, x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: fast ? 1.15 : 0.9, pierce: 999, hit: new Set() });
  }
  destroy(): void {
    this.knives.forEach((b) => b.img.destroy());
    this.knives = [];
  }
}

interface Pool {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  life: number;
}

class JamJar extends Weapon {
  private lobs: Lob[] = [];
  private pools: Pool[] = [];
  private tickT = 0;
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const ev = this.evolved;
    if (this.tick(dt, (ev ? 3 : 2.5) * s.cooldown)) {
      const n = (ev ? 2 : 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0)) + s.proj;
      const p = this.w.player;
      for (const tg of pickTargets(this.w, n, 260)) {
        const img = this.style(this.w.img('jar', p.x, p.y, 22));
        img.setScale(img.scaleX * 1.2);
        this.lobs.push({ img, x0: p.x, y0: p.y, x1: tg.x, y1: tg.y, t: 0, T: 0.55, h: 70, spin: 9, land: (x, y) => this.land(x, y) });
      }
    }
    updateLobs(this.lobs, dt, (x, y) => this.trail(x, y, 0.4));
    this.tickT -= dt;
    const doTick = this.tickT <= 0;
    if (doTick) this.tickT = 0.5;
    const dmg = (ev ? 10 : 6 * (lv >= 5 ? 1.5 : 1)) * s.damage;
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pl = this.pools[i];
      pl.life -= dt;
      this.w.query(pl.x, pl.y, pl.r, (e) => {
        e.slowUntil = this.w.now + 0.3;
        if (ev && !e.boss) {
          // Jam Session: the pool pulls enemies toward its middle.
          const dx = pl.x - e.x;
          const dy = pl.y - e.y;
          const d = Math.hypot(dx, dy);
          if (d > 6) {
            const step = Math.min(d - 6, (70 / e.mass) * dt);
            e.x += (dx / d) * step;
            e.y += (dy / d) * step;
          }
        }
        if (doTick) this.strike(e, dmg, 0, 0, '', 0);
      });
      if (pl.life <= 0) {
        const img = pl.img;
        this.w.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
        this.pools.splice(i, 1);
      }
    }
  }
  private land(x: number, y: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const ev = this.evolved;
    const splashR = (ev ? 60 : 40) * s.area;
    const dmg = (ev ? 30 : 18 * (lv >= 5 ? 1.5 : 1)) * s.damage;
    this.w.query(x, y, splashR, (e) => {
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      this.strike(e, dmg, ((e.x - x) / d) * 80, ((e.y - y) / d) * 80, '', 0);
    });
    this.w.playSfx('jar');
    const r = (ev ? 100 : 46 * (lv >= 3 ? 1.3 : 1)) * s.area;
    const life = (ev ? 4.5 : 3 * (lv >= 5 ? 1.4 : 1)) * s.dur;
    const img = this.w.img('jam_pool', x, y, 2);
    img.setScale(0).setAlpha(0.92);
    this.w.tweens.add({ targets: img, scale: img.getData('base') * ((r * 2) / 128), duration: 180, ease: 'Back.Out' });
    this.pools.push({ img, x, y, r, life });
  }
  destroy(): void {
    this.lobs.forEach((l) => l.img.destroy());
    this.pools.forEach((p) => p.img.destroy());
    this.lobs = [];
    this.pools = [];
  }
}

class ToasterPop extends Weapon {
  private lobs: Lob[] = [];
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const ev = this.evolved;
    const p = this.w.player;
    if (this.tick(dt, (ev ? 2.5 : lv >= 5 ? 1.6 : 2) * s.cooldown)) {
      this.w.playSfx('toastpop');
      if (ev) {
        // Toast Barrage: toast rains down all over the screen.
        for (const tg of pickTargets(this.w, 12 + s.proj, 420)) {
          const img = this.style(this.w.img('ptoast', tg.x, tg.y - 320, 22));
          img.setScale(img.scaleX * 1.4);
          this.lobs.push({ img, x0: tg.x + (Math.random() - 0.5) * 60, y0: tg.y - 320, x1: tg.x, y1: tg.y, t: -Math.random() * 0.4, T: 0.45, h: 0, spin: 6, land: (x, y) => this.land(x, y) });
        }
      } else {
        const n = 2 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0) + s.proj;
        for (const tg of pickTargets(this.w, n, 240)) {
          const img = this.style(this.w.img('ptoast', p.x, p.y, 22));
          img.setScale(img.scaleX * 1.4);
          this.lobs.push({ img, x0: p.x, y0: p.y, x1: tg.x, y1: tg.y, t: 0, T: 0.5, h: 90, spin: 8, land: (x, y) => this.land(x, y) });
        }
      }
    }
    // A toast that hasn't started falling yet waits off to the side.
    for (const l of this.lobs) if (l.t < 0) l.img.setVisible(false);
    updateLobs(this.lobs, dt, (x, y) => this.trail(x, y, 0.3));
    for (const l of this.lobs) if (l.t >= 0) l.img.setVisible(true);
  }
  private land(x: number, y: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const ev = this.evolved;
    const r = (ev ? 42 : 34 * (lv >= 5 ? 1.3 : 1)) * s.area;
    const dmg = (ev ? 30 : 24 * (lv >= 3 ? 1.5 : 1)) * s.damage;
    this.w.query(x, y, r, (e) => {
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      this.strike(e, dmg, ((e.x - x) / d) * 120, ((e.y - y) / d) * 120, '', 0);
    });
    // Crumbs fly out where it lands.
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const img = this.w.img('dot', x, y, 21);
      img.setTint(0xe9b56a).setScale(img.scaleX * 0.6);
      this.w.tweens.add({ targets: img, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, duration: 260, onComplete: () => img.destroy() });
    }
  }
  destroy(): void {
    this.lobs.forEach((l) => l.img.destroy());
    this.lobs = [];
  }
}

interface Shock {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  t: number;
  hit: Set<Enemy>;
}

class WaffleSmash extends Weapon {
  private shocks: Shock[] = [];
  update(dt: number): void {
    const s = this.w.stats;
    const lv = this.level;
    const ev = this.evolved;
    const p = this.w.player;
    if (this.tick(dt, (ev ? 3.2 : lv >= 5 ? 2.4 : 3) * s.cooldown)) {
      const r = (ev ? 140 : 70 * (lv >= 3 ? 1.25 : 1)) * s.area;
      const dmg = (ev ? 110 : 46 * (lv >= 2 ? 1.4 : 1)) * s.damage;
      this.stamp(p.x, p.y, r, dmg);
      if (lv >= 4 && !ev) {
        const e = this.w.nearest(p.x, p.y, 260);
        if (e && Math.hypot(e.x - p.x, e.y - p.y) > r * 0.8) this.stamp(e.x, e.y, r * 0.7, dmg);
      }
      if (ev) {
        const img = this.w.img('shock', p.x, p.y, 3);
        this.shocks.push({ img, x: p.x, y: p.y, t: 0, hit: new Set() });
      }
      this.w.playSfx('stamp');
      this.w.shake(ev ? 140 : 70, ev ? 0.004 : 0.002);
    }
    // Belgian Slam: a ring rolls outward from the stamp.
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const sh = this.shocks[i];
      sh.t += dt;
      const k = Math.min(1, sh.t / 0.5);
      const r = (140 + 150 * k) * s.area;
      sh.img.setScale(sh.img.getData('base') * ((r * 2) / 128)).setAlpha(1 - k * 0.8);
      this.w.query(sh.x, sh.y, r, (e) => {
        if (sh.hit.has(e)) return;
        const dx = e.x - sh.x;
        const dy = e.y - sh.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < r - 24) return;
        sh.hit.add(e);
        this.strike(e, 40 * s.damage, (dx / d) * 260, (dy / d) * 260, '', 0);
      });
      if (k >= 1) {
        sh.img.destroy();
        this.shocks.splice(i, 1);
      }
    }
  }
  private stamp(x: number, y: number, r: number, dmg: number): void {
    const daze = this.level >= 5 || this.evolved;
    this.w.query(x, y, r, (e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.strike(e, dmg, (dx / d) * 300, (dy / d) * 300, '', 0);
      if (daze) e.slowUntil = Math.max(e.slowUntil, this.w.now + 0.8);
    });
    const img = this.w.img('stamp', x, y, 3);
    if (this.look === 1) img.setTint(0xffe28a);
    const sc = img.getData('base') * ((r * 2) / 128);
    img.setScale(sc * 1.25).setAlpha(0.95);
    this.w.tweens.add({ targets: img, scale: sc, duration: 90, ease: 'Quad.In' });
    this.w.tweens.add({ targets: img, alpha: 0, delay: 200, duration: 260, onComplete: () => img.destroy() });
  }
  destroy(): void {
    this.shocks.forEach((s) => s.img.destroy());
    this.shocks = [];
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
    case 'knife':
      return new ButterKnife(w, id);
    case 'jar':
      return new JamJar(w, id);
    case 'toastpop':
      return new ToasterPop(w, id);
    case 'iron':
      return new WaffleSmash(w, id);
  }
}

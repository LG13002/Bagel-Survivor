import { CSS, S } from '../config';
import { flash, reducedFlash, shake } from '../settings';
import { ENEMIES, RUN, type EnemyKind } from '../data';
import { Enemy } from '../entities';
import { load, persist } from '../save';
import { sfx, type Sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';
import { behave, type Move } from './behaviors';
import type { DeathStyle } from './effects';
import { CRISPY_HP, ENDLESS_BOSS_EVERY, ENDLESS_ELITE_EVERY, ENDLESS_MINI_EVERY, SLOWMO_TIME } from './modes';

/** Spatial grid cell size for hit checks and crowd separation. */
const CELL = 48;
/** Jalapeño Cheddar's Spicy: chance per hit, burn time, and burn damage per tick as a share of the hit. */
const SPICY_CHANCE = 0.1;
const BURN_TIME = 3;
const BURN_TICK = 0.5;
const BURN_SHARE = 0.3;
const KILL_SFX: Record<EnemyKind, Sfx> = {
  crumb: 'crunch', ant: 'crunch', mold: 'splat', moldling: 'splat', knife: 'clatter', elite: 'pop', croissant: 'pop', toaster: 'pop',
  fcrumb: 'crunch', sprinkle: 'crunch', icecube: 'shatter', popsicle: 'shatter', pophalf: 'crunch', peapod: 'splat', fmold: 'splat', fmoldling: 'splat',
  scoop: 'pop', fcroissant: 'pop', tyrantjr: 'pop', waffle: 'pop', wafflesq: 'crunch', fburn: 'pop',
  ember: 'crunch', btoast: 'crunch', hotsauce: 'splat', popcorn: 'popcorn', popbit: 'crunch', tot: 'clatter', wafflebit: 'crunch', mscoop: 'splat',
  muffin: 'pop', fburnt: 'shatter', flapjack: 'pop', broiler: 'pop',
  dustbunny: 'pop', peacan: 'clatter', pepper: 'shatter', sugarcube: 'shatter', crystal: 'crunch', pmuffin: 'crunch', spore: 'splat',
  loaf: 'pop', broilerjr: 'pop', tangle: 'pop', mdough: 'pop', doughball: 'splat',
};

/** How an enemy comes apart: a pop (soft things, elites), a crumble (dry and hard things) or a splat (wet things). */
const DEATH: Partial<Record<Sfx, DeathStyle>> = { crunch: 'crumble', clatter: 'crumble', shatter: 'crumble', splat: 'splat' };
/** Big enemies that rear up just before a timed attack (the attack's own timing is untouched). */
const WINDUP = new Set<EnemyKind>(['croissant', 'toaster', 'fcroissant', 'tyrantjr', 'fburn', 'fburnt', 'flapjack', 'broiler', 'loaf', 'broilerjr', 'tangle', 'mdough']);
const WIND = 0.4;
/** A boss's drop onto the field. */
export const DROP_TIME = 0.7;
const ROAR_TIME = 0.8;

/**
 * Every enemy in the run: spawning, the per-step update (movement, crowding, contact damage), burning, deaths and
 * drops, and the spatial grid that weapons use to find targets. Each enemy's own moves are in `behaviors.ts`.
 * Made fresh for every run.
 */
export class Enemies {
  /** Enemies on the field (dead ones are pooled at the end of each step). */
  list: Enemy[] = [];
  /** Big enemies (elites and bosses): kept out of the grid and checked one by one. */
  bigs: Enemy[] = [];
  boss: Enemy | null = null;
  mini: Enemy | null = null;
  private pool: Enemy[] = [];
  private grid = new Map<number, Enemy>();
  /** Reused for each enemy's step so the update makes no garbage. */
  private move: Move = { dx: 0, dy: 0, dist: 1, mvx: 0, mvy: 0, slow: 1 };
  private steerOut = { x: 0, y: 0 };

  constructor(private g: GameScene) {}

  /** Health multiplier for regular enemies at stage time t. */
  hpMult(t: number): number {
    return this.g.stage.hpBonus * (1 + t / this.g.stage.hpGrowth);
  }

  /**
   * A point just off-screen. While the player is moving, most spawns land in the direction
   * of travel (within ±75°), so running away never leaves an empty lane ahead.
   */
  spawnPoint(aheadBias = 0.7, off = 40): { x: number; y: number } {
    const g = this.g;
    const p = g.player;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    let a: number;
    if (moving && Math.random() < aheadBias) a = Math.atan2(p.moveY, p.moveX) + (Math.random() * 2 - 1) * 1.3;
    else a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const edge = Math.min(g.viewW() / 2 / Math.max(Math.abs(dx), 1e-3), g.viewH() / 2 / Math.max(Math.abs(dy), 1e-3));
    const d = edge + off;
    return { x: p.x + dx * d, y: p.y + dy * d };
  }

  /** Spawn just off-screen (see `spawnPoint`). */
  spawnNear(kind: EnemyKind, hpMult = 1): Enemy | null {
    const sp = this.spawnPoint();
    return this.spawn(kind, sp.x, sp.y, hpMult);
  }

  /** A boss's entrance: it drops from above onto a spot just inside the screen edge, and lands with a ring of dust. */
  dropIn(kind: EnemyKind): Enemy | null {
    const sp = this.spawnPoint(0.7, -(ENEMIES[kind].radius + 6));
    const e = this.spawn(kind, sp.x, sp.y, 1);
    if (e) {
      e.dropT = DROP_TIME;
      e.sprite.setVisible(false);
    }
    return e;
  }

  /** A ring of n enemies all around the screen edge, closing in; kinds take turns. */
  ringOf(kinds: EnemyKind | EnemyKind[], n: number): void {
    const p = this.g.player;
    const list = typeof kinds === 'string' ? [kinds] : kinds;
    const hp = this.hpMult(this.g.stageT);
    const d = Math.hypot(this.g.viewW(), this.g.viewH()) / 2 + 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn(list[i % list.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, hp);
    }
  }

  spawn(kind: EnemyKind, x: number, y: number, hpMult: number): Enemy | null {
    const g = this.g;
    const def = ENEMIES[kind];
    // The Cookbook's Enemies tab: the first sighting reveals it.
    const save = load();
    if (!save.met?.includes(kind)) {
      save.met = [...(save.met ?? []), kind];
      persist();
    }
    const special = !!def.flat;
    if (!special && this.list.length >= RUN.maxEnemies + 40) return null;
    const e = this.pool.pop() ?? new Enemy();
    if (!e.sprite) e.sprite = g.img(def.tex, x, y, 30);
    e.phase = Math.random() * Math.PI * 2;
    e.sprite.setTexture(def.tex).setVisible(true).setAlpha(1).setRotation(0).setFlipX(false);
    e.sprite.clearTint();
    const isBig = def.radius > 20;
    e.sprite.setScale(1 / S).setDepth(isBig ? 35 : 30);
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.maxHp = e.hp = def.hp * (def.flat ? 1 : hpMult) * (g.crispy ? CRISPY_HP : 1);
    e.speed = def.speed * (0.9 + Math.random() * 0.2);
    e.dmg = def.dmg * g.stage.dmg;
    e.radius = def.radius;
    e.xp = def.xp;
    e.mass = def.mass;
    e.kx = e.ky = e.vx = e.vy = 0;
    e.slowUntil = e.flashUntil = 0;
    e.alive = true;
    e.boss = false;
    e.enraged = false;
    e.dropsChest = false;
    e.dropsBun = false;
    e.state = 0;
    e.stateT = 0;
    e.attackT = 1.5;
    e.attack2T = 0;
    e.burnUntil = 0;
    e.burnShown = false;
    e.flashOn = false;
    e.big = isBig;
    e.faint = false;
    e.sq = e.dropT = e.roarT = 0;
    e.prevAtk = e.attackT;
    e.hitCd.clear();
    this.list.push(e);
    if (isBig) this.bigs.push(e);
    return e;
  }

  // ---------------------------------------------------------------- Finding enemies

  nearest(x: number, y: number, maxR: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Call cb for every live enemy touching the circle. */
  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    const reach = r + 20;
    const x0 = Math.floor((x - reach) / CELL);
    const x1 = Math.floor((x + reach) / CELL);
    const y0 = Math.floor((y - reach) / CELL);
    const y1 = Math.floor((y + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        let e = this.grid.get(cellKey(cx, cy)) ?? null;
        while (e) {
          if (e.alive) {
            const rr = r + e.radius;
            const dx = e.x - x;
            const dy = e.y - y;
            if (dx * dx + dy * dy < rr * rr) cb(e);
          }
          e = e.gridNext;
        }
      }
    }
    for (const e of this.bigs) {
      if (!e.alive) continue;
      const rr = r + e.radius;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < rr * rr) cb(e);
    }
  }

  rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.list) {
      if (!e.alive || e.radius > 20) continue;
      const key = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      e.gridNext = this.grid.get(key) ?? null;
      this.grid.set(key, e);
    }
  }

  // ---------------------------------------------------------------- Each step

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    const t = g.now;
    const m = this.move;
    const decay = Math.exp(-8 * dt);
    const farX = g.viewW() / 2 + 170;
    const farY = g.viewH() / 2 + 170;
    const floor = g.floor;
    const solid = floor.posts.length > 0 || floor.walls.length > 0;
    const shelves = !!g.stage.shelves;
    const steer = this.steerOut;
    const clouds = g.hz.clouds;
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const slow = e.slowUntil > t ? 0.5 : 1;
      m.dx = dx;
      m.dy = dy;
      m.dist = dist;
      m.slow = slow;
      m.mvx = (dx / dist) * e.speed * slow;
      m.mvy = (dy / dist) * e.speed * slow;
      // The Pantry: walk around shelves instead of into them. The biggest (mini-bosses and bosses) climb over.
      const def = ENEMIES[e.kind];
      const walled = solid && !e.boss && def.radius < 30 && def.ai !== 'line';
      if (shelves && walled && floor.steer(e.x, e.y, e.radius, steer)) {
        m.mvx = steer.x * e.speed * slow;
        m.mvy = steer.y * e.speed * slow;
      }

      if (ENEMIES[e.kind].drip) {
        // Melting Scoop: small melt puddles behind it as it walks.
        e.attack2T -= dt;
        if (e.attack2T <= 0) {
          e.attack2T = 1.4;
          g.hz.addMelt(e.x, e.y + e.radius * 0.5, false, 15, 3.5);
        }
      }
      if (e.burnUntil > 0) {
        this.updateBurn(e, dt);
        if (!e.alive) continue;
      }
      behave(g, e, m, dt);
      // A boss in the middle of its drop stays where it will land.
      if (e.dropT > 0) m.mvx = m.mvy = e.kx = e.ky = 0;

      e.x += (m.mvx + e.kx) * dt;
      e.y += (m.mvy + e.ky) * dt;
      e.kx *= decay;
      e.ky *= decay;

      // Soft separation so swarms read as a crowd, not a single blob.
      if (e.radius <= 20) {
        let o = this.grid.get(cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL))) ?? null;
        let n = 0;
        while (o && n < 6) {
          if (o !== e && o.alive) {
            const sx = e.x - o.x;
            const sy = e.y - o.y;
            const rr = e.radius + o.radius;
            const d2 = sx * sx + sy * sy;
            if (d2 < rr * rr && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const push = ((rr - d) / d) * 0.5;
              e.x += sx * push;
              e.y += sy * push;
            }
            n++;
          }
          o = o.gridNext;
        }
      }

      if (walled && (!shelves || floor.nearWall(e.x, e.y))) {
        const bx = e.x;
        const by = e.y;
        floor.pushOut(e, e.radius);
        // A Rolling Pea Can bounces off what it hits in the middle of its charge.
        if (def.bounce && e.state === 2 && (e.x !== bx || e.y !== by)) {
          const nx = e.x - bx;
          const ny = e.y - by;
          const nl = Math.hypot(nx, ny) || 1;
          const dot = (e.vx * nx + e.vy * ny) / nl;
          if (dot < 0) {
            e.vx -= (2 * dot * nx) / nl;
            e.vy -= (2 * dot * ny) / nl;
            sfx('clang');
          }
        }
      }

      // Recycle stragglers to the front (keeps pressure on without huge counts).
      if (!e.boss && !ENEMIES[e.kind].flat) {
        const rx = e.x - p.x;
        const ry = e.y - p.y;
        if (Math.abs(rx) > farX || Math.abs(ry) > farY) {
          if (ENEMIES[e.kind].ai === 'line') {
            this.remove(e);
            continue;
          }
          // Put it back in front of the player so it re-joins the fight instead of trailing behind.
          const sp = this.spawnPoint(0.95);
          e.x = sp.x;
          e.y = sp.y;
          e.kx = e.ky = 0;
        }
      }

      // Contact damage
      const cx = e.x - p.x;
      const cy = e.y - p.y;
      const rr = e.radius + p.radius - 3;
      if (cx * cx + cy * cy < rr * rr && e.dropT <= 0) {
        if (g.bagel.quirkId === 'tank' && !e.boss) {
          const dl = Math.hypot(cx, cy) || 1;
          g.hit(e, 15 * g.stats.damage, (cx / dl) * 260, (cy / dl) * 260, 'tank', 0.4);
        }
        if (e.alive) g.damagePlayer(e.dmg);
      }

      e.sprite.setPosition(e.x, e.y);
      // Flour clouds: small enemies inside one fade to faint shapes.
      if (clouds.length || e.faint) {
        const faint = !e.big && g.hz.inCloud(e.x, e.y);
        if (faint !== e.faint) {
          e.faint = faint;
          e.sprite.setAlpha(faint ? 0.3 : 1);
        }
      }
      const flashing = e.flashUntil > t;
      if (flashing !== e.flashOn) {
        e.flashOn = flashing;
        // The white hit flash becomes a soft pink tint when Flashing effects is Reduced.
        if (flashing) reducedFlash() ? e.sprite.setTint(0xffb8b0) : e.sprite.setTintFill(0xffffff);
        else e.sprite.clearTint();
        // A hit squashes it: small enemies for as long as the flash, big ones with a springy wobble (in `pose`).
        if (e.big) {
          if (flashing) e.sq = 0.16;
        } else e.sprite.setScale(flashing ? SQ_X : BASE, flashing ? SQ_Y : BASE);
      }
      if (e.big) this.pose(e, dt);
      if (g.paused === 'over') return;
    }
  }

  /** A big enemy's pose for this frame: breathing, hit wobble, wind-up, roar and the drop onto the field. */
  private pose(e: Enemy, dt: number): void {
    const g = this.g;
    const t = g.now;
    const br = 0.02 * Math.sin(t * 3 + e.phase);
    let sx = 1 + br;
    let sy = 1 - br;
    let oy = 0;
    if (e.sq > 0) {
      e.sq -= dt;
      const k = Math.max(0, e.sq) / 0.16;
      sx += 0.1 * k;
      sy -= 0.1 * k;
    }
    if (WINDUP.has(e.kind)) {
      // Rear up before a timed attack, and flatten out as it goes off.
      if (e.attackT > 0 && e.attackT < WIND) {
        const k = 1 - e.attackT / WIND;
        sx -= 0.07 * k;
        sy += 0.12 * k;
      }
      if (e.attackT > e.prevAtk + 0.5) e.sq = 0.22;
      e.prevAtk = e.attackT;
    } else if (e.kind === 'waffle') {
      // The Frozen Waffle crouches before a charge and stretches out during it.
      if (e.state === 1) {
        const k = 1 - Math.max(0, e.stateT) / 0.8;
        sx += 0.1 * k;
        sy -= 0.13 * k;
      } else if (e.state === 2) {
        sx -= 0.06;
        sy += 0.09;
      }
    }
    if (e.roarT > 0) {
      e.roarT -= dt;
      const k = Math.sin(Math.PI * Math.min(1, 1 - e.roarT / ROAR_TIME));
      sx += 0.24 * k;
      sy += 0.24 * k;
      oy -= 6 * k;
    }
    if (e.dropT > 0) {
      e.dropT -= dt;
      const k = Math.max(0, e.dropT) / DROP_TIME;
      oy -= k * k * (g.viewH() * 0.9);
      sx *= 1 - 0.14 * k;
      sy *= 1 + 0.22 * k;
      e.sprite.setVisible(true);
      if (e.dropT <= 0) {
        e.sq = 0.3;
        g.effects.dust(e.x, e.y + e.radius * 0.7, e.radius);
        sfx('thud');
        shake(g, 220, 0.008);
      }
    }
    e.sprite.setPosition(e.x, e.y + oy).setScale(BASE * sx, BASE * sy);
  }

  /** Move dead enemies to the pool. */
  compact(): void {
    let j = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive) this.list[j++] = e;
      else this.pool.push(e);
    }
    this.list.length = j;
    if (this.bigs.some((e) => !e.alive)) this.bigs = this.bigs.filter((e) => e.alive);
  }

  /** Is a mini-boss or boss of this stage on the field? */
  bossOut(): boolean {
    const st = this.g.stage;
    return this.bigs.some((e) => e.alive && (e.kind === st.mini.kind || e.kind === st.boss.kind));
  }

  // ---------------------------------------------------------------- Burning (Jalapeño Cheddar)

  /** Spicy: set an enemy on fire. A new flame refreshes the timer and keeps the bigger burn. */
  ignite(e: Enemy, dmg: number): void {
    const now = this.g.now;
    const burning = e.burnUntil > now;
    if (!burning) {
      e.burnT = BURN_TICK;
      e.burnDmg = 0;
      sfx('ignite');
    }
    e.burnUntil = now + BURN_TIME;
    e.burnDmg = Math.max(e.burnDmg, 3, dmg * BURN_SHARE);
  }

  /** Roll for Spicy's burn on a hit. */
  maybeIgnite(e: Enemy, dmg: number): void {
    if (Math.random() < SPICY_CHANCE) this.ignite(e, dmg);
  }

  /** Burning enemies tick damage and show a flickering flame and a hot orange tint. */
  private updateBurn(e: Enemy, dt: number): void {
    const g = this.g;
    const now = g.now;
    const burning = e.burnUntil > now;
    if (burning) {
      e.burnT -= dt;
      if (!e.flame) e.flame = g.img('flame', e.x, e.y, 36);
      const f = e.flame;
      const flick = 1 + 0.18 * Math.sin(now * 31 + e.phase) + 0.1 * Math.sin(now * 53);
      const sc = Math.max(0.8, e.radius / 10) / S;
      f.setVisible(true).setPosition(e.x + e.radius * 0.35, e.y - e.radius * 0.55).setScale(sc * 0.9, sc * flick);
      if (g.effects.particles < 100 && Math.random() < 0.08) g.effects.burst(e.x, e.y - e.radius * 0.5, 0xff8a2a, 1, 14);
      if (e.burnT <= 0) {
        e.burnT += BURN_TICK;
        g.hit(e, e.burnDmg, 0, 0, 'burn', 0);
      }
    } else if (e.flame?.visible) e.flame.setVisible(false);
    if (burning !== e.burnShown) {
      e.burnShown = burning;
      if (!burning) e.sprite.clearTint();
    }
    if (burning && e.alive && e.flashUntil <= now) e.sprite.setTint(0xffa070);
  }

  // ---------------------------------------------------------------- Deaths

  private remove(e: Enemy): void {
    e.alive = false;
    e.sprite.setVisible(false);
    e.flame?.setVisible(false);
  }

  kill(e: Enemy): void {
    const g = this.g;
    const run = g.run;
    const loot = g.loot;
    this.remove(e);
    run.kills++;
    if (g.bagel.quirkId === 'raisin' && ++run.raisinKills >= 20) {
      run.raisinKills = 0;
      g.player.hp = Math.min(g.stats.maxHp, g.player.hp + 1);
    }
    sfx(KILL_SFX[e.kind]);
    const big = e.radius > 20;
    const def = ENEMIES[e.kind];
    const color = def.burst ?? 0xb57a3c;
    const style: DeathStyle = big ? 'pop' : DEATH[KILL_SFX[e.kind]] ?? 'pop';
    g.effects.death(e, style, color);
    g.effects.burst(e.x, e.y, color, big ? 18 : style === 'pop' ? 6 : 3, big ? 60 : 30);
    if (def.split) {
      const n = def.split.n;
      for (let i = 0; i < n; i++) {
        // Two halves fly left and right; more spread evenly around.
        const a = n === 2 ? (i ? 0 : Math.PI) : (i / n) * Math.PI * 2 + Math.PI / 4;
        const ox = n === 2 ? (i ? 1 : -1) : Math.cos(a);
        const oy = n === 2 ? 0 : Math.sin(a);
        const m = this.spawn(def.split.kind, e.x + ox * 6, e.y + oy * 6, this.hpMult(g.stageT));
        if (m) {
          m.kx = ox * 120;
          m.ky = oy * 120;
        }
      }
    }
    if (def.ember) g.hz.addSpark(e.x, e.y);
    if (e.kind === 'muffin') {
      // The Molten Muffin bursts into a ring of embers.
      sfx('flare');
      g.hz.ring('fireball', e.x, e.y, 8, 120, 8, 7);
    }
    if (e.xp > 0) loot.dropXp(e.x, e.y, e.xp);
    // Bread basket normally; the Croissant always drops a gold toaster, elites 1 in 4.
    if (e.dropsChest) loot.drop(e.kind === g.stage.mini.kind || Math.random() < 0.25 + 0.05 * g.luckNow ? 'goldchest' : 'chest', e.x, e.y, 1);
    if (e.dropsBun) {
      // Land on the far side of the boss so it isn't grabbed by accident at the kill.
      const ba = Math.atan2(e.y - g.player.y, e.x - g.player.x);
      loot.drop('bun', e.x + Math.cos(ba) * (e.radius + 30), e.y + Math.sin(ba) * (e.radius + 30), 1);
      g.hud.banner('A Sticky Bun dropped!', '#f0a24a', 18);
    }
    // Freezer: every elite drops a Warm Mug, regular enemies now and then (one on the floor at a time).
    if (g.stage.mug) {
      if (e.dropsChest && e !== this.mini && !e.boss) loot.drop('mug', e.x - 14, e.y, 1);
      else if (!e.dropsChest && Math.random() < 0.006 && !loot.has('mug')) loot.drop('mug', e.x, e.y - 6, 1);
    }
    const r = Math.random();
    if (r < 0.01) loot.drop('coin', e.x + 6, e.y, 1);
    else if (r < 0.015) loot.drop('heal', e.x, e.y + 6, 30);
    if (e === this.mini) {
      this.mini = null;
      run.miniKilled = true;
      shake(g, 250, 0.006);
    }
    if (e === this.boss) this.bossDown(e);
  }

  /** The stage boss fell: the run is won, or (Endless) it carries on, harder. */
  private bossDown(e: Enemy): void {
    const g = this.g;
    const dir = g.director;
    this.boss = null;
    if (g.run.bossClean) g.run.noHitBoss = true;
    shake(g, 600, 0.012);
    flash(g, 300, 255, 240, 200);
    g.effects.bossBurst(e);
    // Half a second of slow motion to take it in.
    g.run.slowT = SLOWMO_TIME;
    if (!g.endless) {
      // The win follows the slow motion (see `GameScene.update`). Nothing can hurt the bagel in between.
      g.run.pendingWin = true;
      g.hz.clearShots();
      g.hz.clearBeams();
      return;
    }
    // Endless: the stage counts as cleared, and the run carries on, harder.
    dir.bossRound++;
    g.hz.clearBeams();
    // A gold toaster, on the far side so it isn't grabbed by accident at the kill.
    const ga = Math.atan2(e.y - g.player.y, e.x - g.player.x);
    g.loot.drop('goldchest', e.x + Math.cos(ga) * (e.radius + 30), e.y + Math.sin(ga) * (e.radius + 30), 1);
    sfx('evolve');
    const t = g.stageT;
    dir.nextBoss = t + ENDLESS_BOSS_EVERY;
    if (!dir.endlessCleared) {
      dir.endlessCleared = true;
      dir.nextElite = t + ENDLESS_ELITE_EVERY;
      dir.nextMini = t + ENDLESS_MINI_EVERY;
      dir.nextWave = t + RUN.waveEvery;
      g.hud.banner('Endless! How long can you last?', CSS.gold, 26);
    } else g.hud.banner(`${g.stage.boss.name} beaten again!`, CSS.gold, 24);
  }
}

const BASE = 1 / S;
const SQ_X = BASE * 1.2;
const SQ_Y = BASE * 0.82;

function cellKey(cx: number, cy: number): number {
  return ((cx & 0xffff) << 16) | (cy & 0xffff);
}

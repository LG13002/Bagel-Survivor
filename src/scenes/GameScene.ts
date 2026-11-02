import Phaser from 'phaser';
import { COLORS, CSS, DEBUG, S, fmtTime, safeInsets } from '../config';
import {
  BAGELS,
  ENEMIES,
  MAX_LEVEL,
  MAX_SLOTS,
  RUN,
  TOPPINGS,
  WEAPONS,
  xpNeeded,
  type BagelDef,
  type EnemyKind,
  type ToppingId,
  type WeaponId,
} from '../data';
import { Enemy, Player, type EnemyShot, type Hazard, type Pickup, type Stats } from '../entities';
import { load, persist } from '../save';
import { makeTextures } from '../textures';
import { button, panel, txt } from '../ui';
import { createWeapon, type Weapon, type World } from '../weapons';
import { setSound, sfx, soundOn, unlockAudio } from '../sfx';
import { checkUnlocks } from '../progress';
import { clearRun, loadRun, saveRun, type RunSnapshot } from '../runsave';

type PauseReason = '' | 'levelup' | 'pause' | 'chest' | 'over';

interface Choice {
  kind: 'wnew' | 'wup' | 'tnew' | 'tup' | 'heal' | 'coin';
  id?: string;
}

export interface RunResult {
  victory: boolean;
  practice: boolean;
  time: number;
  level: number;
  kills: number;
  dough: number;
  bagel: string;
  newUnlock: string;
  evolutions: string[];
}

const CELL = 48;
/** Practice runs start at 2:30 with a head start of level-ups. */
const PRACTICE_START = 150;
const PRACTICE_LEVELS = 12;

export class GameScene extends Phaser.Scene implements World {
  player = new Player();
  stats: Stats = { damage: 1, area: 1, cooldown: 1, speed: 140, magnet: 55, maxHp: 100 };
  now = 0;

  private bagel!: BagelDef;
  private enemies: Enemy[] = [];
  private bigs: Enemy[] = [];
  private pool: Enemy[] = [];
  private grid = new Map<number, Enemy>();
  private pickups: Pickup[] = [];
  private shots: EnemyShot[] = [];
  private hazards: Hazard[] = [];
  private weapons: Weapon[] = [];
  private toppings = new Map<ToppingId, number>();
  private particles = 0;

  private level = 1;
  private xp = 0;
  private xpNext = xpNeeded(1);
  private pendingLevels = 0;
  private kills = 0;
  private coins = 0;
  private rerolls = 1;
  private paused: PauseReason = '';
  private evolutionsThisRun: string[] = [];
  private miniKilled = false;

  // Director
  private spawnT = 0;
  private nextWave = RUN.miniBossAt;
  private nextAnts = RUN.antsFrom;
  private nextElite: number = RUN.eliteAt;
  private miniSpawned = false;
  private bossSpawned = false;
  private boss: Enemy | null = null;
  private mini: Enemy | null = null;

  // Layers / cameras
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private floor!: Phaser.GameObjects.TileSprite;
  private hpBg!: Phaser.GameObjects.Rectangle;
  private hpFill!: Phaser.GameObjects.Rectangle;

  // HUD
  private hud!: {
    xpBg: Phaser.GameObjects.Rectangle;
    xpFill: Phaser.GameObjects.Rectangle;
    level: Phaser.GameObjects.Text;
    timer: Phaser.GameObjects.Text;
    kills: Phaser.GameObjects.Text;
    pause: Phaser.GameObjects.Container;
    bossName: Phaser.GameObjects.Text;
    bossBg: Phaser.GameObjects.Rectangle;
    bossFill: Phaser.GameObjects.Rectangle;
  };
  private overlay: Phaser.GameObjects.Container | null = null;
  private lastTimerSec = -1;
  private hitstop = 0;
  private lastHitstop = 0;
  private banners = 0;

  // Joystick
  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private joyGfx!: Phaser.GameObjects.Graphics;
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor() {
    super('game');
  }

  private practice = false;
  private resume: RunSnapshot | null = null;
  private healsTaken = 0;
  private raisinKills = 0;
  private mines: { img: Phaser.GameObjects.Image; x: number; y: number; life: number }[] = [];
  private mineT = 0;
  private auraImg: Phaser.GameObjects.Image | null = null;
  private auraT = 0;
  private snapT = 0;

  init(data: { bagel?: string; practice?: boolean; resume?: boolean }): void {
    this.resume = data.resume ? loadRun() : null;
    if (this.resume) {
      data = { bagel: this.resume.bagel, practice: this.resume.practice };
    }
    this.bagel = BAGELS.find((b) => b.id === data.bagel) ?? BAGELS[0];
    this.practice = !!data.practice;
    this.healsTaken = 0;
    this.raisinKills = 0;
    this.mines = [];
    this.mineT = 0;
    this.auraImg = null;
    this.auraT = 0;
    this.snapT = 0;
    this.player = new Player();
    this.now = this.practice ? PRACTICE_START : DEBUG.start;
    this.enemies = [];
    this.bigs = [];
    this.pool = [];
    this.grid.clear();
    this.pickups = [];
    this.shots = [];
    this.hazards = [];
    this.weapons = [];
    this.toppings = new Map();
    this.particles = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpNeeded(1);
    this.pendingLevels = 0;
    this.kills = 0;
    this.coins = 0;
    this.rerolls = 1;
    this.paused = '';
    this.evolutionsThisRun = [];
    this.miniKilled = false;
    this.spawnT = 0.5;
    this.nextWave = Math.max(RUN.miniBossAt, this.now + 20);
    this.nextAnts = Math.max(RUN.antsFrom, this.now + 10);
    this.nextElite = Math.max(RUN.eliteAt, Math.ceil(this.now / RUN.eliteEvery) * RUN.eliteEvery);
    this.miniSpawned = this.now > RUN.miniBossAt;
    this.bossSpawned = false;
    this.boss = null;
    this.mini = null;
    this.overlay = null;
    this.lastTimerSec = -1;
    this.hitstop = 0;
    this.lastHitstop = 0;
    this.banners = 0;
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
    this.lastFrame = 0;
  }

  create(): void {
    makeTextures(this);
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();
    this.uiLayer.setDepth(1000);
    const cam = this.cameras.main;
    cam.setZoom(S);
    cam.setBackgroundColor(COLORS.bg);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    cam.ignore(this.uiLayer);
    this.uiCam.ignore(this.worldLayer);

    this.floor = this.add.tileSprite(0, 0, 10, 10, 'floor');
    this.floor.setTileScale(1 / S).setDepth(0);
    this.worldLayer.add(this.floor);

    this.player.sprite = this.img(this.bagel.tex, 0, 0, 50);
    this.hpBg = this.add.rectangle(0, 0, 30, 4, 0x1d140d).setDepth(51);
    this.hpFill = this.add.rectangle(0, 0, 30, 4, COLORS.red).setDepth(52).setOrigin(0, 0.5);
    this.worldLayer.add([this.hpBg, this.hpFill]);

    this.joyGfx = this.add.graphics().setDepth(900);
    this.uiLayer.add(this.joyGfx);
    this.arrowGfx = this.add.graphics().setDepth(800);
    this.uiLayer.add(this.arrowGfx);

    this.buildHud();
    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
    this.addWeapon(this.bagel.weapon);
    if (this.resume) this.applySnapshot(this.resume);
    else if (this.practice) {
      this.pendingLevels = PRACTICE_LEVELS;
      this.level = 1 + PRACTICE_LEVELS;
      this.xpNext = xpNeeded(this.level);
    }
    this.onResize();

    this.setupInput();
    this.scale.on('resize', this.onResize, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.weapons.forEach((w) => w.destroy());
    });
    this.cameras.main.fadeIn(250, 43, 33, 24);
  }

  // ---------------------------------------------------------------- World API

  img(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, tex).setScale(1 / S).setDepth(depth);
    im.setData('base', 1 / S);
    this.worldLayer.add(im);
    return im;
  }

  shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  playSfx(name: 'pin' | 'splash'): void {
    sfx(name);
  }

  private ui<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiLayer.add(obj);
    return obj;
  }

  nearest(x: number, y: number, maxR: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (const e of this.enemies) {
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

  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    const reach = r + 20;
    const x0 = Math.floor((x - reach) / CELL);
    const x1 = Math.floor((x + reach) / CELL);
    const y0 = Math.floor((y - reach) / CELL);
    const y1 = Math.floor((y + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        let e = this.grid.get(this.cellKey(cx, cy)) ?? null;
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

  hit(e: Enemy, dmg: number, kx: number, ky: number, key: string, cd: number): boolean {
    if (!e.alive) return false;
    if (key && cd > 0) {
      const last = e.hitCd.get(key);
      if (last !== undefined && this.now - last < cd) return false;
      e.hitCd.set(key, this.now);
    }
    e.hp -= dmg;
    e.kx += (kx * 1.5) / e.mass;
    e.ky += (ky * 1.5) / e.mass;
    e.flashUntil = this.now + 0.08;
    sfx('hit');
    if (dmg >= 30 && this.now - this.lastHitstop > 0.3) {
      this.lastHitstop = this.now;
      this.hitstop = 0.045;
    }
    if (e.hp <= 0) this.killEnemy(e);
    return true;
  }

  private cellKey(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  // ---------------------------------------------------------------- Stats & build

  private recomputeStats(): void {
    const up = load().upgrades;
    const b = this.bagel;
    const t = (id: ToppingId) => this.toppings.get(id) ?? 0;
    const prevMax = this.stats.maxHp;
    this.stats = {
      damage: 1.3 * (1 + b.allStats + 0.06 * (up.dmg ?? 0) + 0.1 * t('oven')),
      area: 1 + b.allStats + 0.1 * t('butter'),
      cooldown: 1 / (1 + 0.08 * t('caffeine')),
      speed: b.speed * (1 + b.allStats * 0.5 + 0.04 * (up.speed ?? 0) + 0.07 * t('glaze')),
      magnet: 55 * (1 + 0.15 * (up.magnet ?? 0) + 0.25 * t('salt')),
      maxHp: Math.round((b.hp + 10 * (up.hp ?? 0)) * (1 + b.allStats) * (1 + 0.15 * t('dough'))),
    };
    if (this.stats.maxHp > prevMax && this.player.hp > 0) this.player.hp += this.stats.maxHp - prevMax;
    this.player.maxHp = this.stats.maxHp;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  private addWeapon(id: WeaponId): void {
    this.weapons.push(createWeapon(this, id));
  }

  private weaponOf(id: string): Weapon | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }

  private choices(): Choice[] {
    const pool: { c: Choice; w: number }[] = [];
    for (const w of this.weapons) if (w.level < MAX_LEVEL && !w.evolved) pool.push({ c: { kind: 'wup', id: w.def.id }, w: 1.4 });
    if (this.weapons.length < MAX_SLOTS)
      for (const id of Object.keys(WEAPONS)) if (!this.weaponOf(id)) pool.push({ c: { kind: 'wnew', id }, w: 1 });
    for (const [id, lv] of this.toppings) if (lv < MAX_LEVEL) pool.push({ c: { kind: 'tup', id }, w: 1 });
    if (this.toppings.size < MAX_SLOTS)
      for (const id of Object.keys(TOPPINGS)) if (!this.toppings.has(id as ToppingId)) pool.push({ c: { kind: 'tnew', id }, w: 0.9 });
    const out: Choice[] = [];
    const n = this.bagel.choices;
    while (out.length < n && pool.length) {
      const total = pool.reduce((a, p) => a + p.w, 0);
      let r = Math.random() * total;
      let i = 0;
      for (; i < pool.length - 1; i++) {
        r -= pool[i].w;
        if (r <= 0) break;
      }
      out.push(pool[i].c);
      pool.splice(i, 1);
    }
    if (!out.length) out.push({ kind: 'heal' }, { kind: 'coin' });
    return out;
  }

  /** True if taking this choice completes an evolution recipe. */
  private isCombo(c: Choice): boolean {
    if (c.kind === 'wnew' || c.kind === 'wup') {
      const def = WEAPONS[c.id as WeaponId];
      return this.toppings.has(def.evolveWith);
    }
    if (c.kind === 'tnew') return this.weapons.some((w) => !w.evolved && w.def.evolveWith === c.id);
    return false;
  }

  private applyChoice(c: Choice): void {
    switch (c.kind) {
      case 'wnew':
        this.addWeapon(c.id as WeaponId);
        break;
      case 'wup':
        this.weaponOf(c.id!)!.level++;
        break;
      case 'tnew':
        this.toppings.set(c.id as ToppingId, 1);
        if (c.id === 'dough') this.player.hp += 15;
        break;
      case 'tup':
        this.toppings.set(c.id as ToppingId, (this.toppings.get(c.id as ToppingId) ?? 0) + 1);
        if (c.id === 'dough') this.player.hp += 15;
        break;
      case 'heal':
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 30);
        this.healsTaken++;
        break;
      case 'coin':
        this.coins += 15;
        break;
    }
    this.recomputeStats();
  }

  private describe(c: Choice): { icon: string; name: string; tag: string; desc: string } {
    switch (c.kind) {
      case 'wnew': {
        const d = WEAPONS[c.id as WeaponId];
        return { icon: d.icon, name: d.name, tag: 'NEW WEAPON', desc: d.blurb };
      }
      case 'wup': {
        const w = this.weaponOf(c.id!)!;
        return { icon: w.def.icon, name: w.def.name, tag: `LV ${w.level + 1}`, desc: w.def.levels[w.level] };
      }
      case 'tnew': {
        const d = TOPPINGS[c.id as ToppingId];
        return { icon: d.icon, name: d.name, tag: 'NEW TOPPING', desc: d.blurb };
      }
      case 'tup': {
        const d = TOPPINGS[c.id as ToppingId];
        return { icon: d.icon, name: d.name, tag: `LV ${(this.toppings.get(c.id as ToppingId) ?? 0) + 1}`, desc: d.blurb };
      }
      case 'heal':
        return { icon: 'ic_heal', name: 'Fresh Out the Oven', tag: 'HEAL', desc: 'Restore 30 health.' };
      case 'coin':
        return { icon: 'ic_coin', name: 'Tip Jar', tag: 'DOUGH', desc: '+15 Dough at the end of the run.' };
    }
  }

  // ---------------------------------------------------------------- Main loop

  private lastFrame = 0;

  update(): void {
    // Use wall-clock delta (Phaser smooths/clamps its own), capped so a hitch never teleports enemies.
    const nowMs = performance.now();
    const dt = this.lastFrame ? Math.min((nowMs - this.lastFrame) / 1000, 0.05) : 1 / 60;
    this.lastFrame = nowMs;
    this.updateJoystickGfx();
    if (this.paused) return;
    if (this.hitstop > 0) {
      // Freeze-frame on heavy hits sells the impact.
      this.hitstop -= dt;
      return;
    }
    const steps = DEBUG.speed;
    for (let i = 0; i < steps && !this.paused; i++) this.step(dt);
    this.render2();
  }

  private step(dt: number): void {
    this.now += dt;
    this.updatePlayer(dt);
    this.director(dt);
    this.rebuildGrid();
    this.updateEnemies(dt);
    for (const w of this.weapons) w.update(dt);
    this.compactEnemies();
    this.updateShots(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateQuirk(dt);
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 5;
      this.writeSnapshot();
    }
    if (this.pendingLevels > 0 && !this.paused) this.openLevelUp();
  }

  // ---------------------------------------------------------------- Bagel quirks

  private updateQuirk(dt: number): void {
    const p = this.player;
    const q = this.bagel.quirkId;
    if (q === 'trail') {
      // Poppy: drop a seed mine every so often while moving.
      this.mineT -= dt;
      if (this.mineT <= 0 && Math.hypot(p.moveX, p.moveY) > 0.3) {
        this.mineT = 0.14;
        const img = this.img('mine', p.x, p.y, 4);
        this.mines.push({ img, x: p.x, y: p.y, life: 2.6 });
        if (this.mines.length > 40) this.mines.shift()!.img.destroy();
      }
      const dmg = 7 * this.stats.damage;
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const m = this.mines[i];
        m.life -= dt;
        if (m.life < 0.5) m.img.setAlpha(m.life / 0.5);
        this.query(m.x, m.y, 8 * this.stats.area, (e) => {
          this.hit(e, dmg, 0, 0, 'trail', 0.5);
        });
        if (m.life <= 0) {
          m.img.destroy();
          this.mines.splice(i, 1);
        }
      }
    } else if (q === 'aura') {
      // Onion Olly: tear-gas aura that slows and hurts.
      const r = 58 * this.stats.area;
      if (!this.auraImg) {
        this.auraImg = this.img('puddle', p.x, p.y, 1).setTint(0xb7e36a).setAlpha(0.28);
      }
      this.auraImg.setPosition(p.x, p.y).setScale(((r * 2) / 128) * (1 / S) * (1 + 0.04 * Math.sin(this.now * 5)));
      this.auraT -= dt;
      const tick = this.auraT <= 0;
      if (tick) this.auraT = 0.5;
      const dmg = 6 * this.stats.damage;
      this.query(p.x, p.y, r, (e) => {
        e.slowUntil = this.now + 0.3;
        if (tick) this.hit(e, dmg, 0, 0, '', 0);
      });
    }
  }

  // ---------------------------------------------------------------- Save & resume

  private writeSnapshot(): void {
    if (this.paused === 'over') return;
    const snap: RunSnapshot = {
      v: 1,
      savedAt: Date.now(),
      bagel: this.bagel.id,
      practice: this.practice,
      now: this.now,
      level: this.level,
      xp: this.xp,
      pendingLevels: this.pendingLevels,
      hp: this.player.hp,
      weapons: this.weapons.map((w) => ({ id: w.def.id, level: w.level, evolved: w.evolved })),
      toppings: [...this.toppings],
      kills: this.kills,
      coins: this.coins,
      rerolls: this.rerolls,
      nextWave: this.nextWave,
      nextAnts: this.nextAnts,
      nextElite: this.nextElite,
      miniSpawned: this.miniSpawned,
      miniHp: this.mini?.alive ? this.mini.hp : 0,
      miniKilled: this.miniKilled,
      bossSpawned: this.bossSpawned,
      bossHp: this.boss?.alive ? this.boss.hp : 0,
      evolutions: this.evolutionsThisRun,
      healsTaken: this.healsTaken,
    };
    saveRun(snap);
  }

  private applySnapshot(s: RunSnapshot): void {
    this.weapons.forEach((w) => w.destroy());
    this.weapons = [];
    for (const w of s.weapons) {
      const wp = createWeapon(this, w.id as WeaponId);
      wp.level = w.level;
      wp.evolved = w.evolved;
      this.weapons.push(wp);
    }
    this.toppings = new Map(s.toppings as [ToppingId, number][]);
    this.now = s.now;
    this.level = s.level;
    this.xp = s.xp;
    this.xpNext = xpNeeded(s.level);
    this.pendingLevels = s.pendingLevels;
    this.kills = s.kills;
    this.coins = s.coins;
    this.rerolls = s.rerolls;
    this.nextWave = s.nextWave;
    this.nextAnts = s.nextAnts;
    this.nextElite = s.nextElite;
    this.miniSpawned = s.miniSpawned;
    this.miniKilled = s.miniKilled;
    this.bossSpawned = s.bossSpawned;
    this.evolutionsThisRun = s.evolutions;
    this.healsTaken = s.healsTaken;
    this.recomputeStats();
    this.player.hp = Math.min(this.stats.maxHp, s.hp);
    if (s.miniHp > 0) {
      const sp = this.spawnPoint();
      const e = this.spawnEnemy('croissant', sp.x, sp.y, 1);
      if (e) {
        e.hp = s.miniHp;
        e.dropsChest = true;
        this.mini = e;
      }
    }
    if (s.bossHp > 0) {
      const sp = this.spawnPoint();
      const e = this.spawnEnemy('toaster', sp.x, sp.y, 1);
      if (e) {
        e.hp = s.bossHp;
        e.boss = true;
        e.attack2T = 4;
        this.boss = e;
      }
    }
    // Start paused so there's time to get a thumb on the screen.
    this.time.delayedCall(50, () => this.openPause());
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    let mx = this.joyVec.x;
    let my = this.joyVec.y;
    const k = this.keys;
    if (k.left?.isDown || k.a?.isDown) mx = -1;
    if (k.right?.isDown || k.d?.isDown) mx = 1;
    if (k.up?.isDown || k.w?.isDown) my = -1;
    if (k.down?.isDown || k.s?.isDown) my = 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.moveX = mx;
    p.moveY = my;
    if (len > 0.1) {
      const l = Math.hypot(mx, my);
      p.faceX = mx / l;
      p.faceY = my / l;
    }
    p.x += mx * this.stats.speed * dt;
    p.y += my * this.stats.speed * dt;
  }

  private render2(): void {
    const p = this.player;
    const base = 1 / S;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.1;
    const squash = moving ? 0.07 * Math.sin(this.now * 20) : 0.03 * Math.sin(this.now * 4);
    p.sprite.setPosition(p.x, p.y).setScale(base * (1 - squash), base * (1 + squash));
    p.sprite.setRotation(moving ? p.moveX * 0.12 : 0);
    p.sprite.setAlpha(this.now < p.invulnUntil ? (Math.floor(this.now * 20) % 2 ? 0.45 : 1) : 1);
    this.hpBg.setPosition(p.x, p.y + 22);
    this.hpFill.setPosition(p.x - 15, p.y + 22).setSize(30 * Math.max(0, p.hp / p.maxHp), 4);
    this.cameras.main.centerOn(p.x, p.y);
    this.floor.setPosition(Math.round(p.x / 64) * 64, Math.round(p.y / 64) * 64);
    this.updateHud();
    this.drawArrows();
  }

  // ---------------------------------------------------------------- Director

  private viewW(): number {
    return this.scale.width / S;
  }
  private viewH(): number {
    return this.scale.height / S;
  }

  /**
   * A point just off-screen. While the player is moving, most spawns land in the direction
   * of travel (within ±75°), so running away never leaves an empty lane ahead.
   */
  private spawnPoint(aheadBias = 0.7): { x: number; y: number } {
    const p = this.player;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    let a: number;
    if (moving && Math.random() < aheadBias) a = Math.atan2(p.moveY, p.moveX) + (Math.random() * 2 - 1) * 1.3;
    else a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const edge = Math.min(this.viewW() / 2 / Math.max(Math.abs(dx), 1e-3), this.viewH() / 2 / Math.max(Math.abs(dy), 1e-3));
    const d = edge + 40;
    return { x: p.x + dx * d, y: p.y + dy * d };
  }

  private pickKind(t: number): EnemyKind {
    const table: [EnemyKind, number][] =
      t < 45
        ? [['crumb', 1]]
        : t < 90
          ? [['crumb', 70], ['mold', 30]]
          : t < 150
            ? [['crumb', 50], ['mold', 30], ['knife', 20]]
            : [['crumb', 40], ['mold', 32], ['knife', 28]];
    let r = Math.random() * table.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return table[0][0];
  }

  private director(dt: number): void {
    const t = this.now;
    const hpMult = 1 + t / 180;
    let interval = Math.max(0.1, 0.7 - t * 0.0018);
    if (this.boss) interval *= 4;
    // Gentler through 3:00, then the swarm ramps up toward the boss.
    const batch = 1 + Math.floor(t / 75) + (t > 180 ? 2 : 0);
    const cap = t < 180 ? RUN.earlyMaxEnemies : RUN.maxEnemies;
    this.spawnT -= dt;
    while (this.spawnT <= 0) {
      this.spawnT += interval;
      for (let i = 0; i < batch && this.enemies.length < cap; i++) {
        const sp = this.spawnPoint();
        this.spawnEnemy(this.pickKind(t), sp.x, sp.y, hpMult);
      }
    }
    if (t >= RUN.miniBossAt && t >= this.nextWave && t < RUN.bossAt - 5) {
      this.nextWave += RUN.waveEvery;
      const n = 28;
      const d = Math.hypot(this.viewW(), this.viewH()) / 2 + 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy(i % 2 ? 'crumb' : 'moldling', this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, hpMult);
      }
      this.banner('The crumbs close in!', CSS.cream, 18);
    }
    if (t >= this.nextAnts && !this.boss) {
      this.nextAnts += RUN.antsEvery;
      const a = Math.random() * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const d = Math.max(this.viewW(), this.viewH()) / 2 + 60;
      const offset = (Math.random() - 0.5) * 120;
      for (let i = 0; i < 12; i++) {
        const lat = (i - 5.5) * 20 + offset;
        const x = this.player.x - dx * d - dy * lat;
        const y = this.player.y - dy * d + dx * lat;
        const e = this.spawnEnemy('ant', x, y, hpMult);
        if (e) {
          e.vx = dx * e.speed;
          e.vy = dy * e.speed;
        }
      }
    }
    if (t >= this.nextElite && t < RUN.bossAt) {
      this.nextElite += RUN.eliteEvery;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy('elite', sp.x, sp.y, 1);
      if (e) e.dropsChest = true;
      this.banner('A Giant Mold appears!', '#9fd36a', 20);
    }
    if (!this.miniSpawned && t >= RUN.miniBossAt) {
      this.miniSpawned = true;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy('croissant', sp.x, sp.y, 1);
      if (e) {
        e.dropsChest = true;
        this.mini = e;
      }
      this.banner('Crusty Croissant!', CSS.gold, 26);
    }
    if (!this.bossSpawned && t >= RUN.bossAt) {
      this.bossSpawned = true;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy('toaster', sp.x, sp.y, 1);
      if (e) {
        e.boss = true;
        this.boss = e;
        e.attack2T = 4;
      }
      this.banner('THE TOASTER TYRANT', CSS.red, 30);
      sfx('boss');
      this.vacuum();
      this.cameras.main.shake(400, 0.006);
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, hpMult: number): Enemy | null {
    const def = ENEMIES[kind];
    const special = kind === 'elite' || kind === 'croissant' || kind === 'toaster';
    if (!special && this.enemies.length >= RUN.maxEnemies + 40) return null;
    const e = this.pool.pop() ?? new Enemy();
    if (!e.sprite) e.sprite = this.img(def.tex, x, y, 30);
    e.sprite.setTexture(def.tex).setVisible(true).setAlpha(1).setRotation(0).setFlipX(false);
    e.sprite.clearTint();
    const isBig = def.radius > 20;
    const scale = kind === 'elite' ? 2 : 1;
    e.sprite.setScale(scale / S).setDepth(isBig ? 35 : 30);
    if (kind === 'elite') e.sprite.setTint(0xb6e07a);
    e.kind = kind;
    e.x = x;
    e.y = y;
    const bossHp = kind === 'croissant' || kind === 'toaster' || kind === 'elite';
    e.maxHp = e.hp = def.hp * (bossHp ? 1 : hpMult);
    e.speed = def.speed * (0.9 + Math.random() * 0.2);
    e.dmg = def.dmg;
    e.radius = def.radius;
    e.xp = def.xp;
    e.mass = def.mass;
    e.kx = e.ky = e.vx = e.vy = 0;
    e.slowUntil = e.flashUntil = 0;
    e.alive = true;
    e.boss = false;
    e.dropsChest = false;
    e.state = 0;
    e.stateT = 0;
    e.attackT = 1.5;
    e.attack2T = 0;
    e.hitCd.clear();
    e.sprite.setData('tinted', kind === 'elite');
    this.enemies.push(e);
    if (isBig) this.bigs.push(e);
    return e;
  }

  // ---------------------------------------------------------------- Enemies

  private rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) {
      if (!e.alive || e.radius > 20) continue;
      const key = this.cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      e.gridNext = this.grid.get(key) ?? null;
      this.grid.set(key, e);
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const t = this.now;
    const decay = Math.exp(-8 * dt);
    const farX = this.viewW() / 2 + 170;
    const farY = this.viewH() / 2 + 170;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const slow = e.slowUntil > t ? 0.5 : 1;
      let mvx = (dx / dist) * e.speed * slow;
      let mvy = (dy / dist) * e.speed * slow;

      switch (e.kind) {
        case 'ant':
          mvx = e.vx * slow;
          mvy = e.vy * slow;
          e.sprite.setRotation(Math.atan2(e.vy, e.vx));
          break;
        case 'knife':
          e.stateT -= dt;
          if (e.state === 0) {
            e.sprite.setRotation(Math.atan2(dy, dx));
            if (dist < 190) {
              e.state = 1;
              e.stateT = 0.55;
              e.vx = (dx / dist) * 430;
              e.vy = (dy / dist) * 430;
            }
          } else if (e.state === 1) {
            mvx = mvy = 0;
            e.sprite.setRotation(Math.atan2(e.vy, e.vx) + Math.sin(t * 60) * 0.12);
            e.sprite.setTint(0xff8a7a);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.5;
              e.sprite.clearTint();
            }
          } else if (e.state === 2) {
            mvx = e.vx * slow;
            mvy = e.vy * slow;
            if (e.stateT <= 0) {
              e.state = 3;
              e.stateT = 0.8;
            }
          } else {
            mvx *= 0.3;
            mvy *= 0.3;
            if (e.stateT <= 0) e.state = 0;
          }
          break;
        case 'croissant':
          e.sprite.setRotation(Math.sin(t * 3) * 0.25);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 1.7;
            const off = Math.random() * Math.PI;
            for (let i = 0; i < 10; i++) this.fireShot('flake', e.x, e.y, off + (i / 10) * Math.PI * 2, 130, 10, 6);
          }
          break;
        case 'toaster':
          e.sprite.setRotation(Math.sin(t * 6) * 0.06);
          e.attackT -= dt;
          e.attack2T -= dt;
          if (e.attackT <= 0) {
            e.attackT = 2.3;
            e.state = (e.state + 1) % 2;
            if (e.state === 0) {
              const off = Math.random() * Math.PI;
              for (let i = 0; i < 14; i++) this.fireShot('toast', e.x, e.y, off + (i / 14) * Math.PI * 2, 150, 15, 8);
            } else {
              const a = Math.atan2(dy, dx);
              for (let i = -2; i <= 2; i++) this.fireShot('toast', e.x, e.y, a + i * 0.2, 210, 15, 8);
            }
          }
          if (e.attack2T <= 0) {
            e.attack2T = 6.5;
            this.addHazard(p.x, p.y);
            for (let i = 0; i < 4; i++) {
              const a = Math.random() * Math.PI * 2;
              const d = 50 + Math.random() * 100;
              this.addHazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
            }
          }
          break;
        default:
          if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
      }

      e.x += (mvx + e.kx) * dt;
      e.y += (mvy + e.ky) * dt;
      e.kx *= decay;
      e.ky *= decay;

      // Soft separation so swarms read as a crowd, not a single blob.
      if (e.radius <= 20) {
        let o = this.grid.get(this.cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL))) ?? null;
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

      // Recycle stragglers to the front (keeps pressure on without huge counts).
      if (!e.boss && e.kind !== 'croissant' && e.kind !== 'elite') {
        const rx = e.x - p.x;
        const ry = e.y - p.y;
        if (Math.abs(rx) > farX || Math.abs(ry) > farY) {
          if (e.kind === 'ant') {
            this.removeEnemy(e);
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
      if (cx * cx + cy * cy < rr * rr) {
        if (this.bagel.quirkId === 'tank' && !e.boss) {
          const dl = Math.hypot(cx, cy) || 1;
          this.hit(e, 15 * this.stats.damage, (cx / dl) * 260, (cy / dl) * 260, 'tank', 0.4);
        }
        if (e.alive) this.damagePlayer(e.dmg);
      }

      e.sprite.setPosition(e.x, e.y);
      const flashing = e.flashUntil > t;
      if (flashing !== e.sprite.getData('flash')) {
        e.sprite.setData('flash', flashing);
        if (flashing) e.sprite.setTintFill(0xffffff);
        else if (e.sprite.getData('tinted')) e.sprite.setTint(0xb6e07a);
        else e.sprite.clearTint();
      }
      if (this.paused === 'over') return;
    }
  }

  private removeEnemy(e: Enemy): void {
    e.alive = false;
    e.sprite.setVisible(false);
  }

  private compactEnemies(): void {
    let j = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive) this.enemies[j++] = e;
      else this.pool.push(e);
    }
    this.enemies.length = j;
    if (this.bigs.some((e) => !e.alive)) this.bigs = this.bigs.filter((e) => e.alive);
  }

  private killEnemy(e: Enemy): void {
    this.removeEnemy(e);
    this.kills++;
    if (this.bagel.quirkId === 'raisin' && ++this.raisinKills >= 20) {
      this.raisinKills = 0;
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1);
    }
    sfx('kill');
    this.deathPop(e);
    const big = e.radius > 20;
    this.burst(e.x, e.y, e.kind.startsWith('mold') || e.kind === 'elite' ? 0x76a83e : e.kind === 'knife' ? 0xdfe5ea : 0xb57a3c, big ? 18 : 6, big ? 60 : 30);
    if (e.kind === 'mold') {
      for (let i = 0; i < 2; i++) {
        const m = this.spawnEnemy('moldling', e.x + (i ? 6 : -6), e.y, 1 + this.now / 180);
        if (m) {
          m.kx = (i ? 1 : -1) * 120;
        }
      }
    }
    if (e.xp > 0) this.dropXp(e.x, e.y, e.xp);
    if (e.dropsChest) this.dropPickup('chest', e.x, e.y, 1);
    const r = Math.random();
    if (r < 0.01) this.dropPickup('coin', e.x + 6, e.y, 1);
    else if (r < 0.015) this.dropPickup('heal', e.x, e.y + 6, 30);
    if (e === this.mini) {
      this.mini = null;
      this.miniKilled = true;
      this.vacuum();
      this.cameras.main.shake(250, 0.006);
    }
    if (e === this.boss) {
      this.boss = null;
      this.cameras.main.shake(600, 0.012);
      this.cameras.main.flash(300, 255, 240, 200);
      for (let i = 0; i < 4; i++) this.burst(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, 0xff7a2a, 16, 90);
      this.endRun(true);
    }
  }

  /** A white copy of the enemy that swells and fades where it died. */
  private deathPop(e: Enemy): void {
    if (this.particles > 140) return;
    const im = this.img(e.sprite.texture.key, e.x, e.y, 39);
    const sc = e.sprite.scaleX;
    im.setScale(sc).setTintFill(0xffffff).setRotation(e.sprite.rotation).setFlipX(e.sprite.flipX);
    this.particles++;
    this.tweens.add({
      targets: im,
      scaleX: sc * 1.6,
      scaleY: sc * 0.4,
      alpha: 0,
      duration: 140,
      ease: 'Quad.Out',
      onComplete: () => {
        im.destroy();
        this.particles--;
      },
    });
  }

  private burst(x: number, y: number, color: number, n: number, dist: number): void {
    if (this.particles > 160) return;
    for (let i = 0; i < n; i++) {
      const im = this.img('dot', x, y, 40).setTint(color);
      const s = (0.4 + Math.random() * 0.6) / S;
      im.setScale(s);
      this.particles++;
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      this.tweens.add({
        targets: im,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        scale: 0,
        duration: 280 + Math.random() * 160,
        ease: 'Cubic.Out',
        onComplete: () => {
          im.destroy();
          this.particles--;
        },
      });
    }
  }

  // ---------------------------------------------------------------- Shots & hazards

  private fireShot(tex: string, x: number, y: number, a: number, speed: number, dmg: number, r: number): void {
    const sprite = this.img(tex, x, y, 45);
    this.shots.push({ sprite, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 5, spin: (Math.random() - 0.5) * 10 });
  }

  private updateShots(dt: number): void {
    const p = this.player;
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
        this.damagePlayer(s.dmg);
        dead = true;
      }
      if (dead) {
        s.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private addHazard(x: number, y: number): void {
    const r = 38;
    const sprite = this.img('ring', x, y, 3);
    sprite.setScale(((r * 2) / 64) * (1 / S) * 0.2);
    this.tweens.add({ targets: sprite, scale: ((r * 2) / 64) * (1 / S), duration: 300, ease: 'Back.Out' });
    this.hazards.push({ sprite, x, y, r, dmg: 18, t: 1.1 });
  }

  private updateHazards(dt: number): void {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt;
      h.sprite.setAlpha(0.6 + 0.4 * Math.sin(this.now * 25));
      if (h.t <= 0) {
        const dx = h.x - p.x;
        const dy = h.y - p.y;
        if (dx * dx + dy * dy < (h.r + p.radius) ** 2) this.damagePlayer(h.dmg);
        const toast = this.img('toast', h.x, h.y - 120, 46);
        toast.setScale(2 / S);
        const sc = 2 / S;
        this.tweens.add({
          targets: toast,
          y: h.y,
          duration: 120,
          onComplete: () => {
            this.burst(h.x, h.y, 0xd59a52, 8, 50);
            this.tweens.add({ targets: toast, alpha: 0, scale: sc * 1.4, duration: 220, onComplete: () => toast.destroy() });
          },
        });
        h.sprite.destroy();
        this.hazards.splice(i, 1);
      }
    }
  }

  private damagePlayer(d: number): void {
    const p = this.player;
    if (DEBUG.god || this.paused || this.now < p.invulnUntil) return;
    p.hp -= d;
    p.invulnUntil = this.now + 0.9;
    this.cameras.main.shake(110, 0.005);
    sfx('hurt');
    // Shove nearby enemies away so there is room to escape.
    this.query(p.x, p.y, 70, (e) => {
      if (e.boss) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dl = Math.hypot(dx, dy) || 1;
      e.kx += (dx / dl) * (320 / e.mass);
      e.ky += (dy / dl) * (320 / e.mass);
    });
    p.sprite.setTintFill(0xff5a4a);
    this.tweens.add({ targets: p.sprite, duration: 90, onComplete: () => p.sprite.clearTint() });
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  // ---------------------------------------------------------------- Pickups

  private dropXp(x: number, y: number, value: number): void {
    if (this.pickups.length > 300) {
      // Too many seeds on the floor: fold this one into the nearest existing seed.
      let g: Pickup | null = null;
      let bd = Infinity;
      for (const p of this.pickups) {
        if (p.kind !== 'xp' || p.magnet) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) {
          bd = d;
          g = p;
        }
      }
      if (g) {
        g.value += value;
        g.sprite.setTexture(this.gemTex(g.value));
        return;
      }
    }
    this.dropPickup('xp', x, y, value);
  }

  private gemTex(v: number): string {
    return v <= 2 ? 'gem1' : v <= 9 ? 'gem2' : 'gem3';
  }

  private dropPickup(kind: Pickup['kind'], x: number, y: number, value: number): void {
    const tex = kind === 'xp' ? this.gemTex(value) : kind;
    const sprite = this.img(tex, x, y, kind === 'chest' ? 12 : 10);
    if (kind === 'chest') {
      this.tweens.add({ targets: sprite, y: y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.pickups.push({ sprite, x, y, kind, value, magnet: false, alive: true });
  }

  /** Pull every seed on the floor to the player. */
  private vacuum(): void {
    for (const p of this.pickups) if (p.kind === 'xp' || p.kind === 'coin') p.magnet = true;
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    const mag = this.stats.magnet;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (it.kind === 'chest') {
        if (d < 70) {
          it.x += (dx / d) * 200 * dt;
          it.y += (dy / d) * 200 * dt;
          it.sprite.x = it.x;
        }
        if (d < 24) this.collect(it, i);
        continue;
      }
      if (!it.magnet && d < mag) it.magnet = true;
      if (it.magnet) {
        const sp = 260 + Math.max(0, 420 - d * 2);
        it.x += (dx / d) * sp * dt;
        it.y += (dy / d) * sp * dt;
        it.sprite.setPosition(it.x, it.y);
        if (d < p.radius + 4) this.collect(it, i);
      }
    }
  }

  private collect(it: Pickup, idx: number): void {
    it.alive = false;
    it.sprite.destroy();
    this.pickups.splice(idx, 1);
    switch (it.kind) {
      case 'xp':
        this.gainXp(it.value);
        sfx('xp');
        break;
      case 'coin':
        this.coins += 1;
        break;
      case 'heal':
        this.healsTaken++;
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + it.value);
        this.burst(this.player.x, this.player.y, 0x7fbf4d, 8, 30);
        break;
      case 'chest':
        this.openChest();
        break;
    }
  }

  private gainXp(v: number): void {
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpNeeded(this.level);
      this.pendingLevels++;
    }
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    const xpBg = this.ui(this.add.rectangle(0, 0, 10, 10, 0x1d140d).setOrigin(0, 0));
    const xpFill = this.ui(this.add.rectangle(0, 0, 10, 10, COLORS.xp).setOrigin(0, 0));
    const level = this.ui(txt(this, 0, 0, 'Lv 1', 15).setOrigin(0, 0.5));
    const timer = this.ui(txt(this, 0, 0, '0:00', 26));
    const kills = this.ui(txt(this, 0, 0, '0', 13, CSS.muted).setOrigin(0, 0.5));
    const pause = this.ui(button(this, 0, 0, 40 * S, 40 * S, 'II', () => this.openPause(), { color: COLORS.panelLight, textColor: CSS.cream, size: 18, radius: 12 }));
    const bossName = this.ui(txt(this, 0, 0, '', 14, CSS.gold).setVisible(false));
    const bossBg = this.ui(this.add.rectangle(0, 0, 10, 10, 0x1d140d).setVisible(false));
    const bossFill = this.ui(this.add.rectangle(0, 0, 10, 10, COLORS.red).setOrigin(0, 0.5).setVisible(false));
    this.hud = { xpBg, xpFill, level, timer, kills, pause, bossName, bossBg, bossFill };
  }

  private onResize(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.uiCam?.setSize(W, H);
    this.floor?.setSize(W / S + 256, H / S + 256);
    if (!this.hud) return;
    const top = safeInsets().top * S;
    const h = this.hud;
    const pad = 12 * S;
    h.xpBg.setPosition(0, top).setSize(W, 8 * S);
    h.xpFill.setPosition(0, top).setSize(W * (this.xp / this.xpNext), 8 * S);
    h.level.setPosition(pad, top + 28 * S);
    h.kills.setPosition(pad, top + 48 * S);
    h.timer.setPosition(W / 2, top + 32 * S);
    h.pause.setPosition(W - pad - 20 * S, top + 34 * S);
    h.bossName.setPosition(W / 2, top + 62 * S);
    const bw = Math.min(W - 40 * S, 320 * S);
    h.bossBg.setPosition(W / 2, top + 80 * S).setSize(bw, 10 * S);
    h.bossFill.setPosition(W / 2 - bw / 2 + 2 * S, top + 80 * S).setSize(bw - 4 * S, 6 * S);
    h.bossBg.setData('w', bw - 4 * S);
  }

  private updateHud(): void {
    const h = this.hud;
    const W = this.scale.width;
    h.xpFill.setSize(W * Math.min(1, this.xp / this.xpNext), 8 * S);
    const sec = Math.floor(this.now);
    if (sec !== this.lastTimerSec) {
      this.lastTimerSec = sec;
      h.timer.setText(fmtTime(sec));
      h.level.setText(`Lv ${this.level}`);
    }
    h.kills.setText(`${this.kills} crumbs`);
    const b = this.boss ?? this.mini;
    const show = !!b && b.alive;
    h.bossName.setVisible(show);
    h.bossBg.setVisible(show);
    h.bossFill.setVisible(show);
    if (b && show) {
      h.bossName.setText(b.kind === 'toaster' ? 'The Toaster Tyrant' : 'Crusty Croissant');
      h.bossFill.setSize((h.bossBg.getData('w') as number) * Math.max(0, b.hp / b.maxHp), 6 * S);
    }
  }

  /** Arrows on the screen edge pointing at off-screen bosses, elites and chests. */
  private drawArrows(): void {
    const g = this.arrowGfx;
    g.clear();
    const W = this.scale.width;
    const H = this.scale.height;
    const p = this.player;
    const ins = safeInsets();
    const m = 26 * S;
    const top = (ins.top + 96) * S;
    const bottom = H - (ins.bottom + 26) * S;
    const targets: { x: number; y: number; color: number }[] = [];
    for (const e of this.bigs) {
      if (!e.alive) continue;
      targets.push({ x: e.x, y: e.y, color: e.boss ? COLORS.red : e.kind === 'croissant' ? COLORS.gold : COLORS.green });
    }
    for (const it of this.pickups) if (it.kind === 'chest') targets.push({ x: it.x, y: it.y, color: 0xfff0a0 });
    const pulse = 1 + 0.12 * Math.sin(this.now * 8);
    for (const t of targets) {
      const sx = W / 2 + (t.x - p.x) * S;
      const sy = H / 2 + (t.y - p.y) * S;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const dx = sx - W / 2;
      const dy = sy - H / 2;
      // Scale the direction until it touches the inset screen edge.
      const kx = dx > 0 ? (W - m - W / 2) / dx : dx < 0 ? (m - W / 2) / dx : Infinity;
      const ky = dy > 0 ? (bottom - H / 2) / dy : dy < 0 ? (top - H / 2) / dy : Infinity;
      const k = Math.min(kx, ky);
      const ax = W / 2 + dx * k;
      const ay = H / 2 + dy * k;
      const a = Math.atan2(dy, dx);
      const r = 13 * S * pulse;
      const pts = [0, 2.5, -2.5].map((o, i) => ({
        x: ax + Math.cos(a + o) * (i === 0 ? r : r * 0.8),
        y: ay + Math.sin(a + o) * (i === 0 ? r : r * 0.8),
      }));
      g.fillStyle(0x1d140d, 0.85).fillCircle(ax, ay, r * 0.95);
      g.fillStyle(t.color, 1).fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    }
  }

  private banner(text: string, color: string, size: number): void {
    const W = this.scale.width;
    const top = safeInsets().top * S;
    const slot = this.banners++;
    const t = this.ui(txt(this, W / 2, top + (120 + slot * 40) * S, text, size, color, { wrap: W / S - 40 }));
    t.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30 * S, delay: 1600, duration: 500, onComplete: () => {
      t.destroy();
      this.banners--;
    } });
  }

  // ---------------------------------------------------------------- Input

  private setupInput(): void {
    this.input.addPointer(1);
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      unlockAudio();
      if (this.paused || over.length > 0 || this.joyId !== null) return;
      this.joyId = ptr.id;
      this.joyBase = { x: ptr.x, y: ptr.y };
      this.joyVec = { x: 0, y: 0 };
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.joyId) return;
      const max = 48 * S;
      let dx = ptr.x - this.joyBase.x;
      let dy = ptr.y - this.joyBase.y;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        // Drag the base along so direction changes stay responsive.
        this.joyBase.x += (dx / d) * (d - max);
        this.joyBase.y += (dy / d) * (d - max);
        dx = ptr.x - this.joyBase.x;
        dy = ptr.y - this.joyBase.y;
      }
      const dd = Math.hypot(dx, dy);
      const dead = 5 * S;
      if (dd < dead) this.joyVec = { x: 0, y: 0 };
      else {
        const mag = Math.min(1, (dd - dead) / (max * 0.6 - dead));
        this.joyVec = { x: (dx / dd) * mag, y: (dy / dd) * mag };
      }
    });
    const release = (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.joyId) return;
      this.releaseJoystick();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as Record<
        string,
        Phaser.Input.Keyboard.Key
      >;
      kb.on('keydown-ESC', () => (this.paused ? undefined : this.openPause()));
      kb.on('keydown-P', () => (this.paused ? undefined : this.openPause()));
    }
  }

  private releaseJoystick(): void {
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
  }

  private updateJoystickGfx(): void {
    const g = this.joyGfx;
    g.clear();
    if (this.joyId === null || this.paused) return;
    const b = this.joyBase;
    const max = 48 * S;
    g.fillStyle(0x000000, 0.22).fillCircle(b.x, b.y, max + 8 * S);
    g.lineStyle(3 * S, 0xfff3dc, 0.35).strokeCircle(b.x, b.y, max + 8 * S);
    const kx = b.x + this.joyVec.x * max;
    const ky = b.y + this.joyVec.y * max;
    g.fillStyle(0xfff3dc, 0.75).fillCircle(kx, ky, 22 * S);
  }

  // ---------------------------------------------------------------- Overlays

  private setPaused(r: PauseReason): void {
    this.paused = r;
    if (r) {
      this.releaseJoystick();
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  private dim(alpha = 0.65): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x120c08, alpha).setOrigin(0);
    r.setInteractive(); // swallow taps
    return r;
  }

  private openLevelUp(): void {
    this.setPaused('levelup');
    sfx('level');
    const W = this.scale.width;
    const H = this.scale.height;
    const ins = safeInsets();
    const openedAt = performance.now();
    const c = this.add.container(0, 0);
    this.ui(c);
    this.overlay = c;
    c.add(this.dim());

    const choices = this.choices();
    const cw = Math.min(W - 28 * S, 400 * S);
    const ch = 84 * S;
    const gap = 12 * S;
    const bottom = H - ins.bottom * S - 86 * S;
    const startY = bottom - choices.length * (ch + gap) + gap + ch / 2;
    const title = txt(this, W / 2, startY - ch / 2 - 56 * S, 'LEVEL UP!', 34, CSS.gold);
    const sub = txt(this, W / 2, startY - ch / 2 - 24 * S, `Level ${this.level - this.pendingLevels + 1}: pick one`, 15, CSS.muted);
    c.add([title, sub]);
    this.tweens.resumeAll();
    title.setScale(0.5);
    this.tweens.add({ targets: title, scale: 1, duration: 260, ease: 'Back.Out' });

    choices.forEach((choice, i) => {
      const y = startY + i * (ch + gap);
      const info = this.describe(choice);
      const combo = this.isCombo(choice);
      const card = this.add.container(W / 2, y);
      const g = this.add.graphics();
      const draw = (pressed: boolean) => {
        g.clear();
        g.fillStyle(0x1d140d).fillRoundedRect(-cw / 2, -ch / 2 + 5 * S, cw, ch, 16 * S);
        g.fillStyle(pressed ? COLORS.panelLight : COLORS.panel).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * S);
        g.lineStyle(3 * S, combo ? COLORS.gold : COLORS.panelLight).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * S);
        g.fillStyle(0x1d140d, 0.6).fillRoundedRect(-cw / 2 + 12 * S, -30 * S, 60 * S, 60 * S, 12 * S);
      };
      draw(false);
      const icon = this.add.image(-cw / 2 + 42 * S, 0, info.icon).setScale(1.4);
      const tx = -cw / 2 + 86 * S;
      const name = txt(this, tx, -18 * S, info.name, 18, CSS.cream).setOrigin(0, 0.5);
      const tag = txt(this, cw / 2 - 14 * S, -18 * S, combo ? '★ COMBO' : info.tag, 12, combo ? CSS.gold : CSS.muted).setOrigin(1, 0.5);
      const desc = txt(this, tx, 12 * S, info.desc, 14, '#e8d8c0', { wrap: (cw - 100 * S) / S, align: 'left', bold: false, stroke: false }).setOrigin(0, 0.5);
      card.add([g, icon, name, tag, desc]);
      card.setSize(cw, ch);
      card.setInteractive(new Phaser.Geom.Rectangle(0, 0, cw, ch), Phaser.Geom.Rectangle.Contains);
      let armed = false;
      card.on('pointerdown', () => {
        // Ignore taps in the first moments so a thumb lifting off the joystick can't pick by accident.
        if (performance.now() - openedAt < 350) return;
        armed = true;
        draw(true);
      });
      card.on('pointerout', () => {
        armed = false;
        draw(false);
      });
      card.on('pointerup', () => {
        if (!armed) return;
        this.applyChoice(choice);
        this.pendingLevels--;
        this.closeOverlay();
        this.burst(this.player.x, this.player.y, COLORS.xp, 12, 50);
        if (this.pendingLevels > 0) this.openLevelUp();
        else this.setPaused('');
      });
      card.setAlpha(0);
      card.x = W / 2 + 40 * S;
      this.tweens.add({ targets: card, alpha: 1, x: W / 2, delay: 60 * i, duration: 200, ease: 'Cubic.Out' });
      c.add(card);
    });

    if (this.rerolls > 0) {
      const rb = button(
        this,
        W / 2,
        bottom + 40 * S,
        170 * S,
        46 * S,
        `Reroll (${this.rerolls})`,
        () => {
          if (performance.now() - openedAt < 350) return;
          this.rerolls--;
          this.closeOverlay();
          this.openLevelUp();
        },
        { color: COLORS.panelLight, textColor: CSS.cream, size: 17 },
      );
      c.add(rb);
    }
  }

  private openChest(): void {
    this.setPaused('chest');
    sfx('chest');
    const evo = this.weapons.find((w) => w.level >= MAX_LEVEL && !w.evolved && this.toppings.has(w.def.evolveWith));
    let title: string;
    let line: string;
    let icon: string;
    if (evo) {
      evo.evolved = true;
      title = 'EVOLUTION!';
      line = `${evo.def.name} became ${evo.def.evoName}\n${evo.def.evoBlurb}`;
      icon = evo.def.icon;
      this.evolutionsThisRun.push(evo.def.id);
      const save = load();
      if (!save.cookbook.includes(evo.def.id)) save.cookbook.push(evo.def.id);
      persist();
    } else {
      const opts = this.choices().filter((c) => c.kind !== 'heal' && c.kind !== 'coin');
      const pick = opts.find((c) => c.kind === 'wup') ?? opts[0];
      this.coins += 5;
      if (pick) {
        const info = this.describe(pick);
        this.applyChoice(pick);
        title = 'TOASTER CHEST';
        line = `${info.name} ${info.tag.startsWith('LV') ? info.tag.replace('LV', 'Lv') : '(new)'}\n+5 Dough`;
        icon = info.icon;
      } else {
        this.player.hp = this.stats.maxHp;
        title = 'TOASTER CHEST';
        line = 'Fully healed!\n+5 Dough';
        icon = 'ic_heal';
      }
    }
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0);
    this.ui(c);
    this.overlay = c;
    const dim = this.dim(0.7);
    c.add(dim);
    c.add(panel(this, W / 2, H / 2, Math.min(W - 40 * S, 340 * S), 250 * S));
    const im = this.add.image(W / 2, H / 2 - 60 * S, icon).setScale(2.2);
    const t1 = txt(this, W / 2, H / 2 + 6 * S, title, evo ? 30 : 24, evo ? CSS.gold : CSS.cream);
    const t2 = txt(this, W / 2, H / 2 + 56 * S, line, 16, '#e8d8c0', { wrap: Math.min(W / S - 70, 300), bold: false });
    const t3 = txt(this, W / 2, H / 2 + 100 * S, 'Tap to continue', 13, CSS.muted).setAlpha(0);
    c.add([im, t1, t2, t3]);
    this.tweens.resumeAll();
    im.setScale(0.5);
    this.tweens.add({ targets: im, scale: 2.2, angle: evo ? 360 : 0, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: t3, alpha: 1, delay: 600, duration: 200 });
    const openedAt = performance.now();
    dim.on('pointerup', () => {
      if (performance.now() - openedAt < 600) return;
      this.closeOverlay();
      this.setPaused('');
    });
  }

  private onVisibility = (): void => {
    if (document.hidden) this.autoPause();
  };

  private autoPause(): void {
    if (!this.paused) this.openPause();
  }

  private openPause(): void {
    if (this.paused) return;
    this.setPaused('pause');
    this.writeSnapshot();
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0);
    this.ui(c);
    this.overlay = c;
    c.add(this.dim(0.7));
    c.add(panel(this, W / 2, H / 2 + 25 * S, Math.min(W - 40 * S, 320 * S), 390 * S));
    c.add(txt(this, W / 2, H / 2 - 120 * S, this.practice ? 'PAUSED (PRACTICE)' : 'PAUSED', 26, CSS.gold));
    const build = [
      ...this.weapons.map((w) => `${w.evolved ? w.def.evoName : w.def.name}${w.evolved ? ' ★' : ` Lv ${w.level}`}`),
      ...[...this.toppings].map(([id, lv]) => `${TOPPINGS[id].name} Lv ${lv}`),
    ].join('\n');
    c.add(txt(this, W / 2, H / 2 - 30 * S, build, 13, '#e8d8c0', { bold: false, stroke: false }));
    c.add(
      button(this, W / 2, H / 2 + 60 * S, 200 * S, 52 * S, 'Resume', () => {
        this.closeOverlay();
        this.setPaused('');
      }),
    );
    c.add(
      button(this, W / 2, H / 2 + 125 * S, 200 * S, 44 * S, 'Quit run', () => {
        this.closeOverlay();
        this.paused = '';
        this.endRun(false, true);
      }, { color: COLORS.panelLight, textColor: CSS.cream, size: 17 }),
    );
    const snd = button(this, W / 2, H / 2 + 182 * S, 200 * S, 44 * S, `Sound: ${soundOn() ? 'On' : 'Off'}`, () => {
      setSound(!soundOn());
      (snd.getData('label') as Phaser.GameObjects.Text).setText(`Sound: ${soundOn() ? 'On' : 'Off'}`);
    }, { color: COLORS.panelLight, textColor: CSS.cream, size: 17 });
    c.add(snd);
  }

  // ---------------------------------------------------------------- End

  private endRun(victory: boolean, quit = false): void {
    if (this.paused === 'over') return;
    this.setPaused('over');
    this.tweens.resumeAll();
    const save = load();
    const minutes = this.now / 60;
    let dough = Math.round(minutes * 10 + this.kills / 60 + this.coins);
    if (this.miniKilled) dough += 10;
    if (victory) dough += 40;
    // Practice runs are for testing builds and bosses: no rewards or unlocks.
    if (this.practice) dough = 0;
    save.dough += dough;
    save.totalKills += this.kills;
    if (!this.practice) save.bestTime = Math.max(save.bestTime, Math.floor(this.now));
    clearRun();
    if (victory && !this.practice) {
      save.clears++;
      if (this.healsTaken === 0) save.noHealClear = true;
    }
    const newUnlock = this.practice ? '' : checkUnlocks(save).join(', ');
    persist();
    const result: RunResult = {
      victory,
      practice: this.practice,
      time: this.now,
      level: this.level,
      kills: this.kills,
      dough,
      bagel: this.bagel.id,
      newUnlock,
      evolutions: this.evolutionsThisRun.map((id) => WEAPONS[id as WeaponId].evoName),
    };
    const p = this.player.sprite;
    if (!victory && !quit) {
      this.tweens.add({ targets: p, angle: 540, alpha: 0, scale: 0, duration: 800, ease: 'Cubic.In' });
    }
    this.cameras.main.fadeOut(quit ? 200 : 900, 18, 12, 8);
    this.uiCam.fadeOut(quit ? 200 : 900, 18, 12, 8);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('results', result));
  }
}

import Phaser from 'phaser';
import { flash, shake } from '../settings';
import { COLORS, CSS, DEBUG, S, ZOOM } from '../config';
import {
  BAGELS,
  ENEMIES,
  MAX_LEVEL,
  MAX_SLOTS,
  TOPPINGS,
  WEAPONS,
  xpNeeded,
  type BagelDef,
  type ToppingId,
  type WeaponId,
  stageById,
  type StageDef,
} from '../data';
import { Player, type Enemy, type Stats } from '../entities';
import { bestStage, load, persist, recordBest } from '../save';
import { bodyBagel, makeRunTextures } from '../textures';
import { Face } from '../face';
import { COMBOS, createWeapon, type FxId, type Weapon, type World } from '../weapons';
import { hitSfx, muffleMusic, sfx, unlockAudio, type Sfx } from '../sfx';
import { playJingle, playMusic, setRunIntensity, stopMusic } from '../music';
import { checkUnlocks, checkWeaponUnlocks, playableStages, weaponOpen } from '../progress';
import { claimGoals } from '../goals';
import { clearRun, loadRun, type RunSnapshot } from '../runsave';
import { Ambient } from '../run/ambient';
import { Director } from '../run/director';
import { Effects } from '../run/effects';
import { Enemies } from '../run/enemies';
import { Floor, POST_R } from '../run/floor';
import { Hazards } from '../run/hazards';
import { CREEP_SLOW } from '../run/bin';
import { Hud } from '../run/hud';
import { CROWD_XP, HIT_GRACE, LEVEL_HP, CRISPY_DMG, CRISPY_DOUGH, ENDLESS_DOUGH_MIN, PRACTICE_LEVELS, PRACTICE_START, QUICK_DOUGH, QUICK_PACE, QUICK_XP, SLOWMO } from '../run/modes';
import { Panels } from '../run/panels';
import { Pickups } from '../run/pickups';
import { Tutor } from '../run/tutor';
import { openMenu } from '../tips';
import { applySnapshot, writeSnapshot } from '../run/resume';
import { RunState, type Choice, type PauseReason, type RunResult } from '../run/state';
import { wipeOpen } from '../wipe';

export type { RunResult } from '../run/state';

/** Freezer frost: seconds standing still before frost starts, seconds to fill, slow when full. */
const FROST_DELAY = 2;
const FROST_FILL = 2;
const FROST_SLOW = 0.7;
/** Once frozen, it takes this many seconds of moving to thaw (a Warm Mug thaws at once). */
const THAW_TIME = 3.5;
/** How fast you steer on ice (lower = longer slides). */
const ICE_GRIP = 1.2;
/** Ice Cream Scoop melt puddles slow you to this. */
const MELT_SLOW = 0.6;
/** Blueberry's Juicy Dash. */
const DASH_TIME = 0.18;
const DASH_DIST = 95;
const DASH_CD = 5;
/** Asiago ages: +1% damage every AGE_STEP seconds of the stage clock, up to AGE_MAX%. */
const AGE_STEP = 10;
const AGE_MAX = 30;
/** Garlic's Warding: damage multiplier against elites, mini-bosses and bosses. */
const WARD = 1.25;

/**
 * A run. This file holds the core: starting and ending a run, the main loop, the player (movement, frost, quirks,
 * taking damage), stats and level-up choices, and input. The other parts of a run live in `src/run/`:
 * enemies and their behaviors, the timeline (director), hazards, the floor, pickups, effects, the HUD, the pop-up
 * panels, and saving for resume.
 *
 * Phaser reuses this scene object between runs. Every run value lives in `this.run` (a fresh RunState) or in one of
 * the run's parts, which are all made fresh when a run starts, so nothing is left over from the last run. The few
 * plain fields below are reset in `init()`.
 */
export class GameScene extends Phaser.Scene implements World {
  // Reset in init() for every run.
  player = new Player();
  stats: Stats = defaultStats();
  now = 0;
  bagel!: BagelDef;
  stage!: StageDef;
  practice = false;
  quick = false;
  endless = false;
  crispy = false;
  /** Stage-schedule speed: 1 for a full run, QUICK_PACE for a Quick Run. */
  pace = 1;
  paused: PauseReason = '';
  weapons: Weapon[] = [];
  toppings = new Map<ToppingId, number>();
  run!: RunState;
  private resume: RunSnapshot | null = null;
  private hitstop = 0;
  private lastHitstop = 0;
  private lastFrame = 0;

  // The run's parts, made fresh in create().
  effects!: Effects;
  floor!: Floor;
  hz!: Hazards;
  foes!: Enemies;
  director!: Director;
  loot!: Pickups;
  hud!: Hud;
  panels!: Panels;
  tutor!: Tutor;

  // Layers, cameras and the bagel's own drawings, made in create().
  worldLayer!: Phaser.GameObjects.Layer;
  /** The bagel's eyes (they blink, look where it's going and squint when hurt). */
  face!: Face;
  ambient!: Ambient;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private floorTile!: Phaser.GameObjects.TileSprite;
  private hpBg!: Phaser.GameObjects.Rectangle;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private frostGfx!: Phaser.GameObjects.Graphics;

  // Joystick and keys
  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private joyDownAt = 0;
  private joyDown = { x: 0, y: 0 };
  private joyGfx!: Phaser.GameObjects.Graphics;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor() {
    super('game');
  }

  /** Where we are on the full run's schedule (the clock the director and music follow). */
  get stageT(): number {
    return this.now * this.pace;
  }

  init(data: { bagel?: string; stage?: string; practice?: boolean; quick?: boolean; endless?: boolean; crispy?: boolean; resume?: boolean }): void {
    this.resume = data.resume ? loadRun() : null;
    if (this.resume) {
      const r = this.resume;
      data = { bagel: r.bagel, stage: r.stage, practice: r.practice, quick: !!r.quick, endless: !!r.endless, crispy: !!r.crispy };
    }
    this.bagel = BAGELS.find((b) => b.id === data.bagel) ?? BAGELS[0];
    const st = stageById(data.stage);
    this.stage = st.built ? st : stageById('stage1');
    // Endless is Full pace only, and never a practice run.
    this.endless = !!data.endless && !data.practice;
    this.practice = !!data.practice && !this.endless;
    this.quick = !!data.quick && !this.endless;
    this.crispy = !!data.crispy;
    this.pace = this.quick ? QUICK_PACE : 1;
    this.player = new Player();
    this.stats = defaultStats();
    this.now = (this.practice ? PRACTICE_START : DEBUG.start) / this.pace;
    this.paused = '';
    this.weapons = [];
    this.toppings = new Map();
    this.run = new RunState(load().upgrades);
    this.hitstop = 0;
    this.lastHitstop = 0;
    this.lastFrame = 0;
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
  }

  create(): void {
    makeRunTextures(this, this.stage);
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();
    this.uiLayer.setDepth(1000);
    const cam = this.cameras.main;
    cam.setZoom(S * ZOOM);
    cam.setBackgroundColor(COLORS.bg);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    cam.ignore(this.uiLayer);
    this.uiCam.ignore(this.worldLayer);

    this.floorTile = this.add.tileSprite(0, 0, 10, 10, this.stage.floor);
    this.floorTile.setTileScale(1 / S).setDepth(0);
    this.worldLayer.add(this.floorTile);
    // Soft contact shadows under everything that stands on the floor, redrawn each frame.
    this.shadowGfx = this.add.graphics().setDepth(2);
    this.worldLayer.add(this.shadowGfx);
    this.frostGfx = this.add.graphics().setDepth(53);
    this.worldLayer.add(this.frostGfx);

    this.effects = new Effects(this);
    this.floor = new Floor(this);
    this.hz = new Hazards(this);
    this.foes = new Enemies(this);
    this.director = new Director(this);
    this.loot = new Pickups(this);

    this.player.sprite = this.img(bodyBagel(this, this.bagel.tex), 0, 0, 50);
    this.face = new Face(this, this.player.sprite, 15.5, (o) => {
      o.setDepth(50.5);
      this.worldLayer.add(o);
    });
    this.hpBg = this.add.rectangle(0, 0, 30, 4, 0x1d140d).setDepth(51);
    this.hpFill = this.add.rectangle(0, 0, 30, 4, COLORS.red).setDepth(52).setOrigin(0, 0.5);
    this.worldLayer.add([this.hpBg, this.hpFill]);

    this.joyGfx = this.add.graphics().setDepth(900);
    this.uiLayer.add(this.joyGfx);
    this.ambient = new Ambient(this);
    this.hud = new Hud(this);
    this.panels = new Panels(this);
    this.tutor = new Tutor(this);

    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
    this.addWeapon(this.startWeapon());
    if (this.resume) {
      applySnapshot(this, this.resume);
      // Start paused so there's time to get a thumb on the screen.
      this.time.delayedCall(50, () => this.panels.openPause());
    } else if (this.practice) {
      this.run.pendingLevels = PRACTICE_LEVELS;
      this.run.level = 1 + PRACTICE_LEVELS;
      this.run.xpNext = xpNeeded(this.run.level);
    }
    this.onResize();
    if (!this.resume && (this.crispy || this.endless)) {
      const what = this.endless && this.crispy ? 'Endless, Extra Crispy!' : this.endless ? 'Endless: survive as long as you can!' : 'Extra Crispy: tougher enemies, more Dough!';
      this.time.delayedCall(400, () => this.hud.banner(what, this.crispy ? '#ff9a5c' : CSS.gold, 20));
    }

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
    if (!wipeOpen()) this.cameras.main.fadeIn(250, 43, 33, 24);
  }

  // ---------------------------------------------------------------- World API (what weapons and the run's parts use)

  img(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, tex).setScale(1 / S).setDepth(depth);
    im.setData('base', 1 / S);
    this.worldLayer.add(im);
    return im;
  }

  /** Put a screen-space object on the UI layer (above the world, not zoomed). */
  ui<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiLayer.add(obj);
    return obj;
  }

  shake(ms: number, intensity: number): void {
    shake(this, ms, intensity);
  }

  playSfx(name: Sfx): void {
    sfx(name);
  }

  /** Bounces a moving thing off the screen's edges, shelves, short-lived walls and oven knobs. True if it bounced. */
  bounce(o: { x: number; y: number; vx: number; vy: number }, r: number): boolean {
    let hit = false;
    const hw = this.viewW() / 2 - r;
    const hh = this.viewH() / 2 - r;
    const c = this.cameras.main.midPoint;
    if (o.x > c.x + hw && o.vx > 0) (o.vx = -o.vx), (hit = true);
    else if (o.x < c.x - hw && o.vx < 0) (o.vx = -o.vx), (hit = true);
    if (o.y > c.y + hh && o.vy > 0) (o.vy = -o.vy), (hit = true);
    else if (o.y < c.y - hh && o.vy < 0) (o.vy = -o.vy), (hit = true);
    for (const w of this.floor.walls) {
      const dx = o.x - w.x;
      const dy = o.y - w.y;
      const px = w.hw + r - Math.abs(dx);
      if (px <= 0) continue;
      const py = w.hh + r - Math.abs(dy);
      if (py <= 0) continue;
      // Out through the nearer side, and away from it.
      if (px < py) {
        const sx = Math.sign(dx || 1);
        o.x += sx * px;
        if (o.vx * sx < 0) (o.vx = -o.vx), (hit = true);
      } else {
        const sy = Math.sign(dy || 1);
        o.y += sy * py;
        if (o.vy * sy < 0) (o.vy = -o.vy), (hit = true);
      }
    }
    for (const po of this.floor.posts) {
      const dx = o.x - po.x;
      const dy = o.y - po.y;
      const rr = r + POST_R;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01;
      const nx = dx / d;
      const ny = dy / d;
      o.x = po.x + nx * rr;
      o.y = po.y + ny * rr;
      const dot = o.vx * nx + o.vy * ny;
      if (dot < 0) {
        o.vx -= 2 * dot * nx;
        o.vy -= 2 * dot * ny;
        hit = true;
      }
    }
    return hit;
  }

  trailDot(x: number, y: number, color: number): void {
    this.effects.trailDot(x, y, color);
  }

  nearest(x: number, y: number, maxR: number): Enemy | null {
    return this.foes.nearest(x, y, maxR);
  }

  /** The weapons' way to find enemies. In the Bread Bin, whatever a weapon reaches also sears the creep under it. */
  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    if (this.stage.creep) this.hz.bin.sear(x, y, r);
    this.foes.query(x, y, r, cb);
  }

  scan(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    this.foes.query(x, y, r, cb);
  }

  /** Hurt an enemy. key + cd: the same source can't hit the same enemy again within cd seconds. */
  hit(e: Enemy, dmg: number, kx: number, ky: number, key: string, cd: number, fx?: FxId): boolean {
    if (!e.alive) return false;
    if (key && cd > 0) {
      const last = e.hitCd.get(key);
      if (last !== undefined && this.now - last < cd) return false;
      e.hitCd.set(key, this.now);
    }
    // Garlic's Warding: elites, mini-bosses and bosses take more from everything this bagel does.
    if (this.bagel.quirkId === 'ward' && ENEMIES[e.kind].flat) dmg *= WARD;
    // The Bread Bin: weapon hits burn back the creep they land on or beside.
    if (this.stage.creep && key !== 'burn' && key !== 'crumb') this.hz.bin.burnAt(e.x, e.y, dmg);
    if (e.shield > 0) {
      // A Crouton Knight's shield takes half of every hit until it has soaked up enough, then cracks off.
      const soak = dmg * 0.5;
      dmg -= soak;
      e.shield -= soak;
      if (e.shield <= 0) this.foes.shieldBreak(e);
    }
    e.hp -= dmg;
    if (key === 'burn') {
      // Burn ticks are quiet: no flash, no sound, so the orange glow stays visible.
      if (e.hp <= 0) this.foes.kill(e);
      return true;
    }
    e.kx += (kx * 1.5) / e.mass;
    e.ky += (ky * 1.5) / e.mass;
    e.flashUntil = this.now + 0.08;
    if (this.bagel.quirkId === 'spicy' && e.hp > 0 && dmg > 0) this.foes.maybeIgnite(e, dmg);
    if (fx) {
      hitSfx(fx);
      this.effects.hitSpark(e.x, e.y, fx);
    } else sfx('hit');
    if (dmg >= 30 && this.now - this.lastHitstop > 0.3) {
      this.lastHitstop = this.now;
      this.hitstop = 0.045;
    }
    if (e.hp <= 0) this.foes.kill(e);
    return true;
  }

  /** The visible world's size, in world units. */
  viewW(): number {
    return this.scale.width / S / ZOOM;
  }
  viewH(): number {
    return this.scale.height / S / ZOOM;
  }

  // ---------------------------------------------------------------- Stats & build

  recomputeStats(): void {
    const up = load().upgrades;
    const b = this.bagel;
    const t = (id: ToppingId) => this.toppings.get(id) ?? 0;
    const prevMax = this.stats.maxHp;
    this.stats = {
      damage: 1.3 * (1 + b.allStats + 0.06 * (up.dmg ?? 0) + 0.1 * t('oven') + 0.04 * t('honey')) * (1 + this.run.agedPct / 100),
      area: 1 + b.allStats + 0.1 * t('butter'),
      cooldown: 1 / (1 + 0.08 * t('caffeine')),
      speed: b.speed * (1 + b.allStats * 0.5 + 0.04 * (up.speed ?? 0) + 0.07 * t('glaze')),
      magnet: 62 * (1 + 0.15 * (up.magnet ?? 0) + 0.25 * t('salt')),
      // Every level reached adds a little max health (LEVEL_HP), and the gain heals by the same amount.
      maxHp: Math.round((b.hp + 10 * (up.hp ?? 0) + LEVEL_HP * (this.run.level - 1)) * (1 + b.allStats) * (1 + 0.15 * t('dough'))),
      proj: (t('honey') >= 1 ? 1 : 0) + (t('honey') >= 4 ? 1 : 0),
      dur: 1 + 0.15 * t('jam'),
      shot: 1 + 0.1 * t('oil'),
      xp: 1 + 0.05 * t('vanilla') + 0.03 * (up.proof ?? 0),
    };
    if (this.stats.maxHp > prevMax && this.player.hp > 0) this.player.hp += this.stats.maxHp - prevMax;
    this.player.maxHp = this.stats.maxHp;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  /** Lucky Seed ranks plus Everything Seasoning levels. */
  get luckNow(): number {
    return this.run.luck + (this.toppings.get('seasoning') ?? 0);
  }

  /** The bagel's starting weapon. Rainbow's Mix-in picks a random one from the weapons you've unlocked. */
  private startWeapon(): WeaponId {
    if (this.bagel.quirkId !== 'mixin') return this.bagel.weapon;
    const save = load();
    const open = (Object.keys(WEAPONS) as WeaponId[]).filter((id) => weaponOpen(save, id));
    return open[Math.floor(Math.random() * open.length)] ?? this.bagel.weapon;
  }

  /** A weapon that was merged away into a secret combo this run: it never comes back on cards. */
  private merged(id: WeaponId): boolean {
    return COMBOS.some((c) => c.drop === id && !!this.weaponOf(c.keep)?.combo);
  }

  /** Day-Old Bin: this card is binned for the rest of the run. Binning a weapon you don't own also bins its topping. */
  banish(c: Choice): void {
    const r = this.run;
    if (c.kind === 'wnew' || c.kind === 'wup') {
      r.banished.push(`w:${c.id}`);
      const top = WEAPONS[c.id as WeaponId].evolveWith;
      if (c.kind === 'wnew' && !this.toppings.has(top)) r.banished.push(`t:${top}`);
    } else if (c.kind === 'tnew' || c.kind === 'tup') r.banished.push(`t:${c.id}`);
    else return;
    r.banishes--;
    r.banishedN++;
  }

  addWeapon(id: WeaponId): void {
    this.weapons.push(createWeapon(this, id));
  }

  weaponOf(id: string): Weapon | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }

  /** Cards for a level-up: weighted toward what you own (more so with luck), never more than the bagel's card count. */
  choices(): Choice[] {
    const pool: { c: Choice; w: number }[] = [];
    const save = load();
    // Lucky Seed: cards for what you already own (the road to evolutions) come up more often.
    const own = 1 + 0.1 * this.luckNow;
    // Day-Old Bin: binned cards are gone for the rest of the run.
    const out0 = new Set(this.run.banished);
    for (const w of this.weapons) if (w.level < MAX_LEVEL && !w.evolved && !out0.has(`w:${w.def.id}`)) pool.push({ c: { kind: 'wup', id: w.def.id }, w: 1.4 * own });
    if (this.weapons.length < MAX_SLOTS)
      for (const id of Object.keys(WEAPONS) as WeaponId[]) if (!this.weaponOf(id) && weaponOpen(save, id) && !this.merged(id) && !out0.has(`w:${id}`)) pool.push({ c: { kind: 'wnew', id }, w: 1 });
    for (const [id, lv] of this.toppings) if (lv < MAX_LEVEL && !out0.has(`t:${id}`)) pool.push({ c: { kind: 'tup', id }, w: own });
    if (this.toppings.size < MAX_SLOTS)
      for (const [id, td] of Object.entries(TOPPINGS)) if (!this.toppings.has(id as ToppingId) && (!td.weapon || weaponOpen(save, td.weapon)) && !out0.has(`t:${id}`)) pool.push({ c: { kind: 'tnew', id }, w: 0.9 });
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

  applyChoice(c: Choice): void {
    switch (c.kind) {
      case 'wnew':
        this.addWeapon(c.id as WeaponId);
        break;
      case 'wup':
        this.weaponOf(c.id!)!.level++;
        break;
      case 'tnew':
        this.toppings.set(c.id as ToppingId, 1);
        if (c.id === 'dough') this.player.hp += 25;
        break;
      case 'tup':
        this.toppings.set(c.id as ToppingId, (this.toppings.get(c.id as ToppingId) ?? 0) + 1);
        if (c.id === 'dough') this.player.hp += 25;
        break;
      case 'heal':
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 30);
        this.run.healsTaken++;
        break;
      case 'coin':
        this.run.coins += 15;
        break;
    }
    this.recomputeStats();
  }

  gainXp(v: number): void {
    const r = this.run;
    r.xp += v * CROWD_XP * (this.quick ? QUICK_XP : 1) * (this.stage.xp ?? 1) * this.stats.xp;
    let levelled = false;
    while (r.xp >= r.xpNext) {
      r.xp -= r.xpNext;
      r.level++;
      r.xpNext = xpNeeded(r.level);
      r.pendingLevels++;
      levelled = true;
    }
    if (levelled) this.recomputeStats();
  }

  // ---------------------------------------------------------------- Main loop

  update(): void {
    // Use wall-clock delta (Phaser smooths/clamps its own), capped so a hitch never teleports enemies.
    const nowMs = performance.now();
    const dt = this.lastFrame ? Math.min((nowMs - this.lastFrame) / 1000, 0.05) : 1 / 60;
    this.lastFrame = nowMs;
    this.updateJoystickGfx();
    this.tutor.update(dt);
    if (this.paused) return;
    if (this.hitstop > 0) {
      // Freeze-frame on heavy hits sells the impact.
      this.hitstop -= dt;
      return;
    }
    const r = this.run;
    let slow = 1;
    if (r.slowT > 0) {
      // The boss just fell: half a second of slow motion, then (unless it's Endless) the run is won.
      r.slowT -= dt;
      slow = SLOWMO;
      this.tweens.timeScale = r.slowT > 0 ? SLOWMO : 1;
      if (r.slowT <= 0 && r.pendingWin) {
        this.renderWorld();
        this.endRun(true);
        return;
      }
    }
    const steps = DEBUG.speed;
    for (let i = 0; i < steps && !this.paused; i++) this.step(dt * slow);
    this.renderWorld();
    this.updateAudio();
  }

  /** Pick the music for the moment and play the low-health heartbeat. */
  private updateAudio(): void {
    if (this.paused === 'over') return;
    const st = this.stage;
    playMusic(this.foes.bossOut() ? st.music.boss : st.music.run);
    // The run theme builds: drums at 1:00, bass at 2:00, a little faster after 3:00.
    // Endless: a little faster every minute after 5:00.
    const extra = this.endless && this.stageT > 300 ? Math.min(0.2, ((this.stageT - 300) / 60) * 0.03) : 0;
    const boss = this.foes.boss;
    // The Stale King's theme steps up with his phases instead of with the clock.
    if (boss?.kind === 'king') setRunIntensity(Math.max(0, boss.phaseN - 1), 1 + 0.04 * Math.max(0, boss.phaseN - 1));
    else if (st.music.boss === 'king' && this.foes.bossOut()) setRunIntensity(0, 1);
    else setRunIntensity(this.stageT >= 120 ? 2 : this.stageT >= 60 ? 1 : 0, (this.stageT >= 180 ? 1.08 : 1) + extra);
    if (this.player.hp > 0 && this.player.hp / this.stats.maxHp < 0.25) sfx('heart');
  }

  /** One simulation step. The order matters: it is the order things happen in within a frame. */
  step(dt: number): void {
    this.now += dt;
    this.updatePlayer(dt);
    this.floor.tick(dt);
    if (this.floor.posts.length || this.floor.walls.length) this.floor.pushOut(this.player, this.player.radius);
    this.director.update(dt);
    this.foes.rebuildGrid();
    this.foes.update(dt);
    for (const w of this.weapons) w.update(dt);
    this.foes.compact();
    this.hz.update(dt);
    this.loot.update(dt);
    this.updateQuirk(dt);
    this.run.snapT -= dt;
    if (this.run.snapT <= 0) {
      this.run.snapT = 5;
      this.writeSnapshot();
    }
    if (this.run.pendingLevels > 0 && !this.paused) this.panels.openLevelUp();
  }

  /** One rolling can flattened a crowd. */
  strike(n: number): void {
    this.run.canBest = Math.max(this.run.canBest, n);
    this.hud.banner(`Strike! ${n} flattened`, CSS.gold, 22);
    sfx('gold');
  }

  writeSnapshot(): void {
    // Not in the moment between the boss falling and the win: that would save a run with no boss left to beat.
    if (this.run.pendingWin) return;
    writeSnapshot(this);
  }

  // ---------------------------------------------------------------- Bagel quirks

  private updateQuirk(dt: number): void {
    const p = this.player;
    const r = this.run;
    const q = this.bagel.quirkId;
    if (q === 'aged') {
      const pct = Math.min(AGE_MAX, Math.floor(this.stageT / AGE_STEP));
      if (pct !== r.agedPct) {
        r.agedPct = pct;
        this.recomputeStats();
      }
    }
    if (q === 'trail') {
      // Poppy: drop a seed mine every so often while moving.
      r.mineT -= dt;
      if (r.mineT <= 0 && Math.hypot(p.moveX, p.moveY) > 0.3) {
        r.mineT = 0.14;
        const img = this.img('mine', p.x, p.y, 4);
        r.mines.push({ img, x: p.x, y: p.y, life: 2.6 });
        if (r.mines.length > 40) r.mines.shift()!.img.destroy();
      }
      const dmg = 7 * this.stats.damage;
      for (let i = r.mines.length - 1; i >= 0; i--) {
        const m = r.mines[i];
        m.life -= dt;
        if (m.life < 0.5) m.img.setAlpha(m.life / 0.5);
        this.foes.query(m.x, m.y, 11 * this.stats.area, (e) => {
          this.hit(e, dmg, 0, 0, 'trail', 0.5);
        });
        if (m.life <= 0) {
          m.img.destroy();
          r.mines.splice(i, 1);
        }
      }
    } else if (q === 'aura') {
      // Onion Olly: tear-gas aura that slows and hurts.
      const rad = 58 * this.stats.area;
      if (!r.auraImg) {
        r.auraImg = this.img('puddle', p.x, p.y, 1).setTint(0xb7e36a).setAlpha(0.28);
      }
      r.auraImg.setPosition(p.x, p.y).setScale(((rad * 2) / 128) * (1 / S) * (1 + 0.04 * Math.sin(this.now * 5)));
      r.auraT -= dt;
      const tick = r.auraT <= 0;
      if (tick) r.auraT = 0.5;
      const dmg = 6 * this.stats.damage;
      this.foes.query(p.x, p.y, rad, (e) => {
        e.slowUntil = this.now + 0.3;
        if (tick) this.hit(e, dmg, 0, 0, '', 0);
      });
    }
  }

  // ---------------------------------------------------------------- The bagel

  private updatePlayer(dt: number): void {
    const p = this.player;
    const r = this.run;
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
    if (r.dashT > 0) {
      // Juicy Dash: a quick straight burst that ignores ice and melt.
      r.dashT -= dt;
      p.x += r.dashV.x * dt;
      p.y += r.dashV.y * dt;
      r.vel.x = r.dashV.x * 0.35;
      r.vel.y = r.dashV.y * 0.35;
      if (this.effects.particles < 120 && Math.random() < 0.6) this.effects.burst(p.x, p.y, 0x7d6fd0, 1, 14);
      // A smear of fading copies behind the dash.
      r.smearT -= dt;
      if (r.smearT <= 0 && this.effects.particles < 140) {
        r.smearT = 0.028;
        const im = this.effects.fx(p.sprite.texture.key, p.x, p.y, 49).setTint(0xb7a6ff).setAlpha(0.55);
        im.setScale(p.sprite.scaleX, p.sprite.scaleY);
        this.tweens.add({ targets: im, alpha: 0, duration: 220, onComplete: () => this.effects.done(im) });
      }
      if (this.stage.frost) this.updateFrost(dt, true);
      return;
    }
    const st = this.stage;
    if (!st.ice && !st.frost && !st.grease) {
      // The Bread Bin: creep slows the bagel while it stands in it.
      const sp = this.stats.speed * (st.creep && this.hz.bin.creepAt(p.x, p.y) ? CREEP_SLOW : 1);
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
      return;
    }
    // Freezer: frost slows you, and on ice you keep sliding for a moment when you change direction.
    const sp = this.stats.speed * (r.frozen ? FROST_SLOW : 1) * (this.hz.inMelt(p.x, p.y) ? MELT_SLOW : 1);
    const tx = mx * sp;
    const ty = my * sp;
    // Grease slicks (Toaster Oven) slide like ice; they live in the hazards' tempIce.
    const ice = st.ice || st.grease ? this.hz.iceAt(p.x, p.y) : false;
    if (ice && !r.onIce && st.ice) sfx('ice');
    r.onIce = ice;
    if (ice) {
      const kk = 1 - Math.exp(-ICE_GRIP * dt);
      r.vel.x += (tx - r.vel.x) * kk;
      r.vel.y += (ty - r.vel.y) * kk;
    } else {
      r.vel.x = tx;
      r.vel.y = ty;
    }
    p.x += r.vel.x * dt;
    p.y += r.vel.y * dt;
    if (st.frost) this.updateFrost(dt, len > 0.1 || Math.hypot(r.vel.x, r.vel.y) > 20);
  }

  /** Frost builds while you stand still and melts while you move. */
  private updateFrost(dt: number, moving: boolean): void {
    const r = this.run;
    if (this.now < r.mugUntil) {
      r.frost = 0;
      r.frozen = false;
      r.stillT = 0;
      return;
    }
    if (moving) {
      r.stillT = 0;
      r.frost = Math.max(0, r.frost - dt / (r.frozen ? THAW_TIME : 1));
      if (r.frost === 0 && r.frozen) {
        r.frozen = false;
        this.player.sprite.clearTint();
      }
      return;
    }
    r.stillT += dt;
    if (r.stillT < FROST_DELAY) return;
    if (r.frost === 0) sfx('frost');
    r.frost = Math.min(1, r.frost + dt / FROST_FILL);
    if (r.frost >= 1 && !r.frozen) {
      r.frozen = true;
      sfx('frost');
      this.hud.banner('Frozen! Keep moving, or grab a Warm Mug.', '#bfe6fb', 16);
    }
  }

  damagePlayer(d: number): void {
    const p = this.player;
    const r = this.run;
    if (DEBUG.god || this.paused || r.pendingWin || this.now < p.invulnUntil) return;
    if (this.crispy) d *= CRISPY_DMG;
    // Hard Crust blocks 1 per rank, but a hit always does at least half.
    const armor = r.armor + (this.toppings.get('frosting') ?? 0);
    if (armor) d = Math.max(d * 0.5, d - armor);
    p.hp -= d;
    p.invulnUntil = this.now + HIT_GRACE;
    if (this.foes.boss) r.bossClean = false;
    shake(this, 110, 0.005);
    sfx('hurt');
    r.hurtAt = this.now;
    this.face.wince(0.4);
    // Shove nearby enemies away so there is room to escape.
    this.foes.query(p.x, p.y, 70, (e) => {
      if (e.boss) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dl = Math.hypot(dx, dy) || 1;
      e.kx += (dx / dl) * (320 / e.mass);
      e.ky += (dy / dl) * (320 / e.mass);
    });
    p.sprite.setTintFill(0xff5a4a);
    this.tweens.add({ targets: p.sprite, duration: 90, onComplete: () => p.sprite.clearTint() });
    if (p.hp <= 0 && r.reviveRank > 0 && !r.revived) {
      this.secondBake();
      return;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  /** Second Bake: come back once per run with some health, a moment of safety and room to move. */
  private secondBake(): void {
    const p = this.player;
    const r = this.run;
    r.revived = true;
    p.hp = Math.round(this.stats.maxHp * (0.2 + 0.1 * r.reviveRank));
    p.invulnUntil = this.now + 2;
    this.foes.query(p.x, p.y, 170, (e) => {
      if (e.boss) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dl = Math.hypot(dx, dy) || 1;
      e.kx += (dx / dl) * (900 / e.mass);
      e.ky += (dy / dl) * (900 / e.mass);
    });
    this.hz.clearShots();
    flash(this, 250, 255, 236, 190);
    this.effects.burst(p.x, p.y, 0xf8d38c, 18, 90);
    this.hud.banner('Second Bake!', CSS.gold, 26);
    sfx('evolve');
  }

  // ---------------------------------------------------------------- Drawing the world

  renderWorld(): void {
    const p = this.player;
    const base = 1 / S;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.1;
    const squash = moving ? 0.07 * Math.sin(this.now * 20) : 0.03 * Math.sin(this.now * 4);
    let sx = 1 - squash;
    let sy = 1 + squash;
    const r = this.run;
    // A hit flattens the bagel for a moment; a dash stretches it the way it's going.
    const hurt = Math.max(0, 1 - (this.now - r.hurtAt) / 0.22);
    if (hurt > 0) {
      sx *= 1 + 0.28 * hurt;
      sy *= 1 - 0.22 * hurt;
    }
    if (r.dashT > 0) {
      const dl = Math.hypot(r.dashV.x, r.dashV.y) || 1;
      const ax = Math.abs(r.dashV.x) / dl;
      const ay = Math.abs(r.dashV.y) / dl;
      sx *= 1 + 0.4 * ax - 0.22 * ay;
      sy *= 1 + 0.4 * ay - 0.22 * ax;
    }
    p.sprite.setPosition(p.x, p.y).setScale(base * sx, base * sy);
    this.face.look(p.moveX, p.moveY);
    p.sprite.setRotation(moving ? p.moveX * 0.12 : 0);
    p.sprite.setAlpha(this.now < p.invulnUntil ? (Math.floor(this.now * 20) % 2 ? 0.45 : 1) : 1);
    this.hpBg.setPosition(p.x, p.y + 22);
    this.hpFill.setPosition(p.x - 15, p.y + 22).setSize(30 * Math.max(0, p.hp / p.maxHp), 4);
    this.cameras.main.centerOn(p.x, p.y);
    this.floorTile.setPosition(Math.round(p.x / 256) * 256, Math.round(p.y / 256) * 256);
    this.hud.update();
    this.ambient.update();
    this.drawShadows();
    this.floor.update();
    this.drawFrost();
  }

  private drawShadows(): void {
    const g = this.shadowGfx;
    g.clear();
    const p = this.player;
    const hw = this.viewW() / 2 + 60;
    const hh = this.viewH() / 2 + 60;
    g.fillStyle(0x1a0f08, 0.28);
    g.fillEllipse(p.x, p.y + 15, 28, 8);
    for (const e of this.foes.list) {
      if (!e.alive || Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      if (e.kind === 'knife') continue; // knives fly, no shadow
      const r = e.radius;
      g.fillEllipse(e.x, e.y + r * 0.85, r * 2, r * 0.6);
    }
    for (const po of this.floor.posts) g.fillEllipse(po.x + 4, po.y + 13, 34, 10);
    for (const w of this.floor.walls) {
      if (w.life || Math.abs(w.x - p.x) > hw + w.hw || Math.abs(w.y - p.y) > hh + w.hh) continue;
      g.fillRect(w.x - w.hw + 3, w.y + w.hh - 2, w.hw * 2 + 2, 11);
    }
    for (const it of this.loot.list) {
      if (it.kind !== 'chest' && it.kind !== 'goldchest' && it.kind !== 'bun') continue;
      g.fillEllipse(it.x, it.y + 12, 24, 6);
    }
  }

  /** The frost ring around the bagel (Freezer), and Blueberry's dash ring. */
  private drawFrost(): void {
    const g = this.frostGfx;
    const r = this.run;
    g.clear();
    if (this.bagel.quirkId === 'dash') this.drawDashRing(g);
    if (!this.stage.frost) return;
    const p = this.player;
    if (r.frozen) p.sprite.setTint(0xa8dcff);
    if (r.frost <= 0) return;
    const rad = 21;
    g.lineStyle(5, 0x24160d, 0.9).strokeCircle(p.x, p.y, rad);
    g.lineStyle(3, 0x3d6f8f, 0.6).strokeCircle(p.x, p.y, rad);
    g.lineStyle(3.4, r.frozen ? 0xffffff : 0xbfe6fb, 1);
    g.beginPath();
    g.arc(p.x, p.y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r.frost, false);
    g.strokePath();
    if (r.frozen) g.fillStyle(0xbfe6fb, 0.25).fillCircle(p.x, p.y, rad);
  }

  /** Blueberry: a ring fills around the bagel while the dash recharges, then pops when it's ready. */
  private drawDashRing(g: Phaser.GameObjects.Graphics): void {
    const p = this.player;
    const r = this.run;
    const left = r.dashReadyAt - this.now;
    const rad = 26;
    if (left > 0 && r.dashT <= 0) {
      const frac = 1 - left / DASH_CD;
      g.lineStyle(4, 0x24160d, 0.6).strokeCircle(p.x, p.y, rad);
      g.lineStyle(2.6, 0x9d8fcf, 1);
      g.beginPath();
      g.arc(p.x, p.y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.strokePath();
    } else if (r.dashReadyAt > 0 && r.dashFlash < 0.35) {
      // Ready pulse
      if (r.dashFlash === 0) sfx('pop');
      r.dashFlash += 1 / 60;
      const k = r.dashFlash / 0.35;
      g.lineStyle(3, 0xd3c9f2, 1 - k).strokeCircle(p.x, p.y, rad + k * 10);
    }
  }

  private onResize(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.uiCam?.setSize(W, H);
    this.floorTile?.setSize(W / S / ZOOM + 640, H / S / ZOOM + 640);
    this.hud?.layout();
    this.ambient?.layout();
  }

  // ---------------------------------------------------------------- Input

  private setupInput(): void {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      unlockAudio();
      if (this.paused || over.length > 0 || this.joyId !== null) return;
      this.joyId = ptr.id;
      this.joyDownAt = performance.now();
      this.joyDown = { x: ptr.x, y: ptr.y };
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
      // A flick (a quick swipe and lift) is Blueberry's dash. Holding the thumb to steer never counts.
      const dx = ptr.x - this.joyDown.x;
      const dy = ptr.y - this.joyDown.y;
      if (performance.now() - this.joyDownAt < 250 && Math.hypot(dx, dy) > 30 * S) this.tryDash(dx, dy);
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
      kb.on('keydown-ESC', () => (this.paused ? undefined : this.panels.openPause()));
      kb.on('keydown-P', () => (this.paused ? undefined : this.panels.openPause()));
      kb.on('keydown-SPACE', () => this.tryDash(this.player.moveX, this.player.moveY));
    }
  }

  /** Blueberry's Juicy Dash, in the flick's direction (or the way you face). */
  private tryDash(dx: number, dy: number): void {
    const r = this.run;
    if (this.bagel.quirkId !== 'dash' || this.paused || this.now < r.dashReadyAt || r.dashT > 0) return;
    const p = this.player;
    let l = Math.hypot(dx, dy);
    if (l < 0.01) {
      dx = p.faceX;
      dy = p.faceY;
      l = Math.hypot(dx, dy) || 1;
    }
    r.dashT = DASH_TIME;
    r.dashV = { x: (dx / l) * (DASH_DIST / DASH_TIME), y: (dy / l) * (DASH_DIST / DASH_TIME) };
    r.dashReadyAt = this.now + DASH_CD;
    r.dashFlash = 0;
    p.invulnUntil = Math.max(p.invulnUntil, this.now + DASH_TIME + 0.15);
    this.effects.burst(p.x, p.y, 0x9d8fcf, 8, 30);
    sfx('swoosh');
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

  // ---------------------------------------------------------------- Pausing

  setPaused(r: PauseReason): void {
    this.paused = r;
    muffleMusic(r === 'levelup' || r === 'pause' || r === 'chest');
    if (r) {
      this.releaseJoystick();
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }

  private onVisibility = (): void => {
    if (document.hidden) this.autoPause();
  };

  private autoPause(): void {
    if (!this.paused) this.panels.openPause();
  }

  // ---------------------------------------------------------------- End

  /** Dough this run is worth so far (the same formula endRun pays out). */
  runDough(victory: boolean): number {
    const r = this.run;
    const cleared = this.director.endlessCleared;
    // Quick Runs count time on the full-run schedule, then pay about 75% of a full run.
    let dough = (this.stageT / 60) * 10 + r.kills / 60 + r.coins;
    if (r.miniKilled) dough += 10;
    if (victory || cleared) dough += 40;
    // Endless: a bonus for every full minute after 5:00.
    if (this.endless && this.stageT > 300) dough += Math.floor((this.stageT - 300) / 60) * ENDLESS_DOUGH_MIN;
    return Math.round(dough * this.stage.dough * (this.quick ? QUICK_DOUGH : 1) * (this.crispy ? CRISPY_DOUGH : 1));
  }

  endRun(victory: boolean, quit = false): void {
    if (this.paused === 'over') return;
    const r = this.run;
    this.setPaused('over');
    if (quit) stopMusic();
    else playJingle(victory ? 'win' : 'stale');
    this.tweens.resumeAll();
    const save = load();
    const openBefore = playableStages(save);
    let dough = this.runDough(victory);
    // Practice runs are for testing builds and bosses: no rewards or unlocks.
    if (this.practice) dough = 0;
    save.dough += dough;
    if (!this.practice) save.totalKills += r.kills;
    // A Quick Run clear counts as surviving 3:00 for unlock goals.
    if (!this.practice) {
      const t = Math.max(Math.floor(this.now), this.quick && victory ? 180 : 0);
      save.bestTime = Math.max(save.bestTime, t);
      save.stageTime = { ...(save.stageTime ?? {}), [this.stage.id]: Math.max(save.stageTime?.[this.stage.id] ?? 0, t) };
    }
    clearRun();
    // An Endless run whose boss fell counts as a clear too.
    const cleared = victory || this.director.endlessCleared;
    if (cleared && !this.practice) {
      save.clears++;
      save.stageClears = { ...(save.stageClears ?? {}), [this.stage.id]: (save.stageClears?.[this.stage.id] ?? 0) + 1 };
      if (this.crispy) save.crispyClears = { ...(save.crispyClears ?? {}), [this.stage.id]: (save.crispyClears?.[this.stage.id] ?? 0) + 1 };
      if (r.healsTaken === 0) save.noHealClear = true;
    }
    if (!this.practice) {
      const rec = { ...(save.records ?? {}) };
      rec.kills = Math.max(rec.kills ?? 0, r.kills);
      rec.level = Math.max(rec.level ?? 1, r.level);
      rec.evos = Math.max(rec.evos ?? 0, r.evolutionsThisRun.length);
      if (r.canBest) rec.strike = Math.max(rec.strike ?? 0, r.canBest);
      if (r.creepBurned) rec.creep = Math.max(rec.creep ?? 0, r.creepBurned);
      if (r.banishedN) rec.banish = Math.max(rec.banish ?? 0, r.banishedN);
      if (this.endless) {
        rec.endless = Math.max(rec.endless ?? 0, Math.floor(this.now));
        rec.endlessBosses = Math.max(rec.endlessBosses ?? 0, this.director.bossRound);
      }
      save.records = rec;
      if (r.noHitBoss) save.noHitBoss = true;
    }
    if (!this.practice) {
      const beaten = new Set(save.beaten ?? []);
      if (r.miniKilled) beaten.add(this.stage.mini.kind);
      if (cleared) beaten.add(this.stage.boss.kind);
      save.beaten = [...beaten];
      save.mugs = (save.mugs ?? 0) + r.runMugs;
      save.coinsTotal = (save.coinsTotal ?? 0) + r.coinPickups;
    }
    const newUnlock = this.practice ? '' : checkUnlocks(save).join(', ');
    const newWeapon = this.practice ? '' : checkWeaponUnlocks(save).join(', ');
    const newBest = !this.practice && recordBest(
        save,
        this.bagel.id,
        { time: Math.floor(this.now), kills: r.kills, cleared, ...(this.endless ? { endless: true } : {}) },
        bestStage(this.stage.id, this.endless ? 'endless' : this.quick ? 'quick' : 'full', this.crispy),
      );
    // Challenges pay their Dough as soon as they're done.
    const goals = this.practice ? [] : claimGoals(save).map((g) => ({ name: g.name, reward: g.reward }));
    // A new save's menu opens as you go: the Bakery and Goals once the first real run is over.
    if (!this.practice) openMenu(save, 'bakery', 'goals');
    const firstClear = cleared && !this.practice && save.stageClears?.[this.stage.id] === 1;
    const opened = playableStages(save).filter((id) => !openBefore.includes(id));
    if (opened.length) save.stage = opened[0];
    persist();
    const result: RunResult = {
      victory,
      practice: this.practice,
      quick: this.quick,
      endless: this.endless,
      cleared,
      crispy: this.crispy,
      time: this.now,
      level: r.level,
      kills: r.kills,
      dough,
      bagel: this.bagel.id,
      stage: this.stage.id,
      newUnlock,
      newWeapon,
      newStage: opened.length ? stageById(opened[0]).name : '',
      newBest,
      evolutions: r.evolutionsThisRun.map((id) => WEAPONS[id as WeaponId].evoName),
      goals,
      combos: r.foundCombos,
      firstClear,
    };
    const p = this.player.sprite;
    const base = 1 / S;
    this.tweens.timeScale = 1;
    p.setAlpha(1).setRotation(0);
    if (victory) {
      // A happy hop and a spin.
      this.face.mood = 'happy';
      this.tweens.add({ targets: p, y: p.y - 26, duration: 210, ease: 'Quad.Out', yoyo: true, repeat: 1 });
      this.tweens.add({ targets: p, angle: 360, duration: 420, delay: 420, ease: 'Cubic.Out' });
      this.tweens.add({ targets: p, scaleX: base * 1.15, scaleY: base * 0.88, duration: 105, yoyo: true, repeat: 3 });
    } else if (!quit) {
      // Defeat: the bagel droops and goes flat.
      this.face.mood = 'sad';
      this.tweens.add({ targets: p, scaleX: base * 1.35, scaleY: base * 0.42, y: p.y + 7, duration: 520, ease: 'Bounce.Out' });
    }
    // A win holds for a moment so the hop is seen before the fade.
    const fade = () => {
      this.cameras.main.fadeOut(quit ? 200 : victory ? 650 : 900, 18, 12, 8);
      this.uiCam.fadeOut(quit ? 200 : victory ? 650 : 900, 18, 12, 8);
      // The first time the Stale King falls, the ending comic and the credits come before the results.
      const ending = cleared && this.stage.boss.kind === 'king' && !this.practice && !load().ending;
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => (ending ? this.scene.start('intro', { ending: true, result }) : this.scene.start('results', result)));
    };
    if (victory && !quit) this.time.delayedCall(600, fade);
    else fade();
  }
}

function defaultStats(): Stats {
  return { damage: 1, area: 1, cooldown: 1, speed: 140, magnet: 62, maxHp: 100, proj: 0, dur: 1, shot: 1, xp: 1 };
}

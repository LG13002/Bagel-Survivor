import Phaser from 'phaser';
import { COLORS, CSS, DEBUG, S, ZOOM, fmtTime, safeInsets } from '../config';
import { COUNTER_PROPS, FREEZER_PROPS, OVEN_PROPS, type PropDef } from '../floors';
import { rng } from '../art';
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
  stageById,
  type StageDef,
} from '../data';
import { Enemy, Player, type EnemyShot, type Hazard, type Pickup, type Stats } from '../entities';
import { bestStage, load, persist, recordBest } from '../save';
import { makeRunTextures } from '../textures';
import { button, drawPips, panel, pill, txt } from '../ui';
import { COMBO, createWeapon, type FxId, type Weapon, type World } from '../weapons';
import { hitSfx, muffleMusic, musicOn, setMusic, setSound, sfx, soundOn, unlockAudio, type Sfx } from '../sfx';
import { playJingle, playMusic, setRunIntensity, stopMusic } from '../music';
import { checkUnlocks, checkWeaponUnlocks, playableStages, weaponOpen } from '../progress';
import { claimGoals } from '../goals';
import { clearRun, loadRun, saveRun, type RunSnapshot } from '../runsave';

type PauseReason = '' | 'levelup' | 'pause' | 'chest' | 'over';

interface Choice {
  kind: 'wnew' | 'wup' | 'tnew' | 'tup' | 'heal' | 'coin';
  id?: string;
}

export interface RunResult {
  victory: boolean;
  practice: boolean;
  quick: boolean;
  /** Endless run (time survived is the score); cleared = its boss fell along the way. */
  endless?: boolean;
  cleared?: boolean;
  crispy?: boolean;
  time: number;
  level: number;
  kills: number;
  dough: number;
  bagel: string;
  stage: string;
  newUnlock: string;
  /** Names of weapons this run unlocked, or ''. */
  newWeapon: string;
  /** Name of a stage this run opened up, or ''. */
  newStage: string;
  newBest: boolean;
  evolutions: string[];
  /** Challenges finished this run, with the Dough each paid. */
  goals: { name: string; reward: number }[];
  /** The secret combo evolution was made this run. */
  combo?: boolean;
}

const CELL = 48;
const PROP_SETS: Record<StageDef['props'], PropDef[]> = { counter: COUNTER_PROPS, freezer: FREEZER_PROPS, oven: OVEN_PROPS };
/** Freezer frost: seconds standing still before frost starts, seconds to fill, slow when full. */
const FROST_DELAY = 2;
const FROST_FILL = 2;
const FROST_SLOW = 0.7;
/** Once frozen, it takes this many seconds of moving to thaw (a Warm Mug thaws at once). */
const THAW_TIME = 3.5;
/** How fast you steer on ice (lower = longer slides). */
const ICE_GRIP = 1.2;
const MUG_SAFE = 5;
/** Blueberry's Juicy Dash. */
const DASH_TIME = 0.18;
const DASH_DIST = 95;
const DASH_CD = 5;
/** Asiago ages: +1% damage every AGE_STEP seconds of the stage clock, up to AGE_MAX%. */
const AGE_STEP = 10;
const AGE_MAX = 30;
/** Ice Cream Scoop melt puddles slow you to this. */
const MELT_SLOW = 0.6;
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
const POST_R = 17;
/** The Broiler's flame lines. */
const BEAM_W = 30;
const BEAM_DMG = 14;
/** Jalapeño Cheddar's Spicy: chance per hit, burn time, and burn damage per tick as a share of the hit. */
const SPICY_CHANCE = 0.1;
const BURN_TIME = 3;
const BURN_TICK = 0.5;
const BURN_SHARE = 0.3;
interface Post {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
}
interface IcePatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  imgs: Phaser.GameObjects.Image[];
}
const KILL_SFX: Record<EnemyKind, Sfx> = {
  crumb: 'crunch', ant: 'crunch', mold: 'splat', moldling: 'splat', knife: 'clatter', elite: 'pop', croissant: 'pop', toaster: 'pop',
  fcrumb: 'crunch', sprinkle: 'crunch', icecube: 'shatter', popsicle: 'shatter', pophalf: 'crunch', peapod: 'splat', fmold: 'splat', fmoldling: 'splat',
  scoop: 'pop', fcroissant: 'pop', tyrantjr: 'pop', waffle: 'pop', wafflesq: 'crunch', fburn: 'pop',
  ember: 'crunch', btoast: 'crunch', hotsauce: 'splat', popcorn: 'popcorn', popbit: 'crunch', tot: 'clatter', wafflebit: 'crunch', mscoop: 'splat',
  muffin: 'pop', fburnt: 'shatter', flapjack: 'pop', broiler: 'pop',
};
/** Practice runs start at 2:30 with a head start of level-ups. */
const PRACTICE_START = 150;
const PRACTICE_LEVELS = 12;
/** Quick Run: the full run's schedule plays this much faster (5:00 squeezed into 3:00). */
const QUICK_PACE = 5 / 3;
const QUICK_XP = 1.6;
const QUICK_DOUGH = 0.75;
/** Extra Crispy (the hard toggle): more health on every enemy, faster spawns, more Dough. */
const CRISPY_HP = 1.4;
const CRISPY_SPAWN = 1.2;
const CRISPY_DOUGH = 1.5;
/** Everything that hurts you hits this much harder. Health and spawns alone barely moved damage taken (you're already
 * being hit about as often as the 0.9s hit immunity allows), so this carries most of Extra Crispy's extra danger. */
const CRISPY_DMG = 1.25;
/** Endless, after the first boss falls: elites more often, the mini-boss and the boss come back. */
const ENDLESS_ELITE_EVERY = 45;
const ENDLESS_MINI_EVERY = 120;
const ENDLESS_BOSS_EVERY = 180;
/** Each returning boss has this much more health than the last. */
const ENDLESS_BOSS_HP = 1.5;
/** Spawns get this much faster per minute after 5:00. */
const ENDLESS_SPAWN_RAMP = 0.1;
/** Dough per full minute survived after 5:00. */
const ENDLESS_DOUGH_MIN = 10;

export class GameScene extends Phaser.Scene implements World {
  player = new Player();
  stats: Stats = { damage: 1, area: 1, cooldown: 1, speed: 140, magnet: 62, maxHp: 100, proj: 0, dur: 1 };
  now = 0;

  private bagel!: BagelDef;
  private stage!: StageDef;
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
  private fxPool: Phaser.GameObjects.Image[] = [];

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
  /** Countertop props by chunk key, created near the camera and dropped when far away. */
  private propCenter = '';
  private propChunks = new Map<string, Phaser.GameObjects.Image[]>();
  private hpBg!: Phaser.GameObjects.Rectangle;
  private hpFill!: Phaser.GameObjects.Rectangle;

  // HUD
  private hud!: {
    xpBar: Phaser.GameObjects.Graphics;
    badge: Phaser.GameObjects.Graphics;
    level: Phaser.GameObjects.Text;
    timer: Phaser.GameObjects.Text;
    quickBadge: Phaser.GameObjects.Container;
    crispyBadge: Phaser.GameObjects.Container;
    kills: Phaser.GameObjects.Container;
    aged: Phaser.GameObjects.Container | null;
    pause: Phaser.GameObjects.Container;
    build: Phaser.GameObjects.Container;
    bossName: Phaser.GameObjects.Text;
    bossBg: Phaser.GameObjects.Rectangle;
    bossFill: Phaser.GameObjects.Rectangle;
  };
  private buildSig = '';
  private xpShown = 0;
  private xpBarW = 0;
  private overlay: Phaser.GameObjects.Container | null = null;
  /** Looping animations on the open panel, stopped when it closes. */
  private overlayTweens: Phaser.Tweens.Tween[] = [];
  private lastTimerSec = -1;
  private lastLevelShown = 0;
  private hitstop = 0;
  private lastHitstop = 0;
  private banners = 0;

  // Joystick
  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private joyGfx!: Phaser.GameObjects.Graphics;
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor() {
    super('game');
  }

  private practice = false;
  private quick = false;
  private endless = false;
  private crispy = false;
  /** Endless: the first boss has fallen and the run carries on. */
  private endlessCleared = false;
  private nextMini = 0;
  private nextBoss = 0;
  /** Endless: bosses beaten so far this run (each return has more health). */
  private bossRound = 0;
  /** Stage-schedule speed: 1 for a full run, QUICK_PACE for a Quick Run. */
  private pace = 1;
  private resume: RunSnapshot | null = null;
  private healsTaken = 0;
  /** No hits taken since the current boss arrived (for the no-hit challenge). */
  private bossClean = false;
  /** A boss fell this run without landing a hit. */
  private noHitBoss = false;
  /** Lox and Schmear was made this run (shown on the results screen). */
  private foundCombo = false;
  /** Bakery ranks read once per run: luck, Second Bake and Hard Crust. */
  private luck = 0;
  private reviveRank = 0;
  private revived = false;
  /** Warm Mugs picked up this run (they count toward Jam Jar Lob's unlock). */
  private runMugs = 0;
  private armor = 0;
  // Blueberry's dash and Asiago's age
  private dashT = 0;
  private dashV = { x: 0, y: 0 };
  private dashReadyAt = 0;
  private dashFlash = 0;
  private agedPct = 0;
  private joyDownAt = 0;
  private joyDown = { x: 0, y: 0 };
  private raisinKills = 0;
  private mines: { img: Phaser.GameObjects.Image; x: number; y: number; life: number }[] = [];
  private mineT = 0;
  private auraImg: Phaser.GameObjects.Image | null = null;
  private auraT = 0;
  private snapT = 0;
  // Freezer hazards
  private iceChunks = new Map<string, IcePatch[]>();
  private onIce = false;
  private vel = { x: 0, y: 0 };
  private stillT = 0;
  /** 0..1 frost ring; at 1 the bagel is frozen (slowed) until it walks it off. */
  private frost = 0;
  private frozen = false;
  private mugUntil = 0;
  private frostGfx!: Phaser.GameObjects.Graphics;
  // Freezer elites and boss
  private melts: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; life: number }[] = [];
  private warns: { x: number; y: number; a: number; t: number; n: number }[] = [];
  private freezes: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; t: number }[] = [];
  private tempIce: (IcePatch & { life: number })[] = [];
  private bossGfx!: Phaser.GameObjects.Graphics;
  private extrasDone = new Set<number>();
  // Toaster Oven hazards
  private postChunks = new Map<string, Post[]>();
  private posts: Post[] = [];
  private coils: { x: number; y: number; horiz: boolean; t: number; flare: number }[] = [];
  private greases: { img: Phaser.GameObjects.Image; x: number; y: number; t: number }[] = [];
  private sparks: { img: Phaser.GameObjects.Image; x: number; y: number; life: number; max: number; dmg: number; size: number }[] = [];
  /** The Broiler's flame lines: a warning glow, then a burst of fire along the line. */
  private beams: { x: number; y: number; a: number; t: number; burn: number }[] = [];
  private beamGfx!: Phaser.GameObjects.Graphics;
  private coilPatternN = 0;
  private coilNext = 0;
  private greaseNext = 0;
  private ovenGfx!: Phaser.GameObjects.Graphics;

  /** Where we are on the full run's schedule (the clock the director and music follow). */
  private get stageT(): number {
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
    this.endlessCleared = false;
    this.nextMini = 0;
    this.nextBoss = 0;
    this.bossRound = 0;
    this.pace = this.quick ? QUICK_PACE : 1;
    this.healsTaken = 0;
    this.bossClean = false;
    this.noHitBoss = false;
    this.foundCombo = false;
    this.raisinKills = 0;
    this.mines = [];
    this.mineT = 0;
    this.auraImg = null;
    this.auraT = 0;
    this.snapT = 0;
    this.iceChunks = new Map();
    this.postChunks = new Map();
    this.posts = [];
    this.onIce = false;
    this.vel = { x: 0, y: 0 };
    this.stillT = 0;
    this.frost = 0;
    this.frozen = false;
    this.mugUntil = 0;
    this.melts = [];
    this.warns = [];
    this.freezes = [];
    this.tempIce = [];
    this.player = new Player();
    this.now = (this.practice ? PRACTICE_START : DEBUG.start) / this.pace;
    this.enemies = [];
    this.bigs = [];
    this.pool = [];
    this.grid.clear();
    this.pickups = [];
    this.shots = [];
    this.hazards = [];
    this.weapons = [];
    this.toppings = new Map();
    this.propChunks = new Map();
    this.propCenter = '';
    this.particles = 0;
    this.fxPool = [];
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpNeeded(1);
    this.pendingLevels = 0;
    this.kills = 0;
    this.coins = 0;
    const up = load().upgrades;
    this.luck = up.luck ?? 0;
    this.reviveRank = up.revive ?? 0;
    this.revived = false;
    this.runMugs = 0;
    this.armor = up.armor ?? 0;
    this.dashT = 0;
    this.dashReadyAt = 0;
    this.dashFlash = 0;
    this.agedPct = 0;
    this.rerolls = 1 + (up.reroll ?? 0);
    this.paused = '';
    this.evolutionsThisRun = [];
    this.miniKilled = false;
    this.spawnT = 0.5;
    const t0 = this.stageT;
    this.nextWave = Math.max(RUN.miniBossAt, t0 + 20);
    this.nextAnts = Math.max(RUN.antsFrom, t0 + 10);
    this.nextElite = Math.max(RUN.eliteAt, Math.ceil(t0 / RUN.eliteEvery) * RUN.eliteEvery);
    this.miniSpawned = t0 > RUN.miniBossAt;
    this.extrasDone = new Set((this.stage.extras ?? []).map((x, i) => (x.at < t0 ? i : -1)));
    this.bossSpawned = false;
    this.boss = null;
    this.mini = null;
    this.overlay = null;
    this.overlayTweens = [];
    this.lastTimerSec = -1;
    this.lastLevelShown = 0;
    this.hitstop = 0;
    this.lastHitstop = 0;
    this.banners = 0;
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
    this.lastFrame = 0;
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

    this.floor = this.add.tileSprite(0, 0, 10, 10, this.stage.floor);
    this.floor.setTileScale(1 / S).setDepth(0);
    this.worldLayer.add(this.floor);
    // Soft contact shadows under everything that stands on the floor, redrawn each frame.
    this.shadowGfx = this.add.graphics().setDepth(2);
    this.worldLayer.add(this.shadowGfx);
    this.frostGfx = this.add.graphics().setDepth(53);
    this.worldLayer.add(this.frostGfx);
    this.bossGfx = this.add.graphics().setDepth(3);
    this.worldLayer.add(this.bossGfx);
    this.ovenGfx = this.add.graphics().setDepth(2.5);
    this.worldLayer.add(this.ovenGfx);
    this.beamGfx = this.add.graphics().setDepth(3.2);
    this.worldLayer.add(this.beamGfx);
    this.coils = [];
    this.greases = [];
    this.sparks = [];
    this.beams = [];
    this.coilPatternN = 0;
    // Oven hazards start a little into the run (real seconds, so Quick Runs aren't swamped).
    this.coilNext = this.now + 12;
    this.greaseNext = this.now + 20;

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
    this.addWeapon(this.startWeapon());
    if (this.resume) this.applySnapshot(this.resume);
    else if (this.practice) {
      this.pendingLevels = PRACTICE_LEVELS;
      this.level = 1 + PRACTICE_LEVELS;
      this.xpNext = xpNeeded(this.level);
    }
    this.onResize();
    if (!this.resume && (this.crispy || this.endless)) {
      const what = this.endless && this.crispy ? 'Endless, Extra Crispy!' : this.endless ? 'Endless: survive as long as you can!' : 'Extra Crispy: tougher enemies, more Dough!';
      this.time.delayedCall(400, () => this.banner(what, this.crispy ? '#ff9a5c' : CSS.gold, 20));
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
    this.cameras.main.fadeIn(250, 43, 33, 24);
  }

  // ---------------------------------------------------------------- World API

  img(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, tex).setScale(1 / S).setDepth(depth);
    im.setData('base', 1 / S);
    this.worldLayer.add(im);
    return im;
  }

  /**
   * A short-lived effect sprite (spark, crumb, trail dot). These come and go by the hundred, so finished
   * ones are kept and reused instead of being created and thrown away. Hand it back with `fxDone`.
   */
  private fx(tex: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    this.particles++;
    const im = this.fxPool.pop();
    if (!im) {
      const made = this.add.image(x, y, tex).setScale(1 / S).setDepth(depth);
      this.worldLayer.add(made);
      return made;
    }
    im.setTexture(tex).setPosition(x, y).setDepth(depth).setScale(1 / S).setRotation(0).setAlpha(1).setFlipX(false).clearTint();
    return im.setActive(true).setVisible(true);
  }

  private fxDone(im: Phaser.GameObjects.Image): void {
    this.particles--;
    im.setActive(false).setVisible(false);
    this.fxPool.push(im);
  }

  shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  playSfx(name: Sfx): void {
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

  hit(e: Enemy, dmg: number, kx: number, ky: number, key: string, cd: number, fx?: FxId): boolean {
    if (!e.alive) return false;
    if (key && cd > 0) {
      const last = e.hitCd.get(key);
      if (last !== undefined && this.now - last < cd) return false;
      e.hitCd.set(key, this.now);
    }
    e.hp -= dmg;
    if (key === 'burn') {
      // Burn ticks are quiet: no flash, no sound, so the orange glow stays visible.
      if (e.hp <= 0) this.killEnemy(e);
      return true;
    }
    e.kx += (kx * 1.5) / e.mass;
    e.ky += (ky * 1.5) / e.mass;
    e.flashUntil = this.now + 0.08;
    if (this.bagel.quirkId === 'spicy' && e.hp > 0 && dmg > 0 && Math.random() < SPICY_CHANCE) this.ignite(e, dmg);
    if (fx) {
      hitSfx(fx);
      this.hitSpark(e.x, e.y, fx);
    } else sfx('hit');
    if (dmg >= 30 && this.now - this.lastHitstop > 0.3) {
      this.lastHitstop = this.now;
      this.hitstop = 0.045;
    }
    if (e.hp <= 0) this.killEnemy(e);
    return true;
  }

  /** Spicy: set an enemy on fire. A new flame refreshes the timer and keeps the bigger burn. */
  private ignite(e: Enemy, dmg: number): void {
    const burning = e.burnUntil > this.now;
    if (!burning) {
      e.burnT = BURN_TICK;
      e.burnDmg = 0;
      sfx('ignite');
    }
    e.burnUntil = this.now + BURN_TIME;
    e.burnDmg = Math.max(e.burnDmg, 3, dmg * BURN_SHARE);
  }

  /** Burning enemies tick damage and show a flickering flame and a hot orange tint. */
  private updateBurn(e: Enemy, dt: number): void {
    const burning = e.burnUntil > this.now;
    if (burning) {
      e.burnT -= dt;
      if (!e.flame) e.flame = this.img('flame', e.x, e.y, 36);
      const f = e.flame;
      const flick = 1 + 0.18 * Math.sin(this.now * 31 + e.phase) + 0.1 * Math.sin(this.now * 53);
      const sc = Math.max(0.8, e.radius / 10) / S;
      f.setVisible(true).setPosition(e.x + e.radius * 0.35, e.y - e.radius * 0.55).setScale(sc * 0.9, sc * flick);
      if (this.particles < 100 && Math.random() < 0.08) this.burst(e.x, e.y - e.radius * 0.5, 0xff8a2a, 1, 14);
      if (e.burnT <= 0) {
        e.burnT += BURN_TICK;
        this.hit(e, e.burnDmg, 0, 0, 'burn', 0);
      }
    } else if (e.flame?.visible) e.flame.setVisible(false);
    if (burning !== e.burnShown) {
      e.burnShown = burning;
      if (!burning) e.sprite.clearTint();
    }
    if (burning && e.alive && e.flashUntil <= this.now) e.sprite.setTint(0xffa070);
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
      damage: 1.3 * (1 + b.allStats + 0.06 * (up.dmg ?? 0) + 0.1 * t('oven') + 0.04 * t('honey')) * (1 + this.agedPct / 100),
      area: 1 + b.allStats + 0.1 * t('butter'),
      cooldown: 1 / (1 + 0.08 * t('caffeine')),
      speed: b.speed * (1 + b.allStats * 0.5 + 0.04 * (up.speed ?? 0) + 0.07 * t('glaze')),
      magnet: 62 * (1 + 0.15 * (up.magnet ?? 0) + 0.25 * t('salt')),
      maxHp: Math.round((b.hp + 10 * (up.hp ?? 0)) * (1 + b.allStats) * (1 + 0.15 * t('dough'))),
      proj: (t('honey') >= 1 ? 1 : 0) + (t('honey') >= 4 ? 1 : 0),
      dur: 1 + 0.15 * t('jam'),
    };
    if (this.stats.maxHp > prevMax && this.player.hp > 0) this.player.hp += this.stats.maxHp - prevMax;
    this.player.maxHp = this.stats.maxHp;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  /** Lucky Seed ranks plus Everything Seasoning levels. */
  private get luckNow(): number {
    return this.luck + (this.toppings.get('seasoning') ?? 0);
  }

  /** The bagel's starting weapon. Rainbow's Mix-in picks a random one from the weapons you've unlocked. */
  private startWeapon(): WeaponId {
    if (this.bagel.quirkId !== 'mixin') return this.bagel.weapon;
    const save = load();
    const open = (Object.keys(WEAPONS) as WeaponId[]).filter((id) => weaponOpen(save, id));
    return open[Math.floor(Math.random() * open.length)] ?? this.bagel.weapon;
  }

  /** Lox and Schmear is in the build (Schmear Flood merged into the Lox). */
  private get comboDone(): boolean {
    return this.weapons.some((w) => w.combo);
  }

  private addWeapon(id: WeaponId): void {
    this.weapons.push(createWeapon(this, id));
  }

  private weaponOf(id: string): Weapon | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }

  private choices(): Choice[] {
    const pool: { c: Choice; w: number }[] = [];
    const save = load();
    // Lucky Seed: cards for what you already own (the road to evolutions) come up more often.
    const own = 1 + 0.1 * this.luckNow;
    for (const w of this.weapons) if (w.level < MAX_LEVEL && !w.evolved) pool.push({ c: { kind: 'wup', id: w.def.id }, w: 1.4 * own });
    if (this.weapons.length < MAX_SLOTS)
      for (const id of Object.keys(WEAPONS) as WeaponId[]) if (!this.weaponOf(id) && weaponOpen(save, id) && !(id === 'puddle' && this.comboDone)) pool.push({ c: { kind: 'wnew', id }, w: 1 });
    for (const [id, lv] of this.toppings) if (lv < MAX_LEVEL) pool.push({ c: { kind: 'tup', id }, w: own });
    if (this.toppings.size < MAX_SLOTS)
      for (const [id, td] of Object.entries(TOPPINGS)) if (!this.toppings.has(id as ToppingId) && (!td.weapon || weaponOpen(save, td.weapon))) pool.push({ c: { kind: 'tnew', id }, w: 0.9 });
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
    this.updateAudio();
  }

  /** Pick the music for the moment and play the low-health heartbeat. */
  private updateAudio(): void {
    if (this.paused === 'over') return;
    const st = this.stage;
    const boss = this.bigs.some((e) => e.alive && (e.kind === st.mini.kind || e.kind === st.boss.kind));
    playMusic(boss ? st.music.boss : st.music.run);
    // The run theme builds: drums at 1:00, bass at 2:00, a little faster after 3:00.
    // Endless: a little faster every minute after 5:00.
    const extra = this.endless && this.stageT > 300 ? Math.min(0.2, ((this.stageT - 300) / 60) * 0.03) : 0;
    setRunIntensity(this.stageT >= 120 ? 2 : this.stageT >= 60 ? 1 : 0, (this.stageT >= 180 ? 1.08 : 1) + extra);
    if (this.player.hp > 0 && this.player.hp / this.stats.maxHp < 0.25) sfx('heart');
  }

  private step(dt: number): void {
    this.now += dt;
    this.updatePlayer(dt);
    if (this.posts.length) this.pushOut(this.player, this.player.radius);
    this.director(dt);
    this.rebuildGrid();
    this.updateEnemies(dt);
    for (const w of this.weapons) w.update(dt);
    this.compactEnemies();
    this.updateShots(dt);
    this.updateHazards(dt);
    this.updateFreezerHazards(dt);
    this.updateOvenHazards(dt);
    this.updateBeams(dt);
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
    if (q === 'aged') {
      const pct = Math.min(AGE_MAX, Math.floor(this.stageT / AGE_STEP));
      if (pct !== this.agedPct) {
        this.agedPct = pct;
        this.recomputeStats();
      }
    }
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
        this.query(m.x, m.y, 11 * this.stats.area, (e) => {
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
      stage: this.stage.id,
      practice: this.practice,
      quick: this.quick,
      endless: this.endless,
      crispy: this.crispy,
      endlessCleared: this.endlessCleared,
      nextMini: this.nextMini,
      nextBoss: this.nextBoss,
      bossRound: this.bossRound,
      now: this.now,
      level: this.level,
      xp: this.xp,
      pendingLevels: this.pendingLevels,
      hp: this.player.hp,
      weapons: this.weapons.map((w) => ({ id: w.def.id, level: w.level, evolved: w.evolved, ...(w.combo ? { combo: true } : {}) })),
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
      bossClean: this.bossClean,
      noHitBoss: this.noHitBoss,
      revived: this.revived,
      mugs: this.runMugs,
      buns: this.pickups.filter((it) => it.kind === 'bun').length,
      extras: [...this.extrasDone].filter((i) => i >= 0),
      elites: this.enemies.filter((e) => e.alive && e.dropsChest && e !== this.mini && e !== this.boss).map((e) => ({ kind: e.kind, hp: e.hp, bun: e.dropsBun })),
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
      wp.combo = !!w.combo;
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
    this.endlessCleared = !!s.endlessCleared;
    this.nextMini = s.nextMini ?? 0;
    this.nextBoss = s.nextBoss ?? 0;
    this.bossRound = s.bossRound ?? 0;
    this.evolutionsThisRun = s.evolutions;
    this.healsTaken = s.healsTaken;
    this.noHitBoss = !!s.noHitBoss;
    this.revived = !!s.revived;
    this.runMugs = s.mugs ?? 0;
    // Surprise elites that already came stay done (older snapshots: judged by the clock), and elites that were out come back.
    this.extrasDone = new Set(s.extras ?? (this.stage.extras ?? []).map((x, i) => (x.at < this.stageT ? i : -1)));
    for (const el of s.elites ?? []) {
      if (!ENEMIES[el.kind as EnemyKind]) continue;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(el.kind as EnemyKind, sp.x, sp.y, 1);
      if (e) {
        e.hp = Math.min(e.maxHp, el.hp);
        e.dropsChest = true;
        e.dropsBun = el.bun;
      }
    }
    for (let i = 0; i < (s.buns ?? 0); i++) this.dropPickup('bun', this.player.x + 60 + i * 30, this.player.y, 1);
    this.recomputeStats();
    this.player.hp = Math.min(this.stats.maxHp, s.hp);
    if (s.miniHp > 0) {
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(this.stage.mini.kind, sp.x, sp.y, 1);
      if (e) {
        e.hp = s.miniHp;
        e.dropsChest = true;
        e.dropsBun = true;
        this.mini = e;
      }
    }
    if (s.bossHp > 0) {
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(this.stage.boss.kind, sp.x, sp.y, 1);
      if (e) {
        e.maxHp *= Math.pow(ENDLESS_BOSS_HP, this.bossRound);
        e.hp = s.bossHp;
        e.boss = true;
        e.attack2T = 4;
        this.boss = e;
        this.bossClean = !!s.bossClean;
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
    if (this.dashT > 0) {
      // Juicy Dash: a quick straight burst that ignores ice and melt.
      this.dashT -= dt;
      p.x += this.dashV.x * dt;
      p.y += this.dashV.y * dt;
      this.vel.x = this.dashV.x * 0.35;
      this.vel.y = this.dashV.y * 0.35;
      if (this.particles < 120 && Math.random() < 0.6) this.burst(p.x, p.y, 0x7d6fd0, 1, 14);
      if (this.stage.frost) this.updateFrost(dt, true);
      return;
    }
    const st = this.stage;
    if (!st.ice && !st.frost && !st.grease) {
      p.x += mx * this.stats.speed * dt;
      p.y += my * this.stats.speed * dt;
      return;
    }
    // Freezer: frost slows you, and on ice you keep sliding for a moment when you change direction.
    const sp = this.stats.speed * (this.frozen ? FROST_SLOW : 1) * (this.inMelt(p.x, p.y) ? MELT_SLOW : 1);
    const tx = mx * sp;
    const ty = my * sp;
    // Grease slicks (Toaster Oven) slide like ice; they live in tempIce.
    const ice = st.ice || st.grease ? this.iceAt(p.x, p.y) : false;
    if (ice && !this.onIce && st.ice) sfx('ice');
    this.onIce = ice;
    if (ice) {
      const k = 1 - Math.exp(-ICE_GRIP * dt);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.y += (ty - this.vel.y) * k;
    } else {
      this.vel.x = tx;
      this.vel.y = ty;
    }
    p.x += this.vel.x * dt;
    p.y += this.vel.y * dt;
    if (st.frost) this.updateFrost(dt, len > 0.1 || Math.hypot(this.vel.x, this.vel.y) > 20);
  }

  /** Frost builds while you stand still and melts while you move. */
  private updateFrost(dt: number, moving: boolean): void {
    if (this.now < this.mugUntil) {
      this.frost = 0;
      this.frozen = false;
      this.stillT = 0;
      return;
    }
    if (moving) {
      this.stillT = 0;
      this.frost = Math.max(0, this.frost - dt / (this.frozen ? THAW_TIME : 1));
      if (this.frost === 0 && this.frozen) {
        this.frozen = false;
        this.player.sprite.clearTint();
      }
      return;
    }
    this.stillT += dt;
    if (this.stillT < FROST_DELAY) return;
    if (this.frost === 0) sfx('frost');
    this.frost = Math.min(1, this.frost + dt / FROST_FILL);
    if (this.frost >= 1 && !this.frozen) {
      this.frozen = true;
      sfx('frost');
      this.banner('Frozen! Keep moving, or grab a Warm Mug.', '#bfe6fb', 16);
    }
  }

  /** Is this point on an ice patch? Only patches near the camera exist. */
  private iceAt(x: number, y: number): boolean {
    for (const list of this.iceChunks.values())
      for (const ip of list) {
        const dx = (x - ip.x) / ip.rx;
        const dy = (y - ip.y) / ip.ry;
        if (dx * dx + dy * dy < 1) return true;
      }
    for (const ip of this.tempIce) {
      const dx = (x - ip.x) / ip.rx;
      const dy = (y - ip.y) / ip.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  private inMelt(x: number, y: number): boolean {
    for (const m of this.melts) {
      const dx = (x - m.x) / m.r;
      const dy = (y - m.y) / (m.r * 0.66);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  private drawFrost(): void {
    const g = this.frostGfx;
    g.clear();
    if (this.bagel.quirkId === 'dash') this.drawDashRing(g);
    if (!this.stage.frost) return;
    const p = this.player;
    if (this.frozen) p.sprite.setTint(0xa8dcff);
    if (this.frost <= 0) return;
    const r = 21;
    g.lineStyle(5, 0x24160d, 0.9).strokeCircle(p.x, p.y, r);
    g.lineStyle(3, 0x3d6f8f, 0.6).strokeCircle(p.x, p.y, r);
    g.lineStyle(3.4, this.frozen ? 0xffffff : 0xbfe6fb, 1);
    g.beginPath();
    g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.frost, false);
    g.strokePath();
    if (this.frozen) g.fillStyle(0xbfe6fb, 0.25).fillCircle(p.x, p.y, r);
  }

  /** Blueberry: a ring fills around the bagel while the dash recharges, then pops when it's ready. */
  private drawDashRing(g: Phaser.GameObjects.Graphics): void {
    const p = this.player;
    const left = this.dashReadyAt - this.now;
    const r = 26;
    if (left > 0 && this.dashT <= 0) {
      const frac = 1 - left / DASH_CD;
      g.lineStyle(4, 0x24160d, 0.6).strokeCircle(p.x, p.y, r);
      g.lineStyle(2.6, 0x9d8fcf, 1);
      g.beginPath();
      g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.strokePath();
    } else if (this.dashReadyAt > 0 && this.dashFlash < 0.35) {
      // Ready pulse
      if (this.dashFlash === 0) sfx('pop');
      this.dashFlash += 1 / 60;
      const k = this.dashFlash / 0.35;
      g.lineStyle(3, 0xd3c9f2, 1 - k).strokeCircle(p.x, p.y, r + k * 10);
    }
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
    this.floor.setPosition(Math.round(p.x / 256) * 256, Math.round(p.y / 256) * 256);
    this.updateHud();
    this.drawArrows();
    this.drawShadows();
    this.updateProps();
    this.drawFrost();
  }

  /** Scatter countertop props in 384px world chunks. Each chunk is seeded by its coordinates,
   *  so the same spot always shows the same props and nothing repeats on a grid. */
  private updateProps(): void {
    const C = 384;
    const p = this.player;
    const rx = Math.ceil((this.viewW() / 2 + 160) / C);
    const ry = Math.ceil((this.viewH() / 2 + 160) / C);
    const pcx = Math.floor(p.x / C);
    const pcy = Math.floor(p.y / C);
    const key0 = `${pcx},${pcy}`;
    if (this.propCenter === key0) return;
    this.propCenter = key0;
    const keep = new Set<string>();
    const props = PROP_SETS[this.stage.props];
    const total = props.reduce((a, d) => a + d.weight, 0);
    for (let cx = pcx - rx; cx <= pcx + rx; cx++)
      for (let cy = pcy - ry; cy <= pcy + ry; cy++) {
        const key = `${cx},${cy}`;
        keep.add(key);
        if (this.propChunks.has(key)) continue;
        const h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0;
        const rand = rng((h % 2147483646) + 1);
        rand();
        rand();
        const n = rand() < 0.35 ? 2 : 3;
        const list: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < n; i++) {
          let r = rand() * total;
          let def = props[0];
          for (const d of props) {
            r -= d.weight;
            if (r <= 0) {
              def = d;
              break;
            }
          }
          // Each prop gets its own horizontal band of the chunk so they rarely overlap.
          const x = (cx + 0.15 + rand() * 0.7) * C;
          const y = (cy + (i + 0.2 + rand() * 0.6) / n) * C;
          const im = this.img(def.key, x, y, 1);
          im.setRotation(def.spin ? rand() * Math.PI * 2 : (rand() - 0.5) * 0.4);
          list.push(im);
        }
        this.propChunks.set(key, list);
        if (this.stage.ice) this.iceChunks.set(key, this.makeIce(cx, cy, C));
        if (this.stage.posts) this.postChunks.set(key, this.makePosts(cx, cy, C));
      }
    for (const [key, list] of this.propChunks)
      if (!keep.has(key)) {
        for (const im of list) im.destroy();
        this.propChunks.delete(key);
        for (const ip of this.iceChunks.get(key) ?? []) {
          // The twinkles loop forever: stop their animations along with them.
          this.tweens.killTweensOf(ip.imgs);
          ip.imgs.forEach((im) => im.destroy());
        }
        this.iceChunks.delete(key);
        for (const po of this.postChunks.get(key) ?? []) po.img.destroy();
        this.postChunks.delete(key);
      }
    if (this.stage.posts) this.posts = [...this.postChunks.values()].flat();
  }

  /** Seeded rack posts (drawn as oven knobs) for one floor chunk: about 1 on average, never near where a run starts. */
  private makePosts(cx: number, cy: number, C: number): Post[] {
    const h = (Math.imul(cx, 49979687) ^ Math.imul(cy, 1500450271)) >>> 0;
    const rand = rng((h % 2147483646) + 1);
    rand();
    const r = rand();
    const n = r < 0.2 ? 2 : r < 0.8 ? 1 : 0;
    const out: Post[] = [];
    for (let i = 0; i < n; i++) {
      const x = (cx + 0.15 + rand() * 0.7) * C;
      const y = (cy + (i + 0.2 + rand() * 0.6) / Math.max(1, n)) * C;
      if (Math.hypot(x, y) < 240) continue;
      out.push({ x, y, img: this.img('post', x, y, 29) });
    }
    return out;
  }

  /** Slide something out of any rack post it overlaps. */
  private pushOut(o: { x: number; y: number }, r: number): void {
    for (const po of this.posts) {
      const dx = o.x - po.x;
      const dy = o.y - po.y;
      const rr = r + POST_R;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01;
      o.x = po.x + (dx / d) * rr;
      o.y = po.y + (dy / d) * rr;
    }
  }

  /** Seeded ice patches for one floor chunk: 0 to 2, never near where a run starts. */
  private makeIce(cx: number, cy: number, C: number): IcePatch[] {
    const h = (Math.imul(cx, 83492791) ^ Math.imul(cy, 2971215073)) >>> 0;
    const rand = rng((h % 2147483646) + 1);
    rand();
    const n = rand() < 0.45 ? 1 : rand() < 0.3 ? 2 : 0;
    const out: IcePatch[] = [];
    for (let i = 0; i < n; i++) {
      const rx = 80 + rand() * 60;
      const ry = rx * (0.6 + rand() * 0.2);
      const x = (cx + 0.2 + rand() * 0.6) * C;
      const y = (cy + 0.2 + rand() * 0.6) * C;
      if (Math.hypot(x, y) < 170 + rx) continue;
      const base = this.img('ice_patch', x, y, 1.5);
      base.setScale((rx * 2) / 200 / S, (ry * 2) / 120 / S);
      const imgs = [base];
      for (let k = 0; k < 3; k++) {
        const tw = this.img('twinkle', x + (rand() - 0.5) * rx * 1.2, y + (rand() - 0.5) * ry * 1.1, 1.6);
        tw.setScale(0.2 / S);
        this.tweens.add({ targets: tw, scale: { from: 0.2 / S, to: 1.1 / S }, alpha: { from: 0.3, to: 1 }, duration: 700 + k * 230, yoyo: true, repeat: -1, delay: k * 300, ease: 'Sine.InOut' });
        imgs.push(tw);
      }
      out.push({ x, y, rx, ry, imgs });
    }
    return out;
  }

  private drawShadows(): void {
    const g = this.shadowGfx;
    g.clear();
    const p = this.player;
    const hw = this.viewW() / 2 + 60;
    const hh = this.viewH() / 2 + 60;
    g.fillStyle(0x1a0f08, 0.28);
    g.fillEllipse(p.x, p.y + 15, 28, 8);
    for (const e of this.enemies) {
      if (!e.alive || Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      if (e.kind === 'knife') continue; // knives fly, no shadow
      const r = e.radius;
      g.fillEllipse(e.x, e.y + r * 0.85, r * 2, r * 0.6);
    }
    for (const po of this.posts) g.fillEllipse(po.x + 4, po.y + 13, 34, 10);
    for (const it of this.pickups) {
      if (it.kind !== 'chest' && it.kind !== 'goldchest' && it.kind !== 'bun') continue;
      g.fillEllipse(it.x, it.y + 12, 24, 6);
    }
  }

  // ---------------------------------------------------------------- Director

  private viewW(): number {
    return this.scale.width / S / ZOOM;
  }
  private viewH(): number {
    return this.scale.height / S / ZOOM;
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
    const mix = this.stage.mix;
    const table = (mix.find((m) => t < m.until) ?? mix[mix.length - 1]).table;
    let r = Math.random() * table.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return table[0][0];
  }

  /** Health multiplier for regular enemies at stage time t. */
  private hpMult(t: number): number {
    return this.stage.hpBonus * (1 + t / this.stage.hpGrowth);
  }

  private director(dt: number): void {
    const st = this.stage;
    const t = this.stageT;
    const hpMult = this.hpMult(t);
    let interval = Math.max(0.1, 0.7 - t * 0.0018) / st.spawnRate / (this.crispy ? CRISPY_SPAWN : 1);
    // Endless: about 10% faster spawns for every minute after 5:00.
    if (this.endless && t > 300) interval /= 1 + ENDLESS_SPAWN_RAMP * ((t - 300) / 60);
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
    // Endless: a wave that comes due while the boss is out is skipped, not saved up for when it falls.
    if (this.endlessCleared && this.boss && t >= this.nextWave) this.nextWave += RUN.waveEvery;
    if (t >= RUN.miniBossAt && t >= this.nextWave && (t < RUN.bossAt - 5 || (this.endlessCleared && !this.boss))) {
      this.nextWave += RUN.waveEvery;
      const n = 28;
      const d = Math.hypot(this.viewW(), this.viewH()) / 2 + 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy(st.wave.kinds[i % 2], this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, hpMult);
      }
      this.banner(st.wave.banner, CSS.cream, 18);
    }
    // Lines pause while a boss is out; the ones that came due are skipped.
    if (st.lines && t >= this.nextAnts && this.boss) this.nextAnts += RUN.antsEvery;
    if (st.lines && t >= this.nextAnts && !this.boss) {
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
        const e = this.spawnEnemy(st.lines, x, y, hpMult);
        if (e) {
          e.vx = dx * e.speed;
          e.vy = dy * e.speed;
        }
      }
    }
    if (t >= this.nextElite && (t < RUN.bossAt || this.endlessCleared)) {
      const el = this.endlessCleared
        ? st.elites[Math.floor(Math.random() * st.elites.length)]
        : st.elites[Math.max(0, Math.round((this.nextElite - RUN.eliteAt) / RUN.eliteEvery)) % st.elites.length];
      this.nextElite += this.endlessCleared ? ENDLESS_ELITE_EVERY : RUN.eliteEvery;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(el.kind, sp.x, sp.y, 1);
      if (e) {
        e.dropsChest = true;
        // Full runs: the last Giant Mold before the boss carries the second Sticky Bun.
        if (!this.quick && !this.endlessCleared && t >= RUN.bossAt - RUN.eliteEvery) e.dropsBun = true;
      }
      this.banner(el.banner, el.color, 20);
    }
    if (st.extras && !this.bossSpawned) {
      st.extras.forEach((x, i) => {
        if (t < x.at || this.extrasDone.has(i)) return;
        this.extrasDone.add(i);
        const sp = this.spawnPoint();
        const e = this.spawnEnemy(x.kind, sp.x, sp.y, 1);
        if (e) e.dropsChest = true;
        this.banner(x.banner, x.color, 20);
      });
    }
    if (this.endlessCleared && !this.mini && t >= this.nextMini) {
      this.nextMini = t + ENDLESS_MINI_EVERY;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(st.mini.kind, sp.x, sp.y, 1);
      if (e) {
        e.dropsChest = true;
        e.dropsBun = true;
        this.mini = e;
      }
      this.banner(`${st.mini.name} is back!`, CSS.gold, 24);
    }
    if (this.endlessCleared && !this.boss && t >= this.nextBoss) {
      this.nextBoss = t + ENDLESS_BOSS_EVERY;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(st.boss.kind, sp.x, sp.y, 1);
      if (e) {
        e.maxHp = e.hp = e.maxHp * Math.pow(ENDLESS_BOSS_HP, this.bossRound);
        e.boss = true;
        this.boss = e;
        this.bossClean = true;
        e.attack2T = 4;
      }
      this.banner(`${st.boss.name} returns, tougher!`, CSS.red, 26);
      sfx('roar');
      sfx('boss');
      this.cameras.main.shake(400, 0.006);
    }
    if (!this.miniSpawned && t >= RUN.miniBossAt) {
      this.miniSpawned = true;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(st.mini.kind, sp.x, sp.y, 1);
      if (e) {
        e.dropsChest = true;
        e.dropsBun = true;
        this.mini = e;
      }
      this.banner(st.mini.banner, CSS.gold, 26);
    }
    if (!this.bossSpawned && t >= RUN.bossAt) {
      this.bossSpawned = true;
      const sp = this.spawnPoint();
      const e = this.spawnEnemy(st.boss.kind, sp.x, sp.y, 1);
      if (e) {
        e.boss = true;
        this.boss = e;
        this.bossClean = true;
        e.attack2T = 4;
      }
      if (st.boss.card) {
        this.bossCard(st.boss.name, st.boss.card);
        sfx('roar');
      } else this.banner(st.boss.banner, CSS.red, 30);
      sfx('boss');
      this.cameras.main.shake(400, 0.006);
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, hpMult: number): Enemy | null {
    const def = ENEMIES[kind];
    // The Cookbook's Enemies tab: the first sighting reveals it.
    const save = load();
    if (!save.met?.includes(kind)) {
      save.met = [...(save.met ?? []), kind];
      persist();
    }
    const special = !!def.flat;
    if (!special && this.enemies.length >= RUN.maxEnemies + 40) return null;
    const e = this.pool.pop() ?? new Enemy();
    if (!e.sprite) e.sprite = this.img(def.tex, x, y, 30);
    e.phase = Math.random() * Math.PI * 2;
    e.sprite.setTexture(def.tex).setVisible(true).setAlpha(1).setRotation(0).setFlipX(false);
    e.sprite.clearTint();
    const isBig = def.radius > 20;
    e.sprite.setScale(1 / S).setDepth(isBig ? 35 : 30);
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.maxHp = e.hp = def.hp * (def.flat ? 1 : hpMult) * (this.crispy ? CRISPY_HP : 1);
    e.speed = def.speed * (0.9 + Math.random() * 0.2);
    e.dmg = def.dmg * this.stage.dmg;
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
    e.hitCd.clear();
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

      const ai = ENEMIES[e.kind].ai;
      if (ENEMIES[e.kind].drip) {
        // Melting Scoop: small melt puddles behind it as it walks.
        e.attack2T -= dt;
        if (e.attack2T <= 0) {
          e.attack2T = 1.4;
          this.addMelt(e.x, e.y + e.radius * 0.5, false, 15, 3.5);
        }
      }
      if (e.burnUntil > 0) {
        this.updateBurn(e, dt);
        if (!e.alive) continue;
      }
      switch (ai === 'line' ? 'line' : ai === 'charge' ? 'charge' : ai === 'shoot' ? 'shoot' : e.kind) {
        case 'line':
          mvx = e.vx * slow;
          mvy = e.vy * slow;
          e.sprite.setRotation(e.kind === 'sprinkle' ? t * 8 : Math.atan2(e.vy, e.vx));
          break;
        case 'charge': {
          // Knives and ice cubes: close in, stop and wind up (flash), dash in a straight line, recover.
          const knife = e.kind === 'knife';
          const dash = ENEMIES[e.kind].dash ?? 430;
          e.stateT -= dt;
          if (e.state === 0) {
            if (knife) e.sprite.setRotation(Math.atan2(dy, dx));
            else {
              if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
              e.sprite.setRotation(Math.sin(t * 9 + e.phase) * 0.08);
            }
            if (dist < 190) {
              e.state = 1;
              e.stateT = knife ? 0.55 : 0.6;
              e.vx = (dx / dist) * dash;
              e.vy = (dy / dist) * dash;
            }
          } else if (e.state === 1) {
            mvx = mvy = 0;
            if (knife) e.sprite.setRotation(Math.atan2(e.vy, e.vx) + Math.sin(t * 60) * 0.12);
            else e.sprite.setRotation(Math.sin(t * 60) * 0.14);
            e.sprite.setTint(knife ? 0xff8a7a : 0xffffff);
            if (!knife && Math.floor(t * 16) % 2) e.sprite.setTintFill(0xffffff);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.5;
              e.sprite.clearTint();
            }
          } else if (e.state === 2) {
            mvx = e.vx * slow;
            mvy = e.vy * slow;
            // Burnt Toast flips end over end as it charges.
            if (e.kind === 'btoast') e.sprite.setRotation(e.sprite.rotation + dt * 16);
            if (e.stateT <= 0) {
              e.state = 3;
              e.stateT = 0.8;
              if (e.kind === 'btoast') e.sprite.setRotation(0);
            }
          } else {
            mvx *= 0.3;
            mvy *= 0.3;
            if (e.stateT <= 0) e.state = 0;
          }
          break;
        }
        case 'shoot':
          // Pea Pod: keeps its distance and lobs one big, slow pea.
          if (dist < 170) {
            mvx = -mvx * 0.6;
            mvy = -mvy * 0.6;
          } else if (dist < 230) {
            mvx *= 0.15;
            mvy *= 0.15;
          }
          if (Math.abs(dx) > 1) e.sprite.setFlipX(dx < 0);
          e.sprite.setRotation(Math.sin(t * 6 + e.phase) * 0.1);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            const shot = ENEMIES[e.kind].shot;
            e.attackT = shot?.every ?? 2.5;
            if (dist < 300) {
              const a = Math.atan2(dy, dx);
              if (shot) {
                // Hot Sauce Drop: a 3-shot spread of big red blobs.
                sfx('sauce');
                for (let i = 0; i < shot.n; i++) this.fireShot(shot.tex, e.x, e.y, a + (i - (shot.n - 1) / 2) * shot.spread, shot.speed, shot.dmg, shot.r);
              } else {
                sfx('pea');
                this.fireShot('pea', e.x, e.y, a, 120, 8, 7);
              }
            }
          }
          break;
        case 'croissant':
          e.sprite.setRotation(Math.sin(t * 3) * 0.25);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 1.7;
            sfx('flakes');
            const off = Math.random() * Math.PI;
            for (let i = 0; i < 10; i++) this.fireShot('flake', e.x, e.y, off + (i / 10) * Math.PI * 2, 130, 10, 6);
          }
          break;
        case 'toaster':
          e.sprite.setRotation(Math.sin(t * 6) * 0.06);
          // A toaster "ding" just before it fires, so you can react.
          if (e.attackT > 0.45 && e.attackT - dt <= 0.45) sfx('ding');
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
        case 'scoop':
          // Ice Cream Scoop: slow, and leaves melt puddles that slow you down.
          if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
          e.sprite.setRotation(Math.sin(t * 5 + e.phase) * 0.08);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 0.55;
            this.addMelt(e.x, e.y + e.radius * 0.45, dist < 320);
          }
          break;
        case 'fcroissant':
          e.sprite.setRotation(Math.sin(t * 3) * 0.25);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 2;
            sfx('flakes');
            const off = Math.random() * Math.PI;
            for (let i = 0; i < 7; i++) this.fireShot('flake', e.x, e.y, off + (i / 7) * Math.PI * 2, 120, 9, 6);
          }
          break;
        case 'tyrantjr':
          e.sprite.setRotation(Math.sin(t * 6) * 0.06);
          if (e.attackT > 0.45 && e.attackT - dt <= 0.45) sfx('ding');
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 2.6;
            const a = Math.atan2(dy, dx);
            for (let i = -2; i <= 2; i++) this.fireShot('toast', e.x, e.y, a + i * 0.22, 180, 12, 8);
          }
          break;
        case 'waffle': {
          // Frozen Waffle: shake and flash, charge in a straight line, three times, then rest.
          e.stateT -= dt;
          if (e.state === 0) {
            e.sprite.setRotation(Math.sin(t * 7 + e.phase) * 0.08);
            if (e.stateT <= 0 && dist < 420) {
              e.state = 1;
              e.stateT = 0.8;
            }
          } else if (e.state === 1) {
            mvx = mvy = 0;
            e.sprite.setRotation(Math.sin(t * 60) * 0.12);
            if (Math.floor(t * 16) % 2) e.sprite.setTintFill(0xffffff);
            else e.sprite.clearTint();
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.7;
              e.vx = (dx / dist) * 430;
              e.vy = (dy / dist) * 430;
              e.sprite.clearTint();
              sfx('charge');
            }
          } else if (e.state === 2) {
            mvx = e.vx * slow;
            mvy = e.vy * slow;
            e.sprite.setRotation(e.sprite.rotation + dt * 10);
            if (e.stateT <= 0) {
              e.sprite.setRotation(0);
              e.attack2T += 1;
              if (e.attack2T >= 3) {
                e.attack2T = 0;
                e.state = 3;
                e.stateT = 2.5;
              } else {
                e.state = 0;
                e.stateT = 0.45;
              }
            }
          } else {
            mvx *= 0.25;
            mvy *= 0.25;
            e.sprite.setRotation(Math.sin(t * 2) * 0.05);
            if (e.stateT <= 0) {
              e.state = 0;
              e.stateT = 1.2;
            }
          }
          break;
        }
        case 'fburn': {
          // The Freezer Burn. Phase 1: warned icicle volleys and pizza-slice fans.
          // Phase 2 (half health): faster volleys, frost circles that freeze the floor, rings of Frosted Crumbs.
          if (!e.enraged && e.hp < e.maxHp * 0.5) {
            e.enraged = true;
            e.attack2T = 1.5;
            e.stateT = 4;
            this.banner('The Freezer Burn is thawing out... and furious!', '#bfe6fb', 20);
            sfx('roar');
            this.cameras.main.shake(400, 0.007);
          }
          e.sprite.setRotation(Math.sin(t * 2) * 0.08 + (e.enraged ? Math.sin(t * 30) * 0.025 : 0));
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = e.enraged ? 1.9 : 2.6;
            e.state = (e.state + 1) % 3;
            const a = Math.atan2(dy, dx);
            if (e.state === 2) {
              sfx('flakes');
              for (let i = -3; i <= 3; i++) this.fireShot('slice', e.x, e.y, a + i * 0.18, 190, 12, 8);
            } else {
              const lines = e.enraged ? 5 : 3;
              const spread = e.enraged ? 0.3 : 0.4;
              for (let i = 0; i < lines; i++) {
                const la = a + (i - (lines - 1) / 2) * spread;
                this.warns.push({ x: e.x, y: e.y, a: la, t: 0.8, n: e.enraged ? 4 : 3 });
              }
            }
          }
          if (e.enraged) {
            e.attack2T -= dt;
            if (e.attack2T <= 0) {
              e.attack2T = 6;
              this.addFreeze(p.x, p.y);
              for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = 70 + Math.random() * 90;
                this.addFreeze(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
              }
            }
            e.stateT -= dt;
            if (e.stateT <= 0) {
              e.stateT = 9;
              const n = 16;
              const d = Math.hypot(this.viewW(), this.viewH()) / 2 + 30;
              for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                this.spawnEnemy('fcrumb', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, this.hpMult(this.stageT));
              }
            }
          }
          break;
        }
        case 'muffin':
          // Molten Muffin: slow, and leaves a short trail of fire behind it.
          if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
          e.sprite.setRotation(Math.sin(t * 5 + e.phase) * 0.08);
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 0.42;
            this.addSpark(e.x - (mvx / (e.speed || 1)) * 18, e.y + e.radius * 0.5, 2.2, 4, 1.25, false);
          }
          break;
        case 'fburnt': {
          // The Freezer Burn returns as a smaller, scorched elite. One warned icicle fan at a time.
          e.sprite.setRotation(Math.sin(t * 2.5 + e.phase) * 0.08);
          e.attackT -= dt;
          if (e.attackT <= 0 && dist < 520) {
            e.attackT = 3.2;
            const a = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) this.warns.push({ x: e.x, y: e.y, a: a + i * 0.42, t: 0.9, n: 2 });
          }
          break;
        }
        case 'flapjack': {
          // Flapjack Stack: throws spinning pancakes. Every fifth of its health it loses a pancake,
          // flinging it as a ring of discs, and gets shorter and faster.
          const layers = Math.max(1, Math.ceil((e.hp / e.maxHp) * 5));
          // attack2T holds the pancakes shown (0 on spawn or after a resume: set it without the ring).
          const lost = e.attack2T > 0 && layers < e.attack2T;
          if (layers !== e.attack2T) {
            e.attack2T = layers;
            e.sprite.setTexture(`en_flap${layers}`);
            e.speed = ENEMIES.flapjack.speed * (1 + 0.14 * (5 - layers));
            e.radius = ENEMIES.flapjack.radius - (5 - layers) * 2;
          }
          if (lost) {
            sfx('flakes');
            this.cameras.main.shake(160, 0.004);
            const off = Math.random() * Math.PI;
            for (let i = 0; i < 10; i++) this.fireShot('pancake', e.x, e.y, off + (i / 10) * Math.PI * 2, 135, 10, 8);
          }
          e.attackT -= dt;
          // Wobble just before a throw, so you can see it coming.
          const wind = e.attackT < 0.5;
          e.sprite.setRotation(wind ? Math.sin(t * 40) * 0.1 : Math.sin(t * 4 + e.phase) * 0.06);
          if (wind) {
            mvx *= 0.3;
            mvy *= 0.3;
          }
          if (e.attackT <= 0) {
            e.attackT = 2.3 - 0.22 * (5 - layers);
            sfx('flakes');
            const a = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) this.fireShot('pancake', e.x, e.y, a + i * 0.24, 200, 12, 8);
          }
          break;
        }
        case 'broiler': {
          // The Broiler. Phase 1: sweeping flame lines (each warned with a glow) and fireball fans.
          // Phase 2 (half health): faster, lights the floor coils in patterns, and calls in Toaster Tots.
          if (!e.enraged && e.hp < e.maxHp * 0.5) {
            e.enraged = true;
            e.attack2T = 1.5;
            e.stateT = 5;
            this.banner('The Broiler cranks the heat to max!', '#ffb36b', 20);
            sfx('roar');
            this.cameras.main.shake(400, 0.007);
          }
          if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
          e.sprite.setRotation(Math.sin(t * 2) * 0.05 + (e.enraged ? Math.sin(t * 30) * 0.025 : 0));
          if (e.enraged && Math.floor(t * 4) % 2) e.sprite.setTint(0xffc9a0);
          else if (e.flashUntil <= t) e.sprite.clearTint();
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = e.enraged ? 2.2 : 2.8;
            e.state = (e.state + 1) % 3;
            const a = Math.atan2(dy, dx);
            if (e.state === 2) {
              sfx('flare');
              for (let i = -3; i <= 3; i++) this.fireShot('fireball', e.x, e.y, a + i * 0.17, 185, 12, 7);
            } else {
              // A sweep: the lines light one after another across where you stand.
              const n = e.enraged ? 4 : 3;
              const dir = e.state === 0 ? 1 : -1;
              const step = 0.34;
              for (let i = 0; i < n; i++) {
                const la = a + dir * (i - (n - 1) / 2) * step;
                this.beams.push({ x: e.x, y: e.y, a: la, t: 0.9 + i * 0.3, burn: 0 });
              }
              sfx('hiss');
            }
          }
          if (e.enraged) {
            e.attack2T -= dt;
            if (e.attack2T <= 0) {
              e.attack2T = 7;
              this.coilPattern(this.coilPatternN++);
            }
            e.stateT -= dt;
            if (e.stateT <= 0) {
              e.stateT = 10;
              const n = 12;
              const d = Math.hypot(this.viewW(), this.viewH()) / 2 + 30;
              for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                this.spawnEnemy('tot', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, this.hpMult(this.stageT));
              }
              this.banner('Toaster Tots!', '#d8dee4', 16);
            }
          }
          break;
        }
        default:
          if (Math.abs(mvx) > 1) e.sprite.setFlipX(mvx < 0);
          // Waddle while walking.
          e.sprite.setRotation(Math.sin(t * 9 + e.phase) * 0.12);
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

      if (this.posts.length && !e.boss) this.pushOut(e, e.radius);

      // Recycle stragglers to the front (keeps pressure on without huge counts).
      if (!e.boss && !ENEMIES[e.kind].flat) {
        const rx = e.x - p.x;
        const ry = e.y - p.y;
        if (Math.abs(rx) > farX || Math.abs(ry) > farY) {
          if (ENEMIES[e.kind].ai === 'line') {
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
      if (flashing !== e.flashOn) {
        e.flashOn = flashing;
        if (flashing) e.sprite.setTintFill(0xffffff);
        else e.sprite.clearTint();
      }
      if (this.paused === 'over') return;
    }
  }

  private removeEnemy(e: Enemy): void {
    e.alive = false;
    e.sprite.setVisible(false);
    e.flame?.setVisible(false);
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
    sfx(KILL_SFX[e.kind]);
    this.deathPop(e);
    const big = e.radius > 20;
    const def = ENEMIES[e.kind];
    this.burst(e.x, e.y, def.burst ?? 0xb57a3c, big ? 18 : 6, big ? 60 : 30);
    if (def.split) {
      const n = def.split.n;
      for (let i = 0; i < n; i++) {
        // Two halves fly left and right; more spread evenly around.
        const a = n === 2 ? (i ? 0 : Math.PI) : (i / n) * Math.PI * 2 + Math.PI / 4;
        const ox = n === 2 ? (i ? 1 : -1) : Math.cos(a);
        const oy = n === 2 ? 0 : Math.sin(a);
        const m = this.spawnEnemy(def.split.kind, e.x + ox * 6, e.y + oy * 6, this.hpMult(this.stageT));
        if (m) {
          m.kx = ox * 120;
          m.ky = oy * 120;
        }
      }
    }
    if (def.ember) this.addSpark(e.x, e.y);
    if (e.kind === 'muffin') {
      // The Molten Muffin bursts into a ring of embers.
      sfx('flare');
      const off = Math.random() * Math.PI;
      for (let i = 0; i < 8; i++) this.fireShot('fireball', e.x, e.y, off + (i / 8) * Math.PI * 2, 120, 8, 7);
    }
    if (e.xp > 0) this.dropXp(e.x, e.y, e.xp);
    // Bread basket normally; the Croissant always drops a gold toaster, elites 1 in 4.
    if (e.dropsChest) this.dropPickup(e.kind === this.stage.mini.kind || Math.random() < 0.25 + 0.05 * this.luckNow ? 'goldchest' : 'chest', e.x, e.y, 1);
    if (e.dropsBun) {
      // Land on the far side of the boss so it isn't grabbed by accident at the kill.
      const ba = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      this.dropPickup('bun', e.x + Math.cos(ba) * (e.radius + 30), e.y + Math.sin(ba) * (e.radius + 30), 1);
      this.banner('A Sticky Bun dropped!', '#f0a24a', 18);
    }
    // Freezer: every elite drops a Warm Mug, regular enemies now and then (one on the floor at a time).
    if (this.stage.mug) {
      if (e.dropsChest && e !== this.mini && !e.boss) this.dropPickup('mug', e.x - 14, e.y, 1);
      else if (!e.dropsChest && Math.random() < 0.006 && !this.pickups.some((it) => it.kind === 'mug')) this.dropPickup('mug', e.x, e.y - 6, 1);
    }
    const r = Math.random();
    if (r < 0.01) this.dropPickup('coin', e.x + 6, e.y, 1);
    else if (r < 0.015) this.dropPickup('heal', e.x, e.y + 6, 30);
    if (e === this.mini) {
      this.mini = null;
      this.miniKilled = true;
      this.cameras.main.shake(250, 0.006);
    }
    if (e === this.boss) {
      this.boss = null;
      if (this.bossClean) this.noHitBoss = true;
      this.cameras.main.shake(600, 0.012);
      this.cameras.main.flash(300, 255, 240, 200);
      for (let i = 0; i < 4; i++) this.burst(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, 0xff7a2a, 16, 90);
      if (!this.endless) {
        this.endRun(true);
        return;
      }
      // Endless: the stage counts as cleared, and the run carries on, harder.
      this.bossRound++;
      this.beams.length = 0;
      // A gold toaster, on the far side so it isn't grabbed by accident at the kill.
      const ga = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      this.dropPickup('goldchest', e.x + Math.cos(ga) * (e.radius + 30), e.y + Math.sin(ga) * (e.radius + 30), 1);
      sfx('evolve');
      const t = this.stageT;
      this.nextBoss = t + ENDLESS_BOSS_EVERY;
      if (!this.endlessCleared) {
        this.endlessCleared = true;
        this.nextElite = t + ENDLESS_ELITE_EVERY;
        this.nextMini = t + ENDLESS_MINI_EVERY;
        this.nextWave = t + RUN.waveEvery;
        this.banner('Endless! How long can you last?', CSS.gold, 26);
      } else this.banner(`${this.stage.boss.name} beaten again!`, CSS.gold, 24);
    }
  }

  /** A white copy of the enemy that swells and fades where it died. */
  private deathPop(e: Enemy): void {
    if (this.particles > 140) return;
    const im = this.fx(e.sprite.texture.key, e.x, e.y, 39);
    const sc = e.sprite.scaleX;
    im.setScale(sc).setTintFill(0xffffff).setRotation(e.sprite.rotation).setFlipX(e.sprite.flipX);
    this.tweens.add({ targets: im, scaleX: sc * 1.6, scaleY: sc * 0.4, alpha: 0, duration: 140, ease: 'Quad.Out', onComplete: () => this.fxDone(im) });
  }

  /** A little fading dot behind a projectile (weapons at level 5 and evolved). */
  trailDot(x: number, y: number, color: number): void {
    if (this.particles > 120) return;
    const im = this.fx('dot', x, y, 18).setTint(color).setAlpha(0.85);
    im.setScale(0.42 / S);
    this.tweens.add({ targets: im, alpha: 0, scale: 0.1 / S, duration: 240, onComplete: () => this.fxDone(im) });
  }

  /** Each weapon's own small hit spark ("Crisp" flare: quick, small, never hides enemies). */
  private hitSpark(x: number, y: number, id: FxId): void {
    if (this.particles > 110) return;
    // Damage-over-time weapons tick a lot, so they spark less often.
    if ((id === 'puddle' || id === 'jar' || id === 'storm' || id === 'combo') && Math.random() < 0.6) return;
    const part = (tex: string, tint: number, scale: number, dx: number, dy: number, ms: number, rot = 0, depth = 41) => {
      const im = this.fx(tex, x, y, depth).setTint(tint).setRotation(rot);
      im.setScale(scale / S);
      this.tweens.add({ targets: im, x: x + dx, y: y + dy, alpha: 0, scale: (scale * 0.4) / S, duration: ms, ease: 'Cubic.Out', onComplete: () => this.fxDone(im) });
    };
    const pop = (tex: string, tint: number, from: number, to: number, ms: number, rot = 0) => {
      const im = this.fx(tex, x, y, 41).setTint(tint).setRotation(rot);
      im.setScale(from / S);
      this.tweens.add({ targets: im, scale: to / S, alpha: 0, duration: ms, ease: 'Quad.Out', onComplete: () => this.fxDone(im) });
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

  private burst(x: number, y: number, color: number, n: number, dist: number): void {
    if (this.particles > 160) return;
    for (let i = 0; i < n; i++) {
      const im = this.fx('dot', x, y, 40).setTint(color);
      const s = (0.4 + Math.random() * 0.6) / S;
      im.setScale(s);
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      this.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0, duration: 280 + Math.random() * 160, ease: 'Cubic.Out', onComplete: () => this.fxDone(im) });
    }
  }

  // ---------------------------------------------------------------- Shots & hazards

  private fireShot(tex: string, x: number, y: number, a: number, speed: number, dmg: number, r: number, aim = false): void {
    const sprite = this.img(tex, x, y, 45);
    if (aim) sprite.setRotation(a);
    this.shots.push({ sprite, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 5, spin: aim ? 0 : (Math.random() - 0.5) * 10 });
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
      // Rack posts block enemy shots (but never yours), so you can duck behind one.
      if (!dead && this.posts.length)
        for (const po of this.posts) {
          const px = s.x - po.x;
          const py = s.y - po.y;
          if (px * px + py * py < (POST_R + s.r) ** 2) {
            dead = true;
            sfx('clang');
            this.burst(s.x, s.y, 0xd8d4d0, 4, 18);
            break;
          }
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

  // ---------------------------------------------------------------- Freezer elite and boss hazards

  /** A pink melt puddle (outlined in white) that slows the bagel. */
  private addMelt(x: number, y: number, audible: boolean, r = 26, life = 7): void {
    const img = this.img('melt', x, y, 3);
    const sc = (r * 2) / 64 / S;
    img.setScale(sc * 0.3);
    this.tweens.add({ targets: img, scale: sc, duration: 260, ease: 'Back.Out' });
    this.melts.push({ img, x, y, r, life });
    if (this.melts.length > 16) this.melts.shift()!.img.destroy();
    if (audible) sfx('melt');
  }

  /** A frost circle: shows where the floor will freeze, then turns to ice after 1.2s. */
  private addFreeze(x: number, y: number): void {
    const r = 46;
    const img = this.img('frost_ring', x, y, 3);
    const sc = (r * 2) / 64 / S;
    img.setScale(sc * 0.2);
    this.tweens.add({ targets: img, scale: sc, duration: 300, ease: 'Back.Out' });
    this.freezes.push({ img, x, y, r, t: 1.2 });
  }

  private updateFreezerHazards(dt: number): void {
    if (!this.melts.length && !this.warns.length && !this.freezes.length && !this.tempIce.length) {
      if (this.bossGfx.visible) this.bossGfx.clear().setVisible(false);
      return;
    }
    const p = this.player;
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
      f.img.setAlpha(0.6 + 0.4 * Math.sin(this.now * 25));
      if (f.t > 0) continue;
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      if (dx * dx + dy * dy < (f.r + p.radius) ** 2) this.damagePlayer(10);
      const rx = f.r * 1.25;
      const ry = f.r * 0.9;
      const base = this.img('ice_patch', f.x, f.y, 1.5);
      base.setScale((rx * 2) / 200 / S, (ry * 2) / 120 / S);
      this.tempIce.push({ x: f.x, y: f.y, rx, ry, imgs: [base], life: 9 });
      this.burst(f.x, f.y, 0xdff4ff, 10, 55);
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
    const g = this.bossGfx;
    g.clear().setVisible(this.warns.length > 0);
    for (let i = this.warns.length - 1; i >= 0; i--) {
      const w = this.warns[i];
      w.t -= dt;
      if (w.t > 0) {
        const len = 760;
        const ex = w.x + Math.cos(w.a) * len;
        const ey = w.y + Math.sin(w.a) * len;
        const blink = Math.floor(this.now * 12) % 2 ? 0.55 : 0.3;
        g.lineStyle(16, 0x6cc7f0, blink).lineBetween(w.x, w.y, ex, ey);
        g.lineStyle(3, 0xffffff, 0.9).lineBetween(w.x, w.y, ex, ey);
        continue;
      }
      sfx('icicle');
      for (let k = 0; k < w.n; k++) this.fireShot('icicle', w.x, w.y, w.a, 300 - k * 35, 14, 6, true);
      this.warns.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- Toaster Oven hazards

  /** An ember spark where an Ember Crumb died: it stings only if you walk right into it. */
  private addSpark(x: number, y: number, life = 1.1, dmg = 3, size = 1, nudge = true): void {
    if (this.sparks.length >= 32) this.sparks.shift()!.img.destroy();
    // Drawn above seeds (and nudged off the spot where the seed lands) so it always reads as a red flame.
    if (nudge) {
      const a = Math.random() * Math.PI * 2;
      x += Math.cos(a) * 10;
      y += Math.sin(a) * 10;
    }
    const img = this.img('ember', x, y, 11);
    this.sparks.push({ img, x, y, life, max: life, dmg, size });
  }

  /** A coil strip at a set spot (the Broiler's patterns). Unlike random flare-ups, these can be right under you. */
  private addCoilAt(x: number, y: number, horiz: boolean, warn = 1.8): void {
    this.coils.push({ x, y, horiz, t: warn, flare: 0 });
  }

  /** The Broiler's floor patterns, centred on you: a box around you, a cross through you, or stripes. */
  private coilPattern(n: number): void {
    const p = this.player;
    const kind = n % 3;
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

  private updateBeams(dt: number): void {
    const g = this.beamGfx;
    if (!this.beams.length) {
      if (g.visible) g.clear().setVisible(false);
      return;
    }
    g.clear().setVisible(true);
    const p = this.player;
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
        const blink = Math.floor(this.now * (8 + k * 12)) % 2 ? 0.55 : 0.3;
        g.lineStyle(BEAM_W, 0xff7a1f, blink * (0.5 + 0.5 * k)).lineBetween(b.x, b.y, ex, ey);
        g.lineStyle(3, 0xffffff, 0.9).lineBetween(b.x, b.y, ex, ey);
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
          if (along > -20 && along < len && across < BEAM_W / 2 + p.radius * 0.6) this.damagePlayer(BEAM_DMG);
          for (let j = 1; j <= 6; j++) this.burst(b.x + vx * j * 110, b.y + vy * j * 110, 0xffb03a, 3, 30);
        }
        continue;
      }
      b.burn -= dt;
      const a = Math.max(0, b.burn / 0.45);
      g.lineStyle(BEAM_W + 14, 0xff5a14, 0.55 * a).lineBetween(b.x, b.y, ex, ey);
      g.lineStyle(BEAM_W - 8, 0xffe08a, 0.95 * a).lineBetween(b.x, b.y, ex, ey);
      if (b.burn <= 0) this.beams.splice(i, 1);
    }
  }

  /** A coil flare-up: a strip near you (never under you) glows for 1.5s, then flares. */
  private addCoil(): void {
    const p = this.player;
    const horiz = Math.random() < 0.5;
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = side * (55 + Math.random() * 110);
    const along = (Math.random() - 0.5) * 160 + (horiz ? p.moveX : p.moveY) * 90;
    const x = horiz ? p.x + along : p.x + off;
    const y = horiz ? p.y + off : p.y + along;
    this.coils.push({ x, y, horiz, t: COIL_WARN, flare: 0 });
    sfx('hiss');
  }

  private inCoil(c: { x: number; y: number; horiz: boolean }, x: number, y: number, pad: number): boolean {
    const hw = (c.horiz ? COIL_LEN : COIL_W) / 2 + pad;
    const hh = (c.horiz ? COIL_W : COIL_LEN) / 2 + pad;
    return Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh;
  }

  /** A grease spot that wobbles and bubbles, then pops and leaves a slick. */
  private addGrease(): void {
    if (this.greases.length >= 4) return;
    const p = this.player;
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    const a = moving && Math.random() < 0.6 ? Math.atan2(p.moveY, p.moveX) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 130;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const img = this.img('grease', x, y, 3);
    img.setScale(((GREASE_R * 2) / 48 / S) * 0.3);
    this.greases.push({ img, x, y, t: GREASE_WARN });
    sfx('bubble');
  }

  private updateOvenHazards(dt: number): void {
    const st = this.stage;
    const p = this.player;
    const g = this.ovenGfx;
    if (st.coils || st.grease) {
      // More often as the run goes on; a little calmer while the boss is out.
      const k = Math.min(1, this.stageT / RUN.bossAt);
      const calm = this.boss ? 1.4 : 1;
      if (st.coils && this.now >= this.coilNext) {
        this.coilNext = this.now + (8 - 3.5 * k) * calm;
        this.addCoil();
      }
      if (st.grease && this.now >= this.greaseNext) {
        this.greaseNext = this.now + (6 - 2 * k) * calm;
        this.addGrease();
        if (k > 0.5 && Math.random() < 0.5) this.addGrease();
      }
    }
    if (!this.coils.length && !this.greases.length && !this.sparks.length) {
      if (g.visible) g.clear().setVisible(false);
      return;
    }
    g.clear().setVisible(true);
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
        const blink = Math.floor(this.now * (6 + k * 14)) % 2 ? 1 : 0.7;
        g.fillStyle(0xff7a1f, (0.18 + 0.32 * k) * blink).fillRoundedRect(x0, y0, w, h, 10);
        g.lineStyle(3, 0xffffff, 0.85).strokeRoundedRect(x0, y0, w, h, 10);
        g.lineStyle(4, 0xffc04a, 0.5 + 0.5 * k);
        if (c.horiz) g.lineBetween(x0 + 8, c.y, x0 + w - 8, c.y);
        else g.lineBetween(c.x, y0 + 8, c.x, y0 + h - 8);
        if (c.t <= 0) {
          // Flare: burns you and every enemy on the strip.
          c.flare = 0.35;
          sfx('flare');
          if (this.inCoil(c, p.x, p.y, p.radius * 0.6)) this.damagePlayer(COIL_DMG);
          for (const e of this.enemies)
            if (e.alive && this.inCoil(c, e.x, e.y, e.radius * 0.5)) this.hit(e, COIL_ENEMY_DMG, 0, 0, 'coil', 0.5);
          for (let j = 0; j < 5; j++) {
            const f = (j + 0.5) / 5 - 0.5;
            this.burst(c.horiz ? c.x + f * w : c.x, c.horiz ? c.y : c.y + f * h, 0xffb03a, 4, 34);
          }
        }
        continue;
      }
      c.flare -= dt;
      const a = Math.max(0, c.flare / 0.35);
      g.fillStyle(0xff5a14, 0.55 * a).fillRoundedRect(x0 - 6, y0 - 6, w + 12, h + 12, 14);
      g.fillStyle(0xffe08a, 0.9 * a).fillRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 8);
      if (c.flare <= 0) this.coils.splice(i, 1);
    }
    for (let i = this.greases.length - 1; i >= 0; i--) {
      const gs = this.greases[i];
      gs.t -= dt;
      const base = (GREASE_R * 2) / 48 / S;
      const k = 1 - Math.max(0, gs.t) / GREASE_WARN;
      const wob = 1 + 0.12 * Math.sin(this.now * (14 + k * 16));
      gs.img.setScale(base * Math.min(1, 0.3 + k * 2) * wob, base * Math.min(1, 0.3 + k * 2) / wob);
      if (gs.t > 0) continue;
      sfx('grease');
      const dx = gs.x - p.x;
      const dy = gs.y - p.y;
      if (dx * dx + dy * dy < (GREASE_R + p.radius) ** 2) this.damagePlayer(GREASE_DMG);
      this.burst(gs.x, gs.y, 0xffd27a, 8, 40);
      const rx = 52;
      const ry = 36;
      const slick = this.img('slick', gs.x, gs.y, 1.5);
      slick.setScale((rx * 2) / 120 / S, (ry * 2) / 80 / S);
      this.tempIce.push({ x: gs.x, y: gs.y, rx, ry, imgs: [slick], life: SLICK_LIFE });
      gs.img.destroy();
      this.greases.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.img.setScale(((0.8 + 0.25 * Math.sin(this.now * 40 + i)) * s.size) / S).setAlpha(Math.min(1, s.life * 2, (s.max - s.life) * 8 + 0.3));
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy < (6 * s.size + p.radius) ** 2) this.damagePlayer(s.dmg);
      if (s.life <= 0) {
        s.img.destroy();
        this.sparks.splice(i, 1);
      }
    }
  }

  /** Big announcement card for a boss's arrival. */
  private bossCard(name: string, line: string): void {
    const W = this.scale.width;
    const top = safeInsets().top * S;
    const w = Math.min(W - 32 * S, 340 * S);
    const h = 100 * S;
    const g = this.add.graphics();
    g.fillStyle(0x24160d, 1).fillRoundedRect(-w / 2 - 4 * S, -h / 2 - 4 * S, w + 8 * S, h + 8 * S, 20 * S);
    // Themed per stage: icy blue in the Freezer, glowing red-hot in the oven.
    const hot = !!this.stage.coils;
    g.fillStyle(hot ? 0x4a170c : 0x1d3a57, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 16 * S);
    g.lineStyle(2 * S, hot ? 0xffb36b : 0xbfe6fb, 0.85).strokeRoundedRect(-w / 2 + 5 * S, -h / 2 + 5 * S, w - 10 * S, h - 10 * S, 12 * S);
    const t1 = txt(this, 0, -17 * S, name.toUpperCase(), 26, hot ? CSS.gold : CSS.red);
    const t2 = txt(this, 0, 22 * S, line, 19, hot ? '#ffe2c4' : '#dff4ff');
    const card = this.ui(this.add.container(W / 2, top + 220 * S, [g, t1, t2]));
    card.setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    this.tweens.add({ targets: card, alpha: 0, y: card.y - 30 * S, delay: 2600, duration: 500, onComplete: () => card.destroy() });
  }

  private damagePlayer(d: number): void {
    const p = this.player;
    if (DEBUG.god || this.paused || this.now < p.invulnUntil) return;
    if (this.crispy) d *= CRISPY_DMG;
    // Hard Crust blocks 1 per rank, but a hit always does at least half.
    const armor = this.armor + (this.toppings.get('frosting') ?? 0);
    if (armor) d = Math.max(d * 0.5, d - armor);
    p.hp -= d;
    p.invulnUntil = this.now + 0.9;
    if (this.boss) this.bossClean = false;
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
    if (p.hp <= 0 && this.reviveRank > 0 && !this.revived) {
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
    this.revived = true;
    p.hp = Math.round(this.stats.maxHp * (0.2 + 0.1 * this.reviveRank));
    p.invulnUntil = this.now + 2;
    this.query(p.x, p.y, 170, (e) => {
      if (e.boss) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dl = Math.hypot(dx, dy) || 1;
      e.kx += (dx / dl) * (900 / e.mass);
      e.ky += (dy / dl) * (900 / e.mass);
    });
    for (let i = this.shots.length - 1; i >= 0; i--) {
      this.shots[i].sprite.destroy();
      this.shots.splice(i, 1);
    }
    this.beams.length = 0;
    this.cameras.main.flash(250, 255, 236, 190);
    this.burst(p.x, p.y, 0xf8d38c, 18, 90);
    this.banner('Second Bake!', CSS.gold, 26);
    sfx('evolve');
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
    const isChest = kind === 'chest' || kind === 'goldchest' || kind === 'bun' || kind === 'mug';
    const sprite = this.img(tex, x, y, isChest ? 12 : 10);
    if (isChest) {
      this.tweens.add({ targets: sprite, y: y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (kind === 'bun' || kind === 'mug') {
      const base = sprite.scaleX;
      this.tweens.add({ targets: sprite, scale: base * 1.15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.pickups.push({ sprite, x, y, kind, value, magnet: false });
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
      if (it.kind === 'chest' || it.kind === 'goldchest' || it.kind === 'bun') {
        // Chests drift to you; the Sticky Bun waits until you walk onto it.
        if (d < 70 && it.kind !== 'bun') {
          it.x += (dx / d) * 200 * dt;
          it.y += (dy / d) * 200 * dt;
          it.sprite.x = it.x;
        }
        // One panel at a time: a second chest touched in the same instant waits until the first panel closes.
        if (d < 24 && !this.paused) this.collect(it, i);
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
    // Chests, buns and mugs bob forever: stop that along with the sprite.
    if (it.kind !== 'xp' && it.kind !== 'coin' && it.kind !== 'heal') this.tweens.killTweensOf(it.sprite);
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
        this.openChest(false);
        break;
      case 'goldchest':
        this.openChest(true);
        break;
      case 'mug':
        // Warms you up: clears frost, a small heal (not counted as a heal for unlock goals), a few seconds frost-free.
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 10);
        this.frost = 0;
        this.frozen = false;
        this.stillT = 0;
        this.player.sprite.clearTint();
        this.mugUntil = this.now + MUG_SAFE;
        sfx('sip');
        this.runMugs++;
        this.burst(this.player.x, this.player.y, 0xff9a5c, 10, 40);
        break;
      case 'bun':
        this.vacuum();
        sfx('swoosh');
        sfx('coin');
        this.burst(this.player.x, this.player.y, 0xf0a24a, 14, 60);
        break;
    }
  }

  private gainXp(v: number): void {
    this.xp += v * (this.quick ? QUICK_XP : 1) * (this.stage.xp ?? 1);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpNeeded(this.level);
      this.pendingLevels++;
    }
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    const xpBar = this.ui(this.add.graphics());
    const badge = this.ui(this.add.graphics());
    const level = this.ui(txt(this, 0, 0, '1', 17, CSS.dark, { stroke: false }));
    const timer = this.ui(txt(this, 0, 0, '0:00', 26));
    const quickBadge = this.ui(
      (this.endless ? pill(this, 0, 0, 'ic_clock', 'ENDLESS', { size: 11, h: 22, color: CSS.gold }) : pill(this, 0, 0, 'ic_bolt', 'QUICK', { size: 11, h: 22, color: CSS.gold })).setVisible(this.quick || this.endless),
    );
    const crispyBadge = this.ui(pill(this, 0, 0, 'ic_flame', 'EXTRA CRISPY', { size: 11, h: 22, color: '#ff9a5c' }).setVisible(this.crispy));
    const kills = this.ui(pill(this, 0, 0, 'en_crumb', '0', { size: 14, h: 28 }));
    const aged = this.bagel.quirkId === 'aged' ? this.ui(pill(this, 0, 0, 'ic_bk_oven', '+30%', { size: 14, h: 28, color: CSS.gold })) : null;
    const pause = this.ui(button(this, 0, 0, 36 * S, 36 * S, 'II', () => this.openPause(), { color: COLORS.panelLight, textColor: CSS.cream, size: 16, radius: 11 }));
    const build = this.ui(this.add.container(0, 0));
    const bossName = this.ui(txt(this, 0, 0, '', 14, CSS.gold).setVisible(false));
    const bossBg = this.ui(this.add.rectangle(0, 0, 10, 10, 0x1d140d).setVisible(false));
    const bossFill = this.ui(this.add.rectangle(0, 0, 10, 10, COLORS.red).setOrigin(0, 0.5).setVisible(false));
    this.hud = { xpBar, badge, level, timer, quickBadge, crispyBadge, kills, aged, pause, build, bossName, bossBg, bossFill };
    this.buildSig = '';
    this.xpShown = 0;
  }

  private onResize(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.uiCam?.setSize(W, H);
    this.floor?.setSize(W / S / ZOOM + 640, H / S / ZOOM + 640);
    if (!this.hud) return;
    const top = safeInsets().top * S;
    const h = this.hud;
    const pad = 12 * S;
    const row1 = top + 24 * S;
    h.badge.setPosition(pad + 20 * S, row1);
    h.badge.clear();
    h.badge.fillStyle(0x24160d, 1).fillCircle(0, 0, 20 * S);
    h.badge.fillStyle(COLORS.xp, 1).fillCircle(0, 0, 17 * S);
    h.badge.fillStyle(0xffffff, 0.3).fillEllipse(-4 * S, -7 * S, 18 * S, 8 * S);
    h.level.setPosition(pad + 20 * S, row1 + 1 * S);
    h.pause.setPosition(W - pad - 18 * S, row1);
    this.xpBarW = W - (pad + 34 * S) - (pad + 46 * S);
    h.xpBar.setPosition(pad + 34 * S, row1);
    this.drawXpBar();
    h.timer.setPosition(W / 2, top + 60 * S);
    h.quickBadge.setPosition(W / 2 + 46 * S + h.quickBadge.width / 2, top + 60 * S);
    h.crispyBadge.setPosition(W / 2, top + 88 * S);
    h.kills.setPosition(pad + h.kills.width / 2, top + 60 * S);
    h.aged?.setPosition(W - pad - h.aged.width / 2, top + (this.quick || this.endless ? 96 : 60) * S);
    h.build.setPosition(pad, top + 90 * S);
    h.bossName.setPosition(W / 2, top + 140 * S);
    const bw = Math.min(W - 40 * S, 320 * S);
    h.bossBg.setPosition(W / 2, top + 158 * S).setSize(bw, 10 * S);
    h.bossFill.setPosition(W / 2 - bw / 2 + 2 * S, top + 158 * S).setSize(bw - 4 * S, 6 * S);
    h.bossBg.setData('w', bw - 4 * S);
  }

  /** Chunky XP bar: ink outline, fill, and a shine; drawn behind the level badge. */
  private drawXpBar(): void {
    const g = this.hud.xpBar;
    const w = this.xpBarW;
    const hh = 14 * S;
    g.clear();
    g.fillStyle(0x24160d, 1).fillRoundedRect(-8 * S, -hh / 2 - 2.5 * S, w + 10.5 * S, hh + 5 * S, hh / 2 + 2.5 * S);
    g.fillStyle(0x1d140d, 1).fillRoundedRect(-6 * S, -hh / 2, w + 6 * S, hh, hh / 2);
    const fw = Math.max(0, Math.min(1, this.xpShown)) * (w + 6 * S);
    if (fw > 2 * S) {
      g.fillStyle(COLORS.xp, 1).fillRoundedRect(-6 * S, -hh / 2, Math.max(fw, hh), hh, hh / 2);
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(-2 * S, -hh / 2 + 2.5 * S, Math.max(fw - 8 * S, 4 * S), hh * 0.28, 2 * S);
    }
  }

  /** Small icons of the current weapons (top row) and toppings (bottom row) with their levels. */
  private drawBuildRow(): void {
    const sig = this.weapons.map((w) => `${w.def.id}${w.level}${w.evolved ? '*' : ''}`).join(',') + '|' + [...this.toppings].map(([id, lv]) => `${id}${lv}`).join(',');
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    const c = this.hud.build;
    c.removeAll(true);
    const sz = 24 * S;
    const step = 28 * S;
    const slot = (x: number, y: number, icon: string | null, lv: string, evolved: boolean) => {
      const g = this.add.graphics();
      g.fillStyle(0x1d140d, icon ? 0.85 : 0.45).fillRoundedRect(x, y, sz, sz, 6 * S);
      g.lineStyle(1.5 * S, evolved ? COLORS.gold : COLORS.panelLight, icon ? 1 : 0.5).strokeRoundedRect(x, y, sz, sz, 6 * S);
      c.add(g);
      if (!icon) return;
      c.add(this.add.image(x + sz / 2, y + sz / 2, icon).setScale((sz * 0.82) / (36 * S)));
      const t = txt(this, x + sz - 1 * S, y + sz - 2 * S, lv, 10, evolved ? CSS.gold : CSS.cream).setOrigin(1, 1);
      c.add(t);
    };
    for (let i = 0; i < MAX_SLOTS; i++) {
      const w = this.weapons[i];
      slot(i * step, 0, w ? w.icon : null, w ? (w.evolved ? '★' : `${w.level}`) : '', !!w?.evolved);
    }
    const tops = [...this.toppings];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const tp = tops[i];
      slot(i * step, step, tp ? TOPPINGS[tp[0]].icon : null, tp ? `${tp[1]}` : '', false);
    }
  }

  private updateHud(): void {
    const h = this.hud;
    const target = Math.min(1, this.xp / this.xpNext);
    // Ease the bar toward its value; snap down after a level-up.
    const nx = target < this.xpShown ? target : this.xpShown + (target - this.xpShown) * 0.25;
    if (Math.abs(nx - this.xpShown) > 0.001) {
      this.xpShown = nx;
      this.drawXpBar();
    }
    const sec = Math.floor(this.now);
    if (sec !== this.lastTimerSec) {
      this.lastTimerSec = sec;
      h.timer.setText(fmtTime(sec));
    }
    if (this.level !== this.lastLevelShown) {
      this.lastLevelShown = this.level;
      h.level.setText(`${this.level}`);
      h.level.setFontSize(Math.round((this.level >= 10 ? 15 : 17) * S));
    }
    const kt = h.kills.getData('label') as Phaser.GameObjects.Text;
    const ks = `${this.kills}`;
    if (kt.text !== ks) kt.setText(ks);
    if (h.aged) {
      const at = h.aged.getData('label') as Phaser.GameObjects.Text;
      const as = `+${this.agedPct}%`;
      if (at.text !== as) at.setText(as);
    }
    this.drawBuildRow();
    const b = this.boss ?? this.mini;
    const show = !!b && b.alive;
    h.bossName.setVisible(show);
    h.bossBg.setVisible(show);
    h.bossFill.setVisible(show);
    if (b && show) {
      h.bossName.setText(b.kind === this.stage.boss.kind ? this.stage.boss.name : this.stage.mini.name);
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
    const top = (ins.top + 152) * S;
    const bottom = H - (ins.bottom + 26) * S;
    const targets: { x: number; y: number; color: number }[] = [];
    for (const e of this.bigs) {
      if (!e.alive) continue;
      targets.push({ x: e.x, y: e.y, color: e.boss ? COLORS.red : e.kind === this.stage.mini.kind ? COLORS.gold : COLORS.green });
    }
    for (const it of this.pickups) {
      if (it.kind === 'chest') targets.push({ x: it.x, y: it.y, color: 0xf3d9a0 });
      else if (it.kind === 'goldchest') targets.push({ x: it.x, y: it.y, color: 0xffc21f });
      else if (it.kind === 'bun') targets.push({ x: it.x, y: it.y, color: 0xf0a24a });
    }
    const pulse = 1 + 0.12 * Math.sin(this.now * 8);
    for (const t of targets) {
      const sx = W / 2 + (t.x - p.x) * S * ZOOM;
      const sy = H / 2 + (t.y - p.y) * S * ZOOM;
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
    const t = this.ui(txt(this, W / 2, top + (190 + slot * 40) * S, text, size, color, { wrap: W / S - 40 }));
    t.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30 * S, delay: 1600, duration: 500, onComplete: () => {
      t.destroy();
      this.banners--;
    } });
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
      kb.on('keydown-ESC', () => (this.paused ? undefined : this.openPause()));
      kb.on('keydown-P', () => (this.paused ? undefined : this.openPause()));
      kb.on('keydown-SPACE', () => this.tryDash(this.player.moveX, this.player.moveY));
    }
  }

  /** Blueberry's Juicy Dash, in the flick's direction (or the way you face). */
  private tryDash(dx: number, dy: number): void {
    if (this.bagel.quirkId !== 'dash' || this.paused || this.now < this.dashReadyAt || this.dashT > 0) return;
    const p = this.player;
    let l = Math.hypot(dx, dy);
    if (l < 0.01) {
      dx = p.faceX;
      dy = p.faceY;
      l = Math.hypot(dx, dy) || 1;
    }
    this.dashT = DASH_TIME;
    this.dashV = { x: (dx / l) * (DASH_DIST / DASH_TIME), y: (dy / l) * (DASH_DIST / DASH_TIME) };
    this.dashReadyAt = this.now + DASH_CD;
    this.dashFlash = 0;
    p.invulnUntil = Math.max(p.invulnUntil, this.now + DASH_TIME + 0.15);
    this.burst(p.x, p.y, 0x9d8fcf, 8, 30);
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

  // ---------------------------------------------------------------- Overlays

  private setPaused(r: PauseReason): void {
    this.paused = r;
    muffleMusic(r === 'levelup' || r === 'pause' || r === 'chest');
    if (r) {
      this.releaseJoystick();
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }

  private closeOverlay(): void {
    for (const tw of this.overlayTweens) tw.stop();
    this.overlayTweens = [];
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
      const kind = choice.kind;
      // Color by type so a card reads before its text does.
      const col = combo ? COLORS.gold : kind === 'wnew' || kind === 'wup' ? 0xf08a3c : kind === 'tnew' || kind === 'tup' ? 0x5aa9e6 : COLORS.green;
      const tile = Phaser.Display.Color.ValueToColor(col).darken(35).color;
      const draw = (pressed: boolean) => {
        const dy = pressed ? 3 * S : 0;
        g.clear();
        g.fillStyle(0x1d140d).fillRoundedRect(-cw / 2, -ch / 2 + 5 * S, cw, ch, 16 * S);
        g.fillStyle(pressed ? COLORS.panelLight : COLORS.panel).fillRoundedRect(-cw / 2, -ch / 2 + dy, cw, ch, 16 * S);
        g.lineStyle(3.5 * S, col).strokeRoundedRect(-cw / 2, -ch / 2 + dy, cw, ch, 16 * S);
        g.fillStyle(tile, 1).fillRoundedRect(-cw / 2 + 12 * S, -30 * S + dy, 60 * S, 60 * S, 12 * S);
        g.lineStyle(2 * S, 0x24160d, 1).strokeRoundedRect(-cw / 2 + 12 * S, -30 * S + dy, 60 * S, 60 * S, 12 * S);
        g.fillStyle(0xffffff, 0.12).fillRoundedRect(-cw / 2 + 16 * S, -26 * S + dy, 52 * S, 18 * S, 8 * S);
      };
      draw(false);
      const icon = this.add.image(-cw / 2 + 42 * S, 0, info.icon).setScale(1.4);
      const tx = -cw / 2 + 86 * S;
      // Ribbon on the top-right corner holds the tag, so long names never run into it.
      const label = combo ? '★ COMBO' : kind === 'wup' ? 'WEAPON' : kind === 'tup' ? 'TOPPING' : info.tag;
      const tag = txt(this, 0, 0, label, 11, kind === 'heal' || kind === 'coin' || combo ? CSS.dark : '#ffffff', { stroke: false });
      const rw = tag.width + 16 * S;
      const rib = this.add.graphics();
      rib.fillStyle(col, 1).fillRoundedRect(cw / 2 - rw - 10 * S, -ch / 2 - 9 * S, rw, 20 * S, 10 * S);
      rib.lineStyle(2 * S, 0x24160d, 1).strokeRoundedRect(cw / 2 - rw - 10 * S, -ch / 2 - 9 * S, rw, 20 * S, 10 * S);
      tag.setPosition(cw / 2 - rw / 2 - 10 * S, -ch / 2 + 1 * S);
      const name = txt(this, tx, -18 * S, info.name, 18, CSS.cream).setOrigin(0, 0.5);
      const maxName = cw - 100 * S;
      if (name.width > maxName) name.setScale(maxName / name.width);
      const desc = txt(this, tx, 6 * S, info.desc, 13, '#e8d8c0', { wrap: (cw - 100 * S) / S, align: 'left', bold: false, stroke: false }).setOrigin(0, 0.5);
      card.add([g, icon, name, desc, rib, tag]);
      // Level pips: current level filled, the level you'd get glowing.
      const lvl = kind === 'wup' ? this.weaponOf(choice.id!)!.level : kind === 'tup' ? (this.toppings.get(choice.id as ToppingId) ?? 0) : kind === 'wnew' || kind === 'tnew' ? 0 : -1;
      if (lvl >= 0) {
        const pg = this.add.graphics();
        drawPips(pg, tx + 5 * S, 27 * S, MAX_LEVEL, lvl, true, col, 3.6 * S, 12 * S);
        card.add(pg);
        desc.setY(4 * S);
      }
      if (combo) {
        const sp = this.add.image(-cw / 2 + 66 * S, -24 * S, 'ic_star').setScale(0.55);
        card.add(sp);
        this.overlayTweens.push(this.tweens.add({ targets: sp, angle: 360, duration: 2400, repeat: -1 }));
      }
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
      card.y = y + 60 * S;
      this.tweens.add({ targets: card, alpha: 1, y, delay: 70 * i, duration: 240, ease: 'Back.Out' });
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

  /** Upgrades a chest can hand out: levels for owned weapons and toppings, in random order. Never a new item. */
  private chestUpgrades(): Choice[] {
    const out: Choice[] = [];
    for (const w of this.weapons) if (w.level < MAX_LEVEL && !w.evolved) out.push({ kind: 'wup', id: w.def.id });
    for (const [id, lv] of this.toppings) if (lv < MAX_LEVEL) out.push({ kind: 'tup', id });
    return Phaser.Utils.Array.Shuffle(out);
  }

  private openChest(gold: boolean): void {
    this.setPaused('chest');
    // The secret recipe: the first gold toaster after Schmear Flood and Lox Cyclone are both evolved merges them.
    // It goes ahead of any normal evolution that's waiting (that one comes from the next chest).
    const lox = this.weaponOf('lox');
    const flood = this.weaponOf('puddle');
    const merge = gold && !!lox?.evolved && !!flood?.evolved && !lox.combo;
    const evo = merge ? undefined : this.weapons.find((w) => w.level >= MAX_LEVEL && !w.evolved && this.toppings.has(w.def.evolveWith));
    sfx(evo || merge ? 'evolve' : gold ? 'gold' : 'basket');
    let title: string;
    const lines: string[] = [];
    let icon = 'ic_heal';
    if (merge) {
      flood!.destroy();
      this.weapons.splice(this.weapons.indexOf(flood!), 1);
      lox!.combo = true;
      title = 'SECRET RECIPE!';
      lines.push(`Schmear Flood + Lox Cyclone\nbecame ${COMBO.name}!`, 'A weapon slot is free again.');
      icon = COMBO.icon;
      this.foundCombo = true;
      const save = load();
      if (!(save.secrets ?? []).includes('combo')) save.secrets = [...(save.secrets ?? []), 'combo'];
      persist();
    } else if (evo) {
      evo.evolved = true;
      title = 'EVOLUTION!';
      lines.push(`${evo.def.name} became ${evo.def.evoName}`);
      if (!gold) lines.push(evo.def.evoBlurb);
      icon = evo.def.icon;
      this.evolutionsThisRun.push(evo.def.id);
      const save = load();
      if (!save.cookbook.includes(evo.def.id)) save.cookbook.push(evo.def.id);
      persist();
    } else {
      title = gold ? 'GOLDEN TOASTER!' : 'BREAD BASKET';
      const dough = gold ? 15 : 5;
      this.coins += dough;
      lines.push(`+${dough} Dough`);
    }
    const ups = merge ? 1 : evo ? (gold ? 2 : 0) : gold ? 3 : 1;
    const got: string[] = [];
    // Chests only level up what you already own: empty slots are left for you to fill from level-up cards.
    for (let i = 0; i < ups; i++) {
      const opts = this.chestUpgrades();
      const pick = opts.find((c) => c.kind === 'wup') ?? opts[0];
      if (!pick) break;
      const info = this.describe(pick);
      this.applyChoice(pick);
      got.push(`${info.name} ${info.tag.startsWith('LV') ? info.tag.replace('LV', 'Lv') : '(new)'}`);
    }
    if (!evo && !merge) icon = gold ? 'goldchest' : 'chest';
    if (!evo && !merge && !got.length) {
      this.player.hp = this.stats.maxHp;
      got.push('Fully healed!');
    }
    const line = (merge ? [...lines, ...got] : [...got, ...lines]).join('\n');
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0);
    this.ui(c);
    this.overlay = c;
    const dim = this.dim(0.7);
    c.add(dim);
    const extra = Math.max(0, line.split('\n').length - 2) * 20 * S;
    c.add(panel(this, W / 2, H / 2 + extra / 2, Math.min(W - 40 * S, 340 * S), 250 * S + extra));
    const im = this.add.image(W / 2, H / 2 - 60 * S, icon).setScale(2.2);
    const t1 = txt(this, W / 2, H / 2 + 6 * S, title, evo || gold ? 28 : 24, evo || gold ? CSS.gold : CSS.cream);
    const t2 = txt(this, W / 2, H / 2 + 56 * S + extra / 2, line, 16, '#e8d8c0', { wrap: Math.min(W / S - 70, 300), bold: false });
    const t3 = txt(this, W / 2, H / 2 + 100 * S + extra, 'Tap to continue', 13, CSS.muted).setAlpha(0);
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
    const pw = Math.min(W - 32 * S, 340 * S);
    const ph = 470 * S;
    const top = H / 2 - ph / 2;
    c.add(panel(this, W / 2, H / 2, pw, ph));
    c.add(txt(this, W / 2, top + 36 * S, this.practice ? 'PAUSED (PRACTICE)' : this.quick ? 'PAUSED (QUICK)' : this.endless ? 'PAUSED (ENDLESS)' : 'PAUSED', 26, CSS.gold));

    // Run so far
    const stats = [
      pill(this, 0, top + 74 * S, 'ic_clock', fmtTime(this.now), { size: 14, h: 28 }),
      pill(this, 0, top + 74 * S, 'en_crumb', `${this.kills}`, { size: 14, h: 28 }),
      pill(this, 0, top + 74 * S, 'coin', `+${this.practice ? 0 : this.runDough(false)}`, { size: 14, h: 28, color: CSS.gold }),
    ];
    const gap = 8 * S;
    let x = W / 2 - (stats.reduce((a, p) => a + p.width, 0) + gap * 2) / 2;
    for (const p of stats) {
      p.x = x + p.width / 2;
      x += p.width + gap;
      c.add(p);
    }

    // Your build: weapons on top, toppings below, each with level pips.
    const cell = Math.min(70 * S, (pw - 30 * S) / MAX_SLOTS);
    const gx = W / 2 - (cell * MAX_SLOTS) / 2;
    const row = (y: number, label: string, items: { icon: string; lv: number; evolved: boolean }[], col: number) => {
      c.add(txt(this, gx + 4 * S, y - 12 * S, label, 12, CSS.muted, { bold: true, stroke: false }).setOrigin(0, 0.5));
      for (let i = 0; i < MAX_SLOTS; i++) {
        const it = items[i];
        const cx = gx + cell * i + cell / 2;
        const g = this.add.graphics();
        const t = 48 * S;
        g.fillStyle(it ? Phaser.Display.Color.ValueToColor(col).darken(35).color : 0x1d140d, it ? 1 : 0.5).fillRoundedRect(cx - t / 2, y, t, t, 10 * S);
        g.lineStyle(2 * S, it?.evolved ? COLORS.gold : 0x24160d, 1).strokeRoundedRect(cx - t / 2, y, t, t, 10 * S);
        c.add(g);
        if (!it) continue;
        c.add(this.add.image(cx, y + t / 2, it.icon).setScale(1.1));
        if (it.evolved) c.add(this.add.image(cx + t / 2 - 4 * S, y + 4 * S, 'ic_star').setScale(0.5));
        else {
          const pg = this.add.graphics();
          drawPips(pg, cx - 2 * 8 * S, y + t + 9 * S, MAX_LEVEL, it.lv, false, col, 2.8 * S, 8 * S);
          c.add(pg);
        }
      }
    };
    row(top + 116 * S, 'WEAPONS', this.weapons.map((w) => ({ icon: w.icon, lv: w.level, evolved: w.evolved })), 0xf08a3c);
    row(top + 196 * S, 'TOPPINGS', [...this.toppings].map(([id, lv]) => ({ icon: TOPPINGS[id].icon, lv, evolved: false })), 0x5aa9e6);

    c.add(
      button(this, W / 2, top + 300 * S, 200 * S, 52 * S, 'Resume', () => {
        this.closeOverlay();
        this.setPaused('');
      }),
    );
    let confirm = false;
    const quit = button(this, W / 2, top + 364 * S, 200 * S, 44 * S, 'Quit run', () => {
      // Ask once, so a stray tap can't end a good run.
      if (!confirm) {
        confirm = true;
        (quit.getData('label') as Phaser.GameObjects.Text).setText('Tap again to quit');
        return;
      }
      this.closeOverlay();
      this.paused = '';
      this.endRun(false, true);
    }, { color: COLORS.panelLight, textColor: CSS.cream, size: 17 });
    c.add(quit);
    const half = 96 * S;
    const mus = button(this, W / 2 - half / 2 - 4 * S, top + 420 * S, half, 44 * S, `Music: ${musicOn() ? 'On' : 'Off'}`, () => {
      setMusic(!musicOn());
      (mus.getData('label') as Phaser.GameObjects.Text).setText(`Music: ${musicOn() ? 'On' : 'Off'}`);
    }, { color: COLORS.panelLight, textColor: CSS.cream, size: 14 });
    const snd = button(this, W / 2 + half / 2 + 4 * S, top + 420 * S, half, 44 * S, `Sound: ${soundOn() ? 'On' : 'Off'}`, () => {
      setSound(!soundOn());
      (snd.getData('label') as Phaser.GameObjects.Text).setText(`Sound: ${soundOn() ? 'On' : 'Off'}`);
    }, { color: COLORS.panelLight, textColor: CSS.cream, size: 14 });
    c.add([mus, snd]);
  }

  /** Dough this run is worth so far (the same formula endRun pays out). */
  private runDough(victory: boolean): number {
    // Quick Runs count time on the full-run schedule, then pay about 75% of a full run.
    let dough = (this.stageT / 60) * 10 + this.kills / 60 + this.coins;
    if (this.miniKilled) dough += 10;
    if (victory || this.endlessCleared) dough += 40;
    // Endless: a bonus for every full minute after 5:00.
    if (this.endless && this.stageT > 300) dough += Math.floor((this.stageT - 300) / 60) * ENDLESS_DOUGH_MIN;
    return Math.round(dough * this.stage.dough * (this.quick ? QUICK_DOUGH : 1) * (this.crispy ? CRISPY_DOUGH : 1));
  }

  // ---------------------------------------------------------------- End

  private endRun(victory: boolean, quit = false): void {
    if (this.paused === 'over') return;
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
    if (!this.practice) save.totalKills += this.kills;
    // A Quick Run clear counts as surviving 3:00 for unlock goals.
    if (!this.practice) {
      const t = Math.max(Math.floor(this.now), this.quick && victory ? 180 : 0);
      save.bestTime = Math.max(save.bestTime, t);
      save.stageTime = { ...(save.stageTime ?? {}), [this.stage.id]: Math.max(save.stageTime?.[this.stage.id] ?? 0, t) };
    }
    clearRun();
    // An Endless run whose boss fell counts as a clear too.
    const cleared = victory || this.endlessCleared;
    if (cleared && !this.practice) {
      save.clears++;
      save.stageClears = { ...(save.stageClears ?? {}), [this.stage.id]: (save.stageClears?.[this.stage.id] ?? 0) + 1 };
      if (this.crispy) save.crispyClears = { ...(save.crispyClears ?? {}), [this.stage.id]: (save.crispyClears?.[this.stage.id] ?? 0) + 1 };
      if (this.healsTaken === 0) save.noHealClear = true;
    }
    if (!this.practice) {
      const r = { ...(save.records ?? {}) };
      r.kills = Math.max(r.kills ?? 0, this.kills);
      r.level = Math.max(r.level ?? 1, this.level);
      r.evos = Math.max(r.evos ?? 0, this.evolutionsThisRun.length);
      if (this.endless) {
        r.endless = Math.max(r.endless ?? 0, Math.floor(this.now));
        r.endlessBosses = Math.max(r.endlessBosses ?? 0, this.bossRound);
      }
      save.records = r;
      if (this.noHitBoss) save.noHitBoss = true;
    }
    if (!this.practice) {
      const beaten = new Set(save.beaten ?? []);
      if (this.miniKilled) beaten.add(this.stage.mini.kind);
      if (cleared) beaten.add(this.stage.boss.kind);
      save.beaten = [...beaten];
      save.mugs = (save.mugs ?? 0) + this.runMugs;
    }
    const newUnlock = this.practice ? '' : checkUnlocks(save).join(', ');
    const newWeapon = this.practice ? '' : checkWeaponUnlocks(save).join(', ');
    const newBest = !this.practice && recordBest(
        save,
        this.bagel.id,
        { time: Math.floor(this.now), kills: this.kills, cleared, ...(this.endless ? { endless: true } : {}) },
        bestStage(this.stage.id, this.endless ? 'endless' : this.quick ? 'quick' : 'full', this.crispy),
      );
    // Challenges pay their Dough as soon as they're done.
    const goals = this.practice ? [] : claimGoals(save).map((g) => ({ name: g.name, reward: g.reward }));
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
      level: this.level,
      kills: this.kills,
      dough,
      bagel: this.bagel.id,
      stage: this.stage.id,
      newUnlock,
      newWeapon,
      newStage: opened.length ? stageById(opened[0]).name : '',
      newBest,
      evolutions: this.evolutionsThisRun.map((id) => WEAPONS[id as WeaponId].evoName),
      goals,
      combo: this.foundCombo,
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

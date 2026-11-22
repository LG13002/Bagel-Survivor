import { CSS } from '../config';
import { shake } from '../settings';
import { RUN, type EnemyKind } from '../data';
import type { Enemy } from '../entities';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';
import { CRISPY_SPAWN, ENDLESS_BOSS_EVERY, ENDLESS_BOSS_HP, ENDLESS_ELITE_EVERY, ENDLESS_MINI_EVERY, ENDLESS_SPAWN_RAMP } from './modes';

/**
 * The run's timeline: the steady stream of enemies, crumb waves, ant lines, elites, surprise elites, the mini-boss and
 * the boss, plus Endless mode's returns after the first boss falls. Everything is scheduled on the stage clock
 * (`stageT`), so Quick Runs play the same timeline faster. Made fresh for every run.
 */
export class Director {
  nextWave: number;
  nextAnts: number;
  nextElite: number;
  miniSpawned: boolean;
  bossSpawned = false;
  /** Surprise elites (the stage's `extras`, by index) that have already arrived. */
  extrasDone: Set<number>;
  /** Endless: the first boss has fallen and the run carries on. */
  endlessCleared = false;
  nextMini = 0;
  nextBoss = 0;
  /** Endless: bosses beaten so far this run (each return has more health). */
  bossRound = 0;
  private spawnT = 0.5;

  constructor(private g: GameScene) {
    // Runs can start late (practice, or the ?t= test flag): skip what would already have happened.
    const t0 = g.stageT;
    this.nextWave = Math.max(RUN.miniBossAt, t0 + 20);
    this.nextAnts = Math.max(RUN.antsFrom, t0 + 10);
    this.nextElite = Math.max(RUN.eliteAt, Math.ceil(t0 / RUN.eliteEvery) * RUN.eliteEvery);
    this.miniSpawned = t0 > RUN.miniBossAt;
    this.extrasDone = new Set((g.stage.extras ?? []).map((x, i) => (x.at < t0 ? i : -1)));
  }

  private pickKind(t: number): EnemyKind {
    const mix = this.g.stage.mix;
    const table = (mix.find((m) => t < m.until) ?? mix[mix.length - 1]).table;
    let r = Math.random() * table.reduce((a, b) => a + b[1], 0);
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) return k;
    }
    return table[0][0];
  }

  update(dt: number): void {
    const g = this.g;
    const foes = g.foes;
    const hud = g.hud;
    const st = g.stage;
    const t = g.stageT;
    const hpMult = foes.hpMult(t);
    let interval = Math.max(0.1, 0.7 - t * 0.0018) / st.spawnRate / (g.crispy ? CRISPY_SPAWN : 1);
    // Endless: about 10% faster spawns for every minute after 5:00.
    if (g.endless && t > 300) interval /= 1 + ENDLESS_SPAWN_RAMP * ((t - 300) / 60);
    if (foes.boss) interval *= 4;
    // Gentler through 3:00, then the swarm ramps up toward the boss.
    const batch = 1 + Math.floor(t / 75) + (t > 180 ? 2 : 0);
    const cap = t < 180 ? RUN.earlyMaxEnemies : RUN.maxEnemies;
    this.spawnT -= dt;
    while (this.spawnT <= 0) {
      this.spawnT += interval;
      for (let i = 0; i < batch && foes.list.length < cap; i++) {
        const sp = foes.spawnPoint();
        foes.spawn(this.pickKind(t), sp.x, sp.y, hpMult);
      }
    }
    // Endless: a wave that comes due while the boss is out is skipped, not saved up for when it falls.
    if (this.endlessCleared && foes.boss && t >= this.nextWave) this.nextWave += RUN.waveEvery;
    if (t >= RUN.miniBossAt && t >= this.nextWave && (t < RUN.bossAt - 5 || (this.endlessCleared && !foes.boss))) {
      this.nextWave += RUN.waveEvery;
      foes.ringOf(st.wave.kinds, 28);
      hud.banner(st.wave.banner, CSS.cream, 18);
    }
    // Lines pause while a boss is out; the ones that came due are skipped.
    if (st.lines && t >= this.nextAnts && foes.boss) this.nextAnts += RUN.antsEvery;
    if (st.lines && t >= this.nextAnts && !foes.boss) {
      this.nextAnts += RUN.antsEvery;
      this.antLine(st.lines, hpMult);
    }
    if (t >= this.nextElite && (t < RUN.bossAt || this.endlessCleared)) {
      const el = this.endlessCleared
        ? st.elites[Math.floor(Math.random() * st.elites.length)]
        : st.elites[Math.max(0, Math.round((this.nextElite - RUN.eliteAt) / RUN.eliteEvery)) % st.elites.length];
      this.nextElite += this.endlessCleared ? ENDLESS_ELITE_EVERY : RUN.eliteEvery;
      const e = foes.spawnNear(el.kind);
      if (e) {
        e.dropsChest = true;
        // Full runs: the last Giant Mold before the boss carries the second Sticky Bun.
        if (!g.quick && !this.endlessCleared && t >= RUN.bossAt - RUN.eliteEvery) e.dropsBun = true;
      }
      hud.banner(el.banner, el.color, 20);
    }
    if (st.extras && !this.bossSpawned) {
      st.extras.forEach((x, i) => {
        if (t < x.at || this.extrasDone.has(i)) return;
        this.extrasDone.add(i);
        const e = foes.spawnNear(x.kind);
        if (e) e.dropsChest = true;
        hud.banner(x.banner, x.color, 20);
      });
    }
    if (this.endlessCleared && !foes.mini && t >= this.nextMini) {
      this.nextMini = t + ENDLESS_MINI_EVERY;
      this.spawnMini();
      hud.banner(`${st.mini.name} is back!`, CSS.gold, 24);
    }
    if (this.endlessCleared && !foes.boss && t >= this.nextBoss) {
      this.nextBoss = t + ENDLESS_BOSS_EVERY;
      this.spawnBoss(true);
      hud.banner(`${st.boss.name} returns, tougher!`, CSS.red, 26);
      sfx('roar');
      sfx('boss');
      shake(g, 400, 0.006);
    }
    if (!this.miniSpawned && t >= RUN.miniBossAt) {
      this.miniSpawned = true;
      this.spawnMini();
      hud.banner(st.mini.banner, CSS.gold, 26);
    }
    if (!this.bossSpawned && t >= RUN.bossAt) {
      this.bossSpawned = true;
      this.spawnBoss(false);
      if (st.boss.card) {
        hud.bossCard(st.boss.name, st.boss.card);
        sfx('roar');
      } else hud.banner(st.boss.banner, CSS.red, 30);
      sfx('boss');
      shake(g, 400, 0.006);
    }
  }

  /** The mini-boss (it carries a chest and the Sticky Bun). */
  spawnMini(): Enemy | null {
    const e = this.g.foes.spawnNear(this.g.stage.mini.kind);
    if (e) {
      e.dropsChest = true;
      e.dropsBun = true;
      this.g.foes.mini = e;
    }
    return e;
  }

  /** The stage boss. In Endless each return has more health than the last. */
  spawnBoss(returning: boolean): Enemy | null {
    const g = this.g;
    const e = g.foes.spawnNear(g.stage.boss.kind);
    if (e) {
      if (returning) e.maxHp = e.hp = e.maxHp * Math.pow(ENDLESS_BOSS_HP, this.bossRound);
      e.boss = true;
      g.foes.boss = e;
      g.run.bossClean = true;
      e.attack2T = 4;
    }
    return e;
  }

  /** A line of 12 marching from one side of the screen to the other. */
  private antLine(kind: EnemyKind, hpMult: number): void {
    const g = this.g;
    const p = g.player;
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const d = Math.max(g.viewW(), g.viewH()) / 2 + 60;
    const offset = (Math.random() - 0.5) * 120;
    for (let i = 0; i < 12; i++) {
      const lat = (i - 5.5) * 20 + offset;
      const x = p.x - dx * d - dy * lat;
      const y = p.y - dy * d + dx * lat;
      const e = g.foes.spawn(kind, x, y, hpMult);
      if (e) {
        e.vx = dx * e.speed;
        e.vy = dy * e.speed;
      }
    }
  }
}

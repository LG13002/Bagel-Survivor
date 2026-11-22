// Saving and restoring a run, so it survives iOS closing the app mid-match. The snapshot format is in runsave.ts.
import { ENEMIES, xpNeeded, type EnemyKind, type ToppingId, type WeaponId } from '../data';
import { saveRun, type RunSnapshot } from '../runsave';
import { createWeapon } from '../weapons';
import type { GameScene } from '../scenes/GameScene';
import { ENDLESS_BOSS_HP } from './modes';

export function writeSnapshot(g: GameScene): void {
  if (g.paused === 'over') return;
  const r = g.run;
  const dir = g.director;
  const foes = g.foes;
  const snap: RunSnapshot = {
    v: 1,
    savedAt: Date.now(),
    bagel: g.bagel.id,
    stage: g.stage.id,
    practice: g.practice,
    quick: g.quick,
    endless: g.endless,
    crispy: g.crispy,
    endlessCleared: dir.endlessCleared,
    nextMini: dir.nextMini,
    nextBoss: dir.nextBoss,
    bossRound: dir.bossRound,
    now: g.now,
    level: r.level,
    xp: r.xp,
    pendingLevels: r.pendingLevels,
    hp: g.player.hp,
    weapons: g.weapons.map((w) => ({ id: w.def.id, level: w.level, evolved: w.evolved, ...(w.combo ? { combo: true } : {}) })),
    toppings: [...g.toppings],
    kills: r.kills,
    coins: r.coins,
    rerolls: r.rerolls,
    nextWave: dir.nextWave,
    nextAnts: dir.nextAnts,
    nextElite: dir.nextElite,
    miniSpawned: dir.miniSpawned,
    miniHp: foes.mini?.alive ? foes.mini.hp : 0,
    miniKilled: r.miniKilled,
    bossSpawned: dir.bossSpawned,
    bossHp: foes.boss?.alive ? foes.boss.hp : 0,
    evolutions: r.evolutionsThisRun,
    healsTaken: r.healsTaken,
    bossClean: r.bossClean,
    noHitBoss: r.noHitBoss,
    revived: r.revived,
    mugs: r.runMugs,
    buns: g.loot.list.filter((it) => it.kind === 'bun').length,
    extras: [...dir.extrasDone].filter((i) => i >= 0),
    elites: foes.list.filter((e) => e.alive && e.dropsChest && e !== foes.mini && e !== foes.boss).map((e) => ({ kind: e.kind, hp: e.hp, bun: e.dropsBun })),
  };
  saveRun(snap);
}

/** Put a saved run back: the build, progress, the timeline, and the elites, mini-boss and boss that were out. */
export function applySnapshot(g: GameScene, s: RunSnapshot): void {
  const r = g.run;
  const dir = g.director;
  const foes = g.foes;
  g.weapons.forEach((w) => w.destroy());
  g.weapons = [];
  for (const w of s.weapons) {
    const wp = createWeapon(g, w.id as WeaponId);
    wp.level = w.level;
    wp.evolved = w.evolved;
    wp.combo = !!w.combo;
    g.weapons.push(wp);
  }
  g.toppings = new Map(s.toppings as [ToppingId, number][]);
  g.now = s.now;
  r.level = s.level;
  r.xp = s.xp;
  r.xpNext = xpNeeded(s.level);
  r.pendingLevels = s.pendingLevels;
  r.kills = s.kills;
  r.coins = s.coins;
  r.rerolls = s.rerolls;
  dir.nextWave = s.nextWave;
  dir.nextAnts = s.nextAnts;
  dir.nextElite = s.nextElite;
  dir.miniSpawned = s.miniSpawned;
  r.miniKilled = s.miniKilled;
  dir.bossSpawned = s.bossSpawned;
  dir.endlessCleared = !!s.endlessCleared;
  dir.nextMini = s.nextMini ?? 0;
  dir.nextBoss = s.nextBoss ?? 0;
  dir.bossRound = s.bossRound ?? 0;
  r.evolutionsThisRun = s.evolutions;
  r.healsTaken = s.healsTaken;
  r.noHitBoss = !!s.noHitBoss;
  r.revived = !!s.revived;
  r.runMugs = s.mugs ?? 0;
  // Surprise elites that already came stay done (older snapshots: judged by the clock), and elites that were out come back.
  dir.extrasDone = new Set(s.extras ?? (g.stage.extras ?? []).map((x, i) => (x.at < g.stageT ? i : -1)));
  for (const el of s.elites ?? []) {
    if (!ENEMIES[el.kind as EnemyKind]) continue;
    const e = foes.spawnNear(el.kind as EnemyKind);
    if (e) {
      e.hp = Math.min(e.maxHp, el.hp);
      e.dropsChest = true;
      e.dropsBun = el.bun;
    }
  }
  for (let i = 0; i < (s.buns ?? 0); i++) g.loot.drop('bun', g.player.x + 60 + i * 30, g.player.y, 1);
  g.recomputeStats();
  g.player.hp = Math.min(g.stats.maxHp, s.hp);
  if (s.miniHp > 0) {
    const e = dir.spawnMini();
    if (e) e.hp = s.miniHp;
  }
  if (s.bossHp > 0) {
    const e = foes.spawnNear(g.stage.boss.kind);
    if (e) {
      e.maxHp *= Math.pow(ENDLESS_BOSS_HP, dir.bossRound);
      e.hp = s.bossHp;
      e.boss = true;
      e.attack2T = 4;
      foes.boss = e;
      r.bossClean = !!s.bossClean;
    }
  }
}

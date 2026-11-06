import { BAGELS, STAGES, WEAPONS, stageById, type BagelDef, type StageDef, type WeaponDef, type WeaponId } from './data';
import { fmtTime } from './config';
import type { SaveData } from './save';

/** Preview builds (VITE_PREVIEW=1, used for the playable preview link) open every stage, and the newest bagels, so they can be tried right away. */
const PREVIEW = import.meta.env.VITE_PREVIEW === '1';
const PREVIEW_BAGELS = ['blueberry', 'asiago', 'jalapeno'];

export interface GoalStatus {
  done: boolean;
  /** 0..1 */
  frac: number;
  /** e.g. "best 2:12 of 3:00" */
  progress: string;
}

export function goalStatus(save: SaveData, b: BagelDef): GoalStatus {
  const g = b.goal;
  if (!g) return { done: true, frac: 1, progress: '' };
  switch (g.kind) {
    case 'clear':
      return { done: save.clears >= g.target, frac: Math.min(1, save.clears / g.target), progress: save.clears ? 'cleared' : 'not cleared yet' };
    case 'time':
      return { done: save.bestTime >= g.target, frac: Math.min(1, save.bestTime / g.target), progress: `best ${fmtTime(save.bestTime)} of ${fmtTime(g.target)}` };
    case 'kills':
      return {
        done: save.totalKills >= g.target,
        frac: Math.min(1, save.totalKills / g.target),
        progress: `${Math.min(save.totalKills, g.target).toLocaleString()} of ${g.target.toLocaleString()}`,
      };
    case 'noheal':
      return { done: !!save.noHealClear, frac: save.noHealClear ? 1 : 0, progress: save.noHealClear ? 'done' : 'not yet' };
    case 'stageclear': {
      const n = save.stageClears?.[g.stage ?? 'stage1'] ?? 0;
      return { done: n >= g.target, frac: Math.min(1, n / g.target), progress: n ? 'cleared' : 'not cleared yet' };
    }
    case 'stagetime': {
      const best = stageBestTime(save, g.stage ?? 'stage1');
      return { done: best >= g.target, frac: Math.min(1, best / g.target), progress: `best ${fmtTime(best)} of ${fmtTime(g.target)}` };
    }
    case 'cookbook':
      return { done: save.cookbook.length >= g.target, frac: Math.min(1, save.cookbook.length / g.target), progress: `${save.cookbook.length} of ${g.target}` };
  }
}

/** Endless and Extra Crispy open for a stage once it has been cleared (always open in preview builds). */
export function modesOpen(save: SaveData, stage: StageDef): boolean {
  return PREVIEW || (save.stageClears?.[stage.id] ?? 0) > 0;
}

/** Longest survival on a stage: the tracked time, or older saves' bests (a Quick clear counts as 3:00). */
function stageBestTime(save: SaveData, stage: string): number {
  let t = save.stageTime?.[stage] ?? 0;
  for (const [k, b] of Object.entries(save.best ?? {})) {
    if (k.startsWith(`${stage}:`)) t = Math.max(t, b.time);
    else if (k.startsWith(`${stage}q:`)) t = Math.max(t, b.time, b.cleared ? 180 : 0);
  }
  return t;
}

/** Unlock any bagels whose goals are now met. Returns the names of new unlocks. */
export function checkUnlocks(save: SaveData): string[] {
  const out: string[] = [];
  for (const b of BAGELS) {
    if (save.unlocked.includes(b.id)) continue;
    // Preview builds hand out the newest bagels so they can be tried right away.
    if (goalStatus(save, b).done || (PREVIEW && PREVIEW_BAGELS.includes(b.id))) {
      save.unlocked.push(b.id);
      out.push(b.name);
    }
  }
  return out;
}

/** The locked bagels closest to unlocking, nearest first. */
export function nearestGoals(save: SaveData, n: number): { bagel: BagelDef; status: GoalStatus }[] {
  return BAGELS.filter((b) => !save.unlocked.includes(b.id) && b.goal)
    .map((bagel) => ({ bagel, status: goalStatus(save, bagel) }))
    .sort((a, b) => b.status.frac - a.status.frac)
    .slice(0, n);
}


/** A stage's goal is met: the stage before it has been cleared (Stage 1 is always open). */
export function stageUnlocked(save: SaveData, st: StageDef): boolean {
  return PREVIEW || !st.unlockAfter || (save.stageClears?.[st.unlockAfter] ?? 0) > 0;
}

/** Unlocked and built, so it can be picked and played. */
export function stagePlayable(save: SaveData, st: StageDef): boolean {
  return st.built && stageUnlocked(save, st);
}

/** The stage the menu has picked, falling back to Stage 1 if it can't be played. */
export function pickedStage(save: SaveData): StageDef {
  const st = stageById(save.stage);
  return stagePlayable(save, st) ? st : STAGES[0];
}

/** Playable stages, used to spot ones a run just opened up. */
export function playableStages(save: SaveData): string[] {
  return STAGES.filter((st) => stagePlayable(save, st)).map((st) => st.id);
}

/** A weapon can show on level-up cards: a starter, or its goal was met (preview builds open them all). */
export function weaponOpen(save: SaveData, id: WeaponId): boolean {
  return PREVIEW || !WEAPONS[id].unlock || (save.weapons ?? []).includes(id);
}

export function weaponGoalStatus(save: SaveData, w: WeaponDef): GoalStatus {
  const g = w.unlock;
  if (!g) return { done: true, frac: 1, progress: '' };
  switch (g.kind) {
    case 'boss': {
      const done = (save.beaten ?? []).includes(g.boss ?? '');
      return { done, frac: done ? 1 : 0, progress: done ? 'beaten' : 'not beaten yet' };
    }
    case 'mugs': {
      const n = save.mugs ?? 0;
      return { done: n >= g.target, frac: Math.min(1, n / g.target), progress: `${Math.min(n, g.target)} of ${g.target}` };
    }
    case 'cookbook': {
      const n = save.cookbook.length;
      return { done: n >= g.target, frac: Math.min(1, n / g.target), progress: `${Math.min(n, g.target)} of ${g.target}` };
    }
  }
}

/** Unlock any weapons whose goals are now met. Returns the names of new unlocks. */
export function checkWeaponUnlocks(save: SaveData): string[] {
  const out: string[] = [];
  for (const w of Object.values(WEAPONS)) {
    if (!w.unlock || (save.weapons ?? []).includes(w.id)) continue;
    if (weaponGoalStatus(save, w).done) {
      save.weapons = [...(save.weapons ?? []), w.id];
      out.push(w.name);
    }
  }
  return out;
}

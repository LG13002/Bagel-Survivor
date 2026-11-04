import { BAGELS, STAGES, stageById, type BagelDef, type StageDef } from './data';
import { fmtTime } from './config';
import type { SaveData } from './save';

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
    case 'cookbook':
      return { done: save.cookbook.length >= g.target, frac: Math.min(1, save.cookbook.length / g.target), progress: `${save.cookbook.length} of ${g.target}` };
  }
}

/** Unlock any bagels whose goals are now met. Returns the names of new unlocks. */
export function checkUnlocks(save: SaveData): string[] {
  const out: string[] = [];
  for (const b of BAGELS) {
    if (save.unlocked.includes(b.id)) continue;
    if (goalStatus(save, b).done) {
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

/** Preview builds (VITE_PREVIEW=1, used for the playable preview link) open every stage so new ones can be tried right away. */
const PREVIEW = import.meta.env.VITE_PREVIEW === '1';

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

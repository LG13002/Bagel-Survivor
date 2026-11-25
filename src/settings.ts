// Player options from the Settings screen, and the helpers the rest of the game uses to respect them.
import type Phaser from 'phaser';
import { load, persist, type Settings } from './save';

export function settings(): Settings {
  return load().settings!;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings()[key] = value;
  persist();
}

/** Screen shake that follows the Screen shake setting (Reduced is 40%, Off is none). */
export function shake(scene: Phaser.Scene, ms: number, intensity: number): void {
  const mode = settings().shake;
  if (mode === 'off') return;
  scene.cameras.main.shake(ms, mode === 'reduced' ? intensity * 0.4 : intensity);
}

/** Full-screen flash. Skipped when Flashing effects is Reduced. */
export function flash(scene: Phaser.Scene, ms: number, r: number, g: number, b: number): void {
  if (settings().flash === 'reduced') return;
  scene.cameras.main.flash(ms, r, g, b);
}

export function reducedFlash(): boolean {
  return settings().flash === 'reduced';
}

/** A smooth pulse around `mid` (plus or minus `amp`, `speed` in radians a second). Held at its brightest when flashing is Reduced. */
export function pulse(t: number, speed: number, mid: number, amp: number): number {
  return mid + amp * (reducedFlash() ? 1 : Math.sin(t * speed));
}

/**
 * A blinking warning's brightness at time t: flips between hi and lo `rate` times a second.
 * With Flashing effects Reduced it holds steady at hi, so the warning keeps its shape and outline without strobing.
 */
export function blink(t: number, rate: number, hi: number, lo: number): number {
  if (reducedFlash()) return hi;
  return Math.floor(t * rate) % 2 ? hi : lo;
}

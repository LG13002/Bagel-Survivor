// Screen transition: the view closes down through a bagel-shaped ring, the next screen is set up behind it,
// and the ring opens again. It's a plain page element on top of the game canvas, so it carries across scenes.
import type Phaser from 'phaser';

const CLOSE_MS = 150;
const OPEN_MS = 190;
let el: HTMLDivElement | null = null;
let closed = false;
let raf = 0;

function layer(): HTMLDivElement {
  if (!el) {
    el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;display:none';
    document.body.appendChild(el);
  }
  return el;
}

/** Draws the ring with a see-through hole of radius r (CSS px) at the middle of the screen. */
function paint(r: number): void {
  const d = layer();
  const crust = Math.max(0, r);
  d.style.background = `radial-gradient(circle at 50% 50%, transparent ${crust}px, #24160d ${crust}px, #24160d ${crust + 4}px, #e3a24c ${crust + 4}px, #b0642a ${crust + 22}px, #24160d ${crust + 22}px, #24160d ${crust + 26}px, #1d140d ${crust + 26}px)`;
}

function run(from: number, to: number, ms: number, done: () => void): void {
  cancelAnimationFrame(raf);
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k * k * (3 - 2 * k);
    paint(from + (to - from) * e);
    if (k < 1) raf = requestAnimationFrame(tick);
    else done();
  };
  raf = requestAnimationFrame(tick);
}

const reach = () => Math.hypot(window.innerWidth, window.innerHeight) / 2 + 30;

/** Close the ring, then start the next scene. The new scene calls `wipeOpen` once it's drawn. */
export function wipeTo(scene: Phaser.Scene, key: string, data: object = {}): void {
  if (closed) return;
  closed = true;
  scene.input.enabled = false;
  layer().style.display = 'block';
  run(reach(), -30, CLOSE_MS, () => scene.scene.start(key, data));
}

/** Open the ring if a wipe closed it. Returns false when there was no wipe (the scene fades in instead). */
export function wipeOpen(): boolean {
  if (!closed) return false;
  closed = false;
  run(-30, reach(), OPEN_MS, () => (layer().style.display = 'none'));
  return true;
}

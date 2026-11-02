import Phaser from 'phaser';
import { COLORS, S } from './config';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultsScene } from './scenes/ResultsScene';

const size = () => ({ w: window.innerWidth * S, h: window.innerHeight * S });
const { w, h } = size();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: COLORS.bg,
  scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / S },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  input: { activePointers: 3 },
  scene: [MenuScene, GameScene, ResultsScene],
});

// Exposed for debugging and automated playtests.
(window as unknown as { __game: Phaser.Game }).__game = game;

let pending = 0;
const onResize = () => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    const s = size();
    game.scale.resize(s.w, s.h);
  });
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

// Stop iOS double-tap zoom and pinch gestures from hijacking play.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

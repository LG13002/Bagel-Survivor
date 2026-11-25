import { dailyFor, dailyStreak, today } from './daily';
import Phaser from 'phaser';
import { COLORS, S } from './config';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultsScene } from './scenes/ResultsScene';
import { IntroScene } from './scenes/IntroScene';
import { TitleScene } from './scenes/TitleScene';
import { CreditsScene } from './scenes/CreditsScene';
import { backupCode, load, persist, resetSave, restoreCode, takeRecovered } from './save';
import { watchErrors } from './gameInfo';
import { giantBagel } from './textures';
import fontUrl from './assets/titan-one.woff2?inline';

watchErrors();

/**
 * The game is made for a phone held upright. In a wide window (a laptop, a tablet on its side) it keeps a phone's
 * shape in the middle, with the page's dark background either side, so every screen looks and plays as it was built.
 * A short, wide window (a phone on its side) is left alone: a column there would be too small to play.
 */
const column = (): number => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return h >= 560 && w > h * 0.8 ? Math.min(w, Math.max(390, Math.round(h * 0.5625))) : w;
};
const size = () => ({ w: column() * S, h: window.innerHeight * S });
/** Centres the game's box in the window. */
const place = (): void => {
  const app = document.getElementById('app');
  if (!app) return;
  const w = column();
  app.style.left = `${(window.innerWidth - w) / 2}px`;
  app.style.width = `${w}px`;
  app.style.right = 'auto';
};

function start(): void {
  const { w, h } = size();
  place();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: COLORS.bg,
    scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / S },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 3 },
    scene: [TitleScene, IntroScene, CreditsScene, MenuScene, GameScene, ResultsScene],
  });

  // The page's launch screen fades once the first screen is drawn (the single-file preview has none).
  game.events.once(Phaser.Core.Events.POST_RENDER, () => {
    const splash = document.getElementById('splash');
    splash?.classList.add('gone');
    setTimeout(() => splash?.remove(), 400);
  });

  // Exposed for debugging and automated playtests (tools/bots). `__art` lets the icon and share-picture tools draw a bagel with its eyes.
  Object.assign(window, { __game: game, __save: { load, persist, backupCode, restoreCode, resetSave, takeRecovered }, __daily: { dailyFor, dailyStreak, today }, __art: { giantBagel } });

  let pending = 0;
  const onResize = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const s = size();
      place();
      game.scale.resize(s.w, s.h);
    });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
}

// The game's one font is bundled with the code (so it works offline and in the single-file preview).
// Text is drawn to the canvas, so the font has to be ready before the first screen is built.
const face = new FontFace('Titan One', `url(${fontUrl}) format('woff2')`);
document.fonts.add(face);
face.load().catch(() => {}).then(start);

// Stop iOS double-tap zoom and pinch gestures from hijacking play.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    // The very first visit loads before the service worker is in charge, so nothing has been saved for
    // offline play yet: save the page and the files it just loaded (same cache name as sw.js).
    navigator.serviceWorker.ready
      .then(async () => {
        const cache = await caches.open('everything-bagel-v1');
        const files = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
        for (const url of [location.href, ...files]) if (!(await cache.match(url))) await cache.add(url).catch(() => {});
      })
      .catch(() => {});
  });
}

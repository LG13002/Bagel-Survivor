import Phaser from 'phaser';
import { S } from './config';
import { ICONS, ctex, drawBasket, drawGoldToaster, drawCoin, drawDrop, drawFlake, drawGem, drawHeal, drawLox, drawMine, drawPin, drawPuddle, drawSesame, drawToast, drawAnt, drawBagel, drawCroissant, drawCrumb, drawElite, drawKnife, drawMold, drawToaster, type BagelLook } from './art';

type G = Phaser.GameObjects.Graphics;

// Every texture is drawn at S× resolution; sprites using them are scaled by 1/S in the world.
function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.setScale(S);
  draw(g);
  g.generateTexture(key, Math.ceil(w * S), Math.ceil(h * S));
  g.destroy();
}

// Deterministic pseudo-random so textures look the same every load.
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function makeTextures(scene: Phaser.Scene): void {
  // Bagels (Chunky Cartoon, drawn in art.ts)
  const golden = { base: '#e3a24c', crust: '#b0642a', hi: '#f8d38c' };
  const bagelTex = (key: string, look: BagelLook) => ctex(scene, key, 40, 40, (c) => drawBagel(c, 20, 20, 15.5, look));
  bagelTex('bagel_plain', golden);
  bagelTex('bagel_everything', { ...golden, seeds: ['#2a1f1a', '#fbf3dc', '#6b4422', '#f0dca2'], seedCount: 34 });
  bagelTex('bagel_poppy', { ...golden, seeds: ['#1b1f2e', '#323a55'], seedCount: 80, seedSize: 0.75 });
  bagelTex('bagel_cinnamon', { base: '#a8652f', crust: '#6e3a19', hi: '#d9a068', swirl: '#5a2c12', seeds: ['#3d1f2b', '#5e2c40'], seedCount: 10, seedSize: 1.6 });
  bagelTex('bagel_pumpernickel', { base: '#5a3622', crust: '#2a160c', hi: '#8f6146' });
  bagelTex('bagel_onion', { ...golden, seeds: ['#f6e6b6', '#8a5a2a', '#dcbb72'], seedCount: 26, seedSize: 1.45 });
  ctex(scene, 'mine', 10, 10, (c) => drawMine(c, 10));

  tex(scene, 'floor', 64, 64, (g) => {
    g.fillStyle(0x6e5a48).fillRect(0, 0, 64, 64);
    g.fillStyle(0x76614e).fillRect(0, 0, 32, 32).fillRect(32, 32, 32, 32);
    g.lineStyle(1.5, 0x5a4939).strokeRect(0, 0, 32, 32).strokeRect(32, 32, 32, 32).strokeRect(32, 0, 32, 32).strokeRect(0, 32, 32, 32);
    const r = rng(3);
    g.fillStyle(0x5f4d3d, 0.6);
    for (let i = 0; i < 6; i++) g.fillCircle(r() * 64, r() * 64, 0.8 + r());
  });

  // Enemies: dark bodies with red eyes so they never read as loot.
  ctex(scene, 'en_crumb', 24, 24, (c) => drawCrumb(c, 12, 12, 10));
  ctex(scene, 'en_mold', 32, 32, (c) => drawMold(c, 16, 16, 14));
  ctex(scene, 'en_moldling', 22, 22, (c) => drawMold(c, 11, 11, 9.5));
  ctex(scene, 'en_elite', 64, 64, (c) => drawElite(c, 32, 33, 27));
  ctex(scene, 'en_knife', 40, 14, (c) => drawKnife(c, 40, 14));
  ctex(scene, 'en_ant', 20, 14, (c) => drawAnt(c, 20, 14));
  ctex(scene, 'en_croissant', 72, 56, (c) => drawCroissant(c, 72, 56));
  ctex(scene, 'en_toaster', 84, 76, (c) => drawToaster(c, 84, 76));

  // Player projectiles
  ctex(scene, 'seed', 10, 10, (c) => drawSesame(c, 5, 5, 3.9, 2.5));
  ctex(scene, 'seed_fire', 14, 14, (c) => drawSesame(c, 7, 7, 4.6, 3, true));
  ctex(scene, 'orb', 16, 16, (c) => drawSesame(c, 8, 8, 6, 3.6));
  ctex(scene, 'puddle', 128, 128, (c) => drawPuddle(c, 128));
  ctex(scene, 'lox', 30, 18, (c) => drawLox(c, 30, 18));
  ctex(scene, 'pin', 56, 16, (c) => drawPin(c, 56, 16));
  ctex(scene, 'splash', 8, 8, (c) => drawDrop(c, 4, 4, 3, '#5e3317', '#b8763a'));

  // Enemy projectiles
  ctex(scene, 'flake', 12, 12, (c) => drawFlake(c, 12));
  ctex(scene, 'toast', 18, 18, (c) => drawToast(c, 18));

  // Pickups: bright and glowing so they never read as enemies.
  ctex(scene, 'gem1', 16, 16, (c) => drawGem(c, 16, 8, '#45d9f3', '#e6fbff', '#1b6f86'));
  ctex(scene, 'gem2', 16, 16, (c) => drawGem(c, 16, 10, '#7dff8a', '#efffef', '#22813a'));
  ctex(scene, 'gem3', 16, 16, (c) => drawGem(c, 16, 12.5, '#ff6bd5', '#ffe6f8', '#8f2a78'));
  ctex(scene, 'coin', 14, 14, (c) => drawCoin(c, 14));
  ctex(scene, 'heal', 18, 18, (c) => drawHeal(c, 18));
  ctex(scene, 'chest', 30, 26, (c) => drawBasket(c, 30, 26));
  ctex(scene, 'goldchest', 30, 28, (c) => drawGoldToaster(c, 30, 28));
  tex(scene, 'dot', 8, 8, (g) => {
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
  });
  tex(scene, 'ring', 64, 64, (g) => {
    g.fillStyle(0xff3b1f, 0.18).fillCircle(32, 32, 31);
    g.lineStyle(2.5, 0xff3b1f, 0.9).strokeCircle(32, 32, 30);
  });

  // Upgrade icons (36×36)
  for (const [key, draw] of Object.entries(ICONS)) ctex(scene, key, 36, 36, draw);
}

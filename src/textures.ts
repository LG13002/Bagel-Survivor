import Phaser from 'phaser';
import { S } from './config';
import { ctex, drawAnt, drawBagel, drawCroissant, drawCrumb, drawElite, drawKnife, drawMold, drawToaster, type BagelLook } from './art';

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
  tex(scene, 'mine', 10, 10, (g) => {
    g.fillStyle(0x1b1f2e).fillEllipse(5, 5, 6, 4);
    g.fillStyle(0x4a5578).fillEllipse(4.4, 4.4, 2.6, 1.4);
  });

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
  tex(scene, 'seed', 10, 10, (g) => {
    g.fillStyle(0xbfa36a).fillEllipse(5, 5, 8, 5);
    g.fillStyle(0xfff4d6).fillEllipse(4.5, 4.5, 6.5, 3.6);
  });
  tex(scene, 'seed_fire', 14, 14, (g) => {
    g.fillStyle(0xff6a1f, 0.5).fillCircle(7, 7, 6.5);
    g.fillStyle(0xffb02e).fillEllipse(7, 7, 9, 6);
    g.fillStyle(0xfff4d6).fillEllipse(6.5, 6.5, 5, 3);
  });
  tex(scene, 'orb', 16, 16, (g) => {
    g.fillStyle(0xfff4d6, 0.25).fillCircle(8, 8, 7.5);
    g.fillStyle(0xbfa36a).fillEllipse(8, 8, 12, 7);
    g.fillStyle(0xfff4d6).fillEllipse(7.5, 7.5, 10, 5.5);
  });
  tex(scene, 'puddle', 128, 128, (g) => {
    g.fillStyle(0xfdfaf2, 0.55).fillCircle(64, 64, 63);
    g.fillStyle(0xffffff, 0.5).fillCircle(64, 64, 50);
    g.fillStyle(0xffffff, 0.7).fillCircle(48, 46, 14).fillCircle(80, 72, 9);
  });
  tex(scene, 'lox', 30, 18, (g) => {
    g.fillStyle(0xe8775a).fillEllipse(15, 9, 28, 14);
    g.fillStyle(0xf59a7c).fillEllipse(14, 8, 22, 9);
    g.lineStyle(1.3, 0xfff1e8, 0.9);
    for (const x of [7, 12, 17, 22]) g.lineBetween(x, 4, x + 2, 14);
  });
  tex(scene, 'pin', 56, 16, (g) => {
    g.fillStyle(0x7a4a24).fillRoundedRect(0, 5, 10, 6, 3).fillRoundedRect(46, 5, 10, 6, 3);
    g.fillStyle(0xc8925a).fillRoundedRect(9, 1, 38, 14, 6);
    g.fillStyle(0xe2b27c).fillRoundedRect(11, 2.5, 34, 4, 2);
  });
  tex(scene, 'splash', 8, 8, (g) => {
    g.fillStyle(0x6b3b1d).fillCircle(4, 4, 3.6);
    g.fillStyle(0xa0632f).fillCircle(3.3, 3.3, 1.8);
  });

  // Enemy projectiles
  tex(scene, 'flake', 12, 12, (g) => {
    g.fillStyle(0xd99234).fillPoints([{ x: 6, y: 0 }, { x: 11, y: 6 }, { x: 6, y: 12 }, { x: 1, y: 6 }], true);
    g.fillStyle(0xffd27a).fillCircle(5, 5, 2);
  });
  tex(scene, 'toast', 18, 18, (g) => {
    g.fillStyle(0x7a4419).fillRoundedRect(1, 1, 16, 16, 5);
    g.fillStyle(0xd59a52).fillRoundedRect(3, 3, 12, 12, 3);
    g.fillStyle(0xff7a2a, 0.6).fillCircle(9, 9, 3);
  });

  // Pickups
  // XP seeds: bright, cool-colored and glowing so they read as loot against the brown floor.
  const gem = (key: string, col: number, hi: number, w: number) =>
    tex(scene, key, 16, 16, (g) => {
      g.fillStyle(col, 0.25).fillCircle(8, 8, 7.5);
      g.fillStyle(col).fillEllipse(8, 8, w, w * 0.62);
      g.fillStyle(hi).fillEllipse(7.3, 7.2, w * 0.55, w * 0.28);
    });
  gem('gem1', 0x4fd2ff, 0xe6f9ff, 7.5);
  gem('gem2', 0x7dff8a, 0xeaffec, 9.5);
  gem('gem3', 0xff6bd5, 0xffe0f6, 12);
  tex(scene, 'coin', 14, 14, (g) => {
    g.fillStyle(0xb8862b).fillCircle(7, 7, 6);
    g.fillStyle(0xf2c14e).fillCircle(7, 6.5, 5);
    g.lineStyle(1.6, 0xb8862b).strokeCircle(7, 6.5, 2.2);
  });
  tex(scene, 'heal', 18, 18, (g) => {
    g.fillStyle(0x8fb7d9).fillRoundedRect(2, 4, 14, 12, 3);
    g.fillStyle(0xffffff).fillRoundedRect(3, 2, 12, 5, 2);
    g.fillStyle(0xe0533d).fillRect(8, 8, 2, 6).fillRect(6, 10, 6, 2);
  });
  tex(scene, 'chest', 30, 26, (g) => {
    g.fillStyle(0xfff0a0, 0.35).fillCircle(15, 13, 13);
    g.fillStyle(0x7d868f).fillRoundedRect(3, 7, 24, 17, 5);
    g.fillStyle(0xc9d1d8).fillRoundedRect(4, 7, 22, 15, 4);
    g.fillStyle(0x2a2522).fillRect(8, 5, 6, 4).fillRect(16, 5, 6, 4);
    g.fillStyle(0xffd23f).fillRect(9, 2, 4, 4).fillRect(17, 2, 4, 4);
  });
  tex(scene, 'dot', 8, 8, (g) => {
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
  });
  tex(scene, 'ring', 64, 64, (g) => {
    g.fillStyle(0xff3b1f, 0.18).fillCircle(32, 32, 31);
    g.lineStyle(2.5, 0xff3b1f, 0.9).strokeCircle(32, 32, 30);
  });

  // Upgrade icons (36×36)
  const icon = (key: string, draw: (g: G) => void) => tex(scene, key, 36, 36, draw);
  icon('ic_sesame', (g) => {
    for (const [x, y, a] of [[12, 12, 0], [22, 18, 1], [14, 25, 2]] as const) {
      g.fillStyle(0xbfa36a).fillEllipse(x, y, 11 - a, 7 - a * 0.5);
      g.fillStyle(0xfff4d6).fillEllipse(x - 0.5, y - 0.5, 9 - a, 5 - a * 0.5);
    }
  });
  icon('ic_storm', (g) => {
    g.lineStyle(2, 0xfff4d6, 0.5).strokeCircle(18, 18, 12);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.fillStyle(0xfff4d6).fillEllipse(18 + Math.cos(a) * 12, 18 + Math.sin(a) * 12, 8, 5);
    }
    g.fillStyle(0xe0a458).fillCircle(18, 18, 4);
  });
  icon('ic_puddle', (g) => {
    g.fillStyle(0xfdfaf2).fillEllipse(18, 22, 30, 16);
    g.fillStyle(0xffffff).fillEllipse(14, 19, 10, 5);
  });
  icon('ic_lox', (g) => {
    g.fillStyle(0xe8775a).fillEllipse(18, 18, 30, 15);
    g.fillStyle(0xf59a7c).fillEllipse(17, 17, 24, 10);
    g.lineStyle(1.5, 0xfff1e8);
    for (const x of [9, 15, 21, 27]) g.lineBetween(x, 12, x + 2, 24);
  });
  icon('ic_coffee', (g) => {
    g.fillStyle(0xffffff).fillRoundedRect(8, 12, 18, 18, 4);
    g.lineStyle(3, 0xffffff).strokeCircle(28, 20, 4);
    g.fillStyle(0x6b3b1d).fillRect(10, 13, 14, 5);
    g.lineStyle(2, 0xd9d9d9, 0.8).lineBetween(13, 9, 15, 4).lineBetween(19, 9, 21, 4);
  });
  icon('ic_pin', (g) => {
    g.fillStyle(0x7a4a24).fillRoundedRect(1, 15, 9, 6, 3).fillRoundedRect(26, 15, 9, 6, 3);
    g.fillStyle(0xc8925a).fillRoundedRect(8, 11, 20, 14, 6);
  });
  icon('ic_butter', (g) => {
    g.fillStyle(0xe3b53d).fillRect(6, 14, 24, 14);
    g.fillStyle(0xffe27a).fillRect(6, 10, 24, 6);
  });
  icon('ic_dough', (g) => {
    g.fillStyle(0xe8d1a8).fillEllipse(18, 21, 28, 18);
    g.fillStyle(0xf8ead0).fillEllipse(15, 18, 14, 8);
  });
  icon('ic_caffeine', (g) => {
    g.fillStyle(0x5a3416).fillEllipse(18, 18, 18, 26);
    g.lineStyle(2.5, 0x2e1a0b).beginPath().arc(26, 18, 10, Math.PI * 0.75, Math.PI * 1.25).strokePath();
  });
  icon('ic_oven', (g) => {
    g.fillStyle(0xe0533d).fillTriangle(18, 4, 29, 30, 7, 30);
    g.fillStyle(0xffb02e).fillTriangle(18, 13, 24, 30, 12, 30);
  });
  icon('ic_salt', (g) => {
    g.fillStyle(0xffffff);
    g.fillRect(9, 9, 7, 7).fillRect(20, 14, 6, 6).fillRect(12, 22, 8, 8);
  });
  icon('ic_glaze', (g) => {
    g.fillStyle(0xff8fb1).fillCircle(18, 22, 9).fillTriangle(18, 4, 27, 20, 9, 20);
    g.fillStyle(0xffd0de).fillCircle(15, 21, 3);
  });
  icon('ic_heal', (g) => {
    g.fillStyle(0xe0533d).fillRect(14, 6, 8, 24).fillRect(6, 14, 24, 8);
  });
  icon('ic_coin', (g) => {
    g.fillStyle(0xb8862b).fillCircle(18, 18, 12);
    g.fillStyle(0xf2c14e).fillCircle(18, 17, 10);
  });
}

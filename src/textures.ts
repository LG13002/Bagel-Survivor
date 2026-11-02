import Phaser from 'phaser';
import { S } from './config';

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

function eyes(g: G, x1: number, x2: number, y: number, r: number, angry = false): void {
  g.fillStyle(0xffffff).fillCircle(x1, y, r).fillCircle(x2, y, r);
  g.fillStyle(0x1a1a1a).fillCircle(x1 + r * 0.15, y + r * 0.25, r * 0.55).fillCircle(x2 + r * 0.15, y + r * 0.25, r * 0.55);
  if (angry) {
    g.lineStyle(r * 0.6, 0x1a1a1a);
    g.lineBetween(x1 - r, y - r * 1.4, x1 + r, y - r * 0.6);
    g.lineBetween(x2 + r, y - r * 1.4, x2 - r, y - r * 0.6);
  }
}

function bagel(g: G, seeds: number[] | null): void {
  const c = 20;
  g.fillStyle(0x000000, 0.25).fillEllipse(c, c + 15, 30, 8);
  g.lineStyle(11, 0xb8742f).strokeCircle(c, c, 10.5);
  g.lineStyle(7, 0xe0a458).strokeCircle(c - 0.5, c - 1, 10.5);
  g.lineStyle(2.5, 0xf6cf8a);
  g.beginPath();
  g.arc(c, c, 12, Math.PI * 1.1, Math.PI * 1.65);
  g.strokePath();
  if (seeds) {
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 7 + r() * 8;
      g.fillStyle(seeds[i % seeds.length]);
      g.fillEllipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 2.2, 1.3);
    }
  }
  eyes(g, c - 5, c + 5, c - 10.5, 3.4);
}

export function makeTextures(scene: Phaser.Scene): void {
  tex(scene, 'bagel_plain', 40, 40, (g) => bagel(g, null));
  tex(scene, 'bagel_everything', 40, 40, (g) => bagel(g, [0x222222, 0xf6efd9, 0x5a3b1c, 0xe9d8a6]));

  tex(scene, 'floor', 64, 64, (g) => {
    g.fillStyle(0x6e5a48).fillRect(0, 0, 64, 64);
    g.fillStyle(0x76614e).fillRect(0, 0, 32, 32).fillRect(32, 32, 32, 32);
    g.lineStyle(1.5, 0x5a4939).strokeRect(0, 0, 32, 32).strokeRect(32, 32, 32, 32).strokeRect(32, 0, 32, 32).strokeRect(0, 32, 32, 32);
    const r = rng(3);
    g.fillStyle(0x5f4d3d, 0.6);
    for (let i = 0; i < 6; i++) g.fillCircle(r() * 64, r() * 64, 0.8 + r());
  });

  // Crumb enemy: big, dark and outlined with red eyes so it never reads as loot.
  tex(scene, 'en_crumb', 24, 24, (g) => {
    const r = rng(11);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = 8 + r() * 3;
      pts.push({ x: 12 + Math.cos(a) * d, y: 12 + Math.sin(a) * d });
    }
    g.fillStyle(0x1a0f08).fillPoints(pts.map((p) => ({ x: 12 + (p.x - 12) * 1.18, y: 12 + (p.y - 12) * 1.18 })), true);
    g.fillStyle(0x5a3416).fillPoints(pts, true);
    g.fillStyle(0x7a4a22).fillCircle(10, 10, 4);
    g.fillStyle(0xff3b2f).fillCircle(8.5, 11, 2.3).fillCircle(15.5, 11, 2.3);
    g.fillStyle(0xffd23f).fillCircle(8.8, 11.3, 0.9).fillCircle(15.8, 11.3, 0.9);
    g.lineStyle(1.6, 0x1a0f08).lineBetween(6, 7.5, 11, 9.5).lineBetween(18, 7.5, 13, 9.5);
  });

  const blob = (g: G, size: number) => {
    const c = size / 2;
    const r = size * 0.36;
    g.fillStyle(0x4f7a2a).fillCircle(c, c + 1, r);
    g.fillCircle(c - r * 0.7, c + r * 0.3, r * 0.55).fillCircle(c + r * 0.75, c + r * 0.25, r * 0.5).fillCircle(c + r * 0.2, c - r * 0.6, r * 0.55);
    g.fillStyle(0x76a83e).fillCircle(c - r * 0.2, c - r * 0.1, r * 0.6);
    g.fillStyle(0x3c5e1f).fillCircle(c + r * 0.4, c + r * 0.5, r * 0.18).fillCircle(c - r * 0.6, c + r * 0.55, r * 0.14);
    eyes(g, c - r * 0.35, c + r * 0.35, c - r * 0.15, r * 0.24, true);
  };
  tex(scene, 'en_mold', 32, 32, (g) => blob(g, 32));
  tex(scene, 'en_moldling', 22, 22, (g) => blob(g, 22));

  tex(scene, 'en_knife', 40, 14, (g) => {
    g.fillStyle(0x5b3a22).fillRoundedRect(1, 4, 13, 6, 2);
    g.fillStyle(0xc7c7c7).fillCircle(5, 7, 0.9).fillCircle(10, 7, 0.9);
    g.fillStyle(0xdfe5ea).fillPoints([{ x: 14, y: 3 }, { x: 33, y: 4 }, { x: 39, y: 7 }, { x: 33, y: 10 }, { x: 14, y: 10 }], true);
    g.fillStyle(0xffffff, 0.7).fillRect(15, 4, 17, 1.5);
    g.fillStyle(0xff3b2f).fillCircle(26, 7, 1.6);
  });

  tex(scene, 'en_ant', 20, 14, (g) => {
    g.lineStyle(1, 0x111111);
    for (const x of [7, 10, 13]) {
      g.lineBetween(x, 7, x - 2, 1);
      g.lineBetween(x, 7, x - 2, 13);
    }
    g.fillStyle(0x1d1612).fillCircle(4, 7, 3.4).fillCircle(10, 7, 2.6).fillCircle(15.5, 7, 3);
    g.fillStyle(0xff4d3a).fillCircle(17, 6, 0.9).fillCircle(17, 8, 0.9);
  });

  tex(scene, 'en_croissant', 72, 56, (g) => {
    const segs = [
      { x: 12, y: 36, w: 16, h: 22 },
      { x: 23, y: 24, w: 18, h: 28 },
      { x: 36, y: 20, w: 20, h: 32 },
      { x: 49, y: 24, w: 18, h: 28 },
      { x: 60, y: 36, w: 16, h: 22 },
    ];
    for (const s of segs) {
      g.fillStyle(0x9c5a1c).fillEllipse(s.x, s.y + 2, s.w, s.h);
      g.fillStyle(0xd99234).fillEllipse(s.x, s.y, s.w - 2, s.h - 3);
      g.fillStyle(0xf2bd62).fillEllipse(s.x - 2, s.y - 4, s.w * 0.4, s.h * 0.3);
    }
    eyes(g, 31, 41, 22, 4, true);
  });

  tex(scene, 'en_toaster', 84, 76, (g) => {
    g.fillStyle(0x000000, 0.3).fillEllipse(42, 70, 70, 10);
    g.fillStyle(0x7d868f).fillRoundedRect(6, 14, 72, 54, 14);
    g.fillStyle(0xb9c2ca).fillRoundedRect(8, 14, 68, 50, 13);
    g.fillStyle(0xdbe2e8).fillRoundedRect(12, 17, 30, 8, 4);
    g.fillStyle(0x2a2522).fillRoundedRect(20, 10, 18, 8, 3).fillRoundedRect(46, 10, 18, 8, 3);
    g.fillStyle(0xb0702f).fillRect(22, 6, 14, 6).fillRect(48, 6, 14, 6);
    g.fillStyle(0x333333).fillRect(76, 34, 6, 12);
    g.fillStyle(0xff3b1f).fillCircle(30, 40, 6).fillCircle(54, 40, 6);
    g.fillStyle(0xffd23f).fillCircle(30, 41, 2.5).fillCircle(54, 41, 2.5);
    g.lineStyle(3.5, 0x1a1a1a).lineBetween(21, 29, 37, 35).lineBetween(63, 29, 47, 35);
    g.lineStyle(3, 0x1a1a1a).lineBetween(32, 55, 52, 55);
  });

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

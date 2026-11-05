import Phaser from 'phaser';
import { S } from './config';
import { COUNTER_PROPS, FREEZER_PROPS, OVEN_PROPS, drawButcherBlock, drawFreezerFloor, drawOvenFloor, drawStageThumb } from './floors';
import { ICONS, UI_ICONS, ctex, drawBasket, drawGoldToaster, drawStickyBun, drawCoin, drawDrop, drawFlake, drawGem, drawHeal, drawLox, drawMine, drawPin, drawPuddle, drawSesame, drawToast, drawAnt, drawBagel, drawCroissant, drawCrumb, drawElite, drawKnife, drawMold, drawToaster, drawFrostCrumb, drawIceCube, drawPeaPod, drawPopsicle, drawSprinkleFlake, drawPea, drawWarmMug, drawIcePatch, drawTwinkle, drawScoop, drawMeltPuddle, drawFrostedCroissant, drawTyrantJr, drawWaffle, drawFreezerBurn, drawIcicle, drawPizzaSlice, drawButterKnife, drawJamJar, drawPlayerToast, drawJamPool, drawStamp, drawShock, drawStar4, drawStreak, drawChip, drawHitRing, drawEmberCrumb, drawBurntToast, drawHotSauce, drawSauceShot, drawPopcorn, drawPopBit, drawTot, drawRackPost, drawEmberSpark, drawGreaseSpot, drawSlick, drawFlame, type BagelLook } from './art';

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

export function makeTextures(scene: Phaser.Scene): void {
  // Bagels (Chunky Cartoon, drawn in art.ts)
  const golden = { base: '#e3a24c', crust: '#b0642a', hi: '#f8d38c' };
  const bagelTex = (key: string, look: BagelLook) => {
    ctex(scene, key, 40, 40, (c) => drawBagel(c, 20, 20, 15.5, look));
    // Large version for the menu's hero bagel, so it stays sharp when shown big.
    ctex(scene, `${key}_big`, 160, 160, (c) => {
      c.translate(80, 80);
      c.scale(4, 4);
      drawBagel(c, 0, 0, 15.5, look);
    });
  };
  bagelTex('bagel_plain', golden);
  bagelTex('bagel_everything', { ...golden, seeds: ['#2a1f1a', '#fbf3dc', '#6b4422', '#f0dca2'], seedCount: 34 });
  bagelTex('bagel_poppy', { ...golden, seeds: ['#1b1f2e', '#323a55'], seedCount: 80, seedSize: 0.75 });
  bagelTex('bagel_cinnamon', { base: '#a8652f', crust: '#6e3a19', hi: '#d9a068', swirl: '#5a2c12', seeds: ['#3d1f2b', '#5e2c40'], seedCount: 10, seedSize: 1.6 });
  bagelTex('bagel_pumpernickel', { base: '#5a3622', crust: '#2a160c', hi: '#8f6146' });
  bagelTex('bagel_blueberry', { base: '#9d8fcf', crust: '#4f3f86', hi: '#d3c9f2', seeds: ['#2b2766', '#3d3a92', '#252050'], seedCount: 16, seedSize: 1.7 });
  bagelTex('bagel_asiago', { ...golden, seeds: ['#ffdc73', '#f2c048', '#c9862a'], seedCount: 12, seedSize: 2.2 });
  bagelTex('bagel_jalapeno', { base: '#e8a94a', crust: '#a9622a', hi: '#f9d585', seeds: ['#3f8f2a', '#ffb52e', '#2c6b1c', '#ffcf4a'], seedCount: 16, seedSize: 2.1 });
  bagelTex('bagel_onion', { ...golden, seeds: ['#f6e6b6', '#8a5a2a', '#dcbb72'], seedCount: 26, seedSize: 1.45 });
  ctex(scene, 'mine', 10, 10, (c) => drawMine(c, 10));

  // Stage floors (256 × 256, seamless). 'floor' is used behind the menus.
  ctex(scene, 'floor_stage1', 256, 256, (c) => drawButcherBlock(c, 256));
  ctex(scene, 'floor_stage2', 256, 256, (c) => drawFreezerFloor(c, 256));
  ctex(scene, 'floor_stage3', 256, 256, (c) => drawOvenFloor(c, 256));
  ctex(scene, 'floor', 256, 256, (c) => drawButcherBlock(c, 256));
  ctex(scene, 'ice_patch', 200, 120, (c) => drawIcePatch(c, 200, 120));
  ctex(scene, 'twinkle', 12, 12, (c) => drawTwinkle(c, 12));
  // Stage pictures for the stage cards (big) and the menu's stage button (small).
  for (const id of ['stage1', 'stage2', 'stage3']) {
    ctex(scene, `thumb_${id}`, 120, 76, (c) => drawStageThumb(c, id, 120, 76));
    ctex(scene, `thumb_${id}_sm`, 40, 30, (c) => drawStageThumb(c, id, 40, 30));
  }
  // Countertop props, scattered over the floor by GameScene.
  for (const p of FREEZER_PROPS) ctex(scene, p.key, p.w, p.h, (c) => p.draw(c, p.w, p.h));
  for (const p of OVEN_PROPS) ctex(scene, p.key, p.w, p.h, (c) => p.draw(c, p.w, p.h));
  for (const p of COUNTER_PROPS) ctex(scene, p.key, p.w, p.h, (c) => p.draw(c, p.w, p.h));

  // Enemies: dark bodies with red eyes so they never read as loot.
  ctex(scene, 'en_crumb', 24, 24, (c) => drawCrumb(c, 12, 12, 10));
  ctex(scene, 'en_mold', 32, 32, (c) => drawMold(c, 16, 16, 14));
  ctex(scene, 'en_moldling', 22, 22, (c) => drawMold(c, 11, 11, 9.5));
  ctex(scene, 'en_elite', 64, 64, (c) => drawElite(c, 32, 33, 27));
  ctex(scene, 'en_knife', 40, 14, (c) => drawKnife(c, 40, 14));
  ctex(scene, 'en_ant', 20, 14, (c) => drawAnt(c, 20, 14));
  ctex(scene, 'en_croissant', 72, 56, (c) => drawCroissant(c, 72, 56));
  ctex(scene, 'en_toaster', 84, 76, (c) => drawToaster(c, 84, 76));
  // Freezer enemies
  ctex(scene, 'en_fcrumb', 24, 26, (c) => drawFrostCrumb(c, 12, 14, 10));
  ctex(scene, 'en_icecube', 30, 30, (c) => drawIceCube(c, 15, 15, 12.5));
  ctex(scene, 'en_peapod', 30, 26, (c) => drawPeaPod(c, 14, 14, 11.5));
  ctex(scene, 'en_popsicle', 26, 36, (c) => drawPopsicle(c, 26, 36));
  ctex(scene, 'en_pophalf', 20, 22, (c) => drawPopsicle(c, 20, 22, 1));
  ctex(scene, 'en_fmold', 40, 40, (c) => drawMold(c, 20, 20, 17, { body: '#8fbfae', dark: '#4f8473', hi: '#d6f1ea' }));
  ctex(scene, 'en_fmoldling', 24, 24, (c) => drawMold(c, 12, 12, 10, { body: '#8fbfae', dark: '#4f8473', hi: '#d6f1ea' }));
  ctex(scene, 'en_sprinkle', 18, 18, (c) => drawSprinkleFlake(c, 18));
  ctex(scene, 'en_scoop', 64, 62, (c) => drawScoop(c, 32, 30, 28));
  ctex(scene, 'en_fcroissant', 62, 48, (c) => drawFrostedCroissant(c, 62, 48));
  ctex(scene, 'en_tyrantjr', 56, 51, (c) => drawTyrantJr(c, 56, 51));
  ctex(scene, 'en_waffle', 72, 72, (c) => drawWaffle(c, 72));
  ctex(scene, 'en_wafflesq', 26, 26, (c) => drawWaffle(c, 26, true));
  ctex(scene, 'en_fburn', 104, 104, (c) => drawFreezerBurn(c, 104));
  ctex(scene, 'melt', 64, 42, (c) => drawMeltPuddle(c, 64, 42));
  // Toaster Oven enemies and hazards
  ctex(scene, 'en_ember', 26, 26, (c) => drawEmberCrumb(c, 13, 13, 10));
  ctex(scene, 'en_btoast', 30, 38, (c) => {
    c.translate(0, 6);
    drawBurntToast(c, 30, 32);
  });
  ctex(scene, 'en_hotsauce', 24, 34, (c) => drawHotSauce(c, 24, 34));
  ctex(scene, 'en_popcorn', 30, 30, (c) => drawPopcorn(c, 30, 30));
  ctex(scene, 'en_popbit', 18, 18, (c) => drawPopBit(c, 18));
  ctex(scene, 'en_tot', 30, 27, (c) => drawTot(c, 30, 27));
  ctex(scene, 'en_mscoop', 32, 32, (c) => drawScoop(c, 16, 15, 13.5));
  ctex(scene, 'post', 40, 40, (c) => drawRackPost(c, 40));
  ctex(scene, 'ember', 16, 22, (c) => drawEmberSpark(c, 16, 22));
  ctex(scene, 'grease', 48, 48, (c) => drawGreaseSpot(c, 48));
  ctex(scene, 'slick', 120, 80, (c) => drawSlick(c, 120, 80));
  ctex(scene, 'flame', 12, 16, (c) => drawFlame(c, 12, 16));

  // Player projectiles
  ctex(scene, 'seed', 10, 10, (c) => drawSesame(c, 5, 5, 3.9, 2.5));
  ctex(scene, 'seed_fire', 14, 14, (c) => drawSesame(c, 7, 7, 4.6, 3, true));
  ctex(scene, 'orb', 16, 16, (c) => drawSesame(c, 8, 8, 6, 3.6));
  ctex(scene, 'puddle', 128, 128, (c) => drawPuddle(c, 128));
  ctex(scene, 'lox', 30, 18, (c) => drawLox(c, 30, 18));
  ctex(scene, 'pin', 56, 16, (c) => drawPin(c, 56, 16));
  ctex(scene, 'knife_w', 32, 10, (c) => drawButterKnife(c, 32, 10));
  ctex(scene, 'jar', 16, 20, (c) => drawJamJar(c, 16, 20));
  ctex(scene, 'ptoast', 18, 18, (c) => drawPlayerToast(c, 18));
  ctex(scene, 'jam_pool', 128, 128, (c) => drawJamPool(c, 128));
  ctex(scene, 'stamp', 128, 128, (c) => drawStamp(c, 128));
  ctex(scene, 'shock', 128, 128, (c) => drawShock(c, 128));
  ctex(scene, 'star4', 12, 12, (c) => drawStar4(c, 12));
  ctex(scene, 'streak', 18, 4, (c) => drawStreak(c, 18, 4));
  ctex(scene, 'chip', 7, 5, (c) => drawChip(c, 7, 5));
  ctex(scene, 'hitring', 40, 40, (c) => drawHitRing(c, 40));
  ctex(scene, 'splash', 8, 8, (c) => drawDrop(c, 4, 4, 3, '#5e3317', '#b8763a'));

  // Enemy projectiles
  ctex(scene, 'flake', 12, 12, (c) => drawFlake(c, 12));
  ctex(scene, 'toast', 18, 18, (c) => drawToast(c, 18));
  ctex(scene, 'pea', 16, 16, (c) => drawPea(c, 16));
  ctex(scene, 'icicle', 30, 11, (c) => drawIcicle(c, 30, 11));
  ctex(scene, 'slice', 20, 20, (c) => drawPizzaSlice(c, 20));
  ctex(scene, 'sauce', 16, 16, (c) => drawSauceShot(c, 16));

  // Pickups: bright and glowing so they never read as enemies.
  ctex(scene, 'gem1', 16, 16, (c) => drawGem(c, 16, 8, '#45d9f3', '#e6fbff', '#1b6f86'));
  ctex(scene, 'gem2', 16, 16, (c) => drawGem(c, 16, 10, '#7dff8a', '#efffef', '#22813a'));
  ctex(scene, 'gem3', 16, 16, (c) => drawGem(c, 16, 12.5, '#ff6bd5', '#ffe6f8', '#8f2a78'));
  ctex(scene, 'coin', 14, 14, (c) => drawCoin(c, 14));
  ctex(scene, 'heal', 18, 18, (c) => drawHeal(c, 18));
  ctex(scene, 'chest', 30, 26, (c) => drawBasket(c, 30, 26));
  ctex(scene, 'goldchest', 30, 28, (c) => drawGoldToaster(c, 30, 28));
  ctex(scene, 'bun', 38, 38, (c) => drawStickyBun(c, 38));
  ctex(scene, 'mug', 36, 36, (c) => drawWarmMug(c, 36));
  tex(scene, 'dot', 8, 8, (g) => {
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
  });
  tex(scene, 'frost_ring', 64, 64, (g) => {
    g.fillStyle(0x6cc7f0, 0.25).fillCircle(32, 32, 31);
    g.lineStyle(3, 0xffffff, 0.95).strokeCircle(32, 32, 30);
  });
  tex(scene, 'ring', 64, 64, (g) => {
    g.fillStyle(0xff3b1f, 0.18).fillCircle(32, 32, 31);
    g.lineStyle(2.5, 0xff3b1f, 0.9).strokeCircle(32, 32, 30);
  });

  // Upgrade icons (36×36)
  for (const [key, draw] of Object.entries(ICONS)) ctex(scene, key, 36, 36, draw);
  for (const [key, draw] of Object.entries(UI_ICONS)) ctex(scene, key, 36, 36, draw);
}

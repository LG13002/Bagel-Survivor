// Draws the two pictures that are not part of the game itself, from the game's own art:
//   public/share.jpg     1200x630, the picture a messaging app shows when the link is sent (see index.html)
//   docs/screenshot.png  three phone screens side by side, for the repo's front page
// Run it against the preview server after a build:
//   npm run build && npx vite preview --port 4191 &   then   node tools/sharepic.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL0 = process.argv[2] || 'http://localhost:4191/';
const SAVE = { v: 5, dough: 240, upgrades: { hp: 2 }, unlocked: ['plain', 'everything', 'poppy'], selected: 'everything', cookbook: [], bestTime: 200, totalKills: 900, clears: 2, intro: true, stageClears: { stage1: 2 }, open: ['bakery', 'goals', 'cookbook'], seenVersion: 'x', a2hs: true, backupAt: Date.now(), tips: ['daily'], settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: false } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => localStorage.setItem('everything-bagel-save-v1', JSON.stringify(s)), SAVE);
  const p = await ctx.newPage();
  await p.goto(URL0, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  // ---- share.jpg: the title art, wide.
  const url = await p.evaluate(() => {
    const tex = (k) => window.__game.textures.get(k).getSourceImage();
    // The title screen's own bagel has no eyes (they are drawn live on top), so draw one that has.
    const bagel = window.__art.giantBagel(window.__game.scene.getScene('title'), 'bagel_everything', 400);
    const W = 1200, H = 630;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(tex('title_bg'), -300, -620, 1800, 1800);
    c.drawImage(tex('title_rays'), 330 - 700, 330 - 700, 1400, 1400);
    // The bagel on the left, with a soft shadow under it.
    c.fillStyle = 'rgba(18,12,8,0.35)';
    c.beginPath(); c.ellipse(330, 548, 190, 30, 0, 0, Math.PI * 2); c.fill();
    const d = (430 * 40) / 31;
    c.drawImage(tex(bagel), 330 - d / 2, 318 - d / 2, d, d);
    // The logo on the right: two lines with a thick ink outline, like the title screen.
    const line = (text, y, size, fill) => {
      c.font = `${size}px "Titan One"`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.strokeStyle = '#24160d';
      c.lineWidth = size * 0.22;
      c.strokeText(text, 850, y + size * 0.05);
      c.strokeText(text, 850, y);
      c.fillStyle = fill;
      c.fillText(text, 850, y);
    };
    line('EVERYTHING', 205, 96, '#f2b84b');
    line('BAGEL', 320, 132, '#fff3dc');
    line('Defend the last bakery', 452, 40, '#fff3dc');
    line('from the Stale', 504, 40, '#fff3dc');
    return cv.toDataURL('image/jpeg', 0.88);
  });
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'share.jpg'), Buffer.from(url.split(',')[1], 'base64'));

  // ---- docs/screenshot.png: the title, a run and the menu.
  const shots = [];
  // The title is shot on a fresh page: the share picture above replaced its bagel's texture.
  const t = await ctx.newPage();
  await t.goto(URL0, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(2500);
  shots.push(await t.screenshot());
  await t.evaluate(() => window.__game.scene.getScene('title').scene.start('menu'));
  await t.waitForTimeout(1800);
  await t.evaluate(() => window.__game.scene.getScene('menu').closePopup(false));
  await t.waitForTimeout(700);
  shots.push(await t.screenshot());
  const q = await ctx.newPage();
  await q.goto(`${URL0}?god&t=150`, { waitUntil: 'domcontentloaded' });
  await q.waitForTimeout(1800);
  await q.evaluate(() => window.__game.scene.getScene('title').scene.start('game', { bagel: 'everything', stage: 'stage1' }));
  await q.waitForTimeout(800);
  await q.evaluate(() => {
    const g = window.__game.scene.getScene('game');
    if (g.paused) { g.run.pendingLevels = 0; g.panels.close(); g.setPaused(''); }
    g.addWeapon('lox'); g.addWeapon('pin'); g.weapons.forEach((w) => (w.level = 4));
    g.toppings.set('oven', 3); g.toppings.set('glaze', 2); g.run.level = 14; g.recomputeStats();
    g.panels.openLevelUp = () => { g.run.pendingLevels = 0; };
  });
  await q.keyboard.down('d');
  await q.waitForTimeout(5000);
  shots.splice(1, 0, await q.screenshot());
  const sheet = await q.evaluate(async (imgs) => {
    const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = src; });
    const ims = await Promise.all(imgs.map((s) => load(`data:image/png;base64,${s}`)));
    const w = 390, h = 760, gap = 24;
    const cv = document.createElement('canvas');
    cv.width = w * 3 + gap * 4; cv.height = h + gap * 2;
    const c = cv.getContext('2d');
    c.fillStyle = '#2b2118';
    c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingQuality = 'high';
    ims.forEach((im, i) => {
      const x = gap + i * (w + gap);
      c.save();
      c.beginPath(); c.roundRect(x, gap, w, h, 22); c.clip();
      c.drawImage(im, x, gap, w, h);
      c.restore();
      c.lineWidth = 4; c.strokeStyle = '#24160d';
      c.beginPath(); c.roundRect(x, gap, w, h, 22); c.stroke();
    });
    return cv.toDataURL('image/png');
  }, shots.map((s) => s.toString('base64')));
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'screenshot.png'), Buffer.from(sheet.split(',')[1], 'base64'));
  await b.close();
  console.log('public/share.jpg and docs/screenshot.png written');
})();

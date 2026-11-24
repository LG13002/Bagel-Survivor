// The end of the story, start to finish: the Stale King falls on a save that has never seen the ending, and the
// ending comic, the credits and then the results follow. Checks the save afterwards, that a second win goes straight
// to the results, and takes pictures of every step (OUT folder).
// Usage: node tools/bots/endtest.cjs <outdir>   (PORT=)
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const PORT = process.env.PORT || 4191;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 })).newPage();
  let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message); });
  await p.addInitScript(() => { if (!localStorage.getItem('everything-bagel-save-v1')) localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ dough: 100, upgrades: {}, unlocked: ['plain', 'everything', 'poppy'], selected: 'everything', cookbook: [], bestTime: 300, totalKills: 4321, clears: 4, stageClears: { stage1: 1, stage2: 1, stage3: 1, stage4: 1 }, best: {}, intro: true, open: ['bakery', 'goals', 'cookbook'], seenVersion: '0.16.0', settings: { music: 0, sound: 0, tips: false } })); });
  const scene = () => p.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));
  const ok = (name, cond) => console.log(cond ? 'ok  ' : 'FAIL', name);
  const win = async () => {
    await p.goto(`http://localhost:${PORT}/?god&t=268`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1800);
    await p.evaluate(() => window.__game.scene.getScene('title').scene.start('game', { bagel: 'everything', stage: 'stage5' }));
    await p.waitForFunction(() => !!window.__game.scene.getScene('game').foes?.boss, null, { timeout: 60000 });
    await p.evaluate(() => { const g = window.__game.scene.getScene('game'); if (g.paused) { g.run.pendingLevels = 0; g.panels.close(); g.setPaused(''); } g.panels.openLevelUp = () => { g.run.pendingLevels = 0; }; g.hit(g.foes.boss, 1e6, 0, 0, '', 0); });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/end_fall.png` });
  };
  await win();
  await p.waitForFunction(() => window.__game.scene.isActive('intro'), null, { timeout: 30000 });
  await p.waitForTimeout(1600);
  ok('the ending comic follows the first win', (await scene()) === 'intro');
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/end_page${i + 1}.png` });
    await p.mouse.click(195, 500);
  }
  await p.waitForFunction(() => window.__game.scene.isActive('credits'), null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/end_credits1.png` });
  ok('the credits follow the comic', (await scene()) === 'credits');
  await p.mouse.move(195, 500); await p.mouse.down(); await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/end_credits2.png` }); await p.waitForTimeout(3500); await p.mouse.up();
  await p.waitForFunction(() => window.__game.scene.isActive('results'), null, { timeout: 30000 });
  await p.waitForTimeout(3500);
  await p.mouse.click(195, 300);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/end_results.png` });
  const save = await p.evaluate(() => window.__save.load());
  ok('the save marks the ending as seen', save.ending === true);
  ok('the Bread Bin counts as cleared', save.stageClears.stage5 === 1);
  ok('Pretzel is unlocked', save.unlocked.includes('pretzel'));
  ok('the Bread Bin challenge is paid', (save.goalsPaid || []).includes('breadbin'));
  ok('the Stale King counts as beaten', (save.beaten || []).includes('king'));
  // The title screen in its morning look.
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/end_title.png` });
  // A second win goes straight to the results.
  await win();
  await p.waitForFunction(() => window.__game.scene.isActive('results') || window.__game.scene.isActive('intro'), null, { timeout: 30000 });
  ok('a second win skips the ending', (await scene()) === 'results');
  ok('no page errors', errs === 0);
  await b.close();
})();

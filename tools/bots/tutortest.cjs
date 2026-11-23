// A brand-new save's first minutes: the intro comic, the locked menu, the first run's tips (each once, in order),
// the results screen's Bakery button, NEW tags, and a second run with no tips. Also checks Tips off and Replay.
// Usage: node tools/bots/tutortest.cjs <screenshot folder> [height]   (preview server on port 4191)
const { chromium } = require('playwright');
const SP = process.argv[2] || '.';
const H = +(process.argv[3] || 760);
let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) fails++;
};
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: H }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => { console.log('ERR', e.message); fails++; });
  await p.goto('http://localhost:4191/?god&speed=3', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const scenes = () => p.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key).join());
  const save = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__save.load())));
  const shot = (n) => p.screenshot({ path: `${SP}/${n}_${H}.png` });

  // Title, then the comic: four pages, a tap each.
  await p.mouse.click(195, 300); await p.waitForTimeout(1200);
  check('new save goes from the title to the intro', (await scenes()) === 'intro');
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(1300);
    await shot(`comic${i + 1}`);
    await p.mouse.click(195, 400);
  }
  await p.waitForTimeout(1500);
  check('the comic ends on the menu', (await scenes()) === 'menu');
  check('the comic is marked as watched', (await save()).intro === true);
  await shot('menu_new');
  // Locked buttons say how they open and open nothing.
  const barY = H - 30;
  await p.mouse.click(60, barY); await p.waitForTimeout(400);
  await shot('menu_locked_tap');
  check('a locked Bakery opens nothing', await p.evaluate(() => !window.__game.scene.getScene('menu').popup));
  await p.waitForTimeout(1500);

  // First run. Read which tip is up every 100ms while the bot plays.
  await p.evaluate(() => window.__game.scene.getScene('menu').scene.start('game', { bagel: 'plain', stage: 'stage1' }));
  await p.waitForTimeout(1200);
  const seen = [];
  let cardsShot = false;
  let chestShot = false;
  const watch = async (ms, opts = {}) => {
    for (let t = 0; t < ms; t += 100) {
      await p.waitForTimeout(100);
      const s = await p.evaluate(() => {
        const g = window.__game.scene.getScene('game');
        if (!g.sys.isActive()) return null;
        return { tip: g.tutor.cur ? g.tutor.cur.tip.id : '', paused: g.paused, kills: g.run.kills, lvl: g.run.level, now: g.now };
      });
      if (!s) return;
      if (s.tip && seen[seen.length - 1] !== s.tip) {
        seen.push(s.tip);
        await p.waitForTimeout(350);
        await shot(`tip_${s.tip}`);
      }
      if (s.paused === 'levelup') {
        if (!cardsShot) { cardsShot = true; await p.waitForTimeout(500); await shot('tip_cards'); }
        await p.waitForTimeout(400);
        await p.mouse.click(195, H - 140); // bottom card
        await p.waitForTimeout(200);
      }
      if (s.paused === 'chest') { await p.waitForTimeout(700); if (!chestShot) { chestShot = true; await shot('tip_chest'); } await p.mouse.click(195, 80); }
      if (opts.until && opts.until(s)) return;
    }
  };
  await watch(1500);
  check('the first tip is "move"', seen[0] === 'move', seen.join());
  // Hold still for a moment: the tip must stay until the bagel moves.
  await watch(5500);
  check('"move" waits for the player to move', seen.length === 1, seen.join());
  // Drag to move, then keep circling so seeds get picked up.
  await p.mouse.move(195, H - 150); await p.mouse.down();
  const circle = async (ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const a = (Date.now() - t0) / 900;
      await p.mouse.move(195 + Math.cos(a) * 45, H - 150 + Math.sin(a) * 45);
      await watch(100);
      const st = await p.evaluate(() => window.__game.scene.getScene('game').paused);
      if (st) { await p.mouse.up(); await watch(1500); await p.mouse.move(195, H - 150); await p.mouse.down(); }
    }
  };
  await circle(40000);
  await p.mouse.up();
  check('first-run tips came in order', seen.slice(0, 3).join() === 'move,fire,seeds', seen.join());
  const s1 = await save();
  check('the level-up tip was shown', s1.tips.includes('cards') && cardsShot);
  // A chest brings its tip (the first elite may already have dropped one).
  if (!s1.tips.includes('chest')) {
    await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.loot.drop('chest', g.player.x, g.player.y, 1); });
    await p.waitForTimeout(700);
    await shot('tip_chest');
    await p.mouse.click(195, 80); await p.waitForTimeout(400);
  }
  check('the chest tip was shown', (await save()).tips.includes('chest'));
  // Pause screen (hint along the bottom, recipe badges)
  await p.evaluate(() => window.__game.scene.getScene('game').panels.openPause()); await p.waitForTimeout(400);
  await shot('pause');
  await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.panels.close(); g.setPaused(''); });
  // End the run: results point at the Bakery.
  await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.run.coins += 30; g.endRun(false); });
  await p.waitForTimeout(4500);
  await shot('results_first');
  const s2 = await save();
  check('Bakery and Goals opened after the first run', s2.open.includes('bakery') && s2.open.includes('goals') && !s2.open.includes('cookbook'), JSON.stringify(s2.open));
  check('the results screen pointed at the Bakery', s2.tips.includes('bakery'));
  const by = await p.evaluate(() => { const r = window.__game.scene.getScene('results'); const b = r.children.list.find((o) => o.type === 'Container' && o.getData('label') && o.getData('label').text === 'BAKERY'); return b ? b.y / 2 : 0; });
  check('there is a BAKERY button', by > 0);
  await p.mouse.click(195, by); await p.waitForTimeout(2200);
  await shot('bakery_from_results');
  check('BAKERY goes to the menu with the Bakery open', (await scenes()) === 'menu' && await p.evaluate(() => !!window.__game.scene.getScene('menu').popup));
  await p.evaluate(() => window.__game.scene.getScene('menu').closePopup(true)); await p.waitForTimeout(500);
  await shot('menu_after_first');
  const s3 = await save();
  check('Goals wears a NEW tag, the Bakery no longer does', s3.fresh.join() === 'goals', JSON.stringify(s3.fresh));
  await p.mouse.click(155, barY); await p.waitForTimeout(500);
  check('tapping Goals opens it and clears NEW', (await save()).fresh.length === 0 && await p.evaluate(() => !!window.__game.scene.getScene('menu').popup));
  await p.evaluate(() => window.__game.scene.getScene('menu').closePopup(true)); await p.waitForTimeout(300);
  // Cookbook still locked
  await p.mouse.click(245, barY); await p.waitForTimeout(300);
  check('the Cookbook is still locked', await p.evaluate(() => !window.__game.scene.getScene('menu').popup));

  // Second run: none of the first-run tips come back.
  seen.length = 0;
  await p.evaluate(() => window.__game.scene.getScene('menu').scene.start('game', { bagel: 'plain', stage: 'stage1' }));
  await p.waitForTimeout(1200);
  await p.mouse.move(195, H - 150); await p.mouse.down();
  await circle(15000);
  await p.mouse.up();
  check('no tips on the second run', seen.length === 0, seen.join());
  // A level 5 weapon brings the evolution tip (unless the first run already got there); an evolution opens the Cookbook.
  const hadEvolve = (await save()).tips.includes('evolve');
  await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.weapons[0].level = 5; });
  await watch(2500);
  check('a maxed weapon brings the evolution tip, once', seen.join() === (hadEvolve ? '' : 'evolve'), seen.join());
  await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.toppings.set(g.weapons[0].def.evolveWith, 1); g.loot.drop('chest', g.player.x, g.player.y, 1); });
  await p.waitForTimeout(900);
  check('the first evolution opens the Cookbook', (await save()).open.includes('cookbook'));
  await p.mouse.click(195, 80); await p.waitForTimeout(300);
  await watch(6000);
  // Tips off: nothing new shows, even for something never seen.
  await p.evaluate(() => { window.__save.load().settings.tips = false; const g = window.__game.scene.getScene('game'); g.loot.drop('bun', g.player.x + 60, g.player.y, 1); });
  seen.length = 0;
  await watch(2500);
  check('Tips off: the bun tip stays away', seen.length === 0 && !(await save()).tips.includes('bun'), seen.join());
  await p.evaluate(() => window.__game.scene.getScene('game').panels.openPause()); await p.waitForTimeout(300);
  await shot('pause_tips_off');
  await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.panels.close(); g.paused = ''; g.endRun(false, true); });
  await p.waitForTimeout(1500);
  await shot('results_second');
  // Settings, "Replay tutorial": tips are back on and every one-time tip will show again.
  await p.evaluate(() => window.__game.scene.getScene('results').scene.start('menu')); await p.waitForTimeout(1000);
  await p.evaluate(() => window.__game.scene.getScene('menu').openSettings(0)); await p.waitForTimeout(400);
  const rb = await p.evaluate(() => {
    const find = (list) => { for (const o of list) { if (o.getData && o.getData('label') && o.getData('label').text === 'Replay tutorial') return o; if (o.list) { const f = find(o.list); if (f) return f; } } return null; };
    const o = find(window.__game.scene.getScene('menu').popup.list);
    return o ? [o.x / 2, o.y / 2] : null;
  });
  check('Settings has a Replay tutorial button', !!rb);
  if (rb) { await p.mouse.click(rb[0], rb[1]); await p.waitForTimeout(400); }
  await shot('settings_replayed');
  const s4 = await save();
  check('Replay tutorial: tips on again, nothing marked seen', s4.settings.tips === true && s4.tips.length === 0, JSON.stringify(s4.tips));
  check('Replay tutorial keeps the menu open', s4.open.length === 3);
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();

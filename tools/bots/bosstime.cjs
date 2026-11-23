// When does each stage's boss arrive and first attack? Prints the stage time of both, and how far from the bagel it
// appeared. Run it on two builds to confirm a change hasn't moved a boss's timing.
// Usage: node tools/bots/bosstime.cjs [stages]   (PORT= for another server)
const { chromium } = require('playwright');
const STAGES = (process.argv[2] || 'stage1,stage2,stage3').split(',');
const PORT = process.env.PORT || 4191;
(async () => {
  const b = await chromium.launch();
  for (const stage of STAGES) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ dough: 0, upgrades: {}, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 0, clears: 3, stageClears: { stage1: 1, stage2: 1, stage3: 1 }, best: {}, intro: true })));
    await p.goto(`http://localhost:${PORT}/?god&t=266`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate((stage) => window.__game.scene.getScene('title').scene.start('game', { bagel: 'plain', stage }), stage);
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      const g = window.__game.scene.getScene('game');
      g.panels.openChest = () => {};
      g.panels.openLevelUp = () => { g.run.pendingLevels = 0; };
      if (g.paused === 'levelup') { g.panels.close(); g.setPaused(''); }
      // No weapons, so nothing knocks the boss about.
      g.weapons.forEach((w) => w.destroy());
      g.weapons = [];
      const r = (window.__bt = {});
      const step = g.step.bind(g);
      let prev = null;
      g.step = (dt) => {
        step(dt);
        const e = g.foes.boss;
        if (!e) return;
        if (r.spawn === undefined) {
          r.spawn = g.stageT;
          r.dist = Math.hypot(e.x - g.player.x, e.y - g.player.y);
        } else if (r.attack === undefined && prev !== null && e.attackT > prev) r.attack = g.stageT;
        prev = e.attackT;
      };
    });
    let r = {};
    for (let i = 0; i < 60 && r.attack === undefined; i++) { await p.waitForTimeout(500); r = await p.evaluate(() => window.__bt); }
    console.log(stage.padEnd(7), `arrives ${r.spawn?.toFixed(2)}s`.padEnd(18), `first attack ${r.attack?.toFixed(2)}s`.padEnd(24), `(${(r.attack - r.spawn).toFixed(2)}s after arriving)`.padEnd(26), `appears ${Math.round(r.dist)} from the bagel`);
    await p.close();
  }
  await b.close();
})();

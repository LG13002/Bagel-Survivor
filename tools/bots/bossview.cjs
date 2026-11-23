// A close look at a mini-boss or boss: starts a run just before it arrives, clears the small enemies away, keeps the
// bagel beside it and saves six screenshots (b_<who>_<hp>_<n>.png). hpFrac under 1 cuts its health, to see a second phase.
// Usage: node tools/bots/bossview.cjs <outdir> <t> [boss|mini] [hpFrac] [stage, default stage4]   (t: 148 for a mini-boss, 268 for a boss)
const { chromium } = require('playwright');
const [OUT, T, WHO = 'boss', HP = '1', STAGE = 'stage4'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({dough:100,upgrades:{},unlocked:['plain','everything'],selected:'everything',cookbook:[],bestTime:100,totalKills:900,clears:0,best:{},intro:true,settings:{music:0,sound:0}})));
  await p.goto(`http://localhost:${process.env.PORT||4191}/?god&t=${T}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  await p.evaluate((stage) => window.__game.scene.getScene('title').scene.start('game', { bagel: 'everything', stage }), STAGE);
  await p.waitForTimeout(1500);
  let n = 0, seen = 0;
  for (let i = 0; i < 160 && n < 6; i++) {
    await p.waitForTimeout(400);
    const r = await p.evaluate(([who, hp]) => {
      const s = window.__game.scene.getScene('game');
      if (s.paused==='levelup'||s.paused==='chest') { s.run.pendingLevels = 0; s.panels.close(); s.setPaused(''); }
      const e = who === 'boss' ? s.foes.boss : s.foes.mini;
      for (const o of s.foes.list) if (o.alive && !o.big && Math.random() < 0.8) { o.alive = false; o.sprite.setVisible(false); }
      if (!e) return null;
      if (hp < 1 && e.hp > e.maxHp * hp) e.hp = e.maxHp * hp;
      if (e.dropT <= 0) { const dx = s.player.x - e.x, dy = s.player.y - e.y, d = Math.hypot(dx, dy) || 1; if (d > 190) { s.player.x = e.x + dx / d * 170; s.player.y = e.y + dy / d * 170; } }
      return { hp: Math.round(e.hp), temps: s.floor.temps.length, enr: e.enraged, t: Math.round(s.stageT) };
    }, [WHO, Number(HP)]);
    if (r) { seen++; if (seen % 8 === 6) { await p.screenshot({ path: `${OUT}/b_${WHO}_${HP}_${n}.png` }); console.log(JSON.stringify(r)); n++; } }
  }
  await b.close();
})();

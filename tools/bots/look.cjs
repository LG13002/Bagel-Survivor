// Start a run at stage time t, walk in a slow circle, and save screenshots (p_<t>_<n>.png) to a folder.
// Usage: node tools/bots/look.cjs <outdir> [t] [bagel] [url flags, default god] [stage, default stage4]
// SHOTS=3,8,14 sets the real seconds at which pictures are taken; PORT= for another server.
const { chromium } = require('playwright');
const [OUT, T = '0', BAGEL = 'everything', Q = 'god', STAGE = 'stage4'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CON', m.text()); });
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({dough:100,upgrades:{},unlocked:['plain','everything'],selected:'everything',cookbook:[],bestTime:100,totalKills:900,clears:0,best:{},intro:true,settings:{music:0,sound:0}})));
  await p.goto(`http://localhost:${process.env.PORT||4191}/?${Q}&t=${T}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  await p.evaluate(([bagel, stage]) => window.__game.scene.getScene('title').scene.start('game', { bagel, stage }), [BAGEL, STAGE]);
  await p.waitForTimeout(1500);
  const tick = () => p.evaluate(() => { const s = window.__game.scene.getScene('game'); if (s.paused==='levelup'||s.paused==='chest') { s.run.pendingLevels = 0; s.panels.close(); s.setPaused(''); } return { now: Math.round(s.now), st: Math.round(s.stageT), n: s.foes.list.length, walls: s.floor.walls.length, hp: Math.round(s.player.hp), boss: !!s.foes.boss, mini: !!s.foes.mini }; });
  const shots = (process.env.SHOTS || '3,8,14').split(',').map(Number);
  let i = 0; const t0 = Date.now();
  // walk in a slow circle so shelves come by
  const mv = setInterval(() => p.evaluate((a) => { const s = window.__game.scene.getScene('game'); s.joyVec.x = Math.cos(a); s.joyVec.y = Math.sin(a); }, (Date.now() - t0) / 4000).catch(() => {}), 200);
  while (i < shots.length) {
    await p.waitForTimeout(500);
    const s = await tick();
    if ((Date.now() - t0) / 1000 >= shots[i]) { await p.screenshot({ path: `${OUT}/p_${T}_${i}.png` }); console.log(JSON.stringify(s)); i++; }
  }
  clearInterval(mv);
  await b.close();
})();

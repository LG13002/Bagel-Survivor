const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({dough:100,upgrades:{},unlocked:['plain','everything'],selected:'everything',cookbook:[],bestTime:100,totalKills:900,clears:0,quick:true,best:{'stage1:everything':{time:300,kills:812,cleared:true}}})));
  await p.goto('http://localhost:4191/?god&speed=8&t=255', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${SP}/q_menu.png` });
  // tap PLAY
  await p.mouse.click(195, 844 - 150); await p.waitForTimeout(1500);
  const st = () => p.evaluate(() => { const s = window.__game.scene.getScene('game'); if (!s || !s.sys.isActive()) return { scene: window.__game.scene.getScenes(true).map(x=>x.scene.key).join() }; if (s.paused==='levelup'||s.paused==='chest') { s.pendingLevels = 0; s.closeOverlay(); s.setPaused(''); } return { quick: s.quick, now: Math.round(s.now), stage: Math.round(s.stageT), lvl: s.level, mini: s.miniSpawned, boss: s.bossSpawned, enemies: s.enemies.length }; });
  let shot = false;
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(1000);
    const s = await st();
    if (i % 6 === 0 || s.scene) console.log(JSON.stringify(s));
    if (!shot && s.now > 20) { await p.screenshot({ path: `${SP}/q_hud.png` }); shot = true; }
    if (s.boss) { console.log('boss at', JSON.stringify(s)); break; }
    if (s.scene) break;
  }
  // kill the boss to test victory
  await p.evaluate(() => { const s = window.__game.scene.getScene('game'); s.miniKilled = true; s.endRun(true); });
  await p.waitForTimeout(4000);
  console.log('scenes', await p.evaluate(() => window.__game.scene.getScenes(true).map(x=>x.scene.key).join()));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SP}/q_results.png` });
  console.log('save', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('everything-bagel-save-v1')); return JSON.stringify({dough: s.dough, clears: s.clears, bestTime: s.bestTime, best: s.best}); }));
  await b.close();
})();

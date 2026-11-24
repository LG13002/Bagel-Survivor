// Frame-rate check: a busy stretch of each stage (from 4:00, with three evolved weapons, walking in circles), counting
// real frames for 20 seconds. Prints average frames per second and the slowest 1% of frames.
// Usage: node tools/bots/fpsbench.cjs [stages] [seconds]   (PORT= for another server; SAVER=1 turns on Battery saver; LOOKS=1 wears a hat, sprinkles and a trail)
// Headless Chromium draws in software, so the numbers are far below a phone's. Compare two builds, not the values.
const { chromium } = require('playwright');
const STAGES = (process.argv[2] || 'stage1,stage2,stage3').split(',');
const SECS = Number(process.argv[3] || 20);
const PORT = process.env.PORT || 4191;
const SAVE = { dough: 0, upgrades: {}, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 0, clears: 3, stageClears: { stage1: 1, stage2: 1, stage3: 1 }, best: {}, intro: true, settings: { music: 0, sound: 0, shake: 'full', flash: 'full', saver: process.env.SAVER === '1', lefty: false, tips: false } };
// LOOKS=1 puts a hat, sprinkles and a trail on the bagel, to see what they cost.
if (process.env.LOOKS === '1') SAVE.looks = { owned: ['cowboy', 'rainbow', 'flour'], hat: 'cowboy', sprinkle: 'rainbow', trail: 'flour' };
(async () => {
  const b = await chromium.launch();
  for (const stage of STAGES) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.addInitScript((s) => localStorage.setItem('everything-bagel-save-v1', JSON.stringify(s)), SAVE);
    await p.goto(`http://localhost:${PORT}/?god&t=240`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate((stage) => window.__game.scene.getScene('title').scene.start('game', { bagel: 'plain', stage }), stage);
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const g = window.__game.scene.getScene('game');
      g.weapons.forEach((w) => w.destroy());
      g.weapons = [];
      for (const id of ['sesame', 'storm', 'lox']) g.addWeapon(id);
      for (const w of g.weapons) { w.level = 5; w.evolved = true; }
      g.panels.openChest = () => {};
      g.panels.openLevelUp = () => { g.run.pendingLevels = 0; };
      if (g.paused === 'levelup') { g.panels.close(); g.setPaused(''); }
    });
    // Let the swarm build up before counting.
    const keys = ['d', 's', 'a', 'w'];
    let k = 0;
    await p.keyboard.down(keys[0]);
    const turn = async () => { await p.keyboard.up(keys[k % 4]); k++; await p.keyboard.down(keys[k % 4]); };
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(1000); await turn(); }
    await p.evaluate(() => {
      window.__ft = [];
      let last = performance.now();
      const tick = (now) => { window.__ft.push(now - last); last = now; window.__raf = requestAnimationFrame(tick); };
      window.__raf = requestAnimationFrame(tick);
    });
    for (let i = 0; i < SECS; i++) { await p.waitForTimeout(1000); if (i % 2) await turn(); }
    const r = await p.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const g = window.__game.scene.getScene('game');
      const ft = window.__ft.slice(1).sort((a, b) => a - b);
      const sum = ft.reduce((a, v) => a + v, 0);
      return { fps: +(1000 / (sum / ft.length)).toFixed(1), slow1pct: +ft[Math.floor(ft.length * 0.99)].toFixed(1), enemies: g.foes.list.length, t: Math.round(g.stageT) };
    });
    console.log(stage.padEnd(7), `fps ${r.fps}`.padEnd(10), `slowest 1% of frames ${r.slow1pct} ms`.padEnd(34), `enemies ${r.enemies}, stage time ${r.t}s`);
    await p.close();
  }
  await b.close();
})();

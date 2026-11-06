const { chromium } = require('playwright');
const LV = Number(process.argv[2] || 5);
const STAGE = process.argv[4] || 'stage1';
const T0 = Number(process.argv[5] || 120);
const PORT = process.env.PORT || 4191;
(async () => {
  const b = await chromium.launch();
  for (const wid of (process.argv[3]||'sesame,storm,puddle,lox,coffee,pin').split(',')) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    await p.goto(`http://localhost:${PORT}/?god&speed=6&t=${T0}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    await p.evaluate(([stage, crispy]) => window.__game.scene.getScene('menu').scene.start('game', { bagel: 'plain', practice: false, stage, crispy }), [STAGE, process.env.CRISPY === '1']);
    await p.waitForTimeout(500);
    await p.evaluate(([wid, LV]) => { const g = window.__game.scene.getScene('game');
      g.weapons.forEach(w => w.destroy()); g.weapons = []; if (wid === 'combo' || wid === 'pair') { /* Schmear Flood + Lox Cyclone, merged ('combo') or side by side ('pair') */ g.addWeapon('puddle'); g.addWeapon('lox'); for (const w of g.weapons) { w.level = 5; w.evolved = true; } if (wid === 'combo') { g.weapons[0].destroy(); g.weapons.shift(); g.weapons[0].combo = true; } } else { g.addWeapon(wid); g.weapons[0].level = Math.min(LV,5); if (LV > 5) g.weapons[0].evolved = true; } g.openChest = () => {}; g.openLevelUp = () => { g.pendingLevels = 0; };
      g.gainXp = () => {}; g.__dmg = 0; g.__k0 = g.kills; g.__t0 = g.now;
      const h = g.hit.bind(g); g.hit = (e, d, ...r) => { const before = e.hp; const ok = h(e, d, ...r); if (ok) g.__dmg += Math.min(d, Math.max(0, before)); return ok; }; g.__hurt = 0; g.__inv = 0; const dp = g.damagePlayer.bind(g); g.damagePlayer = (d) => { if (g.now >= g.__inv && !g.paused) { g.__hurt += d * (g.crispy ? 1.25 : 1) /* CRISPY_DMG in GameScene */; g.__inv = g.now + 0.9; } dp(d); };
    }, [wid, LV]);
    await p.keyboard.down('d');
    for (let i = 0; i < 16; i++) { await p.waitForTimeout(800); if (i % 4 === 1) { await p.keyboard.up('d'); await p.keyboard.down('s'); } if (i % 4 === 3) { await p.keyboard.up('s'); await p.keyboard.down('d'); } }
    const st = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); const dt = g.now - g.__t0; return { secs: Math.round(dt), dps: Math.round(g.__dmg / dt), kpm: Math.round((g.kills - g.__k0) / dt * 60), hurtPerMin: Math.round(g.__hurt / dt * 60), paused: g.paused }; });
    console.log(wid, 'L' + LV, JSON.stringify(st));
    await p.close();
  }
  await b.close();
})();

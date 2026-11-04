const { chromium } = require('playwright');
const D = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const quick of [true, false]) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:4191/?god&speed=10&t=140', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    await p.evaluate((q) => window.__game.scene.getScene('menu').scene.start('game', { bagel: 'cinnamon', practice: false, quick: q }), quick);
    const log = []; let shot = false; let lastBuns = 0; let bossSeen = false;
    for (let i = 0; i < 160; i++) {
      await p.waitForTimeout(500);
      const st = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); if (!g || !g.sys.isActive()) return null;
        return { st: Math.round(g.stageT), paused: g.paused, buns: g.pickups.filter(x => x.kind === 'bun').length, seeds: g.pickups.filter(x => x.kind === 'xp').length, boss: !!g.boss, mini: !!g.mini, lvl: g.level, magnet: g.pickups.filter(x=>x.kind==='xp'&&x.magnet).length }; });
      if (!st) { log.push('scene ended'); break; }
      if (st.paused === 'levelup' || st.paused === 'chest') { await p.evaluate(() => { const g = window.__game.scene.getScene('game'); if (g.paused === 'levelup') { g.applyChoice(g.choices()[0]); g.pendingLevels--; g.closeOverlay(); if (g.pendingLevels > 0) g.openLevelUp(); else g.setPaused(''); } else { g.closeOverlay(); g.setPaused(''); } }); }
      if (st.buns !== lastBuns) { log.push(`t=${st.st} buns ${lastBuns}->${st.buns} seeds=${st.seeds} lvl=${st.lvl}`); 
        if (st.buns > lastBuns && !shot) { // move the bun off-screen-ish check arrow: screenshot first
          await p.waitForTimeout(300); await p.screenshot({ path: `${D}/bun-${quick?'q':'f'}.png` }); shot = true;
          // teleport the bun far away to test the arrow
          await p.evaluate(() => { const g = window.__game.scene.getScene('game'); const bn = g.pickups.find(x=>x.kind==='bun'); bn.x = g.player.x + 400; bn.y = g.player.y - 200; bn.sprite.setPosition(bn.x, bn.y); });
          await p.waitForTimeout(400); await p.screenshot({ path: `${D}/bun-arrow-${quick?'q':'f'}.png` }); log.push('after teleport: ' + await p.evaluate(() => { const g = window.__game.scene.getScene('game'); return JSON.stringify({kinds: g.pickups.filter(x=>x.kind!=='xp').map(x=>x.kind+':'+Math.round(x.x-g.player.x)+','+Math.round(x.y-g.player.y)), paused: g.paused}); }));
          // then bring it to the player to collect
          await p.evaluate(() => { const g = window.__game.scene.getScene('game'); const bn = g.pickups.find(x=>x.kind==='bun'); if (!bn) return; bn.x = g.player.x + 10; bn.y = g.player.y; bn.sprite.setPosition(bn.x, bn.y); });
          await p.waitForTimeout(150);
          const m = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); return g.pickups.filter(x=>x.kind==='xp'&&x.magnet).length + '/' + g.pickups.filter(x=>x.kind==='xp').length; });
          log.push('after bun pickup magnetised ' + m);
        }
        lastBuns = st.buns; }
      if (st.boss && !bossSeen) { bossSeen = true; log.push(`boss arrived t=${st.st} seeds on floor=${st.seeds} magnetised=${st.magnet} buns=${st.buns}`); break; }
      if (!quick && st.st > 140 && st.st < 200 && i % 10 === 0) { // speed up full run: kill mini quickly
        await p.evaluate(() => { const g = window.__game.scene.getScene('game'); if (g.mini) g.mini.hp = 1; });
      }
      if (!quick && st.st >= 226 && st.st < 268) { await p.evaluate(() => { const g = window.__game.scene.getScene('game'); for (const e of g.bigs) if (e.kind === 'elite' && e.dropsBun) e.hp = 1; }); }
      if (quick && st.mini) await p.evaluate(() => { const g = window.__game.scene.getScene('game'); if (g.mini) g.mini.hp = 1; });
    }
    console.log(quick ? 'QUICK' : 'FULL', log.join(' | '), errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    await p.close();
  }
  await b.close();
})();

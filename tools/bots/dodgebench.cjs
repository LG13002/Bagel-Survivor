// How much does dodging pay? Plays the same stretch of a stage twice with the same build: once walking in a dumb
// circle, once steering away from the nearest enemies and shots. Hits are counted, not applied (god mode).
// A big gap between the two means skill matters; a small one means the damage can't be avoided.
// Usage: node tools/bots/dodgebench.cjs [stages] [startSecs] [realSecs]   (PORT=, MODES=circle,dodge, SPEED=)
const { chromium } = require('playwright');
const STAGES = (process.argv[2] || 'stage1').split(',');
const T0 = Number(process.argv[3] || 120);
const SECS = Number(process.argv[4] || 14);
const PORT = process.env.PORT || 4191;
const SPEED = process.env.SPEED || 6;
const MODES = (process.env.MODES || 'circle,dodge').split(',');
(async () => {
  const b = await chromium.launch();
  for (const stage of STAGES) {
    for (const mode of MODES) {
      const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
      p.on('pageerror', (e) => console.log('ERR', e.message));
      await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ dough: 0, upgrades: {}, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 0, clears: 3, best: {}, intro: true, settings: { music: 0, sound: 0, tips: false } })));
      await p.goto(`http://localhost:${PORT}/?god&speed=${SPEED}&t=${T0}`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1500);
      await p.evaluate((stage) => window.__game.scene.getScene('title').scene.start('game', { bagel: 'plain', practice: false, stage }), stage);
      await p.waitForTimeout(500);
      await p.evaluate(([mode, T0]) => {
        const g = window.__game.scene.getScene('game');
        // A plain mid-run build: stronger later in the run.
        g.weapons.forEach((w) => w.destroy()); g.weapons = [];
        const lv = T0 >= 200 ? 5 : T0 >= 100 ? 4 : 2;
        for (const id of T0 >= 100 ? ['sesame', 'storm', 'puddle'] : ['sesame', 'storm']) g.addWeapon(id);
        for (const w of g.weapons) { w.level = lv; if (T0 >= 200) w.evolved = true; }
        g.panels.openChest = () => {}; g.panels.openLevelUp = () => { g.run.pendingLevels = 0; };
        if (g.paused === 'levelup') { g.panels.close(); g.setPaused(''); }
        g.gainXp = () => {};
        Object.defineProperty(g, 'hitstop', { get: () => 0, set: () => {} });
        g.__hurt = 0; g.__hits = 0; g.__inv = 0; g.__t0 = g.now; g.__n = 0; g.__near = 0;
        const dp = g.damagePlayer.bind(g);
        g.__src = {};
        g.damagePlayer = (d) => {
          if (g.now >= g.__inv && !g.paused) {
            g.__hurt += d; g.__hits++; g.__inv = g.now + 1.1;
            // What dealt it: the enemy touching the bagel, else a shot beside it, else a floor hazard.
            const pl = g.player; let src = 'hazard';
            for (const sh of g.hz.shots) if (Math.hypot(sh.x - pl.x, sh.y - pl.y) < sh.r + 22) src = 'shot';
            let bd = 1e9;
            for (const e of g.foes.list) { if (!e.alive) continue; const dd = Math.hypot(e.x - pl.x, e.y - pl.y) - e.radius - 18; if (dd < 4 && dd < bd) { bd = dd; src = e.kind; } }
            g.__src[src] = (g.__src[src] || 0) + d;
          }
          dp(d);
        };
        const DIRS = []; for (let i = 0; i < 16; i++) DIRS.push([Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
        let cur = 0;
        g.events.on('update', () => {
          const pl = g.player;
          let near = 0;
          for (const e of g.foes.list) if (e.alive && Math.hypot(e.x - pl.x, e.y - pl.y) < 110) near++;
          g.__near += near; g.__n++;
          if (mode === 'circle') { const a = g.now / 2.2; g.joyVec.x = Math.cos(a); g.joyVec.y = Math.sin(a); return; }
          // Dodge: look 0.35s ahead in 16 directions and take the one with the least to bump into.
          const H = 0.35, sp = 140;
          let best = 0, bestS = Infinity;
          for (let i = 0; i < 16; i++) {
            const fx = pl.x + DIRS[i][0] * sp * H, fy = pl.y + DIRS[i][1] * sp * H;
            let s = i === cur ? -0.15 : 0;
            for (const e of g.foes.list) {
              if (!e.alive) continue;
              const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
              if (d > 260) continue;
              if ((e.state === 1 || e.state === 2) && (e.vx || e.vy) && e.radius < 20 && d < 300) {
                // A charger winding up or dashing: stay out of its lane.
                const vl = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / vl, uy = e.vy / vl;
                const rx = fx - e.x, ry = fy - e.y; const along = rx * ux + ry * uy; const side = Math.abs(rx * uy - ry * ux);
                if (along > -10 && along < 240 && side < e.radius + 26) s += 2.5 * (1 - side / (e.radius + 26));
                continue;
              }
              const es = e.speed * H;
              const ex = e.x - (dx / (d || 1)) * es, ey = e.y - (dy / (d || 1)) * es;
              const R = e.radius + 46;
              const fd = Math.hypot(ex - fx, ey - fy);
              if (fd < R) s += ((R - fd) / R) ** 2 * (e.radius > 20 ? 3 : 1);
            }
            for (const sh of g.hz.shots) {
              const sx = sh.x + (sh.vx ?? 0) * H, sy = sh.y + (sh.vy ?? 0) * H;
              const fd = Math.hypot(sx - fx, sy - fy);
              if (fd < 40) s += ((40 - fd) / 40) ** 2 * 2;
              const md = Math.hypot((sh.x + sx) / 2 - (pl.x + fx) / 2, (sh.y + sy) / 2 - (pl.y + fy) / 2);
              if (md < 30) s += 1;
            }
            if (g.floor.inWall && g.floor.inWall(fx, fy, 16)) s += 2;
            if (s < bestS) { bestS = s; best = i; }
          }
          cur = best;
          g.joyVec.x = DIRS[best][0]; g.joyVec.y = DIRS[best][1];
        });
      }, [mode, T0]);
      await p.waitForTimeout(SECS * 1000);
      const st = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); const dt = g.now - g.__t0; return { secs: Math.round(dt), hurtPerMin: Math.round((g.__hurt / dt) * 60), hitsPerMin: +((g.__hits / dt) * 60).toFixed(1), nearAvg: +(g.__near / g.__n).toFixed(1), alive: g.foes.list.length, from: Object.entries(g.__src).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => k + ' ' + Math.round((v / dt) * 60)).join(', ') }; });
      console.log(stage, 't' + T0, mode.padEnd(6), JSON.stringify(st));
      await p.close();
    }
  }
  await b.close();
})();

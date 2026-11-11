// Bagel bench: plays a Full Run to just before the boss with each bagel, picking level-up cards
// with one fixed policy, and reports damage dealt and damage taken. The bagel never dies: hits are
// counted instead of applied, so every bagel is measured over the same stretch of the run.
// Usage: node tools/bots/bagelbench.cjs [bagels] [stage] [endSecs]
//   e.g. node tools/bots/bagelbench.cjs plain,blueberry stage1 265   (PORT= for another server, CRISPY=1)
const { chromium } = require('playwright');
const ALL = 'plain,everything,poppy,cinnamon,pumpernickel,onion,blueberry,asiago,jalapeno,rainbow';
const BAGELS = (process.argv[2] || ALL).split(',');
const STAGE = process.argv[3] || 'stage1';
const END = Number(process.argv[4] || 265);
const PORT = process.env.PORT || 4191;
const SPEED = Number(process.env.SPEED || 10);
(async () => {
  const b = await chromium.launch();
  for (const bagel of BAGELS) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    await p.goto(`http://localhost:${PORT}/?speed=${SPEED}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(([bagel, stage, crispy]) => window.__game.scene.getScene('menu').scene.start('game', { bagel, practice: false, stage, crispy }), [bagel, STAGE, process.env.CRISPY === '1']);
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const g = window.__game.scene.getScene('game');
      const pl = g.player;
      g.__dmg = 0; g.__hurt = 0; g.__heal = 0; g.__hits = 0;
      // Health is held at half so every heal can be counted, and hits are tallied instead of applied.
      const half = () => g.stats.maxHp / 2;
      Object.defineProperty(pl, 'hp', { get: half, set: (v) => { if (v > half()) g.__heal += v - half(); }, configurable: true });
      g.damagePlayer = (d) => {
        if (g.paused || g.now < pl.invulnUntil) return;
        if (g.crispy) d *= 1.25; // CRISPY_DMG
        const armor = g.armor + (g.toppings.get('frosting') ?? 0);
        if (armor) d = Math.max(d * 0.5, d - armor);
        g.__hurt += d; g.__hits++;
        pl.invulnUntil = g.now + 0.9;
      };
      const h = g.hit.bind(g);
      g.hit = (e, d, ...r) => { const before = e.hp; const ok = h(e, d, ...r); if (ok) g.__dmg += Math.min(d, Math.max(0, before)); return ok; };
      Object.defineProperty(g, 'hitstop', { get: () => 0, set: () => {} });
      // One card policy for every bagel: finish an evolution, level a weapon, add a weapon (up to 3), then toppings.
      const score = (c) => (g.isCombo(c) ? 100 : 0) + (c.kind === 'wup' ? 50 : c.kind === 'wnew' ? (g.weapons.length < 3 ? 60 : 5) : c.kind === 'tup' ? 30 : c.kind === 'tnew' ? 20 : 0) + Math.random();
      g.openLevelUp = () => {
        while (g.pendingLevels > 0) { const cs = g.choices(); cs.sort((a, b) => score(b) - score(a)); g.applyChoice(cs[0]); g.pendingLevels--; }
      };
      const oc = g.openChest.bind(g);
      g.openChest = (gold) => { oc(gold); g.closeOverlay(); g.setPaused(''); };
      // A level-up can open before the bench takes over: resolve it with the same policy.
      if (g.paused === 'levelup') { g.closeOverlay(); g.setPaused(''); }
      g.openLevelUp();
      g.__t0 = g.now;
    });
    // Steer in a slow box so the bagel moves through the swarm; Blueberry also dashes when it can.
    const keys = ['d', 's', 'a', 'w'];
    let k = 0;
    await p.keyboard.down(keys[0]);
    for (let i = 0; i < 400; i++) {
      await p.waitForTimeout(500);
      if (i % 3 === 2) { await p.keyboard.up(keys[k]); k = (k + 1) % 4; await p.keyboard.down(keys[k]); }
      await p.keyboard.press('Space');
      const t = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); return g.paused === 'over' ? 1e9 : g.stageT; });
      if (t >= END) break;
    }
    const st = await p.evaluate(() => {
      const g = window.__game.scene.getScene('game');
      const dt = g.now - g.__t0, hp = g.stats.maxHp;
      return { secs: Math.round(dt), level: g.level, kills: g.kills, dps: Math.round(g.__dmg / dt), maxHp: Math.round(hp), hurtPerMin: Math.round((g.__hurt / dt) * 60), healPerMin: Math.round((g.__heal / dt) * 60), barsLost: +((g.__hurt - g.__heal) / hp).toFixed(2), weapons: g.weapons.map((w) => w.def.id + (w.evolved ? '*' : w.level)).join(' ') };
    });
    console.log(bagel, STAGE, JSON.stringify(st));
    await p.close();
  }
  await b.close();
})();

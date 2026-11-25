// Bagel bench: plays a Full Run to just before the boss with each bagel, picking level-up cards
// with one fixed policy, and reports damage dealt and damage taken. The bagel never dies: hits are
// counted instead of applied, so every bagel is measured over the same stretch of the run.
// Usage: node tools/bots/bagelbench.cjs [bagels] [stage] [endSecs]
//   e.g. node tools/bots/bagelbench.cjs plain,blueberry stage1 265   (PORT= for another server, CRISPY=1)
const { chromium } = require('playwright');
const ALL = 'plain,everything,poppy,cinnamon,pumpernickel,onion,blueberry,asiago,jalapeno,rainbow,garlic,pretzel';
const BAGELS = (process.argv[2] || ALL).split(',');
const STAGE = process.argv[3] || 'stage1';
const END = Number(process.argv[4] || 265);
const PORT = process.env.PORT || 4191;
const SPEED = Number(process.env.SPEED || 10);
(async () => {
  const b = await chromium.launch();
  for (const bagel of BAGELS) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    // KIT=1: every Bakery upgrade at rank 2, the Daily Run's set kit, for a fair comparison with a Daily.
    if (process.env.KIT === '1') await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ v: 5, dough: 0, upgrades: { hp: 2, dmg: 2, speed: 2, magnet: 2, proof: 2, luck: 2, reroll: 2, revive: 2, armor: 2, bin: 2 }, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 0, totalKills: 0, clears: 1, intro: true, stageClears: { stage1: 1 }, settings: { music: 0, sound: 0, tips: false } })));
    // DAY=YYYY-MM-DD plays that day's Daily Run instead (its stage, bagel and twist; the bagel and stage arguments are ignored).
    const DAY = process.env.DAY || '';
    await p.goto(`http://localhost:${PORT}/?speed=${SPEED}${DAY ? `&day=${DAY}` : ''}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(([bagel, stage, crispy, day]) => window.__game.scene.getScene('title').scene.start('game', day ? { daily: true } : { bagel, practice: false, stage, crispy }), [bagel, STAGE, process.env.CRISPY === '1', DAY]);
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
        const armor = g.run.armor + (g.toppings.get('frosting') ?? 0);
        if (armor) d = Math.max(d * 0.5, d - armor);
        g.__hurt += d; g.__hits++;
        pl.invulnUntil = g.now + 0.9;
      };
      const h = g.hit.bind(g);
      g.hit = (e, d, ...r) => { const before = e.hp; const ok = h(e, d, ...r); if (ok) g.__dmg += Math.min(d, Math.max(0, before)); return ok; };
      Object.defineProperty(g, 'hitstop', { get: () => 0, set: () => {} });
      // One card policy for every bagel: finish an evolution, level a weapon, add a weapon (up to 3), then toppings.
      const score = (c) => (g.panels.isCombo(c) ? 100 : 0) + (c.kind === 'wup' ? 50 : c.kind === 'wnew' ? (g.weapons.length < 3 ? 60 : 5) : c.kind === 'tup' ? 30 : c.kind === 'tnew' ? 20 : 0) + Math.random();
      g.panels.openLevelUp = () => {
        while (g.run.pendingLevels > 0) { const cs = g.choices(); cs.sort((a, b) => score(b) - score(a)); g.applyChoice(cs[0]); g.run.pendingLevels--; }
      };
      const oc = g.panels.openChest.bind(g.panels);
      g.panels.openChest = (gold) => { oc(gold); g.panels.close(); g.setPaused(''); };
      // A level-up can open before the bench takes over: resolve it with the same policy.
      if (g.paused === 'levelup') { g.panels.close(); g.setPaused(''); }
      g.panels.openLevelUp();
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
      return { twist: g.twist, bagel: g.bagel.id, stage: g.stage.id, secs: Math.round(dt), level: g.run.level, kills: g.run.kills, dps: Math.round(g.__dmg / dt), maxHp: Math.round(hp), hurtPerMin: Math.round((g.__hurt / dt) * 60), healPerMin: Math.round((g.__heal / dt) * 60), barsLost: +((g.__hurt - g.__heal) / hp).toFixed(2), coins: g.run.coins, doughIfCleared: g.runDough(true), doughIfLost: g.runDough(false), weapons: g.weapons.map((w) => w.def.id + (w.evolved ? '*' : w.level)).join(' ') };
    });
    console.log(DAY ? `daily ${DAY} ${st.twist} ${st.bagel} ${st.stage}` : `${bagel} ${STAGE}`, JSON.stringify(st));
    await p.close();
  }
  await b.close();
})();

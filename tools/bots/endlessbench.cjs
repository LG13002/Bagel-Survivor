// Endless bench: plays an Endless run out to 15:00 (or longer) with the bagel bench's card policy, and prints one line
// a minute: level, defeats, enemies alive, damage taken that minute (counted, not applied), the Dough the run would
// pay if it ended there, boss rounds, and three things for the speed check: memory in use (after a forced clean-up),
// the number of things on screen, and frames a second. Memory and object counts should level off, not climb.
// Usage: node tools/bots/endlessbench.cjs [stage] [minutes] [bagel]   (defaults stage1 15 plain; PORT=, SPEED= default 8, CRISPY=1)
const { chromium } = require('playwright');
const STAGE = process.argv[2] || 'stage1';
const MINS = Number(process.argv[3] || 15);
const BAGEL = process.argv[4] || 'plain';
const PORT = process.env.PORT || 4191;
const SPEED = Number(process.env.SPEED || 8);
(async () => {
  const b = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('everything-bagel-save-v1', JSON.stringify({ v: 5, dough: 0, upgrades: { hp: 3, dmg: 3, speed: 3, magnet: 3, luck: 2, armor: 2 }, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 0, clears: 5, best: {}, intro: true, ending: true, stageClears: { stage1: 1, stage2: 1, stage3: 1, stage4: 1, stage5: 1 }, weapons: ['knife', 'jar', 'toastpop', 'iron', 'cutter', 'whisk'], seenVersion: 'x', settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: false } })));
  await p.goto(`http://localhost:${PORT}/?speed=${SPEED}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(([bagel, stage, crispy]) => window.__game.scene.getScene('title').scene.start('game', { bagel, stage, endless: true, crispy }), [BAGEL, STAGE, process.env.CRISPY === '1']);
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const g = window.__game.scene.getScene('game');
    const pl = g.player;
    g.__hurt = 0; g.__cards = { heal: 0, coin: 0 };
    const half = () => g.stats.maxHp / 2;
    Object.defineProperty(pl, 'hp', { get: half, set: () => {}, configurable: true });
    g.damagePlayer = (d) => {
      if (g.paused || g.now < pl.invulnUntil) return;
      if (g.crispy) d *= 1.25;
      const armor = g.run.armor + (g.toppings.get('frosting') ?? 0);
      if (armor) d = Math.max(d * 0.5, d - armor);
      g.__hurt += d;
      pl.invulnUntil = g.now + 1.1;
    };
    Object.defineProperty(g, 'hitstop', { get: () => 0, set: () => {} });
    const score = (c) => (g.panels.isCombo(c) ? 100 : 0) + (c.kind === 'wup' ? 50 : c.kind === 'wnew' ? 60 : c.kind === 'tup' ? 30 : c.kind === 'tnew' ? 20 : c.kind === 'coin' ? 1 : 0) + Math.random();
    g.panels.openLevelUp = () => {
      while (g.run.pendingLevels > 0) { const cs = g.choices(); cs.sort((a, b) => score(b) - score(a)); if (cs[0].kind === 'coin' || cs[0].kind === 'heal') g.__cards[cs[0].kind]++; g.applyChoice(cs[0]); g.run.pendingLevels--; }
    };
    const oc = g.panels.openChest.bind(g.panels);
    g.panels.openChest = (gold) => { oc(gold); g.panels.close(); g.setPaused(''); };
    if (g.paused === 'levelup') { g.panels.close(); g.setPaused(''); }
    g.panels.openLevelUp();
    window.__ft = [];
    let last = performance.now();
    const tick = (now) => { window.__ft.push(now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const keys = ['d', 's', 'a', 'w'];
  let k = 0;
  await p.keyboard.down(keys[0]);
  let nextMin = 1;
  let chasing = false;
  let lastHurt = 0;
  console.log(`${STAGE} endless, ${BAGEL}${process.env.CRISPY === '1' ? ', Extra Crispy' : ''}`);
  for (let i = 0; i < 20000 && nextMin <= MINS; i++) {
    await p.waitForTimeout(400);
    // Walk a slow box; when a boss is out and far away, walk to it instead, so it gets fought rather than outrun.
    const toBoss = await p.evaluate(() => { const g = window.__game.scene.getScene('game'); const bo = g.foes.boss; if (!bo || !bo.alive) return null; const dx = bo.x - g.player.x, dy = bo.y - g.player.y; return Math.hypot(dx, dy) > 130 ? [dx, dy] : null; });
    if (toBoss) {
      const want = [toBoss[0] > 30 ? 'd' : toBoss[0] < -30 ? 'a' : '', toBoss[1] > 30 ? 's' : toBoss[1] < -30 ? 'w' : ''].filter(Boolean);
      for (const key of keys) { if (want.includes(key)) await p.keyboard.down(key); else await p.keyboard.up(key); }
      chasing = true;
    } else if (chasing || i % 4 === 3) {
      for (const key of keys) await p.keyboard.up(key);
      k = (k + 1) % 4;
      await p.keyboard.down(keys[k]);
      chasing = false;
    }
    const st = await p.evaluate((want) => {
      const g = window.__game.scene.getScene('game');
      if (g.paused === 'over') return { over: true };
      if (g.stageT < want * 60) return null;
      if (window.gc) window.gc();
      const ft = window.__ft.splice(0).slice(1);
      const count = (o) => 1 + (o.list ? o.list.reduce((a, q) => a + count(q), 0) : 0);
      return {
        level: g.run.level, kills: g.run.kills, alive: g.foes.list.length, hurt: Math.round(g.__hurt), dough: g.runDough(false), round: g.director.bossRound, cleared: g.director.endlessCleared, boss: g.foes.boss && g.foes.boss.alive ? Math.round(g.foes.boss.hp) : 0, coins: g.run.coins, coinCards: g.__cards.coin,
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 0, objects: g.children.list.reduce((a, o) => a + count(o), 0), textures: g.textures.getTextureKeys().length,
        fps: ft.length ? +(1000 / (ft.reduce((a, v) => a + v, 0) / ft.length)).toFixed(1) : 0, seeds: g.loot.list.length, weapons: g.weapons.map((w) => w.def.id + (w.evolved ? '*' : w.level)).join(' '),
      };
    }, nextMin);
    if (st && st.over) { console.log('the run ended'); break; }
    if (st) {
      console.log(`${String(nextMin).padStart(2)}:00  level ${String(st.level).padStart(3)}  defeats ${String(st.kills).padStart(5)}  alive ${String(st.alive).padStart(3)}  hurt/min ${String(st.hurt - lastHurt).padStart(4)}  dough ${String(st.dough).padStart(5)} (coins ${st.coins}, coin cards ${st.coinCards})  ${st.cleared ? `cleared, boss round ${st.round}` : 'first boss not beaten'}${st.boss ? ` (boss out, ${st.boss} health)` : ''}  mem ${st.heapMB} MB  objects ${st.objects}  textures ${st.textures}  fps ${st.fps}${nextMin === 5 || nextMin === MINS ? `  [${st.weapons}]` : ''}`);
      lastHurt = st.hurt;
      nextMin++;
    }
  }
  await b.close();
})();

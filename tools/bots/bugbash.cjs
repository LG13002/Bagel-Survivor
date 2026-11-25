// Bug bash: plays every stage in every mode (Full, Quick, Endless, Extra Crispy, Practice) and the Daily Run on seven
// days (one per twist), with every bagel at least once, through the real level-up, chest and results screens, and
// prints every page error it meets. Level-ups are answered by tapping a random button on the panel (a card, a bin,
// Reroll or Skip), so the panels get a workout too. One run per stage is played without god mode, to its death.
// Usage: node tools/bots/bugbash.cjs [filter]   (PORT=, SPEED= default 10; filter is a word in the case name, e.g. stage4 or daily)
// Exits with code 1 if any case had an error or got stuck.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 4191;
const SPEED = Number(process.env.SPEED || 10);
const FILTER = process.argv[2] || '';
const BAGELS = ['plain', 'everything', 'poppy', 'cinnamon', 'pumpernickel', 'onion', 'blueberry', 'asiago', 'jalapeno', 'rainbow', 'garlic', 'pretzel'];
const STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'];
const MODES = ['full', 'quick', 'endless', 'crispy', 'practice', 'mortal'];
const save = (ending) => ({ v: 5, dough: 500, upgrades: { hp: 2, dmg: 2, reroll: 3, bin: 3, revive: 1, luck: 2 }, unlocked: BAGELS, selected: 'plain', cookbook: [], bestTime: 300, totalKills: 500, clears: 5, best: {}, intro: true, ending, stageClears: { stage1: 1, stage2: 1, stage3: 1, stage4: 1, stage5: 1 }, weapons: ['knife', 'jar', 'toastpop', 'iron', 'cutter', 'whisk'], open: ['bakery', 'goals', 'cookbook'], seenVersion: 'x', settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: true } });

(async () => {
  const b = await chromium.launch();
  // One day for each Daily twist.
  const p0 = await b.newPage();
  await p0.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await p0.waitForTimeout(1500);
  const days = await p0.evaluate(() => {
    const out = {};
    for (let i = 1; i <= 90 && Object.keys(out).length < 7; i++) {
      const d = new Date(2027, 0, i);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const r = window.__daily.dailyFor(s);
      if (!out[r.twist]) out[r.twist] = s;
    }
    return out;
  });
  await p0.close();

  const cases = [];
  let n = 0;
  for (const stage of STAGES) for (const mode of MODES) cases.push({ name: `${stage} ${mode}`, stage, mode, bagel: BAGELS[n++ % BAGELS.length] });
  for (const [twist, day] of Object.entries(days)) cases.push({ name: `daily ${twist}`, mode: 'daily', day });
  // One Bread Bin win on a save that has not seen the ending: comic, credits, then results.
  cases.push({ name: 'stage5 first-ending', stage: 'stage5', mode: 'full', bagel: 'pretzel', fresh: true });

  let bad = 0;
  for (const cs of cases.filter((c) => c.name.includes(FILTER))) {
    const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await p.addInitScript((s) => localStorage.setItem('everything-bagel-save-v1', JSON.stringify(s)), save(!cs.fresh));
    const god = cs.mode !== 'mortal';
    await p.goto(`http://localhost:${PORT}/?speed=${SPEED}${god ? '&god' : ''}${cs.day ? `&day=${cs.day}` : ''}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate((c) => {
      const data = c.mode === 'daily' ? { daily: true } : { bagel: c.bagel, stage: c.stage, practice: c.mode === 'practice', quick: c.mode === 'quick', endless: c.mode === 'endless', crispy: c.mode === 'crispy' };
      window.__game.scene.getScene('title').scene.start('game', data);
    }, cs);
    await p.waitForTimeout(700);
    const keys = ['d', 's', 'a', 'w'];
    let k = 0;
    await p.keyboard.down(keys[0]);
    let note = '';
    let lastT = -1;
    let still = 0;
    const endAt = cs.mode === 'endless' ? 430 : 9999;
    for (let i = 0; i < 900; i++) {
      await p.waitForTimeout(250);
      if (i % 6 === 5) { await p.keyboard.up(keys[k]); k = (k + 1) % 4; await p.keyboard.down(keys[k]); }
      if (i % 4 === 0) await p.keyboard.press('Space');
      const st = await p.evaluate(([endAt, S0]) => {
        const game = window.__game;
        const on = (key) => game.scene.isActive(key);
        if (on('results')) return { done: 'results' };
        if (on('intro') || on('credits')) return { story: on('intro') ? 'intro' : 'credits' };
        if (!on('game')) return { other: true };
        const g = game.scene.getScene('game');
        const S = g.scale.width / window.innerWidth;
        // A boss that has been out for a while is finished off, so every case reaches its end.
        const boss = g.foes.boss;
        if (boss && !g.run.pendingWin) { boss.__seen = (boss.__seen || 0) + 1; if (boss.__seen > 60 && boss.hp > 40) boss.hp = 40; }
        if (g.stageT > endAt && !g.paused) g.endRun(false);
        let taps = [];
        if (g.paused === 'levelup' || g.paused === 'chest') {
          const ov = g.panels.overlay;
          const walk = (o, ox, oy) => { if (o.input && o.input.enabled && o.visible) taps.push({ x: (ox + o.x) / S, y: (oy + o.y) / S, w: (o.width || 0) / S }); (o.list || []).forEach((q) => walk(q, ox + o.x, oy + o.y)); };
          if (ov) ov.list.forEach((o) => walk(o, ov.x, ov.y));
        }
        return { t: g.stageT, paused: g.paused, taps, level: g.run.level, w: window.innerWidth, h: window.innerHeight };
      }, [endAt]);
      if (st.done) { note = 'results'; break; }
      if (st.story) { await p.mouse.click(195, 400); continue; }
      if (st.other) continue;
      if (st.paused === 'levelup' && st.taps.length) {
        // Mostly a card (the wide ones); now and then any button on the panel.
        const cards = st.taps.filter((t) => t.w > 250);
        const pick = Math.random() < 0.75 && cards.length ? cards : st.taps;
        const t = pick[Math.floor(Math.random() * pick.length)];
        await p.mouse.click(t.x, t.y);
      } else if (st.paused === 'chest') await p.mouse.click(st.w / 2, st.h / 2);
      else if (st.paused === 'pause') await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.panels.close(); g.setPaused(''); });
      if (st.t === lastT && !st.paused) still++;
      else if (st.t !== lastT) still = 0;
      lastT = st.t;
      if (still > 40) { note = `STUCK at ${Math.round(st.t)}s`; break; }
    }
    await p.keyboard.up(keys[k]);
    let res = {};
    if (note === 'results') {
      await p.waitForTimeout(800);
      // Tap once to finish the count-up, then go back to the menu the way a player would not be able to break.
      await p.mouse.click(195, 300);
      await p.waitForTimeout(400);
      res = await p.evaluate(() => { const r = window.__game.scene.getScene('results'); const d = r.result || r.data || {}; return { victory: d.victory, time: Math.round(d.time || 0), level: d.level, dough: d.dough }; });
      await p.evaluate(() => window.__game.scene.getScene('results').scene.start('menu'));
      await p.waitForTimeout(900);
    } else if (!note) note = 'TIMED OUT';
    const ok = note === 'results' && !errors.length;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${cs.name.padEnd(22)} ${(cs.bagel || '').padEnd(13)} ${note} ${JSON.stringify(res)}${errors.length ? `\n     ${[...new Set(errors)].slice(0, 5).join('\n     ')}` : ''}`);
    await p.close();
  }
  await b.close();
  console.log(bad ? `${bad} case(s) failed` : 'all cases clean');
  process.exit(bad ? 1 : 0);
})();

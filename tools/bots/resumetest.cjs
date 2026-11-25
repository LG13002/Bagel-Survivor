// Close and resume: plays a stretch of every stage in several modes, closes the page the way a phone kills an app
// (a reload with no warning), resumes the saved run and checks that the build, the progress, the clock and the boss
// came back. Also resumes from an open level-up, from the middle of each boss fight and from a Daily Run.
// Usage: node tools/bots/resumetest.cjs [filter]   (PORT=)   Exits with code 1 if a check fails.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 4191;
const FILTER = process.argv[2] || '';
const BAGELS = ['plain', 'everything', 'poppy', 'cinnamon', 'pumpernickel', 'onion', 'blueberry', 'asiago', 'jalapeno', 'rainbow', 'garlic', 'pretzel'];
const SAVE = { v: 5, dough: 0, upgrades: { reroll: 2, bin: 2, revive: 1 }, unlocked: BAGELS, selected: 'plain', cookbook: [], bestTime: 300, totalKills: 500, clears: 5, best: {}, intro: true, ending: true, stageClears: { stage1: 1, stage2: 1, stage3: 1, stage4: 1, stage5: 1 }, weapons: ['knife', 'jar', 'toastpop', 'iron', 'cutter', 'whisk'], open: ['bakery', 'goals', 'cookbook'], seenVersion: 'x', settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: false } };

const cases = [];
let n = 0;
for (const stage of ['stage1', 'stage2', 'stage3', 'stage4', 'stage5']) {
  cases.push({ name: `${stage} full mid-run`, stage, t: 95, data: {} });
  cases.push({ name: `${stage} quick mid-run`, stage, t: 95, data: { quick: true } });
  cases.push({ name: `${stage} crispy boss`, stage, t: 266, data: { crispy: true }, boss: true });
  cases.push({ name: `${stage} endless after boss`, stage, t: 266, data: { endless: true }, boss: true, killBoss: true });
  cases.push({ name: `${stage} level-up open`, stage, t: 60, data: {}, levelup: true });
}
cases.push({ name: 'practice mid-run', stage: 'stage2', t: 0, data: { practice: true } });
cases.push({ name: 'daily mid-run', t: 95, data: { daily: true }, day: '2027-01-05' });
cases.push({ name: 'daily boss', t: 266, data: { daily: true }, day: '2027-01-06', boss: true });

const read = () => {
  const g = window.__game.scene.getScene('game');
  return {
    stage: g.stage.id, bagel: g.bagel.id, quick: g.quick, endless: g.endless, crispy: g.crispy, practice: g.practice, daily: g.daily ? g.daily.date : '', twist: g.twist,
    t: g.stageT, level: g.run.level, pending: g.run.pendingLevels, kills: g.run.kills, coins: g.run.coins,
    weapons: g.weapons.map((w) => `${w.def.id}${w.evolved ? '*' : w.level}`).join(' '), toppings: [...g.toppings].map(([k, v]) => k + v).join(' '),
    boss: g.foes.boss && g.foes.boss.alive ? Math.round(g.foes.boss.hp) : 0, bossKind: g.foes.boss && g.foes.boss.alive ? g.foes.boss.kind : '',
    round: g.director.bossRound, cleared: g.director.endlessCleared, rerolls: g.run.rerolls, bins: g.run.banishes, paused: g.paused,
  };
};

(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const cs of cases.filter((c) => c.name.includes(FILTER))) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addInitScript((s) => { if (!localStorage.getItem('everything-bagel-save-v1')) localStorage.setItem('everything-bagel-save-v1', JSON.stringify(s)); }, SAVE);
    const url = `http://localhost:${PORT}/?god&speed=4&t=${cs.t}${cs.day ? `&day=${cs.day}` : ''}`;
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.evaluate(([c, bagel]) => window.__game.scene.getScene('title').scene.start('game', c.data.daily ? c.data : { bagel, stage: c.stage, ...c.data }), [cs, BAGELS[n++ % BAGELS.length]]);
    await p.waitForTimeout(600);
    // Play: cards are taken as they come (the first card), chests are closed, except in the level-up case.
    await p.keyboard.down('d');
    const tend = async (keepLevelUp) => p.evaluate((keep) => {
      const g = window.__game.scene.getScene('game');
      if (g.paused === 'chest' || g.paused === 'pause') { g.panels.close(); g.setPaused(''); }
      if (g.paused === 'levelup' && !keep) { g.applyChoice(g.choices()[0]); g.run.pendingLevels--; g.panels.close(); if (g.run.pendingLevels > 0) g.panels.openLevelUp(); else g.setPaused(''); }
      return { paused: g.paused, boss: !!(g.foes.boss && g.foes.boss.alive), t: g.stageT, round: g.director.bossRound, cleared: g.director.endlessCleared };
    }, keepLevelUp);
    let ready = false;
    for (let i = 0; i < 240 && !ready; i++) {
      await p.waitForTimeout(250);
      const st = await tend(cs.levelup && i > 8);
      if (cs.levelup) ready = i > 8 && st.paused === 'levelup';
      else if (cs.killBoss) {
        if (st.boss && !st.cleared) await p.evaluate(() => { const g = window.__game.scene.getScene('game'); g.hit(g.foes.boss, 1e6); });
        ready = st.cleared && st.t > 300;
      } else if (cs.boss) ready = st.boss && st.t > 276;
      else ready = i > 28;
    }
    await p.keyboard.up('d');
    if (!ready) { console.log(`FAIL ${cs.name}: never reached the moment to close at`, JSON.stringify(await p.evaluate(read)), errors.join(' | ')); bad++; await ctx.close(); continue; }
    // Wait for the game's own snapshot (every 5 seconds of play, and whenever a panel opens), then kill the page.
    if (!cs.levelup) await p.waitForTimeout(1600);
    const before = await p.evaluate(read);
    await p.goto(`http://localhost:${PORT}/?god&speed=4${cs.day ? `&day=${cs.day}` : ''}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const has = await p.evaluate(() => !!localStorage.getItem('everything-bagel-run-v1') || Object.keys(localStorage).join(','));
    await p.evaluate(() => window.__game.scene.getScene('title').scene.start('game', { resume: true }));
    await p.waitForTimeout(900);
    const after = await p.evaluate(read);
    const fails = [];
    for (const k of ['stage', 'bagel', 'quick', 'endless', 'crispy', 'practice', 'daily', 'twist', 'round', 'cleared']) if (before[k] !== after[k]) fails.push(`${k}: ${before[k]} became ${after[k]}`);
    // The snapshot can be a few seconds old: the clock and counts may be a little behind, never ahead, never far.
    if (after.t > before.t + 6 || after.t < before.t - 9 * (cs.data.quick ? 5 / 3 : 1)) fails.push(`clock: ${before.t.toFixed(1)} became ${after.t.toFixed(1)}`);
    if (after.level > before.level + 1 || after.level < before.level - 2) fails.push(`level: ${before.level} became ${after.level}`);
    if (after.level === before.level && after.weapons !== before.weapons) fails.push(`weapons: ${before.weapons} became ${after.weapons}`);
    if (after.level === before.level && after.toppings !== before.toppings) fails.push(`toppings: ${before.toppings} became ${after.toppings}`);
    if (after.kills > before.kills + 60 || after.kills < before.kills * 0.8 - 30) fails.push(`defeats: ${before.kills} became ${after.kills}`);
    if (cs.boss && !cs.killBoss && (!after.boss || after.bossKind !== before.bossKind)) fails.push(`boss: ${before.bossKind} ${before.boss} became ${after.bossKind} ${after.boss}`);
    if (cs.levelup && after.pending < 1 && after.level === before.level) fails.push('the open level-up was lost');
    if (errors.length) fails.push(`errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
    // Play on for a moment to see that the resumed run runs.
    await p.keyboard.down('s');
    for (let i = 0; i < 8; i++) { await p.waitForTimeout(250); await tend(false); }
    const later = await p.evaluate(read);
    if (later.t <= after.t) fails.push('the resumed run did not move on');
    if (errors.length && !fails.some((f) => f.startsWith('errors'))) fails.push(`errors after resume: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
    if (fails.length) bad++;
    console.log(`${fails.length ? 'FAIL' : 'ok  '} ${cs.name.padEnd(28)} ${after.bagel.padEnd(13)} t ${before.t.toFixed(0)} to ${after.t.toFixed(0)}, level ${before.level} to ${after.level}${after.boss ? `, boss ${before.boss} to ${after.boss}` : ''}${fails.length ? `\n     ${fails.join('\n     ')}` : ''}${typeof has === 'string' ? ` [keys ${has}]` : ''}`);
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `${bad} case(s) failed` : 'all cases clean');
  process.exit(bad ? 1 : 0);
})();

// The Daily Run, end to end: the same date gives the same run, a new date a new one; the first run of a day is
// scored and pays its bonus once; a replay pays nothing; the streak grows day by day and resets after a missed day;
// and none of it touches stage clears or stage bests.
// Usage: node tools/bots/dailytest.cjs [folder for screenshots]
const { chromium } = require('playwright');
const SP = process.argv[2] || '.';
const PORT = process.env.PORT || 4191;
const KEY = 'everything-bagel-save-v1';
let failed = 0;
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('ERR', e.message); failed++; });
  const start = { v: 5, dough: 100, upgrades: { hp: 5 }, unlocked: ['plain'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 900, clears: 1, stageClears: { stage1: 1 }, best: { 'stage1:plain': { time: 300, kills: 800, cleared: true } }, intro: true, open: ['bakery', 'goals', 'cookbook'], tips: [], seenVersion: 'x', backupNudge: Date.now(), looks: { owned: ['beanie', 'hearts'], hat: 'beanie', trail: 'hearts' }, settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: true } };
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, start]);
  const save = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  const open = async (day) => {
    await p.goto(`http://localhost:${PORT}/?day=${day}&god&speed=6`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2200);
  };
  // Plays the day's run for a few seconds, then ends it (a win or a loss), and waits for the results screen.
  const play = async (win, shot) => {
    await p.evaluate(() => { const g = window.__game; (g.scene.getScene('title').sys.isActive() ? g.scene.getScene('title') : g.scene.getScenes(true)[0]).scene.start('game', { daily: true }); });
    await p.waitForTimeout(2500);
    if (shot) await p.screenshot({ path: `${SP}/daily_run.png` });
    const info = await p.evaluate(() => { const s = window.__game.scene.getScene('game'); return { date: s.daily && s.daily.date, stage: s.stage.id, bagel: s.bagel.id, twist: s.twist, scored: s.dailyScored, maxHp: s.stats.maxHp, quick: s.quick }; });
    await p.evaluate((w) => window.__game.scene.getScene('game').endRun(w), win);
    await p.waitForTimeout(win ? 8500 : 4500);
    if (shot) { await p.waitForTimeout(2500); await p.screenshot({ path: `${SP}/daily_results.png` }); }
    return info;
  };

  await open('2026-12-01');
  const days = await p.evaluate(() => { const out = []; for (let i = 1; i <= 30; i++) out.push(window.__daily.dailyFor(`2026-12-${String(i).padStart(2, '0')}`)); return out; });
  const again = await p.evaluate(() => window.__daily.dailyFor('2026-12-01'));
  check(JSON.stringify(days[0]) === JSON.stringify(again), 'the same date gives the same run');
  check(new Set(days.map((d) => d.stage)).size >= 4 && new Set(days.map((d) => d.twist)).size >= 6 && new Set(days.map((d) => d.bagel)).size >= 7, `30 days are varied: ${new Set(days.map((d) => d.stage)).size} stages, ${new Set(days.map((d) => d.twist)).size} twists, ${new Set(days.map((d) => d.bagel)).size} bagels`);
  check(days.slice(1).filter((d, i) => JSON.stringify({ ...d, date: 0 }) === JSON.stringify({ ...days[i], date: 0 })).length === 0, 'no two days in a row are the same run');

  // Day 1: the scored run, a win.
  const i1 = await play(true, true);
  check(i1.date === '2026-12-01' && i1.stage === days[0].stage && i1.bagel === days[0].bagel && i1.twist === days[0].twist, `the run is the day's: ${i1.stage}, ${i1.bagel}, ${i1.twist}`);
  check(i1.scored, 'the first run of the day is scored');
  let s = await save();
  const d1 = s.dough;
  check(s.daily.days['2026-12-01'] && s.daily.days['2026-12-01'].c === true, 'the result is kept, as a clear');
  check(s.daily.streak === 1 && s.daily.best === 1 && s.daily.wins === 1, 'streak 1 after the first day');
  check(d1 >= 130, `the bonus was paid (Dough ${start.dough} to ${d1})`);
  check(s.clears === 1 && s.stageClears.stage1 === 1 && Object.keys(s.stageClears).length === 1 && Object.keys(s.best).length === 1, 'stage clears and stage bests are untouched');
  check(s.stats.runs === 1, 'the run counts in the stats');

  // The same day again: a replay, for fun.
  const i2 = await play(true, false);
  s = await save();
  check(!i2.scored, 'a second run the same day is not scored');
  check(s.dough === d1 && s.daily.streak === 1 && s.daily.wins === 1 && s.stats.runs === 1, 'the replay pays and counts nothing');

  // Day 2: a loss still keeps the streak going.
  await open('2026-12-02');
  await play(false, false);
  s = await save();
  check(s.daily.streak === 2 && s.daily.best === 2 && s.daily.days['2026-12-02'].c === false, 'streak 2 on the next day');
  const d2 = s.dough;
  check(d2 - d1 >= 35, `day 2 pays 30 + 5 (Dough ${d1} to ${d2})`);

  // Day 4: a day was missed.
  await open('2026-12-04');
  check((await p.evaluate(() => window.__daily.dailyStreak(window.__save.load()))) === 0, 'the streak reads 0 after a missed day');
  await p.evaluate(() => window.__game.scene.getScene('title').scene.start('menu'));
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__game.scene.getScene('menu').openDaily());
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SP}/daily_card.png` });
  await play(true, false);
  s = await save();
  check(s.daily.streak === 1 && s.daily.best === 2 && s.daily.wins === 2, 'the streak starts again at 1, and the best stays');
  check(Object.keys(s.daily.days).length === 3, 'three days of history kept');
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  await b.close();
  process.exit(failed ? 1 : 0);
})();

// Save test: loads a save from each era of the game and checks it comes through the upgrade steps intact,
// then checks the spare copy, the backup code and Reset. Run it against the preview server:
//   node tools/bots/savetest.cjs        (PORT= env for another server)
// Prints one line per check and exits with code 1 if any fail.
const { chromium } = require('playwright');
const URL = `http://localhost:${process.env.PORT || 4191}/`;
const KEY = 'everything-bagel-save-v1';
const SPARE = 'everything-bagel-save-spare';

// What a save looked like at each point in the game's history.
const ERAS = {
  // The prototype (steps 1 to 7): one stage, on/off sound switches, no per-stage records.
  prototype: { dough: 240, upgrades: { crust: 2, oven: 1 }, unlocked: ['plain', 'everything'], selected: 'everything', cookbook: ['sesame'], bestTime: 300, totalKills: 2100, clears: 2, sound: false, music: true, practice: false },
  // Phase 2, part way (M5 to M9): stages, per-stage bests, unlockable weapons.
  phase2: { dough: 610, upgrades: { crust: 5, oven: 3, luck: 1 }, unlocked: ['plain', 'everything', 'cinnamon', 'blueberry'], selected: 'blueberry', cookbook: ['sesame', 'pin', 'lox'], bestTime: 300, totalKills: 9000, clears: 6, sound: true, music: false, quick: true, stage: 'stage2', stageClears: { stage1: 5, stage2: 1 }, stageTime: { stage1: 300, stage2: 300 }, best: { 'stage1:plain': { time: 300, kills: 700, cleared: true }, 'stage2q:blueberry': { time: 180, kills: 400, cleared: true } }, weapons: ['knife'], mugs: 9 },
  // The end of Phase 2 (M10, M11 and the code review): modes, challenges, secrets, enemies met.
  phase2end: { dough: 1500, upgrades: { crust: 5, oven: 5, rise: 5, sticky: 5, luck: 3, reroll: 2, revive: 1, armor: 2 }, unlocked: ['plain', 'everything', 'cinnamon', 'blueberry', 'asiago', 'rainbow'], selected: 'rainbow', cookbook: ['sesame', 'pin', 'lox', 'puddle'], bestTime: 300, totalKills: 40000, clears: 20, sound: true, music: true, endless: true, crispy: true, stage: 'stage3', stageClears: { stage1: 10, stage2: 6, stage3: 4 }, crispyClears: { stage1: 1 }, best: { 'stage3e:rainbow': { time: 612, kills: 2200, cleared: true }, 'stage1x:plain': { time: 300, kills: 900, cleared: true } }, weapons: ['knife', 'jar', 'toastpop', 'iron'], beaten: ['croissant', 'tyrant', 'waffle', 'fburn', 'flapjack', 'broiler'], mugs: 31, met: ['crumb', 'mold'], records: { kills: 2200, level: 31, evos: 4, endless: 612, endlessBosses: 2 }, noHitBoss: true, goalsPaid: ['kills1000', 'evo4'], goalsSeen: ['kills1000'], secrets: ['combo'] },
  // M12 (Foundations): save version 2, with the Settings screen's options.
  foundations: { v: 2, dough: 320, upgrades: { crust: 1 }, unlocked: ['plain', 'everything'], selected: 'plain', cookbook: [], bestTime: 300, totalKills: 3100, clears: 1, stage: 'stage1', stageClears: { stage1: 1 }, stageTime: { stage1: 300 }, best: { 'stage1:plain': { time: 300, kills: 400, cleared: true } }, met: ['crumb', 'ant', 'mold', 'elite', 'croissant', 'toaster'], beaten: ['croissant', 'toaster'], settings: { music: 40, sound: 80, shake: 'reduced', flash: 'reduced', saver: true, lefty: true }, seenVersion: '0.12.0' },
};

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ': ' + detail}`);
};

(async () => {
  const b = await chromium.launch();
  /** Opens the game with the given storage and hands back the page. */
  const open = async (store) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => check('no page errors', false, e.message));
    await p.addInitScript((s) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, store);
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__save && window.__game, null, { timeout: 15000 });
    return p;
  };
  const loaded = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__save.load())));

  // 1. A save from each era loads, keeps what it had, and gains what's new.
  for (const [era, old] of Object.entries(ERAS)) {
    const p = await open({ [KEY]: JSON.stringify(old) });
    const s = await loaded(p);
    const kept = ['dough', 'upgrades', 'unlocked', 'selected', 'cookbook', 'totalKills', 'clears', 'best', 'weapons', 'records', 'goalsPaid', 'secrets', 'mugs', 'crispyClears'].filter((k) => old[k] !== undefined && JSON.stringify(s[k]) !== JSON.stringify(old[k]));
    check(`${era}: progress kept`, kept.length === 0, `changed: ${kept.join(', ')}`);
    check(`${era}: save version set`, s.v === 3, `v=${s.v}`);
    if (era === 'foundations') check('foundations: settings left alone', s.settings.music === 40 && s.settings.sound === 80 && s.settings.shake === 'reduced' && s.settings.flash === 'reduced' && s.settings.saver && s.settings.lefty, JSON.stringify(s.settings));
    else {
      check(`${era}: volumes follow the old switches`, s.settings && s.settings.music === (old.music === false ? 0 : 100) && s.settings.sound === (old.sound === false ? 0 : 100), JSON.stringify(s.settings));
      check(`${era}: new settings start at their defaults`, s.settings.shake === 'on' && s.settings.flash === 'normal' && s.settings.saver === false && s.settings.lefty === false);
    }
    // M13: a save with progress keeps every menu button open (no NEW tags) and skips the first-run tutorial.
    check(`${era}: tips are on`, s.settings.tips === true);
    check(`${era}: every menu button is open`, ['bakery', 'goals', 'cookbook'].every((id) => s.open.includes(id)) && !(s.fresh ?? []).length, JSON.stringify(s.open));
    check(`${era}: the tutorial is skipped`, ['move', 'fire', 'seeds', 'cards', 'chest', 'bakery'].every((id) => s.tips.includes(id)), s.tips.join());
    check(`${era}: stage tips only skipped for stages it has played`, s.tips.includes('freezer') === !!(old.stageTime && old.stageTime.stage2) && s.tips.includes('oven') === !!(old.stageTime && old.stageTime.stage3), s.tips.join());
    check(`${era}: clears per stage`, (s.stageClears.stage1 ?? 0) > 0, JSON.stringify(s.stageClears));
    if (era === 'phase2') check('phase2: Freezer bosses count as beaten', s.beaten.includes('waffle') && s.beaten.includes('fburn'), JSON.stringify(s.beaten));
    if (era !== 'phase2end') check(`${era}: enemies of cleared stages count as met`, s.met.length > 3, `${s.met.length} met`);
    else check('phase2end: met list left alone', JSON.stringify(s.met) === JSON.stringify(old.met));
    check(`${era}: spare copy written`, (await p.evaluate((k) => localStorage.getItem(k), SPARE)) === JSON.stringify(old));
    // Go through the title: the intro comic plays once for everyone, and Skip lands on the menu, which must build
    // without errors from this save.
    await p.mouse.click(195, 300);
    await p.waitForTimeout(1500);
    check(`${era}: the intro comic plays once`, await p.evaluate(() => window.__game.scene.isActive('intro')));
    await p.mouse.click(340, 30);
    await p.waitForTimeout(1500);
    check(`${era}: menu opens`, await p.evaluate(() => window.__game.scene.isActive('menu')));
    check(`${era}: the comic is marked as watched`, (await loaded(p)).intro === true);
    await p.context().close();
  }

  // 2. A brand-new player.
  {
    const p = await open({});
    const s = await loaded(p);
    check('new player: fresh save', s.dough === 0 && s.unlocked.join() === 'plain' && s.v === 3 && s.settings.music === 100);
    check('new player: tips on, nothing seen, menu buttons still shut', s.settings.tips === true && !(s.tips ?? []).length && !(s.open ?? []).length && !s.intro, JSON.stringify([s.tips, s.open]));
    await p.context().close();
  }

  // 3. An unreadable save falls back to the spare; with no spare, to a fresh save.
  {
    const p = await open({ [KEY]: '{"dough":12,"unlo', [SPARE]: JSON.stringify(ERAS.phase2) });
    const s = await loaded(p);
    check('broken save: spare loaded', s.dough === ERAS.phase2.dough && s.selected === 'blueberry');
    check('broken save: the game knows it recovered', await p.evaluate(() => window.__save.takeRecovered()) === true);
    await p.context().close();
    const q = await open({ [KEY]: 'not a save' });
    check('broken save, no spare: fresh save', (await loaded(q)).dough === 0);
    check('broken save, no spare: nothing to report', await q.evaluate(() => window.__save.takeRecovered()) === false);
    await q.context().close();
  }

  // 4. Backup code: copy it out, wipe everything, paste it back.
  {
    const p = await open({ [KEY]: JSON.stringify(ERAS.phase2end) });
    const before = await loaded(p);
    const code = await p.evaluate(() => window.__save.backupCode());
    check('backup code: looks like a code', /^EB1:[A-Za-z0-9+/=]+$/.test(code), code.slice(0, 20));
    check('backup code: junk is refused', (await p.evaluate(() => window.__save.restoreCode('EB1:hello'))) === false && (await p.evaluate(() => window.__save.restoreCode('nonsense'))) === false);
    check('backup code: a refused code changes nothing', JSON.stringify(await loaded(p)) === JSON.stringify(before));
    await p.context().close();
    const q = await open({});
    // Pasted text often picks up spaces and line breaks.
    const messy = ' ' + code.replace(/(.{40})/g, '$1\n') + '\n';
    check('backup code: accepted on a clean phone', (await q.evaluate((c) => window.__save.restoreCode(c), messy)) === true);
    check('backup code: everything came back', JSON.stringify(await loaded(q)) === JSON.stringify(before));
    await q.reload({ waitUntil: 'domcontentloaded' });
    await q.waitForFunction(() => window.__save);
    check('backup code: still there after reopening', JSON.stringify(await loaded(q)) === JSON.stringify(before));
    // 5. Reset: progress goes, settings stay, the old save is kept as the spare.
    await q.evaluate(() => { window.__save.load().settings.music = 35; window.__save.persist(); window.__save.resetSave(); });
    const s = await loaded(q);
    check('reset: progress cleared', s.dough === 0 && s.clears === 0 && s.unlocked.join() === 'plain');
    check('reset: settings kept', s.settings.music === 35);
    check('reset: the tutorial and the locked menu come back', !(s.tips ?? []).length && !(s.open ?? []).length);
    check('reset: old save kept as the spare', JSON.parse(await q.evaluate((k) => localStorage.getItem(k), SPARE)).dough === ERAS.phase2end.dough);
    await q.context().close();
  }

  await b.close();
  console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
  process.exit(failed ? 1 : 0);
})();

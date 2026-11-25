// Every screen and pop-up at one window size: saves a picture of each, and lists text drawn smaller than 11 points
// and tap targets smaller than 44 points, by screen. Run it at each size the game should look right on:
//   node tools/bots/screens.cjs <folder> 375x667     (iPhone SE)
//   node tools/bots/screens.cjs <folder> 390x844     (a current iPhone)
//   node tools/bots/screens.cjs <folder> 430x932     (a large phone)
//   node tools/bots/screens.cjs <folder> 1280x800    (a computer window)
// Env: PORT=, CVD=protan|deutan|tritan (draws through a colour-blindness filter), ONLY=word (screens whose name has it),
// UA=android (pretends to be an Android phone, for the home-screen card).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/screens';
const [W, H] = (process.argv[3] || '390x844').split('x').map(Number);
const PORT = process.env.PORT || 4191;
const ONLY = process.env.ONLY || '';
const CVD = { protan: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0', deutan: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0', tritan: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0' }[process.env.CVD || ''];
const BAGELS = ['plain', 'everything', 'poppy', 'cinnamon', 'pumpernickel', 'onion', 'blueberry', 'asiago', 'jalapeno', 'rainbow', 'garlic', 'pretzel'];
const SAVE = {
  v: 5, dough: 1900, upgrades: { hp: 3, dmg: 2, reroll: 3, bin: 3, revive: 1, luck: 2, proof: 1 }, unlocked: BAGELS, selected: 'everything', cookbook: ['gatling', 'inferno'], secrets: ['toastjam'],
  weapons: ['knife', 'jar', 'toastpop', 'iron', 'cutter', 'whisk'], coinsTotal: 640, bestTime: 300, totalKills: 9123, clears: 9, intro: true, ending: true, stage: 'stage4',
  best: { 'stage1:plain': { time: 300, kills: 900, cleared: true }, 'stage1e:plain': { time: 432, kills: 900, cleared: true } },
  stageClears: { stage1: 3, stage2: 2, stage3: 2, stage4: 1, stage5: 1 }, crispyClears: { stage1: 1 }, beaten: ['king', 'mdough', 'tyrant'], open: ['bakery', 'goals', 'cookbook'], tips: ['daily', 'cards', 'banish'],
  seenVersion: 'old', backupAt: Date.now(), records: { creep: 12, kills: 800, level: 31 }, looks: { owned: ['chef', 'hearts', 'rainbow', 'beanie'], hat: 'chef', trail: 'hearts', sprinkle: 'rainbow' },
  stats: { runs: 41, secs: 9000, bosses: 9, bagels: { plain: 10, everything: 20 }, weapons: { sesame: 30, cutter: 12 } },
  daily: { last: '2026-11-23', streak: 3, best: 5, wins: 2, days: { '2026-11-23': { t: 281, k: 812, c: true } } },
  settings: { music: 0, sound: 0, shake: 'on', flash: 'normal', saver: false, lefty: false, tips: true },
};

// Runs in the page: everything drawn right now that is too small to read or to tap.
const audit = () => {
  const game = window.__game;
  const found = [];
  for (const sc of game.scene.getScenes(true)) {
    const S = sc.scale.width / sc.game.canvas.getBoundingClientRect().width;
    const walk = (o, scale, shown) => {
      const vis = shown && o.visible !== false && (o.alpha === undefined || o.alpha > 0.05);
      if (!vis) return;
      const s = scale * Math.abs(o.scaleX === undefined ? 1 : o.scaleX);
      const sy = scale * Math.abs(o.scaleY === undefined ? 1 : o.scaleY);
      if (o.type === 'Text' && o.text && o.text.trim()) {
        const px = (parseFloat(o.style.fontSize) * Math.min(s, sy)) / S;
        if (px < 10.9) found.push(`text ${px.toFixed(1)}pt "${o.text.replace(/\n/g, ' ').slice(0, 28)}"`);
      }
      if (o.input && o.input.enabled && o.input.hitArea) {
        const h = o.input.hitArea;
        const w0 = h.width !== undefined ? h.width : h.radius * 2;
        const h0 = h.height !== undefined ? h.height : h.radius * 2;
        const tw = (w0 * s) / S;
        const th = (h0 * sy) / S;
        if (Math.min(tw, th) < 43.5) {
          const label = (o.list && o.list.find((q) => q.type === 'Text' && q.text)) || null;
          found.push(`tap ${Math.round(tw)}x${Math.round(th)}pt ${label ? `"${label.text.slice(0, 20)}"` : o.texture && o.texture.key !== '__DEFAULT' ? o.texture.key : o.type}`);
        }
      }
      if (o.list) for (const q of o.list) walk(q, s, vis);
    };
    for (const o of sc.children.list) walk(o, 1, true);
  }
  return [...new Set(found)];
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const android = process.env.UA === 'android';
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W > 600 ? 1 : 2, ...(android ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', hasTouch: true, isMobile: true } : {}) });
  const report = {};
  let errors = 0;
  const tag = `${W}x${H}${process.env.CVD ? `_${process.env.CVD}` : ''}${android ? '_android' : ''}`;

  const page = async (url, save) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { errors++; console.log('ERR', e.message); });
    await p.addInitScript((s) => localStorage.setItem('everything-bagel-save-v1', JSON.stringify(s)), save || SAVE);
    await p.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
    if (CVD) await p.evaluate((m) => {
      document.body.insertAdjacentHTML('beforeend', `<svg style="position:absolute;width:0;height:0"><filter id="cvd"><feColorMatrix type="matrix" values="${m}"/></filter></svg>`);
      document.getElementById('app').style.filter = 'url(#cvd)';
    }, CVD);
    await p.waitForTimeout(1800);
    return p;
  };
  const shot = async (p, name, wait = 900) => {
    if (ONLY && !name.includes(ONLY)) return;
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${OUT}/${tag}_${name}.png` });
    const a = await p.evaluate(audit);
    if (a.length) report[name] = a;
  };
  const ev = (p, f, arg) => p.evaluate(f, arg).catch((e) => { errors++; console.log('EV', e.message.split('\n')[0].slice(0, 200)); });
  const menu = (p, f) => ev(p, new Function(`const s = window.__game.scene.getScene('menu'); (${f})(s);`));

  // ---- Title and menu pages
  let p = await page('?day=2026-11-24');
  await shot(p, 'title');
  await ev(p, () => window.__game.scene.getScene('title').scene.start('menu'));
  await shot(p, 'whatsnew', 1500);
  await menu(p, (s) => s.closePopup(false));
  await shot(p, 'menu');
  await menu(p, (s) => s.openStages());
  await shot(p, 'stages');
  await menu(p, (s) => s.openDaily());
  await shot(p, 'daily');
  for (const t of [0, 1, 2]) { await menu(p, `(s) => s.openBakery(${t}, 0, '')`); await shot(p, `bakery${t}`); }
  for (const t of [0, 1, 2, 3]) { await menu(p, `(s) => s.openGoals(${t}, 0)`); await shot(p, `goals${t}`); }
  for (const t of [0, 1]) { await menu(p, `(s) => s.openCookbook(${t}, 0)`); await shot(p, `cookbook${t}`); }
  await menu(p, (s) => s.openEnemies(3, 0));
  await shot(p, 'enemies');
  for (const t of [0, 1, 2, 3]) { await menu(p, `(s) => s.openSettings(${t})`); await shot(p, `settings${t}`); }
  await p.close();

  // ---- The home-screen card (forced with ?a2hs) and the first run's menu
  p = await page('?a2hs', { ...SAVE, seenVersion: undefined, a2hs: false });
  await ev(p, () => window.__game.scene.getScene('title').scene.start('menu'));
  await shot(p, 'homescreen', 1500);
  await p.close();

  // ---- The comic and the credits
  p = await page('', { ...SAVE });
  await ev(p, () => window.__game.scene.getScene('title').scene.start('intro'));
  await shot(p, 'intro', 1800);
  await ev(p, () => window.__game.scene.getScene('intro').scene.start('credits'));
  await shot(p, 'credits', 2500);
  await p.close();

  // ---- A run: the HUD, the panels, the results
  for (const stage of ['stage1', 'stage4', 'stage5']) {
    p = await page('?god&t=150');
    await ev(p, (stage) => window.__game.scene.getScene('title').scene.start('game', { bagel: 'pretzel', stage }), stage);
    await p.waitForTimeout(800);
    await ev(p, () => { const g = window.__game.scene.getScene('game'); if (g.paused) { g.run.pendingLevels = 0; g.panels.close(); g.setPaused(''); } g.addWeapon('cutter'); g.addWeapon('lox'); g.toppings.set('oven', 3); g.toppings.set('dough', 1); g.recomputeStats(); g.panels.openLevelUp = () => { g.run.pendingLevels = 0; }; });
    await p.keyboard.down('d');
    await shot(p, `run_${stage}`, 3500);
    await p.keyboard.up('d');
    if (stage === 'stage1') {
      await ev(p, () => { const g = window.__game.scene.getScene('game'); delete g.panels.openLevelUp; g.run.level = 5; g.run.pendingLevels = 1; g.panels.openLevelUp(); });
      await shot(p, 'levelup', 1300);
      await ev(p, () => { const g = window.__game.scene.getScene('game'); g.run.pendingLevels = 0; g.panels.close(); g.setPaused(''); g.panels.openChest(true); });
      await shot(p, 'chest', 2600);
      await ev(p, () => { const g = window.__game.scene.getScene('game'); g.panels.close(); g.setPaused(''); g.panels.openPause(); });
      await shot(p, 'pause');
      await ev(p, () => { const g = window.__game.scene.getScene('game'); g.panels.openSettings(); });
      await shot(p, 'pause_settings');
      await ev(p, () => { const g = window.__game.scene.getScene('game'); g.panels.close(); g.setPaused(''); g.endRun(true); });
      await shot(p, 'results_win', 4500);
    }
    if (stage === 'stage4') {
      await ev(p, () => { const g = window.__game.scene.getScene('game'); g.endRun(false); });
      await shot(p, 'results_loss', 4500);
    }
    await p.close();
  }
  await b.close();
  const names = Object.keys(report);
  console.log(`${tag}: pictures in ${OUT}. ${errors} page error(s).`);
  if (!names.length) console.log('Nothing too small to read or tap.');
  for (const n of names) console.log(`  ${n}:\n    ${report[n].join('\n    ')}`);
})();

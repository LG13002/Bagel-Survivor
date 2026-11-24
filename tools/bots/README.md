# Bot test scripts

Headless Playwright scripts used to check gameplay changes. They are not part of the build, and Playwright is not a dependency. Cloud sessions already have it installed, so `require('playwright')` works there.

Start a preview server first:

```bash
npm run build
(setsid npx vite preview --port 4191 > /dev/null 2>&1 &)
```

| Script | What it does | Run |
| --- | --- | --- |
| `wbench.cjs` | Gives Plain Jane one weapon at a set level (6 = evolved) in god mode, then reports useful damage/sec (overkill removed), kills/min and damage taken/min. | `node tools/bots/wbench.cjs 6 pin,sesame [stage] [startSecs]` (defaults `stage1 120`; `PORT=` env for another server; `CRISPY=1` turns on Extra Crispy). The weapon `combo` is Lox and Schmear; `pair` is Schmear Flood and Lox Cyclone side by side, for comparison |
| `bagelbench.cjs` | Plays each bagel to 4:25 of a Full Run with one fixed card policy. Hits are counted instead of applied, so every bagel covers the same stretch. Reports useful damage/sec, damage taken and healing per minute, and health bars lost (damage taken minus healing, over max health). Also prints the coins picked up and the Dough the run would pay with and without the boss beaten (`doughIfCleared`, `doughIfLost`): the Dough check in `docs/HANDOFF.md` uses these. | `node tools/bots/bagelbench.cjs [bagels] [stage] [endSecs]` (defaults: every bagel, `stage1`, `265`; `SPEED=`, `PORT=`, `CRISPY=1`). Two copies can run side by side; compare runs made the same way |
| `buntest.cjs` | Plays a Quick Run and a Full Run to the boss. Logs Sticky Bun drops and the seeds left on the floor when the boss arrives. Saves screenshots to the folder you pass. | `node tools/bots/buntest.cjs /tmp/out` |
| `qtest.cjs` | Plays a Quick Run to the boss, forces a win, then prints the resulting save data. | `node tools/bots/qtest.cjs /tmp/out` |
| `savetest.cjs` | Loads a save from each era of the game (prototype, mid Phase 2, end of Phase 2, M12) and checks nothing is lost and the new fields are filled in (the Daily Run, looks and stats start empty). Also checks the spare copy, backup codes and reset. Exits with code 1 if a check fails. Run it after any change to `src/save.ts`. | `node tools/bots/savetest.cjs` (`PORT=`) |
| `tutortest.cjs` | A brand-new save's first minutes: the intro comic, the locked menu, the first run's tips (each once, in order), the results screen's Bakery button, NEW tags, a second run with no tips, Tips off, and Replay tutorial. Saves screenshots of each step. Exits with code 1 if a check fails. Run it after touching tips, the menu's bottom bar or the intro. | `node tools/bots/tutortest.cjs <screenshot folder> [height]` (height defaults to 760; run 640 too) |
| `dodgebench.cjs` | Does dodging pay? Plays the same stretch of a stage with the same build twice, walking in a careless circle and dodging carefully (it reads charge lanes), and prints damage taken a minute, hits a minute, the crowd around the bagel and what dealt the damage. A small gap between the two means the damage can't be avoided. | `node tools/bots/dodgebench.cjs stage1,stage4 [startSecs, default 120] [realSecs]` (`PORT=`, `MODES=circle,dodge`) |
| `fpsbench.cjs` | Frame rate in a busy stretch of each stage (from 4:00, three evolved weapons, walking in circles): average frames a second and the slowest 1% of frames over 20 seconds. Headless numbers are far below a phone's, so compare two builds served side by side. | `node tools/bots/fpsbench.cjs [stages] [seconds]` (`PORT=`, `SAVER=1` for Battery saver) |
| `bosstime.cjs` | When each stage's boss arrives, when it first attacks, and how far from the bagel it appears. Run it on two builds to confirm a change hasn't moved a boss's timing. | `node tools/bots/bosstime.cjs [stages]` (`PORT=`) |
| `mixtest.cjs` | Plays every song and prints its average and loudest level on the music bus, in dB. The songs' `level` values in `music.ts` come from this. Takes about two minutes. | `node tools/bots/mixtest.cjs [seconds per song]` (`PORT=`) |
| `endtest.cjs` | Beats the Stale King on a save that has never seen the ending and checks the comic, the credits, the results, the save (ending seen, Pretzel, challenge, King beaten) and that a second win skips the ending. Saves pictures of each step. Exits with code 1 if a check fails. | `node tools/bots/endtest.cjs <screenshot folder>` (`PORT=`) |
| `dailytest.cjs` | The Daily Run across four days: the same date gives the same run and 30 days are varied; the first run of a day is scored and pays its bonus once; a replay pays and counts nothing; the streak grows the next day and resets after a missed one; stage clears and bests are never touched. Saves pictures of the run, the results and the Daily card. Exits with code 1 if a check fails. Run it after touching `daily.ts` or `endRun`. | `node tools/bots/dailytest.cjs <screenshot folder>` (`PORT=`) |
| `look.cjs` | Starts a run at a stage time, walks in a slow circle and saves screenshots. The quick way to see a stage's floor, enemies and hazards in play. | `node tools/bots/look.cjs /tmp/out 100 everything god stage4` |
| `bossview.cjs` | A close look at a mini-boss or boss: clears the small enemies, keeps the bagel beside it and saves six screenshots. A health fraction under 1 shows its second phase. | `node tools/bots/bossview.cjs /tmp/out 268 boss 0.45 stage4` |

Notes:
- The game opens on the title screen. Scripts start a run straight from it (`getScene('title').scene.start('game', …)`) or tap through it; an older save also gets the What's new card on the menu, which `closePopup(false)` closes.
- Use `waitUntil: 'domcontentloaded'` and resolve level-up and chest overlays through `window.__game` rather than by clicking, because card positions change.
- Headless Chromium runs slowly, and later pages in the same script render few frames. Fades can look dim and FPS is meaningless there. Use the numbers to compare runs, not as absolute values.
- Bot numbers vary run to run. Run anything you plan to act on twice.
- `wbench.cjs` also takes `combo` and `pair` (Lox and Schmear against its two evolutions side by side) and `tjcombo` and `tjpair` (the same for Toast and Jam) in place of a weapon id.
- Run one bench at a time and nothing else beside it. A busy machine shortens the stretch of game time each sample covers, and the numbers drop with it (the `secs` in each line should match between the runs you compare).

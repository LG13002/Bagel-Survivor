# CLAUDE.md: Everything Bagel

Read this first. It is the handoff for any Claude session working on this repo. The full history of what was built and why is in `docs/HANDOFF.md`.

## What this is

- **Game:** "Everything Bagel", an original one-thumb survivor roguelite for phones. You are a bagel defending the last bakery from the Stale.
- **Owner:** the repo owner (LG13002). The game is built for phones, played as a home-screen PWA in short sessions. That's why runs are short, the game auto-pauses on app switch, and runs resume after iOS kills the app.
- **Live:** https://lg13002.github.io/Bagel-Survivor/. Pushes to `main` deploy through GitHub Actions to Pages.
- **Repo:** `LG13002/Bagel-Survivor` is public, and `index.html` has a noindex meta tag (the owner's choice).
- **Stack:** Phaser 3.90, TypeScript, Vite. There are no image or audio files: **all art is drawn in code** with Canvas2D, and **all music and sound are synthesized** with WebAudio.
- **Status (2026-11-11):** Stage 1 and the prototype (M1 to M4) are complete. **Phase 2** (content) is planned in the [Phase 2 design doc](https://claude.ai/artifact/TBqYzaqW3kXDxSGh1ieQfa) as milestones M5 to M11. M5 (stage framework and stage picker), M6 (the Freezer, in two parts) and M7 (Blueberry, Asiago and the Bakery's Extras tab) are built. M8 (4 new weapons, then the "Crisp" flare pass the owner picked on the style board) is built. M9 (the Toaster Oven, two parts) is built. M10 (Endless mode and the Extra Crispy hard toggle) [change list](https://claude.ai/artifact/EEsQTPuvpDQm2qZ3TxVpaV) is built. M11 ([change list](https://claude.ai/artifact/2epR6A5tmgMBGMFsuzTkCr)): Part 1 (Goals page, Cookbook Enemies tab) is built; Part 2 (the secret Rainbow bagel and the Lox and Schmear combo evolution) and Part 3 (the full balance pass, numbers in `docs/HANDOFF.md`) share one PR. That completes Phase 2. After it, a code review pass ([findings](https://claude.ai/artifact/6HTNUYVxC6hHcH62aC1CCc)) fixed 8 bugs and added the optimizations listed in `docs/HANDOFF.md`; no gameplay numbers changed. A second pass (group C) split `GameScene.ts` into the parts in `src/run/` and merged repeated code, with no change to play.
- **Phase 3 (the road to 1.0, started 2026-11-22):** planned in the [Phase 3 design doc](https://claude.ai/artifact/XTFovTRnht4Ro4soMW44jt) as milestones M12 to M19 (foundations, onboarding and story, animation, the Pantry, the Bread Bin finale, weapons and Bakery, replay, release candidate). The owner's picks on the [Phase 3 style board](https://claude.ai/artifact/CUVqPHqxixzqyR5LPk1p2D): keep Chunky Cartoon with upgraded lighting, the "big hero" title screen, the bakery shelf menu, and the Titan One font. 1.0 is web only, free, and shared by link rather than listed publicly (the noindex tag stays). **M12 (Foundations)** ([change list](https://claude.ai/artifact/VUGKSKxsbQ3LFNHHNDwChA)) is built: the font, title screen, shelf menu, screen wipe, Settings, save versions with a spare copy and backup codes, version 0.12. No gameplay numbers changed. **M13 (Onboarding and story)** ([change list](https://claude.ai/artifact/37yxZCzAQyad9XnGEEwz44)) is built on the same branch: first-run tips, later one-time tips, the Tips setting and Help tab, rotating hints, a menu that opens as you go, the intro comic, boss and mini-boss lines, story beats, save version 3, version 0.13. No gameplay numbers changed. **M14 (Animation and feel)** ([change list](https://claude.ai/artifact/8pTuU4yF2wZXVk12NhvaUL)) is built on the same branch: living bagel eyes, enemy squash and three kinds of defeat, boss entrances and wind-ups, card flips and chest reveals, a results screen that counts up, stage lighting and air, a measured music mix with crossfades, version 0.14. No gameplay numbers changed; bosses now land just inside the screen instead of walking in from outside it. The owner merges M12 to M14 together (fewer merges), so they share one branch and PR. They merged on 2026-11-23. **M15 (the Pantry)** ([change list](https://claude.ai/artifact/Ue8289z2E3gN9o1oY9ppJs)) is built: Stage 4 with shelves and aisles, enemy path-finding, rolling cans and flour puffs, a new cast, the Spaghetti Tangle, Mother Dough, two songs, the Garlic bagel, version 0.15. Stages 1 to 3 play as before. M15 and M16 (the Bread Bin finale) share one branch and PR, and the owner merges after M16.

## How to work with the owner (rules)

1. **Change list first, then build.** For every step, write a change list as a Claude Doc and get the owner's "approve" before coding. Their rough playtest notes get triaged into that list. Add your own suggestions and label them as yours.
2. **One milestone = one branch = one PR.** Branch from the latest `main`. Keep merges and pushes few: bundle a whole milestone into one PR (don't split it into parts), commit locally as you go and push once when the work is ready for the owner to test (plus fixes from their playtest). The owner plays the preview and **merges it themselves**. Never merge for them.
3. **Always ship a playable preview** with the PR. See "Preview artifact" below. The owner tests on their phone from it before merging.
4. **The owner is new to GitHub.** Explain things plainly, no jargon, and give them links.
5. **Difficulty target is "a solid 6/10" for Stage 1.** Don't raise it much. Harder content comes from later stages. Step 7 pushed it to about 6.5.
6. **Design before polish.** Gameplay and readability come first. Something that hurts play, like a projectile you can't see or a misread card, counts as a design bug.
7. **Measure balance claims.** Use the bot benchmarks (`tools/bots/wbench.cjs` for weapons and stages, `tools/bots/bagelbench.cjs` for bagels) and quote the numbers. If a result makes you deviate from the approved list, do it and say so plainly in the reply and the PR.
8. **After a merge,** confirm the Pages deploy succeeded and tell the owner to close and reopen the app if he still sees the old version. The service worker is network-first.
9. **Commits and PRs:** descriptive titles like "Step 7: …". PR bodies have Summary and Testing sections.
10. **Privacy: the repo is public.** Never write the owner's personal name or personal details in repo files, code comments, commit messages, PR titles or bodies, or PR comments. Say "the owner" instead.

## Original IP only

Every character, enemy, item and name is original and bakery or breakfast themed: bagels, the Stale, Crusty Croissant, Toaster Tyrant, Sticky Bun, Dough currency, the Bakery shop. Keep it that way. Don't copy names, art or music from existing games.

## Art style: "Chunky Cartoon" (the owner picked style A)

- **Look:** thick dark ink outlines (`INK = '#24160d'`, set with `ink(c, w)`), soft radial-gradient shading via `radial()`, big friendly eyes via `eye()`, and warm bakery colors. Pickups glow (`lootGlow`) so they never read as enemies.
- **Upgraded lighting (Phase 3 pick):** `relight(c, w, h)` in `art.ts` adds a warm key light, a cool core shadow and floor bounce to a finished drawing, leaving the ink outlines dark. Call it last in the draw function. It is on the big menu, title and results bagels, and (since M14) on the in-run bagel, every enemy and boss, and the pickups through `lit()` in `textures.ts`. XP seeds, shots and floor art are left flat on purpose.
- **Font:** Titan One (open license, `src/assets/titan-one.woff2`, bundled into the code and loaded in `main.ts` before the game starts). It is wider than a system font and has one weight: after adding text, check it fits at 390 wide, and use `fit(text, room)` from `ui.ts` for names that vary.
- **Where things live:**
  - Every texture is a function in `src/art.ts`, registered in `src/textures.ts` through `ctex(scene, key, w, h, draw)`.
  - `ctex` draws at device scale S, so textures stay sharp on retina screens.
  - Art is drawn the first time it's needed, in three groups in `textures.ts`: `makeTextures` (what the menus show), `makeEnemyTextures` (runs and the Cookbook's Enemies tab) and `makeRunTextures(scene, stage)` (that stage's floor and props, plus weapons, shots and hazards). **Put a new texture in the right group**, or it shows as a missing-texture box. The results screen's background is `floor_stage1`; the menu draws its own tiled wall and shelf.
  - Hero and results bagels use a `<tex>_big` 160px texture, drawn on demand by `bigBagel(scene, tex)`. The title screen's bagel is `giantBagel(scene, tex, size)`, drawn at the size it's shown and removed when the title closes.
- **Stage 1 floor:** the "Giant countertop", a butcher block (`src/floors.ts`) with props scattered in seeded 384px chunks (spoon, cookie cutters, cup, flour, sprinkles). Each stage names its floor and prop set in `STAGES` in `src/data.ts`. Stage 2 is the Freezer, Stage 3 the Toaster Oven.
- **UI kit (`src/ui.ts`):**
  - `button()`: chunky, with an ink outline, a 5*S bottom edge, a press shift and a click sound. Options: `icon`, `chevron`, `muted`.
  - `pill()`, `drawPips()`, and `panel` (ink outline plus an inner light stroke).
  - `popupFrame()`: the frame every pop-up shares (panel, dark header bar with the title, round back button). Content starts `HEADER` px below the top. There are no Done buttons: the back button closes.
  - `segmented()` in `settingsPanel.ts`: the gold pick-one switch, used for pop-up tabs and settings.
  - Icons for the UI live in `UI_ICONS` in `art.ts`. Upgrade icons live in `ICONS`.
- **Palette:** `COLORS` and `CSS` in `src/config.ts` (bg `#2b2118`, cream `#fff3dc`, gold `#f2b84b`, red `#e0533d`, green `#7fbf4d`, xp blue `#6cc7f0`). Level-up card colors by type: weapon orange `0xf08a3c`, topping blue `0x5aa9e6`, heal/coin green, combo gold with a spinning star.

## Code map

| File | What's in it |
| --- | --- |
| `src/main.ts` | Loads the font, then starts the game with the scenes Title, Intro, Menu, Game, Results. Exposes `window.__game` and `window.__save` for bots |
| `src/config.ts` | `S` (device scale, max 3), `ZOOM = 1.2` (world zoom; the owner asked for +20%), colors, `FONT`, `VERSION` (from `package.json`), safe insets, `DEBUG` URL flags |
| `src/data.ts` | **All tuning:** weapons, toppings, evolutions, bagels, Bakery upgrades, enemies, `STAGES` (one recipe per stage: cast, timeline banners, music, Dough pay, difficulty dials), `RUN` pacing, `xpNeeded` |
| `src/weapons.ts` | The 10 weapon classes (normal and evolved behavior; damage numbers are inline here). `pickTargets` and `Lob` are shared by the thrown weapons, `PoolWeapon` by the two puddle weapons |
| `src/scenes/GameScene.ts` | The run's core: setup, the frame loop (`step`, `renderWorld`), the player, stats, level-up choices, damage to you, Second Bake, pause, audio state, ending the run. It builds the parts below in `create()` and reaches them as `g.run`, `g.effects`, `g.floor`, `g.hz`, `g.foes`, `g.director`, `g.loot`, `g.hud`, `g.panels` |
| `src/run/state.ts` | `RunState`: every plain number of one run (level, xp, kills, coins, frost, dash, …). Made fresh in `init()` |
| `src/run/modes.ts` | Quick, Practice, Extra Crispy and Endless constants |
| `src/face.ts` | `Face`: a bagel's living eyes, laid over an eyeless bagel picture (`bodyBagel`, `bigBagel(…, false)`, `giantBagel(…, false)`). Blinks, `look(x, y)`, `wince()`, `mood`, `idle` glances. Follows its picture's position, squash, spin and fade by itself |
| `src/run/effects.ts` | Sparks, crumbs, trail dots, the three defeats (`death`: pop, crumble, splat), landing dust, the boss burst (`fx` / `done`, reused sprites) |
| `src/run/ambient.ts` | `Ambient`: the stage's edge tint (warm, cold, hot) and the specks drifting in the air (off with Battery saver). Screen space, under the HUD |
| `src/run/floor.ts` | Floor chunks: props, ice patches, rack posts, the Pantry's shelves and short-lived walls (`walls`, `temps`, `addTemp`), `pushOut`, and the flow field enemies use to walk around walls (`steer`, `nearWall`) |
| `src/run/hazards.ts` | Enemy shots (`fireShot`, `ring`, `fan`), Tyrant rings (also Mother Dough's bubbles), Freezer melts and frost circles, oven coils, grease, embers and flame lines (also noodle lines), the Pantry's rolling cans and flour clouds |
| `src/run/enemies.ts` | The enemy list, spawning, the spatial grid (`query`, `nearest`), movement, burning, kills, boss defeats |
| `src/run/behaviors.ts` | Enemy AI (`behave`) and the four big bosses' attack patterns |
| `src/run/director.ts` | The timeline: waves, ant lines, elites, surprise elites, mini-boss, boss, Endless returns |
| `src/run/pickups.ts` | Seeds, coins, chests, the Sticky Bun, Warm Mugs |
| `src/run/hud.ts` | The HUD, edge arrows, banners and the boss card |
| `src/run/panels.ts` | Level-up, chest and pause panels |
| `src/run/tutor.ts` | `Tutor`: the run's one-time tips (when each fires, the queue, the box under the bagel, the ghost thumb and the seed arrow). `tipBox()` is the tip's look, shared with the panels and the menu |
| `src/run/resume.ts` | Writing and applying the resume snapshot |
| `src/scenes/TitleScene.ts` | The first screen of every launch: logo, your current bagel huge, the Stale along the bottom. Tap goes to the menu |
| `src/scenes/MenuScene.ts` | The bakery shelf menu: bagels on a shelf (swipe or tap a neighbour), name plate, the order ticket (stage, Extra Crispy, mode, PLAY or Resume), bottom bar (Bakery, Goals, Cookbook, Settings). Also the stage picker (with the Practice switch), Bakery, Goals, Cookbook, and the one-at-a-time notes on opening (`greet`: recovered save, What's new, backup reminder) |
| `src/scenes/IntroScene.ts`, `src/comic.ts` | The intro comic: four pages (`PAGES`), each a backdrop drawn in `comic.ts` with a few moving sprites on top. Sets `save.intro` when it ends |
| `src/tips.ts` | Every tip's text (`TIPS`), `tipDue` / `markTip`, `replayTutorial`, the rotating `HINTS` (`nextHint`), and the bottom bar's locks (`menuOpen`, `openMenu`, `menuFresh`, `clearFresh`) |
| `src/settings.ts` | `settings()`, `setSetting()` and the helpers the run uses to respect them: `shake()`, `flash()`, `blink()`, `reducedFlash()` |
| `src/settingsPanel.ts` | The Settings screen (`buildSettings`): Game, Save, Help and About tabs on the menu; only the Game rows from the pause screen |
| `src/backupDialog.ts` | The copy and paste boxes for backup codes. Real page elements, because copy and paste need a real text box on phones |
| `src/wipe.ts` | The bagel-ring screen wipe: `wipeTo(scene, key, data)` closes it and starts the next scene, which calls `wipeOpen()` |
| `src/whatsnew.ts` | The "What's new" card's text. Rewrite it every milestone |
| `src/scenes/ResultsScene.ts` | End of run, Dough payout, new-best banners |
| `src/art.ts`, `src/floors.ts`, `src/textures.ts` | Drawn-in-code art |
| `src/pantry.ts` | Everything drawn for Stage 4: the Pantry's floor, shelves, props, stage pictures, enemies, shots and hazards |
| `src/sfx.ts` | WebAudio buses (sfx 0.35, music 0.16 through a lowpass, each scaled by its volume setting: `setSoundVolume`, `setMusicVolume`), all sound effects, voice cap, unlock on first tap |
| `src/music.ts` | Step sequencer and the songs `menu`, `run` (intensity layers), `boss`, `win`, `stale`. API: `playMusic`, `setRunIntensity`, `playJingle`, `stopMusic` |
| `src/goals.ts` | The Goals page's challenges (`CHALLENGES`: id, name, Dough reward, `status(save)`), `claimGoals` (pays newly done ones) and `unseenGoals` (the red dot) |
| `src/save.ts` | localStorage key `everything-bagel-save-v1`. Save versions (`STEPS`), the spare copy, backup codes and reset (see "Saves and settings"). Bests are keyed `'<stage>:<bagel>'` (`bestStage()`: `stage1`, `stage1q` Quick, `stage1e` Endless, plus `x` for Extra Crispy). `stage` = last picked stage, `stageClears` = clears per stage (unlocks the next stage) |
| `src/runsave.ts` | Run snapshot for resume after iOS kills the app |
| `public/sw.js` | Network-first service worker (offline play) |

## Key mechanics, for reasoning about changes

- **Full Run timeline:**
  - Giant Mold elite at 0:45, then every 60s.
  - Crusty Croissant mini-boss at 2:30, with crumb waves every 30s from then on.
  - Ant lines every 20s from 2:00.
  - Toaster Tyrant at 4:30. Beating him clears the stage.
- **Quick Run:** the same schedule on a stage clock running at `QUICK_PACE = 5/3`, through the `stageT` getter. The boss arrives at real 2:42.
  - XP ×1.6, Dough ×0.75.
  - Separate bests (`stage1q`, `stage2q`, …). Quick clears count toward unlocks.
  - **Always schedule by `this.stageT`, never `this.now`.**
- **Enemy health** = base × `stage.hpBonus` (1.1 in Stage 1) × (1 + stageT / `stage.hpGrowth` (180 in Stage 1)). Elites and bosses use flat health. Other per-stage dials: `spawnRate`, `dmg`, `dough`.
- **Stages:** `GameScene` reads everything stage-specific from `this.stage` (a `StageDef`). A stage with `built: false` shows on the stage picker as "Coming soon" and can't be picked. `elites` take turns at each elite slot, `extras` are one-off surprise elites at a set time, and `boss.card` shows a big announcement card instead of the plain banner. Enemies with `flat` on their def (elites and bosses) get flat health and are never recycled or capped. A stage unlocks when the one in `unlockAfter` has been cleared (`progress.ts`). Builds made with `VITE_PREVIEW=1` (the preview artifact) open every built stage; the live build does not.
- **Freezer hazards** (stage flags `ice`, `frost`, `mug`): ice patches are seeded per floor chunk and make the bagel slide (velocity smoothing). Standing still for 2s builds frost over 2s, then the bagel is frozen (slowed) until it moves. Enemies ignore ice. The Warm Mug pickup heals 10, clears frost and gives 5s immunity.
- **Toaster Oven hazards** (stage flags `coils`, `grease`, `posts`):
  - Coil flare-ups: a 300×40 strip near you (never under you) glows for 1.5s with a hiss, then flares for 8 damage to you and 45 to every enemy on it.
  - Grease pops: a spot wobbles for 1.4s, pops for 4, and leaves a 3s slick that slides like ice (it lives in `tempIce`).
  - Both run on real time (`this.now`), not the stage clock, so Quick Runs aren't swamped; they get more frequent as `stageT` grows.
  - Rack posts (drawn as oven knobs, about 1 per floor chunk): solid, seeded per floor chunk like ice, never near the start. You and enemies (not bosses) slide around them (`pushOut`). They block enemy shots but never yours.
  - Ember Crumbs leave a little flame (3 damage) where they die; Melting Scoops drip small melt puddles. There is no Warm Mug in the oven.
- **Freezer cast:** elites alternate Ice Cream Scoop (melt puddles that slow you) and Frosted Croissant (the 3:45 one carries the second bun). Tyrant Jr. is a surprise at 4:00. Frozen Waffle mini-boss at 2:30 (3 telegraphed charges, then rests; splits into 4 squares). The Freezer Burn boss at 4:30: warning lines then icicle volleys, pizza-slice fans; at half health it enrages (faster volleys, frost circles that freeze the floor, Frosted Crumb rings). Music `frun` (layered like `run`) and `fboss`. Contact damage dial 0.94.
- **Toaster Oven cast:** Molten Muffin elites (fire trail, ember ring on death; the 3:45 one carries the second bun). Freezer Burn returns as a surprise elite at 4:00 (one warned icicle fan at a time). Flapjack Stack mini-boss at 2:30 (pancake throws; loses a pancake every 20% health, getting faster). The Broiler boss at 4:30: sweeping flame lines (`beams`) and fireball fans; at half health, coil patterns centred on you (`coilPattern`) and Toaster Tot rings. Music `orun` and `oboss` (with the `sizzle` drum). Bot: about 11% more damage taken per minute than the Freezer. Seeds give 10% less XP in the oven (`xp` dial on the stage).
- **The Pantry (M15, stage flags `shelves`, `cans`, `flour`):**
  - **Shelves** are solid boxes (`Wall`: centre and half sizes) laid out on their own grid of 288 cells (`SHELF_CELL`), none, one or two to a cell, seeded like everything else on the floor. Rows of cells mostly agree on direction, so shelves line up into aisles. Every shelf stays 56 from its cell's edges, so **the cell borders are always open corridors 112 wide**: nothing can box the player in, and rolling cans use those corridors. The start is an open crossroads.
  - Shelves block you, enemies and enemy shots, never your shots. Mini-bosses and bosses (radius 30 and up) and `line` enemies ignore them. Pickups that would land in a shelf slide out (`Pickups.drop`).
  - **Path-finding:** `Floor` keeps a flow field (32 cells, rebuilt 5 times a second): steps to the player from every cell near them. `steer` sends an enemy straight at the player when its line is clear, otherwise toward the neighbouring cell with the fewest steps. `Enemies.update` applies it before `behave`, to `mvx` and `mvy` only, so behaviors still aim with the true direction (`dx`, `dy`). A new solid thing must be in `floor.walls` to be walked around.
  - **Short-lived walls** (`floor.addTemp`): a warning outline, then solid for a few seconds, then they melt. The Spaghetti Tangle's knot and Mother Dough's dough walls use them. `wallSpot` in `behaviors.ts` picks a spot clear of you, of shelves and of other short-lived walls.
  - **Rolling cans:** every 9s falling to 5.5s (real time, like the oven's hazards), a can rattles at the end of the nearest corridor with a red strip and arrows for 1.2s, then rolls 820: 8 damage to you, 45 to every enemy (knocked aside). 12 enemies flattened by one can is a "Strike!" (`g.strike`, `save.records.strike`, a challenge). Endless rolls two at once after 6:00.
  - **Flour puffs:** a sack wobbles for 1.2s, then leaves a cloud for 3s. The cloud is drawn on the floor (depth 5) and small enemies inside it are drawn faint (`e.faint`); the bagel, shots and pickups are never hidden.
  - **Cast:** Dust Bunny (swarm), Sugar Cube (splits into 3 crystals), Rolling Pea Can (charger with `bounce`: it reflects off walls mid-charge), Pepper Shaker (5 short-lived shots, `life` on the shot def), Molten Muffin as a regular from 2:45 (`pmuffin`, after the mini-boss has arrived), Mold Spores, Waffle Bit lines. Elite: Moldy Loaf (breathes 4 spores every 4.2s; the 3:45 one carries the second bun). Surprise at 4:00: Broiler Jr. (one warned flame line). Mini-boss: Spaghetti Tangle (noodle lines are `addBeam(…, true)` every 3.3s, a knot every 9s, one at a time). Boss: Mother Dough (bubbles are `addRing(…, 'bubble')`, dough blob fans; at half health she swaps to `en_mdough2`, grows, pushes two dough walls every 7.5s and calls Dough Ball rings). Music `prun` (woodblocks, plucked bass) and `pboss`.
  - **Dials:** contact damage 0.94 (shelves funnel enemies into you, so it sits below the oven's), spawn rate 1.04, health growth 135, XP 0.9, Dough 2.5x. Bot: about 9% more damage taken per minute than the oven (20% more around the mini-boss, level by the end).
  - **Garlic** (quirk `ward`, unlocked by clearing the Pantry): everything it does deals 25% more to enemies with `flat` on their def (elites, mini-bosses, bosses). Applied in `GameScene.hit`. The owner picked this over an aura, which was too close to Onion Olly.
  - **Stage 5 (the Bread Bin)** is in `STAGES` with `built: false`: it shows as "Coming soon". The challenges and the Rainbow goal written before the Pantry are pinned to the first three stages (`STAGES.slice(0, 3)`), so their meaning didn't change.
- **Goals page (M11):** the menu's bottom row is Bakery / Goals / Cookbook. Goals has three tabs: Unlocks (every bagel, weapon and stage goal, with progress bars), Challenges (12 one-time Dough rewards in `goals.ts`) and Secrets (the Rainbow bagel and Lox and Schmear, "???" until found).
  - Challenges read the save: single-run bests live in `save.records` (kills, level, evos, endless time, endlessBosses; practice never counts), `save.noHitBoss` is set when a stage boss falls with no hit taken since it arrived (`bossClean` in `GameScene`, saved in the resume snapshot), and the rest are worked out from `stageClears`, `crispyClears` and the bests.
  - `claimGoals` pays at the end of a run (shown first on the results screen) and when the menu opens (so older saves get paid). `save.goalsPaid` holds paid ones; anything paid but not in `save.goalsSeen` puts a red dot on the Goals button and a NEW tag on its row until the Challenges tab is opened.
- **Cookbook Enemies tab (M11):** one page per stage from `ENEMY_BOOK` in `data.ts` (name, one-line blurb, `role` for elites and bosses). An enemy counts as met the first time it spawns (`save.met`, practice included); older saves count every enemy of a cleared stage as met, and a beaten boss always counts. Unmet enemies are dark shapes with "???"; beaten mini-bosses and bosses get a crown. Tap a cell to read about it.
- **Secrets (M11 Part 2):**
  - **Rainbow** (`secret: true` on its `BAGELS` entry): shows as "???" on the picker, and is left out of the Unlocks tab and the results screen's goal hints, until found. Goal kind `rainbow`: clear all 3 stages, each with a different bagel (`rainbowStages` in `progress.ts` matches stages to distinct bagels from the bests, any mode). Quirk `mixin`: a random starting weapon from the open ones (`startWeapon`) and 4 cards per level-up. Preview builds hand it out like the other new bagels.
  - **Lox and Schmear** (`COMBO` in `weapons.ts`): when Schmear Flood and Lox Cyclone are both evolved, the next gold toaster merges them, ahead of any normal evolution that's waiting (that one comes from the next chest). The puddle weapon is removed and the Lox weapon gets `combo = true`: 6 circling lox (20 damage each) plus a schmear storm (radius 180, 18 damage every 0.35s, slows, and pulls light enemies in toward the lox ring). Own hit sound and spark (`'combo'` FxId), icon `ic_loxschmear`, saved in the resume snapshot, recorded in `save.secrets`. It doesn't count toward evolutions. The puddle never comes back on cards once merged. Hits stay under 30 so they don't trigger the freeze-frame (`hitstop`) constantly. Bot (`wbench.cjs 6 combo,pair`, normal speed): about the same useful damage as the two evolutions side by side (~340/s) with about 75% less damage taken, plus the free slot.
- **Modes (M10):** the menu switch is Full / Quick / Endless (`save.quick`, `save.endless`), and the flame button beside the stage button is **Extra Crispy** (`save.crispy`; the design doc called it "Burnt", the owner renamed it). Both open for a stage after it's cleared (`modesOpen` in `progress.ts`; always open in preview builds).
  - **Endless:** Full pace only, never practice. The first 4:30 is a Full Run. Beating the boss counts as a clear (`endlessCleared`), drops a gold toaster and the run carries on: elites every 45s, the mini-boss back every 2 min, the boss back every 3 min with ×1.5 health each time (`bossRound`), waves every 30s, spawns +10% per minute after 5:00, music a bit faster each minute. Score is time only. Dough: normal pay, the clear bonus, plus 10 per full minute after 5:00.
  - **Extra Crispy:** every enemy ×1.4 health, spawns ×1.2, everything that hurts you ×1.25 (`CRISPY_DMG`), Dough ×1.5. Works with every mode. Clears on it go in `save.crispyClears` (a flame star on the stage card). Bot: about +30% damage taken per minute on every stage.
  - Bests are keyed by `bestStage(stage, mode, crispy)`: `stage1`, `stage1q`, `stage1e`, plus `x` for Extra Crispy (`stage1ex`).
- **Dodging and crowds (tuned after the owner's Pantry playtest; constants in `src/run/modes.ts`):** the owner wants damage to be dodgeable and good movement rewarded, in every stage. Keep to that when adding enemies.
  - **Charge lanes:** every `charge` enemy draws a red strip along its dash while it winds up and dashes (`Enemies.lane`, floor level). A Pea Can's lane bends where it will bounce. The dash direction is fixed when the wind-up starts, so stepping out of the lane always works. A new charger gets a lane for free; a new kind of dash attack needs its own.
  - **At most 3 chargers** wind up or dash at once (`MAX_CHARGING`); the rest keep walking.
  - **Spawns:** 40% appear in the direction you're moving (`spawnPoint`; it was 70%), and the ring waves leave an opening of `WAVE_GAP` (about 110 degrees) in a random place.
  - **Regular enemies have 20% less health in every stage** (`CROWD_HP`, inside `hpMult`). Flat-health enemies (elites, bosses) are not touched.
  - **About a fifth fewer regular enemies in every stage** (`CROWD_COUNT` 0.82: slower spawns, lower caps, smaller waves). Seeds are worth more by the same share (`CROWD_XP`), so levels come at the same pace. The owner asked for both after playing the first pass ("the swarms are still pretty thick").
  - **After a hit** the bagel is safe for 1.1s (`HIT_GRACE`).
  - `tools/bots/dodgebench.cjs` plays a stretch carelessly and carefully and prints the damage each takes and what dealt it. If careful play doesn't take much less, the damage isn't dodgeable.
- **Enemy behavior** comes from `ai` on the enemy's def (`line`, `charge`, `shoot`), plus `split` and `burst` for death effects, so new stage casts reuse it without new code.
- **Sticky Bun:** pickup kind `'bun'`. Touching it pulls every seed and coin to you.
  - Drops: the Croissant always drops one. In Full Runs only, the last Giant Mold before the boss drops a second.
  - It lands on the far side of the boss, never drifts toward you, gets an edge arrow, and is saved in the snapshot.
  - **There is no automatic seed pull anywhere.** The owner found it jarring.
- **Seeds:** once there are more than 300 on the floor, new ones merge into the nearest seed, so nothing is lost.
- **Where new run state goes:** the scene object is reused between runs, so never put run state in a plain `GameScene` field. Put numbers in `RunState` (made fresh in `init()`) and anything with sprites in the part that owns it (the parts are made fresh in `create()`). Before this, every field was reset by hand and a missed one left invisible oven knobs in other stages.
- **Effect sprites** (sparks, crumbs, trail dots, death pops) come from `g.effects.fx()` and go back with `g.effects.done()`: they are reused, never destroyed. Anything that loops forever (`repeat: -1`) must be stopped when its sprite goes (`tweens.killTweensOf`), because Phaser keeps animating destroyed sprites.
- **One panel at a time:** chests aren't collected while a panel is open, so two chests touched together open one after the other.
- **Build limits:** 4 weapon slots and 4 topping slots, each up to level 5. A level 5 weapon plus its matching topping evolves from a chest.
- **Chests only level up what you own** (`chestUpgrades`): they never add a new weapon or topping, so empty slots are filled only from level-up cards (the owner's call: it keeps build choices with the player). Nothing left to level means a full heal.
- **Weapons:** 6 starters plus 4 that unlock through goals (`unlock` on the def, `progress.ts`): Piercing Butter Knife (beat the Frozen Waffle), Jam Jar Lob (15 Warm Mugs in total), Toaster Pop (beat the Freezer Burn), Waffle Stomp (6 evolutions). A locked weapon and its topping (`weapon` on the topping def) never show on cards. The save keeps `weapons`, `beaten` (boss kinds) and `mugs`; practice runs count for nothing. Old saves with a Freezer clear count both Freezer bosses as beaten. New toppings: Honey (+4% damage every level, and `stats.proj`: +1 projectile at levels 1 and 4, capped at +2), Jam (`stats.dur`, +15% duration per level), Everything Seasoning (adds to Lucky Seed luck), Cream Cheese Frosting (adds to Hard Crust; a hit still does at least half). The Cookbook has Evolutions (5 a page) and Weapons tabs.
- **Weapon flare ("Crisp", the owner's pick):** every weapon hit goes through `Weapon.strike`, which passes the weapon id to `GameScene.hit`; that plays the weapon's own hit sound (`hitSfx` in `sfx.ts`) and spark (`hitSpark`). Level 5 projectiles are tinted gold, evolved ones take the evolution's color, and both leave a light trail (`trail`, `trailDot`). No pop words and no extra screen shake: the owner chose the quiet style. Trails must never be blue or green (those read as XP seeds).
- **Bakery:** 8 permanent upgrades, 5 ranks each, in two tabs (`tab` on the def). Basics: Crust health, Oven damage, Rise speed, Sticky Seeds magnet. Extras: Lucky Seed (better cards, more gold toasters), Reroll Rack, Second Bake (one revive per run), Hard Crust (-1 damage per hit, never below half). With no Extras bought, runs play exactly as before.
- **Bagel quirks** (`quirkId` in `BAGELS`): Blueberry's `dash` (flick or SPACE, 5s cooldown ring, safe while dashing) Asiago's `aged` (+1% damage per 10s of stage time, up to +30%, HUD badge) and Jalapeño Cheddar's `spicy` (10% of hits set the enemy on fire for 3s: a tick every 0.5s for 30% of the hit, at least 3; burning enemies get an orange tint and a flickering flame, no sound or flash per tick). Goals can be `stageclear` or `stagetime` on a given `stage`; `checkUnlocks` runs when the menu opens.

- **Saves and settings (M12):**
  - **Changing the save's shape:** add a step to the end of `STEPS` in `save.ts`. Step N takes a save from version N to N + 1 and runs once per save. Never edit or reorder old steps, and add a fixture or a check to `tools/bots/savetest.cjs`.
  - **Spare copy:** every clean load copies the save to `everything-bagel-save-spare`. If the main save can't be read, the spare loads and the menu says so (`takeRecovered`). Reset and a pasted backup code keep the old save as the spare first.
  - **Backup code:** `EB1:` plus the save as base64 JSON (`backupCode`, `restoreCode`). A code that isn't a save is refused and changes nothing. The reminder card shows after the first stage clear and then every 30 days since the last backup or "Later" (`backupAt`, `backupNudge`).
  - **Settings** live in `save.settings` (music and sound 0 to 100, `shake`, `flash`, `saver`, `lefty`) and are read through `settings.ts` only. In a run: use `shake(g, ms, amount)` and `flash(g, …)` instead of the camera's own, `blink()` for warning strobes (steady when flashing is Reduced), and check `saver` before adding lots of particles. The left-handed HUD is laid out in `hud.ts`.
  - **Version:** `package.json`'s version is the game's version (`VERSION`, shown on the title screen and in Settings, About). Each milestone: bump it, and rewrite `whatsnew.ts`. The card shows once per version to anyone who has played before (`save.seenVersion`).
  - **Practice** is a switch on the stage picker (`save.practice`); PLAY turns blue and reads PRACTICE while it's on. Music and Sound are sliders in Settings.
- **Onboarding (M13):**
  - **Tips** are one-time notes, each shown once per save (`save.tips`), never with the Tips setting off, never in practice runs. To add one: add its text to `TIPS` in `tips.ts`, then a trigger in `Tutor` (in a run) or a `tipDue` / `markTip` pair where it shows (panels, menu, results). In-run tips never pause play and queue one at a time.
  - **Old saves:** save step 3 marks the tips an existing save has clearly outgrown. A new tip for something old players already know needs the same treatment in a new step.
  - **The menu's bottom bar** opens as you go (`save.open`, NEW tags in `save.fresh`): the Bakery and Goals at the end of the first non-practice run (`endRun`), the Cookbook at the first evolution (`openChest`). A new bottom-bar button needs a `MenuItem` and an `openMenu` call, or it is open from the start.
  - **Evolution recipes** show on every weapon and topping card (`partner` in `panels.ts`) and on the pause screen's weapon tiles. These are permanent, not tips.
  - **Story text** lives in `data.ts`: `boss.card` (the boss's line, every boss has one), `mini.line`, and `outro` (results screen, first clear of the stage). The comic's words are in `IntroScene.ts`.
  - The first results screen (`toBakery` in `ResultsScene`) swaps its buttons for BAKERY and Again; `MenuScene` takes `{ open: 'bakery' }`.
- **Animation and feel (M14):**
  - **Nothing here changes play.** Poses are scale only and are set in one place per thing: the bagel in `GameScene.renderWorld`, enemies at the end of `Enemies.update` (small ones squash only when their hit flash turns on or off; big ones, radius over 20, get `pose()` every frame: breathing, hit wobble, wind-up, roar, drop). Behaviors must not set an enemy's scale.
  - **Wind-ups** come from the attack timer (`WINDUP` kinds rear up when `attackT` is under 0.4s), so they can't drift from the attack. A new boss with a timed attack: add its kind to `WINDUP`.
  - **Boss entrances:** `Enemies.dropIn` (used by the director for mini-bosses and bosses, not by resume) lands the boss just inside the screen edge. For `DROP_TIME` (0.7s) it stands still and can't hurt by touch, while its attack timers run as always. `tools/bots/bosstime.cjs` checks arrival and first attack against another build.
  - **A stage boss's fall:** `bossDown` starts half a second of slow motion (`run.slowT`, `SLOWMO` in `modes.ts`); the win (`run.pendingWin`) follows it in `GameScene.update`. Nothing hurts the bagel in between, and no snapshot is written.
  - **Defeat styles** follow the enemy's kill sound (`DEATH` in `enemies.ts`): crunchy and hard things crumble, wet things splat, the rest pop.
  - **Pickups:** seeds, coins and hearts hop (`hop` on the pickup, moved in the pickups loop, no tweens); chests, buns and mugs fall in with a bounce, then bob.
  - **Pop-ups:** level-up cards are dealt face down and flip. A chest's reveal is a list of steps that a tap jumps to the end (`play` / `ends` in `openChest`); a second tap closes. Evolutions show both halves of the recipe sliding together.
  - **HUD:** a changed build slot pops; the boss bar has a name plate, a trailing pale bar and a half-health notch for bosses with `phase2` on the stage's `boss`; under 25% health the screen's edges glow red (steady with Flashing Reduced).
  - **Results:** laid out finished, then played in once (`played`); `finals` jump every piece to its end state on a tap. The Dough purse sits on the panel's top edge, and the nearest bagel unlock has a bar.
  - **Sound:** songs crossfade (`retire` in `music.ts`); each song has a measured `level` (`tools/bots/mixtest.cjs` prints loudness per song: re-run it after changing a song); sounds listed in `VARY` in `sfx.ts` get a slightly different pitch each time.
- **Screen changes:** title to menu, menu to a run, and results to menu or a new run use the wipe. Resuming a saved run and the end of a run keep their fades.

## Testing

- `npm run build` runs tsc plus the Vite build. CI (`.github/workflows/ci.yml`) runs the same thing on PRs.
- **URL flags:** `?god` (no damage), `?speed=N` (1 to 20× game speed), `?t=SECONDS` (start at that stage time).
- **`window.__game`** is the Phaser game. Use `scene.getScene('game')` to read or poke run state in bot tests: for example `g.run.level`, `g.run.pendingLevels`, `g.foes.list`, `g.foes.boss`, `g.loot.list`, `g.hz.shots`, `g.panels.openLevelUp()`, `g.panels.close()`.
- Bot scripts are in `tools/bots/` (see its README). The preview server is `vite preview --port 4191`. The game opens on the title screen: bots start runs with `getScene('title').scene.start('game', …)` or tap through it. `savetest.cjs` loads a save from each era and checks the spare, backup codes and reset; run it after touching `save.ts`. `tutortest.cjs` plays a brand-new save through the comic, the locked menu and the first run's tips; run it after touching tips, the bottom bar or the intro. `look.cjs` and `bossview.cjs` save screenshots of a stage in play and of a boss up close. `fpsbench.cjs` counts real frames in a busy stretch of each stage (compare two builds side by side), `bosstime.cjs` prints when each boss arrives and first attacks, and `mixtest.cjs` measures each song's loudness. A new save's first tap on the title goes to the intro comic: bots that tap through set `intro: true` in their save.
- `window.__save` has `load`, `persist`, `backupCode`, `restoreCode`, `resetSave` and `takeRecovered`.
- `node tools/icons.cjs` redraws the home-screen icons from the title art.
- Take screenshots at 390×760 and deviceScaleFactor 2 (iPhone-like). Check 390×640 too, because the menu has a compact layout under 720 tall.

## Preview artifact (playable link for the owner)

1. Run `VITE_PREVIEW=1 npm run build` (opens every built stage for testing).
2. Inline `dist/assets/index-*.js` into the single-file `everything-bagel.html`: replace the one `<script>` body, escaping `</script`.
3. Republish it to the **same** artifact URL so the owner's link stays valid: https://claude.ai/artifact/DCNqaxNKwwiiFz9dYn7A4f.
4. If the HTML file is gone (a new container), fetch the published file with the Artifact tool and reuse it as the template.

## Tooling notes for cloud sessions

- Use `gh api` REST for GitHub calls (GraphQL was blocked). Example:
  `gh api repos/LG13002/Bagel-Survivor/pulls -f title=… -f head=… -f base=main -F body=@file`
- After opening a PR, subscribe to its activity and fix CI if it goes red.
- Push with a retry loop. Fetch main with `git fetch origin main:refs/remotes/origin/main`.
- Workflow action versions: checkout@v7, setup-node@v7, upload-pages-artifact@v5, deploy-pages@v5.

## Ideas parked for later

- **Phase 3:** see the design doc linked under Status. It is the source of truth for the remaining milestones (M16 the Bread Bin finale is next).
- More tuning from the owner's phone runs. Easy dials: the stage dials in `STAGES`, the weapon numbers in `weapons.ts`, and the `RUN` timings.
- Sesame Shot is the weakest weapon at level 3 (on purpose for the starter). Buff it if the owner says it feels slow.

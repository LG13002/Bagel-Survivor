# CLAUDE.md: Everything Bagel

Read this first. It is the handoff for any Claude session working on this repo. The full history of what was built and why is in `docs/HANDOFF.md`.

## What this is

- **Game:** "Everything Bagel", an original one-thumb survivor roguelite for phones. You are a bagel defending the last bakery from the Stale.
- **Owner:** the repo owner (LG13002). The game is built for phones, played as a home-screen PWA in short sessions. That's why runs are short, the game auto-pauses on app switch, and runs resume after iOS kills the app.
- **Live:** https://lg13002.github.io/Bagel-Survivor/. Pushes to `main` deploy through GitHub Actions to Pages.
- **Repo:** `LG13002/Bagel-Survivor` is public, and `index.html` has a noindex meta tag (the owner's choice).
- **Stack:** Phaser 3.90, TypeScript, Vite. There are no image or audio files: **all art is drawn in code** with Canvas2D, and **all music and sound are synthesized** with WebAudio.
- **Status (2026-11-11):** Stage 1 and the prototype (M1 to M4) are complete. **Phase 2** (content) is planned in the [Phase 2 design doc](https://claude.ai/artifact/TBqYzaqW3kXDxSGh1ieQfa) as milestones M5 to M11. M5 (stage framework and stage picker), M6 (the Freezer, in two parts) and M7 (Blueberry, Asiago and the Bakery's Extras tab) are built. M8 (4 new weapons, then the "Crisp" flare pass the owner picked on the style board) is built. M9 (the Toaster Oven, two parts) is built. M10 (Endless mode and the Extra Crispy hard toggle) [change list](https://claude.ai/artifact/EEsQTPuvpDQm2qZ3TxVpaV) is built. M11 ([change list](https://claude.ai/artifact/2epR6A5tmgMBGMFsuzTkCr)): Part 1 (Goals page, Cookbook Enemies tab) is built; Part 2 (the secret Rainbow bagel and the Lox and Schmear combo evolution) and Part 3 (the full balance pass, numbers in `docs/HANDOFF.md`) share one PR. That completes Phase 2. After it, a code review pass ([findings](https://claude.ai/artifact/6HTNUYVxC6hHcH62aC1CCc)) fixed 8 bugs and added the optimizations listed in `docs/HANDOFF.md`; no gameplay numbers changed.

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
- **Where things live:**
  - Every texture is a function in `src/art.ts`, registered in `src/textures.ts` through `ctex(scene, key, w, h, draw)`.
  - `ctex` draws at device scale S, so textures stay sharp on retina screens.
  - Art is drawn the first time it's needed, in three groups in `textures.ts`: `makeTextures` (what the menus show), `makeEnemyTextures` (runs and the Cookbook's Enemies tab) and `makeRunTextures(scene, stage)` (that stage's floor and props, plus weapons, shots and hazards). **Put a new texture in the right group**, or it shows as a missing-texture box. The menu background is `floor_stage1`.
  - Hero and results bagels use a `<tex>_big` 160px texture, drawn on demand by `bigBagel(scene, tex)`.
- **Stage 1 floor:** the "Giant countertop", a butcher block (`src/floors.ts`) with props scattered in seeded 384px chunks (spoon, cookie cutters, cup, flour, sprinkles). Each stage names its floor and prop set in `STAGES` in `src/data.ts`. Stage 2 is the Freezer, Stage 3 the Toaster Oven.
- **UI kit (`src/ui.ts`):**
  - `button()`: chunky, with an ink outline, a 5*S bottom edge, a press shift and a click sound. Options: `icon`, `chevron`, `muted`.
  - `pill()`, `drawPips()`, and `panel` (ink outline plus an inner light stroke).
  - Icons for the UI live in `UI_ICONS` in `art.ts`. Upgrade icons live in `ICONS`.
- **Palette:** `COLORS` and `CSS` in `src/config.ts` (bg `#2b2118`, cream `#fff3dc`, gold `#f2b84b`, red `#e0533d`, green `#7fbf4d`, xp blue `#6cc7f0`). Level-up card colors by type: weapon orange `0xf08a3c`, topping blue `0x5aa9e6`, heal/coin green, combo gold with a spinning star.

## Code map

| File | What's in it |
| --- | --- |
| `src/config.ts` | `S` (device scale, max 3), `ZOOM = 1.2` (world zoom; the owner asked for +20%), colors, safe insets, `DEBUG` URL flags |
| `src/data.ts` | **All tuning:** weapons, toppings, evolutions, bagels, Bakery upgrades, enemies, `STAGES` (one recipe per stage: cast, timeline banners, music, Dough pay, difficulty dials), `RUN` pacing, `xpNeeded` |
| `src/weapons.ts` | The 10 weapon classes (normal and evolved behavior; damage numbers are inline here). `pickTargets` and `Lob` are shared by the thrown weapons |
| `src/scenes/GameScene.ts` | The run: director/spawning, pickups, the Sticky Bun, chests, level-up, HUD, pause, audio state, Quick Run pacing, resume snapshot |
| `src/scenes/MenuScene.ts` | Menu, bagel picker (swipe and chevrons), Full/Quick switch, toggles, Bakery shop, Cookbook |
| `src/scenes/ResultsScene.ts` | End of run, Dough payout, new-best banners |
| `src/art.ts`, `src/floors.ts`, `src/textures.ts` | Drawn-in-code art |
| `src/sfx.ts` | WebAudio buses (sfx 0.35, music 0.16 through a lowpass), all sound effects, voice cap, unlock on first tap |
| `src/music.ts` | Step sequencer and the songs `menu`, `run` (intensity layers), `boss`, `win`, `stale`. API: `playMusic`, `setRunIntensity`, `playJingle`, `stopMusic` |
| `src/goals.ts` | The Goals page's challenges (`CHALLENGES`: id, name, Dough reward, `status(save)`), `claimGoals` (pays newly done ones) and `unseenGoals` (the red dot) |
| `src/save.ts` | localStorage key `everything-bagel-save-v1`. Bests are keyed `'<stage>:<bagel>'` (`bestStage()`: `stage1`, `stage1q` Quick, `stage1e` Endless, plus `x` for Extra Crispy). `stage` = last picked stage, `stageClears` = clears per stage (unlocks the next stage) |
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
- **Enemy behavior** comes from `ai` on the enemy's def (`line`, `charge`, `shoot`), plus `split` and `burst` for death effects, so new stage casts reuse it without new code.
- **Sticky Bun:** pickup kind `'bun'`. Touching it pulls every seed and coin to you.
  - Drops: the Croissant always drops one. In Full Runs only, the last Giant Mold before the boss drops a second.
  - It lands on the far side of the boss, never drifts toward you, gets an edge arrow, and is saved in the snapshot.
  - **There is no automatic seed pull anywhere.** The owner found it jarring.
- **Seeds:** once there are more than 300 on the floor, new ones merge into the nearest seed, so nothing is lost.
- **Run state is reset by hand in `GameScene.init()`.** The scene object is reused between runs, so every new field that holds run state needs a line there (a missed one left invisible oven knobs in other stages).
- **Effect sprites** (sparks, crumbs, trail dots, death pops) come from `fx()` and go back with `fxDone()`: they are reused, never destroyed. Anything that loops forever (`repeat: -1`) must be stopped when its sprite goes (`tweens.killTweensOf`), because Phaser keeps animating destroyed sprites.
- **One panel at a time:** chests aren't collected while a panel is open, so two chests touched together open one after the other.
- **Build limits:** 4 weapon slots and 4 topping slots, each up to level 5. A level 5 weapon plus its matching topping evolves from a chest.
- **Chests only level up what you own** (`chestUpgrades`): they never add a new weapon or topping, so empty slots are filled only from level-up cards (the owner's call: it keeps build choices with the player). Nothing left to level means a full heal.
- **Weapons:** 6 starters plus 4 that unlock through goals (`unlock` on the def, `progress.ts`): Piercing Butter Knife (beat the Frozen Waffle), Jam Jar Lob (15 Warm Mugs in total), Toaster Pop (beat the Freezer Burn), Waffle Stomp (6 evolutions). A locked weapon and its topping (`weapon` on the topping def) never show on cards. The save keeps `weapons`, `beaten` (boss kinds) and `mugs`; practice runs count for nothing. Old saves with a Freezer clear count both Freezer bosses as beaten. New toppings: Honey (+4% damage every level, and `stats.proj`: +1 projectile at levels 1 and 4, capped at +2), Jam (`stats.dur`, +15% duration per level), Everything Seasoning (adds to Lucky Seed luck), Cream Cheese Frosting (adds to Hard Crust; a hit still does at least half). The Cookbook has Evolutions (5 a page) and Weapons tabs.
- **Weapon flare ("Crisp", the owner's pick):** every weapon hit goes through `Weapon.strike`, which passes the weapon id to `GameScene.hit`; that plays the weapon's own hit sound (`hitSfx` in `sfx.ts`) and spark (`hitSpark`). Level 5 projectiles are tinted gold, evolved ones take the evolution's color, and both leave a light trail (`trail`, `trailDot`). No pop words and no extra screen shake: the owner chose the quiet style. Trails must never be blue or green (those read as XP seeds).
- **Bakery:** 8 permanent upgrades, 5 ranks each, in two tabs (`tab` on the def). Basics: Crust health, Oven damage, Rise speed, Sticky Seeds magnet. Extras: Lucky Seed (better cards, more gold toasters), Reroll Rack, Second Bake (one revive per run), Hard Crust (-1 damage per hit, never below half). With no Extras bought, runs play exactly as before.
- **Bagel quirks** (`quirkId` in `BAGELS`): Blueberry's `dash` (flick or SPACE, 5s cooldown ring, safe while dashing) Asiago's `aged` (+1% damage per 10s of stage time, up to +30%, HUD badge) and Jalapeño Cheddar's `spicy` (10% of hits set the enemy on fire for 3s: a tick every 0.5s for 30% of the hit, at least 3; burning enemies get an orange tint and a flickering flame, no sound or flash per tick). Goals can be `stageclear` or `stagetime` on a given `stage`; `checkUnlocks` runs when the menu opens.

## Testing

- `npm run build` runs tsc plus the Vite build. CI (`.github/workflows/ci.yml`) runs the same thing on PRs.
- **URL flags:** `?god` (no damage), `?speed=N` (1 to 20× game speed), `?t=SECONDS` (start at that stage time).
- **`window.__game`** is the Phaser game. Use `scene.getScene('game')` to read or poke run state in bot tests.
- Bot scripts are in `tools/bots/` (see its README). The preview server is `vite preview --port 4191`.
- Take screenshots at 390×760 and deviceScaleFactor 2 (iPhone-like). Check compact heights too, because the menu has a compact layout.

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

- **Phase 2:** see the design doc linked under Status. The doc is the source of truth for stages, enemies, bagels and weapons.
- More tuning from the owner's phone runs. Easy dials: the stage dials in `STAGES`, the weapon numbers in `weapons.ts`, and the `RUN` timings.
- Sesame Shot is the weakest weapon at level 3 (on purpose for the starter). Buff it if the owner says it feels slow.

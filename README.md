# Everything Bagel

A short-session, one-thumb survivor roguelite for phones. You are a bagel defending the last bakery from the Stale. Survive 5 minutes, beat the Toaster Tyrant, then get back to your match.

Game plan: https://claude.ai/artifact/3zMQXC7czm7Hi7xSGMgoZV

## Play on your iPhone

1. Open the GitHub Pages link (Settings → Pages shows it once deployed) in Safari.
2. Tap Share → **Add to Home Screen**. It then launches full screen like an app and works offline.

## How it plays

- Touch and drag anywhere to move. Weapons fire on their own.
- Collect sesame seeds (XP) to level up, then pick 1 of 3 upgrades. Up to 4 weapons and 4 toppings, each to level 5.
- A max-level weapon plus its matching topping **evolves** when you open a Toaster Chest (dropped by elites every minute and the mini-boss).
- Giant Mold every minute, Crusty Croissant at 2:30, the Toaster Tyrant at 4:30. Beat him to clear the stage and unlock Everything Ed.
- Every run pays Dough, which you spend in the Bakery on permanent upgrades.
- The game pauses itself when you switch apps, so you can jump back into your match any time.

| Weapon | + Topping | = Evolution |
| --- | --- | --- |
| Sesame Shot | Caffeine | Seed Gatling |
| Seed Storm | Hot Oven | Everything Inferno |
| Cream Cheese Puddle | Extra Butter | Schmear Flood |
| Lox Boomerang | Glaze | Lox Cyclone |
| Hot Coffee Splash | Salt Crystals | Espresso Nova |
| Rolling Pin | Fresh Dough | Baker's Dozen |

## Develop

```bash
npm install
npm run dev      # http://localhost:5173, also on your LAN for phone testing
npm run build    # type-check + production build into dist/
```

Built with Phaser 3, TypeScript and Vite. All art is drawn in code (`src/textures.ts`), and all tuning lives in `src/data.ts`.

Testing flags (add to the URL): `?speed=4` runs the game 4× faster, `?god` makes you invincible, `?t=200` starts the clock at 3:20.

## Deploy

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

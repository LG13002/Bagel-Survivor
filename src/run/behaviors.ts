// How each enemy moves and attacks. Regular enemies share the `ai` patterns on their def (line, charge, shoot);
// elites, mini-bosses and bosses have their own case, keyed by kind.
import { ENEMIES } from '../data';
import { CHARGE_TIME, MAX_CHARGING } from './modes';
import { reducedFlash, shake } from '../settings';
import type { Enemy } from '../entities';
import { sfx } from '../sfx';
import type { GameScene } from '../scenes/GameScene';

/** One enemy's step: where the player is, and the move it will make (a behavior can change mvx and mvy). */
/** A charger's wind-up flashes white 8 times a second. With Flashing effects Reduced it only shakes (and a knife keeps its red tint). */
function windupFlash(t: number): boolean {
  return !reducedFlash() && Math.floor(t * 16) % 2 === 1;
}

export interface Move {
  dx: number;
  dy: number;
  dist: number;
  mvx: number;
  mvy: number;
  slow: number;
}

/** Run one enemy's behavior for this step. */
export function behave(g: GameScene, e: Enemy, m: Move, dt: number): void {
  const t = g.now;
  const p = g.player;
  const hz = g.hz;
  const { dx, dy, dist, slow } = m;
  const ai = ENEMIES[e.kind].ai;
  switch (ai === 'line' ? 'line' : ai === 'charge' ? 'charge' : ai === 'shoot' ? 'shoot' : e.kind) {
    case 'line':
      m.mvx = e.vx * slow;
      m.mvy = e.vy * slow;
      e.sprite.setRotation(e.kind === 'sprinkle' ? t * 8 : Math.atan2(e.vy, e.vx));
      break;
    case 'charge': {
      // Knives and ice cubes: close in, stop and wind up (flash), dash in a straight line, recover.
      const knife = e.kind === 'knife';
      const dash = ENEMIES[e.kind].dash ?? 430;
      e.stateT -= dt;
      if (e.state === 0) {
        if (knife) e.sprite.setRotation(Math.atan2(dy, dx));
        else {
          if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
          e.sprite.setRotation(Math.sin(t * 9 + e.phase) * 0.08);
        }
        if (dist < 190 && Math.max(g.foes.charging, g.foes.chargingNow) < MAX_CHARGING) {
          g.foes.chargingNow++;
          e.state = 1;
          e.stateT = knife ? 0.55 : 0.6;
          e.vx = (dx / dist) * dash;
          e.vy = (dy / dist) * dash;
        }
      } else if (e.state === 1) {
        g.foes.chargingNow++;
        m.mvx = m.mvy = 0;
        if (knife) e.sprite.setRotation(Math.atan2(e.vy, e.vx) + Math.sin(t * 60) * 0.12);
        else e.sprite.setRotation(Math.sin(t * 60) * 0.14);
        e.sprite.setTint(knife ? 0xff8a7a : 0xffffff);
        if (!knife && windupFlash(t)) e.sprite.setTintFill(0xffffff);
        if (e.stateT <= 0) {
          e.state = 2;
          e.stateT = CHARGE_TIME;
          e.sprite.clearTint();
        }
      } else if (e.state === 2) {
        g.foes.chargingNow++;
        m.mvx = e.vx * slow;
        m.mvy = e.vy * slow;
        // Burnt Toast flips end over end as it charges.
        if (e.kind === 'btoast') e.sprite.setRotation(e.sprite.rotation + dt * 16);
        if (e.stateT <= 0) {
          e.state = 3;
          e.stateT = 0.8;
          if (e.kind === 'btoast') e.sprite.setRotation(0);
        }
      } else {
        m.mvx *= 0.3;
        m.mvy *= 0.3;
        if (e.stateT <= 0) e.state = 0;
      }
      break;
    }
    case 'shoot':
      // Pea Pod: keeps its distance and lobs one big, slow pea.
      if (dist < 170) {
        m.mvx = -m.mvx * 0.6;
        m.mvy = -m.mvy * 0.6;
      } else if (dist < 230) {
        m.mvx *= 0.15;
        m.mvy *= 0.15;
      }
      if (Math.abs(dx) > 1) e.sprite.setFlipX(dx < 0);
      e.sprite.setRotation(Math.sin(t * 6 + e.phase) * 0.1);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        const shot = ENEMIES[e.kind].shot;
        e.attackT = shot?.every ?? 2.5;
        if (dist < 300) {
          const a = Math.atan2(dy, dx);
          if (shot) {
            // Hot Sauce Drop: a 3-shot spread of big red blobs. Pepper Shaker: a short cone of pepper.
            sfx(e.kind === 'pepper' ? 'flakes' : 'sauce');
            hz.fan(shot.tex, e.x, e.y, a, shot.n, shot.spread, shot.speed, shot.dmg, shot.r, shot.life);
          } else {
            sfx('pea');
            hz.fireShot('pea', e.x, e.y, a, 120, 8, 7);
          }
        }
      }
      break;
    case 'croissant':
      e.sprite.setRotation(Math.sin(t * 3) * 0.25);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 1.7;
        sfx('flakes');
        hz.ring('flake', e.x, e.y, 10, 130, 10, 6);
      }
      break;
    case 'toaster':
      e.sprite.setRotation(Math.sin(t * 6) * 0.06);
      // A toaster "ding" just before it fires, so you can react.
      if (e.attackT > 0.45 && e.attackT - dt <= 0.45) sfx('ding');
      e.attackT -= dt;
      e.attack2T -= dt;
      if (e.attackT <= 0) {
        e.attackT = 2.3;
        e.state = (e.state + 1) % 2;
        if (e.state === 0) hz.ring('toast', e.x, e.y, 14, 150, 15, 8);
        else hz.fan('toast', e.x, e.y, Math.atan2(dy, dx), 5, 0.2, 210, 15, 8);
      }
      if (e.attack2T <= 0) {
        e.attack2T = 6.5;
        hz.addRing(p.x, p.y);
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 50 + Math.random() * 100;
          hz.addRing(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        }
      }
      break;
    case 'scoop':
      // Ice Cream Scoop: slow, and leaves melt puddles that slow you down.
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      e.sprite.setRotation(Math.sin(t * 5 + e.phase) * 0.08);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 0.55;
        hz.addMelt(e.x, e.y + e.radius * 0.45, dist < 320);
      }
      break;
    case 'fcroissant':
      e.sprite.setRotation(Math.sin(t * 3) * 0.25);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 2;
        sfx('flakes');
        hz.ring('flake', e.x, e.y, 7, 120, 9, 6);
      }
      break;
    case 'tyrantjr':
      e.sprite.setRotation(Math.sin(t * 6) * 0.06);
      if (e.attackT > 0.45 && e.attackT - dt <= 0.45) sfx('ding');
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 2.6;
        hz.fan('toast', e.x, e.y, Math.atan2(dy, dx), 5, 0.22, 180, 12, 8);
      }
      break;
    case 'waffle':
      waffle(e, m, dt, t);
      break;
    case 'fburn':
      freezerBurn(g, e, m, dt, t);
      break;
    case 'muffin':
      // Molten Muffin: slow, and leaves a short trail of fire behind it.
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      e.sprite.setRotation(Math.sin(t * 5 + e.phase) * 0.08);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 0.42;
        hz.addSpark(e.x - (m.mvx / (e.speed || 1)) * 18, e.y + e.radius * 0.5, 2.2, 4, 1.25, false);
      }
      break;
    case 'fburnt': {
      // The Freezer Burn returns as a smaller, scorched elite. One warned icicle fan at a time.
      e.sprite.setRotation(Math.sin(t * 2.5 + e.phase) * 0.08);
      e.attackT -= dt;
      if (e.attackT <= 0 && dist < 520) {
        e.attackT = 3.2;
        const a = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) hz.addWarn(e.x, e.y, a + i * 0.42, 0.9, 2);
      }
      break;
    }
    case 'flapjack':
      flapjack(g, e, m, dt, t);
      break;
    case 'broiler':
      broiler(g, e, m, dt, t);
      break;
    case 'pmuffin':
      // A Molten Muffin, demoted to a regular: smaller, and its fire trail is short.
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      e.sprite.setRotation(Math.sin(t * 7 + e.phase) * 0.1);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 0.7;
        hz.addSpark(e.x - (m.mvx / (e.speed || 1)) * 12, e.y + e.radius * 0.5, 1.5, 3, 0.9, false);
      }
      break;
    case 'spore':
      // Mold Spores float: they bob as they drift in.
      e.sprite.setRotation(Math.sin(t * 3 + e.phase) * 0.3);
      m.mvx += Math.cos(t * 2.2 + e.phase) * 14;
      m.mvy += Math.sin(t * 2.7 + e.phase) * 14;
      break;
    case 'loaf':
      // Moldy Loaf: slow and tough, and it breathes out puffs of spores.
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      e.sprite.setRotation(Math.sin(t * 4 + e.phase) * 0.06);
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 4.2;
        if (dist < 420) {
          sfx('poof');
          g.effects.burst(e.x, e.y - e.radius * 0.4, 0x9fc85a, 10, 46);
          const hp = g.foes.hpMult(g.stageT);
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + e.phase;
            const sp = g.foes.spawn('spore', e.x + Math.cos(a) * (e.radius + 4), e.y + Math.sin(a) * (e.radius + 4), hp);
            if (sp) {
              sp.kx = Math.cos(a) * 150;
              sp.ky = Math.sin(a) * 150;
            }
          }
        }
      }
      break;
    case 'broilerjr':
      // The Broiler, demoted to a surprise elite: one warned flame line at a time.
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      e.sprite.setRotation(Math.sin(t * 2.5 + e.phase) * 0.06);
      e.attackT -= dt;
      if (e.attackT <= 0 && dist < 520) {
        e.attackT = 3.2;
        hz.addBeam(e.x, e.y, Math.atan2(dy, dx), 1);
        sfx('hiss');
      }
      break;
    case 'tangle':
      tangle(g, e, m, dt, t);
      break;
    case 'mdough':
      motherDough(g, e, m, dt, t);
      break;
    default:
      if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
      // Waddle while walking.
      e.sprite.setRotation(Math.sin(t * 9 + e.phase) * 0.12);
  }
}

/** Frozen Waffle: shake and flash, charge in a straight line, three times, then rest. */
function waffle(e: Enemy, m: Move, dt: number, t: number): void {
  const { dx, dy, dist, slow } = m;
  e.stateT -= dt;
  if (e.state === 0) {
    e.sprite.setRotation(Math.sin(t * 7 + e.phase) * 0.08);
    if (e.stateT <= 0 && dist < 420) {
      e.state = 1;
      e.stateT = 0.8;
    }
  } else if (e.state === 1) {
    m.mvx = m.mvy = 0;
    e.sprite.setRotation(Math.sin(t * 60) * 0.12);
    if (windupFlash(t)) e.sprite.setTintFill(0xffffff);
    else e.sprite.clearTint();
    if (e.stateT <= 0) {
      e.state = 2;
      e.stateT = 0.7;
      e.vx = (dx / dist) * 430;
      e.vy = (dy / dist) * 430;
      e.sprite.clearTint();
      sfx('charge');
    }
  } else if (e.state === 2) {
    m.mvx = e.vx * slow;
    m.mvy = e.vy * slow;
    e.sprite.setRotation(e.sprite.rotation + dt * 10);
    if (e.stateT <= 0) {
      e.sprite.setRotation(0);
      e.attack2T += 1;
      if (e.attack2T >= 3) {
        e.attack2T = 0;
        e.state = 3;
        e.stateT = 2.5;
      } else {
        e.state = 0;
        e.stateT = 0.45;
      }
    }
  } else {
    m.mvx *= 0.25;
    m.mvy *= 0.25;
    e.sprite.setRotation(Math.sin(t * 2) * 0.05);
    if (e.stateT <= 0) {
      e.state = 0;
      e.stateT = 1.2;
    }
  }
}

/**
 * The Freezer Burn. Phase 1: warned icicle volleys and pizza-slice fans.
 * Phase 2 (half health): faster volleys, frost circles that freeze the floor, rings of Frosted Crumbs.
 */
function freezerBurn(g: GameScene, e: Enemy, m: Move, dt: number, t: number): void {
  const p = g.player;
  const hz = g.hz;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.attack2T = 1.5;
    e.stateT = 4;
    g.hud.banner('The Freezer Burn is thawing out... and furious!', '#bfe6fb', 20);
    e.roarT = 0.8;
    sfx('roar');
    shake(g, 400, 0.007);
  }
  e.sprite.setRotation(Math.sin(t * 2) * 0.08 + (e.enraged ? Math.sin(t * 30) * 0.025 : 0));
  e.attackT -= dt;
  if (e.attackT <= 0) {
    e.attackT = e.enraged ? 1.9 : 2.6;
    e.state = (e.state + 1) % 3;
    const a = Math.atan2(m.dy, m.dx);
    if (e.state === 2) {
      sfx('flakes');
      hz.fan('slice', e.x, e.y, a, 7, 0.18, 190, 12, 8);
    } else {
      const lines = e.enraged ? 5 : 3;
      const spread = e.enraged ? 0.3 : 0.4;
      for (let i = 0; i < lines; i++) {
        const la = a + (i - (lines - 1) / 2) * spread;
        hz.addWarn(e.x, e.y, la, 0.8, e.enraged ? 4 : 3);
      }
    }
  }
  if (e.enraged) {
    e.attack2T -= dt;
    if (e.attack2T <= 0) {
      e.attack2T = 6;
      hz.addFreeze(p.x, p.y);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 70 + Math.random() * 90;
        hz.addFreeze(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    }
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.stateT = 9;
      g.foes.ringOf('fcrumb', 16);
    }
  }
}

/**
 * Flapjack Stack: throws spinning pancakes. Every fifth of its health it loses a pancake, flinging it as a ring of
 * discs, and gets shorter and faster.
 */
function flapjack(g: GameScene, e: Enemy, m: Move, dt: number, t: number): void {
  const layers = Math.max(1, Math.ceil((e.hp / e.maxHp) * 5));
  // attack2T holds the pancakes shown (0 on spawn or after a resume: set it without the ring).
  const lost = e.attack2T > 0 && layers < e.attack2T;
  if (layers !== e.attack2T) {
    e.attack2T = layers;
    e.sprite.setTexture(`en_flap${layers}`);
    e.speed = ENEMIES.flapjack.speed * (1 + 0.14 * (5 - layers));
    e.radius = ENEMIES.flapjack.radius - (5 - layers) * 2;
  }
  if (lost) {
    sfx('flakes');
    shake(g, 160, 0.004);
    g.hz.ring('pancake', e.x, e.y, 10, 135, 10, 8);
  }
  e.attackT -= dt;
  // Wobble just before a throw, so you can see it coming.
  const wind = e.attackT < 0.5;
  e.sprite.setRotation(wind ? Math.sin(t * 40) * 0.1 : Math.sin(t * 4 + e.phase) * 0.06);
  if (wind) {
    m.mvx *= 0.3;
    m.mvy *= 0.3;
  }
  if (e.attackT <= 0) {
    e.attackT = 2.3 - 0.22 * (5 - layers);
    sfx('flakes');
    g.hz.fan('pancake', e.x, e.y, Math.atan2(m.dy, m.dx), 3, 0.24, 200, 12, 8);
  }
}

/**
 * The Broiler. Phase 1: sweeping flame lines (each warned with a glow) and fireball fans.
 * Phase 2 (half health): faster, lights the floor coils in patterns, and calls in Toaster Tots.
 */
function broiler(g: GameScene, e: Enemy, m: Move, dt: number, t: number): void {
  const hz = g.hz;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.attack2T = 1.5;
    e.stateT = 5;
    g.hud.banner('The Broiler cranks the heat to max!', '#ffb36b', 20);
    e.roarT = 0.8;
    sfx('roar');
    shake(g, 400, 0.007);
  }
  if (Math.abs(m.mvx) > 1) e.sprite.setFlipX(m.mvx < 0);
  e.sprite.setRotation(Math.sin(t * 2) * 0.05 + (e.enraged ? Math.sin(t * 30) * 0.025 : 0));
  if (e.enraged && Math.floor(t * 4) % 2) e.sprite.setTint(0xffc9a0);
  else if (e.flashUntil <= t) e.sprite.clearTint();
  e.attackT -= dt;
  if (e.attackT <= 0) {
    e.attackT = e.enraged ? 2.2 : 2.8;
    e.state = (e.state + 1) % 3;
    const a = Math.atan2(m.dy, m.dx);
    if (e.state === 2) {
      sfx('flare');
      hz.fan('fireball', e.x, e.y, a, 7, 0.17, 185, 12, 7);
    } else {
      // A sweep: the lines light one after another across where you stand.
      const n = e.enraged ? 4 : 3;
      const dir = e.state === 0 ? 1 : -1;
      const step = 0.34;
      for (let i = 0; i < n; i++) hz.addBeam(e.x, e.y, a + dir * (i - (n - 1) / 2) * step, 0.9 + i * 0.3);
      sfx('hiss');
    }
  }
  if (e.enraged) {
    e.attack2T -= dt;
    if (e.attack2T <= 0) {
      e.attack2T = 7;
      hz.coilPattern();
    }
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.stateT = 10;
      g.foes.ringOf('tot', 12);
      g.hud.banner('Toaster Tots!', '#d8dee4', 16);
    }
  }
}

/** Where a short-lived wall can go: in the open, a fair step from you, never on top of another one. */
function wallSpot(g: GameScene, hw: number, hh: number, ahead: boolean): { x: number; y: number } | null {
  const p = g.player;
  for (let tries = 0; tries < 8; tries++) {
    const moving = Math.hypot(p.moveX, p.moveY) > 0.3;
    const a = ahead && moving ? Math.atan2(p.moveY, p.moveX) + (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
    const d = 95 + Math.random() * 70;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    // Clear of you (with room to step away), of shelves, and of other short-lived walls.
    if (Math.abs(x - p.x) < hw + 46 && Math.abs(y - p.y) < hh + 46) continue;
    if (g.floor.walls.some((w) => Math.abs(x - w.x) < hw + w.hw + 30 && Math.abs(y - w.y) < hh + w.hh + 30)) continue;
    if (g.floor.temps.some((w) => Math.abs(x - w.x) < hw + w.hw + 60 && Math.abs(y - w.y) < hh + w.hh + 60)) continue;
    return { x, y };
  }
  return null;
}

/**
 * Spaghetti Tangle: lashes out noodle lines, each warned first, and every so often knots the way ahead of you shut
 * for a few seconds. One knot at a time, and the corridors between shelf blocks mean there is always another way.
 */
function tangle(g: GameScene, e: Enemy, m: Move, dt: number, t: number): void {
  const hz = g.hz;
  e.sprite.setRotation(Math.sin(t * 3 + e.phase) * 0.1);
  e.attackT -= dt;
  if (e.attackT < 0.5) {
    m.mvx *= 0.3;
    m.mvy *= 0.3;
  }
  if (e.attackT <= 0 && m.dist < 560) {
    e.attackT = 3.3;
    e.state = (e.state + 1) % 2;
    const a = Math.atan2(m.dy, m.dx);
    // Three strands in a fan, then a cross of four.
    if (e.state === 0) for (let i = -1; i <= 1; i++) hz.addBeam(e.x, e.y, a + i * 0.34, 0.9 + Math.abs(i) * 0.15, true);
    else for (let i = 0; i < 4; i++) hz.addBeam(e.x, e.y, a + 0.4 + (i * Math.PI) / 2, 1, true);
    sfx('hiss');
  }
  // The first knot waits a few seconds after it arrives.
  if (e.attack2T === 0) e.attack2T = 5;
  e.attack2T -= dt;
  if (e.attack2T <= 0) {
    e.attack2T = 9;
    if (!g.floor.temps.length) {
      const horiz = Math.abs(g.player.moveX) < Math.abs(g.player.moveY);
      const hw = horiz ? 62 : 18;
      const hh = horiz ? 18 : 62;
      const spot = wallSpot(g, hw, hh, true);
      if (spot) {
        g.floor.addTemp(horiz ? 'knot_h' : 'knot_v', spot.x, spot.y, hw, hh, 1.1, 6);
        g.hud.banner('It ties the way shut!', '#f0d27a', 16);
      }
    }
  }
}

/**
 * Mother Dough. Phase 1: bubbles that land and pop in warned circles, and fans of dough blobs.
 * Phase 2 (half health): she rises (bigger and quicker), pushes dough walls into the aisles around you, and calls
 * rings of Dough Balls.
 */
function motherDough(g: GameScene, e: Enemy, m: Move, dt: number, t: number): void {
  const p = g.player;
  const hz = g.hz;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.attack2T = 2;
    e.stateT = 5;
    e.sprite.setTexture('en_mdough2');
    e.radius = ENEMIES.mdough.radius + 8;
    e.speed = ENEMIES.mdough.speed * 1.25;
    g.hud.banner('Mother Dough rises!', '#f3e3c0', 20);
    e.roarT = 0.8;
    sfx('roar');
    shake(g, 400, 0.007);
  }
  // After a resume she is already risen.
  if (e.enraged && e.sprite.texture.key !== 'en_mdough2') {
    e.sprite.setTexture('en_mdough2');
    e.radius = ENEMIES.mdough.radius + 8;
  }
  e.sprite.setRotation(Math.sin(t * 1.8) * 0.04 + (e.enraged ? Math.sin(t * 26) * 0.02 : 0));
  e.attackT -= dt;
  if (e.attackT <= 0) {
    e.attackT = e.enraged ? 2.1 : 2.7;
    e.state = (e.state + 1) % 3;
    if (e.state === 2) {
      sfx('sauce');
      hz.fan('doughshot', e.x, e.y, Math.atan2(m.dy, m.dx), e.enraged ? 9 : 7, 0.19, 175, 12, 8);
    } else {
      // Bubbles: one where you stand, the rest scattered around you.
      const n = e.enraged ? 6 : 4;
      hz.addRing(p.x, p.y, 34, 14, 1.05, 'bubble');
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 60 + Math.random() * 110;
        hz.addRing(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 34, 14, 1.05 + i * 0.08, 'bubble');
      }
      sfx('bubble');
    }
  }
  if (e.enraged) {
    e.attack2T -= dt;
    if (e.attack2T <= 0) {
      e.attack2T = 7.5;
      // Two dough walls push up near you: warned first, and they melt away after a few seconds.
      let made = false;
      for (let i = 0; i < 2; i++) {
        const horiz = Math.random() < 0.5;
        const hw = horiz ? 70 : 18;
        const hh = horiz ? 18 : 70;
        const spot = wallSpot(g, hw, hh, i === 0);
        if (spot) {
          g.floor.addTemp(horiz ? 'dough_h' : 'dough_v', spot.x, spot.y, hw, hh, 1.2, 5);
          made = true;
        }
      }
      if (made) sfx('bubble');
    }
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.stateT = 10;
      g.foes.ringOf('doughball', 12);
      g.hud.banner('Dough Balls!', '#f3e3c0', 16);
    }
  }
}

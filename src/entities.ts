import Phaser from 'phaser';
import type { EnemyKind } from './data';

export class Enemy {
  sprite!: Phaser.GameObjects.Image;
  kind: EnemyKind = 'crumb';
  /** Random offset so enemies don't waddle in sync. */
  phase = 0;
  x = 0;
  y = 0;
  hp = 1;
  maxHp = 1;
  speed = 50;
  dmg = 5;
  radius = 8;
  xp = 1;
  mass = 1;
  kx = 0;
  ky = 0;
  vx = 0; // fixed velocity (ants, dashing knives)
  vy = 0;
  slowUntil = 0;
  flashUntil = 0;
  alive = false;
  boss = false;
  /** Boss second phase. */
  enraged = false;
  dropsChest = false;
  dropsBun = false;
  state = 0;
  stateT = 0;
  attackT = 0;
  attack2T = 0;
  hitCd = new Map<string, number>();
  gridNext: Enemy | null = null;
}

export class Player {
  sprite!: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  radius = 13;
  hp = 100;
  maxHp = 100;
  faceX = 1;
  faceY = 0;
  moveX = 0;
  moveY = 0;
  invulnUntil = 0;
}

export interface Pickup {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  kind: 'xp' | 'coin' | 'heal' | 'chest' | 'goldchest' | 'bun' | 'mug';
  value: number;
  magnet: boolean;
  alive: boolean;
}

export interface EnemyShot {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  spin: number;
}

export interface Hazard {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  dmg: number;
  t: number; // time until it fires
}

export interface Stats {
  damage: number; // multiplier
  area: number; // multiplier
  cooldown: number; // multiplier (lower = faster)
  speed: number; // px/s
  magnet: number; // px
  maxHp: number;
  /** Extra projectiles from Honey. */
  proj: number;
  /** Duration multiplier from Jam. */
  dur: number;
}

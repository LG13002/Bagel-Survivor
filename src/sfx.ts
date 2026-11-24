// Audio core: tiny synthesized sound effects (no audio files) plus the shared AudioContext and
// the two buses (effects, music) that music.ts plays through. Effects are throttled so swarms
// don't turn into noise or stutter on a phone.
import { load, persist } from './save';

export type Sfx =
  | 'hit' | 'xp' | 'level' | 'hurt' | 'boss' | 'pin' | 'splash' | 'click' | 'buy'
  | 'shoot' | 'lox' | 'storm' | 'crunch' | 'splat' | 'clatter' | 'pop' | 'basket' | 'gold' | 'evolve'
  | 'heart' | 'ding' | 'flakes' | 'swoosh' | 'lock' | 'coin'
  | 'ice' | 'frost' | 'sip' | 'pea' | 'shatter' | 'icicle' | 'roar' | 'melt' | 'charge'
  | 'knife' | 'jar' | 'toastpop' | 'stamp'
  | 'hiss' | 'flare' | 'bubble' | 'grease' | 'sauce' | 'popcorn' | 'ignite' | 'clang'
  | 'thud' | 'flip' | 'tip' | 'tick'
  | 'rattle' | 'roll' | 'poof' | 'whip'
  | 'creep' | 'burnoff' | 'crumbfall' | 'shieldbreak' | 'kingcrack'
  | 'cutter' | 'ting' | 'whisk' | 'mixer' | 'bin';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const readyCbs: (() => void)[] = [];
const last: Partial<Record<Sfx, number>> = {};
const minGap: Record<Sfx, number> = {
  hit: 0.045, xp: 0.035, level: 0.2, hurt: 0.15, boss: 1, pin: 0.1, splash: 0.1, click: 0.03, buy: 0.15,
  shoot: 0.09, lox: 0.25, storm: 2.6, crunch: 0.05, splat: 0.06, clatter: 0.07, pop: 0.12, basket: 0.3, gold: 0.3, evolve: 1,
  heart: 0.85, ding: 0.5, flakes: 0.5, swoosh: 0.12, lock: 0.2, coin: 0.08,
  ice: 0.25, frost: 0.6, sip: 0.3, pea: 0.15, shatter: 0.06, icicle: 0.2, roar: 1.5, melt: 0.5, charge: 0.4,
  knife: 0.12, jar: 0.15, toastpop: 0.2, stamp: 0.25,
  hiss: 0.4, flare: 0.25, bubble: 0.6, grease: 0.2, sauce: 0.2, popcorn: 0.06, ignite: 0.15, clang: 0.12,
  thud: 0.2, flip: 0.05, tip: 0.3, tick: 0.04,
  rattle: 0.4, roll: 0.3, poof: 0.2, whip: 0.2,
  creep: 1.5, burnoff: 0.25, crumbfall: 0.25, shieldbreak: 0.12, kingcrack: 0.8,
  cutter: 0.2, ting: 0.09, whisk: 0.3, mixer: 3.2, bin: 0.15,
};
/** Sounds that may be dropped when too many play at once. */
const LOW: Partial<Record<Sfx, true>> = { hit: true, xp: true, shoot: true, crunch: true, splat: true, clatter: true, coin: true, shatter: true, melt: true, popcorn: true, ignite: true, clang: true, ting: true };
const recent: number[] = [];
/**
 * Sounds heard over and over get a slightly different pitch each time, so a swarm doesn't sound like one sample
 * on repeat. (Seeds have their own rising scale, and menu clicks and jingles stay exactly in tune.)
 */
const VARY: Partial<Record<Sfx, true>> = {
  hit: true, crunch: true, splat: true, clatter: true, shatter: true, pop: true, hurt: true, coin: true, pea: true, melt: true,
  popcorn: true, grease: true, sauce: true, flakes: true, swoosh: true, knife: true, jar: true, toastpop: true, stamp: true,
  ting: true, cutter: true, whisk: true,
  burnoff: true, crumbfall: true, shieldbreak: true, clang: true, pin: true, splash: true, shoot: true, lox: true, thud: true, ignite: true, charge: true, icicle: true, flare: true,
};
/** The pitch multiplier for the sound being built right now. */
let vary = 1;
let xpPitch = 0;
let xpPitchAt = 0;

const SFX_VOL = 0.35;
const MUSIC_VOL = 0.16; // music sits under effects (and under voice chat)

/** Volume sliders run 0 to 100; loudness follows the square, so the middle of the slider sounds like half. */
const gainOf = (v: number) => (Math.max(0, Math.min(100, v)) / 100) ** 2;

export function soundOn(): boolean {
  return load().settings!.sound > 0;
}
export function musicOn(): boolean {
  return load().settings!.music > 0;
}

export function setSoundVolume(v: number): void {
  load().settings!.sound = v;
  persist();
  if (sfxBus) sfxBus.gain.value = SFX_VOL * gainOf(v);
}
export function setMusicVolume(v: number): void {
  load().settings!.music = v;
  persist();
  if (musicBus) musicBus.gain.value = MUSIC_VOL * gainOf(v);
}

export function audioCtx(): AudioContext | null {
  return ctx;
}
/** One second of white noise, shared by every noisy sound and the music's drums. */
export function noiseBuffer(): AudioBuffer | null {
  return noiseBuf;
}
export function musicOut(): AudioNode | null {
  return musicFilter;
}
/** Run once the AudioContext exists (immediately if it already does). */
export function onAudioReady(cb: () => void): void {
  if (ctx) cb();
  else readyCbs.push(cb);
}

/** Muffle the music behind menus that pause the run. */
export function muffleMusic(on: boolean): void {
  if (!ctx || !musicFilter) return;
  const t = ctx.currentTime;
  musicFilter.frequency.cancelScheduledValues(t);
  musicFilter.frequency.setTargetAtTime(on ? 650 : 20000, t, 0.08);
}

/** Call from a user gesture: iOS only allows audio after a tap. Safe to call on every tap. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      sfxBus = ctx.createGain();
      sfxBus.gain.value = SFX_VOL * gainOf(load().settings!.sound);
      sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_VOL * gainOf(load().settings!.music);
      musicBus.connect(ctx.destination);
      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 20000;
      musicFilter.connect(musicBus);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      readyCbs.splice(0).forEach((cb) => cb());
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
  } catch {
    ctx = null;
  }
}

// Every tap resumes audio (iOS suspends it after the app was in the background), and
// switching apps or locking the phone silences everything at once.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

export function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, out: AudioNode | null = sfxBus): void {
  if (!ctx || !out) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0 * vary, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * vary), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Filtered noise burst. `freq1` sweeps the filter (whooshes). */
export function noise(dur: number, vol: number, freq: number, opts: { type?: BiquadFilterType; freq1?: number; delay?: number; out?: AudioNode | null; at?: number } = {}): void {
  const out = opts.out === undefined ? sfxBus : opts.out;
  if (!ctx || !out || !noiseBuf) return;
  const t = opts.at ?? ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'lowpass';
  f.frequency.setValueAtTime(freq * vary, t);
  if (opts.freq1) f.frequency.exponentialRampToValueAtTime(opts.freq1 * vary, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Each weapon's own quiet hit sound ("Crisp" flare). Shares the voice cap with the small sounds. */
const lastHit: Record<string, number> = {};
export function hitSfx(id: string): void {
  if (!ctx || !soundOn() || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - (lastHit[id] ?? -1) < 0.055) return;
  while (recent.length && now - recent[0] > 0.1) recent.shift();
  if (recent.length >= 8) return;
  recent.push(now);
  lastHit[id] = now;
  const j = 1 + (Math.random() - 0.5) * 0.12;
  switch (id) {
    case 'sesame': // tick
      tone('triangle', 1800 * j, 1200, 0.035, 0.07);
      break;
    case 'storm': // glassy ting
      tone('sine', 2600 * j, 2500, 0.07, 0.045);
      break;
    case 'puddle': // soft squelch
      noise(0.06, 0.1, 600 * j);
      break;
    case 'lox': // fishy slap
      noise(0.05, 0.12, 1500 * j, { type: 'bandpass' });
      tone('sine', 520 * j, 300, 0.05, 0.06);
      break;
    case 'coffee': // sizzle
      noise(0.08, 0.08, 4200 * j, { type: 'highpass' });
      break;
    case 'pin': // woody bonk
      tone('triangle', 330 * j, 170, 0.08, 0.18);
      break;
    case 'knife': // clink
      tone('square', 3100 * j, 2700, 0.03, 0.03);
      tone('sine', 4200 * j, 4100, 0.06, 0.035);
      break;
    case 'jar': // blub
      tone('sine', 380 * j, 720, 0.06, 0.1);
      break;
    case 'toastpop': // crunch
      noise(0.05, 0.14, 2100 * j, { type: 'bandpass' });
      break;
    case 'iron': // thud
      tone('sine', 150 * j, 70, 0.09, 0.18);
      break;
    case 'cutter': // a thin slice
      noise(0.04, 0.09, 5200 * j, { type: 'highpass' });
      tone('triangle', 1700 * j, 1300, 0.04, 0.04);
      break;
    case 'whisk': // a soft whoosh
      noise(0.07, 0.07, 1300 * j, { type: 'bandpass', freq1: 2200 });
      break;
    case 'toastjam': // crunch into something sticky
      noise(0.05, 0.12, 1900 * j, { type: 'bandpass' });
      tone('sine', 360 * j, 600, 0.06, 0.07);
      break;
    case 'combo': // squelchy slap
      noise(0.06, 0.12, 900 * j, { type: 'bandpass' });
      tone('sine', 440 * j, 260, 0.06, 0.07);
      break;
    default:
      tone('square', 220, 90, 0.05, 0.12);
  }
}

export function sfx(name: Sfx): void {
  if (!ctx || !soundOn() || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - (last[name] ?? -1) < minGap[name]) return;
  // Voice cap: in a big swarm, drop the small sounds rather than stack hundreds of them.
  while (recent.length && now - recent[0] > 0.1) recent.shift();
  if (LOW[name] && recent.length >= 8) return;
  recent.push(now);
  last[name] = now;
  vary = VARY[name] ? 1 + (Math.random() - 0.5) * 0.14 : 1;
  play(name, now);
  vary = 1;
}

function play(name: Sfx, now: number): void {
  switch (name) {
    case 'hit':
      tone('square', 220 + Math.random() * 60, 90, 0.05, 0.12);
      break;
    case 'crunch': // crumbs and ants
      noise(0.07, 0.28, 2600, { type: 'bandpass' });
      tone('triangle', 420 + Math.random() * 80, 140, 0.06, 0.14);
      break;
    case 'splat': // mold
      tone('sine', 260 + Math.random() * 40, 70, 0.13, 0.28);
      noise(0.1, 0.18, 700);
      break;
    case 'clatter': // knives
      tone('square', 1900 + Math.random() * 300, 1500, 0.05, 0.06);
      tone('square', 2400 + Math.random() * 300, 1800, 0.05, 0.05, 0.04);
      noise(0.06, 0.1, 6000, { type: 'highpass' });
      break;
    case 'pop': // elites and big enemies
      tone('sine', 320, 60, 0.25, 0.4);
      noise(0.18, 0.3, 1400);
      break;
    case 'xp': {
      if (now - xpPitchAt > 0.6) xpPitch = 0;
      xpPitchAt = now;
      xpPitch = Math.min(xpPitch + 1, 14);
      const f = 880 * Math.pow(2, xpPitch / 24);
      tone('sine', f, f * 1.05, 0.06, 0.12);
      break;
    }
    case 'coin':
      tone('square', 988, 988, 0.05, 0.08);
      tone('square', 1319, 1319, 0.12, 0.08, 0.05);
      break;
    case 'level':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, i * 0.07));
      break;
    case 'basket': // bread basket: a soft rustle, then a chime
      noise(0.25, 0.16, 1800, { type: 'bandpass', freq1: 900 });
      [784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.22, 0.16, 0.16 + i * 0.07));
      break;
    case 'gold': // gold toaster: "ding!" then the toast pops
      tone('sine', 1760, 1760, 0.6, 0.25);
      tone('sine', 3520, 3520, 0.3, 0.06);
      tone('square', 220, 520, 0.08, 0.16, 0.32);
      noise(0.06, 0.2, 2000, { delay: 0.32 });
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.14, 0.13, 0.45 + i * 0.06));
      break;
    case 'evolve': // rising sparkly flourish
      for (let i = 0; i < 10; i++) {
        const f = 523 * Math.pow(2, i / 5);
        tone('triangle', f, f, 0.16, 0.13, i * 0.045);
        tone('sine', f * 2, f * 2, 0.1, 0.05, i * 0.045 + 0.02);
      }
      [1047, 1319, 1568].forEach((f) => tone('square', f, f, 0.5, 0.06, 0.5));
      break;
    case 'hurt':
      tone('sawtooth', 180, 60, 0.18, 0.25);
      noise(0.12, 0.25, 900);
      break;
    case 'heart': // lub-dub
      tone('sine', 70, 45, 0.12, 0.45);
      tone('sine', 62, 40, 0.12, 0.32, 0.17);
      break;
    case 'boss':
      tone('sawtooth', 90, 40, 1.0, 0.35);
      tone('square', 60, 30, 1.0, 0.2);
      break;
    case 'ding': // toaster tell
      tone('sine', 1568, 1568, 0.4, 0.2);
      tone('sine', 3136, 3136, 0.2, 0.05);
      break;
    case 'flakes': // croissant's ring of flakes
      for (let i = 0; i < 5; i++) noise(0.04, 0.16, 3500 + Math.random() * 2000, { type: 'bandpass', delay: i * 0.03 });
      break;
    case 'pin':
      noise(0.18, 0.2, 500);
      tone('sine', 140, 70, 0.15, 0.2);
      break;
    case 'splash':
      noise(0.14, 0.18, 3000);
      break;
    case 'shoot': // Sesame Shot: soft pew
      tone('square', 1200 + Math.random() * 100, 500, 0.05, 0.035);
      break;
    case 'lox': // boomerang whoosh
      noise(0.32, 0.12, 400, { type: 'bandpass', freq1: 2400 });
      break;
    case 'storm': // Seed Storm shimmer
      [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f * 1.01, 0.3, 0.035, i * 0.05));
      break;
    case 'click':
      tone('triangle', 900, 600, 0.04, 0.12);
      break;
    case 'buy':
      [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.16, i * 0.05));
      break;
    case 'swoosh':
      noise(0.16, 0.14, 600, { type: 'bandpass', freq1: 3000 });
      break;
    case 'ice': // stepping onto ice: a soft crunch and a glassy tick
      noise(0.09, 0.18, 4200, { type: 'bandpass' });
      tone('sine', 2400, 2900, 0.06, 0.05, 0.02);
      break;
    case 'frost': // frost creeping in: a crackle
      for (let i = 0; i < 6; i++) noise(0.03, 0.12, 5000 + Math.random() * 3000, { type: 'highpass', delay: i * 0.05 });
      tone('sine', 1760, 1320, 0.3, 0.04);
      break;
    case 'sip': // Warm Mug
      tone('sine', 300, 520, 0.16, 0.2);
      tone('triangle', 660, 990, 0.2, 0.1, 0.1);
      break;
    case 'pea': // Pea Pod shot: a little pop
      tone('sine', 700, 260, 0.08, 0.16);
      break;
    case 'shatter': // ice cubes and popsicles breaking
      noise(0.1, 0.22, 5200, { type: 'highpass' });
      tone('triangle', 2200 + Math.random() * 400, 1400, 0.07, 0.07);
      break;
    case 'icicle': // icicle volley whoosh
      noise(0.22, 0.2, 2500, { type: 'bandpass', freq1: 6000 });
      tone('sine', 1900, 2600, 0.12, 0.05);
      break;
    case 'roar': // the Freezer Burn's roar
      tone('sawtooth', 120, 55, 0.9, 0.3);
      tone('square', 80, 40, 0.9, 0.16);
      noise(0.8, 0.22, 400, { type: 'lowpass', freq1: 150 });
      break;
    case 'melt': // ice cream drip
      tone('sine', 520, 260, 0.09, 0.08);
      break;
    case 'charge': // waffle charge
      noise(0.25, 0.22, 900, { type: 'bandpass', freq1: 300 });
      tone('square', 220, 110, 0.2, 0.08);
      break;
    case 'knife': // butter knife: a quick metallic thwip
      noise(0.08, 0.14, 2500, { type: 'bandpass', freq1: 6000 });
      tone('triangle', 2400, 3200, 0.05, 0.04);
      break;
    case 'jar': // jam jar: a glassy clink and a soft splat
      tone('sine', 2300, 2300, 0.12, 0.07);
      tone('sine', 3450, 3450, 0.08, 0.03);
      noise(0.12, 0.16, 700, { delay: 0.04 });
      break;
    case 'toastpop': // toaster pop: a spring boing
      tone('square', 300, 900, 0.07, 0.06);
      tone('sine', 900, 600, 0.12, 0.08, 0.05);
      break;
    case 'cutter': // pizza cutter: a rising metal zing
      tone('sawtooth', 700, 1500, 0.12, 0.04);
      noise(0.14, 0.1, 3500, { type: 'bandpass', freq1: 7000 });
      break;
    case 'ting': // a wheel bouncing off something
      tone('sine', 2600, 2500, 0.1, 0.05);
      tone('triangle', 3900, 3800, 0.05, 0.025);
      break;
    case 'whisk': // whisk whirl: a quick whirr going up and down
      noise(0.5, 0.11, 700, { type: 'bandpass', freq1: 2400 });
      tone('sine', 320, 620, 0.25, 0.04);
      tone('sine', 620, 320, 0.25, 0.04, 0.25);
      break;
    case 'mixer': // stand mixer: a low motor hum
      tone('sawtooth', 92, 98, 0.9, 0.035);
      noise(0.9, 0.05, 420, { type: 'bandpass' });
      break;
    case 'bin': // a card dropped in the bin
      noise(0.1, 0.16, 500, { type: 'lowpass' });
      tone('sine', 300, 150, 0.12, 0.08);
      break;
    case 'stamp': // waffle smash: a heavy thunk
      tone('sine', 110, 45, 0.22, 0.32);
      noise(0.14, 0.24, 350);
      break;
    case 'hiss': // a coil about to flare: a rising hiss over 1.5s
      noise(1.5, 0.12, 1500, { type: 'highpass', freq1: 7000 });
      tone('sine', 220, 660, 1.4, 0.04);
      break;
    case 'flare': // the coil flares: a hot whoomp
      noise(0.45, 0.3, 300, { type: 'lowpass', freq1: 2400 });
      tone('sawtooth', 160, 60, 0.3, 0.1);
      break;
    case 'bubble': // grease bubbling
      for (let i = 0; i < 4; i++) tone('sine', 380 + Math.random() * 220, 700, 0.05, 0.06, i * 0.09);
      break;
    case 'grease': // grease pop
      tone('sine', 900, 200, 0.07, 0.14);
      noise(0.18, 0.14, 3200, { type: 'highpass', delay: 0.02 });
      break;
    case 'sauce': // hot sauce spit
      tone('sine', 520, 180, 0.1, 0.14);
      noise(0.08, 0.1, 1200);
      break;
    case 'popcorn': // a kernel popping
      tone('square', 1300 + Math.random() * 300, 500, 0.04, 0.08);
      noise(0.04, 0.12, 2500, { type: 'bandpass' });
      break;
    case 'ignite': // an enemy catches fire (Spicy)
      noise(0.16, 0.1, 2000, { type: 'bandpass', freq1: 600 });
      break;
    case 'clang': // an enemy shot hits a rack post
      tone('triangle', 1250, 1180, 0.12, 0.06);
      tone('sine', 2500, 2400, 0.08, 0.03);
      break;
    case 'thud': // something heavy lands
      tone('sine', 95, 38, 0.3, 0.4);
      noise(0.2, 0.26, 260);
      break;
    case 'flip': // a card turning over
      noise(0.07, 0.09, 1800, { type: 'bandpass', freq1: 4200 });
      break;
    case 'tip': // a tip sliding in: two soft notes
      tone('sine', 660, 660, 0.12, 0.09);
      tone('sine', 990, 990, 0.16, 0.07, 0.07);
      break;
    case 'tick': // the results screen counting up
      tone('triangle', 1250, 1100, 0.025, 0.07);
      break;
    case 'rattle': // a can about to roll: a tinny rattle over a second
      for (let i = 0; i < 9; i++) tone('triangle', 900 + (i % 3) * 180, 700, 0.05, 0.07, i * 0.12);
      break;
    case 'roll': // the can rolls: a low rumble that fades
      noise(1.6, 0.22, 240, { freq1: 120 });
      tone('triangle', 140, 90, 1.2, 0.08);
      break;
    case 'poof': // a flour sack bursts
      noise(0.5, 0.22, 900, { type: 'lowpass', freq1: 200 });
      break;
    case 'whip': // a noodle lashes out
      noise(0.16, 0.2, 800, { type: 'bandpass', freq1: 5200 });
      tone('sine', 300, 120, 0.12, 0.1, 0.1);
      break;
    case 'creep': // the Stale spreading: a low, dry crackle that swells
      noise(0.9, 0.1, 500, { type: 'bandpass', freq1: 1400 });
      for (let i = 0; i < 5; i++) tone('triangle', 240 - i * 22, 150, 0.05, 0.035, 0.1 + i * 0.14);
      break;
    case 'burnoff': // a patch of creep burned away: a quick sizzle with a bright tick
      noise(0.22, 0.14, 2400, { type: 'highpass', freq1: 6000 });
      tone('sine', 700, 1300, 0.12, 0.06);
      break;
    case 'crumbfall': // a chunk of crust lands: a dry thump and a scatter
      tone('sine', 120, 50, 0.22, 0.32);
      noise(0.25, 0.2, 900, { type: 'bandpass', freq1: 300 });
      break;
    case 'shieldbreak': // a Crouton Knight's shield cracks off
      tone('triangle', 1500, 900, 0.1, 0.09);
      tone('square', 420, 180, 0.08, 0.06, 0.02);
      noise(0.12, 0.16, 2600, { type: 'bandpass', delay: 0.02 });
      break;
    case 'kingcrack': // the Stale King cracks: a deep split with stone falling after it
      tone('sawtooth', 150, 40, 0.5, 0.2);
      noise(0.5, 0.3, 500, { freq1: 150 });
      for (let i = 0; i < 4; i++) noise(0.08, 0.14, 1800, { type: 'bandpass', delay: 0.12 + i * 0.09 });
      break;
    case 'lock':
      tone('square', 160, 110, 0.07, 0.14);
      noise(0.05, 0.2, 1200, { delay: 0.02 });
      break;
  }
}

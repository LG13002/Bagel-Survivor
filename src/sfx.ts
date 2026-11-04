// Audio core: tiny synthesized sound effects (no audio files) plus the shared AudioContext and
// the two buses (effects, music) that music.ts plays through. Effects are throttled so swarms
// don't turn into noise or stutter on a phone.
import { load, persist } from './save';

export type Sfx =
  | 'hit' | 'kill' | 'xp' | 'level' | 'chest' | 'hurt' | 'boss' | 'pin' | 'splash' | 'click' | 'buy'
  | 'shoot' | 'lox' | 'storm' | 'crunch' | 'splat' | 'clatter' | 'pop' | 'basket' | 'gold' | 'evolve'
  | 'heart' | 'ding' | 'flakes' | 'swoosh' | 'lock' | 'coin'
  | 'ice' | 'frost' | 'sip' | 'pea' | 'shatter';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const readyCbs: (() => void)[] = [];
const last: Partial<Record<Sfx, number>> = {};
const minGap: Record<Sfx, number> = {
  hit: 0.045, kill: 0.04, xp: 0.035, level: 0.2, chest: 0.3, hurt: 0.15, boss: 1, pin: 0.1, splash: 0.1, click: 0.03, buy: 0.15,
  shoot: 0.09, lox: 0.25, storm: 2.6, crunch: 0.05, splat: 0.06, clatter: 0.07, pop: 0.12, basket: 0.3, gold: 0.3, evolve: 1,
  heart: 0.85, ding: 0.5, flakes: 0.5, swoosh: 0.12, lock: 0.2, coin: 0.08,
  ice: 0.25, frost: 0.6, sip: 0.3, pea: 0.15, shatter: 0.06,
};
/** Sounds that may be dropped when too many play at once. */
const LOW: Partial<Record<Sfx, true>> = { hit: true, kill: true, xp: true, shoot: true, crunch: true, splat: true, clatter: true, coin: true };
const recent: number[] = [];
let xpPitch = 0;
let xpPitchAt = 0;

const SFX_VOL = 0.35;
const MUSIC_VOL = 0.16; // music sits under effects (and under voice chat)

export function soundOn(): boolean {
  return load().sound !== false;
}
export function musicOn(): boolean {
  return load().music !== false;
}

export function setSound(on: boolean): void {
  load().sound = on;
  persist();
  if (sfxBus) sfxBus.gain.value = on ? SFX_VOL : 0;
}
export function setMusic(on: boolean): void {
  load().music = on;
  persist();
  if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0;
}

export function audioCtx(): AudioContext | null {
  return ctx;
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
      sfxBus.gain.value = soundOn() ? SFX_VOL : 0;
      sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicOn() ? MUSIC_VOL : 0;
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
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
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
  f.frequency.setValueAtTime(freq, t);
  if (opts.freq1) f.frequency.exponentialRampToValueAtTime(opts.freq1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
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
  switch (name) {
    case 'hit':
      tone('square', 220 + Math.random() * 60, 90, 0.05, 0.12);
      break;
    case 'kill':
      tone('triangle', 520 + Math.random() * 120, 160, 0.09, 0.22);
      noise(0.06, 0.15, 2200);
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
    case 'chest':
      [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.12, i * 0.06));
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
    case 'lock':
      tone('square', 160, 110, 0.07, 0.14);
      noise(0.05, 0.2, 1200, { delay: 0.02 });
      break;
  }
}

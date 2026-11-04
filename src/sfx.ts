// Tiny synthesized sound effects (no audio files). Throttled so swarms don't turn into noise.
import { load, persist } from './save';

type Sfx = 'hit' | 'kill' | 'xp' | 'level' | 'chest' | 'hurt' | 'boss' | 'pin' | 'splash';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const last: Partial<Record<Sfx, number>> = {};
const minGap: Record<Sfx, number> = { hit: 0.045, kill: 0.04, xp: 0.035, level: 0.2, chest: 0.3, hurt: 0.15, boss: 1, pin: 0.1, splash: 0.1 };
let xpPitch = 0;
let xpPitchAt = 0;

export function soundOn(): boolean {
  return load().sound !== false;
}

export function setSound(on: boolean): void {
  load().sound = on;
  persist();
  if (master) master.gain.value = on ? 0.35 : 0;
}

/** Call from a user gesture: iOS only allows audio after a tap. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = soundOn() ? 0.35 : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number): void {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export function sfx(name: Sfx): void {
  if (!ctx || !soundOn()) return;
  const now = ctx.currentTime;
  if (now - (last[name] ?? -1) < minGap[name]) return;
  last[name] = now;
  switch (name) {
    case 'hit':
      tone('square', 220 + Math.random() * 60, 90, 0.05, 0.12);
      break;
    case 'kill':
      tone('triangle', 520 + Math.random() * 120, 160, 0.09, 0.22);
      noise(0.06, 0.15, 2200);
      break;
    case 'xp': {
      if (now - xpPitchAt > 0.6) xpPitch = 0;
      xpPitchAt = now;
      xpPitch = Math.min(xpPitch + 1, 14);
      const f = 880 * Math.pow(2, xpPitch / 24);
      tone('sine', f, f * 1.05, 0.06, 0.12);
      break;
    }
    case 'level':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, i * 0.07));
      break;
    case 'chest':
      [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.12, i * 0.06));
      break;
    case 'hurt':
      tone('sawtooth', 180, 60, 0.18, 0.25);
      noise(0.12, 0.25, 900);
      break;
    case 'boss':
      tone('sawtooth', 90, 40, 1.0, 0.35);
      tone('square', 60, 30, 1.0, 0.2);
      break;
    case 'pin':
      noise(0.18, 0.2, 500);
      tone('sine', 140, 70, 0.15, 0.2);
      break;
    case 'splash':
      noise(0.14, 0.18, 3000);
      break;
  }
}

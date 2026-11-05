// Music made in code: a tiny step sequencer with synth voices, playing original loops through
// the music bus in sfx.ts. No audio files. The run theme adds layers as the run goes on.
import { audioCtx, musicOn, musicOut, onAudioReady } from './sfx';

type Inst = 'lead' | 'soft' | 'bass' | 'grit' | 'chord' | 'kick' | 'snare' | 'hat' | 'sizzle' | 'bell' | 'wah' | 'pad';

interface Track {
  inst: Inst;
  /** 0 = always plays; higher layers join as intensity rises. */
  layer?: number;
  vol?: number;
  /** One token per step: note(s) like "C5" or "C4+E4+G4", "-" holds, "." rests, "x" hits a drum. */
  steps: string[];
}

interface Song {
  bpm: number;
  /** Steps per beat (2 = eighth notes). */
  res: number;
  /** Delay on off-beat steps, as a fraction of a step (jazzy swing). */
  swing?: number;
  loop: boolean;
  /** Run themes: layers join as the run's intensity rises, and the tempo can be nudged. */
  layered?: boolean;
  tracks: Track[];
}

export type SongId = 'menu' | 'run' | 'boss' | 'win' | 'stale' | 'frun' | 'fboss' | 'orun' | 'oboss';

/** Bars written as space-separated tokens, joined with "|". */
function seq(s: string): string[] {
  return s.replace(/\|/g, ' ').trim().split(/\s+/);
}
function rep(s: string, n: number): string {
  return Array(n).fill(s).join(' | ');
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(tok: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
  if (!m) return 60;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// ---------------------------------------------------------------- Songs

const SONGS: Record<SongId, Song> = {
  // Relaxed, jazzy bakery tune with a walking bass.
  menu: {
    bpm: 100,
    res: 2,
    swing: 0.28,
    loop: true,
    tracks: [
      {
        inst: 'soft',
        vol: 0.9,
        steps: seq(`E5 - G5 - B5 - A5 G5 | E5 - - - C5 - D5 E5 | F5 - A5 - C6 - B5 A5 | G5 - - - . . . .
                    E5 - G5 - B5 - D6 C6 | A5 - - - G5 - E5 - | F5 - E5 - D5 - B4 D5 | C5 - - - - - . .`),
      },
      {
        inst: 'chord',
        steps: seq(`. C4+E4+G4+B4 - . . C4+E4+G4+B4 - . | . A3+C4+E4+G4 - . . A3+C4+E4+G4 - . | . D4+F4+A4+C5 - . . D4+F4+A4+C5 - . | . G3+B3+D4+F4 - . . G3+B3+D4+F4 - .
                    . C4+E4+G4+B4 - . . C4+E4+G4+B4 - . | . A3+C4+E4+G4 - . . A3+C4+E4+G4 - . | . D4+F4+A4+C5 - . . G3+B3+D4+F4 - . | . C4+E4+G4+A4 - . . C4+E4+G4+A4 - .`),
      },
      {
        inst: 'bass',
        steps: seq(`C3 - E3 - G3 - A3 - | A2 - C3 - E3 - G3 - | D3 - F3 - A3 - C3 - | G2 - B2 - D3 - F3 -
                    C3 - E3 - G3 - E3 - | A2 - C3 - E3 - C3 - | D3 - A2 - G2 - B2 - | C3 - G2 - A2 - B2 -`),
      },
      { inst: 'hat', vol: 0.6, steps: seq(rep('. . x . . . x .', 8)) },
      { inst: 'kick', vol: 0.5, steps: seq(rep('x . . . x . . .', 8)) },
    ],
  },

  // Upbeat run theme: lead and bouncy chords from the start, drums join at 1:00, bass at 2:00.
  run: {
    bpm: 132,
    res: 2,
    loop: true,
    layered: true,
    tracks: [
      {
        inst: 'lead',
        steps: seq(`C5 - A4 C5 F5 - E5 F5 | D5 - A4 D5 F5 - A5 - | G5 - F5 D5 Bb4 - D5 F5 | E5 - - - G5 - E5 C5
                    C5 - A4 C5 F5 - G5 A5 | Bb5 - A5 F5 D5 - F5 A5 | G5 - F5 D5 E5 - G5 - | F5 - - - . . C5 .`),
      },
      {
        inst: 'chord',
        vol: 0.8,
        steps: seq(`. F4+A4+C5 . F4+A4+C5 . F4+A4+C5 . F4+A4+C5 | . D4+F4+A4 . D4+F4+A4 . D4+F4+A4 . D4+F4+A4 | . Bb3+D4+F4 . Bb3+D4+F4 . Bb3+D4+F4 . Bb3+D4+F4 | . C4+E4+G4 . C4+E4+G4 . C4+E4+G4 . C4+E4+G4
                    . F4+A4+C5 . F4+A4+C5 . F4+A4+C5 . F4+A4+C5 | . D4+F4+A4 . D4+F4+A4 . D4+F4+A4 . D4+F4+A4 | . Bb3+D4+F4 . Bb3+D4+F4 . C4+E4+G4 . C4+E4+G4 | . F4+A4+C5 . F4+A4+C5 . F4+A4+C5 . F4+A4+C5`),
      },
      { inst: 'kick', layer: 1, steps: seq(rep('x . . . x . . .', 8)) },
      { inst: 'snare', layer: 1, steps: seq(rep('. . x . . . x .', 8)) },
      { inst: 'hat', layer: 1, vol: 0.7, steps: seq(rep('x x x x x x x x', 8)) },
      {
        inst: 'bass',
        layer: 2,
        steps: seq(`F2 F3 F2 F3 F2 F3 F2 F3 | D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 C2 C3 C2 C3
                    F2 F3 F2 F3 F2 F3 F2 F3 | D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 C2 C3 C2 C3 | F2 F3 F2 F3 F2 F3 F2 F3`),
      },
    ],
  },

  // Heavier boss loop in A minor.
  boss: {
    bpm: 150,
    res: 2,
    loop: true,
    tracks: [
      {
        inst: 'lead',
        vol: 0.9,
        steps: seq(`A4 - C5 - E5 - D5 C5 | A4 - - - F4 - A4 - | B4 - D5 - G5 - F5 D5 | E5 - - - G#4 - B4 -
                    A5 - E5 - C5 - E5 A5 | F5 - C5 - A4 - C5 F5 | G5 - D5 - B4 - D5 G5 | G#5 - - - E5 - - -`),
      },
      {
        inst: 'chord',
        vol: 0.9,
        steps: seq(`A3+C4+E4 - . . A3+C4+E4 - . . | F3+A3+C4 - . . F3+A3+C4 - . . | G3+B3+D4 - . . G3+B3+D4 - . . | E3+G#3+B3 - . . E3+G#3+B3 - . .
                    A3+C4+E4 - . . A3+C4+E4 - . . | F3+A3+C4 - . . F3+A3+C4 - . . | G3+B3+D4 - . . G3+B3+D4 - . . | E3+G#3+B3 - . . E3+G#3+B3 - . .`),
      },
      {
        inst: 'grit',
        steps: seq(`A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E2 E3 E2
                    A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E2 E3 E2`),
      },
      { inst: 'kick', steps: seq(rep('x . x . x . x .', 8)) },
      { inst: 'snare', steps: seq(rep('. . x . . . x .', 7) + ' | . . x . x x x x') },
      { inst: 'hat', vol: 0.7, steps: seq(rep('. x . x . x . x', 8)) },
    ],
  },

  // The Freezer: slower and colder, with bells and a soft pad. Drums and chimes join at 1:00, bass at 2:00.
  frun: {
    bpm: 116,
    res: 2,
    loop: true,
    layered: true,
    tracks: [
      {
        inst: 'bell',
        vol: 0.9,
        steps: seq(`D5 - F5 - A5 - - - | G5 - F5 - D5 - - - | C5 - F5 - A5 - C6 - | G5 - - - E5 - - -
                    D5 - F5 - A5 - D6 - | C6 - Bb5 - F5 - - - | G5 - Bb5 - A5 - G5 - | E5 - C#5 - A4 - - -`),
      },
      {
        inst: 'pad',
        steps: seq(`D4+F4+A4 - - - - - - - | Bb3+D4+F4 - - - - - - - | F3+A3+C4 - - - - - - - | C4+E4+G4 - - - - - - -
                    D4+F4+A4 - - - - - - - | Bb3+D4+F4 - - - - - - - | G3+Bb3+D4 - - - - - - - | A3+C#4+E4 - - - - - - -`),
      },
      { inst: 'bell', layer: 1, vol: 0.35, steps: seq(rep('. . . . . . A6 . | . . . F6 . . . .', 4)) },
      { inst: 'kick', layer: 1, vol: 0.7, steps: seq(rep('x . . . . . x .', 8)) },
      { inst: 'snare', layer: 1, vol: 0.5, steps: seq(rep('. . . . x . . .', 8)) },
      { inst: 'hat', layer: 1, vol: 0.5, steps: seq(rep('. . x . . . x x', 8)) },
      {
        inst: 'bass',
        layer: 2,
        steps: seq(`D2 - - D3 D2 - A2 - | Bb1 - - Bb2 Bb1 - F2 - | F2 - - F3 F2 - C3 - | C2 - - C3 C2 - G2 -
                    D2 - - D3 D2 - A2 - | Bb1 - - Bb2 Bb1 - F2 - | G2 - - G3 G2 - D3 - | A1 - - A2 A1 - E2 -`),
      },
    ],
  },

  // The Freezer Burn: heavy, in D minor, with icy bell stabs.
  fboss: {
    bpm: 150,
    res: 2,
    loop: true,
    tracks: [
      {
        inst: 'lead',
        vol: 0.9,
        steps: seq(`D5 - F5 - A5 - G5 F5 | D5 - - - Bb4 - D5 - | C5 - E5 - G5 - F5 E5 | A4 - - - C#5 - E5 -
                    D6 - A5 - F5 - A5 D6 | Bb5 - F5 - D5 - F5 Bb5 | C6 - G5 - E5 - G5 C6 | C#6 - - - A5 - - -`),
      },
      {
        inst: 'chord',
        vol: 0.9,
        steps: seq(`D4+F4+A4 - . . D4+F4+A4 - . . | Bb3+D4+F4 - . . Bb3+D4+F4 - . . | C4+E4+G4 - . . C4+E4+G4 - . . | A3+C#4+E4 - . . A3+C#4+E4 - . .
                    D4+F4+A4 - . . D4+F4+A4 - . . | Bb3+D4+F4 - . . Bb3+D4+F4 - . . | C4+E4+G4 - . . C4+E4+G4 - . . | A3+C#4+E4 - . . A3+C#4+E4 - . .`),
      },
      { inst: 'bell', vol: 0.45, steps: seq(rep('D6+A6 . . . . . . . | . . . . F6 . . .', 4)) },
      {
        inst: 'grit',
        steps: seq(`D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | C2 C2 C3 C2 C2 C2 C3 C2 | A1 A1 A2 A1 A1 A1 A2 A1
                    D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | C2 C2 C3 C2 C2 C2 C3 C2 | A1 A1 A2 A1 A1 A1 A2 A1`),
      },
      { inst: 'kick', steps: seq(rep('x . x . x . x .', 8)) },
      { inst: 'snare', steps: seq(rep('. . x . . . x .', 7) + ' | . . x . x x x x') },
      { inst: 'hat', vol: 0.7, steps: seq(rep('. x . x . x . x', 8)) },
    ],
  },

  // The Toaster Oven: fast and hot in E minor, with a frying-pan sizzle in the drums. Drums join at 1:00, bass at 2:00.
  orun: {
    bpm: 140,
    res: 2,
    loop: true,
    layered: true,
    tracks: [
      {
        inst: 'lead',
        steps: seq(`E5 - G5 E5 B5 - A5 G5 | F#5 - D5 F#5 A5 - - - | G5 - E5 G5 C6 - B5 A5 | B5 - - - F#5 - D#5 -
                    E5 - G5 B5 E6 - D6 B5 | C6 - B5 A5 G5 - A5 C6 | B5 - A5 G5 F#5 - G5 A5 | E5 - - - . . B4 .`),
      },
      {
        inst: 'chord',
        vol: 0.8,
        steps: seq(`. E4+G4+B4 . E4+G4+B4 . E4+G4+B4 . E4+G4+B4 | . D4+F#4+A4 . D4+F#4+A4 . D4+F#4+A4 . D4+F#4+A4 | . C4+E4+G4 . C4+E4+G4 . C4+E4+G4 . C4+E4+G4 | . B3+D#4+F#4 . B3+D#4+F#4 . B3+D#4+F#4 . B3+D#4+F#4
                    . E4+G4+B4 . E4+G4+B4 . E4+G4+B4 . E4+G4+B4 | . C4+E4+G4 . C4+E4+G4 . C4+E4+G4 . C4+E4+G4 | . A3+C4+E4 . A3+C4+E4 . B3+D#4+F#4 . B3+D#4+F#4 | . E4+G4+B4 . E4+G4+B4 . E4+G4+B4 . E4+G4+B4`),
      },
      { inst: 'sizzle', vol: 0.5, steps: seq(rep('x . . . x . . .', 8)) },
      { inst: 'kick', layer: 1, steps: seq(rep('x . . x x . . .', 8)) },
      { inst: 'snare', layer: 1, steps: seq(rep('. . x . . . x .', 8)) },
      { inst: 'sizzle', layer: 1, vol: 0.8, steps: seq(rep('. x . x . x . x', 8)) },
      {
        inst: 'bass',
        layer: 2,
        steps: seq(`E2 E3 E2 E3 E2 E3 E2 E3 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 B1 B2 B1 B2
                    E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | A1 A2 A1 A2 B1 B2 B1 B2 | E2 E3 E2 E3 E2 E3 E2 E3`),
      },
    ],
  },

  // The Broiler: the heaviest loop in the game. Fast, low and grinding, in E minor with sizzle on every step.
  oboss: {
    bpm: 164,
    res: 2,
    loop: true,
    tracks: [
      {
        inst: 'lead',
        vol: 0.9,
        steps: seq(`E5 - E5 G5 F#5 - E5 - | B4 - - - D5 - E5 - | C5 - C5 E5 D5 - C5 - | B4 - - - D#5 - F#5 -
                    E6 - B5 - G5 - B5 E6 | C6 - G5 - E5 - G5 C6 | D6 - A5 - F#5 - A5 D6 | D#6 - - - B5 - - -`),
      },
      {
        inst: 'chord',
        vol: 0.9,
        steps: seq(`E3+G3+B3 - . E3+G3+B3 - . E3+G3+B3 . | C3+E3+G3 - . C3+E3+G3 - . C3+E3+G3 . | D3+F#3+A3 - . D3+F#3+A3 - . D3+F#3+A3 . | B2+D#3+F#3 - . B2+D#3+F#3 - . B2+D#3+F#3 .
                    E3+G3+B3 - . E3+G3+B3 - . E3+G3+B3 . | C3+E3+G3 - . C3+E3+G3 - . C3+E3+G3 . | D3+F#3+A3 - . D3+F#3+A3 - . D3+F#3+A3 . | B2+D#3+F#3 - . B2+D#3+F#3 - . B2+D#3+F#3 .`),
      },
      {
        inst: 'grit',
        vol: 1.1,
        steps: seq(`E2 E2 E3 E2 E2 E2 F2 E2 | C2 C2 C3 C2 C2 C2 C#2 C2 | D2 D2 D3 D2 D2 D2 D#2 D2 | B1 B1 B2 B1 B1 B1 C2 B1
                    E2 E2 E3 E2 E2 E2 F2 E2 | C2 C2 C3 C2 C2 C2 C#2 C2 | D2 D2 D3 D2 D2 D2 D#2 D2 | B1 B1 B2 B1 B1 B1 C2 B1`),
      },
      { inst: 'kick', steps: seq(rep('x . x x x . x .', 8)) },
      { inst: 'snare', steps: seq(rep('. . x . . . x .', 7) + ' | . . x . x x x x') },
      { inst: 'sizzle', vol: 0.9, steps: seq(rep('x x x x x x x x', 8)) },
    ],
  },

  // Short fanfare for clearing the stage.
  win: {
    bpm: 150,
    res: 2,
    loop: false,
    tracks: [
      { inst: 'lead', steps: seq('C5 E5 G5 C6 - G5 C6 - | E6 - - - - - - - | . .') },
      { inst: 'bell', steps: seq('. . . . . . . . | C6+E6+G6 - - - - - - - | . .') },
      { inst: 'chord', steps: seq('C4+E4+G4 - - - F4+A4+C5 - - - | C4+E4+G4+C5 - - - - - - - | . .') },
      { inst: 'bass', steps: seq('C3 - - - F2 - G2 - | C2 - - - - - - - | . .') },
      { inst: 'kick', steps: seq('x . . . x . x . | x . . . . . . . | . .') },
      { inst: 'snare', steps: seq('. . x . . . x x | x . . . . . . . | . .') },
    ],
  },

  // Slightly sad "wah-wah-wah-waaah" for going stale.
  stale: {
    bpm: 96,
    res: 2,
    loop: false,
    tracks: [{ inst: 'wah', steps: seq('B3 - Bb3 - A3 - Ab3 - - - - - | . .') }],
  },
};

// ---------------------------------------------------------------- Voices

function voice(inst: Inst, notes: number[], t: number, dur: number, vol: number, out: AudioNode, last: boolean): void {
  const ctx = audioCtx()!;
  if (inst === 'kick') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.18);
    return;
  }
  if (inst === 'sizzle') {
    // A frying-pan sizzle: crackly high noise that swells and fades.
    const len = 0.2;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * (len + 0.02)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 1 : 0.35);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + len + 0.02);
    return;
  }
  if (inst === 'snare' || inst === 'hat') {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = inst === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = inst === 'hat' ? 7000 : 1800;
    const g = ctx.createGain();
    const len = inst === 'hat' ? 0.035 : 0.11;
    g.gain.setValueAtTime((inst === 'hat' ? 0.22 : 0.5) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + len + 0.01);
    return;
  }
  for (const n of notes) {
    const f = hz(n);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    let peak = 0.2;
    let tail = dur;
    let node: AudioNode = g;
    switch (inst) {
      case 'lead':
        o.type = 'square';
        peak = 0.11;
        tail = Math.max(0.08, dur * 0.9);
        break;
      case 'soft':
        o.type = 'triangle';
        peak = 0.26;
        tail = Math.max(0.1, dur * 0.95);
        break;
      case 'bass':
        o.type = 'triangle';
        peak = 0.42;
        tail = Math.max(0.08, dur * 0.85);
        break;
      case 'grit': {
        o.type = 'sawtooth';
        peak = 0.2;
        tail = Math.max(0.06, dur * 0.7);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        g.connect(lp);
        node = lp;
        break;
      }
      case 'chord':
        o.type = 'triangle';
        peak = 0.07;
        tail = Math.max(0.07, dur * 0.6);
        break;
      case 'bell':
        o.type = 'sine';
        peak = 0.12;
        tail = 1.2;
        break;
      case 'pad':
        o.type = 'sine';
        peak = 0.1;
        tail = Math.max(0.2, dur * 0.98);
        break;
      case 'wah': {
        o.type = 'sawtooth';
        peak = 0.2;
        tail = dur * 0.95;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 6;
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.linearRampToValueAtTime(1500, t + tail * 0.35);
        lp.frequency.linearRampToValueAtTime(300, t + tail);
        g.connect(lp);
        node = lp;
        if (last) {
          // The final "waaah" droops and wobbles.
          o.frequency.setValueAtTime(f, t);
          o.frequency.linearRampToValueAtTime(f * 0.94, t + tail);
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 6;
          lg.gain.value = f * 0.02;
          lfo.connect(lg).connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + tail + 0.05);
        }
        break;
      }
      default:
        break;
    }
    if (!(inst === 'wah' && last)) o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    const atk = inst === 'pad' ? 0.35 : 0.008;
    g.gain.exponentialRampToValueAtTime(peak * vol, t + atk);
    if (inst !== 'pad') g.gain.setTargetAtTime(peak * vol * 0.6, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0.0001, t + tail, 0.03);
    o.connect(g);
    node.connect(out);
    o.start(t);
    o.stop(t + tail + 0.2);
  }
}

// ---------------------------------------------------------------- Player

interface Playing {
  id: SongId;
  song: Song;
  gain: GainNode;
  step: number;
  next: number;
  done: boolean;
}

let current: Playing | null = null;
let wanted: SongId | null = null;
let intensity = 0;
let tempo = 1;
let timer: number | null = null;

function stepLen(p: Playing): number {
  return 60 / (p.song.bpm * (p.song.layered ? tempo : 1)) / p.song.res;
}

function schedule(): void {
  const ctx = audioCtx();
  const out = musicOut();
  const p = current;
  if (!ctx || !out || !p || p.done || ctx.state !== 'running') return;
  const total = Math.max(...p.song.tracks.map((tr) => tr.steps.length));
  while (p.next < ctx.currentTime + 0.15) {
    if (p.step >= total) {
      if (!p.song.loop) {
        p.done = true;
        return;
      }
      p.step = 0;
    }
    const len = stepLen(p);
    const swing = p.song.swing && p.step % 2 === 1 ? p.song.swing * len : 0;
    const t = Math.max(p.next + swing, ctx.currentTime);
    // Skip the work entirely while music is switched off.
    if (musicOn()) {
      for (const tr of p.song.tracks) {
        if ((tr.layer ?? 0) > (p.song.layered ? intensity : 9)) continue;
        const tok = tr.steps[p.step];
        if (!tok || tok === '.' || tok === '-') continue;
        let hold = 1;
        while (tr.steps[p.step + hold] === '-') hold++;
        const last = !tr.steps.slice(p.step + hold).some((s) => s !== '.' && s !== '-');
        const notes = tok === 'x' ? [] : tok.split('+').map(midi);
        voice(tr.inst, notes, t, hold * len, tr.vol ?? 1, p.gain, last);
      }
    }
    p.step++;
    p.next += len;
  }
}

function start(id: SongId): void {
  const ctx = audioCtx();
  const out = musicOut();
  if (!ctx || !out) return;
  if (current) {
    // Quick fade on the old song, then let it go.
    const old = current;
    old.done = true;
    old.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    window.setTimeout(() => old.gain.disconnect(), 800);
  }
  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(out);
  current = { id, song: SONGS[id], gain, step: 0, next: ctx.currentTime + 0.06, done: false };
  if (timer === null) timer = window.setInterval(schedule, 25);
  schedule();
}

/** Play a looping song (or null for silence). Calling with the song already playing does nothing. */
export function playMusic(id: SongId | null): void {
  if (id === wanted) return;
  wanted = id;
  if (id && SONGS[id].layered) {
    intensity = 0;
    tempo = 1;
  }
  onAudioReady(() => {
    if (wanted !== id) return;
    if (id) start(id);
    else stopMusic();
  });
}

/** Run theme layers: 0 = lead and chords, 1 = + drums, 2 = + bass. `speed` nudges the tempo. */
export function setRunIntensity(level: number, speed = 1): void {
  intensity = level;
  tempo = speed;
}

/** One-shot jingle for the end of a run. */
export function playJingle(id: 'win' | 'stale'): void {
  wanted = id;
  onAudioReady(() => start(id));
}

export function stopMusic(): void {
  wanted = null;
  const ctx = audioCtx();
  if (current && ctx) {
    const old = current;
    old.done = true;
    old.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    window.setTimeout(() => old.gain.disconnect(), 800);
  }
  current = null;
}

// Read-only peek for automated tests.
(window as unknown as { __music: () => object }).__music = () => ({ id: current?.done ? null : (current?.id ?? null), wanted, intensity, tempo, step: current?.step ?? -1 });

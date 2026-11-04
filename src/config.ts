// Render scale: the canvas is drawn at device pixels so text and shapes stay sharp on retina phones.
// World and UI code work in CSS pixels; the world camera zooms by S and UI sizes are multiplied by S.
export const S = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", system-ui, sans-serif';

export const COLORS = {
  bg: 0x2b2118,
  panel: 0x3d2e22,
  panelLight: 0x56412f,
  cream: 0xfff3dc,
  gold: 0xf2b84b,
  red: 0xe0533d,
  green: 0x7fbf4d,
  xp: 0x6cc7f0,
  dim: 0x000000,
};

export const CSS = {
  cream: '#fff3dc',
  gold: '#f2b84b',
  red: '#e0533d',
  muted: '#c9b49a',
  dark: '#2b2118',
};

/** Safe-area insets in CSS px (notch / home indicator). */
export function safeInsets(): { top: number; bottom: number } {
  const el = document.getElementById('safe');
  if (!el) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(el);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}

/** Debug flags from the URL, e.g. ?speed=4&god for testing. */
const params = new URLSearchParams(window.location.search);
export const DEBUG = {
  speed: Math.max(1, Math.min(20, Number(params.get('speed')) || 1)),
  god: params.has('god'),
  start: Number(params.get('t')) || 0,
  /** Preview a candidate stage background, e.g. ?floor=counter */
  floor: params.get('floor'),
};

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// "Copy game info" (Settings, About) and the home-screen check. The info is a few plain lines a tester can paste
// into a message when something goes wrong: the version, the screen, how the game was opened, a few counts and the
// last errors the page saw. Nothing personal is in it: no name, no place, no save code.
import { VERSION } from './config';
import { STAGES } from './data';
import { load } from './save';

const ERR_KEY = 'everything-bagel-errors';

/** Keeps the last few page errors (this phone only), so "Copy game info" can show them. */
export function watchErrors(): void {
  const note = (msg: string) => {
    try {
      const list = JSON.parse(localStorage.getItem(ERR_KEY) || '[]') as string[];
      list.push(`${VERSION} ${msg}`.slice(0, 200));
      localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-5)));
    } catch {
      // Storage full or blocked: nothing to do.
    }
  };
  window.addEventListener('error', (e) => note(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => note(`promise: ${String((e.reason as Error)?.message ?? e.reason)}`));
}

/** Opened from the home screen (or installed), not in a browser tab. */
export function standalone(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
}

/** Which phone family this is, from the browser's own description: 'ios', 'android' or '' (a computer). */
export function phoneKind(): 'ios' | 'android' | '' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : '';
}

function system(): string {
  const ua = navigator.userAgent;
  const ios = ua.match(/OS (\d+)[_.](\d+)/);
  const and = ua.match(/Android (\d+(?:\.\d+)?)/);
  const kind = phoneKind();
  const os = kind === 'ios' ? `iOS ${ios ? `${ios[1]}.${ios[2]}` : ''}` : kind === 'android' ? `Android ${and ? and[1] : ''}` : 'Computer';
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Other';
  return `${os.trim()}, ${browser}`;
}

export function gameInfo(): string {
  const s = load();
  const st = s.settings;
  const clears = STAGES.map((d) => s.stageClears?.[d.id] ?? 0).join(' ');
  const ranks = Object.values(s.upgrades ?? {}).reduce((a, b) => a + (b || 0), 0);
  let errors: string[] = [];
  try {
    errors = JSON.parse(localStorage.getItem(ERR_KEY) || '[]') as string[];
  } catch {
    errors = [];
  }
  return [
    `Everything Bagel ${VERSION} (save ${s.v ?? '?'})`,
    `${system()}, ${standalone() ? 'home screen' : 'browser tab'}`,
    `Screen ${window.innerWidth}x${window.innerHeight} at ${window.devicePixelRatio}x`,
    `Runs ${s.stats?.runs ?? 0}, clears per stage ${clears}, bagels ${s.unlocked.length}, Bakery ranks ${ranks}`,
    `Settings: shake ${st?.shake ?? 'on'}, flashing ${st?.flash ?? 'normal'}, saver ${st?.saver ? 'on' : 'off'}, lefty ${st?.lefty ? 'on' : 'off'}, tips ${st?.tips === false ? 'off' : 'on'}`,
    errors.length ? `Last errors:\n${errors.join('\n')}` : 'No errors recorded',
  ].join('\n');
}

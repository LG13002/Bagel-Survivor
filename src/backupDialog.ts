// The backup code boxes. These are real page elements, not canvas drawings, because copying and pasting
// only work reliably on phones from a real text box and a real button tap.
import { FONT } from './config';
import { gameInfo } from './gameInfo';
import { backupCode, load, persist, restoreCode } from './save';

function shell(title: string, note: string): { root: HTMLDivElement; box: HTMLDivElement; area: HTMLTextAreaElement; row: HTMLDivElement; status: HTMLDivElement } {
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:20;background:rgba(18,12,8,.82);display:flex;align-items:center;justify-content:center;padding:16px;font-family:${FONT};color:#fff3dc;touch-action:auto`;
  const box = document.createElement('div');
  box.style.cssText = 'width:min(360px,100%);background:#3d2e22;border:3px solid #24160d;border-radius:16px;box-shadow:0 6px 0 #1d140d;padding:18px 16px 16px;display:flex;flex-direction:column;gap:10px';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-size:24px;color:#f2b84b;text-align:center';
  const p = document.createElement('div');
  p.textContent = note;
  p.style.cssText = 'font-size:14px;line-height:1.35;color:#e8d8c0;text-align:center';
  const area = document.createElement('textarea');
  area.rows = 5;
  area.autocapitalize = 'off';
  area.spellcheck = false;
  area.style.cssText = 'width:100%;box-sizing:border-box;resize:none;border:3px solid #24160d;border-radius:10px;background:#1d140d;color:#fff3dc;font:13px/1.3 ui-monospace,Menlo,monospace;padding:8px;user-select:text;-webkit-user-select:text;word-break:break-all';
  const status = document.createElement('div');
  status.style.cssText = 'min-height:18px;font-size:14px;text-align:center;color:#f2b84b';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px';
  box.append(h, p, area, status, row);
  root.append(box);
  document.body.append(root);
  return { root, box, area, row, status };
}

function btn(label: string, gold: boolean, onTap: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `flex:1;font-family:${FONT};font-size:18px;padding:11px 8px;border:3px solid #24160d;border-radius:12px;box-shadow:0 4px 0 #24160d;background:${gold ? '#f2b84b' : '#56412f'};color:${gold ? '#2b2118' : '#fff3dc'}`;
  b.addEventListener('click', onTap);
  return b;
}

/** Shows the save as a code, with a Copy button. */
export function showBackupCode(onClose: () => void): void {
  const { root, area, row, status } = shell('BACKUP CODE', 'Copy this code and keep it somewhere safe, like your Notes app. Paste it back in Settings to restore your progress.');
  area.readOnly = true;
  area.value = backupCode();
  const done = () => {
    root.remove();
    onClose();
  };
  const copied = () => {
    status.textContent = 'Copied!';
    load().backupAt = Date.now();
    persist();
  };
  row.append(
    btn('Close', false, done),
    btn('Copy', true, () => copyBox(area, status, copied, 'Press and hold the code to copy it.')),
  );
}

/** Copies a text box's contents, by the modern way or the old one; says what to do by hand when neither works. */
function copyBox(area: HTMLTextAreaElement, status: HTMLDivElement, copied: () => void, byHand: string): void {
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  const fallback = () => {
    try {
      if (document.execCommand('copy')) copied();
      else status.textContent = byHand;
    } catch {
      status.textContent = byHand;
    }
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(area.value).then(copied, fallback);
  else fallback();
}

/** Shows a few lines about the game and the phone for a tester to paste into a message. */
export function showGameInfo(onClose: () => void): void {
  const { root, area, row, status } = shell('GAME INFO', 'If something goes wrong, copy this and paste it into your message. There is nothing personal in it.');
  area.readOnly = true;
  area.rows = 8;
  area.style.wordBreak = 'normal';
  area.value = gameInfo();
  row.append(
    btn('Close', false, () => {
      root.remove();
      onClose();
    }),
    btn('Copy', true, () => copyBox(area, status, () => (status.textContent = 'Copied!'), 'Press and hold the text to copy it.')),
  );
}

/** Asks for a backup code and loads it. onLoaded runs after a save was restored. */
export function askBackupCode(onClose: () => void, onLoaded: () => void): void {
  const { root, area, row, status } = shell('PASTE BACKUP CODE', 'Paste a backup code here. It replaces the progress on this phone, and the old progress is kept as a spare.');
  area.placeholder = 'EB1:…';
  row.append(
    btn('Cancel', false, () => {
      root.remove();
      onClose();
    }),
    btn('Load', true, () => {
      if (!area.value.trim()) {
        status.textContent = 'Paste your code in the box first.';
        return;
      }
      if (!restoreCode(area.value)) {
        status.textContent = "That isn't a backup code. Nothing was changed.";
        return;
      }
      root.remove();
      onLoaded();
    }),
  );
}

// SETT: the launcher's host - a thin 2D scene, the same shape
// scenes/menu.js takes for the start window. It owns a canvas, one
// window and the keyboard, and resolves when the player launches.
//
// Deliberately thin: no motor, no world, no audio boot. The launcher
// runs before any game data is touched beyond the ARENA2 pick, so it
// must cost nothing to show.
import { LauncherWindow } from '../ui/launcher.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { getBytes } from './dataSource.js';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const LIGHT = new Float32Array([0, 1, 0]);

/** Show the launcher; resolve when the player presses Enter/Escape.
 *  NEVER TRAPS, the law every native window here follows: if the font
 *  will not load the launcher does not draw AT ALL and the boot
 *  continues, because a missing glyph must cost you a settings screen
 *  and never the game. */
export async function runLauncher(canvas, renderer, status) {
  let font = null;
  try {
    font = makeFont(renderer, new FntFile().load(await getBytes('FONT0003.FNT')), 'FONT0003');
  } catch (e) {
    console.warn('[launcher] FONT0003.FNT unavailable; skipping the settings screen', e);
    return;
  }
  status('settings');
  return new Promise((resolve) => {
    let done = false;
    const win = new LauncherWindow({ onLaunch: () => {} });
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      window.__launcher = () => JSON.stringify({ up: false });
      resolve();
    };
    const onKey = (e) => {
      if (done) return;
      // the launcher owns every key while it is up - a stray Space
      // must not scroll the page behind it
      e.preventDefault();
      win.input(e.code === 'Space' ? 'char: ' : e.code, e);
      if (win.done) finish();
    };
    window.addEventListener('keydown', onKey);
    // the house probe surface (__talk / __climb / __x23's shape): the
    // screen's live state, so tools/launcherProbe.mjs can assert what
    // is ON SCREEN rather than guessing from a canvas
    window.__launcher = () => JSON.stringify({
      up: !done, section: win.section, cursor: win.cursor,
      rows: win.rows().map((r) => ({ key: r.key, value: r.value, tier: r.tier, selected: r.selected, changed: r.changed })),
      notice: win.notice,
    });
    const frame = () => {
      renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
      win.draw(renderer, canvas, font, 2);
      if (!done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

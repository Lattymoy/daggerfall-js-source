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
      canvas.removeEventListener('pointerdown', onPointer);
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
    // AUDIT: the launcher shipped KEYBOARD-ONLY and ShowOptionsAtStart
    // ships True, so a touch device booted straight into a screen it
    // could never dismiss - the game was unreachable on a phone
    // (proven on a Pixel 5: taps and clicks did nothing). Every other
    // pre-game screen here takes pointerdown (menu.js:95, :143) and
    // every playable scene calls attachTouch; this one took neither.
    // NEVER TRAPS is this file's own header law.
    const onPointer = (ev) => {
      if (done) return;
      const r = canvas.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (canvas.width / r.width);
      const py = (ev.clientY - r.top) * (canvas.height / r.height);
      win.clickAt(canvas, px, py, 2);
      if (win.done) finish();
    };
    canvas.addEventListener('pointerdown', onPointer);
    // the house probe surface (__talk / __climb / __x23's shape): the
    // screen's live state, so tools/launcherProbe.mjs can assert what
    // is ON SCREEN rather than guessing from a canvas
    window.__launcher = () => JSON.stringify({
      up: !done, section: win.section, cursor: win.cursor,
      // the real hit rects, so a probe taps what a finger would tap
      // rather than guessing coordinates (the audit's touch check
      // missed every control on its first run and read as "trapped"
      // when the fix was already in)
      layout: (() => { const L = win.layout(canvas, 2); return { play: L.play, prevSection: L.prevSection, nextSection: L.nextSection, rows: L.rows.map((r) => ({ key: r.key, rect: r.rect })) }; })(),
      canvas: { w: canvas.width, h: canvas.height },
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

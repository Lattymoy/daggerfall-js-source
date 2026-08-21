// MENU: the settings screen's host.
//
// Thin by design - one canvas, one window, the keyboard and the
// pointer. It runs before any game data beyond the ARENA2 pick, so it
// must cost nothing to show.
//
// Three scars from the audits are wired in here, not in the window:
//   - POINTER INPUT IS NOT OPTIONAL. The first launcher registered
//     only keydown while ShowOptionsAtStart ships True, so a phone
//     booted into a screen it could never dismiss. Proven trapped on
//     a Pixel 5, then proven dismissable. pointerdown/move/up/cancel
//     and wheel are all routed, and all removed on exit.
//   - AUDIO IS BOOTED HERE. main.js runs this screen BEFORE
//     ensureAudio, so the old screen's click feedback was silent and
//     a volume slider could not be heard. ensureAudio is fire-and-
//     forget (it resolves its own context on the first gesture), so
//     the sound the player is setting can actually be played back.
//   - NEVER TRAPS. A missing font costs the settings screen, never
//     the game.
import { SettingsWindow } from '../ui/settingsWindow.js';
import { pointToPage, settingsMetrics } from '../ui/settingsMetrics.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { getBytes } from './dataSource.js';
import { ensureAudio } from './shared.js';
import { getPref } from '../systems/uiPrefs.js';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const LIGHT = new Float32Array([0, 1, 0]);

export async function runLauncher(canvas, renderer, status) {
  let font = null;
  try {
    font = makeFont(renderer, new FntFile().load(await getBytes('FONT0003.FNT')), 'FONT0003');
  } catch (e) {
    console.warn('[settings] FONT0003.FNT unavailable; skipping the settings screen', e);
    return;
  }
  // so a volume change can be HEARD; safe un-awaited (audio.ensure
  // attaches its own gesture-resume)
  ensureAudio(getBytes);
  status('settings');

  return new Promise((resolve) => {
    let done = false;
    const win = new SettingsWindow({ onLaunch: () => {} });
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.__settings = () => JSON.stringify({ up: false });
      resolve();
    };
    const page = (ev) => {
      const r = canvas.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (canvas.width / r.width);
      const py = (ev.clientY - r.top) * (canvas.height / r.height);
      return pointToPage(settingsMetrics(canvas, { textScale: getPref('textScale') }), px, py);
    };
    const onKey = (e) => {
      if (done) return;
      e.preventDefault();
      win.input(e.code, e, canvas);
      if (win.done) finish();
    };
    let downAt = null;
    const onDown = (e) => { if (!done) downAt = page(e); };
    const onMove = () => {};
    const onUp = (e) => {
      if (done || !downAt) return;
      const p = page(e);
      // a drag must not read as a tap (scrolling a list with a finger)
      if (p && Math.abs(p[0] - downAt[0]) < 4 && Math.abs(p[1] - downAt[1]) < 4) {
        win.click(p[0], p[1], canvas);
        if (win.done) finish();
      }
      downAt = null;
    };
    const onWheel = (e) => { if (!done) { e.preventDefault(); win.wheel(e.deltaY); } };
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // the probe surface reports the SAME layout the draw and the
    // clicks read, so a probe taps what a finger taps
    window.__settings = () => JSON.stringify(win.probe(canvas));
    window.__launcher = window.__settings;   // the audit-era name keeps working

    const frame = () => {
      renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
      win.draw(renderer, canvas, font);
      if (!done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

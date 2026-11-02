// RPT1026-CLIENT (a private report, 2026-10-22: the desktop app with VSync off runs Chromium unthrottled, and with the
// game's own Frame Rate Cap at its default, Off, nothing held the frames back - some 3,760 garbage collections in the
// report's sample against 28 with the cap on). FPS-VSYNC followed DFU:
// VSync off with no target frame rate runs free (StartGameBehaviour.cs:244-250). Where the shell lifted the wait, Off now
// holds at the row's own top (systems/frameCap.js LIFTED_OFF_FPS); a browser, which the screen paces, is unchanged.
// Driven through the real install on a page whose compositor answers every ask half a millisecond later - Chromium with
// its frame-rate limit lifted, as test/ui/settings/disc28e_vsync.test.js measures it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setValue, _resetForTests } from '../../src/systems/settings/settings.js';
import { installFramePacer, frameCapFps, frameCapSkip, _resetFrameCap, LIFTED_OFF_FPS, FRAME_CAP_MAX } from '../../src/systems/frameCap.js';
import { helpOf } from '../../src/ui/settings/settingsCopy.js';

afterEach(() => { _resetForTests(); _resetFrameCap(); });

/** A page in the app: `lifted` the shell's word at launch, rAF answered 0.5 ms after each ask (no screen to wait for). */
function page(lifted) {
  let t = 0, asked = null, nextId = 1;
  const timers = [];
  const win = {
    daggerShell: { framesLifted: lifted },
    requestAnimationFrame(cb) { asked = { cb, at: t, id: nextId++ }; return asked.id; },
    cancelAnimationFrame(id) { if (asked?.id === id) asked = null; },
    setTimeout(fn, ms) { timers.push({ fn, at: t + ms }); timers.sort((x, y) => x.at - y.at); return 0; },
    performance: { now: () => t },
  };
  /** The world host's loop (scenes/world.js): ask for the next frame first, then ask the gate, then draw. */
  function runHost(until) {
    let drawn = 0;
    const frame = (now) => {
      win.requestAnimationFrame(frame);
      if (frameCapSkip(now)) return;
      drawn++;
    };
    win.requestAnimationFrame(frame);
    for (;;) {
      const frameAt = asked ? asked.at + 0.5 : Infinity, timerAt = timers.length ? timers[0].at : Infinity;
      const at = Math.min(frameAt, timerAt);
      if (at > until) return drawn;
      t = at;
      if (timerAt <= frameAt) { timers.shift().fn(); continue; }
      const { cb } = asked; asked = null;
      cb(t);
    }
  }
  return { win, runHost };
}

test('RPT1026-CLIENT: VSync off in the app and the cap Off - the game draws at most the row\'s top, never as fast as it goes', () => {
  assert.equal(LIFTED_OFF_FPS, FRAME_CAP_MAX, 'the ceiling is the highest rate the row itself offers');
  assert.equal(frameCapFps(), 0, 'the setting\'s default: Off');
  const app = page(true);
  assert.equal(installFramePacer(app.win), true);
  assert.equal(frameCapFps(), LIFTED_OFF_FPS, 'Off, where the wait is lifted, is the ceiling');
  const drawn = app.runHost(1000);
  assert.ok(Math.abs(drawn - LIFTED_OFF_FPS) <= 2, `a second drew ${drawn} frames`);
});

test('RPT1026-CLIENT: a cap the player chose stands as it was, and a browser\'s Off is still no cap', () => {
  setValue('Video', 'TargetFrameRate', '60');
  const app = page(true);
  installFramePacer(app.win);
  assert.equal(frameCapFps(), 60);
  const drawn = app.runHost(1000);
  assert.ok(Math.abs(drawn - 60) <= 2, `a 60 cap drew ${drawn}`);
  _resetForTests(); _resetFrameCap();
  assert.equal(installFramePacer({ requestAnimationFrame() { return 1; }, cancelAnimationFrame() {} }), false, 'a browser: the screen paces it');
  assert.equal(frameCapFps(), 0, 'and Off there is no cap, as DFU\'s');
});

test('RPT1026-CLIENT: the Frame Rate Cap\'s row says what Off does in the app', () => {
  const tip = helpOf('Video/TargetFrameRate');
  assert.match(tip, /Off lets your screen set the pace/);
  assert.ok(tip.includes(`${LIFTED_OFF_FPS} frames a second`), tip);
});

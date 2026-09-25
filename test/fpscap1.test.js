// FPS-CAP1 (2026-09-25, Mac: "Add FPS limiter to settings"). DFU's Video/TargetFrameRate had been in the store since
// the settings screen shipped - labelled "Frame Rate Cap" on the Video page and read by nothing. It is live now:
// systems/frameCap.js is StartGameBehaviour's two lines (:244-250) over SettingsManager's GetInt(0, 300) (:414), the
// four hosts hold a frame back at the top of their rAF callback, and the FPS counter counts the frames the game drew.
// One recorded departure: the cap holds under VSync, which a page can never turn off (Video/VSync is unavailable now).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capStep, frameCapRate, frameCapFps, frameCapSkip, _resetFrameCap, FRAME_CAP_FLOOR, FRAME_CAP_MAX, FRAME_CAP_STOPS } from '../src/systems/frameCap.js';
import { setValue, tierOf, LIVE, _resetForTests } from '../src/systems/settings.js';
import { widgetFor, formatValue, stepValue, NUMBER_LAW, blockedReason } from '../src/ui/settingsLaw.js';
import { READOUT, INSTEAD } from '../src/ui/settingsCopy.js';
import { mountFpsCounter } from '../src/ui/fpsCounter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Drive the gate over a second of a screen's stamps; the drawn stamps come back. `wobble` jitters each stamp. */
function drawn(hz, fps, { ms = 1000, wobble = 0 } = {}) {
  const st = { due: 0, at: -1, held: false };
  const out = [];
  for (let i = 0; i <= Math.round((ms * hz) / 1000); i++) {   // counted, not summed: 60 x (1000 / 60) is not 1000
    const t = 1000 + i * (1000 / hz) + (wobble ? ((i * 7919) % 11 - 5) / 5 * wobble : 0);
    if (!capStep(st, t, fps)) out.push(t);
  }
  return out;
}

test('FPS-CAP1: the gate holds a screen\'s frames back to the cap - half of a 60 Hz screen at 30, all of it at 60 despite a wobbling stamp, 60 of a 144 Hz screen (mutant: no slack, or the slot booked from the stamp)', () => {
  assert.equal(drawn(60, 30).length, 31, '30 a second (61 stamps, every other one)');
  assert.equal(drawn(60, 60, { wobble: 0.4 }).length, 61, 'a cap at the screen\'s own rate draws every frame - a stamp a hair early is not held a whole refresh');
  const at144 = drawn(144, 60);
  assert.ok(at144.length >= 60 && at144.length <= 62, `60 of 144: ${at144.length}`);
  // the slots are booked on from the last slot, not from the stamp: an uneven screen still averages the cap
  assert.ok(Math.abs(drawn(144, 45).length - 46) <= 1, `45 of 144: ${drawn(144, 45).length}`);
  assert.equal(drawn(60, 0).length, 61, 'no cap draws every frame');
  assert.equal(drawn(60, 120).length, 61, 'a cap above the screen changes nothing - a page never runs faster');
});

test('FPS-CAP1: one decision per stamp, and a long gap is not a burst (mutant: the stamp not remembered, or a late frame racing its missed slots)', () => {
  const st = { due: 0, at: -1, held: false };
  assert.equal(capStep(st, 1000, 30), false, 'the first frame is drawn');
  assert.equal(capStep(st, 1016.7, 30), true, 'the next refresh is held');
  const due = st.due;
  assert.equal(capStep(st, 1016.7, 30), true, 'the same stamp asked again (the FPS counter, after the host) gets the same answer');
  assert.equal(st.due, due, '...and books nothing');
  assert.equal(capStep(st, 1033.4, 30), false);
  assert.equal(capStep(st, 1033.4, 30), false, 'a drawn stamp asked twice is drawn once');
  // a hidden tab: two seconds with no frames at all, then the screen comes back
  assert.equal(capStep(st, 3033.4, 30), false, 'the frame after a gap is drawn');
  assert.equal(capStep(st, 3050.1, 30), true, 'and the next is held - the cap does not replay the slots it missed');
  // the cap turned off mid-run forgets its slot, so turning it on again starts clean
  assert.equal(capStep(st, 3066.8, 0), false);
  assert.equal(st.due, 0);
});

test('FPS-CAP1: the store\'s value is read DFU\'s way - clamped to 0..300, and anything under 30 is no cap (mutant: the floor dropped, or the clamp)', () => {
  assert.equal(FRAME_CAP_FLOOR, 30);
  assert.equal(FRAME_CAP_MAX, 300);
  assert.equal(frameCapRate(0), 0);
  assert.equal(frameCapRate(29), 0, 'StartGameBehaviour: anything below 30 is ignored and treated as disabled');
  assert.equal(frameCapRate(30), 30);
  assert.equal(frameCapRate(144), 144);
  assert.equal(frameCapRate(NaN), 0);
  _resetForTests();
  try {
    assert.equal(frameCapFps(), 0, 'DFU ships 0: no cap');
    setValue('Video', 'TargetFrameRate', '60');
    assert.equal(frameCapFps(), 60);
    setValue('Video', 'TargetFrameRate', '12');
    assert.equal(frameCapFps(), 0);
    setValue('Video', 'TargetFrameRate', '5000');
    assert.equal(frameCapFps(), 300, 'GetInt clamps at 300');
    setValue('Video', 'TargetFrameRate', '30');
    _resetFrameCap();
    assert.equal(frameCapSkip(1000), false);
    assert.equal(frameCapSkip(1016.7), true, 'the live gate reads the store');
  } finally { _resetForTests(); _resetFrameCap(); }
  assert.match(read('src/systems/frameCap.js'), /getInt\('Video', 'TargetFrameRate', 0, 300\)/, 'SettingsManager.cs:414, spelled out for MENU T5');
});

test('FPS-CAP1: the Video row is a stepped control over Off and the rates screens run at - it never offers 1-29, and it reads Off, not 0 (mutant: the stops or the Off reading dropped)', () => {
  const k = 'Video/TargetFrameRate';
  assert.equal(LIVE[k], 'src/systems/frameCap.js');
  assert.equal(tierOf(k), 'live');
  assert.equal(widgetFor(k), 'number');
  assert.equal(NUMBER_LAW[k].min, 0);
  assert.equal(NUMBER_LAW[k].max, 300);
  assert.equal(formatValue(k, '0'), 'Off');
  assert.equal(formatValue(k, '20'), 'Off', 'a hand-edited cap under the floor reads as what it does');
  assert.equal(formatValue(k, '60'), '60 fps');
  assert.equal(FRAME_CAP_STOPS[0], 0);
  assert.ok(FRAME_CAP_STOPS.slice(1).every((v) => v >= FRAME_CAP_FLOOR && v <= FRAME_CAP_MAX), 'every stop past Off is a cap DFU keeps');
  let v = '0';
  const up = [];
  for (let i = 0; i < FRAME_CAP_STOPS.length + 2; i++) { v = stepValue(k, v, 1); up.push(Number(v)); }
  assert.deepEqual(up.slice(0, FRAME_CAP_STOPS.length - 1), FRAME_CAP_STOPS.slice(1), 'one press, one stop');
  assert.equal(up.at(-1), 300, 'and it stops at the top');
  assert.equal(stepValue(k, '0', 1, true), '60', 'shift steps three stops');
  assert.equal(stepValue(k, '100', 1), '120', 'a value between stops steps to its neighbour');
  assert.equal(stepValue(k, '100', -1), '90');
  assert.equal(stepValue(k, '30', -1), '0', 'down from the floor is Off, never 29');
});

test('FPS-CAP1: Wait For Screen Refresh is unavailable - a page always waits - and says what to use instead (mutant: VSync left stored)', () => {
  const k = 'Video/VSync';
  assert.equal(tierOf(k), 'unavailable');
  assert.equal(widgetFor(k), 'blocked');
  assert.match(blockedReason(k), /always waits for the screen refresh/);
  assert.equal(formatValue(k, 'True'), 'always');
  assert.equal(READOUT[k], 'always');
  assert.match(INSTEAD[k], /Frame Rate Cap/);
});

test('FPS-CAP1: all four hosts hold a frame at the top of the callback - above the clock\'s stamp and the input frame, so a held frame leaves no sample and loses no key (mutant: the gate dropped from any host, or moved below the input frame)', () => {
  const GATE = String.raw`if \(frameCapSkip\(now\)\) \{ requestAnimationFrame\(frame\); return; \}`;
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(h);
    assert.match(s, /import \{ frameCapSkip \} from '\.\.\/systems\/frameCap\.js';/, `${h}: imports the gate`);
    assert.match(s, new RegExp(String.raw`if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}[^\n]*\n\s+${GATE}[^\n]*\n\s+frameBegin\(now\);[^\n]*\n\s+beginInputFrame\(`),
      `${h}: alive, then the cap, then the stamp and the input frame`);
    assert.equal(s.split('frameCapSkip(now)').length - 1, 1, `${h}: one gate`);
  }
  const interior = read('src/scenes/interior.js');
  assert.match(interior, new RegExp(String.raw`function frame\(now\) \{\n\s+${GATE}[^\n]*\n\s+const dt = `), 'the interior host: the first statement, above its dt');
});

test('FPS-CAP1: the FPS counter counts the frames the game drew, not the screen\'s refresh (mutant: the counter\'s own gate dropped)', () => {
  const prev = { d: globalThis.document, w: globalThis.window };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, appendChild(c) { return c; }, remove() {} });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = {};
  _resetForTests();
  _resetFrameCap();
  try {
    setValue('Video', 'TargetFrameRate', '30');
    const c = mountFpsCounter({ enabled: () => true, raf: null });
    for (let t = 1000; t <= 3000.5; t += 1000 / 60) c.tick(t);
    const stats = globalThis.window.__fpsStats();
    assert.ok(stats && stats.fps >= 29 && stats.fps <= 31, `a 60 Hz screen capped at 30 counts 30: ${JSON.stringify(stats)}`);
    assert.match(read('src/ui/fpsCounter.js'), /if \(frameCapSkip\(now\)\) \{ if \(live && raf\) handle = raf\(tick\); return; \}\n\s+stamps\.push\(now\);/);
    c.dispose();
  } finally {
    globalThis.document = prev.d; globalThis.window = prev.w;
    _resetForTests(); _resetFrameCap();
  }
});

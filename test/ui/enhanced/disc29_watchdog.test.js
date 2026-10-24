// DISC29-D (2026-09-28, Skeptikali on Discord: a dungeon at 99.9% CPU, frames of 68-203 ms, DOM nodes climbing from
// ~1,700 past 3,000) - A DRAW'S WATCHDOG COUNTS FRAMES, NOT MILLISECONDS.
//
// Eight per-frame DOM faces took themselves down when a wall-clock timer outlived the gap between two draws; a frame
// slower than the timer read as "the draws stopped", so at slow frame rates each face was torn down and built again
// every frame (a forced layout apiece, the old nodes left for the collector - the climbing count). ui/drawWatchdog.js
// releases a face only when an animation frame came and went WITHOUT its draw, or when no frame has come at all for
// DRAW_STALL_MS. These pin the law, its ticker, and that every face reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { armDrawWatchdog, disarmDraw, DRAW_STALL_MS, DRAW_FRAMES_UNDRAWN, _setDrawWatchdogForTests, _frameForTests } from '../../../src/ui/drawWatchdog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A hand-turned timer: schedule() lands here, cancel() strikes it, fire() runs what is due. */
function clock() {
  const due = [];
  return {
    schedule: (fn, ms) => { const t = { fn, ms, live: true }; due.push(t); return t; },
    cancel: (t) => { if (t) t.live = false; },
    pending: () => due.filter((t) => t.live),
    fire() { for (const t of due.filter((x) => x.live)) { t.live = false; t.fn(); } },
  };
}

test('DISC29-D: a slow frame keeps the face; a frame that comes and goes without the draw releases it', () => {
  _setDrawWatchdogForTests({ raf: null });
  const c = clock();
  let released = 0;
  const h = armDrawWatchdog(150, () => { released++; }, c);
  c.fire();
  assert.equal(released, 0, 'the timer outlived a frame that has not ended: no frame went by undrawn');
  assert.equal(c.pending().length, 1, 'the check re-arms at the same ms');
  _frameForTests(1);
  c.fire();
  assert.equal(released, 0, 'one tick may be the frame this draw was made in (the ticker ran after the owner)');
  _frameForTests(1);
  c.fire();
  assert.equal(released, 1, 'two: a whole frame passed with no draw - the owner stopped');
  assert.equal(c.pending().length, 0, 'and nothing is left pending');
  disarmDraw(h);   // twice is safe
  assert.equal(DRAW_FRAMES_UNDRAWN, 2);
});

test('DISC29-D: every draw disarms the last - the owner that keeps drawing is never released, however slow its frames', () => {
  _setDrawWatchdogForTests({ raf: null });
  const c = clock();
  let released = 0;
  let h = null;
  for (let frame = 0; frame < 50; frame++) {
    disarmDraw(h);
    h = armDrawWatchdog(150, () => { released++; }, c);   // the draw
    c.fire();                                             // a 200 ms frame: the timer is due before the next draw
    _frameForTests(1);                                     // and the next frame begins
  }
  assert.equal(released, 0, 'Skeptikali\'s dungeon: rebuilt every frame by the wall clock, kept by the frame count');
  assert.equal(c.pending().length, 1, 'one timer, not fifty');
  disarmDraw(h);
  assert.equal(c.pending().length, 0);
});

test('DISC29-D: no frame at all for DRAW_STALL_MS releases too - a face is never kept for good', () => {
  let now = 1000;
  _setDrawWatchdogForTests({ raf: null, wall: () => now });
  try {
    const c = clock();
    let released = 0;
    armDrawWatchdog(400, () => { released++; }, c);
    now += DRAW_STALL_MS - 1;
    c.fire();
    assert.equal(released, 0);
    now += 1;
    c.fire();
    assert.equal(released, 1, 'a hidden tab, a display asleep: no frames, and the face goes');
    assert.equal(DRAW_STALL_MS, 3000);
  } finally { _setDrawWatchdogForTests({ wall: null }); }
});

test('DISC29-D: the ticker counts animation frames only while a face is armed', () => {
  const frames = [];
  _setDrawWatchdogForTests({ raf: (fn) => { frames.push(fn); return frames.length; } });
  try {
    const c = clock();
    let released = 0;
    const h = armDrawWatchdog(150, () => { released++; }, c);
    assert.equal(frames.length, 1, 'arming starts the ticker');
    const run = () => { const fn = frames.shift(); fn(); };
    run();
    assert.equal(frames.length, 1, 'while armed, each tick asks for the next frame');
    run();
    c.fire();
    assert.equal(released, 1, 'the ticker\'s own frames are the count the check reads');
    assert.equal(frames.length, 1);
    run();
    assert.equal(frames.length, 0, 'and with nothing armed it stops asking');
    disarmDraw(h);
    const h2 = armDrawWatchdog(150, () => {}, c);
    assert.equal(frames.length, 1, 'a later draw starts it again');
    disarmDraw(h2);
    frames.shift()();
    assert.equal(frames.length, 0);
  } finally { _setDrawWatchdogForTests({ raf: null }); }
});

test('DISC29-D: all eight faces read the one law, and none keeps a wall-clock watchdog', () => {
  const faces = {
    'src/ui/enhanced/enhancedNotice.js': 'NOTICE_WATCHDOG_MS',
    'src/ui/enhanced/enhancedDialog.js': 'DIALOG_WATCHDOG_MS',
    'src/ui/enhanced/enhancedPicker.js': 'PICKER_WATCHDOG_MS',
    'src/ui/enhanced/enhancedPort.js': 'PORT_WATCHDOG_MS',
    'src/ui/enhanced/enhancedInputBox.js': 'INPUT_BOX_WATCHDOG_MS',
    'src/ui/yesNoBox.js': 'YES_NO_WATCHDOG_MS',
    'src/ui/worldPlaque.js': 'PLAQUE_WATCHDOG_MS',
    'src/ui/enhanced/enhancedDeath.js': 'STALE_MS',
  };
  for (const [f, ms] of Object.entries(faces)) {
    const s = src(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');   // the code, not the prose about it
    assert.match(s, /import \{ armDrawWatchdog, disarmDraw \} from '(?:\.\/|(?:\.\.\/)+)drawWatchdog\.js';/, `${f}: the one law`);
    const uses = [...s.matchAll(new RegExp(`\\b${ms}\\b`, 'g'))].length;
    const armed = [...s.matchAll(new RegExp(`armDrawWatchdog\\(${ms}\\b`, 'g'))].length;
    const declared = [...s.matchAll(new RegExp(`const ${ms} = `, 'g'))].length;
    assert.ok(armed >= 1, `${f}: ${ms} arms a frame watchdog`);
    assert.equal(uses - declared, armed, `${f}: ${ms} is read by armDrawWatchdog alone`);
    assert.doesNotMatch(s, /setInterval\(/, `${f}: no polling interval`);
  }
  assert.equal(Object.keys(faces).length, 8);
});

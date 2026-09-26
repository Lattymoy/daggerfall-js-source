// SCRIPT-SPLIT (2026-09-26, two players via Mac, both outdoors on ANGLE
// Direct3D11: "script 107.5 ms" of a 104.3 ms frame on a GTX 1650, "script
// 203.6 ms" of 201.6 on an RTX 4090 Laptop). The script line is measured
// from the rAF's stamp, and Chrome stamps a frame at the display's beat, so
// a main thread busy with anything first is in it before the game's frame
// runs a line. The frame clock now says which part a sample's milliseconds
// were - the host's own callback, the time before it, the stream's lent
// slices - and the counter prints them under the script line. Pins: the
// three parts sum to the sample, a late callback is `before` and not the
// frame's, the lent slices are `stream`, an abandoned frame leaves nothing,
// the parts are clamped into the frame, the line's format and its absence,
// and the probe's object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameBegin, frameEnd, frameCpu, frameAbort, lendFrame, _resetFrameClock } from '../src/systems/frameClock.js';
import { mountFpsCounter, scriptSplitLine } from '../src/ui/fpsCounter.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('SCRIPT-SPLIT frameClock: a callback that began late is BEFORE, the callback itself is IN FRAME, lent slices are STREAM - and the three sum to the sample (mutant: the stamp read as the start, the lent time dropped)', () => {
  _resetFrameClock();
  // a 100 ms frame whose callback ran 90 ms after the stamp and took 10
  for (let f = 0; f < 10; f++) { const t = 1000 + f * 100; frameBegin(t, t + 90); frameEnd(t + 100); }
  let c = frameCpu();
  assert.ok(near(c.meanMs, 100), `the script time is unchanged: ${JSON.stringify(c)}`);
  assert.ok(near(c.inFrameMs, 10), 'the game\'s own callback');
  assert.ok(near(c.beforeMs, 90), 'the main thread before it');
  assert.ok(near(c.streamMs, 0));
  // the stream's slices, lent between two samples, are their own part
  lendFrame(4);
  frameBegin(2100, 2100); frameEnd(2106);
  c = frameCpu();
  assert.ok(near(c.inFrameMs + c.beforeMs + c.streamMs, c.meanMs), `the parts sum to the mean: ${JSON.stringify(c)}`);
  assert.ok(c.streamMs > 0, 'the lent slices are stream');
  _resetFrameClock();
  lendFrame(4); frameBegin(3000, 3000); frameEnd(3006);
  c = frameCpu();
  assert.ok(near(c.meanMs, 10) && near(c.inFrameMs, 6) && near(c.streamMs, 4) && near(c.beforeMs, 0), JSON.stringify(c));
  _resetFrameClock();
});

test('SCRIPT-SPLIT frameClock: a start outside the frame is clamped into it (the parts still sum), and an aborted or begin-less frame leaves no sample (mutant: the clamp dropped, the start not cleared)', () => {
  _resetFrameClock();
  frameBegin(1000, 5000); frameEnd(1020);   // a start after the end: the whole frame is before
  let c = frameCpu();
  assert.ok(near(c.beforeMs, 20) && near(c.inFrameMs, 0), JSON.stringify(c));
  _resetFrameClock();
  frameBegin(1000, 10); frameEnd(1020);   // a start before the stamp: the whole frame is the callback's
  c = frameCpu();
  assert.ok(near(c.beforeMs, 0) && near(c.inFrameMs, 20), JSON.stringify(c));
  _resetFrameClock();
  frameBegin(1000, 1050); frameAbort(); frameEnd(1100);
  assert.equal(frameCpu(), null, 'an aborted frame is no sample');
  frameBegin(2000, 2000); frameEnd(2005);
  c = frameCpu();
  assert.ok(near(c.beforeMs, 0) && near(c.inFrameMs, 5), 'the aborted frame\'s late start did not ride into the next');
  _resetFrameClock();
});

test('SCRIPT-SPLIT fpsCounter: the parts print under the script line, and not without a clock; the probe\'s object carries them (mutant: the line dropped, a part mislabelled)', () => {
  assert.equal(scriptSplitLine(null), '');
  assert.equal(scriptSplitLine({ meanMs: 3 }), '', 'a clock without the parts prints nothing');
  assert.equal(scriptSplitLine({ inFrameMs: 12.34, beforeMs: 92.2, streamMs: 3 }), '\nin frame 12.3  before 92.2  stream 3.0');
  const prev = { d: globalThis.document, w: globalThis.window };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(ch) { this.children.push(ch); return ch; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = {};
  try {
    _resetFrameClock();
    const c = mountFpsCounter({ enabled: () => true, raf: null });
    for (let t = 0; t <= 1100; t += 100) { frameBegin(t, t + 90); frameEnd(t + 100); c.tick(t + 100); }
    assert.match(c.el.textContent, /\nscript 100\.0 ms  worst 100\nin frame 10\.0  before 90\.0  stream 0\.0/, JSON.stringify(c.el.textContent));
    const s = globalThis.window.__fpsStats();
    assert.ok(near(s.scriptInFrameMs, 10) && near(s.scriptBeforeMs, 90) && near(s.scriptStreamMs, 0), JSON.stringify(s));
    c.dispose();
  } finally { globalThis.document = prev.d; globalThis.window = prev.w; _resetFrameClock(); }
});

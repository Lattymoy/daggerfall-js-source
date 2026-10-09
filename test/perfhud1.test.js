// PERF-HUD1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; PERF-NEXT item 5, bible/07-Rendering/Performance-Online.md): THE MOVABLE HUD SWEEPS ON ONE CLOCK. Its sweep
// (ui/hudLayout.js sweepHudLayout - 34 querySelectorAll over the page) ran on a 250 ms interval AND from the
// HUD's frame tick, each on its own clock: about eight sweeps a second where four were meant. The interval is the clock
// where it runs; the tick starts it, sweeps once at the start, and sweeps on its own clock only where no interval runs (a
// page without events). Driven over a fake page and a captured interval - never on a clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweepHudLayout, tickHudLayout, _resetHudLayoutForTests } from '../src/ui/hudLayout.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

/** A page that answers every selector with nothing and counts the asks; `events` gives it a window with listeners. */
function countingPage(events) {
  const node = () => ({ children: [], attrs: {}, dataset: {}, style: { setProperty() {}, removeProperty() {} }, append() {}, remove() {}, setAttribute() {}, hasAttribute: () => false, removeAttribute() {} });
  const doc = { asks: 0, head: node(), body: node() };
  doc.querySelectorAll = () => { doc.asks++; return []; };
  doc.getElementById = () => null;
  doc.createElement = node;
  if (events) doc.defaultView = { addEventListener() {} };
  return doc;
}

/** The enhanced skin (the movable HUD is Enhanced Plus's), a captured setInterval; torn down after. */
function withPage(events, fn) {
  const had = { loc: globalThis.location, si: globalThis.setInterval, ci: globalThis.clearInterval };
  const ticks = [];
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.setInterval = (f, ms) => { ticks.push({ f, ms }); return { unref() {} }; };
  globalThis.clearInterval = () => {};
  resetPrefs(); _resetHudLayoutForTests();
  try { return fn(countingPage(events), ticks); } finally {
    _resetHudLayoutForTests(); resetPrefs();
    globalThis.setInterval = had.si; globalThis.clearInterval = had.ci;
    if (had.loc === undefined) delete globalThis.location; else globalThis.location = had.loc;
  }
}

/** A second of a 60 fps HUD: a tick a frame, the interval firing at its own beat between them; answers the times (ms,
 *  rounded) of the sweeps, each the tick's (t) or the interval's (i) - AUDIT PERF-ON4 (record lens 8): when, not only how
 *  many. */
function aSecond(doc, ticks) {
  const one = (() => { const a = doc.asks; sweepHudLayout(doc); const n = doc.asks - a; doc.asks = a; return n; })();
  assert.ok(one > 10, `a sweep asks the page for its pieces (${one} asks)`);
  doc.asks = 0;
  const at = [];
  const seen = (who, t) => { while (doc.asks >= one) { doc.asks -= one; at.push(`${who}${Math.round(t)}`); } };
  let fired = 0;
  for (let i = 0; i <= 60; i++) {
    const t = (i * 1000) / 60;
    tickHudLayout(doc, t);
    seen('t', t);
    const every = ticks[0]?.ms;
    while (every && (fired + 1) * every <= t) { fired++; ticks[0].f(); seen('i', fired * every); }
  }
  assert.equal(doc.asks, 0, 'every ask a whole sweep');
  return at;
}

test('PERF-HUD1: a page with events sweeps on ONE clock - the interval\'s, four times a second at SWEEP_MS, and the tick\'s once at the start: five sweeps in a second at 60 fps, where the tick swept beside the interval on its own clock and made nine (mutants: the tick sweeping on its clock beside the interval; no first sweep at the start)', () => {
  withPage(true, (doc, ticks) => {
    const sweeps = aSecond(doc, ticks);
    assert.equal(ticks.length, 1, 'one interval');
    assert.equal(ticks[0].ms, 250, 'at SWEEP_MS');
    assert.deepEqual(sweeps, ['t0', 'i250', 'i500', 'i750', 'i1000'], 'the start\'s sweep and the interval\'s four');
  });
});

test('PERF-HUD1: a page without events (a test\'s stub: the start sets no interval) is swept by the tick on its own clock, at the second tick and every SWEEP_MS after - as before - and a page started after another starts its clock afresh (mutants: the tick never sweeping; the tests\' reset keeping the last page\'s clock)', () => {
  for (let run = 0; run < 2; run++) {
    withPage(false, (doc, ticks) => {
      const sweeps = aSecond(doc, ticks);
      assert.equal(ticks.length, 0, 'no interval');
      assert.deepEqual(sweeps, ['t17', 't267', 't533', 't783'], `run ${run}: the tick's sweeps at 17, 267, 533 and 783 ms - the first frame SWEEP_MS on from the last (516.7 - 266.7 rounds under 250)`);
    });
  }
});

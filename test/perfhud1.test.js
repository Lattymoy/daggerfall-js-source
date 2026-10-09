// PERF-HUD1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; PERF-NEXT item 5, bible/07-Rendering/Performance-Online.md): THE MOVABLE HUD SWEEPS ON ONE CLOCK. Its sweep
// (ui/hudLayout.js sweepHudLayout - about thirty querySelectorAll over the page) ran on a 250 ms interval AND from the
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

/** A second of a 60 fps HUD: a tick a frame, the interval firing at its own beat between them; answers the sweeps. */
function aSecond(doc, ticks) {
  const one = (() => { const a = doc.asks; sweepHudLayout(doc); const n = doc.asks - a; doc.asks = a; return n; })();
  assert.ok(one > 10, `a sweep asks the page for its pieces (${one} asks)`);
  doc.asks = 0;
  let fired = 0;
  for (let i = 0; i <= 60; i++) {
    const t = (i * 1000) / 60;
    tickHudLayout(doc, t);
    const every = ticks[0]?.ms;
    while (every && (fired + 1) * every <= t) { fired++; ticks[0].f(); }
  }
  return doc.asks / one;
}

test('PERF-HUD1: a page with events sweeps on ONE clock - the interval\'s, four times a second at SWEEP_MS, and the tick\'s once at the start: five sweeps in a second at 60 fps, where the tick swept beside the interval on its own clock and made nine (mutants: the tick sweeping on its clock beside the interval; no first sweep at the start)', () => {
  withPage(true, (doc, ticks) => {
    const sweeps = aSecond(doc, ticks);
    assert.equal(ticks.length, 1, 'one interval');
    assert.equal(ticks[0].ms, 250, 'at SWEEP_MS');
    assert.equal(sweeps, 1 + 4, `the start's sweep and the interval's four (${sweeps})`);
  });
});

test('PERF-HUD1: a page without events (no interval can be set) is swept by the tick on its own clock, at the second tick and every SWEEP_MS after - as before (mutant: the tick never sweeping)', () => {
  withPage(false, (doc, ticks) => {
    const sweeps = aSecond(doc, ticks);
    assert.equal(ticks.length, 0, 'no interval');
    assert.equal(sweeps, 4, `the tick's sweeps at 17, 267, 517 and 767 ms (${sweeps})`);
  });
});

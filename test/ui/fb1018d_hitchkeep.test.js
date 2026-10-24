// FIELD BUGS 2026-10-18d HITCH-KEEP (Awesomenout, "Help! Severe and random FPS drops": "Normally, my game runs at a stable
// 144 FPS, but sometimes my FPS suddenly drops dramatically, going as low as 30 FPS or even 0 FPS ... I've also tried
// changing the graphics settings, but it doesn't seem to make any difference"). The cause is not proven; what the
// counter could say about it is. Its worst frame was its second's, gone a second later, so a hitch that comes and goes
// was over before a screenshot could hold it, and nothing said whose milliseconds it was; and a page put away read, on
// its return, as a second of 0 fps whose worst frame was the whole absence. The counter EXECUTES against a stub document
// whose page can be put away, the frame clock (systems/frameClock.js) stamped as a host stamps it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountFpsCounter, hitchCount, keptHitch, hitchLine, HITCH_MS, HITCH_KEEP_MS } from '../../src/ui/fpsCounter.js';
import { frameBegin, frameEnd, frameCpu, frameSampleAt, lendFrame, _resetFrameClock } from '../../src/systems/frameClock.js';

const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const P = 1000 / 144;   // the player's screen

/** A stub page whose document can be put away (`hide(true)`) and shown again, its visibilitychange heard. */
function onPage(fn) {
  const prev = { d: globalThis.document, w: globalThis.window };
  const heard = new Set();
  const doc = {
    createElement: stubEl, body: stubEl(), hidden: false,
    addEventListener(type, f) { if (type === 'visibilitychange') heard.add(f); },
    removeEventListener(type, f) { if (type === 'visibilitychange') heard.delete(f); },
  };
  globalThis.document = doc;
  globalThis.window = {};
  const page = { heard, hide(h) { doc.hidden = h; for (const f of [...heard]) f(); } };
  try { _resetFrameClock(); return fn(page); } finally { globalThis.document = prev.d; globalThis.window = prev.w; _resetFrameClock(); }
}

/** `ms` of steady frames from `t`, each a 2 ms host frame stamped on the screen's beat; answers the next stamp. */
function steady(c, t, ms) {
  for (const end = t + ms; t < end; t += P) { c.tick(t); frameBegin(t, t); frameEnd(t + 2); }
  return t;
}
/** One long frame at `t`, `frameMs` to the next stamp: the host's callback `beforeMs` late and `inFrameMs` long, `lent`
 *  of the world's build lent to it. Answers the next stamp. */
function hitch(c, t, frameMs, { beforeMs = 0, inFrameMs = 2, lent = 0 } = {}) {
  c.tick(t);
  if (lent) lendFrame(lent);
  frameBegin(t, t + beforeMs);
  frameEnd(t + beforeMs + inFrameMs);
  return t + frameMs;
}

test('HITCH-KEEP THE COUNTER KEEPS THE MINUTE\'S WORST FRAME: a hitch is on the counter, its script in its own three parts, for HITCH_KEEP_MS after its second, the worst of the minute\'s and their count beside it, and the probe carries it (mutants: the line unprinted, the second unkept, the window unpruned or short, the worst not chosen, the count unsummed, the age unscaled, the means\' parts for the worst frame\'s, a part mislabelled, the probe without it)', () => onPage(() => {
  const c = mountFpsCounter({ enabled: () => true, raf: null });
  let t = steady(c, 0, 2000);
  assert.doesNotMatch(c.el.textContent, /hitch/, `a steady 144 reads as before: ${JSON.stringify(c.el.textContent)}`);
  // a 500 ms frame: the host's callback began 300 ms after the stamp (whatever ran first) and took 150, and 30 ms of the
  // world's build was lent to it - 480 ms of script
  t = hitch(c, t, 500, { beforeMs: 300, inFrameMs: 150, lent: 30 });
  t = steady(c, t, 20_000);
  const text = c.el.textContent;
  assert.match(text, /^14\d fps\n6\.9 ms {2}worst 7\n/, `the second's own worst is the second's: ${JSON.stringify(text)}`);
  assert.match(text, /\nhitch 500 ms {2}(19|20) s ago {2}1 a minute\nscript 480 {2}frame 150 {2}before 300 {2}stream 30(\n|$)/, `twenty seconds on, the hitch is still said: ${JSON.stringify(text)}`);
  let h = globalThis.window.__fpsStats().hitch;
  assert.ok(h && near(h.ms, 500) && h.count === 1 && near(h.scriptMs, 480) && near(h.inFrameMs, 150) && near(h.beforeMs, 300) && near(h.streamMs, 30), `the probe's: ${JSON.stringify(h)}`);
  assert.ok(h.agoS >= 19 && h.agoS <= 20, `its age in seconds: ${h.agoS}`);
  // a 120 ms frame of 3 ms script - not the main thread's - is the minute's second hitch, not its worst
  t = hitch(c, t, 120, { inFrameMs: 3 });
  t = steady(c, t, 5000);
  assert.match(c.el.textContent, /\nhitch 500 ms {2}2\d s ago {2}2 a minute\n/, `the worst of two, and both counted: ${JSON.stringify(c.el.textContent)}`);
  // past HITCH_KEEP_MS from the first: the second stands alone
  t = steady(c, t, HITCH_KEEP_MS - 25_000 + 2000);
  assert.match(c.el.textContent, /\nhitch 120 ms {2}\d+ s ago {2}1 a minute\nscript 3 {2}frame 3 {2}before 0 {2}stream 0(\n|$)/, `the first let go: ${JSON.stringify(c.el.textContent)}`);
  t = steady(c, t, HITCH_KEEP_MS);
  assert.doesNotMatch(c.el.textContent, /hitch/, `a minute without one: no line: ${JSON.stringify(c.el.textContent)}`);
  h = globalThis.window.__fpsStats().hitch;
  assert.equal(h, null, 'and the probe says none');
  c.dispose();
}));

test('HITCH-KEEP A HITCH IS A FRAME OF HITCH_MS OR MORE, AND ITS SCRIPT IS ITS OWN FRAME\'S: the frame clock answers a frame\'s own three parts by the stamp it began at (AUDIT FB1018D L2-1), and the line says no script without a clock (mutants: the threshold exclusive, HITCH_MS moved, a frame\'s parts read off another, the script line without a clock)', () => {
  assert.equal(HITCH_MS, 50);
  assert.equal(hitchCount([0, 49]), 0);
  assert.equal(hitchCount([0, 50]), 1, 'HITCH_MS itself is a hitch');
  assert.equal(hitchCount([0, 10, 60, 70, 500]), 2);
  assert.equal(hitchCount([5]), 0);
  assert.equal(keptHitch([], 0), null);
  assert.equal(hitchLine(null), '');
  const bare = keptHitch([{ at: 1000, worstMs: 90, hitches: 1, cpu: null }], 4000);
  assert.deepEqual(bare, { ms: 90, agoS: 3, count: 1, scriptMs: null, inFrameMs: null, beforeMs: null, streamMs: null });
  assert.equal(hitchLine(bare), '\nhitch 90 ms  3 s ago  1 a minute', 'the menu has no host loop: no script line');
  assert.equal(keptHitch([{ at: 1000, worstMs: 90, hitches: 1, cpu: null }], 4600).agoS, 4, 'its age to the nearest second');   // AUDIT FB1018D L2-4
  _resetFrameClock();
  try {
    for (let f = 0; f < 9; f++) { const s = 1000 + f * 10; frameBegin(s, s + 1); frameEnd(s + 9); }   // 8 in frame, 1 before
    lendFrame(20); frameBegin(1100, 1190); frameEnd(1230);   // the worst: 90 before, 40 in frame, 20 lent
    const cpu = frameCpu();
    assert.ok(near(cpu.worstMs, 150), JSON.stringify(cpu));
    // AUDIT FB1018D L2-1: a frame's own script by the stamp it began at, its three parts summing to it
    const own = frameSampleAt(1100);
    assert.ok(near(own.ms, 150) && near(own.inFrameMs, 40) && near(own.beforeMs, 90) && near(own.streamMs, 20), `that frame's own parts: ${JSON.stringify(own)}`);
    assert.ok(near(frameSampleAt(1010).ms, 9) && near(frameSampleAt(1010).beforeMs, 1), 'and a light frame its own');
    assert.equal(frameSampleAt(1105), null, 'a stamp no frame began at');
    assert.ok(near(cpu.inFrameMs, (9 * 8 + 40) / 10) && near(cpu.beforeMs, (9 + 90) / 10), `the means' are the means: ${JSON.stringify(cpu)}`);
  } finally { _resetFrameClock(); }
});

test('HITCH-KEEP A PAGE PUT AWAY IS NO FRAME: the gap across a hidden page is none of the second\'s, so its return reads the frames shown - never 0 fps, never a worst the length of the absence, never the minute\'s hitch - and the counter stops listening when disposed (mutants: the gap counted, the hide unheard, the listener kept)', () => onPage((page) => {
  const c = mountFpsCounter({ enabled: () => true, raf: null });
  assert.equal(page.heard.size, 1, 'the counter hears the page');
  let t = steady(c, 0, 1500);
  page.hide(true);
  t += 9000;   // the browser holds a hidden page's animation frames: no tick for nine seconds
  page.hide(false);
  t = steady(c, t, 2100);
  const text = c.el.textContent;
  assert.match(text, /^14\d fps\n6\.9 ms {2}worst 7\n/, `the frames shown: ${JSON.stringify(text)}`);
  assert.doesNotMatch(text, /hitch/, `no hitch: ${JSON.stringify(text)}`);
  const s = globalThis.window.__fpsStats();
  assert.ok(s.fps > 100 && s.worstMs < HITCH_MS && s.hitch === null, JSON.stringify(s));
  c.dispose();
  assert.equal(page.heard.size, 0, 'disposed, it hears nothing');
}));

test('HITCH-KEEP (AUDIT FB1018D L2-1, L2-4): THE HITCH\'S SCRIPT IS ITS OWN FRAME\'S, AND THE MINUTE IS A MINUTE - a 60 ms gap whose frame ran 3 ms of script says 3, though a 45 ms frame that was no hitch shared its second; a gap that opens a second finds its frame; a 60 ms hitch is still said 58 s on and gone past 60; a page shown again counts its own draws (mutants: the second\'s worst sample read; the gap\'s stamp unasked; a hitch under twice HITCH_MS unkept; the minute shortened; the draws\' sums kept across the hide)', () => onPage((page) => {
  const c = mountFpsCounter({ enabled: () => true, raf: null, stats: () => ({ draws: 100, texBinds: 10 }) });
  let t = steady(c, 0, 2000);
  // the heavy frame first: 45 ms of script, 48.6 ms to the next stamp - no hitch
  c.tick(t); frameBegin(t, t); frameEnd(t + 45); t += 48.6;
  t = steady(c, t, 100);
  // the hitch: 60 ms to the next stamp, 3 ms of script in its frame
  t = hitch(c, t, 60, { inFrameMs: 3 });
  t = steady(c, t, 3000);
  assert.match(c.el.textContent, /\nhitch 60 ms {2}\d s ago {2}1 a minute\nscript 3 {2}frame 3 {2}before 0 {2}stream 0(\n|$)/, `the hitch's own frame's script: ${JSON.stringify(c.el.textContent)}`);
  assert.ok(near(globalThis.window.__fpsStats().hitch.scriptMs, 3), 'and the probe\'s');
  // two in one second: the longer\'s own frame, though the shorter came after it
  t = steady(c, t, 61_000);
  t = hitch(c, t, 90, { inFrameMs: 11 });
  t = steady(c, t, 50);
  t = hitch(c, t, 70, { inFrameMs: 22 });
  t = steady(c, t, 2100);
  assert.match(c.el.textContent, /\nhitch 90 ms {2}\d s ago {2}2 a minute\nscript 11 {2}frame 11 {2}/, `the longer gap\'s frame: ${JSON.stringify(c.el.textContent)}`);
  // 58 s on it is still the minute's; past 60 it is gone
  const keptAt = t;
  t = steady(c, t, 55_000);
  assert.match(c.el.textContent, /\nhitch 90 ms {2}5\d s ago {2}2 a minute\n/, `still kept ${((t - keptAt) / 1000).toFixed(1)} s on: ${JSON.stringify(c.el.textContent)}`);
  t = steady(c, t, 5000);
  assert.doesNotMatch(c.el.textContent, /hitch/, `a minute on, gone: ${JSON.stringify(c.el.textContent)}`);
  // a gap opened by the very frame that closes a second is the next second's, and its frame is found
  let closed = false;
  for (let k = 0; k < 400 && !closed; k++) {
    const was = globalThis.window.__fpsStats();
    c.tick(t);
    closed = globalThis.window.__fpsStats() !== was;
    frameBegin(t, t); frameEnd(t + (closed ? 7 : 2));
    t += closed ? 80 : P;
  }
  assert.ok(closed, 'a second closed');
  t = steady(c, t, 2100);
  const h = globalThis.window.__fpsStats().hitch;
  assert.ok(h && near(h.ms, 80) && near(h.scriptMs, 7), `the gap's own frame, though it closed the second before: ${JSON.stringify(h)}`);
  // the page put away mid-second and shown again: the draws of its first second back are the frames' own
  t = steady(c, t, 500);
  page.hide(true); t += 4000; page.hide(false);
  t = steady(c, t, 1010);
  assert.match(c.el.textContent, /\ndraws 100 {2}binds 10(\n|$)/, `the draws after the hide: ${JSON.stringify(c.el.textContent)}`);
  c.dispose();
}));

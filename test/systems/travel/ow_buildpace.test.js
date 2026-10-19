// OW-BUILD (bible/06-Systems/Travel-View.md OW-BUILD; the owner's call, 2026-10-18, after QUEUE-OWED: "Build ground
// faster during Overworld travel"). Under the Overworld a journey runs the clock at up to a hundred times walking pace,
// and the ground the stream has not built is what holds it - TV2's governor halves it to x1 while a pixel of the
// counted grid is owed (scenes/world.js travelViewGovern). The stream's builds breathe (systems/buildBreather.js): a
// slice of work a frame, 3 to 6 ms (PERF-EXT24's frameFitBudget), so the ground came at the pace of a 60-a-second frame
// while the traveller watched it from the sky. While the view is up a slice is now what a frame of 30 a second leaves,
// up to BUILD_SLICE_OVERWORLD_MS, never less than the ordinary 6 ms. Run on the real breather and the host's own budget.
// OW-LAG (2026-10-19, the owner: "People are lagging in the overworld"): that slice held EVERY frame under the view to
// 30 a second while anything at all was queued - a view raised to look about, a journey whose ground kept up, a 144 Hz
// display at a fifth of its rate. It is lent now only while the governor's own count says a fast journey (or the keys'
// travel) owes ground in the view's reach; otherwise the view's frames are sized as the ground's are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as BB from '../../../src/systems/buildBreather.js';
import { travelWalkRate, TV_MOVE_ACTIONS } from '../../../src/scenes/travelView.js';
import { createLoadGovernor, unbuiltAround } from '../../../src/systems/travel/travelGovernor.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../../../src/systems/timeScale.js';
import { foePaced, foeRate } from '../../../src/systems/travel/travelThreat.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { setPaceGround, setTravelPace, _resetTravelPace } from '../../../src/systems/travel/travelPace.js';

const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const VSYNC = 1000 / 60;

test('OW-BUILD, the law: under the Overworld a slice is what a frame of 30 a second leaves past the frame\'s own script and the margin - up to 20 ms, never under the ordinary 6, whatever the display\'s rate; a NaN is the ordinary slice', () => {
  const f = BB.frameFitBudget;
  assert.equal(BB.BUILD_OVERWORLD_FRAME_MS, 1000 / 30);
  assert.equal(BB.BUILD_SLICE_OVERWORLD_MS, 20);
  const ow = (busyMs, intervalMs = VSYNC) => f({ intervalMs, busyMs, streamingMs: 0, awaited: false, overworld: true });
  assert.equal(ow(8), 20, 'a light frame: the whole 20 ms (33.3 - 8 - 2.5 is more)');
  assert.equal(ow(0), 20, 'never past the cap');
  assert.ok(Math.abs(ow(16) - (1000 / 30 - 16 - BB.BUILD_SLICE_MARGIN_MS)) < 1e-9, `a heavier frame: what 30 a second leaves (${ow(16)})`);
  assert.equal(ow(16, 6.9), ow(16, VSYNC), 'a 144 Hz display is sized the same - the Overworld\'s frame, not the display\'s');
  assert.equal(ow(30), BB.BUILD_SLICE_MS, 'a frame too heavy to leave 6: the ordinary slice, never less');
  assert.equal(ow(NaN), BB.BUILD_SLICE_MS, 'a NaN in is the ordinary slice out, never a stall');
  assert.equal(f({ intervalMs: VSYNC, busyMs: 8, overworld: true, awaited: true }), 20, 'an awaited build under the view is never sized smaller for it');
  // the view down: PERF-EXT24's slice as it was
  assert.equal(f({ intervalMs: VSYNC, busyMs: 8, streamingMs: 0 }), Math.max(BB.BUILD_SLICE_FLOOR_MS, Math.min(BB.BUILD_SLICE_MS, VSYNC - 8 - BB.BUILD_SLICE_MARGIN_MS)));
  assert.equal(f({ intervalMs: VSYNC, busyMs: 8, streamingMs: 5000 }), BB.BUILD_SLICE_MS);
});

test('OW-BUILD, the host (OW-LAG): the breather\'s budget lends the Overworld\'s slice only while the view is up AND the governor said this frame that a fast journey owes ground in its reach - read at each slice; otherwise every arm as it was (the host\'s own budget line, lifted)', () => {
  const m = /\n {4}budget: (\(\) => frameFitBudget\(\{[^\n]*?\}\)),[^\n]*\n/.exec(W);
  assert.ok(m, 'the breather\'s budget');
  assert.match(m[1], /overworld: tvGroundOwed && !!travelView\?\.active/, 'the governor\'s word and the view\'s own flag');
  assert.match(W, /\n {8}tvGroundOwed = travelViewGovern\(dt\);/, 'the frame keeps the governor\'s word');
  assert.ok(W.indexOf('  let tvGroundOwed = false;') < W.indexOf('  const breather = createBreather({'), 'BOOT-TDZ: declared above the breather, whose birth asks its budget');
  const view = { active: false };
  const env = { frameFitBudget: BB.frameFitBudget, frameInterval: () => VSYNC, lastBusy: () => 8, performance: { now: () => 10000 }, travelView: view };
  const host = new Function(...Object.keys(env), `let _streamSince = null; let _awaitedBuilds = 0; let tvGroundOwed = false;
    const budget = ${m[1]};
    return { budget, stream: (v) => { _streamSince = v; }, wait: (n) => { _awaitedBuilds = n; }, owed: (v) => { tvGroundOwed = v; } };`)(...Object.values(env));
  host.stream(9900);   // a stream begun 100 ms ago
  const down = host.budget();
  assert.ok(down >= BB.BUILD_SLICE_FLOOR_MS && down <= BB.BUILD_SLICE_MS, `the view down: the frame-fit slice (${down})`);
  view.active = true;
  assert.equal(host.budget(), down, 'OW-LAG: the view up with no journey owed ground - looking about, or a journey the ground keeps up with: the frame-fit slice, the frame keeps its rate');
  host.owed(true);
  assert.equal(host.budget(), BB.BUILD_SLICE_OVERWORLD_MS, 'the view up and a fast journey owed ground: the Overworld\'s slice');
  view.active = false;
  assert.equal(host.budget(), down, 'the view down with a word left over from its last frame: never the Overworld\'s slice');
  host.owed(false);
  host.stream(1000);   // nine seconds on
  assert.equal(host.budget(), BB.BUILD_SLICE_MS, 'down again: an old stream\'s whole slice, as ever');
  const none = new Function('frameFitBudget', 'frameInterval', 'lastBusy', 'performance', 'travelView',
    `let _streamSince = null; let _awaitedBuilds = 1; let tvGroundOwed = false; return (${m[1]})();`)(BB.frameFitBudget, () => VSYNC, () => 8, { now: () => 0 }, null);
  assert.equal(none, BB.BUILD_SLICE_MS, 'no view at all (the boot, before it is made): an awaited build\'s whole slice');
});

/** world.js's governor, mounted from its own source (as test/systems/travel/tv_wasd.test.js mounts it) over the real load
 *  governor and clock: `let tvHeld` through the end of travelViewGovern, the keys' travel its fast travel. */
function governorRig() {
  const w = { keys: new Set(), view: { active: true, state: 'up' }, unbuilt: new Set(), held: false };
  const env = {
    travelControlUI: { isShowing: false }, travelOptions: { state: { autopilot: null } }, tvOwnsJourneys: () => true,
    travellerOnRoad: () => true, foePaced, foeRate, travelWalkRate, TV_MOVE_ACTIONS,
    travelView: w.view, held: (keys, a) => keys.has(a), keys: w.keys,
    walkMode: true, playerSpawned: true, player: { isPlayerSwimming: false },
    csaBoatUnderMe: () => null, gamePaused: () => false,
    setWorldTimeScale: setTimeScale, worldTimeScale: timeScale, resetTimeScale,
    travelAsked: 1, csaHoldsTimeScale: () => false,
    travelGovernor: createLoadGovernor({ max: MAX_TIME_SCALE }),
    state: { terrainDistance: 3, loaded: { has: () => true } }, playerTravelPixel: () => ({ x: 100, y: 200 }), tvGroundGenNow: () => w.unbuilt.size,
    unbuiltAround, built: { has: (k) => !w.unbuilt.has(k) }, StreamingWorldState,
    journeyThreatCap: () => (w.held ? { cap: Infinity, held: true } : { cap: Infinity }), journeySlowSaid: () => {},
  };
  const from = W.indexOf('  let tvHeld = null;');
  const fn = W.indexOf('  function travelViewGovern(dt) {', from);
  const end = W.indexOf('\n  }\n', fn) + 4;
  assert.ok(from >= 0 && fn > from && end > fn, 'the governor\'s source');
  const names = Object.keys(env);
  const g = new Function(...names, `${W.slice(from, end)}\nreturn { govern: travelViewGovern };`)(...names.map((k) => env[k]));
  return { w, govern: () => g.govern(1 / 60) };
}

test('OW-LAG, the governor\'s word: travelViewGovern answers true only while fast travel under the view owes ground in its counted reach and no enemy holds the clock to x1 - a boolean from every exit (THE MODAL CONTRACT); looking about, a journey the ground keeps up with, the view down: false, and the frame keeps its rate (mutants: the count ignored, the enemies ignored, an exit answering undefined)', (t) => {
  t.after(() => { resetTimeScale(); _resetTravelPace(); });
  _resetTravelPace(); setPaceGround(true); setTravelPace('speed', 100);
  resetTimeScale();
  const { w, govern } = governorRig();
  w.unbuilt.add('101,200');   // a pixel of the counted grid still building
  assert.equal(govern(), false, 'the view up, nothing travelling: looking about owes the clock nothing');
  w.keys.add('MoveForwards');
  assert.equal(govern(), true, 'the keys\' x100 under the view, ground owed: the stream\'s turn');
  w.unbuilt.clear();
  assert.equal(govern(), false, 'the ground kept up: nothing owed, the frame\'s rate');
  w.unbuilt.add('101,200');
  w.held = true;
  assert.equal(govern(), false, 'an enemy holds the clock to x1: no build would lift it');
  w.held = false;
  w.view.active = false; w.view.state = 'down';
  assert.equal(govern(), false, 'the view down');
  w.keys.clear();
  assert.equal(typeof govern(), 'boolean', 'and a boolean, not undefined, from the view-down exit');
});

/** The real breather over a pixel's `workMs` of build, in 1 ms units, on a 60 Hz display: each frame the host's own
 *  script takes `busyMs`, then the breather's slice runs, and the next frame begins at the next beat. Returns the
 *  frames the build took and their rate. */
async function buildFrames(workMs, busyMs, overworld) {
  let t = busyMs, frames = 0;   // the first frame's script ran before the build began
  const pending = [];
  const raf = (fn) => { pending.push(fn); };
  const b = BB.createBreather({
    now: () => t, raf,
    budget: () => BB.frameFitBudget({ intervalMs: VSYNC, busyMs, streamingMs: 5000, awaited: false, overworld }),
  });
  let periodSum = 0;
  let frameStart = 0;
  const work = (async () => {
    for (let i = 0; i < workMs; i++) { t += 1; await b.breathe(); }
  })();
  for (;;) {
    await new Promise((r) => setImmediate(r));
    if (!pending.length) break;
    // the build yielded: the frame closes, the next beat after it begins, the host's script runs, the build resumes
    const used = t - frameStart;
    const period = Math.ceil(Math.max(used, 1e-9) / VSYNC) * VSYNC;
    periodSum += period; frames++;
    frameStart += period; t = frameStart + busyMs;
    pending.shift()();
  }
  await work;
  return { frames, fps: frames ? 1000 / (periodSum / frames) : 60 };   // a frame a yield - the build's last breath yields too
}

test('OW-BUILD, the pace: the real breather builds a pixel\'s 360 ms of work in 18 frames under the Overworld where it took 60 - 0.6 s where it took a second, the frame at 30 a second for it; on a frame already under 60 the view costs no rate and the build is three times as fast', async () => {
  const light = await buildFrames(360, 8, false), lightOw = await buildFrames(360, 8, true);
  assert.equal(light.frames, 60, `the view down: 60 frames of 6 ms (${light.frames})`);
  assert.equal(lightOw.frames, 18, `the view up: 18 frames of 20 ms (${lightOw.frames})`);
  assert.ok(Math.round(light.fps) === 60 && Math.round(lightOw.fps) === 30, `60 a second down, 30 up (${light.fps.toFixed(1)}, ${lightOw.fps.toFixed(1)})`);
  const heavy = await buildFrames(180, 12, false), heavyOw = await buildFrames(180, 12, true);
  assert.ok(Math.round(heavy.fps) === 30 && Math.round(heavyOw.fps) === 30, `a 12 ms frame is at 30 a second either way (${heavy.fps.toFixed(1)}, ${heavyOw.fps.toFixed(1)})`);
  assert.ok(heavy.frames >= 3 * heavyOw.frames - 1, `and builds three times as fast under the view (${heavy.frames} frames -> ${heavyOw.frames})`);
});

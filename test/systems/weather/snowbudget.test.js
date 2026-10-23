// SNOW-BUDGET (2026-10-20, a player via the owner: "something about our weather system affecting fps"; bible/07-Rendering/
// Performance-Priority.md SNOW-BUDGET) - THE SNOW KEEPS ITS FRAME BUDGET. The snowpack's window (121 points) was
// integrated a whole step at a time whatever the budget (snowpack.js advance read its deadline between steps), every one
// of a frame's readers - the tick, the feet, the Snowfall mod's winter - ran a budget of its own, and the ground's slope
// was read for every grass blade whether snow lay there or not. Held here: a call keeps its deadline between a step's
// points and the packs are the ones one call makes; a frame's asks share one budget; the slope is read only under snow
// (since SNOW-FACE, never - the cover reads no slope).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnowpackLattice, SNOWPACK, yearOriginOf } from '../../../src/systems/weather/snowpack.js';
import { setAirGround } from '../../../src/systems/weather/airTemperature.js';
import { createSnowCoverHost, SNOW_COVER } from '../../../src/scenes/snowCoverHost.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';

const woods = () => CLIMATES.Woodlands;
/** late in the year (snow to lay), a point a step past its year's origin, and a 3 x 3 window of the lattice */
const T = (406 * 360 + 360 - 20) * 1440 + 600;
const windowOf = (lat) => { const pts = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pts.push(lat.point(50 + i, 60 + j, T)); return pts; };

test('SNOW-BUDGET the lattice keeps its deadline between a step\'s points: a call that runs out leaves the step part-way, the rest carry on in the next, and the packs are the ones one call makes - a step\'s rest that can lay no snow is skipped as any quiet step is (mutants: the deadline read only between steps)', () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: (px) => 200 + (px % 7) * 90 });
  try {
    const whole = new SnowpackLattice({ climateAt: woods }), sliced = new SnowpackLattice({ climateAt: woods });
    const a = windowOf(whole), b = windowOf(sliced);
    assert.equal(whole.advance(a, T), true);
    let tick = 0, calls = 0, partway = 0;
    const clock = () => tick++;   // a clock a tick an ask: a budget of 2 is a point or two
    while (!sliced.advance(b, T, 2, clock)) { calls++; if (sliced._partial !== null) partway++; assert.ok(calls < 1e6, 'it goes on'); }
    assert.ok(calls > 9, `in ${calls} calls`);
    assert.ok(partway > 0, 'steps left part-way at the deadline');
    for (let k = 0; k < a.length; k++) {
      assert.deepEqual([...b[k].swe], [...a[k].swe], `point ${k}: its pack the one call's`);
      assert.deepEqual([...b[k].prev], [...a[k].prev], `point ${k}: its step before too`);
      assert.equal(b[k].step, a[k].step);
    }
    assert.ok(a.some((p) => p.swe.some((v) => v > 0)), 'a winter laid snow to compare');
  } finally { setAirGround(null); }
});

test('SNOW-BUDGET a spent budget costs a point, never a step: calls with no budget still go on to the end (a build\'s wait with no slice left), and one that lays a step moves two of its points at the most (mutants: a whole step a call whatever the budget)', () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const lat = new SnowpackLattice({ climateAt: woods });
    const pts = windowOf(lat);
    const marks = () => pts.map((p) => `${p.step}/${p.spin?.step}`);
    let laid = 0, done = false;
    for (let i = 0; i < 1e5 && !done; i++) {
      const before = marks(), skipped = lat.stepsSkipped;
      done = lat.advance(pts, T, 0);
      const moved = marks().filter((m, k) => m !== before[k]).length;
      if (lat.stepsSkipped === skipped && moved > 0) { laid++; assert.ok(moved <= 2, `a laying step with no budget moved ${moved} points`); }
    }
    assert.ok(done, 'the window stands at the end');
    assert.ok(laid > 0, 'laying steps met with no budget');
  } finally { setAirGround(null); }
});

/** A snow cover host over Woodlands at event minute `t`: its frame clock (performance.now's stand-in) runs `step` ms an
 *  ask and counts them. */
function coverHost(t, { step = 0, place = () => ({ px: 200, py: 100 }) } = {}) {
  const clock = { ms: 0, asks: 0 };
  const state = { compensation: [0, 0, 0], mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 }, pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * 819.2; out[1] = 0; out[2] = -(py - 100) * 819.2; return out; } };
  const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: woods, mapHeight: 500, stateOf: () => state, builtOf: () => new Map(),
    owns: () => true, markReskin: () => {}, markRebuild: () => {}, now: () => t, place,
    clock: () => { clock.asks++; return (clock.ms += step); } });
  return { host, clock };
}

test('SNOW-BUDGET a frame\'s asks share one budget: the tick spends the frame\'s, and the feet and the mod\'s winter after it in the same frame\'s time integrate a point each at the most, not a budget each; the next frame has its own (mutants: a budget a reader)', () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const { host, clock } = coverHost((406 * 360 + 330) * 1440, { step: 0.01 });
    host.tick({ px: 200, py: 100, dt: 0.016 });
    assert.equal(host.ready, false, 'a year to catch up: not in one frame');
    const tickAsks = clock.asks;
    assert.ok(tickAsks > 100, `the tick spent the frame's 3 ms (${tickAsks} asks of 0.01)`);
    assert.ok(clock.ms < SNOW_COVER.frameMs, 'still the tick\'s frame');
    const before = clock.asks;
    // AUDIT SNOW-BUDGET F4: at the tick's own pixel (200, 100) - [10, 0, -10] stood in (200, 101), another lattice centre,
    // so the readers moved the window and the count was a move's, not a spent frame's
    for (let k = 0; k < 3; k++) host.winterAt([10, 0, 10], false);
    host.winterNear(false);
    const readers = clock.asks - before;
    assert.ok(readers < 60, `four readers after a spent frame: ${readers} asks - a point each, never a budget each`);
    clock.ms += SNOW_COVER.frameMs;   // the next frame
    const next = clock.asks;
    host.tick({ px: 200, py: 100, dt: 0.016 });
    assert.ok(clock.asks - next > 100, 'the next frame\'s tick spends a budget of its own');
  } finally { setAirGround(null); }
});

// PIN MOVED (SNOW-FACE, FIELD BUGS 2026-10-21): the ground's cover reads no slope (render/snowCoverGlsl.js SNOW_GROUND), so
// what SNOW-BUDGET held to the snow alone - the stream's heights, four a blade - the host asks never: it takes no
// `heightAt` (AUDIT FB1021 L1-8: a counter handed to it could only fail if the dependency came back, so it is gone).
test('SNOW-BUDGET the grass and the feet answer from the drawn cover alone - no snow, no blade buried and no white underfoot; a full cover, every blade and the feet (SNOW-FACE: the cover reads no slope, so the host asks the stream nothing)', async () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const { host } = coverHost((406 * 360 + 215) * 1440);
    await host.settle({ left: () => Infinity, breathe: async () => {} });
    const p = { px: 200, py: 100 };
    for (let k = 0; k < 50; k++) assert.equal(host.buries(p, 100 + k, 200, 10), false);
    assert.equal(host.winterAt([5, 10, -5], false), false);
    // the lines laid down to the valley: the cover full
    for (const l of host._lines.values()) { l.shown = Float32Array.of(-500, -400, -300); l.target = Float32Array.from(l.shown); }
    assert.equal(host.winterAt([5, 10, -5], false), true, 'white under the feet');
    let buried = 0;
    for (let k = 0; k < 50; k++) buried += host.buries(p, 100 + k, 200, 10) ? 1 : 0;
    assert.equal(buried, 50, 'every blade under a full cover');
  } finally { setAirGround(null); }
});

test('AUDIT SNOW-BUDGET F1: a step the deadline cuts part-way is stepped whole - its rest never judged quiet on its own - so a budget of a point a call keeps step with one unbudgeted lattice, pack for pack, `prev` and all, and counts the same steps (mutants: the rest judged again)', () => {
  // the audit's own case (scratchpad lockstep.mjs): Woodlands over a ramp of ground, a 4 x 4 window; the budgeted lattice
  // kept a melted point's old `prev` at the step 541 of its snow year, where the rest of a cut step was all bare and warm
  const topAt = (px) => 100 + (px % 11) * 150;
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt });
  try {
    const T0 = (406 * 360 + 300) * 1440, origin = yearOriginOf(T0), S = SNOWPACK.stepMinutes;
    const mk = () => { const lat = new SnowpackLattice({ climateAt: woods }); const pts = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) pts.push(lat.point(50 + i, 60 + j, origin)); return { lat, pts }; };
    const A = mk(), B = mk();
    let tick = 0;
    const clock = () => tick++;
    for (let k = 0; k <= 560; k++) {
      const t = origin + k * S;
      A.lat.advance(A.pts, t);
      let calls = 0;
      while (!B.lat.advance(B.pts, t, 1, clock)) assert.ok(++calls < 1e6, 'it goes on');
      for (let q = 0; q < A.pts.length; q++) {
        const a = A.pts[q], b = B.pts[q];
        assert.equal(b.step, a.step, `step ${k}, point ${q}`);
        for (let m = 0; m < a.n; m++) {
          assert.ok(Object.is(b.swe[m], a.swe[m]) && Object.is(b.prev[m], a.prev[m]), `step ${k}, point ${q}, level ${m}: swe ${b.swe[m]}/${a.swe[m]}, prev ${b.prev[m]}/${a.prev[m]}`);
        }
      }
    }
    assert.deepEqual([B.lat.stepsRun, B.lat.stepsSkipped], [A.lat.stepsRun, A.lat.stepsSkipped], 'the same steps run and skipped');
    assert.equal(B.lat._partial, null, 'none left part-way');
  } finally { setAirGround(null); }
});

test('AUDIT SNOW-BUDGET F2: across a move of the window - a lattice cell, two pixels walked - the frame draws the lines it kept while it catches up, and the Snowfall mod\'s winter answers from them, never the calendar\'s; a window with nothing kept (the first, a jump) draws none (mutants: the frame or the winter gated on a read at the clock\'s minute)', async () => {
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const t = (406 * 360 + 330) * 1440;
    const at = { px: 200, py: 100 };
    const { host, clock } = coverHost(t, { step: 0.01, place: () => at });   // a frame's budget that runs out; the player where the test walks them
    assert.equal(host.frame(), null, 'nothing read: nothing drawn');
    await host.settle({ left: () => Infinity, breathe: async () => {} });
    for (const l of host._lines.values()) { l.shown = Float32Array.of(-500, -400, -300); l.target = Float32Array.from(l.shown); }   // snow to the valley
    assert.ok(host.frame(), 'read: drawn');
    assert.equal(host.winterNear(false), true, 'winter about the player');
    clock.ms += SNOW_COVER.frameMs;   // the next frame
    at.px = 202;
    host.tick({ px: 202, py: 100, dt: 0.016 });   // a lattice cell east: the window moves, and the new edge's year is not one frame's
    assert.equal(host.ready, false, 'catching up');
    const f = host.frame();
    assert.ok(f, 'still drawn - the kept lines');
    assert.ok(f.lines.some((v, i) => i % 4 === 0 && v === -500), 'the snow it kept, in its new place');
    assert.equal(host.winterNear(false), true, 'the winter it kept, not the calendar\'s (false)');
    clock.ms += SNOW_COVER.frameMs;
    at.px = 400; at.py = 300;
    host.tick({ px: 400, py: 300, dt: 0.016 });   // a jump: nothing kept
    assert.equal(host.frame(), null, 'nothing kept: nothing drawn');
    assert.equal(host.winterNear(false), false, 'and the calendar\'s word');
  } finally { setAirGround(null); }
});

test('SNOW-BUDGET the numbers: a frame\'s time is SNOW_COVER.frameMs, and the snow\'s step is the snowpack\'s three hours', () => {
  assert.equal(SNOW_COVER.budgetMs, 3);
  assert.ok(SNOW_COVER.frameMs > 0 && SNOW_COVER.frameMs < 17, 'under a 60 Hz frame');
  assert.equal(SNOWPACK.stepMinutes, 180);
});

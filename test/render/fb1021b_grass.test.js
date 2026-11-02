// FIELD BUGS 2026-10-21c row 6 (FB1021B) - "grass streaming 11-24%" of a player's CPU profile of the main thread. The
// steady walk was under its budget already (PERF-EXT22: a rim cell a slice a frame); the catch-up was not measured
// on the move. tools/grassMoveProbe.mjs measured it: a slice a frame is a cell every five frames, so the rim kept the
// FRAME RATE's pace while its cells arrive at the eye's - and at 20 fps a DFU ride fell more than eight cells behind on
// 13% of its frames (a gallop 25%, a run and a cart 5%), each of them two whole cells. The rim is paced to the eye now
// (a deadline a cell, GRASS_DUE_AT), a birth inside the frame's time (GRASS_FRAME_MS on the field's own clock), and
// what a step leaves behind waits for the rest. bible/07-Rendering/Performance-Exterior.md FB1021B.
// AUDIT FB1021B (the same record's section; FIELD BUGS 2026-10-21c): a cell due now had turned the deadlines off, and
// a slow machine born on the move never recovered - the pace is spent first now, and the cells due now take the
// frame's time past it.
//
// On the real createGrassField - and on the real LabGrassRenderer, its packs written into a GL that answers and counts
// (test/world/terrain/grassshift.test.js's) - over a world where every candidate stands (the dearest cell there is).
// The clock is the field's own seam: it advances by the candidates asked (and a pack's worth for a write), so a frame's
// time is a count the pins can state exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../src/render/labGrass.js';   // a namespace, so a seam that is missing fails ITS pin and not the file
import { CLASSIC_TO_UNITY_RATIO, DF_WALK_BASE } from '../../src/player/motor.js';
import { DF_RIDE_BASE } from '../../src/systems/transport.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const perCell = G.grassPerCell();
const CELL = G.GRASS_CELL, RANGE = G.LAB_GRASS.range;
const dueR = RANGE * G.GRASS_DUE_AT, wholeR = RANGE * G.GRASS_WHOLE_AT;

/** A WebGL2 that answers what LabGrassRenderer's constructor asks and swallows the rest. */
const quietGl = () => new Proxy({}, {
  get(_, k) {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({});
    if (k === 'isEnabled') return () => false;
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  },
});

/** The clock and the counts: `unit` of the clock per candidate asked, `pack` per cell written. */
function bench({ unit = 1, pack = 0, real = false } = {}) {
  const b = { t: 0, keeps: 0, writes: [] };
  b.clock = () => b.t;
  b.keep = () => { b.keeps++; b.t += unit; return 0; };
  const R = real ? new G.LabGrassRenderer(quietGl()) : { allocSlots() {}, clearSlot() {}, shiftSlots() {}, writeSlot() {} };
  const write = R.writeSlot.bind(R);
  R.writeSlot = (slot, placed) => { b.writes.push(placed.count); b.t += pack; write(slot, placed); };
  b.R = R;
  /** one frame: the candidates asked and the cells written */
  b.frame = (field, ex, ez) => { b.keeps = 0; b.writes.length = 0; const missing = field.update(ex, ez, b.keep); return { keeps: b.keeps, writes: b.writes.length, missing }; };
  return b;
}

/** the field's grid origin rides its shifts; `o` is what the test shifted it by */
const nearest = (cx, cz, ex, ez, o = [0, 0]) => Math.hypot(Math.max(cx * CELL + o[0] - ex, 0, ex - ((cx + 1) * CELL + o[0])), Math.max(cz * CELL + o[1] - ez, 0, ez - ((cz + 1) * CELL + o[1])));
/** the cells inside GRASS_DUE_AT of the range that stand unplaced - where the fade leaves a blade an eighth of itself and more */
function holes(field, ex, ez, o = [0, 0]) {
  const k = Math.ceil(dueR / CELL) + 1, ecx = Math.floor((ex - o[0]) / CELL), ecz = Math.floor((ez - o[1]) / CELL);
  let n = 0;
  for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx <= ecx + k; cx++) if (nearest(cx, cz, ex, ez, o) <= dueR && !field.live.has(G.cellKey(cx, cz))) n++;
  return n;
}
const settle = (b, field, ex, ez) => { for (let f = 0; f < 3000; f++) if (b.frame(field, ex, ez).missing === 0) return f; throw new Error('never settled'); };

test('FB1021B: the deadline, the frame\'s time and the step - their values, and the count switch gone (mutants: each value)', () => {
  assert.equal(G.GRASS_DUE_AT, 0.9);
  // the reason for 0.9: the lab shader's fade (`smoothstep(uRange*0.55, uRange, d)`) leaves a blade there an eighth of itself
  const m = /smoothstep\(uRange\*([0-9.]+), uRange, d\)/.exec(G.LAB_GRASS_VS);
  const t = (G.GRASS_DUE_AT - Number(m[1])) / (1 - Number(m[1])), alpha = 1 - t * t * (3 - 2 * t);
  assert.ok(alpha > 0.12 && alpha < 0.13, `a blade at the deadline draws ${alpha.toFixed(3)} of itself`);
  assert.equal(G.GRASS_FRAME_MS, 3);
  assert.equal(G.GRASS_STEP, 250);
  assert.equal(G.GRASS_SLICE, 1500, 'PERF-EXT22\'s slice stands');
  assert.equal(G.GRASS_CATCH_UP, undefined, 'no count says catch-up: a ride is paced, a birth is timed');
});

test('FB1021B: a DFU ride at 20 fps is paced to the eye - no frame places a whole cell, and no cell inside GRASS_DUE_AT stands unplaced, across two crossings (mutants: the pace capped, the deadline\'s radius, its step, the min for the max, a crossing taken for a step)', () => {
  // GetBaseSpeed's riding arm at chargen's SPD 50 (systems/transport.js, player/motor.js): 10.76 m/s, a frame of 20 fps.
  // PERF-EXT22's field fell more than eight cells behind on 13% of these frames and placed two whole cells on each.
  const ride = (50 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO, step = ride / 20;
  assert.ok(Math.abs(ride - 10.76) < 0.01);
  const b = bench({ unit: 1 / 1024, pack: 3000 / 1024, real: true });   // a candidate ~1 us, a pack ~3 ms: this container's measure
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 600, ez = 700;
  const o = [0, 0];
  settle(b, field, ex, ez);
  let worst = 0, worstHoles = 0, placed = 0, crossings = 0;
  for (let f = 0; f < 700; f++) {
    ex += step * Math.cos(0.4); ez += step * Math.sin(0.4);   // east-north-east: both axes cross
    // the floating origin, as streamingWorld moves it: a pixel's width the other way, the field and the eye with it
    if (ex >= TERRAIN_SIZE) { field.shiftOrigin([-TERRAIN_SIZE, 0, 0]); ex -= TERRAIN_SIZE; o[0] -= TERRAIN_SIZE; crossings++; }
    if (ez >= TERRAIN_SIZE) { field.shiftOrigin([0, 0, -TERRAIN_SIZE]); ez -= TERRAIN_SIZE; o[1] -= TERRAIN_SIZE; crossings++; }
    worstHoles = Math.max(worstHoles, holes(field, ex, ez, o));   // before the frame's update: a cell must stand placed BEFORE the step brings it inside
    const r = b.frame(field, ex, ez);
    worst = Math.max(worst, r.keeps);
    placed += r.writes;
  }
  assert.equal(crossings, 2, 'the ride crossed east and north... and its field with it');
  assert.ok(placed > 150, `the ride brought the rim in (${placed} cells)`);
  assert.equal(worstHoles, 0, 'every cell was placed before the eye brought it inside GRASS_DUE_AT');
  assert.ok(worst < perCell, `no frame placed a whole cell's candidates (worst ${worst} of ${perCell}; PERF-EXT22's catch-up placed ${2 * perCell})`);
  assert.ok(worst > G.GRASS_SLICE, `and the slice alone could not keep up: the pace rose past it (${worst})`);
});

test('FB1021B: the pace counts the cell in progress - three cells straight ahead, 8 m from GRASS_DUE_AT, each stand placed before the step brings it inside, at the least pace that does (mutants: the cell in progress owes nothing, a deadline counted in fractions of a frame)', () => {
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;   // a strong gallop at 20 fps: 1.11 m a frame
  const b = bench({ unit: 1 / 256 });   // a slow machine: the frame's time a cell due now may take is 768 candidates - the deadlines alone must carry it
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 622;
  const ez = 615;
  settle(b, field, ex, ez);
  // the column at x 900-930: its near edge 278 m ahead - the eye's row and the two beside it
  for (const cz of [19, 20, 21]) field.invalidate(30 * CELL + 1, cz * CELL + 1, 30 * CELL + 2, cz * CELL + 2);
  assert.ok(Math.abs(nearest(30, 19, ex, ez) - 278.4) < 0.1);
  // the least pace that lands the three in time: at the first update they stand 6.2-6.6 steps from GRASS_DUE_AT, so 7
  // updates are left before the first hole read that could find them (this one among them) - their candidates over 7,
  // and not a candidate more
  const dues = [19, 20, 21].map((cz) => (nearest(30, cz, ex + step, ez) - dueR) / step);
  assert.ok(dues.every((d) => d > 6 && d < 7), `the deadlines in steps: ${dues.map((d) => d.toFixed(2))}`);
  let worst = 0;
  for (let f = 0; f < 20; f++) {
    ex += step;
    worst = Math.max(worst, holes(field, ex, ez));   // before the update: placed before the step brought it inside
    const r = b.frame(field, ex, ez);
    if (f === 0) assert.equal(r.keeps, Math.ceil(3 * perCell / 7), 'the first frame: three cells\' candidates over the 7 updates left');
  }
  assert.equal(worst, 0, 'every one of the three stood placed before it came inside GRASS_DUE_AT');
  for (const cz of [19, 20, 21]) assert.ok(field.live.has(G.cellKey(30, cz)));
});

test('FB1021B: a walk that keeps up is PERF-EXT22\'s walk to the candidate - one slice of one cell a frame, its tail on the frame it ends, nothing more (mutants: the slice, the deadline\'s pace past it)', () => {
  const walk = (50 + DF_WALK_BASE - 0.5 * (100 - 50)) / CLASSIC_TO_UNITY_RATIO, step = walk / 60;   // GetWalkSpeed at SPD 50: 4.43 m/s
  const b = bench({ unit: 1 / 1024, pack: 3000 / 1024 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 600;
  settle(b, field, ex, 420);
  const tail = perCell % G.GRASS_SLICE, seen = new Set();
  let cells = 0;
  for (let f = 0; f < 1200; f++) {
    ex += step;
    const r = b.frame(field, ex, 420);
    seen.add(r.keeps);
    cells += r.writes;
    assert.ok(r.writes <= 1, 'a cell a frame at most');
  }
  assert.ok(cells > 30, `the walk brought cells in (${cells})`);
  assert.deepEqual([...seen].sort((x, y) => x - y), [0, tail, G.GRASS_SLICE], 'a frame asks a slice, a cell\'s tail, or nothing');
});

test('FB1021B: a birth is timed - the first whole cell of a frame always, the next while it fits at the last one\'s measured cost, and the band due now GRASS_STEP candidates at a time until the frame\'s time is spent (mutants: the first not always, a cost guessed before it is measured, the fit\'s bound, the time\'s check, the step)', () => {
  // a frame of one cell's time: one whole cell a frame through the inner disc, its candidates and no more
  {
    const F = perCell;
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: F });
    let inner = 0;
    for (let f = 0; f < 400; f++) {
      const before = new Set(field.live.keys());
      const r = b.frame(field, 409.6, 409.6);
      const wrote = [...field.live.values()].filter((h) => !before.has(G.cellKey(h.cx, h.cz)));
      if (!wrote.length || nearest(wrote[0].cx, wrote[0].cz, 409.6, 409.6) > wholeR) break;
      inner++;
      assert.equal(r.writes, 1, `frame ${f}: one whole cell - a second would not fit`);
      assert.equal(r.keeps, perCell, `frame ${f}: and nothing else - no slice past it, the time is spent`);
    }
    assert.ok(inner > 100, `the inner disc came a cell a frame (${inner})`);
    // the band due now: a slice, then GRASS_STEP at a time until the clock reaches the frame's time - and a frame
    // whose steps land on it exactly (the last cell's tail, then whole steps: 122 + 24 x 250) stops there
    for (let f = 0; f < 20; f++) {
      const r = b.frame(field, 409.6, 409.6);
      assert.ok(r.keeps >= F && r.keeps < F + G.GRASS_STEP, `band frame ${f}: the frame's time and less than a step past it (${r.keeps})`);
      if (f > 0) assert.equal(r.keeps, F, `band frame ${f}: its steps landed on the frame's time, and it stopped`);
    }
  }
  // the default frame is GRASS_FRAME_MS: at a candidate ~1 us, a cell ~6 ms - one a frame - and the band's frames 3 ms
  {
    const b = bench({ unit: 1 / 1024 });
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
    const F = G.GRASS_FRAME_MS * 1024;
    let band = 0;
    for (let f = 0; f < 400 && band < 10; f++) {
      const r = b.frame(field, 409.6, 409.6);
      if (r.keeps === perCell) { assert.equal(r.writes, 1); continue; }
      band++;
      assert.ok(r.keeps >= F && r.keeps < F + G.GRASS_STEP, `band frame: ${r.keeps} candidates, the default frame's`);
    }
    assert.equal(band, 10, 'the inner disc came a cell a frame, then the band by the frame\'s time');
  }
  // two cells' time: the first cell's measured cost fits the second exactly, and perFrame ends the frame there
  {
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: 2 * perCell });
    for (let f = 0; f < 3; f++) {
      const before = new Set(field.live.keys());
      const r = b.frame(field, 409.6, 409.6);
      const inner = [...field.live.values()].filter((h) => !before.has(G.cellKey(h.cx, h.cz)) && nearest(h.cx, h.cz, 409.6, 409.6) <= wholeR);
      assert.equal(inner.length, 2, `frame ${f}: two whole cells inside the fade's start`);
      assert.equal(r.keeps, 2 * perCell, `frame ${f}: and their candidates only`);
    }
  }
  // a standing birth writes every cell once: a cell placed whole is not begun again by the rim the same frame
  {
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: 1.5 * perCell });
    let writes = 0;
    for (let f = 0; f < 3000; f++) { const r = b.frame(field, 409.6, 409.6); writes += r.writes; if (r.missing === 0) break; }
    assert.equal(writes, field.live.size, `${writes} writes for ${field.live.size} cells`);
  }
  // AUDIT FB1021B F4: a whole cell's cost is its placement AND its pack - two cells' time less one pack fits one packed
  // cell, where one counted without its pack would fit a second
  {
    const P = 1000;
    const b = bench({ pack: P });
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: 2 * perCell + P, perFrame: 3 });
    for (let f = 0; f < 3; f++) {
      const before = new Set(field.live.keys());
      b.frame(field, 409.6, 409.6);
      const inner = [...field.live.values()].filter((h) => !before.has(G.cellKey(h.cx, h.cz)) && nearest(h.cx, h.cz, 409.6, 409.6) <= wholeR);
      assert.equal(inner.length, 1, `frame ${f}: one whole cell - its pack is its cost too`);
    }
  }
  // three cells' time and perFrame 3: the second's cost measured on its own, not with the first's
  {
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: 3 * perCell, perFrame: 3 });
    for (let f = 0; f < 3; f++) {
      const before = new Set(field.live.keys());
      b.frame(field, 409.6, 409.6);
      const inner = [...field.live.values()].filter((h) => !before.has(G.cellKey(h.cx, h.cz)) && nearest(h.cx, h.cz, 409.6, 409.6) <= wholeR);
      assert.equal(inner.length, 3, `frame ${f}: three whole cells inside the fade's start`);
    }
  }
  // a clock that stands still - the work in no time: perFrame alone ends the frame
  {
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: () => 0 });
    for (let f = 0; f < 3; f++) assert.equal(b.frame(field, 409.6, 409.6).writes, 2, `frame ${f}: perFrame's two`);
  }
  // a clock already past the frame's time when the frame begins: the first comes all the same, and only it
  {
    let tick = 0;
    const b = bench();
    const field = G.createGrassField(b.R, { keep: b.keep, clock: () => ++tick, frameMs: 0 });
    for (let f = 0; f < 3; f++) assert.equal(b.frame(field, 409.6, 409.6).writes, 1, `frame ${f}: the first whole cell always`);
  }
  // the game's clock is the page's: on it a frame of a ten-thousandth of a millisecond fits no second cell. Each candidate
  // holds that clock 2 us, so a cell is 12 ms of it - past the share's 9 ms however long the frame before ran (a cell at
  // its own pace fitted the share of a frame a pause had stretched: once in four runs of four at once, under load)
  {
    const b = bench(), count = b.keep;
    b.keep = () => { const t = performance.now(); while (performance.now() - t < 0.002); return count(); };
    const field = G.createGrassField(b.R, { keep: b.keep, frameMs: 1e-4 });
    b.frame(field, 409.6, 409.6);
    assert.equal(b.frame(field, 409.6, 409.6).writes, 1, 'measured on performance.now()');
  }
});

test('FB1021B: a birth takes its share of the frame - 3 ms of a 60 Hz frame, 6 of a 30 fps one, 9 at most however long a hitch (mutants: the share, its cap, the frame unmeasured, the floor)', () => {
  assert.equal(G.GRASS_FRAME_SHARE, 0.18, 'the 60 Hz frame\'s 3 ms, as a share');
  assert.equal(G.GRASS_FRAME_GAP_MS, 50, 'a 20 fps frame');
  for (const [gapMs, wantMs] of [[1000 / 60, 3], [1000 / 30, 6], [200, 9], [1000 / 144, 3]]) {
    const b = bench({ unit: 1 / 1024 });   // a candidate ~1 us: a whole cell ~6 ms
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
    let band = 0, full = 0;
    for (let f = 0; f < 600 && band < 8; f++) {
      b.t = Math.max(b.t, f * gapMs);   // the frames begin a gap apart (the rest of the frame is the game's)
      const r = b.frame(field, 409.6, 409.6);
      if (f === 0 || r.keeps === perCell) continue;   // the first frame measures none; the inner disc a cell a frame
      band++;
      const want = wantMs * 1024;
      assert.ok(r.keeps < want + G.GRASS_STEP + 1, `a ${gapMs.toFixed(1)} ms frame: the band took ${(r.keeps / 1024).toFixed(2)} ms, the share's ${wantMs}`);
      assert.ok(r.keeps >= want - 1e-6 || r.writes === 2, `a ${gapMs.toFixed(1)} ms frame: short of its share (${(r.keeps / 1024).toFixed(2)} ms) only when perFrame ended it`);
      if (r.keeps >= want - 1e-6) full++;
    }
    assert.ok(band === 8 && full >= 4, `the band's frames spent the share (${full} of ${band})`);
  }
});

test('FB1021B: a frame a whole cell took runs no rim slice - the cell in progress waits, unless a deadline asks (mutant: the slice always)', () => {
  const b = bench();
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: perCell - 1 });
  let ex = 600;
  settle(b, field, ex, 420);
  for (let f = 0; f < 600 && !field.pending; f++) { ex += 0.074; b.frame(field, ex, 420); }
  const p = field.pending;
  assert.ok(p, 'a walk begins a rim cell');
  const i = p.st.i;
  field.invalidate(ex - 0.5, 421, ex + 0.5, 423);   // the eye's own cell re-read, and no other
  const r = b.frame(field, ex, 420);   // the eye stood: no deadline asks anything
  assert.equal(r.writes, 1, 'the cell under the eye comes back whole');
  assert.equal(field.pending, p, 'the rim cell is still the one in progress');
  assert.equal(p.st.i, i, 'and the frame the whole cell took gave it no slice');
  b.frame(field, ex, 420);
  assert.equal(p.st.i, i + G.GRASS_SLICE, 'the next frame gives it its slice');
});

test('FB1021B: a birth on the move fills the way the eye is going - nothing past the fade\'s start that the step leaves behind is placed while anything else waits, and the hysteresis takes most of it unplaced (mutants: the behind unread, the sort, the sign, the fade\'s start)', () => {
  const gallop = ((50 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 30 / 200), step = gallop / 60;   // GetRunSpeed's ride: 16.1 m/s
  const b = bench({ unit: 1 / 1024, pack: 3000 / 1024 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 400;
  const behindNow = (h, x) => nearest(h.cx, h.cz, x, 420) > wholeR && Math.min(Math.max(x, h.cx * CELL), (h.cx + 1) * CELL) - x < 0;
  let wroteBehind = 0, neverPlaced = 0;
  const seenBehind = new Set(), placedBehind = new Set();
  for (let f = 0; f < 1500; f++) {
    ex += step;
    const before = new Set(field.live.keys()), was = field.pending?.key;   // the cell in progress goes on first, wherever it now stands
    // the cells the step does not leave behind, in range and waiting, when the frame begins
    const k = Math.ceil(RANGE / CELL) + 1, ecx = Math.floor(ex / CELL), ecz = Math.floor(420 / CELL);
    const waiting = [];
    for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx <= ecx + k; cx++) {
      if (nearest(cx, cz, ex, 420) > RANGE || before.has(G.cellKey(cx, cz))) continue;
      const h = { cx, cz };
      if (behindNow(h, ex)) seenBehind.add(G.cellKey(cx, cz));
      else waiting.push(G.cellKey(cx, cz));
    }
    b.frame(field, ex, 420);
    const wrote = [...field.live.values()].filter((h) => !before.has(G.cellKey(h.cx, h.cz)));
    for (const h of wrote) if (seenBehind.has(G.cellKey(h.cx, h.cz))) placedBehind.add(G.cellKey(h.cx, h.cz));
    // the cells begun this frame: written whole or in one go, or left in progress - never the one carried in
    const begun = [...wrote, ...(field.pending ? [field.pending] : [])].filter((h) => G.cellKey(h.cx, h.cz) !== was);
    for (const h of begun) {
      if (!behindNow(h, ex)) continue;
      wroteBehind++;
      assert.deepEqual(waiting.filter((key) => !field.live.has(key)), [], `frame ${f}: a cell left behind was begun while cells ahead still waited`);
    }
    if (f === 400) {   // the disc inside the fade's start, behind the eye as much as ahead, came whole meanwhile
      const kk = Math.ceil(wholeR / CELL) + 1, gcx = Math.floor(ex / CELL), gcz = Math.floor(420 / CELL);
      let inner = 0;
      for (let cz = gcz - kk; cz <= gcz + kk; cz++) for (let cx = gcx - kk; cx <= gcx + kk; cx++) if (nearest(cx, cz, ex, 420) <= wholeR - CELL && !field.live.has(G.cellKey(cx, cz))) inner++;
      assert.equal(inner, 0, 'the inner disc stands whole by frame 400');
    }
  }
  neverPlaced = seenBehind.size - placedBehind.size;
  assert.equal(holes(field, ex, 420), 0, 'the birth is done');
  assert.ok(seenBehind.size > 40 && neverPlaced > seenBehind.size / 2, `the hysteresis took most of what the step left behind unplaced (${neverPlaced} of ${seenBehind.size}; ${wroteBehind} begun)`);
});

test('FB1021B: what the step leaves behind is never due - a band of cells behind a walk, past GRASS_DUE_AT, comes back a slice a frame, however soon a step could bring it in (mutant: due as if ahead)', () => {
  const b = bench({ unit: 1 / 1024 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 615;
  settle(b, field, ex, 615);
  for (let f = 0; f < 3; f++) { ex += 0.074; b.frame(field, ex, 615); }
  assert.equal(field.pending, null);
  // every cell west of the eye's column whose nearest point stands just past GRASS_DUE_AT: due within 28 frames,
  // were the ride below coming at it
  let n = 0;
  const k = Math.ceil(RANGE / CELL) + 1, ecx = Math.floor(ex / CELL), ecz = Math.floor(615 / CELL);
  for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx < ecx; cx++) {
    const d = nearest(cx, cz, ex, 615);
    if (d > dueR + 0.5 && d < dueR + 15) { field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2); n++; }
  }
  assert.ok(n >= 6, `the band behind (${n} cells)`);
  const ride = (50 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO / 20;   // and the walk becomes a ride at 20 fps: 0.54 m a frame
  for (let f = 0; f < 20; f++) {
    ex += ride;
    const r = b.frame(field, ex, 615);
    assert.ok(r.keeps <= G.GRASS_SLICE, `frame ${f}: a slice at most for what the walk leaves (${r.keeps})`);
  }
});

test('FB1021B: a crossing is no step - the eye moves with the scene, so a cell the walk left behind gets the walk\'s slice on the crossing frame and no more (mutants: the eye left where the old frame had it, on either axis)', () => {
  // the walk east (then north); a cell behind it, past GRASS_DUE_AT, re-read: on the walk's own step it is behind and
  // not due - one slice a frame. Taken for a step, a shift would be a jump of two pixels the other way: the cell
  // ahead of it, due within the frame, and the frame's whole time spent on it.
  for (const [off, dir] of [[[-TERRAIN_SIZE, 0, 0], [1, 0]], [[0, 0, -TERRAIN_SIZE], [0, 1]]]) {
    const b = bench({ unit: 1 / 1024 });   // a frame's time is 3,072 candidates: a slice and twice as many again
    const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
    let ex = 615, ez = 615;   // mid-cell: a cell behind stands 285 m off
    settle(b, field, ex, ez);
    for (let f = 0; f < 3; f++) { ex += dir[0] * 0.074; ez += dir[1] * 0.074; b.frame(field, ex, ez); }
    assert.equal(field.pending, null, 'nothing in progress');
    // the cell straight behind the walk whose nearest point stands between GRASS_DUE_AT and the range
    let back = null;
    for (let k = 7; k <= 11 && !back; k++) {
      const cx = Math.floor(ex / CELL) - k * dir[0], cz = Math.floor(ez / CELL) - k * dir[1];
      const d = nearest(cx, cz, ex, ez);
      if (d > dueR + 3 && d < RANGE - 3) back = { cx, cz, d };
    }
    assert.ok(back, 'the fixture has a cell behind the walk past GRASS_DUE_AT');
    field.invalidate(back.cx * CELL + 1, back.cz * CELL + 1, back.cx * CELL + 2, back.cz * CELL + 2);
    field.shiftOrigin(off); ex += off[0]; ez += off[2];
    ex += dir[0] * 0.074; ez += dir[1] * 0.074;
    const r = b.frame(field, ex, ez);
    assert.equal(r.keeps, G.GRASS_SLICE, `${off}: the crossing frame gave the cell behind (${back.d.toFixed(0)} m) its slice and no more`);
    assert.ok(field.pending && field.pending.cx === back.cx && field.pending.cz === back.cz, 'and it is the cell in progress');
  }
});

test('FB1021B: a field with too few slots begins no cell it cannot write (AUDIT PERF10 F1\'s seam) (mutant: begun all the same)', () => {
  const b = bench();
  const full = G.discSlotCount(CELL * 4, CELL);
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, span: CELL * 4, range: CELL * 4, slots: full - 8, frameMs: Infinity, perFrame: 1e9 });
  for (let f = 0; f < 50; f++) b.frame(field, 7.3, 21.9);
  const r = b.frame(field, 7.3, 21.9);
  assert.ok(r.missing > 0, 'the fixture is starved');
  assert.equal(r.keeps, 0, 'a standing field asks nothing for cells no slot can take');
  assert.equal(field.pending, null);
  assert.equal(field.live.size, field.slots, 'every slot holds a cell');
  // a walk on it: the slot a cell would take is asked before it is begun, and asking takes nothing
  let ex = 7.3;
  for (let f = 0; f < 120; f++) { ex += CELL / 8; b.frame(field, ex, 21.9); }
  for (let f = 0; f < 60; f++) b.frame(field, ex, 21.9);
  assert.equal(field.live.size, field.slots, 'every slot still holds a cell - none was let go to a question');
});

/** AUDIT FB1021B F1: a ride on the bench's slow machine - a candidate 1/256 ms, so the frame's time at 20 fps (9 ms) is
 *  2,304 candidates, about what a DFU ride brings in - at `step` metres a 20 fps frame: born on the move (the jungle
 *  floor's re-made meadow on a ride, an Overworld journey's end), or settled first with a band cell `behindAt` metres
 *  behind the eye re-read. Holes are read before each update; a cell seen unplaced past GRASS_DUE_AT and then unplaced
 *  inside it crossed. */
function slowRide(step, { born = true, behindAt = 0, frames = 1200 } = {}) {
  const b = bench({ unit: 1 / 256 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 615, f = 0;
  const ez = 615;
  const tick = () => { b.t = Math.max(b.t, f++ * 50); return b.frame(field, ex, ez); };   // the frames begin 50 ms apart
  if (!born) {
    for (let i = 0; i < 4000; i++) if (tick().missing === 0) break;
    for (let i = 0; i < 5; i++) { ex += step; tick(); }
    const cx = Math.floor((ex - behindAt) / CELL), cz = Math.floor(ez / CELL);
    field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2);
  }
  const past = new Set();
  let holed = 0, last = -1, crossed = 0, most = 0;
  for (let i = 0; i < frames; i++) {
    ex += step;
    const k = Math.ceil(RANGE / CELL) + 1, ecx = Math.floor(ex / CELL), ecz = Math.floor(ez / CELL);
    let n = 0;
    for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx <= ecx + k; cx++) {
      const key = G.cellKey(cx, cz), d = nearest(cx, cz, ex, ez);
      if (field.live.has(key)) { past.delete(key); continue; }
      if (d > dueR) { if (d <= RANGE) past.add(key); continue; }
      n++;
      if (past.delete(key)) crossed++;
    }
    if (n) { holed++; last = i; }
    most = Math.max(most, n);
    tick();
  }
  return { holed, last, crossed, most };
}

test('AUDIT FB1021B F1: a cell due now no longer turns the deadlines off - on a slow machine a 20 fps ride born on the move lets no cell cross GRASS_DUE_AT unplaced and stands whole inside it in the frames a standing birth takes (mutants: the time instead of the pace, the cells due now first, the pace paid out of the frame\'s time)', () => {
  const ride = (50 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO / 20;   // 0.54 m a frame
  const standing = slowRide(0), born = slowRide(ride);
  assert.ok(standing.last > 400 && standing.crossed === 0, `a standing birth on this machine: whole inside GRASS_DUE_AT after ${standing.last + 1} frames`);
  // before: 342 cells crossed unplaced, and a hole stood until frame 1,006
  assert.equal(born.crossed, 0, 'no cell with a deadline crossed GRASS_DUE_AT unplaced');
  assert.ok(born.last < standing.last + 60, `whole inside GRASS_DUE_AT after ${born.last + 1} frames - a standing birth's ${standing.last + 1}, and 3 s more at most`);
});

test('AUDIT FB1021B F1: a band cell re-read behind a strong gallop on a slow machine is the only hole - the ride ahead keeps its deadlines while it waits, and it goes past GRASS_DUE_AT unplaced (mutant: the time instead of the pace)', () => {
  const strong = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;   // 1.11 m a frame
  const r = slowRide(strong, { born: false, behindAt: 200, frames: 600 });
  // before: the cell kept a cell due now, the frame's time placed less than the gallop brought in, and the cells ahead
  // came due now one after another - 801 crossed unplaced, a hole on every frame of the 60 s
  assert.equal(r.crossed, 0, 'no cell with a deadline crossed GRASS_DUE_AT unplaced');
  assert.equal(r.most, 1, 'the cell behind was the only hole');
  assert.ok(r.last > 40 && r.last < 100, `and it stood until the gallop left it past GRASS_DUE_AT (frame ${r.last})`);
});

test('AUDIT FB1021B F1: with a cell due now on the move, a frame takes the deadlines\' pace and its own time past it - the pace\'s steps past the slice are not the frame\'s time\'s, the slice is (mutants: the pace paid out of the frame\'s time, the slice taken off it, the last step only)', () => {
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;   // a strong gallop at 20 fps
  const F = 3000, b = bench();   // a candidate a unit of the clock: the frame's time is 3,000 candidates
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: F });
  let ex = 622;
  const ez = 615;
  settle(b, field, ex, ez);
  // the three cells 8 m from GRASS_DUE_AT straight ahead (the pace counts the cell in progress, above) - and a cell beside
  // the eye at 195 m, inside GRASS_DUE_AT: due now
  for (const cz of [19, 20, 21]) field.invalidate(30 * CELL + 1, cz * CELL + 1, 30 * CELL + 2, cz * CELL + 2);
  field.invalidate(20 * CELL + 1, 27 * CELL + 1, 20 * CELL + 2, 27 * CELL + 2);
  ex += step;
  assert.ok(Math.abs(nearest(20, 27, ex, ez) - 195) < 0.1);
  // the pace: three cells over the 7 updates left, met by the slice and five steps past it; then the frame's time
  // past those five steps
  const need = 3 * perCell / 7, paced = Math.ceil((need - G.GRASS_SLICE) / G.GRASS_STEP) * G.GRASS_STEP;
  const r = b.frame(field, ex, ez);
  assert.equal(r.keeps, F + paced, `the slice and the frame's time (${F}), and the pace past the slice on top (${paced})`);
});

test('AUDIT FB1021B F1: a band cell re-read behind a gallop is due now all the same - the frame\'s time past the pace places it once what stands ahead is placed, before the gallop leaves it past GRASS_DUE_AT (mutant: only a cell ahead is due now)', () => {
  // a strong gallop at 20 fps on a machine whose frame's time is more than the gallop brings in (a candidate ~1 us): the
  // pace alone never reaches the cell - the rim ahead always has a cell waiting its deadline - the time past it does
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;
  const b = bench({ unit: 1 / 1024 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 615;
  const ez = 615;
  settle(b, field, ex, ez);
  for (let f = 0; f < 5; f++) { ex += step; b.frame(field, ex, ez); }
  const cx = Math.floor((ex - 200) / CELL), cz = Math.floor(ez / CELL);
  field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2);
  let f = 0;
  for (; f < 600 && !field.live.has(G.cellKey(cx, cz)); f++) { ex += step; b.t = Math.max(b.t, f * 50); b.frame(field, ex, ez); }
  assert.ok(field.live.has(G.cellKey(cx, cz)), 'the cell behind was placed');
  assert.ok(nearest(cx, cz, ex, ez) < dueR, `while it stood inside GRASS_DUE_AT (${nearest(cx, cz, ex, ez).toFixed(0)} m, frame ${f})`);
});

test('AUDIT FB1021B F2: a cell in progress the eye brings inside the fade\'s start is an inner cell - placed whole, nearest first, on the frame it is missed (mutant: held as the rim\'s)', () => {
  const b = bench();
  const field = G.createGrassField(b.R, { keep: b.keep, clock: () => 0 });   // a clock that stands still: perFrame (2) alone ends a frame
  let ex = 615;
  const ez = 615;
  settle(b, field, ex, ez);
  // a rim cell 280 m ahead re-read, and begun: one slice, the eye standing
  const cx = Math.floor((ex + 285) / CELL), cz = Math.floor(ez / CELL), key = G.cellKey(cx, cz);
  field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2);
  b.frame(field, ex, ez);
  assert.equal(field.pending?.key, key, 'the cell is in progress');
  // the eye comes 185 m on in one update (the travel view's frames skip the field's): the cell in progress stands 100 m
  // off, and the cells beyond it that were past the range are missing inside the fade's start too, farther out
  ex += 185;
  const d = nearest(cx, cz, ex, ez);
  assert.ok(Math.abs(d - 100) < 0.1);
  const k = Math.ceil(wholeR / CELL) + 1, ecx = Math.floor(ex / CELL);
  const others = [];
  for (let z = cz - k; z <= cz + k; z++) for (let x = ecx - k; x <= ecx + k; x++) if (G.cellKey(x, z) !== key && nearest(x, z, ex, ez) <= wholeR && !field.live.has(G.cellKey(x, z))) others.push(nearest(x, z, ex, ez));
  assert.ok(others.length >= 2 && Math.min(...others) > d, `${others.length} other inner cells missing, the nearest ${Math.min(...others).toFixed(0)} m off`);
  b.frame(field, ex, ez);
  assert.ok(field.live.has(key), 'the cell in progress came whole on the frame it was inside, the nearest first');
  assert.equal(field.pending, null);
});

test('AUDIT FB1021B F5: a cell in progress the step leaves behind owes the pace nothing - the frame gives it its slice and no more, however near GRASS_DUE_AT it stands (mutant: read as one ahead)', () => {
  const b = bench();
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  // a rim cell straight ahead whose near edge stands 2 m past GRASS_DUE_AT, re-read and begun while the eye stands
  const cx = 30, cz = 20, ez = 615;
  let ex = cx * CELL - dueR - 2;
  settle(b, field, ex, ez);
  field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2);
  b.frame(field, ex, ez);
  assert.equal(field.pending?.key, G.cellKey(cx, cz), 'the cell is in progress');
  assert.equal(field.pending.st.i, G.GRASS_SLICE);
  // a strong gallop's frame at 20 fps the other way: read as ahead, it would be 3 frames from its deadline and owe a
  // third of its rest this frame - past the slice
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;
  ex -= step;
  assert.ok((perCell - G.GRASS_SLICE) / Math.ceil((nearest(cx, cz, ex, ez) - dueR) / step) > G.GRASS_SLICE);
  assert.equal(b.frame(field, ex, ez).keeps, G.GRASS_SLICE, 'its slice, and no more');
});

test('FB1021B: a cell inside the fade\'s start is never left behind - one re-read behind a gallop, with the rim\'s cells waiting ahead, comes whole on the frame it is missed (mutant: an inner cell can be left behind)', () => {
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;   // a strong gallop at 20 fps: past what a slice keeps up with
  const b = bench({ unit: 1 / 1024 });
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock });
  let ex = 615;
  const ez = 615;
  settle(b, field, ex, ez);
  for (let f = 0; f < 60; f++) { ex += step; b.frame(field, ex, ez); }
  const cx = Math.floor((ex - 100) / CELL), cz = Math.floor(ez / CELL);
  field.invalidate(cx * CELL + 1, cz * CELL + 1, cx * CELL + 2, cz * CELL + 2);
  ex += step;
  // the ride's rim: cells past GRASS_DUE_AT ahead, waiting their deadlines
  const k = Math.ceil(RANGE / CELL) + 1, ecx = Math.floor(ex / CELL), ecz = Math.floor(ez / CELL);
  let ahead = 0;
  for (let z = ecz - k; z <= ecz + k; z++) for (let x = ecx; x <= ecx + k; x++) if (nearest(x, z, ex, ez) > dueR && nearest(x, z, ex, ez) <= RANGE && !field.live.has(G.cellKey(x, z)) && G.cellKey(x, z) !== field.pending?.key) ahead++;
  assert.ok(ahead > 0, `the rim has cells waiting ahead (${ahead})`);
  const r = b.frame(field, ex, ez);
  assert.ok(field.live.has(G.cellKey(cx, cz)), `the cell ${nearest(cx, cz, ex, ez).toFixed(0)} m behind came back`);
  assert.ok(r.keeps >= perCell, 'whole');
});

test('AUDIT FB1021B F1: the cells the pace reaches come before a cell due now - three cells a step from GRASS_DUE_AT stand placed after the frame, and the cell due now waits for the frame\'s time (mutants: the pace reaches no cell, half the cells it owes)', () => {
  const step = ((100 + DF_RIDE_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + 100 / 200) / 20;   // a strong gallop at 20 fps
  const b = bench();   // a candidate a unit of the clock, and a frame's time of 1: nothing past the pace
  const field = G.createGrassField(b.R, { keep: b.keep, clock: b.clock, frameMs: 1, perFrame: 4 });
  let ex = 30 * CELL - dueR - 0.5 - step;
  const ez = 615;
  settle(b, field, ex, ez);
  const three = [19, 20, 21].map((cz) => G.cellKey(30, cz)), late = G.cellKey(20, 27);
  for (const cz of [19, 20, 21]) field.invalidate(30 * CELL + 1, cz * CELL + 1, 30 * CELL + 2, cz * CELL + 2);
  field.invalidate(20 * CELL + 1, 27 * CELL + 1, 20 * CELL + 2, 27 * CELL + 2);
  ex += step;
  assert.ok([19, 20, 21].every((cz) => nearest(30, cz, ex, ez) - dueR < step), 'the three are a step from their deadline: the pace owes all three this frame');
  assert.ok(nearest(20, 27, ex, ez) < dueR, 'and the fourth is due now');
  const r = b.frame(field, ex, ez);
  assert.deepEqual(three.map((k) => field.live.has(k)), [true, true, true], 'the three stand placed before the step brings them inside');
  assert.equal(field.live.has(late), false, 'the cell due now waits for a frame with time past the pace');
  assert.equal(r.writes, 3);
});

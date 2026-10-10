// PERF-INST (2026-10-10, the owner: "performance must be highest priority now ... prob caused by placed objects by
// players"): A MESH'S PLACEMENTS ARE FILED BY PLACE (render/shadowPass.js SHADOW_INSTANCE_LINEAR; bible/07-Rendering/
// Performance-Priority.md PERF-INST).
//
// The shadow pass remembers every placement of a mesh (AUDIT SC1, AUDIT REACH) to tell a still copy from a moved one.
// Each draw scanned every placement its mesh had - N copies of one model, N x N distances a frame - and past 128 every
// further copy read as moved for ever, replayed as a dynamic caster into every lantern near it, every frame: a town of
// yards furnished with the same chair, a room of two hundred placed pieces. Past SHADOW_INSTANCE_LINEAR placements the
// memory is filed on a grid of cubes in the origin's frame; a draw asks its own cube for the exact placement first,
// then the 3x3x3 round it; the cap is 1024.
//
// ONE: the answer is the scan's - the scan as it shipped is the oracle, run beside the pass over seeded stories (still
// copies, stacked copies, copies within the reach of each other, swings, jumps, new copies, copies left undrawn, origin
// shifts, a full memory's evictions), every draw's verdict and the memory after each frame compared. TWO: a draw reads
// only the placements filed round it - a copy across the town is never measured. THREE: a thousand still copies are
// still - none dynamic past the old 128.
//
// AUDIT PERF-INST (2026-10-10, the owner: "Lets do an audit on this"): the first cut's grid was XZ columns re-filed
// whole at every floating-origin shift, its loop ran by cell coordinate (`gx <= cx + 1` - for ever past 2^53 cells),
// and a full memory walked every placement at every miss. FOUR: ties and exact matches across a cube's face, a
// placement re-filed into a cube already holding a later one, and a draw past any cube a number can step - each the
// scan's answer. FIVE: the grid holds each placement once, in the cube it stands in, with no empty cube - after shifts
// whose float32 rounding carries placements over a face. SIX: a stack's still copy reads its own cube; a full memory's
// misses read each placement's age from a queue made once a frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShadowPass, SHADOW_INSTANCE_MAX, SHADOW_INSTANCE_REACH, SHADOW_INSTANCE_LINEAR, SHADOW_INSTANCE_PHASE, SHADOW_STILL_EPS, SHADOW_DYNAMIC_HOLD } from '../src/render/shadowPass.js';

const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const at = (x, y, z, turn = 0) => new Float32Array([Math.cos(turn), 0, -Math.sin(turn), 0, 0, 1, 0, 0, Math.sin(turn), 0, Math.cos(turn), 0, x, y, z, 1]);

/** THE ORACLE: ShadowPass._moved as it shipped before PERF-INST (main at 6443a8ad), the cap a parameter. */
function scanMoved(pass, o, matrix, max) {
  let inst = o._shInst;
  if (!inst) { inst = o._shInst = []; pass._shiftSeen(o); }
  else if (o._shGen !== pass._shiftGen) {
    const d = pass._shiftDelta(o);
    for (const s of inst) { s.m[12] += d[0]; s.m[13] += d[1]; s.m[14] += d[2]; }
    pass._shiftSeen(o);
  }
  const x = matrix[12], y = matrix[13], z = matrix[14];
  let exact = null, best = null, bestD = SHADOW_INSTANCE_REACH * SHADOW_INSTANCE_REACH, oldest = null;
  const eps2 = SHADOW_STILL_EPS * SHADOW_STILL_EPS;
  for (let i = 0; i < inst.length; i++) {
    const s = inst[i], m = s.m, d = (m[12] - x) * (m[12] - x) + (m[13] - y) * (m[13] - y) + (m[14] - z) * (m[14] - z);
    if (d <= eps2) { exact = s; break; }
    if (d < bestD && s.seen !== pass.frameNo) { bestD = d; best = s; }
    if (oldest === null || s.seen < oldest.seen) oldest = s;
  }
  let s = exact ?? best;
  if (!s) {
    if (inst.length >= max) {
      if (!oldest || pass.frameNo - oldest.seen < SHADOW_DYNAMIC_HOLD) return true;
      s = oldest; s.m.set(matrix); s.at = null; s.seen = pass.frameNo;
      return false;
    }
    inst.push({ m: new Float32Array(matrix), at: null, seen: pass.frameNo });
    return false;
  }
  s.seen = pass.frameNo;
  const m = s.m;
  let same = true;
  for (let i = 0; i < 16; i++) if (Math.abs(m[i] - matrix[i]) > SHADOW_STILL_EPS) { same = false; break; }
  if (!same) { m.set(matrix); s.at = pass.frameNo; }
  return s.at != null && pass.frameNo - s.at < SHADOW_DYNAMIC_HOLD;
}

/** A pass with no GL: the placement memory reads frameNo and the origin's shift alone. */
const bare = () => Object.assign(Object.create(ShadowPass.prototype), { frameNo: 1, _shiftGen: 0, _shiftNow: new Float64Array(3), _shiftD: new Float64Array(3) });
const memory = (o) => o._shInst.map((s) => [...s.m].join(',') + `|${s.at}|${s.seen}`);

/**
 * One story: `n` copies of a mesh in a town of `span` units, a frame at a time - each drawn with probability `drawP`
 * (or none of them, while `quiet` holds), some swinging a hand's breadth, some jumping across town, some stacked on
 * another copy, some new; the origin shifting now and then. Every draw's verdict and the memory after each frame,
 * the pass against the oracle.
 */
function story(seed, { n, span, frames, drawP = 0.9, max = SHADOW_INSTANCE_MAX, quiet = null, grow = 0 }) {
  const rnd = mul(seed);
  const pass = bare();
  const mine = {}, theirs = {};
  const copies = [];
  const add = () => {
    const r = rnd();
    if (r < 0.15 && copies.length) { const c = copies[Math.floor(rnd() * copies.length)]; copies.push({ x: c.x, y: c.y, z: c.z, turn: c.turn }); return; }   // stacked
    if (r < 0.35 && copies.length) { const c = copies[Math.floor(rnd() * copies.length)]; copies.push({ x: c.x + (rnd() - 0.5) * 3, y: c.y, z: c.z + (rnd() - 0.5) * 3, turn: 0 }); return; }   // within the reach of another
    copies.push({ x: (rnd() - 0.5) * span, y: (rnd() - 0.5) * 4, z: (rnd() - 0.5) * span, turn: rnd() < 0.5 ? 0 : Math.PI / 2 });
  };
  for (let i = 0; i < n; i++) add();
  let verdicts = 0;
  for (let f = 0; f < frames; f++) {
    pass.frameNo++;
    if (rnd() < 0.05) {   // the host recentres
      const off = [Math.round((rnd() - 0.5) * 4) * 819.2, 0, Math.round((rnd() - 0.5) * 4) * 819.2];
      pass._shiftNow[0] += off[0]; pass._shiftNow[2] += off[2]; pass._shiftGen++;
      for (const c of copies) { c.x += off[0]; c.z += off[2]; }
    }
    for (let g = 0; g < grow; g++) add();
    for (const c of copies) {
      const r = rnd();
      if (r < 0.04) c.turn += 0.05;   // a swing
      else if (r < 0.06) { c.x += (rnd() - 0.5) * 0.3; c.z += (rnd() - 0.5) * 0.3; }   // a step
      else if (r < 0.065) { c.x = (rnd() - 0.5) * span; c.z = (rnd() - 0.5) * span; }   // across town
    }
    if (quiet?.(f)) continue;
    for (let i = 0; i < copies.length; i++) {
      if (rnd() > drawP) continue;
      const c = copies[i], m = at(c.x, c.y, c.z, c.turn);
      const a = pass._moved(mine, m);
      const b = scanMoved(pass, theirs, m, max);
      assert.equal(a, b, `seed ${seed}, frame ${f}, copy ${i}: the verdict is the scan's`);
      verdicts++;
    }
    assert.deepEqual(memory(mine), memory(theirs), `seed ${seed}, frame ${f}: the memory is the scan's`);
  }
  return { verdicts, mine, pass };
}

/** A schedule run through the pass and the oracle side by side: `frames` is a list of frames, each a list of [x, y, z]
 *  draws in order; every verdict and the memory after each frame compared. Answers the pass's mesh. */
function twin(frames, max = SHADOW_INSTANCE_MAX) {
  const pass = bare();
  const mine = {}, theirs = {};
  frames.forEach((draws, f) => {
    pass.frameNo++;
    draws.forEach(([x, y, z], i) => {
      const m = at(x, y, z);
      assert.equal(pass._moved(mine, m), scanMoved(pass, theirs, m, max), `frame ${f}, draw ${i} at ${x},${y},${z}: the verdict is the scan's`);
    });
    assert.deepEqual(memory(mine), memory(theirs), `frame ${f}: the memory is the scan's`);
  });
  return { pass, mine, theirs };
}
const still = (n, step = 7) => Array.from({ length: n }, (_, i) => [100 + (i % 10) * step, 0, 100 + Math.floor(i / 10) * step]);

test('PERF-INST: a draw equally near two remembered placements takes the earlier remembered, as the scan did (mutant: the tie to the later)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  twin([
    [[0, 0, 0], [1, 0, 0], ...others],   // two copies a unit apart, and enough others to be filed
    [[0.5, 0, 0], [1, 0, 0], ...others],   // the first steps to the middle: equally near both; the second stands
    [[0.5, 0, 0], [1, 0, 0], ...others],
    [[1, 0, 0], [0.5, 0, 0], ...others],   // the order of the draws turned round
    [[1, 0, 0], [0.5, 0, 0], ...others],
  ]);
});

test('PERF-INST: a copy walking a unit a frame across many cells stays its own placement - filed again as it goes - as the scan kept it (mutant: a moved placement left filed where it stood)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  const frames = [];
  for (let f = 0; f < 30; f++) frames.push([[f * 1.0, 0, -f * 0.7], ...others]);
  const { mine } = twin(frames);
  assert.equal(mine._shInst.length, others.length + 1, 'the walker one placement, followed');
});

test('PERF-INST: a full memory evicts as the scan did - the least recently drawn placement not drawn for a hold (the earliest remembered of those), passing over one drawn since, after a frame that found every placement live (mutants: a live placement evicted; no eviction; the frame\'s queue kept past its frame; the queue by remembered order alone; a placement drawn since it was queued evicted)', () => {
  const max = SHADOW_INSTANCE_MAX;
  const all = Array.from({ length: max + 20 }, (_, i) => [i * 5, 0, 0]);
  const frames = [all, all, all.slice(0, max - 5)];   // full, and the twenty past it dynamic: every placement live; the last five remembered left undrawn a frame early - the stalest
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 2; f++) frames.push([]);   // nothing drawn for a hold
  // a new copy evicts the stalest (the earliest of the five); the next stalest is drawn - live again, passed over; the
  // next new copy takes the one after it
  frames.push([[-100, 0, 0], all[max - 4], [-200, 0, 0], ...all.slice(0, 10)]);
  frames.push([[-100, 0, 0], [-200, 0, 0], [-300, 0, 0], ...all.slice(0, 10)]);
  const { mine } = twin(frames, max);
  assert.equal(mine._shInst.length, max, 'full, not grown');
});

test('PERF-INST: past SHADOW_INSTANCE_LINEAR the filed memory answers every draw as the scan did - still, stacked and near copies, swings, steps, jumps, new copies, undrawn copies, origin shifts - verdict by verdict, and holds the same placements in the same order (mutants: the nearest unclaimed tie to the latest; a claimed placement taken; a moved placement left filed where it stood; the 3x3x3 a cross)', () => {
  assert.equal(SHADOW_INSTANCE_LINEAR, 64);
  let total = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) total += story(seed, { n: 120, span: 160, frames: 40 }).verdicts;
  for (const seed of [7, 8]) total += story(seed, { n: 90, span: 26, frames: 60, drawP: 0.6 }).verdicts;   // crowded: most copies within the reach of others
  for (const seed of [9, 10]) total += story(seed, { n: 4, span: 40, frames: 90, grow: 1 }).verdicts;   // across the line, one new copy a frame
  assert.ok(total > 20000, `a story's worth of draws (${total})`);
});

test('PERF-INST: a draw measures only the placements filed round it - a copy across town is never read; a thousand still copies are all still, none dynamic past the old 128 (mutants: the grid unasked - every placement scanned; the cap back to 128)', () => {
  const pass = bare();
  const mesh = {};
  const xs = [];
  for (let i = 0; i < 1000; i++) xs.push([(i % 40) * 7, 0, Math.floor(i / 40) * 7]);
  for (let f = 0; f < 3; f++) {
    pass.frameNo++;
    for (const [x, y, z] of xs) assert.equal(pass._moved(mesh, at(x, y, z)), false, `frame ${f}: a still copy at ${x},${z} is still`);
  }
  assert.equal(mesh._shInst.length, 1000, 'each copy its own placement');
  // a sentinel placement across town: a draw near the origin never reads it
  const far = mesh._shInst[999];
  let reads = 0;
  const m = far.m;
  Object.defineProperty(far, 'm', { get() { reads++; return m; }, configurable: true });
  pass.frameNo++;
  for (const [x, y, z] of xs.slice(0, 100)) pass._moved(mesh, at(x, y, z));
  for (let i = 0; i < 40; i++) pass._moved(mesh, at(3.5 + i * 7, 0, 3.5));   // new copies between the old: a draw that finds none
  assert.equal(reads, 0, 'the placement across town was never measured');
  pass._moved(mesh, at(...xs[999]));
  assert.ok(reads > 0, 'its own draw finds it');
});

/** The cube a place stands in, as the pass files it: its cell coordinates in the origin's frame (`shift` the pass's
 *  cumulative one), ten bits each. */
const R = SHADOW_INSTANCE_REACH;
const cubeOf = (m, shift) => ((Math.floor((m[12] - shift[0]) / R + SHADOW_INSTANCE_PHASE) & 0x3ff) << 20)
  | ((Math.floor((m[13] - shift[1]) / R + SHADOW_INSTANCE_PHASE) & 0x3ff) << 10) | (Math.floor((m[14] - shift[2]) / R + SHADOW_INSTANCE_PHASE) & 0x3ff);
/** The x of the face between cube k - 1 and cube k. */
const face = (k) => (k - SHADOW_INSTANCE_PHASE) * R;

test('PERF-INST (AUDIT): the scan\'s memory never fills - SHADOW_INSTANCE_LINEAR is under the cap, so a full memory is the filed path\'s alone; the cap is 1024 (~0.6 KB a placement, a full mesh\'s memory kept for the session)', () => {
  assert.equal(SHADOW_INSTANCE_MAX, 1024);
  assert.ok(SHADOW_INSTANCE_LINEAR < SHADOW_INSTANCE_MAX, 'the scan runs under the cap');
  assert.ok(SHADOW_INSTANCE_PHASE > 0 && SHADOW_INSTANCE_PHASE < 1, 'the cubes stand off the round numbers by less than one');
});

test('PERF-INST (AUDIT): a draw equally near two placements in two cubes takes the earlier remembered, whichever cube is asked first (mutants: the nearest tie to the first cube asked; to the last)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  for (const pair of [[[1, 0, 0], [-1, 0, 0]], [[-1, 0, 0], [1, 0, 0]]]) {   // either side of the face at x = -0.76: both orders
    assert.notEqual(cubeOf(at(...pair[0]), [0, 0, 0]), cubeOf(at(...pair[1]), [0, 0, 0]), 'the two in two cubes');
    twin([[...others, ...pair], [...others, [0, 0, 0]], [...others, [0, 0, 0]]]);
  }
});

test('PERF-INST (AUDIT): a draw exactly the reach from a placement is a placement of its own, as the scan\'s strict test made it - nearer than the reach, the placement\'s (mutant: a draw at the reach taken when nothing nearer stands)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  const { mine } = twin([[...others, [0, 0, 0]], [...others, [R, 0, 0]], [...others, [R, 0, 0], [0.5, 0, R - 0.5]]]);
  assert.equal(mine._shInst.length, others.length + 2, 'the draw at the reach a new placement');
});

test('PERF-INST (AUDIT): a draw within the epsilon of placements on both sides of a cube\'s face takes the earliest remembered - from the cube past the face, when the draw stands within two epsilons of it (mutants: the face\'s neighbour unasked; the exact one the last found; no early out kept to the earliest)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  const xf = face(1), e = SHADOW_STILL_EPS;
  const A = [xf + 0.6 * e, 0, 0], B = [xf - 0.6 * e, 0, 0], C = [xf - 0.1 * e, 0, 0.9 * e];
  assert.notEqual(cubeOf(at(...A), [0, 0, 0]), cubeOf(at(...B), [0, 0, 0]), 'A and B either side of the face');
  twin([
    [...others, A, B],   // A remembered first, past the face; B more than the epsilon from it, a placement of its own
    [...others, [xf - 0.1 * e, 0, 0]],   // within the epsilon of both, in B's cube: A is the scan's
    [...others, [xf - 0.1 * e, 0, 0]],
  ]);
  twin([
    [...others, C, B, A],   // three within the epsilon of a draw, the earliest in the draw's own cube
    [...others, [xf - 0.3 * e, 0, 0.4 * e]],
    [...others, [xf + 0.2 * e, 0, 0.4 * e]],   // the draw past the face: the earliest is behind it
  ]);
});

test('PERF-INST (AUDIT): a placement filed again into a cube that holds a later one stands before it - the first within the epsilon in a cube is its earliest (mutant: a placement filed at its cube\'s end)', () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  twin([
    [...others, [0, 0, 0], [0.0015, 0, 0]],   // B, then C beside it - more than the epsilon apart
    [...others, [0.0015, 0, 0], [1.5, 0, 0]],   // C drawn first; B steps into the next cube
    [...others, [0.0015, 0, 0], [0, 0, 0]],   // and back: filed again before C
    [...others, [0.00075, 0, 0]],   // within the epsilon of both: B, the earlier
  ]);
});

test('PERF-INST (AUDIT): a translation past any cube a number can step, or not finite, answers as the scan did, and returns (the first cut\'s `gx <= cx + 1` never ended past 2^53 cells)', { timeout: 20000 }, () => {
  const others = still(SHADOW_INSTANCE_LINEAR + 4);
  twin([[...others], [...others, [Infinity, 0, 0], [0, 0, -Infinity], [NaN, 0, 0], [1e17, 0, 0], [-3e38, 0, 5], [0, 3e38, 0]], [...others, [1e17, 0, 0], [-3e38, 0, 5]]]);
});

test('PERF-INST (AUDIT): the grid holds each placement once, in the cube it stands in in the origin\'s frame, and no empty cube - walkers, and shifts whose float32 rounding carries placements over a face (mutants: the shift not refiled; a placement left in the cube it left; an emptied cube kept)', () => {
  const pass = bare(), mine = {}, theirs = {};
  // a hundred copies each a hair short of a face (0 to 2.4e-4 short): a shift of a few thousand units rounds some over
  const copies = Array.from({ length: 100 }, (_, i) => ({ x: face(i * 3) - i * 2.4e-6, y: 0.5, z: 0.5 }));
  const home = copies.map((c) => cubeOf(at(c.x, c.y, c.z), [0, 0, 0]));   // the cube each stands in before any shift
  const walker = { x: -20, y: 0.5, z: 30 };
  const check = (label) => {
    const grid = mine._shInstGrid;
    let n = 0;
    for (const [k, cell] of grid) {
      assert.ok(cell.length > 0, `${label}: no empty cube`);
      for (const s of cell) { assert.equal(s.key, k, `${label}: filed under its key`); assert.equal(k, cubeOf(s.m, pass._shiftNow), `${label}: in the cube it stands in`); }
      n += cell.length;
    }
    assert.equal(n, mine._shInst.length, `${label}: each placement filed once`);
  };
  let crossed = 0;
  for (let f = 0; f < 12; f++) {
    pass.frameNo++;
    if (f % 3 === 2) {   // the host recentres
      const d = 819.2 * (f + 1);
      pass._shiftNow[0] += d; pass._shiftNow[2] -= d; pass._shiftGen++;
      for (const c of [...copies, walker]) { c.x += d; c.z -= d; }
    }
    walker.x += 1.3; walker.z -= 0.9;
    for (const c of [walker, ...copies]) {
      const m = at(c.x, c.y, c.z);
      assert.equal(pass._moved(mine, m), scanMoved(pass, theirs, m, SHADOW_INSTANCE_MAX), `frame ${f}: the verdict is the scan's`);
    }
    assert.deepEqual(memory(mine), memory(theirs), `frame ${f}: the memory is the scan's`);
    check(`frame ${f}`);
    crossed = mine._shInst.slice(1).filter((s, i) => cubeOf(s.m, pass._shiftNow) !== home[i]).length;
  }
  assert.ok(crossed > 0, `the rounding carried placements over a face (${crossed} of ${copies.length})`);
});

test('PERF-INST (AUDIT): a still copy is found in its own cube - each draw of a stack of six hundred copies one above another measures the few in its cube, not a column of them (mutants: the exact pass skipped)', () => {
  const pass = bare(), mesh = {};
  const stack = Array.from({ length: 600 }, (_, i) => [0.3, i * 0.5, 0.3]);
  pass.frameNo++;
  for (const p of stack) pass._moved(mesh, at(...p));
  let reads = 0;
  for (const s of mesh._shInst) { const m = s.m; Object.defineProperty(s, 'm', { get() { reads++; return m; }, configurable: true }); }
  pass.frameNo++;
  for (const p of stack) assert.equal(pass._moved(mesh, at(...p)), false, `the copy at y ${p[1]} is still`);
  // four copies to a cube: a draw measures its cube up to itself, and its own placement once more
  assert.ok(reads <= stack.length * 5, `${reads} placements measured for ${stack.length} draws`);
});

test('PERF-INST (AUDIT): a full memory\'s misses take the stalest from a queue made once a frame - two thousand new copies after a hold away read each placement\'s age a few times in all, not once a miss (mutant: the queue made again at every miss)', () => {
  const pass = bare(), mesh = {};
  const max = SHADOW_INSTANCE_MAX;
  pass.frameNo++;
  for (let i = 0; i < max; i++) pass._moved(mesh, at((i % 32) * 5, 0, Math.floor(i / 32) * 5));
  assert.equal(mesh._shInst.length, max, 'full');
  pass.frameNo += SHADOW_DYNAMIC_HOLD + 1;   // a hold away
  let reads = 0;
  for (const s of mesh._shInst) { let seen = s.seen; Object.defineProperty(s, 'seen', { get() { reads++; return seen; }, set(v) { seen = v; }, configurable: true }); }
  let still = 0;
  for (let i = 0; i < 2000; i++) if (!pass._moved(mesh, at(5000 + (i % 40) * 5, 0, Math.floor(i / 40) * 5))) still++;
  assert.equal(still, max, 'every placement given up once, the rest dynamic');
  assert.ok(reads < 30 * max, `${reads} ages read for 2000 misses of a memory of ${max}`);
});

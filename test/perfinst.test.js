// PERF-INST (2026-10-10, the owner: "performance must be highest priority now ... prob caused by placed objects by
// players"): A MESH'S PLACEMENTS ARE FILED BY PLACE (render/shadowPass.js SHADOW_INSTANCE_LINEAR; bible/07-Rendering/
// Performance-V8.md PERF-INST).
//
// The shadow pass remembers every placement of a mesh (AUDIT SC1, AUDIT REACH) to tell a still copy from a moved one.
// Each draw scanned every placement its mesh had - N copies of one model, N x N distances a frame - and past 128 every
// further copy read as moved for ever, replayed as a dynamic caster into every lantern near it, every frame: a town of
// yards furnished with the same chair, a room of two hundred placed pieces. Past SHADOW_INSTANCE_LINEAR placements the
// memory is filed on an XZ grid and a draw asks the 3x3 cells round it; the cap is 4096.
//
// ONE: the answer is the scan's - the scan as it shipped is the oracle, run beside the pass over seeded stories (still
// copies, stacked copies, copies within the reach of each other, swings, jumps, new copies, copies left undrawn, origin
// shifts, a full memory's evictions), every draw's verdict and the memory after each frame compared. TWO: a draw reads
// only the placements filed round it - a copy across the town is never measured. THREE: a thousand still copies are
// still - none dynamic past the old 128.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShadowPass, SHADOW_INSTANCE_MAX, SHADOW_INSTANCE_REACH, SHADOW_INSTANCE_LINEAR, SHADOW_STILL_EPS, SHADOW_DYNAMIC_HOLD } from '../src/render/shadowPass.js';

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

test('PERF-INST: a full memory evicts as the scan did - the stalest placement not drawn for a hold, after a frame that found every placement live (mutants: a live placement evicted; no eviction; the frame\'s "all live" kept past its frame)', () => {
  const max = SHADOW_INSTANCE_MAX;
  const all = Array.from({ length: max + 20 }, (_, i) => [i * 5, 0, 0]);
  const frames = [all, all, all];   // full, and the twenty past it dynamic: every placement live
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 2; f++) frames.push([]);   // nothing drawn for a hold
  frames.push([[-100, 0, 0], [-200, 0, 0], ...all.slice(0, 10)]);   // two new copies first: each evicts the stalest
  frames.push([[-100, 0, 0], [-200, 0, 0], ...all.slice(0, 10)]);
  const { mine } = twin(frames, max);
  assert.equal(mine._shInst.length, max, 'full, not grown');
});

test('PERF-INST: past SHADOW_INSTANCE_LINEAR the filed memory answers every draw as the scan did - still, stacked and near copies, swings, steps, jumps, new copies, undrawn copies, origin shifts - verdict by verdict, and holds the same placements in the same order (mutants: the nearest unclaimed tie to the latest; a claimed placement taken; a moved placement left filed where it stood; the shift not refiled; the 3x3 a cross)', () => {
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

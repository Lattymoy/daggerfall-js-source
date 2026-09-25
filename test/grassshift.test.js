// PERF-EXT20-22 (2026-09-25) - THE STREAMING HITCHES, the grass's share.
//
// The players: "fps issues in the exterior but fine in the interior",
// "me too my friend.. don't know why. I got a RX6600". Outdoors the
// frame pays for the stream, and the grass was the biggest single piece
// of it: every map-pixel crossing threw the field away (AUDIT 49 F2 /
// GR5's `labGrassField = null`) and regrew it over ~176 frames, and the
// slot count behind every rebuild was re-swept from scratch.
//
// These run the REAL createGrassField and LabGrassRenderer on a GL that
// records what it is asked, over a synthetic 5x5 stride-1 ring whose
// keep()/ground() are world.js's own shape - the prover's harness
// (shiftProof.mjs, walkEquiv.mjs), cut down to what a law needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../src/render/labGrass.js';   // a namespace, so a seam that is missing fails ITS pin and not the file
import { surfaceHeightAt, TERRAIN_TILE_DIM } from '../src/world/terrainSurface.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');

/** A WebGL2 that answers what the grass renderer's constructor asks and
 *  counts the rest; `rec` collects each drawn slot's decode frame. */
function recordingGl() {
  const counts = {};
  const rec = { on: false, cur: null, list: [] };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'isEnabled') return () => false;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...a) => {
        counts[k] = (counts[k] || 0) + 1;
        if (rec.on && k === 'uniform4f' && a[0] === 'uCellFrame') rec.cur = [Math.fround(a[1]), Math.fround(a[2]), Math.fround(a[3]), Math.fround(a[4])];
        if (rec.on && k === 'drawArraysInstanced') rec.list.push({ frame: rec.cur, n: a[3] });
      };
    },
  });
  return { gl, counts, rec };
}

/** A ring of stride-1 pixels around (100, 100), one tile in seven not
 *  grass, and world.js's keep()/ground() over it in the scene frame a
 *  compensation `comp` gives. */
function ring(radius = 2) {
  const hDim = HEIGHTMAP_DIMENSION;
  const pixels = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const px = 100 + dx, py = 100 + dy;
    const samples = new Float32Array(hDim * hDim);
    for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) samples[x * hDim + z] = 0.3 + 0.01 * Math.sin((px * 128 + x) * 0.03) * Math.cos((py * 128 + z) * 0.025);
    const tilemapBytes = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
    for (let i = 0; i < tilemapBytes.length; i++) tilemapBytes[i] = ((i * 2654435761) >>> 0) % 7 === 0 ? (3 << 2) : (2 << 2);
    pixels.push({ px, py, samples, tilemapBytes });
  }
  const closures = (comp) => {
    const t = (p) => [(p.px - 100) * TERRAIN_SIZE + comp[0], comp[1], -(p.py - 100) * TERRAIN_SIZE + comp[2]];
    const at = G.pieceIndex(pixels.map((p) => ({ p, t: t(p) })), TERRAIN_SIZE);
    const keep = (x, z) => {
      const hit = at(x, z); if (!hit) return null;
      const lx = x - hit.t[0], lz = z - hit.t[2];
      const rec = hit.p.tilemapBytes[Math.floor(lz / 6.4) * TERRAIN_TILE_DIM + Math.floor(lx / 6.4)] >> 2;
      if (rec !== 2) return null;
      return surfaceHeightAt(hit.p.samples, lx, lz, 1) + hit.t[1];
    };
    const ground = (x, z) => (at(x, z) ? [0.2, 0.3, 0.1] : null);
    return { keep, ground };
  };
  return { pixels, closures };
}

/** a view that keeps everything within 2 km in its frustum */
function drawSlots(R, rec, eye) {
  const s = 1 / 2000;
  const proj = new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1]);
  rec.on = true; rec.list = [];
  R.draw(proj, view, new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.3, 0.3, 0.3], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 1, windV: [0.1, 0] }, G.LAB_GRASS.range, 'pixel');
  rec.on = false;
  return rec.list;
}

function settle(field, eye, { keep, ground }) {
  for (let f = 0; f < 2000; f++) if (field.update(eye[0], eye[2], keep, ground) === 0) return f;
  throw new Error('the field never settled');
}

// ─── PERF-EXT20: THE DISC IS SWEPT ONCE ─────────────────────────────
test('PERF-EXT20: discSlotCount sweeps once per question - every field after the first reads the memo, and the world warms it at mount', () => {
  assert.equal(typeof G.discSweeps, 'function', 'the sweep counter is the seam this pin reads');
  const r = { allocSlots() {}, writeSlot() {}, clearSlot() {} };
  const before = G.discSweeps();
  const a = G.createGrassField(r, { keep: () => 0 });
  const b = G.createGrassField(r, { keep: () => 0 });
  assert.equal(a.slots, 394, 'the shipped span holds 394 cells (grasspath.test.js holds that against a brute force)');
  assert.equal(b.slots, a.slots, 'the same answer the second time');
  assert.ok(G.discSweeps() - before <= 1, `two fields, at most one sweep (${G.discSweeps() - before})`);
  // every argument is part of the question: a memo keyed on less answers
  // one question with another's count
  const s0 = G.discSweeps();
  const q = [G.discSlotCount(157, 30), G.discSlotCount(157, 30), G.discSlotCount(157, 31), G.discSlotCount(157, 30, 12), G.discSlotCount(158, 30)];
  assert.equal(q[0], q[1]);
  assert.equal(G.discSweeps() - s0, 4, 'four distinct questions, four sweeps - and the repeat none');
  // the memo IS the sweep's answer
  assert.equal(G.discSlotCount(G.LAB_GRASS.span), a.slots);
  // the world pays the one sweep at mount, behind the loading screen
  assert.match(WORLD, /  let labGrassField = null;[^\n]*\n  if \(labGrass\) discSlotCount\(LAB_GRASS\.span\);/, 'warmed where the renderer is built');
});

// ─── PERF-EXT21: THE FIELD SURVIVES THE ORIGIN SHIFT ────────────────
test('PERF-EXT21: a crossing moves the field in place - no buffer re-specified, no cell uploaded, every slot drawn where it stood', () => {
  const { gl, counts, rec } = recordingGl();
  const R = new G.LabGrassRenderer(gl);
  const { closures } = ring(2);
  let comp = [0, 0, 0];
  const E = [409.6 + 200, 0, 409.6 - 100];
  const field = G.createGrassField(R, closures(comp));
  settle(field, E, closures(comp));
  const before = drawSlots(R, rec, E);
  assert.ok(before.length > 300, `the settled field draws its disc (${before.length})`);
  for (const off of [[-TERRAIN_SIZE, 0, 0], [0, -500, 0], [0, 0, TERRAIN_SIZE]]) {   // a crossing east, a vertical recentre, a crossing south
    const prev = drawSlots(R, rec, E.map((v, i) => v + comp[i]));
    comp = comp.map((v, i) => v + off[i]);
    const eye = E.map((v, i) => v + comp[i]);
    for (const k of Object.keys(counts)) delete counts[k];
    field.shiftOrigin(off);
    const pending = field.update(eye[0], eye[2], closures(comp).keep, closures(comp).ground);
    assert.equal(pending, 0, `${off}: nothing to fill - the eye stands where it stood`);
    assert.equal(counts.bufferData ?? 0, 0, `${off}: no buffer re-specified`);
    assert.equal(counts.bufferSubData ?? 0, 0, `${off}: no cell re-uploaded`);
    const after = drawSlots(R, rec, eye);
    assert.equal(after.length, prev.length, `${off}: every slot still drawn on the crossing frame (was 2 of 357)`);
    // each drawn slot is a slot from before, moved by the offset (the frame's x, z, yBase)
    for (let i = 0; i < after.length; i++) {
      const a = after[i].frame, p = prev[i].frame;
      assert.equal(after[i].n, prev[i].n, 'the same blades');
      assert.ok(Math.abs(a[0] - (p[0] + off[0])) < 1e-4 && Math.abs(a[1] - (p[1] + off[2])) < 1e-4 && Math.abs(a[2] - (p[2] + off[1])) < 1e-4 && a[3] === p[3],
        `${off}: slot ${i} moved by the offset: ${p} -> ${a}`);
    }
  }
  // A JOURNEY DOES NOT DRIFT. The slot frames are doubles, rounded to
  // float32 once at the upload - so a hundred crossings out and a hundred
  // back draw the very bits the field drew before them. Frames kept in
  // float32 would round at every shift and walk off by the ulp.
  const eyeNow = E.map((v, i) => v + comp[i]);
  const home = drawSlots(R, rec, eyeNow);
  for (let trip = 0; trip < 100; trip++) { field.shiftOrigin([-TERRAIN_SIZE, 0, 0]); field.shiftOrigin([TERRAIN_SIZE, 0, 0]); }
  const back = drawSlots(R, rec, eyeNow);
  assert.equal(back.length, home.length);
  const moved = back.filter((d, i) => d.frame.some((v, k) => v !== home[i].frame[k])).length;
  assert.equal(moved, 0, `after a hundred round trips, ${moved} of ${back.length} slot frames are not the bits they were`);
});

test('PERF-EXT21: a field that crossed grows the same world as one that never did - the same cells, the same blades, the same tint', () => {
  const { closures } = ring(3);
  const A = recordingGl(), B = recordingGl();
  const RA = new G.LabGrassRenderer(A.gl), RB = new G.LabGrassRenderer(B.gl);
  let compA = [0, 0, 0];
  const compB = [0, 0, 0];
  const fa = G.createGrassField(RA, closures(compA)), fb = G.createGrassField(RB, closures(compB));
  let crossed = false;
  const path = (i) => [409.6 + 700 + i * 2, 0, 300];   // a world path east across x = 819.2
  for (let i = 0; i < 400; i++) {
    const e = path(i);
    if (!crossed && e[0] >= TERRAIN_SIZE) { compA = [compA[0] - TERRAIN_SIZE, 0, 0]; fa.shiftOrigin([-TERRAIN_SIZE, 0, 0]); crossed = true; }
    const ca = closures(compA), cb = closures(compB);
    fa.update(e[0] + compA[0], e[2], ca.keep, ca.ground);
    fb.update(e[0], e[2], cb.keep, cb.ground);
  }
  assert.ok(crossed);
  assert.deepEqual([...fa.live.keys()].sort((x, y) => x - y), [...fb.live.keys()].sort((x, y) => x - y), 'the same cells, keyed the same');
  const e = path(399);
  const da = drawSlots(RA, A.rec, [e[0] + compA[0], 0, e[2]]), db = drawSlots(RB, B.rec, e);
  assert.equal(da.length, db.length);
  let worst = 0;
  for (const d of da) {
    let best = Infinity;
    for (const b of db) {
      if (b.n !== d.n) continue;
      best = Math.min(best, Math.max(Math.abs(d.frame[0] - compA[0] - b.frame[0]), Math.abs(d.frame[1] - b.frame[1]), Math.abs(d.frame[2] - b.frame[2]), Math.abs(d.frame[3] - b.frame[3])));
    }
    worst = Math.max(worst, best);
  }
  assert.ok(worst < 1e-3, `every slot the crossed field draws has a twin in the other within 1 mm, in world terms (worst ${worst})`);
  // one cell, placed by both: the positions are the offset apart and the
  // GRASS6 tint - the field's patch, not the scene's - is the same bits
  const cx = 45, cz = -8;
  const pa = G.placeLabGrassCell(cx, cz, { ...closures(compA), perCell: fa.perCell, originX: compA[0], originZ: compA[2] });
  const pb = G.placeLabGrassCell(cx, cz, { ...closures(compB), perCell: fb.perCell });
  assert.ok(pa.count > 1000 && pa.count === pb.count, `the same blades stand (${pa.count}/${pb.count})`);
  for (let i = 0; i < pa.count; i++) {
    assert.ok(Math.abs(pa.inst[i * 4] - compA[0] - pb.inst[i * 4]) < 1e-3 && pa.inst[i * 4 + 1] === pb.inst[i * 4 + 1], 'the blade stands the offset away');
    assert.equal(pa.inst2[i * 4 + 2], pb.inst2[i * 4 + 2], 'and its tint is the same bits');
  }
  // and at the origin the placer is what it always was
  const z0 = G.placeLabGrassCell(cx, cz, { ...closures(compB), perCell: fb.perCell, originX: 0, originZ: 0 });
  assert.deepEqual([z0.inst, z0.inst2, z0.rootY, z0.ground], [pb.inst, pb.inst2, pb.rootY, pb.ground]);
});

test('PERF-EXT21: invalidate after a shift drops exactly the cells whose squares, where they stand in the scene now, meet the rect', () => {
  const { closures } = ring(2);
  const r = { allocSlots() {}, writeSlot() {}, clearSlot() {}, shiftSlots() {} };
  const field = G.createGrassField(r, { ...closures([0, 0, 0]), perFrame: 1e9 });
  const off = [-TERRAIN_SIZE, 0, 0];   // 819.2 is 27 cells and 9.2 m: the grids no longer line up
  field.update(609.6, 309.6);
  field.shiftOrigin(off);
  const gx = off[0], cell = G.GRASS_CELL;
  const x0 = -150.5, x1 = -40.25, z0 = 250.75, z1 = 330.5;   // a scene rect
  const before = [...field.live.values()].map((h) => ({ ...h }));
  field.invalidate(x0, z0, x1, z1);
  const meets = (h) => h.cx * cell + gx <= x1 && (h.cx + 1) * cell + gx > x0 && h.cz * cell <= z1 && (h.cz + 1) * cell > z0;
  const want = before.filter(meets).map((h) => G.cellKey(h.cx, h.cz)).sort((a, b) => a - b);
  const gone = before.map((h) => G.cellKey(h.cx, h.cz)).filter((k) => !field.live.has(k)).sort((a, b) => a - b);
  assert.ok(want.length > 5, `the rect covers cells (${want.length})`);
  assert.deepEqual(gone, want);
  // a rect asked in the field's own frame would have dropped others
  const naive = before.filter((h) => h.cx * cell <= x1 && (h.cx + 1) * cell > x0 && h.cz * cell <= z1 && (h.cz + 1) * cell > z0).map((h) => G.cellKey(h.cx, h.cz)).sort((a, b) => a - b);
  assert.notDeepEqual(naive, want, 'the fixture tells the two frames apart');
});

test('PERF-EXT21: the host moves the field at a shift, empties it at a teleport, and re-reads it wherever a pixel lands or joins the near ring', () => {
  const shift = WORLD.slice(WORLD.indexOf('    if (r.offset) {\n      // FloatingOrigin.OffsetPlayerController'), WORLD.indexOf('    if (r.pixelChanged) {\n      // P1: PlayerGPS.Update'));
  assert.ok(shift.length > 500, 'the shift block was found');
  assert.match(shift, /labGrassField\?\.shiftOrigin\(r\.offset\);/, 'the shift carries the field');
  assert.doesNotMatch(shift, /labGrassField = null/, 'and no longer throws it away');
  const tp = WORLD.slice(WORLD.indexOf('  async function _teleportToPixel('), WORLD.indexOf('    _wodArrival = wodArrivalOf(queue);'));
  assert.ok(tp.length > 1000, 'the teleport was found');
  const cut = tp.indexOf('\n    labGrassField = null;\n');
  assert.ok(cut > 0 && cut < tp.indexOf('queue.push(...state.init(px, py));') && !/\bawait\b/.test(tp.slice(cut, tp.indexOf('queue.push(...state.init(px, py));'))),
    'a new scene frame starts an empty field - said before state.init re-anchors the scene, with no frame between');
  assert.match(WORLD, /\n    if \(labGrassField\) \{   \/\/ WOD2[^\n]*\n      const t = state\.pixelTranslation\(px, py\);\n      labGrassField\.invalidate\(t\[0\], t\[2\], t\[0\] \+ TERRAIN_SIZE, t\[2\] \+ TERRAIN_SIZE\);/,
    'every published pixel re-reads the cells over it, not a location\'s alone');
  // PERF-EXT21 (the review): and so nothing is kept to ask it - the set
  // AUDIT BRANCH (WoD) m2 filled at a teardown gated this very line, and
  // was written and never read once the line stopped asking
  assert.doesNotMatch(WORLD, /_wodSiteWas/, 'no teardown remembers a site for a publish that no longer asks');
  const rs = WORLD.slice(WORLD.indexOf('  function restrideTerrain('), WORLD.indexOf('  function destroyPixel('));
  assert.match(rs, /if \(stride === 1 && labGrassField\) \{\n      const t = state\.pixelTranslation\(p\.px, p\.py\);\n      labGrassField\.invalidate\(t\[0\], t\[2\], t\[0\] \+ TERRAIN_SIZE, t\[2\] \+ TERRAIN_SIZE\);/,
    'a promotion to the near ring re-reads the cells over it');
});

// ─── PERF-EXT22: A WALK PLACES ITS RIM A SLICE A FRAME ──────────────
/** A renderer that records, per written slot, the cell's lanes as bytes. */
function laneRecorder() {
  const writes = [];
  return {
    writes,
    allocSlots() {}, clearSlot() {}, shiftSlots() {},
    writeSlot(slot, placed) {
      const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
      writes.push({ slot, count: placed.count, lanes: [placed.inst, placed.inst2, placed.rootY, placed.ground].map(bytes).join('|') });
    },
  };
}
const lanesOf = (p) => [p.inst, p.inst2, p.rootY, p.ground].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64')).join('|');

test('PERF-EXT22: a cell placed a slice at a time is the cell placed whole - byte for byte, however the loop is cut', () => {
  assert.equal(typeof G.beginGrassCell, 'function', 'the placer can be begun');
  assert.equal(typeof G.stepGrassCell, 'function', 'and stepped');
  const { closures } = ring(2);
  const { keep, ground } = closures([-TERRAIN_SIZE, 0, 7]);   // a field that has crossed: the origin rides the placement
  const perCell = G.grassPerCell();
  for (let c = 0; c < 24; c++) {
    const cx = (c % 6) * 5 - 12, cz = Math.floor(c / 6) * 7 - 12, originX = -TERRAIN_SIZE, originZ = 7;
    const whole = G.placeLabGrassCell(cx, cz, { keep, ground, perCell, originX, originZ });
    assert.ok(whole.count > 1000, `a cell that stands (${whole.count})`);
    for (const slice of (c < 3 ? [1, 777, G.GRASS_SLICE, perCell] : [777, G.GRASS_SLICE, perCell])) {
      const st = G.beginGrassCell(cx, cz, { perCell, originX, originZ });
      let steps = 0;
      while (!G.stepGrassCell(st, slice, { keep, ground })) steps++;
      assert.equal(steps, Math.ceil(perCell / slice) - 1, 'done on the slice that places the last candidate, not before');
      assert.equal(st.count, whole.count, `slice ${slice}: the same blades stood`);
      assert.equal(lanesOf(st), lanesOf(whole), `slice ${slice}: the same bytes, lane for lane`);
    }
  }
});

test('PERF-EXT22: on a walk no frame places more than one slice, every rim cell lands whole and exact, and the field ends where a whole fill would', () => {
  const { closures } = ring(2);
  const off = [-TERRAIN_SIZE, 0, 0];   // the walk is on a field that has crossed once: the slices ride its origin
  const cl0 = closures([0, 0, 0]), cl = closures(off);
  let calls = 0;
  const keep = (x, z) => { calls++; return cl.keep(x, z); };
  const R = laneRecorder();
  const field = G.createGrassField(R, cl0);
  const E = [409.6 + off[0], 0, 409.6];
  settle(field, [409.6, 0, 409.6], cl0);
  field.shiftOrigin(off);
  settle(field, E, { keep, ground: cl.ground });
  assert.equal(field.pending, null, 'a settled field has nothing half placed');
  R.writes.length = 0;
  // walk east at 9 m/s for 40 m, a frame at a time
  let ex = E[0], worst = 0, sliced = 0;
  for (let f = 0; f < 270; f++) {
    ex += 0.15;
    calls = 0;
    field.update(ex, E[2], keep, cl.ground);
    worst = Math.max(worst, calls);
    if (field.pending) sliced++;
  }
  for (let f = 0; f < 60; f++) field.update(ex, E[2], keep, cl.ground);
  assert.ok(worst <= G.GRASS_SLICE, `no walking frame asks keep() more than a slice (worst ${worst}; a whole cell is ${field.perCell})`);
  assert.ok(sliced > 20 && R.writes.length > 5, `the rim came in by slices (${sliced} frames with a cell in progress, ${R.writes.length} cells written)`);
  // every cell the walk wrote is the cell placeLabGrassCell makes, at the field's origin
  const written = new Map([...field.live.entries()].map(([k, h]) => [h.slot, h]));
  let checked = 0;
  for (const w of R.writes) {
    const h = written.get(w.slot);
    if (!h) continue;
    checked++;
    assert.equal(w.lanes, lanesOf(G.placeLabGrassCell(h.cx, h.cz, { keep: cl.keep, ground: cl.ground, perCell: field.perCell, originX: off[0], originZ: off[2] })), `cell ${h.cx},${h.cz}: the bytes a whole placement makes`);
  }
  assert.ok(checked > 5);
  // and the walk ends holding what a field filled at the end point holds -
  // plus the trailing cells PERF10's hysteresis keeps out to the span
  const fresh = G.createGrassField(laneRecorder(), cl0);
  fresh.shiftOrigin(off);
  settle(fresh, [ex, 0, E[2]], cl);
  const nearest = (h) => Math.hypot(Math.max(h.cx * G.GRASS_CELL + off[0] - ex, 0, ex - ((h.cx + 1) * G.GRASS_CELL + off[0])), Math.max(h.cz * G.GRASS_CELL - E[2], 0, E[2] - (h.cz + 1) * G.GRASS_CELL));
  const missing = [...fresh.live.keys()].filter((k) => !field.live.has(k));
  const extra = [...field.live.values()].filter((h) => !fresh.live.has(G.cellKey(h.cx, h.cz)));
  assert.deepEqual(missing, [], 'every cell a whole fill holds, the walk holds');
  assert.ok(extra.every((h) => nearest(h) > G.LAB_GRASS.range && nearest(h) <= G.LAB_GRASS.span), 'and the rest are the trailing rim the hysteresis keeps');
});

test('PERF-EXT22: inside the fade a cell still comes whole, a boot still fills two whole cells a frame, and a shift or an invalidate starts a half-placed cell again', () => {
  // the fade's start is the SHADER's (the lab's text), not a second guess of it
  const m = /smoothstep\(uRange\*([0-9.]+), uRange, d\)/.exec(G.LAB_GRASS_VS);
  assert.ok(m, 'the lab shader fades from a fraction of the range');
  assert.equal(G.GRASS_WHOLE_AT, Number(m[1]), 'a cell inside the fade start is placed whole');
  const { closures } = ring(2);
  const cl = closures([0, 0, 0]);
  let calls = 0;
  const keep = (x, z) => { calls++; return cl.keep(x, z); };
  const R = laneRecorder();
  const field = G.createGrassField(R, { keep, ground: cl.ground });
  // a boot is a catch-up: two whole cells on the first frame
  calls = 0;
  const missing = field.update(409.6, 409.6, keep, cl.ground);
  assert.ok(missing > G.GRASS_CATCH_UP && R.writes.length === 2 && calls === 2 * field.perCell, `a boot: two whole cells (${R.writes.length}, ${calls} keeps)`);
  // ...and it keeps that pace to the rim: only the last GRASS_CATCH_UP cells come a slice at a time
  const frames = settle(field, [409.6, 0, 409.6], { keep, ground: cl.ground });
  const whole = Math.ceil((field.live.size - G.GRASS_CATCH_UP) / 2), tail = G.GRASS_CATCH_UP * Math.ceil(field.perCell / G.GRASS_SLICE);
  assert.ok(frames <= whole + tail + 2, `the boot fills at two cells a frame to the last few (${frames} frames for ${field.live.size} cells; the old pace ${Math.ceil(field.live.size / 2)})`);
  // two inner cells re-read (an invalidate under the eye): whole, both on the next frame
  R.writes.length = 0;
  field.invalidate(400, 400, 420, 420);   // the eye's own cell and a neighbour, well inside the fade start
  calls = 0;
  field.update(409.6, 409.6, keep, cl.ground);
  assert.equal(R.writes.length, 2, 'the cells under the eye come back whole, on the frame they are missed');
  assert.equal(field.pending, null);
  // a half-placed rim cell: begun by a step, cancelled by a shift, by an
  // invalidate over it, and by the eye walking away before it is done
  let ex = 409.6;
  for (const cancel of ['shift', 'invalidate', 'walked away']) {
    for (let f = 0; f < 400 && !field.pending; f++) { ex += 0.15; field.update(ex, 409.6, keep, cl.ground); }
    const p = field.pending;
    assert.ok(p, 'a walk begins a rim cell');
    if (cancel === 'shift') field.shiftOrigin([0, 0, 0]);
    else if (cancel === 'invalidate') field.invalidate(p.cx * G.GRASS_CELL, p.cz * G.GRASS_CELL, p.cx * G.GRASS_CELL + 1, p.cz * G.GRASS_CELL + 1);
    else {
      field.update(ex - 60, 409.6, keep, cl.ground);   // sixty metres back: the cell is out of reach
      assert.ok(!field.live.has(p.key), 'and it is not written out of reach');
    }
    assert.equal(field.pending, null, `${cancel}: the half-placed cell is dropped, to be begun again from the world as it stands`);
    settle(field, [ex, 0, 409.6], { keep, ground: cl.ground });
    assert.ok(field.live.has(p.key), `${cancel}: and it lands on a later frame`);
  }
  // a cell no bigger than a slice is placed whole even at the rim
  const small = G.createGrassField(laneRecorder(), { ...cl, density: G.LAB_GRASS.density / 8 });
  assert.ok(small.perCell <= G.GRASS_SLICE);
  settle(small, [409.6, 0, 409.6], cl);
  let sx = 409.6, landed = 0;
  for (let f = 0; f < 200; f++) { sx += 0.15; const n = small.live.size; small.update(sx, 409.6, cl.keep, cl.ground); if (small.live.size > n) landed++; assert.equal(small.pending, null, 'nothing is left half placed'); }
  assert.ok(landed > 0, 'and the walk did bring cells in');
});

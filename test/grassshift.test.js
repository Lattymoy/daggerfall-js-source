// PERF-EXT-C (2026-09-25) - THE STREAMING HITCHES, the grass's share.
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

// ─── PERF-EXT-C1: THE DISC IS SWEPT ONCE ─────────────────────────────
test('PERF-EXT-C1: discSlotCount sweeps once per question - every field after the first reads the memo, and the world warms it at mount', () => {
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

// ─── PERF-EXT-C2: THE FIELD SURVIVES THE ORIGIN SHIFT ────────────────
test('PERF-EXT-C2: a crossing moves the field in place - no buffer re-specified, no cell uploaded, every slot drawn where it stood', () => {
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

test('PERF-EXT-C2: a field that crossed grows the same world as one that never did - the same cells, the same blades, the same tint', () => {
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

test('PERF-EXT-C2: invalidate after a shift drops exactly the cells whose squares, where they stand in the scene now, meet the rect', () => {
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

test('PERF-EXT-C2: the host moves the field at a shift, empties it at a teleport, and re-reads it wherever a pixel lands or joins the near ring', () => {
  const shift = WORLD.slice(WORLD.indexOf('    if (r.offset) {\n      // FloatingOrigin.OffsetPlayerController'), WORLD.indexOf('    if (r.pixelChanged) {\n      // P1: PlayerGPS.Update'));
  assert.ok(shift.length > 500, 'the shift block was found');
  assert.match(shift, /labGrassField\?\.shiftOrigin\(r\.offset\);/, 'the shift carries the field');
  assert.doesNotMatch(shift, /labGrassField = null/, 'and no longer throws it away');
  const tp = WORLD.slice(WORLD.indexOf('  async function _teleportToPixel('), WORLD.indexOf('    _wodArrival = wodArrivalOf(queue);'));
  assert.ok(tp.length > 1000, 'the teleport was found');
  const cut = tp.indexOf('\n    labGrassField = null;\n');
  assert.ok(cut > 0 && cut < tp.indexOf('queue.push(...state.init(px, py));') && !/\bawait\b/.test(tp.slice(cut, tp.indexOf('queue.push(...state.init(px, py));'))),
    'a new scene frame starts an empty field - said before state.init re-anchors the scene, with no frame between');
  assert.match(WORLD, /    _wodSiteWas\.delete\(key\);[^\n]*\n    if \(labGrassField\) \{[^\n]*\n      const t = state\.pixelTranslation\(px, py\);\n      labGrassField\.invalidate\(t\[0\], t\[2\], t\[0\] \+ TERRAIN_SIZE, t\[2\] \+ TERRAIN_SIZE\);/,
    'every published pixel re-reads the cells over it, not a location\'s alone');
  const rs = WORLD.slice(WORLD.indexOf('  function restrideTerrain('), WORLD.indexOf('  function destroyPixel('));
  assert.match(rs, /if \(stride === 1 && labGrassField\) \{\n      const t = state\.pixelTranslation\(p\.px, p\.py\);\n      labGrassField\.invalidate\(t\[0\], t\[2\], t\[0\] \+ TERRAIN_SIZE, t\[2\] \+ TERRAIN_SIZE\);/,
    'a promotion to the near ring re-reads the cells over it');
});

// OW-HITCH (2026-10-21, the owner: "Theres still a lot of hitching in the overworld. Can you please fix this properly";
// bible/07-Rendering/Performance-Priority.md OW-HITCH) - THE OVERWORLD'S HITCHES, MEASURED IN THE REAL GAME AND TAKEN OUT.
// Each change is held here to its claim: what it no longer does, and that what it makes is what was made.
//   1. the grass: a cleared cell uploads nothing, a written one its blades alone, and the field places into two cells'
//      arrays where it made 343 KB a cell - the same bytes;
//   2. the blood sheet grows on a page that never idles, a cell a wait, to the byte of the one built whole;
//   3. the snow under a blade asks the stream nothing (SNOW-FACE, merged after: no slope, so neither the drawn ground's
//      normals nor four of the stream's heights);
//   4. the snowpack's year and the weather's systems: the same answers, with no answer object a system;
//   5. a ground set's water: the same masks, a record at a time; the set made once a key and uploaded a few layers a breath.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LabGrassRenderer, createGrassField, beginGrassCell, stepGrassCell, placeLabGrassCell, grassPerCell, GRASS_CELL } from '../../src/render/labGrass.js';
import { cleanMask, markPuddleWater, markPuddleWaterSteps, carryPuddleMask, carryPuddleMaskSteps, stepsDone, stepsBreathing, PUDDLE_RECORDS, SHORE_RECORDS, DRY_RECORDS, MIN_PATCH_TEXELS } from '../../src/world/puddleMask.js';
import { fallAmong, wornAmong, systemsNear } from '../../src/systems/weather/weatherMap.js';
import { dayOfSky, dayAndHourOf, airFall, airFallInto, setAirGround } from '../../src/systems/weather/airTemperature.js';
import { createSnowCoverHost } from '../../src/scenes/snowCoverHost.js';
import { createGroundSets } from '../../src/scenes/groundSets.js';
import { Renderer, TILE_LAYERS_A_STEP } from '../../src/render/renderer.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

/** A WebGL2 just deep enough for the grass renderer and the tile arrays: every call recorded. */
function stubGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19, TEXTURE0: 20, TEXTURE3: 23 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}
const sha = (...arrays) => { const h = createHash('sha256'); for (const a of arrays) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); return h.digest('hex'); };

// ─── 1. THE GRASS ───────────────────────────────────────────────────

test('OW-HITCH grass: a cleared slot uploads nothing and is drawn by nobody; a written one uploads its blades alone - each lane from its start, `count` blades long - and an empty cell uploads nothing (mutants: the zeros back; the whole slot uploaded; an empty cell uploaded)', () => {
  const { gl, calls } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = 64;
  r.allocSlots(perCell, 4);
  const cell = (count) => {
    const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
    for (let i = 0; i < count; i++) { inst[i * 4] = i * 0.3; inst[i * 4 + 1] = i * 0.2; inst[i * 4 + 2] = 0.5; inst[i * 4 + 3] = 1; rootY[i] = 10; }
    return { inst, inst2, rootY, ground, count, perCell };
  };
  calls.length = 0;
  r.writeSlot(1, cell(20));
  const subs = calls.filter((c) => c[0] === 'bufferSubData');
  assert.equal(subs.length, 3, 'one upload a lane');
  for (const [k, s] of subs.entries()) {
    assert.equal(s[2], perCell * r._lanes[k].bytes, `lane ${k} lands at its slot`);
    assert.equal(s[3], r._packs[k], 'from the pack');
    assert.deepEqual([s[4], s[5]], [0, 20 * 4], 'its first 20 blades alone (four words a blade)');
  }
  calls.length = 0;
  r.writeSlot(2, cell(0));
  assert.equal(calls.filter((c) => c[0] === 'bufferSubData').length, 0, 'a cell no blade stood in uploads nothing');
  assert.equal(r.slotCount[2], 0); assert.equal(r.slotBox[2], null);
  calls.length = 0;
  r.clearSlot(1);
  assert.equal(calls.filter((c) => c[0] === 'bufferSubData' || c[0] === 'bindBuffer').length, 0, 'a cleared slot touches no buffer');
  assert.equal(r.slotCount[1], 0, 'its count is nought'); assert.equal(r.slotBox[1], null, 'and its box gone - so no draw meets it');
});

test('OW-HITCH grass: the field places into two cells\' arrays, never one a cell, and what each slot is handed is the bytes a new cell\'s arrays would hold - whole cells, rim cells by slices, a walk, a reused state zeroed first (mutants: no reuse; the reuse not zeroed; the rim cell begun on the whole cell\'s arrays)', () => {
  const perCell = grassPerCell();
  const keep = (x, z) => ((Math.floor(x / 7) + Math.floor(z / 5)) % 3 === 0 ? null : 0.5 * Math.sin(x * 0.01) + 0.2 * Math.cos(z * 0.013));
  const ground = (x, z) => [0.1 + 0.001 * (x % 50), 0.2, 0.05 + 0.001 * (z % 40)];
  const slope = (x, z) => [Math.sin(x * 0.02) * 0.2, 0.97, Math.cos(z * 0.02) * 0.2];
  // the bytes a slot is handed, against the cell placed alone into new arrays
  const arrays = new Set(), wrong = [];
  let written = 0;
  const r = {
    allocSlots() {}, clearSlot() {}, shiftSlots() {},
    writeSlot(_slot, placed) {
      arrays.add(placed.inst.buffer);
      written++;
      const cx = Math.floor((placed.inst[0] - 0) / GRASS_CELL), cz = Math.floor((placed.inst[1] - 0) / GRASS_CELL);
      // the cell is named by its first blade (the placer clusters a blade within 0.55 m of its own point in the cell)
      let alone = null;
      for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [1, -1], [-1, 1]]) {
        const c = placeLabGrassCell(cx + dx, cz + dz, { keep, ground, slope, perCell });
        if (c.count === placed.count && sha(c.inst) === sha(placed.inst)) { alone = c; break; }
      }
      if (!alone || sha(alone.inst, alone.inst2, alone.rootY, alone.ground, alone.slope) !== sha(placed.inst, placed.inst2, placed.rootY, placed.ground, placed.slope)) wrong.push(written);
    },
  };
  const field = createGrassField(r, { keep, ground, slope, range: 120, span: 150 });
  for (let f = 0; f < 400 && field.update(0, 0) !== 0; f++);   // the fill: whole cells, two a frame
  const filled = written;
  // a walk: the rim by slices - and every 7th frame a near cell re-read under the eye (a pixel published there), placed
  // whole while a rim cell may stand part-way: the two must never share arrays
  let pendingAtWhole = 0;
  for (let f = 0; f < 300; f++) {
    const ex = f * 0.9, ez = f * 0.4;
    if (f % 7 === 3) { if (field.pending) pendingAtWhole++; field.invalidate(ex - 2, ez - 2, ex + 2, ez + 2); }
    field.update(ex, ez);
  }
  assert.ok(pendingAtWhole > 3, `a near cell re-placed whole with a rim cell part-way (${pendingAtWhole} times)`);
  assert.ok(filled > 40 && written > filled + 3, `the fill wrote ${filled} cells, the walk ${written - filled} more`);
  assert.deepEqual(wrong, [], 'every cell the bytes it is placed alone');
  assert.ok(arrays.size <= 2, `${arrays.size} sets of arrays for ${written} cells`);
  // a reused state begins as a new one: zeroed, then placed the same
  const used = placeLabGrassCell(3, 4, { keep, ground, slope, perCell });
  const again = beginGrassCell(-2, 7, { perCell, reuse: used });
  assert.equal(again.inst, used.inst, 'the same arrays');
  stepGrassCell(again, perCell, { keep, ground, slope });
  const fresh = placeLabGrassCell(-2, 7, { keep, ground, slope, perCell });
  assert.equal(sha(again.inst, again.inst2, again.rootY, again.ground, again.slope), sha(fresh.inst, fresh.inst2, fresh.rootY, fresh.ground, fresh.slope), 'the same bytes, tail and all');
  assert.notEqual(beginGrassCell(0, 0, { perCell: perCell - 1, reuse: used }).inst, used.inst, 'another size is new arrays');
});

// ─── 2. THE BLOOD SHEET ─────────────────────────────────────────────

test('OW-HITCH blood: the sheet\'s prewarm asks with a wait, and on a page that never idles takes ONE cell a callback until it is whole - the sheet the first blow would build, to the byte (mutants: no wait asked; the whole sheet on a timeout)', async () => {
  const whole = (await import('../../src/combat/blood/bloodArt.js?whole')).bloodAtlas();
  const A = await import('../../src/combat/blood/bloodArt.js?busy');
  const asks = [];
  const idle = (fn, opts) => asks.push([fn, opts]);
  assert.equal(A.prewarmBloodAtlas(idle), true);
  assert.deepEqual(asks[0][1], { timeout: A.BLOOD_PREWARM_WAIT_MS }, 'the request names its wait');
  const cells = A.ATLAS_KINDS.length * A.ATLAS_CELLS;
  let calls = 0;
  while (asks.length) {
    const [fn, opts] = asks.shift();
    assert.equal(opts?.timeout, A.BLOOD_PREWARM_WAIT_MS);
    fn({ didTimeout: true, timeRemaining: () => 0 });   // the wait ran out: no idle time at all
    calls++;
    assert.ok(calls <= cells, 'never more callbacks than cells');
  }
  assert.equal(calls, cells, 'a cell a callback');
  assert.equal(sha(A.bloodAtlas().colors), sha(whole.colors), 'the sheet the first blow would have built');
  assert.equal(A.prewarmBloodAtlas(idle), false, 'made once');
});

// ─── 3. THE SNOW UNDER A BLADE ──────────────────────────────────────

// PIN MOVED (SNOW-FACE, FIELD BUGS 2026-10-21 - bible/01-Overview/bugs/Field-Bugs-2026-10-21.md; merged after this):
// the snow has no slope now, so the host asks the stream neither a height nor a normal - this test's own end, no lookups
// for a blade the grass places, held whole - and a cliff under a full cover is buried as level ground is (its tile has no
// rock to shed to). The normalOf door this test pinned went with the slope.
test('OW-HITCH snow: a blade\'s and the feet\'s snow asks the stream nothing - no height and no normal, on a cliff or on level ground - and a full cover buries every blade and whitens the feet on both (SNOW-FACE: no slope); the world host hands the snow host no ground reader', async () => {
  const woods = () => CLIMATES.Woodlands;
  setAirGround({ climateAt: woods, groundAt: () => 0, topAt: () => 900 });
  try {
    const t = (406 * 360 + 215) * 1440;
    const state = { compensation: [0, 0, 0], mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 }, pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 200) * 819.2; out[1] = 0; out[2] = -(py - 100) * 819.2; return out; } };
    const p = { px: 200, py: 100 };
    for (const name of ['steep', 'flat']) {
      let asked = 0;
      const ny = name === 'steep' ? 0.31 : 1;
      const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: woods, mapHeight: 500, stateOf: () => state, builtOf: () => new Map([['200,100', p]]),
        heightAt: (x) => { asked++; return x * (name === 'steep' ? 3 : 0); }, normalOf: (q, lx, lz, out) => { asked++; out[0] = 0; out[1] = ny; out[2] = 0; return out; },
        owns: () => true, markReskin: () => {}, markRebuild: () => {}, now: () => t, place: () => ({ px: 200, py: 100 }) });
      await host.settle({ left: () => Infinity, breathe: async () => {} });
      for (const l of host._lines.values()) { l.shown = Float32Array.of(-500, -400, -300); l.target = Float32Array.from(l.shown); }
      let buried = 0;
      for (let k = 0; k < 40; k++) buried += host.buries(p, 100 + k, 200, 10) ? 1 : 0;
      assert.deepEqual([buried, host.winterAt([5, 10, 5], false), asked], [40, true, 0], `${name}: every blade buried, the feet in snow, the stream asked nothing`);
    }
  } finally { setAirGround(null); }
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const call = w.slice(w.indexOf('const snowCover = createSnowCoverHost('), w.indexOf('const trees = createTreesHost('));
  assert.ok(call.length > 0 && !/heightAt|normalOf/.test(call), 'the world host hands the snow host no ground reader');
});

// ─── 4. THE SNOWPACK'S YEAR AND THE WEATHER'S SYSTEMS ───────────────

test('OW-HITCH weather: fallAmong is wornAmong\'s fall over the real map\'s systems, everywhere; dayOfSky is dayAndHourOf\'s day; airFallInto is airFall (mutants: a band\'s word, its intensity, the cover, the reach test)', () => {
  const cls = [CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Swamp, CLIMATES.Desert];
  const climateAt = (px, py) => cls[((px >> 3) + (py >> 3)) & 3];
  let wet = 0, places = 0;
  for (let k = 0; k < 60; k++) {
    const x = 250000 + k * 13777, z = 180000 + ((k * 7919) % 90000), minutes = (406 * 360 + (k * 37) % 360) * 1440 + k * 97;
    const systems = systemsNear(x, z, minutes, climateAt, 30000);
    for (let q = 0; q < 12; q++) {
      const px = x + (q - 6) * 2500, pz = z + ((q * 5) % 7 - 3) * 3100;
      const fall = fallAmong(systems, px, pz);
      assert.deepEqual(fall, wornAmong(systems, px, pz).fall, `place ${k}/${q}`);
      places++; if (fall.intensity > 0) wet++;
    }
  }
  assert.ok(wet > 20 && wet < places, `wet and dry places both met (${wet} of ${places})`);
  for (let m = -3000000; m < 3000000; m += 7919.5) assert.equal(dayOfSky(m), dayAndHourOf(m)[0]);
  for (const f of [null, { intensity: 0.4 }, { intensity: 2, snow: true, cover: 0.3 }, { intensity: 0.7, snow: 0.2 }, { snow: 'x', cover: null }]) {
    assert.deepEqual(airFallInto(f, { wet: 9, snow: 9, cover: 9, chill: 9 }), airFall(f));
  }
});

// ─── 5. A GROUND SET'S WATER, AND THE SET ITSELF ────────────────────

/** cleanMask as it stood before OW-HITCH - the law restated, a neighbours' array a texel. */
function cleanMaskBefore(wet, w, h, minArea = MIN_PATCH_TEXELS) {
  const seen = new Uint8Array(w * h), stack = [], patch = [];
  for (const want of [1, 0]) {
    seen.fill(0);
    for (let start = 0; start < w * h; start++) {
      if (seen[start] || wet[start] !== want) continue;
      patch.length = 0; stack.length = 0; stack.push(start); seen[start] = 1;
      let edge = false;
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i - x) / w;
        patch.push(i);
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j >= 0 && !seen[j] && wet[j] === want) { seen[j] = 1; stack.push(j); }
        }
      }
      if (patch.length < minArea && (want === 1 || !edge)) for (const i of patch) wet[i] = 1 - want;
    }
  }
  return wet;
}
/** A seeded set of `n` layers of `size` texels in a few colours - blues among them - painted in blobs. */
function paintedSet(seed, size = 32, n = 56) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const colours = [[30, 60, 160], [40, 70, 170], [120, 100, 60], [60, 130, 50], [35, 64, 150], [140, 140, 140]];
  return Array.from({ length: n }, (_, r) => {
    const c = new Uint8ClampedArray(size * size * 4);
    const blobs = Array.from({ length: 6 }, () => [rnd() * size, rnd() * size, 2 + rnd() * size / 3, Math.floor(rnd() * colours.length)]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let col = r === 0 ? 0 : 3;
      for (const [bx, by, br, bc] of blobs) if ((x - bx) ** 2 + (y - by) ** 2 < br * br) col = r === 0 ? (bc & 1 ? 1 : 4) : bc;
      if (rnd() < 0.02) col = Math.floor(rnd() * colours.length);   // the ground's grain
      c.set([...colours[col], 255], (y * size + x) * 4);
    }
    return { width: size, height: size, colors: c };
  });
}

test('OW-HITCH water: cleanMask finds the patches the old walk found, on any mask; the marks a record at a time are the marks whole, yielding between records, and their breathing run awaits between them (mutants: an edge patch dropped; a neighbour missed; no yield a record)', async () => {
  let s = 7;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 40; k++) {
    const w = 8 + Math.floor(rnd() * 40), h = 8 + Math.floor(rnd() * 40), p = 0.2 + rnd() * 0.6;
    const m = new Uint8Array(w * h).map(() => (rnd() < p ? 1 : 0));
    assert.deepEqual(cleanMask(m.slice(), w, h, 3 + (k % 40)), cleanMaskBefore(m.slice(), w, h, 3 + (k % 40)), `mask ${k} (${w} x ${h})`);
  }
  for (const seed of [1, 2, 3]) {
    const classic = paintedSet(seed), mod = paintedSet(seed + 10, 64);
    const marked = markPuddleWater(classic), carried = carryPuddleMask(mod, marked);
    let yields = 0;
    const steps = markPuddleWaterSteps(classic);
    for (;;) { const r = steps.next(); if (r.done) { assert.equal(sha(...r.value.map((l) => l.colors)), sha(...marked.map((l) => l.colors))); break; } yields++; }
    // a yield a record walked: the puddles, then the shores' count (record 0 and the shores, then the dry ones), then the shores marked
    assert.equal(yields, PUDDLE_RECORDS.length + (1 + SHORE_RECORDS.length) + DRY_RECORDS.length + SHORE_RECORDS.length, 'a yield a record walked');
    let breaths = 0;
    const out = await stepsBreathing(carryPuddleMaskSteps(mod, marked), async () => { breaths++; });
    assert.equal(sha(...out.map((l) => l.colors)), sha(...carried.map((l) => l.colors)), 'the carry breathing is the carry whole');
    assert.ok(breaths >= PUDDLE_RECORDS.length + SHORE_RECORDS.length, `breathed between its records (${breaths})`);
    assert.equal(sha(...stepsDone(carryPuddleMaskSteps(mod, marked)).map((l) => l.colors)), sha(...carried.map((l) => l.colors)));
  }
});

test('OW-HITCH ground sets: a set is made ONCE a key while builds ask for it together, its upload goes up TILE_LAYERS_A_STEP layers a breath and stands registered only whole, and a set already uploaded is not made again (mutants: a second make; the array registered before its last layer; no yield in the upload)', async () => {
  const log = [];
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'getExtension') return () => null;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const renderer = new Renderer({ getContext: () => stub, clientWidth: 64, clientHeight: 64, width: 64, height: 64 });
  const set = paintedSet(5, 8);
  let texReads = 0;
  const tex = { recordCount: set.length, getDFBitmap: (r) => r, getColor32: (r) => { texReads++; return set[r]; } };
  let breaths = 0, registeredAt = null, subsAtRegister = null;
  const tileArrays = renderer.tileArrays;
  const watch = new Proxy(tileArrays, { get: (m, k) => (k === 'set' ? (key, v) => { registeredAt = breaths; subsAtRegister = log.filter((c) => c[0] === 'texSubImage3D').length; return m.set(key, v); } : typeof m[k] === 'function' ? m[k].bind(m) : m[k]) });
  renderer.tileArrays = watch;
  const maps = { grassRecords: new Map(), floorRecords: new Map(), groundPuddles: new Map(), groundMeanColour: new Map(), groundDrawnMeans: new Map() };
  const sets = createGroundSets({ renderer, getTexture: async () => tex, labGrass: null, breathe: async () => { breaths++; await null; }, ...maps });
  const holds = [];
  log.length = 0;
  await Promise.all([sets.loadGroundSet(302, { tileArray: (k) => holds.push(k) }), sets.loadGroundSet(302, { tileArray: (k) => holds.push(k) })]);
  assert.deepEqual(holds, [302, 302], 'each build holds the set');
  assert.equal(log.filter((c) => c[0] === 'texImage3D').length, 1, 'one array made for the two builds');
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D').length, set.length, 'its layers uploaded once');
  assert.equal(log.filter((c) => c[0] === 'generateMipmap').length, 1);
  assert.equal(subsAtRegister, set.length, 'registered only when every layer stands');
  assert.ok(breaths > Math.floor(set.length / TILE_LAYERS_A_STEP) && registeredAt > 0, `breathed through the marks and the upload (${breaths})`);
  assert.equal(sets.loading, 0, 'nothing left on its way');
  assert.ok(maps.groundPuddles.has(302) && maps.grassRecords.has(302) && maps.groundMeanColour.has(302), 'the grass learned the set');
  assert.equal(maps.groundPuddles.get(302)[PUDDLE_RECORDS[0]].colors.length, set[PUDDLE_RECORDS[0]].colors.length);
  assert.equal(sha(...maps.groundPuddles.get(302).map((l) => l.colors)), sha(...markPuddleWater(set).map((l) => l.colors)), 'the grass\'s mask is the one the layers were marked with');
  const binds = log.filter((c) => c[0] === 'bindTexture' && c[1] === 'TEXTURE_2D_ARRAY').length;
  assert.ok(binds >= 1 + Math.floor((set.length - 1) / TILE_LAYERS_A_STEP), 'the array bound again after every yield');
  log.length = 0; breaths = 0;
  const reads = texReads;
  await sets.loadGroundSet(302, { tileArray() {} });
  assert.equal(log.filter((c) => c[0] === 'texSubImage3D').length, 0, 'an uploaded set is not uploaded again');
  assert.equal(texReads, reads, 'nor read again');
  renderer.tileArrays = tileArrays;
});

// ─── 6. THE LIVING WORLD'S TOWNS NEAR, AND THE MUSIC'S WINDOW ───────

test('OW-HITCH the towns near: a reach and a pixel are one number, never two alike across the map and half a map past it; the host keeps its answers by it, 8,192 of them (mutants: a key that folds the reach; the old bound)', async () => {
  const { livingNearKey, LIVING_NEAR_KEPT, INN_REACH_PX, TRIP_REACH_PX } = await import('../../src/systems/livingWorld/trips.js');
  const seen = new Map();
  for (const r of [0, INN_REACH_PX, 2, 3, TRIP_REACH_PX, 40]) {
    for (let py = -250; py < 750; py += 3) for (let px = -500; px < 1500; px += 11) {
      const k = livingNearKey(px, py, r);
      assert.ok(Number.isSafeInteger(k));
      const was = seen.get(k);
      assert.ok(was === undefined, `${px},${py},${r} and ${was} share a key`);
      seen.set(k, `${px},${py},${r}`);
    }
  }
  assert.equal(LIVING_NEAR_KEPT, 8192);
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.equal(w.split('const key = livingNearKey(px, py, r);   // OW-HITCH').length - 1, 2, 'the towns\' book and the dungeons\'');
  assert.equal(w.split('.size > LIVING_NEAR_KEPT) ').length - 1, 2, 'each kept to the bound');
});

test('OW-HITCH the music\'s window: the events of [from, to) found by halving are the ones the walk from the first event found - every window of a long song, on its boundaries too (mutants: the window closed at its start; open at its end)', async () => {
  const { eventsInWindow } = await import('../../src/systems/song/songPlayer.js');
  const before = (events, fromTick, toTick) => { const out = []; for (const e of events) { if (e.tick >= toTick) break; if (e.tick >= fromTick) out.push(e); } return out; };
  let s = 3;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let song = 0; song < 6; song++) {
    let tick = 0;
    const events = Array.from({ length: 400 + song * 300 }, (_, i) => ({ i, tick: (tick += Math.floor(rnd() * 4) * 120) }));   // ties: chords on one tick
    for (let k = 0; k < 300; k++) {
      const from = Math.floor(rnd() * (tick + 500)) - 100, to = from + Math.floor(rnd() * 2000);
      assert.deepEqual(eventsInWindow(events, from, to), before(events, from, to), `song ${song} [${from}, ${to})`);
      const at = events[Math.floor(rnd() * events.length)].tick;
      assert.deepEqual(eventsInWindow(events, at, at + 480), before(events, at, at + 480), 'a window starting on an event');
    }
  }
  assert.deepEqual(eventsInWindow([], 0, 10), []);
});

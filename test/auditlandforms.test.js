// AUDIT LANDFORMS (2026-10-07, Mac: "Dont worry about it. Instead let's do just an audit and ensure this is perfect")
// - the audit of LANDFORM1-3 (bible/03-World/Landforms.md, the record bible/01-Overview/Audit-Landforms.md). Every
// finding fixed here was reproduced first, on the real WOODS.WLD and on this synthetic world, and each pin below fails
// on the code as it stood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generateSamples, sampleKernel, kernelTerms, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { createLandforms, reliefLift, landformLift, landformLiftField, LANDFORM_DIALS, LANDFORM_KNEE, LANDFORM_FLOOR } from '../src/world/landforms.js';
import { generatePixelTerrain, restrideGrid } from '../src/world/terrainGen.js';
import { waterCorners, WATER_DRAW_MASK_TABLE } from '../src/world/waterCorners.js';
import { DIR, DIR_DELTA } from '../src/world/roadNetwork.js';
import { retryModRoads, MOD_ROADS, MOD_ROADS_RETRY_MAX } from '../src/world/roadsProducer.js';
import { ringHeight, buildFarRingGrid } from '../src/render/farRing.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;
const at = (s, x, y) => s[x * H + y];
const load = (bytes) => { const w = new WoodsFile(); assert.equal(w.load(bytes), true); return w; };
const WOODS_BYTES = syntheticWoodsBytes();
const woods = load(WOODS_BYTES.slice());
const NET = network();
const LF = createLandforms({ woods, roads: NET });
const RELIEF = createLandforms({ woods });
const dry = new Uint8Array(NET.roads.length);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
const between = (from, to) => { const i = WORLD.indexOf(from), j = WORLD.indexOf(to, i); assert.ok(i > 0 && j > i, from); return WORLD.slice(i, j); };
// auditrest3's harness: a host's own function lifted off world.js by its AST and mounted over stubs
const fnOf = (name) => {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(acorn.parse(WORLD, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.ok(hit, name);
  return WORLD.slice(hit.start, hit.end);
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

test('AUDIT LANDFORMS E2: a channel is the water\'s - a road crossing a river stands on its own bed alone, so the painted water never climbs the road\'s fill out of its floor', () => {
  // the synthetic world's crossing: the road north-south down x = 64 of pixel (300, 255), the river east-west down y = 64
  const px = 300, py = 255;
  const full = generateSamples(woods, px, py, H, createLandforms({ woods, roads: NET }));
  const water = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, roads: dry, tracks: dry } }));
  const road = LANDFORM_DIALS.road;
  // on the river's floor and off the road's own bed, the river's channel stands - the road's bank and verge give way
  for (let y = 64 - LANDFORM_DIALS.river.flat; y <= 64 + LANDFORM_DIALS.river.flat; y++) {
    for (const x of [61, 60, 58, 55, 67, 68, 70, 73]) {
      assert.ok(Math.abs(x - 64) > road.flat);
      assert.ok(Object.is(at(full, x, y), at(water, x, y)), `(${x}, ${y}): the channel's floor, not the road's fill (${((at(full, x, y) - at(water, x, y)) * UNIT).toFixed(2)} units over it)`);
    }
  }
  // and the road keeps its own bed across the river: the causeway's top, level at the road's grade
  for (const x of [63, 64, 65]) assert.ok(at(full, x, 64) > at(water, x, 64) + 1 / UNIT, `x=${x}: the causeway stands over the channel`);
  // away from the river the road's bank and verge are whole, as they were
  const roadOnly = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, rivers: dry, streams: dry } }));
  for (const x of [60, 58, 55]) assert.ok(Object.is(at(full, x, 20), at(roadOnly, x, 20)), `(${x}, 20): the road's own bank, off the channel`);
  // and past the channel's bank top - in the river's verge - the road's bank is whole again: the channel is the floor and
  // the bank, not the river's whole reach
  for (const y of [58, 70]) for (const x of [61, 67]) assert.ok(Object.is(at(full, x, y), at(roadOnly, x, y)), `(${x}, ${y}): in the river's verge the road's bank stands`);
  // the painted water, as the pipeline paints it: every wet corner off the road's bed stands on the channel's floor
  const out = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: NET, landform: true });
  let wet = 0;
  for (let ty = 0; ty < 128; ty++) for (let tx = 0; tx < 128; tx++) {
    const m = waterCorners(out.tilemapBytes[ty * 128 + tx], WATER_DRAW_MASK_TABLE);
    for (let k = 0; k < 4; k++) {
      if (!(m & (1 << k))) continue;
      const x = tx + (k & 1), y = ty + (k >> 1);
      if (Math.abs(x - 64) <= road.flat) continue;   // the corner a water tile shares with the road's bed: the causeway's edge
      wet++;
      assert.ok(Math.abs(out.samples[x * H + y] - at(water, x, y)) * UNIT < 1e-3, `wet corner (${x}, ${y}) on the floor`);
    }
  }
  assert.ok(wet > 200, `the river's water tiles were read (${wet})`);
});

test('AUDIT LANDFORMS E1: a road on a hillside is cut into the high side and filled down to the low side over the same bank - no level shelf the bank\'s whole width', () => {
  // a steep hillside: bytes rising 16 a pixel eastward across pixels (150..156, 400..420), so the land climbs about one
  // kernel unit a sample across a road run north-south down the middle of pixel (153, 410)
  const bytes = syntheticWoodsBytes();
  const hm = new DataView(bytes.buffer).getUint32(28, true);
  for (let y = 396; y <= 424; y++) for (let x = 146; x <= 160; x++) bytes[hm + y * MAP_WIDTH + x] = Math.max(2, Math.min(126, 22 + (x - 150) * 16));
  const hill = load(bytes);
  const net = network();
  for (let y = 400; y <= 420; y++) net.roads[y * MAP_WIDTH + 153] |= DIR.N | DIR.S;
  const px = 153, py = 410;
  const cut = generateSamples(hill, px, py, H, createLandforms({ woods: hill, roads: net }));
  const smooth = sampleKernel(hill, px, py, H, false, createLandforms({ woods: hill }));   // the lifted land, no ground noise
  const road = LANDFORM_DIALS.road, edge = road.flat + road.bank;
  for (const y of [30, 64, 96]) {
    const bed = at(cut, 64, y);
    for (const x of [63, 65]) assert.ok(Math.abs(at(cut, x, y) - bed) * UNIT < 0.02, `y=${y}: level across the painted road`);
    // the low side (west): the bank falls from the bed toward the land, between them - never level with the bed
    for (let d = 2; d < edge; d++) {
      const x = 64 - d, v = at(cut, x, y) * UNIT, b = bed * UNIT, land = smooth(x, y) * UNIT;
      assert.ok(land < b - 1, `y=${y} d=${d}: the land lies below the bed here`);
      assert.ok(v < b - 0.05 && v >= land - 1e-6, `y=${y} d=${d}: the low bank (${v.toFixed(2)}) falls from the bed (${b.toFixed(2)}) toward the land (${land.toFixed(2)})`);
    }
    // the high side (east): cut, between the bed and the land, as before
    for (let d = 2; d < edge; d++) {
      const x = 64 + d, v = at(cut, x, y) * UNIT, b = bed * UNIT, land = smooth(x, y) * UNIT;
      assert.ok(land > b + 1 && v > b + 0.05 && v <= land + 1e-6, `y=${y} d=${d}: the high bank rises from the bed toward the land`);
    }
  }
  // a river keeps its levee: on the same hillside its low bank still stands `drop` over its floor (LANDFORM3)
  const wet = network();
  for (let y = 400; y <= 420; y++) wet.rivers[y * MAP_WIDTH + 153] |= DIR.N | DIR.S;
  const river = generateSamples(hill, px, py, H, createLandforms({ woods: hill, roads: wet }));
  const floor = at(river, 64, 64) * UNIT, rd = LANDFORM_DIALS.river;
  for (const x of [61, 60]) assert.ok(at(river, x, 64) * UNIT > floor + 0.5 * rd.drop, `x=${x}: the river's low bank is a levee over its floor`);
});

// ---- C1/B4: a record's heights in DFU's frame --------------------------------------------------------------------------

/** world.js's groundFrameHeight, groundFrameNative, restandHeight and scaleOf, sliced and run over a stub ground and lift
 *  (test/landform.test.js's restander; the frame stub's natives are scene coordinates offset by (100, 200)). */
function frame({ landform = true, lift = () => 0, ground = () => null, comp = 0 } = {}) {
  const body = between('  const groundFrameHeight = (y, x, z) =>', '  // Building doors (P3)');
  const state = { compensation: [0, comp, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200], worldCoords: (p) => ({ x: p[0] + 100, z: p[2] + 200 }) };
  const heightAt = (x, z) => (ground(x, z) == null ? -Infinity : ground(x, z) + comp);
  const f = new Function('heightAt', 'state', 'STREAMING_TERRAIN_SCALE', 'DEFAULT_TERRAIN_SCALE', 'landform', 'landformLiftAt', `${body}\nreturn { groundFrameHeight, groundFrameNative, restandHeight, scaleOf };`)(heightAt, state, STREAMING_TERRAIN_SCALE, 1.5, landform, lift);
  return { ...f, state };
}

test('AUDIT LANDFORMS C1: every exterior height a record carries is written in DFU\'s frame - the save\'s player, piles, torches, camps, foes, guards and inside pools, the scene cache, the anchor, the ship\'s deck and a dungeon\'s outer camps', () => {
  const writers = [
    ['pixel: playerTravelPixel(), nativeX: wc.x, nativeZ: wc.z, y: groundFrameHeight(pf[1] - state.compensation[1], pf[0], pf[2]),', 1, 'the save\'s player'],
    ['piles: droppedLoot.snapshotWorld((pos) => state.worldCoords(pos)).map((sp) => ({ ...sp, y: groundFrameNative(sp.nativeX, sp.nativeZ, sp.y - state.compensation[1]) })),', 1, 'its piles'],
    ['droppedTorches: droppedTorches.snapshot((pos) => { const wc = state.worldCoords(pos); return [wc.x, groundFrameHeight(pos[1] - state.compensation[1], pos[0], pos[2]), wc.z]; }),', 2, 'its torches, and the scene cache\'s'],
    ['camps: camps.snapshot(campToRecord),', 1, 'its camps'],
    ['foes: exteriorFoes.snapshotWorld((pos) => state.worldCoords(pos)).map((sf) => ({ ...sf, y: groundFrameNative(sf.nativeX, sf.nativeZ, sf.y - state.compensation[1]) })),', 1, 'its foes'],
    ['guards: cityGuards.snapshotWorld((pos) => state.worldCoords(pos)).map((sg) => ({ ...sg, y: groundFrameNative(sg.nativeX, sg.nativeZ, sg.y - state.compensation[1]) })),', 1, 'its guards'],
    ['const shed = (rows) => (rows ?? []).map((r) => ({ ...r, y: groundFrameNative(r.nativeX, r.nativeZ, r.y - state.compensation[1]) }));', 1, 'the inside pools'],
    ['.map((sp) => ({ ...sp, containerType: LOOT_CONTAINER_TYPES.DroppedLoot, y: groundFrameNative(sp.nativeX, sp.nativeZ, sp.y - state.compensation[1]) })),', 1, 'the scene cache\'s piles'],
    ['y: groundFrameHeight(pf[1] - state.compensation[1], pf[0], pf[2]),   // AUDIT LANDFORMS C1: DFU\'s frame\n      terrainScale: STREAMING_TERRAIN_SCALE,   // TERRAIN-SCALE1: the ground that height stands on', 1, 'the anchor'],
    ['pos: [player.pos[0], groundFrameHeight(player.pos[1] - state.compensation[1], player.pos[0], player.pos[2]) + state.compensation[1], player.pos[2]], yaw: cam.yaw, terrainScale: STREAMING_TERRAIN_SCALE }', 1, 'the ship\'s deck'],
    ['outerCampsSave: () => camps.snapshot(campToRecord),', 1, 'a dungeon\'s outer camps'],
    ['const campToRecord = (pos) => { const n = campToNatives(pos); return [n[0], groundFrameHeight(n[1], pos[0], pos[2]), n[2]]; };', 1, 'a camp as a record keeps it'],
  ];
  for (const [line, n, what] of writers) assert.equal(WORLD.split(line).length - 1, n, what);
  // and nothing writes one raw any more
  for (const raw of ['y: sp.y - state.compensation[1] }', 'y: sf.y - state.compensation[1] }', 'y: sg.y - state.compensation[1] }', 'y: r.y - state.compensation[1] }', 'pos: [...player.pos], yaw: cam.yaw, terrainScale', 'return [wc.x, pos[1] - state.compensation[1], wc.z]; }),']) {
    assert.equal(WORLD.includes(raw), false, raw);
  }
  // the camps' natives alone only across a recenter, this ground both ways
  assert.deepEqual(WORLD.match(/[^\n]*camps\.snapshot\(campToNatives\)[^\n]*/g).map((l) => l.trim()), ['const campsHeld = camps.snapshot(campToNatives);']);
});

test('AUDIT LANDFORMS C1: a scene cache\'s piles and torches go in DFU\'s frame and come back on today\'s ground - with the row on, exactly where they stood; with it off, as far over DFU\'s ground', () => {
  const lift = (x, z) => 100 + x + 2 * z;   // a lift that differs spot to spot, so each record must take its own
  const run = (writeOn, readOn) => {
    const w = frame({ landform: writeOn, lift }), r = frame({ landform: readOn, lift });
    let entry = null;
    mount(`${fnOf('cacheExteriorScene')}\nreturn cacheExteriorScene;`, {
      cacheScene: (c, n, e) => { entry = JSON.parse(JSON.stringify(e)); }, _sceneCache: () => null, worldSceneName: () => 'W',
      droppedLoot: { snapshotWorld: (to) => [{ ...to([3, 0, 4]), nativeX: 103, nativeZ: 204, y: 950, items: [] }] },
      droppedTorches: { snapshot: (to) => [{ position: to([5, 960, 6]) }] }, LOOT_CONTAINER_TYPES: { DroppedLoot: 7 },
      state: w.state, STREAMING_TERRAIN_SCALE, groundFrameNative: w.groundFrameNative, groundFrameHeight: w.groundFrameHeight,
    })({ x: 1, y: 2 });
    const got = {};
    mount(`${fnOf('restoreExteriorScene')}\nreturn restoreExteriorScene;`, {
      restoreCachedScene: () => entry, _sceneCache: () => null, worldSceneName: () => 'W', state: r.state,
      restandHeight: r.restandHeight, scaleOf: r.scaleOf,
      droppedLoot: { restoreWorld: (rows) => { got.pile = rows[0].y; } },
      droppedTorches: { restore: (rows, from) => { got.torch = from(rows[0].position)[1]; } },
    })({ x: 1, y: 2 });
    return { entry, got };
  };
  const on = run(true, true);
  assert.equal(on.entry.lootContainers[0].y, 950 - lift(3, 4), 'written: the lift at its own spot taken off');
  assert.equal(on.entry.droppedTorches[0].position[1], 960 - lift(5, 6));
  assert.equal(Object.hasOwn(on.entry, 'landforms'), false, 'and no stamp');
  assert.deepEqual(on.got, { pile: 950, torch: 960 }, 'read with the row on: where they stood');
  const off = run(true, false);
  assert.deepEqual(off.got, { pile: 950 - lift(3, 4), torch: 960 - lift(5, 6) }, 'read with it off - or by a build without it: as far over DFU\'s ground');
  const plain = run(false, true);
  assert.deepEqual(plain.got, { pile: 950 + lift(3, 4), torch: 960 + lift(5, 6) }, 'a cache written with the row off, read with it on: lifted with its ground');
});

test('AUDIT LANDFORMS C1: the quickload and the camps left outside stand every height again while the row is on - its lift goes back on whatever the scale; off, a save on today\'s scale lands as it came', () => {
  const body = between('        const was = scaleOf(extras.terrainScale);', '        if (extras.interior) {');
  const helpers = (extras, landform) => {
    const calls = [];
    const api = new Function('extras', 'state', 'restandHeight', 'scaleOf', 'STREAMING_TERRAIN_SCALE', 'landform', `${body}\nreturn { restandRows, restandAt };`)(extras, { localFromWorld: (nx, nz) => [nx - 100, nz - 200] }, (y, x, z, was) => { calls.push([y, x, z, was]); return y + 1000; }, (s) => (s > 0 ? s : 1.5), STREAMING_TERRAIN_SCALE, landform);
    return { ...api, calls };
  };
  const rows = [{ nativeX: 110, nativeZ: 220, y: 50 }];
  const on = helpers({ terrainScale: STREAMING_TERRAIN_SCALE }, true);
  assert.deepEqual(on.restandRows(rows), [{ nativeX: 110, nativeZ: 220, y: 1050 }]);
  assert.deepEqual(on.restandAt('pos')([{ pos: [101, 7, 202] }]), [{ pos: [101, 1007, 202] }]);
  assert.deepEqual(on.calls, [[50, 10, 20, STREAMING_TERRAIN_SCALE], [7, 1, 2, STREAMING_TERRAIN_SCALE]], 'each at its own spot');
  const off = helpers({ terrainScale: STREAMING_TERRAIN_SCALE }, false);
  assert.equal(off.restandRows(rows), rows, 'the row off, today\'s scale: as it came');
  assert.equal(off.calls.length, 0);
  // the camps a dungeon save carries outside (standSavedOuterCamps)
  const stood = [];
  const st = {
    camps: { dropOwn: () => {}, restore: (r) => stood.push(r) }, scaleOf: (s) => (s > 0 ? s : 1.5), STREAMING_TERRAIN_SCALE,
    state: { localFromWorld: (x, z) => [x - 100, z - 200] }, restandHeight: (y, x, z, was) => `${y}@${x},${z}/${was}`, campFromNatives: null, landform: true,
  };
  const stand = mount(`${fnOf('standSavedOuterCamps')}\nreturn standSavedOuterCamps;`, st);
  const outer = [{ pos: [101, 5, 202] }];
  stand({ world: { outerCamps: outer }, terrainScale: STREAMING_TERRAIN_SCALE });
  assert.deepEqual(stood.at(-1), [{ pos: [101, `5@1,2/${STREAMING_TERRAIN_SCALE}`, 202] }], 'the row on: the lift put back on');
  st.landform = false;
  stand({ world: { outerCamps: outer }, terrainScale: STREAMING_TERRAIN_SCALE });
  assert.equal(stood.at(-1), outer, 'off, today\'s scale: as they came');
});

// ---- B1/A1, D1: the lift a record takes ----------------------------------------------------------------------------------

/** world.js's landformLiftAt, sliced and run over a real streaming frame, recentred: `bind` sets what its pixels not built
 *  yet will stand (_liftLocationAt), as the boot binds it. */
function liftAtHost({ built = new Map(), index = new Map(), rects = new Map(), net = { at: NET } } = {}) {
  const body = between('  const _liftFields = new Map();', '  /** AUDIT LANDFORMS C1/B4: A HEIGHT GOES INTO A RECORD IN DFU\'S FRAME.');
  const state = new StreamingWorldState();
  state.init(329, 251);
  state.compensation = [37.5, 12, -91.25];
  const heightCell = TERRAIN_SIZE / (H - 1);
  const asked = [];
  const setLocationTiles = (loc, maps, blocks, tilemap) => { asked.push(loc.name); assert.equal(tilemap.length, 128 * 128); return rects.get(loc.name) ?? null; };
  const host = new Function('state', 'woods', 'built', 'locationIndex', 'setLocationTiles', 'maps', 'blocks', 'TERRAIN_SIZE', 'heightCell', 'MAP_WIDTH', 'MAP_HEIGHT', 'landformLiftField', 'STREAMING_TERRAIN_SCALE', 'HEIGHTMAP_DIMENSION', 'terrainGen', 'landformsHere',
    `${body}\nreturn { landformLiftAt, bind: (f) => { _liftLocationAt = f; } };`)(state, woods, built, index, setLocationTiles, {}, {}, TERRAIN_SIZE, heightCell, MAP_WIDTH, MAP_HEIGHT, landformLiftField, STREAMING_TERRAIN_SCALE, H, { roads: () => net.at }, () => createLandforms({ woods, roads: net.at }));
  const scene = (px, py, sx, sy) => { const t = state.pixelTranslation(px, py); return [t[0] + sx * heightCell, t[2] + sy * heightCell]; };
  return { ...host, scene, asked, state };
}

test('AUDIT LANDFORMS B1: the lift a record takes is the scene point\'s own - its pixel and sample under a recentred frame, in world units, through its location\'s own rect whether the pixel is built or not', () => {
  const px = 330, py = 250, rect = { xMin: 40, xMax: 80, yMin: 50, yMax: 90 };   // the mountain's flank: an uneven lift
  const town = { name: 'Town', exterior: { exteriorData: {} }, mapTableData: {} };
  const built = new Map(), index = new Map([[`${px},${py}`, town]]);
  const h = liftAtHost({ built, index, rects: new Map([['Town', rect]]) });
  const [x, z] = h.scene(px, py, 20.5, 70.25);
  const wild = landformLift(woods, px, py, 20.5, 70.25, null, H, LF) * STREAMING_TERRAIN_SCALE;
  const blended = landformLift(woods, px, py, 20.5, 70.25, rect, H, LF) * STREAMING_TERRAIN_SCALE;
  assert.ok(Math.abs(blended - wild) > 1, `the town's blend moves it (${wild.toFixed(2)} wild, ${blended.toFixed(2)} through the rect)`);
  // not built yet - the load's path: the rect the build will stamp, asked of the location itself, once
  const first = h.landformLiftAt(x, z);
  assert.ok(Math.abs(first - blended) < 1e-9, `unbuilt: through the town's rect (${first})`);
  assert.ok(Math.abs(h.landformLiftAt(...h.scene(px, py, 60, 70)) - landformLift(woods, px, py, 60, 70, rect, H, LF) * STREAMING_TERRAIN_SCALE) < 1e-9);
  assert.deepEqual(h.asked, ['Town'], 'the rect kept for the next record there');
  index.set(`${px},${py}`, { ...town });   // another place stands there now: asked again
  h.landformLiftAt(x, z);
  assert.deepEqual(h.asked, ['Town', 'Town']);
  // built: the build's own rect, read off the entry; a pixel built with no location keeps the wild lift (its own key)
  built.set(`${px},${py}`, { locationRect: rect });
  assert.ok(Math.abs(h.landformLiftAt(x, z) - blended) < 1e-9);
  built.set(`${px},${py}`, { locationRect: null });
  assert.ok(Math.abs(h.landformLiftAt(x, z) - wild) < 1e-9, 'a pixel built bare: the wild lift, not the town\'s kept field');
  assert.deepEqual(h.asked, ['Town', 'Town'], 'a built pixel never asks the location');
  // no location at all: the wild lift
  const bare = liftAtHost();
  const [bx, bz] = bare.scene(px, py, 20.5, 70.25);
  assert.ok(Math.abs(bare.landformLiftAt(bx, bz) - wild) < 1e-9);
  // the edges of a pixel and a point off the map
  const [ex, ez] = bare.scene(px, py, 127.5, 0.5);
  assert.ok(Math.abs(bare.landformLiftAt(ex, ez) - landformLift(woods, px, py, 127.5, 0.5, null, H, LF) * STREAMING_TERRAIN_SCALE) < 1e-9);
  const far = bare.scene(-5, py, 10, 10);
  assert.equal(bare.landformLiftAt(...far), 0, 'off the map: no lift');
  // B2: by a road the lift a record takes is the cut's too, over the network this thread holds - and made again once
  // the network lands
  const net = { at: null };
  const road = liftAtHost({ net });
  const [rx, rz] = road.scene(300, 250, 61.5, 40);
  const lifted = landformLift(woods, 300, 250, 61.5, 40, null, H, createLandforms({ woods })) * STREAMING_TERRAIN_SCALE;
  assert.ok(Math.abs(road.landformLiftAt(rx, rz) - lifted) < 1e-9, 'before the network lands: the lift alone, as the pixels stand');
  net.at = NET;
  const cut = landformLift(woods, 300, 250, 61.5, 40, null, H, LF) * STREAMING_TERRAIN_SCALE;
  assert.ok(Math.abs(cut - lifted) > 0.5, `the road's bank moves it (${(cut - lifted).toFixed(2)})`);
  assert.ok(Math.abs(road.landformLiftAt(rx, rz) - cut) < 1e-9, 'once it lands: the cut too');
});

test('AUDIT LANDFORMS B1: a pixel not built yet is asked what its build will stand - the index\'s place, else online the spawn its roll stands; never a spawn past its time; asked of the bound probe', () => {
  const px = 330, py = 250, rect = { xMin: 50, xMax: 70, yMin: 50, yMax: 70 };
  const spawn = { name: 'Spawn', spawned: true, exterior: { exteriorData: {} }, mapTableData: {} };
  const h = liftAtHost({ rects: new Map([['Spawn', rect]]) });
  const [x, z] = h.scene(px, py, 60, 60);
  const wild = landformLift(woods, px, py, 60, 60, null, H, LF) * STREAMING_TERRAIN_SCALE;
  assert.ok(Math.abs(h.landformLiftAt(x, z) - wild) < 1e-9, 'before the boot binds the probe: the index alone');
  h.bind((qx, qy) => (qx === px && qy === py ? spawn : null));
  assert.ok(Math.abs(h.landformLiftAt(x, z) - landformLift(woods, px, py, 60, 60, rect, H, LF) * STREAMING_TERRAIN_SCALE) < 1e-9, 'bound: the spawn\'s rect');
  // the binding itself: _locationToBuild's answer, side-effect free
  const line = WORLD.match(/\n {2}(_liftLocationAt = \(x, y\) => [^\n]*;)/);
  assert.ok(line, 'the boot binds it');
  const probe = (index, gone, at) => new Function('locationIndex', 'tvSpawnGone', 'tvLocationAt', `let _liftLocationAt = null; ${line[1]}\nreturn _liftLocationAt;`)(index, gone, at);
  const town = { name: 'Town' }, rolled = { name: 'Rolled', spawned: true };
  const index = new Map([['1,1', town], ['2,2', spawn]]), before = [...index];
  const tvLocationAt = (x2, y2) => index.get(`${x2},${y2}`) ?? (x2 === 3 ? rolled : null);
  const ask = probe(index, (x2) => x2 === 2, tvLocationAt);
  assert.equal(ask(1, 1), town, 'the index\'s place');
  assert.equal(ask(2, 2), null, 'a spawn past its time with nobody in it: built empty');
  assert.equal(probe(index, () => false, tvLocationAt)(2, 2), spawn, 'one in its time: the spawn');
  assert.equal(ask(3, 3), rolled, 'a pixel the index has not met: the roll\'s spawn');
  assert.equal(ask(4, 4), null);
  assert.deepEqual([...index], before, 'and the index is as it was');
  assert.match(WORLD, /const tvLocationAt = \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\) \?\? \(params\.has\('online'\) && spawnsDungeon\(_spawnSalt, x, y\) \? tvSpawnAt\(x, y\) : null\);\n(?: {2}\/\/[^\n]*\n)* {2}_liftLocationAt = /, 'bound right where the probe stands');
});

test('AUDIT LANDFORMS B2: a record\'s frame follows the cuts - the field is the pipeline\'s own shaped ground less DFU\'s, a road\'s cut and fill and a river\'s channel with the lift, in the wild and through a town\'s blend', () => {
  const flat = { ...NET, smooth: false };   // the mod's SmoothRoads, after the blend, is the one step the field does not take
  const lf = createLandforms({ woods, roads: flat });
  for (const [px, py, rect] of [[300, 250, null], [300, 255, null], [352, 200, null], [300, 255, { xMin: 70, xMax: 100, yMin: 20, yMax: 50 }], [352, 200, { xMin: 40, xMax: 60, yMin: 70, yMax: 90 }]]) {
    const run = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: !!rect, climateType: 231, roads: flat, landform }).samples;
    const dfu = run(false), shaped = run(true);
    const field = landformLiftField(woods, px, py, rect, H, lf), liftAlone = landformLiftField(woods, px, py, rect);
    let followed = 0;
    for (let x = 0; x <= 128; x++) for (let y = 0; y <= 128; y++) {
      const truth = (at(shaped, x, y) - at(dfu, x, y)) * UNIT;
      assert.ok(Math.abs(field(x, y) - truth) < 1e-3, `${px},${py}${rect ? ' (a town)' : ''} (${x},${y}): ${field(x, y)} against the pipeline's ${truth}`);
      if (Math.abs(truth - liftAlone(x, y)) > 0.5) followed++;
    }
    assert.ok(followed > 100, `${px},${py}: the cut followed where the lift alone was half a unit off (${followed} samples)`);
  }
  // between samples, the read the collider takes
  const field = landformLiftField(woods, 300, 250, null, H, lf);
  const v = (x, y) => field(x, y);
  assert.ok(Math.abs(field(60.5, 30.25) - (v(60, 30) * 0.5 * 0.75 + v(61, 30) * 0.5 * 0.75 + v(60, 31) * 0.5 * 0.25 + v(61, 31) * 0.5 * 0.25)) < 1e-9);
});

// ---- D3: the tiles ---------------------------------------------------------------------------------------------------------

test('AUDIT LANDFORMS D3: the landforms move the ground, never a tile - a coastal town\'s blend classifies DFU\'s own samples, so its beach stands where DFU\'s does however far the massif behind it lifts the town', () => {
  // a sea cliff: bytes of 120 east of x = 104 across rows 140..160, so pixel (104, 150) runs from the beach up a massif
  // the relief lifts, and its mean - the town's levelled ground - with it
  const bytes = syntheticWoodsBytes();
  const hm = new DataView(bytes.buffer).getUint32(28, true);
  for (let y = 140; y <= 160; y++) for (let x = 104; x <= 110; x++) bytes[hm + y * MAP_WIDTH + x] = 120;
  const cliff = load(bytes);
  const px = 104, py = 150, rect = { xMin: 48, xMax: 80, yMin: 48, yMax: 80 };
  const run = (landform) => generatePixelTerrain({ woods: cliff, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, roads: NET, landform });
  const dfu = run(false), shaped = run(true);
  assert.ok((at(shaped.samples, 64, 64) - at(dfu.samples, 64, 64)) * UNIT > 100, 'the town stands on the lifted mean');
  let beach = 0, moved = 0;
  for (let i = 0; i < dfu.tilemapBytes.length; i++) if (dfu.tilemapBytes[i] !== shaped.tilemapBytes[i]) moved++;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) if (at(dfu.samples, x, y) * UNIT <= LANDFORM_KNEE && at(shaped.samples, x, y) > at(dfu.samples, x, y) + 0.05 / UNIT) beach++;
  assert.ok(beach > 10, `the blend carries the lift down onto the beach (${beach} samples)`);
  assert.equal(moved, 0, 'and not one tile moves with it');
  // the kernel's classic output is DFU's generateSamples to the bit, beside a cut pixel's shaped samples
  for (const [qx, qy, w] of [[px, py, cliff], [300, 255, woods], [101, 300, woods]]) {
    const classic = new Float32Array(H * H);
    const shapedHere = generateSamples(w, qx, qy, H, createLandforms({ woods: w, roads: NET }), classic);
    const plain = generateSamples(w, qx, qy);
    assert.ok(classic.every((v, i) => Object.is(v, plain[i])), `${qx},${qy}: DFU's own samples`);
    assert.ok(shapedHere.some((v, i) => v !== plain[i]), `${qx},${qy}: beside the shaped ones`);
  }
  // a pixel with no location keeps one pass and one array (the shaped samples' own tiles are DFU's - LANDFORM1's knee)
  assert.match(src('src/world/terrainGen.js'), /const classic = landforms && hasLocation \? new Float32Array/);
});

// ---- C3, C4: online --------------------------------------------------------------------------------------------------------

test('AUDIT LANDFORMS C3: online a failed fetch of Basic Roads\' arrays is asked again, WOD6\'s way - the pixels roadless meanwhile, the port\'s own network only once every try has failed', async () => {
  const good = new Uint8Array(MAP_WIDTH * MAP_HEIGHT); good[7] = DIR.E;
  const fetching = (failures) => { let left = failures; return async (url) => { if (url === MOD_ROADS.roads && left > 0) { left--; return { ok: false }; } return { ok: true, arrayBuffer: async () => good.slice().buffer }; }; };
  const waits = [], tried = [];
  const late = await retryModRoads({ fetchFn: fetching(3), wait: async (ms) => { waits.push(ms); }, onTry: (n, ms) => tried.push([n, ms]) });
  assert.equal(late.roads[7], DIR.E, 'his arrays, on the fourth try');
  assert.deepEqual(waits, [5000, 10000, 20000, 40000]);
  assert.deepEqual(tried, [[0, 5000], [1, 10000], [2, 20000], [3, 40000]]);
  waits.length = 0;
  assert.equal(await retryModRoads({ fetchFn: fetching(Infinity), wait: async (ms) => { waits.push(ms); } }), null);
  assert.equal(MOD_ROADS_RETRY_MAX, 12);
  assert.deepEqual(waits, [5000, 10000, 20000, 40000, ...Array(8).fill(60000)], 'doubling to a minute, twelve more tries');
  // the host's own landing, run: online it asks again before it stands the port's own network; offline it stands it
  const head = '(basicRoadsOn ? loadModRoads() : Promise.resolve(null)).then(';
  const i = WORLD.indexOf(head), j = WORLD.indexOf('\n  });\n', i);
  assert.ok(i > 0 && j > i);
  const handlerSrc = WORLD.slice(i + head.length, j + '\n  }'.length);
  const land = async ({ online, his, retried }) => {
    const did = [];
    const terrainGen = { setRoadsData: (net) => did.push(['his', net.roads[7], net.water]), setRoads: () => did.push(['own']) };
    const retry = () => { did.push(['retry']); return Promise.resolve(retried); };
    const quiet = { log: () => {}, warn: () => {} };
    const handler = new Function('basicRoadsOn', 'params', 'retryModRoads', 'terrainGen', 'rebuildRoadless', 'settlementsOf', 'maps', 'logRoads', 'roadSwitches', 'console', `return ${handlerSrc};`)(
      true, { has: (k) => k === 'online' && online }, retry, terrainGen, () => did.push(['rebuild']), () => [], {}, () => {}, { water: true, smooth: true }, quiet);
    handler(his);
    await new Promise((r) => setTimeout(r, 0));
    return did;
  };
  const his = { roads: good, tracks: good, rivers: good, streams: good };
  assert.deepEqual(await land({ online: true, his: null, retried: his }), [['retry'], ['his', DIR.E, true], ['rebuild']], 'online: asked again, and his lands late');
  assert.deepEqual(await land({ online: true, his: null, retried: null }), [['retry'], ['own'], ['rebuild']], '...the port\'s own only once every try failed');
  assert.deepEqual(await land({ online: false, his: null, retried: his }), [['own'], ['rebuild']], 'offline: the port\'s own at once, as before');
  assert.deepEqual(await land({ online: true, his, retried: null }), [['his', DIR.E, true], ['rebuild']], 'his first try: his');
});

test('AUDIT LANDFORMS C4: the ground\'s online note names the rivers - their row is one of the ground\'s since LANDFORM3 cut their channels', () => {
  const note = src('src/ui/enhancedMenu.js').match(/const ONLINE_GROUND_NOTE = '([^']*)';/);
  assert.ok(note && /\brivers\b/.test(note[1]), note?.[1]);
});

// ---- lane D: the tests' honesty -------------------------------------------------------------------------------------------

/** AUDIT LANDFORMS D8: THE LAW, WRITTEN OUT - Landforms.md's cross-section, a second statement of world/landforms.js's
 *  shaper from the network's bytes and the kernel's own two terms alone. Every arm of the 3 x 3 pixels round a sample is
 *  graded along its own pixel's macro height (lifted, as DFU stands it, linear between whole samples); the arms within a
 *  layer's reach grade the floor together - weight (1 - d/reach)^2 / (d^2 + 1/4)^2, the nearest all but alone, an arm the
 *  sample lies beyond the end of all but standing down; then the floor (`drop` under for water), its bank to the top (the
 *  smooth land, or a levee for water), the verge back to the land; the layers lerped in paint order, a channel the
 *  water's (E2), the coast fading it all out, nothing under min(land, LANDFORM_FLOOR). */
function lawOf(net, px, py) {
  const span = H - 1, half = span / 2;
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const step = (a, b, v) => sm((v - a) / (b - a));
  const layers = [['streams', LANDFORM_DIALS.stream, true], ['rivers', LANDFORM_DIALS.river, true], ['tracks', LANDFORM_DIALS.track, false], ['roads', LANDFORM_DIALS.road, false]]
    .filter(([key, , water]) => net[key] && (!water || net.water))
    .map(([key, dial, water]) => {
      const arms = [];
      for (let qy = py - 1; qy <= py + 1; qy++) for (let qx = px - 1; qx <= px + 1; qx++) {
        for (const [bit, mdx, mdy] of DIR_DELTA) {
          if (!(net[key][qy * MAP_WIDTH + qx] & bit)) continue;
          const { base, noise } = kernelTerms(woods, qx, qy);
          const prof = Array.from({ length: half + 1 }, (_, k) => {
            const lx = half + mdx * k, ly = half - mdy * k, low = base(lx, ly) * 8;
            return Math.min(Math.max(low + noise(lx, ly) * 4, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT) + reliefLift(low);
          });
          const len = half * Math.hypot(mdx, mdy);
          arms.push({ ax: qx * span + half, ay: (MAP_HEIGHT - qy) * span + half, ux: (mdx * half) / len, uy: (-mdy * half) / len, len, prof });
        }
      }
      return { dial, water, reach: dial.flat + dial.bank + dial.verge, arms };
    });
  return (x, y, h, low, g) => {
    if (!(h > LANDFORM_KNEE)) return h;
    const land = h + reliefLift(low);
    const gx = px * span + x, gy = (MAP_HEIGHT - py) * span + y;
    const near = layers.map(({ dial, reach, arms }) => {
      let dmin = Infinity, ws = 0, wf = 0;
      for (const a of arms) {
        const t0 = (gx - a.ax) * a.ux + (gy - a.ay) * a.uy;
        const t = Math.min(Math.max(t0, 0), a.len), past = t0 < 0 ? -t0 : t0 > a.len ? t0 - a.len : 0;
        const d = Math.hypot(gx - a.ax - a.ux * t, gy - a.ay - a.uy * t);
        if (!(d < reach)) continue;
        dmin = Math.min(dmin, d);
        const f = (t / a.len) * half, i = Math.min(half - 1, Math.floor(f));
        const w = ((1 - d / reach) ** 2 / (d * d + 0.25) ** 2) * (1e-3 + 0.999 * (1 - sm(past)));
        ws += w;
        wf += w * (a.prof[i] + (a.prof[i + 1] - a.prof[i]) * (f - i));
      }
      if (dmin === Infinity) return null;
      const floor = wf / ws - dial.drop, smoothLand = land - g, edge = dial.flat + dial.bank;
      const top = dial.drop > 0 && smoothLand <= floor + dial.drop ? floor + dial.drop : smoothLand;
      const target = dmin <= edge ? floor + (top - floor) * step(dial.flat, edge, dmin) : top + (land - top) * step(edge, reach, dmin);
      return { dmin, target, weight: 1 - step(edge, reach, dmin) };
    });
    if (near.every((n) => n === null)) return land;
    const fade = step(LANDFORM_KNEE, LANDFORM_KNEE + LANDFORM_DIALS.coast, land);
    let chan = 0;
    layers.forEach((l, i) => { if (l.water && near[i]?.weight > 0) chan = Math.max(chan, 1 - step(l.dial.flat, l.dial.flat + l.dial.bank, near[i].dmin)); });
    let out = land;
    layers.forEach((l, i) => {
      if (!near[i]) return;
      let a = near[i].weight * fade;
      if (chan > 0 && !l.water && near[i].dmin > l.dial.flat) a *= 1 - chan;
      if (a > 0) out += (near[i].target - out) * a;
    });
    return Math.max(out, Math.min(land, LANDFORM_FLOOR));
  };
}

test('AUDIT LANDFORMS D8: the law, written out, is the shaper - at every sample of every pixel the fixture\'s paths shape: the bend, the junction, the ends, the diagonal into the straight, the crossing, the stream, the shore', () => {
  // the law reads the dials, so the dials are pinned as the page gives them (Landforms.md's table, the relief, the coast)
  assert.deepEqual(JSON.parse(JSON.stringify(LANDFORM_DIALS)), {
    relief: { from: 200, full: 900, gain: 0.9 }, stream: { flat: 1, bank: 1.25, verge: 4, drop: 0.8 }, river: { flat: 2, bank: 1.5, verge: 6, drop: 1.92 },
    track: { flat: 1.25, bank: 2, verge: 5, drop: 0 }, road: { flat: 1.25, bank: 2.5, verge: 6, drop: 0 }, coast: 12,
  });
  const pixels = [[350, 200], [351, 200], [352, 200], [352, 201], [352, 204], [353, 200], [354, 200], [354, 199], [354, 196], [355, 199],
    [356, 204], [357, 203], [358, 202], [358, 201], [358, 200], [300, 250], [300, 255], [301, 255], [293, 241], [312, 248], [312, 252], [100, 200], [101, 300], [102, 300]];
  let shaped = 0, worst = 0;
  for (const [px, py] of pixels) {
    const shape = LF.pixel(px, py), law = lawOf(NET, px, py), { base, noise } = kernelTerms(woods, px, py);
    for (let x = 0; x <= 128; x++) for (let y = 0; y <= 128; y++) {
      // the kernel's own inputs, with a ground noise of its own reach (0..9) so the verge has noise to hand back
      const low = base(x, y) * 8, g = 4.5 + 4.5 * Math.sin(0.37 * x + 0.61 * y + px);
      const h = Math.min(Math.max(low + noise(x, y) * 4 + g, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);
      const got = shape(x, y, h, low, g), want = law(x, y, h, low, g);
      if (got !== h + reliefLift(low)) shaped++;
      worst = Math.max(worst, Math.abs(got - want));
      assert.ok(Math.abs(got - want) < 1e-9, `${px},${py} (${x},${y}): the shaper ${got} against the law ${want}`);
    }
  }
  assert.ok(shaped > 40000, `the paths shaped ${shaped} samples`);
  assert.ok(worst < 1e-9);
});

test('AUDIT LANDFORMS D8: a bend, a junction and their ends are one number from both pixels at every seam', () => {
  const cache = new Map();
  const S = (px, py) => { const k = `${px},${py}`; if (!cache.has(k)) cache.set(k, generateSamples(woods, px, py, H, LF)); return cache.get(k); };
  for (const [px, py] of [[351, 200], [352, 200], [353, 200], [354, 200], [354, 199], [352, 203], [357, 203], [358, 202]]) {
    const a = S(px, py), east = S(px + 1, py), north = S(px, py - 1);
    for (let k = 0; k < H; k++) {
      assert.ok(Object.is(at(a, 128, k), at(east, 0, k)), `${px},${py} east edge ${k}`);
      assert.ok(Object.is(at(a, k, 128), at(north, k, 0)), `${px},${py} north edge ${k}`);
    }
  }
});

test('AUDIT LANDFORMS D12: the knee, said to the shaper itself - at or under it a height comes back as it went in, whatever its small-heightmap term', () => {
  const shape = LF.pixel(300, 250);
  for (const h of [LANDFORM_KNEE, 40, 30, SCALED_OCEAN_ELEVATION]) for (const low of [0, 400, 127 * 8]) assert.ok(Object.is(shape(64, 30, h, low, 0), h), `h=${h} low=${low}`);
});

test('AUDIT LANDFORMS D5: the road bed is the macro height along the whole arm - the hand-over at each pixel edge included', () => {
  const cut = generateSamples(woods, 300, 250, H, LF), macro = sampleKernel(woods, 300, 250, H, false, RELIEF);
  for (let y = 0; y <= 128; y++) assert.ok(Math.abs(at(cut, 64, y) - macro(64, y)) * UNIT < 1e-3, `y=${y}`);
});

test('AUDIT LANDFORMS D4: the kernel hands the shaper its ground noise - past the bank on the cut side it is eased back over the verge, not handed back at once', () => {
  const cut = generateSamples(woods, 300, 250, H, LF), lifted = generateSamples(woods, 300, 250, H, RELIEF);
  const smooth = sampleKernel(woods, 300, 250, H, false, RELIEF);
  let seen = 0;
  for (let y = 10; y <= 118; y++) {
    const bed = at(cut, 64, y);
    for (const x of [60, 68]) {   // d = 4: just past the bank (flat 1.25 + bank 2.5)
      const g = (at(lifted, x, y) - smooth(x, y)) * UNIT;
      if (!(smooth(x, y) > bed + 0.01 / UNIT) || !(g > 0.2)) continue;
      seen++;
      assert.ok((at(lifted, x, y) - at(cut, x, y)) * UNIT > 0.5 * g, `y=${y} x=${x}: the noise still eased out (${g.toFixed(3)})`);
    }
  }
  assert.ok(seen > 20, `${seen}`);
});

test('AUDIT LANDFORMS D9: the diagonal is graded between its profile points - a sample half a step along it lies halfway', () => {
  const s = generateSamples(woods, 293, 241, H, LF), m = sampleKernel(woods, 293, 241, H, false, RELIEF);
  for (const k of [12, 20, 30, 40, 50, 80, 90, 100, 110]) {
    const half = (m(k, k) + m(k + 1, k + 1)) / 2;
    assert.ok(Math.abs(at(s, k, k + 1) - half) * UNIT < 1e-3, `(${k},${k + 1})`);
    assert.ok(Math.abs(at(s, k + 1, k) - half) * UNIT < 1e-3, `(${k + 1},${k})`);
  }
});

test('AUDIT LANDFORMS D7: a point\'s lift between samples, and on the pixel\'s far edges, is the pipeline read as the collider reads it', () => {
  const px = 330, py = 250, rect = { xMin: 40, xMax: 80, yMin: 50, yMax: 90 };
  const run = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, landform }).samples;
  const dfu = run(false), shaped = run(true);
  const bil = (s, sx, sy) => { const ix = Math.min(127, Math.floor(sx)), iy = Math.min(127, Math.floor(sy)), fx = sx - ix, fy = sy - iy; return at(s, ix, iy) * (1 - fx) * (1 - fy) + at(s, ix + 1, iy) * fx * (1 - fy) + at(s, ix, iy + 1) * (1 - fx) * fy + at(s, ix + 1, iy + 1) * fx * fy; };
  for (const [sx, sy] of [[20.5, 70.25], [10.75, 30.5], [100.25, 110.75], [120.5, 5.25], [33.4, 96.7], [128, 64.5], [64.5, 128], [0, 0]]) {
    const want = (bil(shaped, sx, sy) - bil(dfu, sx, sy)) * UNIT, got = landformLift(woods, px, py, sx, sy, rect);
    assert.ok(Math.abs(got - want) < 0.01, `(${sx},${sy}): ${got} vs ${want}`);
  }
});

test('AUDIT LANDFORMS D6: the far ring\'s normals are the lifted ring\'s slopes - on the mountain\'s flank, off its plateau', () => {
  const baseX = 350, baseY = 200, R = 2, side = 2 * R + 1;
  const g = buildFarRingGrid({ heightBytes: woods.heightMapBuffer, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, climateAt: () => 231, baseX, baseY, radius: R, relief: true });
  const rh = (x, y) => ringHeight(woods.getHeightMapValue(x, y), true);
  let both = 0;
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const px = baseX - R + i, py = baseY - R + j, o = (j * side + i) * 3;
    const nx = rh(px - 1, py) - rh(px + 1, py), nz = rh(px, py + 1) - rh(px, py - 1), ny = 2 * TERRAIN_SIZE, l = Math.hypot(nx, ny, nz);
    if (Math.abs(nx) > 1 && Math.abs(nz) > 1) both++;
    assert.ok(Math.abs(g.normals[o] - nx / l) < 1e-6 && Math.abs(g.normals[o + 2] - nz / l) < 1e-6, `(${px},${py})`);
  }
  assert.ok(both > 3, `a flank, not the plateau (${both})`);
});

test('AUDIT LANDFORMS D9: the gate\'s beacon kernel is made again once the network lands - the pixel is cut along it', () => {
  const body = between('  let _gateKernel = null, _gateKernelAt = \'\';', '  const gatePool = ');
  let net = null;
  const state = new StreamingWorldState();
  state.init(300, 250);
  const heightCell = TERRAIN_SIZE / (H - 1), worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const gateGroundAt = new Function('woods', 'landform', 'terrainGen', 'sampleKernel', 'HEIGHTMAP_DIMENSION', 'landformsHere', 'state', 'TERRAIN_SIZE', 'heightCell', 'worldHeight', `${body}\nreturn gateGroundAt;`)(woods, true, { roads: () => net }, sampleKernel, H, () => createLandforms({ woods, roads: net }), state, TERRAIN_SIZE, heightCell, worldHeight);
  const t = state.pixelTranslation(300, 250);
  const x = t[0] + 64 * heightCell, z = t[2] + 30 * heightCell;
  const before = gateGroundAt(300, 250, x, z);
  net = NET;
  const after = gateGroundAt(300, 250, x, z);
  const cut = generateSamples(woods, 300, 250, H, LF);
  assert.ok(Math.abs(after - (at(cut, 64, 30) * worldHeight + t[1])) < 1e-3, `${after}`);
  assert.ok(Math.abs(after - before) > 0.1, 'the road is cut there');
});

test('AUDIT LANDFORMS D9: a landforms promotion waits for the network in flight, a plain one does not', async () => {
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js?auditlandforms');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: WOODS_BYTES.slice() } });
    globalThis.onmessage({ data: { t: 'roads', settlements: [], switches: {} } });   // a build in flight: pendingRoads
    const samples = generateSamples(woods, 300, 250, H, null);
    globalThis.onmessage({ data: { t: 'grid', id: 1, px: 300, py: 250, stride: 4, samples, landform: true } });
    globalThis.onmessage({ data: { t: 'grid', id: 2, px: 300, py: 250, stride: 4, samples, landform: false } });
    assert.deepEqual(posted.filter((m) => m.t === 'grid').map((m) => m.id), [2], 'the plain one at once, the landforms one held');
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(posted.filter((m) => m.t === 'grid').map((m) => m.id), [2, 1], '...and answered once the network landed');
    const want = restrideGrid({ woods, px: 300, py: 250, stride: 4, samples, landform: true, roads: null });
    assert.deepEqual([...posted.find((m) => m.id === 1).normals], [...want.normals]);
  } finally { globalThis.postMessage = prevPost; globalThis.onmessage = prevOn; }
});

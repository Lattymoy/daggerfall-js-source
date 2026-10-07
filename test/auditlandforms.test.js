// AUDIT LANDFORMS (2026-10-07, Mac: "Dont worry about it. Instead let's do just an audit and ensure this is perfect")
// - the audit of LANDFORM1-3 (bible/03-World/Landforms.md, the record bible/01-Overview/Audit-Landforms.md). Every
// finding fixed here was reproduced first, on the real WOODS.WLD and on this synthetic world, and each pin below fails
// on the code as it stood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generateSamples, sampleKernel, kernelTerms, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { createLandforms, reliefLift, landformLift, landformLiftField, cliffFadeAt, LANDFORM_DIALS, LANDFORM_KNEE, LANDFORM_FLOOR } from '../src/world/landforms.js';
import { generatePixelTerrain, restrideGrid } from '../src/world/terrainGen.js';
import { waterCorners, WATER_DRAW_MASK_TABLE } from '../src/world/waterCorners.js';
import { DIR, DIR_DELTA } from '../src/world/roadNetwork.js';
import { retryModRoads, loadModRoads, MOD_ROADS, MOD_ROADS_RETRY_MAX, MOD_ROADS_FETCH_TIMEOUT_MS } from '../src/world/roadsProducer.js';
import { ringHeight, buildFarRingGrid } from '../src/render/farRing.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { _setTimeScaleForTest, TRAVEL_ROAD_RATE } from '../src/systems/timeScale.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { natureStandsAt, layoutNature, groundAt } from '../src/world/terrainNature.js';
import { sampleHeight, blendLocationTerrain, calcAvgMaxHeight, generateTileData } from '../src/world/terrainTiles.js';

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
    // PIN MOVED (AUDIT LANDFORMS II F4): a dungeon's anchor keeps its own frame's feet - it lands on `local` alone
    ['y: inDungeon ? pf[1] - state.compensation[1] : groundFrameHeight(pf[1] - state.compensation[1], pf[0], pf[2]),\n      terrainScale: STREAMING_TERRAIN_SCALE,   // TERRAIN-SCALE1: the ground that height stands on', 1, 'the anchor'],
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
 *  yet will stand (_liftLocationAt - the index alone until bound; PIN MOVED, AUDIT LANDFORMS II F1/F3: the probe is
 *  declared with the spawned dungeons' own, and the slice starts at the fields' cap), `fields` counts the fields made. */
function liftAtHost({ built = new Map(), index = new Map(), rects = new Map(), net = { at: NET }, fields = { made: 0 } } = {}) {
  const body = between('  const LIFT_FIELDS_KEPT = ', '  /** AUDIT LANDFORMS C1/B4: A HEIGHT GOES INTO A RECORD IN DFU\'S FRAME.');
  const state = new StreamingWorldState();
  state.init(329, 251);
  state.compensation = [37.5, 12, -91.25];
  const heightCell = TERRAIN_SIZE / (H - 1);
  const asked = [];
  const setLocationTiles = (loc, maps, blocks, tilemap) => { asked.push(loc.name); assert.equal(tilemap.length, 128 * 128); return rects.get(loc.name) ?? null; };
  const counted = (...a) => { fields.made += 1; return landformLiftField(...a); };
  const host = new Function('state', 'woods', 'built', 'locationIndex', 'setLocationTiles', 'maps', 'blocks', 'TERRAIN_SIZE', 'heightCell', 'MAP_WIDTH', 'MAP_HEIGHT', 'landformLiftField', 'STREAMING_TERRAIN_SCALE', 'HEIGHTMAP_DIMENSION', 'terrainGen', 'landformsHere', '_liftLocationAt',
    `${body}\nreturn { landformLiftAt, bind: (f) => { _liftLocationAt = f; } };`)(state, woods, built, index, setLocationTiles, {}, {}, TERRAIN_SIZE, heightCell, MAP_WIDTH, MAP_HEIGHT, counted, STREAMING_TERRAIN_SCALE, H, { roads: () => net.at }, () => createLandforms({ woods, roads: net.at }), (x, y) => index.get(`${x},${y}`));
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
  // the edges of a pixel and a point off the map - PIN MOVED (AUDIT LANDFORMS II J6): on a row the cone's flank slopes
  // north-south (its centre's rows 247..252 hold one byte, where a frame read a row off in z answered the same), and the
  // map's north row: py 0 takes its lift, py -1 none
  const [ex, ez] = bare.scene(px, 240, 127.5, 0.5);
  assert.ok(Math.abs(bare.landformLiftAt(ex, ez) - landformLift(woods, px, 240, 127.5, 0.5, null, H, LF) * STREAMING_TERRAIN_SCALE) < 1e-9);
  assert.ok(Math.abs(landformLift(woods, px, 240, 127.5, 0.5, null, H, LF) - landformLift(woods, px, 241, 127.5, 0.5, null, H, LF)) > 0.01, 'a row its neighbour differs from');
  assert.ok(bare.landformLiftAt(...bare.scene(500, 0, 64, 64)) > 1, 'the map\'s north row takes its lift');
  assert.equal(bare.landformLiftAt(...bare.scene(500, -1, 64, 64)), 0, 'and past it none');
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
  assert.ok(Math.abs(h.landformLiftAt(x, z) - wild) < 1e-9, 'a probe that answers the index alone: the wild lift');
  h.bind((qx, qy) => (qx === px && qy === py ? spawn : null));
  assert.ok(Math.abs(h.landformLiftAt(x, z) - landformLift(woods, px, py, 60, 60, rect, H, LF) * STREAMING_TERRAIN_SCALE) < 1e-9, 'bound: the spawn\'s rect');
  // the binding itself: _locationToBuild's answer, side-effect free
  const line = WORLD.match(/\n {2}const (_liftLocationAt = \(x, y\) => [^\n]*;)/);   // PIN MOVED (AUDIT LANDFORMS II F1): declared, not bound later
  assert.ok(line, 'the boot declares it');
  const probe = (index, gone, at) => new Function('locationIndex', 'tvSpawnGone', 'tvLocationAt', `let _liftLocationAt = null; ${line[1]}\nreturn _liftLocationAt;`)(index, gone, at);
  // AUDIT LANDFORMS II J3: every key OFF the diagonal, each asked with its mirror - on (1, 1), (2, 2) and (3, 3) a probe that
  // swapped its x and y answered the same, so three transposed bindings survived
  const town = { name: 'Town' }, rolled = { name: 'Rolled', spawned: true };
  const index = new Map([['5,2', town], ['2,5', spawn]]), before = [...index];
  const tvLocationAt = (x2, y2) => index.get(`${x2},${y2}`) ?? (x2 === 3 && y2 === 7 ? rolled : null);
  const ask = probe(index, (x2, y2) => x2 === 2 && y2 === 5, tvLocationAt);
  assert.equal(ask(5, 2), town, 'the index\'s place');
  assert.equal(ask(2, 5), null, 'a spawn past its time with nobody in it: built empty');
  assert.equal(probe(index, () => false, tvLocationAt)(2, 5), spawn, 'one in its time: the spawn');
  assert.equal(ask(3, 7), rolled, 'a pixel the index has not met: the roll\'s spawn');
  assert.equal(ask(7, 3), null, 'and its mirror none');
  assert.equal(ask(4, 4), null);
  assert.deepEqual([...index], before, 'and the index is as it was');
  assert.match(WORLD, /const tvLocationAt = \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\) \?\? \(params\.has\('online'\) && spawnsDungeon\(_spawnSalt, x, y\) \? tvSpawnAt\(x, y\) : null\);\n(?: {2}\/?\*{1,2}[^\n]*\n| {3}\*[^\n]*\n)* {2}const _liftLocationAt = /, 'declared right where the probe stands');
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
      // PIN MOVED (AUDIT LANDFORMS II J12): in the wild the field IS the pipeline's float32 samples less DFU's, exactly - a
      // field that dropped the float32 rounding (0.1 mm off) passed the 1e-3 this was; through a town's blend, as near
      if (!rect) assert.ok(Object.is(field(x, y), truth), `${px},${py} (${x},${y}): ${field(x, y)} against the pipeline's ${truth}, exactly`);
      else assert.ok(Math.abs(field(x, y) - truth) < 1e-3, `${px},${py} (a town) (${x},${y}): ${field(x, y)} against the pipeline's ${truth}`);
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

test('AUDIT LANDFORMS D3: the landforms move the ground, never a tile - a coastal town\'s blend classifies DFU\'s own samples, so its beach stands where DFU\'s does however far the landforms move the town\'s mean', () => {
  // the fixture's river out to sea through a shore town at (103, 300): its channel moves the pixel's mean, and the blend
  // carries that across the beach line. (It was a massif lifting a sea cliff's town; beside the sea the lift fades now -
  // AUDIT LANDFORMS II I1 - so a beach pixel's own lift is nothing, and the cuts are what move a coastal town's mean.)
  const px = 103, py = 300, rect = { xMin: 40, xMax: 88, yMin: 40, yMax: 88 };
  const run = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, roads: NET, landform });
  const dfu = run(false), shaped = run(true);
  let crossed = 0, moved = 0;
  for (let i = 0; i < dfu.tilemapBytes.length; i++) if (dfu.tilemapBytes[i] !== shaped.tilemapBytes[i]) moved++;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) if ((at(dfu.samples, x, y) * UNIT <= LANDFORM_KNEE) !== (at(shaped.samples, x, y) * UNIT <= LANDFORM_KNEE)) crossed++;
  // the shaped blend's own tiles would part from DFU's
  const own = generateSamples(woods, px, py, H, LF);
  blendLocationTerrain(own, calcAvgMaxHeight(own)[0], rect);
  const ownTiles = generateTileData(own, px, py), dfuTiles = generateTileData(dfu.samples, px, py);
  let would = 0;
  for (let i = 0; i < ownTiles.length; i++) if (ownTiles[i] !== dfuTiles[i]) would++;
  assert.ok(crossed > 3 && would > 10, `the blend carries the cut across the beach line at ${crossed} samples, and the shaped blend's own tiles would part at ${would}`);
  assert.equal(moved, 0, 'and not one tile moves with it');
  // the kernel's classic output is DFU's generateSamples to the bit, beside a cut pixel's shaped samples
  for (const [qx, qy, w] of [[px, py, woods], [300, 255, woods], [101, 300, woods]]) {
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
 *  water's (E2), the coast fading it all out, nothing under min(land, LANDFORM_FLOOR). The lift itself fades beside the
 *  sea (AUDIT LANDFORMS II I1): at each byte node smoothstep(1, 3, d) of its distance to the nearest sea byte (one whose
 *  `low` is at or under the knee), in 1024ths, through the kernel's own bicubic window - stated here by handing
 *  kernelTerms a heightmap of those fades. */
function lawOf(net, px, py, w = woods, { held = true } = {}) {
  const span = H - 1, half = span / 2;
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const step = (a, b, v) => sm((v - a) / (b - a));
  const fadeNode = (nx, ny) => {
    const win = w.getHeightMapValuesRange1Dim(nx - 3, ny - 3, 7);
    let d = Infinity;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (win[i + j * 7] * 8 <= LANDFORM_KNEE) d = Math.min(d, Math.hypot(i - 3, j - 3));
    return Math.round(sm((d - 1) / 2) * 1024);
  };
  const fades = {
    getHeightMapValuesRange1Dim: (x0, y0, dim) => Float64Array.from({ length: dim * dim }, (_, k) => fadeNode(x0 + (k % dim), y0 + Math.floor(k / dim))),
    getLargeHeightMapValuesRange: () => new Float64Array(81),
  };
  const cliffs = new Map();
  const cliffOf = (qx, qy) => {
    if (!cliffs.has(`${qx},${qy}`)) { const { base } = kernelTerms(fades, qx, qy); cliffs.set(`${qx},${qy}`, (x, y) => Math.min(1, Math.max(0, base(x, y) / 1024))); }
    return cliffs.get(`${qx},${qy}`);
  };
  // AUDIT LANDFORMS II J1: a track is a ford - the water is painted over it - so the channel is the water's on its bed too
  const layers = [['streams', LANDFORM_DIALS.stream, true], ['rivers', LANDFORM_DIALS.river, true], ['tracks', LANDFORM_DIALS.track, false, true], ['roads', LANDFORM_DIALS.road, false]]
    .filter(([key, , water]) => net[key] && (!water || net.water))
    .map(([key, dial, water, ford = false]) => {
      const arms = [];
      for (let qy = py - 1; qy <= py + 1; qy++) for (let qx = px - 1; qx <= px + 1; qx++) {
        for (const [bit, mdx, mdy] of DIR_DELTA) {
          if (!(net[key][qy * MAP_WIDTH + qx] & bit)) continue;
          const { base, noise } = kernelTerms(w, qx, qy);
          const prof = Array.from({ length: half + 1 }, (_, k) => {
            const lx = half + mdx * k, ly = half - mdy * k, low = base(lx, ly) * 8;
            return Math.min(Math.max(low + noise(lx, ly) * 4, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT) + reliefLift(low) * cliffOf(qx, qy)(lx, ly);
          });
          const len = half * Math.hypot(mdx, mdy);
          arms.push({ ax: qx * span + half, ay: (MAP_HEIGHT - qy) * span + half, ux: (mdx * half) / len, uy: (-mdy * half) / len, len, prof });
        }
      }
      // AUDIT LANDFORMS II I2: a road's or a track's floor and bank held within bankGrade over the hillside of the smooth land
      const hold = water || !held ? Infinity : (LANDFORM_DIALS.bankGrade * (TERRAIN_SIZE / span / STREAMING_TERRAIN_SCALE) * dial.bank) / 1.5;
      return { dial, water, ford, hold, reach: dial.flat + dial.bank + dial.verge, arms };
    });
  return (x, y, h, low, g) => {
    if (!(h > LANDFORM_KNEE)) return h;
    const land = h + reliefLift(low) * cliffOf(px, py)(x, y);
    const gx = px * span + x, gy = (MAP_HEIGHT - py) * span + y;
    const near = layers.map(({ dial, reach, arms, hold }) => {
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
      let target = dmin <= edge ? floor + (top - floor) * step(dial.flat, edge, dmin) : top + (land - top) * step(edge, reach, dmin);
      if (dmin <= edge) target = Math.min(Math.max(target, smoothLand - hold), smoothLand + hold);
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
      if (chan > 0 && !l.water && (l.ford || near[i].dmin > l.dial.flat)) a *= 1 - chan;
      if (a > 0) out += (near[i].target - out) * a;
    });
    return Math.max(out, Math.min(land, LANDFORM_FLOOR));
  };
}

test('AUDIT LANDFORMS D8: the law, written out, is the shaper - at every sample of every pixel the fixture\'s paths shape: the bend, the junction, the ends, the diagonal into the straight, the crossing, the stream, the shore', () => {
  // the law reads the dials, so the dials are pinned as the page gives them (Landforms.md's table, the relief, the coast)
  assert.deepEqual(JSON.parse(JSON.stringify(LANDFORM_DIALS)), {
    relief: { from: 200, full: 900, gain: 0.9 }, stream: { flat: 1, bank: 1.25, verge: 4, drop: 0.8 }, river: { flat: 2, bank: 1.5, verge: 6, drop: 1.92 },
    track: { flat: 1.25, bank: 2, verge: 5, drop: 0 }, road: { flat: 1.25, bank: 2.5, verge: 6, drop: 0 }, coast: 12, bankGrade: 0.5,
    cliff: { from: 1, full: 3 },   // PIN MOVED (AUDIT LANDFORMS II I1)
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

// ==== AUDIT LANDFORMS II (2026-10-07, Mac: "Do another deep audit on this") ==============================================
// The second audit, of the slice and the first audit's fixes (its record: bible/01-Overview/Audit-Landforms.md, AUDIT
// LANDFORMS II). Every pin below fails on the code as it stood (c532321f).

/** bootWorld's own statements, in the order the boot runs them. */
const bootStatements = () => {
  const ast = acorn.parse(WORLD, { ecmaVersion: 'latest', sourceType: 'module' });
  const boot = ast.body.map((n) => (n.type === 'ExportNamedDeclaration' ? n.declaration : n)).find((d) => d?.id?.name === 'bootWorld');
  return boot.body.body.map((st) => WORLD.slice(st.start, st.end));
};

test('AUDIT LANDFORMS II F1: what a pixel not built yet will stand - a spawn included - is the whole answer before the boot\'s load (online the only load) stands a single record, and is never made again after it', () => {
  const stmts = bootStatements();
  const load = stmts.findIndex((t) => t.includes('await worldQuickLoad({ ...bootLoadPick, snap });'));
  assert.ok(load > 0, 'the boot\'s load door');
  const makes = stmts.map((t, i) => [i, t]).filter(([, t]) => /^(?:(?:let|const) )?_liftLocationAt = /.test(t));
  const before = makes.filter(([i]) => i < load);
  assert.ok(before.length, 'made before the load');
  assert.deepEqual(makes.filter(([i]) => i > load).map(([, t]) => t), [], 'and not bound again after it');
  // the one standing when the load runs, run: the index's place, and the spawn the roll stands that the index does not
  // hold until its pixel builds (_locationToBuild's answer) - it was the index alone there
  const spawn = { name: 'Spawn', spawned: true }, town = { name: 'Town' };
  const index = new Map([['1,1', town]]);
  const probe = new Function('locationIndex', 'tvSpawnGone', 'tvLocationAt', `${before.at(-1)[1].replace(/^(?:let|const) /, 'let ')}\nreturn _liftLocationAt;`)(
    index, () => false, (x, y) => index.get(`${x},${y}`) ?? (x === 3 ? spawn : null));
  assert.equal(probe(1, 1), town);
  assert.equal(probe(3, 3), spawn, 'a spawn not in the index yet: its own place, not the wild');
});

test('AUDIT LANDFORMS II F3: a pixel\'s lift field is kept for the next save - nine towns asked twice make nine fields, not eighteen; past the cap the longest unasked is let go, never the whole memo', () => {
  const fields = { made: 0 }, rect = { xMin: 50, xMax: 70, yMin: 50, yMax: 70 };
  const towns = [...Array(9).keys()].map((i) => [300 + i, 250]);
  const index = new Map(towns.map(([px, py], i) => [`${px},${py}`, { name: `T${i}`, exterior: { exteriorData: {} }, mapTableData: {} }]));
  const h = liftAtHost({ index, rects: new Map(towns.map((_, i) => [`T${i}`, rect])), fields });
  const save = () => { for (const [px, py] of towns) h.landformLiftAt(...h.scene(px, py, 60, 60)); };
  save();
  assert.equal(fields.made, 9, 'the first save makes each town\'s field');
  save();
  assert.equal(fields.made, 9, 'the second makes none again - a town\'s is a kernel pass on this thread, and the memo cleared whole at eight made all nine again at every save');
  assert.deepEqual(h.asked, towns.map((_, i) => `T${i}`), 'nor asks a rect again');
  // the cap: past it the longest unasked is let go, and only it - a field asked again is the last to go
  const wild = { made: 0 }, w = liftAtHost({ fields: wild });
  const P = (i) => w.scene(200 + i, 300, 10, 10);
  for (let i = 0; i < 33; i++) w.landformLiftAt(...P(i));
  assert.equal(wild.made, 33, 'the 33rd lets the first go');
  w.landformLiftAt(...P(1));
  assert.equal(wild.made, 33, 'the second is kept, and asked again it is the last to go');
  w.landformLiftAt(...P(33));
  w.landformLiftAt(...P(1));
  assert.equal(wild.made, 34, 'a 34th lets the third go, not the second');
  w.landformLiftAt(...P(2));
  w.landformLiftAt(...P(0));
  assert.equal(wild.made, 36, 'the first and the third were let go');
});

test('AUDIT LANDFORMS II F4: an anchor set in a dungeon keeps its feet in the dungeon\'s own frame - the lift is never asked of a dungeon point as if it stood outside; outside and in a building it goes in DFU\'s frame', () => {
  const asked = [];
  const anchorOf = (worldContext) => {
    let anchor = null;
    mount(`${fnOf('setRecallAnchor')}\nreturn setRecallAnchor;`, {
      modes: { gateArenaDay: () => null, anchorContext: () => ({ worldContext, local: [1, 2, 3], buildingKey: 0, interior: null }) },
      WORLD_CONTEXT: { Nothing: 'Nothing', Exterior: 'Exterior', Interior: 'Interior', Dungeon: 'Dungeon' },
      walkMode: true, playerSpawned: true, player: { pos: [123.5, 40, 77.25] }, cam: { pos: [0, 0, 0], yaw: 0.5, pitch: 0.1 },
      state: { current: { x: 5, y: 6 }, compensation: [0, 10, 0], worldCoords: (p) => ({ x: p[0] + 1000, z: p[2] + 2000 }) },
      playerTravelPixel: () => ({ x: 5, y: 6 }), mapPixelToWorldCoords: () => ({ x: 0, z: 0 }), playerEntity: {},
      makeAnchor: (a) => (anchor = a), groundFrameHeight: (y, x, z) => { asked.push([x, z]); return y - 7; }, STREAMING_TERRAIN_SCALE,
    })();
    return anchor;
  };
  assert.equal(anchorOf('Dungeon').y, 30, 'a dungeon\'s: its feet as they stood, compensation off');
  assert.deepEqual(asked, [], 'and no lift asked of a dungeon-local point');
  assert.equal(anchorOf('Exterior').y, 23);
  assert.equal(anchorOf('Interior').y, 23, 'a building\'s frame is the exterior\'s: DFU\'s frame');
  assert.deepEqual(asked, [[123.5, 77.25], [123.5, 77.25]]);
});

test('AUDIT LANDFORMS II I3: a Travel Options journey down a road under the slope limit follows it - no fall at the road rate (x100) on a horse or on foot, as at x1', () => {
  // a mountain road: the large heightmap steps 120 between its columns 1499 and 1500 - a slope of about 2.2 (65 degrees,
  // under the slope limit) across pixel (500, 250) - and a road east-west down it, cut level across (the lifted Dragontail's
  // summit roads are graded 1.4 to 1.5 by their profiles, and steeper between samples)
  const mountain = {
    getHeightMapValue: () => 20,
    getHeightMapValuesRange1Dim: (x, y, dim) => new Uint8Array(dim * dim).fill(20),
    getLargeHeightMapValuesRange(px, py, dim) {
      const side = dim * 3, out = new Uint8Array(side * side);
      for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) out[r + c * side] = 3 * px + r <= 1499 ? 60 : 180;
      return out;
    },
  };
  const net = { roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), water: false };
  for (let x = 495; x <= 505; x++) net.roads[250 * MAP_WIDTH + x] = DIR.E | DIR.W;
  const s = generateSamples(mountain, 500, 250, H, createLandforms({ woods: mountain, roads: net }));
  const M = UNIT * STREAMING_TERRAIN_SCALE, CELL = TERRAIN_SIZE / (H - 1);
  const heightAt = (x, z) => {   // world.js heightAt's read: bilinear over the pixel's float32 samples
    const fx = Math.max(0, Math.min(127.999, x / CELL)), fz = Math.max(0, Math.min(127.999, z / CELL));
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, v = (a, b) => s[a * H + b] * M;
    return v(ix, iz) * (1 - ax) * (1 - az) + v(ix + 1, iz) * ax * (1 - az) + v(ix, iz + 1) * (1 - ax) * az + v(ix + 1, iz + 1) * ax * az;
  };
  let grade = 0;
  for (let x = 44; x < 84; x++) grade = Math.max(grade, Math.abs(s[(x + 1) * H + 63] - s[x * H + 63]) * M / CELL);
  assert.ok(grade > 1.95 && grade < Math.tan((70 * Math.PI) / 180), `the road's grade ${grade.toFixed(2)}: steep, under the slope limit`);
  const ride = (scale, mode) => {
    const col = new Collider(heightAt);
    const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
    m.transportMode = mode;
    const z = 63.5 * CELL;   // the road's centre line
    _setTimeScaleForTest(1);
    m.spawn(120 * CELL, col.restFloor(120 * CELL, z), z);
    const idle = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
    for (let i = 0; i < 30; i++) m.update(1 / 60, idle, -Math.PI / 2);
    _setTimeScaleForTest(scale);
    const falls = [];
    try {
      for (let f = 0; f < 6000 && m.pos[0] > 10 * CELL; f++) {   // 700 m: 65 s at x1
        m.update(1 / 60, { ...idle, forward: 1 }, -Math.PI / 2);
        if (m.landedFallDistance > 0.5) falls.push(+m.landedFallDistance.toFixed(1));
      }
    } finally { _setTimeScaleForTest(1); }
    assert.ok(m.pos[0] <= 10 * CELL, `rode the whole road down (${mode} at x${scale})`);
    return falls.filter((d) => d > 5);
  };
  assert.equal(TRAVEL_ROAD_RATE, 100);
  assert.deepEqual(ride(1, TRANSPORT_MODES.Horse), [], 'at x1 the horse keeps to the road');
  assert.deepEqual(ride(TRAVEL_ROAD_RATE, TRANSPORT_MODES.Horse), [], 'a journey on a horse: it flew level off a missed substep and landed 45-118 m falls');
  assert.deepEqual(ride(TRAVEL_ROAD_RATE, TRANSPORT_MODES.Foot), [], 'and on foot');
});

/** Every corner of a water tile the pipeline paints in this pixel, as sample coordinates (E2's own read). */
const wetCornersOf = (tilemapBytes) => {
  const out = [];
  for (let ty = 0; ty < 128; ty++) for (let tx = 0; tx < 128; tx++) {
    const m = waterCorners(tilemapBytes[ty * 128 + tx], WATER_DRAW_MASK_TABLE);
    for (let k = 0; k < 4; k++) if (m & (1 << k)) out.push([tx + (k & 1), ty + (k >> 1)]);
  }
  return out;
};

test('AUDIT LANDFORMS II J1: a track over a river is a ford, as it is painted - the water is painted across the track (roadPainter: road, river, stream, track), so the channel is the water\'s on the track\'s bed too and every wet corner lies on its floor', () => {
  // the fixture's ford: the track north-south down x = 64 of pixel (285, 255), the river east-west down y = 64
  const px = 285, py = 255, track = LANDFORM_DIALS.track;
  const water = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, roads: dry, tracks: dry } }));
  const out = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: NET, landform: true });
  let wet = 0, onBed = 0;
  for (const [x, y] of wetCornersOf(out.tilemapBytes)) {
    wet++;
    if (Math.abs(x - 64) <= track.flat) onBed++;
    assert.ok(Math.abs(out.samples[x * H + y] - at(water, x, y)) * UNIT < 1e-3, `wet corner (${x}, ${y}) on the channel's floor, ${((out.samples[x * H + y] - at(water, x, y)) * UNIT).toFixed(2)} units over it`);
  }
  assert.ok(wet > 200 && onBed > 10, `the river's water tiles were read (${wet}), across the track's bed too (${onBed})`);
  // and off the river the track keeps its own bed, whole
  const full = generateSamples(woods, px, py, H, LF), trackAlone = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, rivers: dry, streams: dry } }));
  for (const y of [20, 108]) for (const x of [63, 64, 65, 61]) assert.ok(Object.is(at(full, x, y), at(trackAlone, x, y)), `(${x}, ${y}): the track's bed`);
});

test('AUDIT LANDFORMS II J2: a stream is water too - with the rivers off it has no channel; where it joins a river the river\'s channel stands; a road over it stands on its own bed alone and the painted water lies on the stream\'s floor', () => {
  // the stream down x = 64 of pixel (316, 251): a metre under the land with the rivers on, not cut at all with them off
  const sOn = generateSamples(woods, 316, 251, H, LF), lifted = generateSamples(woods, 316, 251, H, RELIEF);
  const sOff = generateSamples(woods, 316, 251, H, createLandforms({ woods, roads: { ...NET, water: false } }));
  for (const y of [30, 64, 100]) {
    assert.ok(Object.is(at(sOff, 64, y), at(lifted, 64, y)), `the rivers off, y=${y}: no channel - a channel with no water in it is a ditch`);
    assert.ok(at(sOn, 64, y) < at(lifted, 64, y) - 0.5 / UNIT, `the rivers on, y=${y}: the stream's channel`);
  }
  // the join (316, 255): on the river's floor the river's channel stands, the stream's arm giving way to it - the river is
  // painted first (paintPathWithSubPathJoins, the stream its sub-path) and lerped last
  const join = generateSamples(woods, 316, 255, H, LF), riverAlone = generateSamples(woods, 316, 255, H, createLandforms({ woods, roads: { ...NET, streams: dry } }));
  const streamAt = generateSamples(woods, 316, 255, H, createLandforms({ woods, roads: { ...NET, rivers: dry } }));
  assert.ok(Math.abs(at(streamAt, 64, 64) - at(riverAlone, 64, 64)) * UNIT > 0.5, 'the two channels part at the join');
  for (let y = 62; y <= 66; y++) for (const x of [56, 60, 64, 68, 72]) assert.ok(Math.abs(at(join, x, y) - at(riverAlone, x, y)) * UNIT < 1e-6, `(${x}, ${y}): the river's floor`);
  // the road east-west over the stream at (316, 252): E2's law at a stream - on the stream's floor off the road's bed the
  // channel is the stream's; the causeway stands over it; the painted water lies on the floor
  const px = 316, py = 252, road = LANDFORM_DIALS.road;
  const full = generateSamples(woods, px, py, H, LF), streamAlone = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, roads: dry, tracks: dry } }));
  for (let x = 64 - LANDFORM_DIALS.stream.flat; x <= 64 + LANDFORM_DIALS.stream.flat; x++) {
    for (const y of [61, 60, 58, 55, 67, 68, 70, 73]) assert.ok(Object.is(at(full, x, y), at(streamAlone, x, y)), `(${x}, ${y}): the stream's floor, not the road's fill`);
  }
  for (const x of [63, 64, 65]) assert.ok(at(full, x, 64) > at(streamAlone, x, 64) + 0.4 / UNIT, `x=${x}: the causeway over the stream`);
  const out = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: NET, landform: true });
  let wet = 0;
  for (const [x, y] of wetCornersOf(out.tilemapBytes)) {
    if (Math.abs(y - 64) <= road.flat) continue;   // the corner a water tile shares with the road's bed: the causeway's edge
    wet++;
    assert.ok(Math.abs(out.samples[x * H + y] - at(streamAlone, x, y)) * UNIT < 1e-3, `wet corner (${x}, ${y}) on the stream's floor`);
  }
  assert.ok(wet > 50, `the stream's water tiles were read (${wet})`);
});

test('AUDIT LANDFORMS II I2: a bank is never a launch ramp - a track benched along a steep hillside stands its banks at most bankGrade steeper than the hillside, and a run straight down across it lands no fall', () => {
  // a hillside the kernel's own large-heightmap term makes: every small byte 20 (no lift), the large heightmap stepping 60
  // between its columns 1499 and 1500 - DFU's CubicInterpolator draws it a uniform 1.29 (52 degrees, walkable at a run)
  // across pixel (500, y)'s middle, the steepness the real ground reaches where a track is benched across it (1.35 at
  // (627, 282)) - and a track north-south along its contour
  const hill = {
    getHeightMapValue: () => 20,
    getHeightMapValuesRange1Dim: (x, y, dim) => new Uint8Array(dim * dim).fill(20),
    getLargeHeightMapValuesRange(px, py, dim) {
      const side = dim * 3, out = new Uint8Array(side * side);
      for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) out[r + c * side] = 3 * px + r <= 1499 ? 60 : 120;
      return out;
    },
  };
  const net = { roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), water: false };
  for (let y = 245; y <= 255; y++) net.tracks[y * MAP_WIDTH + 500] = DIR.N | DIR.S;
  const M = UNIT * STREAMING_TERRAIN_SCALE, CELL = TERRAIN_SIZE / (H - 1);
  const steepest = (smp) => {
    let m = 0;
    const h = (x, y) => smp[x * H + y] * M;
    for (let x = 0; x < 128; x++) for (let y = 0; y < 128; y++) {
      const a = h(x, y), b = h(x + 1, y), c = h(x, y + 1), d = h(x + 1, y + 1);
      m = Math.max(m, Math.hypot(b - a, c - a), Math.hypot(b - a, d - b), Math.hypot(d - c, c - a), Math.hypot(d - c, d - b));
    }
    return m / CELL;
  };
  const lf = createLandforms({ woods: hill, roads: net });
  const relief = generateSamples(hill, 500, 250, H, createLandforms({ woods: hill })), cut = generateSamples(hill, 500, 250, H, lf);
  const g0 = steepest(relief), g1 = steepest(cut);
  assert.ok(g0 > 1.2 && g0 < 1.4, `the hillside: ${g0.toFixed(2)}`);
  assert.ok(g1 - g0 <= LANDFORM_DIALS.bankGrade + 0.05, `a bank ${g1.toFixed(2)} on a hillside of ${g0.toFixed(2)} (${(Math.atan(g1) * 180 / Math.PI).toFixed(0)} degrees) - level across it stood 2.46`);
  // the law written out, held, is the shaper at every sample of the bench - and the hold is what it says there: unheld,
  // the law parts from it under the banks
  const shape = lf.pixel(500, 250), law = lawOf(net, 500, 250, hill), loose = lawOf(net, 500, 250, hill, { held: false });
  const { base, noise } = kernelTerms(hill, 500, 250);
  let held = 0;
  for (let x = 0; x <= 128; x++) for (let y = 0; y <= 128; y++) {
    const low = base(x, y) * 8, g = 4.5 + 4.5 * Math.sin(0.37 * x + 0.61 * y), h = Math.min(Math.max(low + noise(x, y) * 4 + g, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);
    const got = shape(x, y, h, low, g);
    assert.ok(Math.abs(got - law(x, y, h, low, g)) < 1e-9, `(${x},${y}): the shaper against the law`);
    if (Math.abs(got - loose(x, y, h, low, g)) > 0.1) held++;
  }
  assert.ok(held > 500, `the hold holds the bench's banks (${held} samples)`);
  // a run at Speed 100, Running 100 straight down the hillside across the track: no landing bills HP
  const heightAt = (x, z) => {
    const fx = Math.max(0, Math.min(127.999, x / CELL)), fz = Math.max(0, Math.min(127.999, z / CELL));
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, v = (a, b) => cut[a * H + b] * M;
    return v(ix, iz) * (1 - ax) * (1 - az) + v(ix + 1, iz) * ax * (1 - az) + v(ix, iz + 1) * (1 - ax) * az + v(ix + 1, iz + 1) * ax * az;
  };
  const falls = [];
  for (const z of [200, 300, 400, 500, 600]) {
    const col = new Collider(heightAt), m = new PlayerMotor(col, { speed: 100, running: 100, swimming: 30 });
    m.spawn(520, col.restFloor(520, z), z);
    const idle = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
    for (let i = 0; i < 30; i++) m.update(1 / 60, idle, -Math.PI / 2);
    for (let f = 0; f < 600 && m.pos[0] > 300; f++) { m.update(1 / 60, { ...idle, forward: 1, run: true }, -Math.PI / 2); if (m.landedFallDistance > 0) falls.push(+m.landedFallDistance.toFixed(1)); }
  }
  assert.deepEqual(falls.filter((d) => d > 5), [], `falls landed across the track: ${JSON.stringify(falls)} m`);
});

/** world.js's roads sweep, destroyPixel and the publish's re-stand block, sliced and run as written over the real loot
 *  pool, every name they do not ask for answered by a do-nothing stand-in (lane G's harness). */
function rebuildHost(vars) {
  const sliceTo = (head, end) => { const i = WORLD.indexOf(head), j = WORLD.indexOf(end, i); assert.ok(i > 0 && j > i, head); return WORLD.slice(i, j + end.length); };
  const SWEEP = sliceTo('  function sweepRoadless() {', '\n  }\n');
  const DESTROY = sliceTo('  function destroyPixel(px, py, { collectLoose = true } = {}) {', '\n  }\n');
  const i = WORLD.indexOf('    if (labGrassField) {   // WOD2'), j = WORLD.indexOf('    if (homeTown) _homeLookV = -1;', i);
  assert.ok(i > 0 && j > i, 'the publish\'s re-stand block');
  const noop = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => NaN : k === Symbol.iterator ? function* () {} : noop), apply: () => noop });
  const KEEP = new Set(['Math', 'Number', 'Object', 'Array', 'Map', 'Set', 'JSON', 'Infinity', 'NaN', 'undefined', 'String', 'Boolean', 'Symbol', 'console', 'Float32Array']);
  const scope = new Proxy(vars, { has: (t, k) => !KEEP.has(k), get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
  const fns = new Function('scope', `with (scope) { ${DESTROY}\n${SWEEP}\n return { destroyPixel, sweepRoadless }; }`)(scope);
  const publish = new Function('scope', `with (scope) { ${WORLD.slice(i, j)} }`);
  // the rides, bound as the boot binds them once the pools and the player stand (BOOT-TDZ2, K1)
  new Function('scope', `with (scope) { ${sliceTo('  rideGround = (t, key, moved) => {', '\n  };\n')} }`)(scope);
  // the publish's own names ride the scope: under `with` the stand-in answers before a parameter would
  return { ...fns, publish: (px, py) => { Object.assign(vars, { px, py, key: `${px},${py}` }); publish(scope); } };
}

test('AUDIT LANDFORMS II G1/G2: a pixel rebuilt under the live pools carries what lies on its ground - a pile on the river\'s floor stood before the network landed rides the cut down with it, and the player the hold kept standing there rides it too; a fall under way keeps its own', () => {
  // the river's floor at (300, 255), off the road: built before the network landed (the lift alone), then cut
  const px = 300, py = 255, key = `${px},${py}`, sx = 40, sy = 64;
  const job = (roads) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads, landform: true }).samples;
  const before = job(null), after = job(NET);
  const cell = TERRAIN_SIZE / (H - 1), M = UNIT * STREAMING_TERRAIN_SCALE, x = sx * cell, z = sy * cell;
  const gB = before[sx * H + sy] * M, gA = after[sx * H + sy] * M;
  assert.ok(gA < gB - 1, `the landing cut the channel here (${(gA - gB).toFixed(2)} m)`);
  const run = ({ grounded }) => {
    const loot = createDroppedLoot({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} }, getTexture: async () => ({ getSize: () => ({ width: 32, height: 32 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 1 }), uploadRecordFrame: () => {} });
    const pile = loot.dropPile([{ group: 'Gems', templateIndex: 0 }], [x, gB, z], key);
    const player = { pos: [x + 3, gB + 0.25, z], grounded };
    const built = new Map([[key, { px, py, withRoads: false, samples: before, batches: [], models: [] }]]);
    const host = rebuildHost({
      built, queue: [], droppedLoot: loot, walkMode: true, playerSpawned: true, player, _seasonHoldKey: null, _groundBefore: new Map(),
      state: { current: { x: px, y: py }, pixelTranslation: () => [0, 0, 0] }, nearestFirstFrom: () => () => 0,
      TERRAIN_SIZE, HEIGHTMAP_DIMENSION: H, heightCell: cell, worldHeight: M,
    });
    host.sweepRoadless();   // the network landed: the roadless pixel torn down (collectLoose: false), queued again
    assert.equal(built.has(key), false);
    built.set(key, { px, py, withRoads: true, samples: after, batches: [], models: [] });   // the rebuild, cut along the network
    host.publish(px, py);
    return { pile, player, gP: (() => { const fx = (x + 3) / cell, ix = Math.floor(fx), a = fx - ix; return ((after[ix * H + sy] * (1 - a) + after[(ix + 1) * H + sy] * a) - (before[ix * H + sy] * (1 - a) + before[(ix + 1) * H + sy] * a)) * M; })() };
  };
  const stood = run({ grounded: true });
  assert.ok(Math.abs(stood.pile.pos[1] - gA) < 1e-6, `the pile stands ${(stood.pile.pos[1] - gA).toFixed(2)} m over the rebuilt ground - stood on the ground before the network and never again`);
  assert.ok(Math.abs(stood.player.pos[1] - (gB + 0.25 + stood.gP)) < 1e-6, `the held player rides the cut (${(stood.player.pos[1] - gB - 0.25).toFixed(2)} m) - put back where they stood, they fell it`);
  const falling = run({ grounded: false });
  assert.equal(falling.player.pos[1], gB + 0.25, 'a fall under way is its own (FALL-KEPT)');
  assert.ok(Math.abs(falling.pile.pos[1] - gA) < 1e-6);
});

test('AUDIT LANDFORMS II G3: a Basic Roads file that never arrives is a failed ask - its fetch and its body each time out - so the port\'s own network or the next retry stands in, never a roadless session', async () => {
  assert.equal(MOD_ROADS_FETCH_TIMEOUT_MS, 30000);
  const guard = (p) => Promise.race([p, new Promise((res) => setTimeout(() => res('still waiting'), 2000))]);
  const signals = [];
  const never = (url, init) => { signals.push(init?.signal); return new Promise(() => {}); };
  assert.equal(await guard(loadModRoads(never, MOD_ROADS, 20)), null, 'a fetch that never answers: settled, failed');
  assert.ok(signals[0]?.aborted, 'and asked to stop');
  const bodiless = () => Promise.resolve({ ok: true, arrayBuffer: () => new Promise(() => {}) });
  assert.equal(await guard(loadModRoads(bodiless, MOD_ROADS, 20)), null, 'a body that never arrives: settled, failed');
  // and an answer in time is the arrays, as before - every file asked in turn
  const files = Object.keys(MOD_ROADS), asked = [];
  const quick = (url) => { asked.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(MAP_WIDTH * MAP_HEIGHT)) }); };
  const got = await loadModRoads(quick, MOD_ROADS, 20);
  assert.deepEqual(Object.keys(got).filter((k) => files.includes(k)).sort(), [...files].sort());
  assert.deepEqual(asked, Object.values(MOD_ROADS));
});

test('AUDIT LANDFORMS II H2: nature asks the beach line of DFU\'s own blend in a town\'s pixel, as the tiles do - the landforms move the ground, never where the beach is', () => {
  // THE LAW, at every door nature asks it: on a ground whose own samples lie a hair under the beach line, nature stands
  // where `beach` says land - the scatter, the woods, the ecotone's border tiles and the gathering nodes' natureStandsAt -
  // and nowhere without it
  const low = new Float32Array(H * H).fill(SCALED_BEACH_ELEVATION / UNIT - 1e-4), over = new Float32Array(H * H).fill(SCALED_BEACH_ELEVATION / UNIT + 0.02);
  const grass = new Uint8Array(128 * 128).fill(2);
  const base = { mapPixelX: 300, mapPixelY: 250, rawWorldHeight: 60, climateType: 2, locationRect: null };
  // (each counts its own flats: the border's are the ones a neighbour's climate lays, carrying its archive - the pixel's
  // own scatter beside them would stand without the border's door)
  const all = () => true, borders = (f) => f.archive != null;
  for (const [what, opts, own] of [['the scatter', {}, all], ['the woods', { forests: { archive: 504, pois: [], paths: null } }, all],
    ['the border', { ecotone: { nature: [504, 504, 506, 504, 504, 506, 503, 503, 503], type: [2, 2, 3, 2, 2, 3, 0, 0, 0] } }, borders]]) {
    assert.equal(layoutNature(low, grass, { ...base, ...opts }).length, 0, `${what}: under the beach line, nothing`);
    assert.ok(layoutNature(low, grass, { ...base, ...opts, beach: over }).filter(own).length > 50, `${what}: the beach line asked of the blend it is handed`);
  }
  assert.equal(natureStandsAt(low, grass, null, 64, 64), null);
  assert.ok(natureStandsAt(low, grass, null, 64, 64, null, over), 'the gathering nodes\' door');
  // ...and through the pipeline: the fixture's river out to sea (x 92..112 along y = 300) through a town on the shore - its
  // channel moves the pixel's mean, and the blend carries that onto the beach by hundredths of a unit
  const px = 100, py = 300, rect = { xMin: 80, xMax: 112, yMin: 48, yMax: 80 };
  const run = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, roads: NET, landform });
  const dfu = run(false), shaped = run(true);
  assert.deepEqual(shaped.tilemapBytes, dfu.tilemapBytes, 'D3: every tile DFU\'s');
  assert.equal(dfu.beach, null, 'the row off: no second blend');
  // the beach nature asks is DFU's own ground to the bit - its blend and the road's smoothing under the painted tiles - here
  // and on a town the road crosses
  assert.ok(Object.is(shaped.beach.length, dfu.samples.length) && shaped.beach.every((v, i) => Object.is(v, dfu.samples[i])), 'DFU\'s samples, the shore\'s');
  // ...and where World of Daggerfall levels a site in the pixel (WOD2: after the tiles, before the nature - DFU's nature
  // reads the levelled ground), DFU's samples levelled by the same picks, to the bit
  const site = { picks: [{ flatten: true, rect: { x: 20, y: 30, width: 8, height: 8 } }] };
  const levelled = (landform) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 231, roads: NET, landform, wod: site });
  const wDfu = levelled(false), wShaped = levelled(true);
  assert.ok(wDfu.samples.some((v, i) => v !== dfu.samples[i]), 'the site levels DFU\'s pixel');
  assert.ok(wShaped.beach.every((v, i) => Object.is(v, wDfu.samples[i])), 'DFU\'s samples, levelled by the site as DFU levels them');
  const roadTown = (landform) => generatePixelTerrain({ woods, px: 300, py: 250, tilemap: new Uint8Array(128 * 128), locationRect: { xMin: 20, xMax: 50, yMin: 40, yMax: 90 }, hasLocation: true, climateType: 231, roads: NET, landform });
  const town = roadTown(true), townDfu = roadTown(false);
  assert.ok(town.beach.some((v, i) => v !== town.samples[i]), 'a town the landforms move');
  assert.ok(town.beach.every((v, i) => Object.is(v, townDfu.samples[i])), 'DFU\'s samples under the road\'s smoothing too');
  let refused = 0, crossed = 0;
  const moved = [];
  for (let ty = 0; ty < 128; ty++) for (let tx = 0; tx < 128; tx++) {
    const t = shaped.tilemap[ty * 128 + tx] & 0x3f;
    if (t !== 1 && t !== 2 && t !== 3) continue;
    const hx = Math.min(128, Math.trunc(129 * (tx / 128))), hy = Math.min(128, Math.trunc(129 * (ty / 128)));
    const under = (smp) => sampleHeight(smp[hy + hx * 129]) < SCALED_BEACH_ELEVATION;
    if (under(dfu.samples)) refused++;
    if (under(dfu.samples) !== under(shaped.samples)) crossed++;
    const a = !!natureStandsAt(dfu.samples, dfu.tilemap, rect, tx, ty), b = !!natureStandsAt(shaped.samples, shaped.tilemap, rect, tx, ty, null, shaped.beach);
    if (under(dfu.samples) !== under(shaped.samples) && a !== b) moved.push([tx, ty, a, b]);
  }
  assert.ok(refused > 0 && crossed > 0, `the shore has land tiles DFU's nature refuses as beach (${refused}), and the shaped blend crosses the line at ${crossed}`);
  assert.deepEqual(moved, [], `nature's beach answer moved at ${moved.length} land tiles: ${JSON.stringify(moved.slice(0, 6))}`);
  // ...and the pipeline hands its own nature that blend: a hamlet where the fixture's road comes down to the beach (103, 200),
  // the cut moving its blend across the line - its scatter and its woods stand every flat where DFU's own do, flat for flat
  // (the ground under them is the landforms', H3; where they stand is the beach's)
  const place = (f) => [f.x, f.z, f.record];
  for (const forests of [null, { archive: 504, hidden: false }]) {
    const hamlet = (landform) => generatePixelTerrain({ woods, px: 103, py: 200, tilemap: new Uint8Array(128 * 128), locationRect: { xMin: 56, xMax: 72, yMin: 56, yMax: 72 }, hasLocation: true, climateType: 231, roads: NET, landform, forests });
    const on = hamlet(true), off = hamlet(false);
    const across = on.beach.filter((v, i) => (sampleHeight(v) < SCALED_BEACH_ELEVATION) !== (sampleHeight(on.samples[i]) < SCALED_BEACH_ELEVATION)).length;
    assert.ok(across > 0 && on.nature.length > 1000, `the cut moves ${across} samples across the line, under ${on.nature.length} flats`);
    assert.deepEqual(on.nature.map(place), off.nature.map(place), `${forests ? 'the woods' : 'the scatter'}: where DFU's nature stands`);
  }
});

test('AUDIT LANDFORMS II H3: with the row on a town pixel\'s nature - its scatter, its woods and the ecotone\'s border flats - stands on the shaped ground the pixel is built of, never DFU\'s blend', () => {
  // a town on the fixture's rising land: the relief lifts it, and DFU's blend (the kernel's `classic`) stands a lift under it;
  // a temperate pixel with a swamp to its east and a desert to its north, so ECOTONE1 lays border tiles by their rules
  const px = 300, py = 150, rect = { xMin: 48, xMax: 80, yMin: 48, yMax: 80 };
  const ecotone = { nature: [504, 504, 506, 504, 504, 506, 503, 503, 503], type: [2, 2, 3, 2, 2, 3, 0, 0, 0] };
  let checked = 0, border = 0;
  for (const forests of [null, { archive: 504, hidden: false }]) {
    const out = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 2, roads: NET, landform: true, forests, ecotone });
    assert.ok(out.beach, 'the town\'s own DFU blend rode beside it');
    for (const f of out.nature) {
      const sink = groundAt(out.samples, f.x, f.z) - f.y;
      assert.ok(sink >= -1e-6 && sink <= 50 / 70 + 1e-6, `a flat at (${f.x.toFixed(1)}, ${f.z.toFixed(1)}) stands ${sink.toFixed(2)} under its ground`);
      checked++; if (f.archive != null) border++;
    }
  }
  assert.ok(checked > 1000 && border > 50, `${checked} flats, ${border} of the border's`);
});

test('AUDIT LANDFORMS II H1: THE ONE CONSTRUCTION SEAM for C1 - every height world.js sheds the frame\'s compensation off goes into DFU\'s frame, or is a named transient with its why; a new writer of an exterior height fails here, not in a save', () => {
  // C1's own pin names the twelve writers of today and cannot fail on a thirteenth; this sweeps the host. (It cannot see a
  // writer outside world.js - the hosts' others hand world.js their heights, THE FOUR HOSTS in Landforms.md.)
  const TRANSIENT = new Map([
    ['if (Number.isFinite(h)) return y - (h - state.compensation[1] - now) * (r - 1) + now;', 'restandHeight itself: the read side'],
    ['const campToNatives = (pos) => { const wc = state.worldCoords(pos); return [wc.x, pos[1] - state.compensation[1], wc.z]; };', 'a recenter, this ground both ways (campToRecord is the record\'s)'],
    ['toNative: (p) => { const w = state.worldCoords(p); return [w.x, p[1] - state.compensation[1], w.z]; },', 'the sailing cabins\' live access'],
    ['const cabin = { v: 1, uid: boat.uid, hull: boat.hull, origin: [origin.x, boat.GameObject.position[1] - state.compensation[1], origin.z],', 'a boat at sea - its pixel is what is read, under the knee'],
    ['y: player.pos[1] - state.compensation[1], yaw: cam.yaw,', 'the horse cart\'s party departure, one trip\'s'],
    ['const campToWire = (p) => { const wc = state.worldCoords(p); return [wc.x, p[1] - state.compensation[1], wc.z]; };   // SURV3: the pose\'s own law for the world frame', 'the wire: the room stands on one ground (C2)'],
    ['pos: inDungeon ? [...player.pos] : [wc.x, player.pos[1] - state.compensation[1], wc.z],', 'a staff teleport\'s live destination'],
    ['toWire: (feet) => { const wc = state.worldCoords(feet); return [wc.x, feet[1] - state.compensation[1], wc.z]; },', 'the wire'],
    ['const partyFeetOf = (pos) => { const wc = state.worldCoords(pos); return { wx: wc.x, wy: pos[1] - state.compensation[1], wz: wc.z }; };', 'the party\'s live feet'],
    ['? { x: wc.x, y: player.pos[1] - state.compensation[1], z: wc.z, yaw: cam.yaw, pitch: cam.pitch, mv: 0 }', 'the online pose'],
    [': { x: player.pos[0], y: shedY ? player.pos[1] - state.compensation[1] : player.pos[1], z: player.pos[2], yaw: cam.yaw, pitch: cam.pitch, mv: 0 };', 'the online pose'],
    ['sceneToOnline = nativeFrame ? campToWire : (q) => [q[0], shedY ? q[1] - state.compensation[1] : q[1], q[2]];   // AUDIT MERGE-PLUS B1', 'the online pose'],
    ['restandSceneHeight: (y, x, z, was) => restandHeight(y - state.compensation[1], x, z, was) + state.compensation[1],', 'the read side'],
    ['toWire: (feet) => [feet[0], feet[1] - state.compensation[1], feet[2]],', 'the wire'],
  ]);
  const raw = WORLD.split('\n').map((l) => l.trim()).filter((l) => /-\s*state\.compensation\[1\]/.test(l) && !/groundFrame(Height|Native)\(/.test(l));
  assert.deepEqual(raw.filter((l) => !TRANSIENT.has(l)), [], 'an exterior height shed raw - into DFU\'s frame (groundFrameHeight / groundFrameNative), or named here with its why');
  for (const l of TRANSIENT.keys()) assert.ok(raw.includes(l), `a transient named here that the host no longer has: ${l}`);
});

test('AUDIT LANDFORMS II J4: a cut is held at the floor, half a unit over the knee - the river\'s mouth stands there exactly, never under it', () => {
  // the fixture's river out to sea (x 92..112 along y = 300): its channel would run under the beach line at the mouth,
  // and LANDFORM_FLOOR holds it - the floor's value was pinned only by an inequality, and +5 or +0.05 survived
  const floor = Math.fround(LANDFORM_FLOOR / UNIT);
  let held = 0;
  for (const px of [99, 100, 101, 102, 103, 104, 105]) {
    const s = generateSamples(woods, px, 300, H, LF), d = generateSamples(woods, px, 300, H, null);
    for (let i = 0; i < s.length; i++) {
      if (s[i] === floor) held++;
      if (d[i] * UNIT > LANDFORM_KNEE) assert.ok(s[i] >= Math.min(floor, d[i] + reliefLift(0)), `${px},300 #${i}: over the knee, never under the floor (${(s[i] * UNIT).toFixed(3)})`);
    }
  }
  assert.ok(held >= 3, `the mouth's cut held at exactly the floor (${held} samples)`);
});

test('AUDIT LANDFORMS II J5: a record on a town pixel\'s west or south edge reads the town\'s field at its edge - the field holds its reads to the pixel, never past its first row', () => {
  // world.js's own arithmetic, recentred, hands the field a hair under 0 at a pixel's edge (-3.6e-14 at 4,681 of 200,000
  // points lane J ran) - unclamped, a town's field read before its first row, a NaN into the save
  const px = 330, py = 250, rect = { xMin: 40, xMax: 80, yMin: 50, yMax: 90 };
  const field = landformLiftField(woods, px, py, rect, H, LF);
  for (const [sx, sy] of [[-3.6e-14, 40], [40, -3.6e-14], [-3.6e-14, -3.6e-14], [128 + 3.6e-14, 40]]) {
    const v = field(sx, sy);
    assert.ok(Number.isFinite(v), `(${sx}, ${sy}): ${v}`);
    assert.ok(Object.is(v, field(Math.min(128, Math.max(0, sx)), Math.min(128, Math.max(0, sy)))), 'the edge\'s own value');
  }
});

test('AUDIT LANDFORMS II J7: online the host asks Basic Roads again on the retry\'s own defaults - the page\'s fetch, the backoff\'s real waits, twelve more tries - and hands it nothing else', async (t) => {
  // the host's call: onTry alone (a `max: 0`, a wait of nought or no fetch there survived every test, which stubbed it)
  assert.match(WORLD, /retryModRoads\(\{ onTry: \(n, ms\) => console\.warn\([^\n]*\}\)\.then\(\(late\) => \{/, 'the host asks with onTry alone');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const realFetch = globalThis.fetch, asked = [];
  let failing = 2;   // the first two tries fail at his first file, the third answers
  globalThis.fetch = (url) => {
    asked.push(url);
    if (url === Object.values(MOD_ROADS)[0] && failing > 0) { failing--; return Promise.resolve({ ok: false }); }
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(MAP_WIDTH * MAP_HEIGHT)) });
  };
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const drive = async (state, waits) => { for (let i = 0; i < 20 && state.done === undefined; i++) { await flush(); if (waits.length) t.mock.timers.tick(waits.at(-1)); await flush(); } };
  try {
    const waits = [], state = { done: undefined };
    retryModRoads({ onTry: (n, ms) => waits.push(ms) }).then((r) => { state.done = r; });
    await flush();
    assert.deepEqual(asked, [], 'nothing asked before the first wait');
    t.mock.timers.tick(waits[0] - 1); await flush();
    assert.deepEqual(asked, [], 'nor a millisecond before it ends - the backoff waits its whole length');
    await drive(state, waits);
    assert.deepEqual(waits, [5000, 10000, 20000], 'WOD6\'s backoff, waited for real');
    assert.ok(state.done?.roads instanceof Uint8Array, 'his arrays, on the third try');
    assert.deepEqual(asked, [Object.values(MOD_ROADS)[0], Object.values(MOD_ROADS)[0], ...Object.values(MOD_ROADS)], 'through the page\'s own fetch: his first file twice, then all four');
    // ...and every try failing: twelve more, then none
    asked.length = 0; failing = Infinity;
    const all = [], none = { done: undefined };
    retryModRoads({ onTry: (n, ms) => all.push(ms) }).then((r) => { none.done = r; });
    await drive(none, all);
    assert.equal(none.done, null);
    assert.deepEqual(all, [5000, 10000, 20000, 40000, ...Array(8).fill(60000)]);
    assert.equal(asked.length, MOD_ROADS_RETRY_MAX);
  } finally { globalThis.fetch = realFetch; }
});

test('AUDIT LANDFORMS II I1: the lift fades beside the sea - a sea cliff\'s rim stands as DFU stands it and the plateau behind it takes its whole lift three map pixels in, no slope steeper than DFU\'s; a road over it, the far ring and every seam the same', () => {
  // Menevia's own shape: a plateau of 75 straight out of the fixture's sea at x = 100, rows 420..440, the sea beside it at
  // the beach line's own byte (5, still the sea's); a road west to east down over its rim
  const bytes = syntheticWoodsBytes(), hm = new DataView(bytes.buffer).getUint32(28, true);
  for (let y = 420; y <= 440; y++) { bytes[hm + y * MAP_WIDTH + 99] = 5; for (let x = 100; x <= 112; x++) bytes[hm + y * MAP_WIDTH + x] = 75; }
  const cw = load(bytes), byteAt = (x, y) => cw.getHeightMapValue(x, y);
  const net = network();
  for (let x = 96; x <= 108; x++) net.roads[430 * MAP_WIDTH + x] |= DIR.E | DIR.W;
  const CUT = createLandforms({ woods: cw, roads: net }), RELIEF_ALONE = createLandforms({ woods: cw });
  // the byte nodes: the sea's and the rim's none of the lift, two in half, three in all of it - in 1024ths, so the
  // kernel's cubic over them is exact (a node a diagonal or a knight's move from the sea too)
  assert.deepEqual([98, 99, 100, 101, 102, 103].map((x) => cliffFadeAt(byteAt, x, 430)), [0, 0, 0, 0.5, 1, 1]);
  const lone = (x, y) => (x === 0 && y === 0 ? 0 : 75);
  for (const [dx, dy] of [[1, 1], [2, 1], [2, 2]]) {
    const f = cliffFadeAt(lone, dx, dy), d = Math.hypot(dx, dy), t = (d - 1) / 2;
    assert.ok(Number.isInteger(f * 1024) && Math.abs(f - t * t * (3 - 2 * t)) <= 1 / 2048, `${dx},${dy}: ${f}`);
  }
  // the rim's own pixel (its samples run from the sea's node to the rim's) stands as DFU stands it; three nodes in, the
  // relief's whole lift
  const dfuAt = (px) => generateSamples(cw, px, 430), reliefAt = (px) => generateSamples(cw, px, 430, H, RELIEF_ALONE);
  const face = reliefAt(100), faceDfu = dfuAt(100);
  assert.ok(face.every((v, i) => Object.is(v, faceDfu[i])), 'the cliff face: DFU\'s ground to the bit');
  const { base } = kernelTerms(cw, 103, 430), inland = reliefAt(103), plain = dfuAt(103);
  for (let x = 0; x <= 128; x += 8) for (let y = 0; y <= 128; y += 8) {
    const want = Math.min(plain[x * H + y] * UNIT + reliefLift(base(x, y) * 8), Infinity);
    assert.ok(Math.abs(inland[x * H + y] * UNIT - want) < 1e-3, `three nodes in, the whole lift (${x},${y})`);
  }
  // no 51 m grade across the plateau's rim steeper than DFU's own (it stood at 2.8 times it, unfaded)
  const steepest = (get) => {
    let g = 0;
    for (let px = 99; px <= 104; px++) {
      const smp = get(px);
      for (let y = 0; y <= 128; y += 8) for (let x = 0; x + 8 <= 128; x += 8) g = Math.max(g, Math.abs(smp[(x + 8) * H + y] - smp[x * H + y]) * UNIT * 1.25 / 51.2);
    }
    return g;
  };
  const gDfu = steepest(dfuAt), gFaded = steepest(reliefAt);
  assert.ok(gDfu > 1 && gFaded <= gDfu * 1.02, `the rim's steepest grade ${gFaded.toFixed(2)} against DFU's ${gDfu.toFixed(2)}`);
  // a road down over the rim is graded to the faded ground (the written-out law states the fade on its own), every sample
  for (const px of [99, 100, 101, 102, 103]) {
    const shape = CUT.pixel(px, 430), law = lawOf(net, px, 430, cw), terms = kernelTerms(cw, px, 430);
    for (let x = 0; x <= 128; x += 2) for (let y = 0; y <= 128; y += 2) {
      const low = terms.base(x, y) * 8, h = Math.min(Math.max(low + terms.noise(x, y) * 4, SCALED_OCEAN_ELEVATION), MAX_TERRAIN_HEIGHT);
      assert.ok(Math.abs(shape(x, y, h, low, 0) - law(x, y, h, low, 0)) < 1e-9, `${px},430 (${x},${y}): the shaper against the law`);
    }
  }
  // the far ring stands the rim's node as DFU stands it and the plateau's three in at the whole lift - and so the view
  const ring = buildFarRingGrid({ heightBytes: cw.heightMapBuffer, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, climateAt: () => 231, baseX: 104, baseY: 430, radius: 6, relief: true });
  const ringY = (x) => ring.positions[((430 - 430 + 6) * 13 + (x - 104 + 6)) * 3 + 1];
  assert.equal(ringY(100), Math.fround(ringHeight(75)), 'the rim\'s node: no lift');
  assert.equal(ringY(101), Math.fround(ringHeight(75, true, 0.5)));
  assert.equal(ringY(103), Math.fround(ringHeight(75, true)), 'three in: the whole lift');
  assert.match(WORLD, /cliffFadeAt\(\(bx, by\) => woods\.getHeightMapValue\(bx, by\), px\.x, px\.y\) : 1;[^\n]*\n\s+return \[x, ringHeight\(byte, !!landform, fade\)/, 'the travel view past the grid fades it the same');
  // and every edge across the fade, a road over it, is one number from both pixels
  const cut = (px, py) => generateSamples(cw, px, py, H, CUT);
  for (const px of [99, 100, 101, 102]) {
    const a = cut(px, 430), b = cut(px + 1, 430), n = cut(px, 429);
    for (let y = 0; y <= 128; y++) assert.ok(Object.is(a[128 * H + y], b[0 * H + y]), `${px}|${px + 1},430 at y ${y}`);
    for (let x = 0; x <= 128; x++) assert.ok(Object.is(a[x * H + 128], n[x * H + 0]), `${px},430|429 at x ${x}`);
  }
});

// OW-DUNGEONS (2026-10-08, Mac: "with dungeons on the overworld it doesnt show a dungeon model"; asked where:
// "Overworld view"; which: "Check it all"; asked the look: "Its own model, enlarged"): EACH DUNGEON'S OWN MODEL,
// ENLARGED, UNDER THE OVERWORLD - the law (systems/travelDungeonModels.js: the set, the entrance model by DFU's own door
// law, the grow with the eye's distance, the matrix about its foot), the door law in one home (world/meshReader.js
// subMeshDoorType, read by dfMeshToModel too), and the world host's list, load and draw (scenes/world.js), lifted and
// run over stubs. Design: bible/06-Systems/Travel-View.md OW-DUNGEONS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  dungeonModelSet, meshHasDungeonEntrance, dungeonEntranceModel, owDungeonGrow, owDungeonDrawn, grownModelMatrix, modelFoot,
  TV_DUNGEON_MODELS_MAX, TV_DUNGEON_ICON_K, TV_DUNGEON_GROW_MAX, TV_DUNGEON_GROWN_MIN, startDungeonLoads,
} from '../src/systems/travelDungeonModels.js';
import { subMeshDoorType, dfMeshToModel, DOOR_TYPE } from '../src/world/meshReader.js';
import { trs, multiply } from '../src/world/mat4.js';
import { TV_OWN_GROW_MAX, TV_OWN_GROW_M } from '../src/player/travelCamera.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m[1]; };
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
/** A point through a column-major 4x4. */
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** An ARCH3D mesh as Arch3dFile.getMesh decomposes one: each submesh a picture and its planes (one triangle each). */
const pt = (x, y, z) => ({ x, y, z, nx: 0, ny: -1, nz: 0, u: 0, v: 0 });
function meshOf(subs) {
  const subMeshes = subs.map(([textureArchive, textureRecord, planes = 1]) => ({
    textureArchive, textureRecord, totalTriangles: planes,
    planes: Array.from({ length: planes }, (_, i) => ({ points: [pt(i, 0, 0), pt(i + 1, 0, 0), pt(i, 0, 1)] })),
  }));
  const totalTriangles = subMeshes.reduce((n, s) => n + s.totalTriangles, 0);
  return { totalVertices: totalTriangles * 3, totalTriangles, subMeshes };
}
const SIZE = () => ({ width: 64, height: 64 });
const readerSaysEntrance = (m) => dfMeshToModel(m, SIZE).doors.some((d) => d.type === DOOR_TYPE.DUNGEON_ENTRANCE);

// ── the door law, one home ──────────────────────────────────────────────────────────────────────────────────────────

test('OW-DUNGEONS the door law in one home: DFU\'s LoadVertices table - 74 a building, 56 a dungeon\'s way in, 331 past its stone record, 95 a way out, climate variants reduced but never 331 or Scourg\'s 156 - and dfMeshToModel reads its doors through it (mutants: the reduction lost; 331\'s stone a door; Scourg reduced; the table moved)', () => {
  assert.equal(subMeshDoorType(74, 0), DOOR_TYPE.BUILDING);
  assert.equal(subMeshDoorType(56, 3), DOOR_TYPE.DUNGEON_ENTRANCE);
  assert.equal(subMeshDoorType(156 + 300, 0), DOOR_TYPE.DUNGEON_ENTRANCE, 'a climate variant of 56 (456) reduces to it');
  assert.equal(subMeshDoorType(374, 0), DOOR_TYPE.BUILDING, 'and of 74');
  assert.equal(subMeshDoorType(331, 0), DOOR_TYPE.NONE, 'the ruins\' record 0 is plain stone');
  assert.equal(subMeshDoorType(331, 1), DOOR_TYPE.DUNGEON_ENTRANCE, 'past it, a way in');
  assert.equal(subMeshDoorType(156, 0), DOOR_TYPE.NONE, 'Scourg\'s exterior is never reduced, and is no door');
  assert.equal(subMeshDoorType(95, 0), DOOR_TYPE.DUNGEON_EXIT);
  assert.equal(subMeshDoorType(195, 0), DOOR_TYPE.DUNGEON_EXIT, '195 reduces to 95');
  assert.equal(subMeshDoorType(12, 0), DOOR_TYPE.NONE);
  assert.equal(subMeshDoorType(100, 0), DOOR_TYPE.NONE, 'a hundred is not over a hundred - itself, no door');
  // the reader's doors are the law's, submesh by submesh
  const m = dfMeshToModel(meshOf([[74, 0, 2], [12, 0], [331, 0], [331, 4], [95, 1]]), SIZE);
  assert.deepEqual(m.doors.map((d) => d.type), [DOOR_TYPE.BUILDING, DOOR_TYPE.BUILDING, DOOR_TYPE.DUNGEON_ENTRANCE, DOOR_TYPE.DUNGEON_EXIT]);
  assert.deepEqual(m.doors.map((d) => d.index), [0, 1, 0, 0], 'the index resets per submesh (verbatim DFU)');
  assert.match(readFileSync(new URL('../src/world/meshReader.js', import.meta.url), 'utf8'), /const doorType = subMeshDoorType\(sm\.textureArchive, sm\.textureRecord\);\n\s*const doorFound = doorType !== DOOR_TYPE\.NONE;/);
});

test('OW-DUNGEONS a mesh\'s way in, asked without building it: the same answer as the reader\'s doors for every kind of submesh - and none for a picture with no plane to be the door (mutants: any door a way in; the planes unasked; the first submesh alone)', () => {
  const cases = [[[56, 0]], [[12, 0], [56, 2]], [[331, 0]], [[331, 1]], [[74, 0], [95, 0]], [[456, 0]], [[156, 0]], [[12, 0]]];
  for (const subs of cases) assert.equal(meshHasDungeonEntrance(meshOf(subs)), readerSaysEntrance(meshOf(subs)), JSON.stringify(subs));
  assert.equal(meshHasDungeonEntrance(meshOf([[12, 0], [56, 2]])), true, 'a way in on the second submesh');
  assert.equal(meshHasDungeonEntrance(meshOf([[74, 0], [95, 0]])), false, 'a building\'s door and a way out are no way in');
  assert.equal(meshHasDungeonEntrance(meshOf([[56, 0, 0]])), false, 'no plane, no door');
  assert.equal(meshHasDungeonEntrance(null), false);
});

// ── the model ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('OW-DUNGEONS the model: the first placed model, in the blocks\' order and each block\'s own, that carries a way in - at the pixel build\'s own place for it (the location\'s tile origin, the block\'s origin, the model\'s matrix, the level at 0); with none, the exterior\'s largest by its triangles; an enhanced-only model on the enhanced skin alone; a model the player\'s ARCH3D lacks passed over (mutants: the last way in; the smallest; the enhanced-only kept on the classic skin; the block\'s origin dropped; the level kept)', () => {
  const meshes = new Map([[1, meshOf([[12, 0, 3]])], [2, meshOf([[56, 0]])], [3, meshOf([[331, 2]])], [4, meshOf([[12, 0, 9]])], [5, meshOf([[56, 0]])]]);
  const m = (id) => meshes.get(id) ?? null;
  const at = (x, y, z) => trs(x, y, z, 0, 0, 0);
  const blocks = [
    { originX: 0, originZ: 0, layout: { models: [{ modelIdNum: 1, matrix: at(1, 0, 1) }, { modelIdNum: 9, matrix: at(0, 0, 0) }] } },
    { originX: 102.4, originZ: 0, layout: { models: [{ modelIdNum: 5, matrix: at(4, 2, 6), enhancedOnly: true }, { modelIdNum: 2, matrix: at(10, 0.5, 20) }, { modelIdNum: 3, matrix: at(0, 0, 0) }] } },
  ];
  const pick = dungeonEntranceModel(blocks, 300, 500, m, true);
  assert.equal(pick.modelIdNum, 5, 'the enhanced skin stands the enhanced-only way in, first in its block');
  assert.equal(pick.entrance, true);
  const classic = dungeonEntranceModel(blocks, 300, 500, m, false);
  assert.equal(classic.modelIdNum, 2, 'on the classic skin it is not there: the next way in');
  assert.deepEqual([...classic.local.slice(12, 15)].map((v) => Math.round(v * 100) / 100), [300 + 102.4 + 10, 0.5, 500 + 20], 'where the build stands it: the tile origin, the block, its own matrix; the level 0');
  const none = dungeonEntranceModel([{ originX: 0, originZ: 0, layout: { models: [{ modelIdNum: 1, matrix: at(0, 0, 0) }, { modelIdNum: 4, matrix: at(7, 0, 7) }, { modelIdNum: 9, matrix: at(0, 0, 0) }] } }], 0, 0, m, true);
  assert.equal(none.modelIdNum, 4, 'no way in: the largest by its triangles');
  assert.equal(none.entrance, false);
  assert.equal(dungeonEntranceModel([], 0, 0, m), null);
  assert.equal(dungeonEntranceModel([{ originX: 0, originZ: 0, layout: { models: [{ modelIdNum: 9, matrix: at(0, 0, 0) }] } }], 0, 0, m), null, 'none the ARCH3D carries: no model');
});

// ── how much it grows, and where ────────────────────────────────────────────────────────────────────────────────────

test('OW-DUNGEONS the grow: TV_DUNGEON_ICON_K of the eye\'s distance tall, never smaller than itself, never past OW-BIG\'s twelve; a stray distance or height none; a little over half again the traveller\'s icon (mutants: another height; no floor; no ceiling; a stray grown)', () => {
  assert.equal(TV_DUNGEON_ICON_K, 0.09);
  assert.equal(TV_DUNGEON_GROW_MAX, TV_OWN_GROW_MAX, 'OW-BIG\'s own ceiling');
  assert.ok(near(owDungeonGrow(450, 8), (0.09 * 450) / 8), 'a crypt 8 m tall at the view\'s 450 m: about 40 m');
  assert.ok(near(owDungeonGrow(450, 8) * 8, 40.5));
  assert.equal(owDungeonGrow(20, 8), 1, 'near the ground: itself');
  assert.equal(owDungeonGrow(5000, 2), TV_DUNGEON_GROW_MAX, 'far, and small: at most twelve times');
  for (const bad of [[NaN, 8], [450, 0], [0, 8], [-3, 8], [450, NaN], [Infinity, 8]]) assert.equal(owDungeonGrow(...bad), 1, String(bad));
  const ratio = TV_DUNGEON_ICON_K / (1.8 / TV_OWN_GROW_M);
  assert.ok(ratio > 1.5 && ratio < 1.7, `a little over half again the traveller's icon (${ratio.toFixed(2)})`);
});

test('OW-DUNGEONS the matrix: grown about its foot - the middle of its plan on the location\'s level stands on the scene point given, a corner of its box as far out as it is grown, a point its height up that many times up; and over a built pixel drawn only once grown past the world\'s own (mutants: grown about its origin; about its top; drawn twice at its own size)', () => {
  const local = trs(30, 0, 40, 0, 90, 0);
  const box = [26, -1, 37, 34, 9, 43];   // pixel-local, under `local`
  assert.deepEqual(modelFoot(box), [30, 0, 40]);
  const at = [1000, 55, -200], g = 3;
  const m = grownModelMatrix(local, box, at, g);
  // the model's own point standing at its foot (local's origin is the box's plan middle here)
  const footLocal = [0, 0, 0];
  assert.ok(apply(m, footLocal).every((v, i) => near(v, at[i])), 'the foot on the scene point');
  const up = apply(m, [0, 4, 0]);
  assert.ok(near(up[1], at[1] + 4 * g), 'its height grown about the level');
  // a model-space point that stands 2 m east of the foot in the pixel stands 2g east of the scene point
  const inv = trs(30, 0, 40, 0, 90, 0);
  const east = [0, 0, 0];
  const pix = apply(inv, east);
  assert.ok(near(pix[0], 30) && near(pix[2], 40));
  const twoEast = apply(multiply(trs(-30, 0, -40, 0, 0, 0), local), [0, 0, 2]);
  const sEast = apply(m, [0, 0, 2]);
  assert.ok(near(sEast[0] - at[0], twoEast[0] * g) && near(sEast[2] - at[2], twoEast[2] * g), 'out from the foot g times as far');
  // the same as T(at) S(g) T(-foot) local, written with nothing made
  const ref = multiply(trs(at[0], at[1], at[2], 0, 0, 0, g, g, g), multiply(trs(-30, 0, -40, 0, 0, 0), local));
  assert.ok([...m].every((v, i) => near(v, ref[i])), 'the product, element by element');
  const into = new Float32Array(16);
  assert.equal(grownModelMatrix(local, box, at, g, into), into, 'into the matrix it is given');
  // over a built pixel only grown past the world's own
  assert.equal(TV_DUNGEON_GROWN_MIN, 1.05);
  assert.equal(owDungeonDrawn(1, true), false, 'the world\'s own, drawn twice');
  assert.equal(owDungeonDrawn(1.05, true), false);
  assert.equal(owDungeonDrawn(1.06, true), true);
  assert.equal(owDungeonDrawn(1, false), true, 'past the grid nothing stands under it');
});

test('OW-DUNGEONS the set: the nearest first, at most TV_DUNGEON_MODELS_MAX, ties by key so one list is one set (mutants: the farthest; no cap; the order unsettled)', () => {
  assert.equal(TV_DUNGEON_MODELS_MAX, 12);
  const list = Array.from({ length: 20 }, (_, i) => ({ key: `dng:${100 - i}`, d: (i * 7) % 13 }));
  const set = dungeonModelSet(list);
  assert.equal(set.length, 12);
  for (let i = 1; i < set.length; i++) assert.ok(set[i - 1].d < set[i].d || (set[i - 1].d === set[i].d && set[i - 1].key < set[i].key), 'nearest first, then by key');
  assert.deepEqual(dungeonModelSet(list).map((g) => g.key), dungeonModelSet([...list].reverse()).map((g) => g.key), 'one list, one set, however it came');
  assert.deepEqual(dungeonModelSet(list, 0), []);
  assert.deepEqual(dungeonModelSet(null), []);
});

// ── the host ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('OW-DUNGEONS the host\'s list: TV6\'s own law with nothing left to the grid and no cap of its own, a standing Abyss Dungeon known and never timed out by the spawns\' clocks, the nearest twelve kept until the pixel, the finds or the index move (mutants: the grid\'s found left out; the Abyss Dungeon unknown; timed out by a spawn\'s clock; asked every frame)', () => {
  const src = lift(/\n {2}(function tvDungeonModelList\(\) \{[\s\S]*?\n {2}\})\n/, 'tvDungeonModelList');
  const s = { at: { x: 10, y: 20 }, dg: 1, n: 1, asked: [], gone: new Set() };
  const hollow = { name: 'The Brass Hollow', spawned: true, superTier: 'super' };
  const ruin = { name: 'Old Ruin (12,20)', spawned: true };
  const make = new Function('d', `let { tvDngModels } = d; const { playerTravelPixel, discoveryGeneration, nearDungeons, dungeonRows, mapDict, locationIndex, tvPlaceSummary, spawnedPixels, tvFiledSpawns, tvSpawnKnown, tvSpawnFound, tvSpawnGone, dungeonModelSet } = d; let _tvDungeonRows = null; let _locIndexGen = 0; d.gen = (n) => { _locIndexGen = n; };\n${src}\nreturn tvDungeonModelList;`);
  const d = {
    tvDngModels: { at: null, dg: -1, n: -1, list: [] },
    playerTravelPixel: () => s.at, discoveryGeneration: () => s.dg,
    nearDungeons: (q) => {
      s.asked.push(q);
      return [
        { key: 'spawn:900', x: 11, y: 20, loc: hollow, d: 1, spawn: true, known: q.spawnKnown({ loc: hollow, x: 11, y: 20 }), gone: q.spawnGone({ loc: hollow, x: 11, y: 20 }) },
        { key: 'dng:5', x: 10, y: 21, loc: { name: 'Castle Necromoghan' }, d: 1, spawn: false },
        { key: 'spawn:901', x: 12, y: 20, loc: ruin, d: 2, spawn: true, known: q.spawnKnown({ loc: ruin, x: 12, y: 20 }), gone: q.spawnGone({ loc: ruin, x: 12, y: 20 }) },
      ];
    },
    dungeonRows: () => [], mapDict: new Map(), locationIndex: new Map(), tvPlaceSummary: () => null, spawnedPixels: () => [], tvFiledSpawns: () => [],
    tvSpawnKnown: () => false, tvSpawnFound: () => false, tvSpawnGone: (x, y) => s.gone.has(`${x},${y}`), dungeonModelSet,
  };
  const list = make(d);
  d.gen(1);
  const first = list();
  assert.equal(s.asked.length, 1);
  const q = s.asked[0];
  assert.equal(q.max, Infinity, 'no cap of TV6\'s: the set takes its own twelve');
  assert.ok(!('grid' in q), 'nothing left to TV2\'s grid - a found one there is a speck from the eye too');
  assert.deepEqual(first.map((g) => g.key), ['dng:5', 'spawn:900', 'spawn:901'], 'nearest first, ties by key');
  assert.equal(q.spawnKnown({ loc: hollow }), true, 'a standing Abyss Dungeon is known from its rise');
  assert.equal(q.spawnKnown({ loc: ruin }), false, 'a spawn as TV6 knows it');
  s.gone.add('11,20');
  assert.equal(q.spawnGone({ loc: hollow, x: 11, y: 20 }), false, 'its own host stands and takes it - never the spawns\' clocks');
  list(); list();
  assert.equal(s.asked.length, 1, 'kept while nothing moved - an Abyss Dungeon on a pixel the spawns call gone among them');
  s.gone.delete('11,20');
  s.gone.add('12,20');
  list();
  assert.equal(s.asked.length, 2, 'a spawn in the set whose time ran out asks again');
  s.gone.clear(); s.at = { x: 11, y: 20 }; list();
  assert.equal(s.asked.length, 3, 'a new pixel');
  s.dg = 2; list();
  assert.equal(s.asked.length, 4, 'a find');
  d.gen(2); list();
  assert.equal(s.asked.length, 5, 'the index moved');
});

test('OW-DUNGEONS the host\'s load: its blocks laid as its pixel\'s build lays them, its entrance model held by its own place, dressed in its climate and the season - a climate-free model in its own pictures - and ready once its box is known; one that left the set while it loaded is never made ready (mutants: the pixel\'s hold; the climate unworn; the season unread; the colosseum swapped; a gone one made ready)', async () => {
  const src = lift(/\n {2}(function tvDungeonModelLoad\(g\) \{[\s\S]*?\n {2}\})\n/, 'tvDungeonModelLoad');
  const run = (over = {}) => {
    const s = { holds: [], remaps: [], released: [], laid: [] };
    const d = {
      _tvDngModel: new Map(), maps: { getClimateIndex: () => 2 }, blocks: {}, isEnhanced: () => true, tileSide: 6.4, season: 3,
      layoutLocation: (loc, maps, blocks, o) => { s.laid.push(o); return { blocks: [{ originX: 0, originZ: 0, layout: { models: [{ modelIdNum: 777, matrix: trs(5, 0, 5, 0, 0, 0) }] } }] }; },
      getLocationTerrainTileOrigin: () => ({ x: 10, y: 20 }),
      arch: { getRecordIndex: (id) => (id === 777 ? 3 : -1), getMesh: () => meshOf([[56, 0]]) },
      dungeonEntranceModel,
      pipeline: { holdPlace: (kind, key) => { const h = { kind, key, getGpuMesh: async (id) => ({ id, subMeshes: [{ textureArchive: 12 }] }), release: () => s.released.push(key) }; s.holds.push(h); return h; } },
      cpuModels: new Map([[777, { positions: new Float32Array([-2, 0, -2, 2, 6, 2]) }]]),
      isClimateFreeModel: () => false, NO_CLIMATE_REMAP: new Map([['own', true]]),
      remapSubMeshes: async (subs, table, archiveOf) => { s.remaps.push(archiveOf); table.set('k', 1); },
      applyClimate: (a, r, climate, season) => ({ a, r, climate, season }),
      getWorldClimateSettings: () => ({ climateType: 9 }),
      transformedAabb: (box, m) => [box[0] + m[12], box[1] + m[13], box[2] + m[14], box[3] + m[12], box[4] + m[13], box[5] + m[14]],
      archAabb: (id, pos) => [pos[0], pos[1], pos[2], pos[3], pos[4], pos[5]],
      ...over,
    };
    const load = new Function('d', `const { _tvDngModel, maps, blocks, isEnhanced, tileSide, season, layoutLocation, getLocationTerrainTileOrigin, arch, dungeonEntranceModel, pipeline, cpuModels, isClimateFreeModel, NO_CLIMATE_REMAP, remapSubMeshes, applyClimate, getWorldClimateSettings, transformedAabb, archAabb } = d;\n${src}\nreturn tvDungeonModelLoad;`)(d);
    return { s, d, load };
  };
  const settle = () => new Promise((r) => setImmediate(r));
  const { s, d, load } = run();
  load({ key: 'dng:5', px: 3, py: 4, loc: { climate: { climateType: 1 } } });
  for (let i = 0; i < 4; i++) await settle();
  const e = d._tvDngModel.get('dng:5');
  assert.equal(s.holds[0].kind, 'owdungeon', 'held by its own place');
  assert.equal(s.holds[0].key, 'dng:5');
  assert.deepEqual(s.laid[0], { enhanced: true, windmills: false }, 'laid as the build lays its blocks');
  assert.equal(e.ready, true);
  assert.deepEqual(e.box, [64 + 5 - 2, 0, 128 + 5 - 2, 64 + 5 + 2, 6, 128 + 5 + 2], 'its box under its matrix');
  assert.equal(e.h, 6, 'its height above the level');
  assert.deepEqual(s.remaps[0](504, 2), { a: 504, r: 2, climate: 1, season: 3 }, 'its own climate, and the season');
  // a spawn's climate from its pixel when its clone carries none
  const b = run();
  b.load({ key: 'spawn:1', px: 3, py: 4, loc: {} });
  for (let i = 0; i < 4; i++) await settle();
  assert.equal(b.s.remaps[0](1, 1).climate, 9);
  // the colosseum's law: its own pictures
  const c = run({ isClimateFreeModel: () => true });
  c.load({ key: 'dng:7', px: 0, py: 0, loc: {} });
  for (let i = 0; i < 4; i++) await settle();
  assert.equal(c.s.remaps.length, 0, 'never swapped');
  assert.equal(c.d._tvDngModel.get('dng:7').texRemap, c.d.NO_CLIMATE_REMAP);
  // gone while its model came: never dressed, never made ready
  const g = run();
  g.load({ key: 'dng:8', px: 0, py: 0, loc: {} });
  const was = g.d._tvDngModel.get('dng:8');
  g.d._tvDngModel.delete('dng:8');
  for (let i = 0; i < 4; i++) await settle();
  assert.equal(was.ready, false, 'never made ready');
  assert.equal(g.s.remaps.length, 0, 'nor dressed');
  // gone while it was dressed
  const h = run({ remapSubMeshes: async () => { h.d._tvDngModel.delete('dng:9'); } });
  h.load({ key: 'dng:9', px: 0, py: 0, loc: {} });
  const was9 = h.d._tvDngModel.get('dng:9');
  for (let i = 0; i < 4; i++) await settle();
  assert.equal(was9.ready, false, 'gone while dressed: never made ready');
});

test('OW-DUNGEONS the host\'s draw: under the view alone, the set kept in step (a new one loaded, one gone released), each drawn grown with the eye\'s distance about its foot - over a built pixel on the real model\'s own level and only once grown past it, past the grid on the far ring\'s ground - and none casting a giant\'s shadow (mutants: drawn in play; drawn with a shadow; the gone kept; the level the ground\'s over a built pixel; drawn twice at its own size)', () => {
  const src = lift(/\n {2}(const _tvDngAt = \[0, 0, 0\];\n {2}function drawTvDungeonModels\(eye, up\) \{[\s\S]*?\n {2}\})\n/, 'drawTvDungeonModels');
  const s = { list: [], loads: [], draws: [], released: [] };
  const map = new Map();
  const entry = (key, px, py) => ({ key, px, py, ready: true, gpu: { key }, local: trs(0, 0, 0, 0, 0, 0), box: [-2, 0, -2, 2, 8, 2], h: 8, texRemap: 'tex', matrix: new Float32Array(16), hold: { release: () => s.released.push(key) } });
  const d = {
    tvDungeonModelList: () => s.list, _tvDngModel: map, startDungeonLoads,
    tvDungeonModelLoad: (g) => { s.loads.push(g.key); map.set(g.key, entry(g.key, g.px, g.py)); },
    state: { pixelTranslation: (px, py) => [px * 1000, 7, py * 1000] },
    modelFoot, owDungeonGrow, owDungeonDrawn, grownModelMatrix,
    built: new Map([['1,1', { locOrigin: [0, 30, 0] }]]),
    tvGroundAt: () => { s.grounds = (s.grounds ?? 0) + 1; return 99; }, tvGroundGenNow: () => s.gen ?? 1,
    renderer: { drawMesh: (mesh, m, tex, o) => s.draws.push({ key: mesh.key, y: m[13], sy: m[5], tex, o }) },
  };
  const draw = new Function('d', `const { tvDungeonModelList, _tvDngModel, tvDungeonModelLoad, startDungeonLoads, state, modelFoot, owDungeonGrow, owDungeonDrawn, grownModelMatrix, built, tvGroundAt, tvGroundGenNow, renderer } = d;\n${src}\nreturn drawTvDungeonModels;`)(d);
  s.list = [{ key: 'dng:built', px: 1, py: 1 }, { key: 'dng:far', px: 9, py: 9 }];
  draw(null, true);
  assert.equal(s.loads.length, 0, 'no eye, no view: nothing');
  draw([1000, 480, 1000], false);
  assert.equal(s.loads.length, 0, 'TV-BURST: the view still rising - nothing loaded');
  draw([1000, 480, 1000], true);
  assert.deepEqual(s.loads, ['dng:built'], 'TV-BURST: up - one load a frame, the nearest first');
  s.draws.length = 0;
  draw([1000, 480, 1000], true);
  assert.deepEqual(s.loads, ['dng:built', 'dng:far'], 'each new one loaded');
  const byKey = Object.fromEntries(s.draws.map((x) => [x.key, x]));
  assert.ok(near(byKey['dng:built'].y, 7 + 30), 'over its built pixel: on the real model\'s own level');
  assert.ok(near(byKey['dng:far'].y, 99), 'past the grid: the far ring\'s ground');
  assert.ok(byKey['dng:built'].sy > 1, 'grown');
  for (const x of s.draws) { assert.deepEqual(x.o, { noShadow: true }, 'no giant\'s shadow'); assert.equal(x.tex, 'tex'); }
  // the far one's ground asked again only as the ground moves
  const asked = s.grounds;
  draw([1000, 480, 1000]); draw([1000, 480, 1000]);
  assert.equal(s.grounds, asked, 'the same ground: not asked again');
  s.gen = 2; draw([1000, 480, 1000]);
  assert.equal(s.grounds, asked + 1, 'the ground moved: asked again');
  // near the built one's ground: the world's own model, not drawn twice
  s.draws.length = 0;
  draw([1000, 40, 1000]);
  assert.ok(!s.draws.some((x) => x.key === 'dng:built'), 'at its own size over its pixel: left to the world');
  assert.ok(s.draws.some((x) => x.key === 'dng:far'));
  // one gone from the set
  s.list = [{ key: 'dng:far', px: 9, py: 9 }];
  draw([1000, 480, 1000]);
  assert.deepEqual(s.released, ['dng:built'], 'released');
  assert.ok(!map.has('dng:built'));
  assert.equal(s.loads.length, 2, 'the one still there not loaded again');
  // drawn from the exterior frame under the view alone, beside the grown wagon
  assert.match(WORLD, /hcc\.draw\(renderer, null, tvf \? \{ selfGrow: tvf\.grow, grow: peerGrow \} : undefined\);[^\n]*\n\s*if \(tvf\) drawTvDungeonModels\(travelView\?\.eye \?\? null, tvf\.fullyUp\);/);
  assert.match(WORLD, /pipeline\.keepPlaces\('owdungeon', TV_DUNGEON_MODELS_MAX\);/);
  assert.match(WORLD, /tvDngModels = \{ at: null, dg: -1, n: -1, list: \[\] \}; for \(const e of _tvDngModel\.values\(\)\) e\.hold\.release\(\); _tvDngModel\.clear\(\);   \/\/ OW-DUNGEONS: nor their models, once the view is cut/, 'a load forgets them');
});

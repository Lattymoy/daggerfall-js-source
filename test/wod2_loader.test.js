// WOD2 - WORLD OF DAGGERFALL: THE LOADER, THE FLATTEN AND WHAT STANDS.
//
// LocationLoader.cs is a loop whose ORDER is its law (the first valid
// instance naming a pixel takes it), a float smoothing arm, and an
// object loop through LocationHelper.LoadObject. These pins hold each
// against literals read off the C# (vendor/world-of-daggerfall/Scripts/),
// run the loader over the shipped packs, and pin the streaming host's
// wiring by source, as every host seam in this tree is pinned.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LocationSession, pickLocations, flattenForLocation, distanceFromRect, applyPicks, placeObjects,
  WOD_TERRAIN_SIZE_MULTI, WOD_TERRAIN_HEIGHT_MAX, WOD_OCEAN_REGIONS,
} from '../src/world/wodLocationLoader.js';
import {
  classifyObject, wodLightProperties, wodLightPosition, objectMatrix, objectNormalMatrix, WOD_SPAWN_TYPE, WOD_ENEMY_ID,
} from '../src/world/wodLocationObjects.js';
import { WodWorld, wodLightColors } from '../src/world/worldOfDaggerfall.js';
import { validateValue } from '../src/world/wodLocationData.js';
import { interiorLightProperties } from '../src/world/interiorLights.js';
import { basicRoadsPathsPoint } from '../src/world/roadsProducer.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { HEIGHTMAP_DIMENSION, generateSamples } from '../src/world/terrainSampler.js';
import { generateTileData } from '../src/world/terrainTiles.js';
import { StaticBatchBuilder } from '../src/render/staticBatch.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = join(ROOT, 'vendor/world-of-daggerfall');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const f32 = Math.fround;

/** The shipped files, off the disk, in the sources shape the browser's glob doors answer. */
const diskSources = (delays = {}) => ({
  regions: () => readdirSync(join(V, 'Locations')).map((f) => Number(f.replace('.bin', ''))).sort((a, b) => a - b),
  pack: async (r) => {
    if (delays[r]) await new Promise((res) => setTimeout(res, delays[r]));
    try { return new Uint8Array(readFileSync(join(V, 'Locations', `${r}.bin`))); } catch { return null; }
  },
  prefabs: async () => new Map(readdirSync(join(V, 'LocationPrefab')).map((f) => [f.replace('.txt', ''), readFileSync(join(V, 'LocationPrefab', f), 'utf8')])),
});

/** A session over literal instances (defaults: type 2, a valid spot). */
function sessionOf(list) {
  const s = new LocationSession();
  const cols = { count: list.length, name: [], prefab: [], type: [], worldX: [], worldY: [], terrainX: [], terrainY: [], locationID: [] };
  for (const l of list) {
    const i = { name: 'N', prefab: 'P', type: 2, worldX: 10, worldY: 20, terrainX: 40, terrainY: 50, locationID: 0, ...l };
    for (const k of Object.keys(cols)) if (k !== 'count') cols[k].push(i[k]);
  }
  s.appendRegion(0, cols);
  return s;
}
const TILE = { mapPixelX: 10, mapPixelY: 20, hasLocation: false, mapRegionIndex: -1, worldHeight: 50 };
const PREFABS = { P: { height: 2, width: 3, obj: [] }, Q: { height: 9, width: 7, obj: [] } };
const getPrefab = (n) => PREFABS[n] ?? null;
const picked = (tile, list, paths = null) => pickLocations(tile, sessionOf(list), getPrefab, paths).map((p) => p.index);

// ── the pick ────────────────────────────────────────────────────────

test('WOD2: the FIRST valid instance naming a pixel takes it - placing it sets hasLocation and every later type 2 skips (LocationLoader.cs:103-115)', () => {
  assert.deepEqual(picked(TILE, [{}, {}, {}]), [0]);
  // ...but an INVALID first one is passed over, and the next is tried.
  assert.deepEqual(picked(TILE, [{ terrainX: 0 }, { prefab: 'Missing' }, {}, {}]), [2]);
  // Another pixel's instance is no competition.
  assert.deepEqual(picked(TILE, [{ worldX: 11 }, {}]), [1]);
  // A type that is neither 0 nor 2 places WITHOUT smoothing and without
  // the flag, so the type-2 after it on the same pixel stands too.
  const s = sessionOf([{ type: 1 }, { type: 2 }, { type: 2 }]);
  const picks = pickLocations(TILE, s, getPrefab);
  assert.deepEqual(picks.map((p) => [p.index, p.flatten]), [[0, false], [1, true]]);
});

test('WOD2: a pixel that already holds a location - a type-0 instance ANYWHERE in the list ends the call; the sea arm is dead code (mapRegionIndex is -1 off a location)', () => {
  const loc = { ...TILE, hasLocation: true, mapRegionIndex: 17 };
  assert.deepEqual(picked(loc, [{}, { type: 2 }]), [], 'type 2 skips a location\'s pixel');
  assert.deepEqual(picked(loc, [{ type: 1 }]), [0], 'an "other" type falls through the flag');
  assert.deepEqual(picked(loc, [{ type: 0, worldX: 999 }, { type: 1 }]), [], 'a type 0 on ANOTHER pixel returns first');
  // The sea: regions 31/3/29/28/30 with a WOODS height of 2 or less...
  assert.deepEqual([...WOD_OCEAN_REGIONS], [31, 3, 29, 28, 30]);
  const sea = { ...TILE, mapRegionIndex: 29, worldHeight: 2 };
  assert.deepEqual(picked(sea, [{}]), [], 'the arm, when it can fire');
  assert.deepEqual(picked({ ...sea, worldHeight: 3 }, [{}]), [0]);
  // ...but GetMapPixelData fills mapRegionIndex from the LOCATION, -1
  // without one, so on the pixels the loader can use the arm never fires.
  assert.deepEqual(picked({ ...TILE, mapRegionIndex: -1, worldHeight: 0 }, [{}]), [0], 'a low wilderness pixel still takes its rocks');
});

test('WOD2: the bounds - terrainX/Y in 1..128, then the prefab against 128 and 127 with HEIGHT on x and WIDTH on y', () => {
  assert.deepEqual(picked(TILE, [{ terrainX: 0 }]), []);
  assert.deepEqual(picked(TILE, [{ terrainY: -1 }]), []);
  assert.deepEqual(picked(TILE, [{ terrainX: 129 }]), []);
  // Q is 9 high and 7 wide: x may reach 127 - 9, y 127 - 7.
  assert.deepEqual(picked(TILE, [{ prefab: 'Q', terrainX: 118, terrainY: 120 }]), [0]);
  assert.deepEqual(picked(TILE, [{ prefab: 'Q', terrainX: 119, terrainY: 120 }]), []);
  assert.deepEqual(picked(TILE, [{ prefab: 'Q', terrainX: 118, terrainY: 121 }]), []);
  // The rect it builds is (x, y, WIDTH, HEIGHT) - the transpose.
  const [p] = pickLocations(TILE, sessionOf([{ prefab: 'Q', terrainX: 5, terrainY: 6 }]), getPrefab);
  assert.deepEqual(p.rect, { x: 5, y: 6, width: 7, height: 9 });
});

test('WOD2: Basic Roads - a road or a track on the pixel keeps every instance off it; no mod, no question', () => {
  assert.deepEqual(picked(TILE, [{}], () => 16), []);
  assert.deepEqual(picked(TILE, [{}], () => 0), [0]);
  assert.deepEqual(picked(TILE, [{}], null), [0]);
  // getPathsPoint is the road mask OR the track mask - rivers and streams are not asked.
  const net = { roads: new Uint8Array(500000), tracks: new Uint8Array(500000), rivers: new Uint8Array(500000).fill(8) };
  net.roads[20 * 1000 + 10] = 0x80; net.tracks[20 * 1000 + 10] = 0x01;
  assert.equal(basicRoadsPathsPoint(net, 10, 20), 0x81);
  assert.equal(basicRoadsPathsPoint(net, 20, 10), 0, 'x + y * 1000, not the transpose');
  assert.equal(basicRoadsPathsPoint(net, 11, 20), 0, 'a river is no road');
});

// ── the flatten ─────────────────────────────────────────────────────

function ramp() {
  const s = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
  for (let x = 0; x < 129; x++) for (let y = 0; y < 129; y++) s[x * 129 + y] = f32(0.1 + x * 0.001 + y * 0.0003);
  return s;
}

test('WOD2: the flatten - the mean over the rect with BOTH bounds inclusive, then every interior sample lerped by 1/(distance+1), in C# floats', () => {
  const s = ramp();
  const before = s.slice();
  const rect = { x: 10, y: 20, width: 2, height: 3 };
  // The mean: (2+1) x (3+1) = 12 samples, float-accumulated.
  let tmp = 0, count = 0;
  for (let x = 10; x <= 12; x++) for (let y = 20; y <= 23; y++) { tmp = f32(tmp + before[x * 129 + y]); count++; }
  assert.equal(count, 12);
  const want = f32(tmp / count);
  const avg = flattenForLocation(s, rect);
  assert.equal(avg, want);
  // Inside the rect (bounds inclusive): exactly the mean.
  for (let x = 10; x <= 12; x++) for (let y = 20; y <= 23; y++) assert.equal(s[x * 129 + y], avg, `${x},${y}`);
  // One sample east of xMax (12): t = 1/2.
  const a = before[13 * 129 + 21];
  assert.equal(s[13 * 129 + 21], f32(a + f32(f32(avg - a) * 0.5)));
  // Diagonally off the corner (13, 24): distance sqrt(2).
  const d = distanceFromRect(rect, 13, 24);
  assert.equal(d, f32(Math.SQRT2));
  const b = before[13 * 129 + 24];
  assert.equal(s[13 * 129 + 24], f32(b + f32(f32(avg - b) * f32(1 / f32(d + 1)))));
  // The border rows and columns (0 and 128) are never written.
  for (let i = 0; i < 129; i++) {
    for (const [x, y] of [[0, i], [128, i], [i, 0], [i, 128]]) assert.equal(s[x * 129 + y], before[x * 129 + y], `border ${x},${y}`);
  }
  // Far away the pull is small but never zero - 1/(d+1) has no cutoff.
  assert.notEqual(s[120 * 129 + 120], before[120 * 129 + 120]);
});

test('WOD2: GetDistanceFromRect - squared x and y overshoots, square-rooted; zero inside and on the edges', () => {
  const r = { x: 10, y: 20, width: 2, height: 3 };
  assert.deepEqual([[10, 20], [12, 23], [11, 21]].map(([x, y]) => distanceFromRect(r, x, y)), [0, 0, 0]);
  assert.equal(distanceFromRect(r, 15, 21), 3);
  assert.equal(distanceFromRect(r, 11, 16), 4);
  assert.equal(distanceFromRect(r, 15, 27), 5);
});

test('WOD2: applyPicks - each pick stands on its own mean, an unsmoothed one on whatever the tile held; locationRect is the last site', () => {
  const s = ramp();
  const r1 = { x: 10, y: 20, width: 2, height: 3 };
  const got = applyPicks(s, [{ flatten: false, rect: r1 }, { flatten: true, rect: r1 }, { flatten: false, rect: r1 }], 0.25);
  assert.equal(got.averages[0], 0.25, 'before any smoothing: the tile\'s own (DFU: 0 off a location)');
  assert.equal(got.averages[1], got.averages[2]);
  assert.notEqual(got.averages[1], 0.25);
  assert.deepEqual(got.locationRect, { xMin: 10, xMax: 12, yMin: 20, yMax: 23 });
  assert.equal(applyPicks(ramp(), [{ flatten: false, rect: r1 }], 0).locationRect, null);
});

test('WOD2: the object loop - (terrainX * 6.4 + x, average * 1923.75 + y, terrainY * 6.4 + z), invalid objects skipped', () => {
  assert.equal(WOD_TERRAIN_SIZE_MULTI, f32(6.4));
  assert.equal(WOD_TERRAIN_HEIGHT_MAX, 1923.75, 'MaxTerrainHeight * StreamingWorld.TerrainScale - 1539 * 1.25, the game scene\'s (TERRAIN-SCALE1), the author\'s own commented constant');
  const pick = {
    rect: { x: 2, y: 12, width: 3, height: 3 },
    prefab: { obj: [
      { type: 0, name: '41130', pos: { x: f32(3.29), y: f32(0.598), z: f32(10.41) } },
      { type: 0, name: 'x', pos: { x: 0, y: 0, z: 0 } },
      { type: 1, name: '210.1', pos: { x: 1, y: 2, z: 3 } },
    ] },
  };
  const out = placeObjects(pick, 0.1, validateValue);
  assert.equal(out.length, 2, 'ValidateValue drops the bad name');
  const bx = f32(2 * f32(6.4)), by = f32(0.1 * 1923.75), bz = f32(12 * f32(6.4));
  assert.deepEqual(out[0].pos, [f32(bx + f32(3.29)), f32(by + f32(0.598)), f32(bz + f32(10.41))]);
  assert.deepEqual(out[1].pos, [f32(bx + 1), f32(by + 2), f32(bz + 3)]);
});

// ── LoadObject ──────────────────────────────────────────────────────

test('WOD2: LoadObject by archive STRING - the markers are invisible spawners, the container is loot, 210 lights, 201 calls, 199 hides', () => {
  const c = (name) => classifyObject({ type: 1, name });
  const sp = (x) => x.spawners.map((s) => [s.spawnType, s.enemyID, s.questID]);
  assert.deepEqual(sp(c('479.0')), [[WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bandits, 0]]);
  assert.deepEqual(sp(c('483.0')), [[WOD_SPAWN_TYPE.Good, WOD_ENEMY_ID.Bandits, 0]]);
  assert.deepEqual(sp(c('457.16')), [[WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bears, 0]]);
  assert.deepEqual(sp(c('478.1')), [[WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Warriors, 0]]);
  assert.deepEqual(sp(c('357.6')), [[WOD_SPAWN_TYPE.Quest, 0, 0]]);
  assert.deepEqual(sp(c('216.33')), [[WOD_SPAWN_TYPE.Loot, 0, 0]], 'one spawner: the second AddLootSpawn never runs');
  assert.deepEqual([WOD_SPAWN_TYPE.Quest, WOD_SPAWN_TYPE.Enemy, WOD_SPAWN_TYPE.Loot, WOD_SPAWN_TYPE.Good], [0, 2, 3, 4]);
  for (const n of ['479.0', '483.0', '457.16', '478.1', '357.6', '216.33', '199.10']) assert.equal(c(n).visible, false, `${n} is not drawn`);
  assert.equal(c('216.33').treasure, true);
  assert.equal(c('357.5').visible, true, 'only 357.6 is the kidnap marker');
  assert.deepEqual(sp(c('357.5')), []);
  assert.deepEqual([c('210.1').light, c('210.1').visible], [true, true]);
  assert.deepEqual([c('201.00').animal, c('201.00').record], [true, 0]);
  assert.equal(c('0201.0').animal, false, 'the C# compares the archive STRING');
  assert.deepEqual(c('097.2'), { kind: 'flat', archive: 97, record: 2, visible: true, light: false, animal: false, treasure: false, spawners: [] });
  assert.deepEqual(classifyObject({ type: 0, name: '41130' }), { kind: 'model', modelId: 41130 });
  assert.deepEqual(classifyObject({ type: 0, name: '-5' }), { kind: 'model', modelId: null }, 'uint.Parse throws on a negative');
});

test('WOD2: AddLight is DaggerfallInterior\'s but for two arms - record 0 and a default - and one lift (record 29)', () => {
  const orange = [255 / 255, 147 / 255, 41 / 255];
  assert.deepEqual({ ...wodLightProperties(0), color: [...wodLightProperties(0).color] }, { range: 15, intensity: 1.2, color: orange });
  assert.notDeepEqual(wodLightProperties(0), interiorLightProperties(0), 'the mod\'s Bowl of Fire is not DFU\'s');
  for (let r = 1; r <= 29; r++) {
    const a = wodLightProperties(r), b = interiorLightProperties(r);
    assert.deepEqual([a.range, a.intensity, [...a.color]], [b.range, b.intensity, [...b.color]], `record ${r} is DFU's`);
  }
  for (const r of [30, 47, -1]) assert.deepEqual([...wodLightProperties(r).color], orange, `record ${r} takes the default arm`);
  assert.equal(wodLightProperties(30).intensity, 1.2);
  // The lift: the sprite's centre plus the first switch's arm, both scaled by the flat.
  const size = { w: 0.5, h: 2 };
  assert.deepEqual(wodLightPosition([1, 10, 3], 1, size), [1, 11, 3], 'a campfire: the centre');
  assert.deepEqual(wodLightPosition([1, 10, 3], 0, size), [1, 10 + 1 - 0.1, 3]);
  assert.deepEqual(wodLightPosition([1, 10, 3], 29, size), [1, 12, 3], 'the mod lifts Street Lantern 2 by half its height');
  assert.deepEqual(wodLightPosition([1, 10, 3], 21, size), [1, 10 + 1 + 2 / 2.4, 3]);
  assert.deepEqual(wodLightPosition([0, 0, 0], 0, size, 2), [0, (1 - 0.1) * 2, 0], 'a doubled bowl lifts twice as far');
});

test('WOD2: the transform - T * R(q) * S in Unity\'s frame, and the normals through R * S^-1 when the scale is uneven', () => {
  const m = objectMatrix([1, 2, 3], { x: 0, y: 0, z: 0, w: 1 }, { x: 2, y: 3, z: 4 });
  assert.deepEqual([...m], [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 1, 2, 3, 1]);
  // 90 degrees about Y (Unity): +X goes to -Z.
  const q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  const r = objectMatrix([0, 0, 0], q, { x: 1, y: 1, z: 1 });
  assert.ok(Math.abs(r[0]) < 1e-6 && Math.abs(r[2] + 1) < 1e-6, 'x axis -> -z');
  // An unnormalized quaternion is normalized, as Unity does: (0, 1, 0, 1)
  // is the same quarter turn as (0, .707, 0, .707), not a reflection.
  assert.deepEqual([...objectMatrix([0, 0, 0], { x: 0, y: 1, z: 0, w: 1 }, { x: 1, y: 1, z: 1 })].map((v) => +v.toFixed(5)),
    [...objectMatrix([0, 0, 0], q, { x: 1, y: 1, z: 1 })].map((v) => +v.toFixed(5)));
  assert.equal(objectNormalMatrix(q, { x: 2, y: 2, z: 2 }), null, 'uniform: the object\'s own matrix is exact');
  // Uneven: a normal stays perpendicular to the surface it belongs to.
  const s = { x: 3, y: 1, z: 1 };
  const M = objectMatrix([0, 0, 0], { x: 0, y: 0, z: 0, w: 1 }, s);
  const N = objectNormalMatrix({ x: 0, y: 0, z: 0, w: 1 }, s);
  const apply = (A, v) => [A[0] * v[0] + A[4] * v[1] + A[8] * v[2], A[1] * v[0] + A[5] * v[1] + A[9] * v[2], A[2] * v[0] + A[6] * v[1] + A[10] * v[2]];
  const tangent = apply(M, [1, -1, 0]);   // an edge of the 45-degree face x + y = c
  const normal = apply(N, [1, 1, 0]);
  assert.ok(Math.abs(tangent[0] * normal[0] + tangent[1] * normal[1] + tangent[2] * normal[2]) < 1e-6);
  const wrong = apply(M, [1, 1, 0]);
  assert.ok(Math.abs(tangent[0] * wrong[0] + tangent[1] * wrong[1] + tangent[2] * wrong[2]) > 1, 'the object matrix would have skewed it');
  // ...and the static batch takes it.
  const cpu = { positions: new Float32Array([0, 0, 0]), normals: new Float32Array([Math.SQRT1_2, Math.SQRT1_2, 0]), uvs: new Float32Array(2), indices: new Uint32Array([0, 0, 0]), subMeshes: [{ startIndex: 0, primitiveCount: 1, textureArchive: 0, textureRecord: 0 }] };
  const b = new StaticBatchBuilder();
  b.add(cpu, M, () => 'k', N);
  const n = b.chunks[0].normals;
  assert.ok(Math.abs(n[0] - 1 / Math.hypot(1, 3)) < 1e-6 && Math.abs(n[1] - 3 / Math.hypot(1, 3)) < 1e-6, 'the batch lit the face through the inverse transpose');
});

test('WOD2: the composed light colours - the player\'s lights the shared colour, the selection its own', () => {
  const shared = new Float32Array([0.9, 0.8, 0.7]);
  const sel = new Float32Array([1, 0, 0, 0, 1, 0]);
  assert.deepEqual([...wodLightColors(4, 2, sel, shared)].map((v) => +v.toFixed(3)), [0.9, 0.8, 0.7, 0.9, 0.8, 0.7, 1, 0, 0, 0, 1, 0]);
  assert.deepEqual([...wodLightColors(2, 0, sel, shared)], [...sel]);
});

// ── the loader over the shipped packs ───────────────────────────────

test('WOD2: Awake reads region 17 first, then each region as it is entered, in EVENT order however the fetches land', async () => {
  const w = new WodWorld(diskSources({ 0: 30 }), { warn: () => {} });
  await w.open();
  assert.deepEqual(w.session.regions, [17]);
  w.noteRegion(0);    // slow to land
  w.noteRegion(20);   // lands first
  await w.settle();
  assert.deepEqual(w.session.regions, [17, 0, 20], 'appended in the order announced');
  w.noteRegion(31);
  w.noteRegion(2);    // no folder: DFU throws here every frame; the port loads nothing
  w.noteRegion(0);    // revisited
  await w.settle();
  assert.deepEqual(w.session.regions, [17, 0, 20]);
  assert.equal(w.prefabs.size, 65);
});

test('WOD2: a contested pixel goes to the first instance in load order - the bandit camp over three rock fields', async () => {
  const w = new WodWorld(diskSources(), { warn: () => {} });
  await w.open();
  w.noteRegion(0);
  await w.settle();
  const tile = { mapPixelX: 625, mapPixelY: 418, hasLocation: false, mapRegionIndex: -1, worldHeight: 50 };
  const [pick] = w.picksFor(tile);
  assert.equal(w.session.prefab[pick.index], 'WOD_BanditCamp_06');
  assert.deepEqual(pick.rect, { x: 2, y: 12, width: 3, height: 3 });
  // Its objects: nine models, the campfire and its light, two horses
  // calling, the remains, two treasure spawners and four warriors'.
  const place = w.placements([pick], [0.1]);
  assert.equal(place.models.length, 9);
  assert.deepEqual(place.flats.map((f) => `${f.archive}.${f.record}`), ['210.1', '201.0', '201.1', '100.0', '100.1', '100.1', '100.13']);
  assert.deepEqual(place.lights.map((f) => f.record), [1]);
  assert.deepEqual(place.animals.map((f) => f.record), [0, 1]);
  assert.deepEqual(place.spawners.map((s) => `${s.archive}.${s.record}:${s.spawnType}/${s.enemyID}`),
    ['216.33:3/0', '216.40:3/0', '478.1:2/3', '478.1:2/3', '478.1:2/3', '478.1:2/3']);
  // A location's own pixel is never touched.
  assert.deepEqual(w.picksFor({ ...tile, hasLocation: true, mapRegionIndex: 0 }), []);
});

test('WOD2: online the list is the room\'s - every folder, 17 first, then ascending - so every player stands the same ground', async () => {
  const w = new WodWorld(diskSources({ 5: 20 }), { online: true, warn: () => {} });
  await w.open();
  const all = readdirSync(join(V, 'Locations')).map((f) => Number(f.replace('.bin', ''))).sort((a, b) => a - b);
  assert.deepEqual(w.session.regions, [17, ...all.filter((r) => r !== 17)]);
  assert.equal(w.session.count, 227938);
  w.noteRegion(0);
  await w.settle();
  assert.equal(w.session.regions.length, 44, 'nothing more to announce');
});

// ── the kernel seam ─────────────────────────────────────────────────

const fakeWoods = {
  getHeightMapValuesRange1Dim(mx, my, d) {
    const a = new Float32Array(d * d);
    for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1);
    return a;
  },
  getLargeHeightMapValuesRange(mx, my, span) {
    const d = span * 3;
    const a = new Float32Array(d * d);
    for (let x = 0; x < d; x++) for (let y = 0; y < d; y++) a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3);
    return a;
  },
  getHeightMapValue(px, py) { return (px * 7 + py * 3) % 200; },
};

test('WOD2: the kernel flattens AFTER the tiles and BEFORE the grid and the nature - tiles unchanged, trees kept off the site', () => {
  const job = { px: 300, py: 200, climateType: 1 };
  const plain = generatePixelTerrain({ woods: fakeWoods, ...job, tilemap: new Uint8Array(128 * 128) });
  const rect = { x: 40, y: 50, width: 8, height: 8 };
  const wod = generatePixelTerrain({ woods: fakeWoods, ...job, tilemap: new Uint8Array(128 * 128), wod: { picks: [{ flatten: true, rect }] } });
  assert.deepEqual([...wod.tilemapBytes], [...plain.tilemapBytes], 'the ground\'s tiles are the unflattened slope\'s');
  assert.equal(plain.wodAverages, null);
  assert.equal(wod.wodAverages.length, 1);
  const avg = wod.wodAverages[0];
  assert.equal(wod.samples[44 * 129 + 54], avg, 'the site is level');
  assert.notEqual(plain.samples[44 * 129 + 54], avg);
  assert.equal(wod.samples[0], plain.samples[0], 'the border is untouched');
  // The grid is built from the levelled samples.
  assert.notDeepEqual([...wod.positions], [...plain.positions]);
  // natureClearance 4 around the site: no tree inside [36, 52) x [46, 62).
  const inside = (f) => f.x / 6.4 >= 36 && f.x / 6.4 < 52 && f.z / 6.4 >= 46 && f.z / 6.4 < 62;
  assert.ok(plain.nature.some(inside), 'the fixture grows trees there without the site');
  assert.ok(!wod.nature.some(inside), 'and none with it');
});

test('WOD2: the tiles are the UNflattened ground\'s - on a shore, flattening first would move the beach line, and the kernel does not', () => {
  // Low ground astride the beach elevation, so the tile classifier's
  // water / dirt / grass thresholds see a flatten if it runs first.
  const lowWoods = {
    getHeightMapValuesRange1Dim(mx, my, d) {
      const a = new Float32Array(d * d);
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) a[r + c * d] = 4.6 + 0.9 * Math.sin((mx + r) * 1.3) * Math.cos((my + c) * 0.9);
      return a;
    },
    getLargeHeightMapValuesRange(mx, my, span) { return new Float32Array(span * 3 * span * 3); },
    getHeightMapValue() { return 30; },
  };
  const job = { px: 300, py: 200, climateType: 1 };
  const rect = { x: 40, y: 50, width: 8, height: 8 };
  const plain = generatePixelTerrain({ woods: lowWoods, ...job, tilemap: new Uint8Array(128 * 128) });
  const wod = generatePixelTerrain({ woods: lowWoods, ...job, tilemap: new Uint8Array(128 * 128), wod: { picks: [{ flatten: true, rect }] } });
  assert.deepEqual([...wod.tilemapBytes], [...plain.tilemapBytes]);
  // ...and the fixture has teeth: the same flatten BEFORE the classifier moves tiles.
  const early = generateSamples(lowWoods, job.px, job.py);
  flattenForLocation(early, rect);
  const before = generateTileData(generateSamples(lowWoods, job.px, job.py), job.px, job.py);
  const moved = generateTileData(early, job.px, job.py);
  assert.ok(moved.some((t, i) => t !== before[i]), 'a flatten before the tiles would have moved the shore');
});

// ── the host ────────────────────────────────────────────────────────

test('WOD2: the streaming host wires the loader where DFU does - decision before the kernel, objects after, pixel-local, lights at every hour', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const wod = wodOn\(\) \? openWodWorld\(\{ online: params\.has\('online'\) \}\) : null;/);
  assert.match(w, /wod\.noteRegion\(maps\.getRegionIndexAt\(here\.x, here\.y\)\);\s*await wod\.settle\(\);/);
  assert.match(w, /mapRegionIndex: dfLocation \? dfLocation\.regionIndex : -1,/, 'GetMapPixelData\'s -1 off a location');
  assert.match(w, /worldHeight: woods\.getHeightMapValue\(px, py\),/);
  assert.match(w, /wod: wodPicks \? \{ picks: wodPicks\.map\(\(p\) => \(\{ flatten: p\.flatten, rect: p\.rect \}\)\) \} : null,/);
  assert.match(w, /return net\?\.source === 'basic-roads' \? basicRoadsPathsPoint\(net, x, y\) : 0;/, 'only his mod answers getPathsPoint');
  // The object block: a collider per model, no climate remap, no doors.
  const block = w.slice(w.indexOf('const place = wod.placements(wodPicks, wodAverages);'), w.indexOf('// EV7: the nature layout arrived'));
  assert.match(block, /collider\.addMesh\(key, cpu\.positions, cpu\.indices, m\.matrix, wodBucket\);/);
  assert.match(block, /staticBuilder\.add\(cpu, m\.matrix, resolveTexKey, m\.normalMatrix\);/);
  assert.doesNotMatch(block, /remapSubMeshes|getStaticDoors|buildingDoors/, 'no climate swap and no doors off the terrain');
  assert.match(block, /pixelAnimals\.push/);
  assert.match(w, /wodLights: pixelWodLights,/);
  // Lit at every hour: the day branch takes them too.
  assert.match(w, /const wodSel = wodLit \? _wodSelect\(0, _wodFill\(0\)\) : null;/, 'the day branch');
  assert.match(w, /const wodSel = wodLit \? _wodSelect\(n, _wodFill\(n\)\) : null;/, 'the night branch, after the lanterns');
  assert.match(w, /if \(p\.wodSite && tx >= p\.wodSite\.xMin && tx < p\.wodSite\.xMax && tz >= p\.wodSite\.yMin && tz < p\.wodSite\.yMax\) return null;/, 'grass keeps off the site');
  assert.match(w, /_wodSiteWas\.delete\(key\);[^\n]*\n    if \(labGrassField\) \{/, 'and re-reads the ground a site moved - or a rebuild moved back (AUDIT BRANCH (WoD) m2) - as every publish does since PERF-EXT-C2');
});

test('WOD2: THE FOUR HOSTS - world.js streams terrain and is wired; exterior.js, worldModes.js and dungeonContext.js stream none and are flagged', () => {
  for (const f of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(f), /openWodWorld|wodLocationLoader/, `${f} has no terrain to stand a wilderness site on`);
  }
  assert.match(rd('bible/03-World/World-Of-Daggerfall.md'), /THE FOUR HOSTS/);
  assert.match(rd('src/world/terrainGenWorker.js'), /generatePixelTerrain\(\{ \.\.\.m, woods, roads \}\)/, 'the job crosses whole, so `wod` reaches the worker');
});

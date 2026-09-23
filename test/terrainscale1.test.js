// TERRAIN-SCALE1 + BUILD-FAIL1 (2026-09-23, Mac: "Make the best decisions and take care of the found properly") -
// two of the three things World of Daggerfall's AUDIT BRANCH found and left open, taken care of.
//
// TERRAIN-SCALE1: DaggerfallUnityGame.unity overrides the StreamingWorld prefab's TerrainScale to 1.25, and nothing
// writes it at run time, so every terrain DFU streams is MaxTerrainHeight * 1.25 tall. The port read the prefab's
// 1.5: every hill a fifth taller than DFU's. Every height consumer now reads the scene's value; every exterior height
// a save, a scene cache or an anchor carries is stamped with it, and one written before the stamp is stood again on
// today's ground as it lands. The interior cache moves to the building's own frame on the way (DFU restores an
// interior container by its localPosition), which also ends a house's floor drifting 819.2 off after a walk.
//
// BUILD-FAIL1: a pixel build that throws freed nothing it had made - its collider bucket stood on (invisible walls,
// and a rebuild appended every triangle twice), its GPU surfaces and batches leaked, its doors stayed E-targets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STREAMING_TERRAIN_SCALE, DEFAULT_TERRAIN_SCALE, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, SCALED_OCEAN_ELEVATION } from '../src/world/terrainSampler.js';
import { surfaceHeightAt, buildTerrainGrid } from '../src/world/terrainSurface.js';
import { layoutNature } from '../src/world/terrainNature.js';
import { ringHeight } from '../src/render/farRing.js';
import { overworldHeight, OVERWORLD_RELIEF } from '../src/ui/overworldModel.js';
import { WOD_TERRAIN_HEIGHT_MAX } from '../src/world/wodLocationLoader.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';
import { makeAnchor } from '../src/systems/teleportAnchor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const WORLD = rd('src/scenes/world.js');
const MODES = rd('src/scenes/worldModes.js');
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('TERRAIN-SCALE1: the game streams at the scene\'s 1.25 - TerrainHelper\'s 1.5 is the prefab\'s default, and the scene overrides it', () => {
  assert.equal(STREAMING_TERRAIN_SCALE, 1.25, 'DaggerfallUnityGame.unity: propertyPath TerrainScale, value 1.25 on the one StreamingWorld');
  assert.equal(DEFAULT_TERRAIN_SCALE, 1.5, 'TerrainHelper.defaultTerrainScale = 1.5f - still DFU\'s constant, and the scale of every save written before the stamp');
  const src = rd('src/world/terrainSampler.js');
  assert.match(src, /DaggerfallUnityGame\.unity overrides the\n \*  StreamingWorld prefab instance's TerrainScale to 1\.25/, 'the citation rides the value');
  assert.equal(WOD_TERRAIN_HEIGHT_MAX, 1923.75, 'World of Daggerfall reads StreamingWorld.TerrainScale at run time - its author\'s commented 1539 * 1.25');
});

test('TERRAIN-SCALE1: every height the streamed world draws, collides with or stands things on reads it', () => {
  const s = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.2);
  const want = 0.2 * MAX_TERRAIN_HEIGHT * 1.25;
  near(surfaceHeightAt(s, 100, 100), want);   // what is PLACED
  near(buildTerrainGrid(s).positions[1], want);   // what is DRAWN and walked (the collider's heightAt reads the same samples by the same worldHeight)
  const grass = new Uint8Array(128 * 128).fill(2);
  near(layoutNature(s, grass, { mapPixelX: 10, mapPixelY: 10, rawWorldHeight: 128, climateType: 99, locationRect: null })[0].y, want);   // LayoutNature's terrainScale
  assert.equal(ringHeight(0), SCALED_OCEAN_ELEVATION * 1.25, 'the far ring');
  near(overworldHeight(100), (100 * 8 * 1.25 / 819.2) * OVERWORLD_RELIEF, 1e-9);
  assert.match(WORLD, /const worldHeight = MAX_TERRAIN_HEIGHT \* STREAMING_TERRAIN_SCALE;/, 'the host\'s own worldHeight: locations, centreHeight, heightAt');
  assert.match(WORLD, /const sea = SCALED_OCEAN_ELEVATION \* STREAMING_TERRAIN_SCALE \+ 0\.5;\n      const scale = MAX_TERRAIN_HEIGHT \* STREAMING_TERRAIN_SCALE;/, 'the grass\'s sea and its ground');
  // DEFAULT_TERRAIN_SCALE survives in src only as the legacy saves' scale
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js']) {
    for (const line of rd(f).split('\n').filter((l) => l.includes('DEFAULT_TERRAIN_SCALE') && !l.startsWith('import'))) {
      assert.match(line, /stamp|was|before/, `${f}: ${line.trim().slice(0, 100)}`);
    }
  }
});

test('TERRAIN-SCALE1: a save carries the scale its heights stood on; one without the stamp reads as written before it', () => {
  const snap = JSON.parse(JSON.stringify(snapshotPlayer({ items: [], stats: {} }, {})));
  assert.equal(snap.terrainScale, 1.25);
  const extras = restorePlayer({ items: [], stats: {} }, snap);
  assert.equal(extras.terrainScale, 1.25);
  const old = { ...snap };
  delete old.terrainScale;
  assert.equal(restorePlayer({ items: [], stats: {} }, old).terrainScale, null, 'a save from before the stamp: null, the prefab\'s 1.5 to the host');
  assert.equal(makeAnchor({ pixel: { x: 1, y: 2 }, nativeX: 0, nativeZ: 0, y: 5, terrainScale: 1.25 }).terrainScale, 1.25, 'an anchor carries it');
  assert.equal(makeAnchor({ pixel: { x: 1, y: 2 }, nativeX: 0, nativeZ: 0, y: 5 }).terrainScale, null);
});

/** world.js's own restandHeight and scaleOf, run against a stub ground. */
function restander(ground, comp = 0) {
  const i = WORLD.indexOf('  const restandHeight = (y, x, z, was) => {');
  const j = WORLD.indexOf('  // Building doors (P3)', i);
  assert.ok(i > 0 && j > i, 'the helper stands where the rig reads it');
  const state = { compensation: [0, comp, 0] };
  const heightAt = (x, z) => (ground(x, z) == null ? -Infinity : ground(x, z) + comp);
  return new Function('heightAt', 'state', 'STREAMING_TERRAIN_SCALE', 'DEFAULT_TERRAIN_SCALE', `${WORLD.slice(i, j)}\nreturn { restandHeight, scaleOf };`)(heightAt, state, STREAMING_TERRAIN_SCALE, DEFAULT_TERRAIN_SCALE);
}

test('TERRAIN-SCALE1: a height written on the old scale stands again on today\'s ground - the same height above it where the ground is built, the ratio where it is not', () => {
  const sample = 0.3;
  const hOld = sample * MAX_TERRAIN_HEIGHT * 1.5, hNew = sample * MAX_TERRAIN_HEIGHT * 1.25;
  const { restandHeight, scaleOf } = restander((x) => (x < 1000 ? hNew : null), 37);
  near(restandHeight(hOld, 10, 10, 1.5), hNew, 1e-6);   // on the ground
  near(restandHeight(hOld + 6.5, 10, 10, 1.5), hNew + 6.5, 1e-6);   // on a roof, up a stair: the same 6.5 above
  near(restandHeight(hOld + 6.5, 5000, 10, 1.5), (hOld + 6.5) * (1.25 / 1.5), 1e-6);   // unbuilt: the ratio, exact on the ground
  assert.equal(restandHeight(123.4, 10, 10, 1.25), 123.4, 'written on today\'s scale: untouched');
  assert.equal(scaleOf(undefined), 1.5, 'no stamp: the prefab\'s');
  assert.equal(scaleOf(null), 1.5);
  assert.equal(scaleOf(1.25), 1.25);
});

test('TERRAIN-SCALE1: the host stands every saved exterior height again as it lands it - the player, the piles, torches, camps, foes, guards, the inside pools, the exterior scene cache, the anchor', () => {
  assert.match(WORLD, /const was = scaleOf\(extras\.terrainScale\);/);
  assert.match(WORLD, /const ly = restandHeight\(w\.y \?\? 2, lx, lz, was\) \+ state\.compensation\[1\];/, 'the player, after the arrival pixel is built');
  assert.match(WORLD, /extras\.interior\.foes = restandRows\(extras\.interior\.foes\); extras\.interior\.guards = restandRows\(extras\.interior\.guards\);/);
  assert.match(WORLD, /droppedLoot\.restoreWorld\(restandRows\(w\.piles\)/);
  assert.match(WORLD, /droppedTorches\.restore\(restandAt\('position'\)\(w\.droppedTorches\)/);
  assert.match(WORLD, /camps\.restore\(restandAt\('pos'\)\(w\.camps\)/);
  assert.match(WORLD, /exteriorFoes\.restoreWorld\(restandRows\(w\.foes\)/);
  assert.match(WORLD, /cityGuards\.restoreWorld\(restandRows\(w\.guards\)/);
  assert.match(WORLD, /terrainScale: STREAMING_TERRAIN_SCALE,   \/\/ TERRAIN-SCALE1: the ground these heights stand on/, 'the exterior scene cache is stamped...');
  assert.match(WORLD, /const was = scaleOf\(arrived\.terrainScale\);/, '...and read');
  assert.match(WORLD, /terrainScale: STREAMING_TERRAIN_SCALE,   \/\/ TERRAIN-SCALE1: the ground that height stands on/, 'the anchor is stamped...');
  assert.match(WORLD, /return \[lx, restandHeight\(a\.y \?\? 2, lx, lz, scaleOf\(a\.terrainScale\)\) \+ state\.compensation\[1\], lz\];/, '...and stood again at the recall');
  // audit: the ship's remembered deck - stamped at boarding, stood again after the teleport built its pixel (the
  // teleport stands a deck verbatim, never grounded)
  assert.match(WORLD, /position: \{ mapPixel: here, pos: \[\.\.\.player\.pos\], yaw: cam\.yaw, terrainScale: STREAMING_TERRAIN_SCALE \},/);
  const ship = WORLD.slice(WORLD.indexOf('    await _teleportToPixel(t.go.x, t.go.y, localPos, { reposition: t.reposition });'));
  assert.match(ship, /^    await _teleportToPixel[^\n]*\n(?:\s*\/\/[^\n]*\n)*    if \(localPos && scaleOf\(t\.restore\?\.terrainScale\) !== STREAMING_TERRAIN_SCALE\) \{\n      const c = state\.compensation\[1\];\n      const y = restandHeight\(localPos\[1\] - c, localPos\[0\], localPos\[2\], scaleOf\(t\.restore\.terrainScale\)\) \+ c;\n      if \(walkMode\) player\.spawn\(localPos\[0\], y, localPos\[2\]\);/);
});

/** The quickload's own re-stand helpers, sliced from world.js and run over a stub frame and ground. */
function quickloadHelpers(stamp) {
  const i = WORLD.indexOf('        const was = scaleOf(extras.terrainScale);');
  const j = WORLD.indexOf('        if (extras.interior) {', i);
  assert.ok(i > 0 && j > i);
  const calls = [];
  const state = { localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  const restandHeight = (y, x, z, was) => { calls.push([y, x, z, was]); return y - 1; };
  const scaleOf = (s) => (s > 0 ? s : DEFAULT_TERRAIN_SCALE);
  const api = new Function('extras', 'state', 'restandHeight', 'scaleOf', 'STREAMING_TERRAIN_SCALE', `${WORLD.slice(i, j)}\nreturn { was, restandRows, restandAt };`)({ terrainScale: stamp }, state, restandHeight, scaleOf, STREAMING_TERRAIN_SCALE);
  return { ...api, calls };
}

test('TERRAIN-SCALE1: the quickload stands each record on the ground under its OWN native spot, and leaves a save on today\'s scale as it came', () => {
  const h = quickloadHelpers(undefined);
  assert.equal(h.was, 1.5, 'no stamp: written on the prefab\'s scale');
  const rows = [{ nativeX: 110, nativeZ: 220, y: 50, id: 'a' }, null];
  assert.deepEqual(h.restandRows(rows), [{ nativeX: 110, nativeZ: 220, y: 49, id: 'a' }, null], 'a pile, a foe, a guard: its y, over its native spot in the arrival\'s frame');
  assert.deepEqual(h.calls, [[50, 10, 20, 1.5]]);
  assert.equal(rows[0].y, 50, 'the envelope itself is not written through');
  assert.deepEqual(h.restandAt('position')([{ position: [130, 60, 240], time: 3 }]), [{ position: [130, 59, 240], time: 3 }], 'a torch: the middle of its position');
  assert.deepEqual(h.calls.at(-1), [60, 30, 40, 1.5]);
  assert.deepEqual(h.restandAt('pos')([{ pos: [101, 7, 202] }, { kind: 'no position' }]), [{ pos: [101, 6, 202] }, { kind: 'no position' }], 'a camp; a record without one is the restore\'s to refuse');
  assert.equal(h.restandRows(undefined), undefined, 'a list the envelope does not carry passes through as it came');
  const t = quickloadHelpers(1.25);
  const same = [{ nativeX: 1, nativeZ: 2, y: 3 }];
  assert.equal(t.restandRows(same), same, 'written on today\'s scale: the rows as they came');
  assert.equal(t.restandAt('pos')(same), same);
  assert.equal(t.calls.length, 0);
});

test('TERRAIN-SCALE1: an exterior scene a save carried from before the stamp stands its piles and torches again as the arrival lands them', () => {
  const i = WORLD.indexOf('  function restoreExteriorScene(pixel) {');
  const j = WORLD.indexOf('  /** TR4:', i);
  assert.ok(i > 0 && j > i);
  const run = (entry) => {
    const got = {};
    const deps = {
      restoreCachedScene: () => entry, _sceneCache: () => null, worldSceneName: () => 'W',
      state: { localFromWorld: (nx, nz) => [nx - 100, nz - 200], compensation: [0, 5, 0] },
      restandHeight: (y, x, z, was) => (was === 1.25 ? y : y - 1000 - x - z),
      scaleOf: (s) => (s > 0 ? s : DEFAULT_TERRAIN_SCALE),
      droppedLoot: { restoreWorld: (list) => { got.piles = list; } },
      droppedTorches: { restore: (list, from) => { got.torches = list.map((t) => from(t.position)); } },
    };
    const f = new Function(...Object.keys(deps), `${WORLD.slice(i, j)}\nreturn restoreExteriorScene;`)(...Object.values(deps));
    return { back: f({ x: 1, y: 2 }), got };
  };
  const legacy = run({ terrainScale: null, lootContainers: [{ nativeX: 110, nativeZ: 220, y: 40, items: [1] }], droppedTorches: [{ position: [130, 60, 240] }] });
  assert.equal(legacy.back, true);
  assert.equal(legacy.got.piles[0].y, 40 - 1000 - 10 - 20, 'the pile, over its own spot');
  assert.deepEqual(legacy.got.torches[0], [30, 60 - 1000 - 30 - 40 + 5, 40], 'the torch, over its own spot, then into the frame');
  const today = run({ terrainScale: 1.25, lootContainers: [{ nativeX: 110, nativeZ: 220, y: 40, items: [1] }], droppedTorches: [{ position: [130, 60, 240] }] });
  assert.equal(today.got.piles[0].y, 40); assert.deepEqual(today.got.torches[0], [30, 65, 40]);
  assert.equal(run(null).back, false, 'a scene never cached: the arrival stands as built');
});

test('TERRAIN-SCALE1: the scene cache keeps what it is handed - its frame, its scale, and the torches and camps the save used to drop', () => {
  const cache = createSceneCache();
  cacheScene(cache, 'S', { droppedPiles: [{ pos: [1, 2, 3], items: [] }], droppedTorches: [{ position: [4, 5, 6], time: 9, itemTemplateIndex: 247 }], camps: [{ pos: [7, 8, 9] }], frame: 'building', terrainScale: 1.25 });
  cacheScene(cache, 'L', { droppedPiles: [{ pos: [1, 2, 3], items: [] }] });
  const round = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  const s = restoreCachedScene(round, 'S');
  assert.equal(s.frame, 'building'); assert.equal(s.terrainScale, 1.25);
  assert.deepEqual(s.droppedTorches[0].position, [4, 5, 6], 'a torch in your house survives a load now');
  assert.deepEqual(s.camps[0].pos, [7, 8, 9]);
  const l = restoreCachedScene(round, 'L');
  assert.equal(l.frame, null); assert.equal(l.terrainScale, null, 'an entry without them reads as the old raw frame on the old scale');
  // a save written before the fields: loadable, empty arrays
  const legacy = restoreSceneCache(createSceneCache(), { permanentScenes: [], scenes: [{ sceneName: 'X', lootContainers: [], actionDoors: [], droppedPiles: [] }] });
  assert.deepEqual(restoreCachedScene(legacy, 'X').droppedTorches, []);
});

test('TERRAIN-SCALE1: an interior caches its floor in the BUILDING\'s frame - DFU\'s localPosition - and a legacy raw entry is stood again on today\'s ground', () => {
  assert.match(MODES, /const o = buildingOrigin\(\);\n    const droppedPiles = interiorDropped\.snapshotScene\(\)\.map\(\(p\) => \(\{ \.\.\.p, pos: \[p\.pos\[0\] - o\[0\], p\.pos\[1\] - o\[1\], p\.pos\[2\] - o\[2\]\] \}\)\);/);
  assert.match(MODES, /const droppedTorches = interiorTorches\.snapshot\(\(p\) => \[p\[0\] - o\[0\], p\[1\] - o\[1\], p\[2\] - o\[2\]\]\);/, 'the torches too');
  assert.match(MODES, /return \{ lootContainers, actionDoors, droppedPiles, droppedTorches, frame: 'building', terrainScale: STREAMING_TERRAIN_SCALE \};/);
  assert.match(MODES, /interiorTorches\.restore\(data\.droppedTorches, place\);/);
  assert.match(MODES, /const m = exteriorDoor\?\.matrix;\n    return m \? \[m\[12\], m\[13\], m\[14\]\] : \[0, 0, 0\];/, 'every door of a building carries the building\'s own matrix');
  assert.match(MODES, /const place = data\.frame === 'building'\n      \? \(p\) => \[p\[0\] \+ o\[0\], p\[1\] \+ o\[1\], p\[2\] \+ o\[2\]\]\n      : \(p\) => \[p\[0\], host\.restandSceneHeight \? host\.restandSceneHeight\(p\[1\], p\[0\], p\[2\], was\) : p\[1\], p\[2\]\];/);
  assert.match(WORLD, /restandSceneHeight: \(y, x, z, was\) => restandHeight\(y - state\.compensation\[1\], x, z, was\) \+ state\.compensation\[1\],/);
  assert.match(MODES, /const was = data\.terrainScale > 0 \? data\.terrainScale : DEFAULT_TERRAIN_SCALE;/, 'a legacy entry without a scale stood on the prefab\'s');
});

// ── BUILD-FAIL1 ─────────────────────────────────────────────────────────

function pump({ publish = false } = {}) {
  const i = WORLD.indexOf('  const inFlight = new Map();');
  const j = WORLD.indexOf('  const breather = createBreather();', i);
  assert.ok(i > 0 && j > i);
  const freed = [];
  const renderer = {
    destroyMesh: (m) => freed.push(['mesh', m]), destroyWaterSurface: (w) => freed.push(['water', w]),
    destroyBatch: (b) => freed.push(['batch', b]), gl: { deleteTexture: (t) => freed.push(['texture', t]) },
  };
  const buckets = new Set(['1,1', '1,1:gate:0', '1,1:gate:1', '2,2']);
  const collider = { removeBucket: (k) => buckets.delete(k) };
  const built = new Map();
  const buildingDoors = [{ pixelKey: '1,1' }, { pixelKey: '2,2' }, { pixelKey: '1,1' }];
  const hums = [];
  const env = { built, renderer, collider, buildingDoors, doorGeneration: 0, hums };
  const body = `${WORLD.slice(i, j)}
    async function buildPixelNow(px, py) {
      const key = px + ',' + py;
      const made = {};
      _building.set(key, made);
      made.terrain = 'T'; made.water = 'W'; made.tilemapTex = 'X'; made.staticBatch = 'S';
      made.cityGates = [{}];
      made.batches = ['b1', 'b2'];
      made.personBatches = new Map([['p', 'pb']]);
      made.windmills = [{ hum: { stop: () => hums.push(key) } }];
      await Promise.resolve();
      if (${publish}) { _building.delete(key); built.set(key, { px, py }); }
      throw new Error('a texture that never came');
    }
    return { buildPixel, inFlight, _building };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, freed, buckets, buildingDoors, built, hums };
}

test('BUILD-FAIL1: a build that throws frees what it made - the GPU surfaces and batches, its collider bucket and its gates\', its doors - and a published one is left to destroyPixel', async () => {
  const h = pump();
  await assert.rejects(h.buildPixel(1, 1), /never came/);
  assert.deepEqual(h.freed.map((f) => f.join(':')).sort(), ['batch:b1', 'batch:b2', 'batch:pb', 'mesh:S', 'mesh:T', 'texture:X', 'water:W'].sort());
  assert.deepEqual([...h.buckets].sort(), ['2,2'], 'the pixel\'s bucket and both gates\' - the one past the last record too - gone; another pixel\'s kept');
  assert.deepEqual(h.buildingDoors.map((d) => d.pixelKey), ['2,2'], 'its doors are no E-targets');
  assert.deepEqual(h.hums, ['1,1'], 'its windmills\' hums are stopped');
  assert.equal(h._building.size, 0); assert.equal(h.inFlight.size, 0);
  const p = pump({ publish: true });
  await assert.rejects(p.buildPixel(1, 1));
  assert.deepEqual(p.freed, [], 'published: the entry owns them, and destroyPixel frees them');
  assert.deepEqual(p.hums, []);
  assert.equal(p.buckets.size, 4);
  // the ledger is kept where the build makes each thing, and handed over at publish
  assert.match(WORLD, /    const made = \{\};[^\n]*\n    _building\.set\(key, made\);/, 'opened as the build begins');
  assert.match(WORLD, /    if \(_building\.get\(key\) === made\) _building\.delete\(key\);[^\n]*\n    built\.set\(key, \{/, 'closed as the entry is published - the entry\'s from there');
  for (const line of ['made.terrain = terrain; made.water = water;', 'made.tilemapTex = tilemapTex;', 'made.cityGates = pixelGates;', 'made.windmills = windmills;', 'made.personBatches = personBatches;', 'made.batches = batches;', 'made.staticBatch = staticBatch;']) {
    assert.ok(WORLD.includes(line), line);
  }
  assert.match(WORLD, /flying = buildPixelNow\(px, py\)\n      \.catch\(\(e\) => \{ releaseFailedBuild\(key\); throw e; \}\)/);
  // audit: one that threw AFTER publishing is torn down by the pump that releases its key, and a pixel torn down
  // while its NPCs' art loads takes no batch made after
  assert.match(WORLD, /console\.error\(`pixel \$\{next\.px\},\$\{next\.py\} failed:`, e\);\n(?:\s*\/\/[^\n]*\n)*      destroyPixel\(next\.px, next\.py, \{ collectLoose: false \}\);/);
  assert.match(WORLD, /const t = await getTexture\(archive\);\n      if \(built\.get\(`\$\{entry\.px\},\$\{entry\.py\}`\) !== entry\) return;/);
});

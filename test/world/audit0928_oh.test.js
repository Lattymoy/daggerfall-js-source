// AUDIT PRE-MERGE 0928 H4 (lens H, There's a Hole in the Bottom of the Ocean against its assembly) - THE TERRAIN'S
// SIZE IS A FLOAT. The mod multiplies its placement fractions by TerrainData.size.x / .z, a Unity float: 819.2f,
// 819.20001220703125. ProcessTerrain stands the pit at transform.position + PlacementFraction x size (IL_19a5-IL_19b9,
// IL_19bc-IL_19e0), DeformSeafloor cuts round fraction x size and measures the pixel's edges off size less it
// (IL_20c0-IL_20e8, IL_2212-IL_2258), and RestoreOceanPosition's fallback spot is the same sum (IL_61de-IL_6272) - float
// arithmetic, each step. The port multiplied by the double 819.2: at the midpoint rate 4,165 of the 21,152 pit axes
// stood one float step (0.0000305 m) off the mod's - pixel (6,0) the first of them, its x 393.86700439453125 where the
// mod's is 393.8670349121094.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOceanHoles } from '../../src/scenes/oceanHolesHost.js';
import { isPitPixel, placementFraction, deformSeafloorVertices } from '../../src/world/oceanHoles.js';
import * as deepWaterFloor from '../../src/world/deepWater/deepWaterFloor.js';

const f32 = Math.fround;
/** TerrainData.size.x / .z as the C# reads it - restated here, not the port's constant read back. */
const SIZE_F = f32(819.2);
const OCEAN_LOCAL_Y = 34;
/** Pixel (6,0): the first pit pixel at the midpoint rate, and off on both axes under the double. */
const PX = 6, PY = 0;

/** A flat floor at local y `floorY` over the whole pixel, the mod's 65 x 65 grid. */
function floorAt(floorY) {
  const positions = [];
  const vertexLocalY = new Float32Array(65 * 65);
  for (let i = 0; i < 65; i++) for (let j = 0; j < 65; j++) { positions.push(j * 819.2 / 64, floorY, i * 819.2 / 64); vertexLocalY[i * 65 + j] = floorY; }
  return { positions: Float32Array.from(positions), vertexLocalY, floorQuadWater: null };
}

/** Iliac Puddle No More's seafloor API over one floor, and a bake that verifies the spot. */
function rig(translation = [0, 0, 0]) {
  const floors = new Map();
  const deepWaters = {
    bake: { loaded: true, mapPixelHasWaterCells: () => true, mapPixelHasLandCells: () => false, isCarvedWater: () => true, sampleEdgeDistanceMeters: () => 1000 },
    oceanLocalY: OCEAN_LOCAL_Y,
    isSeafloorCurrent: (e) => floors.has(e),
    seafloorBuildVersion: (e) => (floors.has(e) ? 1 : -1),
    tryGetSeafloor: (e) => floors.get(e) ?? null,
    commitSeafloorChanges(e, positions) {
      const f = floors.get(e);
      if (!f) return false;
      f.positions = Float32Array.from(positions);
      for (let i = 0; i < 4225; i++) f.vertexLocalY[i] = f.positions[i * 3 + 1];
      return true;
    },
    refreshLoadedTile() {},
  };
  const built = new Map();
  const oh = createOceanHoles({
    deepWaters, built,
    pixelTranslation: () => translation,
    hasLocation: () => false, worldClimateOf: () => 223,
    pits: { create: () => ({}), destroy: () => {} },
    now: () => 0,
    settings: () => ({ surfaceHoleRadius: 20, seafloorHoleScale: 1, pitSpawnRate: 0.5, miasmaParticleCount: 72, miasmaHeight: 300, dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    warn: () => {},
  });
  const e = { px: PX, py: PY };
  built.set(`${PX},${PY}`, e);
  floors.set(e, floorAt(OCEAN_LOCAL_Y - 100));
  return { oh, e, floor: () => floors.get(e) };
}

test('AUDIT PRE-MERGE 0928 H4: the one float form of terrainData.size - 819.2f, exported beside the double', () => {
  assert.equal(deepWaterFloor.TILE_WORLD_SIZE_F32, 819.2000122070312);
  assert.equal(deepWaterFloor.TILE_WORLD_SIZE_F32, SIZE_F);
  assert.notEqual(deepWaterFloor.TILE_WORLD_SIZE_F32, deepWaterFloor.TILE_WORLD_SIZE, 'the double stays the port\'s own frame');
});

test('AUDIT PRE-MERGE 0928 H4: ProcessTerrain stands the pit at transform.position + PlacementFraction x terrainData.size, in floats - pixel (6,0)', () => {
  assert.ok(isPitPixel(PX, PY, 0.5), 'pixel (6,0) opens a pit at the midpoint rate');
  const fx = placementFraction(PX, PY, 88), fz = placementFraction(PX, PY, 90);
  const { oh, e } = rig();
  oh.seafloorBuilt(e);
  assert.equal(oh.stateOf(e).diagnostic, 'built');
  const pit = oh.pitOf(e);
  // IL_19a5-IL_19b9: position.x (0 here) + fraction * size.x, each a float step
  assert.equal(pit.marker.localX, f32(0 + f32(fx * SIZE_F)));
  assert.equal(pit.marker.localZ, f32(0 + f32(fz * SIZE_F)));
  assert.equal(pit.marker.localX, 393.8670349121094, 'the mod\'s x, not the double\'s 393.86700439453125');
  assert.equal(pit.marker.localZ, 239.61167907714844, 'the mod\'s z, not the double\'s 239.61166381835938');
  assert.equal(oh.entranceOf(e).position[0], 393.8670349121094, 'the entrance a swimmer touches stands there');
  assert.equal(oh.entranceOf(e).position[2], 239.61167907714844);
});

test('AUDIT PRE-MERGE 0928 H4: DeformSeafloor cuts round the float centre - fraction x 819.2f, the edges off 819.2f less it', () => {
  const fx = placementFraction(PX, PY, 88), fz = placementFraction(PX, PY, 90);
  const { oh, e, floor } = rig();
  const before = Float32Array.from(floor().positions);
  oh.seafloorBuilt(e);
  const cut = Array.from(floor().positions);
  const ilCut = deformSeafloorVertices(before, { fractionX: fx, fractionZ: fz, sizeX: SIZE_F, sizeZ: SIZE_F, scale: 1, allowFlatten: true });
  assert.deepEqual(cut, Array.from(Float32Array.from(ilCut.positions)), 'the cut the IL makes, vertex for vertex');
  // the pin can tell: a centre off by one float step on either axis moves the cut
  for (const [sx, sz] of [[819.2, SIZE_F], [SIZE_F, 819.2]]) {
    const off = deformSeafloorVertices(before, { fractionX: fx, fractionZ: fz, sizeX: sx, sizeZ: sz, scale: 1, allowFlatten: true });
    assert.notDeepEqual(Array.from(Float32Array.from(off.positions)), cut, `sizeX ${sx}, sizeZ ${sz} cuts elsewhere`);
  }
});

test('AUDIT PRE-MERGE 0928 H4: RestoreOceanPosition\'s fallback spot (world.js pitPlacement) is the same float sum - where ProcessTerrain stood the pit', () => {
  // world.js's closure cannot be booted here: its source is sliced out and run over a stub translation
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('pitPlacement: (x, y) => {');
  assert.ok(at > 0, 'the fallback spot is world.js\'s pitPlacement');
  const end = src.indexOf('\n    },', at);
  const body = src.slice(at + 'pitPlacement: '.length, end + '\n    }'.length);
  const make = (translation) => new Function('state', 'placementFraction', 'TILE_WORLD_SIZE', 'TILE_WORLD_SIZE_F32', `return (${body});`)(
    { pixelTranslation: () => translation }, placementFraction, deepWaterFloor.TILE_WORLD_SIZE, deepWaterFloor.TILE_WORLD_SIZE_F32);
  const fx = placementFraction(PX, PY, 88), fz = placementFraction(PX, PY, 90);
  // IL_61de-IL_6272: terrain.transform.position + PlacementFraction(...) * terrainData.size, in floats
  assert.deepEqual(make([0, 0, 0])(PX, PY), { x: 393.8670349121094, z: 239.61167907714844 });
  const t = [4915.2, 0, -2457.6];
  assert.deepEqual(make(t)(PX, PY), { x: f32(t[0] + f32(fx * SIZE_F)), z: f32(t[2] + f32(fz * SIZE_F)) });
  // ...the very point ProcessTerrain stood the pit at under the same translation (oceanHolesHost.js num4 / num5)
  const { oh, e } = rig(t);
  oh.seafloorBuilt(e);
  const pit = oh.pitOf(e);
  assert.equal(f32(t[0] + pit.marker.localX), make(t)(PX, PY).x);
  assert.equal(f32(t[2] + pit.marker.localZ), make(t)(PX, PY).z);
});

test('AUDIT PRE-MERGE 0928 H4: ONE DFU MEMBER, ONE EXPORT - terrainData.size as a float is deepWaterFloor.js\'s TILE_WORLD_SIZE_F32, and no other source rounds the tile size itself', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const root = fileURLToPath(new URL('../../src', import.meta.url));
  const inline = walk(root).filter((f) => /(?:fround|f32)\(\s*TILE_WORLD_SIZE\s*\)/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length + 1));
  assert.deepEqual(inline, ['world/deepWater/deepWaterFloor.js'], 'the float form is computed once, where the double lives');
  assert.match(readFileSync(join(root, 'world/underwater/underwaterDecorations.js'), 'utf8'), /const size = TILE_WORLD_SIZE_F32;/, 'DW-E2\'s billboard grid reads the one export');
});

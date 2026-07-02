import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dfMeshToModel, GLOBAL_SCALE } from '../src/world/meshReader.js';
import { layoutRmbBlock, buildGroundTilemap, GROUND_OFFSET, GROUND_TILE_SIZE } from '../src/world/rmbLayout.js';
import { layoutLocation, RMB_SIDE } from '../src/world/locationLayout.js';
import { collectBlockFlats, scaledBillboardSize } from '../src/world/rmbFlats.js';
import { collectCityLights, nearestLights, CITY_LIGHT_RANGE, CITY_LIGHT_INTENSITY, CITY_LIGHT_COLOR } from '../src/world/cityLights.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { trs, multiply, transformPoint, identity } from '../src/world/mat4.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile, BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function approx(actual, expected, eps = 1e-4) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('world: mat4 trs and composition', () => {
  // Pure translation.
  const t = trs(3, 4, 5, 0, 0, 0);
  assert.deepEqual(transformPoint(t, 0, 0, 0), [3, 4, 5]);
  assert.deepEqual(transformPoint(identity(), 7, 8, 9), [7, 8, 9]);

  // Y rotation -270deg == +90deg: (x,z) -> (z, -x).
  const r = trs(0, 0, 0, 0, -270, 0);
  const p = transformPoint(r, 0.2, 0, 0.2);
  approx(p[0], 0.2);
  approx(p[1], 0);
  approx(p[2], -0.2);

  // parent * child applies child first.
  const parent = trs(48, 0, 25.6, 0, -270, 0);
  const child = trs(0.2, 0, 0.2, 0, 0, 0);
  const combined = multiply(parent, child);
  const o = transformPoint(combined, 0, 0, 0);
  approx(o[0], 48.2);
  approx(o[1], 0);
  approx(o[2], 25.4);
});

test('world: meshReader fan winding, scale, and UV finalization', () => {
  // One submesh, one 4-point plane (2 triangles).
  const dfMesh = {
    totalVertices: 4,
    totalTriangles: 2,
    subMeshes: [
      {
        textureArchive: 156,
        textureRecord: 1,
        totalTriangles: 2,
        planes: [
          {
            points: [
              { x: -384, y: 0, z: 512, nx: -1, ny: 0, nz: 1, u: 0, v: 256 },
              { x: 0, y: 100, z: 0, nx: 0, ny: 2, nz: 0, u: 64, v: 0 },
              { x: 40, y: 0, z: 0, nx: 0, ny: 0, nz: 1, u: 32, v: 64 },
              { x: 0, y: 0, z: 40, nx: 1, ny: 0, nz: 0, u: 16, v: 128 },
            ],
          },
        ],
      },
    ],
  };
  const model = dfMeshToModel(dfMesh, () => ({ width: 64, height: 128 }));

  // (X, -Y, Z) * GlobalScale.
  assert.equal(GLOBAL_SCALE, 0.025);
  approx(model.positions[0], -9.6);
  approx(model.positions[1], -0);
  approx(model.positions[2], 12.8);
  approx(model.positions[4], -2.5); // -100 * 0.025

  // normalize(NX, -NY, NZ).
  approx(model.normals[0], -Math.SQRT1_2);
  approx(model.normals[2], Math.SQRT1_2);
  approx(model.normals[4], -1); // (0, -2, 0) normalized

  // (U / w, -(V / h)).
  approx(model.uvs[0], 0);
  approx(model.uvs[1], -2);
  approx(model.uvs[2], 1);
  approx(model.uvs[5], -0.5);

  // Fan indices [shared, vc+1, vc].
  assert.deepEqual(Array.from(model.indices), [0, 2, 1, 0, 3, 2]);
  assert.deepEqual(model.subMeshes, [
    { textureArchive: 156, textureRecord: 1, startIndex: 0, primitiveCount: 2 },
  ]);
});

test('world: ground tilemap flip and grass override', () => {
  // Handcrafted 16x16 [x][y] source: record x at [x][0] row, marker at [3][15].
  const src = Array.from({ length: 16 }, (_, x) =>
    Array.from({ length: 16 }, (_, y) => ({
      textureRecord: y === 15 && x === 3 ? 60 : (x + y) % 56,
      isRotated: x === 1 && y === 0,
      isFlipped: x === 2 && y === 0,
    }))
  );
  const block = { rmbBlock: { fldHeader: { groundData: { groundTiles: src } } } };
  const tiles = buildGroundTilemap(block);

  // tiles[y][x] = src[x][15 - y].
  assert.equal(tiles[15][0].record, src[0][0].textureRecord);
  assert.equal(tiles[15][1].rotated, true);
  assert.equal(tiles[15][2].flipped, true);
  assert.equal(tiles[0][5].record, src[5][15].textureRecord);

  // Record >= 56 resets to grass 8.
  assert.deepEqual(tiles[0][3], { record: 8, rotated: false, flipped: false });

  assert.equal(GROUND_OFFSET, -1);
  assert.equal(GROUND_TILE_SIZE, 256);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

function realTextureSizeGetter() {
  const cache = new Map();
  return (archive, record) => {
    if (!cache.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const t = new TextureFile();
      t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name);
      cache.set(archive, t);
    }
    const t = cache.get(archive);
    return { width: t.getWidth(record), height: t.getHeight(record) };
  };
}

test('world: model 456 through meshReader pinned', { skip: skipReal }, () => {
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const dfMesh = arch.getMesh(arch.getRecordIndex(456));
  const model = dfMeshToModel(dfMesh, realTextureSizeGetter());

  assert.equal(model.positions.length, 1278 * 3);
  assert.equal(model.indices.length, 638 * 3);
  assert.equal(model.subMeshes.length, 7);
  assert.deepEqual(model.subMeshes[0], {
    textureArchive: 156,
    textureRecord: 1,
    startIndex: 0,
    primitiveCount: 152,
  });

  // First point of submesh 0 plane 0: (-384, 0, 512), n (-0.707.., 0, 0.707..),
  // uv (0/64, -(256/128)).
  approx(model.positions[0], -9.6);
  approx(model.positions[1], 0);
  approx(model.positions[2], 12.8);
  approx(model.normals[0], -0.70710677);
  approx(model.normals[2], 0.70710677);
  approx(model.uvs[0], 0);
  approx(model.uvs[1], -2);
  assert.deepEqual(Array.from(model.indices.slice(0, 6)), [0, 2, 1, 0, 3, 2]);
});

test('world: MAGEAA00.RMB layout pinned', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const mage = blocks.getBlockByName('MAGEAA00.RMB');
  const layout = layoutRmbBlock(mage);

  // 19 exterior building models + 1 misc model.
  assert.equal(layout.models.length, 20);
  assert.equal(layout.models[0].modelId, '223');

  // Subrecord 0 at (1920, 3072) rot 1536, model 0 at local (8, 0, 8):
  // world translation (48.2, 0, 25.4) via T(48, 0, 25.6) * Ry(-270deg).
  const o = transformPoint(layout.models[0].matrix, 0, 0, 0);
  approx(o[0], 48.2);
  approx(o[1], 0);
  approx(o[2], 25.4);

  // Ground: tiles[15][0] mirrors src[0][0] (record 12, plain).
  assert.deepEqual(layout.groundTiles[15][0], { record: 12, rotated: false, flipped: false });
  assert.equal(layout.groundTiles.length, 16);
  assert.equal(layout.groundTiles[0].length, 16);
});

test('world: Daggerfall city location layout pinned', { skip: skipReal }, () => {
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))
  );
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const dfLocation = maps.getLocationByName('Daggerfall', 'Daggerfall');
  const loc = layoutLocation(dfLocation, maps, blocks);

  // 8x8 grid, every block resolved, Woodlands ground.
  assert.equal(loc.width, 8);
  assert.equal(loc.height, 8);
  assert.equal(loc.blocks.length, 64);
  assert.equal(loc.groundArchive, 302);
  assert.equal(RMB_SIDE, 102.4);

  // Grid placement: block (x, y) at (x * RMBSide, 0, y * RMBSide).
  const b0 = loc.blocks[0];
  assert.equal(b0.blockName, 'WALLAA02.RMB');
  assert.deepEqual([b0.originX, b0.originZ], [0, 0]);
  const b9 = loc.blocks.find((b) => b.x === 1 && b.y === 1);
  approx(b9.originX, 102.4);
  approx(b9.originZ, 102.4);

  // Every block assembled with ground and at least the wall geometry.
  for (const b of loc.blocks) {
    assert.ok(b.dfBlock, b.blockName);
    assert.equal(b.layout.groundTiles.length, 16);
  }
});

test('world: scaledBillboardSize verbatim math', () => {
  // No scale: size * GlobalScale.
  assert.deepEqual(scaledBillboardSize({ width: 64, height: 128 }, { width: 0, height: 0 }), {
    w: 1.6,
    h: 3.2,
  });
  // Negative scale shrinks via trunc-toward-zero (Orc Sergeant 97x109 @ -70):
  // change = trunc(97 * -70/256) = -26, trunc(109 * -70/256) = -29.
  const orc = scaledBillboardSize({ width: 97, height: 109 }, { width: -70, height: -70 });
  approx(orc.w, (97 - 26) * 0.025);
  approx(orc.h, (109 - 29) * 0.025);
});

test('world: collectBlockFlats paths and quirks', () => {
  const scenery = Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, () => ({ textureRecord: -1 }))
  );
  scenery[2][12] = { textureRecord: 5 }; // -> tiles y = 3
  scenery[4][15] = { textureRecord: 0 }; // marker, skipped
  const block = {
    rmbBlock: {
      fldHeader: { groundData: { groundScenery: scenery } },
      miscFlatObjectRecords: [
        { textureArchive: 210, textureRecord: 29, xPos: 100, yPos: 50, zPos: 200 },
      ],
      subRecords: [
        {
          xPos: 1000,
          zPos: 2000,
          exterior: {
            blockFlatObjectRecords: [
              { textureArchive: 197, textureRecord: 3, xPos: 8, yPos: 0, zPos: 8 },
              { textureArchive: 199, textureRecord: 1, xPos: 0, yPos: 0, zPos: 0 }, // editor, skipped
              { textureArchive: 504, textureRecord: 2, xPos: 40, yPos: 0, zPos: 40 }, // nature swap
            ],
          },
        },
      ],
    },
  };
  const flats = collectBlockFlats(block, 510);
  assert.equal(flats.length, 4);

  // Misc: (X, -Y - 6, Z + 4096) * 0.025.
  assert.equal(flats[0].archive, 210);
  approx(flats[0].x, 2.5);
  approx(flats[0].y, -1.4);
  approx(flats[0].z, 107.4);

  // Exterior: + unrotated (subX, 0, -subZ) offset.
  approx(flats[1].x, 8 * 0.025 + 25);
  approx(flats[1].y, -0.15);
  approx(flats[1].z, (8 + 4096) * 0.025 - 50);
  assert.equal(flats[1].archive, 197);

  // Nature range swaps to the climate archive; verbatim DFU assigns the raw
  // natureFlatsOffsetY to z (suspected upstream y/z typo, kept for parity).
  assert.equal(flats[2].archive, 510);
  assert.equal(flats[2].z, -2);

  // Scenery [x][15 - y] with per-tile 256 stride, y at scaled -2.
  assert.deepEqual(flats[3], {
    archive: 510,
    record: 5,
    x: 2 * 256 * 0.025,
    y: -2 * 0.025,
    z: (3 * 256 + 256) * 0.025,
  });
});

test('world: MAGEAA00 flats pinned', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const mage = blocks.getBlockByName('MAGEAA00.RMB');
  const flats = collectBlockFlats(mage, 504);
  assert.equal(flats.length, 27);
  assert.deepEqual(flats[0], { archive: 210, record: 29, x: 84.325, y: -0.05, z: 43.45 });
  const byArchive = {};
  for (const f of flats) byArchive[f.archive] = (byArchive[f.archive] || 0) + 1;
  assert.deepEqual(byArchive, { 201: 2, 210: 3, 212: 10, 213: 1, 504: 11 });
});

test('world: exterior nature-range flats do not exist in classic data', { skip: skipReal }, () => {
  // Settles the Port-Ledger B entry: DFU's `billboardPosition.z =
  // natureFlatsOffsetY` branch in AddExteriorBlockFlats (suspected y/z typo)
  // is a dead code path on classic data - no exterior subrecord flat in any
  // RMB block uses archives 500-511. Verbatim behavior is provably identical
  // to any fix. The branch only matters for mod-injected buildings.
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  let hits = 0;
  for (let i = 0; i < blocks.count; i++) {
    if (blocks.getBlockName(i) === 'FOO') continue;
    if (blocks.getBlockType(i) !== BLOCK_TYPES.Rmb) continue;
    const blk = blocks.getBlock(i);
    for (const sr of blk.rmbBlock.subRecords) {
      for (const f of sr.exterior.blockFlatObjectRecords) {
        if (f.textureArchive >= 500 && f.textureArchive <= 511) hits++;
      }
    }
  }
  assert.equal(hits, 0);
});

test('world: city light constants and nearest selection', () => {
  // DaggerfallLight [City] prefab: point light, range 18, intensity 1, white.
  assert.equal(CITY_LIGHT_RANGE, 18);
  assert.equal(CITY_LIGHT_INTENSITY, 1);
  assert.deepEqual(Array.from(CITY_LIGHT_COLOR), [1, 1, 1]);

  const lights = [
    { x: 100, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  const near = nearestLights(lights, [0, 0, 0], 2, 18);
  assert.equal(near.length, 8); // 2 lights x vec4
  assert.deepEqual(Array.from(near), [1, 0, 0, 18, 10, 0, 0, 18]);
});

test('world: MAGEAA00 city lights pinned - both verbatim paths', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const t210 = new TextureFile();
  t210.load(new Uint8Array(readFileSync(join(ARENA2, 'TEXTURE.210'))), 'TEXTURE.210', pal);
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const mage = blocks.getBlockByName('MAGEAA00.RMB');

  const size = (r) => scaledBillboardSize(t210.getSize(r), t210.getScale(r));
  const lights = collectCityLights(mage, size);
  assert.equal(lights.length, 3);

  // Same lantern as the archive-210 flat pin (84.325, -0.05, 43.45): the
  // LIGHT uses -Y + size.h (record 29 scaled height 4) instead of the -6
  // billboard offset, so y = (4 + 4) * 0.025 = 0.2. Cross-checks both
  // verbatim formulas on real data.
  assert.deepEqual(size(29), { w: 0.525, h: 4 });
  approx(lights[0].x, 84.325);
  approx(lights[0].y, 0.2);
  approx(lights[0].z, 43.45);
});

test('world: R9 tilemap conversion - verbatim UpdateTileMapDataJob', async () => {
  const { convertTilemap, buildTerrainGrid, buildTerrainIndices } =
    await import('../src/world/terrainSurface.js');
  // [flip, rotate, 6-bit record] -> [record << 2 | rotate | flip << 1],
  // FF water sentinel back to record 0 (ConvertWaterTiles default).
  const src = new Uint8Array([2, 66, 130, 194, 0xff, 0, 63, 55 | 64 | 128]);
  assert.deepEqual([...convertTilemap(src)],
    [8, 9, 10, 11, 0, 0, 252, 223]);
  // Grid shape + corner-height law match the retired quad path: corner
  // (x, z) samples data[x * hDim + z] * MAX_TERRAIN_HEIGHT * scale.
  const { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE } =
    await import('../src/world/terrainSampler.js');
  const hDim = HEIGHTMAP_DIMENSION;
  const samples = new Float32Array(hDim * hDim);
  samples[5 * hDim + 7] = 0.25; // sample(x=5, z=7)
  const grid = buildTerrainGrid(samples);
  assert.equal(grid.positions.length, hDim * hDim * 3);
  const vi = (7 * hDim + 5) * 3; // vertex (x=5, z=7), rows are z
  approx(grid.positions[vi], 5 * 6.4);
  approx(grid.positions[vi + 1], 0.25 * MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE);
  approx(grid.positions[vi + 2], 7 * 6.4);
  // Shared indices: two triangles per cell on the (x,z)->(x+1,z+1)
  // diagonal, matching the retired tessellation.
  const idx = buildTerrainIndices();
  assert.equal(idx.length, (hDim - 1) * (hDim - 1) * 6);
  assert.deepEqual([...idx.slice(0, 6)], [0, hDim, hDim + 1, 0, hDim + 1, 1]);
});

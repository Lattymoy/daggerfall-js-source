import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dfMeshToModel, GLOBAL_SCALE } from '../src/world/meshReader.js';
import { layoutRmbBlock, buildGroundTilemap, GROUND_OFFSET, GROUND_TILE_SIZE } from '../src/world/rmbLayout.js';
import { layoutLocation, RMB_SIDE } from '../src/world/locationLayout.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { trs, multiply, transformPoint, identity } from '../src/world/mat4.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { TextureFile } from '../src/formats/textureFile.js';

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

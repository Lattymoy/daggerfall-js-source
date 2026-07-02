import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Arch3dFile, uvUnpack, UV_GENERATION_METHODS } from '../src/formats/arch3dFile.js';
import { computeFaceUVCoordinates } from '../src/formats/faceUVTool.js';
import { ARCH3D_PATCH } from '../src/formats/arch3dPatch.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('arch3d: uvUnpack passthrough, exception value, and packed unpacking', () => {
  // In-range coordinates pass through untouched.
  assert.equal(uvUnpack(0), 0);
  assert.equal(uvUnpack(14335), 14335);
  assert.equal(uvUnpack(-14335), -14335);
  // -7168 is the only known in-range exception: nearest multiple of 8192 is
  // -8192, so it unpacks to 1024.
  assert.equal(uvUnpack(-7168), 1024);
  // Packed values subtract the nearest multiple of 8192.
  assert.equal(uvUnpack(16384), 0);
  assert.equal(uvUnpack(16400), 16);
  assert.equal(uvUnpack(-16384), 0);
  assert.equal(uvUnpack(15000), 15000 - 16384);
});

test('arch3d: face UV matrix solves an axis-aligned square', () => {
  // Square in the XY plane; UVs stored as deltas for points 1 and 2.
  const face = [
    { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 256, u: 0, v: 0 },
    { x: 4096, y: 0, z: 0, nx: 0, ny: 0, nz: 256, u: 16, v: 0 },
    { x: 4096, y: 4096, z: 0, nx: 0, ny: 0, nz: 256, u: 0, v: 16 },
    { x: 0, y: 4096, z: 0, nx: 0, ny: 0, nz: 256, u: 0, v: 0 },
  ];
  const out = new Array(24);
  assert.equal(computeFaceUVCoordinates(face, out), true);
  // First three points: absolute, delta, delta+delta.
  assert.deepEqual([out[0].u, out[0].v], [0, 0]);
  assert.deepEqual([out[1].u, out[1].v], [16, 0]);
  assert.deepEqual([out[2].u, out[2].v], [16, 16]);
  // Fourth point computed via the matrix: (0, 16).
  assert.deepEqual([out[3].u, out[3].v], [0, 16]);
  // Positions and normals copied through.
  assert.equal(out[3].x, 0);
  assert.equal(out[3].y, 4096);
  assert.equal(out[3].nz, 256);

  // Overflow beyond the 24-slot buffer throws, matching the C# fixed array.
  const big = new Array(25).fill(face[0]);
  assert.throws(() => computeFaceUVCoordinates(big, out), RangeError);
});

test('arch3d: patch table extracted intact', () => {
  assert.equal(ARCH3D_PATCH.length, 905);
  assert.deepEqual(ARCH3D_PATCH[0], [14515830, [0, 252]]);
  assert.deepEqual(ARCH3D_PATCH[904], [13806055, [8]]);
  for (const [offset, data] of ARCH3D_PATCH) {
    assert.ok(Number.isInteger(offset) && offset > 0);
    assert.ok(Array.isArray(data) && data.length >= 1);
  }
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('arch3d: full corpus decomposes - all 10251 records', { skip: skipReal }, () => {
  const a = new Arch3dFile();
  const bytes = new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')));
  assert.equal(a.load(bytes), true);
  assert.equal(a.count, 10251);

  // Patch must have been applied to the working copy, not the caller's bytes.
  const [firstOffset, firstData] = ARCH3D_PATCH[0];
  assert.equal(a._bsa._bytes[firstOffset], firstData[0]);
  assert.equal(a._bsa._bytes[firstOffset + 1], firstData[1]);
  assert.notDeepEqual(
    [bytes[firstOffset], bytes[firstOffset + 1]],
    firstData,
    'caller buffer must stay unpatched'
  );

  let ok = 0;
  let totalVerts = 0;
  let totalTris = 0;
  let submeshes = 0;
  for (let i = 0; i < a.count; i++) {
    const m = a.getMesh(i);
    assert.ok(m.subMeshes && m.subMeshes.length > 0, `record ${i} (id ${a.getRecordId(i)})`);
    ok++;
    totalVerts += m.totalVertices;
    totalTris += m.totalTriangles;
    submeshes += m.subMeshes.length;
    // Fan invariant: triangles per submesh equal sum of (points - 2).
    for (const sm of m.subMeshes) {
      let tris = 0;
      for (const p of sm.planes) {
        assert.ok(p.points.length >= 3, `record ${i}: plane under 3 points`);
        tris += p.points.length - 2;
      }
      assert.equal(tris, sm.totalTriangles, `record ${i}: triangle count`);
    }
  }
  // Pinned corpus totals from the original (patched) data.
  assert.equal(ok, 10251);
  assert.equal(totalVerts, 797433);
  assert.equal(totalTris, 388475);
  assert.equal(submeshes, 31922);
});

test('arch3d: pinned model 456 and record 0', { skip: skipReal }, () => {
  const a = new Arch3dFile();
  a.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  a.autoDiscard = false;

  const idx = a.getRecordIndex(456);
  assert.equal(idx, 5557);
  assert.equal(a.getRecordIndex(456), 5557); // cached lookup
  const m = a.getMesh(idx);
  assert.equal(m.objectId, 456);
  assert.equal(m.subMeshes.length, 7);
  assert.equal(m.totalVertices, 1278);
  assert.equal(m.totalTriangles, 638);
  assert.equal(m.radius, 838);
  assert.deepEqual(m.size, { x: 1024, y: 838, z: 1024 });
  assert.equal(m.subMeshes[0].textureArchive, 156);
  assert.equal(m.subMeshes[0].textureRecord, 1);
  const p0 = m.subMeshes[0].planes[0].points[0];
  assert.deepEqual(p0, {
    x: -384, y: 0, z: 512,
    nx: -0.70703125, ny: 0, nz: 0.70703125,
    u: 0, v: 256,
  });
  assert.equal(
    m.subMeshes[0].planes[0].uvGenerationMethod,
    UV_GENERATION_METHODS.ModifiedMatrixGenerator
  );

  const m0 = a.getMesh(0);
  assert.equal(m0.objectId, 44005);
  assert.equal(m0.totalVertices, 140);
  assert.equal(m0.totalTriangles, 72);
  assert.equal(m0.subMeshes.length, 5);
  assert.equal(m0.radius, 144.8984375);

  // getMesh on an unknown id path returns the empty mesh.
  assert.equal(a.getRecordIndex(999999999), -1);
  assert.equal(a.getMesh(-1).subMeshes, null);
});

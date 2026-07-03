import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packCharacterFaces, facesBounds } from '../src/render/characterMesh.js';
import { buildBody, BARE_PLUGS } from '../src/characters/rewrite/body.js';

test('charmesh: fan triangulation, color normalization, normals', () => {
  const quad = { p: [0,0,0, 1,0,0, 1,1,0, 0,1,0], n: [0,0,1], c: [255, 128, 0] };
  const tri = { p: [0,0,0, 2,0,0, 0,2,0], n: [0,1,0], c: [0, 0, 255] };
  const out = packCharacterFaces([quad, tri]);
  // quad -> 2 tris, tri -> 1 tri; 9 floats/vertex.
  assert.equal(out.length, (2 + 1) * 3 * 9);
  // First tri = v0,v1,v2 of the quad; second = v0,v2,v3 (fan).
  assert.deepEqual([...out.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...out.slice(9, 12)], [1, 0, 0]);
  assert.deepEqual([...out.slice(27, 30)], [0, 0, 0]);
  assert.deepEqual([...out.slice(36, 39)], [1, 1, 0]);
  // Color 0-1 + normal ride every vertex.
  assert.ok(Math.abs(out[3] - 1) < 1e-6 && Math.abs(out[4] - 128 / 255) < 1e-6 && out[5] === 0);
  assert.deepEqual([...out.slice(6, 9)], [0, 0, 1]);
  // Tri block carries its own color/normal.
  const t = 2 * 3 * 9;
  assert.deepEqual([...out.slice(t + 3, t + 9)], [0, 0, 1, 0, 1, 0]);
});

test('charmesh: bare humanoid packs whole + bounds sane', () => {
  const faces = buildBody({ loco: 'stand', hold: 'idle', phase: 0 }, BARE_PLUGS);
  let tris = 0;
  for (const f of faces) tris += f.p.length / 3 - 2;
  const out = packCharacterFaces(faces);
  assert.equal(out.length, tris * 3 * 9);
  const b = facesBounds(faces);
  assert.ok(b.maxY > b.minY, 'has height');
  assert.ok(b.maxX > b.minX && b.maxZ > b.minZ);
});

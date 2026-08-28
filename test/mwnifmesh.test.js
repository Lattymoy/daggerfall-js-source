import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';

const MESH = new Uint8Array(readFileSync(new URL('./fixtures/mw/mesh.nif', import.meta.url)));
const SKINNED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/skinned.nif', import.meta.url)),
);

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Minimal hand-built graph helpers - the flattener is pure data-in. */
function node(over = {}) {
  return {
    type: 'NiNode',
    name: '',
    flags: 0,
    translation: [0, 0, 0],
    rotation: I3,
    scale: 1,
    properties: [],
    children: [],
    effects: [],
    ...over,
  };
}
function shape(over = {}) {
  return { ...node(over), type: 'NiTriShape', data: over.data ?? -1, skin: over.skin ?? -1 };
}
function triData(over = {}) {
  return {
    type: 'NiTriShapeData',
    numVertices: 1,
    vertices: Float32Array.from([1, 0, 0]),
    normals: Float32Array.from([1, 0, 0]),
    colors: null,
    uvSets: [],
    triangles: Uint16Array.from([0, 0, 0]),
    numTriangles: 1,
    ...over,
  };
}

test('mwnifmesh: fixture quad - baked translation, passthrough, material', () => {
  const batches = flattenNif(parseNif(MESH));
  assert.equal(batches.length, 1);
  const b = batches[0];
  assert.equal(b.name, 'Quad');
  assert.equal(b.skinned, false);
  // Root is identity; the shape sits at (1,2,3) - baked into positions.
  assert.deepEqual(Array.from(b.positions), [1, 2, 3, 2, 2, 3, 2, 3, 3, 1, 3, 3]);
  // Identity rotation: normals pass through untouched.
  assert.deepEqual(Array.from(b.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(Array.from(b.uvs), [0, 0, 1, 0, 1, 1, 0, 1]);
  assert.equal(b.colors.length, 16);
  assert.deepEqual(Array.from(b.indices), [0, 1, 2, 0, 2, 3]);
  assert.deepEqual(b.material.diffuse, [1, 0.5, 0.25]);
  assert.ok(near(b.material.alpha, 0.8, 1e-6));
  assert.equal(b.material.textureFile, 'textures\\fixture.dds');
  assert.equal(b.material.clampMode, 3);
  assert.equal(b.material.alphaBlend, false);
});

test('mwnifmesh: nested rotation * scale * translation composes NetImmerse-style', () => {
  // Parent: +90deg about Z (row-major), scale 2, at (10, 0, 0).
  // Child shape: local translation (1, 0, 0), one vert at (1, 0, 0).
  // World T(child) = Rp*(Sp*Tl)+Tp = (0,2,0)+(10,0,0) = (10,2,0).
  // World vert     = Rw*(Sw*v)+Tw = (0,2,0)+(10,2,0) = (10,4,0).
  // Normal (1,0,0) -> (0,1,0), unscaled.
  const rotZ90 = Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]);
  const nif = {
    records: [
      node({ rotation: rotZ90, scale: 2, translation: [10, 0, 0], children: [1] }),
      shape({ translation: [1, 0, 0], data: 2 }),
      triData(),
    ],
    roots: [0],
  };
  const [b] = flattenNif(nif);
  assert.ok(near(b.positions[0], 10) && near(b.positions[1], 4) && near(b.positions[2], 0));
  assert.ok(near(b.normals[0], 0) && near(b.normals[1], 1) && near(b.normals[2], 0));
});

test('mwnifmesh: hidden flag culls the subtree; includeHidden overrides', () => {
  const nif = {
    records: [
      node({ children: [1, 3] }),
      node({ flags: 0x0001, children: [2] }),
      shape({ name: 'Hidden', data: 4 }),
      shape({ name: 'Seen', data: 4 }),
      triData(),
    ],
    roots: [0],
  };
  assert.deepEqual(
    flattenNif(nif).map((b) => b.name),
    ['Seen'],
  );
  assert.deepEqual(
    flattenNif(nif, { includeHidden: true })
      .map((b) => b.name)
      .sort(),
    ['Hidden', 'Seen'],
  );
});

test('mwnifmesh: RootCollisionNode subtree never draws', () => {
  const nif = {
    records: [
      node({ children: [1, 3] }),
      { ...node({ children: [2] }), type: 'RootCollisionNode' },
      shape({ name: 'Collision', data: 4 }),
      shape({ name: 'Visible', data: 4 }),
      triData(),
    ],
    roots: [0],
  };
  assert.deepEqual(
    flattenNif(nif).map((b) => b.name),
    ['Visible'],
  );
});

test('mwnifmesh: properties accumulate down the graph, nearer overrides', () => {
  const matA = { type: 'NiMaterialProperty', name: 'A', diffuse: [1, 0, 0], ambient: [0, 0, 0], emissive: [0, 0, 0], glossiness: 1, alpha: 1 };
  const matB = { type: 'NiMaterialProperty', name: 'B', diffuse: [0, 1, 0], ambient: [0, 0, 0], emissive: [0, 0, 0], glossiness: 1, alpha: 1 };
  const nif = {
    records: [
      node({ properties: [3], children: [1, 2] }),
      shape({ name: 'Inherits', data: 5 }),
      shape({ name: 'Overrides', data: 5, properties: [4] }),
      matA,
      matB,
      triData(),
    ],
    roots: [0],
  };
  const byName = Object.fromEntries(flattenNif(nif).map((b) => [b.name, b]));
  assert.deepEqual(byName.Inherits.material.diffuse, [1, 0, 0]);
  assert.deepEqual(byName.Overrides.material.diffuse, [0, 1, 0]);
});

test('mwnifmesh: skinned fixture emits as bind-pose preview, marked skinned', () => {
  const batches = flattenNif(parseNif(SKINNED));
  const b = batches.find((x) => x.name === 'Skinned');
  assert.ok(b);
  assert.equal(b.skinned, true);
  // Verts as authored - no deformation until the animation slice.
  assert.deepEqual(Array.from(b.positions), [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]);
  assert.equal(b.normals, null);
});

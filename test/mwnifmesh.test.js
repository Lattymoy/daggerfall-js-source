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

// ── MWT2 (2026-09-17, Mac: the Morrowind model's torch "isnt lit") ──────
//
// THE EMISSION THIS FILE RESOLVED AND NOBODY READ. `resolveMaterial` has
// always ported the reference's two emissive laws - LightMode_Emissive
// forces the diffuse and the ambient to BLACK so the surface is lit by
// its emissive term ALONE (:2895-2902), and VertexMode_SrcEmissive names
// the vertex colour as that term - and then `packFpArm` wrote only
// `diffuseAt` into the buffer and the character fragment had no emission
// at all (its own comment said "C4b - no emission", written when the only
// meshes on that program were the voxel rigs, before MW-D11 brought real
// Morrowind meshes through it).
//
// So the port drew a self-illuminated surface as BLACK diffuse times a
// texture times the room's light: black. The torch's flame is exactly
// that surface, and a torch with a black flame is a stick.
import { emissiveAt as emissiveAt_MWT2, diffuseAt as diffuseAt_MWT2,
  VERTEX_COLOR_MODE as VCM_MWT2 } from '../src/formats/mwNifMesh.js';

test('MWT2 emissiveAt: the vertex colour IS the emission where the mode names it, the material’s own otherwise - diffuseAt’s mirror on rule 63’s substitution law (mutant: the material read for an Emission mesh, so a flame takes the black the same law forced on its diffuse)', () => {
  // Exactly representable in float32, because the real colour array is
  // one and a 0.1 that comes back as 0.10000000149 is the fixture lying
  // about the code rather than the code being wrong.
  const colors = new Float32Array([
    0.25, 0.5, 0.75, 1,
    0.125, 0.625, 0.875, 1,
  ]);
  const emissiveMat = { vertexColorMode: VCM_MWT2.Emission, diffuse: [0, 0, 0], ambient: [0, 0, 0], emissive: [0.5, 0.5, 0.5] };
  // THE SUBSTITUTION, both ways round on the SAME material: the vertex
  // colour answers for the emission and NOT for the diffuse.
  assert.deepEqual(emissiveAt_MWT2(emissiveMat, colors, 0), [0.25, 0.5, 0.75]);
  assert.deepEqual(emissiveAt_MWT2(emissiveMat, colors, 1), [0.125, 0.625, 0.875]);
  assert.deepEqual(diffuseAt_MWT2(emissiveMat, colors, 0), [0, 0, 0],
    'the diffuse stays the black LightMode_Emissive forced on it - substituting there is rule 63 backwards');
  // A DIFFUSE-mode mesh is the mirror image: its colours are the diffuse,
  // and its emission is the material's.
  const plain = { vertexColorMode: VCM_MWT2.Diffuse, diffuse: [1, 0, 0], ambient: [0, 0, 0], emissive: [0, 0, 0] };
  assert.deepEqual(diffuseAt_MWT2(plain, colors, 1), [0.125, 0.625, 0.875]);
  assert.deepEqual(emissiveAt_MWT2(plain, colors, 1), [0, 0, 0], 'no emission mode, no substitution');
  // The material's own emissive, with no colours at all and with a mode
  // that does not name it.
  assert.deepEqual(emissiveAt_MWT2({ vertexColorMode: VCM_MWT2.None, emissive: [0.25, 0.5, 1] }, null, 0), [0.25, 0.5, 1]);
  assert.deepEqual(emissiveAt_MWT2({ vertexColorMode: VCM_MWT2.Emission, emissive: [0.25, 0.5, 1] }, null, 0), [0.25, 0.5, 1],
    'the mode names the colours and there are none - the material answers');
  // No material at all is NO light, never white: an untextured surface
  // starts at white DIFFUSE (the reference's own default) and at zero
  // emission, and getting this one backwards would make every mesh glow.
  assert.deepEqual(emissiveAt_MWT2(null, colors, 0), [0, 0, 0]);
  // ...and a material object carrying no emissive field at all is zero
  // too, never a throw: this channel's absence must not cost a frame,
  // and a missing glow is the safe direction where a thrown pack is a
  // rig that does not draw at all.
  assert.deepEqual(emissiveAt_MWT2({ vertexColorMode: VCM_MWT2.None, diffuse: [1, 0, 0] }, colors, 0), [0, 0, 0]);
  assert.deepEqual(emissiveAt_MWT2({ vertexColorMode: VCM_MWT2.Emission }, null, 0), [0, 0, 0]);
  assert.deepEqual(diffuseAt_MWT2(null, colors, 0), [1, 1, 1]);
});

test('MWT2 the emission reaches the GPU: the arm pack carries it per vertex and the character program has a channel and a term for it (mutant: the pack width left at 11, so the UVs and the emission read each other’s floats)', () => {
  const arm = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');
  const rend = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  // The pack got THREE floats wider, and the width is one constant.
  assert.match(arm, /export const FP_FLOATS = 14;/);
  // PERF-RIG1: the emission is resolved once per piece into the lane
  // buffer (the last three of a corner's eight static floats) and the
  // frame copies it into the last three of the corner's fourteen.
  assert.match(arm, /const \[er, eg, eb\] = emissiveAt\(mat, cols, idx\[i\]\);\s*\n\s*lanes\[l\+\+\] = er; lanes\[l\+\+\] = eg; lanes\[l\+\+\] = eb;/);
  assert.match(arm, /buf\[o\+\+\] = lanes\[l \+ 5\]; buf\[o\+\+\] = lanes\[l \+ 6\]; buf\[o\+\+\] = lanes\[l \+ 7\];/);
  assert.match(arm, /const LANE_FLOATS = 8;/);
  // The attribute is ADDITIVE, as MW-D11's UV channel was: a VAO that
  // never enables it reads the constant, which is zero emission - so
  // every voxel caller (characters/engineRig.js passes no opts at all)
  // draws exactly what it drew before.
  assert.match(rend, /layout\(location=4\) in vec3 aEmissive;/);
  assert.match(rend, /const emissive = uv && opts\.emissive !== false;/);
  assert.match(rend, /const floats = uv \? \(emissive \? 14 : 11\) : 9;/);
  assert.match(rend, /gl\.vertexAttribPointer\(4, 3, gl\.FLOAT, false, stride, 44\);/,
    'three floats at 44 - after the position, colour, normal and UV');
  assert.match(arm, /import \{ diffuseAt, emissiveAt \} from '\.\.\/formats\/mwNifMesh\.js';/, 'the pack takes BOTH halves from the one home');
  // THE TERM, and where it sits: times the texel and nothing else. The
  // vertex colour must NOT gate it - LightMode_Emissive has already
  // forced that colour to black, which is the whole bug.
  assert.match(rend, /lit \+= vEmissive \* texel\.rgb;/);
  assert.doesNotMatch(rend, /lit \+= albedo \* vEmissive/, 'gating the emission on the albedo is the black flame again');
  // ...and it is the LAST term, after every light, so nothing dims it.
  assert.ok(rend.indexOf('lit += vEmissive * texel.rgb;') > rend.indexOf('lit += albedo * pointAcc;'),
    'the emission is added after the lights, not into them');
  // C4b's note said "no emission" and was true of the voxel rigs alone.
  assert.doesNotMatch(rend, /C4b - no emission/, 'the note that made this a rule was retired with the hole');
});

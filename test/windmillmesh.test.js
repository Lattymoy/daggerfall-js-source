import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROTOR } from '../src/world/windmillMesh.js';
import { parseCollada } from '../scripts/bakeWindmill.mjs';
import { ROTOR_AXIS } from '../src/world/windmills.js';

// W2a - THE ROTOR GEOMETRY, VENDORED WITH PERMISSION AND BAKED.
//
// W1 shipped the law and could not answer the mesh: which models carry a
// rotor and where its hub sits are ARCH3D.BSA questions, and the container
// has no ARENA2. Kamer's permission answered it a different way - his mod
// already SEPARATES the sail from the tower, so the split W2 needed was
// made by the art and no geometric guess is required at all.
//
// These pins hold the three things that could go wrong quietly: the baked
// file drifting from the vendored source, the geometry arriving in the
// wrong space, and Daggerfall's own art getting into the repo alongside it.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(root, 'vendor/windmills-kamer');

test('W2a: the baked rotor is what the vendored .dae says, re-derived', () => {
  // The bakeBooks shape: the test does the bake again and compares, so a
  // hand-edited src/world/windmillMesh.js fails instead of shipping
  // geometry nobody derived from the source.
  const m = parseCollada(readFileSync(join(VENDOR, 'Blade.dae'), 'utf8'));
  assert.deepEqual([...ROTOR.positions], m.positions.map((v) => Math.fround(+v.toFixed(6))));
  assert.deepEqual([...ROTOR.indices], m.indices);
  assert.deepEqual(ROTOR.subMeshes.map((s) => ({ ...s })), m.subMeshes);
  assert.equal(ROTOR.flatAxis, m.flatAxis);
});

test('W2a: the sail is flat in the axis the rotor law turns about', () => {
  // The law came first and assumed Z from Kamer's Spin_Up.cs. The geometry
  // arrived afterwards and has to agree, or one of the two is wrong.
  assert.equal(ROTOR.flatAxis, ROTOR_AXIS);
  const span = [0, 1, 2].map((a) => ROTOR.bounds.max[a] - ROTOR.bounds.min[a]);
  const thin = span.indexOf(Math.min(...span));
  assert.equal('xyz'[thin], ROTOR_AXIS, `spans ${span} - the sail is not flat in ${ROTOR_AXIS}`);
  // ...and flat by a real margin, not by a rounding error.
  assert.ok(span[0] > span[thin] * 8 && span[1] > span[thin] * 8,
    `the sail is only ${span[thin]} thin against ${span[0]}x${span[1]} - is this a sail?`);
});

test('W2a: the hub IS the origin, so the spin needs no offset', () => {
  // windmills.rotorMatrix conjugates about a hub point. If the sail were
  // modelled off-origin, every caller would need to know its centre and
  // the wiring slice would be guessing at one.
  for (let a = 0; a < 3; a++) {
    const centre = (ROTOR.bounds.min[a] + ROTOR.bounds.max[a]) / 2;
    const half = (ROTOR.bounds.max[a] - ROTOR.bounds.min[a]) / 2;
    assert.ok(Math.abs(centre) < half * 0.1,
      `axis ${'xyz'[a]} is centred at ${centre}, not the origin - the hub is not [0,0,0]`);
  }
});

test('W2a: the mesh is well formed - every index lands, every triangle is claimed', () => {
  const vertexCount = ROTOR.positions.length / 3;
  assert.equal(ROTOR.normals.length / 3, vertexCount, 'a vertex is missing its normal');
  assert.equal(ROTOR.uvs.length / 2, vertexCount, 'a vertex is missing its uv');
  assert.equal(ROTOR.indices.length % 3, 0);
  for (const i of ROTOR.indices) {
    assert.ok(i >= 0 && i < vertexCount, `index ${i} is outside 0..${vertexCount - 1}`);
  }
  // The submeshes must account for the whole index buffer, contiguously:
  // a gap draws nothing and an overlap draws twice.
  let at = 0;
  for (const sm of ROTOR.subMeshes) {
    assert.equal(sm.startIndex, at, 'submeshes are not contiguous from 0');
    at += sm.primitiveCount * 3;
  }
  assert.equal(at, ROTOR.indices.length, 'the submeshes do not cover the index buffer');
});

test('W2a: the rotor names CLASSIC textures and carries none of them', () => {
  // The whole reason no .PNG came across: these are (archive, record)
  // pairs the port already loads from the player's own ARENA2.
  assert.ok(ROTOR.subMeshes.length > 0);
  for (const sm of ROTOR.subMeshes) {
    assert.ok(Number.isInteger(sm.textureArchive) && sm.textureArchive >= 0);
    assert.ok(Number.isInteger(sm.textureRecord) && sm.textureRecord >= 0);
  }
  const baked = readFileSync(join(root, 'src/world/windmillMesh.js'), 'utf8');
  assert.doesNotMatch(baked, /base64|data:image/, 'image data was baked into the mesh module');
});

test('W2a: no Daggerfall art was vendored beside the geometry', () => {
  // The doctrine's second non-negotiable, at the one door this slice
  // opened. The mod ships 20-odd PNG exports of classic textures; the
  // author's permission does not reach them, because they are not his.
  const files = readdirSync(VENDOR);
  const art = files.filter((f) => /\.(png|jpe?g|gif|bmp|dds|tga|img|cif|bsa)$/i.test(f));
  assert.deepEqual(art, [], `Daggerfall art in vendor/windmills-kamer: ${art.join(', ')}`);
  assert.ok(files.includes('README.md'), 'vendored third-party work with no attribution README');
  const readme = readFileSync(join(VENDOR, 'README.md'), 'utf8');
  assert.match(readme, /Kamer/, 'the README must name the author');
  assert.match(readme, /[Pp]ermission/, 'the README must record the permission that admits these files');
});

test('W2a: a differently-rotated re-export FAILS the bake rather than baking sideways', () => {
  // The bake applies no transform, on the ground that this export's node
  // matrix composed with Z-up-to-Y-up is the identity. That is only safe
  // while the matrix is the expected one - so it is asserted, not assumed.
  const src = readFileSync(join(VENDOR, 'Blade.dae'), 'utf8');
  const rotated = src.replace(/<matrix sid="transform">[^<]+<\/matrix>/,
    '<matrix sid="transform">1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1</matrix>');
  assert.notEqual(rotated, src, 'the fixture no longer patches the node matrix');
  assert.throws(() => parseCollada(rotated), /node matrix differs/,
    'a re-export with a different object rotation would bake sideways silently');
});

test('W2a: the reader REFUSES a mesh it does not fully understand', () => {
  // A permissive COLLADA reader that skipped an input it did not know
  // would bake a mesh with no normals and say nothing.
  const src = readFileSync(join(VENDOR, 'Blade.dae'), 'utf8');
  assert.throws(() => parseCollada(src.replace(/<input semantic="NORMAL"[^>]*\/>/g, '')),
    /no NORMAL input/);
  assert.throws(() => parseCollada(src.replace(/TEXTURE[._]\d+[._]\d+/g, 'SomeModTexture')),
    /names no classic texture/,
    'a texture that is not a classic archive/record must not bake - we cannot ship the file it wants');
});

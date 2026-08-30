import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseNif, deref, TEX_SLOT, MW_NIF_VERSION } from '../src/formats/mwNifFile.js';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';

// Fixtures are authored by pyffi (independent NIF implementation) via
// test/fixtures/mw/generate.py - the values pinned here are the values fed
// to that script.
const MESH = new Uint8Array(readFileSync(new URL('./fixtures/mw/mesh.nif', import.meta.url)));
const SKINNED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/skinned.nif', import.meta.url)),
);

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('mwnif: static mesh - graph, geometry, material, texturing', () => {
  const nif = parseNif(MESH);
  assert.equal(nif.version, MW_NIF_VERSION);
  assert.equal(nif.roots.length, 1);

  const root = deref(nif, nif.roots[0]);
  assert.equal(root.type, 'NiNode');
  assert.equal(root.name, 'Root');
  assert.equal(root.children.length, 1);

  const tri = deref(nif, root.children[0]);
  assert.equal(tri.type, 'NiTriShape');
  assert.equal(tri.name, 'Quad');
  assert.deepEqual(tri.translation, [1, 2, 3]);
  assert.ok(near(tri.scale, 1));
  // Identity rotation, row-major.
  assert.deepEqual(Array.from(tri.rotation), [1, 0, 0, 0, 1, 0, 0, 0, 1]);

  const d = deref(nif, tri.data);
  assert.equal(d.type, 'NiTriShapeData');
  assert.equal(d.numVertices, 4);
  assert.deepEqual(Array.from(d.vertices), [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  assert.deepEqual(Array.from(d.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(
    Array.from(d.colors),
    [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0.5],
  );
  assert.equal(d.uvSets.length, 1);
  assert.deepEqual(Array.from(d.uvSets[0]), [0, 0, 1, 0, 1, 1, 0, 1]);
  assert.equal(d.numTriangles, 2);
  assert.deepEqual(Array.from(d.triangles), [0, 1, 2, 0, 2, 3]);
  // pyffi's update_center_radius over the unit quad.
  assert.ok(near(d.center[0], 0.5) && near(d.center[1], 0.5) && near(d.center[2], 0));
  assert.ok(near(d.radius, Math.SQRT1_2, 1e-5));

  const [mat, texp] = tri.properties.map((r) => deref(nif, r));
  assert.equal(mat.type, 'NiMaterialProperty');
  assert.equal(mat.name, 'Mat');
  assert.deepEqual(mat.ambient.map((v) => Math.round(v * 10) / 10), [0.1, 0.2, 0.3]);
  assert.deepEqual(mat.diffuse, [1, 0.5, 0.25]);
  assert.ok(near(mat.glossiness, 10) && near(mat.alpha, 0.8, 1e-6));

  assert.equal(texp.type, 'NiTexturingProperty');
  assert.equal(texp.applyMode, 2);
  assert.equal(texp.textures.length, 7);
  const base = texp.textures[TEX_SLOT.base];
  assert.ok(base && base.clampMode === 3 && base.filterMode === 2 && base.uvSet === 0);
  const src = deref(nif, base.source);
  assert.equal(src.type, 'NiSourceTexture');
  assert.equal(src.external, true);
  assert.equal(src.fileName, 'textures\\fixture.dds');
});

test('mwnif: skinned mesh - instance, bones, weights', () => {
  const nif = parseNif(SKINNED);
  const root = deref(nif, nif.roots[0]);
  assert.equal(root.name, 'SkinRoot');
  const tri = root.children.map((r) => deref(nif, r)).find((r) => r.type === 'NiTriShape');
  assert.equal(tri.name, 'Skinned');

  const si = deref(nif, tri.skin);
  assert.equal(si.type, 'NiSkinInstance');
  assert.equal(deref(nif, si.skeletonRoot), root);
  assert.equal(si.bones.length, 2);
  assert.equal(deref(nif, si.bones[0]).name, 'Bone0');
  assert.equal(deref(nif, si.bones[1]).name, 'Bone1');
  assert.ok(near(deref(nif, si.bones[1]).translation[2], 1));

  const sd = deref(nif, si.data);
  assert.equal(sd.type, 'NiSkinData');
  assert.equal(sd.partitions, -1);
  assert.equal(sd.bones.length, 2);
  assert.deepEqual(Array.from(sd.bones[0].indices), [0, 1, 2]);
  assert.deepEqual(
    Array.from(sd.bones[0].weights).map((w) => Math.round(w * 100) / 100),
    [1, 1, 0.4],
  );
  assert.deepEqual(Array.from(sd.bones[1].indices), [2, 3]);
  assert.deepEqual(
    Array.from(sd.bones[1].weights).map((w) => Math.round(w * 100) / 100),
    [0.6, 1],
  );
});

test('mwnif: strictness - junk, wrong version, unimplemented types throw', () => {
  assert.throws(() => parseNif(new Uint8Array(64)), /missing header line|bad header/);
  const wrongVer = Uint8Array.from(MESH);
  // Version dword sits right after the 0x0A header terminator.
  const nl = wrongVer.indexOf(0x0a);
  wrongVer[nl + 1] = 0x03;
  assert.throws(() => parseNif(wrongVer), /unsupported version/);
});

// ---------------------------------------------------------------------------
// Real-data sweep - MW_DATA_PATH gate, same pattern as ARENA2_PATH. Walks
// every mesh in the retail archive. Slice 1 implements the static
// geometry/skin/property set only, so files carrying controller, particle,
// pixel-data etc. records are EXPECTED to fail - but only ever with the
// reader's own "unimplemented record type" error naming a plausible NIF
// type token. Anything else (garbage type names = stream misalignment,
// range errors = layout bugs) fails the test. The clean-parse floor
// ratchets up as later slices land record coverage.
// ---------------------------------------------------------------------------

const MW = process.env.MW_DATA_PATH;
const retailBsa = MW ? join(MW, 'Morrowind.bsa') : null;
const skipReal =
  !retailBsa || !existsSync(retailBsa)
    ? 'MW_DATA_PATH not set or Morrowind.bsa missing - real-data validation skipped'
    : false;

test('mwnif: retail mesh sweep - no layout faults', { skip: skipReal }, () => {
  const bsa = new MwBsaFile(new Uint8Array(readFileSync(retailBsa)));
  const meshes = bsa.list().filter((n) => n.endsWith('.nif'));
  assert.ok(meshes.length > 500, `mesh count ${meshes.length}`);

  const unimplemented = new Map();
  let clean = 0;
  const faults = [];
  for (const name of meshes) {
    try {
      parseNif(bsa.get(name));
      clean++;
    } catch (err) {
      const m = /unimplemented record type "([^"]+)"/.exec(err.message);
      // A real NIF type token; anything else means the stream went sideways.
      if (m && /^(Ni|Root|Avoid|BS)[A-Za-z0-9]*$/.test(m[1])) {
        unimplemented.set(m[1], (unimplemented.get(m[1]) ?? 0) + 1);
      } else {
        faults.push(`${name}: ${err.message}`);
      }
    }
  }
  const histo = [...unimplemented.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`mwnif retail sweep: ${clean}/${meshes.length} clean;`, histo.slice(0, 12));
  assert.deepEqual(faults.slice(0, 5), [], `${faults.length} layout faults`);
  // MEASURED floor: slice-1 record set. Raise with each coverage slice.
  assert.ok(clean / meshes.length > 0.3, `clean ratio ${(clean / meshes.length).toFixed(2)}`);
});

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

test('MW-D15 rule 34: record 0\'s transform is DISCARDED unless it is a NiNode named "bip01"', async () => {
  //   if (mRecordIndex == 0 && !ciEqual(mName, "bip01"))
  //       mTransform = NiTransform::getIdentity();      nif/node.cpp:188-191
  //
  // It happens IN THE PARSER, so no consumer can opt out, and the doc
  // marks it CRITICAL. Three fixtures, because the rule has three
  // answers and a port can get any one of them right on its own.
  const { flattenNif } = await import('../src/formats/mwNifMesh.js');
  const at = (name) => [...flattenNif(parseNif(f(name)))[0].positions.slice(0, 3)];

  // (1) A root NiNode NOT named bip01: the whole transform goes, scale
  // included, and the shape sits where it was authored.
  const wiped = parseNif(f('rootxform.nif'));
  assert.equal(wiped.records[0].type, 'NiNode');
  assert.equal(wiped.records[0].name, 'NotBip01');
  assert.deepEqual([...wiped.records[0].translation], [0, 0, 0]);
  assert.equal(wiped.records[0].scale, 1, 'the SCALE is part of the transform too');
  assert.deepEqual([...wiped.records[0].rotation], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(at('rootxform.nif'), [0, 0, 0]);

  // (2) THE OTHER HALF, which a port that zeroes unconditionally breaks:
  // a root named Bip01 KEEPS its transform. Every Morrowind skeleton has
  // one, and it is also why rule 56 can find "bip01" as a real transform
  // node later.
  const kept = parseNif(f('rootbip.nif'));
  assert.deepEqual([...kept.records[0].translation], [100, 200, 300]);
  assert.equal(kept.records[0].scale, 2);
  assert.deepEqual(at('rootbip.nif'), [100, 200, 300]);

  // (3) "Only for NiNode-s for now": a NiTriShape at index 0 keeps its
  // transform, whatever it is called.
  const shape = parseNif(f('rootshape.nif'));
  assert.equal(shape.records[0].type, 'NiTriShape');
  assert.deepEqual([...shape.records[0].translation], [100, 200, 300]);
  assert.deepEqual(at('rootshape.nif'), [100, 200, 300]);

  // The name test is case-INSENSITIVE, and it is on record 0 rather than
  // on "a root" - the reference's own FIXME says so.
  const arm = parseNif(f('armfp.nif'));
  assert.equal(arm.records[0].name, 'Bip01');
});

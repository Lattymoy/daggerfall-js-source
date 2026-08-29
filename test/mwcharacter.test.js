import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import {
  buildSkeleton,
  poseSkeleton,
  skeletonSpaceMatrices,
  skinBatch,
} from '../src/formats/mwSkin.js';
import { bindPart, attachmentTransform } from '../src/formats/mwCharacter.js';

const ANIMATED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)),
);
const PART = new Uint8Array(readFileSync(new URL('./fixtures/mw/part.nif', import.meta.url)));

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, e, eps = 1e-5) => v.every((x, i) => near(x, e[i], eps));

function assemble() {
  const baseNif = parseNif(ANIMATED);
  const skeleton = buildSkeleton(baseNif);
  const part = bindPart(skeleton, parseNif(PART), { attachBone: 'Bone1' });
  return { baseNif, skeleton, part };
}

test('mwcharacter: part skin rebinds onto the BASE skeleton by bone name', () => {
  const { baseNif, skeleton, part } = assemble();
  assert.equal(part.skinned.length, 1);
  const skin = part.skinned[0].skin;
  // The refs now point at the base's nodes, found by name...
  assert.equal(skin.bones[0].ref, skeleton.byName.get('bone0'));
  assert.equal(skin.bones[1].ref, skeleton.byName.get('bone1'));
  // ...and those really are the base file's records, not the part's.
  assert.equal(baseNif.records[skin.bones[0].ref].name, 'Bone0');
  // Part's "SkinRoot"-less root name doesn't exist in the base;
  // rebinding fell back to the base skeleton's own root.
  assert.equal(skeleton.nodes.get(skin.skeletonRoot).parent, -1);
});

test('mwcharacter: assembled bind pose round-trips the part verts', () => {
  const { skeleton, part } = assemble();
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const mats = skeletonSpaceMatrices(skeleton, pose, part.skinned[0].skin.skeletonRoot);
  const out = new Float32Array(part.skinned[0].positions.length);
  skinBatch(part.skinned[0], skeleton, pose, mats, out, null);
  assert.ok(nearVec(Array.from(out), [0.5, 0, 0, 1.5, 0, 0, 0.5, 0, 1]));
});

test('mwcharacter: one pose drives base and part alike - hand-computed', () => {
  const { baseNif, skeleton, part } = assemble();
  const tracks = extractTracks(baseNif);
  // End of Move: Bone0 turned 90deg about Z, Bone1 at z=2.
  const pose = poseSkeleton(skeleton, tracks, sampleTrack, 1.5);
  const mats = skeletonSpaceMatrices(skeleton, pose, part.skinned[0].skin.skeletonRoot);
  const out = new Float32Array(part.skinned[0].positions.length);
  skinBatch(part.skinned[0], skeleton, pose, mats, out, null);
  // v0 (0.5,0,0) on Bone0: quarter turn -> (0,0.5,0).
  assert.ok(nearVec([out[0], out[1], out[2]], [0, 0.5, 0]));
  // v1 (1.5,0,0) on Bone0 -> (0,1.5,0).
  assert.ok(nearVec([out[3], out[4], out[5]], [0, 1.5, 0]));
  // v2 (0.5,0,1) on Bone1: rides z 1 -> 2.
  assert.ok(nearVec([out[6], out[7], out[8]], [0.5, 0, 2]));
});

test('mwcharacter: unskinned parts attach at the named bone, posed', () => {
  const { baseNif, skeleton, part } = assemble();
  assert.equal(part.attached.length, 1);
  assert.equal(part.attached[0].name, 'Hat');
  // The hat's geometry stayed part-root relative (its node sits at z=.2).
  assert.ok(near(part.attached[0].positions[2], 0.2));
  const tracks = extractTracks(baseNif);
  const pose = poseSkeleton(skeleton, tracks, sampleTrack, 1.5);
  const mats = skeletonSpaceMatrices(skeleton, pose, part.skinned[0].skin.skeletonRoot);
  const at = attachmentTransform(mats, part.attachRef);
  // Bone1 sits at z=2 at Move's end; hat vert 0 lands at 0.2 + 2.
  const z = at.a[6] * 0 + at.a[7] * 0 + at.a[8] * part.attached[0].positions[2] + at.t[2];
  assert.ok(near(z, 2.2));
});

test('mwcharacter: a part naming a bone the skeleton lacks throws with the name', () => {
  const { skeleton } = assemble();
  const rogue = parseNif(PART);
  // Rename the part's second bone to something the base has never heard of.
  rogue.records.find((r) => r.name === 'Bone1').name = 'Tail3';
  assert.throws(() => bindPart(skeleton, rogue), /no bone "tail3"/);
});

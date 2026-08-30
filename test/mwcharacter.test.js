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
import { GRAPH_ROOT } from '../src/formats/mwSkin.js';

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
  // MW-D20: a rebound part lives in GRAPH SPACE, always. The old
  // behaviour - resolve the part's declared root NAME into the base and
  // make matrices relative to whatever answered - was a port invention:
  // the reference looks that name up on the copied rig's own render
  // path, where a base bone can never appear, so its bone matrices stay
  // in the one space below the Skeleton group (riggeometry.cpp:288-324).
  assert.equal(skin.skeletonRoot, GRAPH_ROOT);
  assert.equal(skin.rootBone, GRAPH_ROOT);
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

test('mwcharacter rule 40: a bone the skeleton lacks is SKIPPED with its name, never fatal', () => {
  // The pin that stood here asserted the DEFECT in as many words: it
  // demanded the throw. The reference logs "RigGeometry did not find
  // bone", stores nullptr, and skips the influences - it draws the part.
  // A port that threw instead dropped a whole retail hand over one
  // absent finger bone.
  const { skeleton } = assemble();
  const rogue = parseNif(PART);
  // Rename the part's second bone to something the base has never heard of.
  rogue.records.find((r) => r.name === 'Bone1').name = 'Tail3';
  const part = bindPart(skeleton, rogue);
  assert.deepEqual(part.missingBones, ['tail3'], 'the caller is told WHICH bone was skipped');
  assert.equal(part.skinned.length, 1, 'the part still binds');
  const skin = part.skinned[0].skin;
  assert.equal(skin.bones.find((b) => b.name === 'tail3').ref, null, 'the missing bone rides as null');
  assert.equal(skin.bones.find((b) => b.name === 'bone0').ref, skeleton.byName.get('bone0'),
    'and the present one still resolves');
});

test('mwcharacter rule 40: the blend SKIPS a missing bone - and a vertex weighted only to one COLLAPSES, reference-exact', () => {
  const { skeleton } = assemble();
  const rogue = parseNif(PART);
  rogue.records.find((r) => r.name === 'Bone1').name = 'Tail3';
  const part = bindPart(skeleton, rogue);
  // A non-identity skin transform, so the collapse target is DISTINCT
  // from the origin and the pin can tell "the transform's translation"
  // from "zero" - the fixture's own identity transform could not.
  const batch = {
    ...part.skinned[0],
    skin: {
      ...part.skinned[0].skin,
      transform: { ...part.skinned[0].skin.transform, translation: [3, 4, 5] },
    },
  };
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(batch, skeleton, pose, mats, out, null);
  // v0/v1 ride Bone0, shifted by the transform like any healthy vertex -
  // no renormalisation, no disturbance from the miss (rule 39).
  assert.ok(nearVec([out[0], out[1], out[2]], [3.5, 4, 5]));
  assert.ok(nearVec([out[3], out[4], out[5]], [4.5, 4, 5]));
  // v2 was weighted ONLY to the missing bone. The reference seeds the
  // blend accumulator at ZERO (riggeometry.cpp:191) and skips nullptr
  // bones (:195-196), so the vertex lands on the skin transform's BARE
  // TRANSLATION - (3,4,5), NOT its authored position and NOT the origin.
  // Faithful and ugly on purpose: the collapse is what the reference
  // draws, and the missing-bone note is what names it.
  assert.ok(nearVec([out[6], out[7], out[8]], [3, 4, 5]));
  // A vertex with NO influences at all is a DIFFERENT case (rule 39's
  // erased-empty-set keeps the authored position) - pinned below.
});

test('mwcharacter rule 39: a vertex with NO influences at all keeps its authored position', () => {
  // The two do-nothing cases must not be conflated: influences that all
  // name a MISSING bone collapse (above); no influences AT ALL keeps the
  // authored position. The batch is the producer's own, with v2's one
  // weight surgically removed rather than hand-built.
  const { skeleton, part } = assemble();
  const batch = part.skinned[0];
  const b1 = batch.skin.bones[1];
  const surgical = {
    ...batch,
    skin: { ...batch.skin, bones: [batch.skin.bones[0], { ...b1, indices: [], weights: [] }] },
  };
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const mats = skeletonSpaceMatrices(skeleton, pose, surgical.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(surgical, skeleton, pose, mats, out, null);
  assert.ok(nearVec([out[6], out[7], out[8]], [0.5, 0, 1]),
    'v2, now weightless, keeps (0.5, 0, 1) - it does not collapse and does not vanish');
});

test('mwcharacter rule 16: duplicate bone names go to the FIRST, not the last', () => {
  // The reference's bone cache is filled with emplace, which never
  // overwrites (skeleton.cpp:23-29). A Map.set answered the LAST
  // duplicate - on a retail rig with a duplicated attach bone that
  // hangs the weapon on the wrong copy of the name.
  const nif = parseNif(ANIMATED);
  // Rename a LATER-visited node to collide with Bone0's name; the
  // lookup must keep answering the original.
  const b0 = nif.records.findIndex((r) => r.name === 'Bone0');
  const b1 = nif.records.findIndex((r) => r.name === 'Bone1');
  assert.ok(b0 >= 0 && b1 >= 0 && b1 > -1);
  nif.records[b1].name = 'Bone0';
  const skel = buildSkeleton(nif);
  assert.equal(skel.byName.get('bone0'), b0,
    `the first Bone0 (record ${b0}) wins over the renamed later one (record ${b1})`);
});

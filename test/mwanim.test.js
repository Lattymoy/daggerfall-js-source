import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif, KEY_TYPE } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import {
  collectTextKeys,
  parseAnimGroups,
  extractTracks,
  sampleTrack,
} from '../src/formats/mwAnim.js';
import {
  buildSkeleton,
  poseSkeleton,
  skeletonSpaceMatrices,
  skinToSkelMatrix,
  skinBatch,
} from '../src/formats/mwSkin.js';

const ANIMATED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)),
);
const KF = new Uint8Array(readFileSync(new URL('./fixtures/mw/xfixture.kf', import.meta.url)));
const SKINNED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/skinned.nif', import.meta.url)),
);

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, e, eps = 1e-5) => v.every((x, i) => near(x, e[i], eps));

test('mwanim: inline tracks - bones, timing, exact key values', () => {
  const nif = parseNif(ANIMATED);
  const tracks = extractTracks(nif);
  assert.deepEqual([...tracks.keys()].sort(), ['bone0', 'bone1']);
  const b0 = tracks.get('bone0');
  assert.equal(b0.rotationType, KEY_TYPE.linear);
  assert.equal(b0.rotationKeys.length, 2);
  assert.ok(near(b0.rotationKeys[1].time, 1.5));
  assert.ok(nearVec(b0.rotationKeys[1].value, [Math.SQRT1_2, 0, 0, Math.SQRT1_2], 1e-6));
  const b1 = tracks.get('bone1');
  assert.equal(b1.translations.type, KEY_TYPE.linear);
  assert.deepEqual(
    b1.translations.keys.map((k) => [k.time, ...k.value]),
    [
      [0.5, 0, 0, 1],
      [1.5, 0, 0, 2],
    ],
  );
  assert.ok(near(b1.startTime, 0) && near(b1.stopTime, 1.5));
});

test('mwanim: text keys become named groups; multi-line keys split', () => {
  const groups = parseAnimGroups(collectTextKeys(parseNif(ANIMATED)));
  assert.deepEqual([...groups.keys()].sort(), ['Idle', 'Move']);
  const flat = ({ start, stop, loopStart, loopStop }) => ({ start, stop, loopStart, loopStop });
  assert.deepEqual(flat(groups.get('Idle')), { start: 0, stop: 0.5, loopStart: null, loopStop: null });
  assert.deepEqual(flat(groups.get('Move')), { start: 0.5, stop: 1.5, loopStart: null, loopStop: null });
  // Retail packs several markers into one key's text.
  const packed = parseAnimGroups([
    { time: 0, text: 'SoundGen: Left\r\nWalk: Start' },
    { time: 2, text: 'Walk: Loop Stop\nWalk: Stop' },
    { time: 0.5, text: 'Walk: Loop Start' },
  ]);
  const w = packed.get('Walk');
  assert.deepEqual([w.start, w.stop, w.loopStart, w.loopStop], [0, 2, 0.5, 2]);
  // Every marker is retained for the FP layer's sub-segments.
  assert.equal(w.markers.get('loop start'), 0.5);
});

test('mwanim: linear sampling - lerp midpoint, slerp half-angle', () => {
  const tracks = extractTracks(parseNif(ANIMATED));
  const mid1 = sampleTrack(tracks.get('bone1'), 1.0);
  assert.ok(nearVec(mid1.translation, [0, 0, 1.5]));
  const mid0 = sampleTrack(tracks.get('bone0'), 1.0);
  // Halfway to 90 deg about Z: 45 deg -> (cos 22.5, 0, 0, sin 22.5).
  assert.ok(nearVec(mid0.rotation, [Math.cos(Math.PI / 8), 0, 0, Math.sin(Math.PI / 8)], 1e-6));
  // Clamped outside the keys.
  assert.ok(nearVec(sampleTrack(tracks.get('bone1'), 0).translation, [0, 0, 1]));
  assert.ok(nearVec(sampleTrack(tracks.get('bone1'), 9).translation, [0, 0, 2]));
});

test('mwanim: quadratic keys run the stored Hermite tangents', () => {
  const track = {
    rotationType: 0,
    rotationKeys: [],
    xyzRotations: null,
    translations: { type: 0, keys: [] },
    scales: {
      type: KEY_TYPE.quadratic,
      keys: [
        { time: 0, value: 0, forward: 3, backward: 0 },
        { time: 1, value: 1, forward: 0, backward: 0 },
      ],
    },
  };
  // h(0.5): 0.5*v1 + 0.125*out0 = 0.5 + 0.375 = 0.875.
  assert.ok(near(sampleTrack(track, 0.5).scale, 0.875));
});

test('mwanim: TBC keys generate Kochanek-Bartels tangents (t=c=b=0 is Catmull-Rom)', () => {
  const track = {
    rotationType: 0,
    rotationKeys: [],
    xyzRotations: null,
    translations: { type: 0, keys: [] },
    scales: {
      type: KEY_TYPE.tbc,
      keys: [
        { time: 0, value: 0, tbc: [0, 0, 0] },
        { time: 1, value: 2, tbc: [0, 0, 0] },
        { time: 2, value: 0, tbc: [0, 0, 0] },
      ],
    },
  };
  // Segment 0 at u=.5: out0 one-sided = 2, in1 = (P2-P0)/2 = 0:
  // 0.5*2 + 0.125*2 = 1.25.
  assert.ok(near(sampleTrack(track, 0.5).scale, 1.25));
  // Peak key returns exactly.
  assert.ok(near(sampleTrack(track, 1), 2) || near(sampleTrack(track, 1).scale, 2));
});

test('mwanim: external .kf maps controllers to bones by the string-extra chain', () => {
  const nif = parseNif(KF);
  const tracks = extractTracks(nif);
  assert.deepEqual([...tracks.keys()], ['bone1']);
  const t = tracks.get('bone1');
  assert.deepEqual(
    t.translations.keys.map((k) => [k.time, ...k.value]),
    [
      [0, 0, 0, 1],
      [1, 0, 0, 3],
    ],
  );
  const groups = parseAnimGroups(collectTextKeys(nif));
  const g = groups.get('Move');
  assert.deepEqual([g.start, g.stop], [0, 1]);
});

test('mwskin: bind pose round-trips the authored vertices exactly', () => {
  const nif = parseNif(SKINNED);
  const batch = flattenNif(nif).find((b) => b.skinned);
  assert.ok(batch.skin && batch.skin.bones.length === 2);
  // Inverse binds carried from NiSkinData: Bone1 maps z -> z-1.
  assert.ok(near(batch.skin.bones[1].invBind.t[2], -1));
  const skeleton = buildSkeleton(nif);
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(batch, skeleton, pose, mats, out, null);
  assert.ok(nearVec(Array.from(out), [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]));
});

test('mwskin: posed skeleton deforms by the weights, hand-computed', () => {
  const nif = parseNif(ANIMATED);
  const batch = flattenNif(nif).find((b) => b.skinned);
  const skeleton = buildSkeleton(nif);
  const tracks = extractTracks(nif);
  // End of Move: Bone1 at z=2 (delta +1), Bone0 turned 90 deg about Z.
  const pose = poseSkeleton(skeleton, tracks, sampleTrack, 1.5);
  const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(batch, skeleton, pose, mats, out, null);
  // v0 (0,0,0) w1.0 Bone0: Rz90 * 0 = 0.
  assert.ok(nearVec([out[0], out[1], out[2]], [0, 0, 0]));
  // v1 (1,0,0) w1.0 Bone0: Rz90 -> (0,1,0).
  assert.ok(nearVec([out[3], out[4], out[5]], [0, 1, 0]));
  // v2 (0,0,1): .4*Rz90(0,0,1) + .6*(z+1) = (0,0,.4)+(0,0,1.2).
  assert.ok(nearVec([out[6], out[7], out[8]], [0, 0, 1.6]));
  // v3 (1,0,1) w1.0 Bone1: z 1->2.
  assert.ok(nearVec([out[9], out[10], out[11]], [1, 0, 2]));
});

test('mwnifmesh addendum: a skinned shape ignores its own node transform', () => {
  // Synthetic: the skinned fixture's graph, but with the trishape moved -
  // NetImmerse does not apply it, so positions stay as authored.
  const nif = parseNif(SKINNED);
  const shape = nif.records.find((r) => r.type === 'NiTriShape');
  shape.translation = [100, 100, 100];
  const batch = flattenNif(nif).find((b) => b.skinned);
  assert.ok(nearVec(Array.from(batch.positions.slice(0, 3)), [0, 0, 0]));
});

test('mwskin: ROTATED inverse bind round-trips - the composition order is provable', () => {
  // The main rig's translation-only binds commute, so the reference
  // order BoneSkel(InvBind(v)) and its reverse both round-tripped there.
  // RotBone rests at Rz(90) then +2x, invBind is the true inverse:
  // the identity holds ONLY in the reference order. v0 (1,0,0):
  //   InvBind: Rz(-90)*v + (0,2,0) = (0,-1,0)+(0,2,0) = (0,1,0)
  //   BoneSkel: Rz(90)*(0,1,0) + (2,0,0) = (-1,0,0)+(2,0,0) = (1,0,0) OK
  // Reversed it lands at (0,3,0) - nowhere near.
  const ROT = new Uint8Array(
    readFileSync(new URL('./fixtures/mw/rotbind.nif', import.meta.url)),
  );
  const nif = parseNif(ROT);
  const batch = flattenNif(nif).find((b) => b.skinned);
  const skeleton = buildSkeleton(nif);
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(batch, skeleton, pose, mats, out, null);
  assert.ok(nearVec(Array.from(out), [1, 0, 0, 2, 0, 0, 1, 1, 0]));
});

test('mwskin: skinToSkelMatrix cancels the chain between skeleton root and skin root', () => {
  // Hand-built: Root -> Mid (Rz90, +10x) -> RootBone (+0,0,5). The
  // skin declares RootBone as its root; skeleton space is Root's.
  // skinToSkel must be inverse(Mid o RootBone):
  //   forward (0,0,0): Mid o RootBone maps origin -> Rz90*(0,0,5)+... 
  //   chain(v) = Mid(RootBone(v)) ; chain(origin) = Mid((0,0,5))
  //     = Rz90*(0,0,5) + (10,0,0) = (10, 0, 5)
  //   so skinToSkel(10,0,5) must return (0,0,0), and skinToSkel of
  //   chain(1,0,0) = Mid((1,0,5)) = (0,1,5)+(10,0,0) = (10,1,5)
  //     must return (1,0,0).
  const I3f = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const rz90 = Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]);
  const mk = (over) => ({
    type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0],
    rotation: I3f, scale: 1, properties: [], children: [], effects: [], ...over,
  });
  const nif = {
    records: [
      mk({ name: 'Root', children: [1] }),
      mk({ name: 'Mid', rotation: rz90, translation: [10, 0, 0], children: [2] }),
      mk({ name: 'RootBone', translation: [0, 0, 5] }),
    ],
    roots: [0],
  };
  const skeleton = buildSkeleton(nif);
  const pose = poseSkeleton(skeleton, null, sampleTrack, 0);
  const m = skinToSkelMatrix(skeleton, pose, 0, 2);
  const apply = (x, y, z) => [
    m.a[0] * x + m.a[1] * y + m.a[2] * z + m.t[0],
    m.a[3] * x + m.a[4] * y + m.a[5] * z + m.t[1],
    m.a[6] * x + m.a[7] * y + m.a[8] * z + m.t[2],
  ];
  assert.ok(nearVec(apply(10, 0, 5), [0, 0, 0]));
  assert.ok(nearVec(apply(10, 1, 5), [1, 0, 0]));
});

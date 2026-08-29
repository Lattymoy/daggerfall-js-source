import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif, KEY_TYPE } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import {
  collectTextKeys,
  parseAnimGroups,
  findAnimGroup,
  extractTracks,
  sampleTrack,
  asciiLower,
  normalizeTextKeys,
  textKeyGroup,
  clipGroups,
  resetClip,
  shouldLoop,
  advanceClip,
} from '../src/formats/mwAnim.js';
import {
  buildSkeleton,
  poseSkeleton,
  skeletonSpaceMatrices,
  skinToSkelMatrix,
  skinBatch,
  accumRootRef,
  trackBinding,
} from '../src/formats/mwSkin.js';

const ANIMATED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)),
);
const KF = new Uint8Array(readFileSync(new URL('./fixtures/mw/xfixture.kf', import.meta.url)));
const SKINNED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/skinned.nif', import.meta.url)),
);
const ARMIDLE = new Uint8Array(readFileSync(new URL('./fixtures/mw/armidle.kf', import.meta.url)));
const ARMSKEL = new Uint8Array(readFileSync(new URL('./fixtures/mw/armskel.nif', import.meta.url)));
// MW-D7: the clip fixture, read through the same door the page uses.
const IDLE_KEYS = normalizeTextKeys(collectTextKeys(parseNif(ARMIDLE)));

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

const FLIGHT = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/xflight.kf', import.meta.url)),
);

test('mwskin: the accumulation root is the topmost tracked bone', () => {
  const nif = parseNif(ANIMATED);
  const skeleton = buildSkeleton(nif);
  const tracks = extractTracks(parseNif(FLIGHT));
  const ref = accumRootRef(skeleton, tracks);
  assert.equal(skeleton.nodes.get(ref).name, 'Bone0');
  // With no tracks there is nothing to accumulate.
  assert.equal(accumRootRef(skeleton, new Map()), null);
});

test('mwskin: root motion extracted - the flight stays under the actor', () => {
  // xflight.kf keys a 300-unit Y path into Bone0's translation, the way
  // retail movement groups carry the actor's locomotion (OAAB's bat
  // keys y=1892 the same way - the geometry-all-over-the-place bug).
  const nif = parseNif(ANIMATED);
  const batch = flattenNif(nif).find((b) => b.skinned);
  const skeleton = buildSkeleton(nif);
  const tracks = extractTracks(parseNif(FLIGHT));
  const out = new Float32Array(batch.positions.length);

  // WITHOUT extraction the body flies: v1 rides Bone0 to y=300.
  const wild = poseSkeleton(skeleton, tracks, sampleTrack, 1.0);
  skinBatch(batch, skeleton, wild, skeletonSpaceMatrices(skeleton, wild, batch.skin.skeletonRoot), out, null);
  assert.ok(near(out[4], 300, 1e-3), `unextracted v1.y ${out[4]}`);

  // WITH extraction (reference (1,1,0): X,Y pinned, Z animated) the
  // authored verts come back exactly - the actor moved, the mesh didn't.
  const pinned = poseSkeleton(skeleton, tracks, sampleTrack, 1.0, {
    accumRoot: accumRootRef(skeleton, tracks),
  });
  skinBatch(batch, skeleton, pinned, skeletonSpaceMatrices(skeleton, pinned, batch.skin.skeletonRoot), out, null);
  assert.ok(nearVec(Array.from(out), [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]));
});

// ── MWAUDIT: the group lookup, and why it cannot be case-sensitive ──

test('MWAUDIT: findAnimGroup resolves whatever case the file wrote - the map keeps the original', () => {
  // THE DEFECT: parseAnimGroups lowercases every MARKER and keeps the
  // GROUP name exactly as written, while the first-person layer looked
  // groups up by a hard-coded capitalisation. A file writing `idle1h:`
  // resolved nothing, and a rig with no group to play freezes in its
  // bind pose. OpenMW lowercases group names on the way in for exactly
  // this reason: real data and mods do not agree on case.
  const groups = parseAnimGroups([
    { time: 0, text: 'idle1h: Start' },
    { time: 1, text: 'idle1h: Stop' },
    { time: 2, text: 'WEAPONONEHAND: Start' },
    { time: 3, text: 'WEAPONONEHAND: Stop' },
  ]);
  // the MAP is untouched - the mesh viewer is a coverage scout and
  // must show what the file actually says
  assert.deepEqual([...groups.keys()].sort(), ['WEAPONONEHAND', 'idle1h'],
    'the original spelling survives for display');
  // ...and the lookup answers the canonical name the port asks with
  assert.ok(findAnimGroup(groups, 'Idle1h'), "asked as 'Idle1h', stored as 'idle1h'");
  assert.ok(findAnimGroup(groups, 'WeaponOneHand'), "asked as 'WeaponOneHand', stored upper");
  assert.equal(findAnimGroup(groups, 'Idle1h').stop, 1, 'and it is the right group, not just any');
  // exact case still works, and a real miss is still a miss
  assert.ok(findAnimGroup(groups, 'idle1h'), 'the exact key still resolves');
  assert.equal(findAnimGroup(groups, 'Idle2w'), null, 'a group the file lacks is still absent');
  assert.equal(findAnimGroup(null, 'Idle'), null, 'and a missing map answers null rather than throwing');
});

test('MWAUDIT: the marker half was already case-insensitive - the two halves now agree', () => {
  // The inconsistency was WITHIN one function: markers normalised,
  // group names not. This pins both halves so neither can drift back.
  const g = parseAnimGroups([
    { time: 0, text: 'Walk: START' },
    { time: 1, text: 'Walk: Loop Start' },
    { time: 5, text: 'Walk: sToP' },
  ]);
  const w = findAnimGroup(g, 'walk');
  assert.equal(w.start, 0, 'START');
  assert.equal(w.stop, 5, 'sToP');
  assert.equal(w.loopStart, 1, 'Loop Start');
});

// --- MW-D7: THE CLIP LAW ---------------------------------------------------
//
// Every pin below is anchored on the fixture armidle.kf, whose eleven text
// keys were authored one per rule. The fixture is what makes these kills
// real rather than synthetic: a decoy block at [0, 0.5] that a forward
// scan takes, a second group whose name is a prefix of the first, a lone
// CR packing two markers into one key, a trailing period on the stop key,
// and a colon-with-no-space pair that must register no group at all.

test('MW-D7 rule 44: the blob splits on the CHARACTER SET [\\r\\n], not on the pair', () => {
  // The fixture packs "SoundGen: Left\rIdle: Loop Start" into ONE key at
  // t=1.5 with a LONE CR. Split on /\r?\n/ and the whole thing stays one
  // unrecognisable string, the loop key is never seen, and the clip runs
  // start-to-stop forever with no loop window. This is the only path to
  // that key in the fixture, deliberately.
  const at15 = IDLE_KEYS.filter((k) => k.time === 1.5).map((k) => k.text);
  assert.deepEqual(at15, ['soundgen: left', 'idle: loop start'],
    'one record, two keys, SAME time - the multimap is what preserves them');

  // CRLF yields an empty piece between each pair, which the drop handles
  // AFTER the split rather than instead of it.
  const crlf = normalizeTextKeys([{ time: 2, text: 'Idle: Stop\r\nIdle2: Start' }]);
  assert.equal(crlf.length, 2, 'the empty middle piece is dropped, both real ones kept');
  assert.ok(crlf.every((k) => k.time === 2), 'and both stay at the one time');
});

test('MW-D7 rule 45: the fold is a 256-entry ASCII table, not toLowerCase', () => {
  assert.equal(asciiLower('IDLE: START'), 'idle: start');
  // U+212A KELVIN SIGN and U+0130 both fold INTO ASCII under
  // String.prototype.toLowerCase. The reference's table maps only 65-90
  // and leaves every other byte, multibyte included, alone.
  assert.equal(asciiLower('K'), 'K', 'KELVIN SIGN is not folded to k');
  assert.equal('K'.toLowerCase(), 'k', 'which is exactly what the wrong function does');
  assert.equal(asciiLower('İ'), 'İ', 'and dotted capital I is left alone too');
});

test('MW-D7 rule 21: the separator is colon plus ONE SPACE, and the group is the FIRST one', () => {
  assert.equal(textKeyGroup('idle: start'), 'idle');
  assert.equal(textKeyGroup('sneak:start'), null, 'no space, no group - the engine registers nothing');
  assert.equal(textKeyGroup('a: b: c'), 'a', 'find() is the FIRST occurrence');
  // The fixture's Sneak pair uses a bare colon. A port matching on
  // indexOf(':') gains a "sneak" group here AND resolves it to a
  // plausible [3.2, 3.4] range - a wrong animation that plays.
  assert.deepEqual(clipGroups(IDLE_KEYS), ['idle', 'idle1h', 'soundgen'],
    'three groups; "sneak" is NOT one of them');
  assert.equal(resetClip(IDLE_KEYS, 'sneak').ok, false,
    'and asking for it refuses rather than answering [3.2, 3.4]');
});

test('MW-D7 rule 22: the range is found by walking BACKWARDS from the group\'s last key', () => {
  const c = resetClip(IDLE_KEYS, 'Idle');
  assert.equal(c.ok, true);
  // Block A is at [0.0, 0.5] and block B at [1.0, 3.0]. A forward scan
  // takes A, which is a real range, brackets time correctly, and is the
  // wrong animation. undeadwolf_2.nif is why the reference scans back.
  assert.equal(c.startTime, 1, 'the LATER block wins, not the first');
  // "Idle: Stop." - the Scrib's trailing period. An exact stop compare
  // walks past it to block A's 0.5, and then start(1.0) > stop(0.5)
  // refuses the whole clip.
  assert.equal(c.stopTime, 3, 'the stop key is compared TRUNCATED, so a trailing period is tolerated');
  // "idle" must not swallow "idle1h": the ": " check is what separates
  // them. 0.6 and 0.9 are not exact in f32 and read back as
  // 0.6000000238..., so the decoy times get a tolerance where 1.0 / 1.5 /
  // 2.5 / 3.0 are compared exactly.
  assert.ok(near(resetClip(IDLE_KEYS, 'Idle1h').startTime, 0.6));
  assert.ok(near(resetClip(IDLE_KEYS, 'Idle1h').stopTime, 0.9));
  // The group name folds ASCII on the way in, so no case door is needed.
  assert.equal(resetClip(IDLE_KEYS, 'IDLE').startTime, 1);
});

test('MW-D7 rule 22: a clip it cannot resolve REFUSES, it does not guess', () => {
  // soundgen IS a registered group in the fixture (rule 21 sees
  // "soundgen: left") and has no start key at all.
  const sg = resetClip(IDLE_KEYS, 'soundgen');
  assert.equal(sg.ok, false);
  assert.match(sg.reason, /no "soundgen: start" key/,
    'the refusal names what is missing - 0, the last key, and the file duration are all wrong answers');
  const missing = resetClip(IDLE_KEYS, 'Walk');
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /names no such animation/);
  // A group with a start and NO stop. The fixture carries no such group -
  // every group it names is either complete or start-less - so this one
  // pin is hand-built, and the reason is recorded rather than hidden.
  const noStop = resetClip(
    [{ time: 0, text: 'w: start' }, { time: 1, text: 'w: chop hit' }], 'w',
  );
  assert.equal(noStop.ok, false, 'the last key of the group is NOT a stand-in for its stop key');
  assert.match(noStop.reason, /no "w: stop" key/);
  const inverted = resetClip(
    [{ time: 5, text: 'w: start' }, { time: 1, text: 'w: stop' }, { time: 6, text: 'w: x' }], 'w',
  );
  assert.equal(inverted.ok, false, 'start after stop refuses too');
  assert.match(inverted.reason, /starts at 5 and stops at 1/);
});

test('MW-D7 rules 23/49: loopStopTime is +Infinity unless loopFallback, and reset\'s THIRD stage', () => {
  const plain = resetClip(IDLE_KEYS, 'Idle');
  assert.equal(plain.loopStartTime, 1, 'loopStart seeds to the start key in both branches');
  assert.equal(plain.loopStopTime, Infinity,
    'and loopStop is INFINITE by default - which is how a clip with no loop stop plays once');
  const fb = resetClip(IDLE_KEYS, 'Idle', { loopFallback: true });
  assert.equal(fb.loopStopTime, 3, 'loopFallback substitutes the stop key, and only then');

  // Reset's third stage, the half rule 49 states unconditionally and its
  // own caveat corrects: loop keys AT OR BEFORE the startpoint-adjusted
  // playhead are applied before a single frame runs. The asymmetry is the
  // pin - 1.5 is behind the playhead and applies, 2.5 is ahead and does not.
  const resumed = resetClip(IDLE_KEYS, 'Idle', { startPoint: 0.6 });
  assert.equal(resumed.time, 2.2, '1.0 + (3.0 - 1.0) * 0.6');
  assert.equal(resumed.loopStartTime, 1.5, 'the loop-start key at 1.5 is behind the playhead: applied');
  assert.equal(resumed.loopStopTime, Infinity, 'the loop-stop key at 2.5 is ahead of it: NOT applied');
});

test('MW-D7 rule 50: time lands ON a text key, never over it', () => {
  const s = resetClip(IDLE_KEYS, 'Idle');
  const fired = [];
  // 0.9s from t=1.0 would reach 1.9. The key at 1.5 is in the way, so the
  // playhead stops there, fires it, and continues with the remaining 0.4.
  advanceClip(s, IDLE_KEYS, 0.9, (t) => fired.push(t));
  assert.equal(s.time, 1.9, 'the remaining time is still spent - the step is not truncated');
  assert.ok(fired.includes('idle: loop start'),
    'and the key it landed on FIRED, which is how the loop window narrows at all');
  assert.equal(s.loopStartTime, 1.5, 'crossed, therefore assigned');

  // WHERE THE LANDING IS ACTUALLY OBSERVABLE, which is not here: a step
  // that jumps straight to its target fires the same keys and ends at the
  // same place, so the pin above passes either way. The difference is the
  // time LEFT OVER when the step crosses the loop stop - landing on 2.5
  // leaves 0.4 to spend after the wrap, jumping to 2.9 leaves nothing.
  const w = resetClip(IDLE_KEYS, 'Idle', { loopCount: 4 });
  advanceClip(w, IDLE_KEYS, 1.4, null);      // 1.0 -> 2.4, discovering the window
  assert.equal(w.time, 2.4);
  assert.equal(w.loopStopTime, Infinity,
    'and the loop stop at 2.5 is still UNKNOWN - the window is discovered by crossing, not by looking ahead');
  advanceClip(w, IDLE_KEYS, 0.5, null);      // would reach 2.9; the key at 2.5 is in the way
  assert.equal(w.loopCount, 3, 'it wrapped');
  assert.ok(near(w.time, 1.9),
    'and resumed with the 0.4 that was left AFTER the key it landed on - a step that jumps '
    + 'over the key spends all of it first and stops dead on the loop start');
});

test('MW-D7 rule 50: the second shouldLoop is NOT an else - the wrap re-arms in the same step', () => {
  // THE CASE THAT SEPARATES THEM. Both halves run against the same state
  // in one iteration, and the wrap sets playing back to true after the
  // step set it false. Written as if/else the outer `while (playing)`
  // exits instead, and the clip is dead after a single pass.
  //
  // That only shows when the step reaches stopTime AND shouldLoop is
  // already true - which means loopStopTime <= stopTime. loopFallback is
  // exactly the branch that arranges it: the loop window IS [start, stop].
  const keys = normalizeTextKeys([
    { time: 0, text: 'Walk: Start' }, { time: 2, text: 'Walk: Stop' },
  ]);
  const s = resetClip(keys, 'Walk', { loopFallback: true, loopCount: 2 });
  assert.equal(s.loopStopTime, 2, 'the loop window is the whole clip');
  // dt lands exactly on the stop key, so the wrap is the last thing that
  // happens in the call and the rewound playhead is readable. With time
  // left over the engine spends it AFTER the wrap, which is also correct
  // and would hide the rewind behind a partial second pass.
  advanceClip(s, keys, 2, null);
  assert.equal(s.loopCount, 1, 'one loop consumed');
  assert.equal(s.time, 0, 'the playhead rewound to the loop start');
  assert.equal(s.playing, true,
    'and playing was re-armed IN THE SAME ITERATION that set it false - an else stops the clip dead here');

  // The degenerate window: loopStart >= loopStop. The break after the
  // rewind is the only guard, because timepassed never decreases on that
  // branch. Without it this call never returns.
  const spin = resetClip(keys, 'Walk', { loopFallback: true, loopCount: 5 });
  spin.loopStartTime = 2;
  spin.time = 2;
  advanceClip(spin, keys, 0.5, null);
  assert.ok(spin.loopCount < 5, 'it consumed a loop and RETURNED - the guard is what makes that true');
});

test('MW-D7 rule 49: the wrap goes to the DISCOVERED loop start, not to the clip start', () => {
  const s = resetClip(IDLE_KEYS, 'Idle', { loopCount: 2 });
  const seen = [];
  for (let i = 0; i < 40 && s.playing; i++) {
    advanceClip(s, IDLE_KEYS, 0.2, null);
    seen.push(s.time);
  }
  assert.equal(s.loopStartTime, 1.5);
  assert.equal(s.loopStopTime, 2.5);
  // The intro [1.0, 1.5) is entered ONCE. A `% span` player - which is
  // what the viewer does - replays it on every wrap.
  const intro = seen.filter((t) => t < 1.5);
  assert.deepEqual(intro, [1.2, 1.4], 'the intro is played exactly once, at the front');
  assert.equal(s.playing, false);
  assert.equal(s.time, 3, 'and after the loops are spent it runs on to the STOP key, not the loop stop');
});

test('MW-D7 rule 49: no loop stop key means it plays once, whatever the loop count', () => {
  const keys = normalizeTextKeys([
    { time: 0, text: 'Walk: Start' }, { time: 2, text: 'Walk: Stop' },
  ]);
  const s = resetClip(keys, 'Walk', { loopCount: 99 });
  assert.equal(shouldLoop(s), false, 'time >= Infinity is unsatisfiable');
  for (let i = 0; i < 20 && s.playing; i++) advanceClip(s, keys, 0.5, null);
  assert.equal(s.time, 2, 'it ends at the stop key');
  assert.equal(s.loopCount, 99, 'having consumed no loops at all');
  // shouldLoop's other two terms, each on its own.
  assert.equal(shouldLoop({ time: 5, loopStopTime: 2, loopingEnabled: false, loopCount: 9 }), false);
  assert.equal(shouldLoop({ time: 5, loopStopTime: 2, loopingEnabled: true, loopCount: 0 }), false);
  assert.equal(shouldLoop({ time: 5, loopStopTime: 2, loopingEnabled: true, loopCount: 1 }), true);
});

test('MW-D7 rule 47: sound keys cross group lines, ordinary foreign keys do not', () => {
  const s = resetClip(IDLE_KEYS, 'Idle', { loopCount: 0 });
  const fired = [];
  for (let i = 0; i < 40 && s.playing; i++) {
    advanceClip(s, IDLE_KEYS, 0.25, (text, time, mine) => fired.push({ text, mine }));
  }
  const texts = fired.map((f) => f.text);
  assert.ok(texts.includes('idle: chop hit'),
    'a key with no handler is still CROSSED - rule 24 dispatches nothing here, on purpose');
  const sg = fired.find((f) => f.text === 'soundgen: left');
  assert.ok(sg, 'the soundgen key reaches the listener');
  assert.equal(sg.mine, false,
    'flagged as another group\'s - the listener handles it BEFORE the group test and returns');
  assert.ok(!texts.some((t) => t.startsWith('idle1h:')),
    'while block A and idle1h sit outside the clip and are never reached');
});

test('MW-D7: trackBinding names the tracks that bind and the ones that do not', () => {
  const skel = buildSkeleton(parseNif(ARMSKEL));
  const good = trackBinding(skel, extractTracks(parseNif(ARMIDLE)));
  assert.equal(good.matched.length, 5);
  assert.deepEqual(good.unmatchedTracks, []);
  assert.deepEqual(good.untrackedBones.sort(), ['Left Hand', 'Right Hand'],
    'the hands ride their parents - untracked is not unbound');
  // THE SILENT FAILURE. xfixture.kf keys "Bone1", which this skeleton does
  // not have. poseSkeleton answers every bone with node.rest, so the arm
  // draws perfectly and holds perfectly still. Only this report can see it.
  const blind = trackBinding(skel, extractTracks(parseNif(KF)));
  assert.equal(blind.matched.length, 0);
  assert.deepEqual(blind.unmatchedTracks, ['bone1']);
  // The comparison must be the poser's own: lowercased both sides.
  assert.ok(good.matched.some((m) => m.bone === 'Right Upper Arm'),
    'and it matches on the LOWERCASED name, exactly as poseSkeleton does');
});

// MAP3 - THE MORROWIND HELD POSE, pinned (2026-09-18; Mac: "Morrowind
// will need its own handcrafted map with hand placement just like the
// sprite. Our first custom rig change").
//
// Three modules and a seam. combat/heldPose.js is the pose (deltas over
// the idle through the torch's track-map/sampler idiom) and the paper
// (a rigid quad on the rig root at the eye, projected through the
// pass's own camera); ui/quadMap.js is the homography that lays the DOM
// ink over the quad's corners and maps the pointer back; combat/fpArm.js
// holds and releases the sheet and hides the hand-carried pieces while
// it is up; weaponRig.js and world.js carry the holder to the window.
// The rig pins run the REAL fixture arm headless, the way mwtorch's do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  HELD_POSE_DEFAULT, HELD_BONES, HELD_BONE_ALIASES, QUAT_IDENTITY, quatMul, quatAxis, quatFromEulerDeg, mat33ToQuat,
  deltaTracks, heldSampler, resolveHeldBone, paperCornersRig, paperPiece, refreshPaperSource, projectPaperCorners, normaliseHeldPose,
} from '../src/combat/heldPose.js';
import { poseSkeleton } from '../src/formats/mwSkin.js';
import {
  unitSquareTo, sheetToCorners, applyH, invertH, matrix3dOf, quadPlacement,
} from '../src/ui/quadMap.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, packFpArm, FP_FLOATS } from '../src/combat/fpArm.js';
import { perspective, lookAt, identity } from '../src/world/mat4.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearVec = (a, b, eps = 1e-6, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(near(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
/** rotate a vector by a [w,x,y,z] quaternion */
const rot = (q, v) => {
  const [w, x, y, z] = q;
  const p = quatMul(quatMul(q, [0, v[0], v[1], v[2]]), [w, -x, -y, -z]);
  return [p[1], p[2], p[3]];
};
/** the row-major 3x3 of a rotation about Z */
const rotZ = (deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

// ── THE QUATERNIONS ──────────────────────────────────────────────

test('MAP3 quaternions: Hamilton [w,x,y,z] - THE RIG\'S OWN PACKING, held against mwSkin\'s poseSkeleton (AUDIT-MAP2: the first draft was [x,y,z,w] and a 40-degree bend about X reached the rig as a 140-degree turn about Z); an axis quarter-turn turns the next axis into the third, the Euler order is X then Y then Z about the bone\'s own axes, the 3x3 conversion agrees with the axis constructor (mutants: quat-xyzw-packing, euler-zyx, mat33-transposed)', () => {
  // THE CROSS-MODULE PIN: a delta of forty degrees about X, wrapped by
  // deltaTracks and sampled by heldSampler, posed by mwSkin's OWN
  // poseSkeleton (which hands the sampler's quaternion to quatToMat33),
  // is the row-major matrix of a forty-degree turn about X
  const skeleton = { nodes: new Map([[1, { name: 'left forearm', parent: -1, rest: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 } }]]), byName: new Map([['left forearm', 1]]) };
  const posed = poseSkeleton(skeleton, deltaTracks(null, { bones: { 'left forearm': [40, 0, 0] } }, skeleton), heldSampler(() => null), 0);
  const c40 = Math.cos(40 * Math.PI / 180), s40 = Math.sin(40 * Math.PI / 180);
  nearVec([...posed.get(1).rotation], [1, 0, 0, 0, c40, -s40, 0, s40, c40], 1e-6, 'the rig turns the bone forty degrees about X');
  nearVec(QUAT_IDENTITY, [1, 0, 0, 0], 1e-12, 'w first');
  nearVec(quatFromEulerDeg([0, 0, 0]), [1, 0, 0, 0], 1e-12, 'zero is the identity');
  nearVec(rot(quatAxis(2, 90), [1, 0, 0]), [0, 1, 0], 1e-9, 'Z quarter-turn: +X to +Y (right-handed)');
  nearVec(rot(quatAxis(0, 90), [0, 1, 0]), [0, 0, 1], 1e-9, 'X quarter-turn: +Y to +Z');
  nearVec(rot(quatAxis(1, 90), [0, 0, 1]), [1, 0, 0], 1e-9, 'Y quarter-turn: +Z to +X');
  // Composition: quatMul(a, b) applies b FIRST in the body frame, so
  // quatFromEulerDeg([x, y, z]) = qx * qy * qz turns about the bone's
  // own X, then its own (turned) Y, then its own Z - the intrinsic
  // order the tuning door is documented with.
  const e = quatFromEulerDeg([30, 40, 50]);
  nearVec(e, quatMul(quatMul(quatAxis(0, 30), quatAxis(1, 40)), quatAxis(2, 50)), 1e-12, 'x*y*z');
  const zyx = quatMul(quatMul(quatAxis(2, 50), quatAxis(1, 40)), quatAxis(0, 30));
  assert.ok(!e.every((v, i) => near(v, zyx[i])), 'and that is not the extrinsic order');
  nearVec(quatFromEulerDeg([25, 0, 0]), quatAxis(0, 25), 1e-12, 'a single axis is the axis constructor');
  assert.ok(near(Math.hypot(...e), 1, 1e-12), 'unit');
  // a missing component reads zero, so a two-number tuning cannot NaN the rig
  nearVec(quatFromEulerDeg([10]), quatAxis(0, 10), 1e-12);
  // mat33ToQuat: the identity and a Z turn, both branches of the trace test
  nearVec(mat33ToQuat([1, 0, 0, 0, 1, 0, 0, 0, 1]), [1, 0, 0, 0], 1e-12);
  const q = mat33ToQuat(rotZ(90));
  nearVec(rot(q, [1, 0, 0]), [0, 1, 0], 1e-9, 'the row-major 3x3 of a Z turn is the same turn');
  const big = mat33ToQuat(rotZ(180));   // trace = -1: the diagonal branch
  nearVec(rot(big, [1, 0, 0]), [-1, 0, 0], 1e-9);
  const xq = mat33ToQuat([1, 0, 0, 0, -1, 0, 0, 0, -1]);   // 180 about X: the m00 branch
  nearVec(rot(xq, [0, 1, 0]), [0, -1, 0], 1e-9);
  const yq = mat33ToQuat([-1, 0, 0, 0, 1, 0, 0, 0, -1]);   // 180 about Y: the m11 branch
  nearVec(rot(yq, [0, 0, 1]), [0, 0, -1], 1e-9);
});

// ── THE TRACKS AND THE SAMPLER ───────────────────────────────────

const skel = () => {
  const nodes = new Map(), byName = new Map();
  const add = (ref, name, rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => { nodes.set(ref, { name, rest: { rotation, translation: [0, 0, 0], scale: 1 } }); byName.set(name, ref); };
  add(1, 'left forearm'); add(2, 'left hand', rotZ(90)); add(3, 'right forearm');
  return { nodes, byName };
};

test('MAP3 deltaTracks: a posed bone is wrapped {__delta, __base, __rest} and every other track is the base\'s own; a ZERO delta leaves the idle alone; a bone the skeleton lacks is not posed; the key is lowercased (mutants: zero-delta-wrapped, missing-bone-wrapped, base-tracks-dropped)', () => {
  const baseTrack = { keys: 'left forearm idle' };
  const other = { keys: 'bip01 neck' };
  const base = new Map([['left forearm', baseTrack], ['bip01 neck', other]]);
  const out = deltaTracks(base, { bones: { 'Left Forearm': [40, 0, 0], 'left hand': [0, 0, 0], 'right forearm': [10, 0, 0], 'left wrist': [5, 0, 0] } }, skel());
  const lf = out.get('left forearm');
  assert.ok(lf && lf.__delta, 'the forearm is wrapped');
  nearVec(lf.__delta, quatAxis(0, 40), 1e-12, 'the delta is the Euler tuple as a quaternion');
  assert.equal(lf.__base, baseTrack, 'the base track rides the wrapper');
  nearVec(lf.__rest, [1, 0, 0, 0], 1e-12, 'the rest as a quaternion');
  assert.equal(out.get('left hand'), undefined, 'a zero delta is not wrapped - the idle owns the bone');
  assert.equal(out.get('left wrist'), undefined, 'a bone this skeleton does not have is not posed');
  const rf = out.get('right forearm');
  assert.equal(rf.__base, null, 'a bone the clip never keys has no base track');
  assert.equal(out.get('bip01 neck'), other, 'an unposed bone\'s track is untouched');
  assert.equal(base.size, 2, 'the base map is not mutated');
  // no base map at all: still a map, still the wrapped bones
  assert.equal(deltaTracks(null, { bones: { 'left forearm': [1, 0, 0] } }, skel()).size, 1);
  assert.equal(deltaTracks(base, {}, skel()).size, 2, 'no bones: the base as it was');
  // the rest rotation of a bone with a non-identity rest is carried
  const hand = deltaTracks(null, { bones: { 'left hand': [0, 0, 10] } }, skel()).get('left hand');
  nearVec(rot(hand.__rest, [1, 0, 0]), [0, 1, 0], 1e-9, 'the hand\'s rest Z turn, as a quaternion');
});

test('AUDIT-MAP2: a held bone resolves to the spelling the CLIP keys - retail keys "bip01 l forearm" and hangs the hand off it, the fixture keys the attach name "left forearm"; the attach node is taken only when nothing keys the Bip01 one (mutants: alias-ignored, alias-before-keyed)', () => {
  const both = () => {
    const nodes = new Map(), byName = new Map();
    const add = (ref, name) => { nodes.set(ref, { name, rest: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 } }); byName.set(name, ref); };
    add(1, 'bip01 l forearm'); add(2, 'left forearm'); add(3, 'left hand');
    return { nodes, byName };
  };
  assert.equal(HELD_BONE_ALIASES['left forearm'], 'bip01 l forearm');
  assert.equal(HELD_BONE_ALIASES['left clavicle'], 'bip01 l clavicle');
  assert.equal(HELD_BONE_ALIASES['left upper arm'], 'bip01 l upperarm', 'Morrowind spells the upper arm as one word on the Bip01 bone');
  const retail = new Map([['bip01 l forearm', { keys: 'kf' }]]);
  assert.equal(resolveHeldBone('Left Forearm', retail, both()), 'bip01 l forearm', 'the keyed Bip01 bone wins');
  const out = deltaTracks(retail, { bones: { 'left forearm': [40, 0, 0] } }, both());
  assert.ok(out.get('bip01 l forearm')?.__delta, 'wrapped under the keyed name');
  assert.equal(out.get('bip01 l forearm').__base, retail.get('bip01 l forearm'), 'over the clip\'s track');
  assert.equal(out.get('left forearm'), undefined, 'the attach node is left alone');
  const fixture = new Map([['left forearm', { keys: 'kf' }]]);
  assert.equal(resolveHeldBone('left forearm', fixture, both()), 'left forearm', 'the fixture keys the attach name: that one');
  assert.equal(resolveHeldBone('left forearm', new Map(), both()), 'left forearm', 'nothing keyed: the first the skeleton has');
  assert.equal(resolveHeldBone('left forearm', new Map(), { nodes: both().nodes, byName: new Map([['bip01 l forearm', 1]]) }), 'bip01 l forearm', 'a skeleton with only the Bip01 bone');
  assert.equal(resolveHeldBone('left wrist', retail, both()), null, 'no such bone under either name');
  assert.equal(resolveHeldBone('spine', retail, both()), null);
});

test('MAP3 heldSampler: a wrapped bone answers base TIMES delta (the delta about the bone\'s own axes, after the idle) with the base\'s translation and scale; without a base the rest times the delta; an unwrapped track is the inner sampler\'s (mutants: delta-times-base, delta-replaces-base, translation-dropped)', () => {
  const inner = (track, time) => ({ rotation: track?.q ?? null, translation: [time, 2, 3], scale: 1.5 });
  const sample = heldSampler(inner);
  const base = { q: quatAxis(2, 90) };
  const wrapped = { __delta: quatAxis(0, 90), __base: base, __rest: [0, 0, 0, 1] };
  const s = sample(wrapped, 7);
  nearVec(s.rotation, quatMul(quatAxis(2, 90), quatAxis(0, 90)), 1e-12, 'base * delta');
  assert.ok(!s.rotation.every((v, i) => near(v, quatMul(quatAxis(0, 90), quatAxis(2, 90))[i])), 'and not delta * base - the turn is in the bone\'s frame, not the parent\'s');
  assert.deepEqual(s.translation, [7, 2, 3], 'the base\'s translation at the base\'s time');
  assert.equal(s.scale, 1.5);
  const restOnly = sample({ __delta: quatAxis(1, 30), __base: null, __rest: quatAxis(2, 90) }, 0);
  const wrappedRest = { __delta: quatAxis(0, 90), __base: base, __rest: [1, 0, 0, 0] };
  nearVec(sample(wrappedRest, 1).rotation, quatMul(quatAxis(2, 90), quatAxis(0, 90)), 1e-12, 'an identity rest plays no part when a base track stands');
  nearVec(restOnly.rotation, quatMul(quatAxis(2, 90), quatAxis(1, 30)), 1e-12, 'no clip on the bone: rest * delta');
  assert.equal(restOnly.translation, null, 'and no translation - poseSkeleton takes the rest\'s');
  assert.deepEqual(sample(base, 4), inner(base, 4), 'an unwrapped track is sampled as it always was');
  assert.deepEqual(sample(null, 4), inner(null, 4));
});

// ── THE PAPER ────────────────────────────────────────────────────

test('MAP3 paperCornersRig: the sheet is centred `forward` ahead (+Y) and `drop` below (-Z) the eye in Morrowind units, `width` across with the aspect giving the height, leaning back by `tilt`; TL TR BR BL with the actor\'s left at -X (mutants: forward-on-x, drop-up, tilt-forward, corners-clockwise-from-bl)', () => {
  const eye = [0, 0, 100];
  const c = paperCornersRig(eye, { width: 1, forward: 2, drop: 0.5, tilt: 0 }, 2);
  const U = 69.99;
  nearVec(c[0], [-U / 2, 2 * U, 100 - 0.5 * U + U / 4], 1e-9, 'top-left');
  nearVec(c[1], [U / 2, 2 * U, 100 - 0.5 * U + U / 4], 1e-9, 'top-right');
  nearVec(c[2], [U / 2, 2 * U, 100 - 0.5 * U - U / 4], 1e-9, 'bottom-right');
  nearVec(c[3], [-U / 2, 2 * U, 100 - 0.5 * U - U / 4], 1e-9, 'bottom-left');
  // the tilt leans the TOP away from the eye (+Y) and the bottom toward it
  const t = paperCornersRig(eye, { width: 1, forward: 2, drop: 0.5, tilt: 30 }, 2);
  assert.ok(t[0][1] > c[0][1] && t[3][1] < c[3][1], 'top away, bottom toward');
  assert.ok(near(t[0][2] - t[3][2], (U / 2) * Math.cos(Math.PI / 6), 1e-9), 'the height foreshortens by cos(tilt)');
  assert.ok(near(Math.hypot(t[0][1] - t[3][1], t[0][2] - t[3][2]), U / 2, 1e-9), 'the sheet keeps its length');
  // a bad aspect falls to the sprite's own 1.6
  const d = paperCornersRig(eye, { width: 1, forward: 1, drop: 0, tilt: 0 }, 0);
  assert.ok(near(d[0][2] - d[3][2], U / 1.6, 1e-9));
});

test('MAP3 paperPiece: a rigid piece in slot "paper" attached to the rig root (attachRef null = identity), its source the corners themselves, ONE winding whose packed normal faces the eye (AUDIT-MAP2: the second winding was a coplanar twin with its normal turned away), upright UVs, the parchment diffuse and no texture; refreshPaperSource moves the corners with the eye in place (mutants: winding-away-from-eye, uvs-flipped, refresh-allocates)', () => {
  const p = paperPiece([0, 0, 0], HELD_POSE_DEFAULT.paper, 1.6);
  assert.equal(p.slot, 'paper');
  assert.equal(p.kind, 'rigid');
  assert.equal(p.attachRef, null, 'the root: the source IS the rig-space position');
  assert.equal(p.bone, null);
  assert.equal(p.boneOffset, null);
  const c = paperCornersRig([0, 0, 0], HELD_POSE_DEFAULT.paper, 1.6);
  nearVec([...p.source], c.flat(), 1e-3, 'the source is the corners, TL TR BR BL (Float32)');
  assert.equal(p.positions.length, 12, 'four posed vertices to fill');
  assert.deepEqual([...p.indices], [0, 2, 1, 0, 3, 2], 'two triangles, one winding');
  // the packed flat normal points at the eye: the sheet is ahead (+Y) of
  // the eye, so its normal must have a NEGATIVE Y (the pass draws with
  // culling off; the normal is for the light)
  p.positions.set(p.source);
  const { packed } = packFpArm([p]);
  assert.ok(packed[6 + 1] < -0.5 && packed[FP_FLOATS * 3 + 6 + 1] < -0.5, `both triangles face the eye (ny ${packed[7]}, ${packed[FP_FLOATS * 3 + 7]})`);
  // refreshPaperSource: the same corners for the same eye, moved corners for a moved eye, in place
  const src = p.source;
  const far0 = refreshPaperSource(p, [0, 0, 0], HELD_POSE_DEFAULT.paper, 1.6);
  assert.equal(p.source, src, 'in place');
  nearVec([...p.source], c.flat(), 1e-3);
  assert.ok(far0 > HELD_POSE_DEFAULT.paper.forward * 69.99, 'the farthest corner is beyond the sheet\'s centre');
  refreshPaperSource(p, [10, 0, 0], HELD_POSE_DEFAULT.paper, 1.6);
  assert.ok(near(p.source[0], c[0][0] + 10, 1e-3), 'the sheet followed the eye');
  assert.deepEqual([...p.uvs], [0, 0, 1, 0, 1, 1, 0, 1], 'u across, v down from the top-left');
  assert.deepEqual(p.material.diffuse, [...HELD_POSE_DEFAULT.paper.colour]);
  assert.equal(p.material.textureFile, null);
  assert.equal(p.material.vertexColorMode, 0);
  assert.notEqual(p.material.diffuse, HELD_POSE_DEFAULT.paper.colour, 'a copy, not the frozen default');
  const red = paperPiece([0, 0, 0], { ...HELD_POSE_DEFAULT.paper, colour: [1, 0, 0] }, 1.6);
  assert.deepEqual(red.material.diffuse, [1, 0, 0], 'the spec\'s colour');
});

test('MAP3 projectPaperCorners: through model, view and projection to CSS px of the rect - a point on the lens axis lands at the rect\'s centre, +X right, +Y up on screen is DOWN in CSS, a corner behind the lens answers null (mutants: y-not-flipped, rect-offset-dropped, behind-lens-projected)', () => {
  const view = lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]);
  const proj = perspective(Math.PI / 2, 2, 0.1, 100);
  const cam = { model: identity(), view, proj };
  const rect = { x: 10, y: 20, w: 200, h: 100 };
  const pos = new Float32Array([0, 0, -5, 5, 0, -5, 0, 2.5, -5, 0, 0, -5]);
  const out = projectPaperCorners(pos, cam, rect);
  nearVec(out[0], [110, 70], 1e-9, 'the axis is the centre');
  // fov 90 across the height: at z=-5, y=5 is the top edge; x=5 at aspect 2 is half the width
  nearVec(out[1], [160, 70], 1e-9, '+X to the right');
  nearVec(out[2], [110, 45], 1e-9, '+Y up on the lens is up on the page - smaller CSS y');
  assert.equal(projectPaperCorners(new Float32Array([0, 0, -5, 0, 0, -5, 0, 0, -5, 0, 0, 5]), cam, rect), null, 'a corner behind the lens: nothing to place');
  // the model matrix is applied first: a model that flips Z puts the sheet behind the lens
  const flip = identity(); flip[10] = -1;
  assert.equal(projectPaperCorners(pos, { ...cam, model: flip }, rect), null);
});

test('MAP3 normaliseHeldPose: the default filled in bone by bone, an unknown bone dropped, a non-number zeroed, the paper\'s numbers coerced and its colour kept only as a triple (mutants: unknown-bones-kept, nan-through, colour-any-length)', () => {
  const d = normaliseHeldPose(null);
  assert.deepEqual(Object.keys(d.bones), Object.keys(HELD_POSE_DEFAULT.bones), 'the default names the six bones with a tuple');
  assert.deepEqual(d.paper, { ...HELD_POSE_DEFAULT.paper, colour: [...HELD_POSE_DEFAULT.paper.colour] });
  const s = normaliseHeldPose({ bones: { 'left forearm': ['12', 'x'], 'left clavicle': [1, 2, 3], 'bip01 l clavicle': [4, 4, 4], 'spine': [9, 9, 9] }, paper: { width: '0.5', tilt: NaN, colour: [1, 2] } });
  assert.deepEqual(s.bones['left forearm'], [12, 0, 0], 'strings that are numbers count, others are zero, a short tuple is padded');
  assert.deepEqual(s.bones['left clavicle'], [1, 2, 3], 'a HELD_BONES name beyond the default six is allowed');
  assert.equal(s.bones['bip01 l clavicle'], undefined, 'the door takes the attach names; the Bip01 spelling is resolved underneath, not typed');
  assert.equal(s.bones.spine, undefined, 'the spine is not a held bone');
  // merged over a BASE: the door's partial spec changes only what it names
  const inForce = normaliseHeldPose({ bones: { 'left hand': [1, 2, 3] }, paper: { forward: 0.9 } });
  const part = normaliseHeldPose({ paper: { width: 0.2 } }, inForce);
  assert.deepEqual(part.bones['left hand'], [1, 2, 3], 'the bones in force stay');
  assert.equal(part.paper.forward, 0.9, 'and so does the paper\'s other number');
  assert.equal(part.paper.width, 0.2);
  assert.equal(s.paper.width, 0.5);
  assert.equal(s.paper.tilt, HELD_POSE_DEFAULT.paper.tilt, 'NaN falls to the default');
  assert.deepEqual(s.paper.colour, [...HELD_POSE_DEFAULT.paper.colour], 'a two-number colour is not a colour');
  for (const b of Object.keys(HELD_POSE_DEFAULT.bones)) assert.ok(HELD_BONES.includes(b));
  assert.ok(Object.values(HELD_POSE_DEFAULT.bones).every((e) => e.every((v) => v === 0)), 'the DEFAULT deltas are zero: the pose is tuned on retail bones through the door, not guessed here');
});

// ── THE QUAD MAP ─────────────────────────────────────────────────

test('MAP3 quadMap: the unit square to itself is the identity, the adjugate homography hits all four corners of a perspective quad, the sheet scale rides in, and forward and inverse cancel (mutants: affine-only, corners-permuted, scale-on-wrong-axis)', () => {
  nearVec(unitSquareTo([[0, 0], [1, 0], [1, 1], [0, 1]]), [1, 0, 0, 0, 1, 0, 0, 0, 1], 1e-12);
  const corners = [[150, 297.6], [650, 297.6], [729.2, 704.4], [70.8, 704.4]];   // the fixture rig's own trapezium
  const H = unitSquareTo(corners);
  assert.ok(Math.abs(H[6]) + Math.abs(H[7]) > 1e-6, 'a trapezium needs the projective row - an affine map cannot reach it');
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach((u, i) => nearVec(applyH(H, u[0], u[1]), corners[i], 1e-9, `corner ${i}`));
  const S = sheetToCorners(400, 250, corners);
  [[0, 0], [400, 0], [400, 250], [0, 250]].forEach((u, i) => nearVec(applyH(S, u[0], u[1]), corners[i], 1e-9, `sheet corner ${i}`));
  // the centre of the sheet is NOT the centroid of the corners under perspective: it lies on both diagonals
  const mid = applyH(S, 200, 125);
  const on = (p, a, b) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) < 1e-6;
  assert.ok(on(mid, corners[0], corners[2]) && on(mid, corners[1], corners[3]), 'the sheet\'s centre is where the diagonals cross');
  const inv = invertH(S);
  for (const [x, y] of [[0, 0], [400, 250], [37, 211], [200, 125]]) {
    const s = applyH(S, x, y);
    nearVec(applyH(inv, s[0], s[1]), [x, y], 1e-6, 'inverse');
  }
  assert.equal(invertH([1, 2, 3, 2, 4, 6, 0, 0, 1]), null, 'a singular matrix has no inverse');
  assert.equal(applyH([0, 0, 0, 0, 0, 0, 1, 1, 0], 0, 0), null, 'a point at infinity is not a point');
  assert.equal(sheetToCorners(0, 250, corners), null, 'no sheet, no map');
});

test('MAP3 matrix3dOf: the 3x3 spread into the browser\'s column-major 4x4 with z untouched - translation in the 13th/14th slots, the projective terms in the 4th and 8th, the divisor last (mutants: row-major, projective-in-translation)', () => {
  const css = matrix3dOf([2, 3, 5, 7, 11, 13, 17, 19, 23]);
  const m = css.replace(/^matrix3d\(|\)$/g, '').split(', ').map(Number);
  assert.equal(m.length, 16);
  assert.deepEqual(m, [2, 7, 0, 17, 3, 11, 0, 19, 0, 0, 1, 0, 5, 13, 0, 23]);
  assert.match(matrix3dOf([1, 0, 0, 0, 1, 0, 0, 0, 1]), /^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$/, 'the identity reads as the identity; tiny terms print as 0');
  assert.doesNotMatch(matrix3dOf([1e-12, 0, 0, 0, 1, 0, 0, 0, 1]), /e-/, 'no exponent notation reaches CSS');
});

test('MAP3 quadPlacement: css, the corners\' box, and the two mappers as inverses; null on a missing corner, a non-finite one, or a degenerate quad (mutants: box-from-first-two, degenerate-placed)', () => {
  const corners = [[100, 50], [300, 60], [320, 250], [80, 240]];
  const q = quadPlacement(500, 400, corners);
  assert.ok(q);
  assert.equal(q.css, matrix3dOf(q.H));
  assert.deepEqual(q.box, { x: 80, y: 50, w: 240, h: 200 });
  nearVec(q.toScreen(0, 0), corners[0], 1e-9);
  nearVec(q.toScreen(500, 400), corners[2], 1e-9);
  nearVec(q.toSheet(...corners[1]), [500, 0], 1e-6, 'the top-right corner is the sheet\'s (w, 0)');
  nearVec(q.toSheet(...q.toScreen(123, 45)), [123, 45], 1e-6);
  assert.equal(quadPlacement(500, 400, null), null);
  assert.equal(quadPlacement(500, 400, corners.slice(0, 3)), null, 'three corners are not a quad');
  assert.equal(quadPlacement(500, 400, [[NaN, 0], ...corners.slice(1)]), null);
  assert.equal(quadPlacement(500, 400, [[0, 0], [0, 0], [0, 0], [0, 0]]), null, 'a point is not a quad');
  assert.equal(quadPlacement(500, 400, [[0, 0], [1, 1], [2, 2], [3, 3]]), null, 'nor is a line');
  // AUDIT-MAP2: a sheet turned nearly edge-on is not placed - its area is
  // a sliver of its box, though every absolute guard passes it
  assert.equal(quadPlacement(500, 400, [[100, 200], [700, 200], [700, 204], [100, 204]]), null, 'a 600x4 sliver: hidden');
  assert.equal(quadPlacement(500, 400, [[100, 200], [700, 196], [700, 204], [100, 208]]), null, 'a sliver on a slant (area under a fiftieth of the long edge squared): hidden');
  assert.ok(quadPlacement(500, 400, [[100, 200], [700, 200], [700, 230], [100, 230]]), 'a sheet twenty times wider than tall: still placed');
  assert.ok(quadPlacement(500, 400, [[100, 100], [700, 120], [700, 300], [100, 280]]), 'a leaning sheet a fifth as tall as wide: placed');
  // AUDIT-MAP2: beyond the paper plane's vanishing line the inverse's
  // divisor goes negative - a mirrored point, not a sheet point
  const steep = quadPlacement(500, 400, [[200, 300], [300, 300], [480, 500], [20, 500]]);   // a sheet seen nearly edge-on from below: the vanishing line is above y=300
  assert.ok(steep);
  assert.equal(steep.toSheet(250, 50), null, 'above the horizon: nothing');
  // a sheet seen from BEHIND (the corners mirrored on screen) inverts the
  // adjugate's sign; the divisor is fixed at the centroid, so the sheet's
  // own centre still maps back to itself
  const mirrored = quadPlacement(500, 400, [[300, 300], [200, 300], [20, 500], [480, 500]]);
  assert.ok(mirrored);
  nearVec(mirrored.toSheet(...mirrored.toScreen(250, 200)), [250, 200], 1e-6, 'the round trip holds on a mirrored sheet');
  assert.equal(mirrored.toSheet(250, 50), null, 'and its horizon is still a horizon');
  assert.ok(steep.toSheet(250, 400), 'on the sheet: a point');
  nearVec(steep.toSheet(...steep.toScreen(250, 200)), [250, 200], 1e-6, 'and the round trip still holds inside');
});

// ── THE RIG ──────────────────────────────────────────────────────

const liveRig = () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const draws = [];
  const renderer = {
    gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    renderCharacterSprite: (mesh, model, proj, view) => { draws.push({ model, proj, view }); return { tex: {} }; },
    drawScreenOverlayQuad: () => {},
    createCharacterTexture: (mips) => ({ mips }),
  };
  return { deps, renderer, draws };
};
const canvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 };
const boneT = (arm, name) => [...arm.built().arm.mats.get(arm.built().arm.skeleton.byName.get(name)).t];

test('MAP3 fpArm.holdPaper: refused with nothing built; on the fixture rig it adds ONE paper piece on the root at the eye, the mesh repacks with a visible paper range, a second hold replaces rather than stacks, and releasePaper takes it away again (mutants: paper-stacked, paper-kept-on-release, no-repack)', async () => {
  const { deps, renderer } = liveRig();
  const arm = createFpArm();
  assert.equal(arm.holdPaper(), false, 'nothing built');
  assert.equal(arm.releasePaper(), false);
  assert.equal(arm.heldPose(), null);
  assert.equal(arm.paperCorners(), null);
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  const n = built.arm.pieces.length;
  arm.update(1 / 60);   // the arm has drawn before the map opens: the mesh and its ranges stand
  const mesh0 = arm.mesh();
  assert.equal(mesh0.ranges.length, n);
  assert.equal(arm.holdPaper(null, { aspect: 1.5 }), true, 'the build posed the rig once: the eye is known');
  assert.equal(arm.mesh(), null, 'the mesh is released: its ranges were the old piece list');
  const papers = () => built.arm.pieces.filter((p) => p.slot === 'paper');
  assert.equal(papers().length, 1);
  assert.equal(built.arm.pieces.length, n + 1);
  const eye = built.arm.mats.get(built.cameraRef).t;
  nearVec([...papers()[0].source], paperCornersRig(eye, HELD_POSE_DEFAULT.paper, 1.5).flat(), 1e-6, 'placed from the eye node, at the asked aspect');
  assert.deepEqual(arm.heldPose(), normaliseHeldPose(null), 'no spec: the default pose');
  assert.equal(arm.holdPaper(null, { aspect: 1.2 }), true, 'held again');
  assert.equal(papers().length, 1, 'replaced, not stacked');
  assert.equal(built.arm.pieces.length, n + 1);
  arm.update(1 / 60);
  const ranges = arm.mesh().ranges;
  assert.equal(ranges.filter((r) => r.slot === 'paper').length, 1, 'the paper is a range of the packed mesh');
  assert.equal(ranges.find((r) => r.slot === 'paper').hidden, false, 'shown while held');
  assert.equal(ranges.length, built.arm.pieces.length, 'one range per piece - the repack took the new list');
  assert.equal(arm.releasePaper(), true);
  assert.equal(papers().length, 0, 'gone from the list');
  assert.equal(arm.heldPose(), null);
  assert.equal(arm.paperCorners(), null);
  arm.update(1 / 60);
  assert.ok(arm.mesh().ranges.every((r) => r.slot !== 'paper'), 'and from the mesh');
  assert.equal(arm.mesh().ranges.length, n);
  arm.unload();
  assert.equal(arm.holdPaper(), false, 'unloaded: nothing to hold it');
});

test('MAP3 fpArm.paperCorners: null before the first draw; after a draw, the four corners through the frame\'s OWN model/view/projection - the same three handed to renderCharacterSprite - inside the canvas, TL TR BR BL, a trapezium wider at the bottom for a sheet that leans back (mutants: corners-before-draw, corners-through-fresh-camera)', async () => {
  const { deps, renderer, draws } = liveRig();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true);
  const reach0 = built.reach;
  arm.holdPaper(null, { aspect: 1.6 });
  arm.update(1 / 60);
  assert.equal(arm.paperCorners(), null, 'no frame composed yet');
  assert.equal(arm.drewLast(), false, 'AUDIT-MAP2: nothing drawn yet');
  assert.equal(arm.draw(null), false);
  assert.equal(arm.drewLast(), false, 'a draw that returned early did not compose');
  assert.equal(arm.draw(canvas), true);
  assert.equal(arm.drewLast(), true, 'this one did');
  assert.equal(arm.draw(null), false);
  assert.equal(arm.drewLast(), false, 'and the flag is per call, not sticky');
  assert.equal(arm.draw(canvas), true);
  const c = arm.paperCorners();
  assert.ok(Array.isArray(c) && c.length === 4);
  for (const [x, y] of c) assert.ok(Number.isFinite(x) && Number.isFinite(y));
  assert.ok(c[0][0] < c[1][0] && c[3][0] < c[2][0], 'left is left of right');
  assert.ok(c[0][1] < c[3][1] && c[1][1] < c[2][1], 'top is above bottom');
  assert.ok(near(c[0][1], c[1][1], 1e-6) && near(c[2][1], c[3][1], 1e-6), 'level: no roll');
  assert.ok(c[2][0] - c[3][0] > c[1][0] - c[0][0], 'the bottom edge, nearer the eye, is wider');
  // the same camera the draw used
  const piece = built.arm.pieces.find((p) => p.slot === 'paper');
  const last = draws[draws.length - 1];
  const again = projectPaperCorners(piece.positions, { model: last.model, view: last.view, proj: last.proj }, { x: 0, y: 0, w: 800, h: 600 });
  again.forEach((p, i) => nearVec(c[i], p, 1e-9, `corner ${i}`));
  // AUDIT-MAP2: the far plane FOLLOWS the sheet. The pass's far is the
  // arm's REACH times four (rule 54: the planes come off the arm's own
  // reach - the literal stands, MW-D10's pin), and a held sheet is part
  // of the reach: the default sheet sits 0.42 m = 29 units out on a
  // fixture whose sweep is 1.9, and the first browser run drew the ink
  // over the sky with no parchment under it - clipped, while the corners
  // (which do not clip) still projected. far = m[14] / (m[10] + 1).
  const farOf = (m) => m[14] / (m[10] + 1);
  const eye = built.arm.mats.get(built.cameraRef).t;
  const ppos = piece.positions;
  let want = reach0 * 4;
  for (let i = 0; i < 12; i += 3) want = Math.max(want, Math.hypot(ppos[i] - eye[0], ppos[i + 1] - eye[1], ppos[i + 2] - eye[2]) * 1.25);
  assert.ok(built.reach > reach0 + 1, `the reach grew for the sheet (${built.reach} vs ${reach0})`);
  assert.ok(farOf(last.proj) > reach0 * 4 + 1, `the far plane moved out for the sheet (${farOf(last.proj)} vs ${reach0 * 4})`);
  assert.ok(Math.abs(farOf(last.proj) - want) < want * 0.02, `to the sheet's farthest corner and a quarter more (${farOf(last.proj)} vs ${want})`);
  arm.releasePaper(); arm.update(1 / 60); arm.draw(canvas);
  assert.ok(Math.abs(built.reach - reach0) < 1e-9, 'released: the arm\'s own reach again');
  assert.ok(Math.abs(farOf(draws[draws.length - 1].proj) - reach0 * 4) < 1e-3, 'and its own far plane');
  arm.holdPaper(null, { aspect: 1.6 }); arm.update(1 / 60); arm.draw(canvas);
  // the fixture rig is metre-scaled, so the default sheet hangs off the
  // bottom of its canvas; a smaller sheet higher up lands wholly on it
  assert.equal(arm.setHeldPose({ paper: { width: 0.3, drop: 0.02, forward: 0.6 } }), true);
  arm.update(1 / 60); arm.draw(canvas);
  for (const [x, y] of arm.paperCorners()) assert.ok(x > 0 && x < 800 && y > 0 && y < 600, `on the canvas: ${x},${y}`);
  // no tilt: a rectangle, the left edge vertical
  assert.equal(arm.setHeldPose({ paper: { width: 0.3, drop: 0, forward: 0.8, tilt: 0 } }), true);
  arm.update(1 / 60); arm.draw(canvas);
  const r = arm.paperCorners();
  assert.ok(near(r[0][0], r[3][0], 1e-6) && near(r[1][0], r[2][0], 1e-6), 'a sheet facing the lens squarely is a rectangle');
  arm.unload();
});

test('MAP3 fpArm held pose: a delta on the left forearm moves the left hand and leaves the right arm as the idle posed it; heldPose reads the normalised spec back; setHeldPose re-places the sheet at the held aspect; the delta tracks are memoised per frame (mutants: delta-not-applied, delta-on-both-arms, memo-rebuilt-per-frame)', async () => {
  const { deps, renderer } = liveRig();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0 }));
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true);
  assert.equal(arm.setHeldPose({ bones: { 'left forearm': [40, 0, 0] } }), false, 'nothing held: nothing to pose');
  arm.holdPaper(null, { aspect: 1.6 });
  arm.update(1 / 60);
  const lh0 = boneT(arm, 'left hand'), rh0 = boneT(arm, 'right hand');
  arm.update(0);
  nearVec(boneT(arm, 'left hand'), lh0, 1e-9, 'a zero-dt frame holds the pose');
  assert.equal(arm.setHeldPose({ bones: { 'left forearm': [40, 0, 0] } }), true);
  assert.deepEqual(arm.heldPose().bones['left forearm'], [40, 0, 0]);
  assert.deepEqual(arm.heldPose().bones['right forearm'], [0, 0, 0], 'the rest of the spec is the default');
  assert.equal(arm.heldPose().paper.width, HELD_POSE_DEFAULT.paper.width);
  arm.update(0);
  const lh1 = boneT(arm, 'left hand'), rh1 = boneT(arm, 'right hand');
  assert.ok(Math.hypot(lh1[0] - lh0[0], lh1[1] - lh0[1], lh1[2] - lh0[2]) > 0.1, 'the forearm turned: the hand moved (the fixture is metre-scaled)');
  nearVec(rh1, rh0, 1e-6, 'the right arm is the idle\'s');
  // the sheet followed the spec, at the same aspect
  const piece = built.arm.pieces.find((p) => p.slot === 'paper');
  assert.equal(arm.setHeldPose({ paper: { width: 0.3 } }), true);
  const piece2 = built.arm.pieces.find((p) => p.slot === 'paper');
  assert.notEqual(piece2, piece, 'a new piece for a new spec');
  assert.ok(near(piece2.source[3] - piece2.source[0], 0.3 * 69.99, 1e-3), 'the new width');
  const tall = Math.hypot(piece2.source[1] - piece2.source[10], piece2.source[2] - piece2.source[11]);   // TL to BL, along the leaning sheet
  assert.ok(near((piece2.source[3] - piece2.source[0]) / tall, 1.6, 1e-5), 'at the held aspect');
  assert.deepEqual(arm.heldPose().bones['left forearm'], [40, 0, 0], 'a paper-only spec through the door keeps the bones in force');
  // the pose survives a rebuild: an equip-follow mints a piece list without the sheet, and the frame puts it back
  await arm.setWorn([{ kind: 'armor', templateIndex: 102, material: 0 }]);
  const rebuilt = arm.built();
  assert.notEqual(rebuilt, built, 'a new build');
  assert.equal(rebuilt.arm.pieces.some((p) => p.slot === 'paper'), false, 'the fresh list has no sheet yet');
  arm.update(1 / 60);
  assert.equal(rebuilt.arm.pieces.filter((p) => p.slot === 'paper').length, 1, 'the frame re-added it');
  assert.deepEqual(arm.heldPose().bones['left forearm'], [40, 0, 0], 'with the pose in force');
  assert.equal(arm.mesh().ranges.some((r) => r.slot === 'paper' && !r.hidden), true);
  // AUDIT-MAP2: the sheet FOLLOWS the eye - the camera node's translation
  // is read each frame, and a moved eye re-places the source in place
  const cam = rebuilt.arm.mats.get(rebuilt.cameraRef);
  const sheet = rebuilt.arm.pieces.find((p) => p.slot === 'paper');
  const x0 = sheet.source[0];
  cam.t[0] += 0.25;   // the neck moved the eye a quarter unit (last frame's pose is what the block reads)
  arm.update(0);
  assert.equal(rebuilt.arm.pieces.find((p) => p.slot === 'paper'), sheet, 'the same piece');
  assert.ok(near(sheet.source[0], x0 + 0.25, 1e-6), 'moved with the eye, in place');
  arm.unload();
  assert.equal(arm.heldPose(), null, 'unload drops the sheet with the rig');
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /if \(!built \|\| !built\.ok \|\| viewMode !== 'first'\) return false;/, 'AUDIT-MAP2: the third-person body holds nothing');
  assert.match(src, /if \(!node\) \{ held = null; heldMemo = null; \}/, 'AUDIT-MAP2: a rig with no camera node lets the sheet go rather than projecting a piece that is not in the mesh');
});

test('MAP3 fpArm hides the hand-carried pieces while the sheet is up - the source keeps the torch\'s literal hide line and adds the paper\'s beside it, then the held override over weapon, arrow and torch; draw() records the frame the corners project through (mutants: weapon-shown-while-held, paper-never-hidden)', () => {
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /else if \(r\.slot === 'torch'\) r\.hidden = !torchVisible\(\);/, 'MW-D51\'s line, untouched');
  assert.match(src, /else if \(r\.slot === 'paper'\) r\.hidden = !held;/);
  assert.match(src, /if \(held && \(r\.slot === 'weapon' \|\| r\.slot === 'arrow' \|\| r\.slot === 'torch'\)\) r\.hidden = true;/);
  assert.match(src, /const projScreen = pad > 0 \? perspective\(FP_FIELD_OF_VIEW, pw \/ ph, near, far\) : proj;\s*\n\s*lastFrame = \{ model: NIF_TO_PASS, view, proj: projScreen, rect: screenTransform \? screenTransform\(\{ x: 0, y: 0, w: W, h: H \}\) : \{ x: 0, y: 0, w: W, h: H \} \};\s*\n\s*drewLast = true;/, 'the corners go through the SCREEN\'s symmetric frame (MAC-R1 pads the drawn one above it) and the WW1 channel rect the composite goes through, and the frame is marked composed');
  assert.match(src, /draw\(canvas\) \{\s*\n\s*drewLast = false;/, 'AUDIT-MAP2: reset before every early return');
  assert.match(src, /const far = built\.reach \* 4;/, 'rule 54\'s law stands - the far plane is the reach times four; the sheet grows the REACH, not the line');
  assert.match(src, /perspective\(FP_FIELD_OF_VIEW, pw \/ ph, near, far\)/, 'the screen\'s symmetric frame (MAC-R1 pads the drawn one above it)');
  assert.match(src, /const hm = heldTracksFor\(fTracks, fSampler\);\s*\n\s*fTracks = hm\.tracks; fSampler = hm\.sampler;/, 'the held tracks wrap whatever the torch overlay left - the two idioms stack');
  assert.match(src, /held = null; heldMemo = null; lastFrame = null;/, 'unload');
});

// ── THE SEAM ─────────────────────────────────────────────────────

test('MAP3 weaponRig: armsDrawn() is the draw seam\'s own record - reset at the top of every draw and set exactly where the arm takes the frame, before the untouched literal; the hold API passes straight through (mutants: armsDrawn-stale, armsDrawn-from-active)', () => {
  const src = rd('src/combat/weaponRig.js');
  assert.match(src, /draw\(\{ paralyzed = false \} = \{\}\) \{\s*\n\s*_armDrewLast = false;/);
  assert.match(src, /_armDrewLast = !eotbHidesWeapon\(\) && fpArm\.active\(\);[^\n]*\n\s*if \(eotbHidesWeapon\(\)\) return;\s*\n\s*if \(fpArm\.active\(\)\) \{ fpArm\.draw\(c\); return; \}/, 'set on the line before the two-line seam (EOTB-IL keeps those two adjacent), with the same two conditions');
  assert.equal([...src.matchAll(/^\s*_armDrewLast = /gm)].length, 2, 'written in exactly those two places');
  assert.match(src, /armsDrawn\(\) \{ return _armDrewLast && fpArm\.drewLast\(\); \},/, 'AUDIT-MAP2: the seam reached AND the arm composed - fpArm.draw(null) under the EOTB spell-hands hide returns before composing');
  // MAP-FIELD: and the question the HOLDER asks is a different one -
  // WOULD the arm draw. A player opening the travel map is sheathed by
  // definition, and a sheathed arm does not draw at all, so asking
  // "did it draw" could only ever answer no and the hands lane was
  // unreachable in the game. The sheet then draws it, the way the
  // torch does (TORCH-VIS: `shown()` is the WEAPON's predicate).
  assert.match(src, /armsAvailable\(\) \{ return !eotbHidesWeapon\(\) && fpArm\.active\(\); \},/);
  assert.match(src, /const sheetOnly = !shown\(\) && fpArm\.active\(\) && fpArm\.holdingPaper\(\);\s*\n\s*if \(paralyzed \|\| \(!shown\(\) && !torchOnly && !sheetOnly\)\) return;/,
    'the held sheet draws the sheathed arm, beside the torch\'s own leg');
  assert.match(rd('src/combat/fpArm.js'), /holdingPaper\(\) \{ return !!held; \},/);
  for (const arm of ['holdPaper(spec, opts) { return fpArm.holdPaper(spec, opts); }', 'releasePaper() { return fpArm.releasePaper(); }',
    'paperCorners() { return fpArm.paperCorners(); }', 'heldPose() { return fpArm.heldPose(); }', 'setHeldPose(spec) { return fpArm.setHeldPose(spec); }']) {
    assert.ok(src.includes(arm), arm);
  }
});

test('MAP3 world.js: the holder rides the ONE dep bag, asked per open through the rig (never a snapshot), and the tuning door reads or re-places the pose (mutants: holder-snapshot, door-missing)', () => {
  const src = rd('src/scenes/world.js');
  const at = src.indexOf('createTravelMapWindow({');
  const bag = src.slice(at, src.indexOf('...extra,', at));
  assert.match(bag, /holder: \{\s*\n\s*available: \(\) => !!weaponRig\?\.armsAvailable\?\.\(\),[^\n]*\n\s*\s*hold: \(spec, opts\) => !!weaponRig\?\.holdPaper\?\.\(spec, opts\),\s*\n\s*release: \(\) => \{ weaponRig\?\.releasePaper\?\.\(\); \},[\s\S]*?corners: \(\) => \(weaponRig\?\.armsDrawn\?\.\(\) \? weaponRig\.paperCorners\(\) : null\) \?\? null,\s*\n\s*\},/, 'AUDIT-MAP2: corners only from a frame the arm drew');
  assert.match(src, /window\.__heldPose = \(spec\) => \(spec \? weaponRig\?\.setHeldPose\?\.\(spec\) : weaponRig\?\.heldPose\?\.\(\)\);/);
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.hmroot\.hmlanehands \{ background: transparent; \}/, 'the world and the arm show through');
  assert.match(css, /\.hmroot\.hmlanehands \.hmink \{ will-change: transform; \}/);
});

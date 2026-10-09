// MWNPC1 (2026-10-09, Mac: "I wanna do everything and ensure that performance isnt affected"): THE SKIN ON THE
// GPU - the first slice of the MW-NPC arc (bible/04-Characters/Morrowind-NPCs.md). Every third-person Morrowind body
// was skinned on the CPU per body per posed frame and its whole stream re-uploaded; it is laid out once now
// (formats/mwGpuSkin.js), a pose writes a palette, and the vertex shader blends (renderer.js CHAR_SKIN_VS).
//
// The pins hold the GPU skin to the CPU skin it replaces, not to itself: the stream's every corner, read by the
// shader's law (skinStreamCorner - the GLSL's function in JS, held to the GLSL's text below), lands where poseAssembly
// + packFpArm put it, on the real fixture arm and on a hand-built piece that carries every case rule 39 and rule 40
// tell apart; the face normal the fragment takes off its derivatives is the packed path's lit normal under a mirrored
// lens, a mirrored model and a race's unequal scales; the boxes rule 42 gives are never smaller than the fold; and
// the rig asks the renderer for a palette a pose and never re-uploads the stream.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { accumRootRef } from '../src/formats/mwSkin.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { skinLayout, skinSamePieces, packSkinStream, writeSkinPalette, skinnedVertex, skinStreamCorner, skinStreamFloats,
  SKIN_MAX_INFLUENCES, SKIN_PAL_ROW } from '../src/formats/mwGpuSkin.js';
import { SKIN_PAL_ROW as ROW_HOME, SKIN_PALETTE_UNIT } from '../src/render/skinPalette.js';
import { packFpArm, pieceLanes, createFpArm, FP_FLOATS, gpuSkinOn } from '../src/combat/fpArm.js';
import { skinNormalMatrix, skinFaceFs } from '../src/render/renderer.js';
import { EL_CHAR_FS } from '../src/render/enhancedLighting.js';
import { classicLook } from '../src/render/classicShadowLane.js';
import { lookAt, mirrorProjectionX, multiply, perspective, transformPoint, trs } from '../src/world/mat4.js';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const close = (a, b, tol = 2e-5) => Math.abs(a - b) <= tol * (1 + Math.abs(b));

/** a deterministic stream of numbers in (-1, 1) - no Math.random in a pin */
function rng(seed) {
  let h = seed >>> 0;
  return () => { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return ((h >>> 8) / 0x800000) - 1; };
}

/** THE FIXTURE ARM (perfrig1's): a skinned hand and a cuffed upper arm on armskel.nif, mirrored pieces included -
 *  and three hand-built pieces on its own bones that carry every case the layout must tell apart. */
async function fixtureArm() {
  const arm = await assembleFirstPersonArm({ skeletonBytes: f('armskel.nif'), parts: [{ slot: 'hand', bytes: f('armhand.nif') }, { slot: 'upperarm', bytes: f('armcuff.nif') }] });
  const tracks = extractTracks(parseNif(f('armidle.kf')));
  const refs = [...arm.skeleton.nodes.keys()];
  arm.pieces.push(...casesPieces(refs));
  return { arm, tracks, accumRoot: accumRootRef(arm.skeleton, tracks) };
}

/** Hand-built pieces on the skeleton's refs: a SKINNED one whose vertices are, in order - blended by two live bones
 *  (inexact weights that do not sum to one), by SIX (the second influence pair), by a live bone and a MISSING one
 *  (rule 40: skipped, not renormalised), by a missing bone alone (the collapse onto the post), by a weight of zero
 *  alone (the collapse too), by NO bone (untouched: the authored position), and by weights summing past one - with a
 *  rotated, translated skin transform, a shape transform and UVs that are not symmetric; a skinned one with a
 *  NEGATIVE weight (its own piece: the box law takes another branch for it); a RIGID one, mirrored, with a
 *  BoneOffset; a rigid one that HANGS. */
function casesPieces(refs) {
  const R = rng(7);
  const m3 = () => Array.from({ length: 9 }, () => R());
  const tr = () => ({ rotation: [0.36, 0.48, -0.8, -0.8, 0.6, 0, 0.48, 0.64, 0.6], translation: [R() * 3, R() * 3, R() * 3], scale: 1.1 });
  const positions = Float32Array.from({ length: 7 * 3 }, () => R() * 5);
  const bone = (ref, indices, weights) => ({ ref, indices: Uint16Array.from(indices), weights: Float32Array.from(weights), invBind: { a: m3(), t: [R(), R(), R()] } });
  const uvs = Float32Array.from({ length: 7 * 2 }, () => R());
  const skinned = {
    slot: 'cases', bone: 'x', kind: 'skinned', mirrored: false, source: null, attachRef: null, uvs, colors: null, material: null,
    batch: {
      positions, uvs, colors: null, material: null, indices: Uint16Array.from([0, 1, 2, 3, 4, 5, 6, 0, 1]),
      skin: {
        transform: tr(), shapeTransform: tr(), skeletonRoot: -1, rootBone: -1,
        bones: [
          bone(refs[1], [0, 1, 2], [0.61, 0.13, 0.2]),
          bone(refs[2], [0, 1], [0.27, 0.1]),
          bone(refs[3], [1, 6], [0.1, 0.3]),
          bone(null, [2, 3], [0.5, 0.9]),
          bone(refs[4], [1, 4, 6], [0.2, 0, 1.1]),
          bone(refs[5], [1], [0.15]),
          bone(refs[6 % refs.length], [1], [0.12]),
        ],
      },
    },
    positions: new Float32Array(21), indices: Uint16Array.from([0, 1, 2, 3, 4, 5, 6, 0, 1]),
  };
  const src = Float32Array.from({ length: 4 * 3 }, () => R() * 2);
  const rigid = { slot: 'casesRigid', bone: 'y', kind: 'rigid', mirrored: true, boneOffset: [0.3, -0.2, 0.7], hang: null,
    batch: null, source: src, attachRef: refs[2], uvs: null, colors: null, material: null,
    positions: new Float32Array(12), indices: Uint16Array.from([0, 1, 2, 2, 3, 0]) };
  const hang = { rot: Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]), hookLocal: [0.1, 0.2, 0.3], anchor: [0.05, 0, 0.4] };
  const hanging = { slot: 'casesHang', bone: 'z', kind: 'rigid', mirrored: false, boneOffset: null, hang,
    batch: null, source: Float32Array.from(src), attachRef: refs[3], uvs: null, colors: null, material: null,
    positions: new Float32Array(12), indices: Uint16Array.from([0, 1, 2]) };
  const negPos = Float32Array.from({ length: 3 * 3 }, () => R() * 4);
  const negative = {
    slot: 'casesNeg', bone: 'w', kind: 'skinned', mirrored: false, source: null, attachRef: null, uvs: null, colors: null, material: null,
    batch: { positions: negPos, uvs: null, colors: null, material: null, indices: Uint16Array.from([0, 1, 2]),
      skin: { transform: tr(), shapeTransform: null, skeletonRoot: -1, rootBone: -1,
        bones: [bone(refs[1], [0, 1, 2], [0.7, 1.2, 0.5]), bone(refs[2], [1, 2], [-0.4, 0.5])] } },
    positions: new Float32Array(9), indices: Uint16Array.from([0, 1, 2]),
  };
  // THE BOX'S CASES, where the general matrices above would hide them inside a loose hull: one bone that turns
  // little (an identity inverse bind) carrying vertices far from the origin - three at full weight, one at a fifth (the
  // blend lies a fifth of the way out: scaled, outside the hull), one blended only by a missing bone (the collapse onto
  // the post's translation, near the origin), and one no bone touches, standing far off on its own
  const I3 = { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
  const boxCases = {
    slot: 'casesBox', bone: 'v', kind: 'skinned', mirrored: false, source: null, attachRef: null, uvs: null, colors: null, material: null,
    batch: { positions: Float32Array.from([30, 31, 29, 31, 30, 30, 29, 30, 31, 30, 30, 30, 0, 0, 0, -50, 70, -20]), uvs: null, colors: null, material: null,
      indices: Uint16Array.from([0, 1, 2, 3, 4, 5]),
      skin: { transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [1, 2, 3], scale: 1 }, shapeTransform: null, skeletonRoot: -1, rootBone: -1,
        bones: [{ ref: refs[1], indices: Uint16Array.from([0, 1, 2, 3]), weights: Float32Array.from([1, 1, 1, 0.2]), invBind: I3 },
          { ref: null, indices: Uint16Array.from([4]), weights: Float32Array.from([1]), invBind: I3 }] } },
    positions: new Float32Array(18), indices: Uint16Array.from([0, 1, 2, 3, 4, 5]),
  };
  // and the fifth-weight vertex again, on a piece with nothing else to widen its box: only the scaled hull holds it
  const scaled = {
    slot: 'casesScale', bone: 'u', kind: 'skinned', mirrored: false, source: null, attachRef: null, uvs: null, colors: null, material: null,
    batch: { positions: Float32Array.from([30, 31, 29, 31, 30, 30, 29, 30, 31, 30, 30, 30]), uvs: null, colors: null, material: null,
      indices: Uint16Array.from([0, 1, 2, 1, 2, 3]),
      skin: { transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [1, 2, 3], scale: 1 }, shapeTransform: null, skeletonRoot: -1, rootBone: -1,
        bones: [{ ref: refs[1], indices: Uint16Array.from([0, 1, 2, 3]), weights: Float32Array.from([1, 1, 1, 0.2]), invBind: I3 }] } },
    positions: new Float32Array(12), indices: Uint16Array.from([0, 1, 2, 1, 2, 3]),
  };
  return [skinned, negative, boxCases, scaled, rigid, hanging];
}

const box = (b) => b && { minX: b.minX, minY: b.minY, minZ: b.minZ, maxX: b.maxX, maxY: b.maxY, maxZ: b.maxZ };
const contains = (outer, inner, eps = 1e-4) => outer.minX <= inner.minX + eps && outer.minY <= inner.minY + eps && outer.minZ <= inner.minZ + eps
  && outer.maxX >= inner.maxX - eps && outer.maxY >= inner.maxY - eps && outer.maxZ >= inner.maxZ - eps;

test('MWNPC1a the layout: entry 0 the identity, a post and a live bone each a skinned piece, a placement each rigid one; influences in bone order; the second pair only when a vertex needs it', async () => {
  const { arm } = await fixtureArm();
  const L = skinLayout(arm.pieces);
  assert.equal(L.ok, true, L.reason);
  assert.equal(SKIN_PAL_ROW, ROW_HOME, 'one home for the palette shape');
  assert.equal(L.pairs, 2, 'the cases piece blends one vertex by six bones - the second pair');
  assert.equal(L.most, 6);
  const cases = L.byPiece.get(arm.pieces.find((p) => p.slot === 'cases'));
  const bones = arm.pieces.find((p) => p.slot === 'cases').batch.skin.bones;
  assert.deepEqual([...cases.boneEntry].map((e) => e >= 0), bones.map((b) => b.ref != null), 'a missing bone takes no entry');
  const slots = (v) => Array.from({ length: SKIN_MAX_INFLUENCES }, (_, s) => [cases.infE[v * SKIN_MAX_INFLUENCES + s], cases.infW[v * SKIN_MAX_INFLUENCES + s]]).filter(([e, w]) => e !== 0 || w !== 0);   // every slot written - a zero weight carried would show
  assert.deepEqual(slots(0).map(([e]) => e), [cases.boneEntry[0], cases.boneEntry[1]], 'vertex 0: its two bones, in bone order');
  assert.deepEqual(slots(1).map(([e]) => e), [0, 1, 2, 4, 5, 6].map((j) => cases.boneEntry[j]), 'vertex 1: six live bones in bone order; the zero weight dropped');
  assert.deepEqual(slots(2).map(([e]) => e), [cases.boneEntry[0]], 'vertex 2: the missing bone skipped (rule 40)');
  assert.deepEqual(slots(3), [], 'vertex 3: only a missing bone - no influence, the collapse');
  assert.deepEqual(slots(4), [], 'vertex 4: only a zero weight - the collapse too');
  assert.equal(cases.postE[3], cases.post); assert.equal(cases.postE[4], cases.post);
  assert.deepEqual(slots(5), [[0, 1]], 'vertex 5: untouched - the identity entry, weight one');
  assert.equal(cases.postE[5], 0, 'and an identity post: its authored position, as skinBatch keeps it');
  // the palette is three texels an entry, SKIN_PAL_ROW entries a row
  assert.equal(L.width, 3 * Math.min(L.entries, SKIN_PAL_ROW));
  assert.equal(L.palette.length, L.width * L.height * 4);
});

test('MWNPC1b the law: every vertex and every stream corner, by the shader\'s law off the palette, lands where the CPU skin and the pack put it - at several poses', async () => {
  const { arm, tracks, accumRoot } = await fixtureArm();
  const L = skinLayout(arm.pieces);
  const packed = packSkinStream(L, pieceLanes);
  assert.equal(packed.floats, skinStreamFloats(L.pairs));
  let cpu = null;
  for (const time of [0, 0.37, 1.1, 2.6]) {
    poseAssembly(arm, { tracks, sampleTrack, time, accumRoot });
    cpu = packFpArm(arm.pieces, cpu);
    writeSkinPalette(L, arm);
    for (const r of L.rows) {
      for (let v = 0; v < r.n; v++) {
        const got = skinnedVertex(L, r.piece, v);
        for (let k = 0; k < 3; k++) assert.ok(close(got[k], r.piece.positions[v * 3 + k]), `t ${time} ${r.piece.slot} v${v}[${k}]: ${got[k]} vs ${r.piece.positions[v * 3 + k]}`);
      }
    }
    const corners = cpu.packed.length / FP_FLOATS;
    assert.equal(corners, packed.stream.length / packed.floats, 'one corner for each the pack writes');
    for (let c = 0; c < corners; c++) {
      const got = skinStreamCorner(packed.stream, packed.floats, L.pairs, c, L.palette);
      const o = c * FP_FLOATS, s = c * packed.floats;
      for (let k = 0; k < 3; k++) assert.ok(close(got[k], cpu.packed[o + k]), `t ${time} corner ${c}[${k}]: ${got[k]} vs ${cpu.packed[o + k]}`);
      // the static lanes: the pack's diffuse (3-5), UV (9-10) and emission (11-13), bit for bit
      assert.deepEqual([...packed.stream.subarray(s + 3, s + 11)], [...cpu.packed.subarray(o + 3, o + 6), ...cpu.packed.subarray(o + 9, o + 14)], `corner ${c}: the static floats are the pack's`);
    }
  }
  assert.deepEqual(packed.ranges.map((r) => [r.first, r.count, r.slot, r.piece, r.textureFile]), cpu.ranges.map((r) => [r.first, r.count, r.slot, r.piece, r.textureFile]), 'the ranges are the pack\'s');
});

test('MWNPC1c the boxes (rule 42): off the palette alone, every piece\'s box holds the CPU fold\'s, and the union the assembly\'s bounds - at every pose; a CPU-skinned pose keeps its exact fold', async () => {
  const { arm, tracks, accumRoot } = await fixtureArm();
  const L = skinLayout(arm.pieces);
  for (const time of [0, 0.37, 1.1, 2.6, 3.3]) {
    poseAssembly(arm, { tracks, sampleTrack, time, accumRoot });
    const exact = new Map(arm.pieces.map((p) => [p, box(p.box)]));
    const bounds = box(arm.bounds);
    writeSkinPalette(L, arm);
    for (const p of arm.pieces) assert.deepEqual(box(p.box), exact.get(p), 'a CPU-skinned pose: the fold stands, untouched by the palette');
    assert.equal(arm.cpuSkinned, true);
    poseAssembly(arm, { tracks, sampleTrack, time, accumRoot, skin: false });
    assert.equal(arm.cpuSkinned, false);
    writeSkinPalette(L, arm);
    for (const p of arm.pieces) assert.ok(contains(p.box, exact.get(p)), `t ${time} ${p.slot}: the palette's box ${JSON.stringify(box(p.box))} holds the fold ${JSON.stringify(exact.get(p))}`);
    assert.ok(contains(arm.bounds, bounds), 'and the union the assembly\'s bounds');
  }
});

test('MWNPC1d skin: false poses the skeleton and leaves the pieces - no CPU blend, no placement, no fold', async () => {
  const { arm, tracks, accumRoot } = await fixtureArm();
  poseAssembly(arm, { tracks, sampleTrack, time: 0.5, accumRoot });
  const before = arm.pieces.map((p) => Float32Array.from(p.positions));
  const calls = { skin: 0 };
  const skinBatch = arm.fns.skinBatch;
  arm.fns = { ...arm.fns, skinBatch: (...a) => { calls.skin++; return skinBatch(...a); } };
  const mats = arm.mats;
  poseAssembly(arm, { tracks, sampleTrack, time: 1.7, accumRoot, skin: false });
  assert.equal(calls.skin, 0, 'no piece blended on the CPU');
  arm.pieces.forEach((p, i) => assert.deepEqual([...p.positions], [...before[i]], `${p.slot}: its CPU positions are left as they stood`));
  assert.notEqual(arm.mats, mats, 'and the skeleton WAS posed - this frame\'s matrices');
  poseAssembly(arm, { tracks, sampleTrack, time: 1.7, accumRoot });
  assert.ok(calls.skin > 0, 'the default still skins on the CPU');
});

test('MWNPC1e a vertex past the shader\'s eight influences is REFUSED with a sentence, never trimmed (rule 39); a piece list is matched by identity', async () => {
  const { arm } = await fixtureArm();
  const cases = arm.pieces.find((p) => p.slot === 'cases');
  const refs = [...arm.skeleton.nodes.keys()];
  const nine = Array.from({ length: 9 }, (_, i) => ({ ref: refs[i % refs.length], indices: Uint16Array.from([0]), weights: Float32Array.from([0.1]), invBind: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } }));
  const wide = { ...cases, batch: { ...cases.batch, skin: { ...cases.batch.skin, bones: nine } } };
  const refused = skinLayout([wide]);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /9 bones/);
  // a weight of zero is no influence: four live bones and a fifth at zero is ONE pair, not two
  const fourAndZero = nine.slice(0, 5).map((b, i) => ({ ...b, weights: Float32Array.from([i === 4 ? 0 : 0.25]) }));
  const four = skinLayout([{ ...wide, batch: { ...wide.batch, skin: { ...wide.batch.skin, bones: fourAndZero } } }]);
  assert.equal(four.ok, true);
  assert.equal(four.most, 4, 'the zero weight is not counted');
  assert.equal(four.pairs, 1);
  const eight = skinLayout([{ ...wide, batch: { ...wide.batch, skin: { ...wide.batch.skin, bones: nine.slice(0, 8) } } }]);
  assert.equal(eight.ok, true, 'eight is carried');
  assert.equal(eight.pairs, 2);
  const L = skinLayout(arm.pieces);
  assert.equal(skinSamePieces(L, arm.pieces), true);
  assert.equal(skinSamePieces(L, [...arm.pieces]), true, 'a copied list of the same pieces is the same body');
  assert.equal(skinSamePieces(L, arm.pieces.map((p) => (p === cases ? { ...p } : p))), false, 'a swapped piece is not');
  assert.equal(skinSamePieces(L, arm.pieces.slice(1)), false, 'nor a shorter list');
  assert.equal(skinSamePieces(L, arm.pieces.slice(0, -1)), false, 'nor a prefix of the same pieces');
});

/** The fragment shader's face normal (renderer.js SKIN_FACE_DECL charFaceNormal), in JS: the derivatives of vRel
 *  over a triangle drawn at window positions sa, sb, sc, the winding against the front face, the normal matrix and
 *  the flip. */
function fsFaceNormal(A, B, C, sa, sb, sc, { frontCW, nrm, flip }) {
  const u = [sb[0] - sa[0], sb[1] - sa[1]], v = [sc[0] - sa[0], sc[1] - sa[1]];
  const det = u[0] * v[1] - u[1] * v[0];
  const AB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], AC = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const dx = [0, 1, 2].map((k) => (AB[k] * v[1] - AC[k] * u[1]) / det);
  const dy = [0, 1, 2].map((k) => (AC[k] * u[0] - AB[k] * v[0]) / det);
  const d = cross(dx, dy);
  const front = frontCW ? det < 0 : det > 0;   // GL: a positive window area is counter-clockwise
  const ccw = front !== frontCW;
  const nw = ccw ? d : d.map((x) => -x);
  const n = [0, 1, 2].map((r) => flip * (nrm[r] * nw[0] + nrm[3 + r] * nw[1] + nrm[6 + r] * nw[2]));   // column-major mat3 x vec3
  return norm(n);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };

test('MWNPC1f the face normal: the derivatives\' cross, signed by the winding against the CW front face, through sign(det M) M M^T and the flip, IS the packed path\'s lit normal - mirrored lens, mirrored model, unequal race scales', () => {
  const R = rng(11);
  const proj = mirrorProjectionX(perspective(1.1, 1.4, 0.1, 500));
  const view = lookAt([3, 2, 9], [0, 1, 0], [0, 1, 0]);
  const W = 640, H = 480;
  const toWindow = (w) => {
    const pv = multiply(proj, view);
    const x = pv[0] * w[0] + pv[4] * w[1] + pv[8] * w[2] + pv[12], y = pv[1] * w[0] + pv[5] * w[1] + pv[9] * w[2] + pv[13];
    const q = pv[3] * w[0] + pv[7] * w[1] + pv[11] * w[2] + pv[15];
    return [(x / q + 1) / 2 * W, (y / q + 1) / 2 * H];
  };
  let tested = 0;
  for (const [sx, sy, sz] of [[-0.0143, 0.0157, 0.013], [0.012, 0.012, 0.012], [-0.011, 0.0149, 0.0118]]) {
    const model = multiply(trs(0.2, 0.1, -0.3, 23, 37, 11, sx, sy, sz), trs(0, 0, 0, -90, 0, 0));   // turned about all three axes: M M^T has every off-diagonal
    const nrm = skinNormalMatrix(model);
    const m3 = (p) => [model[0] * p[0] + model[4] * p[1] + model[8] * p[2], model[1] * p[0] + model[5] * p[1] + model[9] * p[2], model[2] * p[0] + model[6] * p[1] + model[10] * p[2]];
    for (const flip of [1, -1]) {
      for (let i = 0; i < 40; i++) {
        const a = [R() * 60, R() * 60, R() * 60 + 60], b = [a[0] + R() * 20, a[1] + R() * 20, a[2] + R() * 20], c = [a[0] + R() * 20, a[1] + R() * 20, a[2] + R() * 20];
        // the packed path: flip x normalize(cross(b - a, c - a)) in the model, then the VS's mat3(uModel), then the FS's normalize
        const nm = norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])).map((x) => x * flip);
        const want = norm(m3(nm));
        const got = fsFaceNormal(m3(a), m3(b), m3(c), toWindow(transformPoint(model, ...a)), toWindow(transformPoint(model, ...b)), toWindow(transformPoint(model, ...c)), { frontCW: true, nrm, flip });
        const dot = got[0] * want[0] + got[1] * want[1] + got[2] * want[2];
        assert.ok(dot > 1 - 1e-6, `scale ${sx},${sy},${sz} flip ${flip} tri ${i}: ${got} vs ${want}`);
        tested++;
      }
    }
  }
  assert.equal(tested, 240);
});

test('MWNPC1g the GLSL says what its JS law says: the blend, the post composed once, the face normal\'s sign and matrices; every lane\'s character shader takes the edit, and one without the input refuses it', () => {
  const src = rd('src/render/renderer.js');
  const vs = src.match(/const CHAR_SKIN_VS = `([\s\S]*?)`;/)[1];
  for (const line of [
    'int row = g / ${SKIN_PAL_ROW};',
    'int col = (g - row * ${SKIN_PAL_ROW}) * 3;',
    'a0 += r0 * w; a1 += r1 * w; a2 += r2 * w;',
    'if (uSkin > 1.5) {',
    'skinEntry(aSkinPost, q0, q1, q2);',
    'vec4 c0 = q0.x * a0 + q0.y * a1 + q0.z * a2 + vec4(0.0, 0.0, 0.0, q0.w);',
    'return vec3(dot(c0.xyz, p) + c0.w, dot(c1.xyz, p) + c1.w, dot(c2.xyz, p) + c2.w);',
    'vec3 p = uSkin > 0.5 ? skinned(aPos) : aPos;',
    'vRel = mat3(uModel) * p;',
    'vec4 world = uModel * vec4(p, 1.0);',
  ]) assert.ok(vs.includes(line), `CHAR_SKIN_VS: ${line}`);
  for (const line of [
    'vec3 d = cross(dFdx(vRel), dFdy(vRel));',
    'if (uSkin < 0.5) return vNormalV;',
    'bool ccw = gl_FrontFacing != (uFrontCW > 0.5);',
    'vec3 nw = ccw ? d : -d;',
    'return normalize(uSkinFlip * (uSkinNrm * nw));',
  ]) assert.ok(src.includes(line), `the face normal: ${line}`);
  assert.ok(src.includes('char: this._charSkinProgram(src.charFs),') && src.includes('const program = this._buildProgram(CHAR_SKIN_VS, skinFaceFs(fs));'), 'the world set builds its character program from the skin VS and the edited lane shader');
  assert.ok(src.includes("vs: { mesh: VS, bb: BB_VS, terrain: TERRAIN_VS, char: CHAR_VS }"), 'the shadow pass keeps the unskinned CHAR_VS');
  const classic = src.match(/const CHAR_FS = `([\s\S]*?)`;/)[1];
  for (const [name, fs] of [['classic', classic], ['lane', EL_CHAR_FS], ['classic-shadow lane', classicLook(EL_CHAR_FS)]]) {
    const out = skinFaceFs(fs);
    assert.ok(out.includes('vec3 vNormal;') && !out.includes('in vec3 vNormal;'), `${name}: the input became the global`);
    assert.ok(out.includes('void main() {\n  vNormal = charFaceNormal();'), `${name}: filled at the top of main, before any discard`);
  }
  assert.throws(() => skinFaceFs('#version 300 es\nvoid main() {}'), /MWNPC1/);
  assert.equal(SKIN_PALETTE_UNIT, 21);
});

test('MWNPC1h drawCharacter: the palette sampler always reads a complete texture, the body\'s for its draw and the identity after; a skinned body never records a shadow', () => {
  const src = rd('src/render/renderer.js');
  const draw = src.slice(src.indexOf('  drawCharacter(mesh, modelMatrix) {'), src.indexOf('  _charSpriteRT() {'));
  assert.ok(rd('src/render/shadowPass.js').includes('  recordCharacter(mesh, matrix) {') && /recordCharacter\(mesh, matrix\) \{[\s\S]{0,400}if \(mesh && mesh\.skin\) return;/.test(rd('src/render/shadowPass.js')), 'the shadow door turns a skinned body away');
  assert.ok(draw.includes('    if (skin) {\n      gl.uniform1f(c.skin, skin.pairs);'), 'uSkin set only by a skinned draw (LA-COST1: an unskinned call sends nothing new)');
  assert.ok(draw.includes('gl.bindTexture(gl.TEXTURE_2D, skin.tex);'));
  const once = src.slice(src.indexOf('  _charSkinProgram(fs) {'), src.indexOf('  /** LA-COST7 (2026-09-27, Mac: "performance improvements"): THE SET\'S LOCATIONS'));
  assert.ok(once.includes("gl.uniform1i(gl.getUniformLocation(program, 'uSkinPalette'), SKIN_PALETTE_UNIT);"), 'the palette unit, set at link');
  assert.ok(once.includes("gl.uniform1f(gl.getUniformLocation(program, 'uFrontCW'), 1);") && src.includes('    gl.frontFace(gl.CW);'), 'and the front face, CW as the constructor sets it');
  assert.ok(once.includes('this._skinIdentityTex();'), 'and the identity on the unit');
  assert.ok(draw.includes("if (skin) gl.uniform1f(c.skinFlip, r.piece && r.piece.mirrored ? -1 : 1);"), 'the flip, per piece');
  const after = draw.slice(draw.indexOf("if (skin) {\n      // MWNPC1: the identity back on the unit"));
  assert.ok(after.includes('gl.bindTexture(gl.TEXTURE_2D, this._skinIdentityTex());') && after.includes('gl.uniform1f(c.skin, 0);'), 'the identity back, and the skin off, after a skinned draw');
});

/** the counting renderer, with the skinned path: meshes minted each way, palettes written, streams re-uploaded */
function skinRenderer() {
  const r = countingRenderer();
  Object.assign(r.c, { skinMeshes: 0, palettes: 0, thirdPacked: 0 });
  const plain = r.createCharacterMesh;
  r.createCharacterMesh = (packed, opts) => { if (opts && opts.bounds === false) r.c.thirdPacked++; return plain(packed, opts); };
  r.createSkinnedCharacterMesh = (stream, o) => { r.c.skinMeshes++; return { vao: {}, buffers: [], count: stream.length / o.floats, floats: o.floats, skin: { tex: {}, ...o } }; };
  r.updateSkinPalette = (mesh, data) => { r.c.palettes++; r.lastPalette = Float32Array.from(data); };
  r.releaseCharacterSkin = () => {};
  return r;
}
const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });

test('MWNPC1i the rig: a third-person body on a renderer with the skinned path is laid out once and posed by its palette alone - no stream re-upload, no packed mesh; the door shuts it back to the CPU skin', async () => {
  const renderer = skinRenderer();
  const arm = createFpArm();
  arm.attach(renderer, cam);
  const res = await arm.build({ race: 'fprace', deps: fixtureBodyDeps() });
  assert.equal(res.ok, true, res.error);
  assert.equal(arm.setViewMode('third'), true);
  arm.update(1 / 60);
  const cpuOf = () => arm.thirdMesh().ranges.map((r) => [...r.piece.positions]);
  const before = cpuOf(), palette0 = renderer.lastPalette;
  for (let i = 0; i < 5; i++) arm.update(1 / 60);
  assert.notDeepEqual([...renderer.lastPalette], [...palette0], 'the fixture idle animates - the palette follows it');
  assert.deepEqual(cpuOf(), before, 'and no piece was blended or placed on the CPU while it did (poseAssembly skin: false)');
  assert.equal(renderer.c.skinMeshes, 1, 'one skinned mesh, laid out once');
  assert.equal(renderer.c.palettes, 6, 'a palette each posed frame');
  assert.equal(renderer.c.uploads, 0, 'and not one stream re-upload');
  assert.equal(renderer.c.thirdPacked, 0, 'no packed third-person mesh minted');
  assert.equal(arm.status().third.skin, 'gpu');
  assert.ok(arm.thirdMesh().skin, 'the body\'s mesh is the skinned one');
  arm.update(1 / 60, { pose: false });
  assert.equal(renderer.c.palettes, 6, 'a clocks-only step writes no palette (PEER-CADENCE)');
  const drawn = arm.drawThird({ clientHeight: 480, clientWidth: 640 }, { proj: perspective(1.1, 1.3, 0.1, 100), view: lookAt([0, 1.5, 4], [0, 1, 0], [0, 1, 0]), eye: [0, 1.5, 4], feet: [0, 0, 0], yaw: 0 });
  assert.equal(drawn, true, 'the body draws, framed by the palette\'s boxes');
  assert.equal(renderer.c.sprites, 1);
  // the bisect door
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search: '?gpuskin=off' }, configurable: true, writable: true });
  try {
    assert.equal(gpuSkinOn(renderer), false);
    arm.update(1 / 60);
    assert.equal(arm.status().third.skin, 'cpu', '?gpuskin=off: the CPU skin');
    assert.equal(renderer.c.uploads + renderer.c.thirdPacked >= 1, true, 'its packed mesh minted');
    assert.equal(arm.thirdMesh().skin, undefined);
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
  arm.update(1 / 60);
  assert.equal(arm.status().third.skin, 'gpu', 'the door open again: laid out again');
  assert.equal(renderer.c.skinMeshes, 2);
  assert.equal(gpuSkinOn(countingRenderer()), false, 'a renderer without the path keeps the CPU skin - every earlier pin\'s renderer');
  // the third-person muzzle asks the palette for its one point (skinnedVertex - MWNPC1b holds it to the CPU skin)
  const src = rd('src/combat/fpArm.js');
  assert.ok(src.includes('const at = thirdMesh && thirdMesh.skin && thirdSkin ? skinnedVertex(thirdSkin, piece, muzzleIndexOf(piece)) : posedVertex(piece.positions, muzzleIndexOf(piece));'));
});

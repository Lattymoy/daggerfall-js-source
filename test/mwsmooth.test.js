// MW-SMOOTH (2026-10-09, Mac: "Can we also enable smooth shading for the morrowind models? Not sure what type of
// shading is used now"): THE MORROWIND MODELS LIT BY THEIR OWN NORMALS.
//
// What was used: every Morrowind mesh - the arms, the body, the worn armour, the held weapon, the icons - was lit by
// one normal per TRIANGLE, its face's, computed at pack time; the per-vertex normals each NIF carries were read and
// kept by flattenNif and then dropped, because poseAssembly posed positions alone. Every surface came out faceted,
// even the steel plate and the brigandine, whose baked NIFs carry smooth normals. The reference lights a NIF by the
// normals the file authors and makes none (Morrowind-Rules.md rule [C]). Now a piece carries its mesh's normals
// through the pose - skinned by skinBatch, a rigid part's mirrored and turned with it, a brigandine's through its
// transferred skin - and packFpArm writes each corner its vertex's normal; a mesh with none is lit by its faces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { transferSkin } from '../src/formats/mwSkinTransfer.js';
import { assembleFirstPersonArm, poseAssembly, placeNormalsAtBone } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { ownBodyPart, packFpArm, FP_FLOATS } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { writeNif, meshToNif } from '../tools/nifWrite.mjs';
import { retailSkeleton, bindPoseTracks } from './fixtures/mw/retailRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const SET = [102, 103, 104, 105, 106, 107, 108].map((templateIndex) => ({ templateIndex, material: ARMOR_MATERIAL.Steel }));
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const mul3 = (a, v) => [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]];
const mul33 = (x, y) => Array.from({ length: 9 }, (_, i) => x[Math.floor(i / 3) * 3] * y[i % 3] + x[Math.floor(i / 3) * 3 + 1] * y[3 + i % 3] + x[Math.floor(i / 3) * 3 + 2] * y[6 + i % 3]);
const gap = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
const at3 = (arr, v) => [arr[v * 3], arr[v * 3 + 1], arr[v * 3 + 2]];
/** Each corner's packed normal, in corner order. */
const packedNormals = (pieces) => {
  const { packed } = packFpArm(pieces);
  const out = [];
  for (let o = 0; o < packed.length; o += FP_FLOATS) out.push([packed[o + 6], packed[o + 7], packed[o + 8]]);
  return out;
};

test('MW-SMOOTH: a skinned piece\'s own normals are posed with it and packed per corner - the steel plate on retail\'s skeleton, lit smooth; a mesh with none lit by its faces', async () => {
  const worn = composeWornArmor({ pieces: SET, armors: [], bodyPool: [], helmStyle: 'closed' });
  const parts = worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: new Uint8Array(raw(`src/assets/mw/meshes/${a.model}`)), ...ownBodyPart(a, [], () => null) }));
  const skeletonBytes = retailSkeleton();
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts });
  assert.ok(asm.pieces.length >= 12);
  for (const p of asm.pieces) assert.equal(p.normals?.length, p.positions.length, `${p.slot}: a normal a vertex`);
  // in the bind the skin is the file's own frame, moved and never turned: every normal is the NIF's
  const { tracks, sampleTrack } = bindPoseTracks(skeletonBytes);
  poseAssembly(asm, { tracks, sampleTrack });
  for (const p of asm.pieces) {
    let worst = 0;
    for (let v = 0; v < p.positions.length / 3; v++) worst = Math.max(worst, gap(at3(p.normals, v), at3(p.batch.normals, v)));
    assert.ok(worst < 1e-4, `${p.slot}: in the bind its normals are the file's (worst ${worst})`);
  }
  // in the idle the helm's - one bone, the head - turn exactly as the head does
  poseAssembly(asm, {});
  const helm = asm.pieces.find((p) => p.slot.startsWith('hair'));
  const head = helm.batch.skin.bones.find((b) => b.name === 'bip01 head');
  const turn = mul33(asm.mats.get(head.ref).a, Array.from(head.invBind.a));
  let worst = 0;
  for (let v = 0; v < helm.positions.length / 3; v++) worst = Math.max(worst, gap(at3(helm.normals, v), unit(mul3(turn, at3(helm.batch.normals, v)))));
  assert.ok(worst < 1e-4, `the helm's normals turn with the head (worst ${worst})`);
  // the pack writes each corner its vertex's normal - so across a smoothed surface a triangle's three corners differ
  const cuirass = asm.pieces.find((p) => p.slot.startsWith('cuirass'));
  const corners = packedNormals([cuirass]);
  let k = 0; let smooth = 0;
  for (let i = 0; i < cuirass.indices.length; i += 3, k += 3) {
    for (let c = 0; c < 3; c++) assert.ok(gap(corners[k + c], at3(cuirass.normals, cuirass.indices[i + c])) < 1e-6);
    if (gap(corners[k], corners[k + 1]) > 1e-3 || gap(corners[k], corners[k + 2]) > 1e-3) smooth++;
  }
  assert.ok(smooth > cuirass.indices.length / 3 / 2, `the breastplate is lit smooth: ${smooth} of ${cuirass.indices.length / 3} triangles' corners differ`);
  // and a mesh that authored no normals is lit by its faces, one normal a triangle
  const flat = packedNormals([{ ...cuirass, normals: null }]);
  for (let i = 0; i < flat.length; i += 3) assert.ok(gap(flat[i], flat[i + 1]) < 1e-6 && gap(flat[i], flat[i + 2]) < 1e-6);
});

test('MW-SMOOTH: a rigid part\'s normals are mirrored and turned with it - a flat face authored with its own normal packs that face\'s normal on either side, and through a pre-transform', async () => {
  // one triangle, tilted, its three normals its own face's (counter-clockwise)
  const P = [1, 0, 0, 0, 2, 0.5, 0, 0, 3];
  const u = [P[3] - P[0], P[4] - P[1], P[5] - P[2]]; const w = [P[6] - P[0], P[7] - P[1], P[8] - P[2]];
  const n = unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
  const bytes = meshToNif({ name: 'Plate', positions: P, normals: [...n, ...n, ...n], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] }, { texture: 'x.dds', node: 'Plate' });
  const parts = [
    { slot: 'hand', partName: 'hand', bones: ['left hand', 'right hand'], bytes },
    { slot: 'arrow', partName: 'arrow', bones: ['right hand'], bytes, preTransform: { a: [0, -1, 0, 1, 0, 0, 0, 0, 1], t: [5, 0, 0] } },
  ];
  const asm = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts });
  poseAssembly(asm, {});
  const rigid = asm.pieces.filter((p) => p.kind === 'rigid');
  assert.deepEqual(rigid.map((p) => [p.slot, p.mirrored]), [['hand', true], ['hand', false], ['arrow', false]]);
  for (const p of rigid) {
    const smooth = packedNormals([p]);
    const faces = packedNormals([{ ...p, normals: null }]);
    for (let c = 0; c < 3; c++) assert.ok(gap(smooth[c], faces[0]) < 1e-5, `${p.slot}${p.mirrored ? ' (mirrored)' : ''}: corner ${c} ${smooth[c].map((x) => x.toFixed(3))} is the face's ${faces[0].map((x) => x.toFixed(3))}`);
  }
  // the law alone: mirrored, then turned by the bone; a bone's scale renormalised away
  const at = { a: [0, -2, 0, 2, 0, 0, 0, 0, 2], t: [9, 9, 9] };
  assert.deepEqual(Array.from(placeNormalsAtBone(new Float32Array([1, 0, 0]), at, false)), [0, 1, 0]);
  assert.deepEqual(Array.from(placeNormalsAtBone(new Float32Array([1, 0, 0]), at, true)).map((x) => x + 0), [0, -1, 0]);
});

test('MW-SMOOTH: a garment\'s normals ride its transferred skin - skinned in the pose it was fitted in, each is the normal it was authored with', () => {
  const deg = Math.PI / 180;
  const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const skeleton = buildSkeleton(parseNif(writeNif([
    { type: 'NiNode', name: 'Root', children: [1] },
    { type: 'NiNode', name: 'Bip01 Pelvis', translation: [0, 0, 60], rotation: rotZ(90 * deg), children: [2] },
    { type: 'NiNode', name: 'Bip01 Spine', translation: [0, 0, 12], rotation: rotX(-20 * deg), children: [] },
  ], [0])));
  // a skinned body, weighted across two bones whose inverse binds are not the rest - so the solve has a real turn to undo
  const positions = []; const pel = { i: [], w: [] }; const spi = { i: [], w: [] };
  let n = 0;
  for (let z = 0; z <= 30; z += 3) {
    for (let a = 0; a < 360; a += 30) {
      positions.push(8 * Math.cos(a * deg), 5 * Math.sin(a * deg), z);
      const s = z / 30;
      if (s < 1) { pel.i.push(n); pel.w.push(1 - s); }
      if (s > 0) { spi.i.push(n); spi.w.push(s); }
      n++;
    }
  }
  const body = { name: 'Tri Chest', skinned: true, positions: Float32Array.from(positions), normals: null, uvs: null, indices: new Uint16Array(0),
    skin: { skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT, transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 }, shapeTransform: null,
      bones: [
        { ref: skeleton.byName.get('bip01 pelvis'), name: 'bip01 pelvis', invBind: { a: Float32Array.from(rotZ(-80 * deg)), t: [1, -3, -2] }, indices: pel.i, weights: pel.w },
        { ref: skeleton.byName.get('bip01 spine'), name: 'bip01 spine', invBind: { a: Float32Array.from(rotX(15 * deg)), t: [0, -1, -9] }, indices: spi.i, weights: spi.w },
      ] } };
  const pose = poseSkeleton(skeleton, null, null, 0, {});
  const mats = skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT);
  const rest = new Float32Array(body.positions.length);
  skinBatch(body, skeleton, pose, mats, rest, null);
  // the garment laid on the body at rest, each vertex's normal pointing out from the body's axis and a little up
  const G = Array.from(rest); const N = []; const I = [];
  for (let v = 0; v < n; v++) N.push(...unit([G[v * 3], G[v * 3 + 1], 0.3]));
  for (let v = 0; v + 13 < n; v++) if ((v + 1) % 12) I.push(v, v + 1, v + 12, v + 1, v + 13, v + 12);
  const garment = { name: 'Brigandine', positions: Float32Array.from(G), normals: Float32Array.from(N), uvs: new Float32Array(n * 2), indices: Uint16Array.from(I), material: null };
  const [g] = transferSkin(garment, [body], { skeleton, pose, mats, skinBatch });
  assert.equal(g.normals?.length, g.positions.length, 'the transferred batch carries a normal a vertex');
  const posP = new Float32Array(g.positions.length); const posN = new Float32Array(g.positions.length);
  skinBatch(g, skeleton, pose, mats, posP, posN);
  let worst = 0; let turned = 0;
  for (let k = 0; k < posP.length / 3; k++) {
    let best = -1; let bd = Infinity;
    for (let v = 0; v < n; v++) { const d = gap(at3(posP, k), at3(G, v)); if (d < bd) { bd = d; best = v; } }
    assert.ok(bd < 1e-3, `garment vertex ${k} lands where it was fitted`);
    worst = Math.max(worst, gap(at3(posN, k), at3(N, best)));
    if (gap(at3(g.normals, k), at3(N, best)) > 1e-2) turned++;
  }
  assert.ok(worst < 1e-4, `skinned at rest, every normal is the one it was authored with (worst ${worst})`);
  assert.ok(turned > 10, `the solve undid a real turn (${turned} stored normals differ from the authored)`);
});

// MW-BRIG3 (2026-09-29, Mac on MW-BRIG2: "completely broke the morrowind torso" - asked what it looks like: "it's
// placed lower where the torso should be", only with the brigandine worn, on a male body): THE BRIGANDINE IS FITTED
// ONTO THE WEARER.
//
// MW-BRIG1 and MW-BRIG2 both drew the brigandine at the height of the modeller's scene, taken on faith as the
// skeleton at rest. That scene's body stood lower than the Morrowind body - the brigandine's own collar peaks at z 94.8
// and its belt at ~67 - so it sat under the torso, and since the cuirass slot hides the chest skin, the chest above it
// was left bare. These pins build a Morrowind-proportioned male (neck base at z 106, waist ~76) and bind the SHIPPED
// brigandine through the real binder: the old placement reproduced first, then the fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { fitLift, liftBatch } from '../src/formats/mwSkinTransfer.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { OWN_MW_ARMOR, RRI_JERKIN_TEMPLATE } from '../src/characters/ownArmorModels.js';
import { writeNif, meshToNif } from '../tools/nifWrite.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../${p}`, import.meta.url)));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BRIGANDINE = onDisk('src/assets/mw/meshes/brigandine_steel.nif');
const BAKED = flattenNif(parseNif(BRIGANDINE))[0].positions;
const deg = Math.PI / 180;

// ── a Morrowind-proportioned male, the parts hung where retail hangs them ──────────────────────────────────────────
// Bip01 bones carry the body; the part nodes (Chest, Groin, Left Upper Leg, ...) are their children, as base_anim's are.
function skeletonBytes() {
  return writeNif([
    { type: 'NiNode', name: 'Bip01', children: [1] },
    { type: 'NiNode', name: 'Bip01 Pelvis', translation: [0, 0, 68], children: [2, 7, 11, 15] },
    { type: 'NiNode', name: 'Bip01 Spine', translation: [0, 0, 8], children: [3] },
    { type: 'NiNode', name: 'Bip01 Spine1', translation: [0, 0, 10], children: [4, 6] },
    { type: 'NiNode', name: 'Bip01 Spine2', translation: [0, 0, 10], children: [5] },
    { type: 'NiNode', name: 'Bip01 Neck', translation: [0, 0, 10], children: [] },   // the neck's base, z 106
    { type: 'NiNode', name: 'Chest', translation: [0, 0, 0], children: [] },   // z 86
    { type: 'NiNode', name: 'Bip01 L Thigh', translation: [8, 0, -4], children: [8, 10] },
    { type: 'NiNode', name: 'Bip01 L Calf', translation: [0, 0, -28], children: [9] },
    { type: 'NiNode', name: 'Left Knee', translation: [0, 0, 0], children: [] },
    { type: 'NiNode', name: 'Left Upper Leg', translation: [0, 0, 0], children: [] },
    { type: 'NiNode', name: 'Bip01 R Thigh', translation: [-8, 0, -4], children: [12, 14] },
    { type: 'NiNode', name: 'Bip01 R Calf', translation: [0, 0, -28], children: [13] },
    { type: 'NiNode', name: 'Right Knee', translation: [0, 0, 0], children: [] },
    { type: 'NiNode', name: 'Right Upper Leg', translation: [0, 0, 0], children: [] },
    { type: 'NiNode', name: 'Groin', translation: [0, 0, 0], children: [] },   // z 68
  ], [0]);
}
/** A closed-sided tube of elliptic rings [z, rx, ry], bottom to top, in its part node's own frame. */
function tube(name, rings, segs = 16) {
  const positions = []; const indices = [];
  for (const [z, rx, ry] of rings) for (let s = 0; s < segs; s++) positions.push(rx * Math.cos((s / segs) * 2 * Math.PI), ry * Math.sin((s / segs) * 2 * Math.PI), z);
  for (let r = 0; r + 1 < rings.length; r++) for (let s = 0; s < segs; s++) {
    const a = r * segs + s; const b = r * segs + ((s + 1) % segs);
    indices.push(a, b, b + segs, a, b + segs, a + segs);
  }
  return meshToNif({ name, positions, normals: null, uvs: null, indices }, { node: name });
}
// The chest at the Chest node (z 86): waist 76, chest, shoulders at 102, the neck's base ring at 106 - its top.
const CHEST = tube('Chest', [[-10, 11, 8], [0, 12, 9], [10, 13, 9.5], [16, 14, 8], [20, 5, 4]]);
const GROIN = tube('Groin', [[-12, 12, 9], [0, 12, 9], [8, 11, 8]]);
const UPPER_LEG = tube('Upper Leg', [[-28, 5, 5], [0, 7, 7]]);
const KNEE = tube('Knee', [[-8, 4.5, 4.5], [2, 5, 5]]);
const CHEST_TOP = 106;

const BODY = [{ slot: 'groin', bytes: GROIN }, { slot: 'upperleg', bytes: UPPER_LEG }, { slot: 'knee', bytes: KNEE }];   // the chest is hidden
const SKIN_FROM = [{ slot: 'chest', bytes: CHEST }, ...BODY];
const brigandine = (extra = {}) => ({ slot: 'cuirass (daggerfall_brigandine_steel)', partName: 'cuirass', bones: ['chest'], bytes: BRIGANDINE, skinFrom: SKIN_FROM, ...extra });
const worn = (asm) => asm.pieces.filter((p) => p.slot === 'cuirass (daggerfall_brigandine_steel)');
const zRange = (arrays) => { let lo = Infinity; let hi = -Infinity; for (const a of arrays) for (let i = 2; i < a.length; i += 3) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); } return [lo, hi]; };
/** The chest as the body draws it at rest, in graph space - what the brigandine hides. */
async function chestAtRest() {
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [{ slot: 'chest', bytes: CHEST }] });
  return asm.pieces[0].positions;
}

test('MW-BRIG3: THE BUG - drawn at its baked height, the brigandine sits under the torso and leaves the chest it hides bare', async () => {
  const chest = await chestAtRest();
  assert.ok(Math.abs(zRange([chest])[1] - CHEST_TOP) < 1e-3);
  // MW-BRIG2's placement: skinned from the body, solved to land where the scene put it.
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [...BODY, brigandine()] });
  assert.ok(asm.ok, asm.error);
  const top = zRange(worn(asm).map((p) => p.positions))[1];
  assert.ok(Math.abs(top - 94.76) < 0.01, `at its baked height, its collar peaks at ${top.toFixed(2)}`);
  let bare = 0;
  for (let i = 2; i < chest.length; i += 3) if (chest[i] > top) bare++;
  assert.ok(bare >= 32, `the shoulders and the neck's base stand above it, bare (${bare} chest vertices)`);
});

test('MW-BRIG3: fitted to the chest - its top meets the chest\'s top, every vertex moved by the one lift, and the build\'s notes say so', async () => {
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [...BODY, brigandine({ fitTo: 'chest' })] });
  assert.ok(asm.ok, asm.error);
  const pieces = worn(asm);
  assert.ok(pieces.length >= 1);
  assert.equal(pieces.every((p) => p.kind === 'skinned'), true, 'still drawn by skinBatch, the body\'s own door');
  const lift = CHEST_TOP - zRange([BAKED])[1];
  assert.ok(lift > 11 && lift < 11.5, `a Morrowind man's neck base is ${lift.toFixed(2)} above the scene's`);
  // Its shape is the modeller's: every drawn vertex is a baked vertex moved by (0, 0, lift), and nothing else.
  const baked = [];
  for (let i = 0; i < BAKED.length; i += 3) baked.push([BAKED[i], BAKED[i + 1], BAKED[i + 2] + lift]);
  let worst = 0; let drawn = 0;
  for (const p of pieces) {
    for (let i = 0; i < p.positions.length; i += 3, drawn++) {
      let best = Infinity;
      for (const b of baked) best = Math.min(best, Math.hypot(p.positions[i] - b[0], p.positions[i + 1] - b[1], p.positions[i + 2] - b[2]));
      worst = Math.max(worst, best);
    }
  }
  assert.ok(drawn >= BAKED.length / 3 - 1, 'every vertex drawn');
  assert.ok(worst < 1e-3, `a pure lift, the shape untouched (worst ${worst.toFixed(5)})`);
  const [, top] = zRange(pieces.map((p) => p.positions));
  assert.ok(Math.abs(top - CHEST_TOP) < 1e-3, `its top at the chest's top (${top.toFixed(3)})`);
  const chest = await chestAtRest();
  let bare = 0;
  for (let i = 2; i < chest.length; i += 3) if (chest[i] > top + 1e-3) bare++;
  assert.equal(bare, 0, 'no part of the chest it hides stands above it');
  assert.ok(asm.notes.some((s) => /cuirass \(daggerfall_brigandine_steel\): fitted to the chest - moved up 11\.2 \(its top from 94\.8 to the chest's top at 106\.0\)/.test(s)), asm.notes.join('; '));
});

test('MW-BRIG3: fitted, it rides the body - its collar goes where the Chest bone takes the chest', async () => {
  const skeleton = buildSkeleton(parseNif(skeletonBytes()));
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [...BODY, brigandine({ fitTo: 'chest' })] });
  const collar = (a) => { let at = null; for (const p of worn(a)) for (let i = 0; i < p.positions.length; i += 3) if (!at || p.positions[i + 2] > at[2]) at = [p.positions[i], p.positions[i + 1], p.positions[i + 2]]; return at; };
  const rest = collar(asm);
  // An idle-like frame: the spine leans 15 degrees forward, the thighs swing.
  const quat = (axis, a) => [Math.cos(a / 2), ...axis.map((c) => c * Math.sin(a / 2))];
  const keyed = new Map([['bip01 spine', quat([1, 0, 0], 15 * deg)], ['bip01 l thigh', quat([1, 0, 0], -20 * deg)], ['bip01 r thigh', quat([1, 0, 0], 20 * deg)]]);
  const tracks = new Map([...keyed.keys()].map((k) => [k, k]));
  const sampleTrack = (t) => ({ rotation: keyed.get(t) });
  poseAssembly(asm, { tracks, sampleTrack, time: 0 });
  // The collar copied the chest's skin - the Chest node's one bone - so it is the rest collar carried by that bone.
  const chestRef = skeleton.byName.get('chest');
  const restM = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, null, null, 0, {}), GRAPH_ROOT).get(chestRef);
  const idleM = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, tracks, sampleTrack, 0, {}), GRAPH_ROOT).get(chestRef);
  const apply = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  const local = [0, 1, 2].map((r) => restM.a[r] * (rest[0] - restM.t[0]) + restM.a[3 + r] * (rest[1] - restM.t[1]) + restM.a[6 + r] * (rest[2] - restM.t[2]));   // rotation-only rest: its transpose inverts it
  const want = apply(idleM, local);
  let best = Infinity;
  for (const p of worn(asm)) for (let i = 0; i < p.positions.length; i += 3) best = Math.min(best, Math.hypot(p.positions[i] - want[0], p.positions[i + 1] - want[1], p.positions[i + 2] - want[2]));
  assert.ok(best < 1e-3, `the collar rides the chest's bone (${best.toFixed(5)})`);
});

test('MW-BRIG3: measured on the part it names, skinned - a part-local anchor on the ground is not its height; no anchor, no move', () => {
  const skeleton = buildSkeleton(parseNif(skeletonBytes()));
  const pose = poseSkeleton(skeleton, null, null, 0, {});
  const ctx = { skeleton, pose, mats: skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT), skinBatch };
  // A SKINNED chest authored part-local (a torso on the ground, retail's way - Morrowind-Rules.md MW-D21): its raw
  // top is z 20, its bind lifts it by the Chest bone to 106.
  const chest = flattenNif(parseNif(CHEST))[0];
  const ref = skeleton.byName.get('chest');
  const n = chest.positions.length / 3;
  const skinned = { ...chest, skinned: true, skin: { skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT, transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 }, shapeTransform: null,
    bones: [{ ref, name: 'chest', invBind: { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] }, indices: Array.from({ length: n }, (_, i) => i), weights: new Array(n).fill(1) }] } };
  assert.ok(Math.abs(zRange([chest.positions])[1] - 20) < 1e-4, 'raw, the chest tops out at 20');
  const garment = { positions: Float32Array.from(BAKED) };
  const fit = fitLift([garment], [skinned], ctx);
  assert.ok(Math.abs(fit.anchorTop - CHEST_TOP) < 1e-3, `measured where it is drawn (${fit.anchorTop})`);
  assert.ok(Math.abs(fit.lift - (CHEST_TOP - 94.7626)) < 1e-3);
  const moved = liftBatch(garment, fit.lift);
  assert.notEqual(moved.positions, garment.positions, 'a copy - the bound batch is never written');
  assert.equal(garment.positions[2], BAKED[2]);
  assert.ok(Math.abs(moved.positions[2] - (BAKED[2] + fit.lift)) < 1e-4);
  assert.equal(fitLift([garment], [], ctx), null, 'nothing to measure against, no lift');
  assert.equal(fitLift([], [skinned], ctx), null);
});

test('MW-BRIG3: with no chest to fit it to, it keeps its baked height and says so', async () => {
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [...BODY, brigandine({ fitTo: 'chest', skinFrom: BODY })] });
  assert.ok(asm.ok, asm.error);
  assert.ok(Math.abs(zRange(worn(asm).map((p) => p.positions))[1] - 94.76) < 0.01);
  assert.ok(asm.notes.some((s) => /no chest to fit it to - drawn at its baked height/.test(s)), asm.notes.join('; '));
});

test('MW-BRIG3: the Steel Brigandine is fitted to the chest it hides, and the build carries the part through', () => {
  const own = OWN_MW_ARMOR.find((a) => a.id === 'daggerfall_brigandine_steel');
  assert.equal(own.fitTo, 'chest');
  assert.ok(own.skinFrom.includes(own.fitTo), 'the part it is fitted to is loaded as a body under it');
  const w = composeWornArmor({ pieces: [{ templateIndex: RRI_JERKIN_TEMPLATE, material: ARMOR_MATERIAL.Steel }], armors: [], bodyPool: [] });
  assert.deepEqual(w.adds.map((a) => a.fitTo), ['chest']);
  assert.deepEqual(w.shadows, ['chest'], 'the part it is fitted to is the part it hides');
  // carried through ownBodyPart, beside the body it is skinned from
  const fp = sourceText('src/combat/fpArm.js');
  assert.match(fp, /\.filter\(\(b\) => b\.bytes\),\n    fitTo: add\.fitTo \?\? null,/);
  assert.match(fp, /\.\.\.ownBodyPart\(row, rows, find\) \}\);/);
});

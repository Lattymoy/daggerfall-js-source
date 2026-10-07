// MW-STEEL2 (2026-10-07, Mac: "The new steel armor T-poses ingame", and "This is the missing texture for the
// morrowind steel armor's skirt"): THE PLATE SOLVED IN THE POSE ITS BODY WAS BOUND IN, AND ITS SKIRT.
//
// MW-STEEL1 fitted and skinned the plate in the skeleton FILE's rest, on the premise that Morrowind's base_anim rests
// in a T-pose. Retail's does not: its node transforms are the idle's first frame - the arms hanging - and the T-pose
// is only its skins' bind. Every MW-STEEL1 pin stood on a rig whose rest WAS a T-pose and whose body was rigid, so none
// could tell the two apart. These pins stand on the vendored retail hierarchy for the premise, and on a rig whose arms
// hang at rest over a SKINNED body bound in the T-pose for the fix - retail's shape - and each one fails on the
// MW-STEEL1 solve (the T-pose fault reproduced: the gauntlet copies the shoulder and stands out level).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { bindPoseMats, affineInvert, positionBounds, sourceSkin } from '../src/formats/mwSkinTransfer.js';
import { assembleFirstPersonArm, poseAssembly, skeletonBindSkins, BIND_SPREAD_NOTE } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, shadowSkinRows, ARMO_PART } from '../src/formats/mwItemMap.js';
import { PART_BONES } from '../src/formats/mwNpc.js';
import { ownBodyPart } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { OWN_MW_ARMOR, STEEL_SOLVE_POSE, STEEL_SKIRT_SKIN_FROM, ownArmorModelFor } from '../src/characters/ownArmorModels.js';
import { writeNif } from '../tools/nifWrite.mjs';
import { plateSkeleton, plateBody, skinnedPlateBody, ARMS_DOWN, bonesAt } from './fixtures/mw/plateRig.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../${p}`, import.meta.url)));
const STEEL = ARMOR_MATERIAL.Steel;
const DELTA = [0.5, 1.5, 4];
const RETAIL = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const GAUNTLETS = [{ templateIndex: 103, material: STEEL }];

/** The third-person build's own path (mwsteel1.test.js's wearSet), on a skinned body whose skeleton hangs its arms at
 *  rest; `restSolve` strips MW-STEEL2's solvePose - the MW-STEEL1 solve, for the fault. Also answers the bare body, drawn
 *  alone on the same skeleton, to measure the plate against (a worn piece hides the skin under it). */
async function wear({ pieces, restSolve = false, shadow = true, rest = ARMS_DOWN, body = skinnedPlateBody(DELTA), solveOn = null, skeleton = null } = {}) {
  const worn = composeWornArmor({ pieces, armors: [], bodyPool: [] });
  const files = new Map(body.map((r) => [`meshes/${r.slot}.nif`, r.bytes]));
  for (const a of worn.adds) files.set(`meshes/${a.model}`, onDisk(`src/assets/mw/meshes/${a.model}`));
  const rows = body.map((r) => ({ slot: r.slot, record: { model: `${r.slot}.nif` } }));
  const find = (p) => (files.has(p) ? { get: () => files.get(p) } : null);
  const skin = shadowSkinRows(rows.map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot] ?? [], model: r.record.model })), worn.shadows);
  const parts = [...skin, ...worn.adds].map((row) => ({
    slot: row.slot, partName: row.partName, bones: row.bones, bytes: files.get(`meshes/${row.model}`),
    ...ownBodyPart(restSolve ? { ...row, solvePose: undefined } : row, rows, find, solveOn),
  }));
  const skel = skeleton ?? plateSkeleton(DELTA, { rotations: rest, shadow });
  const asm = await assembleFirstPersonArm({ skeletonBytes: skel, parts });
  const bare = await assembleFirstPersonArm({ skeletonBytes: skel, parts: rows.map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot], bytes: files.get(`meshes/${r.record.model}`) })) });
  return { worn, asm, bare };
}
const zone = (asm, prefix) => asm.pieces.filter((p) => p.slot.startsWith(prefix));
const flat = (pieces) => Float32Array.from(pieces.flatMap((p) => [...p.positions]));
/** Mean distance from each vertex of `ps` to the nearest of `qs`. */
function meanGap(ps, qs) {
  let sum = 0; let n = 0;
  for (let i = 0; i < ps.length; i += 3, n++) {
    let best = Infinity;
    for (let j = 0; j < qs.length; j += 3) best = Math.min(best, Math.hypot(ps[i] - qs[j], ps[i + 1] - qs[j + 1], ps[i + 2] - qs[j + 2]));
    sum += best;
  }
  return sum / n;
}
const influences = (pieces) => {
  const out = {};
  for (const p of pieces) for (const b of p.batch.skin.bones) out[b.name] = (out[b.name] ?? 0) + b.indices.length;
  return out;
};

// ── the premise, on retail's own hierarchy ──────────────────────────────────────────────────────────────────────────

test('MW-STEEL2: retail\'s skeleton does NOT rest in a T-pose - its rest hangs the arms, and the T-pose is its skin\'s bind (the vendored retail hierarchy)', () => {
  const nif = parseNif(onDisk(RETAIL));
  const skeleton = buildSkeleton(nif);
  const rest = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, null, null, 0, {}), GRAPH_ROOT);
  const at = (m, name) => m.get(skeleton.byName.get(name)).t;
  // the rest: the hand hangs 34 units under the shoulder (the premise MW-STEEL1 stood on said level with it)
  assert.ok(at(rest, 'bip01 r upperarm')[2] - at(rest, 'bip01 r hand')[2] > 30, 'at rest the right hand hangs below the shoulder');
  const skins = skeletonBindSkins(nif, skeleton);
  assert.deepEqual(skins.map((s) => [s.name, s.skin.bones.length]), [['Tri Shadow', 32]], 'the file\'s own skin over the Bip01 chain - skipped for drawing (rule 59), read for its binds');
  const bp = bindPoseMats(skeleton, skins, rest);
  assert.deepEqual(bp.anchors, ['Bip01 Pelvis'], 'one group, anchored at the root-most bone it binds');
  assert.equal(bp.placed, 32);
  assert.ok(bp.spread < 1e-3, `one skin bound in one pose agrees with itself (${bp.spread})`);
  // the bind: the hand level with the shoulder, out at the T-pose's reach; the pelvis on its rest origin; upright
  const hand = at(bp.mats, 'bip01 r hand'); const shoulder = at(bp.mats, 'bip01 r upperarm');
  assert.ok(Math.abs(hand[2] - shoulder[2]) < 3, `bound, the hand is level with the shoulder (${hand[2].toFixed(1)} against ${shoulder[2].toFixed(1)})`);
  assert.ok(hand[0] > 45, `and out at the T-pose's reach (${hand[0].toFixed(1)})`);
  assert.deepEqual(at(bp.mats, 'bip01 pelvis'), at(rest, 'bip01 pelvis'), 'the anchor stands on its rest origin');
  for (const side of ['r', 'l']) assert.ok(Math.abs(at(bp.mats, `bip01 ${side} foot`)[2] - at(rest, `bip01 ${side} foot`)[2]) < 1, 'and the bound body stands on the floor the rest stands on');
  assert.ok(Math.abs(at(bp.mats, 'bip01 r calf')[1] - at(bp.mats, 'bip01 l calf')[1]) < 1e-3, 'the legs bound side by side, where the rest steps the right one forward');
  // a node no skin binds rides its parent into the bind - the weapon bone stays in the bound hand
  const wb = skeleton.byName.get('weapon bone'); const node = skeleton.nodes.get(wb);
  const handM = bp.mats.get(node.parent);
  const local = node.rest;
  const expect = [0, 1, 2].map((r) => handM.a[r * 3] * local.translation[0] + handM.a[r * 3 + 1] * local.translation[1] + handM.a[r * 3 + 2] * local.translation[2] + handM.t[r]);
  assert.ok(Math.hypot(...expect.map((v, k) => v - bp.mats.get(wb).t[k])) < 1e-4, 'P_n = P_parent o rest local');
});

test('MW-STEEL2: bindPoseMats - P_c = P_b o IB_b o IB_c^-1 through a skin, a group per anchor, rigid skins bind nothing, and no skin is no bind', () => {
  const skeleton = buildSkeleton(parseNif(plateSkeleton([0, 0, 0], { rotations: ARMS_DOWN })));
  const rest = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, null, null, 0, {}), GRAPH_ROOT);
  const B = bonesAt([0, 0, 0]);
  const ib = (name) => ({ a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: B[name].map((v) => -v) });
  const ref = (name) => skeleton.byName.get(name.toLowerCase());
  const skinOf = (names, frame) => ({ positions: Float32Array.from([1, 2, 3]), skin: { bones: names.map((n) => ({ ref: ref(n), name: n.toLowerCase(), invBind: ib(n) })), ...(frame ? { frame } : {}) } });
  // two groups: the neck, and the right arm from its shoulder - no bone shared between them
  const bp = bindPoseMats(skeleton, [skinOf(['Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand']), skinOf(['Bip01 Spine2', 'Bip01 Neck'])], rest);
  assert.deepEqual(bp.anchors, ['Bip01 Spine2', 'Bip01 R Clavicle'], 'the root-most bone first, then the next group\'s');
  assert.equal(bp.placed, 6);
  assert.deepEqual(Array.from(bp.mats.get(ref('Bip01 R Forearm')).t), B['Bip01 R Forearm'], 'the forearm bound where its skin says - out level, not hanging');
  assert.ok(rest.get(ref('Bip01 R Forearm')).t[2] < B['Bip01 R Forearm'][2] - 10, 'where the rest hangs it');
  assert.equal(bp.spread, 0);
  // MW-STEEL3: a body skin's frame is its own, so its group stands on its anchor's whole REST - an arm anchored at the
  // upper arm (its own skin's root-most bone) hangs as the rest hangs it; the skeleton's own skin anchors with its axes
  const own = bindPoseMats(skeleton, [skinOf(['Bip01 R UpperArm', 'Bip01 R Forearm'])], rest);
  assert.deepEqual(Array.from(own.mats.get(ref('Bip01 R Forearm')).t).map((v) => +v.toFixed(4)), Array.from(rest.get(ref('Bip01 R Forearm')).t).map((v) => +v.toFixed(4)), 'a body skin anchored at a turned bone stands on its rest');
  const framed = bindPoseMats(skeleton, [skinOf(['Bip01 R UpperArm', 'Bip01 R Forearm'], 'skeleton')], rest);
  assert.deepEqual(Array.from(framed.mats.get(ref('Bip01 R Forearm')).t), B['Bip01 R Forearm'], 'the skeleton\'s own skin anchors with its own axes');
  // a bind that disagrees with itself says by how much
  const torn = skinOf(['Bip01 R UpperArm', 'Bip01 R Forearm']);
  torn.skin.bones[1].invBind = { ...torn.skin.bones[1].invBind, t: torn.skin.bones[1].invBind.t.map((v, k) => v + (k === 2 ? 2 : 0)) };
  const t = bindPoseMats(skeleton, [skinOf(['Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand']), torn], rest);
  assert.ok(Math.abs(t.spread - 2) < 1e-4, `the second skin disagrees by 2 (${t.spread})`);
  // a rigid part's skin is its placement, not a bind; no skin is no bind
  const rigid = sourceSkin({ positions: Float32Array.from([0, 0, 0]), indices: new Uint16Array(0) }, { attachRef: ref('Bip01 R Forearm') });
  assert.equal(rigid.skin.rigid, true);
  assert.equal(bindPoseMats(skeleton, [rigid], rest), null);
  assert.equal(bindPoseMats(skeleton, [], rest), null);
  // the inverse
  const m = { a: Float32Array.from([0, -2, 0, 2, 0, 0, 0, 0, 2]), t: [1, 2, 3] };
  const i = affineInvert(m);
  const p = [3, -1, 7];
  const q = [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  const back = [0, 1, 2].map((r) => i.a[r * 3] * q[0] + i.a[r * 3 + 1] * q[1] + i.a[r * 3 + 2] * q[2] + i.t[r]);
  back.forEach((v, k) => assert.ok(Math.abs(v - p[k]) < 1e-5));
  assert.equal(affineInvert({ a: Float32Array.from([1, 0, 0, 0, 0, 0, 0, 0, 1]), t: [0, 0, 0] }), null, 'a singular affine has none');
});

// ── the fault and the fix, through the real binder ──────────────────────────────────────────────────────────────────

test('MW-STEEL2: THE FAULT - solved in a rest that hangs the arms, the T-posed gauntlet copies the shoulder and stands out level; solved in the bind it copies the forearm and the hand and hangs with them', async () => {
  const fixed = await wear({ pieces: GAUNTLETS });
  const g = zone(fixed.asm, 'right hand (');
  assert.ok(g.length && g.every((p) => p.kind === 'skinned'));
  const inf = influences(g);
  assert.ok((inf['bip01 r forearm'] ?? 0) + (inf['bip01 r hand'] ?? 0) > 2 * (inf['bip01 r upperarm'] ?? 0), `the forearm and the hand carry it (${JSON.stringify(inf)})`);
  assert.equal(inf['bip01 r clavicle'] ?? 0, 0, 'and nothing of the shoulder');
  const arm = flat(zone(fixed.bare, 'forearm').concat(zone(fixed.bare, 'hand'), zone(fixed.bare, 'wrist')));
  const gap = meanGap(flat(g), arm);
  assert.ok(gap < 5, `drawn at rest the gauntlet is ON the hanging forearm (mean gap ${gap.toFixed(2)})`);
  const b = positionBounds(g.map((p) => p.positions));
  assert.ok(b.max[2] - b.min[2] > b.max[0] - b.min[0], 'and hangs down with it - taller than it is wide');
  assert.ok(fixed.asm.notes.some((n) => n.startsWith('right hand (daggerfall_steel_gauntlets): solved in the body\'s bind pose (anchored at Bip01 Pelvis')), fixed.asm.notes.join('; '));
  // MW-STEEL1's solve, the fault Mac saw: the shoulder copied, the gauntlet level at shoulder height
  const fault = await wear({ pieces: GAUNTLETS, restSolve: true });
  const f = zone(fault.asm, 'right hand (');
  const fi = influences(f);
  assert.ok((fi['bip01 r upperarm'] ?? 0) + (fi['bip01 r clavicle'] ?? 0) > (fi['bip01 r forearm'] ?? 0) + (fi['bip01 r hand'] ?? 0), `the rest solve copies the shoulder (${JSON.stringify(fi)})`);
  const fb = positionBounds(f.map((p) => p.positions));
  assert.ok(fb.max[0] - fb.min[0] > fb.max[2] - fb.min[2], 'and stands out level - the T-pose');
  assert.ok(meanGap(flat(f), arm) > 20, 'far off the arm');
  // the same with no shadow skin in the skeleton: the body's own skins carry the bind
  const bare = await wear({ pieces: GAUNTLETS, shadow: false });
  assert.ok(meanGap(flat(zone(bare.asm, 'right hand (')), arm) < 5);
});

test('MW-STEEL2: posed, the bind-solved gauntlet rides the forearm - a turn of the elbow carries it as it carries the skin under it', async () => {
  const { asm, bare } = await wear({ pieces: GAUNTLETS });
  const deg = Math.PI / 180;
  const keyed = new Map([['bip01 r forearm', [Math.cos(35 * deg), 0, Math.sin(35 * deg), 0]]]);
  const pose = { tracks: new Map([...keyed.keys()].map((k) => [k, k])), sampleTrack: (t) => ({ rotation: keyed.get(t) }), time: 0 };
  const before = meanGap(flat(zone(asm, 'right hand (')), flat(zone(bare, 'forearm').concat(zone(bare, 'hand'))));
  poseAssembly(asm, pose); poseAssembly(bare, pose);
  const after = meanGap(flat(zone(asm, 'right hand (')), flat(zone(bare, 'forearm').concat(zone(bare, 'hand'))));
  assert.ok(Math.abs(after - before) < 0.6, `the gap holds through the pose (${before.toFixed(2)} -> ${after.toFixed(2)})`);
});

test('MW-STEEL2: every steel piece is solved in the bind; the brigandine keeps the rest its fit was proven in; a rigid body has no bind to read and keeps the rest, said', async () => {
  for (const own of OWN_MW_ARMOR) {
    assert.equal(own.solvePose ?? null, own.id === 'daggerfall_brigandine_steel' ? null : STEEL_SOLVE_POSE, own.id);
  }
  assert.equal(STEEL_SOLVE_POSE, 'bind');
  const rigid = await wear({ pieces: GAUNTLETS, body: plateBody(DELTA), rest: {}, shadow: false });
  assert.ok(rigid.asm.notes.includes('right hand (daggerfall_steel_gauntlets): no skin to read the bind pose from - solved in the skeleton\'s rest'), rigid.asm.notes.join('; '));
  // the binder reads it off the part: composeWornArmor and ownBodyPart carry it
  const add = composeWornArmor({ pieces: GAUNTLETS, armors: [], bodyPool: [] }).adds[0];
  assert.equal(add.solvePose, 'bind');
  assert.equal(ownBodyPart(add, [{ slot: 'hand', record: { model: 'h.nif' } }], () => null).solvePose, 'bind');
  assert.equal('solvePose' in ownBodyPart({ ...add, solvePose: undefined }, [], () => null), false, 'a row without one adds nothing');
  assert.equal(BIND_SPREAD_NOTE, 0.5);
});

test('MW-STEEL2: in first person the gauntlets are solved in the THIRD person\'s bind and worn on the first person\'s rig by name - on its forearm whatever either rig\'s rest', async () => {
  const rot = (axis, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const [x, y, z] = axis;
    return [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s, y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s, z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]; };
  const tp = plateSkeleton(DELTA, { rotations: ARMS_DOWN, shadow: true });
  const fp = plateSkeleton(DELTA, { rotations: { 'Bip01 R UpperArm': rot([0, 1, 0], 60), 'Bip01 R Forearm': rot([0, 0, 1], 80), 'Bip01 L UpperArm': rot([0, 1, 0], -60) }, extra: ['Camera'] });
  const { asm, bare } = await wear({ pieces: GAUNTLETS, skeleton: fp, solveOn: tp });
  const gap = meanGap(flat(zone(asm, 'right hand (')), flat(zone(bare, 'forearm').concat(zone(bare, 'hand'))));
  assert.ok(gap < 5, `on the first person's forearm (mean gap ${gap.toFixed(2)})`);
  assert.deepEqual(asm.notes.filter((n) => /rule 40/.test(n)), [], 'every bone it copied is on the first person\'s rig');
});

// ── the skirt ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL2: the plate skirt is the Steel Cuirass\'s - Morrowind\'s skirt slot, skinned from the groin and the thighs, shadowing nothing; a clothing skirt takes the slot over it', async () => {
  const own = ownArmorModelFor({ templateIndex: 102, material: STEEL });
  assert.deepEqual(own.parts.map((p) => [p.part, p.model, p.skinFrom ?? null]), [['cuirass', 'steel_plate_cuirass.nif', null], ['skirt', 'steel_plate_skirt.nif', ['groin', 'upperleg']]]);
  assert.deepEqual(STEEL_SKIRT_SKIN_FROM, ['groin', 'upperleg']);
  assert.deepEqual(ARMO_PART.find((r) => r.name === 'skirt'), { name: 'skirt', bones: ['groin'], shadows: null });
  const worn = composeWornArmor({ pieces: [{ templateIndex: 102, material: STEEL }], armors: [], bodyPool: [] });
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.skinFrom]), [['cuirass', ['chest', 'groin', 'upperarm']], ['skirt', ['groin', 'upperleg']]]);
  assert.deepEqual(worn.shadows, ['chest'], 'the skirt hides no skin');
  const skirted = composeWornArmor({ pieces: [{ templateIndex: 102, material: STEEL }, { kind: 'clothing', name: 'Long Skirt' }], armors: [], clothes: [{ id: 'common_skirt_02', type: 7, model: 'c/skirt.nif', parts: [{ part: 5, male: 'c_skirt' }] }],
    bodyPool: [{ id: 'c_skirt', model: 'c/c_skirt.nif' }] });
  assert.deepEqual(skirted.adds.filter((a) => a.partName === 'skirt').map((a) => a.model), ['c/c_skirt.nif'], 'clothing\'s skirt outranks the armour\'s (priority 8 against 3)');
  // through the binder: it copies the pelvis and the thighs, and a striding thigh carries its plates
  const { asm, bare } = await wear({ pieces: [{ templateIndex: 102, material: STEEL }] });
  const skirt = zone(asm, 'skirt (');
  const inf = influences(skirt);
  assert.ok(inf['bip01 r thigh'] > 20 && inf['bip01 l thigh'] > 20 && (inf['bip01 pelvis'] ?? 0) > 20, JSON.stringify(inf));
  assert.ok(meanGap(flat(skirt), flat(zone(bare, 'groin').concat(zone(bare, 'upperleg')))) < 6, 'on the hips and thighs');
  const right = skirt.flatMap((p) => p.batch.skin.bones.filter((b) => b.name === 'bip01 r thigh').map((b) => ({ p, b })));
  const beforeZ = right.map(({ p, b }) => b.indices.map((i) => p.positions[i * 3 + 2])).flat();
  const deg = Math.PI / 180;
  poseAssembly(asm, { tracks: new Map([['bip01 r thigh', 't']]), sampleTrack: () => ({ rotation: [Math.cos(-20 * deg), Math.sin(-20 * deg), 0, 0] }), time: 0 });
  const afterZ = right.map(({ p, b }) => b.indices.map((i) => p.positions[i * 3 + 2])).flat();
  assert.ok(afterZ.some((z, i) => Math.abs(z - beforeZ[i]) > 0.5), 'the plates over the right thigh move with its stride');
});

// ── the writer ────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL2: a written skin reads back as the reader reads retail\'s - instance, data, bones, binds, weights', () => {
  const bytes = writeNif([
    { type: 'NiNode', name: 'Part', children: [1, 5, 6] },
    { type: 'NiTriShape', name: '', data: 2, skin: 3 },
    { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
    { type: 'NiSkinInstance', data: 4, skeletonRoot: 0, bones: [5, 6] },
    { type: 'NiSkinData', transform: { translation: [0, 0, 1] }, bones: [
      { transform: { translation: [-1, -2, -3], scale: 2 }, center: [0.5, 0, 0], radius: 1, indices: [0, 1], weights: [1, 0.25] },
      { transform: { rotation: [0, -1, 0, 1, 0, 0, 0, 0, 1] }, indices: [1, 2], weights: [0.75, 1] },
    ] },
    { type: 'NiNode', name: 'Bip01 R Forearm' },
    { type: 'NiNode', name: 'Bip01 R Hand' },
  ]);
  const nif = parseNif(new Uint8Array(bytes));
  const [batch] = flattenNif(nif);
  assert.equal(batch.skinned, true);
  assert.deepEqual(batch.skin.bones.map((b) => [b.name, Array.from(b.indices), Array.from(b.weights)]), [['bip01 r forearm', [0, 1], [1, 0.25]], ['bip01 r hand', [1, 2], [0.75, 1]]]);
  assert.deepEqual(Array.from(batch.skin.bones[0].invBind.a), [2, 0, 0, 0, 2, 0, 0, 0, 2], 'rotation times scale');
  assert.deepEqual(Array.from(batch.skin.bones[0].invBind.t), [-1, -2, -3]);
  assert.deepEqual(Array.from(batch.skin.bones[1].invBind.a), [0, -1, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(batch.skin.transform.translation), [0, 0, 1]);
  assert.equal(nif.records[3].skeletonRoot, 0);
  // and a skeleton file's own skin, read for its binds alone
  const skeleton = buildSkeleton(parseNif(plateSkeleton([0, 0, 0], { shadow: true })));
  const skins = skeletonBindSkins(parseNif(plateSkeleton([0, 0, 0], { shadow: true })), skeleton);
  assert.equal(skins.length, 1);
  assert.equal(skins[0].skin.bones.length, Object.keys(bonesAt([0, 0, 0])).length - 1, 'every Bip01 bone but the root');
  assert.deepEqual(flattenNif(parseNif(plateSkeleton([0, 0, 0], { shadow: true }))), [], 'never drawn - rule 59 skips "tri shadow"');
  // skinBatch draws the written skin: the first vertex wholly the first bone's
  const sk = buildSkeleton(nif);
  const pose = poseSkeleton(sk, null, null, 0, {});
  const out = new Float32Array(9);
  const bound = { ...batch, skin: { ...batch.skin, bones: batch.skin.bones.map((b) => ({ ...b, ref: sk.byName.get(b.name) })), skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT } };
  skinBatch(bound, sk, pose, skeletonSpaceMatrices(sk, pose, GRAPH_ROOT), out, null);
  assert.deepEqual(Array.from(out.slice(0, 3)), [-1, -2, -2], 'the bind takes the origin to (-1, -2, -3), and the skin\'s own transform lifts it by 1 - rule 20\'s order');
});

// AUDIT MW-CLOAK (2026-10-09, Mac: "Lets audit everything so far"): THE CLOAK IN MOTION. Four cold reviews of MW-EBONY1,
// MW-CLOAK1 and MW-CLOAK2 found the cloak's two fits held at REST alone: the hem, swinging with the thighs, swept through
// a hip-hung blade on every step its leg went forward (31 of the addon's 71 scabbards); a greatsword's tip came through
// it in a stride and a bow's limb as the spine leant back; a pauldron came through its shoulders as an arm swung back;
// and seated, its hem wrapped forward under the thighs past the knees. The pins below hold the cloak and what hangs
// round it through the poses (fixtures/mw/cloakRig.mjs SWEEP), on the port's own plate and the addon's own scabbards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleFirstPersonArm, poseAssembly, bindPartsInto } from '../src/formats/mwFirstPerson.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import {
  CLOAK_FIT_POSES, CLOAK_PUSH_LIMIT, CLOAK_SEATED_SHARE, FOLLOW, SLUNG_MOVE_LIMIT,
  fitCloakOver, fitStowedGear, followCloak, applyCloakFollow, seatCloak, cloakSheet, sheetCellKey,
} from '../src/formats/mwCloakFit.js';
import { fitThirdPersonCloak } from '../src/combat/fpArm.js';
import { meshToNif } from '../tools/nifWrite.mjs';
import { retailSkeleton } from './fixtures/mw/retailRig.mjs';
import { SHEATHED, isCloak, isGear, isUnder, body, turned, through, crossings, SWEEP } from './fixtures/mw/cloakRig.mjs';

const GEAR = [['w_claymore_daedric_sh.nif', 'Bip01 LongBladeTwoClose'], ['w_longbow_steel_sh.nif', 'Bip01 MarksmanBow'], ['w_iron_longsword_sh.nif', 'Bip01 LongBladeOneHand'], ['w_crossbow_sh.nif', 'Bip01 MarksmanCrossbow']];
/** The poses of SWEEP in which `which` comes through the cloak, by name. */
function sweep(asm, which) {
  const out = [];
  for (const [name, turns] of Object.entries(SWEEP)) {
    poseAssembly(asm, Object.keys(turns).length ? turned(asm, turns) : {});
    if (crossings(asm, which) > 0) out.push(name);
  }
  poseAssembly(asm);
  return out;
}
/** A rigid box part, `[min, max]` given in the RIG at rest, hung from `bone` of `asm` under `slot`. */
function boxPart(asm, bone, slot, [min, max]) {
  const at = asm.mats.get(asm.skeleton.byName.get(bone.toLowerCase()));
  const a = at.a; const d = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  const inv = [(a[4] * a[8] - a[5] * a[7]) / d, (a[2] * a[7] - a[1] * a[8]) / d, (a[1] * a[5] - a[2] * a[4]) / d, (a[5] * a[6] - a[3] * a[8]) / d, (a[0] * a[8] - a[2] * a[6]) / d, (a[2] * a[3] - a[0] * a[5]) / d, (a[3] * a[7] - a[4] * a[6]) / d, (a[1] * a[6] - a[0] * a[7]) / d, (a[0] * a[4] - a[1] * a[3]) / d];
  const corners = [];
  for (const z of [min[2], max[2]]) for (const y of [min[1], max[1]]) for (const x of [min[0], max[0]]) {
    const p = [x - at.t[0], y - at.t[1], z - at.t[2]];
    corners.push(inv[0] * p[0] + inv[1] * p[1] + inv[2] * p[2], inv[3] * p[0] + inv[4] * p[1] + inv[5] * p[2], inv[6] * p[0] + inv[7] * p[1] + inv[8] * p[2]);
  }
  const indices = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  return { slot, bones: [bone], bytes: new Uint8Array(meshToNif({ positions: corners, indices, name: slot })), bare: true };
}

test('AUDIT MW-CLOAK: fit 1 holds the cloak over the poses - the rest, and a stride each way with both arms back - so no piece of the ebony plate comes through it in any pose of the sweep; fitted at rest alone, an arm swung back still brought a pauldron through', async () => {
  assert.equal(CLOAK_FIT_POSES.length, 3);
  assert.deepEqual(CLOAK_FIT_POSES[0], {}, 'the rest first');
  for (const pose of CLOAK_FIT_POSES.slice(1)) {
    assert.deepEqual(Object.keys(pose).sort(), ['bip01 l calf', 'bip01 l thigh', 'bip01 l upperarm', 'bip01 r thigh', 'bip01 r upperarm', 'bip01 r calf'].filter((b) => b in pose).sort());
    assert.ok(pose['bip01 l upperarm'][1] > 0 && pose['bip01 r upperarm'][1] < 0, 'both arms back');
  }
  const restOnly = await body(ARMOR_MATERIAL.Ebony);
  fitCloakOver(restOnly, { isCloak, isUnder, poses: [{}] });
  const missed = sweep(restOnly, isUnder);
  assert.ok(missed.includes('armL') || missed.includes('armR'), `fitted at rest alone, an arm swung back comes through (${missed})`);
  const asm = await body(ARMOR_MATERIAL.Ebony);
  const fit = fitCloakOver(asm, { isCloak, isUnder });
  assert.equal(fit.deep, 0);
  assert.deepEqual(sweep(asm, isUnder), [], 'no pose of the sweep brings the plate through');
  for (const [name, turns] of Object.entries(SWEEP)) {
    poseAssembly(asm, Object.keys(turns).length ? turned(asm, turns) : {});
    assert.ok(through(asm, isUnder) <= 1e-3, `${name}: nothing stands behind the sheet`);
  }
});

test('AUDIT MW-CLOAK: the stowed gear GOES WITH the cloak - the addon\'s greatsword, bow, longsword and crossbow, fitted at rest, come through it walking, striding and leaning back; tied to it, none does in any pose, the rest moves nothing, and the frame\'s work reuses its arrays', async () => {
  const asm = await body(ARMOR_MATERIAL.Steel, GEAR);
  fitCloakOver(asm, { isCloak, isUnder });
  fitStowedGear(asm, { isCloak, isGear });
  poseAssembly(asm);
  const atRest = asm.pieces.filter(isGear).map((p) => Float32Array.from(p.positions));
  const unfollowed = sweep(asm, isGear);
  for (const pose of ['walkR', 'strideL', 'strideR', 'leanBack10']) assert.ok(unfollowed.includes(pose), `fitted at rest alone, the gear comes through in ${pose} (${unfollowed})`);
  const follow = followCloak(asm, { isCloak, isGear });
  assert.equal(typeof asm.afterPose, 'function');
  assert.deepEqual(follow.groups.map((g) => g.pieces[0].bone), GEAR.map(([, b]) => b));
  assert.ok(follow.groups.every((g) => g.contacts > 10), 'each tied at its contacts');
  assert.deepEqual(follow.groups.map((g) => g.slide), [true, true, false, false], 'slung gear may slide off the back; hip gear only turns');
  // the rest is where the rest fit put it: a pose the cloak keeps clear moves nothing
  poseAssembly(asm);
  asm.pieces.filter(isGear).forEach((p, i) => {
    let worst = 0;
    for (let k = 0; k < p.positions.length; k++) worst = Math.max(worst, Math.abs(p.positions[k] - atRest[i][k]));
    assert.ok(worst < 1e-3, `${p.bone} at rest unmoved (${worst})`);
  });
  assert.deepEqual(sweep(asm, isGear), [], 'tied to the cloak, no stowed piece through it in any pose of the sweep');
  // the steel longbow leaning back needs its slide: turned alone about its bone, a limb comes through
  const bow = (p) => p.bone === 'Bip01 MarksmanBow';
  follow.groups[1].slide = false;
  poseAssembly(asm, turned(asm, SWEEP.leanBack10));
  assert.ok(crossings(asm, bow) > 0, 'turned alone, the bow through the cloak leaning back');
  follow.groups[1].slide = true;
  poseAssembly(asm, turned(asm, SWEEP.leanBack10));
  assert.equal(crossings(asm, bow), 0);
  // a unit's slide priced as a turn of FOLLOW.slideCost radians: it slides near two units and turns under 12 degrees
  // (priced the other way round it turns 17 and barely slides)
  const bowGroup = follow.groups[1];
  const slid = Math.hypot(bowGroup.tr[0], bowGroup.tr[1], bowGroup.tr[2]);
  const bowTurn = Math.acos(Math.min(1, (bowGroup.R[0] + bowGroup.R[4] + bowGroup.R[8] - 1) / 2)) * 180 / Math.PI;
  assert.ok(slid > 1 && bowTurn < 12, `the bow slid ${slid.toFixed(2)} and turned ${bowTurn.toFixed(1)} degrees`);
  // it turns the least that keeps the gap - a stride swings the longsword's tip forward with the hem, within the cap
  poseAssembly(asm, turned(asm, SWEEP.strideR));
  const sword = follow.groups[2];
  const turn = Math.acos(Math.min(1, (sword.R[0] + sword.R[4] + sword.R[8] - 1) / 2));
  assert.ok(turn > 0.05 && turn <= FOLLOW.maxTurn + 1e-6, `the longsword turned ${(turn * 180 / Math.PI).toFixed(1)} degrees`);
  // the frame's work allocates nothing of its own: the same scratch, frame after frame
  const scratch = follow.groups.map((g) => [g.A, g.R, g.cons, g.at]);
  poseAssembly(asm, turned(asm, SWEEP.walkR)); applyCloakFollow(asm, follow);
  follow.groups.forEach((g, i) => assert.deepEqual([g.A, g.R, g.cons, g.at].map((x, k) => x === scratch[i][k]), [true, true, true, true]));
  // no cloak, no tie: the hook cleared
  const bare = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: [{ slot: 'sheath', bones: ['Bip01 LongBladeOneHand'], bytes: SHEATHED('w_iron_longsword_sh.nif'), bare: true }] });
  bare.afterPose = () => {};
  assert.equal(followCloak(bare, { isCloak, isGear }), null);
  assert.equal(bare.afterPose, null);
});

test('AUDIT MW-CLOAK: the third-person build\'s fits whole (fitThirdPersonCloak) on the ebony plate with every kind of stowed gear, then a weapon swap\'s new holster tied in its place - nothing through the cloak in any pose, before or after', async () => {
  const asm = await body(ARMOR_MATERIAL.Ebony, GEAR);
  const under = new Set(asm.pieces.filter((p) => !isGear(p)).map((p) => p.slot));
  const fitted = fitThirdPersonCloak(asm, under);
  assert.deepEqual(fitted.notes, []);
  assert.ok(fitted.cloak.pushed > 0 && fitted.follow.groups.length === 4);
  assert.deepEqual(sweep(asm, (p) => !isCloak(p)), [], 'neither the plate nor the gear through the cloak');
  // the swap: the longsword out, the crystal longsword in (fpArm's own order - bind, then fit with no cover to redo)
  asm.pieces = asm.pieces.filter((p) => !(isGear(p) && p.bone === 'Bip01 LongBladeOneHand'));
  bindPartsInto(asm, [{ slot: 'sheath', bones: ['Bip01 LongBladeOneHand'], bytes: SHEATHED('w_longsword_crystal_sh.nif'), bare: true }]);
  const swapped = fitThirdPersonCloak(asm, null);
  assert.equal(swapped.cloak, null, 'the cloak is not fitted again');
  assert.deepEqual(swapped.notes, []);
  assert.ok(swapped.follow.groups.some((g) => g.pieces.some((p) => p.bone === 'Bip01 LongBladeOneHand')), 'the new holster tied');
  assert.deepEqual(sweep(asm, (p) => !isCloak(p)), [], 'after the swap, nothing through the cloak in any pose');
});

test('AUDIT MW-CLOAK: seated, the cloak keeps CLOAK_SEATED_SHARE of its thighs - its hem hangs behind the body, over the floor, not wrapped forward under the thighs past the knees; standing again, the standing batch', async () => {
  const asm = await body(ARMOR_MATERIAL.Steel);
  fitThirdPersonCloak(asm, new Set(asm.pieces.map((p) => p.slot)));
  const cloak = asm.pieces.find(isCloak);
  const standing = cloak.batch;
  const sit = { 'bip01 l thigh': 90, 'bip01 r thigh': 90, 'bip01 l calf': -90, 'bip01 r calf': -90 };
  const hem = () => {
    poseAssembly(asm, turned(asm, sit));
    const P = cloak.positions; let low = Infinity, front = -Infinity;
    for (let v = 0; v < P.length; v += 3) { low = Math.min(low, P[v + 2]); front = Math.max(front, P[v + 1]); }
    const B = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
    return { below: B('bip01 pelvis')[2] - low, front, knee: B('bip01 l calf')[1] };
  };
  const wrapped = hem();
  assert.ok(wrapped.front > wrapped.knee, `standing weights, seated: the hem at y ${wrapped.front.toFixed(1)} past the knee at ${wrapped.knee.toFixed(1)}`);
  assert.equal(seatCloak(asm, true), true);
  assert.notEqual(cloak.batch, standing);
  const seatedBatch = cloak.batch;
  assert.equal(cloak.batch.positions, standing.positions, 'the same positions, its weights alone moved');
  const seated = hem();
  const floor = 0.48 * 69.99125109;   // player/seatPose.js SEAT_HIP_DROP, in the rig's units: the hips' fall onto the chair
  assert.ok(seated.front < seated.knee - 20, `seated weights: the hem at y ${seated.front.toFixed(1)}, behind the body`);
  assert.ok(seated.below < 76.4 - floor, `and over the floor: ${seated.below.toFixed(1)} below the hips`);
  assert.ok(CLOAK_SEATED_SHARE > 0 && CLOAK_SEATED_SHARE < 1);
  seatCloak(asm, true); assert.equal(cloak.batch, seatedBatch, 'made once');
  seatCloak(asm, false); assert.equal(cloak.batch, standing);
  // the fits measure the standing cloak whatever a seat last swapped in
  seatCloak(asm, true);
  fitThirdPersonCloak(asm, null);
  assert.equal(cloak.batch, standing);
  assert.equal(seatCloak({ pieces: [] }, true), false, 'no cloak, nothing to seat');
});

test('AUDIT MW-CLOAK: what the fits will not chase or move - a thing more than CLOAK_PUSH_LIMIT through the cloak is left through and named; a TAIL and a carried SHIELD are no part of what the cloak covers; slung gear the cloak would send more than SLUNG_MOVE_LIMIT off the back hangs as it was', async () => {
  // a rod from the pelvis thirty units back through the cloak
  const asm = await body(ARMOR_MATERIAL.Steel);
  bindPartsInto(asm, [boxPart(asm, 'Bip01 Pelvis', 'rod', [[-2, -45, 55], [2, 0, 59]])]);
  poseAssembly(asm);
  const t0 = Date.now();
  const fit = fitCloakOver(asm, { isCloak, isUnder, poses: [{}] });
  assert.ok(fit.deep > 0, 'named');
  assert.ok(fit.most <= CLOAK_PUSH_LIMIT + 1e-6);
  assert.ok(Date.now() - t0 < 5000);
  const notes = fitThirdPersonCloak(asm, new Set(asm.pieces.map((p) => p.slot))).notes;
  assert.ok(notes.some((n) => /^cloak: something under it stands more than 10 units through it/.test(n)), notes.join(' | '));
  // the same rod as a TAIL, and as a SHIELD: the build's cover leaves both out
  for (const slot of ['tail', 'shield (ebony_shield)']) {
    const b = await body(ARMOR_MATERIAL.Steel);
    bindPartsInto(b, [boxPart(b, 'Bip01 Pelvis', slot, [[-2, -45, 55], [2, 0, 59]])]);
    poseAssembly(b);
    const out = fitThirdPersonCloak(b, new Set(b.pieces.map((p) => p.slot)));
    assert.equal(out.cloak.deep, 0, `${slot}: not under the cloak`);
    assert.deepEqual(out.notes, []);
  }
  // a slab slung at the spine through the whole chest: over the cloak it would hang forty units off the back
  const slab = await body(ARMOR_MATERIAL.Steel);
  bindPartsInto(slab, [{ ...boxPart(slab, 'Bip01 Spine2', 'sheath', [[-6, -18, 70], [6, 25, 100]]), slot: 'sheath' }]);
  poseAssembly(slab);
  const rows = fitStowedGear(slab, { isCloak, isGear });
  assert.deepEqual(rows.map((r) => [r.slung, r.how]), [[true, 'unresolved']]);
  assert.equal(SLUNG_MOVE_LIMIT, 15);
  const said = fitThirdPersonCloak(slab, new Set(slab.pieces.filter((p) => !isGear(p)).map((p) => p.slot))).notes;
  assert.ok(said.some((n) => /^holster @ Bip01 Spine2: over the cloak it would hang more than 15 units off the back/.test(n)), said.join(' | '));
  // and a hip blade no pitch within the limit keeps clear (the limit lowered for the pin) hangs as it was
  const hip = await body(ARMOR_MATERIAL.Steel, [['w_iron_longsword_sh.nif', 'Bip01 LongBladeOneHand']]);
  fitCloakOver(hip, { isCloak, isUnder, poses: [{}] });
  const src = hip.pieces.find(isGear).source;
  assert.deepEqual(fitStowedGear(hip, { isCloak, isGear, pitchLimit: 5 }).map((r) => r.how), ['unresolved']);
  assert.equal(hip.pieces.find(isGear).source, src);
  // a rod hung at the hip across the back, behind the sheet between its ends and its ends past the cloak's sides: no
  // vertex of it is over the cloak, so the vertices alone call it clear - its edges, sampled, do not
  const rod = await body(ARMOR_MATERIAL.Steel);
  fitCloakOver(rod, { isCloak, isUnder, poses: [{}] });
  poseAssembly(rod);
  const sheet = cloakSheet(rod.pieces.find(isCloak).positions, rod.pieces.find(isCloak).indices);
  const front = sheet.get(sheetCellKey(0, 70)).front;
  bindPartsInto(rod, [boxPart(rod, 'Bip01 LongBladeOneHand', 'sheath', [[-40, front - 1.5, 70], [40, front - 1, 71]])]);
  poseAssembly(rod);
  const across = fitStowedGear(rod, { isCloak, isGear });
  assert.equal(across.length, 1);
  assert.notEqual(across[0].how, 'clear', 'its edges reach behind the cloak');
});

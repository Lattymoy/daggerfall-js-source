// RIFLE-STANCE (2026-10-17, Mac: "adjust the held animation for the thunderlock on the morrowind model. It should be like a
// rifle being held in an idle stance and a ready stance when in combat") - the Dwarven Thunderlock held as a long gun on the
// Morrowind body (combat/gun/rifleStance.js; bible/05-Combat/Dwarven-Thunderlock.md, RIFLE-STANCE).
//
// What is pinned: the hold's step law (on with the gun in the hands, off for anything else, up to the aim while it
// shoots, for RIFLE_EASE.hold after and while the fight's signal stands); the gun held by its pistol grip
// (GUN_GRIP_ATTITUDE through the resolve's own part - the barrel along the hand, not across it as a sword's grip); the
// two stances solved on the vendored retail biped in the port's plate - the low ready's barrel down and across, the
// aim's level down the body's forward with its sights up, both hands on the gun (the right wrist where the grip puts it,
// the left palm up under the forend) and a share between them; the first person's on the MW-STEEL4 stand-in, the gun in
// the 60-degree lens in both; the fight's signal (harmMark.js playerHarmedWithin); and the live arm with the shipped gun -
// the hold on once drawn, up for the fight and down after it, off for the sheathe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RIFLE_STANCES, RIFLE_HOLD, RIFLE_EASE, rifleStanceStep, rifleStanceRequest, applyRifleStance } from '../../src/combat/gun/rifleStance.js';
import { GUN_GRIP_ATTITUDE, OWN_MW_MODELS, OWN_MW_GILDED } from '../../src/characters/ownModels/ownWeaponModels.js';
import { THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { assembleFirstPersonArm, poseAssembly } from '../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { climbBones, handFrame } from '../../src/combat/climbRig.js';
import { createFpArm, resolveWeaponParts, archiveHas, FP_FIELD_OF_VIEW } from '../../src/combat/fpArm.js';
import { mat33Mul } from '../../src/formats/morrowind/mwNifMesh.js';
import { playerHarmedWithin, markPlayerHarm, endPlayerFights, _resetHarmMarkForTests } from '../../src/systems/harmMark.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { retailBodyDeps, shippedArchive, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const GUN = { templateIndex: THUNDERLOCK_TEMPLATE };
const RAD = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const turn = (a) => { const s = Math.hypot(a[0], a[3], a[6]); return Array.from(a, (v) => v / s); };
const deg = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b))))) / RAD;

/** The shipped gun as the resolve hands it to a rig (its part, attitude and all), and the steel gauntlets. */
function gunParts(skeletonBytes) {
  const files = new Map([[`meshes/${OWN_MW_MODELS[THUNDERLOCK_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/thunderlock.nif')]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const res = resolveWeaponParts({ weapon: GUN, hasAmmo: true, allWeapons: [], find: (p) => (arc.has(p) ? arc : null), skeletonBytes, has: archiveHas([arc]) });
  assert.deepEqual(res.notes, []);
  const worn = composeWornArmor({ pieces: [{ templateIndex: 103, material: 0x201 }, { templateIndex: 105, material: 0x201 }, { templateIndex: 106, material: 0x201 }], armors: [], bodyPool: [] });
  return { res, parts: [...worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`) })), ...res.parts] };
}
/** A body on retail's bones holding the gun - `eye` a camera node at that point (the first person's stand-in). */
async function holding({ eye = null } = {}) {
  const skeletonBytes = retailSkeleton(eye ? { extra: ['Camera'] } : {});
  const { res, parts } = gunParts(skeletonBytes);
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts });
  assert.ok(asm.ok, asm.error);
  const cam = eye ? asm.skeleton.byName.get('camera') : null;
  if (eye) asm.skeleton.nodes.get(cam).rest.translation = eye;
  return { asm, info: res.weaponInfo, cam };
}
/** The stance posed through poseAssembly's own `hold` slot; answers the gun's frame (its mesh's axes and grip in the rig). */
function posed(asm, info, opts) {
  poseAssembly(asm, { hold: (sk, pose, root, sm) => applyRifleStance(sk, pose, root, sm, { attitude: info.attitude, ...opts }) });
  const wb = asm.mats.get(asm.skeleton.byName.get('weapon bone'));
  const G = mat33Mul(turn(wb.a), turn(info.attitude.a));
  const grip = [0, 1, 2].map((i) => wb.t[i] + app(turn(wb.a), info.attitude.t)[i] * Math.hypot(wb.a[0], wb.a[3], wb.a[6]));
  return { barrel: [G[1], G[4], G[7]], top: [G[2], G[5], G[8]], grip, fit: asm.holdFit };
}
/** The left hand's finger joints, posed. */
const leftFingers = (asm) => [...asm.skeleton.byName].filter(([n]) => /^bip01 l finger\d+$/.test(n)).map(([, r]) => asm.mats.get(r).t);
/** The retail body's own frame (the oracle the test reads for itself): right from shoulder to shoulder, up the spine. */
function bodyAxes(asm) {
  const at = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
  const right = norm(sub(at('bip01 r upperarm'), at('bip01 l upperarm')));
  let up = norm(sub(at('bip01 neck'), at('bip01 spine')));
  up = norm(sub(up, right.map((v) => v * dot(up, right))));
  return { right, up, fwd: cross(up, right), shoulder: at('bip01 r upperarm') };
}

test('RIFLE-STANCE the hold\'s step: on once the gun is in the hands and off at once for anything else; up to the aim while it shoots, for RIFLE_EASE.hold after, and while the fight\'s signal stands (mutants: RIFLE-STANCE-no-hold-after-the-shot, RIFLE-STANCE-fight-ignored)', () => {
  let s = { w: 0, ready: 0, since: Infinity };
  for (let i = 0; i < 60; i++) s = rifleStanceStep(s, { wanted: true, dt: 1 / 60 });
  assert.ok(s.w > 0.99 && s.ready < 1e-6, `drawn, calm: the low ready (${s.w}, ${s.ready})`);
  for (let i = 0; i < 40; i++) s = rifleStanceStep(s, { wanted: true, shooting: true, dt: 1 / 60 });
  assert.ok(s.ready > 0.99 && s.since === 0, `shooting: the aim (${s.ready})`);
  for (let i = 0; i < 60 * (RIFLE_EASE.hold - 1); i++) s = rifleStanceStep(s, { wanted: true, dt: 1 / 60 });
  assert.ok(s.ready > 0.99, `${RIFLE_EASE.hold - 1} s after the shot, still up`);
  for (let i = 0; i < 60 * 5; i++) s = rifleStanceStep(s, { wanted: true, dt: 1 / 60 });
  assert.ok(s.ready < 0.01, `well past the hold, down (${s.ready})`);
  for (let i = 0; i < 60; i++) s = rifleStanceStep(s, { wanted: true, combat: true, dt: 1 / 60 });
  assert.ok(s.ready > 0.99, 'the fight\'s signal raises it, no shot fired');
  for (let i = 0; i < 60 * 4; i++) s = rifleStanceStep(s, { wanted: true, dt: 1 / 60 });
  assert.ok(s.ready < 0.01, 'and lets it down once it stops');
  for (let i = 0; i < 60; i++) s = rifleStanceStep(s, { wanted: false, dt: 1 / 60 });
  assert.equal(s.w, 0, 'unwanted (the sheathe, the stone, a seat): off, to nothing');
  // PIN MOVED (AUDIT SPELL-HAND L3-10): the state carries the free hand's weight (`free`), whole with nothing in it
  assert.deepEqual(rifleStanceStep(null, { dt: 0.1 }), { w: 0, ready: 0, since: Infinity, free: 1 }, 'no state: nothing held');
});

test('RIFLE-STANCE the gun is held by its GRIP: the row\'s attitude is a turn (no mirror, no scale) that puts the grip\'s middle at the bone, both guns carry it, and on the hand the barrel runs ALONG the hand - not across it, the sword\'s way the bake left it (mutant: RIFLE-STANCE-the-sword-s-grip)', async () => {
  const a = GUN_GRIP_ATTITUDE.a;
  const det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  assert.ok(Math.abs(det - 1) < 1e-6, `a turn (det ${det})`);
  for (const c of [0, 1, 2]) assert.ok(Math.abs(Math.hypot(a[c], a[3 + c], a[6 + c]) - 1) < 1e-6, 'unit columns');
  for (const row of [OWN_MW_MODELS, OWN_MW_GILDED]) {
    assert.equal(row[THUNDERLOCK_TEMPLATE].attitude, GUN_GRIP_ATTITUDE, 'the Thunderlock and the Hourlock alike');
    assert.equal(row[THUNDERLOCK_TEMPLATE].holdAs, 'rifle');
  }
  const { res } = gunParts(retailSkeleton());
  assert.equal(res.parts.find((p) => p.slot === 'weapon').preTransform, GUN_GRIP_ATTITUDE, 'the resolve hands the part its attitude');
  assert.equal(res.weaponInfo.holdAs, 'rifle');
  // on retail's bones at rest (the clip's hand, no stance): the barrel and the hand's own way
  const { asm, info } = await holding();
  poseAssembly(asm, {});
  const wb = asm.mats.get(asm.skeleton.byName.get('weapon bone'));
  const barrel = app(mat33Mul(turn(wb.a), turn(info.attitude.a)), [0, 1, 0]);
  const fr = handFrame(asm.mats, climbBones(asm.skeleton).R, 'R');
  assert.ok(deg(barrel, fr.fingers) < 35, `the barrel along the hand, the grip through the fist (${deg(barrel, fr.fingers).toFixed(1)} deg; the bake's 90)`);
});

test('RIFLE-STANCE third person on retail\'s bones, in the port\'s plate: the LOW READY - the barrel down and across toward the left foot as the stance says, the AIM - level down the body\'s forward, its sights up, the grip where the stance puts it; both hands on the gun in each (the right wrist where the grip puts it, the left palm up under the forend), and a share between them (mutants: RIFLE-STANCE-aim-is-low, RIFLE-STANCE-left-hand-off-the-gun, RIFLE-STANCE-attitude-not-undone)', async () => {
  const { asm, info } = await holding();
  poseAssembly(asm, {});
  const B = bodyAxes(asm);
  const arm = (() => { const at = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t; return len(sub(at('bip01 r forearm'), at('bip01 r upperarm'))) + len(sub(at('bip01 r hand'), at('bip01 r forearm'))); })();
  const low = posed(asm, info, { w: 1, ready: 0, view: 'third' });
  const st = RIFLE_STANCES.third;
  const down = Math.asin(-dot(low.barrel, B.up)) / RAD;
  const across = Math.atan2(-dot(low.barrel, B.right), dot(low.barrel, B.fwd)) / RAD;
  assert.ok(Math.abs(down - st.low.pitch) < 1.5, `low: the barrel ${down.toFixed(1)} deg down (${st.low.pitch})`);
  assert.ok(Math.abs(across - st.low.yaw) < 1.5, `and ${across.toFixed(1)} deg across to the left (${st.low.yaw})`);
  assert.ok(low.fit.reach.R < 0.05 && low.fit.reach.L < 0.05, `both wrists on their holds (${low.fit.reach.R}, ${low.fit.reach.L})`);
  const frL = handFrame(asm.mats, climbBones(asm.skeleton).L, 'L');
  assert.ok(dot(frL.palm, low.top) > 0.95, 'the left palm up under the forend');
  const aim = posed(asm, info, { w: 1, ready: 1, view: 'third' });
  assert.ok(deg(aim.barrel, B.fwd) < 1.5, `aim: the barrel down the body's forward (${deg(aim.barrel, B.fwd).toFixed(2)} deg off)`);
  assert.ok(deg(aim.top, B.up) < 1.5, `its sights up (${deg(aim.top, B.up).toFixed(2)} deg off)`);
  const want = [0, 1, 2].map((i) => B.shoulder[i] + (B.right[i] * st.aim.grip[0] + B.fwd[i] * st.aim.grip[1] + B.up[i] * st.aim.grip[2]) * arm);
  assert.ok(len(sub(aim.grip, want)) < 0.05, `the grip where the stance puts it (${len(sub(aim.grip, want)).toFixed(3)} off)`);
  assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, 'both wrists on their holds');
  assert.ok(dot(handFrame(asm.mats, climbBones(asm.skeleton).L, 'L').palm, aim.top) > 0.95, 'the left palm up under the forend');
  const forend = [0, 1, 2].map((i) => aim.grip[i] + aim.barrel[i] * RIFLE_HOLD.forend[1] + aim.top[i] * RIFLE_HOLD.forend[2]);
  const wristL = asm.mats.get(asm.skeleton.byName.get('bip01 l hand')).t;
  assert.ok(len(sub(wristL, forend)) < arm * 0.3, 'the left hand AT the forend, not elsewhere on the gun');
  assert.ok(dot(sub(aim.grip, low.grip), B.up) > arm * 0.3, 'the aim is the low ready raised');
  const half = posed(asm, info, { w: 1, ready: 0.5, view: 'third' });
  assert.ok(deg(half.barrel, low.barrel) > 5 && deg(half.barrel, aim.barrel) > 5, 'a share of the way: between the two');
  assert.equal(rifleStanceRequest(asm.skeleton, asm.mats, { w: 0 }), null, 'no weight, no request');
});

test('RIFLE-STANCE first person on the MW-STEEL4 stand-in (retail\'s bones, a camera at the eye): the gun in the 60-degree lens in both stances - the aim level down the lens with the left hand under it in view, the low ready lowered below it with its muzzle in view; both hands on the gun (mutant: RIFLE-STANCE-first-person-reads-the-shoulder)', async () => {
  const { asm, info, cam } = await holding({ eye: [0, 6, 123] });
  const inLens = (p) => {
    const eye = asm.mats.get(cam).t, d = sub(p, eye);
    const v = Math.atan2(d[2], d[1]), h = Math.atan2(d[0], d[1]), half = FP_FIELD_OF_VIEW / 2;
    return { v, ok: d[1] > 0 && Math.abs(v) < half && Math.abs(h) < Math.atan(Math.tan(half) * 4 / 3) };
  };
  const muzzle = (g) => [0, 1, 2].map((i) => g.grip[i] + g.barrel[i] * 47);
  const aim = posed(asm, info, { w: 1, ready: 1, view: 'first', eyeRef: cam });
  // PIN MOVED (RIFLE-AIM-LOW, 2026-10-18): the aim was level down the lens (within 1.5 degrees of +Y) with the left WRIST in
  // the picture; it is 4 degrees down the lens now, under the crosshair, and the left hand is seen where it holds - its
  // fingers on the forend - with the wrist below the picture's edge
  assert.ok(deg(aim.barrel, [0, Math.cos(4 * RAD), -Math.sin(4 * RAD)]) < 1.5, 'aim: down the lens, 4 degrees under it');
  assert.ok(inLens(muzzle(aim)).ok, 'its muzzle in the picture');
  assert.ok(leftFingers(asm).some((p) => inLens(p).ok), 'and the left hand under it, its fingers on the forend');
  assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, 'both wrists on their holds');
  const low = posed(asm, info, { w: 1, ready: 0, view: 'first', eyeRef: cam });
  assert.ok(inLens(muzzle(low)).ok, 'low: its muzzle in the picture');
  assert.ok(inLens(muzzle(low)).v < inLens(muzzle(aim)).v, 'and lower than the aim\'s');
  assert.ok(low.fit.reach.R < 0.05 && low.fit.reach.L < 0.05, 'both wrists on their holds');
  assert.equal(rifleStanceRequest(asm.skeleton, asm.mats, { view: 'first', eyeRef: null }), null, 'no eye: nothing');
});

test('RIFLE-AIM-LOW (Mac: "the thunderlock in first person (morrowind) when shooting/aiming sits too high on the screen"): in first person the aimed gun stands WHOLLY UNDER THE CROSSHAIR - every vertex of the posed gun at least 0.15 of the picture\'s half-height below its middle (the level barrel at 0.17 of the arm under the eye ran off toward the vanishing point, its top 0.20 of the half-height ABOVE the middle); its muzzle and the left hand\'s fingers on the forend in the picture; both wrists on their holds; still above the low ready (mutants: RIFLE-AIM-LOW-the-old-row, RIFLE-AIM-LOW-level)', async () => {
  const { asm, info, cam } = await holding({ eye: [0, 6, 123] });
  const half = Math.tan(FP_FIELD_OF_VIEW / 2);
  /** The posed gun's highest point on the picture, a share of the half-height above (+) or below (-) its middle. */
  const gunTop = () => {
    const eye = asm.mats.get(cam).t;
    let top = -Infinity;
    for (const p of asm.pieces.filter((q) => q.slot === 'weapon')) {
      const v = p.positions;
      for (let i = 0; i < v.length; i += 3) { const d = v[i + 1] - eye[1]; if (d > 1e-6) top = Math.max(top, (v[i + 2] - eye[2]) / d / half); }
    }
    return top;
  };
  const picture = (p) => { const eye = asm.mats.get(cam).t, d = sub(p, eye); return d[1] > 0 && Math.abs(d[2] / d[1]) < half && Math.abs(d[0] / d[1]) < half * 4 / 3; };
  const aim = posed(asm, info, { w: 1, ready: 1, view: 'first', eyeRef: cam });
  const top = gunTop();
  assert.ok(top < -0.15, `the gun wholly under the crosshair: its top ${top.toFixed(3)} of the half-height from the middle`);
  assert.ok(picture([0, 1, 2].map((i) => aim.grip[i] + aim.barrel[i] * 47)), 'its muzzle in the picture');
  assert.ok(leftFingers(asm).some(picture), 'the left hand\'s fingers on the forend, in the picture');
  assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, 'both wrists on their holds');
  posed(asm, info, { w: 1, ready: 0, view: 'first', eyeRef: cam });
  assert.ok(gunTop() < top, 'and the low ready lower still');
});

test('RIFLE-STANCE the fight\'s signal: a foe\'s harm on the player within a window (playerHarmedWithin) - a fresh one stands, an old one does not, a player\'s own does not count, and the fights\' end forgets it', () => {
  _resetHarmMarkForTests();
  const foe = { isPlayer: false };
  assert.equal(playerHarmedWithin(12000, 1000), false, 'nothing yet');
  markPlayerHarm(foe, { now: 1000 });
  assert.equal(playerHarmedWithin(12000, 5000), true, 'four seconds on');
  assert.equal(playerHarmedWithin(12000, 14000), false, 'past the window');
  markPlayerHarm({ isPlayer: true }, { now: 20000 });
  assert.equal(playerHarmedWithin(12000, 20500), false, 'a player harms no fight into being');
  markPlayerHarm(foe, { now: 30000 });
  endPlayerFights();
  assert.equal(playerHarmedWithin(12000, 30500), false, 'a death, a load, a new game: forgotten');
  _resetHarmMarkForTests();
});

test('RIFLE-STANCE the live arm with the shipped gun, the body in third person on retail\'s bones: drawn, the hold comes on with both hands on the gun; the fight raises the aim and its end lets it down; the sheathe eases the hold off and hands the arms back to the clip (mutants: RIFLE-STANCE-held-while-sheathing, RIFLE-STANCE-third-not-held)', async () => {
  // the body's clips the fixture weapon file's (its equip and unequip sections - the draw and the sheathe the clip plays)
  const kf = new Uint8Array(readFileSync(new URL('../fixtures/mw/armfpweapon.kf', import.meta.url)));
  const deps = retailBodyDeps({ files: [['meshes/xbase_anim.kf', kf]], before: [shippedArchive(['meshes/thunderlock.nif', 'textures/thunderlock.dds'])] });
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  renderer.renderCharacterSpriteImage = () => ({});
  const arm = createFpArm();
  const cam = { pos: [0, 1.6, 0], yaw: 0, move: { forward: 0, strafe: 0, speed: 0, running: false } };
  arm.attach(renderer, () => cam);
  const built = await arm.build({ race: 'fprace', weapon: GUN, deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  assert.equal(built.third?.ok, true, 'the body stands');
  assert.equal(arm.setViewMode('third'), true);
  arm.setSheathed(false);
  arm.update(1 / 30);
  assert.equal(arm.status().upperName, 'Equipping', 'the draw plays');
  // every frame of the draw with the gun already in the hand: the clip carries it out of the holster, no hold yet
  let drawing = 0, heldDrawing = 0;
  for (let i = 0; i < 90; i++) {
    arm.update(1 / 30);
    const st = arm.status();
    if (st.upperName === 'Equipping' && st.weaponInHand) { drawing++; heldDrawing = Math.max(heldDrawing, arm.rifleState().w); }
  }
  assert.ok(drawing > 0, 'the draw has frames with the gun in the hand');
  assert.equal(heldDrawing, 0, 'and none of them holds it');
  const t = arm.built().third.arm;
  assert.ok(arm.rifleState().w > 0.99, `drawn: held (${arm.rifleState().w})`);
  assert.ok(arm.rifleState().ready < 0.01, 'calm: the low ready');
  assert.ok(t.holdFit && t.holdFit.reach.R < 0.05 && t.holdFit.reach.L < 0.05, `both hands on the gun (${t.holdFit?.reach?.R}, ${t.holdFit?.reach?.L})`);
  arm.setCombatReady(true);
  for (let i = 0; i < 30; i++) arm.update(1 / 30);
  assert.ok(arm.rifleState().ready > 0.99, 'a foe\'s harm: the aim');
  arm.setCombatReady(false);
  for (let i = 0; i < 120; i++) arm.update(1 / 30);
  assert.ok(arm.rifleState().ready < 0.01, `the fight over: down again (${arm.rifleState().ready})`);
  arm.setSheathed(true);
  for (let i = 0; i < 6; i++) arm.update(1 / 30);
  assert.equal(arm.status().upperName, 'Unequipping', 'the sheathe plays');
  assert.ok(arm.rifleState().w < 0.2, `and the hold is off within a fifth of a second (${arm.rifleState().w}) - the clip carries the gun to its holster`);
  for (let i = 0; i < 24; i++) arm.update(1 / 30);
  assert.equal(arm.rifleState().w, 0, 'to nothing');
  assert.equal(t.holdFit, null, 'and the arms are the clip\'s');
  arm.unload();
});

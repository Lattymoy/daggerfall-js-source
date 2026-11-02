// PISTOL-STANCE (2026-10-22, the owner: "Yeah it needs its own stance ... It needs an idle and active state just like the
// thunderlock"; bible/05-Combat/Dwarven-Pistolet.md PISTOL-STANCE): THE DWARVEN PISTOLET HELD AS A PISTOL on the
// Morrowind body - combat/gun/pistolStance.js through combat/gun/gunHold.js, posed through poseAssembly's own `hold` slot on
// the vendored retail biped in the port's plate, and the first person's on the MW-STEEL4 stand-in. Pinned as the owner
// picked it from rendered sheets: the fist high on the grip ("You can definitely tell the grip is too high up when
// held"), the idle low with the muzzle down, the aim with the arm OUT ("the arms should be protruding more, not as
// scrunched up to the face"), a pair each before its own shoulder ("when duel wielding the mirror is too close
// together"), the free hand at the side; and the live arm with the shipped pistol - held once drawn, up for the fight and
// down after it, off for the sheathe, a pair's left hand on its own pistol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PISTOL_STANCES, pistolStanceRequest, applyPistolStance } from '../../src/combat/gun/pistolStance.js';
import { holdsGun, applyGunStance } from '../../src/combat/gun/gunHold.js';
import { applyRifleStance } from '../../src/combat/gun/rifleStance.js';
import { PISTOL_GRIP_ATTITUDE, PISTOL_FIST_UP, OWN_MW_MODELS, OWN_MW_GILDED } from '../../src/characters/ownModels/ownWeaponModels.js';
import { PISTOLET_TEMPLATE, THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { assembleFirstPersonArm, poseAssembly } from '../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { createFpArm, resolveWeaponParts, resolveOffWeaponParts, archiveHas, FP_FIELD_OF_VIEW } from '../../src/combat/fpArm.js';
import { mat33Mul } from '../../src/formats/morrowind/mwNifMesh.js';
import { GRIP_RAKE } from '../../tools/modelPistolet.mjs';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { retailBodyDeps, shippedArchive, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const GUN = { templateIndex: PISTOLET_TEMPLATE, group: 'Weapons', material: 4 };
const RAD = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const T = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const turn = (a) => { const s = Math.hypot(a[0], a[3], a[6]); return Array.from(a, (v) => v / s); };
const deg = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b))))) / RAD;
const MX = [-1, 0, 0, 0, 1, 0, 0, 0, 1];

/** The shipped pistol (and a pair's second) as the resolve hands them to a rig, and the steel plate. */
function gunParts(skeletonBytes, pair) {
  const files = new Map([[`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const find = (p) => (arc.has(p) ? arc : null), has = archiveHas([arc]);
  const res = resolveWeaponParts({ weapon: GUN, hasAmmo: true, allWeapons: [], find, skeletonBytes, has });
  assert.deepEqual(res.notes, []);
  const off = pair ? resolveOffWeaponParts({ weapon: GUN, allWeapons: [], find, skeletonBytes, has, hasBone: () => true }) : { parts: [] };
  const worn = composeWornArmor({ pieces: [102, 103, 104, 105, 106, 107, 108].map((t) => ({ templateIndex: t, material: 0x201 })), armors: [], bodyPool: [] });
  return { res, parts: [...worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`) })), ...res.parts, ...off.parts] };
}
/** A body on retail's bones holding the pistol (a pair: two) - `eye` a camera node at that point (the first person's stand-in). */
async function holding({ eye = null, pair = false } = {}) {
  const skeletonBytes = retailSkeleton(eye ? { extra: ['Camera'] } : {});
  const { res, parts } = gunParts(skeletonBytes, pair);
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts, offWeaponBone: true });
  assert.ok(asm.ok, asm.error);
  const cam = eye ? asm.skeleton.byName.get('camera') : null;
  if (eye) asm.skeleton.nodes.get(cam).rest.translation = eye;
  return { asm, info: res.weaponInfo, cam, pair };
}
/** A gun's frame as its part stands posed: its mesh's barrel and top, and its grip, in the rig - the left part read
 *  through the mirror its bone places it in (formats/morrowind/mwFirstPerson.js placeAtBone, rule 13). */
function gunFrame(asm, info, side = 'R') {
  const b = asm.mats.get(asm.skeleton.byName.get(side === 'L' ? 'weapon bone left' : 'weapon bone'));
  const Rb = turn(b.a), M = side === 'L' ? mat33Mul(Rb, MX) : Rb, s = Math.hypot(b.a[0], b.a[3], b.a[6]);
  const G = mat33Mul(M, turn(info.attitude.a));
  const grip = [0, 1, 2].map((i) => b.t[i] + app(M, info.attitude.t)[i] * s);
  return { barrel: [G[1], G[4], G[7]], top: [G[2], G[5], G[8]], grip };
}
/** The stance posed through poseAssembly's own `hold` slot - by the arm's door (gunHold), as the arm asks it. */
function posed(h, opts) {
  poseAssembly(h.asm, { hold: (sk, pose, root, sm) => applyGunStance('pistol', sk, pose, root, sm, { attitude: h.info.attitude, pair: h.pair, eyeRef: h.cam, ...opts }) });
  return { R: gunFrame(h.asm, h.info, 'R'), L: h.pair ? gunFrame(h.asm, h.info, 'L') : null, fit: h.asm.holdFit };
}
/** The retail body's own frame (the oracle the test reads for itself): right from shoulder to shoulder, up the spine. */
function bodyAxes(asm) {
  const at = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
  const right = norm(sub(at('bip01 r upperarm'), at('bip01 l upperarm')));
  let up = norm(sub(at('bip01 neck'), at('bip01 spine')));
  up = norm(sub(up, right.map((v) => v * dot(up, right))));
  const arm = len(sub(at('bip01 r forearm'), at('bip01 r upperarm'))) + len(sub(at('bip01 r hand'), at('bip01 r forearm')));
  return { right, up, fwd: cross(up, right), at, arm, shoulders: len(sub(at('bip01 r upperarm'), at('bip01 l upperarm'))) };
}
const downOf = (g, B) => Math.asin(-dot(g.barrel, B.up)) / RAD;
const acrossOf = (g, B) => Math.atan2(-dot(g.barrel, B.right), dot(g.barrel, B.fwd)) / RAD;
const elbowOf = (B, s) => { const sh = B.at(`bip01 ${s} upperarm`), el = B.at(`bip01 ${s} forearm`), wr = B.at(`bip01 ${s} hand`); return deg(sub(sh, el), sub(wr, el)); };

test('PISTOL-STANCE the row and the door: the Pistolet holds as a PISTOL (its gold twin too), the Thunderlock as a rifle, a sword as neither; the resolve hands the arm its `holdAs`; gunHold sends each to its own stance (mutants: GH-holds-the-rifle-alone; GH-the-pistol-as-a-rifle; OWM-pistol-holds-nothing)', async () => {
  for (const row of [OWN_MW_MODELS, OWN_MW_GILDED]) assert.equal(row[PISTOLET_TEMPLATE].holdAs, 'pistol');
  assert.equal(OWN_MW_MODELS[THUNDERLOCK_TEMPLATE].holdAs, 'rifle');
  assert.equal(holdsGun(OWN_MW_MODELS[PISTOLET_TEMPLATE]), true);
  assert.equal(holdsGun(OWN_MW_MODELS[THUNDERLOCK_TEMPLATE]), true);
  assert.equal(holdsGun({ holdAs: null }), false, 'a sword\'s row: the clip\'s hold');
  assert.equal(holdsGun(null), false);
  const h = await holding();
  assert.equal(h.info.holdAs, 'pistol', 'the resolve hands it on');
  const by = (fn) => { poseAssembly(h.asm, { hold: (sk, pose, root, sm) => fn(sk, pose, root, sm, { attitude: h.info.attitude, w: 1, ready: 1 }) }); return h.asm.mats.get(h.asm.skeleton.byName.get('bip01 r hand')).t; };
  const door = by((...a) => applyGunStance('pistol', ...a)), own = by(applyPistolStance), rifle = by(applyRifleStance);
  assert.ok(len(sub(door, own)) < 1e-6, 'the door\'s pistol is the pistol stance');
  assert.ok(len(sub(door, rifle)) > 5, 'and not the rifle\'s');
  const asRifle = by((...a) => applyGunStance('rifle', ...a));
  assert.ok(len(sub(asRifle, rifle)) < 1e-6, 'the door\'s rifle is the rifle stance');
});

test('PISTOL-STANCE THE FIST HIGH ON THE GRIP (the owner: "You can definitely tell the grip is too high up when held"): retail\'s closed fist wraps the grip from under the guard down toward the butt, the thumb behind the tang - never the grip\'s lower half with the lock and barrel riding over it; the fingers closed round it (mutants: PS-fist-at-the-middle; PS-fist-open)', async () => {
  assert.equal(PISTOL_FIST_UP, 2.4);
  const h = await holding();
  posed(h, { w: 1, ready: 1, view: 'third' });
  const b = h.asm.mats.get(h.asm.skeleton.byName.get('weapon bone')), Rb = turn(b.a), s = Math.hypot(b.a[0], b.a[3], b.a[6]);
  const toMesh = (p) => app(T(PISTOL_GRIP_ATTITUDE.a), sub(app(T(Rb), sub(p, b.t)).map((v) => v / s), PISTOL_GRIP_ATTITUDE.t));
  const r = GRIP_RAKE * RAD, up = [0, Math.sin(r), Math.cos(r)];
  const upGrip = (n) => dot(toMesh(h.asm.mats.get(h.asm.skeleton.byName.get(n)).t), up);
  // the model's own measures (tools/modelPistolet.mjs): the trigger's tip 3.4 up the grip from its middle, the butt's flare at -3.9
  const upper = upGrip('bip01 r finger1'), lower = upGrip('bip01 r finger2'), thumb = upGrip('bip01 r finger0');
  assert.ok(upper > 1.5 && upper < 3.4, `the upper fingers close high, under the trigger (${upper.toFixed(2)} up the grip; the first cut's -0.16)`);
  assert.ok(lower > -3.9 && lower < upper - 2, `the lower fingers below them, above the butt's flare (${lower.toFixed(2)})`);
  assert.ok(thumb > upper, `the thumb over them, behind the tang (${thumb.toFixed(2)})`);
  // and CLOSED round it (PISTOL_HOLD.curl): the fingers' next joints wrap past the grip's middle to its far side (its half-width 0.93)
  const side = (n) => toMesh(h.asm.mats.get(h.asm.skeleton.byName.get(n)).t)[0];
  for (const n of ['bip01 r finger11', 'bip01 r finger21']) assert.ok(side(n) < -0.93, `${n.slice(6)} wrapped to the grip's left (${side(n).toFixed(2)})`);
});

test('PISTOL-STANCE third person, one pistol, on retail\'s bones in the port\'s plate: the IDLE low, its muzzle 60 degrees down at the ground ahead; the AIM with the arm OUT (the owner: "the arms should be protruding more, not as scrunched up to the face") - the elbow near straight, the gun level and far before the face, turned in to the eye line; the free left hand hanging at the side; every wrist on its hold (mutants: PS-aim-scrunched; PS-free-hand-on-a-gun)', async () => {
  const h = await holding();
  const st = PISTOL_STANCES.third;
  const low = posed(h, { w: 1, ready: 0, view: 'third' });
  let B = bodyAxes(h.asm);
  assert.ok(Math.abs(downOf(low.R, B) - st.low.pitch) < 1.5 && Math.abs(acrossOf(low.R, B) - st.low.yaw) < 1.5, `idle: the muzzle ${downOf(low.R, B).toFixed(1)} down, ${acrossOf(low.R, B).toFixed(1)} across`);
  assert.ok(low.fit.reach.R < 0.05 && low.fit.reach.L < 0.05, `both wrists on their holds (${low.fit.reach.R}, ${low.fit.reach.L})`);
  const pelvis = B.at('bip01 pelvis'), wristL = B.at('bip01 l hand');
  // retail's own rest hangs the wrist at the hips' height (0.7 under the pelvis bone): the free hand within a tenth of the arm of it, outside the thigh
  assert.ok(Math.abs(dot(sub(wristL, pelvis), B.up)) < B.arm * 0.1 && dot(sub(wristL, pelvis), B.right) < -B.shoulders * 0.3, 'the free hand hangs at the left side, as a resting arm does');
  const aim = posed(h, { w: 1, ready: 1, view: 'third' });
  B = bodyAxes(h.asm);
  assert.ok(Math.abs(downOf(aim.R, B)) < 1.5, `aim: level (${downOf(aim.R, B).toFixed(2)} down)`);
  assert.ok(Math.abs(acrossOf(aim.R, B) - st.aim.yaw) < 1.5, `turned ${acrossOf(aim.R, B).toFixed(1)} in to the eye line (${st.aim.yaw})`);
  assert.ok(dot(aim.R.top, B.up) > 0.95, 'its top up');
  const out = dot(sub(aim.R.grip, B.at('bip01 r upperarm')), B.fwd) / B.arm;
  assert.ok(out > 1.0, `the gun out before the shoulder: ${out.toFixed(2)} of the arm (the first cut's 0.92 stood it by the face)`);
  // the picked aim turns the arm in to the eye line, a little short of the pair's straight-ahead reach: 148 degrees
  assert.ok(elbowOf(B, 'r') > 140, `the arm near straight: the elbow at ${elbowOf(B, 'r').toFixed(0)} degrees (the first cut's 97)`);
  assert.ok(dot(sub(aim.R.grip, B.at('bip01 head')), B.fwd) > B.arm * 0.8, 'and well before the face');
  assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, 'both wrists on their holds');
  const half = posed(h, { w: 1, ready: 0.5, view: 'third' });
  assert.ok(deg(half.R.barrel, low.R.barrel) > 5 && deg(half.R.barrel, aim.R.barrel) > 5, 'a share of the way: between the two');
  assert.equal(pistolStanceRequest(h.asm.skeleton, h.asm.mats, { w: 0 }), null, 'no weight, no request');
});

test('PISTOL-STANCE a PAIR in third person (the owner: "when duel wielding the mirror is too close together"): each hand on its own pistol, the left the right\'s mirror - in the aim both level and parallel, each before its own shoulder, a shoulders\' width apart or more; in the idle both muzzles down (mutants: PS-pair-the-single-rows; PS-left-gun-unmirrored; PS-left-from-the-right-shoulder)', async () => {
  const h = await holding({ pair: true });
  const aim = posed(h, { w: 1, ready: 1, view: 'third' });
  const B = bodyAxes(h.asm);
  assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, `both wrists on their pistols (${aim.fit.reach.R}, ${aim.fit.reach.L})`);
  assert.ok(Math.abs(downOf(aim.L, B)) < 1.5 && Math.abs(downOf(aim.R, B)) < 1.5, 'both level');
  assert.ok(deg(aim.L.barrel, aim.R.barrel) < 1.5, `parallel (${deg(aim.L.barrel, aim.R.barrel).toFixed(2)} degrees apart)`);
  assert.ok(dot(aim.L.top, B.up) > 0.95 && dot(aim.R.top, B.up) > 0.95, 'each its top up - the left\'s mirrored part read as its bone places it');
  const apart = dot(sub(aim.R.grip, aim.L.grip), B.right);
  assert.ok(apart > B.shoulders * 0.95, `the grips ${apart.toFixed(1)} apart, the shoulders ${B.shoulders.toFixed(1)} - not together before the face`);
  for (const s of ['r', 'l']) assert.ok(elbowOf(B, s) > 150, `the ${s} arm out (${elbowOf(B, s).toFixed(0)} degrees)`);
  const low = posed(h, { w: 1, ready: 0, view: 'third' });
  assert.ok(Math.abs(downOf(low.L, B) - PISTOL_STANCES.third.pair.low.pitch) < 1.5 && Math.abs(downOf(low.R, B) - PISTOL_STANCES.third.pair.low.pitch) < 1.5, 'idle: both muzzles down');
  assert.ok(low.fit.reach.R < 0.05 && low.fit.reach.L < 0.05, 'both wrists on their pistols');
  assert.ok(dot(sub(low.R.grip, low.L.grip), B.right) > B.shoulders, 'each at its own side');
});

test('PISTOL-STANCE first person on the MW-STEEL4 stand-in (retail\'s bones, a camera at the eye): the aim right of the crosshair and wholly under it (RIFLE-AIM-LOW\'s law), turned in so its side shows, its muzzle in the picture; the idle lower; a pair one each side of the middle, each turned in (mutant: PS-pair-left-turned-out)', async () => {
  const half = Math.tan(FP_FIELD_OF_VIEW / 2);
  for (const pair of [false, true]) {
    const h = await holding({ eye: [0, 6, 123], pair });
    const eye = () => h.asm.mats.get(h.cam).t;
    /** A posed gun's highest point on the picture, a share of the half-height above (+) or below (-) its middle. */
    const topOf = (slot) => {
      const e = eye(); let top = -Infinity;
      for (const p of h.asm.pieces.filter((q) => q.slot === slot)) { const v = p.positions; for (let i = 0; i < v.length; i += 3) { const d = v[i + 1] - e[1]; if (d > 1e-6) top = Math.max(top, (v[i + 2] - e[2]) / d / half); } }
      return top;
    };
    const across = (p) => { const d = sub(p, eye()); return d[0] / d[1] / (half * 4 / 3); };
    const inPicture = (p) => { const d = sub(p, eye()); return d[1] > 0 && Math.abs(d[2] / d[1]) < half && Math.abs(d[0] / d[1]) < half * 4 / 3; };
    const aim = posed(h, { w: 1, ready: 1, view: 'first' });
    assert.ok(aim.fit.reach.R < 0.05 && aim.fit.reach.L < 0.05, `${pair ? 'a pair' : 'one'}: both wrists on their holds`);
    const top = topOf('weapon');
    assert.ok(top < -0.05, `the aim under the crosshair (its top ${top.toFixed(3)} of the half-height)`);
    assert.ok(across(aim.R.grip) > 0.15, 'right of the middle');
    assert.ok(aim.R.barrel[0] < -0.1, 'turned in toward the middle, its side in view');
    assert.ok(inPicture([0, 1, 2].map((i) => aim.R.grip[i] + aim.R.barrel[i] * 14)), 'its muzzle in the picture');
    if (pair) {
      assert.ok(topOf('offweapon') < -0.05, 'the left under the crosshair too');
      assert.ok(across(aim.L.grip) < -0.15, 'the left left of the middle');
      assert.ok(aim.L.barrel[0] > 0.05, 'and turned in from its side');
    }
    posed(h, { w: 1, ready: 0, view: 'first' });
    assert.ok(topOf('weapon') < top, 'the idle lower than the aim');
    assert.equal(pistolStanceRequest(h.asm.skeleton, h.asm.mats, { view: 'first', eyeRef: null }), null, 'no eye: nothing');
  }
});

test('PISTOL-STANCE the live arm with the shipped pistol, the body in third person on retail\'s bones: drawn, the hold comes on - the pistol in the right hand, the left hanging free; the fight raises the aim and its end lets it down; the sheathe takes it off; a pair\'s left hand on its own pistol (mutants: FA-pair-unsaid)', async () => {
  const kf = new Uint8Array(readFileSync(new URL('../fixtures/mw/armfpweapon.kf', import.meta.url)));
  const deps = retailBodyDeps({ files: [['meshes/xbase_anim.kf', kf]], before: [shippedArchive(['meshes/pistolet.nif', 'textures/pistolet.dds'])] });
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
  for (let i = 0; i < 90; i++) arm.update(1 / 30);
  const t = arm.built().third.arm;
  assert.ok(arm.rifleState().w > 0.99, `drawn: held (${arm.rifleState().w})`);
  assert.ok(arm.rifleState().ready < 0.01, 'calm: the idle');
  assert.ok(t.holdFit && t.holdFit.reach.R < 0.05 && t.holdFit.reach.L < 0.05, `the pistol in hand, the left at the side (${t.holdFit?.reach?.R}, ${t.holdFit?.reach?.L})`);
  const B = bodyAxes(t);
  assert.ok(Math.abs(dot(sub(B.at('bip01 l hand'), B.at('bip01 pelvis')), B.up)) < B.arm * 0.1, 'the free hand hangs');
  arm.setCombatReady(true);
  for (let i = 0; i < 30; i++) arm.update(1 / 30);
  assert.ok(arm.rifleState().ready > 0.99, 'a foe\'s harm: the aim');
  assert.ok(elbowOf(bodyAxes(t), 'r') > 140, 'the arm out');
  arm.setCombatReady(false);
  for (let i = 0; i < 120; i++) arm.update(1 / 30);
  assert.ok(arm.rifleState().ready < 0.01, `the fight over: down again (${arm.rifleState().ready})`);
  // a pair: the left hand takes its own pistol, a shoulders' width from the right's
  arm.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await arm.setOffWeapon(GUN), true, 'the second pistol bound');
  arm.setCombatReady(true);
  for (let i = 0; i < 30; i++) arm.update(1 / 30);
  const tp = arm.built().third.arm, BP = bodyAxes(tp);
  assert.ok(tp.holdFit && tp.holdFit.reach.L < 0.05 && tp.holdFit.reach.R < 0.05, `both hands on their pistols (${tp.holdFit?.reach?.R}, ${tp.holdFit?.reach?.L})`);
  const wb = (n) => tp.mats.get(tp.skeleton.byName.get(n)).t;
  assert.ok(dot(sub(wb('weapon bone'), wb('weapon bone left')), BP.right) > BP.shoulders * 0.95, 'the two pistols apart, each before its own shoulder');
  assert.ok(elbowOf(BP, 'l') > 150, 'the left arm out too');
  arm.setSheathed(true);
  for (let i = 0; i < 30; i++) arm.update(1 / 30);
  assert.equal(arm.rifleState().w, 0, 'sheathed: the hold off');
  assert.equal(arm.built().third.arm.holdFit, null, 'and the arms are the clip\'s');
  arm.unload();
});

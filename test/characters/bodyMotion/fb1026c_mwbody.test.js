// FIELD BUGS 2026-10-26c (feature-feedback via Mac, "Morrowind models + weapon animations need a little tweaking";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26c.md) - THE BODY MOTION'S TWO FIXES, on our own biped (OWN-WORK4) with the
// pair's Weapon Bone Left made as the build makes it.
//
// THRUST-CHAMBER: "Two-handed sword (claymore) forward pierce attack animation causes character's hands to clip through
// his back" - the two-hander's thrust wound up with its grip drawn back beside the hip, so the left hand, closed on the
// hilt toward the pommel, stood 0.31 to 0.38 of an arm behind the shoulders and the left arm crossed behind the back.
// It is chambered before the right hip now, the point raised; both hands stay in front of the shoulders' plane.
//
// ONE-RUN: "Running and sprinting with one-handed weapon looks off, because hand is in twisted position pointing weapon
// to the side unnaturally" - the one-hander's run trailed its blade behind, down and out to the right, the forearm
// turned 64 to 74 degrees off its elbow's hinge to hold it there. It runs in the stand's own format now (Mac's "Running
// with it using the same format"): the arm low and out, the blade forward and a little down, the forearm untwisted, and
// the blade's way between a stand and a run no longer swung round the back (the old row's `via`).
//
// TWO-CLEAR (Mac: "Continue" - the chop's and the slash's left arm seen behind the back in passing, then every arm of the
// family measured): the two-handed family's arms against the audit's own trunk (bodymotion_audit.test.js MELEE-1: 9 units
// about the pelvis-to-neck line, under 3 in), BOTH arms - the audit read the striking arm's alone, and the hand on the
// haft went 4.5 to 8.5 units into the trunk at rest and through every blow of a claymore, a staff's and a spear's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { handFrame } from '../../../src/combat/climbRig.js';
import { bodyOf, RAD } from '../../../src/characters/bodyMotion/bodyKit.js';
import { bodyFrames } from '../../../src/characters/bodyMotion/bodySolve.js';
import { createBodyMotion, sceneInput } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { CARRY, trunkPush } from '../../../src/characters/bodyMotion/carry.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (s, pose, root) => skeletonSpaceMatrices(s, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const A = body.arm;
const W = MW_WEAPON_TYPE;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) / RAD;
const pt = (m, n) => m.get(sk.byName.get(n)).t;
const bladeOf = (m) => { const a = m.get(sk.byName.get('weapon bone')).a; return norm([a[1], a[4], a[7]]); };

/** The layer stepped and posed at 60 Hz; `each(mats, t)` sees every frame. */
function play(scene, seconds, each, motion = createBodyMotion()) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const t = i / 60;
    motion.step(1 / 60, sceneInput({ ...(typeof scene === 'function' ? scene(t) : scene), kind: 'male' }));
    const p = new Map();
    motion.apply(sk, p, GRAPH_ROOT, sm);
    each?.(sm(sk, p, GRAPH_ROOT), t);
  }
  return motion;
}
/** The machine's sections over one second, the blade landing at 0.4 (bodymotion_audit.test.js's `machine`). */
const sections = () => {
  const out = [];
  for (let t = 1 / 60; t < 1 - 1e-9; t += 1 / 60) out.push(t < 0.28 ? { section: 'windup', progress: t / 0.28 } : t < 0.4 ? { section: 'release', progress: (t - 0.28) / 0.12 } : { section: 'follow', progress: (t - 0.4) / 0.6 });
  return out;
};
/** The forearm's turn off its elbow's hinge (degrees), from the free arm's at rest (bodymotion_steady.test.js's). */
function forearmTurn(m, side, zero = 0) {
  const s = side.toLowerCase();
  const up = norm(sub(pt(m, `bip01 ${s} forearm`), pt(m, `bip01 ${s} upperarm`))), fo = norm(sub(pt(m, `bip01 ${s} hand`), pt(m, `bip01 ${s} forearm`)));
  const h = norm(cross(up, fo)), ref = side === 'R' ? [-h[0], -h[1], -h[2]] : h;
  const palm = handFrame(m, body.bones[side], side).palm, k = dot(palm, fo);
  const pp = norm([palm[0] - fo[0] * k, palm[1] - fo[1] * k, palm[2] - fo[2] * k]);
  let a = Math.atan2(dot(cross(ref, pp), fo), dot(ref, pp)) / RAD - zero;
  if (a > 180) a -= 360; else if (a < -180) a += 360;
  return a;
}

test('THRUST-CHAMBER A TWO-HANDER\'S THRUST KEEPS BOTH HANDS BEFORE THE BACK: standing and walking, through the wind-up, the release and the follow, each wrist stands in front of the shoulders\' plane in the chest\'s own frame (the left stood 0.38 of an arm behind it, the left arm crossed behind the back); the wind-up still draws the blade back on the trunk - the chest coiled 15 degrees and more to the right - and the thrust still drives it out ahead (mutants: THRUST-CHAMBER-drawn-behind, THRUST-CHAMBER-chest-square)', () => {
  for (const [name, gait] of [['standing', {}], ['walking', { forward: 1, speed: 4.43 }]]) {
    const scene = { weapon: W.LongBladeTwoHand, hands: 'single', ...gait };
    const motion = play(scene, 1.5);
    let worst = Infinity, coil = 0, reach = -Infinity;
    for (const f of sections()) {
      play({ ...scene, blow: { type: 'thrust', reversed: false, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
        const F = bodyFrames(body, m);
        const C = [(F.shoulder.L[0] + F.shoulder.R[0]) / 2, (F.shoulder.L[1] + F.shoulder.R[1]) / 2, (F.shoulder.L[2] + F.shoulder.R[2]) / 2];
        for (const s of ['l', 'r']) worst = Math.min(worst, dot(sub(pt(m, `bip01 ${s} hand`), C), F.fwd) / A);
        if (f.section === 'windup') coil = Math.max(coil, Math.atan2(F.fwd[0], F.fwd[1]) / RAD);
        if (f.section === 'release') reach = Math.max(reach, dot(sub(pt(m, 'weapon bone'), C), [0, 1, 0]) / A);
      }, motion);
    }
    assert.ok(worst > 0, `${name}: a wrist stood ${worst.toFixed(2)} of an arm behind the shoulders' plane`);
    assert.ok(coil > 15, `${name}: the wind-up coils the chest to the right (${coil.toFixed(1)} degrees)`);
    assert.ok(reach > 0.75, `${name}: the release drives the grip out ahead (${reach.toFixed(2)} arm lengths)`);
  }
});

test('ONE-RUN THE ONE-HANDER\'S RUN IN THE STAND\'S FORMAT: at a run and a jog the arm stays low and out from the side, the blade points forward (along the facing by 0.8 and more) and a little down, out to the side by under 0.3 (it pointed 0.54 out and back), and the forearm stands within 30 degrees of its elbow\'s hinge (it stood 64 to 74 off it) (mutants: ONE-RUN-the-old-row, ONE-RUN-out-to-the-side, ONE-RUN-twisted)', () => {
  let zero = 0;
  play({}, 1, (m) => { zero = forearmTurn(m, 'R'); });
  for (const speed of [8.1, 5.5]) {
    const blades = [], turns = [], out = [], low = [];
    play({ weapon: W.LongBladeOneHand, forward: 1, speed, running: true }, 2.4, (m, t) => {
      if (t < 1.4) return;
      blades.push(bladeOf(m));
      turns.push(Math.abs(forearmTurn(m, 'R', zero)));
      out.push((pt(m, 'bip01 r hand')[0] - pt(m, 'bip01 r thigh')[0]) / A);
      low.push(pt(m, 'bip01 r upperarm')[2] - pt(m, 'bip01 r hand')[2]);
    });
    const at = `${speed} m/s`;
    assert.ok(blades.every((b) => b[1] > 0.8), `${at}: the blade forward (${Math.min(...blades.map((b) => b[1])).toFixed(2)} at its least)`);
    assert.ok(blades.every((b) => b[2] < 0 && b[2] > -0.6), `${at}: and a little down`);
    assert.ok(blades.every((b) => Math.abs(b[0]) < 0.3), `${at}: out to the side by ${Math.max(...blades.map((b) => Math.abs(b[0]))).toFixed(2)}`);
    assert.ok(Math.max(...turns) < 30, `${at}: the forearm turned ${Math.max(...turns).toFixed(1)} degrees off its hinge`);
    assert.ok(Math.min(...out) > 0.2, `${at}: the arm out from the side`);
    assert.ok(Math.min(...low) > 0.75 * A, `${at}: the arm low`);
  }
});

test('ONE-RUN THE WAY BETWEEN A STAND AND A RUN: the blade turns under 3 degrees a frame from a stand into a run and back - the old row\'s way round, back and up (`via`), swung it 11 a frame - and the class carries no such way (mutants: ONE-RUN-via-back)', () => {
  assert.equal(CARRY.one.via, undefined);
  for (const [from, to] of [[{}, { forward: 1, speed: 8.1, running: true }], [{ forward: 1, speed: 8.1, running: true }, {}], [{ forward: 1, speed: 4.43 }, { forward: 1, speed: 8.1, running: true }]]) {
    let prev = null, turn = 0;
    play((t) => ({ weapon: W.LongBladeOneHand, ...(t < 1.5 ? from : to) }), 2.6, (m, t) => {
      const b = bladeOf(m);
      if (t >= 1.4 && prev) turn = Math.max(turn, ang(prev, b));
      prev = b;
    });
    assert.ok(turn < 3, `the blade turned ${turn.toFixed(1)} degrees in a frame`);
  }
});

/** How far each arm's elbow, wrist and the middles of its upper arm and forearm go into the audit's trunk (units). */
function intoTrunk(m) {
  const a = pt(m, 'bip01 pelvis'), c = pt(m, 'bip01 neck'), ab = sub(c, a);
  const toSeg = (p) => { const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); };
  let worst = -Infinity, where = '';
  for (const s of ['l', 'r']) {
    const sh = pt(m, `bip01 ${s} upperarm`), el = pt(m, `bip01 ${s} forearm`), wr = pt(m, `bip01 ${s} hand`);
    const mid = (x, y) => [(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2];
    for (const [n, p] of [['upper arm', mid(sh, el)], ['elbow', el], ['forearm', mid(el, wr)], ['wrist', wr]]) { const d = 9 - toSeg(p); if (d > worst) { worst = d; where = `${s === 'l' ? 'left' : 'right'} ${n}`; } }
  }
  return { depth: worst, where };
}
const FAMILY = { claymore: W.LongBladeTwoHand, staff: W.BluntTwoWide, spear: W.SpearTwoWide };
const GAITS = { 'at rest': {}, walking: { forward: 1, speed: 4.43 }, running: { forward: 1, speed: 8.1, running: true }, sneaking: { forward: 1, speed: 1.9, sneaking: true }, strafing: { strafe: 1, speed: 4.43 } };

test('TWO-CLEAR THE TWO-HANDED GUARD BEFORE THE BODY: a claymore\'s, a staff\'s and a spear\'s guard at rest, walking, running and sneaking keeps both arms out of the audit\'s trunk, under 3 units in (the claymore\'s left arm, its hand by the right hip at its full length, ran through the chest 4.5 to 6.3 in); and the claymore\'s is still a low guard, its hands before the belly and its blade forward and down (mutants: TWO-CLEAR-guard-at-the-hip, TWO-CLEAR-haft-elbow-back)', () => {
  const bad = [];
  for (const [name, weapon] of Object.entries(FAMILY)) for (const g of ['at rest', 'walking', 'running', 'sneaking']) {
    let worst = { depth: -Infinity };
    play({ weapon, hands: 'single', ...GAITS[g] }, 2, (m, t) => { if (t >= 1.4) { const d = intoTrunk(m); if (d.depth > worst.depth) worst = d; } });
    if (worst.depth >= 3) bad.push(`${name} ${g}: the ${worst.where} ${worst.depth.toFixed(1)} units into the trunk`);
  }
  assert.deepEqual(bad, []);
  play({ weapon: W.LongBladeTwoHand, hands: 'single' }, 1.5, (m, t) => {
    if (t < 1.4) return;
    const b = bladeOf(m), F = bodyFrames(body, m);
    const C = [(F.shoulder.L[0] + F.shoulder.R[0]) / 2, (F.shoulder.L[1] + F.shoulder.R[1]) / 2, (F.shoulder.L[2] + F.shoulder.R[2]) / 2];
    // the left hand 0.26 of an arm before the shoulders (it stood 0.08 - beside the right hip)
    for (const s of ['l', 'r']) assert.ok(dot(sub(pt(m, `bip01 ${s} hand`), C), F.fwd) / A > 0.18, `the ${s} hand before the belly`);
    assert.ok(b[1] > 0.5 && b[2] < -0.3, 'a low guard: the blade forward and down');
  });
});

test('TWO-CLEAR EVERY BLOW OF THE FAMILY BEFORE THE BODY: each of the four blows of a claymore, a staff and a spear - the chop, the slash, the backhand and the thrust - struck standing, walking and strafing keeps both arms out of the audit\'s trunk, under 3 units in (they went 5.8 to 8.5 in: the hand on the haft through the chest as the blade passed upright or across beside the body); and the claymore\'s chop, slash and backhand land with the grip two thirds of an arm out - each by its keys alone too, no pair pushed (mutants: TWO-CLEAR-chop-old, TWO-CLEAR-chop-raised-beside, TWO-CLEAR-slash-old, TWO-CLEAR-slash-drawn-behind, TWO-CLEAR-back-old, TWO-CLEAR-back-across-beside, TWO-CLEAR-blow-elbow-back, TWO-CLEAR-the-hit-near)', () => {
  const bad = [];
  // as the game strikes them, and by their keys alone - no pair pushed before the trunk (createBodyMotion's trunkClear 0)
  for (const [alone, gaits] of [[false, ['at rest', 'walking', 'strafing']], [true, ['at rest', 'walking']]]) for (const [name, weapon] of Object.entries(FAMILY)) for (const g of gaits) for (const [type, reversed] of [['chop', false], ['slash', false], ['slash', true], ['thrust', false]]) {
    const scene = { weapon, hands: 'single', ...GAITS[g] };
    const motion = play(scene, 1.5, null, createBodyMotion(alone ? { trunkClear: 0 } : {}));
    let worst = { depth: -Infinity };
    for (const f of sections()) play({ ...scene, blow: { type, reversed, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => { const d = intoTrunk(m); if (d.depth > worst.depth) worst = d; }, motion);
    if (worst.depth >= 3) bad.push(`${name} ${g} ${reversed ? 'backhand' : type}${alone ? ' (its keys alone)' : ''}: the ${worst.where} ${worst.depth.toFixed(1)} units into the trunk`);
  }
  assert.deepEqual(bad, []);
  for (const [type, reversed] of [['chop', false], ['slash', false], ['slash', true]]) {
    const scene = { weapon: W.LongBladeTwoHand, hands: 'single' };
    const motion = play(scene, 1.5);
    let reach = -Infinity;
    for (const f of sections()) play({ ...scene, blow: { type, reversed, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
      if (f.section !== 'release' || f.progress < 0.99) return;
      const F = bodyFrames(body, m);
      reach = (pt(m, 'weapon bone')[1] - (F.shoulder.L[1] + F.shoulder.R[1]) / 2) / A;   // along the facing: 0.68 to 0.73 (it was 0.55 to 0.58)
    }, motion);
    assert.ok(reach > 0.65, `the claymore's ${reversed ? 'backhand' : type} lands ${reach.toFixed(2)} of an arm out`);
  }
});

test('TWO-CLEAR THE PAIR HELD BEFORE THE TRUNK: through each of a claymore\'s four blows begun at rest, walking, sneaking, running and strafing, the hand on the haft - the left, a third of an arm down the grip behind the right - never closes inside the audit\'s trunk, its wrist under half a unit in; by the keys alone it closed 0.2 to 3 units in, most of all in a slash begun sneaking or at a run (mutants: TWO-CLEAR-the-pair-unpushed)', () => {
  const bad = [];
  for (const g of ['at rest', 'walking', 'sneaking', 'running', 'strafing']) for (const [type, reversed] of [['chop', false], ['slash', false], ['slash', true], ['thrust', false]]) {
    const scene = { weapon: W.LongBladeTwoHand, hands: 'single', ...GAITS[g] };
    const motion = play(scene, 1.5);
    let worst = -Infinity;
    for (const f of sections()) play({ ...scene, blow: { type, reversed, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
      const a = pt(m, 'bip01 pelvis'), c = pt(m, 'bip01 neck'), ab = sub(c, a), p = pt(m, 'bip01 l hand');
      const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
      worst = Math.max(worst, 9 - len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])));
    }, motion);
    if (worst >= 0.5) bad.push(`${g} ${reversed ? 'backhand' : type}: the left wrist ${worst.toFixed(1)} units into the trunk`);
  }
  assert.deepEqual(bad, []);
});

test('TWO-CLEAR THE PUSH: how far forward a haft hand must go to stand clear of the trunk\'s line - nothing where it stands clear, to the clearance from on the line, and through to the front from behind it; never along the line (mutants: TWO-CLEAR-push-backward)', () => {
  const a = [0, 0, 0], c = [0, 0, 20], fwd = [0, 1, 0];
  assert.equal(trunkPush([0, 12, 10], a, c, fwd, 10), 0);
  assert.ok(Math.abs(trunkPush([0, 0, 10], a, c, fwd, 10) - 10) < 1e-9);
  assert.ok(Math.abs(trunkPush([0, -3, 10], a, c, fwd, 10) - 13) < 1e-9, 'from 3 behind the line to 10 before it');
  assert.ok(Math.abs(trunkPush([6, 0, 10], a, c, fwd, 10) - 8) < 1e-9, 'beside it, out to the clearance\'s circle');
  assert.equal(trunkPush([0, 0, 10], a, c, [0, 0, 1], 10), 0, 'a way along the line moves nothing off it');
});

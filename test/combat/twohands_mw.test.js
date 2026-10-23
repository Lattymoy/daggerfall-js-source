// TWO-HANDS, THE MORROWIND LANE (2026-10-16, bible/05-Combat/Two-Hands.md): the second hand on the 3D body - an arm, or
// the whole body, as the mirror of another (combat/twoHands/mirrorRig.js) on the vendored retail biped (Weapon Sheathing's
// xbase_anim, bones along their local X) and the fixture rig; the left hand's weapon on the Weapon Bone Left
// (combat/fpArm.js resolveOffWeaponParts, setOffWeapon); the left-hand blow, the fists' mirror, and the running hands
// through the real arm's update. The sprite lane's pins are test/combat/twohands.test.js.
//
// TWO-HANDS AUDIT (2026-10-16): the lane's eleven findings, each pinned where it was reproduced - a Weapon Bone Left made
// by the mirror for a skeleton without one (every retail one), each arm hung from this frame's body and every joint on
// its bone (the law in each bone's frame), the carry in each bone's frame, the run and the climb blended, a mirrored
// blow's way across the screen, a carry kept across a view switch, the pair's draw composed, the portrait's pair, a
// failed left-hand swap remembered forever, the mirror's cost, the run's lens - and the rig's own stride phase.
//
// TWO-HANDS FIELD (2026-10-16, Mac after the merge): a pair's left arm in first person was out of the picture whole ("No
// left arm") - mirrored across the chest the clip posed, not across the eye; and on the move in third person both arms
// swung the same way ("Both arms swing the same direction") - the left arm was the frame's own right, mirrored.
//
// TWO-HANDS AUDIT 2 (2026-10-16, lane 3): the made Weapon Bone Left mirrored hand to hand in the skin's frame (M1), the
// guard dropped where something else has the hands and carried off the arm (M2), the stride following the head bob
// without jumping (M3, the sprite lane's law too), the guard sized by the blade's own height (M4), the made bone and the
// guard paid for only where used (M5), a rebuild keeping the left blade (M6), the blades' effects and glows going with
// the blades; and two of L5's - the lantern under the Morrowind arm, H between the fists.
//
// TWO-HANDS SPREAD (2026-10-17, Mac: "For the morrowind first person, when duel wielding can we spread out the arms a bit
// more sense it can make the weapons overlap"): the first-person pair's arms turned out at their tops - the law's angle,
// a blade's inner edge on the picture, the turn on the skeleton, and the arm laying it in first person alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../src/formats/morrowind/mwSkin.js';
import { mat33Mul } from '../../src/formats/morrowind/mwNifMesh.js';
import { applyMirrorRig, mirrorPlan, counterpartName, strikingSide, limbSkeleton, offWeaponBoneAddon, WEAPON_BONE_LEFT_SOURCE, mirrorBindSources } from '../../src/combat/twoHands/mirrorRig.js';
import { rotAxisAngle } from '../../src/combat/climbRig.js';
import { createFpArm, fpSkeletonPath, tpSkeletonPath, strideOppositeTime, FP_CLIP_PATH, resolveOffWeaponParts, resolveWeaponParts, OFF_WEAPON_BONE, fpWeaponKey, GUARD_LENS_DROP, bladePictureHeight, bladeInnerEdge, FP_FIELD_OF_VIEW } from '../../src/combat/fpArm.js';
import { GUARD, RUN_PUMP, RUN_STEP_M, runPhaseOfBob, runPhaseFollow, runPhaseStep, PAIR_SPREAD, pairSpreadAngle, RUN_3D } from '../../src/combat/twoHands/handsLaw.js';
import { HeadBobber } from '../../src/player/headBobber.js';
import { MW_WEAPON_TYPE, MW_UNITS_PER_METER, assembleFirstPersonArm, poseAssembly } from '../../src/formats/morrowind/mwFirstPerson.js';
import { bodyRec } from '../fixtures/mw/bodyRec.mjs';
import { SHADOW_INVERSE_BINDS, retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';   // MIRROR-BIND: the port's own gauntlets, a left and a right piece

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const f = (n) => new Uint8Array(readFileSync(new URL(`../fixtures/mw/${n}`, import.meta.url)));
const RETAIL = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const retailBytes = () => new Uint8Array(readFileSync(new URL('../../' + RETAIL, import.meta.url)));
const retail = () => buildSkeleton(parseNif(retailBytes()));
const M = (sk, pose) => skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);

// the affine algebra the law is stated in, restated here (an independent oracle)
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mul = (A, B) => { const t = app(A.a, B.t); return { a: mat33Mul(A.a, B.a), t: [t[0] + A.t[0], t[1] + A.t[1], t[2] + A.t[2]] }; };
const inv = (A) => { const a = A.a, s2 = Math.hypot(a[0], a[3], a[6]) ** 2; const ia = [a[0] / s2, a[3] / s2, a[6] / s2, a[1] / s2, a[4] / s2, a[7] / s2, a[2] / s2, a[5] / s2, a[8] / s2]; const t = app(ia, A.t); return { a: ia, t: [-t[0], -t[1], -t[2]] }; };
const diff = (A, B) => { let w = 0; for (let i = 0; i < 9; i++) w = Math.max(w, Math.abs(A.a[i] - B.a[i])); for (let i = 0; i < 3; i++) w = Math.max(w, Math.abs(A.t[i] - B.t[i])); return w; };
const diffRot = (A, B) => { let w = 0; for (let i = 0; i < 9; i++) w = Math.max(w, Math.abs(A.a[i] - B.a[i])); return w; };
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
/** The plane the test reads for itself: halfway between the two upper arms at rest (an independent oracle). */
const SofRest = (sk) => { const r = M(sk, new Map()); const x0 = (r.get(sk.byName.get('bip01 l upperarm')).t[0] + r.get(sk.byName.get('bip01 r upperarm')).t[0]) / 2; return { a: Float32Array.from([-1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [2 * x0, 0, 0] }; };
/** Every bone's joint at its rest distance from its parent's (the bone keeps its length), worst miss. */
const worstBone = (sk, mats) => { let w = 0; for (const [ref, node] of sk.nodes) { if (!sk.nodes.has(node.parent)) continue; w = Math.max(w, Math.abs(dist(mats.get(node.parent).t, mats.get(ref).t) - Math.hypot(...node.rest.translation))); } return w; };
let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
/** The right arm turned at random at every bone, the rest as it stands. */
function bentRight(sk, plan) {
  const pose = new Map();
  for (const ref of plan.arms.R) {
    const n = sk.nodes.get(ref);
    const ax = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], l = Math.hypot(...ax);
    pose.set(ref, { rotation: mat33Mul(n.rest.rotation, rotAxisAngle(ax.map((v) => v / l), (rnd() - 0.5) * 1.4)), translation: n.rest.translation, scale: n.rest.scale });
  }
  return pose;
}
/** Bone `name` turned by `deg` about its own `axis`, over what `pose` holds. */
const turnBone = (sk, pose, name, axis, deg) => { const ref = sk.byName.get(name.toLowerCase()); const base = pose.get(ref) ?? sk.nodes.get(ref).rest; pose.set(ref, { rotation: mat33Mul(base.rotation, rotAxisAngle(axis, (deg * Math.PI) / 180)), translation: base.translation, scale: base.scale }); };

test('TWO-HANDS mirror: a bone\'s counterpart by its NAME - Bip01\'s L and R, the attach family\'s Left and Right, Morrowind\'s Weapon Bone and Weapon Bone Left; a bone of the middle is its own', () => {
  assert.deepEqual(['Bip01 L Hand', 'Bip01 R Forearm', 'Bip01 L Finger01', 'Left Hand', 'Right Upper Arm', 'Weapon Bone', 'Weapon Bone Left', 'Bip01 Spine1', 'Bip01 Head', 'Shield Bone'].map(counterpartName),
    ['bip01 r hand', 'bip01 l forearm', 'bip01 r finger01', 'right hand', 'left upper arm', 'weapon bone left', 'weapon bone', 'bip01 spine1', 'bip01 head', 'shield bone']);
});

test('TWO-HANDS mirror, on the RETAIL biped: the plan read off the skeleton - its middle between the upper arms, each arm\'s eleven bones parent first, and a bone IN an arm with no side to its name (the Shield Bone, a Weapon Bone with no Left) given no counterpart', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const rest = M(sk, new Map());
  const up = (n) => rest.get(sk.byName.get(n)).t[0];
  assert.ok(Math.abs(plan.x0 - (up('bip01 l upperarm') + up('bip01 r upperarm')) / 2) < 1e-9, `the middle is halfway between the upper arms at rest (${plan.x0})`);
  assert.ok(Math.abs(plan.x0) > 0.01, 'and this skeleton\'s middle is not the rig\'s origin - the plane is read, not assumed');
  assert.deepEqual([plan.arms.L.length, plan.arms.R.length], [11, 11]);
  for (const s of ['L', 'R']) for (let i = 1; i < plan.arms[s].length; i++) assert.ok(plan.arms[s].indexOf(sk.nodes.get(plan.arms[s][i]).parent) < i, 'parent first');
  const unpaired = [...plan.counterpart].filter(([, c]) => c == null).map(([r]) => sk.nodes.get(r).name).sort();
  assert.deepEqual(unpaired, ['Shield Bone', 'Weapon Bone']);
  assert.equal(mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices), plan, 'memoised');
  assert.equal(mirrorPlan({ nodes: new Map(), byName: new Map() }, GRAPH_ROOT, skeletonSpaceMatrices), null, 'no arms, no plan');
});

test('TWO-HANDS mirror, THE LAW on the retail biped: at rest it is the rest; an arm set as the other\'s mirror TURNS bone for bone as the other turns, in the mirror (the rotation of posed . rest^-1 is S . (posed . rest^-1) of the counterpart . S), with every joint where its parent carries it; on a rest that is its own mirror (the fixture arm) it is the graph law to the last digit, translations and all; the arm it reads untouched; the whole body mirrored twice is the body', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const rest = M(sk, new Map());
  const p0 = new Map();
  assert.ok(applyMirrorRig(sk, p0, GRAPH_ROOT, skeletonSpaceMatrices, { full: true }));
  for (const [ref, m] of rest) assert.ok(diff(M(sk, p0).get(ref), m) < 2e-4, `rest holds: ${sk.nodes.get(ref)?.name ?? ref}`);
  const pose = bentRight(sk, plan);
  const src = M(sk, pose);
  const p1 = new Map(pose);
  const wrote = applyMirrorRig(sk, p1, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } } });
  assert.ok(wrote.length >= 10);
  const got = M(sk, p1);
  // PIN MOVED (TWO-HANDS AUDIT): the skin delta's TRANSLATION is no longer the graph law's on retail. Its rest stands a
  // few tenths of a unit (its legs 6.7) off its own mirror, and the graph law hung each bone at the mirror of its
  // counterpart's frame - a turned counterpart slid the joint off its parent by that asymmetry (a finger joint 10% off
  // its bone here). The rotations stay the law's exactly; every joint now stays on its bone (mirrorRig.js's header).
  for (const ref of plan.arms.L) {
    const c = plan.counterpart.get(ref);
    if (c == null) continue;
    const dl = mul(got.get(ref), inv(rest.get(ref)));
    const dr = mul(mul(plan.S, mul(src.get(c), inv(rest.get(c)))), plan.S);
    assert.ok(diffRot(dl, dr) < 5e-4, `${sk.nodes.get(ref).name} turns as its counterpart does, in the mirror: ${diffRot(dl, dr)}`);
    assert.ok(dist(p1.get(ref).translation, sk.nodes.get(ref).rest.translation) < 1e-4, `${sk.nodes.get(ref).name}'s joint stays where its parent carries it`);
  }
  for (const ref of plan.arms.R) assert.ok(diff(got.get(ref), src.get(ref)) < 1e-6, 'the right arm stands as the clip has it');
  const p2 = new Map(pose);
  applyMirrorRig(sk, p2, GRAPH_ROOT, skeletonSpaceMatrices, { full: true });
  assert.ok(diffRot(M(sk, p2).get(plan.hands.L), mul(mul(plan.S, mul(src.get(plan.hands.R), inv(rest.get(plan.hands.R)))), mul(plan.S, rest.get(plan.hands.L)))) < 5e-4, 'the full mirror: the left hand turns as the right\'s');
  assert.ok(worstBone(sk, M(sk, p2)) < 1e-3, 'and no bone of the body leaves its parent');
  applyMirrorRig(sk, p2, GRAPH_ROOT, skeletonSpaceMatrices, { full: true });
  for (const [ref, m] of src) assert.ok(diff(M(sk, p2).get(ref), m) < 2e-3, `twice is the body: ${sk.nodes.get(ref)?.name ?? ref}`);
  // an arm COPIED from another pose takes that pose's locals, on the body under it (re-rooted: the next test twists it)
  const other = bentRight(sk, plan);
  const p3 = new Map();
  applyMirrorRig(sk, p3, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { R: { pose: other, side: 'R', mirror: false } } });
  const want = M(sk, other);
  for (const ref of plan.arms.R) assert.ok(diff(M(sk, p3).get(ref), want.get(ref)) < 1e-4, 'copied, on the same body');
  assert.equal(applyMirrorRig(sk, new Map(), GRAPH_ROOT, skeletonSpaceMatrices, {}), null, 'nothing asked, nothing written');
  // the fixture arm's rest IS its own mirror: there the law is the graph law, every term of it
  const fx = buildSkeleton(parseNif(f('armfp.nif')));
  const fplan = mirrorPlan(fx, GRAPH_ROOT, skeletonSpaceMatrices);
  const frest = M(fx, new Map());
  const fpose = bentRight(fx, fplan), fsrc = M(fx, fpose);
  const p4 = new Map(fpose);
  applyMirrorRig(fx, p4, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } } });
  for (const ref of fplan.arms.L) {
    const c = fplan.counterpart.get(ref);
    const graphLaw = mul(mul(mul(mul(fplan.S, fsrc.get(c)), inv(frest.get(c))), fplan.S), frest.get(ref));
    assert.ok(diff(M(fx, p4).get(ref), graphLaw) < 1e-5, `${fx.nodes.get(ref).name}: the graph law exactly`);
  }
});

test('TWO-HANDS AUDIT mirror, EACH ARM HANGS FROM THIS FRAME\'S BODY (finding 2): with the chest twisted 25 degrees by the clip, an arm set from a pose - the idle\'s right mirrored, the clip\'s own right mirrored, the idle\'s right copied under the whole body\'s mirror - keeps its shoulder on that chest; the first draft set it in the graph\'s space, 4.7 to 9.1 units off; and a bent knee mirrored leaves the other knee on its thigh', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const rest = M(sk, new Map());
  const ref = (n) => sk.byName.get(n);
  const clip = new Map();
  turnBone(sk, clip, 'Bip01 Spine1', [1, 0, 0], 25);
  turnBone(sk, clip, 'Bip01 R UpperArm', [0, 0, 1], 60);
  const idle = new Map();
  const clipM = M(sk, clip), S = SofRest(sk);
  for (const [label, req, side] of [
    ['dual:R (the left the idle\'s right, mirrored)', { limbs: { L: { pose: idle, side: 'R', mirror: true } } }, 'l'],
    ['dual (the left the clip\'s right, mirrored)', { limbs: { L: { pose: null, side: 'R', mirror: true } } }, 'l'],
    ['dual:L (the whole body mirrored, the right the idle\'s)', { full: true, limbs: { R: { pose: idle, side: 'R', mirror: false } } }, 'r'],
  ]) {
    const p = new Map(clip);
    applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, req);
    const got = M(sk, p);
    const neck = ref('bip01 neck'), up = ref(`bip01 ${side} upperarm`), cl = ref(`bip01 ${side} clavicle`);
    const want = mul(mul(got.get(neck), inv(rest.get(neck))), rest.get(up)).t;
    assert.ok(dist(got.get(up).t, want) < 1e-3, `${label}: the shoulder on the chest that carries it (${dist(got.get(up).t, want).toFixed(4)})`);
    assert.ok(dist(p.get(cl).translation, sk.nodes.get(cl).rest.translation) < 1e-4, `${label}: the clavicle's joint on its parent`);
    assert.ok(worstBone(sk, got) < 1e-3, `${label}: no bone leaves its parent`);
  }
  // the first draft's placement, restated: the left shoulder at the mirror of the clip's right in the graph's space
  const absolute = mul(mul(mul(mul(S, clipM.get(ref('bip01 r upperarm'))), inv(rest.get(ref('bip01 r upperarm')))), S), rest.get(ref('bip01 l upperarm'))).t;
  const neck = ref('bip01 neck');
  assert.ok(dist(absolute, mul(mul(clipM.get(neck), inv(rest.get(neck))), rest.get(ref('bip01 l upperarm'))).t) > 4, 'set in the graph\'s space it stood off the twisted chest');
  // the legs: retail's rest stands its knees 6.7 units off their mirror, so the graph law slid a mirrored knee off its thigh
  const knee = new Map(); turnBone(sk, knee, 'Bip01 R Calf', [0, 0, 1], 60);
  const pk = new Map(knee);
  applyMirrorRig(sk, pk, GRAPH_ROOT, skeletonSpaceMatrices, { full: true });
  const lc = ref('bip01 l calf');
  assert.ok(dist(pk.get(lc).translation, sk.nodes.get(lc).rest.translation) < 1e-4, 'the left knee on the left thigh');
  const km = M(sk, knee), lt = ref('bip01 l thigh'), rc = ref('bip01 r calf'), rt = ref('bip01 r thigh');
  const graphKnee = mul(mul(mul(mul(S, km.get(rc)), inv(rest.get(rc))), S), rest.get(lc));
  const graphThigh = mul(mul(mul(mul(S, km.get(rt)), inv(rest.get(rt))), S), rest.get(lt));
  assert.ok(dist(mul(inv(graphThigh), graphKnee).t, sk.nodes.get(lc).rest.translation) > 3, 'the graph law slid it more than 3 units');
});

test('TWO-HANDS mirror, NO POP: a new composition starts from where the arm was drawn last frame and eases onto its own place over the carry\'s time constant (ClimbPose\'s limb law); a composition that ends eases back to the clip; TWO-HANDS AUDIT (finding 3): carried in each bone\'s own frame, no bone leaves its parent on any frame of it and the Shield Bone never leaves its hand; (finding 6) a carry that has drawn nothing takes its first composition as it stands', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const clip = bentRight(sk, plan);
  const state = {};
  const frame = (req, dt = 1 / 60, st = state) => { const p = new Map(clip); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { ...req, carry: { ...req.carry, dt, tau: 0.06, state: st } }); return M(sk, p); };
  // the right hand: as the clip bends it under A (the left arm set as its mirror), the left's rest in the mirror under B
  const A = { limbs: { L: { pose: null, side: 'R', mirror: true } }, carry: { key: 'A' } };
  const B = { full: true, carry: { key: 'B' } };
  const target = (req) => { const p = new Map(clip); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { full: req.full, limbs: req.limbs }); return M(sk, p); };
  let m = frame(A);
  for (const [r, t] of target(A)) assert.ok(diff(m.get(r), t) < 1e-6, 'a fresh carry: the first composition at once - nothing was drawn to carry from');
  assert.equal(state.key, 'A');
  assert.equal(state.from, null);
  for (let i = 0; i < 30; i++) m = frame(A);
  const lastA = m;
  const firstB = frame(B);
  for (const [r, t] of lastA) assert.ok(diff(firstB.get(r), t) < 1e-3, `the first frame of the new composition is where the last one left every bone: ${sk.nodes.get(r)?.name ?? r}`);
  const tB = target(B).get(plan.hands.R);
  const secondB = frame(B).get(plan.hands.R);
  assert.ok(diff(tB, lastA.get(plan.hands.R)) > 0.1, 'the compositions differ for this hand');
  assert.ok(diff(secondB, lastA.get(plan.hands.R)) < 0.5 * diff(tB, lastA.get(plan.hands.R)), 'and eases - it does not snap on the next');
  const sb = sk.byName.get('shield bone'), lh = sk.nodes.get(sb).parent, sbLen = Math.hypot(...sk.nodes.get(sb).rest.translation);
  let worst = 0, shield = 0;
  for (let i = 0; i < 90; i++) {
    m = frame(B);
    worst = Math.max(worst, worstBone(sk, m));
    shield = Math.max(shield, Math.abs(dist(m.get(lh).t, m.get(sb).t) - sbLen));
  }
  assert.ok(worst < 1e-3, `no bone leaves its parent through the carry (${worst})`);
  assert.ok(shield < 1e-4, `the Shield Bone rides its hand (${shield})`);
  assert.ok(diff(m.get(plan.hands.R), target(B).get(plan.hands.R)) < 1e-3, 'and it settles on its own');
  // the composition ends: back to the clip, eased
  const firstNone = frame({ carry: { key: 'none' } });
  for (const [r, t] of m) assert.ok(diff(firstNone.get(r), t) < 1e-3, 'no pop on the way out either');
  for (let i = 0; i < 90; i++) frame({ carry: { key: 'none' } });
  assert.equal(state.last, null, 'and then nothing is carried');
  const p = new Map(clip);
  assert.equal(applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { carry: { key: 'none', dt: 1 / 60, tau: 0.06, state } }), null, 'the clip stands');
});

test('TWO-HANDS AUDIT mirror, ITS COST (finding 10): the frame composes no matrix of the skeleton - the plan reads the rests once, every frame after it (an arm mirrored, the whole body, a carry) none - and an arm read from another clip is sampled for that arm\'s bones alone', () => {
  const sk = retail();
  let calls = 0;
  const counted = (s, p, r) => { calls++; return skeletonSpaceMatrices(s, p, r); };
  const plan = mirrorPlan(sk, GRAPH_ROOT, counted);
  calls = 0;
  const clip = bentRight(sk, plan);
  const state = {};
  for (let i = 0; i < 60; i++) {
    const p = new Map(clip);
    const dual = i < 30;
    applyMirrorRig(sk, p, GRAPH_ROOT, counted, { full: !dual, limbs: dual ? { L: { pose: null, side: 'R', mirror: true } } : { R: { pose: new Map(), side: 'R', mirror: false } }, carry: { key: dual ? 'dual' : 'dual:L', dt: 1 / 60, tau: 0.06, state } });
  }
  assert.equal(calls, 0, 'no matrix composed in sixty frames');
  assert.deepEqual([...limbSkeleton(sk, GRAPH_ROOT, skeletonSpaceMatrices, 'L', { side: 'R', mirror: true }).nodes.keys()], plan.arms.R, 'a mirrored arm reads the other arm');
  assert.deepEqual([...limbSkeleton(sk, GRAPH_ROOT, skeletonSpaceMatrices, 'R', { side: 'R', mirror: false }).nodes.keys()], plan.arms.R, 'a copied arm its own');
  // through the assembly: the other clip's sampler is asked for the arm it reads, and for no other bone
  const tracks = new Map([...sk.nodes.values()].map((n) => [n.name.toLowerCase(), {}]));
  let sampled = 0;
  const idleSampler = () => { sampled++; return {}; };
  const assembly = { fns: { poseSkeleton, skelMats: skeletonSpaceMatrices }, skeleton: sk, pieces: [] };
  poseAssembly(assembly, { tracks, sampleTrack: () => ({}), time: 0, mirror: { limbs: { L: { clip: { tracks, sampleTrack: idleSampler, time: 0 }, side: 'R', mirror: true } } } });
  assert.equal(sampled, plan.arms.R.length, `the idle sampled for the right arm's ${plan.arms.R.length} bones (the skeleton has ${sk.nodes.size})`);
  assert.ok(assembly.mirrored?.length >= plan.arms.L.length - 1, 'and the left arm written from it');
});

test('TWO-HANDS AUDIT mirror, THE GUARD (Mac: "the other weapon in hand should lower slightly"): an arm\'s `dip` turns its upper arm DOWN about its own joint in the upright plane through shoulder and wrist - the hand lower, its way across unchanged, the shoulder where it was, every bone its length, the other arm untouched', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const pose = bentRight(sk, plan);
  const before = M(sk, pose);
  const p = new Map(pose);
  const wrote = applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } }, dip: { L: 0.1, R: 0 } });
  assert.ok(wrote.includes(plan.uppers.L), 'the left upper arm written');
  const plain = new Map(pose); applyMirrorRig(sk, plain, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } } });
  const a = M(sk, plain), b = M(sk, p);
  const sh = plan.uppers.L, wr = plan.hands.L;
  const d0 = [a.get(wr).t[0] - a.get(sh).t[0], a.get(wr).t[1] - a.get(sh).t[1], a.get(wr).t[2] - a.get(sh).t[2]];
  const d1 = [b.get(wr).t[0] - b.get(sh).t[0], b.get(wr).t[1] - b.get(sh).t[1], b.get(wr).t[2] - b.get(sh).t[2]];
  const len = Math.hypot(...d0);
  assert.ok(dist(a.get(sh).t, b.get(sh).t) < 1e-4, 'the shoulder where it was');
  assert.ok(Math.abs(Math.hypot(...d1) - len) < 1e-3 && worstBone(sk, b) < 1e-3, 'no bone changes its length');
  const elev = (d) => Math.atan2(d[2], Math.hypot(d[0], d[1]));
  assert.ok(Math.abs(elev(d0) - elev(d1) - 0.1) < 2e-3, `the shoulder-to-wrist line 0.1 rad lower (${(elev(d0) - elev(d1)).toFixed(4)})`);
  assert.ok(Math.abs(Math.atan2(d0[1], d0[0]) - Math.atan2(d1[1], d1[0])) < 1e-3, 'in its upright plane: its way across unchanged');
  for (const ref of plan.arms.R) assert.ok(diff(b.get(ref), a.get(ref)) < 1e-6, 'the other arm untouched');
  for (const ref of plan.arms.R) assert.ok(diff(b.get(ref), before.get(ref)) < 1e-6);
  // with nothing composed, the guard stands alone (it eases away after a pair is put away)
  const q = new Map(pose);
  assert.deepEqual(applyMirrorRig(sk, q, GRAPH_ROOT, skeletonSpaceMatrices, { dip: { L: 0, R: 0.05 } }), [plan.uppers.R]);
});

test('TWO-HANDS mirror: which fist a clip throws - the wrist that travels the farther between two of its poses', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const bent = bentRight(sk, plan);
  assert.equal(strikingSide(sk, GRAPH_ROOT, skeletonSpaceMatrices, new Map(), bent), 'R');
  const left = new Map(); applyMirrorRig(sk, left, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: bent, side: 'R', mirror: true } } });
  assert.equal(strikingSide(sk, GRAPH_ROOT, skeletonSpaceMatrices, new Map(), left), 'L');
  assert.equal(strikingSide(sk, GRAPH_ROOT, skeletonSpaceMatrices, new Map(), new Map()), null, 'neither moves');
});

// ---- THE LEFT HAND'S WEAPON BONE ------------------------------------------------------------------------------------

/** Rename every occurrence of a NIF string of the same length (the file stays valid) - a fixture made retail-shaped. */
function patchName(bytes, from, to) {
  assert.equal(from.length, to.length);
  const a = [...from].map((c) => c.charCodeAt(0)), b = [...to].map((c) => c.charCodeAt(0));
  const out = bytes.slice(); let n = 0;
  outer: for (let i = 0; i <= out.length - a.length; i++) { for (let j = 0; j < a.length; j++) if (out[i + j] !== a[j]) continue outer; out.set(b, i); n++; }
  assert.ok(n > 0, `${from} is in the file`);
  return out;
}
/** The fixture arm with no Weapon Bone Left, as retail's skeletons have none. */
const noLeftBone = () => patchName(f('armfp.nif'), 'Weapon Bone Left', 'Weapon Bone XLft');
/** ...and with no Weapon Bone either: nothing to make one from. */
const noWeaponBone = () => patchName(noLeftBone(), 'Weapon Bone', 'Weapon Bonx');
const injectAddon = (sk) => { const a = offWeaponBoneAddon(sk, GRAPH_ROOT, skeletonSpaceMatrices); return a ? injectSkeletonNodes(sk, a) : null; };

test('TWO-HANDS AUDIT the left hand\'s weapon bone (finding 1; AUDIT 2, L3 M1): a skeleton without a Weapon Bone Left - every retail one - is given one made by the mirror from its own Weapon Bone, under the left hand, MIRRORED HAND TO HAND - local(WBL) = F^-1 . local(Weapon Bone) . X, F the hands\' mirror in the frame the skeleton file\'s own skin binds them (retail\'s Tri Shadow: the grip in the left fist as the right\'s in the right), the rest\'s own where no skin binds both, a turned skin never read; on the fixture arm (which carries both) exactly the authored one; on the retail biped the plan then pairs the two weapon bones; a skeleton that has one, or no Weapon Bone, is given none; read off two names, never the whole plan', async () => {
  assert.equal(counterpartName('Weapon Bone'), OFF_WEAPON_BONE.toLowerCase(), 'the node the left hand\'s weapon hangs on, the Weapon Bone\'s counterpart');
  const X = { a: Float32Array.from([-1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] };
  const lin = (m) => ({ a: m.a, t: [0, 0, 0] });
  const localOf = (node) => ({ a: Array.from(node.rest.rotation, (v) => v * (node.rest.scale ?? 1)), t: node.rest.translation });
  // the fixture: the authored node, and the one made with it renamed away
  const authored = buildSkeleton(parseNif(f('armfp.nif')));
  assert.equal(offWeaponBoneAddon(authored, GRAPH_ROOT, skeletonSpaceMatrices), null, 'it has one');
  const made = buildSkeleton(parseNif(noLeftBone()));
  const r = injectAddon(made);
  assert.deepEqual(r.added, ['Weapon Bone Left']);
  const wbl = made.byName.get('weapon bone left');
  assert.ok(made.nodes.get(wbl).injected);
  assert.equal(made.nodes.get(made.nodes.get(wbl).parent).name, 'Left Hand', 'under the left hand');
  assert.ok(diff(M(made, new Map()).get(wbl), M(authored, new Map()).get(authored.byName.get('weapon bone left'))) < 1e-6, 'the authored node, exactly');
  // retail, no skin handed: the rest's own mirror of the hands, K = the 3x3 of Rest(R hand)^-1 . S . Rest(L hand) - the
  // 3x3 alone (PIN MOVED, TWO-HANDS AUDIT 2: the first cut hung it at S . Rest(Weapon Bone) . X in the graph's space,
  // which carried the rest's own asymmetry - its hands 1.09 units off each other's mirror - into the grip)
  const sk = retail();
  injectAddon(sk);
  const rest = M(sk, new Map());
  const ref = (n) => sk.byName.get(n);
  const K = lin(mul(mul(inv(rest.get(ref('bip01 r hand'))), SofRest(sk)), rest.get(ref('bip01 l hand'))));
  const node = sk.nodes.get(ref('weapon bone left'));
  assert.equal(node.name, 'Weapon Bone Left');
  assert.equal(sk.nodes.get(node.parent).name, 'Bip01 L Hand');
  assert.ok(diff(localOf(node), mul(mul(inv(K), localOf(sk.nodes.get(ref('weapon bone')))), X)) < 1e-4, 'K^-1 . local(Weapon Bone) . X - the rest\'s mirror, hand to hand');
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  assert.equal(plan.counterpart.get(ref('weapon bone')), ref('weapon bone left'), 'the weapon bones pair');
  assert.deepEqual([...plan.counterpart].filter(([, c]) => c == null).map(([q]) => sk.nodes.get(q).name), ['Shield Bone'], 'the Shield Bone alone rides');
  // the pair at rest on the rest's mirror: the left weapon's frame (x turned back, as rule 13 draws it) is the right's in the mirror
  const p = new Map(); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } } });
  assert.ok(diffRot(mul(M(sk, p).get(ref('weapon bone left')), X), mul(SofRest(sk), rest.get(ref('weapon bone')))) < 1e-4);
  // retail WITH its own skin (the skeleton file's Tri Shadow, bound in the T-pose, symmetric to the last digit where the
  // rest is not): F the 3x3 of Bind(R hand)^-1 . S . Bind(L hand), read here by hand off the shadow's records
  const bytes = retailBytes();
  const nif = parseNif(bytes);
  const skin = buildSkeleton(nif);
  injectSkeletonNodes(skin, offWeaponBoneAddon(skin, GRAPH_ROOT, skeletonSpaceMatrices, nif));
  const IB = (n) => ({ a: SHADOW_INVERSE_BINDS.get(n).a, t: [0, 0, 0] });
  const F = lin(mul(mul(IB('Bip01 R Hand'), { a: [-1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }), inv(IB('Bip01 L Hand'))));
  const want = mul(mul(inv(F), localOf(skin.nodes.get(skin.byName.get('weapon bone')))), X);
  const got = localOf(skin.nodes.get(skin.byName.get('weapon bone left')));
  assert.ok(diff(got, want) < 1e-4, `F^-1 . local(Weapon Bone) . X - the right's grip mirrored into the left fist: ${got.t.map((v) => v.toFixed(2))} / ${want.t.map((v) => v.toFixed(2))}`);
  const firstCut = mul(inv(rest.get(ref('bip01 l hand'))), mul(mul(SofRest(sk), rest.get(ref('weapon bone'))), X));
  assert.ok(dist(firstCut.t, want.t) > 1.3, `the first cut's grip stood ${dist(firstCut.t, want.t).toFixed(3)} units off in the left fist`);
  // ...a skin bound in a turned frame binds in another frame - not read: the rest's mirror stands
  const turned = { ...nif, records: nif.records.map((x) => (x?.type === 'NiSkinData' ? { ...x, transform: { ...x.transform, rotation: Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]) } } : x)) };
  const tsk = buildSkeleton(nif);
  injectSkeletonNodes(tsk, offWeaponBoneAddon(tsk, GRAPH_ROOT, skeletonSpaceMatrices, turned));
  assert.ok(diff(localOf(tsk.nodes.get(tsk.byName.get('weapon bone left'))), localOf(node)) < 1e-6, 'a turned skin: the rest\'s mirror, as with none');
  // the player's assembly hands the skeleton file along: its made bone is the skin's
  const asm = await assembleFirstPersonArm({ skeletonBytes: bytes, parts: [], offWeaponBone: true });
  assert.ok(diff(localOf(asm.skeleton.nodes.get(asm.skeleton.byName.get('weapon bone left'))), want) < 1e-4, 'through the assembly: the skin\'s mirror');
  // TWO-HANDS AUDIT 2 (L3 M5): two names and the hands' rests - never the whole plan (every NPC and peer body made one,
  // ~0.7 ms, to read two bones): a skeleton's names counted as the addon asks them
  const counted = buildSkeleton(nif);
  let asked = 0;
  const names = counted.byName;
  counted.byName = { get: (k) => { asked++; return names.get(k); }, has: (k) => { asked++; return names.has(k); }, set: (k, v) => names.set(k, v) };
  assert.ok(offWeaponBoneAddon(counted, GRAPH_ROOT, skeletonSpaceMatrices, nif));
  assert.ok(asked <= 4, `the addon asked ${asked} names (the plan asks one a bone, ${counted.nodes.size})`);
  const none = buildSkeleton(parseNif(noWeaponBone()));
  assert.equal(offWeaponBoneAddon(none, GRAPH_ROOT, skeletonSpaceMatrices), null, 'no Weapon Bone, nothing to make one from');
});

test('TWO-HANDS the left hand\'s weapon: the right hand\'s record and mesh, hung on the Weapon Bone Left in a slot of its own (rule 13 draws it mirrored, the bow\'s law) - asked of the skeleton AS ASSEMBLED (TWO-HANDS AUDIT, finding 1: the player\'s rigs take the made bone - retail binds), the bytes where nothing else is given; on a skeleton with no such node, nothing, and a note that says why; a bow still reads the actor\'s own bytes (rule 17) and stays on the Weapon Bone', async () => {
  const files = FILES();
  const find = (p) => (files.has(p) ? { get: () => files.get(p) } : null);
  const allWeapons = [{ id: 'iron longsword', model: 'w/blade.nif', type: MW_WEAPON_TYPE.LongBladeOneHand, speed: 1 }, { id: 'long bow', model: 'w/blade.nif', type: MW_WEAPON_TYPE.MarksmanBow, speed: 1 }];
  const ok = resolveOffWeaponParts({ weapon: LONGSWORD, allWeapons, find, skeletonBytes: f('armfp.nif') });
  assert.equal(OFF_WEAPON_BONE, 'Weapon Bone Left');
  assert.deepEqual(ok.parts.map((p) => [p.slot, p.bones]), [['offweapon', ['Weapon Bone Left']]]);
  assert.equal(ok.info.bone, 'Weapon Bone Left');
  const none = resolveOffWeaponParts({ weapon: LONGSWORD, allWeapons, find, skeletonBytes: f('armskel.nif') });
  assert.deepEqual(none.parts, []);
  assert.ok(none.notes.some((n) => /^offweapon: this skeleton has no "Weapon Bone Left" bone/.test(n)), none.notes.join(' | '));
  assert.deepEqual(resolveOffWeaponParts({ weapon: null, allWeapons, find, skeletonBytes: f('armfp.nif') }), { parts: [], info: null, notes: [] });
  // retail: the bytes carry no Weapon Bone Left; the assembly the player's rigs build does
  const bytes = retailBytes();
  assert.deepEqual(resolveOffWeaponParts({ weapon: LONGSWORD, allWeapons, find, skeletonBytes: bytes }).parts, [], 'the bytes alone: none');
  const plain = await assembleFirstPersonArm({ skeletonBytes: bytes, parts: [] });
  assert.equal(plain.skeleton.byName.has('weapon bone left'), false, 'an assembly that does not ask makes none');
  const asm = await assembleFirstPersonArm({ skeletonBytes: bytes, parts: [], offWeaponBone: true });
  assert.ok(asm.skeleton.byName.has('weapon bone left'), 'the player\'s assembly carries one');
  assert.deepEqual(asm.injected.map((i) => [i.name, i.added]), [[WEAPON_BONE_LEFT_SOURCE, ['Weapon Bone Left']]], 'through the addons\' own door, said so');
  const hasBone = (n) => asm.skeleton.byName.has(String(n).toLowerCase());
  const bound = resolveOffWeaponParts({ weapon: LONGSWORD, allWeapons, find, skeletonBytes: bytes, hasBone });
  assert.deepEqual(bound.parts.map((p) => [p.slot, p.bones]), [['offweapon', ['Weapon Bone Left']]], 'asked of the assembled skeleton, it binds');
  // the bow: rule 17 reads the actor's own bytes - the made node is the pair's, never the bow's
  const BOW = { templateIndex: 130 };
  assert.equal(resolveWeaponParts({ weapon: BOW, allWeapons, find, skeletonBytes: f('armfp.nif') }).weaponInfo?.bone, 'Weapon Bone Left', 'a skeleton that carries one: the bow on it');
  assert.equal(resolveWeaponParts({ weapon: BOW, allWeapons, find, skeletonBytes: bytes }).weaponInfo?.bone, 'Weapon Bone', 'retail: the Weapon Bone, as OpenMW falls back');
});

// ---- THE ARM ------------------------------------------------------------------------------------------------------

const wpdtRec = (id, model, type, speed = 1) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0)); const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32); const dv = new DataView(w.buffer); dv.setInt16(8, type, true); dv.setFloat32(12, speed, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
const FILES = (skel = f('armfp.nif')) => new Map([[fpSkeletonPath({}), skel], [FP_CLIP_PATH, f('armfpweapon.kf')], ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')], ['meshes/w/blade.nif', f('weapon.nif')], ['textures/tx_fixture.dds', f('fixture.dds')]]);
const WEAP = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand);
const deps = (files = FILES()) => ({ loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }], storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'], loadMorrowindFile: async (n) => (n === 'weap.esm' ? WEAP : f('armfp.esm')) });
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of a) { out.set(b, o); o += b.length; } return out; };
/** A rig WITH a third-person body: the fixture arm standing as xbase_anim too (`tpSkel`), the two BODY records, the longsword. */
function bodyDeps({ skel = f('armfp.nif'), tpSkel = skel } = {}) {
  const files = new Map([...FILES(skel), ['meshes/xbase_anim.nif', tpSkel], ['meshes/xbase_anim.kf', f('armfpweapon.kf')]]);
  const all = cat(f('armfp.esm'), bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8), WEAP);
  return { loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }], storedMorrowindNames: async () => ['armfp.esm'], loadMorrowindFile: async () => all };
}
const LONGSWORD = { templateIndex: 120 };
const travel = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
/** The blow's strength is the reference's random draw where a clip has no wind-up window (windUpStrength): the arm's
 *  pins run on a seeded stream, so each reads one blow and not a different one each run - or on one fixed `draw`, where
 *  blows are measured against each other (every blow the same strength, the same follow-through). */
async function seeded(fn, draw = null) {
  const real = Math.random;
  let s = 7919;
  Math.random = draw != null ? () => draw : () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  try { return await fn(); } finally { Math.random = real; }
}

async function drawnArm({ files = FILES(), camera = () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0 }), d = deps(files) } = {}) {
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1,
    renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  const arm = createFpArm();
  arm.attach(renderer, camera);
  const res = await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: d });
  assert.ok(res.ok, `${res.stage} ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80; i++) arm.update(0.05);
  return arm;
}
/** A blow by `hand`, played to its end: each wrist's farthest travel from where it stood. */
function blow(arm, hand, strike = 'StrikeDown') {
  arm.update(0.05);
  const s0 = arm.handsState();
  assert.ok(arm.attack(strike, { hand }), `the ${hand} blow begins`);
  let L = 0, R = 0, mirrored = 0;
  for (let i = 0; i < 60; i++) {
    arm.update(0.05);
    const h = arm.handsState();
    L = Math.max(L, travel(s0.wrists.L, h.wrists.L)); R = Math.max(R, travel(s0.wrists.R, h.wrists.R));
    if (h.mirrored) mirrored++;
  }
  return { L, R, mirrored };
}

test('TWO-HANDS the arm, the pair: the left hand\'s weapon binds on both rigs and shows while the pair is drawn (hidden sheathed), glowing with its own element (WEAPON-GLOW1); at rest both arms up, the left the right\'s mirror; a left blow swings the LEFT arm with the right held, a right blow the right with the left held; the blow carries the hand the law gave it', () => seeded(async () => {
  const arm = await drawnArm();
  let h = arm.handsState();
  assert.equal(h.offPieces, 0, 'one hand: no second weapon');
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 4; i++) arm.update(0.05);
  h = arm.handsState();
  assert.equal(h.mode, 'dual');
  assert.equal(h.offPieces, 1, 'bound');
  assert.equal(h.offWeapon?.bone, 'Weapon Bone Left');
  assert.deepEqual(h.offHidden, [false], 'shown while drawn');
  assert.ok(Math.abs(h.wrists.L[0] + h.wrists.R[0]) < 0.05 && Math.abs(h.wrists.L[2] - h.wrists.R[2]) < 0.05, `the left the right's mirror at rest: ${h.wrists.L} / ${h.wrists.R}`);
  assert.equal(await arm.setOffWeapon(LONGSWORD), false, 'the same weapon: the fast path');
  // WEAPON-GLOW1 x TWO-HANDS: the left blade glows with ITS OWN element, laid only on the blade it was asked of while
  // the pair is drawn (the held weapon's NET-1 law, for the second hand); the held weapon's glow is its own
  const frost = { look: 'frost', code: 2, level: 1, ramp: [0.4, 0.7, 1] };
  arm.setOffWeaponGlow(frost, LONGSWORD);
  assert.equal(arm.offWeaponGlow(), frost, 'the bound left blade wears its element');
  assert.equal(arm.weaponGlow(), null, 'and the right hand\'s glow is the right hand\'s (none asked)');
  arm.setOffWeaponGlow(frost, { templateIndex: 113 });
  assert.equal(arm.offWeaponGlow(), null, 'never another weapon\'s glow on the blade the arm holds');
  arm.setOffWeaponGlow(frost, LONGSWORD);
  const left = blow(arm, 'L');
  assert.equal(arm.handsState().attackHand, null, 'the blow ends with its hand');
  for (let i = 0; i < 20; i++) arm.update(0.05);
  const right = blow(arm, 'R');
  assert.ok(left.L > 2 * left.R, `the left blow swings the left arm (${left.L.toFixed(3)} against ${left.R.toFixed(3)})`);
  assert.ok(right.R > 2 * right.L, `the right blow the right (${right.R.toFixed(3)} against ${right.L.toFixed(3)})`);
  assert.ok(left.mirrored > 10, 'the left blow is the clip in the mirror');
  arm.setSheathed(true);
  for (let i = 0; i < 60; i++) arm.update(0.05);
  assert.deepEqual(arm.handsState().offHidden, [true], 'sheathed, the left hand\'s weapon is away with the right\'s');
  assert.equal(arm.offWeaponGlow(), null, 'and its glow with it');
  await arm.setOffWeapon(null);
  assert.equal(arm.handsState().offPieces, 0, 'and a hand emptied lets it go');
}));

test('TWO-HANDS AUDIT the arm, THE PAIR\'S GUARD (Mac: "When attacking with a weapon, the other weapon in hand should lower slightly"): while one hand of a pair strikes the other arm is lowered at its shoulder - at the blow\'s hit its wrist stands GUARD.LOWER of ITS OWN BLADE\'S height on the arms\' picture lower (TWO-HANDS AUDIT 2, L3 M4: the sprite lane\'s weapon law, not the fists\' 9 of 200 px), measured the first time a pair guards and never at the build - eased in fast and out slower (guardStep), the striking arm never, every bone on its parent', () => seeded(async () => {
  const arm = await drawnArm();
  assert.equal(arm.handsState().guardDrop, null, 'TWO-HANDS AUDIT 2 (L3 M5): the build measures no guard - a body that never holds a pair never pays for one');
  assert.equal('guardDip' in arm.built(), false);
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 40; i++) arm.update(1 / 60);
  assert.equal(arm.handsState().guardDrop, null, 'a pair at rest: still unmeasured');
  // the oracle: the left blade AS DRAWN in the pair at rest, seen from the eye - the part of it on the picture (the lens
  // 60 degrees high, the arms looking down +Y), in the lens's tangents; the guard lowers it LOWER of that
  const shownHeight = () => {
    const b = arm.built(), eye = b.arm.mats.get(b.cameraRef).t, v = b.arm.pieces.find((q) => q.slot === 'offweapon').positions, edge = Math.tan(Math.PI / 6);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < v.length; i += 3) { const a = v[i + 1] - eye[1]; if (a > 1e-6) { lo = Math.min(lo, (v[i + 2] - eye[2]) / a); hi = Math.max(hi, (v[i + 2] - eye[2]) / a); } }
    return Math.min(hi, edge) - Math.max(lo, -edge);
  };
  const wantDrop = Math.atan(GUARD.LOWER * shownHeight());
  assert.ok(Math.abs(wantDrop - GUARD_LENS_DROP) > 0.3 * GUARD_LENS_DROP, `the blade's own share (${wantDrop.toFixed(4)}) is not the fists' (${GUARD_LENS_DROP.toFixed(4)}) - the pin tells them apart`);
  const sk = arm.built().arm.skeleton;
  const elev = (hand) => { const b = arm.built(); const eye = b.arm.mats.get(b.cameraRef).t; const w = arm.handsState().wrists[hand]; return Math.atan2(w[2] - eye[2], w[1] - eye[1]); };
  const bones = () => { const m = arm.built().arm.mats; let w = 0; for (const n of ['Left Upper Arm', 'Left Forearm', 'Left Hand']) { const r = sk.byName.get(n.toLowerCase()), node = sk.nodes.get(r); w = Math.max(w, Math.abs(dist(m.get(node.parent).t, m.get(r).t) - Math.hypot(...node.rest.translation))); } return w; };
  const rest = elev('L');
  assert.deepEqual(arm.handsState().guard, { L: 0, R: 0 }, 'at rest no arm lowered');
  assert.ok(arm.attack('StrikeDown', { hand: 'R' }));
  const g = [];
  let worst = 0;
  for (let i = 0; i < 150; i++) {
    arm.update(1 / 60);
    const h = arm.handsState();
    assert.equal(h.guard.R, 0, 'the striking arm is never lowered');
    worst = Math.max(worst, bones());
    g.push({ w: h.guard.L, e: elev('L'), u: arm.status().upperName });
  }
  const rel = g.map((r, i) => (r.u === 'AttackRelease' ? i : -1)).filter((i) => i >= 0);
  const at = rel[rel.length - 1];   // the release's last frame: the blow's hit
  const drop = rest - g[at].e;
  // PIN MOVED (TWO-HANDS AUDIT 2, L3 M4): the drop was the fists' GUARD.DOWN of 200 px (GUARD_LENS_DROP, 0.0519 rad)
  assert.ok(Math.abs(drop - wantDrop) < 0.15 * wantDrop, `at the hit the held wrist is ${drop.toFixed(4)} rad lower on the picture (LOWER ${GUARD.LOWER} of its blade's ${shownHeight().toFixed(3)} on the picture: ${wantDrop.toFixed(4)}; the fists' ${GUARD_LENS_DROP.toFixed(4)})`);
  assert.ok(Math.abs(arm.handsState().guardDrop.L - wantDrop) < 0.1 * wantDrop, `measured once, on the build's rest: ${arm.handsState().guardDrop.L.toFixed(4)} (as drawn at rest ${wantDrop.toFixed(4)})`);
  // the left blade is measured in the RIGHT hand (its bone's counterpart, unmirrored): a pair at rest holds the left arm as
  // the right's mirror, which stands its blade as tall - wherever the left hand stands when the guard is first asked
  const built = arm.built(), turned = new Map(built.restMats), wblRef = built.arm.skeleton.byName.get('weapon bone left');
  turned.set(wblRef, { a: Float32Array.from([1, 0, 0, 0, 0, -1, 0, 1, 0]), t: turned.get(wblRef).t });
  const piece = (slot) => built.arm.pieces.find((q) => q.slot === slot);
  assert.equal(bladePictureHeight(built.arm, turned, built.cameraRef, piece('offweapon')), bladePictureHeight(built.arm, built.restMats, built.cameraRef, piece('weapon')), 'the left blade measured in the right hand');
  assert.ok(g[2].w > 0.6, `in fast (three frames: ${g[2].w.toFixed(3)}, GUARD.IN_TAU ${GUARD.IN_TAU} s)`);
  const end = g.findIndex((r) => r.u === 'WeaponEquipped');
  assert.ok(end > at && g[end + 2].w > 0.6 && g[end + 2].w < 0.95, `out slower (three frames after the blow: ${g[end + 2].w.toFixed(3)}, GUARD.OUT_TAU ${GUARD.OUT_TAU} s)`);
  assert.ok(worst < 1e-4, `the arm lowered at its shoulder, never moved off it (${worst})`);
  assert.equal(g[g.length - 1].w, 0, 'and up again');
  assert.ok(Math.abs(g[g.length - 1].e - rest) < 0.01, `back where it rested (${g[g.length - 1].e.toFixed(4)} / ${rest.toFixed(4)})`);
}, 0.5));

test('TWO-HANDS AUDIT the arm on a skeleton WITHOUT a Weapon Bone Left (finding 1 - every retail one): both rigs take the made bone, the left weapon binds on both and the pair swings both arms; the composition stands on the pair held, not on a blade bound; a body with no Weapon Bone at all binds none and its own card says why', () => seeded(async () => {
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  const build = async (o) => { const arm = createFpArm(); arm.attach(renderer, () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0 })); const res = await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: bodyDeps(o) }); assert.ok(res.ok && res.third?.ok, `${res.stage} ${res.error} / ${res.third?.error}`); arm.setSheathed(false); for (let i = 0; i < 80; i++) arm.update(0.05); return arm; };
  const arm = await build({ skel: noLeftBone() });
  const fp = arm.built().arm, tp = arm.built().third.arm;
  for (const a of [fp, tp]) {
    assert.ok(a.skeleton.nodes.get(a.skeleton.byName.get('weapon bone left'))?.injected, 'each rig made its own');
    assert.ok(a.injected.some((i) => i.name === WEAPON_BONE_LEFT_SOURCE));
  }
  arm.setHands({ mode: 'dual', lead: 'R' });
  for (let i = 0; i < 20; i++) arm.update(0.05);
  let h = arm.handsState();
  assert.equal(h.offPieces, 0, 'no blade yet');
  assert.equal(h.pair, true);
  assert.ok(h.mirrored && h.composed === 'dual', 'the pair held: the left arm is the right\'s mirror before any blade binds');
  assert.ok(Math.abs(h.wrists.L[0] + h.wrists.R[0]) < 0.05, `${h.wrists.L} / ${h.wrists.R}`);
  // TWO-HANDS AUDIT 2 (L3 M4): the guard of a hand that holds no blade is the fists' tuck (GUARD.DOWN of 200 px); the hand
  // with one, LOWER of that blade's own height - each measured once per blade bound
  blow(arm, 'R');
  assert.equal(arm.handsState().guardDrop.L, GUARD_LENS_DROP, 'the bladeless left hand: the fists\' tuck');
  assert.ok(arm.handsState().guardDrop.R > 1.3 * GUARD_LENS_DROP, `the right, its blade's share: ${arm.handsState().guardDrop.R.toFixed(4)}`);
  for (let i = 0; i < 20; i++) arm.update(0.05);
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 4; i++) arm.update(0.05);
  h = arm.handsState();
  assert.equal(h.offWeapon?.bone, 'Weapon Bone Left', 'the first-person arm binds it');
  assert.equal(arm.status().third.offWeapon?.bone, 'Weapon Bone Left', 'and the body');
  const left = blow(arm, 'L');
  assert.ok(left.mirrored > 10 && left.L > 2 * left.R, `the left blow is the left arm's (${left.L.toFixed(3)} / ${left.R.toFixed(3)})`);
  assert.ok(Math.abs(arm.handsState().guardDrop.L - arm.handsState().guardDrop.R) < 1e-9, 'the left blade bound: measured again, its own share (the same longsword)');
  arm.setViewMode('third');
  for (let i = 0; i < 10; i++) arm.update(0.05);
  assert.deepEqual(arm.thirdMesh().ranges.filter((r) => r.slot === 'offweapon').map((r) => r.hidden), [false], 'the body draws it');
  // the body on a skeleton with no Weapon Bone: nothing made, nothing bound, and the body's notes say why
  const bare = await build({ tpSkel: noWeaponBone() });
  bare.setHands({ mode: 'dual', lead: 'R' });
  await bare.setOffWeapon(LONGSWORD);
  assert.equal(bare.built().third.arm.skeleton.byName.has('weapon bone left'), false);
  assert.equal(bare.status().third.offWeapon, null);
  assert.ok(bare.built().third.notes.some((n) => /^offweapon: /.test(n)), `the body's card: ${bare.built().third.notes.join(' | ')}`);
}));

test('TWO-HANDS the arm, the fists: a blow by the hand its clip throws with plays as the clip has it; a blow by the other is the clip in the mirror - the other fist held where the idle holds it', () => seeded(async () => {
  // PIN MOVED (TWO-HANDS AUDIT): run on a seeded stream (seeded()) - the blows' strengths are the reference's random
  // draw on this fixture (no wind-up window), and unseeded the 3x ratio below failed one run in ten at the base commit
  // too (2.67x at the worst draw, measured over forty streams)
  const arm = await drawnArm();
  arm.setHands({ mode: 'fists', lead: 'R' });
  const same = blow(arm, 'R');
  for (let i = 0; i < 20; i++) arm.update(0.05);
  const other = blow(arm, 'L');
  assert.equal(same.mirrored, 0, 'the clip\'s own hand: as authored');
  assert.ok(other.mirrored > 10, 'the other hand: in the mirror');
  assert.ok(other.L > 3 * other.R, `the left fist throws it (${other.L.toFixed(3)} against ${other.R.toFixed(3)})`);
  arm.setHands({ mode: 'single' });
  for (let i = 0; i < 20; i++) arm.update(0.05);
  assert.equal(blow(arm, 'L').mirrored, 0, 'one hand in use: no mirror whatever the blow says');
}));

test('TWO-HANDS AUDIT the arm, A MIRRORED BLOW KEEPS THE WAY ASKED (finding 5): a left hand\'s slash is the right hand\'s MIRROR strike in the glass (handsLaw.js mirrorStrike, the sprite lane\'s law) - its StrikeLeft the right\'s backhand, its StrikeRight the right\'s forehand - frame for frame; the blow not in the mirror keeps its own way', () => seeded(async () => {
  const arm = await drawnArm();
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 10; i++) arm.update(0.05);
  const run = (hand, strike) => {
    for (let i = 0; i < 40; i++) arm.update(0.05);
    assert.ok(arm.attack(strike, { hand }));
    const reversed = arm.status().attackReversed;
    const path = [];
    for (let i = 0; i < 200 && /^Attack/.test(arm.status().upperName); i++) { arm.update(0.02); path.push(arm.handsState().wrists[hand].slice()); }
    return { reversed, path };
  };
  const b = {};
  for (const strike of ['StrikeLeft', 'StrikeRight']) for (const hand of ['R', 'L']) b[`${hand}:${strike}`] = run(hand, strike);
  assert.deepEqual(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.reversed])), { 'R:StrikeLeft': false, 'L:StrikeLeft': true, 'R:StrikeRight': true, 'L:StrikeRight': false },
    'the backhand is the right\'s StrikeRight and the left\'s StrikeLeft');
  // the fixture is its own mirror about x = 0: the left wrist's path against the right's, x negated
  const mirrorMiss = (a, c) => { const n = Math.min(a.length, c.length); let w = 0; for (let i = 3; i < n; i++) w = Math.max(w, Math.hypot(a[i][0] + c[i][0], a[i][1] - c[i][1], a[i][2] - c[i][2])); return w; };
  for (const [l, law, bug] of [['L:StrikeLeft', 'R:StrikeRight', 'R:StrikeLeft'], ['L:StrikeRight', 'R:StrikeLeft', 'R:StrikeRight']]) {
    const asked = mirrorMiss(b[l].path, b[law].path), played = mirrorMiss(b[l].path, b[bug].path);
    assert.equal(b[l].path.length, b[law].path.length, `${l}: the mirror strike's clip, its length`);
    assert.ok(asked < 0.5 * played, `${l} is ${law} in the glass (${asked.toFixed(4)}), not ${bug} (${played.toFixed(4)})`);
  }
  // one hand in use: a blow the rig hands a hand to is not mirrored, and keeps its own way
  arm.setHands({ mode: 'single' });
  for (let i = 0; i < 40; i++) arm.update(0.05);
  assert.ok(arm.attack('StrikeLeft', { hand: 'L' }));
  assert.equal(arm.status().attackReversed, false);
}, 0.5));

test('TWO-HANDS the arm, the running hands: running with nothing in hand the pump takes the hands (up as the run starts, posed past half), the two wrists out of step with the stride; a punch takes them at once; the run\'s end lets them go; third person never; the rig\'s own stride phase (the head bob\'s clock) is FOLLOWED - stood on while it keeps the stride\'s step, caught up within CATCH of the stride\'s tempo when it jumps (TWO-HANDS AUDIT 2, L3 M3) - the speed\'s walk where it hands none', () => seeded(async () => {
  const arm = await drawnArm();
  arm.setHands({ mode: 'fists', lead: 'R' });
  arm.setSheathed(true);
  for (let i = 0; i < 60; i++) arm.update(0.05);
  assert.equal(arm.runPosed(), false);
  arm.setRunHands(true, { speed: 7 });
  const zs = { L: [], R: [] };
  for (let i = 0; i < 60; i++) { arm.update(1 / 30); const h = arm.handsState(); zs.L.push(h.wrists.L[2]); zs.R.push(h.wrists.R[2]); }
  assert.equal(arm.runPosed(), true);
  assert.ok(arm.handsState().run.w > 0.99);
  const hw = arm.handsState().wrists;
  assert.ok(hw.L[0] < 0 && hw.R[0] > 0, 'each hand pumps on its own side');
  const span = (a) => Math.max(...a.slice(20)) - Math.min(...a.slice(20));
  assert.ok(span(zs.L) > 0.1 && span(zs.R) > 0.1, `both pump (${span(zs.L).toFixed(3)}, ${span(zs.R).toFixed(3)})`);
  let opposite = 0, n = 0;
  for (let i = 21; i < 60; i++) { const a = zs.L[i] - zs.L[i - 1], b = zs.R[i] - zs.R[i - 1]; if (Math.abs(a) > 1e-3 && Math.abs(b) > 1e-3) { n++; if (Math.sign(a) !== Math.sign(b)) opposite++; } }
  assert.ok(opposite / n > 0.8, `out of step (${opposite}/${n})`);
  // PIN MOVED (TWO-HANDS AUDIT 2, L3 M3): the rig's phase was taken AS IT STANDS (`run.phase === 2.5` for a phase handed
  // still) - and HeadBobber's clock jumps: a run resumed inside its 0.5 s stop sets the timer to PI, so a stutter-step
  // swapped the fists in a frame. Now the phase FOLLOWS the bob: on it while the bob keeps the stride's step, caught up
  // within RUN_PUMP.CATCH of the stride's own tempo when it jumps, never backward. A real HeadBobber drives it here.
  const bobber = new HeadBobber(), bag = {}, look = { pitch: 0, yaw: 0 };
  const DT = 1 / 60, V = 7, walk = V * DT * Math.PI / RUN_STEP_M;
  const runFrame = (moving) => {
    bobber.update(DT, look, { enabled: true, running: true, grounded: true, velocity: moving ? V : 0, moving, out: bag });
    const before = arm.handsState().run.phase;
    arm.setRunHands(true, { speed: moving ? V : 0, phase: runPhaseOfBob(bag.bobTimer) });
    arm.update(DT);
    const after = arm.handsState().run.phase;
    return { step: after - before - 2 * Math.PI * Math.round((after - before) / (2 * Math.PI)), on: after === runPhaseOfBob(bag.bobTimer), wrists: arm.handsState().wrists };
  };
  for (let i = 0; i < 90; i++) runFrame(true);
  assert.ok(runFrame(true).on, 'a steady run: the stroke stands ON the bob\'s phase, to the last digit');
  // the stutter-step: one frame stopped mid-run, and the bob's timer jumps back to PI as the run resumes - from a stride
  // half a turn away from it, the arms' swap the first cut drew
  for (let i = 0; i < 120 && Math.abs(bobber.timer - 1.5 * Math.PI) > 0.2 && bobber.timer > 0.2; i++) runFrame(true);
  const jump = Math.abs(bobber.timer - Math.PI);
  assert.ok(jump > 1, `the stop lands far from PI (${bobber.timer.toFixed(2)})`);
  const steady = runFrame(true);
  const stride = travel(arm.handsState().wrists.R, runFrame(true).wrists.R);
  runFrame(false);
  const resumed = [];
  for (let i = 0; i < 60; i++) resumed.push(runFrame(true));
  assert.ok(resumed.every((r) => r.step >= walk * (1 - RUN_PUMP.CATCH) - 1e-9 && r.step <= walk * (1 + RUN_PUMP.CATCH) + 1e-9), `no frame steps outside the stride's tempo, +-CATCH: ${resumed.slice(0, 4).map((r) => r.step.toFixed(3))} (a stride's step ${walk.toFixed(3)})`);
  const swing = Math.max(...resumed.slice(0, 3).map((r, i) => travel((i ? resumed[i - 1] : steady).wrists.R, r.wrists.R)));
  assert.ok(swing < 3 * stride + 0.02, `the fists never swap in a frame: ${swing.toFixed(3)} (a running frame's ${stride.toFixed(3)})`);
  assert.ok(resumed.slice(-5).every((r) => r.on), `caught up within a second: back ON the bob's phase (it jumped ${jump.toFixed(2)})`);
  // none handed (head bobbing off): the speed's own stride, exactly
  arm.setRunHands(true, { speed: V });
  const p0 = arm.handsState().run.phase;
  arm.update(DT);
  assert.ok(Math.abs(arm.handsState().run.phase - (p0 + walk) % (2 * Math.PI)) < 1e-9, 'no phase handed: the speed walks it, a stride\'s step a frame');
  arm.setRunHands(false);
  for (let i = 0; i < 60; i++) arm.update(1 / 30);
  assert.equal(arm.runPosed(), false);
  assert.equal(arm.handsState().run.w, 0, 'let go');
  // a punch takes the hands at once
  arm.setSheathed(false);
  for (let i = 0; i < 80; i++) arm.update(0.05);
  arm.setRunHands(true, { speed: 7 });
  for (let i = 0; i < 30; i++) arm.update(1 / 30);
  assert.ok(arm.handsState().run.w > 0.9);
  arm.attack('StrikeDown', { hand: 'R' });
  for (let i = 0; i < 6; i++) arm.update(1 / 30);
  assert.ok(arm.handsState().run.w < 0.05, 'the punch is the fist\'s own');
}));

test('TWO-HANDS AUDIT the arm, THE RUN AND THE CLIMB BLEND (finding 4): onto the wall from a run the hands step as the climb\'s own ease steps (no frame drops the run whole), off it onto a run no frame jumps, and the frame a sheet comes up mid-run the hands move as they were moving', () => seeded(async () => {
  const climb = { feet: [0, 0, 0], yaw: 0, track: null, floorGap: Infinity, mode: 'hang', classic: false, normal: [0, 0, -1], lipY: 1.9, move: null, grip: 1, flight: null };
  let onWall = false;
  const arm = await drawnArm({ camera: () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0, climb: onWall ? climb : null }) });
  arm.setHands({ mode: 'fists', lead: 'R' });
  arm.setSheathed(true);
  for (let i = 0; i < 40; i++) arm.update(1 / 60);
  arm.setRunHands(true, { speed: 7 });
  let prev = arm.handsState().wrists, steady = 0;
  const step = () => { arm.update(1 / 60); const w = arm.handsState().wrists; const d = Math.max(travel(prev.L, w.L), travel(prev.R, w.R)); prev = w; return d; };
  for (let i = 0; i < 120; i++) { const d = step(); if (i >= 60) steady = Math.max(steady, d); }
  arm.setRunHands(false); onWall = true;
  const on = []; for (let i = 0; i < 60; i++) on.push(step());
  // the climb's ease is geometric: each step a share of the last. The run dropped whole made the first step four times the next.
  assert.ok(on[0] < 2 * on[1], `onto the wall: ${on.slice(0, 4).map((v) => v.toFixed(3)).join(' ')}`);
  for (let i = 2; i < 20; i++) assert.ok(on[i] <= on[i - 1] * 1.05 + 1e-3, `and eases on (${i}: ${on[i].toFixed(3)} after ${on[i - 1].toFixed(3)})`);
  onWall = false; arm.setRunHands(true, { speed: 7 });
  const off = []; for (let i = 0; i < 90; i++) off.push(step());
  for (let i = 1; i < off.length; i++) assert.ok(off[i] < 2 * Math.max(off[i - 1], steady), `off the wall, frame ${i}: ${off[i].toFixed(3)} after ${off[i - 1].toFixed(3)} (the run came back whole as the climb let go)`);
  // the sheet: the rig's runHandsWanted drops the run as the map comes up, and the run eases out under it
  for (let i = 0; i < 60; i++) step();
  arm.setRunHands(false);
  assert.ok(arm.holdPaper());
  const sheet = step();
  assert.ok(sheet < 2 * steady, `the frame the sheet comes up: ${sheet.toFixed(3)} (a running stroke steps ${steady.toFixed(3)})`);
}));

test('TWO-HANDS AUDIT the arm, THE RUN ON THE LENS (finding 11): with the arms on the law (follow-camera off) the running hands are asked for the same places ON THE PICTURE whichever way the player looks - their lines laid in the pitched lens\'s frame - and the wrists stand there', () => seeded(async () => {
  let pitch = 0;
  const arm = await drawnArm({ camera: () => ({ pitch, pos: [0, 1.6, 0], yaw: 0 }) });
  arm.setFollowCamera(false);
  try {
    arm.setHands({ mode: 'fists', lead: 'R' });
    arm.setSheathed(true);
    for (let i = 0; i < 40; i++) arm.update(1 / 60);
    // a phase that stands, so each look reads the same stroke - PIN MOVED (TWO-HANDS AUDIT 2): and a stride that stands
    // with it (speed 0): the phase now FOLLOWS the bob within the stride's tempo (handsLaw.js runPhaseFollow), and a bob
    // standing still under a body running 7 m/s is no clock it stands on
    arm.setRunHands(true, { speed: 0, phase: 1 });
    arm.update(1 / 60);
    assert.equal(arm.handsState().run.phase, 1, 'the run\'s first frame takes the rig\'s phase at once - nothing of the pump drawn yet (runPhaseFollow\'s `fresh`)');
    const onLens = (eye, p) => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]]; const fwd = [0, Math.cos(pitch), Math.sin(pitch)], up = [0, -Math.sin(pitch), Math.cos(pitch)]; return Math.atan2(d[0] * up[0] + d[1] * up[1] + d[2] * up[2], d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2]); };
    const read = {};
    for (const p of [0, -0.5, 0.5]) {
      pitch = p;
      for (let i = 0; i < 120; i++) arm.update(1 / 60);
      const t = arm.handsState().run.targets;
      const b = arm.built(), eye = b.arm.mats.get(b.cameraRef).t;
      read[p] = { asked: onLens(t.eye, t.R), wrist: onLens(eye, arm.handsState().wrists.R) };
    }
    for (const p of [-0.5, 0.5]) {
      assert.ok(Math.abs(read[p].asked - read[0].asked) < 1e-6, `look ${p}: the stroke asked for at ${read[p].asked.toFixed(4)} rad up the picture, as at 0 (${read[0].asked.toFixed(4)})`);
      assert.ok(Math.abs(read[p].wrist - read[0].wrist) < 0.06, `look ${p}: the wrist ${read[p].wrist.toFixed(3)} rad, at 0 ${read[0].wrist.toFixed(3)} (laid unpitched it moved 0.4)`);
    }
  } finally { arm.setFollowCamera(true); }
}));

test('RUN-WIDE THE FIRST PERSON\'S RUNNING FISTS (2026-10-19, Mac: "The hands are way too close together when running both in third and first person"): the top of the pump\'s stroke stands each fist before and just outside its own shoulder - its line through the picture, at its distance out, past the retail shoulder joint across, on a 16:9 picture and a 4:3 one (at 0.36 of the half-frame it stood 14 cm across and 11, toward the middle) - and the arm\'s own run asks the wrist for that place (mutants: RUN-WIDE-the-first-person-fists-in)', () => seeded(async () => {
  const sk = retail(), rest = M(sk, new Map());
  const shoulder = dist(rest.get(sk.byName.get('bip01 l upperarm')).t, rest.get(sk.byName.get('bip01 r upperarm')).t) / 2 / MW_UNITS_PER_METER;
  const tanV = Math.tan(FP_FIELD_OF_VIEW / 2);
  const across = (aspect) => { const v = [RUN_3D.TOP.x * tanV * aspect, 1, RUN_3D.TOP.y * tanV]; return (RUN_3D.TOP.d * v[0]) / Math.hypot(v[0], v[1], v[2]); };
  for (const aspect of [16 / 9, 4 / 3]) assert.ok(across(aspect) > shoulder, `at ${aspect.toFixed(2)}: the fist ${across(aspect).toFixed(3)} m across, the shoulder ${shoulder.toFixed(3)}`);
  // the arm asks for it: the right hand at the top of its stroke, on the picture at the law's share across
  const arm = await drawnArm();
  arm.setHands({ mode: 'fists', lead: 'R' });
  arm.setSheathed(true);
  for (let i = 0; i < 40; i++) arm.update(1 / 60);
  arm.setRunHands(true, { speed: 0, phase: Math.PI / 2 });
  arm.update(1 / 60);
  const t = arm.handsState().run.targets, d = [t.R[0] - t.eye[0], t.R[1] - t.eye[1], t.R[2] - t.eye[2]];
  assert.ok(Math.abs(d[0] / d[1] / (tanV * 16 / 9) - RUN_3D.TOP.x) < 1e-6, `the right fist asked for at ${(d[0] / d[1] / (tanV * 16 / 9)).toFixed(3)} of the half-frame across`);
}));

test('TWO-HANDS AUDIT the arm, THE PAIR\'S DRAW (finding 7): the second arm is composed from the first frame of the right hand\'s draw to the last of its sheathe - the blades come and go at the right\'s attach and detach keys', () => seeded(async () => {
  const arm = await drawnArm();
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 40; i++) arm.update(1 / 60);
  for (const [sheathe, section] of [[true, 'Unequipping'], [false, 'Equipping']]) {
    arm.setSheathed(sheathe);
    let frames = 0, bladeless = 0;
    for (let i = 0; i < 90; i++) {
      arm.update(1 / 60);
      const s = arm.status(), h = arm.handsState();
      if (s.upperName !== section) continue;
      frames++;
      assert.equal(h.pair, true, `${section}, frame ${i}: the pair is in the hands`);
      assert.equal(h.composed, 'dual', `${section}, frame ${i}: the left arm the right's mirror`);
      assert.deepEqual(h.offHidden, [!s.weaponShown], `${section}, frame ${i}: the left blade with the right`);
      if (!s.weaponShown) bladeless++;
    }
    assert.ok(frames > 5 && bladeless > 2, `${section}: ${frames} frames, ${bladeless} of them before the attach or after the detach`);
    for (let i = 0; i < 60; i++) arm.update(1 / 60);
  }
  arm.setSheathed(true);
  for (let i = 0; i < 90; i++) arm.update(1 / 60);
  assert.equal(arm.handsState().pair, false, 'sheathed: no pair in the hands');
  assert.equal(arm.handsState().composed, 'none');
}));

test('TWO-HANDS AUDIT the arm, A VIEW SWITCH CARRIES NOTHING (finding 6): back in first person after a spell in third, the arms stand in their composition on the first frame - not eased in from where they stood when the player left', () => seeded(async () => {
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0 }));
  assert.ok((await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: bodyDeps() })).ok);
  arm.setSheathed(false);
  for (let i = 0; i < 60; i++) arm.update(0.05);
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 40; i++) arm.update(0.05);
  arm.attack('StrikeDown', { hand: 'L' });
  for (let i = 0; i < 6; i++) arm.update(0.05);
  const leaving = arm.handsState().wrists.L.slice();
  assert.ok(arm.setViewMode('third'));
  arm.setSheathed(true);
  for (let i = 0; i < 120; i++) arm.update(0.05);
  assert.ok(arm.setViewMode('first'));
  arm.update(0.05);
  const first = arm.handsState().wrists.L.slice();
  for (let i = 0; i < 60; i++) arm.update(0.05);
  const settled = arm.handsState().wrists.L.slice();
  assert.ok(travel(leaving, settled) > 0.1, 'the arm left mid-blow, far from where it settles');
  assert.ok(travel(first, settled) < 1e-3, `the first frame back is its own pose (${travel(first, settled).toFixed(4)} off; the stale carry put it 0.317 off)`);
}));

test('TWO-HANDS AUDIT the arm, THE PORTRAIT\'S PAIR (finding 8): the inventory\'s figure shows the left hand\'s weapon while a pair is carried - drawn or not, from either view - with both arms up, the left the right\'s mirror; one weapon carried, none', () => seeded(async () => {
  const flags = (arm) => Object.fromEntries(arm.thirdMesh().ranges.filter((r) => r.slot === 'weapon' || r.slot === 'offweapon').map((r) => [r.slot, r.hidden ? 'hidden' : 'shown']));
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  for (const view of ['first', 'third']) {
    const arm = createFpArm();
    arm.attach(renderer, () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0 }));
    assert.ok((await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: bodyDeps() })).ok);
    arm.setSheathed(false);
    for (let i = 0; i < 40; i++) arm.update(0.05);
    arm.setHands({ mode: 'dual', lead: 'R' });
    await arm.setOffWeapon(LONGSWORD);
    if (view === 'third') arm.setViewMode('third');
    for (let i = 0; i < 20; i++) arm.update(0.05);
    arm.setSheathed(true);
    for (let i = 0; i < 60; i++) arm.update(0.05);
    assert.ok(arm.figure({ yaw: 0, height: 128 }));
    assert.deepEqual(flags(arm), { weapon: 'shown', offweapon: 'shown' }, `opened from ${view} person, the pair sheathed`);
    const t = arm.built().third.arm, sk = t.skeleton;
    const L = t.mats.get(sk.byName.get('left hand')).t, R = t.mats.get(sk.byName.get('right hand')).t;
    assert.ok(Math.abs(L[0] + R[0]) < 1e-3 && Math.abs(L[1] - R[1]) < 1e-3 && Math.abs(L[2] - R[2]) < 1e-3, `both arms up, mirrored: ${L} / ${R}`);
    // the fixture's drawn idle is its own mirror, so the pose above cannot tell: the body says what the mirror wrote
    const leftArm = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices).arms.L;
    assert.deepEqual([...(t.mirrored ?? [])].sort(), [...leftArm].sort(), 'posed with the pair\'s composition: the left arm the right\'s mirror');
    arm.setHands({ mode: 'single' });
    assert.ok(arm.figure({ yaw: 0, height: 128 }));
    assert.equal(flags(arm).offweapon, 'hidden', 'one weapon carried: no second');
    assert.equal(arm.built().third.arm.mirrored, null, 'and no mirror');
  }
}));

test('TWO-HANDS AUDIT the arm, A FAILED LEFT-HAND SWAP IS ASKED AGAIN (finding 9): a read that failed refuses that weapon until another is asked, as setWeapon\'s law has it - not for the life of the rig', () => seeded(async () => {
  const d = deps();
  const arm = await drawnArm({ d });
  arm.setHands({ mode: 'dual', lead: 'R' });
  const real = d.loadMorrowindArchives;
  let fail = true;
  d.loadMorrowindArchives = async () => { if (fail) { fail = false; throw new Error('a transient read error'); } return real(); };
  const DAGGER = { templateIndex: 113 };
  assert.notEqual(fpWeaponKey(DAGGER, false), fpWeaponKey(LONGSWORD, false));
  assert.equal(await arm.setOffWeapon(LONGSWORD), false, 'the read fails');
  assert.equal(arm.handsState().offPieces, 0);
  assert.equal(await arm.setOffWeapon(LONGSWORD), false, 'the same weapon is not asked again at once (the frame door)');
  assert.equal(await arm.setOffWeapon(DAGGER), true, 'another weapon asks');
  assert.equal(await arm.setOffWeapon(LONGSWORD), true, 'and the one that failed asks again after it');
  assert.equal(arm.handsState().offKey, fpWeaponKey(LONGSWORD, false));
  assert.equal(arm.handsState().offPieces, 1);
}));

// ---- TWO-HANDS AUDIT 2 (lane 3, the Morrowind lane) ------------------------------------------------------------------

test('TWO-HANDS AUDIT 2 the law, THE STRIDE FOLLOWS THE BOB AND NEVER JUMPS (L3 M3, L2 F5 - handsLaw.js runPhaseFollow, both lanes\' one law): a frame\'s step is the bob\'s own while it keeps the stride\'s tempo within CATCH - the phase stands ON the bob, across the wrap too; a jump ahead is caught up at (1 + CATCH) of the stride, one behind at (1 - CATCH), the shorter way round and never backward; nothing of the pump drawn, the bob\'s phase at once; no bob, the speed\'s own walk; a still stride, a still phase', () => {
  const dt = 1 / 60, v = 7, walk = v * dt * Math.PI / RUN_STEP_M, lo = walk * (1 - RUN_PUMP.CATCH), hi = walk * (1 + RUN_PUMP.CATCH);
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  assert.equal(runPhaseFollow(1, 1 + 0.99 * walk, v, dt), 1 + 0.99 * walk, 'keeping step: the bob\'s own phase, to the last digit');
  assert.equal(runPhaseFollow(2 * Math.PI - 0.01, 0.99 * walk - 0.01, v, dt), 0.99 * walk - 0.01, 'across the wrap: the bob\'s own');
  assert.ok(near(runPhaseFollow(1, 3, v, dt), 1 + hi), 'a jump ahead: the stride\'s tempo and CATCH more, no faster');
  assert.ok(near(runPhaseFollow(1, 1 - 1.5, v, dt), 1 + lo), 'a jump behind: slowed by CATCH - never backward');
  assert.ok(near(runPhaseFollow(1, 1 + 3.3, v, dt), 1 + lo), 'the shorter way round: 3.3 ahead is 2.98 behind');
  assert.ok(near(runPhaseFollow(1, 1 + 3.0, v, dt), 1 + hi), '...and 3.0 ahead is ahead');
  assert.equal(runPhaseFollow(1, 4, v, dt, true), 4, 'nothing drawn: the bob\'s phase at once');
  assert.equal(runPhaseFollow(1, null, v, dt), runPhaseStep(1, v, dt), 'no bob (head bobbing off): the speed\'s own walk');
  assert.equal(runPhaseFollow(1, 3, 0, dt), 1, 'a still stride: a still phase');
  assert.equal(runPhaseFollow(1, 3, v, 0), 1, 'no time: no step');
  // the real HeadBobber's stutter at three frame rates: one frame stopped mid-run, the timer reset to PI on the resume
  for (const fps of [30, 60, 144]) {
    const d = 1 / fps, bobber = new HeadBobber(), bag = {}, look = { pitch: 0, yaw: 0 }, w = v * d * Math.PI / RUN_STEP_M;
    let phase = null, worst = 0, off = 0;
    for (let f = 0; f < 5 * fps; f++) {
      const moving = f !== Math.round(2.3 * fps);
      bobber.update(d, look, { enabled: true, running: true, grounded: true, velocity: moving ? v : 0, moving, out: bag });
      const next = runPhaseFollow(phase, runPhaseOfBob(bag.bobTimer), moving ? v : 0, d, phase == null);
      if (phase != null && moving) worst = Math.max(worst, Math.abs(next - phase - 2 * Math.PI * Math.round((next - phase) / (2 * Math.PI))) / w);
      phase = next;
      off = phase - runPhaseOfBob(bag.bobTimer);
    }
    assert.ok(worst <= 1 + RUN_PUMP.CATCH + 1e-9, `${fps} fps: no frame steps more than (1 + CATCH) strides (${worst.toFixed(3)})`);
    assert.equal(off, 0, `${fps} fps: back ON the bob within the run`);
  }
});

test('TWO-HANDS AUDIT 2 mirror, THE GUARD IS CARRIED OFF THE ARM: the dip is laid INTO the composition, so the carry starts from the arm as drawn - a request that stops asking it under a new key eases the arm up from where it was drawn, never in a frame; and a change of key with nothing of the mirror\'s on the arms reads no plan', () => {
  const sk = retail();
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const up = plan.uppers.L;
  const st = {};
  const frame = (key, dip) => { const p = new Map(); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { carry: { key, dt: 1 / 60, tau: 0.06, state: st }, dip }); return p.get(up) ?? sk.nodes.get(up).rest; };
  const turn = (a, b) => { const r = mat33Mul(a.rotation, Float32Array.from([b.rotation[0], b.rotation[3], b.rotation[6], b.rotation[1], b.rotation[4], b.rotation[7], b.rotation[2], b.rotation[5], b.rotation[8]])); return Math.acos(Math.min(1, (r[0] + r[4] + r[8] - 1) / 2)); };
  const rest = sk.nodes.get(up).rest;
  frame('dual', { L: 0.3, R: 0 });
  const dipped = frame('dual', { L: 0.3, R: 0 });
  assert.ok(Math.abs(turn(dipped, rest) - 0.3) < 1e-4, 'the dip turns the upper arm 0.3');
  const taken = [];
  for (let i = 0; i < 30; i++) taken.push(turn(frame('taken', null), rest));
  assert.ok(taken[0] > 0.29, `the first frame under the new key still stands where it was drawn (${taken[0].toFixed(4)})`);
  for (let i = 1; i < 10; i++) assert.ok(taken[i] < taken[i - 1], `and eases up (${i}: ${taken[i].toFixed(4)})`);
  assert.ok(taken[29] < 1e-3, 'up');
  // nothing drawn, nothing asked: a new key reads no plan (a creature's death, a single hand's sheet - no bone walked)
  const fresh = retail();
  let reads = 0;
  const counted = (s2, pose, root) => { reads++; return skeletonSpaceMatrices(s2, pose, root); };
  const st2 = {};
  for (const key of ['none', 'taken', 'none']) applyMirrorRig(fresh, new Map(), GRAPH_ROOT, counted, { carry: { key, dt: 1 / 60, tau: 0.06, state: st2 }, dip: null });
  assert.equal(reads, 0, 'no rest pass, no plan');
});

test('TWO-HANDS AUDIT 2 the arm, THE HANDS TAKEN DROP THE GUARD (L3 M2): a sheet raised mid-blow takes the hands from the pair - no pair in them, no composition (`taken`), the guard\'s weight eased away and laid on no arm under it (it lowered the sheet\'s own hand for the blow\'s whole length), the dip carried off the arm; the stone and a spell alike; and a pair dissolved mid-guard then a sheet: carried off, never dropped in a frame', () => seeded(async () => {
  const climb = { feet: [0, 0, 0], yaw: 0, track: null, floorGap: Infinity, mode: 'hang', classic: false, normal: [0, 0, -1], lipY: 1.9, move: null, grip: 1, flight: null };
  let onWall = false;
  const pairArm = async () => {
    const arm = await drawnArm({ camera: () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0, climb: onWall ? climb : null }) });
    arm.setHands({ mode: 'dual', lead: 'R' });
    await arm.setOffWeapon(LONGSWORD);
    for (let i = 0; i < 40; i++) arm.update(1 / 60);
    assert.ok(arm.attack('StrikeDown', { hand: 'R' }));
    for (let i = 0; i < 8; i++) arm.update(1 / 60);
    assert.ok(arm.handsState().guard.L > 0.8, 'the left lowered under the right\'s blow');
    return arm;
  };
  const elev = (arm) => { const b = arm.built(); const eye = b.arm.mats.get(b.cameraRef).t; const w = arm.handsState().wrists.L; return Math.atan2(w[2] - eye[2], w[1] - eye[1]); };
  for (const [what, take] of [['a sheet', (arm) => assert.ok(arm.holdPaper())], ['a spell', (arm) => arm.readySpell(true)], ['the stone', () => { onWall = true; }]]) {
    onWall = false;
    const arm = await pairArm();
    take(arm);
    const g = [];
    for (let i = 0; i < 40; i++) { arm.update(1 / 60); g.push({ ...arm.handsState(), wrote: arm.built().arm.mirrored }); }
    const at = g[29];
    if (what !== 'the stone') {   // the stone takes the hands from the climb's weight past half, a few frames in
      assert.equal(g[0].pair, false, `${what}: no pair in the hands`);
      assert.equal(g[0].composed, 'taken', `${what}: no composition`);
    }
    assert.ok(at.guard.L > 0 && at.guard.L < 0.1, `${what}: the guard eases away (${at.guard.L.toFixed(4)}; it held 1 for the blow under a sheet)`);
    assert.equal(at.wrote, null, `${what}: and is laid on no arm while it does - the mirror writes nothing once its carry is done`);
  }
  // a pair dissolved mid-guard (a quickslot to one hand) - its guard still easing - and then a sheet: carried, not dropped
  onWall = false;
  const arm = await pairArm();
  arm.setHands({ mode: 'single' });
  for (let i = 0; i < 2; i++) arm.update(1 / 60);
  assert.ok(arm.handsState().guard.L > 0.5, 'the guard still eases away on the single hand');
  const before = elev(arm);
  assert.ok(arm.holdPaper());
  arm.update(1 / 60);
  const first = elev(arm) - before;
  arm.update(1 / 60);
  assert.ok(Math.abs(first) < 0.005, `the sheet's first frame: the left hand where it was drawn (${first.toFixed(4)} rad; dropped whole it jumped by the guard)`);
}));

test('TWO-HANDS AUDIT 2 the arm, A REBUILD KEEPS THE LEFT BLADE (L3 M6): the rig records the left hand\'s weapon it binds, and its own rebuild (an equip\'s follow, setWorn) binds it in the build on both rigs - drawn the first frame the pair is, the next frame\'s swap the fast path, however long the archives take to reopen', () => seeded(async () => {
  const d = bodyDeps();
  const real = d.loadMorrowindArchives;
  let slow = false;
  d.loadMorrowindArchives = async () => { if (slow) await new Promise((r) => setTimeout(r, 300)); return real(); };
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0 }));
  assert.ok((await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: d })).ok);
  arm.setSheathed(false);
  for (let i = 0; i < 80; i++) arm.update(0.05);
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 10; i++) arm.update(1 / 60);
  assert.equal(arm.handsState().offPieces, 1);
  slow = true;
  const res = await arm.setWorn([{ kind: 'armor', templateIndex: 102, material: 0 }]);
  assert.ok(res?.ok, 'rebuilt');
  const h = arm.handsState();
  assert.equal(h.offPieces, 1, 'the left blade bound in the build - not left to the next frame\'s swap');
  assert.equal(h.offKey, fpWeaponKey(LONGSWORD, false));
  assert.equal(h.offWeapon?.bone, 'Weapon Bone Left');
  assert.equal(arm.status().third.offWeapon?.bone, 'Weapon Bone Left', 'and on the body');
  assert.equal(arm.setOffWeapon(LONGSWORD), false, 'the next frame\'s swap: the fast path, no archive reopened');
  arm.setSheathed(false);
  let gone = 0, drawn = 0;
  for (let i = 0; i < 120 && drawn < 5; i++) { arm.update(1 / 60); if (arm.status().weaponShown) { if (arm.handsState().offHidden[0] === false) drawn++; else gone++; } }
  assert.equal(gone, 0, 'the right blade never drawn alone');
  assert.ok(drawn > 0);
}));

test('TWO-HANDS AUDIT 2 the arm, A BLADE\'S EFFECT AND GLOW GO WITH THE BLADE: a sheet in the hands hides both blades - and the particle effects they carry with them; on the stone the blades are away in both views, and neither wears a glow (the body\'s picture was padded for an outline it never drew)', () => seeded(async () => {
  const climb = { feet: [0, 0, 0], yaw: 0, track: null, floorGap: Infinity, mode: 'hang', classic: false, normal: [0, 0, -1], lipY: 1.9, move: null, grip: 1, flight: null };
  let onWall = false, mesh = null;
  const gpus = [];
  const renderer = { gl: null, createCharacterMesh: () => (mesh = { vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }),
    createParticleEffect: () => { const g = {}; gpus.push(g); return g; }, updateParticleEffect: () => {} };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pitch: 0, pos: [0, 1.6, 0], yaw: 0, climb: onWall ? climb : null }));
  assert.ok((await arm.build({ race: 'fprace', weapon: LONGSWORD, deps: bodyDeps() })).ok);
  arm.setSheathed(false);
  for (let i = 0; i < 80; i++) arm.update(0.05);
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  // an effect on each blade, as a weapon's NIF carries one (MAC-Q: placed and hidden with its part)
  const a = arm.built().arm, sk = a.skeleton;
  const fx = (slot, bone) => ({ slot, attachRef: sk.byName.get(bone), mirrored: slot === 'offweapon', boneOffset: null, pre: null, hang: null, material: null,
    desc: { localSpace: false, world: { rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: [0, 0, 0], scale: 1 } }, sim: { quota: 1, update() {}, quads: () => [] } });
  a.effects = [...(a.effects ?? []), fx('weapon', 'weapon bone'), fx('offweapon', 'weapon bone left')];
  const n = a.effects.length;
  for (let i = 0; i < 4; i++) arm.update(1 / 60);
  const hidden = () => mesh.effects.slice(n - 2, n).map((g) => g.hidden);
  assert.deepEqual(hidden(), [false, false], 'the pair drawn: both blades\' effects drawn');
  assert.ok(arm.holdPaper());
  arm.update(1 / 60);
  assert.deepEqual(mesh.ranges.filter((r) => r.slot === 'weapon' || r.slot === 'offweapon').map((r) => r.hidden), [true, true], 'a sheet in the hands: both blades away');
  assert.deepEqual(hidden(), [true, true], '...and their effects with them');
  arm.releasePaper();
  // the stone: the glows asked of both blades, then onto the wall
  const frost = { look: 'frost', code: 2, level: 1, ramp: [0.4, 0.7, 1] };
  arm.setWeaponGlow(frost, LONGSWORD);
  arm.setOffWeaponGlow(frost, LONGSWORD);
  for (let i = 0; i < 20; i++) arm.update(1 / 60);
  assert.ok(arm.weaponGlow() && arm.offWeaponGlow(), 'drawn, both glow');
  onWall = true;
  for (let i = 0; i < 60; i++) arm.update(1 / 60);
  assert.equal(arm.offWeaponGlow(), null, 'on the stone the left blade wears no glow');
  assert.equal(arm.weaponGlow(), null, 'nor the right');
  arm.setViewMode('third');
  for (let i = 0; i < 4; i++) arm.update(1 / 60);
  assert.deepEqual(arm.thirdMesh().ranges.filter((r) => r.slot === 'weapon' || r.slot === 'offweapon').map((r) => r.hidden), [true, true], 'the body\'s blades away on the stone - the glow the picture is padded for is theirs');
  assert.equal(arm.offWeaponGlow(), null);
}));

test('TWO-HANDS AUDIT 2 the rig under a READY Morrowind arm (L5): a light that is not a lit torch takes no hand - the arm holds a torch alone, never a lantern ("a torch alone: the arm holds no lantern") - so both fists stand beside it, a torch takes one; and H with both fists up moves the lead and says so ("it now moves between the fists too")', async () => {
  const { createWeaponRig } = await import('../../src/combat/weapon/weaponRig.js');
  const { fpArm } = await import('../../src/combat/fpArm.js');
  const { EQUIP_SLOTS } = await import('../../src/systems/equip.js');
  const { HANDS_MODE } = await import('../../src/combat/twoHands/handsLaw.js');
  const { setModSetting, _resetModSettings } = await import('../../src/systems/modSettings.js');
  const saved = fpArm.ready;
  fpArm.ready = () => true;
  try {
    setModSetting('handheld-torches', 'Handling.LanternsAtWaist', false);   // a lantern held in the hand, not hung
    const rig = (light) => {
      const entity = { items: [], lightSource: light, stats: { speed: 50, strength: 50, agility: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: null, [EQUIP_SLOTS.LeftHand]: null } } };
      const said = [];
      const r = createWeaponRig({ renderer: null, canvas: null, entity, audio: { playOneShot() {} }, say: (s) => said.push(s) });
      r.refreshWorn();
      return { r, said };
    };
    assert.equal(rig({ templateIndex: 248 }).r.playerWeapon.handsMode, HANDS_MODE.Fists, 'a lantern in hand: the arm draws none - both fists');
    assert.equal(rig({ templateIndex: 247 }).r.playerWeapon.handsMode, HANDS_MODE.Single, 'a lit torch: the arm holds it - one fist beside it');
    const { r, said } = rig(null);
    assert.equal(r.playerWeapon.handsMode, HANDS_MODE.Fists);
    const lead = r.playerWeapon.leadHand;
    assert.equal(r.switchHand(), true, 'H with both fists up: the lead moves');
    assert.notEqual(r.playerWeapon.leadHand, lead);
    assert.deepEqual(said, [r.playerWeapon.leadHand === 'L' ? 'Leading with the left hand.' : 'Leading with the right hand.'], 'and says so');
  } finally { fpArm.ready = saved; _resetModSettings(); }
});

test('TWO-HANDS the arm, by source: the mirror is posed over the clip ahead of the neck and the climb (the assembly\'s own hook), both rigs ask it, the run is solved under the climb\'s request in the same slot (TWO-HANDS AUDIT: blended, never chosen), and the rig hands the arm the hands\' mode, the left hand\'s weapon and the blow\'s hand every frame', () => {
  const fp = rd('src/formats/morrowind/mwFirstPerson.js');
  assert.match(fp, /const pose = fns\.poseSkeleton\(skeleton, tracks, sampleTrack, time, \{ accumRoot \}\);\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.mirrored = mirror \? applyMirrorRig\(skeleton, pose, GRAPH_ROOT, fns\.skelMats, mirrorWithPoses\(mirror, fns, skeleton, accumRoot\)\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*applyFirstPersonNeck\(/);
  // PIN MOVED (BODY-MOTION, 2026-10-18): the third-person body's own motion (`motion`, characters/bodyMotion/) is solved
  // between the neck and the run - over the mirror, under the run and the climb
  assert.match(fp, /applyFirstPersonNeck\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.motionFit = motion \? motion\(skeleton, pose, GRAPH_ROOT, fns\.skelMats\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.runFit = run \? applyClimbRig\(skeleton, pose, GRAPH_ROOT, fns\.skelMats, run\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.climbFit = climb \? applyClimbRig/, 'the run under the climb, after the neck');
  const arm = rd('src/combat/fpArm.js');
  assert.equal((arm.match(/mirror: mirrorFor\('(first|third)', /g) ?? []).length, 2, 'both views');
  // PIN MOVED (TWO-HANDS AUDIT, finding 4): the slot took the climb OR the run (`climb: held ? null : (firstClimb(climbWorld,
  // cam) ?? firstRun(cam)),`) and dropped the run whole the frame a climb began; now both, the run under the climb
  assert.match(arm, /const fClimb = held \? null : firstClimb\(climbWorld, cam\);/);
  assert.match(arm, /climb: fClimb,\n(?:\s*\/\/[^\n]*\n)*\s*run: firstRun\(cam\),/);
  assert.match(arm, /else if \(r\.slot === 'offweapon'\) r\.hidden = !offShown\(built\);/);
  assert.match(arm, /else if \(r\.slot === 'offweapon'\) r\.hidden = !offShown\(t\) \|\| climbHands;/);
  assert.match(arm, /if \(\(held \|\| climbHands\) && r\.slot === 'offweapon'\) r\.hidden = true;/);
  const rig = rd('src/combat/weapon/weaponRig.js');
  assert.match(rig, /const armItem = pairUp\(\) \? playerWeapon\.handItem\('R'\) : playerWeapon\.weapon;/);
  assert.match(rig, /fpArm\.setHands\(\{ mode: pairUp\(\) \? playerWeapon\.handsMode : HANDS_MODE\.Single, lead: playerWeapon\.leadHand \}\);/);
  assert.match(rig, /const offItem = pairUp\(\) && playerWeapon\.handsMode === HANDS_MODE\.Dual \? playerWeapon\.handItem\('L'\) : null;\n\s*fpArm\.setOffWeapon\(offItem\);/);   // the left item named once - its blade and its glow (WEAPON-GLOW1)
  assert.match(rig, /hand: pairUp\(\) \? playerWeapon\.strike\?\.hand \?\? null : null \}\);/);
  assert.match(rig, /fpArm\.setRunHands\?\.\(wanted, \{ speed, phase: Number\.isFinite\(mv\.bobTimer\) \? runPhaseOfBob\(mv\.bobTimer\) : null \}\);/);   // PIN MOVED (TWO-HANDS AUDIT): the arms on the head bob's clock
  assert.match(rig, /const armsRun = fpArm\.active\(\) && !!fpArm\.runPosed\?\.\(\);/);
});

// ---- TWO-HANDS FIELD (2026-10-16, Mac after the merge) ------------------------------------------------------------

test('TWO-HANDS FIELD the law, A STRIDE\'S OTHER HALF (strideOppositeTime): half the group\'s loop window on, read off its own loop keys inside the block the state plays - wrapping inside the window; the group\'s start to stop where it has no loop keys; another block\'s keys never; nothing without a window', () => {
  const st = { group: 'walkforward', startTime: 1.0, stopTime: 2.4, loopStartTime: 1.0, loopStopTime: Infinity };
  const keys = [{ text: 'walkforward: start', time: 1.0 }, { text: 'walkforward: loop start', time: 1.2 }, { text: 'walkforward: loop stop', time: 2.2 }, { text: 'walkforward: stop', time: 2.4 },
    { text: 'walkforward: loop start', time: 5.0 }, { text: 'walkforward: loop stop', time: 6.0 }];
  assert.ok(Math.abs(strideOppositeTime(st, 1.3, keys) - 1.8) < 1e-9, 'half the 1.2-2.2 loop on');
  assert.ok(Math.abs(strideOppositeTime(st, 2.1, keys) - 1.6) < 1e-9, 'wrapped inside the loop');
  assert.ok(Math.abs(strideOppositeTime(st, 1.1, keys) - 1.6) < 1e-9, 'the intro maps into the loop too - never past it');
  assert.ok(Math.abs(strideOppositeTime({ ...st, loopStopTime: 2.2 }, 1.3, keys) - strideOppositeTime(st, 1.3, keys)) < 1e-9, 'the state\'s own loop fields move nothing: the keys say the window from the first frame (a first loop read the whole group - the arm jumped as the loop stop was crossed)');
  assert.ok(Math.abs(strideOppositeTime(st, 1.3) - 2.0) < 1e-9, 'no keys: the group\'s start to stop');
  assert.ok(Math.abs(strideOppositeTime({ ...st, startTime: 4.8, stopTime: 6.2 }, 5.2, keys) - 5.7) < 1e-9, 'the block played reads its own keys');
  assert.equal(strideOppositeTime(null, 1), null);
  assert.equal(strideOppositeTime({ ...st, stopTime: 1.0 }, 1.0), null, 'no window');
});

/** A female actor's two sources on both rigs (MW-D29's retail arrangement): the weapon groups in the base source, the walk
 *  in the skeleton's own - its WalkForward1h renamed away, so the drawn walk falls back to WalkForward, whose clip swings
 *  the right arm (the fixture's 1h walk holds it still). */
async function walkingPair() {
  const strip = (b) => { const t = Buffer.from(b); let i; while ((i = t.indexOf('WalkForward1h')) >= 0) t.write('WalkForwardZz', i); return new Uint8Array(t); };
  const move = strip(f('armfpmove.kf'));
  const files = new Map([...FILES(), [fpSkeletonPath({ female: true }), f('armfp.nif')], ['meshes/base_anim_female.1st.kf', move],
    [tpSkeletonPath({ female: true }), f('armfp.nif')], ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpweapon.kf')], ['meshes/base_anim_female.kf', move]]);
  const all = cat(f('armfp.esm'), bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8), WEAP);
  const d = { loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }], storedMorrowindNames: async () => ['armfp.esm'], loadMorrowindFile: async () => all };
  const cam = { pos: [0, 1.6, 0], yaw: 0, pitch: 0, sneaking: false, move: { forward: 0, strafe: 0, running: false, speed: 0 } };
  const renderer = { gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1, renderCharacterSprite: () => ({ tex: {} }), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {}, renderCharacterSpriteImage: () => ({ img: 1 }), createParticleEffect: () => ({}) };
  const arm = createFpArm();
  arm.attach(renderer, () => cam);
  const res = await arm.build({ race: 'fprace', female: true, weapon: LONGSWORD, deps: d });
  assert.ok(res.ok && res.third?.ok && res.sources.length === 2, `${res.stage} ${res.error} / ${res.third?.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80; i++) arm.update(0.05);
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  return { arm, cam };
}

test('TWO-HANDS FIELD the arm, A PAIR ON THE MOVE SWINGS ITS ARMS AGAINST EACH OTHER (Mac: "Both arms swing the same direction"): walking in third person the left arm is the right\'s mirror HALF A STRIDE ON - the left wrist stands where the right\'s mirror stands half a loop later, so as the right swings one way the left swings the other; the frame\'s own right arm mirrored had swung both together. Standing, the pair\'s rest again', () => seeded(async () => {
  const { arm, cam } = await walkingPair();
  assert.ok(arm.setViewMode('third'));
  for (let i = 0; i < 10; i++) arm.update(0.05);
  assert.equal(arm.handsState().composed, 'dual', 'standing: the pair at rest');
  cam.move.forward = 1; cam.move.speed = 2.0 / MW_UNITS_PER_METER;
  const t = arm.built().third.arm, plan = mirrorPlan(t.skeleton, GRAPH_ROOT, t.fns.skelMats);
  const R = [], L = [];
  for (let i = 0; i < 60; i++) {
    arm.update(0.05);
    assert.equal(arm.status().movementGroup, 'walkforward');
    assert.equal(arm.handsState().composed, 'dual:stride', `frame ${i}: on the move, the stride's other half`);
    R.push(t.mats.get(plan.hands.R).t.slice()); L.push(t.mats.get(plan.hands.L).t.slice());
  }
  // the swing measured: each frame's move of the left wrist against the right's mirrored (x negated about the body's
  // middle, x0 = 0 on the fixture) - the frame's own mirror is +1 exactly; the stride's other half runs against it
  const settled = 15;
  let along = 0, size = 0;
  for (let i = settled; i + 1 < R.length; i++) {
    const dR = [-(R[i + 1][0] - R[i][0]), R[i + 1][1] - R[i][1]], dL = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
    along += dL[0] * dR[0] + dL[1] * dR[1]; size += dR[0] * dR[0] + dR[1] * dR[1];
  }
  assert.ok(size > 1e-3, `the right arm swings (${size})`);
  assert.ok(along / size < -0.5, `the left swings against the right (${(along / size).toFixed(3)}; the frame's own mirror reads +1)`);
  // and exactly half a loop on: a lag k at which the left is the right's mirror, frame for frame
  const off = (k) => { let w = 0; for (let i = settled; i + k < R.length; i++) w = Math.max(w, Math.abs(L[i][0] + R[i + k][0]), Math.abs(L[i][1] - R[i + k][1])); return w; };
  const lags = Array.from({ length: 30 }, (_, k) => off(k));
  const k = lags.indexOf(Math.min(...lags));
  assert.ok(lags[k] < 0.01 && k > 0, `the left is the right's mirror ${k} frames on (${lags[k].toFixed(4)}; now: ${lags[0].toFixed(3)})`);
  const loop = (() => { for (let j = 1; j < 40; j++) { let w = 0; for (let i = settled; i + j < R.length; i++) w = Math.max(w, Math.abs(R[i + j][0] - R[i][0]), Math.abs(R[i + j][1] - R[i][1])); if (w < 1e-3) return j; } return -1; })();
  assert.equal(k * 2, loop, `half the right arm's own loop (${loop} frames)`);
  // a clip over the walk poses the body (the draw here, a recoil, a blow): the stride is not the arms' - the pair's own
  // composition until it ends
  arm.setSheathed(true);
  for (let i = 0; i < 60; i++) arm.update(0.05);
  arm.setSheathed(false);
  let drawing = 0;
  for (let i = 0; i < 60; i++) {
    arm.update(0.05);
    const st = arm.status();
    if (st.upperName === 'Equipping' && arm.handsState().pair) { drawing++; assert.equal(arm.handsState().composed, 'dual', `frame ${i}: the draw poses the arms, not the walk`); }
  }
  assert.ok(drawing > 0, 'the draw was seen on the walk');
  assert.equal(arm.handsState().composed, 'dual:stride', 'drawn: the stride again');
  cam.move.forward = 0; cam.move.speed = 0;
  for (let i = 0; i < 10; i++) arm.update(0.05);
  assert.equal(arm.handsState().composed, 'dual', 'stopped: the pair at rest again');
}));

test('TWO-HANDS FIELD the arm, THE FIRST-PERSON PAIR IS MIRRORED ACROSS THE EYE (Mac: "No left arm"): with the body posed off the eye (the camera node moved across - Morrowind\'s first-person clips pose the body to put the weapon hand in view, not about the eye), the left wrist stands where the right\'s mirror through the EYE stands, so it is in the picture wherever the right is; the body in third person still hangs its left arm on its own chest', () => seeded(async () => {
  const arm = await drawnArm({ d: bodyDeps() });
  arm.setHands({ mode: 'dual', lead: 'R' });
  await arm.setOffWeapon(LONGSWORD);
  for (let i = 0; i < 6; i++) arm.update(0.05);
  let h = arm.handsState();
  assert.ok(Math.abs(h.wrists.L[0] + h.wrists.R[0]) < 0.02, `the eye on the middle: the mirror as it stood (${h.wrists.L} / ${h.wrists.R})`);
  const b = arm.built();
  const cam = b.arm.skeleton.nodes.get(b.cameraRef), neck = b.arm.skeleton.nodes.get(cam.parent);
  assert.equal(cam?.name, 'Camera');
  // the body off the eye: the chest (the arms' parent, the eye's too) moved one way, the eye on it further
  neck.rest.translation[0] += 0.2;
  cam.rest.translation[0] = 0.3;
  for (let i = 0; i < 6; i++) arm.update(0.05);
  h = arm.handsState();
  const eyeX = b.arm.mats.get(b.cameraRef).t[0];
  assert.ok(Math.abs(eyeX - 0.5) < 1e-6, `the eye moved across, on its chest (${eyeX})`);
  assert.ok(Math.abs((h.wrists.L[0] - eyeX) + (h.wrists.R[0] - eyeX)) < 0.02, `the left wrist the right's mirror ACROSS THE EYE (${h.wrists.L} / ${h.wrists.R}); hung on the chest it stood at ${(0.4 - h.wrists.R[0]).toFixed(3)}`);
  assert.ok(Math.abs(h.wrists.L[1] - h.wrists.R[1]) < 0.02 && Math.abs(h.wrists.L[2] - h.wrists.R[2]) < 0.02, 'as far ahead and as high');
  assert.equal(h.offHidden[0], false, 'the left blade drawn with it');
  // the body: a shoulder stays on its chest - mirrored about the body's own middle, wherever its camera node stands
  assert.ok(arm.setViewMode('third'));
  const t = arm.built().third.arm, tcam = t.skeleton.nodes.get(t.skeleton.byName.get('camera'));
  if (tcam) tcam.rest.translation[0] = 0.3;
  for (let i = 0; i < 6; i++) arm.update(0.05);
  const plan = mirrorPlan(t.skeleton, GRAPH_ROOT, t.fns.skelMats);
  const tl = t.mats.get(plan.hands.L).t, tr = t.mats.get(plan.hands.R).t;
  assert.ok(Math.abs(tl[0] + tr[0]) < 0.02, `third person: the body's own mirror (${tl} / ${tr})`);
}));

// ---- TWO-HANDS MIRROR-BIND (2026-10-17, Mac: "adjust the positioning of the morrowind left hand duel wield model on first
// person, so its properly mirrored. Third person looks good") --------------------------------------------------------

/** The MW-STEEL4 stand-in for a first-person rig (test/formats/morrowind/mwsteel4.test.js): retail's bones, a camera, and
 *  the arms' rests turned off each other's mirror as a clip's first frame turns them - `shadow` its Tri Shadow or none. */
const fpStandIn = (shadow) => {
  const turned = (axis, d) => Array.from(rotAxisAngle(axis, (d * Math.PI) / 180));
  return retailSkeleton({ extra: ['Camera'], shadow, rest: { 'Bip01 R UpperArm': turned([0, 1, 0], 70), 'Bip01 R Forearm': turned([0, 0, 1], 85), 'Bip01 L UpperArm': turned([1, 0, 0], -50) } });
};
/** A pair on `skeletonBytes`: the port's steel gauntlets (a left and a right piece, each skinned to its own hand), a
 *  blade in each hand (the left on the made Weapon Bone Left) and a rigid piece on each hand's attach node - the right
 *  arm bent, the left mirrored across the picture as fpArm's mirrorFor asks it. Answers the assembly and the mirror
 *  through the eye. */
async function pairAcrossThePicture(skeletonBytes) {
  const worn = composeWornArmor({ pieces: [{ templateIndex: 103, material: 0x201 }], armors: [], bodyPool: [] });
  const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
  const blade = onDisk('src/assets/mw/meshes/thunderlock.nif');
  const parts = [...worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`) })),
    { slot: 'weapon', bones: ['Weapon Bone'], bytes: blade }, { slot: 'offweapon', bones: [OFF_WEAPON_BONE], bytes: blade },
    { slot: 'attach R', bones: ['Right Hand'], bytes: blade }, { slot: 'attach L', bones: ['Left Hand'], bytes: blade }];   // a rigid part on each hand's attach node (rule 13 draws the left one negated)
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts, offWeaponBone: true });
  assert.ok(asm.ok, asm.error);
  assert.deepEqual(asm.notes, []);
  const sk = asm.skeleton;
  const pose = bentRight(sk, mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices));
  const cam = sk.byName.get('camera');
  poseAssembly(asm, { tracks: new Map([...pose.keys()].map((k) => [k, k])), sampleTrack: (k) => pose.get(k), mirror: { limbs: { L: { pose: null, side: 'R', mirror: true } }, plane: { ref: cam, dx: 0 } } });
  const eyeX = asm.mats.get(cam).t[0];
  return { asm, P: (v) => [2 * eyeX - v[0], v[1], v[2]] };
}
/** How far piece `left`'s vertices stand from the mirror of piece `right`'s - vertex for vertex (`same`: one mesh), else
 *  each to its nearest - at worst. */
function offTheMirror(asm, P, right, left, same) {
  const A = asm.pieces.find((p) => p.slot === right || p.slot.startsWith(right)).positions, B = asm.pieces.find((p) => p.slot === left || p.slot.startsWith(left)).positions;
  let worst = 0;
  for (let j = 0; j < B.length; j += 3) {
    let best = Infinity;
    for (let i = same ? j : 0; i < (same ? j + 3 : A.length); i += 3) best = Math.min(best, dist(P([A[i], A[i + 1], A[i + 2]]), [B[j], B[j + 1], B[j + 2]]));
    worst = Math.max(worst, best);
  }
  return worst;
}

test('TWO-HANDS MIRROR-BIND the first-person pair IS the right in the glass on a rig whose rest is not its own mirror: the left hand\'s joint at its mirror, the left blade the right\'s mirror vertex for vertex, each left gauntlet vertex on a mirrored right one - read off the Tri Shadow\'s bind, and with no skin in the skeleton file off the two gauntlets\' own; the old law (the REST\'s K) stood the hand 38 units off and the blade 65 (mutants: TWO-HANDS-MIRROR-BIND-rest-k, TWO-HANDS-MIRROR-BIND-one-skin-only, TWO-HANDS-MIRROR-BIND-left-node-rest, TWO-HANDS-MIRROR-BIND-pieces-not-read, TWO-HANDS-MIRROR-BIND-file-not-read)', async () => {
  for (const shadow of [true, false]) {
    seed = 23;
    const { asm, P } = await pairAcrossThePicture(fpStandIn(shadow));
    const sk = asm.skeleton;
    const at = (n) => asm.mats.get(sk.byName.get(n)).t;
    assert.ok(dist(P(at('bip01 r hand')), at('bip01 l hand')) < 1e-3, `${shadow ? 'the Tri Shadow' : 'the gauntlets'}: the left hand's joint at the right's mirror (${dist(P(at('bip01 r hand')), at('bip01 l hand')).toFixed(3)} off)`);
    assert.ok(dist(P(at('bip01 r forearm')), at('bip01 l forearm')) < 1e-3, 'and its elbow');
    const blade = offTheMirror(asm, P, 'weapon', 'offweapon', true);
    assert.ok(blade < 1e-3, `the left blade the right's mirror, vertex for vertex (${blade.toFixed(4)} off at worst)`);
    const glove = offTheMirror(asm, P, 'right hand', 'left hand', false);
    assert.ok(glove < 1e-3, `each left gauntlet vertex on a mirrored right one (${glove.toFixed(4)} off at worst)`);
    const attached = offTheMirror(asm, P, 'attach R', 'attach L', true);
    assert.ok(attached < 1e-3, `a rigid part on the Left Hand node the right one's mirror (${attached.toFixed(4)} off at worst)`);
  }
});

test('TWO-HANDS MIRROR-BIND the bind is read only where it is a mirror, and the rest\'s law stands where nothing is bound: the sources are the skeleton file\'s skins and the pieces\' (a turned skin not read), and an assembly the player\'s rigs build carries its file\'s (mutants: TWO-HANDS-MIRROR-BIND-any-binds-a-mirror, TWO-HANDS-MIRROR-BIND-no-bind-a-mirror, TWO-HANDS-MIRROR-BIND-turned-skin-read)', async () => {
  const sk = retailSkeleton();
  const fromFile = mirrorBindSources({ nif: parseNif(sk) });
  assert.equal(fromFile.length, 1, 'the Tri Shadow: one skin');
  const skel = buildSkeleton(parseNif(sk));
  const bind = fromFile[0].get(skel.byName.get('bip01 r hand')), oracle = inv({ a: SHADOW_INVERSE_BINDS.get('Bip01 R Hand').a, t: SHADOW_INVERSE_BINDS.get('Bip01 R Hand').t });
  assert.ok(diff(bind, oracle) < 1e-4, 'its hand\'s bind, the inverse bind undone');
  assert.deepEqual(mirrorBindSources({ nif: parseNif(retailSkeleton({ shadow: false })) }), [], 'no skin, no source');
  const piece = (rotation) => ({ kind: 'skinned', batch: { skin: { transform: { rotation }, shapeTransform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, bones: [{ ref: 3, invBind: { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [1, 2, 3] } }] } } });
  assert.equal(mirrorBindSources({ pieces: [piece([1, 0, 0, 0, 1, 0, 0, 0, 1])] }).length, 1, 'a piece\'s skin');
  assert.equal(mirrorBindSources({ pieces: [piece([0, -1, 0, 1, 0, 0, 0, 0, 1])] }).length, 0, 'a turned one binds in another frame: not read');
  assert.equal(mirrorBindSources({ pieces: [{ kind: 'rigid' }] }).length, 0, 'a rigid piece binds nothing');
  const off = await assembleFirstPersonArm({ skeletonBytes: sk, parts: [], offWeaponBone: true });
  const plain = await assembleFirstPersonArm({ skeletonBytes: sk, parts: [] });
  assert.equal(off.skinBinds?.length, 1, 'the player\'s rigs keep their file\'s skins');
  assert.equal(plain.skinBinds, null, 'a body that holds no pair reads none');
  // the fixture arm (its rest its own mirror, nothing skinned on it here): the rest's law, exactly as it stood
  const fx = buildSkeleton(parseNif(f('armfp.nif')));
  const plan = mirrorPlan(fx, GRAPH_ROOT, skeletonSpaceMatrices);
  const cam = fx.byName.get('camera');
  const pose = bentRight(fx, plan);
  const run = (binds) => { const p = new Map(pose); applyMirrorRig(fx, p, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } }, plane: { ref: cam, dx: 0, binds } }); return M(fx, p); };
  const a = run(undefined), b = run([]);
  for (const ref of plan.arms.L) assert.ok(diff(a.get(ref), b.get(ref)) < 1e-9, 'no bind: the rest\'s K');
  // a pair of binds read only where it IS a mirror: the hands bound off each other's mirror (one a span ahead) are not
  // read; bound on it, turned, they are
  const hand = (s) => fx.byName.get(s === 'L' ? 'left hand' : 'right hand');
  const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const binds = (tL) => [new Map([[hand('R'), { a: I3, t: [-0.3, 0, 1] }], [hand('L'), { a: rotAxisAngle([0, 1, 0], 0.4), t: tL }]])];
  const askew = run(binds([0.3, 0.6, 1])), mirrored = run(binds([0.3, 0, 1]));
  assert.ok(diff(askew.get(hand('L')), a.get(hand('L'))) < 1e-9, 'bound off the mirror: the rest\'s K');
  assert.ok(diffRot(mirrored.get(hand('L')), a.get(hand('L'))) > 0.1, 'bound on it: the bind\'s turn');
  assert.ok(dist(mirrored.get(hand('L')).t, a.get(hand('L')).t) < 1e-6, 'and the joint where the mirror stands it');
});

// ---- TWO-HANDS SPREAD (2026-10-17, Mac: "For the morrowind first person, when duel wielding can we spread out the arms
// a bit more sense it can make the weapons overlap") ----------------------------------------------------------------

test('TWO-HANDS SPREAD the law (handsLaw.js pairSpreadAngle): the least turn in [MIN, MAX] at which the blades stand GAP apart on the picture - each a share of its height, as the angle it spans at its middle; MIN where the blades stand clear already or no pair of them is on the picture, MAX where even it cannot clear them, and between, the turn the edges ask - read at every angle tried, so an arm turned about a shoulder (an edge moving less than the turn) still stands GAP apart (mutants: TWO-HANDS-SPREAD-no-min, TWO-HANDS-SPREAD-no-max, TWO-HANDS-SPREAD-no-gap, TWO-HANDS-SPREAD-halving-backwards, TWO-HANDS-SPREAD-answer-short, TWO-HANDS-SPREAD-one-blade-asks)', () => {
  assert.deepEqual({ ...PAIR_SPREAD }, { MIN: 0.04, GAP: 0.04, MAX: 0.2, TAU: 0.12 });
  const fov = Math.PI / 3, tan = Math.tan(fov / 2);
  const MIN = Math.atan(PAIR_SPREAD.MIN * 2 * tan), MAX = Math.atan(PAIR_SPREAD.MAX * 2 * tan), GAP = 2 * Math.atan(PAIR_SPREAD.GAP * tan);
  assert.equal(pairSpreadAngle(() => ({ L: 0.3, R: 0.3 }), fov), MIN, 'clear already: the arms a little wider all the same');
  assert.equal(pairSpreadAngle(() => ({ L: null, R: -0.5 }), fov), MIN, 'one blade on the picture: nothing to clear');
  assert.equal(pairSpreadAngle(() => null, fov), MIN);
  // turned about the eye, an edge moves the whole turn: the answer is (GAP - L - R) / 2, unequal blades alike
  const aboutEye = (l, r) => (a) => ({ L: l + a, R: r + a });
  const want = (GAP + 0.1 + 0.02) / 2;
  assert.ok(want > MIN + 0.01 && want < MAX - 0.01, 'the case stands between the two bounds');
  assert.ok(Math.abs(pairSpreadAngle(aboutEye(-0.1, -0.02), fov) - want) < 1e-6, `two blades crossing the middle: ${pairSpreadAngle(aboutEye(-0.1, -0.02), fov)} / ${want}`);
  // about a shoulder an edge moves 0.7 of the turn: read at each angle, the blades stand GAP apart at the answer
  const shoulder = (a) => ({ L: -0.03 + 0.7 * a, R: -0.03 + 0.7 * a });
  const got = pairSpreadAngle(shoulder, fov);
  const at = shoulder(got);
  assert.ok(at.L + at.R >= GAP && at.L + at.R - GAP < 1e-6, `GAP apart at the answer (${(at.L + at.R).toFixed(6)} / ${GAP.toFixed(6)})`);
  assert.ok(got > (GAP + 0.06) / 2 + 0.01, 'further than the eye\'s answer would turn them');
  assert.equal(pairSpreadAngle(aboutEye(-1, -1), fov), MAX, 'never more than MAX');
});

/** The least of `out` . x / ahead over the part of each triangle edge the picture shows (|z / ahead| within the 60-degree
 *  lens), sampled densely - an oracle that cuts nothing analytically - as an angle; vertices `v` relative to the eye. */
function sampledInnerEdge(v, idx, out) {
  const edge = Math.tan(Math.PI / 6);
  let best = Infinity;
  for (let t = 0; t < idx.length; t += 3) {
    for (const [i, j] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      for (let k = 0; k <= 20000; k++) {
        const u = k / 20000, p = [0, 1, 2].map((c) => v[i * 3 + c] + (v[j * 3 + c] - v[i * 3 + c]) * u);
        if (p[1] > 1e-6 && Math.abs(p[2] / p[1]) <= edge) best = Math.min(best, (out * p[0]) / p[1]);
      }
    }
  }
  return Number.isFinite(best) ? Math.atan(best) : null;
}

test('TWO-HANDS SPREAD a blade\'s INNER EDGE (fpArm.js bladeInnerEdge): the angle at the eye from the picture\'s middle to the blade\'s nearest point, on the right hand\'s side, of the part of it the PICTURE shows - each triangle edge cut to the picture\'s height, so a blade whose tip runs off the top is read where it leaves the picture (neither its vertices alone nor the whole of it); with the arm turned out by `spread` about the upright line through its top\'s joint; the left blade read in the RIGHT hand; null off the picture (mutants: TWO-HANDS-SPREAD-edge-uncut, TWO-HANDS-SPREAD-edge-vertices, TWO-HANDS-SPREAD-edge-turn-way, TWOHANDSMW-AUDIT2-left-blade-on-its-own-bone)', () => seeded(async () => {
  const arm = await drawnArm();
  const b = arm.built(), sk = b.arm.skeleton;
  const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
  const out = plan.outward.R;
  const mats = new Map(b.restMats);
  const eye = mats.get(b.cameraRef).t;
  const wb = sk.byName.get('weapon bone'), wbl = sk.byName.get('weapon bone left');
  mats.set(wb, { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: eye.slice() });   // the blade's vertices placed relative to the eye
  mats.set(wbl, { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [eye[0], eye[1] - 5, eye[2]] });   // the left bone's own place: behind the eye
  // one triangle: a corner below the middle on the right, one above the picture across the middle, one on the right
  const v = [0.3 * out, 1, -0.2, -0.5 * out, 1, 1.0, 0.4 * out, 1, 0.0];
  const idx = [0, 1, 2];
  const piece = { slot: 'weapon', source: Float32Array.from(v), attachRef: wb, indices: Uint16Array.from(idx), boneOffset: null };
  const got = bladeInnerEdge(b.arm, mats, b.cameraRef, [piece]);
  const oracle = sampledInnerEdge(v, idx, out);
  assert.ok(Math.abs(got - oracle) < 1e-3, `cut where it leaves the picture: ${got} / ${oracle}`);
  assert.ok(Math.abs(got - Math.atan(-0.5)) > 0.1 && Math.abs(got - Math.atan(0.3)) > 0.1, 'neither the whole edge nor its corners alone');
  // turned out about the upright line through the right arm's top joint
  const pivot = mats.get(plan.arms.R[0]).t, s = 0.15, c = Math.cos(-out * s), n = Math.sin(-out * s);
  const turned = [];
  for (let i = 0; i < v.length; i += 3) {
    const x = eye[0] + v[i] - pivot[0], y = eye[1] + v[i + 1] - pivot[1];
    turned.push(pivot[0] + c * x - n * y - eye[0], pivot[1] + n * x + c * y - eye[1], v[i + 2]);
  }
  const gotTurned = bladeInnerEdge(b.arm, mats, b.cameraRef, [piece], s);
  assert.ok(Math.abs(gotTurned - sampledInnerEdge(turned, idx, out)) < 1e-3, `turned out: ${gotTurned} / ${sampledInnerEdge(turned, idx, out)}`);
  assert.ok(gotTurned > got + 0.05, 'further out');
  // the left blade, in the right hand: its own bone stands behind the eye and is never read
  assert.equal(bladeInnerEdge(b.arm, mats, b.cameraRef, [{ ...piece, slot: 'offweapon', attachRef: wbl }]), got);
  assert.equal(bladeInnerEdge(b.arm, mats, b.cameraRef, [{ ...piece, source: Float32Array.from([0, 1, 2, 0.3, 1, 3, -0.3, 1, 2.5]) }]), null, 'wholly above the picture: null');
  assert.equal(bladeInnerEdge(b.arm, mats, b.cameraRef, []), null);
}));

/** A skeleton's arms named the other way: its right arm stands where its left stood. */
const namedAcross = (sk) => {
  const nodes = new Map([...sk.nodes].map(([r, nd]) => [r, { ...nd, name: counterpartName(nd.name) }]));
  const byName = new Map();
  for (const [r, nd] of nodes) if (!byName.has(nd.name)) byName.set(nd.name, r);
  return { nodes, byName };
};

test('TWO-HANDS SPREAD mirror: `spread` turns each arm OUT at its top about the upright line through that top\'s own joint - every joint of the arm where that turn takes it (its height kept, the top joint where its parent carries it, every bone its length), each arm its own way out, read off the skeleton (a body whose arms stand the other way round turns them the other way); a left arm that was the right\'s mirror across the picture stays its mirror; nothing else moves; alone it turns the clip\'s arms; and it eases in and out of a composition from what was drawn (mutants: TWO-HANDS-SPREAD-inward, TWO-HANDS-SPREAD-own-frame, TWO-HANDS-SPREAD-ignored, TWO-HANDS-SPREAD-not-alone, TWO-HANDS-SPREAD-not-kept, TWO-HANDS-SPREAD-new-key-pops, TWO-HANDS-SPREAD-outward-assumed)', () => {
  const bytes = retailSkeleton({ extra: ['Camera'] });
  for (const sk of [buildSkeleton(parseNif(bytes)), namedAcross(buildSkeleton(parseNif(bytes)))]) {
    seed = 31;
    const plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices);
    const cam = sk.byName.get('camera');
    const binds = mirrorBindSources({ nif: parseNif(bytes) });
    const pose = bentRight(sk, plan);
    const asked = (spread) => { const p = new Map(pose); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { limbs: { L: { pose: null, side: 'R', mirror: true } }, plane: { ref: cam, dx: 0, binds }, spread }); return M(sk, p); };
    const a = asked(0), b = asked(0.12);
    const rest = M(sk, new Map());
    for (const side of ['L', 'R']) {
      const top = plan.arms[side][0], C = a.get(top).t, phi = -plan.outward[side] * 0.12;
      for (const ref of plan.arms[side]) {
        const p = a.get(ref).t, x = p[0] - C[0], y = p[1] - C[1];
        const want = [C[0] + Math.cos(phi) * x - Math.sin(phi) * y, C[1] + Math.sin(phi) * x + Math.cos(phi) * y, p[2]];
        assert.ok(dist(b.get(ref).t, want) < 1e-4, `${sk.nodes.get(ref).name} turned about the upright line through ${sk.nodes.get(top).name} (${dist(b.get(ref).t, want)})`);
        const up = sk.nodes.get(ref).parent;
        if (sk.nodes.has(up)) assert.ok(Math.abs(dist(b.get(up).t, b.get(ref).t) - dist(a.get(up).t, a.get(ref).t)) < 1e-4, 'its bone keeps its length');
      }
      const hand = plan.hands[side], mid = (rest.get(plan.uppers.L).t[0] + rest.get(plan.uppers.R).t[0]) / 2;
      assert.ok(Math.abs(b.get(hand).t[0] - mid) > Math.abs(a.get(hand).t[0] - mid) + 0.1, `the ${side} hand further out from the body's middle (${a.get(hand).t[0].toFixed(2)} -> ${b.get(hand).t[0].toFixed(2)})`);
    }
    const P = (v) => [2 * b.get(cam).t[0] - v[0], v[1], v[2]];
    for (const n of ['bip01 r hand', 'bip01 r forearm', 'bip01 r upperarm']) {
      const r = sk.byName.get(n), l = sk.byName.get(counterpartName(n));
      assert.ok(dist(P(b.get(r).t), b.get(l).t) < 1e-3, `the left still the right's mirror across the picture: ${n} (${dist(P(b.get(r).t), b.get(l).t).toFixed(5)})`);
    }
    const arms = new Set([...plan.arms.L, ...plan.arms.R]);
    for (const [ref, m] of a) if (!arms.has(ref)) assert.ok(diff(b.get(ref), m) < 1e-9, 'nothing else moves');
    // alone: the clip's own arms, each turned at its top
    const q = new Map(pose);
    assert.deepEqual(applyMirrorRig(sk, q, GRAPH_ROOT, skeletonSpaceMatrices, { spread: 0.1 })?.sort(), [plan.arms.L[0], plan.arms.R[0]].sort());
  }
  // the carry: a spread taken off under a new key eases off from where it was drawn; one asked under a new key with
  // nothing drawn eases in from the clip
  const sk = buildSkeleton(parseNif(bytes)), plan = mirrorPlan(sk, GRAPH_ROOT, skeletonSpaceMatrices), top = plan.arms.R[0];
  const rr = sk.nodes.get(top).rest.rotation;
  const turn = (e) => { const r = mat33Mul(e.rotation, Float32Array.from([rr[0], rr[3], rr[6], rr[1], rr[4], rr[7], rr[2], rr[5], rr[8]])); return Math.acos(Math.min(1, (r[0] + r[4] + r[8] - 1) / 2)); };
  const st = {};
  const frame = (key, spread) => { const p = new Map(); applyMirrorRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, { carry: { key, dt: 1 / 60, tau: 0.06, state: st }, spread }); return turn(p.get(top) ?? sk.nodes.get(top).rest); };
  frame('none', 0.2);
  assert.ok(Math.abs(frame('none', 0.2) - 0.2) < 1e-4, 'the top turned 0.2');
  const off = [];
  for (let i = 0; i < 30; i++) off.push(frame('taken', 0));
  assert.ok(off[0] > 0.19, `the first frame under the new key stands where it was drawn (${off[0].toFixed(4)})`);
  for (let i = 1; i < 10; i++) assert.ok(off[i] < off[i - 1], 'and eases back');
  assert.ok(off[29] < 1e-3);
  const on = [frame('dual', 0.2), frame('dual', 0.2), frame('dual', 0.2)];
  assert.ok(on[0] < 1e-3 && on[1] > 0 && on[1] < 0.15 && on[2] > on[1], `a spread asked under a new key with nothing drawn eases in from the clip (${on.map((x) => x.toFixed(4))})`);
});

test('TWO-HANDS SPREAD the arm (Mac: "For the morrowind first person, when duel wielding can we spread out the arms a bit more sense it can make the weapons overlap"): a pair in first person turns both arms out by the angle its blades ask on the build\'s rest (bladeInnerEdge, pairSpreadAngle) - measured once, never for one weapon - eased in on PAIR_SPREAD.TAU; the right arm is the clip\'s turned about its top (the same frames with one weapon, in lockstep), the left its mirror across the eye; third person\'s body is never turned; a blade leaning across the middle is turned until the two stand GAP apart; sheathed, the arms come back (mutants: TWO-HANDS-SPREAD-third-person, TWO-HANDS-SPREAD-single-hand, TWO-HANDS-SPREAD-kept-after-pair, TWO-HANDS-SPREAD-no-ease, TWO-HANDS-SPREAD-never-rests, TWO-HANDS-SPREAD-never-laid, TWO-HANDS-SPREAD-memo-stale)', async () => {
  const dt = 0.05, tan = Math.tan(FP_FIELD_OF_VIEW / 2), GAP = 2 * Math.atan(PAIR_SPREAD.GAP * tan);
  const answer = (b) => {
    const rights = b.arm.pieces.filter((p) => p.slot === 'weapon'), lefts = b.arm.pieces.filter((p) => p.slot === 'offweapon');
    return pairSpreadAngle((a) => ({ R: bladeInnerEdge(b.arm, b.restMats, b.cameraRef, rights, a), L: bladeInnerEdge(b.arm, b.restMats, b.cameraRef, lefts, a) }), FP_FIELD_OF_VIEW);
  };
  /** One run, frame by frame: the view's rig's right hand and arm top, the hands' state, the eye. */
  const run = (pair, view) => seeded(async () => {
    const arm = await drawnArm({ d: bodyDeps() });
    if (view === 'third') assert.ok(arm.setViewMode('third'));
    for (let i = 0; i < 10; i++) { arm.update(dt); assert.equal(arm.handsState().spread, 0, 'one weapon: no spread'); }
    assert.equal(arm.handsState().spreadInner, null, 'and nothing measured - a body that never holds a pair never pays');
    if (pair) { arm.setHands({ mode: 'dual', lead: 'R' }); await arm.setOffWeapon(LONGSWORD); }
    const frames = [];
    for (let i = 0; i < 30; i++) {
      arm.update(dt);
      const b = arm.built(), a = view === 'third' ? b.third.arm : b.arm, plan = mirrorPlan(a.skeleton, GRAPH_ROOT, a.fns.skelMats);
      frames.push({ hand: a.mats.get(plan.hands.R).t.slice(), top: a.mats.get(plan.arms.R[0]).t.slice(), h: arm.handsState(), eye: b.arm.mats.get(b.cameraRef).t.slice() });
    }
    return { arm, frames };
  });
  const one = await run(false, 'first'), two = await run(true, 'first');
  const target = answer(two.arm.built());
  assert.ok(Math.abs(target - Math.atan(PAIR_SPREAD.MIN * 2 * tan)) < 1e-9, 'the fixture\'s blades stand clear: MIN');
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(two.frames[i].h.spread - target * (1 - Math.exp(-((i + 1) * dt) / PAIR_SPREAD.TAU))) < 1e-9, `eased in on PAIR_SPREAD.TAU (${i}: ${two.frames[i].h.spread})`);
  const end = two.frames[29], same = one.frames[29], s = end.h.spread;
  assert.ok(Math.abs(s - target) < 1e-4);
  assert.equal(end.h.composed, 'dual');
  assert.ok(dist(end.top, same.top) < 1e-6, 'the right arm\'s top joint where the clip has it');
  const x = same.hand[0] - same.top[0], y = same.hand[1] - same.top[1], c = Math.cos(-s), n = Math.sin(-s);
  const want = [same.top[0] + c * x - n * y, same.top[1] + n * x + c * y, same.hand[2]];
  assert.ok(dist(end.hand, want) < 1e-4, `the right hand the clip's turned out about its top (${end.hand.map((v) => v.toFixed(4))} / ${want.map((v) => v.toFixed(4))})`);
  assert.ok(end.hand[0] > same.hand[0] + 0.02, 'out, to the right');
  assert.ok(Math.abs((end.h.wrists.L[0] - end.eye[0]) + (end.h.wrists.R[0] - end.eye[0])) < 0.02, `the left the right's mirror across the eye (${end.h.wrists.L} / ${end.h.wrists.R})`);
  // third person: the body keeps its arms at its sides
  const oneT = await run(false, 'third'), twoT = await run(true, 'third');
  assert.ok(twoT.frames[29].h.spread > 0, 'the angle stands in either view');
  assert.ok(dist(twoT.frames[29].hand, oneT.frames[29].hand) < 1e-6, 'and third person\'s right arm is the clip\'s, never turned');
  // sheathed: back
  two.arm.setSheathed(true);
  for (let i = 0; i < 120; i++) two.arm.update(dt);
  assert.equal(two.arm.handsState().spread, 0, 'sheathed: the arms come back');
  // a blade leaning across the middle at rest: turned until the two stand GAP apart
  await seeded(async () => {
    const arm = await drawnArm();
    const b = arm.built(), sk = b.arm.skeleton, wb = sk.nodes.get(sk.byName.get('weapon bone'));
    wb.rest.rotation = mat33Mul(rotAxisAngle([0, 1, 0], -0.45), wb.rest.rotation);
    arm.update(dt);
    b.restMats = new Map(b.arm.mats);
    const rest = bladeInnerEdge(b.arm, b.restMats, b.cameraRef, b.arm.pieces.filter((p) => p.slot === 'weapon'));
    assert.ok(rest < -0.05, `the blade crosses the middle at rest (${rest})`);
    // the pair taken up before its left blade is bound: one blade on the picture asks nothing past MIN...
    arm.setHands({ mode: 'dual', lead: 'R' });
    for (let i = 0; i < 3; i++) arm.update(dt);
    assert.equal(arm.handsState().spreadInner.L, null, 'no left blade yet');
    assert.ok(Math.abs(answer(b) - Math.atan(PAIR_SPREAD.MIN * 2 * tan)) < 1e-12);
    // ...and the blade bound is measured anew
    await arm.setOffWeapon(LONGSWORD);
    for (let i = 0; i < 60; i++) arm.update(dt);
    const h = arm.handsState(), want2 = answer(b);
    assert.ok(want2 > Math.atan(PAIR_SPREAD.MIN * 2 * tan) + 0.05 && want2 < Math.atan(PAIR_SPREAD.MAX * 2 * tan) - 0.05, `further than MIN, short of MAX (${want2})`);
    assert.ok(Math.abs(h.spread - want2) < 1e-6, `the angle its blades ask (${h.spread} / ${want2})`);
    assert.ok(Math.abs(h.spreadInner.L + h.spreadInner.R - GAP) < 1e-6, `GAP apart at it (${(h.spreadInner.L + h.spreadInner.R).toFixed(6)} / ${GAP.toFixed(6)})`);
  });
});

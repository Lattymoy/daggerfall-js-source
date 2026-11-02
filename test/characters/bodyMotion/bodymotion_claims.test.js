// AUDIT BODY-MOTION DOC-5 / DOC-6 / DOC-7 / DOC-8 / DOC-9 (2026-10-19, bible/01-Overview/audits/Audit-Body-Motion.md):
// THE RECORD'S CLAIMS, EACH PINNED. The doc lane wrote a mutant for every claim bible/04-Characters/Body-Motion.md
// makes of the layer and found 36 of 37 surviving the suite; these are the pins for the ones the rest of the suite
// still could not fail (tools/mutants/bodymotion_claims.json). Each measures the claim on the vendored retail biped,
// through the layer as the rig steps it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_UNITS_PER_METER, MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { applyClimbRig, rotAxisAngle } from '../../../src/combat/climbRig.js';
import { mat33Mul } from '../../../src/formats/morrowind/mwNifMesh.js';
import { bodyOf, RAD, turnOf } from '../../../src/characters/bodyMotion/bodyKit.js';
import { createGaitState, stepGait, gaitPose, STEER } from '../../../src/characters/bodyMotion/gait.js';
import { createBodyMotion, sceneInput, motionWord } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { CARRY } from '../../../src/characters/bodyMotion/carry.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (s, pose, root) => skeletonSpaceMatrices(s, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const U = MW_UNITS_PER_METER;
const L = body.leg, A = body.arm;
const W = MW_WEAPON_TYPE;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const pt = (m, name) => m.get(sk.byName.get(name)).t;
const axisOf = (m, name, col) => { const a = m.get(sk.byName.get(name)).a, l = Math.hypot(a[col], a[col + 3], a[col + 6]); return [a[col] / l, a[col + 3] / l, a[col + 6] / l]; };
const yawOf = (v) => Math.atan2(v[1], v[0]) / RAD;
const wrapDeg = (d) => ((d + 540) % 360) - 180;
const dump = (label, v) => { if (process.env.DUMP) console.log(`DUMP ${label}`, typeof v === 'number' ? +v.toFixed(4) : v); return v; };

/** The gait as the motor drives it (the audit pins' own): `script(t)` -> the frame's keys and pace; `each` every frame. */
function drive(script, seconds, each = null, kind = 'male', extra = {}) {
  const dt = 1 / 60, own = [0, 0, 0], state = createGaitState();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const t = i * dt, w = script(t);
    const yaw = w.yaw ?? 0, f = w.forward ?? 0, st = w.strafe ?? 0, mag = Math.hypot(f, st), v = w.speed ?? 0;
    if (mag > 0 && v > 0) { own[0] += ((Math.sin(yaw) * f + Math.cos(yaw) * st) / mag) * v * dt; own[2] += ((Math.cos(yaw) * f - Math.sin(yaw) * st) / mag) * v * dt; }
    const inp = { speed: v, forward: f, strafe: st, running: !!w.running, sneaking: !!w.sneaking, yaw, grounded: true, kind, legM: L / U, unitsPerM: U, unitsPerMz: U, travel: [...own], carriedYaw: 0, stance: null, stepTime: null, ...extra };
    stepGait(state, inp, body, dt);
    if (each) each({ t, g: gaitPose(state, inp, body), s: state });
  }
  return state;
}
/** The layer stepped and posed at 60 Hz, as the rig does: `each(mats, t, motion)` every frame. */
function pose(scene, seconds, each = null, motion = createBodyMotion()) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const t = i / 60;
    motion.step(1 / 60, sceneInput(typeof scene === 'function' ? scene(t) : scene));
    const p = new Map();
    motion.apply(sk, p, GRAPH_ROOT, sm);
    if (each) each(sm(sk, p, GRAPH_ROOT), t, motion);
  }
  return motion;
}
/** A blow through the machine's three sections (wind-up 0.28 s, release 0.12 s, follow 0.6 s), the frames' fields. */
const machine = () => {
  const out = [];
  for (let t = 1 / 60; t < 1 - 1e-9; t += 1 / 60) out.push(t < 0.28 ? { section: 'windup', progress: t / 0.28 } : t < 0.4 ? { section: 'release', progress: (t - 0.28) / 0.12 } : { section: 'follow', progress: (t - 0.4) / 0.6 });
  return out;
};
/** A blow thrown from a stand after 1.5 s of `scene`: `each(mats, frame, i)` every frame of it. */
function blow(scene, b, each) {
  const m = pose(scene, 1.5);
  machine().forEach((f, i) => pose({ ...scene, blow: { reversed: false, hand: 'R', strength: 1, ...b, ...f } }, 1 / 60, (mm) => each(mm, f, i), m));
}

// ---------------------------------------------------------------- DOC-5: the gait ----------------------------------

test('AUDIT BODY-MOTION DOC-5 A RACE\'S SCALE IN THE WORD: a heavier race\'s body (its build scaled wider) crosses fewer of its own units for the same ground, so its planted foot goes back under it at the ground\'s pace and no faster; a taller race\'s longer leg strides a little longer, its cadence a little slower (mutants: AUDIT-BODY-MOTION-race-build-ignored, AUDIT-BODY-MOTION-race-height-ignored-in-the-word)', () => {
  // the planted foot's own speed back under the body, in the rig's units: the ground's pace over the build
  const footPace = (weight) => {
    let prev = null, sum = 0, n = 0;
    pose((t) => ({ forward: 1, speed: 3, weight, travel: [0, 0, 3 * t] }), 3, (m, t) => {
      const f = pt(m, 'bip01 l foot');
      if (prev && t > 1.5 && Math.abs(f[2] - prev[2]) < 0.02 && f[2] < 12) { sum += prev[1] - f[1]; n++; }
      prev = f;
    });
    return (sum / n) * 60;
  };
  const p1 = dump('footPace w1', footPace(1)), p12 = dump('footPace w1.25', footPace(1.25));
  assert.ok(Math.abs(p1 / (3 * U) - 1) < 0.08, `the build 1: the planted foot goes back at ${(p1 / U).toFixed(2)} m/s under a 3 m/s body`);
  assert.ok(Math.abs(p12 / (3 * U / 1.25) - 1) < 0.08, `the build 1.25: at ${(p12 / U).toFixed(2)} of the rig's metres a second (the ground's ${(3 / 1.25).toFixed(2)})`);
  // the cadence at 4.43 m/s: the stride's clock, strides a second (the walk at its longest stride, GAIT-3's cap the rig's
  // own leg - so a taller leg in metres strides a little longer, and the cadence falls a little)
  const cadence = (height) => {
    let prev = null, turned = 0;
    pose((t) => ({ forward: 1, speed: 4.43, height, travel: [0, 0, 4.43 * t] }), 6, (m, t, mo) => {
      const ph = mo.status().phase;
      if (prev != null && t > 1.5) turned += ((ph - prev) % 1 + 1) % 1;
      prev = ph;
    });
    return turned / 4.5;
  };
  const c1 = dump('cadence h1', cadence(1)), c12 = dump('cadence h1.2', cadence(1.2));
  assert.ok(c12 < c1 * 0.985, `a race 1.2 times as tall strides ${c12.toFixed(3)} a second to the 1's ${c1.toFixed(3)}`);
});

test('AUDIT BODY-MOTION DOC-5 THE FAMILIES: the word\'s family reaches the gait - a female walks a narrower track than a male; the beast style is its own (a higher lift than the male\'s, a springier run), not only its foot (mutants: AUDIT-BODY-MOTION-family-never-reaches-the-gait, AUDIT-BODY-MOTION-beast-only-its-foot)', () => {
  const track = (kind) => {
    let sum = 0, n = 0;
    pose((t) => ({ forward: 1, speed: 3, kind, travel: [0, 0, 3 * t] }), 3, (m, t) => { if (t > 1.5) { sum += Math.abs(pt(m, 'bip01 l foot')[0] - pt(m, 'bip01 r foot')[0]); n++; } });
    return sum / n;
  };
  const male = dump('track male', track('male')), female = dump('track female', track('female'));
  assert.ok(female < male * 0.92, `the female's track ${female.toFixed(2)} units to the male's ${male.toFixed(2)}`);
  const springs = (kind) => {
    let lo = Infinity, hi = -Infinity, lift = 0;
    drive(() => ({ forward: 1, speed: 3 }), 4, ({ t, g }) => { if (t > 2) for (const side of ['L', 'R']) lift = Math.max(lift, g.feet[side].lift); }, kind);
    // the bob is the run's spring (a walk's dip is its legs' reach, GAIT-3)
    drive(() => ({ forward: 1, speed: 8.1, running: true }), 4, ({ t, g }) => { if (t > 2) { lo = Math.min(lo, g.hip.at[2]); hi = Math.max(hi, g.hip.at[2]); } }, kind);
    return { bob: hi - lo, lift };
  };
  const m = springs('male'), b = springs('beast');
  dump('bob male/beast', [m.bob, b.bob]); dump('lift male/beast', [m.lift, b.lift]);
  assert.ok(b.lift > m.lift * 1.08, `the beast's swing lifts ${b.lift.toFixed(2)} to the male's ${m.lift.toFixed(2)}`);
  assert.ok(b.bob > m.bob * 1.1, `the beast's run springs ${b.bob.toFixed(2)} to the male's ${m.bob.toFixed(2)}`);
});

test('AUDIT BODY-MOTION DOC-5 THE SWING AND THE HIPS: a foot in the air is lifted off the ground through its swing; the hips sway over the standing foot; the bank leans into a turn (yaw grows to the right; a + roll drops the right side) (mutants: AUDIT-BODY-MOTION-swing-never-lifts, AUDIT-BODY-MOTION-hips-never-sway, AUDIT-BODY-MOTION-bank-out-of-the-turn)', () => {
  let lift = 0, lo = Infinity, hi = -Infinity;
  drive(() => ({ forward: 1, speed: 3 }), 4, ({ t, g }) => {
    if (t < 2) return;
    for (const side of ['L', 'R']) if (!g.feet[side].stance) lift = Math.max(lift, g.feet[side].lift);
    lo = Math.min(lo, g.hip.at[0]); hi = Math.max(hi, g.hip.at[0]);
  });
  dump('swing lift', lift); dump('sway', hi - lo);
  assert.ok(lift > 0.05 * L, `the swing lifts the foot ${lift.toFixed(2)} units`);
  assert.ok(hi - lo > 0.01 * L, `the hips sway ${(hi - lo).toFixed(2)} units side to side`);
  const st = drive((t) => ({ forward: 1, speed: 8.1, running: true, yaw: t * 90 * RAD }), 3);
  dump('bank turning right', st.bank);
  assert.ok(st.bank > 0.02, `running and turning right, the bank ${st.bank.toFixed(3)} (into the turn: + drops the right side)`);
});

test('AUDIT BODY-MOTION DOC-5 THE STEER: a backpedal begins past STEER.back + STEER.hyst off the facing and ends under STEER.back - STEER.hyst (between, the way it came keeps); its hips turned at most STEER.backMax degrees (mutants: AUDIT-BODY-MOTION-steer-no-hysteresis, AUDIT-BODY-MOTION-backpedal-unclamped)', () => {
  const at = (deg) => ({ forward: Math.cos(deg * RAD), strafe: Math.sin(deg * RAD), speed: 3 });
  const inside = STEER.back + STEER.hyst / 2;   // inside the band
  assert.equal(drive(() => at(inside), 2).back, false, `from a stand at ${inside} degrees: forward`);
  assert.equal(drive((t) => (t < 1 ? at(180) : at(inside)), 2.5).back, true, `from a backpedal to ${inside} degrees: still back`);
  let most = 0;
  drive(() => at(120), 2.5, ({ t, s }) => { if (t > 1.5) most = Math.max(most, Math.abs(s.psi) / RAD); });
  dump('backpedal psi at 120', most);
  assert.ok(most <= STEER.backMax + 0.5, `a backpedal 60 degrees off straight back turns the hips ${most.toFixed(1)} degrees (at most ${STEER.backMax})`);
});

// ---------------------------------------------------------------- DOC-6: the carry ---------------------------------

test('AUDIT BODY-MOTION DOC-6 THE FISTS\' GUARD, THE PAIR\'S LEAN, THE STANCE\'S FEET: bare hands drawn stand in a guard - both fists up before the chest, the left leading; a pair at a run leans the trunk in further than a single blade (CARRY.dual.runLean); a two-hander\'s stance splits the feet (mutants: AUDIT-BODY-MOTION-fists-no-guard, AUDIT-BODY-MOTION-pair-no-run-lean, AUDIT-BODY-MOTION-stance-feet-unsplit)', () => {
  let m = null;
  pose({ weapon: W.None, shown: true }, 1.5, (mm) => { m = mm; });
  const sh = pt(m, 'bip01 r upperarm')[2], lz = pt(m, 'bip01 l hand')[2], rz = pt(m, 'bip01 r hand')[2];
  dump('fists: shoulder, L, R z', [sh, lz, rz]); dump('fists: L, R forward', [pt(m, 'bip01 l hand')[1], pt(m, 'bip01 r hand')[1]]);
  assert.ok(lz > sh - 0.5 * A && rz > sh - 0.5 * A, `both fists up (${lz.toFixed(1)}, ${rz.toFixed(1)} against the shoulder's ${sh.toFixed(1)})`);
  assert.ok(pt(m, 'bip01 l hand')[1] > pt(m, 'bip01 r hand')[1] + 0.1 * A, 'the left fist leading');
  const lean = (weapon, hands) => {
    let sum = 0, n = 0;
    pose({ weapon, hands, forward: 1, speed: 8.1, running: true }, 2.5, (mm, t) => {
      if (t < 1.5) return;
      const v = sub(pt(mm, 'bip01 neck'), pt(mm, 'bip01 pelvis'));
      sum += Math.atan2(v[1], v[2]) / RAD; n++;
    });
    return sum / n;
  };
  const pair = dump('lean pair', lean(W.LongBladeOneHand, 'dual')), one = dump('lean one', lean(W.LongBladeOneHand, 'single'));
  // (the lean is the chest's, spread up the spine: the neck over the pelvis shows a share of CARRY.dual.runLean)
  assert.ok(pair - one > 1.5, `the pair leans ${(pair - one).toFixed(1)} degrees further in at a run (CARRY.dual.runLean ${CARRY.dual.runLean})`);
  const split = (weapon) => { let m2 = null; pose({ weapon }, 2.5, (mm) => { m2 = mm; }); return pt(m2, 'bip01 l foot')[1] - pt(m2, 'bip01 r foot')[1]; };
  const two = dump('split two', split(W.LongBladeTwoHand)), free = dump('split free', split(W.None));
  assert.ok(Math.abs(two - free) > 0.08 * L, `a two-hander's stance splits the feet ${(two - free).toFixed(1)} units fore and aft`);
});

// ---------------------------------------------------------------- DOC-7: the blows ---------------------------------

test('AUDIT BODY-MOTION DOC-7 THE BLOW\'S BODY: the hips lead the blow, the weight shifts forward and drops, a one-hander\'s free arm swings as its counterweight, and the strength the release reads scales the body\'s wind (mutants: AUDIT-BODY-MOTION-blow-hips-no-lead, AUDIT-BODY-MOTION-blow-no-weight-shift, AUDIT-BODY-MOTION-blow-free-arm-limp, AUDIT-BODY-MOTION-strength-wind-ignored)', () => {
  const scene = { weapon: W.LongBladeOneHand, hands: 'single' };
  let rest = null;
  pose(scene, 1.5, (mm) => { rest = { hip: yawOf(sub(pt(mm, 'bip01 r thigh'), pt(mm, 'bip01 l thigh'))), at: pt(mm, 'bip01 pelvis'), free: pt(mm, 'bip01 l hand') }; });
  // the free arm in the chest's own frame (its hand off its shoulder): the trunk's turn carries a limp arm with it
  const inChest = (mm) => { const R = turnOf(mm, sk.byName.get('bip01 spine2')), v = sub(pt(mm, 'bip01 l hand'), pt(mm, 'bip01 l upperarm')); return [0, 1, 2].map((c) => R[c] * v[0] + R[3 + c] * v[1] + R[6 + c] * v[2]); };
  let restArm = null;
  pose(scene, 1.5, (mm) => { restArm = inChest(mm); });
  let hipTurn = 0, ahead = 0, drop = 0, free = 0, thrown = 0;
  blow(scene, { type: 'slash' }, (mm) => {
    const v = inChest(mm);
    thrown = Math.max(thrown, Math.acos(Math.max(-1, Math.min(1, dot(v, restArm) / len(v) / len(restArm)))) / RAD);
    hipTurn = Math.max(hipTurn, Math.abs(wrapDeg(yawOf(sub(pt(mm, 'bip01 r thigh'), pt(mm, 'bip01 l thigh'))) - rest.hip)));
    const p = pt(mm, 'bip01 pelvis');
    ahead = Math.max(ahead, p[1] - rest.at[1]); drop = Math.max(drop, rest.at[2] - p[2]);
    free = Math.max(free, len(sub(pt(mm, 'bip01 l hand'), rest.free)));
  });
  dump('hips turn', hipTurn); dump('shift ahead', ahead); dump('drop', drop); dump('free arm', free); dump('free arm thrown in the chest', thrown);
  assert.ok(hipTurn > 8, `the hips lead the slash ${hipTurn.toFixed(1)} degrees`);
  assert.ok(ahead > 0.02 * L && drop > 0.01 * L, `the weight forward ${ahead.toFixed(2)} and down ${drop.toFixed(2)} units`);
  assert.ok(free > 0.25 * A && thrown > 20, `the free arm swings ${(free / A).toFixed(2)} arm lengths, thrown ${thrown.toFixed(1)} degrees on the chest`);
  const turnAt = (strength) => {
    let most = 0;
    blow(scene, { type: 'slash', strength }, (mm, f) => {
      if (f.section === 'windup') return;
      const c = sub(pt(mm, 'bip01 r upperarm'), pt(mm, 'bip01 l upperarm'));
      most = Math.max(most, Math.abs(wrapDeg(yawOf(c))));
    });
    return most;
  };
  const weak = dump('chest turn weak', turnAt(0)), full = dump('chest turn full', turnAt(1));
  assert.ok(weak < full * 0.9, `a weak blow's chest turns ${weak.toFixed(1)} degrees, a full one's ${full.toFixed(1)}`);
});

test('AUDIT BODY-MOTION DOC-7 THE FISTS\' BLOWS AND THE CHOP\'S EDGE: a bare-handed blow drives its fist out ahead of the body; a chop leads with its true edge (the Weapon Bone\'s +X) along the blade\'s path into the hit (mutants: AUDIT-BODY-MOTION-fist-blows-dropped, AUDIT-BODY-MOTION-chop-edge-trailing)', () => {
  const scene = { weapon: W.None, shown: true };
  let rest = null;
  pose(scene, 1.5, (mm) => { rest = pt(mm, 'bip01 r hand'); });
  let reach = 0;
  blow(scene, { type: 'thrust' }, (mm) => { reach = Math.max(reach, pt(mm, 'bip01 r hand')[1] - rest[1]); });
  dump('fist reach', reach / A);
  assert.ok(reach > 0.3 * A, `the straight drives the fist ${(reach / A).toFixed(2)} arm lengths out`);
  let prev = null, lead = [];
  blow({ weapon: W.LongBladeOneHand, hands: 'single' }, { type: 'chop' }, (mm, f) => {
    const g = pt(mm, 'weapon bone'), b = axisOf(mm, 'weapon bone', 1), tip = [g[0] + b[0] * 60, g[1] + b[1] * 60, g[2] + b[2] * 60];
    if (prev && f.section === 'release') { const v = sub(tip, prev), l = len(v); if (l > 1) lead.push(dot(axisOf(mm, 'weapon bone', 0), [v[0] / l, v[1] / l, v[2] / l])); }
    prev = tip;
  });
  const mean = lead.reduce((a, b) => a + b, 0) / lead.length;
  dump('chop edge lead', mean);
  assert.ok(lead.length > 3 && mean > 0.5, `through the chop's release the edge leads its path (${mean.toFixed(2)})`);
});

// ---------------------------------------------------------------- DOC-8: the solve ---------------------------------

test('AUDIT BODY-MOTION DOC-8 THE LEGS\' SOLVE: each knee bends forward of its hip-to-ankle line, each foot stands turned along the gait\'s own toe (the body turned over a planted foot, it stays as it stood), and over a clip that lifts a collarbone the layer\'s arms stand on the collarbones as they sit on the chest at rest (mutants: AUDIT-BODY-MOTION-knee-backward, AUDIT-BODY-MOTION-foot-unturned, AUDIT-BODY-MOTION-clavicles-left-to-the-clip)', () => {
  let knee = Infinity, toe = 0;
  pose((t) => ({ forward: 1, speed: 3, travel: [0, 0, 3 * t] }), 3, (m, t) => {
    if (t < 1.5) return;
    for (const side of ['l', 'r']) {
      const hip = pt(m, `bip01 ${side} thigh`), k = pt(m, `bip01 ${side} calf`), an = pt(m, `bip01 ${side} foot`);
      const d = sub(an, hip), u = dot(sub(k, hip), d) / dot(d, d), onLine = [hip[0] + d[0] * u, hip[1] + d[1] * u, hip[2] + d[2] * u];
      if (len(sub(k, onLine)) > 2) knee = Math.min(knee, k[1] - onLine[1]);
    }
  });
  dump('knee ahead of the line', knee);
  assert.ok(knee > 0, `every bent knee stands ahead of its leg's line (the least ${knee.toFixed(2)} units)`);
  // the foot along the gait's toe: a body turned 20 degrees over its planted feet (slowly - a turn faster than TURN.rate
  // is a cut, and re-plants them; and under a step's 26) - each foot stays turned as it stood in the world, 20 degrees
  // the other way in the body's frame (its yaw counter-clockwise, as the rig's); left to the leg, it turned with the body
  const m = createBodyMotion();
  pose({ yaw: 0 }, 1.5, null, m);
  let mats = null;
  pose((t) => ({ yaw: Math.min(20, 40 * t) * RAD }), 0.8, (mm) => { mats = mm; }, m);
  for (const side of ['L', 'R']) {
    const B = body.bones[side], ax = body.footAxes[side], R = turnOf(mats, B.foot);
    const fwd = [0, 1, 2].map((r) => R[r * 3] * ax.fwd[0] + R[r * 3 + 1] * ax.fwd[1] + R[r * 3 + 2] * ax.fwd[2]);
    toe = Math.max(toe, Math.abs(wrapDeg(Math.atan2(-fwd[0], fwd[1]) / RAD - 20)));
  }
  dump('foot off its toe', toe);
  assert.ok(toe < 6, `turned over, each foot stays as it stood in the world (the most ${toe.toFixed(1)} degrees off it)`);
  // the collarbones: a clip that lifts the right 15 degrees and drops the left 12 (an attack's own swing of them) - the
  // carry's arms are the layer's, so each collarbone is put back on the chest as it sits at rest
  const ref = (n) => sk.byName.get(n);
  const clipPose = () => {
    const p = new Map();
    const turn = (name, axis, deg) => { const r = ref(name), n = sk.nodes.get(r), b = p.get(r) ?? n.rest; p.set(r, { rotation: mat33Mul(b.rotation, rotAxisAngle(axis, deg * RAD)), translation: b.translation, scale: b.scale }); };
    turn('bip01 r clavicle', [0, 0, 1], 15); turn('bip01 l clavicle', [0, 0, 1], -12);
    return p;
  };
  const onChest = (M, side) => { const a = turnOf(M, ref(`bip01 ${side} clavicle`)), c = turnOf(M, ref('bip01 spine2')); return [0, 1, 2].map((i) => [0, 1, 2].map((j) => c[i] * a[j] + c[3 + i] * a[3 + j] + c[6 + i] * a[6 + j])); };
  const off = (P, Q) => Math.acos(Math.max(-1, Math.min(1, (P[0][0] * Q[0][0] + P[0][1] * Q[0][1] + P[0][2] * Q[0][2] + P[1][0] * Q[1][0] + P[1][1] * Q[1][1] + P[1][2] * Q[1][2] + P[2][0] * Q[2][0] + P[2][1] * Q[2][1] + P[2][2] * Q[2][2] - 1) / 2))) / RAD;
  const rest = sm(sk, new Map(), GRAPH_ROOT);
  const layer = createBodyMotion();
  let M = null;
  for (let i = 0; i < 90; i++) { layer.step(1 / 60, sceneInput({ weapon: W.LongBladeOneHand })); const p = clipPose(); layer.apply(sk, p, GRAPH_ROOT, sm); M = sm(sk, p, GRAPH_ROOT); }
  for (const side of ['l', 'r']) {
    const d = dump(`collarbone ${side} off its rest on the chest`, off(onChest(M, side), onChest(rest, side)));
    assert.ok(d < 1, `the ${side} collarbone ${d.toFixed(2)} degrees off its rest on the chest`);
  }
});

// ---------------------------------------------------------------- DOC-9: stepping aside -----------------------------

test('AUDIT BODY-MOTION DOC-9 THE LAYER STEPS ASIDE: the whole body is the clip\'s while busy (dead, a recoil, a climb, a seat - a saddle a seat), off the ground, in the water or levitating; a bow keeps the legs the layer\'s (mutants: AUDIT-BODY-MOTION-busy-ignored, AUDIT-BODY-MOTION-air-ignored, AUDIT-BODY-MOTION-water-levitation-ignored, AUDIT-BODY-MOTION-saddle-not-busy, AUDIT-BODY-MOTION-bow-takes-the-whole-body)', () => {
  const weightAfter = (frame) => { const m = createBodyMotion(); pose({ forward: 1, speed: 3 }, 1, null, m); for (let i = 0; i < 40; i++) m.step(1 / 60, { ...sceneInput({ forward: 1, speed: 3 }), ...frame }); return m.weight(); };
  for (const [name, frame] of [['dead', { busy: 'dead' }], ['a seat', { busy: 'seat' }], ['the air', { grounded: false }], ['the water', { swimming: true }], ['levitating', { levitating: true }]]) {
    assert.ok(weightAfter(frame) < 0.02, `${name}: the body the clip's`);
  }
  assert.ok(weightAfter({ mwType: W.MarksmanBow, shown: true }) > 0.98, 'a bow: the legs still the layer\'s');
  const rig = { ok: true, settingsSkeleton: 'meshes/base_anim.nif', mwType: W.None };
  assert.equal(motionWord({ cam: { yaw: 0, move: {}, saddle: { horse: 1 } }, third: true, rig }).busy, 'seat', 'a saddle: a seat');
});

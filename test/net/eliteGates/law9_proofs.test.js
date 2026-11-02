// THE ASCENT (LAW 9, 2026-10-16, Mac: "Something that isnt just a straight line from point A to point B";
// bible/11-Multiplayer/Elite-Gates-Ascent.md section 6): THE ROUTE'S PROOFS (net/eliteGates/egRouteProof.js - the links' law; net/
// egSpanLaw.js - THE MEDIAN, THE FAST BUILD's bound and the course's end over THE ROUTE) and THE SWEEP'S PILOT along it
// (tools/egSpanSolve.mjs sweepRoute). The climbing motor's numbers held equal to player/parkour.js and player/motor.js; the
// grip's arithmetic pinned and held to the real climbing motor (a pitch the proof passes the motor climbs at Climbing 0 with
// its fatigue spent, one it refuses the motor falls from); a stair timed as the motor runs a slope; THE MEDIAN over a road's
// links (a road twice its fastest refused, the same course after a long walk proven, a side way never asked); laws 4-8
// answering exactly as before over the law pin's halls; the pilot walking synthetic LAW 9 halls (tools/lib/egLaw9Synth.mjs)
// to their doors - turning, taking stairs, climbing, dropping, crossing courses - and falling from a pitch past the grip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egRouted, egRouteLegs, egRouteRoads, egRouteClimbOf, egClimbPitches, egClimbGrip, egPitchWallS, egLegSeconds, egLegRefusal, egRouteSpanSteps, egMantleS,
  EG_ROUTE_PROOF_LAW, EG_CLIMB_MPS, EG_CLIMB_HANG_M, EG_CLIMB_START_S, EG_GRIP_S, EG_GRIP_REGEN_S, EG_GRIP_SLACK_S, EG_CLIMB_LEDGE_MIN_M, EG_FAST_CLIMB_X,
  EG_ROUTE_FALL_MAX_M, EG_ROUTE_STAIR_MAX, EG_STAIR_DOWN_X, EG_ROUTE_COURSE_SIDE_M } from '../../../src/net/eliteGates/egRouteProof.js';
import { egSpanProof, egRouteCross, egRouteCrossAt, egRouteSolved, egRoadCross, egFastCross, egFastCrossAt, egCrossMin, egCourseOf, egSpanPairs, courseOf,
  EG_SPAN_RUN_MPS, EG_FAST_RUN_MPS, EG_JUMP_G, EG_CROSS_SLACK, EG_MEDIAN_X, EG_SOLVE_HORIZON_S } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egRouteAlong, egRouteLen } from '../../../src/net/eliteGates/egRoute.js';
import { egCrossMinMs } from '../../../src/net/eliteGates/egFair.js';
import { egHallOf, egSpecForget } from '../../../src/net/eliteGates/egLaw.js';
import { EG_HEIGHT_LAW } from '../../../src/net/eliteGates/egWalkGraph.js';
import { freeClimbSpeed, gripSeconds, freeStartSeconds, mantleDuration, PARKOUR_HANG_DROP, PARKOUR_GRIP_REGEN_S } from '../../../src/player/parkour.js';
import { PlayerMotor, walkSpeed, runSpeed, FALL_DAMAGE_THRESHOLD, GRAVITY } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { egSynth9Hall, egSynth9Give } from '../../../tools/lib/egLaw9Synth.mjs';
import { sweepSeed, sweepCircleOf, sweepStand, sweepRoute, main } from '../../../tools/egSpanSolve.mjs';

const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const quad = (pos, idx, a, b, c, d) => { const k = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); };
const mesh = (build) => { const col = new Collider(() => -Infinity), pos = [], idx = []; build((a, b, c, d) => quad(pos, idx, a, b, c, d)); col.addMesh('f', new Float32Array(pos), new Uint16Array(idx), I4); return col; };
const DT = 1 / 60;
/** THE REAL CLIMBING MOTOR up a face of `pitches` (m - each the next set back `d` m behind a ledge): Speed 10, walked to the
 *  face (its climb the walk's), Climbing 0, fatigue `fatigue` - resting on each ledge until the grip is whole. `{ ok, at, top }`
 *  - when it reached the face's foot and when it stood on top (s). */
function climbOn(pitches, { d = 1.2, fatigue = 0 } = {}) {
  let top = 0;
  const col = mesh((q) => {
    q([-3, 0, -20], [-3, 0, 0], [3, 0, 0], [3, 0, -20]);
    let z = 0;
    pitches.forEach((H, k) => { q([-3, top, z], [-3, top + H, z], [3, top + H, z], [3, top, z]); top += H; const deep = k === pitches.length - 1 ? 10 : d; q([-3, top, z], [-3, top, z + deep], [3, top, z + deep], [3, top, z]); z += deep; });
  });
  const inputs = { climbing: 0, jumping: 0, khajiit: false, enhanced: false, fatigue, load: 0 };
  const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }, { parkour: { enabled: () => true, inputs: () => inputs, tally: () => {}, say: () => {}, hold: null } });
  m.spawn(0, 0.05, -2);
  for (let k = 0; k < 30; k++) m.update(DT, { forward: 0, strafe: 0, run: false, jump: false }, 0, 0);
  let t = 0, at = null;
  for (let k = 0; k < 60 * 60; k++) {
    const rest = m.grounded && m.grip < 1 && m.pos[1] > 0.3;
    m.update(DT, { forward: rest ? 0 : 1, strafe: 0, run: false, jump: false }, 0, 0);
    t += DT;
    if (at == null && m.pos[2] >= -0.36) at = t;
    if (m.grounded && m.pos[1] >= top - 0.05) return { ok: true, at, top: t };
    if (m.grounded && m.pos[1] < 0.05 && t > 6) return { ok: false, at, top: t };
  }
  return { ok: false, at, top: t };
}
/** The real motor at `build` up (or down) a ramp of `rise` over `plan` (m), running: its seconds from its foot to its head. */
function rampOn(rise, plan, { down = false, speed = 10, running = 0 } = {}) {
  const col = mesh((q) => { q([-3, 0, -20], [-3, 0, 0], [3, 0, 0], [3, 0, -20]); q([-3, 0, 0], [-3, rise, plan], [3, rise, plan], [3, 0, 0]); q([-3, rise, plan], [-3, rise, plan + 20], [3, rise, plan + 20], [3, rise, plan]); });
  const m = new PlayerMotor(col, { speed, running, swimming: 30 });
  if (down) m.spawn(0, rise + 0.05, plan + 8); else m.spawn(0, 0.05, -8);
  for (let k = 0; k < 30; k++) m.update(DT, { forward: 0, strafe: 0, run: false, jump: false }, 0, 0);
  let t = 0, t0 = null;
  for (let k = 0; k < 60 * 30; k++) {
    m.update(DT, { forward: 1, strafe: 0, run: true, jump: false }, down ? Math.PI : 0, 0);
    t += DT;
    const z = m.pos[2];
    if (t0 == null && (down ? z <= plan : z >= 0)) t0 = t;
    if (down ? z <= 0 : z >= plan) return t - t0;
  }
  return Infinity;
}
/** A HALL OF THE ASCENT'S LAW standing on route `R` alone (metres): its plates at the main way's ends, its climbs and pieces. */
const hall = (R, o = {}) => { const a = R.nodes[R.main[0]], e = R.nodes[R.main[R.main.length - 1]];
  return { v: 9, law: 9, h: 1, x0: 0, kind: 'span', arrive: { x: a[0], y: a[1], z: a[2], r: 5 }, end: { x: e[0], y: e[1], z: e[2], r: 5 }, steps: [], islands: [], climbs: [], route: R, ...o }; };
/** A road of one link of `kind` from `a` to `b` (its walked length in space). */
const one = (a, b, kind, o = {}) => hall({ nodes: [a, b], links: [{ a: 0, b: 1, kind, road: 0, len: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) }], main: [0, 1] }, o);
/** A climb up a face across x at z 0.6 from y0 to y0 + H (its ledges `ledges`, `d` deep), its foot 0.6 m before it. */
const climbHall = (H, ledges = [], d = 1.2, y0 = 0) => one([0, y0, 0], [0, y0 + H, 1 + d * ledges.length], 'climb', { climbs: [{ x0: -2, z0: 0.6, x1: 2, z1: 0.6, y0, y1: y0 + H, ledges, face: [0, -1], d, road: 0 }] });
/** THE RAILS' COURSE (two Rails half a period apart - a median past twice its fastest when nothing is walked about it) along
 *  x `x` from z `z0`, its steps on road `road`; its far island's z. */
function rails(x, z0, road = 0) {
  const P = (phase) => ({ kind: 'rail', gap: 2.4, size: { w: 3, d: 3 }, amp: 2, period: 9, phase });
  const c = courseOf({ road, x, start: { x: 0, y: 0, z: z0, r: 5 }, checkR: 3, toEnd: 0, sections: [{ pieces: [P(0), P(4.5)], check: 2.4 }] });
  const steps = c.steps.map((s) => ({ ...s, after: 0 })), isl = c.checkpoints[1], L = steps[steps.length - 1];
  L.after = isl.z - isl.r - (L.z + L.d / 2);
  return { steps, isl };
}

test('THE ASCENT - THE PROOFS, THE CLIMBING MOTOR\'S NUMBERS (Elite-Gates-Ascent.md section 6; restated for the relay\'s bundle): THE SPAN BUILD\'s free climb is player/parkour.js freeClimbSpeed over Speed 10\'s walk at Climbing 0; the lip held within the hang\'s drop and 4 cm; the start, the grip at Climbing 0 with fatigue spent, its return, the mantle, THE FAST BUILD\'s climb, the billed fall - each the motor\'s own; THE ASCENT\'s law the height law\'s; and the links\' law decides on no transcendental (mutants: the climb at the run; the hang\'s reach without its catch; the grip unspent by fatigue)', () => {
  assert.equal(EG_CLIMB_MPS, freeClimbSpeed(walkSpeed(10), 0), 'parkour.js freeClimbSpeed(walkSpeed(10), 0)');
  assert.ok(Math.abs(EG_CLIMB_MPS - 0.7384) < 1e-4);
  assert.equal(EG_CLIMB_HANG_M, PARKOUR_HANG_DROP + 0.04, 'the free climb holds the lip at its hands');
  assert.equal(EG_CLIMB_START_S, freeStartSeconds(0));
  assert.equal(EG_GRIP_S, gripSeconds(0, 0), 'Climbing 0, fatigue spent');
  assert.ok(Math.abs(EG_GRIP_S - 2.1) < 1e-12);
  assert.equal(EG_GRIP_REGEN_S, PARKOUR_GRIP_REGEN_S);
  for (const rise of [0, 0.5, 1.2, 1.84, 2.5]) for (const s of [0, 30, 100, 140]) assert.ok(Math.abs(egMantleS(rise, s) - mantleDuration(rise, s)) < 1e-12, `the mantle at ${rise} m, ${s}`);
  assert.ok(Math.abs(EG_FAST_RUN_MPS * EG_FAST_CLIMB_X - freeClimbSpeed(EG_FAST_RUN_MPS, 100, true, 1e9)) < 1e-9, 'the fastest climb: the spell, the cap, Climbing 100');
  assert.equal(EG_ROUTE_FALL_MAX_M, FALL_DAMAGE_THRESHOLD);
  assert.equal(EG_JUMP_G, GRAVITY);
  assert.equal(EG_ROUTE_PROOF_LAW, EG_HEIGHT_LAW);
  assert.deepEqual([EG_CLIMB_LEDGE_MIN_M, EG_ROUTE_STAIR_MAX, EG_STAIR_DOWN_X, EG_GRIP_SLACK_S, EG_ROUTE_COURSE_SIDE_M], [0.8, 1, 1.5, 0.1, 4]);
  // one answer on every engine: the links' law and the route's crossing ask no transcendental (section 9's law clock)
  const span = readFileSync('src/net/eliteGates/egSpanLaw.js', 'utf8'), a = span.indexOf('// ── THE ASCENT (LAW 9, 2026-10-16; Elite-Gates-Ascent.md section 6): THE ROUTE\'S CROSSING'), b = span.indexOf(' * THE TIMED SOLVER on a hall\'s course', a);
  assert.ok(a > 0 && b > a);
  for (const src of [readFileSync('src/net/eliteGates/egRouteProof.js', 'utf8'), span.slice(a, b)]) assert.ok(!/Math\.(sin|cos|tan|atan2|hypot|pow|exp|log|cbrt)\s*\(/.test(src), 'no transcendental asked');
});

test('THE ASCENT - THE PROOFS, THE GRIP (section 4: "the grip\'s own arithmetic, parkour.js - pinned"): a pitch is on the wall its height less the hang\'s reach at THE SPAN BUILD\'s climb, and is proven while that is within the grip at Climbing 0 with fatigue spent less its margin - 3.31 m is, 3.33 is not; the pitches between rest ledges each on a fresh grip, a ledge too shallow to stand on resting nobody; and the REAL climbing motor climbs the longest proven pitch and falls from one past it (mutants: no margin; the hang\'s reach climbed; shallow ledges rest; the ledges out of order; a pitch\'s margin ignored)', () => {
  assert.equal(egPitchWallS(2.9), (2.9 - 1.84) / EG_CLIMB_MPS);
  assert.equal(egPitchWallS(1.5), 0, 'a lip at the hands is held from the floor');
  assert.equal(egClimbGrip({ y0: 0, y1: 2.9, ledges: [] }), '');
  assert.equal(egClimbGrip({ y0: 0, y1: 3.31, ledges: [] }), '', 'the longest pitch proven is 3.32 m');
  assert.match(egClimbGrip({ y0: 0, y1: 3.33, ledges: [] }), /a pitch of 3\.33 m holds the wall 2\.02 s, past the grip at Climbing 0 with fatigue spent \(2\.1 s less 0\.1\)/);
  assert.match(egClimbGrip({ y0: 0, y1: 4.5, ledges: [] }), /past the grip/);
  // rest ledges: two pitches on two fresh grips, the same height in one refused; a ledge too shallow to stand on rests nobody
  assert.deepEqual(egClimbPitches({ y0: 1, y1: 6.8, ledges: [3.9], d: 1.2 }).map((v) => +v.toFixed(6)), [2.9, 2.9]);
  assert.equal(egClimbGrip({ y0: 1, y1: 6.8, ledges: [3.9], d: 1.2 }), '');
  assert.match(egClimbGrip({ y0: 1, y1: 6.8, ledges: [], d: 1.2 }), /a pitch of 5\.80 m/);
  assert.match(egClimbGrip({ y0: 1, y1: 6.8, ledges: [3.9], d: 0.6 }), /a pitch of 5\.80 m/, 'a 0.6 m ledge stands nobody: one pitch');
  assert.equal(egClimbGrip({ y0: 1, y1: 6.8, ledges: [3.9], d: EG_CLIMB_LEDGE_MIN_M }), '');
  assert.deepEqual(egClimbPitches({ y0: 0, y1: 6, ledges: [4, 2, 9, 0] }), [2, 2, 2], 'the ledges between, in order');
  assert.equal(egClimbGrip({ y0: 0, y1: 6, ledges: [4, 2] }), '');
  assert.match(egClimbGrip(null), /no face/);
  // ... through the hall's proof: a climb link on the main way
  assert.equal(egSpanProof(climbHall(2.9)).ok, true);
  assert.deepEqual(egSpanProof(climbHall(3.45)).why, ['road 0, link 0: a pitch of 3.45 m holds the wall 2.18 s, past the grip at Climbing 0 with fatigue spent (2.1 s less 0.1)']);
  assert.equal(egSpanProof(climbHall(5.8, [2.9])).ok, true, 'two pitches, a rest ledge between');
  // THE REAL CLIMBING MOTOR at Climbing 0, its fatigue spent, walked to the face: the proof is never generous
  const longest = EG_CLIMB_HANG_M + (EG_GRIP_S - EG_GRIP_SLACK_S) * EG_CLIMB_MPS;
  assert.ok(Math.abs(longest - 3.3168) < 1e-3);
  assert.equal(climbOn([longest]).ok, true, 'the longest proven pitch is climbed');
  assert.equal(climbOn([3.45]).ok, false, 'a pitch the proof refuses: the grip gives');
  assert.equal(climbOn([3.45], { fatigue: 1 }).ok, true, '...which a body rested climbs');
  // and the proof's time for a climb is the motor's: two pitches of 2.9 m, a rest on the ledge between until the grip is back
  const r = climbOn([2.9, 2.9]), legs = egRouteLegs(climbHall(5.8, [2.9]), 0), plan = legs[0].plan;
  const wall = (2.9 - PARKOUR_HANG_DROP - 0.04) / freeClimbSpeed(walkSpeed(10), 0);
  const expect = 2 * (freeStartSeconds(0) + wall + mantleDuration(PARKOUR_HANG_DROP + 0.04, 0)) + (wall / gripSeconds(0, 0)) * PARKOUR_GRIP_REGEN_S;
  assert.ok(Math.abs(egRouteCross(climbHall(5.8, [2.9])).fast - (plan / EG_SPAN_RUN_MPS + expect)) < 1e-9, 'the climb\'s seconds: starts, walls, mantles and the rest');
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.top - r.at - expect) < 0.4, `the motor climbs it in ${(r.top - r.at).toFixed(2)} s, the proof says ${expect.toFixed(2)}`);
  // two climbs a metre apart: the second begun when the grip the first spent is back (the walk between gives some)
  const C1 = { x0: -2, z0: 0.6, x1: 2, z1: 0.6, y0: 0, y1: 2.9, ledges: [], face: [0, -1], d: 1.2, road: 0 }, C2 = { ...C1, z0: 2.6, z1: 2.6, y0: 2.9, y1: 5.8 };
  const two = hall({ nodes: [[0, 0, 0], [0, 2.9, 1], [0, 2.9, 2], [0, 5.8, 3]], links: [{ a: 0, b: 1, kind: 'climb', road: 0, len: 3.9 }, { a: 1, b: 2, kind: 'walk', road: 0, len: 1 }, { a: 2, b: 3, kind: 'climb', road: 0, len: 3.9 }], main: [0, 1, 2, 3] }, { climbs: [C1, C2] });
  const pitch = freeStartSeconds(0) + wall + mantleDuration(PARKOUR_HANG_DROP + 0.04, 0), owed = (wall / gripSeconds(0, 0)) * PARKOUR_GRIP_REGEN_S;
  assert.deepEqual(egRouteLegs(two, 0).map((q) => q.climb), [C1, null, C2]);
  assert.ok(Math.abs(egRouteCross(two).fast - (2 / EG_SPAN_RUN_MPS + 2 * pitch + owed)) < 1e-9, 'the grip owed, less the walk between');
});

test('THE ASCENT - THE PROOFS, A LINK BY ITS KIND (section 6): a stair at the motor\'s own pace on a slope - (plan^2 + rise^2) / (plan x run) up, as the real motor runs a 31-degree ramp to a frame; down its plan at the run and never under its fall, never quicker than the motor; a Drop its plan at the run and never under its fall; a walk at the run; and the links a road may not ask - a stair past 45 degrees, a Drop upward or past the billed fall, a climb downward or faceless, a kind the route does not know (mutants: the stair at the flat run; its fall unheeded; a Drop\'s fall unheeded; each refusal unasked)', () => {
  const up = egRouteCross(one([0, 0, 0], [0, 6, 10], 'stair'));
  assert.ok(Math.abs(up.fast - 136 / (10 * EG_SPAN_RUN_MPS)) < 1e-9 && Math.abs(up.median - up.fast) < 1e-9 && up.n === 0);
  assert.ok(Math.abs(rampOn(6, 10) - up.fast) < 0.05, `the motor runs the ramp in ${rampOn(6, 10).toFixed(3)} s`);
  const down = egRouteCross(one([0, 6, 0], [0, 0, 10], 'stair'));
  assert.ok(Math.abs(down.fast - 10 / EG_SPAN_RUN_MPS) < 1e-9);
  assert.ok(down.fast >= rampOn(6, 10, { down: true }), 'never quicker than the motor down it');
  assert.ok(Math.abs(egRouteCross(one([0, 2, 0], [0, 0, 2], 'stair')).fast - Math.sqrt(0.2)) < 1e-9, 'a steep flight down: its fall');
  assert.ok(Math.abs(egRouteCross(one([0, 4.5, 0], [0, 0, 1], 'drop')).fast - Math.sqrt(0.45)) < 1e-9, 'a Drop: its fall');
  assert.ok(Math.abs(egRouteCross(one([0, 1, 0], [0, 0, 8], 'drop')).fast - 8 / EG_SPAN_RUN_MPS) < 1e-9, 'a Drop run off: its plan at the run');
  assert.ok(Math.abs(egRouteCross(one([0, 0, 0], [12, 0, 5], 'walk')).fast - 13 / EG_SPAN_RUN_MPS) < 1e-9);
  // THE FAST BUILD down a stair: a lower bound under the real fast motor's
  const g = { kind: 'stair', rise: -6, len: Math.hypot(6, 10), plan: 10 };
  assert.ok(egLegSeconds(/** @type {any} */ (g), { run: EG_FAST_RUN_MPS, down: EG_STAIR_DOWN_X, g: EG_JUMP_G }) <= rampOn(6, 10, { down: true, speed: 100, running: 100 }));
  // the links a road may not ask
  const why = (spec) => egSpanProof(spec).why;
  assert.deepEqual(why(one([0, 0, 0], [0, 2, 2], 'stair')), [], '45 degrees');
  assert.deepEqual(why(one([0, 0, 0], [0, 3, 2], 'stair')), ['road 0, link 0: a stair of 3.00 m over 2.00 m, steeper than the motor walks']);
  assert.deepEqual(why(one([0, 0, 0], [0, 2, 2], 'drop')), ['road 0, link 0: a Drop taken upward']);
  assert.deepEqual(why(one([0, 6, 0], [0, 0, 2], 'drop')), ['road 0, link 0: a Drop of 6.00 m, past the 5 m a fall is billed at']);
  assert.deepEqual(why(one([0, 5, 0], [0, 0, 2], 'drop')), []);
  const downClimb = climbHall(2.5);
  downClimb.route = { ...downClimb.route, nodes: [downClimb.route.nodes[1], downClimb.route.nodes[0]] };
  assert.deepEqual(why(downClimb), ['road 0, link 0: a climb taken downward']);
  assert.deepEqual(why(one([0, 0, 0], [0, 0, 4], 'teleport')), ['road 0, link 0: a link of kind \'teleport\'']);
  assert.equal(egLegRefusal(/** @type {any} */ ({ kind: 'bridge', rise: 0 })), '');
});

test('THE ASCENT - THE PROOFS, A CLIMB LINK\'S CLIMB AND A SPAN LINK\'S COURSE (section 6): a climb link names its climb, or takes the face its foot stands at whose foot and lip stand at its ends\' heights (none: refused - no face); a span link\'s course is its road\'s pieces between its ends, on its line, at its heights - never another course\'s beside it, another road\'s, an alcove\'s side way; and two pieces meet only on one course\'s line in a hall of THE ASCENT\'s law, as they always met before it (mutants: the link\'s named climb unread; a climb at another height taken; another line\'s pieces taken; another road\'s taken; a far piece met under law 9; the law gate lost)', () => {
  const C = { x0: -2, z0: 0.6, x1: 2, z1: 0.6, y0: 0, y1: 2.9, ledges: [], face: [0, -1], d: 1.2, road: 0 };
  const far = { ...C, x0: 40, x1: 44 };
  assert.equal(egRouteClimbOf({ climbs: [far, C] }, { kind: 'climb' }, [0, 0, 0], [0, 2.9, 1]), C, 'the face at its foot');
  assert.equal(egRouteClimbOf({ climbs: [far, C] }, { kind: 'climb', climb: 0 }, [0, 0, 0], [0, 2.9, 1]), far, 'the one it names');
  assert.equal(egRouteClimbOf({ climbs: [{ ...C, y0: 3, y1: 5.9 }] }, { kind: 'climb' }, [0, 0, 0], [0, 2.9, 1]), null, 'a face at another height');
  assert.deepEqual(egSpanProof(climbHall(2.9, [], 1.2, 0)).ok, true);
  assert.deepEqual(egSpanProof({ ...climbHall(2.9), climbs: [{ ...C, y0: 3, y1: 5.9 }] }).why, ['road 0, link 0: a climb with no face to climb']);
  // a span link's course
  const s = (x, z, y = 0, road = 0) => ({ i: 0, kind: 'still', x, y, z, w: 3, d: 2.6, gap: 2.6, road });
  const own = [s(0, 10), s(0.5, 20, 2.3)], steps = [...own, s(9, 15), s(0, 15, 0, 1), s(0, 15, 0, 2), s(0, 40), s(0, 15, 12)];
  assert.deepEqual(egRouteSpanSteps({ steps }, [0, 0, 5], [0, 0, 30], 0), own);
  assert.deepEqual(egRouteSpanSteps({ steps }, [0, 0, 5], [0, 0, 30], 1), [steps[3]]);
  assert.deepEqual(egRouteSpanSteps({ steps }, [-6, 0, 0], [6, 0, 30], 0), own, 'the line between its ends: its x at the piece\'s z');
  // two pieces meet only on one line under THE ASCENT's law; before it, as ever
  const a = { kind: 'still', x: 0, y: 0, z: 10, w: 3, d: 2, gap: 2, road: 0 }, b = { kind: 'still', x: 6, y: 0, z: 14, w: 3, d: 2, gap: 2, road: 0 };
  assert.equal(egSpanPairs({ v: 8, steps: [a, b] }).filter((p) => p.a && p.b).length, 1, 'law 8: z meets z');
  assert.equal(egSpanPairs({ v: 9, law: 9, steps: [a, b] }).filter((p) => p.a && p.b).length, 0, 'law 9: 6 m apart across, two courses');
  assert.equal(egSpanPairs({ v: 9, law: 9, steps: [a, { ...b, x: 2 }] }).filter((p) => p.a && p.b).length, 1);
  // a shaft is crossed on its own line: six Rails of another course 20 m across, at its z, are none of its crossing (with
  // them, 20 s - past EG_SHAFT_MAX_S)
  const R = (phase) => ({ kind: 'rail', gap: 2.4, size: { w: 3, d: 3 }, amp: 2, period: 9, phase }), S2 = { kind: 'still', gap: 2.6, size: { w: 3, d: 2.6 } };
  const other = courseOf({ road: 0, x: 20, start: { x: 0, y: 0, z: 0, r: 5 }, checkR: 3, toEnd: 0, sections: [{ pieces: [0, 1, 2, 3, 4, 5].map((k) => R((k % 2) * 4.5)), check: 2.4 }] });
  const rs = other.steps.map((q) => ({ ...q, after: 0 })), shaft = courseOf({ road: 0, x: 0, start: { x: 0, y: 0, z: 0, r: 5 }, checkR: 3, toEnd: 0, sections: [{ pieces: [S2, S2], check: 2.6 }] }).steps.map((q) => ({ ...q, i: q.i + 6, after: 0 }));
  rs[5].after = other.checkpoints[1].z - 3 - (rs[5].z + 1.5); shaft[1].after = 2.6;
  const withShaft = hall({ nodes: [[0, 0, 0], [0, 0, 80]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 80 }], main: [0, 1] }, { steps: [...rs, ...shaft], frags: [{ cls: 'shaft', z0: 1, z1: 79, x: 0, road: 0 }] });
  assert.ok(egRoadCross({ v: 9, steps: [...rs, ...shaft] }, 0).median > 15, 'every piece at its z: past the shaft\'s bound');
  assert.deepEqual(egSpanProof(withShaft).why, [], 'its own line\'s');
});

test('THE ASCENT - THE PROOFS, THE MEDIAN OVER THE ROUTE (section 6: "every road 0 and 1 holds the median within 1.6 times its fastest"): a road that is its links\' times along it - a course of two Rails half a period apart crossed from the moment the way brings a body to it is 2.15 x its fastest when nothing is walked about it, and refused; after 200 m of corridor the same course is proven (the road\'s, not the course\'s, median); on THE FORK\'s other road it is refused for that road; on a side way it is never asked, nor a side way\'s climb past the grip (mutants: the median by z; no wait counted; road 1 always proven; the route\'s gate lost; the links\' refusals unasked)', () => {
  const R0 = rails(0, 0), short = hall({ nodes: [[0, 0, 0], [0, 0, R0.isl.z]], links: [{ a: 0, b: 1, kind: 'span', road: 0, len: R0.isl.z }], main: [0, 1] }, { steps: R0.steps });
  const c = egRouteCross(short, 0);
  assert.equal(c.n, 3, 'its three pairs');
  assert.ok(c.median >= 2 * c.fast, `a road ${(c.median / c.fast).toFixed(2)} x its fastest`);
  assert.deepEqual(egSpanProof(short).why, [`road 0: a median crossing of ${c.median.toFixed(1)} s past ${EG_MEDIAN_X} x its fastest ${c.fast.toFixed(1)} s`]);
  assert.deepEqual(egRouteRoads(short), [0]);
  // the same course after 200 m of corridor: the road's median is the route's
  const R1 = rails(0, 200), long = hall({ nodes: [[0, 0, 0], [0, 0, 200], [0, 0, R1.isl.z]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 200 }, { a: 1, b: 2, kind: 'span', road: 0, len: R1.isl.z - 200 }], main: [0, 1, 2] }, { steps: R1.steps });
  const cl = egRouteCross(long, 0), course = egRoadCross({ v: 9, steps: R1.steps }, 0);
  assert.ok(course.median > 3 * course.fast, 'the course alone: three times its fastest');
  assert.ok(cl.median <= EG_MEDIAN_X * cl.fast && cl.fast >= 200 / EG_SPAN_RUN_MPS, 'the road: within the median');
  assert.equal(egSpanProof(long).ok, true);
  assert.ok(Math.abs(egRouteCrossAt(long, 0, 0) - (200 / EG_SPAN_RUN_MPS + egRouteCrossAt(hall({ ...short.route, nodes: [[0, 0, 200], [0, 0, R1.isl.z]] }, { steps: R1.steps }), 0, 200 / EG_SPAN_RUN_MPS))) < 1e-9, 'a leg waits from the moment the way brings the body to it');
  // THE FORK's other road carrying it: refused for that road; a side way carrying it, and a climb past the grip: never asked
  const L = R0.isl.z, Rf = rails(3, 0, 1), Rs = rails(3, 0, 2);
  const fork = (road, steps, extra = {}) => hall({ nodes: [[0, 0, 0], [0, 0, L], [3, 0, 0], [3, 0, L]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: L }, { a: 0, b: 2, kind: 'walk', road, len: 3 }, { a: 2, b: 3, kind: 'span', road, len: L }, { a: 3, b: 1, kind: 'walk', road, len: 3 }], main: [0, 1] }, { steps, ...extra });
  const F = fork(1, Rf.steps), c1 = egRouteCross(F, 1);
  assert.deepEqual(egRouteRoads(F), [0, 1]);
  assert.deepEqual(egRouteSolved(F, 1).map((q) => q.g.kind), ['walk', 'span', 'walk']);
  assert.deepEqual(egSpanProof(F).why, [`road 1: a median crossing of ${c1.median.toFixed(1)} s past ${EG_MEDIAN_X} x its fastest ${c1.fast.toFixed(1)} s`]);
  const side = fork(2, Rs.steps, { climbs: [{ x0: 2, z0: 1, x1: 4, z1: 1, y0: 0, y1: 7, ledges: [], face: [0, -1], road: 2 }] });
  side.route.nodes.push([3, 7, 2]); side.route.links.push({ a: 2, b: 4, kind: 'climb', road: 2, len: 9 });
  assert.deepEqual(egRouteRoads(side), [0]);
  assert.deepEqual(egSpanProof(side).why, [], 'a side way is never proven nor required');
  // the laws before: the route's crossing is the course's, exactly
  for (const [seed, h, law] of [[77, 7, 8], [3, 12, 7], [12345, 21, 5], [0xbeef, 4, 4]]) { const spec = egHallOf(seed, h, h % 9, law); assert.deepEqual(egRouteCross(spec, 0), egRoadCross(spec, 0)); assert.deepEqual(egRouteCross(spec, 1), egRoadCross(spec, 1)); assert.equal(egRouted(spec), false); }
  assert.equal(egRouted(short), true);
  assert.equal(egRouted({ ...short, law: 8, v: 8 }), false, 'a route under the laws before is no route');
});

test('THE ASCENT - THE PROOFS, THE FAST BUILD\'S BOUND AND THE COURSE\'S END OVER THE ROUTE (section 6; net/eliteGates/egFair.js A.cmin): a synthetic LAW 9 hall\'s road crossed at THE FAST BUILD along its links - each at its kind\'s fastest (the run, the fastest climb and the quickest mantle, a stair down at 1.5 x the run), its courses leapt and waited as the fast build crosses a course - never quicker than its legs unwaited, never slower than THE SPAN BUILD; EG_CROSS_MIN its fastest less 15%, the fair trail\'s measure; egCourseOf\'s end the end plate\'s near edge along the road (mutants: a span leg\'s rest unrun; the fast climb the span build\'s; the fast mantle Climbing 0\'s; the route unread at the fast build; the end by z)', () => {
  const spec = egSynth9Hall(7, 3, { band: 2 }), legs = egRouteSolved(spec, 0);
  assert.equal(egRouted(spec), true);
  assert.deepEqual(egSpanProof(spec).why, []);
  assert.deepEqual(legs.map((q) => q.g.kind).filter((k) => k !== 'walk'), ['stair', 'climb', 'drop', 'span', 'span']);
  const climb = legs.find((q) => q.g.kind === 'climb'), P = egClimbPitches(climb.g.climb);
  const fastClimb = climb.g.plan / EG_FAST_RUN_MPS + P.reduce((s, H) => s + Math.max(0, H - EG_CLIMB_HANG_M) / (EG_FAST_RUN_MPS * EG_FAST_CLIMB_X) + mantleDuration(0, 100), 0);
  assert.ok(Math.abs(climb.fast - fastClimb) < 1e-12, 'the fast build\'s climb: its fastest pace and mantle, no start, no rest');
  for (const road of [0, 1]) {
    const fast = egFastCross(spec, road), floor = egRouteSolved(spec, road).reduce((s, q) => s + q.fast, 0), span = egRouteCross(spec, road);
    assert.ok(fast >= floor - 1e-9 && fast <= span.fast, `road ${road}: ${floor.toFixed(2)} <= ${fast.toFixed(2)} <= ${span.fast.toFixed(2)}`);
    let best = Infinity;
    for (let q = 0; q < 72; q++) best = Math.min(best, egFastCrossAt(spec, road, (q * EG_SOLVE_HORIZON_S) / 72));
    assert.ok(Math.abs(best - fast) < 1e-9, 'its least over the start phases');
    assert.equal(egCrossMin(spec, road), Math.round(fast * (1 - EG_CROSS_SLACK) * 1000));
    assert.equal(egCrossMinMs(spec, road), egCrossMin(spec, road), 'the fair trail\'s bound');
  }
  assert.ok(egFastCross(spec, 0) > egRouteLen(spec, 0) / EG_FAST_RUN_MPS, 'the route is run, not its z');
  // a course THE FAST BUILD finds no landing on (a gap of 20 m) is its road's legs unwaited - the route's, never its z
  const wide = hall({ nodes: [[0, 0, 0], [30, 0, 0], [30, 0, 40]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 30 }, { a: 1, b: 2, kind: 'span', road: 0, len: 40 }], main: [0, 1, 2] },
    { steps: [{ i: 0, kind: 'still', span: 0, x: 30, y: 0, z: 25, w: 3, d: 2.6, amp: 0, period: 0, phase: 0, beat: 0, gap: 20, road: 0, kit: '', after: 0 }] });
  assert.equal(egFastCrossAt(wide, 0, 0), Infinity);
  assert.ok(Math.abs(egFastCross(wide, 0) - 70 / EG_FAST_RUN_MPS) < 1e-9);
  assert.ok(Math.abs(egCourseOf(spec, 0).end - (egRouteAlong(spec, spec.end, 0) - spec.end.r)) < 1e-12);
  assert.ok(Math.abs(egCourseOf(spec, 0).end - (egRouteLen(spec, 0) - spec.end.r)) < 1e-9, 'the door at the plate\'s middle: the road\'s length less its radius');
  assert.ok(egCourseOf(spec, 0).end > spec.end.z, 'farther than its z - the way turns');
});

test('THE ASCENT - THE PROOFS, LAWS 4-8 EXACTLY AS BEFORE (section 6; Elite-Gates.md section 22\'s law pin): over the law pin\'s halls of laws 4 to 8 - 1,000 of them - every proof answers exactly as it did before THE ASCENT (its digest taken at f7affa3b0): egSpanProof, both roads\' crossings, the courses, THE FAST BUILD\'s crossings and bounds, the chain (mutants: the route\'s gate open to every law; THE MEDIAN taken over a route the laws before have none of)', () => {
  const fnv = (acc, s) => { for (let i = 0; i < s.length; i++) acc = Math.imul(acc ^ s.charCodeAt(i), 0x01000193) >>> 0; return acc; };
  let acc = 0x811c9dc5;
  for (const law of [4, 5, 6, 7, 8]) for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 25; h++) {
    const spec = egHallOf(seed, h, geo, law);
    const c0 = egCourseOf(spec, 0), c1 = egCourseOf(spec, 1);
    const f = spec.end ? [egFastCross(spec, 0), egFastCross(spec, 1), egCrossMin(spec, 0), egCrossMin(spec, 1), egFastCrossAt(spec, 0, 3.3)] : null;
    acc = fnv(acc, JSON.stringify([law, seed, geo, h, egSpanProof(spec), egRoadCross(spec, 0), egRoadCross(spec, 1), c0 && [c0.end, c0.steps.length, c0.checkpoints], c1 && [c1.end, c1.steps.length, c1.checkpoints], f, egSpanPairs(spec).length]));
  }
  assert.equal(acc, 3000125753, 'the proofs of laws 4-8, digested as they stood');
});

test('THE ASCENT - THE SWEEP\'S PILOT ALONG THE ROUTE (section 6: "follows the route\'s main path - turning, taking stairs, climbing"): over a synthetic LAW 9 circle the REAL motor walks every road the route proves from the arrival plate to the door - turning at the landings, running the stair, climbing one pitch and two with a rest on the ledge (Climbing 0, fatigue spent), running off the Drop, crossing the courses pair by pair - while a hall whose pitch the grip refuses (3.45 m, laid unproven) is fallen from on the main way and crossed by its long way round; the tool says it (mutants: the ledge unrested; the climb at a rested grip; a routed road unswept; the faces unstood)', () => {
  const seed = 5, band = 0, { c, geo } = sweepCircleOf(seed, band);
  try {
    const halls = egSynth9Give(seed, c, geo, band, { 2: { pitches: [345], prove: false }, 3: { pitches: [290, 290] } });
    assert.match(egSpanProof(halls[1]).why.join(), /a pitch of 3\.45 m/);
    assert.deepEqual(egClimbPitches(halls[2].climbs[0]).map((v) => +v.toFixed(6)), [2.9, 2.9]);
    const out = sweepSeed(seed, band);
    assert.equal(out.length, 10, 'five halls, both roads each');
    for (const r of out) {
      if (r.h === halls[1].h && r.road === 0) { assert.equal(r.ok, false); assert.equal(r.step, 'link 6 (climb)'); assert.match(r.why, /fell off the climb/); continue; }
      assert.equal(r.ok, true, `hall ${r.h} road ${r.road}: ${r.step} ${r.why}`);
      assert.ok(r.t > 20 && r.t < 120, `${r.t} s`);
    }
    // the pilot on a road climbs it: the route's highest place reached
    const S = sweepStand(seed, c, geo), spec = S.specs[2];
    let high = -Infinity;
    const r = sweepRoute(S, spec, 0, 1_800_000_000.37, (t, p) => { high = Math.max(high, p.y); });
    S.span.clear();
    assert.equal(r.ok, true);
    assert.ok(high >= spec.climbs[0].y1 - 0.1, 'up the climb');
    // the tool: the synthetic halls swept, a hall read along its route
    const lines = [];
    assert.equal(main(['--sweep', '--law9', '--band', '1', '--seeds', '1'], (l) => lines.push(l)), 0);
    assert.match(lines.at(-1), /every one of 10 courses crossed/);
    const read = [];
    assert.equal(main(['3', '7', '--law9'], (l) => read.push(l)), 0);
    assert.ok(read.some((l) => /road 0 along the route/.test(l)) && read.some((l) => /climb .* pitches/.test(l)) && read.some((l) => /the fast build/.test(l)));
  } finally { egSpecForget(); }
});

// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect. Traversing between sections should present a challenge, platforming should be detailed"; bible/11-Multiplayer/
// Elite-Gates-Ascent.md section 2): THE VOID ZONES ENFORCED. LAW 9 lays a VOID ZONE "wherever a fall would skip ahead along the
// route" (net/eliteGates/egAscent.js voidsOf - `spec.voids`), "over which a body is cast back as into the void", and nothing read
// them: in seed 3's hall 27 a step off the 49 m bridge 18.3 m up landed 10.5 m down on bridge 13, the route reading 315 -> 601
// m of 622. Now the screen casts such a fall back to the floor it left (scenes/eliteGates/egSpan.js ride - the void's cost, section
// 8), and the relay's fair trail (net/eliteGates/egFair.js egFairPose) breaks on it, credits nothing past the floor it left until the
// member stands there again, and its census owes the cast-back (net/eliteGates/egBrain.js egPoseIn). One law for both:
// egVoidStep over egVoidCrossed, the zone's footprint read widened by THE SPAN BUILD's step-off reach. Fixtures from the
// producers: the law's own hall, the relay's own room, the real motor on the circle's real collider and the screen's own spans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleOfHall, egSpecForget, egLawSeam, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egRouteAlongAt } from '../../../src/net/eliteGates/egRoute.js';
import { egFairNew, egFairPose, egVoidCrossed, egVoidStep, egStepOffReach, EG_VOID_DROP_M } from '../../../src/net/eliteGates/egFair.js';
import { EG_SPAN_RUN_MPS, EG_JUMP_G, EG_BODY_R } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egBreachNew, egEnter, egStep, egPoseIn } from '../../../src/net/eliteGates/egBrain.js';
import { sweepStand, SWEEP_BUILD } from '../../../tools/egSpanSolve.mjs';
import { PlayerMotor } from '../../../src/player/motor.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';

// PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the audit's skip on spec law 9's hall, named through THE SEAM (law 10 lays
// seed 3's anew), the relay's breach of law 9 with it
egLawSeam(9);
const SEED = 3, HALL = 27;
/** The step off bridge 7's edge (18.3 m up) and where a run off it at THE SPAN BUILD lands, on bridge 13 (7.8 m up) - the
 *  audit's skip (the hall's frame). */
const OFF = [59.6, 18.3, 120.3], LAND = [54.1, 7.8, 119.5];
/** The poses of that skip, every 100 ms from `t0`: along bridge 7's edge toward OFF, off it on a fall at the motor's g carrying
 *  THE SPAN BUILD's run to LAND, then on along bridge 13 to its end - `[t, x, y, z]`. */
function skipPoses(t0) {
  const out = [];
  let t = t0;
  for (let x = OFF[0] + 6; x > OFF[0] + 0.01; x -= 0.5) { out.push([t, x, OFF[1], 120.8]); t += 100; }
  out.push([t, OFF[0], OFF[1], OFF[2]]); t += 100;
  const fall = Math.sqrt((2 * (OFF[1] - LAND[1])) / EG_JUMP_G);
  for (let s = 0.1; s < fall; s += 0.1) { const k = s / fall; out.push([t, OFF[0] + (LAND[0] - OFF[0]) * k, OFF[1] - 0.5 * EG_JUMP_G * s * s, OFF[2] + (LAND[2] - OFF[2]) * k]); t += 100; }
  for (let z = LAND[2]; z <= 129; z += 0.5) { out.push([t, LAND[0], LAND[1], z]); t += 100; }
  return out;
}

test('EG-PERFECT THE VOID ZONES ON THE RELAY (Elite-Gates-Ascent.md section 2): seed 3 hall 27 - a run off bridge 7 (18.3 m up) through its void zone onto bridge 13 skips ~290 m of the route; the fair trail breaks on it (`void`), the census mark is set on the pose it fell into the void, and its furthest fair point stays at the floor it left however far it walks on along the lower bridge - until the cast-back stands it there again; the step-off reach is THE SPAN BUILD\'s run over the fall; a hall with no zones (laws 4-8) reads none (mutants: the zones unread; the reach unwidened; the fall credited; the break never mended)', () => {
  egSpecForget();
  const spec = egHallOf(SEED, HALL, 0);
  assert.equal(spec.law, 9);
  assert.ok(spec.voids.length >= 1, 'the hall lays its zones');
  const a0 = egRouteAlongAt(spec, ...OFF), a1 = egRouteAlongAt(spec, ...LAND);
  assert.ok(a1 - a0 > 250, `the skip the zone stands over: ${a0.toFixed(0)} -> ${a1.toFixed(0)} m of the route`);
  // THE REACH: a run off an edge carries THE SPAN BUILD's run for the fall's time, the capsule beside
  for (const dy of [0, 3, 7.5, 12]) assert.ok(Math.abs(egStepOffReach(dy) - (EG_SPAN_RUN_MPS * Math.sqrt((2 * dy) / EG_JUMP_G) + EG_BODY_R)) < 1e-12);
  assert.ok(Math.abs(egStepOffReach(-1) - EG_BODY_R) < 1e-12, 'no fall, no reach');
  // the first stretch under the zone's top, 3.5 m outside its plan, is read through it widened - never unwidened
  const v = spec.voids[0], over = [OFF[0] - 1.2, v.y1 - 0.05, OFF[2] - 0.1];
  assert.ok(egVoidCrossed(spec, OFF[1], OFF, over), 'the step-off\'s first stretch passes the zone');
  assert.equal(egVoidCrossed({ ...spec, voids: [{ ...v, poly: v.poly.map(([x, z]) => [x - 12, z]) }] }, OFF[1], OFF, over), null, 'a zone 12 m aside is not passed');
  assert.equal(egVoidCrossed(spec, v.y0 - 0.1, OFF, over), null, 'from a floor under the zone\'s foot nothing is skipped');
  // egVoidStep: kept from the pass to the drop's mark, let go by standing
  const P = { v: null };
  assert.equal(egVoidStep(P, spec, OFF[1], OFF, over, false), null, 'passed, not yet the void\'s');
  assert.ok(P.v);
  assert.equal(egVoidStep(P, spec, OFF[1], over, [over[0] - 0.3, OFF[1] - EG_VOID_DROP_M + 0.1, over[2]], false), null);
  assert.equal(egVoidStep(P, spec, OFF[1], [over[0] - 0.3, OFF[1] - 2.9, over[2]], [over[0] - 0.6, OFF[1] - EG_VOID_DROP_M, over[2]], false), v, `${EG_VOID_DROP_M} m under the floor it left: the void's`);
  assert.equal(P.v, null);
  // THE FAIR TRAIL over the skip
  const A = egFairNew(HALL, 0), poses = skipPoses(1_800_000_000_000);
  let hitAt = -1, farOff = null;
  for (const [i, [t, x, y, z]] of poses.entries()) {
    egFairPose(A, spec, { x, y, z }, t);
    if (A.vz && hitAt < 0) hitAt = i;
    if (x === OFF[0] && y === OFF[1]) farOff = A.far;
  }
  const bridge = Math.max(...poses.filter((q) => q[2] === OFF[1]).map(([, x, y, z]) => egRouteAlongAt(spec, x, y, z)));
  assert.ok(farOff != null && Math.abs(farOff - bridge) < 1e-9 && farOff < a1 - 250, `the furthest fair point the bridge's: ${farOff?.toFixed(0)}`);
  assert.ok(hitAt > 0 && poses[hitAt][2] <= OFF[1] - EG_VOID_DROP_M && poses[hitAt][2] > LAND[1], `fell into the void in the air (pose ${hitAt}, ${poses[hitAt]?.[2].toFixed(1)} m up)`);
  assert.equal(A.why, 'void');
  assert.ok(A.brk >= 1, 'the trail broken');
  assert.ok(A.far <= farOff + 1e-9, `walked on along bridge 13 to z 129 (${egRouteAlongAt(spec, LAND[0], LAND[1], 129).toFixed(0)} m of the route): nothing credited past ${farOff.toFixed(0)} (far ${A.far.toFixed(0)})`);
  assert.equal(A.vz, 0, 'the census mark is the falling pose\'s alone');
  // the cast-back stands it on the floor it left: the trail mends and runs on from there
  const t1 = poses[poses.length - 1][0] + 100;
  egFairPose(A, spec, { x: OFF[0], y: OFF[1] + 0.2, z: 120.8 }, t1);
  assert.equal(A.brk, 0, 'mended where it left');
  assert.equal(A.vd, null);
  for (let k = 1; k <= 24; k++) egFairPose(A, spec, { x: OFF[0] + 0.5 * k, y: OFF[1], z: 120.8 }, t1 + 100 * k);
  assert.ok(A.far > farOff, 'and runs on along the way');
  // laws 4-8 lay no zones: nothing is read
  const old = egHallOf(SEED, HALL, 0, 8);
  assert.equal(old.voids, undefined);
  assert.equal(egVoidCrossed(old, OFF[1], OFF, over), null);
  egSpecForget();
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
test('EG-PERFECT THE VOID ZONES IN THE ROOM (section 21\'s census, Elite-Gates-Ascent.md section 2): in the relay\'s own room at seed 3 hall 27 the same skip owes exactly one cast-back, breaks the member\'s trail and leaves its furthest fair point at the bridge it left (mutants: the census deaf to the void; owed every pose of the fall)', () => {
  egSpecForget();
  let s = SEED;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'M0', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  B.egv = 9;
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(SEED, HALL, 0);
  B.h = HALL; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const body = { sub: 'acct-0', sx: spec.x0 + spec.arrive.x, y: spec.arrive.y ?? 0, z: spec.arrive.z, dead: false };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, [{ ...body, at: now }], rng); }
  assert.equal(B.sg, 'trial');
  const m = B.mem['acct-0'];
  m.roseH = HALL;   // a member a recall stood on the bridge (its trail begins where it stands)
  const poses = skipPoses(now + 1000), bridge = Math.max(...poses.filter((q) => q[2] === OFF[1]).map(([, x, y, z]) => egRouteAlongAt(spec, x, y, z)));
  for (const [t, x, y, z] of poses) egPoseIn(B, 'acct-0', { sx: spec.x0 + x, y, z }, t);
  assert.equal(m.cbOwe, 1, 'one cast-back owed for the fall into the void');
  assert.equal(m.fair.why, 'void');
  assert.ok(m.fair.far <= bridge + 1e-9, `nothing credited past the bridge it left (${m.fair.far.toFixed(0)} of ${bridge.toFixed(0)}; bridge 13's end ${egRouteAlongAt(spec, LAND[0], LAND[1], 129).toFixed(0)})`);
  egSpecForget();
});

test('EG-PERFECT THE VOID ZONES ON THE SCREEN (Elite-Gates-Ascent.md section 2, section 8\'s cast-back): the real motor at THE SPAN BUILD run off bridge 7\'s edge in seed 3 hall 27, on the circle\'s real collider and the screen\'s own spans, is cast back by the screen to the bridge it left - never lands on bridge 13 ~290 m further along; walked along the bridge it is never cast (mutants: the screen deaf to the zones; the zone judged after the landing became the cast-back\'s place)', () => {
  egSpecForget();
  const spec = egHallOf(SEED, HALL, 0), S = sweepStand(SEED, egCircleOfHall(HALL), spec.geo ?? 0), X0 = spec.x0, DT = 1 / 60;
  try {
    const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
    const parkour = { enabled: () => true, leap: () => false, inputs: () => ({ climbing: 0, jumping: 0, khajiit: false, enhanced: false, fatigue: 1, load: 0 }), tally: () => {}, say: () => {}, hold: null };
    const me = (m) => { const p = dungeonToRealm(m.pos[0], m.pos[1], m.pos[2]); return [p[0] - X0, p[1], p[2]]; };
    /** run from `from` toward `to` (the hall's frame, on bridge 7) for at most `secs`: the screen's cast-back, or where it stood */
    const run = (from, to, secs, t0) => {
      const m = new PlayerMotor(S.col, SWEEP_BUILD, { parkour }), at = realmToDungeon(X0 + from[0], from[1] + 1, from[2]);
      m.spawn(at[0], at[1], at[2]);
      const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
      let t = t0, left = false;
      for (let k = 0; k < 30; k++) { S.span.ride(t, DT, m, true); m.update(DT, still(), yaw, 0); t += DT; }
      for (let k = 0; k < 60 * secs; k++) {
        const back = S.span.ride(t, DT, m, true);
        if (back) { const q = dungeonToRealm(back[0], back[1], back[2]); return { cast: [q[0] - X0, q[1], q[2]], at: me(m) }; }
        m.update(DT, still({ forward: 1, run: true }), yaw, 0);
        t += DT;
        if (!m.grounded) left = true;
        if (left && m.grounded) return { cast: null, at: me(m), key: m.groundKey };
      }
      return { cast: null, at: me(m), key: m.groundKey };
    };
    // the run off the edge, toward the landing (3 m back from it, inward - the audit's own run)
    const L = Math.hypot(LAND[0] - OFF[0], LAND[2] - OFF[2]), ux = (LAND[0] - OFF[0]) / L, uz = (LAND[2] - OFF[2]) / L;
    const r = run([OFF[0] - ux * 3, OFF[1], OFF[2] - uz * 3], LAND, 6, 1_800_000_000.37);
    assert.ok(r.cast, `cast back by the screen (it stood at ${r.at.map((v) => v.toFixed(1)).join(', ')} on ${r.key})`);
    assert.ok(Math.abs(r.cast[1] - (OFF[1] + 0.2)) < 0.3 && Math.hypot(r.cast[0] - OFF[0], r.cast[2] - OFF[2]) < 3.5, `onto the bridge it left (${r.cast.map((v) => v.toFixed(1)).join(', ')})`);
    assert.ok(r.at[1] > LAND[1] + 0.5, `in the air, before bridge 13 (${r.at[1].toFixed(1)} m up)`);
    // along the bridge: no fall, no cast
    const w = run([40, OFF[1], 122.26], [70, OFF[1], 122.26], 4, 1_800_000_100.37);
    assert.equal(w.cast, null, 'walked along bridge 7: never cast');
    assert.ok(Math.abs(w.at[1] - OFF[1]) < 0.3, 'still on it');
  } finally { S.span.clear(); egSpecForget(); }
});

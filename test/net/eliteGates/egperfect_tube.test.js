// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect. Traversing between sections should present a challenge, platforming should be detailed"; bible/11-Multiplayer/
// Elite-Gates.md section 11.3, THE COLLAPSING TUBE): THE TUBE'S CLOCK IN A ROUTED HALL. Its fall began a fixed EG_TUBE_START_MS
// (18 s) after the hall's wake (net/eliteGates/egFragLaw.js egTubeEdge) - laws 4-8 stood its mouth a straight run from the plate - but
// LAW 9 stands it 34-82 s of walking away along THE ROUTE, so every company found it wholly fallen and the hall could not be
// finished. In a routed hall it now falls from the instant the room records the first fair pose at its mouth (net/eliteGates/
// egBrain.js egPoseIn, `B.tm`), EG_TUBE_MOUTH_S after it, and the stage says that instant to every screen (`tm` - net/wire.js
// egStage, net/eliteGates/egLink.js stageOf, systems/eliteGates/spireKit.js spireWake): the relay's judge (net/eliteGates/egFair.js
// bandFallen) and the screen's segments (scenes/eliteGates/egSpan.js tubeEdgeOf) read one law, egTubeEdgeIn. Laws 4-8 keep their
// clock. Fixtures from the producers: the law's own halls, the relay's own room, its frames through the wire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egTubeCircle, egFirstHallOf, egSpecForget, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egTubeEdge, EG_TUBE_MPS } from '../../../src/net/eliteGates/egFragLaw.js';
import { egRouteSolved, EG_SPAN_RUN_MPS, EG_SET_MARGIN, EG_WAIT_MAX } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egRouteAlongAt } from '../../../src/net/eliteGates/egRoute.js';
import { egRouted } from '../../../src/net/eliteGates/egRouteProof.js';
import { egTubeEdgeIn, egTubeFromMouth, egTubeAtMouth, egFallenAt, egSupportAt, EG_HOLD, EG_TUBE_MOUTH_S, EG_TUBE_MOUTH_M } from '../../../src/net/eliteGates/egFair.js';
import { egBreachNew, egEnter, egStep, egPoseIn, egStateOf, egTubeMouthOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { registerSpireWake, spireWake } from '../../../src/systems/eliteGates/spireKit.js';

const T0 = 1_800_000_000_000;
/** Every Collapsing Tube the law lays in seeds 1..n, under spec law `law` (`{ seed, spec }`). */
function tubeHalls(n, law) {
  const out = [];
  for (let seed = 1; seed <= n; seed++) {
    const c = egTubeCircle(seed);
    if (!c) continue;
    for (let k = 0; k < 5; k++) { const spec = egHallOf(seed, egFirstHallOf(c) + k, 0, law); if (spec.tube) { out.push({ seed, spec }); break; } }
  }
  return out;
}
/** THE SPAN BUILD's fastest arrival at the tube's mouth (s after the wake): THE ROUTE's solved legs walked unwaited up to it
 *  (net/eliteGates/egSpanLaw.js egRouteSolved) - a bound under every arrival a company makes. */
function fastestAtMouth(spec) {
  const T = spec.tube, mouth = egRouteAlongAt(spec, T.x, T.y, T.z0);
  let along = 0, s = 0;
  for (const L of egRouteSolved(spec, 0)) {
    const a = along;
    along += L.g.len;
    if (along >= mouth) return s + L.span * Math.max(0, (mouth - a) / Math.max(1e-6, L.g.len));
    s += L.span;
  }
  return s;
}

test('EG-PERFECT THE COLLAPSING TUBE\'S CLOCK (section 11.3): in every routed hall (spec law 9) THE SPAN BUILD\'s fastest arrival found the tube wholly or mostly fallen on the wake\'s clock - and now finds it standing, and a body running it at THE SPAN BUILD from the trigger\'s reach is never overtaken, the edge reaching each metre no sooner than 1.25 x the runner (the set piece\'s margin, EG_SET_MARGIN); a member one launch behind (EG_WAIT_MAX) keeps that margin from its own arrival; one who stands at the mouth is caught; laws 4-8 keep the wake\'s clock to the byte (mutants: the routed tube on the wake\'s clock; the start under the margin; the start never begun; law 8 moved)', () => {
  assert.ok(Math.abs(EG_TUBE_MOUTH_S - (EG_WAIT_MAX + (EG_SET_MARGIN * EG_TUBE_MOUTH_M) / EG_SPAN_RUN_MPS)) < 1e-12);
  assert.ok(Math.abs(EG_TUBE_MOUTH_S - 4.6856) < 1e-3, `the start: ${EG_TUBE_MOUTH_S} s`);
  assert.equal(EG_TUBE_MOUTH_M, 3);
  const halls = tubeHalls(14, 9);
  assert.ok(halls.length >= 10, `${halls.length} routed tubes`);
  let fallenOld = 0;
  for (const { seed, spec } of halls) {
    const T = spec.tube, hw = T0, at = `seed ${seed} hall ${spec.h}`;
    assert.ok(egRouted(spec) && egTubeFromMouth(spec), `${at}: a routed hall's tube falls from its mouth`);
    const tFast = fastestAtMouth(spec);
    assert.ok(tFast > T.start, `${at}: its mouth ${tFast.toFixed(1)} s of the fastest walking from the plate, past the wake's ${T.start} s`);
    // THE BUG, measured: on the wake's clock the fastest arrival finds the mouth already gone
    if (egTubeEdge(T, tFast * 1000) > T.z0 + 1) fallenOld++;
    // nobody at the mouth yet: the tube stands however long the company takes to come
    assert.equal(egTubeEdgeIn(spec, hw, 0, hw + tFast * 1000 + 600_000), -Infinity, `${at}: standing until the company reaches it`);
    assert.equal(egFallenAt(spec, hw, T.x, T.y, T.z0 + 1, hw + tFast * 1000 + 600_000, 0), false);
    // THE FASTEST ARRIVAL: the room records it at the trigger's reach, EG_TUBE_MOUTH_M short of the mouth
    const tm = hw + Math.round((tFast - EG_TUBE_MOUTH_M / EG_SPAN_RUN_MPS) * 1000);
    assert.equal(egTubeAtMouth(spec, T.x, T.y, T.z0 - EG_TUBE_MOUTH_M + 0.01), true, `${at}: the trigger's reach`);
    assert.equal(egTubeAtMouth(spec, T.x, T.y, T.z0 - EG_TUBE_MOUTH_M - 0.5), false);
    assert.equal(egTubeAtMouth(spec, T.x, T.y + 6, T.z0), false, `${at}: a floor 6 m over the mouth is not at it`);
    assert.equal(egTubeAtMouth(spec, T.x, T.y, T.z0 + 6), true, `${at}: past its mouth, in the tube (THE AUDIT)`);
    assert.equal(egTubeAtMouth(spec, T.x + T.halfW + 0.5, T.y, T.z0 + 6), false, `${at}: beside the tube, not in it`);
    for (let ms = 0; ; ms += 50) {
      const t = tm + ms, z = T.z0 - EG_TUBE_MOUTH_M + (EG_SPAN_RUN_MPS * ms) / 1000;
      if (z > T.z1 - 0.5) break;
      if (z < T.z0 + 0.5) continue;
      assert.equal(egFallenAt(spec, hw, T.x, T.y, z, t, tm), false, `${at}: the runner at z ${z.toFixed(1)} is on standing floor`);
      assert.notEqual(egSupportAt(spec, T.x, T.y, z, t / 1000, false, hw, null, tm), EG_HOLD.none, `${at}: and held there`);
      // THE MARGIN: the edge has not reached the runner's metre at 1.25 x the runner's time from the trigger
      assert.ok(egTubeEdgeIn(spec, hw, tm, tm + EG_SET_MARGIN * ms) <= z + 1e-9, `${at}: the edge 1.25 x behind at z ${z.toFixed(1)}`);
      // ONE LAUNCH BEHIND: a member EG_WAIT_MAX later keeps the margin from its own arrival
      const z2 = T.z0 - EG_TUBE_MOUTH_M + (EG_SPAN_RUN_MPS * (ms - EG_WAIT_MAX * 1000)) / 1000;
      if (z2 >= T.z0) assert.ok(egTubeEdgeIn(spec, hw, tm, tm + EG_WAIT_MAX * 1000 + EG_SET_MARGIN * (ms - EG_WAIT_MAX * 1000)) <= z2 + 1e-9, `${at}: one launch behind at z ${z2.toFixed(1)}`);
    }
    // it does fall: the mouth gone EG_TUBE_MOUTH_S on, the edge running at the tube's own pace - a member who stood there is caught
    assert.equal(egTubeEdgeIn(spec, hw, tm, tm + EG_TUBE_MOUTH_S * 1000 - 1), -Infinity, `${at}: still standing just before its start`);
    assert.ok(Math.abs(egTubeEdgeIn(spec, hw, tm, tm + (EG_TUBE_MOUTH_S + 5) * 1000) - (T.z0 + 5 * EG_TUBE_MPS)) < 1e-6, `${at}: four metres a second from its mouth`);
    assert.equal(egFallenAt(spec, hw, T.x, T.y, T.z0 + 5, tm + (EG_TUBE_MOUTH_S + 2) * 1000, tm), true, `${at}: a member who waited in the mouth is caught`);
  }
  assert.ok(fallenOld >= halls.length - 1, `on the wake's clock ${fallenOld} of ${halls.length} mouths were gone before the fastest arrival`);
  // LAWS 4-8: the wake's clock, the mouth's instant unread
  const old = tubeHalls(14, 8);
  assert.ok(old.length >= 5);
  for (const { spec } of old) {
    assert.equal(egTubeFromMouth(spec), false);
    for (const ms of [0, 17_999, 18_000, 25_000, 40_000]) for (const tm of [0, T0 + 3000]) assert.equal(egTubeEdgeIn(spec, T0, tm, T0 + ms), egTubeEdge(spec.tube, ms), `law 8 at ${ms} ms`);
    assert.equal(egTubeEdgeIn(spec, 0, T0, T0 + 30_000), -Infinity, 'law 8: no wake, no fall');
  }
});

const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };
/** A breach of two at hall `h` of `seed` (spec law 9), its trial woken with the company on the plate. */
function breachAt(seed, h) {
  egSpecForget();
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, y: spec.arrive.y ?? 0, z: spec.arrive.z }]));
  const step = (ms = 250) => { now += ms; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  return { B, spec, step, now: () => now, set: (n) => { now = n; } };
}

test('EG-PERFECT THE TUBE\'S INSTANT FROM THE ROOM TO THE SCREENS (section 11.3): the room records the first fair pose within EG_TUBE_MOUTH_M of a routed hall\'s tube\'s mouth with its wake, the stage says it once (`tm`), the wire keeps it (and drops a forged one, never the stage), the client\'s state and the spans\' wake carry it, and the relay\'s census owes the cast-back of a member caught on the floor it fell from that instant - never from the wake; a hall woken again has no instant (mutants: the instant never said; said every beat; the wire dropping it; the census on the wake\'s clock; the instant kept across a wake)', () => {
  const [{ seed, spec: s9 }] = tubeHalls(14, 9);
  const S = breachAt(seed, s9.h), { B, spec } = S, T = spec.tube;
  assert.ok(egTubeFromMouth(spec), 'the room draws the routed hall');
  const m = B.mem['acct-0'];
  m.roseH = B.h;   // a member a recall stood in the hall (its trail begins where it stands - egPoseIn)
  const sx = (x) => spec.x0 + x, hw = B.hw;
  // two minutes after the wake (the wake's clock felled the whole tube by 38 s): on its floor 5 m in - PIN MOVED (THE AUDIT): a
  // pose past the mouth, in the tube, starts it as one at the mouth does (a pose that skipped the mouth's 3 m left the tube
  // standing for good); the poses on, back toward the mouth, keep its first instant
  let t = hw + 120_000;
  S.set(t);
  egPoseIn(B, 'acct-0', { sx: sx(T.x), y: T.y, z: T.z0 + 5 }, t);
  const first = t;
  assert.equal(egTubeMouthOf(B), first, 'its first fair pose in the tube');
  assert.equal(m.cbOwe ?? 0, 0, 'its floor stands - nobody owes a cast-back');
  for (let z = T.z0 + 4.5; z >= T.z0 + 2; z -= 0.5) { t += 200; egPoseIn(B, 'acct-0', { sx: sx(T.x), y: T.y, z }, t); }
  assert.equal(egTubeMouthOf(B), first, 'kept from its first');
  assert.deepEqual(B.tm, { hw, at: first, said: 0 }, 'kept with its wake, not yet said');
  S.set(t);
  const o1 = S.step(), sg = o1.filter((f) => f.k === 'sg');
  assert.equal(sg.length, 1, 'the stage says it');
  assert.equal(sg[0].tm, first);
  assert.equal(B.tm.said, 1);
  assert.equal(S.step().filter((f) => f.k === 'sg').length, 0, 'once');
  // the wire, the client's state, the spans' wake
  const w = wire(sg[0]);
  assert.equal(w.tm, first, 'the wire keeps it');
  assert.equal(wire({ ...sg[0], tm: -5 }).tm, undefined, 'a forged instant is no instant');
  assert.equal(wire({ ...sg[0], tm: -5 }).sg, 'trial', 'never no stage');
  const st = wire(egStateOf(B, S.now()));
  assert.equal(st.tm, first, 'a screen joining late is told it with the state');
  let E = foldEg(EG_STATE_EMPTY, st, S.now());
  assert.equal(E.tm, first);
  E = foldEg({ ...E, tm: 0 }, w, S.now());
  assert.equal(E.tm, first, 'the stage\'s word carries it');
  registerSpireWake(() => ({ h: E.h | 0, hw: E.hw || 0, tm: E.tm || 0 }));
  try { assert.deepEqual(spireWake(), { h: spec.h, hw, tm: first }); } finally { registerSpireWake(null); }
  // THE CENSUS from that instant: still held before the start, a cast-back owed once the mouth's floor fell under the feet
  for (let z = T.z0 + 2.5; z <= T.z0 + 4; z += 0.5) { t += 200; egPoseIn(B, 'acct-0', { sx: sx(T.x), y: T.y, z }, t); }
  t = first + EG_TUBE_MOUTH_S * 1000 - 400;
  egPoseIn(B, 'acct-0', { sx: sx(T.x), y: T.y, z: T.z0 + 4 }, t);
  assert.equal(m.cbOwe ?? 0, 0, 'standing until its start');
  t = first + (EG_TUBE_MOUTH_S + 2) * 1000;
  egPoseIn(B, 'acct-0', { sx: sx(T.x), y: T.y, z: T.z0 + 4 }, t);
  assert.equal(m.cbOwe, 1, 'caught on the fallen mouth: one cast-back owed');
  // A NEW WAKE: the instant was the last wake's
  B.hw = S.now() + 1000;
  assert.equal(egTubeMouthOf(B), 0, 'a hall woken again starts its tube afresh');
  assert.equal(S.step().find((f) => f.k === 'sg')?.tm, undefined);
  egSpecForget();
});

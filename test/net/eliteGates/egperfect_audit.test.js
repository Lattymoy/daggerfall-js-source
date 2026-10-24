// EG-PERFECT - THE AUDIT (2026-10-18, Mac: "Lets audit this and ensure perfection"; bible/11-Multiplayer/Elite-Gates.md section 31's
// EG-PERFECT audit record): six lanes read the pass - the lords, the halls, the ways' proofs, the relay's judgement, the screen,
// the records - and each finding was reproduced before it was fixed. These pin the relay's and the ways' halves on the real
// producers (the law's own halls, the brain's own breach, THE TIMED SOLVER's own answer); the lords' are in
// test/net/eliteGates/egperfect_lords.test.js (AUDIT A1-A7), the screen's in test/world/eliteGates/egperfect_audit_screen.test.js, the
// halls' in test/net/eliteGates/egperfect_broken.test.js (THE AUDIT'S HALLS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egSpecForget, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egTrialAwaits, egOnTrialGround } from '../../../src/net/eliteGates/egBrain.js';
import { egVoidStep, EG_VOID_DROP_M } from '../../../src/net/eliteGates/egFair.js';
import { egRouteLegs, egRouteRoads, egRouteSpanSteps } from '../../../src/net/eliteGates/egRouteProof.js';
import { egSpanPairs, egSpanBuildOf, egJumpLands, egPendHits, egJumpReach, EG_SPAN_RUN_MPS, EG_JUMP_MPS, EG_JUMP_FWD, EG_JUMP_G, EG_BODY_R, EG_DROP_CM } from '../../../src/net/eliteGates/egSpanLaw.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
/** A breach of one member woken at hall `h` of `seed` under spec law `law`, its member on the arrival plate (`pos` moves it). */
function breachAt(seed, h, law) {
  egSpecForget();
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  B.egv = law;
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0, law);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = { x: spec.arrive.x, y: spec.arrive.y ?? 0, z: spec.arrive.z }, outs = [];
  const step = () => { now += 250; const o = egStep(B, now, [{ sub: 'acct-0', sx: spec.x0 + pos.x, y: pos.y, z: pos.z, dead: false, at: now }], rng); outs.push(...o); return o; };
  for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step();
  return { B, spec, pos, step, outs, now: () => now };
}

test('EG-PERFECT AUDIT R1 A DROP IS NO FALL INTO THE VOID (Elite-Gates-Ascent.md section 2; spec law 10\'s Drops 3 to 4.5 m under their road): every road of halls that lay void zones over a Drop walked as THE SPAN BUILD walks it - a run off each edge under the motor\'s g onto the piece it falls to - meets no zone\'s judgement (egVoidStep: EG_VOID_DROP_M past the deepest Drop); at 3 m a forked span\'s Low Road Drop under its zone was the void\'s and its hall could not be crossed (mutant: the mark at 3 m)', () => {
  assert.ok(EG_VOID_DROP_M >= EG_DROP_CM / 100 + 0.2, `the mark ${EG_VOID_DROP_M} m past the deepest Drop`);
  const V = EG_SPAN_RUN_MPS, G = EG_JUMP_G;
  let hits = 0, passed = 0, zones = 0;
  for (const [seed, h] of [[3, 22], [3, 7], [12, 7], [12, 22], [1, 7]]) {
    const spec = egHallOf(seed, h, 0, 10);
    zones += spec.voids?.length ?? 0;
    for (const road of egRouteRoads(spec)) {
      const P = { v: null };
      let fromY = NaN, last = null;
      const pose = (p, held) => { if (Number.isFinite(fromY) && egVoidStep(P, spec, fromY, last, p, held)) hits++; if (P.v) passed++; if (held) fromY = p[1]; last = p; };
      const run = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (V * 0.1))); for (let i = 1; i <= n; i++) pose([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, a[2] + ((b[2] - a[2]) * i) / n], true); };
      const fall = (a, b) => {
        const T = Math.sqrt((2 * Math.max(0, a[1] - b[1])) / G), d = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(T / 0.1));
        for (let i = 1; i <= n; i++) { const s = (i / n) * T, k = d > 0 ? Math.min(1, (V * s) / d) : 1; pose([a[0] + (b[0] - a[0]) * k, a[1] - 0.5 * G * s * s, a[2] + (b[2] - a[2]) * k], i === n); }
        if (d > V * T) run([a[0] + ((b[0] - a[0]) * V * T) / d, b[1], a[2] + ((b[2] - a[2]) * V * T) / d], b);
      };
      const go = (a, b) => (a[1] - b[1] >= 1 ? fall(a, b) : run(a, b));
      const legs = egRouteLegs(spec, road);
      pose(legs[0].from, true);
      for (const g of legs) {
        if (g.kind === 'climb') { const n = Math.ceil(Math.abs(g.rise) / 0.15); for (let i = 1; i <= n; i++) pose([g.from[0] + ((g.to[0] - g.from[0]) * i) / n, g.from[1] + ((g.to[1] - g.from[1]) * i) / n, g.from[2] + ((g.to[2] - g.from[2]) * i) / n], i === n); continue; }
        if (g.kind === 'drop') { fall(g.from, g.to); continue; }
        if (g.kind === 'span' && g.steps.length) {
          let at = g.from;
          for (const s of [...g.steps].sort((p, q) => Math.hypot(p.x - g.from[0], p.z - g.from[2]) - Math.hypot(q.x - g.from[0], q.z - g.from[2]))) { go(at, [s.x, s.y, s.z]); at = [s.x, s.y, s.z]; }
          go(at, g.to);
          continue;
        }
        run(g.from, g.to);
      }
    }
  }
  assert.ok(zones > 0 && passed > 0, `${zones} zones laid, ${passed} poses past one`);
  assert.equal(hits, 0, 'no route move the void\'s');
});

test('EG-PERFECT AUDIT R2 A SCRIPTORIUM\'S QUIET WAITS FOR ITS COMPANY ON ITS TRIAL\'S GROUND (sections 7 and 8.6; spec law 10 lays its rooms before its trial): its 30 s run from the first member on its trial\'s own ground (egOnTrialGround - its first course that is no broken bridge), never from the wake - it pulled the company before THE SPAN BUILD reached its door; law 9\'s runs from its wake as it did (mutant: the Scriptorium\'s trial awaiting no one)', () => {
  const R = breachAt(7, 8, 10), g = R.spec.route.courses.find((q) => !q.b);
  assert.equal(R.spec.kind, 'scriptorium');
  assert.equal(egTrialAwaits(R.spec), true);
  for (let k = 0; k < 4 * 20; k++) R.step();
  assert.ok(R.B.F.await != null && R.B.F.quietUntil - R.now() === 30_000, 'held whole while the company stands on its plate');
  Object.assign(R.pos, { x: (g.x0 + g.x1) / 2, y: g.y0, z: g.z0 + 1 });
  assert.ok(egOnTrialGround(R.spec, R.pos));
  const on = R.now();
  let door = 0;
  for (let k = 0; k < 4 * 40 && !door; k++) { R.step(); if (R.B.sg !== 'trial') door = R.now(); }
  assert.equal(door - on, 30_000, 'its door 30 s after its ground is stood on');
  const L9 = breachAt(7, 8, 9);
  assert.equal(egTrialAwaits(L9.spec), false);
  let d9 = 0;
  for (let k = 0; k < 4 * 40 && !d9; k++) { L9.step(); if (L9.B.sg !== 'trial') d9 = L9.now(); }
  assert.ok(d9 > 0, 'law 9\'s from its wake');
});

test('EG-PERFECT AUDIT R3 THE DESERTER WAITS WITH ITS TRIAL (section 8.7; spec law 10): while a Rift-Yard\'s trial awaits its company (its clocks held), the Deserter closes no rift for it - it closed them unopposed while the company climbed the rooms, took the cache and opened the door before THE SPAN BUILD reached the court (mutant: the Deserter\'s goal while the trial awaits)', () => {
  const R = breachAt(1, 24, 10);
  assert.equal(R.spec.twist, 'deserter');
  const F = R.B.F;
  assert.ok(F.await != null, 'the trial awaits');
  assert.ok(F.bodies.some((b) => b.role === EG_ROLE.add && b.k !== undefined), 'its legion stood');
  const rifts = () => F.bodies.filter((b) => b.role === EG_ROLE.obj && b.t === 'rift').map((b) => b.hp);
  const hp0 = rifts();
  for (let k = 0; k < 4 * 60; k++) R.step();
  assert.deepEqual(rifts(), hp0, 'every rift whole');
  assert.ok(!R.outs.some((f) => f.k === 'esay' && f.w === 'desertertook'), 'the cache kept');
  assert.equal(R.B.sg, 'trial');
});

test('EG-PERFECT AUDIT R4 A VOID ZONE UNDER THE ARRIVAL PLATE (Elite-Gates-Ascent.md section 2; spec law 10): where a law 10 way runs 5 m and more under its arrival plate, a zone stands over it - a step off the plate\'s edge fell 19.3 m onto the way 166 m along it, credited (mutant: the plate left out of the zones)', () => {
  let under = 0;
  for (const [seed, h] of [[3, 3], [4, 5], [5, 10], [6, 11]]) {
    const s = egHallOf(seed, h, 0, 10), a = s.arrive;
    if ((s.voids ?? []).some((v) => { const xs = v.poly.map((p) => p[0]), zs = v.poly.map((p) => p[1]); return a.x >= Math.min(...xs) && a.x <= Math.max(...xs) && a.z >= Math.min(...zs) && a.z <= Math.max(...zs) && v.y1 <= (a.y ?? 0); })) under++;
  }
  assert.ok(under >= 3, `${under} of 4 plates over the way stand over a zone`);
  // the laws before keep their zones: law 9's plate none
  assert.ok(![[3, 3], [4, 5]].some(([seed, h]) => { const s = egHallOf(seed, h, 0, 9), a = s.arrive; return (s.voids ?? []).some((v) => v.y1 <= (a.y ?? 0) && v.poly.some((p) => Math.hypot(p[0] - a.x, p[1] - a.z) < 1)); }));
});

test('EG-PERFECT AUDIT P1 THE PENDULUM OVER THE BODY\'S OWN FLIGHT (section 10.5; spec law 10\'s flight): a launch THE TIMED SOLVER calls clear of a Pendulum is clear of it - the body\'s middle on the edge and a body\'s radius past it, at the motor\'s run, its feet on the jump\'s arc, at EG_SOLVE_FLIGHT_N even instants - in all but a graze of the launches over law 10\'s Pendulums (the reach\'s path ran the body 27% fast, its feet at the landing\'s height: 7% of the clear launches met the weight) (mutants: the reach\'s path; twelve instants)', () => {
  const B10 = egSpanBuildOf(10);
  let pairs = 0, open = 0, met = 0;
  for (let seed = 1; seed <= 6; seed++) for (const c of [11, 16]) for (let s = 0; s < 5; s++) {
    const spec = egHallOf(seed, egFirstHallOf(c) + s, seed % 9, 10);
    for (const p of egSpanPairs(spec)) {
      if (p.b?.kind !== 'pend') continue;
      pairs++;
      const a = p.a, b = p.b, ay = a ? a.y : b.y, { air } = egJumpReach(b.y - ay), lz = a ? a.z + a.d / 2 : p.edge, v = EG_SPAN_RUN_MPS + EG_JUMP_MPS * EG_JUMP_FWD;
      for (let k = 0; k < 240; k++) {
        const t = k * 0.05;
        if (!egJumpLands(p, t, B10)) continue;
        open++;
        let hit = false;
        for (const d0 of [0, EG_BODY_R]) for (let q = 0; q <= 60 && !hit; q++) { const u = (air * q) / 60; if (egPendHits(b, t + u, b.x, ay + EG_JUMP_MPS * u - 0.5 * EG_JUMP_G * u * u, lz + d0 + v * u)) hit = true; }
        if (hit) met++;
      }
    }
  }
  assert.ok(pairs >= 20 && open > 1000, `${pairs} Pendulum pairs, ${open} clear launches`);
  assert.ok(met / open < 0.02, `${((100 * met) / open).toFixed(2)}% of the clear launches meet the weight`);
});

test('EG-PERFECT AUDIT P2 A LINK READS ITS OWN HEADING\'S PIECES (net/eliteGates/egRouteProof.js egRouteSpanSteps; spec law 10): a link along z takes no piece turned along x standing on its line - a turned piece read in a +z leg\'s frame would stand where it does not (mutant: the z link taking any heading)', () => {
  const steps = [{ i: 0, kind: 'still', x: 0, y: 0, z: 2, w: 3, d: 2.6, road: 0 }, { i: 1, kind: 'still', x: 0.4, y: 0, z: 6, w: 3, d: 2.6, road: 0, hd: 1 }, { i: 2, kind: 'still', x: 0, y: 0, z: 9, w: 3, d: 2.6, road: 0, hd: 2 }];
  assert.deepEqual(egRouteSpanSteps({ steps }, [0, 0, 0], [0, 0, 12]).map((s) => s.i), [0, 2], 'a +z and a -z piece, never the +x');
  assert.deepEqual(egRouteSpanSteps({ steps }, [-4, 0, 6], [6, 0, 6]).map((s) => s.i), [1], 'the x link its own');
});

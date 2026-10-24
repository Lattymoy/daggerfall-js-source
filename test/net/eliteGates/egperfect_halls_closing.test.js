// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect";
// bible/11-Multiplayer/Elite-Gates.md section 7's stages, section 17.1's cache; Elite-Gates-Ascent.md section 1's route) - THE
// CLOSING'S WALK. THE ASCENT (LAW 9) lays a fight hall's door far past its trial's end along the way, and the closing after a
// fight stayed EG_CLOSING_FIGHT_MS (20 s): the door stood out of reach, the hall's cache (taken only in the closing) was lost and
// the pull came first. A door its trial's end opens now closes, in a hall laid as a way, in EG_CLOSING_FIGHT_MS and its way from
// the trial's end to the door at THE SPAN BUILD x EG_CLOSING_WALK_X (net/eliteGates/egBrain.js egClosingMs), said to every screen
// with the stage (its `su`); the audit's repros - seed 1's hall 1 (a Rift-Yard) and hall 4 (a Rampart) - reached at THE ESCAPE
// BUILD inside it, never inside 20 s; laws 4-8 and the doors an arrival opens close as they closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, egAtDoor, EG_SEALED_MS, EG_CLOSING_FIGHT_MS, EG_CLOSING_SPAN_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egDown, egClosingMs, egClosingWalk, egTrialEndAt, EG_CLOSING_WALK_X } from '../../../src/net/eliteGates/egBrain.js';
import { egFairNew } from '../../../src/net/eliteGates/egFair.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { egRouteOf } from '../../../src/net/eliteGates/egRoute.js';
import { egRouteLegs, egLegSeconds, egLegGripOwed, egMantleS, EG_CLIMB_MPS, EG_CLIMB_HANG_M, EG_CLIMB_START_S } from '../../../src/net/eliteGates/egRouteProof.js';
import { egRouteSolved, EG_JUMP_G, EG_WAIT_MAX, EG_SPAN_RUN_MPS } from '../../../src/net/eliteGates/egSpanLaw.js';
import { EG_ESCAPE_MPS } from '../../../src/net/eliteGates/egShape.js';
import { validEgOut } from '../../../src/net/wire.js';

/** THE ESCAPE BUILD on the route's legs (section 10.2: Speed 40, Running 20 - its run; its climb THE SPAN BUILD's own, Climbing
 *  0's, a rest on each ledge and the mantle from the hang's reach - the slower, so the reach proven is the harder). */
const ESCAPE = Object.freeze({ run: EG_ESCAPE_MPS, climb: EG_CLIMB_MPS, start: EG_CLIMB_START_S, rest: true, down: 1, g: EG_JUMP_G, mantle: (H) => egMantleS(Math.min(H, EG_CLIMB_HANG_M), 0) });
/** PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the audit's repros measured on spec law 9's halls, named (law 10 lays seed
 *  1's anew); the sweep over the build's own law. */
const LAW = 9;
/** The trial's own ground: the way's first course that is no broken bridge (THE BROKEN WAY's, spec law 10 - its `b`). */
const trialGround = (spec) => spec.route.courses.find((q) => !q.b);
/**
 * THE ESCAPE BUILD FROM THE TRIAL'S FAR SIDE TO THE DOOR (s), by this pin's own arithmetic: across the trial's course's ground to
 * where the way leaves it (from its box's farthest corner in plan, at the run), then road 0's legs to the door at the build -
 * each by its kind's law, a climb's spent grip waited back after it, a span leg's timed pairs each at EG_WAIT_MAX.
 */
function escapeToDoor(spec) {
  const R = egRouteOf(spec), k0 = egTrialEndAt(spec), e = R.nodes[R.paths[0][k0]], g = trialGround(spec);
  let far = 0;
  for (const x of [g.x0, g.x1]) for (const z of [g.z0, g.z1]) far = Math.max(far, Math.hypot(x - e[0], z - e[2]));
  let t = far / EG_ESCAPE_MPS;
  for (const L of egRouteLegs(spec, 0).slice(k0)) t += egLegSeconds(L, ESCAPE) + egLegGripOwed(L) + (L.kind === 'span' ? L.steps.length * EG_WAIT_MAX : 0);
  return t;
}

test('EG-PERFECT THE CLOSING\'S WALK (sections 7 and 17.1; Elite-Gates-Ascent.md section 1): the audit\'s repros - seed 1\'s hall 1 (a Rift-Yard, its door 244 m along the way past its court) and hall 4 (a Rampart, 192 m past its gate) - close in EG_CLOSING_FIGHT_MS and their way to the door at THE SPAN BUILD x 1.25, ceiled to the second (76 s, 71 s), and THE ESCAPE BUILD reaches the door inside it from the trial\'s far side, never inside the 20 s they had; seed 1\'s hall 3 (a Proving Walk, its second span crossed in the closing) waits each of its six timed pairs EG_WAIT_MAX (154 s); laws 4-8 close in 20 s, a Proving Walk in 45, every span-like door an arrival opens in 45 (mutants: the closing\'s walk dropped; its spare share 1; the trial\'s end at the first node on its course; a pair\'s wait)', () => {
  assert.equal(LAW, 9, 'the law the repros are pinned in');
  assert.equal(EG_CLOSING_WALK_X, 1.25);
  const yard = egHallOf(1, 1, 0, LAW), rampart = egHallOf(1, 4, 0, LAW);
  assert.deepEqual([yard.kind, yard.variant, rampart.kind, rampart.variant], ['yard', 'riftyard', 'rampart', 'siege']);
  // the trial's end: the court's far rim, the walk's end - where the way leaves the course for the door
  assert.deepEqual([egTrialEndAt(yard), egTrialEndAt(rampart)], [46, 1]);
  assert.deepEqual(egRouteOf(yard).nodes[egRouteOf(yard).paths[0][46]], [-84.19, 27.2, 58]);
  assert.deepEqual(egRouteOf(rampart).nodes[egRouteOf(rampart).paths[0][1]], [0, 0, 105]);
  // the walk: THE SPAN BUILD over the way, each leg by its kind's law (a stair at the motor's slope, a Drop its fall, a climb its pitches)
  for (const [spec, s, len] of [[yard, 44.17, 243.9], [rampart, 40.27, 192.3]]) {
    const legs = egRouteSolved(spec, 0).slice(egTrialEndAt(spec));
    assert.equal(+egClosingWalk(spec).toFixed(2), s);
    assert.equal(+legs.reduce((a, L) => a + L.g.len, 0).toFixed(1), len);
    assert.equal(egClosingWalk(spec), legs.reduce((a, L) => a + L.span, 0), 'each leg at THE SPAN BUILD - one climb, no timed pair, no grip waited');
    assert.ok(legs.every((L) => !L.pairs.length) && legs.filter((L) => L.g.kind === 'climb').length === (spec === rampart ? 1 : 0));
  }
  assert.deepEqual([egClosingMs(yard), egClosingMs(rampart)], [76_000, 71_000]);
  // a Proving Walk's door opens at its champion's fall: its second span is crossed in the closing, each timed pair of it waited
  // at EG_WAIT_MAX - the most THE TIMED SOLVER proves a pair asks (its legs in turn, as egClosingWalk adds them)
  const prov = egHallOf(1, 3, 0, LAW), pl = egRouteSolved(prov, 0).slice(egTrialEndAt(prov));
  assert.equal(prov.kind, 'proving');
  assert.deepEqual([pl.reduce((a, L) => a + L.pairs.length, 0), pl.filter((L) => L.g.kind === 'climb').length, EG_WAIT_MAX], [6, 0, 4]);
  assert.equal(egClosingWalk(prov), pl.reduce((a, L) => a + (L.span + L.pairs.length * EG_WAIT_MAX), 0));
  assert.equal(egClosingMs(prov), 154_000);
  assert.equal(egClosingMs(yard), EG_CLOSING_FIGHT_MS + Math.ceil(egClosingWalk(yard) * 1.25) * 1000);
  // THE ESCAPE BUILD reaches the door inside the closing - and never inside the 20 s the halls had (the audit's repro)
  for (const spec of [yard, rampart]) {
    const t = escapeToDoor(spec);
    assert.ok(t * 1000 <= egClosingMs(spec), `${spec.kind}: the escape build at the door in ${t.toFixed(1)} s, inside ${egClosingMs(spec) / 1000} s`);
    assert.ok(t * 1000 > EG_CLOSING_FIGHT_MS, `${spec.kind}: out of reach in the 20 s it had (${t.toFixed(1)} s)`);
  }
  // laws 4-8 close as they closed: a fight's door in 20 s, a Proving Walk's in 45 (its second span), a span's in 45
  for (const law of [4, 6, 8]) for (const h of [1, 2, 3, 4]) {
    const s = egHallOf(1, h, 0, law);
    assert.equal(egClosingMs(s), s.kind === 'yard' || s.kind === 'rampart' ? EG_CLOSING_FIGHT_MS : EG_CLOSING_SPAN_MS, `law ${law} hall ${h} (${s.kind})`);
  }
  // LAW 9: a door an arrival opens (a span, a Deepway, a Brink) - the company stands at it - closes in 45 s
  assert.equal(egHallOf(1, 2, 0, LAW).kind, 'span');
  assert.equal(egClosingMs(egHallOf(1, 2, 0, LAW)), EG_CLOSING_SPAN_MS);
});

test('EG-PERFECT THE CLOSING\'S WALK, OVER THE HALLS (section 7): every hall of seeds 1-2, circles 1-6, whose door its trial\'s end opens - a Rift-Yard, a Rampart, an Athenaeum, a Scriptorium, a Proving Walk\'s champion - closes long enough for THE ESCAPE BUILD to reach its door from the trial\'s far side; the walk is the way past the trial\'s course alone (a Proving Walk\'s second span with it: its door opens at its champion\'s fall); the closing is whole seconds (mutants: the closing\'s walk dropped; the trial\'s end at the first node on its course; the span pairs\' wait)', () => {
  let n = 0;
  const kinds = new Set();
  for (const seed of [1, 2]) for (let c = 1; c <= 6; c++) {
    const plan = egCirclePlan(seed, c);
    for (let sl = 0; sl < 4; sl++) {
      const spec = egHallOf(seed, egFirstHallOf(c) + sl);
      if (!['yard', 'rampart', 'athenaeum', 'scriptorium', 'proving'].includes(spec.kind)) continue;
      assert.equal(plan[sl].kind === spec.kind || spec.kind === 'scriptorium', true);
      n++; kinds.add(spec.kind);
      const ms = egClosingMs(spec), t = escapeToDoor(spec);
      assert.equal(ms % 1000, 0, 'whole seconds');
      assert.ok(t * 1000 <= ms, `seed ${seed} hall ${spec.h} (${spec.kind}): the escape build in ${t.toFixed(1)} s, the closing ${ms / 1000} s`);
      // the trial's end on its course's ground, and nothing of road 0 past it stands on that ground again
      const R = egRouteOf(spec), k0 = egTrialEndAt(spec), g = trialGround(spec), P = R.paths[0];
      const on = (p) => p[0] >= g.x0 - 0.5 && p[0] <= g.x1 + 0.5 && p[2] >= g.z0 - 0.5 && p[2] <= g.z1 + 0.5 && p[1] >= g.y0 - 0.5 && p[1] <= g.y1 + 0.5;
      assert.ok(on(R.nodes[P[k0]]) && P.slice(k0 + 1).every((i) => !on(R.nodes[i])), `seed ${seed} hall ${spec.h}: the trial's end`);
    }
  }
  assert.ok(n >= 20 && ['yard', 'rampart', 'athenaeum', 'proving'].every((k) => kinds.has(k)), `${n} halls, ${[...kinds]}`);
});

const T0 = 1_800_000_000_000;
/** A breach of `n` members on hall `h` of `seed` (law `law`), stepped to its wake (egfrag_relay's rig). */
function at(seed, h, n = 2, law = LAW) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  B.egv = law;
  const clock = { now: T0 + EG_SEALED_MS + 100 };
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, clock.now), null);
  B.h = h; B.sg = 'arrive'; B.wk = clock.now; B.cnt = { left: 1_800_000, at: clock.now }; B.pulledAt = clock.now; B.su = clock.now + 30_000;
  const spec = egHallOf(seed, h, 0, law), pos = {}, frames = [];
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; frames.push(f); } return list; };
  const step = (ms = 250) => { clock.now += ms; return take(egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: clock.now })), rng)); };
  const put = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, clock, pos, frames, step, put, bad: () => bad };
}

test('EG-PERFECT THE CLOSING\'S WALK ON THE RELAY (section 7): seed 1\'s Rift-Yard - its last rift closed, the door opens and the closing runs its walk (76 s), said to every screen with the stage (`su`); 20 s on it still stands; a member who left the court at THE ESCAPE BUILD steps through the door when it reaches it, and the company is pulled at the closing\'s end, never before; a Rampart\'s gate broken the same (71 s); a law 8 breach\'s Rift-Yard closes in 20 s (mutants: the door\'s closing the fight\'s 20 s again)', () => {
  const w = at(1, 1, 2);
  const yard = w.spec;
  for (const o of w.B.F.bodies) if (o.role === EG_ROLE.obj && o.t === 'rift') o.hp = 0;   // the last rift closed
  const e = egRouteOf(yard).nodes[egRouteOf(yard).paths[0][egTrialEndAt(yard)]];
  w.put('acct-0', e[0], e[2]); w.put('acct-1', e[0], e[2]);
  const n0 = w.frames.length;
  w.step();
  assert.equal(w.B.sg, 'closing', 'the door opened');
  assert.equal(w.B.su - w.B.dn, 76_000, 'the closing runs its walk');
  assert.ok(w.frames.slice(n0).some((f) => f.k === 'sg' && f.sg === 'closing' && f.su === w.B.su), 'every screen told the closing\'s end');
  for (const [sub] of Object.entries(w.B.mem)) w.B.mem[sub].fair = { ...egFairNew(1), k: '1:0' };
  // THE ESCAPE BUILD from the trial's end to the door, over the way's legs
  const tEsc = egRouteLegs(yard, 0).slice(egTrialEndAt(yard)).reduce((t, L) => t + egLegSeconds(L, ESCAPE) + egLegGripOwed(L), 0);
  assert.ok(tEsc * 1000 > EG_CLOSING_FIGHT_MS + 250, `the door ${tEsc.toFixed(1)} s off at the escape build`);
  while (w.clock.now < w.B.dn + EG_CLOSING_FIGHT_MS + 250) w.step();
  assert.equal(w.B.sg, 'closing', '20 s on, the closing still stands');
  while (w.clock.now < w.B.dn + Math.ceil(tEsc * 4) * 250) w.step();
  w.put('acct-0', yard.end.x, yard.end.z);
  w.step();
  assert.ok(egAtDoor(yard, yard.end.x, yard.end.z));
  assert.equal(egDown(w.B, 'acct-0', 1, w.pos['acct-0'], w.clock.now), true, 'through the door it reached at the escape build');
  assert.equal(w.B.mem['acct-0'].downH, 1);
  while (w.clock.now < w.B.su - 250) { w.step(); assert.equal(w.B.h, 1, 'never pulled before the closing\'s end'); }
  w.step(); w.step();
  assert.equal(w.B.h, 2, 'pulled at the closing\'s end');
  assert.equal(w.bad(), 0);
  // a Rampart's gate broken: its closing its walk too
  const r = at(1, 4, 1);
  r.B.F.bodies = r.B.F.bodies.filter((b) => !(b.role === EG_ROLE.add && b.k === EG_KIND.bearer));
  r.step();
  assert.equal(r.B.sg, 'closing');
  assert.equal(r.B.su - r.B.dn, 71_000);
  // a law 8 breach's Rift-Yard: the 20 s it had
  const o = at(1, 1, 1, 8);
  for (const q of o.B.F.bodies) if (q.role === EG_ROLE.obj && q.t === 'rift') q.hp = 0;
  o.step();
  assert.equal(o.B.sg, 'closing');
  assert.equal(o.B.su - o.B.dn, EG_CLOSING_FIGHT_MS);
});

// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect";
// bible/11-Multiplayer/Elite-Gates.md section 8.7's Deserter, section 11.2's Honour Horn) - ON THE FIGHT FLOOR. The relay stood
// the Deserter at the fight's bounding disc's near rim (`spec.fight`, whose `r` is half the fight floor's box's diagonal: a court
// disc's R x 1.41) and threw the Clan Pit's Ashfall about the same disc, so the Deserter rose 7-14 m past the court's rim (on the
// bridge in, or off every floor - seed 38's hall 16, seed 46's hall 86) and a fifth to four fifths of the Ashfall's pools fell off
// the Pit. Now the Deserter rises on the fight floor (net/eliteGates/egLaw.js egKeepOnFight, 1 m in) and every pool lands on
// the fight floor under the horn (net/eliteGates/egBrain.js hornStep).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egOnFight, egFightPieceAt, egKeepOnFight, egCirclePlan, egFirstHallOf, EG_SEALED_MS, EG_SPEC } from '../../../src/net/eliteGates/egLaw.js';
import { egFightView, egFeetAt } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egBreachNew, egEnter, egStep, EG_ASHFALL_EVERY_MS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;
/** A breach of `n` members on hall `h` of `seed` (law `law`), stepped to its wake (the closing pin's rig; poses carry `y`). */
/** PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the repros on spec law 9's halls, named (law 10 lays these seeds' halls anew -
 *  its own Deserter halls swept below). */
const LAW = 9;
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
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; frames.push(f); } return list; };
  const step = (ms = 250) => { clock.now += ms; return take(egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, y: pos[sub].y, z: pos[sub].z, dead: false, at: clock.now })), rng)); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, clock, pos, frames, step, bad: () => bad };
}

test('EG-PERFECT THE DESERTER ON THE COURT (section 8.7): in every Deserter hall of seeds 1-60 the spot the relay read - the bounding disc\'s near rim, 3 m in - stands past the court\'s rim, and the Deserter rises on the court 1 m inside its rim at the point nearest it, at the court\'s height, never its gallery; seed 38\'s hall 16 (a hero court and its gallery) and seed 46\'s hall 86 (off every floor) on the relay (mutants: the bounding disc\'s spot again; no inset)', () => {
  const hero = egHallOf(38, 16, 0, LAW), plain = egHallOf(46, 86, 0, LAW);
  assert.deepEqual([hero.twist, hero.kind, plain.twist, plain.kind], ['deserter', 'yard', 'deserter', 'yard']);
  const ys = [...new Set(hero.fl.map((f) => f.y))].sort((a, b) => a - b);
  assert.ok(ys.length >= 2 && ys.at(-1) - ys[0] >= 2.5, `a court and a gallery over it: ${ys}`);
  for (const [seed, h] of [[38, 16], [46, 86]]) {
    const w = at(seed, h, 2), spec = w.spec, lo = Math.min(...spec.fl.map((f) => f.y));
    const old = [spec.fight.x, spec.fight.z - spec.fight.r + 3];
    assert.equal(egOnFight(spec, old[0], old[1], 0, lo), false, `seed ${seed} hall ${h}: the bounding disc's spot stands off the court`);
    const d = w.B.F.bodies.filter((b) => b.role === EG_ROLE.add && b.k === EG_KIND.deserter);
    assert.equal(d.length, 1, 'the Deserter rose');
    assert.equal(d[0].y, lo, 'at the court\'s height');
    assert.ok(egOnFight(spec, d[0].x, d[0].z, -0.95, d[0].y), `seed ${seed} hall ${h}: on the court, a metre in (${d[0].x}, ${d[0].z})`);
    if (seed === 46) {
      // a plain court disc: the point of it 1 m inside its rim nearest the spot (this pin's own arithmetic)
      const c = spec.fl.find((f) => f.t === 'd' && f.y === lo), L = Math.hypot(old[0] - c.x, old[1] - c.z);
      assert.equal(spec.fl.filter((f) => f.y === lo).length, 1);
      // (the wave's first body 0.7 m to -x of its spot - net/eliteGates/egLegion.js egLegionRaise's own)
      assert.deepEqual([d[0].x, d[0].z], [c.x + ((old[0] - c.x) / L) * (c.r - 1) - 0.7, c.z + ((old[1] - c.z) / L) * (c.r - 1)].map((v) => Math.round(v * 100) / 100));
      assert.ok(L - c.r > 10, `the spot ${(L - c.r).toFixed(1)} m past the court's rim`);
    }
    assert.equal(w.bad(), 0);
  }
  // every Deserter hall of seeds 1-60 (eleven): the spot off the court, the Deserter on it
  const halls = [[1, 24], [16, 31], [22, 16], [31, 46], [36, 41], [38, 16], [46, 86], [47, 79], [52, 9], [54, 44], [60, 39]];
  for (const [seed, h] of halls) {
    const spec = egHallOf(seed, h, 0, LAW), lo = Math.min(...spec.fl.map((f) => f.y)), [x, z] = egKeepOnFight(spec, spec.fight.x, spec.fight.z - spec.fight.r + 3, 1);
    assert.equal(spec.twist, 'deserter', `seed ${seed} hall ${h}`);
    assert.equal(egOnFight(spec, spec.fight.x, spec.fight.z - spec.fight.r + 3, 0, lo), false, `seed ${seed} hall ${h}: the spot off the court`);
    assert.ok(egOnFight(spec, x, z, -0.95, lo) && egFeetAt(egFightView(spec), x, z) === lo, `seed ${seed} hall ${h}: kept on the court, at its height`);
  }
  // spec law 10 (the build's): every Deserter hall of seeds 1-30 keeps its Deserter on the court, at its height
  let tens = 0;
  for (let seed = 1; seed <= 30; seed++) for (let c = 1; c <= 20; c++) egCirclePlan(seed, c, EG_SPEC).forEach((p, sl) => {
    if (p.twist !== 'deserter') return;
    const spec = egHallOf(seed, egFirstHallOf(c) + sl, 0, EG_SPEC);
    if (spec.twist !== 'deserter') return;
    tens++;
    const lo = Math.min(...spec.fl.map((f) => f.y)), [x, z] = egKeepOnFight(spec, spec.fight.x, spec.fight.z - spec.fight.r + 3, 1);
    assert.ok(egOnFight(spec, x, z, -0.95, lo) && egFeetAt(egFightView(spec), x, z) === lo, `law 10 seed ${seed} hall ${spec.h}: kept on the court, at its height`);
  });
  assert.ok(tens >= 3, `${tens} law 10 Deserter halls`);
});

test('EG-PERFECT THE ASHFALL IN THE PIT (section 11.2: "the crowd throws fire - Ashfall in the Pit for the rest of the hall"): a foul Honour Horn\'s Ashfall lays its three pools every EG_ASHFALL_EVERY_MS on the fight floor under the horn - a Wellmouth Rift-Yard\'s kit Clan Pit, a Proving Walk\'s hero Clan Pit, a Deepway\'s chamber - never past the Pit\'s rim (the bounding disc threw 23%, 34% and 86% of them off), a disc Pit\'s each whole on it, each at the horn\'s floor (mutants: the bounding disc again, kept or not; a pool not kept)', () => {
  assert.equal(EG_ASHFALL_EVERY_MS, 6000);
  for (const [seed, h, kind] of [[2, 86, 'yard'], [2, 78, 'proving'], [4, 82, 'deepway']]) {
    const w = at(seed, h, 2), spec = w.spec, horn = spec.spots.horn[0], hy = horn.y / 100;
    assert.equal(spec.kind, kind);
    const pit = egFightPieceAt(spec, horn.x, horn.z, 0, hy);
    assert.ok(pit, 'a fight floor under the horn');
    w.B.F.horn.ash = 1; w.B.F.horn.ashAt = w.clock.now;   // the horn fouled: Ashfall for the rest of the hall
    const n0 = w.frames.length;
    for (let k = 0; k < 4 * 60 && w.B.sg === 'trial'; k++) w.step();
    const pools = w.frames.slice(n0).filter((f) => f.k === 'ez' && f.kind === 'burn' && f.el === 'fire' && f.p === 0.06);
    assert.ok(pools.length >= 27, `${kind}: ${pools.length} pools in a minute`);
    for (const f of pools) {
      const [, x, z, r] = f.s;
      assert.equal(r, 3);
      assert.equal(f.y, hy, 'on the horn\'s floor');
      // a disc's pools a metre inside its rim; a hero Pit's on its polygon (kept 1 m in from the edge nearest - its stair's notch
      // may stand nearer)
      assert.ok(egOnFight({ fl: [pit] }, x, z, pit.t === 'd' ? -0.95 : 0), `${kind} seed ${seed} hall ${h}: a pool at (${x}, ${z}) on the Pit`);
      assert.ok(egOnFight(spec, x, z, 0, hy));
      // a disc Pit's every pool whole on it: thrown within its radius less the pool's own about its heart
      if (pit.t === 'd') assert.ok(Math.hypot(x - pit.x, z - pit.z) <= pit.r - 3 + 0.01, `${kind}: the whole pool on the Pit`);
    }
    // the bounding disc the relay read: wider than the Pit (its `r` half the fight floor's box's diagonal)
    assert.ok(spec.fight.r > (pit.t === 'd' ? pit.r : 0) + 3, `${kind}: the bounding disc ${spec.fight.r} m`);
    assert.equal(w.bad(), 0);
  }
});

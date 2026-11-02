// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect";
// bible/11-Multiplayer/Elite-Gates.md section 8.7's Captive: "three chains ... break them all and each member gains a Cantrip";
// Elite-Gates-Ascent.md section 1) - THE CAPTIVE'S CHAINS ABOUT A HERO CHAMBER. LAW 9 lays a hero chamber's three chains about the
// hall's origin line (x 0, the plan's own X taken back), so in a hall whose way turns them aside they hung off every fight floor -
// over a bridge, in the air (seed 40's hall 66, seed 6's hall 22, seed 60's hall 99) - and the relay stood them there. The relay
// now takes the law's three only where each hangs on a fight floor (net/eliteGates/egBrain.js egCaptiveSpots), and else hangs them
// about the chamber's own floor; every hall whose three hang on its floor keeps them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egOnFight, egCirclePlan, egFirstHallOf, egFightPieceAt, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egCaptiveSpots, EG_CHAINS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { egFightView, egGroundAt, egFeetAt } from '../../../src/net/eliteGates/egWalkGraph.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;
/** A breach of `n` members on hall `h` of `seed` (law `law`), stepped to its wake (the closing pin's rig). */
/** PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the hero chambers' repros on spec law 9's halls, named - law 10 hangs a hero
 *  chamber's three at its hero's own line, on its floor (the sweep below, over the build's law). */
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
  const spec = egHallOf(seed, h, 0, law), pos = {};
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  let bad = 0;
  const step = (ms = 250) => { clock.now += ms; for (const f of egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: clock.now })), rng)) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; } };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, bad: () => bad };
}
const lawY = (q) => (Number.isFinite(q.y) ? q.y / 100 : NaN);
/** A polygon's box: its middle and half its narrower side - this pin's own arithmetic. */
const boxOf = (poly) => {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.min(x1 - x0, z1 - z0) / 2, area: (x1 - x0) * (z1 - z0) };
};

test('EG-PERFECT THE CAPTIVE\'S CHAINS ABOUT A HERO CHAMBER (section 8.7): seed 40\'s hall 66 (a Rift-Yard in the Eclipse Vault) and seed 6\'s hall 22 (a Deepway through the Fallen Stacks) - the law\'s three hang off every fight floor at their own height, and the relay hangs three about the chamber\'s court instead (its box\'s middle, a quarter of its narrower side out, at 0, 120 and 240 degrees - the Deepway\'s the court under its chamber\'s spot, the Rift-Yard\'s its widest), each on the court at its height, where the company breaks them (mutants: the law\'s three taken unread; the widest polygon\'s choice; the quarter)', () => {
  for (const [seed, h, kind] of [[40, 66, 'yard'], [6, 22, 'deepway']]) {
    const spec = egHallOf(seed, h, 0, LAW), law = spec.spots.chain;
    assert.deepEqual([spec.kind, spec.twist, law.length], [kind, 'captive', EG_CHAINS]);
    assert.ok(law.every((q) => !egOnFight(spec, q.x, q.z, 0, lawY(q))), `seed ${seed} hall ${h}: the law's three off every fight floor`);
    assert.ok(law.every((q) => Math.abs(q.x) < 7), 'about the hall\'s origin line');
    // the court: the fight polygon under the chamber's spot (the Deepway's), else the hall's widest (the Rift-Yard's)
    const ch = spec.spots.chamber?.[0], polys = spec.fl.filter((f) => f.t === 'p');
    const court = ch ? egFightPieceAt(spec, ch.x, ch.z, 0, lawY(ch)) : polys.reduce((a, f) => (!a || boxOf(f.poly).area > boxOf(a.poly).area ? f : a), null);
    assert.equal(court.t, 'p');
    assert.equal(court.y, Math.min(...polys.map((f) => f.y)), 'the chamber\'s lowest floor - its court');
    const B = boxOf(court.poly), want = [0, 120, 240].map((deg) => [B.x + Math.sin((deg * Math.PI) / 180) * (B.r / 2), B.z + Math.cos((deg * Math.PI) / 180) * (B.r / 2)]);
    const got = egCaptiveSpots(spec);
    assert.deepEqual(got.map((p) => p.map((v) => +v.toFixed(6))), want.map((p) => p.map((v) => +v.toFixed(6))), `seed ${seed} hall ${h}: about the court`);
    // on the relay: three chains on the court at its height
    const w = at(seed, h, 2), chains = w.B.F.bodies.filter((b) => b.role === EG_ROLE.obj && b.t === 'chain');
    assert.equal(chains.length, EG_CHAINS);
    for (const c of chains) {
      assert.equal(c.y, court.y, 'at the court\'s height');
      assert.ok(egOnFight(spec, c.x, c.z, -1, c.y) && egOnFight({ fl: [court] }, c.x, c.z, -1), `seed ${seed} hall ${h}: a chain on the court (${c.x}, ${c.z})`);
    }
    assert.equal(w.bad(), 0);
  }
});

test('EG-PERFECT THE CAPTIVE\'S CHAINS, OVER THE HALLS (section 8.7): every Captive hall of seeds 1-40 hangs its three on the fight ground; where the law\'s three hang on a fight floor (by their height) they are its three, byte for byte, and only where they do not are they refused (mutants: the law\'s three taken unread; refused everywhere)', () => {
  let halls = 0, kept = 0, refused = 0;
  for (let seed = 1; seed <= 40; seed++) for (let c = 1; c <= 20; c++) {
    const p = egCirclePlan(seed, c);
    for (let sl = 0; sl < 4; sl++) {
      if (p[sl].twist !== 'captive') continue;
      const spec = egHallOf(seed, egFirstHallOf(c) + sl);
      if (spec.twist !== 'captive') continue;
      halls++;
      const law = (spec.spots.chain ?? []).slice(0, EG_CHAINS), got = egCaptiveSpots(spec), view = egFightView(spec);
      assert.equal(got.length, EG_CHAINS, `seed ${seed} hall ${spec.h}`);
      assert.ok(got.every(([x, z]) => egGroundAt(view, x, egFeetAt(view, x, z), z, 0.5)), `seed ${seed} hall ${spec.h} (${spec.kind}): each chain on the fight ground`);
      if (law.length < EG_CHAINS) continue;
      if (law.every((q) => egOnFight(spec, q.x, q.z, 0, lawY(q)))) { kept++; assert.deepEqual(got, law.map((q) => [q.x, q.z]), `seed ${seed} hall ${spec.h}: the law's three`); }
      else { refused++; assert.notDeepEqual(got, law.map((q) => [q.x, q.z])); }
    }
  }
  // PIN MOVED (EG-PERFECT, spec law 10): none refused - law 9 refused seed 6's hall 22 and seed 40's hall 66 (the repros above)
  // PIN MOVED (EG-PERFECT's audit: its halls laid again) - 56 the law's three byte for byte (57 before), the rest the relay's own
  assert.deepEqual([halls, kept, refused], [124, 56, 0], 'law 10 hangs every three on its floor');
});

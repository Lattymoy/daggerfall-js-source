// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect";
// bible/11-Multiplayer/Elite-Gates.md section 8.3's Gauntlet: "stand on its plate to silence a pillar's Caster") - THE GAUNTLET'S
// PLATES, AS THE LAW LAYS THEM AND THE RELAY READS THEM. From spec law 8 each pillar's side span is a stair from the walkway's edge
// up onto its top (2 m), and its plate stands 5.5 m out from the walkway's line - 3 m up the stair, never on the pillar (its rim
// 7-15 m out). The relay's read (net/eliteGates/egBrain.js trialStep's Gauntlet) is a pose within EG_TOUCH_M of the plate in plan,
// of any member in the hall (on the fight floor or not): a member on the stair at the plate holds it, at the stair's own height
// there. Audited, nothing to change; pinned so a read by height never takes the stair's plate from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egOnFight, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, EG_SILENCE_MS, EG_TOUCH_M } from '../../../src/net/eliteGates/egBrain.js';
import { egBodyById } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;

test('EG-PERFECT THE GAUNTLET\'S PLATES ON THEIR STAIRS (section 8.3): seed 1\'s hall 66 - each plate 5.5 m out, on its side stair at the stair\'s own height there (0.63 m up a 9.5 m stair), off the pillar and off the fight floor; a lone member standing there EG_SILENCE_MS silences that pillar\'s Caster, and one at the walkway\'s edge (3 m short) never does', () => {
  // PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): law 9's Gauntlet, named - from law 10 a plate stands on its pillar's top
  // (THE BROKEN WAY's fittings - test/net/eliteGates/egperfect_broken.test.js)
  const LAW = 9, spec = egHallOf(1, 66, 0, LAW);
  assert.deepEqual([spec.kind, spec.variant, spec.v], ['rampart', 'gauntlet', 9]);
  assert.equal(EG_TOUCH_M, 2.5);
  for (const p of spec.spots.pillar) {
    const s = Math.sign(p.x), ramp = spec.ramps.find((q) => q.az === p.z && Math.sign(q.bx) === s), pil = spec.discs.find((d) => d.role === 'pillar' && d.x === p.x && d.z === p.z);
    assert.deepEqual(p.plate, [spec.walk.x + s * (spec.walk.halfW + 3), p.z], '5.5 m out from the walkway\'s line');
    assert.ok(ramp && ramp.ax === spec.walk.x + s * spec.walk.halfW && ramp.y0 === 0 && ramp.y1 === pil.y && pil.y === 2, 'a stair from the walkway\'s edge to the pillar\'s top');
    assert.ok(Math.abs(p.plate[0] - pil.x) - pil.r >= 1.5, 'never on the pillar');
    assert.equal(egOnFight(spec, p.plate[0], p.plate[1]), false, 'traversal ground: off the fight floor');
  }
  // the relay: a lone member on the first plate, at the stair's height there
  let seed = 1;
  const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 1, op: T0, co: [['acct-0', 'M0', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  B.egv = LAW;
  let now = T0 + EG_SEALED_MS + 100;
  assert.equal(egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now), null);
  B.h = 66; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  let pos = { x: spec.arrive.x, z: spec.arrive.z, y: 0 }, bad = 0;
  const step = () => { now += 250; for (const f of egStep(B, now, [{ sub: 'acct-0', sx: spec.x0 + pos.x, y: pos.y, z: pos.z, dead: false, at: now }], rng)) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; } };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  const G = B.F.gauntlet, g0 = G[0], ramp = spec.ramps.find((q) => q.az === g0.p.z && Math.sign(q.bx) === Math.sign(g0.p.x));
  assert.equal(G.length, 3, 'two pillars and one for the lone member');
  const caster = egBodyById(B.F, g0.i);
  assert.ok(caster && caster.y === 2, 'its Caster on the pillar\'s top');
  // at the walkway's edge, 3 m short of the plate: never
  pos = { x: spec.walk.x + Math.sign(g0.p.x) * spec.walk.halfW, z: g0.p.z, y: 0 };
  for (let k = 0; k < (EG_SILENCE_MS / 250) * 2; k++) step();
  assert.equal(g0.done, 0, 'the walkway\'s edge holds no plate');
  // on the stair at the plate, at its height there
  const y = +(((g0.p.plate[0] - ramp.ax) / (ramp.bx - ramp.ax)) * ramp.y1).toFixed(2);
  assert.equal(y, 0.63);
  pos = { x: g0.p.plate[0], z: g0.p.plate[1], y };
  for (let k = 0; k <= EG_SILENCE_MS / 250 + 1 && !g0.done; k++) step();
  assert.equal(g0.done, 1, 'silenced from the stair');
  assert.equal(egBodyById(B.F, g0.i), null, 'its Caster gone');
  assert.equal(bad, 0);
});

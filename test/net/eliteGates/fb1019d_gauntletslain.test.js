// FIELD BUGS 2026-10-19d, GAUNTLET-SLAIN (bible/01-Overview/bugs/Field-Bugs-2026-10-19d.md; the Discord: "our run is fucked",
// "can't silence casters after killing them lol") - A CASTER SLAIN IS A CASTER SILENCED. The Gauntlet's door opened only when
// every pillar had been held EG_SILENCE_MS on its plate (net/eliteGates/egBrain.js trialStep's Gauntlet), and no screen marks
// a plate; a company that killed its Casters with blows saw "Casters left" stand where it stood and a door that never gave.
// Now a Caster gone by any hand is its pillar done: the count falls with it, and the last one opens the door.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS, EG_SPEC } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, EG_TOUCH_M } from '../../../src/net/eliteGates/egBrain.js';
import { egBodyById } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;

/** Seed 1's first Gauntlet in the breach's own law, its lone member in its trial on the walkway's line. */
function gauntlet() {
  let h = 1;
  while (!(egHallOf(1, h, 0, EG_SPEC).variant === 'gauntlet')) h++;
  const spec = egHallOf(1, h, 0, EG_SPEC);
  let seed = 1;
  const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 1, op: T0, co: [['acct-0', 'M0', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  assert.equal(egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const S = { B, spec, pos: { x: spec.arrive.x, z: spec.arrive.z, y: 0 }, bad: 0, said: [], q: 1, now: () => now };
  S.step = () => {
    now += 250;
    for (const f of egStep(B, now, [{ sub: 'acct-0', sx: spec.x0 + S.pos.x, y: S.pos.y, z: S.pos.z, dead: false, at: now }], rng)) {
      const { to, ...rest } = f;
      if (!validEgOut(JSON.parse(JSON.stringify(rest)))) S.bad++;
      if (rest.k === 'esay') S.said.push(rest.w);
    }
  };
  /** Blows from the walkway's line at the pillar until its Caster falls (a spell's reach, as a ranged member strikes it). */
  S.slay = (g) => {
    S.pos = { x: spec.walk.x, z: g.p.z, y: 0 };
    for (let k = 0; k < 400 && egBodyById(B.F, g.i); k++) { now += 300; egBlow(B, 'acct-0', { k: 'hit', i: g.i, q: S.q++, d: 400, r: 2 }, { sx: spec.x0 + S.pos.x, y: 0, z: S.pos.z }, now); }
  };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) S.step();
  assert.equal(B.sg, 'trial');
  return S;
}

test('GAUNTLET-SLAIN (Field-Bugs-2026-10-19d): a Caster slain by blows from the walkway, its plate never stood on, is its pillar silenced - the count falls by one and the hall says so; the rest stand', () => {
  const S = gauntlet(), G = S.B.F.gauntlet, g0 = G[0];
  assert.ok(G.length >= 3 && G.every((g) => egBodyById(S.B.F, g.i)), 'every pillar its Caster');
  assert.equal(S.B.F.pg.left ?? G.length, G.length);
  S.slay(g0);
  assert.equal(egBodyById(S.B.F, g0.i), null, 'the Caster slain');
  assert.ok(Math.hypot(S.pos.x - g0.p.plate[0], S.pos.z - g0.p.plate[1]) > EG_TOUCH_M, 'never on its plate');
  S.said.length = 0;
  S.step();
  assert.equal(g0.done, 1, 'its pillar done');
  assert.equal(S.B.F.pg.left, G.length - 1, '"Casters left" falls');
  assert.deepEqual(S.said.filter((w) => w === 'silenced'), ['silenced'], 'said once');
  for (let k = 0; k < 8; k++) S.step();
  assert.deepEqual(S.said.filter((w) => w === 'silenced'), ['silenced'], 'and never again');
  assert.ok(G.slice(1).every((g) => !g.done && egBodyById(S.B.F, g.i)), 'the rest still stand');
  assert.equal(S.B.sg, 'trial');
  assert.equal(S.bad, 0);
});

test('GAUNTLET-SLAIN (Field-Bugs-2026-10-19d): the report\'s run - every Caster killed, no plate stood on - opens the door', () => {
  const S = gauntlet(), G = S.B.F.gauntlet;
  for (const g of G) { S.slay(g); assert.equal(egBodyById(S.B.F, g.i), null, 'slain'); S.step(); }
  assert.ok(G.every((g) => g.done), 'every pillar done');
  assert.equal(S.B.F.pg.left, 0);
  assert.notEqual(S.B.sg, 'trial', 'the door gives');
  assert.equal(S.bad, 0);
});

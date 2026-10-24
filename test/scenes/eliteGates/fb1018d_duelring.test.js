// FIELD BUGS 2026-10-18d - DUEL-RING (Boar, #bug-reports, "Big bugs of the spires", item 1: "Arm master (skeleton boss) ring
// of fire skill is written on the screen, but no visual effects"): THE LAST ARMSMASTER'S RING OF FIRE, DRAWN. The Challenge
// (Elite-Gates.md section 13.3: "a ring of fire (r 6) rises around the two") stood on the relay (`pg.ring`), every screen
// said "A challenge! The ring of fire rises." and kept the motor to its rim (scenes/eliteGates/egClient.js ringKeep) - and
// nothing drew it. At n = 1 no ring rises by the page ("n = 1: no ring and no braziers"), and the same line said one did.
// Pinned on the producers: the court the law lays, the relay's director stepping the Armsmaster to his Challenge, every
// frame through the wire (validEgOut) into a member's state (foldEg), the screen's fight (scenes/eliteGates/egFight.js) and
// its floor plan - the draws the telegraph pass makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight, EG_DUEL_RING_HALF_M } from '../../../src/scenes/eliteGates/egFight.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_STYLE } from '../../../src/render/gate/gateTelegraph.js';
import { lookAt, perspective, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** The first Court of the Last Armsmaster (or `lord`'s) the build's law lays: `{ seed, h, spec }`. */
function armsCourt(lord = 'armsmaster') {
  for (let seed = 1; seed <= 40; seed++) for (let c = 1; c <= 4; c++) {
    const plan = egCirclePlan(seed, c);
    for (let k = 0; k < plan.length; k++) { const spec = egHallOf(seed, egFirstHallOf(c) + k, 0); if (spec.kind === 'court' && spec.lord === lord) return { seed, h: spec.h, spec }; }
  }
  throw new Error(`no ${lord} laid`);
}
/** A company of `n` woken in the Court on the director and stood at its heart; every frame said to acct-0 folded into its
 *  screen's state as the wire carries it. */
function court(n, { lord = 'armsmaster', feetless = false } = {}) {
  const { seed, h, spec } = armsCourt(lord), rng = seeded(seed), co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  const f = spec.fight;
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + f.x, z: f.z - 3, y: f.y };
  const said = [];
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => (feetless ? null : egToDungeon(spec, f.x, f.y ?? 0, f.z - 3)), peerAt: () => null, say: (t) => said.push(t) });
  const eye = egToDungeon(spec, f.x, (f.y ?? 0) + 1.6, f.z - 3);
  const draw = () => { fight.frame(); fight.drawPass(mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500)), lookAt(eye, egToDungeon(spec, f.x, f.y ?? 0, f.z), UP_Y), eye, 1); return { shapes: fight.shapes(), plan: fight.plan() }; };
  const beat = () => { for (const fr of step()) if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now); };
  const fold = (o) => { for (const fr of o) if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now); };
  return { B, spec, said, draw, beat, state: () => E, now: () => now, tick: (ms) => { now += ms; }, fold };
}
/** The ring shapes a frame draws about `R` (`[x, z, r]`): each with whether the floor plan draws it. */
const ringsAt = ({ shapes, plan }, R) => shapes.filter((s) => s.kind === TELEGRAPH_KIND.ring && Math.hypot(s.origin[0] - R[0], s.origin[1] - R[1]) < 1e-6)
  .map((s) => ({ r0: s.r0, r1: s.r1, color: [...s.color], pool: s.pool, style: s.style, drawn: plan.draws.some((d) => d.sh === s) }));

test('DUEL-RING (FIELD BUGS 2026-10-18d): THE RING OF FIRE IS DRAWN - the Last Armsmaster\'s Challenge, called on the relay over a company of two, stands its ring (`pg.ring`, r 6) on the member\'s screen with the whole fight\'s word, and the screen draws it: a band of fire EG_DUEL_RING_HALF_M either side of its rim on the court\'s floor, burning ground\'s pool and fire\'s grain, in the floor plan\'s draws; none before the Challenge, none once the ring falls (mutants: the ring never drawn; its band shut)', () => {
  const C = court(2);
  let before = 0, ring = null;
  for (let k = 0; k < 600 && !ring; k++) {
    C.beat();
    if (k % 4 === 0 && !C.state().fight.pg.ring) before += C.draw().shapes.filter((s) => s.kind === TELEGRAPH_KIND.ring).length;
    if (C.B.F.mem.challenge) for (let j = 0; j < 12 && !C.state().fight.pg.ring; j++) C.beat();   // the whole fight's word, every 2 s
    ring = C.state().fight.pg.ring ?? null;
  }
  assert.ok(ring, 'the Challenge called within 150 s, its ring on my screen');
  assert.deepEqual(ring, C.B.F.pg.ring, 'the relay\'s ring');
  assert.equal(ring[2], 6, 'r 6 (section 13.3)');
  const now = C.draw();
  assert.ok(C.said.includes('A challenge! The ring of fire rises.'), 'its word said');
  assert.equal(before, 0, 'no ring before the Challenge');
  assert.equal(EG_DUEL_RING_HALF_M, 0.5, 'the band half a metre either side of the rim (AUDIT FB1018D L5-9a: pinned as a literal - the band read against itself held at any width)');
  assert.deepEqual(ringsAt(now, ring), [{ r0: 6 - EG_DUEL_RING_HALF_M, r1: 6 + EG_DUEL_RING_HALF_M, color: [1.0, 0.45, 0.1], pool: TELEGRAPH_POOL.ground, style: TELEGRAPH_STYLE.fire, drawn: true }], 'the ring of fire, drawn');
  // it falls: 15 s lasted, or its brazier broken
  for (let k = 0; k < 120 && C.state().fight.pg.ring; k++) C.beat();
  assert.equal(C.state().fight.pg.ring, null, 'the ring fell');
  assert.deepEqual(ringsAt(C.draw(), ring), [], 'and is drawn no more');
});

test('DUEL-RING (FIELD BUGS 2026-10-18d): A COMPANY OF ONE IS TOLD THE OPEN DUEL - at n = 1 the Challenge raises no ring and no brazier (section 13.3), and its word says the duel in the open, never a ring of fire; a company of two still hears the ring rise (mutants: the open duel unsaid; its end unsaid; the two lines swapped; the two ends swapped)', () => {
  const said = (n) => {
    const C = court(n);
    for (let k = 0; k < 600 && !C.B.F.mem.challenge; k++) { C.beat(); if (k % 4 === 0) C.draw(); }
    assert.ok(C.B.F.mem.challenge, `n = ${n}: a Challenge called`);
    C.draw();
    const ring = C.B.F.pg.ring ?? null;
    for (let k = 0; k < 200 && C.B.F.mem.challenge; k++) { C.beat(); if (k % 4 === 0) C.draw(); }   // lasted: nobody strikes him
    assert.equal(C.B.F.mem.challenge, null, `n = ${n}: the Challenge over`);
    C.draw();
    return { ring, said: C.said.filter((s) => /challenge|ring/i.test(s)) };
  };
  assert.deepEqual(said(1), { ring: null, said: ['A challenge in the open! Deal him a tenth of his health within 15 s.', 'The challenge goes unmet.'] }, 'n = 1: the open duel, called and lapsed');
  assert.deepEqual(said(2).said, ['A challenge! The ring of fire rises.', 'The ring falls.'], 'n = 2: the ring, risen and fallen');
});

test('DUEL-RING (AUDIT FB1018D L3-1): THE OPEN DUEL ENDED BY HIS FALL SAYS NOTHING OF ITS OWN - a company of one strikes the Armsmaster down inside his open Challenge: the fall is told, and "The challenge goes unmet." is not (mutant: the fall\'s end of an open duel said as unmet)', () => {
  const C = court(1);
  for (let k = 0; k < 600 && !C.B.F.mem.challenge; k++) { C.beat(); if (k % 4 === 0) C.draw(); }
  assert.ok(C.B.F.mem.challenge, 'the open duel called');
  const L = C.B.F.bodies.find((b) => b.role === EG_ROLE.lord);
  L.hp = 1; L.hpFloor = null;
  C.tick(400);
  C.fold(egBlow(C.B, 'acct-0', { k: 'hit', i: L.i, q: 1, d: Math.ceil(L.max), r: HIT_KINDS.Melee }, { sx: C.spec.x0 + L.x + 1.5, y: L.y, z: L.z }, C.now()));
  for (let k = 0; k < 8; k++) { C.beat(); C.draw(); }
  assert.ok(!(L.hp > 0), 'he fell');
  assert.deepEqual(C.said.filter((s) => /challenge|ring/i.test(s)), ['A challenge in the open! Deal him a tenth of his health within 15 s.'], 'no "unmet" over his fall');
});

test('DUEL-RING (AUDIT FB1018D L3-M2): A MEMBER DOWN STILL SEES THE RING - a member with no feet on the floor (down, watching) is drawn the Challenge\'s ring all the same (mutant: the ring drawn only under feet)', () => {
  const C = court(2, { feetless: true });
  let ring = null;
  for (let k = 0; k < 600 && !ring; k++) {
    C.beat();
    if (C.B.F.mem.challenge) for (let j = 0; j < 12 && !C.state().fight.pg.ring; j++) C.beat();
    ring = C.state().fight.pg.ring ?? null;
  }
  assert.ok(ring, 'the ring on my screen');
  assert.equal(ringsAt(C.draw(), ring).length, 1, 'drawn to a member with no feet');
});

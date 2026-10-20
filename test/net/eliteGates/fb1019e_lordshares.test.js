// FIELD BUGS 2026-10-19e LORD-SHARES (bible/01-Overview/bugs/Field-Bugs-2026-10-19e.md - a company's word on its Elite Breach,
// handed over by the owner: "Felt like he wasnt being damaged" and "It wasn't hard actually. It felt like the moment team died
// difficulty went down"). A lord's health is its fighters' shares (bible/11-Multiplayer/Elite-Gates.md section 13.2), and two
// laws of the shares were the reports: EG-ZQ retired a fallen member's share at its fall, so the moment the company fell the
// lord shed what it held for them - Grath at 17,773 of 25,200 stood at 4,444 of 6,300, the survivor's every blow moved his
// bar four times as far, and a death cost the company nothing against him; and the lords were stood for every living member
// of the breach, in the hall or not, so a company short of a member fought a lord sized for it until its absence became a
// fall, 180 s on, and the lord shed it then. Now a lord is stood for the company on its hall's arrival plate and keeps what the
// fallen leave (net/eliteGates/egLords.js egLordsShare, egLordsStand; net/eliteGates/egBrain.js standFight). Each pin EXECUTES the
// director (egBreachNew, egEnter, egStep, egBlow) on the current spec law and folds every frame it says through the wire's
// validator into the client's own state (net/eliteGates/egLink.js foldEg), as a screen does. On the code before the fix every
// assertion that a share stays, or that a lord is stood for the company on its plate, fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS, EG_ABSENT_TRIAL_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsAwake, egLordsOf, egLordsShare, egTtkRef, EG_PROVE_HP_S } from '../../../src/net/eliteGates/egLords.js';
import { EG_FL, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS, dpsRef } from '../../../src/net/gate/gateBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egLordBars } from '../../../src/ui/eliteGates/egSpireHud.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LV = 30;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/**
 * A company of `n` at level LV entering hall `h` of `seed` (no Proclamation; the circle bearing `dc`), `present` the members
 * whose bodies the room hears (the rest's sockets closed): `step` beats the director over the present bodies (every frame
 * folded into the screen's state `E()`), `wake` beats until the trial, `ring` stands the present in the lord's wake ring until
 * it wakes, `strike` lands a member's swing on a body from beside it, `dead` says a member's death in its pose, `arrive` stands
 * a member's body at the lord's ring (a hall with none, its arrival plate).
 */
function company(seed, h, { n = 4, present = null, dc = [] } = {}) {
  const rng = seeded(seed), co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  present ??= co.map(([sub]) => sub);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  B.dc = dc.map((p) => [...p]);
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), LV, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * 60_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z, y: spec.arrive.y ?? 0 }]));
  const heard = new Set(present), deadOf = {};
  let E = { ...EG_STATE_EMPTY, seed, h, b: B.b };
  const fold = (o) => { for (const f of o) { if (f.to && f.to !== 'acct-0') continue; const w = validEgOut(JSON.parse(JSON.stringify({ t: 'eg', ...f }))); if (w) E = foldEg(E, w, now); } return o; };
  const step = (ms = 250) => { now += ms; return fold(egStep(B, now, [...heard].map((sub) => ({ sub, ...pos[sub], dead: !!deadOf[sub], at: now })), rng)); };
  const wake = () => { for (let k = 0; k < 4 * 60 && B.sg !== 'trial'; k++) step(); assert.equal(B.sg, 'trial', `hall ${h} woke`); };
  const lord = () => egLordsOf(B.F).find((L) => !egHas(L, EG_FL.mirror));
  const stand = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, y }; };
  const ring = () => {
    for (let k = 0; k < 4 * 30 && !egLordsAwake(B.F); k++) { [...heard].forEach((sub, i) => stand(sub, spec.ring.x + i * 0.4, spec.ring.z, spec.ring.y ?? 0)); step(); }
    assert.ok(egLordsAwake(B.F), 'the lord woke in its ring');
  };
  let q = 1;
  const strike = (sub, L, d) => { stand(sub, L.x + 1.5, L.z, L.y ?? 0); now += 50; return fold(egBlow(B, sub, { k: 'hit', i: L.i, q: q++, d, r: HIT_KINDS.Melee }, pos[sub], now)); };
  const dead = (sub) => { deadOf[sub] = true; };
  const arrive = (sub) => { const at = spec.ring ?? spec.arrive; heard.add(sub); stand(sub, at.x, at.z, at.y ?? 0); };
  /** A beat of the company at its lord: each member heard and living strikes it at its reference damage once in four beats. */
  const fight = (L, beats) => { for (let k = 0; k < beats && L.hp > 0; k++) { if (k % 4 === 0) for (const sub of heard) if (B.mem[sub].alive && !deadOf[sub]) strike(sub, L, dpsRef(LV)); step(); } };
  return { B, spec, step, wake, ring, lord, strike, dead, arrive, fight, E: () => E, now: () => now };
}
/** Grath's Court, the first Court of every breach (seed 1, hall 5, circle 1): his health 180 s of each member's reference. */
const GRATH = Object.freeze({ seed: 1, h: 5 });
const SHARE = egTtkRef(1) * dpsRef(LV);

test('FB1019E LORD-SHARES A LORD KEEPS WHAT THE FALLEN LEAVE (section 13.2): Grath woken by a company of four at level 30 is four shares of 6,300; a minute struck at reference, three fall in one beat by their poses\' word - his health and its whole stand as they stood (the fallen\'s shares kept, not one retired), so the survivor finishes what the company left and its blow takes the 35 of 25,200 it took beside them; the screen holds his whole at 25,200 and his bar never jumps; a fallen member admitted again (a recall) brings nothing it did not hold (mutants: a fall retiring its share from a lord awake)', () => {
  assert.deepEqual([egTtkRef(1), dpsRef(LV), SHARE], [180, 35, 6300], 'the law the numbers stand on');
  const C = company(GRATH.seed, GRATH.h);
  assert.deepEqual([C.spec.kind, C.spec.lord, C.spec.c], ['court', 'hound', 1], 'seed 1\'s Hall 5 is Grath\'s Court');
  C.wake(); C.ring();
  const L = C.lord(), { B } = C;
  assert.equal(L.max, 4 * SHARE, 'woken for the four of them');
  C.fight(L, 4 * 60);
  assert.ok(L.hp > 0.5 * L.max && L.hp < 0.8 * L.max, `a minute struck (${Math.ceil(L.hp)} of ${L.max})`);
  const max0 = L.max, hp0 = L.hp, frac0 = egLordBars(C.E())[0].frac;
  for (const sub of ['acct-1', 'acct-2', 'acct-3']) C.dead(sub);
  C.step();
  assert.deepEqual(['acct-1', 'acct-2', 'acct-3'].map((sub) => B.mem[sub].alive), [0, 0, 0], 'three fell');
  assert.equal(L.max, max0, 'his whole stands: the fallen\'s shares stay in him');
  assert.ok(L.hp >= hp0, `not a point of his health went with them (${Math.ceil(hp0)} -> ${Math.ceil(L.hp)})`);
  assert.deepEqual(['acct-1', 'acct-2', 'acct-3'].map((sub) => L.fs[sub].retired), [false, false, false], 'no share retired');
  // the screen: his whole as the room keeps it, his bar where it stood
  for (let k = 0; k < 12; k++) C.step();
  const seen = C.E().fight.bodies.find((b) => b.i === L.i);
  assert.equal(seen.max, max0, 'every screen holds his whole at four shares');
  assert.ok(Math.abs(egLordBars(C.E())[0].frac - frac0) < 0.01, 'his bar never jumped at the falls');
  // the survivor's blow takes what it took beside the company: the rest is all its own to finish
  while (L.ward > C.now() || egHas(L, EG_FL.ward)) C.step();
  const hp1 = L.hp;
  C.strike('acct-0', L, dpsRef(LV));
  assert.equal(hp1 - L.hp, dpsRef(LV), 'a blow of 35 on a lord of 25,200');
  // a recall finds its share where it was
  assert.equal(egLordsShare(B.F, 'acct-1', LV, true), false, 'a fallen member admitted again moves no share');
  assert.equal(L.max, max0);
});

test('FB1019E LORD-SHARES A LORD STANDS FOR THE COMPANY ON ITS HALL\'S PLATE (section 13.2): a company of five, three of whose sockets closed on the stair - the hall wakes 30 s on for its living five (its legion\'s company) with two on its arrival plate, and Grath stands asleep for the two (12,600), every screen hearing that whole in the wake\'s own word, never a blow; the third reaching the hall while he sleeps brings its share whole; he wakes in his ring for the three; the fourth reaching it mid-fight brings its share at the fraction he stands at (never a heal); the fifth\'s absence, a fall 180 s from the wake, moves nothing - it never stood in the fight; and no screen ever drew a share\'s move as a blow on him (mutants: the lords stood for every living member; the plate unread; the plate\'s own shares let go)', () => {
  const C = company(GRATH.seed, GRATH.h, { n: 5, present: ['acct-0', 'acct-1'] });
  const { B } = C;
  C.wake();
  assert.deepEqual(B.F.subs, ['acct-0', 'acct-1', 'acct-2', 'acct-3', 'acct-4'], 'the hall\'s fight sized by its living company');
  const L = C.lord(), onScreen = () => C.E().fight.bodies.find((b) => b.i === L.i);
  assert.ok(!egLordsAwake(B.F), 'asleep in his ring');
  assert.deepEqual([L.hp, L.max], [2 * SHARE, 2 * SHARE], 'stood for the two on the plate');
  assert.deepEqual(['acct-0', 'acct-1', 'acct-2', 'acct-3', 'acct-4'].map((sub) => L.fs[sub].retired), [false, false, true, true, true], 'the three on the stair bring nothing yet');
  assert.deepEqual([onScreen().hp, onScreen().max], [2 * SHARE, 2 * SHARE], 'every screen hears it in the wake\'s whole fight');
  C.arrive('acct-2'); C.step();
  assert.deepEqual([L.hp, L.max, L.fs['acct-2'].retired], [3 * SHARE, 3 * SHARE, false], 'the third, reaching the hall while he sleeps, brings its share whole');
  C.ring();
  assert.deepEqual([L.hp, L.max], [3 * SHARE, 3 * SHARE], 'woken for the three in his hall');
  assert.deepEqual(['acct-3', 'acct-4'].map((sub) => L.fs[sub].retired), [true, true], 'the two never seen bring nothing yet');
  assert.deepEqual([onScreen().hp, onScreen().max, egLordBars(C.E())[0].frac], [3 * SHARE, 3 * SHARE, 1], 'every screen holds his whole - his bar full');
  assert.equal(onScreen().hurtAt, undefined, 'and no screen read a share\'s move as a blow on him');
  C.fight(L, 4 * 30);
  const frac = L.hp / L.max;
  assert.ok(frac < 0.95, `thirty seconds struck (${frac.toFixed(3)})`);
  // the fourth reaches the hall: its share brought at the fraction he stands at
  C.arrive('acct-3'); C.step();
  assert.equal(L.fs['acct-3'].retired, false, 'seen in the hall');
  assert.ok(Math.abs(L.max - 4 * SHARE) < 1e-6, `four shares (${L.max})`);
  assert.ok(Math.abs(L.hp / L.max - frac) < 0.002, 'at the fraction he stood at - a late arrival never heals him');
  // the fifth never comes: its absence a fall 180 s from the trial's wake, and nothing moves
  const max1 = L.max;
  while (B.mem['acct-4'].alive) C.step(1000);
  assert.ok(C.now() - B.hw > EG_ABSENT_TRIAL_MS, 'fallen by its absence');
  assert.equal(L.max, max1, 'its absence takes nothing out of him: it never stood in his fight');
});

test('FB1019E LORD-SHARES A FALL BEFORE THE WAKE LEAVES THE LORD ASLEEP (section 13.2): Grath asleep in his ring while a company of four makes its way to it, one of them falls - its share leaves him whole (he wakes for the company standing before him), and he wakes for the three; the fallen member\'s share is kept by him from then on (mutants: no fall leaving a lord asleep; an awake lord letting one go)', () => {
  const C = company(GRATH.seed, GRATH.h);
  const { B } = C;
  C.wake();
  const L = C.lord();
  assert.ok(!egLordsAwake(B.F), 'asleep in his ring');
  C.dead('acct-3'); C.step();
  assert.equal(B.mem['acct-3'].alive, 0);
  assert.equal(L.max, 3 * SHARE, 'its share left him asleep');
  assert.equal(L.hp, L.max);
  C.ring();
  assert.equal(L.max, 3 * SHARE, 'woken for the three standing');
  C.dead('acct-2'); C.step();
  assert.equal(L.max, 3 * SHARE, 'awake, he keeps the next fallen\'s share');
});

test('FB1019E LORD-SHARES KYN\'S VIGIL\'S CHAMPION IS STOOD FOR THE COMPANY ON THE PLATE (sections 13.2 and 14): under Kyn\'s Vigil the Kynreeve stands and wakes on a Rift-Yard\'s arrival plate in the very beat its hall wakes - for the two members on that plate, never the two whose sockets closed (EG_PROVE_HP_S x each one\'s reference), and never for one; a hall that woke with nobody on its plate (its 30 s wait run out) stands him for the one share a lord never lets go - never at nought - and each member reaching it brings its own (mutants: the plate unread; the champion stood for every living member; the last share let go)', () => {
  const C = company(1, 1, { present: ['acct-0', 'acct-1'], dc: [[EG_DECREE_BY_KEY.vigil.id, 1]] });
  assert.equal(C.spec.kind, 'yard', 'seed 1\'s Hall 1 is a Rift-Yard');
  const one = EG_PROVE_HP_S * dpsRef(LV);
  C.wake();
  const K = C.lord();
  assert.ok(K && K.champ && K.key === 'kynreeve' && K.up2, 'the Vigil\'s champion stood awake on the plate');
  assert.equal(C.B.F.X, 1, 'circle 1: no depth on his health');
  assert.equal(K.max, 2 * one, 'for the two on the plate');
  // nobody on the plate when the hall wakes
  const D = company(1, 1, { present: [], dc: [[EG_DECREE_BY_KEY.vigil.id, 1]] });
  D.wake();
  const K2 = D.lord();
  assert.ok(K2 && K2.up2 && K2.hp > 0, 'stood awake, and standing');
  assert.equal(K2.max, one, 'one share kept: never a champion of nought');
  D.arrive('acct-0'); D.step();
  assert.ok(!K2.fs['acct-0'].retired && K2.max >= one && K2.max <= 2 * one, `the first to reach him brings its share, or holds the one kept (${K2.max})`);
});

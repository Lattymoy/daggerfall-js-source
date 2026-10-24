// AUDIT EG III (2026-10-13, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 13.2, 13.3, 13.4 and 14) - THE
// LORDS' FINDINGS FIXED, each pinned on fights the lords' own producers stand (net/eliteGates/egLaw.js egHallOf, net/eliteGates/egBodies.js
// egFightNew, net/eliteGates/egLords.js egLordsNew, egLordsWake and egLordsStep, the director's net/eliteGates/egBrain.js egStep and egCount): the
// Mother of Dusk dragged down once a grounding (lane 1 #1); the Wellhead Wyrm taking flight again and its Burning Perches
// erupting (#2); the Twin Lords' Fire-touched and Frost-touched minted and said (#4); fury's chained shape at THE CHAINED GAP
// (#10, net/eliteGates/egShape.js egChainGapMs, Chained Blows' own rule); the lords' state weights never multiplied, the Breakdown's half
// route and Grath's Gore twice as often alone (#11); Morvayn's shared blow in the census (#12); the aspects - Garoth's each of
// the four in turn, an earlier band's lord re-aspected (#18); the gate's rows read from net/gate/gateBrain.js ATTACKS, the Meteor's
// burning ground with them (#23).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egCount } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egObjsOf, egObjBroken, egLordHitX, egLordAspect, EG_MARK_FIRE, EG_MARK_FROST, EG_TOUCH_MS, EG_TOUCH_X, EG_SCORCH_HIT_X, EG_KNEEL_HIT_X, EG_GROUNDED_HIT_X } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egHas, EG_FL, EG_ROLE, egBodyById, egBlowsStep, egAim, egShareX, egBodiesOf, EG_TELL_LEAD_MS } from '../../../src/net/eliteGates/egBodies.js';
import { egChainGapMs, egWindupFloorMs, shDisc, egInBlow, EG_CHAIN_PAD_MS, EG_CHAIN_MIN_MS } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { egFeatBits } from '../../../src/net/eliteGates/egFeats.js';
import { ATTACKS, POOLS, STUN_HIT_X, HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egGive8Halls } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8Halls([[1, 70, 0], [1, 85, 0], [1, 35, 0], [12345, 5, 0], [2, 95, 0], [12345, 50, 0], [1, 125, 0], [1, 100, 0], [2, 30, 0], [77, 25, 0]]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * A lord's Court stood and woken as the director stands it (egHallOf, egFightNew, egLordsNew, egLordsWake) for `n` members at
 * level 40; `step(here, ctx)` beats it in the director's order - the lords, then the blows' words (egBlowsStep) - every frame
 * kept, the words it said counted (`said`, as the director's tally counts a Court's).
 */
function court(seed, h, key, { n = 2, rng = seeded(seed) } = {}) {
  const spec = egHallOf(seed, h, 0);
  assert.equal(spec.lord, key, `hall ${h} of seed ${seed} is ${key}'s`);
  const subs = Array.from({ length: n }, (_, i) => `acct-${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), frames = [], view = egFightView(spec), said = {};
  egLordsNew(F, spec, key, T0, frames, { decrees: {}, n });
  egLordsWake(F, spec, T0, frames, { n });
  let now = T0;
  const step = (here, ctx = {}, mid = null) => {
    now += 250;
    const out = [];
    egLordsStep(F, spec, now, here, rng, out, { decrees: {}, n, ...ctx });
    mid?.(now);
    egBlowsStep(F, view, now, here, out);
    for (const f of out) if (f.k === 'esay') said[f.w] = (said[f.w] ?? 0) + 1;
    frames.push(...out);
    return out;
  };
  return { spec, F, L: egLordsOf(F)[0], subs, frames, said, step, now: () => now, view, f: spec.fl?.find((q) => q.t === 'd') ?? { x: 0, z: 0, r: 18 } };
}
/** A breach of `n` at hall `h` of `seed`, its trial woken with the company on the arrival plate (EG-ZK's): `at` stands a member,
 *  `step` beats the director (its frames kept). */
function breachAt(seed, h, { n = 1 } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr: 'rally' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  const here = () => co.map(([sub]) => ({ sub, x: pos[sub].sx - spec.x0, z: pos[sub].z }));
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, frames, step, at, here, subs: co.map(([sub]) => sub), now: () => now };
}
/** The Court's lords woken: the company stood in its wake ring until they rise. */
function wakeCourt(S) {
  for (const sub of S.subs) S.at(sub, S.spec.ring.x, S.spec.ring.z);
  for (let k = 0; k < 200 && !egLordsOf(S.B.F).some((L) => L.up2); k++) S.step();
  assert.ok(egLordsOf(S.B.F).some((L) => L.up2), 'the lords woke');
}

test('AUDIT EG III lane1 #1 THE MOTHER OF DUSK (section 13.3): her three anchors broken drag her down ONCE - grounded 30 s, then the air until her anchors rise again 20 s after (40 s in the Moonfall, two Divers with each), never dragged down again by anchors never broken; "dragged down twice" asks two real groundings (mutants: the grounding\'s test without the anchors\' rising - the loop; the rising\'s 20 s; the Moonfall\'s Divers)', () => {
  const C = court(1, 70, 'dusk');
  const { F, L, spec } = C;
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  const grounds = [], rose = [];
  const beat = () => { const out = C.step(here); if (out.some((f) => f.k === 'esay' && f.w === 'anchors')) rose.push(C.now() - T0); const g = egHas(L, EG_FL.grounded); if (g !== (grounds.at(-1)?.[1] ?? false)) grounds.push([C.now() - T0, g]); };
  for (let k = 0; k < 20; k++) beat();
  assert.deepEqual([egObjsOf(F, 'anchor').length, egHas(L, EG_FL.fly), grounds], [3, true, []], 'she circles, held by three anchors');
  const brk = [];
  for (const a of egObjsOf(F, 'anchor')) egObjBroken(F, spec, a, 'M0', C.now(), brk);
  while (C.now() < T0 + 60_000) beat();
  assert.deepEqual(grounds, [[5250, true], [35250, false]], 'dragged down at the next beat, for 30 s - and back in the air, not dragged down again');
  assert.deepEqual([rose, egObjsOf(F, 'anchor').length, C.said.grounded], [[55250], 3, 1], 'her anchors rise again 20 s after the grounding\'s end; one grounding said');
  const featOf = () => egFeatBits('dusk', { said: C.said, fellThisHall: 1, lordAt: 0, mem: {} }, { now: C.now() }) & 4;
  assert.equal(featOf(), 0, 'Wings Clipped is two groundings, not one said twice');
  for (const a of egObjsOf(F, 'anchor')) egObjBroken(F, spec, a, 'M0', C.now(), brk);
  while (C.now() < T0 + 100_000) beat();
  assert.deepEqual(grounds.slice(2), [[60250, true], [90250, false]], 'broken again: dragged down again');
  assert.deepEqual([C.said.grounded, featOf()], [2, 4], 'two groundings: the feat');
  // the Moonfall: the anchors rise 40 s after a grounding, two Divers with each
  const M = court(1, 70, 'dusk'), mh = M.subs.map((sub, j) => ({ sub, x: M.f.x + 3 + j, z: M.f.z + 3 }));
  M.L.hp = M.L.max * 0.2;
  M.step(mh);
  assert.equal(M.L.ph, 3, 'the Moonfall');
  for (const a of egObjsOf(M.F, 'anchor')) egObjBroken(M.F, M.spec, a, 'M0', M.now(), []);
  const divers = () => egBodiesOf(M.F, EG_ROLE.add, EG_KIND.diver).length;
  let downAt = 0, upAt = 0, riseAt = 0;
  for (let k = 0; k < 4 * 90 && !riseAt; k++) {
    const out = M.step(mh), g = egHas(M.L, EG_FL.grounded);
    if (g && !downAt) downAt = M.now();
    if (!g && downAt && !upAt) upAt = M.now();
    if (out.some((f) => f.k === 'esay' && f.w === 'anchors')) riseAt = M.now();
  }
  assert.deepEqual([upAt - downAt, riseAt - upAt, egObjsOf(M.F, 'anchor').length, divers(), M.said.grounded], [30_000, 40_000, 3, 6, 1], 'grounded 30 s; 40 s on, three anchors and six Divers; once');
});

test('AUDIT EG III lane1 #2 THE WELLHEAD WYRM (section 13.3): its perch broken it lands ONCE, x1.3 for 25 s, then takes flight to a standing pillar - and in Burning Perches the pillar it leaves erupts as it leaves it (a disc of r 6 there, 2.0 s); with no pillar left it stays down, said once; "landed twice" asks two landings (mutants: the landing tested before the flight; no eruption; an eruption in the first phase; the last landing said again)', () => {
  const C = court(1, 85, 'wyrm');
  const { F, L, spec } = C;
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  // the first phase: a perch broken erupts nothing
  for (let k = 0; k < 8; k++) C.step(here);
  const out1 = [], p1 = egBodyById(F, L.perch);
  egObjBroken(F, spec, p1, 'M0', C.now(), out1);
  assert.deepEqual(out1.filter((f) => f.k === 'eb'), [], 'no Burning Perch before its phase');
  const log = [];
  const beat = () => { C.step(here); const st = [egHas(L, EG_FL.grounded), egHas(L, EG_FL.fly)]; if (!log.length || log.at(-1)[1] !== st[0] || log.at(-1)[2] !== st[1]) log.push([C.now() - T0, ...st]); };
  for (let k = 0; k < 4 * 40; k++) beat();
  assert.deepEqual(log, [[2250, true, false], [27250, false, true]], 'landed at the next beat; 25 s on, in the air again');
  assert.ok(egObjsOf(F, 'pillar').some((p) => p.i === L.perch) && L.perch !== p1.i, 'perched on a standing pillar');
  assert.equal(C.said.landed, 1, 'one landing said');
  assert.equal(egLordHitX(F, L, 'acct-0', { x: L.x + 1, z: L.z }, HIT_KINDS.Shaft, C.now()), 1, 'aloft: no grounding\'s weight');
  // Burning Perches: the pillar it leaves erupts there, as it leaves it
  L.hp = L.max * 0.5;
  C.step(here);
  assert.equal(L.ph, 2, 'Burning Perches');
  for (let k = 0; k < 16; k++) C.step(here);   // its turn's ward spent
  const p2 = egBodyById(F, L.perch), out2 = [], t2 = C.now();
  egObjBroken(F, spec, p2, 'M0', t2, out2);
  // PIN MOVED (AUDIT EG IV, lane1 #26): Burning Perch is the Wyrm's own lord blow (lordBlow), committed EG_TELL_LEAD_MS before its
  // wind-up and said at the first beat its word is due (500 ms on, past the lead), landing its 2000 ms after - before, it was said
  // at once, landing 2000 ms on
  // EG-PERFECT (PIN MOVED): thrown as the place's (net/eliteGates/egLords.js lordBlow's `place`) - said at once, landing its 2000 ms on,
  // never held (its r 6 is the perch's whole top)
  C.step(here); C.step(here);
  assert.deepEqual(out2.filter((f) => f.k === 'eb' && f.nm === 'Burning Perch').map((f) => [f.nm, f.o, f.s, f.at - t2, f.wu, f.el]), [['Burning Perch', L.i, [shDisc(p2.x, p2.z, 6)], 2000, 2000, 'fire']], 'the perch it leaves erupts: r 6, 2.0 s');
  assert.deepEqual([egHas(L, EG_FL.grounded), C.said.landed, egLordHitX(F, L, 'acct-0', { x: L.x + 1, z: L.z }, HIT_KINDS.Melee, C.now() + 100)], [true, 2, EG_GROUNDED_HIT_X], 'landed again, x1.3');
  assert.equal(egFeatBits('wyrm', { said: C.said, fellThisHall: 1, lordAt: 0, mem: {} }, { now: C.now() }) & 4, 4, 'Brought to Earth: two landings');
  for (let k = 0; k < 4 * 26; k++) C.step(here);
  // EG-PERFECT (PIN MOVED): the perch broken in its first phase rose again at its second's turn - two left
  assert.equal(egObjsOf(F, 'pillar').length, 2, 'two pillars left');
  assert.ok(egHas(L, EG_FL.fly) && egObjsOf(F, 'pillar').some((p) => p.i === L.perch), 'and on one');
  for (const p of egObjsOf(F, 'pillar').filter((q) => q.i !== L.perch)) egObjBroken(F, spec, p, 'M0', C.now(), []);
  egObjBroken(F, spec, egBodyById(F, L.perch), 'M0', C.now(), []);
  for (let k = 0; k < 4 * 90; k++) C.step(here);
  assert.deepEqual([egHas(L, EG_FL.grounded), egHas(L, EG_FL.fly), C.said.landed], [true, false, 3], 'no pillar to find: it stays down, its landing said once');
  assert.equal(egLordHitX(F, L, 'acct-0', { x: L.x + 1, z: L.z }, HIT_KINDS.Melee, C.now()), 1, 'its 25 s of x1.3 spent');
});

test('AUDIT EG III lane1 #4 FIRE-TOUCHED AND FROST-TOUCHED (section 13.3, the Twin Lords): a member a twin\'s blow lands on - by the census\'s reckoning of the poses - is touched for 12 s from its landing (Vael\'s mark 2, Isk\'s 3), said on the wire (`emk`) for every screen, and deals +25% to the other twin (mutants: no touch minted; the marks swapped; the 12 s; the mark unsaid; the weight dropped)', () => {
  assert.deepEqual([EG_MARK_FIRE, EG_MARK_FROST, EG_TOUCH_MS, EG_TOUCH_X], [2, 3, 12_000, 1.25]);
  const S = breachAt(1, 35, { n: 2 });
  assert.equal(S.spec.lord, 'twins');
  wakeCourt(S);
  const twins = egLordsOf(S.B.F), vael = twins.find((L) => L.pt === 0), isk = twins.find((L) => L.pt === 1);
  S.at('acct-0', vael.x + 1.5, vael.z); S.at('acct-1', isk.x + 1.5, isk.z);
  // PIN MOVED (AUDIT EG V, b: lane1 #25 - the touch is minted off the census's own hits at the seam's judge, so the room's beat is
  // driven as the room drives it: the census over each member's trail (egCount), then the director's beat)
  const trails = Object.fromEntries(S.subs.map((s) => [s, []]));
  const census = () => { for (const s of S.subs) trails[s].push([S.now(), S.pos[s].sx - S.spec.x0, 0, S.pos[s].z, S.B.h]); egCount(S.B, S.now(), S.subs.map((s) => ({ sub: s, tr: trails[s] })), LINE, false); };
  let mk = null, eb = [];
  for (let k = 0; k < 4 * 60 && !mk; k++) {
    census();
    const o = S.step();
    eb = eb.concat(o.filter((f) => f.k === 'eb' && (f.o === vael.i || f.o === isk.i)));
    mk = o.find((f) => f.k === 'emk' && f.m.some((m) => m[1] === EG_MARK_FIRE || m[1] === EG_MARK_FROST)) ?? null;
  }
  assert.ok(mk, 'a touch said');
  const w = validEgOut(JSON.parse(JSON.stringify(mk)));
  assert.ok(w, 'the wire carries it');
  const at = S.now();
  for (const [sub, kind, until] of w.m.filter((m) => m[1] === EG_MARK_FIRE || m[1] === EG_MARK_FROST)) {
    const by = kind === EG_MARK_FIRE ? vael : isk;
    const bl = eb.find((b) => b.o === by.i && b.at + EG_TOUCH_MS === until);
    assert.ok(bl, `${sub}'s mark is ${kind === EG_MARK_FIRE ? 'Vael' : 'Isk'}'s blow's, 12 s from its landing`);
    assert.ok(bl.at <= at && S.here().some((m) => m.sub === sub && egInBlow(bl, m.x, m.z)), 'and the blow landed on them');
    const other = kind === EG_MARK_FIRE ? isk : vael, t = at + 100, pose = { x: other.x + 1, z: other.z };
    const plain = egLordHitX(S.B.F, other, 'nobody', pose, HIT_KINDS.Melee, t);
    assert.ok(plain > 0, 'the other twin stands open');
    assert.equal(egLordHitX(S.B.F, other, sub, pose, HIT_KINDS.Melee, t), plain * EG_TOUCH_X, 'they deal +25% to the other twin');
    assert.equal(egLordHitX(S.B.F, by, sub, { x: by.x + 1, z: by.z }, HIT_KINDS.Melee, t), egLordHitX(S.B.F, by, 'nobody', { x: by.x + 1, z: by.z }, HIT_KINDS.Melee, t), 'and none more to the twin that touched them');
  }
});

test('AUDIT EG III lane1 #10 THE CHAINED GAP (sections 13.2 and 14): fury\'s chained shape lands max(the blow\'s own wind-up, its wind-up floor + 0.3 s, 1.0 s) after the first - one rule with Chained Blows (net/eliteGates/egShape.js egChainGapMs) - so Grath\'s Savage chains at 1.26 s, never the same blow\'s 1.2 (mutants: the floor\'s term dropped; its 0.3 s; the least 1.0 s; fury\'s chain past the rule)', () => {
  assert.deepEqual([EG_CHAIN_PAD_MS, EG_CHAIN_MIN_MS], [300, 1000]);
  // the rule over the page's own blows: Savage, Maul, a Harrier's Bite, Lunge, Riposte, Gore, a Lurker's Smash
  const rows = [[1200, ['c', 0, 0, 0, 7, 110]], [1200, ['d', 0, 0, 3]], [900, ['d', 0, 0, 2]], [1000, ['l', 0, 0, 0, 10, 4]], [900, ['c', 0, 0, 0, 5, 90]], [1300, ['l', 0, 0, 0, 18, 4]], [1300, ['d', 0, 0, 4]]];
  assert.deepEqual(rows.map(([wu, s]) => egChainGapMs(wu, [s])), [1260, 1240, 1090, 1090, 1100, 1300, 1380]);
  assert.deepEqual(rows.map(([wu, s]) => egChainGapMs(wu, [s]) - Math.max(wu, egWindupFloorMs(s) + 300, 1000)), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(egChainGapMs(500, [['a']]), 1000, 'a CHECK\'s stamps carry no floor: the least');
  // fury's chain on Grath, a company of one at his side under the Covenant (fury at once, its second step a minute on)
  const C = court(12345, 5, 'hound', { n: 1 });
  const pairs = [];
  for (let k = 0; k < 4 * 120 && pairs.length < 3; k++) {
    const here = [{ sub: 'acct-0', x: C.L.x + 2.4, z: C.L.z }];
    C.step(here, { covenant: 1 }, () => {
      for (const q of C.F.pend ?? []) {
        if (!q.b.nm.endsWith(' (fury)') || pairs.some(([, c]) => c.i === q.b.i)) continue;
        const first = (C.F.pend ?? []).find((p) => p.b.i === q.b.i - 1)?.b;
        if (first) pairs.push([{ ...first }, { ...q.b }]);
      }
    });
  }
  assert.ok(pairs.length >= 1, 'fury chained a shape');
  for (const [a, b] of pairs) {
    assert.equal(b.nm, `${a.nm} (fury)`);
    assert.deepEqual(b.s, a.s, 'the same stamps');
    assert.equal(b.at - a.at, egChainGapMs(a.wu, a.s), `${a.nm}: its chained shape at THE CHAINED GAP`);
  }
  const sav = pairs.find(([a]) => a.nm === 'Savage');
  assert.ok(sav, 'a Savage chained');
  assert.equal(sav[1].at - sav[0].at, 1260, 'Savage: 0.96 s floor + 0.3 s, past its 1.2 s');
});

test('AUDIT EG III lane1 #11 THE LORDS\' WEIGHTS AND KITS (section 13.3): a state\'s weight is its own, never a product - Grath Scorched x1.3 (not the stun\'s x1.5 times it), the Colossus\'s Breakdown x1.5 (its kneel a stun\'s stillness) - and at its kneel\'s end it walks half its route; Grath alone gores twice as often (Gore\'s weight doubled at n = 1) (mutants: the states multiplied; the Scorch\'s stun at STUN_HIT_X; the half route never taken; Gore\'s `w1` dropped)', () => {
  assert.deepEqual([EG_SCORCH_HIT_X, EG_GROUNDED_HIT_X, EG_KNEEL_HIT_X, STUN_HIT_X], [1.3, 1.3, 1.5, 1.5]);
  // Grath Scorched: the Scent begun, an island cracking under him
  const G = court(12345, 5, 'hound');
  const gh = G.subs.map((sub, j) => ({ sub, x: G.L.x + 8 + j, z: G.L.z }));   // out of a Maul's catch
  G.F.mem.scentAt = T0 + 250;
  G.step(gh);
  assert.ok(G.F.mem.scent, 'the Scent');
  const isle = egObjsOf(G.F, 'isle').find((o) => dist(o, G.L) <= 11);
  isle.st = 1; isle.stAt = G.now() + 3700;   // cracking, as `crack` leaves it
  G.step(gh);
  assert.equal(G.said.scorched, 1, 'Scorched');
  const gp = { x: G.L.x + 1, z: G.L.z };
  assert.deepEqual([egLordHitX(G.F, G.L, 'acct-0', gp, HIT_KINDS.Melee, G.now() + 1000), egLordHitX(G.F, G.L, 'acct-0', gp, HIT_KINDS.Melee, G.now() + 4100), G.L.groundedUntil ?? 0], [EG_SCORCH_HIT_X, 1, 0], 'x1.3 for its 4 s, and no grounding');
  // the Colossus's Breakdown
  const K = court(2, 95, 'colossus');
  const kh = K.subs.map((sub, j) => ({ sub, x: K.L.x + 8 + j, z: K.L.z }));
  for (let k = 0; k < 20; k++) K.step(kh);
  const route = [...K.F.mem.route];
  K.L.hp = K.L.max * 0.3;
  K.step(kh);
  assert.equal(K.L.ph, 3, 'the Breakdown');
  const knelt = K.L.z, turn = K.now();
  for (let k = 0; k < 16; k++) K.step(kh);
  const kp = { x: K.L.x + 1, z: K.L.z };
  assert.deepEqual([egLordHitX(K.F, K.L, 'acct-0', kp, HIT_KINDS.Melee, K.now()), K.L.stunUntil > K.now()], [EG_KNEEL_HIT_X, true], 'kneeling: x1.5, a stun\'s stillness');
  while (K.now() < turn + 20_000) K.step(kh);
  const mid = Math.round(((route[0] + route[1]) / 2) * 100) / 100, half = Math.abs(knelt - route[0]) <= Math.abs(knelt - route[1]) ? [route[0], mid] : [mid, route[1]];
  assert.deepEqual(K.F.mem.route, half, 'its route halved: the half it knelt in');
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 4 * 200; k++) { K.step(kh); lo = Math.min(lo, K.L.z); hi = Math.max(hi, K.L.z); }
  const [a, b] = [Math.min(...half), Math.max(...half)];
  assert.ok(lo >= a - 1 && hi <= b + 1 && hi - lo >= (b - a) * 0.8, `it walks the half (${lo.toFixed(1)}-${hi.toFixed(1)} of ${a}-${b})`);
  // Grath alone gores twice as often: the same die chooses Gore alone, Savage in company
  const choice = (n) => {
    const C = court(12345, 5, 'hound', { n, rng: () => 0.6 });
    // PIN MOVED (AUDIT EG IV, lane1 #8): Gore is laid only at a member on Grath's own island, so his first choice is made at once
    // (his breath spent) with the member 6.8 m off on it - before, he walked 2.5 s after the member, who was carried off the
    // island's rim into the magma, and gored there
    C.L.nextAt = T0;
    for (let k = 0; k < 40; k++) {
      const u = 6.8, here = [{ sub: 'acct-0', x: C.L.x + u, z: C.L.z }];
      let got = null;
      C.step(here, {}, () => { got = (C.F.pend ?? []).find((q) => q.b.o === C.L.i)?.b.nm ?? null; });
      if (got) return got;
    }
    return null;
  };
  assert.deepEqual([choice(1), choice(2)], ['Gore', 'Savage'], 'a draw of 0.6: Gore\'s band two thirds alone, a half in company');
});

test('AUDIT EG III lane1 #12 THE CHAINING\'S SHARED BLOW (section 13.4, Morvayn), the census\'s half: a counted blow on a soul-chained member is divided between the chain the census holds - a pair\'s halves, the Last Rites\' three thirds - the struck member\'s catch its own; a member chained to a Wraith, a mate away and an element\'s blow share nothing (mutants: the share whole; the mate\'s catch recorded; a mate away sharing; an element\'s blow divided)', () => {
  const S = breachAt(12345, 50, { n: 3 });
  assert.equal(S.spec.lord, 'morvayn');
  wakeCourt(S);
  const F = S.B.F, M = egLordsOf(F).find((L) => L.key === 'morvayn');
  M.hp = M.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
  const cr = S.spec.fl.find((q) => q.t === 'd'), spots = { 'acct-0': [cr.x + 3, cr.z], 'acct-1': [cr.x + 3, cr.z + 4], 'acct-2': [cr.x - 5, cr.z] };   // in a crypt, on its floor
  for (const [sub, [x, z]] of Object.entries(spots)) S.at(sub, x, z);
  for (let k = 0; k < 4 * 20 && !(F.mem.chains ?? []).length; k++) S.step();
  assert.equal(F.mem.chains.length, 1, 'a pair chained');
  const pair = F.mem.chains[0], odd = S.subs.find((s) => !pair.includes(s));
  /** A blow of Morvayn's (`el` its element) landed on `struck` alone, counted by the census over the trails of the members
   *  it holds in the hall (`away` none): each member's thousandths counted and blows struck, since. */
  const census = (struck, nm, { el = null, away = [] } = {}) => {
    F.blows.length = 0; F.pend = []; F.held = [];
    const at = S.now() + 10_000, [mx, mz] = spots[struck], out = [];
    assert.ok(egAim(F, S.spec, { o: M.i, s: [shDisc(mx, mz, 2)], at, wu: 1500, p: 0.4, b: 0, el, nm }, [], at - 1500, out));
    const cs0 = Object.fromEntries(S.subs.map((s) => [s, [...(S.B.mem[s].cs ?? [0, 0, 0, 0])]]));
    const bodies = S.subs.filter((s) => !away.includes(s)).map((s) => ({ sub: s, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, spots[s][0], 0, spots[s][1], S.B.h]) }));
    egCount(S.B, at + 900, bodies, LINE, false);
    const d = (s, k) => (S.B.mem[s].cs?.[k] ?? 0) - cs0[s][k];
    return { th: Object.fromEntries(S.subs.map((s) => [s, d(s, 3)])), n: Object.fromEntries(S.subs.map((s) => [s, d(s, 0)])) };
  };
  const [a, b] = pair;
  assert.deepEqual(census(a, 'Test Blow').th, { [a]: 200, [b]: 200, [odd]: 0 }, 'a 0.4 blow on one of a pair: 0.2 each');
  assert.deepEqual(F.cg['Test Blow'], [a], 'the blow caught the struck member alone');
  assert.deepEqual(census(odd, 'Odd Blow').th, { [a]: 0, [b]: 0, [odd]: 400 }, 'chained to a Wraith: shared with no body');
  assert.deepEqual(census(a, 'Away Blow', { away: [b] }).th, { [a]: 200, [b]: 0, [odd]: 0 }, 'a mate the census does not hold in the hall is counted none of its part - the struck member its own half, as its screen divides it over the chain');   // PIN MOVED (AUDIT EG V, b: lane1 #8 - the census divides over the chain as its tethers say it, the struck screen's own rule; a fallen or homeward mate is unchained at the seam's join)
  assert.deepEqual(census(a, 'Venom Blow', { el: 'poison' }).n, { [a]: 1, [b]: 0, [odd]: 0 }, 'an element\'s blow is seen on the struck alone: it divides nothing');
  // the Last Rites: chains bind threes
  M.hp = M.max * 0.3;
  const next = F.mem.chainAt;
  while (S.now() < next + 500) S.step();
  assert.equal(M.ph, 3, 'the Last Rites');
  assert.deepEqual(F.mem.chains.map((c) => [...c].sort()), [['acct-0', 'acct-1', 'acct-2']], 'a chain of three');
  assert.deepEqual(census('acct-2', 'Rites Blow').th, { 'acct-0': 133, 'acct-1': 133, 'acct-2': 133 }, 'a third each');
});

test('AUDIT EG III lane1 #18 THE ASPECTS (sections 13.3 and 13.4): Garoth\'s each of the four in turn from one Redoubt to the next, the other Valkynaz their bands\', a Court lord drawn in a later band re-aspected to it - its every element its aspect\'s and the gate\'s Meteor named by it - and none for a lord in its own band, the Twin Lords or a champion (mutants: Garoth\'s turn fixed; the re-aspect\'s band test; an element kept; the Meteor\'s name kept)', () => {
  const id = (k, c) => egLordAspect(k, c)?.id ?? null;
  assert.deepEqual([20, 25, 30, 35, 40, 45].map((c) => id('garoth', c)), ['burning', 'rime', 'storm', 'venom', 'burning', 'rime'], 'Garoth: each of the four in turn');
  assert.deepEqual([id('ilthys', 5), id('morvayn', 10), id('seyth', 15)], ['burning', 'venom', 'rime'], 'the Valkynaz: their bands\'');
  assert.deepEqual([id('hound', 1), id('spellmaster', 4), id('spellmaster', 6), id('cairnkeeper', 9), id('cairnkeeper', 12), id('dusk', 14), id('dusk', 16), id('armsmaster', 21)], [null, null, 'venom', null, 'rime', null, 'burning', 'burning'], 'a Court lord: its own band none, a later one\'s');
  assert.deepEqual([id('twins', 16), id('kynreeve', 16), id('nobody', 16)], [null, null, null], 'the Twin Lords keep their clans\'; a champion none');
  /** Every elemental blow a lord of hall `h` threw in two minutes, as [name, element]. */
  const thrown = (seed, h, key) => {
    const C = court(seed, h, key);
    for (let k = 0; k < 4 * 120; k++) C.step(C.subs.map((sub, j) => ({ sub, x: C.f.x + (k % 160 < 80 ? 4 : -8), z: C.f.z + 2 * j })));   // on its floor, now near him, now off
    return [...new Set(C.frames.filter((f) => f.k === 'eb' && f.o === C.L.i && f.el).map((f) => `${f.nm}|${f.el}`))].sort();
  };
  const g25 = thrown(1, 125, 'garoth'), g20 = thrown(1, 100, 'garoth');
  assert.ok(g25.length && g25.every((s) => s.endsWith('|frost')), `Garoth at Redoubt 25: every element the rime's (${g25})`);
  assert.ok(g25.includes('Hailstone of Oblivion|frost'), `the gate's Meteor named by his aspect (${g25})`);
  assert.ok(g20.length && g20.every((s) => s.endsWith('|fire')) && g20.includes('Meteor of Oblivion|fire'), `at Redoubt 20, the Burning (${g20})`);
  const sm6 = thrown(2, 30, 'spellmaster');
  assert.ok(sm6.length && sm6.every((s) => s.endsWith('|poison')), `the Spellmaster met in the Soul Cairn: the Venom-Blooded (${sm6})`);
});

test('AUDIT EG III lane1 #23 THE GATE\'S ROWS (section 13.4; ONE DFU MEMBER, ONE EXPORT): the Valkynaz\'s and champions\' Cleave, Slam, Charge and Meteor are net/gate/gateBrain.js ATTACKS\' own rows, never a copy - and the Meteor leaves the gate\'s burning ground (POOLS\' meteor) where it falls, from its landing (mutants: a row read off the wrong field; the pool unlaid; the pool laid at its word)', () => {
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLords.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const nm of ['Cleave', 'Ground Slam', 'Charge', 'Meteor of Oblivion']) assert.ok(!src.includes(`'${nm}'`), `no copy of the gate's ${nm}`);
  const C = court(77, 25, 'ilthys');
  const thrown = new Map(), zones = [];
  for (let k = 0; k < 4 * 240 && thrown.size < 3; k++) {
    const out = C.step(C.subs.map((sub, j) => ({ sub, x: C.L.x + (k % 80 < 40 ? 3 : 12), z: C.L.z + j })));
    for (const f of out) { if (f.k === 'eb' && f.o === C.L.i && ['Cleave', 'Ground Slam', 'Meteor of Oblivion'].includes(f.nm) && !f.nm.endsWith('(fury)')) thrown.set(f.nm, f); if (f.k === 'ez') zones.push([C.now(), f]); }
  }
  for (const A of [ATTACKS.cleave, ATTACKS.slam, ATTACKS.meteor]) {
    const f = thrown.get(A.name);
    assert.ok(f, `${A.name} thrown`);
    assert.deepEqual([f.wu, f.p, f.b, f.s[0][0] === 'c' ? [f.s[0][4], f.s[0][5]] : f.s[0][3]], [A.windup, A.pct * egShareX(C.F.c, 1), A.base, A.shape === 'cone' ? [A.r, A.arc] : A.r], `${A.name}: the gate's row`);
  }
  const met = thrown.get(ATTACKS.meteor.name), pool = zones.find(([, z]) => z.kind === 'burn' && z.from === met.at);
  assert.ok(pool, 'the Meteor leaves burning ground');
  assert.deepEqual([pool[1].s, pool[1].until - pool[1].from, pool[1].p, pool[1].b, pool[1].el], [shDisc(met.s[0][1], met.s[0][2], POOLS.meteor.r), POOLS.meteor.ms, POOLS.meteor.pct, POOLS.meteor.base, met.el], 'the gate\'s meteor pool, where it fell');
  assert.ok(pool[0] >= met.at, 'laid as it lands, never at its word');
  assert.ok(validEgOut(JSON.parse(JSON.stringify(pool[1]))), 'the wire carries it');
});

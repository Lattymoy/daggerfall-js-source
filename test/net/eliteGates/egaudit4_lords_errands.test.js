// AUDIT EG IV (2026-10-13, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 13.2, 13.3 and 13.4; lane 1 #5) -
// AN ERRAND'S FAILURE BLOW LANDS ON THE MEMBERS IT NAMES. The Chain Snaps ("a pair stretched past 8 m both take 30%"), a Soul
// Burst ("Otherwise it bursts: 30%") and the Cage Closes ("Failed: 70% to the bound") were discs at the member's feet with a short
// fixed wind-up - a CHECK no floor touches - so moving dodged them, and the snap's discs were narrower than THE WIDTH RULE. Each
// now names its members (`on` - net/eliteGates/egShape.js egBlowOf, egBlowOn): the relay's census (net/eliteGates/egBodies.js egStruck) and the struck
// screen's verdict (egBlowVerdict, scenes/eliteGates/egFight.js) land it on them wherever they stand and on no one else; the wire carries
// it (net/wire.js); each screen draws its mark riding the member it names. Fixtures the producers': the lords' own kits stood
// and stepped (net/eliteGates/egLords.js egLordsNew, egLordsWake, egLordsStep), the director's breach for the screen (egBreachNew, egStep),
// every frame through the wire, the screen createEgFight.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egObjsOf, EG_ERRANDS_GIVEN, EG_GIVEN_MAX } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egBlowsStep, egStruck, egAim, egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { egBlowVerdict, egBlowOn, egInBlow, shDisc } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, egGivenWords, EG_GIVEN_UP_LORD_M } from '../../../src/scenes/eliteGates/egFight.js';
import { egSigilHtml } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egScreenAt } from '../../../src/world/eliteGates/egTelegraph.js';
import { lookAt, perspective, multiply, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';
import { egGive8Halls } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8Halls([[1, 50, 0], [1, 135, 0], [1, 15, 0], [12345, 5, 0], [1, 35, 0], [12345, 65, 0], [12345, 60, 0]]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** A lord's fight stood and woken (egHallOf, egFightNew, egLordsNew, egLordsWake) for `n` members; `step(here)` the lords and the
 *  blows' words, every frame kept. */
function court(seed, h, key, n, rng = seeded(seed), nums = undefined) {
  const spec = egHallOf(seed, h, 0);
  assert.equal(spec.lord, key);
  const subs = Array.from({ length: n }, (_, i) => `acct-${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), frames = [], view = egFightView(spec);
  egLordsNew(F, spec, key, T0, frames, { decrees: {}, n });
  egLordsWake(F, spec, T0, frames, { n });
  let now = T0;
  const step = (here) => { now += 250; const out = []; egLordsStep(F, spec, now, here, rng, out, { decrees: {}, n, ...(nums ? { nums } : {}) }); egBlowsStep(F, view, now, here, out); frames.push(...out); return out; };
  return { spec, F, L: egLordsOf(F)[0], subs, frames, step, now: () => now, f: spec.fl.find((q) => q.t === 'd') };
}

test('AUDIT EG IV lane1 #5 THE CHAIN SNAPS ON THE PAIR IT NAMES (section 13.4, Morvayn: "A pair stretched past 8 m both take 30% (a CHECK)"): the pair walking apart at 6 m/s stretches its chain - the snap names both (`on`), and lands on both by the relay\'s census and on each one\'s own screen wherever they have run to, never on a member it does not name standing in its marks; its marks keep THE WIDTH RULE; the wire carries `on` (mutants: the snap naming no one; egBlowOn by the stamps alone; the census by the stamps; the wire dropping `on`)', () => {
  const C = court(1, 50, 'morvayn', 3);
  C.L.hp = C.L.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
  const c0 = { x: C.f.x, z: C.f.z };
  let here = C.subs.map((sub, j) => ({ sub, x: c0.x + j * 2, z: c0.z }));
  for (let k = 0; k < 4 * 16 && !(C.F.mem.chains ?? []).length; k++) C.step(here);
  const [pair] = C.F.mem.chains;
  assert.equal(pair.length, 2, 'a pair chained');
  const odd = C.subs.find((s) => !pair.includes(s));
  // the pair walks apart along the court's axis at 6 m/s (the escape build's 6.975 outruns any disc at its feet)
  let gap = 2, snap = null;
  for (let k = 0; k < 40 && !snap; k++) {
    gap += 1.5 * 2;
    here = [{ sub: pair[0], x: c0.x - gap / 2, z: c0.z }, { sub: pair[1], x: c0.x + gap / 2, z: c0.z }, { sub: odd, x: c0.x, z: c0.z + 3 }];
    snap = C.step(here).find((f) => f.k === 'eb' && f.nm === 'The Chain Snaps') ?? null;
  }
  assert.ok(snap, 'stretched past 8 m: the snap');
  assert.deepEqual(snap.on, [...pair].sort((a, b) => here.findIndex((m) => m.sub === a) - here.findIndex((m) => m.sub === b)), 'it names the pair');
  assert.ok(snap.s.every((s) => s[0] === 'd' && 2 * s[3] >= 4), 'its marks at least 4 m across');
  assert.deepEqual(wire(snap).on, snap.on, 'the wire carries it');
  assert.equal(validEgOut({ ...snap, on: ['bad sub!'] }), null, 'a malformed name refused');
  assert.equal(validEgOut({ ...snap, on: 'acct-0' }), null);
  // at its landing the pair has run on - out of the marks laid where they stood
  const ran = [{ sub: pair[0], x: snap.s[0][1] - 2.8, z: snap.s[0][2] }, { sub: pair[1], x: snap.s[1][1] + 2.8, z: snap.s[1][2] }, { sub: odd, x: snap.s[0][1], z: snap.s[0][2] }];
  assert.ok(ran.slice(0, 2).every((m) => !egInBlow(snap, m.x, m.z)) && egInBlow(snap, ran[2].x, ran[2].z), 'the pair clear of its marks, the other member in one');
  assert.deepEqual(egStruck(snap, ran).map((m) => m.sub).sort(), [...pair].sort(), 'the census: the pair, wherever they ran - never the other');
  for (const m of ran) assert.equal(egBlowVerdict(snap, m.x, m.z, snap.at + 1, 400, m.sub), pair.includes(m.sub) ? 'hit' : 'miss', `${m.sub}'s own screen`);
  assert.equal(egBlowVerdict(snap, ran[0].x, ran[0].z, snap.at - 1, 400, ran[0].sub), 'wait', 'not before its landing');
  assert.deepEqual([egBlowOn(snap, pair[0], 999, 999), egBlowOn(snap, odd, snap.s[0][1], snap.s[0][2])], [true, false]);
  // a blow naming no one is judged where it lands, as before
  const plain = { ...snap, on: undefined };
  assert.deepEqual([egBlowOn(plain, odd, snap.s[0][1], snap.s[0][2]), egBlowOn(plain, pair[0], 999, 999)], [true, false]);
});

test('AUDIT EG IV lane1 #5 A SOUL BURST AND THE CAGE CLOSES LAND ON THE MEMBER THEY NAME (section 13.3): the Cairn-Keeper\'s tithe unpaid bursts on the member whose soul it was; the Final Examination failed closes on the bound (a company of one: on the one) - each named, each its CHECK\'s share, landing wherever they stand (mutants: the burst naming no one; the cage naming no one)', () => {
  const K = court(1, 135, 'cairnkeeper', 2);
  const kh = K.subs.map((sub, j) => ({ sub, x: K.f.x + j * 2, z: K.f.z }));
  let burst = null;
  for (let k = 0; k < 4 * 30 && !burst; k++) burst = K.step(kh).find((f) => f.k === 'eb' && f.nm === 'Soul Burst') ?? null;
  assert.ok(burst && burst.ch === 1 && burst.p === 0.3, 'the tithe unpaid: a burst, 30%');
  assert.equal(burst.on.length, 1);
  assert.ok(K.subs.includes(burst.on[0]) && egStruck(burst, kh.map((m) => ({ ...m, x: m.x + 30 }))).map((m) => m.sub).join() === burst.on[0], 'on its member, wherever they stand');
  for (const n of [1, 3]) {
    const S = court(1, 15, 'spellmaster', n);
    const here = S.subs.map((sub, j) => ({ sub, x: S.f.x + j * 2, z: S.f.z }));
    S.step(here);
    S.L.hp = S.L.max * 0.3;
    S.step(here);
    assert.equal(S.F.mem.exam?.kind, 'seals', `n ${n}: the Final Examination`);
    const bound = S.F.mem.exam.bound ?? S.subs[0];
    let cage = null;
    for (let k = 0; k < 4 * 12 && !cage; k++) cage = S.step(here).find((f) => f.k === 'eb' && f.nm === 'The Cage Closes') ?? null;
    assert.ok(cage && cage.p === 0.7, `n ${n}: failed - the cage closes, 70%`);
    assert.deepEqual(cage.on, [bound], `n ${n}: on the bound`);
  }
});

/** A Court of three at seed 12345's hall 5 woken by the director, its fight through the wire into my screen's link (`me`
 *  acct-0 at `mine`, each companion where `pts` stands it); an errand's failure blow said, naming `on`, its mark at (x, z): my
 *  screen frames it to its landing - what struck me and the shape drawn for it. */
function screen({ on, x, z, mine, pts }) {
  const rng = seeded(7);
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); }
  const L = egLordsOf(B.F)[0], at = now + 10_000, out = [];
  assert.ok(egAim(B.F, spec, { o: L.i, s: [shDisc(x, z, 2)], at, wu: 800, p: 0.3, b: 0, el: null, nm: 'Soul Burst', ch: 1, on }, [], at - 800, out), 'said');
  const { k: _k, ...st } = egStateOf(B, at - 800);
  let E = foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), at - 800);
  E = foldEg(E, wire(egFightState(B.F, at - 800)), at - 800);
  for (const f of out) E = foldEg(E, wire(f), at - 800);
  let t = at - 700;
  const struck = [], entity = { health: 1000, maxHealth: 1000 };
  const all = { 'acct-0': mine, ...pts };
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => entity, me: () => 'acct-0', strike: (d) => struck.push(d),
    feet: () => realmToDungeon(spec.x0 + mine[0], 0, mine[1]), peerAt: (sub) => (all[sub] ? realmToDungeon(spec.x0 + all[sub][0], 1.6, all[sub][1]) : null) });
  fight.frame();
  const drawn = fight.shapes().filter((sh) => sh.kind !== undefined && Math.abs(sh.r - 2) < 1e-6).map((sh) => [Math.round(sh.origin[0] * 100) / 100, Math.round(sh.origin[1] * 100) / 100]);
  for (; t < at; t += 100) fight.frame();
  t = at; fight.frame();
  t = at + 500; fight.frame();
  return { struck: struck.reduce((a, b) => a + b, 0), drawn };
}

test('AUDIT EG IV lane1 #5 THE STRUCK SCREEN (scenes/eliteGates/egFight.js): a failure blow naming me lands on me 20 m from its mark, and its mark is drawn at my feet; one naming a companion never lands on me standing in its mark, and is drawn at the companion\'s feet (mutants: the screen\'s verdict by the stamps; the mark left where it was laid)', () => {
  const spec = egHallOf(12345, 5, 0), c = spec.ring;
  const me = screen({ on: ['acct-0'], x: c.x + 20, z: c.z, mine: [c.x, c.z], pts: { 'acct-1': [c.x + 3, c.z] } });
  assert.ok(me.struck > 0, 'named: it lands on me wherever I stand');
  assert.ok(me.drawn.some(([x, z]) => Math.abs(x - c.x) < 0.05 && Math.abs(z - c.z) < 0.05), `its mark at my feet (${JSON.stringify(me.drawn)})`);
  const other = screen({ on: ['acct-1'], x: c.x, z: c.z, mine: [c.x, c.z], pts: { 'acct-1': [c.x - 4, c.z + 1] } });
  assert.equal(other.struck, 0, 'naming a companion: nothing on me, though I stand in its mark');
  assert.ok(other.drawn.some(([x, z]) => Math.abs(x - (c.x - 4)) < 0.05 && Math.abs(z - (c.z + 1)) < 0.05), `drawn at the companion's feet (${JSON.stringify(other.drawn)})`);
});

// ── lane 1 #15: ERRANDS BY NUMERAL ────────────────────────────────────────────────────────────────────────────────────
/** The fight's given errands as `{ body: [numerals] }`. */
const givenOf = (F) => { const g = {}; for (const [i, n] of F.pg.as ?? []) (g[i] ??= []).push(n); return g; };
test('AUDIT EG IV lane1 #15 ERRANDS BY NUMERAL, THE RELAY (section 13.2: "The relay gives every errand to the nearest unassigned living member ... An errand for two groups splits the numerals at ceil(n/2) (the Twins\' courts from n = 3, the Cairn-Keeper\'s gems)"): the Examination\'s runes in their order each to the nearest member holding none - a company of one stands them all; a given rune keeps its member while both stand, and one whose member falls passes to the nearest; the gems and the Twin Lords split the company at ceil(n/2) by numeral; said on the fight\'s progress, numbered by the company\'s own numerals (mutants: given to the farthest; never kept; the round never begun again; the groups unsplit; the Twins split in one court; the numerals by order)', () => {
  assert.deepEqual([EG_ERRANDS_GIVEN, EG_GIVEN_MAX], [['rune', 'seal', 'anchor', 'banner', 'brazier', 'heart', 'pillar', 'standard'], 12]);
  // the runes: three members (numerals 2, 5, 7 - the company's own), each by the rune it stands nearest, in the runes' order
  const nums = { 'acct-0': 2, 'acct-1': 5, 'acct-2': 7 };
  const S = court(1, 15, 'spellmaster', 3, seeded(1), nums);
  let here = S.subs.map((sub, j) => ({ sub, x: S.f.x + j, z: S.f.z }));
  S.step(here);
  S.L.hp = S.L.max * 0.5;
  S.step(here);
  const runes = egObjsOf(S.F, 'rune').sort((a, b) => a.pt - b.pt);
  assert.equal(runes.length, 3, 'three runes');
  here = runes.map((r, j) => ({ sub: S.subs[(j + 1) % 3], x: r.x + 0.5, z: r.z }));   // each member beside a rune: I by acct-1, II by acct-2, III by acct-0
  S.F.mem.given = {};
  S.step(here);
  assert.deepEqual(runes.map((r) => givenOf(S.F)[r.i]), [[5], [7], [2]], 'each rune to the member beside it, by the company\'s numeral');
  // kept while both stand: the members move, the runes keep them
  here = here.map((m, j) => ({ ...m, x: runes[(j + 1) % 3].x, z: runes[(j + 1) % 3].z }));
  S.step(here);
  assert.deepEqual(runes.map((r) => givenOf(S.F)[r.i]), [[5], [7], [2]], 'kept');
  // acct-2 gone from the hall: its rune to the nearest holding none - none does, so the nearest of the least
  S.step(here.filter((m) => m.sub !== 'acct-2'));
  const g = givenOf(S.F)[runes[1].i];
  assert.equal(g.length, 1);
  assert.ok([5, 2].includes(g[0]) && g[0] !== 7, 'passed on');
  // a company of one stands every rune
  const O = court(1, 15, 'spellmaster', 1);
  const oh = [{ sub: 'acct-0', x: O.f.x, z: O.f.z }];
  O.step(oh); O.L.hp = O.L.max * 0.5; O.step(oh); O.step(oh);
  assert.deepEqual(Object.values(givenOf(O.F)), [[1], [1]], 'its two runes, both its own (numbered in order with no company\'s numerals)');
  // the gems: two groups at ceil(n/2), each member its group's nearest gem
  const K = court(1, 135, 'cairnkeeper', 4);
  const gems = egObjsOf(K.F, 'gem');
  const kh = K.subs.map((sub, j) => ({ sub, x: gems[3 - j].x, z: gems[3 - j].z }));   // I on the fourth gem ... IV on the first
  K.step(kh);
  const kg = givenOf(K.F);
  assert.deepEqual(gems.map((o) => kg[o.i] ?? []), [[1], [2], [3], [4]], 'I and II to the first two gems, III and IV to the last two - each its group\'s nearest, never the gem it stands on');
  // the Twins: two courts from n = 3 - I and II to Vael, III and IV to Isk; one court (n <= 2): none
  const T = court(1, 35, 'twins', 4);
  T.step(T.subs.map((sub, j) => ({ sub, x: T.f.x + j, z: T.f.z })));
  assert.deepEqual(givenOf(T.F), { [T.F.mem.twins.a]: [1, 2], [T.F.mem.twins.b]: [3, 4] });
  const U = court(1, 35, 'twins', 2);
  U.step(U.subs.map((sub, j) => ({ sub, x: U.f.x + j, z: U.f.z })));
  assert.deepEqual(givenOf(U.F), {}, 'one court: no groups');
  assert.ok(validEgOut(egFightState(T.F, T.now())).pg.as.length === 4, 'the wire carries it');
  // the director numbers them by the company's own numerals (III, I, II here), never its order
  const rng = seeded(3), co = [['acct-0', 'Ann', 3], ['acct-1', 'Bo', 1], ['acct-2', 'Cy', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Ann', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 65, 0);
  assert.equal(spec.lord, 'spellmaster');
  B.h = 65; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const beat = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) beat();
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.ring.x, z: spec.ring.z };
  for (let k = 0; k < 8; k++) beat();
  const sm = egLordsOf(B.F)[0];
  sm.hp = sm.max * 0.5;
  beat();
  const br = egObjsOf(B.F, 'rune').sort((a, b) => a.pt - b.pt);
  assert.equal(br.length, 3, 'the Examination\'s three runes');
  br.forEach((r, j) => { pos[co[j][0]] = { sx: spec.x0 + r.x + 0.5, z: r.z }; });
  B.F.mem.given = {};
  beat();
  assert.deepEqual(br.map((r) => givenOf(B.F)[r.i]), [[3], [1], [2]], 'each rune by the company\'s numeral of the member beside it');
});

test('AUDIT EG IV lane1 #15 ERRANDS BY NUMERAL, THE SCREEN (scenes/eliteGates/egFight.js; ui/eliteGates/egSpireHud.js): over each errand the room gave its members\' numerals - one member\'s with its name (*III - Mira*), several\'s alone - in Battlemage blue, where the camera sees the body (mutants: the words unread; the body\'s place unread; the sigil drawn as nothing)', () => {
  assert.deepEqual([egGivenWords([3], [['a', 'Mira', 3]]), egGivenWords([1, 2], []), egGivenWords([4], [])], ['III - Mira', 'I II', 'IV']);
  assert.equal(egSigilHtml({ sigil: 'given', text: 'III - <b>' }), '<span class="eg-sig eg-sig-given"><b>III - &#60;b&#62;</b></span>', 'its words, escaped');
  // the Twin Court of seed 12345, its company of four in the ring: the director gives the twins their groups
  const rng = seeded(7);
  const co = Array.from({ length: 4 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 60, 0);
  B.h = 60; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const beat = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) beat();
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.ring.x, z: spec.ring.z };
  for (let k = 0; k < 8; k++) beat();
  const [vael, isk] = egLordsOf(B.F);
  assert.deepEqual(givenOf(B.F), { [vael.i]: [1, 2], [isk.i]: [3, 4] }, 'the director gives them by the company\'s numerals');
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now);
  E = foldEg(E, wire(egFightState(B.F, now)), now);
  const me = [vael.x, vael.z - 8], t = now;   // my screen 8 m behind Vael, looking at him
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => realmToDungeon(spec.x0 + me[0], 0, me[1]), peerAt: () => null });
  fight.frame();
  const at = realmToDungeon(spec.x0 + vael.x, 0, vael.z), eye = realmToDungeon(spec.x0 + me[0], 1.6, me[1]);
  const view = lookAt(eye, at, UP_Y), proj = mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500));
  fight.drawPass(proj, view, eye, 1);
  const sg = fight.sigils().find((x) => x.key === `e${vael.i}`);
  assert.ok(sg && sg.marks[0].sigil === 'given' && sg.marks[0].text === 'I II', `Vael's group over Vael (${JSON.stringify(fight.sigils())})`);
  const over = egScreenAt(multiply(proj, view), [at[0], at[1] + vael.y + EG_GIVEN_UP_LORD_M, at[2]]);
  assert.ok(Math.abs(sg.x - over[0]) < 1e-6 && Math.abs(sg.y - over[1]) < 1e-6, 'over the body, where the camera sees it');
});

// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 7, 8, 16, 20 and
// 27.7) - FIX GROUP A2, THE DIRECTOR'S RUN, PINNED ON THE DIRECTOR. Findings pinned here:
//   L3-1   THE ORRERY'S RANGE held to what six stones can need - an Athenaeum from circle 56 hung the relay's room for ever.
//   L3-2   THE WINCH asks `min(2, n)` of the living company now, never the company the hall woke with.
//   L3-3 / L8-3  THE EARNER - a Redoubt begins the circle's part and damage again for every member, a witness too.
//   L3-4   A KYNVAL SQUAD on a Rift-Yard stands, in place of its first wave.
//   L3-6   THE FAIR TRAIL'S `here` - a member the room never heard arrive is credited nothing.
//   L3-13  THE FIRST HALL'S GATHER runs whole past the open window's end.
//   L3-14  A REHEARSAL'S COURT adds its lord's page to the Annals.
//   L3-15  A FALL THAT LEAVES NOBODY LIVING is final - its word says so, and it lays no Memento.
//   L3-19  THE GHOST AND THE CAPTIVE on every trial hall the law lays them on - a span's too - and the Captive's three chains.
//   L3-22  A FALL WITH NO PLACE (180 s absent, a `fell` with no pose) leaves its Memento at the member's last pose.
//   L7-6   A REHEARSAL IS ONE LIFE - its members enter with no recall, so a fall is final.
//   L8-7   THE HERALD'S REDOUBT TIME is the breach's own, and a breach begun deeper says where it began.
// Every fixture is the producers' own: the halls from the law (egHallOf, egCirclePlan), the breach from the director
// (egBreachNew, egEnter, egStep, egPoseIn, egFall, egWord, egBlow, egDown), its words through the wire (validEgOut), the
// herald's tell and posts from net/eliteGates/egHerald.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, egCirclePlan, egFirstHallOf, egCircleOfHall, egSeed, egTimes, EG_SEALED_MS, EG_ARRIVE_MAX_MS, EG_GATHER_MS, EG_ABSENT_TRIAL_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground and stand on it still -
// each breach's circle (and the next) given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs); LAW 9's own
// ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's
import { egBreachNew, egEnter, egStep, egPoseIn, egFall, egWord, egBlow, egDown, egCompanyOf, egOrreryTurns, egCaptiveSpots, EG_ORRERY_REACH, EG_SQUAD_HOLD_MS, EG_CHAINS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, egBodiesOf, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { egFightView, egGroundAt } from '../../../src/net/eliteGates/egWalkGraph.js';
import { orreryOf, orreryShortest, sdTurnsFor, SD_STONES, SD_HOURS } from '../../../src/net/superDungeon/sdBrain.js';
import { egAnnalsLordPage } from '../../../src/net/eliteGates/egAnnals.js';
import { validEgHeraldTell, readEgHeraldState, egHeraldFold, egHeraldPost } from '../../../src/net/eliteGates/egHerald.js';
import { cardWords } from '../../heraldCards.mjs';   // HERALD-CARDS: a post read as its card

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const MIN = 60_000;
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };

/**
 * A breach of `n` on `seed` (its Proclamation cleared), every member admitted, standing on hall `h`'s arrival plate a beat
 * after its pull, the count running from its first wake. `step(ms)` beats the director over each living member's place
 * (`put` moves one, in the hall's frame; `away` takes its socket), and `feed()` hands each placed member's pose to THE FAIR
 * TRAIL (egPoseIn) first; every frame held to the wire (`bad` counts the refused).
 */
function breach(n, h, seed = 12345, { rh = 0, ew = 0 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh, seed, op: T0, co, site: SITE, wg: [] });
  egGive8(seed, [egCircleOfHall(h), egCircleOfHall(h) + 1]);   // PIN MOVED (THE ASCENT): its circle and the next at law 8 (above)
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: 0 }; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
  const pos = {};
  const spec = () => egHallOf(seed, B.h, 0);
  const plate = (sub) => { pos[sub] = { x: spec().arrive.x + Number(sub.slice(5)) * 0.5, z: spec().arrive.z }; };
  for (const [sub] of co) plate(sub);
  const frames = [];
  let bad = 0;
  const feed = () => { const sp = spec(); for (const [sub] of co) { const p = pos[sub]; if (p && B.mem[sub].alive) egPoseIn(B, sub, { sx: sp.x0 + p.x, y: 0, z: p.z, pl: null, cl: 0 }, now); } };
  const step = (ms = 250, fair = false) => {
    now += ms;
    if (fair) feed();
    const sp = spec();
    const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive && pos[sub]).map(([sub]) => ({ sub, sx: sp.x0 + pos[sub].x, z: pos[sub].z, dead: false, at: now })), rng);
    for (const f of o) if (!wire(f)) bad++;
    frames.push(...o);
    return o;
  };
  const put = (sub, x, z) => { pos[sub] = { x, z }; };
  const away = (sub) => { delete pos[sub]; };
  const toTrial = (fair = false) => { for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step(250, fair); assert.equal(B.sg, 'trial', `hall ${B.h} woke`); };
  return { B, co, subs: co.map(([sub]) => sub), pos, plate, put, away, step, toTrial, frames, rng, spec, bad: () => bad, now: () => now, tick: (ms) => (now += ms) };
}
/** A Court's lord fallen at the next beat (its fight's own flag - net/eliteGates/egLords.js egLordsFell): the Redoubt. */
const fell = (S) => { S.B.F.mem.lordsFell = 1; return S.step(); };
/** The first hall the law lays with `want(plan's slot)` true, from circle `c0` (`{ seed, h }`). */
function hallWhere(want, c0 = 2, c1 = 12) {
  for (let seed = 1; seed < 600; seed++) for (let c = c0; c <= c1; c++) { const i = egCirclePlan(seed, c).findIndex(want); if (i >= 0) return { seed, h: egFirstHallOf(c) + i }; }
  throw new Error('no such hall');
}

// ── L3-1: THE ORRERY'S RANGE ────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-1 THE ORRERY\'S RANGE HELD TO ITS REACH (section 8.4): the Spire\'s turns range starts at 16-28 and rises by 2 every five Redoubts until its top reaches the most six stones can ever need (36 - each stone\'s way at most half the hours), 24-36 from circle 21 on; the director\'s wake of an Athenaeum at circle 57 (seed 6, Hall 283 - it hung the relay\'s room for ever) draws its Orrery on that range (mutants: the range unbounded; the cap a step higher; the wake\'s range the first circle\'s)', () => {
  const most = Math.max(...Array.from({ length: SD_HOURS }, (_, t) => sdTurnsFor(t)));
  assert.equal(EG_ORRERY_REACH, SD_STONES.length * most, 'six stones, each at most half the hours');
  assert.equal(EG_ORRERY_REACH, 36);
  assert.deepEqual([1, 5, 6, 11, 16, 20, 21, 26, 56, 57, 300].map((c) => { const r = egOrreryTurns(c); return [r.turnsMin, r.turnsMax]; }),
    [[16, 28], [16, 28], [18, 30], [20, 32], [22, 34], [22, 34], [24, 36], [24, 36], [24, 36], [24, 36], [24, 36]]);
  // a range six stones can reach, asked before the wake below draws on it (a range past it is drawn for ever)
  assert.ok(egOrreryTurns(57).turnsMin <= 36 && egOrreryTurns(57).turnsMax <= 36, 'the deep range within the reach');
  const S = breach(2, 283, 6);
  assert.equal(S.spec().kind, 'athenaeum');
  assert.equal(S.spec().c, 57);
  S.toTrial();
  const o = S.B.F.orrery, sh = orreryShortest(o, o.start);
  assert.ok(sh >= 24 && sh <= 36, `its shortest way ${sh} in 24-36`);
  const s = (egSeed(6, 0x0a7e + 283) % 2147483646) + 1;
  assert.deepEqual([...o.start], [...orreryOf(s, { turnsMin: 24, turnsMax: 36 }).start], 'drawn on the held range');
  assert.equal(S.bad(), 0);
});

// ── L3-2: THE WINCH ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-2 THE WINCH COUNTS THE LIVING (section 8.3: "only while min(2, n) members stand on its winch plates"): a pair with both living raises nothing with one on a plate; once one has fallen, the one left on a plate raises it in its 60 s and the door opens - the hall woke with two, and the wake\'s company never moved (mutants: the wake\'s company read; one plate enough for a living pair)', () => {
  const W = hallWhere((p) => p.variant === 'winch' && !p.twist, 6, 10);
  // both living, one on a plate: nothing
  const A = breach(2, W.h, W.seed);
  A.toTrial();
  const plates = A.spec().spots.winch;
  assert.ok(plates.length >= 2);
  A.put('acct-0', plates[0].x, plates[0].z);
  for (let k = 0; k < 4 * 65; k++) A.step();
  assert.equal(A.B.sg, 'trial', 'a living pair needs both plates');
  assert.equal(A.B.F.winch, 0);
  // one fallen: the other alone raises it
  const S = breach(2, W.h, W.seed);
  S.toTrial();
  egFall(S.B, 'acct-1', S.now(), [], { x: S.spec().arrive.x, z: S.spec().arrive.z });
  S.away('acct-1');
  assert.equal(S.B.F.n, 2, 'the hall woke with two');
  S.put('acct-0', plates[0].x, plates[0].z);
  let k = 0;
  for (; k < 4 * 70 && S.B.sg === 'trial'; k++) S.step();
  assert.equal(S.B.sg, 'closing', 'the door opens');
  assert.ok(k / 4 >= 59 && k / 4 <= 61, `in its 60 s (${k / 4} s)`);
  assert.equal(S.bad(), 0);
});

// ── L3-3 / L8-3: THE EARNER ACROSS A RECALL ─────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-3 / L8-3 THE EARNER IS THE CIRCLE\'S (section 16.1: "An earner, in that circle"; 16.5: "They earn nothing for the circle they were out"): a member that took its part in three halls and dealt a thousand, then fell before its Court, is begun again at the Redoubt with the living - its part and damage nothing - so, recalled and idle through the next circle, it earns nothing there and its old damage takes no share of the next circle\'s (mutants: the living alone begun again)', () => {
  const S = breach(2, 5);
  S.toTrial();
  const [a, b] = S.subs, A = S.B.mem[a], Bm = S.B.mem[b];
  // circle 1: both took a part in three halls and dealt damage - what countPart and egBlow leave on each record
  A.act = 3; A.dc = 1000; Bm.act = 3; Bm.dc = 1000;
  egFall(S.B, b, S.now(), [], { x: S.spec().arrive.x, z: S.spec().arrive.z });
  S.away(b);
  fell(S);
  assert.deepEqual(S.B.owe.filter((o) => o.claims.q === 'w').map((o) => [o.sub, o.claims.w]), [[a, 1]], 'Redoubt 1: the living earner');
  assert.deepEqual([Bm.act, Bm.dc, A.act, A.dc], [0, 0, 0, 0], 'begun again for every member - the witness too');
  for (let k = 0; k < 4 * 100 && S.B.sg === 'rest'; k++) S.step();
  assert.equal(Bm.alive, 1, 'recalled at the rest');
  // circle 2: b idle in every hall, a doing the work - to its Court
  S.B.owe = [];
  S.B.h = 10; S.B.sg = 'arrive'; S.B.pulledAt = S.now(); S.B.su = S.now() + EG_ARRIVE_MAX_MS; S.B.gatherAt = 0;
  S.plate(a); S.plate(b);
  S.toTrial();
  A.act = 3; A.dc += 5000;
  fell(S);
  assert.deepEqual(S.B.owe.filter((o) => o.claims.q === 'w').map((o) => [o.sub, o.claims.w, o.claims.sh]), [[a, 2, 1000]], 'Redoubt 2: the idle recalled member earns nothing, and the whole share is the worker\'s');
  assert.equal(S.bad(), 0);
});

// ── L3-4: A KYNVAL SQUAD ON A RIFT-YARD ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-4 A KYNVAL SQUAD ON A RIFT-YARD STANDS (section 8.7: "four Kynval elites in place of a wave ... a Rift-Yard or a Rampart"): at a yard\'s wake its four elites stand on its floor about its heart, each an elite with its affix, and the rifts\' first wave is held as the Rampart\'s march is; a Rampart\'s squad stands as before (mutants: the yard\'s squad unstood; its wave unheld)', () => {
  for (const kind of ['yard', 'rampart']) {
    const Y = hallWhere((p) => p.kind === kind && p.twist === 'squad');
    const S = breach(3, Y.h, Y.seed);
    assert.equal(S.spec().twist, 'squad');
    S.toTrial();
    const sq = egBodiesOf(S.B.F, EG_ROLE.add, EG_KIND.kynval);
    assert.ok(sq.length >= 3, `${kind}: the squad stands (${sq.length})`);
    assert.ok(sq.every((b) => egHas(b, EG_FL.elite)), `${kind}: elites`);
    assert.equal(S.B.F.waveAt, S.B.hw + EG_SQUAD_HOLD_MS, `${kind}: the first wave held`);
    if (kind === 'yard') {
      assert.equal(sq.length, 4, 'four on a yard');
      const view = egFightView(S.spec());
      assert.ok(sq.every((b) => egGroundAt(view, b.x, NaN, b.z, 0.5)), 'on its floor');
    }
    assert.equal(S.bad(), 0);
  }
});

// ── L3-6: THE FAIR TRAIL'S `here` ───────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-6 NO CREDIT BEFORE `here` (sections 7 and 21: "No member is targeted or judged before their `here`"; "the door needs a fair trail"): a screen that stands its member first at a span\'s end plate, never on the arrival plate the pull put it on, is never judged - and so never believed: the door stays shut, its step through it is refused, and a Memento under its feet is not carried; a member that stood on the plate and walked to it carries it; and a recall is the `here` of a member called back where it rises - a witness carried down a hall and recalled at a niche (mutants: the `here` unasked of a credit; the woken room\'s first arrival unasked; a recall\'s `here` unsaid)', () => {
  const S = breach(2, 2);
  const sp = S.spec(), [a, b] = S.subs;
  assert.equal(sp.kind, 'span');
  S.put(b, sp.end.x, sp.end.z);   // b's first pose: the end plate
  S.toTrial(true);
  for (let k = 0; k < 4 * 20; k++) S.step(250, true);
  assert.notEqual(S.B.mem[b].hereH, S.B.h, 'never heard arrive');
  assert.equal(S.B.sg, 'trial', 'the door stays shut');
  S.B.fwake = S.now() + 1; S.step(250, true);   // a room woken after the hall woke: its first arrival is asked for its `here` too
  assert.equal(S.B.sg, 'trial', 'a woken room opens no door on it');
  S.B.sg = 'closing'; S.B.dn = S.now();
  assert.equal(egDown(S.B, b, S.B.h, { sx: sp.x0 + sp.end.x, z: sp.end.z }, S.now()), false, 'its step refused');
  // a Memento: carried only by one heard arrive (a Rift-Yard - Hall 1)
  const Y = breach(3, 1);
  const ysp = Y.spec(), [p, q, r] = Y.subs, at = { x: ysp.arrive.x, z: ysp.arrive.z + 14 };   // on the court, off the plate
  Y.put(r, at.x + 1, at.z);   // r's first pose: by where q will fall, off the plate
  Y.toTrial(true);
  egFall(Y.B, q, Y.now(), [], at);
  Y.away(q);
  assert.equal(Y.B.mementos.length, 1);
  for (let k = 0; k < 8; k++) Y.step(250, true);
  assert.equal(Y.B.mementos[0].by, null, 'not carried by one never heard arrive');
  for (let z = ysp.arrive.z; z <= at.z; z += 1) { Y.put(p, at.x - 0.5, z); Y.step(250, true); }
  assert.equal(Y.B.mementos[0].by, p, 'carried by one that stood on the plate and walked to it');
  // a recall is the `here` of a member called back where it rises - a witness carried down from the hall it fell in
  const R = breach(2, 2);
  const rsp = R.spec(), [ra, rb] = R.subs;
  R.toTrial(true);
  egFall(R.B, rb, R.now(), [], { x: rsp.arrive.x + 1, z: rsp.arrive.z });
  R.away(rb);
  R.step(250, true);
  assert.equal(R.B.mementos[0].by, ra, 'carried from the plate');
  R.B.sg = 'closing'; R.B.dn = R.now() - 45_000; R.B.su = R.now() + 250; R.step();
  assert.equal(R.B.h, 3, 'pulled to the Proving Walk - a niche on its arrival plate');
  const niche = R.spec().spots.niche[0];
  R.put(ra, niche.x, niche.z);
  R.step(); R.step();
  assert.equal(R.B.mem[rb].alive, 1, 'recalled at the niche');
  assert.equal(R.B.mem[rb].hereH, R.B.h, 'here where it rises');
  assert.equal(S.bad() + Y.bad() + R.bad(), 0);
});

// ── L3-13: THE FIRST HALL'S GATHER ──────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-13 THE FIRST HALL\'S GATHER RUNS WHOLE (section 7: "A gather begun before the wait ends runs whole"): the breach\'s first hall, its company all here three seconds before the open window ends, wakes eight seconds after its gather began - never at the window\'s end (mutants: the window\'s end waking it first)', () => {
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  const T = egTimes({ openedAt: T0 });
  let now = T.openAt + 50;
  egStep(B, now, [], rng);
  assert.equal(B.sg, 'arrive');
  assert.equal(egEnter(B, 'acct-0', 'o'.repeat(20), 40, now), null);
  now = T.admitUntil - 3000;
  assert.equal(egEnter(B, 'acct-1', 'p'.repeat(20), 40, now), null);
  egGive8(12345, [1]);   // PIN MOVED (THE ASCENT): law 8's first circle given (above)
  const sp = egHallOf(12345, 1, 0);
  let woke = 0;
  for (; now < T.admitUntil + 10_000 && !woke; now += 250) { egStep(B, now, co.map(([sub]) => ({ sub, sx: sp.x0 + sp.arrive.x, z: sp.arrive.z, dead: false, at: now })), rng); if (B.sg === 'trial') woke = now; }
  assert.ok(woke > T.admitUntil, 'past the window\'s end');
  assert.equal(woke, T.admitUntil - 3000 + EG_GATHER_MS, 'the gather whole');
});

// ── L3-14: A REHEARSAL'S COURT AND THE ANNALS ───────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-14 A REHEARSAL\'S COURT ADDS ITS LORD\'S PAGE (section 11.10: "A lord\'s first fall adds a page"; section 20\'s EG-E2: a Rehearsal\'s too - "a page is lore, not pay"): Grath\'s fall at Redoubt 1 ends the Rehearsal and gives every living member its page, which its end receipt carries (`an`), as a keyed breach\'s Court gives it (mutants: the page withheld from a Rehearsal)', () => {
  const page = egAnnalsLordPage(egHallOf(12345, 5, 0).lord);
  assert.ok(page >= 0);
  for (const rh of [0, 1]) {
    const S = breach(2, 5, 12345, { rh });
    S.toTrial();
    fell(S);
    assert.deepEqual(S.frames.filter((f) => f.k === 'egot' && f.w === 'page').map((f) => [f.to, f.p]), S.subs.map((sub) => [sub, page]), `${rh ? 'a Rehearsal' : 'a keyed breach'}: the page to each`);
    for (const sub of S.subs) assert.equal(S.B.mem[sub].pages, 2 ** page);
    if (rh) {
      assert.equal(S.B.end, 'rehearsal');
      assert.deepEqual(S.B.owe.filter((o) => o.claims.q === 'x').map((o) => o.claims.an), [2 ** page, 2 ** page], 'its end receipts carry it');
    }
  }
});

// ── L3-15, L7-6: THE FALL THAT IS FINAL ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-15 / L7-6 A FALL THE SPIRE WILL NOT UNDO (section 16.5: "Solo stays literally one life"; section 27.7: the Rehearsal\'s "one life"): a solo member\'s first fall says it is final and lays no Memento, the breach\'s wipe following (its receipt the wipe\'s); a company\'s first fall is not final and lays one; a Rehearsal\'s members enter with no recall - its company row says so, and a first fall is final, owed its end at once (mutants: the last living member\'s fall said first; a Memento laid with nobody to carry it; a Rehearsal\'s recall)', () => {
  const solo = breach(1, 1);
  solo.toTrial();
  const out = [];
  egFall(solo.B, 'acct-0', solo.now(), out, { x: 0, z: 1 });
  assert.equal(out.find((f) => f.k === 'fall').fin, 1, 'final');
  assert.equal(solo.B.mementos.length, 0, 'no Memento nobody can carry');
  solo.away('acct-0'); solo.step();
  assert.equal(solo.B.end, 'wipe');
  assert.deepEqual(solo.B.owe.filter((o) => o.claims.q === 'x').map((o) => o.claims.why), ['wipe']);
  // a company's first fall
  const pair = breach(2, 1);
  pair.toTrial();
  const o2 = [];
  egFall(pair.B, 'acct-1', pair.now(), o2, { x: 0, z: 1 });
  assert.equal(o2.find((f) => f.k === 'fall').fin, 0);
  assert.equal(pair.B.mementos.length, 1);
  // a Rehearsal
  const R = breach(2, 2, 12345, { rh: 1 });
  assert.deepEqual(egCompanyOf(R.B).map((c) => c[9]), [0, 0], 'no recall in hand');
  assert.deepEqual(egCompanyOf({ ...R.B, mem: {} }).map((c) => c[9]), [0, 0], 'not yet entered: none either');
  R.toTrial();
  const o3 = [];
  egFall(R.B, 'acct-1', R.now(), o3, { x: 0, z: 1 });
  assert.equal(o3.find((f) => f.k === 'fall').fin, 1, 'a Rehearsal\'s fall is final');
  assert.equal(R.B.mementos.length, 0);
  assert.deepEqual(R.B.owe.filter((o) => o.claims.q === 'x').map((o) => [o.sub, o.claims.why, o.claims.rh]), [['acct-1', 'fall', 1]]);
  assert.ok(wire(o3.find((f) => f.k === 'fall')));
});

// ── L3-19: THE GHOST AND THE CAPTIVE ────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-19 THE GHOST AND THE CAPTIVE ON EVERY HALL THEY ARE LAID ON (section 8.7: "any trial hall"; the Captive\'s "three chains ... break them all and each member gains a Cantrip"): the Captive hangs three chains on the fight ground of a Span (on its islands), a Rampart (along its walkway) and a Deepway (about its chamber) as on a yard (the law\'s three); a span\'s chains broken free the Battlemage and pay each living member a Cantrip; a Battlemage\'s Ghost stands on a span and flies with the company over the course (mutants: a span\'s ghost unstood; its chains unstood; its freeing unpaid; the lane\'s three laid as one; the ghost held to the ground)', () => {
  for (const kind of ['span', 'rampart', 'deepway', 'yard']) {
    const H = hallWhere((p) => p.kind === kind && p.twist === 'captive');
    const S = breach(2, H.h, H.seed);
    S.toTrial();
    const sp = S.spec(), view = egFightView(sp), chains = S.B.F.bodies.filter((b) => b.t === 'chain');
    assert.equal(chains.length, EG_CHAINS, `${kind}: three chains`);
    assert.equal(new Set(chains.map((c) => `${c.x},${c.z}`)).size, EG_CHAINS, `${kind}: three places`);
    assert.ok(chains.every((c) => egGroundAt(view, c.x, NaN, c.z, 0.5)), `${kind}: each on the fight ground`);
    if (kind === 'span') assert.ok(chains.every((c) => view.fl.some((d) => (d.g === 'island' || d.g === 'plate') && d.t === 'd' && Math.hypot(d.x - c.x, d.z - c.z) <= d.r)), 'span: on its islands (or its plates) along the course - never a passage\'s floor');   // the merge of fix group F: law 8's spans carry a trunk passage, whose chamber floor is fight ground too
    if (kind === 'yard') assert.deepEqual(egCaptiveSpots(sp), sp.spots.chain.map((q) => [q.x, q.z]), 'the law\'s three where it lays three');
    // PIN MOVED (EG-PERFECT, spec law 10): seed 115 hall 52's Eclipse chamber runs its way 721 m under THE BROKEN WAY, past
    // the route's 640, and its next slot's hero stands instead - seed 111 hall 57 lays the same chamber under law 10
    if (kind === 'deepway') { const hero = egHallOf(111, 57, 0); assert.equal(hero.spots.chain.length, EG_CHAINS); assert.deepEqual(egCaptiveSpots(hero), hero.spots.chain.map((q) => [q.x, q.z]), 'a hero chamber\'s three, as the law lays them'); }
    if (kind === 'rampart') assert.ok(chains.every((c) => Math.abs(c.x - sp.fl[0].ax) <= sp.fl[0].hw), 'along the walkway');
    if (kind !== 'span') continue;
    // a span's freed: each chain broken from its island
    let q = 1;
    for (const c of chains) {
      for (let k = 0; k < 400 && S.B.F.bodies.includes(c); k++) { S.tick(300); egBlow(S.B, 'acct-0', { k: 'hit', i: c.i, q: q++, d: 50, r: 0 }, { sx: sp.x0 + c.x + 0.8, y: c.y ?? 0, z: c.z }, S.now()); }   // PIN MOVED (AUDIT EG V, the merge of fix group F: spec law 8 lays this span's islands lower - the blow struck from the chain's own ground)
      assert.equal(S.B.F.bodies.includes(c), false, 'broken');
    }
    S.step();
    assert.equal(S.frames.filter((f) => f.k === 'esay' && f.w === 'freed').length, 1, 'freed');
    assert.deepEqual(S.frames.filter((f) => f.k === 'egot' && f.w === 'cant').map((f) => f.to).sort(), [...S.subs].sort(), 'a Cantrip each');
    assert.equal(S.bad(), 0);
  }
  // the Ghost on a span
  const G = hallWhere((p) => p.kind === 'span' && p.twist === 'ghost');
  const S = breach(2, G.h, G.seed);
  S.toTrial();
  const ghost = () => egBodiesOf(S.B.F, EG_ROLE.add, EG_KIND.ghost)[0];
  assert.ok(ghost(), 'the ghost stands');
  assert.ok(egHas(ghost(), EG_FL.friend), 'a friend');
  const view = egFightView(S.spec());
  let flew = false;
  // PIN MOVED (AUDIT EG V, the merge of fix group F: spec law 8's first such span stands its company on the plate, where a
  // ghost beside it hovers over ground - the company crosses the course, island by island, and the ghost flies with it)
  const isles = view.fl.filter((f) => f.g === 'island').sort((a, b) => a.z - b.z);
  for (const isle of isles) {
    for (const sub of S.subs) S.put(sub, isle.x, isle.z);
    for (let k = 0; k < 4 * 10 && !flew; k++) { S.step(); const g = ghost(); if (g && !egGroundAt(view, g.x, NaN, g.z, 0.3)) flew = true; }
    if (flew) break;
  }
  assert.ok(flew, 'off the islands - in the air with the company');
  assert.equal(S.bad(), 0);
});

// ── L3-22: A FALL WITH NO PLACE ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-22 A FALL LEAVES ITS MEMENTO WHERE THE MEMBER LAST STOOD (section 16.5: "A fall leaves a gold mote where the member fell"): 180 s gone in a trial, and a `fell` word that carries no pose, each lay the Memento at the member\'s last pose in the hall - a blow\'s pose kept with its hall - which a living member can carry, and a carrier\'s own absence drops it at the carrier\'s last pose (mutants: no place, no Memento; a blow\'s pose kept without its hall)', () => {
  // absent
  const S = breach(2, 1);
  const sp = S.spec(), b = S.subs[1], at = { x: sp.arrive.x + 3, z: sp.arrive.z + 14 };
  S.toTrial();
  S.put(b, at.x, at.z);
  for (let k = 0; k < 4; k++) S.step();
  S.away(b);
  for (let k = 0; k < 4 * 181 && S.B.mem[b].alive; k++) S.step();
  assert.equal(S.B.mem[b].alive, 0, 'fallen by absence');
  assert.deepEqual(S.B.mementos.map((q) => [q.s, q.h, q.x, q.z]), [[b, S.B.h, at.x, at.z]], 'at its last pose');
  // carried by the living member that walks to it from the plate
  for (let z = sp.arrive.z; z <= at.z; z += 1) { S.put('acct-0', sp.arrive.x, z); S.step(250, true); }
  for (let x = sp.arrive.x; x <= at.x; x += 0.5) { S.put('acct-0', x, at.z); S.step(250, true); }
  assert.equal(S.B.mementos[0].by, 'acct-0', 'carried');
  // its carrier gone 180 s too: the Memento lies where the carrier last stood, carried there beat by beat (the breach wiped - nobody living)
  const at2 = { x: at.x, z: at.z + 4 };
  S.put('acct-0', at2.x, at2.z);
  for (let k = 0; k < 4; k++) S.step();
  S.away('acct-0');
  for (let k = 0; k < 4 * 181 && S.B.mem['acct-0'].alive; k++) S.step();
  assert.deepEqual(S.B.mementos.map((q) => [q.s, q.x, q.z, q.by]), [[b, at2.x, at2.z, null]], 'dropped at the carrier\'s last pose');
  // a `fell` with no pose
  const T = breach(2, 1);
  T.toTrial();
  T.put('acct-1', at.x, at.z);
  for (let k = 0; k < 4; k++) T.step();
  // its last place a blow's (net/eliteGates/egBrain.js egBlow keeps the pose it was struck from, its hall with it)
  const tsp = T.spec(), at3 = { x: at.x - 2, z: at.z + 2 }, rift = T.B.F.bodies.find((o) => o.t === 'rift');
  egBlow(T.B, 'acct-1', { k: 'hit', i: rift.i, q: 1, d: 10, r: 0 }, { sx: tsp.x0 + at3.x, y: 0, z: at3.z }, T.now());
  assert.deepEqual(T.B.mem['acct-1'].pose, { x: at3.x, z: at3.z, h: T.B.h });
  egWord(T.B, 'acct-1', { k: 'fell' }, null, T.now(), T.rng);
  assert.deepEqual(T.B.mementos.map((q) => [q.x, q.z]), [[at3.x, at3.z]]);
  assert.equal(EG_ABSENT_TRIAL_MS, 180_000);
  assert.equal(S.bad() + T.bad(), 0);
});

// ── L8-7: THE HERALD'S TIME ─────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-7 THE HERALD SAYS WHERE A BREACH BEGAN (section 20: "<opener>\'s company took Redoubt 10 of the Battlespire (Hall 50) in 1:51:20."): a Valkynaz Redoubt\'s news carries the start Redoubt (`ew`) beside its seconds from the breach\'s first wake; the hub\'s read keeps it; the tenth Redoubt\'s post and First of the Spire say "from Redoubt 9" for a breach begun there, and nothing more for one begun at Hall 1 (mutants: the start left off the news; dropped by the read; dropped by the fold; unsaid by the post)', () => {
  const posts = [];
  for (const ew of [0, 9]) {
    const S = breach(2, 50, 12345, { ew });
    S.toTrial();
    S.tick(20 * MIN);
    fell(S);
    const rd = S.B.hq.find((e) => e.k === 'rd');
    assert.equal(rd.w, 10);
    assert.equal(rd.ew, ew, 'the start rides the news');
    assert.equal(rd.t, Math.floor((S.now() - S.B.wk) / 1000));
    const tell = validEgHeraldTell({ b: S.B.b, ev: S.B.hq });
    assert.equal(tell.ev.find((e) => e.k === 'rd').ew, ew, 'kept by the hub\'s read');
    const st = egHeraldFold(readEgHeraldState(null), tell, { nowMs: S.now() });
    posts.push(...st.q.filter((p) => p.kind === 'first' || p.kind === 'rd').map((p) => cardWords(egHeraldPost(p)).split('\n').join(' | ')));
    const again = egHeraldFold({ ...st, q: [] }, { b: 'fedcba9876543210', ev: tell.ev }, { nowMs: S.now() });
    posts.push(...again.q.filter((p) => p.kind === 'rd').map((p) => cardWords(egHeraldPost(p)).split('\n').join(' | ')));
  }
  assert.equal(posts.length, 4);
  assert.ok(!posts[0].includes('Began at') && !posts[1].includes('Began at'), 'a breach begun at Hall 1');
  assert.match(posts[0], /^M0's company is the first ever to take Redoubt 10 \| Hall Hall 50 \| Time 20:0\d \| Company /);   // HERALD-CARDS: the card's fields
  assert.match(posts[2], /\| Time 20:0\d \| Began at Redoubt 9 \| Company /, 'First of the Spire says where it began');
  assert.match(posts[3], /^M0's company took Redoubt 10 \| Hall Hall 50 \| Time 20:0\d \| Began at Redoubt 9 \| Redoubt$/, 'and the tenth Redoubt\'s post');
});

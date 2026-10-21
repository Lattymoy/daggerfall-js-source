// EG-ZF (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 27.6, 27.7, 19 and 20):
// THE RECAP WHOLE AND THE ACCOUNT'S MEMORY - the director's count of each member's part (net/eliteGates/egTally.js: a Court's damage
// chart at its lord's fall, each member's damage and healing over the breach, a companion's heal believed within its
// bucket and mending the count); the wire's compact tables (`rd`'s and an end's `dm`, `st`'s and `end`'s `ds`, the `heal`
// word); the relay over the real Room (a heal named by peer id, the chart fanned with the Redoubt); the account service
// over its real Worker (the first-time lines once an account - `/v1/eg/first`, `/v1/eg/keys` `first`; an end's claim
// answering the member's standing - the recap's board line; First of the Spire's letter to the accounts its list names);
// and the client headless (the gate's chart at the lord's fall, the share and the healing on the recap, the board's line,
// the first-time lines over the account, the heal word out).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egBreachNew, egEnter, egStep, egBlow, egDown, egWord, egHeal, egEnd, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egTallyHeal, egChartOf, egTalliesOf, EG_TALLY_ROWS } from '../../../src/net/eliteGates/egTally.js';
import { egHallOf, egRoomKey, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut, validEgIn, EG_KINDS, EG_INTERNAL_OPEN, GATE_HEAL_ROWS_MAX } from '../../../src/net/wire.js';
import { healRef, HEAL_DEPTH_X, HEAL_REFILL_S } from '../../../src/net/gate/gateBrain.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { mintEgReceipt, egCompanyTag } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { EG_STATE_EMPTY, foldEg } from '../../../src/net/eliteGates/egLink.js';
import { egRecapModel, egRecapMemberLine, egRankText, egBoardLine, egRecapBoardKeep, egRecapKeep, egRecapsKept, egChartFell, drawEgPanel, destroyEgHud } from '../../../src/ui/eliteGates/egHud.js';
import { EG_PRES_TEXT, EG_TEXT_FIRST, EG_FIRST_KEYS, EG_FIRST_REHEARSAL_BIT, egFirstOver, egFirstRead, egFirstKey, EG_FIRST_KEY } from '../../../src/ui/eliteGates/egBeats.js';
import { damageChartModel, drawGateDamageChart, destroyGateDamageChart, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_MS } from '../../../src/ui/gate/gateDamageChart.js';
import { createEgClient, EG_HEAL_SEND_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { standService } from '../../accountDb.mjs';
import { EG_FIRST_BITS_MAX } from '../../../server-account/src/eg.js';
import { EG_FIRST_POST, _resetEgHonoursCache } from '../../../server-account/src/egHonours.js';
import { POST_SENDER, POST_SUBJECT_MAX, POST_BODY_MAX } from '../../../src/net/postLaw.js';
import { arenaSeasonOf } from '../../../src/net/arena/arenaLaw.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
  egGive8(77, [1, 2]);
});

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const LINE = { depth: 1, perS: 0.05 };
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const wire = (f) => validEgOut(JSON.parse(JSON.stringify(f)));

// ═══ THE DIRECTOR ═══════════════════════════════════════════════════════════════════════════════════════════════

/** A breach of `n` begun at Court hall `start` (test/net/eliteGates/egeco_herald.test.js's start-deeper harness), played by an auto-player
 *  that stands where a player would until `until`; each blow's believed share (`m.dc`'s rise) kept a hall a member -
 *  `{ d, x (on a lord), h, b }` - the tallies' own truth; `hook(B, now)` every beat. Every frame held to the wire. */
function play({ n = 3, seed = 12345, start = 5, until = () => false, hook = null, rh = 0, maxMs = 40 * 60_000 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  const pos = {};
  for (const [sub] of co) { assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null); pos[sub] = { sx: 0, z: 0 }; }
  B.h = start; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const frames = [], got = {};
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!wire(rest)) bad++; frames.push(rest); } };
  while (now < T0 + maxMs && !B.end && !until(B, frames)) {
    now += 250;
    const spec = egHallOf(B.seed, B.h, 0), F = B.F;
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive) continue;
      const p = pos[sub], x0 = spec.x0;
      const live = F ? F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128))) : [];
      const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - x0), a.z - p.z) - Math.hypot(b.x - (p.sx - x0), b.z - p.z))[0];
      if (B.sg === 'arrive') { p.sx = x0 + spec.arrive.x + (m.n - 1) * 0.5; p.z = spec.arrive.z; }
      else if (B.sg === 'trial') {
        if (spec.kind === 'court' && F && !F.bodies.some((b) => b.role === 0 && b.up2)) { p.sx = x0 + spec.ring.x; p.z = spec.ring.z; }
        else if (tgt) { const yw = tgt.yaw ?? 0, sd = m.n % 2 ? 1 : -1; p.sx = x0 + tgt.x - Math.sin(yw) * 1.5 + sd * 0.3; p.z = tgt.z - Math.cos(yw) * 1.5; }
      } else if (B.sg === 'closing') { p.sx = x0 + spec.end.x; p.z = spec.end.z; }
    }
    hook?.(B, now, take, rng);
    take(egStep(B, now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: now })), rng));
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive || B.sg !== 'trial' || !B.F) { if (m.alive && B.sg === 'closing') egDown(B, sub, B.h, pos[sub], now); continue; }
      const p = pos[sub], sp = egHallOf(B.seed, B.h, 0);
      const live = B.F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128)));
      const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - sp.x0), a.z - p.z) - Math.hypot(b.x - (p.sx - sp.x0), b.z - p.z))[0];
      if (!tgt) continue;
      const before = m.dc;
      take(egBlow(B, sub, { k: 'hit', i: tgt.i, q: Math.floor(now / 250), d: 200, r: 1 }, { sx: p.sx, z: p.z }, now));
      const d = m.dc - before;
      if (d > 0) { const g = (got[`${B.h}:${sub}`] ??= { d: 0, x: 0, h: 0, b: 0 }); g.d += d; if (tgt.role === 0) g.x += d; g.h++; g.b = Math.max(g.b, d); }
    }
  }
  return { B, frames, bad, got, now: () => now };
}
const sumOf = (got, sub) => Object.entries(got).filter(([k]) => k.endsWith(`:${sub}`)).reduce((a, [, g]) => a + g.d, 0);

test('EG-ZF the director: THE DAMAGE CHART AT THE COURT\'S FALL (section 27.6) - said with the Redoubt (`rd`\'s `dm`): a row a member, each the relay\'s own count of what they dealt in the Court, the lord\'s part, the blows, the heaviest, their falls there and what they healed in others, most dealt first; each member\'s damage and healing over the breach on the state and the end (`ds`); a Rehearsal\'s end at its lord\'s fall says its chart; no chart outside a Court (mutants: the lord\'s part unkept; a blow uncounted; the heaviest not the heaviest; a fall uncounted; a heal uncredited; the chart outside a Court; the end\'s chart dropped)', () => {
  let healed = 0, fell = false;
  // a breach begun at Hall 4 - a Rampart, then the Court: the whole breach's damage spans two halls, the chart one
  const R = play({ start: 4, until: (b) => b.sg === 'rest', hook: (B, now, take, rng) => {
    if (B.sg !== 'trial' || !B.F?.tl) return;
    if (!healed && B.F.bodies.some((b) => b.role === 0 && b.ph)) healed = egHeal(B, 'acct-1', [['acct-0', 50], ['acct-2', 30]], now, LINE, undefined, () => true);   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen
    // acct-2 falls in the Court once the lord is half down - the chart counts it
    const L = B.F.bodies.find((b) => b.role === 0);
    if (!fell && L && L.hp < L.max / 2) { fell = true; take(egWord(B, 'acct-2', { k: 'fell' }, null, now, rng)); }
  } });
  assert.equal(R.bad, 0, 'every frame passes the wire');
  assert.equal(R.B.sg, 'rest', 'the Court fell');
  assert.ok(Object.keys(R.got).some((k) => k.startsWith('4:')), 'the Rampart fought first');
  assert.equal(healed, 80);
  const rdF = R.frames.find((f) => f.k === 'rd');
  assert.ok(rdF?.dm, 'the chart said with the Redoubt');
  const W = Math.round;
  const want = ['acct-0', 'acct-1', 'acct-2'].map((sub) => {
    const g = R.got[`5:${sub}`];
    return [sub, 40, W(g.d), Math.min(W(g.d), W(g.x)), g.h, Math.min(W(g.d), W(g.b)), sub === 'acct-2' ? 1 : 0, sub === 'acct-0' ? 50 : sub === 'acct-2' ? 30 : 0];
  }).sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
  assert.deepEqual(rdF.dm, want, 'each row the relay\'s own count of the Court alone');
  assert.ok(rdF.dm.every((r) => r[3] > 0 && r[3] < r[2]), 'the lord\'s part is a part');
  assert.deepEqual(wire(rdF).dm, rdF.dm, 'the wire keeps it whole');
  // the whole breach: every hall's blows, and the heals
  assert.deepEqual(egStateOf(R.B, R.now()).ds, ['acct-0', 'acct-1', 'acct-2'].map((sub) => [sub, W(sumOf(R.got, sub)), sub === 'acct-0' ? 50 : sub === 'acct-2' ? 30 : 0]));
  assert.ok(sumOf(R.got, 'acct-0') > R.got['5:acct-0'].d, 'the Rampart\'s blows counted in the breach\'s, never in the chart');
  const out = [];
  egEnd(R.B, 'home', R.now() + 1000, out);
  const end = out.find((f) => f.k === 'end');
  assert.deepEqual(end.ds, egStateOf(R.B, R.now()).ds, 'the end says the recap\'s numbers');
  assert.equal(end.dm, undefined, 'an end away from a lord\'s fall says no chart');
  assert.deepEqual(wire(end).ds, end.ds);
  // a Rehearsal ends at its lord's fall: its chart rides the end
  const rh = play({ n: 1, rh: 1 });
  assert.equal(rh.B.end, 'rehearsal');
  const rhEnd = rh.frames.find((f) => f.k === 'end');
  assert.ok(!rh.frames.some((f) => f.k === 'rd'), 'no Redoubt taken');
  assert.deepEqual(rhEnd.dm, [['acct-0', 40, W(rh.got['5:acct-0'].d), W(rh.got['5:acct-0'].x), rh.got['5:acct-0'].h, W(rh.got['5:acct-0'].b), 0, 0]]);
  assert.deepEqual(wire(rhEnd).dm, rhEnd.dm);
  // outside a Court no chart is laid
  const yard = play({ n: 1, start: 1, until: (b) => b.sg === 'closing' });
  assert.equal(yard.B.F.tl, undefined, 'a Yard lays no chart');
  assert.deepEqual(egChartOf(yard.B), []);
  assert.ok(egTalliesOf(yard.B)[0][1] > 0, 'its blows still count for the breach');
  // an end mid-Court (a tear with its lord on its feet) says no chart: the lord never fell
  const mid = play({ n: 1, until: (b) => (b.F?.tl?.['acct-0']?.[0] ?? 0) > 0 });
  assert.ok(egChartOf(mid.B).length === 1, 'the Court\'s chart stands, unsaid');
  const torn = [];
  egEnd(mid.B, 'tear', mid.now(), torn);
  assert.equal(torn.find((f) => f.k === 'end').dm, undefined, 'no lord\'s fall, no chart');
  // the chart's rows: every member with a part and every member standing in the Court, most dealt first (ties the
  // company's order), never one who walked home with no part in it
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2], ['acct-2', 'Bob', 3], ['acct-3', 'Dee', 4]];
  const C = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 7, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  co.forEach(([sub], i) => egEnter(C, sub, `${'o'.repeat(19)}${i}`, 10 + i, T0 + EG_SEALED_MS));
  C.mem['acct-3'].home = T0;
  C.F = { tl: { 'acct-0': [100.4, 0, 1, 100.4, 1, 20], 'acct-1': [500, 400, 3, 200, 0, 0] } };
  assert.deepEqual(egChartOf(C), [['acct-1', 11, 500, 400, 3, 200, 0, 0], ['acct-0', 10, 100, 0, 1, 100, 1, 20], ['acct-2', 12, 0, 0, 0, 0, 0, 0]]);
  C.F.tl['acct-2'] = [500, 0, 1, 500, 0, 0];
  assert.deepEqual(egChartOf(C).map((r) => r[0]), ['acct-1', 'acct-2', 'acct-0'], 'a tie in the company\'s order');
});

test('EG-ZF the director: A COMPANION\'S HEAL (section 27.6) - credited to the healer by the receiver\'s word, never to itself, never to a stranger or one who never entered; believed within the receiver\'s heal bucket (the gate\'s: a whole reference health refilled over HEAL_REFILL_S, HEAL_DEPTH_X deep); a fallen member\'s word still heard (a heal before a fall), a forsaken one\'s not, nor any after the end; what was believed mends the receiver\'s count (mutants: a self-heal credited; the bucket unbounded; the refill wrong; the count unmended)', () => {
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2], ['acct-2', 'Bob', 3]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 7, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'a'.repeat(20), 10, now);
  egEnter(B, 'acct-1', 'b'.repeat(20), 10, now);   // acct-2 never enters
  const ref = healRef(10), depth = HEAL_DEPTH_X * ref;
  assert.equal(egTallyHeal(B, 'acct-0', [['acct-0', 100], ['acct-2', 100], ['', 100]], now), 0, 'itself, one who never entered, an unnamed id: nobody');
  assert.equal(egTallyHeal(B, 'acct-0', [['acct-1', depth + 500]], now), depth, 'a whole bucket at most');
  assert.equal(B.mem['acct-1'].ht, depth);
  assert.equal(egTallyHeal(B, 'acct-0', [['acct-1', 50]], now), 0, 'the bucket spent');
  assert.equal(egTallyHeal(B, 'acct-0', [['acct-1', 1000]], now + 1500), Math.round((ref / HEAL_REFILL_S) * 1.5 * 1e6) / 1e6, 'refilled at a reference health over HEAL_REFILL_S');
  assert.equal(B.mem['acct-0'].ht, undefined, 'the receiver is credited nothing');
  // the count: an ally's mend, out of no budget of its own
  const m1 = B.mem['acct-1'];
  bodyStruck(m1, 0.6, now, LINE);
  const v0 = m1.bd.v;
  const got = egHeal(B, 'acct-1', [['acct-0', 40]], now, LINE, undefined, () => true);   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen
  assert.equal(got, 40);
  assert.ok(Math.abs(m1.bd.v - (v0 + 40 / ref)) < 1e-9, 'the count mended by the share of the reference health believed');
  assert.equal(B.mem['acct-0'].ht, 40);
  // a fallen member's word is still heard; a forsaken one's, and any after the end, not
  B.mem['acct-1'].alive = 0;
  assert.equal(egTallyHeal(B, 'acct-1', [['acct-0', 10]], now + 60_000), 10, 'a heal before a fall, said after it');
  B.mem['acct-1'].forsaken = 1;
  assert.equal(egTallyHeal(B, 'acct-1', [['acct-0', 10]], now + 60_000), 0);
  B.mem['acct-1'].forsaken = 0; B.end = 'tear';
  assert.equal(egTallyHeal(B, 'acct-1', [['acct-0', 10]], now + 60_000), 0, 'nothing after the end');
  assert.equal(EG_TALLY_ROWS, 8);
});

test('EG-ZF the wire (section 23): the member\'s `heal` - the gate\'s own word and law (each caster by peer id, once, a whole number of points); the Redoubt\'s and an end\'s chart (`dm`: a row a member, the lord\'s part and the heaviest within the whole, most dealt first, none twice - anything else no chart, never no Redoubt); each member\'s part on the state and the end (`ds` - a state that says a bad one is no state) (mutants: a chart unsorted kept; the lord\'s part past the whole kept; a member twice kept; the Redoubt refused for its chart)', () => {
  assert.ok(EG_KINDS.includes('heal'));
  assert.deepEqual(validEgIn({ k: 'heal', h: [['peer-ann', 40], ['peer-bob', 3]], x: 1 }), { k: 'heal', h: [['peer-ann', 40], ['peer-bob', 3]] });
  for (const h of [[], [['peer-ann', 0]], [['peer-ann', 1.5]], [['peer-ann', 4], ['peer-ann', 5]], [['x', 4]], Array.from({ length: GATE_HEAL_ROWS_MAX + 1 }, (_, i) => [`peer-${i}000`, 1])]) assert.equal(validEgIn({ k: 'heal', h }), null, JSON.stringify(h).slice(0, 60));
  const rdW = { k: 'rd', w: 1, h: 5, at: T0, cl: 1_800_000, g: 900_000, v: 0, cov: 0 };
  const dm = [['acct-0', 40, 9000, 8000, 200, 200, 0, 50], ['acct-1', 38, 7000, 6000, 180, 210, 1, 0]];
  assert.deepEqual(validEgOut({ ...rdW, dm }).dm, dm);
  assert.equal(validEgOut(rdW).dm, undefined, 'none said, none kept');
  for (const bad of [[dm[1], dm[0]], [[...dm[0].slice(0, 3), 9001, ...dm[0].slice(4)]], [[...dm[0].slice(0, 5), 9001, ...dm[0].slice(6)]], [dm[0], dm[0]], [['acct-0', 0, 1, 1, 1, 1, 0, 0]], [dm[0].slice(0, 7)], 'x']) {
    const v = validEgOut({ ...rdW, dm: bad });
    assert.ok(v, 'the Redoubt kept');
    assert.equal(v.dm, undefined, `no chart: ${JSON.stringify(bad).slice(0, 60)}`);
  }
  const E = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'Mac', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const st = { ...egStateOf(E, T0), ds: [['acct-0', 12, 3]] };
  assert.deepEqual(wire(st).ds, [['acct-0', 12, 3]]);
  assert.equal(wire({ ...st, ds: [['acct-0', 1, 1], ['acct-0', 1, 1]] }), null, 'a member twice: no state');
  assert.equal(wire({ ...st, ds: [['acct-0', -1, 1]] }), null);
  assert.deepEqual(wire({ k: 'end', why: 'home', at: T0, ds: [['acct-0', 5, 0]], dm: [dm[0]] }), { k: 'end', why: 'home', at: T0, ds: [['acct-0', 5, 0]], dm: [dm[0]] });
  assert.deepEqual(wire({ k: 'end', why: 'home', at: T0 }), { k: 'end', why: 'home', at: T0, ds: [] }, 'an end that says none');
  // the link keeps them: the state's numbers, the Redoubt's chart, the end's
  let s = foldEg(EG_STATE_EMPTY, wire(st), T0);
  assert.deepEqual(s.ds, [['acct-0', 12, 3]]);
  s = foldEg(s, wire({ ...rdW, dm }), T0 + 1);
  assert.deepEqual(s.chart, { at: T0, h: 5, dm });
  s = foldEg(s, wire({ ...rdW, at: T0 + 5 }), T0 + 2);
  assert.deepEqual(s.chart.dm, dm, 'a Redoubt that says none leaves the last chart');
  s = foldEg(s, wire({ k: 'end', why: 'last', at: T0 + 9, ds: [['acct-0', 20, 3]], dm: [dm[0]] }), T0 + 3);
  assert.deepEqual([s.ds, s.chart.at, s.chart.dm], [[['acct-0', 20, 3]], T0 + 9, [dm[0]]]);
});

// ═══ THE RELAY ══════════════════════════════════════════════════════════════════════════════════════════════════

const RB = 'feedfacecafe0123';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const poseAt = (spec, x, z, y = 0) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');

test('EG-ZF relay (real Room): A MEMBER\'S `heal` - each healer the socket in the room its peer id names, credited within the bucket (a stranger\'s id, its own, nobody\'s: nothing); the count mended; THE CHART fanned with the Redoubt at the lord\'s fall to every socket, each row the room\'s count, and the state saying each member\'s part (mutants: the peer id unread; the chart unsaid)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const eg = fakeRoom(egRoomKey(RB), { now: () => clock });
  try {
    await quiet(async () => {
      const co = [['acct-mac', 'Mac', 1], ['acct-ann', 'Ann', 2]];
      const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: RB, ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE }) }));
      assert.equal(res.status, 200);
      const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      clock += EG_SEALED_MS; await beat(1000);
      const first = egHallOf(12345, 1, 0), spec = egHallOf(12345, 5, 0);
      const socks = {};
      for (const [i, [sub]] of co.entries()) {
        const ws = eg.connect();
        await eg.hello(ws, `peer-${sub}`, poseAt(first, first.arrive.x, first.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
        const z = await mintEgOrder({ o: 'egadmit', s: sub, eb: RB, ez: `${'a'.repeat(19)}${i}` }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
        socks[sub] = ws;
      }
      const R = () => eg.room._eg;
      Object.assign(R(), { h: 5, sg: 'arrive', wk: clock, cnt: { left: 1_800_000, at: clock }, pulledAt: clock, su: clock + 30_000 });
      for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
      await beat(EG_GATHER_MS + 1000);
      assert.equal(R().sg, 'trial', 'the Court woke');
      assert.ok(R().F.tl, 'its chart laid');
      // the heals: Ann's spell healed Mac 60 and Mac's healed Ann 25 - each said by its receiver, the healer by peer id
      bodyStruck(R().mem['acct-mac'], 0.5, clock, eg.room._egLine());
      const v0 = R().mem['acct-mac'].bd.v;
      // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen - Ann's spell on Mac, relayed by the room (ALLY-CAST's directed frame)
      await eg.raw(socks['acct-ann'], JSON.stringify({ t: 'cast', data: { to: 'peer-acct-mac', level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [{ type: 10, subType: 8, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
        durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] } } }));
      await eg.raw(socks['acct-mac'], JSON.stringify({ t: 'eg', k: 'heal', h: [['peer-acct-ann', 60], ['peer-nobody', 99], ['peer-acct-mac', 99]] }));
      assert.ok(Math.abs(R().mem['acct-mac'].bd.v - (v0 + 60 / healRef(20))) < 1e-9, 'Mac\'s count mended by what was believed');
      await eg.raw(socks['acct-ann'], JSON.stringify({ t: 'eg', k: 'heal', h: [['peer-acct-mac', 25]] }));
      assert.deepEqual([R().mem['acct-ann'].ht, R().mem['acct-mac'].ht], [60, 25], 'each healer credited; a stranger\'s id and its own nothing');
      assert.deepEqual(R().F.tl['acct-ann'][5], 60, 'and on the Court\'s chart');
      // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow - the company steps into the wake ring and wakes it first
      // (before, Mac struck it asleep, the company on the arrival plate)
      for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.ring.x, spec.ring.z));
      await beat(1000);
      assert.ok(R().F.bodies.some((b) => b.role === 0 && b.up2), 'the lord woke');
      // Mac's blows on the lord through the room's own word, from behind it - each the director's believed share
      const lord = R().F.bodies.find((b) => b.role === 0);
      let q = 1, dealt = 0, best = 0, blows = 0;
      for (let k = 0; k < 4; k++) {
        const L = R().F.bodies.find((b) => b.i === lord.i), yw = L.yaw ?? 0;
        await eg.pose(socks['acct-mac'], poseAt(spec, L.x - Math.sin(yw) * 1.5, L.z - Math.cos(yw) * 1.5));
        const before = R().mem['acct-mac'].dc;
        await eg.raw(socks['acct-mac'], JSON.stringify({ t: 'eg', k: 'hit', i: L.i, q: q++, d: 200, r: 1 }));
        const d = R().mem['acct-mac'].dc - before;
        if (d > 0) { dealt += d; best = Math.max(best, d); blows++; }
        clock += 300;
      }
      assert.ok(blows > 0 && dealt > 0, 'the lord struck');
      // its lords fall: the Redoubt says the chart to every socket
      R().F.mem.lordsFell = 1;
      await beat(500);
      assert.equal(R().sg, 'rest', 'the Redoubt taken');
      for (const ws of Object.values(socks)) {
        const r = egs(ws).find((m) => m.k === 'rd');
        assert.ok(r && validEgOut(r), 'the Redoubt said, and the wire keeps it');
        assert.deepEqual(validEgOut(r).dm, [['acct-mac', 20, Math.round(dealt), Math.round(dealt), blows, Math.round(best), 0, 25], ['acct-ann', 20, 0, 0, 0, 0, 0, 60]], 'the chart, the room\'s count, most dealt first - every blow on the lord');
      }
      await beat(7000);
      const st = egs(socks['acct-ann']).filter((m) => m.k === 'st').at(-1);
      assert.deepEqual(validEgOut(st).ds, [['acct-mac', Math.round(dealt), 25], ['acct-ann', 0, 60]], 'the rest\'s state says each member\'s part');
    });
  } finally { Date.now = realNow; }
});

// ═══ THE ACCOUNT SERVICE ═════════════════════════════════════════════════════════════════════════════════════════

let bseq = 0;
const breach = () => (0x2000000000000 + ++bseq).toString(16).padStart(16, '0');
async function stood(t, extra = {}) {
  let clock = 1_790_400_000 * 1000;
  t.mock.method(Date, 'now', () => clock);
  _resetEgHonoursCache();
  const S = await standService(extra);
  return { S, now: () => Math.floor(clock / 1000), at: (s) => { clock = s * 1000; } };
}
// PIN MOVED (AUDIT EG III, lane3 #4 - TEST THE SHAPE THE PRODUCER MINTS): every end the relay mints carries its company
// (`co` - net/eliteGates/egBrain.js oweEnd, egCompanyTag over the breach's entrants), and this fixture carried none, so the standing's
// own key (the claimers) matched the board's fallback and never the key every real end is ranked under. `co` names the
// breach's entrants (the claimer alone by default).
const endReceipt = (S, now, who, { co = [who.id], ...o } = {}) => mintEgReceipt({ q: 'x', b: breach(), s: who.id, z: 'z'.repeat(16), c: 9, h: 15, t: 2000, n: 1, ew: 0, l: 12, why: 'home', co: egCompanyTag(co), ...o }, S.gatePriv, { subtle, nowS: now() });

test('EG-ZF service: THE FIRST-TIME LINES ONCE AN ACCOUNT (section 27.7) - `/v1/eg/first` ORs a client\'s lines onto the account (a bit once held is held), answered on `/v1/eg/keys` (`first`); a guest refused (the device keeps its own), a number that is no lines refused; the bits are sixteen, past the page\'s nine and the Rehearsal\'s (mutants: the bits replaced, not OR\'ed; a guest kept; the bound unchecked)', async (t) => {
  const { S } = await stood(t);
  const me = await S.registered('Firstling');
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.first, 0);
  assert.deepEqual((await S.call('/v1/eg/first', { bits: 0b101 }, me.secret)).body, { first: 0b101 });
  assert.deepEqual((await S.call('/v1/eg/first', { bits: 0b010 }, me.secret)).body, { first: 0b111 }, 'OR\'ed - a line once said stays said');
  assert.deepEqual((await S.call('/v1/eg/first', { bits: 0 }, me.secret)).body, { first: 0b111 });
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.first, 0b111, 'the next device reads them');
  for (const bits of [-1, 1.5, EG_FIRST_BITS_MAX + 1, '7', null]) assert.deepEqual(await S.call('/v1/eg/first', { bits }, me.secret), { status: 400, body: { error: 'bits' } }, String(bits));
  const g = await S.guest();
  assert.deepEqual(await S.call('/v1/eg/first', { bits: 1 }, g.secret), { status: 403, body: { error: 'guest' } }, 'a guest: the device keeps its own');
  assert.equal((await S.call('/v1/eg/first', { bits: 1 })).status, 401, 'no session, no lines');
  assert.ok(EG_FIRST_REHEARSAL_BIT < 16 && EG_FIRST_BITS_MAX === 0xffff, 'room for every line the client keeps');
  assert.equal(S.env.DB._raw.prepare('SELECT eg_first FROM players WHERE id = ?').get(me.id).eg_first, 0b111);
  assert.match(rd('server-account/migrations/0124_elite_breach.sql'), /ALTER TABLE players ADD COLUMN eg_first INTEGER NOT NULL DEFAULT 0;/);
});

test('EG-ZF service: THE RECAP\'S BOARD LINE (section 27.6) - an end\'s claim answers the member\'s standing: its company\'s rank in its Descent bracket where the breach ranks there (begun at Hall 1, unwagered), moving as deeper companies claim, asked again the same; a wagered or deeper-started breach the account\'s rank on the Depths; a Rehearsal or no hall cleared none (mutants: the bracket wrong; the rank off by one; a wagered breach on the Descent; a Rehearsal answered)', async (t) => {
  const { S, now, at } = await stood(t);
  const season0 = arenaSeasonOf(now());
  const who = {};
  for (const h of ['Lead', 'Mate', 'Far', 'Wide', 'Solo']) who[h] = await S.registered(h);
  // the company's first to claim the one whose id sorts last: the company is its accounts however they came in
  const [lead, mate] = who.Lead.id > who.Mate.id ? [who.Lead, who.Mate] : [who.Mate, who.Lead];
  const { Far: far, Wide: wide, Solo: solo } = who;
  // each claim a second after the last: the boards' ties go to the first there
  const claim = async (w, r) => { at(now() + 1); return (await S.call('/v1/eg/claim', { receipt: r }, w.secret)).body; };
  const b1 = breach();
  const r1 = await endReceipt(S, now, lead, { b: b1, h: 15, n: 2, co: [lead.id, mate.id] });
  assert.deepEqual((await claim(lead, r1)).board, { k: 'descent', br: 'few', rank: 1 }, 'the Few, first');
  assert.deepEqual((await claim(mate, await endReceipt(S, now, mate, { b: b1, h: 15, n: 2, co: [lead.id, mate.id] }))).board, { k: 'descent', br: 'few', rank: 1 }, 'the same company');
  const b2 = breach();
  assert.deepEqual((await claim(far, await endReceipt(S, now, far, { b: b2, h: 25, n: 2, co: [far.id, wide.id] }))).board, { k: 'descent', br: 'few', rank: 1 });
  await claim(wide, await endReceipt(S, now, wide, { b: b2, h: 25, n: 2, co: [far.id, wide.id] }));
  const again = await claim(lead, r1);
  assert.deepEqual([again.recorded, again.board], [false, { k: 'descent', br: 'few', rank: 2 }], 'asked again: a deeper company stands above it now');
  assert.deepEqual((await claim(solo, await endReceipt(S, now, solo, { h: 5, n: 1 }))).board, { k: 'descent', br: 'alone', rank: 1 }, 'Alone');
  // off the Descent: the Depths, the account's own rank this season from any start
  assert.deepEqual((await claim(solo, await endReceipt(S, now, solo, { h: 40, n: 1, wg: [1] }))).board, { k: 'depths', rank: 1 }, 'a wagered breach: the Depths');
  assert.deepEqual((await claim(mate, await endReceipt(S, now, mate, { h: 12, n: 1, ew: 2 }))).board, { k: 'depths', rank: 5 }, 'a deeper start: the Depths - its best this season (40, 25, 25, 15, then its own 15)');
  assert.equal((await claim(lead, await endReceipt(S, now, lead, { h: 5, n: 1, why: 'rehearsal', rh: 1 }))).board, undefined, 'a Rehearsal: none');
  assert.equal((await claim(lead, await endReceipt(S, now, lead, { h: 0, n: 1, why: 'wipe' }))).board, undefined, 'no hall cleared: none');
  assert.equal(arenaSeasonOf(now()), season0, 'one season throughout');
});

test('EG-ZF service: FIRST OF THE SPIRE\'S LETTER (section 19 - "granted as Hour\'s First was: a list in the service\'s config, and the mailbox") - an account EG_FIRST_HANDLES names is written its letter at its balance\'s read, once whatever how often it reads; the developers\' words, within the post\'s bounds, no item; an account not listed, and a guest, none; the box shows it (mutants: the list unread; the letter twice; a letter to everyone)', async (t) => {
  const { S, now } = await stood(t, { EG_FIRST_HANDLES: ' Vanguard , Rook' });
  const van = await S.registered('Vanguard'), other = await S.registered('Plain');
  const post = (who) => S.env.DB._raw.prepare('SELECT batch, sender, subject, body, item, sent_at FROM server_post WHERE to_id = ?').all(who.id);
  assert.deepEqual(post(van), []);
  await S.call('/v1/eg/keys', {}, van.secret);
  await S.call('/v1/eg/keys', {}, van.secret);
  await S.call('/v1/eg/keys', {}, other.secret);
  assert.deepEqual(post(van).map((p) => ({ ...p })), [{ batch: EG_FIRST_POST.batch, sender: POST_SENDER, subject: 'First of the Spire', body: EG_FIRST_POST.body, item: null, sent_at: now() }], 'once, the developers\' words');
  assert.deepEqual(post(other), [], 'never to one the list does not name');
  assert.ok(EG_FIRST_POST.subject.length <= POST_SUBJECT_MAX && EG_FIRST_POST.body.length <= POST_BODY_MAX);
  assert.match(EG_FIRST_POST.body, /^You were the first ever to take Redoubt 10 of the Battlespire\. The Spire remembers\.\n\nYour title, First of the Spire, and its aura, Firstlight, are yours to wear - choose them on your profile\.\n\n- The Developers$/);
  const box = await S.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${van.secret}` } });
  const heads = (await box.json()).post;
  assert.deepEqual(heads.map((p) => [p.subject, p.from, p.item, p.read]), [['First of the Spire', POST_SENDER, null, false]], 'in the mailbox beside the hourglass');
  // empty config: nobody
  const quietS = await standService({ EG_FIRST_HANDLES: '' });   // the clock stood above: one mock of it, restored once
  const q = await quietS.registered('Vanguard');
  await quietS.call('/v1/eg/keys', {}, q.secret);
  assert.equal(quietS.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post').get().n, 0);
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════════════════════

const ME = 'acct-0';
const CB = '0123456789abcdef';
function fakeDocument() {
  const doc = { writes: 0 };
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', _text: '', _cls: '' };
    n.style = { _p: {}, setProperty(k, v) { this._p[k] = String(v); }, getPropertyValue(k) { return this._p[k] ?? ''; } };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); doc.writes++; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); doc.writes++; } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.querySelectorAll = (sel) => { const m = /^\[([a-z-]+)\]$/.exec(sel); const out = []; const walk = (x) => { for (const c of x.children) { if (m && c.attrs[m[1]] != null) out.push(c); walk(c); } }; walk(n); return out; };
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const textOf = (n) => JSON.stringify(n, (k, v) => (k === 'parent' ? undefined : v));
const tick = () => new Promise((r) => setImmediate(r));

/** A client inside a breach of two at hall `h` (test/net/eliteGates/egpres_hud.test.js's harness), its account stubbed: `keys` answering
 *  `first` (`acct` - null: no such answer), `claim` answering `board` for an end, `first` kept. */
function inBreach({ h = 5, sg = 'trial', store = null, acct = null, board = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: CB, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = h; Br.sg = sg; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], said = [], firsts = [], claims = [];
  let inside = true;
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? Br.b : null), egHallCircle: () => Math.ceil(h / 5), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  const mem = new Map();
  const st = store ?? { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } };
  const account = {
    me: () => ME, guest: () => false,
    keys: async () => (acct == null ? { ok: false, error: 'offline' } : { ok: true, data: { keys: 0, first: acct } }),
    claim: async (r) => { claims.push(r); return { ok: true, data: { recorded: true, q: 'x', keys: 0, ...(board ? { board } : {}) } }; },
    first: async (bits) => { firsts.push(bits); return { ok: true, data: { first: (acct ?? 0) | bits } }; },
  };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { entity.health -= n; }, peers: () => [], store: st,
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { const v = wire(w); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(Br, clock));
  const spec = egHallOf(77, h, 0);
  if (spec.arrive) player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B: Br, entity, sent, said, firsts, claims, tell, store: st, step: (ms) => { clock += ms; }, now: () => clock, out: () => { inside = false; } };
}

test('EG-ZF client: THE CHART AT A LORD\'S FALL (section 27.6) - the gate\'s own chart (ui/gate/gateDamageChart.js) a beat after the Redoubt, each row the company\'s name and the room\'s numbers, the lord\'s part in its own column, Healed where anyone healed, my row marked, the lord named; gone after DAMAGE_CHART_MS; an end\'s chart outlives the walk out (mutants: the chart never drawn; the Lord column the crystals\'; the Healed column always; the chart never put away)', async (t) => {
  let wall = 1_000_000;
  t.mock.method(Date, 'now', () => wall);
  const doc = fakeDocument(), had = globalThis.document;
  globalThis.document = doc;
  try {
    const dm = [[ME, 30, 9000, 8000, 200, 200, 0, 50], ['acct-1', 30, 7000, 6000, 180, 210, 1, 0]];
    // the pure reading
    const E = { ...EG_STATE_EMPTY, b: CB, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 1, 1]], chart: { at: T0, h: 5, dm } };
    assert.deepEqual(egChartFell(E).dm, [{ n: 'Mac', l: 30, d: 9000, x: 8000, h: 200, b: 200, f: 0, hl: 50 }, { n: 'Ann', l: 30, d: 7000, x: 6000, h: 180, b: 210, f: 1, hl: 0 }]);
    assert.ok(!('hl' in egChartFell({ ...E, chart: { at: T0, h: 5, dm: dm.map((r) => [...r.slice(0, 7), 0]) } }).dm[0]), 'no Healed column where nobody healed');
    assert.equal(egChartFell({ ...E, chart: null }), null);
    const M = damageChartModel(egChartFell(E), { boss: 'Grath', me: 'Mac', since: 0, now: DAMAGE_CHART_DELAY_MS, crystals: EG_PRES_TEXT.chartLord });
    assert.deepEqual(M.head, ['#', 'Challenger', 'Damage', 'Share', 'Blows', 'Best', 'Lord', 'Falls', '', 'Healed']);
    assert.deepEqual(M.rows.map((r) => [r.name, r.damage, r.share, r.crystals, r.heal, r.mine]), [['Mac', '9,000', '56%', '8,000', '50', true], ['Ann', '7,000', '44%', '6,000', '0', false]]);
    assert.equal(EG_PRES_TEXT.chartSub('Grath', 2, false), 'Grath has fallen - a company of 2');
    assert.equal(EG_PRES_TEXT.chartSub('The Twin Lords', 1, true), 'The Twin Lords have fallen - one alone');
    // the client: the Redoubt's chart, a beat after it is heard
    const P = inBreach({ h: 5 });
    P.client.frame();
    P.tell({ k: 'rd', w: 1, h: 5, at: P.now(), cl: 1_500_000, g: 900_000, dm });
    P.client.frame();
    const chart = () => find(doc.body, 'wb-dmg-chart')[0] ?? null;
    assert.ok(!chart() || chart().style.display === 'none', 'not before the beat');
    wall += DAMAGE_CHART_DELAY_MS + 100;
    P.client.frame();
    assert.ok(chart() && chart().style.display !== 'none', 'the chart stands');
    const text = textOf(chart());
    for (const s of ['Damage Dealt', 'Grath has fallen - a company of 2', 'Lord', 'Healed', 'Mac', 'Ann', '9,000', '(you)']) assert.ok(text.includes(s), s);
    wall += DAMAGE_CHART_MS;
    P.client.frame();
    assert.equal(chart().style.display, 'none', 'put away after its minute');
    // put away for good: another fight's chart in the one slot (a gate's court) is left standing
    drawGateDamageChart(damageChartModel({ at: 0, n: 1, dm: [{ n: 'Oth', l: 9, d: 5, x: 0, h: 1, b: 5, f: 0 }] }, { boss: 'The Warden', since: 0, now: DAMAGE_CHART_DELAY_MS }));
    P.client.frame();
    assert.notEqual(chart().style.display, 'none', 'the Spire\'s client draws its chart no more');
    // an end at a lord's fall (a Rehearsal's): its chart stands after the walk out
    P.tell({ k: 'end', why: 'rehearsal', at: P.now(), ds: [[ME, 9000, 0]], dm: [dm[0]] });
    P.client.frame();
    P.out();
    wall += DAMAGE_CHART_DELAY_MS + 100;
    P.client.frame();
    assert.ok(chart().style.display !== 'none', 'the end\'s chart, outside the halls');
    assert.ok(textOf(chart()).includes('Grath has fallen - one alone'));
    P.client.away();
    assert.equal(chart().style.display, 'none', 'online gone: put away');
  } finally { globalThis.document = had; destroyGateDamageChart(); destroyEgHud(); }
});

test('EG-ZF client: THE RECAP WHOLE (section 27.6) - each member\'s share of the company\'s damage and what they healed, off the room\'s numbers; the board\'s line from my end\'s claim - *The Descent, the Few: 14th* - on the recap standing, the one kept, and one still to be made (mutants: the share of the wrong whole; the healing unsaid; the board\'s line never reaching the recap; the rank\'s suffix wrong)', async () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 101, 111, 112, 113].map(egRankText), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '14th', '21st', '22nd', '23rd', '101st', '111th', '112th', '113th']);
  assert.equal(egBoardLine({ k: 'descent', br: 'few', rank: 14 }), 'The Descent, the Few: 14th');
  assert.equal(egBoardLine({ k: 'descent', br: 'alone', rank: 1 }), 'The Descent, Alone: 1st');
  assert.equal(egBoardLine({ k: 'descent', br: 'company', rank: 3 }), 'The Descent, the Company: 3rd');
  assert.equal(egBoardLine({ k: 'depths', rank: 31 }), 'The Depths: 31st');
  for (const b of [null, {}, { k: 'descent', br: 'many', rank: 2 }, { k: 'depths', rank: 0 }, { k: 'deepest', rank: 1 }]) assert.equal(egBoardLine(b), '', JSON.stringify(b));
  // the model: the share of the company's whole, what each healed
  const E = { ...EG_STATE_EMPTY, b: CB, seed: 77, op: T0, wk: T0 + 1000, h: 7, rd: 1, end: 'home', co: [[ME, 'Mac', 1, 1, 1, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 1, 0]], ds: [[ME, 3000, 0], ['acct-1', 1000, 1250]] };
  const R = egRecapModel(E, ME, [], T0 + 60_000, { board: 'The Descent, the Few: 14th' });
  assert.deepEqual(R.members.map((m) => [m.name, m.share, m.healed]), [['Mac', '75%', 0], ['Ann', '25%', 1250]]);
  assert.equal(R.b, CB);
  const words = { left: EG_PRES_TEXT.recapLeft, recall: EG_PRES_TEXT.recapRecall, share: EG_PRES_TEXT.recapShare, healed: EG_PRES_TEXT.recapHealed };
  assert.equal(egRecapMemberLine(R.members[1], words), 'II Ann - stood to the end, 1 fall, recall spent - 25% of the damage, 1,250 healed');
  assert.equal(egRecapMemberLine(R.members[0], words), 'I Mac - walked home, 0 falls, recall kept - 75% of the damage', 'healing said where there was any');
  assert.equal(egRecapMemberLine(egRecapModel({ ...E, ds: [] }, ME, [], T0).members[0], words), 'I Mac - walked home, 0 falls, recall kept', 'a room that said none: none');
  const doc = fakeDocument();
  drawEgPanel(null, { doc, recap: R, relShown: 0, words: EG_PRES_TEXT });
  const t1 = textOf(find(doc.body, 'eg-panel')[0]);
  for (const s of ['75% of the damage', '1,250 healed', 'The Descent, the Few: 14th']) assert.ok(t1.includes(s), s);
  drawEgPanel(null, { doc, recap: { ...R, board: 'The Depths: 2nd' }, relShown: 0, words: EG_PRES_TEXT });
  assert.ok(textOf(find(doc.body, 'eg-panel')[0]).includes('The Depths: 2nd'), 'a board line that arrives redraws the recap');
  drawEgPanel(null, { doc });
  // kept: the line set on the kept run of that breach alone
  const mem = new Map(), store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  egRecapKeep(store, { ...R, board: '' }, 1);
  egRecapKeep(store, { ...R, b: 'ffffffffffffffff', board: '' }, 2);
  egRecapBoardKeep(store, CB, 'The Descent, the Few: 14th');
  assert.deepEqual(egRecapsKept(store).map((r) => [r.b, r.board]), [[CB, 'The Descent, the Few: 14th'], ['ffffffffffffffff', '']]);
  // the client: my end's claim answers the line, and the recap reads it
  const P = inBreach({ h: 5, board: { k: 'descent', br: 'few', rank: 14 } });
  P.client.frame();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = await mintEgReceipt({ q: 'x', b: CB, s: ME, z: 'z'.repeat(16), c: 9, h: 5, t: 300, n: 2, ew: 0, l: 30, why: 'home' }, kp.privateKey, { subtle, nowS: Math.floor(P.now() / 1000) });
  P.B.mem[ME].home = 1;
  P.tell(egStateOf(P.B, P.now()));
  P.client.frame();   // I walk home: the recap stands
  P.client.word({ k: 'rcpt', r });
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(P.claims.length, 1, 'my end claimed');
  assert.equal(egRecapsKept(P.store).at(-1).board, 'The Descent, the Few: 14th', 'on the kept run');
  const doc2 = fakeDocument(), had = globalThis.document;
  globalThis.document = doc2;
  try {
    P.client.frame();
    assert.ok(textOf(find(doc2.body, 'eg-panel')[0]).includes('The Descent, the Few: 14th'), 'on the recap standing');
  } finally { globalThis.document = had; destroyEgHud(); }
});

test('EG-ZF client: THE FIRST-TIME LINES OVER THE ACCOUNT (section 27.7) and THE HEAL WORD OUT - the account\'s bits read over the device\'s (a line the account has heard is not said on a new device); a line newly said told the account; with no account\'s answer the device\'s own; what companions healed in me said to the room by peer id, whole points, the rest kept, never outside the Spire (mutants: the device read over the account; the account never told; the heal word never sent; its fractions sent)', async () => {
  const bit = (k) => 1 << EG_FIRST_KEYS.indexOf(k);
  assert.equal(egFirstOver(bit('void'), bit('count')), bit('void') | bit('count'), 'the account with the device');   // PIN MOVED (AUDIT EG V, c: L7-23 - the device's bits are OR'd in, never dropped once the account answers: a line whose word was lost before a reload was shown again)
  assert.equal(egFirstOver(bit('void'), null), bit('void'), 'no account: the device\'s');
  assert.equal(egFirstOver(bit('void'), null, bit('home')), bit('void') | bit('home'), 'and what this screen showed');
  assert.equal(egFirstOver(0, bit('count'), bit('fork')), bit('count') | bit('fork'));
  // a new device: the account has heard the count's line, so it is not said again
  const P = inBreach({ h: 2, acct: bit('count') });
  P.client.frame();
  await tick(); await tick();
  P.client.frame(); P.client.frame();
  assert.ok(!P.said.includes(EG_TEXT_FIRST.count), 'the account heard it on another device');
  P.client.castBack();
  assert.equal(P.said.filter((s) => s === EG_TEXT_FIRST.void).length, 1, 'a line the account never heard: said');
  await tick();
  assert.deepEqual(P.firsts, [bit('count') | bit('void')], 'and the account told');
  assert.equal(egFirstRead(P.store, egFirstKey(ME)), bit('void'), 'the device keeps what it showed');   // PIN MOVED (AUDIT EG V, c: L7-23 - under the account's own key)
  // no account's answer: the device's own
  const mem = new Map([[EG_FIRST_KEY, String(bit('count'))]]);
  const Q = inBreach({ h: 2, store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) } });
  Q.client.frame(); await tick(); Q.client.frame(); Q.client.frame();
  assert.ok(!Q.said.includes(EG_TEXT_FIRST.count), 'the device had said it');
  const D = inBreach({ h: 2 });
  D.client.frame(); await tick(); D.client.frame(); D.client.frame();
  assert.ok(D.said.includes(EG_TEXT_FIRST.count), 'a fresh device with no answer says it');
  // THE HEAL WORD
  const H = inBreach({ h: 5 });
  assert.equal(H.client.healedBy('peer-ann', 30.6), true);
  assert.equal(H.client.healedBy('peer-bob', 0), false);
  assert.equal(H.client.healedBy('peer-bob', 12), true);
  H.client.frame();
  assert.deepEqual(H.sent.filter((w) => w.k === 'heal'), [{ k: 'heal', h: [['peer-ann', 30], ['peer-bob', 12]] }], 'whole points, by peer id');
  H.client.healedBy('peer-ann', 0.5);
  H.client.frame();
  assert.equal(H.sent.filter((w) => w.k === 'heal').length, 1, 'not again within EG_HEAL_SEND_MS');
  await new Promise((res) => setTimeout(res, EG_HEAL_SEND_MS + 20));
  H.client.frame();
  assert.deepEqual(H.sent.filter((w) => w.k === 'heal').at(-1), { k: 'heal', h: [['peer-ann', 1]] }, 'the fractions kept for the next');
  H.out();
  assert.equal(H.client.healedBy('peer-ann', 40), false, 'outside the Spire: nothing owed');
});

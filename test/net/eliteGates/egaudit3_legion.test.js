// AUDIT EG III (2026-10-13, the Elite Gates arc's third audit; bible/11-Multiplayer/Elite-Gates.md sections 8.1, 8.5, 12, 13.2,
// 14 and 15; the legion group's findings): THE LEGION AS WRITTEN - the legion's cap held by every wave (the director's, a
// rift's held and grown by a body, Hunting Pack's, a lord's fury's and summons' through egWaveKinds, a Kynval squad), the
// Scriptorium under Wellhead Sparks, a chained shape's floor + 0.3 s, Fade fooling every kind but the Unshaken, a struck
// dormant Lurker waking, the Wellhead's Sapper on a sprite of its own, and Kyn's Vigil's escort at both ranks. Every fixture is
// the producers' own: the breach and its halls from the director (egBreachNew, egEnter, egStep), the legion from egLegionRaise
// and egLegionStep, blows through egBlow.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, EG_SEALED_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egLegionCap, EG_VIGIL_NONE } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, egFightNew, egGone, egHas, egSetFl, EG_GONE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, EG_BAND_KINDS, egLegionRaise, egLegionStep, egWaveKinds, egWaveSize, egSquad, egLegionRoom, egLegionCapOf, egEscortOf, egKindLook } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsOf } from '../../../src/net/eliteGates/egLords.js';
import { egChainGapMs, egWindupFloorMs, shDisc } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_M_ID } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(1, [1, 2, 3]);
  egGive8(12345, [1]);
  egGive8(7, [2]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** The legion standing in a fight: its foes (a friend is none). */
const foes = (F) => F.bodies.filter((b) => b.role === EG_ROLE.add && b.hp > 0 && !egHas(b, EG_FL.friend));

/** A breach of `n` (seed `seed`, the week's Proclamation `pr`, the circle's decrees `dc`) at hall `h`'s arrival, woken by the
 *  director with the company on the arrival plate: `step(ms)` beats it (its frames kept), `stand(sub, x, z)` moves a member. */
function breachAt(seed, h, { n = 3, pr = 'pyre', dc = [], strata = [] } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.dc = dc.map((p) => [...p]); B.strata = [...strata];
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + (i % 4) * 0.5, z: spec.arrive.z + Math.floor(i / 4) * 0.5 }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const wake = () => { for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step(); assert.equal(B.sg, 'trial', `hall ${h} woke`); };
  return { B, spec, pos, frames, step, wake, rng, now: () => now, tick: (ms) => (now += ms), stand: (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; } };
}

// ── THE LEGION'S CAP (lane1 #3) ─────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE LEGION\'S CAP (section 8.1: "no more than min(14, 2 + ceil(1.5n) + floor((c-1)/5)) standing"): a company of eight in Hall 1\'s Rift-Yard - five rifts, each pouring its wave every 20 s - never stands more than fourteen of the legion and reaches them, its waves taking their room from what the beat\'s waves before them left; Hunting Pack\'s Harriers within the same cap (mutants: the room read once a beat; a rift\'s wave past the room; Hunting Pack uncapped)', () => {
  for (const pr of ['pyre', 'pack']) {
    const S = breachAt(1, 1, { n: 8, pr }), { B, spec } = S;
    assert.deepEqual([spec.kind, spec.variant, spec.c], ['yard', 'riftyard', 1]);
    S.wake();
    const cap = egLegionCap(8, 1);
    assert.equal(cap, 14);
    let most = 0;
    for (let k = 0; k < 4 * 150; k++) { S.step(); most = Math.max(most, foes(B.F).length); }
    assert.equal(most, cap, `${pr}: at most the cap, and the cap reached`);
    assert.equal(egLegionRoom(B.F), 0, 'the room under it spent');
  }
});

test('AUDIT EG III A RIFT HOLDS ITS WAVE (section 8.1: "A rift whose wave would pass the cap holds it, and the next wave is one body larger"): the second cycle\'s room takes two rifts\' waves of two whole; the three rifts left hold theirs, pouring none of it; at the next cycle, with room again, each held rift pours three - one body larger - and the rifts that poured pour two; a rift that pours holds no growth after (mutants: a held wave poured in part; the growth forgotten; the growth kept after it poured; every rift grown)', () => {
  const S = breachAt(1, 1, { n: 8 }), { B } = S;
  S.wake();
  const rifts = B.F.bodies.filter((b) => b.role === EG_ROLE.obj && b.t === 'rift').map((b) => b.i);
  assert.equal(rifts.length, 5);
  const k = Math.ceil(egWaveSize(8) / 2);
  assert.equal(k, 2);
  // the first cycle: five waves of two (ten of fourteen); the second: room for four - two rifts pour, three hold
  let held = [];
  for (let n = 0; n < 4 * 40 && !held.length; n++) { S.step(); held = Object.keys(B.F.mem.grow ?? {}).map(Number); }
  assert.equal(held.length, 3, 'three rifts held their waves');
  assert.ok(held.every((i) => rifts.includes(i)), 'each a rift');
  assert.equal(foes(B.F).length, 14, 'the room filled whole by the two that poured, none in part');
  // the legion felled: at the next cycle every rift pours, the held ones a body larger
  egGone(B.F, foes(B.F), EG_GONE.slain, 'M0', S.now(), []);
  const at = B.F.waveAt, from = S.frames.length;
  while (S.now() < at) S.step();
  const waves = S.frames.slice(from).filter((f) => f.k === 'ead').map((f) => f.a.length);
  assert.deepEqual(waves.sort(), [k, k, k + 1, k + 1, k + 1], 'the held rifts pour one body larger');
  assert.deepEqual(B.F.mem.grow, {}, 'and hold no growth after');
  assert.equal(foes(B.F).length, 2 * k + 3 * (k + 1));
});

test('AUDIT EG III EVERY WAVE WITHIN THE CAP (section 8.1, through net/eliteGates/egLegion.js egWaveKinds and egSquad): a wave\'s kinds are held to the room the cap leaves, its first kinds kept - so a lord\'s fury wave (net/eliteGates/egLords.js, untouched) raises nothing into a full legion; a Kynval squad, a mechanic\'s body, stands whole whatever the room and counts against it after (AUDIT EG V, h); the room is the cap less the standing foes (a friend none), halved in a Deepway\'s rift chamber (mutants: the clamp dropped; a friend counted; the half cap unread; the squad held to the room)', () => {
  const spec = egHallOf(1, 1, 0), rng = seeded(3);
  const F = egFightNew(spec, T0, [40, 40, 40]);
  assert.equal(egLegionCapOf(F), egLegionCap(3, 1));
  egLegionRaise(F, Array(egLegionCap(3, 1) - 1).fill(EG_KIND.harrier), [[spec.fight.x, spec.fight.z]], T0, []);
  egLegionRaise(F, [EG_KIND.ghost], [[spec.fight.x, spec.fight.z]], T0, []);
  assert.equal(egLegionRoom(F), 1, 'one more: the Battlemage\'s Ghost is no foe');
  assert.equal(egWaveKinds(F, rng, 5).length, 1, 'a wave held to the room');
  assert.equal(egWaveKinds(F, rng, 5, { room: 3 }).length, 3, 'or the room it is given');
  // PIN MOVED (AUDIT EG V, h - A2 NEW-1; sections 8.7 and 12): a squad held to the room stood three of its four for a company of
  // three (seed 19, Hall 16) - it is a mechanic's body now, as the Honour Horn's Kynval: whole into a room of one, counted after
  const sq = egSquad(F, [[spec.fight.x, spec.fight.z]], T0, []);
  assert.deepEqual(sq.map((b) => [EG_FL.searing, EG_FL.shielded, EG_FL.wrathful, EG_FL.unshaken].findIndex((f) => egHas(b, f))), [0, 1, 2, 3], 'a squad stands whole, an affix each');
  assert.equal(egLegionRoom(F), 0);
  F.halfCap = 1;
  assert.equal(egLegionCapOf(F), Math.floor(egLegionCap(3, 1) / 2), 'the chamber\'s half');
  // a lord's fury in a full Court: its wave rises into no room
  const S = breachAt(12345, 5, { n: 3 }), { B } = S;
  S.wake();
  S.stand('acct-0', 0, 41); S.stand('acct-1', -6, 41); S.stand('acct-2', -6, 46);
  for (let k = 0; k < 40 && !egLordsOf(B.F).some((L) => L.up2); k++) S.step();
  const room = egLegionRoom(B.F);
  egLegionRaise(B.F, Array(room).fill(EG_KIND.harrier), [[0, 46]], S.now(), []);
  assert.equal(egLegionRoom(B.F), 0, 'the Court\'s legion full');
  B.F.mem.furyAt = S.now() - 1; B.F.mem.furyNext = S.now();
  const steps = B.F.mem.furySteps ?? 0;
  S.step();
  assert.equal(B.F.mem.furySteps, steps + 1, 'the fury stepped');
  assert.ok(foes(B.F).length <= egLegionCapOf(B.F), 'and raised nothing past the cap');
  // the Court's escort wave and its Sapper: one body of room, one body risen
  B.F.mem.furyNext = S.now() + 600_000;
  for (const b of foes(B.F).slice(1)) b.hp = 0;
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add || b.hp > 0);
  egLegionRaise(B.F, Array(egLegionRoom(B.F) - 1).fill(EG_KIND.harrier), [[0, 46]], S.now(), []);
  assert.equal(egLegionRoom(B.F), 1);
  B.F.waveAt = S.now();
  const from = S.frames.length;
  S.step();
  assert.ok(S.frames.slice(from).some((f) => f.k === 'ead'), 'the escort rose');
  assert.equal(foes(B.F).length, egLegionCapOf(B.F), 'within the room: the cap, never past it');
});

// ── THE SCRIPTORIUM UNDER WELLHEAD SPARKS (lane1 #6) ──────────────────────────────────────────────────────────────────
test('AUDIT EG III THE SCRIPTORIUM UNDER WELLHEAD SPARKS (sections 8.7 and 14): the week\'s Proclamation of Sparks in a quiet hall with no fight floor raises no spark and never throws - the room\'s beat runs to the door at 30 s (mutants: the fight floor unread)', () => {
  const S = breachAt(7, 8, { n: 2, pr: 'sparks' }), { B, spec } = S;
  assert.deepEqual([spec.kind, spec.fight], ['scriptorium', null]);
  S.wake();
  assert.equal(B.F.D.sparks, 1);
  for (let k = 0; k < 4 * 35; k++) S.step();
  assert.equal(B.sg, 'closing', 'the door opened');
  assert.ok(!S.frames.some((f) => f.k === 'ead' && f.a.some((t) => t[1] === EG_ROLE.obj)), 'no spark rose');
});

// ── A CHAINED SHAPE'S GAP (lane1 #10, the legion's half) ──────────────────────────────────────────────────────────────
test('AUDIT EG III CHAINED BLOWS (sections 13.2 and 14: "landing max(the blow\'s own wind-up, its floor + 0.3 s, 1.0 s) later"): net/eliteGates/egShape.js egChainGapMs is the law, and a Harrier\'s chained Bite lands 1.09 s after the first (its disc of 2 m floors at 0.79 s), a Lurker\'s Smash its 1.3 s wind-up after, the third shape at rank II the same gap again (mutants: the floor\'s term dropped; its 0.3 s; the 1.0 s floor; the wind-up unread)', () => {
  const d2 = shDisc(0, 0, 2), d3 = shDisc(0, 0, 3);
  assert.deepEqual([egWindupFloorMs(d2), egChainGapMs(900, [d2]), egChainGapMs(1300, [d3]), egChainGapMs(500, [shDisc(0, 0, 1)]), egChainGapMs(1000, [d3])], [790, 1090, 1300, 1000, 1240]);   // the lords group's egChainGapMs (a stamps list) is the one kept at the merge
  const spec = egHallOf(1, 1, 0), view = egFightView(spec);
  for (const [kind, rank, want] of [[EG_KIND.harrier, 1, [1090]], [EG_KIND.lurker, 1, [1300]], [EG_KIND.harrier, 2, [1090, 1090]]]) {
    const F = egFightNew(spec, T0, [40]), out = [];
    const [a] = egLegionRaise(F, [kind], [[spec.fight.x, spec.fight.z]], T0 - 5000, []);
    a.up = 0; egSetFl(F, a, EG_FL.dormant, false, []);
    egLegionStep(F, view, T0, [{ sub: 'm', x: a.x + 0.5, z: a.z + 0.5 }], seeded(3), out, { decrees: { chained: rank } });
    const at = out.filter((f) => f.k === 'eb').map((f) => f.at);
    assert.equal(at.length, rank + 1, `${EG_LEGION_KINDS[kind].name}: ${rank} chained`);
    assert.deepEqual(at.slice(1).map((t, j) => t - at[j]), want, `${EG_LEGION_KINDS[kind].name} at rank ${rank}`);
  }
});

// ── FADE FOOLS EVERY KIND (lane1 #15) ────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III FADE FOOLS EVERY KIND BUT THE UNSHAKEN (section 15: "after you strike, adds lose you"; section 8.7: Unshaken "immune to push and to Fade"): a Breaker charges the member it sees, never the nearer one in its Fade; a Caster\'s Bolt falls at the one it sees; a Ward-Bearer pulses at none while only a Faded member stands near; an Unshaken Kynval strikes the Faded member nearest it; with no Fade, the nearest (mutants: Fade read by the Harriers alone; the Unshaken fooled; a Bolt at anyone)', () => {
  const spec = egHallOf(1, 1, 0), view = egFightView(spec), x = spec.fight.x, z = spec.fight.z;
  const run = (kind, here, faded, fl = 0, seed = 5) => {
    const F = egFightNew(spec, T0, [40, 40]), out = [];
    const [a] = egLegionRaise(F, [kind], [[x + 0.7, z]], T0 - 5000, [], { fl });   // the raise's first spot sets it at (x, z)
    a.up = 0;
    egLegionStep(F, view, T0, here, seeded(seed), out, { decrees: {}, fadeOf: (sub) => faded.includes(sub) });
    return { a, blows: out.filter((f) => f.k === 'eb') };
  };
  const east = { sub: 'east', x: x + 4, z }, west = { sub: 'west', x: x - 8, z };
  // the Breaker: a lane toward the member it charges
  const yawTo = (r) => Math.sign(Math.sin(r.a.yaw));
  assert.equal(yawTo(run(EG_KIND.breaker, [east, west], [])), 1, 'no Fade: the nearest, east');
  assert.equal(yawTo(run(EG_KIND.breaker, [east, west], ['east'])), -1, 'east in its Fade: the Breaker charges west');
  assert.equal(run(EG_KIND.breaker, [east], ['east']).blows.length, 0, 'none seen: no charge');
  // the Caster: its Bolt at the feet of the one it sees
  for (let k = 1; k <= 8; k++) {
    const far1 = { sub: 'a', x: x + 12, z }, far2 = { sub: 'b', x: x - 12, z };
    const c = run(EG_KIND.caster, [far1, far2], ['a'], 0, k);
    assert.equal(c.blows.length, 1);
    assert.ok(c.blows[0].s[0][1] < x, 'the Bolt falls at b, never a in its Fade');
  }
  // the Ward-Bearer: none seen near, no pulse
  assert.equal(run(EG_KIND.bearer, [{ sub: 'a', x: x + 2, z }], ['a']).blows.length, 0, 'a Faded member near a Ward-Bearer: no pulse');
  assert.equal(run(EG_KIND.bearer, [{ sub: 'a', x: x + 2, z }], []).blows.length, 1, 'seen: its pulse');
  // the Unshaken Kynval: it sees through the Fade
  const near1 = { sub: 'near', x: x + 2, z }, near2 = { sub: 'far', x: x - 3, z };
  assert.equal(yawTo(run(EG_KIND.kynval, [near1, near2], ['near'], EG_FL.elite | EG_FL.unshaken)), 1, 'the Unshaken strikes the Faded member nearest it');
  assert.equal(yawTo(run(EG_KIND.kynval, [near1, near2], ['near'], EG_FL.elite | EG_FL.searing)), -1, 'a Searing Kynval does not');
});

// ── A STRUCK LURKER WAKES (lane1 #9) ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III A STRUCK LURKER WAKES (section 12\'s ROLE READS; section 15\'s Spotter: "your arrows wake Lurkers at any range, and a woken or struck foe is marked"): a Spotter\'s arrow landing on a dormant Lurker 14 m off wakes it - its dormancy lifted, rising over 0.6 s, *Something stirs.* once a hall - and marks it +10%; any landed blow wakes one; a blow that lands nothing wakes none (mutants: a struck Lurker left dormant; the wake unsaid; said twice in a hall)', () => {
  const S = breachAt(12345, 5, { n: 3 }), { B } = S;
  S.wake();
  S.stand('acct-0', 0, 41); S.stand('acct-1', -6, 41); S.stand('acct-2', -6, 46);
  S.step();
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  B.mem['acct-0'].mast = EG_M_ID.spotter;
  const [lk, lk2] = egLegionRaise(B.F, [EG_KIND.lurker, EG_KIND.lurker], [[0.7, 49], [5.7, 49]], S.now(), []);
  for (const b of [lk, lk2]) b.up = 0;
  assert.ok(egHas(lk, EG_FL.dormant) && egHas(lk2, EG_FL.dormant), 'dormant');
  const blow = (sub, i, d, r, x, z) => egBlow(B, sub, { k: 'hit', i, q: Math.floor(S.tick(300)), d, r }, { sx: S.spec.x0 + x, y: 0, z }, S.now());
  const zero = (() => { const m = B.mem['acct-1'], keep = m.bucket; m.bucket = 0; m.bucketAt = S.now() + 300; const o = blow('acct-1', lk.i, 5, HIT_KINDS.Shaft, -6, 41); m.bucket = keep; return o; })();
  assert.ok(egHas(lk, EG_FL.dormant) && !zero.some((f) => f.k === 'esay'), 'a blow that lands nothing wakes none');
  const out = blow('acct-0', lk.i, 5, HIT_KINDS.Shaft, 0, 35);
  assert.ok(!egHas(lk, EG_FL.dormant), 'the arrow woke it, 14 m off');
  assert.equal(lk.up, S.now() + 600, 'rising over 0.6 s');
  assert.deepEqual(out.filter((f) => f.k === 'esay').map((f) => f.w), ['stirs']);
  assert.equal(lk.marked?.x, 0.1, 'and marked by the Spotter');
  const out2 = blow('acct-2', lk2.i, 5, HIT_KINDS.Melee, 5.7, 47.5);
  assert.ok(!egHas(lk2, EG_FL.dormant), 'any landed blow wakes one');
  assert.ok(!out2.some((f) => f.k === 'esay' && f.w === 'stirs'), 'said once a hall');
});

// ── ROLE READS (lane1 #20) ───────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III ROLE READS (section 12: "among the legion\'s kinds one sprite never plays two roles in a band"): in every band the kinds its waves draw stand on sprites of their own - the Wellhead\'s Sapper a Fire Atronach (35), the Atronachs the page names, its Iron Atronach (36) the Lurker\'s (mutants: the Sapper on the Lurker\'s sprite)', () => {
  for (const [band, kinds] of EG_BAND_KINDS.entries()) {
    const mobs = kinds.map((k) => egKindLook(k, band).mobile);
    assert.equal(new Set(mobs).size, mobs.length, `band ${band}: ${mobs}`);
  }
  assert.ok(EG_LEGION_KINDS[EG_KIND.sapper].mob.every((m) => [35, 37, 38].includes(m)), 'the Sapper an Atronach of the page\'s three');
  assert.equal(egKindLook(EG_KIND.sapper, 3).mobile, 35);
  assert.equal(egKindLook(EG_KIND.lurker, 3).mobile, 36);
});

// ── KYN'S VIGIL (lane1 #13) ──────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III KYN\'S VIGIL (section 14: "every hall\'s trial begins with the band\'s champion on the arrival plate" - "with its escort doubled"): a Rift-Yard woken under it stands the band\'s champion with section 8.5\'s escort (1 + ceil(n/3), egEscortOf), twice it at rank II; the Scriptorium (no trial), a span and a Brink (a crossing) stand none - EG_VIGIL_NONE, the record\'s decision (mutants: no escort; rank II as rank I; the Scriptorium stood one)', () => {
  assert.deepEqual([egEscortOf(1), egEscortOf(2), egEscortOf(3), egEscortOf(4), egEscortOf(8)], [2, 2, 2, 3, 4]);
  assert.deepEqual([...EG_VIGIL_NONE], ['proving', 'court', 'scriptorium', 'span', 'brink']);
  const vigil = EG_DECREE_BY_KEY.vigil.id;
  for (const [rank, want] of [[1, egEscortOf(2)], [2, 2 * egEscortOf(2)]]) {
    const S = breachAt(1, 9, { n: 2, dc: [[vigil, rank]] });
    assert.equal(S.spec.kind, 'yard');
    S.wake();
    const L = egLordsOf(S.B.F);
    assert.deepEqual(L.map((b) => b.key), ['kynreeve'], `rank ${rank}: the Galleries' champion`);
    assert.equal(foes(S.B.F).length, want, `rank ${rank}: its escort of ${want}`);
    assert.ok(foes(S.B.F).every((b) => b.wv === 1), 'one wave');
  }
  const Q = breachAt(7, 8, { n: 2, dc: [[vigil, 2]] });
  Q.wake();
  assert.deepEqual([egLordsOf(Q.B.F).length, foes(Q.B.F).length], [0, 0], 'the Scriptorium\'s quiet keeps no champion');
  const P = breachAt(1, 12, { n: 2, dc: [[vigil, 1]] });
  assert.equal(P.spec.kind, 'span');
  P.wake();
  assert.equal(egLordsOf(P.B.F).length, 0, 'a span\'s crossing stands none');
});

// ── THE PAGE (RETIRING A FLAG DELETES THE SENTENCE) ──────────────────────────────────────────────────────────────────
test('AUDIT EG III THE PAGE: EG-ZS\'s two flags (Spillover applied nowhere, Spotter\'s wake applied nowhere) are deleted with the halves built; section 12 says a struck Lurker wakes and every wave is held to the room under the cap; section 14\'s Kyn\'s Vigil names its escort and the halls it stands none in', () => {
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
  const zs = page.slice(page.indexOf('### EG-ZS - '));
  for (const gone of ['SPILLOVER (Arcana\'s Mastery', 'SPOTTER\'s first half', 'FLAGGED to the relay, where `hostHits` is its seam']) assert.ok(!zs.includes(gone), `retired: ${gone}`);
  assert.ok(page.includes('dormant until a member passes within 6 m (an ambush) or a blow lands on it'), 'section 12: a struck Lurker wakes');
  assert.ok(page.includes('Every wave is held to\n  the room under the cap (`egLegionRoom`'), 'section 12: the room under the cap');
  // PIN MOVED (AUDIT EG IV, lane1 #1): the Vigil stands none in a Deepway whose chamber is a champion's either - before, the needle
  // read "never in a Proving Walk or a Court"
  assert.ok(page.includes('with its escort (`1 + ceil(n/3)`, section 8.5); never in a Proving Walk, a Court or a Deepway whose chamber is a champion\'s'), 'section 14: Kyn\'s Vigil as built');
});

// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 8.1, 8.4, 8.7, 8.8,
// 11.2, 12, 14, 15 and 17.2; fix group A1, "director-company" - the legion's and the Vestiges' laws in the director):
//   L2-2  a member gone home, or whose last pose is an earlier hall's, lends no Vestige by its place (the Standard, an Accord,
//         Watchfire) and a home holder no Fallen's Due (egPosedHere);
//   L2-3  a dormant Lurker is no part of the legion's cap until it wakes - three statues no longer hold every wave;
//   L2-6  Stillness holds the first wave of whatever hall pours one, and waits past a hall that pours none;
//   L2-7  a Shielded elite's shield turns every host hit on its front and soaks one from behind (egShieldTurns, egShieldSoak);
//   L2-8  a Wellspring raises Sappers that relight a broken anchor;
//   L2-12 Swarm-Mother's Binder in every wave the legion draws - an escort's and a lord's too (the fight's own decree);
//   L2-16 the Honour Horn's Kynval a mechanic's body: it stands whatever the room, and counts against it after;
//   L3-20 the Athenaeum's pressure is Harriers.
// Every fixture is the producers' own: the halls from the law (egHallOf), the breach from the director (egBreachNew, egEnter,
// egStep, egBlow, egWord), the legion from net/eliteGates/egLegion.js (egLegionRaise, egSquad, egWaveKinds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egFirstHallOf, EG_SEALED_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egWord, egGeo, egWatchOf, egPosedHere, egStillHolds, EG_STILL_MS, EG_ESCORT_EVERY_MS, EG_LOCK_EVERY_MS, EG_HORN_FIRST_MS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, egHas, egFightNew } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egLegionRaise, egLegionRoom, egLegionCapOf, egWaveKinds, egEscortOf, egSquad, egLurkerWake, egShieldTurns, egShieldSoak, egFromBehind } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsAwake } from '../../../src/net/eliteGates/egLords.js';
import { egWagerOf } from '../../../src/net/eliteGates/egStartLaw.js';
import { EG_V_BY_KEY } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egGive8Hall } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courts and its
// lords, its courses along +z from the plate, where law 8 lays them) and stand on it still - a finder scans law 8's halls by
// name, and a breach stands in a circle given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs
// egGive8Hall); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const vId = (key) => EG_V_BY_KEY[key].id;
const foes = (F) => F.bodies.filter((b) => b.role === EG_ROLE.add && b.hp > 0 && !egHas(b, EG_FL.friend));
/** The kinds the frames `fs` raised (`ead`). */
const risen = (fs) => fs.filter((f) => f.k === 'ead').flatMap((f) => f.a.map((t) => t[2]));

/** The first hall of the law (seeds 1-399, circles c0-c1, every slot) satisfying `want`: `{ seed, h, spec }`. */
function findHall(want, [c0, c1] = [1, 20], seeds = 400) {
  for (let seed = 1; seed < seeds; seed++) for (let c = c0; c <= c1; c++) for (let s = 1; s <= 5; s++) {
    const h = egFirstHallOf(c) + s - 1, spec = egHallOf(seed, h, 0, 8);
    if (want(spec)) return { seed, h, spec };
  }
  throw new Error('no such hall');
}
/**
 * Breach `seed`'s hall `h` for a company of `n` (level 40), woken by the director with the company on its arrival plate
 * (`pre(B)` before the wake), then stood at `at` (each member's `[x, z]`, the hall's frame - by default about the fight's
 * heart) and stepped once; the legion its wake raised cleared (`clear`). `step`, `blow`, `put`, `word`; the frames said.
 */
function breach({ seed, h, n = 3, at = null, clear = false, vs = {}, wg = [], dc = null, pre = null, stay = false } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg, pr: 'pyre' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  for (const [sub, v] of Object.entries(vs)) B.mem[sub].vs = v;
  if (dc) B.dc = dc;
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const spec = egGive8Hall(seed, h, egGeo(B));
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive && !B.mem[sub].home).map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const word = (sub, m) => { const o = egWord(B, sub, m, pos[sub], now, rng); frames.push(...o); return o; };
  pre?.({ B, word });
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const f = spec.fight ?? spec.fl?.[0] ?? { x: 0, z: 0 };
  const place = at ?? Object.fromEntries(co.map(([sub], i) => [sub, [f.x + i * 1.5, f.z + 1]]));
  if (!stay) { for (const [sub, [x, z]] of Object.entries(place)) pos[sub] = { sx: spec.x0 + x, z }; step(); }
  if (clear && B.F) B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  const blow = (sub, i, d, r, xz = place[sub]) => { now += 300; const o = egBlow(B, sub, { k: 'hit', i, q: q++, d, r }, { sx: spec.x0 + xz[0], y: 0, z: xz[1] }, now); frames.push(...o); return o; };
  const put = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; place[sub] = [x, z]; };
  return { B, spec, pos, place, frames, step, blow, put, word, rng, now: () => now };
}
const riftyard = () => findHall((s) => s.kind === 'yard' && s.variant === 'riftyard' && !s.twist, [1, 6]);

// ── L2-2: THE COMPANY WHERE IT STANDS ─────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-2 A MEMBER GONE HOME, OR LAST SEEN IN AN EARLIER HALL, LENDS NOTHING BY ITS PLACE (section 15: auras and Accords "while they stand together"): a Spire\'s Standard III holder 3 m from the striker raises its blow - gone home, or its last pose an earlier hall\'s, it raises nothing; a Fallen\'s Due holder gone home lends no Due when an ally falls; Watchfire\'s holder is the company\'s only by a pose of this hall; a blow keeps its striker\'s pose in its hall (mutants: the home ones in `here`; a pose of any hall read; Fallen\'s Due over home holders; the blow\'s pose hall-less)', () => {
  const { seed, h } = riftyard();
  const strike = ({ who = null, home = false, stale = false, due = false } = {}) => {
    const P = breach({ seed, h, n: 3, clear: true, vs: { 'acct-1': who ? [[vId(who), 3]] : [] } });
    const me = P.place['acct-0'];
    P.put('acct-1', me[0] + 3, me[1]); P.step();
    assert.equal(P.B.mem['acct-1'].pose.h, h, 'its pose kept with its hall');
    const [a] = egLegionRaise(P.B.F, [EG_KIND.harrier], [[me[0] + 2, me[1] + 1]], P.now(), []);
    a.up = 0; a.hp = a.max = 100_000;
    if (home) P.B.mem['acct-1'].home = P.now();
    if (stale) { P.B.mem['acct-1'].pose = { ...P.B.mem['acct-1'].pose, h: h - 1 }; P.put('acct-1', -9999, -9999); }
    if (due) P.word('acct-2', { k: 'fell' });
    const hp0 = a.hp;
    P.blow('acct-0', a.i, 50, HIT_KINDS.Melee);
    assert.deepEqual(P.B.mem['acct-0'].pose, { x: me[0], z: me[1], h }, 'the striker\'s pose in its hall');
    return { got: hp0 - a.hp, P };
  };
  const base = strike().got;
  assert.ok(strike({ who: 'standard' }).got > base, 'the Standard near raises it');
  assert.equal(strike({ who: 'standard', home: true }).got, base, 'gone home: nothing');
  const st = strike({ who: 'standard', stale: true });
  assert.equal(st.got, base, 'an earlier hall\'s pose: nothing');
  assert.deepEqual(egPosedHere(st.P.B).map((o) => o.sub).sort(), ['acct-0', 'acct-2'], 'the company where it stands');
  const dueBase = strike({ due: true }).got;
  assert.ok(strike({ who: 'fallensdue', due: true }).got > dueBase, 'Fallen\'s Due burns for its holder');
  assert.equal(strike({ who: 'fallensdue', due: true, home: true }).got, dueBase, 'its holder gone home lends none');
  // Watchfire: the holder by a pose of this hall alone
  const W = strike({ who: 'watchfire' }).P;
  assert.deepEqual(egWatchOf(W.B).map((w) => w.sub), ['acct-1']);
  W.B.mem['acct-1'].pose = { ...W.B.mem['acct-1'].pose, h: h - 1 };
  assert.deepEqual(egWatchOf(W.B), [], 'none by an earlier hall\'s pose');
});

// ── L2-3: A DORMANT LURKER OUTSIDE THE CAP ────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-3 A DORMANT LURKER IS NO PART OF THE CAP UNTIL IT WAKES (sections 8.1, 8.8 and 12): a lone member\'s Deepway rift chamber (its cap halved to two) holds three statues - the room under the cap is still two, its rifts pour, and a statue woken counts against it from then (mutants: the statues counted asleep; a woken Lurker left out)', () => {
  const P = breach({ seed: 1, h: 22, n: 1, stay: true });
  const F = P.B.F;
  assert.deepEqual([P.spec.kind, F.chamber, F.halfCap, egLegionCapOf(F)], ['deepway', 0, 1, 2], 'a lone member\'s rift chamber');
  const statues = foes(F).filter((b) => b.k === EG_KIND.lurker && egHas(b, EG_FL.dormant));
  assert.equal(statues.length, 3, 'three statues in the walls\' shadow');
  assert.equal(egLegionRoom(F), 2, 'the room the statues leave');
  const said0 = P.frames.length;
  for (let k = 0; k < 100; k++) P.step();
  assert.ok(risen(P.frames.slice(said0)).length >= 1, 'the rifts pour');
  const awake = foes(F).filter((b) => !egHas(b, EG_FL.dormant)).length;
  egLurkerWake(F, statues[0], P.now(), []);
  assert.equal(egLegionRoom(F), Math.max(0, 2 - awake - 1), 'a woken statue counts');
});

// ── L2-6: STILLNESS IN EVERY HALL THAT POURS ──────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-6 STILLNESS HOLDS THE FIRST WAVE OF EVERY HALL THAT POURS ONE (section 17.2: "the next hall\'s first wave and rift pour 10 s late"): a Rampart\'s march, an Athenaeum\'s pressure, a Court\'s first escort (from its ring\'s wake) and a Proving Walk\'s escort each come EG_STILL_MS late, the Cantrip spent; a Scriptorium or a Brink pours none, and keeps it for the next (mutants: Stillness overwritten by the kind\'s own first wave; the Court\'s escort unheld; the escort risen at the wake; spent in a hall with nothing to hold)', () => {
  const still = (pre) => ({ B, word }) => { if (!pre) return; B.mem['acct-0'].cant = [1]; word('acct-0', { k: 'cant', i: 0 }); assert.equal(B.still, 1, 'Stillness used'); };
  const first = (want, use) => { const at = findHall(want, [1, 12]); const P = breach({ seed: at.seed, h: at.h, pre: still(use), stay: true }); return { P, gap: P.B.F.waveAt - P.B.hw }; };
  const rampart = (s) => s.kind === 'rampart' && s.variant === 'siege' && !s.twist, ath = (s) => s.kind === 'athenaeum' && !s.twist;
  const yard = (s) => s.kind === 'yard' && s.variant === 'riftyard' && !s.twist, span = (s) => s.kind === 'span' && !s.twist, squad = (s) => s.kind === 'rampart' && s.twist === 'squad';
  for (const [want, what] of [[yard, 'a Rift-Yard\'s rifts'], [span, 'a span\'s shadows'], [rampart, 'the Rampart\'s march'], [squad, 'the march behind a Kynval squad']]) assert.equal(first(want, true).gap - first(want, false).gap, EG_STILL_MS, what);
  const a1 = first(ath, true);
  assert.deepEqual([a1.gap, first(ath, false).gap, a1.P.B.still], [EG_LOCK_EVERY_MS + EG_STILL_MS, EG_LOCK_EVERY_MS, 0], 'the Athenaeum\'s pressure; spent');
  // the Court's first escort, timed from its ring's wake
  for (const use of [false, true]) {
    const at = findHall((s) => s.kind === 'court' && s.lord === 'hound', [1, 1]);
    const P = breach({ seed: at.seed, h: at.h, pre: still(use), at: { 'acct-0': [at.spec.ring.x, at.spec.ring.z], 'acct-1': [at.spec.ring.x + 1, at.spec.ring.z], 'acct-2': [at.spec.ring.x, at.spec.ring.z + 1] } });
    for (let k = 0; k < 120 && !egLordsAwake(P.B.F); k++) P.step();
    assert.ok(egLordsAwake(P.B.F), 'the lord woke at its ring');
    assert.equal(P.B.F.waveAt - P.B.F.lordAt, EG_ESCORT_EVERY_MS + (use ? EG_STILL_MS : 0), `the first escort${use ? ' held' : ''}`);
  }
  // the Proving Walk's escort: at the wake, or EG_STILL_MS after it
  const pv = findHall((s) => s.kind === 'proving' && !s.twist, [1, 6]);
  const none = breach({ seed: pv.seed, h: pv.h, stay: true });
  assert.equal(foes(none.B.F).length, egEscortOf(3), 'the escort at the wake');
  const held = breach({ seed: pv.seed, h: pv.h, pre: still(true), stay: true });
  assert.deepEqual([foes(held.B.F).length, held.B.F.escortAt - held.B.hw], [0, EG_STILL_MS], 'none at the wake under Stillness');
  for (let k = 0; k < 60 && !foes(held.B.F).length; k++) held.step();
  assert.equal(foes(held.B.F).length, egEscortOf(3), 'risen once it is spent');
  // a Scriptorium, a Brink, a Gauntlet and a Deepway's champion chamber pour nothing to hold: Stillness waits for the next
  for (const want of [(s) => s.kind === 'scriptorium', (s) => s.kind === 'brink', (s) => s.kind === 'rampart' && s.variant === 'gauntlet' && !s.twist, (s) => s.kind === 'deepway' && s.spots.chamber?.[0]?.obj === 1 && !s.twist]) {
    const at = findHall(want, [1, 20]);
    assert.equal(egStillHolds(at.spec), false);
    assert.equal(breach({ seed: at.seed, h: at.h, pre: still(true), stay: true }).B.still, 1, `${at.spec.kind}: kept`);
  }
});

// ── L2-7: THE SHIELD AGAINST A HOST HIT ───────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-7 A SHIELDED ELITE\'S SHIELD TURNS A HOST HIT ON ITS FRONT (section 8.7: "a shield of a quarter of its health that only blows from behind break"): Sweeping Arc III\'s splash from a blow on a Harrier beside a Shielded Kynval facing the striker lands nothing on it; facing away, the splash lands and its shield soaks it first, the body\'s health whole; egShieldTurns and egShieldSoak are the one law (mutants: the front unread in a host hit; the soak skipped; the shield\'s mark kept past its breaking)', () => {
  const { seed, h } = riftyard();
  const P = breach({ seed, h, n: 2, clear: true, vs: { 'acct-0': [[vId('sweeping'), 3]] } });
  const F = P.B.F, me = P.place['acct-0'];
  const [hr] = egLegionRaise(F, [EG_KIND.harrier], [[me[0], me[1] + 2]], P.now(), []);
  const sh = egSquad(F, [[me[0], me[1] + 3.5]], P.now(), []).find((b) => egHas(b, EG_FL.shielded));
  F.bodies = F.bodies.filter((b) => b.role !== EG_ROLE.add || b === hr || b === sh);
  for (const b of [hr, sh]) b.up = 0;
  hr.hp = hr.max = 100_000;
  sh.x = me[0]; sh.z = me[1] + 3.5; sh.yaw = Math.atan2(me[0] - sh.x, me[1] - sh.z);   // facing the striker
  assert.equal(egShieldTurns(sh, me[0], me[1]), true);
  const hp0 = sh.hp, s0 = sh.shield;
  assert.ok(s0 > 0);
  P.blow('acct-0', hr.i, 40, HIT_KINDS.Melee);
  assert.deepEqual([sh.hp, sh.shield], [hp0, s0], 'the splash on its front lands nothing');
  sh.yaw += Math.PI;   // its back to the striker
  assert.equal(egFromBehind(sh, me[0], me[1]), true);
  P.blow('acct-0', hr.i, 40, HIT_KINDS.Melee);
  assert.equal(sh.hp, hp0, 'the body whole');
  assert.ok(sh.shield < s0, 'the shield soaks it');
  // the law itself: a soak past the shield breaks it, its mark dropped
  const out = [], left = sh.shield;
  sh.hp -= 10_000;
  assert.equal(egShieldSoak(F, sh, 10_000, out), left, 'it soaks what it has left');
  assert.equal(sh.shield, 0);
  assert.equal(egHas(sh, EG_FL.shielded), false, 'broken');
  assert.equal(egShieldTurns(sh, me[0], me[1]), false);
});

// ── L2-8: A WELLSPRING'S SAPPERS ──────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-8 A WELLSPRING RAISES SAPPERS THAT RELIGHT A BROKEN ANCHOR (sections 8.1 and 12): an anchor struck down, the great rift\'s next wave brings a Sapper, which walks to it and lights it again at a third (mutants: no Sapper raised; raised past the cap)', () => {
  const at = findHall((s) => s.kind === 'yard' && s.variant === 'wellspring' && !s.twist, [1, 6], 80);
  const P = breach({ seed: at.seed, h: at.h, n: 3 });
  const F = P.B.F, a0 = F.bodies.find((b) => b.role === EG_ROLE.obj && b.t === 'anchor'), n0 = F.bodies.filter((b) => b.t === 'anchor').length;
  const pre = P.frames.length, w0 = F.waveAt;
  while (P.now() <= w0 + 250) P.step();
  assert.ok(risen(P.frames.slice(pre)).length > 0 && !risen(P.frames.slice(pre)).includes(EG_KIND.sapper), 'a wave, and no Sapper while every anchor stands');
  P.put('acct-0', a0.x + 1, a0.z); P.step();
  for (let k = 0; k < 40 && F.bodies.includes(a0); k++) P.blow('acct-0', a0.i, 5000, HIT_KINDS.Melee);
  assert.equal(F.brokenAnchors?.length, 1, 'an anchor broken');
  const said0 = P.frames.length;
  for (let k = 0; k < 480 && !P.frames.slice(said0).some((f) => f.k === 'esay' && f.w === 'relit'); k++) P.step();
  assert.ok(risen(P.frames.slice(said0)).includes(EG_KIND.sapper), 'a Sapper raised');
  assert.ok(P.frames.slice(said0).some((f) => f.k === 'esay' && f.w === 'relit'), 'the anchor relit');
  assert.equal(F.bodies.filter((b) => b.t === 'anchor').length, n0, 'standing again');
  assert.equal(F.brokenAnchors.length, 0);
  // within the cap: the legion full, an anchor broken, no Sapper rises
  F.brokenAnchors.push([a0.x, a0.z]);
  egLegionRaise(F, Array(egLegionRoom(F)).fill(EG_KIND.harrier), [[at.spec.fight.x, at.spec.fight.z]], P.now(), []);
  for (const b of foes(F)) b.hp = b.max = 1e6;
  const full = P.frames.length, w1 = F.waveAt;
  while (P.now() <= w1 + 250) P.step();
  assert.ok(!risen(P.frames.slice(full)).includes(EG_KIND.sapper), 'none past the cap');
});

// ── L2-12: SWARM-MOTHER ON EVERY WAVE ─────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-12 SWARM-MOTHER\'S BINDER IN EVERY WAVE THE LEGION DRAWS (section 14: "every wave carries a Binder"): the decree is the fight\'s own (`F.D.swarm`), read by egWaveKinds whoever pours the wave - a lord\'s fury, its Muster-Call, a champion\'s escort - two at rank II, none unless a caller names its own; a Wager\'s Swarm-Mother bites from Hall 1 (the company\'s chosen pain - section 14\'s standing decrees), a Galleries Proving Walk\'s escort carrying its Binder (mutants: the default swarm 0; the escort without it)', () => {
  const F = egFightNew(egHallOf(1, 31, 0, 8), T0, [40, 40, 40], ['a', 'b', 'c']);
  F.D = { swarm: 1 };
  assert.equal(egWaveKinds(F, seeded(3), 3).filter((k) => k === EG_KIND.binder).length, 1, 'a lord\'s wave, its decree read');
  F.D = { swarm: 2 };
  assert.equal(egWaveKinds(F, seeded(3), 3).filter((k) => k === EG_KIND.binder).length, 2, 'two at rank II');
  assert.equal(egWaveKinds(F, seeded(3), 3, { swarm: 0 }).filter((k) => k === EG_KIND.binder).length, 0, 'a caller\'s own');
  F.D = {};
  assert.equal(egWaveKinds(F, seeded(3), 3).filter((k) => k === EG_KIND.binder).length, 0, 'none without it');
  const swarm = EG_DECREE_BY_KEY.swarm.id;
  assert.deepEqual(egWagerOf([swarm]), [swarm], 'a Wager may take it from Hall 1');
  const pv = findHall((s) => s.kind === 'proving' && !s.twist && s.band === 0, [1, 5]);
  const P = breach({ seed: pv.seed, h: pv.h, wg: [swarm], stay: true });
  const kinds = foes(P.B.F).map((b) => b.k);
  assert.equal(kinds.length, egEscortOf(3) + 1);
  assert.equal(kinds.filter((k) => k === EG_KIND.binder).length, 1, 'the escort carries its Binder');
});

// ── L2-16: THE HORN'S KYNVAL ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-16 THE HONOUR HORN\'S KYNVAL IS A MECHANIC\'S BODY (sections 11.2 and 12): with the legion at its cap the horn still calls its Kynval - it stands whatever the room and counts against it after (mutants: the Kynval held to the room)', () => {
  const at = findHall((s) => (s.spots.horn ?? []).length > 0 && s.kind === 'yard', [2, 20]);
  const P = breach({ seed: at.seed, h: at.h, n: 2, clear: true });
  const F = P.B.F;
  egLegionRaise(F, Array(egLegionRoom(F)).fill(EG_KIND.harrier), [[at.spec.fight.x, at.spec.fight.z]], P.now(), []);
  for (const b of foes(F)) b.hp = b.max = 1e6;
  assert.equal(egLegionRoom(F), 0, 'the legion at its cap');
  const said0 = P.frames.length;
  for (let k = 0; k < (EG_HORN_FIRST_MS / 250) + 8 && !P.frames.slice(said0).some((f) => f.k === 'esay' && f.w === 'horn'); k++) P.step();
  assert.ok(P.frames.slice(said0).some((f) => f.k === 'esay' && f.w === 'horn'), 'the horn calls');
  assert.ok(foes(F).some((b) => b.k === EG_KIND.kynval), 'its Kynval stands');
  assert.equal(egLegionRoom(F), 0, 'and counts');
});

// ── L3-20: THE ATHENAEUM'S HARRIERS ───────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-20 THE ATHENAEUM\'S PRESSURE IS HARRIERS (section 8.4: "ceil(n/4) Harriers rise every 15 s while the lock stands"): a company of five meets two Harriers every EG_LOCK_EVERY_MS, never a lead of another kind; under Swarm-Mother its Binder beside them (mutants: a mixed wave; the count off)', () => {
  const at = findHall((s) => s.kind === 'athenaeum' && !s.twist, [2, 12]);
  for (const wg of [[], [EG_DECREE_BY_KEY.swarm.id]]) {
    const P = breach({ seed: at.seed, h: at.h, n: 5, clear: true, wg });
    const said0 = P.frames.length;
    for (let k = 0; k < (3 * EG_LOCK_EVERY_MS) / 250; k++) P.step();
    const kinds = risen(P.frames.slice(said0));
    const harriers = kinds.filter((k) => k === EG_KIND.harrier).length, binders = kinds.filter((k) => k === EG_KIND.binder).length;
    const waves = P.frames.slice(said0).filter((f) => f.k === 'ead');
    assert.ok(waves.length >= 2 && waves.every((f) => f.a.filter((t) => t[2] === EG_KIND.harrier).length === Math.ceil(5 / 4)), 'ceil(n/4) Harriers a wave');
    assert.ok(harriers >= 4, `Harriers rise: ${kinds}`);
    assert.equal(kinds.length, harriers + binders, `nothing but Harriers (and Binders): ${kinds}`);
    assert.equal(binders > 0, wg.length > 0, 'a Binder under Swarm-Mother');
  }
});

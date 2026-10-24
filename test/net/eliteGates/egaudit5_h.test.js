// AUDIT EG V (2026-10-15, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.2, 8.7, 12, 13.2, 13.3, 15, 17.2 and
// 18) - FIX GROUP H, THE FOLLOWUPS (the director's halves), each pinned on fights the real producers stand (net/eliteGates/egLaw.js egHallOf;
// net/eliteGates/egBrain.js egBreachNew, egEnter, egStep, egWord, egFairWoke; net/eliteGates/egLords.js zoneOut; net/eliteGates/egBodies.js egAim; the wire's
// validEgOut):
//   B NEW-3 / F NEW-3  THE OLD MASTERS ON ANOTHER LORD'S GROUND: the Examination's runes and the Last Lesson's ring about the
//         master's own court (net/eliteGates/egLords.js mainDisc), the Examination's window never under the errand floor of its route walked
//         over the whole floor (egRuneRouteM); the Last Lesson's last ring - THE MASTERS' GROUND's too - stands to the fight's end
//         and is kept (egZonesKeep);
//   A1 NEW-1  an engine's blow judged on the company where it stands (engineWork's `here`, egPosedHere);
//   A1 NEW-2  the Mastery at the breach's third Redoubt, a deeper start's too (net/eliteGates/egRun.js egOffers);
//   A2 NEW-1  a Kynval Squad stands whole - a mechanic's body (net/eliteGates/egLegion.js egSquad);
//   L1-10's limit  a burn standing as a landing comes is no ground to flee to (net/eliteGates/egFloor.js egBurnsIn, egUnionHolds);
//   H-11  the Rift-Yard's squad holds its first wave Stillness's 10 s more, one law with the Rampart's (squadTwist);
//   L3-10 (b)  the door of a crossing names its first across (the trail's relay half).
// The screen's halves (E NEW-1, L3-10 (b) and (c)) are pinned in egaudit5_h_client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egOnFight, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egWord, egFairWoke, EG_SQUAD_HOLD_MS, EG_STILL_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsOf, egLordsAwake, egObjsOf, egRuneRouteM, zoneOut, EG_ZONE_FIGHT_MS, EG_RUNE_STAND_M, EG_LESSON_LAST_R } from '../../../src/net/eliteGates/egLords.js';
import { egAim, egPlace, egBodiesOf, egHas, EG_FL, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { egErrandMs, shDisc, shRing } from '../../../src/net/eliteGates/egShape.js';
import { egBurnsIn } from '../../../src/net/eliteGates/egFloor.js';
import { EG_KIND, egLegionRoom, egLegionCapOf } from '../../../src/net/eliteGates/egLegion.js';
import { EG_MASTERIES } from '../../../src/net/eliteGates/egVestige.js';
import { validEgOut } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const MIN = 60_000;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** The first hall of a seed (from `from`) whose spec passes `ok` - `[seed, h, spec]`. */
function hallWhere(ok, { seeds = 400, from = 1, to = 200, step = 1 } = {}) {
  for (let seed = 1; seed <= seeds; seed++) for (let h = from; h <= to; h += step) { const s = egHallOf(seed, h, 0); if (ok(s)) return [seed, h, s]; }
  throw new Error('no hall found');
}
/**
 * A breach of `n` at hall `h` of `seed` (its Proclamation cleared), woken with the company on the arrival plate: `at` stands a
 * member (the hall's frame), `step` beats the director (egStep) with every member where it was stood, its frames kept.
 */
function breachAt(seed, h, { n = 1, strata = [], tide = null, still = 0, wake = true, ew = 0 } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = [...strata]; B.tide = tide; B.still = still;
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 120 && wake && B.sg !== 'trial'; k++) step();
  if (wake) assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, frames, step, at, rng, subs: co.map(([sub]) => sub), now: () => now };
}
/** The Court's lords woken by the company standing in its wake ring. */
function wakeCourt(S) {
  for (const sub of S.subs) S.at(sub, S.spec.ring.x, S.spec.ring.z);
  for (let k = 0; k < 40 && !egLordsAwake(S.B.F); k++) S.step();
  assert.ok(egLordsAwake(S.B.F), 'the lords woke');
}
const discs = (spec) => spec.fl.filter((f) => f.t === 'd');
const inDisc = (f, x, z) => Math.hypot(x - f.x, z - f.z) <= f.r + 1e-6;

// ── B NEW-3: THE OLD MASTERS' ERRANDS ON ANOTHER LORD'S GROUND ─────────────────────────────────────────────────────────────
test('AUDIT EG V B NEW-3 THE EXAMINATION ABOUT THE MASTER\'S OWN COURT, ITS WINDOW THE ERRAND FLOOR WALKED (sections 13.2, THE ERRAND FLOOR, and 18, THE OLD MASTERS): the Last Spellmaster beside Grath on his islands and beside the Twin Lords lays his runes about the island or court he stands on as his second phase turns - never the ground\'s first - and the window is never under THE ERRAND FLOOR of its route walked over the whole floor (egRuneRouteM): the Twins\' far court 12.7 s, never the 10 s a lone runner from the other court could not keep; his own court of one disc keeps its 10 s (mutants: the runes about the first disc; the window the formula alone; the route a member\'s straight walk; the route a lone runner\'s at every company)', () => {
  for (const [key, far] of [['hound', 2], ['twins', 1]]) {
    const [seed, h, spec] = hallWhere((s) => s.kind === 'court' && s.lord === key && s.band === 3 && s.c % 2 === 1, { from: 105, to: 600, step: 5 });
    const S = breachAt(seed, h, { n: 4, strata: ['oldmasters'] });
    wakeCourt(S);
    const F = S.B.F, M = egLordsOf(F).find((L) => L.key === 'spellmaster');
    assert.ok(M, `${key}: the Spellmaster beside`);
    // stood on the ground's far island (or court) as his second phase turns, the company about him
    const D = discs(spec)[far];
    egPlace(F, M, D.x, D.z, S.now());
    for (const sub of S.subs) S.at(sub, D.x + 2, D.z);
    M.hp = M.max * 0.6;
    let runes = [];
    for (let k = 0; k < 40 && !runes.length; k++) { S.step(); runes = egObjsOf(F, 'rune'); }
    assert.equal(runes.length, 4, `${key}: four runes`);
    assert.ok(runes.every((r) => inDisc(D, r.x, r.z)), `${key}: every rune on the court he stands on`);
    assert.ok(!runes.some((r) => inDisc(discs(spec)[0], r.x, r.z)), `${key}: none on the ground's first`);
    const ordered = [...runes].sort((a, b) => a.pt - b.pt).map((r) => [r.x, r.z]), wMs = F.mem.exam.until - S.now();
    assert.equal(wMs, Math.max(10_000, egErrandMs(egRuneRouteM(spec, ordered, 4))), `${key}: the window its errand floor walked, never under 10 s`);
    // never under the straight route: the floor's farthest point to the farthest rune, as the crow flies
    let straight = 0;
    for (const f of spec.fl) {
      const R = f.t === 'd' ? f.r : Math.hypot(f.bx - f.ax, f.bz - f.az) / 2 + f.hw, cx = f.t === 'd' ? f.x : (f.ax + f.bx) / 2, cz = f.t === 'd' ? f.z : (f.az + f.bz) / 2;
      for (let x = cx - R; x <= cx + R; x += 1) for (let z = cz - R; z <= cz + R; z += 1) if (egOnFight(spec, x, z)) for (const [rx, rz] of ordered) straight = Math.max(straight, Math.hypot(x - rx, z - rz) - EG_RUNE_STAND_M);
    }
    assert.ok(wMs >= egErrandMs(straight), `${key}: ${wMs} ms, never under the straight route's ${egErrandMs(straight)} ms`);
    if (key === 'twins') assert.ok(wMs > 12_000, `the far court's window past the 10 s (${wMs} ms)`);
    // a member a rune: the longest walk to any rune; a lone runner's chain is longer
    assert.ok(egRuneRouteM(spec, ordered, 1) > egRuneRouteM(spec, ordered, 4), `${key}: a lone runner's chain is the longer route`);
  }
  // his own court: one disc, its 10 s at a company of four
  const [seed, h, spec] = hallWhere((s) => s.kind === 'court' && s.lord === 'spellmaster', { from: 5, to: 300, step: 5 });
  const S = breachAt(seed, h, { n: 4 });
  wakeCourt(S);
  const M = egLordsOf(S.B.F)[0];
  M.hp = M.max * 0.6;
  for (let k = 0; k < 40 && !S.B.F.mem.exam; k++) S.step();
  assert.equal(discs(spec).length, 1);
  assert.equal(S.B.F.mem.exam.until - S.now(), 10_000, 'his own court: 10 s');
  // the route WALKED: two courts 20 m apart joined only by a road round three sides - a rune on the first is some 85 m from the
  // second's far side by the road, never the 22 m across the magma; a lone runner's chain adds the walk from rune to rune
  const U = { fl: [{ t: 'd', x: 0, z: 0, r: 5, y: 0 }, { t: 'd', x: 0, z: 20, r: 5, y: 0 }, { t: 'l', ax: 0, az: 0, bx: 30, bz: 0, hw: 2, y: 0 }, { t: 'l', ax: 30, az: 0, bx: 30, bz: 20, hw: 2, y: 0 }, { t: 'l', ax: 30, az: 20, bx: 0, bz: 20, hw: 2, y: 0 }] };
  const one = egRuneRouteM(U, [[0, 3]], 2), two = egRuneRouteM(U, [[0, 3], [0, -3]], 1);
  assert.ok(one > 75 && one < 95, `walked round the road (${one.toFixed(1)} m)`);
  assert.ok(two - egRuneRouteM(U, [[0, 3]], 1) > 3.5 && two - egRuneRouteM(U, [[0, 3]], 1) < 6, `the chain's leg from rune to rune (${(two - egRuneRouteM(U, [[0, 3]], 1)).toFixed(2)} m)`);
});

test('AUDIT EG V B NEW-3 F NEW-3 THE LAST LESSON ABOUT THE COURT HE TURNED ON, ITS LAST RING TO THE FIGHT\'S END AND KEPT (sections 13.3 and 18): the Last Armsmaster beside the Twin Lords, stood on their far court as his third phase turns, closes that court\'s edge - and keeps closing it after he walks to the other; on THE MASTERS\' GROUND the last ring is r 17 (EG_MASTERS_LESSON_R) and burns to the fight\'s end (never the 6 s a ring before it burns); twenty-four newer zones push it out of the fight\'s list and the next beat zones it again and says it (egZonesKeep) (mutants: the ring about the first court; the court read each ring; the last ring the r 12 test; the keep never run; the ring never registered)', () => {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'court' && s.lord === 'twins' && s.band === 3 && s.c % 2 === 0, { from: 105, to: 600, step: 5 });
  const S = breachAt(seed, h, { n: 4, strata: ['oldmasters'] });
  wakeCourt(S);
  const F = S.B.F, M = egLordsOf(F).find((L) => L.key === 'armsmaster'), [C0, C1] = discs(spec);
  egPlace(F, M, C1.x, C1.z, S.now());
  for (const sub of S.subs) S.at(sub, C1.x + 3, C1.z);
  M.hp = M.max * 0.3; M.hpFloor = null;
  const rings = () => (F.zones ?? []).filter((z) => z.s[0] === 'r' && z.kind === 'burn');
  for (let k = 0; k < 4 * 10 && !rings().length; k++) S.step();
  assert.ok(rings().length, 'the Lesson\'s first ring');
  assert.deepEqual([rings()[0].s[1], rings()[0].s[2]], [C1.x, C1.z], 'about the court he turned on');
  egPlace(F, M, C0.x, C0.z, S.now());
  for (const sub of S.subs) S.at(sub, C0.x + 3, C0.z);
  const first = rings()[0].i;
  for (let k = 0; k < 4 * 8 && !rings().some((z) => z.i > first); k++) S.step();
  const next = rings().find((z) => z.i > first);
  assert.ok(next && next.s[1] === C1.x && next.s[2] === C1.z, 'still about it, wherever he walks');
  // Both Courts Burn: its thirds laid to the fight's end and kept with every such zone (egZonesKeep)
  const tw = egLordsOf(F).find((L) => L.key === 'twins');
  tw.hp = tw.max * 0.3; tw.hpFloor = null;
  for (let k = 0; k < 4 * 12 && (F.keep ?? []).filter((q) => q.s[0] === 'c').length < 2; k++) S.step();
  assert.equal((F.keep ?? []).filter((q) => q.s[0] === 'c').length, 2, 'Both Courts Burn\'s two thirds kept');
  // THE MASTERS' GROUND: the Armsmaster's own court with the Spellmaster beside - its last ring r 17, to the fight's end
  const [s2, h2, sp2] = hallWhere((s) => s.kind === 'court' && s.lord === 'armsmaster' && s.c % 2 === 0, { from: 5, to: 300, step: 5 });
  const G = breachAt(s2, h2, { n: 2, strata: ['oldmasters'] });
  wakeCourt(G);
  const A = egLordsOf(G.B.F).find((L) => L.key === 'armsmaster');
  assert.equal(G.B.F.mem.lessonMin, 17, 'THE MASTERS\' GROUND');
  A.hp = A.max * 0.3; A.hpFloor = null;
  const last = () => (G.B.F.zones ?? []).find((z) => z.s[0] === 'r' && z.s[3] === 17);
  for (let k = 0; k < 4 * 40 && !last(); k++) G.step();
  assert.ok(last(), 'the ring closed to r 17');
  assert.equal(last().until - last().from, EG_ZONE_FIGHT_MS, 'and burns there to the fight\'s end');
  assert.ok(sp2.fl[0].r > EG_LESSON_LAST_R, 'a court wider than the last ring of its own');
  for (let k = 0; k < 4 * 12; k++) G.step();
  assert.equal(G.B.F.mem.lessonR, 17, 'and closes no further');
  // pushed out by the fight's newest zones, it is zoned again at the next beat and said to every screen
  for (let k = 0; k < 24; k++) zoneOut(G.B.F, 'burn', shDisc(0, 300 + k, 2), G.now(), G.now() + 60_000, [], { p: 0.05, b: 1, el: 'fire' });
  assert.equal(last(), undefined, 'pushed out');
  const out = G.step();
  assert.ok(last() && last().until - G.now() > 0.9 * EG_ZONE_FIGHT_MS, 'stood again');
  assert.ok(out.some((o) => o.k === 'ez' && o.s[0] === 'r' && o.s[3] === 17 && validEgOut(JSON.parse(JSON.stringify(o)))), 'and said again');
});

// ── A1 NEW-1: AN ENGINE'S BLOW JUDGED ON THE COMPANY WHERE IT STANDS ────────────────────────────────────────────────────────
test('AUDIT EG V A1 NEW-1 AN ENGINE\'S BLOW ON THE COMPANY WHERE IT STANDS (sections 11.10 and 13.2; L2-2\'s root): a member whose last pose is an earlier hall\'s, standing by its numbers where the Shelf would close the one hole a lord\'s ring leaves, holds no engine\'s word - the Shelf topples, said, onto the company that stands in this hall (egPosedHere); the same member posed in this hall holds it (mutants: the company by any hall\'s pose)', () => {
  const [seed, h, spec] = hallWhere((s) => (s.engines ?? []).some((e) => e.kind === 'shelf') && s.kind === 'yard', { seeds: 60 });
  const used = () => {
    const S = breachAt(seed, h, { n: 2 });
    const F = S.B.F, ei = spec.engines.findIndex((e) => e.kind === 'shelf'), e = spec.engines[ei];
    assert.ok(F.engCd, 'the engines stood');
    // the Shelf's lane, as it will lay it: from the engine toward the thickest legion - none stands, so the fight's heart
    for (const b of egBodiesOf(F, EG_ROLE.add)) b.hp = 0;
    const tx = spec.fight.x, tz = spec.fight.z, yaw = Math.atan2(tx - e.x, tz - e.z), P = [e.x + Math.sin(yaw) * 7, e.z + Math.cos(yaw) * 7];
    // a lord's ring about P lands as the Shelf does (its band within the wind-up floor's 1.5 s): alone it leaves P's hole; with
    // the Shelf, nothing
    const ring = egAim(F, spec, { o: 0, s: [shRing(P[0], P[1], 1.5, 12)], at: S.now() + 1500, wu: 1500, p: 0.2, b: 0, el: null, nm: 'Test Ring' }, [], S.now(), []);
    assert.equal(ring.at, S.now() + 1500, 'the ring lands with the Shelf');
    return { S, F, ei, e, P };
  };
  for (const posedHere of [false, true]) {
    const { S, F, ei, e, P } = used();
    S.B.mem['acct-1'].pose = { x: P[0], z: P[1], h: posedHere ? S.B.h : S.B.h - 1 };   // an earlier hall's pose, by its numbers where the hole is
    const out = egWord(S.B, 'acct-0', { k: 'use', i: ei }, { sx: spec.x0 + e.x, z: e.z }, S.now(), S.rng);
    const said = out.some((o) => o.k === 'eb' && o.nm === 'the Shelf');
    assert.equal(said, !posedHere, posedHere ? 'a member posed in this hall in the hole: held' : 'an earlier hall\'s pose: nothing of this hall - said');
    assert.equal(F.held.some((q) => q.b.nm === 'the Shelf'), posedHere);
  }
});

// ── A1 NEW-2: THE MASTERY AT THE BREACH'S THIRD REDOUBT ─────────────────────────────────────────────────────────────────────
/** A breach of three from Redoubt `ew` stood at its circle `c`'s Court and felled there (the fight's own mark), at the rest's
 *  window - the director's offers said. */
function offersAt(c, ew) {
  const rng = seeded(12345);
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [], pr: 'pyre' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.h = 5 * c; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const frames = [];
  const plate = (i) => { const s = egHallOf(12345, B.h, 0); return { sx: s.x0 + s.arrive.x + i * 0.5, z: s.arrive.z }; };
  const step = () => { now += 250; frames.push(...egStep(B, now, co.map(([sub], i) => ({ sub, ...plate(i), dead: false, at: now })), rng)); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  B.F.mem.lordsFell = 1; step();
  assert.equal(B.sg, 'rest', `Redoubt ${c} taken`);
  for (let k = 0; k < 2400 && B.rdSeq?.window !== 1; k++) step();
  return frames.filter((f) => f.k === 'offer');
}
const masteries = (offers) => offers.map((o) => o.v.filter((v) => v >= 100).length);
test('AUDIT EG V A1 NEW-2 THE MASTERY AT THE BREACH\'S THIRD REDOUBT (sections 15 and 16.6: a deeper start counts from its own first, as THE LEAN does): a breach from Hall 1 offers each member a Mastery at Redoubt 3; one started at Redoubt 3 offers none at its first (Redoubt 4) and one at its third (Redoubt 6), where the absolute Redoubt 3 never comes (mutants: the Mastery at Redoubt 3 alone; the breach\'s count from Redoubt 1)', () => {
  assert.ok(EG_MASTERIES.every((M) => M.id >= 100));
  assert.deepEqual(masteries(offersAt(3, 0)), [1, 1, 1], 'Redoubt 3 of a breach from Hall 1');
  assert.deepEqual(masteries(offersAt(4, 3)), [0, 0, 0], 'a deeper start\'s first: none');
  assert.deepEqual(masteries(offersAt(6, 3)), [1, 1, 1], 'its third: the Mastery');
  assert.deepEqual(masteries(offersAt(4, 0)), [0, 0, 0], 'Redoubt 4 of a breach from Hall 1: none');
});

// ── A2 NEW-1: A KYNVAL SQUAD STANDS WHOLE ───────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V A2 NEW-1 A KYNVAL SQUAD STANDS WHOLE (sections 8.7: "four Kynval elites in place of a wave", and 12\'s mechanic bodies): seed 19\'s Hall 16 - a Rampart\'s squad for a company of three, whose legion\'s cap left room for three - stands all four elites, an affix each, and counts against the room after; section 12 names the squad among the bodies that stand whatever the room (mutants: the squad held to the room)', () => {
  const S = breachAt(19, 16, { n: 3 });
  assert.equal(S.spec.twist, 'squad');
  const kv = egBodiesOf(S.B.F, EG_ROLE.add).filter((b) => b.k === EG_KIND.kynval);
  assert.deepEqual(kv.map((b) => [EG_FL.searing, EG_FL.shielded, EG_FL.wrathful, EG_FL.unshaken].findIndex((f) => egHas(b, f))).sort(), [0, 1, 2, 3], 'four elites, an affix each');
  assert.ok(kv.every((b) => egHas(b, EG_FL.elite)));
  assert.ok(egBodiesOf(S.B.F, EG_ROLE.add).filter((b) => b.hp > 0).length > egLegionCapOf(S.B.F), 'stood past the room the cap left');
  assert.equal(egLegionRoom(S.B.F), 0, 'and counted against it after');
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8'), s12 = page.slice(page.indexOf('## 12. The legion'), page.indexOf('## 13. The lords')).replace(/\s+/g, ' ');
  assert.match(s12, /a summons a mechanic needs - .*?a Kynval Squad's four elites \(section 8\.7\).*? - stands whatever the room/, 'section 12 names it');
});

// ── L1-10's limit: THE GROUND BURNING ───────────────────────────────────────────────────────────────────────────────────────
/** A Court of Grath (a hall of `seed`) stood for one member: the bridge between its first two islands, its islands. */
function bridgeCourt() {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'court' && s.lord === 'hound', { from: 5, to: 300, step: 5 });
  const S = breachAt(seed, h, { n: 1 });
  wakeCourt(S);
  const F = S.B.F, br = spec.fl.find((f) => f.t === 'l'), isles = discs(spec);
  const ends = isles.filter((d) => Math.hypot(d.x - br.ax, d.z - br.az) < d.r + 1 || Math.hypot(d.x - br.bx, d.z - br.bz) < d.r + 1);
  assert.equal(ends.length, 2);
  F.blows.length = 0; F.held = []; F.zones = [];
  return { S, F, spec, br, ends, mid: [(br.ax + br.bx) / 2, (br.az + br.bz) / 2], isles };
}
test('AUDIT EG V L1-10 THE GROUND BURNING IS NO GROUND TO FLEE TO (section 13.2, THE UNION FLOOR - fix group B\'s limit): a member mid-bridge, one island fallen and the other burning already - a blow over the whole bridge is held, as it is with both fallen; with the other standing whole it is said; a member in a small pool runs out of it - a blow on it said; a court burning whole holds nothing more - said; egBurnsIn reads the burns standing in the window alone (mutants: a live burn ground again; a burn no floor to cross; the landing unjudged without the new blow; the window\'s burns misread)', () => {
  const { S, F, spec, ends, mid, isles } = bridgeCourt(), now = S.now(), out = [];
  const me = [{ sub: 'acct-0', x: mid[0], z: mid[1] }], disc = (r = 8, at = 2000) => ({ o: 0, s: [shDisc(mid[0], mid[1], r)], at: now + at, wu: at, p: 0.3, b: 0, el: null, nm: 'Test Slam' });
  // a disc of r 8 over the bridge in 2 s: a member reaches 10.5 m - the islands' first metres past it
  zoneOut(F, 'void', shDisc(ends[0].x, ends[0].z, ends[0].r), now - 1000, now + 15_000, out);
  assert.ok(egAim(F, spec, disc(), me, now, []), 'one island fallen, the other standing: ground to flee to - said');
  F.blows.length = 0; F.held = [];
  zoneOut(F, 'burn', shDisc(ends[1].x, ends[1].z, ends[1].r), now - 5000, now + 60_000, out, { p: 0.08, b: 3, el: 'fire' });
  assert.equal(egAim(F, spec, disc(), me, now, []), null, 'the other burning already: only fire beyond - held');
  assert.equal(F.held.length, 1);
  // a member inside a burning ring runs through it between the landings: ground beyond it
  F.blows.length = 0; F.held = []; F.zones = [];
  const isle = isles.find((d) => !ends.includes(d)) ?? isles[0], c = [isle.x, isle.z], on = [{ sub: 'acct-0', x: c[0], z: c[1] }];
  zoneOut(F, 'burn', shRing(c[0], c[1], 3, 5), now - 1000, now + 60_000, out, { p: 0.08, b: 3, el: 'fire' });
  assert.ok(egAim(F, spec, { ...disc(3, 3000), s: [shDisc(c[0], c[1], 3)] }, on, now, []), 'a member inside a burning ring runs through it: said');
  // a court burning whole: the set empties without the blow - nothing more held
  F.blows.length = 0; F.held = []; F.zones = [];
  zoneOut(F, 'burn', shDisc(mid[0], mid[1], 80), now - 1000, now + 60_000, out, { p: 0.08, b: 3, el: 'fire' });
  assert.ok(egAim(F, spec, disc(2, 2000), me, now, []), 'the whole floor burning: nothing more held - said');
  // the burns standing in the window: one gone before it, one burning into it, one lit in it, one lit past it, a void
  const z = (i, kind, from, until) => ({ i, kind, s: shDisc(0, 0, 3), from: now + from, until: now + until });
  const zones = [z(1, 'burn', -9000, -10), z(2, 'burn', -1000, 500), z(3, 'burn', 2000, 9000), z(4, 'burn', 4000, 9000), z(5, 'void', -1000, 9000), z(6, 'burn', 3000, 9000)];
  assert.deepEqual(egBurnsIn(zones, now, now + 3000).map((q) => q.i), [2, 3, 6], 'burning at some instant of the window');
});

// ── H-11: STILLNESS AGAINST A RIFT-YARD'S SQUAD ─────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V H-11 STILLNESS BUYS ITS 10 S AGAINST A RIFT-YARD\'S SQUAD (sections 8.7 and 17.2 - fix group A1\'s L2-6): a Rift-Yard whose twist is a Kynval Squad holds its first wave EG_SQUAD_HOLD_MS, and under Stillness EG_STILL_MS past it - the Cantrip spent buys the hall\'s first wave its time, as the Rampart\'s squad\'s (one law, squadTwist) (mutants: the yard\'s squad unheld by Stillness; the Rampart\'s; the shared law\'s term)', () => {
  const [ys, yh] = hallWhere((s) => s.kind === 'yard' && s.twist === 'squad' && !['wellspring', 'muster', 'holdfast'].includes(s.variant));
  const [rs, rh] = hallWhere((s) => s.kind === 'rampart' && s.twist === 'squad' && s.variant !== 'gauntlet');
  for (const [seed, h, kind] of [[ys, yh, 'yard'], [rs, rh, 'rampart']]) {
    const plain = breachAt(seed, h, { n: 2 }), still = breachAt(seed, h, { n: 2, still: 1 });
    assert.equal(plain.B.F.waveAt - plain.B.F.wokeAt, EG_SQUAD_HOLD_MS, `${kind}: the squad holds the first wave 30 s`);
    assert.equal(still.B.F.waveAt - still.B.F.wokeAt, EG_SQUAD_HOLD_MS + EG_STILL_MS, `${kind}: Stillness 10 s past it`);
    assert.equal(still.B.still, 0, `${kind}: spent`);
  }
});

// ── L3-10 (b): THE DOOR NAMES THE FIRST ACROSS ──────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-10 (b) THE DOOR NAMES THE FIRST ACROSS (section 8.2, THE TRAIL - the relay\'s half): a span\'s door opened by a member\'s arrival says it - the door word\'s `s` that member - and the wire keeps it; a Rift-Yard\'s door, opened by its rifts, names none (mutants: the opener unnamed; the wire dropping it)', () => {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'span');
  const S = breachAt(seed, h, { n: 2 });
  egFairWoke(S.B, S.now());
  S.at('acct-1', spec.end.x, spec.end.z);
  let door = null;
  for (let k = 0; k < 8 && !door; k++) door = S.step().find((f) => f.k === 'esay' && f.w === 'door') ?? null;
  assert.ok(door, 'the door opened');
  assert.deepEqual(door.s, ['acct-1'], 'its first across named');
  assert.deepEqual(validEgOut(JSON.parse(JSON.stringify(door))).s, ['acct-1'], 'the wire keeps it');
  // a Scriptorium's door opens on its quiet's end - by no one's arrival: it names none
  const [qs, qh] = hallWhere((s) => s.kind === 'scriptorium');
  const Q = breachAt(qs, qh, { n: 1 });
  // PIN MOVED (EG-PERFECT, THE AUDIT - spec law 10): its quiet waits for its company on its trial's own ground (egTrialAwaits)
  const qg = Q.spec.route?.courses?.find((c) => !c.b);
  if (qg) Q.at('acct-0', (qg.x0 + qg.x1) / 2, qg.z0 + 1);
  let qd = null;
  for (let k = 0; k < 4 * 40 && !qd; k++) qd = Q.step().find((f) => f.k === 'esay' && f.w === 'door') ?? null;
  assert.ok(qd, 'the quiet hall\'s door opened');
  assert.equal(qd.s, undefined, 'naming none');
});

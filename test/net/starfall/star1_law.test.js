// STAR1 (bible/11-Multiplayer/Starfall.md sections 1, 4, 5 and 6): THE STARFALL'S LAW - the night and its stars on the
// sky's own dark, the spot, the waves, the light, the owner, the encounter clock, the ledger's machine and the receipt.
// Every number below is the law's own; each pin is held to fail under a one-character change of the law it names
// (tools/mutants/star1.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  starfallRuns,
  STAR_HOUR_MS, STAR_FALLS_MS, STAR_PER_NIGHT, STAR_OMEN_MS, STAR_STREAK_MS, STAR_LIFE_MS, STAR_GRACE_MS, STAR_AFTER_MS,
  starNightAt, starOk, starTimes, starInWindow, starHeard, starSpotLocal, starNativeOf, starNear, STAR_REACH_M, STAR_UNITS_PER_M,
  STAR_WAVES, STAR_GATHER_MS, STAR_WAVE_MAX_MS, STAR_KILL_MIN_MS, STAR_BREATH_MS, STAR_MASTER_MIN_MS, starWaveSize, starCircleSize, STAR_WAVE_MIN, STAR_WAVE_MAX, STAR_FOE_HEALTH,
  STAR_LIGHT, STAR_BLOW_LIGHT, STAR_BREATH_LIGHT, STAR_BLOWS_HZ, STAR_BLOWS_BURST, starBandOf, STAR_PRESENT_MS, STAR_ORPHAN_MS,
  newStarLedger, stepStar, foldStarWord, starClearFloorMs, starEarned, starTop, starLedgerState, starPhaseLeft, starOwner, starMayMake, starLostAt,
  P_FALLEN, P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST, STAR_LOST_DARK, STAR_LOST_DAWN, STAR_ACCOUNTS_MAX,
} from '../../../src/net/starfall/starfallLaw.js';
import { mintStarReceipt, readStarReceipt, verifyStarReceipt, starReceiptValid, STAR_RECEIPT_TTL_S } from '../../../src/net/starfall/starReceipt.js';
import { skyClassicMinutes } from '../../../src/net/skyLaw.js';
import { PIXEL_UNITS, LIVE_EVENTS } from '../../../src/net/wire.js';
import { FESTIVALS, festivalOpen } from '../../../src/net/festivalLaw.js';
import { PIXEL_M, GATE_SPOT_SPREAD_M } from '../../../src/net/gate/gateLaw.js';

const SKY_HOUR = (ms) => (Math.floor(skyClassicMinutes(ms)) % 1440) / 60;
/** The Witches' Festival's days (net/festivalLaw.js FESTIVALS - the Starfall's own), and a night inside them. */
const { fromMs: FROM_MS, toMs: TO_MS } = FESTIVALS[0];
const N0 = Math.ceil(FROM_MS / STAR_HOUR_MS) + 3;
const word = (o = {}) => ({ lv: 10, s: 0, o: 0, kw: 0, kn: 0, wc: 0, hb: 0, mf: 0, ...o });

test('STAR1 THE NIGHT: three stars a night, the sky\'s 18:00, 21:00 and midnight, each standing fifteen minutes - the last to dawn (mutants: a fall moved; the life lengthened; the omen shortened)', () => {
  assert.deepEqual(STAR_FALLS_MS, [-900_000, -450_000, 0]);
  assert.equal(STAR_PER_NIGHT, 3);
  assert.equal(STAR_HOUR_MS, 3_600_000);
  assert.equal(STAR_OMEN_MS, 90_000);
  assert.equal(STAR_STREAK_MS, 8_000);
  assert.equal(STAR_LIFE_MS, 900_000);
  const t = starTimes(N0, 2);
  assert.deepEqual(t, { omenAt: N0 * STAR_HOUR_MS - 90_000, streakAt: N0 * STAR_HOUR_MS - 8_000, fallAt: N0 * STAR_HOUR_MS, endAt: N0 * STAR_HOUR_MS + 900_000, goneAt: N0 * STAR_HOUR_MS + 900_000 + STAR_AFTER_MS });
});

test('STAR1 THE SKY\'S DARK: over a year of nights inside and around the window, every star lands in the sky\'s night and its deadline is no later than the sky\'s dawn - read off net/skyLaw.js itself, which the relay never imports (mutants: a fall at the sky\'s noon)', () => {
  const first = Math.ceil(Date.UTC(2026, 9, 4) / STAR_HOUR_MS);
  for (let n = first; n < first + 24 * 365; n += 7) {
    for (let k = 0; k < STAR_PER_NIGHT; k++) {
      const t = starTimes(n, k);
      const fall = SKY_HOUR(t.fallAt), end = SKY_HOUR(t.endAt - 1);
      assert.ok(fall >= 18 || fall < 6, `night ${n} star ${k} lands at the sky's ${fall}`);
      assert.ok(end >= 18 || end < 6, `night ${n} star ${k} stands past the sky's dawn (${end})`);
    }
    assert.equal(SKY_HOUR(starTimes(n, 2).fallAt), 0, 'the third star lands at the sky\'s midnight');
    assert.equal(SKY_HOUR(starTimes(n, 0).fallAt), 18, 'the first at its dusk');
  }
});

test('STAR1 THE NIGHT AN INSTANT STANDS IN: from the first omen to the last deadline, one night - and the hour\'s first quarter is the night before\'s dawn (mutants: the life left out of the night)', () => {
  const t0 = starTimes(N0, 0), t2 = starTimes(N0, 2);
  for (const at of [t0.omenAt, t0.fallAt, t2.fallAt - 1, t2.fallAt, t2.endAt]) assert.equal(starNightAt(at), N0, `at ${at - t0.omenAt} ms`);
  assert.equal(starNightAt(t2.endAt + 1), N0 + 1);
  assert.ok(starTimes(N0 + 1, 0).omenAt > t2.endAt, 'two nights never overlap');
});

test('STAR1 THE WINDOW: stars fall on the Witches\' Festival\'s own days - its first instant to its last, read off the festival\'s one calendar by the relay and every client alike, staged by nobody (mutants: the festival\'s calendar unread; a star outside it)', () => {
  assert.deepEqual([FROM_MS, TO_MS], [Date.UTC(2026, 9, 20), Date.UTC(2026, 10, 8)], 'the festival\'s 2026 days');
  for (const t of [FROM_MS - 1, FROM_MS, FESTIVALS[0].eveFromMs, TO_MS - 1, TO_MS]) assert.equal(starfallRuns(t), festivalOpen(t), `the festival's own answer at ${t}`);
  assert.ok(starfallRuns(FROM_MS) && !starfallRuns(FROM_MS - 1));
  assert.ok(starfallRuns(TO_MS - 1) && !starfallRuns(TO_MS));
  assert.ok(!starfallRuns(NaN));
  assert.ok(!LIVE_EVENTS.includes('witchfest'), 'no live event to stage: the calendar is the festival\'s');
  assert.ok(starInWindow(N0, 1));
  assert.ok(!starInWindow(Math.ceil(TO_MS / STAR_HOUR_MS) + 2, 1));
  assert.ok(!starInWindow(Math.floor(FROM_MS / STAR_HOUR_MS) - 2, 1), 'a star that fell before the festival opened');
  assert.ok(!starOk(N0, 3) && !starOk(N0, -1) && !starOk(0, 0) && starOk(N0, 0));
  const t = starTimes(N0, 1);
  assert.ok(!starHeard(N0, 1, t.fallAt - 1), 'nothing to defend before it lands');
  assert.ok(starHeard(N0, 1, t.fallAt) && starHeard(N0, 1, t.endAt + STAR_GRACE_MS - 1));
  assert.ok(!starHeard(N0, 1, t.endAt + STAR_GRACE_MS));
});

test('STAR1 THE SPOT: each star stands within the gate\'s spread of its pixel\'s heart, the same on every machine, a different spot for each star; the relay places it from the word\'s pixel (mutants: the spread doubled; the native north turned; the reach unchecked)', () => {
  for (let n = N0; n < N0 + 200; n++) for (let k = 0; k < 3; k++) {
    const [e, no] = starSpotLocal(n, k);
    assert.ok(Math.hypot(e - PIXEL_M / 2, no - PIXEL_M / 2) <= GATE_SPOT_SPREAD_M + 1e-9);
  }
  assert.notDeepEqual(starSpotLocal(N0, 0), starSpotLocal(N0, 1));
  assert.equal(STAR_UNITS_PER_M, PIXEL_UNITS / PIXEL_M);
  assert.equal(STAR_UNITS_PER_M, 40);
  const [e, no] = starSpotLocal(N0, 1);
  const [x, z] = starNativeOf(N0, 1, 300, 200);
  assert.equal(x, 300 * PIXEL_UNITS + e * 40);
  assert.equal(z, (499 - 200) * PIXEL_UNITS + no * 40);
  assert.equal(STAR_REACH_M, 60);
  assert.ok(starNear(N0, 1, 300, 200, x + 59 * 40, z));
  assert.ok(!starNear(N0, 1, 300, 200, x + 61 * 40, z));
  assert.ok(!starNear(N0, 1, 300, 200, x, z + 61 * 40));
});

test('STAR1 THE WAVES\' SIZE AND THE CIRCLE: four for the first defender and two for each beside it, one more each wave, four to twenty-four - alone 4, 5, 6 and 7, eight 18 to 21 (STAR-TUNE: "the enemies are too few"; "we should go beyond the limit"); the circle one and half the defenders, two to five, the Heart-Star\'s twice (mutants: STAR-TUNE-the-old-sizes; STAR-TUNE-a-defender-one-more; STAR-TUNE-the-waves-alike; STAR1-the-floor-dropped; STAR1-the-ceiling-raised)', () => {
  const sizes = [1, 2, 3, 4].map((k) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 64].map((n) => starWaveSize(k, n)));
  assert.deepEqual(sizes, [
    [4, 4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 24, 24],
    [5, 5, 7, 9, 11, 13, 15, 17, 19, 23, 24, 24, 24],
    [6, 6, 8, 10, 12, 14, 16, 18, 20, 24, 24, 24, 24],
    [7, 7, 9, 11, 13, 15, 17, 19, 21, 24, 24, 24, 24],
  ]);
  assert.deepEqual([STAR_WAVE_MIN, STAR_WAVE_MAX], [4, 24], 'twenty-four at most: one spawn grant of the star\'s own kind (net/grantLaw.js GRANT_KINDS.star)');
  assert.equal(STAR_FOE_HEALTH, 2, 'the coven\'s foes twice their health');
  assert.deepEqual([0, 1, 2, 3, 4, 6, 8, 10].map((n) => starCircleSize(n)), [2, 2, 2, 3, 3, 4, 5, 5]);
  assert.deepEqual([1, 6].map((n) => starCircleSize(n, true)), [4, 8]);
  assert.equal(STAR_WAVES, 4);
});

test('STAR1 THE BAND: the median of the defenders\' levels - band 1 to level 8, band 2 to 15, band 3 above; the lower middle of an even count (mutants: the mean for the median; a band\'s top moved)', () => {
  assert.deepEqual([[], [1], [8], [9], [15], [16], [60]].map(starBandOf), [1, 1, 1, 2, 2, 3, 3]);
  assert.equal(starBandOf([3, 20]), 1, 'two defenders: the lower one\'s band');
  assert.equal(starBandOf([3, 20, 20]), 3);
  assert.equal(starBandOf([2, 3, 30, 30, 30]), 3, 'never the mean (19)');
  assert.equal(starBandOf([12, 12, 2, 40]), 2);
});

/** A ledger with one defender at the star, owning the foes. */
function begun(nowMs) {
  const led = newStarLedger({ n: N0, k: 1, px: 300, py: 200 }, nowMs);
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1, lv: 12 }), true, nowMs);
  return led;
}

test('STAR1 THE MACHINE, END TO END: a defender\'s word begins the gathering; the first wave ten seconds later, sized by who stands there; a wave cleared no sooner than its foes could die; a breath steadies the light; a wave out of time ends anyway; the master after the fourth breath; its fall held no sooner than 45 s; the breath five seconds (mutants: the gather skipped; the kill bound dropped; the breath\'s light dropped; the master\'s bound dropped; a fifth wave; STAR-TUNE-the-long-breath)', () => {
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  assert.equal(led.p, P_GATHER);
  let now = t;
  const tick = (ms, w = word({ o: 1, lv: 12 })) => { now += ms; foldStarWord(led, 'acctA', 'Ann', w, true, now); };
  tick(STAR_WORD_MS_TEST);
  assert.equal(led.p, P_GATHER, 'still gathering at two seconds');
  for (let i = 0; i < 4; i++) tick(2_000);
  assert.equal(led.p, P_WAVE); assert.equal(led.w, 1); assert.equal(led.wz, starWaveSize(1, 1));
  assert.equal(led.b, 2, 'the wave\'s band, by the level its defender said');
  // cleared too soon: refused - a lone defender's first wave is four (STAR-TUNE), 10 s at the least
  tick(2_000, word({ o: 1, lv: 12, kw: 1, wc: 1, kn: 4 }));
  assert.equal(led.p, P_WAVE, 'a wave of four is not cleared in two seconds');
  assert.equal(led.kn, 4);
  led.lt = 60;
  for (let i = 0; i < 3; i++) tick(2_000, word({ o: 1, lv: 12, kw: 1, wc: 1, kn: 4 }));
  assert.equal(led.p, P_WAVE, 'nor in eight: four foes are 10 s at the least');
  tick(2_000, word({ o: 1, lv: 12, kw: 1, wc: 1, kn: 4 }));
  assert.equal(led.p, P_BREATH, 'cleared once its foes could have died');
  assert.equal(led.lt, 60 + STAR_BREATH_LIGHT);
  // STAR-TUNE ("The time between waves is too long"): the breath five seconds, to the second
  assert.equal(STAR_BREATH_MS, 5_000);
  tick(STAR_BREATH_MS - 1_000);
  assert.equal(led.p, P_BREATH, 'a second short of the breath: still drawn');
  tick(1_000);
  assert.equal(led.p, P_WAVE); assert.equal(led.w, 2); assert.equal(led.wz, starWaveSize(2, 1), 'one more each wave');
  // wave 2 runs out its time
  for (let i = 0; i < 50; i++) tick(2_000);
  assert.equal(led.p, P_BREATH, 'a wave out of time ends anyway');
  for (const k of [3, 4]) {
    for (let i = 0; i < 3; i++) tick(2_000);
    assert.equal(led.w, k);
    for (let i = 0; i < 50; i++) tick(2_000);
  }
  for (let i = 0; i < 3; i++) tick(2_000);
  assert.equal(led.p, P_MASTER, 'the master after the fourth breath, never a fifth wave');
  assert.equal(led.w, STAR_WAVES);
  tick(2_000, word({ o: 1, lv: 12, mf: 1 }));
  assert.equal(led.p, P_MASTER, 'its fall refused before 45 s');
  for (let i = 0; i < 22; i++) tick(2_000);
  foldStarWord(led, 'acctB', 'Bran', word({ lv: 30 }), true, now);   // stood at the star, never struck
  tick(2_000, word({ o: 1, lv: 12, mf: 1, s: 1 }));
  assert.equal(led.p, P_HELD);
  assert.equal(led.hd, now);
  assert.deepEqual(starEarned(led).map(([a]) => a), ['acctA'], 'one who stood and never struck earns nothing');
  assert.deepEqual(starTop(starEarned(led)), ['Ann']);
  assert.equal(foldStarWord(led, 'acctA', 'Ann', word({ o: 1 }), true, now + 2_000), false, 'nothing moves a held star');
});
test('AUDIT STAR-TUNE F2 THE FLOOR SHARED BY ITS DEFENDERS: a wave\'s clearing is believed once its foes, shared among the defenders who could kill them at once, could have died - a lone defender\'s as it was, a party of eight\'s eighteen foes in 7.5 s, never the 45 s a foe\'s floor alone made it (mutants: AUDIT-STAR-TUNE-F2-the-floor-unshared)', () => {
  assert.deepEqual([[4, 1], [7, 1], [18, 8], [21, 8], [24, 12], [5, 0]].map(([wz, nd]) => starClearFloorMs(wz, nd)), [10_000, 17_500, 7_500, 7_500, 5_000, 12_500]);
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  const party = ['acctB', 'acctC', 'acctD', 'acctE', 'acctF', 'acctG', 'acctH'];
  let now = t;
  const tick = (ms, w = word({ o: 1, lv: 12 })) => {
    now += ms;
    for (const a of party) foldStarWord(led, a, a, word({ lv: 12 }), true, now);
    foldStarWord(led, 'acctA', 'Ann', w, true, now);
  };
  for (let i = 0; i < 6 && led.p !== P_WAVE; i++) tick(2_000);
  assert.equal(led.p, P_WAVE);
  assert.equal(led.nd, 8, 'eight defenders at the star');
  assert.equal(led.wz, starWaveSize(1, 8), 'a party of eight\'s first wave');
  const ws = led.ws, clear = (ms) => tick(ms, word({ o: 1, lv: 12, kw: 1, wc: 1, kn: led.wz }));
  clear(6_000);
  assert.equal(led.p, P_WAVE, `not in six seconds (${led.ec - ws} ms in)`);
  clear(2_000);
  assert.equal(led.p, P_BREATH, `cleared at eight - its floor ${starClearFloorMs(led.wz, 8)} ms, never ${led.wz * STAR_KILL_MIN_MS}`);
});
const STAR_WORD_MS_TEST = 2_000;

test('STAR1 THE DEATHS NAME THEIR WAVE: the owner\'s deaths are credited to the wave its word names (`kw`) alone - its screen says the last wave\'s through the breath, and the word that ends the breath starts the next, which stands whole; an honest owner\'s defense stands every wave whole and holds the star (mutants: the deaths on any wave)', () => {
  const t = starTimes(N0, 1).fallAt + 5_000;
  let now = t;
  const led = begun(now);
  const say = (o) => { now += STAR_WORD_MS_TEST; foldStarWord(led, 'acctA', 'Ann', word({ o: 1, s: 1, lv: 12, ...o }), true, now); };
  while (led.p !== P_WAVE) say({});
  say({ kw: 0, kn: 2 });
  assert.equal(led.kn, 0, 'deaths of no wave named are none');
  say({ kw: 2, kn: 2 });
  assert.equal(led.kn, 0, 'nor of a wave not standing');
  say({ kw: 1, kn: 2 });
  assert.equal(led.kn, 2, 'this wave\'s');
  // the owner's screen, as starfallHost.js keeps it: the wave it stood (kw) and its deaths (kn), said through the breath
  const S = { kw: 1, kn: 2, wc: 0, left: Math.max(0, led.wz - 2) };
  const stood = [];
  for (let i = 0; i < 600 && led.p !== P_HELD && led.p !== P_LOST; i++) {
    if (led.p === P_WAVE && S.kw !== led.w) { S.kw = led.w; S.kn = led.kn; S.wc = 0; S.left = Math.max(0, led.wz - led.kn); stood.push([led.w, led.wz, S.left]); }
    if (led.p === P_WAVE && S.left > 0 && i % 2 === 0) { S.left--; S.kn++; }
    if (led.p === P_WAVE && S.left === 0) S.wc = led.w;
    say({ kw: S.kw, kn: S.kn, wc: S.wc, mf: led.p === P_MASTER && led.ec - led.ma >= STAR_MASTER_MIN_MS ? 1 : 0 });
  }
  assert.deepEqual(stood.map(([w]) => w), [2, 3, 4], 'each wave after the first seen');
  for (const [w, wz, left] of stood) assert.equal(left, wz, `wave ${w} stands whole: none of the last wave's deaths credited to it`);
  assert.equal(led.p, P_HELD);
});

test('STAR1 THE LIGHT: the owner\'s blows on the star drink it, credited six at once and nine a second after - clipped, then credited as the count runs on; another\'s count drinks nothing; at nothing the star is lost, dark (mutants: a non-owner\'s blows credited; the burst raised; the rate raised; the light never lost)', () => {
  assert.deepEqual([STAR_LIGHT, STAR_BLOW_LIGHT, STAR_BLOWS_HZ, STAR_BLOWS_BURST], [100, 1, 9, 6]);
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  foldStarWord(led, 'acctB', 'Bran', word({ hb: 50 }), true, t);
  assert.equal(led.lt, STAR_LIGHT, 'a non-owner\'s count drinks nothing');
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1, hb: 20 }), true, t);
  assert.equal(led.lt, STAR_LIGHT - 6, 'the burst alone at once');
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1, hb: 20 }), true, t + 1_000);
  assert.equal(led.lt, STAR_LIGHT - 6 - 6, 'a second later, the bucket refilled to its burst - the rest clipped');
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1, hb: 20 }), true, t + 1_500);
  assert.equal(led.lt, STAR_LIGHT - 16, 'and credited as the count runs on, to the count itself');
  let now = t + 1_500;
  for (let hb = 20; led.p !== P_LOST; hb += 6) {
    now += 1_000;
    foldStarWord(led, 'acctA', 'Ann', word({ o: 1, hb }), true, now);
    if (led.lt === 0) assert.equal(led.p, P_LOST, 'lost by the very word that drank its last light');
  }
  assert.equal(led.lt, 0);
  assert.equal(led.why, STAR_LOST_DARK);
  assert.equal(led.lo, now);
});

test('STAR1 THE ENCOUNTER CLOCK: it runs only while someone stands at the star - a star left a minute moves fifteen seconds; a word from off the star neither counts nor runs it (mutants: the clock run by any word; the presence bound dropped)', () => {
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1 }), true, t + 2_000);
  assert.equal(led.ec, 2_000);
  foldStarWord(led, 'acctC', 'Cal', word({ s: 1 }), false, t + 30_000);
  assert.equal(led.ec, 2_000 + STAR_PRESENT_MS, 'a far word moves it no further than the last defender\'s reach');
  assert.equal(led.a.acctC.s, 0, 'a far word\'s strike is not counted');
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1 }), true, t + 62_000);
  assert.equal(led.ec, 2_000 + STAR_PRESENT_MS, 'a minute alone is fifteen seconds of the star\'s');
  assert.equal(led.p, P_WAVE, 'the gathering ended on the encounter clock');
  assert.equal(starPhaseLeft(led), STAR_WAVE_MAX_MS - (2_000 + STAR_PRESENT_MS - STAR_GATHER_MS));
});

test('STAR1 THE DEADLINE AND ITS GRACE: a star is made only before its deadline; its words are heard STAR_GRACE_MS past it, and a master\'s fall said in flight at the deadline holds it; unheld then, it is lost at dawn, whatever stood (mutants: the deadline ignored; the grace unheld; a star made in the grace)', () => {
  const t = starTimes(N0, 1);
  assert.equal(starLostAt(N0, 1), t.endAt + STAR_GRACE_MS);
  assert.equal(starMayMake(N0, 1, t.fallAt), true);
  assert.equal(starMayMake(N0, 1, t.endAt - 1), true);
  assert.equal(starMayMake(N0, 1, t.endAt), false, 'never made past its deadline - a first word then would make a star already lost');
  assert.equal(starHeard(N0, 1, t.endAt + STAR_GRACE_MS - 1), true, 'a ledger\'s last words still heard');
  assert.equal(starMayMake(N0, 1, t.fallAt - 1), false);
  const led = begun(t.fallAt + 5_000);
  assert.equal(stepStar(led, t.endAt - 1), true);
  assert.notEqual(led.p, P_LOST);
  stepStar(led, t.endAt + STAR_GRACE_MS - 1);
  assert.notEqual(led.p, P_LOST, 'the grace: not lost yet');
  assert.equal(stepStar(led, t.endAt + STAR_GRACE_MS), true);
  assert.equal(led.p, P_LOST);
  assert.equal(led.why, STAR_LOST_DAWN);
  const fresh = newStarLedger({ n: N0, k: 1, px: 300, py: 200 }, t.fallAt);
  assert.equal(fresh.p, P_FALLEN);
  stepStar(fresh, starLostAt(N0, 1));
  assert.equal(fresh.p, P_LOST, 'a star nobody came to is taken at dawn too');
  // the master's fall, said as the deadline came (its 45 s long run): held by a word that lands in the grace
  const atMaster = () => {
    const m = begun(t.endAt - 60_000);
    Object.assign(m, { p: P_MASTER, w: STAR_WAVES, ma: 0, ec: 100_000, nearAt: t.endAt - 3_000, stepAt: t.endAt - 3_000, ownAt: t.endAt - 3_000 });
    return m;
  };
  for (const dt of [-1, 0, 1_000, STAR_GRACE_MS - 1]) {
    const m = atMaster();
    foldStarWord(m, 'acctA', 'Ann', word({ o: 1, s: 1, mf: 1 }), true, t.endAt + dt);
    assert.equal(m.p, P_HELD, `the fall heard ${dt} ms past the deadline holds`);
  }
  const late = atMaster();
  foldStarWord(late, 'acctA', 'Ann', word({ o: 1, s: 1, mf: 1 }), true, t.endAt + STAR_GRACE_MS);
  assert.equal(late.p, P_LOST, 'past the grace, dawn');
});

test('STAR1 THE OWNER: the first who says so holds the foes; another\'s word is not the owner\'s while it holds; it gives them up by saying so, or by silence past ten seconds (mutants: the orphan bound dropped; the yield ignored)', () => {
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  assert.equal(starOwner(led, t), 'acctA');
  foldStarWord(led, 'acctB', 'Bran', word({ o: 1 }), true, t + 1_000);
  assert.equal(starOwner(led, t + 1_000), 'acctA');
  foldStarWord(led, 'acctB', 'Bran', word({ o: 1 }), true, t + 1_000 + STAR_ORPHAN_MS + 1);
  assert.equal(starOwner(led, t + 1_000 + STAR_ORPHAN_MS + 1), 'acctB', 'silent past the orphan bound: the next who says so');
  foldStarWord(led, 'acctB', 'Bran', word({ o: 0 }), true, t + 13_000);
  assert.equal(led.own, '', 'a race lost: it says so, and holds nothing');
  foldStarWord(led, 'acctA', 'Ann', word({ o: 1 }), true, t + 13_500);
  assert.equal(led.own, 'acctA');
  assert.equal(starLedgerState(led).ow, 1);
});

test('STAR1 THE LEDGER\'S BOUNDS: a ledger records sixty-four accounts; the state says the phase, the wave, the light whole, the defenders and their band (mutants: the accounts unbounded)', () => {
  const t = starTimes(N0, 1).fallAt + 5_000;
  const led = begun(t);
  for (let i = 0; i < 100; i++) foldStarWord(led, `acct${i}x`, `P${i}`, word(), true, t);
  assert.equal(Object.keys(led.a).length, STAR_ACCOUNTS_MAX);
  led.lt = 41.2;
  const s = starLedgerState(led);
  assert.deepEqual([s.k, s.n, s.s, s.px, s.py, s.p, s.w, s.lt, s.nd, s.b], ['st', N0, 1, 300, 200, P_GATHER, 0, 42, 64, 2]);
  assert.ok([P_FALLEN, P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST].join() === '0,1,2,3,4,5,6');
});

test('STAR1 THE RECEIPT: j1, its claims disjoint from every other shape the key signs; minted, read and verified; an unsigned one read and declined; a week long (mutants: another shape\'s field let through; the version not checked)', async () => {
  const subtle = webcrypto.subtle;
  const keys = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(starTimes(N0, 1).fallAt / 1000) + 100;
  const r = await mintStarReceipt({ n: N0, k: 1, s: 'acct_1234', c: 77, l: 12 }, keys.privateKey, { subtle, nowS });
  assert.match(r, /^j1\./);
  const c = readStarReceipt(r);
  assert.equal(c.night, N0); assert.equal(c.star, 1); assert.equal(c.c, 77); assert.equal(c.signed, true);
  assert.equal(c.e - c.i, STAR_RECEIPT_TTL_S);
  const v = await verifyStarReceipt(r, keys.publicKey, { subtle, nowS });
  assert.equal(v.ok, true);
  assert.deepEqual(v.claims.sf, [N0, 1]);
  const bad = await verifyStarReceipt(r.replace(/^j1/, 'l1'), keys.publicKey, { subtle, nowS });
  assert.deepEqual(bad, { ok: false, why: 'version' });
  const unsigned = await mintStarReceipt({ n: N0, k: 1, s: 'acct_1234', c: 77, l: 12 }, null, { subtle, nowS });
  assert.equal(readStarReceipt(unsigned).signed, false);
  assert.deepEqual(await verifyStarReceipt(unsigned, keys.publicKey, { subtle, nowS }), { ok: false, why: 'unsigned' });
  const base = { sf: [N0, 1], s: 'acct_1234', c: 1, l: 5, i: nowS, e: nowS + 60 };
  assert.ok(starReceiptValid(base));
  for (const f of ['n', 'k', 't', 'o', 'd', 'w', 'y', 'b', 'h', 'r', 'x', 'zz']) assert.ok(!starReceiptValid({ ...base, [f]: 1 }), `a receipt carrying \`${f}\` is not a star's`);
  assert.ok(!starReceiptValid({ ...base, sf: [N0, 3] }), 'no fourth star');
  assert.ok(!starReceiptValid({ ...base, l: 61 }));
});

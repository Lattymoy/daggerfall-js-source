// AUDIT RPT1026 (lane I, EVENTS) I1: A TEAM THAT LEARNED THE GEARING IS NEVER HELD OUT FOR THE HOLLOW BY ONE HELD HAND.
// RPT1026-EVENTS ORRERY-HANDS kept each turner's count of the road it lengthened for the whole Hollow (net/superDungeon/sdBrain.js
// orreryRightsSnapped), so a griefer's dozen no longer came back at every snap. But held hands hold each other - a held hand
// waits while ANY other has turned within SD_TURN_COMPANY_MS - so once a team had spent its six apiece learning the gearing
// (each stone turned the long way and turned back: nothing left longer than it found it), the first held hand to turn kept
// the thread while it turned. One griefer account turning on held the team out of every thread, snap after snap, and the
// Concord came in no slot; the old law's snap had freed them. Now a hand the thread held out behind held hands alone is
// marked (orreryWaited) and begun again at the snap; a hand held out by a free hand's turns keeps its count, so the
// lane's own contest stands. Played through the realm's own judge (orreryJudge - server/src/index.js _sdTurn's) and its
// snap (orreryRightsSnapped on `x`), the stones' settle as the hall keeps it. tools/mutants/audit_rpt1026_events.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  orreryOf, orreryFresh, orreryTurn, orreryShortest, orrerySolve, orreryRightsFresh, orreryRightsSnapped, orreryMayTurn,
  orreryTurned, orreryWaited, orreryJudge, SD_STONES, SD_TURN_LONG_MAX, SD_TURN_COMPANY_MS, SD_STONE_SETTLE_MS, sdHour,
} from '../../../src/net/superDungeon/sdBrain.js';

/** The realm's thread: `turn(who, i, a)` judged by orreryJudge over the hall's lock and its stones' settle, the rights
 *  snapped as _sdTurn snaps them. */
function realmHall(s) {
  const o = orreryOf(s);
  const hall = { ...orreryFresh(o), last: SD_STONES.map(() => 0) };
  const H = { o, hall, R: orreryRightsFresh(), now: 0, snaps: 0, waits: 0 };
  H.spent = {};   // each hand's long turns taken in the Hollow, whatever its rights say of them
  H.turn = (who, i, a) => {
    const road = orreryShortest(o, hall.st);
    const res = orreryJudge(o, hall, hall.last, i, a, H.now, H.R, who, `peer-${who}`);
    if (!res) return 'settling';
    if (res.wait) { H.waits++; return 'wait'; }
    if (orreryShortest(o, orreryTurn(o, hall.st, i, a)) > road) H.spent[who] = (H.spent[who] ?? 0) + 1;
    if (res.x) { H.snaps++; H.R = orreryRightsSnapped(H.R); }
    hall.st = res.st; hall.f = res.f; hall.ok = res.ok; hall.last[i] = H.now;
    return 'turned';
  };
  H.longWay = (i) => (orreryShortest(o, orreryTurn(o, hall.st, i, 1)) > orreryShortest(o, hall.st) ? 1 : -1);
  return H;
}
/** Three who learn the gearing by turning - each its stone the long way and back, SD_TURN_LONG_MAX times apiece (a learner
 *  told to wait tries again) - then `K` griefer accounts turning the long way turn for turn against the three turning the way
 *  (test/net/superDungeon/rpt1026_events_orrery.test.js's contest). Answers the hall and its counts. */
function learnedContest(s, K, N = 2400) {
  const H = realmHall(s), team = ['a:t1', 'a:t2', 'a:t3'];
  const until = (who, i, a) => { for (let tries = 0; tries < 400; tries++) { H.now += SD_STONE_SETTLE_MS; if (H.turn(who, i, a) === 'turned') return; } };
  for (let k = 0; k < SD_TURN_LONG_MAX; k++) for (const [j, who] of team.entries()) {
    const i = (k + 2 * j) % SD_STONES.length;
    H.now += SD_STONE_SETTLE_MS;
    const a = H.longWay(i);
    until(who, i, a);   // the long way
    until(who, i, -a);   // and back
  }
  const learned = team.map((w) => H.spent[w] ?? 0);
  for (let n = 0; n < N && !H.hall.ok; n++) {
    H.now += 350;
    const who = n % 2 ? team[(n >> 1) % 3] : `a:g${(n >> 1) % K}`;
    let i, a;
    if (who.startsWith('a:g')) { i = n % 6; a = H.longWay(i); }
    else { const way = orrerySolve(H.o, H.hall.st); i = SD_STONES.findIndex((_, j) => way[j] !== 0); if (i < 0) break; a = sdHour(way[i]) <= 6 ? 1 : -1; }
    H.turn(who, i, a);
  }
  return { ...H, learned };
}

test('AUDIT RPT1026 I1 THE LEARNED TEAM: three who spent their six apiece learning the gearing (every long turn mended) against one, two, four or eight griefer accounts reach the Concord in every slot - before, one griefer account kept every thread of the Hollow and the Concord came in none (mutants: the mark never set; the snap forgives nobody; the judge never marks)', () => {
  for (const K of [1, 2, 4, 8]) {
    for (let s = 1; s <= 24; s++) {
      const H = learnedContest(s, K);
      assert.ok(H.learned.every((n) => n >= SD_TURN_LONG_MAX), `slot ${s}: each of the team spent its six learning (${H.learned})`);
      assert.ok(H.hall.ok, `K ${K}, slot ${s}: the Concord (${H.snaps} snaps, ${H.waits} waits)`);
      assert.ok(H.snaps <= K + 2, `K ${K}, slot ${s}: ${H.snaps} snaps`);
    }
  }
});

test('AUDIT RPT1026 I1 THE MARK: a held hand told to wait behind held hands alone is marked and begun again at the snap; behind a free hand it is not, and keeps its count; the nets and the marks begin again with the thread; the realm\'s judge marks as it refuses (mutants: marked behind a free hand too; the mark never set; the snap forgives nobody; the judge never marks)', () => {
  const R = orreryRightsFresh();
  const long6 = (Rx, who, t0) => { for (let k = 0; k < SD_TURN_LONG_MAX; k++) orreryTurned(Rx, who, `peer-${who}`, 10, 11, t0 + k); };
  long6(R, 'a:g', 1000); long6(R, 'a:t', 2000);   // both held
  orreryTurned(R, 'a:free', 'peer-free', 11, 10, 2100);   // a solver: free
  // the team's hand waits while the griefer and the solver have turned: a free hand among them - no mark
  assert.equal(orreryMayTurn(R, 'a:t', 2200), false);
  orreryWaited(R, 'a:t', 2200);
  assert.deepEqual(R.wt, {}, 'held out by a free hand: no mark');
  // the solver quiet past the company's minute, the griefer turning on: the team's hand waits behind a held hand alone
  orreryTurned(R, 'a:g', 'peer-g', 10, 11, 2100 + SD_TURN_COMPANY_MS + 10);
  const t = 2100 + SD_TURN_COMPANY_MS + 20;
  assert.equal(orreryMayTurn(R, 'a:t', t), false, 'held');
  orreryWaited(R, 'a:t', t);
  assert.deepEqual(R.wt, { 'a:t': 1 }, 'marked');
  const after = orreryRightsSnapped(R);
  assert.equal(after.by['a:t'].long, 0, 'the marked hand begun again at the snap');
  assert.equal(after.by['a:g'].long, SD_TURN_LONG_MAX + 1, 'the hand that held the thread keeps its count');
  assert.deepEqual([after.ids, after.wt], [{}, {}], 'the nets and the marks begin again with the thread');
  assert.equal(orreryMayTurn(after, 'a:t', t + 1), true, 'free in the next thread');
  orreryTurned(after, 'a:t', 'peer-t', 10, 9, t + 2);
  assert.equal(orreryMayTurn(after, 'a:g', t + 3), false, 'and the griefer held while the freed hand turns');
  // the realm's judge marks as it refuses - behind a held hand alone, never behind a free one
  const o = orreryOf(5), last = SD_STONES.map(() => 0);
  const R2 = orreryRightsFresh();
  long6(R2, 'a:g', 100); long6(R2, 'a:t', 200);
  assert.deepEqual(orreryJudge(o, orreryFresh(o), last, 0, 1, 300 + SD_STONE_SETTLE_MS, R2, 'a:t', 'peer-t'), { wait: true });
  assert.deepEqual(R2.wt, { 'a:t': 1 }, 'the judge marked the hand it refused behind a held hand');
  const R3 = orreryRightsFresh();
  long6(R3, 'a:t', 200); orreryTurned(R3, 'a:free', 'peer-free', 11, 10, 300);
  assert.deepEqual(orreryJudge(o, orreryFresh(o), last, 0, 1, 300 + SD_STONE_SETTLE_MS, R3, 'a:t', 'peer-t'), { wait: true });
  assert.deepEqual(R3.wt, {}, 'and not behind a free one');
  // the realm snaps by orreryRightsSnapped, and judges by orreryJudge
  const RELAY = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(RELAY, /const res = orreryJudge\(o, hall, hall\.last, m\.i, m\.a, now, R, who, a\.id\);/);
  assert.match(RELAY, /if \(res\.x\) this\._sdRights = \{ s, R: orreryRightsSnapped\(R\) \};/);
});

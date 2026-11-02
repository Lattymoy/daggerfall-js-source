// RPT1026-EVENTS ORRERY-HANDS (a private report: a crowded Orrery held unsolved for half an hour, the reporter blaming unseen
// players turning the stones the wrong way on purpose): THE STONES'
// RIGHTS LAST THE HOLLOW, AND THE HANDS ARE NAMED. The snap began the turners' counts afresh, so a handful of accounts spent
// the fray between them, the Hour snapped back, and they spent it again; and a hand concealed could not be told from the
// forty round it. Now a turner's lengthening is counted for the Hollow (net/superDungeon/sdBrain.js orreryRightsSnapped, the
// realm's _sdTurn), a stone's hover names its last turner, and the snap's line names the turners it found no help in, off the
// roster - seen or not (scenes/superDungeon/sdHall.js sdHallNamed, sdSnapLine). tools/mutants/rpt1026_events.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  orreryOf, orreryFresh, orreryStep, orreryTurn, orreryShortest, orrerySolve, orreryRightsFresh, orreryRightsSnapped,
  orreryMayTurn, orreryTurned, orreryJudge, SD_STONES, SD_TURN_LONG_MAX, SD_TURN_COMPANY_MS, SD_STONE_SETTLE_MS, sdHour,
  SD_STONE_POS, realmToDungeon,
} from '../../../src/net/superDungeon/sdBrain.js';
import { createSdHall, sdStoneKey, sdHallNamed, sdSnapLine, SD_HALL_TEXT, SD_LASH_NAMED } from '../../../src/scenes/superDungeon/sdHall.js';
import { stoneFrame } from '../../../src/world/superDungeon/sdHall.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** `K` griefer accounts against a team of three that knows the way, turn about (each griefer's turn the stone that lengthens
 *  the road most, the team's the next of the way), the realm's own law over the rights (orreryMayTurn, orreryTurned), the
 *  snap's rights `afterSnap(R)`. Answers whether the Concord came within `N` turns, and how many snaps it took. */
function contest(s, K, afterSnap, N = 1200) {
  const o = orreryOf(s);
  let hall = orreryFresh(o), R = orreryRightsFresh(), now = 0, snaps = 0;
  const team = ['a:t1', 'a:t2', 'a:t3'];
  for (let n = 0; n < N && !hall.ok; n++) {
    now += 350;
    const who = n % 2 ? team[(n >> 1) % 3] : `a:g${(n >> 1) % K}`;
    let i, a;
    if (who.startsWith('a:g')) { i = n % 6; a = orreryShortest(o, orreryTurn(o, hall.st, i, 1)) > orreryShortest(o, hall.st) ? 1 : -1; }
    else { const way = orrerySolve(o, hall.st); i = SD_STONES.findIndex((_, j) => way[j] !== 0); if (i < 0) break; a = sdHour(way[i]) <= 6 ? 1 : -1; }
    if (!orreryMayTurn(R, who, now)) continue;
    const road = orreryShortest(o, hall.st), res = orreryStep(o, hall, i, a);
    orreryTurned(R, who, who, road, orreryShortest(o, orreryTurn(o, hall.st, i, a)), now);
    if (res.x) { snaps++; R = afterSnap(R); }
    hall = { st: res.st, f: res.f, ok: res.ok };
  }
  return { ok: hall.ok, snaps };
}

test('RPT1026-EVENTS ORRERY-HANDS THE LAW: four, five, eight griefer accounts against a team that knows the way - with the counts begun again at every snap the Concord never came in any slot (the report\'s long wait); counted for the Hollow it comes in every slot, the Hour snapping back at most once for every two of them (mutants: the counts begun again at the snap)', () => {
  for (const K of [4, 5, 8]) {
    for (let s = 1; s <= 24; s++) {
      const was = contest(s, K, () => orreryRightsFresh());
      assert.equal(was.ok, false, `K ${K}, slot ${s}: the old law - the dozen back at every snap`);
      const now = contest(s, K, orreryRightsSnapped);
      assert.ok(now.ok, `K ${K}, slot ${s}: the Concord (${now.snaps} snaps)`);
      assert.ok(now.snaps <= Math.ceil(K / 2), `K ${K}, slot ${s}: ${now.snaps} snaps`);
    }
  }
});

test('RPT1026-EVENTS ORRERY-HANDS THE RIGHTS PAST A SNAP: the lash\'s nets begin again with the thread, a turner\'s count is kept; a griefer at its six waits through the snap while others turn, and a lone learner is still never held (mutants: the nets kept past the snap)', () => {
  const o = orreryOf(3);
  const R = orreryRightsFresh();
  for (let k = 0; k < SD_TURN_LONG_MAX; k++) orreryTurned(R, 'a:g', 'peer-g', 10, 11, 1000 + k);
  orreryTurned(R, 'a:t', 'peer-t', 11, 10, 2000);
  const after = orreryRightsSnapped(R);
  assert.deepEqual(after.ids, {}, 'the lash\'s nets begun again');
  assert.equal(after.by['a:g'].long, SD_TURN_LONG_MAX, 'the count kept');
  assert.equal(orreryMayTurn(after, 'a:g', 3000), false, 'held through the snap while another turns');
  assert.equal(orreryMayTurn(after, 'a:g', 2000 + SD_TURN_COMPANY_MS), true, 'and free once the company has gone quiet');
  assert.equal(orreryMayTurn(after, 'a:t', 3000), true, 'the solver never held');
  // the realm's judge over the kept rights: told to wait, nothing turned
  const lock = { ...orreryFresh(o) };
  assert.deepEqual(orreryJudge(o, lock, [], 0, 1, 3000 + SD_STONE_SETTLE_MS, after, 'a:g', 'peer-g'), { wait: true });
  // a lone learner: alone in the Hollow, any number of long turns through any number of snaps
  let L = orreryRightsFresh();
  for (let k = 0; k < 4 * SD_TURN_LONG_MAX; k++) { assert.equal(orreryMayTurn(L, 'a:me', k * 400), true); orreryTurned(L, 'a:me', 'peer-me', 5, 6, k * 400); if (k % 7 === 6) L = orreryRightsSnapped(L); }
  const RELAY = read('server/src/index.js');
  assert.match(RELAY, /if \(res\.x\) this\._sdRights = \{ s, R: orreryRightsSnapped\(R\) \};/, 'the realm\'s snap keeps the counts');
});

test('RPT1026-EVENTS ORRERY-HANDS THE NAMES: the hall\'s word names its turner and the snap\'s lashed off the roster - whether their bodies are drawn or not - me as "you"; an id the roster does not know is no name; the snap\'s line names at most SD_LASH_NAMED and counts the rest; a snap with nobody named is the snap alone; and nothing says which way a turn went (mutants: the turner unnamed; the lashed unnamed; the snap\'s line unnamed)', () => {
  const roster = new Map([['peer-a', 'Ash'], ['peer-b', 'Bram'], ['peer-c', 'Cyr'], ['peer-d', 'Dov'], ['peer-e', 'Eld'], ['peer-f', 'Fen'], ['peer-g', 'Gil']]);
  const nameOf = (id) => roster.get(id) ?? null;
  const turn = sdHallNamed({ k: 'pz', s: 1, st: [0, 0, 0, 0, 0, 0], f: 3, lit: 1, ok: false, i: 2, a: 1, id: 'peer-c', q: 4 }, nameOf, 'peer-me');
  assert.equal(turn.by, 'Cyr');
  assert.equal(turn.i, 2, 'the word else untouched');
  assert.equal(sdHallNamed({ k: 'pz', i: 1, a: 1, id: 'peer-me' }, nameOf, 'peer-me').by, SD_HALL_TEXT.you);
  assert.equal('by' in sdHallNamed({ k: 'pz', i: 1, a: 1, id: 'peer-zz' }, nameOf, 'peer-me'), false, 'no name for an id the roster lacks');
  assert.equal(sdHallNamed(null, nameOf), null);
  const snap = sdHallNamed({ k: 'pz', s: 1, x: 1, i: 0, a: 1, id: 'peer-a', ls: ['peer-a', 'peer-b', 'peer-me', 'peer-zz'] }, nameOf, 'peer-me');
  assert.deepEqual(snap.lsn, ['Ash', 'Bram', SD_HALL_TEXT.you]);
  assert.equal(sdSnapLine(snap), SD_HALL_TEXT.snapLashes(`Ash, Bram, ${SD_HALL_TEXT.you}`, 0));
  assert.match(sdSnapLine(snap), /Ash, Bram, you/);
  const many = sdHallNamed({ k: 'pz', s: 1, x: 1, ls: [...roster.keys()] }, nameOf, 'peer-me');
  assert.equal(SD_LASH_NAMED, 5);
  assert.equal(sdSnapLine(many), SD_HALL_TEXT.snapLashes('Ash, Bram, Cyr, Dov, Eld', 2));
  assert.match(sdSnapLine(many), /Ash, Bram, Cyr, Dov, Eld and 2 others\.$/);
  assert.equal(sdSnapLine(sdHallNamed({ k: 'pz', x: 1, ls: [] }, nameOf)), SD_HALL_TEXT.snap, 'nobody to name: the snap alone');
  assert.equal(sdSnapLine(null), SD_HALL_TEXT.snap);
  for (const w of [turn, snap]) for (const v of Object.values(w)) assert.doesNotMatch(String(v), /longer|shorter|wrong|right way/i, 'never the way a turn went');
  const W = read('src/scenes/world.js');
  assert.match(W, /_sdHall = sdHallNamed\(w, peerName, online\?\.id \?\? null\);/, 'the world host names the realm\'s word off its roster');
  assert.match(W, /sdSay\(sdSnapLine\(_sdHall\)\);/, 'and says the snap by it');
  assert.match(W, /const peerName = \(peerId\) => \(peerId \? \(online\?\.peers\.get\(peerId\)\?\.name \|\| null\) : null\);/, 'the roster - every peer of the room, drawn or concealed');
});

test('RPT1026-EVENTS ORRERY-HANDS THE PLAQUE: a stone\'s hover names the hand that last turned it, as the realm\'s word named it, and the next turner in its place; a stone never turned names nobody (mutants: the turner never kept; the hover unnamed)', () => {
  const o = orreryOf(1);
  let t = 10_000;
  const hall = createSdHall({ renderer: { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} }, audio: { play3d() {} }, s: 1, now: () => t, onTurn: () => true, say() {} });
  hall.stand({ dynamicDraws: [], collider: { addMesh() {} } });
  const at = realmToDungeon(SD_STONE_POS[2].x + stoneFrame(2).n[0] * 1.5, 0, SD_STONE_POS[2].z + stoneFrame(2).n[2] * 1.5);
  const nameOf = (id) => ({ 'peer-ink': 'Ink', 'peer-oak': 'Oak' })[id] ?? null;
  hall.frame(0.016, at, sdHallNamed({ k: 'pz', s: 1, st: [...o.start], f: 0, lit: 0, ok: false }, nameOf));
  assert.deepEqual(hall.hoverName(sdStoneKey(2, 1)).subs, [SD_HALL_TEXT.hour(o.start[2]), SD_HALL_TEXT.forward], 'never turned: nobody named');
  const st = orreryTurn(o, o.start, 2, 1);
  hall.frame(0.016, at, sdHallNamed({ k: 'pz', s: 1, st, f: 1, lit: 0, ok: false, i: 2, a: 1, id: 'peer-ink', q: 1 }, nameOf));
  assert.deepEqual(hall.hoverName(sdStoneKey(2, -1)).subs.at(-1), SD_HALL_TEXT.lastBy('Ink'));
  assert.equal(SD_HALL_TEXT.lastBy('Ink'), 'Last turned by Ink');
  assert.equal(hall.hoverName(sdStoneKey(3, 1)).subs.length, 2, 'another stone: nobody');
  t += SD_STONE_SETTLE_MS;
  hall.frame(0.016, at, sdHallNamed({ k: 'pz', s: 1, st: orreryTurn(o, st, 2, -1), f: 2, lit: 0, ok: false, i: 2, a: -1, id: 'peer-oak', q: 1 }, nameOf));
  assert.equal(hall.hoverName(sdStoneKey(2, 1)).subs.at(-1), SD_HALL_TEXT.lastBy('Oak'), 'the next hand in its place');
  hall.clear();
});

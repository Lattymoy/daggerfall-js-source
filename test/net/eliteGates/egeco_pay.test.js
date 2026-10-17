// EG-E (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE ECONOMY): WHAT A
// REDOUBT PAYS (net/eliteGates/egPay.js) - the one law the account service pays by and the client rolls its spoils by: the arena week
// (net/arena/arenaLaw.js arenaWeekOf), a Valkynaz's Redoubt every fifth and its two passes, the Panoply's odds on a stream of
// its own, the Legendary's share, the embers; and the week's Proclamation read off the arena's week.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaWeekOf, ARENA_WEEK_S, ARENA_SEASON_EPOCH_S, arenaSeasonOf } from '../../../src/net/arena/arenaLaw.js';
import { egValkRedoubt, egSpoilsPasses, egPanoplyIn, egLegendaryShare, egPanoplyHit, egPanoplyDraw, egPassSeed, egEmbersOf, EG_PANOPLY_PITY, EG_SINK_EMBERS, EG_PAY_MARKS, EG_PANOPLY_IDS } from '../../../src/net/eliteGates/egPay.js';
import { egBreachNew } from '../../../src/net/eliteGates/egBrain.js';
import { egProclamationOf } from '../../../src/net/eliteGates/egLaw.js';

test('EG-E THE ARENA WEEK (section 19): seven days from the season epoch, Monday to Monday, eight to a season, never before the epoch\'s first (mutants: a week a day short; a week off by one)', () => {
  const E = ARENA_SEASON_EPOCH_S;
  assert.equal(ARENA_WEEK_S, 604_800);
  assert.equal(arenaWeekOf(E), 0);
  assert.equal(arenaWeekOf(E + ARENA_WEEK_S - 1), 0);
  assert.equal(arenaWeekOf(E + ARENA_WEEK_S), 1);
  assert.equal(arenaWeekOf(E - 86_400), 0, 'nothing before the epoch is earlier than its first week');
  assert.equal(arenaWeekOf(E + 8 * ARENA_WEEK_S), 8);
  assert.equal(arenaSeasonOf(E + 8 * ARENA_WEEK_S), 2, 'the ninth week is the second season\'s first');
});

test('EG-E WHAT A REDOUBT PAYS (section 19): a Valkynaz every fifth Redoubt, its spoils twice; the Panoply 1 in 12 at Redoubt 1 to 1 in 4 from 16, 1 in 3 at a Valkynaz\'s, drawn on a stream of its own; the Legendary 20% to 65%; the embers 1 + floor(R/10) at a Valkynaz\'s and 1 for a first this season (mutants: the Valkynaz\'s odds the floor\'s; the Panoply on the spoils\' own stream; the first-this-season ember dropped)', () => {
  assert.deepEqual([1, 4, 5, 6, 10, 15, 20, 25].map(egValkRedoubt), [false, false, true, false, true, true, true, true]);
  assert.deepEqual([1, 5, 9, 10].map(egSpoilsPasses), [1, 2, 1, 2]);
  assert.deepEqual([1, 2, 3, 14, 16, 31, 5, 10, 15].map(egPanoplyIn), [12, 11, 11, 5, 4, 4, 3, 3, 3]);
  assert.equal(egLegendaryShare(1), 0.2);
  assert.ok(Math.abs(egLegendaryShare(16) - 0.65) < 1e-9);
  assert.equal(egLegendaryShare(40), 0.65);
  assert.deepEqual([[5, false], [10, false], [20, true], [3, true], [3, false], [9, false]].map(([w, f]) => egEmbersOf(w, f)), [1, 2, 4, 1, 0, 0]);
  assert.equal(egPassSeed(12345, 0), 12345, 'the first pass rolls on the receipt\'s own seed');
  assert.notEqual(egPassSeed(12345, 1), 12345);
  // the odds, over many seeds
  const rate = (w, pass) => { let n = 0; for (let s = 1; s <= 24_000; s++) if (egPanoplyHit(s * 2654435761 >>> 0, w, pass)) n++; return n / 24_000; };
  assert.ok(Math.abs(rate(1, 0) - 1 / 12) < 0.01, `1 in 12 at Redoubt 1 (${rate(1, 0)})`);
  assert.ok(Math.abs(rate(16, 0) - 1 / 4) < 0.015);
  assert.ok(Math.abs(rate(5, 1) - 1 / 3) < 0.015, 'a Valkynaz\'s second pass 1 in 3');
  // a stream of its own: the draw is not the seed's first mulberry draw (the spoils' gold)
  let same = 0;
  for (let s = 1; s < 500; s++) { let a = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); const first = ((t ^ (t >>> 14)) >>> 0) / 4294967296; if (first === egPanoplyDraw(s, 0)) same++; }
  assert.equal(same, 0);
  assert.equal(EG_PANOPLY_PITY, 10); assert.equal(EG_SINK_EMBERS, 20); assert.equal(EG_PAY_MARKS, 20);
  assert.equal(EG_PANOPLY_IDS.length, 9, 'nine pieces'); assert.equal(new Set(EG_PANOPLY_IDS).size, 9);
});

test('EG-E THE WEEK\'S PROCLAMATION (section 20): drawn by the arena\'s week of the breach\'s open - Monday to Monday from the season epoch, as the week\'s pay and the sink are (mutant: the old epoch-of-1970 weeks)', () => {
  const site = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
  for (const wk of [0, 1, 5, 9]) {
    const op = (ARENA_SEASON_EPOCH_S + wk * ARENA_WEEK_S + 3600) * 1000;
    const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op, co: [['acct-0', 'M0', 1]], site, wg: [] });
    assert.equal(B.pr, egProclamationOf(wk), `week ${wk}`);
  }
});

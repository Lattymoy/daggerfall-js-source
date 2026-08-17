// G2: arrest + court (SurrenderToCityGuards / DaggerfallCourtWindow
// verbatim math).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRIMES, REPUTATION_LOSS_PER_CRIME, lowerRepForCrime, legalRepOf,
  surrenderToCityGuards, startCourt, pleaGuilty, pleaNotGuilty,
  resolveGuiltyVerdict, raiseRepForSentence, goldAmount,
} from '../src/systems/court.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('court: rep loss, the surrender gates, and the coin flip', () => {
  const p = { health: 30, items: [], skills: 30, stats: { personality: 50 } };
  lowerRepForCrime(p, 17, CRIMES.Pickpocketing);
  assert.equal(legalRepOf(p, 17), -REPUTATION_LOSS_PER_CRIME[12]);   // -2
  // legalRep -2 (in -20..0): involuntary rides the DFRandom coin -
  // odd refuses, even accepts; voluntary always accepts.
  assert.equal(surrenderToCityGuards(p, 17, false, { dfRand: () => 1 }), false);
  assert.equal(p.health, 1, 'SetHealth(1) fires before the refusal');
  p.health = 30;
  assert.equal(surrenderToCityGuards(p, 17, false, { dfRand: () => 2 }), true);
  p.health = 30;
  assert.equal(surrenderToCityGuards(p, 17, true, { dfRand: () => 1 }), true);
  // legalRep < -20 refuses involuntary outright, accepts voluntary
  const q = { health: 30, legalRep: { 17: -30 }, items: [] };
  assert.equal(surrenderToCityGuards(q, 17, false, { dfRand: () => 0 }), false);
  assert.equal(surrenderToCityGuards(q, 17, true, { dfRand: () => 1 }), true);
  // dead players never surrender
  assert.equal(surrenderToCityGuards({ health: 0 }, 17, true, {}), false);
});

test('court: the verbatim penalty math and the guilty plea halving', () => {
  // Pickpocketing (crimeType 11): base 0xC8=200, perRep 6, min 5, max
  // 1000. legalRep -2 -> 200 + 12 = 212 -> /40 = 5 units. All coins
  // odd -> fine 200, 0 days; player has 100 gold -> fine capped 100,
  // days += (200-100)/40 = 2.
  const p = { health: 1, legalRep: { 17: -2 }, items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 100 }], skills: 30, stats: { personality: 50 } };
  const court = startCourt(p, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  assert.equal(court.punishmentType, 2, 'both FailedRolls at threshold <= 1 -> fine/prison');
  assert.equal(court.fine, 100);
  assert.equal(court.daysInPrison, 2);
  // Guilty: fine >>= 1 (50), days >>= 1 (1) -> prison, gold deducted
  const r = pleaGuilty(court, p);
  assert.deepEqual([r.outcome, r.days], ['prison', 1]);
  assert.equal(goldAmount(p), 50);
});

test('court: the not-guilty pleas - free, and the never-charged guilty-verdict quirk', () => {
  const mk = () => ({ health: 1, legalRep: { 17: 0 }, items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 500 }], skills: 60, stats: { personality: 60 } });
  // chance = 0 + (60+60)/2 = 60, clamp ok. Roll 10 < 60 -> FREE.
  const p1 = mk();
  const c1 = startCourt(p1, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  assert.equal(pleaNotGuilty(c1, p1, true, { rolls: seq(0.10) }).outcome, 'free');
  // Roll 99 fails -> guilty; the fine roll (rep 0 + 1..100): 0.10 ->
  // 11 < 25 -> fine x2; then the VERDICT NEVER CHARGES (the classic
  // quirk - DeductGoldAmount lives only in the guilty PLEA).
  const p2 = mk();
  const c2 = startCourt(p2, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  const fineBefore = c2.fine;
  const r2 = pleaNotGuilty(c2, p2, false, { rolls: seq(0.99, 0.10) });
  assert.equal(r2.outcome, 'guilty');
  assert.equal(c2.fine, fineBefore * 2);
  const v = resolveGuiltyVerdict(c2, p2);
  assert.equal(goldAmount(p2), 500, 'the failed defense never charges the fine');
  assert.ok(v.outcome === 'released' || v.outcome === 'prison');
  // Serving raises rep by half the loss - 1 (Pickpocketing: 2/2-1 = 0)
  const p3 = mk();
  raiseRepForSentence(p3, { crime: CRIMES.Pickpocketing, regionIndex: 17 });
  assert.equal(legalRepOf(p3, 17), 0);
  raiseRepForSentence(p3, { crime: CRIMES.Murder, regionIndex: 17 });   // 20/2-1 = +9
  assert.equal(legalRepOf(p3, 17), 9);
});

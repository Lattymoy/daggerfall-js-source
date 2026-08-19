// G2: arrest + court (SurrenderToCityGuards / DaggerfallCourtWindow
// verbatim math).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRIMES, REPUTATION_LOSS_PER_CRIME, lowerRepForCrime, legalRepOf,
  surrenderToCityGuards, startCourt, pleaGuilty, pleaNotGuilty,
  resolveGuiltyVerdict, raiseRepForSentence, goldAmount,
} from '../src/systems/court.js';
import { FactionFile } from '../src/formats/factionFile.js';
import { createFactionRep, getReputation } from '../src/systems/factionRep.js';
import { getPeopleOfCurrentRegion } from '../src/systems/talk.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

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


test('court: a crime also costs HALF the loss with the region People, propagating', { skip: skipReal }, () => {
  // PlayerEntity.cs:2294-2298. The legal rep and the FACTION rep are
  // two channels and a crime moves both; the port ran only the first
  // until the faction store existed.
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const store = createFactionRep(ff.factionDict);
  const p = { health: 30, items: [], skills: 30, stats: { personality: 50 }, factionRep: store };
  const people = getPeopleOfCurrentRegion(store.dict, 17);
  assert.ok(people, 'region 17 has a single People faction');

  lowerRepForCrime(p, 17, CRIMES.Murder);
  const loss = REPUTATION_LOSS_PER_CRIME[CRIMES.Murder];
  assert.equal(legalRepOf(p, 17), -loss, 'the legal channel takes the whole loss');
  assert.equal(getReputation(store, people.id), -Math.trunc(loss / 2),
    'the People faction takes HALF, negated OUTSIDE the truncating division');

  // AND IT REACHES THE COURT. This is the half that makes the
  // propagating flag matter: People of Daggerfall has no allies and no
  // children, so its OWN value is identical either way - a pin that
  // stopped at the People faction survived turning propagation off.
  // The walk goes UP: the region itself takes the full loss as a root
  // parent, and its ruler and guard take half.
  // Careful with "full": the amount handed to changeReputation is
  // ALREADY the halved crime delta, so the region takes that, and the
  // hierarchy below it takes half of THAT - not half of the raw loss.
  const delta = -Math.trunc(loss / 2);
  const region = store.dict.get(people.parent);
  assert.ok(region, 'the People faction hangs off its region');
  assert.equal(getReputation(store, region.id), delta,
    'the region is a root parent, so it takes the whole delta');
  const court = [...store.dict.values()].filter((f) => f.rep === Math.trunc(delta / 2));
  assert.ok(court.length >= 4,
    `the region's ruler, guard and nobles take half again (saw ${court.length})`);

  // an ODD loss is where the truncation shows: Trespassing is 5.
  const q = { factionRep: createFactionRep(ff.factionDict) };
  const odd = REPUTATION_LOSS_PER_CRIME[CRIMES.Trespassing];
  assert.equal(odd % 2, 1, 'Trespassing is an odd loss, which is the point of this case');
  lowerRepForCrime(q, 17, CRIMES.Trespassing);
  assert.equal(getReputation(q.factionRep, people.id), -Math.trunc(odd / 2),
    `an odd ${odd} costs ${Math.trunc(odd / 2)}, rounded toward the player - not ${Math.ceil(odd / 2)}`);
});

test('court: a crime without a faction store still runs the legal channel', () => {
  // Not every host has run chargen. The crime path must not throw.
  const p = {};
  lowerRepForCrime(p, 17, CRIMES.Murder);
  assert.equal(legalRepOf(p, 17), -REPUTATION_LOSS_PER_CRIME[CRIMES.Murder]);
});

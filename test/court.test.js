// G2: arrest + court (SurrenderToCityGuards / DaggerfallCourtWindow
// verbatim math).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRIMES, REPUTATION_LOSS_PER_CRIME, lowerRepForCrime, legalRepOf,
  surrenderToCityGuards, startCourt, pleaGuilty, pleaNotGuilty,
  resolveGuiltyVerdict, raiseRepForSentence, goldAmount,
  clampLegalReputations, normalizeReputations, LEGAL_REP_MIN, LEGAL_REP_MAX,
} from '../src/systems/court.js';
import { FactionFile } from '../src/formats/factionFile.js';
import { createFactionRep, getReputation, setReputation } from '../src/systems/factionRep.js';
import { getPeopleOfCurrentRegion } from '../src/systems/talk.js';
import { changeReputation } from '../src/systems/factionRep.js';
import { snapshotFactionRep, restoreFactionRep } from '../src/systems/save.js';
import { GUILDS, joinGuild } from '../src/systems/guilds.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const realFactions = () => {
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  return ff.factionDict;
};

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


test('save: AUDIT 20 - the faction store and guild memberships ride the envelope', { skip: skipReal }, () => {
  // THE THIRD REPUTATION CHANNEL. sGroupReputations and legalRep have
  // ridden the envelope for a while; S25's per-faction reputation did
  // not, so every backstory `rf` answer and every crime's People delta
  // was lost on load - and guild rank, computed from it, reset too.
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const entity = { stats: {}, skills: 30, skillUses: [], items: [], spells: [] };
  entity.factionRep = createFactionRep(ff.factionDict);
  entity.guildMemberships = {};
  changeReputation(entity.factionRep, GUILDS.ThievesGuild.factionId, 25, true);
  joinGuild(entity.guildMemberships, GUILDS.FightersGuild, { year: 405, dayOfYear: 3 });

  const snap = snapshotFactionRep(entity.factionRep);
  assert.equal(snap.ids.length, ff.factionDict.size, 'every faction travels');

  // a LOAD rebuilds the store from FACTION.TXT, then writes the save in
  const loaded = { factionRep: createFactionRep(ff.factionDict) };
  assert.equal(getReputation(loaded.factionRep, GUILDS.ThievesGuild.factionId), 0, 'fresh from the file');
  restoreFactionRep(loaded.factionRep, snap);
  for (const id of snap.ids) {
    assert.equal(getReputation(loaded.factionRep, id), getReputation(entity.factionRep, id),
      `faction ${id} survived the round trip`);
  }
  // a save from BEFORE this field leaves the fresh values standing
  const older = { factionRep: createFactionRep(ff.factionDict) };
  assert.equal(restoreFactionRep(older.factionRep, undefined), false);
  assert.equal(getReputation(older.factionRep, GUILDS.ThievesGuild.factionId), 0);
});

// ---------------------------------------------------------------------------
// AUDIT 21: the two halves of the reputation economy the port was missing.
// ---------------------------------------------------------------------------

test('AUDIT 21 F1: doing the sentence refunds BOTH channels, not just legal', { skip: skipReal }, () => {
  // RaiseReputationForDoingSentence (PlayerEntity.cs:2301-2311) credits
  // legalRep by `half - 1` AND the region's People faction by
  // `(half - 1) / 2`. The port credited only the legal half while
  // lowerRepForCrime debited both, which made the faction channel a
  // RATCHET - a player who always served their time still slid to the
  // bottom with the People.
  const dict = realFactions();
  const store = createFactionRep(dict);
  const player = { factionRep: store, legalRep: {} };
  const region = 17;
  const peopleRep = () => {
    for (const v of store.dict.values()) if (v.type === 15 && v.region === region) return v.rep;
    return null;
  };

  const crime = 5;                       // loss 20 -> half 10
  const start = peopleRep();
  lowerRepForCrime(player, region, crime);
  const afterCrime = peopleRep();
  raiseRepForSentence(player, { crime, regionIndex: region });
  const afterSentence = peopleRep();

  assert.equal(afterCrime, start - 10, 'the crime costs the People half the legal loss');
  assert.equal(afterSentence, afterCrime + 4, 'and the sentence refunds (half - 1) / 2');
  // The legal channel too, so a fix to one side cannot hide the other.
  assert.equal(player.legalRep[region], -20 + 9);
});

test('AUDIT 21 F3: legal reputation is CLAMPED, and drifts back over time', () => {
  assert.equal(LEGAL_REP_MIN, -100);
  assert.equal(LEGAL_REP_MAX, 100);

  // ClampLegalReputations (:2245-2257). The port had no clamp at all, so
  // twelve High Treasons drove a region to -900 - a value DFU cannot hold.
  const p = { legalRep: { 1: -900, 2: 250, 3: 0, 4: -4, 5: 100, 6: -100 } };
  clampLegalReputations(p);
  assert.deepEqual(p.legalRep, { 1: -100, 2: 100, 3: 0, 4: -4, 5: 100, 6: -100 },
    'out-of-range values clamp; in-range values are untouched');

  // NormalizeReputations (:2223-2243) then walks every value ONE POINT
  // toward zero, and zero stays zero. This is the only thing that ever
  // forgives a crime the player did not answer for.
  normalizeReputations(p, null);
  assert.deepEqual(p.legalRep, { 1: -99, 2: 99, 3: 0, 4: -3, 5: 99, 6: -99 });

  // And it clamps FIRST, so an out-of-range value lands inside the bounds
  // in a single pass rather than creeping back over many.
  const q = { legalRep: { 1: -900 } };
  normalizeReputations(q, null);
  assert.equal(q.legalRep[1], -99, 'clamp then drift, in that order');
});

test('AUDIT 21 F3: normalize drifts FACTION reputations too, through the walk', { skip: skipReal }, () => {
  const dict = realFactions();
  const store = createFactionRep(dict);
  const player = { legalRep: {} };

  // Push one faction off zero, then normalize and confirm it moved back.
  // The faction side goes through changeReputation, so unlike the legal
  // side it PROPAGATES - that asymmetry is DFU's, not an accident.
  const id = [...store.dict.keys()][0];
  setReputation(store, id, 20);
  assert.equal(store.dict.get(id).rep, 20);
  normalizeReputations(player, store);
  assert.equal(store.dict.get(id).rep, 19, 'a positive faction rep drifts down');

  setReputation(store, id, -20);
  normalizeReputations(player, store);
  assert.equal(store.dict.get(id).rep, -19, 'and a negative one drifts up');
});

test('AUDIT 21 F5: the second court roll is SHORT-CIRCUITED, as C# does', () => {
  // DaggerfallCourtWindow.cs:136 -
  //   if (Dice100.FailedRoll(threshold2) && Dice100.FailedRoll(threshold1))
  // C#'s `&&` short-circuits, so the second roll is drawn ONLY when the
  // first fails. Drawing both unconditionally burned an extra number from
  // the generator on every court appearance, shifting every later roll in
  // the session - a port can be right expression by expression and still
  // desync the stream.
  const player = { legalRep: { 17: -100 } };   // both thresholds at their 75 cap

  let drawn = 0;
  const counting = (v) => () => { drawn++; return v; };

  // First roll FAILS (0.99 -> 99 >= threshold): the second is needed.
  drawn = 0;
  startCourt(player, 17, 5, { rolls: counting(0.99) });
  assert.equal(drawn, 2, 'a failed first roll draws the second');

  // First roll PASSES (0.0 -> 0 < threshold): the second must NOT be drawn.
  drawn = 0;
  startCourt(player, 17, 5, { rolls: counting(0.0) });
  assert.equal(drawn, 1, 'a passed first roll short-circuits - no second draw');

  // And the outcome is still right in both cases.
  assert.equal(startCourt(player, 17, 5, { rolls: () => 0.99 }).punishmentType, 2);
  assert.equal(startCourt(player, 17, 5, { rolls: () => 0.0 }).punishmentType, 0);
});

test('AUDIT 21 F6: a court with NO crime closes immediately', () => {
  // HandleCourtLogic's first statement, on every state (:109-114). Without
  // it `crime - 1` is -1, the penalty tables index undefined, the fine is
  // NaN, and the player is tried for nothing - then charged a point of
  // legal reputation for serving the sentence.
  assert.equal(startCourt({ legalRep: {} }, 17, 0, { rolls: () => 0.5 }), null,
    'crime None yields no court at all');

  // A real crime still opens one, so the guard cannot be a blanket refusal.
  const real = startCourt({ legalRep: {} }, 17, 5, { rolls: () => 0.5 });
  assert.ok(real, 'a real crime opens a court');
  assert.ok(Number.isFinite(real.fine), 'with a finite fine');
  assert.ok(Number.isFinite(real.daysInPrison));
});

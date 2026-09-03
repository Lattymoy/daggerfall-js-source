// G2: arrest + court (SurrenderToCityGuards / DaggerfallCourtWindow
// verbatim math).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRIMES, REPUTATION_LOSS_PER_CRIME, lowerRepForCrime, legalRepOf,
  surrenderToCityGuards, startCourt, pleaGuilty, pleaNotGuilty,
  resolveGuiltyVerdict, raiseRepForSentence, goldAmount,
  clampLegalReputations, normalizeReputations, LEGAL_REP_MIN, LEGAL_REP_MAX,
  PENALTY_PER_LEGAL_REP_POINT, BASE_PENALTY, MIN_PENALTY, MAX_PENALTY,
} from '../src/systems/court.js';
import {
  FactionFile, FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS,
} from '../src/formats/factionFile.js';
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

// TEST THE SHAPE THE PRODUCER MINTS. The two reputation-economy pins
// below need a People faction in a known region and nothing else from
// the corpus, so on CI (ARENA2_PATH unset) they run on a synthetic dict
// carrying exactly the field set FactionFile mints - never a thinner
// one, which would let a pin describe a record the game never produces.
const FIELDS = ['id', 'parent', 'type', 'name', 'rep', 'summon', 'region', 'power', 'flags',
  'ruler', 'ally1', 'ally2', 'ally3', 'enemy1', 'enemy2', 'enemy3', 'face', 'race',
  'flat1', 'flat2', 'sgroup', 'ggroup', 'minf', 'maxf', 'vam', 'rank',
  'rulerNameSeed', 'rulerPowerBonus', 'children'];
const PEOPLE_REGION = 17;
const fac = (o) => {
  const base = {};
  for (const k of FIELDS) base[k] = (k === 'name' ? 'f' + o.id : k === 'children' ? null : 0);
  return Object.assign(base, o);
};

/** The real corpus where it is available, an equivalent synthetic dict
 *  where it is not - PEOPLE_TYPE 15 in region 17, the region every pin
 *  here names. */
const factionsForRep = () => (skipReal
  ? new Map([[100, fac({
    id: 100,
    // getPeopleOfCurrentRegion (talk.js:45-54) matches on FOUR columns
    // and requires EXACTLY ONE hit, so a record short of any of them is
    // silently no People faction at all - which is how a thinner
    // fixture would have made these pins vacuous.
    type: FACTION_TYPES.People,
    sgroup: SOCIAL_GROUPS.Commoners,
    ggroup: GUILD_GROUPS.GeneralPopulace,
    region: PEOPLE_REGION,
  })]])
  : realFactions());

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
  const p = { health: 1, legalRep: { 17: -2 }, goldPieces: 100, items: [], skills: 30, stats: { personality: 50 } };
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
  const mk = () => ({ health: 1, legalRep: { 17: 0 }, goldPieces: 500, items: [], skills: 60, stats: { personality: 60 } });
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
  // AUDIT 21 F11 (M-I): this assertion used to be VACUOUS BY CONSTRUCTION -
  // resolveGuiltyVerdict has no third return, so `released || prison` is a
  // tautology, and deleting its raiseRepForSentence call (the DFU line at
  // :246-247 that arrestFlow's own comment calls the state-2 release) killed
  // nothing. Pin the outcome AND what it did to the reputation.
  const repBefore = legalRepOf(p2, 17);
  assert.equal(v.outcome, c2.daysInPrison > 0 ? 'prison' : 'released');
  if (v.outcome === 'released') {
    // Pickpocketing: half(2) - 1 = 0 on the legal channel, so the credit is
    // visible in the FACTION channel; assert the call happened at all by
    // running the same verdict on a crime whose credit is non-zero.
    const p4 = mk();
    const c4 = startCourt(p4, 17, CRIMES.Murder, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
    c4.daysInPrison = 0;
    assert.equal(resolveGuiltyVerdict(c4, p4).outcome, 'released');
    assert.equal(legalRepOf(p4, 17), 9, 'the state-2 release CREDITS the sentence: half(20) - 1');
  } else {
    assert.equal(legalRepOf(p2, 17), repBefore, 'the prison arm credits later, from the flow');
  }
  // AND THE SAME LINE IN pleaGuilty. The two zero-day arms - the guilty PLEA
  // (DaggerfallCourtWindow.cs:340-348) and the state-2 verdict (:246-247) -
  // are three IDENTICAL lines in this port, and a mutation aimed at one of
  // them silently landed on the other and killed nothing. Pin both.
  const p5 = { health: 1, legalRep: { 17: 0 }, skills: 60, stats: { personality: 60 },
    goldPieces: 100000, items: [] };
  const c5 = { punishmentType: 2, fine: 0, daysInPrison: 0, crime: CRIMES.Murder, regionIndex: 17 };
  assert.equal(pleaGuilty(c5, p5).outcome, 'released');
  assert.equal(legalRepOf(p5, 17), 9, 'the zero-day guilty PLEA credits the sentence too');

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
  const dict = factionsForRep();
  const store = createFactionRep(dict);
  const player = { factionRep: store, legalRep: {} };
  const region = PEOPLE_REGION;
  const peopleRep = () => {
    const p = getPeopleOfCurrentRegion(store.dict, region);
    if (p) return store.dict.get(p.id).rep;
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

test('AUDIT 21 F3: normalize drifts FACTION reputations too, through the walk', () => {
  const dict = factionsForRep();
  const store = createFactionRep(dict);
  const player = { legalRep: {} };

  // Push one faction off zero, then normalize and confirm it moved back.
  // AUDIT 54: this comment used to say the faction side PROPAGATES. It
  // does not - PlayerEntity.cs:2239/:2241 calls the TWO-argument
  // ChangeReputation and PersistentFactionData.cs:390 defaults propagate
  // to false, which is what court.js:175-179 records AUDIT 23 as having
  // corrected. The ONLY asymmetry is direct increment (legal) vs clamped
  // ChangeReputation (faction); neither side fans out. The pin that can
  // actually see the flag needs a hierarchy this one-record fixture does
  // not have, and lives in test/audit54_pins.test.js.
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

// ===========================================================================
// AUDIT 21 F9 + F11: THE TABLES AND THE CLAMPS.
//
// The lane's measurement: of the 76 cells in the five penalty tables, 56 were
// unreachable by any pin. REPUTATION_LOSS_PER_CRIME was exercised at four of
// its sixteen indices; the other four tables only ever at crimeType 11.
// Setting every unexercised entry to 0x63 left ten test files at 110 pass / 0
// fail. Four more constants survived their own mutations.
//
// These literals are transcribed from the C# arrays, not from the port:
// DaggerfallCourtWindow.cs:60-63 and PlayerEntity.cs:2284.
// ===========================================================================

test('AUDIT 21 F9: all 76 penalty-table cells, not the 20 a pin happened to reach', () => {
  // PlayerEntity.cs:2284. Index 0 is Crimes.None; DFU's comment notes the
  // last entry ("Treason") has no valid FALL.EXE value and uses half of High
  // Treason - 0x24 -> 0x0A - which is a QUIRK to preserve, not a typo.
  assert.deepEqual([...REPUTATION_LOSS_PER_CRIME],
    [0x00, 0x0A, 0x05, 0x0A, 0x08, 0x14, 0x0A, 0x02, 0x01, 0x02, 0x02, 0x4B, 0x02, 0x08, 0x24, 0x0A]);

  // DaggerfallCourtWindow.cs:60-63, all four indexed by `crime - 1`. DFU's
  // header comment: "Vanilla unused crime values adjusted below by adding
  // reasonable values for any zeros and a column for loan default crime."
  assert.deepEqual([...PENALTY_PER_LEGAL_REP_POINT],
    [0x05, 0x05, 0x06, 0x06, 0x0A, 0x05, 0x05, 0x03, 0x08, 0x08, 0x09, 0x06, 0x00, 0x08, 0x00]);
  assert.deepEqual([...BASE_PENALTY],
    [0x12C, 0xC8, 0x258, 0x3E8, 0x2710, 0xC8, 0x1F4, 0x64, 0x1F4, 0x1F4, 0x4B0, 0xC8, 0xC8, 0x3E8, 0x64]);
  assert.deepEqual([...MIN_PENALTY],
    [0x32, 0x0A, 0x50, 0x0A, 0x2328, 0x0A, 0x0A, 0x02, 0x0A, 0x0A, 0xA0, 0x05, 0x05, 0x0A, 0x04]);
  assert.deepEqual([...MAX_PENALTY],
    [0x3E8, 0x320, 0x4B0, 0x5DC, 0x2EE0, 0x2EE0, 0x5DC, 0x2BC, 0x5DC, 0x5DC, 0x7D0, 0x3E8, 0x3E8, 0x5DC, 0x2BC]);

  // 16 crimes but 15 penalty columns: the penalty tables are indexed by
  // `crime - 1`, so Crimes.None has a reputation loss and no penalty row.
  assert.equal(REPUTATION_LOSS_PER_CRIME.length, 16);
  for (const t of [PENALTY_PER_LEGAL_REP_POINT, BASE_PENALTY, MIN_PENALTY, MAX_PENALTY]) {
    assert.equal(t.length, 15);
  }
});

test('AUDIT 21 F11: the court clamps, at both ends', () => {
  const mk = (rep) => ({ health: 1, legalRep: { 17: rep }, skills: 60, stats: { personality: 60 },
    goldPieces: 100000, items: [] });

  // MUTATION D: Math.min(75, ...) -> Math.min(750, ...) survived, because no
  // pin ever used a legalRep beyond -150 where the cap actually bites.
  // DaggerfallCourtWindow.cs:130-134:
  //     threshold1 = Math.Min(75, -legalRep);
  //     threshold2 = Math.Min(75, -legalRep / 2);
  // At legalRep -200 both thresholds are 75. FailedRoll(t) is `roll >= t`,
  // so a roll of 74 PASSES both and the sentence is banishment (type 0);
  // without the cap threshold2 would be 100 and 74 would fail it.
  const deep = mk(-200);
  assert.equal(startCourt(deep, 17, CRIMES.Pickpocketing,
    { rolls: seq(0.74), dfRand: () => 1 }).punishmentType, 0,
  'a roll of 74 clears both capped thresholds');
  assert.equal(startCourt(mk(-200), 17, CRIMES.Pickpocketing,
    { rolls: seq(0.75, 0.75), dfRand: () => 1 }).punishmentType, 2,
  'and a roll of 75 fails both, exactly at the cap');

  // MUTATION E: max(5, min(95, chance)) -> max(0, min(100, chance)) survived.
  // DaggerfallCourtWindow.cs:388-391. A hopeless defendant still has a 5%
  // chance and a perfect one still has a 5% risk.
  //   chance = legalRep + (skill + personality) / 2 = -200 + 60 = -140 -> 5
  const hopeless = mk(-200);
  const cH = startCourt(hopeless, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  assert.equal(pleaNotGuilty(cH, hopeless, true, { rolls: seq(0.04) }).outcome, 'free',
    'roll 4 < the FLOOR of 5 - a hopeless case still walks sometimes');
  const hopeless2 = mk(-200);
  const cH2 = startCourt(hopeless2, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  assert.notEqual(pleaNotGuilty(cH2, hopeless2, true, { rolls: seq(0.05, 0.50) }).outcome, 'free',
    'and roll 5 does not');
  //   chance = 200 + 60 = 260 -> 95
  const certain = mk(200);
  const cC = startCourt(certain, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  assert.notEqual(pleaNotGuilty(cC, certain, true, { rolls: seq(0.95, 0.50) }).outcome, 'free',
    'roll 95 >= the CEILING of 95 - a certain case still loses sometimes');

  // MUTATION F: deleting `else if (roll > 75) court.fine >>= 1;` survived.
  // DaggerfallCourtWindow.cs:407-408 - the fine roll has THREE arms.
  const p = mk(0);
  const c = startCourt(p, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  const before = c.fine;
  assert.ok(before > 0, 'the fixture must actually carry a fine');
  //   roll = legalRep 0 + (90 + 1) = 91 > 75 -> halved
  assert.equal(pleaNotGuilty(c, p, false, { rolls: seq(0.99, 0.90) }).outcome, 'guilty');
  assert.equal(c.fine, before >> 1, 'roll 91 > 75 HALVES the fine');
  // and the untouched middle band, 25..75
  const p2 = mk(0);
  const c2 = startCourt(p2, 17, CRIMES.Pickpocketing, { rolls: seq(0.99, 0.99), dfRand: () => 1 });
  const before2 = c2.fine;
  pleaNotGuilty(c2, p2, false, { rolls: seq(0.99, 0.50) });   // roll 51
  assert.equal(c2.fine, before2, 'the middle band leaves the fine alone');
});

test('AUDIT 21 F7: the Execution arm exists on both plea paths', () => {
  // DaggerfallCourtWindow.cs:327-331 and :394-402 both cascade THREE ways.
  // startCourt cannot mint a 1 - which is DFU's own note at :279 - so this
  // constructs the court directly. An arm that is absent and an arm that is
  // WRONG read the same from the call site; only one is safe to build on.
  const p = () => ({ health: 1, legalRep: { 17: 0 }, skills: 60, stats: { personality: 60 },
    goldPieces: 500, items: [] });
  const court = () => ({ punishmentType: 1, fine: 200, daysInPrison: 9, crime: CRIMES.Murder, regionIndex: 17 });

  const pg = p(), cg = court();
  assert.equal(pleaGuilty(cg, pg).outcome, 'executed');
  assert.equal(cg.fine, 200, 'execution does not halve the fine');
  assert.equal(cg.daysInPrison, 9, 'nor the sentence');
  assert.equal(goldAmount(pg), 500, 'nor charge it');

  const pn = p(), cn = court();
  assert.equal(pleaNotGuilty(cn, pn, true, { rolls: seq(0.99) }).outcome, 'executed');
  assert.equal(cn.fine, 200, 'and the failed-defense fine roll never runs');

  // punishmentType 0 is still banishment on both paths, and 2 still is not
  assert.equal(pleaGuilty({ ...court(), punishmentType: 0 }, p()).outcome, 'banished');
  assert.equal(pleaNotGuilty({ ...court(), punishmentType: 0 }, p(), true, { rolls: seq(0.99) }).outcome, 'banished');
  assert.equal(pleaGuilty({ ...court(), punishmentType: 2 }, p()).outcome, 'prison');
});

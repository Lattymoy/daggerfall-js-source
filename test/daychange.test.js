// S41 - THE DAY CHANGE (PlayerEntity.Update :441-450).
//
// Four members run when the game DATE moves, and the port ran ONE of
// them. Three had been ported as laws and then never called on a day
// boundary by anybody; the fourth - the regional price drift - was
// not ported at all. These pins hold each member to its C# and, just
// as importantly, hold the WIRING: the day block is reached from
// tickPlayerMinutes, which every host drives, so no host can forget a
// line of it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDayChange, tickPlayerMinutes, CLASSIC_MINUTES_PER_SECOND, MINUTES_PER_DAY,
  worldMinutes, setWorldMinutes,
} from '../src/systems/worldTick.js';
import {
  updateRegionalPrices, regionPriceAdjustment, REGION_COUNT,
  PRICE_ADJUSTMENT_MIN, PRICE_ADJUSTMENT_MAX,
} from '../src/systems/shopStock.js';
import {
  createBankAccounts, borrowLoan, MINUTES_PER_MONTH, LOAN_REPAY_MINUTES,
  hasDefaulted, loanedTotal, accountTotal,
} from '../src/systems/banking.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { currentWeather, resetWeatherSim, tickWeather, setWeather } from '../src/systems/weatherSim.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { createSceneCache, addPermanentScene, containsPermanentScene, interiorSceneName } from '../src/systems/sceneCache.js';
import { REPUTATION_LOSS_PER_CRIME, CRIMES, legalRepOf, NORMALIZE_INTERVAL_MINUTES } from '../src/systems/court.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

// A SYNTHETIC faction dictionary. UpdateRegionalPrices reads exactly
// two things out of the store - The Merchants' power, and the power
// of each region's type-7 (Province) faction - so the corpus is not
// needed to pin the walk, and these run on a machine with no ARENA2.
function dict({ merchantsPower = 50, provincePower = 50, regions = [0], merchants = true } = {}) {
  const d = new Map();
  if (merchants) d.set(MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: merchantsPower });
  for (const r of regions) {
    d.set(9000 + r, { id: 9000 + r, type: FACTION_TYPES.Province, region: r, power: provincePower });
  }
  return d;
}
const player = (over = {}) => ({ regionPrices: {}, ...over });

// ── UpdateRegionalPrices (FormulaHelper.cs:2053-2089) ──────────────

test('S41 prices: the drift moves 49/50ths down on a FAILED roll and 51/50ths up on a passed one', () => {
  //   chance = (merchantsPower - regionPower)/5 + 50 - (adj - 1000)/25
  // At equal power and a neutral 1000 adjustment that is exactly 50.
  const d = dict({ merchantsPower: 50, provincePower: 50 });

  const down = player({ regionPrices: { 0: 1000 } });
  updateRegionalPrices(down, d, 1, () => 0.99);            // 99 < 50 false -> FailedRoll
  assert.equal(down.regionPrices[0], 980, '49 * 1000 / 50');

  const up = player({ regionPrices: { 0: 1000 } });
  updateRegionalPrices(up, d, 1, () => 0.0);               // 0 < 50 -> passed
  assert.equal(up.regionPrices[0], 1020, '51 * 1000 / 50');
});

test('S41 prices: BOTH divisions truncate toward zero, and Math.floor is wrong in both', () => {
  // The power term. merchants 10 vs province 42 is -32/5 = -6.4:
  // C# int division gives -6, Math.floor would give -7, so the
  // chance is 44 rather than 43 - and a roll of exactly 43 tells
  // them apart.
  const dPower = dict({ merchantsPower: 10, provincePower: 42 });
  const p1 = player({ regionPrices: { 0: 1000 } });
  updateRegionalPrices(p1, dPower, 1, () => 0.435);        // Math.floor(43.5) = 43
  assert.equal(p1.regionPrices[0], 1020, '43 < 44 passes: trunc(-6). Math.floor(-6.4) = -7 would make it 43 and FAIL');

  // The adjustment term. 990 is (990-1000)/25 = -0.4: C# gives 0,
  // Math.floor would give -1, so the chance is 50 rather than 51 -
  // and a roll of exactly 50 tells them apart.
  const dAdj = dict({ merchantsPower: 50, provincePower: 50 });
  const p2 = player({ regionPrices: { 0: 990 } });
  updateRegionalPrices(p2, dAdj, 1, () => 0.50);           // Math.floor(50) = 50
  assert.equal(p2.regionPrices[0], 970, '50 < 50 fails: trunc(-0.4) = 0. Math.floor would give 51 and RISE to 1009');
});

test('S41 prices: the walk is MEAN-REVERTING - the ceiling can only fall and the floor is clamped', () => {
  const d = dict({ merchantsPower: 50, provincePower: 50 });
  // At the 4000 ceiling the chance is 0 + 50 - 120 = -70, and
  // dice100 can never beat a negative chance: a maxed-out region
  // falls on EVERY step, whatever the dice.
  const high = player({ regionPrices: { 0: PRICE_ADJUSTMENT_MAX } });
  updateRegionalPrices(high, d, 1, () => 0.0);
  assert.equal(high.regionPrices[0], 3920, 'even the luckiest roll falls at the ceiling');

  // At the 250 floor the chance is 0 + 50 + 30 = 80, so it usually
  // rises - but a rare failure is CLAMPED rather than dropping to
  // 245 (Mathf.Clamp(..., 250, 4000)).
  const low = player({ regionPrices: { 0: PRICE_ADJUSTMENT_MIN } });
  updateRegionalPrices(low, d, 1, () => 0.90);             // 90 < 80 false -> falls to 245
  assert.equal(low.regionPrices[0], PRICE_ADJUSTMENT_MIN, 'clamped, not 245');
});

test('S41 prices: `times` is daysPast, and the steps COMPOUND off each new adjustment', () => {
  const d = dict({ merchantsPower: 50, provincePower: 50 });
  const p = player({ regionPrices: { 0: 1000 } });
  updateRegionalPrices(p, d, 3, () => 0.99);               // three failed rolls
  // 1000 -> 980 -> 960 -> 940 (each 49/50 of the PREVIOUS value,
  // truncated: 49*980/50 = 960.4 -> 960; 49*960/50 = 940.8 -> 940)
  assert.equal(p.regionPrices[0], 940);
  // A single step of a three-day jump would leave 980, and three
  // steps off the ORIGINAL would leave 980 as well - only the
  // compounding walk lands on 940.
});

test('S41 prices: a missing Merchants faction stops the WHOLE walk, and a region with no Province is skipped', () => {
  // `if (!GetFactionData(The_Merchants, out ...)) return;` - the
  // return is from the function, not the region loop.
  const noMerchants = player({ regionPrices: { 0: 1000, 1: 1000 } });
  updateRegionalPrices(noMerchants, dict({ merchants: false, regions: [0, 1] }), 5, () => 0.99);
  assert.deepEqual(noMerchants.regionPrices, { 0: 1000, 1: 1000 }, 'not one region moved');

  // Region 1 has a Province faction; region 0 does not, so
  // FindFactionByTypeAndRegion misses and the region is skipped.
  const p = player({ regionPrices: { 0: 1000, 1: 1000 } });
  updateRegionalPrices(p, dict({ regions: [1] }), 1, () => 0.99);
  assert.equal(p.regionPrices[0], 1000, 'no Province faction, no drift');
  assert.equal(p.regionPrices[1], 980);
});

test('S41 prices: FindFactionByTypeAndRegion\'s region -1 FALLBACK carries the walk', () => {
  // PersistentFactionData.FindFactionByTypeAndRegion answers a
  // region-less faction of the right type when no exact match
  // exists - so a Province entry with region -1 drifts EVERY region
  // rather than none. That is DFU's law, and it is the difference
  // between a live economy and a dead one on a partial dictionary.
  const d = dict({ regions: [] });
  d.set(8000, { id: 8000, type: FACTION_TYPES.Province, region: -1, power: 50 });
  const p = player({ regionPrices: { 0: 1000, 7: 1000 } });
  updateRegionalPrices(p, d, 1, () => 0.99);
  assert.equal(p.regionPrices[0], 980);
  assert.equal(p.regionPrices[7], 980);
});

test('S41 prices: the walk covers all 62 of PlayerEntity.regionData, materialising what the shops never touched', () => {
  assert.equal(REGION_COUNT, 62, 'new RegionDataRecord[62] (PlayerEntity.cs:99)');
  const p = player();                                       // nothing initialised at all
  const regions = Array.from({ length: REGION_COUNT }, (_, i) => i);
  updateRegionalPrices(p, dict({ regions }), 1, () => 0.99);
  assert.equal(Object.keys(p.regionPrices).length, REGION_COUNT);
  // Each untouched region is MATERIALISED through the lazy
  // RandomizeInitialRegionalPrices roll and drifts off THAT, not off
  // a neutral 1000: 750 + floor(0.99 * 501) = 1245, whose chance is
  // 0 + 50 - trunc(245/25) = 41, which a 0.99 roll fails ->
  // trunc(49 * 1245 / 50) = 1220.
  for (let i = 0; i < REGION_COUNT; i++) {
    assert.equal(p.regionPrices[i], 1220, `region ${i} drifted off its own initial roll, not off 1000`);
    assert.ok(p.regionPrices[i] >= PRICE_ADJUSTMENT_MIN && p.regionPrices[i] <= PRICE_ADJUSTMENT_MAX, `region ${i}`);
  }
  // and the lazy initialiser still answers the same store
  assert.equal(regionPriceAdjustment(p, 3), p.regionPrices[3]);
});

// ── the day gate ───────────────────────────────────────────────────

test('S41 gate: `daysPast > 0` - the same day does nothing, and a clock that moved BACKWARD does nothing', () => {
  const d = dict();
  const base = () => ({ regionPrices: { 0: 1000 }, factionRep: { dict: d } });

  // The price walk is a no-op at times = 0 all by itself, so an
  // unmoved price cannot tell `daysPast > 0` from `>= 0`. The ROOM
  // SWEEP can: it takes no day count, so a gate that let the same day
  // through would evict a tenant mid-afternoon on the day they
  // stopped paying rather than at the next date change.
  const same = base();
  same.rentedRooms = [{ mapId: 1, buildingKey: 10, expiryMinutes: 200 }];
  let r = runDayChange({ entity: same, lastMinutes: 100, nowMinutes: 1400, rolls: () => 0.99 });
  assert.equal(r.daysPast, 0);
  assert.equal(same.regionPrices[0], 1000, 'same classic day - nothing ran');
  assert.equal(same.rentedRooms.length, 1, 'and the sweep did not run either');

  const back = base();
  back.rentedRooms = [{ mapId: 1, buildingKey: 10, expiryMinutes: MINUTES_PER_DAY }];
  r = runDayChange({ entity: back, lastMinutes: 5 * MINUTES_PER_DAY, nowMinutes: 2 * MINUTES_PER_DAY, rolls: () => 0.99 });
  assert.equal(r.daysPast, 0);
  assert.equal(back.regionPrices[0], 1000, 'a rewound clock is a load, not three days');
  assert.equal(back.rentedRooms.length, 1);

  // ...and one minute over the boundary is a full day
  const over = base();
  r = runDayChange({ entity: over, lastMinutes: MINUTES_PER_DAY - 1, nowMinutes: MINUTES_PER_DAY, rolls: () => 0.99 });
  assert.equal(r.daysPast, 1);
  assert.equal(over.regionPrices[0], 980);
});

test('S41 gate: daysPast is the DAY difference, and it is handed to the price walk as `times`', () => {
  const e = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() } };
  const r = runDayChange({ entity: e, lastMinutes: 0, nowMinutes: 3 * MINUTES_PER_DAY, rolls: () => 0.99 });
  assert.equal(r.daysPast, 3);
  assert.equal(e.regionPrices[0], 940, 'three compounding steps, not one');
});

// ── RemoveExpiredRentedRooms (PlayerEntity.cs:449) ──────────────────

test('S41 rooms: the day change sweeps expired rentals and RELEASES their permanent scene', () => {
  // This is the member the rest merge found missing in all three
  // lanes: the sweep ran when a tavern window opened and when a rest
  // ENDED on an expired room, so a rental that ran out while the
  // player was asleep in a dungeon was never collected.
  const cache = createSceneCache();
  const live = { mapId: 1, buildingKey: 10, expiryMinutes: 4 * MINUTES_PER_DAY };
  const dead = { mapId: 1, buildingKey: 11, expiryMinutes: 2 * MINUTES_PER_DAY };
  addPermanentScene(cache, interiorSceneName(live.mapId, live.buildingKey));
  addPermanentScene(cache, interiorSceneName(dead.mapId, dead.buildingKey));

  const e = { rentedRooms: [live, dead], sceneCache: cache, factionRep: { dict: dict() }, regionPrices: {} };
  runDayChange({ entity: e, lastMinutes: 2 * MINUTES_PER_DAY - 1, nowMinutes: 3 * MINUTES_PER_DAY, rolls: () => 0.5 });

  assert.deepEqual(e.rentedRooms.map((r) => r.buildingKey), [10], 'only the expired room went');
  assert.equal(containsPermanentScene(cache, interiorSceneName(1, 10)), true, 'the live rental still holds its interior');
  assert.equal(containsPermanentScene(cache, interiorSceneName(1, 11)), false, 'the landlord cleared the expired one');
});

test('S41 rooms: the sweep uses the CEILING, so a rental with minutes left survives the boundary', () => {
  // roomRemainingHours is Math.ceil, so `< 1` is true only when no
  // time at all is left. A day change one minute before expiry must
  // not evict a paying tenant.
  const e = {
    rentedRooms: [{ mapId: 1, buildingKey: 10, expiryMinutes: 3 * MINUTES_PER_DAY + 1 }],
    factionRep: { dict: dict() }, regionPrices: {},
  };
  runDayChange({ entity: e, lastMinutes: 3 * MINUTES_PER_DAY - 5, nowMinutes: 3 * MINUTES_PER_DAY, rolls: () => 0.5 });
  assert.equal(e.rentedRooms.length, 1, 'one minute paid is still paid');
});

// ── LoanChecker.CheckOverdueLoans (PlayerEntity.cs:450) ─────────────

test('S41 loans: THE MEMBER WITH NO CALLER - a loan now actually comes due', () => {
  // Every line of banking's loan law worked and none of it could
  // fire, because nothing in the port advanced a loan toward its due
  // date. Borrow, sleep past the year, and default.
  const e = {
    bankAccounts: createBankAccounts(4), regionPrices: {},
    factionRep: null, legalRep: {},
  };
  borrowLoan(e.bankAccounts, 2, 1000, { level: 10, nowMinutes: 0 });
  assert.equal(loanedTotal(e.bankAccounts, 2), 1100, 'the 10% rides from the instant of the loan');
  // spend the borrowed gold so the account cannot cover the debt
  e.bankAccounts[2].accountGold = 100;

  const past = LOAN_REPAY_MINUTES + MINUTES_PER_DAY;
  const r = runDayChange({ entity: e, lastMinutes: past - MINUTES_PER_DAY, nowMinutes: past, rolls: () => 0.5 });

  assert.deepEqual(r.loanDefaults, [2]);
  assert.equal(accountTotal(e.bankAccounts, 2), 0, 'OverdueLoan raids the account FIRST');
  assert.equal(loanedTotal(e.bankAccounts, 2), 1000, 'and only the remainder is a default');
  assert.equal(hasDefaulted(e.bankAccounts, 2), true);
  assert.equal(legalRepOf(e, 2), -REPUTATION_LOSS_PER_CRIME[CRIMES.LoanDefault], 'LowerRepForCrime(LoanDefault)');
});

test('S41 loans: an account that COVERS the debt settles quietly - no default, no reputation hit', () => {
  const e = { bankAccounts: createBankAccounts(4), regionPrices: {}, factionRep: null, legalRep: {} };
  borrowLoan(e.bankAccounts, 1, 1000, { level: 10, nowMinutes: 0 });   // accountGold 1000, loanTotal 1100
  e.bankAccounts[1].accountGold = 2000;
  const past = LOAN_REPAY_MINUTES + MINUTES_PER_DAY;
  const r = runDayChange({ entity: e, lastMinutes: past - MINUTES_PER_DAY, nowMinutes: past, rolls: () => 0.5 });
  assert.deepEqual(r.loanDefaults, []);
  assert.equal(loanedTotal(e.bankAccounts, 1), 0);
  assert.equal(hasDefaulted(e.bankAccounts, 1), false);
  assert.equal(legalRepOf(e, 1), 0, 'a paid loan costs no reputation');
});

test('S41 loans: the 6/3/1-month reminders fire on the CROSSING, once each, with both HUD lines', () => {
  const e = { bankAccounts: createBankAccounts(4), regionPrices: {}, factionRep: null, legalRep: {} };
  borrowLoan(e.bankAccounts, 0, 1000, { level: 10, nowMinutes: 0 });
  const due = e.bankAccounts[0].loanDueDate;
  const said = [];
  const say = (t) => said.push(t);

  // step a day across the six-month mark
  const at = (m) => due - m * MINUTES_PER_MONTH;
  let r = runDayChange({ entity: e, lastMinutes: at(6) - 1, nowMinutes: at(6) + MINUTES_PER_DAY, rolls: () => 0.5, say });
  assert.equal(r.loanReminders.length, 1, 'the six-month crossing spoke');
  assert.equal(said.length, 2, 'loanReminder and loanReminder2 (Internal_Strings.csv:861-862)');
  assert.match(said[0], /^You have a loan of 1100 gold pieces due in$/);
  assert.match(said[1], /^less than 6 months in .+$/, 'remainingMonths + 1, and the region NAME');

  // the next day is still inside six months - a poll would nag, a
  // crossing stays quiet
  said.length = 0;
  r = runDayChange({ entity: e, lastMinutes: at(6) + MINUTES_PER_DAY, nowMinutes: at(6) + 2 * MINUTES_PER_DAY, rolls: () => 0.5, say });
  assert.deepEqual(r.loanReminders, [], 'no second six-month reminder');
  assert.deepEqual(said, []);

  // ...and the three-month mark speaks on its own crossing
  r = runDayChange({ entity: e, lastMinutes: at(3) - 1, nowMinutes: at(3) + MINUTES_PER_DAY, rolls: () => 0.5, say });
  assert.equal(r.loanReminders.length, 1);
  assert.match(said[1], /less than 3 months/);
});

test('S41 loans: a region with no loan is never touched, and no accounts at all is not a crash', () => {
  const e = { bankAccounts: createBankAccounts(4), regionPrices: {}, factionRep: null, legalRep: {} };
  const r = runDayChange({ entity: e, lastMinutes: 0, nowMinutes: MINUTES_PER_DAY, rolls: () => 0.5 });
  assert.deepEqual(r.loanReminders, []);
  assert.deepEqual(r.loanDefaults, []);
  const bare = { regionPrices: {} };
  assert.doesNotThrow(() => runDayChange({ entity: bare, lastMinutes: 0, nowMinutes: MINUTES_PER_DAY }));
  assert.equal(runDayChange({ entity: null, lastMinutes: 0, nowMinutes: MINUTES_PER_DAY }).daysPast, 0);
});

// ── SetClimateWeathers (PlayerEntity.cs:447-448) ────────────────────

test('S41 weather: the day change rolls the zones and raises the pending-apply flag; the frame drains it', () => {
  resetWeatherSim();
  try {
    setWeather('rain');
    // Drain the boot roll first so the pin is about the DAY block.
    tickWeather(100, CLIMATES.Woodlands, () => 0.99);
    tickWeather(100, CLIMATES.Woodlands, () => 0.99);          // flag down
    setWeather('rain');
    const e = { regionPrices: {}, factionRep: { dict: dict() } };
    runDayChange({ entity: e, lastMinutes: 100, nowMinutes: 100 + MINUTES_PER_DAY, rolls: () => 0.0 });
    assert.equal(currentWeather(), 'rain', 'the day block rolls but never applies');
    assert.equal(tickWeather(100 + MINUTES_PER_DAY, CLIMATES.Woodlands, () => 0.99), true);
    assert.equal(currentWeather(), 'sunny', 'the frame applied the DAY roll (low dice -> Woodlands winter sunny)');
  } finally { resetWeatherSim(); }
});

// ── THE WIRING: every host drives this, because the tick does ───────

test('S41 wiring: tickPlayerMinutes runs the day block, so all four hosts get it and none can forget a line', () => {
  resetWeatherSim();
  try {
    const e = {
      name: 'W', health: 20, maxHealth: 20, fatigue: 500, magicka: 0,
      stats: {}, skills: [30], skillUses: [], items: [], activeEffects: [],
      regionPrices: { 0: 1000 },
      factionRep: { dict: dict() },
      bankAccounts: createBankAccounts(4),
      rentedRooms: [{ mapId: 1, buildingKey: 10, expiryMinutes: 500 }],
      lastGameMinutes: 0,
      legalRep: {},
    };
    borrowLoan(e.bankAccounts, 0, 1000, { level: 10, nowMinutes: 0 });
    e.bankAccounts[0].accountGold = 0;

    // One tick that jumps a whole year and a day - a fast travel.
    const jump = LOAN_REPAY_MINUTES + MINUTES_PER_DAY;
    tickPlayerMinutes({
      entity: e, classicMinutes: 0, dt: jump / CLASSIC_MINUTES_PER_SECOND,
      sinks: {}, rolls: () => 0.99, say: () => {},
    });

    assert.notEqual(e.regionPrices[0], 1000, 'the prices drifted');
    assert.deepEqual(e.rentedRooms, [], 'the rental expired and was collected');
    assert.equal(hasDefaulted(e.bankAccounts, 0), true, 'the loan came due');
    assert.equal(e.lastGameMinutes, jump, 'and the marker advanced');
  } finally { resetWeatherSim(); }
});

test('S41 wiring: the day block runs AFTER the fatigue band, because DFU draws the swim roll first', () => {
  // PlayerEntity.Update draws the swimming roll at :412 and the
  // price rolls at :446. A generator does not forgive a reordered
  // draw, so the order is pinned by watching which caller sees which
  // value out of a scripted sequence.
  const seq = [
    0.99,   // the SWIM roll: Dice100.FailedRoll(Swimming) -> penalty
    0.0,    // the first PRICE roll: a rise
  ];
  let i = 0;
  const rolls = () => seq[Math.min(i++, seq.length - 1)];
  const drained = [];
  const e = {
    raceId: 0, health: 20, maxHealth: 20, fatigue: 500, stats: {},
    skills: [30], skillUses: [], items: [], activeEffects: [],
    regionPrices: { 0: 1000 }, factionRep: { dict: dict() }, lastGameMinutes: 0,
  };
  tickPlayerMinutes({
    entity: e, classicMinutes: MINUTES_PER_DAY - 1,
    dt: 2 / CLASSIC_MINUTES_PER_SECOND,        // cross both a minute and the DAY
    sinks: { drainFatigue: (n) => drained.push(n) },
    activity: { running: false, swimming: true },
    rolls,
  });
  assert.deepEqual(drained, [44], 'the swim roll was drawn first and failed (SwimmingFatigueLoss)');
  assert.equal(e.regionPrices[0], 1020, 'the price roll got the SECOND value - a rise');
});

// ── the marker the restore must re-anchor ──────────────────────────

test('S41 restore: a load re-anchors lastGameMinutes, so no day block runs over a window the save already lived', () => {
  // SerializablePlayer.cs:338-339 - "Set time tracked in player
  // entity". The field is deliberately NOT in the envelope, and
  // worldTick.js has cited this line as the reason since AUDIT 23 -
  // but the line itself was never ported, so the marker just carried
  // over from whatever the session was doing before the load. That
  // was survivable while the only reader was the normalise loop. It
  // is not survivable now: hanging the DAY BLOCK off the same gap
  // means a load into a session whose clock sits behind the save's
  // would drift a year of prices and re-run a loan check over months
  // the saved game had already played through.
  //
  // Everything this pin watches has to ride the ENVELOPE, because
  // restorePlayer replaces rentedRooms, bankAccounts and regionPrices
  // wholesale - state left on the live entity would be overwritten
  // and prove nothing either way.
  const far = 400 * MINUTES_PER_DAY;
  const saved = {
    name: 'W', health: 20, maxHealth: 20, level: 1, stats: {},
    skills: [30], skillUses: [], items: [],
    bankAccounts: createBankAccounts(4),
    // a rental that has ALREADY expired at the save's own clock, so a
    // day block running here would collect it...
    rentedRooms: [{ mapId: 1, buildingKey: 10, expiryMinutes: far - MINUTES_PER_DAY }],
  };
  // ...and a loan already past due, which a day block would default
  borrowLoan(saved.bankAccounts, 0, 1000, { level: 10, nowMinutes: 0 });
  saved.bankAccounts[0].loanDueDate = far - MINUTES_PER_DAY;
  saved.bankAccounts[0].accountGold = 0;
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(saved, { classicMinutes: far })));

  // the LIVE entity is a session sitting near the epoch
  const live = {
    name: 'L', health: 20, maxHealth: 20, level: 1, stats: {},
    skills: [30], skillUses: [], items: [],
    lastGameMinutes: 10, regionPrices: {}, factionRep: { dict: dict() }, legalRep: {},
  };
  restorePlayer(live, snap);
  assert.equal(live.lastGameMinutes, far, 'the marker moved with the clock (the ported line)');

  // The first tick after the load is an ordinary frame, not 400 days.
  tickPlayerMinutes({
    entity: live, classicMinutes: far, dt: 1 / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0.99, say: () => {},
  });
  // A day block that ran with daysPast = 400 would have materialised
  // all 62 regions on its way past.
  assert.deepEqual(live.regionPrices, {}, 'no phantom drift - the price walk never ran');
  assert.equal(live.rentedRooms.length, 1, 'the expired rental waits for a REAL day change, as DFU does');
  assert.equal(hasDefaulted(live.bankAccounts, 0), false, 'the loan check did not re-run the saved window');

  // ...and the next REAL day change collects both, so this is a
  // deferral and not a hole.
  tickPlayerMinutes({
    entity: live, classicMinutes: far, dt: MINUTES_PER_DAY / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0.99, say: () => {},
  });
  assert.deepEqual(live.rentedRooms, [], 'collected on the next day change');
  assert.equal(hasDefaulted(live.bankAccounts, 0), true, 'and the loan defaulted there');
});

// ── the marker must be MONOTONIC, or one midnight fires twice ──────

test('S41 re-entrancy: the exhaustion collapse re-enters the tick, and one midnight must still fire ONCE', () => {
  // DFU makes this impossible by construction: PlayerEntity.cs:368-371
  // THROWS when gameMinutes < lastGameMinutes, so the marker can never
  // end a frame ahead of the clock and a calendar boundary is crossed
  // exactly once. Its exhaustion collapse is a bare RaiseTime(1 hour)
  // at :2429 that never re-enters Update.
  //
  // The port's hosts implement that RaiseTime as playerTicker.advance(60)
  // fired from inside sinks.drainFatigue (shared.js:682 ->
  // exterior.js:407, world.js:626), which re-enters tickPlayerMinutes
  // from inside its own fatigue band. With the marker assigned
  // unconditionally the nested tick left it an hour AHEAD, the outer
  // frame's own setWorldMinutes then reset the clock BELOW it, and the
  // next frame pulled the marker back - so the same midnight was crossed
  // and processed TWICE. Measured before the fix: the price drifted
  // 1000 -> 980 -> 960 for one day change, the six climate zones rolled
  // twice, and the room sweep and loan check both ran twice.
  //
  // The write-back is the load-bearing half of the repro, so this pin
  // drives the host's real shape - module world clock and all - rather
  // than calling tickPlayerMinutes twice by hand.
  const saved = worldMinutes();
  resetWeatherSim();
  try {
    const start = 100 * MINUTES_PER_DAY + 1410 + 0.5;   // 23:30 on day 100, mid-minute
    setWorldMinutes(start);
    const e = {
      raceId: 0, health: 20, maxHealth: 20, fatigue: 11, stats: {},
      skills: [30], skillUses: [], items: [], activeEffects: [],
      regionPrices: { 0: 1000 }, factionRep: { dict: dict() }, legalRep: {},
      lastGameMinutes: Math.floor(start),
    };
    let collapses = 0;
    let ticker;
    const onExhausted = () => {                    // the hosts' _inExhaustion latch
      if (onExhausted.busy) return;
      onExhausted.busy = true;
      try { collapses++; ticker.advance(60); e.fatigue = 1e9; }
      finally { onExhausted.busy = false; }
    };
    const sinks = {                                 // shared.js:675-683
      drainFatigue: (n) => {
        if (n <= 0) return;
        e.fatigue = Math.max(0, (e.fatigue ?? 0) - n);
        if (e.fatigue <= 0 && (e.health ?? 0) > 0) onExhausted();
      },
    };
    ticker = {
      tick(dt) {
        const r = tickPlayerMinutes({
          entity: e, classicMinutes: worldMinutes(), dt, sinks,
          rolls: () => 0.99, say: () => {},
        });
        setWorldMinutes(r.classicMinutes);          // shared.js:716 - the write-back
        return r;
      },
      advance(m) { return m > 0 ? this.tick(m / CLASSIC_MINUTES_PER_SECOND) : null; },
    };

    const drifts = [];
    let prev = 1000;
    // The clock runs at one classic minute per five real seconds, so
    // covering 23:30 -> past midnight needs 150+ real seconds of frames;
    // a one-second frame keeps that cheap without changing the shape.
    for (let f = 0; f < 250; f++) {                 // 250s = 50 classic minutes
      ticker.tick(1);
      if (e.regionPrices[0] !== prev) { drifts.push([prev, e.regionPrices[0]]); prev = e.regionPrices[0]; }
    }

    assert.equal(collapses, 1, 'the fixture collapsed exactly once');
    assert.ok(worldMinutes() > 101 * MINUTES_PER_DAY, 'the run really did cross midnight');
    assert.equal(drifts.length, 1,
      `ONE day change must drift the price ONCE; got ${JSON.stringify(drifts)}`);
    assert.equal(e.regionPrices[0], 980, '1000 -> 980, not 1000 -> 980 -> 960');
  } finally {
    setWorldMinutes(saved);
    resetWeatherSim();
  }
});

// ── the day block runs BEFORE the normalise loop, as DFU's does ────

test('S41 order: a loan default on a 112-day boundary is decayed in the SAME tick, not before it lands', () => {
  // DFU's order inside one Update is the day block (:441-450) and THEN
  // the per-minute normalise loop (:453-477). The port had the loop
  // hoisted to the top of tickPlayerMinutes, which costs the roll
  // stream nothing (neither the loop nor normalizeReputations draws)
  // but is NOT free for state: the day block's loan arm calls
  // LowerRepForCrime (LoanChecker.cs:70), so DFU lands the fresh hit
  // and then decays it by one in the same tick, where the hoisted
  // order decayed an old value first and applied the hit afterwards.
  //
  // Every 112-day boundary IS a day boundary (161280 = 112 * 1440), so
  // this needs no exotic coincidence - only a loan coming due that day.
  const boundary = NORMALIZE_INTERVAL_MINUTES;          // minute 161280 exactly
  const e = {
    health: 20, maxHealth: 20, fatigue: 500, stats: {},
    skills: [30], skillUses: [], items: [], activeEffects: [],
    regionPrices: {}, factionRep: null, legalRep: {},
    bankAccounts: createBankAccounts(4),
    lastGameMinutes: boundary - 1,
  };
  borrowLoan(e.bankAccounts, 0, 1000, { level: 10, nowMinutes: 0 });
  e.bankAccounts[0].loanDueDate = boundary - MINUTES_PER_DAY;   // already overdue
  e.bankAccounts[0].accountGold = 0;

  tickPlayerMinutes({
    entity: e, classicMinutes: boundary - 1, dt: 2 / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0.5, say: () => {},
  });

  assert.equal(hasDefaulted(e.bankAccounts, 0), true, 'the loan defaulted on this tick');
  const loss = REPUTATION_LOSS_PER_CRIME[CRIMES.LoanDefault];
  // DFU: LowerRepForCrime lands -loss, then the normalise loop nudges
  // it back toward zero by one in the same tick.
  assert.equal(legalRepOf(e, 0), -loss + 1,
    `the hit must land BEFORE the decay (-${loss} then +1); the hoisted order left -${loss}`);
});

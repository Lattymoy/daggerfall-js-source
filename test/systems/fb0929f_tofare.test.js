// TO-FARE (FIELD BUGS 2026-09-29f, found on MERC-CAP's way; Mac: "Fix the separate bug"). Travel Options' scaled fare
// haggles through FormulaHelper.CalculateTradePrice (TravelTimeCalculatorTO.CalculateTripCost:
// `CalculateTradePrice(piecesCost, 10, false)`, and the same for the passage), which reads the traveller's live
// Mercantile SKILL (GetLiveSkillValue, FormulaHelper.cs:1992/1998). The port read `liveStat(e, 'mercantile')` - a stat
// by the skill's name, which no entity has - so every scaled fare haggled at Mercantile 0: on a trip of 300 in inn
// nights and 400 in passage, scaled x4 and x3, a traveller at Mercantile 90 paid a novice's 1686 for a 1068 fare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleTripCost } from '../../src/ui/travel/travelPopUp.js';
import { calculateTradePrice } from '../../src/systems/shopStock.js';
import { SKILLS } from '../../src/systems/skills.js';

const traveller = (m, over = {}) => ({
  skills: Object.assign(new Array(35).fill(20), { [SKILLS.Mercantile]: m }), stats: { personality: 50 }, activeEffects: [], ...over,
});
const TRIP = { piecesCost: 300, totalCost: 700 };   // 300 of inn nights, 400 of passage
const TO = { fastTravelCostScaleFactor: 4, shipTravelCostScaleFactor: 3 };
const haggled = (cost, m) => calculateTradePrice(cost, 10, { mercantile: m, personality: 50 }, false, { online: false });
/** The page's own switch (onlineLane.js isOnlinePage), which the fare's haggle reads itself. */
function onlinePage(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    return fn();
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}

test('TO-FARE: the scaled fare haggles over the traveller\'s live Mercantile SKILL - at 90 it is 1068, where a novice\'s 1686 was billed', () => {
  assert.deepEqual(scaleTripCost(TRIP, TO, traveller(0)), { piecesCost: 843, totalCost: 1686 }, 'the novice\'s fare - what every traveller was billed');
  assert.deepEqual(scaleTripCost(TRIP, TO, traveller(90)), { piecesCost: 534, totalCost: 1068 });
  for (const m of [0, 25, 50, 75, 90, 100]) {
    assert.deepEqual(scaleTripCost(TRIP, TO, traveller(m)), { piecesCost: haggled(1200, m), totalCost: 2 * haggled(1200, m) }, `Mercantile ${m}: each half through the mod's own call`);
  }
  // the LIVE skill: a worn Enhances Skill's +15 haggles as fifteen points more, as GetLiveSkillValue adds the mod
  const dressed = traveller(75, { _enchantMods: { skillMods: { [SKILLS.Mercantile]: 15 } } });
  assert.deepEqual(scaleTripCost(TRIP, TO, dressed), scaleTripCost(TRIP, TO, traveller(90)));
  // a factor of 1 still leaves its half as DFU billed it, whoever travels
  assert.deepEqual(scaleTripCost(TRIP, { fastTravelCostScaleFactor: 1, shipTravelCostScaleFactor: 1 }, traveller(90)), TRIP);
});

test('TO-FARE x MERC-CAP: online the fare reads the haggle\'s own range - past 100 a traveller pays what 100 pays; offline, Daggerfall\'s reads stand', () => {
  onlinePage(() => {
    for (const m of [101, 233, 346]) assert.deepEqual(scaleTripCost(TRIP, TO, traveller(m)), scaleTripCost(TRIP, TO, traveller(100)), `Mercantile ${m}`);
    assert.ok(scaleTripCost(TRIP, TO, traveller(100)).totalCost > 0);
  });
  // SOFTCAP1 (skills past 100): offline the traveller's Mercantile is the LIVE read, and a point past 100 is worth a
  // quarter of one below it (effectiveSkill) - 346 reads as about 161, so the mod's call over DFU's read no longer runs
  // under nothing: the fare is dearer than at 100's best haggle and still a price. The raw formula stays unbounded.
  const far = scaleTripCost(TRIP, TO, traveller(346));
  assert.ok(far.totalCost > 0, `${far.totalCost}`);
  assert.ok(far.totalCost < scaleTripCost(TRIP, TO, traveller(100)).totalCost, 'a better haggler than 100, softened');
  assert.ok(haggled(1200, 346) < 0, 'the formula past 233 is still under nothing - a raw read there would still pay the buyer');
});

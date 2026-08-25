// S42 - THE REGION CONDITION STORE (PlayerEntity.cs:1575-1585 the
// record, :1588-1619 the enum, :1621 the group map, :2140-2187 the
// mutators, :2189-2218 the init), and S41's PricesHigh/PricesLow half
// finally landing in it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_FLAGS, FLAGS_TO_FLAGS2, CONDITION_VALUE_MIN, CONDITION_VALUE_MAX,
  VALUES_WIDTH, FLAGS_WIDTH, FLAGS2_WIDTH, REGION_COUNT,
  createRegionConditions, turnOnConditionFlag, turnOffConditionFlag,
  conditionFlag, conditionValue, conditionGroupFlag, resetWarDataForRegion,
  snapshotRegionConditions, restoreRegionConditions,
} from '../src/systems/regionConditions.js';
import { updateRegionalPrices } from '../src/systems/shopStock.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const dict = ({ merchantsPower = 50, provincePower = 50, regions = [0] } = {}) => {
  const d = new Map();
  d.set(MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: merchantsPower });
  for (const r of regions) d.set(9000 + r, { id: 9000 + r, type: FACTION_TYPES.Province, region: r, power: provincePower });
  return d;
};

// ── the tables, whole ───────────────────────────────────────────────

test('S42 tables: the group map and both value tables are DFU\'s literals, entire', () => {
  // A table where one cell is wrong is worse than no table, so these
  // are deepEqual against the C# rather than spot-checked.
  assert.deepEqual([...FLAGS_TO_FLAGS2],
    [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 6, 7, 8, 9, 3, 3, 3, 3, 10, 4, 4, 11, 12, 13, 5, 5, 0, 0, 0, 0],
    'PlayerEntity.cs:1621');
  assert.deepEqual([...CONDITION_VALUE_MIN],
    [0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x01, 0x0A,
      0x0A, 0x01, 0x01, 0x01, 0x01, 0x0A, 0x0A, 0x0A, 0x01, 0x01, 0x01, 0x05, 0x01], ':2142');
  assert.deepEqual([...CONDITION_VALUE_MAX],
    [0x0A, 0x0A, 0x0A, 0x0A, 0x1E, 0x1E, 0x1E, 0x1E, 0x1E, 0x1E, 0x0A, 0x0A, 0x64,
      0x14, 0x14, 0x01, 0x01, 0x01, 0x64, 0x14, 0x14, 0x01, 0x01, 0x01, 0x1E, 0x01], ':2143');
});

test('S42 widths: the enum, the flags, the value tables and the groups DISAGREE, exactly as DFU has them', () => {
  // Four widths, three of them different, and this port keeps all of
  // them: a tidied width is a different program.
  assert.equal(Object.keys(REGION_FLAGS).length, 30, 'the enum runs 0..29');
  assert.equal(FLAGS_WIDTH, 29, '`new bool[29]` (:2199) - Condition29 has no slot');
  assert.equal(VALUES_WIDTH, 29, '`new byte[29]` (:2194)');
  assert.equal(CONDITION_VALUE_MIN.length, 26, 'Condition26..29 have no duration entry (:2142)');
  assert.equal(CONDITION_VALUE_MAX.length, 26);
  // Flags2 is exactly wide enough for the map's largest group, and the
  // map is what determines it.
  assert.equal(FLAGS2_WIDTH, Math.max(...FLAGS_TO_FLAGS2) + 1, ':2203 `new bool[14]`');
  assert.equal(FLAGS2_WIDTH, 14);
  assert.equal(FLAGS_TO_FLAGS2.length, 30, 'the map covers the ENUM, not the flags array');
  const s = createRegionConditions();
  assert.equal(s.length, REGION_COUNT);
  assert.equal(s[0].values.length, 29);
  assert.equal(s[0].flags.length, 29);
  assert.equal(s[0].flags2.length, 14);
});

// ── TurnOnConditionFlag ─────────────────────────────────────────────

test('S42 turnOn: lighting a flag rolls its duration, lights it, and lights its GROUP', () => {
  const s = createRegionConditions();
  // PlagueBeginning is group 1, range 0x05..0x1E. A roll of 0 takes the
  // floor; Random.Range(min, max+1) so max is reachable.
  turnOnConditionFlag(s, 3, REGION_FLAGS.PlagueBeginning, () => 0);
  assert.equal(conditionFlag(s, 3, REGION_FLAGS.PlagueBeginning), true);
  assert.equal(conditionGroupFlag(s, 3, 1), true, 'the group lights too');
  assert.equal(conditionValue(s, 3, REGION_FLAGS.PlagueBeginning), 0x05, 'the floor');
  turnOnConditionFlag(s, 4, REGION_FLAGS.PlagueBeginning, () => 0.999999);
  assert.equal(conditionValue(s, 4, REGION_FLAGS.PlagueBeginning), 0x1E, 'max is REACHABLE - Range(min, max + 1)');
  // and only the region asked for
  assert.equal(conditionFlag(s, 5, REGION_FLAGS.PlagueBeginning), false);
});

test('S42 turnOn: THE GROUP CLEAR - a region has one war state, and the new one puts the old one out', () => {
  const s = createRegionConditions();
  // All four war flags share group 0. WarOngoing then WarWon must leave
  // only WarWon standing.
  turnOnConditionFlag(s, 0, REGION_FLAGS.WarOngoing, () => 0.5);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarOngoing), true);
  turnOnConditionFlag(s, 0, REGION_FLAGS.WarWon, () => 0.5);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarOngoing), false, 'the old war state went out');
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarWon), true);
  // A DIFFERENT group is untouched by that clear.
  turnOnConditionFlag(s, 0, REGION_FLAGS.FamineOngoing, () => 0.5);   // group 2
  turnOnConditionFlag(s, 0, REGION_FLAGS.WarLost, () => 0.5);         // group 0
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.FamineOngoing), true, 'famine is group 2 - the war clear does not reach it');
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarWon), false);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarLost), true);
});

test('S42 turnOn: the clear is gated on the GROUP flag, which is what makes it work at all', () => {
  // :2146 tests Flags2[group], not Flags[flagID]. With the group down,
  // no clear runs - so a stale sibling flag left behind by
  // turnOffConditionFlag (which clears the whole group) SURVIVES.
  // That asymmetry is DFU's and it is observable.
  const s = createRegionConditions();
  turnOnConditionFlag(s, 0, REGION_FLAGS.WarOngoing, () => 0.5);
  turnOffConditionFlag(s, 0, REGION_FLAGS.WarWon);     // a sibling: clears the GROUP
  assert.equal(conditionGroupFlag(s, 0, 0), false, 'the group went down');
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarOngoing), true, 'but WarOngoing is still lit');
  turnOnConditionFlag(s, 0, REGION_FLAGS.WarBeginning, () => 0.5);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.WarOngoing), true,
    'the group was down, so no clear ran and the stale sibling stands - DFU\'s own shape');
});

test('S42 turnOn: the duration roll is drawn on EVERY call, including a re-light', () => {
  const s = createRegionConditions();
  let draws = 0;
  const roll = (v) => () => { draws++; return v; };
  turnOnConditionFlag(s, 0, REGION_FLAGS.CrimeWave, roll(0));
  assert.equal(draws, 1);
  assert.equal(conditionValue(s, 0, REGION_FLAGS.CrimeWave), 0x01);
  turnOnConditionFlag(s, 0, REGION_FLAGS.CrimeWave, roll(0.999999));
  assert.equal(draws, 2, 'a re-light consumes a draw too');
  assert.equal(conditionValue(s, 0, REGION_FLAGS.CrimeWave), 0x0A, 'and takes the fresh duration');
});

test('S42 turnOff: it clears the whole GROUP, not just this member', () => {
  const s = createRegionConditions();
  turnOnConditionFlag(s, 1, REGION_FLAGS.FamineBeginning, () => 0.5);
  turnOffConditionFlag(s, 1, REGION_FLAGS.FamineBeginning);
  assert.equal(conditionFlag(s, 1, REGION_FLAGS.FamineBeginning), false);
  assert.equal(conditionGroupFlag(s, 1, FLAGS_TO_FLAGS2[REGION_FLAGS.FamineBeginning]), false);
});

// ── ResetWarDataForRegion ───────────────────────────────────────────

test('S42 resetWar: only a PROVINCE with a real region is reset, and only WarOngoing loses its Value', () => {
  const s = createRegionConditions();
  const light = () => {
    for (const f of ['WarBeginning', 'WarOngoing', 'WarWon', 'WarLost']) {
      s[7].flags[REGION_FLAGS[f]] = true; s[7].values[REGION_FLAGS[f]] = 9;
    }
    s[7].flags2[0] = true;
  };
  light();
  // not a Province -> nothing happens
  resetWarDataForRegion(s, { region: 7, type: FACTION_TYPES.Group }, FACTION_TYPES.Province);
  assert.equal(conditionFlag(s, 7, REGION_FLAGS.WarOngoing), true, 'a non-Province is left alone');
  // region -1 -> nothing happens
  resetWarDataForRegion(s, { region: -1, type: FACTION_TYPES.Province }, FACTION_TYPES.Province);
  assert.equal(conditionFlag(s, 7, REGION_FLAGS.WarOngoing), true);
  // the real thing
  resetWarDataForRegion(s, { region: 7, type: FACTION_TYPES.Province }, FACTION_TYPES.Province);
  for (const f of ['WarBeginning', 'WarOngoing', 'WarWon', 'WarLost']) {
    assert.equal(conditionFlag(s, 7, REGION_FLAGS[f]), false, f);
  }
  assert.equal(conditionGroupFlag(s, 7, 0), false);
  assert.equal(conditionValue(s, 7, REGION_FLAGS.WarOngoing), 0, 'WarOngoing loses its duration');
  assert.equal(conditionValue(s, 7, REGION_FLAGS.WarWon), 9,
    'the other three KEEP theirs - DFU clears one Value, not four');
});

// ── S41's flagged half, landing ─────────────────────────────────────

test('S42/S41: the price walk drives PricesHigh and PricesLow, the flag S41 could not write', () => {
  const s = createRegionConditions();
  const d = dict();
  // Over 2000 -> PricesHigh. Start at the ceiling: chance is negative
  // there, so every roll fails and the price FALLS to 3920 - still over
  // 2000, so the high flag lights.
  const hi = { regionPrices: { 0: 4000 } };
  updateRegionalPrices(hi, d, 1, () => 0.5, s);
  assert.equal(hi.regionPrices[0], 3920);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesHigh), true);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesLow), false);

  // Under 500 -> PricesLow. From the 250 floor a failed roll clamps at
  // 250, which is under 500.
  const lo = { regionPrices: { 0: 250 } };
  updateRegionalPrices(lo, d, 1, () => 0.90, s);   // 90 < 80 false -> falls, clamps
  assert.equal(lo.regionPrices[0], 250);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesLow), true);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesHigh), false,
    'PricesHigh and PricesLow share group 4, so lighting one puts the other out');
});

test('S42/S41: the NORMAL band clears BOTH flags every step - DFU\'s asymmetry, kept', () => {
  const s = createRegionConditions();
  // light both by hand, then walk a region that lands in [500, 2000]
  s[0].flags[REGION_FLAGS.PricesHigh] = true;
  s[0].flags[REGION_FLAGS.PricesLow] = true;
  s[0].flags2[FLAGS_TO_FLAGS2[REGION_FLAGS.PricesHigh]] = true;
  const e = { regionPrices: { 0: 1000 } };
  updateRegionalPrices(e, dict(), 1, () => 0.99, s);
  assert.equal(e.regionPrices[0], 980, 'in band');
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesHigh), false);
  assert.equal(conditionFlag(s, 0, REGION_FLAGS.PricesLow), false);
});

test('S42/S41: a null store leaves the price walk itself untouched', () => {
  const a = { regionPrices: { 0: 1000 } };
  const b = { regionPrices: { 0: 1000 } };
  updateRegionalPrices(a, dict(), 3, () => 0.99, null);
  updateRegionalPrices(b, dict(), 3, () => 0.99, createRegionConditions());
  assert.equal(a.regionPrices[0], b.regionPrices[0],
    'the flag half must not perturb the price half - the extra draws are the FLAG\'s, taken after');
});

// ── the save halves ─────────────────────────────────────────────────

test('S42 save: the store round-trips, and a pre-S42 save restores blank rather than throwing', () => {
  const s = createRegionConditions();
  turnOnConditionFlag(s, 2, REGION_FLAGS.WitchBurnings, () => 0.5);
  turnOnConditionFlag(s, 61, REGION_FLAGS.MadWizardNearby, () => 0);
  s[5].precipitationOverride = 3; s[5].severePunishmentFlags = 2; s[5].idOfPersecutedTemple = 108;
  const snap = JSON.parse(JSON.stringify(snapshotRegionConditions(s)));
  const back = restoreRegionConditions(snap);
  assert.equal(conditionFlag(back, 2, REGION_FLAGS.WitchBurnings), true);
  assert.equal(conditionValue(back, 2, REGION_FLAGS.WitchBurnings), conditionValue(s, 2, REGION_FLAGS.WitchBurnings));
  assert.equal(conditionGroupFlag(back, 2, FLAGS_TO_FLAGS2[REGION_FLAGS.WitchBurnings]), true);
  assert.equal(conditionValue(back, 61, REGION_FLAGS.MadWizardNearby), 0x05, 'the last region rides too');
  assert.equal(back[5].precipitationOverride, 3);
  assert.equal(back[5].severePunishmentFlags, 2);
  assert.equal(back[5].idOfPersecutedTemple, 108);
  // a pre-S42 envelope
  const blank = restoreRegionConditions(undefined);
  assert.equal(blank.length, REGION_COUNT);
  assert.equal(conditionFlag(blank, 2, REGION_FLAGS.WitchBurnings), false);
  assert.equal(snapshotRegionConditions(null), null);
});

test('S42/S41: the two band boundaries are INCLUSIVE, pinned by landing exactly on them', () => {
  // Both boundaries survived their first mutation round because every
  // fixture straddled them - 4000, 1000 and 250 say nothing about 2000
  // and 500 themselves. These land ON the edge.
  const d = dict();

  // `adjusted <= 2000`: 2041 falls to trunc(49 * 2041 / 50) = 2000
  // exactly (its chance is 9, so a 0.5 roll fails and it falls). At
  // 2000 DFU takes the NOT-high path; `< 2000` would light PricesHigh.
  const edgeHigh = createRegionConditions();
  const a = { regionPrices: { 0: 2041 } };
  updateRegionalPrices(a, d, 1, () => 0.5, edgeHigh);
  assert.equal(a.regionPrices[0], 2000, 'landed exactly on the boundary');
  assert.equal(conditionFlag(edgeHigh, 0, REGION_FLAGS.PricesHigh), false,
    '2000 is IN the normal band - `<= 2000`, not `< 2000`');
  assert.equal(conditionFlag(edgeHigh, 0, REGION_FLAGS.PricesLow), false);

  // `adjusted >= 500`: 491 rises to trunc(51 * 491 / 50) = 500 exactly
  // (chance 70, so a 0.5 roll passes and it rises). At 500 DFU clears
  // both; `> 500` would light PricesLow.
  const edgeLow = createRegionConditions();
  const b = { regionPrices: { 0: 491 } };
  updateRegionalPrices(b, d, 1, () => 0.5, edgeLow);
  assert.equal(b.regionPrices[0], 500, 'landed exactly on the boundary');
  assert.equal(conditionFlag(edgeLow, 0, REGION_FLAGS.PricesLow), false,
    '500 is IN the normal band - `>= 500`, not `> 500`');
  assert.equal(conditionFlag(edgeLow, 0, REGION_FLAGS.PricesHigh), false);
});

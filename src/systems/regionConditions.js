// S42: THE REGION CONDITION STORE - PlayerEntity's regionData Flags /
// Flags2 / Values half (PlayerEntity.cs:1575-1585 the record, :1588-1619
// the enum, :1621 the group map, :2140-2187 the mutators, :2189-2218 the
// init).
//
// WHY THIS FIRST. The port has had writers waiting on this store with
// nowhere to write: S41 shipped FormulaHelper.UpdateRegionalPrices and
// had to FLAG its PricesHigh/PricesLow half because "the port has no
// RegionDataFlags store at all", and the whole
// RegionPowerAndConditionsUpdate arc (:1626-2115) needs it before any of
// its wars, famines, plagues or crime waves can land anywhere. This is
// the foundation those slices stand on, and it closes S41's flag.
//
// ONE RECORD, SPLIT THREE WAYS - recorded, not silently. DFU's
// RegionDataRecord also carries LegalRep and PriceAdjustment, and the
// port already has both, in their own homes and with their own laws:
// court.js owns `player.legalRep[region]` and shopStock.js owns
// `entity.regionPrices[region]`. Folding them in here would rewrite two
// shipped systems for a field-layout parity no behaviour depends on, so
// this module owns the CONDITION half - Values, Flags, Flags2 - and the
// other two keep their homes. The three together are DFU's record.
// PrecipitationOverride and SeverePunishmentFlags are here because
// nothing else has them. The weather override stays inert - classic
// never sets it - but SeverePunishmentFlags is LIVE both ways as of
// the arrest arc: scenes/arrestFlow.js:421-424 sets bit 1 on
// banishment (DaggerfallCourtWindow.cs:272) and encounters.js:220
// passiveGuardSpawns reads it every catch-up minute through
// scenes/world.js:1627-1629 (PlayerEntity.cs:507).

/** PlayerEntity.RegionDataFlags (:1588-1619), all thirty. */
export const REGION_FLAGS = Object.freeze({
  WarBeginning: 0, WarOngoing: 1, WarWon: 2, WarLost: 3,
  PlagueBeginning: 4, PlagueOngoing: 5, PlagueEnding: 6,
  FamineBeginning: 7, FamineOngoing: 8, FamineEnding: 9,
  WitchBurnings: 10, CrimeWave: 11, NewRuler: 12, BadHarvest: 13,
  TGMInJail: 14, TGMSetFree: 15, TGMExecuted: 16, NewTGM: 17,
  PersecutedTemple: 18, PricesHigh: 19, PricesLow: 20,
  HappyHoliday: 21, ScaryHoliday: 22, HolyHoliday: 23,
  MadWizardNearby: 24, MadWizardDies: 25,
  // DFU's own comment marks 26-29 "Unused". They are in the enum and
  // nothing sets them - see THE THREE WIDTHS below for why that matters.
  Condition26: 26, Condition27: 27, Condition28: 28, Condition29: 29,
});

/** PlayerEntity.flagsToFlags2Map (:1621), verbatim. A condition's GROUP:
 *  setting any flag also sets its group's flag, and turning one on
 *  clears every other flag sharing the group. */
export const FLAGS_TO_FLAGS2 = Object.freeze([
  0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 6, 7, 8, 9, 3, 3, 3, 3, 10, 4, 4, 11, 12, 13, 5, 5, 0, 0, 0, 0,
]);

// THE THREE WIDTHS, and they do not agree. This is DFU's, reproduced.
//
//   the enum          30 members (0..29)
//   Values / Flags    29 wide    (:2194, :2199 - `new byte[29]`, `new bool[29]`)
//   valuesMin / Max   26 wide    (:2142-2143)
//   Flags2            14 wide    (:2203, and max(flagsToFlags2Map) + 1)
//
// So Condition29 has no Values or Flags slot at all, and Condition26..29
// have no valuesMin/Max entry: TurnOnConditionFlag on any of them would
// read past two arrays and, in C#, throw IndexOutOfRange. The group-clear
// loop is `for (int i = 0; i < 29; ++i)` (:2148), which tracks the FLAGS
// width rather than the enum's - so it never touches index 29 either.
// All four are unreachable because nothing in DFU sets Condition26..29,
// and this port keeps every width exactly as it found it rather than
// tidying them into agreement: a tidied width is a different program.
export const VALUES_WIDTH = 29;
export const FLAGS_WIDTH = 29;
export const FLAGS2_WIDTH = 14;

/** TurnOnConditionFlag's per-flag duration roll (:2142-2143), verbatim.
 *  Twenty-six entries against the enum's thirty - see THE THREE WIDTHS. */
export const CONDITION_VALUE_MIN = Object.freeze([
  0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x01, 0x0A,
  0x0A, 0x01, 0x01, 0x01, 0x01, 0x0A, 0x0A, 0x0A, 0x01, 0x01, 0x01, 0x05, 0x01,
]);
export const CONDITION_VALUE_MAX = Object.freeze([
  0x0A, 0x0A, 0x0A, 0x0A, 0x1E, 0x1E, 0x1E, 0x1E, 0x1E, 0x1E, 0x0A, 0x0A, 0x64,
  0x14, 0x14, 0x01, 0x01, 0x01, 0x64, 0x14, 0x14, 0x01, 0x01, 0x01, 0x1E, 0x01,
]);

/** PlayerEntity.regionData.Length (:99) - one record per region. */
export const REGION_COUNT = 62;

/** One RegionDataRecord's CONDITION half (:1575-1585, :2192-2211). */
const blankRegion = () => ({
  values: new Uint8Array(VALUES_WIDTH),
  flags: new Array(FLAGS_WIDTH).fill(false),
  flags2: new Array(FLAGS2_WIDTH).fill(false),
  precipitationOverride: 0,
  severePunishmentFlags: 0,
  idOfPersecutedTemple: 0,
});

/** InitializeRegionData's array half (:2189-2218). The twelve bootstrap
 *  RegionPowerAndConditionsUpdate passes at the tail of that member
 *  live in regionPower.bootstrapRegionPower (AUDIT 26 F107), called
 *  from BOTH construction paths - not here, because a store
 *  constructor running the walk would be a second caller. */
export function createRegionConditions(regionCount = REGION_COUNT) {
  return Array.from({ length: regionCount }, blankRegion);
}

/**
 * TurnOnConditionFlag (:2140-2159), verbatim and in DFU's order:
 *
 *   1. if the flag's GROUP is already lit, clear every flag in that
 *      group first - a region has one war state, one plague state, one
 *      famine state, and lighting a new one puts the old one out;
 *   2. roll this flag's duration into Values[flag];
 *   3. light the flag and its group.
 *
 * Step 1 is gated on the GROUP flag (:2146), not on the flag itself, which is
 * the whole point: it is how WarBeginning replaces WarOngoing without
 * either knowing about the other.
 *
 * `Random.Range(min, max + 1)` is a UnityEngine draw, so it rides an
 * injectable uniform roll under THE ENGINE-PRNG RULE (Port-Ledger A).
 * The roll happens on EVERY call, including one that re-lights a flag
 * that is already on - so a condition re-asserted each update keeps
 * getting a fresh duration, and the draw is consumed either way.
 */
export function turnOnConditionFlag(store, regionID, flagID, rolls = Math.random) {
  const r = store[regionID];
  if (!r) return;
  const group = FLAGS_TO_FLAGS2[flagID];
  if (r.flags2[group]) {
    // `i < 29` (:2148) - the FLAGS width, not the enum's thirty.
    for (let i = 0; i < FLAGS_WIDTH; i++) {
      if (FLAGS_TO_FLAGS2[i] === group) r.flags[i] = false;
    }
  }
  const min = CONDITION_VALUE_MIN[flagID];
  const max = CONDITION_VALUE_MAX[flagID];
  r.values[flagID] = min + Math.floor(rolls() * (max + 1 - min));
  r.flags[flagID] = true;
  r.flags2[group] = true;
}

/** TurnOffConditionFlag (:2161-2165). Note it clears the GROUP flag
 *  whole, not just this member - so turning off one condition in a
 *  group marks the group unlit even if a sibling flag is still set.
 *  DFU's, kept. */
export function turnOffConditionFlag(store, regionID, flagID) {
  const r = store[regionID];
  if (!r) return;
  r.flags[flagID] = false;
  r.flags2[FLAGS_TO_FLAGS2[flagID]] = false;
}

/** Read a condition. */
export const conditionFlag = (store, regionID, flagID) => !!store?.[regionID]?.flags[flagID];
export const conditionValue = (store, regionID, flagID) => store?.[regionID]?.values[flagID] ?? 0;
export const conditionGroupFlag = (store, regionID, group) => !!store?.[regionID]?.flags2[group];

/**
 * ResetWarDataForRegion (:2167-2187). Clears all four war flags, the
 * shared war GROUP flag, and the WarOngoing duration - but ONLY for a
 * faction that is a Province with a real region.
 *
 * Two DFU details kept: it clears Values for WarOngoing alone and leaves
 * the other three war durations standing (they are set but never read
 * once their flag is down), and it clears the group through
 * WarBeginning's map entry, which is the same group all four share.
 */
export function resetWarDataForRegion(store, faction, PROVINCE_TYPE) {
  if (!faction) return;
  const regionID = faction.region;
  if (regionID === -1 || faction.type !== PROVINCE_TYPE) return;
  const r = store[regionID];
  if (!r) return;
  r.flags[REGION_FLAGS.WarBeginning] = false;
  r.flags[REGION_FLAGS.WarOngoing] = false;
  r.flags[REGION_FLAGS.WarWon] = false;
  r.flags[REGION_FLAGS.WarLost] = false;
  r.flags2[FLAGS_TO_FLAGS2[REGION_FLAGS.WarBeginning]] = false;
  r.values[REGION_FLAGS.WarOngoing] = 0;
}

/** The save halves. Flags/Flags2 ride as bit strings and Values as a
 *  plain array, which is the smallest honest record for 62 x (29+29+14). */
export function snapshotRegionConditions(store) {
  if (!store) return null;
  return store.map((r) => ({
    v: [...r.values],
    f: r.flags.map((b) => (b ? 1 : 0)).join(''),
    g: r.flags2.map((b) => (b ? 1 : 0)).join(''),
    p: r.precipitationOverride, s: r.severePunishmentFlags, t: r.idOfPersecutedTemple,
  }));
}
export function restoreRegionConditions(snap, regionCount = REGION_COUNT) {
  const store = createRegionConditions(regionCount);
  if (!Array.isArray(snap)) return store;   // a pre-S42 save restores blank
  for (let i = 0; i < Math.min(snap.length, store.length); i++) {
    const s = snap[i]; if (!s) continue;
    const r = store[i];
    for (let j = 0; j < Math.min((s.v ?? []).length, VALUES_WIDTH); j++) r.values[j] = s.v[j];
    for (let j = 0; j < Math.min((s.f ?? '').length, FLAGS_WIDTH); j++) r.flags[j] = s.f[j] === '1';
    for (let j = 0; j < Math.min((s.g ?? '').length, FLAGS2_WIDTH); j++) r.flags2[j] = s.g[j] === '1';
    r.precipitationOverride = s.p ?? 0;
    r.severePunishmentFlags = s.s ?? 0;
    r.idOfPersecutedTemple = s.t ?? 0;
  }
  return store;
}

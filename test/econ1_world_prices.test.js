// ECON1 (Mac, 2026-09-17: "Economy slice next" - the STOP list's "one economy"): THE REGION'S PRICES ARE THE WORLD'S.
// DFU walks each region's price index once a day on the player's own state, tilted by The Merchants' power against
// the region's; WORLD6b made the day's rolls the world's and left the state each player's, so two players who
// arrived on different days read different prices in one shop. Under the shared clock the index is now a pure
// function of the world's day: the opening indices drawn on the epoch day, every day since walked with that day's
// generator, region-major, the merchants' tilt dropped (the powers are each player's - quests move them). No wire, no
// owner, no memory: every client computes the same numbers. The player's own `regionPrices` are never written online;
// the condition flags (PricesHigh / PricesLow, the player's own store) are applied from the world's index.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldRegionPricesOn, worldRegionPrice, dayRng, DAY_SALT, setSharedClock, sharedClockOn, runDayChange, MINUTES_PER_DAY, setWorldPriceTilt, worldPriceTiltOn, worldPriceCheckpointDays } from '../src/systems/worldTick.js';
import { regionPriceAdjustment, priceWalkStep, initialRegionPrice, setWorldPriceSource, worldPriceSourceOn, updateRegionalPrices, applyPriceConditionFlags, worldPriceTiltOf, PRICE_ADJUSTMENT_MIN, PRICE_ADJUSTMENT_MAX } from '../src/systems/shopStock.js';
import { REGION_COUNT, REGION_FLAGS, createRegionConditions, conditionFlag, turnOnConditionFlag } from '../src/systems/regionConditions.js';
import { ONLINE_EPOCH_MINUTES } from '../src/net/wire.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const EPOCH_DAY = Math.floor(ONLINE_EPOCH_MINUTES / MINUTES_PER_DAY);

test('ECON1: the world\'s index is a pure function of the day - the epoch day\'s opening indices are DFU\'s 750..1250 off the day\'s own generator, region-major; every later day is one step per region off that day\'s generator (the tilt at zero: 51/50 up on a passed roll, 49/50 down, clamped); a day before the epoch reads the epoch\'s; a cold answer equals a walked one (catching up equals having stayed)', () => {
  const p0 = worldRegionPricesOn(EPOCH_DAY);
  assert.equal(p0.length, REGION_COUNT);
  const init = dayRng(EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.priceInit);
  for (let i = 0; i < REGION_COUNT; i++) { const r = init(); assert.equal(p0[i], initialRegionPrice(r), `region ${i} opens off the epoch day's ${i}th draw`); assert.ok(p0[i] >= 750 && p0[i] <= 1250); }
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY - 100), p0, 'a day before the epoch reads the epoch\'s');
  // one step, by hand, region-major off the next day's generator
  const p1 = worldRegionPricesOn(EPOCH_DAY + 1);
  const gen = dayRng((EPOCH_DAY + 1) * MINUTES_PER_DAY, DAY_SALT.prices);
  for (let i = 0; i < REGION_COUNT; i++) assert.equal(p1[i], priceWalkStep(p0[i], 0, gen()), `region ${i} walked one step off the day's ${i}th draw`);
  assert.ok(p1.some((v, i) => v !== p0[i]), 'and the walk walked');
  // the step itself: DFU's arithmetic with the tilt at zero
  assert.equal(priceWalkStep(1000, 0, 0.49), 1020, 'a passed roll (49 < 50) rises 51/50');
  assert.equal(priceWalkStep(1000, 0, 0.5), 980, 'a failed roll (50 < 50 is false) falls 49/50');
  assert.equal(priceWalkStep(2000, 0, 0.09), 2040, 'at 2000 the chance is 10: 9 passes'); assert.equal(priceWalkStep(2000, 0, 0.1), 1960, '10 fails');
  assert.equal(priceWalkStep(1000, 20, 0.69), 1020, 'the player\'s own walk keeps its tilt (merchants 100 vs region 0: +20)');
  assert.equal(priceWalkStep(PRICE_ADJUSTMENT_MAX, 0, 0.0), 3920, 'at the ceiling a rise is impossible (chance -70) - the walk falls'); assert.equal(priceWalkStep(3960, 120, 0.0), PRICE_ADJUSTMENT_MAX, 'clamped high (a tilt large enough to pass: 4039 -> 4000)'); assert.equal(priceWalkStep(PRICE_ADJUSTMENT_MIN, 0, 0.99), PRICE_ADJUSTMENT_MIN, 'clamped low');
  // the cache: a far day walked forward, a nearer day rebuilt from the epoch - the same numbers either way
  const far = worldRegionPricesOn(EPOCH_DAY + 40).slice();
  const near = worldRegionPricesOn(EPOCH_DAY + 3).slice();
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY + 40), far, 'a day asked again after a rebuild is the same day');
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY + 3), near);
  assert.notDeepEqual(far, near);
  assert.equal(worldRegionPrice(5, (EPOCH_DAY + 40) * MINUTES_PER_DAY + 700), far[5], 'a minute of the day reads the day');
  assert.equal(worldRegionPrice(999, (EPOCH_DAY + 40) * MINUTES_PER_DAY), 1000, 'a region off the table reads the pivot');
  const a = dayRng(EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.priceInit)(), b = dayRng(EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.prices)(), c = dayRng(EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.conditions)();
  assert.ok(a !== b && b !== c && a !== c, 'the three consumers are salted apart (AUDIT WORLD6b C5)');
});

test('ECON1: the seam - with the shared clock installed regionPriceAdjustment answers the world\'s index for today, draws nothing from the player\'s dice and writes nothing to the player\'s regionPrices; the clock gone, the player\'s own lazy draw and state answer as before; the source can be handed in and taken away by hand', () => {
  const day = EPOCH_DAY + 12;
  const e = { regionPrices: {}, factionRep: { dict: new Map() } };
  let draws = 0; const dice = () => { draws++; return 0.5; };
  assert.equal(sharedClockOn(), false); assert.equal(worldPriceSourceOn(), false);
  try {
    setSharedClock(() => day * MINUTES_PER_DAY + 300);
    assert.equal(worldPriceSourceOn(), true, 'the clock installs the world\'s price source');
    assert.equal(regionPriceAdjustment(e, 17, dice), worldRegionPricesOn(day)[17], 'the world\'s index for today');
    assert.equal(draws, 0, 'no lazy draw off the player\'s dice'); assert.deepEqual(e.regionPrices, {}, 'nothing written');
    const other = { regionPrices: { 17: 4000 }, factionRep: { dict: new Map() } };
    assert.equal(regionPriceAdjustment(other, 17, dice), regionPriceAdjustment(e, 17, dice), 'whatever the player\'s own state says');
  } finally { setSharedClock(null); }
  assert.equal(worldPriceSourceOn(), false, 'the clock gone, the source goes');
  const own = regionPriceAdjustment(e, 17, dice);
  assert.equal(draws, 1, 'offline: the lazy draw'); assert.equal(own, initialRegionPrice(0.5)); assert.equal(e.regionPrices[17], own, 'and it is written');
  assert.equal(regionPriceAdjustment(e, 17, dice), own); assert.equal(draws, 1, 'once');
  setWorldPriceSource((i) => 1234 + i);
  try { assert.equal(regionPriceAdjustment(e, 3, dice), 1237, 'a source handed in by hand answers'); assert.equal(regionPriceAdjustment(e, 17, dice), 1251, 'over the player\'s own'); }
  finally { setWorldPriceSource(null); }
  assert.equal(regionPriceAdjustment(e, 17, dice), own, 'and taken away, the player\'s own again');
  setWorldPriceSource((i) => NaN);
  try { assert.equal(regionPriceAdjustment(e, 17, dice), own, 'a source answering no number is no source for that region'); } finally { setWorldPriceSource(null); }
  // AUDIT ALL E2: the player's own walk stands its table itself - under a source the seam's lazy init never runs
  setWorldPriceSource((i) => 1234);
  try {
    const fresh = {};
    const dict = new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 50 }], [9000, { id: 9000, type: FACTION_TYPES.Province, region: 0, power: 50 }]]);
    assert.doesNotThrow(() => updateRegionalPrices(fresh, dict, 1, () => 0.5, null), 'a walk on an entity with no table, a source standing: no throw');
    assert.equal(typeof fresh.regionPrices[0], 'number', 'the table stood and the region walked');
  } finally { setWorldPriceSource(null); }
});

test('ECON1: the day change online - the player\'s regionPrices are not walked and not written; the condition flags are the player\'s, applied from the world\'s index one day at a time with the day\'s own generator (PricesHigh over 2000, PricesLow under 500, the normal band clearing both); offline DFU\'s own walk, tilt and all, writes the player\'s state', () => {
  const dict = () => new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 100 }], [9000, { id: 9000, type: FACTION_TYPES.Province, region: 0, power: 0 }], [9001, { id: 9001, type: FACTION_TYPES.Province, region: 1, power: 50 }]]);
  const day = EPOCH_DAY + 5;
  const cond = () => createRegionConditions();
  try {
    setSharedClock(() => day * MINUTES_PER_DAY);
    const e = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() }, regionConditions: cond() };
    // flags left standing from another day (or a save): the world's index today is in the normal band for every
    // region (the epoch's 750..1250 walked five days stays inside 500..2000), so the day change must CLEAR them
    turnOnConditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh, () => 0.5); turnOnConditionFlag(e.regionConditions, 1, REGION_FLAGS.PricesLow, () => 0.5);
    turnOnConditionFlag(e.regionConditions, 5, REGION_FLAGS.PricesHigh, () => 0.5);   // AUDIT ALL E8: region 5 has no Province faction in this store - DFU's walk never reaches it
    assert.equal(conditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh), true);
    runDayChange({ entity: e, lastMinutes: (day - 3) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.99 });
    assert.equal(conditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh), false, 'the flag half ran off the world\'s index: the normal band cleared a standing PricesHigh');
    assert.equal(conditionFlag(e.regionConditions, 1, REGION_FLAGS.PricesLow), false, 'and a standing PricesLow');
    assert.equal(conditionFlag(e.regionConditions, 5, REGION_FLAGS.PricesHigh), true, 'AUDIT ALL E8: a region with no Province faction is not walked and not flagged - its standing flag stands (DFU\'s `continue`)');
    assert.deepEqual(e.regionPrices, { 0: 1000 }, 'not walked, not written');
    // the flags: a crafted index over 2000 on the world's day raises PricesHigh through the one flag home
    const prices = worldRegionPricesOn(day);
    for (const i of [0, 1]) {   // the regions this player's store has a Province faction for (AUDIT ALL E8: DFU walks and flags no other)
      const high = conditionFlag(e.regionConditions, i, REGION_FLAGS.PricesHigh), low = conditionFlag(e.regionConditions, i, REGION_FLAGS.PricesLow);
      assert.equal(high, prices[i] > 2000, `region ${i}: PricesHigh follows the world's index`); assert.equal(low, prices[i] < 500, `region ${i}: PricesLow follows the world's index`);
    }
    // the flag half by hand, off the world's index: the three arms
    const store = cond();
    applyPriceConditionFlags(store, 4, 2100, () => 0.5); assert.equal(conditionFlag(store, 4, REGION_FLAGS.PricesHigh), true, 'over 2000: PricesHigh on');
    applyPriceConditionFlags(store, 4, 1000, () => 0.5); assert.equal(conditionFlag(store, 4, REGION_FLAGS.PricesHigh) || conditionFlag(store, 4, REGION_FLAGS.PricesLow), false, 'the normal band clears both');
    applyPriceConditionFlags(store, 4, 400, () => 0.5); assert.equal(conditionFlag(store, 4, REGION_FLAGS.PricesLow), true, 'under 500: PricesLow on');
    applyPriceConditionFlags(null, 4, 400, () => 0.5);   // no store: nothing, no throw
    // two players, different spans, one store shape: the same flags
    const f = { regionPrices: {}, factionRep: { dict: dict() }, regionConditions: cond() };
    runDayChange({ entity: f, lastMinutes: (day - 1) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.01 });
    const pair = (st) => [0, 1].map((i) => [conditionFlag(st, i, REGION_FLAGS.PricesHigh), conditionFlag(st, i, REGION_FLAGS.PricesLow)]);   // the regions the store walks
    assert.deepEqual(pair(f.regionConditions), pair(e.regionConditions), 'one day walked and three walked read the same flags today');
  } finally { setSharedClock(null); }
  // offline: DFU's own, the tilt included (merchants 100 vs region 0: +20 on the chance), the state written
  const off = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() }, regionConditions: cond() };
  runDayChange({ entity: off, lastMinutes: (day - 1) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.69 });
  assert.equal(off.regionPrices[0], 1020, 'offline the tilt carries a 69 (chance 70) up - the player\'s own walk, written');
  const off2 = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() } };
  updateRegionalPrices(off2, dict(), 2, () => 0.69, null);
  assert.equal(off2.regionPrices[0], Math.trunc(51 * 1020 / 50), 'and DFU\'s span-whole loop through the one step');
});

test('ECON1 by source: the shared clock installs and removes the world\'s price source; the player\'s walk and the world\'s share one step and one flag home; every consumer reads through regionPriceAdjustment (no host reads regionPrices directly); the powers keep their own law; the wire is untouched', () => {
  const w = rd('src/systems/worldTick.js'), sh = rd('src/systems/shopStock.js');
  assert.ok(w.includes("setWorldPriceSource(_sharedClock ? (regionIndex) => worldRegionPrice(regionIndex, _sharedClock()) : null);"), 'installed beside the clock, removed with it');
  assert.ok(w.includes("const ECON_EPOCH_DAY = Math.floor(ONLINE_EPOCH_MINUTES / MINUTES_PER_DAY);"), 'the world\'s economy begins on the online world\'s epoch day (WORLD5\'s)');
  assert.ok(w.includes("const prices = _worldPrices.prices.map((adj, i) => { const roll = gen(); const tilt = _worldTilt ? _worldTilt(i) : 0; return tilt == null ? adj : priceWalkStep(adj, tilt, roll); });"), 'the world\'s step through the one home, tilted by the base powers, a roll drawn for every region and spent only where DFU walks');
  assert.ok(rd('src/scenes/world.js').includes("if (onlineOn) townTalk.ensureFactions?.().then(() => { if (townTalk.factionDict) setWorldPriceTilt(worldPriceTiltOf(townTalk.factionDict)); }).catch(() => {});"), 'AUDIT ALL E1: the host installs the tilt off the FILE\'s dict once FACTION.TXT is read, online alone');
  assert.ok(sh.includes("const adjusted = priceWalkStep(adj, Math.trunc((merchants.power - regionFaction.power) / 5), rolls());"), 'the player\'s step through the same home, tilted');
  assert.ok(sh.includes("applyPriceConditionFlags(conditions, i, adjusted, rolls);"), 'the flag half, one home');
  assert.equal((sh.match(/Math\.trunc\(51 \* adj \/ 50\)/g) ?? []).length, 1, 'the 51/50 arithmetic has one home');
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/ui/nativeTrade.js', 'src/systems/tradeModes.js', 'src/systems/guildServiceActions.js', 'src/systems/repairService.js', 'src/systems/quest/machine.js']) {
    assert.equal(/regionPrices\[/.test(rd(f)), false, `${f} reads the region\'s index through the seam, never the player\'s table`);
  }
  assert.match(w, /const dayRolls = dayRollsFor\(i, rolls, DAY_SALT\.powers\);\s*if \(i % FACTION_POWER_INTERVAL_MINUTES === 0\) \{/, 'the powers walk as WORLD6b left them: the day\'s rolls, the player\'s state');
  assert.ok(rd('src/net/wire.js').includes("export const RELAY_VERSION = 'world85'"), 'no wire change of this slice\'s: the economy is computed, not streamed (world84 was RELAY-H1\'s, world85 is ACC1d\'s token field)');
});

test('ECON1 (AUDIT ALL E1): THE WORLD\'S TILT - the base powers of the game\'s own file tilt the world\'s walk as they tilt DFU\'s (trunc((merchants - province) / 5)); a region with no Province faction stands still and a world with no Merchants stands whole, the day\'s rolls drawn all the same; a tilt strong enough lights PricesHigh and PricesLow at the player\'s store - one day at a time (the flag\'s duration is the day it lit on) and for the last region too; installing the tilt starts the world over, removing it returns the untilted walk', () => {
  const base = new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 100 }]]);
  // synthetic powers past the game's 0..100 so the crossings come inside the pin's patience: region 0 pulled up hard (+60: the
  // walk's equilibrium at 2500, over the PricesHigh line), region 1 pulled down hard (-70: equilibrium 250, under PricesLow),
  // the rest flat (0), region 7 with no Province faction at all. DFU's own +-20 makes the flags rare, as they are in DFU.
  for (let i = 0; i < REGION_COUNT; i++) if (i !== 7) base.set(9000 + i, { id: 9000 + i, type: FACTION_TYPES.Province, region: i, power: i === 0 ? -200 : (i === 1 ? 450 : 100) });
  const tilt = worldPriceTiltOf(base);
  assert.equal(tilt(0), 60); assert.equal(tilt(1), -70); assert.equal(tilt(2), 0); assert.equal(tilt(7), null, 'no Province faction: DFU walks nothing there');
  assert.equal(worldPriceTiltOf(new Map([[MERCHANTS_FACTION_ID, { power: 40 }], [9003, { type: FACTION_TYPES.Province, region: 3, power: 62 }]]))(3), Math.trunc((40 - 62) / 5), 'DFU\'s own arithmetic: trunc toward zero');
  assert.equal(worldPriceTiltOf(new Map())(0), null, 'no Merchants: DFU walks nothing anywhere'); assert.equal(worldPriceTiltOf(null)(0), null);
  const flat = worldRegionPricesOn(EPOCH_DAY + 30).slice();
  try {
    setWorldPriceTilt(tilt);
    assert.equal(worldPriceTiltOn(), true);
    assert.notDeepEqual(worldRegionPricesOn(EPOCH_DAY + 30), flat, 'installing the tilt starts the world over: the day just cached is walked again, tilted');
    const p0 = worldRegionPricesOn(EPOCH_DAY), p1 = worldRegionPricesOn(EPOCH_DAY + 1);
    const gen = dayRng((EPOCH_DAY + 1) * MINUTES_PER_DAY, DAY_SALT.prices);
    for (let i = 0; i < REGION_COUNT; i++) { const roll = gen(); assert.equal(p1[i], i === 7 ? p0[i] : priceWalkStep(p0[i], tilt(i), roll), `region ${i}: one step off the day's ${i}th draw with its own tilt, none for a region DFU skips`); }
    const p30 = worldRegionPricesOn(EPOCH_DAY + 30);
    assert.notDeepEqual(p30, flat, 'the tilt is part of every step'); assert.equal(p30[7], p0[7], 'region 7 never moves');
    assert.ok(p30[0] > p30[1], 'pulled up beats pulled down over a month');
    // the flags light, at the player's store, one day at a time: find the first day region 0 crosses 2000
    let d0 = EPOCH_DAY + 1; while (worldRegionPricesOn(d0)[0] <= 2000 && d0 < EPOCH_DAY + 400) d0++;
    assert.ok(d0 < EPOCH_DAY + 400, `region 0 crosses 2000 within a year at +60: day ${d0 - EPOCH_DAY}`);
    let d1 = EPOCH_DAY + 1; while (worldRegionPricesOn(d1)[1] >= 500 && d1 < EPOCH_DAY + 400) d1++;
    assert.ok(d1 < EPOCH_DAY + 400, 'and region 1 falls under 500');
    const store = new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 50 }], [9000, { id: 9000, type: FACTION_TYPES.Province, region: 0, power: 50 }], [9001, { id: 9001, type: FACTION_TYPES.Province, region: 1, power: 50 }], [9061, { id: 9061, type: FACTION_TYPES.Province, region: 61, power: 50 }]]);
    setSharedClock(() => d0 * MINUTES_PER_DAY);
    try {
      const stayed = { regionPrices: {}, factionRep: { dict: store }, regionConditions: createRegionConditions() };
      runDayChange({ entity: stayed, lastMinutes: (d0 - 1) * MINUTES_PER_DAY, nowMinutes: d0 * MINUTES_PER_DAY, rolls: () => 0.5 });
      assert.equal(conditionFlag(stayed.regionConditions, 0, REGION_FLAGS.PricesHigh), true, 'PricesHigh lights at the player\'s store off the world\'s index');
      const away = { regionPrices: {}, factionRep: { dict: store }, regionConditions: createRegionConditions() };
      runDayChange({ entity: away, lastMinutes: (d0 - 3) * MINUTES_PER_DAY, nowMinutes: d0 * MINUTES_PER_DAY, rolls: () => 0.5 });
      assert.equal(conditionFlag(away.regionConditions, 0, REGION_FLAGS.PricesHigh), true);
      assert.equal(away.regionConditions[0].values[REGION_FLAGS.PricesHigh], stayed.regionConditions[0].values[REGION_FLAGS.PricesHigh], 'one day at a time: the flag lit on the day it crossed, with that day\'s duration draw, for the player who was away as for the one who stayed');
      assert.deepEqual(stayed.regionPrices, {}, 'and no price of the player\'s was written');
    } finally { setSharedClock(null); }
    // the last region: a tilt on 61 alone, a crossing, a flag
    const only61 = (i) => (i === 61 ? 60 : 0);
    setWorldPriceTilt(only61);
    let d61 = EPOCH_DAY + 1; while (worldRegionPricesOn(d61)[61] <= 2000 && d61 < EPOCH_DAY + 400) d61++;
    assert.ok(d61 < EPOCH_DAY + 400);
    setSharedClock(() => d61 * MINUTES_PER_DAY);
    try {
      const e = { regionPrices: {}, factionRep: { dict: store }, regionConditions: createRegionConditions() };
      runDayChange({ entity: e, lastMinutes: (d61 - 1) * MINUTES_PER_DAY, nowMinutes: d61 * MINUTES_PER_DAY, rolls: () => 0.5 });
      assert.equal(conditionFlag(e.regionConditions, 61, REGION_FLAGS.PricesHigh), true, 'the last region is walked and flagged too');
    } finally { setSharedClock(null); }
  } finally { setWorldPriceTilt(null); }
  assert.equal(worldPriceTiltOn(), false);
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY + 30), flat, 'the tilt removed, the untilted walk again - from the epoch');
});

test('ECON1 (AUDIT ALL E4): a rebuild is bounded - a checkpoint every 512 days, so a day asked behind the cache walks from the newest checkpoint at or before it, and the numbers are the epoch walk\'s', () => {
  const far = worldRegionPricesOn(EPOCH_DAY + 1100).slice();
  const t0 = process.hrtime.bigint();
  const back = worldRegionPricesOn(EPOCH_DAY + 1030).slice();   // behind the cache, past two checkpoints
  const dt = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY + 1100), far, 'walked on from the checkpoint, the far day agrees');
  setWorldPriceTilt(null);   // starts the world over: no checkpoints
  assert.deepEqual(worldRegionPricesOn(EPOCH_DAY + 1030), back, 'the checkpoint walk equals the epoch walk');
  assert.ok(dt < 50, `a rebuild behind the cache is a checkpoint away, not the epoch (${dt.toFixed(1)} ms)`);
  worldRegionPricesOn(EPOCH_DAY + 1100);
  assert.deepEqual(worldPriceCheckpointDays(), [512, 1024], 'a checkpoint every 512 days of the walk so far (the epoch is day 363)');
  setWorldPriceTilt(null);
  assert.deepEqual(worldPriceCheckpointDays(), [], 'starting the world over drops them');
});

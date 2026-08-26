// AUDIT 26, wave "magic-save": the enchanting/effect/save seams whose
// PORT and SOURCE had drifted apart. Every pin below reads the DFU
// law (MIT, Daggerfall Workshop), not the port's previous shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads, enchantmentMagicRound,
  computeEnchantmentMods, enchantWeightAllowanceMult, classicEnchantmentType,
  LEECH_CAST_AMOUNT, LEECH_WEAPON_AMOUNT,
} from '../src/systems/enchantments.js';
import { applyEnchantments } from '../src/systems/enchanting.js';
import { enchantmentSettings } from '../src/systems/enchantmentCatalogue.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';
import { entityMaxEncumbrance, maxEncumbrance } from '../src/combat/formulas.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { applySpell } from '../src/systems/effects.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const it = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type, param }], ...over,
});
const wearer = (items, over = {}) => ({
  name: 'W', health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: [40, 40, 40, 40], ...over,
});
const rounds = (w, ctx, n = 8) => { for (let r = 1; r <= n; r++) enchantmentMagicRound(w, r, ctx ? { ctx } : {}); };

// --------------------------------------------------------------- F118
test('audit26 magic-save: ItemDeteriorates params are AllTheTime=0 / InSunlight=1 / InHolyPlaces=2', () => {
  // ItemDeteriorates.cs:112-117 `enum Params { AllTheTime = 0,
  // InSunlight = 1, InHolyPlaces = 2 }` and MagicRound's only
  // conditional return (:87-89) is
  //   `param == InSunlight && !IsPlayerInSunlight ||
  //    param == InHolyPlaces && !IsPlayerInHolyPlace`
  // so AllTheTime carries no condition and bites everywhere. The
  // classicParamCosts comments (:119-124) name the same order the
  // catalogue carries: 'all the time', 'in sunlight', 'in holy places'.

  // AllTheTime (0): no seam mounted at all, and it still degrades
  // 1 point every conditionLossPerRounds = 4 rounds.
  const all = it(T.ItemDeteriorates, 0);
  rounds(wearer([all]), null);
  assert.equal(all.currentCondition, 98, 'AllTheTime (0) degrades unconditionally');

  // InSunlight (1): idle in the dark, biting in the sun, and DEAF to
  // the holy-place seam.
  const sunIdle = it(T.ItemDeteriorates, 1);
  rounds(wearer([sunIdle]), { inSunlight: () => false, inHolyPlace: () => true });
  assert.equal(sunIdle.currentCondition, 100, 'InSunlight (1) idles out of the sun - a holy place is not its seam');
  const sunBites = it(T.ItemDeteriorates, 1);
  rounds(wearer([sunBites]), { inSunlight: () => true });
  assert.equal(sunBites.currentCondition, 98);

  // InHolyPlaces (2) - the param four soul-bound sets force
  // (Daedroth, FrostDaedra, Ghost, Wraith).
  const holyIdle = it(T.ItemDeteriorates, 2);
  rounds(wearer([holyIdle]), { inSunlight: () => true, inHolyPlace: () => false });
  assert.equal(holyIdle.currentCondition, 100, 'InHolyPlaces (2) idles outside one, sunlight or not');
  const holyBites = it(T.ItemDeteriorates, 2);
  rounds(wearer([holyBites]), { inHolyPlace: () => true });
  assert.equal(holyBites.currentCondition, 98);
});

// --------------------------------------------------------------- F119
test('audit26 magic-save: HealthLeech params are WheneverUsed=0 / UnlessUsedDaily=1 / UnlessUsedWeekly=2', () => {
  // HealthLeech.cs:132-136 `enum Params { WheneverUsed,
  // UnlessUsedDaily, UnlessUsedWeekly }` - the use/strike bill fires
  // at `type == Params.WheneverUsed` (:84-89) and the idle drain
  // switches on UnlessUsedDaily / UnlessUsedWeekly (:106-113).

  // WheneverUsed (0) bills leechCastAmount on a use and
  // leechWeaponAmount on a strike.
  const billed = [];
  const whenever = it(T.HealthLeech, 0);
  const ctx = { hurtSelf: (n) => billed.push(n) };
  doItemEnchantmentPayloads(PAYLOAD.Used, whenever, { entity: wearer([]), ctx, nowMinutes: 500 });
  doItemEnchantmentPayloads(PAYLOAD.Strikes, whenever, { entity: wearer([]), target: { mobileType: 3 }, ctx, nowMinutes: 500 });
  assert.deepEqual(billed, [LEECH_CAST_AMOUNT, LEECH_WEAPON_AMOUNT]);
  assert.equal(whenever.timeHealthLeechLastUsed, 500, 'the stamp fires on both, before any param logic (:78-79)');

  // ...and the two TIMED params bill nothing on use or strike.
  for (const param of [1, 2]) {
    const quiet = [];
    const timed = it(T.HealthLeech, param);
    doItemEnchantmentPayloads(PAYLOAD.Used, timed, { entity: wearer([]), ctx: { hurtSelf: (n) => quiet.push(n) }, nowMinutes: 500 });
    doItemEnchantmentPayloads(PAYLOAD.Strikes, timed, { entity: wearer([]), target: { mobileType: 3 }, ctx: { hurtSelf: (n) => quiet.push(n) }, nowMinutes: 500 });
    assert.deepEqual(quiet, [], `param ${param} is a timed drain, not a use bill`);
  }

  // The idle drain: minutesSinceLastUsed > MinutesPerDay for
  // UnlessUsedDaily (1), > MinutesPerDay * DaysPerWeek for
  // UnlessUsedWeekly (2), 1 health every timeLeechPerRounds = 4.
  const leech = (param, nowMinutes) => {
    const hurt = [];
    const item = it(T.HealthLeech, param, { timeHealthLeechLastUsed: 0 });
    enchantmentMagicRound(wearer([item]), 4, { nowMinutes, ctx: { hurtSelf: (n) => hurt.push(n) } });
    return hurt;
  };
  assert.deepEqual(leech(1, MINUTES_PER_DAY - 1), [], 'daily: silent inside the day');
  assert.deepEqual(leech(1, MINUTES_PER_DAY + 1), [1], 'daily: bites past it');
  assert.deepEqual(leech(2, MINUTES_PER_DAY + 1), [], 'weekly: a day is not a week');
  assert.deepEqual(leech(2, MINUTES_PER_DAY * 7 + 1), [1], 'weekly: bites past the week');
  assert.deepEqual(leech(0, MINUTES_PER_DAY * 7 + 1), [], 'WheneverUsed never drains on the clock');
});

// --------------------------------------------------------------- F120
test('audit26 magic-save: SetEnchantments runs the Enchanted payloads, stores the CLASSIC TYPE and unequips', () => {
  // DaggerfallUnityItem.cs:1289-1300 fires EnchantmentPayloadCallback(
  // Enchanted, param, null, null, this) for every settings row whose
  // effect carries the flag; :1316-1320 stores settings.ClassicType
  // (the NUMBER) on the item; :1338-1341 unequips it - "entity must
  // equip again. This ensures 'on equip' effect payloads execute
  // correctly".
  const mint = (over = {}) => ({
    name: 'Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
    weightInKg: 1, currentCondition: 100, maxCondition: 100, ...over,
  });

  // FeatherWeight: the ONE write the effect ever makes (FeatherWeight.cs
  // - weight goes to 0.25kg), and it happens here or nowhere.
  const owner = wearer([], { isPlayer: true });
  const feather = mint();
  owner.items.push(feather);
  equipItem(owner, feather);
  assert.equal(isEquipped(feather), true);
  applyEnchantments(feather, [enchantmentSettings('FeatherWeight')], { owner, nowMinutes: 4321 });
  assert.equal(feather.weightInKg, 0.25, 'the Enchanted payload ran');
  assert.equal(isEquipped(feather), false, 'UnequipItem(owner)');
  assert.deepEqual(feather.enchantments.map((e) => e.type), [T.FeatherWeight],
    'the stored row is the CLASSIC TYPE (11), not the effect key');
  assert.equal(classicEnchantmentType('FeatherWeight'), 11);

  // ExtraWeight quadruples it (ExtraWeight.cs).
  const heavy = mint({ weightInKg: 3 });
  applyEnchantments(heavy, [enchantmentSettings('ExtraWeight')]);
  assert.equal(heavy.weightInKg, 12);

  // HealthLeech starts its clock at the moment of enchanting, so a
  // fresh UnlessUsedDaily item does not leech out of the gate.
  const fresh = mint();
  applyEnchantments(fresh, [enchantmentSettings('HealthLeech', 1)], { nowMinutes: 4321 });
  assert.equal(fresh.timeHealthLeechLastUsed, 4321);
  fresh.equipSlot = 9;
  const hurt = [];
  enchantmentMagicRound(wearer([fresh]), 4, { nowMinutes: 4321 + MINUTES_PER_DAY - 1, ctx: { hurtSelf: (n) => hurt.push(n) } });
  assert.deepEqual(hurt, [], 'a just-made daily item is inside its own first day');

  // A null owner is SetEnchantments' default (:1271) - nothing to
  // unequip, and the payloads still run.
  const orphan = mint();
  assert.doesNotThrow(() => applyEnchantments(orphan, [enchantmentSettings('FeatherWeight')]));
  assert.equal(orphan.weightInKg, 0.25);
});

// --------------------------------------------------------------- F193
test('audit26 magic-save: GetMaxEncumbrance adds the IncreasedWeightAllowance multiplier', () => {
  // DaggerfallEntity.cs:501-507
  //   int amount = FormulaHelper.MaxEncumbrance(stats.LiveStrength);
  //   if (IncreasedWeightAllowanceMultiplier > 0)
  //       amount += (int)(amount * IncreasedWeightAllowanceMultiplier);
  const base = maxEncumbrance(55);
  assert.equal(base, 82);
  assert.equal(entityMaxEncumbrance({ stats: { strength: 55 }, items: [] }), 82, 'no enchantment, no addition');

  const quarter = { stats: { strength: 55 }, items: [it(T.IncreasedWeightAllowance, 0)] };
  computeEnchantmentMods(quarter, {});
  assert.equal(enchantWeightAllowanceMult(quarter), 0.25);
  assert.equal(entityMaxEncumbrance(quarter), 102, '82 + (int)(82 * 0.25) = 82 + 20');

  const half = { stats: { strength: 55 }, items: [it(T.IncreasedWeightAllowance, 1)] };
  computeEnchantmentMods(half, {});
  assert.equal(enchantWeightAllowanceMult(half), 0.5);
  assert.equal(entityMaxEncumbrance(half), 123, '82 + (int)(82 * 0.5) = 82 + 41');

  // And the READERS: everything holding a live entity reads the
  // entity ceiling (PlayerEntity.MaxEncumbrance), while the chargen
  // bonus screen reads the raw formula off working stats
  // (CreateCharAddBonusStats.cs:157) because there is no entity yet.
  assert.match(rd('src/ui/charsheet.js'), /entityMaxEncumbrance\(e\)/);
  // U56 moved TransferItem's ladder out of the classic window, so the
  // CARRY GATE this pin was sweeping for went with it - and so did
  // this line, to the file that now holds it. The enhanced pack and
  // the enhanced sheet mirror the two windows above and read the same
  // ceiling; they were written against the pre-audit formula and are
  // swept here so they cannot drift back to it.
  assert.match(rd('src/systems/itemTransfer.js'), /entityMaxEncumbrance\(entity\)/);
  assert.ok(!/maxEncumbrance\(liveStat\(/.test(rd('src/systems/itemTransfer.js')),
    'the bare strength formula is back in the carry gate');
  for (const f of ['src/ui/enhancedInventory.js', 'src/ui/enhancedCharSheet.js']) {
    assert.match(rd(f), /entityMaxEncumbrance\(/, `${f} reads the bare formula`);
    assert.ok(!/maxEncumbrance\(liveStat\(|maxEncumbrance\(strength\)/.test(rd(f)),
      `${f} still has the pre-audit formula in it`);
  }
  const wm = rd('src/scenes/worldModes.js');
  assert.equal((wm.match(/entityMaxEncumbrance\(playerEntity\)/g) ?? []).length, 2,
    'the trade weight seam and the letter-of-credit gate both read the entity ceiling');
  assert.match(rd('src/ui/chargen.js'), /maxEncumbrance\(st\.strength\)/);
});

// --------------------------------------------------------------- F098
test('audit26 magic-save: a map-pixel change clears the non-permanent scene cache', () => {
  // PlayerGPS.Update (:329-339): on every map-pixel change,
  //   // Clear non-permanent scenes from cache, unless going to/from
  //   // owned ship
  //   DFPosition shipCoords = DaggerfallBankManager.GetShipCoords();
  //   if (shipCoords == null || (!(pos.X == shipCoords.X && ...) &&
  //       !(lastMapPixelX == shipCoords.X && ...)))
  //       SaveLoadManager.ClearSceneCache(false);
  // The port's streaming host IS its PlayerGPS: state.update answers
  // pixelChanged, and state.current is overwritten in the call, so the
  // departure pixel is captured first.
  const t = rd('src/scenes/world.js');
  assert.match(t, /const wasMapPixel = \{ x: state\.current\.x, y: state\.current\.y \};/);
  const i = t.indexOf('if (r.pixelChanged) {');
  assert.ok(i > 0);
  const arm = t.slice(i, i + 1600);
  assert.match(arm, /const ship = shipCoords\(playerEntity\);/);
  assert.match(arm, /r\.current\.x === ship\.x && r\.current\.y === ship\.y/);
  assert.match(arm, /wasMapPixel\.x === ship\.x && wasMapPixel\.y === ship\.y/);
  assert.match(arm, /if \(!toOrFromShip && playerEntity\.sceneCache\) \{\s*\n\s*clearSceneCache\(playerEntity\.sceneCache, \{ start: false \}\);/,
    'ClearSceneCache(false) - the WORLD-MOVE arm, which keeps the permanent scenes');

  // The ship exception is the only skip, and `false` is the arm that
  // keeps permanent scenes (ClearSceneCache(true) is the new-game one).
  assert.equal(/clearSceneCache\(playerEntity\.sceneCache, \{ start: true \}\)/.test(arm), false);
});

// --------------------------------------------------------------- F076
test('audit26 magic-save: a restored save lifts the bundle counter past its high water mark', () => {
  // DFU has no counter to collide with - LiveEffectBundle is an object
  // reference re-instanced on load. The port numbers bundles from a
  // module-scope counter that starts at 0 in a fresh process, so
  // without the seed the first cast after a load reuses a restored
  // id: liveBundles merges the two casts into one HUD row and
  // dispelBundle strips both.
  const carrier = {
    name: 'Mac', stats: { willpower: 50 }, skills: [], skillUses: [], items: [], spells: [],
    health: 20, maxHealth: 20,
    activeEffects: [{ kind: 'slowfall', roundsRemaining: 4, bundleId: 7, bundleName: 'Old Cast', bundleType: 'Spell' }],
  };
  const dst = {};
  assert.ok(restorePlayer(dst, snapshotPlayer(carrier)));
  assert.equal(dst.activeEffects[0].bundleId, 7, 'the restored cast keeps its id');

  const cont = {
    type: 1, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1,
    magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0,
    durationBase: 4, durationMod: 0, durationPerLevel: 0,
  };
  dst.career ??= {};
  applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, dst, { hurt: () => {} }, () => 0.99);
  const minted = dst.activeEffects.filter((a) => a.bundleId !== 7).map((a) => a.bundleId);
  assert.ok(minted.length > 0, 'the cast landed');
  assert.deepEqual([...new Set(minted)], [8], 'the next id is ONE PAST the restored high water mark, never a reuse');
});

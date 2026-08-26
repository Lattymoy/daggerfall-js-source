// AUDIT 26, wave "magic-save": the enchanting/effect/save seams whose
// PORT and SOURCE had drifted apart. Every pin below reads the DFU
// law (MIT, Daggerfall Workshop), not the port's previous shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads, enchantmentMagicRound,
  computeEnchantmentMods, enchantWeightAllowanceMult, classicEnchantmentType,
  enchantArmorMod, enchantChanceToHitMod,
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
  assert.match(rd('src/ui/nativeInventory.js'), /entityMaxEncumbrance\(e\)/);
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

// ===================================================================
// AUDIT 26 PARITY, wave "magic": the saving-throw and armour-channel
// laws below are read off EntityEffect.cs / EntityEffectManager.cs /
// DaggerfallEntity.cs, never off the port's previous shape.
// ===================================================================

/** A rolls() that plays a fixed script and then answers 0.99 (a
 *  Dice100 of 100 - the roll that fails every saving throw). */
const seq = (...rs) => { let i = 0; return () => (i < rs.length ? rs[i++] : 0.99); };
const blankEffect = {
  magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1,
  chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
};
const foeTarget = (over = {}) => ({
  stats: { luck: 50, willpower: 50 }, skills: [], career: {}, activeEffects: [],
  level: 1, health: 40, maxHealth: 40, mobileType: 0, ...over,
});

// --------------------------------------------------------------- F071
test('audit26 magic: BypassSavingThrows never reaches GetMagnitude - a bypassed magnitude cast is still save-scaled', () => {
  // EntityEffect.cs:804-806 is the WHOLE gate on the magnitude scale:
  //     if (ParentBundle.targetType != TargetTypes.CasterOnly)
  //         magnitude = FormulaHelper.ModifyEffectAmount(this, ..., magnitude);
  // AssignBundleFlags.BypassSavingThrows appears nowhere in it, nor in
  // ModifyEffectAmount (FormulaHelper.cs:1575-1583). The flag gates the
  // reflection and resistance rungs (EEM:521,:525) and the ASSIGN-TIME
  // no-magnitude save (:565-568) - three saves, and the flag reaches
  // two of them. Quest casts (QuestResourceBehaviour.cs:346) set it, so
  // a quest-queued Damage Health lands scaled in DFU.
  const dmg = { ...blankEffect, type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20 };
  // roll 0.49 -> Dice100 50. saving = 50 + MagicResist(willpower 50) = 55,
  // and 55-20 <= 50 <= 55, so the prorated percent is 100 - 5*(55-50) = 75.
  const scaled = Math.trunc(20 * 75 / 100);
  assert.equal(scaled, 15);

  const bypassed = applySpell({ element: 0, rangeType: 1, effects: [dmg] }, 1, foeTarget(), {}, () => 0.49, null, { bypassSavingThrows: true });
  assert.equal(bypassed.damage, scaled, 'a BYPASSED non-CasterOnly cast is still scaled by the target save');
  const plain = applySpell({ element: 0, rangeType: 1, effects: [dmg] }, 1, foeTarget(), {}, () => 0.49, null, {});
  assert.equal(plain.damage, scaled, 'and an ordinary cast scales identically - the flag changes nothing here');
  const selfCast = applySpell({ element: 0, rangeType: 0, effects: [dmg] }, 1, foeTarget(), {}, () => 0.49, null, {});
  assert.equal(selfCast.damage, 20, 'CasterOnly is the one gate GetMagnitude does have');
});

// --------------------------------------------------------------- F073
test('audit26 magic: Pacify and Charm take AssignBundle\'s no-magnitude saving throw after the chance gate', () => {
  // PacifyEffect.cs:59-66 and CharmEffect.cs:33-44: SupportChance only,
  // no SupportMagnitude, TargetFlags_Other, BypassSavingThrows never
  // set, and neither is an IncumbentEffect - so EEM:561-579 rolls the
  // target's save on every non-CasterOnly cast and drops the effect
  // whole on a full save. Chance first (:531-551), then the save.
  const pacify = { ...blankEffect, type: 33, subType: 0, chanceBase: 100 };
  const charm = { ...blankEffect, type: 34, subType: 255, chanceBase: 100 };
  const spell = (e) => ({ element: 0, rangeType: 1, effects: [e] });

  // chance 0.99 passes; save 0.0 is a Dice100 of 1 - a FULL save
  const saved = applySpell(spell(pacify), 1, foeTarget(), {}, seq(0.99, 0.0), null, {});
  assert.equal(saved.pacify, undefined, 'a made save drops Pacify whole');
  assert.equal(saved.saved, 1, '"Save versus spell made."');
  assert.equal(saved.chanceFailed, undefined, 'the chance gate passed - these are two independent gates');

  const landed = applySpell(spell(pacify), 1, foeTarget(), {}, seq(0.99, 0.99), null, {});
  assert.equal(landed.pacify, true, 'a failed save lets it land');
  assert.equal(landed.saved, undefined);

  const charmSaved = applySpell(spell(charm), 1, foeTarget({ mobileType: 140 }), {}, seq(0.99, 0.0), null, {});
  assert.equal(charmSaved.pacify, undefined);
  assert.equal(charmSaved.saved, 1, 'Charm saves on the same law');

  // and the assign-time save IS the one BypassSavingThrows suppresses
  const bypassed = applySpell(spell(pacify), 1, foeTarget(), {}, seq(0.99, 0.0), null, { bypassSavingThrows: true });
  assert.equal(bypassed.pacify, true, 'EEM:565 - the no-magnitude save is the flag\'s own gate');

  // a CasterOnly cast is never saved against (:568)
  const selfCast = applySpell({ element: 0, rangeType: 0, effects: [pacify] }, 1, foeTarget(), {}, seq(0.99, 0.0), null, {});
  assert.equal(selfCast.pacify, true);
});

// --------------------------------------------------------------- F072
test('audit26 magic: Soul Trap rolls the no-magnitude saving throw, and "Trap active." is spoken before it', () => {
  // SoulTrap.cs:33-38 declares SupportDuration + SupportChance and NO
  // magnitude, is TargetFlags_Other and never sets BypassSavingThrows,
  // so EEM:561-579 applies. ChanceSuccess is hardcoded true (:47-52),
  // which leaves the save as the only gate a monster gets. The message
  // comes from BecomeIncumbent, which IncumbentEffect.AttachHost runs
  // inside Start (EEM:529) - BEFORE the save at :565.
  const trap = { ...blankEffect, type: 12, subType: 255, durationBase: 10, chanceBase: 50 };
  const spell = { element: 0, rangeType: 1, effects: [trap] };

  const saved = applySpell(spell, 1, foeTarget(), {}, seq(0.0), null, {});
  assert.equal(saved.saved, 1, 'a full save drops the trap');
  assert.equal(saved.trapAlert, 'trapActive', 'and "Trap active." was already printed by Start - verbatim quirk');
  assert.equal(saved.buffs, undefined);

  const target = foeTarget();
  const landed = applySpell(spell, 1, target, {}, seq(0.99), null, {});
  assert.equal(landed.saved, undefined);
  assert.deepEqual(target.activeEffects.map((a) => a.kind), ['soulTrap']);

  // an AddState stack never reaches the save: AssignBundle's :553-559
  // incumbent gate has already continued past it
  const stacked = applySpell(spell, 1, target, {}, seq(0.0), null, {});
  assert.equal(stacked.saved, undefined, 'a stack is not saved against');
  assert.equal(target.activeEffects.length, 1);
});

// --------------------------------------------------------------- F074
test('audit26 magic: a paralysis-immune target discards the effect BEFORE the reflect/resist chain', () => {
  // EntityEffectManager.cs:495-499 `continue`s on a hard-immune
  // Paralyze before `effect.ParentBundle = instancedBundle` (:502) and
  // before the whole caster-gated absorb/reflect/resist block
  // (:504-527). So Free Action plus Spell Reflection does NOT bounce a
  // paralyze back at its caster - there is nothing left to bounce.
  const paralyze = { ...blankEffect, type: 0, subType: 255, durationBase: 5, chanceBase: 100 };
  const spell = { element: 0, rangeType: 1, effects: [paralyze] };
  const caster = () => ({ entity: { name: 'Spider', activeEffects: [] }, sinks: {} });

  const immune = foeTarget({ activeEffects: [{ kind: 'freeAction', roundsRemaining: 9 }, { kind: 'spellReflection', chance: 100, roundsRemaining: 9 }] });
  const out = applySpell(spell, 1, immune, {}, () => 0.0, caster(), {});
  assert.equal(out.reflected, undefined, 'nothing reflects');
  assert.equal(out.resisted, undefined, 'and the resistance rung never speaks either');
  assert.equal(out.paralyzed, undefined);
  assert.deepEqual(immune.activeEffects.map((a) => a.kind), ['freeAction', 'spellReflection'], 'the target is untouched');

  // the control: drop the immunity and the SAME bundle reflects
  const mortal = foeTarget({ activeEffects: [{ kind: 'spellReflection', chance: 100, roundsRemaining: 9 }] });
  const ref = applySpell(spell, 1, mortal, {}, () => 0.0, caster(), {});
  assert.equal(ref.reflected, 1, 'reflection is live on the same fixture - the immunity is what removed it');
});

// --------------------------------------------------------------- F075
test('audit26 magic: PlayerAggro breaks the caster\'s normal-power concealment on transfer, drain, paralyze and silence', () => {
  // EntityEffect.PlayerAggro (:815-828) -> the target's
  // HandleAttackFromSource(caster) -> BreakNormalPowerConcealment-
  // Effects on the caster. Its callers: DrainEffect.Start:57 (and
  // TransferEffect, which IS-A DrainEffect), Paralyze.cs:48,
  // Silence.cs:48, TransferHealth.cs:57, TransferFatigue.cs:56.
  // Transfer Health/Fatigue additionally go through
  // DamageHealthFromSource / DamageFatigueFromSource, whose own tail
  // (DaggerfallEntityBehaviour.cs:167-172,151-153) runs for ANY caster.
  const concealed = (over = {}) => ({
    entity: {
      isPlayer: true, name: 'P', stats: { strength: 50, endurance: 50 }, skills: [], career: {}, level: 1,
      health: 20, maxHealth: 20, activeEffects: [{ kind: 'invisNormal', roundsRemaining: 10 }], ...over,
    },
    sinks: { heal: () => {}, restoreFatigue: () => {} },
  });
  const cases = {
    transferHealth: { ...blankEffect, type: 11, subType: 8, magnitudeBaseLow: 4, magnitudeBaseHigh: 4 },
    transferFatigue: { ...blankEffect, type: 11, subType: 9, magnitudeBaseLow: 4, magnitudeBaseHigh: 4 },
    drainStrength: { ...blankEffect, type: 7, subType: 0, magnitudeBaseLow: 4, magnitudeBaseHigh: 4 },
    transferStrength: { ...blankEffect, type: 11, subType: 0, magnitudeBaseLow: 4, magnitudeBaseHigh: 4 },
    paralyze: { ...blankEffect, type: 0, subType: 255, durationBase: 5, chanceBase: 100 },
    silence: { ...blankEffect, type: 19, subType: 255, durationBase: 5, chanceBase: 100 },
  };
  for (const [name, e] of Object.entries(cases)) {
    const c = concealed();
    applySpell({ element: 0, rangeType: 1, effects: [e] }, 1, foeTarget(), { hurt: () => {}, drainFatigue: () => {} }, () => 0.99, c, {});
    assert.deepEqual(c.entity.activeEffects, [], `${name} breaks the caster's normal-power concealment`);
  }

  // PlayerAggro's first line is "Caster must be player", so a FOE
  // caster keeps its concealment on the aggro-only arms...
  const foeCaster = concealed({ isPlayer: false, mobileType: 10 });
  applySpell({ element: 0, rangeType: 1, effects: [cases.paralyze] }, 1, foeTarget(), {}, () => 0.99, foeCaster, {});
  assert.deepEqual(foeCaster.entity.activeEffects.map((a) => a.kind), ['invisNormal'],
    'Paralyze aggros through PlayerAggro alone - a non-player caster returns at once');
  // ...but the FromSource damage doors take any source at all
  const foeTransfer = concealed({ isPlayer: false, mobileType: 10 });
  applySpell({ element: 0, rangeType: 1, effects: [cases.transferHealth] }, 1, foeTarget(), { hurt: () => {} }, () => 0.99, foeTransfer, {});
  assert.deepEqual(foeTransfer.entity.activeEffects, [],
    'DamageHealthFromSource runs HandleAttackFromSource on ANY source');
});

// --------------------------------------------------------- F122 / F123
test('audit26 magic: the two armour-value channels are non-stacking min-sets, which makes WeakensArmor inert', () => {
  // DaggerfallEntity.cs:400-415 - two independent channels, each a
  // min-set that ClearConstantEffects (:842-843) zeroes every pass:
  //   SetIncreasedArmorValueModifier(a): if (a < Increased...) assign
  //   SetDecreasedArmorValueModifier(a): if (a < Decreased...) assign
  // FormulaHelper.cs:1158 sums both onto ArmorValues[part].
  // StrengthensArmor.cs:25,63 passes -5 and lands; BadReactionsFrom
  // .cs:26,86 passes -5 and lands; WeakensArmor.cs:25,63 passes +5 and
  // 5 < 0 is never true, so the enchantment does NOTHING in DFU.
  const weak = wearer([it(T.WeakensArmor)]);
  computeEnchantmentMods(weak);
  assert.equal(enchantArmorMod(weak), 0, 'WeakensArmor is inert - the setter refuses a positive value');

  const one = wearer([it(T.StrengthensArmor)]);
  computeEnchantmentMods(one);
  assert.equal(enchantArmorMod(one), -5);

  const two = wearer([it(T.StrengthensArmor, -1, { equipSlot: 9 }), it(T.StrengthensArmor, -1, { equipSlot: 10 })]);
  computeEnchantmentMods(two);
  assert.equal(enchantArmorMod(two), -5, 'a second StrengthensArmor adds nothing - "does not stack"');

  const mixed = wearer([it(T.StrengthensArmor, -1, { equipSlot: 9 }), it(T.WeakensArmor, -1, { equipSlot: 10 })]);
  computeEnchantmentMods(mixed);
  assert.equal(enchantArmorMod(mixed), -5, 'and WeakensArmor cannot cancel it either');

  // the two channels are SEPARATE: -5 from each is -10 on the sum
  const nearby = { nearbyFoes: () => [{ mobileType: 140 }] };
  const both = wearer([it(T.StrengthensArmor, -1, { equipSlot: 9 }), it(T.BadReactionsFrom, 0, { equipSlot: 10 })]);
  computeEnchantmentMods(both, nearby);
  assert.equal(enchantArmorMod(both), -10, 'Increased + Decreased are summed at FormulaHelper.cs:1158');

  // BadReactionsFrom's own halves split: the armour set does not
  // stack, the ChangeChanceToHitModifier (:417-420) really does
  const pair = wearer([it(T.BadReactionsFrom, 0, { equipSlot: 9 }), it(T.BadReactionsFrom, 0, { equipSlot: 10 })]);
  computeEnchantmentMods(pair, nearby);
  assert.equal(enchantArmorMod(pair), -5, 'two BadReactionsFrom items still floor the channel at -5');
  assert.equal(enchantChanceToHitMod(pair), -10, 'but ChangeChanceToHitModifier is additive');
});

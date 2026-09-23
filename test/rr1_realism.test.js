// RR1 - Roleplay & Realism 1.8 (Hazelnut), the formula overrides and the
// rule modules: each law against the C# (RoleplayRealism.cs and the four
// small classes), each behind the mod's own switch, and the seam it
// hangs on in the port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setModSetting, _resetModSettings, MOD_SETTINGS } from '../src/systems/modSettings.js';
import {
  RR_MOD, LOAN_VALUES, BED_MODELS, rrAdjustWeaponHitChanceMod, rrAdjustWeaponAttackDamage, rrClimbingChance, NO_CLIMB_HOLDING_WEAPON,
  rrMeleeWeaponAnimTime, rrWeaponToHit, rrConditionDamageThroughPhysicalHit, rrDamageModifierClassic, rrLoanMaxPerLevel, rrMaxBankLoan,
  rrShipAvailable, rrEncumbranceEffect, rrBandageHeal, rrDouseOnDungeonExit, RR_POTION_RECIPES, RR_ENEMY_APPEARANCE, applyEnemyAppearance,
  revertEnemyAppearance, enemyAppearanceApplied, RR_UNDERWORLD, rrUnderworldRule, RR_FIGHTERS_GUILD_SKILLS, RR_FIGHTERS_TRAINING_SKILLS,
  rrFightersGuildSkills, rrFightersTrainingSkills, isBedModel, bedSleepingOn,
} from '../src/systems/rrRealism.js';
import { installRoleplayRealism, setRrHostSeams, roleplayRealismInstalled } from '../src/systems/rrInstall.js';
import { formulaOverride, adjustWeaponHitChanceMod, adjustWeaponAttackDamage, damageModifier, damageEquipment, maxEncumbrance } from '../src/combat/formulas.js';
import { climbingChanceOverride, climbingChance } from '../src/player/climbing.js';
import { setWeaponPoseProbe } from '../src/combat/playerWeapon.js';
import { getMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE } from '../src/characters/weaponStates.js';
import { calculateMaxBankLoan, LOAN_MAX_PER_LEVEL } from '../src/systems/banking.js';
import { isShipAvailable } from '../src/systems/ship.js';
import { computeEntityMods } from '../src/systems/entityMods.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { potionRecipeByKey, potionRecipeKey, potionBundle } from '../src/systems/potions.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { GUILDS, calculateNewRank, joinGuild, updateRank, guildSkillsOf, underworldRuleOf } from '../src/systems/guilds.js';
import { trainingSkills, TRAINING_SKILLS } from '../src/systems/guildServices.js';
import { createFactionRep, getReputation } from '../src/systems/factionRep.js';
import { SKILLS } from '../src/systems/skills.js';
import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { liveStat } from '../src/systems/statMods.js';
import { carriedWeight } from '../src/systems/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism';
const on = (key, v = true) => setModSetting(V, key, v);
const reset = () => _resetModSettings();
const mint = (item) => mintCondition(setItemFields(item));
const bow = () => mint({ group: 'Weapons', templateIndex: WEAPONS.Short_Bow, material: 0 });
const sword = (material = 0) => mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material });

installRoleplayRealism();

test('RR1 the record: the manifest, the switches (27 keys, the mod\'s words and defaults), the install once', () => {
  assert.equal(RR_MOD.guid, 'd828b782-46e9-40e7-8ae6-19cde308032e');
  const vendored = JSON.parse(rd('vendor/roleplay-realism/roleplay-realism.dfmod.json'));
  assert.equal(vendored.GUID, RR_MOD.guid); assert.equal(vendored.ModVersion, '1.8');
  const settings = JSON.parse(rd('vendor/roleplay-realism/modsettings.json'));
  const keys = MOD_SETTINGS[V].keys;
  let n = 0;
  for (const sec of settings.Sections) {
    for (const k of sec.Keys) {
      const name = sec.Name === 'Modules' ? k.Name : `${sec.Name}.${k.Name}`;
      assert.ok(keys[name], `${name} is on the pane`);
      assert.equal(keys[name].description, k.Description, `${name}: the mod's own words`);
      const expected = typeof k.Value === 'string' ? (k.Value === 'True' ? true : k.Value === 'False' ? false : Number(k.Value)) : k.Value;
      if (name === 'shipPorts') { assert.equal(expected, true); assert.equal(keys[name].default, false, 'SHIP-PORTS: the ONE recorded departure from the mod\'s defaults - the boat stays reachable from anywhere until a player asks for the port rule'); n++; continue; }
      assert.equal(keys[name].default, expected, `${name}: the mod's own default`);
      n++;
    }
  }
  assert.equal(n, 27, 'eighteen modules, six riding keys, three training keys');
  assert.deepEqual(keys.loanAmountPerLevel.options, ['2000', '4000', '6000', '8000', '10000', '20000', '30000', '40000', '50000']);
  assert.equal(roleplayRealismInstalled(), true);
  assert.equal(installRoleplayRealism(), false, 'once');
});

test('RR1 advancedArchery: the draw ladders (:530-578) - hit chance by the hold, damage by the draw, the C# int cast; the two mod hooks answer them under the switch and what stood before them off', () => {
  reset();
  const b = bow();
  assert.equal(rrAdjustWeaponHitChanceMod(10, 100, b), -30, '< 200 ms: -40');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 300, b), 0, '< 500: -10');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 700, b), 10, '< 1000: as it is');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 1500, b), 20, '< 2000: +10');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 3000, b), 10, '2000..5000: no arm - as it is');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 6000, b), 0, '> 5000: -10');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 9000, b), 0, '> 8000 is shadowed by > 5000: -10, never -20 (the C#\'s else-if chain)');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 300, sword()), 10, 'not a bow');
  assert.equal(rrAdjustWeaponHitChanceMod(10, 0, b), 10, 'no draw');
  assert.equal(rrAdjustWeaponAttackDamage(20, 400, b), 10, '< 800: x t/800');
  assert.equal(rrAdjustWeaponAttackDamage(20, 3000, b), 20);
  assert.equal(rrAdjustWeaponAttackDamage(20, 5500, b), 17, 'x0.85');
  assert.equal(rrAdjustWeaponAttackDamage(20, 7000, b), 15, 'x0.75');
  assert.equal(rrAdjustWeaponAttackDamage(20, 8500, b), 10, 'x0.5');
  assert.equal(rrAdjustWeaponAttackDamage(20, 9000, b), 5, '>= 9000: x0.25');
  assert.equal(rrAdjustWeaponAttackDamage(7, 300, b), 2, '(int)(7 * 0.375)');
  assert.equal(adjustWeaponHitChanceMod(null, null, 10, 100, b), -30, 'the registered hook');
  assert.equal(adjustWeaponAttackDamage(null, null, 20, 400, b), 10);
  on('advancedArchery', false);
  assert.equal(adjustWeaponHitChanceMod(null, null, 10, 100, b), 10, 'off: identity (nothing stood before)');
  reset();
});

test('RR1 climbingRestriction: a drawn weapon that is not bare hands answers 0 with the mod\'s line (:320-348); otherwise DFU\'s own formula; through the rig\'s pose probe', () => {
  reset();
  const said = [];
  assert.equal(rrClimbingChance(50, { climbing: 40, luck: 50, weaponDrawn: true, weaponMelee: false, say: (t) => said.push(t) }), 0);
  assert.deepEqual(said, [NO_CLIMB_HOLDING_WEAPON]);
  assert.equal(NO_CLIMB_HOLDING_WEAPON, "You can't climb whilst holding your weapon.", 'the csv');
  assert.equal(rrClimbingChance(50, { climbing: 40, luck: 50, weaponDrawn: true, weaponMelee: true }), climbingChance(50, 40, 50), 'bare hands drawn: DFU\'s formula');
  assert.equal(rrClimbingChance(50, { climbing: 40, luck: 50, khajiit: true, enhanced: true }), climbingChance(50, 40, 50, { khajiit: true, enhanced: true }));
  setWeaponPoseProbe(() => ({ weaponDrawn: true, weaponType: 0 }));
  assert.equal(climbingChanceOverride(50, { climbing: 40, luck: 50 }), 0, 'the override reads the probe');
  setWeaponPoseProbe(() => ({ weaponDrawn: true, weaponType: 15 }));
  assert.equal(climbingChanceOverride(50, { climbing: 40, luck: 50 }), climbingChance(50, 40, 50), 'WeaponTypes.Melee drawn: climbs');
  setWeaponPoseProbe(null);
  assert.equal(climbingChanceOverride(50, { climbing: 40, luck: 50 }), climbingChance(50, 40, 50), 'no rig: nothing is drawn');
  on('climbingRestriction', false);
  setWeaponPoseProbe(() => ({ weaponDrawn: true, weaponType: 0 }));
  assert.equal(climbingChanceOverride(50, { climbing: 40, luck: 50 }), null, 'off: DFU\'s turn');
  setWeaponPoseProbe(null);
  reset();
});

test('RR1 weaponSpeed: the speed/strength blend by hands (:350-387), behind Roleplay & Realism: Items\' weaponBalance; weaponMaterials: the material x3 (:389-392)', () => {
  reset();
  const t = (o) => rrMeleeWeaponAnimTime(o, CLASSIC_FRAME_UPDATE);
  assert.equal(t({ liveSpeed: 50, liveStrength: 50 }), 3 * (115 - (50 * 0.8 + 50 * 0.2)) / CLASSIC_FRAME_UPDATE, 'one hand: 80/20');
  assert.equal(t({ liveSpeed: 50, liveStrength: 50, hands: 'Both' }), 3 * (115 - (25 + 25)) / CLASSIC_FRAME_UPDATE, 'both: 50/50');
  assert.equal(t({ liveSpeed: 50, liveStrength: 50, weaponType: 4 }), 3 * (115 - (45 + 5)) / CLASSIC_FRAME_UPDATE, 'a dagger: 90/10');
  assert.equal(t({ liveSpeed: 50, liveStrength: 50, weaponType: 15 }), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE, 'bare hands: the speed alone');
  assert.equal(t({ liveSpeed: 80, liveStrength: 80 }), 3 * (115 - (80 * (0.8 - 0.08) + 80 * (0.2 - 0.08))) / CLASSIC_FRAME_UPDATE, 'past 70 each ratio loses the cap (the C#\'s own float order)');
  assert.equal(t({ liveSpeed: 80, liveStrength: 80, hands: 'Both' }), 3 * (115 - (80 * (0.5 - 0.15) + 80 * (0.5 - 0.15))) / CLASSIC_FRAME_UPDATE);
  // the seam: Items' weaponBalance (on by default) answers first
  const player = { stats: { strength: 50, speed: 50 }, activeEffects: [], items: [] };
  equipTableOf(player)[EQUIP_SLOTS.RightHand] = sword();
  const ctx = { entity: player, weaponType: 0, usingRightHand: true };
  const itemsTime = getMeleeWeaponAnimTime(50, ctx);
  setModSetting('roleplay-realism-items', 'weaponBalance', false);
  assert.equal(getMeleeWeaponAnimTime(50, ctx), t({ liveSpeed: 50, liveStrength: 50 }), 'Items\' weaponBalance off: this mod\'s blend (a longsword is one-handed)');
  assert.notEqual(itemsTime, getMeleeWeaponAnimTime(50, ctx));
  equipTableOf(player)[EQUIP_SLOTS.RightHand] = mint({ group: 'Weapons', templateIndex: WEAPONS.Claymore, material: 0 });
  assert.equal(getMeleeWeaponAnimTime(50, ctx), t({ liveSpeed: 50, liveStrength: 50, hands: 'Both' }), 'a claymore: both hands');
  on('weaponSpeed', false);
  assert.equal(getMeleeWeaponAnimTime(50, ctx), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE, 'both off: DFU\'s line');
  reset();
  assert.equal(rrWeaponToHit(sword(WEAPON_MATERIALS.Daedric)), 18, 'Daedric +6 x3');
  assert.equal(rrWeaponToHit(sword(WEAPON_MATERIALS.Iron)), -3);
  assert.equal(formulaOverride('calculateWeaponToHit')(sword(WEAPON_MATERIALS.Daedric)), 18, 'registered');
  on('weaponMaterials', false);
  assert.equal(formulaOverride('calculateWeaponToHit')(sword(WEAPON_MATERIALS.Daedric)), undefined, 'off: DFU\'s x10 stands');
  reset();
});

test('RR1 equipDamage: armor takes damage x5 and the override answers true, a weapon false (:394-407); through DamageEquipment\'s struck side; classicStrengthDamageBonus: floor((str - 50) / 10) (:314-317)', () => {
  reset();
  const lowered = [];
  const cuirass = mint({ group: 'Armor', templateIndex: 102, material: 0 });
  assert.equal(rrConditionDamageThroughPhysicalHit(cuirass, 7, (it, amt) => lowered.push([it, amt])), true);
  assert.deepEqual(lowered, [[cuirass, 35]]);
  assert.equal(rrConditionDamageThroughPhysicalHit(sword(), 7, () => assert.fail('never')), false);
  // the seam: a blow on the chest of an armored target. Physical Combat And Armor Overhaul's DamageEquipment
  // replaces FormulaHelper's whole member while its equipmentDamageEnhanced is on (as in DFU, where the mod that
  // registered last owns the member) - off here, so DFU's member and this override's slot inside it run
  setModSetting('pcaao', 'equipmentDamageEnhanced', false);
  const attacker = { items: [], activeEffects: [] };
  const target = { items: [], activeEffects: [] };
  const worn = mint({ group: 'Armor', templateIndex: 102, material: 0 });
  equipTableOf(target)[EQUIP_SLOTS.ChestArmor] = worn;
  const blade = sword();
  const before = worn.currentCondition;
  damageEquipment(attacker, target, 10, blade, 3, { rolls: () => 0.99 });
  assert.equal(worn.currentCondition, before - 50, 'the cuirass took 10 x 5');
  assert.equal(blade.currentCondition, blade.maxCondition - Math.trunc((10 * 10 + 50) / 100), 'the blade took DFU\'s own (the override answered false)');
  on('equipDamage', false);
  const worn2 = mint({ group: 'Armor', templateIndex: 102, material: 0 });
  equipTableOf(target)[EQUIP_SLOTS.ChestArmor] = worn2;
  damageEquipment(attacker, target, 10, blade, 3, { rolls: () => 0.99 });
  assert.equal(worn2.currentCondition, worn2.maxCondition - Math.trunc((10 * 10 + 50) / 100), 'off: DFU\'s (10 * damage + 50) / 100');
  reset();
  assert.equal(rrDamageModifierClassic(70), 2); assert.equal(rrDamageModifierClassic(45), -1); assert.equal(rrDamageModifierClassic(50), 0);
  setModSetting('pcaao', 'fixedStrengthDamageModifier', false);   // PCAAO's own DamageModifier stood registered before this mod's (the chain keeps it for the off case)
  assert.equal(damageModifier(70), Math.floor((70 - 50) / 5), 'the switch ships OFF: DFU\'s (strength - 50) / 5');
  on('classicStrengthDamageBonus', true);
  assert.equal(damageModifier(70), 2, 'on: the classic half');
  reset();
});

test('RR1 loanAmountPerLevel / shipPorts: Level x loanVals[choice] (:98, :309-312) over DFU\'s 50,000; the ship from a port town with a ship owned, on the ship always, in the wilderness never (:610-631)', () => {
  reset();
  assert.deepEqual(LOAN_VALUES, [2000, 4000, 6000, 8000, 10000, 20000, 30000, 40000, 50000]);
  assert.equal(rrLoanMaxPerLevel(), 10000, 'the default choice, index 4');
  assert.equal(rrMaxBankLoan(7), 70000);
  assert.equal(calculateMaxBankLoan(7), 70000, 'through FormulaHelper.CalculateMaxBankLoan\'s override slot');
  setModSetting(V, 'loanAmountPerLevel', 0);
  assert.equal(calculateMaxBankLoan(7), 14000);
  setModSetting(V, 'Enabled', false);
  assert.equal(rrMaxBankLoan(7), null);
  assert.equal(calculateMaxBankLoan(7), 7 * LOAN_MAX_PER_LEVEL, 'the mod off: DFU\'s own');
  reset(); on('shipPorts');   // SHIP-PORTS: off by default now - the law under test is the module's
  assert.equal(rrShipAvailable({ onShip: true }), true, 'IsOnShip: yes');
  assert.equal(rrShipAvailable({ onShip: false, locationLoaded: true, portTown: true, ownsShip: true }), true);
  assert.equal(rrShipAvailable({ onShip: false, locationLoaded: true, portTown: false, ownsShip: true }), false, 'not a port');
  assert.equal(rrShipAvailable({ onShip: false, locationLoaded: true, portTown: true, ownsShip: false }), false, 'no ship');
  assert.equal(rrShipAvailable({ onShip: false, locationLoaded: false, ownsShip: true }), false, 'the wilderness: false');
  assert.equal(rrShipAvailable({ onShip: false, locationLoaded: true, portTown: null, ownsShip: true }), null, 'a host that cannot say where it stands hands the question back');
  assert.equal(isShipAvailable({ canSail: true, ownsShip: true, locationLoaded: true, portTown: false }), false, 'the delegate at TransportManager.ShipAvailiable');
  assert.equal(isShipAvailable({ canSail: true, ownsShip: true, locationLoaded: true, portTown: true }), true);
  assert.equal(isShipAvailable({ canSail: false, ownsShip: true, locationLoaded: true, portTown: true }), false, 'the host\'s own gate first');
  on('shipPorts', false);
  assert.equal(isShipAvailable({ canSail: true, ownsShip: true, locationLoaded: true, portTown: false }), true, 'off: HasShip()');
  reset();
});

test('RR1 encumbranceEffects: past 75% of MaxEncumbrance the excess x2 takes speed off (never below 2) and spends fatigue each round (:580-598); the fold and the round hook', () => {
  reset();
  assert.equal(rrEncumbranceEffect({ carriedWeight: 50, maxEncumbrance: 100 }), null, 'half full: nothing');
  let e = rrEncumbranceEffect({ carriedWeight: 90, maxEncumbrance: 100, liveSpeed: 60, permanentSpeed: 60, currentFatigue: 5000 });
  assert.equal(e.encOver, Math.fround(Math.fround(Math.fround(0.9) - 0.75) * 2), 'float32, as the C# (AUDIT-RR F7)');
  // AUDIT-RR F7: in float32 encOver is 0.29999995, so (int)(60 * encOver) is 17 and (int)(encOver * 100) is 29 - DFU's
  // own numbers at this band edge; double gave 18 and 30
  assert.equal(e.speedEffect, 17, '(int)(PermanentSpeed * encOver) in float32');
  assert.equal(e.fatigueEffect, 29, '(int)(encOver * 100) in float32, raw units');
  e = rrEncumbranceEffect({ carriedWeight: 200, maxEncumbrance: 100, liveSpeed: 10, permanentSpeed: 60, currentFatigue: 50 });
  assert.equal(e.encPc, Math.fround(1.2), 'capped at 120% - the float32 1.2f (AUDIT-RR F7)');
  assert.equal(e.speedEffect, 8, 'Min(LiveSpeed - 2, ...): the live speed never goes under 2');
  assert.equal(e.fatigueEffect, -50, 'Min(CurrentFatigue - 100, 90): negative under 100 - the C#\'s own arithmetic');
  // the seam: a laden player through the fold and a round
  // AUDIT-RR F5: the effect is the PLAYER's (the C# reads GameManager.Instance.PlayerEntity) - a foe carrying loot is never slowed
  const player = { isPlayer: true, stats: { strength: 40, speed: 60 }, activeEffects: [], items: Array.from({ length: 7 }, () => mint({ group: 'Weapons', templateIndex: WEAPONS.Claymore, material: 0 })), health: 20, fatigue: 5000 };
  assert.equal(maxEncumbrance(40), 60);
  const w = carriedWeight(player);
  assert.ok(w > 45 && w <= 60, `seven iron claymores: ${w} kg, past three quarters of 60`);
  const over = Math.fround(Math.fround(Math.fround(Math.min(Math.fround(w / 60), 1.2)) - 0.75) * 2);   // float32, as the C# (AUDIT-RR F7)
  computeEntityMods(player);
  assert.equal(player._mods.stats.speed, -Math.trunc(60 * over), 'the fold: the speed penalty');
  assert.equal(liveStat(player, 'speed'), 60 + player._mods.stats.speed);
  const drained = [];
  runMagicRoundsFor(player, 0, 1, { sinks: { drainFatigue: (n) => drained.push(n) } });
  assert.deepEqual(drained, [Math.trunc(over * 100)], 'the round: DecreaseFatigue(fatigueEffect, false)');
  player.isResting = true;
  computeEntityMods(player);
  assert.equal(player._mods.stats.speed ?? 0, 0, 'resting: no effect (IsResting guard)');
  const foe = { ...player, isPlayer: false, isResting: false, _mods: undefined };
  computeEntityMods(foe);
  assert.equal(foe._mods.stats.speed ?? 0, 0, 'a foe with the same load: nothing (AUDIT-RR F5)');
  player.isResting = false;
  on('encumbranceEffects', false);
  computeEntityMods(player);
  assert.equal(player._mods.stats.speed ?? 0, 0, 'off');
  reset();
});

test('RR1 bandaging (this mod\'s, medical / 2 - never registered beside Items\', recorded), autoExtinguishLight (:633-640), purificationPotion (CureDiseasePotionRR.cs)', () => {
  reset();
  assert.equal(rrBandageHeal(60, 100), 30, 'medical / 2');
  assert.equal(rrBandageHeal(100, 100), 40, 'MaxHealth * 0.4');
  const torch = mint({ group: 'UselessItems2', templateIndex: 247 });
  const entity = { lightSource: torch };
  assert.equal(rrDouseOnDungeonExit(entity, { isDay: false }), null, 'night: stays lit');
  assert.equal(entity.lightSource, torch);
  assert.equal(rrDouseOnDungeonExit(entity, { isDay: true }), torch, 'day: doused, the item answered for its box');
  assert.equal(entity.lightSource, null);
  assert.equal(rrDouseOnDungeonExit({ lightSource: null }, { isDay: true }), null);
  on('autoExtinguishLight', false);
  const e2 = { lightSource: torch };
  assert.equal(rrDouseOnDungeonExit(e2, { isDay: true }), null, 'off');
  reset();
  // the potion: the same eight ingredients, HealHealth + CurePoison beside CureDisease where DFU has Invisibility
  const key = potionRecipeKey(RR_POTION_RECIPES[1].ingredients);
  assert.equal(potionRecipeByKey(key), RR_POTION_RECIPES[1], 'the override answers the built key');
  assert.deepEqual(potionBundle(key).effects.map((e) => [e.type, e.subType]), [[3, 0], [10, 8], [3, 1]], 'CureDisease, HealHealth, CurePoison (CurePoison.cs:28)');
  assert.deepEqual(potionRecipeByKey(potionRecipeKey([31, 56, 62])).secondary ?? [], [], 'cureDisease as it is');
  assert.equal(potionRecipeByKey(key).price, 500);
});

test('RR1 enemyAppearance: the eight class rows re-textured with their frames (:697-773), written into the basics at install and restorable', () => {
  assert.equal(Object.keys(RR_ENEMY_APPEARANCE).length, 8);
  assert.equal(RR_ENEMY_APPEARANCE[MOBILE_TYPES.Sorcerer].maleTexture, 476);
  assert.equal(RR_ENEMY_APPEARANCE[MOBILE_TYPES.Sorcerer].castsMagic, true);
  assert.deepEqual(RR_ENEMY_APPEARANCE[MOBILE_TYPES.Archer].primaryAttackAnimFrames3, [4, -1, 5, 0, 0, 1, -1, 2, 3, 4, -1, 5, 0]);
  assert.equal(RR_ENEMY_APPEARANCE[MOBILE_TYPES.Knight].femaleTexture, 477);
  // the install (enemyAppearance ships on) wrote them
  assert.equal(enemyAppearanceApplied(), true);
  assert.equal(ENEMY_BASICS[MOBILE_TYPES.Bard].maleTexture, 482);
  assert.equal(ENEMY_BASICS[MOBILE_TYPES.Warrior].chanceForAttack2, 50);
  assert.deepEqual(ENEMY_BASICS[MOBILE_TYPES.Sorcerer].spellAnimFrames, [0, 1, 2, 3, 3]);
  revertEnemyAppearance(ENEMY_BASICS);
  assert.equal(enemyAppearanceApplied(), false);
  assert.notEqual(ENEMY_BASICS[MOBILE_TYPES.Bard].maleTexture, 482, 'the original is back');
  assert.equal(applyEnemyAppearance(ENEMY_BASICS), 8);
  assert.equal(ENEMY_BASICS[MOBILE_TYPES.Bard].maleTexture, 482);
  revertEnemyAppearance(ENEMY_BASICS);
});

test('RR1 underworldExpulsion: the two guild classes - expulsion allowed, the join floor at 2, the death squad, the mod\'s own lines; fightersTeachHandToHand: the two lists with HandToHand for Giantish', () => {
  reset();
  assert.equal(rrUnderworldRule('ThievesGuild'), RR_UNDERWORLD.ThievesGuild);
  assert.equal(rrUnderworldRule('MagesGuild'), null);
  assert.deepEqual(RR_UNDERWORLD.ThievesGuild.squad(9), [{ mobileType: MOBILE_TYPES.Rogue, count: 10, minDistance: 1, maxDistance: 8 }, { mobileType: MOBILE_TYPES.Thief, count: 10, minDistance: 1, maxDistance: 4 }], '4 + (int)(9 / 1.5)');
  assert.deepEqual(RR_UNDERWORLD.DarkBrotherhood.squad(9), [{ mobileType: MOBILE_TYPES.Assassin, count: 8, minDistance: 1, maxDistance: 5 }, { mobileType: MOBILE_TYPES.Nightblade, count: 8, minDistance: 4, maxDistance: 16 }], '4 + 9 / 2');
  assert.equal(RR_UNDERWORLD.ThievesGuild.expulsion.length, 6); assert.equal(RR_UNDERWORLD.ThievesGuild.expulsion[4], '', 'the NewLineToken');
  assert.equal(RR_UNDERWORLD.DarkBrotherhood.expulsion[0], "%pcn, you have disappointed us yet again, and you've not");
  // the rank law: a negative reputation expels where DFU's class clamps to 0
  const tg = GUILDS.ThievesGuild;
  const store = createFactionRep(new Map([[tg.factionId, { id: tg.factionId, rep: -3 }]]));
  const entity = { skills: new Array(35).fill(30), activeEffects: [], level: 6, name: 'Mac' };
  assert.equal(calculateNewRank(entity, tg, store), -1, 'on: AllowGuildExpulsion answers the rank as it comes');
  on('underworldExpulsion', false);
  assert.equal(calculateNewRank(entity, tg, store), 0, 'off: ThievesGuild.cs:128-131\'s clamp');
  reset();
  // the join floor
  const memberships = {};
  joinGuild(memberships, tg, 0, store);
  assert.equal(getReputation(store, tg.factionId), 2, 'Join: reputation floored at 2');
  const store2 = createFactionRep(new Map([[tg.factionId, { id: tg.factionId, rep: 7 }]]));
  joinGuild({}, tg, 0, store2);
  assert.equal(getReputation(store2, tg.factionId), 7, 'a better reputation keeps it');
  // the expulsion: the squad through the host's seam, the lines on the outcome
  const spawned = [];
  setRrHostSeams({ spawnFoe: (mt, opts) => spawned.push([mt, opts.minDistance, opts.maxDistance]) });
  const store3 = createFactionRep(new Map([[tg.factionId, { id: tg.factionId, rep: -3 }]]));
  const m = { [tg.guildGroup]: { guild: tg.name, rank: 0, lastRankChange: -100 } };
  const moved = updateRank(m, tg, entity, store3, 0);
  assert.equal(moved.outcome, 'expulsion');
  assert.deepEqual(moved.lines, RR_UNDERWORLD.ThievesGuild.expulsion, 'TokensExpulsion');
  assert.equal(spawned.length, 16, '2 x (4 + 6 / 1.5 = 8) foes');
  assert.deepEqual(spawned[0], [MOBILE_TYPES.Rogue, 1, 8]); assert.deepEqual(spawned[15], [MOBILE_TYPES.Thief, 1, 4]);
  assert.equal(underworldRuleOf(tg), RR_UNDERWORLD.ThievesGuild);
  setRrHostSeams({ spawnFoe: null });
  // the Fighters
  assert.deepEqual(RR_FIGHTERS_GUILD_SKILLS, [SKILLS.Archery, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.HandToHand, SKILLS.LongBlade, SKILLS.Orcish, SKILLS.ShortBlade]);
  assert.equal(RR_FIGHTERS_TRAINING_SKILLS.length, 11); assert.ok(RR_FIGHTERS_TRAINING_SKILLS.includes(SKILLS.HandToHand) && !RR_FIGHTERS_TRAINING_SKILLS.includes(SKILLS.Giantish));
  assert.equal(rrFightersGuildSkills('FightersGuild'), null, 'the switch ships OFF');
  assert.deepEqual(guildSkillsOf(GUILDS.FightersGuild), GUILDS.FightersGuild.skills);
  on('fightersTeachHandToHand', true);
  assert.equal(rrFightersGuildSkills('FightersGuild'), RR_FIGHTERS_GUILD_SKILLS);
  assert.equal(rrFightersTrainingSkills('MagesGuild'), null);
  assert.equal(guildSkillsOf(GUILDS.FightersGuild), RR_FIGHTERS_GUILD_SKILLS, 'GuildSkills, the virtual');
  assert.equal(trainingSkills(GUILDS.FightersGuild), RR_FIGHTERS_TRAINING_SKILLS, 'TrainingSkills, the virtual');
  assert.equal(trainingSkills(GUILDS.MagesGuild), TRAINING_SKILLS.MagesGuild);
  reset();
});

test('RR1 bedSleeping and the wiring: the three bed models, listed by the interior context and a target under the switch; the install at the scene boot after Items\'; the seams at their sites', () => {
  reset();
  assert.deepEqual(BED_MODELS, [41000, 41001, 41002]);
  assert.equal(isBedModel(41001), true); assert.equal(isBedModel(41003), false);
  assert.equal(bedSleepingOn(), true);
  on('bedSleeping', false); assert.equal(bedSleepingOn(), false); reset();
  assert.match(rd('src/scenes/shared.js'), /installRoleplayRealismItems\(\);\n  installRoleplayRealism\(\);/, 'InitMod after Items\', once');
  assert.match(rd('src/scenes/interiorContext.js'), /\} else if \(isBedModel\(p\.modelIdNum\)\) \{\n      beds\.push\(\{ cpu, matrix \}\);/);
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /if \(bedSleepingOn\(\)\) interiorCtx\.beds\?\.forEach\(\(bd, i\) => \{/, 'a bed is a target only while the module is on');
  assert.match(wm, /if \(key\.startsWith\('bed:'\)\) \{\n        interiorKeyCtx\.toggleRest\(\{ ignoreAllocatedBed: true \}\);/, 'BedActivation is the rest gate, and `new DaggerfallRestWindow(uiManager, true)` (:524) - AUDIT-RR F6');
  assert.match(wm, /joinGuild\(memberships, guild, gameDate\(\), store\);/);
  assert.match(wm, /const doused = rrDouseOnDungeonExit\(playerEntity, \{ isDay: isDayFromMinutes\(Math\.floor\(worldMinutes\(\)\)\) \}\);\n      if \(doused\) townTalk\?\.showOverlay\?\.\(new ActionTextBox\(\[expandItemMacro\(USE_TEXT\.lightDouse, doused\)\]\)\);/, 'the douse on the dungeon exit with the light\'s own box');
  assert.match(wm, /setRrHostSeams\(\{ spawnFoe: \(mobileType, opts\) => standInteriorLooseFoe\(mobileType, opts\) \}\);/);
  assert.match(rd('src/combat/formulas.js'), /chanceToHitMod \+= _overrides\.get\('calculateWeaponToHit'\)\?\.\(weapon\) \?\? \(WEAPON_MATERIAL_MODIFIER\[weapon\.material\] \?\? 0\) \* 10;/);
  assert.match(rd('src/combat/formulas.js'), /if \(_overrides\.get\('applyConditionDamageThroughPhysicalHit'\)\?\.\(item, owner, damage, \{ say \}\) === true\) return;/);
  assert.match(rd('src/player/climbing.js'), /const chance = climbingChanceOverride\(base, \{ \.\.\.i, say: this\.deps\.say \?\? null \}\) \?\? climbingChance\(/);
  assert.match(rd('src/combat/weaponRig.js'), /setWeaponPoseProbe\(\(\) => \(\{ \.\.\.weaponPoseOf\(playerWeapon\), weaponType: weaponTypeForItem\(playerWeapon\.weapon\) \}\)\);/, 'the pair through its one law (HARD2c)');
  assert.match(rd('src/player/mountRig.js'), /shipAvailable: isShipAvailable\(\{ canSail: !!onShip, ownsShip: ownsShip\(playerEntity\), \.\.\.\(shipLocation\?\.\(\) \?\? \{\}\) \}\)/);
  assert.match(rd('src/systems/worldTick.js'), /for \(const fn of _roundHooks\.values\(\)\) fn\(entity, \{ nowMinutes: r \+ 1, sinks, say \}\);/);
  assert.match(rd('src/systems/guilds.js'), /return guild\?\.neverExpels && !underworldRuleOf\(guild\) && newRank < 0 \? 0 : newRank;/);
  assert.match(rd('src/systems/guildServiceFlow.js'), /const rows = moved\.lines \? moved\.lines\.map\(\(t\) => \(\{ text: t\.replaceAll\('%pcn', entity\?\.name \?\? ''\), center: true \}\)\) : undefined;/);
  const inst = rd('src/systems/rrInstall.js');
  for (const s of ["registerFormulaOverride('adjustWeaponHitChanceMod'", "registerMagicRoundHook('roleplay-realism-encumbrance'", "registerEntityFold('roleplay-realism-encumbrance'", 'setShipAvailable((q) => rrShipAvailable(q))', 'setUnderworldRule(', 'setGuildExpelledHook(', 'registerClimbingChanceOverride(', 'registerMeleeWeaponAnimTime(', "registerFormulaOverride('calculateWeaponToHit'", "registerFormulaOverride('applyConditionDamageThroughPhysicalHit'", "if (rrModule('enemyAppearance')) applyEnemyAppearance(ENEMY_BASICS);", "overridePotionRecipes(rrModule('purificationPotion') ? RR_POTION_RECIPES : []);", "registerFormulaOverride('damageModifier'", 'registerMaxBankLoan(']) assert.ok(inst.includes(s), s);
});

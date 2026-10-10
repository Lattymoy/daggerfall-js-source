// WEAR-VANILLA (2026-10-01, the repair triage: "Disable the modded feature that increases durability loss. Vanilla
// values work fine. Weapon degradation done improperly is extremely agitating if done wrong"). The default game wore
// gear through Physical Combat And Armor Overhaul's wear module (~2.8x DFU on a weapon per landed hit, ~15x on armour,
// and armour worn by a monster's claws, which DFU never wears) or Roleplay Realism's equipDamage (armour x5), with
// BALANCE1's 0.6 on top; and the overhaul's fading module DESTROYED a player's broken enchanted piece. The port ships
// the three switches off (the mods ship them on) and the wear scale at 1, so a blow wears what DFU's DamageEquipment
// says, and a value saved under the old default is let go once. Offline a player may turn them back on; online the
// room reads the port's defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, _resetModSettings, SWITCH_RESETS } from '../src/systems/modSettings.js';
import { onlineForcedModSetting } from '../src/systems/onlineLane.js';
import { pcaaoModules, installPcaao } from '../src/combat/pcaao.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { damageEquipment, calculateAttackDamage, registerFormulaOverride, formulaOverride, chooseEnemyWeapon } from '../src/combat/formulas.js';
import { CONDITION_WEAR_SCALE, DFU_WEAR_MULTIPLE, equipTableOf, EQUIP_SLOTS, slotForBodyPart, equipItem } from '../src/systems/equip.js';
import { equipEnemy } from '../src/scenes/hostCombat.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { readFileSync } from 'node:fs';
import { repairRefusal } from '../src/systems/repairService.js';
import { getBool } from '../src/systems/settings.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';

const WEAR_KEYS = [['pcaao', 'equipmentDamageEnhanced'], ['pcaao', 'fadingEnchantedItems'], ['roleplay-realism', 'equipDamage']];
const dfuWear = (damage) => Math.trunc((10 * damage + 50) / 100);   // FormulaHelper.ApplyConditionDamageThroughPhysicalHit
const portWear = (damage) => DFU_WEAR_MULTIPLE * dfuWear(damage);   // WEAR-TWICE, then WEAR-ONE: the port's multiple of it (1 - DFU's own)
const foe = () => ({ isPlayer: false, isClass: true, items: [], activeEffects: [], stats: { strength: 50 } });
const armed = (item, slot, who = foe()) => { mintCondition(item); who.items.push(item); equipTableOf(who)[slot] = item; return who; };
const longsword = () => mintCondition({ group: 'Weapons', templateIndex: 120, material: 1, name: 'Longsword' });
const cuirass = () => ({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass' });

installPcaao();
installRoleplayRealism();

test('WEAR-VANILLA: the three wear switches ship off and read off, the rest of both mods stays on, and a blow\'s scale is DFU\'s - WEAR-ONE: DFU\'s amount again, not twice (mutants: the multiple back at 2)', () => {
  _resetModSettings();
  for (const [vendor, key] of WEAR_KEYS) {
    assert.equal(MOD_SETTINGS[vendor].keys[key].default, false, `${vendor}/${key} ships off`);
    assert.equal(modSetting(vendor, key), false, `${vendor}/${key} reads off`);
  }
  const m = pcaaoModules();
  assert.deepEqual([m.enabled, m.equipmentDamageEnhanced, m.fadingEnchantedItems], [true, false, false], 'the overhaul is on, its wear is not');
  assert.deepEqual([m.armorHitFormulaRedone, m.fixedStrengthDamageModifier, m.criticalStrikesIncreaseDamage], [true, true, true], 'the rest of the overhaul is untouched');
  assert.equal(modSetting('roleplay-realism', 'Enabled'), true);
  assert.equal(CONDITION_WEAR_SCALE, 1);
  assert.equal(DFU_WEAR_MULTIPLE, 1, 'WEAR-ONE (2026-10-02, "we need to buff gear durability because its really bad"): DFU\'s amount, not WEAR-TWICE\'s twice');
});

test('WEAR-VANILLA: with every mod on as shipped, a landed blow wears what DFU says (WEAR-ONE; WEAR-TWICE had it twice) - (10 x damage + 50) / 100 on the blade and on the struck piece - and a claw wears nothing; either mod\'s module back on wears more (mutants: a switch shipped on)', () => {
  _resetModSettings();
  const blade = longsword();
  const target = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const piece = equipTableOf(target)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), target, 30, blade, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(blade.maxCondition - blade.currentCondition, portWear(30), 'the blade: DFU\'s 3');
  assert.equal(piece.maxCondition - piece.currentCondition, portWear(30), 'the cuirass: DFU\'s 3');
  const clawed = piece.currentCondition;
  damageEquipment(foe(), target, 30, null, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(piece.currentCondition, clawed, 'a natural attack wears no armour, as in DFU');

  setModSetting('roleplay-realism', 'equipDamage', true);
  const t2 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p2 = equipTableOf(t2)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t2, 30, longsword(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(p2.maxCondition - p2.currentCondition, 30 * 5, 'Roleplay Realism\'s module on: armour x5');

  _resetModSettings();
  setModSetting('pcaao', 'equipmentDamageEnhanced', true);
  const t3 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p3 = equipTableOf(t3)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t3, 30, longsword(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.ok(p3.maxCondition - p3.currentCondition > dfuWear(30) * 5, 'the overhaul\'s module on: many times DFU\'s on the piece');
  const t4 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p4 = equipTableOf(t4)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t4, 30, null, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.ok(p4.currentCondition < p4.maxCondition, '...and a claw wears it');
  _resetModSettings();
});

test('WEAR-VANILLA: a player\'s broken enchanted piece breaks and STAYS in the pack, repairable; the fading module back on still takes it (mutants: fading shipped on)', () => {
  const helm = () => ({ group: 'Armor', templateIndex: 107, material: 0x0201, name: 'Helm', enchantments: [{ type: 5, param: 1 }] });
  _resetModSettings();
  const me = armed(helm(), EQUIP_SLOTS.Head, { isPlayer: true, items: [], activeEffects: [], stats: { strength: 50 } });
  const worn = me.items[0];
  worn.currentCondition = 1;
  damageEquipment(foe(), me, 30, longsword(), BODY_PARTS.Head, { rolls: () => 0.99 });
  assert.equal(worn.currentCondition, 0, 'broken');
  assert.equal(me.items.includes(worn), true, 'and kept');
  // AUDIT ECON (records): and REPAIRABLE - a smith takes an enchanted piece under AllowMagicRepairs, which ships on
  assert.equal(getBool('Controls', 'AllowMagicRepairs'), true, 'the setting ships on');
  assert.equal(repairRefusal(worn, { allowMagicRepairs: getBool('Controls', 'AllowMagicRepairs') }), null, 'a smith repairs it');

  setModSetting('pcaao', 'equipmentDamageEnhanced', true); setModSetting('pcaao', 'fadingEnchantedItems', true);
  const me2 = armed(helm(), EQUIP_SLOTS.Head, { isPlayer: true, items: [], activeEffects: [], stats: { strength: 50 } });
  const worn2 = me2.items[0];
  worn2.currentCondition = 1;
  damageEquipment(foe(), me2, 30, longsword(), BODY_PARTS.Head, { rolls: () => 0.99 });
  assert.equal(me2.items.includes(worn2), false, 'a player who turns both back on gets the mod\'s fading');
  _resetModSettings();
});

test('WEAR-VANILLA: online the room reads the three off, whatever the player saved (mutants: the room\'s armour x5 left on)', () => {
  _resetModSettings();
  for (const [vendor, key] of WEAR_KEYS) setModSetting(vendor, key, true);
  for (const [vendor, key] of WEAR_KEYS) assert.equal(onlineModSetting(vendor, key, '?online=1'), false, `${vendor}/${key}: the room's off`);
  assert.equal(onlineForcedModSetting('roleplay-realism', 'equipDamage', '?online=1'), false, 'Roleplay Realism\'s is a room key, forced off');
  assert.equal(modSetting('pcaao', 'equipmentDamageEnhanced'), true, 'offline the saved choice stands');
  _resetModSettings();
});

test('WEAR-VANILLA: a value saved under the old default is let go once, and a choice made after the reset stands (mutants: an entry dropped from SWITCH_RESETS)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings';
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    _resetModSettings();
    store.set(K, JSON.stringify({ pcaao: { Enabled: true, equipmentDamageEnhanced: true, fadingEnchantedItems: true }, 'roleplay-realism': { equipDamage: true, bandaging: false } }));
    for (const [vendor, key] of WEAR_KEYS) assert.equal(modSetting(vendor, key), false, `${vendor}/${key}: the old saved on is let go`);
    assert.equal(modSetting('roleplay-realism', 'bandaging'), false, 'every other saved choice stands');
    assert.deepEqual(JSON.parse(store.get(K)), { pcaao: { Enabled: true }, 'roleplay-realism': { bandaging: false } }, 'written back without them');
    setModSetting('pcaao', 'equipmentDamageEnhanced', true);
    const saved = store.get(K);
    _resetModSettings(); store.set(K, saved);   // a reload
    assert.equal(modSetting('pcaao', 'equipmentDamageEnhanced'), true, 'chosen after the reset: stamped, and kept');
    const stamps = SWITCH_RESETS.filter((r) => r.stamp.endsWith('@WEAR-VANILLA')).map((r) => `${r.vendor}/${r.key}`);
    assert.deepEqual(stamps, WEAR_KEYS.map(([v, k]) => `${v}/${k}`));
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('WEAR-VANILLA: through the overhaul\'s own attack core - its redone armour formula on, as shipped - a landed blow wears DFU\'s amount with the weapon it was struck with, a monster\'s stand-in weapon wears no armour, and the wear module back on wears the overhaul\'s way again (mutants: the core always wearing its way; the stand-in handed to DFU\'s wear)', () => {
  _resetModSettings();
  assert.equal(pcaaoModules().armorHitFormulaRedone, true, 'the core is the overhaul\'s');
  const stats = { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 };
  const career = () => ({ ...stats, attackModifierFlags: 0 });
  const me = { isPlayer: true, level: 10, raceId: 1, stats, skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 70])), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 500, maxHealth: 500, items: [], activeEffects: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  const pieces = Object.values(BODY_PARTS).map((part) => armed(cuirass(), slotForBodyPart(part), me) && equipTableOf(me)[slotForBodyPart(part)]);
  const worn = () => pieces.reduce((n, p) => n + p.maxCondition - p.currentCondition, 0);
  const monster = (id) => ({ ...makeEnemyEntity(id, ENEMY_BASICS[id], career(), 10, () => 0.5), activeEffects: [] });
  let seed = 11; const rolls = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };
  const dfRand = () => Math.floor(rolls() * 32768);
  const slot = formulaOverride('applyConditionDamageThroughPhysicalHit');
  const seen = [];
  registerFormulaOverride('applyConditionDamageThroughPhysicalHit', (item, owner, damage, opts) => { seen.push({ item, damage }); return slot ? slot(item, owner, damage, opts) : false; });
  try {
    // my blade on a rat: every landed blow is DFU's DamageEquipment's, and wears it (10 x damage + 50) / 100
    const blade = longsword();
    let landed = 0;
    for (let i = 0; i < 60; i++) {
      const before = blade.currentCondition;
      seen.length = 0;
      const d = calculateAttackDamage(me, monster(0), { weapon: blade, rolls, dfRand });
      if (!(d > 0)) continue;
      landed++;
      const mine = seen.filter((x) => x.item === blade);
      assert.equal(mine.length, 1, 'DFU\'s DamageEquipment wore the blade');
      const amount = portWear(mine[0].damage);
      if (amount > 0) assert.equal(before - blade.currentCondition, amount, `${mine[0].damage} damage: DFU's ${amount}`);
    }
    assert.ok(landed > 5, `the blows land (${landed})`);
    // the Skeletal Warrior strikes with the overhaul's stand-in axe: DFU has no such weapon, so no armour wears
    seen.length = 0;
    let struck = 0;
    for (let i = 0; i < 40; i++) struck += calculateAttackDamage(monster(15), me, { rolls, dfRand }) > 0 ? 1 : 0;
    assert.ok(struck > 0, 'its blows land');
    assert.equal(worn(), 0, 'and wear nothing');
    assert.equal(seen.length, 0);
    // the wear module back on: the overhaul's own wear, by its own path, the stand-in axe wearing my armour
    setModSetting('pcaao', 'equipmentDamageEnhanced', true);
    for (let i = 0; i < 40; i++) calculateAttackDamage(monster(15), me, { rolls, dfRand });
    assert.ok(worn() > 0, 'on: the axe wears my armour');
    assert.equal(seen.length, 0, 'and never through DFU\'s member');
  } finally {
    registerFormulaOverride('applyConditionDamageThroughPhysicalHit', slot);
    _resetModSettings();
  }
});

test('WEAR-VANILLA: through the core, an armed Knight\'s blow on an iron-clad player wears his weapon and the struck piece DFU\'s amount of THE DAMAGE IT DEALT - after the armour\'s reduction (AUDIT ECON W1) - every draw from the rolls the core was handed, and a piece it breaks says so; an Orc whose own row out-hits his sabre strikes with his natural attack and wears nothing (mutants: the damage before the reduction; the sabre handed before the swap; the struck part dropped; a foe\'s blows wearing nothing; the floor roll off Math.random; the voice dropped; the module\'s stand-in left out)', () => {
  _resetModSettings();
  const stats = { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 };
  const me = { isPlayer: true, level: 10, raceId: 1, stats, skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 60])), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0, attackModifierFlags: 0 }, health: 1e6, maxHealth: 1e6, items: [], activeEffects: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  const pieces = [102, 103, 104, 105, 106, 107, 108, 111].map((t) => mintCondition({ group: 'Armor', templateIndex: t, material: 0x0200, name: `piece ${t}` }));
  for (const p of pieces) { me.items.push(p); equipItem(me, p); }
  const lost = () => pieces.reduce((n, p) => n + p.maxCondition - p.currentCondition, 0);
  let seed = 23; const rolls = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 100000) / 100000; };
  const dfRand = () => Math.floor(rolls() * 32768);
  const foeOf = (id) => { const e = makeEnemyEntity(id, ENEMY_BASICS[id], { ...stats, attackModifierFlags: 0 }, 10, rolls); e.items = []; e.activeEffects = []; equipEnemy(e, id, 10, rolls); return e; };
  const slot = formulaOverride('applyConditionDamageThroughPhysicalHit');
  const seen = [];
  registerFormulaOverride('applyConditionDamageThroughPhysicalHit', (item, owner, damage, opts) => { seen.push({ item, damage }); return slot ? slot(item, owner, damage, opts) : false; });
  const knight = foeOf(145), orc = foeOf(7);   // the spawns draw off Math.random of their own (a weapon's poison roll)
  const random = Math.random;
  Math.random = () => { throw new Error('a draw off the rolls the core was handed'); };
  try {
    const flail = chooseEnemyWeapon(knight.weapon, ENEMY_BASICS[145]);   // the host's own call (dungeonContext, exteriorFoes)
    assert.ok(flail, 'the Knight is armed');
    let exact = 0, floor = 0;
    for (let i = 0; i < 300; i++) {
      for (const p of pieces) p.currentCondition = p.maxCondition;
      flail.currentCondition = flail.maxCondition;
      seen.length = 0;
      const d = calculateAttackDamage(knight, me, { weapon: flail, rolls, dfRand });
      const armour = lost(), weapon = flail.maxCondition - flail.currentCondition;
      if (!(d > 0)) { assert.deepEqual([armour, weapon, seen.length], [0, 0, 0], 'a blow that deals nothing wears nothing'); continue; }
      assert.deepEqual(seen.map((x) => x.damage), [d, d], `the member was handed the ${d} the blow dealt - his weapon's, then the piece's`);
      assert.equal(seen[0].item, flail);
      assert.ok(pieces.includes(seen[1].item), 'the struck piece is mine');
      if (dfuWear(d) > 0) { assert.deepEqual([armour, weapon], [portWear(d), portWear(d)], `${d} damage: DFU's ${dfuWear(d)}`); exact++; } else { assert.ok([0, DFU_WEAR_MULTIPLE].includes(armour) && [0, DFU_WEAR_MULTIPLE].includes(weapon), 'under 5: the 20% floor roll\'s 1, or nothing'); floor++; }
    }
    // PIN MOVED (BAL2, bible/05-Combat/Balance-Arc.md section 4): the Knight hits and crits by the player's rule now, so
    // fewer of his blows fall under 5 - of these 300, 29 or 52 by the spawn's own Math.random draw (it was 80 or 105);
    // both kinds still land, the floor's at 20
    assert.ok(exact >= 100 && floor >= 20, `both kinds of blow land (${exact} worn by the amount, ${floor} by the floor roll)`);
    // a piece the blow breaks says so
    const said = [];
    for (let i = 0; i < 300 && !said.length; i++) {
      for (const p of pieces) p.currentCondition = 1;
      calculateAttackDamage(knight, me, { weapon: flail, rolls, dfRand, say: (t) => said.push(t) });
    }
    assert.match(said.join('|'), /piece \d+ has broken\./);
    for (const p of pieces) { p.currentCondition = p.maxCondition; if (!me.items.includes(p)) me.items.push(p); equipItem(me, p); }
    // the Orc with a sabre (his spawn's at the probe's draws): the host keeps it (the base row's 1-6 averages under it),
    // the core reads his own row's 6-13 and strikes with his natural attack - and DFU wears nothing for one
    const sabre = weaponOfMaterial(119, 1);
    assert.equal(chooseEnemyWeapon(sabre, ENEMY_BASICS[7]), sabre, 'the host hands him his sabre');
    assert.deepEqual([orc.basics.minDamage, orc.basics.maxDamage], [6, 13], 'his own row');
    seen.length = 0;
    let struck = 0;
    for (let i = 0; i < 200; i++) struck += calculateAttackDamage(orc, me, { weapon: sabre, rolls, dfRand }) > 0 ? 1 : 0;
    assert.ok(struck > 20, `his blows land (${struck})`);
    assert.deepEqual([lost(), sabre.maxCondition - sabre.currentCondition, seen.length], [0, 0, 0], 'and wear nothing - neither my armour nor his sabre');
  } finally {
    Math.random = random;
    registerFormulaOverride('applyConditionDamageThroughPhysicalHit', slot);
    _resetModSettings();
  }
  // the module on: the overhaul's own wear, handed the weapon the core assigned - a monster's stand-in among them
  assert.match(readFileSync(new URL('../src/combat/pcaao.js', import.meta.url), 'utf8'), /if \(modules\.equipmentDamageEnhanced\) pcaaoDamageEquipment\(attacker, target, damage, weapon, struckBodyPart, \{ rolls, say, modules \}\);/);
});

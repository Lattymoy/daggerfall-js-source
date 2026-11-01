// RRI1 - ROLEPLAY & REALISM: ITEMS 1.3 (Hazelnut & Ralzar), THE ITEMS,
// 1:1 (2026-09-23). The fourteen custom item classes as the release's
// scripts write them, the template rows and patches (OWN-WORK3: ours,
// by RRI_ROW_RULE), the 280 sprites with their <rect>s, and the mod's
// switches (our words). The pins execute the classes
// through the port's OWN law sites - DFU's virtual dispatch is a table
// here, and a table nobody dispatches to is not a port - and hold each
// answer to the C#.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RRI_MOD, RRI_VENDOR, RRI_TEMPLATES, RRI_TEMPLATE_PATCHES, RRI_ROW_RULE, RRI_ROW_FROM, RRI_CLASSES, RRI_TEXT, FIRST_FEMALE_ARCHIVE,
  leatherMaterialArmorValue, chainmailMaterialArmorValue, customItemClass, rriCustomItemsForGroup, rriVariantFields, rriSpriteEntries, rriEnabled, rriModule,
} from '../../src/systems/roleplayRealismItems/rriItems.js';
import { installRoleplayRealismItems, _resetRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { rriArtRecipe } from '../../src/systems/roleplayRealismItems/rriArt.js';
import { templateByIndex, templateOverrideCount, registerTemplateOverrides, inventoryItemImage, setItemFields, ITEM_TEMPLATES } from '../../src/systems/item/itemTemplates.js';
import { paperdollItemImage } from '../../src/ui/paperDoll.js';
import { ARMOR_MATERIAL, armorArchive, itemArmorValue, registerCustomArmorValue } from '../../src/systems/armorMaterials.js';
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed, equipSoundFor, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { getItemHands, ITEM_HANDS, createEquipTable } from '../../src/characters/equipTable.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { swingSoundFor, SOUND, registerSwingSound } from '../../src/systems/soundClips.js';
import { itemEnchantmentPower, armorEnchantmentMultiplier } from '../../src/systems/enchanting.js';
import { createRandomWeapon, createRandomArmor } from '../../src/systems/loot/loot.js';
import { SKILLS } from '../../src/systems/skills.js';
import { DYE_COLORS, DYE_TARGETS } from '../../src/characters/dyes.js';
import { raceByKey } from '../../src/systems/races.js';
import {
  clearVendorTextures, vendorTextureCount, isVendorArchive, vendorRecordCount, vendorTextureStandIn, hasTextureReplacement, preloadTextureRecord, preloadTextureArchive, decodedTexture,
} from '../../src/systems/textureReplacement.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { FEATURES } from '../../src/systems/features.js';
import { RRI_SPRITES } from '../../src/systems/roleplayRealismItems/rriIndex.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const M = ARMOR_MATERIAL;
/** OWN-WORK4: a classic reader for the pins - every record one small picture, every ask written down. */
const fakeArt = (loads) => ({ picture: async (archive, record) => { loads.push(`${archive}_${record}`); return { width: 2, height: 2, data: new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]) }; } });

function fresh({ enabledAtBoot = true } = {}) {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismItems(); registerTemplateOverrides([]); registerCustomArmorValue(null);
  for (const c of Object.values(RRI_CLASSES)) registerSwingSound(c.index, null);
  const loads = [];
  const n = installRoleplayRealismItems({ art: fakeArt(loads), enabledAtBoot });
  return { n, loads };
}
function done() { _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismItems(); registerTemplateOverrides([]); registerCustomArmorValue(null); for (const c of Object.values(RRI_CLASSES)) registerSwingSound(c.index, null); }

test('RRI1 templates (OWN-WORK3): the fourteen rows by our rule from the classic slot piece, registered past the classic 288; our seven patches merged over classic rows while the mod is on at boot, and not otherwise', () => {
  // the rule, against the classic rows: weight to 0.05 kg, the rest whole; order, pictures and body record the slot's
  const r05 = (x) => Number((Math.round(x / 0.05) * 0.05).toFixed(2));
  for (const t of RRI_TEMPLATES) {
    const [set, from] = RRI_ROW_FROM[t.index], f = RRI_ROW_RULE[set], c = ITEM_TEMPLATES[from], weapon = set === 'weapon';
    assert.deepEqual([t.baseWeight, t.hitPoints, t.basePrice, t.enchantmentPoints, t.rarity], [r05(c.baseWeight * f.weight), Math.round(c.hitPoints * f.hitPoints), Math.round(c.basePrice * f.price), Math.round(c.enchantmentPoints * f.enchantment), f.rarity], `${t.name}: by the rule from ${c.name}`);
    assert.deepEqual([t.drawOrderOrEffect, t.worldTextureArchive, t.worldTextureRecord, t.isBluntWeapon], [c.drawOrderOrEffect, c.worldTextureArchive, c.worldTextureRecord, c.isBluntWeapon], `${t.name}: the slot's facts`);
    assert.deepEqual([t.playerTextureArchive, t.playerTextureRecord, t.variants, t.isOneHanded], weapon ? [t.index, 0, 0, true] : [c.playerTextureArchive, c.playerTextureRecord, 1, false], `${t.name}: the art's archive`);
  }
  assert.deepEqual({ ...RRI_ROW_RULE.chain }, { weight: 0.75, hitPoints: 0.6, price: 0.7, enchantment: 0.85, rarity: 3 });
  assert.deepEqual({ ...RRI_ROW_RULE.light }, { weight: 0.5, hitPoints: 0.4, price: 0.55, enchantment: 0.7, rarity: 2 });
  assert.deepEqual({ ...RRI_ROW_RULE.weapon }, { weight: 0.5, hitPoints: 0.5, price: 0.75, enchantment: 0.9, rarity: 1 });
  assert.deepEqual(RRI_TEMPLATES.map((t) => [t.index, t.name, t.baseWeight, t.hitPoints, t.basePrice, t.enchantmentPoints]), [
    [513, 'Hatchet', 3, 600, 15, 473], [514, 'Short Flail', 3.5, 500, 11, 405],
    [515, 'Coat', 9.4, 2458, 70, 340], [516, 'Leggings', 1.9, 1843, 56, 43], [517, 'Left Sleeve', 1.5, 1229, 42, 34], [518, 'Right Sleeve', 1.5, 1229, 42, 34], [519, 'Footguards', 1.5, 1536, 35, 149],
    [520, 'Jacket', 6.25, 1638, 55, 280], [521, 'Trousers', 1.25, 1229, 44, 35], [522, 'Cap', 1.25, 1024, 44, 630], [523, 'Half-boots', 1, 1024, 28, 122], [524, 'Gloves', 0.65, 819, 28, 280],
    [525, 'Left Armguard', 1, 819, 33, 28], [526, 'Right Armguard', 1, 819, 33, 28],
  ], 'our rows, our names');
  assert.deepEqual(RRI_TEMPLATE_PATCHES.map((t) => ({ ...t })), [
    { index: 131, baseWeight: 0.05 }, { index: 247, baseWeight: 0.4 }, { index: 249, baseWeight: 0.1 }, { index: 252, baseWeight: 0.2 },
    { index: 275, baseWeight: 0.05 }, { index: 278, baseWeight: 0.05 }, { index: 279, baseWeight: 0.05 },
  ], 'our patches: small goods weigh what they would');
  try {
    fresh();
    assert.equal(templateByIndex(513).name, 'Hatchet'); assert.equal(templateByIndex(513).custom, true);
    assert.equal(templateByIndex(526).name, 'Right Armguard'); assert.equal(templateByIndex(526).playerTextureArchive, 245);
    // the patches: ItemHelper.LoadItemTemplates merges by index at load
    assert.equal(templateOverrideCount(), 7);
    assert.equal(templateByIndex(247).baseWeight, 0.4, 'a torch at 0.4 kg (was 0.5)'); assert.equal(templateByIndex(247).weight, 0.4, 'the port\'s alias follows');
    assert.equal(templateByIndex(247).worldTextureRecord, 6, 'its picture the classic one'); assert.equal(templateByIndex(247).name, 'Torch', 'the rest of the row is the classic row');
    assert.equal(templateByIndex(131).baseWeight, 0.05, 'an arrow at 0.05');
    assert.equal(templateByIndex(121).baseWeight, 2.5, 'a Katana is Daggerfall\'s');
    assert.equal(ITEM_TEMPLATES[247].baseWeight, 0.5, 'the frozen DFU table is untouched');
    // off at boot: no patches (DFU would not have loaded the mod)
    fresh({ enabledAtBoot: false });
    assert.equal(templateOverrideCount(), 0); assert.equal(templateByIndex(247).baseWeight, 0.5);
    assert.equal(templateByIndex(513)?.name, 'Hatchet', 'the rows stay registered - a saved Hatchet still resolves');
  } finally { done(); }
});

test('RRI1 switches: the mod\'s eleven modules and Enabled on the Mods pane, our own words (OWN-WORK3); a class answers only while the mod and its own switch are on (RegisterCustomItem under newWeapons / newArmor)', () => {
  const m = MOD_SETTINGS[RRI_VENDOR];
  const OURS = {
    lootRebalance: 'Foes and loot piles carry loot that fits them.',
    bandaging: 'Bandages stack, and a bandage heals you by your Medical skill.',
    conditionBasedPrices: 'A worn item is worth less, and loot you find is often worn.',
    storeQualityItemCondition: 'A poorer shop sells used goods.',
    realisticEnemyEquipment: 'Foes carry gear that suits their class, in any state of wear.',
    skillBasedStartingEquipment: 'You start with gear for your skills.',
    skillBasedStartingSpells: 'You start with spells for your magic skills.',
    weaponBalance: 'A heavier weapon swings slower and hits harder, so every weapon has a use.',
    newWeapons: 'Adds the Hatchet and the Short Flail.',
    newArmor: 'Adds light and chain armor for the chest, arms, legs, hands, feet and head.',
    alchemistPotions: 'Alchemists sell a few random potions at twice the price.',
  };
  for (const [k, words] of Object.entries(OURS)) { assert.equal(m.keys[k].default, true, k); assert.equal(m.keys[k].description, words, k); }
  assert.equal(Object.keys(m.keys).length, 12, 'plus Enabled');
  assert.equal(m.keys.Enabled.default, true, 'MO1');
  assert.equal(m.keys.Enabled.description, 'Two new weapons, a light and a chain armor set in every metal, and lighter arrows, paper and small goods.');
  assert.deepEqual({ ...RRI_MOD }, { guid: '68589945-3fbb-4d58-81a3-3066f3f08539', title: 'RoleplayRealism-Items', version: '1.3', author: 'Hazelnut & Ralzar' });
  try {
    _resetModSettings();
    assert.equal(rriEnabled(), true); assert.equal(rriModule('newWeapons'), true);
    assert.ok(customItemClass(513) && customItemClass(520));
    assert.deepEqual(rriCustomItemsForGroup('Weapons'), [513, 514]);
    assert.deepEqual(rriCustomItemsForGroup('Armor'), [515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526], 'the chain five, then the leather seven - InitMod\'s order');
    setModSetting(RRI_VENDOR, 'newWeapons', false);
    assert.equal(customItemClass(513), null, 'newWeapons off: the class is not registered'); assert.ok(customItemClass(520)); assert.deepEqual(rriCustomItemsForGroup('Weapons'), []);
    setModSetting(RRI_VENDOR, 'newWeapons', true); setModSetting(RRI_VENDOR, 'newArmor', false);
    assert.ok(customItemClass(513)); assert.equal(customItemClass(520), null); assert.deepEqual(rriCustomItemsForGroup('Armor'), []);
    setModSetting(RRI_VENDOR, 'newArmor', true); setModSetting(RRI_VENDOR, 'Enabled', false);
    assert.equal(customItemClass(513), null); assert.equal(customItemClass(520), null); assert.equal(rriModule('newArmor'), false, 'Enabled off: no module is on');
    assert.equal(customItemClass(102), null, 'a classic template has no class');
  } finally { _resetModSettings(); }
});

test('RRI1 the two weapons: ItemArchersAxe (513) and ItemLightFlail (514) through the port\'s law sites - damage 2-10 and 3-10, Axes and BluntWeapons, Either hand, the battleaxe and flail sheets (magic when enchanted), the equip and swing sounds, their own inventory archive at record 0 and the right hand\'s record 1 on the doll', () => {
  try {
    fresh();
    assert.deepEqual([weaponMinDamage(513), weaponMaxDamage(513)], [2, 10]);
    assert.deepEqual([weaponMinDamage(514), weaponMaxDamage(514)], [3, 10]);
    assert.equal(weaponSkillUsed(513), SKILLS.Axe); assert.equal(weaponSkillUsed(514), SKILLS.BluntWeapon);
    const axe = { group: 'Weapons', templateIndex: 513, material: WEAPON_MATERIALS.Iron, dyeColor: DYE_COLORS.Iron };
    const flail = { group: 'Weapons', templateIndex: 514, material: WEAPON_MATERIALS.Steel, dyeColor: DYE_COLORS.Steel };
    assert.equal(getItemHands(axe), ITEM_HANDS.Either); assert.equal(getItemHands(flail), ITEM_HANDS.Either);
    assert.equal(weaponTypeForItem(axe), WEAPON_TYPES.Battleaxe); assert.equal(weaponTypeForItem({ ...axe, enchantments: [{ type: 1, param: 1 }] }), WEAPON_TYPES.Battleaxe_Magic, 'IsEnchanted: the magic sheet');
    assert.equal(weaponTypeForItem(flail), WEAPON_TYPES.Flail);
    assert.equal(equipSoundFor(axe), SOUND.EquipAxe); assert.equal(equipSoundFor(flail), SOUND.EquipFlail);
    assert.equal(swingSoundFor(axe), SOUND.SwingMediumPitch); assert.equal(swingSoundFor(flail), SOUND.SwingMediumPitch);
    assert.deepEqual(inventoryItemImage(axe), { archive: 513, record: 0, dye: DYE_COLORS.Iron, dyeTarget: DYE_TARGETS.WeaponsAndArmor }, 'InventoryTextureArchive is the template index; the record the template\'s (DYE-ICON: and the metal swatch its dye changes)');
    assert.deepEqual(inventoryItemImage(flail, { gender: 'female', race: 'Breton' }), { archive: 514, record: 0, dye: DYE_COLORS.Steel, dyeTarget: DYE_TARGETS.WeaponsAndArmor }, 'no female archive-1 for a custom weapon');
    const doll = paperdollItemImage({ ...axe, equipSlot: EQUIP_SLOTS.RightHand }, { gender: 'male', race: 'Breton' });
    assert.deepEqual([doll.archive, doll.record, doll.dye], [513, 1, DYE_COLORS.Iron], 'an Either-hand weapon worn right takes record + 1 (ItemHelper.cs:412-414)');
    assert.equal(paperdollItemImage({ ...axe, equipSlot: EQUIP_SLOTS.LeftHand }).record, 0);
    assert.equal(RRI_CLASSES[513].groupIndex, 3); assert.equal(RRI_CLASSES[514].groupIndex, 6, 'GroupIndex, as the classes state it');
    // the slot: Either -> the first open hand
    const table = createEquipTable();
    assert.equal(table.getEquipSlot({ group: ITEM_GROUPS.Weapons, templateIndex: 513 }), EQUIP_SLOTS.RightHand);
    // off: the classic tables' answers for an index they do not hold
    setModSetting(RRI_VENDOR, 'newWeapons', false);
    assert.deepEqual([weaponMinDamage(513), weaponMaxDamage(513), weaponSkillUsed(513), getItemHands(axe)], [0, 0, null, ITEM_HANDS.None]);
  } finally { done(); }
});

test('RRI1 the armor classes: the two material tables cell for cell, the slots, the folded NativeMaterialValue, the enchantment power off the raw material, the leather set\'s equip sound', () => {
  const D = { [M.Leather]: [3, 3], [M.Chain]: [6, 5], [M.Chain2]: [6, 5], [M.Iron]: [5, 6], [M.Steel]: [7, 8], [M.Silver]: [7, 8], [M.Elven]: [8, 9], [M.Dwarven]: [9, 11], [M.Mithril]: [11, 13], [M.Adamantium]: [11, 13], [M.Ebony]: [12, 15], [M.Orcish]: [13, 17], [M.Daedric]: [14, 18] };
  for (const [mat, [light, chain]] of Object.entries(D)) {
    assert.equal(leatherMaterialArmorValue(Number(mat), 0), light, `light ${mat}`);
    assert.equal(chainmailMaterialArmorValue(Number(mat)), chain, `chain ${mat}`);
  }
  assert.equal(leatherMaterialArmorValue(M.Leather, 1), 5, 'fur (message 1) is 5 where leather is 3');
  assert.equal(leatherMaterialArmorValue(-1, 0), 0); assert.equal(chainmailMaterialArmorValue(-1), 0);
  try {
    fresh();
    // through the port's one armor-value read
    assert.equal(itemArmorValue({ group: 'Armor', templateIndex: 515, material: M.Iron }), 6, 'an Iron Chain Coat');
    assert.equal(itemArmorValue({ group: 'Armor', templateIndex: 520, material: M.Leather, message: 1 }), 5, 'a Fur-lined Jacket');
    assert.equal(itemArmorValue({ group: 'Armor', templateIndex: 520, material: M.Daedric }), 14, 'a Daedric Plated Jacket');
    assert.equal(itemArmorValue({ group: 'Armor', templateIndex: 522, material: M.Iron }), 5, 'the helmet takes the light table');
    assert.equal(itemArmorValue({ group: 'Armor', templateIndex: 102, material: M.Iron }), 7, 'a classic cuirass keeps GetMaterialArmorValue');
    // the slots (GetEquipSlot)
    const table = createEquipTable();
    const slots = { 515: 'ChestArmor', 516: 'LegsArmor', 517: 'LeftArm', 518: 'RightArm', 519: 'Feet', 520: 'ChestArmor', 521: 'LegsArmor', 522: 'Head', 523: 'Feet', 524: 'Gloves', 525: 'LeftArm', 526: 'RightArm' };
    for (const [i, s] of Object.entries(slots)) assert.equal(table.getEquipSlot({ group: ITEM_GROUPS.Armor, templateIndex: Number(i) }), EQUIP_SLOTS[s], `${i} -> ${s}`);
    assert.equal(getItemHands({ group: 'Armor', templateIndex: 515 }), ITEM_HANDS.None);
    // NativeMaterialValue, the folded reading (inert for these classes - their own GetEnchantmentPower reads the raw field - and recorded)
    assert.equal(RRI_CLASSES[515].nativeMaterialValue({ material: M.Iron }), M.Iron - 0x0100, 'the chain set folds a plate material by 0x0100');
    assert.equal(RRI_CLASSES[520].nativeMaterialValue({ material: M.Iron }), M.Leather, 'the light set by 0x0200');
    assert.equal(RRI_CLASSES[520].nativeMaterialValue({ material: M.Chain }), M.Chain, 'below Iron, unchanged');
    // GetEnchantmentPower: points + floor(points * the RAW material's multiplier)
    assert.equal(itemEnchantmentPower({ group: 'Armor', templateIndex: 515, material: M.Daedric }), 340 + Math.floor(340 * armorEnchantmentMultiplier(M.Daedric)));
    assert.equal(itemEnchantmentPower({ group: 'Armor', templateIndex: 522, material: M.Leather }), 630 + Math.floor(630 * armorEnchantmentMultiplier(M.Leather)));
    assert.equal(equipSoundFor({ group: 'Armor', templateIndex: 520, material: M.Iron }), SOUND.EquipLeather, 'the light set: EquipLeather (417)');
    assert.equal(equipSoundFor({ group: 'Armor', templateIndex: 515, material: M.Iron }), null, 'the chain set: SoundClips.None, as the base class');
    assert.equal(SOUND.EquipLeather, 417);
  } finally { done(); }
});

test('RRI1 the CurrentVariant setter, once at the mint: a plate material is Plated / Chain in the name (OWN-WORK3: our words), Chain on the light set is FUR-LINED - folded to Leather, message 1, the jerkin 2 kg lighter - and a second read does not prefix twice', () => {
  try {
    fresh();
    assert.deepEqual(rriVariantFields({ templateIndex: 520, name: 'Jacket', material: M.Chain, weightInKg: 8 }), { name: 'Fur-lined Jacket', material: M.Leather, message: 1, weightInKg: 6 });
    assert.deepEqual(rriVariantFields({ templateIndex: 523, name: 'Half-boots', material: M.Chain }), { name: 'Fur-lined Half-boots', material: M.Leather, message: 1, weightInKg: 1 }, 'the other light pieces keep the CHAIN stage\'s weight - the template\'s, stored (AUDIT-RR F5)');
    assert.deepEqual(rriVariantFields({ templateIndex: 520, name: 'Jacket', material: M.Iron }), { name: 'Plated Jacket' });
    assert.deepEqual(rriVariantFields({ templateIndex: 520, name: 'Jacket', material: M.Leather }), {}, 'leather is leather');
    assert.deepEqual(rriVariantFields({ templateIndex: 515, name: 'Coat', material: M.Daedric }), { name: 'Chain Coat' });
    assert.deepEqual(rriVariantFields({ templateIndex: 515, name: 'Coat', material: M.Chain }), {}, 'the chain set has no fur');
    assert.equal(rriVariantFields({ templateIndex: 513, name: 'Hatchet' }), null, 'a weapon has no setter');
    assert.equal(rriVariantFields({ templateIndex: 102, name: 'Cuirass', material: M.Iron }), null);
    assert.deepEqual(RRI_TEXT, { mail: 'Chain ', fur: 'Fur-lined ', brig: 'Plated ' }, 'OWN-WORK3: our three words');
    const minted = setItemFields({ group: 'Armor', templateIndex: 520, material: M.Chain });
    assert.equal(minted.name, 'Fur-lined Jacket'); assert.equal(minted.material, M.Leather); assert.equal(minted.message, 1); assert.equal(minted.rriVariant, true);
    const again = setItemFields(minted);
    assert.equal(again.name, 'Fur-lined Jacket', 'marked: not "Fur-lined Fur-lined Jacket"');
    const brig = setItemFields({ group: 'Armor', templateIndex: 520, material: M.Iron });
    assert.equal(brig.name, 'Plated Jacket');
    assert.equal(setItemFields(setItemFields(brig)).name, 'Plated Jacket', 'a plate material keeps its material, so the mark alone stops the second prefix');
    assert.equal(setItemFields({ group: 'Armor', templateIndex: 102, material: M.Iron }).name, 'Cuirass', 'a classic row is untouched');
  } finally { done(); }
});

test('RRI1 InventoryTextureRecord: the chain set by material on the body\'s archive, the light set by body and material on its own archive (the female rows 2/16, the male 6/17, brigandine +8, fur its own), the helmet\'s four rows, Chausses\' middle arm', () => {
  try {
    fresh();
    const her = { gender: 'female', race: 'Breton' }, him = { gender: 'male', race: 'Breton' };
    const body = (id) => armorArchive(id.gender, raceByKey(id.race).morphologyIndex);
    // the chain set: the template's archive (the body's), record by material
    assert.deepEqual(inventoryItemImage({ group: 'Armor', templateIndex: 515, material: M.Leather }, her), { archive: body(her), record: 3, dye: DYE_COLORS.Unchanged, dyeTarget: DYE_TARGETS.WeaponsAndArmor });
    assert.deepEqual(inventoryItemImage({ group: 'Armor', templateIndex: 515, material: M.Iron }, him), { archive: body(him), record: 7, dye: DYE_COLORS.Iron, dyeTarget: DYE_TARGETS.WeaponsAndArmor });
    assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: 516, material: M.Chain }, her).record, 11, 'Chausses: chain-family materials draw 11');
    assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: 516, material: M.Leather }, her).record, 10);
    assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: 516, material: M.Silver }, her).record, 16);
    assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: 519, material: M.Daedric }, her).record, 0, 'Sollerets: always 0');
    assert.deepEqual([517, 518].map((i) => [inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather }).record, inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Steel }).record]), [[17, 21], [22, 26]]);
    // the light set: its own archive; offset = PlayerTextureArchive - 245 -> 2 (her) or 6 (him)
    assert.equal(FIRST_FEMALE_ARCHIVE, 245);
    for (const [i, name] of [[520, 'jerkin'], [521, 'cuisse'], [523, 'boots'], [524, 'gloves'], [525, 'left vambrace'], [526, 'right vambrace']]) {
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather }, her).archive, i, `${name}: its own archive`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather }, her).record, 16, `${name} leather, her`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather }, him).record, 17, `${name} leather, him`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather, message: 1 }, her).record, 2, `${name} fur, her`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Leather, message: 1 }, him).record, 6, `${name} fur, him`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Iron }, her).record, 10, `${name} brigandine, her: 8 + 2`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Daedric }, him).record, 14, `${name} brigandine, him: 8 + 6`);
      assert.equal(inventoryItemImage({ group: 'Armor', templateIndex: i, material: M.Daedric }, him).dye, DYE_COLORS.Daedric);
    }
    // the helmet: four body rows off the morphology offset
    const helm = (mat, id, message = 0) => inventoryItemImage({ group: 'Armor', templateIndex: 522, material: mat, message }, id);
    // PlayerTextureArchive - 245: her 0..3 by body morphology (Argonian 0, Elf 1, Human 2, Khajiit 3), him 4..7
    for (const gender of ['female', 'male']) {
      for (const race of ['Argonian', 'HighElf', 'Breton', 'Khajiit']) {
        const offset = armorArchive(gender, raceByKey(race).morphologyIndex) - FIRST_FEMALE_ARCHIVE;
        const want = offset === 0 ? [1, 18] : offset <= 3 ? [2, 16] : (offset === 4 || offset === 6) ? [6, 17] : [5, 19];
        const id = { gender, race };
        assert.equal(helm(M.Leather, id, 1).record, want[0], `${gender} ${race} (offset ${offset}) fur helmet`);
        assert.equal(helm(M.Iron, id).record, 8 + want[0], `${gender} ${race} brigandine helmet`);
        assert.equal(helm(M.Leather, id).record, want[1], `${gender} ${race} leather helmet`);
      }
    }
    // the same virtuals on the doll (GetItemImage forPaperDoll reads the same two)
    const d = paperdollItemImage({ group: 'Armor', templateIndex: 520, material: M.Iron }, her);
    assert.deepEqual([d.archive, d.record, d.dye], [520, 10, DYE_COLORS.Iron]);
    const h = paperdollItemImage({ group: 'Armor', templateIndex: 515, material: M.Leather }, him);
    assert.deepEqual([h.archive, h.record, h.dye], [body(him), 3, DYE_COLORS.Unchanged]);
  } finally { done(); }
});

test('RRI1 the art: 280 pictures by DFU\'s names with their <rect>s, registered as lazy, gated stand-in entries by dye (the helmet\'s masks under TextureMap.Mask); the stand-in answers a record\'s size and doll offset across dyes; OWN-WORK4: each one ours, built - no file, no derived spec', async () => {
  const entries = rriSpriteEntries();
  assert.equal(entries.length, 280);
  assert.equal(Object.keys(RRI_SPRITES).length, 280);
  assert.deepEqual([...new Set(entries.map((e) => e.archive))].sort((a, b) => a - b), [513, 514, 520, 521, 522, 523, 524, 525, 526]);
  assert.equal(entries.filter((e) => e.map === 'Mask').length, 48, 'the helmet\'s masks (dyed and bare)');
  assert.ok(entries.filter((e) => e.map === 'Mask').every((e) => e.archive === 522));
  assert.equal(entries.filter((e) => e.rect).length, 232);
  const iron = entries.find((e) => e.name === '520_10-0_Iron');
  assert.deepEqual([iron.archive, iron.record, iron.frame, iron.dye, iron.map, iron.width, iron.height], [520, 10, 0, DYE_COLORS.Iron, 'Albedo', RRI_SPRITES['520_10-0_Iron'][0], RRI_SPRITES['520_10-0_Iron'][1]]);
  assert.deepEqual(iron.rect, { x: 37, y: 37, width: 44, height: 76 }, 'the <rect> beside it, TextureReplacement.OverridePaperdollItemRect\'s');
  assert.equal(entries.find((e) => e.name === '520_10-0').dye, null, 'the bare name: the leather ask');
  assert.ok(!entries.some((e) => e.dye === DYE_COLORS.Silver), 'no Silver entry could be asked for');
  try {
    const { n, loads } = fresh();
    assert.equal(n, 280); assert.equal(installRoleplayRealismItems(), 0, 'once');
    assert.equal(vendorTextureCount(), 280);
    assert.equal(isVendorArchive(520), true, 'no TEXTURE.520 exists: the stand-in kind'); assert.equal(isVendorArchive(233), false);
    assert.equal(vendorRecordCount(520), 18); assert.equal(vendorRecordCount(513), 2);
    assert.equal(hasTextureReplacement(520, 10, 0, 'Albedo', DYE_COLORS.Iron), true);
    assert.equal(hasTextureReplacement(520, 10, 0, 'Albedo', DYE_COLORS.Silver), true, 'the bare stem answers the silver (Unchanged) ask');
    assert.equal(hasTextureReplacement(522, 13, 0, 'Mask', DYE_COLORS.Iron), true, 'the helmet\'s mask by the same name');
    assert.equal(hasTextureReplacement(520, 10, 0, 'Mask', DYE_COLORS.Iron), false);
    assert.equal(await preloadTextureArchive(520), 0, 'lazy: the archive preload builds none (AUDIT-DW F1)');
    assert.equal(loads.length, 0);
    assert.ok(await preloadTextureRecord(520, 10, 0, 'Albedo', DYE_COLORS.Iron));
    assert.deepEqual(loads, ['247_4'], 'OWN-WORK4: ours, over the classic record of the slot (rriArt.js RRI_ART_BASE)');
    assert.ok(await preloadTextureRecord(522, 13, 0, 'Mask', DYE_COLORS.Dwarven));
    assert.deepEqual(loads, ['247_4', '251_27'], 'a Dwarven helmet\'s mask is ours too, over the helm whose hair it clears');
    const stand = vendorTextureStandIn(520);
    assert.equal(stand.recordCount, 18);
    assert.deepEqual(stand.getSize(10), { width: 44, height: 76 }, 'the size off a DYED entry when the bare one is not decoded - the picture\'s own');
    assert.deepEqual(stand.getOffset(10), { x: 37, y: 37, paperdoll: true }, 'the doll offset is the rect\'s x,y in the doll\'s own space');
    assert.ok(stand.getDFBitmap(10).rgba, 'the RGBA the doll blits, from the dyed entry');
    assert.equal(decodedTexture(520, 10, 0, 'Albedo', DYE_COLORS.Iron)?.width, 44);
    setModSetting(RRI_VENDOR, 'Enabled', false);
    assert.equal(hasTextureReplacement(520, 10, 0, 'Albedo', DYE_COLORS.Iron), false, 'gated on the mod');
    assert.equal(decodedTexture(520, 10, 0, 'Albedo', DYE_COLORS.Iron), null);
  } finally { done(); }
  // OWN-WORK4: every picture is ours - never a file, never a spec over the authors' pixels
  assert.deepEqual(Object.keys(RRI_SPRITES).filter((n) => !rriArtRecipe(n)), [], 'index names with no recipe of ours');
  assert.deepEqual(tracked('public/art/roleplay-realism-items'), [], 'no picture of the release is carried');
  assert.deepEqual(tracked('src/systems/roleplayRealismItems').filter((f) => f.endsWith('.json')), [], 'no derived spec either');
});

test('RRI1 the random makers: CreateRandomWeapon rolls over 19 + the registered custom weapons, CreateRandomArmor over 11 + the custom armor, with the class\'s variant writes; off, the classic rolls', () => {
  try {
    fresh();
    const at = (k, n) => () => (k + 0.5) / n;   // a roll that lands on slot k of n
    assert.equal(createRandomWeapon(1, at(19, 21)).templateIndex, 513, 'slot 19 of 21: the Hatchet');
    assert.equal(createRandomWeapon(1, at(20, 21)).templateIndex, 514);
    assert.equal(createRandomWeapon(1, at(0, 21)).templateIndex, 113, 'slot 0: the dagger, as before');
    assert.equal(createRandomWeapon(1, at(18, 21)).templateIndex, 131, 'slot 18: arrows, as before');
    const hauberk = createRandomArmor(1, at(11, 23));
    assert.equal(hauberk.templateIndex, 515, 'slot 11 of 23: the Coat');
    if (hauberk.material >= M.Iron) assert.equal(hauberk.name, 'Chain Coat'); else assert.equal(hauberk.name, 'Coat');   // AUDIT-RR F6: the ctor's template name, then the class's prefix
    assert.ok(Number.isFinite(hauberk.value), 'priced at the mint, at the rolled material');
    assert.equal(createRandomArmor(1, at(22, 23)).templateIndex, 526);
    assert.equal(createRandomArmor(1, at(10, 23)).templateIndex, 112, 'slot 10: the tower shield, as before');
    setModSetting(RRI_VENDOR, 'Enabled', false);
    assert.equal(createRandomWeapon(1, at(18, 19)).templateIndex, 131, 'off: 19 slots');
    assert.equal(createRandomArmor(1, at(10, 11)).templateIndex, 112, 'off: 11 slots');
  } finally { done(); }
});

test('RRI1 wiring: the install at the scene boot, the Features row and its curated keys, the registry row, the vendored files, the law sites\' one-line dispatch', () => {
  assert.match(rd('src/scenes/shared.js'), /installDiverseWeaponsIcons\(\);[^\n]*\n\s+installRoleplayRealismItems\(\);/);
  const row = FEATURES.find((f) => f.id === 'mod-roleplay-realism-items');
  assert.ok(row); assert.equal(row.control.vendor, RRI_VENDOR); assert.equal(row.group, 'loot');
  // OWN-WORK4: the directory is retired - the pictures are ours (rriArt.js)
  assert.deepEqual(tracked('vendor/roleplay-realism-items'), []);
  assert.match(rd('LICENSE'), /Roleplay & Realism: Items 1\.3\n\nMIT License\n\nCopyright \(C\) 2020 Hazelnut\nCopyright \(C\) 2020 \(Authors: Hazelnut & Ralzar\)/, 'our JS restates the release\'s MIT scripts: the notice travels in LICENSE');
  // the dispatch, one line at each law site
  assert.match(rd('src/systems/item/itemTemplates.js'), /const cls = customItemClass\(item\.templateIndex\);\n\s+if \(cls\) \{\n\s+const bodyArchive = playerArchiveFor\(item, t, identity\);/);
  assert.match(rd('src/ui/paperDoll.js'), /if \(item\.group === 'Weapons' && item\.equipSlot === EQUIP_SLOTS\.RightHand && getItemHands\(item\) === ITEM_HANDS\.Either\) record \+= 1;\n\s+const m = item\.material \?\? 0;/);
  assert.match(rd('src/characters/equipTable.js'), /if \(cls\?\.equipSlot\) return EQUIP_SLOTS\[cls\.equipSlot\];/);
  assert.match(rd('src/characters/equipTable.js'), /if \(cls\?\.itemHands\) return ITEM_HANDS\[cls\.itemHands\];/);
  assert.match(rd('src/systems/equip.js'), /const armorSlotRule = \(templateIndex\) => \{ const slot = customItemClass\(templateIndex\)\?\.equipSlot; return slot \? \{ slot \} : SLOT_RULES\.Armor\[templateIndex\]; \};/);
  assert.equal((rd('src/systems/equip.js').match(/armorSlotRule\(item\.templateIndex\)/g) ?? []).length, 2, 'both body-part reads');
  assert.match(rd('src/characters/weapons.js'), /if \(cls\?\.weaponSkillUsed\) return SKILLS\[cls\.weaponSkillUsed\];/);
  assert.match(rd('src/combat/fpsWeapon.js'), /if \(cls\?\.weaponType\) return T\[cls\.weaponType\(isEnchanted\(item\)\)\];/);
  assert.match(rd('src/systems/enchanting.js'), /if \(cls\?\.enchantmentPower\)\n\s*return cls\.enchantmentPower\(item, \{ enchantmentPoints: basePower, armorEnchantmentMultiplier \}\);/);
  assert.match(rd('src/systems/armorMaterials.js'), /const custom = _customArmorValue\?\.\(item\);\n\s+if \(custom != null\) return custom;/);
  assert.match(rd('src/systems/roleplayRealismItems/rriItems.js'), /^import /m);
  // TIDY2: by the file's name, at any depth - a spelled path stops meaning anything when either file moves
  assert.ok(!/from '(?:\.\.?\/)+(?:\w+\/)*(?:itemTemplates|equip|equipTable|soundClips)\.js'/.test(rd('src/systems/roleplayRealismItems/rriItems.js')), 'the law is a leaf of the systems it feeds');
});

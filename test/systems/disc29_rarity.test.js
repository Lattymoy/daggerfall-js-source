// DISC29-B (2026-09-28, Julian on Discord: a coloured-tier "iron" helmet his class was refused as leather) - A LOOT
// RARITY NAME KEEPS THE WORD ROLEPLAY & REALISM: ITEMS' MINT WROTE.
//
// The refusal is the mod's own design: a light-set piece of a plate material is BRIGANDINE, and its NativeMaterialValue
// takes 0x0200 off "so DFU treats this item as leather for forbidden checks" (ItemHelmet.cs, ItemJerkin.cs:65-68). The
// port's part was the name. The mint wrote "Brigandine Helmet" (the class's CurrentVariant setter), and the Loot Rarity
// ladder then built its "Sentinel's Helmet of the Bear" again from the bare TEMPLATE's name - so the list said "Iron
// Sentinel's Helmet" and the leather refusal read as a bug. rarityName now reads the same word (rriItems.js
// rriVariantWord), a save's names are given it back on load, and the two footstep mods read the class's
// NativeMaterialValue as their C# does (the raw material rattled a brigandine jerkin like plate).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { applyRarity, rarityName, repairRarityNames } from '../../src/systems/loot/lootRarity.js';
import { rriVariantWord, rriNativeMaterialValue, RRI_VENDOR, RRI_TEXT } from '../../src/systems/roleplayRealismItems/rriItems.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { isForbiddenEquip } from '../../src/systems/equip.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { hasArmor } from '../../src/systems/betterAmbience.js';
import { equipTableOf } from '../../src/systems/equip.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';

installRoleplayRealismItems({ fetchBytes: async () => { throw new Error('no art in this pin'); } });   // the boot's install (scenes/shared.js): the fourteen templates

/** A fixed roll stream, so a tier's affixes (and so its words) are the same every run. */
const stream = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const mint = (templateIndex, material) => setItemFields({ group: 'Armor', templateIndex, material, flags: 0 });
/** A class that may not wear leather: forbiddenArmors is bits 6-8 of the bitfield, leather its first. */
const NO_LEATHER = { weaponArmorShieldsBitfield: 1 << 6 };

test('DISC29-B: a Magic or Rare piece keeps its make\'s word - brigandine, fur and mail', () => {
  _resetModSettings();
  const helm = mint(522, ARMOR_MATERIAL.Iron);
  assert.equal(helm.name, 'Brigandine Helmet', 'the mint: the class\'s CurrentVariant setter');
  applyRarity(helm, 'rare', stream(0.1, 0.6, 0.3, 0.8, 0.5));
  assert.equal(helm.rarity, 'rare');
  assert.match(helm.name, /^\S.* Brigandine Helmet .+$/, 'a Rare: the prefix, the made name, the suffix');
  assert.equal(helm.name, rarityName(helm, 'rare', helm.affixes));

  const fur = mint(521, ARMOR_MATERIAL.Chain);   // the light set folds Chain to Leather with message 1: fur
  assert.equal(fur.material, ARMOR_MATERIAL.Leather);
  assert.equal(fur.message, 1);
  assert.equal(fur.name, 'Fur Cuisse');
  applyRarity(fur, 'magic', stream(0.2, 0.4, 0.9));
  assert.match(fur.name, /(^|\s)Fur Cuisse(\s|$)/, 'read AFTER the fold, the word is the same one the mint wrote');

  const hauberk = mint(515, ARMOR_MATERIAL.Steel);
  assert.equal(hauberk.name, 'Mail Hauberk');
  applyRarity(hauberk, 'magic', stream(0.7, 0.1, 0.5));
  assert.match(hauberk.name, /(^|\s)Mail Hauberk(\s|$)/);

  const jerkin = mint(520, ARMOR_MATERIAL.Leather);   // leather has no word
  applyRarity(jerkin, 'magic', stream(0.3, 0.3, 0.3));
  assert.doesNotMatch(jerkin.name, /Brigandine|Fur|Mail/);
  assert.match(jerkin.name, /(^|\s)Jerkin(\s|$)/);

  const classic = mint(102, ARMOR_MATERIAL.Iron);   // a classic cuirass: no class, no word
  applyRarity(classic, 'magic', stream(0.3, 0.3, 0.3));
  assert.match(classic.name, /(^|\s)Cuirass(\s|$)/);
  assert.doesNotMatch(classic.name, /Brigandine|Mail/);
});

test('DISC29-B: the refusal stands, and the name now says why - a brigandine piece is leather to the class check', () => {
  _resetModSettings();
  const jerkin = mint(520, ARMOR_MATERIAL.Iron);
  applyRarity(jerkin, 'magic', stream(0.1, 0.1, 0.1));
  assert.equal(rriNativeMaterialValue(jerkin) >> 8, 0, 'NativeMaterialValue: the leather byte, by the mod\'s design');
  assert.equal(isForbiddenEquip(NO_LEATHER, jerkin), true, 'refused, as DFU with the mod refuses it');
  assert.equal(isForbiddenEquip(NO_LEATHER, mint(102, ARMOR_MATERIAL.Iron)), false, 'a classic iron cuirass is plate');
  assert.match(itemLongName(jerkin), /Brigandine Jerkin/, 'the list says brigandine');
});

test('DISC29-B: rriVariantWord - the class\'s own rule, and nothing while the mod is off', () => {
  _resetModSettings();
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 522, material: ARMOR_MATERIAL.Daedric }), RRI_TEXT.brig);
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 522, material: ARMOR_MATERIAL.Chain }), RRI_TEXT.fur, 'before the fold');
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 522, material: ARMOR_MATERIAL.Leather, message: 1 }), RRI_TEXT.fur, 'after it');
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 522, material: ARMOR_MATERIAL.Leather }), '');
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 516, material: ARMOR_MATERIAL.Iron }), RRI_TEXT.mail, 'the chausses spread the chain class');
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 519, material: ARMOR_MATERIAL.Chain }), '', 'the chain set names plate only');
  assert.equal(rriVariantWord({ group: 'Weapons', templateIndex: 513, material: 3 }), '', 'the weapons have no variant');
  assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Iron }), '');
  assert.equal(rriVariantWord(null), '');
  try {
    setModSetting(RRI_VENDOR, 'newArmor', false);
    assert.equal(rriVariantWord({ group: 'Armor', templateIndex: 522, material: ARMOR_MATERIAL.Iron }), '', 'the class unregistered');
  } finally { _resetModSettings(); }
});

test('DISC29-B: repairRarityNames gives a save\'s old names the word, once, and touches nothing else', () => {
  _resetModSettings();
  const piece = mint(522, ARMOR_MATERIAL.Iron);
  applyRarity(piece, 'rare', stream(0.1, 0.6, 0.3, 0.8, 0.5));
  const fixed = piece.name;
  const old = fixed.replace('Brigandine Helmet', 'Helmet');   // the bare template's build, as the ladder wrote it before
  const stale = { ...piece, name: old };
  const renamed = { ...piece, name: 'My Lucky Helmet' };
  const leather = mint(522, ARMOR_MATERIAL.Leather);
  applyRarity(leather, 'magic', stream(0.3, 0.3, 0.3));
  const legendary = { ...piece, rarity: 'legendary', name: old };
  const plain = mint(522, ARMOR_MATERIAL.Iron);
  const odd = { ...piece, name: old, affixes: [null, { id: 'no-such-affix' }, ...piece.affixes] };   // a save's list is data: no throw
  const list = [stale, renamed, { ...leather }, legendary, plain, null, odd];
  assert.equal(repairRarityNames(list), 2);
  assert.equal(stale.name, fixed);
  assert.equal(odd.name, fixed, 'the words are the valid affixes\', as the mint\'s were');
  assert.equal(renamed.name, 'My Lucky Helmet', 'a name that is not the old build is not ours to move');
  assert.equal(list[2].name, leather.name, 'a make with no word');
  assert.equal(legendary.name, old, 'a Legendary is its record\'s name');
  assert.equal(plain.name, 'Brigandine Helmet', 'a common piece kept its mint\'s name all along');
  assert.equal(repairRarityNames(list), 0, 'idempotent');
  assert.equal(repairRarityNames(undefined), 0);
});

test('DISC29-B: across a load - a save\'s pack and wagon come back with the word', () => {
  _resetModSettings();
  const piece = mint(520, ARMOR_MATERIAL.Steel);
  applyRarity(piece, 'magic', stream(0.9, 0.2, 0.4));
  const fixed = piece.name;
  const old = fixed.replace('Brigandine Jerkin', 'Jerkin');
  assert.notEqual(old, fixed);
  const entity = {
    name: 'Julian', gender: 'male', careerIndex: 0, level: 5, reflexes: 2, health: 30, maxHealth: 30, magicka: 0, maxMagicka: 0,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 50 }, skills: [30, 28], skillUses: [0, 0], career: { name: 'Warrior', hitPointsPerLevel: 8 },
    items: [{ ...piece, name: old }], wagonItems: [{ ...piece, name: old, UID: 2 }], spells: [], activeEffects: [],
  };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  // AUDIT PRE-MERGE 0929 D3: and the pieces kept outside the pack - a house chest, a pile dropped in a room, a dead
  // foe's pack, a boat's hold (net/realm/realmGoldLaw.js stashedItemLists) - loaded with the name their make had lost
  snap.sceneCache = { scenes: [{ sceneName: 'DaggerfallInterior [MapID=1, BuildingKey=2]', lootContainers: [{ items: [{ ...piece, name: old, UID: 3 }] }], droppedPiles: [{ pos: [1, 0, 1], items: [{ ...piece, name: old, UID: 4 }] }] }] };
  snap.world = { piles: [], droppedLoot: [], foes: [{ dead: true, items: [{ ...piece, name: old, UID: 5 }] }] };
  snap.modData = { 'come-sail-away': { placedBoats: [{ Items: [{ ...piece, name: old, UID: 6 }] }], packedCargoes: {} } };
  const loaded = {};
  const extras = restorePlayer(loaded, snap, new Map());
  assert.equal(loaded.items[0].name, fixed);
  assert.equal(loaded.wagonItems[0].name, fixed);
  const kept = loaded.sceneCache.scenes.get('DaggerfallInterior [MapID=1, BuildingKey=2]');
  assert.equal(kept.lootContainers[0].items[0].name, fixed, 'a house chest\'s piece, as the restored cache holds it');
  assert.equal(kept.droppedPiles[0].items[0].name, fixed, 'a dropped pile\'s piece, as the restored cache holds it');
  assert.equal(extras.world.foes[0].items[0].name, fixed, 'a dead foe\'s piece, handed back to the world as repaired');
  assert.equal(extras.modData['come-sail-away'].placedBoats[0].Items[0].name, fixed, 'a boat\'s piece');
});

test('DISC29-B: Better Footsteps\' HasArmor reads the class\'s NativeMaterialValue - an iron brigandine jerkin walks quiet, a mail hauberk clanks', () => {
  _resetModSettings();
  const entity = { items: [], activeEffects: [] };
  const slots = equipTableOf(entity);
  slots[EQUIP_SLOTS.ChestArmor] = mint(520, ARMOR_MATERIAL.Iron);
  assert.equal(hasArmor(entity), false, 'BetterFootstepsComponent.cs:256: NativeMaterialValue 0x0000 is leather');
  slots[EQUIP_SLOTS.ChestArmor] = mint(515, ARMOR_MATERIAL.Iron);
  assert.equal(hasArmor(entity), true, 'the hauberk answers chain');
  slots[EQUIP_SLOTS.ChestArmor] = mint(520, ARMOR_MATERIAL.Leather);
  slots[EQUIP_SLOTS.LegsArmor] = mint(521, ARMOR_MATERIAL.Iron);
  assert.equal(hasArmor(entity), false, 'brigandine cuisses: leather too');
  slots[EQUIP_SLOTS.LegsArmor] = mint(105, ARMOR_MATERIAL.Iron);
  assert.equal(hasArmor(entity), true, 'classic iron greaves are plate');
});

// AUDIT 63 - ITEMS AND LOOT. Six laws restored from the reference:
//   F18/F32  GetMaterialArmorValue's artifact halving
//   F19      ...and its shield early return, at the %mod macro
//   F20      PotionRecipeKey's texture-record side effect
//   F21      the inventory icon reads the ITEM's texture fields
//   F22      DaggerfallInterior.AddFlats' RandomTreasure markers
//   F23      the broken-item gate is the WINDOW's, not the table's
//
// Every assertion below pins the REFERENCE's value (a C# constant, a
// C# table row or a value derived from one), never the port's own
// arithmetic restated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { materialArmorValue, itemArmorValue, BODY_PARTS, ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { updateEquippedArmorValues, armorValuesOf, equipItem, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { armourModString } from '../src/systems/itemInfo.js';
import { inventoryItemImage, templateByIndex, GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplates.js';
import {
  createPotion, createArtifact, randomlyAddPotionRecipe,
  DUNGEON_LOOT_KEYS, DROP_ICON_ARCHIVES, generateItems, addPileLootExtras,
} from '../src/systems/loot.js';
import { POTION_RECIPES, POTION_DEFAULT_TEXTURE_RECORD, potionRecipeKey } from '../src/systems/potions.js';
import { classicItemFromRecord, classicItemsAndSpells } from '../src/systems/classicSave.js';
import { createDroppedLoot, droppedLootHooks } from '../src/scenes/droppedLoot.js';
import { seedInteriorTreasure } from '../src/scenes/interiorContext.js';
import { CONTAINER_IMAGES } from '../src/ui/targetIconPanel.js';
import { INTERIOR_MARKER } from '../src/world/interiorLayout.js';
import { THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID } from '../src/systems/crimeGuilds.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

/** A dropped-loot pool over a stub renderer - the same shape all four
 *  hosts build, so the laws below run rather than being read off the
 *  port's own source. */
const pool = () => createDroppedLoot({
  renderer: {
    createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }),
    destroyBillboardBatch: () => {},
  },
  getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
  uploadRecordFrame: () => {},
});
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const TAVERN = { buildingType: BUILDING_TYPES.Tavern, factionId: 0 };

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const keyOf = (name) => potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients);

// ── F18 / F32: the artifact halving ──────────────────────────────────

test('AUDIT 63 F18/F32: an armour artifact is worth HALF its material, rounded down', () => {
  // DaggerfallUnityItem.cs:1054-1056 - "// Armor artifact appear to use
  // armor rating divided by 2 rounded down" / `if (IsArtifact &&
  // ItemGroup == ItemGroups.Armor) result /= 2;`. C# int division on a
  // non-negative result truncates.
  //
  // Lord's Mail is ArtifactsSubTypes 15 and Ebony Mail 18
  // (ItemEnums.cs), the only two NON-shield armour artifacts; both are
  // Cuirasses whose MAGIC.DEF material moves into the plate band
  // (SetArtifact :596-599). Mithril is 15 on the ladder, Ebony 17, so
  // DFU scores them 7 and 8.
  const cuirass = GROUP_TEMPLATE_INDICES.Armor[0];   // Armor.Cuirass
  const lords = { group: 'Armor', templateIndex: cuirass, material: ARMOR_MATERIAL.Mithril, artifact: true };
  const ebony = { group: 'Armor', templateIndex: cuirass, material: ARMOR_MATERIAL.Ebony, artifact: true };
  assert.equal(itemArmorValue(lords), Math.trunc(15 / 2));
  assert.equal(itemArmorValue(ebony), Math.trunc(17 / 2));
  assert.equal(itemArmorValue({ ...lords, material: ARMOR_MATERIAL.Daedric }), Math.trunc(21 / 2));

  // DaggerfallEntity.cs:608/:612 - `armorValues[index] -=
  // (sbyte)(armor.GetMaterialArmorValue() * 5)`, the WHOLE member, so
  // the halving reaches the to-hit table.
  const wear = (item) => { const e = {}; updateEquippedArmorValues(e, item, true); return armorValuesOf(e); };
  assert.equal(wear(lords)[BODY_PARTS.Chest], 100 - Math.trunc(15 / 2) * 5);
  assert.equal(wear(ebony)[BODY_PARTS.Chest], 100 - Math.trunc(17 / 2) * 5);
  // ...and the SAME member prints the Armour mod (DaggerfallUnityItemMCP
  // .cs:157-159, `GetMaterialArmorValue().ToString("+0;-0;0")`).
  assert.equal(armourModString(lords), `+${Math.trunc(15 / 2)}`);
  assert.equal(armourModString(ebony), `+${Math.trunc(17 / 2)}`);

  // The halving does NOT leak: the same piece with no artifact bit is
  // the full ladder value, both ways.
  const plain = { group: 'Armor', templateIndex: cuirass, material: ARMOR_MATERIAL.Mithril };
  assert.equal(itemArmorValue(plain), 15);
  assert.equal(wear(plain)[BODY_PARTS.Chest], 100 - 15 * 5);
  assert.equal(armourModString(plain), '+15');

  // Unequipping runs the same helper with the opposite sign, so an
  // asymmetric fix shows up here as a table that never returns to 100.
  const e = {};
  updateEquippedArmorValues(e, lords, true);
  updateEquippedArmorValues(e, lords, false);
  assert.equal(armorValuesOf(e)[BODY_PARTS.Chest], 100);
});

test('AUDIT 63 F18: the halving reaches only the ARMOR group and only non-shields', () => {
  // `ItemGroup == ItemGroups.Armor` (:1055) is load-bearing:
  // UpdateEquippedArmorValues also admits the clothing FOOTWEAR window
  // (DaggerfallEntity.cs:591-594) and C# excludes it from the halving.
  // MensClothing.Boots is Leather - 3 on the ladder, 15 on the table.
  const boots = { group: 'MensClothing', templateIndex: 149, material: ARMOR_MATERIAL.Leather, artifact: true };
  const e = {};
  updateEquippedArmorValues(e, boots, true);
  assert.equal(armorValuesOf(e)[BODY_PARTS.Feet], 100 - 3 * 5, 'clothing is not ItemGroups.Armor');

  // ...and the shield arm RETURNS at :1049-1052, three lines before the
  // halving, which is why Auriel's Shield (subtype 19) and Spell Breaker
  // (20) keep their full value. Tower_Shield is 4 (:1071-1072).
  const tower = GROUP_TEMPLATE_INDICES.Armor[10];   // Armor.Tower_Shield
  assert.equal(itemArmorValue({ group: 'Armor', templateIndex: tower, material: ARMOR_MATERIAL.Daedric, artifact: true }), 4);
  const s = {};
  updateEquippedArmorValues(s, { group: 'Armor', templateIndex: tower, material: ARMOR_MATERIAL.Daedric, artifact: true }, true);
  // GetShieldProtectedBodyParts' four parts for a Tower Shield, each -4*5
  assert.deepEqual(armorValuesOf(s), [80, 100, 80, 100, 80, 80, 100]);
});

// ── F19: the shield early return at the %mod macro ───────────────────

test('AUDIT 63 F19: %mod delegates a SHIELD to GetShieldArmorValue', () => {
  // ArmourMod() is GetMaterialArmorValue whole, and its FIRST statement
  // is the IsShield split (:1010 / :1049-1052). GetShieldArmorValue
  // (:1061-1077) is MATERIAL-BLIND: Buckler 1, Round 2, Kite 3, Tower 4.
  const [buckler, round, kite, tower] = GROUP_TEMPLATE_INDICES.Armor.slice(7, 11);
  const at = (templateIndex, material) => armourModString({ group: 'Armor', templateIndex, material });
  assert.equal(at(buckler, ARMOR_MATERIAL.Steel), '+1');
  assert.equal(at(round, ARMOR_MATERIAL.Daedric), '+2');
  assert.equal(at(kite, ARMOR_MATERIAL.Leather), '+3');
  assert.equal(at(tower, ARMOR_MATERIAL.Daedric), '+4');
  // the material really is ignored - the same template, two materials
  assert.equal(at(buckler, ARMOR_MATERIAL.Leather), at(buckler, ARMOR_MATERIAL.Daedric));

  // GetIsShield (:1804-1814) requires ItemGroups.Armor as well as the
  // template, so a non-Armor item on a shield template is not a shield.
  assert.equal(itemArmorValue({ group: 'MensClothing', templateIndex: buckler, material: ARMOR_MATERIAL.Steel }), 9);

  // The bare ladder stays exported and material-first: enemyEquipment
  // has armour records with no item, and audit24_enemytable pins the
  // two modules on the same function object.
  assert.equal(materialArmorValue(ARMOR_MATERIAL.Daedric), 21);
  // DFU's nativeMaterialValue is a plain int field, so an item minted
  // with no material carries 0 = ArmorMaterialTypes.Leather.
  assert.equal(itemArmorValue({ group: 'Armor', templateIndex: GROUP_TEMPLATE_INDICES.Armor[0] }), 3);
});

// ── F20: PotionRecipeKey's texture record ────────────────────────────

test('AUDIT 63 F20: the recipe carries the bottle\'s icon, not just its price', () => {
  // PotionRecipe.cs:34 `int textureRecord = 11` is the default, and
  // seventeen registrations override it. These are the C# values, file
  // by file.
  const REFERENCE = {
    resistFire: 34, resistFrost: 34, resistShock: 34, resistPoison: 14,   // ElementalResistance.cs:137-140
    waterBreathing: 32,                                                    // WaterBreathing.cs:51
    waterWalking: 32,                                                      // WaterWalking.cs:52
    chameleonForm: 33, shadowForm: 33, invisibility: 33,                   // Chameleon/Shadow/InvisibilityNormal.cs
    cureDisease: 35, purification: 35, curePoison: 35,                     // CureDisease.cs:70-71, CurePoison.cs:54
    healing: 15, healTrue: 16,                                             // HealHealth.cs:67-68
    restorePower: 12,                                                      // HealSpellPoints.cs:49
    orcStrength: 13,                                                       // FortifyStrength.cs:57
    freeAction: 14,                                                        // FreeAction.cs:53
  };
  assert.equal(POTION_DEFAULT_TEXTURE_RECORD, 11);
  // The Glass Bottle template's own world texture - what every potion
  // used to draw (ItemHelper's UseWorldTexture arm for UselessItems1).
  const bottle = templateByIndex(GROUP_TEMPLATE_INDICES.UselessItems1[1]);
  assert.equal(bottle.worldTextureArchive, 205);
  assert.equal(bottle.worldTextureRecord, POTION_DEFAULT_TEXTURE_RECORD);

  for (const [name, record] of Object.entries(REFERENCE)) {
    const img = inventoryItemImage(createPotion(keyOf(name)));
    assert.equal(img.archive, 205, `${name} keeps the bottle's archive`);
    assert.equal(img.record, record, `${name} draws its recipe's TextureRecord`);
  }
  // ...and the three whose effect classes never write one keep 11.
  for (const name of ['stamina', 'slowFalling', 'levitation']) {
    assert.equal(inventoryItemImage(createPotion(keyOf(name))).record, POTION_DEFAULT_TEXTURE_RECORD, name);
  }
  // Seventeen overrides and three defaults - the whole registration set.
  assert.equal(POTION_RECIPES.filter((r) => r.textureRecord != null).length, 17);
  assert.equal(POTION_RECIPES.length, 20);
});

test('AUDIT 63 F20: the setter\'s two gates - IsPotion, and the null recipe', () => {
  // `if (IsPotion)` (:396): IsPotion is UselessItems1 + Glass_Bottle
  // (:352-355), so the MiscItems-4 RECIPE SHEET that
  // RandomlyAddPotionRecipe mints takes the price and NOT the record.
  const items = [];
  randomlyAddPotionRecipe(100, items, () => 0);
  const sheet = items[0];
  assert.equal(sheet.templateIndex, GROUP_TEMPLATE_INDICES.MiscItems[4]);
  assert.equal(sheet.worldTextureRecord, undefined, 'the record write is gated on IsPotion');
  assert.deepEqual(inventoryItemImage(sheet),
    inventoryItemImage({ group: 'MiscItems', templateIndex: sheet.templateIndex }),
    'a recipe sheet draws exactly what its bare template draws');

  // `if (potionRecipe != null)` (:392): a key no recipe answers leaves
  // BOTH the value and the record untouched, so the bottle keeps the
  // template's 205/11 and the template's price.
  const unknown = createPotion(12345);
  assert.equal(unknown.worldTextureRecord, undefined);
  assert.deepEqual(inventoryItemImage(unknown), { archive: 205, record: 11 });
});

test('AUDIT 63 F20: the quest mint goes through ItemBuilder, both arms', () => {
  // Questing/Item.cs:347-351 - `(itemKey != -1) ?
  // ItemBuilder.CreatePotion(itemKey) : ItemBuilder.CreateRandomPotion()`.
  // The port minted the bottle inline and so bypassed the setter
  // entirely: no recipe price, no recipe icon, and no random arm.
  const src = rd('src/systems/quest/item.js');
  assert.match(src, /result = itemKey !== -1 \? createPotion\(itemKey\) : createRandomPotion\(rolls\);/);
  assert.doesNotMatch(src, /potionRecipeKey: itemKey/, 'no inline bottle mint left');
});

// ── F21: the inventory icon reads the ITEM ───────────────────────────

const artifactTemplates = () => {
  const T = (i, over = {}) => ({ index: i, name: `A${i}`, type: 1, group: 14, groupIndex: 0, enchantments: [], uses: 100, value: 0, material: 0, ...over });
  const list = Array.from({ length: 23 }, (_, i) => T(i));
  list[4] = T(4, { group: 15, groupIndex: 8 });    // Sanguine Rose - PlantIngredients1, a WORLD-texture base
  list[5] = T(5, { group: 7, groupIndex: 0 });     // Oghma Infinium - the "Book" template
  list[13] = T(13, { group: 25, groupIndex: 1 });  // Necromancer's Amulet - Jewellery
  return list;
};

test('AUDIT 63 F21: an artifact draws MAGIC.DEF\'s record, not its base template\'s', () => {
  // GetInventoryTextureRecord :1745-1747 carries DFU's own reason:
  // "Use texture record retrieved from MAGIC.DEF for artifacts.
  // Otherwise the below code will give the Oghma Infinium record 2,
  // from the 'Book' template." The archive beside it is the item's own
  // playerTextureArchive (:1733), which SetArtifact :606-609 fills from
  // GetArtifactTextureIndices - 432 for a male character.
  const templates = artifactTemplates();
  const oghma = createArtifact(templates, 5);
  const book = templateByIndex(oghma.templateIndex);
  assert.deepEqual([book.playerTextureArchive, book.playerTextureRecord], [209, 2], 'the named failure case');
  assert.deepEqual(inventoryItemImage(oghma), { archive: 432, record: 16 });

  // A Jewellery base whose template art is 0/0 used to fall through
  // GetItemImage's `archive == 0 && record == 0` arm to the template's
  // WORLD texture; the carve-out returns before it can.
  const amulet = createArtifact(templates, 13);
  assert.equal(inventoryItemImage(amulet).archive, 432);
  assert.equal(inventoryItemImage(amulet).record, amulet.playerTextureRecord);

  // The WORLD arm reads the item too (:1741-1743): SetArtifact writes
  // world = player (:608-609), which is how an ingredient-based
  // artifact gets its art.
  const rose = createArtifact(templates, 4);
  assert.equal(rose.group, 'PlantIngredients1');
  assert.deepEqual(inventoryItemImage(rose), { archive: rose.worldTextureArchive, record: rose.worldTextureRecord });

  // A female character's artifacts are archive 433 (ItemHelper.cs:51).
  assert.equal(inventoryItemImage(createArtifact(templates, 5, { gender: 'female' })).archive, 433);

  // ANTI-OVERREACH: an ordinary Book is still the Book template's 209/2
  // (audit18_systems_chargen pins the same pair).
  assert.deepEqual(inventoryItemImage({ group: 'Books', templateIndex: oghma.templateIndex }), { archive: 209, record: 2 });
});

test('AUDIT 63 F21: FromItemRecord\'s four texture fields survive a classic import', () => {
  // DaggerfallUnityItem.cs:1539-1547 splits both image words -
  // `playerArchive = image1 >> 7; playerRecord = image1 & 0x7f;` and the
  // same for image2 - and :1552-1555 assigns all four.
  const image1 = (432 << 7) | 16;
  const image2 = (432 << 7) | 20;
  const item = classicItemFromRecord({ parsedData: {
    name: 'Oghma Infinium', group: 7, index: 0, value: 1, flags: 0x800 | 0x20,
    currentCondition: 1, maxCondition: 1, typeDependentData: 0,
    image1, image2, material: 0, color: 0, enchantmentPoints: 0, message: 0, magic: [],
  } });
  assert.equal(item.playerTextureArchive, 432);
  assert.equal(item.playerTextureRecord, 16);
  assert.equal(item.worldTextureArchive, 432);
  assert.equal(item.worldTextureRecord, 20);
  // ...so an imported artifact draws its own art, not the Book's
  assert.deepEqual(inventoryItemImage(item), { archive: 432, record: 16 });
  // ...and Open.CheckCastByItem's Skeleton's Key test (Open.cs:176-180)
  // has the pair it reads.
  assert.equal(item.worldTextureArchive === 432 && item.worldTextureRecord === 20, true);
});

// ── F22: the interior Treasure markers ───────────────────────────────

test('AUDIT 63 F22: the interior context hands its TREASURE markers out', () => {
  // DaggerfallInterior.cs:67 `Treasure = 19`, and AddFlats :875 keys on
  // the flat's TextureRecord. The port parsed the type and no reader in
  // src/ ever asked for it.
  assert.equal(INTERIOR_MARKER.TREASURE, 19);
  const src = rd('src/scenes/interiorContext.js');
  assert.match(src, /\.filter\(\(m\) => m\.type === INTERIOR_MARKER\.TREASURE\)/);
  assert.match(src, /^\s*treasureMarkers,/m, 'and returns them beside enterMarkers');
});

test('AUDIT 63 F22: the gate is Tavern / TG / DB, the picture is clothing record 0, the index is the LOCATION type', async () => {
  // DaggerfallInterior.cs:879-883 - the arm runs for a Tavern OR the
  // two guild faction ids, and for nothing else.
  assert.equal(BUILDING_TYPES.Tavern, 15);
  assert.equal(THIEVES_GUILD_FACTION_ID, 42);      // FactionFile.cs:91
  assert.equal(DARK_BROTHERHOOD_FACTION_ID, 108);  // FactionFile.cs:135
  const markers = [[4, 1, 9]];
  const run = (building, locationType = 6) => {
    const p = pool();
    seedInteriorTreasure({ markers, building, locationType, pool: p, level: 1, gender: 'male' });
    return p;
  };
  for (const b of [TAVERN,
    { buildingType: BUILDING_TYPES.House1, factionId: THIEVES_GUILD_FACTION_ID },
    { buildingType: BUILDING_TYPES.House1, factionId: DARK_BROTHERHOOD_FACTION_ID }]) {
    assert.equal(run(b)._piles.length, 1, 'AddFlats stands a container here');
  }
  for (const b of [{ buildingType: BUILDING_TYPES.House1, factionId: 0 },
    { buildingType: BUILDING_TYPES.GeneralStore, factionId: 0 }, null]) {
    assert.equal(run(b)._piles.length, 0, 'and nowhere else');
  }

  // :891-897 - `DaggerfallLootDataTables.clothingArchive, 0` literally:
  // the CLOTHING archive, record 0, and no icon roll off the 216 list.
  assert.equal(DROP_ICON_ARCHIVES.clothing, 204);
  const p = run(TAVERN);
  await settle();
  const pile = p._piles[0];
  assert.equal(pile.archive, 204);
  assert.equal(pile.record, 0);
  assert.equal(pile.container, true);
  // CreateLootContainer lifts the billboard by half its own size
  // (GameObjectHelper.cs:685-687), i.e. the marker point is the BOTTOM.
  assert.deepEqual(pile.batch.centers, [[4, 1, 9]]);

  // :899 - `LootTables.GenerateLoot(loot, (int)PlayerGPS
  // .CurrentLocationType)`: the LOCATION type indexes the same 19-entry
  // key array the dungeon piles use (LootTables.cs:123-146).
  assert.equal(DUNGEON_LOOT_KEYS.length, 19);
  assert.equal(DUNGEON_LOOT_KEYS[0], 'K');   // DFRegion.LocationTypes.TownCity
  assert.equal(DUNGEON_LOOT_KEYS[6], 'M');   // ...LocationTypes.Tavern
  // LootTables.cs:146/:167 - an index off the end generates nothing and
  // the container still stands. 0xffff is LocationTypes.None.
  assert.equal(DUNGEON_LOOT_KEYS[0xffff], undefined);
  assert.deepEqual(addPileLootExtras(generateItems('-', { level: 1, gender: 'male' }), '-'), []);
  const off = run(TAVERN, 0xffff);
  assert.equal(off._piles.length, 1, 'the container stands on an out-of-range location');
  assert.deepEqual(off._piles[0].items, [], '...holding what the empty matrix gave it');

  // ...and the pass is wired where the cache has already spoken.
  const src = rd('src/scenes/worldModes.js');
  assert.ok(src.indexOf('restoreInteriorScene();\n      // AUDIT 63 F22') > 0,
    'the marker pass runs after RestoreCachedScene, as DFU orders them');
});

test('AUDIT 63 F22: a cached container keeps its marker - the pass does not mint a second', async () => {
  // DFU reaches this from the other side: AddFlats mints on every
  // entry and RestoreCachedScene overwrites by loadID
  // (SerializableLootContainer.cs:130-156), the loadID being the
  // building key and the marker's own coordinates
  // (DaggerfallInterior.cs:885-889). The port restores first and skips
  // a marker the scene already stands a container on, so the identity
  // must survive the snapshot or the same marker gets a SECOND, freshly
  // rolled pile every time the player steps through the door.
  const p = pool();
  p.restorePiles([
    { pos: [4, 1, 9], archive: 204, record: 0, container: true, containerKey: 'treasure:0', items: [{ name: 'Ruby', stackCount: 1 }] },
  ]);
  await settle();
  seedInteriorTreasure({ markers: [[4, 1, 9], [7, 1, 2]], building: TAVERN, locationType: 6, pool: p, level: 1, gender: 'male' });
  await settle();
  assert.equal(p._piles.filter((x) => x.containerKey === 'treasure:0').length, 1,
    'the cached container is the only one on marker 0');
  assert.deepEqual(p._piles.find((x) => x.containerKey === 'treasure:0').items, [{ name: 'Ruby', stackCount: 1 }],
    '...still holding what the cache carried, not a fresh roll');
  assert.equal(p._piles.filter((x) => x.containerKey === 'treasure:1').length, 1,
    'and the marker the cache had nothing for is stood up');
});

test('AUDIT 63 F22: an EMPTIED container rides the snapshot and is never re-rolled', async () => {
  // GameObjectHelper.RemoveLootContainer (:852-864) DEACTIVATES a
  // RandomTreasure container - `loot.gameObject.SetActive(false)`, not
  // Destroy - so its SerializableLootContainer stays registered.
  // GetSaveData (:55-77) has no empty guard and writes it anyway, and
  // RestoreSaveData ends `if (loot.Items.Count == 0)
  // RemoveLootContainer(loot)` (:157-160). Net: the emptied pile stays
  // emptied. Dropping it instead handed the player a tavern that
  // refilled on every entry.
  const p = pool();
  seedInteriorTreasure({ markers: [[4, 1, 9]], building: TAVERN, locationType: 6, pool: p, level: 1, gender: 'male' });
  await settle();
  const pile = p._piles[0];
  pile.items.length = 0;                       // the player takes it all
  p.releaseEmptied();                          // DaggerfallInventoryWindow.cs:717-726
  assert.equal(p.lootTargets().length, 0, 'SetActive(false): not activatable');
  assert.equal(p.batches().length, 0, '...and not drawn');
  assert.equal(p.activePiles().length, 0, '...and out of GetActiveLoot (ActiveGameObjectDatabase.cs:266-268)');
  assert.equal(p.containerSeeded('treasure:0'), true, '...but the marker is still spoken for');

  // the snapshot the interior host takes keeps it (no empty guard)...
  const saved = p.snapshotScene();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].containerKey, 'treasure:0');
  assert.deepEqual(saved[0].items, []);
  // ...and the next entry restores it, removed-because-empty, then
  // runs the marker pass over it.
  const q = pool();
  q.restorePiles(saved);
  await settle();
  seedInteriorTreasure({ markers: [[4, 1, 9]], building: TAVERN, locationType: 6, pool: q, level: 1, gender: 'male' });
  await settle();
  assert.equal(q.lootTargets().length, 0, 'the emptied container is not back');
  assert.equal(q.batches().length, 0);
  assert.equal(q._piles.filter((x) => x.containerKey === 'treasure:0').length, 1,
    'and no second pile was minted on its marker');
});

test('AUDIT 63 F22: the window is handed the CONTAINER\'s own identity', () => {
  // PlayerActivate.cs:957-961 has ONE fall-through for every remaining
  // container type - "No special handling for all other loot container
  // types: (Nothing, RandomTreasure, DroppedLoot)" - and then
  // `InventoryWindow.LootTarget = loot`. What differs is on the
  // DaggerfallLoot: CreateDroppedLootContainer sets `playerOwned = true`
  // (GameObjectHelper.cs:766) and CreateLootContainer (:691-704) never
  // touches it, so a scene-built container keeps DaggerfallLoot.cs:41's
  // false and CanChangeDropIcon (:2141-2145) refuses to cycle it.
  const p = pool();
  const dropped = p.dropPile([{ name: 'Ruby', stackCount: 1 }], [1, 0, 2]);
  const seeded = p.seedPile([], [4, 1, 9], { archive: DROP_ICON_ARCHIVES.clothing, record: 0 }, 'treasure:0');
  assert.equal(droppedLootHooks(dropped).playerOwned, true);
  assert.equal(droppedLootHooks(seeded).playerOwned, false);
  // DaggerfallLoot.cs:37 - `ContainerImage = InventoryContainerImages
  // .Chest` is the default, and both makers pass exactly that
  // (GameObjectHelper.cs:754-756, DaggerfallInterior.cs:891-893).
  assert.equal(CONTAINER_IMAGES.Chest, 5);
  assert.equal(droppedLootHooks(seeded).containerImage(), CONTAINER_IMAGES.Chest);
  assert.equal(droppedLootHooks(dropped).containerImage(), CONTAINER_IMAGES.Chest);
  // :880-884 - the target's own world flat wins over the container
  // picture, so the pair travels too.
  assert.equal(droppedLootHooks(seeded).textureArchive, 204);
  assert.equal(droppedLootHooks(seeded).textureRecord, 0);
  assert.deepEqual(droppedLootHooks(seeded).items(), []);
});

test('AUDIT 63 F22: a scene-built container stands even when the table gives it nothing', async () => {
  // GameObjectHelper.CreateLootContainer (:658-700) creates the
  // container BEFORE anything is generated into it, and PlayerActivate
  // .cs:957-961 gives RandomTreasure "no special handling" - so an empty
  // roll still leaves a visible, openable pile. CreateDroppedLootContainer
  // has no such state, which is why dropPile answers null for one.
  const dl = createDroppedLoot({
    renderer: { createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }), destroyBillboardBatch: () => {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {},
  });
  assert.equal(dl.dropPile([], [0, 0, 0]), null, 'a player pile is minted from its items');
  const pile = dl.seedPile([], [4, 1, 9], { archive: DROP_ICON_ARCHIVES.clothing, record: 0 }, 'treasure:0');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pile.archive, 204);
  assert.equal(pile.record, 0, 'record 0 literally - no roll off randomTreasureIconIndices');
  assert.equal(pile.container, true, 'CreateLootContainer never sets playerOwned');
  assert.equal(dl.lootTargets().length, 1, 'an empty scene container is still activatable');
  assert.equal(dl.batches().length, 1, 'and still drawn');
  // CreateLootContainer lifts the billboard by half its own size
  // (:685-687), i.e. the marker point is the pile's BOTTOM.
  assert.deepEqual(pile.batch.centers, [[4, 1, 9]]);
  // DaggerfallInventoryWindow.cs:715-722 removes an emptied loot target
  // when the window closes - which is what takes it away, not the roll.
  dl.releaseEmptied();
  assert.equal(dl.lootTargets().length, 0);
});

// ── F23: the broken-item gate is the window's ────────────────────────

test('AUDIT 63 F23: a classic save\'s worn 0-condition piece imports EQUIPPED', () => {
  // PlayerEntity.cs:955-960 relinks every worn record with
  // `equipTable.EquipItem(newItem, true, false)` - the alwaysEquip arm -
  // and ItemEquipTable.cs:94-154 has no condition test, while
  // DaggerfallUnityItem.cs:1563 takes currentCondition verbatim off the
  // record. The port's gate sat inside equipItem, so the piece landed in
  // the bag with its slot empty.
  const RECORD_TYPES_Item = 0x02, RECORD_TYPES_Character = 0x03;   // saveTreeFile.js's own values
  const worn = {
    recordRoot: { recordId: 7, time: 0 },
    children: [],
    parent: { recordRoot: {}, parsedData: {} },
    parsedData: {
      name: 'Broken Cuirass', group: 2, index: 0, value: 10, flags: 0,
      currentCondition: 0, maxCondition: 400, typeDependentData: 0,
      image1: 0x1234, image2: 0x1234, material: ARMOR_MATERIAL.Steel,
      color: 0, enchantmentPoints: 0, message: 0, magic: [],
    },
  };
  const character = { parsedData: { equippedItems: [7] } };
  const saveTree = {
    findRecord: (t) => (t === RECORD_TYPES_Character ? character : null),
    findRecords: (t) => (t === RECORD_TYPES_Item ? [worn] : []),
    filterRecordsByParentType: (recs) => recs,
  };
  const { items, scratch } = classicItemsAndSpells(saveTree);
  assert.equal(items.length, 1);
  assert.equal(items[0].equipSlot, EQUIP_SLOTS.ChestArmor, 'the slot is filled, as PlayerEntity.cs:959 does it');
  assert.equal(equipTableOf(scratch)[EQUIP_SLOTS.ChestArmor], items[0], 'and the table holds the very record');

  // The refusal is the window's alone - the table takes it directly too.
  const e = { items: [], equip: null, armorValues: null };
  const broken = { group: 'Armor', templateIndex: GROUP_TEMPLATE_INDICES.Armor[0], material: ARMOR_MATERIAL.Steel, currentCondition: 0 };
  e.items.push(broken);
  assert.notEqual(equipItem(e, broken), null, 'ItemEquipTable.cs:94-154 has no condition test');

  // ...and the port says so where it used to say the opposite.
  assert.doesNotMatch(rd('src/systems/classicSave.js'), /Recorded divergence: the port's law refuses a/);
});

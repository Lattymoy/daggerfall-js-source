import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SURVIVAL_TEMPLATES, createSurvivalItem, spoilFood, dressFood, useSurvivalItem, drinkAtSource, provisionsStock, startingProvisions,
  isSurvivalItem, VENDOR_ICON_FILES, VENDOR_TENT_FILES, installSurvivalIcons, WATER_SOURCE_FLATS, WATER_SOURCE_MODELS, isWaterSourceFlat, isDrySourceFlat,
  CAMPFIRE_USES, CAMPING_USES, SURVIVAL_USE_TEXT,
} from '../src/systems/survival/items.js';
import { TEMPLATE, FOOD_STAGE, waterIn } from '../src/systems/survival/food.js';
import { corpseFood, humanoidFood, MEAT_BY_TYPE, isAnimal, isHumanoid } from '../src/systems/survival/loot.js';
import { survivalOf, hungerStage } from '../src/systems/survival/needs.js';
import { templateByIndex, customTemplateCount, inventoryItemImage, usesWorldTexture } from '../src/systems/itemTemplates.js';
import { unitWeightInKg, isStackable, itemWeight } from '../src/systems/inventory.js';
import { useItem } from '../src/systems/useItem.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { seedStartingEquipment } from '../src/systems/equip.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import {
  addVendorTextures, isVendorArchive, hasTextureReplacement, preloadTextureArchive, vendorTextureStandIn, decodedTexture, clearVendorTextures, clearTextureReplacements, vendorTextureCount,
} from '../src/systems/textureReplacement.js';
import { getBool, setValue } from '../src/systems/settings.js';

// ═══ SURV2 (2026-09-18): THE SURVIVAL ITEMS ═════════════════════════
//
// The mod's eleven templates as the port's own custom rows above DFU's
// 288, plus the campfire kit (Mac: "a new campfire item players can
// buy and place"); a waterskin that weighs its water; rations that
// stack; food that spoils by stage and shows the mod's own spoiled
// face; the use handlers on useItem's ladder; the general store's
// provisions shelf; the starting kit; the corpse's meat.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const player = () => ({ stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, items: [], activeEffects: [], health: 50, fatigue: 3000, raceId: 1 });

test('SURV2: the twelve templates register above DFU\'s 288 and answer through templateByIndex with the mod\'s columns', () => {
  assert.ok(customTemplateCount() >= 12);
  assert.equal(SURVIVAL_TEMPLATES.length, 12);
  const apple = templateByIndex(TEMPLATE.Apple);
  assert.equal(apple.name, 'Apple');
  assert.equal(apple.custom, true);
  assert.deepEqual([apple.worldTextureArchive, apple.worldTextureRecord, apple.baseWeight, apple.hitPoints, apple.basePrice], [213, 1, 0.1, 90, 1], 'the mod\'s own row');
  assert.equal(templateByIndex(TEMPLATE.Rations).stackable, true);
  assert.equal(templateByIndex(TEMPLATE.Campfire).name, 'Campfire Kit');
  assert.equal(templateByIndex(TEMPLATE.Campfire).hitPoints, CAMPFIRE_USES, 'a kit is five fires');
  assert.equal(templateByIndex(TEMPLATE.CampingEquipment).hitPoints, CAMPING_USES);
  assert.equal(templateByIndex(5).name, 'Turquoise', 'DFU\'s own table is untouched');
  assert.equal(templateByIndex(300), null, 'a hole stays a hole');
  const shipped = JSON.parse(read('vendor/climates-calories/ItemTemplates.json')).filter((r) => r.index >= 530);
  for (const r of shipped) {
    const t = templateByIndex(r.index);
    assert.equal(t.name, r.name, `${r.index} keeps the mod's name`);
    assert.deepEqual([t.worldTextureArchive, t.worldTextureRecord], [r.worldTextureArchive, r.worldTextureRecord], `${r.name} keeps the mod's picture`);
  }
});

test('SURV2: minting - condition as uses, a stack for rations only, a full skin by default, a spoiled stage dresses the name and the icon', () => {
  const sack = createSurvivalItem(TEMPLATE.Rations, { stackCount: 3 });
  assert.equal(sack.stackCount, 3);
  assert.equal(sack.group, 'UselessItems2');
  assert.equal(isStackable(sack), true, 'rations stack');
  assert.equal(isStackable(createSurvivalItem(TEMPLATE.Apple, { stackCount: 3 })), false, 'fruit does not (each spoils alone)');
  assert.equal(createSurvivalItem(TEMPLATE.Apple, { stackCount: 3 }).stackCount, 1);
  const skin = createSurvivalItem(TEMPLATE.Waterskin);
  assert.equal(waterIn(skin), 2.0);
  assert.equal(skin.name, 'Waterskin');
  assert.equal(unitWeightInKg(skin), 2.5, 'half a kilo of skin and two of water');
  assert.equal(unitWeightInKg(createSurvivalItem(TEMPLATE.Waterskin, { water: 0 })), 0.5);
  assert.equal(createSurvivalItem(TEMPLATE.Waterskin, { water: 0 }).name, 'Waterskin', 'named by its template at the mint - the shelf sells it empty under its own name');
  assert.equal(itemWeight(sack), 3.0, 'three sacks of rations');
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 2 });
  assert.equal(kit.currentCondition, 2);
  assert.equal(kit.maxCondition, CAMPFIRE_USES);
  const bread = createSurvivalItem(TEMPLATE.Bread, { foodStage: 2 });
  assert.equal(bread.name, 'Mouldy Bread');
  assert.deepEqual([bread.worldTextureArchive, bread.worldTextureRecord], [TEMPLATE.Bread, 0], 'mouldy: the mod\'s own picture, record 0');
  spoilFood(bread);
  assert.equal(bread.name, 'Rotten Bread');
  assert.equal(bread.worldTextureRecord, 1, 'rotten and worse: record 1');
  assert.equal(usesWorldTexture(bread), true);
  assert.deepEqual([inventoryItemImage(bread).archive, inventoryItemImage(bread).record], [534, 1], 'and the inventory draws it');
  const fresh = createSurvivalItem(TEMPLATE.Bread);
  assert.deepEqual([inventoryItemImage(fresh).archive, inventoryItemImage(fresh).record], [211, 31], 'fresh: the template\'s ARENA2 picture');
  const stale = createSurvivalItem(TEMPLATE.Apple, { foodStage: 1 });
  assert.equal(stale.name, 'Soft Apple');
  assert.deepEqual([inventoryItemImage(stale).archive, inventoryItemImage(stale).record], [213, 1], 'stale still looks fresh');
  assert.equal(createSurvivalItem(5), null, 'not a custom template');
  assert.equal(isSurvivalItem(sack), true);
  assert.equal(isSurvivalItem({ templateIndex: 247, group: 'UselessItems2' }), false, 'a torch is not');
  assert.equal(dressFood({ templateIndex: 5 }).templateIndex, 5, 'dressing a non-food is a no-op');
});

test('SURV2: using food - eaten when hungry, refused when full or putrid, one off a stack, the marker moves, fruit is a drink, raw meat can sicken', () => {
  const e = player();
  const now = 100000;
  survivalOf(e, now).lastAte = now - 1500;
  const meat = createSurvivalItem(TEMPLATE.Meat);
  e.items.push(meat);
  const r = useSurvivalItem(meat, e.items, { entity: e, now });
  assert.equal(r.kind, 'ate');
  assert.equal(r.text, 'You eat the Meat. You feel invigorated by the meal.');
  assert.equal(e.items.length, 0, 'consumed');
  assert.equal(hungerStage(now - e.survival.lastAte), 'fed');
  const again = createSurvivalItem(TEMPLATE.Apple);
  assert.equal(useSurvivalItem(again, e.items, { entity: e, now }).kind, 'notEaten', 'full');
  assert.equal(useSurvivalItem(again, e.items, { entity: e, now }).text, SURVIVAL_USE_TEXT.notHungry('Apple'));
  const putrid = createSurvivalItem(TEMPLATE.Apple, { foodStage: 4 });
  assert.equal(useSurvivalItem(putrid, [putrid], { entity: e, now: now + 5000 }).text, SURVIVAL_USE_TEXT.putrid('Putrid Apple'));
  e.survival.thirst = 30;
  e.survival.lastAte = now + 5000 - 3000;
  const orange = createSurvivalItem(TEMPLATE.Orange);
  useSurvivalItem(orange, [orange], { entity: e, now: now + 5000 });
  assert.equal(e.survival.thirst, 20, 'an orange takes ten off the thirst');
  const sack = createSurvivalItem(TEMPLATE.Rations, { stackCount: 2 });
  e.items = [sack];
  e.survival.lastAte = now + 5000 - 3000;
  assert.equal(useSurvivalItem(sack, e.items, { entity: e, now: now + 5000 }).text, 'You eat some rations.');
  assert.equal(sack.stackCount, 1);
  e.survival.lastAte = now + 5000 - 3000;
  assert.equal(useSurvivalItem(sack, e.items, { entity: e, now: now + 5000 }).text, 'You eat some rations. You empty your sack of rations.');
  assert.equal(e.items.length, 0);
  const sick = player();
  survivalOf(sick, now).lastAte = now - 3000;
  const raw = createSurvivalItem(TEMPLATE.RawMeat);
  const inflicted = [];
  const rr = useSurvivalItem(raw, [raw], { entity: sick, now, rolls: () => 0.99, currentDay: 10, inflict: (e, list) => { inflicted.push(list); return true; } });
  assert.equal(rr.sick, 'mild');
  assert.deepEqual(inflicted, [[3]], 'the stomach rot, through the law handed in');
  assert.match(rr.text, /nauseated/);
});

test('SURV2: using a waterskin drinks a tenth and says so, an empty one says where to fill it; a source fills every skin and quenches', () => {
  const e = player();
  const now = 200000;
  const skin = createSurvivalItem(TEMPLATE.Waterskin, { water: 0.25 });
  e.items.push(skin);
  survivalOf(e, now).thirst = 90;
  let r = useSurvivalItem(skin, e.items, { entity: e, now });
  assert.deepEqual([r.kind, r.text, r.left], ['drank', 'Your water skin is nearly empty.', 0.15]);
  assert.equal(e.survival.thirst, 50);
  r = useSurvivalItem(skin, e.items, { entity: e, now });
  assert.equal(r.text, 'You drain your waterskin.');
  assert.equal(skin.name, 'Empty Waterskin');
  r = useSurvivalItem(skin, e.items, { entity: e, now });
  assert.deepEqual([r.kind, r.text], ['empty', SURVIVAL_USE_TEXT.emptySkin]);
  assert.equal(e.items.length, 1, 'the skin is not consumed');
  e.survival.thirst = 40;
  const at = drinkAtSource(e, now);
  assert.equal(at.text, 'You quench your thirst. You refill your water.');
  assert.equal(waterIn(skin), 2.0);
  assert.equal(skin.name, 'Waterskin');
  assert.equal(e.survival.thirst, 0);
  assert.equal(drinkAtSource(e, now).text, 'Your waterskin is already full.');
  assert.equal(drinkAtSource(player(), now).text, 'You have no waterskins to fill.');
  assert.equal(drinkAtSource(e, now, { kg: 0.5 }).poured, 0, 'a puddle into a full skin');
  assert.deepEqual(WATER_SOURCE_MODELS, [41220, 41221, 41222]);
  assert.equal(isWaterSourceFlat(212, 8), true);
  assert.equal(isWaterSourceFlat(212, 3), false);
  assert.equal(isDrySourceFlat(212, 3), true, 'the dry fountain only says so');
  assert.deepEqual(WATER_SOURCE_FLATS[212], [0, 2, 8, 9]);
});

test('SURV2: the camp gear hands itself to the host, the skillet explains itself, and useItem routes every survival item here first', () => {
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  assert.deepEqual(useSurvivalItem(gear, [gear], {}), { kind: 'pitchCamp', item: gear });
  const kit = createSurvivalItem(TEMPLATE.Campfire);
  assert.deepEqual(useSurvivalItem(kit, [kit], {}), { kind: 'placeFire', item: kit });
  assert.equal(useSurvivalItem(createSurvivalItem(TEMPLATE.Skillet), [], {}).text, SURVIVAL_USE_TEXT.skillet);
  assert.equal(useSurvivalItem({ templateIndex: 247, group: 'UselessItems2' }, [], {}), null, 'not ours');
  const e = player();
  const now = 300000;
  survivalOf(e, now).lastAte = now - 2000;
  const bread = createSurvivalItem(TEMPLATE.Bread);
  e.items.push(bread);
  const r = useItem(bread, e.items, { entity: e, nowMinute: now });
  assert.equal(r.kind, 'ate', 'the ladder\'s first arm');
  assert.equal(e.items.length, 0);
  assert.equal(useItem(gear, [gear], { entity: e, nowMinute: now }).kind, 'pitchCamp');
});

test('SURV2: the general store shelves provisions after the horse and cart, and a new character sets out with the kit', () => {
  const items = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { level: 1 }, { rolls: () => 0.5 });
  const idx = (t) => items.findIndex((i) => i.templateIndex === t);
  assert.ok(idx(TEMPLATE.Rations) > idx(94) && idx(94) >= 0, 'rations after the horse');
  for (const t of [TEMPLATE.Bread, TEMPLATE.Waterskin, TEMPLATE.Campfire, TEMPLATE.CampingEquipment, TEMPLATE.Skillet]) assert.ok(idx(t) >= 0, `a quality-10 store carries ${templateByIndex(t).name}`);
  assert.ok(items.find((i) => i.templateIndex === TEMPLATE.Waterskin).water === 0, 'sold empty');
  assert.ok(items.every((i) => i.name && i.value != null), 'every row minted with a name and a value');
  const poor = provisionsStock(1, () => 0.9);
  assert.ok(!poor.some((i) => i.templateIndex === TEMPLATE.CampingEquipment), 'a poor store on a bad roll has no camping gear');
  assert.equal(poor.filter((i) => i.templateIndex === TEMPLATE.Campfire).length, 3, 'but fire kits');
  const kit = startingProvisions();
  assert.deepEqual(kit.map((i) => i.templateIndex), [TEMPLATE.Rations, TEMPLATE.Waterskin, TEMPLATE.CampingEquipment, TEMPLATE.Campfire]);
  assert.equal(kit[0].stackCount, 2);
  assert.equal(waterIn(kit[1]), 2.0);
  assert.equal(kit[2].currentCondition, CAMPING_USES / 2, 'worn gear');
  assert.equal(kit[3].currentCondition, 2);
  const e = { items: [] };
  seedStartingEquipment(e);
  assert.ok(e.items.some((i) => i.templateIndex === 113), 'the dagger');
  assert.ok(e.items.some((i) => i.templateIndex === TEMPLATE.Waterskin), 'and the skin');
  const alchemist = stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 10 }, { level: 1 }, { rolls: () => 0.5 });
  assert.ok(!alchemist.some(isSurvivalItem), 'only the general store');
});

test('SURV2: the dead leave food - animals raw meat by kind (half of it turning), the slaughterfish raw fish, humanoids a meal on a high roll', () => {
  const bear = { mobileType: MOBILE_TYPES.GrizzlyBear, basics: { affinity: 'Animal' }, items: [] };
  assert.equal(isAnimal(bear), true);
  const meat = corpseFood(bear, { luck: 50, rolls: () => 0.0 });
  assert.equal(meat.length, MEAT_BY_TYPE[MOBILE_TYPES.GrizzlyBear][0] / 2, 'a low roll: the least a bear gives, halved by ANIMAL_LOOT_SCALE');   // MOD: -50%
  assert.ok(meat.every((i) => i.templateIndex === TEMPLATE.RawMeat));
  assert.ok(meat.every((i) => i.foodStage === 1), 'a roll under a half: every piece is turning');
  const lucky = corpseFood(bear, { luck: 90, rolls: () => 0.999 });
  assert.equal(lucky.length, (10 + (9 - 5)) / 2, 'the top of the range plus the luck mod over five, halved by ANIMAL_LOOT_SCALE');   // MOD: -50%
  assert.ok(lucky.every((i) => !i.foodStage));
  const rat = corpseFood({ mobileType: MOBILE_TYPES.Rat, basics: { affinity: 'Animal' } }, { rolls: () => 0.9 });
  assert.equal(rat.length, 0, 'a single-meat catch, halved: the same 0.9 stream fails the keep-roll');   // MOD: -50%
  const fish = corpseFood({ mobileType: MOBILE_TYPES.Slaughterfish, basics: { affinity: 'Daylight' } }, { rolls: () => 0.9 });
  assert.ok(fish.length >= 1 && fish.every((i) => i.templateIndex === TEMPLATE.RawFish), 'a fish is fish, halved by ANIMAL_LOOT_SCALE');   // MOD: -50%
  const orc = { mobileType: MOBILE_TYPES.Orc, basics: { team: 'Orcs', affinity: 'Darkness' } };
  assert.equal(isHumanoid(orc), true);
  assert.deepEqual(corpseFood(orc, { luck: 50, rolls: () => 0.0 }), [], 'a low roll: nothing');
  const carried = corpseFood(orc, { luck: 50, rolls: () => 0.999 });
  assert.equal(carried.length, 1, 'a 20: two things, but HUMANOID_FOOD_SCALE halves it to one');   // MOD: -50%
  const knight = { mobileType: 128 + 6, basics: { affinity: 'Human' } };
  assert.equal(isHumanoid(knight), true);
  assert.equal(corpseFood({ mobileType: MOBILE_TYPES.Ghost, basics: { affinity: 'Undead' } }, { rolls: () => 0.999 }).length, 0, 'a ghost carries nothing, whatever the roll');
  assert.equal(humanoidFood(() => 0.0).templateIndex, TEMPLATE.Rations);
  assert.equal(humanoidFood(() => 0.99).templateIndex, TEMPLATE.Waterskin);
});

test('SURV2: the mod\'s sixteen icons are vendored, allow-listed, and ride the texture pipeline as the port\'s own art through a stand-in archive', async () => {
  for (const f of VENDOR_ICON_FILES) assert.ok(existsSync(join(root, `vendor/climates-calories/Textures/${f}.png`)), f);
  const doctrine = read('test/doctrine.test.js');
  for (const f of [...VENDOR_ICON_FILES, ...VENDOR_TENT_FILES]) assert.ok(doctrine.includes(`'vendor/climates-calories/Textures/${f}.png'`), `${f} has its allow-list row`);
  for (const f of VENDOR_TENT_FILES) assert.ok(existsSync(join(root, `vendor/climates-calories/Textures/${f}.png`)), f);
  clearVendorTextures();
  const bytes = readFileSync(join(root, 'vendor/climates-calories/Textures/539_0-0.png'));
  const n = addVendorTextures([{ archive: 539, record: 0, fileName: '539_0-0', standIn: true, load: async () => new Uint8Array(bytes) }]);   // SURV-TENT: an archive that is ONLY this art
  assert.equal(n, 1);
  assert.equal(isVendorArchive(539), true);
  assert.equal(isVendorArchive(538), false);
  assert.equal(hasTextureReplacement(539, 0), true, 'ungated: not a user pick');
  const wasOn = getBool('Enhancements', 'AssetInjection');
  setValue('Enhancements', 'AssetInjection', false);
  assert.equal(hasTextureReplacement(539, 0), true, 'and still there with the user\'s injection off');
  setValue('Enhancements', 'AssetInjection', wasOn);
  const decoded = await preloadTextureArchive(539, { decode: async (b) => ({ width: 23, height: 26, data: new Uint8Array(23 * 26 * 4).fill(b[0]) }) });
  assert.equal(decoded, 1);
  const t = vendorTextureStandIn(539);
  assert.deepEqual([t.getWidth(0), t.getHeight(0)], [23, 26], 'the stand-in is sized by the decoded picture');
  assert.ok(decodedTexture(539, 0), 'and the swap arm finds the pixels');
  clearTextureReplacements();
  assert.ok(decodedTexture(539, 0), 'a user pick replacing the index does not lose the port\'s own');
  clearVendorTextures();
  assert.equal(vendorTextureCount(), 0);
  // SURV-TENT: eighteen now - the sixteen icons plus the tent's two
  // reskins, which are the OTHER kind of vendored file
  assert.equal(installSurvivalIcons({ fetchBytes: async () => new Uint8Array(bytes) }), 18, 'the boot registers all eighteen');
  assert.equal(installSurvivalIcons(), 0, 'once');
  assert.ok(isVendorArchive(532) && isVendorArchive(538), 'the icon archives are the port\'s own whole');
  // ...and 50 and 67 are NOT: they are real ARENA2 archives with one
  // record overridden, so the pipeline must still load the file. This
  // answering true would have cost every other record in them.
  assert.equal(isVendorArchive(50), false, 'TEXTURE.050 is still fetched');
  assert.equal(isVendorArchive(67), false, 'and TEXTURE.067');
  clearVendorTextures();
});

test('SURV2: by source - the pipeline stands a vendor archive in, the weight law adds water, the ladder\'s first arm is ours, the shelf and the kit are gated by the one switch', () => {
  const pipe = read('src/scenes/dataPipeline.js');
  assert.match(pipe, /if \(isVendorArchive\(archive\)\) \{\s*\n\s*await preloadTextureArchive\(archive\)\.catch\(\(\) => \{\}\);\s*\n\s*const v = vendorTextureStandIn\(archive\);/, 'no TEXTURE file is fetched for the port\'s own archives');
  assert.match(read('src/systems/inventory.js'), /if \(Number\.isFinite\(item\.water\) && item\.water > 0\) base \+= item\.water;/);
  assert.match(read('src/systems/useItem.js'), /if \(isSurvivalItem\(item\)\) out = useSurvivalItem\(item, collection, \{ entity, now: nowMinute, rolls, currentDay: Math\.trunc\(nowMinute \/ 1440\), inflict: inflictDisease \}\);\s*\n[\s\S]*?else if \(isBook\(item\)\)/);
  assert.match(read('src/systems/shopStock.js'), /if \(survivalOn\(\)\) for \(const it of provisionsStock\(quality, rolls\)\) items\.push\(it\);/);
  assert.match(read('src/systems/equip.js'), /if \(survivalOn\(\)\) for \(const it of startingProvisions\(\)\) entity\.items\.push\(it\);/);
  assert.match(read('src/systems/worldTick.js'), /installSurvivalIcons\(\);[^\n]*\n\s*installSurvivalLoot\(\{ enabled: survivalOn \}\);/, 'the corpse\'s food is off with the one switch');
  assert.match(read('src/systems/survival/switch.js'), /export const survivalOn = \(\) => getPref\(SURVIVAL_PREF\) !== false;/);
  assert.match(read('src/systems/features.js'), /key: 'survival', initial: true, online: true/, 'the row owns the key and the default: on');
});

// ═══ AUDIT VC6 (2026-09-18): THE DROP ROLLS ON THE POOL'S OWN STREAM ══
// Chased down from a pin that failed one run in eight: the three pools
// that raise a death (cityGuards, exteriorFoes, dungeonContext) handed
// `raiseEnemyDeath` an entity and nothing else, so this handler - which
// ROLLS - fell to Math.random and read the player's luck as 50. Two
// faults in one seam: a kill nobody could predict, and the whole of
// Climates & Calories' luck term dead, because `setSurvivalPlayerReader`
// had no caller anywhere in the tree and `_player()` always answered
// null. The reader is gone (a seam that looks wired is worse than one
// plainly absent) and every raiser hands its own luck.
test('AUDIT VC6: the corpse\'s food rolls on the roll it is HANDED, and on the luck it is handed - never on Math.random, and never on a luck of 50 it invented', async () => {
  const { installSurvivalLoot, uninstallSurvivalLoot } = await import('../src/systems/survival/loot.js');
  const { raiseEnemyDeath } = await import('../src/scenes/corpseMarker.js');
  const src = (f) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', f), 'utf8');

  // THE SEAM THAT LOOKED WIRED IS GONE, with the fallback it fed.
  const loot = src('src/systems/survival/loot.js');
  assert.doesNotMatch(loot, /export function setSurvivalPlayerReader/, 'the reader nothing ever set is deleted, not left looking live');
  assert.doesNotMatch(loot, /_player\(\)\?\./, 'and the fallback it fed goes with it');
  assert.match(loot, /const luck = opts\.luck \?\? 50;/, 'the raiser\'s own player, or the floor');
  assert.match(loot, /rolls: opts\.rolls \?\? Math\.random/, 'and the stream it is handed, or the floor');

  // EVERY POOL THAT RAISES A DEATH HANDS BOTH. cityGuards and
  // exteriorFoes carry a loot stream of their own (the same one
  // spawnEnemyLoot takes); dungeonContext carries none, so its roll
  // stays where its spawn loot's already is - but its luck is real.
  assert.match(src('src/scenes/cityGuards.js'), /raiseEnemyDeath\(g\.entity, \{ rolls: rand, luck: liveStat\(playerEntity, 'luck'\) \}\);/);
  assert.match(src('src/scenes/exteriorFoes.js'), /raiseEnemyDeath\(f\.entity, \{ rolls, luck: liveStat\(playerEntity, 'luck'\) \}\)/);
  assert.match(src('src/scenes/dungeonContext.js'), /raiseEnemyDeath\(foe\.entity, \{ luck: liveStat\(playerEntity, 'luck'\) \}\)/);
  for (const f of ['src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(src(f), /raiseEnemyDeath\([a-zA-Z.]+\);/, `${f}: no raiser hands an entity alone any more`);
  }

  // AND IT IS TRUE OF THE RUNNING HANDLER, not only of the source. A
  // humanoid killed with a stream that always answers 0.9 carries the
  // same thing every time; with Math.random it did not.
  uninstallSurvivalLoot();
  installSurvivalLoot({ enabled: () => true });
  const kill = (rolls, luck) => {
    const entity = { mobileType: MOBILE_TYPES.Knight, items: [] };
    raiseEnemyDeath(entity, { rolls, luck });
    return entity.items.map((i) => i.shortName ?? i.name);
  };
  const a = kill(() => 0.9, 50), b = kill(() => 0.9, 50);
  assert.deepEqual(a, b, 'the same stream, the same body - twice');
  assert.equal(a.length, 0, 'a roll of 19 is one meal, but the same 0.9 stream fails the 50% keep-roll HUMANOID_FOOD_SCALE adds');   // MOD: -50%
  // THE LUCK IS READ. A low roll that a lucky player carries over the
  // line is the whole of the term that was dead: 0.55 is a roll of 12,
  // which at luck 50 (mod 5) is 12 and carries nothing, and at luck 100
  // (mod 10) is 17 - still not above 17 - while 0.7 is 15, dead at 50
  // and 20 at luck 100, which is above BOTH thresholds: two meals.
  assert.deepEqual(kill(() => 0.55, 50), [], 'unlucky and unfed');
  assert.equal(kill(() => 0.7, 50).length, 0, 'the same roll at luck 50: nothing');
  assert.equal(kill(() => 0.7, 100).length, 1, 'and at luck 100 the same roll carries two, halved to one by HUMANOID_FOOD_SCALE');   // MOD: -50%
  uninstallSurvivalLoot();
});

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SURVIVAL_RULES, SURVIVAL_STORED } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { newSurvival, survivalMinute } from '../../../src/systems/survival/needs.js';
import { TEMPLATE, foodStage, waterIn } from '../../../src/systems/survival/food.js';
import { createSurvivalItem, spoilFood, provisionsStock, drinkAtSource, useSurvivalItem, SURVIVAL_TEMPLATES } from '../../../src/systems/survival/items.js';
import { campMenu, CAMP_TEXT, CAMP_KIND, FIRE_MINUTES, PLACE_AHEAD, TENT_MODEL } from '../../../src/systems/survival/camp.js';
import { hoodUp, sunlit } from '../../../src/systems/survival/temperature.js';
import { createCamps } from '../../../src/scenes/camps.js';
import { setWorldMinutes, setSharedClock } from '../../../src/systems/worldTick.js';
import { inventoryItemImage, mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { resolveItemName, survivalInfoTokens } from '../../../src/systems/item/itemInfo.js';
import { useItem } from '../../../src/systems/useItem.js';
import { assignStartingGear } from '../../../src/systems/startingGear.js';
import { seedStartingEquipment, equipTableOf } from '../../../src/systems/equip.js';
import { stockShopShelf } from '../../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

// ═══ AUDIT C&C (2026-10-12), THE ITEMS: lens I's findings on the food, the kit, the shelf and the camp menu ═══
//
// Every fixture is the real producers' (createSurvivalItem, the minute law's rot, the chargen assigner and its fallback,
// the provisions shelf and the general store's, the camp pool's own placing) and every number is a LITERAL (A PIN MUST
// FAIL): I5 the dress law reached by every stage change, I7 the mod's own start, I10 the dead refusal and the vendored
// README, I11 the shelf's empty skin and a cold camp's Cook. tools/mutants/auditcc_items.json breaks each law.

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);   // a floor at y = 0
const settle = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => { _resetForTests(); setWorldMinutes(0); setSharedClock(null); });

/** The real camp pool on a stub renderer, its ground a floor (scenes/camps.js createCamps - the hover's rows and the
 *  menu are what a player is offered). */
function campHost() {
  const said = [], overlays = [];
  const entity = { items: [] };
  const state = { feet: [0, 1, 0], yaw: 0 };
  const camps = createCamps({
    renderer: { createBillboardBatch: (a, r, size, centers) => ({ a, r, size, centers, frame: 0 }), destroyBillboardBatch: () => {}, drawMesh: () => {} },
    getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: state.feet, yaw: state.yaw }), collider: () => ({ raycast: flat() }), place: () => ({}), pixelKeyAt: () => 'px',
    say: (l) => said.push(l), showOverlay: (w) => overlays.push(w), openRest: () => said.push('REST'), advanceMinutes: (n) => said.push(`+${n}`),
    selfId: () => null,
  });
  return { camps, said, overlays, entity, state };
}

test('AUDIT C&C I5: FOOD THAT SPOILS IN THE PACK IS DRESSED AT EVERY STAGE - the minute law\'s rot (rotFoodDay -> rotRoll -> rotOnce) names it and puts the mod\'s spoiled picture on it, as a spoiled mint and a corpse\'s turning meat are dressed (one law, food.js dressFood); a putrid food\'s card says it cannot be eaten, and its Use says so', () => {
  setPref(SURVIVAL_PREF, SURVIVAL_STORED.casual);
  const pack = [createSurvivalItem(TEMPLATE.Bread), createSurvivalItem(TEMPLATE.RawFish), createSurvivalItem(TEMPLATE.Apple)];
  const T0 = 1440 * 300;
  const e = { stats: { ...STATS }, raceId: RACES.Breton, items: pack, activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, survival: newSurvival(T0) };
  // a Desert2 noon in Midyear: a rot day every 240 minutes, every roll a spoiling one - each food a stage a rot day
  const env = { climateIndex: CLIMATES.Desert2, month: 6, hour: 13, weather: 'sunny' };
  const deps = { sinks: {}, autoDrink: false, autoEat: false, rules: SURVIVAL_RULES.casual, rolls: () => 0.99, ctx: { raceId: RACES.Breton } };
  /** What the pack shows: the stage, the name the list reads (itemInfo.js resolveItemName), the picture it draws (itemTemplates.js inventoryItemImage). */
  const look = (it) => { const img = inventoryItemImage(it); return [foodStage(it), resolveItemName(it), img.archive, img.record]; };
  const seen = pack.map(() => []);
  for (let m = T0; m <= T0 + 1000; m++) {
    survivalMinute(e, m, env, deps);
    pack.forEach((it, i) => { const at = look(it); if (at[0] !== (seen[i].at(-1)?.[0] ?? 0)) seen[i].push(at); });
  }
  assert.deepEqual(seen, [
    [[1, 'Stale Bread', 211, 31], [2, 'Mouldy Bread', 534, 0], [3, 'Rotten Bread', 534, 1], [4, 'Putrid Bread', 534, 1]],
    [[1, 'Smelly Raw Fish', 211, 9], [2, 'Mouldy Raw Fish', 535, 0], [3, 'Rotten Raw Fish', 535, 1], [4, 'Putrid Raw Fish', 535, 1]],
    [[1, 'Soft Apple', 213, 1], [2, 'Mouldy Apple', 532, 0], [3, 'Rotten Apple', 532, 1], [4, 'Putrid Apple', 532, 1]],
  ], 'every stage named and pictured as it turns - stale wears the fresh picture, mouldy the mod\'s record 0, rotten and putrid its record 1');
  // one law: a food minted at a stage and a corpse's turning meat (spoilFood) are dressed as the pack's is
  const corpse = createSurvivalItem(TEMPLATE.RawFish); spoilFood(corpse); spoilFood(corpse);
  assert.deepEqual([look(createSurvivalItem(TEMPLATE.Bread, { foodStage: 4 })), look(corpse)], [[4, 'Putrid Bread', 534, 1], [2, 'Mouldy Raw Fish', 535, 0]]);
  // the card: putrid cannot be eaten (it read "Nourishes for 36 minutes (putrid)"); a raw one can still be cooked
  assert.deepEqual(pack.map((it) => survivalInfoTokens(it).map((t) => t.text)), [
    ['Putrid Bread', 'Weight: 1.50 kilograms', 'Putrid. Too disgusting to force down.'],
    ['Putrid Raw Fish', 'Weight: 2.00 kilograms', 'Putrid. Too disgusting to force down.', 'Raw. Cook it at a fire.'],
    ['Putrid Apple', 'Weight: 0.10 kilograms', 'Putrid. Too disgusting to force down.'],
  ]);
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.Bread, { foodStage: 3 }))[2].text, 'Nourishes for 45 minutes (rotten)', 'a stage short of putrid still feeds, by its stage');
  // and the Use names what it is: the real door (useItem.js), which refuses it
  const used = useItem(pack[0], e.items, { entity: e, nowMinute: T0 + 1000 });
  assert.deepEqual([used.kind, used.text, e.items.includes(pack[0])], ['notEaten', 'This Putrid Bread is too disgusting to force down.', true]);
});

test('AUDIT C&C I7: A NEW CHARACTER SETS OUT WITH THE MOD\'S OWN START IN EVERY TIER WITH THE ARC ON - Boons, Casual and Hard: two sacks of rations, a full skin, the Formal cloak drawn hood up and the Shoes of their own wardrobe at a quarter of their condition, in the pack and not worn, worn camping gear (25 uses) and the port\'s Campfire - on the wizard\'s mint and on the fallback; Off sets out with DFU\'s bag alone', () => {
  const BAG = {
    male: [[132, 'Spellbook'], [165, 'Short Shirt'], [151, 'Casual Pants'], [116, 'Shortsword'], [531, 'Rations'], [539, 'Waterskin'], [155, 'Formal Cloak'], [147, 'Shoes'], [530, 'Camping Equipment'], [541, 'Campfire'], [580, 'Wallet']],
    female: [[132, 'Spellbook'], [206, 'Short Shirt'], [190, 'Casual Pants'], [116, 'Shortsword'], [531, 'Rations'], [539, 'Waterskin'], [192, 'Formal Cloak'], [186, 'Shoes'], [530, 'Camping Equipment'], [541, 'Campfire'], [580, 'Wallet']],
  };
  /** The start's clothes as minted: [template, group, variant, dye, condition, of, value, worn slot, hood up]. */
  const CLOTHES = {
    male: [[155, 'MensClothing', 1, 0, 30, 120, 25, undefined, true], [147, 'MensClothing', 0, 0, 31, 125, 4, undefined, false]],
    female: [[192, 'WomensClothing', 1, 0, 30, 120, 25, undefined, true], [186, 'WomensClothing', 0, 0, 31, 125, 4, undefined, false]],
  };
  const clothesOf = (items) => items.filter((i) => [147, 155, 186, 192].includes(i.templateIndex))
    .map((i) => [i.templateIndex, i.group, i.variant, i.dye, i.currentCondition, i.maxCondition, i.value, i.equipSlot, hoodUp(i)]);
  for (const tier of ['boons', 'casual', 'hard']) {
    for (const gender of ['male', 'female']) {
      _resetForTests(); setPref(SURVIVAL_PREF, SURVIVAL_STORED[tier]);
      const e = { gender, items: [], stats: { ...STATS } };
      const added = assignStartingGear(e, { classIndex: 0, rolls: () => 0.3, torchesFromItems: false });
      assert.deepEqual(added.map((i) => [i.templateIndex, i.name]), BAG[gender], `${tier}, ${gender}: the mod's start after DFU's bag, in the order it adds them`);
      assert.deepEqual(clothesOf(added), CLOTHES[gender], `${tier}, ${gender}: the cloak hooded and the shoes, Blue, a quarter of their condition, carried`);
      assert.deepEqual(equipTableOf(e).filter(Boolean).map((i) => i.templateIndex).sort((a, b) => a - b), gender === 'male' ? [151, 165] : [190, 206], 'only DFU\'s own shirt and pants are worn');
      const kit = added.filter((i) => i.group === 'UselessItems2' && i.templateIndex !== 580);
      assert.deepEqual(kit.map((i) => [i.templateIndex, i.stackCount, i.currentCondition, i.maxCondition, i.water ?? null]),
        [[531, 2, 10, 10, null], [539, 1, 10, 10, 2], [530, 1, 25, 50, null], [541, 1, 8, 8, null]], 'two sacks, a full skin, the gear at 25 of 50, a full Campfire');
      const fallback = { gender, items: [] };
      seedStartingEquipment(fallback);
      assert.deepEqual(fallback.items.map((i) => i.templateIndex), gender === 'male' ? [113, 531, 539, 155, 147, 530, 541] : [113, 531, 539, 192, 186, 530, 541], `${tier}, ${gender}: the fallback packs the same start`);
      assert.deepEqual(clothesOf(fallback.items), CLOTHES[gender]);
    }
  }
  _resetForTests(); setPref(SURVIVAL_PREF, SURVIVAL_STORED.off);
  const off = { gender: 'female', items: [], stats: { ...STATS } };
  assert.deepEqual(assignStartingGear(off, { classIndex: 0, rolls: () => 0.3, torchesFromItems: false }).map((i) => i.templateIndex), [132, 206, 190, 116, 580], 'Off: DFU\'s bag and the wallet (Mac: "No, not off")');
  const offFallback = { gender: 'female', items: [] };
  seedStartingEquipment(offFallback);
  assert.deepEqual(offFallback.items.map((i) => i.templateIndex), [113]);
});

test('AUDIT C&C I10: no camp word that nothing says - "Turn Climates & Calories on to make camp." went with the gate it named (ENDLESS PROVISIONS); and the vendored README declares every column the port\'s rows change from the mod\'s own', () => {
  assert.equal(Object.values(CAMP_TEXT).includes('Turn Climates & Calories on to make camp.'), false);
  assert.equal(Object.hasOwn(CAMP_TEXT, 'arcOff'), false);
  const mod = JSON.parse(read('vendor/climates-calories/ItemTemplates.json'));
  const changed = [];
  for (const t of SURVIVAL_TEMPLATES) {
    const m = mod.find((r) => r.index === t.index);
    if (!m) continue;   // 541, the port's own Campfire
    for (const k of ['name', 'baseWeight', 'hitPoints', 'basePrice', 'rarity', 'worldTextureArchive', 'worldTextureRecord']) if (m[k] !== t[k]) changed.push([t.name, k, m[k], t[k]]);
  }
  assert.deepEqual(changed, [
    ['Cooked Fish', 'basePrice', 4, 6], ['Meat', 'basePrice', 50, 15], ['Raw Meat', 'basePrice', 10, 8], ['Waterskin', 'baseWeight', 2, 0.5], ['Skillet', 'basePrice', 500, 60],
  ], 'the five columns the port changes');
  const readme = read('vendor/climates-calories/README.md').replace(/\s+/g, ' ');
  for (const said of ['the meat 50 to 15', 'the skillet 500 to 60', 'the cooked fish 4 to 6', 'the raw meat 10 to 8', 'the waterskin\'s weight, 2 kilos to half a kilo', 'changes five columns', 'a row renaming 149, the men\'s Boots, "Shoes", which the port does not carry']) {
    assert.ok(readme.includes(said), `the README says: ${said}`);
  }
  assert.equal(mod.find((r) => r.index === 149).name, 'Shoes', 'the vendored file\'s 149 row, which the README names');
});

test('AUDIT C&C I11: AN EMPTY SKIN IS NAMED EMPTY WHEREVER IT IS MINTED - the provisions shelf\'s and the general store\'s, by the law a drink and a fill name it by (food.js waterskinName); A COLD CAMP OFFERS NO COOK - the cooking list only refused at it - and its Stoke or Relight lights it; a lit one cooks', async () => {
  const shelf = provisionsStock(5, () => 0.5).filter((i) => i.templateIndex === TEMPLATE.Waterskin);
  assert.deepEqual(shelf.map((s) => [s.name, waterIn(s)]), [['Empty Waterskin', 0], ['Empty Waterskin', 0]], 'the shelf sells them empty, and says so');
  const store = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { level: 1 }, { rolls: () => 0.5 }).filter((i) => i.templateIndex === TEMPLATE.Waterskin);
  assert.ok(store.length > 0 && store.every((s) => s.name === 'Empty Waterskin' && waterIn(s) === 0), 'the general store\'s too');
  assert.deepEqual(survivalInfoTokens(shelf[0]).map((t) => t.text), ['Empty Waterskin', 'Weight: 0.50 kilograms', 'Water: 0.0 of 2.0 kg']);
  assert.equal(createSurvivalItem(TEMPLATE.Waterskin).name, 'Waterskin', 'a full one, as the kit\'s');
  const e = { stats: { ...STATS }, items: [shelf[0]], activeEffects: [] };
  drinkAtSource(e, 1000);
  assert.deepEqual([shelf[0].name, waterIn(shelf[0])], ['Waterskin', 2], 'filled at a fountain: named full');
  for (let i = 0; i < 20; i++) useSurvivalItem(shelf[0], e.items, { entity: e, now: 1000 });
  assert.deepEqual([shelf[0].name, waterIn(shelf[0])], ['Empty Waterskin', 0], 'drunk dry: named empty again - the mint\'s name and the drink\'s are one');

  // the camp menu's law, every kind in both lanes: Cook only beside a lit fire
  const keys = (rows) => rows.map((r) => r.key);
  const tent = (litUntil) => ({ kind: CAMP_KIND.Tent, wear: 30, litUntil });
  const fire = (litUntil) => ({ kind: CAMP_KIND.Fire, fuel: true, wear: 6, litUntil });
  const jar = (litUntil) => ({ kind: CAMP_KIND.Fire, jar: true, wear: 1, litUntil });
  assert.deepEqual([
    keys(campMenu(tent(99), 10, true)), keys(campMenu(tent(5), 10, true)), keys(campMenu(tent(5), 10, false)),
    keys(campMenu(fire(99), 10, true)), keys(campMenu(fire(5), 10, true)), keys(campMenu(fire(5), 10, false)),
    keys(campMenu(jar(99), 10, true)), keys(campMenu(jar(5), 10, true)),
    keys(campMenu(tent(5), 10, true, { online: true })), keys(campMenu(fire(5), 10, true, { online: true })), keys(campMenu(fire(99), 10, false, { online: true })),
  ], [
    ['rest', 'cook', 'pack'], ['rest', 'stoke', 'pack'], ['rest'],
    ['rest', 'cook', 'pack'], ['rest', 'stoke', 'pack'], ['rest'],
    ['rest', 'cook'], ['rest'],
    ['stoke', 'rest', 'pack'], ['stoke', 'pack'], ['rest', 'cook'],
  ]);
  assert.equal(campMenu(fire(5), 10, true).find((r) => r.key === 'stoke').text, CAMP_TEXT.menuRelight, 'a cold Campfire\'s own row stays: Relight');

  // and through the real pool: a tent pitched off the pack, raw fish beside it
  setWorldMinutes(9000);
  const h = campHost();
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  h.entity.items.push(gear, createSurvivalItem(TEMPLATE.RawFish));
  assert.equal(h.camps.placeItem(gear, h.entity.items), true);
  await settle();
  h.state.feet = [0, 1, PLACE_AHEAD - 1];
  const key = h.camps.targets().find((t) => t.key.startsWith('camp:')).key;
  const rows = () => h.camps.hoverName(key).actions.map((a) => a.id);
  assert.deepEqual(rows(), ['rest', 'cook', 'pack'], 'lit: Cook');
  h.camps.activate(key, 'grab', 'cook');
  assert.deepEqual(h.overlays.at(-1).items, ['Raw Fish'], 'its Cook opens the cooking list');
  setWorldMinutes(9000 + FIRE_MINUTES + 5);
  h.camps.tick(0.1);
  assert.deepEqual(rows(), ['rest', 'stoke', 'pack'], 'burnt down: no Cook on the plaque');
  h.said.length = 0;
  h.camps.activate(key, 'grab');
  assert.deepEqual(h.overlays.at(-1).items, [CAMP_TEXT.menuRest, CAMP_TEXT.menuStoke, CAMP_TEXT.menuPack], 'nor in the menu');
  h.overlays.at(-1)._pick(1);
  assert.deepEqual(h.said, [CAMP_TEXT.stoked]);
  assert.deepEqual(rows(), ['rest', 'cook', 'pack'], 'stoked: Cook again');

  // online a friend's cold fire has nothing to do at it - its one row was the Cook that only refused: the plaque names
  // it, and a grab says what it is where it opened an empty list (scenes/camps.js openMenu)
  setSharedClock(() => 9000 + FIRE_MINUTES + 5);
  assert.equal(h.camps.applyOwner('friend', [{ i: 'f1', k: 1, p: [3, 0, PLACE_AHEAD - 1], y: 0, u: 9000, w: 6 }]), true);
  const friend = h.camps.targets().map((t) => t.key).find((k) => k.startsWith('camp:') && k !== key);
  assert.deepEqual(h.camps.hoverName(friend), { title: 'Campfire', actions: [] });
  const shown = h.overlays.length;
  h.said.length = 0;
  h.camps.activate(friend, 'grab');
  assert.deepEqual({ lists: h.overlays.length - shown, said: h.said }, { lists: 0, said: [CAMP_TEXT.seeEmbers] });
});

test('AUDIT C&C I1: A REST AT YOUR OWN COLD CAMP LIGHTS IT FIRST, AS ITS MENU WOULD - your burnt-down Campfire with fuel is relit for the rest (it stayed cold, and the night was the rough one beside it), and a camp the menu would not stoke - a worn-through tent - is not said stoked (it said "You stoke the fire." over a cold fire); through the real pool, offline', async () => {
  setWorldMinutes(20000);
  const h = campHost();
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  h.entity.items.push(fire);
  assert.equal(h.camps.placeItem(fire, h.entity.items), true);
  await settle();
  h.state.feet = [0, 1, PLACE_AHEAD - 1];
  const key = h.camps.targets().find((t) => t.key.startsWith('camp:')).key;
  const rec = h.camps.camps.find((c) => key.endsWith(c.rec.id))?.rec ?? h.camps.camps[0].rec;
  setWorldMinutes(20000 + FIRE_MINUTES + 5);
  h.camps.tick(0.1);
  assert.deepEqual(h.camps.hoverName(key).actions.map((a) => a.id), ['rest', 'stoke', 'pack'], 'burnt down, its fuel left');
  h.said.length = 0;
  h.camps.activate(key, 'grab', 'rest');
  assert.deepEqual(h.said, [CAMP_TEXT.relit, 'REST'], 'relit, then the rest - a camp\'s, by its fire');
  assert.equal(rec.litUntil, 20000 + FIRE_MINUTES + 5 + FIRE_MINUTES, 'lit for the night');
  h.said.length = 0;
  h.camps.activate(key, 'grab', 'rest');
  assert.deepEqual([h.said, rec.litUntil], [['REST'], 20000 + FIRE_MINUTES + 5 + FIRE_MINUTES], 'a lit one is rested at as it stands');
  // a worn-through tent: no Stoke on its list, and its rest is said as no stoking
  setWorldMinutes(30000);
  const t = campHost();
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  t.entity.items.push(gear);
  assert.equal(t.camps.placeItem(gear, t.entity.items), true);
  await settle();
  t.state.feet = [0, 1, PLACE_AHEAD - 1];
  const tkey = t.camps.targets().find((x) => x.key.startsWith('camp:')).key;
  const tent = t.camps.camps[0].rec;
  tent.wear = 0;
  setWorldMinutes(30000 + FIRE_MINUTES + 5);
  t.camps.tick(0.1);
  t.said.length = 0;
  t.camps.activate(tkey, 'grab', 'rest');
  assert.deepEqual(t.said, ['REST'], 'nothing said stoked');
  assert.equal(tent.litUntil <= 30000 + FIRE_MINUTES + 5, true, 'and nothing lit');
});

test('AUDIT C&C I2: A REST IN A TENT SLEEPS UNDER ITS ROOF, AND NO REST RUSTS - the mod\'s camp rest is its "inside or camping" arm, where the rain wets nothing and the wet only dries, and its ArmorDmg is rolled only in the arm "If not camping, bed sleeping or traveling": a Hard night asleep in the tent in the rain had soaked its sleeper and rusted the steel all night; the pool answers a tent in reach (a Campfire alone is no roof), and both outdoor hosts hand it', async () => {
  const HARD = SURVIVAL_RULES.hard;
  const RAIN = { climateIndex: CLIMATES.Woodlands, month: 6, hour: 2, weather: 'rain' };
  const night = (env, minutes = 10) => {
    const steel = mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0202, name: 'Steel', flags: 0, variant: 0 });
    const worn = []; worn[18] = steel;
    const e = { stats: { ...STATS }, raceId: RACES.Breton, items: [steel], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, survival: newSurvival(0) };
    e.survival.wet = 50;
    for (let m = 1; m <= minutes; m++) survivalMinute(e, m, env, { worn, sinks: {}, autoDrink: false, autoEat: false, rules: HARD, rolls: () => 0.01, ctx: { raceId: RACES.Breton } });
    return { wet: e.survival.wet, rusted: steel.currentCondition < steel.maxCondition };
  };
  const asleep = { resting: true, sleeping: 'camp', byFire: true };
  assert.deepEqual(night({ ...RAIN, ...asleep, sheltered: true }), { wet: 20, rusted: false }, 'in the tent: drying, nothing rusts');
  assert.deepEqual(night({ ...RAIN, resting: true, sleeping: 'rough', sheltered: true }), { wet: 20, rusted: false }, 'its fire out, the roof dries as well');
  assert.deepEqual(night({ ...RAIN, ...asleep }), { wet: 80, rusted: false }, 'asleep under the rain by a fire alone: soaking, still no rust');
  assert.deepEqual(night({ ...RAIN, insideBuilding: true }), { wet: 20, rusted: false }, 'awake under a roof: drying, no rust');
  assert.equal(night({ ...RAIN }).rusted, true, 'awake in the rain: the mod\'s own rust');
  assert.equal(sunlit({ hour: 12, weather: 'sunny', sheltered: true }), false, 'and no sun under canvas');
  // the pool: a tent in reach, a Campfire alone none
  setWorldMinutes(40000);
  const h = campHost();
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment), fire = createSurvivalItem(TEMPLATE.Campfire);
  h.entity.items.push(gear, fire);
  assert.equal(h.camps.placeItem(gear, h.entity.items), true);
  await settle();
  assert.equal(h.camps.tentNear([0, 1, PLACE_AHEAD - 1]), true, 'by the tent');
  h.state.feet = [40, 1, 0];
  assert.equal(h.camps.placeItem(fire, h.entity.items), true);
  await settle();
  assert.deepEqual([h.camps.tentNear([40, 1, PLACE_AHEAD - 1]), h.camps.byFire([40, 1, PLACE_AHEAD - 1])], [false, true], 'by a lone Campfire: a fire, no roof');
  // the hosts: a rest at a tent is sheltered, and the sun is the sheltered sun
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(file);
    assert.match(src, /const sheltered = m === 'exterior' && !!playerEntity\.isResting && !!camps\.tentNear\(feet\);/, file);
    assert.match(src, /inSunlight: m === 'exterior' && sunlit\(\{ hour, weather, sheltered \}\),/, file);
    assert.match(src, /byFire: m === 'exterior' && camps\.byFire\(feet\), sheltered,/, file);
  }
});

test('AUDIT C&C (lens I): A WORLD FIRE\'S REST IS THE FIRE\'S, AND SO IS ITS REACH - the ray meets a brazier\'s sprite from the far side of its box while the rest\'s place reads the feet against the flame at the top of the flat; the Rest row asks what the place will: within reach it rests, beyond it says so and opens no rough night - from the plaque and from the list alike (mutants: the plaque\'s row unchecked; the list\'s row unchecked; the reach dropped)', () => {
  setPref(SURVIVAL_PREF, SURVIVAL_STORED.casual);
  setSharedClock(() => 1000);   // online: no plaque row lit opens the hearth's own list
  const said = [], overlays = [];
  const state = { feet: [3, 0, 0] };
  // a brazier whose collector stood its light at the top of a three-metre flat (the exterior hosts' cityLights)
  const camps = createCamps({
    entity: { items: [] }, hearths: () => [{ x: 0, y: 3, z: 0, foot: 0, w: 1, h: 3 }], camera: () => ({ feet: state.feet, yaw: 0 }),
    say: (l) => said.push(l), showOverlay: (w) => overlays.push(w), openRest: (c) => said.push(c === null ? 'REST' : 'CAMP REST'),
  });
  // three metres out and three under the flame - 4.24 from it: past BY_FIRE_REACH, the place the rest would read rough
  assert.equal(camps.fireNear(state.feet), false, 'the place: no fire in reach');
  assert.equal(camps.activate('hearth:0', 'grab', 'rest'), true);
  assert.deepEqual(said, [CAMP_TEXT.restCloser], 'the plaque\'s Rest: told to come closer, no rest opened');
  camps.activate('hearth:0', 'grab');
  assert.equal(overlays.length, 1, 'with no row lit online, the hearth\'s own list');
  overlays[0].onPick(0);
  assert.deepEqual(said, [CAMP_TEXT.restCloser, CAMP_TEXT.restCloser], '...and its Rest row the same');
  // two metres out - 3.61 from the flame: in reach, and the rest the fire's
  state.feet = [2, 0, 0];
  assert.equal(camps.fireNear(state.feet), true);
  camps.activate('hearth:0', 'grab', 'rest');
  overlays[0].onPick(0);
  assert.deepEqual(said.slice(2), ['REST', 'REST'], 'both doors rest at the fire once the feet are in its reach');
});

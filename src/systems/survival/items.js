// SURV2 - THE SURVIVAL ITEMS: the templates, the minting, the shops'
// provisions, the starting kit, the use handlers and the mod's own
// icons. After Climates & Calories' ItemTemplates.json (vendored at
// vendor/climates-calories/, indices 530-540 verbatim in name and
// texture, the prices retuned where the mod's were typos) plus the
// port's own campfire at 541 (Mac: "a new campfire item players can
// buy and place").
//
// WHAT AN ITEM CARRIES. A food carries `foodStage` (food.js) and, once
// spoiled past stale, its own world icon - the mod's spoiled pictures,
// archive = template, record 0 mouldy / 1 rotten - exactly DFU's
// item-level world-texture override (DaggerfallUnityItem.cs:1730), so
// the inventory needs no new law to draw it. A waterskin carries
// `water` (kg), which the weight law adds and the name reads. Camping
// equipment and the campfire carry their condition as USES.
import { registerCustomTemplates, templateByIndex, mintCondition, setItemFields, ITEM_TEMPLATES } from '../itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from '../textureReplacement.js';
const dice100 = (chance, roll01) => Math.floor(roll01 * 100) < chance;   // Dice100's line; no combat import (the formulas -> equip cycle)
import {
  TEMPLATE, SURVIVAL_GROUP, FOOD, isFood, foodOf, foodName, foodSatiety, eatLaw, sickenFromMeal, rotOnce,
  isWaterskin, waterIn, waterskinName, drinkFrom, refillSkins, DRINK_RELIEF, WATERSKIN_CAPACITY_KG,
} from './food.js';
import { survivalOf, NEED } from './needs.js';

/** The torch's icon stands in for the campfire's bundle until it has
 *  art of its own (a torch is UselessItems2 247, a world-textured item). */
const TORCH = ITEM_TEMPLATES[247];
export const CAMPFIRE_USES = 5;
export const CAMPING_USES = 50;

/** The rows, registered at import (so any mint that names an index
 *  finds it). Columns are DFU's ItemTemplates.txt's. */
export const SURVIVAL_TEMPLATES = Object.freeze([
  { index: TEMPLATE.CampingEquipment, name: 'Camping Equipment', baseWeight: 5.0, hitPoints: CAMPING_USES, basePrice: 150, rarity: 1, worldTextureArchive: 204, worldTextureRecord: 8 },
  { index: TEMPLATE.Rations, name: 'Rations', baseWeight: 1.0, hitPoints: 10, basePrice: 20, rarity: 1, worldTextureArchive: 205, worldTextureRecord: 17, stackable: true },
  { index: TEMPLATE.Apple, name: 'Apple', baseWeight: 0.1, hitPoints: 90, basePrice: 1, rarity: 3, worldTextureArchive: 213, worldTextureRecord: 1 },
  { index: TEMPLATE.Orange, name: 'Orange', baseWeight: 0.1, hitPoints: 90, basePrice: 2, rarity: 3, worldTextureArchive: 213, worldTextureRecord: 0 },
  { index: TEMPLATE.Bread, name: 'Bread', baseWeight: 1.5, hitPoints: 95, basePrice: 5, rarity: 3, worldTextureArchive: 211, worldTextureRecord: 31 },
  { index: TEMPLATE.RawFish, name: 'Raw Fish', baseWeight: 2.0, hitPoints: 50, basePrice: 4, rarity: 20, worldTextureArchive: 211, worldTextureRecord: 9 },
  { index: TEMPLATE.CookedFish, name: 'Cooked Fish', baseWeight: 1.5, hitPoints: 80, basePrice: 6, rarity: 10, worldTextureArchive: 211, worldTextureRecord: 10 },
  { index: TEMPLATE.Meat, name: 'Meat', baseWeight: 2.0, hitPoints: 90, basePrice: 15, rarity: 20, worldTextureArchive: 211, worldTextureRecord: 40 },
  { index: TEMPLATE.RawMeat, name: 'Raw Meat', baseWeight: 2.0, hitPoints: 60, basePrice: 8, rarity: 40, worldTextureArchive: 538, worldTextureRecord: 2 },
  { index: TEMPLATE.Waterskin, name: 'Waterskin', baseWeight: 0.5, hitPoints: 10, basePrice: 10, rarity: 1, worldTextureArchive: 539, worldTextureRecord: 0 },
  { index: TEMPLATE.Skillet, name: 'Skillet', baseWeight: 5.0, hitPoints: 100, basePrice: 60, rarity: 5, worldTextureArchive: 218, worldTextureRecord: 4 },
  { index: TEMPLATE.Campfire, name: 'Campfire Kit', baseWeight: 3.0, hitPoints: CAMPFIRE_USES, basePrice: 25, rarity: 1, worldTextureArchive: TORCH?.worldTextureArchive ?? 205, worldTextureRecord: TORCH?.worldTextureRecord ?? 17 },
]);
registerCustomTemplates(SURVIVAL_TEMPLATES);

/** The mod's own icons: the spoiled faces of each food (record 0
 *  mouldy, 1 rotten and worse), raw meat's three, the waterskin. */
export const VENDOR_ICON_FILES = Object.freeze([
  '532_0-0', '532_1-0', '533_0-0', '533_1-0', '534_0-0', '534_1-0', '535_0-0', '535_1-0',
  '536_0-0', '536_1-0', '537_0-0', '537_1-0', '538_0-0', '538_1-0', '538_2-0', '539_0-0',
]);
/** SURV-TENT: the mod's TENT RESKINS, which are a different KIND of
 *  vendored file from the icons above. The camp stands the mod's own
 *  model (41606, `camp.js` TENT_MODEL) and the mod dresses it by
 *  overriding two records of REAL ARENA2 archives - a 32x32 tan canvas
 *  at 50_7-0 and a 64x8 dark pole at 67_10-0 - the way a texture pack
 *  overrides one. TEXTURE.050 and TEXTURE.067 are real files carrying
 *  dozens of other records, so these register WITHOUT `standIn`: the
 *  pipeline must still load the archive and swap only these two
 *  records. Without them the tent wore whatever the base game put on
 *  that model. */
export const VENDOR_TENT_FILES = Object.freeze(['50_7-0', '67_10-0']);
export const vendorIconUrl = (name) => new URL(`../../../vendor/climates-calories/Textures/${name}.png`, import.meta.url).href;
let _iconsInstalled = false;
const vendorEntry = (f, load, standIn) => { const m = /^(\d+)_(\d+)-(\d+)$/.exec(f); return { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), fileName: f, standIn, load: () => load(f) }; };
/** Register the mod's own art with the texture pipeline (once; a test
 *  may pass its own fetch). The icons are archives that exist ONLY as
 *  this art (`standIn`); the tent's two are records of real archives. */
export function installSurvivalIcons({ fetchBytes = null } = {}) {
  if (_iconsInstalled && vendorTextureCount() > 0) return 0;   // once - unless the registry was cleared under it (a test's reset)
  _iconsInstalled = true;
  const load = fetchBytes ?? (async (name) => { const r = await fetch(vendorIconUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  return addVendorTextures([
    ...VENDOR_ICON_FILES.map((f) => vendorEntry(f, load, true)),
    ...VENDOR_TENT_FILES.map((f) => vendorEntry(f, load, false)),
  ]);
}

export const isSurvivalItem = (item) => !!item && item.templateIndex >= TEMPLATE.CampingEquipment && item.templateIndex <= TEMPLATE.Campfire && (item.group == null || item.group === SURVIVAL_GROUP);
export const isCampingEquipment = (item) => !!item && item.templateIndex === TEMPLATE.CampingEquipment;
export const isCampfireKit = (item) => !!item && item.templateIndex === TEMPLATE.Campfire;
export const isSkillet = (item) => !!item && item.templateIndex === TEMPLATE.Skillet;

/** Mint one: the template's row, condition as uses, a stack, water. */
export function createSurvivalItem(templateIndex, { stackCount = 1, water = null, foodStage: stage = 0, condition = null } = {}) {
  const t = templateByIndex(templateIndex);
  if (!t?.custom) return null;
  const item = mintCondition(setItemFields({ group: SURVIVAL_GROUP, templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: t.stackable ? Math.max(1, stackCount) : 1 }));
  if (condition != null) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? condition, condition));   // SURV3: the port's condition field (mintCondition), not a field of its own - the uses the pool reads
  if (isWaterskin(item)) item.water = water == null ? WATERSKIN_CAPACITY_KG : Math.max(0, Math.min(WATERSKIN_CAPACITY_KG, water));   // named by its template at the mint (the shelf's law); the name follows the water once it is drunk from or filled
  if (isFood(item) && stage > 0) { for (let i = 0; i < stage; i++) rotOnce(item); }   // food.js rotOnce dresses each stage
  return item;
}

// ---- THE USE HANDLERS (systems/useItem.js hands these items here) ----
export const SURVIVAL_USE_TEXT = Object.freeze({
  ate: (name) => `You eat the ${name}.`,
  feel: (feel) => `You feel ${feel} by the meal.`,
  notHungry: (name) => `You are not hungry enough to eat the ${name} right now.`,
  putrid: (name) => `This ${name} is too disgusting to force down.`,
  rations: 'You eat some rations.',
  emptySack: 'You empty your sack of rations.',
  drank: 'You drink from your waterskin.',
  drankLow: 'Your waterskin is nearly empty.',   // AUDIT SURV-TIERS (the third pass): one spelling - the automatic drink's (needs.js) had it
  drained: 'You drain your waterskin.',
  emptySkin: 'Your waterskin is empty. Find a fountain, a well or a trough.',   // AUDIT SURV-TIERS (the third pass): the sources that fill one - no stream ever did
  skillet: 'Cooking at a campfire goes twice as fast with a skillet.',
  fullSkin: 'Your waterskin is already full.',
  campingIndoors: 'You cannot set up camp in here.',
  campingTown: 'It is illegal to camp in town.',
  campingFoes: 'There are enemies nearby.',
  refilled: 'You refill your water.',
  quenched: 'You quench your thirst.',
  noSkins: 'You have no waterskins to fill.',
});

/**
 * Use one survival item off `collection` for `entity` at `now`.
 * Returns useItem.js's result shape: { kind, text } - and for the two
 * placeables ('pitchCamp', 'placeFire') hands the item to the host,
 * which owns the ground.
 */
export function useSurvivalItem(item, collection, { entity = null, now = 0, rolls = Math.random, currentDay = 0, onContract = null, inflict = null, rules = undefined } = {}) {
  if (!isSurvivalItem(item)) return null;
  const list = Array.isArray(collection) ? collection : null;
  const takeOne = () => {
    if (!list) return;
    if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
    else { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); }
  };
  if (isFood(item)) {
    const s = entity ? survivalOf(entity, now) : { lastAte: now - 10000, thirst: 0, notes: {} };
    const luck = entity?.stats?.luck ?? 50;
    const r = eatLaw(item, { lastAte: s.lastAte, now, luck, rolls, rules });   // SURV-TIERS: the tier's sickness (Hard's when none)
    const name = foodName(item);
    if (!r.ok) return { kind: 'notEaten', text: r.reason === 'putrid' ? SURVIVAL_USE_TEXT.putrid(name) : r.reason === 'not hungry' ? SURVIVAL_USE_TEXT.notHungry(name) : 'Nothing happens.' };
    s.lastAte = r.lastAte;
    s.thirst = Math.max(0, (s.thirst ?? 0) - (r.thirstRelief ?? 0));
    takeOne();
    if (entity && r.sick) sickenFromMeal(entity, r.sick, { inflict, rolls, currentDay, onContract });
    const rations = item.templateIndex === TEMPLATE.Rations;
    const text = rations ? (list && !list.includes(item) ? `${SURVIVAL_USE_TEXT.rations} ${SURVIVAL_USE_TEXT.emptySack}` : SURVIVAL_USE_TEXT.rations) : `${SURVIVAL_USE_TEXT.ate(name)} ${SURVIVAL_USE_TEXT.feel(r.feel)}`;
    return { kind: 'ate', text, satiety: r.satiety, sick: r.sick };
  }
  if (isWaterskin(item)) {
    const r = drinkFrom(item);
    if (!r.ok) return { kind: 'empty', text: SURVIVAL_USE_TEXT.emptySkin };
    item.name = waterskinName(item);
    if (entity) {
      const s = survivalOf(entity, now);
      s.thirst = Math.max(0, s.thirst - DRINK_RELIEF);
    }
    return { kind: 'drank', text: r.empty ? SURVIVAL_USE_TEXT.drained : r.low ? SURVIVAL_USE_TEXT.drankLow : SURVIVAL_USE_TEXT.drank, left: r.left };
  }
  if (isCampingEquipment(item)) return { kind: 'pitchCamp', item };
  if (isCampfireKit(item)) return { kind: 'placeFire', item };
  if (isSkillet(item)) return { kind: 'info', text: SURVIVAL_USE_TEXT.skillet };
  return { kind: 'none' };
}

/** A water source: fill every skin, quench the thirst, say what happened. */
export function drinkAtSource(entity, now, { kg = Infinity } = {}) {
  const items = entity.items ?? [];
  const s = survivalOf(entity, now);
  const r = refillSkins(items, kg);
  for (const i of items) if (isWaterskin(i)) i.name = waterskinName(i);
  const lines = [];
  if (s.thirst > 0) { s.thirst = 0; lines.push(SURVIVAL_USE_TEXT.quenched); }
  if (r.skins === 0) lines.push(SURVIVAL_USE_TEXT.noSkins);
  else if (r.filled === 0) lines.push(SURVIVAL_USE_TEXT.fullSkin);
  else lines.push(SURVIVAL_USE_TEXT.refilled);
  return { ...r, text: lines.join(' ') };
}

/** Exterior water sources by flat and by model, the mod's own list
 *  (RegisterCustomActivation, Init): fountains and wells as town flats
 *  (TEXTURE.212 records 0, 2, 8, 9), the three trough models, and the
 *  dry fountain (212, 3) that only says so. */
export const WATER_SOURCE_FLATS = Object.freeze({ 212: Object.freeze([0, 2, 8, 9]), 85: Object.freeze([0]) });
export const DRY_SOURCE_FLATS = Object.freeze({ 212: Object.freeze([3]) });
export const WATER_SOURCE_MODELS = Object.freeze([41220, 41221, 41222]);
export const DRY_SOURCE_TEXT = 'This fountain is dry as dust.';

/** WORLD-HOVER (AUDIT-WH M6): what the PLAQUE calls one. The mod has
 *  no word for a water source - it is Climates & Calories' object
 *  (SURV3), standing in the same ray - so it rides World Tooltips'
 *  extension API like the torches and the camps.
 *
 *  A DRY one carries the press's own sentence as a sub-line rather
 *  than a second title: the plaque exists so the decision happens in
 *  the world, and "this one is dry" is the whole decision here. */
export const WATER_SOURCE_NAME = 'Water Source';
export const waterSourceHoverName = (dry) => ({ title: WATER_SOURCE_NAME, subs: dry ? [DRY_SOURCE_TEXT] : [] });
export const isWaterSourceFlat = (archive, record) => (WATER_SOURCE_FLATS[archive] ?? []).includes(record);
export const isDrySourceFlat = (archive, record) => (DRY_SOURCE_FLATS[archive] ?? []).includes(record);

// ---- THE SHOPS AND THE START -----------------------------------------
/** A general store's provisions shelf: rations, bread, fruit, a skin or
 *  two, a fire kit, and camping gear and a skillet in a better shop. */
export function provisionsStock(quality = 5, rolls = Math.random) {
  const n = (min, max) => min + Math.floor(rolls() * (max - min + 1));
  const out = [];
  out.push(createSurvivalItem(TEMPLATE.Rations, { stackCount: n(2, 5) }));
  for (let i = n(1, 3); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Bread));
  for (let i = n(1, 3); i > 0; i--) out.push(createSurvivalItem(rolls() < 0.5 ? TEMPLATE.Apple : TEMPLATE.Orange));
  for (let i = n(1, 2); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Waterskin, { water: 0 }));
  for (let i = n(1, 3); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Campfire));
  if (quality >= 5 || dice100(30, rolls())) out.push(createSurvivalItem(TEMPLATE.CampingEquipment));
  if (quality >= 8 || dice100(20, rolls())) out.push(createSurvivalItem(TEMPLATE.Skillet));
  return out.filter(Boolean);
}

/** A new character sets out with two sacks of rations, a full skin and
 *  worn camping gear (half its uses gone) - the mod's own start,
 *  with the shipwreck's cold-and-wet arm left to the host. */
export function startingProvisions() {
  return [
    createSurvivalItem(TEMPLATE.Rations, { stackCount: 2 }),
    createSurvivalItem(TEMPLATE.Waterskin),
    createSurvivalItem(TEMPLATE.CampingEquipment, { condition: Math.trunc(CAMPING_USES / 2) }),
    createSurvivalItem(TEMPLATE.Campfire, { condition: 2 }),
  ];
}

export { TEMPLATE, FOOD, foodOf, foodSatiety, isFood, isWaterskin, waterIn, NEED };

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
// the inventory needs no new law to draw it (food.js dressFood, which
// every stage change runs - AUDIT C&C I5). A waterskin carries
// `water` (kg), which the weight law adds and the name reads. Camping
// equipment and the campfire carry their condition as USES.
import { registerCustomTemplates, templateByIndex, mintCondition, setItemFields, ITEM_TEMPLATES } from '../item/itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from '../textureReplacement.js';
import { DYE_COLORS } from '../../characters/dyes.js';   // AUDIT C&C I7: the start's clothes, in CreateMensClothing's default dye
const dice100 = (chance, roll01) => Math.floor(roll01 * 100) < chance;   // Dice100's line; no combat import (the formulas -> equip cycle)
import {
  TEMPLATE, SURVIVAL_GROUP, FOOD, isFood, foodOf, foodStage, foodName, foodSatiety, eatLaw, sickenFromMeal, rotOnce, dressFood, VENDOR_ICON_FILES,
  isWaterskin, waterIn, waterskinName, drinkFrom, refillSkins, DRINK_RELIEF, WATERSKIN_CAPACITY_KG, FOOD_STAGE,
} from './food.js';
import { survivalOf, NEED } from './needs.js';
import { maxFatigue } from '../statMods.js';   // ENDLESS PROVISIONS: the Off meal gives stamina back

/** The torch's icon stands in for the campfire's bundle until it has
 *  art of its own (a torch is UselessItems2 247, a world-textured item). */
const TORCH = ITEM_TEMPLATES[247];
export const CAMPFIRE_USES = 8;   // REST2: eight nights of fuel, a night its owner sleeps at it spending one (camp.js spendCampNight)
export const CAMPING_USES = 50;
/** ENDLESS PROVISIONS: a full meal's worth of satiety - the Off meal gives back satiety / this of the stamina pool. */
export const OFF_MEAL_FULL_MINUTES = 960;

/** The rows, registered at import (so any mint that names an index
 *  finds it). Columns are DFU's ItemTemplates.txt's. */
export const SURVIVAL_TEMPLATES = Object.freeze([
  { index: TEMPLATE.CampingEquipment, name: 'Camping Equipment', baseWeight: 5.0, hitPoints: CAMPING_USES, basePrice: 150, rarity: 1, worldTextureArchive: 204, worldTextureRecord: 8 },
  { index: TEMPLATE.Rations, name: 'Rations', baseWeight: 1.0, hitPoints: 10, basePrice: 20, rarity: 1, worldTextureArchive: 205, worldTextureRecord: 17, stackable: true },
  { index: TEMPLATE.Apple, name: 'Apple', baseWeight: 0.1, hitPoints: 90, basePrice: 1, rarity: 3, worldTextureArchive: 213, worldTextureRecord: 1 },
  { index: TEMPLATE.Orange, name: 'Orange', baseWeight: 0.1, hitPoints: 90, basePrice: 2, rarity: 3, worldTextureArchive: 213, worldTextureRecord: 0 },
  { index: TEMPLATE.Bread, name: 'Bread', baseWeight: 1.5, hitPoints: 95, basePrice: 5, rarity: 3, worldTextureArchive: 211, worldTextureRecord: 31 },
  // CRAFT-PAYS (2026-10-21, the Discord's #feature-feedback: "Food is too heavy. Especially meat... meat should reduce in
  // weight once cooked becasue most of that weight will be water"; bible/06-Systems/Professions-Arc.md section 48): the
  // mod's raw meat and raw fish weighed two kilos a piece and kept it all through the fire. A cut is a kilo, and cooked it
  // is half that - the water gone - so a cooked Meat weighs a quarter of what it did and a Cooked Fish a third (AUDIT
  // CRAFT-WRITS T7: "a quarter" was the Meat's alone). The dishes stand on these rows
  // (professions/profTemplates.js DISH_TEMPLATE_ROWS) and lighten with them; Bread and Rations are the mod's.
  { index: TEMPLATE.RawFish, name: 'Raw Fish', baseWeight: 1.0, hitPoints: 50, basePrice: 4, rarity: 20, worldTextureArchive: 211, worldTextureRecord: 9 },
  { index: TEMPLATE.CookedFish, name: 'Cooked Fish', baseWeight: 0.5, hitPoints: 80, basePrice: 6, rarity: 10, worldTextureArchive: 211, worldTextureRecord: 10 },
  { index: TEMPLATE.Meat, name: 'Meat', baseWeight: 0.5, hitPoints: 90, basePrice: 15, rarity: 20, worldTextureArchive: 211, worldTextureRecord: 40 },
  { index: TEMPLATE.RawMeat, name: 'Raw Meat', baseWeight: 1.0, hitPoints: 60, basePrice: 8, rarity: 40, worldTextureArchive: 538, worldTextureRecord: 2 },
  { index: TEMPLATE.Waterskin, name: 'Waterskin', baseWeight: 0.5, hitPoints: 10, basePrice: 10, rarity: 1, worldTextureArchive: 539, worldTextureRecord: 0 },
  { index: TEMPLATE.Skillet, name: 'Skillet', baseWeight: 5.0, hitPoints: 100, basePrice: 60, rarity: 5, worldTextureArchive: 218, worldTextureRecord: 4 },
  // AUDIT REST II H7: its condition is its FUEL (REST2's nights), never wear - a repair counter refilled eight nights for
  // less than one Firewood's three (isNotRepairable: "This cannot be repaired.", DFU's own refusal)
  { index: TEMPLATE.Campfire, name: 'Campfire', baseWeight: 3.0, hitPoints: CAMPFIRE_USES, basePrice: 40, rarity: 1, worldTextureArchive: TORCH?.worldTextureArchive ?? 205, worldTextureRecord: TORCH?.worldTextureRecord ?? 17, isNotRepairable: true },
]);
registerCustomTemplates(SURVIVAL_TEMPLATES);

/** SURV-TENT: the mod's TENT RESKINS, which are a different KIND of
 *  vendored file from the icons (food.js VENDOR_ICON_FILES, the picture
 *  law's own list). The camp stands the mod's own
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
  if (isWaterskin(item)) {
    item.water = water == null ? WATERSKIN_CAPACITY_KG : Math.max(0, Math.min(WATERSKIN_CAPACITY_KG, water));
    // AUDIT C&C I11: named by its water at the mint, as a drink or a fill names it - the shelf's empty skin read
    // "Waterskin" until its first fill, where a skin drunk dry reads "Empty Waterskin"
    item.name = waterskinName(item);
  }
  if (isFood(item) && stage > 0) { for (let i = 0; i < stage; i++) spoilFood(item); }
  return item;
}

/** Spoil a food one stage, dressed: food.js rotOnce - AUDIT C&C I5: the one law, which dresses every stage it turns
 *  (the minute law's rot in the pack too), so a corpse's turning meat and the pack's bread are named and pictured
 *  alike. */
export const spoilFood = rotOnce;

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
export function useSurvivalItem(item, collection, { entity = null, now = 0, rolls = Math.random, currentDay = 0, onContract = null, inflict = null, rules = undefined, offMeal = false } = {}) {
  if (!isSurvivalItem(item)) return null;
  if (isFood(item)) return eatFood(item, collection, { entity, now, rolls, currentDay, onContract, inflict, rules, offMeal });
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

/**
 * EAT one food off `collection` - the eating law's (food.js eatLaw), the needs it meets, the meal's sickness, its words.
 * PROF9: its own export, so a food another arc makes (Cooking's dishes, food.js registerFoods) is eaten by THIS law,
 * imported, never typed again (systems/cookItems.js). Answers useItem.js's shape: { kind: 'ate' | 'notEaten', text }.
 */
export function eatFood(item, collection, { entity = null, now = 0, rolls = Math.random, currentDay = 0, onContract = null, inflict = null, rules = undefined, offMeal = false } = {}) {
  if (!isFood(item)) return null;
  const list = Array.isArray(collection) ? collection : null;
  if (offMeal) {
    // ENDLESS PROVISIONS (2026-10-04, Mac: "i can use and find all those without climates and calories"): with Climates
    // & Calories OFF there is no hunger to ask - the classic body is never hungry, and the sack answered "not hungry
    // enough" for ever. So an Off meal is always eaten (bar a putrid one), never sickens, and gives back stamina in
    // proportion to how filling it is (satiety / OFF_MEAL_FULL_MINUTES of the pool: rations 25%, bread 19%, an apple 6%).
    const name = foodName(item);
    if (foodStage(item) >= FOOD_STAGE.Putrid) return { kind: 'notEaten', text: SURVIVAL_USE_TEXT.putrid(name) };
    if (list) {
      if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
      else { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); }
    }
    let gave = 0;
    if (entity) {
      const pool = maxFatigue(entity);
      gave = Math.min(Math.max(0, pool - (entity.fatigue ?? 0)), Math.round(pool * Math.min(1, foodSatiety(item) / OFF_MEAL_FULL_MINUTES)));
      entity.fatigue = (entity.fatigue ?? 0) + gave;
    }
    const rations = item.templateIndex === TEMPLATE.Rations;
    const text = rations ? (list && !list.includes(item) ? `${SURVIVAL_USE_TEXT.rations} ${SURVIVAL_USE_TEXT.emptySack}` : SURVIVAL_USE_TEXT.rations) : SURVIVAL_USE_TEXT.ate(name);
    return { kind: 'ate', text: gave > 0 ? `${text} You feel your strength returning.` : text, satiety: foodSatiety(item), sick: null, stamina: gave };
  }
  const s = entity ? survivalOf(entity, now) : { lastAte: now - 10000, thirst: 0, notes: {} };
  const luck = entity?.stats?.luck ?? 50;
  const r = eatLaw(item, { lastAte: s.lastAte, now, luck, rolls, rules });   // SURV-TIERS: the tier's sickness (Hard's when none)
  const name = foodName(item);
  if (!r.ok) return { kind: 'notEaten', text: r.reason === 'putrid' ? SURVIVAL_USE_TEXT.putrid(name) : r.reason === 'not hungry' ? SURVIVAL_USE_TEXT.notHungry(name) : 'Nothing happens.' };
  s.lastAte = r.lastAte;
  s.thirst = Math.max(0, (s.thirst ?? 0) - (r.thirstRelief ?? 0));
  if (list) {
    if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
    else { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); }
  }
  if (entity && r.sick) sickenFromMeal(entity, r.sick, { inflict, rolls, currentDay, onContract });
  const rations = item.templateIndex === TEMPLATE.Rations;
  const text = rations ? (list && !list.includes(item) ? `${SURVIVAL_USE_TEXT.rations} ${SURVIVAL_USE_TEXT.emptySack}` : SURVIVAL_USE_TEXT.rations) : `${SURVIVAL_USE_TEXT.ate(name)} ${SURVIVAL_USE_TEXT.feel(r.feel)}`;
  return { kind: 'ate', text, satiety: r.satiety, sick: r.sick };
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
 *  two (sold empty, and named so - AUDIT C&C I11), two to four Campfires
 *  on the counter's shelf (REST2), and camping gear and a skillet in a
 *  better shop. */
export function provisionsStock(quality = 5, rolls = Math.random, { campfires = true } = {}) {   // AUDIT REST II H8: `campfires` - the counter's shelf alone
  const n = (min, max) => min + Math.floor(rolls() * (max - min + 1));
  const out = [];
  out.push(createSurvivalItem(TEMPLATE.Rations, { stackCount: n(2, 5) }));
  for (let i = n(1, 3); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Bread));
  for (let i = n(1, 3); i > 0; i--) out.push(createSurvivalItem(rolls() < 0.5 ? TEMPLATE.Apple : TEMPLATE.Orange));
  for (let i = n(1, 2); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Waterskin, { water: 0 }));
  const fires = n(2, 4);   // AUDIT REST II H8: drawn on every shelf, so each shelf's later draws stay its own; stood on one
  if (campfires) for (let i = fires; i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Campfire));   // REST2: two to four, the rest's own tool online
  if (quality >= 5 || dice100(30, rolls())) out.push(createSurvivalItem(TEMPLATE.CampingEquipment));
  if (quality >= 8 || dice100(20, rolls())) out.push(createSurvivalItem(TEMPLATE.Skillet));
  return out.filter(Boolean);
}

/** The road's clothes the mod's start hands a new character (ItemEnums MensClothing / WomensClothing): Shoes, and a
 *  Formal cloak. */
const START_SHOES = Object.freeze({ male: 147, female: 186 });
const START_CLOAK = Object.freeze({ male: 155, female: 192 });
/** CreateMensClothing / CreateWomensClothing(item, race) as the mod calls them - the default dye (Blue) and the
 *  variant it is handed - minted as the kit mints its clothes (setItemFields, mintCondition), then worn to a quarter of
 *  its condition (`currentCondition /= 4`, C# integer division). */
function wornStartClothing(female, templateIndex, variant) {
  const item = mintCondition(setItemFields({ group: female ? 'WomensClothing' : 'MensClothing', templateIndex, variant, dye: DYE_COLORS.Blue }));
  item.currentCondition = Math.trunc(item.currentCondition / 4);
  return item;
}

/** A new character sets out with the mod's own start (ClimateCalories.cs OnStartGame, then NewCharEffects): two
 *  sacks of rations and a full skin; a Formal cloak drawn hood up and a pair of Shoes, of the character's own
 *  wardrobe, each at a quarter of its condition and in the pack, not worn; worn camping gear (half its uses gone) -
 *  and the port's Campfire. AUDIT C&C I7: the shoes and the cloak were left out of "the mod's own start". The mod's
 *  other arm, the shipwreck's (a start in Privateer's Hold: the shoes alone, the gear at three uses, soaked through
 *  and told to dry at the campfire), is not taken: this kit is minted at chargen, which is not told where the
 *  character will stand - the host picks the start (world.js, StartInDungeon on the start cell) while the wizard
 *  runs - so every new character takes the mod's ordinary arm. */
export function startingProvisions(entity = null) {
  const female = entity?.gender === 'female';
  return [
    createSurvivalItem(TEMPLATE.Rations, { stackCount: 2 }),
    createSurvivalItem(TEMPLATE.Waterskin),
    wornStartClothing(female, female ? START_CLOAK.female : START_CLOAK.male, 1),   // cloak.CurrentVariant = 1: its hood up (temperature.js HOODED_CLOAK_VARIANTS)
    wornStartClothing(female, female ? START_SHOES.female : START_SHOES.male, 0),   // Range(0, variants): the Shoes have none, so 0
    createSurvivalItem(TEMPLATE.CampingEquipment, { condition: Math.trunc(CAMPING_USES / 2) }),
    createSurvivalItem(TEMPLATE.Campfire),   // REST2: a full Campfire - the rest's tool, not two lights of a kit
  ];
}

/** REST2 (bible/06-Systems/Rest-Arc.md section 3): ONLINE THE CAMPFIRE IS THE REST'S, NOT THE ARC'S. A rest online is
 *  an act at a fire or a bed (systems/rest/restAct.js), so with the arc Off a General Store still stocks two to four, and a
 *  new character still sets out with one. */
export function campfireStock(rolls = Math.random, lo = 2, hi = 4) {   // AUDIT REST: a Pawn Shop's 0-2 (Rest-Arc.md section 3)
  const out = [];
  for (let i = lo + Math.floor(rolls() * (hi - lo + 1)); i > 0; i--) out.push(createSurvivalItem(TEMPLATE.Campfire));
  return out.filter(Boolean);
}
export const startingCampfire = () => createSurvivalItem(TEMPLATE.Campfire);
/** ENDLESS PROVISIONS (2026-10-04, Mac: "campfires should be unlimited, rations should be available in stores where it
 *  makes sense and unlimited as well"; "i can use and find all those without climates and calories"): a General
 *  Store's and a Pawn Shop's counter shelf always has a Campfire Kit and a full stack of Rations, Climates & Calories
 *  on or off - this tops a shelf up to one fresh kit and ENDLESS_RATIONS_STACK rations and answers the list. A kit is
 *  not stackable (its uses are its condition): a FRESH one is the shelf's, a worn one sold back is just a used kit. */
export const ENDLESS_RATIONS_STACK = 99;
export function ensureEndlessProvisions(items) {
  if (!Array.isArray(items)) return items;
  const fresh = (i) => i?.templateIndex === TEMPLATE.Campfire && isSurvivalItem(i) && (i.currentCondition ?? CAMPFIRE_USES) >= (i.maxCondition ?? CAMPFIRE_USES);
  if (!items.some(fresh)) items.push(createSurvivalItem(TEMPLATE.Campfire));
  const rations = items.find((i) => i?.templateIndex === TEMPLATE.Rations && isSurvivalItem(i));
  if (!rations) items.push(createSurvivalItem(TEMPLATE.Rations, { stackCount: ENDLESS_RATIONS_STACK }));
  else if ((rations.stackCount ?? 1) < ENDLESS_RATIONS_STACK) rations.stackCount = ENDLESS_RATIONS_STACK;
  return items;
}

export { TEMPLATE, FOOD, foodOf, foodSatiety, isFood, isWaterskin, waterIn, NEED, dressFood, VENDOR_ICON_FILES };   // AUDIT C&C I5: the dress law and its icons are food.js's now

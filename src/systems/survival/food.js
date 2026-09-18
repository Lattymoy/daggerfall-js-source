// SURV1 - FOOD AND WATER: what a meal is worth, how it spoils, and the
// eating law. An original design after Climates & Calories (the IL,
// Systems-Arc SURV): a food's worth is MINUTES OF SATIETY - an apple
// holds you an hour, a cooked meal four - and a food spoils by STAGE on
// a heat-driven day count, halving its worth each stage until it cannot
// be forced down. The template indices are the mod's own (530-540, an
// unused range above DFU's 288) so a save that carried them elsewhere
// would read here; 541 is the port's own campfire.
// No combat or disease import: both sit on the formulas -> equip cycle
// and equip.js mints the starting kit through items.js -> here. The
// luck roll is Dice100's own line and the disease ids are DFU's
// (diseases.js DISEASES: StomachRot 3, SwampRot 6, YellowFever 2 -
// pinned in the test); the infliction is handed in by the caller.
const dice100 = (chance, roll01) => Math.floor(roll01 * 100) < chance;
export const DISEASE_STOMACH_ROT = 3, DISEASE_SWAMP_ROT = 6, DISEASE_YELLOW_FEVER = 2;

export const TEMPLATE = Object.freeze({
  CampingEquipment: 530, Rations: 531, Apple: 532, Orange: 533, Bread: 534, RawFish: 535, CookedFish: 536,
  Meat: 537, RawMeat: 538, Waterskin: 539, Skillet: 540, Campfire: 541,
});
export const SURVIVAL_GROUP = 'UselessItems2';   // the port's home for its own consumables (the torch's group)

/** satiety: minutes a meal holds you. keeps: the rot roll's ceiling - a
 *  day's roll of 1..100 plus half the days kept must beat it to spoil a
 *  stage, so bread lasts and raw fish does not. raw: eaten as is, it
 *  turns the stomach. thirst: what it takes off the thirst. */
export const FOOD = Object.freeze({
  [TEMPLATE.Rations]: Object.freeze({ name: 'Rations', satiety: 250, keeps: null, raw: false, thirst: 0, stack: true }),
  [TEMPLATE.Apple]: Object.freeze({ name: 'Apple', satiety: 60, keeps: 90, raw: false, thirst: 10, stale: 'Soft' }),
  [TEMPLATE.Orange]: Object.freeze({ name: 'Orange', satiety: 60, keeps: 90, raw: false, thirst: 10, stale: 'Soft' }),
  [TEMPLATE.Bread]: Object.freeze({ name: 'Bread', satiety: 180, keeps: 95, raw: false, thirst: 0, stale: 'Stale' }),
  [TEMPLATE.RawFish]: Object.freeze({ name: 'Raw Fish', satiety: 90, keeps: 50, raw: true, thirst: 0, stale: 'Smelly', cooks: TEMPLATE.CookedFish }),
  [TEMPLATE.CookedFish]: Object.freeze({ name: 'Cooked Fish', satiety: 200, keeps: 80, raw: false, thirst: 0, stale: 'Smelly' }),
  [TEMPLATE.Meat]: Object.freeze({ name: 'Meat', satiety: 240, keeps: 90, raw: false, thirst: 0, stale: 'Smelly' }),
  [TEMPLATE.RawMeat]: Object.freeze({ name: 'Raw Meat', satiety: 100, keeps: 60, raw: true, thirst: 0, stale: 'Smelly', cooks: TEMPLATE.Meat }),
});
export const FOOD_STAGE = Object.freeze({ Fresh: 0, Stale: 1, Mouldy: 2, Rotten: 3, Putrid: 4 });
export const STAGE_WORDS = Object.freeze(['', 'Stale', 'Mouldy', 'Rotten', 'Putrid']);
/** You can bank a meal this far ahead of hunger: a full stomach. */
export const FULL_AHEAD_MINUTES = 240;
/** A waterskin holds this much, and a drink is this much. */
export const WATERSKIN_CAPACITY_KG = 2.0;
export const DRINK_KG = 0.1;
/** A drink takes this off the thirst. */
export const DRINK_RELIEF = 40;

export const isFood = (item) => !!item && FOOD[item.templateIndex] != null && (item.group == null || item.group === SURVIVAL_GROUP);
export const foodOf = (item) => (item ? FOOD[item.templateIndex] ?? null : null);
export const foodStage = (item) => Math.min(FOOD_STAGE.Putrid, Math.max(0, item?.foodStage ?? 0));
/** The name with its stage: "Soft Apple", "Mouldy Bread", "Putrid Meat". */
export function foodName(item) {
  const f = foodOf(item);
  if (!f) return item?.name ?? '';
  const s = foodStage(item);
  if (s === 0) return f.name;
  const word = s === FOOD_STAGE.Stale ? (f.stale ?? 'Stale') : STAGE_WORDS[s];
  return `${word} ${f.name}`;
}
/** What the meal is worth at its stage. */
export const foodSatiety = (item) => Math.trunc((foodOf(item)?.satiety ?? 0) / (foodStage(item) + 1));

/** Spoil one stage. False when it was already putrid. */
export function rotOnce(item) {
  const f = foodOf(item);
  if (!f || f.keeps == null) return false;
  const s = foodStage(item);
  if (s >= FOOD_STAGE.Putrid) return false;
  item.foodStage = s + 1;
  item.value = 0;
  return true;
}

/** One day's rot roll on one item: 1..100 plus half the days kept must
 *  beat its keeping. A fresh apple (90) spoils on a 91+ the first day;
 *  raw fish (50) is even odds on day one. */
export function rotRoll(item, daysKept = 0, rolls = Math.random) {
  const f = foodOf(item);
  if (!f || f.keeps == null) return false;
  const roll = 1 + Math.floor(rolls() * 100) + Math.trunc(daysKept / 2);
  return roll > f.keeps ? rotOnce(item) : false;
}

/** A day's rot over every food in the collections handed in. Returns how
 *  many spoiled a stage. */
export function rotFoodDay(collections, rotDay = 0, rolls = Math.random) {
  let n = 0;
  // AUDIT SURV A: `rotDay` is the WORLD's rot-day counter; an item ages from the day it was first seen (stamped
  // here), not from the world's first day - a global count spoiled every food overnight past the third month
  for (const list of collections) for (const item of list ?? []) {
    if (!foodOf(item) || foodOf(item).keeps == null) continue;
    if (!Number.isFinite(item.rotDay)) item.rotDay = rotDay;
    if (rotRoll(item, Math.max(0, rotDay - item.rotDay), rolls)) n++;
  }
  return n;
}

/** The day counter: heat spoils food faster. rotMinutes accumulates
 *  minutes weighted by the natural temperature; each 720 is a day. */
export const ROT_DAY_MINUTES = 720;
export function rotWeight(natural) {
  if (natural <= -30) return 0;   // frozen keeps
  if (natural > 50) return 3;
  if (natural > 20) return 2;
  return 1;
}

/** Eating: the law. `hunger` is minutes since the last meal.
 *  - putrid food cannot be forced down;
 *  - you must be at least as hungry as the meal is worth (no eating a
 *    full stomach fuller), but a meal may be banked FULL_AHEAD_MINUTES
 *    past hunger;
 *  - raw and spoiled food turns the stomach on a failed luck roll:
 *    stale or raw risks the mild disease, mouldy and worse the foul ones.
 *  Returns { ok, reason, lastAte, thirstRelief, sick } and never touches
 *  the entity: the caller applies it. */
export function eatLaw(item, { lastAte, now, luck = 50, rolls = Math.random } = {}) {
  const f = foodOf(item);
  if (!f) return { ok: false, reason: 'not food' };
  const stage = foodStage(item);
  if (stage >= FOOD_STAGE.Putrid) return { ok: false, reason: 'putrid' };
  const satiety = foodSatiety(item);
  const hunger = now - (lastAte ?? now);
  if (hunger < satiety) return { ok: false, reason: 'not hungry' };
  let base = lastAte ?? now;
  if (hunger > satiety + FULL_AHEAD_MINUTES) base = now - FULL_AHEAD_MINUTES;
  const newLastAte = base + satiety;
  let sick = null;
  if (f.raw || stage > 0) {
    const lucky = dice100(luck, rolls());
    if (!lucky) sick = stage >= FOOD_STAGE.Mouldy ? 'foul' : 'mild';
  }
  return { ok: true, lastAte: newLastAte, satiety, thirstRelief: f.thirst, sick, feel: sick ? (sick === 'foul' ? 'disgusted' : 'nauseated') : 'invigorated' };
}

/** The diseases a bad meal risks: the mild one (stomach rot) and the
 *  foul list (the dungeon's own). */
export const MILD_MEAL_DISEASES = Object.freeze([DISEASE_STOMACH_ROT]);
export const FOUL_MEAL_DISEASES = Object.freeze([DISEASE_STOMACH_ROT, DISEASE_SWAMP_ROT, DISEASE_YELLOW_FEVER]);   // all curable; no plague from a meal

/** Infect for a bad meal through the disease law the caller hands in
 *  (diseases.js inflictDisease - a roll inside). */
export function sickenFromMeal(entity, sick, { inflict = null, rolls = Math.random, currentDay = 0, onContract = null } = {}) {
  if (!sick || typeof inflict !== 'function') return false;
  return inflict(entity, sick === 'foul' ? FOUL_MEAL_DISEASES : MILD_MEAL_DISEASES, { rolls, currentDay, onContract });
}

/** Waterskins: the water rides the item as `water` (kg). */
export const isWaterskin = (item) => !!item && item.templateIndex === TEMPLATE.Waterskin;
export const waterIn = (item) => Math.max(0, Math.min(WATERSKIN_CAPACITY_KG, item?.water ?? 0));
export const waterskinName = (item) => (waterIn(item) < DRINK_KG ? 'Empty Waterskin' : 'Waterskin');
/** The first skin with a drink in it. */
export const findDrink = (items) => (items ?? []).find((i) => isWaterskin(i) && waterIn(i) >= DRINK_KG) ?? null;
/** Drink from a skin: takes a drink out, says whether it is now empty. */
export function drinkFrom(skin) {
  const w = waterIn(skin);
  if (w < DRINK_KG) return { ok: false, reason: 'empty' };
  skin.water = Math.max(0, Math.round((w - DRINK_KG) * 100) / 100);
  return { ok: true, left: skin.water, empty: skin.water < DRINK_KG, low: skin.water < 0.3 };
}
/** Fill every skin from a source with `kg` of water to give (Infinity at
 *  a fountain). Returns the kg poured and how many skins were touched. */
export function refillSkins(items, kg = Infinity) {
  let poured = 0, filled = 0;
  for (const i of items ?? []) {
    if (!isWaterskin(i)) continue;
    const room = WATERSKIN_CAPACITY_KG - waterIn(i);
    if (room <= 0) continue;
    const give = Math.min(room, kg - poured);
    if (give <= 0) break;
    i.water = Math.round((waterIn(i) + give) * 100) / 100;
    poured += give; filled++;
  }
  return { poured, filled, skins: (items ?? []).filter(isWaterskin).length };
}

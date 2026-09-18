// SURV5 - THE TAVERN'S MENU, PURE: Climates & Calories' regional
// menus (read off the DLL: TavernWindow's static string tables, six
// region keys - n, ne, se, s, b, o - from regionMenuDay's switch over
// the region index with a climate fallback, three price tiers a key,
// a breakfast list, DoFood / Food_OnItemPicked / TavernFood, DoDrinks /
// Drinks_OnItemPicked / TavernDrink, Drunk, ShitFaced) rebuilt as the
// port's own tables, keyed by CLIMATE (the port's readily-known key;
// the mod's region switch is not recoverable whole from the IL, and
// the climate fallback it carries maps the same way).
//
// THE MEAL (TavernFood): half an hour passes; the meal's worth banks
// against the hunger marker - too full when the hunger is under the
// meal's worth ("You are too full to finish your meal. The rest goes
// to waste." - charged, the mod's own quirk kept), otherwise the
// marker moves by the worth, never more than four hours ahead.
// THE DRINK (TavernDrink): a quarter hour passes; a soft drink quenches
// the thirst, an ale adds ten to the drunk counter, a wine twenty, a
// spirit thirty-five; past half the endurance "You are getting
// drunk...", past the endurance you BLACK OUT (ShitFaced) - the host
// passes the night (the clock to six in the morning offline), the
// morning is a rough one (survival/rest.js), and the counter comes
// down to a hangover's worth. The counter sobers one a ten minutes
// (needs.js).
import { NEED } from './needs.js';

/** The mod's six keys, by the port's climate (temperature.js's indices 224-233). */
export const MENU_KEY_BY_CLIMATE = Object.freeze({
  224: 'b', 225: 's', 226: 's', 227: 'ne', 228: 'b', 229: 'se', 230: 'b', 231: 'ne', 232: 'n', 233: 'n',
});
export const menuKeyFor = (climateIndex) => MENU_KEY_BY_CLIMATE[climateIndex] ?? 'n';
/** The tier by the tavern's quality (1-20): the mod's three tables a key. */
export const menuTier = (quality) => (quality < 6 ? 'low' : quality < 13 ? 'mid' : 'high');
/** Breakfast is served from six to ten; at five the kitchen is not yet open. */
export const BREAKFAST_FROM = 6, BREAKFAST_UNTIL = 10, KITCHEN_CLOSED_HOUR = 5;
export const breakfastHours = (hour) => hour >= BREAKFAST_FROM && hour < BREAKFAST_UNTIL;
/** What a meal is worth, by its list (minutes of hunger paid). */
export const MEAL_WORTH = Object.freeze({ breakfast: 120, low: 120, mid: 200, high: 240 });
/** The drinks' kinds and what each does to the counter. */
export const DRINK_STRENGTH = Object.freeze({ soft: 0, ale: 10, wine: 20, spirit: 35 });
export const MEAL_MINUTES = 30, DRINK_MINUTES = 15;
/** A drink quenches this much thirst (a skin's drink is 40, food.js). */
export const DRINK_THIRST_RELIEF = 40;

const d = (name, price) => Object.freeze({ name, price });
export const FOOD_MENUS = Object.freeze({
  n: Object.freeze({
    breakfast: [d('Oatmeal with Berries', 5), d('Artisinal Pastries', 8), d('Royal Breakfast Plate', 10)],
    low: [d('Leftovers', 1), d('Gruel', 2), d('Bread and Cheese', 5)],
    mid: [d('Breton Pork Sausage', 7), d('Cheese Pork Schnitzel', 10), d('Hare in Garlic Sauce', 12), d('Highland Rabbit Stew', 15)],
    high: [d('Gorapple Cheesecake', 10), d('Apple Cobbler Supreme', 13), d('Peacock Pie', 15), d('Rabbit Gnocchi Ragu', 18), d('Salmon Steak Supreme', 22)],
  }),
  ne: Object.freeze({
    breakfast: [d('Baked Apples', 6), d('Mystery Sausage', 8), d('Grilled Hare', 10)],
    low: [d('Potato Porridge', 7), d('Orcish Bratwurst On Bun', 10)],
    mid: [d('Jerall Carrot Cake', 12), d('Bruma Jugged Rabbit', 15)],
    high: [d('Summerset Rainbow Pie', 10), d('Old Aldmeri Gruel', 13), d('Direnni Rabbit Bisque', 18), d('Lillandril Summer Sausage', 22), d('Pickled Fish Bowl', 25)],
  }),
  se: Object.freeze({
    breakfast: [d('Velothis Cabbage Soup', 6), d('Beetle-Cheese Poutine', 8), d('Eidar Radish Salad', 10)],
    low: [d('Cabbage Biscuits', 7), d('Potato Porridge', 10)],
    mid: [d('Dunmeri Jerked Horse Haunch', 12), d('Solstheim Elk and Scuttle', 15)],
    high: [d('Indoril Radish Tartlets', 10), d('Vvardenfell Ash Yam Loaf', 13), d('Kwama Egg Quiche', 15), d('Millet-Stuffed Pork Loin', 18), d('Akaviri Pork Fried Rice', 22)],
  }),
  s: Object.freeze({
    breakfast: [d('Cantaloupe Bread', 6), d('Fishy Stick', 8), d('Roasted Corn', 10)],
    low: [d('Beets With Goat Cheese', 7), d('Venison Pie', 10)],
    mid: [d('Antelope Stew', 12), d('Parmesan Eels in Watermelon', 15)],
    high: [d('Roast Anteloupe', 10), d('Melon-Chevre Salad', 13), d('Pork Fried Rice', 15), d('Chili Cheese Corn', 18), d('Supreme Jambalaya', 22)],
  }),
  b: Object.freeze({
    breakfast: [d('Banana Surprise', 6), d('Green Bananas With Garlic', 8), d('Banana Cornbread', 10)],
    low: [d('Banana Millet Muffin', 7), d('Baked Sole With Bananas', 10)],
    mid: [d('Chicken-and-Coconut Fried Rice', 12), d('Mistral Banana-Bunny Hash', 15)],
    high: [d("Clan Mother's Banana Pilaf", 10), d('Stuffed Banana Leaves', 13), d('Jungle Snake Curry', 15), d('Banana-Radish Vichyssoise', 18), d('Spicy Grilled Lizard', 22)],
  }),
});
export const DRINK_MENUS = Object.freeze({
  n: Object.freeze({
    low: [d('Goats Milk', 1), d('Spruce Tea', 2), d('Apple Cider', 2), d('Ale', 3), d('Moonshine', 4)],
    mid: [d('Cows Milk', 2), d('Herbal Tea', 4), d('Ale', 4), d('Bitter', 6), d('Mulled Wine', 8), d('Red Wine', 12), d('Rye Liquor', 14)],
    high: [d('Berry Juice', 3), d('Herbal Tea', 6), d('Mint Tea', 6), d('Ale', 9), d('Bitter', 12), d('Port', 18), d('Mulled Wine', 21), d('Red Wine', 24), d('Nereid Wine', 30)],
  }),
  se: Object.freeze({
    low: [d('Goats Milk', 1), d('Berry Juice', 2), d('Pear Cider', 2), d('Ale', 3), d('Morrowind Mazte', 4)],
    mid: [d('Fruit Juice', 2), d('Mint Tea', 4), d('Ale', 4), d('Weat Beer', 6), d('Bitter', 8), d('Acai Mazte', 12), d('Vvrdenfell Flin', 14)],
    high: [d('Fruit Juice', 3), d('Herbal Tea', 6), d('Mint Tea', 6), d('Golden Ale', 9), d('Stout', 12), d('Mulled Wine', 18), d('Port Wine', 21), d('Nereid Wine', 24), d('Cyrodiil Brandy', 30)],
  }),
  s: Object.freeze({
    low: [d('Camel Milk', 1), d('Coffee', 2), d('Beer', 2), d('Stout', 3), d('Rum', 4)],
    mid: [d('Fruit Juice', 2), d('Coffee', 4), d('Beer', 4), d('Stout', 6), d('Bitter', 8), d('Wine', 12), d('Rum', 14)],
    high: [d('Fruit Juice', 3), d('Coffee', 6), d('Chai Tea', 6), d('Weat Beer', 9), d('Beer', 12), d('Stout', 18), d('Bitter', 21), d('Wine', 24), d('Summerset Wine', 30)],
  }),
  ne: Object.freeze({
    low: [d('Goats Milk', 1), d('Berry Juice', 2), d('Ale', 2), d('Mead', 3), d('Orc Grog', 4)],
    mid: [d('Berry Juice', 2), d('Mint Tea', 4), d('Ale', 4), d('Mead', 6), d('Red Wine', 12), d('Pine Rye', 14), d('Mulled Wine', 18)],
    high: [d('Berry Juice', 3), d('Herbal Tea', 6), d('Mint Tea', 6), d('Ale', 9), d('Mead', 12), d('Stout', 18), d('Mulled Wine', 21), d('Red Wine', 24), d('Cyrodiil Brandy', 30)],
  }),
});
/** The bay drinks the south's. */
export const drinkMenuFor = (key) => DRINK_MENUS[key] ?? DRINK_MENUS.s;

/** A drink's kind by its name: milk, tea, juice and coffee are soft; wine and port are wine; the strong ones are spirits. */
export function drinkKind(name) {
  const n = String(name).toLowerCase();
  if (/milk|tea|juice|coffee/.test(n)) return 'soft';
  if (/wine|port/.test(n)) return 'wine';
  if (/moonshine|liquor|mazte|flin|brandy|rum|grog|rye/.test(n)) return 'spirit';
  return 'ale';
}

export const TAVERN_MENU_TEXT = Object.freeze({
  closed: 'Sorry, breakfast starts at dawn.',
  tooFull: 'You are too full to finish your meal. The rest goes to waste.',
  invigorated: 'You feel invigorated by the meal.',
  fortified: 'The drink fortifies you.',
  gettingDrunk: 'You are getting drunk...',
  veryDrunk: 'You are very drunk...',
  blackout: 'The room spins. You black out.',
  noGold: 'You do not have enough gold.',
  drinksHeader: '--- Drinks ---',
});

/**
 * The menu as the picker shows it: the food (breakfast in the morning,
 * the tier's list otherwise), a header, the drinks. `hour` 0-23.
 * Returns { rows: [{ text, kind: 'food'|'drink'|'header', name, price, worth, strength }], closed }.
 */
export function tavernMenu({ climateIndex = 232, quality = 5, hour = 12 } = {}) {
  const key = menuKeyFor(climateIndex), tier = menuTier(quality);
  const closed = hour === KITCHEN_CLOSED_HOUR;
  const list = breakfastHours(hour) ? 'breakfast' : tier;
  const rows = [];
  if (!closed) for (const f of FOOD_MENUS[key][list]) rows.push({ text: `${String(f.price).padStart(2)} gold   ${f.name}`, kind: 'food', name: f.name, price: f.price, worth: MEAL_WORTH[list] });
  rows.push({ text: TAVERN_MENU_TEXT.drinksHeader, kind: 'header', name: null, price: 0 });
  for (const k of drinkMenuFor(key)[tier]) rows.push({ text: `${String(k.price).padStart(2)} gold   ${k.name}`, kind: 'drink', name: k.name, price: k.price, strength: DRINK_STRENGTH[drinkKind(k.name)] });
  return { rows, closed, key, tier, list };
}

/** TavernFood's marker law: hunger under the worth is too full (charged); past worth + 240 the marker starts four hours back; the worth banks. */
export function tavernEat(s, now, worth) {
  const hunger = now - (s.lastAte ?? now);
  if (hunger < worth) return { ok: false, text: TAVERN_MENU_TEXT.tooFull, minutes: MEAL_MINUTES };
  if (hunger > worth + NEED.PECKISH_AT) s.lastAte = now - NEED.PECKISH_AT;
  s.lastAte += worth;
  for (const k of Object.keys(s.notes ?? {})) if (k.startsWith('hunger:')) delete s.notes[k];
  return { ok: true, text: TAVERN_MENU_TEXT.invigorated, minutes: MEAL_MINUTES };
}
/** TavernDrink: the thirst quenched, the counter up by the strength; the word by the endurance bands; past it, the blackout. */
export function tavernDrink(s, strength, { endurance = 50 } = {}) {
  s.thirst = Math.max(0, (s.thirst ?? 0) - DRINK_THIRST_RELIEF);
  for (const k of Object.keys(s.notes ?? {})) if (k.startsWith('thirst:')) delete s.notes[k];
  s.drunk = (s.drunk ?? 0) + (strength | 0);
  if (s.drunk > endurance) return { text: TAVERN_MENU_TEXT.blackout, blackout: true, minutes: DRINK_MINUTES };
  if (s.drunk > endurance / 2) return { text: s.drunk > endurance - 10 ? TAVERN_MENU_TEXT.veryDrunk : TAVERN_MENU_TEXT.gettingDrunk, blackout: false, minutes: DRINK_MINUTES };
  return { text: TAVERN_MENU_TEXT.fortified, blackout: false, minutes: DRINK_MINUTES };
}
/** ShitFaced's morning: the counter down to a hangover's worth, the night passed to six (the host moves the clock offline). */
export const BLACKOUT_WAKE_HOUR = 6;
export function blackout(s, now, { endurance = 50 } = {}) {
  s.drunk = Math.trunc(endurance / 4);
  const dayStart = now - (now % 1440);
  const wake = dayStart + BLACKOUT_WAKE_HOUR * 60 + (now % 1440 >= BLACKOUT_WAKE_HOUR * 60 ? 1440 : 0);
  return { minutes: wake - now };
}

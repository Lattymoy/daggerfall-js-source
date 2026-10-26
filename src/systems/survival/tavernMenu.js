// SURV5 - THE TAVERN'S MENU, PURE: Climates & Calories' regional
// menus, the meal, the drink and the blackout. AUDIT C&C I8
// (2026-10-12): THE MOD'S OWN STRUCTURE, from its source (TavernWindow.cs
// - the mod's repository is public, every revision to 1.7.0; SURV5 had
// read 1.7.1's IL and sorted its dishes into a structure the mod does
// not have, keyed by climate, a breakfast list a key): regionMenuDay's
// switch over the REGION first and its own climate fallback after;
// DoFood's lists - breakfast by the tavern's tier alone, the day's by the
// key at the tier; DoDrinks' lists; the tiers at quality under 5 and
// under 13; TavernFood's worth, 240 minutes for every meal; and
// Drinks_OnItemPicked's alcohol by the row's place in its list, with its
// free drinks on Harvest's End and New Life. Kept on top, the port's own:
// the one picker (TVRN00I0 has four buttons and no room for the mod's
// Drinks), the house's refusals (SURV-TIERS), the water (INN-WATER), the
// online half (ESSENTIALS-HALF), and each row's price the menu's own word.
//
// THE MEAL (TavernFood): the half hour passes FIRST and the meal's worth
// banks against the hunger at its end (AUDIT C&C I3) - too full when that
// hunger is under the worth ("You are too full to finish your meal. The
// rest goes to waste." - charged, the mod's own quirk kept, and the eater
// leaves fed), otherwise the marker moves by the worth, never more than
// four hours ahead.
// THE DRINK (TavernDrink): a quarter hour passes; every drink quenches
// the thirst whole (TAVERN-DRINK, below) and adds its alcohol to the
// drunk counter; past half the endurance "You are getting drunk...",
// past the endurance you BLACK OUT (ShitFaced) - the host passes the
// night to the sky's six (AUDIT C&C I4), the morning is a rough one
// (survival/rest.js), and the counter comes down to a hangover's worth;
// under half, a drink with alcohol fortifies and a soft one refreshes
// (AUDIT C&C I6). The counter sobers one a ten minutes (needs.js).
//
// SURV-TIERS (2026-09-23): the blackout is the tier's (`blackout`,
// survival/difficulty.js - Hard's alone). A tier without it never takes
// the night: the barkeep will not pour the drink that would carry the
// counter past the endurance (`tavernPour`), so a Casual evening ends
// very drunk at worst, and a soft drink always pours. AUDIT SURV-TIERS:
// and the wasted meal is the tier's too (`wastedMeal`) - a tier without
// it will not sell a meal to a stomach too full for it. Both are asked
// in one place, `tavernOrder`, after the gold and BEFORE the coin
// changes hands, so a refusal never costs a coin or a minute.
//
// FIELD BUGS 2026-09-30 (INN-WATER): and the house fills a skin - one
// row under the drinks header, the fountain's own law at the price of
// the list's cheapest soft drink (`innWaterPrice`, `tavernWater`),
// refused in `tavernOrder` with the rest.
import { NEED, heartyMeal } from './needs.js';   // HEARTY-MEAL: a tavern meal's Well Fed hold
import { HARD_RULES } from './difficulty.js';
import { isWaterskin, waterIn, WATERSKIN_CAPACITY_KG } from './food.js';
import { drinkAtSource } from './items.js';   // INN-WATER: the fountain's own law, filled at the bar
import { CLIMATES, REGION_NAMES } from '../../formats/mapsFile.js';   // MENU-CLIMATE: the menus keyed by the enum's names; AUDIT C&C I8: and the regions by theirs
import { essentialPrice } from '../shopStock.js';   // ESSENTIALS-HALF: online, the menu costs half
import { getHolidayId, HOLIDAYS } from '../holidays.js';   // AUDIT C&C I8: Drinks_OnItemPicked's holidays, GetHolidayId's
import { maxFatigue, FATIGUE_MULTIPLIER } from '../statMods.js';   // AUDIT C&C I6: the drink's fatigue, in the pool's own units

/** AUDIT C&C I8: regionMenuDay's FIRST switch, over PlayerGPS.CurrentRegionIndex - the mod's own six keys by REGION
 *  ("0 = Balfiera, 1 = North, 2 = NorthEast, 3 = South, 4 = SouthEast, 5 = Orisium and Wrothgarian", its comment), read
 *  by the regions' names (REGION_NAMES - MENU-CLIMATE's lesson: never by numbers). A region it names none of is the
 *  climate's to key. SURV5 keyed every menu by the climate alone (the switch was not recoverable from the IL). */
const REGION_MENU = Object.freeze({
  n: ['Anticlere', 'Betony', 'Bhoriane', 'Daenia', 'Daggerfall', 'Dwynnen', 'Glenpoint', 'Glenumbra Moors', 'Ilessan Hills', 'Kambria', 'Northmoor', 'Phrygias', 'Shalgora', 'Tulune', 'Urvaius', 'Ykalon'],
  ne: ['Alcaire', 'Gavaudon', 'Koegria', 'Menevia', 'Wayrest'],
  se: ['Kozanset', 'Lainlyn', 'Mournoth', 'Satakalaam', 'Totambu'],
  s: ['Abibon-Gora', "Alik'r Desert", 'Antiphyllos', 'Ayasofya', 'Bergama', 'Cybiades', "Dak'fron", 'Dragontail Mountains', 'Ephesus', 'Kairou', 'Myrkwasa', 'Pothago', 'Santaki', 'Sentinel', 'Tigonus'],
  b: ['Isle of Balfiera'],
  o: ['Orsinium Area', 'Wrothgarian Mountains'],
});
export const MENU_KEY_BY_REGION = Object.freeze(Object.fromEntries(Object.entries(REGION_MENU).flatMap(([key, names]) => names.map((n) => [REGION_NAMES.indexOf(n), key]))));
/** regionMenuDay's SECOND switch, over PlayerGPS.CurrentClimateIndex where the region names none.
 *  FIELD BUGS 2026-09-30 (MENU-CLIMATE; the #bug-reports "Climates & Calories Bugs" thread's Sentinel inn): KEYED BY
 *  THE CLIMATES ENUM'S NAMES, NOT BY NUMBERS - SURV5's table was written as 224 to 233 over climates that run 223 to
 *  232, and every climate served the menu of the one before it. AUDIT C&C I8: and it is the mod's own switch now, not
 *  the port's - the deserts and the subtropics eat the South's, the rainforest and the swamp the SouthEast's, the woods
 *  and the mountains the North's, and the Ocean, which it names not, its default (the port's had sent the Ocean, the
 *  rainforest and the subtropics to Balfiera's key and the mountains to the NorthEast's). */
export const MENU_KEY_BY_CLIMATE = Object.freeze({
  [CLIMATES.Desert2]: 's', [CLIMATES.Desert]: 's', [CLIMATES.Subtropical]: 's', [CLIMATES.Rainforest]: 'se', [CLIMATES.Swamp]: 'se',
  [CLIMATES.Woodlands]: 'n', [CLIMATES.HauntedWoodlands]: 'n', [CLIMATES.MountainWoods]: 'n', [CLIMATES.Mountain]: 'n',
});
export const menuKeyFor = (climateIndex) => MENU_KEY_BY_CLIMATE[climateIndex] ?? 'n';
/** AUDIT C&C I8: regionMenuDay - the region's key, else the climate's. */
export const regionMenuDay = (regionIndex, climateIndex) => MENU_KEY_BY_REGION[regionIndex] ?? menuKeyFor(climateIndex);
/** The tier by the tavern's quality (1-20), DoFood's and Drinks_OnItemPicked's: under 5 low, under 13 mid, else high.
 *  AUDIT C&C I8: it was under 6 - a quality-5 tavern served the low lists the mod serves only under 5. */
export const menuTier = (quality) => (quality < 5 ? 'low' : quality < 13 ? 'mid' : 'high');
/** Breakfast is served from six to ten; at five the kitchen is not yet open. */
/** The mod's DoFood (read off the DLL, AUDIT SURV D): breakfast from six to ten INCLUSIVE; before six no food -
 *  at five "breakfast starts at dawn", earlier "the kitchen is closed for the night" - and the drinks pour all night. */
export const BREAKFAST_FROM = 6, BREAKFAST_UNTIL = 10, KITCHEN_CLOSED_HOUR = 5;
export const breakfastHours = (hour) => hour >= BREAKFAST_FROM && hour <= BREAKFAST_UNTIL;
export const kitchenClosed = (hour) => hour < BREAKFAST_FROM;
/** What a meal is worth (minutes of hunger paid): TavernFood's `Mathf.Min(calories[index] * 10, 240)` over calories
 *  of 80 to 240 - every meal the mod serves, breakfast included, is worth 240. AUDIT C&C I8: the port's 120, 200 and
 *  240 by list were its own. */
export const MEAL_WORTH = 240;
export const MEAL_MINUTES = 30, DRINK_MINUTES = 15;

const d = (name, price) => Object.freeze({ name, price });
const list = (...dishes) => Object.freeze(dishes);
/** AUDIT C&C I8: the mod's dish lists, each by its own name in TavernWindow.cs. A row's price is the menu's own word,
 *  as it always was in the port: the mod charges two rows otherwise - its breakfast price is the key's day list's at
 *  the same place less five, so Balfiera's high Royal Breakfast Plate, written 10, is charged 20 (balHigh's prices
 *  run 10, 13, 25); and the Orcs' mid Mulled Wine, written 18, is charged drinkPrices' 8. */
export const TAVERN_DISHES = Object.freeze({
  breakLow: list(d('Leftovers', 1)),
  breakMid: list(d('Gruel', 2), d('Bread and Cheese', 5)),
  breakHigh: list(d('Oatmeal with Berries', 5), d('Artisinal Pastries', 8), d('Royal Breakfast Plate', 10)),
  nLow: list(d('Baked Apples', 6), d('Mystery Sausage', 8), d('Grilled Hare', 10)),
  nMid: list(d('Breton Pork Sausage', 7), d('Cheese Pork Schnitzel', 10), d('Hare in Garlic Sauce', 12), d('Highland Rabbit Stew', 15)),
  nHigh: list(d('Gorapple Cheesecake', 10), d('Apple Cobbler Supreme', 13), d('Peacock Pie', 15), d('Rabbit Gnocchi Ragu', 18), d('Salmon Steak Supreme', 22)),
  neLow: list(d('Velothis Cabbage Soup', 6), d('Beetle-Cheese Poutine', 8), d('Eidar Radish Salad', 10)),
  neMid: list(d('Cabbage Biscuits', 7), d('Potato Porridge', 10), d('Dunmeri Jerked Horse Haunch', 12), d('Solstheim Elk and Scuttle', 15)),
  neHigh: list(d('Indoril Radish Tartlets', 10), d('Vvardenfell Ash Yam Loaf', 13), d('Kwama Egg Quiche', 15), d('Millet-Stuffed Pork Loin', 18), d('Akaviri Pork Fried Rice', 22)),
  sLow: list(d('Cantaloupe Bread', 6), d('Fishy Stick', 8), d('Roasted Corn', 10)),
  sMid: list(d('Beets With Goat Cheese', 7), d('Venison Pie', 10), d('Antelope Stew', 12), d('Parmesan Eels in Watermelon', 15)),
  sHigh: list(d('Roast Anteloupe', 10), d('Melon-Chevre Salad', 13), d('Pork Fried Rice', 15), d('Chili Cheese Corn', 18), d('Supreme Jambalaya', 22)),
  seLow: list(d('Banana Surprise', 6), d('Green Bananas With Garlic', 8), d('Banana Cornbread', 10)),
  seMid: list(d('Banana Millet Muffin', 7), d('Baked Sole With Bananas', 10), d('Chicken-and-Coconut Fried Rice', 12), d('Mistral Banana-Bunny Hash', 15)),
  seHigh: list(d("Clan Mother's Banana Pilaf", 10), d('Stuffed Banana Leaves', 13), d('Jungle Snake Curry', 15), d('Banana-Radish Vichyssoise', 18), d('Spicy Grilled Lizard', 22)),
  balHigh: list(d('Summerset Rainbow Pie', 10), d('Old Aldmeri Gruel', 13), d('Pickled Fish Bowl', 25), d('Direnni Rabbit Bisque', 18), d('Lillandril Summer Sausage', 22)),
  woMid: list(d('Potato Porridge', 7), d('Orcish Bratwurst On Bun', 10), d('Jerall Carrot Cake', 12), d('Bruma Jugged Rabbit', 15)),
});
/** AUDIT C&C I8: DoFood's switch - the list each key serves at each tier (Balfiera and the Orcs eat the NorthEast's,
 *  but for Balfiera's high table and the Orcs' mid one) - and its breakfast, six to ten, by the tier alone. */
export const FOOD_MENUS = Object.freeze({
  low: Object.freeze({ n: 'nLow', ne: 'neLow', se: 'seLow', s: 'sLow', b: 'neLow', o: 'neLow' }),
  mid: Object.freeze({ n: 'nMid', ne: 'neMid', se: 'seMid', s: 'sMid', b: 'neMid', o: 'woMid' }),
  high: Object.freeze({ n: 'nHigh', ne: 'neHigh', se: 'seHigh', s: 'sHigh', b: 'balHigh', o: 'neHigh' }),
});
export const BREAKFAST_MENUS = Object.freeze({ low: 'breakLow', mid: 'breakMid', high: 'breakHigh' });
/** AUDIT C&C I8: the mod's drink lists, each by its own name (its woHighDrinks, which no key pours, is not carried). */
export const TAVERN_DRINKS = Object.freeze({
  nLow: list(d('Goats Milk', 1), d('Spruce Tea', 2), d('Apple Cider', 2), d('Ale', 3), d('Moonshine', 4)),
  nMid: list(d('Cows Milk', 2), d('Herbal Tea', 4), d('Ale', 4), d('Bitter', 6), d('Mulled Wine', 8), d('Red Wine', 12), d('Rye Liquor', 14)),
  nHigh: list(d('Berry Juice', 3), d('Herbal Tea', 6), d('Mint Tea', 6), d('Ale', 9), d('Bitter', 12), d('Port', 18), d('Mulled Wine', 21), d('Red Wine', 24), d('Nereid Wine', 30)),
  neLow: list(d('Goats Milk', 1), d('Berry Juice', 2), d('Pear Cider', 2), d('Ale', 3), d('Morrowind Mazte', 4)),
  neMid: list(d('Fruit Juice', 2), d('Mint Tea', 4), d('Ale', 4), d('Weat Beer', 6), d('Bitter', 8), d('Acai Mazte', 12), d('Vvrdenfell Flin', 14)),
  neHigh: list(d('Fruit Juice', 3), d('Herbal Tea', 6), d('Mint Tea', 6), d('Golden Ale', 9), d('Stout', 12), d('Mulled Wine', 18), d('Port Wine', 21), d('Nereid Wine', 24), d('Cyrodiil Brandy', 30)),
  sLow: list(d('Camel Milk', 1), d('Coffee', 2), d('Beer', 2), d('Stout', 3), d('Rum', 4)),
  sMid: list(d('Fruit Juice', 2), d('Coffee', 4), d('Beer', 4), d('Stout', 6), d('Bitter', 8), d('Wine', 12), d('Rum', 14)),
  sHigh: list(d('Fruit Juice', 3), d('Coffee', 6), d('Chai Tea', 6), d('Weat Beer', 9), d('Beer', 12), d('Stout', 18), d('Bitter', 21), d('Wine', 24), d('Summerset Wine', 30)),
  woLow: list(d('Goats Milk', 1), d('Berry Juice', 2), d('Ale', 2), d('Mead', 3), d('Orc Grog', 4)),
  woMid: list(d('Berry Juice', 2), d('Mint Tea', 4), d('Ale', 4), d('Mead', 6), d('Mulled Wine', 18), d('Red Wine', 12), d('Pine Rye', 14)),
});
/** AUDIT C&C I8: DoDrinks' switch - the SouthEast drinks the South's, Balfiera the NorthEast's, the Orcs their own
 *  but at a high table the NorthEast's (SURV5 had poured Morrowind's at the swamp and the Orcs' in the mountains). */
export const DRINK_MENUS = Object.freeze({
  low: Object.freeze({ n: 'nLow', ne: 'neLow', se: 'sLow', s: 'sLow', b: 'neLow', o: 'woLow' }),
  mid: Object.freeze({ n: 'nMid', ne: 'neMid', se: 'sMid', s: 'sMid', b: 'neMid', o: 'woMid' }),
  high: Object.freeze({ n: 'nHigh', ne: 'neHigh', se: 'sHigh', s: 'sHigh', b: 'neHigh', o: 'neHigh' }),
});
/** AUDIT C&C I8: Drinks_OnItemPicked's alcohol, by the row's place in its tier's list (alcoLow, alcoMid, alcoHigh) -
 *  what it adds to the drunk counter, and what it fortifies (I6). Nought is a soft drink. SURV5 had guessed it from the
 *  name (an ale ten, a wine twenty, a spirit thirty-five). */
export const DRINK_ALCOHOL = Object.freeze({
  low: list(0, 0, 10, 12, 25),
  mid: list(0, 0, 10, 12, 15, 20, 30),
  high: list(0, 0, 0, 10, 12, 15, 20, 20, 40),
});
/** AUDIT C&C I8: Drinks_OnItemPicked's holidays - "both say they offer free drinks", the mod's note - on Harvest's End
 *  and New Life a row from the sixth on that costs over ten gold is free: a mid table's last two, a high one's last
 *  four, a low one's none. */
export const FREE_DRINK_HOLIDAYS = Object.freeze([HOLIDAYS.Harvest_End, HOLIDAYS.New_Life]);
export const FREE_DRINK_FROM = 5, FREE_DRINK_OVER = 10;

export const TAVERN_MENU_TEXT = Object.freeze({
  closed: 'Sorry, breakfast starts at dawn.',
  closedNight: 'Sorry, the kitchen is closed for the night.',
  tooFull: 'You are too full to finish your meal. The rest goes to waste.',
  invigorated: 'You feel invigorated by the meal. You are well fed.',   // HEARTY-MEAL: and its hold, said
  fortified: 'The drink fortifies you.',
  refreshed: 'The drink refreshes you.',   // AUDIT C&C I6: TavernDrink's soft drink - "fortifies" was said over the milk
  gettingDrunk: 'You are getting drunk...',
  veryDrunk: 'You are very drunk...',
  blackout: 'The room spins. You black out.',
  // AUDIT SURV-TIERS (the third pass): and the morning after, said - the window had gone from the blackout's line to
  // six o'clock and a Stiff chip with no word for the waking (Hard alone: the other tiers' barkeep never pours it)
  woke: 'You wake on the tavern floor at dawn, stiff and sore.',
  wokeNoDawn: 'You wake on the tavern floor, stiff and sore.',   // AUDIT C&C I4: under a sky that is not at dawn (online, it stood)
  // SURV-TIERS: the tier without the blackout. AUDIT SURV-TIERS: the
  // line said "another", and a first spirit on a low endurance is
  // refused too - it names the reason instead, which also tells the
  // player a lighter drink may still pour.
  cutOff: 'The barkeep shakes their head: that one would put you on the floor.',
  fullForMeal: 'You are too full to eat a meal yet.',   // AUDIT SURV-TIERS: the tier without the wasted meal
  noGold: 'You do not have enough gold.',
  drinksHeader: '--- Drinks ---',
  // INN-WATER: the row, and the house's two refusals before the coin
  water: 'Fill your waterskins',
  noSkin: 'You carry no waterskin.',
  skinsFull: 'Your waterskins are full.',
});

/**
 * FIELD BUGS 2026-09-30 (INN-WATER; #bug-reports, "Climates & Calories
 * Bugs": "Waterskins should be refillable at an inn/tavern. ... since
 * water is rare in some regions like Sentinel, but inns are plentiful,
 * this should be added"): THE HOUSE FILLS A SKIN. A skin filled only at
 * a fountain, a well or a trough, and a desert town may stand none in
 * reach while every street has an inn. Every menu carries a row now,
 * under the drinks header, priced at the list's cheapest soft drink -
 * water costs what the milk or the tea costs - and at its cheapest drink
 * when it pours no soft one. A declared departure (Port-Ledger A): the
 * mod's menus sell no water. AUDIT C&C I8: a soft drink is one with no
 * alcohol (`strength`, the mod's own), not a name the port guessed at.
 */
export function innWaterPrice(drinks) {
  const soft = drinks.filter((k) => !((k.strength | 0) > 0));
  return Math.min(...(soft.length ? soft : drinks).map((k) => k.price));
}

/**
 * The menu as the picker shows it: the food (breakfast in the morning,
 * the tier's list otherwise), a header, the drinks. `hour` 0-23.
 * AUDIT C&C I8: `regionIndex` is PlayerGPS.CurrentRegionIndex (-1 for
 * none, the climate's to key), and `minutes` the WORLD's classic minute -
 * the calendar Drinks_OnItemPicked's holidays read (none when absent).
 * Returns { rows: [{ text, kind: 'food'|'drink'|'header'|'water', name, price, worth, strength }], closed, closedText }.
 */
export function tavernMenu({ climateIndex = 232, regionIndex = -1, quality = 5, hour = 12, minutes = null, online = undefined } = {}) {
  // ESSENTIALS-HALF (2026-09-30, Discord: "cut the cost of most essential items by half"): online each row's gold is
  // the half it costs (shopStock.js essentialPrice) - the text and the price the window charges alike
  const cost = (p) => essentialPrice(p, { online });
  const key = regionMenuDay(regionIndex, climateIndex), tier = menuTier(quality);
  const closed = kitchenClosed(hour);
  const closedText = closed ? (hour === KITCHEN_CLOSED_HOUR ? TAVERN_MENU_TEXT.closed : TAVERN_MENU_TEXT.closedNight) : null;
  const list = breakfastHours(hour) ? BREAKFAST_MENUS[tier] : FOOD_MENUS[tier][key];
  const rows = [];
  if (!closed) for (const f of TAVERN_DISHES[list]) rows.push({ text: `${String(cost(f.price)).padStart(2)} gold   ${f.name}`, kind: 'food', name: f.name, price: cost(f.price), worth: MEAL_WORTH });
  rows.push({ text: TAVERN_MENU_TEXT.drinksHeader, kind: 'header', name: null, price: 0 });
  const drinks = TAVERN_DRINKS[DRINK_MENUS[tier][key]].map((k, i) => ({ ...k, strength: DRINK_ALCOHOL[tier][i] }));
  const water = innWaterPrice(drinks);   // INN-WATER: first under the header, the kitchen shut or open
  rows.push({ text: `${String(cost(water)).padStart(2)} gold   ${TAVERN_MENU_TEXT.water}`, kind: 'water', name: TAVERN_MENU_TEXT.water, price: cost(water) });   // ESSENTIALS-HALF: the water too
  const holiday = Number.isFinite(minutes) && FREE_DRINK_HOLIDAYS.includes(getHolidayId(minutes, regionIndex));   // AUDIT C&C I8: the player's region, as the mod asks
  for (const [i, k] of drinks.entries()) {
    const price = holiday && i >= FREE_DRINK_FROM && k.price > FREE_DRINK_OVER ? 0 : k.price;
    rows.push({ text: `${String(cost(price)).padStart(2)} gold   ${k.name}`, kind: 'drink', name: k.name, price: cost(price), strength: k.strength });
  }
  return { rows, closed, closedText, key, tier, list };
}

/** AUDIT C&C I3: the hunger a meal is eaten at - at its END, its half hour passed first, as TavernFood passes it
 *  (PassTime(1800) before it reads the clock). The meal and the kitchen's refusal (tavernOrder) ask this one moment. */
export const mealHunger = (s, now) => now + MEAL_MINUTES - (s?.lastAte ?? now + MEAL_MINUTES);
/** TavernFood's marker law, at the meal's end: hunger under the worth is too full - charged, and the rest goes to
 *  waste; past worth + 240 the marker starts four hours back; the worth banks.
 *  AUDIT C&C I3: the hunger was read BEFORE the half hour, and the too-full arm wrote nothing - a Hard meal ordered 239
 *  minutes after the last was charged, took its half hour, fed nothing and left the eater Peckish (269); the mod
 *  passes the half hour first, so it serves that meal whole, and its too-full arm writes the marker at its clock (the
 *  eater leaves fed). Both are the law now. The windows pass the half hour straight after the pick, so no marker
 *  stands past the clock once it returns. */
export function tavernEat(s, now, worth) {
  const end = now + MEAL_MINUTES, hunger = mealHunger(s, now);
  if (hunger < worth) { s.lastAte = end; return { ok: false, text: TAVERN_MENU_TEXT.tooFull, minutes: MEAL_MINUTES }; }
  if (hunger > worth + NEED.PECKISH_AT) s.lastAte = end - NEED.PECKISH_AT;
  s.lastAte += worth;
  heartyMeal(s, end);   // HEARTY-MEAL (needs.js): fed, quenched, and held so for a while - the meal served whole, never one wasted
  return { ok: true, text: TAVERN_MENU_TEXT.invigorated, minutes: MEAL_MINUTES };
}
/** SURV-TIERS: whether the barkeep pours at all - asked before the coin changes hands. A tier with the blackout
 *  (Hard) always pours: the blackout is its answer. One without (Casual) refuses the drink that would carry the
 *  counter past the endurance. A soft drink always pours. Never touches the record. */
export function tavernPour(s, strength, { endurance = 50, rules = HARD_RULES } = {}) {
  if ((rules ?? HARD_RULES).blackout || !((strength | 0) > 0)) return { ok: true };
  if ((s?.drunk ?? 0) + (strength | 0) > endurance) return { ok: false, text: TAVERN_MENU_TEXT.cutOff };
  return { ok: true };
}
/** AUDIT SURV-TIERS: whether the house serves this row at all - both windows ask it after the gold and BEFORE the
 *  coin changes hands. A drink is the pour's question (tavernPour). A meal on a stomach too full for it (the
 *  hunger under the meal's worth - tavernEat's own test) is Hard's to sell: TavernFood charges it, passes the half
 *  hour and wastes it, the mod's quirk kept (`wastedMeal`). A tier without the waste will not sell it. INN-WATER:
 *  the water is the skins' question (innWaterOrder), off `items`, the player's pack. Never touches the record.
 *  AUDIT C&C I3: the kitchen asks the meal's own moment, its end (mealHunger) - it refused at hunger 210 to 239 the
 *  meals the mod serves whole. */
export function tavernOrder(s, now, row, { endurance = 50, rules = HARD_RULES, items = null } = {}) {
  if (row?.kind === 'drink') return tavernPour(s, row.strength, { endurance, rules });
  if (row?.kind === 'water') return innWaterOrder(items);
  if (row?.kind === 'food' && !(rules ?? HARD_RULES).wastedMeal && mealHunger(s, now) < (row.worth ?? 0)) return { ok: false, text: TAVERN_MENU_TEXT.fullForMeal };
  return { ok: true };
}
/** INN-WATER: whether the barkeep has a skin to fill - asked in `tavernOrder` with the drink and the meal, so it is
 *  refused before the coin. `items` is the player's pack; a skin is full as food.js reads one (refillSkins: no room
 *  left under the capacity), and every skin full is nothing to fill. Every tier refuses alike. */
function innWaterOrder(items) {
  const skins = (items ?? []).filter(isWaterskin);
  if (!skins.length) return { ok: false, text: TAVERN_MENU_TEXT.noSkin };
  if (skins.every((i) => WATERSKIN_CAPACITY_KG - waterIn(i) <= 0)) return { ok: false, text: TAVERN_MENU_TEXT.skinsFull };
  return { ok: true };
}
/** INN-WATER: the fill is the fountain's own law (items.js drinkAtSource) - every skin the player carries filled, the
 *  thirst quenched, the fountain's own words - and, as at the fountain, no time passes. */
export function tavernWater(entity, now) {
  return { text: drinkAtSource(entity, now).text, minutes: 0 };
}
/** TavernDrink: the thirst quenched, the counter up by the strength; the word by the endurance bands; past it, the
 *  blackout - in a tier that has one (`rules.blackout`; Hard's when no rules).
 *  FIELD BUGS 2026-09-30 (TAVERN-DRINK; #bug-reports, "Climates & Calories Bugs": "Drinking beverages at an inn/tavern
 *  does not fill your hydration. It is supposed to, and food works properly, it's only beverages."): A TAVERN DRINK
 *  QUENCHES THE THIRST WHOLE, whatever its kind, as a meal fills the stomach whole (tavernEat). It took forty off a
 *  thirst that runs to a hundred and fifty, and its quarter hour climbed again while it was drunk: a desert inn's juice
 *  read 150, 127, 103, 80 and 57, four paid cups to leave the red. A Casual thirst loan (needs.js `borrowed`) is repaid
 *  when the thirst leaves red, so it stayed owed through three of them. The quarter hour the host passes after the pour
 *  is the minute law's first sight of the met thirst, and the loan comes back in the same pick. The drunk counter by
 *  the drink's alcohol and the quarter hour stand. A declared departure (Port-Ledger A): SURV5 restated TavernDrink as
 *  forty.
 *  AUDIT C&C I6: AND UNDER HALF THE ENDURANCE THE DRINK DOES WHAT IT SAYS. "The drink fortifies you." was said for
 *  every drink there, milk included, and nothing was fortified. TavernDrink's last two arms: a drink with alcohol
 *  fortifies - its alcohol in fatigue points and in magicka (IncreaseFatigue(alcohol, true), IncreaseMagicka(alcohol))
 *  - and a soft one "refreshes you", five fatigue. The result carries them (`fatigue`, `magicka`), and the windows
 *  give them to the body after the quarter hour (tavernRefresh). */
export const SOFT_DRINK_FATIGUE = 5;
export function tavernDrink(s, strength, { endurance = 50, rules = HARD_RULES } = {}) {
  s.thirst = 0;
  s.drunk = (s.drunk ?? 0) + (strength | 0);
  if (s.drunk > endurance && (rules ?? HARD_RULES).blackout) return { text: TAVERN_MENU_TEXT.blackout, blackout: true, minutes: DRINK_MINUTES };
  if (s.drunk > endurance / 2) return { text: s.drunk > endurance - 10 ? TAVERN_MENU_TEXT.veryDrunk : TAVERN_MENU_TEXT.gettingDrunk, blackout: false, minutes: DRINK_MINUTES };
  if ((strength | 0) > 0) return { text: TAVERN_MENU_TEXT.fortified, blackout: false, minutes: DRINK_MINUTES, fatigue: strength | 0, magicka: strength | 0 };
  return { text: TAVERN_MENU_TEXT.refreshed, blackout: false, minutes: DRINK_MINUTES, fatigue: SOFT_DRINK_FATIGUE, magicka: 0 };
}
/** AUDIT C&C I6: what a drink gives the body - its fatigue in points (IncreaseFatigue(n, true): FATIGUE_MULTIPLIER of
 *  the pool's own units a point) and its magicka, each up to its pool (DaggerfallEntity's own clamp, the hosts' restore
 *  sinks'). Both windows call it after the quarter hour, as TavernDrink passes the time first. */
export function tavernRefresh(entity, r) {
  if (r?.fatigue > 0) entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + r.fatigue * FATIGUE_MULTIPLIER);
  if (r?.magicka > 0) entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + r.magicka);
}
/** ShitFaced's morning: the counter down to a hangover's worth, and the night - the minutes to six.
 *  AUDIT C&C I4: SIX ON THE SKY. The night ran to six on the minute the windows handed, the CHARACTER's own clock
 *  online (LIVED1 split it from the world's): under a noon sky a blackout at their 05:30 passed half an hour, one at
 *  their 06:15 nearly a day and one at their 23:00 seven hours - each "at dawn". `sky` is the SKY's minute at the fall
 *  (the windows' worldNow, read where it stands after the drink; offline the one clock, the drink's quarter hour on
 *  it), and the night runs to its next six. The line is blackoutWaking's, under the sky the sleeper wakes to. */
export const BLACKOUT_WAKE_HOUR = 6;
export function blackout(s, sky, { endurance = 50 } = {}) {
  s.drunk = Math.trunc(endurance / 4);
  const minute = ((sky % 1440) + 1440) % 1440, wake = BLACKOUT_WAKE_HOUR * 60;
  return { minutes: wake - minute + (minute >= wake ? 1440 : 0) };
}
/** AUDIT C&C I4: the waking line, by the sky the sleeper wakes under - "at dawn" only when it is. Offline the night
 *  moves the one clock to six; online the world's sky stands while the character's clock runs (LIVED1), and they wake
 *  under whatever it reads. */
export const blackoutWaking = (sky) => (Math.trunc((((sky % 1440) + 1440) % 1440) / 60) === BLACKOUT_WAKE_HOUR ? TAVERN_MENU_TEXT.woke : TAVERN_MENU_TEXT.wokeNoDawn);

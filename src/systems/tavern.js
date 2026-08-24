// U39 - THE TAVERN LAW: DaggerfallTavernWindow's room rental and its
// food-and-drink menu (MIT, Daggerfall Workshop), plus
// FormulaHelper.CalculateRoomCost. The window half is ui/tavernWindow.js.
//
// The strings are Internal_Strings' own, recovered - the eleven menu
// lines carry their prices IN the text ("Ale (1 gold)"), which is why
// the price table beside them is a separate byte array in DFU and a
// separate table here: the words and the numbers are two facts, and
// only the numbers are arithmetic.
import { HOLIDAYS, getHolidayId } from './holidays.js';
import { calculateTradePrice } from './shopStock.js';
import { dayOfYear } from './gameDate.js';

/** The TEXT.RSC records the window speaks (:37-41). */
export const TOO_MANY_DAYS_ID = 16;
export const OFFER_PRICE_ID = 262;
export const HOW_MANY_ADDITIONAL_DAYS_ID = 5100;
export const HOW_MANY_DAYS_ID = 5102;
/** DFU declares `notEnoughGoldId = 454` a THIRD time here (:39), the
 *  same record DaggerfallTradeWindow and the guild services borrow.
 *  ONE DFU MEMBER, ONE EXPORT: the tavern re-exports the existing home
 *  rather than writing 454 down again, so a correction lands once. */
export { NOT_ENOUGH_GOLD_ID } from './guildServiceActions.js';

/** The recovered Internal_Strings lines. */
export const ROOM_FREE_FOR_KNIGHT = 'The room is free for a knight such as you.';
export const ROOM_FREE_HEARTS_DAY = "Room is free due to Heart's Day.";
export const YOU_ARE_NOT_HUNGRY = 'You are not hungry.';

/** tavernMenu (:43-49) and tavernFoodAndDrinkPrices (:50), in DFU's
 *  order - the price table is INDEXED by the picked row, so the two
 *  must stay aligned. */
export const TAVERN_MENU = Object.freeze([
  'Ale (1 gold)', 'Beer (1 gold)', 'Mead (2 gold)', 'Wine (3 gold)',
  'Bread (1 gold)', 'Broth (1 gold)', 'Cheese (2 gold)', 'Fowl (3 gold)',
  'Gruel (2 gold)', 'Pie (2 gold)', 'Stew (3 gold)',
]);
export const TAVERN_PRICES = Object.freeze([1, 1, 2, 3, 1, 1, 2, 3, 2, 2, 3]);

/** The rental ceiling (:188) - days ALREADY rented count toward it. */
export const MAX_RENTAL_DAYS = 350;
/** Heart's Day is day 46; a rental spanning it is one day cheaper. */
export const HEARTS_DAY = 46;
/** The nightly rate (:1869). */
export const ROOM_COST_PER_DAY = 7;
/** DoFoodAndDrink's hunger gate (:287) - four game hours. */
export const EAT_INTERVAL_MINUTES = 240;

/** CalculateRoomCost (:1858-1875). The Heart's Day arm is a SPAN test,
 *  not a "today is": a stay that STARTS on or before day 46 and RUNS
 *  PAST it loses one day's charge. A stay wholly after it pays full.
 *  Answers { cost, freeForHeartsDay } - DFU pops the free-room box
 *  from inside the formula, which a pure function cannot do. */
export function calculateRoomCost(daysToRent, date) {
  const doy = date?.dayOfYear ?? dayOfYear(date);
  const cost = (doy <= HEARTS_DAY && doy + daysToRent > HEARTS_DAY)
    ? ROOM_COST_PER_DAY * (daysToRent - 1)
    : ROOM_COST_PER_DAY * daysToRent;
  return { cost, freeForHeartsDay: cost === 0 };
}

/** The room's price at this inn (:200-201). NOT CalculateCost -
 *  DFU calls CalculateTradePrice(cost, quality, false), which reads
 *  the player's MERCANTILE and PERSONALITY, so a silver-tongued
 *  character sleeps cheaper. The first draft here reached for
 *  calculateCost (the item-shop formula) and would have charged every
 *  character the same. */
export const roomPrice = (daysToRent, date, quality, skills) =>
  calculateTradePrice(calculateRoomCost(daysToRent, date).cost, quality, skills, false);

/** PlayerEntity.GetRemainingHours (:268-275) - the `%dwr` macro's
 *  source, and the sweep's own test. A null room answers -1, which is
 *  DFU's own "no room" sentinel rather than 0. The CEILING is load
 *  bearing: a room with one minute left still reads as ONE hour, so
 *  the sweep below keeps it. */
export const roomRemainingHours = (room, nowMinutes) =>
  (room ? Math.ceil((room.expiryMinutes - nowMinutes) / 60) : -1);

/** RemoveExpiredRentedRooms (:257-266) - the sweep that runs before
 *  every rental so an expired room does not read as a renewal. DFU
 *  drops a room whose `GetRemainingHours < 1`; because that hour count
 *  is a CEILING, `< 1` is true exactly when no time at all is left, so
 *  the plain `expiry > now` here is the same predicate and not a
 *  loosening of it. */
export const removeExpiredRooms = (rooms, nowMinutes) =>
  rooms.filter((r) => roomRemainingHours(r, nowMinutes) >= 1);

/** GetRentedRoom (:158): this inn's room, by map AND building. */
export const findRentedRoom = (rooms, mapId, buildingKey) =>
  rooms.find((r) => r.mapId === mapId && r.buildingKey === buildingKey) ?? null;

/** The days a live rental still has to run (:180-185), floored at 0 -
 *  DFU clamps a negative rather than letting an expired room CREDIT
 *  days against the 350 ceiling. */
export function daysAlreadyRented(room, nowMinutes) {
  if (!room) return 0;
  const days = Math.trunc((room.expiryMinutes - nowMinutes) / (24 * 60));
  return days < 0 ? 0 : days;
}

/** InputMessageBox_OnGotUserInput (:172-207) as a decision. `free` is
 *  KnightlyOrder.FreeTavernRooms. Answers one of:
 *    { kind: 'ignore' }   - unparseable or < 1 day (:175-178)
 *    { kind: 'tooMany' }  - past the 350-day ceiling
 *    { kind: 'free' }     - the knight's room, rented outright
 *    { kind: 'offer', price, heartsDay } - the Yes/No price box
 *  The ORDER is DFU's and is load-bearing: the ceiling is tested
 *  BEFORE the knightly exemption, so even a free room cannot be
 *  booked past 350 days. */
export function rentalDecision(input, { room = null, nowMinutes = 0, date, quality = 0, free = false, skills = undefined } = {}) {
  const days = Number.parseInt(input, 10);
  if (!Number.isFinite(days) || days < 1) return { kind: 'ignore' };
  if (days + daysAlreadyRented(room, nowMinutes) > MAX_RENTAL_DAYS) return { kind: 'tooMany', days };
  if (free) return { kind: 'free', days };
  const { cost, freeForHeartsDay } = calculateRoomCost(days, date);
  return {
    kind: 'offer',
    days,
    price: calculateTradePrice(cost, quality, skills, false),
    heartsDay: freeForHeartsDay,
  };
}

/** RentRoom (:225-260): a FRESH rental mints a record with a random
 *  bed marker; a renewal only EXTENDS the expiry. The bed index is
 *  stored rather than a position because "building positions are not
 *  stable" (DFU's own comment). */
export function rentRoom(rooms, { room, days, nowMinutes, mapId, buildingKey, name, bedCount = 1, rolls = Math.random }) {
  if (room) {
    room.expiryMinutes += 24 * 60 * days;
    return room;
  }
  const fresh = {
    name,
    mapId,
    buildingKey,
    allocatedBedIndex: Math.floor(rolls() * Math.max(1, bedCount)),
    expiryMinutes: nowMinutes + 24 * 60 * days,
  };
  rooms.push(fresh);
  return fresh;
}

/** DoFoodAndDrink's gate (:287): four game hours since the last meal. */
export const canEat = (lastAteMinutes, nowMinutes) =>
  (nowMinutes - (lastAteMinutes ?? 0)) >= EAT_INTERVAL_MINUTES;

/** FoodAndDrink_OnItemPicked (:305-334). The two HOLIDAY arms are the
 *  whole reason this is a function, and DFU's own comment flags that
 *  neither matches its in-game description: New Life makes everything
 *  FREE (the gold test is skipped AND no gold is taken), while
 *  Harvest's End halves the price with a floor of 1 - a `>>= 1` then
 *  `if (price == 0) price = 1`, so a 1-gold ale still costs 1.
 *  Health restored is 2 * the price PAID... except under New Life,
 *  where `price` is still the halved-or-not menu price even though
 *  nothing was spent, so the free meal heals as if bought. Verbatim.
 *  Answers { kind: 'poor' } or { kind: 'ate', spend, heal }. */
export function eatOrDrink(index, { gold = 0, gameMinutes = 0 } = {}) {
  let price = TAVERN_PRICES[index];
  if (price === undefined) return { kind: 'ignore' };
  // VERBATIM, and a quirk (Ledger B): DFU passes region 0 as a
  // LITERAL - `GetHolidayId(gameMinutes, 0)` - not the player's own
  // region. So the meal's holiday is judged as if the player were
  // always in region index 0, which matters for the region-GATED
  // rows: a Harvest's End half-price only lands where its table row
  // says 0xFF (everywhere) or names region 1. The function takes no
  // regionIndex on purpose - accepting one would invite a caller to
  // "fix" the quirk by passing the real region.
  const holiday = getHolidayId(gameMinutes, 0);
  if (holiday === HOLIDAYS.Harvest_End) {
    price >>= 1;
    if (price === 0) price = 1;
  }
  const newLife = holiday === HOLIDAYS.New_Life;
  if (!newLife && gold < price) return { kind: 'poor' };
  return { kind: 'ate', spend: newLife ? 0 : price, heal: 2 * price };
}

// FLAGGED, with the slices they wait on:
//  - the TALK button routes to TalkManager.TalkToStaticNPC, which the
//    talk arc owns (the guild popup's TALK button has the same seam).
//  - AddPermanentScene (:246) keeps a rented room's interior loaded
//    across a save; the port has no permanent-scene set, so a rented
//    room's contents are not yet preserved - the RENTAL is.
//  - the rest window's bed-marker arm (allocatedBedIndex) is stored
//    here and read by nobody until resting in a rented room lands.

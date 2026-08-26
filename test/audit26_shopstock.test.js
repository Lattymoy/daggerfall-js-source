// AUDIT 26: "you can wipe the store's inventory by clicking and they
// don't respawn." Two laws, both from the source:
//
//  1. THE RESTOCK LAW. DaggerfallLoot.CreateStockedDate (:68-71) packs
//     a game day into `(Year * 1000) + DayOfYear`; StockShopShelf
//     (:150-153) writes that stamp and CLEARS the collection before
//     refilling; PlayerActivate.ActivateLootContainer's ShopShelves arm
//     (:880-886) restocks when `loot.stockedDate <
//     CreateStockedDate(Now)`. So a shelf regenerates once per game
//     day. The port stocked with `items ??=` and never refilled.
//
//  2. ClearSelectedItems ON POP. DaggerfallTradeWindow.OnPop (:404-407)
//     calls ClearSelectedItems unconditionally, and its Buy arm
//     (:589-599) transfers the whole basket back to the merchant. The
//     port removed a clicked item from the shelf array into the basket
//     (_pickRemote) and then let the host's done-drain throw the window
//     away - so clicking items and walking out DESTROYED them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createStockedDate, needsRestock, restockShopShelfIfDue, stockShopShelf,
} from '../src/systems/shopStock.js';
import { dayOfYear, minuteOfDay, dateFromClassicMinutes, CLASSIC_GAME_START_TIME, MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { POTION_RECIPE_TEMPLATE_INDEX, CLASSIC_RECIPE_KEYS } from '../src/systems/loot.js';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';

const WEAPON_SMITH = { buildingType: BUILDING_TYPES.WeaponSmith, quality: 21 };
const start = dateFromClassicMinutes(CLASSIC_GAME_START_TIME);
// The classic start is 13:30 on the 4th, so day boundaries are counted
// off the MIDNIGHT that opens it - a bare +1440 from 13:30 lands on the
// 5th at 13:30 and would hide a day-length that was wrong by an hour.
const MIDNIGHT = CLASSIC_GAME_START_TIME - minuteOfDay(start);
const at = (minutes) => dateFromClassicMinutes(MIDNIGHT + minutes);
// Exhausted seq HOLDS its last value (the loot.test.js convention).
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('AUDIT 26 shopstock: CreateStockedDate is (Year * 1000) + DayOfYear', () => {
  // DaggerfallLoot.cs:68-71, verbatim - the literal is 1000.
  for (const date of [start, dateFromClassicMinutes(0), at(4000 * MINUTES_PER_DAY)]) {
    assert.equal(createStockedDate(date), (date.year * 1000) + dayOfYear(date));
  }
  // 4th Morning Star 3E405 is day-of-year 4, so the stamp is 405004.
  assert.deepEqual(
    { year: start.year, doy: dayOfYear(start), stamp: createStockedDate(start) },
    { year: 405, doy: 4, stamp: 405004 },
  );
  // DayOfYear is 1-based and the pack must not collide across years:
  // the last day of 3E405 and the first of 3E406 are 405360 / 406001.
  assert.equal(createStockedDate({ year: 405, month: 11, day: 29 }), 405360);
  assert.equal(createStockedDate({ year: 406, month: 0, day: 0 }), 406001);
});

test('AUDIT 26 shopstock: the restock condition is stockedDate < CreateStockedDate(Now)', () => {
  // PlayerActivate.cs:882 / :911. A never-stocked container carries 0
  // (DaggerfallLoot.cs:45), so first access always stocks.
  assert.equal(needsRestock(0, start), true);
  assert.equal(needsRestock(createStockedDate(start), start), false, 'same day: no restock');
  // ...and the interval is exactly ONE GAME DAY - not an hour, not a
  // month. Walk the clock forward minute-block by minute-block and the
  // flag flips the moment the day of year moves on.
  const almost = at(MINUTES_PER_DAY - 1);        // 23:59 on the 4th
  const nextDay = at(MINUTES_PER_DAY);           // 00:00 on the 5th
  assert.equal(dayOfYear(almost), dayOfYear(start), 'still the 4th');
  assert.equal(needsRestock(createStockedDate(start), almost), false, 'a minute short: still stocked');
  assert.equal(dayOfYear(nextDay), dayOfYear(start) + 1);
  assert.equal(needsRestock(createStockedDate(start), nextDay), true, 'the day rolled: restock');
});

test('AUDIT 26 shopstock: an EMPTIED shelf refills once the day rolls over', () => {
  // The report's whole complaint, end to end, through the same arm the
  // interior host calls (worldModes.stockShelfIfDue).
  const shelf = {};
  const rolls = () => 0;   // every Dice100 succeeds: a full shelf
  assert.equal(restockShopShelfIfDue(shelf, WEAPON_SMITH, start, { level: 1 }, { rolls }), true);
  assert.ok(shelf.items.length > 0, 'the first activation stocks');
  assert.equal(shelf.stockedDate, createStockedDate(start), 'StockShopShelf stamps the date (:152)');
  const stocked = shelf.items.length;

  // The player buys the lot. Same day, re-activating does NOT refill -
  // that would be a shop that respawns its stock every time you shut
  // the door.
  shelf.items.length = 0;
  assert.equal(restockShopShelfIfDue(shelf, WEAPON_SMITH, start, { level: 1 }, { rolls }), false);
  assert.equal(shelf.items.length, 0, 'same game day: the shelf stays empty');
  const laterSameDay = at(MINUTES_PER_DAY - 1);
  assert.equal(restockShopShelfIfDue(shelf, WEAPON_SMITH, laterSameDay, { level: 1 }, { rolls }), false);
  assert.equal(shelf.items.length, 0);

  // One game day later it is full again, and stamped with the new day.
  const tomorrow = at(MINUTES_PER_DAY);
  assert.equal(restockShopShelfIfDue(shelf, WEAPON_SMITH, tomorrow, { level: 1 }, { rolls }), true);
  assert.equal(shelf.items.length, stocked, 'the shelf came back');
  assert.equal(shelf.stockedDate, createStockedDate(tomorrow));
});

test('AUDIT 26 shopstock: a restock CLEARS - it does not top up', () => {
  // DaggerfallLoot.cs:153 `items.Clear()`. Yesterday's leftovers are
  // not carried into today's shelf, so browsing across a week cannot
  // pile the same goods up.
  const rolls = () => 0;
  const shelf = { stockedDate: createStockedDate(start), items: [{ name: 'yesterday' }] };
  const tomorrow = at(MINUTES_PER_DAY);
  restockShopShelfIfDue(shelf, WEAPON_SMITH, tomorrow, { level: 1 }, { rolls });
  assert.ok(!shelf.items.some((it) => it.name === 'yesterday'), 'the old stock was cleared');
  assert.equal(shelf.items.length, stockShopShelf(WEAPON_SMITH, { level: 1 }, { rolls }).length);
});

/** The Buy-mode hooks, cut down to the collections this law moves. */
const buyHooks = (shelf) => ({
  mode: 'Buy',
  shelfItems: () => shelf,
  packItems: () => [],
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
  gold: () => 100000,
  rows: () => [],
  weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
});

test('AUDIT 26 shopstock: an Alchemist shelf rolls a potion recipe at 25%', () => {
  // DaggerfallLoot.cs:163-166 - the Alchemist arm, and ONLY that arm,
  // calls RandomlyAddPotionRecipe(25, items) before the group loop.
  // Dice100.SuccessRoll(25) is `Roll(1,100) <= 25` (loot.js's one
  // copy), so a 0.0 roll takes it and a 0.99 roll misses.
  const alchemist = { buildingType: BUILDING_TYPES.Alchemist, quality: 20 };
  const player = { level: 5, gender: 'male' };
  const recipes = (rows) => rows.filter((r) => r.templateIndex === POTION_RECIPE_TEMPLATE_INDEX);

  const hit = stockShopShelf(alchemist, player, { rolls: seq(0, 0) });
  assert.equal(recipes(hit).length, 1, 'the roll succeeds and the recipe is stocked FIRST');
  assert.equal(hit[0].templateIndex, POTION_RECIPE_TEMPLATE_INDEX, 'before the group loop');
  assert.equal(hit[0].group, 'MiscItems');
  assert.equal(hit[0].potionRecipeKey, CLASSIC_RECIPE_KEYS[0], 'the pick is the twenty-key classic list');
  // the shelf's own finishing rides it, like every other stocked row
  assert.equal(hit[0].name, ITEM_TEMPLATES[POTION_RECIPE_TEMPLATE_INDEX].name);
  assert.ok(hit[0].value > 0);

  assert.equal(recipes(stockShopShelf(alchemist, player, { rolls: seq(0.99) })).length, 0,
    'a failed roll stocks none');

  // ...and no other shop type rolls one at all
  for (const b of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop,
    BUILDING_TYPES.Bookseller, BUILDING_TYPES.WeaponSmith, BUILDING_TYPES.GemStore]) {
    assert.deepEqual(recipes(stockShopShelf({ buildingType: b, quality: 20 }, player, { rolls: seq(0, 0) })), [],
      'only the Alchemist arm calls RandomlyAddPotionRecipe');
  }
});

test('AUDIT 26 shopstock: closing the trade window returns the basket to the shelf', () => {
  // DaggerfallTradeWindow.OnPop (:404-407) -> ClearSelectedItems
  // (:589-599). Without it, "you can wipe the store's inventory by
  // clicking": every click moved an item off the shelf for good.
  const shelf = [{ templateIndex: 277, name: 'Book A', value: 40 }, { templateIndex: 277, name: 'Book B', value: 40 }];
  const w = new NativeTradeWindow(buyHooks(shelf));
  w._pickRemote(0);
  w._pickRemote(0);
  assert.equal(shelf.length, 0, 'both are staged in the basket');
  assert.equal(w.basket.length, 2);

  w.input('Escape');
  assert.ok(w.done);
  assert.equal(w.basket.length, 0, 'the basket was returned');
  assert.deepEqual(shelf.map((it) => it.name), ['Book A', 'Book B'], 'the shelf is whole again');
});

test('AUDIT 26 shopstock: every close path pops, and popping is idempotent', () => {
  // The exit BUTTON (:887-1022) pops exactly as Escape does...
  const shelf = [{ templateIndex: 277, name: 'Book A', value: 40 }];
  const w = new NativeTradeWindow(buyHooks(shelf));
  w._pickRemote(0);
  assert.equal(shelf.length, 0);
  w.click(241, 188);                       // TRADE_RECTS.exit
  assert.equal(shelf.length, 1, 'the exit button returns the basket too');

  // ...and the host's done-drain calls dispose() on the finished
  // window, which pops again. A second pop must move nothing.
  w.dispose();
  assert.equal(shelf.length, 1, 'no phantom duplicate on the shelf');

  // A SELL-mode window returns its staged lot to the pack instead
  // (:613-625 "priority is to not lose any items").
  const pack = [{ templateIndex: 277, name: 'Mine', value: 40 }];
  const sell = new NativeTradeWindow({
    ...buyHooks([]), mode: 'Sell', packItems: () => pack, accepts: () => true,
  });
  sell._pickLocal(0);
  assert.equal(pack.length, 0);
  assert.equal(sell.staged.length, 1);
  sell.input('Escape');
  assert.equal(sell.staged.length, 0);
  assert.deepEqual(pack.map((it) => it.name), ['Mine'], 'the seller keeps his goods');
});

test('AUDIT 26 shopstock: the interior host wires the restock arm and rides it through the scene cache', () => {
  const wm = readFileSync(join(process.cwd(), 'src/scenes/worldModes.js'), 'utf8');
  // The shelf arm calls the one restock law - not a second `??=`.
  assert.match(wm, /restockShopShelfIfDue\(/, 'the shelf arm does not call the restock law');
  assert.ok(!/shelf\.items \?\?= stockShopShelf/.test(wm), 'the lazy-once stock is back');
  // ...and the stamp round-trips with the items
  // (SerializableLootContainer.cs:72/:151), or a shelf would re-roll
  // on every entry instead of once a day.
  assert.match(wm, /key: `shelf:\$\{i\}`, items: sh\.items \?\? null, stockedDate: sh\.stockedDate \?\? 0/);
  assert.match(wm, /target\.stockedDate = c\.stockedDate \?\? 0/);
});

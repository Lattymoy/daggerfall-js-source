// ESSENTIALS-HALF (2026-09-30, Discord: "things are way too expensive rn for money to be nerfed so heavily... cut the
// cost of most essential items by half"). REALM P0.4 / MERC-RISE / MERC-CAP cut what a player earns online and left
// what they pay: online now a tavern room, its food and drink, a temple's cure, a travel fare and a potion bought at
// any counter cost half (rounded up, at least a gold, a free one kept free). Offline, DFU's prices stand; repairs,
// training, spells, enchanting, houses and ships never move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_ESSENTIALS_PRICE_SCALE, essentialPrice, calculateCost, calculateTradePrice } from '../../src/systems/shopStock.js';
import { rentalDecision, roomPrice, eatOrDrink, tavernMenuLabels, tavernMenuPrice, TAVERN_MENU, TAVERN_PRICES } from '../../src/systems/tavern.js';
import { tavernMenu } from '../../src/systems/survival/tavernMenu.js';
import { cureDiseaseOffer } from '../../src/systems/guild/guildServiceActions.js';
import { buyItemPrice, tradeCost, getTradePrice } from '../../src/systems/tradeModes.js';
import { scaleTripCost } from '../../src/ui/travel/travelPopUp.js';
import { calculateTripCost } from '../../src/systems/travel/travel.js';
import { startDisease } from '../../src/systems/diseases.js';
import { SKILLS } from '../../src/systems/skills.js';
import { GUILDS } from '../../src/systems/guild/guilds.js';
import { TEMPLATES } from '../../src/systems/useItem.js';
import { HOLIDAYS } from '../../src/systems/holidays.js';

/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function onlinePage(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}
const DAY = { dayOfYear: 100 };   // no Heart's Day
const skills = { mercantile: 50, personality: 50 };
const potion = (value = 50, stackCount = 1) => ({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, value, stackCount });
const sword = (value = 50) => ({ group: 'Weapons', templateIndex: 0, value, stackCount: 1 });
const diseased = () => {
  const e = {
    name: 'Valen', isPlayer: true, level: 20, health: 30, maxHealth: 30, goldPieces: 0, items: [],
    skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 50])),
    stats: { personality: 50 }, activeEffects: [],
  };
  startDisease(e, 0, 0, () => 0);
  return e;
};

test('ESSENTIALS-HALF: the one home - half, rounded up, at least a gold, a free price kept free, offline untouched', () => {
  assert.equal(ONLINE_ESSENTIALS_PRICE_SCALE, 0.5);
  assert.equal(essentialPrice(100, { online: true }), 50);
  assert.equal(essentialPrice(7, { online: true }), 4, 'rounded up');
  assert.equal(essentialPrice(1, { online: true }), 1, 'at least a gold');
  assert.equal(essentialPrice(0, { online: true }), 0, 'a free one stays free');
  assert.equal(essentialPrice(100, { online: false }), 100);
  assert.equal(essentialPrice(7), 7, 'the default reads the page: offline here');
  assert.equal(onlinePage(() => essentialPrice(7)), 4, 'and online on an ?online page');
});

test('ESSENTIALS-HALF: a tavern room costs half online, DFU\'s price offline', () => {
  const offline = rentalDecision('10', { date: DAY, quality: 10, skills, online: false }).price;
  assert.equal(offline, calculateTradePrice(70, 10, skills, false));
  assert.equal(rentalDecision('10', { date: DAY, quality: 10, skills, online: true }).price, Math.ceil(offline / 2));
  assert.equal(roomPrice(10, DAY, 10, skills, { online: true }), Math.ceil(offline / 2));
  assert.equal(roomPrice(10, DAY, 10, skills, { online: false }), offline);
  assert.equal(onlinePage(() => rentalDecision('10', { date: DAY, quality: 10, skills }).price), Math.ceil(offline / 2), 'the page\'s own switch');
  assert.equal(rentalDecision('10', { date: DAY, quality: 10, skills }).price, offline);
});

test('ESSENTIALS-HALF: food and drink cost half online and heal as the menu price', () => {
  const stew = TAVERN_MENU.findIndex((t) => t.startsWith('Stew'));
  assert.equal(TAVERN_PRICES[stew], 3);
  const day = 100 * 1440;   // no holiday
  assert.deepEqual(eatOrDrink(stew, { gold: 10, gameMinutes: day, online: false }), { kind: 'ate', spend: 3, heal: 6 });
  assert.deepEqual(eatOrDrink(stew, { gold: 10, gameMinutes: day, online: true }), { kind: 'ate', spend: 2, heal: 6 });
  assert.equal(eatOrDrink(stew, { gold: 2, gameMinutes: day, online: true }).kind, 'ate', 'two gold buys it online');
  assert.equal(eatOrDrink(stew, { gold: 2, gameMinutes: day, online: false }).kind, 'poor');
  assert.equal(tavernMenuPrice(stew, { online: true }), 2);
  assert.equal(tavernMenuLabels({ online: true })[stew], 'Stew (2 gold)');
  assert.deepEqual(tavernMenuLabels({ online: false }), [...TAVERN_MENU], 'offline, DFU\'s own labels');
  const off = tavernMenu({ quality: 15, hour: 14, online: false }).rows.filter((r) => r.kind !== 'header');
  const on = tavernMenu({ quality: 15, hour: 14, online: true }).rows.filter((r) => r.kind !== 'header');
  assert.ok(off.length > 0 && off.length === on.length);
  off.forEach((r, i) => {
    assert.equal(on[i].price, Math.max(1, Math.ceil(r.price / 2)), r.name);
    assert.match(on[i].text, new RegExp(`^\\s*${on[i].price} gold`));
  });
});

test('ESSENTIALS-HALF: a temple cure costs half online; the priest\'s haggle line is the haggle\'s own', () => {
  const off = cureDiseaseOffer(diseased(), GUILDS.FightersGuild, null, { quality: 10, online: false });
  const on = cureDiseaseOffer(diseased(), GUILDS.FightersGuild, null, { quality: 10, online: true });
  assert.equal(off.kind, 'offer');
  assert.equal(off.cost, calculateTradePrice(calculateCost(250, 10), 10, skills, false));
  assert.equal(on.cost, Math.ceil(off.cost / 2));
  assert.equal(on.textId, off.textId, 'the half is not a bargain the priest remarks on');
});

test('ESSENTIALS-HALF: a travel fare costs half online - inn nights and passage each; offline untouched', () => {
  const c = calculateTripCost(10 * 24 * 60, 30, { sleepModeInn: true, travelShip: true });
  assert.ok(c.piecesCost > 0 && c.totalCost > c.piecesCost);
  assert.equal(scaleTripCost(c, null, null, { online: false }), c, 'offline, the fare as billed');
  const half = scaleTripCost(c, null, null, { online: true });
  assert.equal(half.piecesCost, Math.ceil(c.piecesCost / 2));
  assert.equal(half.totalCost, half.piecesCost + Math.ceil((c.totalCost - c.piecesCost) / 2));
  const settings = { fastTravelCostScaleFactor: 4, shipTravelCostScaleFactor: 1 };
  const scaledOff = scaleTripCost(c, settings, null, { online: false });
  const scaledOn = scaleTripCost(c, settings, null, { online: true });
  assert.equal(scaledOn.piecesCost, Math.ceil(scaledOff.piecesCost / 2), 'the half lands after the mod\'s scaling');
  assert.equal(onlinePage(() => scaleTripCost(c, null, null)).totalCost, half.totalCost, 'the page\'s own switch');
});

test('ESSENTIALS-HALF: a potion bought at a counter costs half online; a sword does not', () => {
  const ctx = { quality: 10 };
  const full = buyItemPrice(potion(50, 3), { ...ctx, online: false });
  assert.equal(full, calculateCost(50, 10) * 3);
  assert.equal(buyItemPrice(potion(50, 3), { ...ctx, online: true }), Math.ceil(full / 2));
  assert.equal(buyItemPrice(sword(50), { ...ctx, online: true }), buyItemPrice(sword(50), { ...ctx, online: false }), 'a non-essential never moves');
  const lotOff = tradeCost('Buy', [potion(50), sword(50)], ctx);
  const lotOn = onlinePage(() => tradeCost('Buy', [potion(50), sword(50)], ctx));
  assert.equal(lotOn.cost, lotOff.cost - calculateCost(50, 10) + Math.ceil(calculateCost(50, 10) / 2), 'the Buy walk halves the potion alone');
  assert.equal(lotOn.pieces, lotOff.pieces);
});

test('ESSENTIALS-HALF: a potion bought online never sells back for more than it cost', () => {
  onlinePage(() => {
    for (const value of [1, 3, 7, 25, 50, 101, 333]) {
      for (const q of [1, 10, 20]) {
        for (const m of [0, 50, 100]) {
          const s = { mercantile: m, personality: m };
          const it = potion(value);
          const buy = getTradePrice('Buy', tradeCost('Buy', [it], { quality: q }).cost, q, s, 1);
          const sell = getTradePrice('Sell', tradeCost('Sell', [it], { quality: q }).cost, q, s);
          assert.ok(sell <= buy, `value ${value} q ${q} m ${m}: sells ${sell}, bought ${buy}`);
        }
      }
    }
  });
});

test('ESSENTIALS-HALF: repairs stay at their price online', () => {
  const blade = { ...sword(200), currentCondition: 10, maxCondition: 100 };
  const off = tradeCost('Repair', [blade], { quality: 10 });
  const on = onlinePage(() => tradeCost('Repair', [blade], { quality: 10 }));
  assert.equal(on.cost, off.cost);
});

test('AUDIT ESSENTIALS F1: the online potion half never stacks on a holiday\'s half - bought on the holidays, sold for no more', () => {
  onlinePage(() => {
    for (const [holidayId, guildFactionId] of [[HOLIDAYS.Merchants_Festival, null], [HOLIDAYS.Tales_and_Tallow, GUILDS.MagesGuild.factionId]]) {
      const ctx = { quality: 10, holidayId, guildFactionId };
      const it = potion(100);
      const holidayOnly = buyItemPrice(it, { ...ctx, online: false });
      assert.equal(buyItemPrice(it, { ...ctx, online: true }), holidayOnly, 'the holiday\'s half alone');
      for (const q of [1, 10, 20]) {
        for (const m of [0, 50, 100]) {
          const s = { mercantile: m, personality: m };
          const buy = getTradePrice('Buy', tradeCost('Buy', [potion(100)], { ...ctx, quality: q }).cost, q, s, 1);
          const sell = getTradePrice('Sell', tradeCost('Sell', [potion(100)], { ...ctx, quality: q }).cost, q, s);
          assert.ok(sell <= buy, `holiday ${holidayId} q ${q} m ${m}: sells ${sell}, bought ${buy}`);
        }
      }
    }
  });
});

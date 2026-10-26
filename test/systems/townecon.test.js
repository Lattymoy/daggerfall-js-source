import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TOWN_ECON_TYPES, isEconTown, townKeyOf, TOWN_BASE, TOWN_SIZE, TOWN_CYCLE, TOWN_STANDING_DIV, TOWN_EDICT_TERMS, TOWN_RAID_TERM,
  TOWN_PLAYERS_MAX, TOWN_BANDS, TOWN_PRICE_SWING, TOWN_FACTOR_FLOOR, TOWN_DAY_MS, townDayOf, townCycle, townSeatTerm, townProsperity,
  townBandOf, townBuyFactor, townSaleFactor, townShopFactor, townTrendWord, townPriceLine, townReasonLine, TOWN_REASONS, townAreaLine,
  townTipOf, townEconomyLine, TOWN_SALE_MODES,
} from '../../src/net/townEconLaw.js';
import { seatShopFactor, seatTipOf, EDICTS } from '../../src/net/townSeatLaw.js';
import { createTownSeatBook } from '../../src/net/townSeatBook.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { ONLINE_SALE_SHARE, ONLINE_ESSENTIALS_PRICE_SCALE } from '../../src/systems/shopStock.js';
import { tradeCost, getTradePrice } from '../../src/systems/tradeModes.js';
import { createRestItem, REST_ITEM } from '../../src/systems/rest/restItems.js';
import { createTownEcon } from '../../src/systems/town/townEcon.js';
import { readTip, TOWN_TIP_LINES_MAX, TIP_LINES_MAX, SEAT_TIP_TEXT_MAX } from '../../src/ui/eventMapMarks.js';
import {
  TOWN_ECON_SOURCES, TOWN_ECON_WEIGHTS, TOWN_ECON_CAPS, TOWN_ECON_DECAY, TOWN_ECON_DAYS, TOWN_ECON_HALF, TOWN_ECON_KEPT_S, TOWN_ECON_SHARE_LEAST,
  TOWN_WATCH_CLAIM_MAX, TOWN_WITNESS_KIND, TOWN_WITNESS_HOUR, townPixelIdOf, TOWN_TIP_PATRONS_ROOM, townActivity, townPlayersShare, townShareShown, townReportOf, townReportText, parseTownReport,
} from '../../src/net/townEconLaw.js';
import { markCounterBought, buyItemPrice } from '../../src/systems/tradeModes.js';
import { COUNTER_PAID_MARK, PATRON_COUNTER_MARK } from '../../src/net/patronLaw.js';
import { addItem, splitStack } from '../../src/systems/inventory.js';
import { lawfulItem } from '../../src/systems/item/itemLaw.js';
import { validLootList, createPotion } from '../../src/systems/loot/loot.js';
import { potionRecipeKeys } from '../../src/systems/potions.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';

// TOWN-ECON TE1 (2026-10-16, bible/06-Systems/Town-Economy-Arc.md; Mac: "give every city and village a dynamic economy
// system, where even players can affect the influence. Allowing players to hover over towns and see an economy tooltip
// along with guild control"): the law, the client's reading, and the wiring into the counters and both maps' cards.
// AUDIT TOWN-ECON (2026-10-16, bible/01-Overview/audits/Audit-Town-Econ.md): each finding's pin names it (TOWNECON-AUDIT-<id>).

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const SH = Object.freeze({ id: 'g1', name: 'the Silver Hand', tag: 'SH' });
const KEY = townKeyOf(212, 151);
const DAY = 20000;

test('TOWN-ECON the law\'s numbers: the towns are MAPS\' three town types, keyed by their pixel; the scale, the sizes, the cycle, the seat\'s and the raid\'s terms, the players\' bound, the bands, the swing and the floor are TE0\'s (mutants: TOWNECON-types, TOWNECON-key, TOWNECON-size, TOWNECON-cycle-amp, TOWNECON-cycle-days, TOWNECON-edict, TOWNECON-raid, TOWNECON-bands, TOWNECON-swing)', () => {
  assert.deepEqual(TOWN_ECON_TYPES, [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
  assert.equal(isEconTown(LOCATION_TYPES.TownVillage), true);
  assert.equal(isEconTown(LOCATION_TYPES.DungeonLabyrinth), false);
  assert.equal(isEconTown(undefined), false);
  assert.equal(KEY, 151212, 'py * 1000 + px - the relay\'s receipts\' and the boards\' own pixel');
  assert.equal(TOWN_BASE, 50);
  assert.deepEqual(TOWN_SIZE, { 0: 6, 1: 2, 2: -2 });
  assert.deepEqual(TOWN_CYCLE, [{ amp: 12, days: 11 }, { amp: 6, days: 29 }]);
  assert.equal(TOWN_STANDING_DIV, 5);
  assert.deepEqual(TOWN_EDICT_TERMS, { 'market-day': 6, festival: 8, 'open-gates': 3, levy: -6, curfew: -4 });
  for (const id of Object.keys(TOWN_EDICT_TERMS)) assert.ok(EDICTS[id], `${id} is one of the seats' own Edicts`);
  assert.equal(TOWN_RAID_TERM, -15);
  assert.equal(TOWN_PLAYERS_MAX, 30);
  assert.deepEqual(TOWN_BANDS, [['Booming', 85], ['Thriving', 65], ['Steady', 35], ['Struggling', 15], ['Destitute', 0]]);
  assert.equal(TOWN_PRICE_SWING, 0.25);
  assert.equal(TOWN_DAY_MS, 86_400_000);
  assert.equal(townDayOf(DAY * TOWN_DAY_MS + TOWN_DAY_MS - 1), DAY, 'the real UTC day, not the sky\'s');
});

test('TOWN-ECON the market cycle: a closed form over real days, phased by the town - the same day reads the same anywhere, the waves repeat on their own periods, never past their amplitudes together, and two towns differ (mutants: TOWNECON-cycle-amp, TOWNECON-cycle-days, TOWNECON-cycle-unphased)', () => {
  assert.deepEqual([DAY, DAY + 1, DAY + 5].map((d) => townCycle(KEY, d).toFixed(4)), ['5.0706', '9.2042', '-5.6117']);
  assert.equal(townCycle(KEY, DAY + 11 * 29).toFixed(6), townCycle(KEY, DAY).toFixed(6), 'both waves home again after 11 x 29 days');
  let most = 0;
  for (let d = 0; d < 1200; d++) most = Math.max(most, Math.abs(townCycle(KEY, d)));
  assert.ok(most <= 18 && most > 17, `the two waves together, ${most}`);
  assert.notEqual(townCycle(KEY, DAY).toFixed(4), townCycle(townKeyOf(213, 151), DAY).toFixed(4), 'a town\'s own phase');
});

test('TOWN-ECON a town\'s Prosperity: the base, its size, its cycle, its seat (Standing and Edict, an unheld seat nothing), a raid at its gates and the players\' share bounded to TOWN_PLAYERS_MAX - a whole number held to 0..100; AUDIT LAW-6: an Edict is one of the table\'s own names, a share of Infinity the most (mutants: TOWNECON-size, TOWNECON-standing, TOWNECON-raid, TOWNECON-players-unbounded, TOWNECON-unheld-counts, TOWNECON-unclamped, TOWNECON-AUDIT-LAW6-edict-proto, TOWNECON-AUDIT-LAW6-infinite-share, TOWNECON-AUDIT-DOC3-standing-unread)', () => {
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY }), 61, '50 + 6 + 5.07');
  assert.equal(townProsperity({ key: KEY, type: 2, day: DAY }), 53, '50 - 2 + 5.07');
  const seat = (standing, edict = null) => ({ tier: 'palace', holder: { guild: SH, standing, edict } });
  assert.equal(townSeatTerm(seat(80, 'market-day')), 12, '(80 - 50) / 5 + 6');
  assert.equal(townSeatTerm(seat(20, 'levy')), -12, '(20 - 50) / 5 - 6');
  assert.equal(townSeatTerm({ tier: 'palace', holder: null }), 0, 'an unheld seat');
  assert.equal(townSeatTerm(null), 0);
  assert.equal(townSeatTerm(seat(50, 'bounty')), 0, 'an Edict that does not move trade');
  assert.equal(townSeatTerm(seat(NaN, null)), 0, 'a Standing not read counts nothing');
  assert.equal(townSeatTerm(seat(undefined, 'festival')), 8);
  // AUDIT LAW-6: `toString` read Object.prototype's own function, and the sum became a string held to the middle
  assert.equal(townSeatTerm(seat(50, 'toString')), 0);
  assert.equal(townSeatTerm(seat(50, '__proto__')), 0);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, raided: true, seat: seat(50, 'toString') }), 46, 'the raid and the cycle still counted');
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, seat: seat(80, 'market-day') }), 73);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, raided: true }), 46);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: 12 }), 73);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: 500 }), 91, 'the share bounded at 30');
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: Infinity }), 91, 'AUDIT LAW-6: an infinite share is the most, not nothing');
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: -Infinity }), 61);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: -40 }), 61, 'and never below nothing');
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, players: NaN }), 61);
  assert.equal(townProsperity({ key: KEY, type: 0, day: DAY, seat: seat(100, 'festival'), players: 30 }), 100, 'held at the top');
  assert.equal(townProsperity({ key: KEY, type: 2, day: DAY + 5, seat: seat(0, 'levy'), raided: true }), 11, '50 - 2 - 5.61 - 10 - 6 - 15');
  assert.equal(townProsperity({ key: KEY, type: 2, day: DAY + 5, seat: seat(-100, 'levy'), raided: true }), 0, 'held at the bottom');
});

test('TOWN-ECON the bands: Destitute, Struggling, Steady, Thriving, Booming at 0, 15, 35, 65 and 85 (mutants: TOWNECON-bands)', () => {
  const at = (ps) => ps.map(townBandOf);
  assert.deepEqual(at([0, 14, 15, 34, 35, 64, 65, 84, 85, 100]),
    ['Destitute', 'Destitute', 'Struggling', 'Struggling', 'Steady', 'Steady', 'Thriving', 'Thriving', 'Booming', 'Booming']);
  assert.equal(townBandOf(-5), 'Destitute');
  assert.equal(townBandOf(140), 'Booming');
});

test('TOWN-ECON the price (TE0 decision 4, Mac: "Wider swings, ±25%+"): a counter asks a quarter less at 100 and a quarter more at 0; what it pays falls by the same share either side of the middle and NEVER rises above 1 nor above what it asks (AUDIT LAW-1); a sale of magic is a sale (AUDIT LAW-5); a town\'s and a seat\'s asking factors together never go below the seats\' own deepest (mutants: TOWNECON-swing, TOWNECON-sale-rises, TOWNECON-AUDIT-LAW1-sale-above-ask, TOWNECON-AUDIT-LAW5-sellmagic, TOWNECON-floor-lost, TOWNECON-floor-number, TOWNECON-seat-on-sale, TOWNECON-mode-open, TOWNECON-AUDIT-LAW1-sale-above-ask, TOWNECON-sale-rises)', () => {
  assert.equal(townBuyFactor(100), 0.75);
  assert.equal(townBuyFactor(0), 1.25);
  assert.equal(townBuyFactor(50), 1);
  assert.equal(townBuyFactor(75), 0.875);
  assert.deepEqual([0, 25, 50, 75, 100].map(townSaleFactor), [0.75, 0.875, 1, 0.875, 0.75], 'the V: less coin below the middle, a stocked town above it');
  for (let p = -10; p <= 110; p++) {
    assert.ok(townSaleFactor(p) <= 1, `p ${p}: never more than the region's`);
    assert.ok(townSaleFactor(p) <= townBuyFactor(p), `p ${p}: never more than the town asks (AUDIT LAW-1)`);
  }
  assert.deepEqual(TOWN_SALE_MODES, ['Sell', 'SellMagic']);
  assert.equal(townShopFactor(25, 'SellMagic', 0.7), townShopFactor(25, 'Sell', 0.7), 'AUDIT LAW-5: the Mages Guild\'s sale of magic is a sale');
  // the floor IS the seats' deepest: a crown's loved member on Market Day
  const deepest = seatShopFactor({ tier: 'crown', holder: { guild: SH, standing: 100, edict: 'market-day' } }, SH.id);
  assert.equal(TOWN_FACTOR_FLOOR.toFixed(2), deepest.toFixed(2));
  assert.equal(TOWN_FACTOR_FLOOR, 0.7);
  for (const s of [1, 0.9, 0.85, 0.75, deepest]) for (let p = 0; p <= 100; p += 5) {
    assert.ok(townShopFactor(p, 'Buy', s) >= TOWN_FACTOR_FLOOR, `Buy p ${p} seat ${s}`);
    assert.ok(townShopFactor(p, 'Repair', s) >= TOWN_FACTOR_FLOOR, `Repair p ${p} seat ${s}`);
  }
  assert.equal(townShopFactor(100, 'Buy', 0.9), 0.7, '0.75 x 0.9 = 0.675, held at the floor');
  assert.equal(townShopFactor(50, 'Buy', 0.9), 0.9, 'a Steady town leaves the seat\'s');
  assert.equal(townShopFactor(0, 'Repair', 1), 1.25);
  assert.equal(townShopFactor(25, 'Sell'), 0.875, 'a sale is the town\'s paying factor where no seat lowers the ask');
  assert.equal(townShopFactor(90, 'Sell'), 0.8);
  // SEAT-LOOP (Town-Economy-Arc 7.5): what a counter pays falls with what it asks THIS player - a seat's discount lowers both
  assert.equal(townShopFactor(25, 'Sell', 0.7), townShopFactor(25, 'Buy', 0.7), '1.125 x 0.7: the ask, under the town\'s 0.875');
  assert.equal(townShopFactor(90, 'Sell', 0.7), 0.7, 'the floor\'s ask, under the town\'s 0.8');
  assert.equal(townShopFactor(50, 'SellMagic', 0.9), 0.9, 'Market Day\'s ask at a Steady town: its pay too');
  assert.equal(townShopFactor(40, 'Sell', 1), townSaleFactor(40), 'no seat: the town\'s own V');
  for (const s of [1, 0.9, 0.85, 0.75, deepest]) for (let p = 0; p <= 100; p++) {
    assert.ok(townShopFactor(p, 'Sell', s) <= townShopFactor(p, 'Buy', s), `Sell p ${p} seat ${s}: never above the ask`);
  }
  assert.equal(townShopFactor(100, 'Identify', 0.8), 1, 'a mode that is not a counter\'s trade');
  // within one counter's region and quality, no town's discount makes a buy-here-sell-there profit the online sale share
  // (REALM P0.4) did not already allow - an essential's half (ESSENTIALS-HALF) asked too
  const cheapestAsk = Math.min(...Array.from({ length: 101 }, (_, p) => townShopFactor(p, 'Buy', deepest)));
  const dearestPay = Math.max(...Array.from({ length: 101 }, (_, p) => townShopFactor(p, 'Sell')));
  assert.ok(ONLINE_SALE_SHARE * dearestPay < cheapestAsk, `${ONLINE_SALE_SHARE} x ${dearestPay} < ${cheapestAsk}`);
  assert.equal(ONLINE_ESSENTIALS_PRICE_SCALE, ONLINE_SALE_SHARE, 'the essentials\' half breaks even only where a counter\'s two factors are one (AUDIT LAW-1, below)');
});

test('TOWN-ECON AUDIT LAW-1: AN ESSENTIAL BOUGHT AND SOLD BACK AT ONE TOWN COUNTER NEVER PAYS - five firewood through the real trade walk (tradeCost, getTradePrice) online, the best haggler, every Prosperity, every shop quality, the region\'s index from 500 to 2,500, each factor applied as shopAdjustment applies it; at 51 a Booming town\'s ask fell under its pay and 134 of 140 counters paid (AUDIT TOWN-ECON 2 REC-6: since SEAT-LOOP\'s bound the walk no longer tells LAW-1\'s sale factor apart - its two mutants, TOWNECON-AUDIT-LAW1-sale-above-ask and TOWNECON-sale-rises, die in the price test)', () => {
  const was = globalThis.location;
  globalThis.location = { search: '?online=1' };
  try {
    const adjOf = (adj, mode, p) => { const f = townShopFactor(p, mode, 1); return f === 1 ? adj : Math.round(adj * f); };   // worldModes.js shopAdjustment's own two lines
    const best = { mercantile: 100, personality: 100 };
    const paid = [];
    for (let p = 0; p <= 100; p++) for (let q = 1; q <= 20; q++) for (const adj of [500, 1000, 1500, 2500]) {
      const it = createRestItem(REST_ITEM.Firewood, { stackCount: 5 });
      const bl = tradeCost('Buy', [it], { quality: q, priceAdjustment: adjOf(adj, 'Buy', p) });
      const sl = tradeCost('Sell', [it], { quality: q, priceAdjustment: adjOf(adj, 'Sell', p) });
      const buy = getTradePrice('Buy', bl.cost, q, best, bl.pieces), sell = getTradePrice('Sell', sl.cost, q, best);
      if (sell > buy) paid.push(`P${p} q${q} index ${adj}: buy ${buy}, sell ${sell}`);
    }
    assert.deepEqual(paid.slice(0, 5), [], `${paid.length} counters pay for a round trip`);
  } finally { globalThis.location = was; }
});

test('TOWN-ECON SEAT-LOOP (Town-Economy-Arc 7.5, Mac: "Close it"): AN ESSENTIAL BOUGHT AND SOLD BACK AT A SEAT TOWN\'S COUNTER NEVER PAYS - a member\'s discount, a crown\'s, a loved Standing\'s and Market Day\'s, through the real trade walk online with the best haggler, at every Prosperity, quality and region index, and where the seat\'s place has no economy; before, five firewood at a quality-10 counter at the region\'s index cost 13 and sold for 15 on Market Day (mutants: TOWNECON-SEATLOOP-law-unbounded, TOWNECON-SEATLOOP-fallback-unbounded)', () => {
  const was = globalThis.location;
  globalThis.location = { search: '?online=1' };
  try {
    const adjOf = (adj, f) => (f === 1 ? adj : Math.round(adj * f));   // worldModes.js shopAdjustment's own two lines
    const best = { mercantile: 100, personality: 100 };
    const held = (tier, standing, edict) => ({ tier, holder: { guild: SH, standing, edict } });
    const seats = [held('palace', 50, 'market-day'), held('palace', 50, null), held('crown', 50, null), held('palace', 80, 'market-day'), held('crown', 100, 'market-day')];
    const factors = [...new Set([...seats.map((s) => seatShopFactor(s, SH.id)), seatShopFactor(seats[0], 'g9')])];
    assert.deepEqual(factors.map((f) => f.toFixed(2)), ['0.80', '0.90', '0.85', '0.75', '0.70'], 'Market Day, a member, a crown\'s member, loved, the deepest - and Market Day for anyone');
    const econ = createTownEcon({ online: () => true, townOf: () => null, seatAt: () => null, seats: () => null, raidedAt: () => false });
    const walk = (q, adj, buyF, sellF) => {
      const it = createRestItem(REST_ITEM.Firewood, { stackCount: 5 });
      const bl = tradeCost('Buy', [it], { quality: q, priceAdjustment: adjOf(adj, buyF) });
      const sl = tradeCost('Sell', [it], { quality: q, priceAdjustment: adjOf(adj, sellF) });
      return [getTradePrice('Buy', bl.cost, q, best, bl.pieces), getTradePrice('Sell', sl.cost, q, best)];
    };
    assert.deepEqual(walk(10, 1000, 0.9, 1), [13, 15], 'the hole as the audit measured it: Market Day\'s ask, the region\'s pay');
    const paid = [];
    for (const f of factors) for (let q = 1; q <= 20; q++) for (const adj of [500, 1000, 1500, 2500]) {
      for (let p = 0; p <= 100; p += 2) {
        const [buy, sell] = walk(q, adj, townShopFactor(p, 'Buy', f), townShopFactor(p, 'Sell', f));
        if (sell > buy) paid.push(`seat ${f} P${p} q${q} index ${adj}: buy ${buy}, sell ${sell}`);
      }
      const [buy, sell] = walk(q, adj, econ.shopFactor({ townMapId: 5 }, 'Buy', f), econ.shopFactor({ townMapId: 5 }, 'Sell', f));
      if (sell > buy) paid.push(`seat ${f}, no economy, q${q} index ${adj}: buy ${buy}, sell ${sell}`);
    }
    assert.deepEqual(paid.slice(0, 5), [], `${paid.length} counters pay for a round trip`);
  } finally { globalThis.location = was; }
});

test('TOWN-ECON the card\'s words: the economy out of 100 and the market\'s trend (AUDIT UI-3), the prices as shares of the region\'s usual prices - one rounding for both sides (AUDIT UI-7) and Market Day in what everyone is asked (AUDIT UI-4) - the strongest reason (a raid before the Edict before the players), and the area\'s holder in the player\'s own words around the town\'s and the guild\'s names (AUDIT UI-2) (mutants: TOWNECON-price-words, TOWNECON-trend, TOWNECON-reason-order, TOWNECON-AUDIT-UI7-two-roundings, TOWNECON-AUDIT-UI2-english-charter, TOWNECON-AUDIT-DOC3-players-threshold)', () => {
  assert.deepEqual([townTrendWord(60, 55), townTrendWord(55, 60), townTrendWord(55, 55)], ['rising', 'falling', 'flat']);
  assert.equal(townEconomyLine(61, 60), 'Economy: Steady (61/100). Market rising.');
  assert.equal(townEconomyLine(20, 20), 'Economy: Struggling (20/100). Market flat.');
  assert.equal(townPriceLine(100), 'Shops here ask 25% less and pay 25% less than the region\'s usual prices.');
  assert.equal(townPriceLine(0), 'Shops here ask 25% more and pay 25% less than the region\'s usual prices.');
  assert.equal(townPriceLine(50), 'Shops here ask and pay the region\'s usual prices.');
  assert.equal(townPriceLine(47), 'Shops here ask 2% more and pay 2% less than the region\'s usual prices.', 'AUDIT UI-7: 1.015 and 0.985 one number');
  assert.equal(townPriceLine(49), 'Shops here ask 1% more and pay 1% less than the region\'s usual prices.');
  assert.equal(townPriceLine(51), 'Shops here ask 1% less and pay 1% less than the region\'s usual prices.');
  // AUDIT UI-4: Market Day is everyone's, so the card's ask carries it. PIN MOVED (AUDIT TOWN-ECON 2 PRICE-3, REC-1): and
  // since SEAT-LOOP its pay - a counter pays this player no more than it asks them (townShopFactor's Sell)
  assert.equal(townPriceLine(80, 0.9), 'Shops here ask 24% less and pay 24% less than the region\'s usual prices.', '0.85 x 0.9 = 0.765, and the sale held to it');
  assert.equal(townPriceLine(50, 0.9), 'Shops here ask 10% less and pay 10% less than the region\'s usual prices.');
  assert.equal(townPriceLine(40, 0.9), 'Shops here ask 6% less and pay 6% less than the region\'s usual prices.', '1.05 x 0.9 = 0.945, under the sale\'s 0.95');
  assert.equal(townPriceLine(44, 0.9), 'Shops here ask 7% less and pay 7% less than the region\'s usual prices.');
  for (let q = 0; q <= 100; q++) for (const f of [1, 0.9, 0.8, 0.75, 0.7]) assert.equal(townPriceLine(q, f).includes(`pay ${Math.round((1 - townShopFactor(q, 'Sell', f)) * 100 + 1e-9)}% less`) || Math.round((1 - townShopFactor(q, 'Sell', f)) * 100 + 1e-9) === 0, true, `${q}/${f}: the card's pay is the counter's (mutants: TOWNECON-AUDIT2-PRICE3-pay-unbound)`);
  assert.equal(townPriceLine(28, 0.9), 'Shops here ask the region\'s usual prices and pay 11% less.', 'a markup Market Day cancels to the percent');
  assert.equal(townPriceLine(10, 0.9), 'Shops here ask 8% more and pay 20% less than the region\'s usual prices.', '1.2 x 0.9 = 1.08; 0.8 - each number its own');
  assert.equal(townReasonLine({ raided: true, edict: 'festival', players: 3 }), TOWN_REASONS.raid);
  assert.equal(townReasonLine({ edict: 'levy', players: 3 }), 'The Levy weighs on trade.');
  assert.equal(townReasonLine({ edict: 'bounty', players: 3 }), TOWN_REASONS.players, 'an Edict that moves no trade gives no reason');
  assert.equal(townReasonLine({ players: 1 }), TOWN_REASONS.players, 'one act of the players\' is busy');
  assert.equal(townReasonLine({ players: 0.5 }), null);
  assert.equal(townReasonLine({}), null);
  const area = { name: 'Anticlere', tier: 'palace', region: 16, holder: { guild: SH } };
  assert.equal(townAreaLine(area), 'Under the Charter of Anticlere: held by the Silver Hand <SH>');
  assert.equal(townAreaLine({ ...area, holder: null }), 'Under the Charter of Anticlere: unheld');
  assert.equal(townAreaLine({ name: 'Wayrest', tier: 'crown', region: 23, holder: { guild: { name: 'Ebon Oath', tag: 'EO' } } }), 'Under the Crown Charter of Wayrest: held by Ebon Oath <EO>');
  assert.equal(townAreaLine({ name: 'Sentinel', tier: 'crown', region: 20, holder: null }), 'Under the Crown Charter of Sentinel: unheld');
  assert.equal(townAreaLine(null), 'No guild holds this area.');
});

test('TOWN-ECON a town\'s card (TE0 decisions 5 and 6): its economy, its prices, one reason, then its guild control - a seat town\'s own SEAT-TIP lines after the town\'s (a held seat\'s Charter line left out: its holder line names the guild - AUDIT UI-1), any other the area\'s holder, nothing of it where the seats are not known; read whole within TOWN_TIP_LINES_MAX, and the card bounded in height by CARD-FIT\'s own rule (mutants: TOWNECON-area-dropped, TOWNECON-seat-lines-dropped, TOWNECON-lines-cut, TOWNECON-AUDIT-UI1-charter-twice, TOWNECON-AUDIT-UI1-css-unbounded, TOWNECON-AUDIT-UI4-market-day-unpriced, TOWNECON-AUDIT-DOC3-siege-clock)', () => {
  const area = { name: 'Anticlere', tier: 'palace', region: 16, holder: { guild: SH } };
  assert.deepEqual(townTipOf({ name: 'Ripmarket', p: 72, prev: 70, area }), {
    title: 'Ripmarket',
    lines: ['Economy: Thriving (72/100). Market rising.', 'Shops here ask 11% less and pay 11% less than the region\'s usual prices.', 'Under the Charter of Anticlere: held by the Silver Hand <SH>'],
  });
  assert.deepEqual(townTipOf({ name: 'Ripmarket', p: 20, prev: 20, raided: true, area: null }).lines,
    ['Economy: Struggling (20/100). Market flat.', 'Shops here ask 15% more and pay 15% less than the region\'s usual prices.', TOWN_REASONS.raid, 'No guild holds this area.']);
  assert.deepEqual(townTipOf({ name: 'Ripmarket', p: 50, prev: 51 }).lines, ['Economy: Steady (50/100). Market falling.', 'Shops here ask and pay the region\'s usual prices.'], 'the seats unknown here: no guild line');
  assert.equal(townTipOf({ name: '', p: 50, prev: 50 }), null);
  // a held seat town: the seat's own card follows, its Charter line left out (its holder line names the guild)
  const SIEGE_END = 2_000_007_200;
  const seat = { key: 7, name: 'Anticlere', tier: 'palace', region: 17, holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: 'market-day' },
    battle: { kind: 'siege', guild: { name: 'Ebon Oath', tag: 'EO' }, against: SH, startsAt: 2_000_000_000, endsAt: SIEGE_END, state: 'set' } };
  const before = SIEGE_END * 1000 - 60_000;
  const own = seatTipOf(seat, before);
  const card = townTipOf({ name: 'Anticlere', p: 80, prev: 79, seat, area }, before);
  assert.deepEqual(card.lines, ['Economy: Thriving (80/100). Market rising.', 'Shops here ask 24% less and pay 24% less than the region\'s usual prices.', 'Market Day draws trade.', ...own.lines.slice(1)]);   // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-3)
  assert.match(own.lines[0], /^The Charter of Anticlere: held by/, 'the line left out is the Charter\'s');
  assert.ok(card.lines.some((l) => /A siege is called/.test(l)), 'the seat\'s card on the clock it is given');
  assert.ok(!townTipOf({ name: 'Anticlere', p: 80, prev: 79, seat, area }, SIEGE_END * 1000 + 1).lines.some((l) => /A siege is called/.test(l)), 'a siege over is not called');
  assert.ok(card.lines.length <= TOWN_TIP_LINES_MAX, `${card.lines.length} lines`);
  // AUDIT TOWN-ECON 2 LIV-3: a held seat's full card says no patrons - the line is left where the card has no room for it
  const withPatrons = townTipOf({ name: 'Anticlere', p: 80, prev: 79, seat, area, patrons: [{ id: 'g0000000001', name: 'Iron Wolves', tag: 'IW' }] }, before);
  assert.ok(card.lines.length > TOWN_TIP_PATRONS_ROOM, `the fixture's card is full (${card.lines.length})`);
  assert.deepEqual(withPatrons.lines, card.lines, 'no room, no patrons (mutants: TOWNECON-AUDIT2-LIV3-no-room)');
  assert.ok(card.lines.length > TIP_LINES_MAX, 'more than any other card holds');
  assert.deepEqual(readTip(card, { textMax: SEAT_TIP_TEXT_MAX, linesMax: TOWN_TIP_LINES_MAX }).lines, card.lines, 'read whole');
  assert.equal(TOWN_TIP_LINES_MAX, 7, 'three of the town\'s and a held seat\'s four');
  // an unheld seat keeps its Charter line - nothing else names it
  const unheld = { ...seat, holder: null, battle: null };
  assert.deepEqual(townTipOf({ name: 'Anticlere', p: 50, prev: 50, seat: unheld }, before).lines.slice(2), seatTipOf(unheld, before).lines);
  // CARD-FIT in height: a card taller than a landscape phone is held on it
  assert.match(rd('src/ui/enhanced/enhancedStyle.js'), /\.hmtip \{ position: absolute; z-index: 3; display: none; pointer-events: none; max-width: min\(320px, calc\(100vw \/ var\(--hm-ui, 1\) - 16px\)\);\n\s*max-height: calc\(100vh \/ var\(--hm-ui, 1\) - 16px\); overflow: hidden;/);
});

test('TOWN-ECON the client\'s reading (systems/town/townEcon.js): online only - offline a counter keeps the seat\'s factor on what it asks and no town has a card; a town with no economy has none (a seat there keeps SEAT-TIP\'s own - AUDIT CLI-3); a town reads the law on the host\'s clock (AUDIT LAW-2) with its seat dressed by the real seat book (AUDIT DOC-3), its raid and the players\' share, and its card names the NEAREST seat of its own region (mutants: TOWNECON-offline-runs, TOWNECON-not-a-town, TOWNECON-day, TOWNECON-tipfn-unkept, TOWNECON-AUDIT-CLI3-fallback-seated, TOWNECON-AUDIT-CLI3-seat-card-lost, TOWNECON-AUDIT-CLI3-overworld-seat-lost, TOWNECON-AUDIT-DOC3-seat-unread, TOWNECON-AUDIT-DOC3-bailiwick-any)', async () => {
  const towns = new Map([[11, { name: 'Ripmarket', px: 212, py: 151, region: 17, type: 0 }], [12, { name: 'The Crypt', px: 10, py: 10, region: 17, type: 4 }],
    [13, { name: 'Castle Eight', px: 300, py: 160, region: 17, type: 7 }], [14, { name: 'Anticlere', px: 220, py: 150, region: 17, type: 1 }]]);
  // the seats as the service lists them and the seat book dresses them (net/townSeatBook.js dressed): three seats, two in
  // Ripmarket's region - the nearer one's is the area's - and one in another region nearer still
  const derived = [
    { key: 13, mapId: 13, name: 'Castle Eight', tier: 'palace', region: 17, pixel: [300, 160] },
    { key: 99, mapId: 99, name: 'Elsewhere', tier: 'palace', region: 18, pixel: [213, 151] },
    { key: 14, mapId: 14, name: 'Anticlere', tier: 'palace', region: 17, pixel: [220, 150] },
  ];
  const listed = [
    { key: 14, state: 'confirmed', holder: { guild: SH, since: 3, standing: 80, tithe: 6, edict: 'market-day' } },
    { key: 13, state: 'confirmed', holder: { guild: { id: 'g2', name: 'Ebon Oath', tag: 'EO' }, since: 1, standing: 50, tithe: 2, edict: null } },
    { key: 99, state: 'confirmed', holder: null },
  ];
  let clock = DAY * TOWN_DAY_MS + 3_600_000;
  const book = createTownSeatBook({ door: { list: async () => ({ ok: true, data: { seats: listed } }) }, nowMs: () => clock });
  await book.read();
  const seatOf = (id) => book.dressed(derived.find((s) => s.mapId === id) ?? null);
  let online = true, raided = false, players = 0;
  const econ = createTownEcon({
    online: () => online, townOf: (id) => towns.get(id), seatAt: seatOf, seats: () => derived.map((s) => book.dressed(s)),
    raidedAt: (px, py) => raided && px === 212 && py === 151, nowMs: () => clock, players: (id) => (id === 11 ? players : 0),   // TE2: the share by the town's map id
  });
  assert.equal(econ.prosperityOf(11), townProsperity({ key: KEY, type: 0, day: DAY }));
  assert.equal(econ.prosperityOf(12), null, 'a dungeon has no economy');
  assert.equal(econ.prosperityOf(99), null);
  // a seat town reads its holder's Standing and Edict as the book dressed them
  const anticlere = seatOf(14);
  assert.equal(anticlere.holder.edict, 'market-day');
  assert.equal(econ.prosperityOf(14), townProsperity({ key: townKeyOf(220, 150), type: 1, day: DAY, seat: anticlere }));
  assert.notEqual(econ.prosperityOf(14), townProsperity({ key: townKeyOf(220, 150), type: 1, day: DAY }), 'the seat moved it');
  assert.equal(econ.shopFactor({ townMapId: 11 }, 'Buy', 0.9), townShopFactor(61, 'Buy', 0.9));
  assert.equal(econ.shopFactor({ townMapId: 11 }, 'SellMagic', 0.9), townShopFactor(61, 'Sell', 0.9));
  assert.ok(econ.shopFactor({ townMapId: 11 }, 'Sell', 0.9) < townShopFactor(61, 'Sell'), 'SEAT-LOOP: the seat\'s ask bounds the pay');
  assert.equal(econ.shopFactor({ townMapId: 12 }, 'Buy', 0.9), 0.9, 'no economy: the seat\'s alone on what it asks');
  assert.equal(econ.shopFactor({ townMapId: 12 }, 'SellMagic', 0.9), 0.9, 'SEAT-LOOP: and what it pays never above it');
  assert.equal(econ.shopFactor({ townMapId: 12 }, 'Sell', 1), 1);
  assert.equal(econ.shopFactor({ townMapId: 12 }, 'Identify', 0.9), 1, 'AUDIT CLI-3: a mode that is no trade keeps no seat\'s factor');
  assert.equal(econ.shopFactor(null, 'Sell', 1), 1);
  // the area: Anticlere, the nearer seat of Ripmarket's own region - never Elsewhere, nearer but in another region
  assert.deepEqual(econ.tipAt(11).lines, ['Economy: Steady (61/100). ' + (townTrendWord(61, townProsperity({ key: KEY, type: 0, day: DAY - 1 })) === 'rising' ? 'Market rising.' : townTrendWord(61, townProsperity({ key: KEY, type: 0, day: DAY - 1 })) === 'falling' ? 'Market falling.' : 'Market flat.'),
    townPriceLine(61), 'Under the Charter of Anticlere: held by the Silver Hand <SH>']);
  raided = true; players = 9;
  assert.equal(econ.prosperityOf(11), townProsperity({ key: KEY, type: 0, day: DAY, raided: true, players: 9 }));
  assert.equal(econ.tipAt(11).lines[2], TOWN_REASONS.raid);
  // AUDIT LAW-2: the day is the host's clock's - a day on, another reading
  clock += 3 * TOWN_DAY_MS;
  assert.equal(econ.prosperityOf(11), townProsperity({ key: KEY, type: 0, day: DAY + 3, raided: true, players: 9 }));
  clock -= 3 * TOWN_DAY_MS;
  const f = econ.tipFnAt(11);
  assert.equal(typeof f, 'function');
  assert.equal(econ.tipFnAt(11), f, 'one kept a town');
  assert.deepEqual(f(), econ.tipAt(11));
  assert.equal(econ.tipFnAt(12), null);
  // AUDIT CLI-3: a seat whose place has no economy keeps its own card on both maps
  assert.deepEqual(econ.tipAt(13), seatTipOf(seatOf(13), clock));
  assert.equal(typeof econ.tipFnAt(13), 'function');
  assert.deepEqual(econ.tipFnAt(13)(), seatTipOf(seatOf(13), clock));
  online = false;
  assert.equal(econ.prosperityOf(11), null);
  assert.equal(econ.shopFactor({ townMapId: 11 }, 'Buy', 0.9), 0.9, 'offline the counter is DFU\'s, and the seat\'s');
  assert.equal(econ.shopFactor({ townMapId: 11 }, 'Sell', 1), 1);
  assert.equal(econ.shopFactor({ townMapId: 11 }, 'Sell', 0.9), 0.9, 'SEAT-LOOP: offline too, a seat\'s ask bounds the pay');
  assert.equal(econ.tipAt(11), null);
  assert.equal(econ.tipFnAt(11), null);
  assert.equal(econ.tipAt(13), null);
  // the seats unread: no guild line
  online = true;
  const blind = createTownEcon({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => DAY * TOWN_DAY_MS });
  assert.equal(blind.tipAt(11).lines.length, 2);
});

test('TOWN-ECON the wiring: the counter\'s factor in worldModes.js\'s shopAdjustment (the town\'s first, the seat\'s alone without it), the world host\'s town economy on the relay\'s clock (AUDIT LAW-2) with the seat\'s factor handed in for the law to apply, its card on the Held Map (refreshed under a still pointer - AUDIT UI-6) and the Overworld, a town\'s type in its row (mutants: TOWNECON-counter-unwired, TOWNECON-seat-dropped, TOWNECON-heldmap-unwired, TOWNECON-overworld-seat-only, TOWNECON-type-lost, TOWNECON-unread-seats-empty, TOWNECON-AUDIT-LAW2-machine-clock, TOWNECON-AUDIT-UI6-stale-card, TOWNECON-AUDIT2-PRICE4-fallback-sale)', () => {
  const wm = rd('src/scenes/worldModes.js');
  // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-4): and with no town law wired, a sale held to the seat's factor - SEAT-LOOP's bound
  assert.match(wm, /const f = host\.townShopFactor\?\.\(b, mode\) \?\? \(mode === 'Buy' \|\| mode === 'Repair' \? host\.seatShopFactor\?\.\(b\) \?\? 1 : mode === 'Sell' \|\| mode === 'SellMagic' \? Math\.min\(1, host\.seatShopFactor\?\.\(b\) \?\? 1\) : 1\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /townShopFactor: \(b, mode\) => townEcon\.shopFactor\(b, mode, seatEdicts\.shopFactor\(b\)\),/);
  assert.match(w, /const townEcon = createTownEconHost\(\{ online: isOnlinePage, townOf: \(mapId\) => _townOfMapId\.get\(mapId\), seatAt: seatHere, nowMs: battleNowMs,[^\n]*\n\s*seats: \(\) => \(seatBook\?\.open === true \? seatBook\.data\?\.seats \?\? null : null\),[^\n]*\n\s*raidedAt: \(px, py\) => raidingPartiesOn\(\) && raidState\(\)\.raids\.some\(\(r\) => r\.px === px && r\.py === py && raidActive\(r, worldMinutes\(\)\)\),[^\n]*\n\s*locAt: \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\)\?\.mapTableData \?\? null, portLanes: \(\) => \(_lanesReady && mapDict \? laneNet\(\) : null\) \}\);/);   // TE2: built by its host module (scenes/townEconHost.js); PIN MOVED (SEA-TRADE): the MAPS location a pixel, and the lanes
  assert.match(w, /const battleNowMs = \(\) => Date\.now\(\) \+ _sharedOffsetMs;/, 'the relay\'s clock');
  assert.match(w, /townTipAt: \(summary\) => townEcon\.tipAt\(summary\?\.mapID \?\? summary\?\.mapId\),/);
  assert.match(w, /seaRaidPeerChase, townEcon, state, travelViewBands,/, 'the Overworld\'s marks handed the town economy');
  assert.match(w, /_townOfMapId\.set\(loc\.mapTableData\.mapId >>> 0, \{ name: String\(loc\.name \?\? ''\), px: p\.x, py: p\.y, region: r, type: loc\.mapTableData\.locationType, location: l \}\);/);
  assert.doesNotMatch(w, /seatTipAt/, 'SEAT-TIP\'s seat-only maker is gone: the town\'s card carries its lines');
  const tvm = rd('src/scenes/travelViewMarks.js');
  // AUDIT TOWN-ECON 2 REC-16: each loop its own plate's - a near plate's `p`, a far one's `f`
  // PIN MOVED (OW-FORECAST, 2026-10-19): the card is the town's with the place's weather put first (travelViewMarks.js placeTip)
  assert.match(tvm, /label: p\.summary\.name,[^\n]*tip: placeTip\(townEcon\.tipFnAt\(p\.summary\.mapId\), p\.summary\.name, p\.x, p\.z\) \}\);/, 'a near plate');
  assert.match(tvm, /label: f\.summary\.name,[^\n]*tip: placeTip\(townEcon\.tipFnAt\(f\.summary\.mapId\), f\.summary\.name, f\.x, f\.z\) \}\);/, 'a far one');
  assert.match(tvm, /const base = econ\?\.\(\) \?\? null;/, 'the town\'s own card under the weather');
  const h = rd('src/ui/heldMap.js');
  assert.match(h, /const card = this\.deps\.townTipAt\?\.\(m\.summary\) \?\? \(m\.seat \? seatTipOf\(m\.seat\) : null\);/);
  assert.match(h, /if \(gateMoved\) this\._refreshTip\(\);\n(\s*\/\/[^\n]*\n)*\s*if \(!gateMoved && this\._tipKey && this\._hoverAt\) this\._refreshTip\(\);/, 'AUDIT UI-6: a card showing is asked again at the poll');
  assert.match(rd('src/ui/travel/travelViewHud.js'), /readTip\(typeof tip === 'function' \? tip\(\) : tip, \{ textMax: SEAT_TIP_TEXT_MAX, linesMax: TOWN_TIP_LINES_MAX \}\)/);
});

/** LAW-3's walks run online (tradeModes.js reads the page's own flag). */
const online = (fn) => { const was = globalThis.location; globalThis.location = { search: '?online=1' }; try { return fn(); } finally { globalThis.location = was; } };
const BEST = Object.freeze({ mercantile: 100, personality: 100 });
const seeded = (n) => { let x = n >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); };

test('TOWN-ECON LAW-3 (Town-Economy-Arc 7.4): WHAT THE COUNTER WAS PAID - online a counter\'s Buy marks each piece with its share of the lot\'s price (each piece\'s own ask at one counter, the essentials\' half among them), floored a piece and never more than the lot; offline nothing, no price no number; the item law and the wire carry it, a merge keeps the lower of two and a split keeps it (mutants: TOWNECON-LAW3-paid-unwritten, TOWNECON-LAW3-share-even, TOWNECON-LAW3-merge-higher, TOWNECON-LAW3-split-lost)', () => {
  assert.equal(COUNTER_PAID_MARK, 'counterPaid');
  online(() => {
    const blade = createWeapon(113, 1, seeded(3));
    assert.equal(markCounterBought([blade], { price: 641 }), 1);
    assert.deepEqual([blade[PATRON_COUNTER_MARK], blade[COUNTER_PAID_MARK]], [true, 641]);
    // a lot: each piece its own ask's share - the firewood's half counted as the counter counts it
    const sword = createWeapon(113, 3, seeded(5)), wood = createRestItem(REST_ITEM.Firewood, { stackCount: 5 });
    const asks = [buyItemPrice(sword, { quality: 10 }), buyItemPrice(wood, { quality: 10 })];
    const price = 1000;
    markCounterBought([sword, wood], { price });
    // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-5): a lot that paid a gold a piece gives each piece one, and the rest by the asks
    assert.equal(sword[COUNTER_PAID_MARK], 1 + Math.floor(((price - 6) * asks[0]) / (asks[0] + asks[1])));
    assert.equal(wood[COUNTER_PAID_MARK], 1 + Math.floor(((price - 6) * asks[1]) / (asks[0] + asks[1]) / 5), 'a piece of the stack');
    assert.ok(sword[COUNTER_PAID_MARK] + 5 * wood[COUNTER_PAID_MARK] <= price, 'never more than the lot');
    assert.ok(wood[COUNTER_PAID_MARK] < sword[COUNTER_PAID_MARK] / 5, 'not an even share');
    const unpriced = createWeapon(113, 1, seeded(3));
    markCounterBought([unpriced]);
    assert.deepEqual([unpriced[PATRON_COUNTER_MARK], unpriced[COUNTER_PAID_MARK]], [true, undefined], 'no price, no number');
    // the item law and the wire
    assert.ok(lawfulItem(blade));
    assert.equal(lawfulItem({ ...blade, [COUNTER_PAID_MARK]: -1 }), false);
    assert.equal(lawfulItem({ ...blade, [COUNTER_PAID_MARK]: 2.5 }), false);
    assert.equal(validLootList([blade])?.[0]?.[COUNTER_PAID_MARK], 641, 'the wire carries it');
    // a stack: the lower of two, and a split keeps it
    const a = createRestItem(REST_ITEM.Firewood, { stackCount: 2 }), b = createRestItem(REST_ITEM.Firewood, { stackCount: 3 });
    markCounterBought([a], { price: 20 }); markCounterBought([b], { price: 9 });
    const pack = [a];
    assert.equal(addItem(pack, b), a);
    assert.deepEqual([a.stackCount, a[COUNTER_PAID_MARK]], [5, 3], 'the lower of 10 and 3 a piece');
    const found = createRestItem(REST_ITEM.Firewood, { stackCount: 1 });
    const pack2 = [found];
    addItem(pack2, a);
    assert.equal(found[COUNTER_PAID_MARK], 3, 'a found stack joined by a bought one is held to its price');
    const higher = createRestItem(REST_ITEM.Firewood, { stackCount: 1 });
    markCounterBought([higher], { price: 50 });
    addItem(pack2, higher);
    assert.equal(found[COUNTER_PAID_MARK], 3, 'a dearer piece merged in lifts nothing');
    const picked = splitStack(pack2, found, 2);
    assert.deepEqual([picked[COUNTER_PAID_MARK], found[COUNTER_PAID_MARK]], [3, 3], 'a split keeps it on both halves');
  });
  const off = createWeapon(113, 1, seeded(3));
  assert.equal(markCounterBought([off], { price: 641, online: false }), 0);
  assert.equal(off[COUNTER_PAID_MARK], undefined, 'offline nothing is written');
});

test('TOWN-ECON LAW-3: A COUNTER NEVER PAYS MORE FOR A COUNTER\'S PIECE THAN WAS PAID FOR IT - the lot\'s marked pieces fetch at most their price, the rest of the lot haggled on its own and the whole lot\'s price never passed; where the cap does not bind the price is the uncapped one exactly; a sale of magic too; offline no tally (mutants: TOWNECON-LAW3-cap-off, TOWNECON-LAW3-tally-offline, TOWNECON-LAW3-sellmagic-untallied)', () => {
  online(() => {
    for (const cost of [1, 7, 80, 999, 5000, 40000]) for (const q of [1, 10, 20]) {
      const whole = getTradePrice('Sell', cost, q, BEST);
      assert.equal(getTradePrice('Sell', cost, q, BEST, 0, { cost, paid: whole }), whole, 'the cap at the price: unchanged');
      assert.equal(getTradePrice('Sell', cost, q, BEST, 0, { cost, paid: whole + 50 }), whole);
      assert.equal(getTradePrice('Sell', cost, q, BEST, 0, null), whole);
      if (whole > 1) assert.equal(getTradePrice('Sell', cost, q, BEST, 0, { cost, paid: 1 }), 1, 'held to what it cost');
      assert.ok(getTradePrice('Sell', cost * 2, q, BEST, 0, { cost, paid: 0 }) <= getTradePrice('Sell', cost * 2, q, BEST), 'never past the whole lot');
    }
    const blade = createWeapon(113, 3, seeded(9));
    markCounterBought([blade], { price: 3 });
    const lot = tradeCost('Sell', [blade], { quality: 10, priceAdjustment: 2500 });
    assert.deepEqual(lot.resale, { cost: lot.cost, paid: 3 });
    assert.equal(getTradePrice('Sell', lot.cost, 10, BEST, lot.pieces, lot.resale), 3);
    const magic = tradeCost('SellMagic', [blade], { quality: 10, priceAdjustment: 2500 });
    assert.deepEqual(magic.resale, { cost: magic.cost, paid: 3 }, 'a sale of magic is a sale');
    const plainOne = createWeapon(113, 3, seeded(9));
    assert.equal(tradeCost('Sell', [plainOne], { quality: 10, priceAdjustment: 2500 }).resale, undefined, 'a found piece is the counter\'s to price');
  });
  const blade = createWeapon(113, 3, seeded(9));
  online(() => markCounterBought([blade], { price: 3 }));
  assert.equal(tradeCost('Sell', [blade], { quality: 10, priceAdjustment: 2500, online: false }).resale, undefined, 'offline the save is the player\'s own');
});

test('TOWN-ECON LAW-3: THE CARRY BETWEEN REGIONS NEVER PAYS - a blade, a Daedric dai-katana, five firewood and a potion bought at the cheapest counter (the region\'s index at 500, a Booming town at 100, every shop quality) and sold at the dearest (2,500, a Steady town, every quality), the best haggler, through the real trade walk and the counter\'s own mark; without the cap the same walks paid (mutants: TOWNECON-LAW3-paid-unwritten, TOWNECON-LAW3-cap-off)', () => {
  online(() => {
    const pieces = () => [createWeapon(113, 1, seeded(1)), createWeapon(123, 9, seeded(4)), createRestItem(REST_ITEM.Firewood, { stackCount: 5 }), createPotion(potionRecipeKeys()[0])];
    const buyAdj = Math.round(500 * townShopFactor(100, 'Buy')), sellAdj = 2500;
    const paid = [], uncapped = [];
    for (let k = 0; k < 4; k++) for (let qb = 1; qb <= 20; qb++) {
      const it = pieces()[k];
      const bl = tradeCost('Buy', [it], { quality: qb, priceAdjustment: buyAdj });
      const buy = getTradePrice('Buy', bl.cost, qb, BEST, bl.pieces);
      markCounterBought([it], { price: buy });
      for (let qs = 1; qs <= 20; qs++) {
        const sl = tradeCost('Sell', [it], { quality: qs, priceAdjustment: sellAdj });
        const sell = getTradePrice('Sell', sl.cost, qs, BEST, sl.pieces, sl.resale);
        if (sell > buy) paid.push(`${it.name ?? it.templateIndex} q${qb}->q${qs}: ${buy} -> ${sell}`);
        if (getTradePrice('Sell', sl.cost, qs, BEST, sl.pieces) > buy) uncapped.push(k);
      }
    }
    assert.deepEqual(paid.slice(0, 5), [], `${paid.length} carries pay`);
    assert.ok(uncapped.length > 0, 'the hole: without the cap the carry paid');
    assert.ok(uncapped.includes(2) || uncapped.includes(3), 'an essential\'s half carried too');
  });
});

test('TOWN-ECON LAW-3 the wiring: both doors of a counter\'s Buy hand the mark the lot\'s price, and every sale price the windows and the keyed shelf quote and pay hands the resale tally on (mutants: TOWNECON-LAW3-native-unpassed, TOWNECON-LAW3-enhanced-unpassed, TOWNECON-LAW3-quote-unpassed, TOWNECON-LAW3-keyed-unpassed)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /markCounterBought\(staged, \{ price, \.\.\.asked \}\);/);   // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-1): and the purchase's own holiday and guild
  assert.match(wm, /markCounterBought\(\[it\], \{ price \}\);/);
  assert.match(wm, /const lot = tradeCost\('Sell', \[it\], \{ quality: b\.quality, priceAdjustment: shopAdjustment\(b, 'Sell'\) \}\);\n\s+return getTradePrice\('Sell', lot\.cost, b\.quality, \{\n[^\n]*\n[^\n]*\n\s+\}, lot\.pieces, lot\.resale\);/);
  const nt = rd('src/ui/native/nativeTrade.js');
  assert.match(nt, /const \{ cost, modeActionEnabled, pieces, resale \} = this\.cost\(\);/);
  assert.match(nt, /getTradePrice\(this\.mode, cost, ctx\.quality \?\? 0, ctx\.skills \?\? \{\}, pieces, resale\);/);
  const et = rd('src/ui/enhanced/enhancedTrade.js');
  assert.match(et, /return getTradePrice\(m, lot\.cost, quality, skills, lot\.pieces, lot\.resale\);/);
  assert.match(et, /const \{ cost: c, pieces, resale \} = tradeCost\('Sell', \[item\], ctx\);\n\s+const price = getTradePrice\('Sell', c, ctx\.quality \?\? 0, ctx\.skills \?\? \{\}, pieces, resale\);/);
  assert.match(et, /return getTradePrice\(mode, lot\.cost, ctx\.quality \?\? 0, ctx\.skills \?\? \{\}, lot\.pieces, lot\.resale\);/);   // PIN MOVED (SELL-SHOWN): the lot's price, the footer's and the confirm's one home
  for (const src of [nt, et, wm]) assert.equal((src.match(/getTradePrice\('Sell'|getTradePrice\(this\.mode|getTradePrice\(mode|getTradePrice\(m,/g) ?? []).length, (src.match(/getTradePrice\([^\n]*resale\)|\}, lot\.pieces, lot\.resale\)/g) ?? []).length, 'every sale\'s price');
});

test('TOWN-ECON TE2 the players\' share\'s law (Town-Economy-Arc section 2): the sources, their weights, an account\'s caps a town a day, the decay, the days kept, the half and the most are TE0\'s; a town\'s activity weighs each day\'s acts by source and by the decay, the days kept alone; the share is PLAYERS_MAX x A / (A + HALF), half the most at the half, never the most; a town\'s report is canonical and read back only as written, its map id naming its own pixel (AUDIT TOWN-ECON 2 SVC-1), and an hour\'s reports a walk\'s (mutants: TOWNECON2-weights, TOWNECON2-decay, TOWNECON2-days, TOWNECON2-half, TOWNECON2-share-most, TOWNECON2-report-range, TOWNECON2-report-strict, TOWNECON-AUDIT2-SVC1-pixel-unread, TOWNECON-AUDIT2-SVC1-hour)', () => {
  assert.deepEqual(TOWN_ECON_SOURCES, ['watch', 'trade', 'raid', 'sea']);   // PIN MOVED (SEA-TRADE): a captain's dealing
  assert.deepEqual(TOWN_ECON_WEIGHTS, { watch: 1, trade: 4, raid: 20, sea: 2 });
  assert.deepEqual(TOWN_ECON_CAPS, { watch: 30, trade: 10, raid: 1, sea: 10 });
  assert.deepEqual([TOWN_ECON_DECAY, TOWN_ECON_DAYS, TOWN_ECON_HALF, TOWN_PLAYERS_MAX, TOWN_ECON_KEPT_S, TOWN_ECON_SHARE_LEAST, TOWN_WATCH_CLAIM_MAX, TOWN_WITNESS_KIND, TOWN_WITNESS_HOUR], [0.8, 14, 150, 30, 300, 1, 12, 'town', 12]);   // PIN MOVED (AUDIT TOWN-ECON 2 SVC-1): a walk's reports an hour, not 48
  const t = 1000;
  assert.equal(townActivity([], t), 0);
  assert.equal(townActivity([{ day: t, src: 'watch', n: 30 }, { day: t, src: 'trade', n: 10 }, { day: t, src: 'raid', n: 1 }], t), 30 + 40 + 20, 'a full day of one account');
  assert.equal(townActivity([{ day: t - 1, src: 'trade', n: 5 }], t), 5 * 4 * 0.8);
  assert.ok(Math.abs(townActivity([{ day: t - 13, src: 'raid', n: 1 }], t) - 20 * 0.8 ** 13) < 1e-9, 'the last day kept');
  assert.equal(townActivity([{ day: t - 14, src: 'raid', n: 1 }, { day: t + 1, src: 'raid', n: 1 }, { day: t, src: 'gold', n: 99 }, { day: t, src: 'watch', n: -3 }], t), 0, 'past the days, a day to come, a source not named, nothing counted');
  assert.equal(townPlayersShare(0), 0);
  assert.equal(townPlayersShare(150), 15, 'half the most at the half');
  assert.ok(townPlayersShare(1e9) < TOWN_PLAYERS_MAX && townPlayersShare(1e9) > 29.99, 'a zerg comes no nearer the top');
  assert.equal(townPlayersShare(Infinity), TOWN_PLAYERS_MAX);
  assert.equal(townPlayersShare(NaN), 0);
  assert.equal(townShareShown(12.345), 12.3);
  // the report
  // PIN MOVED (AUDIT TOWN-ECON 2 SVC-1): a map id whose low 20 bits are its pixel's id (y x 1000 + x), as every MAPS row's are
  const MAP = (3 << 20) | (212 * 1000 + 207);
  assert.equal(townPixelIdOf(MAP), 212207);
  assert.equal(townPixelIdOf(0xfff00000 | 212207), 212207, 'unsigned');
  const r = { map: MAP, px: 207, py: 212, region: 17, location: 5 };
  assert.deepEqual(townReportOf(r), r);
  assert.deepEqual(townReportOf({ ...r, map: 212207 }), { ...r, map: 212207 }, 'the high bits its own');
  assert.equal(townReportText(r), `[${MAP},207,212,17,5]`);
  assert.deepEqual(parseTownReport(`[${MAP},207,212,17,5]`), r);
  for (const bad of [{ ...r, map: 0 }, { ...r, map: 2 ** 32 }, { ...r, px: 1000 }, { ...r, py: 500 }, { ...r, region: 62 }, { ...r, location: 10000 }, { ...r, px: 1.5 }, null,
    { ...r, px: 208 }, { ...r, py: 211 }, { ...r, map: MAP + 1 }, { ...r, map: 4000000000 },
    { ...r, px: 1000, map: (3 << 20) | (212 * 1000 + 1000) }]) assert.equal(townReportOf(bad), null, JSON.stringify(bad));   // past the map's edge, whatever its id's bits say
  assert.equal(parseTownReport(`[${MAP}, 207, 212, 17, 5]`), null, 'read back only as written');
  assert.equal(parseTownReport(`[${MAP},207,212,17]`), null);
  assert.equal(parseTownReport('{'), null);
});

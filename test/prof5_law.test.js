// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET'S LAW (src/net/marketLaw.js, professionLaw.js, marksLaw.js,
// nodeLaw.js): 10.2-10.4's numbers - a listing's hours and the thirty, an order's days and the twenty, the prices, the
// units, the hour's postings; the listing fee (1%, rounded up, at least 1), the sales tax (5%, rounded down), the Tithe
// held at nought until SEAT1; the courier (by the load and the road, at least 2) and its time; the road witnessed (a
// hub's pixel confirmed, else the answer most give, else the asker's own); a piece's wear; the median (the middle
// unit's price, weighted) and its seven days' line; the catalogue; the Weavers' counter (Linen 2, Wool 3) and Wool Bolt;
// the ledger's market kinds; the migration's three rebuilds. bible/06-Systems/Professions-Arc.md 26, Appendix B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MARKET_LISTING_S, MARKET_ORDER_S, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, MARKET_UNITS_MAX, MARKET_PRICE_MAX, MARKET_POSTS_MAX,
  MARKET_OPS_MAX, MARKET_WINDOW_S, MARKET_TAX_PCT, MARKET_TITHE_PCT, COURIER, MARKET_MEDIAN_DAYS, MARKET_KEEP_DAYS, WEAR_WHOLE,
  MARKET_VIEWS, CRAFTED_FAMILIES, MARKET_REPORT_MEDIANS, unitsOk, priceOk, wearOk, provenanceOk, listingFee, saleTax, saleTithe,
  sellerGets, hubReport, parseHubReport, hubPixel, roadPixels, courierFee, courierSeconds, wearOf, wearCondition, wearText, medianOf,
  medianLine, medianText, marketCatalogue, marketOpen,
} from '../src/net/marketLaw.js';
import { WEAVERS_STOCK, FURNISHER_STOCK, STOCKS, stockOf, WOOL, NO_PACK_FORM, withdrawable, minedMaterial, STORES_MAX } from '../src/net/professionLaw.js';
import { MARKS_KINDS } from '../src/net/marksLaw.js';
import { material, witnessedFact, pixelReport } from '../src/net/nodeLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const H = 3600, D = 86_400;

test('PROF5 law: the bounds (10.2, 10.3, section 20) - a listing 72 hours, thirty an account; an order 7 days, twenty; a price 1 to 1,000,000 Marks; 1 to a Stores\' 5,000 units; 60 postings and 120 acts an hour; the views and the crafted families; the switch the three together', () => {
  assert.deepEqual([MARKET_LISTING_S, MARKET_ORDER_S, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX], [72 * H, 7 * D, 30, 20]);
  assert.deepEqual([MARKET_PRICE_MAX, MARKET_UNITS_MAX, MARKET_UNITS_MAX === STORES_MAX], [1_000_000, 5000, true]);
  assert.deepEqual([MARKET_POSTS_MAX, MARKET_OPS_MAX, MARKET_WINDOW_S], [60, 120, 3600]);
  assert.deepEqual([priceOk(1), priceOk(1_000_000), priceOk(0), priceOk(1_000_001), priceOk(2.5)], [true, true, false, false, false]);
  assert.deepEqual([unitsOk(1), unitsOk(5000), unitsOk(0), unitsOk(5001)], [true, true, false, false]);
  assert.deepEqual([wearOk(1), wearOk(1000), wearOk(0), wearOk(1001)], [true, true, false, false]);
  assert.deepEqual([provenanceOk('0123456789abcdef'), provenanceOk('0123456789ABCDEF'), provenanceOk('0123')], [true, false, false]);
  // PIN MOVED (FIELD BUGS 2026-10-01, MARKET-ANY): Goods, the pieces listed from packs, after the Auctions
  assert.deepEqual(MARKET_VIEWS.map(([v]) => v), ['materials', 'crafted', 'auctions', 'goods', 'mine', 'orders', 'history']);   // PROF5b: Auctions beside Crafted
  assert.deepEqual(MARKET_VIEWS.map(([, l]) => l), ['Materials', 'Crafted', 'Auctions', 'Goods', 'My listings', 'Orders', 'History'], 'the wireframe\'s row, PROF5b\'s Auctions and MARKET-ANY\'s Goods');
  // PIN MOVED (PROF11): the mason's bench's stonework lists, as the loom's three
  assert.deepEqual(CRAFTED_FAMILIES.map(([f]) => f), ['weapons', 'armour', 'staves', 'bows', 'tools', 'kits', 'furniture', 'leather', 'clothing', 'furnishings', 'stonework', 'dishes', 'jewellery'], 'arrows and the siege works never list (PROF7 moved it: the loom\'s three list; PIN MOVED (PROF9): the fire\'s dishes; PIN MOVED (PROF10): the jeweller\'s pieces)');
  assert.deepEqual([marketOpen(true, true, true), marketOpen(true, true, false), marketOpen(false, true, true), marketOpen(true, false, true)], [true, false, false, false]);
  assert.deepEqual([MARKET_MEDIAN_DAYS, MARKET_KEEP_DAYS, MARKET_REPORT_MEDIANS], [7, 90, 20]);
});

test('PROF5 law: the fees (10.4) - the listing fee 1% of the worth rounded up, at least 1 Mark; the sales tax 5% of the sale rounded down; the Tithe nought until a seat is held; the seller the price less both', () => {
  assert.deepEqual([listingFee(1), listingFee(100), listingFee(101), listingFee(320), listingFee(900), listingFee(1_000_000)], [1, 1, 2, 4, 9, 10_000]);
  assert.deepEqual([MARKET_TAX_PCT, saleTax(1), saleTax(19), saleTax(20), saleTax(200), saleTax(999)], [5, 0, 0, 1, 10, 49]);
  assert.deepEqual([MARKET_TITHE_PCT, saleTithe(1000), saleTithe(1000, 10), saleTithe(1000, 15)], [0, 0, 100, 150]);
  assert.deepEqual([sellerGets(200), sellerGets(1), sellerGets(1000, 10)], [190, 1, 850], 'a one-Mark sale is the seller\'s whole');
});

test('PROF5 law: the courier (10.4) - ceil(ceil(units / 20) x (1 + pixels / 25)), at least 2, by the load and the road; its time 15 minutes and a minute for every 10 pixels begun; the road the straight line between the hubs, rounded', () => {
  assert.deepEqual({ ...COURIER }, { load: 20, pixelsAMark: 25, least: 2, baseS: 900, pixelsAMinute: 10 });
  assert.deepEqual([courierFee(1, 0), courierFee(1, 25), courierFee(20, 25), courierFee(21, 25), courierFee(45, 386), courierFee(5000, 1000)],
    [2, 2, 2, 4, 50, 10_250], '3 x 411 / 25 = 49.32, up; thousands of units across the Bay cost thousands');
  assert.equal(courierFee(1, 26), 3, '1 x (1 + 26/25) = 2.04, up');
  assert.deepEqual([courierSeconds(0), courierSeconds(1), courierSeconds(10), courierSeconds(11), courierSeconds(386)], [900, 960, 960, 1020, 900 + 39 * 60]);
  assert.equal(roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 }), Math.round(Math.hypot(383, 46)));
  assert.equal(roadPixels({ x: 5, y: 5 }, { x: 5, y: 5 }), 0);
});

test('PROF5 law: the road witnessed (SEAT0 3.2) - a hub\'s report "x,y" on MAPS.BSA\'s 1000 x 500; confirmed by three who agree, else the answer most give, else the asker\'s own; the pixels\' law unchanged', () => {
  assert.equal(hubReport(207, 212), '207,212');
  assert.deepEqual([parseHubReport('207,212'), parseHubReport('1000,1'), parseHubReport('1,500'), parseHubReport('x,1'), parseHubReport(null)], [{ x: 207, y: 212 }, null, null, null, null]);
  const row = (account, report, at) => ({ account, report, at });
  assert.deepEqual(hubPixel([row('a', '10,10', 1), row('b', '10,10', 2), row('c', '10,10', 3), row('d', '20,20', 4)]), { x: 10, y: 10, confirmed: true });
  assert.deepEqual(hubPixel([row('a', '10,10', 1), row('b', '20,20', 2), row('c', '20,20', 3)]), { x: 20, y: 20, confirmed: false }, 'unconfirmed: the answer most give');
  assert.deepEqual(hubPixel([], { x: 7, y: 8 }), { x: 7, y: 8, confirmed: false }, 'none: the asker\'s own');
  assert.deepEqual(hubPixel([row('a', '10,10', 1), row('b', '10,10', 2), row('c', '10,10', 3)], { x: 7, y: 8 }), { x: 10, y: 10, confirmed: true }, 'the witnesses over the asker');
  assert.equal(hubPixel([], null), null);
  assert.equal(hubPixel([], { x: 1000, y: 1 }), null, 'a pixel off the map is no answer');
  assert.deepEqual(hubPixel([row('a', 'bad', 1)], { x: 3, y: 4 }), { x: 3, y: 4, confirmed: false }, 'a report out of shape is no report');
  // the pixels' law, the same function: a pixel's report still read as climate and region
  const px = witnessedFact([row('a', pixelReport(231, 17), 1), row('b', pixelReport(231, 17), 2), row('c', pixelReport(231, 17), 3)]);
  assert.deepEqual(px, { state: 'confirmed', climate: 231, region: 17 });
});

test('PROF5 law: a piece\'s wear - its condition over its most in thousandths, at least 1, a whole piece or one with no condition 1,000; a piece minted at that share; "worn to 62%"; the median - the middle unit\'s price, weighted by units, an even count\'s two middle units\' mean; the line of seven days', () => {
  assert.deepEqual([WEAR_WHOLE, wearOf({ maxCondition: 1000, currentCondition: 620 }), wearOf({ maxCondition: 3, currentCondition: 3 }), wearOf({ maxCondition: 100, currentCondition: 0 }), wearOf({})], [1000, 620, 1000, 1, 1000]);
  assert.deepEqual([wearCondition(1000, 620), wearCondition(1000, 1), wearCondition(7, 1000), wearCondition(0, 500), wearCondition(7, 1)], [620, 1, 7, 0, 1], 'never worn to nothing');
  assert.deepEqual([wearText(1000), wearText(620), wearText(1)], [null, 'worn to 62%', 'worn to 1%']);
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([{ price: 8, units: 10 }, { price: 10, units: 11 }]), 10, 'twenty-one units: the eleventh at 10');
  assert.equal(medianOf([{ price: 8, units: 10 }, { price: 10, units: 10 }]), 9, 'twenty: the tenth at 8 and the eleventh at 10');
  assert.equal(medianOf([{ price: 3, units: 1 }, { price: 100, units: 1 }, { price: 5, units: 5 }]), 5, 'sorted by price, weighted');
  assert.equal(medianOf([{ price: 10, units: 1 }, { price: 1, units: 1 }, { price: 5, units: 1 }]), 5, 'the rows sorted first, whatever order the day table gives');
  assert.deepEqual(medianLine([{ day: 100, price: 8, units: 10 }, { day: 101, price: 10, units: 11 }, { day: 90, price: 99, units: 1 }], 101), [null, null, null, null, null, 8, 10]);
  assert.deepEqual([medianText(null), medianText(8), medianText(8.5)], ['-', '8', '8.5']);
});

test('PROF5 law: the catalogue - every registered material, the four foods and every herb the law gives a tier, in the families\' order; Wool Bolt (669, tier 2) registered; the Weavers\' counter Linen 2 and Wool 3 Marks, the furnisher\'s Linen the same; neither withdraws', () => {
  const cat = marketCatalogue();
  assert.ok(cat.every((c) => material(c.key)), 'every one a Stores material');
  assert.equal(new Set(cat.map((c) => c.key)).size, cat.length);
  assert.ok(cat.some((c) => c.family === 'herbs') && cat.some((c) => c.key === 'food:apple') && cat.some((c) => c.key === 'ore:mithril') && cat.some((c) => c.key === 'cloth:wool'));
  assert.deepEqual([...new Set(cat.map((c) => c.family))], ['metals', 'wood', 'herbs', 'hides', 'food', 'stone', 'gems', 'essences', 'siege']);   // SEAT2b part two (PIN MOVED): the Ram Kit, the Siege Works'; PROF12 (PIN MOVED): the Apothecaries' goods and Arcane Essence, the Essences'
  assert.deepEqual({ key: WOOL.key, tier: WOOL.tier, templateIndex: WOOL.templateIndex, name: WOOL.name }, { key: 'cloth:wool', tier: 2, templateIndex: 669, name: 'Wool Bolt' });
  assert.equal(minedMaterial('cloth:wool').family, 'hides');
  assert.deepEqual(WEAVERS_STOCK.map((w) => [w.key, w.marks, w.counter]), [['cloth:linen', 2, 'weavers'], ['cloth:wool', 3, 'weavers']], '4.5\'s own prices');
  assert.deepEqual(FURNISHER_STOCK.map((w) => [w.key, w.marks]), [['cloth:linen', 2]], 'the counters never part');
  assert.equal(stockOf('cloth:wool').marks, 3);
  assert.equal(STOCKS.length, 7 + 16);   // PIN MOVED (PROF12): the Apothecaries' sixteen after them
  assert.deepEqual([NO_PACK_FORM.includes('cloth:wool'), withdrawable('cloth:wool'), withdrawable('cloth:linen')], [false, true, true]);   // PROF7 moved it: the cloth's templates (668-671)
});

test('PROF5 law: the ledger\'s market kinds - the fee, the tax and the courier burnt; a sale, an order\'s escrow, a fill and a return moved; no new faucet; the migration rebuilds the ledger with an escrow end, the witness with a hub, the products without their cascade', () => {
  for (const [k, way] of [['market-fee', 'burn'], ['market-tax', 'burn'], ['courier', 'burn'], ['market-sale', 'move'], ['order-escrow', 'move'], ['order-fill', 'move'], ['order-return', 'move']]) {
    assert.equal(MARKS_KINDS[k], way, k);
  }
  // The faucets are the gate, the writ and the Seats' three (a siege's Honours, an Incursion's second half, a struck
  // seat's fee given back) - none of them the market's. PIN MOVED (SILVER-WAYS): and a raid's, a guild deed's, a Motherlode's
  assert.deepEqual(Object.entries(MARKS_KINDS).filter(([, w]) => w === 'mint').map(([k]) => k),
    ['gate', 'writ', 'siege-honours', 'gate-incursion', 'seat-strike-refund', 'raid', 'guild-deed', 'motherlode'], 'the market strikes no Mark');
  const sql = src('server-account/migrations/0032_market.sql');
  assert.match(sql, /src_kind TEXT NOT NULL CHECK \(src_kind IN \('mint', 'account', 'guild', 'escrow'\)\)/);
  assert.match(sql, /dst_kind TEXT NOT NULL CHECK \(dst_kind IN \('burn', 'account', 'guild', 'escrow'\)\)/);
  assert.equal((sql.match(/CREATE TRIGGER IF NOT EXISTS marks_line_/g) ?? []).length, 4, 'the four triggers made again');
  assert.doesNotMatch(sql, /WHEN NEW\.(src|dst)_kind = 'escrow'/, 'an escrow end moves no balance by trigger');
  assert.match(sql, /kind\s+TEXT NOT NULL CHECK \(kind IN \('pixel', 'dungeon', 'hub'\)\)/);
  const products = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS products_new'), sql.indexOf('INSERT INTO products_new'));
  assert.doesNotMatch(products, /REFERENCES players/, 'a piece outlives its owner\'s account');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_market_piece_open ON market_listings \(provenance\) WHERE state = 'open'/, 'one live listing a piece');
});

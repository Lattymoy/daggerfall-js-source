// LW15 (bible/06-Systems/Living-World-II.md "LW15"): THE PATRONS - the living world's townsfolk buying from a player's
// hired trader. The law both ends read (src/net/patronLaw.js: the odds, the cap at worth, a crafted piece no dearer, the
// town's share, the sellers' ceilings, the hours reckoned); the service's reckoning (server-account/src/market.js
// reckonPatrons: the sales, the gold, the faucet, twice the same, late the same, a private home's trader none, the
// hour's cron) driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs); the
// client's dealing (patrons.js: the buyer named alike, a patron's errand, a browser's), the Vendor page's words and the
// host's seams.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../src/systems/loot.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { seededRng } from '../src/systems/wind.js';
import { itemWorth } from '../src/systems/itemLaw.js';
import { goldSaleOf, MARKET_GOLD_HELD_MAX } from '../src/net/marketLaw.js';
import {
  patronOdds, patronCap, patronDraw, patronSeed, patronMinute, patronHour, patronHours, patronWorth, patronTakes, patronMark, PATRON_PAY_SHARE,
  PATRON_ODDS, PATRON_TOWN_HOUR, PATRON_SELLER_HOUR, PATRON_SELLER_DAY_GOLD, PATRON_RECKON_HOURS, PATRON_HOUR_S, PATRON_KEEPSAKE_TEMPLATE,
} from '../src/net/patronLaw.js';
import { HOUR_JOBS, runCron, CRON_HOUR } from '../server-account/src/cron.js';
import { reckonPatrons } from '../server-account/src/market.js';
import { FAUCET_KINDS } from '../server-account/src/budget.js';
import { patronOf, patronVisits, patronWords, PATRON_STAY_MIN, PATRON_BROWSE_SHARE, PATRON_OPEN_H } from '../src/systems/livingWorld/patrons.js';
import { dayPlan, DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { synthTown } from './lwTown.mjs';

test('LW15 the law: the cap PATRON_PAY_SHARE of worth, the hour\'s odds by how far under it, nothing over it; the draws, the seed and the minute the listing\'s and the hour\'s alone; never a quest\'s piece or a keepsake; a crafted piece no dearer than the piece it was made as (mutants: the share, the odds, the over, the draws, the takes, the crafted)', () => {
  assert.equal(PATRON_PAY_SHARE, 0.6);
  assert.deepEqual(PATRON_ODDS.map((r) => [...r]), [[0.5, 0.25], [0.75, 0.12], [1, 0.05]]);
  assert.deepEqual([0, 0.5, 0.51, 0.75, 0.76, 1, 1.01, -1, NaN].map(patronOdds), [0.25, 0.25, 0.12, 0.12, 0.05, 0.05, 0, 0, 0]);
  assert.deepEqual([patronCap(1000), patronCap(1001), patronCap(-5)], [600, 600, 0]);
  assert.equal(patronDraw('abc', 7), patronDraw('abc', 7));
  assert.notEqual(patronDraw('abc', 7), patronDraw('abc', 8));
  assert.ok(patronMinute('abc', 7) >= 0 && patronMinute('abc', 7) < 60);
  assert.equal(patronSeed('abc', 7) >>> 0, patronSeed('abc', 7));
  assert.equal(patronMark(1001, 42), 'patron:1001:42');
  let n = 0;
  for (let i = 0; i < 4000; i++) if (patronDraw(`l${i}`, 5) < 0.25) n++;
  assert.ok(Math.abs(n / 4000 - 0.25) < 0.03, 'a fair draw');
  assert.equal(patronTakes({ templateIndex: 1 }), true);
  assert.equal(patronTakes({ templateIndex: 1, questItem: true }), false);
  assert.equal(patronTakes({ templateIndex: PATRON_KEEPSAKE_TEMPLATE }), false);
  assert.equal(patronTakes({ templateIndex: 2, livingKeepsake: { id: 'x' } }), false);
  assert.equal(patronTakes(null), false);
  // a crafted piece: its worth no more than the piece it was made as
  const worthOf = (it) => (it.provenance ? 5000 : 0) + (it.value || 0) + 100;
  assert.equal(patronWorth({ value: 900 }, worthOf), 1000, 'a found piece its own');
  assert.equal(patronWorth({ value: 900, provenance: 'p1', quality: 5 }, worthOf), 100, 'a crafted one the plain piece\'s');
});

test('LW15 the hour: the lowest draws under their odds, to PATRON_TOWN_HOUR for the town (the sales already made counted), PATRON_SELLER_HOUR a seller, PATRON_SELLER_DAY_GOLD a seller\'s day; the hours reckoned from the last (or the listing\'s first whole hour) to the last whole one, at most PATRON_RECKON_HOURS (mutants: the town, the seller, the day, the order, the hours)', () => {
  assert.deepEqual([PATRON_TOWN_HOUR, PATRON_SELLER_HOUR, PATRON_SELLER_DAY_GOLD, PATRON_RECKON_HOURS, PATRON_HOUR_S], [4, 2, 20_000, 48, 3600]);
  // a hundred cheap listings of ten sellers: some hour sells the town's four
  const ls = Array.from({ length: 100 }, (_, i) => ({ id: `L${i}`, seller: `s${i % 10}`, price: 10, worth: 1000 }));
  let full = null;
  for (let h = 0; h < 50 && !full; h++) { const s = patronHour(ls, h); if (s.length === PATRON_TOWN_HOUR) full = { h, s }; }
  assert.ok(full, 'a full hour');
  const draws = full.s.map((x) => patronDraw(x.id, full.h));
  assert.deepEqual(draws, [...draws].sort((a, b) => a - b), 'the lowest draws first');
  assert.ok(full.s.every((x) => x.minute === patronMinute(x.id, full.h) && x.seed === patronSeed(x.id, full.h)));
  assert.equal(patronHour(ls, full.h, { sold: 3 }).length, 1, 'the sales already made counted');
  // one seller: two an hour
  const one = Array.from({ length: 60 }, (_, i) => ({ id: `M${i}`, seller: 'eve', price: 10, worth: 1000 }));
  for (let h = 0; h < 30; h++) assert.ok(patronHour(one, h).length <= PATRON_SELLER_HOUR);
  assert.ok([...Array(30)].some((_, h) => patronHour(one, h).length === PATRON_SELLER_HOUR));
  assert.equal(patronHour(one, 3, { sellerHour: new Map([['eve', 2]]) }).length, 0);
  // the day's gold
  const dear = Array.from({ length: 60 }, (_, i) => ({ id: `D${i}`, seller: 'eve', price: 15_000, worth: 50_000 }));
  for (let h = 0; h < 40; h++) assert.ok(patronHour(dear, h).length <= 1, 'one of these a day\'s gold');
  assert.equal(patronHour(dear.slice(0, 1), 0, { sellerDay: new Map([['eve', 6000]]) }).length, 0);
  // the hour's odds by the price under the cap - each listing alone (no ceiling between them)
  const rate = (price) => { let k = 0; for (let i = 0; i < 3000; i++) k += patronHour([{ id: `R${price}.${i}`, seller: `s${i}`, price, worth: 1000 }], 9).length; return k / 3000; };
  for (const [price, odds] of [[300, 0.25], [450, 0.12], [600, 0.05]]) assert.ok(Math.abs(rate(price) - odds) < 0.025, `${price} of 600: ${odds}`);
  // over the cap: never
  assert.deepEqual(patronHour([{ id: 'x', seller: 'a', price: 601, worth: 1000 }], 1), []);
  assert.deepEqual(patronHour([{ id: 'x', seller: 'a', price: 1, worth: 1000, takes: false }], 1), []);
  assert.deepEqual(Array.from({ length: 40 }, (_, i) => patronHour([{ id: `z${i}`, seller: 'a', price: 0, worth: 1000 }], 1)).flat(), [], 'never for nothing');
  assert.deepEqual(Array.from({ length: 40 }, (_, i) => patronHour([{ id: `w${i}`, seller: 'a', price: 1, worth: 1 }], 1)).flat(), [], 'never a worthless piece');
  // the hours
  assert.deepEqual(patronHours(null, 10 * 3600 + 5, 14 * 3600 + 7), [11, 12, 13], 'from its first whole hour');
  assert.deepEqual(patronHours(12, 0, 14 * 3600 + 7), [13]);
  assert.deepEqual(patronHours(13, 0, 14 * 3600 + 7), []);
  assert.equal(patronHours(null, 0, 1000 * 3600).length, PATRON_RECKON_HOURS, 'a month unread: two days');
});

// ─── the service ───
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `lw15-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = (station = null) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });
/** Eight pieces to sell - weapons off the loot tables, each one the loot law stands behind. */
function goods() {
  const out = [];
  for (let seed = 1; out.length < 8 && seed < 200; seed++) {
    const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
    for (const it of items) if (it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE && validLootList([plain(it)])?.[0]) out.push(it);
  }
  return out.slice(0, 8);
}

/** A trader of eight pieces, each under its cap (the last `over` of them over it: never sold). */
async function stand(entry = 'public', over = 0) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const eve = await s.registered('Eve');
  const R = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, items: goods().map(plain), goldPieces: 0 });
  eve.character = R.id; eve.at = R.at;
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1000, ?)`)
    .run(MAP, KEY, eve.id, eve.character, 'Eve', DF, entry, _now);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`)
    .run(MAP, KEY, PIECE, place('vendor'), _now);
  // every piece at the trader, under its cap
  const listed = [];
  while (record(eve).save.items.length) {
    const item = record(eve).save.items[0];
    const cap = patronCap(patronWorth(item, itemWorth));
    const price = listed.length >= 8 - over ? cap + 1 : Math.max(1, Math.floor(cap * 0.45));
    const r = await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'item', item: validLootList([item])?.[0] ?? null, pick: 0, price, hubs: HUBS, rid: rid(), currency: 'gold', realm: eve.at(), vendor: VENDOR }, eve.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    listed.push(r.body.listing.id);
  }
  const read = () => s.call('/v1/market/vendor', { vendor: VENDOR }, eve.secret);
  const sales = () => raw.prepare('SELECT listing, hour, minute, seed, price, gets FROM market_patron_sales ORDER BY listing').all();
  return { ...s, raw, eve, listed, read, sales };
}

const key = (s) => `${s.listing}@${s.hour}:${s.minute}`;
/** The law's own sales for a stand's listings to `nowS` - one seller, one town, hour by hour. */
function law(st, nowS) {
  const ls = st.raw.prepare('SELECT id, seller, price, item, at FROM market_listings ORDER BY id').all()
    .map((r) => ({ id: r.id, seller: r.seller, price: Number(r.price), at: Number(r.at), worth: patronWorth(JSON.parse(r.item), itemWorth) }));
  const gone = new Set(), out = [], dayGold = new Map();
  for (const hour of patronHours(null, Math.min(...ls.map((l) => l.at)), nowS)) {
    const day = Math.floor(hour * 3600 / 86_400);
    const open = ls.filter((l) => !gone.has(l.id) && Math.floor(l.at / 3600) + 1 <= hour);
    for (const sale of patronHour(open, hour, { sellerDay: new Map([[st.eve.id, dayGold.get(day) ?? 0]]) })) {
      gone.add(sale.id); out.push({ listing: sale.id, hour, minute: sale.minute });
      dayGold.set(day, (dayGold.get(day) ?? 0) + sale.price);
    }
  }
  return out.sort((x, y) => (x.listing < y.listing ? -1 : 1)).map(key);
}

test('LW15 the service: an hour\'s patrons at a public trader - the piece sold out of the realm, its gold the seller\'s held (the tax and the fee burnt), the faucet written; the answer tells the patrons (seed and minute, never a person); read again, the same sales; reckoned late, the same as on time; a private home\'s trader sells to none (mutants: the sale, the gold, the faucet, the twice, the late, the door)', async () => {
  _now = T0;
  const a = await stand();
  assert.equal(a.listed.length, 8);
  _now = T0 + 40 * 3600;
  const r1 = await a.read();
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  const sold = a.sales();
  assert.ok(sold.length >= 1, `${sold.length} sold in forty hours`);
  for (const s of sold) {
    assert.equal(s.minute, patronMinute(s.listing, s.hour));
    assert.equal(s.seed, patronSeed(s.listing, s.hour));
    assert.equal(s.gets, goldSaleOf(0, s.price).gets);
    assert.equal(a.raw.prepare('SELECT state FROM market_listings WHERE id = ?').get(s.listing).state, 'sold');
  }
  const held = a.raw.prepare('SELECT gold FROM market_gold WHERE player = ?').get(a.eve.id)?.gold ?? 0;
  assert.equal(held, sold.reduce((x, s) => x + s.gets, 0), 'the seller\'s held gold');
  const fauc = a.raw.prepare("SELECT SUM(gold) AS g, SUM(n) AS n FROM realm_faucets WHERE kind = 'patron'").get();
  assert.deepEqual([fauc.g, fauc.n], [held, sold.length], 'the faucet measured');
  assert.deepEqual(FAUCET_KINDS, ['patron']);
  assert.equal(a.raw.prepare('SELECT COUNT(*) AS n FROM market_deliveries').get().n, 0, 'no delivery: gone from the realm');
  const lastDay = sold.filter((s) => s.hour * 3600 + s.minute * 60 > _now - 86_400);
  assert.ok(Array.isArray(r1.body.patrons) && r1.body.patrons.length === lastDay.length, 'the last day\'s told');
  assert.ok(r1.body.patrons.every((p) => Number.isSafeInteger(p.seed) && Number.isSafeInteger(p.minute) && !('player' in p)));
  assert.equal(r1.body.rows.length, 8 - sold.length, 'the stock less what sold');
  // the hour per town and seller
  const perHour = new Map();
  for (const s of sold) perHour.set(s.hour, (perHour.get(s.hour) ?? 0) + 1);
  assert.ok([...perHour.values()].every((n) => n <= PATRON_SELLER_HOUR));
  // read again: the same
  await a.read();
  assert.deepEqual(a.sales(), sold, 'reckoned twice, sold once');
  // the region's read tells its towns the last day's, each at its trader's house - a trader with nothing left too
  a.raw.prepare('UPDATE market_listings SET state = \'cancelled\' WHERE state = \'open\'').run();
  _now = Math.max(...sold.map((x) => x.hour * 3600 + x.minute * 60)) + 60;   // a minute after the last sale
  const vs = await a.call('/v1/market/vendors', { region: DF }, a.eve.secret);
  assert.equal(vs.status, 200, JSON.stringify(vs.body));
  const told = sold.filter((x) => x.hour * 3600 + x.minute * 60 > _now - 86_400);
  assert.ok(told.length >= 1);
  assert.deepEqual(vs.body.patrons.map((x) => x.listing).sort(), told.map((x) => x.listing).sort(), 'the region\'s last day');
  assert.ok(vs.body.patrons.every((x) => x.buildingKey === KEY && x.map === MAP && Number.isSafeInteger(x.seed)));
  // late equals on time: each the law's own fold over its listings, hour by hour - one read once at forty hours (the
  // reckoning's PATRON_RECKON_HOURS), another every hour
  assert.deepEqual(a.sales().map(key), law(a, T0 + 40 * 3600), 'read late, the law\'s sales');
  _now = T0;
  const b = await stand();
  let toldMost = 0;
  for (let h = 1; h <= 40; h++) {
    _now = T0 + h * 3600;
    const r = await b.read();
    const told = b.sales().filter((x) => x.hour * 3600 + x.minute * 60 > _now - 86_400).length;
    assert.equal(r.body.patrons.length, told, 'each read tells the last day\'s');
    toldMost = Math.max(toldMost, told);
  }
  assert.ok(toldMost > 0);
  assert.deepEqual(b.sales().map(key), law(b, T0 + 40 * 3600), 'read on time, the law\'s sales');
  // a private home: none
  _now = T0;
  const c = await stand('private');
  _now = T0 + 40 * 3600;
  await c.read();
  assert.deepEqual(c.sales(), [], 'a private home\'s trader sells to no patron');
  // the piece taken back between the reckoning's read and its sale: never sold, no gold
  _now = T0;
  const e = await stand();
  _now = T0 + 40 * 3600;
  const racing = { prepare: (/** @type {any[]} */ ...x) => e.env.DB.prepare(...x), batch: (/** @type {any} */ st) => { e.raw.prepare('UPDATE market_listings SET state = \'cancelled\' WHERE state = \'open\'').run(); return e.env.DB.batch(st); } };
  await reckonPatrons({ db: racing, nowS: _now }, { maps: [MAP] });
  assert.deepEqual([e.sales(), e.raw.prepare('SELECT COUNT(*) AS n FROM market_listings WHERE state = \'sold\'').get().n, e.raw.prepare('SELECT COUNT(*) AS n FROM market_gold').get().n], [[], 0, 0], 'taken back: not sold');
  // a seller's held gold at its ceiling: a patron passes the trader by
  _now = T0;
  const d = await stand();
  d.raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, ?)').run(d.eve.id, d.eve.character, MARKET_GOLD_HELD_MAX);
  _now = T0 + 40 * 3600;
  await d.read();
  assert.deepEqual([d.sales(), d.raw.prepare('SELECT COUNT(*) AS n FROM market_listings WHERE state = \'open\'').get().n], [[], 8], 'the purse full: none sold');
});

test('LW15 the hour\'s cron reckons the towns waiting; the Vendor page\'s read names what patrons bought (mutants: the job, the read)', async () => {
  assert.ok(HOUR_JOBS.some(([name]) => name === 'patrons'));
  _now = T0;
  const s = await stand('public', 1);
  _now = T0 + 45 * 3600;
  // the cron alone, its share of a firing spent, goes on from the hour it reached: firing by firing, the law's sales
  const marks = [];
  for (let f = 0; f < 12; f++) {
    await runCron(s.env, { cron: CRON_HOUR, nowS: _now });
    marks.push(s.raw.prepare('SELECT MIN(patron_hour) AS h FROM market_listings WHERE state = \'open\'').get().h);
  }
  assert.ok(marks[0] < Math.floor(_now / 3600) - 1, 'one firing reckons part of forty-five hours');
  assert.equal(marks.at(-1), Math.floor(_now / 3600) - 1, 'and the firings after it the rest');
  const sold = s.sales();
  assert.ok(sold.length >= 1, 'the cron sold');
  assert.deepEqual(sold.map(key), law(s, _now), 'the law\'s sales');
  const mine = await s.call('/v1/market/myvendors', { character: s.eve.character }, s.eve.secret);
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.equal(mine.body.patronSold.length, sold.length);
  assert.ok(mine.body.patronSold.every((p) => p.patron.map === MAP && Number.isSafeInteger(p.patron.seed)));
});

test('LW15 drawn: the seed dealt to one of the town\'s households alike by every reader (never the watch); the day\'s visits each its resident\'s errand to the house\'s door at its minute, PATRON_STAY_MIN long; a browser looks (never buys); the Vendor page\'s words (mutants: the deal, the window, the errand, the browse)', () => {
  const residents = [{ id: 'L1.3', roll: 'h', name: 'Ada Lark' }, { id: 'L1.1', roll: 'h', name: 'Bo Brine' }, { id: 'L1.w0', roll: 'w', guard: true, name: 'Watch' },
    { id: 'L1.0', roll: 't', name: 'A stranger' }, { id: 'L1.2', roll: 'h', guard: true, name: 'A guardsman at home' }];
  assert.equal(patronOf(0, residents).id, 'L1.1', 'in the order of their ids');
  assert.equal(patronOf(1, residents).id, 'L1.3');
  assert.equal(patronOf(2, [...residents].reverse()).id, 'L1.1', 'every reader alike');
  assert.equal(patronOf(5, residents.slice(2)), null, 'never the watch, a visitor or a guardsman');
  const day = 100, D0 = day * DAY_MIN + 240;
  const v = patronVisits([{ door: 7, t: D0 + 600, seed: 1 }, { door: 7, t: D0 - 5, seed: 1 }, { door: 7, t: D0 + DAY_MIN, seed: 1 }], day, residents);
  assert.deepEqual(v, [{ resId: 'L1.3', door: 7, from: D0 + 600, dur: PATRON_STAY_MIN }], 'the day\'s own');
  // a sale in the night: its patron comes in the open hours, at its place in their fold
  assert.deepEqual(PATRON_OPEN_H, [8, 20]);
  const night = patronVisits([{ door: 7, t: day * DAY_MIN + 25 * 60, seed: 0 }, { door: 7, t: day * DAY_MIN + 6 * 60, seed: 0 }, { door: 7, t: day * DAY_MIN + 20 * 60, seed: 0 }], day, residents);
  assert.deepEqual(night.map((x) => x.from - day * DAY_MIN), [13 * 60, 18 * 60, 8 * 60], 'one in the morning comes at one in the afternoon');
  assert.equal(patronWords({ name: 'Ada Lark' }, 'Wayrest'), 'Ada Lark of Wayrest');
  assert.equal(patronWords(null, 'Wayrest'), 'a townsperson of Wayrest');
  // the errand and the browse in a day's plan
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const res = census.find((r) => r.home != null && places.doors.get(r.home) && r.job !== 'guard');
  const house = [...places.doors.values()].find((d) => d !== places.doors.get(res.home));
  const plan = dayPlan(res, places, 200, { mpm: CALENDAR_MPM, errands: [{ at: house, from: 200 * DAY_MIN + 240 + 6 * 60, dur: PATRON_STAY_MIN }] });
  assert.ok(plan.some((e) => e.at === house && e.kind === 'shop'), 'in at the trader\'s house');
  // a keeper at the counter from eight to noon slips out at nine to the trader's, and back to the counter after
  const keeper = census.find((r) => r.job === 'keeper' && r.roll === 'h');
  const workOf = (p) => p.filter((e) => e.kind === 'work');
  const D200 = 200 * DAY_MIN;
  const kHouse = [...places.doors.values()].find((d) => d !== places.doors.get(keeper.home) && !workOf(dayPlan(keeper, places, 200, { mpm: CALENDAR_MPM })).some((e) => e.at === d));
  const kPlan = dayPlan(keeper, places, 200, { mpm: CALENDAR_MPM, errands: [{ at: kHouse, from: D200 + 9 * 60, dur: PATRON_STAY_MIN }] });
  const visit = kPlan.find((e) => e.at === kHouse && e.kind === 'shop');
  assert.deepEqual([visit?.t0, visit?.t1], [D200 + 9 * 60, D200 + 9 * 60 + PATRON_STAY_MIN], 'at its minute, its stay');
  const work = workOf(kPlan), at = (t) => work.some((e) => e.t0 <= D200 + t * 60 && e.t1 > D200 + t * 60);
  assert.deepEqual([8.5, 9.2, 10.5, 15].map(at), [true, false, true, true], 'the counter left and taken up again');
  assert.equal(PATRON_BROWSE_SHARE, 0.1);
  let browsed = 0;
  const shopAt = (p) => p.some((e) => e.at === house && e.kind === 'shop');
  for (let d = 200; d < 300; d++) {
    for (const r of census.slice(0, 30)) {
      const plainDay = dayPlan(r, places, d, { mpm: CALENDAR_MPM });
      if (shopAt(dayPlan(r, places, d, { mpm: CALENDAR_MPM, browse: [house] })) && !shopAt(plainDay)) browsed++;
      assert.deepEqual(dayPlan(r, places, d, { mpm: CALENDAR_MPM, browse: [] }), plainDay, 'a town with no trader plans as ever');
    }
  }
  assert.ok(browsed > 0, 'a browser now and then');
  // and a town with no trader plans as it did before LW15: the digest of these plans as LW14's dayPlan.js laid them (a
  // later slice that changes a day's plan moves it, saying so)
  const h = createHash('sha256');
  for (let d = 200; d < 220; d++) for (const r of census.slice(0, 30)) for (const e of dayPlan(r, places, d, { mpm: CALENDAR_MPM })) h.update(`${e.kind}|${e.at?.key ?? e.at?.kind}|${e.t0}|${e.t1};`);
  assert.equal(h.digest('hex').slice(0, 16), '130ffff561ff4035', 'the plain plans LW14 laid');
  const page = readFileSync(new URL('../src/ui/vendorPage.js', import.meta.url), 'utf8');
  assert.match(page, /const sold = \[\.\.\.\(mine\.sold \?\? \[\]\), \.\.\.\(mine\.patronSold \?\? \[\]\)\]\.sort\(/);
  assert.match(page, /const who = s\.patron \? safe\(\(\) => p\.patronName\?\.\(s\.patron\), null\) : null;/);
  assert.match(page, /\$\{who \? `Sold to \$\{who\} - ` : ''\}/);
});

test('LW15 the host\'s seams: the region\'s patrons read online alone, now and then; each town\'s LivingTown its own; its errands and browsers in a household\'s plan; the Vendor page\'s buyer named (mutants: each seam)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(!params\.has\('online'\) \|\| !marketBook \|\| _livingPatronsBusy \|\| nowS - _livingPatronsAt < PATRON_READ_S\) return;/);
  assert.match(w, /if \(row\.home\?\.entry !== 'public'\) continue;/);
  assert.match(w, /const door = p\.buildingKey;\n\s+if \(!Number\.isSafeInteger\(door\)\) continue;/);
  assert.match(w, /byMap\.get\(p\.map\)\.told\.push\(\{ door, t: skyClassicMinutes\(\(p\.hour \* 3600 \+ p\.minute \* 60\) \* 1000 \+ _sharedOffsetMs\), seed: p\.seed \}\);/);
  assert.match(w, /patronsOf: \(\) => _livingPatrons\.get\(livingTown\.mapId >>> 0\) \?\? null,/);
  assert.match(w, /patronName: \(pt\) => livingPatronName\(pt\),/);
  const lt = readFileSync(new URL('../src/systems/livingWorld/livingTown.js', import.meta.url), 'utf8');
  assert.match(lt, /plan = dayPlan\(res, this\.places, day, \{ mpm: this\.o\.mpm, away, watch: this\._watchSize, bandOf: this\._bandOf, \.\.\.this\._patronsFor\(res, day\) \}\);/);   // PIN MOVED (the merge): CHAP5b's bands beside it
  assert.match(lt, /\(e\.pv \?\? 0\) !== this\._patronV\(\)\)/);
  const m = readFileSync(new URL('../server-account/src/market.js', import.meta.url), 'utf8');
  assert.match(m, /await reckonPatrons\(ctx, \{ maps: \[vend\.map\] \}\)\.catch\(\(\) => null\);/);
  assert.match(m, /await reckonPatrons\(ctx, \{ region \}\)\.catch\(\(\) => null\);/);
  assert.match(m, /await reckonPatrons\(ctx, \{ maps: \[\.\.\.new Set\(traders\.map\(\(v\) => Number\(v\.map_id\)\)\)\] \}\)\.catch\(\(\) => null\);/);
});

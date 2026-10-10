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

import { standService, T0, d1 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../src/systems/loot.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { seededRng } from '../src/systems/wind.js';
import { itemWorth } from '../src/systems/itemLaw.js';
import { goldSaleOf, MARKET_GOLD_HELD_MAX, MARKET_KEEP_DAYS } from '../src/net/marketLaw.js';
import {
  patronOdds, patronCap, patronDraw, patronSeed, patronMinute, patronHour, patronCands, patronHours, patronWorth, patronTakes, patronMark, PATRON_PAY_SHARE,
  PATRON_ODDS, PATRON_TOWN_HOUR, PATRON_SELLER_HOUR, PATRON_SELLER_DAY_GOLD, PATRON_RECKON_HOURS, PATRON_HOUR_S, PATRON_KEEPSAKE_TEMPLATE,
} from '../src/net/patronLaw.js';
import { HOUR_JOBS, runCron, CRON_HOUR } from '../server-account/src/cron.js';
import { reckonPatrons, patronSalt, PATRON_READ_STATEMENTS, PATRON_COUNTS_SQL, PATRON_TOLD_SQL } from '../server-account/src/market.js';
import { FAUCET_KINDS } from '../server-account/src/budget.js';
import { patronOf, patronVisits, patronWords, PATRON_STAY_MIN, PATRON_BROWSE_SHARE, PATRON_OPEN_H, PATRON_DELAY_DAYS } from '../src/systems/livingWorld/patrons.js';
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
  // EXPECTATION MOVED (AUDIT LW-II P2): the record's own price lifts nothing - the judge's floor alone (it was 1000, the
  // value the client wrote counted)
  assert.equal(patronWorth({ value: 900 }, worthOf), 100, 'a found piece its floor, never the price its record names');
  assert.ok(itemWorth({ value: 1e9, templateIndex: 118 }) > 10_000, 'the judge reads a written price up to its ceiling');
  assert.equal(patronWorth({ value: 1e9, templateIndex: 118 }, itemWorth), patronWorth({ value: 60, templateIndex: 118 }, itemWorth), 'a Broadsword written at 1e9 is a Broadsword to a patron');
  assert.equal(patronWorth({ value: 900, provenance: 'p1', quality: 5 }, worthOf), 100, 'a crafted one the plain piece\'s');
  // AUDIT LW-II P10: the draw stirred by the service's secret, before and after (the seed and the minute never)
  assert.equal(patronDraw('abc', 7, ''), patronDraw('abc', 7), 'no secret: the listing\'s and the hour\'s');
  assert.notEqual(patronDraw('abc', 7, '0123456789abcdef'), patronDraw('abc', 7));
  assert.notEqual(patronDraw('abc', 7, '0123456789abcdef'), patronDraw('abc', 7, '0123456789abcdee'), 'its every character');
  assert.notEqual(patronDraw('abc', 7, '0123456789abcdef'), patronDraw('abc', 7, '1123456789abcdef'));
  // before alone, a secret is one 32-bit state a seller's own sales could give away: two secrets of the one state (a
  // birthday search's) - after it as well, still two secrets
  const absorb = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  const [k1, k2] = ['00000000000006acdd2db883d77e2ed1', '0000000000012ff80a9f0e7ac4f58479'];
  assert.equal(absorb(k1), absorb(k2), 'one state');
  assert.ok(Array.from({ length: 20 }, (_, i) => patronDraw(`L${i}`, 7, k1) !== patronDraw(`L${i}`, 7, k2)).every(Boolean), 'two secrets still');
  // AUDIT LW-II P5: the hour's candidates - the hour's draws under their odds, the lowest first, the law's own fold
  const pool = Array.from({ length: 200 }, (_, i) => ({ id: `C${i}`, seller: `s${i % 7}`, price: 10 + (i % 4) * 150, worth: 1000, takes: i % 9 !== 0 }));
  const cands = patronCands(pool, 12, 'k');
  assert.ok(cands.length > 10 && cands.every(({ l, draw }) => l.takes && draw === patronDraw(l.id, 12, 'k') && draw < patronOdds(l.price / patronCap(l.worth))));
  assert.deepEqual(cands.map((c) => c.draw), cands.map((c) => c.draw).sort((a, b) => a - b));
  assert.equal(cands.length, pool.filter((l) => l.takes && patronDraw(l.id, 12, 'k') < patronOdds(l.price / patronCap(l.worth))).length, 'every one');
  assert.deepEqual(patronHour(pool, 12, { salt: 'k' }), patronHour(cands.map((c) => c.l), 12, { salt: 'k' }), 'the hour the candidates\' alone');
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

/** A trader of eight pieces, each under its cap (the last `over` of them over it: never sold) - or `items`, each listed at
 *  `priceOf` its record. */
async function stand(entry = 'public', over = 0, { items = goods().map(plain), priceOf = null } = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const eve = await s.registered('Eve');
  const R = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, items, goldPieces: 0 });
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
    const price = priceOf ? priceOf(item) : listed.length >= 8 - over ? cap + 1 : Math.max(1, Math.floor(cap * 0.45));
    const r = await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'item', item: validLootList([item])?.[0] ?? null, pick: 0, price, hubs: HUBS, rid: rid(), currency: 'gold', realm: eve.at(), vendor: VENDOR }, eve.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    listed.push(r.body.listing.id);
  }
  const read = () => s.call('/v1/market/vendor', { vendor: VENDOR }, eve.secret);
  const sales = () => raw.prepare('SELECT listing, hour, minute, seed, price, gets FROM market_patron_sales ORDER BY listing').all();
  return { ...s, raw, eve, listed, read, sales, salt: await patronSalt(s.env) };   // AUDIT LW-II P10: the service's dice
}

const key = (s) => `${s.listing}@${s.hour}:${s.minute}`;
/** The law's own sales for a stand's listings to `nowS` - one town, hour by hour, each seller's day its own - under the
 *  service's secret (`salt`: AUDIT LW-II P10; '' the public dice). */
function law(st, nowS, salt = st.salt) {
  const ls = st.raw.prepare('SELECT id, seller, price, item, at FROM market_listings ORDER BY id').all()
    .map((r) => ({ id: r.id, seller: r.seller, price: Number(r.price), at: Number(r.at), worth: patronWorth(JSON.parse(r.item), itemWorth) }));
  const gone = new Set(), out = [], dayGold = new Map();
  for (const hour of patronHours(null, Math.min(...ls.map((l) => l.at)), nowS)) {
    const day = Math.floor(hour * 3600 / 86_400);
    const open = ls.filter((l) => !gone.has(l.id) && Math.floor(l.at / 3600) + 1 <= hour);
    const sellerDay = new Map(open.map((l) => [l.seller, dayGold.get(`${l.seller}:${day}`) ?? 0]));
    for (const sale of patronHour(open, hour, { sellerDay, salt })) {
      gone.add(sale.id); out.push({ listing: sale.id, hour, minute: sale.minute });
      dayGold.set(`${sale.seller}:${day}`, (dayGold.get(`${sale.seller}:${day}`) ?? 0) + sale.price);
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
  await reckonPatrons({ db: racing, nowS: _now }, { maps: [MAP] }, e.env);
  assert.deepEqual([e.sales(), e.raw.prepare('SELECT COUNT(*) AS n FROM market_listings WHERE state = \'sold\'').get().n, e.raw.prepare('SELECT COUNT(*) AS n FROM market_gold').get().n], [[], 0, 0], 'taken back: not sold');
  // a seller's held gold at its ceiling: a patron passes the trader by
  _now = T0;
  const d = await stand();
  d.raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, ?)').run(d.eve.id, d.eve.character, MARKET_GOLD_HELD_MAX);
  _now = T0 + 40 * 3600;
  await d.read();
  assert.deepEqual([d.sales(), d.raw.prepare('SELECT COUNT(*) AS n FROM market_listings WHERE state = \'open\'').get().n], [[], 8], 'the purse full: none sold');
  // AUDIT LW-II P11: the guard's own refusal is the patron passing by - the hours reckoned, never asked again (read by
  // read: AUDIT LW-II P5, each read's share of statements - a refused sale's batch counts as a sale's)
  for (let i = 0; i < 3; i++) await d.read();
  assert.deepEqual([d.sales(), d.raw.prepare('SELECT DISTINCT patron_hour AS h FROM market_listings').all().map((r) => r.h)], [[], [Math.floor(_now / 3600) - 1]], 'and its hours passed by');
});

test('LW15 the hour\'s cron reckons the towns waiting; the Vendor page\'s read names what patrons bought (mutants: the job, the read)', async () => {
  assert.ok(HOUR_JOBS.some(([name]) => name === 'patrons'));
  _now = T0;
  const s = await stand('public', 1);
  // EXPECTATION MOVED (AUDIT LW-II P5): an hour no piece draws under its odds asks nothing now, so eight pieces' forty-five
  // hours fit one firing's share - twenty more of Eve's at the trader, so the share is spent again
  const more = goods();
  for (let i = 0; i < 20; i++) {
    const item = plain(validLootList([plain(more[i % more.length])])[0]);
    s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, vendor_map, vendor_id)
      VALUES (?, ?, ?, ?, 'item', 1, 1, 0, ?, 1, ?, ?, ?, ?, 'gold', ?, ?, ?)`).run(`cron${String(i).padStart(4, '0')}`, s.eve.id, s.eve.character, DF,
      Math.max(1, Math.floor(patronCap(patronWorth(item, itemWorth)) * 0.45)), _now, _now + 30 * 86_400, `rid-cron${i}`, `n-cron${i}`, JSON.stringify(item), MAP, PIECE);
  }
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
  // PIN MOVED (AUDIT LW-II B1): a sale is walked PATRON_DELAY_DAYS living days after its own - online a living day is a
  // real hour, and a reader learns of a sale only after its whole hour (its own day) is gone
  assert.equal(PATRON_DELAY_DAYS, 2);
  const day = 100, D0 = day * DAY_MIN + 240, S = PATRON_DELAY_DAYS * DAY_MIN;
  const v = patronVisits([{ door: 7, t: D0 - S + 600, seed: 1 }, { door: 7, t: D0 - S - 5, seed: 1 }, { door: 7, t: D0 - S + DAY_MIN, seed: 1 }], day, residents);
  assert.deepEqual(v, [{ resId: 'L1.3', door: 7, from: D0 + 600, dur: PATRON_STAY_MIN }], 'a sale two days before, walked today');
  assert.deepEqual(patronVisits([{ door: 7, t: D0 + 600, seed: 1 }], day, residents), [], 'today\'s own sale: walked two days on');
  // a sale outside the open hours: its patron comes in them, at its place in their fold - PIN MOVED (AUDIT LW-II B2): nine to five
  assert.deepEqual(PATRON_OPEN_H, [9, 17]);
  const night = patronVisits([{ door: 7, t: day * DAY_MIN - S + 25 * 60, seed: 0 }, { door: 7, t: day * DAY_MIN - S + 6 * 60, seed: 0 }, { door: 7, t: day * DAY_MIN - S + 20 * 60, seed: 0 }], day, residents);
  assert.deepEqual(night.map((x) => x.from - day * DAY_MIN), [9 * 60, 14 * 60, 12 * 60], 'one in the morning comes at nine');
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
  assert.match(w, /byMap\.get\(p\.map\)\.told\.push\(\{ door, t: skyClassicMinutes\(\(p\.hour \* 3600 \+ p\.minute \* 60\) \* 1000\), seed: p\.seed \}\);/);   // PIN MOVED (AUDIT LW-II B5): the service's instant, no machine offset
  // AUDIT LW-II B6/B7: one order for every reader, a version moved only by a change, a town with nothing now forgotten
  assert.match(w, /const told = e\.told\.sort\(\(a, b\) => a\.t - b\.t \|\| a\.seed - b\.seed \|\| a\.door - b\.door\);\n\s+const traders = \[\.\.\.e\.traders\]\.sort\(\(a, b\) => a - b\);/);
  assert.match(w, /if \(_livingPatrons\.get\(map\)\?\.sig === sig\) continue;/);
  assert.match(w, /for \(const \[map, e\] of _livingPatrons\) if \(e\.region === region && !byMap\.has\(map\)\) _livingPatrons\.delete\(map\);/);
  assert.match(w, /return patronWords\(lt \? lt\.patronOfSale\(pt\.seed, t\) : null,/);   // AUDIT LW-II B12
  assert.match(w, /patronsOf: \(\) => _livingPatrons\.get\(livingTown\.mapId >>> 0\) \?\? null,/);
  assert.match(w, /patronName: \(pt\) => livingPatronName\(pt\),/);
  const lt = readFileSync(new URL('../src/systems/livingWorld/livingTown.js', import.meta.url), 'utf8');
  assert.match(lt, /plan = dayPlan\(res, this\.places, day, \{ mpm: this\.o\.mpm, away, watch: this\._watchSize, bandOf: this\._bandOf, \.\.\.this\._patronsFor\(res, day\) \}\);/);   // PIN MOVED (the merge): CHAP5b's bands beside it
  assert.match(lt, /\(e\.pv \?\? 0\) !== this\._patronV\(\)\)/);
  const m = readFileSync(new URL('../server-account/src/market.js', import.meta.url), 'utf8');
  // PIN MOVED (AUDIT LW-II P10): each read hands the reckoning the service's env - its secret, the draw's
  assert.match(m, /await reckonPatrons\(ctx, \{ maps: \[vend\.map\] \}, env\)\.catch\(\(\) => null\);/);
  assert.match(m, /await reckonPatrons\(ctx, \{ region \}, env\)\.catch\(\(\) => null\);/);
  assert.match(m, /await reckonPatrons\(ctx, \{ maps: \[\.\.\.new Set\(traders\.map\(\(v\) => Number\(v\.map_id\)\)\)\] \}, env\)\.catch\(\(\) => null\);/);
});

// ─── AUDIT LW-II (2026-10-10): the service's findings, each through the real Worker over node:sqlite ───

/** Weapons off the loot tables in the market's wire form, each one the loot law stands behind - a patron paying at least
 *  `minCap` for each. */
function loot(n, { minCap = 1 } = {}) {
  const out = [];
  for (let seed = 1; out.length < n && seed < 3000; seed++) {
    const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
    for (const it of items) {
      const rec = it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE ? validLootList([plain(it)])?.[0] : null;
      if (rec && patronCap(patronWorth(rec, itemWorth)) >= minCap) out.push(plain(rec));
    }
  }
  return out.slice(0, n);
}
/** A service whose traders are laid in by hand - a home, its trader, its listings - for many towns and sellers. */
async function rawStand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  let n = 0;
  const home = (who, map, key, { entry = 'public', id = `t${map}k${key}` } = {}) => {
    raw.prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1000, ?)')
      .run(map, key, who.id, who.character, who.handle, DF, entry, _now);
    raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)')
      .run(map, key, id, place('vendor'), _now);
    return { map, id };
  };
  /** A listing at `vendor` at `share` of the piece's cap (past 1: over it, never sold). */
  const list = (who, vendor, item, share = 0.45) => {
    const id = `A${String(++n).padStart(8, '0')}`;
    const price = Math.min(1_000_000, Math.max(1, Math.floor(patronCap(patronWorth(item, itemWorth)) * share)));
    raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, vendor_map, vendor_id)
      VALUES (?, ?, ?, ?, 'item', 1, 1, 0, ?, 1, ?, ?, ?, ?, 'gold', ?, ?, ?)`)
      .run(id, who.id, who.character, DF, price, _now, _now + 30 * 86_400, `rid-${id}`, `n-${id}`, JSON.stringify(item), vendor.map, vendor.id);
    return id;
  };
  const sales = () => raw.prepare('SELECT * FROM market_patron_sales ORDER BY hour, listing').all();
  const marks = (map) => raw.prepare('SELECT DISTINCT patron_hour AS h FROM market_listings WHERE vendor_map = ? AND state = \'open\' ORDER BY h').all(map).map((r) => r.h);
  return { ...s, raw, home, list, sales, marks, salt: await patronSalt(s.env) };
}
/** The database answering after a round trip (D1's), so reads that start together run together. */
function latent(db) {
  const tick = () => new Promise((r) => setImmediate(r));
  return {
    _raw: db._raw,
    prepare(sql) {
      const st = db.prepare(sql);
      const api = {
        bind(...a) { st.bind(...a); return api; },
        async first() { await tick(); return st.first(); },
        async all() { await tick(); return st.all(); },
        async run() { await tick(); return st.run(); },
        _result() { return st._result(); },
      };
      return api;
    },
    async batch(list) { await tick(); return db.batch(list); },
  };
}
/** Every statement the service prepares from here (`n`), and its writes (`w`). */
function counted(s) {
  const tally = { n: 0, w: 0 };
  const real = s.env.DB;
  s.env.DB = new Proxy(real, { get(t, k) {
    if (k === 'prepare') return (sql) => { tally.n++; if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) tally.w++; return t.prepare(sql); };
    const v = Reflect.get(t, k);
    return typeof v === 'function' ? v.bind(t) : v;
  } });
  return tally;
}
const hourOf = (k) => Number(k.split('@')[1].split(':')[0]);
/** Another reckoning's sale, landed. */
const fakeSale = (raw, row) => raw.prepare(`INSERT INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day)
  VALUES (?, ?, ?, 0, 0, ?, 'race', ${DF}, ?, 0, 0, ?, ?, ?)`).run(row.listing, row.map, row.hour, row.seller, row.price ?? 1, row.price ?? 1, row.hour * 3600, Math.floor(row.hour / 24));

test('AUDIT LW-II P1: THE CEILINGS HELD IN THE WRITE - a seller\'s six towns read at once, each read\'s reckoning answering after the database\'s round trip: never more than PATRON_SELLER_HOUR of its pieces an hour, nor PATRON_SELLER_DAY_GOLD a day (read before the write, they were twelve an hour and 48,337 a day); and another reckoning\'s sales landing between an hour\'s counts and its write - filling the town\'s hour, the seller\'s hour, the seller\'s day - refuse it (mutants: the town, the seller\'s hour, the seller\'s day)', async () => {
  _now = T0;
  const s = await rawStand();
  s.env.DB = latent(s.env.DB);
  const eve = await s.registered('Eve');
  const [mace] = loot(1, { minCap: 2000 });
  assert.ok(mace, 'a dear piece');
  const vs = [2001, 2002, 2003, 2004, 2005, 2006].map((map) => s.home(eve, map, 10));
  for (const v of vs) for (let i = 0; i < 30; i++) s.list(eve, v, mace);
  _now = T0 + 40 * 3600 + 1;
  for (let round = 0; round < 4; round++) {
    const rs = await Promise.all(vs.map((v) => s.call('/v1/market/vendor', { vendor: v }, eve.secret)));
    assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200, 200, 200]);
  }
  const perHour = s.raw.prepare('SELECT MAX(n) AS n FROM (SELECT COUNT(*) AS n FROM market_patron_sales WHERE seller = ? GROUP BY hour)').get(eve.id).n;
  const perDay = s.raw.prepare('SELECT MAX(g) AS g FROM (SELECT SUM(price) AS g FROM market_patron_sales WHERE seller = ? GROUP BY day)').get(eve.id).g;
  assert.ok(s.sales().length >= 10, `${s.sales().length} sold`);
  assert.equal(perHour, PATRON_SELLER_HOUR, 'the seller\'s hour, its six towns together');
  assert.ok(perDay <= PATRON_SELLER_DAY_GOLD && perDay > PATRON_SELLER_DAY_GOLD / 2, `the seller's day: ${perDay}`);
  // another reckoning's sales landing between the hour's counts and the write: refused in the write
  const raced = async (rows) => {
    _now = T0;
    const t = await rawStand();
    const eve2 = await t.registered('Eve'), bob = await t.registered('Bob');
    const v = t.home(eve2, 3001, 10);
    for (const it of loot(10)) t.list(eve2, v, it);
    _now = T0 + 30 * 3600;
    const H = Math.min(...law(t, _now).map(hourOf));
    let fired = false;
    const racing = { prepare: (/** @type {any[]} */ ...x) => t.env.DB.prepare(...x), batch: (/** @type {any} */ st) => {
      if (!fired) { fired = true; for (const r of rows({ eve: eve2.id, bob: bob.id, H })) fakeSale(t.raw, r); }
      return t.env.DB.batch(st);
    } };
    await reckonPatrons({ db: racing, nowS: _now }, { maps: [3001] }, t.env);
    return t.sales().filter((x) => x.hour === H && x.char_id !== 'race').length;
  };
  assert.ok(await raced(() => []) >= 1, 'unraced, the hour sells');
  assert.equal(await raced(({ bob, H }) => [0, 1, 2, 3].map((i) => ({ listing: `race-t${i}`, map: 3001, hour: H, seller: bob }))), 0, 'the town\'s hour filled between');
  assert.equal(await raced(({ eve, H }) => [0, 1].map((i) => ({ listing: `race-s${i}`, map: 9999, hour: H, seller: eve }))), 0, 'the seller\'s hour filled elsewhere');
  assert.equal(await raced(({ eve, H }) => [{ listing: 'race-d', map: 9999, hour: H, seller: eve, price: PATRON_SELLER_DAY_GOLD }]), 0, 'the seller\'s day spent elsewhere');
});

test('AUDIT LW-II P2-P4: WHAT A PATRON TAKES - a piece at the worth the service judges it, never the price its record names (eight Broadswords written at 1e9, listed through the real route at their written worth\'s price, never sell); the item law read again, as a buy reads it (a piece it refuses, or one the market\'s own law refuses, never sells); never a seller the judge holds, nor one no checkpoint has judged (mutants: the floor, the law, the market\'s law, the hold, the unjudged)', async () => {
  // the forged price: the record's value 1e9, read by the judge up to its ceiling - a patron's cap of 7,104 for a sword of 36
  _now = T0;
  const sword = loot(2)[1];
  const forged = { ...sword, value: 1e9 };
  const f = await stand('public', 0, { items: Array.from({ length: 8 }, () => ({ ...forged })), priceOf: (it) => Math.floor(patronCap(itemWorth(it)) * 0.45) });
  assert.equal(f.listed.length, 8);
  assert.ok(f.raw.prepare('SELECT price, item FROM market_listings').all().every((r) => JSON.parse(r.item).value === 1e9 && r.price > 3 * patronCap(patronWorth(sword, itemWorth))), 'listed at the written worth');
  _now = T0 + 40 * 3600;
  assert.equal((await f.read()).status, 200);
  assert.deepEqual(f.sales(), [], 'the written price buys nothing');
  // the item law's and the market's own refusals, beside honest pieces in the one town
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve');
  const v = s.home(eve, 3101, 10);
  const kinds = new Map();
  for (let i = 0; i < 4; i++) {
    kinds.set(s.list(eve, v, { ...sword, magic: true }), 'unlawful');   // itemLaw.js lawfulItem: no MAGIC.DEF price a client wrote
    kinds.set(s.list(eve, v, { ...sword, locked: true }), 'refused');   // marketLaw.js goodRefusal: 'locked'
    kinds.set(s.list(eve, v, sword), 'honest');
  }
  _now = T0 + 40 * 3600;
  assert.equal((await s.call('/v1/market/vendor', { vendor: v }, eve.secret)).status, 200);
  assert.deepEqual([...new Set(s.sales().map((x) => kinds.get(x.listing)))], ['honest'], 'the honest pieces alone');
  // a seller the judge holds, and one no checkpoint has judged
  for (const [col, val] of [['held', 'law'], ['judged_seq', null]]) {
    _now = T0;
    const h = await stand();
    h.raw.prepare(`UPDATE realm_characters SET ${col} = ? WHERE id = ?`).run(val, h.eve.character);
    _now = T0 + 40 * 3600;
    for (let i = 0; i < 3; i++) await h.read();
    assert.deepEqual([h.sales(), h.raw.prepare('SELECT COUNT(*) AS n FROM market_gold').get().n], [[], 0], `${col}: no patron buys`);
    assert.deepEqual(h.raw.prepare('SELECT DISTINCT patron_hour AS h FROM market_listings').all().map((r) => r.h), [Math.floor(_now / 3600) - 1], `${col}: its hours passed by`);
  }
});

test('AUDIT LW-II P5: A READ\'S RECKONING BOUNDED - the law\'s dice asked before the database (thirty towns two days behind, priced past every cap: two statements a town, where it was thousands); PATRON_READ_STATEMENTS a read, the rest the next read\'s (ninety pieces two days behind: partial, then the law\'s sales whole); a read in an hour already reckoned writes nothing; the hour\'s cron the towns waiting longest first (forty towns, every one reckoned within four firings) (mutants: the dice first, the read\'s share, the mark moved, the order)', async () => {
  assert.equal(PATRON_READ_STATEMENTS, 200);
  _now = T0;
  const a = await rawStand();
  const sellers = [await a.registered('Ann'), await a.registered('Bea'), await a.registered('Cal')];
  const items = loot(5);
  const towns = Array.from({ length: 30 }, (_, i) => 5000 + i);
  for (const map of towns) sellers.forEach((p, j) => { const v = a.home(p, map, 10 + j); for (const it of items) a.list(p, v, it, 2); });
  const reader = await a.registered('Reader');
  _now = T0 + 50 * 3600;
  const tally = counted(a);
  assert.equal((await a.call('/v1/market/vendors', { region: DF }, reader.secret)).status, 200);
  assert.ok(tally.n <= 2 * towns.length + 10, `a region two days behind: ${tally.n} statements`);
  assert.deepEqual([...new Set(towns.flatMap((m) => a.marks(m)))], [Math.floor(_now / 3600) - 1], 'every town reckoned through');
  tally.n = 0; tally.w = 0;
  assert.equal((await a.call('/v1/market/vendor', { vendor: { map: towns[0], id: `t${towns[0]}k10` } }, reader.secret)).status, 200);
  assert.equal(tally.w, 0, 'reckoned already: nothing written');
  // ninety pieces two days behind: one read's share, then the next's - the law's sales
  _now = T0;
  const b = await rawStand();
  const three = [await b.registered('Ann'), await b.registered('Bea'), await b.registered('Cal')];
  const bv = three.map((p, j) => b.home(p, 5101, 10 + j));
  const cheap = loot(30);
  three.forEach((p, j) => { for (const it of cheap) b.list(p, bv[j], it); });
  _now = T0 + 40 * 3600;
  const bt = counted(b);
  assert.equal((await b.call('/v1/market/vendor', { vendor: bv[0] }, three[0].secret)).status, 200);
  assert.ok(bt.n <= PATRON_READ_STATEMENTS + 1 + PATRON_TOWN_HOUR * 5 + 10, `one read: ${bt.n} statements`);
  assert.ok(b.marks(5101)[0] < Math.floor(_now / 3600) - 1, 'partial');
  for (let i = 0; i < 8 && b.marks(5101).some((h) => h !== Math.floor(_now / 3600) - 1); i++) await b.call('/v1/market/vendor', { vendor: bv[i % 3] }, three[0].secret);
  assert.ok(b.marks(5101).every((h) => h === Math.floor(_now / 3600) - 1), 'read by read, reckoned through (what is left)');
  assert.ok(b.sales().length > 40);
  assert.deepEqual(b.sales().map(key).sort(), law(b, _now), 'the law\'s sales, whole');
  // the hour's cron: the towns waiting longest first
  _now = T0;
  const c = await rawStand();
  const cal = await c.registered('Cal');
  const many = Array.from({ length: 40 }, (_, i) => 7000 + i);
  for (const map of many) { const v = c.home(cal, map, 10); for (const it of items.slice(0, 3)) c.list(cal, v, it, 2); }
  for (let f = 0; f < 4; f++) await runCron(c.env, { cron: CRON_HOUR, nowS: T0 + (2 + f) * 3600 + 41 * 60 });
  assert.deepEqual(many.filter((m) => c.marks(m).includes(null)), [], 'every town reckoned');
});

test('AUDIT LW-II P6, P9: THE SALES KEPT AND TOLD - each sale told once, at the house its trader stood in, though another\'s piece of the same id stands in the same town (it was told twice, once at the other\'s door); pruned with the market\'s history (MARKET_KEEP_DAYS); the region\'s read, the hour\'s counts (by the day) and the prune each by an index of its own (mutants: the told by the piece\'s id, the house kept, the prune, the indexes, the counts by the day)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve'), mal = await s.registered('Mallory');
  const v = s.home(eve, 9001, 10, { id: 'evetrader01' });
  s.home(mal, 9001, 77, { entry: 'private', id: 'evetrader01' });
  for (const it of loot(10)) s.list(eve, v, it);
  _now = T0 + 20 * 3600;
  const r = await s.call('/v1/market/vendors', { region: DF }, mal.secret);
  assert.equal(r.status, 200);
  const sold = s.sales();
  assert.ok(sold.length >= 1);
  assert.deepEqual(r.body.patrons.map((p) => p.listing).sort(), sold.filter((x) => x.at > _now - 86_400).map((x) => x.listing).sort(), 'each told once');
  assert.deepEqual([...new Set(r.body.patrons.map((p) => p.buildingKey))], [10], 'at Eve\'s door');
  assert.deepEqual([...new Set(sold.map((x) => x.building_key))], [10], 'the house kept with the sale');
  // kept with the market's history, and no longer
  _now = T0 + (MARKET_KEEP_DAYS + 2) * 86_400;
  await runCron(s.env, { cron: CRON_HOUR, nowS: _now });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM market_patron_sales').get().n, 0, 'pruned past the keep');
  // each read by an index of its own
  const db = d1()._raw;
  const plan = (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((x) => x.detail).join(' | ');
  assert.match(plan(PATRON_TOLD_SQL('s.region = ?2')), /SEARCH s USING INDEX idx_patron_sales_region \(region=\? AND at>\?\)/);
  assert.match(plan(PATRON_COUNTS_SQL), /idx_patron_sales_town \(map=\? AND hour=\?\).*idx_patron_sales_seller \(seller=\? AND day=\?\)/);
  assert.match(plan('SELECT rowid FROM market_patron_sales WHERE day < ?1 LIMIT ?2'), /idx_patron_sales_day \(day<\?\)/);
});

test('AUDIT LW-II P7: A DOOR OPENED OPENS ITS TRADER FROM NOW - set public through /v1/homes/entry, its listings\' hours to the last whole one are reckoned none (twenty pieces stocked behind a private door sold, at its opening, all in the hours before it); a door already open set open again leaves its hours to reckon; a town whose traders all stand behind shut doors is marked as it is read, so no backlog waits for a door (mutants: the door marks, only a door that opens, the shut town marked)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve');
  const shut = s.home(eve, 6001, 10, { entry: 'private' });
  for (const it of loot(20)) s.list(eve, shut, it);
  _now = T0 + 30 * 3600 + 600;
  const opened = Math.floor(_now / 3600);
  const e = await s.call('/v1/homes/entry', { mapId: 6001, buildingKey: 10, entry: 'public' }, eve.secret);
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.deepEqual(s.marks(6001), [opened], 'its hours to the one it opens in');   // PIN MOVED (AUDIT LW-II-2 S4): to the hour it opens IN - opened at :59, the hour before was paid whole
  _now = T0 + 40 * 3600;
  await s.call('/v1/market/vendor', { vendor: shut }, eve.secret);
  assert.ok(s.sales().length >= 1, 'open, it sells');
  assert.deepEqual(s.sales().filter((x) => x.hour < opened), [], 'never in the hours its door was shut');
  // open already, set open again: its hours still to reckon
  _now = T0;
  const o = await rawStand();
  const ann = await o.registered('Ann');
  const open = o.home(ann, 6002, 10);
  for (const it of loot(5)) o.list(ann, open, it);
  _now = T0 + 20 * 3600;
  assert.equal((await o.call('/v1/homes/entry', { mapId: 6002, buildingKey: 10, entry: 'public' }, ann.secret)).status, 200);
  assert.deepEqual(o.marks(6002), [null], 'its hours left');
  // a town of shut doors, read: marked hour by hour
  _now = T0;
  const p = await rawStand();
  const bea = await p.registered('Bea');
  const pv = p.home(bea, 6003, 10, { entry: 'private' });
  for (const it of loot(5)) p.list(bea, pv, it);
  for (let h = 1; h <= 5; h++) {
    _now = T0 + h * 3600 + 5;
    await p.call('/v1/market/vendor', { vendor: pv }, bea.secret);
    assert.deepEqual(p.marks(6003), [Math.floor(_now / 3600) - 1], 'a shut town marked as it is read');
  }
  assert.deepEqual(p.sales(), []);
});

test('AUDIT LW-II P8, P10, P11: THE SERVICE\'S OWN - the hour\'s cron pays no patron while the market is shut, or open to its developers alone (its routes answer \'market-closed\'); the draw the service\'s secret (patronSalt, of its key: the same every reckoning) - the sales the law\'s under it, never the public dice\'s; a reckoning\'s failure other than its guard\'s stops the town unmarked, and the next reckons the hour again - the law\'s sales whole (mutants: the switch, the secret, the salted draw, the failure)', async () => {
  for (const [marks, want] of [['off', false], ['dev', false], ['on', true]]) {
    _now = T0;
    const s = await rawStand({ MARKS_OPEN: marks });
    const eve = await s.registered('Eve');
    const v = s.home(eve, 8001, 10);
    for (const it of loot(10)) s.list(eve, v, it);
    for (let h = 1; h <= 20; h++) await runCron(s.env, { cron: CRON_HOUR, nowS: T0 + h * 3600 + 41 * 60 });
    assert.equal(s.sales().length > 0, want, `the market ${marks}: ${s.sales().length} sold by the clock`);
    if (!want) assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM realm_faucets').get().n, 0, 'no gold minted');
  }
  // the secret
  _now = T0;
  const s = await rawStand();
  assert.match(s.salt, /^[0-9a-f]{32}$/);
  assert.equal(await patronSalt(s.env), s.salt, 'the same every reckoning');
  assert.equal(await patronSalt({}), '', 'no key, no secret');
  assert.notEqual(await patronSalt({ IDENTITY_PRIVATE_KEY: 'a' }), await patronSalt({ IDENTITY_PRIVATE_KEY: 'b' }));
  const eve = await s.registered('Eve');
  const v = s.home(eve, 8101, 10);
  for (const it of loot(20)) s.list(eve, v, it);
  _now = T0 + 40 * 3600;
  await s.call('/v1/market/vendor', { vendor: v }, eve.secret);
  const sold = s.sales().map(key).sort();
  assert.ok(sold.length >= 5);
  assert.deepEqual(sold, law(s, _now), 'the law\'s, under the secret');
  assert.notDeepEqual(sold, law(s, _now, ''), 'never the public dice\'s');
  assert.ok(s.sales().every((x) => x.seed === patronSeed(x.listing, x.hour) && x.minute === patronMinute(x.listing, x.hour)), 'the seed and the minute told as ever');
  // a failure not the guard's: the town stops where it was, unmarked past it
  _now = T0;
  const t = await rawStand();
  const ann = await t.registered('Ann');
  const tv = t.home(ann, 8201, 10);
  for (const it of loot(10)) t.list(ann, tv, it);
  _now = T0 + 30 * 3600;
  const H = Math.min(...law(t, _now).map(hourOf));
  const broken = { prepare: (/** @type {any[]} */ ...x) => t.env.DB.prepare(...x), batch: async () => { throw new Error('D1_ERROR: Network connection lost.'); } };
  const warn = console.warn;
  console.warn = () => {};
  try { await reckonPatrons({ db: broken, nowS: _now }, { maps: [8201] }, t.env); } finally { console.warn = warn; }
  assert.deepEqual(t.sales(), []);
  assert.ok(t.marks(8201).every((h) => h == null || h < H), 'unmarked from the hour it stopped in');
  await reckonPatrons({ db: t.env.DB, nowS: _now }, { maps: [8201] }, t.env);
  assert.deepEqual(t.sales().map(key).sort(), law(t, _now), 'reckoned again: the law\'s sales whole');
});

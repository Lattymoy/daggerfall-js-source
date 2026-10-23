// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET AS THE SERVICE KEEPS IT: a Stores material listed (its units out of
// the Stores bought first, the split kept, the fee burnt) and bought here (into the Stores at once) or from another
// region by courier (its fee burnt, its load arriving on a read after its time); a crafted piece listed by its owner
// alone, once, bought and handed over (its owner moved), collected when its courier arrives; cancels, expiry and a
// moderator's removal returning the goods; buy orders escrowed on the ledger's new end, filled from the Stores and
// returned; the prices' history and the weekly report's medians; the switches and the repeats. Driven through the real
// Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 26.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { holdPieces } from '../realmSeat.mjs';   // INT19: a crafted piece lists out of its seller's realm record
import { utcDay } from '../../src/net/marksLaw.js';
import {
  MARKET_LISTING_S, MARKET_ORDER_S, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, listingFee, saleTax, courierFee, courierSeconds, roadPixels,
} from '../../src/net/marketLaw.js';

const DAY = 86_400;
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `mkt-${String(++_rid).padStart(6, '0')}`;
/** Daggerfall (17) and Wayrest (23), their hubs as a client derives them (test pixels - MAPS.BSA stays out of the tree). */
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', MODERATOR_HANDLES: 'Asynian', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m, character = who.character) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin')
    .all(who.id, character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty, character = who.character) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, m, origin, qty);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind)
    .map((r) => [r.src_kind, r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  /** A crafted piece this account owns, as the anvil writes it (PROF3). */
  const piece = (who, provenance, recipe = 'longsword:mithril', { template = 120, material = 5, quality = 2 } = {}) => raw.prepare(`INSERT INTO products
    (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'Silverthorn', ?, ?, ?, ?, 4242, 'p1.x', ?)`)
    .run(provenance, who.id, who.character, recipe, template, material, quality, _now);
  const owner = (p) => raw.prepare('SELECT owner, listed FROM products WHERE provenance = ?').get(p);
  const read = (who, view, extra = {}) => s.call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  return { ...s, raw, stores, give, balance, fund, lines, piece, owner, read };
}
const listing = (who, extra = {}) => ({ character: who.character, region: DF, kind: 'material', material: 'ore:mithril', units: 40, price: 8, hubs: HUBS, rid: rid(), ...extra });

// ─── A LISTING ───────────────────────────────────────────────────────

test('PROF5 service: a material listed - its units out of the Stores bought first, the split kept, the fee 1% of its worth burnt; read on the boards of its region; the thirty; the Stores and the Marks asked; asked twice one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'ore:mithril', 'own', 50);
  s.give(mac, 'ore:mithril', 'bought', 10);
  s.fund(mac, 100);
  const body = listing(mac);
  const r = await s.call('/v1/market/list', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.listing.units, r.body.listing.price, r.body.listing.fee, r.body.listing.region], [40, 8, listingFee(320), DF]);
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['own', 20]], 'the ten bought first, then thirty own');
  const row = s.raw.prepare('SELECT own, bought, expires_at FROM market_listings WHERE id = ?').get(r.body.listing.id);
  assert.deepEqual([row.own, row.bought, row.expires_at], [30, 10, _now + MARKET_LISTING_S]);
  assert.equal(s.balance(mac), 100 - 4, 'the fee: 1% of 320, rounded up');
  assert.deepEqual(s.lines('market-fee'), [['account', mac.id, 'burn', null, 4]]);
  const again = await s.call('/v1/market/list', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.listing.id, s.balance(mac)], [true, r.body.listing.id, 96], 'asked twice, one listing');
  // the least fee is one Mark
  assert.equal((await s.call('/v1/market/list', listing(mac, { units: 1, price: 3 }), mac.secret)).body.listing.fee, 1);
  // the Stores asked, and the Marks
  assert.deepEqual((await s.call('/v1/market/list', listing(mac, { units: 50 }), mac.secret)).body, { error: 'stores-short' });
  s.fund(mac, 0);
  assert.deepEqual((await s.call('/v1/market/list', listing(mac, { units: 1 }), mac.secret)).body, { error: 'marks-short' });
  // the bounds
  s.fund(mac, 1000);
  assert.equal((await s.call('/v1/market/list', listing(mac, { price: 0 }), mac.secret)).body.error, 'bad-price');
  assert.equal((await s.call('/v1/market/list', listing(mac, { price: 1_000_001 }), mac.secret)).body.error, 'bad-price');
  assert.equal((await s.call('/v1/market/list', listing(mac, { units: 0 }), mac.secret)).body.error, 'bad-units');
  assert.equal((await s.call('/v1/market/list', listing(mac, { material: 'ore:nothing' }), mac.secret)).body.error, 'bad-material');
  // thirty an account
  s.give(mac, 'ore:mithril', 'own', 100);
  for (let i = 0; i < MARKET_LISTINGS_MAX - 2; i++) assert.equal((await s.call('/v1/market/list', listing(mac, { units: 1 }), mac.secret)).status, 200);
  assert.deepEqual((await s.call('/v1/market/list', listing(mac, { units: 1 }), mac.secret)).body, { error: 'market-listings-max' });
  // read on the boards
  const ann = await s.registered('Ann');
  const view = await s.read(ann, 'materials', { material: 'ore:mithril' });
  assert.equal(view.status, 200, JSON.stringify(view.body));
  assert.equal(view.body.rows.length, MARKET_LISTINGS_MAX);
  assert.deepEqual(view.body.rows.map((x) => x.price).slice(0, 2), [3, 8], 'cheapest first');
  assert.deepEqual(view.body.rows[0].road, { courier: 0, seconds: 0, road: 0 }, 'here');
  assert.equal(view.body.rows[0].mine, false);
  assert.deepEqual((await s.read(ann, 'materials', { family: 'wood' })).body.rows, [], 'the family filtered');
});

// ─── BUYING ──────────────────────────────────────────────────────────

test('PROF5 service: bought here - a part of a listing into the buyer\'s Stores as bought at once, the seller paid the price less 5% (rounded down), the tax burnt, the listing\'s bought units first; a listing sold out closes; one\'s own refused; the price moved, the seller\'s cap and the Stores\' room refused; asked twice one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.give(mac, 'ore:mithril', 'own', 30);
  s.give(mac, 'ore:mithril', 'bought', 10);
  s.fund(mac, 100);
  s.fund(ann, 1000);
  const { body: { listing: l } } = await s.call('/v1/market/list', listing(mac), mac.secret);
  const buy = { character: ann.character, region: DF, listing: l.id, units: 25, max: 200, hubs: HUBS, rid: rid() };
  const r = await s.call('/v1/market/buy', buy, ann.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.sale.units, r.body.sale.total, r.body.sale.tax, r.body.sale.courier, r.body.sale.here], [25, 200, saleTax(200), 0, true]);
  assert.deepEqual(s.stores(ann, 'ore:mithril'), [['bought', 25]], 'into the Stores at once, bought');
  assert.deepEqual(r.body.store, { material: 'ore:mithril', own: 0, bought: 25 });
  assert.equal(s.balance(ann), 800);
  assert.equal(s.balance(mac), 96 + 200 - 10, 'the price less 5%');
  assert.deepEqual(s.lines('market-sale'), [['account', ann.id, 'account', mac.id, 190]]);
  assert.deepEqual(s.lines('market-tax'), [['account', ann.id, 'burn', null, 10]]);
  const row = () => s.raw.prepare('SELECT own, bought, state FROM market_listings WHERE id = ?').get(l.id);
  assert.deepEqual({ ...row() }, { own: 15, bought: 0, state: 'open' }, 'the ten bought first, then fifteen own');
  assert.deepEqual([(await s.call('/v1/market/buy', buy, ann.secret)).body.repeat, s.balance(ann)], [true, 800], 'asked twice, one sale');
  assert.equal(s.raw.prepare("SELECT SUM(units) AS u FROM market_prices WHERE material = 'ore:mithril' AND price = 8").get().u, 25, 'the price table');
  // the price moved: more than the buyer agreed to pay
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 15, max: 100, rid: rid() }, ann.secret)).body, { error: 'market-price-moved' });
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 16, max: 999, rid: rid() }, ann.secret)).body, { error: 'market-short' });
  // one's own
  s.fund(mac, 1000);
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 1, rid: rid() }, mac.secret)).body, { error: 'market-own' });
  // the Stores' room, here
  s.give(ann, 'ore:mithril', 'own', 4990);
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 15, max: 999, rid: rid() }, ann.secret)).body, { error: 'stores-full' });
  s.give(ann, 'ore:mithril', 'own', 0);
  // the seller at the cap
  s.fund(mac, 9_999_990);
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 15, max: 999, rid: rid() }, ann.secret)).body, { error: 'market-seller-full' });
  s.fund(mac, 0);
  // the Marks
  s.fund(ann, 10);
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 15, max: 999, rid: rid() }, ann.secret)).body, { error: 'marks-short' });
  s.fund(ann, 1000);
  const last = await s.call('/v1/market/buy', { ...buy, units: 15, max: 999, rid: rid() }, ann.secret);
  assert.equal(last.status, 200);
  assert.deepEqual({ ...row() }, { own: 0, bought: 0, state: 'sold' }, 'sold out, closed');
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, units: 1, rid: rid() }, ann.secret)).body, { error: 'market-gone' });
});

test('PROF5 service: bought from another region by courier - its fee by the load and the road (burnt), its time; the load on the road until it arrives, then into the Stores on a read, a full Stores keeping it waiting; both hubs witnessed by an account a week old', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * DAY, ann.id);
  s.give(mac, 'ore:mithril', 'own', 100);
  s.fund(mac, 100);
  s.fund(ann, 1000);
  const { body: { listing: l } } = await s.call('/v1/market/list', listing(mac, { units: 45, region: WR }), mac.secret);
  const quote = (await s.read(ann, 'materials')).body.rows[0].road;
  assert.deepEqual(quote, { courier: courierFee(45, ROAD), seconds: courierSeconds(ROAD), road: ROAD }, 'the read quotes the courier from Wayrest');
  assert.equal(quote.courier, Math.ceil((3 * (25 + ROAD)) / 25), 'three loads of 20, the road');
  const buy = { character: ann.character, region: DF, listing: l.id, units: 45, max: 360 + quote.courier, hubs: HUBS, rid: rid() };
  const r = await s.call('/v1/market/buy', buy, ann.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.sale.here, r.body.sale.courier, r.body.sale.arrivesAt], [false, quote.courier, _now + quote.seconds]);
  assert.equal(s.balance(ann), 1000 - 360 - quote.courier);
  assert.deepEqual(s.lines('courier'), [['account', ann.id, 'burn', null, quote.courier]]);
  assert.deepEqual(s.stores(ann, 'ore:mithril'), [], 'on the road');
  const road = (await s.read(ann, 'mine')).body.road;
  assert.deepEqual(road.map((x) => [x.kind, x.material, x.units, x.from, x.waiting]), [['material', 'ore:mithril', 45, WR, false]]);
  // arrived, with a full Stores: it waits
  s.give(ann, 'ore:mithril', 'own', 4990);
  clock(_now + quote.seconds);
  assert.deepEqual((await s.read(ann, 'mine')).body.road.map((x) => x.waiting), [true], 'waiting for room');
  s.give(ann, 'ore:mithril', 'own', 10);
  await s.read(ann, 'materials');
  assert.deepEqual(s.stores(ann, 'ore:mithril'), [['bought', 45], ['own', 10]], 'in the Stores on the read after it arrived');
  assert.deepEqual((await s.read(ann, 'mine')).body.road, []);
  // the witnesses: both ends' hubs, from an account a week old
  const hubs = s.raw.prepare("SELECT key, report FROM world_witness WHERE kind = 'hub' AND account = ? ORDER BY key").all(ann.id).map((w) => [w.key, w.report]);
  assert.deepEqual(hubs, [[String(DF), '207,212'], [String(WR), '590,166']]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'hub' AND account = ?").get(mac.id).n, 0, 'a new account witnesses nothing');
  // no road known: refused
  const far = await s.call('/v1/market/list', listing(mac, { units: 1, region: 5, rid: rid() }), mac.secret);
  assert.deepEqual((await s.call('/v1/market/buy', { ...buy, listing: far.body.listing.id, units: 1, max: 999, rid: rid() }, ann.secret)).body, { error: 'market-no-road' });
});

// ─── A CRAFTED PIECE ─────────────────────────────────────────────────

test('PROF5 service: a crafted piece listed by its owner alone, once, with its wear; bought here - answered to the pack, its owner moved; bought by courier - its delivery collected once it arrives, by its character, asked twice one; a cancel answers it back', async () => {
  const s = await stand();
  // PIN MOVED (INT19, Integrity-Arc section 7): a crafted piece lists out of its seller's REALM RECORD - the sellers are
  // realm characters, the piece stands in the record first, and its wear is the record's
  const mac = await s.seated('Mac');
  const ann = await s.seated('Ann');
  s.fund(mac, 1000);
  s.fund(ann, 5000);
  s.piece(mac, '0123456789abcdef');
  s.piece(ann, 'fedcba9876543210');
  holdPieces(s.env, mac.character, [{ provenance: '0123456789abcdef', wear: 620 }]);
  const sword = (extra = {}) => ({ character: mac.character, region: DF, kind: 'piece', provenance: '0123456789abcdef', wear: 620, price: 900, hubs: HUBS, rid: rid(), ...extra });
  assert.deepEqual((await s.call('/v1/market/list', sword({ provenance: 'fedcba9876543210' }), mac.secret)).body, { error: 'market-not-yours' });
  assert.deepEqual((await s.call('/v1/market/list', sword({ provenance: 'aaaaaaaaaaaaaaaa' }), mac.secret)).body, { error: 'market-no-record' }, 'AUDIT 31 H1: no record at all, never another\'s');
  assert.equal((await s.call('/v1/market/list', sword({ wear: 0 }), mac.secret)).body.error, 'bad-wear');
  assert.equal((await s.call('/v1/market/list', sword({ provenance: 'NOT-HEX' }), mac.secret)).body.error, 'bad-provenance');
  const l = await s.call('/v1/market/list', sword(), mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.deepEqual([l.body.listing.units, l.body.listing.wear, l.body.listing.fee, s.owner('0123456789abcdef').listed], [1, 620, 9, 1]);
  assert.deepEqual((await s.call('/v1/market/list', sword(), mac.secret)).body, { error: 'market-listed' }, 'one live listing an id');
  const crafted = (await s.read(ann, 'crafted', { family: 'weapons' })).body.rows;
  assert.deepEqual(crafted.map((x) => [x.piece.recipe, x.piece.quality, x.piece.maker, x.wear, x.price]), [['longsword:mithril', 2, 'Silverthorn', 620, 900]]);
  assert.deepEqual((await s.read(ann, 'crafted', { family: 'furniture' })).body.rows, []);
  // bought here: answered to the pack, the owner moved
  const b = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, max: 900, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual([b.body.piece.provenance, b.body.piece.recipe, b.body.piece.seed, b.body.piece.wear, b.body.delivery], ['0123456789abcdef', 'longsword:mithril', 4242, 620, undefined]);
  assert.deepEqual({ ...s.owner('0123456789abcdef') }, { owner: ann.id, listed: 0 });
  assert.equal(s.balance(mac), 1000 - 9 + 900 - 45);
  assert.deepEqual((await s.call('/v1/market/list', sword(), mac.secret)).body, { error: 'market-not-yours' }, 'the seller holds no copy it can sell');
  // Ann lists it on in Wayrest (her pack took it from the answer, and her record with it); Mac buys it back by courier
  holdPieces(s.env, ann.character, [{ provenance: '0123456789abcdef', wear: 620 }]);
  const l2 = await s.call('/v1/market/list', { ...sword(), character: ann.character, region: WR, price: 1000, wear: 620 }, ann.secret);
  assert.equal(l2.status, 200);
  const courier = courierFee(1, ROAD);
  const buy = { character: mac.character, region: DF, listing: l2.body.listing.id, max: 1000 + courier, hubs: HUBS, rid: rid() };
  const c = await s.call('/v1/market/buy', buy, mac.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.piece, c.body.delivery.arrivesAt, s.owner('0123456789abcdef').owner], [undefined, _now + courierSeconds(ROAD), mac.id], 'on the road, already his');
  const id = c.body.delivery.id;
  const collect = { character: mac.character, delivery: id, rid: rid() };
  assert.deepEqual((await s.call('/v1/market/collect', collect, mac.secret)).body, { error: 'market-on-road' });
  const road = (await s.read(mac, 'mine')).body.road;
  assert.deepEqual(road.map((x) => [x.kind, x.why, x.ready, x.piece.provenance]), [['piece', 'bought', false, '0123456789abcdef']]);
  clock(_now + courierSeconds(ROAD));
  assert.deepEqual((await s.call('/v1/market/collect', { ...collect, character: 'char-other', rid: rid() }, mac.secret)).body, { error: 'market-other-character' });
  const got = await s.call('/v1/market/collect', collect, mac.secret);
  assert.deepEqual([got.status, got.body.piece.provenance, got.body.piece.wear], [200, '0123456789abcdef', 620]);
  assert.deepEqual([(await s.call('/v1/market/collect', collect, mac.secret)).body.repeat], [true], 'asked twice, answered again');
  assert.deepEqual((await s.call('/v1/market/collect', { ...collect, rid: rid() }, mac.secret)).body, { error: 'market-gone' }, 'collected once');
  // a cancel answers the piece back - PIN MOVED (INT19): by a delivery its record collects, never minted at the pack
  holdPieces(s.env, mac.character, [{ provenance: '0123456789abcdef', wear: 620 }]);
  const l3 = await s.call('/v1/market/list', sword({ wear: 1000 }), mac.secret);
  assert.equal(l3.status, 200, JSON.stringify(l3.body));
  const cancel = { character: mac.character, listing: l3.body.listing.id, rid: rid() };
  const x = await s.call('/v1/market/cancel', cancel, mac.secret);
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual([x.status, x.body.piece, x.body.delivery, x.body.listing.state, s.owner('0123456789abcdef').listed], [200, undefined, { id: l3.body.listing.id }, 'cancelled', 0]);
  assert.equal((await s.call('/v1/market/cancel', cancel, mac.secret)).body.repeat, true);
});

// ─── RETURNS ─────────────────────────────────────────────────────────

test('PROF5 service: a cancel returns a material\'s units with their origins (the fee kept, refused while they would not fit); an expired listing and a removed one return on their seller\'s next read - a piece as a delivery; reports counted for the moderators', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');   // PIN MOVED (INT19): a realm character - its crafted piece lists out of its record
  const ann = await s.registered('Ann');
  const mod = await s.registered('Asynian');
  s.fund(mac, 1000);
  s.give(mac, 'ore:mithril', 'own', 30);
  s.give(mac, 'ore:mithril', 'bought', 10);
  const l = await s.call('/v1/market/list', listing(mac), mac.secret);
  s.give(mac, 'ore:mithril', 'own', 4980);
  const cancel = { character: mac.character, listing: l.body.listing.id, rid: rid() };
  assert.deepEqual((await s.call('/v1/market/cancel', cancel, mac.secret)).body, { error: 'stores-full' });
  s.give(mac, 'ore:mithril', 'own', 0);
  const x = await s.call('/v1/market/cancel', { ...cancel, rid: rid() }, mac.secret);
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['bought', 10], ['own', 30]], 'each with the origin it left with');
  assert.equal(s.balance(mac), 1000 - 4, 'the fee kept');
  assert.deepEqual((await s.call('/v1/market/cancel', { ...cancel, rid: rid() }, mac.secret)).body, { error: 'market-gone' });
  // expired: off the boards at once, back on its seller's next read
  const e = await s.call('/v1/market/list', listing(mac, { units: 5 }), mac.secret);
  clock(_now + MARKET_LISTING_S);
  assert.deepEqual((await s.read(ann, 'materials')).body.rows, [], 'off every board');
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['bought', 5], ['own', 30]]);
  await s.read(mac, 'mine');
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['bought', 10], ['own', 30]]);
  assert.equal(s.raw.prepare('SELECT state FROM market_listings WHERE id = ?').get(e.body.listing.id).state, 'expired');
  // reported, and removed by a moderator
  s.piece(mac, '0123456789abcdef');
  holdPieces(s.env, mac.character, [{ provenance: '0123456789abcdef', wear: 500 }]);
  const p = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: '0123456789abcdef', wear: 500, price: 50, rid: rid() }, mac.secret);
  assert.deepEqual((await s.call('/v1/market/report', { listing: p.body.listing.id }, ann.secret)).body, { ok: true });
  assert.deepEqual((await s.call('/v1/market/report', { listing: p.body.listing.id }, mac.secret)).body, { error: 'market-own' });
  assert.equal((await s.read(ann, 'crafted')).body.rows[0].reports, undefined, 'a reader sees no count');
  assert.equal((await s.read(mod, 'crafted')).body.rows[0].reports, 1, 'a moderator does');
  assert.deepEqual((await s.call('/v1/market/remove', { listing: p.body.listing.id }, ann.secret)).body, { error: 'not-developer' });
  assert.deepEqual((await s.call('/v1/market/remove', { listing: p.body.listing.id }, mod.secret)).body, { error: 'not-developer' }, 'STAFF-PANEL2-FIX: a pull is an Admin\'s, never a Moderator\'s');
  assert.deepEqual((await s.call('/v1/market/remove', { listing: p.body.listing.id }, mac.secret)).body, { ok: true }, 'a developer\'s');
  // PIN MOVED (INT19): the piece comes back as the record that left, collected into the seller's record
  const back = (await s.read(mac, 'mine')).body.road;
  assert.deepEqual(back.map((d) => [d.kind, d.why, d.ready, d.item.currentCondition]), [['item', 'returned', true, 500]]);
  assert.equal(s.owner('0123456789abcdef').listed, 0);
  const got = await s.call('/v1/market/collect', { character: mac.character, delivery: back[0].id, rid: rid(), realm: mac.at() }, mac.secret);
  assert.deepEqual([got.body.item.provenance, got.body.delivery.why], ['0123456789abcdef', 'returned']);
});

// ─── BUY ORDERS ──────────────────────────────────────────────────────

test('PROF5 service: a buy order - its Marks escrowed to the ledger\'s escrow end; filled in part from a filler\'s Stores (bought first) at a board of its region, the pay less the tax out of the escrow, the units to the orderer\'s Stores as bought; its own poster refused, another region\'s fill its courier would eat refused, the orderer\'s room asked; withdrawn and expired, the rest returned once; the twenty', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 2000);
  const order = { character: mac.character, region: DF, material: 'ore:mithril', units: 200, price: 8, hubs: HUBS, rid: rid() };
  const o = await s.call('/v1/market/order', order, mac.secret);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.deepEqual([o.body.order.left, o.body.order.escrow, o.body.balance], [200, 1600, 400]);
  assert.deepEqual(s.lines('order-escrow'), [['account', mac.id, 'escrow', o.body.order.id, 1600]]);
  assert.equal((await s.call('/v1/market/order', order, mac.secret)).body.repeat, true);
  assert.deepEqual((await s.call('/v1/market/order', { ...order, units: 100, rid: rid() }, mac.secret)).body, { error: 'marks-short' });
  // filled in part
  s.give(ann, 'ore:mithril', 'own', 50);
  s.give(ann, 'ore:mithril', 'bought', 20);
  const fill = { character: ann.character, region: DF, order: o.body.order.id, units: 60, hubs: HUBS, rid: rid() };
  const f = await s.call('/v1/market/fill', fill, ann.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual([f.body.fill.pay, f.body.fill.tax, f.body.balance], [480 - 24, 24, 456]);
  assert.deepEqual(s.stores(ann, 'ore:mithril'), [['own', 10]], 'the twenty bought first');
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['bought', 60]]);
  assert.deepEqual(s.lines('order-fill'), [['escrow', o.body.order.id, 'account', ann.id, 456]]);
  assert.deepEqual(s.lines('market-tax'), [['escrow', o.body.order.id, 'burn', null, 24]]);
  const ord = () => s.raw.prepare('SELECT left_units, escrow, state, returned FROM market_orders WHERE id = ?').get(o.body.order.id);
  assert.deepEqual({ ...ord() }, { left_units: 140, escrow: 1120, state: 'open', returned: 0 });
  assert.equal((await s.call('/v1/market/fill', fill, ann.secret)).body.repeat, true);
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, units: 11, rid: rid() }, ann.secret)).body, { error: 'stores-short' });
  // GLOBAL-MARKET (PIN MOVED: another region's board was refused `market-elsewhere`): one unit from Wayrest - its courier
  // would take all it pays, so it is refused before anything moves
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, region: WR, units: 1, rid: rid() }, ann.secret)).body, { error: 'market-courier-dear' });
  s.give(mac, 'ore:mithril', 'own', 5);
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, character: mac.character, units: 1, rid: rid() }, mac.secret)).body, { error: 'market-own' });
  s.give(mac, 'ore:mithril', 'own', 4940);
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, units: 1, rid: rid() }, ann.secret)).body, { error: 'market-order-full' });
  s.give(mac, 'ore:mithril', 'own', 0);
  // the region's orders, read
  assert.deepEqual((await s.read(ann, 'orders')).body.orders.map((x) => [x.material, x.left, x.price, x.mine]), [['ore:mithril', 140, 8, false]]);
  // withdrawn: the rest returned once
  const w = await s.call('/v1/market/unorder', { order: o.body.order.id, rid: rid() }, mac.secret);
  assert.deepEqual([w.status, w.body.order.state, w.body.balance], [200, 'cancelled', 400 + 1120]);
  assert.deepEqual(s.lines('order-return'), [['escrow', o.body.order.id, 'account', mac.id, 1120]]);
  assert.deepEqual({ ...ord() }, { left_units: 140, escrow: 0, state: 'cancelled', returned: 1 });
  assert.equal((await s.call('/v1/market/unorder', { order: o.body.order.id, rid: rid() }, mac.secret)).body.repeat, true);
  await s.read(mac, 'mine');
  assert.equal(s.lines('order-return').length, 1, 'once');
  // expired on the seventh day, returned on the poster's read
  const e = await s.call('/v1/market/order', { ...order, units: 10, rid: rid() }, mac.secret);
  clock(_now + MARKET_ORDER_S);
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, order: e.body.order.id, units: 1, rid: rid() }, ann.secret)).body, { error: 'market-gone' });
  const before = s.balance(mac);
  await s.read(mac, 'orders');
  assert.deepEqual([s.balance(mac) - before, s.raw.prepare('SELECT state FROM market_orders WHERE id = ?').get(e.body.order.id).state], [80, 'expired']);
  // twenty an account
  s.fund(mac, 10_000);
  for (let i = 0; i < MARKET_ORDERS_MAX; i++) assert.equal((await s.call('/v1/market/order', { ...order, units: 1, rid: rid() }, mac.secret)).status, 200);
  assert.deepEqual((await s.call('/v1/market/order', { ...order, units: 1, rid: rid() }, mac.secret)).body, { error: 'market-orders-max' });
});

// ─── HISTORY, THE REPORT, THE SWITCHES ───────────────────────────────

test('PROF5 service: the History - a material\'s 7-day median and its line, the week\'s most traded, "Your trades"; the weekly report\'s medians and the escrow in circulation; the market shut while any of its three switches is; a request made is answered whatever the switch says now', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 1000);
  s.fund(ann, 5000);
  s.give(mac, 'ore:mithril', 'own', 100);
  const l1 = await s.call('/v1/market/list', listing(mac, { units: 30, price: 8 }), mac.secret);
  const l2 = await s.call('/v1/market/list', listing(mac, { units: 30, price: 10 }), mac.secret);
  const buy = (l, units) => s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, units, max: 999, hubs: HUBS, rid: rid() }, ann.secret);
  await buy(l1, 10);
  clock(_now + DAY);
  await buy(l2, 11);
  const h = await s.read(ann, 'history');
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.deepEqual(h.body.history.map((x) => [x.material, x.units, x.median]), [['ore:mithril', 21, 10]], 'twenty-one units: the eleventh sold at 10');
  assert.deepEqual(h.body.history[0].line, [null, null, null, null, null, 8, 10]);
  assert.deepEqual(h.body.trades.map((t) => [t.side, t.units, t.price]), [['bought', 11, 10], ['bought', 10, 8]]);
  assert.deepEqual((await s.read(mac, 'history')).body.trades.map((t) => t.side), ['sold', 'sold']);
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 5, price: 4, rid: rid() }, mac.secret);
  assert.equal(o.status, 200);
  const rep = await s.call('/v1/marks/report', {}, mac.secret);
  assert.deepEqual(rep.body.medians, [{ material: 'ore:mithril', units: 21, median: 10 }]);
  assert.equal(rep.body.circulation.escrow, 20);
  assert.equal(rep.body.burnt['market-tax'], saleTax(80) + saleTax(110));
  // the switches: each of the three shuts the market
  for (const shutOne of [{ BOARD_OPEN: 'off' }, { PROFESSIONS_OPEN: 'off' }, { MARKS_OPEN: 'off' }]) {
    const t = await stand(shutOne);
    const who = await t.registered('Mac');
    assert.deepEqual((await t.read(who, 'materials')).body, { error: 'market-closed' }, JSON.stringify(shutOne));
  }
  // a request made is answered after the switch shuts
  const body = listing(mac, { units: 1 });
  const made = await s.call('/v1/market/list', body, mac.secret);
  s.env.MARKS_OPEN = 'off';
  assert.deepEqual([(await s.call('/v1/market/list', body, mac.secret)).body.repeat, (await s.call('/v1/market/list', { ...body, rid: rid() }, mac.secret)).body.error], [true, 'market-closed']);
  assert.equal(made.status, 200);
  // a guest has no market
  const g = await s.guest();
  assert.equal((await s.call('/v1/market/read', { character: 'char-x', region: DF, view: 'materials' }, g.secret)).body.error, 'prof-need-account');
});

// ─── THE WEAVERS' COUNTER (4.5) ──────────────────────────────────────

test('PROF5 service: the Weavers\' counter - a Wool Bolt 3 Marks and a Linen Bolt 2 into the Stores as bought, the Marks burnt as the stock\'s; neither leaves the Stores for the pack', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 100);
  const wool = await s.call('/v1/prof/stock', { character: mac.character, material: 'cloth:wool', qty: 10, rid: rid() }, mac.secret);
  assert.equal(wool.status, 200, JSON.stringify(wool.body));
  assert.deepEqual([wool.body.marks, wool.body.balance], [30, 70]);
  const linen = await s.call('/v1/prof/stock', { character: mac.character, material: 'cloth:linen', qty: 5, rid: rid() }, mac.secret);
  assert.deepEqual([linen.body.marks, linen.body.balance], [10, 60]);
  assert.deepEqual([s.stores(mac, 'cloth:wool'), s.stores(mac, 'cloth:linen')], [[['bought', 10]], [['bought', 5]]]);
  assert.deepEqual(s.lines('stock').map((l) => l[4]), [30, 10]);
  const out = (await s.call('/v1/stores/withdraw', { character: mac.character, material: 'cloth:wool', qty: 1, rid: rid() }, mac.secret)).body;
  assert.deepEqual([out.ok, out.store], [true, { material: 'cloth:wool', own: 0, bought: 9 }], 'PROF7 moved it: a Wool Bolt withdraws now (669)');
});

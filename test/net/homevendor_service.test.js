// HOME-VENDOR (2026-10-03, Mac: "add the ability for players that own houses to buy npcs that sell goods for them when
// someone visits the house ... make the available npcs visible on the board with a tab and item search filter"; "Yes
// only in the house ... set a waypoint where the trader is ... Selfplaced npcs should sell stuff waaaaay longer"). A
// home's decor piece made the `vendor` station stocks its owner's pieces from the pack, for gold, for thirty days; they
// stand on no regional board and are bought at the trader alone. Driven through the real Worker over node:sqlite with
// every migration applied and R2 beside it (test/accountDb.mjs, test/realmSeat.mjs).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { goldSaleOf, MARKET_LISTING_S } from '../../src/net/marketLaw.js';
import { VENDOR_LISTING_S, vendorOf, vendorSearch, VENDOR_REFUSAL_WORDS } from '../../src/net/vendorLaw.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, decorPlaceOf } from '../../src/net/decorLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `hv-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1', CHAIR = 'chair1';
const VENDOR = { map: MAP, id: PIECE };

function lootDrop(seed = 11) {
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
  return { weapon: items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE), armour: items.find((it) => it.group === 'Armor') };
}
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = (station = null) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const seated = async (handle, save) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 0, ...save });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  /** A home of `who`'s in Daggerfall, with a trader piece and a plain chair. */
  const home = (who) => {
    raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
      .run(MAP, KEY, who.id, who.character, 'Eve', DF, _now);
    const piece = raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
      VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`);
    piece.run(MAP, KEY, PIECE, place('vendor'), _now);
    piece.run(MAP, KEY, CHAIR, place(), _now);
  };
  const list = (who, pick, extra = {}) => s.call('/v1/market/list', {
    character: who.character, region: WR, kind: 'item', item: validLootList([record(who).save.items[pick]])?.[0] ?? null, pick, price: 50, hubs: HUBS, rid: rid(),
    currency: 'gold', realm: who.at(), vendor: VENDOR, ...extra,
  }, who.secret);
  const buy = (who, l, extra = {}) => s.call('/v1/market/buy', {
    character: who.character, region: DF, listing: l.id, units: 1, max: l.price, hubs: HUBS, rid: rid(), realm: who.at(), vendor: VENDOR, ...extra,
  }, who.secret);
  const stock = (who, vendor = VENDOR) => s.call('/v1/market/vendor', { vendor }, who.secret);
  const board = (who, region = DF) => s.call('/v1/market/vendors', { region, character: who.character }, who.secret);
  return { ...s, raw, record, seated, home, list, buy, stock, board };
}

test('HOME-VENDOR law: the trader is a station with its licence and name; a vendor on the wire is a town and a piece id; the directory searched by every word over the item, the owner and the town; each refusal said (mutants: the station dropped; a bad id taken; one word enough)', () => {
  assert.ok(DECOR_STATIONS.includes('vendor'));
  assert.equal(DECOR_STATION_FEES.vendor, 25_000);
  assert.equal(DECOR_STATION_NAMES.vendor, 'Hired trader');
  assert.ok(decorPlaceOf({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 0, station: 'vendor' }), 'a piece may be made one');
  assert.ok(VENDOR_LISTING_S >= 10 * MARKET_LISTING_S, 'far longer than the market\'s');
  assert.deepEqual(vendorOf({ map: 5, id: 'abc' }), { map: 5, id: 'abc' });
  for (const bad of [null, [], { map: 0, id: 'a' }, { map: 5, id: 'a b' }, { map: 5 }, { map: 2 ** 33, id: 'a' }]) assert.equal(vendorOf(bad), null, JSON.stringify(bad));
  const rows = [{ item: 'Iron Longsword', owner: 'Eve', map: 1 }, { item: 'Steel Dagger', owner: 'Tom', map: 2 }];
  const names = { nameOf: (it) => it, townOf: (m) => (m === 1 ? 'Daggerfall' : 'Wayrest') };
  assert.deepEqual(vendorSearch(rows, '', names), rows);
  assert.deepEqual(vendorSearch(rows, 'longsword', names).map((r) => r.owner), ['Eve']);
  assert.deepEqual(vendorSearch(rows, '  WAYREST  dagger ', names).map((r) => r.owner), ['Tom']);
  assert.deepEqual(vendorSearch(rows, 'eve steel', names), [], 'every word');
  for (const [code, words] of Object.entries(VENDOR_REFUSAL_WORDS)) assert.equal(accountRefusalText(code), words, code);
});

test('HOME-VENDOR service: the owner stocks the trader from the pack for thirty days, in the home\'s region whatever the client says; it stands on no board, only at the trader and in the region\'s directory; bought there off the buyer\'s record, the seller paid; bought anywhere else refused (mutants: the goods view unfiltered; the stall unchecked; the region taken from the client; the market\'s 72 hours)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop(11);
  const eve = await s.seated('Eve', { items: [plain(weapon), plain(armour)] });
  const tom = await s.seated('Tom', { goldPieces: 1000 });
  s.home(eve);
  // no stall but a trader, and only its owner's
  assert.equal((await s.list(eve, 0, { vendor: { map: MAP, id: CHAIR } })).body.error, 'vendor-not-yours', 'a chair is no trader');
  assert.equal((await s.list(tom, 0)).body.error, 'vendor-not-yours', 'nor another\'s');
  assert.equal((await s.list(eve, 0, { vendor: { map: MAP } })).body.error, 'bad-vendor');
  const l = await s.list(eve, 0);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const row = s.raw.prepare('SELECT region, vendor_map, vendor_id, expires_at, at FROM market_listings WHERE id = ?').get(l.body.listing.id);
  assert.deepEqual([row.region, row.vendor_map, row.vendor_id, row.expires_at - row.at], [DF, MAP, PIECE, VENDOR_LISTING_S], 'its home\'s region, its stall, thirty days');
  assert.deepEqual(s.record(eve).save.items.length, 1, 'out of the pack');
  // on no board
  const goods = await s.call('/v1/market/read', { character: tom.character, region: DF, view: 'goods', hubs: HUBS }, tom.secret);
  assert.equal(goods.status, 200);
  assert.deepEqual(goods.body.rows, [], 'the regional board does not carry it');
  // at the trader, and in the directory
  const st = await s.stock(tom);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.deepEqual([st.body.vendor.owner, st.body.vendor.buildingKey, st.body.vendor.mine, st.body.rows.length, st.body.rows[0].item.templateIndex], ['Eve', KEY, false, 1, weapon.templateIndex]);
  assert.equal((await s.stock(tom, { map: MAP, id: CHAIR })).body.error, 'vendor-gone');
  const dir = await s.board(tom);
  assert.deepEqual(dir.body.rows.map((r) => [r.owner, r.map, r.buildingKey, r.vendor.id, r.price]), [['Eve', MAP, KEY, PIECE, 50]]);
  assert.deepEqual((await s.board(tom, WR)).body.rows, [], 'another region\'s directory');
  // bought at the trader alone
  const listing = st.body.rows[0];
  assert.equal((await s.buy(tom, listing, { vendor: undefined })).body.error, 'vendor-only', 'from a board');
  assert.equal((await s.buy(tom, listing, { vendor: { map: MAP, id: CHAIR } })).body.error, 'vendor-not-here');
  assert.equal((await s.buy(tom, listing, { region: WR })).body.error, 'vendor-not-here', 'from another region');
  const b = await s.buy(tom, listing);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual([b.body.sale.here, s.record(tom).save.goldPieces], [true, 950]);
  assert.ok(b.body.delivery?.id, 'its delivery, arrived at once');
  assert.equal(Number(s.raw.prepare('SELECT gold FROM market_gold WHERE player = ?').get(eve.id).gold), goldSaleOf(0, 50).gets, 'the seller\'s share held');
  assert.deepEqual((await s.stock(tom)).body.rows, [], 'sold');
  // the owner's Vendor page: the trader, nothing standing, the sale and what it brought, the takings waiting
  const page = await s.call('/v1/market/myvendors', { character: eve.character }, eve.secret);
  assert.equal(page.status, 200, JSON.stringify(page.body));
  assert.deepEqual(page.body.traders.map((t) => [t.map, t.id, t.buildingKey, t.mine]), [[MAP, PIECE, KEY, true]]);
  assert.deepEqual(page.body.stock, []);
  assert.deepEqual(page.body.sold.map((x) => [x.total, x.gets, x.vendor.id, x.item.templateIndex]), [[50, goldSaleOf(0, 50).gets, PIECE, weapon.templateIndex]]);
  assert.equal(page.body.gold, goldSaleOf(0, 50).gets);
  assert.deepEqual((await s.call('/v1/market/myvendors', { character: tom.character }, tom.secret)).body.traders, [], 'another\'s page holds none of hers');
});

test('HOME-VENDOR service: a trader with goods stands - not removed, not unmade, its house not sold - and once empty it may go; a trader gone takes no sale (mutants: each guard)', async () => {
  const s = await stand();
  const { weapon } = lootDrop(12);
  const eve = await s.seated('Eve', { items: [plain(weapon)] });
  const tom = await s.seated('Tom', { goldPieces: 1000 });
  s.home(eve);
  const l = await s.list(eve, 0);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const act = (path, body) => s.call(path, { mapId: MAP, buildingKey: KEY, character: eve.character, realm: eve.at(), ...body }, eve.secret);
  const removed = await act('/v1/homes/decor/remove', { id: PIECE });
  assert.deepEqual([removed.status, removed.body.error], [409, 'vendor-stocked']);
  const unmade = await act('/v1/homes/decor/move', { id: PIECE, place: JSON.parse(place()) });
  assert.deepEqual([unmade.status, unmade.body.error], [409, 'vendor-stocked']);
  const sold = await s.call('/v1/homes/release', { mapId: MAP, buildingKey: KEY, realm: eve.at() }, eve.secret);
  assert.deepEqual([sold.status, sold.body.error], [409, 'home-vendor-stocked']);
  // a trader gone from under its stock (a moderator's hand, an old row) takes no sale
  s.raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(place(), PIECE);
  assert.equal((await s.buy(tom, l.body.listing)).body.error, 'vendor-gone');
  assert.deepEqual((await s.board(tom)).body.rows, [], 'nor stands in the directory');
  s.raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(place('vendor'), PIECE);
  // taken back, the trader may go
  const c = await s.call('/v1/market/cancel', { character: eve.character, listing: l.body.listing.id, rid: rid() }, eve.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const gone = await act('/v1/homes/decor/remove', { id: PIECE });
  assert.notEqual(gone.body.error, 'vendor-stocked', JSON.stringify(gone.body));
});

test('HOME-VENDOR the directory says each trader\'s door - its entry, whether the reader owns it, shares the owner\'s guild or rents a room there - and the client keeps only those it may walk in on (net/homeLaw.js homeMayEnter) (mutants: the door unsaid; a private house shown to a stranger; the owner\'s own hidden)', async () => {
  const { homeMayEnter } = await import('../../src/net/homeLaw.js');
  const s = await stand();
  const { weapon } = lootDrop(13);
  const eve = await s.seated('Eve', { items: [plain(weapon)] });
  const tom = await s.seated('Tom', { goldPieces: 10 });
  s.home(eve);
  assert.equal((await s.list(eve, 0)).status, 200);
  const shown = async (who, partyNames = []) => (await s.board(who)).body.rows.filter((r) => homeMayEnter(r.home, { partyNames })).length;
  const door = async (who) => (await s.board(who)).body.rows[0].home;
  assert.deepEqual(await door(tom), { owner: 'Eve', entry: 'public', mine: false });
  assert.equal(await shown(tom), 1, 'a public house: anyone');
  s.raw.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ?').run('private', MAP, KEY);
  assert.equal(await shown(tom), 0, 'a private house: no stranger');
  assert.equal((await door(eve)).mine, true);
  assert.equal(await shown(eve), 1, 'its owner always');
  s.raw.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ?').run('party', MAP, KEY);
  assert.equal(await shown(tom), 0, 'a party house: not outside the party');
  assert.equal(await shown(tom, ['eve']), 1, 'and in it');
  s.raw.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ?').run('guild', MAP, KEY);
  assert.equal(await shown(tom), 0, 'a guild house: not outside the guild');
  s.raw.prepare("INSERT INTO home_rooms (map_id, building_key, room, anchor, price, listed, tenant, tenant_char, until) VALUES (?, ?, 1, 'a', 10, 1, ?, ?, ?)").run(MAP, KEY, tom.id, tom.character, _now + 86_400);
  assert.ok((await door(tom)).tenant > _now, 'a room he rents there');
  assert.equal(await shown(tom), 1, 'opens its door to him');
});

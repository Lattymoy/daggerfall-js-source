// FIELD BUGS 2026-10-01 #2 - MARKET-ANY: "The market doesn't allow you to list any item that isnt bound". The market
// listed a Stores material or a crafted piece with its maker's record and nothing else (Professions-Arc 10.2: "Loot does
// not list"), so nothing a player carried from the world could go there - the List form offered "A crafted piece" and,
// to a player with none, "You carry no crafted piece to sell". A realm character's pack is its record on the service
// (REALM P1), and a realm trade moves a piece from one record to another in one write (REALM P2.1): a PIECE FROM THE
// PACK now lists the same way, FOR GOLD ALONE (a record is the tab's own checkpoint, so it never becomes Drakes - law 3):
// out of the seller's record in the listing's own batch, into the buyer's - or back into the seller's, cancelled,
// expired or removed - in the collect's. Bound, worn, locked, a quest's, summoned, gold, a letter, a boat's and arrows
// stay at home, in words. Driven through the real Worker over node:sqlite with every migration applied and R2 beside it
// (test/accountDb.mjs, test/realmSeat.mjs), real realm sessions (systems/realmSaves.js), the real market book, the real
// pack side (systems/tradePack.js createMarketGoods over systems/tradePack.js) and the real tab; the pieces the producers mint.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { seatRealm, layRecord } from './realmSeat.mjs';
import { accountMarket, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createMarketBook } from '../src/net/marketBook.js';
import {
  goodRefusal, goodFamily, GOOD_REFUSAL_WORDS, GOOD_ARROW_TEMPLATE, GOOD_RECORD_MAX, GOODS_FAMILIES, MARKET_VIEWS, MARKET_LISTING_S, MARKET_HELD_MAX,
  goldSaleOf, courierFee, roadPixels,
} from '../src/net/marketLaw.js';
import { MARK_WORTH_GOLD } from '../src/net/marksLaw.js';
import { realmIo, createRealmSession, realmGoldAct } from '../src/systems/realmSaves.js';
import { createMarketGoods } from '../src/systems/tradePack.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { generateRandomLoot, LOOT_MATRICES, validLootList, createRandomGem } from '../src/systems/loot.js';
import { mintMaterialItem } from '../src/systems/profItems.js';
import { MINED_KEYS, PLANT_GROUP_TEMPLATES } from '../src/net/professionLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARROW_TEMPLATE, goldStack, letterOfCredit } from '../src/systems/inventory.js';
import { sigilStone } from '../src/systems/gateSpoils.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { mintBoatItem, BOAT_DEED_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { equipItem } from '../src/systems/equip.js';
import { setLocked } from '../src/systems/itemLock.js';
import { mintPiece } from '../src/systems/smithItems.js';
import { seededRng } from '../src/systems/wind.js';
import { REALM_MARKET_OPEN_SQL } from '../server-account/src/realm.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `fb1001-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });

/** The loot a body drops (systems/loot.js generateRandomLoot - LootTables.GenerateRandomLoot), its weapons and armour
 *  certain: a looted weapon, a looted piece of armour and the gold beside them, as the producer mints them. */
function lootDrop(seed = 11) {
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
  const weapon = items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  const armour = items.find((it) => it.group === 'Armor');
  const gold = items.find((it) => it.group === 'Currency');
  assert.ok(weapon && armour && gold, 'the drop holds each');
  return { weapon, armour, gold };
}
const plain = (it) => JSON.parse(JSON.stringify(it));
/** A select's options (the DOM shim keeps them as its children). */
const opts = (sel) => [...sel.querySelectorAll('option')];

// ─── THE LAW ─────────────────────────────────────────────────────────

test('MARKET-ANY law: a looted weapon and armour list from the pack; bound (a Deadlands Ember, the Broker\'s ware), worn, locked, a quest\'s, gold, a letter, a boat\'s deed and arrows do not, each in words - the shapes the producers mint (mutants: each refusal dropped; the arrow\'s row)', () => {
  const { weapon, armour, gold } = lootDrop();
  assert.equal(goodRefusal(plain(weapon)), null, `a looted ${weapon.name} lists`);
  assert.equal(goodRefusal(plain(armour)), null, `a looted ${armour.name} lists`);
  assert.equal(goodRefusal(sigilStone()), 'bound');
  assert.equal(goodRefusal(brokerStock(0)[0].item), 'bound', 'SS4: the Sigil Broker\'s ware');
  const entity = { items: [], equipTable: null, stats: {}, career: {} };
  const worn = plain(armour);
  entity.items.push(worn);
  equipItem(entity, worn);
  assert.notEqual(worn.equipSlot, undefined, 'worn');
  assert.equal(goodRefusal(worn), 'worn');
  const locked = plain(weapon);
  setLocked(locked, true);
  assert.equal(goodRefusal(locked), 'locked');
  assert.equal(goodRefusal({ ...plain(weapon), questItem: true }), 'quest', 'quest/item.js _link writes questItem');
  assert.equal(goodRefusal({ ...plain(weapon), timeForItemToDisappear: 5 }), 'summoned');
  assert.equal(goodRefusal(gold), 'gold');
  assert.equal(goodRefusal(goldStack(40)), 'gold');
  assert.equal(goodRefusal(letterOfCredit(5000)), 'letter');
  assert.equal(goodRefusal(mintBoatItem(BOAT_DEED_TEMPLATE, 7)), 'boat');
  assert.equal(goodRefusal(createWeapon(ARROW_TEMPLATE, 0, seededRng(3))), 'arrows');
  assert.equal(GOOD_ARROW_TEMPLATE, ARROW_TEMPLATE, 'the arrow\'s row is inventory.js\'s');
  // THE WALL (10.8): a Stores material in the pack - withdrawn (bought with Drakes, it may be), or the same DFU item
  // looted - sells from the Stores alone, never from the pack for gold; every withdrawable form but the four foods
  assert.equal(goodRefusal(mintMaterialItem('ingot:mithril', false)), 'stores');
  assert.equal(goodRefusal(mintMaterialItem('metal:iron', false)), 'stores');
  assert.equal(goodRefusal(mintMaterialItem('p1:8', false)), 'stores');
  assert.equal(goodRefusal(createRandomGem(seededRng(2))), 'stores', 'a looted gem is the Stores\' gem');
  const withdrawable = [...MINED_KEYS, ...Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`))].map((k) => mintMaterialItem(k, false)).filter(Boolean);
  assert.ok(withdrawable.length > 100);
  assert.deepEqual(withdrawable.filter((it) => goodRefusal(it) !== 'stores'), [], 'every one');
  assert.equal(goodRefusal(mintMaterialItem('food:apple', false)), null, 'the foods are left out - a Drake\'s worth of them is none');
  assert.equal(goodRefusal({ ...plain(weapon), name: 'x'.repeat(GOOD_RECORD_MAX) }), 'large');
  assert.equal(goodRefusal(null), 'shape');
  assert.equal(goodRefusal({ name: 'no row' }), 'shape');
  // a crafted piece is the service's question, never the law's refusal
  assert.equal(goodRefusal(mintPiece({ recipe: 'longsword:mithril', quality: 2, seed: 4242, maker: 'Silverthorn' }, '0123456789abcdef')), null);
  for (const w of ['shape', 'worn', 'locked', 'quest', 'summoned', 'bound', 'gold', 'letter', 'boat', 'arrows', 'stores', 'large']) assert.ok(GOOD_REFUSAL_WORDS[w], `words for ${w}`);
  assert.deepEqual([goodFamily(weapon), goodFamily(armour), goodFamily({ group: 'WomensClothing' }), goodFamily({ group: 'Gems' }), goodFamily({ group: 'Books' })],
    ['weapons', 'armour', 'clothing', 'jewellery', 'other']);
  assert.deepEqual(GOODS_FAMILIES.map(([f]) => f), ['weapons', 'armour', 'clothing', 'jewellery', 'other']);
  assert.deepEqual(MARKET_VIEWS.map(([v]) => v).slice(0, 4), ['materials', 'crafted', 'auctions', 'goods']);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', MODERATOR_HANDLES: 'Asynian' });
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
  /** A piece of the record's, listed as the List form sends it: its wire record and its index in the record. */
  const list = (who, pick, extra = {}) => s.call('/v1/market/list', {
    character: who.character, region: DF, kind: 'item', item: validLootList([record(who).save.items[pick]])?.[0] ?? null, pick, price: 50, hubs: HUBS, rid: rid(),
    currency: 'gold', realm: who.at(), ...extra,
  }, who.secret);
  const read = (who, view, extra = {}) => s.call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  const buy = (who, l, { region = DF, courier = 0, ...extra } = {}) => s.call('/v1/market/buy', {
    character: who.character, region, listing: l.id, units: 1, max: l.price + courier, hubs: HUBS, rid: rid(), realm: who.at(), ...extra,
  }, who.secret);
  const collect = (who, delivery, extra = {}) => s.call('/v1/market/collect', { character: who.character, delivery, rid: rid(), realm: who.at(), ...extra }, who.secret);
  const open = (who) => Number(raw.prepare(REALM_MARKET_OPEN_SQL).get(who.id, who.character).n);
  return { ...s, raw, record, seated, list, read, buy, collect, open };
}

test('MARKET-ANY service: a looted piece listed out of its seller\'s realm record in the listing\'s own batch, for gold; what may not go refused and nothing moved; a Drakes price refused; an offer that is not the record\'s piece refused; asked again, the record one on (mutants: the record unmoved; the record\'s piece unread; Drakes taken; the guard)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop();
  const eve = await s.seated('Eve', { items: [plain(weapon), sigilStone(), plain(armour)] });
  const before = s.record(eve);
  // a bound piece, offered at its own place: refused, the record as it stood
  assert.deepEqual((await s.list(eve, 1)).body, { error: 'market-not-good' });
  // no piece offered at all: refused in words, never a fault
  assert.deepEqual((await s.list(eve, 0, { item: null })).body, { error: 'market-not-good' });
  // a Drakes price: refused (law 3)
  assert.deepEqual((await s.list(eve, 0, { currency: 'marks' })).body, { error: 'market-goods-gold' });
  // an offer that is not the record's piece there - the armour named at the weapon's place, a weapon made whole
  assert.deepEqual((await s.list(eve, 0, { item: validLootList([plain(armour)])[0] })).body, { error: 'market-good-gone' });
  assert.deepEqual((await s.list(eve, 0, { item: { ...validLootList([plain(weapon)])[0], currentCondition: 1 } })).body, { error: 'market-good-gone' });
  // the record's own bound piece under a lawful offer's name: the RECORD's piece is read
  layRecord(s.env, eve.character, { ...before.save, items: [plain(weapon), { ...plain(weapon), bound: true }, plain(armour)] });
  assert.deepEqual((await s.list(eve, 1, { item: validLootList([plain(weapon)])[0] })).body, { error: 'market-not-good' });
  layRecord(s.env, eve.character, before.save);
  // no record named: a realm character must say where its record stands
  assert.equal((await s.list(eve, 0, { realm: undefined })).body.error, 'realm-needed');
  assert.deepEqual([s.record(eve).seq, s.record(eve).save.items.length], [before.seq, 3], 'nothing moved');
  // the weapon listed
  const at = eve.at();
  const r = await s.list(eve, 0, { rid: 'fb1001-listed-once', realm: at });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.listing.kind, r.body.listing.currency, r.body.listing.price, r.body.realm.seq], ['item', 'gold', 50, before.seq + 1]);
  assert.deepEqual(r.body.listing.item, validLootList([plain(weapon)])[0], 'the record\'s piece rides the listing');
  const after = s.record(eve);
  assert.deepEqual([after.seq, after.save.items.map((it) => it.templateIndex)], [before.seq + 1, [570, armour.templateIndex]], 'out of the record');
  assert.equal(s.open(eve), 1, 'the character\'s market business stands (its delete waits)');
  // the same act asked again where the record stood: the record is one on - its own act, landed (AUDIT REALM L1-F2)
  const again = await s.list(eve, 0, { rid: 'fb1001-listed-once', realm: at });
  assert.deepEqual([again.status, again.body], [409, { error: 'seq', seq: before.seq + 1 }]);
  // not a realm character's: no record to take a piece out of
  const mac = await s.registered('Mac');
  assert.deepEqual((await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'item', item: validLootList([plain(weapon)])[0], pick: 0, price: 5, hubs: HUBS, rid: rid(), currency: 'gold' }, mac.secret)).body,
    { error: 'market-gold-realm' });
});

test('MARKET-ANY service: a crafted piece whose maker\'s record is the seller\'s lists as a crafted piece, one whose record names another lists from the pack (not one bought with Drakes - AUDIT PROF-541 R2-S2); "My listings" says each held piece\'s way (mutants: the piece route skipped; a way misread)', async () => {
  const s = await stand();
  const own = mintPiece({ recipe: 'longsword:mithril', quality: 2, seed: 4242, maker: 'Eve' }, '0123456789abcdef');
  const theirs = mintPiece({ recipe: 'dagger:iron', quality: 1, seed: 77, maker: 'Mac' }, 'fedcba9876543210');
  const eve = await s.seated('Eve', { items: [plain(own), plain(theirs)] });
  const mac = await s.registered('Mac');
  const product = (who, p, recipe) => s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES (?, ?, ?, 'x', ?, 120, 5, 2, 1, 'p1.x', ?)`).run(p, who.id, who.character, recipe, _now);
  product(eve, own.provenance, 'longsword:mithril');
  product(mac, theirs.provenance, 'dagger:iron');
  product(eve, 'aaaaaaaaaaaaaaaa', 'dagger:iron');
  s.raw.prepare("UPDATE products SET listed = 1 WHERE provenance = 'aaaaaaaaaaaaaaaa'").run();
  assert.deepEqual((await s.list(eve, 0)).body, { error: 'market-piece-route' });
  const ways = (await s.read(eve, 'mine', { pieces: [own.provenance, theirs.provenance, 'aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'not-one'] })).body.ways;
  assert.deepEqual(ways, { [own.provenance]: 'yours', [theirs.provenance]: 'other', aaaaaaaaaaaaaaaa: 'elsewhere', bbbbbbbbbbbbbbbb: 'none' });
  assert.deepEqual((await s.read(eve, 'mine')).body.ways, {}, 'none named, none said');
  assert.equal(Object.keys((await s.read(eve, 'mine', { pieces: Array.from({ length: 90 }, (_, i) => i.toString(16).padStart(16, '0')) })).body.ways).length, MARKET_HELD_MAX);
  // AUDIT PROF-541 R2-S2: Mac's make bought with Drakes (or made of goods so bought) keeps its wall in Eve's pack - never
  // for gold; a gold-bought one lists
  s.raw.prepare("UPDATE products SET bought_with = 'marks' WHERE provenance = ?").run(theirs.provenance);
  assert.deepEqual((await s.list(eve, 1)).body, { error: 'market-drakes-goods' });
  assert.equal(s.record(eve).save.items.length, 2, 'the record untouched');
  s.raw.prepare("UPDATE products SET bought_with = 'gold' WHERE provenance = ?").run(theirs.provenance);
  const r = await s.list(eve, 1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.listing.item.provenance, theirs.provenance, 'Mac\'s make, from Eve\'s pack');
  assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(theirs.provenance).owner, mac.id, 'its record untouched');
});

test('MARKET-ANY service: bought here off the buyer\'s record (the price in gold, held for the seller less 5% and 1%), it comes by a delivery arrived at once; collected into the buyer\'s record once; by courier from another region after its time; the Goods view and the History name it (mutants: the delivery unwritten; the collect\'s record unmoved; collected twice; the guard)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop(11);
  const eve = await s.seated('Eve', { items: [plain(weapon), plain(armour)] });
  const tom = await s.seated('Tom', { goldPieces: 1000 });
  assert.equal((await s.list(eve, 0)).status, 200);
  const goods = await s.read(tom, 'goods');
  assert.equal(goods.status, 200, JSON.stringify(goods.body));
  const [row] = goods.body.rows;
  assert.deepEqual([row.kind, row.price, row.currency, row.item.templateIndex, row.road.courier, row.mine], ['item', 50, 'gold', weapon.templateIndex, 0, false]);
  assert.deepEqual((await s.read(tom, 'goods', { family: goodFamily(armour) })).body.rows, [], 'the family filter');
  assert.equal((await s.read(tom, 'goods', { family: goodFamily(weapon) })).body.rows.length, 1);
  // bought from a board of its own region - whole, whatever count is asked
  const b = await s.buy(tom, row, { units: 5 });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual([b.body.sale.kind, b.body.sale.here, s.record(tom).save.goldPieces], ['item', true, 950]);
  const d = b.body.delivery;
  assert.ok(d?.id && d.arrivesAt === _now, 'its delivery, arrived at once');
  assert.equal(Number(s.raw.prepare('SELECT gold FROM market_gold WHERE player = ?').get(eve.id).gold), goldSaleOf(0, 50).gets, 'the seller\'s share held');
  const road = (await s.read(tom, 'mine')).body.road;
  assert.deepEqual(road.map((x) => [x.kind, x.id, x.ready, x.item?.templateIndex]), [['item', d.id, true, weapon.templateIndex]]);
  assert.equal(s.open(tom), 1, 'the buyer\'s delete waits on it too');
  // collected: into the buyer's record, once
  const seq = s.record(tom).seq;
  assert.deepEqual((await s.collect(tom, d.id, { realm: undefined })).body, { error: 'realm-needed' });
  const c = await s.collect(tom, d.id);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.item, c.body.realm.seq], [validLootList([plain(weapon)])[0], seq + 1]);
  assert.deepEqual(s.record(tom).save.items, [validLootList([plain(weapon)])[0]], 'in the buyer\'s record');
  assert.equal((await s.collect(tom, d.id)).body.error, 'market-gone', 'once');
  assert.equal(s.open(tom), 0);
  // a crafted piece's collect never takes it, nor this one a crafted piece's door
  assert.equal((await s.call('/v1/market/collect', { character: tom.character, delivery: d.id, rid: rid() }, tom.secret)).body.error, 'market-gone');
  // the History names it
  const trades = (await s.read(tom, 'history')).body.trades;
  assert.deepEqual(trades.map((t) => [t.side, t.kind, t.item?.templateIndex, t.currency, t.total]), [['bought', 'item', weapon.templateIndex, 'gold', 50]]);
  // BY COURIER: listed in Wayrest, bought from Daggerfall - the courier a Mark's worth of gold a Mark, the piece on the road
  assert.equal((await s.list(eve, 0, { region: WR })).status, 200);
  const far = (await s.read(tom, 'goods')).body.rows[0];
  const courier = courierFee(1, ROAD) * MARK_WORTH_GOLD;
  assert.equal(far.road.courier, courierFee(1, ROAD));
  const fb = await s.buy(tom, far, { courier });
  assert.equal(fb.status, 200, JSON.stringify(fb.body));
  assert.equal(fb.body.sale.here, false);
  assert.equal((await s.collect(tom, fb.body.delivery.id)).body.error, 'market-on-road');
  _now += far.road.seconds;
  const fc = await s.collect(tom, fb.body.delivery.id);
  assert.equal(fc.status, 200, JSON.stringify(fc.body));
  assert.deepEqual(s.record(tom).save.items.map((it) => it.templateIndex), [weapon.templateIndex, armour.templateIndex]);
  assert.equal(s.record(tom).save.goldPieces, 950 - 50 - courier);
});

test('MARKET-ANY service: cancelled, expired or removed, the piece comes back to its seller by a delivery arrived at once, collected into the record it left - never twice (mutants: the cancel\'s delivery; the settle\'s; the return kind)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop(5);
  const eve = await s.seated('Eve', { items: [plain(weapon), plain(armour)] });
  const asy = await s.registered('Asynian');
  const ann = await s.registered('Ann');
  // cancelled
  const l1 = (await s.list(eve, 0)).body.listing;
  const cancel = await s.call('/v1/market/cancel', { character: eve.character, listing: l1.id, rid: rid() }, eve.secret);
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  assert.deepEqual(cancel.body.delivery, { id: l1.id });
  const c1 = await s.collect(eve, l1.id);
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.deepEqual(s.record(eve).save.items.map((it) => it.templateIndex), [armour.templateIndex, weapon.templateIndex], 'back in the record');
  // expired: back on the seller's next read
  const l2 = (await s.list(eve, 1)).body.listing;
  _now += MARKET_LISTING_S + 1;
  const road = (await s.read(eve, 'mine')).body.road;
  assert.deepEqual(road.map((x) => [x.kind, x.id, x.why, x.ready]), [['item', l2.id, 'returned', true]]);
  assert.equal((await s.collect(eve, l2.id)).status, 200);
  // reported and removed by a moderator: back too
  const l3 = (await s.list(eve, 0)).body.listing;
  assert.equal((await s.call('/v1/market/report', { listing: l3.id }, ann.secret)).status, 200);
  assert.equal((await s.read(asy, 'goods')).body.rows[0].reports, 1);
  assert.equal((await s.call('/v1/market/remove', { listing: l3.id }, asy.secret)).status, 200);
  assert.equal((await s.read(eve, 'mine')).body.road[0]?.id, l3.id);
  assert.equal((await s.collect(eve, l3.id)).status, 200);
  assert.equal(s.record(eve).save.items.length, 2, 'both pieces home, none twice');
  assert.equal(s.open(eve), 0);
});

test('MARKET-ANY migration: a listing, a sale and a delivery learn the pack\'s kind - every row, every report and every index kept (mutants: the reports lost; an index dropped)', () => {
  const dir = new URL('../server-account/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of files.filter((f) => f < '0044')) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const cols = db.prepare('PRAGMA table_info(players)').all().filter((c) => c.name === 'id' || (c.notnull && c.dflt_value == null));
  for (const id of ['p1', 'p2']) db.prepare(`INSERT INTO players (${cols.map((c) => c.name).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => (c.name === 'id' ? id : c.type === 'INTEGER' ? 1 : `${c.name}-${id}`)));
  db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n) VALUES ('L1','p1','c1',17,'material','ore:iron',5,5,3,1,10,20,'r1','n1')`);
  db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, provenance, units, own, price, wear, fee, at, expires_at, rid, n) VALUES ('L2','p1','c1',17,'piece','0123456789abcdef',1,1,30,900,1,10,20,'r2','n2')`);
  db.exec("INSERT INTO market_reports (listing, reporter, at) VALUES ('L1','p2',5), ('L2','p2',6)");
  db.exec(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, provenance, units, price, total, tax, from_region, to_region, arrives_at, at, day, n) VALUES ('p2','s1','c2','L2','p1','piece','0123456789abcdef',1,30,30,1,17,17,10,10,1,'n')`);
  db.exec(`INSERT INTO market_deliveries (id, player, char_id, provenance, wear, why, arrives_at, at) VALUES ('D1','p2','c2','0123456789abcdef',900,'bought',10,10)`);
  const tables = ['market_listings', 'market_reports', 'market_sales', 'market_deliveries'];
  const rows = (t) => JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all().map((r) => { const o = { ...r }; delete o.item; return o; }));
  const indexes = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' AND tbl_name IN ('market_listings', 'market_sales', 'market_deliveries', 'market_reports') ORDER BY name").all().map((r) => r.name);
  const was = Object.fromEntries(tables.map((t) => [t, rows(t)]));
  const idx = indexes();
  db.exec(readFileSync(new URL('0044_market_goods.sql', dir), 'utf8'));
  for (const t of tables) assert.equal(rows(t), was[t], `${t} kept`);
  assert.deepEqual(indexes(), idx, 'every index made again');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  // the pack's kind: gold alone, its record whole
  db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, price, fee, at, expires_at, rid, n, currency, item) VALUES ('L3','p1','c1',17,'item',1,1,30,1,10,20,'r3','n3','gold','{}')`);
  assert.throws(() => db.exec(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, price, fee, at, expires_at, rid, n, currency, item) VALUES ('L4','p1','c1',17,'item',1,1,30,1,10,20,'r4','n4','marks','{}')`), /CHECK/);
  assert.throws(() => db.exec(`INSERT INTO market_deliveries (id, player, char_id, why, arrives_at, at) VALUES ('D3','p2','c2','bought',10,10)`), /CHECK/);
});

// ─── THE CLIENT ──────────────────────────────────────────────────────

/** A realm character playing in a tab: its pack (`entity`, the save its checkpoints carry), its session, its pack side
 *  (systems/tradePack.js createMarketGoods) and its market book over the real Worker - the realm act and the wallet as the host's. */
async function playing(s, handle, save) {
  const who = await s.registered(handle);
  const entity = { name: handle, level: 5, goldPieces: 0, items: [], ...save };
  const R = await seatRealm(s.env, who.secret, handle, entity);
  who.character = R.id;
  who.at = R.at;
  const storage = sessionStorageOf(SESSION_KEY, who);
  const at = R.at();
  const session = createRealmSession({ io: realmIo({ fetch: s.fetch, storage }), id: at.id, lease: at.lease, seq: at.seq });
  const said = [];
  const goods = createMarketGoods(entity, { say: (t) => said.push(t) });
  const book = createMarketBook({
    door: accountMarket({ fetch: s.fetch, storage }), storage: new Map() && { getItem: () => null, setItem: () => {} }, character: () => who.character, sleep: noWait,
    realm: { act: (o) => realmGoldAct({ session, checkpoint: () => session.checkpoint(JSON.stringify(entity)), wait: noWait, ...o }), abandon: (w) => session.abandon(w) },
    wallet: () => ({ gold: () => entity.goldPieces, pay: (n) => { entity.goldPieces -= n; }, credit: (n) => { entity.goldPieces += n; }, bank: (n) => { entity.goldPieces += n; } }),
    goods: { receive: (rec) => goods.receive(rec) },
  });
  return { who, entity, session, goods, book, said };
}

test('MARKET-ANY client: the pack side offers what may go and says why the rest may not; a listing takes the piece out of the pack inside the realm\'s hold, the record the same; a refusal puts it back; bought, the piece is collected into the buyer\'s pack and record alike (mutants: taken before the hold; never put back; the collect unmade; received twice)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop();
  const locked = plain(armour);
  setLocked(locked, true);
  const arrows = createWeapon(ARROW_TEMPLATE, 0, seededRng(3));
  const eve = await playing(s, 'Eve', { items: [plain(weapon), sigilStone(), arrows, locked, { templateIndex: 9999, name: 'no row' }] });
  const words = eve.goods.goods().map((g) => [g.item.templateIndex, g.why]);
  assert.deepEqual(words, [[weapon.templateIndex, null], [570, 'bound to you'], [ARROW_TEMPLATE, 'arrows go in a quiver'], [armour.templateIndex, 'locked - unlock it first'],
    [9999, 'not a piece the market knows']]);
  // INT1 (PIN MOVED): a piece of no template is one no honest client holds - the judge holds the trade of a character whose
  // checkpoint carries one (server-account/src/judge.js) - so it says its word above and leaves the pack before the act
  eve.entity.items.splice(4, 1);
  const sword = eve.entity.items[0];
  const g = eve.goods.good(sword);
  assert.equal(g.pick, 0);
  // the piece leaves the pack only inside the hold: no checkpoint carries a pack without it while the record holds it
  const take = g.take;
  let during = null;
  g.take = () => { during = eve.session.checkpoint(JSON.stringify(eve.entity)); return take(); };
  const seq = eve.session.seq;
  const r = await eve.book.list({ region: DF, kind: 'item', item: g.offered, pick: g.pick, price: 50, hubs: {}, currency: 'gold' }, null, g);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(await during, { ok: false, error: 'held' }, 'taken inside the realm\'s hold - no checkpoint goes meanwhile');
  assert.ok(eve.session.seq >= seq + 2, 'the save checkpointed before the act, and the record one on by the act');
  assert.deepEqual(eve.entity.items.map((it) => it.templateIndex), [570, ARROW_TEMPLATE, armour.templateIndex], 'out of the pack');
  assert.deepEqual(s.record(eve.who).save.items.map((it) => it.templateIndex), [570, ARROW_TEMPLATE, armour.templateIndex], 'out of the record, the same');
  // a refusal - the armour unlocked and offered in Drakes - puts it back
  setLocked(eve.entity.items[2], false);
  const a = eve.goods.good(eve.entity.items[2]);
  const no = await eve.book.list({ region: DF, kind: 'item', item: a.offered, pick: a.pick, price: 50, hubs: {} }, null, a);
  assert.deepEqual([no.ok, no.error], [false, 'market-goods-gold']);
  assert.ok(eve.entity.items.some((it) => it.templateIndex === armour.templateIndex), 'back in the pack');
  // a piece the pack no longer holds where it was is never asked for (the pack moved under the List form)
  const back = eve.entity.items.find((it) => it.templateIndex === armour.templateIndex);
  const gone = eve.goods.good(back);
  const seqBefore = s.record(eve.who).seq;
  eve.entity.items.reverse();
  assert.equal((await eve.book.list({ region: DF, kind: 'item', item: gone.offered, pick: gone.pick, price: 5, hubs: {}, currency: 'gold' }, null, gone)).error, 'piece-held');
  assert.ok(eve.entity.items.includes(back), 'still in the pack');
  assert.ok(s.record(eve.who).save.items.some((it) => it.templateIndex === armour.templateIndex), 'and in the record');
  assert.ok(s.record(eve.who).seq >= seqBefore);
  eve.entity.items.reverse();
  // Tom buys it off his purse, and his book collects it into his pack and his record
  const tom = await playing(s, 'Tom', { goldPieces: 500 });
  const row = (await tom.book.read('goods', { region: DF, hubs: HUBS })).data.rows[0];
  const b = await tom.book.buy({ region: DF, listing: row.id, units: 1, max: 50, hubs: HUBS, currency: 'gold' }, () => {});
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(tom.entity.goldPieces, 450);
  await tom.book.read('mine', { region: DF, hubs: HUBS }, { force: true });
  const st = await tom.book.settle(() => {}, () => {});
  assert.equal(st.settled, 1);
  assert.deepEqual(tom.entity.items.map((it) => it.templateIndex), [weapon.templateIndex], 'in his pack');
  assert.deepEqual(tom.said, [`${tom.goods.goodName(tom.entity.items[0])} is in your pack.`]);
  assert.deepEqual(s.record(tom.who).save.items.map((it) => it.templateIndex), [weapon.templateIndex], 'and his record');
  assert.equal(s.record(tom.who).save.goldPieces, 450);
  assert.equal((await tom.book.settle(() => {}, () => {})).settled, 0, 'once');
  assert.equal(tom.entity.items.length, 1);
  assert.equal(tom.session.lost, null, 'the session plays on');
});

test('MARKET-ANY client: a collected piece this game will not hold - or an answer that is a repeat - ends the session (a join reads the record), never a second piece (mutants: received regardless; the repeat received)', async () => {
  for (const answer of [{ ok: true, status: 200, data: { item: { ...sigilStone() }, realm: { seq: 2 } } }, { ok: true, status: 200, data: { repeat: true, item: { templateIndex: 113, group: 'Weapons', name: 'Dagger' }, realm: { seq: 2 } } }]) {
    const pack = { items: [] };
    const goods = createMarketGoods(pack);
    let abandoned = null;
    const session = { transact: async (fn) => fn({ id: 'r1', lease: 'l', seq: 1 }) };
    const door = { account: () => 'acct', read: async () => ({ ok: true, data: { road: [{ kind: 'item', id: 'D1', ready: true, character: 'r1', item: answer.data.item }] } }), collect: async () => answer };
    const book = createMarketBook({ door, storage: { getItem: () => null, setItem: () => {} }, character: () => 'r1', sleep: noWait,
      realm: { act: (o) => realmGoldAct({ session, checkpoint: () => {}, wait: noWait, ...o }), abandon: (w) => { abandoned = w; } }, wallet: () => null, goods: { receive: (r) => goods.receive(r) } });
    await book.read('mine', { region: DF });
    await book.settle(() => {}, () => {});
    assert.deepEqual([pack.items.length, abandoned], [0, 'unknown']);
  }
});

test('MARKET-ANY tab: Goods after the Auctions - each piece its name, condition, price in gold and courier, Buy off the purse; the List form\'s "A piece from your pack (gold)" offers what may go and names the rest with why; crafted pieces offered as the service says (mutants: the option shown to a character with no gold trade; the refused unsaid; a crafted piece of another\'s offered as one)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop();
  const own = mintPiece({ recipe: 'longsword:mithril', quality: 2, seed: 4242, maker: 'Eve' }, '0123456789abcdef');
  const theirs = mintPiece({ recipe: 'dagger:iron', quality: 1, seed: 77, maker: 'Mac' }, 'fedcba9876543210');
  const eve = await playing(s, 'Eve', { items: [plain(weapon), sigilStone(), plain(armour), plain(own), plain(theirs)] });
  const mac = await s.registered('Mac');
  // INT2 (PIN MOVED): each row the piece's own template - the judge reads a crafted piece's provenance against the template
  // the service minted it for (server-account/src/judge.js judgeProducts)
  for (const [who, piece] of [[eve.who, own], [mac, theirs]]) {
    s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'x', ?, ?, ?, 1, 1, 'p1.x', ?)`).run(piece.provenance, who.id, who.character, piece.recipe, piece.templateIndex, piece.material ?? 0, _now);
  }
  let root = null;
  const said = [];
  const m = {
    book: eve.book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], hubs: HUBS,
    name: (k) => k, countName: (k) => k,
    pieces: () => eve.entity.items.filter((it) => it.provenance).map((item) => ({ item, where: 'pack', name: eve.goods.goodName(item) })),
    take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a crafted piece', weavers: [], stock: async () => ({ ok: true }),
    goods: () => eve.goods.goods(), good: (it) => eve.goods.good(it), goodName: (r) => eve.goods.goodName(r),
  };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => { const r = await start(); said.push(r?.text); }, rerender: () => draw(), nowS: () => _now, alive: () => true });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  /** Until `cond` holds (the real Worker, the realm session's checkpoints and the tab's reads run on their own tasks) -
   *  never a fixed count of ticks, which a loaded machine outruns. */
  const until = async (cond, what) => {
    for (let i = 0; i < 4000 && !cond(); i++) await new Promise((r) => setTimeout(r, 2));
    assert.ok(cond(), `waited for ${what}`);
  };
  const read = (t, view) => () => t.state.view === view && !t.state.loading && !!t.state.data;
  await tab.open();
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  const selects = () => [...root.querySelectorAll('select')];
  buttons().find((b) => b.textContent === 'My listings').onclick();
  await until(read(tab, 'mine'), 'My listings read');
  const what = selects().find((x) => x.getAttribute('aria-label') === 'What to list');
  assert.deepEqual(opts(what).map((o) => o.value), ['material', 'piece', 'auction', 'item']);
  // a crafted piece: Eve's own alone, the other named
  what.value = 'piece'; what.onchange();
  assert.deepEqual(opts(selects().find((x) => x.getAttribute('aria-label') === 'Crafted piece')).map((o) => o.value), [own.provenance]);
  assert.match(text(), /1 crafted piece you hold is another player's by its maker's record - only they sell it as crafted\. List it from your pack for gold instead\./);   // AUDIT 657 D7: BOARD-UI (PIN MOVED): the words cut
  // a piece from the pack: the looted pieces and Mac's make; the stone and Eve's own make said
  selects().find((x) => x.getAttribute('aria-label') === 'What to list').value = 'item';
  selects().find((x) => x.getAttribute('aria-label') === 'What to list').onchange();
  const pick = selects().find((x) => x.getAttribute('aria-label') === 'Piece from your pack');
  assert.deepEqual(opts(pick).map((o) => o.textContent), [eve.goods.goodName(weapon), eve.goods.goodName(armour), eve.goods.goodName(theirs)]);
  assert.match(text(), new RegExp(`Not for the market: Deadlands Ember \\(bound to you\\); ${eve.goods.goodName(own)} \\(your own make - list it as a crafted piece\\)\\.`));
  assert.match(text(), /No fee to list\. Up for 72 hours on every board\. If it sells you get \d+ gold \(after a 1% fee and 5% tax\), collected at a bank\. It leaves your pack now and comes back if it does not sell\./);   // AUDIT 657 B9 (PIN MOVED): the 1% the sale's fee; BOARD-UI (PIN MOVED): its form says gold, its terms one line
  assert.equal(selects().some((x) => x.getAttribute('aria-label') === 'Currency'), false, 'no Drakes to choose');
  const price = [...root.querySelectorAll('input')].find((i) => i.getAttribute('data-focus') === 'list-price');
  price.value = '75'; price.oninput();
  await buttons().find((b) => b.textContent === 'List').onclick();
  const listed = () => said.filter((t) => typeof t === 'string' && t.startsWith('Listed')).length;
  await until(() => listed() === 1 && read(tab, 'mine')() && (tab.state.data.rows ?? []).length === 1, 'the listing and the read after it');
  assert.equal(said.at(-1), `Listed ${eve.goods.goodName(weapon)} at 75 gold.`);
  assert.equal(eve.entity.items.some((it) => it.templateIndex === weapon.templateIndex), false, 'out of the pack');
  assert.match(text(), new RegExp(`${eve.goods.goodName(weapon)}75 goldhere`), 'My listings names it');
  // cancelled: it comes back by a delivery the tab collects as its read shows it arrived - into the pack and the record
  await buttons().find((b) => b.textContent === 'Cancel').onclick();
  await until(() => eve.entity.items.some((it) => it.templateIndex === weapon.templateIndex) && !eve.book.busy && read(tab, 'mine')(), 'the piece collected');
  assert.ok(eve.entity.items.some((it) => it.templateIndex === weapon.templateIndex), 'back in the pack');
  assert.ok(s.record(eve.who).save.items.some((it) => it.templateIndex === weapon.templateIndex), 'and the record');
  // listed again for the Goods view below
  selects().find((x) => x.getAttribute('aria-label') === 'What to list').value = 'item';
  selects().find((x) => x.getAttribute('aria-label') === 'What to list').onchange();
  const which = selects().find((x) => x.getAttribute('aria-label') === 'Piece from your pack');
  which.value = opts(which).find((o) => o.textContent === eve.goods.goodName(weapon)).value;
  which.onchange();
  const again = [...root.querySelectorAll('input')].find((i) => i.getAttribute('data-focus') === 'list-price');
  again.value = '75'; again.oninput();
  await buttons().find((b) => b.textContent === 'List').onclick();
  await until(() => listed() === 2 && read(tab, 'mine')(), 'the second listing');
  // Goods: the row, its condition, Buy in gold - a character with no gold trade sees no List option and is told
  buttons().find((b) => b.textContent === 'Goods').onclick();
  await until(() => read(tab, 'goods')() && (tab.state.data.rows ?? []).length === 1, 'the Goods read');
  assert.match(text(), new RegExp(`${eve.goods.goodName(weapon)}whole75 goldhere`));
  const noGold = createMarketTab({ ...m, book: { ...eve.book, state: eve.book.state, read: eve.book.read, cached: eve.book.cached, get goldOk() { return false; }, purse: () => null, pending: 0, settle: eve.book.settle } },
    { busy: () => false, run: async () => {}, rerender: () => {}, nowS: () => _now, alive: () => true });
  await noGold.open();
  const body = noGold.body();
  [...body.querySelectorAll('button')].find((b) => b.textContent === 'My listings').onclick();
  await until(read(noGold, 'mine'), 'the other tab\'s My listings read');
  const kinds = [...noGold.body().querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'What to list');
  assert.deepEqual(opts(kinds).map((o) => o.value), ['material', 'piece', 'auction'], 'gold is a realm character\'s');
});

test('MARKET-ANY service: a listing the decision cannot write - the thirtieth place taken between the look and the batch - rolls the record back with it; a delivery another collect took between rolls the collector\'s record back - the piece never twice (mutants: either guard)', async () => {
  const s = await stand();
  const { weapon, armour } = lootDrop();
  const eve = await s.seated('Eve', { items: [plain(weapon), plain(armour)] });
  /** The next batch, run after `race` - another act landing between the look and the decision. */
  const between = (race) => { const batch = s.env.DB.batch.bind(s.env.DB); s.env.DB.batch = async (list) => { s.env.DB.batch = batch; race(); return batch(list); }; };
  const fill = (n) => {
    for (let i = 0; i < n; i++) {
      s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n)
        VALUES (?, ?, ?, 17, 'material', 'ore:iron', 1, 1, 1, 1, ?, ?, ?, 'n')`).run(`fill${i}`, eve.id, eve.character, _now, _now + MARKET_LISTING_S, `fill-rid-${i}`);
    }
  };
  fill(29);
  const before = s.record(eve);
  // the look sees 29; the thirtieth lands as the record is prepared - between that and the batch
  const record = s.env.SAVES.put.bind(s.env.SAVES);
  s.env.SAVES.put = async (k, v) => { s.env.SAVES.put = record; s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n)
    VALUES ('fill29', ?, ?, 17, 'material', 'ore:iron', 1, 1, 1, 1, ?, ?, 'fill-rid-29', 'n')`).run(eve.id, eve.character, _now, _now + MARKET_LISTING_S); return record(k, v); };
  const r = await s.list(eve, 0);
  assert.deepEqual(r.body, { error: 'market-listings-max' });
  assert.deepEqual([s.record(eve).seq, s.record(eve).save.items.length], [before.seq, 2], 'the record as it stood - the piece still in it');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM market_listings WHERE kind = 'item'").get().n, 0);
  // a delivery: another collect takes it between the look and the batch
  s.raw.prepare("DELETE FROM market_listings WHERE id LIKE 'fill%'").run();
  const tom = await s.seated('Tom', { goldPieces: 100 });
  const l = (await s.list(eve, 0)).body.listing;
  const d = (await s.buy(tom, l)).body.delivery;
  const was = s.record(tom);
  between(() => s.raw.prepare('UPDATE market_deliveries SET collected = 1 WHERE id = ?').run(d.id));
  assert.equal((await s.collect(tom, d.id)).body.error, 'market-gone');
  assert.deepEqual([s.record(tom).seq, s.record(tom).save.items], [was.seq, was.save.items], 'the collector\'s record as it stood');
});

test('MARKET-ANY wiring: the host builds the pack side over the live player (a piece another book keeps left out), hands the tab its goods, a piece\'s listing and a record\'s name, and the book the realm act\'s abandon and the collect\'s receive; the service routes the list and the collect with the realm\'s records (mutants: the keeper unasked; the tab\'s goods unwired; the routes without R2)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const marketGoods = createMarketGoods\(playerEntity, \{ kept: \(pv\) => pieceKept\(pv\), say: \(t\) => townTalk\.say\(t\) \}\);/);
  assert.match(w, /drop: marketDrop, goods: \(\) => marketGoods\.goods\(\), good: \(it\) => marketGoods\.good\(it\), goodName: \(rec\) => marketGoods\.goodName\(rec\),/);
  assert.match(w, /abandon: \(why\) => realmSession\.abandon\(why\) \} : null, goods: realmSession \? \{ receive: \(rec\) => marketGoods\.receive\(rec\) \} : null,/);
  const index = src('server-account/src/index.js');
  assert.match(index, /'\/v1\/market\/list': \(\) => marketList\(mctx, who\.player, env, body\),/);
  assert.match(index, /'\/v1\/market\/collect': \(\) => marketCollect\(mctx, who\.player, env, body\),/);
  // the pack side keeps out what another book holds
  const kept = createMarketGoods({ items: [mintPiece({ recipe: 'dagger:iron', quality: 1, seed: 1 }, '00000000000000aa'), lootDrop().weapon] }, { kept: (pv) => pv === '00000000000000aa' });
  assert.deepEqual(kept.goods().map((g) => g.item.provenance ?? null), [null]);
});

test('MARKET-ANY book: "My listings" read again when the crafted pieces the tab holds change - the minute\'s cache keyed on them (mutant: the pieces unkeyed)', async () => {
  const asked = [];
  const door = { account: () => 'acct', read: async (b) => { asked.push(b.pieces ?? null); return { ok: true, data: { rows: [], ways: Object.fromEntries((b.pieces ?? []).map((p) => [p, 'yours'])) } }; } };
  const book = createMarketBook({ door, storage: { getItem: () => null, setItem: () => {} }, character: () => 'r1', sleep: noWait });
  const one = await book.read('mine', { region: DF, pieces: ['00000000000000aa'] });
  const two = await book.read('mine', { region: DF, pieces: ['00000000000000aa', '00000000000000bb'] });
  await book.read('mine', { region: DF, pieces: ['00000000000000aa', '00000000000000bb'] });
  assert.deepEqual(asked, [['00000000000000aa'], ['00000000000000aa', '00000000000000bb']]);
  assert.deepEqual([Object.keys(one.data.ways), Object.keys(two.data.ways)], [['00000000000000aa'], ['00000000000000aa', '00000000000000bb']]);
});

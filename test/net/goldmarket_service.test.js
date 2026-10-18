// GOLD-MARKET (2026-09-30, Mac: "Allow trading with gold or drakes on the marketplace"; "Gold listings, walled") - THE
// SERVICE: a listing names its currency. A gold listing is a realm character's, of its own units and those gold bought;
// it is bought off the buyer's realm record in the same batch that decides the sale (the record rolled back with a sale
// that does not land), its tax and its fee burnt out of the sale, the seller's share held for its character until its
// own record collects it into a bank account. THE WALL: what gold bought comes into the Stores as `gold` (a piece marked
// `bought_with`) and goes to the pack or back on the market for gold - no station, craft, writ, fill or Drakes listing
// takes it - and nothing Drakes bought lists for gold. Driven through the real Worker over node:sqlite with every
// migration applied, and R2 beside it (test/accountDb.mjs, test/realmSeat.mjs). bible/06-Systems/Professions-Arc.md 10.8.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, layRecord, holdPieces } from '../realmSeat.mjs';   // INT19: a crafted piece in its seller's record
import { saleTax, listingFee, goldSaleOf, MARKET_GOLD_HELD_MAX, courierFee } from '../../src/net/marketLaw.js';
import { MARK_WORTH_GOLD } from '../../src/net/marksLaw.js';
import { REALM_MARKET_OPEN_SQL } from '../../server-account/src/realm.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `gold-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const stores = (who, m, character = who.character) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin')
    .all(who.id, character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty, character = who.character) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, m, origin, qty);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const held = (who) => Number(raw.prepare('SELECT gold FROM market_gold WHERE player = ? AND char_id = ?').get(who.id, who.character)?.gold ?? 0);
  /** A realm character's record as R2 holds it now, and its sequence. */
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  /** A registered account playing a realm character: its Stores, its record and its gold are that character's. */
  const seated = async (handle, save) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], ...save });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  /** PIN MOVED (INT19, Integrity-Arc section 7): a crafted piece lists out of its seller's realm record - it stands there too. */
  const piece = (who, provenance, recipe = 'longsword:mithril') => {
    raw.prepare(`INSERT INTO products
      (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'Silverthorn', ?, 120, 5, 2, 4242, 'p1.x', ?)`)
      .run(provenance, who.id, who.character, recipe, _now);
    if (who.at) holdPieces(s.env, who.character, [{ provenance }]);
  };
  const read = (who, view, extra = {}) => s.call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  const list = (who, extra = {}) => s.call('/v1/market/list', { character: who.character, region: DF, kind: 'material', material: 'ore:mithril', units: 10, price: 80, hubs: HUBS, rid: rid(), currency: 'gold', ...extra }, who.secret);
  /** A buy of `units` of `l` at its exact cost - the price, and a courier's `courier` gold where the road asks one. */
  const buy = (who, l, { units = 5, courier = 0, ...extra } = {}) => s.call('/v1/market/buy', {
    character: who.character, region: DF, listing: l.id, units, max: (l.kind === 'piece' ? 1 : units) * l.price + courier, hubs: HUBS, rid: rid(), realm: who.at?.(), ...extra,
  }, who.secret);
  return { ...s, raw, stores, give, balance, fund, held, record, seated, piece, read, list, buy };
}

// ─── A GOLD LISTING ──────────────────────────────────────────────────

test('GOLD-MARKET service: a gold listing - a realm character\'s alone, its own units and gold\'s (never Drakes\'), no Drakes fee now; read in the gold view alone', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  s.give(eve, 'ore:mithril', 'own', 20);
  s.give(eve, 'ore:mithril', 'bought', 30);
  const r = await s.list(eve);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.listing.currency, r.body.listing.units, r.body.listing.price], ['gold', 10, 80]);
  assert.equal(s.balance(eve), 0, 'no Drakes held, none asked: a gold listing\'s fee comes of its sales');
  assert.deepEqual(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'market-fee'").get().n, 0, 'no fee burnt at listing');
  assert.deepEqual(s.stores(eve, 'ore:mithril'), [['bought', 30], ['own', 10]], 'its own units: the Drakes\' bought ones stay');
  // what Drakes bought never lists for gold - the Bank's cap and spread stand
  assert.deepEqual((await s.list(eve, { units: 11 })).body, { error: 'market-drakes-goods' }, 'ten own left: the eleventh would be Drakes\'');
  assert.deepEqual((await s.list(eve, { units: 41 })).body, { error: 'stores-short' });
  // a character that is not the realm's: its gold is its own save's, no record the service moves
  const mac = await s.registered('Mac');
  s.give(mac, 'ore:mithril', 'own', 20);
  assert.deepEqual((await s.list(mac)).body, { error: 'market-gold-realm' });
  assert.equal((await s.list(mac, { currency: 'pearls' })).body.error, 'bad-act');
  // one currency a view
  const ann = await s.registered('Ann');
  const gold = await s.read(ann, 'materials', { material: 'ore:mithril', currency: 'gold' });
  assert.equal(gold.status, 200, JSON.stringify(gold.body));
  assert.deepEqual(gold.body.rows.map((x) => [x.currency, x.price]), [['gold', 80]]);
  assert.deepEqual((await s.read(ann, 'materials', { material: 'ore:mithril' })).body.rows, [], 'the Drakes view shows no gold price');
  assert.equal((await s.read(ann, 'materials', { currency: 'pearls' })).body.error, 'bad-act');
});

// ─── A GOLD BUY ──────────────────────────────────────────────────────

test('GOLD-MARKET service: a gold buy - paid off the buyer\'s record (purse first) in the batch that decides it, the goods gold\'s in the Stores, the tax and the fee burnt, the seller\'s share held; asked twice one; Drakes untouched', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 1_000 });
  s.give(eve, 'ore:mithril', 'own', 20);
  s.fund(tom, 500);
  const { body: { listing: l } } = await s.list(eve);
  const before = s.record(tom);
  const r = await s.buy(tom, l);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const { tax, fee, gets } = goldSaleOf(0, 400);
  assert.deepEqual([tax, fee, gets], [saleTax(400), listingFee(400), 400 - 20 - 4]);
  assert.deepEqual([r.body.sale.total, r.body.sale.tax, r.body.sale.courier, r.body.realm.seq], [400, tax, 0, before.seq + 1]);
  const after = s.record(tom);
  assert.deepEqual([after.seq, after.save.goldPieces], [before.seq + 1, 600], 'the record moved with the sale: 400 gold from the purse');
  assert.deepEqual(s.stores(tom, 'ore:mithril'), [['gold', 5]], 'into the Stores as gold\'s');
  assert.deepEqual(r.body.store, { material: 'ore:mithril', own: 0, bought: 0, gold: 5 });
  assert.equal(s.held(eve), gets, 'the seller\'s share held for its character');
  assert.equal(s.balance(tom), 500, 'no Drakes moved');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind LIKE 'market-%'").get().n, 0, 'the Drakes\' ledger never hears of gold');
  assert.equal(s.raw.prepare("SELECT SUM(units) AS u FROM market_gold_prices WHERE material = 'ore:mithril' AND price = 80").get().u, 5, 'gold\'s own price table');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM market_prices').get().n, 0, 'the Drakes\' medians never read a gold price');
  // asked twice (its answer lost): the record one on is the act, landed - the service answers the sale again
  const again = await s.buy(tom, l, { rid: `gold-${String(_rid).padStart(6, '0')}`, realm: { ...tom.at(), seq: before.seq } });
  assert.equal(again.body.error, 'seq', 'the first word is where the record stands');
  assert.equal(again.body.seq, before.seq + 1);
  // the tax is of the listing's running total, as a Drakes sale's
  const second = await s.buy(tom, l, { units: 5 });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.sale.tax, goldSaleOf(400, 400).tax);
  assert.equal(s.raw.prepare('SELECT state FROM market_listings WHERE id = ?').get(l.id).state, 'sold');
  assert.equal(s.record(tom).save.goldPieces, 200);
});

test('GOLD-MARKET service: each currency its own buyers - a Drakes buy of a gold listing and a record\'s buy of a Drakes listing refused; a purse short refused and nothing moved; a sale that does not land rolls the record back', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 100 });
  const mac = await s.registered('Mac');
  s.give(eve, 'ore:mithril', 'own', 20);
  s.give(mac, 'ore:mithril', 'own', 20);
  s.fund(mac, 100);
  s.fund(tom, 1000);
  const { body: { listing: g } } = await s.list(eve);
  const { body: { listing: d } } = await s.list(mac, { currency: 'marks', price: 8 });
  assert.equal(d.currency, 'marks');
  assert.deepEqual((await s.buy(tom, g, { realm: null })).body, { error: 'market-gold-realm' }, 'a gold listing is bought with gold');
  assert.deepEqual((await s.buy(tom, d)).body, { error: 'market-currency' }, 'a Drakes listing with Drakes');
  assert.deepEqual((await s.buy(mac, g, { realm: null })).body, { error: 'market-gold-realm' }, 'a character not the realm\'s buys no gold listing');
  const before = s.record(tom);
  assert.deepEqual((await s.buy(tom, g)).body, { error: 'realm-gold' }, '400 asked of 100');
  assert.deepEqual(s.record(tom), before, 'nothing moved');
  // the Stores full here: the decision refuses, and the record's step rolls back with it
  s.give(tom, 'ore:mithril', 'own', 4999);
  const rich = s.record(tom);
  rich.save.goldPieces = 10_000;
  layRecord(s.env, tom.character, rich.save);
  assert.deepEqual((await s.buy(tom, g)).body, { error: 'stores-full' });
  const now = s.record(tom);
  assert.deepEqual([now.seq, now.save.goldPieces], [rich.seq, 10_000], 'the record where it stood, its gold kept');
  assert.equal(s.held(eve), 0);
  assert.equal(s.raw.prepare('SELECT own + bought AS n FROM market_listings WHERE id = ?').get(g.id).n, 10, 'the listing whole');
  // the seller's held gold at its bound
  s.give(tom, 'ore:mithril', 'own', 0);
  s.raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, ?)').run(eve.id, eve.character, MARKET_GOLD_HELD_MAX - 10);
  assert.deepEqual((await s.buy(tom, g)).body, { error: 'market-gold-full' });
  assert.equal(s.record(tom).seq, rich.seq, 'and again nothing moved');
});

test('GOLD-MARKET service: by courier - the courier\'s fee a Drake\'s worth of gold a Drake, off the record with the price; the goods arrive gold\'s', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 100_000 });
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * 86_400, tom.id);
  s.give(eve, 'ore:mithril', 'own', 20);
  const { body: { listing: l } } = await s.list(eve, { region: WR });
  const row = (await s.read(tom, 'materials', { material: 'ore:mithril', currency: 'gold' })).body.rows[0];
  const courier = courierFee(5, row.road.road) * MARK_WORTH_GOLD;
  assert.deepEqual((await s.buy(tom, l, { courier: courier - 1 })).body, { error: 'market-price-moved' }, 'the exact cost, never a guess');
  assert.deepEqual((await s.buy(tom, l, { courier: courier + 1 })).body, { error: 'market-price-moved' }, 'nor more: the purse paid what it named');
  const r = await s.buy(tom, l, { courier });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sale.courier, courier, 'a Drake\'s worth of gold a Drake');
  assert.equal(r.body.sale.here, false);
  assert.equal(s.record(tom).save.goldPieces, 100_000 - 400 - r.body.sale.courier);
  _now += 3 * 86_400;
  await s.read(tom, 'mine');
  assert.deepEqual(s.stores(tom, 'ore:mithril'), [['gold', 5]], 'arrived gold\'s');
  _now = T0;
});

// ─── THE WALL ────────────────────────────────────────────────────────

test('GOLD-MARKET service: THE WALL - gold\'s units withdraw to the pack (first) and list again for gold; no Drakes listing, fill or forge takes them', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 10_000 });
  s.give(eve, 'metal:iron', 'own', 40);
  const { body: { listing: l } } = await s.list(eve, { material: 'metal:iron', units: 20, price: 5 });
  assert.equal((await s.buy(tom, l, { units: 20 })).status, 200);
  assert.deepEqual(s.stores(tom, 'metal:iron'), [['gold', 20]]);
  s.fund(tom, 1000);
  assert.deepEqual((await s.list(tom, { material: 'metal:iron', units: 1, currency: 'marks' })).body, { error: 'market-gold-goods' }, 'never for Drakes');
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: tom.character, recipe: 'ingot:iron', count: 1, rid: rid() }, tom.secret)).body, { error: 'stores-gold' }, 'no forge');
  const mac = await s.registered('Mac');
  s.fund(mac, 10_000);
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'metal:iron', units: 5, price: 10, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.deepEqual((await s.call('/v1/market/fill', { character: tom.character, region: DF, order: o.body.order.id, units: 5, hubs: HUBS, rid: rid() }, tom.secret)).body, { error: 'market-gold-goods' }, 'no Drakes for gold\'s goods');
  // back on the market for gold, and to the pack
  const re = await s.list(tom, { material: 'metal:iron', units: 5, price: 9 });
  assert.equal(re.status, 200, JSON.stringify(re.body));
  assert.equal(s.raw.prepare('SELECT bought FROM market_listings WHERE id = ?').get(re.body.listing.id).bought, 5, 'a gold listing\'s `bought` holds its gold units');
  const w = await s.call('/v1/stores/withdraw', { character: tom.character, material: 'metal:iron', qty: 5, rid: rid() }, tom.secret);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.deepEqual(s.stores(tom, 'metal:iron'), [['gold', 10]]);
  // gold's units first out of the pack's way: own ones stay for the stations
  s.give(tom, 'metal:iron', 'own', 4);
  await s.call('/v1/stores/withdraw', { character: tom.character, material: 'metal:iron', qty: 3, rid: rid() }, tom.secret);
  assert.deepEqual(s.stores(tom, 'metal:iron'), [['gold', 7], ['own', 4]]);
  // the forge takes the own ones alone
  const sm = await s.call('/v1/prof/smelt', { character: tom.character, recipe: 'ingot:iron', count: 2, rid: rid() }, tom.secret);
  assert.equal(sm.status, 200, JSON.stringify(sm.body));
  assert.deepEqual(s.stores(tom, 'metal:iron'), [['gold', 7]]);
  // a cancelled gold listing hands its gold units back as gold's
  const x = await s.call('/v1/market/cancel', { character: tom.character, listing: re.body.listing.id, rid: rid() }, tom.secret);
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual(s.stores(tom, 'metal:iron'), [['gold', 12]]);
});

const GP = '0123456789abcdef', MP = 'fedcba9876543210';
test('GOLD-MARKET service: THE WALL at every door - an anvil\'s craft, a Court writ, a guild writ\'s supply and the guild Stores take none of gold\'s units; each says so, and takes the own ones', async () => {
  const s = await stand();
  // the anvil (PROF3): a Repair Kit of an Iron Ingot and a Cured Leather
  // INT16 (Integrity-Arc section 7): the craft and the Court writ are progression claims, asked of the account's seated realm character
  const mac = await s.seated('Mac');
  s.give(mac, 'ingot:iron', 'gold', 2);
  s.give(mac, 'leather:cured', 'own', 2);
  const craft = (extra = {}) => s.call('/v1/prof/craft', { character: mac.character, recipe: 'kit:iron', clean: false, name: 'Silverthorn', rid: rid(), ...extra }, mac.secret);
  assert.deepEqual((await craft()).body, { error: 'stores-gold' }, 'no anvil');
  s.give(mac, 'ingot:iron', 'own', 1);
  const made = await craft();
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.deepEqual(s.stores(mac, 'ingot:iron'), [['gold', 2]], 'the own one spent; gold\'s untouched');
  // a Court writ (PROF1)
  const day = Math.floor(_now / 86_400);
  s.raw.prepare(`INSERT INTO writs (id, kind, day, region, slot, material, tier, qty, pay, renown, expires_at) VALUES ('writgold01', 'court', ?, ?, 0, 'metal:iron', 1, 3, 10, 1, ?)`)
    .run(day, DF, _now + 3600);
  s.give(mac, 'metal:iron', 'gold', 9);
  const deliver = () => s.call('/v1/writs/deliver', { character: mac.character, id: 'writgold01', rid: rid() }, mac.secret);
  assert.deepEqual((await deliver()).body, { error: 'stores-gold' }, 'no Court writ');
  s.give(mac, 'metal:iron', 'own', 3);
  const took = await deliver();
  assert.equal(took.status, 200, JSON.stringify(took.body));
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['gold', 9]]);
  // the guild Stores and a guild writ (PROF6)
  const gm = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(gm, 100_000, 'gm');
  const g = (await s.found(gm, { name: 'The Gilded', tag: 'GLD' })).body.guild;
  assert.ok(g?.id);
  s.give(gm, 'log:oak', 'gold', 40);
  const deposit = (units) => s.call('/v1/stores/guild-deposit', { character: gm.character, material: 'log:oak', units, rid: rid() }, gm.secret);
  assert.deepEqual((await deposit(5)).body, { error: 'stores-gold' }, 'no guild Stores');
  assert.equal((await s.call('/v1/marks/guild/deposit', { character: gm.character, marks: 1000, rid: rid() }, gm.secret)).status, 200);
  const post = await s.call('/v1/writs/post', { character: gm.character, region: DF, material: 'log:oak', units: 10, pay: 3, rid: rid() }, gm.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const ann = await s.registered('Ann');
  s.give(ann, 'log:oak', 'gold', 40);
  const supply = await s.call('/v1/writs/supply', { character: ann.character, region: DF, writ: post.body.writ.id, units: 5, rid: rid() }, ann.secret);
  assert.deepEqual(supply.body, { error: 'stores-gold' }, 'no guild writ');
  assert.deepEqual(s.stores(ann, 'log:oak'), [['gold', 40]]);
});

test('GOLD-MARKET service: a piece bought with gold is marked - it lists again for gold alone; one bought with Drakes for Drakes alone', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 100_000 });
  s.piece(eve, GP);
  const l = await s.list(eve, { kind: 'piece', material: undefined, units: 1, provenance: GP, wear: 1000, price: 5000 });
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const b = await s.buy(tom, l.body.listing);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual({ ...s.raw.prepare('SELECT owner, bought_with FROM products WHERE provenance = ?').get(GP) }, { owner: tom.id, bought_with: 'gold' });
  s.fund(tom, 1000);
  holdPieces(s.env, tom.character, [{ provenance: GP }]);   // the piece his pack took from the answer, in his record
  assert.deepEqual((await s.list(tom, { kind: 'piece', material: undefined, units: 1, provenance: GP, wear: 1000, price: 500, currency: 'marks' })).body, { error: 'market-gold-goods' });
  assert.equal((await s.list(tom, { kind: 'piece', material: undefined, units: 1, provenance: GP, wear: 1000, price: 6000 })).status, 200, 'for gold again');
  // bought with Drakes: never for gold
  const mac = await s.seated('Mac', {});   // PIN MOVED (INT19): a realm character - its piece leaves its record
  s.fund(mac, 100);
  s.piece(mac, MP);
  const d = await s.list(mac, { kind: 'piece', material: undefined, units: 1, provenance: MP, wear: 1000, price: 50, currency: 'marks' });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  s.fund(eve, 1000);
  assert.equal((await s.buy(eve, d.body.listing, { realm: null })).status, 200);
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(MP).bought_with, 'marks');
  assert.deepEqual((await s.list(eve, { kind: 'piece', material: undefined, units: 1, provenance: MP, wear: 1000, price: 5000 })).body, { error: 'market-drakes-goods' });
});

// ─── COLLECTING ──────────────────────────────────────────────────────

test('GOLD-MARKET service: the seller\'s gold collected into its own record\'s account at the board (the purse where it keeps none) - both or neither; nothing held refused; a character with gold held is not deleted', async () => {
  const s = await stand();
  const eve = await s.seated('Eve', { goldPieces: 7 });
  const tom = await s.seated('Tom', { goldPieces: 10_000 });
  s.give(eve, 'ore:mithril', 'own', 20);
  // the record's banks as the game keeps them: an array by region
  const banks = []; banks[DF] = { accountGold: 50 };
  layRecord(s.env, eve.character, { ...s.record(eve).save, bankAccounts: banks });
  const { body: { listing: l } } = await s.list(eve, { units: 5 });
  assert.equal((await s.buy(tom, l)).status, 200);
  const gets = goldSaleOf(0, 400).gets;
  assert.equal(s.held(eve), gets);
  assert.equal((await s.read(eve, 'mine')).body.goldHeld, gets, 'the read says what is held');
  const open = () => Number(s.raw.prepare(REALM_MARKET_OPEN_SQL).get(eve.id, eve.character).n);
  assert.equal(open(), 1, 'sold out: the held gold is the one business open');
  assert.deepEqual(Object.values(await s.call('/v1/realm/delete', { id: eve.character }, eve.secret)), [409, { error: 'realm-market-open' }], 'held gold keeps the character');
  const before = s.record(eve);
  const c = await s.call('/v1/market/gold', { character: eve.character, realm: eve.at(), region: DF }, eve.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual(c.body, { ok: true, gold: gets, region: DF, realm: { seq: before.seq + 1 } });
  const after = s.record(eve);
  assert.deepEqual([after.save.bankAccounts[DF].accountGold, after.save.goldPieces], [50 + gets, 7], 'into the board\'s account');
  assert.equal(s.held(eve), 0);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM market_gold').get().n, 0, 'the row gone');
  assert.equal(open(), 0, 'collected: nothing keeps the character now');
  assert.deepEqual((await s.call('/v1/market/gold', { character: eve.character, realm: eve.at(), region: DF }, eve.secret)).body, { error: 'market-gold-none' });
  assert.equal(s.record(eve).seq, after.seq, 'refused before the record moved');
  // EMPIRE-ACCOUNT: collected at another board, into the same one account - the Empire's (the purse only where a record
  // keeps none: test/net/realm5.test.js, test/systems/empireaccount.test.js)
  const second = await s.list(eve, { units: 1 });
  assert.equal((await s.buy(tom, second.body.listing, { units: 1 })).status, 200);
  const one = s.held(eve);
  assert.equal((await s.call('/v1/market/gold', { character: eve.character, realm: eve.at(), region: WR }, eve.secret)).status, 200);
  assert.deepEqual([s.record(eve).save.bankAccounts[DF].accountGold, s.record(eve).save.goldPieces], [50 + gets + one, 7]);
  // a character not the realm's collects none
  const mac = await s.registered('Mac');
  assert.deepEqual((await s.call('/v1/market/gold', { character: mac.character, region: DF }, mac.secret)).body, { error: 'market-gold-realm' });
});

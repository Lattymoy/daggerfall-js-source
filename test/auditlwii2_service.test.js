// AUDIT LW-II-2 (2026-10-10), the service's lane: THE LIVING WORLD II's patrons a second time - their law
// (src/net/patronLaw.js), their reckoning (server-account/src/market.js reckonPatrons), a trader's door (homes.js
// setHomeEntry), the hour's cron (cron.js), the measure staff read (review.js, tools/realmReview.mjs), the region's
// traders (marketVendors) and the counter's mark (systems/tradeModes.js markCounterBought, at worldModes.js's two Buy
// doors) - each through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs), each piece
// off its real producer (the loot tables, a shop's shelf, the book and recipe mints).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, T0 } from './accountDb.mjs';
import { seatRealm, freshSave } from './realmSeat.mjs';
import { seeded } from './honestItems.mjs';
import worker from '../server-account/src/index.js';
import { validLootList, generateRandomLoot, LOOT_MATRICES, randomlyAddPotionRecipe } from '../src/systems/loot.js';
import { ARROW_TEMPLATE, addItem, splitStack } from '../src/systems/inventory.js';
import { seededRng } from '../src/systems/wind.js';
import { itemWorth, lawfulItem } from '../src/systems/itemLaw.js';
import { validAffix, applyRarity } from '../src/systems/lootRarity.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { stockShopShelf, SHOP_ITEM_GROUPS } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { setBookPrice, clearBookPrices, createShelfBook, SHELF_BOOK_IDS } from '../src/systems/books.js';
import { potionRecipeByKey } from '../src/systems/potions.js';
import { tradeCost, getTradePrice, markCounterBought } from '../src/systems/tradeModes.js';
import { goodRefusal } from '../src/net/marketLaw.js';
import { patronCap, patronWorth, patronTakes, patronHours, patronHour, PATRON_COUNTER_MARK, PATRON_HOUR_S } from '../src/net/patronLaw.js';
import { VENDOR_BOARD_SHOWN } from '../src/net/vendorLaw.js';
import { runCron, CRON_HOUR } from '../server-account/src/cron.js';
import { reckonPatrons, patronSalt } from '../server-account/src/market.js';
import { DUPE_GRACE_S } from '../server-account/src/ledger.js';
import { faucetLines } from '../tools/realmReview.mjs';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; clearBookPrices(); });
const DF = 17;
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = (station = null) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });
const key = (s) => `${s.listing}@${s.hour}:${s.minute}`;

/** Weapons off the loot tables in the market's wire form, each one the loot law stands behind. */
function loot(n) {
  const out = [];
  for (let seed = 1; out.length < n && seed < 3000; seed++) {
    const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
    for (const it of items) {
      const rec = it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE ? validLootList([plain(it)])?.[0] : null;
      if (rec && patronCap(patronWorth(rec, itemWorth)) >= 1) out.push(plain(rec));
    }
  }
  return out.slice(0, n);
}
/** A service whose traders are laid in by hand - a home, its trader, its listings - for many towns and sellers. */
async function rawStand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  let n = 0;
  const home = (who, map, bkey, { entry = 'public', id = `t${map}k${bkey}`, guild = null } = {}) => {
    raw.prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1000, ?, ?)')
      .run(map, bkey, who.id, who.character, who.handle, DF, entry, _now, guild);
    raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)')
      .run(map, bkey, id, place('vendor'), _now);
    return { map, id };
  };
  /** A listing at `vendor` at `share` of the piece's cap, standing `days` (or until `expires`). */
  const list = (who, vendor, item, { share = 0.45, expires = _now + 30 * 86_400 } = {}) => {
    const id = `A${String(++n).padStart(8, '0')}`;
    const price = Math.min(1_000_000, Math.max(1, Math.floor(patronCap(patronWorth(item, itemWorth)) * share)));
    raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, vendor_map, vendor_id)
      VALUES (?, ?, ?, ?, 'item', 1, 1, 0, ?, 1, ?, ?, ?, ?, 'gold', ?, ?, ?)`)
      .run(id, who.id, who.character, DF, price, _now, expires, `rid-${id}`, `n-${id}`, JSON.stringify(item), vendor.map, vendor.id);
    return id;
  };
  const sales = () => raw.prepare('SELECT * FROM market_patron_sales ORDER BY hour, listing').all();
  const marks = (map) => raw.prepare('SELECT DISTINCT patron_hour AS h FROM market_listings WHERE vendor_map = ? AND state = \'open\' ORDER BY h').all(map).map((r) => r.h);
  return { ...s, raw, home, list, sales, marks, salt: await patronSalt(s.env) };
}
/** A realm character's checkpoint through the real route - `items` its pack. */
async function realmPut(s, who, R, items) {
  const at = R.at();
  const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
    method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(freshSave({ name: who.handle, items })),
  }), s.env);
  return { status: res.status, body: await res.json() };
}
/** A realm character's home and trader, laid by hand (the stand's own `home` is a registered account's). */
function realmHome(s, who, R, map, bkey, id = 'trader1') {
  s.env.DB._raw.prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1000, ?)')
    .run(map, bkey, who.id, R.id, who.handle, DF, 'public', _now);
  s.env.DB._raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)')
    .run(map, bkey, id, place('vendor'), _now);
  return { map, id };
}
/** Books off a shop's shelf (the producer's own mint), the registry warmed as the hosts warm it (BookFile.Price). */
function shelfBooks(n, from = 1, { buildingType = BUILDING_TYPES.Bookseller, quality = 10 } = {}) {
  const out = [];
  for (let seed = from; out.length < n && seed < from + 400; seed++) {
    for (const it of stockShopShelf({ buildingType, quality }, { level: 10 }, { rolls: seededRng(seed), torchesFromItems: false })) {
      const p = plain(it);
      if (p.group === 'Books' && out.length < n && lawfulItem(p) && !goodRefusal(p)) out.push(p);
    }
  }
  return out;
}
const warmBooks = () => { clearBookPrices(); const roll = seededRng(99); for (const id of SHELF_BOOK_IDS) setBookPrice(id, 300 + Math.floor(roll() * 501)); };

// ─── S1: THE ECONOMY'S LAW ───

test('AUDIT LW-II-2 S1: A PATRON\'S WORTH IS min(THE JUDGE\'S FLOOR, THE RECORD\'S OWN PRICE), AND NO PATRON TAKES A COUNTER\'S PIECE - a shelf\'s book is worth its file price (300..800, never its template\'s 2500), a stack of it three times that, a potion recipe its potion\'s; online every storefront\'s every piece the counter\'s Buy hands over is marked and refused (quality 1 to 20), offline none is marked; the mark the item law stands behind and the wire carries, kept by a stack\'s merge (either part\'s) and split; worldModes.js\'s two Buy doors mark before the pack takes the piece (mutants: the mark refused, the own price, its stack, the online stamp, the merge, the split, the field, the two doors)', () => {
  warmBooks();
  // a book is worth its file price
  const books = shelfBooks(6);
  assert.equal(books.length, 6);
  for (const b of books) {
    assert.ok(b.value >= 300 && b.value <= 800, `the file's price: ${b.value}`);
    assert.ok(itemWorth({ ...b, value: 0 }) >= 2500, 'the judge\'s floor is the template\'s');
    assert.equal(patronWorth(b, itemWorth), b.value, 'a book worth its file price');
  }
  assert.equal(patronWorth({ ...books[0], stackCount: 3 }, itemWorth), 3 * books[0].value, 'a stack of three, three times it');
  assert.equal(patronWorth({ ...books[0], value: 1e9 }, itemWorth), itemWorth({ ...books[0], value: 0 }), 'a price written up never passes the judge\'s floor');
  assert.equal(patronWorth({ ...books[0], value: undefined }, itemWorth), 0, 'no price, no worth');
  // a recipe is worth its potion's
  for (let seed = 1; seed <= 4; seed++) {
    const got = [];
    const recipe = plain(randomlyAddPotionRecipe(100, got, seededRng(seed)));
    const potion = potionRecipeByKey(recipe.potionRecipeKey);
    assert.ok(potion && recipe.value === potion.price && recipe.value < itemWorth({ ...recipe, value: 0 }), 'a recipe priced by its potion, under its sheet\'s floor');
    assert.equal(patronWorth(recipe, itemWorth), potion.price, 'a recipe worth its potion');
  }
  // the counter's mark: online every piece of every storefront, refused; offline none written
  let shelves = 0;
  for (const bt of Object.keys(SHOP_ITEM_GROUPS).map(Number)) {
    for (const quality of [1, 10, 20]) {
      for (let seed = 1; seed <= 3; seed++) {
        const bought = stockShopShelf({ buildingType: bt, quality }, { level: 10 }, { rolls: seededRng(seed * 31 + bt), torchesFromItems: false }).map(plain);
        const off = bought.map(plain);
        assert.equal(markCounterBought(off, { online: false }), 0);
        assert.deepEqual(off, bought, 'offline nothing is written');
        assert.equal(markCounterBought(bought, { online: true }), bought.length);
        assert.ok(bought.every((it) => it[PATRON_COUNTER_MARK] === true && !patronTakes(it)), 'online: marked, and no patron takes it');
        shelves += bought.length;
      }
    }
  }
  assert.ok(shelves > 500, `${shelves} pieces off every storefront's shelf`);
  // the mark: the item law's, the wire's, a stack's
  const [found, bought] = [plain(books[0]), plain(books[0])];
  markCounterBought([bought], { online: true });
  assert.equal(PATRON_COUNTER_MARK, 'counterBought');
  assert.ok(patronTakes(found) && !patronTakes(bought));
  assert.ok(lawfulItem(bought), 'the item law stands behind a marked piece');
  assert.equal(lawfulItem({ ...found, counterBought: 1 }), false, 'a mark that is no mark is no piece');
  assert.equal(validLootList([bought])?.[0]?.counterBought, true, 'the wire carries it');
  const pack = [found];
  assert.equal(addItem(pack, bought), found, 'the bought book joins the found one');
  assert.deepEqual([pack.length, found.stackCount, found.counterBought], [1, 2, true], 'the merged stack keeps the mark');
  const marked = { ...plain(books[1]), stackCount: 1, counterBought: true }, more = plain(books[1]);
  const pack2 = [marked];
  addItem(pack2, more);
  assert.equal(marked.counterBought, true, 'either part\'s');
  const third = plain(books[1]);
  addItem(pack2, third);
  const picked = splitStack(pack2, marked, 1);
  assert.ok(picked && picked !== marked && picked.counterBought === true && marked.counterBought === true, 'a split keeps it on both halves');
  // the doors: the counter's Buy and the keyed list's, each before the pack takes the piece (and a stack's merge with it)
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /if \(mode === 'Buy'\) \{\n\s+deductGold\(playerEntity, price\);\n\s+markCounterBought\(staged\);[^\n]*\n\s+for \(const it of staged\) \{/);
  assert.match(wm, /shelf\.items\.splice\(at, 1\);\n\s+markCounterBought\(\[it\]\);[^\n]*\n\s+playerEntity\.items = playerEntity\.items \|\| \[\];/);
  assert.equal(wm.match(/markCounterBought\(/g).length, 2, 'the two doors');
});

test('AUDIT LW-II-2 S1: THROUGH THE WORKER, A COUNTER\'S BOOKS NEVER SELL FOR MORE THAN THEY COST - fourteen books bought online at a quality-10 bookseller (the counter\'s mark) and stocked at their patron cap: none sold in two days (the patrons paid 2.06 times what the counter asked); a found book priced under its template\'s old cap never sells, one under its own file price\'s cap sells at it (mutants: the mark refused, the own price)', async () => {
  warmBooks();
  const ask = (it) => { const lot = tradeCost('Buy', [it], { quality: 10, priceAdjustment: 1000, online: true }); return getTradePrice('Buy', lot.cost, 10, { mercantile: 50, personality: 50 }, lot.pieces); };
  const bought = shelfBooks(14, 1);
  assert.equal(markCounterBought(bought, { online: true }), 14);
  const found = shelfBooks(12, 600);
  assert.equal(found.length, 12);
  _now = T0;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const eve = await s.registered('Eve');
  const R = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, items: [...bought, ...found], goldPieces: 0 });
  const vendor = realmHome(s, eve, R, 1001, 4242);
  const kind = new Map(), asked = new Map();
  let i = 0;
  const put = async (b, price, what) => {
    const r = await s.call('/v1/market/list', { character: R.id, region: DF, kind: 'item', item: b, pick: 0, price, rid: `s1books-${String(++i).padStart(6, '0')}`, currency: 'gold', realm: R.at(), vendor }, eve.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(JSON.parse(raw.prepare('SELECT item FROM market_listings WHERE id = ?').get(r.body.listing.id).item).counterBought, what === 'bought' ? true : undefined, 'the listing keeps the record\'s mark');
    kind.set(r.body.listing.id, what);
    asked.set(r.body.listing.id, { ask: ask(b), value: b.value });
  };
  for (const b of bought) await put(b, patronCap(patronWorth(b, itemWorth)), 'bought');
  // the old law's price: under the template's cap (1500), over the file price's
  for (const b of found.slice(0, 6)) await put(b, Math.floor(patronCap(itemWorth({ ...b, value: 0 })) * 0.45), 'dear');
  for (const b of found.slice(6)) await put(b, Math.max(1, Math.floor(patronCap(b.value) * 0.45)), 'fair');
  _now = T0 + 48 * 3600;
  assert.equal((await s.call('/v1/market/vendor', { vendor }, eve.secret)).status, 200);
  const sold = raw.prepare('SELECT listing, price, gets FROM market_patron_sales').all();
  const of = (what) => sold.filter((x) => kind.get(x.listing) === what);
  const paid = [...kind].filter(([, w]) => w === 'bought').reduce((a, [id]) => a + asked.get(id).ask, 0);
  assert.ok(paid > 0);
  assert.equal(of('bought').reduce((a, x) => a + x.gets, 0), 0, `the counter asked ${paid}: the patrons paid nothing for its books`);
  assert.deepEqual(of('dear'), [], 'over a book\'s own cap: never');
  assert.ok(of('fair').length >= 1, 'a found book under its own cap sells');
  assert.ok(of('fair').every((x) => x.price <= patronCap(asked.get(x.listing).value)), 'at its file price\'s cap');
});

// ─── S2: THE LEDGER TOLD ───

test('AUDIT LW-II-2 S2: A PATRON\'S SALE TELLS THE INT4 LEDGER - a rare piece (its id) listed at the trader lies in escrow; its seller\'s save still showing it claims it; the patron\'s purchase charges the claimant a copy (item_dupes, dupes, the finding) and keeps the row gone, so the copy never takes it up (the row stood in escrow for ever, the seller never charged); with no copy kept, the row goes (mutants: the ledger told, the copy, the charge, the gone, the claim read, the unclaimed row)', async () => {
  const run = async (keepCopy) => {
    _now = T0;
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const raw = s.env.DB._raw;
    const eve = await s.registered('Eve');
    const R = await seatRealm(s.env, eve.secret, 'Eve');
    const ledger = (u) => raw.prepare('SELECT char_id, state, claim_char FROM item_uids WHERE uid = ?').get(u) ?? null;
    const U = 'abcdef0123456789';
    const piece = { ...applyRarity(createWeapon(113, 1, seeded(7)), 'rare', seeded(11)), uid: U };
    assert.equal((await realmPut(s, eve, R, [piece])).status, 200);
    assert.deepEqual({ ...ledger(U) }, { char_id: R.id, state: 'held', claim_char: null }, 'its checkpoint holds it');
    const vendor = realmHome(s, eve, R, 1001, 4242);
    const price = Math.max(1, Math.floor(patronCap(patronWorth(piece, itemWorth)) * 0.3));
    const l = await s.call('/v1/market/list', { character: R.id, region: DF, kind: 'item', item: piece, pick: 0, price, rid: 's2ledger-0001', currency: 'gold', realm: R.at(), vendor }, eve.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    assert.equal(ledger(U).state, 'escrow', 'listed: the market\'s');
    _now = T0 + 120;
    assert.equal((await realmPut(s, eve, R, keepCopy ? [piece] : [])).status, 200);
    assert.equal(ledger(U).claim_char, keepCopy ? R.id : null, keepCopy ? 'the seller kept a copy: it claims the piece' : 'no copy: no claim');
    _now = T0 + 40 * 3600;
    assert.equal((await s.call('/v1/market/vendor', { vendor }, eve.secret)).status, 200);
    assert.deepEqual(raw.prepare('SELECT listing FROM market_patron_sales').all().map((x) => x.listing), [l.body.listing.id], 'a patron bought it');
    return { s, raw, R, U, ledger, eve, piece };
  };
  const a = await run(true);
  assert.deepEqual({ ...a.ledger(a.U) }, { char_id: '', state: 'gone', claim_char: null }, 'the row gone, the claim settled');
  assert.deepEqual(a.raw.prepare('SELECT uid, char_id FROM item_dupes').all().map((x) => ({ ...x })), [{ uid: a.U, char_id: a.R.id }], 'the copy written down, the claimant\'s');
  assert.equal(a.raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(a.R.id).dupes, 1, 'the claimant charged');
  assert.equal(a.raw.prepare("SELECT COUNT(*) AS n FROM realm_findings WHERE char_id = ? AND kind = 'dupe'").get(a.R.id).n, 1, 'its finding');
  // the copy's checkpoints after: charged once, and it never takes the piece up
  for (let i = 0; i < 2; i++) { _now += DUPE_GRACE_S + 60; assert.equal((await realmPut(a.s, a.eve, a.R, [a.piece])).status, 200); }
  assert.deepEqual([a.ledger(a.U).state, a.raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(a.R.id).dupes], ['gone', 1], 'never taken up, charged once');
  const b = await run(false);
  assert.equal(b.ledger(b.U), null, 'no copy kept: the row goes');
  assert.deepEqual([b.raw.prepare('SELECT COUNT(*) AS n FROM item_dupes').get().n, b.raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(b.R.id).dupes], [0, 0], 'and no one is charged');
});

// ─── S3: THE MARKET SHUT ───

test('AUDIT LW-II-2 S3: WHILE THE MARKET IS NOT OPEN TO EVERYONE NO HOUR IS PAID - shut (or its developers\' alone) thirty hours, the hour\'s cron marks the traders\' hours as they pass, and opening it pays none of them (its first firing after paid every shut hour); a developer\'s read behind `dev` reckons nobody\'s town; the migration reckons every open trader listing to the hour before it runs, never a board\'s (mutants: the cron marks, a read asks the switch, the backfill\'s hour, its traders alone)', async () => {
  for (const marks of ['off', 'dev']) {
    _now = T0;
    const s = await rawStand({ MARKS_OPEN: marks, DEVELOPER_HANDLES: 'Dev' });
    const eve = await s.registered('Eve');
    const v = s.home(eve, 8001, 10);
    for (const it of loot(20)) s.list(eve, v, it);
    for (let h = 1; h <= 30; h++) await runCron(s.env, { cron: CRON_HOUR, nowS: T0 + h * 3600 + 41 * 60 });
    assert.deepEqual(s.sales(), [], `${marks}: none sold while shut`);
    assert.deepEqual(s.marks(8001), [Math.floor((T0 + 30 * 3600 + 41 * 60) / 3600)], `${marks}: its hours marked as they passed`);
    s.env.MARKS_OPEN = 'on';   // staff open it at 30:45
    const opened = Math.floor((T0 + 30 * 3600 + 45 * 60) / 3600);
    for (let h = 31; h <= 44; h++) await runCron(s.env, { cron: CRON_HOUR, nowS: T0 + h * 3600 + 41 * 60 });
    assert.ok(s.sales().length >= 1, `${marks}: open, it sells`);
    assert.deepEqual(s.sales().filter((x) => x.hour <= opened), [], `${marks}: never in an hour the market stood shut`);
  }
  // behind `dev`, a developer's region read: nobody's town reckoned
  _now = T0;
  const d = await rawStand({ MARKS_OPEN: 'dev', DEVELOPER_HANDLES: 'Dev' });
  const ann = await d.registered('Ann'), dev = await d.registered('Dev');
  const dv = d.home(ann, 8101, 10);
  for (const it of loot(20)) d.list(ann, dv, it);
  _now = T0 + 20 * 3600;
  assert.equal((await d.call('/v1/market/vendors', { region: DF }, dev.secret)).status, 200, 'the developer reads');
  assert.equal((await d.call('/v1/market/vendor', { vendor: dv }, dev.secret)).status, 200);
  assert.deepEqual([d.sales(), d.raw.prepare('SELECT COUNT(*) AS n FROM realm_faucets').get().n], [[], 0], 'no seller\'s piece sold, no gold minted');
  // the migration: the listings standing when it runs
  const files = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  for (const f of files.filter((x) => x < '0106')) db.exec(readFileSync(new URL(`../server-account/migrations/${f}`, import.meta.url), 'utf8'));
  const row = (id, vendor, state = 'open', currency = 'gold') => db.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, vendor_map, vendor_id, state)
    VALUES (?, 'p1', 'c1', 17, 'item', 1, 1, 0, 100, 1, 1, 9999999999, ?, ?, ?, '{}', ?, ?, ?)`).run(id, `r-${id}`, `n-${id}`, currency, vendor ? 1001 : null, vendor ? 'trader1' : null, state);
  row('trader', true); row('board', false); row('sold', true, 'sold');
  const before = Math.floor(realNow() / 1000 / 3600);
  db.exec(readFileSync(new URL('../server-account/migrations/0106_patrons.sql', import.meta.url), 'utf8'));
  const after = Math.floor(realNow() / 1000 / 3600);
  const hourOf = (id) => db.prepare('SELECT patron_hour AS h FROM market_listings WHERE id = ?').get(id).h;
  assert.ok([before - 1, after - 1].includes(hourOf('trader')), `the trader's listing to the hour before it ran: ${hourOf('trader')} of ${before}`);
  assert.deepEqual(['board', 'sold'].map(hourOf), [null, null], 'a board\'s and a closed listing untouched');
});

// ─── S4: A DOOR ───

test('AUDIT LW-II-2 S4: A DOOR OPENED AT :59 SELLS NOTHING IN THAT HOUR, AND A DOOR SHUT PAYS ITS OPEN HOURS FIRST - a door kept private, opened at :59 of each hour and shut after its owner\'s read at :00: thirty hours, nothing sold (it sold thirty as a door open all of them); a public door set private reckons its town first: the whole hours it stood open are paid, then none (mutants: the hour it opens in, the town reckoned at the shutting)', async () => {
  const H0 = Math.ceil(T0 / 3600) + 1;
  const run = async (toggle) => {
    _now = H0 * 3600;
    const s = await rawStand();
    const eve = await s.registered('Eve');
    const v = s.home(eve, 6001, 10, { entry: toggle ? 'private' : 'public' });
    for (const it of loot(30)) s.list(eve, v, it);
    for (let h = 1; h <= 30; h++) {
      if (toggle) {
        _now = (H0 + h) * 3600 - 60;   // :59
        assert.equal((await s.call('/v1/homes/entry', { mapId: 6001, buildingKey: 10, entry: 'public' }, eve.secret)).status, 200);
      }
      _now = (H0 + h) * 3600 + 5;   // :00:05 - the owner's own read reckons the hour just ended
      await s.call('/v1/market/vendor', { vendor: v }, eve.secret);
      if (toggle) assert.equal((await s.call('/v1/homes/entry', { mapId: 6001, buildingKey: 10, entry: 'private' }, eve.secret)).status, 200);
    }
    return s.sales();
  };
  assert.ok((await run(false)).length >= 10, 'open all thirty hours, it sells');
  assert.deepEqual(await run(true), [], 'open a minute an hour: nothing');
  // a public door shut, nobody having read its town since it was stocked
  _now = T0;
  const s = await rawStand();
  const ann = await s.registered('Ann');
  const v = s.home(ann, 6101, 10);
  for (const it of loot(20)) s.list(ann, v, it);
  _now = T0 + 20 * 3600 + 30;
  const shutHour = Math.floor(_now / 3600);
  assert.equal((await s.call('/v1/homes/entry', { mapId: 6101, buildingKey: 10, entry: 'private' }, ann.secret)).status, 200);
  const paid = s.sales();
  assert.ok(paid.length >= 1, 'its open hours paid at the shutting');
  assert.ok(paid.every((x) => x.hour < shutHour), 'whole hours before it');
  _now = T0 + 30 * 3600;
  await s.call('/v1/market/vendor', { vendor: v }, ann.secret);
  assert.deepEqual(s.sales(), paid, 'and none after');
});

// ─── S5: A HELD SELLER ───

test('AUDIT LW-II-2 S5: A HELD SELLER CROWDS NO TOWN - four traders the judge holds (sixty cheap pieces each) beside an honest seller\'s sixty: the honest one sells exactly as alone (it sold 22 alone, 6 beside four held - their pieces the hour\'s lowest draws, refused in the write); and a seller held between the reckoning\'s read and its write is still refused there (mutants: the town\'s read, the write\'s guard)', async () => {
  const items = loot(60);
  let key0 = null;
  const run = async (held) => {
    _now = T0;
    const s = await rawStand(key0 ? { IDENTITY_PRIVATE_KEY: key0 } : {});   // one secret, one set of dice for both towns
    key0 ??= s.env.IDENTITY_PRIVATE_KEY;
    const eve = await s.registered('Eve');
    const ve = s.home(eve, 4001, 10);
    for (const it of items) s.list(eve, ve, it);
    for (let g = 0; g < held; g++) {
      const m = await s.registered(`Mal${g}`);
      const R = await seatRealm(s.env, m.secret, `Mal${g}`);
      m.character = R.id;
      s.raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(R.id);
      const v = s.home(m, 4001, 20 + g);
      for (const it of items) s.list(m, v, it);
    }
    for (let h = 1; h <= 12; h++) { _now = T0 + h * 3600 + 5; await s.call('/v1/market/vendor', { vendor: ve }, eve.secret); }
    return { s, eve, mine: s.sales().filter((x) => x.seller === eve.id).map(key) };
  };
  const alone = await run(0);
  const beside = await run(4);
  assert.ok(alone.mine.length >= 12, `${alone.mine.length} sold alone`);
  assert.equal(beside.s.salt, alone.s.salt, 'the same dice');
  assert.deepEqual(beside.mine, alone.mine, 'beside four held sellers, as alone');
  assert.equal(beside.s.sales().length, beside.mine.length, 'the held sell nothing');
  // held between the read and the write: the write refuses it
  _now = T0;
  const t = await rawStand();
  const bob = await t.registered('Bob');
  const R = await seatRealm(t.env, bob.secret, 'Bob');
  bob.character = R.id;
  const v = t.home(bob, 4101, 10);
  for (const it of loot(10)) t.list(bob, v, it);
  _now = T0 + 30 * 3600;
  let fired = false;
  const racing = { prepare: (/** @type {any[]} */ ...x) => t.env.DB.prepare(...x), batch: (/** @type {any} */ st) => {
    if (!fired) { fired = true; t.raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(R.id); }
    return t.env.DB.batch(st);
  } };
  await reckonPatrons({ db: racing, nowS: _now }, { maps: [4101] }, t.env);
  assert.ok(fired, 'a sale was asked');
  assert.deepEqual(t.sales(), [], 'held as it sold: refused in the write');
});

// ─── S6: THE MEASURE ───

test('AUDIT LW-II-2 S6: THE PATRONS\' GOLD WHERE THE WEALTH MEASURE COUNTS IT - /v1/mod/realm-budget names the service\'s own faucets over its window (every FAUCET_KINDS kind, the patron\'s gold and payments - nothing read realm_faucets), an hour older than the window not counted; tools/realmReview.mjs says it (mutants: the faucets answered, the window, the tool)', async () => {
  _now = T0;
  const s = await rawStand({ DEVELOPER_HANDLES: 'Dev' });
  const eve = await s.registered('Eve'), dev = await s.registered('Dev');
  const v = s.home(eve, 8301, 10);
  for (const it of loot(20)) s.list(eve, v, it);
  _now = T0 + 20 * 3600;
  await s.call('/v1/market/vendor', { vendor: v }, eve.secret);
  const sold = s.sales();
  assert.ok(sold.length >= 1);
  // a faucet hour ten days back: outside a week's window, inside a month's
  s.raw.prepare("INSERT INTO realm_faucets (hour, kind, gold, n) VALUES (?, 'patron', 999, 1)").run(Math.floor(_now / 3600) - 240);
  const week = await s.call('/v1/mod/realm-budget', { days: 7 }, dev.secret);
  assert.equal(week.status, 200, JSON.stringify(week.body));
  const gold = sold.reduce((a, x) => a + x.gets, 0);
  assert.deepEqual(week.body.faucets, [{ kind: 'patron', gold, n: sold.length }], 'the week\'s patron gold, named');
  const month = await s.call('/v1/mod/realm-budget', { days: 30 }, dev.secret);
  assert.deepEqual(month.body.faucets, [{ kind: 'patron', gold: gold + 999, n: sold.length + 1 }], 'the month\'s');
  assert.deepEqual(faucetLines(week.body), [`faucet patron: ${gold} gold in ${sold.length} payments over the last 7 days`], 'the tool says it');
  assert.deepEqual(faucetLines({}), []);
});

// ─── S7: ITS OWN HOUSE ───

test('AUDIT LW-II-2 S7: A TRADER\'S READ TELLS ITS OWN HOUSE\'S PATRONS - two players\' public traders of one id in one town (AUDIT LW-II P9\'s case): /v1/market/vendor tells only the sales at the house it answers (it told the other\'s too) (mutant: the house)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve'), mal = await s.registered('Mallory');
  const ve = s.home(eve, 9001, 10, { id: 'shoptrader1' });
  const vm = s.home(mal, 9001, 77, { id: 'shoptrader1' });
  const items = loot(20);
  for (const it of items.slice(0, 10)) s.list(eve, ve, it);
  for (const it of items.slice(10)) s.list(mal, vm, it);
  _now = T0 + 20 * 3600;
  const r = await s.call('/v1/market/vendor', { vendor: ve }, eve.secret);
  assert.equal(r.status, 200);
  const sold = s.sales().filter((x) => x.at > _now - 86_400);
  const house = r.body.vendor.buildingKey;
  assert.ok(sold.some((x) => x.building_key === 10) && sold.some((x) => x.building_key === 77), 'both houses sold');
  assert.deepEqual(r.body.patrons.map((p) => p.listing).sort(), sold.filter((x) => x.building_key === house).map((x) => x.listing).sort(), 'its own house\'s sales, each');
  assert.ok(r.body.patrons.every((p) => p.buildingKey === house));
});

// ─── S8: ONE BAD LISTING ───

test('AUDIT LW-II-2 S8: ONE BAD LISTING STOPS NO TOWN - an affix id Object.prototype answers is no affix (validAffix asks Object.hasOwn: it threw in the item law and the judge\'s worth); a poisoned listing in the longest-waiting town: twelve firings of the hour\'s cron each whole, the honest towns reckoned and sold; a listing whose judging throws is passed by, its town and the rest reckoned (mutants: the own row, the listing\'s own try)', async () => {
  const [sword] = loot(1);
  const poisoned = { ...sword, affixes: [{ id: 'constructor', value: 1 }] };
  assert.equal(validAffix({ id: 'constructor', value: 1 }), false);
  assert.equal(validAffix({ id: '__proto__', value: 1 }), false);
  assert.deepEqual([lawfulItem(poisoned), itemWorth(poisoned) > 0], [false, true], 'refused, and judged without a throw');
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve'), bob = await s.registered('Bob');
  const items = loot(12);
  const vp = s.home(eve, 7000, 10);
  s.list(eve, vp, items[1]);
  const pid = s.list(eve, vp, items[2]);
  s.raw.prepare('UPDATE market_listings SET item = ? WHERE id = ?').run(JSON.stringify({ ...items[2], affixes: [{ id: 'constructor', value: 1 }] }), pid);   // as a listing made before INT1 holds it
  _now = T0 + 3600;
  const towns = [7001, 7002, 7003];
  for (const m of towns) { const v = s.home(bob, m, 20 + m); for (const it of items.slice(3)) s.list(bob, v, it); }
  const warn = console.warn;
  console.warn = () => {};
  const firings = [];
  try {
    for (let f = 1; f <= 12; f++) firings.push((await runCron(s.env, { cron: CRON_HOUR, nowS: T0 + (2 + f) * 3600 + 41 * 60 })).find((j) => j.name === 'patrons'));
  } finally { console.warn = warn; }
  assert.deepEqual(firings.map((j) => j.ok), Array(12).fill(true), 'every firing whole');
  const last = Math.floor((T0 + 14 * 3600 + 41 * 60) / 3600) - 1;
  for (const m of towns) assert.ok(s.marks(m).every((h) => h === last), `the honest town ${m} reckoned: ${JSON.stringify(s.marks(m))}`);
  assert.ok(s.sales().some((x) => towns.includes(x.map)), 'and sold');
  assert.ok(!s.sales().some((x) => x.listing === pid), 'the poisoned piece never');
  // a listing whose judging throws (a column read in its judging that throws as it is read - no stored piece reaches a
  // throw once validAffix asks Object.hasOwn): passed by, the town and the next reckoned
  _now = T0;
  const t = await rawStand();
  const ann = await t.registered('Ann');
  const bad = t.home(ann, 7100, 10), good = t.home(ann, 7101, 10);
  const badId = t.list(ann, bad, items[3]);
  for (const it of items.slice(4)) { t.list(ann, bad, it); t.list(ann, good, it); }
  _now = T0 + 30 * 3600;
  const throwing = { prepare: (/** @type {string} */ sql) => {
    const st = t.env.DB.prepare(sql);
    if (!/ AS held\n/.test(sql)) return st;
    const all = st.all.bind(st);
    st.all = async () => {
      const r = await all();
      return { ...r, results: r.results.map((row) => (row.id !== badId ? row : Object.defineProperty({ ...row }, 'held', { get() { throw new Error('a listing the judge throws on'); } }))) };
    };
    return st;
  }, batch: (/** @type {any} */ st) => t.env.DB.batch(st) };
  const out = await reckonPatrons({ db: throwing, nowS: _now }, { maps: [7100, 7101] }, t.env);
  assert.equal(out.towns, 2);
  assert.ok(t.sales().some((x) => x.map === 7100) && t.sales().some((x) => x.map === 7101), 'both towns sold');
  assert.ok(!t.sales().some((x) => x.listing === badId), 'the throwing listing passed by');
  assert.ok([7100, 7101].every((m) => t.marks(m).every((h) => h === Math.floor(_now / 3600) - 1)), 'both reckoned through');
});

// ─── W6: THE REGION'S TRADERS ───

test('AUDIT LW-II-2 W6: /vendors NAMES EVERY PUBLIC TRADER OF THE REGION - a trader stocked an hour before the region\'s three hundred newest listings (another\'s) still stands in its town\'s word: one row, its newest piece, beside the board\'s three hundred (its town was absent); no listing told twice (mutants: the houses told, one row a house, none twice)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve'), bob = await s.registered('Bob'), rea = await s.registered('Rea');
  const ve = s.home(eve, 9001, 10, { id: 'evetrader01' }), vb = s.home(bob, 9002, 20, { id: 'bobtrader01' });
  const [sword] = loot(1);
  _now = T0 - 3600;
  s.list(eve, ve, sword); s.list(eve, ve, sword);
  _now = T0 - 3000;
  const newest = s.list(eve, ve, sword);
  for (let i = 0; i < VENDOR_BOARD_SHOWN; i++) { _now = T0 - 1800 + i; s.list(bob, vb, sword); }
  _now = T0 + 600;
  const r = await s.call('/v1/market/vendors', { region: DF }, rea.secret);
  assert.equal(r.status, 200);
  const rows = r.body.rows;
  const eves = rows.filter((row) => row.map === 9001);
  assert.deepEqual(eves.map((row) => [row.id, row.buildingKey, row.home?.entry]), [[newest, 10, 'public']], 'Eve\'s town stands in the word: one row, her newest piece');
  assert.equal(rows.filter((row) => row.map === 9002).length, VENDOR_BOARD_SHOWN, 'the board\'s three hundred');
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'none told twice');
});

// ─── P1, P3, LW15P-guild-hall: the laws the first audit left unpinned ───

test('AUDIT LW-II-2 P1: A DOOR OPENED IN A TOWN OF TWO TRADERS - Eve\'s public, Bob\'s private beside her: Bob opens at hour 30, and none of his pieces sells in an hour his door stood shut, though Eve\'s hours before it are reckoned (mutant: the listing\'s own mark)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve'), bob = await s.registered('Bob');
  const open = s.home(eve, 6201, 10), shut = s.home(bob, 6201, 11, { entry: 'private' });
  const bobs = new Set();
  for (const it of loot(20)) { s.list(eve, open, it); bobs.add(s.list(bob, shut, it)); }
  _now = T0 + 30 * 3600 + 600;
  const opened = Math.floor(_now / 3600);
  assert.equal((await s.call('/v1/homes/entry', { mapId: 6201, buildingKey: 11, entry: 'public' }, bob.secret)).status, 200);
  _now = T0 + 40 * 3600;
  for (let i = 0; i < 6; i++) await s.call('/v1/market/vendor', { vendor: open }, eve.secret);
  const sales = s.sales();
  assert.ok(sales.some((x) => !bobs.has(x.listing) && x.hour < opened), 'Eve\'s hours before it sold');
  assert.ok(sales.some((x) => bobs.has(x.listing)), 'Bob\'s, open, sells');
  assert.deepEqual(sales.filter((x) => bobs.has(x.listing) && x.hour <= opened), [], 'never in an hour his door stood shut');
});

test('AUDIT LW-II-2 P3: EACH WHOLE HOUR A LISTING STANDS - a piece listed mid-hour behind earlier ones is never sold in its listing\'s hour nor before; a piece expiring inside the hours reckoned never sells in an hour it does not stand whole (mutants: the first whole hour, the expiry)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve');
  const v = s.home(eve, 6301, 10);
  const items = loot(40);
  for (const it of items.slice(0, 2)) s.list(eve, v, it);
  _now = T0 + 20 * 3600 + 1800;
  const lateAt = _now;
  const late = new Set(items.slice(2).map((it) => s.list(eve, v, it)));
  _now = T0 + 26 * 3600;
  for (let i = 0; i < 4; i++) await s.call('/v1/market/vendor', { vendor: v }, eve.secret);
  assert.ok(s.sales().some((x) => late.has(x.listing)), 'the late pieces sell');
  assert.deepEqual(s.sales().filter((x) => late.has(x.listing) && x.hour <= Math.floor(lateAt / 3600)), [], 'never in their listing\'s hour');
  // expiring: forty pieces standing four hours, read two days on
  _now = T0;
  const t = await rawStand();
  const ann = await t.registered('Ann');
  const tv = t.home(ann, 6302, 10);
  const expires = T0 + 4 * 3600 + 600;
  for (const it of items) t.list(ann, tv, it, { expires });
  _now = T0 + 40 * 3600;
  await t.call('/v1/market/vendor', { vendor: tv }, ann.secret);
  assert.ok(t.sales().length >= 1, 'it sells while it stands');
  assert.deepEqual(t.sales().filter((x) => (x.hour + 1) * PATRON_HOUR_S > expires), [], 'never in an hour it does not stand whole');
});

test('AUDIT LW-II-2 LW15P-guild-hall: A GUILD\'S HALL STANDS NO PATRONS\' TRADER - a hall\'s door set public (GUILD_HALL_ENTRIES holds \'public\'), a trader stocked in it: forty hours, nothing sold, its hours passed by (mutant: the hall)', async () => {
  _now = T0;
  const s = await rawStand();
  const eve = await s.registered('Eve');
  s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('ghall0001', 'The Hall', 'the hall', 'HAL', '[]', 0, 1)").run();
  const v = s.home(eve, 6401, 10, { guild: 'ghall0001' });
  for (const it of loot(20)) s.list(eve, v, it);
  _now = T0 + 40 * 3600;
  assert.equal((await s.call('/v1/market/vendor', { vendor: v }, eve.secret)).status, 200);
  assert.deepEqual(s.sales(), [], 'a hall sells to no patron');
  assert.deepEqual(s.marks(6401), [Math.floor(_now / 3600) - 1], 'its hours passed by');
  // the law the hall's pieces would have sold by, were it a home: some would have
  const ls = s.raw.prepare('SELECT id, seller, price, item, at FROM market_listings').all().map((r) => ({ id: r.id, seller: r.seller, price: Number(r.price), at: Number(r.at), worth: patronWorth(JSON.parse(r.item), itemWorth) }));
  assert.ok(patronHours(null, T0, _now).some((h) => patronHour(ls, h, { salt: s.salt }).length > 0), 'a home of the same stock would have sold');
});

test('AUDIT LW-II-2 S9: THE WIRE FLOORS A BOOK AT ITS FILE\'S PRICE AND A RECIPE AT ITS POTION\'S - never at the template\'s: a book minted at 300-800 crossed the wire at 2500, and a recipe at its sheet\'s, so a counter\'s book set down in a room\'s container sold back for more than it cost and a patron judged it by the same; a book or a recipe sent at nothing is floored at its own price, and every other piece at itemBaseValue still (AUDIT WORLD6a B1\'s dai-katana)', () => {
  const roll = seededRng(99);
  for (const id of SHELF_BOOK_IDS) setBookPrice(id, 300 + Math.floor(roll() * 501));
  for (let s = 1; s <= 12; s++) {
    const book = JSON.parse(JSON.stringify(createShelfBook(seededRng(s))));
    assert.ok(book.value >= 300 && book.value <= 800, `the shelf's book minted at its file's price (${book.value})`);
    assert.equal(validLootList([book])[0].value, book.value, 'across the wire it keeps its own price');
    assert.equal(validLootList([{ ...book, value: 0 }])[0].value, book.value, 'sent at nothing, floored at its own price');
    assert.equal(patronWorth(validLootList([book])[0], itemWorth), book.value, 'and a patron judges it by that price');
  }
  for (let s = 1; s <= 12; s++) {
    const got = [];
    const recipe = JSON.parse(JSON.stringify(randomlyAddPotionRecipe(100, got, seededRng(s))));
    const price = potionRecipeByKey(recipe.potionRecipeKey).price;
    assert.equal(recipe.value, price, 'a recipe minted at its potion\'s price');
    assert.equal(validLootList([recipe])[0].value, price, 'across the wire it keeps it');
    assert.equal(validLootList([{ ...recipe, value: 0 }])[0].value, price, 'sent at nothing, floored at its potion\'s');
  }
  const katana = JSON.parse(JSON.stringify(createWeapon(123, 9, seededRng(4))));   // a Daedric dai-katana (Dai_Katana 123, Daedric 9)
  const wired = validLootList([{ ...katana, value: 0 }])[0];
  assert.ok(wired.value > 1000, `every other piece is still floored at what the port mints it at (${wired.value})`);
});

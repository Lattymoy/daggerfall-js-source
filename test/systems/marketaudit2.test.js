// MARKET-AUDIT, the rest (2026-10-05, Mac: "Fix everything") - WHAT THE AUDIT NAMED AND LEFT, FIXED. Every realm act's
// reserve gives back exactly what its payment took (net/realm/realmGoldLaw.js walletReserve over court.js payUndoable): the
// guild's founding and deposit, a room's rent, a home's claim, a decor piece and its change, as the market's gold buy -
// each gave back its whole cost as `credit`, coins or the bank's, whatever had paid. The account door: a 2xx whose body
// never came is no word on the act (`offline`, `unknown`), never an empty success. The book: its minute's cache is the
// account's and character's; a cache hit says its board's listing cap; a refused collect is said; a realm act's own
// words are worded. The tab: the opening settle reads as a read; only the families the market knows a material of; a
// closed listing's whole; a list held open is not closed under the pointer by an answer's redraw. The window: an act
// that throws leaves no button greyed. The service: a home's trader's stock is its own count, never the board's thirty;
// the default Materials view keeps the board's own region's listings beside the Bay's cheapest.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { walletReserve } from '../../src/net/realm/realmGoldLaw.js';
import { payUndoable } from '../../src/systems/court.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../../src/systems/inventory.js';
import { rentHomeRoom } from '../../src/systems/homeRent.js';
import { buyOnlineHome } from '../../src/systems/online/onlineHomes.js';
import { call, accountRefusalText } from '../../src/net/accountClient.js';
import { createMarketBook, MARKET_KEPT_TEXT } from '../../src/net/marketBook.js';
import { createMarketTab } from '../../src/ui/marketTab.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { VENDOR_STOCK_MAX, VENDOR_REFUSAL_WORDS } from '../../src/net/vendorLaw.js';
import { MARKET_LISTINGS_MAX, marketCatalogue } from '../../src/net/marketLaw.js';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `ma2-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 5));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

// ─── THE REFUNDS ─────────────────────────────────────────────────────

test('MARKET-AUDIT walletReserve: the payment\'s own undo, once, whoever asks - a refusal or a repeat; `credit` the whole only for a wallet that answers none, and nothing before it paid', () => {
  const calls = [];
  const exact = { pay: (n) => { calls.push(['pay', n]); return () => calls.push(['undo', n]); }, credit: (n) => calls.push(['credit', n]) };
  const a = walletReserve(exact, 40);
  a.back();
  assert.deepEqual(calls, [], 'nothing paid, nothing back');
  const back = a.reserve();
  back();
  a.back();
  assert.deepEqual(calls.splice(0), [['pay', 40], ['undo', 40]], 'once');
  const bare = { pay: (n) => { calls.push(['pay', n]); }, credit: (n) => calls.push(['credit', n]) };
  const b = walletReserve(bare, 7);
  b.reserve()();
  assert.deepEqual(calls.splice(0), [['pay', 7], ['credit', 7]]);
});

test('MARKET-AUDIT payUndoable: the purse and its letters, then the account - the undo puts each back where it was, once', () => {
  const letter = { templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 100 };
  const p = { goldPieces: 30, items: [letter] };
  const account = { accountGold: 1000 };
  const undo = payUndoable(p, 200, account);
  assert.deepEqual([p.goldPieces, p.items.length, account.accountGold], [0, 0, 930], 'the letter, the purse, then 70 off the account');
  undo();
  undo();
  assert.deepEqual([p.goldPieces, p.items.map((x) => x.value), account.accountGold], [30, [100], 1000]);
});

const wallet = (calls) => ({ gold: 1e9, pay: (n) => { calls.push(['pay', n]); return () => calls.push(['undo', n]); }, credit: (n) => calls.push(['credit', n]) });
const refusingRealm = (answer) => ({ act: async (o) => { const undo = o.reserve?.(); const r = await o.call({ id: 'x', seq: 1 }); if (!r.ok) undo?.(); else o.apply?.(r); return r; } , answer });

test('MARKET-AUDIT: a room\'s rent and a home\'s claim, refused or answered as a repeat, give back exactly what their payment took', async () => {
  const calls = [];
  const no = { ok: false, error: 'rent-taken', status: 409 };
  const r = await rentHomeRoom({ api: { rentRoom: async () => no }, realm: refusingRealm(), wallet: wallet(calls), mapId: 1, buildingKey: 2, character: 'c', room: 1, days: 2, price: 10 });
  assert.equal(r.ok, false);
  assert.deepEqual(calls.splice(0), [['pay', 20], ['undo', 20]]);
  const homes = { claim: async () => ({ ok: false, error: 'home-taken', status: 409 }), ensure: () => {} };
  const pay = (n) => { calls.push(['pay', n]); return () => calls.push(['undo', n]); };
  const refund = (n) => calls.push(['refund', n]);
  await buyOnlineHome(homes, { mapId: 1, buildingKey: 3, region: DF, price: 42_000, afford: () => true, pay, refund, realm: refusingRealm() });
  assert.deepEqual(calls.splice(0), [['pay', 42_000], ['undo', 42_000]], 'refused');
  const repeat = { claim: async () => ({ ok: true, repeat: true, data: {} }), ensure: () => {} };
  const realm = { act: async (o) => { o.reserve?.(); const r = await o.call({}); o.apply?.({ repeat: true }); return r; } };
  await buyOnlineHome(repeat, { mapId: 1, buildingKey: 4, region: DF, price: 42_000, afford: () => true, pay, refund, realm });
  assert.deepEqual(calls.splice(0), [['pay', 42_000], ['undo', 42_000]], 'a repeat');
});

test('MARKET-AUDIT: every realm act that pays out of the purse reserves through walletReserve - the guild\'s, the decor\'s, the market\'s; no whole-cost credit is left as a reserve\'s answer', () => {
  const guild = src('src/net/guild/guildBook.js');
  assert.equal((guild.match(/walletReserve\(w, /g) ?? []).length, 3, 'founding, the realm deposit and the deposit');
  const decor = src('src/scenes/decor/decorTool.js');
  assert.equal((decor.match(/walletReserve\(wallet, /g) ?? []).length, 2, 'a placement and a change');
  assert.match(src('src/net/marketBook.js'), /reserve: walletReserve\(w, cost\)\.reserve/);
  for (const f of ['src/net/guild/guildBook.js', 'src/scenes/decor/decorTool.js', 'src/systems/homeRent.js', 'src/systems/online/onlineHomes.js', 'src/net/marketBook.js']) {
    assert.doesNotMatch(src(f), /reserve: (?:pay > 0 \? )?\(\) => \{ [^}]*\bpay\([^)]*\); return \(\) => [^}]*\b(?:credit|refund)\??\.?\(/, `${f}: a reserve that credits the whole`);
  }
  // the hosts' wallets answer the undo
  // FIRM1: and the Firmament's respec, its gold reserved through walletReserve as the guild's founding is
  assert.match(src('src/net/firmament/firmamentBook.js'), /reserve: walletReserve\(w, FIRM_RESPEC_GOLD\)\.reserve/);
  assert.equal((src('src/scenes/world.js').match(/pay: \(n\) => payUndoable\(playerEntity, n, /g) ?? []).length, 3, 'the market\'s, the guild\'s and the Firmament\'s');
  // PIN MOVED (INSTANCES' HOST-SPLIT, 2026-10-15): the yards' wallet left bootWorld for scenes/homeYards.js - the player handed it
  assert.equal((src('src/scenes/homeYards.js').match(/pay: \(n\) => payUndoable\(entity, n, /g) ?? []).length, 1, 'the yards\'');
  assert.equal((src('src/scenes/worldModes.js').match(/pay: \(n\) => purse\.pay\(n, /g) ?? []).length, 3, 'the decor\'s, a claim\'s and the rent\'s');
});

// ─── THE DOOR AND THE BOOK ───────────────────────────────────────────

test('MARKET-AUDIT P1: a 2xx whose body never came is no word on the act - `offline`, unknown - and a 204 says nothing, ok', async () => {
  const lost = await call({ fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } }) }, '/v1/market/buy', { a: 1 });
  assert.deepEqual(lost, { ok: false, error: 'offline', unknown: true, status: 200 });
  const none = await call({ fetch: async () => ({ ok: true, status: 204, json: async () => { throw new SyntaxError('no body'); } }) }, '/v1/x', { a: 1 });
  assert.deepEqual(none, { ok: true, data: null, status: 204 });
  const whole = await call({ fetch: async () => ({ ok: true, status: 200, json: async () => ({ b: 2 }) }) }, '/v1/x', { a: 1 });
  assert.deepEqual(whole, { ok: true, data: { b: 2 }, status: 200 });
});

test('MARKET-AUDIT P6: a realm act\'s own words are said - never "the account service had a problem"', () => {
  const problem = accountRefusalText('server');
  for (const w of ['held', 'left', 'unknown']) assert.notEqual(accountRefusalText(w), problem, w);
  assert.equal(accountRefusalText('held'), 'A trade or purchase is being settled. Try again in a moment.');
});

test('MARKET-AUDIT P2, P3, P5: the minute\'s cache is the account\'s and character\'s; a hit says its board\'s cap; a refused collect is said', async () => {
  let acct = 'a1', reads = 0;
  const door = { account: () => acct, read: async (b) => { reads++; return { ok: true, data: { rows: [], listingsMax: b.board?.[0] === 1 ? 37 : 30 } }; } };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await book.read('mine', { region: DF, hubs: {}, board: [1, 1] });
  await book.read('mine', { region: DF, hubs: {}, board: [2, 2] });
  assert.equal(book.state.listingsMax, 30);
  await book.read('mine', { region: DF, hubs: {}, board: [1, 1] });
  assert.deepEqual([reads, book.state.listingsMax], [2, 37], 'the cached board\'s cap');
  acct = 'a2';
  await book.read('mine', { region: DF, hubs: {}, board: [1, 1] });
  assert.equal(reads, 3, 'another account reads its own');
  // a collect refused, said
  const cdoor = { account: () => 'a', collect: async () => ({ ok: false, error: 'market-gone', status: 404 }) };
  const cbook = createMarketBook({ door: cdoor, storage: memStorage(), character: () => 'me', sleep: noWait });
  cbook.state.road = [{ kind: 'piece', id: 'D1', character: 'me', ready: true }];
  const r = await cbook.settle(() => {}, () => {});
  assert.deepEqual([r.ok, r.settled, r.refused], [true, 0, ['market-gone']]);
});

// ─── THE TAB AND THE WINDOW ──────────────────────────────────────────

const ui = (extra = {}) => ({ busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true, ...extra });
const hostOf = (book, extra = {}) => ({
  book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: (r) => (r === WR ? 'Wayrest' : 'Daggerfall'), hubs: HUBS,
  name: () => 'Iron', countName: () => 'Iron', pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
  weavers: [], stock: async () => ({ ok: true }), ...extra,
});
const fakeBook = (data, extra = {}) => ({
  state: { open: true, balance: 500, road: [], counts: { listings: 0, orders: 0 }, held: 0 }, pending: 0, busy: false, goldOk: false,
  read: async (view) => ({ ok: true, data: data[view] ?? { rows: [] } }), cached: () => null, settle: async () => ({ ok: true, settled: 0, refused: [] }), ...extra,
});

test('MARKET-AUDIT P4, P5: the opening settle reads "Reading the market..."; a refused collect and an act still kept are said', async () => {
  const words = [];
  let drawn = null;
  const book = fakeBook({}, { pending: 1, settle: async () => { drawn = tab.body().textContent; return { ok: true, settled: 0, refused: ['market-gone'] }; } });
  const tab = createMarketTab(hostOf(book), ui({ run: async (start) => { words.push(await start()); } }));
  await tab.open();
  assert.match(drawn, /Reading the market\.\.\./);
  assert.deepEqual(words[0], { ok: false, text: accountRefusalText('market-gone') });
  const kept = fakeBook({}, { pending: 1 });
  const t2 = createMarketTab(hostOf(kept), ui({ run: async (start) => { words.push(await start()); } }));
  await t2.open();
  assert.deepEqual(words[1], { ok: true, text: MARKET_KEPT_TEXT });
});

test('MARKET-AUDIT: the filters offer the families the market knows a material of (no Spoils of War); a closed listing reads its whole', async () => {
  const book = fakeBook({ mine: { rows: [{ id: 'L', kind: 'material', material: 'metal:iron', units: 5, listed: 10, price: 3, region: DF, state: 'cancelled', expiresAt: 0, currency: 'marks' }], ways: {} } });
  const tab = createMarketTab(hostOf(book), ui());
  await tab.load(true);
  const fam = [...tab.body().querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'Family');
  const offered = [...fam.querySelectorAll('option')].map((o) => o.value).filter(Boolean);
  assert.ok(!offered.includes('spoils'));
  assert.deepEqual(offered, [...new Set(marketCatalogue().map((c) => c.family))].sort((a, b) => offered.indexOf(a) - offered.indexOf(b)));
  tab.state.view = 'mine';
  await tab.load(true);
  const text = tab.body().textContent;
  assert.match(text, /Iron x10/);
  assert.doesNotMatch(text, /5 of 10 left/);
});

test('MARKET-AUDIT: an answer\'s redraw waits while a list of the tab is held open, and draws when it is let go', async () => {
  let draws = 0;
  const book = fakeBook({});
  const tab = createMarketTab(hostOf(book), ui({ rerender: () => { draws++; } }));
  const listeners = [];
  const held = { tagName: 'SELECT', classList: { contains: (c) => c === 'market-select' }, addEventListener: (ev, fn) => listeners.push([ev, fn]) };
  const doc = globalThis.document;
  const was = Object.getOwnPropertyDescriptor(doc, 'activeElement');
  Object.defineProperty(doc, 'activeElement', { configurable: true, get: () => held });
  try {
    await tab.load(true);
  } finally {
    if (was) Object.defineProperty(doc, 'activeElement', was); else delete doc.activeElement;
  }
  assert.equal(draws, 1, 'the read began drawn; its answer waits');
  assert.deepEqual(listeners.map(([ev]) => ev), ['blur']);
  listeners[0][1]();
  assert.equal(draws, 2);
});

test('MARKET-AUDIT: an act that throws leaves no button greyed - the window says the service\'s problem and draws again', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const data = { materials: { rows: [{ id: 'A', kind: 'material', material: 'metal:iron', units: 5, price: 2, region: DF, road: { courier: 0, seconds: 0, road: 0 }, mine: false, currency: 'marks' }], medians: {} } };
  const book = fakeBook(data, { buy: async () => { throw new TypeError('boom'); } });
  const host = document.createElement('div');
  const warn = console.warn; console.warn = () => {};
  const v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 1 }, book: noticeBook, market: hostOf(book) });
  try {
    [...host.querySelectorAll('.notice-tab')].find((t) => t.textContent === 'Market').onclick();
    await tick();
    [...host.querySelectorAll('button')].find((b) => b.className.includes('market-row')).onclick();
    await [...host.querySelectorAll('button')].find((b) => b.textContent === 'Buy').onclick();
    await tick();
    assert.ok(host.textContent.includes(accountRefusalText('server')));
    assert.equal([...host.querySelectorAll('button')].find((b) => b.textContent === 'Buy').disabled, false);
  } finally { console.warn = warn; v.unmount(); }
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const row = raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, bought, price, fee, at, expires_at, rid, n, currency, vendor_map, vendor_id, item)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, 1, ?, ?, ?, 'n', ?, ?, ?, ?)`);
  const put = (who, { id, region = DF, price = 1, vendor = null, item = null }) => row.run(id, who.id, who.character, region, item ? 'item' : 'material', item ? null : 'metal:iron',
    price, _now, _now + 86_400, `r-${id}`, item ? 'gold' : 'marks', vendor ? vendor.map : null, vendor ? vendor.id : null, item ? JSON.stringify(item) : null);
  return { ...s, raw, put };
}

test('MARKET-AUDIT: the default Materials view keeps the board\'s own region\'s listings beside the Bay\'s hundred cheapest', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  for (let i = 0; i < 100; i++) s.put(mac, { id: `bay${String(i).padStart(3, '0')}`, region: WR, price: 1 });
  s.put(mac, { id: 'home0001', region: DF, price: 9 });
  const rows = (await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'materials', hubs: HUBS }, ann.secret)).body.rows;
  assert.ok(rows.some((r) => r.id === 'home0001'), 'the board\'s own');
  assert.equal(rows.length, 101);
});

test('MARKET-AUDIT: a home\'s trader\'s stock is its own count - thirty on the board leave the trader stocked, and the trader\'s sixty stop at its own word', async () => {
  const s = await stand();
  const MAP = 1001, KEY = 4242, VENDOR = { map: MAP, id: 'trader1' };
  const eve = await s.registered('Eve');
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
  const weapon = JSON.parse(JSON.stringify(items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE)));
  const R = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, items: [weapon, weapon], goldPieces: 0 });
  eve.character = R.id;
  s.raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, 'Eve', ?, 'public', 1000, ?)`).run(MAP, KEY, eve.id, eve.character, DF, _now);
  s.raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (?, ?, 'trader1', NULL, 182, 3, ?, ?, NULL, 0, 0)`)
    .run(MAP, KEY, JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'vendor' }), _now);
  for (let i = 0; i < MARKET_LISTINGS_MAX; i++) s.put(eve, { id: `brd${String(i).padStart(3, '0')}` });
  const stock = (pick) => s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'item', item: validLootList([weapon])[0], pick, price: 50, hubs: HUBS, rid: rid(), currency: 'gold', realm: R.at(), vendor: VENDOR }, eve.secret);
  const first = await stock(0);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  for (let i = 1; i < VENDOR_STOCK_MAX; i++) s.put(eve, { id: `stl${String(i).padStart(3, '0')}`, vendor: VENDOR, item: { templateIndex: 1 } });
  assert.deepEqual((await stock(0)).body, { error: 'vendor-full' });
  assert.equal(accountRefusalText('vendor-full'), VENDOR_REFUSAL_WORDS['vendor-full']);
  // and the board's thirty still the board's
  const counts = (await s.call('/v1/market/read', { character: eve.character, region: DF, view: 'mine', hubs: HUBS }, eve.secret)).body.counts;
  assert.equal(counts.listings, MARKET_LISTINGS_MAX);
});

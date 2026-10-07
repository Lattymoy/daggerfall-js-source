// MARKET-AUDIT (2026-10-04, Mac: "I think the ingame market board is broken. Please audit this") - THE MARKET AUDITED: three
// lanes (the service, the client's book, the tab and its host) read the market end to end and reproduced what broke.
// MARKET-BAG - since BAG1 every harvest is carried (bag, then pack) and the List form and Fill read the Stores alone: a
// gatherer had nothing to sell and "0 in your Stores" on every order; what is carried now counts, put in first as a
// station's inputs are. The service: a one-Mark unit its tax took whole threw the sale (a 0 line the ledger refuses, 500,
// the buy kept and asked again for ever) - S1; a fill paying nothing said "the buyer's Stores cannot hold that many" and an
// order's last such unit could never be filled - S2; a gold unit whose tax and fee passed its price said `stores-full` -
// S3; the Orders view's family read after its cutoff - S4. The book: a refused gold buy gave its whole cost back as coins
// (a letter of credit and the bank's gold into the purse) - B1; a read that joined one under way answered null when an
// act overtook it (the tab threw and stood blank) - B2; a buy pressed again after a lost answer bought twice - B4. The tab:
// pieces of one name told apart (U2), pieces past the read's 64 offered (U3), a shut market keeps its tab and says so
// (U4), a failed read keeps the filters and the counters (U5), an act's word stays with its view (U6), another
// character's delivery is that character's (U7). Driven through the real Worker over node:sqlite and the fake DOM.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { createMarketBook, MARKET_KEPT_TEXT } from '../src/net/marketBook.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { deductGoldUndoable } from '../src/systems/court.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { MARKET_HELD_MAX, fillTaxOn, saleTaxOn } from '../src/net/marketLaw.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `mau-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 5));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const lines = (kind) => raw.prepare('SELECT src_kind, dst_kind, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind).map((r) => [r.src_kind, r.dst_kind, Number(r.amount)]);
  return { ...s, raw, give, fund, balance, lines };
}

// ─── THE SERVICE ─────────────────────────────────────────────────────

test('MARKET-AUDIT S1: a one-Mark unit its tax takes whole is sold - its seller paid nothing, no line of 0 - where the ledger threw it (500, kept for ever); asked again, one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.give(mac, 'metal:iron', 'own', 100);
  s.fund(mac, 100);
  s.fund(ann, 100);
  const l = (await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'material', material: 'metal:iron', units: 40, price: 1, hubs: HUBS, rid: rid() }, mac.secret)).body.listing;
  const buy = (units, r = rid()) => s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.id, units, max: units, hubs: HUBS, rid: r }, ann.secret);
  assert.equal((await buy(19)).status, 200);
  const macBefore = s.balance(mac);
  const r = rid();
  const b = await buy(1, r);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual([b.body.sale.total, b.body.sale.tax], [1, saleTaxOn(19, 1)]);
  assert.equal(saleTaxOn(19, 1), 1, 'the twentieth unit\'s tax is the whole of it');
  assert.equal(s.balance(mac), macBefore, 'its seller paid nothing');
  assert.deepEqual(s.lines('market-sale').map((x) => x[2]), [19], 'no line of 0');
  const again = await buy(1, r);
  assert.deepEqual([again.status, again.body.repeat], [200, true]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM market_sales WHERE buyer = ?').get(ann.id).n, 2);
});

test('MARKET-AUDIT S2: a fill its tax would leave paying nothing is refused for what it is (`market-taxed-out`, never "the buyer\'s Stores"); an order\'s last such unit pays a Mark and fills', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 100);
  s.give(ann, 'metal:iron', 'own', 100);
  const order = async (units) => (await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'metal:iron', units, price: 1, hubs: HUBS, rid: rid() }, mac.secret)).body.order;
  const fill = (o, units) => s.call('/v1/market/fill', { character: ann.character, region: DF, order: o.id, units, hubs: HUBS, rid: rid() }, ann.secret);
  // forty: the twentieth alone pays nothing - refused, said why; two at once pay
  const forty = await order(40);
  assert.equal((await fill(forty, 19)).status, 200);
  assert.deepEqual((await fill(forty, 1)).body, { error: 'market-taxed-out' });
  const two = await fill(forty, 2);
  assert.deepEqual([two.status, two.body.fill.pay, two.body.fill.tax], [200, 1, 1]);
  // twenty: the last unit pays a Mark, the tax short by it - an order's last units are never left unfillable
  const twenty = await order(20);
  assert.equal((await fill(twenty, 19)).status, 200);
  const last = await fill(twenty, 1);
  assert.deepEqual([last.status, last.body.fill.pay, last.body.fill.tax], [200, 1, 0]);
  assert.equal(s.raw.prepare('SELECT state FROM market_orders WHERE id = ?').get(twenty.id).state, 'filled');
  assert.deepEqual([fillTaxOn(19, 1), fillTaxOn(19, 1, true), fillTaxOn(19, 2, true), fillTaxOn(0, 20, true)], [1, 0, 1, 1], 'the law the tab reads too');
  assert.equal(accountRefusalText('market-taxed-out'), 'Filled alone, that would pay you nothing once the tax is taken. Fill more at once.');
});

test('MARKET-AUDIT S3: a gold unit whose tax and fee pass its price sells - its seller held nothing more - where the CHECK said `stores-full`', async () => {
  const s = await stand();
  const seated = async (handle, save) => { const who = await s.registered(handle); const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], ...save }); who.character = R.id; who.at = R.at; return who; };
  const eve = await seated('Eve', { goldPieces: 0 });
  const bob = await seated('Bob', { goldPieces: 1000 });
  s.give(eve, 'ore:mithril', 'own', 100);
  const l = (await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'material', material: 'ore:mithril', units: 40, price: 1, hubs: HUBS, rid: rid(), currency: 'gold' }, eve.secret)).body.listing;
  const buy = (units) => s.call('/v1/market/buy', { character: bob.character, region: DF, listing: l.id, units, max: units, hubs: HUBS, rid: rid(), realm: bob.at() }, bob.secret);
  assert.equal((await buy(19)).status, 200);
  const held = () => Number(s.raw.prepare('SELECT gold FROM market_gold WHERE player = ?').get(eve.id)?.gold ?? 0);
  const before = held();
  const b = await buy(1);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(held(), before, 'nothing more held, never less');
});

test('MARKET-AUDIT S4: the Orders view\'s family is chosen before its cutoff - a hundred dearer orders of another family hid it', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 10_000_000);
  for (let i = 0; i < 101; i++) {
    s.raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
      VALUES (?, ?, ?, ?, 'metal:iron', 1, 1, 50, 50, ?, ?, ?, 'n')`).run(`o${String(i).padStart(4, '0')}`, mac.id, mac.character, DF, _now, _now + 86_400, `r${i}xxxxxx`);
  }
  const ann = await s.registered('Ann');
  s.fund(ann, 100);
  const wood = await s.call('/v1/market/order', { character: ann.character, region: WR, material: 'log:pine', units: 5, price: 1, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(wood.status, 200, JSON.stringify(wood.body));
  const read = async (family) => (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'orders', hubs: HUBS, family }, mac.secret)).body.orders;
  assert.deepEqual((await read('wood')).map((o) => o.material), ['log:pine']);
  assert.equal((await read(null)).length, 100, 'the view\'s hundred');
});

// ─── THE BOOK ────────────────────────────────────────────────────────

test('MARKET-AUDIT B1: a refused gold payment gives back exactly what it took - the coins, a letter\'s value, a spent letter into the pack - never its whole cost as coins', () => {
  const letter = { templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 30_000 };
  const small = { templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 100 };
  const sword = { templateIndex: 120 };
  const p = { goldPieces: 50, items: [small, sword, letter] };
  const { owed, undo } = deductGoldUndoable(p, 20_000);
  assert.deepEqual([owed, p.goldPieces, p.items.includes(small), letter.value], [0, 50, false, 10_100], 'DFU\'s order: the letters, the small one whole');
  p.goldPieces += 7;   // gold the purse gained between
  undo();
  assert.deepEqual([p.goldPieces, letter.value, small.value, p.items.length], [57, 30_000, 100, 3]);
  undo();
  assert.deepEqual([p.goldPieces, letter.value, p.items.length], [57, 30_000, 3], 'once');
  // past the letters: the purse's coins, and what is owed beyond them answered for the bank
  const q = { goldPieces: 40, items: [{ templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 10 }] };
  const r = deductGoldUndoable(q, 70);
  assert.deepEqual([r.owed, q.goldPieces, q.items.length], [20, 0, 0]);
  r.undo();
  assert.deepEqual([q.goldPieces, q.items.map((x) => x.value)], [40, [10]]);
});

test('MARKET-AUDIT B1: the book\'s gold buy, refused, runs the wallet\'s own undo - `credit` the whole cost only for a wallet that answers none', async () => {
  const calls = [];
  const realm = { act: async (o) => { const undo = o.reserve?.(); const r = await o.call({ id: 'x', seq: 1 }); if (!r.ok) undo?.(); return r; } };
  const wallet = (pays) => () => ({ gold: () => 1000, pay: (n) => { calls.push(['pay', n]); return pays ? () => calls.push(['undo', n]) : undefined; }, credit: (n) => calls.push(['credit', n]), bank: () => {} });
  for (const pays of [true, false]) {
    calls.length = 0;
    const door = { account: () => 'a', buy: async () => ({ ok: false, error: 'market-gone', status: 404 }) };
    const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait, realm, wallet: wallet(pays) });
    const r = await book.buy({ region: DF, listing: 'L1234', units: 1, max: 300, hubs: HUBS, currency: 'gold' }, () => {});
    assert.equal(r.error, 'market-gone');
    assert.deepEqual(calls, pays ? [['pay', 300], ['undo', 300]] : [['pay', 300], ['credit', 300]]);
  }
});

test('MARKET-AUDIT B2: a read that joins one under way, an act answering between, is read again - never null', async () => {
  const releases = [];
  const door = { account: () => 'a', read: () => new Promise((r) => releases.push(() => r({ ok: true, data: { rows: [{ id: 'X' }], balance: 5 } }))) };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  const q = { region: DF, hubs: {} };
  const first = book.read('materials', q, { force: true });
  const second = book.read('materials', q);
  book.forget();
  releases.shift()();
  await tick();
  while (releases.length) { releases.shift()(); await tick(); }
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual([a?.data?.rows?.[0]?.id, b?.data?.rows?.[0]?.id], ['X', 'X']);
});

test('MARKET-AUDIT B4: Buy pressed again after its answer was lost asks the kept buy again with its own id - never a second purchase', async () => {
  const rids = [];
  let online = false;
  const door = { account: () => 'a', buy: async (b) => { rids.push(b.rid); return online ? { ok: true, data: { sale: { here: true }, balance: 1 } } : { ok: false, error: 'offline' }; } };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  const req = { region: DF, listing: 'L1234', units: 20, max: 40, hubs: HUBS };
  const lost = await book.buy(req, () => {});
  assert.deepEqual([lost.kept, lost.text, book.pending], [true, MARKET_KEPT_TEXT, 1]);
  online = true;
  const again = await book.buy(req, () => {});
  assert.equal(again.ok, true);
  assert.equal(new Set(rids).size, 1, 'one id, however many presses');
  assert.equal(book.pending, 0);
});

// ─── THE TAB ─────────────────────────────────────────────────────────

const ui = (extra = {}) => ({ busy: () => false, run: async (start) => { await start(); }, rerender: () => {}, nowS: () => 0, alive: () => true, ...extra });
const hostOf = (book, extra = {}) => ({
  book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: (r) => (r === WR ? 'Wayrest' : 'Daggerfall'), hubs: HUBS,
  name: () => 'Iron', countName: () => 'Iron', pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
  weavers: [], stock: async () => ({ ok: true }), ...extra,
});
const fakeBook = (data, extra = {}) => ({
  state: { open: true, balance: 500, road: [], counts: { listings: 0, orders: 0 }, held: 0 }, pending: 0, busy: false, goldOk: false,
  read: async (view) => ({ ok: true, data: typeof data === 'function' ? data(view) : data[view] ?? { rows: [] } }), cached: () => null,
  settle: async () => ({ ok: true, settled: 0 }), ...extra,
});

test('MARKET-BAG: what the bag and the pack carry counts toward a silver listing and a fill, its shortfall put into the Stores first - a refused put-in is the act\'s word and nothing is asked; a gold listing\'s are its Stores\' own', async () => {
  const calls = [];
  const order = { id: 'O', region: DF, material: 'metal:iron', units: 40, left: 40, price: 3, state: 'open', mine: false, expiresAt: 99_999, road: { courier: 0, seconds: 0, road: 0 } };
  const book = fakeBook({ orders: { orders: [order], medians: {} }, mine: { rows: [], ways: {} } }, {
    list: async (req) => { calls.push(['list', req.material, req.units]); return { ok: true }; },
    fill: async (req) => { calls.push(['fill', req.order, req.units]); return { ok: true, data: { fill: { pay: 1 } } }; },
  });
  let refuse = false;
  const stores = new Map([['metal:iron', { material: 'metal:iron', own: 5, bought: 0 }]]);
  const tab = createMarketTab(hostOf(book, {
    stores: () => stores, carried: () => new Map([['metal:iron', 35]]),
    putIn: async (key, n) => { calls.push(['putIn', key, n]); return refuse ? { ok: false, error: 'materials-short' } : { ok: true, moved: n - 5 }; },
  }), ui());
  // the Orders view: forty to fill, five in the Stores and thirty-five carried
  tab.state.view = 'orders';
  await tab.load(true);
  let node = tab.body();
  assert.match(node.textContent, /5 in your Stores, 35 carried - pays you 114 silver after tax/);
  const fill = () => [...node.querySelectorAll('button')].find((b) => b.textContent.startsWith('Fill'));
  assert.equal(fill().textContent, 'Fill 40 from the Stores');
  await fill().onclick();
  assert.deepEqual(calls.splice(0), [['putIn', 'metal:iron', 40], ['fill', 'O', 40]]);
  // My listings: the material offered with what is carried, its shortfall said
  tab.state.view = 'mine';
  tab.state.list.units = 30;
  await tab.load(true);
  node = tab.body();
  assert.deepEqual([...node.querySelectorAll('option')].filter((o) => o.value === 'metal:iron').map((o) => o.textContent), ['Iron (40)']);
  assert.match(node.textContent, /25 units of it go into your Stores from your bag and pack first\./);
  const list = () => [...node.querySelectorAll('button')].find((b) => b.textContent === 'List');
  assert.equal(list().disabled, false);
  await list().onclick();
  assert.deepEqual(calls.splice(0), [['putIn', 'metal:iron', 30], ['list', 'metal:iron', 30]]);
  // a put-in refused: its word, nothing listed
  refuse = true;
  await tab.load(true);
  node = tab.body();
  let word = null;
  const tab2 = createMarketTab(hostOf(book, { stores: () => stores, carried: () => new Map([['metal:iron', 35]]), putIn: async () => ({ ok: false, error: 'materials-short' }) }),
    ui({ run: async (start) => { word = await start(); } }));
  tab2.state.view = 'mine';
  tab2.state.list.units = 30;
  await tab2.load(true);
  await [...tab2.body().querySelectorAll('button')].find((b) => b.textContent === 'List').onclick();
  assert.equal(word.text, accountRefusalText('materials-short'));
  assert.deepEqual(calls.filter((c) => c[0] === 'list'), []);
  // nothing anywhere: said
  const empty = createMarketTab(hostOf(book, { carried: () => new Map() }), ui());
  empty.state.view = 'mine';
  await empty.load(true);
  assert.match(empty.body().textContent, /You have no materials to sell\./);   // BOARD-UI (PIN MOVED): the words cut
});

test('MARKET-AUDIT U2, U3: a crafted piece is offered with its quality and wear; one past the read\'s first 64 is offered too - the service says which way it goes', async () => {
  const pieces = Array.from({ length: MARKET_HELD_MAX + 6 }, (_, i) => ({
    item: { provenance: i.toString(16).padStart(16, '0'), quality: i % 3, maxCondition: 100, currentCondition: i === 0 ? 62 : 100 }, where: 'pack', name: 'Mithril Longsword',
  }));
  const ways = Object.fromEntries(pieces.slice(0, MARKET_HELD_MAX).map((p) => [p.item.provenance, 'yours']));
  const book = fakeBook({ mine: { rows: [], ways } });
  const tab = createMarketTab(hostOf(book, { pieces: () => pieces }), ui());
  tab.state.view = 'mine';
  tab.state.list.kind = 'piece';
  await tab.load(true);
  const options = [...tab.body().querySelectorAll('select')].find((s) => s.getAttribute('aria-label') === 'Crafted piece').querySelectorAll('option');
  assert.equal(options.length, MARKET_HELD_MAX + 6, 'every piece offered');
  assert.deepEqual([...options].slice(0, 3).map((o) => o.textContent), ['Mithril Longsword, Crude, worn to 62%', 'Mithril Longsword, Standard', 'Mithril Longsword, Fine']);
});

test('MARKET-AUDIT U5, U7: a failed read keeps the filters and the counters, its word and Try again among them; another character\'s delivery waits for that one, never asked here', async () => {
  let fail = true;
  const settles = [];
  const book = fakeBook({}, {
    read: async () => (fail ? { ok: false, error: 'offline' } : { ok: true, data: { rows: [] } }),
    settle: async () => { settles.push(1); return { ok: true, settled: 0 }; },
    me: () => 'me',
  });
  book.state.road = [{ kind: 'piece', id: 'D', character: 'other', ready: true, from: WR, why: 'bought', piece: {} }];
  const tab = createMarketTab(hostOf(book, { weavers: [{ key: 'cloth:wool', marks: 3 }] }), ui());
  await tab.open();
  const node = tab.body();
  assert.match(node.textContent, /The market did not load\.Try again/);   // BOARD-UI (PIN MOVED)
  assert.ok([...node.querySelectorAll('select')].some((x) => x.getAttribute('aria-label') === 'Family'), 'the filters');
  assert.match(node.textContent, /The Weavers' counter/);
  assert.match(node.textContent, /a piece from Wayrest - waiting for another of your characters/);
  assert.deepEqual(settles, [], 'never asked after here');
});

test('MARKET-AUDIT U4, U6: a market that shuts while its tab is read keeps the tab and says so; an act\'s word stays with its view', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  // shut
  const shut = createMarketBook({ door: { account: () => 'a', read: async () => ({ ok: false, error: 'market-closed', status: 403 }) }, character: () => 'c', sleep: noWait });
  let host = document.createElement('div');
  let v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 1 }, book: noticeBook, market: hostOf(shut) });
  await tick();
  [...host.querySelectorAll('.notice-tab')].find((t) => t.textContent === 'Market').onclick();
  await tick(); await tick();
  assert.ok([...host.querySelectorAll('.notice-tab')].some((t) => t.textContent === 'Market'), 'the tab stays');
  assert.ok(host.textContent.includes(accountRefusalText('market-closed')), 'its shut word said');
  v.unmount();
  // the word: Bought, then another view
  const data = { materials: { rows: [{ id: 'A', kind: 'material', material: 'metal:iron', units: 5, price: 2, region: DF, road: { courier: 0, seconds: 0, road: 0 }, mine: false, currency: 'marks' }], medians: {} } };
  const book = fakeBook(data, { buy: async () => ({ ok: true, data: { sale: { here: true } } }) });
  host = document.createElement('div');
  v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 1 }, book: noticeBook, market: hostOf(book) });
  [...host.querySelectorAll('.notice-tab')].find((t) => t.textContent === 'Market').onclick();
  await tick();
  [...host.querySelectorAll('button')].find((b) => b.className.includes('market-row')).onclick();
  await [...host.querySelectorAll('button')].find((b) => b.textContent === 'Buy').onclick();
  await tick();
  assert.match(host.textContent, /Bought 5 Iron\./);
  [...host.querySelectorAll('button')].find((b) => b.textContent === 'History').onclick();
  await tick();
  assert.doesNotMatch(host.textContent, /Bought 5 Iron\./);
  v.unmount();
});

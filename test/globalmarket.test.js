// GLOBAL-MARKET (2026-10-04, Mac: "ensure the market is global") - EVERY BOARD'S MARKET IS THE BAY'S: a listing was read
// from every region already (its courier quoted to the reader's board), but a buy order stood on the boards of its own
// region alone - the Orders view read `region = ?1` and a fill from any other board was refused `market-elsewhere`. Now the
// Orders view reads every board's open orders, each with its road from the reader's board, and a fill from another
// region pays the courier out of its pay (by the load, as a buy's: burnt, its Tithe share to the filler's board's seat),
// the units into the orderer's Stores at once; a fill whose courier would take all it pays is refused before anything
// moves. Driven through the real Worker over node:sqlite (test/accountDb.mjs), and the tab over the fake DOM.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { courierFee, roadPixels, saleTaxOn } from '../src/net/marketLaw.js';
import { createMarketTab } from '../src/ui/marketTab.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `glb-${String(++_rid).padStart(6, '0')}`;
/** Daggerfall (17) and Wayrest (23), their hubs as a client derives them (test pixels - MAPS.BSA stays out of the tree). */
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind)
    .map((r) => [r.src_kind, r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  const read = (who, view, region) => s.call('/v1/market/read', { character: who.character, region, view, hubs: HUBS }, who.secret);
  return { ...s, raw, stores, give, balance, fund, lines, read };
}

test('GLOBAL-MARKET service: the Orders view reads every board\'s open orders, dearest first, each with its road from the reader\'s board, and a family\'s alone', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 5000);
  s.fund(ann, 5000);
  const df = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 200, price: 8, hubs: HUBS, rid: rid() }, mac.secret);
  const wr = await s.call('/v1/market/order', { character: ann.character, region: WR, material: 'metal:iron', units: 50, price: 9, hubs: HUBS, rid: rid() }, ann.secret);
  assert.deepEqual([df.status, wr.status], [200, 200]);
  // read at a board in Daggerfall: both regions' orders, the dearest first, Wayrest's with its road
  const fromDf = (await s.read(mac, 'orders', DF)).body.orders;
  assert.deepEqual(fromDf.map((o) => [o.material, o.region, o.price, o.mine, o.road]), [
    ['metal:iron', WR, 9, false, { courier: courierFee(1, ROAD), seconds: fromDf[0].road.seconds, road: ROAD }],
    ['ore:mithril', DF, 8, true, { courier: 0, seconds: 0, road: 0 }],
  ]);
  // and at a board in Wayrest the same two, the road the other way
  const fromWr = (await s.read(ann, 'orders', WR)).body.orders;
  assert.deepEqual(fromWr.map((o) => [o.material, o.region, o.road.road]), [['metal:iron', WR, 0], ['ore:mithril', DF, ROAD]]);
  // a family's orders alone - its own region's or another's
  await s.call('/v1/market/order', { character: ann.character, region: WR, material: 'log:pine', units: 10, price: 50, hubs: HUBS, rid: rid() }, ann.secret);
  const ofFamily = async (family) => (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'orders', hubs: HUBS, family }, mac.secret)).body.orders.map((o) => o.material);
  assert.deepEqual(await ofFamily('metals'), ['metal:iron', 'ore:mithril']);
  assert.deepEqual(await ofFamily('wood'), ['log:pine']);
});

test('GLOBAL-MARKET service: a fill from another region pays the courier out of its pay - by the load, burnt from the escrow - the units into the orderer\'s Stores at once; one its courier would eat refused; a pay below the one agreed is `market-price-moved`; asked twice one; both hubs witnessed', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * 86_400, ann.id);
  s.fund(mac, 5000);
  const o = (await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 200, price: 8, hubs: HUBS, rid: rid() }, mac.secret)).body.order;
  s.give(ann, 'ore:mithril', 'own', 100);
  const fill = { character: ann.character, region: WR, order: o.id, hubs: HUBS };
  // one unit from Wayrest: 8 silver, its courier past it - refused, nothing moved
  assert.ok(courierFee(1, ROAD) >= 8);
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, units: 1, rid: rid() }, ann.secret)).body, { error: 'market-courier-dear' });
  assert.deepEqual([s.stores(ann, 'ore:mithril'), s.stores(mac, 'ore:mithril'), s.balance(ann)], [[['own', 100]], [], 0]);
  // forty from Wayrest: two loads on the road, out of the pay
  const courier = courierFee(40, ROAD);
  const tax = saleTaxOn(0, 320);
  assert.equal(courier, Math.ceil((2 * (25 + ROAD)) / 25), 'two loads of 20, the road');
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, units: 40, least: 320 - tax - courier + 1, rid: rid() }, ann.secret)).body, { error: 'market-price-moved' }, 'less than agreed');
  const r = rid();
  const f = await s.call('/v1/market/fill', { ...fill, units: 40, least: 320 - tax - courier, rid: r }, ann.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual([f.body.fill.pay, f.body.fill.tax, f.body.fill.courier, f.body.balance], [320 - tax - courier, tax, courier, 320 - tax - courier]);
  assert.deepEqual(s.lines('order-fill'), [['escrow', o.id, 'account', ann.id, 320 - tax - courier]]);
  assert.deepEqual(s.lines('market-tax'), [['escrow', o.id, 'burn', null, tax]]);
  assert.deepEqual(s.lines('courier'), [['escrow', o.id, 'burn', null, courier]]);
  assert.deepEqual([s.stores(ann, 'ore:mithril'), s.stores(mac, 'ore:mithril')], [[['own', 60]], [['bought', 40]]], 'into the orderer\'s Stores at once');
  const row = s.raw.prepare('SELECT left_units, escrow FROM market_orders WHERE id = ?').get(o.id);
  assert.deepEqual([Number(row.left_units), Number(row.escrow)], [160, 1600 - 320], 'the escrow drawn by the whole price');
  // the witnesses: both ends' hubs, from an account a week old - the fill's own, before any fill here
  const hubs = s.raw.prepare("SELECT key, report FROM world_witness WHERE kind = 'hub' AND account = ? ORDER BY key").all(ann.id).map((w) => [w.key, w.report]);
  assert.deepEqual(hubs, [[String(DF), '207,212'], [String(WR), '590,166']]);
  // asked twice, one
  const again = await s.call('/v1/market/fill', { ...fill, units: 40, rid: r }, ann.secret);
  assert.deepEqual([again.body.repeat, again.body.fill.courier, s.lines('courier').length], [true, courier, 1]);
  // here, no courier
  const here = await s.call('/v1/market/fill', { ...fill, region: DF, units: 20, rid: rid() }, ann.secret);
  assert.deepEqual([here.status, here.body.fill.courier, s.lines('courier').length], [200, 0, 1]);
  // no road known: refused
  assert.deepEqual((await s.call('/v1/market/fill', { ...fill, region: 5, units: 20, rid: rid() }, ann.secret)).body, { error: 'market-no-road' });
});

test('GLOBAL-MARKET tab: an order of another region says where it stands and what a fill pays after its courier, Fill sending the pay agreed and the board; one whose courier would eat its pay is not offered; the empty view and the listing hints speak of the Bay', async () => {
  const calls = [];
  const order = (extra) => ({ id: 'O', region: WR, material: 'ore:mithril', units: 200, left: 140, price: 8, state: 'open', mine: false, expiresAt: 99_999, road: { courier: 0, seconds: 0, road: ROAD }, ...extra });
  let rows = [order()];
  const book = {
    state: { open: true, balance: 500, road: [], counts: { listings: 0, orders: 0 }, held: 0 },
    pending: 0, busy: false, goldOk: false,
    read: async (view) => ({ ok: true, data: view === 'orders' ? { orders: rows, medians: {} } : { rows: [] } }),
    cached: () => null,
    fill: async (req) => { calls.push(['fill', req]); return { ok: true, data: { fill: { pay: 1 } } }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const ui = { busy: () => false, run: async (start) => { await start(); }, rerender: () => {}, nowS: () => 0, alive: () => true };
  const stores = new Map([['ore:mithril', { material: 'ore:mithril', own: 60, bought: 0 }]]);
  const tab = createMarketTab({
    book, stores: () => stores, region: DF, regionName: 'Daggerfall', regionNameOf: (r) => (r === WR ? 'Wayrest' : 'Daggerfall'), hubs: HUBS,
    name: () => 'Mithril Ore', countName: () => 'Mithril Ore', pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => '',
    weavers: [], stock: async () => ({ ok: true }), board: [207, 212],
  }, ui);
  tab.state.view = 'orders';
  await tab.load(true);
  let node = tab.body();
  const text = () => node.textContent;
  const fillButton = () => [...node.querySelectorAll('button')].find((b) => b.textContent.startsWith('Fill'));
  const courier = courierFee(60, ROAD), tax = saleTaxOn(60 * 8, 480);
  assert.match(text(), /Wayrest/);
  assert.match(text(), new RegExp(`60 in your Stores - pays you ${480 - tax - courier} silver after ${courier} courier and tax`));
  assert.equal(fillButton().disabled, false);
  await fillButton().onclick();
  assert.deepEqual(calls.at(-1), ['fill', { region: DF, order: 'O', units: 60, hubs: HUBS, least: 480 - tax - courier, board: [207, 212] }]);
  // one unit of a cheap order: the courier would take it all - said, and not offered
  rows = [order({ price: 1, units: 1, left: 1 })];
  await tab.load(true);
  node = tab.body();
  assert.match(text(), /the courier to Wayrest would take all it pays/);
  assert.equal(fillButton().disabled, true);
  // no road known: said, and not offered
  rows = [order({ road: null })];
  await tab.load(true);
  node = tab.body();
  assert.match(text(), /the couriers do not know the road to Wayrest yet/);
  assert.equal(fillButton().disabled, true);
  // none at all: the Bay's boards
  rows = [];
  await tab.load(true);
  node = tab.body();
  assert.match(text(), /No buy orders right now\./);   // BOARD-UI (PIN MOVED): the words cut
  assert.match(text(), /on every board\)\. Sellers outside Daggerfall pay the courier\./);
});

// RPT1026-LEDGERLAW (2026-10-26, a private report: a stolen piece another player sold looked like any other; the
// batch's Field-Bugs page): a stolen piece carries its theft (systems/stolenGoods.js - `stolen`, which
// rides the save, the wire and a listing: a piece handed on is no less stolen), and its buyer takes the court's risk and a
// counter that destroys it at the sale - but the rows another player buys from said it nowhere: the market's Goods
// (ui/marketTab.js) and a home's trader (ui/vendor/vendorTab.js, its look - scenes/vendorHost.js - and the Vendor page's
// search, ui/vendor/vendorPage.js). The piece is stolen by the theft's own law (stolenGoods.js takenFromKeeping), listed
// from a realm character's pack by the real Worker over node:sqlite (test/accountDb.mjs) and read back as the Goods view
// reads it; the tab draws that row.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { validLootList } from '../../src/systems/loot/loot.js';
import { takenFromKeeping, isStolen, stolenTag, stolenLine } from '../../src/systems/stolenGoods.js';
import { createMarketTab } from '../../src/ui/marketTab.js';
import { createVendorTab, vendorStatsNode } from '../../src/ui/vendor/vendorTab.js';
import { createVendorHost } from '../../src/scenes/vendorHost.js';
import { setVendorPage, drawVendorPage, resetVendorPage } from '../../src/ui/vendor/vendorPage.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
const DF = 17;
const HUBS = { [DF]: [207, 212] };

/** A longsword taken off a shut shop's shelf - the owner's keeping, so the theft's law marks it. */
const stolenSword = () => {
  const shelf = createWeapon(120, 1, () => 0.5);
  assert.equal(takenFromKeeping(new Set([shelf]), shelf, shelf), true);
  return shelf;
};

/** The Goods view's rows as the real service answers them: Eve lists a stolen sword and an honest one from her pack. */
async function goodsRows() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const eve = await s.registered('Eve');
  const R = await seatRealm(s.env, eve.secret, 'Eve', { name: 'Eve', level: 5, goldPieces: 0, items: [stolenSword(), createWeapon(120, 1, () => 0.5)] });
  const record = () => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(s.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  for (const pick of [0, 0]) {
    const item = validLootList([record().items[pick]])[0];
    const l = await s.call('/v1/market/list', { character: R.id, region: DF, kind: 'item', item, pick, price: 50, hubs: HUBS, rid: `rpt1026s-${pick}-${record().items.length}`, currency: 'gold', realm: R.at() }, eve.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
  }
  const tom = await s.registered('Tom');
  const read = await s.call('/v1/market/read', { character: 'char-tom', region: DF, view: 'goods', hubs: HUBS }, tom.secret);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  return read.body.rows;
}

test('RPT1026-LEDGERLAW (#269): a stolen piece listed from a pack says so in the market\'s Goods row, and its picked bar says what buying it means; an honest piece says nothing (mutants: the row\'s tag; the bar\'s line)', async () => {
  const rows = await goodsRows();
  assert.deepEqual(rows.map((r) => isStolen(r.item)).sort(), [false, true], 'the mark rides the listing to its buyer\'s read');
  const book = { state: { balance: 0, road: [] }, goldOk: true, purse: () => 1000, read: async () => ({ ok: true, data: { rows } }), cached: () => null, fresh: () => false, settle: async () => ({ ok: true }), pending: 0, busy: false };
  const m = { book, region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Daggerfall', hubs: HUBS, name: (k) => k, countName: (k) => k, pieces: () => [], goods: () => [], goodName: (r) => r?.name ?? 'a piece', mint: () => {} };
  const tab = createMarketTab(m, { busy: () => false, run: async () => {}, rerender: () => {}, nowS: () => _now, alive: () => true });
  tab.state.view = 'goods';
  tab.state.data = { rows };
  const goodRows = (root) => [...root.querySelectorAll('button')].filter((b) => /market-good/.test(b.className));
  let root = tab.body();
  const [stolen, honest] = [rows.find((r) => isStolen(r.item)), rows.find((r) => !isStolen(r.item))];
  assert.equal(goodRows(root).length, 2);
  assert.deepEqual(goodRows(root).map((b) => b.textContent.endsWith(stolenTag())).sort(), [false, true], 'the stolen piece\'s row alone');
  tab.state.data = { rows: [honest] };
  assert.equal(goodRows(tab.body())[0].textContent.includes(stolenTag()), false, 'an honest piece says nothing');
  tab.state.data = { rows };
  tab.state.picked = stolen.id;
  root = tab.body();
  assert.ok(root.textContent.includes(stolenLine()), 'picked: what a counter and a court do with it');
  tab.state.picked = honest.id;
  assert.equal(tab.body().textContent.includes(stolenLine()), false);
});

test('RPT1026-LEDGERLAW (#269): a home\'s trader - the board\'s and the stall\'s rows tag a stolen piece, and its look says what it means; the Vendor page\'s search names it (mutants: the trader\'s row tag; the look\'s line)', async () => {
  const rows = (await goodsRows()).map((r, i) => ({ ...r, map: 1, buildingKey: 2, owner: 'Eve', vendor: { map: 1, id: i } }));
  const host = createVendorHost({});
  const tab = createVendorTab({ mode: 'board', read: async () => ({ ok: true, data: { rows } }), nameOf: (it) => it?.name ?? 'a piece', townOf: () => 'Daggerfall', stats: host.vendorItemStats },
    { busy: () => false, run: async () => {}, rerender: () => {}, nowS: () => _now, alive: () => true });
  await tab.open();
  const root = tab.body();
  const rowsShown = [...root.querySelectorAll('button')].filter((b) => /market-good/.test(b.className));
  assert.equal(rowsShown.length, 2);
  assert.deepEqual(rowsShown.map((b) => b.textContent.includes(stolenTag())).sort(), [false, true], 'the stolen piece\'s row alone');
  // its look: the host's stats carry the theft's line, and the stats' node draws it
  const stolen = rows.find((r) => isStolen(r.item));
  const stats = host.vendorItemStats(stolen.item);
  assert.equal(stats.stolen, stolenLine());
  assert.equal(host.vendorItemStats(rows.find((r) => !isStolen(r.item)).item).stolen, null);
  assert.ok(vendorStatsNode(stats).textContent.includes(stolenLine()));
  assert.ok(vendorStatsNode({ rows: [], magic: [], stolen: stolenLine() }), 'a look of the theft alone still draws');
  rowsShown.find((b) => b.textContent.includes(stolenTag())).onclick();
  assert.ok(tab.body().textContent.includes(stolenLine()), 'picked: the look says it');
  // the Vendor page's search of the traders: the stolen piece's line names it
  resetVendorPage();
  setVendorPage({ shown: () => true, mine: async () => ({ ok: true, data: { traders: [], stock: [], sold: [], gold: 0 } }), search: async () => ({ ok: true, data: { rows } }), regionHere: () => DF,
    regionNames: [], nameOf: (it) => it?.name ?? 'a piece', townOf: () => 'Daggerfall', waypointKey: () => null, waypoint0: () => null });
  const kit = { el: (t, c = null, x = null) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }, divider: (t) => { const n = document.createElement('h3'); n.textContent = t; return n; } };
  const draw = () => { const d = document.createElement('div'); drawVendorPage(d, () => {}, kit); return d; };
  draw();
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
  const metas = [...draw().querySelectorAll('span')].filter((n) => n.className === 'vendor-meta').map((n) => n.textContent);
  assert.equal(metas.length, 2);
  assert.deepEqual(metas.map((t) => t.endsWith(` · ${stolenTag()}`)).sort(), [false, true], 'the page\'s line, the stolen piece\'s alone');
  setVendorPage(null);
});

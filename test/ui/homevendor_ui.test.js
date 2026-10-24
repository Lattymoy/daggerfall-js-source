// HOME-VENDOR: the board's Vendors tab, a trader's stall and the Vendor page under the Professions, driven over the DOM
// shim (test/chargenDom.mjs) with fake hosts; the waypoint's state (systems/vendorWaypoint.js).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVendorTab } from '../../src/ui/vendor/vendorTab.js';
import { setVendorPage, drawVendorPage, vendorPageShown, resetVendorPage, VENDOR_PAGE_SECTIONS } from '../../src/ui/vendor/vendorPage.js';
import { setVendorWaypoint, clearVendorWaypoint, vendorWaypointKey, isVendorWaypoint, vendorWaypointLabel } from '../../src/systems/vendorWaypoint.js';
import { travelMapMarkedMapId, setTravelMapMarkedMapId } from '../../src/systems/travel/travelMapState.js';
import { readVendorMark, vendorMarkKey, vendorRingTexels, paintVendorMark, VENDOR_RING_R } from '../../src/ui/vendor/vendorMapMark.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const texts = (n) => [...n.querySelectorAll('*')].map((x) => x.textContent).join('|');
const buttons = (n) => [...n.querySelectorAll('button')];
const rows = [
  { id: 'a', item: 'Iron Longsword', price: 50, owner: 'Eve', map: 11, buildingKey: 5, region: 17, expiresAt: 2e9 },
  { id: 'b', item: 'Steel Dagger', price: 70, owner: 'Tom', map: 12, buildingKey: 6, region: 17, expiresAt: 2e9 },
];
const ui = (host) => ({ busy: () => false, run: async (s) => { await s(); }, rerender: () => {}, nowS: () => 1e9, alive: () => true, ...host });

test('HOME-VENDOR the waypoint: set on a house and named on the town map, the map\'s own yellow mark left the player\'s; cleared (mutants: the yellow mark taken; a bad row taken)', () => {
  setTravelMapMarkedMapId(-1);
  assert.equal(setVendorWaypoint({ map: 0, buildingKey: 5 }), false);
  assert.equal(setVendorWaypoint({ map: 11, buildingKey: 5, owner: 'Eve', town: 'Daggerfall' }), true);
  setTravelMapMarkedMapId(77);   // a town the player marked
  assert.equal(setVendorWaypoint({ map: 11, buildingKey: 5, owner: 'Eve', town: 'Daggerfall' }), true);
  assert.deepEqual([vendorWaypointKey(), travelMapMarkedMapId(), isVendorWaypoint(11, 5), isVendorWaypoint(11, 6)], ['11:5', 77, true, false]);
  assert.equal(vendorWaypointLabel('Eve'), 'Trader waypoint - Eve');
  clearVendorWaypoint();
  assert.deepEqual([vendorWaypointKey(), travelMapMarkedMapId()], [null, 77], 'the player\'s mark stands');
  setTravelMapMarkedMapId(-1);
});

test('HOME-VENDOR the world maps\' coin: the host\'s mark read and checked; a gold ring\'s texels on the classic page; the ink coin with its words (mutants: an off-map pixel taken; a throw passed on; no ring)', () => {
  const size = { width: 1000, height: 500 };
  assert.equal(readVendorMark(() => null, size), null);
  assert.equal(readVendorMark(() => { throw new Error('x'); }, size), null);
  assert.equal(readVendorMark(() => ({ px: 1000, py: 3 }), size), null);
  assert.equal(readVendorMark(() => ({ px: 1.5, py: 3 }), size), null);
  const m = readVendorMark(() => ({ px: 40, py: 30, label: "Trader: Eve's house", town: 'Daggerfall' }), size);
  assert.deepEqual([m.x, m.y, m.r, m.label, m.town], [40.5, 30.5, VENDOR_RING_R, "Trader: Eve's house", 'Daggerfall']);
  assert.notEqual(vendorMarkKey(m), vendorMarkKey(readVendorMark(() => ({ px: 41, py: 30 }), size)));
  const ring = vendorRingTexels(m, 30, 20, 40, 40);
  assert.ok(ring.length >= 8, 'a ring');
  assert.ok(ring.every(([x, y]) => Math.hypot(x + 30 + 0.5 - 40.5, y + 20 + 0.5 - 30.5) <= VENDOR_RING_R), 'round its town');
  const said = [];
  const ctx = new Proxy({ strokeText: (t) => said.push(t), fillText() {} }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true });
  paintVendorMark(/** @type {any} */ (ctx), { ox: 0, oy: 0, scale: 4 }, m, (v, x, y) => [x * v.scale, y * v.scale]);
  assert.deepEqual(said, ["Trader: Eve's house"]);
});

test('HOME-VENDOR the board\'s tab: the region\'s traders, searched by item, owner or town; a row picked sets the waypoint; nothing bought here (mutants: the search unread; a Buy on the board)', async () => {
  let set = null;
  const v = { mode: 'board', read: async () => ({ ok: true, data: { rows } }), nameOf: (i) => i, townOf: (m) => (m === 11 ? 'Daggerfall' : 'Wayrest'), waypoint: (r) => { set = r; }, waypointKey: () => null };
  let tab = null;
  tab = createVendorTab(v, ui({}));
  await tab.open();
  let body = tab.body();
  assert.match(texts(body), /Iron Longsword/); assert.match(texts(body), /Steel Dagger/);
  tab.state.query = 'wayrest';
  body = tab.body();
  assert.doesNotMatch(texts(body), /Iron Longsword/);
  tab.state.query = ''; tab.state.picked = 'a';
  body = tab.body();
  assert.ok(!buttons(body).some((b) => b.textContent === 'Buy'), 'nothing bought from the board');
  buttons(body).find((b) => b.textContent === 'Set waypoint').onclick();
  assert.equal(set?.id, 'a');
  // the piece looked at: its stats and its magic on the picked row
  v.stats = (i) => (i === 'Iron Longsword' ? { rows: ['Damage: 2-16', 'Weight: 2.75 kg'], magic: ['of the Wolf: +6 Agility'] } : null);
  body = tab.body();
  assert.match(texts(body), /Damage: 2-16/); assert.match(texts(body), /of the Wolf/);
});

test('HOME-VENDOR the stall: a visitor buys off the purse; the owner takes back and puts up a piece from the pack (mutants: Buy for the owner; the put unwired)', async () => {
  const did = [];
  const stall = (own) => createVendorTab({ mode: 'stall', own, read: async () => ({ ok: true, data: { rows: rows.map((r) => ({ ...r, mine: own })) } }), nameOf: (i) => i, purse: () => 100,
    buy: async (r) => { did.push(['buy', r.id]); return { ok: true }; }, take: async (r) => { did.push(['take', r.id]); return { ok: true }; },
    goods: () => [{ item: 'Leather Cuirass' }, { item: 'Quest Letter', why: 'a quest\'s' }], put: async (it, p) => { did.push(['put', it, p]); return { ok: true }; } }, ui({}));
  const visit = stall(false); await visit.open(); visit.state.picked = 'a';
  buttons(visit.body()).find((b) => b.textContent === 'Buy').onclick();
  const mine = stall(true); await mine.open(); mine.state.picked = 'b';
  let b = mine.body();
  assert.ok(!buttons(b).some((x) => x.textContent === 'Buy'), 'the owner buys nothing of their own');
  buttons(b).find((x) => x.textContent === 'Take back').onclick();
  b = mine.body();
  assert.doesNotMatch(texts(b), /Quest Letter/, 'what may not go is not offered');
  buttons(b).find((x) => x.textContent === 'Put up for sale').onclick();
  await tick();
  assert.deepEqual(did, [['buy', 'a'], ['take', 'b'], ['put', 'Leather Cuirass', 100]]);
});

test('HOME-VENDOR the Vendor page: under the Professions while shown; my traders, their stock, what they sold, the takings; other traders searched with their waypoints (mutants: the page always shown; the sales unread)', async () => {
  assert.deepEqual(VENDOR_PAGE_SECTIONS.map(([id, l]) => [id, l]), [['vendor', 'Vendor']]);
  setVendorPage(null);
  assert.equal(vendorPageShown(), false);
  resetVendorPage();
  const mine = { traders: [{ map: 11, id: 't1', buildingKey: 5 }], stock: [{ ...rows[0], vendor: { map: 11, id: 't1' } }],
    sold: [{ item: 'Steel Dagger', total: 70, gets: 66, at: Date.now() / 1000, vendor: { map: 11, id: 't1' } }], gold: 66 };
  let wp = null;
  setVendorPage({ shown: () => true, mine: async () => ({ ok: true, data: mine }), search: async () => ({ ok: true, data: { rows } }), regionHere: () => 17,
    regionNames: Object.assign(Array(18).fill(''), { 17: 'Daggerfall' }), nameOf: (i) => i, townOf: (m) => (m === 11 ? 'Daggerfall' : 'Wayrest'),
    take: async () => ({ ok: true }), collectGold: async () => ({ ok: true }), waypoint: (r) => { wp = r; }, waypointKey: () => null, waypoint0: () => null, clearWaypoint: () => {} });
  assert.equal(vendorPageShown(), true);
  const kit = { el: (t, c = null, x = null) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }, divider: (t) => { const n = document.createElement('h3'); n.textContent = t; return n; } };
  const draw = () => { const d = document.createElement('div'); drawVendorPage(d, () => {}, kit); return d; };
  draw(); await tick(); await tick();
  const d = draw();
  const t = texts(d);
  for (const w of ['Your traders', 'For sale', 'Sold', 'Find traders', 'Takings waiting', 'Iron Longsword', 'you got', 'Steel Dagger']) assert.ok(t.includes(w), w);
  buttons(d).filter((b) => b.textContent === 'Set waypoint')[1].onclick();
  assert.equal(wp?.id, 'b');
  setVendorPage(null);
});

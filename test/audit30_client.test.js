// AUDIT 30 (2026-09-29, Mac: "Do it") - THE MARKET'S BOOK AND TAB, THE STATIONS' PAGES AND THE PIECES, AS THE AUDIT
// FOUND THEM: a kept act waits out the account gate's words; a settled listing takes its piece out of a save that kept
// it; one act at a time, never another's answer; a read an act overtook tells nothing; the Stores told of every answer;
// the tab's late answers dropped, its numbers typed without a redraw, its refusals read again, its arrivals collected,
// its presses gated, its rows landed-cheapest, its words singular; the station's fee kept with a kept craft and a purse
// that cannot meet it not offered; an act's pickers held and its recipe its own; a hover no stroke; a field's keys its
// own; a marked name only as the law writes one. Each pin failed on the code before its fix.
// bible/06-Systems/Online-Arc.md AUDIT 30.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createMarketBook, MARKET_CACHE_MS, MARKET_CLOSED_RECHECK_MS } from '../src/net/marketBook.js';
import { createProfBook } from '../src/net/profBook.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { courierFee } from '../src/net/marketLaw.js';
import { xpForRank, WEAVERS_STOCK } from '../src/net/professionLaw.js';
import { mintPiece, repairKitUse } from '../src/systems/smithItems.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { setProfessionsPages, drawStoresPage } from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { PROF_CSS } from '../src/ui/enhancedPlusStyle.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const P = (n) => n.toString(16).padStart(16, '0');

// ─── THE BOOK ────────────────────────────────────────────────────────

test('AUDIT 30 C1: a kept listing waits out the account gate\'s "rate", "no-session" and "auth" - the piece stays out of the pack, never put back while it stands listed', async () => {
  for (const word of ['rate', 'no-session', 'auth']) {
    let answer = word;
    const asked = [];
    const door = { account: () => 'acct-1', list: async (b) => { asked.push(b.rid); return answer === 'ok' ? { ok: true, data: { listing: { id: 'L1' } } } : { ok: false, error: answer }; } };
    const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
    const pack = [{ provenance: P(1) }];
    const item = pack[0];
    const r = await book.list({ region: 17, kind: 'piece', provenance: P(1), wear: 1000, price: 5 },
      { item, where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) });
    assert.deepEqual([r.kept, pack.length, book.pending], [true, 0, 1], `${word}: put back while the service may hold it listed`);
    await book.settle(() => {}, (it) => pack.push(it));
    assert.deepEqual([pack.length, book.pending], [0, 1], `${word}: the settle waits too`);
    answer = 'ok';
    await book.settle(() => {}, (it) => pack.push(it));
    assert.deepEqual([pack.length, book.pending, new Set(asked).size], [0, 0, 1], `${word}: answered with its one id`);
  }
});

test('AUDIT 30 C3: a kept listing answered by a settle takes its piece out of the save - a save kept before the take (a crash, a seat handed over) held it still', async () => {
  let online = false;
  const door = { account: () => 'acct-1', list: async () => (online ? { ok: true, data: { listing: { id: 'L1' } } } : { ok: false, error: 'offline' }) };
  const storage = memStorage();
  const a = createMarketBook({ door, storage, character: () => 'c', sleep: noWait });
  const item = { provenance: P(2) };
  await a.list({ region: 17, kind: 'piece', provenance: P(2), wear: 1000, price: 5 }, { item, where: 'pack', take: () => true, putBack: () => {} });
  // the tab reloaded from a save that still carries the piece
  const pack = [{ provenance: P(2) }];
  const b = createMarketBook({ door, storage, character: () => 'c', sleep: noWait });
  online = true;
  const dropped = [];
  await b.settle(() => {}, () => {}, (it, where) => { dropped.push([it.provenance, where]); pack.splice(pack.findIndex((x) => x.provenance === it.provenance), 1); });
  assert.deepEqual([dropped, pack.length], [[[P(2), 'pack']], 0], 'listed and in the pack at once');
  assert.match(src('src/scenes/world.js'), /const marketDrop = \(item\) => \{[\s\S]{0,400}?list\.splice\(i, 1\);/);
  assert.match(src('src/ui/marketTab.js'), /m\.book\.settle\(m\.mint, m\.putBack, m\.drop \?\? null\)/);
});

test('AUDIT 30 C5 + U4: one act at a time - another press while one is under way (the opening settle\'s included) is refused `market-busy`, never handed its answer', async () => {
  let release;
  const door = {
    account: () => 'acct-1',
    list: () => new Promise((r) => { release = () => r({ ok: true, data: { listing: { id: 'L' } } }); }),
    buy: async () => ({ ok: true, data: { sale: { here: true } } }),
  };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  const req = { region: 17, kind: 'material', material: 'ore:iron', units: 1, price: 1 };
  const first = book.list(req);
  assert.equal(book.busy, true, 'the market\'s own busy (U12)');
  const same = book.list(req);
  const other = await book.buy({ region: 17, listing: 'X', units: 1, max: 1 }, () => {});
  assert.deepEqual(other, { ok: false, error: 'market-busy' }, 'a buy answered with the listing\'s ok');
  release();
  assert.equal(await first, await same, 'the same press is that act');
  assert.equal(book.busy, false);
  // the tab's opening settle is an act through the window's door
  assert.match(src('src/ui/marketTab.js'), /const settle = \(\) => ui\.run\(async \(\) => \{\n\s*const r = await m\.book\.settle\(/);
});

test('AUDIT 30 C6: a read an act\'s answer overtook tells nothing - its older balance is never the last the Marks book hears, its view never cached', async () => {
  let t = 1_000_000, n = 0, release = null;
  const told = [];
  const door = {
    account: () => 'acct-1',
    read: () => { n++; const mine = n; return mine === 1 ? new Promise((r) => { release = () => r({ ok: true, data: { rows: ['old'], balance: 100 } }); }) : Promise.resolve({ ok: true, data: { rows: ['new'], balance: 60 } }); },
    order: async () => ({ ok: true, data: { balance: 60 } }),
  };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', now: () => t, sleep: noWait, marks: { set: (b) => told.push(b) } });
  const q = { region: 17, hubs: {} };
  const early = book.read('materials', q);
  await book.order({ material: 'ore:iron', units: 1, price: 40 });
  const late = book.read('materials', q, { force: true });
  release();
  const [a, b] = await Promise.all([early, late]);
  assert.deepEqual([a.data.rows, b.data.rows], [['new'], ['new']], 'the forced read joined the one begun before the act');
  assert.equal(told.at(-1), 60, 'the pre-act 100 told after the act\'s 60');
  assert.deepEqual(book.cached('materials', q), { rows: ['new'], balance: 60 });
  t += MARKET_CACHE_MS - 1;
  assert.deepEqual((await book.read('materials', q)).data.rows, ['new']);
});

test('AUDIT 30 U1 + U6 + U9 + U11: every answer\'s Stores told to the professions\' book; a balance told; a moved view forgotten; a shut market asked again, the gate\'s words never shutting it', async () => {
  let t = 5_000_000, reads = 0, error = null;
  const stores = [];
  const door = {
    account: () => 'acct-1',
    read: async () => { reads++; return error ? { ok: false, error } : { ok: true, data: { rows: [], stores: [{ material: 'metal:iron', own: 10, bought: 0 }] } }; },
    list: async () => ({ ok: true, data: { listing: { id: 'L' }, store: { material: 'ore:iron', own: 2, bought: 1 } } }),
    buy: async () => ({ ok: false, error: 'market-price-moved' }),
  };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'c', now: () => t, sleep: noWait, stores: { apply: (s) => stores.push(s.material) } });
  const q = { region: 17, hubs: {} };
  await book.read('materials', q);
  await book.list({ region: 17, kind: 'material', material: 'ore:iron', units: 1, price: 1 });
  assert.deepEqual(stores, ['metal:iron', 'ore:iron'], 'the List form, the Fill gate, the Work tab and the anvil read yesterday\'s count');
  book.told(123);
  assert.equal(book.state.balance, 123, 'the Weavers\' purchase');
  await book.read('materials', q);
  const r0 = reads;
  await book.buy({ region: 17, listing: 'X', units: 1, max: 1 }, () => {});
  await book.read('materials', q);
  assert.equal(reads, r0 + 1, 'a view the market says has moved is read again, not a minute later');
  for (const w of ['no-session', 'auth']) {
    error = w;
    await book.read('mine', { region: w === 'auth' ? 1 : 2, hubs: {} });
    assert.notEqual(book.state.open, false, `${w}: the tab hidden for the session's life`);
  }
  error = 'market-closed';
  await book.read('orders', q);
  assert.equal(book.state.open, false);
  t += MARKET_CLOSED_RECHECK_MS;
  assert.equal(book.state.open, null, 'asked again after its while');
  // the professions' book takes a count only for its own open state and character
  const prof = createProfBook({ door: { account: () => 'acct-1' }, storage: memStorage(), character: () => 'c', sleep: noWait });
  prof.applyStore({ material: 'ore:iron', own: 5, bought: 0 });
  assert.equal(prof.held('ore:iron'), 0, 'never read: nothing told');
  assert.match(src('src/scenes/world.js'), /stores: \{ apply: \(st\) => profBook\?\.applyStore\(st\) \},/);   // AUDIT 31: its holds beside it
  // AUDIT 32 B3: one door for every counter's balance - the Bank's book and the market's
  assert.match(src('src/scenes/world.js'), /const toldBalance = \(balance\) => \{ if \(Number\.isSafeInteger\(balance\)\) \{ marksBook\?\.set\(balance\); marketBook\?\.told\(balance\); \} \};/);
  assert.equal((src('src/scenes/world.js').match(/toldBalance\(r\?\.data\?\.balance\);/g) ?? []).length, 2, 'the Stores page\'s counters and the Market tab\'s Weavers\'');
});

// ─── THE TAB ─────────────────────────────────────────────────────────

/** A tab over a book the test answers, its redraws counted. */
function tabOver(data, over = {}) {
  const calls = [];
  let redraws = 0, root = null;
  const book = {
    state: { open: true, balance: 1000, road: [], counts: {} }, pending: 0, busy: false, cached: () => null,
    read: async (view, q, o) => { calls.push(['read', view, q, o?.force === true]); return { ok: true, data: typeof data === 'function' ? data(view, q) : data[view] }; },
    buy: async (req) => { calls.push(['buy', req]); return { ok: true, data: { sale: { here: true } } }; },
    list: async (req) => { calls.push(['list', req]); return { ok: true, data: {} }; },
    settle: async () => { calls.push(['settle']); return { ok: true, settled: 0 }; },
    ...over.book,
  };
  const words = [];
  const m = {
    book, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 12, bought: 3 }]]), region: 17, regionName: 'Daggerfall',
    regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], hubs: {}, name: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore' })[k] ?? k,
    countName: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore' })[k] ?? k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {},
    pieceName: () => 'a piece', weavers: WEAVERS_STOCK, stock: async () => ({ ok: true, text: '' }), ...over.m,
  };
  const tab = createMarketTab(m, {
    busy: () => false, run: async (start) => { const r = await start(); words.push(r?.text); }, rerender: () => { redraws++; draw(); }, nowS: () => 0, alive: () => true,
  });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  return { tab, calls, words, book, get root() { return root; }, get redraws() { return redraws; }, draw };
}
const buttons = (root) => [...root.querySelectorAll('button')];
const ROW = (id, extra = {}) => ({ id, kind: 'material', material: 'ore:mithril', units: 40, price: 8, region: 17, road: { courier: 0, seconds: 0, road: 0 }, mine: false, ...extra });

test('AUDIT 30 U2 + U3: a search reads the catalogue\'s own materials from the service; an answer to a filter since left is dropped', async () => {
  let release = null;
  const data = (view, q) => ({ rows: q.materials?.includes('ore:mithril') ? [ROW('M')] : [] });
  const t = tabOver(data, { book: { read: (view, q) => (q.tier === 3 ? new Promise((r) => { release = () => r({ ok: true, data: { rows: [ROW('LATE')] } }); }) : Promise.resolve({ ok: true, data: data(view, q) })) } });
  await t.tab.open();
  const search = t.root.querySelector('.market-search');
  search.value = 'mith';
  search.oninput();
  await new Promise((r) => setTimeout(r, 350));
  assert.match(t.root.textContent, /Mithril Ore x40/, 'the hundred cheapest of everything, filtered on the client');
  // a filter asked, then another before its answer: the late answer is not drawn over the current one
  t.tab.state.query = '';
  const late = t.tab.state;
  late.tier = 3; const slow = t.tab.load(false);
  late.tier = 0; await t.tab.load(false);
  release(); await slow;
  assert.equal(/LATE/.test(JSON.stringify(t.tab.state.data)), false, 'the late answer overwrote the view');
});

test('AUDIT 30 U8: a number typed moves the words that hang on it - never a redraw that swallowed the next press - and the field keeps the focus through a read\'s redraw', async () => {
  const t = tabOver({ materials: { rows: [ROW('B', { region: 23, road: { courier: 9, seconds: 3300, road: 386 } })], medians: {} } });
  await t.tab.open();
  buttons(t.root).find((b) => b.textContent.startsWith('Mithril Ore x40')).onclick();
  const n = [...t.root.querySelectorAll('input')].find((i) => i.getAttribute('data-focus') === 'qty|B');
  assert.ok(n, 'the units field keyed');
  assert.equal(n.getAttribute('aria-label'), 'Units to buy', 'U22: named');
  const before = t.redraws;
  n.value = '5';
  n.oninput();
  assert.equal(t.redraws, before, 'a full redraw on each number');
  assert.match(t.root.textContent, new RegExp(`Buy 5 Mithril Ore for 40 silver \\+ ${courierFee(5, 386)} courier\\?`));
  await buttons(t.root).find((b) => b.textContent === 'Buy').onclick();
  assert.deepEqual(t.calls.find((c) => c[0] === 'buy')[1].units, 5, 'the typed number pressed');
});

test('AUDIT 30 U7 + U9 + U10 + U16 + U17 + U18: the Orders view keeps one\'s own; a moved press reads again; an arrival is collected; the cheapest landed first; one Mark; a row\'s courier its pick\'s', async () => {
  const road = [];
  const data = {
    materials: { rows: [ROW('HERE', { price: 8 }), ROW('FAR', { price: 7, region: 23, road: { courier: 99, seconds: 3300, road: 386 } }),
      ROW('ONE', { price: 1, units: 1 }), ROW('FEW', { price: 6, units: 2, region: 23, road: { courier: 17, seconds: 3300, road: 386 } })], medians: {} },
    orders: { orders: [{ id: 'O', region: 17, material: 'ore:mithril', units: 5, left: 5, price: 1, state: 'open', mine: true, expiresAt: 86_400 }] },
  };
  const t = tabOver(data, { book: { buy: async () => ({ ok: false, error: 'market-gone' }) } });
  t.book.state.road = road;
  await t.tab.open();
  const text = t.root.textContent;
  assert.match(text, /x11 silver each/, 'one silver, the word for any count');
  assert.match(text, new RegExp(`Wayrest \\+${courierFee(20, 386)} courier for 20, `), 'the whole listing\'s courier on the row, the pick\'s in the bar');
  const [one, far, here, few] = ['x11 silver each', 'x407 silver eachWayrest', 'x408 silver eachhere', 'x26 silver eachWayrest'].map((w) => text.indexOf(w));
  // landed: 1; Wayrest's 7 + 17/20 = 7.85; here's 8; Wayrest's 6 + 17/2 = 14.5 - by the listed price the last would be second
  assert.ok(one >= 0 && one < far && far < here && here < few, 'ordered by the service\'s listed price, the courier uncounted');
  // a press the market says has moved reads the view again at once
  buttons(t.root).find((b) => b.textContent.startsWith('Mithril Ore x1')).onclick();
  const r0 = t.calls.filter((c) => c[0] === 'read' && c[3]).length;
  await buttons(t.root).find((b) => b.textContent === 'Buy').onclick();
  await tick();
  assert.equal(t.calls.filter((c) => c[0] === 'read' && c[3]).length, r0 + 1);
  // the Orders view: this account's own order among the region's, Withdraw beside it
  buttons(t.root).find((b) => b.textContent === 'Orders').onclick();
  await tick();
  assert.match(t.root.textContent, /Mithril Ore5 of 5 wanted at 1 silver eachyours1 day left/);
  assert.ok(buttons(t.root).some((b) => b.textContent === 'Withdraw'));
  // a piece arrives while the tab stands: collected on the next read
  const s0 = t.calls.filter((c) => c[0] === 'settle').length;
  road.push({ id: 'D1', kind: 'piece', ready: true, piece: {} });
  await t.tab.load(true);
  await tick();
  assert.equal(t.calls.filter((c) => c[0] === 'settle').length, s0 + 1, 'collected only when the tab was next opened');
  await t.tab.load(true);
  await tick();
  assert.equal(t.calls.filter((c) => c[0] === 'settle').length, s0 + 1, 'each arrival asked once a showing');
});

test('AUDIT 30 U13: what must fail is not offered - a listing past the board\'s thirty or the fee\'s Marks, an order past twenty, a bolt past the balance', async () => {
  const t = tabOver({ mine: { rows: [], orders: [] }, orders: { orders: [] }, materials: { rows: [], medians: {} } });
  t.book.state.balance = 1;
  await t.tab.open();
  const weave = buttons(t.root).filter((b) => b.className.includes('market-weave'));
  assert.ok(weave.length && weave.every((b) => b.disabled), 'a bolt of Wool for more than the balance');
  t.book.state.balance = 1000;
  t.book.state.counts = { listings: 30, orders: 20 };
  buttons(t.root).find((b) => b.textContent === 'My listings').onclick();
  await tick();
  assert.equal(buttons(t.root).find((b) => b.textContent === 'List').disabled, true);
  assert.match(t.root.textContent, /You have 30 listings up - the most allowed here\./);   // BOARD-UI (PIN MOVED): the words cut
  buttons(t.root).find((b) => b.textContent === 'Orders').onclick();
  await tick();
  assert.equal(buttons(t.root).find((b) => b.textContent === 'Post the order').disabled, true);
  t.book.state.counts = { listings: 0, orders: 0 };
  t.book.state.balance = 0;
  buttons(t.root).find((b) => b.textContent === 'My listings').onclick();
  await tick();
  assert.equal(buttons(t.root).find((b) => b.textContent === 'List').disabled, true, 'the fee refused after the press');
});

test('AUDIT 30 U5 + U12 + U14 + U21: the market\'s rows at a phone\'s width, its own busy, its ink on its dark boxes, the shared clock', () => {
  assert.match(PROF_CSS, /\.market-piece \{ grid-template-columns: minmax\(0, 1\.6fr\) minmax\(0, 1\.4fr\) auto minmax\(0, 1\.4fr\); \}/);
  assert.match(PROF_CSS, /\.market-row > \* \{ min-width: 0; \}/);
  assert.match(PROF_CSS, /@media \(max-width: 640px\) \{ \.market-row, \.market-piece \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \} \.market-row > b \{ grid-column: 1 \/ -1; \}/);
  assert.match(PROF_CSS, /\.market-body \.notice-tip, \.market-body \.notice-label \{ color: #cdbd9f; \}/);
  assert.doesNotMatch(PROF_CSS, /\.notice-hint/, 'TOAST-SPLIT: the popup\'s hint is the toasts\' own, never the market\'s to undo');
  const w = src('src/ui/noticeWindow.js');
  assert.match(w, /busy: \(\) => marketBusy \|\| !!marketHost\.book\?\.busy,\n\s*run: async \(start\) => \{\n\s*if \(marketBusy\) return;/);
  assert.match(src('src/scenes/world.js'), /nowS: \(\) => Math\.floor\(\(Date\.now\(\) \+ _sharedOffsetMs\) \/ 1000\),/);
});

// ─── THE STATIONS' PAGES ─────────────────────────────────────────────

/** The Stores page over a book with `held`, at a station, its crafts counted. */
function pagesAt({ held, tracks, forge = null, workbench = null, purse = null }) {
  setPref('gentleActs', false);
  const heldM = new Map(Object.entries(held));
  const tr = new Map(Object.entries(tracks).map(([p, rank]) => [p, { profession: p, xp: xpForRank(rank), rank, specs: { 50: null, 100: null } }]));
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: tr, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => heldM.get(k) ?? 0, store: (k) => ({ material: k, own: heldM.get(k) ?? 0, bought: 0 }),
    track: (p) => tr.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const crafted = [], smelted = [];
  let release = null;
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => forge, workbench: () => workbench,
    smelt: (id, n) => { smelted.push(id); return new Promise((r) => { release = () => r({ ok: true, text: 'done' }); }); },
    craft: async (recipe, o) => { crafted.push([recipe, o.clean, o.heartwood]); return { ok: true, text: 'made' }; },
    stock: async () => ({ ok: true, text: '' }), heatBand: () => 1, planeBand: () => 1, ...(purse == null ? {} : { purse: () => purse }),
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  return { get root() { return root; }, draw, crafted, smelted, release: () => release?.(), buttons: () => [...root.querySelectorAll('button')] };
}

test('AUDIT 30 U13 + U20: a station\'s fee the purse cannot meet is not offered, and says so; a smelt under way names its own row alone', async () => {
  const p = pagesAt({ held: { 'ingot:iron': 20, 'metal:tin': 5, 'ore:iron': 10, 'wood:pine': 4 }, tracks: { smithing: 0, mining: 0 }, forge: { kind: 'shop', fee: 25 }, purse: 10 });
  assert.match(p.root.textContent, /The smith asks 25 gold a smelt; you carry 10\./);
  assert.ok(p.buttons().filter((b) => b.textContent === 'Smelt').every((b) => b.disabled), 'refused after the press');
  p.buttons().find((b) => b.textContent === 'Iron').onclick();
  p.buttons().find((b) => b.textContent.startsWith('Iron Dagger')).onclick();
  assert.equal(p.buttons().find((b) => b.textContent === 'Craft').disabled, true, 'the heat struck, then the smith refused');
  const q = pagesAt({ held: { 'metal:iron': 10, 'log:pine': 4 }, tracks: { smithing: 0, mining: 0, logging: 0 }, forge: { kind: 'home', fee: 0 } });
  const smelts = q.buttons().filter((b) => b.textContent === 'Smelt');
  const burns = q.buttons().filter((b) => b.textContent === 'Burn');
  assert.ok(smelts.length && burns.length);
  await Promise.race([smelts.find((b) => !b.disabled).onclick(), tick()]);
  q.draw();
  assert.equal(q.buttons().filter((b) => b.textContent === 'Burning...').length, 0, 'a smelt called every row of the forge "Burning..."');
  assert.equal(q.buttons().filter((b) => b.textContent === 'Smelting...').length, 1);
  q.release();
  await tick();
  setProfessionsPages(null);
});

test('AUDIT 30 A2 + A3: the plane\'s pickers are held while it is drawn and it makes the recipe it began on; a pointer passing with nothing pressed lets go of the pass; a board drawn anew lost its drag', async () => {
  const p = pagesAt({ held: { 'plank:pine': 20 }, tracks: { carpentry: 0 }, workbench: { kind: 'home', fee: 0 } });
  p.buttons().find((b) => b.textContent === 'Staves').onclick();
  p.buttons().find((b) => b.textContent === 'plank:pine').onclick();
  p.buttons().find((b) => b.textContent.startsWith('Pine Staff')).onclick();
  p.buttons().filter((b) => b.textContent === 'Craft' && !b.disabled).at(-1).onclick();
  const bench = ['Staves', 'Bows', 'Arrows', 'Furniture', 'Tools', 'Siege', 'plank:pine', 'plank:oak'];
  const rows = p.buttons().filter((b) => /prof-recipe/.test(b.className) || bench.includes(b.textContent));
  assert.ok(rows.length > 8 && rows.every((b) => b.disabled), 'another recipe picked mid-pass crafted it, bypassing its readiness');
  let board = p.root.querySelector('.prof-board');
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 40 });
  const clock = [0];
  const realNow = globalThis.performance.now;
  globalThis.performance.now = () => clock[0];
  board.onpointerdown({ clientX: 1, clientY: 20, pointerId: 1 });
  board.onpointermove({ clientX: 30, clientY: 20, pointerId: 1, buttons: 0 });
  assert.match(p.root.textContent, /let go 1 time - start again at the head/, 'a hover planed on');
  board.onpointerdown({ clientX: 1, clientY: 20, pointerId: 1 });
  p.draw();   // the page shut and opened mid-drag: no release ever reached the old board
  board = p.root.querySelector('.prof-board');
  assert.match(p.root.textContent, /let go 2 times/);
  globalThis.performance.now = realNow;
  p.buttons().find((b) => b.textContent === 'Set the plane down').onclick();
  setProfessionsPages(null);
  // a Quick craft takes the Heartwood the page shows, as the plane's pass does
  const q = pagesAt({ held: { 'plank:pine': 20, 'wood:heartwood': 1 }, tracks: { carpentry: 0 }, workbench: { kind: 'home', fee: 0 } });
  q.buttons().find((b) => b.textContent === 'Staves').onclick();
  q.buttons().find((b) => b.textContent === 'plank:pine').onclick();
  q.buttons().find((b) => b.textContent.startsWith('Pine Staff')).onclick();
  const box = [...q.root.querySelectorAll('input')].find((i) => i.type === 'checkbox' && /Heartwood/.test(i.parentNode?.textContent ?? ''));
  box.checked = true; box.onchange();
  await q.buttons().find((b) => b.textContent === 'Quick craft').onclick();
  assert.deepEqual(q.crafted.at(-1), ['staff:pine', false, true]);
  setProfessionsPages(null);
});

test('AUDIT 30 A9: the heat\'s Space and Enter are not taken from a text field or a button on the page', async () => {
  const heard = [];
  const orig = globalThis.document.addEventListener;
  globalThis.document.addEventListener = (type, f, o) => { if (type === 'keydown') heard.push(f); return orig.call(globalThis.document, type, f, o); };
  const p = pagesAt({ held: { 'metal:tin': 5, 'ingot:iron': 20 }, tracks: { smithing: 0 }, forge: { kind: 'home', fee: 0 } });
  p.buttons().find((b) => b.textContent === 'Iron').onclick();
  p.buttons().find((b) => b.textContent.startsWith('Iron Dagger')).onclick();
  p.buttons().find((b) => b.textContent === 'Craft' && !b.disabled).onclick();
  globalThis.document.addEventListener = orig;
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(heard.length, 'the heat listens');
  const search = p.root.querySelector('input');
  const button = p.buttons().find((b) => b.textContent === 'Let it cool');
  try {
    for (const target of [search, button]) {
      const ev = { type: 'keydown', key: ' ', code: 'Space', target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
      for (const f of heard) f(ev);
      assert.equal(ev.defaultPrevented, false, `${target?.tagName}: its key struck the ingot`);
    }
  } finally {
    button.onclick();   // the ingot let cool, its frame loop ended - whatever the pins said
    setProfessionsPages(null);
  }
});

test('AUDIT 30 C4 + A4: a kept craft keeps its station\'s fee and hands it to the mint - the tab that makes the pieces pays, a day later too; the workbench\'s kept word its own', async () => {
  let online = false;
  const door = {
    account: () => 'acct-1',
    craft: async (c, recipe, clean, name, rid) => (online ? { ok: true, data: { rid, recipe, pieces: [{ provenance: P(9) }], stores: [] } } : { ok: false, error: 'offline' }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  const paid = [];
  const mint = (data, kept) => paid.push(kept?.fee ?? null);
  const r = await book.craft('dagger:iron', { clean: false, name: 'Mac', fee: 25 }, mint);
  assert.equal(r.kept, true);
  online = true;
  await book.settle(() => {}, mint);
  assert.deepEqual(paid, [25], 'a kept craft settled later paid the smith nothing');
  const w = src('src/scenes/world.js');
  assert.match(w, /const profMintCraft = \(data, kept = null\) => \{\n\s*if \(kept\?\.fee > 0\) \{ deductGold\(playerEntity, Math\.min\(kept\.fee, totalGoldAmount\(playerEntity\)\)\); saveSoon\.changed\(\); \}/);
  // PROF7 moved it: each station its own kept word, the loom's too (craftStation)
  assert.match(w, /if \(!r\?\.ok\) return \{ ok: false, text: r\?\.kept \? st\.kept : `\$\{accountRefusalText\(r\?\.error\)\}\$\{movedFirstText\(r\)\}` \};/, 'a workbench\'s kept craft said "The anvil rang" (AUDIT 32 B4; AUDIT PROF-541 R2-C2: the busy word the book\'s, naming no station)');   // PIN MOVED (AUDIT2 BAG1 K8): and what went in first
  assert.match(w, /profession === 'carpentry'\n\s*\? \{ here: \(\) => modes\?\.workbenchHere\?\.\(\) \?\? null, a: 'a workbench', who: 'furnisher', noun: 'workbench', kept: BENCH_KEPT_TEXT/);
  assert.equal((w.match(/if \(f\.fee > 0\) \{ deductGold\(playerEntity, f\.fee\); saveSoon\.changed\(\); \}/g) ?? []).length, 1, 'the smelt\'s alone - the craft\'s is the mint\'s (PROF-SAVE: each saved soon)');
});

// ─── THE PIECES' NAMES ───────────────────────────────────────────────

test('AUDIT 30 C7 + C8: a marked name only as the law writes one, on a real provenance; the Repair Kit names a marked piece as its maker does', () => {
  const mw = mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 9, maker: 'Silverthorn' }, P(2));
  assert.equal(itemLongName(mw), 'Silverthorn\'s Mithril Longsword');
  assert.equal(itemLongName({ ...mw, maker: 'Silver\u0007thorn' }).includes('Silver'), false, 'a peer\'s control character in the mark');
  assert.equal(itemLongName({ ...mw, maker: ` ${'x'.repeat(40)}` }).includes('xxxx'), false, 'a mark past its bound');
  assert.equal(itemLongName({ ...mw, provenance: 'not-an-id' }).includes('Silverthorn'), false, 'no provenance the law writes');
  const kit = mintPiece({ recipe: 'kit:mithril', quality: 0, seed: 1, maker: 'Ann' }, P(1));
  mw.currentCondition = Math.round(mw.maxCondition * 0.4);
  const said = repairKitUse(kit, [kit, mw]).text;
  assert.match(said, /^Silverthorn's Mithril Longsword is mended: 40% to \d+%\.$/, `"The Silverthorn's ..." - ${said}`);
});

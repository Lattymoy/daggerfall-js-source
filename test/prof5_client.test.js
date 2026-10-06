// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET'S CLIENT: THE DONE-WHEN through the real Worker (a crafted Mithril
// Longsword listed at a board in one region, bought at a board in another by a second account, the courier's fee burnt,
// the sword on the road, then collected into the buyer's pack - DFU's own piece with its quality and its wear, its owner
// moved - and Mithril Ore bought the same way reaching the buyer's Stores after its courier's time); the book (a piece
// listed taken out of the save and kept until answered, put back on a refusal; a bought piece minted once however many
// tabs settle it; the minute's cache and the stale read; the shut words; the balance told to the Marks book); the tab's
// five views drawn; the window's Market tab and its region; the host's wiring; the plane dressed (FOUND). bible/06-Systems/
// Professions-Arc.md 26.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { accountProf, accountMarket, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { createMarketBook, MARKET_KEPT_TEXT, MARKET_CACHE_MS } from '../src/net/marketBook.js';
import { xpForRank, WEAVERS_STOCK } from '../src/net/professionLaw.js';
import { courierFee, courierSeconds, roadPixels, wearOf, wearCondition, MARKET_VIEWS } from '../src/net/marketLaw.js';
import { mintPiece, mintPieces } from '../src/systems/smithItems.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { createMarketTab, medianLineNode, arrivalText } from '../src/ui/marketTab.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { PROF_CSS } from '../src/ui/enhancedPlusStyle.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
const PROV = '0123456789abcdef';

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF5 DONE WHEN: a crafted Mithril Longsword listed at a board in Daggerfall is bought at a board in Wayrest by a second account - the courier\'s fee burnt, the sword on the road, then collected into the buyer\'s pack, DFU\'s own piece with its quality and its wear, its owner moved - and Mithril Ore bought the same way reaches the buyer\'s Stores after its courier\'s time', async () => {
  clock(T0);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(55));
  for (const [m, n] of [['ingot:mithril', 3], ['metal:copper', 1], ['leather:cured', 1], ['ore:mithril', 40]]) {
    raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
  }
  s.seedMarks(mac, 100);
  s.seedMarks(ann, 5000);
  // Mac makes the sword at the anvil (PROF3), and it wears
  const profBook = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => mac.character, sleep: noWait });
  await profBook.refresh();
  const pack = [];
  const made = await profBook.craft('longsword:mithril', { clean: true, name: 'Silverthorn' }, (d) => pack.push(...mintPieces(d)));
  assert.equal(made.ok, true, JSON.stringify(made));
  const [sword] = pack;
  sword.currentCondition = Math.round(sword.maxCondition * 0.62);
  // Mac lists it, and 40 Mithril Ore, at a board in Daggerfall - the sword taken out of the pack first
  const macMarks = [];
  const macBook = createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => mac.character, sleep: noWait, marks: { set: (n) => macMarks.push(n) } });
  const listed = await macBook.list({ region: DF, kind: 'piece', provenance: sword.provenance, wear: wearOf(sword), price: 900, hubs: HUBS },
    { item: sword, where: 'pack', take: () => { pack.splice(pack.indexOf(sword), 1); return true; }, putBack: (it) => pack.push(it) });
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual([pack.length, listed.data.listing.wear], [0, 620], 'out of the save, its wear on the listing');
  assert.equal((await macBook.list({ region: DF, kind: 'material', material: 'ore:mithril', units: 40, price: 8, hubs: HUBS })).ok, true);
  assert.deepEqual(macMarks.slice(-1), [100 - 9 - 4], 'the Drakes book told the balance');
  // Ann, at a board in Wayrest, reads the sword with its courier and buys it
  const annPack = [];
  const annBook = createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) }), storage: memStorage(), character: () => ann.character, sleep: noWait });
  const crafted = await annBook.read('crafted', { region: WR, hubs: HUBS });
  const row = crafted.data.rows[0];
  assert.deepEqual([row.piece.provenance, row.road.courier, row.region], [sword.provenance, courierFee(1, ROAD), DF]);
  const mint = (piece) => {
    const it = mintPiece(piece, piece.provenance);
    it.currentCondition = wearCondition(it.maxCondition, piece.wear);
    annPack.push(it);
  };
  const bought = await annBook.buy({ region: WR, listing: row.id, units: 1, max: 900 + row.road.courier, hubs: HUBS }, mint);
  assert.equal(bought.ok, true, JSON.stringify(bought));
  assert.deepEqual([bought.data.sale.here, bought.data.sale.courier, annPack.length], [false, courierFee(1, ROAD), 0], 'on the road');
  assert.equal(raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'courier'").get().amount, courierFee(1, ROAD), 'the courier\'s fee burnt');
  assert.equal(raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(sword.provenance).owner, ann.id, 'its owner moved at the sale');
  // the ore, by courier too
  const ores = await annBook.read('materials', { region: WR, hubs: HUBS }, { force: true });
  const ore = ores.data.rows.find((x) => x.material === 'ore:mithril');
  assert.equal((await annBook.buy({ region: WR, listing: ore.id, units: 40, max: 320 + courierFee(40, ROAD), hubs: HUBS }, mint)).ok, true);
  // the courier's time passes: the sword collected into the pack, the ore into the Stores
  clock(T0 + courierSeconds(ROAD));
  await annBook.read('mine', { region: WR, hubs: HUBS }, { force: true });
  assert.deepEqual(annBook.state.road.map((x) => [x.kind, x.kind === 'piece' ? x.ready : x.waiting]), [['piece', true]], 'the ore in the Stores on the read; the sword waiting to be collected');
  assert.equal(raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND material = 'ore:mithril'").get(ann.id).qty, 40);
  const settled = await annBook.settle(mint, () => {});
  assert.equal(settled.settled, 1);
  assert.equal(annPack.length, 1);
  const [got] = annPack;
  const dfu = weaponOfMaterial(120, 5);
  assert.deepEqual([got.templateIndex, got.material, got.minDamage, got.maxDamage, got.quality, got.provenance], [120, 5, dfu.minDamage, dfu.maxDamage, sword.quality, sword.provenance], 'DFU\'s Mithril Longsword, its quality');
  assert.equal(got.currentCondition, wearCondition(got.maxCondition, 620), 'its wear');
  assert.equal(got.maxCondition, sword.maxCondition);
  assert.equal((await annBook.settle(mint, () => {})).settled, 0, 'collected once');
  clock(T0);
});

// ─── THE BOOK ────────────────────────────────────────────────────────

test('PROF5 book: a piece listed is taken out of the save before it is asked - silence keeps it, a refusal puts it back, a settle asks it again with its own id; a bought piece minted once however many tabs settle it', async () => {
  const storage = memStorage();
  let online = false, answer = 'ok';
  const asked = [];
  const door = {
    account: () => 'acct-1',
    list: async (b) => { asked.push(b.rid); return !online ? { ok: false, error: 'offline' } : answer === 'ok' ? { ok: true, data: { listing: { id: 'L1' }, balance: 7 } } : { ok: false, error: answer }; },
    buy: async (b) => (online ? { ok: true, data: { sale: { here: true }, piece: { provenance: PROV, recipe: 'dagger:iron', quality: 1, seed: 7, wear: 1000 }, balance: 3, rid: b.rid } } : { ok: false, error: 'offline' }),
  };
  const marks = [];
  const a = createMarketBook({ door, storage, character: () => 'char-a', sleep: noWait, marks: { set: (n) => marks.push(n) } });
  const pack = [{ provenance: PROV, name: 'dagger' }];
  const item = pack[0];
  const piece = { item, where: 'pack', take: () => { pack.splice(pack.indexOf(item), 1); return true; }, putBack: (it) => pack.push(it) };
  const r = await a.list({ region: 17, kind: 'piece', provenance: PROV, wear: 1000, price: 5 }, piece);
  assert.deepEqual([r.ok, r.kept, r.text, pack.length, a.pending], [false, true, MARKET_KEPT_TEXT, 0, 1], 'out of the pack, kept');
  // a refusal on the settle puts it back (AUDIT 31 H1: one that says nothing of where the piece is - a piece the service
  // says is elsewhere is dropped, test/audit31_client.test.js)
  online = true; answer = 'market-listings-max';
  await a.settle(() => {}, (it) => pack.push(it));
  assert.deepEqual([pack.length, a.pending], [1, 0], 'refused: back in the pack');
  assert.equal(new Set(asked).size, 1, 'one id, asked again');
  // answered: gone for good, the balance told
  const r2 = await a.list({ region: 17, kind: 'piece', provenance: PROV, wear: 1000, price: 5 }, piece);
  assert.deepEqual([r2.ok, pack.length, marks.at(-1), a.state.balance], [false, 1, undefined, null], 'refused at once: put back');
  answer = 'ok';
  const r3 = await a.list({ region: 17, kind: 'piece', provenance: PROV, wear: 1000, price: 5 }, piece);
  assert.deepEqual([r3.ok, pack.length, marks.at(-1)], [true, 0, 7]);
  // a buy kept, then two tabs settle it: minted once
  online = false;
  const minted = [];
  const kept = await a.buy({ region: 17, listing: 'L1', units: 1, max: 5 }, (p) => minted.push(['a', p]));
  assert.deepEqual([kept.kept, minted.length], [true, 0]);
  const b = createMarketBook({ door, storage, character: () => 'char-a', sleep: noWait });
  online = true;
  await Promise.all([a.settle((p) => minted.push(['a', p]), () => {}), b.settle((p) => minted.push(['b', p]), () => {})]);
  assert.equal(minted.length, 1, 'once');
});

test('PROF5 book: a view read through a minute\'s cache (a refusal too); a failed read shows the last good one, stale; the shut words close the market; one act at a time', async () => {
  let t = 1_000_000, online = true, reads = 0;
  const door = {
    account: () => 'acct-1',
    read: async (b) => { reads++; return online ? { ok: true, data: { view: b.view, rows: [], road: [{ kind: 'material' }], counts: { listings: 2, orders: 1 }, balance: 40 } } : { ok: false, error: 'offline' }; },
    order: async () => { await new Promise((r) => setTimeout(r, 5)); return { ok: true, data: { balance: 1 } }; },
  };
  const book = createMarketBook({ door, character: () => 'c', now: () => t, sleep: noWait });
  const q = { region: 17, hubs: {} };
  assert.equal((await book.read('materials', q)).ok, true);
  await book.read('materials', q);
  assert.equal(reads, 1, 'cached');
  assert.deepEqual([book.state.balance, book.state.counts, book.state.road.length], [40, { listings: 2, orders: 1, bids: 0 }, 1]);
  t += MARKET_CACHE_MS;
  online = false;
  const stale = await book.read('materials', q);
  assert.deepEqual([stale.ok, stale.stale, !!stale.data], [false, true, true], 'the last good view, stale');
  const shut = createMarketBook({ door: { ...door, read: async () => ({ ok: false, error: 'market-closed' }) }, character: () => 'c', sleep: noWait });
  await shut.read('materials', q);
  assert.equal(shut.state.open, false);
  const [x, y, z] = await Promise.all([book.order({ material: 'ore:iron', units: 1, price: 1 }), book.order({ material: 'ore:iron', units: 1, price: 1 }),
    book.order({ material: 'ore:iron', units: 2, price: 1 })]);
  assert.equal(x, y, 'a second press of the act under way is that act');
  assert.deepEqual(z, { ok: false, error: 'market-busy' }, 'AUDIT 30 C5: another act while one is under way is refused, never handed its answer');
});

// ─── THE TAB ─────────────────────────────────────────────────────────

test('PROF5 tab: the five views - Materials (cheapest first, here or its region with its courier and time, its median and line, the picked row\'s "Buy N for P + C courier?", the Weavers\' counter), Crafted, My listings (List with its fee, Cancel), Orders (Fill from the Stores, Post an order), History; On the road; Your Marks', async () => {
  const med = { median: 8.5, line: [null, null, 8, 9, null, 8, 9] };
  const data = {
    materials: { rows: [
      { id: 'A', kind: 'material', material: 'ore:mithril', units: 120, price: 8, region: 17, road: { courier: 0, seconds: 0, road: 0 }, mine: false },
      { id: 'B', kind: 'material', material: 'ore:mithril', units: 40, price: 7, region: 23, road: { courier: courierFee(40, ROAD), seconds: courierSeconds(ROAD), road: ROAD }, mine: false },
    ], medians: { 'ore:mithril': med } },
    crafted: { rows: [{ id: 'C', kind: 'piece', units: 1, price: 900, region: 17, road: { courier: 0, seconds: 0, road: 0 }, mine: false, wear: 620,
      piece: { provenance: PROV, recipe: 'longsword:mithril', quality: 4, seed: 1, maker: 'Silverthorn', marked: true, wear: 620 } }] },
    mine: { rows: [{ id: 'D', kind: 'material', material: 'ore:iron', units: 5, listed: 10, price: 3, region: 17, state: 'open', expiresAt: 10_000 }], orders: [] },
    orders: { orders: [{ id: 'O', region: 17, material: 'ore:mithril', units: 200, left: 140, price: 8, state: 'open', mine: false, expiresAt: 99_999 }], medians: { 'ore:mithril': med } },
    history: { history: [{ material: 'ore:mithril', units: 21, median: 10, line: [null, null, null, null, null, 8, 10] }], trades: [{ side: 'bought', kind: 'material', material: 'ore:mithril', units: 11, price: 10, total: 110, at: 0 }] },
  };
  const calls = [];
  const book = {
    state: { open: true, balance: 1240, road: [{ kind: 'material', material: 'ore:mithril', units: 40, from: 23, arrivesAt: 1920, waiting: false }], counts: {} },
    pending: 0, cached: () => null,
    read: async (view) => ({ ok: true, data: data[view] }),
    buy: async (req) => { calls.push(['buy', req]); return { ok: true, data: { sale: { here: true } } }; },
    list: async (req) => { calls.push(['list', req]); return { ok: true, data: {} }; },
    fill: async (req) => { calls.push(['fill', req]); return { ok: true, data: { fill: { pay: 456 } } }; },
    order: async (req) => { calls.push(['order', req]); return { ok: true, data: {} }; },
    cancel: async (id) => { calls.push(['cancel', id]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const words = [];
  let root = null;
  const m = {
    book, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 12, bought: 3 }], ['ore:mithril', { material: 'ore:mithril', own: 50, bought: 0 }]]),
    region: 17, regionName: 'Daggerfall', regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], hubs: HUBS,
    name: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore', 'cloth:linen': 'Linen Bolt', 'cloth:wool': 'Wool Bolt' })[k] ?? k, countName: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore' })[k] ?? k,
    pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'Silverthorn\'s Mithril Longsword',
    weavers: WEAVERS_STOCK, stock: async (k, n) => { calls.push(['stock', k, n]); return { ok: true, text: 'bought' }; },
  };
  const tab = createMarketTab(m, {
    busy: () => false, run: async (start) => { const r = await start(); words.push(r?.text); }, rerender: () => draw(), nowS: () => 0, alive: () => true,
  });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  await tab.open();
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  assert.deepEqual(buttons().filter((b) => b.className.includes('market-view')).map((b) => b.textContent), MARKET_VIEWS.map(([, l]) => l));
  assert.match(text(), /On the road40 Mithril Ore from Wayrest - 32 minutes/);
  assert.match(text(), /Mithril Ore x1208 silver eachheremedian 8\.5/);
  // AUDIT 30 U18: a row's courier is its pick's (twenty at most); U16: cheapest landed first - Wayrest's 7 and its courier's share under here's 8
  assert.match(text(), new RegExp(`Mithril Ore x407 silver eachWayrest \\+${courierFee(20, ROAD)} courier for 20, ${arrivalText(courierSeconds(ROAD), 0)}median 8\\.5Mithril Ore x120`));
  assert.ok(root.querySelector('.market-line'), 'the median\'s line');
  assert.match(text(), /The Weavers' counterLinen Bolt2 silver a bolt/);
  assert.match(text(), /Your silver: 1,240 silver/);
  // picked: "Buy 20 for 140 Marks + C courier?"
  buttons().find((b) => b.textContent.startsWith('Mithril Ore x40')).onclick();
  assert.match(text(), new RegExp(`Buy 20 Mithril Ore for 140 silver \\+ ${courierFee(20, ROAD)} courier\\?`));
  await buttons().find((b) => b.textContent === 'Buy').onclick();
  assert.deepEqual(calls.at(-1), ['buy', { region: 17, listing: 'B', units: 20, max: 140 + courierFee(20, ROAD), hubs: HUBS }]);
  // Crafted
  await buttons().find((b) => b.textContent === 'Crafted').onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(text(), /Silverthorn's Mithril LongswordMasterwork · made by Silverthorn · worn to 62%900 silver/);
  // My listings: the fee said, Cancel
  buttons().find((b) => b.textContent === 'My listings').onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(text(), /Iron Ore - 5 of 10 left3 silver each/);
  assert.match(text(), /Listing fee 1 silver, kept if you cancel\. It stands on every board in the Bay for 72 hours \(a buyer outside Daggerfall pays a courier\)/);   // GLOBAL-MARKET (PIN MOVED: "the boards of Daggerfall")
  await buttons().find((b) => b.textContent === 'Cancel').onclick();
  assert.deepEqual(calls.at(-1)[0], 'cancel');
  // Orders: Fill from the Stores
  buttons().find((b) => b.textContent === 'Orders').onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(text(), /Mithril Ore140 of 200 wanted at 8 silver eachmedian 8\.5/);
  await buttons().find((b) => b.textContent.startsWith('Fill 50')).onclick();
  assert.deepEqual(calls.at(-1), ['fill', { region: 17, order: 'O', units: 50, hubs: HUBS, least: 400 - 20 }]);   // GLOBAL-MARKET (PIN MOVED): the pay agreed - the tax on the order's running total, no courier here
  assert.match(text(), /Post a buy order/);
  // History
  buttons().find((b) => b.textContent === 'History').onclick();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(text(), /Mithril Ore21 sold this weekmedian 10/);
  assert.match(text(), /Your tradesBought 11 Mithril Ore - 110 silver paid - just now/, 'AUDIT 30 U15: the silver the trade moved, and which way');
  assert.equal(medianLineNode([null, 5]), null, 'no line from one day');
});

test('PROF5 window: the Market tab stands beside Notices while the market is this account\'s, and not while its book is shut; its region is its own', () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const market = (open) => ({ book: { state: { open, balance: 5, road: [] }, pending: 0, cached: () => null, read: async () => ({ ok: true, data: { rows: [] } }), settle: async () => ({}) },
    stores: () => new Map(), region: 23, regionName: 'Wayrest', regionNameOf: () => 'x', hubs: {}, name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true,
    putBack: () => {}, mint: () => {}, pieceName: () => '', weavers: [], stock: async () => ({ ok: true }) });
  const tabsOf = (host) => [...host.querySelectorAll('.notice-tab')].map((t) => t.textContent);
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Wayrest', mapId: 1 }, book: noticeBook, market: market(true) });
  assert.deepEqual(tabsOf(host).slice(0, 2), ['Notices', 'Market'], 'no Work without the professions; the Market with its own region');
  v.unmount();
  const shut = document.createElement('div');
  const w = mountNoticeBoard(shut, { town: { name: 'Wayrest', mapId: 1 }, book: noticeBook, market: market(false) });
  assert.deepEqual(tabsOf(shut), ['Notices']);
  w.unmount();
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF5 wiring: the host builds the market book online, its answers told to the Marks book; the board hands the Market its own region, the hubs, the pieces and the mint; a piece minted once at its wear; the smith\'s stock tells the Marks book (FOUND); a kept craft settles alone (FOUND); the plane dressed (FOUND)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const marketBook = params\.has\('online'\)\n\s*\? createMarketBook\(\{ door: accountMarket\(/);
  assert.match(w, /now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, marks: marksBook,\n\s*stores: \{ apply: \(st\) => profBook\?\.applyStore\(st\) \},/);   // AUDIT 30 U1: the Stores told too (AUDIT 31: its holds after)
  assert.match(w, /const market = marketBook && profBook && profBook\.state\.open !== false && marksBook\?\.state\?\.open !== false && Number\.isInteger\(region\) \? \{/);   // AUDIT 30 U11; MARKET-AUDIT (PIN MOVED: `=== true` - the tab stands while the professions' read is unanswered)
  // GUILD1e: the board's window built by the host's one builder (showNoticeWindow), which adds the book and the character
  assert.match(w, /gate: \(\) => noticeGateCard\(\), sd: \(\) => noticeSdCard\(\), answer: \(note\) => answerNote\(note\), work, market,\n/);   // PIN MOVED (SD2c): a found Super dungeon's note beside the gate's
  assert.match(w, /book: noticeBook, character: \(\) => characterIdOf\(playerEntity\),/);
  assert.match(w, /if \(heldProvenances\(\)\.has\(piece\.provenance\)\) return;\n\s*const it = mintPiece\(piece, piece\.provenance\);\n\s*if \(!it\) return;\n\s*if \(it\.maxCondition > 0\) it\.currentCondition = wearCondition\(it\.maxCondition, piece\.wear\);/);
  assert.match(w, /\.filter\(\(it\) => it\?\.provenance && asMinted\(it\) && !tradeRefusal\(it\) && !isLocked\(it\) && !pieceKept\(it\.provenance\)\)/);   // AUDIT 30 C2
  assert.match(w, /const r = await profBook\.stock\(material, qty\);\n\s*toldBalance\(r\?\.data\?\.balance\);/);   // AUDIT 32 B3: the Bank's book and the market's
  assert.match(src('src/ui/profPages.js'), /if \(\(book\.pendingWithdrawals \|\| book\.pendingCrafts \|\| book\.pendingDeposits\) && p\.settle/);   // BAG1 (PIN MOVED): a kept deposit settles too
  assert.match(src('src/scenes/gatherHost.js'), /if \(book\.pendingWithdrawals \|\| book\.pendingCrafts \|\| book\.pendingDeposits\) deps\.onSettle\?\.\(\);/);   // PIN MOVED (AUDIT2 BAG1 K3): and a kept deposit
  for (const rule of [/\.prof-grain \{ fill: none; stroke:/, /\.prof-trail \{ fill: none; stroke:/, /\.prof-board \{ position: relative; height: 96px; touch-action: none;/, /\.prof-boardhead \{ fill:/]) {
    assert.match(PROF_CSS, rule, 'the plane dressed');
  }
  for (const cls of ['.market-row', '.market-line polyline', '.market-bar', '.market-road', '.market-counter', '.market-foot']) assert.ok(PROF_CSS.includes(cls), cls);
  // the one construction seam: the tab is made by the window alone
  assert.equal((w.match(/createMarketTab\(/g) ?? []).length, 0);
  assert.equal((src('src/ui/noticeWindow.js').match(/createMarketTab\(/g) ?? []).length, 1);
});

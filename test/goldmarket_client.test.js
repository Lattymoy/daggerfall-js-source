// GOLD-MARKET (2026-09-30, Mac: "Allow trading with gold or drakes on the marketplace"; "Gold listings, walled") - THE
// CLIENT: the market book's gold buy through the realm act (systems/realmSaves.js realmGoldAct over a session) - the
// exact cost out of the purse as the service is asked, back on the service's refusal, kept on silence and asked again by
// a settle (paid on the answer, a repeat paying nothing); the gold held collected into the board's bank account; a
// view's currency its own cache; the Stores' third count (profBook, the Stores page); the Market tab's currency switch,
// gold rows, gold Buy, the List form's "Priced in gold" and the Collect under My listings - a realm character's alone;
// the host's wiring. bible/06-Systems/Professions-Arc.md 10.8.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createMarketBook, MARKET_KEPT_TEXT } from '../src/net/marketBook.js';
import { realmGoldAct } from '../src/systems/realmSaves.js';
import { createProfBook } from '../src/net/profBook.js';
import { storesRows, storesSplit, GOLD_GOODS_LINE } from '../src/ui/profPages.js';
import { createMarketTab, priceText, listableUnits, SPOILED_DISH_WHY } from '../src/ui/marketTab.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { courierFee, roadPixels, goldText, goldSaleOf } from '../src/net/marketLaw.js';
import { MARK_WORTH_GOLD } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
const PROV = '0123456789abcdef';

/** A realm character's save as the wallet reads it: a purse, and a bank account a region. */
function realmSide(purse = 1000) {
  const save = { purse, banks: { [DF]: 0 } };
  let seq = 1, checks = 0;
  const session = { transact: async (fn) => { const r = await fn({ id: 'realm-1', lease: 'lease-1', seq }); if (r?.ok && r.seq > seq) seq = r.seq; return r; } };
  const realm = { act: (o) => realmGoldAct({ session, checkpoint: () => { checks++; }, wait: noWait, ...o }) };
  const wallet = (region) => ({
    gold: () => save.purse + (save.banks[region] ?? 0),
    pay: (n) => { const p = Math.min(save.purse, n); save.purse -= p; if (n > p) save.banks[region] -= n - p; },
    credit: (n) => { save.purse += n; },
    bank: (n) => { if (region in save.banks) save.banks[region] += n; else save.purse += n; },
  });
  return { save, realm, wallet, seq: () => seq, checks: () => checks };
}
const sold = (extra = {}) => ({ ok: true, status: 200, data: { sale: { here: true, total: 400, courier: 0 }, realm: { seq: 2 }, balance: 50, ...extra } });

// ─── THE BOOK ────────────────────────────────────────────────────────

test('GOLD-MARKET book: a gold buy asks through the realm act - where the record stands in the body, the exact cost out of the purse as it asks; the piece minted once; a character not the realm\'s, or a purse short, asks nothing', async () => {
  const side = realmSide(1000);
  const asked = [];
  const door = { account: () => 'acct-1', buy: async (b) => { asked.push(b); return sold({ piece: { provenance: PROV, recipe: 'dagger:iron', quality: 1, seed: 7, wear: 1000 } }); } };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'realm-1', sleep: noWait, realm: side.realm, wallet: side.wallet });
  assert.equal(book.goldOk, true);
  assert.equal(book.purse(DF), 1000);
  const minted = [];
  const r = await book.buy({ region: DF, listing: 'G1', units: 5, max: 400, hubs: HUBS, currency: 'gold' }, (p) => minted.push(p));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].realm, { id: 'realm-1', lease: 'lease-1', seq: 1 }, 'where the record stands');
  assert.equal('currency' in asked[0], false, 'the listing says its currency: the service asks the record, not a word');
  assert.deepEqual([asked[0].max, side.save.purse, side.seq(), book.pending], [400, 600, 2, 0], 'the exact cost paid; the record\'s next sequence adopted; let go');
  assert.equal(minted.length, 1);
  assert.ok(side.checks() >= 2, 'the purse checkpointed before, and the outcome after');
  // not the realm's: no gold trade, nothing asked
  const plain = createMarketBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait });
  assert.equal(plain.goldOk, false);
  assert.equal(plain.purse(DF), null);
  assert.deepEqual(await plain.buy({ region: DF, listing: 'G1', units: 5, max: 400, hubs: HUBS, currency: 'gold' }, () => {}), { ok: false, error: 'market-gold-realm' });
  // a purse short: nothing asked
  assert.deepEqual(await book.buy({ region: DF, listing: 'G1', units: 5, max: 601, hubs: HUBS, currency: 'gold' }, () => {}), { ok: false, error: 'realm-gold' });
  assert.equal(asked.length, 1);
  // a Drakes buy is the Drakes' own, as before (no realm, no reserve)
  await book.buy({ region: DF, listing: 'D1', units: 1, max: 8, hubs: HUBS }, () => {});
  assert.deepEqual([asked.at(-1).realm, side.save.purse], [undefined, 600]);
});

test('GOLD-MARKET book: the service\'s no gives the gold back and lets the buy go; silence keeps it (the purse as it paid) and a settle asks it again - paid on the answer for a sale made then, nothing for a repeat; the piece minted once', async () => {
  // a refusal
  const side = realmSide(1000);
  let answer = { ok: false, error: 'market-gone', status: 404 };
  const door = { account: () => 'acct-1', buy: async () => answer };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'realm-1', sleep: noWait, realm: side.realm, wallet: side.wallet });
  const no = await book.buy({ region: DF, listing: 'G1', units: 5, max: 400, hubs: HUBS, currency: 'gold' }, () => {});
  assert.deepEqual([no.ok, no.error, side.save.purse, book.pending], [false, 'market-gone', 1000, 0], 'given back, let go');
  // a lost session (no status: the realm's own word) keeps it - nothing said of the sale
  const lostSide = realmSide(1000);
  const lost = createMarketBook({ door: { account: () => 'acct-1', buy: async () => ({ ok: false, error: 'busy' }) }, storage: memStorage(), character: () => 'realm-1', sleep: noWait,
    realm: { act: async (o) => { o.reserve?.()?.(); return { ok: false, error: 'lease' }; } }, wallet: lostSide.wallet });
  const k0 = await lost.buy({ region: DF, listing: 'G1', units: 5, max: 400, hubs: HUBS, currency: 'gold' }, () => {});
  assert.deepEqual([k0.kept, lost.pending, lostSide.save.purse], [true, 1, 1000], 'kept; the reserve given back by the act');
  // silence: kept, the purse as it paid (the session ends - a join reads the record)
  for (const landed of [false, true]) {
    const s2 = realmSide(1000);
    const storage = memStorage();
    let online = false;
    const d2 = { account: () => 'acct-1', buy: async () => (online ? (landed ? sold({ repeat: true, piece: { provenance: PROV, recipe: 'dagger:iron', quality: 1, seed: 7, wear: 1000 } }) : sold({ piece: { provenance: PROV, recipe: 'dagger:iron', quality: 1, seed: 7, wear: 1000 } })) : { ok: false, error: 'offline' }) };
    const b2 = createMarketBook({ door: d2, storage, character: () => 'realm-1', sleep: noWait, realm: s2.realm, wallet: s2.wallet });
    const minted = [];
    const k = await b2.buy({ region: DF, listing: 'G1', units: 5, max: 400, hubs: HUBS, currency: 'gold' }, (p) => minted.push(p));
    assert.deepEqual([k.ok, k.kept, k.text, b2.pending], [false, true, MARKET_KEPT_TEXT, 1], 'kept on silence');
    assert.equal(s2.save.purse, 600, 'the purse as it paid - an unknown outcome gives nothing back');
    // the join reads the record: the purse it holds is the record's - paid if the sale landed, whole if it did not
    s2.save.purse = landed ? 600 : 1000;
    online = true;
    const st = await b2.settle((p) => minted.push(p), () => {});
    assert.deepEqual([st.settled, b2.pending, minted.length], [1, 0, 1], `${landed ? 'a repeat' : 'a sale made now'}: settled, minted once`);
    assert.equal(s2.save.purse, 600, landed ? 'a repeat pays nothing again' : 'a sale made on the settle paid on its answer');
  }
});

test('GOLD-MARKET book: the gold held read and collected into the board\'s account - what the service says it moved; a character not the realm\'s collects none; a view\'s currency its own cache', async () => {
  const side = realmSide(10);
  let reads = 0;
  const door = {
    account: () => 'acct-1',
    read: async (b) => { reads++; return { ok: true, data: { view: b.view, currency: b.currency ?? 'marks', rows: [], goldHeld: 380, balance: 5 } }; },
    gold: async (b) => ({ ok: true, status: 200, data: { ok: true, gold: 380, region: b.region, realm: { seq: 2 } } }),
  };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'realm-1', sleep: noWait, realm: side.realm, wallet: side.wallet });
  await book.read('mine', { region: DF, hubs: HUBS });
  assert.equal(book.state.goldHeld, 380);
  const r = await book.collectGold(DF);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([side.save.banks[DF], side.save.purse, book.state.goldHeld, side.seq()], [380, 10, 0, 2], 'into the account at the board');
  const elsewhere = await book.collectGold(99);
  assert.equal(elsewhere.ok, true);
  assert.equal(side.save.purse, 390, 'no account there: the purse (creditSave\'s own)');
  const plain = createMarketBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait });
  assert.deepEqual(await plain.collectGold(DF), { ok: false, error: 'market-gold-realm' });
  // one currency a view: the gold view and the Drakes view read apart
  reads = 0;
  await book.read('materials', { region: DF, hubs: HUBS });
  await book.read('materials', { region: DF, hubs: HUBS, currency: 'gold' });
  await book.read('materials', { region: DF, hubs: HUBS, currency: 'gold' });
  assert.equal(reads, 2);
});

// ─── THE STORES ──────────────────────────────────────────────────────

test('GOLD-MARKET Stores: the professions\' book keeps what gold bought as its own count (said only where held); a station spends none of it; the Stores page counts it, splits it and says where it may go', () => {
  const pb = createProfBook({ door: { account: () => 'a' }, storage: memStorage(), character: () => 'realm-1' });
  pb.state.open = true; pb.state.character = 'realm-1';
  pb.applyStore({ material: 'metal:iron', own: 4, bought: 0, gold: 7 });
  pb.applyStore({ material: 'ore:iron', own: 2, bought: 1 });
  pb.applyStore({ material: 'wood:resin', own: 0, bought: 0, gold: 3 });
  assert.deepEqual(pb.store('metal:iron'), { material: 'metal:iron', own: 4, bought: 0, gold: 7 });
  assert.deepEqual(pb.store('ore:iron'), { material: 'ore:iron', own: 2, bought: 1 }, 'none held: the shape as before');
  assert.equal(pb.held('metal:iron'), 4, 'a station, a craft or a writ spends own and bought alone');
  assert.equal(pb.state.stores.has('wood:resin'), true, 'gold\'s alone is held');
  pb.applyStore({ material: 'wood:resin', own: 0, bought: 0 });
  assert.equal(pb.state.stores.has('wood:resin'), false);
  const rows = storesRows(pb.state.stores, {}, (k) => k);
  assert.deepEqual(rows.map((r) => [r.material, r.total]).sort(), [['metal:iron', 11], ['ore:iron', 3]]);
  assert.equal(storesSplit({ own: 4, bought: 0, gold: 7 }), '4 own · 7 bought with gold');
  assert.equal(storesSplit({ own: 0, bought: 2, gold: 1 }), '2 bought · 1 bought with gold');
  assert.equal(storesSplit({ own: 2, bought: 1 }), '2 own · 1 bought', 'as before');
  assert.equal(storesSplit({ own: 2, bought: 0 }), 'own');
  assert.match(GOLD_GOODS_LINE, /pack, or back on the market for gold/);
  assert.match(src('src/ui/profPages.js'), /if \(\(pick\.gold \| 0\) > 0\) detail\.append\(el\('p', 'px-note', GOLD_GOODS_LINE\)\);/);
  // the listable units a currency's listing may take
  assert.equal(listableUnits({ own: 4, bought: 5, gold: 7 }, 'gold'), 11);
  assert.equal(listableUnits({ own: 4, bought: 5, gold: 7 }, 'marks'), 9);
  assert.equal(listableUnits(undefined, 'gold'), 0);
});

// ─── THE TAB ─────────────────────────────────────────────────────────

function standTab({ goldOk = true, purse = 5000, goldHeld = 0 } = {}) {
  const gold = {
    materials: { currency: 'gold', rows: [
      { id: 'G', kind: 'material', material: 'ore:mithril', units: 40, price: 80, region: WR, currency: 'gold', road: { courier: courierFee(20, ROAD), seconds: 60, road: ROAD }, mine: false },
    ], medians: {} },
    history: { currency: 'gold', history: [], trades: [{ side: 'sold', kind: 'material', material: 'ore:mithril', units: 5, price: 80, total: 376, at: 0, currency: 'gold' }] },
  };
  const marks = {
    materials: { rows: [{ id: 'A', kind: 'material', material: 'ore:mithril', units: 10, price: 8, region: DF, currency: 'marks', road: { courier: 0, seconds: 0, road: 0 }, mine: false }], medians: {} },
    mine: { rows: [{ id: 'L', kind: 'material', material: 'ore:iron', units: 5, listed: 10, price: 90, region: DF, state: 'open', expiresAt: 10_000, currency: 'gold' }], orders: [] },
    history: { history: [], trades: [] },
  };
  const calls = [], reads = [];
  const book = {
    state: { open: true, balance: 100, road: [], counts: {}, goldHeld }, pending: 0, cached: () => null, goldOk, purse: () => (goldOk ? purse : null),
    read: async (view, q) => { reads.push([view, q.currency ?? null]); return { ok: true, data: (q.currency === 'gold' ? gold : marks)[view] ?? { rows: [] } }; },
    buy: async (req) => { calls.push(['buy', req]); return { ok: true, data: { sale: { here: false, arrivesAt: 60 } } }; },
    list: async (req) => { calls.push(['list', req]); return { ok: true, data: {} }; },
    collectGold: async (region) => { calls.push(['gold', region]); return { ok: true, data: { gold: goldHeld, region } }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const words = [];
  let root = null;
  const m = {
    book, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 2, bought: 30, gold: 6 }], ['ore:mithril', { material: 'ore:mithril', own: 0, bought: 9 }]]),
    region: DF, regionName: 'Daggerfall', regionNameOf: (r) => ({ [DF]: 'Daggerfall', [WR]: 'Wayrest' })[r], hubs: HUBS,
    name: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore' })[k] ?? k, countName: (k) => ({ 'ore:mithril': 'Mithril Ore', 'ore:iron': 'Iron Ore' })[k] ?? k,
    pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece', weavers: [], stock: async () => ({ ok: true }),
  };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => { const r = await start(); words.push(r?.text); }, rerender: () => draw(), nowS: () => 0, alive: () => true });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  const selectOf = (label) => [...root.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === label) ?? null;
  const settleDraw = () => new Promise((r) => setTimeout(r, 0));
  return { tab, calls, reads, words, text, buttons, selectOf, settleDraw, draw };
}

test('GOLD-MARKET tab: a character not the realm\'s sees the Drakes\' market alone - no currency switch, no Priced in, no gold word', async () => {
  const t = standTab({ goldOk: false });
  await t.tab.open();
  assert.equal(t.selectOf('Currency'), null);
  assert.doesNotMatch(t.text(), /gold/i);
  t.buttons().find((b) => b.textContent === 'My listings').onclick();
  await t.settleDraw();
  assert.equal(t.selectOf('Currency'), null, 'no Priced in');
  assert.ok(t.reads.every(([, c]) => c === null), 'every read the Drakes\' - no currency word asked');
});

test('GOLD-MARKET tab: the switch reads the gold view - a gold row\'s price, its courier a Drake\'s worth of gold a Drake; its Buy the purse\'s at the exact cost, disabled while the purse is short; History in gold', async () => {
  const t = standTab();
  await t.tab.open();
  const sw = t.selectOf('Currency');
  assert.ok(sw, 'the switch beside the filters');
  sw.value = 'gold';
  sw.onchange();
  await t.settleDraw();
  assert.deepEqual(t.reads.at(-1), ['materials', 'gold']);
  const courier = courierFee(20, ROAD) * MARK_WORTH_GOLD;
  assert.match(t.text(), new RegExp(`Mithril Ore x4080 gold eachWayrest \\+${goldText(courier)} courier for 20`));
  t.buttons().find((b) => b.textContent.startsWith('Mithril Ore x40')).onclick();
  assert.match(t.text(), new RegExp(`Buy 20 Mithril Ore for 1,600 gold \\+ ${goldText(courier)} courier\\? From your purse, then your account here\\.`));
  const buy = t.buttons().find((b) => b.textContent === 'Buy');
  assert.equal(buy.disabled, false);
  await buy.onclick();
  assert.deepEqual(t.calls.at(-1), ['buy', { region: DF, listing: 'G', units: 20, max: 1600 + courier, hubs: HUBS, currency: 'gold' }]);
  assert.match(t.text(), /Your gold here: 5,000 gold/);
  // a purse short: not offered
  const poor = standTab({ purse: 1600 + courier - 1 });
  await poor.tab.open();
  poor.selectOf('Currency').value = 'gold';
  poor.selectOf('Currency').onchange();
  await poor.settleDraw();
  poor.buttons().find((b) => b.textContent.startsWith('Mithril Ore x40')).onclick();
  assert.equal(poor.buttons().find((b) => b.textContent === 'Buy').disabled, true);
  // History in gold
  t.buttons().find((b) => b.textContent === 'History').onclick();
  await t.settleDraw();
  assert.deepEqual(t.reads.at(-1), ['history', 'gold'], 'the switch stands in History too');
  assert.match(t.text(), /Sold 5 Mithril Ore - 376 gold to you/);
  assert.equal(priceText(1200, 'gold'), '1,200 gold');
  assert.equal(priceText(1, 'marks'), '1 silver');
});

test('GOLD-MARKET tab: My listings - a gold listing\'s price in gold; the List form\'s "Priced in gold" counts own and gold\'s units (never Drakes\'), asks no fee, says what it pays; the gold held and its Collect', async () => {
  const t = standTab({ goldHeld: 376 });
  await t.tab.open();
  t.buttons().find((b) => b.textContent === 'My listings').onclick();
  await t.settleDraw();
  assert.match(t.text(), /Iron Ore - 5 of 10 left90 gold each/);
  assert.match(t.text(), /Your sales hold 376 gold for you\./);
  await t.buttons().find((b) => b.textContent === 'Collect into your bank here').onclick();
  assert.deepEqual(t.calls.at(-1), ['gold', DF]);
  assert.equal(t.words.at(-1), '376 gold into your account at the bank of Daggerfall.');
  // Drakes: own and bought
  const matOptions = () => [...t.selectOf('Material').children].map((o) => o.textContent);
  assert.deepEqual(matOptions(), ['Iron Ore (32)', 'Mithril Ore (9)']);
  const cur = t.selectOf('Currency');
  cur.value = 'gold';
  cur.onchange();
  assert.deepEqual(matOptions(), ['Iron Ore (8)'], 'gold: own and gold\'s - Mithril bought with Drakes lists for none');
  assert.match(t.text(), /No fee\. Up for 72 hours on every board\. If it all sells you get \d+ gold \(after 1% and 5% tax\), collected at a bank\./);   // BOARD-UI (PIN MOVED)
  const list = t.buttons().find((b) => b.textContent === 'List');
  assert.equal(list.disabled, false, 'no Drakes fee asked');
  await list.onclick();
  assert.deepEqual(t.calls.at(-1), ['list', { region: DF, kind: 'material', material: 'ore:iron', units: 1, price: 1, hubs: HUBS, currency: 'gold' }]);
  assert.equal(goldSaleOf(0, 100).gets, 94);
});

test('GOLD-MARKET refusals: every new word the service says has its sentence', () => {
  for (const w of ['market-gold-realm', 'market-currency', 'market-gold-goods', 'market-drakes-goods', 'market-gold-none', 'market-gold-full', 'stores-gold']) {
    assert.notEqual(accountRefusalText(w), accountRefusalText('no-such-word-at-all'), `${w} has words`);
  }
  assert.match(accountRefusalText('market-gold-goods'), /pack or back on the market for gold/);
  assert.match(accountRefusalText('market-drakes-goods'), /^Goods bought with silver, and pieces made with them, sell only for silver\./, 'AUDIT PROF-541 R2-S3: a piece made of counter goods is silver\'s, in words');
  assert.match(readFileSync(new URL('../src/ui/marketTab.js', import.meta.url), 'utf8'), /Goods bought with silver, and pieces made with them, sell only for silver\./, 'AUDIT PROF-541 R2-S3: the gold form\'s own word agrees');
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('GOLD-MARKET wiring: the host gives the market book the realm act over the playing session and a wallet that pays at the board\'s region (purse, letters, then that account - the service\'s order); the door has the collect; the service routes it', () => {
  const w = src('src/scenes/world.js');
  // PIN MOVED (FIELD BUGS 2026-10-01, MARKET-ANY): the realm hook carries the session's abandon too, and the goods' receive beside it
  assert.match(w, /realm: realmSession \? \{ act: \(o\) => realmGoldAct\(\{ \.\.\.o, session: realmSession, checkpoint: \(\) => onlineCheckpoint\(\) \}\), abandon: \(why\) => realmSession\.abandon\(why\) \} : null, goods: realmSession \? \{ receive: \(rec\) => marketGoods\.receive\(rec\) \} : null,\n\s+wallet: realmSession \? \(region\) => \{/);
  // MARKET-AUDIT (PIN MOVED: `deductGold`, its refusal's `credit` the whole cost as coins): the pay answers the undo of exactly
  // what it took - the purse's coins, a letter's value, the bank's gold
  assert.match(w, /pay: \(n\) => payUndoable\(playerEntity, n, account\),\n\s+credit: \(n\) => addGold\(playerEntity, n\),/);
  assert.match(src('src/net/accountClient.js'), /gold: \(req\) => post\('\/v1\/market\/gold', req\),/);
  assert.match(src('server-account/src/index.js'), /'\/v1\/market\/gold': \(\) => marketGoldCollect\(mctx, who\.player, env, body\),/);
  assert.match(src('server-account/src/index.js'), /'\/v1\/market\/buy': \(\) => marketBuy\(mctx, who\.player, env, body\),/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/market\/gold',/);
});

test('AUDIT PROF-541 R2-C7: a dish of your own make spoiled since it was cooked lists neither way - the Crafted list leaves it out (its record mints it fresh: smithItems.js asMinted), and the pack\'s list says why, never "list it as a crafted piece"', async () => {
  const fresh = { templateIndex: 531, name: 'Bread', provenance: 'aaaaaaaaaaaaaaaa' };
  const spoiled = { templateIndex: 531, name: 'Bread', provenance: 'bbbbbbbbbbbbbbbb', foodStage: 2 };
  const book = {
    state: { open: true, balance: 100, road: [], counts: {}, goldHeld: 0 }, pending: 0, cached: () => null, goldOk: true, purse: () => 500,
    read: async () => ({ ok: true, data: { rows: [], orders: [], ways: { [fresh.provenance]: 'yours', [spoiled.provenance]: 'yours' } } }),
    settle: async () => ({ ok: true, settled: 0 }),
  };
  let root = null;
  const m = {
    book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Daggerfall', hubs: HUBS, name: (k) => k, countName: (k) => k,
    pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece', weavers: [], stock: async () => ({ ok: true }),
    goods: () => [fresh, spoiled].map((item) => ({ item, name: item.name, why: null })), good: () => null, goodName: (r) => (r.foodStage ? 'Mouldy Bread' : 'Bread'),
  };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => start(), rerender: () => draw(), nowS: () => 0, alive: () => true });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  await tab.open();
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'My listings').onclick();
  await new Promise((r) => setTimeout(r, 0));
  const what = [...root.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'What to list');
  what.value = 'item'; what.onchange();
  assert.ok(root.textContent.includes(`Not for the market: Bread (your own make - list it as a crafted piece); Mouldy Bread (${SPOILED_DISH_WHY}).`), root.textContent);
  root.remove();
});

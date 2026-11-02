// RPT1026-MARKET (private reports 2026-10-26) - the game's half of ARRIVE (net/marketArrivals.js: what the market sends a
// character reaches its pack on its own) and COLLECT-LANDED (net/marketBook.js collectGood: a collect whose answer was lost
// is received on the retry, never a session ended). Private reports: an axe paid for at a trader in a player's home
// that came nowhere; a bow paid for at another player's house that never came; legendaries that went missing as they came
// off the market. A tab playing a realm character over the real Worker (test/accountDb.mjs, test/realmSeat.mjs): its realm session
// (systems/realmSaves.js createRealmSession), the real realmGoldAct, the pack side (systems/tradePack.js
// createMarketGoods), the book over the account door; the pieces the loot producer mints.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { accountMarket, SESSION_KEY, accountRefusalText } from '../../src/net/accountClient.js';
import { createMarketBook } from '../../src/net/marketBook.js';
import {
  createMarketArrivals, marketArrivedText, marketBackText, ARRIVALS_FIRST_MS, ARRIVALS_AGAIN_MS, ARRIVALS_SOON_MS, ARRIVALS_LATE_MS, ARRIVALS_TRIES,
} from '../../src/net/marketArrivals.js';
import { realmIo, createRealmSession, realmGoldAct } from '../../src/systems/realmSaves.js';
import { createMarketGoods } from '../../src/systems/tradePack.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { generateRandomLoot, LOOT_MATRICES, validLootList } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { createVendorHost } from '../../src/scenes/vendorHost.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `ra-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = () => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'vendor' });

/** A realm character playing in a tab: its pack (`entity`, the save its checkpoints carry), its session, its pack side and
 *  its market book over the real Worker - the realm act and the wallet as the host's. `fetch` the tab's own (a lost answer's). */
async function playing(s, handle, save, fetch = s.fetch) {
  const who = await s.registered(handle);
  const entity = { name: handle, level: 5, goldPieces: 0, items: [], ...save };
  const R = await seatRealm(s.env, who.secret, handle, entity);
  who.character = R.id;
  const storage = sessionStorageOf(SESSION_KEY, who);
  const at = R.at();
  const session = createRealmSession({ io: realmIo({ fetch, storage }), id: at.id, lease: at.lease, seq: at.seq });
  const said = [];
  const goods = createMarketGoods(entity, { say: (t) => said.push(t) });
  const book = createMarketBook({
    door: accountMarket({ fetch, storage }), storage: { getItem: () => null, setItem: () => {} }, character: () => who.character, sleep: noWait,
    realm: { act: (o) => realmGoldAct({ session, checkpoint: () => session.checkpoint(JSON.stringify(entity)), wait: noWait, ...o }), abandon: (w) => session.abandon(w) },
    wallet: () => ({ gold: () => entity.goldPieces, pay: (n) => { entity.goldPieces -= n; return () => { entity.goldPieces += n; }; }, credit: (n) => { entity.goldPieces += n; }, bank: (n) => { entity.goldPieces += n; } }),
    goods: { receive: (rec, why) => goods.receive(rec, why) },
  });
  return { who, entity, session, goods, book, said, at: R.at };
}

/** Eve's trader with a piece of her pack up at 50 gold, and Tom playing with 1,000 in his purse; `fetch` Tom's tab's. */
async function stall(fetchOf = (f) => f) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
  const weapon = items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  const eve = await playing(s, 'Eve', { items: [plain(weapon)] });
  const tom = await playing(s, 'Tom', { goldPieces: 1000 }, fetchOf(s.fetch));
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
    .run(MAP, KEY, eve.who.id, eve.who.character, 'Eve', DF, _now);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`).run(MAP, KEY, PIECE, place(), _now);
  const g = eve.goods.good(eve.entity.items[0]);
  const l = await eve.book.list({ region: DF, kind: 'item', item: g.offered, pick: g.pick, price: 50, hubs: {}, currency: 'gold', vendor: VENDOR }, null, g);
  assert.equal(l.ok, true, JSON.stringify(l));
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const delivered = (who) => raw.prepare('SELECT id, why, collected FROM market_deliveries WHERE player = ?').all(who.id).map((d) => [d.why, Number(d.collected)]);
  return { ...s, raw, eve, tom, weapon, listing: l.data.listing.id, record, delivered, name: itemLongName(validLootList([plain(weapon)])[0]) };
}
/** Tom's buy at the stall, the press's own collect never made (the press that said "Bought" over a piece it never collected). */
const buyOnly = (s) => s.tom.book.buy({ region: DF, listing: s.listing, units: 1, max: 50, hubs: HUBS, currency: 'gold', vendor: VENDOR }, () => {});

/** A clock a test turns by hand: `later` queues, `run()` fires the soonest (its ms read), `ms` the waits asked. */
function handClock() {
  const q = [];
  return {
    q,
    later: (fn, ms) => { const e = { fn, ms, live: true }; q.push(e); return () => { e.live = false; }; },
    pending: () => q.filter((e) => e.live).map((e) => e.ms),
    async run() { const e = q.find((x) => x.live); if (!e) return false; e.live = false; e.fn(); await new Promise((r) => setTimeout(r, 0)); return true; },
  };
}
/** The sweep under way, waited for: each tick's sweep runs its acts on the real Worker. */
const settled = async (a) => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); await a.sweep(); };

// ─── ARRIVE ──────────────────────────────────────────────────────────

test('RPT1026-MARKET ARRIVE: a trader\'s piece bought and never collected reaches the pack on its own - the sweep waits for the checkpoint\'s gate, reads the road, collects it into the record and the pack once, and the pack says a purchase arrived; a second sweep collects nothing (mutants: the sweep never reading the road; the gate unread; the delivery\'s word lost; received twice)', async () => {
  const s = await stall();
  const bought = await buyOnly(s);
  assert.equal(bought.ok, true, JSON.stringify(bought));
  assert.deepEqual([s.tom.entity.items.length, s.delivered(s.tom.who)], [0, [['bought', 0]]], 'the piece a delivery, waiting - the reports\' state');
  const clock = handClock();
  let open = false;
  const a = createMarketArrivals({ book: s.tom.book, settle: () => s.tom.book.settle(() => {}, () => {}), ready: () => open, later: clock.later, now: () => _now * 1000 });
  a.start();
  assert.deepEqual(clock.pending(), [ARRIVALS_FIRST_MS]);
  await clock.run();   // the boot still loading: looked at again, nothing asked
  assert.deepEqual([clock.pending(), s.delivered(s.tom.who)], [[ARRIVALS_FIRST_MS], [['bought', 0]]]);
  open = true;
  await clock.run();
  await settled(a);
  assert.deepEqual(s.delivered(s.tom.who), [['bought', 1]], 'collected on the service');
  assert.deepEqual([s.tom.entity.items.length, s.tom.entity.items[0]?.templateIndex], [1, s.weapon.templateIndex], 'in the pack');
  assert.deepEqual(s.record(s.tom.who).save.items.map((it) => it.templateIndex), [s.weapon.templateIndex], 'and in the record');
  assert.deepEqual(s.tom.said, [marketArrivedText(s.name)], 'said once, as a purchase arrived');
  assert.equal(s.tom.session.lost, null);
  await a.sweep();
  assert.deepEqual([s.tom.entity.items.length, s.tom.said.length, clock.pending()], [1, 1, []], 'nothing more to collect, no clock left');
});

test('RPT1026-MARKET ARRIVE: a piece taken back off a trader whose collect never landed comes back to its seller\'s pack by the sweep, said as come back (mutants: the returned word lost)', async () => {
  const s = await stall();
  const c = await s.eve.book.cancel(s.listing, () => {});
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([s.eve.entity.items.length, s.delivered(s.eve.who)], [0, [['returned', 0]]]);
  const a = createMarketArrivals({ book: s.eve.book, settle: () => s.eve.book.settle(() => {}, () => {}), later: handClock().later });
  await a.sweep();
  assert.deepEqual([s.eve.entity.items.length, s.delivered(s.eve.who), s.eve.said], [1, [['returned', 1]], [marketBackText(s.name)]]);
});

test('RPT1026-MARKET ARRIVE clock: a courier\'s piece is asked for at its arrival (bounded); a "not yet" is asked again ARRIVALS_AGAIN_MS on, ARRIVALS_TRIES times at most, and `soon` counts afresh; a market shut to the account is asked no more (mutants: the courier never waited for; the tries unbounded; soon left uncounted; a shut market asked again)', async () => {
  const nowMs = 5_000_000;
  const road = [];
  let roadAnswer = { ok: true }, settleAnswer = { ok: true, settled: 0, refused: [] };
  const book = { state: { road }, me: () => 'char-1', road: async () => roadAnswer };
  const clock = handClock();
  const a = createMarketArrivals({ book, settle: async () => settleAnswer, later: clock.later, now: () => nowMs });
  // a courier ten minutes out, and another past the longest wait
  road.push({ kind: 'item', id: 'd1', character: 'char-1', ready: false, arrivesAt: nowMs / 1000 + 600 }, { kind: 'item', id: 'd2', character: 'other', ready: false, arrivesAt: nowMs / 1000 + 60 });
  await a.sweep();
  assert.deepEqual(clock.pending(), [600_000 + ARRIVALS_LATE_MS], 'this character\'s courier alone, at its arrival');
  road.length = 0;
  road.push({ kind: 'piece', id: 'd3', character: 'char-1', ready: false, arrivesAt: nowMs / 1000 + 86_400 });
  await a.sweep();
  assert.deepEqual(clock.pending(), [30 * 60_000], 'a day\'s road read again on the way');
  // the record held by another act: asked again, at most ARRIVALS_TRIES times in a row
  road.length = 0;
  settleAnswer = { ok: true, settled: 0, refused: ['busy'] };
  for (let i = 0; i < ARRIVALS_TRIES; i++) { await a.sweep(); assert.deepEqual(clock.pending(), [ARRIVALS_AGAIN_MS], `try ${i + 1}`); }
  await a.sweep();
  assert.deepEqual(clock.pending(), [], 'given up until poked');
  a.soon();
  assert.deepEqual(clock.pending(), [ARRIVALS_SOON_MS]);
  await a.sweep();
  assert.deepEqual(clock.pending(), [ARRIVALS_AGAIN_MS], 'soon counted its tries afresh');
  // the service's own fault on the road read is "not yet" too; the market shut is the end
  settleAnswer = { ok: true, settled: 0, refused: [] };
  roadAnswer = { ok: false, error: 'server' };
  await a.sweep();
  assert.deepEqual(clock.pending(), [ARRIVALS_AGAIN_MS]);
  roadAnswer = { ok: false, error: 'market-closed' };
  await a.sweep();
  a.soon();
  a.start();
  assert.deepEqual(clock.pending(), [], 'shut: never asked again this session');
});

// ─── COLLECT-LANDED ──────────────────────────────────────────────────

test('RPT1026-MARKET COLLECT-LANDED: a collect whose answer was lost is asked again with `landed`, and the repeat naming the record\'s sequence is received into the pack - the session stands at that sequence, the piece in the pack and the record once (mutants: `landed` never sent; a landed repeat abandoned; every repeat received)', async () => {
  let lose = false;
  const asked = [];
  const s = await stall((fetch) => async (u, i) => {
    const r = await fetch(u, i);
    if (String(u).endsWith('/v1/market/collect')) {
      asked.push(JSON.parse(i.body));
      if (lose) { lose = false; throw new TypeError('the answer never came'); }
    }
    return r;
  });
  const bought = await buyOnly(s);
  assert.equal(bought.ok, true);
  lose = true;
  const c = await s.tom.book.collectGood(bought.data.delivery.id);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual(asked.map((b) => [b.landed, b.rid === asked[0].rid, b.realm.seq]), [[true, true, asked[0].realm.seq], [true, true, asked[0].realm.seq]], 'the same ask twice, saying it reads a landed repeat');
  assert.equal(s.tom.session.lost, null, 'the session stands');
  const rec = s.record(s.tom.who);
  assert.equal(s.tom.session.seq, rec.seq, 'at the record\'s sequence');
  assert.deepEqual([s.tom.entity.items.map((it) => it.templateIndex), rec.save.items.map((it) => it.templateIndex)], [[s.weapon.templateIndex], [s.weapon.templateIndex]]);
  assert.deepEqual(s.delivered(s.tom.who), [['bought', 1]]);
});

test('RPT1026-MARKET COLLECT-LANDED book: a repeat that names no sequence (a collect made before this ask) still abandons the session and receives nothing - the record holds the piece at the join (mutants: every repeat received)', async () => {
  let lost = null;
  const received = [];
  const session = { transact: async (fn) => fn({ id: 'realm-1', lease: 'lease-1', seq: 4 }) };
  const book = createMarketBook({
    door: { account: () => 'acct-1', collect: async () => ({ ok: true, status: 200, data: { repeat: true, delivery: { id: 'd1', why: 'bought' }, item: { templateIndex: 1 } } }) },
    storage: { getItem: () => null, setItem: () => {} }, character: () => 'realm-1', sleep: noWait,
    realm: { act: (o) => realmGoldAct({ session, checkpoint: () => {}, wait: noWait, ...o }), abandon: (w) => { lost = w; } },
    goods: { receive: (it) => { received.push(it); return true; } },
  });
  await book.collectGood('d1');
  assert.deepEqual([lost, received], ['unknown', []]);
});

// ─── THE STALL AND THE HOST ──────────────────────────────────────────

test('RPT1026-MARKET ARRIVE stall: a press whose own collect did not land says the piece is on its way and sweeps for it shortly - never "Bought" over a piece left on the service; a collect another door made first says "Bought"; the stall\'s opening reads the road before it settles (mutants: the press\'s word unchanged; soon never asked; market-gone said as on the way; the stall settling unread)', async () => {
  const timers = [];
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => { const h = { fn, ms, live: true, unref() {} }; timers.push(h); return h; };
  globalThis.clearTimeout = (h) => { if (h) h.live = false; };
  try {
    let collect = { ok: false, error: 'busy' };
    const calls = [];
    const marketBook = {
      state: { road: [] }, me: () => 'char-1',
      buy: async () => ({ ok: true, data: { delivery: { id: 'd1' } } }),
      cancel: async () => ({ ok: true, data: { delivery: { id: 'd2' } } }),
      collectGood: async (id) => { calls.push(['collect', id]); return collect; },
      road: async () => { calls.push(['road']); return { ok: true }; },
      settle: async () => { calls.push(['settle']); return { ok: true, settled: 0, refused: [] }; },
    };
    let stallHost = null;
    // PIN MOVED (the fourth merge of main into #1184): BAY-LEFT-SEA's hubs are read as they stand now - `marketHubs()`
    const host = createVendorHost({
      marketBook, marketMint: () => {}, marketPutBack: () => {}, marketDrop: () => {}, marketHubs: () => ({}), marketGoods: { goodName: () => 'Dwarven Mace' },
      profBook: { state: { open: true } }, marksBook: { state: { open: true } }, noticeBook: {},
      showNoticeWindow: (w) => { stallHost = w.vendors; return true; }, checkpointGateOpen: () => true,
    });
    const live = () => timers.filter((h) => h.live).map((h) => h.ms);
    assert.deepEqual(live(), [ARRIVALS_FIRST_MS], 'a host with the gate starts the clock');
    host.openHomeVendorWindow({ vendor: VENDOR, owner: 'Eve' });
    const busy = await stallHost.buy({ id: 'L1', region: DF, price: 50, item: {} });
    assert.deepEqual([busy.ok, busy.text], [true, 'Bought Dwarven Mace for 50 gold. It is on its way to your pack and will reach it on its own.']);
    assert.deepEqual(live(), [ARRIVALS_SOON_MS], 'swept for shortly');
    const back = await stallHost.take({ id: 'L2', item: {} });
    assert.deepEqual([back.ok, back.text], [true, 'Dwarven Mace is on its way back to your pack and will reach it on its own.']);
    collect = { ok: false, error: 'market-gone' };
    const gone = await stallHost.buy({ id: 'L1', region: DF, price: 50, item: {} });
    assert.equal(gone.text, 'Bought Dwarven Mace for 50 gold.', 'another door collected it: in the pack');
    collect = { ok: true };
    assert.equal((await stallHost.buy({ id: 'L1', region: DF, price: 50, item: {} })).text, 'Bought Dwarven Mace for 50 gold.');
    calls.length = 0;
    await stallHost.settle();
    assert.deepEqual(calls, [['road'], ['settle']], 'the road read, then the book settled');
    // a refusal of the buy itself is the buy's own word, as before
    marketBook.buy = async () => ({ ok: false, error: 'market-gone' });
    assert.deepEqual(await stallHost.buy({ id: 'L1', region: DF, price: 50, item: {} }), { ok: false, text: accountRefusalText('market-gone') });
  } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
});

test('RPT1026-MARKET ARRIVE wiring: bootWorld hands the vendor host the checkpoint\'s gate (the sweep acts only once it is open), the Vendor page\'s Collect is the host\'s; a host with no gate starts no clock', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /noticeBook, playerTravelPixel, profBook, showNoticeWindow, townTalk,\n {4}checkpointGateOpen, {3}\/\/ RPT1026-MARKET ARRIVE/);
  assert.match(world, /collectGold: vendorCollectGold, {3}\/\/ RPT1026-MARKET/);
  assert.match(world, /goods: realmSession \? \{ receive: \(rec, why\) => marketGoods\.receive\(rec, why\) \} : null,/);
  const host = src('src/scenes/vendorHost.js');
  assert.match(host, /ready: \(\) => checkpointGateOpen\?\.\(\) === true && globalThis\.document\?\.visibilityState !== 'hidden',/);
  assert.match(host, /if \(marketBook && typeof checkpointGateOpen === 'function'\) arrivals\.start\(\);/);
  // the delete a waiting purchase holds says the way out: play it once, and what waits comes to its pack
  const open = accountRefusalText('realm-market-open');
  assert.match(typeof open === 'function' ? open() : open, /a trader's takings\. Settle it first\. Play it online once and goods waiting for it come to its pack on their own; takings are collected on the Vendor page\.$/);
});

// AUDIT RPT1026 (lane D, MARKET) - the market group of FIELD BUGS 2026-10-26r read cold
// (bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md, RPT1026-MARKET). What the market sends a character reaches its pack
// on its own (net/marketArrivals.js, the sweep), and these are the doors the audit found it still missed:
//   D1 - a press's `soon` asked while a sweep was under way was cancelled by that sweep's own clock: its road had been read
//        before the press, so the piece the press said "will reach it on its own" waited for the next join;
//   D2 - a clock running ahead of the service's asked the road every ARRIVALS_LATE_MS for a courier's whole road;
//   D3 - a take-back kept unanswered (its first asking never reached the service) landed on a later settle, and that
//        settle never collected the piece it sent back: off the stall and in nobody's pack until another settle.
// Over the real Worker (test/accountDb.mjs, test/realmSeat.mjs), the real realm session and realmGoldAct, the pack side
// (systems/tradePack.js createMarketGoods), the book over the account door and the stall over the vendor host; the pieces
// the loot producer mints.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { accountMarket, SESSION_KEY, accountRefusalText } from '../../src/net/accountClient.js';
import { createMarketBook } from '../../src/net/marketBook.js';
import { createMarketArrivals, marketBackText, ARRIVALS_AGAIN_MS, ARRIVALS_SOON_MS, ARRIVALS_LATE_MS } from '../../src/net/marketArrivals.js';
import { realmIo, createRealmSession, realmGoldAct } from '../../src/systems/realmSaves.js';
import { createMarketGoods } from '../../src/systems/tradePack.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { generateRandomLoot, LOOT_MATRICES, validLootList } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { createVendorHost } from '../../src/scenes/vendorHost.js';

const noWait = () => Promise.resolve();
const _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = () => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'vendor' });
/** A tab's localStorage. */
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };
const ticks = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

/** A realm character playing in a tab over the real Worker - its pack, session, pack side and market book, as the host
 *  builds them (scenes/world.js); `fetch` the tab's own. */
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
    door: accountMarket({ fetch, storage }), storage: memory(), character: () => who.character, sleep: noWait,   // the tab's own: a kept act kept
    realm: { act: (o) => realmGoldAct({ session, checkpoint: () => session.checkpoint(JSON.stringify(entity)), wait: noWait, ...o }), abandon: (w) => session.abandon(w) },
    wallet: () => ({ gold: () => entity.goldPieces, pay: (n) => { entity.goldPieces -= n; return () => { entity.goldPieces += n; }; }, credit: (n) => { entity.goldPieces += n; }, bank: (n) => { entity.goldPieces += n; } }),
    goods: { receive: (rec, why) => goods.receive(rec, why) },
  });
  return { who, entity, session, goods, book, said };
}

/** Eve's trader with a weapon of her pack up at 50 gold, and Tom with 1,000 in his purse; each tab's fetch its own. */
async function stall({ eveFetch = (f) => f, tomFetch = (f) => f } = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
  const weapon = items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  const eve = await playing(s, 'Eve', { items: [plain(weapon)] }, eveFetch(s.fetch));
  const tom = await playing(s, 'Tom', { goldPieces: 1000 }, tomFetch(s.fetch));
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
    .run(MAP, KEY, eve.who.id, eve.who.character, 'Eve', DF, _now);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`).run(MAP, KEY, PIECE, place(), _now);
  const g = eve.goods.good(eve.entity.items[0]);
  const l = await eve.book.list({ region: DF, kind: 'item', item: g.offered, pick: g.pick, price: 50, hubs: {}, currency: 'gold', vendor: VENDOR }, null, g);
  assert.equal(l.ok, true, JSON.stringify(l));
  const record = (who) => {
    const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character);
    return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj)));
  };
  const delivered = (who) => raw.prepare('SELECT why, collected FROM market_deliveries WHERE player = ?').all(who.id).map((d) => [d.why, Number(d.collected)]);
  return { ...s, eve, tom, weapon, listing: l.data.listing.id, record, delivered, name: itemLongName(validLootList([plain(weapon)])[0]) };
}

/** A clock a test turns by hand: `later` queues, `pending()` the waits still live, `run()` fires the soonest asked. */
function handClock() {
  const q = [];
  return {
    later: (fn, ms) => { const e = { fn, ms, live: true }; q.push(e); return () => { e.live = false; }; },
    pending: () => q.filter((e) => e.live).map((e) => e.ms),
    async run() { const e = q.find((x) => x.live); if (!e) return false; e.live = false; e.fn(); await ticks(); return true; },
  };
}

// ─── D1 ──────────────────────────────────────────────────────────────

test('AUDIT RPT1026 D1: a press\'s `soon` asked while a sweep is under way is kept - the sweep, its road read before the press, still leaves a sweep due, and that sweep collects the piece (mutants: the poke never kept; the kept poke never swept for)', async () => {
  // a sweep's road read answered by the service before Tom's buy, and heard after it (the answer slow on its way back)
  let hold = null, readDone = null;
  const s = await stall({
    tomFetch: (fetch) => async (u, i) => {
      const r = await fetch(u, i);
      if (hold && String(u).endsWith('/v1/market/road')) { readDone?.(); await hold; }
      return r;
    },
  });
  const clock = handClock();
  const a = createMarketArrivals({ book: s.tom.book, settle: () => s.tom.book.settle(() => {}, () => {}), later: clock.later, now: () => _now * 1000 });
  let release = () => {};
  hold = new Promise((r) => { release = r; });
  const read = new Promise((r) => { readDone = r; });
  const sweeping = a.sweep();   // a courier's or an earlier press's sweep
  await read;   // the service has read the road: nothing of Tom's on it yet
  const bought = await s.tom.book.buy({ region: DF, listing: s.listing, units: 1, max: 50, hubs: HUBS, currency: 'gold', vendor: VENDOR }, () => {});
  assert.equal(bought.ok, true, JSON.stringify(bought));
  a.soon();   // the press's own collect did not land (scenes/vendorHost.js collectedAtPress)
  hold = null;
  release();
  await sweeping;
  assert.deepEqual([s.delivered(s.tom.who), s.tom.entity.items.length], [[['bought', 0]], 0], 'the sweep under way read its road before the buy');
  assert.deepEqual(clock.pending(), [ARRIVALS_SOON_MS], 'and the press\'s sweep is still due');
  await clock.run();
  await a.sweep();
  assert.deepEqual([s.delivered(s.tom.who), s.tom.entity.items.map((it) => it.templateIndex)], [[['bought', 1]], [s.weapon.templateIndex]], 'collected, into the pack');
  assert.deepEqual(s.record(s.tom.who).items.map((it) => it.templateIndex), [s.weapon.templateIndex], 'and the record, once');
});

test('AUDIT RPT1026 D1 clock: a `soon` during a sweep leaves ARRIVALS_SOON_MS due once that sweep ends, whatever the sweep\'s own clock decided; unpoked, the sweep\'s own clock stands (mutants: the poke never kept; the kept poke never swept for; a shut market swept for)', async () => {
  let release = () => {};
  let roadAnswer = { ok: true };
  const book = { state: { road: [] }, me: () => 'c1', road: async () => { await new Promise((r) => { release = r; }); return roadAnswer; } };
  const clock = handClock();
  const a = createMarketArrivals({ book, settle: async () => ({ ok: true, settled: 0, refused: [] }), later: clock.later, now: () => 1e12 });
  let p = a.sweep();
  a.soon();
  release();
  await p;
  assert.deepEqual(clock.pending(), [ARRIVALS_SOON_MS]);
  // the press's poke outlives a sweep that met "not yet" too: soon, not the minute's wait
  roadAnswer = { ok: false, error: 'server' };
  p = a.sweep();
  a.soon();
  release();
  await p;
  assert.deepEqual(clock.pending(), [ARRIVALS_SOON_MS]);
  // no poke: the sweep's own clock stands
  p = a.sweep();
  release();
  await p;
  assert.deepEqual(clock.pending(), [ARRIVALS_AGAIN_MS]);
  // a market shut to the account is swept for no more, poked or not
  roadAnswer = { ok: false, error: 'market-closed' };
  p = a.sweep();
  a.soon();
  release();
  await p;
  assert.deepEqual(clock.pending(), []);
});

// ─── D2 ──────────────────────────────────────────────────────────────

test('AUDIT RPT1026 D2: a clock ahead of the service\'s - a courier the service still has on the road and this clock has past - is asked again ARRIVALS_AGAIN_MS on, never every ARRIVALS_LATE_MS for the courier\'s whole road; a piece arriving as the sweep ran keeps the slack (mutants: the overdue wait the slack\'s; the ahead clock unnoticed)', async () => {
  const serverS = 1_000_000;
  const road = [{ kind: 'item', id: 'd1', character: 'c1', ready: false, arrivesAt: serverS + 900 }];   // fifteen minutes out
  let reads = 0;
  const book = { state: { road }, me: () => 'c1', road: async () => { reads++; return { ok: true }; } };
  const clock = handClock();
  const a = createMarketArrivals({ book, settle: async () => ({ ok: true, settled: 0, refused: [] }), later: clock.later, now: () => serverS * 1000 + 3_600_000 });   // an hour ahead
  await a.sweep();
  assert.deepEqual(clock.pending(), [ARRIVALS_AGAIN_MS]);
  for (let ms = 0; ms < 900_000; ms += clock.pending()[0]) await clock.run();   // the courier's fifteen minutes
  assert.ok(reads <= 1 + 900_000 / ARRIVALS_AGAIN_MS, `${reads} road reads over a fifteen-minute courier`);
  // a clock on time: the piece came due while the sweep ran (two seconds ago, still on the road when it was read) - the slack
  const b = createMarketArrivals({ book: { state: { road: [{ kind: 'item', id: 'd2', character: 'c1', ready: false, arrivesAt: serverS - 2 }] }, me: () => 'c1', road: async () => ({ ok: true }) },
    settle: async () => ({ ok: true, settled: 0, refused: [] }), later: clock.later, now: () => serverS * 1000 });
  await b.sweep();
  assert.deepEqual(clock.pending().slice(-1), [ARRIVALS_LATE_MS]);
});

// ─── D3 ──────────────────────────────────────────────────────────────

test('AUDIT RPT1026 D3: a take-back at the stall kept unanswered lands as the stall opens again, and its piece comes back to the pack then - said as come back, in the record once - never off the stall and in nobody\'s pack (mutants: the kept cancel\'s delivery uncollected; said as a purchase)', async () => {
  let drop = false;
  const s = await stall({
    eveFetch: (fetch) => async (u, i) => {
      if (drop && String(u).endsWith('/v1/market/cancel')) throw new TypeError('the request never left');
      return fetch(u, i);
    },
  });
  let stallHost = null;
  const host = createVendorHost({
    marketBook: s.eve.book, marketMint: () => {}, marketPutBack: () => {}, marketDrop: () => {}, marketHubs: {}, marketGoods: s.eve.goods,
    profBook: { state: { open: true } }, marksBook: { state: { open: true } }, noticeBook: {},
    showNoticeWindow: (w) => { stallHost = w.vendors; return true; },
  });
  host.openHomeVendorWindow({ vendor: VENDOR, owner: 'Eve' });
  drop = true;
  const took = await stallHost.take({ id: s.listing, item: s.weapon });
  assert.deepEqual([took.ok, s.eve.book._kept().cancels.length, s.delivered(s.eve.who)], [false, 1, []], 'kept: the service never heard it');
  assert.equal(took.text, accountRefusalText('offline'));
  drop = false;
  const r = await stallHost.settle();   // the stall opened again: the sweep, the kept cancel asked again
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.refused, []);
  assert.deepEqual(s.delivered(s.eve.who), [['returned', 1]], 'collected on the service');
  assert.deepEqual(s.eve.entity.items.map((it) => it.templateIndex), [s.weapon.templateIndex], 'back in the pack');
  assert.deepEqual(s.record(s.eve.who).items.map((it) => it.templateIndex), [s.weapon.templateIndex], 'and in the record');
  assert.deepEqual(s.eve.said, [marketBackText(s.name)]);
  assert.deepEqual([s.eve.book._kept().cancels.length, s.eve.session.lost], [0, null]);
  await stallHost.settle();
  assert.equal(s.eve.entity.items.length, 1, 'once');
});

test('AUDIT RPT1026 D3: a kept take-back whose piece another door collected first (the cancel landed, its answer lost) says no refusal as the settle answers it - the piece is in the pack, once (mutants: market-gone said)', async () => {
  let lose = false;
  const s = await stall({
    eveFetch: (fetch) => async (u, i) => {
      const r = await fetch(u, i);
      if (lose && String(u).endsWith('/v1/market/cancel')) throw new TypeError('the answer never came');
      return r;
    },
  });
  lose = true;
  const c = await s.eve.book.cancel(s.listing, () => {});
  assert.deepEqual([c.ok, c.kept, s.delivered(s.eve.who)], [false, true, [['returned', 0]]], 'landed, its answer lost: kept');
  lose = false;
  const press = await s.eve.book.collectGood(s.listing);   // the delivery is the listing's own id - another door's collect
  assert.equal(press.ok, true, JSON.stringify(press));
  const r = await s.eve.book.settle(() => {}, () => {});
  assert.deepEqual([r.ok, r.refused, s.eve.book._kept().cancels.length], [true, [], 0]);
  assert.deepEqual([s.delivered(s.eve.who), s.eve.entity.items.length], [[['returned', 1]], 1]);
});

// VENDOR-LOST (FIELD BUGS 2026-10-25): "I just tried purchasing two items from another users store. The game took a
// while to process the trade, but crashed before or as it happened and on BOTH occasions it took ALL my gold and BOTH
// the items I tried purchasing." A trader's buy landed on the service - the buyer's record paid, the listing sold, the
// piece a delivery - and its answer was lost. realmGoldAct asked again from where the record stood and the service said
// `seq` before it looked the sale up, so the session ended ("The realm did not answer about a trade in progress") and the
// piece waited uncollected: only the Market tab's settle asked the kept buy again, and it never collected what it bought.
// Record: bible/01-Overview/bugs/Field-Bugs-2026-10-25g.md. The service half through the real Worker over node:sqlite
// with every migration applied and R2 beside it (test/accountDb.mjs, test/realmSeat.mjs); the book over the real
// realmGoldAct; the stall over the DOM shim.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { createMarketBook } from '../../src/net/marketBook.js';
import { realmGoldAct } from '../../src/systems/realmSaves.js';
import { createVendorTab } from '../../src/ui/vendor/vendorTab.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { createVendorHost } from '../../src/scenes/vendorHost.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `vl-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = (station = null) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });

/** Eve's trader in Daggerfall with one piece up at 50 gold, and Tom with 1,000 in his purse. */
async function stall() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  const seated = async (handle, save) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 0, ...save });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
  const weapon = items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  const eve = await seated('Eve', { items: [plain(weapon)] });
  const tom = await seated('Tom', { goldPieces: 1000 });
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
    .run(MAP, KEY, eve.id, eve.character, 'Eve', DF, _now);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`).run(MAP, KEY, PIECE, place('vendor'), _now);
  const l = await s.call('/v1/market/list', { character: eve.character, region: WR, kind: 'item', item: validLootList([record(eve).save.items[0]])[0], pick: 0, price: 50,
    hubs: HUBS, rid: rid(), currency: 'gold', realm: eve.at(), vendor: VENDOR }, eve.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const buyBody = (at, extra = {}) => ({ character: tom.character, region: DF, listing: l.body.listing.id, units: 1, max: 50, hubs: HUBS, rid: rid(), realm: at, vendor: VENDOR, ...extra });
  const buy = (body) => s.call('/v1/market/buy', body, tom.secret);
  const deliveries = () => raw.prepare('SELECT id, collected FROM market_deliveries WHERE player = ?').all(tom.id);
  return { ...s, raw, record, eve, tom, buyBody, buy, deliveries, weapon };
}

// ─── THE SERVICE ─────────────────────────────────────────────────────

test('VENDOR-LOST service: a trader\'s buy that landed, asked again from where the record stood before it, is answered as the repeat with the record\'s sequence and its delivery - never `seq`; an older tab (no `landed`), and a record one on with no sale of the id, are still told `seq`; paid once, and the piece collects (mutants: the sale looked up after the record; `landed` unread; one on taken for any move)', async () => {
  const s = await stall();
  const at0 = s.tom.at();
  const body = s.buyBody(at0, { landed: true });
  const first = await s.buy(body);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual([first.body.realm.seq, typeof first.body.delivery?.id], [at0.seq + 1, 'string']);
  // the answer lost: realmGoldAct asks again with the same body - the same id, the same `where`
  const again = await s.buy(body);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual([again.body.repeat, again.body.realm, again.body.delivery.id, again.body.sale.kind, again.body.sale.here],
    [true, { seq: at0.seq + 1 }, first.body.delivery.id, 'item', true], 'the sale, landed, with the record\'s sequence');
  // an older tab reads every repeat as a sale paid before it asked: it is told `seq`, as before, and its session ends
  const older = await s.buy({ ...body, landed: undefined });
  assert.deepEqual([older.status, older.body], [409, { error: 'seq', seq: at0.seq + 1 }]);
  // one on with no sale of this id: a move this tab never made
  const stranger = await s.buy(s.buyBody(at0, { landed: true }));
  assert.deepEqual([stranger.status, stranger.body], [409, { error: 'seq', seq: at0.seq + 1 }]);
  const paid = s.record(s.tom);
  assert.deepEqual([paid.seq, paid.save.goldPieces, paid.save.items.length], [at0.seq + 1, 950, 0], 'paid once, the piece not yet in the record');
  assert.deepEqual(s.deliveries().map((d) => [d.id, d.collected]), [[first.body.delivery.id, 0]]);
  const c = await s.call('/v1/market/collect', { character: s.tom.character, delivery: again.body.delivery.id, rid: rid(), realm: s.tom.at() }, s.tom.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([s.record(s.tom).save.items.length, s.record(s.tom).save.items[0].templateIndex], [1, s.weapon.templateIndex], 'collected into the record');
  // two on (the collect moved it again): no longer this sale's own move - `seq`
  const late = await s.buy(body);
  assert.deepEqual([late.status, late.body], [409, { error: 'seq', seq: at0.seq + 2 }]);
});

test('VENDOR-LOST service: the retry that ran while the first asking\'s batch landed (past the record\'s first word, its own batch then refused) is answered as that sale, landed - one sale, paid once, one delivery (mutants: the batch\'s catch answering `seq`)', async () => {
  const s = await stall();
  const at0 = s.tom.at();
  const body = s.buyBody(at0, { landed: true });
  // the retry's record is written to R2 before its batch: the first asking, still under way, lands just then
  const put = s.env.SAVES.put.bind(s.env.SAVES);
  let firstAsking = null;
  s.env.SAVES.put = async (key, text) => {
    if (!firstAsking) { firstAsking = s.buy(body); await firstAsking; }
    return put(key, text);
  };
  const b = await s.buy(body);
  s.env.SAVES.put = put;
  const a = await firstAsking;
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual([!!a.body.repeat, b.body.repeat], [false, true], 'the first asking\'s sale, and the retry its repeat');
  assert.deepEqual([a.body.realm, b.body.realm], [{ seq: at0.seq + 1 }, { seq: at0.seq + 1 }]);
  assert.equal(a.body.delivery.id, b.body.delivery.id);
  assert.equal(Number(s.raw.prepare('SELECT COUNT(*) AS n FROM market_sales WHERE buyer = ?').get(s.tom.id).n), 1);
  assert.deepEqual([s.record(s.tom).seq, s.record(s.tom).save.goldPieces, s.deliveries().length], [at0.seq + 1, 950, 1]);
});

// ─── THE BOOK ────────────────────────────────────────────────────────

/** A realm session as realmSaves.js's transact keeps it (the sequence adopted on an answer, `unknown` ending it), and a purse. */
function realmSide(purse = 1000) {
  const st = { seq: 1, lost: null, purse };
  const session = { transact: async (fn) => {
    if (st.lost) return { ok: false, error: st.lost };
    const r = await fn({ id: 'realm-1', lease: 'lease-1', seq: st.seq });
    if (r?.ok && Number.isSafeInteger(r.seq) && r.seq > st.seq) st.seq = r.seq;
    if (r?.unknown) st.lost = 'unknown';
    return r;
  } };
  const realm = { act: (o) => realmGoldAct({ session, checkpoint: () => {}, wait: () => Promise.resolve(), ...o }), abandon: (why) => { st.lost = why; } };
  const wallet = () => ({ gold: () => st.purse, pay: (n) => { st.purse -= n; return () => { st.purse += n; }; }, credit: (n) => { st.purse += n; }, bank: () => {} });
  return { st, realm, wallet };
}
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** The service's answer to a trader's buy: the sale here, its delivery arrived at once. */
const traded = (extra = {}) => ({ ok: true, status: 200, data: { sale: { kind: 'item', here: true, total: 50, courier: 0 }, delivery: { id: 'dlv-1', arrivesAt: 0 }, balance: 0, ...extra } });
const gotItem = { ok: true, status: 200, data: { delivery: { id: 'dlv-1', why: 'bought' }, item: { templateIndex: 1 }, realm: { seq: 3 } } };

test('VENDOR-LOST book: a press whose first answer was lost asks again with `landed` and takes the repeat with the record\'s sequence as its sale - the session stands at the record\'s sequence, the purse paid once, the buy let go (mutants: `landed` never sent)', async () => {
  const side = realmSide(1000);
  const asked = [];
  const door = { account: () => 'acct-1', buy: async (b) => { asked.push(b); return asked.length === 1 ? { ok: false, error: 'offline' } : traded({ repeat: true, realm: { seq: 2 } }); } };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'realm-1', sleep: () => Promise.resolve(), realm: side.realm, wallet: side.wallet });
  const r = await book.buy({ region: DF, listing: 'L1', units: 1, max: 50, hubs: {}, currency: 'gold', vendor: VENDOR }, () => {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(asked.map((b) => [b.landed, b.realm.seq, b.rid === asked[0].rid]), [[true, 1, true], [true, 1, true]], 'the same ask, twice, saying it reads a landed repeat');
  assert.deepEqual([side.st.lost, side.st.seq, side.st.purse, book.pending, r.data.delivery.id], [null, 2, 950, 0, 'dlv-1']);
});

test('VENDOR-LOST book: a kept trader\'s buy settled - its repeat\'s delivery collected into the record and the pack once, never again off the road; a repeat this ask made (its first answer lost: the record\'s sequence named) paid, one made before it not (mutants: the delivery left; the road collecting it twice; a landed repeat unpaid; every repeat paid)', async () => {
  // `mine` and the road read apart, so each half is asked alone: the buy's own collect with no road, the road's skip with one
  for (const [mine, road] of [[false, false], [true, true], [false, true]]) {
    const side = realmSide(1000);
    const storage = memStorage();
    let phase = 'lost', buys = 0;
    const collects = [], received = [];
    const door = {
      account: () => 'acct-1',
      read: async () => ({ ok: true, status: 200, data: { road: [{ kind: 'item', id: 'dlv-1', character: 'realm-1', ready: true }] } }),
      buy: async () => {
        buys++;
        if (phase === 'lost') return { ok: false, error: 'offline' };
        // mine: this settle's first ask landed and its answer was lost - the repeat names the record's sequence
        if (mine) return buys === 5 ? { ok: false, error: 'offline' } : traded({ repeat: true, realm: { seq: 2 } });
        return traded({ repeat: true });
      },
      collect: async (character, delivery, id, at) => { collects.push([character, delivery, at?.seq]); return gotItem; },
    };
    const book = createMarketBook({ door, storage, character: () => 'realm-1', sleep: () => Promise.resolve(), realm: side.realm, wallet: side.wallet, goods: { receive: (it) => { received.push(it); return true; } } });
    // the press: every answer lost - kept, the session ended, the purse as it paid
    const k = await book.buy({ region: DF, listing: 'L1', units: 1, max: 50, hubs: {}, currency: 'gold', vendor: VENDOR }, () => {});
    assert.deepEqual([k.kept, book.pending, side.st.lost, side.st.purse], [true, 1, 'unknown', 950]);
    // the join reads the record: paid if the sale landed before (`mine` false), whole if it lands on the settle
    side.st.lost = null;
    side.st.seq = mine ? 1 : 2;
    side.st.purse = mine ? 1000 : 950;
    phase = 'joined';
    if (road) await book.read('goods', { region: DF });   // the road names the same delivery
    const st = await book.settle(() => {}, () => {});
    assert.deepEqual([st.ok, st.refused, book.pending], [true, [], 0], JSON.stringify(st));
    assert.deepEqual(collects, [['realm-1', 'dlv-1', 2]], 'collected once, where the record stands');
    assert.deepEqual(received, [{ templateIndex: 1 }], 'into the pack');
    // off the road the read named: the stall's next settle has no read behind it, and asks nothing again
    assert.deepEqual(book.state.road, []);
    const next = await book.settle(() => {}, () => {});
    assert.deepEqual([next.refused, collects.length], [[], 1], 'a second opening says no refusal');
    assert.equal(side.st.purse, 950, mine ? 'its own sale, landed: paid on the answer' : 'a sale made before it: paid on the record, nothing again');
  }
});

test('VENDOR-LOST book: a crafted piece collected off the road is off it too - a second settle with no read behind it asks nothing again (mutants: a piece\'s road kept)', async () => {
  const collects = [], minted = [];
  const door = {
    account: () => 'acct-1',
    read: async () => ({ ok: true, status: 200, data: { road: [{ kind: 'piece', id: 'dp-1', character: 'char-a', ready: true }] } }),
    collect: async (character, delivery) => { collects.push(delivery); return { ok: true, status: 200, data: { delivery: { id: delivery, why: 'bought' }, piece: { provenance: '0123456789abcdef' } } }; },
  };
  const book = createMarketBook({ door, storage: memStorage(), character: () => 'char-a', sleep: () => Promise.resolve() });
  await book.read('goods', { region: DF });
  await book.settle((p) => minted.push(p), () => {});
  const next = await book.settle((p) => minted.push(p), () => {});
  assert.deepEqual([collects, minted.length, book.state.road, next.refused], [['dp-1'], 1, [], []]);
});

// ─── THE STALL ───────────────────────────────────────────────────────

test('VENDOR-LOST stall: a trader\'s stall opened settles the market book\'s kept acts through the window\'s door beside its read, reads again when one settled and says a refusal; the board\'s tab does not (mutants: the stall never settling; a refusal unsaid)', async () => {
  const words = [];
  const ui = { busy: () => false, run: async (s) => { words.push(await s()); }, rerender: () => {}, nowS: () => 1e9, alive: () => true };
  let reads = 0, settles = 0, answer = { ok: true, settled: 1, refused: [] };
  const stallHost = { mode: 'stall', own: false, owner: 'Eve', read: async () => { reads++; return { ok: true, data: { vendor: {}, rows: [] } }; }, settle: async () => { settles++; return answer; } };
  await createVendorTab(stallHost, ui).open();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([settles, reads, words], [1, 2, [{ ok: true, text: '' }]], 'settled once, read beside it and again after');
  answer = { ok: true, settled: 0, refused: ['market-gone'] };
  words.length = 0;
  await createVendorTab(stallHost, ui).open();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(words, [{ ok: false, text: accountRefusalText('market-gone') }]);
  const board = { mode: 'board', read: async () => ({ ok: true, data: { rows: [] } }), settle: async () => { settles++; return answer; } };
  settles = 0;
  await createVendorTab(board, ui).open();
  assert.equal(settles, 0, 'the board\'s Vendors tab buys nothing');
});

test('VENDOR-LOST wiring: a trader\'s stall opened through the vendor host settles the market book over the Market tab\'s own mint, put-back and drop', async () => {
  const marketMint = () => {};
  const marketPutBack = () => {};
  const marketDrop = () => {};
  const settleCalls = [];
  const marketBook = {
    settle: async (...callbacks) => { settleCalls.push(callbacks); return { ok: true, settled: 0, refused: [] }; },
  };
  let stallHost = null;
  const { openHomeVendorWindow } = createVendorHost({
    marketBook, marketMint, marketPutBack, marketDrop,
    profBook: { state: { open: true } },
    marksBook: { state: { open: true } },
    noticeBook: {},
    showNoticeWindow: (window) => { stallHost = window.vendors; return true; },
  });
  assert.equal(openHomeVendorWindow({ vendor: VENDOR, owner: 'Eve' }), true);
  assert.equal(stallHost.mode, 'stall');
  await stallHost.settle();
  assert.deepEqual(settleCalls, [[marketMint, marketPutBack, marketDrop]]);
});

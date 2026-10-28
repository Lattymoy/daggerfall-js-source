// RPT1026-MARKET (private reports 2026-10-26) - the account service's half: ARRIVE's road alone (market.js marketRoad) and
// COLLECT-LANDED (market.js collectGood answering a landed collect's repeat). Private reports: a home trader's buyer whose
// piece came nowhere, and legendaries that went missing as they came off the market - their returns collected
// on the service. Record: SCRATCH's section for the batch's Field-Bugs page (the lead's). Through the real Worker over
// node:sqlite with every migration applied and R2 beside it (test/accountDb.mjs, test/realmSeat.mjs), from the real
// producers: a trader's piece listed from a seated record's pack, bought, taken back, run out.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `rp-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const MAP = 1001, KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = () => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'vendor' });

/** Eve's trader in Daggerfall with two pieces of her pack up at 50 gold, and Tom with 1,000 in his purse. */
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
  const pieces = items.filter((it) => (it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE) || it.group === 'Armor').slice(0, 2);
  assert.equal(pieces.length, 2, 'the loot roll gives two pieces to list');
  const eve = await seated('Eve', { items: pieces.map(plain) });
  const tom = await seated('Tom', { goldPieces: 1000 });
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
    .run(MAP, KEY, eve.id, eve.character, 'Eve', DF, _now);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`).run(MAP, KEY, PIECE, place(), _now);
  const list = async () => {
    const l = await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'item', item: validLootList([record(eve).save.items[0]])[0], pick: 0, price: 50,
      hubs: HUBS, rid: rid(), currency: 'gold', realm: eve.at(), vendor: VENDOR }, eve.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    return l.body.listing.id;
  };
  const first = await list();
  const second = await list();
  const buy = async (listing) => {
    const b = await s.call('/v1/market/buy', { character: tom.character, region: DF, listing, units: 1, max: 50, hubs: HUBS, rid: rid(), realm: tom.at(), vendor: VENDOR, landed: true }, tom.secret);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    return b.body.delivery.id;
  };
  const collect = (who, body) => s.call('/v1/market/collect', { character: who.character, ...body }, who.secret);
  const road = (who) => s.call('/v1/market/road', { character: who.character }, who.secret);
  const deliveries = (who) => raw.prepare('SELECT id, why, collected FROM market_deliveries WHERE player = ? ORDER BY at, id').all(who.id).map((d) => [d.id, d.why, Number(d.collected)]);
  return { ...s, raw, record, eve, tom, first, second, buy, collect, road, deliveries, pieces };
}

// ─── ARRIVE: THE ROAD ALONE ──────────────────────────────────────────

test('RPT1026-MARKET ARRIVE service: /v1/market/road answers what is on the way to the account - a trader\'s piece bought and never collected, arrived, its record whole - and settles the account\'s market first: a trader\'s listing past its time comes back to its seller as a delivery the road names (mutants: the road read before the settle; the route unanswered)', async () => {
  const s = await stall();
  const dn = await s.buy(s.first);
  // the press's own collect never landed: the piece waits on the service - and the road names it, ready, for Tom's character
  const r = await s.road(s.tom);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.road.map((x) => [x.kind, x.id, x.character, x.why, x.ready, x.item?.templateIndex]),
    [['item', dn, s.tom.character, 'bought', true, s.pieces[0].templateIndex]]);
  assert.equal(Number.isSafeInteger(r.body.balance), true, 'the Marks balance with it, as every market answer carries');
  // Eve's second listing runs out: the road's own settle sends it back to her as a delivery, which it then names
  s.raw.prepare('UPDATE market_listings SET expires_at = ? WHERE id = ?').run(_now - 1, s.second);
  const back = await s.road(s.eve);
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.deepEqual(back.body.road.map((x) => [x.kind, x.id, x.why, x.ready]), [['item', s.second, 'returned', true]], 'the run-out piece on its way back, arrived at once');
  assert.deepEqual({ ...s.raw.prepare('SELECT state, returned FROM market_listings WHERE id = ?').get(s.second) }, { state: 'expired', returned: 1 });
  // a body that names no character is refused as every market door refuses it
  const bad = await s.road({ ...s.tom, character: 'not a character!' });
  assert.deepEqual([bad.status, bad.body?.error], [400, 'prof-character']);
});

// ─── COLLECT-LANDED ──────────────────────────────────────────────────

test('RPT1026-MARKET COLLECT-LANDED service: a collect that landed, asked again from where the record stood before it, is answered as the repeat with the record\'s sequence and the piece - never `seq`; an older tab (no `landed`), and a record one on with no collect of the id, are still told `seq`; the piece in the record once (mutants: the collect looked up after the record; `landed` unread; one on taken for any move; the repeat without the record\'s sequence)', async () => {
  const s = await stall();
  const dn = await s.buy(s.first);
  const at0 = s.tom.at();
  const body = { delivery: dn, rid: rid(), realm: at0, landed: true };
  const first = await s.collect(s.tom, body);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual([first.body.realm, first.body.delivery, first.body.item.templateIndex], [{ seq: at0.seq + 1 }, { id: dn, why: 'bought' }, s.pieces[0].templateIndex]);
  // the answer lost: realmGoldAct asks again with the same body - the same id, the same `where`
  const again = await s.collect(s.tom, body);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual([again.body.repeat, again.body.realm, again.body.delivery, again.body.item.templateIndex],
    [true, { seq: at0.seq + 1 }, { id: dn, why: 'bought' }, s.pieces[0].templateIndex], 'the collect, landed, with the record\'s sequence and its piece');
  // an older tab abandons its session on any repeat: it is told `seq`, as before
  const older = await s.collect(s.tom, { ...body, landed: undefined });
  assert.deepEqual([older.status, older.body], [409, { error: 'seq', seq: at0.seq + 1 }]);
  // one on with no collect of this id: a move this tab never made
  const stranger = await s.collect(s.tom, { ...body, rid: rid() });
  assert.deepEqual([stranger.status, stranger.body], [409, { error: 'seq', seq: at0.seq + 1 }]);
  const rec = s.record(s.tom);
  assert.deepEqual([rec.seq, rec.save.items.length, rec.save.items[0].templateIndex], [at0.seq + 1, 1, s.pieces[0].templateIndex], 'in the record once');
  assert.deepEqual(s.deliveries(s.tom), [[dn, 'bought', 1]]);
  // two on (a move past it): no longer this collect's own move - `seq`
  s.raw.prepare('UPDATE realm_characters SET seq = seq + 1 WHERE id = ?').run(s.tom.character);
  const twoOn = await s.collect(s.tom, body);
  assert.deepEqual([twoOn.status, twoOn.body], [409, { error: 'seq', seq: at0.seq + 2 }]);
});

test('RPT1026-MARKET COLLECT-LANDED service: the retry that ran while the first asking\'s batch landed (past the record\'s first word, its own batch then refused) is answered as that collect, landed - one collect, the piece in the record once (mutants: the batch\'s catch answering `seq`)', async () => {
  const s = await stall();
  const dn = await s.buy(s.first);
  const at0 = s.tom.at();
  const body = { delivery: dn, rid: rid(), realm: at0, landed: true };
  // the retry's record is written to R2 before its batch: the first asking, still under way, lands just then
  const put = s.env.SAVES.put.bind(s.env.SAVES);
  let firstAsking = null;
  s.env.SAVES.put = async (key, text) => {
    if (!firstAsking) { firstAsking = s.collect(s.tom, body); await firstAsking; }
    return put(key, text);
  };
  const b = await s.collect(s.tom, body);
  s.env.SAVES.put = put;
  const a = await firstAsking;
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual([!!a.body.repeat, b.body.repeat, a.body.realm, b.body.realm], [false, true, { seq: at0.seq + 1 }, { seq: at0.seq + 1 }]);
  const rec = s.record(s.tom);
  assert.deepEqual([rec.seq, rec.save.items.length], [at0.seq + 1, 1], 'the piece in the record once');
});

test('RPT1026-MARKET ARRIVE service: a piece taken back off a trader is a delivery the road names to its seller and her collect takes into her record - the press\'s own collect is no longer the only door (mutants: the road\'s third read dropped)', async () => {
  const s = await stall();
  const c = await s.call('/v1/market/cancel', { character: s.eve.character, listing: s.first, rid: rid() }, s.eve.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const r = await s.road(s.eve);
  assert.deepEqual(r.body.road.map((x) => [x.kind, x.id, x.why, x.ready]), [['item', s.first, 'returned', true]]);
  const got = await s.collect(s.eve, { delivery: s.first, rid: rid(), realm: s.eve.at(), landed: true });
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.deepEqual((await s.road(s.eve)).body.road, [], 'collected: off the road');
  assert.equal(s.record(s.eve).save.items.length, 1, 'back in her record (the other piece is still listed)');
});

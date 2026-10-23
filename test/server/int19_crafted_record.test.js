// INT19 (2026-10-17, the INTEGRITY arc's lane 1, its open item - bible/06-Systems/Integrity-Arc.md section 7): A CRAFTED
// PIECE HANDED ON LEAVES ITS SELLER'S REALM RECORD. The piece route - a listing and an auction (server-account/src/
// market.js), a commission filled (writs.js) - decided on the craft's own record (`products`) alone, and the client took
// the piece out of its pack only locally: a tab that had lost its seat to a second device (it sends no checkpoint, so it
// never hears `lease`) listed a piece the live record still held, and a held character's craft listed under another
// character's name until CRAFT-HOLD asked the maker. Each crafted act now asks where the record stands first
// (realmActFirst), takes the piece out of it by its provenance in the act's own batch (server-account/src/craftedPiece.js,
// GUARDED - no act, no piece out), and its wear is the record's; a piece cancelled, expired, unsold or removed comes back
// as an `item` delivery its seller's record collects (collectGood), never a client mint; a piece sold goes to its buyer
// as the craft's record always has, the ledger's escrow let go. The client hands the piece on through the realm act
// (net/marketBook.js realmPieceAct). Driven through the real Worker over node:sqlite with every migration applied and R2
// beside it (test/accountDb.mjs, test/realmSeat.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { holdPieces, recordOf, realmJoinAt, craftedRecord, layRecord, seatRealm } from '../realmSeat.mjs';
import { takeCraftedPiece } from '../../server-account/src/craftedPiece.js';
import { createMarketBook, realmPieceAct, PIECE_GONE } from '../../src/net/marketBook.js';
import { createWritBook } from '../../src/net/writBook.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { saleTax } from '../../src/net/marketLaw.js';
import { MARKS_MAX } from '../../src/net/marksLaw.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `int19-${String(++_rid).padStart(10, '0')}`;
const wrid = () => `w${String(++_rid).padStart(15, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const PV = 'a19a19a19a19a190';
const PV2 = 'b19b19b19b19b190';

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', MODERATOR_HANDLES: 'Asynian', DEVELOPER_HANDLES: 'Lattymoy' });   // STAFF-PANEL2-FIX: a pull is a developer's
  const raw = s.env.DB._raw;
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  /** A crafted piece this account owns and made, as the anvil writes it (its maker `maker`, a character of the account). */
  const piece = (who, provenance, { quality = 2, maker = who.character, recipe = 'longsword:mithril' } = {}) => {
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', ?, 120, 5, ?, 4242, 'p1.x', ?)`).run(provenance, who.id, maker, recipe, quality, _now);
    raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
      VALUES (?, ?, ?, ?, ?, 1, ?, 4242, 10, 0, ?, 'n')`).run(who.id, `craft-${provenance}`, maker, recipe, quality, provenance, _now);
  };
  /** The ledger's row for a piece (INT4). */
  const ledger = (key) => raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(key) ?? null;
  const heldBy = (who, key) => raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, ?, ?, 1, 'held', '120:5', ?)").run(key, who.id, who.character, _now);
  const escrow = (key) => raw.prepare('SELECT char_id, item FROM piece_escrow WHERE provenance = ?').get(key) ?? null;
  const pack = (who) => (recordOf(s.env, who.character)?.items ?? []).map((it) => it.provenance).filter(Boolean);
  const list = (who, extra = {}) => s.call('/v1/market/list', { character: who.character, region: DF, kind: 'piece', provenance: PV, wear: 1000, price: 900, hubs: HUBS, rid: rid(), realm: who.at(), ...extra }, who.secret);
  return { ...s, raw, fund, piece, ledger, heldBy, escrow, pack, list };
}

test('INT19 law: the record\'s own piece - loose in the pack (never worn), else among the furnishings; none, null', () => {
  const save = { items: [{ ...craftedRecord({ provenance: PV }), equipSlot: 3 }, craftedRecord({ provenance: PV2, wear: 620 })], furnishings: [craftedRecord({ provenance: PV })] };
  assert.equal(takeCraftedPiece(save, PV2).currentCondition, 620);
  assert.deepEqual(save.items.map((it) => it.provenance), [PV], 'out of the pack');
  assert.equal(takeCraftedPiece(save, PV).provenance, PV, 'the worn one stays: the home\'s is taken');
  assert.deepEqual([save.items.length, save.furnishings.length], [1, 0]);
  assert.equal(takeCraftedPiece(save, PV), null, 'worn, and nothing else');
  assert.equal(takeCraftedPiece({}, PV), null);
});

test('INT19 service: a crafted piece lists out of its seller\'s record - the record asked first, the piece taken in the listing\'s batch, its wear the record\'s, the market holding its record and the ledger its escrow; a tab that lost its seat, or a record without it, lists nothing', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.fund(mac, 1_000);
  s.piece(mac, PV);
  // a record that does not hold it: nothing listed, nothing burnt
  const none = await s.list(mac);
  assert.deepEqual([none.status, none.body.error], [409, 'market-piece-gone']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM market_listings').get().n, 0);
  holdPieces(s.env, mac.character, [{ provenance: PV, wear: 620 }]);
  s.heldBy(mac, PV);
  // no record named - the realm's character, or another of the account's
  assert.deepEqual((await s.list(mac, { realm: undefined })).body, { error: 'realm-needed' });
  assert.deepEqual((await s.list(mac, { realm: undefined, character: 'char-mac' })).body, { error: 'realm-needed' }, 'a crafted piece lists out of a realm record alone');
  // THE EXPLOIT: a second device takes the seat; the first tab, which never hears `lease` (it sends no checkpoint), lists
  const stale = mac.at();
  await realmJoinAt(s.env, mac.secret, mac.character);
  const gone = await s.list(mac, { realm: stale });
  assert.deepEqual([gone.status, gone.body.error], [409, 'lease'], 'the record answers first - nothing listed while the live record holds the piece');
  assert.deepEqual(s.pack(mac), [PV]);
  const seq = mac.at().seq;
  const l = await s.list(mac, { wear: 1000 });
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.deepEqual([l.body.listing.wear, l.body.realm.seq, mac.at().seq], [620, seq + 1, seq + 1], 'the record\'s wear, never the tab\'s word; the record one on');
  assert.deepEqual(s.pack(mac), [], 'out of the record');
  assert.equal(JSON.parse(s.escrow(PV).item).currentCondition, 620, 'its record the market\'s to give back');
  assert.deepEqual({ ...s.ledger(PV) }, { char_id: '', state: 'escrow' }, 'the ledger holds it the market\'s');
  assert.equal((await s.list(mac)).body.error, 'market-listed', 'a piece another listing holds is said so before the record moves');
});

test('INT19 service: a listing that fails rolls the record back - nothing out of the record, no record held, the save the tab named stands; a piece another came to own between the read and the decision is refused there, the same', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 0);   // the fee it cannot pay
  s.piece(mac, PV);
  holdPieces(s.env, mac.character, [{ provenance: PV }]);
  const seq = mac.at().seq;
  const r = await s.list(mac);
  assert.deepEqual([r.status, r.body.error], [409, 'marks-short']);
  assert.deepEqual([s.pack(mac), mac.at().seq, s.escrow(PV)], [[PV], seq, null], 'GUARDED: no listing, no piece out');
  // the owner moves as the listing's batch is sent (a sale of it landing between): the decision's own guard refuses it
  s.fund(mac, 1_000);
  const prep = s.env.DB.prepare.bind(s.env.DB), batch = s.env.DB.batch.bind(s.env.DB);
  let staged = true;
  s.env.DB.prepare = (sql) => Object.assign(prep(sql), { _sql: sql });
  s.env.DB.batch = async (list) => {
    if (staged && list.some((st) => /INSERT OR IGNORE INTO market_listings/.test(st._sql ?? ''))) { staged = false; s.raw.prepare('UPDATE products SET owner = ? WHERE provenance = ?').run(ann.id, PV); }
    return batch(list);
  };
  const moved = await s.list(mac);
  s.env.DB.prepare = prep; s.env.DB.batch = batch;
  assert.equal(staged, false, 'staged');
  assert.deepEqual([moved.body.error, s.pack(mac), mac.at().seq, s.escrow(PV)], ['market-not-yours', [PV], seq, null]);
});

test('INT19 service: cancelled, expired or removed - the piece comes back as its record, a delivery its seller\'s record collects, never minted at the pack; one listed before INT19 comes back as it always did', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  const mod = await s.registered('Asynian');
  s.fund(mac, 10_000);
  s.piece(mac, PV);
  s.piece(mac, PV2);
  holdPieces(s.env, mac.character, [{ provenance: PV, wear: 700 }, { provenance: PV2 }]);
  s.heldBy(mac, PV);
  // cancelled: a delivery, no piece in the answer
  const l = await s.list(mac);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const x = await s.call('/v1/market/cancel', { character: mac.character, listing: l.body.listing.id, rid: rid() }, mac.secret);
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual([x.body.piece, x.body.delivery], [undefined, { id: l.body.listing.id }]);
  assert.equal(s.escrow(PV), null, 'the market holds its record no more - the delivery does');
  // on its way back it is elsewhere: the List form is told so, and a listing of it (a save restored past the act holds a
  // copy) is refused as the provenance delivery's was (AUDIT 31 H1: PIECE_GONE - never put back)
  const ways = (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS, pieces: [PV] }, mac.secret)).body.ways;
  assert.equal(ways[PV], 'elsewhere');
  assert.equal((await s.list(mac)).body.error, 'market-uncollected');
  const plain = await s.call('/v1/market/collect', { character: mac.character, delivery: l.body.listing.id, rid: rid() }, mac.secret);
  assert.deepEqual([plain.status, plain.body.error], [400, 'realm-needed'], 'a record\'s piece is never minted at the pack');
  const got = await s.call('/v1/market/collect', { character: mac.character, delivery: l.body.listing.id, rid: rid(), realm: mac.at() }, mac.secret);
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.deepEqual([got.body.item.provenance, got.body.item.currentCondition], [PV, 700], 'the very record that left');
  assert.deepEqual(s.pack(mac).sort(), [PV, PV2].sort(), 'back in the record');
  assert.deepEqual({ ...s.ledger(PV) }, { char_id: mac.character, state: 'held' }, 'the ledger\'s: the record\'s again');
  // expired: the seller's next read returns it the same way
  const e = await s.list(mac, { provenance: PV2 });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  _now += 73 * 3600;
  const road = (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret)).body.road;
  assert.deepEqual(road.map((d) => [d.kind, d.why, d.ready, d.item?.provenance]), [['item', 'returned', true, PV2]]);
  assert.equal(s.raw.prepare('SELECT provenance FROM market_deliveries WHERE id = ?').get(e.body.listing.id).provenance, null, 'an item delivery, no provenance one');
  // removed by a moderator: likewise
  const back = await s.call('/v1/market/collect', { character: mac.character, delivery: e.body.listing.id, rid: rid(), realm: mac.at() }, mac.secret);
  assert.equal(back.status, 200);
  const r = await s.list(mac, { provenance: PV2 });
  assert.equal((await s.call('/v1/market/remove', { listing: r.body.listing.id }, mod.secret)).status, 403, 'STAFF-PANEL2-FIX: a pull is an Admin\'s, never a Moderator\'s');
  assert.equal((await s.call('/v1/market/remove', { listing: r.body.listing.id }, (await s.registered('Lattymoy')).secret)).status, 200);
  const road2 = (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret)).body.road;
  assert.deepEqual(road2.map((d) => [d.kind, d.item?.provenance]), [['item', PV2]]);
  // a listing from before INT19 (no record held for it): a provenance delivery, as ever
  s.raw.prepare("INSERT INTO market_listings (id, seller, char_id, region, kind, provenance, units, own, bought, price, wear, fee, at, expires_at, rid, n, currency) VALUES ('oldlisting000001', ?, ?, ?, 'piece', ?, 1, 1, 0, 900, 1000, 9, ?, ?, 'old-rid-000000001', 'n', 'marks')")
    .run(mac.id, mac.character, DF, 'c19c19c19c19c190', _now, _now + 10);
  s.piece(mac, 'c19c19c19c19c190');
  s.raw.prepare("UPDATE products SET listed = 1 WHERE provenance = 'c19c19c19c19c190'").run();
  const x2 = await s.call('/v1/market/cancel', { character: mac.character, listing: 'oldlisting000001', rid: rid() }, mac.secret);
  assert.deepEqual([x2.status, x2.body.piece?.provenance, x2.body.delivery], [200, 'c19c19c19c19c190', undefined], 'minted at the pack, as it was listed');
});

test('INT19 service: a piece sold goes to its buyer as the craft\'s record always has - the market\'s record of it and the ledger\'s escrow let go, the buyer\'s first checkpoint writing it down', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 1_000);
  s.fund(ann, 5_000);
  s.piece(mac, PV);
  holdPieces(s.env, mac.character, [{ provenance: PV, wear: 620 }]);
  s.heldBy(mac, PV);
  const l = await s.list(mac);
  const b = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, max: 900, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual([b.body.piece.provenance, b.body.piece.wear], [PV, 620]);
  assert.deepEqual([s.escrow(PV), s.ledger(PV)], [null, null], 'no record held, no ledger row - the piece the service handed out');
  assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, ann.id);
});

test('INT19 service: an auction takes its Masterwork out of the record the same; unsold, or cancelled, it comes back as its record; won, the market\'s record of it goes with the sale', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  const ann = await s.registered('Ann');
  s.fund(mac, 1_000);
  s.fund(ann, 5_000);
  s.piece(mac, PV, { quality: 4 });
  s.piece(mac, PV2, { quality: 4 });
  holdPieces(s.env, mac.character, [{ provenance: PV, quality: 4, wear: 700 }, { provenance: PV2, quality: 4, where: 'home' }]);
  const auction = (extra = {}) => s.call('/v1/market/auction', { character: mac.character, region: DF, provenance: PV, wear: 1000, opening: 100, hubs: HUBS, rid: rid(), realm: mac.at(), ...extra }, mac.secret);
  assert.deepEqual((await auction({ realm: undefined })).body, { error: 'realm-needed' });
  // its decision refused (the fee it cannot pay) after the record was read: nothing out of the record - GUARDED
  s.fund(mac, 0);
  const seq = mac.at().seq;
  assert.equal((await auction()).body.error, 'marks-short');
  assert.deepEqual([s.pack(mac), mac.at().seq, s.escrow(PV)], [[PV], seq, null]);
  s.fund(mac, 1_000);
  const a = await auction();
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([s.pack(mac), !!s.escrow(PV), Number.isSafeInteger(a.body.realm?.seq), a.body.auction.wear], [[], true, true, 700], 'its wear the record\'s');
  const x = await s.call('/v1/market/cancel', { character: mac.character, listing: a.body.auction.id, rid: rid() }, mac.secret);
  assert.deepEqual([x.status, x.body.piece, x.body.delivery], [200, undefined, { id: a.body.auction.id }], 'cancelled: by its record');
  // a home's Masterwork, won
  const h = await auction({ provenance: PV2 });
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.deepEqual(recordOf(s.env, mac.character).furnishings ?? [], [], 'out of the home\'s furnishings');
  const bid = await s.call('/v1/market/bid', { character: ann.character, region: DF, auction: h.body.auction.id, amount: 100, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(bid.status, 200, JSON.stringify(bid.body));
  _now += 49 * 3600;
  await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'mine', hubs: HUBS }, ann.secret);
  assert.equal(s.raw.prepare('SELECT state FROM market_auctions WHERE id = ?').get(h.body.auction.id).state, 'sold');
  assert.equal(s.escrow(PV2), null, 'won: handed on');
});

test('INT19 service: a commission filled takes its piece out of the crafter\'s record - whole by the record\'s own word; a held record fills nothing; a piece back with its account lists though its maker is held (CRAFT-HOLD\'s cost, retired)', async () => {
  const s = await stand();
  const smith = await s.seated('Silverthorn');
  const ann = await s.registered('Ann');
  s.seedMarks(ann, 5_000);
  const note = await s.call('/v1/board/pin', { map: 1_000, subject: 'Blades made', body: 'Mithril, to order.', days: 7, button: 'commission', rid: rid() }, smith.secret);
  assert.equal(note.status, 200, JSON.stringify(note.body));
  const c = await s.call('/v1/writs/commission', { character: ann.character, region: DF, crafter: 'silverthorn', recipe: 'longsword:mithril', quality: 2, pay: 900, rid: wrid() }, ann.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  s.piece(smith, PV, { quality: 3 });
  const fulfil = (extra = {}) => s.call('/v1/writs/fulfil', { character: smith.character, region: DF, commission: c.body.commission.id, provenance: PV, wear: 1000, rid: wrid(), realm: smith.at(), ...extra }, smith.secret);
  assert.deepEqual((await fulfil({ realm: undefined })).body, { error: 'realm-needed' });
  assert.deepEqual((await fulfil({ realm: undefined, character: 'char-silverthorn' })).body, { error: 'realm-needed' }, 'a character with no record fills nothing');
  assert.equal((await fulfil()).body.error, 'market-piece-gone', 'the record holds no such piece');
  holdPieces(s.env, smith.character, [{ provenance: PV, wear: 990 }]);
  assert.equal((await fulfil()).body.error, 'commission-worn', 'worn by its record, whatever the tab says');
  const save = recordOf(s.env, smith.character);
  save.items.find((it) => it.provenance === PV).currentCondition = 1000;
  layRecord(s.env, smith.character, save);
  s.raw.prepare("UPDATE realm_characters SET held = 'staff' WHERE id = ?").run(smith.character);
  assert.equal((await fulfil()).body.error, 'trade-held', 'a held record hands nothing on');
  s.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(smith.character);
  // a fill its decision refuses after the record was read (the crafter's Marks cap) takes nothing out of it - GUARDED
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(smith.id, MARKS_MAX);
  const seq = smith.at().seq;
  assert.equal((await fulfil()).body.error, 'marks-full');
  assert.deepEqual([s.pack(smith), smith.at().seq], [[PV], seq], 'the record as it stood');
  s.raw.prepare('UPDATE marks SET balance = 0 WHERE account = ?').run(smith.id);
  const f = await fulfil();
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual([f.body.commission.state, s.pack(smith), Number.isSafeInteger(f.body.realm?.seq)], ['filled', [], true]);
  assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, ann.id);
  assert.equal(Number(s.raw.prepare('SELECT balance FROM marks WHERE account = ?').get(smith.id).balance), 900 - saleTax(900));
  // CRAFT-HOLD's cost retired: a piece of a held maker's make, back with its account in another character's record, lists
  const mac = await s.seated('Mac');
  s.fund(mac, 1_000);
  s.piece(mac, PV2);   // made by Mac's first character...
  const second = await seatRealm(s.env, mac.secret, 'Second');   // ...and held by the account's second, now played
  s.raw.prepare("UPDATE realm_characters SET held = 'staff' WHERE id = ?").run(mac.character);
  holdPieces(s.env, second.id, [{ provenance: PV2 }]);
  const l = await s.list({ ...mac, character: second.id, at: second.at }, { provenance: PV2 });
  assert.equal(l.status, 200, JSON.stringify(l.body));
});

test('INT19 client: a crafted piece is handed on through the realm act - the record named, the piece out of the save inside the hold, back on a refusal, never on one that says it is elsewhere; no realm, no act; the words are there', async () => {
  const calls = [];
  const realm = { act: async (o) => { const undo = o.reserve?.(); const r = await o.call({ id: 'r00000000000000000001', lease: 'L'.repeat(32), seq: 4 }); if (!r?.ok) undo?.(); return r; } };
  let held = true;
  const piece = () => ({ item: { provenance: PV }, where: 'pack', take: () => { const was = held; held = false; return was; }, putBack: () => { held = true; } });
  // refused: put back
  let answer = { ok: false, error: 'market-piece-gone', status: 409 };
  const r1 = await realmPieceAct(realm, piece(), async (at) => { calls.push(at); return answer; });
  assert.deepEqual([r1.error, held, calls[0].seq], ['market-piece-gone', true, 4]);
  // elsewhere: the save's was a copy - not put back
  for (const e of PIECE_GONE) {
    held = true;
    answer = { ok: false, error: e, status: 409 };
    await realmPieceAct(realm, piece(), async () => answer);
    assert.equal(held, false, `${e}: never put back`);
  }
  // the save would not give it up: nothing asked
  held = false;
  let asked = 0;
  assert.equal((await realmPieceAct(realm, piece(), async () => { asked++; return { ok: true }; })).error, 'piece-held');
  assert.equal(asked, 0);
  // the market's book: the record rides the body; no realm, no act
  const sent = [];
  const door = { account: () => 'acct', list: async (b) => { sent.push(b); return { ok: true, data: { listing: { id: 'x' } } }; }, auction: async (b) => { sent.push(b); return { ok: true, data: {} }; } };
  held = true;
  const book = createMarketBook({ door, character: () => 'r00000000000000000001', realm });
  assert.equal((await book.list({ region: DF, kind: 'piece', provenance: PV, wear: 1000, price: 9 }, piece())).ok, true);
  assert.deepEqual([sent[0].realm.seq, held, book._kept().lists.length], [4, false, 0], 'nothing kept: the record is the truth');
  held = true;
  assert.equal((await book.auction({ region: DF, provenance: PV, wear: 1000, opening: 9 }, piece())).ok, true);
  assert.equal(sent[1].realm.lease, 'L'.repeat(32));
  const none = createMarketBook({ door, character: () => 'char-x', realm: null });
  assert.equal((await none.list({ region: DF, kind: 'piece', provenance: PV, wear: 1000, price: 9 }, piece())).error, 'realm-needed');
  assert.equal(book.realm, realm, 'the writs\' book is handed it');
  // the writs' book
  const fills = [];
  const writs = createWritBook({ door: { account: () => 'acct', fulfil: async (b) => { fills.push(b); return { ok: true, data: { commission: {} } }; } }, character: () => 'r00000000000000000001', realm });
  held = true;
  assert.equal((await writs.fulfil({ region: DF, commission: 'c', provenance: PV, wear: 1000 }, piece())).ok, true);
  assert.deepEqual([fills[0].realm.seq, held, writs._kept().length], [4, false, 0]);
  const noRealm = createWritBook({ door: { account: () => 'acct', fulfil: async () => ({ ok: true }) }, character: () => 'char-x' });
  assert.equal((await noRealm.fulfil({ region: DF, commission: 'c', provenance: PV, wear: 1000 }, piece())).error, 'realm-needed');
  assert.equal(typeof REFUSALS['market-piece-gone'], 'string');
});

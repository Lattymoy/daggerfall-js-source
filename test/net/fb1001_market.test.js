// FIELD BUGS 2026-10-01 #2 - MARKET-KEEP: "The market doesn't allow you to list any item that isnt bound, also it's
// bugged". A crafted piece another player handed over - a realm trade moves the piece between the two saves and never
// the product's owner (Professions-Arc 18's hand-over is unbuilt), and a shop's shelf, a room's container and a looted
// body hand one on without the service at all - was taken out of its holder's pack when they pressed List, the service
// said "not yours to sell" (its record names its maker), and the market book never put it back: AUDIT 31 H1 read every
// `market-not-yours` as "the save's piece is a copy". It was their only one, gone. The same for a commission's Fill
// (net/writBook.js shares the list). Driven through the real Worker over node:sqlite (test/accountDb.mjs), the piece
// made at the real anvil (net/profBook.js craft, systems/smithItems.js mintPieces) and handed on by the realm trade's
// own law (net/realm/realmTradeLaw.js settleRealmTrade - the service settles with it).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { accountProf, accountMarket, SESSION_KEY, accountRefusalText } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { createMarketBook, PIECE_GONE } from '../../src/net/marketBook.js';
import { createWritBook } from '../../src/net/writBook.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { wearOf } from '../../src/net/marketLaw.js';
import { mintPieces } from '../../src/systems/smithItems.js';
import { settleRealmTrade } from '../../src/net/realm/realmTradeLaw.js';
import { pinRealmAct, holdPieces } from '../realmSeat.mjs';   // INT19: a crafted piece is handed on through the realm act
import { MARKET_KEPT_KEY } from '../../src/net/marketBook.js';
import { WRIT_KEPT_KEY } from '../../src/net/writBook.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });
const DF = 17;

/** Mac makes a Mithril Longsword at the anvil and hands it to Ann in a realm trade (for 100 gold): the piece is Ann's,
 *  its maker's record still Mac's. */
async function handedOn() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');   // INT16 (Integrity-Arc section 7): a craft is the account's seated realm character's
  const ann = await s.seated('Ann');   // INT19: and a crafted piece lists out of a realm record - Ann's, which the trade moved it into
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(55));
  for (const [m, n] of [['ingot:mithril', 3], ['metal:copper', 1], ['leather:cured', 1]]) {
    raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
  }
  s.seedMarks(ann, 100);
  const prof = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => mac.character, sleep: noWait });
  await prof.refresh();
  const macPack = [];
  assert.equal((await prof.craft('longsword:mithril', { clean: true, name: 'Silverthorn' }, (d) => macPack.push(...mintPieces(d)))).ok, true, 'made');
  const offer = JSON.parse(JSON.stringify(macPack[0]));
  const t = settleRealmTrade({ items: macPack, goldPieces: 0 }, { items: [], goldPieces: 500 },
    { give: { items: [offer], gold: 0 }, get: { items: [], gold: 100 }, pick: [0] }, { give: { items: [], gold: 100 }, get: { items: [offer], gold: 0 }, pick: [] });
  assert.equal(t.ok, true, 'traded');
  const pack = [...t.toB.items];
  assert.equal(raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(pack[0].provenance).owner, mac.id, 'its maker\'s record is still Mac\'s');
  holdPieces(s.env, ann.character, [{ provenance: pack[0].provenance, wear: wearOf(pack[0]) }]);   // the trade's piece in Ann's record
  return { s, mac, ann, pack };
}
const pieceOf = (pack) => ({ item: pack[0], where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) });

test('MARKET-KEEP: a crafted piece handed on in a trade, listed by its new holder, stays in their pack when the service says its record names another - said in words that keep it (mutants: not-yours read as gone again; the words)', async () => {
  const { s, ann, pack } = await handedOn();
  const sword = pack[0];
  const book = createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) }), storage: memStorage(), character: () => ann.character, sleep: noWait,
    realm: pinRealmAct(s.env, ann.character) });   // PIN MOVED (INT19): through the realm act
  const r = await book.list({ region: DF, kind: 'piece', provenance: sword.provenance, wear: wearOf(sword), price: 50, hubs: {} }, pieceOf(pack));
  assert.equal(r.error, 'market-not-yours', 'the service\'s own word');
  assert.deepEqual(pack, [sword], 'the very piece back in the pack - it was taken out and never put back');
  assert.equal(book.pending, 0, 'nothing kept');
  assert.match(accountRefusalText('market-not-yours'), /only they can list it as a crafted piece\. It stays in your pack/);
  assert.equal(PIECE_GONE.includes('market-not-yours'), false);
  assert.deepEqual([...PIECE_GONE].sort(), ['market-listed', 'market-standing', 'market-uncollected'], 'the answers that do say it is elsewhere ON THE SERVICE');
});

// PIN MOVED (INT19, Integrity-Arc section 7): a crafted piece is listed through the realm act now, and nothing of it is kept
// (the record is the truth: silence ends the session, and a join reads it) - the kept list is a tab's from before, its
// piece taken out of the pack and its answer never heard, which the settle still asks again with its own id
test('MARKET-KEEP: a listing kept through silence and asked again by a settle, answered not-yours, is put back - never dropped from the save (mutant: the settle drops it)', async () => {
  const { s, ann, pack } = await handedOn();
  const sword = pack.splice(0, 1)[0];   // taken out of the pack as the old book took it, and kept
  // the service a tab from before INT19 asked: a record naming another (the realm's own answers a kept list with no
  // record `realm-needed`, put back the same)
  const door = { ...accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) }), list: async () => ({ ok: false, error: 'market-not-yours', status: 409 }) };
  const storage = memStorage();
  const body = { character: ann.character, region: DF, kind: 'piece', provenance: sword.provenance, wear: wearOf(sword), price: 50, hubs: {}, rid: 'kmarketkeep00001' };
  storage.setItem(MARKET_KEPT_KEY, JSON.stringify({ [`${ann.id}|${ann.character}`]: { lists: [{ rid: body.rid, body, item: sword, where: 'pack' }] } }));
  const book = createMarketBook({ door, storage, character: () => ann.character, sleep: noWait, realm: pinRealmAct(s.env, ann.character) });
  assert.deepEqual([pack.length, book.pending], [0, 1], 'kept, out of the pack');
  const dropped = [];
  const st = await book.settle(() => {}, (it) => pack.push(it), (it) => dropped.push(it));
  assert.deepEqual([st.settled, book.pending, dropped.length], [1, 0, 0]);
  assert.equal(pack.length, 1, 'back in the pack');
  assert.equal(pack[0].provenance, sword.provenance);
});

test('MARKET-KEEP: a commission filled with a piece whose record names another is put back too - the writs\' book reads the same list (mutant: the writs keep their own list with not-yours)', async () => {
  const pack = [{ provenance: 'c0ffee00c0ffee01', name: 'sword' }];
  const door = { account: () => 'acct-1', fulfil: async () => ({ ok: false, error: 'market-not-yours', status: 409 }) };
  const passing = { act: async ({ reserve, call }) => { const undo = reserve?.(); const r = await call({ id: 'r00000000000000000001', lease: 'l', seq: 1 }); if (!r?.ok) undo?.(); return r; } };
  const writs = createWritBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait, realm: passing });   // PIN MOVED (INT19): through the realm act
  const r = await writs.fulfil({ region: DF, commission: 'c1', provenance: pack[0].provenance, wear: 1000 }, pieceOf(pack));
  assert.deepEqual([r.ok, r.error, pack.length, writs.pending], [false, 'market-not-yours', 1, 0]);
  // and a settle's: a fill a tab from before kept on silence (INT19: none is kept now), answered not-yours, put back
  const storage = memStorage();
  const door2 = { account: () => 'acct-1', fulfil: async () => ({ ok: false, error: 'market-not-yours', status: 409 }) };
  const p2 = [];
  const axe = { provenance: 'c0ffee00c0ffee02', name: 'axe' };
  storage.setItem(WRIT_KEPT_KEY, JSON.stringify({ 'acct-1|char-a': { fulfils: [{ rid: 'wmarketkeep00002', body: { character: 'char-a', region: DF, commission: 'c2', provenance: axe.provenance, wear: 1000, rid: 'wmarketkeep00002' }, item: axe, where: 'pack' }] } }));
  const w2 = createWritBook({ door: door2, storage, character: () => 'char-a', sleep: noWait, realm: passing });
  assert.equal(w2.pending, 1, 'kept by the tab from before');
  const dropped = [];
  await w2.settle((it) => p2.push(it), (it) => dropped.push(it));
  assert.deepEqual([p2.length, dropped.length, w2.pending], [1, 0, 0]);
});

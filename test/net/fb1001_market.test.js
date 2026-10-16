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
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
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
  return { s, mac, ann, pack };
}
const pieceOf = (pack) => ({ item: pack[0], where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) });

test('MARKET-KEEP: a crafted piece handed on in a trade, listed by its new holder, stays in their pack when the service says its record names another - said in words that keep it (mutants: not-yours read as gone again; the words)', async () => {
  const { s, ann, pack } = await handedOn();
  const sword = pack[0];
  const book = createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) }), storage: memStorage(), character: () => ann.character, sleep: noWait });
  const r = await book.list({ region: DF, kind: 'piece', provenance: sword.provenance, wear: wearOf(sword), price: 50, hubs: {} }, pieceOf(pack));
  assert.equal(r.error, 'market-not-yours', 'the service\'s own word');
  assert.deepEqual(pack, [sword], 'the very piece back in the pack - it was taken out and never put back');
  assert.equal(book.pending, 0, 'nothing kept');
  assert.match(accountRefusalText('market-not-yours'), /only they can sell it at the counting-house\. It stays in your pack/);
  assert.equal(PIECE_GONE.includes('market-not-yours'), false);
  assert.deepEqual([...PIECE_GONE].sort(), ['market-listed', 'market-standing', 'market-uncollected'], 'the answers that do say it is elsewhere ON THE SERVICE');
});

test('MARKET-KEEP: a listing kept through silence and asked again by a settle, answered not-yours, is put back - never dropped from the save (mutant: the settle drops it)', async () => {
  const { s, ann, pack } = await handedOn();
  const sword = pack[0];
  const door = accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) });
  let up = false;
  const list = door.list;
  door.list = async (b) => (up ? list(b) : { ok: false, error: 'offline' });
  const storage = memStorage();
  const book = createMarketBook({ door, storage, character: () => ann.character, sleep: noWait });
  const k = await book.list({ region: DF, kind: 'piece', provenance: sword.provenance, wear: wearOf(sword), price: 50, hubs: {} }, pieceOf(pack));
  assert.deepEqual([k.kept, pack.length, book.pending], [true, 0, 1], 'kept on silence, out of the pack');
  up = true;
  const dropped = [];
  const st = await book.settle(() => {}, (it) => pack.push(it), (it) => dropped.push(it));
  assert.deepEqual([st.settled, book.pending, dropped.length], [1, 0, 0]);
  assert.equal(pack.length, 1, 'back in the pack');
  assert.equal(pack[0].provenance, sword.provenance);
});

test('MARKET-KEEP: a commission filled with a piece whose record names another is put back too - the writs\' book reads the same list (mutant: the writs keep their own list with not-yours)', async () => {
  const pack = [{ provenance: 'c0ffee00c0ffee01', name: 'sword' }];
  const door = { account: () => 'acct-1', fulfil: async () => ({ ok: false, error: 'market-not-yours', status: 409 }) };
  const writs = createWritBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait });
  const r = await writs.fulfil({ region: DF, commission: 'c1', provenance: pack[0].provenance, wear: 1000 }, pieceOf(pack));
  assert.deepEqual([r.ok, r.error, pack.length, writs.pending], [false, 'market-not-yours', 1, 0]);
  // and a settle's: kept on silence, answered not-yours, put back
  const storage = memStorage();
  let up = false;
  const door2 = { account: () => 'acct-1', fulfil: async () => (up ? { ok: false, error: 'market-not-yours', status: 409 } : { ok: false, error: 'offline' }) };
  const w2 = createWritBook({ door: door2, storage, character: () => 'char-a', sleep: noWait });
  const p2 = [{ provenance: 'c0ffee00c0ffee02', name: 'axe' }];
  assert.equal((await w2.fulfil({ region: DF, commission: 'c2', provenance: p2[0].provenance, wear: 1000 }, pieceOf(p2))).kept, true);
  up = true;
  const dropped = [];
  await w2.settle((it) => p2.push(it), (it) => dropped.push(it));
  assert.deepEqual([p2.length, dropped.length, w2.pending], [1, 0, 0]);
});

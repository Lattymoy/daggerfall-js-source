// AUDIT 31 (2026-09-29, Mac: "let's first do a comprehensive audit and ensure everything so far is perfect") - THE
// MARKET'S AND THE WRITS' BOOKS AND THEIR HOSTS, AUDITED: no piece taken with no account to keep it under (B1); a kept
// act's slot the one it was pressed in (B2); an act's id its slot's (B4); a writ act's balance told to the market's
// book and its reads let go (B5); the Work list per slot and in order (B7); the auction words that move a view (B8);
// a settle asked while an act is out waits for it (B10); a piece one book keeps never taken by the other, and a piece
// the service says is elsewhere never put back (H1); the guild Stores read at each look, a refused read said with Try
// again, and a member's own deposit taken back (H2, R1, U8); every list a piece can lie in (H5); a piece's recipe
// stamped at its mint (H3); worn is never whole (H9). bible/06-Systems/Online-Arc.md "AUDIT 31".
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from '../chargenDom.mjs';
import { createWritBook, WRIT_KEPT_KEY } from '../../src/net/writBook.js';
import { createMarketBook, MARKET_MOVED, PIECE_GONE, PIECE_KEPT_ERROR, MARKET_KEPT_KEY } from '../../src/net/marketBook.js';
import { realmActOver } from '../realmSeat.mjs';   // INT19: a crafted piece is handed on through the realm act
import { createProfBook } from '../../src/net/profBook.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { wearOf, WEAR_WHOLE } from '../../src/net/marketLaw.js';
import { mintPiece, pieceOfRecipe } from '../../src/systems/smithItems.js';
import { isDeclaredItemField, validItemField } from '../../src/systems/item/itemFields.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { createSocialPanel } from '../../src/ui/socialPanel.js';
import { SocialState } from '../../src/net/social.js';
import { GUILD_RANK_NAMES } from '../../src/net/guild/guildLaw.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const PV = 'c0ffee00c0ffee01';
const OAK = 'log:oak';
const REQ = { region: 17, kind: 'piece', provenance: PV, wear: 1000, price: 500 };
const FILL = { region: 17, commission: 'c1', provenance: PV, wear: 1000 };
/** INT19: the realm act a realm character's book hands a crafted piece on through (net/marketBook.js realmPieceAct). */
const REALM = realmActOver(() => ({ id: 'r00000000000000000004', lease: 'L'.repeat(32), seq: 5 }));
/** INT19: a kept act on PV from a tab before INT19 (a new press keeps none: the record is the truth) - the market's list
 *  (`MARKET_KEPT_KEY`) or the writs' fill (`WRIT_KEPT_KEY`), `who`'s. */
const keptFrom = (kind, who = 'char-a', rid = kind === 'list' ? 'kauditthirtyone1' : 'wauditthirtyone1') => (kind === 'list'
  ? JSON.stringify({ [`acct-1|${who}`]: { lists: [{ rid, body: { character: who, ...REQ, rid }, item: { provenance: PV, name: 'sword' }, where: 'pack' }] } })
  : JSON.stringify({ [`acct-1|${who}`]: { fulfils: [{ rid, body: { character: who, ...FILL, rid }, item: { provenance: PV, name: 'sword' }, where: 'pack' }] } }));

/** A save's pack, its take and its put back - the host's (world.js marketTake, marketPutBack). */
function packOf() {
  const pack = [{ provenance: PV, name: 'sword' }];
  const item = pack[0];
  return { pack, item, piece: { item, where: 'pack', take: () => { const i = pack.indexOf(item); if (i < 0) return false; pack.splice(i, 1); return true; }, putBack: (it) => pack.push(it) } };
}

test('AUDIT 31 B1: with no account signed in, nothing is taken - a listing, an auction, a buy and a commission\'s fill are refused `no-session` before the piece leaves the save, and nothing is kept under no one\'s slot', async () => {
  const storage = memStorage();
  const door = { account: () => null, list: async () => ({ ok: false, error: 'no-session' }), auction: async () => ({ ok: false, error: 'no-session' }),
    buy: async () => ({ ok: false, error: 'no-session' }), fulfil: async () => ({ ok: false, error: 'no-session' }) };
  const market = createMarketBook({ door, storage, character: () => 'char-a', sleep: noWait });
  const writs = createWritBook({ door, storage, character: () => 'char-a', sleep: noWait });
  const { pack, piece } = packOf();
  for (const r of [await market.list(REQ, piece), await market.auction({ ...REQ, opening: 100 }, piece), await market.buy({ listing: 'L1', units: 1, max: 5 }, () => {}),
    await writs.fulfil(FILL, piece)]) {
    assert.deepEqual([r.ok, r.error, r.kept], [false, 'no-session', undefined]);
  }
  assert.equal(pack.length, 1, 'the piece never left the pack');
  assert.equal(storage.getItem('prof5.kept'), null);
  assert.equal(storage.getItem('prof6.kept'), null);
  // AUDIT 31 H8: a save that will not give a piece up (equipped, locked) - its own word, never "only a crafted piece lists"
  const signed = { ...door, account: () => 'acct-1' };
  const held = { ...piece, take: () => false };
  assert.equal((await createMarketBook({ door: signed, storage, character: () => 'char-a', sleep: noWait, realm: REALM }).list(REQ, held)).error, 'piece-held');
  assert.equal((await createWritBook({ door: signed, storage, character: () => 'char-a', sleep: noWait, realm: REALM }).fulfil(FILL, held)).error, 'piece-held');
  assert.ok(REFUSALS['piece-held']);
});

// PIN MOVED (INT19, Integrity-Arc section 7): a fill goes through the realm act, which holds the record for its length and
// keeps nothing - the slot law is the kept fills' a tab from before INT19 left, each settled in its own character alone
test('AUDIT 31 B2: a kept act is its press\'s slot\'s - a refusal heard after a quick-load to another character is never put back into that one; the first character\'s settle answers it', async () => {
  const storage = memStorage();
  storage.setItem(WRIT_KEPT_KEY, keptFrom('fill', 'char-a'));
  let who = 'char-b';   // the quick-load: another character's save
  const answer = { ok: false, error: 'commission-piece' };
  const asked = [];
  const door = { account: () => 'acct-1', fulfil: async (b) => { asked.push(b.character); return answer; } };
  const writs = createWritBook({ door, storage, character: () => who, sleep: noWait, realm: REALM });
  const other = [], back = [];
  await writs.settle((it) => other.push(it), () => {});
  assert.deepEqual([writs._kept().length, other.length, asked.length], [0, 0, 0], 'char-b keeps nothing, asks nothing, is given nothing');
  who = 'char-a';
  assert.equal(writs._kept().length, 1, 'char-a keeps its fill');
  await writs.settle((it) => back.push(it), () => {});
  assert.deepEqual([back.length, writs._kept().length, asked], [1, 0, ['char-a']], 'put back once, into its own character, on its own settle');
});

test('AUDIT 31 B4: an act\'s id is its slot\'s - the same act pressed by another character is a new request, never the first one\'s repeat', async () => {
  let who = 'char-a';
  const rids = [];
  const door = { account: () => 'acct-1', supply: async (b) => { rids.push(b.rid); return { ok: false, error: 'offline' }; }, bid: async (b) => { rids.push(b.rid); return { ok: false, error: 'offline' }; } };
  const writs = createWritBook({ door, storage: memStorage(), character: () => who, sleep: noWait });
  const market = createMarketBook({ door, storage: memStorage(), character: () => who, sleep: noWait });
  await writs.supply({ region: 17, writ: 'w1', units: 5 });
  who = 'char-b';
  await writs.supply({ region: 17, writ: 'w1', units: 5 });
  assert.notEqual(rids[0], rids.at(-1));
  who = 'char-a';
  await writs.supply({ region: 17, writ: 'w1', units: 5 });
  assert.equal(rids.at(-1), rids[0], 'char-a\'s press asked again is char-a\'s one request');
  rids.length = 0;
  await market.bid({ region: 17, auction: 'a1', amount: 100 });
  who = 'char-b';
  await market.bid({ region: 17, auction: 'a1', amount: 100 });
  assert.notEqual(rids[0], rids.at(-1));
});

test('AUDIT 31 B5: a writ act that moves Marks tells the market\'s book the balance and lets its reads go - a market read begun before it is read again, never painting the older balance', async () => {
  const told = [];
  let forgot = 0;
  const door = { account: () => 'acct-1', supply: async () => ({ ok: true, data: { balance: 777, fill: {} } }), guildStores: async () => ({ ok: true, data: { rows: [], moves: [], balance: 5 } }) };
  const writs = createWritBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait, market: { told: (n) => told.push(n), forget: () => { forgot++; } } });
  await writs.supply({ region: 17, writ: 'w1', units: 5 });
  assert.deepEqual([told, forgot], [[777], 1]);
  // the market book's own: a read begun before an act's answer is overtaken by it
  let release;
  const reads = [];
  const mdoor = { account: () => 'acct-1', read: async () => { reads.push(1); if (reads.length === 1) await new Promise((r) => { release = r; }); return { ok: true, data: { balance: reads.length === 1 ? 100 : 777 } }; } };
  const market = createMarketBook({ door: mdoor, storage: memStorage(), character: () => 'char-a', sleep: noWait });
  const pending = market.read('mine', { region: 17 });
  await tick();
  market.forget();   // the writ act's answer, heard
  release();
  const r = await pending;
  assert.deepEqual([r.data.balance, market.state.balance, reads.length], [777, 777, 2], 'read again, the newer balance');
});

test('AUDIT 31 B7: the Work list is kept per account and character, and a read begun before an act the list shows is read again', async () => {
  let who = 'char-a', release = null;
  const asked = [];
  const door = {
    account: () => 'acct-1',
    writs: async (c) => { asked.push(c); if (release === false) await new Promise((r) => { release = r; }); return { ok: true, data: { writs: [], who: c, n: asked.length } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => who, sleep: noWait });
  assert.equal((await book.writs(17)).data.who, 'char-a');
  who = 'char-b';
  assert.equal((await book.writs(17)).data.who, 'char-b', 'never char-a\'s minute of cache');
  release = false;
  const pending = book.writs(17, { force: true });
  await tick();
  book.forgetWrits();   // a guild writ posted, answered
  release();
  const r = await pending;
  assert.equal(r.data.n, asked.length, 'the read after the act');
  assert.ok(asked.length >= 4);
});

test('AUDIT 31 B8: a bid that leads already, a bid standing on one\'s own auction and a bid overtaken as it was decided each let the market\'s view go', () => {
  for (const w of ['auction-low', 'auction-leading', 'auction-bid-standing', 'auction-moved', 'market-gone']) assert.ok(MARKET_MOVED.includes(w), w);
  assert.match(src('src/ui/marketTab.js'), /const MOVED = MARKET_MOVED;/, 'the tab reads the book\'s one list');
});

test('AUDIT 31 B10: a settle asked while another act is out waits for it and runs - never refused `writ-busy` and left unasked', async () => {
  let release;
  const door = {
    account: () => 'acct-1',
    supply: async () => { await new Promise((r) => { release = r; }); return { ok: true, data: {} }; },
    fulfil: async () => ({ ok: true, data: {} }),
  };
  const storage = memStorage();
  storage.setItem('prof6.kept', JSON.stringify({ 'acct-1|char-a': { fulfils: [{ rid: 'wabcdefghijklmno', body: FILL, item: { provenance: PV }, where: 'pack' }] } }));
  const writs = createWritBook({ door, storage, character: () => 'char-a', sleep: noWait });
  const act = writs.supply({ region: 17, writ: 'w1', units: 5 });
  const dropped = [];
  const settle = writs.settle(() => {}, (it) => dropped.push(it));
  await tick();
  release();
  await act;
  const s = await settle;
  assert.deepEqual([s.ok, s.settled, dropped.length], [true, 1, 1]);
  // the market's book the same
  let mrelease;
  const mdoor = { account: () => 'acct-1', bid: async () => { await new Promise((r) => { mrelease = r; }); return { ok: true, data: {} }; }, list: async () => ({ ok: true, data: {} }) };
  const mstore = memStorage();
  mstore.setItem('prof5.kept', JSON.stringify({ 'acct-1|char-a': { lists: [{ rid: 'kabcdefghijklmno', body: REQ, item: { provenance: PV }, where: 'pack' }], buys: [], cancels: [], collects: [] } }));
  const market = createMarketBook({ door: mdoor, storage: mstore, character: () => 'char-a', sleep: noWait });
  const bid = market.bid({ region: 17, auction: 'a1', amount: 5 });
  const mdropped = [];
  const msettle = market.settle(() => {}, () => {}, (it) => mdropped.push(it));
  await tick();
  mrelease();
  await bid;
  assert.deepEqual([(await msettle).settled, mdropped.length], [1, 1]);
  assert.match(src('src/ui/noticeWindow.js'), /b\.disabled = busy \|\| workBusy \|\| held < w\.qty \|\| full;/, 'nor a Court writ taken while a guild writ\'s act is out');
});

test('AUDIT 31 H1: a piece one book keeps an act on is never taken by the other; a piece the service says is elsewhere is never put back - and a settle takes the save\'s copy out', async () => {
  const storage = memStorage();
  let up = false;
  const door = {
    account: () => 'acct-1',
    // PIN MOVED (FIELD BUGS 2026-10-01, MARKET-KEEP): the piece stands LISTED elsewhere - a record naming another owner
    // is no proof the save's piece is a copy (a trade hands a crafted piece on and never its record), so it is put back
    list: async () => (up ? { ok: false, error: 'market-listed' } : { ok: false, error: 'offline' }),
    fulfil: async () => ({ ok: true, data: {} }),
  };
  // PIN MOVED (INT19): the books keep no new act on a piece (the record is the truth) - the kept list here is a tab's from
  // before INT19, whose piece came back into the pack when the save was restored (the tab died before it was kept)
  storage.setItem(MARKET_KEPT_KEY, keptFrom('list'));
  let writs = null;
  const market = createMarketBook({ door, storage, character: () => 'char-a', sleep: noWait, holds: (pv) => !!writs?.holdsPiece(pv), realm: REALM });
  writs = createWritBook({ door, storage, character: () => 'char-a', sleep: noWait, holds: (pv) => market.holdsPiece(pv), realm: REALM });
  const { pack, piece } = packOf();
  assert.equal(market.holdsPiece(PV), true);
  const f = await writs.fulfil(FILL, piece);
  assert.deepEqual([f.ok, f.error, pack.length], [false, PIECE_KEPT_ERROR, 1], 'the writs\' book will not take a piece the market keeps');
  assert.equal((await market.list({ ...REQ, price: 400 }, piece)).error, PIECE_KEPT_ERROR, 'nor the market twice');
  // the market settles: the service says the piece is listed already - the save's copy out, never back in
  up = true;
  // the host's drop, by provenance (world.js marketDrop) - the kept entry's item is its stored copy
  await market.settle(() => {}, (it) => pack.push(it), (it) => { const i = pack.findIndex((x) => x.provenance === it.provenance); if (i >= 0) pack.splice(i, 1); });
  assert.deepEqual([pack.length, market.pending], [0, 0]);
  // at once: a refusal that says it is elsewhere puts nothing back
  const fresh = packOf();
  const once = await createMarketBook({ door, storage: memStorage(), character: () => 'char-a', sleep: noWait, realm: REALM }).list(REQ, fresh.piece);
  assert.deepEqual([once.error, fresh.pack.length], ['market-listed', 0], 'through the realm act too');
  // and the other way: a fill the writs' book keeps (a tab's from before INT19), never listed
  const wstore = memStorage();
  wstore.setItem(WRIT_KEPT_KEY, keptFrom('fill'));
  const wdoor = { account: () => 'acct-1', fulfil: async () => ({ ok: false, error: 'offline' }), list: async () => ({ ok: true, data: {} }) };
  let m2 = null;
  const w2 = createWritBook({ door: wdoor, storage: wstore, character: () => 'char-a', sleep: noWait, holds: (pv) => !!m2?.holdsPiece(pv), realm: REALM });
  m2 = createMarketBook({ door: wdoor, storage: wstore, character: () => 'char-a', sleep: noWait, holds: (pv) => w2.holdsPiece(pv), realm: REALM });
  const two = packOf();
  assert.equal(w2.holdsPiece(PV), true);
  assert.equal((await m2.list(REQ, two.piece)).error, PIECE_KEPT_ERROR, 'the market will not list a piece the writs\' book keeps');
  // the writs' settle: a piece the service says is listed elsewhere is dropped from the save, never put back
  wdoor.fulfil = async () => ({ ok: false, error: 'market-listed' });
  const back = [];
  await w2.settle((it) => back.push(it), (it) => { const i = two.pack.findIndex((x) => x.provenance === it.provenance); if (i >= 0) two.pack.splice(i, 1); });
  assert.deepEqual([back.length, two.pack.length, w2.pending], [0, 0, 0]);
  assert.deepEqual([...PIECE_GONE].sort(), ['market-listed', 'market-standing', 'market-uncollected']);   // PIN MOVED (MARKET-KEEP): never 'market-not-yours'
  const w = src('src/scenes/world.js');
  assert.match(w, /holds: \(pv\) => !!writBook\?\.holdsPiece\(pv\)/);
  assert.match(w, /holds: \(pv\) => !!marketBook\?\.holdsPiece\(pv\)/);
  assert.match(w, /const pieceKept = \(pv\) => !!marketBook\?\.holdsPiece\(pv\) \|\| !!writBook\?\.holdsPiece\(pv\);/);
  assert.ok(REFUSALS[PIECE_KEPT_ERROR] && REFUSALS['market-no-record']);
});

test('AUDIT 31 H5: every list a crafted piece can lie in - the pack, the home\'s things, the wagon, a repairer\'s hands - is minted, put back and dropped by its provenance', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const pieceLists = \(\) => \[playerEntity\.items, playerEntity\.furnishings, playerEntity\.wagonItems, playerEntity\.otherItems\]\.filter\(Array\.isArray\);/);
  assert.match(w, /for \(const list of pieceLists\(\)\) \{   \/\/ AUDIT 31 H5/);
  assert.match(w, /const marketPutBack = \(item, where\) => \{\n\s*if \(!item\?\.provenance\) return;\n\s*if \(heldProvenances\(\)\.has\(item\.provenance\)\) return;/);
  assert.match(w, /const have = heldProvenances\(\);   \/\/ AUDIT 31 H5/);
});

test('AUDIT 31 H3, H9: a crafted piece keeps the recipe it was minted of - an Ebony piece is never a Warforged one\'s; worn by a point is never whole', () => {
  const ebony = mintPiece({ recipe: 'longsword:ebony', quality: 2, seed: 1 }, PV);
  const kit = mintPiece({ recipe: 'kit:iron', quality: 0, seed: 1 }, PV);
  const table = mintPiece({ recipe: 'table-small:oak', quality: 2, seed: 1 }, PV);
  assert.deepEqual([ebony.recipe, kit.recipe, table.recipe], ['longsword:ebony', 'kit:iron', 'table-small:oak']);
  assert.deepEqual([pieceOfRecipe(ebony, 'longsword:ebony'), pieceOfRecipe(ebony, 'longsword:warforged')], [true, false]);
  const { recipe, ...old } = ebony;   // a piece minted before the stamp reads its look
  assert.equal(recipe, 'longsword:ebony');
  assert.equal(pieceOfRecipe(old, 'longsword:ebony'), true);
  assert.deepEqual([pieceOfRecipe(old, 'longsword:steel'), pieceOfRecipe(old, 'dagger:ebony')], [false, false], 'its look: the template and the material both');
  assert.deepEqual([isDeclaredItemField('recipe'), validItemField('recipe', 'longsword:ebony'), validItemField('recipe', 5)], [true, 'longsword:ebony', undefined]);
  assert.deepEqual([wearOf({ maxCondition: 5000, currentCondition: 4999 }), wearOf({ maxCondition: 5000, currentCondition: 5000 }), wearOf({ maxCondition: 100, currentCondition: 0 })],
    [WEAR_WHOLE - 1, WEAR_WHOLE, 1]);
});

test('AUDIT 31 H2, R1, U8: the Guild tab reads the guild Stores at each look, per guild and character; a refused read says why with Try again; a member takes out their own deposit, bounded by it; the numbers the service bounds are bounded first', async () => {
  const calls = [];
  let fail = true;
  const view = { id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 2,
    members: [{ member: 'm1', name: 'Bran', rank: 2, joinedAt: 1, you: true }], invites: [], ledger: [] };
  const door = { mine: async () => ({ ok: true, data: { guild: view } }), invites: async () => ({ ok: true, data: { invites: [] } }) };
  const writs = {
    busy: false, state: { guildStores: null, writBudget: null },
    guildStores: async () => {
      calls.push(['read']);
      if (fail) return { ok: false, error: 'writ-busy' };
      writs.state.guildStores = { rows: [{ material: OAK, qty: 120, mine: 20 }], moves: [], mayWithdraw: false };
      return { ok: true };
    },
    deposit: async (k, n) => { calls.push(['deposit', k, n]); return { ok: true }; },
    withdrawStores: async (k, n) => { calls.push(['withdraw', k, n]); return { ok: true }; },
  };
  const mine = new Map([[OAK, { material: OAK, own: 30, bought: 5 }]]);
  let who = 'char-a';
  const book = new GuildBook({ door, character: () => who, wallet: () => ({ gold: () => 0, pay() {}, credit() {} }),
    profStores: { writs, open: () => true, mine: () => mine, name: (k, n) => materialCountLabel(k, n), character: () => who } });
  const doc = { ...document, createElement: (t) => Object.assign(document.createElement(t), { dataset: {} }) };
  doc.head.dataset ??= {}; doc.body.dataset ??= {};
  const panel = createSocialPanel({ social: new SocialState({ acct: 'acct-a' }), guild: book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  panel.openGuild('stores');   // GUILD2 (PIN MOVED): the guild Stores are the Guild tab's Stores page
  await ticks(6); panel.render(); await ticks(6); panel.render();
  assert.match(panel.root.textContent, /The guild Stores cannot be read now/);
  const btn = (label) => byClass(panel.root, 'dfsocial-btn').find((b) => b.textContent.startsWith(label));
  fail = false;
  btn('Try again').click();
  await ticks(6); panel.render(); await ticks(6); panel.render();
  assert.match(panel.root.textContent, /120 Oak Logs20 of them yours/);
  const units = () => byClass(panel.root, 'dfsocial-field').find((f) => f.getAttribute('aria-label') === 'Units (leave empty for all)');   // GUILD-UX (PIN MOVED): empty is all of it
  const type = (v) => { const u = units(); u.value = v; u.dispatch('input', {}); };
  type('21');
  assert.equal(btn('Take out').disabled, true, 'past their own 20');
  assert.match(btn('Take out').textContent, /you put in 20 of your own/);
  type('20');
  btn('Take out').click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['withdraw', OAK, 20], 'a member takes back their own');
  panel.render();
  type('36');
  assert.equal(btn('Put in').disabled, true, 'past the 35 held');
  mine.set(OAK, { material: OAK, own: 9000, bought: 5 });
  type('5001');
  assert.equal(btn('Put in').disabled, true, 'past a move\'s 5,000 - though 9,005 are held');
  type('5000');
  assert.equal(btn('Put in').disabled, false);
  mine.set(OAK, { material: OAK, own: 30, bought: 5 });
  // each look at the Guild tab reads them again
  const looks = calls.filter((c) => c[0] === 'read').length;
  panel.openGuild();
  await ticks(6); panel.render(); await ticks(6);
  assert.equal(calls.filter((c) => c[0] === 'read').length, looks + 1, 'read again at the look');
  // another character: read again
  const reads = calls.filter((c) => c[0] === 'read').length;
  who = 'char-b';   // the character switched - the guild's view unmoved (an alt of the same guild), the tab repaints
  panel.render(); await ticks(6); panel.render();
  assert.equal(calls.filter((c) => c[0] === 'read').length, reads + 1, 'another character\'s guild Stores are read');
});

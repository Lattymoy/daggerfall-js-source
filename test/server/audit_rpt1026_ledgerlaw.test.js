// AUDIT RPT1026 (2026-10-27, lane C - the ledger and the item law; bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md,
// RPT1026-LEDGERLAW): the account service's ledger and law, driven through the real Worker over node:sqlite with every
// migration applied and R2 beside it (test/accountDb.mjs, test/realmSeat.mjs), the sword made at the real anvil.
//   - C1: THE CRAFT'S RECORD MOVES ONLY FROM THE ACCOUNT IT NAMES. RPT1026-LEDGERLAW wrote `products.handed_to` on every
//     move of a crafted piece into a record, whoever gave it. A seller that kept a piece it sold holds the ledger's row
//     first (the sale lets the row go - market.js pieceSoldSteps - and the buyer's piece is minted at its pack), and one
//     realm trade to an accomplice, or one listing of it from the pack collected by one, named the accomplice the craft's
//     record: the buyer's claim was settled the copy, and the buyer's piece locked. INT19 had given it to the buyer.
//   - C2: A STAFF EXCUSE OF A PIECE STANDS. RPT1026-LEDGERLAW ended every excuse at the first checkpoint the law found
//     nothing in, so a piece staff had cleared, put away for one checkpoint (a vault, a listing, a trade and back), held
//     its holder again, with a strike, when it came back.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { freshSave, recordOf } from '../realmSeat.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { mintPieces } from '../../src/systems/smithItems.js';
import { validLootList } from '../../src/systems/loot/loot.js';
import { wearOf } from '../../src/net/marketLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { DUPE_GRACE_S, piecesRefusal } from '../../server-account/src/ledger.js';
import { lawValuesOf, LAW_VALUES_MAX, LAW_VALUES_CUT } from '../../server-account/src/judge.js';
import { lawExcused, lawExcuseOf } from '../../server-account/src/verdict.js';
import { USAGE } from '../../tools/realmReview.mjs';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `auditc-${String(++_rid).padStart(8, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Lattymoy' });
  const raw = s.env.DB._raw;
  /** A checkpoint of `who`'s tab: its save as a fresh character's, holding `items`, its purse `gold`. */
  const put = async (who, items, gold = 100, extra = {}) => {
    const at = who.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${who.character}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(freshSave({ name: who.handle, items, goldPieces: gold, ...extra })),
    }), s.env);
    assert.equal(res.status, 200, `${who.handle}'s checkpoint lands`);
    return res.json();
  };
  const half = (who, sid, give, get, pick = []) => s.call('/v1/realm/trade', { ...who.at(), sid, give, get, pick }, who.secret);
  const ledger = (key) => ({ ...(raw.prepare('SELECT char_id, state, claim_char FROM item_uids WHERE uid = ?').get(key) ?? {}) });
  const copiesOf = (who) => raw.prepare('SELECT uid, kind FROM item_dupes WHERE char_id = ? ORDER BY uid').all(who.character).map((r) => ({ ...r }));
  const product = (pv) => ({ ...raw.prepare('SELECT owner, handed_to FROM products WHERE provenance = ?').get(pv) });
  const record = (who) => recordOf(s.env, who.character);
  const row = (who) => ({ ...raw.prepare('SELECT held, strikes, law_sig, law_excused FROM realm_characters WHERE id = ?').get(who.character) });
  /** A Mithril Longsword made at the real anvil (net/profBook.js craft, systems/smithItems.js mintPieces), minted at the maker's pack. */
  const craft = async (maker) => {
    raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(maker.id, maker.character, xpForRank(55));
    for (const [m, n] of [['ingot:mithril', 3], ['metal:copper', 1], ['leather:cured', 1]]) {
      raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(maker.id, maker.character, m, n);
    }
    const prof = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, maker) }), storage: memStorage(), character: () => maker.character, sleep: noWait });
    await prof.refresh();
    const pack = [];
    assert.equal((await prof.craft('longsword:mithril', { clean: true, name: 'Silverthorn' }, (d) => pack.push(...mintPieces(d)))).ok, true, 'made');
    assert.equal(pack.length, 1);
    return JSON.parse(JSON.stringify(pack[0]));
  };
  /** INT19's sale, the report's other half: Mac lists the sword on the market's piece route and Bea buys it with Drakes -
   *  its owner moved to Bea, her piece minted at her pack (the buy's answer); Mac's modified client keeps the sword and
   *  checkpoints first, so the row the sale let go is his. */
  const soldAndKept = async ({ gold = false } = {}) => {
    const mac = await s.seated('Mac'), bea = await s.seated('Bea'), zed = await s.seated('Zed');
    const sword = await craft(mac);
    const pv = sword.provenance;
    await put(mac, [sword]);
    s.seedMarks(mac, 1_000);
    s.seedMarks(bea, 5_000);
    if (gold) await put(bea, [], 5_000);
    const coin = gold ? { currency: 'gold' } : {};
    const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: pv, wear: wearOf(sword), price: 900, hubs: HUBS, rid: rid(), realm: mac.at(), ...coin }, mac.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    const b = await s.call('/v1/market/buy', { character: bea.character, region: DF, listing: l.body.listing.id, max: 900, hubs: HUBS, rid: rid(), ...coin, ...(gold ? { realm: bea.at() } : {}) }, bea.secret);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.deepEqual([product(pv), ledger(pv)], [{ owner: bea.id, handed_to: null }, {}], 'sold: Bea\'s by the craft\'s record, no record holding it');
    await put(mac, [sword], 140);
    assert.deepEqual(ledger(pv), { char_id: mac.character, state: 'held', claim_char: null }, 'the kept piece checkpointed first: the row is Mac\'s');
    return { mac, bea, zed, sword, pv, bought: { ...sword, currentCondition: b.body.piece.wear } };
  };
  /** Bea's minted piece checkpointed, its claim past the grace, and the holder's checkpoint with the piece settles it. */
  const settle = async (bea, holder, pv, bought) => {
    await put(bea, [bought]);
    assert.equal(ledger(pv).claim_char, bea.character, 'Bea\'s piece claims it');
    _now += DUPE_GRACE_S + 1;
    await put(holder, record(holder).items, 100);
  };
  return { ...s, raw, put, half, ledger, copiesOf, product, record, row, craft, soldAndKept, settle };
}

test('AUDIT RPT1026 C1: a seller that kept a piece it sold cannot hand the craft\'s record on through one realm trade - the buyer\'s claim is upheld, the accomplice holds the copy (mutants: the hand-over from any giver; the trade naming no giver)', async () => {
  const s = await stand();
  const { mac, bea, zed, pv, sword, bought } = await s.soldAndKept();
  const piece = { items: [sword], gold: 0 }, none = { items: [], gold: 0 };
  assert.deepEqual((await s.half(zed, 'auditc1trade', none, piece)).body, { state: 'waiting' });
  assert.equal((await s.half(mac, 'auditc1trade', piece, none, [0])).body.state, 'done', 'the kept piece traded to an accomplice');
  assert.deepEqual(s.product(pv), { owner: bea.id, handed_to: null }, 'a hand-over from an account the record does not name moves nothing (it named Zed\'s)');
  await s.settle(bea, zed, pv, bought);
  assert.deepEqual([s.ledger(pv).char_id, s.copiesOf(bea), s.copiesOf(zed)], [bea.character, [], [{ uid: pv, kind: 'craft' }]], 'the buyer\'s, the accomplice\'s the copy (Bea\'s was before)');
  assert.equal(await piecesRefusal(s.env.DB, bea.character, [pv]), null, 'Bea may pass it on');
  assert.equal(await piecesRefusal(s.env.DB, zed.character, [pv]), 'piece-dupe', 'Zed may not');
});

test('AUDIT RPT1026 C1: the account the record names hands it on from either side of a trade - the first half\'s giver and the second\'s (mutants: either side\'s giver unnamed)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac'), ann = await s.seated('Ann');
  const sword = await s.craft(mac);
  const pv = sword.provenance;
  await s.put(mac, [sword]);
  const piece = { items: [sword], gold: 0 }, gold = { items: [], gold: 40 }, none = { items: [], gold: 0 };
  // Mac's half first, giving: Ann's side receives (realmTrade.js movesB)
  assert.deepEqual((await s.half(mac, 'auditc1first', piece, gold, [0])).body, { state: 'waiting' });
  assert.equal((await s.half(ann, 'auditc1first', gold, piece)).body.state, 'done');
  assert.deepEqual(s.product(pv), { owner: mac.id, handed_to: ann.id }, 'handed to Ann\'s account by its maker\'s');
  // and Ann's half first, giving it back: Mac's side receives (movesB again), and the record is its owner's
  assert.deepEqual((await s.half(ann, 'auditc1back', piece, none, [0])).body, { state: 'waiting' });
  assert.equal((await s.half(mac, 'auditc1back', none, piece)).body.state, 'done');
  assert.deepEqual(s.product(pv), { owner: mac.id, handed_to: null });
});

test('AUDIT RPT1026 C1: nor through a listing of it from the pack an accomplice buys and collects - the escrow row names the giver (mutant: the collect\'s giver unread)', async () => {
  const s = await stand();
  const { mac, bea, zed, pv, bought } = await s.soldAndKept({ gold: true });   // bought with gold, so its seller may list it for gold
  await s.put(zed, [], 500);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'item', item: validLootList([s.record(mac).items[0]])[0], pick: 0, price: 50, hubs: HUBS, rid: rid(), currency: 'gold', realm: mac.at() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const b = await s.call('/v1/market/buy', { character: zed.character, region: DF, listing: l.body.listing.id, units: 1, max: 50, hubs: HUBS, rid: rid(), realm: zed.at(), currency: 'gold' }, zed.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const c = await s.call('/v1/market/collect', { character: zed.character, delivery: b.body.delivery.id, rid: rid(), realm: zed.at() }, zed.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual(s.product(pv), { owner: bea.id, handed_to: null }, 'collected from Mac\'s listing: Mac is no account the record names');
  await s.settle(bea, zed, pv, bought);
  assert.deepEqual([s.ledger(pv).char_id, s.copiesOf(bea), s.copiesOf(zed).map((r) => r.kind)], [bea.character, [], ['craft']]);
});

test('AUDIT RPT1026 C2: a piece staff excused stands excused after a checkpoint without it - put away and taken back, it holds nothing and strikes nothing; an excuse of the character law\'s values still ends at a clean checkpoint (mutants: every excuse ended; none)', async () => {
  const s = await stand();
  const dev = await s.registered('Lattymoy');
  const ivo = await s.seated('Ivo');
  // a longsword whose condition passes its most: an item law finding of its own (itemLaw.js 'condition'), the kind staff judge and clear
  const odd = createWeapon(120, 1, () => 0.5);
  odd.currentCondition = odd.maxCondition + 1;
  assert.deepEqual(itemFindings(odd), ['condition']);
  assert.equal((await s.put(ivo, [odd])).tradeHeld, 'law');
  assert.equal((await s.call('/v1/mod/realm-clear', { id: ivo.character, note: 'judged' }, dev.secret)).status, 200);
  assert.equal((await s.put(ivo, [odd])).tradeHeld, null, 'excused');
  assert.equal((await s.put(ivo, [])).tradeHeld, null, 'put away for a checkpoint');
  assert.equal(s.row(ivo).law_excused, 'condition:120', 'its excuse stands');
  assert.equal((await s.put(ivo, [odd])).tradeHeld, null, 'taken back: still the piece staff judged');
  assert.deepEqual([s.row(ivo).held, s.row(ivo).strikes], [null, 0], 'no hold, no strike (held, one strike, before)');
  // the character law's values, as RPT1026-LEDGERLAW made them: the purse staff read, mended in play, ends its excuse
  const vic = await s.seated('Vic');
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, 'law');
  assert.equal((await s.call('/v1/mod/realm-clear', { id: vic.character, note: 'a wrapped sale' }, dev.secret)).status, 200);
  assert.equal((await s.put(vic, [], 100)).tradeHeld, null);
  assert.equal(s.row(vic).law_excused, null, 'a clean checkpoint ends a purse\'s excuse');
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, 'law');
});

test('AUDIT RPT1026 C3: realmReview\'s words say what the clear\'s excuse is - any other state holds again, a clean checkpoint ends a character finding\'s excuse, and a piece\'s stands (mutant: the words)', () => {
  assert.match(USAGE, /any other state holds again/);
  assert.match(USAGE, /A clean checkpoint ends the excuse of a purse, bank,\n {10}level, attribute or skill; a piece's excuse stands/);
  assert.doesNotMatch(USAGE, /a change, or a clean checkpoint, ends it/);
});

test('AUDIT RPT1026 C5: a state whose values pass the cut is never excused - eighty bank accounts below nothing put the purse past the 1,000 characters kept, and a clear of a negative purse there excused every purse after it (mutants: the cut unmarked; the mark unread)', async () => {
  const banks = Array.from({ length: 80 }, () => ({ accountGold: -1, loanTotal: 0 }));
  const of = (gold) => lawValuesOf(freshSave({ goldPieces: gold, bankAccounts: banks }), null);
  assert.equal(of(-8_000_000), of(9e15), 'past the cut, the two purses read alike');
  assert.deepEqual([of(9e15).length, of(9e15).endsWith(LAW_VALUES_CUT)], [LAW_VALUES_MAX + 1, true], 'cut, and said so');
  assert.equal(lawExcused(lawExcuseOf('bank:,gold:', of(-8_000_000)), 'bank:,gold:', of(9e15)), false, 'so no excuse names it');
  const s = await stand();
  const dev = await s.registered('Lattymoy');
  const kit = await s.seated('Kit');
  assert.equal((await s.put(kit, [], -8_000_000, { bankAccounts: banks })).tradeHeld, 'law');
  assert.equal((await s.call('/v1/mod/realm-clear', { id: kit.character, note: 'judged' }, dev.secret)).status, 200);
  assert.equal((await s.put(kit, [], 9e15, { bankAccounts: banks })).tradeHeld, 'law', 'nine quadrillion holds (it passed: the purse was past the cut)');
  assert.equal((await s.put(kit, [], -8_000_000, { bankAccounts: banks })).tradeHeld, 'law', 'and a state too long to keep is no state an excuse can name');
  assert.equal(s.row(kit).strikes, 0, 'held, never struck for it');
});

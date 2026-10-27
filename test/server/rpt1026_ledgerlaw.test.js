// RPT1026-LEDGERLAW (2026-10-26, the private report inbox - bible/06-Systems/Integrity-Arc.md, RPT1026-LEDGERLAW): the account
// service's ledger and law, driven through the real Worker over node:sqlite with every migration applied and R2 beside it
// (test/accountDb.mjs, test/realmSeat.mjs).
//   - A CRAFTED PIECE TRADED AWAY STAYS WITH ITS BUYER: the ledger settled a contested claim on a crafted piece for
//     the account `products.owner` names, and a realm trade, a market delivery, a vault and a chest move no owner - so a
//     maker who traded a piece away and wrote it back into its save won it back past the grace, and its buyer's was
//     locked as the copy (server-account/src/ledger.js CRAFT_RECORD_SQL, `products.handed_to`, migration 0178).
//   - STAFF'S CLEAR EXCUSES THE STATE IT READ: the law's signature names a character finding by its code alone, so a
//     cleared negative purse excused every purse after it (verdict.js lawExcused, judge.js lawValuesOf).
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
import { DUPE_GRACE_S, piecesRefusal } from '../../server-account/src/ledger.js';
import { lawExcused, lawExcuseOf } from '../../server-account/src/verdict.js';
import { lawValuesOf, characterFindings } from '../../server-account/src/judge.js';
import { GOLD_INT_MAX } from '../../src/systems/item/itemLaw.js';
import { USAGE } from '../../tools/realmReview.mjs';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `rpt1026l-${String(++_rid).padStart(8, '0')}`;
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
  /** Mac at the real anvil (net/profBook.js craft, systems/smithItems.js mintPieces): a Mithril Longsword, minted at his pack. */
  const craft = async (mac) => {
    raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(55));
    for (const [m, n] of [['ingot:mithril', 3], ['metal:copper', 1], ['leather:cured', 1]]) {
      raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
    }
    const prof = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => mac.character, sleep: noWait });
    await prof.refresh();
    const pack = [];
    assert.equal((await prof.craft('longsword:mithril', { clean: true, name: 'Silverthorn' }, (d) => pack.push(...mintPieces(d)))).ok, true, 'made');
    assert.equal(pack.length, 1);
    return JSON.parse(JSON.stringify(pack[0]));
  };
  /** The report's first steps: Mac makes a sword at the anvil, his checkpoint holds it, and a realm trade hands it to Ann for 40 gold. */
  const tradedAway = async () => {
    const mac = await s.seated('Mac'), ann = await s.seated('Ann');
    const sword = await craft(mac);
    await put(mac, [sword]);
    assert.deepEqual(ledger(sword.provenance), { char_id: mac.character, state: 'held', claim_char: null }, 'the ledger: Mac holds it');
    const piece = { items: [sword], gold: 0 }, gold = { items: [], gold: 40 };
    assert.deepEqual((await half(ann, 'rpt1026trade1', gold, piece)).body, { state: 'waiting' });
    assert.equal((await half(mac, 'rpt1026trade1', piece, gold, [0])).body.state, 'done', 'traded');
    assert.deepEqual(record(ann).items.map((it) => it.provenance), [sword.provenance], 'the piece in Ann\'s record');
    return { mac, ann, sword };
  };
  return { ...s, raw, put, half, ledger, copiesOf, product, record, craft, tradedAway };
}

test('RPT1026-LEDGERLAW (#105, the report\'s steps): a crafted piece traded away and written back into its maker\'s save stays its buyer\'s - the maker\'s copy is the one locked, the buyer passes it on and the maker cannot (mutants: the uphold reads the owner alone; the trade writes no hand-over)', async () => {
  const s = await stand();
  const { mac, ann, sword } = await s.tradedAway();
  const pv = sword.provenance;
  assert.deepEqual(s.product(pv), { owner: mac.id, handed_to: ann.id }, 'the craft\'s record: made by Mac\'s account, handed by the service to Ann\'s');
  // a modified client writes the piece back into Mac's save and checkpoints it: a claim
  await s.put(mac, [sword], 140);
  assert.deepEqual(s.ledger(pv), { char_id: ann.character, state: 'held', claim_char: mac.character });
  _now += DUPE_GRACE_S + 1;
  // Ann's checkpoint past the grace, still holding it: the claim was a copy - Mac's
  const said = await s.put(ann, [sword], 60);
  assert.deepEqual(said.locked, [], 'nothing of Ann\'s locked');
  assert.deepEqual(s.ledger(pv), { char_id: ann.character, state: 'held', claim_char: null }, 'Ann\'s still');
  assert.deepEqual([s.copiesOf(ann), s.copiesOf(mac)], [[], [{ uid: pv, kind: 'claim' }]], 'the copy written down is Mac\'s');
  assert.deepEqual((await s.put(mac, [sword], 140)).locked, [pv], 'and his checkpoint is told it is locked');
  assert.equal(await piecesRefusal(s.env.DB, ann.character, [pv]), null, 'Ann may pass it on');
  assert.equal(await piecesRefusal(s.env.DB, mac.character, [pv]), 'piece-dupe', 'Mac may not');
  assert.equal(Number(s.raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(ann.character).dupes), 0);
});

test('RPT1026-LEDGERLAW (#105): bought from the market\'s pack route, the piece is its collector\'s by the craft\'s record - the maker who writes it back holds the copy (mutant: a collect writes no hand-over)', async () => {
  const s = await stand();
  const { mac, ann, sword } = await s.tradedAway();
  const pv = sword.provenance;
  const cid = await s.seated('Cid');
  await s.put(cid, [], 500);
  // Ann lists the traded piece from her pack (MARKET-ANY - its record names another account's maker), Cid buys and collects it
  const l = await s.call('/v1/market/list', { character: ann.character, region: DF, kind: 'item', item: validLootList([s.record(ann).items[0]])[0], pick: 0, price: 50, hubs: HUBS, rid: rid(), currency: 'gold', realm: ann.at() }, ann.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const b = await s.call('/v1/market/buy', { character: cid.character, region: DF, listing: l.body.listing.id, units: 1, max: 50, hubs: HUBS, rid: rid(), realm: cid.at(), currency: 'gold' }, cid.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const c = await s.call('/v1/market/collect', { character: cid.character, delivery: b.body.delivery.id, rid: rid(), realm: cid.at() }, cid.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual(s.product(pv), { owner: mac.id, handed_to: cid.id }, 'handed to Cid\'s account by the collect');
  await s.put(mac, [sword], 140);
  assert.equal(s.ledger(pv).claim_char, mac.character);
  _now += DUPE_GRACE_S + 1;
  assert.deepEqual((await s.put(cid, s.record(cid).items, 450)).locked, [], 'Cid keeps it');
  assert.deepEqual([s.ledger(pv).char_id, s.copiesOf(cid), s.copiesOf(mac).map((r) => r.uid)], [cid.character, [], [pv]]);
});

test('RPT1026-LEDGERLAW (#105): the craft\'s record names the owner again where a sale moved it - the seller that kept a sold piece is still the copier - and an owner\'s account a piece is handed back to, or holds again by a peer\'s hands (mutants: the sale leaves the hand-over standing; the commission\'s fill the same; the owner holding it upheld against)', async () => {
  const s = await stand();
  const { mac, ann, sword } = await s.tradedAway();
  const pv = sword.provenance;
  // handed back by the service (Ann trades it back): Mac's account's own again
  const piece = { items: [sword], gold: 0 }, none = { items: [], gold: 0 };
  assert.deepEqual((await s.half(mac, 'rpt1026back1', none, piece)).body, { state: 'waiting' });
  assert.equal((await s.half(ann, 'rpt1026back1', piece, none, [0])).body.state, 'done');
  assert.deepEqual(s.product(pv), { owner: mac.id, handed_to: null }, 'its owner\'s, no hand-over standing');
  // handed on again, then by a peer's hands back to Mac (Ann's checkpoint without it, his with it - no service saw it)
  assert.deepEqual((await s.half(ann, 'rpt1026trade2', none, piece)).body, { state: 'waiting' });
  assert.equal((await s.half(mac, 'rpt1026trade2', piece, none, [0])).body.state, 'done');
  assert.equal(s.product(pv).handed_to, ann.id);
  await s.put(ann, [], 60);
  await s.put(mac, [sword], 140);
  assert.equal(s.ledger(pv).char_id, mac.character);
  // Ann's modified client writes it back: the craft's record names her account (the trade's), but its owner holds it -
  // hers is the copy (a move the service made is no claim against the owner the piece came back to)
  await s.put(ann, [sword], 60);
  assert.equal(s.ledger(pv).claim_char, ann.character);
  _now += DUPE_GRACE_S + 1;
  await s.put(mac, [sword], 140);
  assert.deepEqual([s.ledger(pv).char_id, s.copiesOf(ann).map((r) => r.kind), s.copiesOf(mac)], [mac.character, ['claim'], []], 'its owner keeps it');
  // Mac sells it on the market's piece route (INT19: out of his record); Bea buys it with Drakes: its owner moved by the sale
  const bea = await s.seated('Bea');
  s.seedMarks(mac, 1_000);
  s.seedMarks(bea, 5_000);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: pv, wear: wearOf(sword), price: 900, hubs: HUBS, rid: rid(), realm: mac.at() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const b = await s.call('/v1/market/buy', { character: bea.character, region: DF, listing: l.body.listing.id, max: 900, hubs: HUBS, rid: rid() }, bea.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual(s.product(pv), { owner: bea.id, handed_to: null }, 'the sale moved its owner, and the hand-over before it is spent');
  // Mac's modified client keeps the sold piece and checkpoints first; Bea's minted piece claims it; past the grace the
  // craft's record gives it to Bea (INT4's own law, kept)
  await s.put(mac, [sword], 140);
  await s.put(bea, [{ ...sword, currentCondition: b.body.piece.wear }]);
  assert.equal(s.ledger(pv).claim_char, bea.character);
  _now += DUPE_GRACE_S + 1;
  await s.put(mac, [sword], 140);
  assert.deepEqual([s.ledger(pv).char_id, s.copiesOf(mac).map((r) => r.kind), s.copiesOf(bea)], [bea.character, ['craft'], []], 'the seller that kept it holds the copy');
});

test('RPT1026-LEDGERLAW (#105): a commission\'s fill moves the craft\'s record to its poster, whatever the service last handed it to', async () => {
  const s = await stand();
  const smith = await s.seated('Silverthorn');
  const sword = await s.craft(smith);
  const pv = sword.provenance;
  const ann = await s.seated('Ann');
  await s.put(smith, [sword]);
  // handed to Ann by a trade, and back by a peer's hands (no service saw it)
  const piece = { items: [sword], gold: 0 }, none = { items: [], gold: 0 };
  assert.deepEqual((await s.half(ann, 'rpt1026trade3', none, piece)).body, { state: 'waiting' });
  assert.equal((await s.half(smith, 'rpt1026trade3', piece, none, [0])).body.state, 'done');
  await s.put(ann, [], 100);
  await s.put(smith, [sword]);
  assert.equal(s.product(pv).handed_to, ann.id);
  const poster = await s.seated('Bea');
  s.seedMarks(poster, 5_000);
  assert.equal((await s.call('/v1/board/pin', { map: 1_000, subject: 'Blades made', body: 'Mithril, to order.', days: 7, button: 'commission', rid: rid() }, smith.secret)).status, 200);
  const c = await s.call('/v1/writs/commission', { character: poster.character, region: DF, crafter: 'silverthorn', recipe: 'longsword:mithril', quality: 1, pay: 900, rid: `w${String(++_rid).padStart(15, '0')}` }, poster.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const f = await s.call('/v1/writs/fulfil', { character: smith.character, region: DF, commission: c.body.commission.id, provenance: pv, wear: wearOf(sword), rid: `w${String(++_rid).padStart(15, '0')}`, realm: smith.at() }, smith.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual(s.product(pv), { owner: poster.id, handed_to: null });
});

test('RPT1026-LEDGERLAW (#99) lawValuesOf, pure: each character finding\'s key and the value it was found on, sorted - none for a lawful save; the excuse over the signature and the values, and one written before them (the signature alone) covers a finding of pieces alone (mutants: the values unread; the old excuse still covering a purse)', () => {
  assert.equal(lawValuesOf(freshSave(), null), null);
  assert.equal(lawValuesOf(freshSave({ goldPieces: -8_000_000 }), null), 'gold@=-8000000');
  assert.equal(lawValuesOf(freshSave({ goldPieces: 9e15 }), null), 'gold@=9000000000000000');
  assert.equal(lawValuesOf(freshSave({ stats: { strength: 100, agility: 101 }, skills: [5, 201] }), null), 'skill@1=201,stat@agility=101');
  assert.equal(lawValuesOf(freshSave({ bankAccounts: [{ accountGold: -5, loanTotal: 0 }] }), null), 'bank@0=[-5,0]');
  assert.equal(lawValuesOf(freshSave({ level: 3 }), { level: 4 }), 'level-claim@=[3,4]');
  // every character finding is read: the values name the same findings the character law makes
  const forged = freshSave({ level: 3, goldPieces: -1, stats: { strength: 999 }, skills: [999], bankAccounts: [{ accountGold: 1.5 }] });
  assert.equal(characterFindings(forged, { level: 4 }).length, 5);
  assert.equal(lawValuesOf(forged, { level: 4 }), 'bank@0=[1.5,null],gold@=-1,level-claim@=[3,4],skill@0=999,stat@strength=999');
  assert.equal(lawExcuseOf('gold:', 'gold@=-8000000'), 'gold:|gold@=-8000000');
  assert.equal(lawExcuseOf('rarity:113', null), 'rarity:113', 'a finding of pieces alone: its signature, as every excuse was');
  assert.equal(lawExcused('gold:|gold@=-8000000', 'gold:', 'gold@=-8000000'), true);
  assert.equal(lawExcused('gold:|gold@=-8000000', 'gold:', 'gold@=9000000000000000'), false, 'another purse');
  assert.equal(lawExcused('gold:', 'gold:', 'gold@=9000000000000000'), false, 'an excuse from before the values: no purse');
  assert.equal(lawExcused('rarity:113', 'rarity:113', null), true, 'an excuse from before the values: its pieces still');
  assert.equal(lawExcused(null, 'gold:', null), false);
  assert.equal(lawExcused('gold:', null, null), false, 'nothing found, nothing excused');
});

test('RPT1026-LEDGERLAW (#99, the report\'s steps): staff\'s clear of a negative purse excuses that purse alone - a purse of 9e15 or 5e9 gold holds again, and the first clean checkpoint ends the excuse; an excuse written before this covers no purse (mutants: the excuse over the signature alone; the clean checkpoint keeping it; the clear writing no values)', async () => {
  const s = await stand();
  const dev = await s.registered('Lattymoy');
  const vic = await s.seated('Vic');
  const row = () => ({ ...s.raw.prepare('SELECT held, law_sig, law_v, law_excused FROM realm_characters WHERE id = ?').get(vic.character) });
  const clear = async () => assert.equal((await s.call('/v1/mod/realm-clear', { id: vic.character, note: 'a wrapped sale' }, dev.secret)).status, 200);
  // the shop sale's overflow: the purse below nothing - held on a gold finding with no value beside it
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, 'law');
  await clear();
  assert.deepEqual(row(), { held: null, law_sig: 'gold:', law_v: 'gold@=-8000000', law_excused: 'gold:|gold@=-8000000' }, 'excused as staff read it');
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, null, 'the purse staff read: excused');
  assert.equal((await s.put(vic, [], 9e15)).tradeHeld, 'law', '9e15 holds');
  const lastLaw = () => JSON.parse(s.raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'law' ORDER BY id DESC").get(vic.character).detail);
  assert.equal(lastLaw().values, 'gold@=9000000000000000', 'and the hold it starts is a finding staff read, with its purse');
  assert.equal((await s.put(vic, [], 5_000_000_000)).tradeHeld, 'law', 'five billion holds');
  // cleared again at its purse, then a clean checkpoint: the excuse ends, and the first purse holds again
  await s.put(vic, [], -8_000_000);
  await clear();
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, null);
  assert.equal((await s.put(vic, [], 100)).tradeHeld, null, 'mended in play');
  assert.deepEqual([row().law_sig, row().law_excused], [null, null], 'nothing found: nothing excused');
  assert.equal((await s.put(vic, [], -8_000_000)).tradeHeld, 'law', 'the excuse was the one state, once');
  // an excuse staff wrote before this (the signature alone): every purse after it passed - none does now
  s.raw.prepare("UPDATE realm_characters SET held = NULL, held_at = NULL, law_excused = 'gold:', judge_rev = judge_rev + 1 WHERE id = ?").run(vic.character);
  assert.equal((await s.put(vic, [], 9e15)).tradeHeld, 'law');
  assert.ok(9e15 > GOLD_INT_MAX);
});

test('RPT1026-LEDGERLAW (#99): an attribute staff cleared is excused at its value and key alone - another value, or another attribute, holds', async () => {
  const s = await stand();
  const dev = await s.registered('Lattymoy');
  const ivo = await s.seated('Ivo');
  const odd = (stats) => s.put(ivo, [], 100, { stats });
  assert.equal((await odd({ agility: 101 })).tradeHeld, 'law');
  assert.equal((await s.call('/v1/mod/realm-clear', { id: ivo.character }, dev.secret)).status, 200);
  assert.equal((await odd({ agility: 101 })).tradeHeld, null);
  assert.equal((await odd({ agility: 150 })).tradeHeld, 'law', 'another value');
  await odd({ agility: 101 });
  assert.equal((await s.call('/v1/mod/realm-clear', { id: ivo.character }, dev.secret)).status, 200);
  assert.equal((await odd({ strength: 101 })).tradeHeld, 'law', 'another attribute');
});

test('RPT1026-LEDGERLAW (#99): realmReview\'s usage lines say what clear does - the hold lifted AND the finding standing excused, as it stands now, and a negative purse is mend\'s (mutant: the words)', () => {
  assert.match(USAGE, /clear lifts the hold and EXCUSES the finding standing, exactly as it stands now/);
  assert.match(USAGE, /A purse below nothing: use mend/);
});

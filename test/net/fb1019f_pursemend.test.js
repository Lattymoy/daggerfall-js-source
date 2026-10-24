// PURSE-MEND (FIELD BUGS 2026-10-19f; a player's private report - after selling a lot worth over 18 million at 0.0.235,
// the purse read -8,000,000 and the carry weight -19,995 kg). TRADE-WRAP (FIELD BUGS 2026-10-18b) stopped the counter
// paying below nothing; a record it already paid that way keeps the purse, the judge holds its trade on it, and FIELD BUGS
// 2026-10-18b's "a staff repair (review.js)" had no act that could reach a purse. Staff mend the one character: the
// review's `mend` act (server-account/src/review.js mendAct; net/repairLaw.js purseMendOf, applyPurseMend).
//
// Over HTTP against the real Worker and the real migrations (test/accountDb.mjs), a realm character seated as the realm
// makes one (test/realmSeat.mjs), its record the save the game writes (save.js snapshotPlayer of a made character) after
// the old counter's sale - the price it pays now (shopStock.js calculateTradePrice) less the wrap 0.0.235 took off it -
// checkpointed through the real route, so the judge finds the purse and holds the trade:
//   - the mend sets the purse to nothing and gives what is owed as one letter of credit, witnessed and the service's own
//     faucet, the act written down, the hold the purse made lifted - and the next checkpoint finds the record clean;
//   - a hold the purse is not alone in, a timed hold and staff's own stand;
//   - the lift guarded on the judgement it read (staff's hold laid while a mend is in flight moves nothing), and a mend
//     of nothing owed gives nothing - no letter, no faucet - and lifts the hold all the same (AUDIT FB1019f A2, A3);
//   - nobody but a developer, no purse but one below nothing and the one reckoned from, no amount past the law;
//   - once a ticket, and a ticket names one act;
//   - the operator's command, and `findings` saying the purse a mend is reckoned from;
//   - the leftovers: a trade lot past 2^31 haggles by its halves, and the Reforge says gold past one int's worth.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService } from '../accountDb.mjs';
import { seatRealm, realmJoinAt, recordOf } from '../realmSeat.mjs';
import { withDom } from '../invdrag.mjs';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { tradeCost, tradeMessageOffset, getTradePrice } from '../../src/systems/tradeModes.js';
import { calculateTradePrice } from '../../src/systems/shopStock.js';
import { addGoldPieces, carriedWeight, totalWeight, letterOfCredit } from '../../src/systems/inventory.js';
import { totalGoldAmount } from '../../src/systems/court.js';
import { cureOfferMessageOffset } from '../../src/systems/guild/guildServiceActions.js';
import { realmLetterOfCredit } from '../../src/net/realm/realmGoldLaw.js';
import { GOLD_INT_MAX } from '../../src/systems/item/itemLaw.js';
import { purseMendOf } from '../../src/net/repairLaw.js';
import { FACTION_FLAGS } from '../../src/formats/factionFile.js';
import { PURSE_SIG } from '../../server-account/src/review.js';
import { LAW_HOLD_S } from '../../server-account/src/verdict.js';
import { reviewRequest } from '../../tools/realmReview.mjs';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { mountReforgeWindow, reforgePurseText } from '../../src/ui/reforgeWindow.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const TICKET = 'fb1019f-purse-mend';
const DAEDRIC = 9, CLAYMORE = 122, LONGSWORD = 120;
const SKILLS = { mercantile: 100, personality: 100 };
/** What int32's wrap took off a lot's price at the old counter, offline: 2^32 over CalculateTradePrice's 256. */
const WRAP = 2 ** 24;
const claymores = (n) => Array.from({ length: n }, () => createWeapon(CLAYMORE, DAEDRIC, () => 0.5));

/** THE FIELD'S SALE: 150 Daedric claymores at a quality-10 counter - the price the counter pays now, and what 0.0.235 paid. */
function fieldSale() {
  const cost = tradeCost('Sell', claymores(150), { quality: 10, online: false }).cost;
  const price = calculateTradePrice(cost, 10, SKILLS, true, { online: false });
  return { price, paid: price - WRAP };
}

/** A made character (chargen.js) with a purse, the longsword it kept and a letter of credit it held through the sale. */
function seller(purse = 12_345, factionRep = null) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Seller', hp: 12, primarySkills: [], majorSkills: [], minorSkills: [],
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.goldPieces = purse;
  p.items = [createWeapon(LONGSWORD, 1, () => 0.5), letterOfCredit(40_000)];
  if (factionRep) p.factionRep = factionRep;
  return p;
}
/** The save the game writes for it (save.js snapshotPlayer), as the wire carries it. */
const saveOf = (p) => JSON.parse(JSON.stringify(snapshotPlayer(p, {})));
/** The record the old counter left: the seller after the field's sale, paid below nothing (inventory.js addGoldPieces). */
function wrapped(purse = 12_345, factionRep = null) {
  const p = seller(purse, factionRep);
  addGoldPieces(p, fieldSale().paid);
  return p;
}
/** A law finding beside the purse: a hand on a ring no craft made ('crafted' - test/server/autohold.test.js's ring). */
const ring = () => ({ templateIndex: 135, group: 'Jewellery', value: 80, hand: 1 });

async function stand() {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('mac');
  /** A seller seated in the realm, its first save a fresh one. */
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R, id: R.id };
  };
  /** A checkpoint by the playing tab - the next sequence under its lease, judged as every one is. */
  const put = async (c, save) => {
    const at = c.R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${c.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${c.who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: save.level }) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200, 'the checkpoint lands');
    return res.json();
  };
  const row = (c) => ({ ...raw.prepare('SELECT seq, obj, lease, witnessed, svc_seq, held, held_at, held_until, strikes, law_sig, judge_rev FROM realm_characters WHERE id = ?').get(c.id) });
  const record = (c) => recordOf(s.env, c.id);
  const mend = (c, body, secret = mac.secret) => s.call('/v1/mod/realm-mend', { id: c.id, ticket: TICKET, note: 'PURSE-MEND, the wrapped sale', ...body }, secret);
  const repairs = (c) => raw.prepare('SELECT ticket, faction, flag, was, gold, seq, by_handle, note FROM realm_repairs WHERE char_id = ?').all(c.id).map((r) => ({ ...r }));
  const staff = (c) => raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'staff'").all(c.id).map((f) => JSON.parse(f.detail));
  const kinds = (c) => raw.prepare('SELECT kind FROM realm_findings WHERE char_id = ? ORDER BY id').all(c.id).map((f) => f.kind);
  const faucet = () => ({ ...raw.prepare("SELECT COALESCE(SUM(gold), 0) AS gold, COALESCE(SUM(n), 0) AS n FROM realm_faucets WHERE kind = 'repair'").get() });
  return { s, raw, mac, seat, put, row, record, mend, repairs, staff, kinds, faucet };
}

test('PURSE-MEND THE MEND: a record the old counter paid below nothing is held on its purse; a developer\'s mend sets the purse to nothing and gives what it is owed as one letter of credit at the front of the pack - the pack weighing what it carries again, the record one sequence on with its seat taken, the gold witnessed and the service\'s own faucet, the act written down - and lifts the hold the purse made, its strike standing; the next checkpoint finds the mended record clean (mutants: the purse kept; the gold as coin; the hold kept; the hold lifted with its strike; no finding; no faucet)', async () => {
  const t = await stand();
  const sale = fieldSale();
  assert.equal(sale.paid, -7_489_216, 'the field\'s price (FIELD BUGS 2026-10-18b TRADE-WRAP): 150 claymores at a quality-10 counter');
  const p = wrapped();
  assert.equal(p.goldPieces, 12_345 + sale.paid);
  assert.ok(carriedWeight(p) < -18_000, 'the report\'s shape: a carry weight thousands of kilograms below nothing');
  const c = await t.seat('seller');
  const said = await t.put(c, saveOf(p));
  assert.deepEqual([said.tradeHeld, said.tradeHeldWhy], ['law', { code: 'gold', t: null }], 'the judge holds its trade on the purse');
  const before = t.row(c);
  assert.deepEqual([before.held, before.law_sig, before.strikes, before.held_until], ['law', PURSE_SIG, 1, null]);
  assert.equal(PURSE_SIG, 'gold:', 'the purse\'s finding alone, as verdict.js lawSigOf writes it');
  // the staff read the purse, and reckon: what it held before the sale, and the sale's price as the counter pays it now
  const look = await t.s.call('/v1/mod/realm-findings', { id: c.id }, t.mac.secret);
  assert.equal(look.status, 200);
  assert.equal(look.body.character.purse, p.goldPieces, 'findings say the purse a mend is reckoned from');
  const owed = look.body.character.purse + WRAP;
  assert.equal(owed, 12_345 + sale.price);
  const r = await t.mend(c, { was: p.goldPieces, gold: owed });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, repeat: false, ticket: TICKET, seq: before.seq + 1, was: p.goldPieces, gold: owed, held: null, by: 'mac', at: r.body.at });
  const rec = t.record(c);
  assert.equal(rec.goldPieces, 0, 'the purse set to nothing - never added to');
  assert.deepEqual(rec.items, [realmLetterOfCredit(owed), ...saveOf(p).items], 'what it is owed as the game\'s letter, at the front; the letter it kept untouched');
  assert.equal(carriedWeight({ goldPieces: rec.goldPieces, items: rec.items }), totalWeight(rec.items), 'the pack weighs what it carries');
  const after = t.row(c);
  assert.deepEqual([after.seq, after.svc_seq, after.lease], [before.seq + 1, before.seq + 1, null], 'one sequence on, a service move, the seat taken from any tab');
  assert.equal(after.witnessed - before.witnessed, owed, 'witnessed: the judge charges no gain the service made (a purse below nothing counted none)');
  assert.deepEqual([after.held, after.held_at, after.law_sig, after.strikes, after.judge_rev], [null, null, null, 1, before.judge_rev + 1], 'the hold the purse made lifted, its strike standing');
  assert.deepEqual(t.repairs(c), [{ ticket: TICKET, faction: 0, flag: 0, was: p.goldPieces, gold: owed, seq: before.seq + 1, by_handle: 'mac', note: 'PURSE-MEND, the wrapped sale' }]);
  assert.deepEqual(t.staff(c).map((f) => [f.act, f.by, f.ticket, f.was, f.gold, f.lifted, f.from, f.to]), [['mend', 'mac', TICKET, p.goldPieces, owed, true, before.seq, before.seq + 1]]);
  assert.deepEqual(t.faucet(), { gold: owed, n: 1 }, 'the service\'s own faucet, named');
  // the player's next join plays the mended record, and its next checkpoint is judged clean: no law, no unexplained gain
  const findingsBefore = t.kinds(c);
  await realmJoinAt(t.s.env, c.who.secret, c.id);
  const next = await t.put(c, rec);
  assert.equal(next.tradeHeld, null, 'trading again');
  assert.deepEqual(t.kinds(c).slice(findingsBefore.length), [], 'no finding: the law finds nothing, the budget no gain');
  assert.deepEqual([t.row(c).held, t.row(c).law_sig], [null, null]);
});

test('PURSE-MEND THE HOLDS THAT STAND: the purse beside another finding - the law\'s hold stays for the next checkpoint to judge; a timed hold stays to its end; staff\'s own hold is staff\'s - each record mended all the same (mutants: the signature unread; the timed hold unread; the hold\'s kind unread)', async () => {
  const t = await stand();
  // the purse beside a ring no craft made
  const beside = await t.seat('beside');
  const p1 = wrapped();
  p1.items.push(ring());
  assert.equal((await t.put(beside, saveOf(p1))).tradeHeld, 'law');
  const b1 = t.row(beside);
  assert.notEqual(b1.law_sig, PURSE_SIG, 'more than the purse');
  const r1 = await t.mend(beside, { was: p1.goldPieces, gold: 1_000 });
  assert.deepEqual([r1.status, r1.body.held], [200, 'law']);
  assert.deepEqual([t.row(beside).held, t.row(beside).law_sig, t.row(beside).judge_rev], [b1.held, b1.law_sig, b1.judge_rev], 'the hold, its finding and the judge\'s columns untouched');
  assert.equal(t.record(beside).goldPieces, 0, 'mended all the same');
  assert.equal(t.staff(beside)[0].lifted, false);
  // the purse the third strike: a timed hold
  const timed = await t.seat('timed');
  const clean = saveOf(seller());
  const ringed = saveOf(seller());
  ringed.items.push(ring());
  for (const save of [ringed, clean, ringed, clean]) await t.put(timed, save);
  const p2 = wrapped();
  assert.equal((await t.put(timed, saveOf(p2))).tradeHeld, 'law');
  const b2 = t.row(timed);
  assert.equal(b2.law_sig, PURSE_SIG, 'the purse alone');
  assert.ok(b2.held_until > Math.floor(Date.now() / 1000) + LAW_HOLD_S - 60, 'the third strike: a week\'s hold');
  const r2 = await t.mend(timed, { was: p2.goldPieces, gold: 1_000 });
  assert.deepEqual([r2.status, r2.body.held], [200, 'law']);
  assert.deepEqual([t.row(timed).held, t.row(timed).held_until, t.row(timed).law_sig], [b2.held, b2.held_until, PURSE_SIG], 'a timed hold runs to its end');
  // staff's own hold, laid over the purse's
  const held = await t.seat('heldbystaff');
  const p3 = wrapped();
  await t.put(held, saveOf(p3));
  assert.equal((await t.s.call('/v1/mod/realm-hold', { id: held.id, note: 'looking' }, t.mac.secret)).status, 200);
  assert.deepEqual([t.row(held).held, t.row(held).law_sig], ['staff', PURSE_SIG]);
  const r3 = await t.mend(held, { was: p3.goldPieces, gold: 1_000 });
  assert.deepEqual([r3.status, r3.body.held, t.row(held).held], [200, 'staff', 'staff'], 'staff alone lift their own');
});

test('PURSE-MEND THE LIFT IS GUARDED ON THE JUDGEMENT THE ACT READ (AUDIT FB1019f A2): staff\'s own hold laid through its own route while a mend is in flight - after the mend read the row, before its batch - moves nothing: the hold stays staff\'s, the purse unmended, no row and no faucet, refused `seq` (409: ask again); asked again, the purse is mended under the staff\'s hold, which stands (mutants: the lift\'s guard unread; the lift unenforced)', async () => {
  const t = await stand();
  const c = await t.seat('seller');
  const p = wrapped();
  await t.put(c, saveOf(p));
  const before = { row: t.row(c), rec: t.record(c) };
  assert.deepEqual([before.row.held, before.row.law_sig, before.row.held_until], ['law', PURSE_SIG, null], 'the law\'s hold on the purse alone: the mend reads it as one to lift');
  // the hold lands while the mend reads the record it seizes (the save's one read, after the row's)
  const saves = t.s.env.SAVES, get = saves.get.bind(saves);
  let armed = true, laid = null;
  saves.get = async (key) => {
    if (armed) { armed = false; laid = await t.s.call('/v1/mod/realm-hold', { id: c.id, note: 'looking while it mends' }, t.mac.secret); }
    return get(key);
  };
  const r = await t.mend(c, { was: p.goldPieces, gold: 1_000 });
  saves.get = get;
  assert.equal(laid?.status, 200, 'staff\'s hold landed between the read and the batch');
  assert.deepEqual([r.status, r.body.error], [409, 'seq'], 'the judgement it read moved: nothing lands');
  assert.deepEqual([t.row(c).held, t.row(c).law_sig, t.row(c).seq, t.row(c).obj], ['staff', PURSE_SIG, before.row.seq, before.row.obj], 'staff\'s hold stands, the record where it was');
  assert.deepEqual(t.record(c), before.rec, 'the purse unmended');
  assert.deepEqual([t.repairs(c).length, t.faucet()], [0, { gold: 0, n: 0 }], 'no row, no faucet');
  // asked again, it reads staff's hold: the purse mended, the hold staff's to lift
  const again = await t.mend(c, { was: p.goldPieces, gold: 1_000 });
  assert.deepEqual([again.status, again.body.held, t.row(c).held, t.record(c).goldPieces], [200, 'staff', 'staff', 0]);
});

test('PURSE-MEND NOTHING OWED (AUDIT FB1019f A3): a mend of 0 gold sets the purse to nothing and gives nothing - no letter in the pack, no faucet row - and lifts the hold the purse made all the same, the act written down with its 0 (mutants: a letter of nothing; a faucet row of nothing)', async () => {
  const t = await stand();
  const c = await t.seat('seller');
  const p = wrapped();
  await t.put(c, saveOf(p));
  const before = t.row(c);
  const r = await t.mend(c, { was: p.goldPieces, gold: 0 });
  assert.deepEqual([r.status, r.body.gold, r.body.held], [200, 0, null], JSON.stringify(r.body));
  const rec = t.record(c);
  assert.equal(rec.goldPieces, 0, 'the purse set to nothing');
  assert.deepEqual(rec.items, saveOf(p).items, 'no letter: the pack as it stood');
  assert.deepEqual(t.faucet(), { gold: 0, n: 0 }, 'no faucet row');
  assert.deepEqual([t.row(c).held, t.row(c).law_sig, t.row(c).judge_rev], [null, null, before.judge_rev + 1], 'the hold the purse made lifted');
  assert.deepEqual(t.repairs(c).map((x) => [x.was, x.gold]), [[p.goldPieces, 0]]);
});

test('PURSE-MEND THE REFUSALS: only a developer is heard (403, 401 for no session); a mend the law refuses writes nothing - a purse it was reckoned from that is not below nothing or not whole, gold below nothing, past one int or not whole, a ticket of no shape (400); a record whose purse is not below nothing (409 mend-not-negative) or not the one reckoned from (409 mend-moved); no such character (404), the dead (409) (mutants: the developer gate; the purse it names unchecked; the bound; the purse asked not below nothing; the purse asked not the one)', async () => {
  const t = await stand();
  const c = await t.seat('seller');
  const p = wrapped();
  await t.put(c, saveOf(p));
  const before = { row: t.row(c), rec: t.record(c) };
  const nothingMoved = (why) => {
    assert.deepEqual([t.row(c).seq, t.row(c).obj, t.row(c).held], [before.row.seq, before.row.obj, 'law'], `${why}: the record did not move`);
    assert.deepEqual(t.record(c), before.rec, why);
    assert.deepEqual([t.repairs(c).length, t.staff(c).length, t.faucet().gold], [0, 0, 0], why);
  };
  const ask = { was: p.goldPieces, gold: 9_000_000 };
  const own = await t.mend(c, ask, c.who.secret);
  assert.deepEqual([own.status, own.body.error], [403, 'not-developer'], 'not the player\'s own to mend');
  const rando = await t.s.registered('rando');
  assert.equal((await t.mend(c, ask, rando.secret)).status, 403);
  assert.equal((await t.mend(c, ask, null)).status, 401);
  nothingMoved('refused callers');
  for (const [why, body] of [
    ['a purse of nothing', { was: 0 }],
    ['a purse above nothing', { was: 5 }],
    ['a purse not whole', { was: -0.5 }],
    ['no purse named', { was: undefined }],
    ['gold below nothing', { gold: -1 }],
    ['gold past one int', { gold: GOLD_INT_MAX + 1 }],
    ['gold not whole', { gold: 0.5 }],
    ['a ticket of no shape', { ticket: 'Seller Purse' }],
  ]) {
    const r = await t.mend(c, { ...ask, ...body });
    assert.deepEqual([r.status, r.body.error], [400, 'body'], why);
  }
  nothingMoved('refused mends');
  const moved = await t.mend(c, { ...ask, was: p.goldPieces + 1 });
  assert.deepEqual([moved.status, moved.body.error], [409, 'mend-moved'], 'a purse played since, or another character\'s');
  nothingMoved('not the purse reckoned from');
  const fine = await t.seat('fine');
  await t.put(fine, saveOf(seller(250)));
  const notNeg = await t.mend(fine, ask);
  assert.deepEqual([notNeg.status, notNeg.body.error], [409, 'mend-not-negative'], 'a purse that is not below nothing is never mended');
  assert.deepEqual([t.record(fine).goldPieces, t.record(fine).items.length, t.repairs(fine).length], [250, 2, 0]);
  assert.equal((await t.s.call('/v1/mod/realm-mend', { id: 'r00000000000000000000', ticket: TICKET, ...ask }, t.mac.secret)).status, 404);
  t.raw.prepare('UPDATE realm_characters SET dead_at = 1 WHERE id = ?').run(c.id);
  const dead = await t.mend(c, ask);
  assert.deepEqual([dead.status, dead.body.error], [409, 'dead']);
  nothingMoved('the dead');
  for (const word of ['mend-not-negative', 'mend-moved', 'repair-ticket']) assert.notEqual(accountRefusalText(word), accountRefusalText('frobnicated'), `${word} is said in words`);
});

test('PURSE-MEND ONCE A TICKET: the same ticket again is the mend it was - answered again, nothing moved, no second letter or faucet; two asked at once, one lands; and a ticket names one act - a mend\'s ticket asked as a repair, or a repair\'s as a mend, is refused (409 repair-ticket) (mutants: the ticket unread; the row out of the batch; a ticket of either kind)', async () => {
  const t = await stand();
  const c = await t.seat('seller');
  const p = wrapped();
  await t.put(c, saveOf(p));
  const first = await t.mend(c, { was: p.goldPieces, gold: 9_000_000 });
  assert.equal(first.status, 200);
  const once = { row: t.row(c), rec: t.record(c), faucet: t.faucet() };
  const again = await t.mend(c, { was: p.goldPieces, gold: 9_000_000, note: 'asked twice' });
  assert.equal(again.status, 200);
  assert.deepEqual({ ...again.body, at: 0 }, { ...first.body, repeat: true, at: 0 }, 'the first mend\'s answer, marked a repeat');
  assert.deepEqual([t.row(c).seq, t.row(c).obj], [once.row.seq, once.row.obj], 'the record did not move');
  assert.deepEqual(t.record(c), once.rec);
  assert.deepEqual(t.faucet(), once.faucet);
  assert.deepEqual([t.repairs(c).length, t.staff(c).length], [1, 1]);
  // asked twice at once: one lands; the other finds its row, or meets the ticket's key in its batch and answers the row
  const c2 = await t.seat('twice');
  const p2 = wrapped();
  await t.put(c2, saveOf(p2));
  const both = await Promise.all([t.mend(c2, { was: p2.goldPieces, gold: 9_000_000 }), t.mend(c2, { was: p2.goldPieces, gold: 9_000_000 })]);
  assert.deepEqual(both.map((b) => b.status), [200, 200]);
  assert.deepEqual(both.map((b) => b.body.repeat).sort(), [false, true]);
  assert.deepEqual(t.record(c2).items.filter((it) => it.value === 9_000_000).length, 1, 'once');
  // a ticket names one act: the mend's, asked as a repair
  const asRepair = await t.s.call('/v1/mod/realm-repair', { id: c.id, ticket: TICKET, faction: 8, flag: FACTION_FLAGS.Summoned, gold: 0 }, t.mac.secret);
  assert.deepEqual([asRepair.status, asRepair.body.error], [409, 'repair-ticket']);
  // ...and a repair's, asked as a mend (SUMMON-REPAIR's own: Hermaeus Mora summoned, on a record the old counter also paid below nothing)
  const both2 = await t.seat('summoned');
  const p3 = wrapped(12_345, { dict: new Map([[8, { rep: 0, flags: 0x41, power: 50 }]]) });
  await t.put(both2, saveOf(p3));
  assert.equal((await t.s.call('/v1/mod/realm-repair', { id: both2.id, ticket: TICKET, faction: 8, flag: FACTION_FLAGS.Summoned, gold: 0 }, t.mac.secret)).status, 200);
  const asMend = await t.mend(both2, { was: p3.goldPieces, gold: 9_000_000 });
  assert.deepEqual([asMend.status, asMend.body.error, t.record(both2).goldPieces], [409, 'repair-ticket', p3.goldPieces], 'the repair\'s ticket mends nothing');
  assert.equal((await t.mend(both2, { ticket: 'fb1019f-purse-mend-2', was: p3.goldPieces, gold: 9_000_000 })).status, 200, 'a ticket of its own does');
});

test('PURSE-MEND THE COMMAND: `findings <id>` says the purse, and `mend <id> <ticket> <was> <gold> [note]` builds the act - checked by the law the service checks it by, so a typo is refused by the tool before it is sent; the command as built is the act the service takes (mutants: the purse unread; the purse it names read loosely)', async () => {
  const t = await stand();
  const c = await t.seat('seller');
  const p = wrapped();
  await t.put(c, saveOf(p));
  const look = reviewRequest(['findings', c.id]);
  assert.deepEqual(look, { path: '/v1/mod/realm-findings', body: { id: c.id } });
  assert.equal((await t.s.call(look.path, look.body, t.mac.secret)).body.character.purse, -7_476_871);
  assert.deepEqual(reviewRequest(['mend', c.id, TICKET, '-7476871', '9300345', 'the', 'wrapped', 'sale']), {
    path: '/v1/mod/realm-mend', body: { id: c.id, ticket: TICKET, was: -7_476_871, gold: 9_300_345, note: 'the wrapped sale' },
  });
  for (const bad of [['7476871', '9300345'], ['-0', '9300345'], ['-7.5e6', '9300345'], ['-7476871', '-5'], ['-7476871', '9.3e6'], ['-7476871', String(GOLD_INT_MAX + 1)], ['-7476871']]) {
    assert.ok('usage' in reviewRequest(['mend', c.id, TICKET, ...bad]), bad.join(' '));
  }
  assert.deepEqual(purseMendOf({ ticket: TICKET, was: -1, gold: GOLD_INT_MAX }), { ticket: TICKET, was: -1, gold: GOLD_INT_MAX }, 'one letter\'s worth at most');
  const req = reviewRequest(['mend', c.id, TICKET, '-7476871', '9300345']);
  const done = await t.s.call(req.path, req.body, t.mac.secret);
  assert.deepEqual([done.status, done.body.held, t.record(c).goldPieces, t.record(c).items[0].value], [200, null, 0, 9_300_345]);
});

test('PURSE-MEND THE LEFTOVERS: a trade lot past 2^31 haggles by its halves and quarters - the right band, where `>> 1` wrapped and named the wrong one - and the same band as DFU\'s shifts for every cost an int holds; the Reforge\'s purse says the gold of letters past one int\'s worth (mutants: the shifts back; the purse\'s `| 0` back)', () => {
  // 25,000 Daedric claymores at a quality-10 counter: a cost past 2^31
  const lot = claymores(25_000);
  const bands = [];
  for (const [mode, sk] of [['Sell', { mercantile: 0, personality: 0 }], ['Buy', { mercantile: 0, personality: 0 }], ['Sell', SKILLS], ['Buy', SKILLS]]) {
    const cost = tradeCost(mode, lot, { quality: 10, online: false }).cost;
    assert.ok(cost > 2 ** 31, 'past one int');
    const price = getTradePrice(mode, cost, 10, sk);
    bands.push([tradeMessageOffset(mode, cost, price), price < cost / 2 ? 0 : price < cost * 3 / 4 ? 1 : 2]);
  }
  assert.deepEqual(bands.map(([band]) => band), [3, 2, 4, 0], 'sold under half; bought at three quarters; sold between; bought under half');
  assert.deepEqual(bands.map(([band, want], i) => band - (i % 2 === 0 ? 3 : 0) === want), [true, true, true, true]);
  // below 2^31, DFU's shifts to the band (DaggerfallTradeWindow ShowTradePopup; DaggerfallGuildServiceCureDisease)
  const shifts = (cost, price) => ((cost >> 1) <= price ? ((cost - (cost >> 2)) <= price ? 2 : 1) : 0);
  for (const cost of [0, 1, 2, 3, 5, 7, 99, 100, 101, 1_001, 46_081, 2 ** 31 - 1]) {
    for (const price of new Set([0, cost >> 2, (cost >> 1) - 1, cost >> 1, (cost >> 1) + 1, cost - (cost >> 2) - 1, cost - (cost >> 2), cost])) {
      assert.equal(cureOfferMessageOffset(cost, price), shifts(cost, price), `cost ${cost}, price ${price}`);
    }
  }
  // the Reforge's purse: the coins and the letters, two letters of one int's worth each
  const me = { goldPieces: 7, items: [letterOfCredit(GOLD_INT_MAX), letterOfCredit(GOLD_INT_MAX)] };
  const gold = totalGoldAmount(me);
  assert.equal(gold, 2 * GOLD_INT_MAX + 7);
  assert.ok(reforgePurseText(0, gold).endsWith(` ${gold} gold`), reforgePurseText(0, gold));
  _resetForTests();
  setPref('lootRarity', true);
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      pages: ['lift'], page: 'lift', items: () => me.items, payer: () => me, gold: () => totalGoldAmount(me), picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), lift: () => ({ ok: false }),
    });
    try {
      const purse = (function find(n) { return n?.classList?.contains('broker-purse') ? n : (n?.children ?? []).map(find).find(Boolean) ?? null; })(host);
      assert.equal(purse?.textContent, `${gold} gold`, 'the temple\'s page says it too');
    } finally {
      view?.dispose?.();
    }
  });
  _resetForTests();
});

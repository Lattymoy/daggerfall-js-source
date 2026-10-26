// WILD-INSURE and REPEAT-SHIELD (2026-10-26, the owner: "Overhauling the open PvP to be a bit more palatable, being able to
// insure gear on death ... while retaining its punishment"; asked, "Kept, policy spent" at "20% of worth", and the
// "Repeat-kill shield" - bible/11-Multiplayer/Wild-Zone.md sections 4b and 4c). A policy on a piece of gear is written by
// the account service against its premium off the record (server-account/src/wildInsure.js) and keeps that piece from a
// kill in the zone - never offered to the killer, never dropped - once in force; the kill spends it
// (server-account/src/wild.js). A kill by the same hand inside half an hour takes nothing at all. Every piece here is the
// producers' own (createWeapon, applyRarity, the starting kit), its id stamped as the realm checkpoint stamps it; the
// service is the real Worker over the real migrations (test/accountDb.mjs).
import '../../modsOff.js';
import '../../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf } from '../../realmSeat.mjs';
import { seeded } from '../../honestItems.mjs';
import { hostText } from '../../hostText.mjs';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import { assignStartingGear } from '../../../src/systems/startingGear.js';
import { equipItem, isEquipped } from '../../../src/systems/equip.js';
import { snapshotPlayer } from '../../../src/systems/save/save.js';
import { stampItemIds, ledgerKeyOf } from '../../../src/systems/item/itemIds.js';
import { itemWorth } from '../../../src/systems/item/itemLaw.js';
import { letterOfCredit } from '../../../src/systems/inventory.js';
import { createPotion } from '../../../src/systems/loot/loot.js';
import { takeWildDeath, wornOffer, wildDropCandidates, wildPickOf } from '../../../src/systems/wild/wildDropLaw.js';
import { wildInsurable, wildPremium, wildPolicyInForce, wildInsuredBy, wildPolicyHeld, wildInsureTargets, wildPolicyKeyOk, WILD_INSURE_DIVISOR, WILD_INSURE_SETTLE_S, WILD_INSURE_MAX } from '../../../src/systems/wild/wildInsureLaw.js';
import { WILD_REPEAT_S } from '../../../server-account/src/wild.js';
import { createWildInsureBook } from '../../../src/net/wild/wildInsureBook.js';
import { setWildDeath, wildDeathLines, WILD_TEXT } from '../../../src/systems/wild/wildZone.js';
import { REFUSALS } from '../../../src/net/accountClient.js';
import { WILD_REF } from '../../../src/net/wild/wildRef.js';
import { mintWildReceipt } from '../../../src/net/wild/wildReceipt.js';
import { worldRoom } from '../../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const CELL = worldRoom(520, 110);
const nowS = () => Math.floor(Date.now() / 1000);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const LONGSWORD = 120, CLAYMORE = 122, BATTLE_AXE = 127, STEEL = 3, IRON = 1;

/** Riadne: the starting kit, a Magic longsword WORN, a Magic claymore carried in the bag, an iron battle axe worn, a
 *  letter of credit and a potion; 2,000 gold in her purse. Ids stamped as the realm checkpoint stamps them. */
function pack() {
  const e = { name: 'Riadne', gender: 'female', level: 12, items: [], wagonItems: [], goldPieces: 2000 };
  assignStartingGear(e, { classIndex: 16, rolls: seeded(3) });
  e.goldPieces = 2000;
  const sword = applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8));
  const claymore = applyRarity(createWeapon(CLAYMORE, STEEL, seeded(10)), 'magic', seeded(11));
  const axe = createWeapon(BATTLE_AXE, IRON, seeded(9));
  e.items.push(sword, claymore, axe, letterOfCredit(3000), createPotion('healing'));
  assert.notEqual(equipItem(e, sword), null);
  assert.notEqual(equipItem(e, axe), null);
  stampItemIds(e);
  return { e, sword, claymore, axe };
}
const recordOfE = (e) => JSON.parse(JSON.stringify(snapshotPlayer(e, {})));
const byKey = (list, key) => list.find((it) => ledgerKeyOf(it) === key);

test('WILD-INSURE THE LAW (systems/wild/wildInsureLaw.js): a piece the ledger follows that a death could take may be insured - never a plain piece, a letter, a potion or a bound piece; the premium a fifth of its worth rounded up; in force WILD_INSURE_SETTLE_S after it is written, past the killer\'s pick (mutants: the premium a tenth; rounded down; in force at once; a letter insurable; a plain piece insurable)', () => {
  const { e, sword, claymore, axe } = pack();
  assert.equal(wildInsurable(sword), true, 'a Magic longsword, worn');
  assert.equal(wildInsurable(claymore), true, 'a Magic claymore, carried');
  assert.equal(wildInsurable(axe), false, 'a plain axe: no piece the ledger follows');
  assert.equal(wildInsurable(e.items.find((it) => it.templateIndex === 275)), false, 'a letter of credit: coin, which pays its tenth');
  assert.equal(wildInsurable(e.items.find((it) => it.group === 'UselessItems1')), false, 'a potion: kept anyway');
  assert.equal(wildInsurable({ ...sword, bound: true }), false, 'a bound piece: never leaves');
  assert.deepEqual(wildInsureTargets(e).map(ledgerKeyOf).sort(), [ledgerKeyOf(sword), ledgerKeyOf(claymore)].sort(), 'the pack\'s insurable pieces, worn or not');
  assert.equal(WILD_INSURE_DIVISOR, 5, 'a fifth - the owner\'s "20% of worth"');
  assert.equal(wildPremium(sword), Math.ceil(itemWorth(sword) / 5));
  assert.equal(wildPremium({ ...sword, value: 1001 }), Math.ceil(itemWorth({ ...sword, value: 1001 }) / 5), 'rounded up');
  assert.ok(wildPremium(sword) >= 1);
  assert.ok(WILD_INSURE_SETTLE_S * 1000 > WILD_REF.pickMs, 'in force only past the killer\'s pick: a policy written on the death screen keeps from nothing');
  assert.equal(wildPolicyInForce(1000, 1000 + WILD_INSURE_SETTLE_S), true);
  assert.equal(wildPolicyInForce(1000, 1000 + WILD_INSURE_SETTLE_S - 1), false);
  assert.equal(wildPolicyKeyOk(ledgerKeyOf(sword)), true);
  assert.equal(wildPolicyKeyOk('nope'), false);
});

test('WILD-INSURE THE DROP, AUDIT PVP-EASE L1-3 + L2-2 (wildDropLaw.js wornOffer, wildPickOf, takeWildDeath\'s `saved`, wildDropCandidates; the owner: a policy spent "only when it saved the piece"): the killer\'s offer reads no policy - one offer at both ends, whatever book either read; a pick of an insured worn piece lands on nothing; an insured bag piece never drops; a death spends the policies of what it WOULD have taken - the picked piece, the bag\'s - and none on a worn piece no pick named, in a hall that searches no body; the ledger is asked of no insured piece (mutants: the offer reads the policy; the pick blind to it; the drop blind to it; every insured piece spent; the candidates blind to it)', () => {
  const { e, sword, claymore, axe } = pack();
  const sk = ledgerKeyOf(sword), ck = ledgerKeyOf(claymore);
  const insured = wildInsuredBy([sk, ck]);
  const offer = wornOffer(e.items);
  assert.ok(offer.includes(sword) && offer.includes(axe), 'both worn pieces offered, the insured sword too');
  // the killer picks the axe: the axe goes, the claymore stays and is saved, the sword no pick named stays in force
  const w = offer.indexOf(axe);
  assert.equal(wildPickOf(e.items, w, [BATTLE_AXE, IRON]), axe, 'the pick of the axe is the axe');
  const rec = recordOfE(e);
  const cand = wildDropCandidates(rec, w, [BATTLE_AXE, IRON], { insured }).map((it) => it.templateIndex);
  assert.ok(cand.includes(BATTLE_AXE) && !cand.includes(LONGSWORD) && !cand.includes(CLAYMORE), 'the ledger asked of neither insured piece');
  const d = takeWildDeath(rec, w, () => false, [BATTLE_AXE, IRON], { insured });
  assert.equal(d.killer, true, 'the axe, the killer\'s');
  assert.ok(!d.taken.some((it) => it.templateIndex === LONGSWORD || it.templateIndex === CLAYMORE), 'neither insured piece taken');
  assert.ok(byKey(rec.items, sk) && isEquipped(byKey(rec.items, sk)), 'the sword still worn');
  assert.ok(byKey(rec.items, ck), 'the claymore still carried');
  assert.deepEqual(d.saved, [ck], 'spent: the claymore the drop would have carried - not the sword, which no pick named');
  // the killer picks the insured sword: it stays, its policy spent with the claymore's
  const picked = recordOfE(e);
  const pd = takeWildDeath(picked, offer.indexOf(sword), () => false, [LONGSWORD, STEEL], { insured });
  assert.equal(pd.killer, false, 'the pick lands on nothing');
  assert.ok(byKey(picked.items, sk), 'the sword stays');
  assert.deepEqual(pd.saved.sort(), [sk, ck].sort(), 'both saved: the pick and the bag');
  // a hall that searches no body (w -1): the bag's alone
  const hall = takeWildDeath(recordOfE(e), -1, () => false, null, { insured });
  assert.deepEqual(hall.saved, [ck], 'no pick: the worn sword\'s policy stays in force');
  // a piece the ledger keeps (`keep`) was never at risk: nothing saved by the policy
  const kept = takeWildDeath(recordOfE(e), -1, (it) => ledgerKeyOf(it) === ck, null, { insured });
  assert.deepEqual(kept.saved, [], 'the ledger kept the claymore anyway: its policy unspent');
  assert.deepEqual(takeWildDeath(recordOfE(e), -1, () => false, null).saved, [], 'no policies: nothing saved');
});

test('WILD-INSURE A POLICY\'S PIECE HELD, AUDIT PVP-EASE L1-2 (wildInsureLaw.js wildPolicyHeld): a piece is the character\'s while its key is anywhere in the record - the pack, the cart, any list - and gone once it is nowhere (mutants: the pack alone read; held always)', () => {
  const { e, sword } = pack();
  const key = ledgerKeyOf(sword);
  const rec = recordOfE(e);
  assert.equal(wildPolicyHeld(rec, key), true, 'worn');
  const moved = { ...rec, items: rec.items.filter((it) => ledgerKeyOf(it) !== key), wagonItems: [byKey(rec.items, key)] };
  assert.equal(wildPolicyHeld(moved, key), true, 'in the cart: still hers');
  assert.equal(wildPolicyHeld({ ...moved, wagonItems: [] }, key), false, 'sold: gone');
});

/** Riadne's realm character in the real service, Borin her killer; her record the game's own. */
async function stood() {
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin'), cy = await svc.registered('Cyrus');
  const p = pack();
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', recordOfE(p.e));
  const record = () => recordOf(svc.env, R.id);
  const insure = (keys, o = {}) => quiet(() => svc.call('/v1/wild/insure', { realm: R.at(), keys, ...o }, ria.secret));
  const policies = () => quiet(() => svc.call('/v1/wild/policies', { character: R.id }, ria.secret));
  const receipt = (o = {}) => mintWildReceipt({ f: ria.id, c: R.id, k: (o.by ?? bo).id, r: o.r ?? '0123456789ab', w: o.w ?? 0, wt: o.wt ?? [LONGSWORD, STEEL] }, svc.gatePriv, { subtle, nowS: o.nowS ?? nowS() });
  const fall = async (o = {}) => quiet(async () => svc.call('/v1/wild/fall', { room: CELL, receipt: await receipt(o), realm: R.at(), letters: 1 }, ria.secret));
  /** Age every policy in force past its settle (the clock a pin cannot wait out). */
  const settle = () => svc.env.DB._raw.prepare('UPDATE wild_insurance SET at = at - ?').run(WILD_INSURE_SETTLE_S + 5);
  return { svc, ria, bo, cy, R, record, insure, policies, fall, settle, ...p };
}

test('WILD-INSURE THE SERVICE, WRITTEN (server-account/src/wildInsure.js): a policy is paid off the record - a fifth of the piece\'s worth out of the purse - and written in the same act, the record\'s sequence moved once; listed for the tab with when it is in force; refused a piece under a policy, a plain piece, a piece not carried, a malformed ask and a premium the record cannot pay, nothing moved (mutants: the premium unpaid; a second policy on one piece; a plain piece insured; the gold unchecked)', async () => {
  const s = await stood();
  const key = ledgerKeyOf(s.sword), premium = wildPremium(s.sword);
  const at = s.R.at();
  const r = await s.insure([key]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.gold, r.body.policies.map((p) => [p.key, p.premium, p.live - p.at]), r.body.realm.seq], [premium, [[key, premium, WILD_INSURE_SETTLE_S]], at.seq + 1]);
  assert.equal(s.record().goldPieces, 2000 - premium, 'the premium off the purse');
  const listed = await s.policies();
  assert.deepEqual(listed.body.policies.map((p) => p.key), [key], 'listed for the tab');
  const was = s.record();
  for (const [why, keys, error] of [['already insured', [key], 'insure-held'], ['a plain piece', [ledgerKeyOf(s.axe)], 'body'], ['no such piece', ['00000000000000ff'], 'insure-piece'], ['twice in one ask', [ledgerKeyOf(s.claymore), ledgerKeyOf(s.claymore)], 'body'], ['none', [], 'body']]) {
    const no = await s.insure(keys);
    assert.equal(no.body.error, error, `${why}: ${JSON.stringify(no.body)}`);
  }
  assert.deepEqual(s.record(), was, 'nothing moved by a refusal');
  // the premium past what she holds
  s.svc.env.DB._raw.prepare('UPDATE realm_characters SET seq = seq').run();
  const poor = await stood();
  const save = poor.record();
  save.goldPieces = 1;
  save.items = save.items.filter((it) => it.templateIndex !== 275);   // no letter to pay from either
  const { layRecord } = await import('../../realmSeat.mjs');
  layRecord(poor.svc.env, poor.R.id, save);
  const short = await poor.insure([ledgerKeyOf(poor.claymore)]);
  assert.equal(short.body.error, 'realm-gold', JSON.stringify(short.body));
  assert.equal(poor.record().goldPieces, 1, 'nothing paid');
  assert.equal(WILD_INSURE_MAX, 32);
});

test('WILD-INSURE THE SERVICE, A KILL (server-account/src/wild.js wildFall): a policy in force keeps its piece - the killer\'s pick of the insured sword lands on nothing, the insured claymore never drops - and is spent in the fall\'s own batch, named in the answer; the next kill finds no policy and takes the claymore; a policy written too late for the fall keeps nothing; AUDIT PVP-EASE L1-3: a kill that picks nothing spends the bag\'s policy alone, the worn sword\'s stays in force (mutants: the policies unread; spent unread; the settle unread; spent outside the batch; every carried policy spent)', async () => {
  const s = await stood();
  const sk = ledgerKeyOf(s.sword), ck = ledgerKeyOf(s.claymore);
  assert.equal((await s.insure([sk, ck])).status, 200);
  s.settle();
  const r = await s.fall({ w: 0, wt: [LONGSWORD, STEEL] });   // an old tab's offer showed the sword first
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.wi, r.body.insured.sort()], [-1, [sk, ck].sort()], 'no piece of the killer\'s; the keys kept');
  assert.ok(!r.body.took.some((x) => x.t === LONGSWORD || x.t === CLAYMORE), 'neither taken');
  const rec = s.record();
  assert.ok(byKey(rec.items, sk) && byKey(rec.items, ck), 'both on the record');
  const rows = s.svc.env.DB._raw.prepare('SELECT key, state, spent_r FROM wild_insurance WHERE char_id = ? ORDER BY key').all(s.R.id).map((x) => ({ ...x }));
  assert.deepEqual(rows, [sk, ck].sort().map((key) => ({ key, state: 'spent', spent_r: '0123456789ab' })), 'spent by the fall that kept them');
  assert.deepEqual((await s.policies()).body.policies, [], 'none in force');
  // the next kill, by another hand (the shield is Borin's), finds no policy
  const next = await s.fall({ by: s.cy, r: '0123456789ac', w: -1 });
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.ok(next.body.took.some((x) => x.t === CLAYMORE), 'the claymore drops now');
  assert.equal(next.body.insured, undefined);
  // a policy written after the fall it would keep from: the receipt was signed before it was in force
  const late = await stood();
  const lk = ledgerKeyOf(late.claymore);
  assert.equal((await late.insure([lk])).status, 200);
  const lr = await late.fall({ w: -1 });
  assert.ok(lr.body.took.some((x) => x.t === CLAYMORE), 'not in force: taken');
  assert.equal(late.svc.env.DB._raw.prepare('SELECT state FROM wild_insurance WHERE key = ?').get(lk).state, 'active', 'and not spent');
  assert.ok(rd('server-account/src/wild.js').includes("...spent.map((k) => ctx.db.prepare(\"UPDATE wild_insurance SET state = 'spent'"), 'spent in the batch that keeps');
  // AUDIT PVP-EASE L1-3: no pick (a hall, or the minute let pass) - the sword was never at risk
  const hall = await stood();
  const hs = ledgerKeyOf(hall.sword), hc = ledgerKeyOf(hall.claymore);
  assert.equal((await hall.insure([hs, hc])).status, 200);
  hall.settle();
  const hr = await hall.fall({ w: -1 });
  assert.equal(hr.status, 200, JSON.stringify(hr.body));
  assert.deepEqual(hr.body.insured, [hc], 'the claymore\'s policy saved it');
  const state = (k) => hall.svc.env.DB._raw.prepare('SELECT state FROM wild_insurance WHERE key = ?').get(k).state;
  assert.deepEqual([state(hs), state(hc)], ['active', 'spent'], 'the sword\'s policy stays in force');
});

test('WILD-INSURE THE CAP, AUDIT PVP-EASE L1-2 + L4-2 (server-account/src/wildInsure.js): a policy whose piece the record holds nowhere lapses at the next insure, in its batch, and never counts toward WILD_INSURE_MAX - thirty-two policies on pieces sold never shut the door (mutants: the lapse unwritten; every active policy counted)', async () => {
  const s = await stood();
  const { layRecord } = await import('../../realmSeat.mjs');
  const ck = ledgerKeyOf(s.claymore);
  // thirty-two policies on pieces she no longer holds: what a season of selling insured gear leaves
  const at = nowS() - 3600;
  for (let i = 0; i < WILD_INSURE_MAX; i++) s.svc.env.DB._raw.prepare("INSERT INTO wild_insurance (char_id, key, player, premium, at, state) VALUES (?, ?, ?, 10, ?, 'active')").run(s.R.id, (0xa000 + i).toString(16).padStart(16, '0'), s.ria.id, at);
  layRecord(s.svc.env, s.R.id, s.record());
  const r = await s.insure([ck]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const states = s.svc.env.DB._raw.prepare('SELECT state, COUNT(*) AS n FROM wild_insurance WHERE char_id = ? GROUP BY state ORDER BY state').all(s.R.id).map((x) => [x.state, x.n]);
  assert.deepEqual(states, [['active', 1], ['lapsed', WILD_INSURE_MAX]], 'the gone pieces\' policies lapsed, the claymore\'s written');
  // and a cap of policies on pieces she DOES hold still refuses
  const full = await stood();
  const fsk = ledgerKeyOf(full.sword), fck = ledgerKeyOf(full.claymore);
  const save = full.record();
  for (let i = 0; i < WILD_INSURE_MAX - 1; i++) save.wagonItems.push({ ...JSON.parse(JSON.stringify(byKey(save.items, fsk))), uid: (0xb000 + i).toString(16).padStart(16, '0') });
  layRecord(full.svc.env, full.R.id, save);
  for (let i = 0; i < WILD_INSURE_MAX - 1; i++) full.svc.env.DB._raw.prepare("INSERT INTO wild_insurance (char_id, key, player, premium, at, state) VALUES (?, ?, ?, 10, ?, 'active')").run(full.R.id, (0xb000 + i).toString(16).padStart(16, '0'), full.ria.id, at);
  assert.equal((await full.insure([fsk])).status, 200, 'the thirty-second');
  const no = await full.insure([fck]);
  assert.equal(no.body.error, 'insure-full', JSON.stringify(no.body));
});

test('REPEAT-SHIELD THE SERVICE (server-account/src/wild.js wildShielded): a second kill by the same hand inside WILD_REPEAT_S takes nothing - no worn piece, no bag, no gold - spends no policy and moves no record, and says so; another hand takes as ever; past the half hour the same hand takes again; asked again, the shield\'s answer is the same (mutants: the shield unread; the window unread; the killer unread; a policy spent under the shield)', async () => {
  const s = await stood();
  assert.equal(WILD_REPEAT_S, 30 * 60, 'the owner\'s half hour');
  const first = await s.fall({ w: -1 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.ok(first.body.took.length > 0, 'the first kill takes');
  const sk = ledgerKeyOf(s.sword);
  assert.ok(byKey(s.record().items, sk), 'the worn sword: no pick, still hers');
  assert.equal((await s.insure([sk])).status, 200, 'insured between the kills');
  s.settle();
  const seq = s.R.at().seq, gold = s.record().goldPieces;
  const again = await s.fall({ r: '0123456789ad', w: 0, wt: [BATTLE_AXE, IRON] });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual([again.body.shield, again.body.items, again.body.took, again.body.order, again.body.wi], [true, [], [], null, -1], 'nothing taken');
  assert.deepEqual([s.R.at().seq, s.record().goldPieces], [seq, gold], 'the record untouched');
  assert.equal(s.svc.env.DB._raw.prepare('SELECT state FROM wild_insurance WHERE key = ?').get(sk).state, 'active', 'its policy unspent');
  const asked = await s.fall({ r: '0123456789ad', w: 0, wt: [BATTLE_AXE, IRON] });
  assert.equal(asked.body.shield, true, 'asked again, the same');
  // another hand
  const other = await s.fall({ by: s.cy, r: '0123456789ae', w: -1 });
  assert.equal(other.body.shield, undefined, 'Cyrus takes as ever');
  // past the half hour, between the kills
  s.svc.env.DB._raw.prepare('UPDATE wild_falls SET ki = ki - ? WHERE killer = ?').run(WILD_REPEAT_S + 1, s.bo.id);
  const later = await s.fall({ r: '0123456789af', w: -1 });
  assert.equal(later.body.shield, undefined, 'past the half hour: Borin takes again');
});

test('REPEAT-SHIELD AUDIT PVP-EASE L1-1 (server-account/src/wild.js): the half hour is between the KILLS - the receipts\' signing - so a second kill five minutes after the first is shielded however late its receipt is carried (a receipt is good for an hour); kills more than half an hour apart are not, whichever is carried first (mutants: the window by when each was carried; one side of it alone)', async () => {
  const s = await stood();
  const t0 = nowS() - 1500;   // the first kill, signed 25 minutes ago
  const first = await s.fall({ w: -1, nowS: t0 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  s.svc.env.DB._raw.prepare('UPDATE wild_falls SET at = at - ? WHERE killer = ?').run(WILD_REPEAT_S + 60, s.bo.id);   // carried long ago, as the row says
  const second = await s.fall({ r: '0123456789ad', w: -1, nowS: t0 + 300 });   // five minutes after it, carried now
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.shield, true, 'five minutes apart: shielded, however late it was carried');
  // an earlier kill carried after a later one: the window is either side
  const o = await stood();
  const late = await o.fall({ w: -1, nowS: nowS() - 60 });
  assert.equal(late.body.shield, undefined);
  const early = await o.fall({ r: '0123456789ad', w: -1, nowS: nowS() - 600 });
  assert.equal(early.body.shield, true, 'nine minutes before the kill already carried: shielded');
  const far = await o.fall({ r: '0123456789ae', w: -1, nowS: nowS() - 600 - WILD_REPEAT_S - 100 });
  assert.equal(far.body.shield, undefined, 'more than half an hour before both: taken');
  // a kill fifty minutes old carried now, then a fresh one: the rows hold the kills' moments, never the carrying's
  const late2 = await stood();
  assert.equal((await late2.fall({ w: -1, nowS: nowS() - 3000 })).status, 200);
  const now2 = await late2.fall({ r: '0123456789ad', w: -1 });
  assert.equal(now2.body.shield, undefined, 'fifty minutes apart, both carried now: taken');
});

test('WILD-INSURE THE BOOK (net/wild/wildInsureBook.js): the policies read once a character, and again by the card when stale (AUDIT PVP-EASE L4-1); a policy written as the record\'s act with the wallet reserved first - refused inside the zone, offline, for a piece already insured or past the wallet, before a coin is reserved; in force only past its settle; the card\'s line says which; a write that landed with its answer lost read back (L4-4); a fall\'s kept keys forgotten (mutants: the zone unread; the reserve skipped; the settle unread; spent unread; never read again; a lost answer forgotten)', async () => {
  const { sword, claymore, axe } = pack();
  const sk = ledgerKeyOf(sword);
  let clock = 1_000_000_000_000, zone = false, gold = 5000;
  const asks = [];
  let reads = 0, served = [];
  const door = {
    policies: async () => { reads++; return { ok: true, data: { policies: served } }; },
    insure: async (body) => { asks.push(body); return { ok: true, data: { policies: body.keys.map((key) => ({ key, premium: 9, at: Math.floor(clock / 1000), live: Math.floor(clock / 1000) + WILD_INSURE_SETTLE_S })), gold: 9, realm: { seq: 2 } } }; },
  };
  const reserved = [];
  const realm = { act: async (o) => { const back = o.reserve(); const r = await o.call({ id: 'r', lease: 'l', seq: 1 }); if (!r.ok) back?.(); return r; } };
  const wallet = () => ({ gold: () => gold, pay: (n) => { reserved.push(n); gold -= n; return () => { gold += n; }; }, credit: (n) => { gold += n; } });
  const book = createWildInsureBook({ door, realm, wallet, character: () => 'rchar', inZone: () => zone, now: () => clock });
  await book.read();
  assert.equal(book.offers(sword), true);
  assert.equal(book.offers(axe), false, 'a plain piece: no act offered');
  zone = true;
  assert.deepEqual(await book.insure(sword), { ok: false, text: WILD_TEXT.insureInZone() });
  assert.deepEqual([asks.length, reserved.length], [0, 0], 'refused before a coin is reserved');
  zone = false;
  gold = 1;
  assert.deepEqual(await book.insure(sword), { ok: false, text: REFUSALS['realm-gold'] });
  gold = 5000;
  const r = await book.insure(sword);
  assert.deepEqual([r.ok, asks[0].keys, reserved], [true, [sk], [wildPremium(sword)]], 'the premium reserved, the policy asked');
  assert.equal(r.text, WILD_TEXT.insureDone(wildPremium(sword)));
  assert.equal(book.offers(sword), false, 'insured');
  assert.deepEqual(await book.insure(sword), { ok: false, text: REFUSALS['insure-held'] });
  assert.equal(book.lineOf(sword), WILD_TEXT.insuredSoon(2), 'not yet in force');
  clock += WILD_INSURE_SETTLE_S * 1000;
  assert.equal(book.lineOf(sword), WILD_TEXT.insuredLine(), 'in force');
  assert.equal(book.lineOf(claymore), null);
  assert.equal(book.spent([sk]), 1);
  assert.equal(book.policyOf(sword), null, 'spent, forgotten');
  // AUDIT PVP-EASE L4-1: the card asks again when the read is stale - a policy written on another device shows
  const ck = ledgerKeyOf(claymore);
  served = [{ key: ck, premium: 9, at: Math.floor(clock / 1000) - WILD_INSURE_SETTLE_S, live: Math.floor(clock / 1000) }];
  const before = reads;
  assert.equal(book.lineOf(claymore), null, 'not yet read');
  clock += 11 * 60_000;
  book.lineOf(claymore);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(reads, before + 1, 'stale: read again');
  assert.equal(book.lineOf(claymore), WILD_TEXT.insuredLine(), 'the other device\'s policy shown');
  // AUDIT PVP-EASE L4-4: the write landed, its answer lost (realmGoldAct's `landed`) - read back, never forgotten
  const lost = createWildInsureBook({ door: { ...door, insure: async () => ({ ok: true }) }, realm, wallet, character: () => 'rchar', now: () => clock });
  served = [{ key: sk, premium: 9, at: Math.floor(clock / 1000), live: Math.floor(clock / 1000) + WILD_INSURE_SETTLE_S }];
  await lost.read();
  served = [];
  await lost.read();
  served = [{ key: sk, premium: 9, at: Math.floor(clock / 1000), live: Math.floor(clock / 1000) + WILD_INSURE_SETTLE_S }];
  const lr = await lost.insure(sword);
  assert.equal(lr.ok, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.notEqual(lost.policyOf(sword), null, 'read back');
  const off = createWildInsureBook({ door, realm: null, wallet: null, character: () => 'rchar' });
  assert.equal(off.offers(sword), false);
  assert.deepEqual(await off.insure(sword), { ok: false, text: WILD_TEXT.insureOffline() });
});

test('WILD-INSURE AND REPEAT-SHIELD THE WORDS AND THE HOST: the death screen says what insurance kept and that the shield took nothing; the pack\'s card says a piece is insured and offers Insure; the first dead frame\'s offer reads no policy (AUDIT PVP-EASE L2-2); the book is the joined character\'s on the shared clock (L4-1, L4-5); the drop\'s answer spends my policies (mutants: either line unsaid; the answer unspent; the book a stand-in\'s)', () => {
  setWildDeath({ killer: 'Borin', dropped: 2, insured: 2 });
  assert.deepEqual(wildDeathLines().slice(0, 3), [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathDrop(2), 'Insurance kept 2 pieces of your gear. Each policy that saved a piece is spent.']);
  setWildDeath({ killer: 'Borin', dropped: 0, shield: true });
  assert.equal(wildDeathLines()[0], 'The same player killed you less than half an hour ago, so nothing was taken.');
  setWildDeath(null);
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('const worn = isCellRoom(online.room) ? wornOffer(playerEntity.items) : [];'), 'the first dead frame\'s offer: the service\'s own');
  assert.ok(w.includes("character: () => realmSession?.id ?? null, region: () => _questRegionIndex() ?? 0, inZone: () => wildHere(), now: () => Date.now() + _sharedOffsetMs });"), 'the joined character, the shared clock');
  assert.ok(w.includes('const insured = wildInsure?.spent(d.insured) ?? 0;'), 'the answer spends them');
  assert.ok(w.includes('setWildInsureBook(wildInsure);'), 'the pack\'s card reads the page\'s book');
  const inv = rd('src/ui/enhanced/enhancedInventory.js');
  assert.ok(inv.includes("{ const ins = side === 'local' ? wildInsureBook()?.lineOf(picked) : null; if (ins) into.append(el('p', 'boundline insuredline', ins)); }"), 'the card says it');
  assert.ok(inv.includes('const b = el(\'button\', \'act\', WILD_TEXT.insureAct(ins.premiumOf(picked)));'), 'and offers it');
  assert.equal(WILD_TEXT.insureAct(1234), 'Insure (1,234 gold)');
});

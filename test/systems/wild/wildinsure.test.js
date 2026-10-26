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
import { wildInsurable, wildPremium, wildPolicyInForce, wildInsuredBy, wildPoliciesSpent, wildInsureTargets, wildPolicyKeyOk, WILD_INSURE_DIVISOR, WILD_INSURE_SETTLE_S, WILD_INSURE_MAX } from '../../../src/systems/wild/wildInsureLaw.js';
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

test('WILD-INSURE THE DROP (wildDropLaw.js wornOffer, wildPickOf, takeWildDeath, wildDropCandidates, wildInsureLaw.js wildPoliciesSpent): an insured worn piece is never in the killer\'s offer - one end\'s offer the other\'s, so the pick names the same piece at both - and an insured bag piece never drops; the ledger is asked of neither; the policies a death spends are those on what it carried (mutants: the offer blind to the policy; the drop blind to it; the candidates blind to it)', () => {
  const { e, sword, claymore, axe } = pack();
  const insured = wildInsuredBy([ledgerKeyOf(sword), ledgerKeyOf(claymore)]);
  const plain = wornOffer(e.items);
  assert.ok(plain.includes(sword) && plain.includes(axe), 'uninsured: both worn pieces offered (beside the kit\'s)');
  const offer = wornOffer(e.items, insured);
  assert.ok(!offer.includes(sword) && offer.includes(axe), 'insured: the sword never offered');
  assert.equal(offer.length, plain.length - 1, 'the one piece out, the rest as they were');
  const w = offer.indexOf(axe);
  assert.equal(wildPickOf(e.items, w, [BATTLE_AXE, IRON], insured), axe, 'the killer\'s pick of the axe is the axe at both ends');
  const rec = recordOfE(e);
  const cand = wildDropCandidates(rec, w, [BATTLE_AXE, IRON], { insured }).map((it) => it.templateIndex);
  assert.ok(cand.includes(BATTLE_AXE) && !cand.includes(LONGSWORD) && !cand.includes(CLAYMORE), 'the ledger asked of neither insured piece');
  const d = takeWildDeath(rec, w, () => false, [BATTLE_AXE, IRON], { insured });
  assert.equal(d.killer, true, 'the axe, the killer\'s');
  assert.ok(!d.taken.some((it) => it.templateIndex === LONGSWORD || it.templateIndex === CLAYMORE), 'neither insured piece taken');
  assert.ok(byKey(rec.items, ledgerKeyOf(sword)) && isEquipped(byKey(rec.items, ledgerKeyOf(sword))), 'the sword still worn');
  assert.ok(byKey(rec.items, ledgerKeyOf(claymore)), 'the claymore still carried');
  // an old tab's offer that showed the insured sword: the pick lands on nothing of hers
  const old = recordOfE(e);
  const od = takeWildDeath(old, plain.indexOf(sword), () => false, [LONGSWORD, STEEL], { insured });
  assert.equal(od.killer, false, 'the insured sword picked through an old offer: kept');
  // the policies spent: those on what she carried
  assert.deepEqual(wildPoliciesSpent(recordOfE(e), insured).sort(), [ledgerKeyOf(sword), ledgerKeyOf(claymore)].sort());
  assert.deepEqual(wildPoliciesSpent({ items: [] }, insured), [], 'nothing carried, nothing spent');
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

test('WILD-INSURE THE SERVICE, A KILL (server-account/src/wild.js wildFall): a policy in force keeps its piece - the killer\'s pick of the insured sword lands on nothing, the insured claymore never drops - and is spent in the fall\'s own batch, named in the answer; the next kill finds no policy and takes the claymore; a policy written too late for the fall keeps nothing (mutants: the policies unread; spent unread; the settle unread; spent outside the batch)', async () => {
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
  // past the half hour
  s.svc.env.DB._raw.prepare('UPDATE wild_falls SET at = at - ? WHERE killer = ?').run(WILD_REPEAT_S + 1, s.bo.id);
  const later = await s.fall({ r: '0123456789af', w: -1 });
  assert.equal(later.body.shield, undefined, 'past the half hour: Borin takes again');
});

test('WILD-INSURE THE BOOK (net/wild/wildInsureBook.js): the policies read once a character; a policy written as the record\'s act with the wallet reserved first - refused inside the zone, offline, for a piece already insured or past the wallet, before a coin is reserved; in force only past its settle; the card\'s line says which; a fall\'s kept keys forgotten (mutants: the zone unread; the reserve skipped; the settle unread; spent unread)', async () => {
  const { sword, claymore, axe } = pack();
  const sk = ledgerKeyOf(sword);
  let clock = 1_000_000_000_000, zone = false, gold = 5000;
  const asks = [];
  const door = {
    policies: async () => ({ ok: true, data: { policies: [] } }),
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
  assert.equal(book.insured()(sword), false, 'not yet in force');
  assert.equal(book.lineOf(sword), WILD_TEXT.insuredSoon(2));
  clock += WILD_INSURE_SETTLE_S * 1000;
  assert.equal(book.insured()(sword), true, 'in force');
  assert.equal(book.lineOf(sword), WILD_TEXT.insuredLine());
  assert.equal(book.lineOf(claymore), null);
  assert.equal(book.spent([sk]), 1);
  assert.equal(book.policyOf(sword), null, 'spent, forgotten');
  const off = createWildInsureBook({ door, realm: null, wallet: null, character: () => 'rchar' });
  assert.equal(off.offers(sword), false);
  assert.deepEqual(await off.insure(sword), { ok: false, text: WILD_TEXT.insureOffline() });
});

test('WILD-INSURE AND REPEAT-SHIELD THE WORDS AND THE HOST: the death screen says what insurance kept and that the shield took nothing; the pack\'s card says a piece is insured and offers Insure; the first dead frame offers no insured piece; the drop\'s answer spends my policies (mutants: either line unsaid; the offer blind to the policy; the answer unspent)', () => {
  setWildDeath({ killer: 'Borin', dropped: 2, insured: 2 });
  assert.deepEqual(wildDeathLines().slice(0, 3), [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathDrop(2), 'Insurance kept 2 pieces of your gear. Each policy that saved a piece is spent.']);
  setWildDeath({ killer: 'Borin', dropped: 0, shield: true });
  assert.equal(wildDeathLines()[0], 'The same player killed you less than half an hour ago, so nothing was taken.');
  setWildDeath(null);
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('const worn = isCellRoom(online.room) ? wornOffer(playerEntity.items, wildInsure.insured()) : [];'), 'the first dead frame leaves out what a policy keeps');
  assert.ok(w.includes('const insured = wildInsure?.spent(d.insured) ?? 0;'), 'the answer spends them');
  assert.ok(w.includes('setWildInsureBook(wildInsure);'), 'the pack\'s card reads the page\'s book');
  const inv = rd('src/ui/enhanced/enhancedInventory.js');
  assert.ok(inv.includes("{ const ins = side === 'local' ? wildInsureBook()?.lineOf(picked) : null; if (ins) into.append(el('p', 'boundline insuredline', ins)); }"), 'the card says it');
  assert.ok(inv.includes('const b = el(\'button\', \'act\', WILD_TEXT.insureAct(ins.premiumOf(picked)));'), 'and offers it');
  assert.equal(WILD_TEXT.insureAct(1234), 'Insure (1,234 gold)');
});

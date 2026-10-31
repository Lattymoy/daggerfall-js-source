// INSURE-ALL (2026-10-29, as the owner asked - bible/11-Multiplayer/Wild-Zone.md section 4b INSURE-ALL). Every piece of gear a death in
// the zone could take is insured at a fifth of its worth: a plain piece by an id of its own, minted when it is insured,
// which no ledger reads; and a piece the item maker enchanted at its worth and the gold the maker took. Every piece here
// is its producer's own (createWeapon, applyRarity, the smith's mint, the item maker's own act), and the service is the
// real Worker over the real migrations (test/accountDb.mjs).
import '../../modsOff.js';
import '../../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf, layRecord } from '../../realmSeat.mjs';
import { seeded } from '../../honestItems.mjs';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { createWeapon, armorOfMaterial, ARMOR_ENUM } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import { mintPiece } from '../../../src/systems/smithItems.js';
import { MASTERWORK } from '../../../src/net/recipeLaw.js';
import { applyEnchantments } from '../../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../../src/systems/enchantmentCatalogue.js';
import { equipItem, isEquipped } from '../../../src/systems/equip.js';
import { snapshotPlayer } from '../../../src/systems/save/save.js';
import { stampItemIds, ledgerKeyOf } from '../../../src/systems/item/itemIds.js';
import { itemWorth, itemFindings } from '../../../src/systems/item/itemLaw.js';
import { letterOfCredit } from '../../../src/systems/inventory.js';
import { createPotion } from '../../../src/systems/loot/loot.js';
import { takeWildDeath, wornOffer } from '../../../src/systems/wild/wildDropLaw.js';
import { pvpRewardRoll, pvpInsuredFor } from '../../../src/systems/wild/pvpReward.js';
import { wildInsurable, wildPremium, insureKeyOf, wildInsureKey, wildMakerGold, wildInsuredBy, wildPolicyHeld, WILD_INSURE_SETTLE_S } from '../../../src/systems/wild/wildInsureLaw.js';
import { createWildInsureBook } from '../../../src/net/wild/wildInsureBook.js';
import { judgeSave } from '../../../server-account/src/judge.js';
import { mintWildReceipt } from '../../../src/net/wild/wildReceipt.js';
import { worldRoom } from '../../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const nowS = () => Math.floor(Date.now() / 1000);
const LONGSWORD = 120, BATTLE_AXE = 127, STEEL = 3, IRON = 1;
const ARMOR = enchantmentSettings('StrengthensArmor', -1);   // a power: 700 of the maker's points, 7,000 gold
const BAD_REP = enchantmentSettings('BadRepWith', 0);   // a side effect: points back, no gold
const recordOfE = (e) => JSON.parse(JSON.stringify(snapshotPlayer(e, {})));

/** A Magic longsword and a plain iron battle axe, both worn; the axe minted before any id was (an old piece). */
function kit() {
  const e = { name: 'Example Player', gender: 'female', level: 12, items: [], wagonItems: [], goldPieces: 2000 };
  const sword = applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8));
  const axe = createWeapon(BATTLE_AXE, IRON, seeded(9));
  e.items.push(sword, axe, letterOfCredit(3000), createPotion('healing'));
  assert.notEqual(equipItem(e, sword), null);
  assert.notEqual(equipItem(e, axe), null);
  stampItemIds(e);
  return { e, sword, axe };
}

test('INSURE-ALL THE LAW (wildInsureLaw.js wildInsurable, insureKeyOf, wildInsureKey): a plain piece of gear, an old one with no id, may be insured - its id minted when it is, never a ledger key, never a finding, never stamped again; the premium a fifth of its worth; never a stack, a bound or quest piece, a letter, a potion or a piece of no gear (mutants: plain gear refused; a stack insurable; a bound piece insurable; a non-gear piece insurable; the plain id a ledger key; the id minted twice)', () => {
  const { sword, axe } = kit();
  assert.equal(axe.uid, undefined, 'the checkpoint\'s stamp mints no id on a plain piece');
  assert.equal(wildInsurable(axe), true, 'a plain iron axe, worn: gear a kill could take');
  assert.equal(insureKeyOf(axe), null, 'no key yet');
  const key = wildInsureKey(axe, (b) => b.fill(0xab));
  assert.equal(key, 'abababababababab');
  assert.deepEqual([axe.uid, insureKeyOf(axe), wildInsureKey(axe)], [key, key, key], 'minted once, the piece\'s own');
  assert.equal(ledgerKeyOf(axe), null, 'no ledger reads it');
  assert.deepEqual(itemFindings(axe), [], 'the item law finds nothing in it');
  assert.equal(stampItemIds({ items: [axe] }), 0);
  assert.equal(wildPremium(axe), Math.max(1, Math.ceil(itemWorth(axe) / 5)), 'a fifth of its worth');
  assert.ok(wildPremium(axe) > 1, 'a price, never the floor\'s one gold');
  assert.equal(insureKeyOf(sword), ledgerKeyOf(sword), 'a valuable piece keeps its ledger key');
  const refused = [
    ['a stack', { ...axe, uid: undefined, stackCount: 2 }],
    ['a bound piece', { ...axe, uid: undefined, bound: true }],
    ['a quest piece', { ...axe, uid: undefined, questItem: true }],
    ['a letter of credit', letterOfCredit(500)],
    ['a potion', createPotion('healing')],
    ['no gear', { group: 'MiscItems', templateIndex: 278, value: 50 }],
  ];
  for (const [why, it] of refused) {
    assert.equal(wildInsurable(it), false, why);
    assert.equal(wildInsureKey(it), null, `${why}: no key`);
    assert.equal(it.uid === undefined || it.templateIndex === 275, true, `${why}: no id minted`);
  }
  assert.equal(insureKeyOf({ ...axe, bound: true }), null, 'a bound piece\'s id keys nothing');
});

test('INSURE-ALL THE JUDGE (server-account/src/judge.js judgeSave): a plain piece\'s id moves no finding, no wealth and no ledger piece - the record judged the same with it and without it (mutants: the plain id a ledger key)', () => {
  const { e, axe } = kit();
  const without = judgeSave(recordOfE(e));
  wildInsureKey(axe);
  const rec = recordOfE(e);
  assert.equal(rec.items.find((it) => it.templateIndex === BATTLE_AXE).uid, axe.uid, 'the save carries the id');
  const withId = judgeSave(rec);
  assert.deepEqual([withId.findings, withId.wealth, withId.pieces], [without.findings, without.wealth, without.pieces]);
});

test('INSURE-ALL THE MAKER\'S GOLD (wildInsureLaw.js wildMakerGold; the report: "no cost to insure rares that are fully enchanted"): a Rare the item maker enchanted is insured at its worth and the gold its powers cost - a side effect at none, the ladder\'s own row at none, a row\'s own cost never read; itemWorth, the judge\'s measure, is unmoved (mutants: the maker\'s gold unread; a side effect paid; the row\'s own cost read; the gold per point dropped)', () => {
  setPref('lootRarity', true);
  const mw = mintPiece({ recipe: 'cuirass:daedric', quality: MASTERWORK, seed: 1, maker: 'X' }, '0123456789abcdef');
  const worth = itemWorth(mw);
  assert.deepEqual([wildMakerGold(mw), wildPremium(mw)], [0, Math.ceil(worth / 5)], 'its Rare roll: the ladder\'s, in its worth already');
  applyEnchantments(mw, [ARMOR]);
  assert.equal(itemWorth(mw), worth, 'the maker writes no value: the judge\'s measure unmoved');
  assert.deepEqual([wildMakerGold(mw), wildPremium(mw)], [7000, Math.ceil((worth + 7000) / 5)], 'the power\'s 700 points at ten gold');
  const lcg = (s) => () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const helm = Object.assign(applyRarity(armorOfMaterial(ARMOR_ENUM.Helm, ARMOR_MATERIAL.Ebony), 'rare', lcg(14)), { isIdentified: true });
  applyEnchantments(helm, [ARMOR, BAD_REP]);
  assert.equal(wildMakerGold(helm), 7000, 'the side effect costs no gold');
  const forged = { ...helm, enchantments: helm.enchantments.map((r) => (r.enchantCost !== undefined ? { ...r, enchantCost: 999_999 } : r)) };
  assert.equal(wildMakerGold(forged), 7000, 'the catalogue\'s cost, never the row\'s');
  stampItemIds({ items: [mw, helm] });
  assert.deepEqual([wildInsurable(mw), wildInsurable(helm)], [true, true], 'both insurable, keyed by the ledger');
});

test('INSURE-ALL HEADLESS (the account service\'s bundle, which registers none of the game): the plain piece and the enchanted Rare insurable at the same premium and by the same key as the game reads them (mutants: the maker\'s gold unread)', () => {
  setPref('lootRarity', true);
  const { axe } = kit();
  wildInsureKey(axe);
  const mw = mintPiece({ recipe: 'cuirass:daedric', quality: MASTERWORK, seed: 1, maker: 'X' }, '0123456789abcdef');
  applyEnchantments(mw, [ARMOR]);
  const rows = JSON.parse(JSON.stringify([axe, mw]));
  const game = rows.map((it) => [wildInsurable(it), wildPremium(it), insureKeyOf(it)]);
  const svc = new URL('../../../server-account/src/wildInsure.js', import.meta.url).href;
  const law = new URL('../../../src/systems/wild/wildInsureLaw.js', import.meta.url).href;
  const code = `await import(${JSON.stringify(svc)}); const L = await import(${JSON.stringify(law)});`
    + ` process.stdout.write(JSON.stringify(${JSON.stringify(rows)}.map((it) => [L.wildInsurable(it), L.wildPremium(it), L.insureKeyOf(it)])));`;
  const service = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }));
  assert.deepEqual(service, game);
  assert.equal(game[1][1], Math.ceil((itemWorth(mw) + 7000) / 5));
});

test('INSURE-ALL THE KEEP (wildInsureLaw.js wildInsuredBy, pvpReward.js pvpRewardRoll): an insured plain piece is never the kill\'s roll and its policy is spent when it saved it; a key two of the fallen\'s pieces carry keeps neither - a copied id buys nothing (mutants: the plain piece read by its ledger key; a shared key kept; the roll on the insured axe)', () => {
  const { e, sword, axe } = kit();
  const key = wildInsureKey(axe);
  const insured = pvpInsuredFor([key], { among: e.items });
  assert.deepEqual([insured(axe), insured(sword)], [true, false]);
  const offer = wornOffer(e.items);
  for (let n = 0; n < 4; n++) {
    const roll = pvpRewardRoll(e.items, { insured, pick: () => 0 });
    assert.equal(offer[/** @type {any} */ (roll).w], sword, 'the roll lands on the sword, never the insured axe');
  }
  assert.deepEqual(pvpRewardRoll([axe], { insured, pick: () => 0 }), { policy: key }, 'every worn piece insured: the axe\'s policy pays');
  const rec = recordOfE(e);
  const d = takeWildDeath(rec, offer.indexOf(axe), () => false, [BATTLE_AXE, IRON], { insured: pvpInsuredFor([key], { among: rec.items }), bag: false, purse: false });
  assert.deepEqual([d.killer, d.saved], [false, [key]], 'the pick of the axe lands on nothing, and spends its policy');
  // a second piece given the axe's id: the key keeps neither
  const both = [axe, { ...axe }];
  assert.equal(wildInsuredBy([key], both)(axe), false, 'two pieces by one key: neither kept');
  assert.equal(wildInsuredBy([key], [axe, sword])(axe), true, 'one piece by it: kept');
  assert.equal(wildPolicyHeld(rec, key), true, 'the record holds the plain piece by its id');
});

test('INSURE-ALL THE BOOK (net/wild/wildInsureBook.js): an old plain piece is offered, its id minted at the act and asked by, the premium a fifth of its worth; the card\'s line reads its policy by that id (mutants: the id not minted; plain gear not offered)', async () => {
  const { axe } = kit();
  const asks = [];
  const door = {
    policies: async () => ({ ok: true, data: { policies: [] } }),
    insure: async (body) => { asks.push(body); return { ok: true, data: { policies: body.keys.map((key) => ({ key, premium: 9, at: 1, live: 1 + WILD_INSURE_SETTLE_S })), gold: 9, realm: { seq: 2 } } }; },
  };
  let gold = 5000;
  const realm = { act: async (o) => { o.reserve(); return o.call({ id: 'r', lease: 'l', seq: 1 }); } };
  const wallet = () => ({ gold: () => gold, pay: (n) => { gold -= n; return () => { gold += n; }; }, credit: (n) => { gold += n; } });
  const book = createWildInsureBook({ door, realm, wallet, character: () => 'rchar', now: () => 2_000_000 });
  await book.read();
  assert.equal(axe.uid, undefined);
  assert.equal(book.offers(axe), true, 'offered with no id yet');
  const r = await book.insure(axe);
  assert.equal(r.ok, true);
  assert.ok(typeof axe.uid === 'string' && /^[0-9a-f]{16}$/.test(axe.uid), 'its id minted on the piece itself');
  assert.deepEqual(asks.map((a) => a.keys), [[axe.uid]], 'and asked by');
  assert.equal(gold, 5000 - wildPremium(axe), 'its premium reserved');
  assert.notEqual(book.policyOf(axe), null, 'the card reads its policy');
  assert.equal(book.offers(axe), false, 'insured');
});

test('INSURE-ALL THE SERVICE (server-account/src/wildInsure.js, wild.js wildFall): a plain axe insured by its id at a fifth of its worth, off the purse; a kill in force rolls on the other worn piece and the axe stays; a key two pieces carry, or another\'s, is refused (mutants: the plain piece found by its ledger key; a shared key insured)', async () => {
  const svc = await standService();
  const me = await svc.registered('ExamplePlayer'), foe = await svc.registered('ExampleFoe');
  const { e, sword, axe } = kit();
  const key = wildInsureKey(axe);   // as the book mints it, before the act's checkpoint
  const R = await seatRealm(svc.env, me.secret, 'Example Player', recordOfE(e));
  const insure = (keys) => quiet(() => svc.call('/v1/wild/insure', { realm: R.at(), keys }, me.secret));
  const premium = wildPremium(axe);
  const r = await insure([key]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.gold, r.body.policies.map((p) => [p.key, p.premium])], [premium, [[key, premium]]]);
  assert.equal(recordOf(svc.env, R.id).goldPieces, 2000 - premium, 'the premium off the purse');
  svc.env.DB._raw.prepare('UPDATE wild_insurance SET at = at - ?').run(WILD_INSURE_SETTLE_S + 5);
  const receipt = await mintWildReceipt({ f: me.id, c: R.id, k: foe.id, r: '0123456789ab', w: 0, wt: [LONGSWORD, STEEL] }, svc.gatePriv, { subtle, nowS: nowS() });
  const fall = await quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), receipt, realm: R.at(), letters: 1, collect: 1 }, me.secret));
  assert.equal(fall.status, 200, JSON.stringify(fall.body));
  assert.deepEqual(fall.body.took.map((x) => x.t), [LONGSWORD], 'the sword, the one worn piece no policy keeps');
  const after = recordOf(svc.env, R.id);
  const kept = after.items.find((it) => it.uid === key);
  assert.ok(kept && isEquipped(kept), 'the insured axe still worn');
  // a second piece carrying the axe's id: no policy may name it
  const twin = { ...after, items: [...after.items, { ...kept, equipSlot: undefined }] };
  layRecord(svc.env, R.id, twin);
  svc.env.DB._raw.prepare("UPDATE wild_insurance SET state = 'spent'").run();
  assert.equal((await insure([key])).body.error, 'insure-piece', 'a key two pieces carry');
  assert.equal((await insure(['00000000000000ff'])).body.error, 'insure-piece', 'a key the record holds no piece by');
  // the policy in force again, the twin still carried: at a fall the shared key keeps neither - the worn axe is the roll
  svc.env.DB._raw.prepare("UPDATE wild_insurance SET state = 'active', at = at - 3600").run();
  const other = await svc.registered('ExampleThird');
  const r2 = await mintWildReceipt({ f: me.id, c: R.id, k: other.id, r: '0123456789ac', w: 0, wt: [BATTLE_AXE, IRON] }, svc.gatePriv, { subtle, nowS: nowS() });
  const fall2 = await quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), receipt: r2, realm: R.at(), letters: 1, collect: 1 }, me.secret));
  assert.equal(fall2.status, 200, JSON.stringify(fall2.body));
  assert.deepEqual([fall2.body.took.map((x) => x.t), fall2.body.insured], [[BATTLE_AXE], undefined], 'the axe taken, no policy kept it');
});

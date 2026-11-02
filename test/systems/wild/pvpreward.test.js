// PVP-REWARD (the PvP rework, 2026-10-29 - bible/11-Multiplayer/PvP-Rework.md): what a kill in the open zone gives its
// killer. The law (src/systems/wild/pvpReward.js): one random worn piece no policy and no ledger hold keeps; every worn
// piece insured, one random policy's gold; the gold as coin where it fits the killer's weight, else a letter of credit;
// a villain holds no insurance. The service's side is test/systems/wild/wildinsure.test.js ("THE SERVICE, A KILL").
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pvpRewardRoll, pvpRollIndex, pvpInsuredFor, pvpPolicyGold, pvpPolicyGoldOf, pvpGoldPaid, pvpLetterOf } from '../../../src/systems/wild/pvpReward.js';
import { takeWildDeath, takeWildLastRoll, wornOffer } from '../../../src/systems/wild/wildDropLaw.js';
import { GOLD_PIECE_WEIGHT_KG, LETTER_OF_CREDIT_TEMPLATE, goldStack } from '../../../src/systems/inventory.js';
import { WILD_TEXT, setWildDeath, wildDeathLines } from '../../../src/systems/wild/wildZone.js';
import { WILD_REF } from '../../../src/net/wild/wildRef.js';
import { WILD_BODY_MS } from '../../../src/net/wild/wildFight.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = (t, o = {}) => ({ group: 'Weapons', templateIndex: t, material: 0, value: 100, currentCondition: 1000, maxCondition: 1000, ...o });
/** Three worn pieces (two Magic, keyed by id), one in the bag. */
const pack = () => [
  W(113, { equipSlot: 5, uid: '00000000000000a1', magic: true }),
  W(121, { equipSlot: 6, uid: '00000000000000a3' }),
  W(120, { uid: '00000000000000a2', magic: true }),
  W(116, { equipSlot: 7, uid: '00000000000000a4', magic: true }),
];
const by = (keys) => (it) => keys.includes(it.uid);
const first = () => 0, last = (n) => n - 1;

test('PVP-REWARD THE ROLL: one random worn piece no policy and no ledger hold keeps - every such piece reachable, never an insured or a held one, never a bag piece; every worn piece insured, one random policy; nothing worn, nothing (mutants: the roll blind to the policy; blind to the hold; the policy path never; the policy from a bag piece)', () => {
  const items = pack();
  const offer = wornOffer(items);
  assert.deepEqual(offer.map((it) => it.templateIndex), [113, 121, 116]);
  const seen = new Set();
  for (let n = 0; n < 3; n++) seen.add(pvpRewardRoll(items, { pick: () => n }).w);
  assert.deepEqual([...seen].sort(), [0, 1, 2], 'every worn piece reachable');
  // an insured piece and a held one are never rolled
  const insured = by(['00000000000000a1']), keep = by(['00000000000000a4']);
  assert.deepEqual([pvpRewardRoll(items, { insured, keep, pick: first }), pvpRewardRoll(items, { insured, keep, pick: last })], [{ w: 1 }, { w: 1 }], 'the plain axe alone');
  // every worn piece insured (the plain axe kept by the ledger): one random policy of a worn piece, never the bag's
  const all = by(['00000000000000a1', '00000000000000a4', '00000000000000a2']), axeHeld = (it) => it.templateIndex === 121;
  assert.deepEqual(pvpRewardRoll(items, { insured: all, keep: axeHeld, pick: first }), { policy: '00000000000000a1' });
  assert.deepEqual(pvpRewardRoll(items, { insured: all, keep: axeHeld, pick: last }), { policy: '00000000000000a4' }, 'the bag sword\'s policy never paid');
  assert.equal(pvpRewardRoll(items.map((it) => ({ ...it, equipSlot: undefined })), { insured: all, pick: first }), null, 'nothing worn');
  // the roll's index: a whole number under n from the service's random bytes
  assert.equal(pvpRollIndex((b) => b.fill(255), 3), 0xffffffff % 3);
  assert.equal(pvpRollIndex((b) => { b.set([0, 0, 1, 2]); return b; }, 7), 258 % 7);
  for (let i = 0; i < 50; i++) { const k = pvpRollIndex((b) => globalThis.crypto.getRandomValues(b), 5); assert.ok(k >= 0 && k < 5); }
});

test('PVP-REWARD THE VILLAIN\'S SEAM AND NO BAG DROP: a villain holds no policy - its insured piece is rolled; the take with `bag` false drops no bag piece, the purse\'s tenth still goes (mutants: the villain insured; the bag dropped)', () => {
  const items = pack();
  assert.equal(pvpInsuredFor(['00000000000000a1'])(items[0]), true);
  assert.equal(pvpInsuredFor(['00000000000000a1'], { villain: true })(items[0]), false, 'a villain: no insurance');
  const e = { items: pack(), goldPieces: 500 };
  const d = takeWildDeath(e, 1, () => false, null, { bag: false });
  assert.deepEqual([d.from, d.taken.map((it) => it.templateIndex ?? 'gold'), d.gold.purse], [['bag', 'gold'], [121, 276], 50], 'the axe and the tenth, no bag piece');
  assert.ok(e.items.some((it) => it.templateIndex === 120), 'the bag sword stays');
  assert.ok(takeWildDeath({ items: pack(), goldPieces: 500 }, 1).taken.some((it) => it.templateIndex === 120), 'the default still drops the bag');
});

test('PVP-REWARD THE GOLD: a policy\'s gold is a coin pile; paid as coin where it fits the killer\'s free weight, else a letter of credit for the whole - DFU\'s trade-window rule; no weight said, a letter (mutants: coin past the weight; coin with no weight said)', () => {
  const g = pvpPolicyGold(800);
  assert.deepEqual([pvpPolicyGoldOf(g), pvpPolicyGoldOf(W(121)), pvpPolicyGoldOf(null)], [800, 0, 0]);
  assert.deepEqual(g, goldStack(800));
  assert.equal(pvpGoldPaid(800, 800 * GOLD_PIECE_WEIGHT_KG), 'gold');
  assert.equal(pvpGoldPaid(800, 800 * GOLD_PIECE_WEIGHT_KG - 0.001), 'letter');
  assert.equal(pvpGoldPaid(800, undefined), 'letter');
  assert.equal(pvpGoldPaid(800, Number.NaN), 'letter');
  const l = pvpLetterOf(800, '00000000000000f1');
  assert.deepEqual([l.templateIndex, l.value, l.uid], [LETTER_OF_CREDIT_TEMPLATE, 800, '00000000000000f1']);
});

test('PVP-REWARD THE HOST AND THE WORDS: no worn offer at my death; my collect says my free weight and a policy\'s gold is said as coin or a letter; the relay signs a fall after a short wait, the body window\'s pinned equal (mutants: the offer back; the weight unsaid)', () => {
  const w = rd('src/scenes/world.js'), eh = rd('src/scenes/wildEscrowHost.js');
  assert.ok(!w.includes('wildFight.offerWorn('), 'no worn offer');
  assert.ok(eh.includes('free: entityMaxEncumbrance(playerEntity) - carriedWeight(playerEntity),\n          }'), 'my free weight');
  assert.ok(eh.includes('if (isGoldPieces(item)) addGoldPieces(playerEntity, item.stackCount ?? 1);'), 'coin into the purse');
  assert.equal(WILD_TEXT.policyGold(1200), 'All their gear was insured. You take 1,200 gold from one policy.');
  assert.equal(WILD_TEXT.policyLetter(1200), 'All their gear was insured. The coin was too heavy, so you take a letter of credit for 1,200 gold.');
  assert.equal(WILD_REF.pickMs, 10_000);
  assert.equal(WILD_BODY_MS, WILD_REF.pickMs);
});

test('PVP-NO-TENTH THE LAST ROLL (wildDropLaw.js takeWildLastRoll): a tenth of the coin and the letters together, the purse first, the letters in bag order paying only what it cannot, each kept where it lies; a letter the ledger or a policy holds pays nothing; a tab from before the word, the purse alone; no other kill takes coin (mutants: the letters before the purse; the letters left out of the sum; the purse taken at every kill)', () => {
  const letter = (v, uid) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: v, uid });
  const rich = { goldPieces: 5000, items: [letter(20_000, '00000000000000b1')] };
  const a = takeWildLastRoll(rich, () => false, { letters: true });
  assert.deepEqual([a.pile.stackCount, a.gold, rich.goldPieces, rich.items[0].value], [2500, { purse: 2500 }, 2500, 20_000], 'the purse pays it all');
  const thin = { goldPieces: 100, items: [letter(500, '00000000000000b1'), letter(3000, '00000000000000b2')] };
  const b = takeWildLastRoll(thin, () => false, { letters: true });
  assert.deepEqual([b.pile.stackCount, b.gold, thin.goldPieces, thin.items.map((it) => it.value)], [360, { purse: 100, letters: { '00000000000000b1': 260 } }, 0, [240, 3000]], 'a tenth of 3,600: the purse, then the first letter');
  const held = { goldPieces: 0, items: [letter(500, '00000000000000b1'), letter(3000, '00000000000000b2')] };
  const c = takeWildLastRoll(held, (it) => it.uid === '00000000000000b2', { letters: true });
  assert.deepEqual([c.pile.stackCount, c.gold], [50, { purse: 0, letters: { '00000000000000b1': 50 } }], 'the held letter neither counted nor paying');
  const old = { goldPieces: 100, items: [letter(3000, '00000000000000b1')] };
  assert.deepEqual([takeWildLastRoll(old).gold, old.items[0].value], [{ purse: 10 }, 3000], 'no word: the purse alone');
  assert.equal(takeWildLastRoll({ goldPieces: 9, items: [] }).pile, null, 'nothing to take');
  const e = { items: pack(), goldPieces: 500 };
  const d = takeWildDeath(e, 1, () => false, null, { bag: false, purse: false });
  assert.deepEqual([d.from, d.gold.purse, e.goldPieces], [['bag'], 0, 500], 'a kill with a piece: the piece alone');
});

test('PVP-NO-TENTH THE WORDS AND THE HOST: the killer told the last roll\'s gold as its own, coin or letter; the fallen told what it took, never that it lies where she fell (mutants: the last roll said as a policy; the killer\'s record counted as dropped)', () => {
  const eh = rd('src/scenes/wildEscrowHost.js'), dh = rd('src/scenes/wildDropHost.js');
  assert.ok(eh.includes('const words = d.last ? [WILD_TEXT.lastGold, WILD_TEXT.lastLetter] : [WILD_TEXT.policyGold, WILD_TEXT.policyLetter];'));
  assert.ok(dh.includes('dropped: d.order ? n - (d.wi === 0 ? 1 : 0) : 0,'), 'the killer\'s one record is no drop');
  assert.equal(WILD_TEXT.lastGold(1200), 'They had no gear to take and no insurance. You take 1,200 gold, a tenth of their wealth.');
  assert.equal(WILD_TEXT.lastLetter(1200), 'They had no gear to take and no insurance. The coin was too heavy, so you take a letter of credit for 1,200 gold.');
  setWildDeath({ killer: 'Borin', dropped: 0, last: 1200, letters: Object.assign([], { letters: { n: 1, gold: 900 } }) });
  assert.deepEqual(wildDeathLines().slice(0, 2), [WILD_TEXT.deathPvp('Borin'), 'Borin took 1,200 gold, a tenth of your coin and letters of credit. You had no gear to take and no insurance.']);
  assert.ok(!wildDeathLines().some((l) => /lies where you fell/.test(l)), 'no letters\' tenth said to lie on the ground');
  setWildDeath(null);
  assert.equal(WILD_TEXT.deathLast(null, 50), 'Your killer took 50 gold, a tenth of your coin and letters of credit. You had no gear to take and no insurance.');
  assert.equal(WILD_TEXT.deathLast('Borin', 0), '');
});

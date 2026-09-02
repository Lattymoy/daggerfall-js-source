// U56 - DaggerfallInventoryWindow.TransferItem, on its own.
//
// The ladder came out of the classic window so a second screen could
// run it, and the whole point of extracting rather than copying is
// that the ORDER is one thing rather than two. These pins are that
// order: which guard fires first, which refusals speak, how much of a
// stack fits, and what happens to the stack that does not.
//
// The classic window's own behaviour is pinned where it always was
// (wagon.test.js, littlelaws.test.js, x11b.test.js, knightlygifts) -
// those suites did not change when the ladder moved, which is the
// other half of the proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planStore, planTake, applyTransfer, REFUSAL,
  WAGON_KG_LIMIT, CANNOT_HOLD_TEXT, CANNOT_CARRY_TEXT,
} from '../src/systems/itemTransfer.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../src/systems/createItem.js';
import { totalWeight, goldStack } from '../src/systems/inventory.js';

const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const cart = () => ({ group: 'Transportation', templateIndex: 93, name: 'Small Cart' });
/** Currency.Gold_pieces is template 276 (ItemEnums.cs:605-608) and
 *  IsOfTemplate compares BOTH terms - this fixture used to carry 137,
 *  which E4's interception would not have recognised as gold. */
const gold = (n = 100) => goldStack(n);
const summon = (it) => Object.assign(it, { timeForItemToDisappear: 1000 });
/** liveStat reads .stats, so a bare entity with a strength is enough
 *  to give the carry gate a MaxEncumbrance of str*1.5 kg. */
const hero = (strength) => ({ stats: { strength }, items: [] });

test('U56: the numbers and the words the ladder refuses with', () => {
  assert.equal(WAGON_KG_LIMIT, 750, 'ItemHelper.WagonKgLimit (:56)');
  // THE PROSE ITSELF, not the constant compared to itself. Every
  // other assertion in this file reads these through the same import
  // the source does, so rewording one would move both sides together
  // and pass - which is what the wagon suite had been doing since the
  // W-slice. These two lines are the only place either string is
  // actually held.
  assert.equal(CANNOT_HOLD_TEXT, 'Your wagon cannot hold any more.');
  assert.equal(CANNOT_CARRY_TEXT, 'You cannot carry any more.');
  assert.equal(REFUSAL.wagonFull.text, CANNOT_HOLD_TEXT);
  assert.equal(REFUSAL.cannotCarry.text, CANNOT_CARRY_TEXT);
});

test('U56 planStore: DFU\'s guards, in DFU\'s order', () => {
  // the plain move: whole stack, the button click
  const p = planStore(book(3), { remote: [] });
  assert.deepEqual(p, { ok: true, amount: 3, sound: 'click' });
  // a non-stacking item counts as one
  assert.equal(planStore(cart(), { remote: [] }).ok, false, 'a cart is a cart');

  // ── FIRST: the transport block (:1460-1462), and it is SILENT ──
  const t = planStore(cart(), { remote: [] });
  assert.equal(t.refusal, REFUSAL.transport);
  assert.equal(t.refusal.text, null, 'the transport block says nothing');
  // and it wins over every guard below it - a SUMMONED cart still
  // refuses as transport, which is how we know the order is real
  assert.equal(planStore(summon(cart()), { remote: [] }).refusal, REFUSAL.transport,
    'the summoned guard is running above the transport block');

  // ── SECOND: summoned (:1464-1469), and it SPEAKS ──────────────
  const s = planStore(summon(book()), { remote: [] });
  assert.equal(s.refusal, REFUSAL.summoned);
  assert.equal(s.refusal.text, CANNOT_REMOVE_ITEM_TEXT);
  // above the choose-one pile: a summoned item offered into a reward
  // list refuses for being summoned, not for the pile
  assert.equal(planStore(summon(book()), { remote: [], chooseOne: { items: [] } }).refusal,
    REFUSAL.summoned, 'the pile guard is running above the summoned one');

  // ── THIRD: nothing goes INTO a choose-one pile (G6, :1994) ────
  const c = planStore(book(), { remote: [], chooseOne: { items: [] } });
  assert.equal(c.refusal, REFUSAL.chooseOnePile);
  assert.equal(c.refusal.text, null, 'the pile refusal says nothing either');
  // NT3 (F162): and the wagon is NOT an exemption - DFU's local Remove
  // arm is `remoteItems != null && !chooseOne` (:1994), so while the
  // reward list is up nothing leaves the pack at all
  assert.equal(planStore(book(), { remote: [], chooseOne: { items: [] }, usingWagon: true }).ok, false,
    'a cart owner cannot stage into the wagon mid-choose-one');

  // ── LAST: WagonCanHoldAmount (:1425-1434) ────────────────────
  // 400 books at 2kg = 800kg offered into an empty 750kg wagon:
  // trunc(750*400/800) = 375 fit, and the rest stays behind
  const part = planStore(book(400), { remote: [], usingWagon: true });
  assert.deepEqual(part, { ok: true, amount: 375, sound: 'click' });
  // a wagon already at 750kg takes nothing, and SAYS so
  const full = planStore(book(), { remote: [book(375)], usingWagon: true });
  assert.equal(full.refusal, REFUSAL.wagonFull);
  assert.equal(full.refusal.text, CANNOT_HOLD_TEXT);
  // the limit is read from the load, not assumed: 740kg of wagon
  // leaves exactly 5 books of headroom
  assert.equal(planStore(book(20), { remote: [book(370)], usingWagon: true }).amount, 5);
  assert.equal(totalWeight([book(370)]), 740, 'the fixture drifted, not the law');
});

test('U56 planTake: the carry gate, the two sounds, and the gift', () => {
  // no entity = no capacity to read, so the gate stands open (the
  // loot-window tests mount without one)
  assert.deepEqual(planTake(book(4), { bag: [] }),
    { ok: true, amount: 4, sound: 'click', equip: false, claimsChoice: false });

  // X11b: the summoned guard, the OTHER caller of DFU's one function
  const s = planTake(summon(book()), { bag: [] });
  assert.equal(s.refusal, REFUSAL.summoned);
  assert.equal(s.refusal.text, CANNOT_REMOVE_ITEM_TEXT);

  // CanCarryAmount (:1414-1422): MaxEncumbrance is strength * 1.5 kg,
  // so a 50-strength hero carries 75kg = 37 books, and the 38th of a
  // 100-stack is left in the pile
  const e = hero(50);
  assert.equal(planTake(book(100), { bag: [], entity: e }).amount, 37);
  // ...and one already carrying 75kg is refused, with words
  const full = planTake(book(), { bag: [book(37), book(1)], entity: e });
  assert.equal(full.refusal, REFUSAL.cannotCarry);
  assert.equal(full.refusal.text, CANNOT_CARRY_TEXT);

  // DoTransferItem: gold rides its own clink (:1569)
  assert.equal(planTake(gold(500), { bag: [] }).sound, 'gold');
  assert.equal(planTake(book(), { bag: [] }).sound, 'click');
  // ...and it is IsOfTemplate, both terms: a Currency row that is not
  // template 276 is not gold pieces (DaggerfallUnityItem.cs:747-750).
  assert.equal(planTake({ group: 'Currency', templateIndex: 137, stackCount: 5 }, { bag: [] }).sound,
    'click', 'the group alone does not make a coin');
  // and the gate is ABOVE the sound - a refused transfer is silent
  assert.equal(planTake(gold(500), { bag: [book(100)], entity: e }).sound, undefined,
    'a refused transfer still picked a sound');

  // Equip mode equips what it took; Remove does not
  assert.equal(planTake(book(), { bag: [], mode: 'equip' }).equip, true);
  assert.equal(planTake(book(), { bag: [], mode: 'remove' }).equip, false);

  // G6 (:1585-1591): ONE is the whole gift - taking from a choose-one
  // pile IS the claim. Taking from the WAGON while such a window is
  // open is not.
  const pile = { items: [], onChoose: () => {} };
  assert.equal(planTake(book(), { bag: [], chooseOne: pile }).claimsChoice, true);
  assert.equal(planTake(book(), { bag: [], chooseOne: pile, usingWagon: true }).claimsChoice, false);
  assert.equal(planTake(book(), { bag: [] }).claimsChoice, false);
});

test('U56 applyTransfer: the split leaves a remainder, the whole move keeps its identity', () => {
  // PARTIAL: the source keeps the rest and a NEW record travels, so
  // the two stacks can be equipped, dropped and enchanted apart
  const from = [book(100)];
  const to = [];
  const taken = applyTransfer(from[0], { amount: 37 }, from, to);
  assert.equal(from.length, 1, 'the source stack is still there');
  assert.equal(from[0].stackCount, 63);
  assert.equal(to.length, 1);
  assert.equal(to[0].stackCount, 37);
  assert.notEqual(to[0], from[0], 'the split minted no new record');
  assert.equal(taken, to[0], 'the caller is handed what arrived, not what stayed');

  // WHOLE: the record itself moves. Identity matters here - the
  // classic window equips `taken` straight after, and equipItem works
  // on the object that is IN the bag.
  const from2 = [book(2), book(5)];
  const to2 = [];
  const it = from2[1];
  const moved = applyTransfer(it, { amount: 5 }, from2, to2);
  assert.equal(moved, it, 'a whole move must hand back the same object');
  assert.equal(from2.length, 1);
  assert.equal(from2.includes(it), false);
  assert.equal(to2.length, 1);
  assert.equal(to2[0].stackCount, 5);

  // and a whole move of an item that is NOT in the source list adds
  // without eating the list's last entry (Array.splice(-1, 1) does)
  const from3 = [book(1)];
  const keep = from3[0];
  applyTransfer(book(3), { amount: 3 }, from3, []);
  assert.deepEqual(from3, [keep], 'splice(-1, 1) ate the wrong item');
});

// ROAD-Ar R5. DFU has no partial transfer that skips SplitStack:
// TransferItem (:1515-1540) sends every `maxAmount < item.stackCount`
// move into the split popup, whose handler is
// `stackFrom.SplitStack(stackItem, count)` (:1554) before
// DoTransferItem. ItemCollection.cs:267 mints
// `ItemBuilder.CreateItem(group, templateIndex)`, and SetItem
// (DaggerfallUnityItem.cs:558-572) zeroes nativeMaterialValue,
// currentVariant, flags, message and the recipe carrier, resets value
// to basePrice and condition to hitPoints. So the half that travels is
// a TEMPLATE, not a copy. The ladder used to re-spell the member as
// `{ ...item, stackCount }`, which is the fourth re-spelling a2 set out
// to remove and the only one on the main path.
test('ROAD-Ar R5: a partial move is a SplitStack MINT, not a copy of the record', () => {
  const shared = [{ type: 1, param: 3 }];
  const potion = {
    group: 'UselessItems1', templateIndex: 83, name: 'Potion of Healing',
    stackCount: 3, condition: 4, material: 2, variant: 5, flags: 8,
    message: 41, potionRecipeKey: 8765, value: 999, enchantments: shared,
  };
  const from = [potion];
  const to = [];
  const taken = applyTransfer(potion, { amount: 1 }, from, to);

  assert.equal(potion.stackCount, 2, 'the remainder stays behind');
  assert.equal(to.length, 1);
  assert.equal(taken, to[0]);
  assert.equal(taken.stackCount, 1);
  assert.equal(taken.group, potion.group, 'the mint keeps the group...');
  assert.equal(taken.templateIndex, potion.templateIndex, '...and the template index');
  // ...and nothing else. These five are exactly SetItem's zeroing.
  assert.equal(taken.material, 0, 'nativeMaterialValue = 0');
  assert.equal(taken.variant, 0, 'currentVariant = 0');
  assert.equal(taken.flags, 0);
  assert.equal(taken.message, 0);
  assert.equal(taken.potionRecipeKey ?? 0, 0, 'the recipe does not ride along');
  assert.notEqual(taken.value, 999, 'value is reset to the template basePrice');
  assert.notEqual(taken.condition, 4, 'condition is reset to hitPoints, not inherited');
  assert.notEqual(taken.enchantments, shared,
    'the split half shared the source enchantment ARRAY by reference');

  // The observable consequence: DFU's stored half will NOT re-stack
  // with the remainder, because stacksWith reads message and recipe.
  assert.equal(to.length, 1);
  applyTransfer(potion, { amount: 2 }, from, to);
  assert.equal(to.length, 2, 'a template and a keyed potion are not one stack');

  // ...but a split that carries no identity terms MUST still re-merge
  // where DFU merges. FindExistingStack (ItemCollection.cs:708-713)
  // compares group, index, message, recipe and expiry - not material -
  // and SetItem writes nativeMaterialValue = 0, which is what an item
  // carrying no material field means everywhere else in the port. The
  // gold stack is the case that proves it: goldStack() mints without
  // the field, the split mints with a 0.
  const purse = [goldStack(100)];
  const pile = [goldStack(300)];
  applyTransfer(pile[0], { amount: 100 }, pile, purse);
  assert.equal(purse.length, 1, 'the split gold did not merge into the purse');
  assert.equal(purse[0].stackCount, 200);
  assert.equal(pile[0].stackCount, 200);

  // The whole-move arm is untouched: identity still travels.
  const one = { group: 'UselessItems1', templateIndex: 83, stackCount: 1, potionRecipeKey: 8765 };
  const src = [one];
  const dst = [];
  assert.equal(applyTransfer(one, { amount: 1 }, src, dst), one,
    'a whole move is not a split - DFU moves the record itself');
  assert.equal(dst[0].potionRecipeKey, 8765);
});

// ── AUDIT 26's QUEST ARM, ON THE LADDER ──────────────────────────
// The arm's own law is pinned in test/audit26_uicore.test.js, which
// is where AUDIT 26 wrote it and where it belongs. What is pinned
// HERE is the part that only exists because the ladder was extracted:
// which RUNG the arm sits on, and the dry run that lets a view ask
// the ladder a question without the arm writing anything.
const questResource = (over = {}) => ({
  allowDrop: false, playerDropped: false, madePermanent: false, ...over,
});
const questItemOf = (over = {}) => ({
  group: 'MiscItems', templateIndex: 132, name: 'Ruby',
  questItem: true, questUID: 7, questSymbol: { name: '_ruby_' }, ...over,
});
const questHook = (res) => (uid) => (uid === 7 ? { getItem: () => res } : null);

test('U56 + AUDIT 26: the quest arm is a RUNG, and it sits where DFU puts it', () => {
  const res = questResource();
  const q = questItemOf();
  // BELOW the summoned guard: a SUMMONED quest item refuses as
  // summoned, which is how we know the quest arm is not running first.
  assert.equal(planStore(summon(questItemOf()), { remote: [], getQuest: questHook(res) }).refusal,
    REFUSAL.summoned, 'the quest arm is running above the summoned guard');
  // ...and it refuses with DFU's own words for the same reason the
  // summoned one does - DFU pops the same string.
  const r = planStore(q, { remote: [], getQuest: questHook(res) });
  assert.equal(r.refusal, REFUSAL.questItem);
  assert.equal(r.refusal.text, CANNOT_REMOVE_ITEM_TEXT);
  // ABOVE the choose-one pile...
  assert.equal(planStore(questItemOf(), { remote: [], chooseOne: { items: [] }, getQuest: questHook(questResource()) })
    .refusal, REFUSAL.questItem, 'the pile guard is running above the quest arm');
  // ...and ABOVE every capacity gate, which MATTERS: a droppable quest
  // item stopped by a full wagon has still had its playerDropped
  // written, exactly as DFU leaves it.
  const dropRes = questResource({ allowDrop: true });
  const full = planStore(questItemOf({ stackCount: 1 }), {
    remote: [{ group: 'Books', templateIndex: 277, name: 'Book', stackCount: 375 }],
    usingWagon: true, getQuest: questHook(dropRes),
  });
  assert.equal(full.refusal, REFUSAL.wagonFull, 'the wagon gate is running above the quest arm');
  // the WAGON is not the ground, so the cart is not a drop (:1496-1500)
  assert.equal(dropRes.playerDropped, false, 'stowing in the cart counted as dropping');
  // ...while the GROUND is
  const groundRes = questResource({ allowDrop: true });
  planStore(questItemOf(), { remote: [], getQuest: questHook(groundRes) });
  assert.equal(groundRes.playerDropped, true);
  // and the OTHER caller clears it again (:1499-1500)
  planTake(questItemOf(), { bag: [], getQuest: questHook(groundRes) });
  assert.equal(groundRes.playerDropped, false, 'picking it back up did not clear PlayerDropped');
});

test('U56: a DRY RUN asks the ladder without the one rung that writes', () => {
  // THE VIEW PROBLEM. `canStow` calls planStore on every repaint to
  // decide whether to draw a button; the quest arm WRITES as it passes
  // (playerDropped, and re-permanenting a clone), so a live run there
  // would mark a quest item dropped every time the screen redrew.
  const res = questResource({ allowDrop: true });
  const q = questItemOf();
  assert.equal(planStore(q, { remote: [], getQuest: questHook(res), dryRun: true }).ok, true);
  assert.equal(res.playerDropped, false, 'a dry run wrote to the quest resource');
  // ...and the same for the other direction
  const back = questResource({ allowDrop: true, playerDropped: true });
  planTake(questItemOf(), { bag: [], getQuest: questHook(back), dryRun: true });
  assert.equal(back.playerDropped, true, 'a dry take wrote to the quest resource');
  // A LIVE run does write - which is what makes the dry one worth having
  planStore(q, { remote: [], getQuest: questHook(res) });
  assert.equal(res.playerDropped, true);
  // AND THE DRY RUN CANNOT CHANGE A CALLER'S ANSWER, which is the
  // whole argument for skipping the rung: the quest refusal SPEAKS, so
  // a view asking "would this say something" gets the same yes either
  // way.
  assert.equal(REFUSAL.questItem.text != null, true, 'a silent quest refusal would make dryRun a lie');
});

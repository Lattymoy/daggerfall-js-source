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
import { totalWeight } from '../src/systems/inventory.js';

const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const cart = () => ({ group: 'Transportation', templateIndex: 93, name: 'Small Cart' });
const gold = (n = 100) => ({ group: 'Currency', templateIndex: 137, name: 'Gold Pieces', stackCount: n });
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
  // but the WAGON is not that pile - a reward window with a cart open
  // can still stow, so the wagon arm sits below the pile guard
  assert.equal(planStore(book(), { remote: [], chooseOne: { items: [] }, usingWagon: true }).ok, true,
    'the choose-one guard swallowed the wagon');

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

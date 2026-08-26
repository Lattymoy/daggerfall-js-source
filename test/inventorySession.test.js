// U57 - the remote SIDE of DaggerfallInventoryWindow, on its own.
//
// U56 took TransferItem out of the classic window; a transfer needs
// somewhere to transfer TO, and choosing that is its own pile of
// members - OnPush's default target, SetChooseOne, CheckWagonAccess,
// ShowWagon, WagonButton_OnMouseClick, OnPop. These pins hold the
// three orders that matter and the one effect that is invisible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasCart, openState, remoteTarget, planWagonToggle, closeSession,
  WAGON_REFUSAL, NO_WAGON_TEXT, EXIT_TOO_FAR_TEXT,
  SMALL_CART_TEMPLATE, WAGON_ACCESS_DISTANCE,
} from '../src/systems/inventorySession.js';

const cart = () => ({ group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, name: 'Small Cart' });
const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const bag = (...items) => ({ items: () => items });

test('U57: the numbers and the words', () => {
  assert.equal(SMALL_CART_TEMPLATE, 93, 'ItemGroups.Transportation.Small_cart');
  assert.equal(WAGON_ACCESS_DISTANCE, 5, 'DungeonWagonAccessProximityCheck (:1102)');
  // THE PROSE ITSELF - every other assertion here reads these through
  // the same import the source does, which is the vacuous shape U56
  // found in the wagon suite. These two lines are where they are held.
  assert.equal(NO_WAGON_TEXT, "You don't own a wagon.");
  assert.equal(EXIT_TOO_FAR_TEXT, 'You are too far from the exit.');
  assert.equal(WAGON_REFUSAL.noWagon.text, NO_WAGON_TEXT);
  assert.equal(WAGON_REFUSAL.exitTooFar.text, EXIT_TOO_FAR_TEXT);
  // Items.Contains(Transportation, Small_cart) - the cart is IN THE
  // BAG, which is why itemTransfer's transport block exists.
  assert.equal(hasCart([book(), cart()]), true);
  assert.equal(hasCart([book()]), false);
  assert.equal(hasCart([]), false);
  assert.equal(hasCart(), false, 'a host with no bag yet is not a host with a cart');
});

test('U57 openState: what opening the window already decided', () => {
  // selectedActionMode: Equip by default, Remove for a container
  assert.equal(openState(bag(book())).mode, 'equip');
  assert.equal(openState({ ...bag(book()), loot: { items: () => [] } }).mode, 'remove');
  // a reward list is a Remove target too - taking is all it is for
  assert.equal(openState({ ...bag(book()), chooseOne: { items: [book()] } }).mode, 'remove');
  assert.equal(openState(bag(book())).chooseOne, null);

  // CheckWagonAccess (:1082-1097) needs BOTH halves, and only inside
  const near = { inside: true, nearExit: () => true };
  assert.equal(openState({ ...bag(cart()), dungeon: near }).allowDungeonWagonAccess, true);
  assert.equal(openState({ ...bag(book()), dungeon: near }).allowDungeonWagonAccess, false,
    'no cart in the bag, no access');
  assert.equal(openState({ ...bag(cart()), dungeon: { inside: true, nearExit: () => false } })
    .allowDungeonWagonAccess, false, 'away from the exit, no access');
  assert.equal(openState({ ...bag(cart()), dungeon: { inside: false, nearExit: () => true } })
    .allowDungeonWagonAccess, false, 'the proximity check only runs inside');

  // and with access and NO container, the window opens ON the cart in
  // Remove - the leave-the-haul-at-the-entrance flow
  const s = openState({ ...bag(cart()), dungeon: near });
  assert.equal(s.usingWagon, true);
  assert.equal(s.mode, 'remove');
  // a LOOT target outranks it: the corpse you just opened is the one
  // you meant, and access is still granted so the button can toggle
  const l = openState({ ...bag(cart()), dungeon: near, loot: { items: () => [] } });
  assert.equal(l.allowDungeonWagonAccess, true);
  assert.equal(l.usingWagon, false);
  assert.equal(l.mode, 'remove');
  // no dungeon at all: nothing is claimed
  assert.equal(openState(bag(cart())).usingWagon, false);
});

test('U57 remoteTarget: three claims, in order', () => {
  const wagonList = [book()];
  const pile = [book(2)];
  const reward = [book(3)];
  const dropped = [];
  const deps = { ...bag(cart()), wagonItems: () => wagonList, loot: { items: () => pile } };
  const st = { dropped, chooseOne: { items: reward } };

  // OnPush's default when nothing else opened the window
  assert.equal(remoteTarget(bag(), { dropped }), dropped);
  // a container outranks the ground
  assert.equal(remoteTarget({ loot: { items: () => pile } }, { dropped }), pile);
  // a reward list outranks the container...
  assert.equal(remoteTarget(deps, st), reward);
  // ...and the WAGON outranks everything while it is showing, which
  // is the whole meaning of the toggle
  assert.equal(remoteTarget(deps, { ...st, usingWagon: true }), wagonList);
  // a host with no wagon hook falls to the caller's own array, and it
  // must be the SAME array every read or a stow vanishes on the next
  // repaint
  const local = [];
  assert.equal(remoteTarget(bag(), { usingWagon: true, wagonLocal: local }), local);
});

test('U57 planWagonToggle: two refusals, and which comes first', () => {
  // no cart: the noWagon box, and nothing toggles
  const none = planWagonToggle(bag(book()), { usingWagon: false });
  assert.equal(none.ok, false);
  assert.equal(none.refusal, WAGON_REFUSAL.noWagon);
  // ...and it refuses that way even in a dungeon far from the exit,
  // where the OTHER refusal would also apply - the cart check is
  // first, so a player with no cart is never told about a door
  const both = planWagonToggle({ ...bag(book()), dungeon: { inside: true, nearExit: () => false } },
    { usingWagon: false, allowDungeonWagonAccess: false });
  assert.equal(both.refusal, WAGON_REFUSAL.noWagon, 'the exit rule is running above the cart check');

  // the cart, in a dungeon, without access: exitTooFar
  const far = planWagonToggle({ ...bag(cart()), dungeon: { inside: true, nearExit: () => false } },
    { usingWagon: false, allowDungeonWagonAccess: false });
  assert.equal(far.ok, false);
  assert.equal(far.refusal, WAGON_REFUSAL.exitTooFar);
  // OUTDOORS the proximity check never speaks, even with no access
  // flag - the cart is simply there
  assert.deepEqual(planWagonToggle(bag(cart()), { usingWagon: false, allowDungeonWagonAccess: false }),
    { ok: true, usingWagon: true });
  // and it is a TOGGLE, both ways
  assert.equal(planWagonToggle(bag(cart()), { usingWagon: true }).usingWagon, false);
});

test('U57 closeSession: the drop pile mints, and only when there is one', () => {
  // AUDIT B-C1: this is the effect a hand-off skipped, and a skipped
  // one does not look broken - it looks like the player misremembered
  // picking something up.
  const dropped = [book(), book(2)];
  const minted = [];
  let closed = 0;
  closeSession({ onDrop: (its) => minted.push(its), onClose: () => { closed++; } }, { dropped });
  assert.deepEqual(minted, [dropped], 'the pile that mints is the pile that was dropped');
  assert.equal(closed, 1);
  // an empty session drops NOTHING - a world flat with no items in it
  // is litter the player cannot pick up
  const empty = [];
  closeSession({ onDrop: () => empty.push('minted'), onClose: () => {} }, { dropped: [] });
  assert.deepEqual(empty, []);
  // a host that hands neither hook still closes cleanly
  closeSession({}, { dropped: [book()] });
});

test('U57: the classic window runs this module rather than a second reading', () => {
  const ui = new URL('../src/ui/nativeInventory.js', import.meta.url);
  const s = readFileSync(ui, 'utf8');
  for (const fn of ['openState(hooks)', 'remoteTarget(this.hooks', 'planWagonToggle(this.hooks', 'closeSession(this.hooks']) {
    assert.ok(s.includes(fn), `the window does not call ${fn}`);
  }
  // and the copies it used to carry are gone
  assert.ok(!s.includes('_hasCart'), 'the window kept its own cart check');
  assert.ok(!/templateIndex === SMALL_CART_TEMPLATE/.test(s), 'a second reading of the cart check survives');
  assert.ok(!/this\.hooks\.onDrop\?\.\(/.test(s), 'the window still mints the drop pile itself');
  assert.ok(!/hooks\.dungeon\?\.inside && this\._hasCart/.test(s), 'CheckWagonAccess is still inline');
});

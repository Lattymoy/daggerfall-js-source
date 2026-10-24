// CART-SLOT (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "The caravan became a cart
// after the update"): the Enhanced inventory's Cart cell names the wagon the player drives. Every wagon is the Small
// Cart's template (WAGONS1), and the cell drew the FIRST of them - a Small Cart kept beside a Caravan bought after it -
// while the world drove the Caravan. Pinned on the real wagon items (wagonKinds.js newWagonItem) and the law the world's
// wagon reads (activeWagonItem). Pure: no game data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transportItem, hasCart } from '../../src/systems/inventorySession.js';
import { newWagonItem, activeWagonItem, wagonKindOf, wagonItemName } from '../../src/systems/wagon/wagonKinds.js';
import { TRANSPORT_HORSE } from '../../src/systems/item/itemTemplates.js';

const horse = () => ({ group: 'Transportation', templateIndex: TRANSPORT_HORSE });

test('CART-SLOT: a Small Cart kept beside a Caravan bought after it - the Cart cell is the Caravan, the wagon the world drives', () => {
  const cart = newWagonItem('cart'), caravan = newWagonItem('caravan');
  const items = [cart, horse(), caravan];
  assert.equal(hasCart(items), true);
  assert.equal(transportItem(items, 'cart'), caravan);
  assert.equal(transportItem(items, 'cart'), activeWagonItem(items), 'the cell and the world read one law');
  assert.equal(wagonItemName(transportItem(items, 'cart')), 'Caravan', 'named as the Caravan');
});

test('CART-SLOT: the best owned in any order (an Open Wagon over a cart, a Caravan over both); a lone Small Cart is the cart; none, null', () => {
  const cart = newWagonItem('cart'), open = newWagonItem('openWagon'), caravan = newWagonItem('caravan');
  assert.equal(wagonKindOf(transportItem([open, cart], 'cart')), 'openWagon');
  assert.equal(wagonKindOf(transportItem([cart, open], 'cart')), 'openWagon');
  assert.equal(wagonKindOf(transportItem([caravan, open, cart], 'cart')), 'caravan');
  assert.equal(transportItem([horse(), cart], 'cart'), cart);
  assert.equal(transportItem([horse()], 'cart'), null);
  assert.equal(transportItem([], 'cart'), null);
  assert.equal(transportItem(undefined, 'cart'), null);
});

test('CART-SLOT: the Mount cell is unmoved - the horse, never a wagon', () => {
  const h = horse(), caravan = newWagonItem('caravan');
  assert.equal(transportItem([caravan, h], 'mount'), h);
  assert.equal(transportItem([caravan], 'mount'), null);
});

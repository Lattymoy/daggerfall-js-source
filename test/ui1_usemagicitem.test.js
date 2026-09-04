import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { usableMagicItems, createUseMagicItemWindow } from '../src/ui/useMagicItemWindow.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { TEMPLATES } from '../src/systems/useItem.js';

// UI1 - THE USE-MAGIC-ITEM WINDOW (DaggerfallUseMagicItemWindow, whole;
// DaggerfallUI.cs:581-583). The port had the DOOR and not the room:
// input.js routed Actions.UseMagicItem to ctx.openUseMagicItem, the
// large HUD had the button, KeyU was bound - and no host implemented
// the method, so the key silently did nothing.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const potion = (name = 'Potion') => ({ name, group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle });   // IsPotion (:352-355)
const enchanted = (name, types) => ({ name, group: 'Weapons', templateIndex: 120, enchantments: types.map((t) => ({ type: t, param: 0 })) });
const isEnchanted = (it) => Array.isArray(it?.enchantments) && it.enchantments.length > 0;

test('UI1: UpdateUsableMagicItems - a CastWhenUsed enchantment or a potion, in pack order, one entry per item', () => {
  const cast = enchanted('Wand', [ENCHANTMENT_TYPES.CastWhenUsed]);
  const held = enchanted('Ring', [ENCHANTMENT_TYPES.CastWhenHeld]);
  const twice = enchanted('Staff', [ENCHANTMENT_TYPES.CastWhenUsed, ENCHANTMENT_TYPES.CastWhenUsed]);
  const p = potion();
  const plain = { name: 'Rock', group: 'UselessItems2', templateIndex: 1 };
  const out = usableMagicItems([plain, cast, held, p, twice], { isEnchanted });
  assert.deepEqual(out.map((i) => i.name), ['Wand', 'Potion', 'Staff'], 'pack order; CastWhenHeld and a rock are not usable');
  assert.equal(out.filter((i) => i.name === 'Staff').length, 1, 'the break: one entry however many CastWhenUsed it carries');
  // The else arm: an ENCHANTED potion takes the first arm only, so a
  // potion with no CastWhenUsed enchantment is NOT listed (:66-78).
  const enchantedPotion = { ...potion('Elixir'), enchantments: [{ type: ENCHANTMENT_TYPES.CastWhenHeld, param: 0 }] };
  assert.deepEqual(usableMagicItems([enchantedPotion], { isEnchanted }).map((i) => i.name), [], 'the else arm is not reached for an enchanted item');
  assert.deepEqual(usableMagicItems([], { isEnchanted }), []);
  assert.deepEqual(usableMagicItems(null, { isEnchanted }), []);
});

test('UI1: nothing usable, NO WINDOW (DaggerfallUI :581-583) - not an empty list', () => {
  assert.equal(createUseMagicItemWindow({ items: [{ name: 'Rock' }], isEnchanted }), null);
  assert.equal(createUseMagicItemWindow({ items: [], isEnchanted }), null);
  const win = createUseMagicItemWindow({ items: [potion('Cure')], isEnchanted });
  assert.ok(win);
  assert.deepEqual(win.items, ['Cure'], 'the row is the item name');
});

test('UI1: AllowCancel is false, and the pick CLOSES first, then uses (:88-97)', () => {
  const p = potion('Sleep'), w = enchanted('Wand', [ENCHANTMENT_TYPES.CastWhenUsed]);
  const order = [];
  const win = createUseMagicItemWindow({
    items: [w, p], isEnchanted,
    onClose: () => order.push('close'),
    onUse: (item, i) => order.push(`use:${item.name}:${i}`),
  });
  assert.equal(win.allowCancel, false, 'Escape does not close it - the U key does');
  win.selectedIndex = 1;
  win.onPick(1, 'Sleep');
  assert.deepEqual(order, ['close', 'use:Sleep:1'], 'closed BEFORE the use');
  assert.equal(win.done, true);
});

test('UI1: the door exists in all three player hosts and routes through the port\'s ONE use seam', () => {
  const input = read('src/ui/input.js');
  assert.match(input, /case 'UseMagicItem': return ctx\.openUseMagicItem \? \(ctx\.openUseMagicItem\(\), true\) : false;/);
  for (const host of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = read(host);
    assert.match(s, /openUseMagicItem[(:]/, `${host}: the door is implemented`);
    assert.match(s, /createUseMagicItemWindow\(\{/, `${host}: through the window factory`);
  }
  // The world host owns the use itself - useItem, the inventory's own
  // path - and lends it to the two modal hosts.
  const world = read('src/scenes/world.js');
  assert.match(world, /const useMagicItem = \(item\) => \{\s*\n\s*const r = useItem\(item, playerEntity\.items \?\? \[\], \{/);
  // U53's ONE-BUILDER LAW: the host-owned use hooks are ONE bag both
  // readers take. UI1's first cut copied them and test/potions.test.js
  // caught it - two drink hooks where the law says one.
  assert.equal((world.match(/drinkPotion: \(key\)/g) ?? []).length, 1, 'one drink hook');
  assert.match(world, /const useHooks = \{/);
  assert.equal((world.match(/\.\.\.useHooks,/g) ?? []).length, 2, 'both readers take the bag');
  assert.match(world, /useMagicItem: \(item\) => useMagicItem\(item\),/, 'lent to worldModes');
  assert.match(read('src/scenes/worldModes.js'), /useMagicItem: \(item\) => host\.useMagicItem\?\.\(item\),/, 'and on to the dungeon ctx');
  assert.match(read('src/scenes/dungeonContext.js'), /onUse: \(item\) => opts\.useMagicItem\?\.\(item\),/);
});

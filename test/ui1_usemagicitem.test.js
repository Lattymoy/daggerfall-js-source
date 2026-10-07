import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { usableMagicItems, createUseMagicItemWindow } from '../src/ui/useMagicItemWindow.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { MAGIC_ITEM_RECORD_SIZE, readMagicDef } from '../src/formats/magicDef.js';
import { createPotion, createRegularMagicItem, CLASSIC_RECIPE_KEYS } from '../src/systems/loot.js';
import { HEALING_RECIPE_KEY, MAGICKA_RECIPE_KEY, mintHealingPotion } from '../src/systems/healingSupply.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { addItem } from '../src/systems/inventory.js';
import { brewItems } from '../src/systems/alchemyItems.js';
import { POTIONS } from '../src/net/alchemyLaw.js';

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
  const win = createUseMagicItemWindow({ items: [createPotion(HEALING_RECIPE_KEY)], isEnchanted });
  assert.ok(win);
  assert.deepEqual(win.items, ['Potion of Healing'], 'the row is the item\'s LongName (UMI-NAMES)');
});

// UMI-NAMES (2026-10-07, the field: "Use Magic Item Menu is crowded" - "Kit of
// Venom Spitting", and MANY rows reading just "Glass Bottle"). Refresh (:50-57)
// lists each item's LongName - ItemHelper.ResolveItemLongName - and the factory
// listed the raw `name` field: a potion's template "Glass Bottle" (setItemFields
// names it so; createPotion's own mint carries no name at all, so a blank row),
// a MAGIC.DEF item its unfilled "%it of ...". Fixtures off the real producers.
test('UMI-NAMES: a potion is listed by its RECIPE, "Potion of X" - never "Glass Bottle" (ResolveItemLongName\'s %po arm)', () => {
  const restore = createPotion(MAGICKA_RECIPE_KEY);
  const pack = [mintHealingPotion(), setItemFields(createPotion(HEALING_RECIPE_KEY)), restore, setItemFields(createPotion(CLASSIC_RECIPE_KEYS[0]))];
  assert.equal(pack[1].name, 'Glass Bottle', 'the shape the shelf and the loot mint carries - the name the window used to show');
  const win = createUseMagicItemWindow({ items: pack });
  assert.deepEqual(win.items, ['Potion of Healing', 'Potion of Healing', 'Potion of Restore Power', 'Potion of Stamina']);
  // a Potent brew (PROF12) says so, as every other list does (itemNameParts)
  const brew = brewItems({ potion: POTIONS.find((p) => p.key === HEALING_RECIPE_KEY)?.id, count: 1, potent: 25 });
  assert.equal(brew.length, 1);
  assert.deepEqual(createUseMagicItemWindow({ items: brew }).items, ['Potent Potion of Healing']);
});

test('UMI-NAMES: identical potions are ONE row because they are one STACK (ItemCollection.AddItem) - the window folds nothing', () => {
  const pack = [];
  for (let i = 0; i < 5; i++) addItem(pack, mintHealingPotion());
  addItem(pack, setItemFields(createPotion(HEALING_RECIPE_KEY)));   // a shelf's / a body's Healing joins the same stack
  addItem(pack, createPotion(MAGICKA_RECIPE_KEY));
  assert.equal(pack.length, 2);
  assert.equal(pack[0].stackCount, 6);
  const win = createUseMagicItemWindow({ items: pack });
  assert.deepEqual(win.items, ['Potion of Healing', 'Potion of Restore Power'], 'one row per item, as DFU lists them');
  // and the pick hands on the stack itself, row for row
  const used = [];
  const w2 = createUseMagicItemWindow({ items: pack, onUse: (it) => used.push(it) });
  w2.onPick(1, w2.items[1]);
  assert.equal(used[0], pack[1]);
});

/** One MAGIC.DEF record (MagicItemsFile.ReadNextMagicItem's 62 bytes). */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = 0;
  }
  return buf;
}

test('UMI-NAMES: a MAGIC.DEF item fills its %it - identified "Mark of Lightning", unidentified the bare "Mark" (ResolveItemName)', () => {
  const templates = readMagicDef(magicDefBytes([{ name: '%it of Lightning', type: 0, group: 0, ench: [[ENCHANTMENT_TYPES.CastWhenUsed, 31]], uses: 1500, value: 0 }]));
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  // the producer: group 0's seventh group (Jewellery), the fifth jewel (the Mark) - the featherweight test's draw
  const mark = createRegularMagicItem(templates, 1, 'female', seq(0, 0.9, 0.5));
  assert.equal(mark.name, '%it of Lightning', 'the raw field the window used to list');
  assert.deepEqual(createUseMagicItemWindow({ items: [mark] }).items, ['Mark'], 'an unidentified item reads as its template (ItemHelper :269-271)');
  mark.isIdentified = true;   // the identify service's own write (worldModes)
  assert.deepEqual(createUseMagicItemWindow({ items: [mark] }).items, ['Mark of Lightning']);
});

test('UI1: AllowCancel is false, and the pick CLOSES first, then uses (:88-97)', () => {
  const p = potion('Sleep'), w = enchanted('Wand', [ENCHANTMENT_TYPES.CastWhenUsed]);
  const order = [];
  const win = createUseMagicItemWindow({
    items: [w, p], isEnchanted,
    onClose: () => order.push('close'),
    onUse: (item, i) => order.push(`use:${item.name}:${i}`),
  });
  assert.equal(win.allowCancel, false, 'the base class\'s Escape is off (:34-35) - the window closes itself on the U key or Escape (DISC8-D)');
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
  assert.equal((world.match(/drinkPotion: \(key, potent\)/g) ?? []).length, 1, 'one drink hook');   // PIN MOVED (PROF12): a Potent potion's share handed on
  assert.match(world, /const useHooks = \{/);
  // QS2 made it THREE readers, not a third bag: the quickslot key drinks the
  // potion the window's Use button drinks, so its hooks are this same object
  // with the three the window adds at its own call site.
  assert.equal((world.match(/\.\.\.useHooks,/g) ?? []).length, 3, 'every reader takes the ONE bag');
  // DISC21-C: the bag takes the rig in the player's hands
  assert.match(world, /const quickslotHooks = \((?:rig = weaponRig)?\) => \(\{\s*\n\s*\.\.\.useHooks,/, 'QS2\'s reader included');
  assert.match(world, /useMagicItem: \(item\) => useMagicItem\(item\),/, 'lent to worldModes');
  assert.match(read('src/scenes/worldModes.js'), /useMagicItem: \(item\) => host\.useMagicItem\?\.\(item\),/, 'and on to the dungeon ctx');
  assert.match(read('src/scenes/dungeonContext.js'), /onUse: \(item\) => opts\.useMagicItem\?\.\(item\),/);
});

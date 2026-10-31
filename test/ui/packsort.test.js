// PACK-SORT (2026-10-31, Sammy on Discord: "Add a sort button to the inventory!" and "Would like to be able to
// reorganise and sort things in my carriage inventory or any side inventory really."): the order (ui/packSort.js), the
// pack header's Sort and the side window's, driven over the fake document. Every item is a producer's own mint.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { sortedItems, sortInPlace, SORT_STORE_KINDS } from '../../src/ui/packSort.js';
import { filterByTab } from '../../src/ui/native/nativeInventory.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { createPotion } from '../../src/systems/loot/loot.js';
import { setItemFields, ITEM_TEMPLATES } from '../../src/systems/item/itemTemplates.js';
import { letterOfCredit } from '../../src/systems/inventory.js';
import { Quest } from '../../src/systems/quest/quest.js';
import { Item } from '../../src/systems/quest/item.js';
import '../../src/systems/professions/profTemplates.js';
import { mintMaterialItem } from '../../src/systems/professions/profItems.js';
import { BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { SMALL_CART_TEMPLATE } from '../../src/systems/inventorySession.js';
import { assignQuickslot, clearQuickslots, resolveConsumable, resolveSwap } from '../../src/systems/quickslots.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { markHeirloom } from '../../src/systems/legacy/heirloom.js';
import { _resetForTests, setPref } from '../../src/systems/uiPrefs.js';

const idx = (name) => ITEM_TEMPLATES.find((t) => t.name === name).index;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const weapon = (name, material, seed = 1) => createWeapon(idx(name), material, seeded(seed));
const quest = new Quest({ hooks: {}, rolls: () => 0.25 });
const questPiece = (line) => new Item(quest, line).daggerfallUnityItem;
/** One of a kind a page, in an order no sort would leave: [label, item]. */
function mixed() {
  const pieces = {
    oak: mintMaterialItem('log:oak'),
    letter: letterOfCredit(5000),
    rareMace: applyRarity(weapon('Mace', 1, 3), 'rare', seeded(4)),
    ironSword: weapon('Longsword', 0, 5),
    questPauldron: questPiece('Item _p_ item class 2 subclass 3'),
    dagger: weapon('Dagger', 0, 6),
    potion: createPotion('healing'),
    elvenSword: weapon('Longsword', 3, 7),
    cuirass: setItemFields({ group: 'Armor', templateIndex: idx('Cuirass'), material: 0x0200 }),
    magicDagger: applyRarity(weapon('Dagger', 0, 8), 'magic', seeded(9)),
    legendMace: applyRarity(weapon('Mace', 1, 10), 'legendary', seeded(11)),
    questCuirass: questPiece('Item _c_ item class 2 subclass 0'),
  };
  return pieces;
}
/** What a sort of `mixed()` reads, label by label. */
const SORTED = [
  'questPauldron', 'questCuirass',                        // quest items first, in the order they had
  'magicDagger', 'dagger', 'elvenSword', 'ironSword',     // Weapons: Magic over Common, then the name, then value high to low
  'cuirass',                                              // Armor
  'legendMace', 'rareMace',                               // Magic: Legendary over Rare
  'potion', 'letter', 'oak',                              // Potions, Valuables, Misc
];
const labelsOf = (pieces, list) => list.map((it) => Object.keys(pieces).find((k) => pieces[k] === it) ?? '?');
const hero = (items, extra = {}) => ({ name: 'Sammy', career: { name: 'Spellsword' }, stats: { strength: 60, endurance: 50 }, items, goldPieces: 0, ...extra });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

test('PACK-SORT the order: quest items first and in their place, then the pages, rarity high to low, the row\'s name, value high to low (mutants: each key dropped or turned)', () => {
  const p = mixed();
  assert.equal(p.questPauldron.questItem, true, 'the quest machine\'s own linked mint');
  assert.equal(p.magicDagger.rarity, 'magic');
  const list = Object.values(p);
  assert.deepEqual(labelsOf(p, sortedItems(list)), SORTED);
  assert.deepEqual(labelsOf(p, list), Object.keys(p), 'pure: the list it was given is untouched');
  // the row's own name is the one read - a reader that names the iron sword first puts it there
  const named = sortedItems(list, { nameOf: (it) => (it === p.ironSword ? 'Aardvark' : it.name ?? '') });
  assert.deepEqual(labelsOf(p, named).slice(2, 6), ['magicDagger', 'ironSword', 'dagger', 'elvenSword']);
  // by default too: Project Legacy's heirloom is read by the name its row says, its house first (itemInfo.js itemNameParts)
  const heir = markHeirloom(weapon('Longsword', 0, 50), { line: 'l1', house: 'Aldmeri', of: 1, from: 'Daggerfall' });
  assert.deepEqual(sortedItems([p.dagger, heir]), [heir, p.dagger], 'Aldmeri\'s Iron Longsword before Dagger');
  // a stray hole goes last, and nothing is lost
  assert.deepEqual(sortedItems([null, p.oak, p.dagger]), [p.dagger, p.oak, null]);
  assert.deepEqual([...SORT_STORE_KINDS].sort(), ['bag', 'storage', 'wagon'], 'the player\'s own stores - never a container, the ground or a tray');
});

test('PACK-SORT in place: the same array, sorted, saved in that order; a second press moves nothing (mutants: a copy sorted, the list left)', () => {
  const p = mixed();
  const e = hero(Object.values(p), { wagonItems: Object.values(mixed()), bagItems: [mintMaterialItem('log:oak'), mintMaterialItem('metal:iron')] });
  const list = e.items;
  assert.equal(sortInPlace(e.items), true, 'something moved');
  assert.equal(e.items, list, 'the array the save and the pages read, not a copy');
  assert.deepEqual(labelsOf(p, e.items), SORTED);
  assert.equal(sortInPlace(e.items), false, 'sorted already');
  assert.equal(sortInPlace(null), false);
  sortInPlace(e.bagItems);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 100 })));
  assert.deepEqual(snap.items.map((it) => it.name), e.items.map((it) => it.name), 'the save carries the order');
  assert.deepEqual(snap.bagItems.map((it) => it.name), ['Iron', 'Oak Log']);
  // the classic skin has no Sort (THE NATIVE-WINDOW RULE) and shows the list's own order
  assert.deepEqual(labelsOf(p, filterByTab(e.items, 'weapons')), ['questPauldron', 'questCuirass', 'magicDagger', 'dagger', 'elvenSword', 'ironSword', 'cuirass'],
    'DFU\'s Weapons & Armor tab, in the sorted order');
});

test('PACK-SORT a quickslot keeps its record: two stacks of one potion and two daggers of one kind stay in their order (mutants: a tie broken by the count or the condition)', () => {
  clearQuickslots();
  const few = { ...createPotion('healing'), stackCount: 1 };
  const many = { ...createPotion('healing'), stackCount: 5 };
  const worn = { ...weapon('Dagger', 0, 12), currentCondition: 10 };
  const fresh = weapon('Dagger', 0, 13);
  const e = hero([weapon('Mace', 0, 14), few, fresh, letterOfCredit(10), many, worn]);
  e.items.reverse();   // [worn, many, letter, fresh, few, mace]: the worn dagger and the five ahead of their kin
  assert.equal(assignQuickslot('c1', few), true);
  assert.equal(assignQuickslot('swap', worn), true);
  const before = { potion: resolveConsumable(e, 'c1').item, swap: resolveSwap(e).item };
  assert.deepEqual([before.potion, before.swap], [many, worn]);
  sortInPlace(e.items);
  assert.equal(resolveConsumable(e, 'c1').item, many, 'the slot uses the stack it used');
  assert.equal(resolveConsumable(e, 'c1').count, 6);
  assert.equal(resolveSwap(e).item, worn, 'and the swap the dagger it drew');
  clearQuickslots();
});

/** The pack mounted over the fake document, with whatever stands beside it. */
function withPack(deps, fn) {
  _resetForTests();
  setPref(LOOT_RARITY_KEY, true);
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedInventory(host, { onExit: () => {}, ...deps });
    const buttons = (root = host) => [...root.querySelectorAll('button')];
    const sortIn = (where) => buttons().find((b) => b.className.includes('sortbtn') && !!b.closest('.loot-win') === (where === 'side')) ?? null;
    const press = (label) => buttons().find((b) => b.textContent === label).onclick();
    try { return fn({ dom, host, sortIn, press, text: () => textOf(dom.body) }); } finally { view.unmount(); }
  });
}

test('PACK-SORT the header\'s Sort: one press sorts the pack in place, a drag still moves a row after it and stands, and no Sort while the pack chooses what to break (mutants: no button, the button while choosing)', () => {
  const p = mixed();
  const e = hero(Object.values(p));
  const list = e.items;
  withPack({ entity: e, items: () => e.items }, ({ dom, host, sortIn, press }) => {
    const sort = sortIn('pack');
    assert.ok(sort, 'the header carries Sort');
    assert.ok(sort.closest('.pack-id'), 'in the header');
    assert.equal(sort.textContent, 'Sort');
    const strip = host.querySelectorAll('.sortbtn').filter((b) => b.closest('.packcats'));
    assert.equal(strip.length, 1, 'and the tab strip carries the phone\'s');
    assert.equal(strip[0].onclick, sort.onclick, 'the same act');
    sort.onclick();
    assert.equal(e.items, list);
    assert.deepEqual(labelsOf(p, e.items), SORTED);
    // INV1's reorder after it: the iron sword dragged onto the magic dagger lands above it
    const rows = () => [...host.querySelectorAll('.itemrow')].filter((r) => !r.closest('.loot-win'));
    const row = (it) => rows().find((r) => r._padItem === it);
    dom.doc.elementFromPoint = () => row(p.magicDagger);
    row(p.ironSword).onpointerdown({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
    dom.win.fire('pointermove', { pointerId: 7, clientX: 60, clientY: 60 });
    dom.win.fire('pointerup', { pointerId: 7, clientX: 60, clientY: 60 });
    assert.deepEqual(labelsOf(p, e.items).slice(2, 7), ['ironSword', 'magicDagger', 'dagger', 'elvenSword', 'cuirass'], 'the drag moved it');
    press('Body');   // any repaint: nothing sorts it back
    assert.deepEqual(labelsOf(p, e.items).slice(2, 4), ['ironSword', 'magicDagger'], 'one shot - the order the player left stands');
    // BATCH-SALVAGE: the pack chooses by row, so its Sort steps aside
    press('Batch salvage');
    assert.equal(sortIn('pack'), null, 'no Sort while the pack chooses - in the header or on the strip');
    press('Batch salvage');
    assert.ok(sortIn('pack'), 'and back when it stops');
  });
});

test('PACK-SORT over a shared chest: the pack\'s Sort is refused in the chest\'s words and the chest shows none (mutants: the refusal dropped, the chest offered one)', () => {
  const p = mixed();
  const e = hero(Object.values(p));
  const draft = [...e.items];
  const goods = [weapon('Dagger', 0, 20), letterOfCredit(3), weapon('Mace', 0, 21)];
  const loot = { items: () => goods, storage: true, title: 'Chest', commit: (_dir, _it, _n, go) => go() };
  withPack({ entity: e, items: () => draft, loot }, ({ sortIn, text }) => {
    assert.equal(sortIn('side'), null, 'a chest that settles its own pieces is the service\'s order');
    sortIn('pack').onclick();
    assert.ok(text().includes('Shut the chest before you do that.'), 'the chest\'s own refusal');
    assert.deepEqual(labelsOf(p, e.items), Object.keys(p), 'the pack left as it was');
    assert.deepEqual(labelsOf(p, draft), Object.keys(p), 'and the window\'s copy of it');
  });
});

test('PACK-SORT the side window\'s Sort: the wagon, the bag and the player\'s storage sort their own array in place; a container and the ground offer none (mutants: Sort on a container, the pack sorted instead)', () => {
  const cart = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });
  // the wagon
  {
    const w = mixed();
    const e = hero([cart(), weapon('Mace', 0, 30), weapon('Dagger', 0, 31)], { wagonItems: Object.values(w) });
    const pack = [...e.items];
    const wagon = e.wagonItems;
    withPack({ entity: e, items: () => e.items, wagonItems: () => e.wagonItems }, ({ host, sortIn }) => {
      [...host.querySelectorAll('button')].find((b) => b.onclick && /cart|wagon/i.test(textOf(b))).onclick();   // the Cart cell (PX21a)
      sortIn('side').onclick();
      assert.equal(e.wagonItems, wagon, 'the wagon\'s own array');
      assert.deepEqual(labelsOf(w, e.wagonItems), SORTED);
      assert.deepEqual(e.items, pack, 'the pack untouched');
    });
  }
  // the Materials Bag
  {
    const bag = [mintMaterialItem('metal:iron'), mintMaterialItem('log:oak'), mintMaterialItem('metal:iron')];
    bag[2].stackCount = 3;
    const [ironA, oak, ironB] = bag;
    const e = hero([setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], { bagItems: bag });
    withPack({ entity: e, items: () => e.items, bagItems: () => e.bagItems, wagonItems: () => [] }, ({ sortIn, press }) => {
      press('Materials Bag');
      sortIn('side').onclick();
      assert.deepEqual(e.bagItems, [ironA, ironB, oak]);
      assert.equal(e.bagItems, bag);
    });
  }
  // the player's storage (a ship's hold, a house's cupboard) - and a container and the ground
  {
    const s = mixed();
    const chest = Object.values(s);
    withPack({ entity: hero([weapon('Dagger', 0, 40)]), items: () => [], loot: { items: () => chest, storage: true } }, ({ sortIn }) => {
      sortIn('side').onclick();
      assert.deepEqual(labelsOf(s, chest), SORTED);
    });
    const body = [weapon('Mace', 0, 41), weapon('Dagger', 0, 42)];
    withPack({ entity: hero([]), items: () => [], loot: { items: () => body } }, ({ sortIn, host }) => {
      assert.ok(host.querySelector('.loot-win'), 'the body\'s window');
      assert.equal(sortIn('side'), null, 'a body is not the player\'s to arrange');
    });
    const e = hero([weapon('Mace', 0, 43), weapon('Dagger', 0, 44)]);
    withPack({ entity: e, items: () => e.items }, ({ sortIn }) => {
      assert.equal(sortIn('side'), null, 'no side window, no side Sort');
    });
  }
});

test('PACK-SORT on a phone: the sheet moves the pack\'s Sort from the header to the tab strip\'s end, so Body and Close keep a 360px header; the side window\'s is its word\'s width (mutants: the header\'s kept on a phone, the strip\'s shown on the desk)', () => {
  const css = readFileSync(new URL('../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
  const PHONE = '@media (pointer: coarse) and (hover: none) and (max-width: 640px), (pointer: coarse) and (hover: none) and (max-height: 540px) {';
  const at = css.indexOf(PHONE);
  assert.ok(at > 0, 'the touch-phone rule (PACK-PHONE)');
  const phone = css.slice(at, css.indexOf('\n}\n', at));
  assert.match(phone, /\n {2}\.pack-shell \.pack-id \.sortbtn \{ display: none; \}/, 'the header\'s goes on a phone');
  assert.match(phone, /\n {2}\.pack-shell \.pack-dock \.packcats > \.sortbtn \{ display: inline-block;/, 'and the strip\'s stands');
  assert.match(phone, /\n {2}\.pack-shell \.pack-dock \.packcats \{ flex-wrap: nowrap; align-items: center; \}/, 'beside the tabs, not under them');
  const desk = css.indexOf('\n.pack-shell .packcats > .sortbtn { display: none; }');
  assert.ok(desk > 0 && desk < at, 'the strip\'s is hidden everywhere else, before the phone rule');
  assert.equal(css.lastIndexOf('@media', desk) < css.lastIndexOf('}\n', desk), true, 'in no media block');
  assert.match(css, /\n\.loot-win \.remoteacts \.sortbtn \{ min-width: 0;/, 'a wagon\'s Leave wagon, Take all and Sort keep one row');
});

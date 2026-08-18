// U8d: the native inventory window - the verbatim rects, the tab
// filter law, and the shared ItemListScroller component.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, INV_RECTS, TABS, filterByTab, isIngredientTemplate } from '../src/ui/nativeInventory.js';
import { scrollerHit, applyScroll, LIST_SLOTS, CELL_X, ARROW_H, DOWN_ARROW_Y } from '../src/ui/itemScroller.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('nativeInventory: the verbatim DFU rects + the tab/mode click machine', () => {
  // DaggerfallInventoryWindow.cs #region UI Rects
  assert.deepEqual([...INV_RECTS.tabWeapons], [0, 0, 92, 10]);
  assert.deepEqual([...INV_RECTS.tabMagic], [93, 0, 69, 10]);
  assert.deepEqual([...INV_RECTS.tabClothing], [163, 0, 91, 10]);
  assert.deepEqual([...INV_RECTS.tabIngredients], [255, 0, 65, 10]);
  assert.deepEqual([...INV_RECTS.wagon], [226, 14, 31, 14]);
  assert.deepEqual([...INV_RECTS.info], [226, 36, 31, 14]);
  assert.deepEqual([...INV_RECTS.equip], [226, 58, 31, 14]);
  assert.deepEqual([...INV_RECTS.remove], [226, 80, 31, 14]);
  assert.deepEqual([...INV_RECTS.use], [226, 103, 31, 14]);
  assert.deepEqual([...INV_RECTS.gold], [226, 126, 31, 14]);
  assert.deepEqual([...INV_RECTS.localList], [163, 48, 59, 152]);
  assert.deepEqual([...INV_RECTS.remoteList], [261, 48, 59, 152]);
  assert.deepEqual([...INV_RECTS.exit], [222, 178, 39, 22]);
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS });
  // defaults: WeaponsAndArmor tab, Equip mode (OnPush/SelectActionMode)
  assert.equal(w.tab, 'weapons');
  assert.equal(w.mode, 'equip');
  // tab clicks switch + reset scroll
  assert.ok(w.click(255 + 5, 5));
  assert.equal(w.tab, 'ingredients');
  assert.ok(w.click(0 + 5, 5));
  assert.equal(w.tab, 'weapons');
  // mode buttons select (wagon/gold consumed no-ops keep the mode)
  assert.ok(w.click(230, 40));
  assert.equal(w.mode, 'info');
  assert.ok(w.click(230, 16));      // wagon
  assert.equal(w.mode, 'info');
  // info-mode slot click pops the interim panel; the next click clears
  assert.ok(w.click(163 + CELL_X + 5, 48 + 5));
  assert.ok(w.popup && w.popup[0] === 'Dagger');
  assert.ok(w.click(163 + CELL_X + 5, 48 + 5));
  assert.equal(w.popup, null);
  // outside every rect: not consumed; exit closes; Escape too
  assert.equal(w.click(10, 100), false);
  assert.ok(w.click(240, 185));
  assert.ok(w.done);
  const w2 = new NativeInventoryWindow({ items: () => bag, icons: ICONS });
  w2.input('Escape');
  assert.ok(w2.done);
});

test('nativeInventory: the AddLocalItem tab filter law (verbatim four-way)', () => {
  const bag = [
    { group: 'Weapons', templateIndex: 113 },
    { group: 'Armor', templateIndex: 102 },
    { group: 'Weapons', templateIndex: 113, enchantments: [{ type: 1, param: 5 }] },   // enchanted weapon -> magic
    { group: 'MiscItems', templateIndex: 132 },                     // Spellbook -> magic
    { group: 'PlantIngredients1', templateIndex: 0 },               // ingredient low bound
    { group: 'MiscellaneousIngredients1', templateIndex: 77 },      // ingredient high bound
    { group: 'Books', templateIndex: 277 },                         // -> clothing & misc
    { group: 'MensClothing', templateIndex: 141 },                  // -> clothing & misc
  ];
  assert.equal(isIngredientTemplate(77), true);
  assert.equal(isIngredientTemplate(78), false);
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.templateIndex), [113, 102]);
  assert.deepEqual(filterByTab(bag, 'magic').map((i) => i.templateIndex), [113, 132]);
  assert.deepEqual(filterByTab(bag, 'ingredients').map((i) => i.templateIndex), [0, 77]);
  assert.deepEqual(filterByTab(bag, 'clothing').map((i) => i.templateIndex), [277, 141]);
  assert.equal(TABS.length, 4);
});

test('itemScroller: the shared rail law (hit kinds + clamped paging)', () => {
  const rect = [163, 48, 59, 152];
  // the LEFT 9px rail: 16px arrows at y0/y136, the bar between
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 5), { kind: 'up' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + DOWN_ARROW_Y + 5), { kind: 'down' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 70), { kind: 'page-up' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 100), { kind: 'page-down' });
  assert.equal(scrollerHit(rect, 162, 100), null, 'outside the scroller');
  assert.equal(scrollerHit(rect, 163 + 4, 48 + ARROW_H).kind, 'page-up', 'y16 is past the up arrow');
  // buttons at x>=9 map slots by 38px
  assert.deepEqual(scrollerHit(rect, 163 + CELL_X, 48 + 39), { kind: 'slot', slot: 1 });
  // paging clamps to the list
  assert.equal(applyScroll(0, 'up', 10), 0);
  assert.equal(applyScroll(0, 'down', 10), 1);
  assert.equal(applyScroll(0, 'page-down', 10), LIST_SLOTS);
  assert.equal(applyScroll(9, 'page-down', 10), 10 - LIST_SLOTS);
  assert.equal(applyScroll(3, 'down', 3), 0);   // short lists never scroll
});

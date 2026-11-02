// DIAMOND-HB (2026-10-18): the 4-slot diamond as part of the hotbar, the Diamonds option for the ten-slot row, the
// prefs migration, and hover/selection + slot key under a window.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as HB from '../../../src/systems/quickslots.js';
import { getPref, setPref, _resetForTests, loadPrefs } from '../../../src/systems/uiPrefs.js';
import { setUiSkin, hotbarInForce, HOTBAR_STYLES } from '../../../src/systems/uiSkin.js';
import { quickSlotsRead, quickSlotsWrite, QUICK_SLOTS_TIERS } from '../../../src/systems/featureLanes.js';
import { TEMPLATES } from '../../../src/systems/useItem.js';
import { setItemFields, mintCondition } from '../../../src/systems/item/itemTemplates.js';
import {
  hotbarMode, hotbarDiamond, hotbarGems, hotbarSize, hotbarShownSlotOf, crossbarMode, DIAMOND_SIZE, DIAMOND_POS,
  setHotbarPick, hotbarPickNow, HOTBAR_CSS,
} from '../../../src/ui/enhanced/enhancedHotbar.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const thing = (group, t) => mintCondition(setItemFields({ group, templateIndex: t }));
const style = (s, shape = 'square') => { setPref('quickbarStyle', s); setPref('hotbarShape', shape); };

test('DIAMOND-HB: diamond style uses the hotbar with 4 slots and no crossbar; hotbar style has 10; quickbar (Off) uses neither', () => {
  _resetForTests();
  setUiSkin('enhanced');
  assert.deepEqual([...HOTBAR_STYLES], ['hotbar', 'diamond']);
  style('diamond');
  assert.deepEqual([hotbarInForce(), hotbarMode(), hotbarDiamond(), hotbarGems()], [true, true, true, false]);
  assert.equal(hotbarSize(), DIAMOND_SIZE);
  assert.equal(DIAMOND_SIZE, 4);
  assert.equal(crossbarMode(), false, 'never a crossbar');
  assert.deepEqual([...DIAMOND_POS], ['top', 'bottom', 'left', 'right'], 'd-pad order: up, down, left, right');
  style('hotbar');
  assert.deepEqual([hotbarInForce(), hotbarDiamond(), hotbarGems(), hotbarSize()], [true, false, false, HB.HOTBAR_SIZE]);
  style('hotbar', 'diamond');
  assert.deepEqual([hotbarGems(), hotbarSize()], [true, HB.HOTBAR_SIZE], 'Diamonds: ten diamond slots');
  style('diamond', 'diamond');
  assert.equal(hotbarGems(), false, 'the shape pref only affects the row');
  style('quickbar');
  assert.deepEqual([hotbarInForce(), hotbarMode()], [false, false], 'Off keeps the old diamond and its keys');
  _resetForTests();
});

test('DIAMOND-HB: an item on a slot the diamond does not show counts as not on the bar', () => {
  _resetForTests();
  setUiSkin('enhanced');
  HB.clearHotbar();
  const potion = thing('UselessItems1', TEMPLATES.Glass_Bottle ?? 81);
  potion.potionRecipeKey = 12345;
  const torch = thing('UselessItems2', TEMPLATES.Torch);
  HB.setHotbarSlot(2, HB.hotbarEntryForItem(torch));
  HB.setHotbarSlot(6, HB.hotbarEntryForItem(potion));
  style('hotbar');
  assert.deepEqual([hotbarShownSlotOf(torch), hotbarShownSlotOf(potion)], [2, 6]);
  style('diamond');
  assert.deepEqual([hotbarShownSlotOf(torch), hotbarShownSlotOf(potion)], [2, -1], 'slot 7 is not shown in the diamond');
  HB.clearHotbar();
  _resetForTests();
});

test('DIAMOND-HB: the Quick slots tile has four states and each writes the right prefs', () => {
  _resetForTests();
  assert.deepEqual(QUICK_SLOTS_TIERS.map(([v]) => v), ['off', 'diamond', 'hotbar', 'gems']);
  quickSlotsWrite('gems');
  assert.deepEqual([getPref('quickbarStyle'), getPref('hotbarShape'), quickSlotsRead()], ['hotbar', 'diamond', 'gems']);
  quickSlotsWrite('diamond');
  assert.deepEqual([getPref('quickbarStyle'), getPref('quickslots'), quickSlotsRead()], ['diamond', true, 'diamond']);
  quickSlotsWrite('off');
  assert.deepEqual([getPref('quickbarStyle'), getPref('quickslots'), quickSlotsRead()], ['quickbar', false, 'off']);
  quickSlotsWrite('hotbar');
  assert.deepEqual([getPref('quickbarStyle'), getPref('hotbarShape'), quickSlotsRead()], ['hotbar', 'square', 'hotbar']);
  _resetForTests();
});

const KEY = 'dagger.ui.v1';
function withShelf(blob, fn) {
  const store = new Map(blob ? [[KEY, JSON.stringify(blob)]] : []);
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try { _resetForTests(); loadPrefs(); return fn(); } finally { globalThis.localStorage = was; _resetForTests(); }
}

test('DIAMOND-HB: an old save that chose Diamond gets the new diamond; one that chose Off stays Off', () => {
  withShelf({ quickbarStyle: 'quickbar', _rev: 2 }, () => assert.deepEqual([getPref('quickbarStyle'), quickSlotsRead()], ['diamond', 'diamond']));
  withShelf({ quickbarStyle: 'quickbar', quickslots: true, _rev: 2 }, () => assert.equal(getPref('quickbarStyle'), 'diamond'));
  withShelf({ quickbarStyle: 'quickbar', quickslots: false, _rev: 2 }, () => assert.deepEqual([getPref('quickbarStyle'), quickSlotsRead()], ['quickbar', 'off']));
  withShelf({ quickslots: false, _rev: 1 }, () => assert.deepEqual([getPref('quickbarStyle'), quickSlotsRead()], ['quickbar', 'off'], 'the HB-LYCFREE Off migration still works'));
  withShelf({ quickbarStyle: 'hotbar', hotbarShape: 'diamond', _rev: 2 }, () => assert.equal(quickSlotsRead(), 'gems'));
});

test('DIAMOND-HB: with nothing hovered, the most recent window\'s selection is used; an empty selection falls through to the next window', () => {
  const sword = { name: 'Sword' };
  const spell = { index: 7, name: 'Fireball' };
  setHotbarPick('pack', { selected: () => ({ kind: 'item', item: sword }) });
  assert.deepEqual(hotbarPickNow(), { kind: 'item', item: sword });
  setHotbarPick('book', { selected: () => ({ kind: 'spell', spell }) });
  assert.deepEqual(hotbarPickNow(), { kind: 'spell', spell }, 'most recent window first');
  setHotbarPick('book', { selected: () => null });
  assert.deepEqual(hotbarPickNow(), { kind: 'item', item: sword }, 'empty selection falls through');
  setHotbarPick('book', null);
  setHotbarPick('pack', { selected: () => ({ kind: 'item', item: null }) });
  assert.equal(hotbarPickNow(), null, 'a selection without an item is ignored');
  setHotbarPick('pack', null);
  assert.equal(hotbarPickNow(), null);
});

test('DIAMOND-HB by source: pack rows, worn panels and spell rows carry their item or spell; diamond slots use clip-path, not rotation; the HUD mounts the diamond dock', () => {
  const INV = read('src/ui/enhanced/enhancedInventory.js');
  assert.match(INV, /if \(from === 'local'\) row\._hotbarItem = item;/, 'pack rows only, not loot rows');
  assert.equal((INV.match(/b\._hotbarItem = /g) ?? []).length, 2, 'worn panel and worn socket');
  assert.match(INV, /setHotbarPick\('pack', \{/);
  const BOOK = read('src/ui/enhanced/enhancedSpellbook.js');
  assert.match(BOOK, /b\._hotbarSpell = r\.spell;/);
  assert.match(BOOK, /setHotbarPick\('book', \{/);
  assert.match(HOTBAR_CSS, /\.hb\.hb-gem \.hb-slot \{ clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\);/);
  const gem = HOTBAR_CSS.slice(HOTBAR_CSS.indexOf('.hb.hb-gem .hb-slot {'), HOTBAR_CSS.indexOf('.hud-gemdock'));
  assert.doesNotMatch(gem, /rotate/, 'rotation would blur the sprites');
  const HUD = read('src/ui/enhanced/enhancedHud.js');
  assert.match(HUD, /mountHotbarDock\(parts\.hotDock, parts\.gemDock\)/);
  assert.match(HUD, /quick\.append\(gemDock\);/);
});

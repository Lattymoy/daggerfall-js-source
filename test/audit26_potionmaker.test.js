// AUDIT 26 - the potion-maker cluster (F173/F177, F174/F176, F201).
//
// F173: MIX plays its click and mixes only `if (cauldron.Count > 0)`
//       (:393-398) - the empty pot no longer pops POTION_FAILED.
// F177: the name label is AddRecipeToCauldron's alone (:307);
//       MixCauldron never touches it (pinned in the M2 suite, whose
//       old pin had encoded the invented mix-time write).
// F174: AddToCauldron splits ONE unit off a stack (:251-264) - the
//       remainder stays visible and addable.
// F176: ingredients are `IsIngredient && !IsEnchanted` (:147-149) and
//       the consume walk passes allowEnchantedItem false (:338, :345).
// F201: MakePotionService refuses with NoPotionIngredients when pack
//       AND wagon hold none (DaggerfallGuildServicePopupWindow
//       :670-686).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PotionMakerWindow, POTION_FAILED } from '../src/ui/potionMakerWindow.js';
import { consumeCauldron } from '../src/systems/potions.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// Yellow_berries (26) et al. are real ingredient templates.
const ing = (templateIndex, over = {}) => ({ group: 'PlantIngredients1', templateIndex, ...over });

test('F173: MIX on an empty pot clicks and does NOTHING', () => {
  const w = new PotionMakerWindow({ packItems: () => [] });
  w._mix();
  assert.equal(w.box, null, 'no POTION_FAILED box - DFU never rolls an empty pot');
  assert.equal(POTION_FAILED.length > 0, true);
});

test('F174: adding from a stack takes ONE unit and leaves the remainder addable', () => {
  const stack = ing(26, { stackCount: 3 });
  const w = new PotionMakerWindow({ packItems: () => [stack] });
  w._addToCauldron(w.ingredients()[0]);
  assert.equal(w.cauldron.length, 1);
  assert.equal(w.cauldron[0].stackCount, 1, 'SplitStack(item, 1)');
  let grid = w.ingredients();
  assert.equal(grid.length, 1, 'the remainder is still in the grid');
  assert.equal(grid[0].stackCount, 2);
  w._addToCauldron(grid[0]);
  w._addToCauldron(w.ingredients()[0]);
  assert.equal(w.cauldron.length, 3, 'every unit reaches the pot');
  assert.equal(w.ingredients().length, 0, 'and the stack is spent from the view');
  assert.equal(stack.stackCount, 3, 'the PACK item itself is untouched until the consume walk');
  // removing a unit puts it back in the view
  w._removeFromCauldron(0);
  assert.equal(w.ingredients()[0].stackCount, 1);
});

test('F176: an enchanted ingredient never reaches the grid, and the walk refuses its twin', () => {
  const plain = ing(26);
  const magic = ing(26, { enchantments: [{ type: 'CastWhenUsed', param: 1 }] });
  const w = new PotionMakerWindow({ packItems: () => [magic, plain] });
  const grid = w.ingredients();
  assert.equal(grid.length, 1, 'IsIngredient && !IsEnchanted (:147-149)');
  assert.equal(grid[0], plain);
  // the consume walk carries the GROUP so the host can look the item
  // up with allowEnchantedItem: false (:338, :345)
  const calls = [];
  consumeCauldron([{ group: 'Gems', templateIndex: 90 }], {
    takeFromPack: (t, g) => { calls.push(['pack', t, g]); return false; },
    takeFromWagon: (t, g) => { calls.push(['wagon', t, g]); return true; },
  });
  assert.deepEqual(calls, [['pack', 90, 'Gems'], ['wagon', 90, 'Gems']]);
  // and the host's takeOne passes the refusal through removeOne
  const wm = src('scenes/worldModes.js');
  assert.ok(wm.includes('removeOne(list, templateIndex, { group, allowEnchantedItem: false })'),
    'the wiring spends only un-enchanted reagents');
});

test('F201: an empty-handed player is refused, not handed an empty mixer', () => {
  const wm = src('scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf("destination === 'guildServicePotionMaker'"));
  assert.ok(arm.slice(0, 700).includes('.some(isIngredient)'), 'the pack AND wagon scan');
  assert.ok(arm.slice(0, 700).includes('return { rows: rows(NO_POTION_INGREDIENTS), closesWindow: true };'),
    'NoPotionIngredients (34) with the popup closed, as MakePotionService closes first');
});

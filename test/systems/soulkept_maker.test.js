// SOUL-KEPT (a player's report, 2026-10-31: a Daedric mace made at the Mages Guild's item maker - a Masterwork Rare, nine
// rows laid on it and a Daedra Lord bound - held their trading, gathering and crafting: "it carries a Mace the game could not
// have made"). The piece carried Soul Bound: Daedra Lord without the two drawbacks the soul forces (User Takes Damage in
// holy places, Extra Weight), and the item law (itemLaw.js makerFindings) is right that a soul's set is whole or forged.
// THE GAME MADE IT: the window's Remove matched rows by key alone, so taking back a side effect the player had chosen took
// the soul's forced row of the same kind with it - and freed two rows for more powers. DFU's List.Remove matches the whole
// settings struct, its ParentEnchantment with it, so a chosen row never takes a forced one.
// Driven on the real ItemMakerWindow; the piece is the smith's own mint (smithItems.js mintPiece), the soul a trap bought
// and filled (shopStock.js, mysticism.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../../src/systems/uiPrefs.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { MASTERWORK } from '../../src/net/recipeLaw.js';
import { ItemMakerWindow } from '../../src/ui/item/itemMakerWindow.js';
import { createEmptySoulTrap } from '../../src/systems/shopStock.js';
import { fillEmptyTrap } from '../../src/systems/mysticism.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { enchantmentKey, removeEnchantment, enchantmentSettings, forcedEnchantments } from '../../src/systems/enchantmentCatalogue.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';

globalThis.requestAnimationFrame = () => null;
setPref('lootRarity', true);
const LORD = MOBILE_TYPES.DaedraLord;
const SOUL = enchantmentKey('SoulBound', LORD);

/** The real window over a smith's Masterwork Daedric mace (a Rare, its roll kept) and a Daedra Lord's filled trap. */
function maker() {
  const mace = mintPiece({ recipe: 'mace:daedric', quality: MASTERWORK, seed: 1, maker: 'X' }, '0123456789abcdef');
  assert.equal(mace.rarity, 'rare', 'a Masterwork is a Rare');
  const player = { goldPieces: 1e9, items: [mace, createEmptySoulTrap()] };
  fillEmptyTrap(player.items, LORD);
  const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  w._selectItem(mace);
  return { w, mace, player };
}
/** Open a picker, take `effect`, then its setting `setting` when it asks for one. */
function take(w, powers, effect, setting = null) {
  w._openPicker(powers);
  assert.ok(w.picker, `${effect}: the picker opens`);
  const i = w.picker.items.indexOf(effect);
  assert.ok(i >= 0, `${effect} listed`);
  w.picker.onPick(i);
  if (w.picker) {
    const j = w.picker.items.findIndex((s) => s === setting);
    assert.ok(j >= 0, `${effect}: ${setting} offered`);
    w.picker.onPick(j);
  }
}
const rows = (list) => list.map((e) => `${e.key}${e.parentEnchantment ? ` (${e.parentEnchantment})` : ''}`);

test('SOUL-KEPT, the report: a side effect the player chose, taken back after a Daedra Lord is bound, leaves the soul\'s forced row of that kind - the set stays whole, and the made piece is lawful', () => {
  const { w, mace } = maker();
  take(w, false, 'User Takes Damage', 'in holy places');
  take(w, false, 'Extra Weight');
  take(w, false, 'Soul Bound', 'Daedra Lord');
  const mine = w.sideEffects.filter((e) => !e.parentEnchantment && e.key !== SOUL);
  assert.equal(mine.length, 2, 'the player\'s own two drawbacks');
  for (const e of mine) w._removeRow(e);
  assert.deepEqual(rows(w.sideEffects), [SOUL, `UserTakesDamage:1 (${SOUL})`, `ExtraWeight:-1 (${SOUL})`], 'the soul\'s two drawbacks stay');
  assert.deepEqual(rows(w.powers), [`PotentVs:1 (${SOUL})`], 'and its power');
  take(w, true, 'Potent Vs', 'Undead');
  w._enchant();
  assert.equal(w.box?.rows?.[0]?.text, 'The item has been enchanted.');
  assert.deepEqual(itemFindings(mace), [], 'the item law: lawful');
});

test('SOUL-KEPT: removing the soul still takes its whole set; removing a chosen row takes every chosen copy of its kind and no forced one; a forced row named with its parent is the only one taken', () => {
  const soul = enchantmentSettings('SoulBound', LORD);
  const forced = forcedEnchantments('SoulBound', LORD);
  const mineUtd = enchantmentSettings('UserTakesDamage', 1);
  const list = [mineUtd, soul, ...forced.powers, ...forced.sideEffects];
  assert.deepEqual(rows(removeEnchantment(list, SOUL)), [mineUtd.key], 'the soul takes its set');
  assert.deepEqual(rows(removeEnchantment(list, mineUtd.key)), [SOUL, `PotentVs:1 (${SOUL})`, `UserTakesDamage:1 (${SOUL})`, `ExtraWeight:-1 (${SOUL})`], 'mine alone');
  const utd = forced.sideEffects.find((e) => e.key === mineUtd.key);
  assert.deepEqual(rows(removeEnchantment(list, utd.key, utd.parentEnchantment)), [mineUtd.key, SOUL, `PotentVs:1 (${SOUL})`, `ExtraWeight:-1 (${SOUL})`], 'the forced one alone');
});

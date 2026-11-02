// RPT1026-PROGRESS (private reports, 2026-10-26): the item maker's window (ui/item/itemMakerWindow.js) driven through its
// own doors - its tab, its item, its two pickers and its Enchant button - on pieces and a soul trap the game mints (a
// shop's empty Soul Trap, filled by the kill's own law; two blades of DFU's CreateWeapon). The record is the batch's
// Field-Bugs page.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ItemMakerWindow } from '../../src/ui/item/itemMakerWindow.js';
import { createEmptySoulTrap } from '../../src/systems/shopStock.js';
import { fillEmptyTrap } from '../../src/systems/mysticism.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { enchantDecision } from '../../src/systems/enchanting.js';
import { enchantmentName, enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';

const WRAITH = 23;
const LONGSWORD = 120;   // Weapons: Longsword
const blade = () => createWeapon(LONGSWORD, WEAPON_MATERIALS.Daedric, () => 0.5);
const soulRows = (it) => (it.enchantments ?? []).filter((e) => e.type === T.SoulBound);
/** Bind the Wraith to the item in hand through the window's pickers, as a player does, then press Enchant. */
function bindWraith(w, item) {
  w._selectItem(item);
  w._openPicker(false);
  w.picker = null;
  w._pickPrimary('SoulBound');
  w.picker = null;
  w._pickSecondary('SoulBound', WRAITH);
  w._enchant();
  return w.box?.rows?.[0]?.text;
}

test('RPT1026-PROGRESS (one gem, many binds): one Wraith in one gem binds one blade - in the same window the second blade is not offered the soul, and a Soul Bound row laid for it anyway is refused, nothing paid (mutants: the frozen enumeration; the refusal gone)', () => {
  const a = blade(), b = blade();
  const trap = createEmptySoulTrap();
  const player = { goldPieces: 1_000_000, items: [a, b, trap] };
  assert.equal(fillEmptyTrap(player.items, WRAITH), trap, 'a soul trap bought, and a Wraith trapped in it');
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  assert.equal(bindWraith(w, a), 'The item has been enchanted.');
  assert.deepEqual(soulRows(a).map((e) => e.param), [WRAITH], 'the first blade bound to the Wraith');
  assert.equal(player.items.includes(trap), false, 'the gem spent (SoulBound.RemoveFilledTrap)');
  const gold = player.goldPieces;
  // the second blade, in the window still open: the side effects' list has no Soul Bound now
  w._selectItem(b);
  w._openPicker(false);
  assert.ok(!w.picker.items.includes(enchantmentName('SoulBound')), 'the spent soul is not offered again');
  w.picker = null;
  // ...and the row laid regardless (the window's list as DFU froze it, or a tampered client) is the law's refusal
  w._pickSecondary('SoulBound', WRAITH);
  assert.ok(w.sideEffects.some((e) => e.type === 'SoulBound'), 'the stale row stands in the list');
  w._enchant();
  assert.equal(w.box?.rows?.[0]?.text, 'That soul is no longer in your pack.');
  assert.deepEqual(soulRows(b), [], 'the second blade bound nothing');
  assert.equal(player.goldPieces, gold, 'and paid nothing');
});

test('RPT1026-PROGRESS (one gem, many binds): two gems of one soul bind two blades in one sitting; the law refuses a soul held by none, and asks nothing when no pack is named', () => {
  const a = blade(), b = blade();
  const t1 = createEmptySoulTrap(), t2 = createEmptySoulTrap();
  const player = { goldPieces: 1_000_000, items: [a, b, t1, t2] };
  fillEmptyTrap(player.items, WRAITH); fillEmptyTrap(player.items, WRAITH);
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  assert.equal(bindWraith(w, a), 'The item has been enchanted.');
  assert.equal(bindWraith(w, b), 'The item has been enchanted.', 'the second gem binds the second blade');
  assert.deepEqual([soulRows(a).length, soulRows(b).length, player.items.includes(t1) || player.items.includes(t2)], [1, 1, false]);
  const row = enchantmentSettings('SoulBound', WRAITH);
  assert.equal(enchantDecision(blade(), [], [row], { gold: 1e9, souls: new Set() }).kind, 'soulGone');
  assert.equal(enchantDecision(blade(), [], [row], { gold: 1e9, souls: new Set([WRAITH]) }).kind, 'enchant');
  assert.equal(enchantDecision(blade(), [], [row], { gold: 1e9 }).kind, 'enchant', 'no pack named: the decision as DFU\'s');
});

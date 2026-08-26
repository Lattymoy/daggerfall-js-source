// AUDIT 26, wave "enchant-cap": DaggerfallUnityItem.SetEnchantments
// (:1271-1341) read line by line. Both pins below assert what the C#
// DOES, which in one place is not what its own doc-comment promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEnchantments, MAX_ENCHANTMENTS } from '../src/systems/enchanting.js';
import { enchantmentSettings } from '../src/systems/enchantmentCatalogue.js';
import { setDefaultEnchantCtx } from '../src/systems/enchantments.js';
import { itemIsIdentified } from '../src/systems/tradeModes.js';
import { isEnchanted } from '../src/systems/inventory.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

const ring = (over = {}) => ({
  name: 'Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  weightInKg: 1, currentCondition: 100, maxCondition: 100, ...over,
});
/** A settings row costing n - only the shape SetEnchantments copies. */
const power = (n) => ({ enchantCost: n, parentEnchantment: 0 });

test('audit26 enchant-cap: the cap keeps ELEVEN rows - the break lands after the add (:1324-1325)', () => {
  //   int count = 0;
  //   foreach (EnchantmentSettings settings in enchantments) {
  //       ... legacyEnchantments.Add(legacyEnchantment);   // :1321
  //       if (++count > maxEnchantments)                   // :1324
  //           break;
  //   }
  // with `const int maxEnchantments = 10` (:1273). The row is added
  // BEFORE the test, and the pre-increment makes the tenth pass read
  // `10 > 10` - false. So a whole eleventh pass runs, adds an
  // eleventh row, and only then breaks. The doc-comment above the
  // method says "Maximum of 10 enchantments are applied" (:1270);
  // ELEVEN is what the code applies, and the port follows the code.
  assert.equal(MAX_ENCHANTMENTS, 10, "SetEnchantments' maxEnchantments (:1273)");
  const twenty = Array.from({ length: 20 }, (_, i) => power(i + 1));
  const item = applyEnchantments(ring(), twenty);
  assert.deepEqual(item.enchantments.map((e) => e.enchantCost), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  // The boundary from both sides: eleven rows survive whole, and ten
  // or fewer are never touched.
  assert.equal(applyEnchantments(ring(), twenty.slice(0, 11)).enchantments.length, 11);
  assert.equal(applyEnchantments(ring(), twenty.slice(0, 10)).enchantments.length, 10);
  assert.equal(applyEnchantments(ring(), twenty.slice(0, 1)).enchantments.length, 1);
});

test('audit26 enchant-cap: SetEnchantments ends with IdentifyItem() (:1341)', () => {
  // IdentifyItem() is `flags = (ushort)(flags | identifiedMask)`
  // (:1253-1256), and SetEnchantments calls it on the way out, right
  // after storing legacyMagic/customMagic. An item that just came off
  // the enchanter's bench is identified - it never needs the Identify
  // service - and GetIsIdentified (:1821-1827) reads that same flag.
  const item = applyEnchantments(ring(), [enchantmentSettings('FeatherWeight')]);
  assert.equal(item.isIdentified, true, 'identifiedMask is set');
  assert.equal(isEnchanted(item), true);
  assert.equal(itemIsIdentified(item), true, 'so the derived read says identified');
});

test('audit26 enchant-cap: the Enchanted stamp reads the mounted world clock (HealthLeech.cs:78)', () => {
  // HealthLeech's Enchanted payload stamps
  //   sourceItem.timeHealthLeechLastUsed =
  //     DaggerfallUnity.Instance.WorldTime.DaggerfallDateTime
  //       .ToClassicDaggerfallTime();
  // - a GLOBAL singleton read inside the effect, not something
  // DaggerfallItemMakerWindow passes: its call site is
  // `SetEnchantments(combinedEnchantments.ToArray(), PlayerEntity)`
  // (DaggerfallItemMakerWindow.cs:760), two arguments and no clock.
  // The port's translation of that singleton is the host's mounted
  // enchant ctx, so a caller that passes no clock still stamps the
  // live classic minute.
  try {
    setDefaultEnchantCtx({ now: () => 77777 });
    const made = applyEnchantments(ring(), [enchantmentSettings('HealthLeech', 1)]);
    assert.equal(made.timeHealthLeechLastUsed, 77777, 'the mounted clock, with no per-call clock');
    // An explicit clock still wins over the mount (the per-call ctx
    // rides above the host's in mergeCtx).
    const forced = applyEnchantments(ring(), [enchantmentSettings('HealthLeech', 1)], { nowMinutes: 4321 });
    assert.equal(forced.timeHealthLeechLastUsed, 4321);
  } finally {
    setDefaultEnchantCtx(null);
  }
});

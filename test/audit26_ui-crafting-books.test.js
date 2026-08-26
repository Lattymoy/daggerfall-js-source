// AUDIT 26, wave ui-crafting-books: the item maker window against
// DaggerfallItemMakerWindow.cs / EnchantmentListPicker.cs, and the
// catalogue's secondary display names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ItemMakerWindow, ITEM_RECTS, rowLayout } from '../src/ui/itemMakerWindow.js';
import {
  enchantmentParamName, enchantmentSettings, PARAM_NONE,
} from '../src/systems/enchantmentCatalogue.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { goldStack, splitStack } from '../src/systems/inventory.js';
import { SKILL_NAMES } from '../src/systems/skills.js';

const makeWin = (items, over = {}) => {
  const player = { items };
  const w = new ItemMakerWindow({
    packItems: () => player.items,
    player,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: player,
    ...over,
  });
  return { w, player };
};
const ruby = (over = {}) => ({ group: 'Gems', templateIndex: 0, name: 'Ruby', ...over });

test('F166: a FORCED child row cannot be clicked away - only its parent takes it (EnchantmentListPicker.cs:266-271)', () => {
  const { w } = makeWin([]);
  w.selected = ruby();
  w.selectingPowers = false;
  w._pickSecondary('SoulBound', MOBILE_TYPES.DaedraLord);
  // the soul plus its three forced children, split by their signs
  assert.deepEqual(w.powers.map((e) => e.key), ['PotentVs:1']);
  assert.deepEqual(w.sideEffects.map((e) => e.key),
    [`SoulBound:${MOBILE_TYPES.DaedraLord}`, 'UserTakesDamage:1', 'ExtraWeight:-1']);

  // clicking the forced POWER (a child) removes nothing
  const [px, py] = ITEM_RECTS.powersList;
  const childPower = rowLayout(w.powers)[0];
  w.click(px + 2, py + childPower.y + 1);
  assert.equal(w.powers.length, 1, 'child panels are removed by clicking on parent');

  // clicking a forced child in the SIDE EFFECTS list removes nothing either
  const [sx, sy] = ITEM_RECTS.sideEffectsList;
  const childSide = rowLayout(w.sideEffects).find((r) => r.entry.parentEnchantment !== 0);
  w.click(sx + 2, sy + childSide.y + 1);
  assert.equal(w.sideEffects.length, 3, 'the soul-bound drawbacks cannot be shed');

  // clicking the PARENT takes every child out of BOTH lists with it
  const parentRow = rowLayout(w.sideEffects).find((r) => r.entry.parentEnchantment === 0);
  w.click(sx + 2, sy + parentRow.y + 1);
  assert.deepEqual([w.powers, w.sideEffects], [[], []]);
});

test('F167: enchanting a STACK splits ONE item off - the rest stay plain (DaggerfallItemMakerWindow.cs:751-754)', () => {
  const stack = ruby({ stackCount: 5 });
  const { w, player } = makeWin([goldStack(100000), stack]);
  w.selected = stack;
  w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  w._enchant();
  assert.equal(stack.stackCount, 4, 'the stack lost exactly one');
  assert.equal(stack.enchantments, undefined, 'and stays plain');
  const single = player.items.find((it) => it !== stack && it.group === 'Gems');
  assert.equal(single.stackCount, 1, 'SplitStack(selectedItem, 1)');
  assert.deepEqual(single.enchantments.map((e) => e.type), ['FeatherWeight'],
    'the split single carries the enchantment');

  // ItemCollection.SplitStack itself (:261-272): the whole stack is
  // answered as-is, a bad pick is null
  const list = [stack];
  assert.equal(splitStack(list, stack, 4), stack, 'picking the whole stack answers the stack');
  assert.equal(splitStack(list, stack, 5), null);
  assert.equal(splitStack(list, ruby({ stackCount: 3 }), 1), null, 'not in the collection');
});

test('F168: the gold label and check count LETTERS OF CREDIT (PlayerEntity.cs:1313-1316)', () => {
  const letter = { templateIndex: 275, group: 'MiscItems', name: 'Letter of Credit', value: 5000 };
  const gem = ruby();
  const { w } = makeWin([goldStack(10), letter, gem]);
  assert.equal(w.gold(), 5010, 'GetGoldAmount = goldPieces + GetCreditAmount');
  assert.equal(w.labels().availableGold, '5010');

  // an enchant priced past the purse but within the letters PROCEEDS
  // (the check at :734 reads GetGoldAmount, and DeductGoldAmount
  // spends the letters)
  w.selected = gem;
  w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];   // 1000 gold
  w._enchant();
  assert.deepEqual(gem.enchantments.map((e) => e.type), ['FeatherWeight'],
    'the letters paid the enchanter');
});

test('F169: a list row prints the label for the PARAM VALUE, never names[param] (EnchantmentListPicker.cs:333-334)', () => {
  // CastWhen* params are sparse classic SPELL ids (CastWhenUsed.cs:67)
  assert.equal(enchantmentParamName('CastWhenUsed', 12), 'Resist Fire');
  assert.equal(enchantmentParamName('CastWhenUsed', 14), 'Fireball');
  assert.equal(enchantmentParamName('CastWhenUsed', 94), 'Recall', 'a param past the dense array still names');
  assert.equal(enchantmentParamName('CastWhenHeld', 89), 'Jack of Trades');
  assert.equal(enchantmentParamName('CastWhenStrikes', 55), 'Sphere of Negation');
  // dense param-table effects read the same as before - identity order
  assert.equal(enchantmentParamName('ItemDeteriorates', 1), 'in sunlight');
  assert.equal(enchantmentParamName('EnhancesSkill', 22), SKILL_NAMES[22]);
  // a single-cost effect has no secondary name
  assert.equal(enchantmentParamName('FeatherWeight', PARAM_NONE), '');
  assert.equal(enchantmentParamName('CastWhenUsed', 999), '', 'an unminted param names nothing');
});

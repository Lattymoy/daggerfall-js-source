// AUDIT 26, wave ui-crafting-books: the item maker window against
// DaggerfallItemMakerWindow.cs / EnchantmentListPicker.cs, and the
// catalogue's secondary display names. The wave's two POTION-maker
// laws (the all-or-nothing recipe fill and the scrolling ingredient
// list) correct pins that already existed, so they stay in
// test/potionmakerwindow.test.js where the rest of that window is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ItemMakerWindow, ITEM_RECTS, rowLayout, _setItemMakerArtForTests,
} from '../src/ui/itemMakerWindow.js';
import {
  enchantmentParamName, enchantmentSettings, PARAM_NONE,
} from '../src/systems/enchantmentCatalogue.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { goldStack, splitStack } from '../src/systems/inventory.js';
import { SKILL_NAMES } from '../src/systems/skills.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

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

const canvas = { width: 320, height: 200 };   // scale 1, no letterbox
const recorder = () => ({
  quads: [],
  uploadTexture: () => 'tex',
  drawScreenQuad(tex, rect, uv, color) { this.quads.push({ tex, ...rect, uv, color }); },
});
/** The port's drawSpy idiom (test/spellbookwindow.test.js:54-64):
 *  drawText asks glyphWidth for every drawn character, so the painted
 *  STRINGS come back through the font. Spaces are skipped by drawText,
 *  so the tape is the printable characters only. */
function spyFont() {
  const chars = [];
  return {
    chars,
    get drawn() { return chars.join(''); },
    fnt: {
      fixedHeight: 6,
      fixedWidth: 4,
      glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; },
    },
  };
}
const mountArt = () => _setItemMakerArtForTests(
  { tex: 'item00', w: 320, h: 200 }, { tex: 'item01', w: 81, h: 36 });
const unmountArt = () => _setItemMakerArtForTests(null, null);

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
  assert.equal(splitStack(list, stack, 0), null, 'numberToPick < 1');
  assert.equal(splitStack(list, ruby({ stackCount: 3 }), 1), null, 'not in the collection');
  // !stack.IsAStack() is stackCount > 1 (DaggerfallUnityItem.cs:701-704),
  // so a SINGLE never splits - which is why _enchant tests the count
  // before it calls at all
  const one = ruby({ stackCount: 1 });
  assert.equal(splitStack([one], one, 1), null, 'a single item is not a stack');
  const bare = ruby();
  assert.equal(splitStack([bare], bare, 1), null, 'no stackCount at all is a single');

  // ...and an UNSTACKED item is enchanted where it lies (no split)
  const solo = ruby();
  const solow = makeWin([goldStack(100000), solo]);
  solow.w.selected = solo;
  solow.w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  solow.w._enchant();
  assert.deepEqual(solo.enchantments.map((e) => e.type), ['FeatherWeight']);
  assert.equal(solow.player.items.filter((it) => it.group === 'Gems').length, 1,
    'nothing was split off a single');
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

test('F169 draw: the LIST ROW paints that name - not names[param] (EnchantmentListPicker.cs:333-334)', () => {
  mountArt();
  try {
    const { w } = makeWin([]);
    w.selected = ruby();
    // classic spell 12 is Resist Fire; index 12 of the dense label
    // list is Fireball, and 94 (Recall) runs off its end entirely
    w.powers = [enchantmentSettings('CastWhenUsed', 12), enchantmentSettings('CastWhenUsed', 94)];
    w.sideEffects = [enchantmentSettings('ItemDeteriorates', 1)];
    const f = spyFont();
    w.draw(recorder(), canvas, f);
    const painted = f.drawn;
    assert.ok(painted.includes('ResistFire'), `param 12 names Resist Fire (got ${painted})`);
    assert.ok(painted.includes('Recall'), 'a param past the dense array still names its spell');
    assert.equal(painted.includes('Fireball'), false,
      'names[12] is Fireball - the row must not index the dense list by the classic id');
    assert.equal(painted.includes('undefined'), false, 'names[94] is off the end');
    // the primary name is still GroupName, and a dense param-table
    // effect reads the same either way
    assert.ok(painted.includes('CastWhenUsed'), 'PrimaryDisplayName');
    assert.ok(painted.includes('insunlight'), "ItemDeteriorates' own label");
  } finally { unmountArt(); }
});

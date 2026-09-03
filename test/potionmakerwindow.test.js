// M2: the potion maker WINDOW against DaggerfallPotionMakerWindow.cs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POTION_RECTS, POTION_LABELS, INGREDIENT_BUTTONS, CAULDRON_BUTTONS,
  INGREDIENT_LIST_X, INGREDIENT_SCROLL_UP, INGREDIENT_SCROLL_DOWN, INGREDIENT_COLS,
  POTION_MIXED, POTION_FAILED, NO_RECIPES, REQ_INGREDIENTS,
  slotAt, PotionMakerWindow, _setPotionArtForTests,
} from '../src/ui/potionMakerWindow.js';
import {
  POTION_RECIPES, potionRecipeKey, CAULDRON_CAPACITY,
} from '../src/systems/potions.js';
// AUDIT 54: the gold label is GetGoldAmount, not the bare counter
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { letterOfCredit } from '../src/systems/inventory.js';
import { goldAmount, totalGoldAmount } from '../src/systems/court.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const byName = (n) => POTION_RECIPES.find((r) => r.name === n);
const ing = (t, n = 1) => ({ templateIndex: t, stackCount: n });

const recorder = () => ({ quads: [], uploadTexture: () => 'tex', drawScreenQuad() {} });
const plainFont = () => ({ fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } });

function win(over = {}) {
  const pack = over.pack ?? [ing(59), ing(26), ing(24)];
  const wagon = over.wagon ?? [];
  const minted = [];
  let closed = 0;
  const w = new PotionMakerWindow({
    packItems: () => pack,
    wagonItems: () => wagon,
    gold: () => 1234,
    recipeKeys: () => over.recipeKeys ?? [],
    addPotion: (recipe, key) => minted.push({ name: recipe.name, key }),
    takeOne: (t, where) => {
      const list = where === 'pack' ? pack : wagon;
      const i = list.findIndex((x) => x.templateIndex === t);
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: {},
    onClose: () => { closed++; },
    ...over.hooks,
  });
  return { w, pack, wagon, minted, closed: () => closed };
}

const clickRect = (w, key) => {
  const [x, y, rw, rh] = POTION_RECTS[key];
  return w.click(x + rw / 2, y + rh / 2);
};
const clickSlot = (w, list, i) => {
  const origin = POTION_RECTS[list === 'cauldron' ? 'cauldronList' : 'ingredientsList'];
  const grid = list === 'cauldron' ? CAULDRON_BUTTONS : INGREDIENT_BUTTONS;
  const off = list === 'cauldron' ? 0 : INGREDIENT_LIST_X;
  const [bx, by, bw, bh] = grid[i];
  return w.click(origin[0] + off + bx + bw / 2, origin[1] + by + bh / 2);
};

test('M2: MASK00I0 is a FULL-SCREEN background, so the rects are absolute (:75-76)', () => {
  // there is no centred panel to offset from - this is the one window
  // in the arc whose art is the whole 320x200
  assert.deepEqual([...POTION_RECTS.recipes], [169, 26, 36, 16]);
  assert.deepEqual([...POTION_RECTS.mix], [169, 42, 36, 16]);
  assert.deepEqual([...POTION_RECTS.exit], [290, 178, 24, 16]);
  assert.deepEqual([...POTION_RECTS.ingredientsList], [5, 30, 151, 142]);
  assert.deepEqual([...POTION_RECTS.cauldronList], [221, 30, 84, 142]);
  assert.deepEqual([...POTION_LABELS.name], [33, 185]);
  assert.deepEqual([...POTION_LABELS.gold], [237, 185]);
  // everything fits on screen
  for (const [k, r] of Object.entries(POTION_RECTS)) {
    assert.ok(r[0] + r[2] <= 320 && r[1] + r[3] <= 200, `${k} fits`);
  }
});

test('M2: the two grids - twelve ingredient slots, EIGHT cauldron slots (:31-50)', () => {
  assert.equal(INGREDIENT_BUTTONS.length, 12, 'three columns of four');
  assert.equal(CAULDRON_BUTTONS.length, 8, 'two columns of four');
  // the cauldron SHOWS exactly what it can HOLD - which is why the
  // eight-slot cap in the law is not arbitrary
  assert.equal(CAULDRON_BUTTONS.length, CAULDRON_CAPACITY);
  // the 56/38 grid, verbatim
  assert.deepEqual([...INGREDIENT_BUTTONS[0]], [0, 0, 28, 28]);
  assert.deepEqual([...INGREDIENT_BUTTONS[1]], [56, 0, 28, 28]);
  assert.deepEqual([...INGREDIENT_BUTTONS[2]], [112, 0, 28, 28]);
  assert.deepEqual([...INGREDIENT_BUTTONS[3]], [0, 38, 28, 28]);
  assert.deepEqual([...INGREDIENT_BUTTONS[11]], [112, 114, 28, 28]);
  assert.deepEqual([...CAULDRON_BUTTONS[1]], [56, 0, 28, 28]);
  assert.deepEqual([...CAULDRON_BUTTONS[7]], [56, 114, 28, 28]);
  // slotAt finds a slot and MISSES the gaps between them
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 5, 5), 0);
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 60, 5), 1);
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 40, 5), null, 'the gap between columns');
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 5, 33), null, 'the gap between rows');
  // and the ingredient list's own x offset applies
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 5, 5, INGREDIENT_LIST_X), null);
  assert.equal(slotAt([0, 0], INGREDIENT_BUTTONS, 5 + INGREDIENT_LIST_X, 5, INGREDIENT_LIST_X), 0);
});

test('M2: clicking an ingredient moves it INTO the pot and out of the list', () => {
  const { w } = win();
  assert.equal(w.ingredients().length, 3);
  assert.equal(w.cauldron.length, 0);
  clickSlot(w, 'ingredients', 0);
  assert.equal(w.cauldron.length, 1);
  assert.equal(w.ingredients().length, 2, 'it left the ingredient list');
  // clicking it in the CAULDRON takes it back
  clickSlot(w, 'cauldron', 0);
  assert.equal(w.cauldron.length, 0);
  assert.equal(w.ingredients().length, 3);
  // a click on an empty cauldron slot does nothing
  assert.ok(clickSlot(w, 'cauldron', 5));
  assert.equal(w.cauldron.length, 0);
});

test('M2: a FULL pot simply refuses, with no message (:253)', () => {
  const pack = Array.from({ length: 12 }, (_, i) => ing(8 + i));
  const { w } = win({ pack });
  for (let i = 0; i < 12; i++) clickSlot(w, 'ingredients', 0);
  assert.equal(w.cauldron.length, CAULDRON_CAPACITY, 'it stopped at eight');
  assert.equal(w.box, null, 'and said nothing about it');
  assert.equal(w.ingredients().length, 4, 'the rest are still in the pack');
});

test('M2: only INGREDIENTS are offered - the pack is filtered', () => {
  const { w } = win({ pack: [ing(59), ing(131), ing(26)] });   // Arrow in the middle
  assert.deepEqual(w.ingredients().map((i) => i.templateIndex), [59, 26],
    'an Arrow is not an ingredient and never reaches the list');
});

test('M2: mixing a real recipe mints a potion and SPENDS the ingredients (:311-345)', () => {
  const { w, pack, minted } = win();
  for (let i = 0; i < 3; i++) clickSlot(w, 'ingredients', 0);
  assert.equal(w.cauldron.length, 3);
  clickRect(w, 'mix');
  assert.equal(minted.length, 1);
  assert.equal(minted[0].name, 'slowFalling');
  assert.equal(minted[0].key, potionRecipeKey(byName('slowFalling').ingredients));
  assert.equal(w.box.rows[0].text, POTION_MIXED);
  assert.equal(POTION_MIXED, 'Your potion has been mixed.',
    'Internal_Strings.csv:853 "potionMixed", verbatim');
  assert.equal(w.cauldron.length, 0, 'the pot is emptied');
  assert.equal(pack.length, 0, 'and the ingredients are gone from the pack');
  // AUDIT 26 F177: MixCauldron never touches the name label
  // (:311-360) - only a recipe fill writes it (:307). The old pin
  // here had pinned the port's invented mix-time write.
  assert.equal(w.nameLabel, '', 'the label is the RECIPE\'s, not the mix\'s');
});

test('M2: a FAILED mix makes nothing and STILL spends the ingredients (:328-333)', () => {
  const { w, pack, minted } = win({ pack: [ing(8), ing(9), ing(10)] });
  for (let i = 0; i < 3; i++) clickSlot(w, 'ingredients', 0);
  clickRect(w, 'mix');
  assert.equal(minted.length, 0, 'no potion - DFU refuses to make a useless one');
  assert.equal(w.box.rows[0].text, POTION_FAILED);
  assert.equal(POTION_FAILED, 'Those ingredients did not concoct an effective potion.',
    'Internal_Strings.csv:854 "potionFailed", verbatim');
  assert.equal(pack.length, 0, 'but the herbs are burnt either way');
  assert.equal(w.cauldron.length, 0);
});

test('M2: the consume walk reaches the WAGON, and a break leaves the pot full', () => {
  // the middle ingredient is only in the cart
  const pack = [ing(59), ing(24)];
  const { w, wagon } = win({ pack, wagon: [ing(26)] });
  w.cauldron = [ing(59), ing(26), ing(24)];
  clickRect(w, 'mix');
  assert.equal(w.cauldron.length, 0, 'the cart covered it');
  assert.equal(wagon.length, 0);

  // and when NEITHER has it, the walk breaks: the pot is NOT emptied
  const b = win({ pack: [ing(59)], wagon: [] });
  b.w.cauldron = [ing(59), ing(26), ing(24)];
  clickRect(b.w, 'mix');
  assert.equal(b.w.cauldron.length, 3, 'a broken cauldron is left standing');
  assert.equal(b.pack.length, 0, 'though the first ingredient was already spent');
});

test('M2: the RECIPES button - an empty list is a MESSAGE, not an empty picker (:376-382)', () => {
  const none = win();
  clickRect(none.w, 'recipes');
  assert.equal(none.w.picker, null);
  assert.equal(none.w.box.rows[0].text, NO_RECIPES);
  assert.equal(NO_RECIPES, 'You have no recipes.',
    'Internal_Strings.csv:852 "noRecipes", verbatim');

  // with recipes known, the picker opens on their names
  const slowKey = potionRecipeKey(byName('slowFalling').ingredients);
  const some = win({ recipeKeys: [slowKey] });
  clickRect(some.w, 'recipes');
  assert.ok(some.w.picker, 'the picker opened');
  assert.equal(some.w.box, null);
});

test('M2: a recipe pick REFUSES on any missing ingredient, else CLEARS and fills (:283-309)', () => {
  const slowKey = potionRecipeKey(byName('slowFalling').ingredients);
  // all three present: the pot fills and the label names the recipe (:302-308)
  const all = win({ recipeKeys: [slowKey] });
  all.w._fillFrom(byName('slowFalling'));
  assert.deepEqual(all.w.cauldron.map((i) => i.templateIndex).sort((a, b) => a - b), [24, 26, 59]);
  assert.equal(all.w.nameLabel, 'slowFalling', 'nameLabel = recipeName (:307)');
  assert.equal(all.w.box, null);

  // only two present: "reqIngredients" and NOTHING is added (:297-301)
  const part = win({ recipeKeys: [slowKey], pack: [ing(59), ing(24)] });
  part.w._fillFrom(byName('slowFalling'));
  assert.deepEqual(part.w.cauldron, [], 'no partial fill - DFU refuses the whole recipe');
  assert.equal(part.w.box.rows[0].text, REQ_INGREDIENTS);
  assert.equal(REQ_INGREDIENTS, 'You do not have the ingredients required.',
    'Internal_Strings.csv:855 "reqIngredients", verbatim');
  assert.equal(part.w.nameLabel, '');

  // leftovers in the pot are CLEARED first, not mixed in (:304)
  const left = win({ recipeKeys: [slowKey], pack: [ing(59), ing(26), ing(24), ing(8)] });
  clickSlot(left.w, 'ingredients', 3);   // the stray herb goes in the pot first
  assert.equal(left.w.cauldron[0].templateIndex, 8);
  left.w._fillFrom(byName('slowFalling'));
  assert.deepEqual(left.w.cauldron.map((i) => i.templateIndex).sort((a, b) => a - b), [24, 26, 59],
    'the stray herb went back to the list, not under the recipe');
  assert.equal(left.w.ingredients().some((i) => i.templateIndex === 8), true);
});

test('M2: the ingredient list SCROLLS - the arrows step by ROW, clamped (ItemListScroller.cs:588-604)', () => {
  // the two arrows sit in the scroller's left column, verbatim:
  // (0,0,9,16) and (0, height-16, 9, 16) of (5,30,151,142)
  assert.deepEqual([...INGREDIENT_SCROLL_UP], [5, 30, 9, 16]);
  assert.deepEqual([...INGREDIENT_SCROLL_DOWN], [5, 156, 9, 16]);
  const clickArrow = (w, [x, y, aw, ah]) => w.click(x + aw / 2, y + ah / 2);

  const pack = Array.from({ length: 15 }, (_, i) => ing(8 + i));   // five rows of three
  const { w } = win({ pack });
  // up at the top holds (the scroll bar floors at 0)
  clickArrow(w, INGREDIENT_SCROLL_UP);
  assert.equal(w.scroll, 0);
  // down steps ONE ROW, and a slot click reads scrollIndex * listWidth (:419, :599)
  clickArrow(w, INGREDIENT_SCROLL_DOWN);
  assert.equal(w.scroll, 1);
  clickSlot(w, 'ingredients', 0);
  assert.equal(w.cauldron[0].templateIndex, 8 + INGREDIENT_COLS,
    'slot 0 of the scrolled list is the fourth ingredient - 13+ are reachable');
  // ...and GetSafeScrollIndex clamps at rows - 4 (:477-481)
  for (let i = 0; i < 9; i++) clickArrow(w, INGREDIENT_SCROLL_DOWN);
  assert.equal(w.scroll, 1, 'five rows of three leave exactly one row below the fold');
  clickArrow(w, INGREDIENT_SCROLL_UP);
  assert.equal(w.scroll, 0);

  // ...and the GRID shows the same window it clicks: UpdateItemsDisplay
  // walks items[scrollIndex * listWidth + i] for the twelve buttons
  // (:415-425), so 13+ are SEEN as well as reachable
  _setPotionArtForTests({ tex: 'mask00', w: 320, h: 200 });
  try {
    const grid = win({ pack: Array.from({ length: 15 }, (_, i) => ing(8 + i)) }).w;
    const shown = () => {
      const seen = [];
      grid._icon = (r, m, it) => { seen.push(it.templateIndex); return true; };
      grid.draw(recorder(), { width: 320, height: 200 }, plainFont());
      return seen;
    };
    assert.deepEqual(shown(), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      'the unscrolled grid is the first twelve');
    clickArrow(grid, INGREDIENT_SCROLL_DOWN);
    assert.deepEqual(shown(), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      'one row down shifts the window by listWidth - the last three are visible');
  } finally { _setPotionArtForTests(null); }
});

test('M2: the box and the picker swallow input before the window does', () => {
  const { w } = win({ pack: [ing(8), ing(9)] });
  clickSlot(w, 'ingredients', 0);
  clickRect(w, 'mix');
  assert.ok(w.box, 'a failure box is up');
  // Escape dismisses the BOX, not the window
  w.input('Escape');
  assert.equal(w.box, null);
  assert.equal(w.done, false);
  // ...and now Escape closes
  w.input('Escape');
  assert.equal(w.done, true);
});

test('AUDIT 54: the mixer\'s gold label is GetGoldAmount - coins PLUS letters of credit (:138)', () => {
  // Refresh writes `goldLabel.Text = GameManager.Instance.PlayerEntity
  // .GetGoldAmount().ToString()` (DaggerfallPotionMakerWindow.cs:138),
  // and GetGoldAmount is `goldPieces + items.GetCreditAmount()`
  // (PlayerEntity.cs:1313-1316). The two labels in the window set that
  // really are the bare GoldPieces counter are the spell maker's
  // (DaggerfallSpellMakerWindow.cs:358) and the travel popup's (:280),
  // and both carry that note; this one had the coins-only reader and
  // no note, so a character whose money is all paper read 0 gold.
  const entity = { goldPieces: 0, items: [letterOfCredit(5000)] };
  assert.equal(goldAmount(entity), 0, 'the counter alone');
  assert.equal(totalGoldAmount(entity), 5000, 'GetGoldAmount sees the letter');

  // the DRAW is the observation: a font that records the glyph indices
  // it is asked for (text.js:88-89) reconstructs the painted string.
  _setPotionArtForTests({ tex: 'mask00', w: 320, h: 200 });
  try {
    const chars = [];
    const spy = { tex: null, fnt: { fixedHeight: 6, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; } } };
    const { w } = win({ hooks: { gold: () => totalGoldAmount(entity) } });
    w.draw(recorder(), { width: 320, height: 200 }, spy);
    assert.match(chars.join(''), /5000/, 'the mixer paints the letter\'s face value');
  } finally { _setPotionArtForTests(null); }

  // ...and the law lives at the HOST's mount, which is what supplies
  // the hook - the window paints whatever it is handed.
  const wm = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  const start = wm.indexOf('potionWin = new PotionMakerWindow({');
  assert.ok(start > 0, 'found the mount');
  const mount = wm.slice(start, wm.indexOf('\n      });', start));
  assert.match(mount, /gold: \(\) => totalGoldAmount\(playerEntity\),/,
    'DaggerfallPotionMakerWindow.cs:138 reads GetGoldAmount');
  assert.doesNotMatch(mount, /gold: \(\) => goldAmount\(playerEntity\),/,
    'not the coins-only counter');
});

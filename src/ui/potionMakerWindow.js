// M2 - THE POTION MAKER: DaggerfallPotionMakerWindow (MIT, Daggerfall
// Workshop) on real ARENA2 art, over M1's law.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is MASK00I0.IMG, which ships a FULL 320x200 - it is a
//   whole-screen background rather than a centred panel, so there is
//   no alignment to compute and every rect below is screen-absolute.
// - NativePanel.BackgroundColor is (0,0,0,0.60) UNDER that texture
//   (:104) - a 60% black wash, not the opaque black most windows use
//   and not ScreenDimColor either. Both are drawn.
// - two buttons at the top right: RECIPES (169,26,36,16) and MIX
//   (169,42,36,16); exit is (290,178,24,16).
// - the INGREDIENTS list is a 4x3 scroller in (5,30,151,142) and the
//   CAULDRON is a 4x2 fixed list in (221,30,84,142) - the cauldron
//   does not scroll, because it holds eight and shows eight.
// - three labels on the bottom row (:208-213): the name at (33,185)
//   and the gold at (237,185). The COST label between them is
//   commented out in DFU and is not drawn here either.
//
// The laws are systems/potions.js's - the hash, the sort, the eight-
// slot cap, the wagon fallback and the break. This file is the panel,
// the two lists and the picker.
//
// FLAGGED: DFU's ingredient buttons carry a tooltip and a stack-count
// label through ItemListScroller's own template; the port's shared
// scroller draws the icon and the stack label, and the tooltip rides
// U37's ToolTip once the scroller exposes a per-slot hover.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import { ListPickerWindow, listPickerArtLoaded } from './listPicker.js';
import { makeIconDrawer, drawStackLabel } from './itemScroller.js';
import { audio } from '../systems/audio.js';
import { isEnchanted } from '../systems/inventory.js';   // F176: Refresh's !IsEnchanted (:148)
import { SOUND } from '../systems/soundClips.js';
import {
  CAULDRON_CAPACITY, cauldronAccepts, mixCauldron, consumeCauldron,
  isIngredient, knownRecipes, gatherRecipe,
} from '../systems/potions.js';

/** MASK00I0 is a full-screen background (:75-76), so the rects are
 *  screen-absolute rather than panel-relative. */
export const POTION_RECTS = Object.freeze({
  recipes: [169, 26, 36, 16],
  mix: [169, 42, 36, 16],
  exit: [290, 178, 24, 16],
  ingredientsList: [5, 30, 151, 142],
  cauldronList: [221, 30, 84, 142],
});
/** The label row (:208-213). The cost label between these two is
 *  COMMENTED OUT in DFU and is not drawn. */
export const POTION_LABELS = Object.freeze({ name: [33, 185], gold: [237, 185] });

/** ingredientButtonRects (:31-38) and cauldronButtonRects (:43-50),
 *  both panel-relative to their list. Three columns of four for the
 *  ingredients on a 56/38 grid; two columns of four for the cauldron
 *  on the same rows - which is why the cauldron holds exactly eight. */
const GRID = (cols) => {
  const out = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < cols; col++) out.push([col * 56, row * 38, 28, 28]);
  }
  return out;
};
export const INGREDIENT_BUTTONS = Object.freeze(GRID(3).map(Object.freeze));
export const CAULDRON_BUTTONS = Object.freeze(GRID(2).map(Object.freeze));
/** ingredientsListRect's x offset inside the scroller (:29). */
export const INGREDIENT_LIST_X = 11;
/** The ingredient scroller is a REAL scroller (ItemListScroller with
 *  scroll=true, :226-232), 4 rows of 3, and its left column - the
 *  11px ingredientsListRect leaves free - carries the two arrows:
 *  up at (0,0,9,16) and down at (0, height-16, 9, 16) of the
 *  scroller's own rect (ItemListScroller.cs:27-28, :293-309). The
 *  cauldron's is scroll=false and has none. */
export const INGREDIENT_ROWS = 4, INGREDIENT_COLS = 3;
export const INGREDIENT_SCROLL_UP = Object.freeze([5, 30, 9, 16]);
export const INGREDIENT_SCROLL_DOWN = Object.freeze([5, 30 + 142 - 16, 9, 16]);

/** "potionMixed" / "potionFailed" / "noRecipes" / "reqIngredients" -
 *  Internal_Strings, recovered. */
export const POTION_MIXED = 'You have successfully mixed a potion.';
export const POTION_FAILED = 'The ingredients you have combined are useless.';
export const NO_RECIPES = 'You do not know any potion recipes.';
export const REQ_INGREDIENTS = 'You do not have the ingredients required.';

let _art = null;
export async function preloadPotionArt(deps) {
  if (_art) return;
  try {
    _art = await loadImg(deps, 'MASK00I0.IMG');
  } catch { console.warn('[potions] MASK00I0 unavailable; the potion maker stays closed'); }
}
export const potionArtLoaded = () => !!_art;
export function _setPotionArtForTests(art) { _art = art; }

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** Which slot of a list a point lands in, or null. `origin` is the
 *  list's screen rect and `buttons` its panel-relative grid. */
export function slotAt(origin, buttons, x, y, offsetX = 0) {
  for (let i = 0; i < buttons.length; i++) {
    const [bx, by, bw, bh] = buttons[i];
    if (inRect([origin[0] + offsetX + bx, origin[1] + by, bw, bh], x, y)) return i;
  }
  return null;
}

/**
 * hooks:
 *   packItems()    -> the player's items (the ingredient list filters them)
 *   wagonItems()   -> the cart, for the consume walk's fallback
 *   gold()         -> the label
 *   recipeKeys()   -> the potion recipes the player has learned
 *   addPotion(recipe, key)  the host mints and banks the potion
 *   takeOne(templateIndex, where) -> bool  the host's removal
 *   icons, entity, onClose
 */
export class PotionMakerWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.cauldron = [];
    this.scroll = 0;
    this.nameLabel = '';
    this.box = null;
    this.picker = null;
    this._icon = makeIconDrawer(hooks.icons, () => hooks.entity);
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  /** The pack's ingredients, minus the UNITS already in the cauldron.
   *  AUDIT 26 F174/F176: DFU's Refresh collects `item.IsIngredient &&
   *  !item.IsEnchanted` (:147-149) - an enchanted gem cannot be
   *  ground into a potion - and AddToCauldron splits ONE unit off a
   *  stack (:251-264), so the remainder stays visible and addable.
   *  The old cut filtered on the template flag alone and removed the
   *  whole stack OBJECT by identity: a stack of N elderberries
   *  vanished while one unit sat in the pot. */
  ingredients() {
    const potted = new Map();
    for (const c of this.cauldron) potted.set(c.templateIndex, (potted.get(c.templateIndex) ?? 0) + 1);
    const out = [];
    for (const it of this.hooks.packItems?.() ?? []) {
      if (!isIngredient(it) || isEnchanted(it)) continue;
      const held = it.stackCount ?? 1;
      const take = Math.min(potted.get(it.templateIndex) ?? 0, held);
      if (take > 0) potted.set(it.templateIndex, (potted.get(it.templateIndex) ?? 0) - take);
      const left = held - take;
      if (left > 0) out.push(left === held ? it : { ...it, stackCount: left });
    }
    return out;
  }

  /** AddToCauldron (:251-264) - a full pot simply refuses, with no
   *  message, and the name label clears on every change. */
  _addToCauldron(item) {
    if (!cauldronAccepts(this.cauldron)) return;
    this.nameLabel = '';
    // SplitStack(item, 1) (:257-258): the pot holds ONE unit; the
    // remainder stays in the grid through ingredients()'s subtraction.
    this.cauldron.push({ ...item, stackCount: 1 });
  }

  /** ItemsUpButton/ItemsDownButton_OnMouseClick (ItemListScroller.cs:
   *  588-604): the index steps by ROW, with a click sound, and
   *  GetSafeScrollIndex (:469-484) clamps it to [0, rows - 4]. */
  _scrollIngredients(dir) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const rows = Math.ceil(this.ingredients().length / INGREDIENT_COLS);
    this.scroll = Math.max(0, Math.min(Math.max(0, rows - INGREDIENT_ROWS), this.scroll + dir));
  }

  /** RemoveFromCauldron (:266-274). */
  _removeFromCauldron(slot) {
    if (slot >= this.cauldron.length) return;
    this.nameLabel = '';
    this.cauldron.splice(slot, 1);
  }

  /** MixCauldron (:311-345), through the law. AUDIT 26 F173: the
   *  button plays its click and mixes only `if (cauldron.Count > 0)`
   *  (:393-398) - an empty pot used to hash to no recipe and pop the
   *  POTION_FAILED box DFU never shows. */
  _mix() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (this.cauldron.length === 0) return;
    const result = mixCauldron(this.cauldron.map((it) => it.templateIndex));
    if (result.kind === 'failed') {
      this.box = { rows: [{ text: POTION_FAILED, center: true }] };
    } else {
      this.hooks.addPotion?.(result.recipe, result.key);
      // F177: MixCauldron never touches the name label (:311-360) -
      // only AddRecipeToCauldron writes it (:307); the old mix-time
      // write inverted DFU's label.
      this.box = { rows: [{ text: POTION_MIXED, center: true }] };
      audio.playOneShot(SOUND.MakePotion, 1);
    }
    // The ingredients are spent EITHER WAY, and the walk can break
    // partway - which leaves the cauldron un-emptied, verbatim.
    const spend = consumeCauldron(this.cauldron, {
      // F176: GetItem(group, template, allowEnchantedItem: false)
      // (:338, :345) - the group rides along so the host can refuse
      // to spend an enchanted twin of a plain reagent.
      takeFromPack: (t, g) => !!this.hooks.takeOne?.(t, 'pack', g),
      takeFromWagon: (t, g) => !!this.hooks.takeOne?.(t, 'wagon', g),
    });
    if (spend.kind === 'spent') this.cauldron = [];
  }

  /** RecipesButton_OnMouseClick (:376-382): an empty list is a message
   *  box rather than an empty picker. */
  _recipes() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const known = knownRecipes(this.hooks.recipeKeys?.() ?? []);
    if (!known.length) { this.box = { rows: [{ text: NO_RECIPES, center: true }] }; return; }
    this.picker = new ListPickerWindow({
      items: known.map((r) => r.name),
      onPick: (i) => { this._fillFrom(known[i]); this.picker = null; },
      onCancel: () => { this.picker = null; },
    });
  }

  /** AddRecipeToCauldron (:283-309). ANY missing ingredient refuses
   *  the WHOLE recipe with "reqIngredients" and adds nothing
   *  (:297-301); otherwise the cauldron is CLEARED first, every
   *  ingredient goes in, and the name label takes the recipe's name
   *  (:302-308). */
  _fillFrom(recipe) {
    const avail = this.ingredients();
    const { found, missing } = gatherRecipe(recipe, avail.map((it) => it.templateIndex));
    if (missing.length > 0) {
      this.box = { rows: [{ text: REQ_INGREDIENTS, center: true }] };
      return;
    }
    // ClearCauldron() (:304) - leftovers go back to the list, they
    // are not mixed in under the recipe
    this.cauldron = [];
    const pool = [...avail];
    for (const id of found) {
      const at = pool.findIndex((it) => it.templateIndex === id);
      if (at < 0) continue;
      this._addToCauldron(pool.splice(at, 1)[0]);
    }
    this.nameLabel = recipe.name;
  }

  input(code) {
    if (this.picker) { this.picker.input(code); if (this.picker?.done) this.picker = null; return; }
    if (this.box) { this.box = null; return; }
    if (code === 'Escape' || code === 'KeyE') { this._close(); return; }
    if (code === 'Enter' || code === 'KeyM') { this._mix(); return; }
    if (code === 'KeyR') this._recipes();
  }

  /** ROAD-A7: the recipe picker's hover seam. */
  hover(vx, vy, e = null) { this.picker?.hover(vx, vy, e); }

  click(vx, vy) {
    if (this.picker) { this.picker.click(vx, vy, this._font); if (this.picker?.done) this.picker = null; return true; }
    if (this.box) { this.box = null; return true; }
    const R = POTION_RECTS;
    if (inRect(R.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    if (inRect(R.mix, vx, vy)) { this._mix(); return true; }
    if (inRect(R.recipes, vx, vy)) { this._recipes(); return true; }

    if (inRect(INGREDIENT_SCROLL_UP, vx, vy)) { this._scrollIngredients(-1); return true; }
    if (inRect(INGREDIENT_SCROLL_DOWN, vx, vy)) { this._scrollIngredients(1); return true; }
    const cs = slotAt(R.cauldronList, CAULDRON_BUTTONS, vx, vy);
    if (cs !== null) { this._removeFromCauldron(cs); return true; }
    const is = slotAt(R.ingredientsList, INGREDIENT_BUTTONS, vx, vy, INGREDIENT_LIST_X);
    if (is !== null) {
      // "Convert scroller index to item based scroll index"
      // (ItemListScroller.cs:419): the row index times the width
      const item = this.ingredients()[this.scroll * INGREDIENT_COLS + is];
      if (item) this._addToCauldron(item);
      return true;
    }
    return inRect([0, 0, 320, 200], vx, vy);
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    this._font = font;
    const m = nativeMetrics(canvas);
    // ParentPanel is ScreenDimColor and the NATIVE panel carries its
    // own 60% black under the texture (:101-105) - both, in that order.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    if (this.picker && listPickerArtLoaded()) { this.picker.draw(renderer, canvas, font); return; }

    const R = POTION_RECTS;
    this.ingredients()
      .slice(this.scroll * INGREDIENT_COLS, this.scroll * INGREDIENT_COLS + INGREDIENT_BUTTONS.length)
      .forEach((it, i) => {
        const [bx, by] = INGREDIENT_BUTTONS[i];
        const rect = [R.ingredientsList[0] + INGREDIENT_LIST_X + bx, R.ingredientsList[1] + by, 28, 28];
        this._icon(renderer, m, it, rect, 0);
        drawStackLabel(renderer, font, m, it, rect, 0);
      });
    this.cauldron.slice(0, CAULDRON_CAPACITY).forEach((it, i) => {
      const [bx, by] = CAULDRON_BUTTONS[i];
      this._icon(renderer, m, it, [R.cauldronList[0] + bx, R.cauldronList[1] + by, 28, 28], 0);
    });
    shadowText(renderer, font, this.nameLabel, m, ...POTION_LABELS.name);
    shadowText(renderer, font, String(this.hooks.gold?.() ?? 0), m, ...POTION_LABELS.gold);
    if (this.box) {
      this._boxLayout = layoutMessageBox(font, this.box.rows, []);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}

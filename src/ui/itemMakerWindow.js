// M4 - THE ITEM MAKER: DaggerfallItemMakerWindow (MIT, Daggerfall
// Workshop / Hazelnut, Gavin Clayton) on real ARENA2 art, over M3's
// arithmetic and the M4 catalogue's tables.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is ITEM00I0.IMG, which ships a FULL 320x200 - a
//   whole-screen background like the potion maker's, so every rect
//   here is screen-absolute and there is no centring to compute.
//   It is read with alternateAlphaIndex 12 (:110), the same cut the
//   inventory sheets take.
// - FOUR TAB BUTTONS down the right at x175, 81x9 each, on a 9-pixel
//   stride from y6 (:29-32). Their SELECTED state is a subrect of
//   ITEM01I0.IMG - an 81x36 strip that is four 81x9 gold tabs stacked
//   in the tab order (:290-294), so the selected tab is drawn from
//   row index * 9.
// - TWO ENCHANTMENT LISTS: powers (10,58,75,120) and side effects
//   (108,58,75,120), with the buttons that fill them directly under
//   at (8,183,77,10) and (106,183,77,10).
// - the ENCHANT button (200,115,43,15), the selected-item well
//   (196,68,50,37) and the exit (202,176,39,22).
// - the item scroller (253,49,60,148), and a rename strip across the
//   top (4,2,157,7).
// - FOUR LABELS (:296-302): the item name at (52,3), the player's
//   gold at (71,15), the gold cost at (64,27) and the "used/available"
//   enchantment cost at (98,39).
//
// A LIST ROW is EnchantmentListPicker.EnchantmentPanel: 75 wide (71
// once the list scrolls), and SEVEN tall with no secondary name or
// TWELVE with one - the primary name at y2 and the secondary indented
// two spaces at y8. Rows stack from y2 on a five-pixel gap. A FORCED
// row - one a bound soul dragged in - is drawn in DFU's own
// DaggerfallForcedEnchantmentTextColor (186,207,125) rather than the
// default, which is the only way the window tells you that a row is
// not yours to have chosen.
//
// The laws are systems/enchanting.js's and systems/enchantmentCatalogue.js's
// - every refusal, both sums, the exclusions, the picker filters and
// the forced sets. This file is the panel, the hit rects and the box.
//
// DEPARTURE: the item list rides the port's SHARED item scroller
// (ui/itemScroller.js), whose cells are 9 across on a 38-pixel stride
// where this window's own itemListPanelRect is 10 on a 37 - so icons
// sit one pixel left and rows one pixel taller than DFU's. One
// scroller, corrected once, is worth the pixel (Ledger A).
//
// NOT A GAP, recorded. The icon picker was a phantom: DFU's
// selected-item well opens nothing. SelectedItemButton_OnMouseClick
// (DaggerfallItemMakerWindow.cs:605-611) nulls selectedItem, clears
// both enchantment lists and Refresh()es - which _deselect (:243) does
// exactly - and the only SpellIconPickerWindow consumers in the tree
// are DaggerfallSpellBookWindow.cs:149 and DaggerfallSpellMakerWindow
// .cs:194. The RENAME half is a widget departure, not a hole: DFU pops
// a DaggerfallInputMessageBox (NameItemButon_OnMouseClick, :799-811)
// where this window types into an inline strip, recorded as Ledger A
// row TB1 (by NAME - the line number this used to cite rotted) - and
// the F171 NIT row's one real defect, the character
// cap, is fixed (MAX_ITEM_NAME = 31, the TextBox default at
// TextBox.cs:26, which RenameItem itself never narrows).

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import { ListPickerWindow, listPickerArtLoaded, listPickerSmallFont, preloadListPickerSmallFont, SMALL_FONT_PICKER_ROWS } from './listPicker.js';
import {
  makeIconDrawer, drawStackLabel, scrollerHit, applyScroll, safeScrollIndex,
  playScrollerArrowClick,
  LIST_SLOTS, CELL_X,
} from './itemScroller.js';
import { typedChar } from './input.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  enchantDecision, applyEnchantments, enchantmentCostLabel, totalGoldCost,
  totalEnchantmentCost, itemEnchantmentPower, openPickerDecision,
} from '../systems/enchanting.js';
import {
  enchantmentName, enchantmentParams, enchantmentParamName, primaryPickerList, primaryPick,
  pickEnchantment, removeEnchantment, PARAM_NONE,
} from '../systems/enchantmentCatalogue.js';
import { deductGold, totalGoldAmount } from '../systems/court.js';
import { splitStack } from '../systems/inventory.js';

/** DaggerfallInventoryWindow.TabPages, in the order the four buttons
 *  sit in (:29-32). */
export const TAB_PAGES = Object.freeze(['WeaponsAndArmor', 'MagicItems', 'ClothingAndMisc', 'Ingredients']);

/** ITEM00I0 is a full-screen background (:107), so these are
 *  screen-absolute. */
export const ITEM_RECTS = Object.freeze({
  weaponsAndArmor: [175, 6, 81, 9],
  magicItems: [175, 15, 81, 9],
  clothingAndMisc: [175, 24, 81, 9],
  ingredients: [175, 33, 81, 9],
  powersButton: [8, 183, 77, 10],
  sideEffectsButton: [106, 183, 77, 10],
  exit: [202, 176, 39, 22],
  enchant: [200, 115, 43, 15],
  selectedItem: [196, 68, 50, 37],
  nameItem: [4, 2, 157, 7],
  powersList: [10, 58, 75, 120],
  sideEffectsList: [108, 58, 75, 120],
  itemList: [253, 49, 60, 148],
});
/** The four live labels (:296-302). */
export const ITEM_LABELS = Object.freeze({
  itemName: [52, 3], availableGold: [71, 15], goldCost: [64, 27], enchantmentCost: [98, 39],
});

/** EnchantmentPanel's own metrics (:299-305, :22-26). */
export const ROW_W = 75, ROW_W_SCROLLED = 71;
export const ROW_H_PLAIN = 7, ROW_H_SECONDARY = 12;
export const ROW_GAP = 5, ROW_START_Y = 2, ROWS_VISIBLE = 7;
/** AUDIT 26 F171. DFU's rename runs through DaggerfallInputMessageBox,
 *  whose TextBox takes the default `maxCharacters = 31`
 *  (TextBox.cs:26), and RenameItem imposes no cap of its own
 *  (DaggerfallUnityItem.cs:1348-1354). This lane's inline rename strip
 *  - itself a recorded widget departure - stopped at 26, so names of
 *  27 to 31 characters that are legal in DFU could not be typed. */
export const MAX_ITEM_NAME = 31;
/** F170: EnchantmentListPicker's scroller (:22-26, :180-247) - it
 *  APPEARS past seven rows (ShowScroller), is 4 wide at the panel's
 *  right edge, and the wheel steps 8 pixels; no arrow buttons exist
 *  on this control in DFU. */
export const ENCH_SCROLLER_W = 4;
export const ENCH_SCROLLER_STEP = 8;
/** Scroller.TotalUnits: RefreshPanelLayout sums Size.y + panelSpacing
 *  per row (:220-232). */
export const enchContentH = (list) => rowLayout(list).reduce((a, r) => Math.max(a, r.y + r.h + ROW_GAP), 0);
export const SECONDARY_INDENT = '  ';
/** DaggerfallUI.DaggerfallForcedEnchantmentTextColor (:64). */
export const FORCED_TEXT_COLOR = [186 / 255, 207 / 255, 125 / 255, 1];

/** AddFilteredItem (:415-443). An item already selected, an already
 *  ENCHANTED item and a potion are out of every tab; then the tab
 *  decides. MagicItems lists NOTHING - DFU disabled it because
 *  classic lists nothing there either, and the empty tab is kept
 *  (Ledger B). */
export function itemMakerFilter(item, tabPage, selected = null) {
  if (!item || item === selected) return false;
  if (item.enchantments?.length || item.group === 'UselessItems2') return false;
  if (item.potionRecipe !== undefined && item.potionRecipe !== null) return false;
  const isWeaponOrArmor = (item.group === 'Weapons' || item.group === 'Armor')
    && !(item.group === 'Weapons' && item.name === 'Arrow');
  switch (tabPage) {
    case 'WeaponsAndArmor': return isWeaponOrArmor;
    case 'MagicItems': return false;
    case 'Ingredients': return item.group === 'Gems';
    case 'ClothingAndMisc':
      return item.group === 'MensClothing' || item.group === 'WomensClothing'
        || item.group === 'Jewellery';
    default: return false;
  }
}

let _art = null;
let _tabs = null;
export async function preloadItemMakerArt(deps) {
  if (_art) return;
  try {
    _art = await loadImg(deps, 'ITEM00I0.IMG');
    _tabs = await loadImg(deps, 'ITEM01I0.IMG');
    // AUDIT 58: both enchantment pickers are SmallFont, 12 rows
    // (:372, :376), so the FNT has to be warm before one opens.
    await preloadListPickerSmallFont(deps);
  } catch { console.warn('[itemmaker] ITEM00I0 unavailable; the item maker stays closed'); }
}
export const itemMakerArtLoaded = () => !!_art && !!_tabs;
export function _setItemMakerArtForTests(art, tabs) { _art = art; _tabs = tabs; }

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** Where each row of a list sits and how tall it is - the layout
 *  RefreshPanelLayout walks (:222-231). A row is twelve tall when its
 *  effect has a parameter name to print underneath and seven when it
 *  does not, so the stride is not uniform. */
export function rowLayout(list, scrollPx = 0) {
  const out = [];
  // F170: Scroller_OnScroll starts panelPos.y at the vertical origin
  // MINUS ScrollIndex (:284); an unscrolled call is unchanged.
  let y = ROW_START_Y - scrollPx;
  for (const e of list) {
    const h = enchantmentParams(e.type).length > 0 ? ROW_H_SECONDARY : ROW_H_PLAIN;
    out.push({ y, h, entry: e });
    y += h + ROW_GAP;
  }
  return out;
}

/**
 * hooks:
 *   packItems()  -> the player's items (the tabs filter them)
 *   player       the purse seam deductGold takes
 *   icons, entity
 *   onClose()
 */
export class ItemMakerWindow {
  /** F170: MouseScrollUp/Down (:180-196) - wheel only, gated on
   *  ShowScroller (> 7 rows), stepping scrollerStep (8) against the
   *  SetScrollIndex clamp; routed to whichever list the cursor is
   *  over, since DFU's wheel fires per component. */
  hover(vx, vy, e = null) { this._mouse = [vx, vy]; this.picker?.hover(vx, vy, e); }   // ROAD-A7: the picker's own hover
  release() { this.picker?.release(); }   // ROAD-E E1: and the picker's own release, the edge that drops the thumb latch
  wheel(dir) {
    if (!dir) return;
    const [vx, vy] = this._mouse;
    for (const [rect, list, scrollKey] of [[ITEM_RECTS.powersList, this.powers, 'powersScroll'],
      [ITEM_RECTS.sideEffectsList, this.sideEffects, 'sideEffectsScroll']]) {
      if (!inRect(rect, vx, vy)) continue;
      if (list.length <= ROWS_VISIBLE) return;   // ShowScroller (:182, :191)
      const max = Math.max(0, enchContentH(list) - rect[3]);
      this[scrollKey] = Math.max(0, Math.min(max, this[scrollKey] + Math.sign(dir) * ENCH_SCROLLER_STEP));
      return;
    }
  }

  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.tab = TAB_PAGES[0];
    this.selected = null;
    this.powers = [];
    this.sideEffects = [];
    this.selectingPowers = true;
    this.scroll = 0;
    // F170: one ScrollIndex per EnchantmentListPicker instance.
    this.powersScroll = 0;
    this.sideEffectsScroll = 0;
    this._mouse = [0, 0];
    this.itemName = '';
    this.renaming = false;
    this.box = null;
    this.picker = null;
    this._pickerType = null;
    this._icon = makeIconDrawer(hooks.icons, () => hooks.entity);
  }

  _close() { this.done = true; this.hooks.onClose?.(); }
  _say(text) { this.box = { rows: [{ text, center: true }] }; }

  items() {
    return (this.hooks.packItems?.() ?? []).filter((it) => itemMakerFilter(it, this.tab, this.selected));
  }

  /** PlayerEntity.GetGoldAmount (:1313-1316) - coins PLUS letters of
   *  credit - which is what both the label (:193) and the enchant
   *  check (:734) read; the deduction seam spends the letters too. */
  gold() { return totalGoldAmount(this.hooks.player ?? this.hooks.entity ?? {}); }

  _selectTab(tab) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.tab = tab;
    this.scroll = 0;
  }

  /** SelectedItemButton_OnMouseClick (:605-611) - deselecting an item
   *  DISCARDS both lists. The work is not kept against the next one. */
  _deselect() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.selected = null;
    this.powers = [];
    this.sideEffects = [];
    this.itemName = '';
  }

  _selectItem(item) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.selected = item;
    this.powers = [];
    this.sideEffects = [];
    this.itemName = item?.name ?? '';
  }

  /** PowersButton / SideEffectsButton (:614-656) - the guard, then
   *  the primary list. An EMPTY list still opens the picker in DFU;
   *  it just has nothing in it. */
  _openPicker(selectingPowers) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const d = openPickerDecision(selectingPowers, {
      item: this.selected, powers: this.powers, sideEffects: this.sideEffects,
    });
    if (d.kind === 'refuse') { this._say(d.text); return; }
    this.selectingPowers = selectingPowers;
    const types = primaryPickerList(selectingPowers, {
      item: this.selected, powers: this.powers, sideEffects: this.sideEffects,
    });
    this._pickerType = null;
    this.picker = new ListPickerWindow({
      items: types.map(enchantmentName),
      onPick: (i) => { this.picker = null; this._pickPrimary(types[i]); },
      onCancel: () => { this.picker = null; },
      // AUDIT 58: DaggerfallItemMakerWindow.cs::372 builds this picker
      // with `(uiManager, this, DaggerfallUI.SmallFont, 12)` - the
      // font and the row count travel together (12 x (5+1) = the
      // 72px listBox).
      font: listPickerSmallFont(), rowsDisplayed: SMALL_FONT_PICKER_ROWS,
    });
  }

  /** EnchantmentPrimaryPicker_OnUseSelectedItem (:820-866). */
  _pickPrimary(type) {
    const pick = primaryPick(type, {
      powers: this.powers, sideEffects: this.sideEffects, selectingPowers: this.selectingPowers,
    });
    if (!pick) return;
    if (pick.kind === 'add') { this._add(pick.settings); return; }
    this._pickerType = type;
    const options = pick.options;
    this.picker = new ListPickerWindow({
      items: options.map((o) => o.label),
      onPick: (i) => { this.picker = null; this._pickSecondary(type, options[i].param); },
      onCancel: () => { this.picker = null; },
      // AUDIT 58: DaggerfallItemMakerWindow.cs::376 builds this picker
      // with `(uiManager, this, DaggerfallUI.SmallFont, 12)` - the
      // font and the row count travel together (12 x (5+1) = the
      // 72px listBox).
      font: listPickerSmallFont(), rowsDisplayed: SMALL_FONT_PICKER_ROWS,
    });
  }

  /** EnchantmentSecondaryPicker_OnUseSelectedItem (:869-906) - where
   *  a bound soul's forced children arrive, and the only place the
   *  window can refuse for room. */
  _pickSecondary(type, param) {
    const result = pickEnchantment(type, param, { powers: this.powers, sideEffects: this.sideEffects });
    if (!result) return;
    if (result.kind === 'noRoom') { this._say(result.text); return; }
    this._add(result.settings);
    this.powers.push(...result.powers);
    this.sideEffects.push(...result.sideEffects);
  }

  _add(settings) {
    if (!settings) return;
    (this.selectingPowers ? this.powers : this.sideEffects).push(settings);
  }

  /** EnchantmentList_OnRemoveItem (:914-918) - removing a row takes
   *  its forced children out of BOTH lists with it. */
  _removeRow(entry) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.powers = removeEnchantment(this.powers, entry.key);
    this.sideEffects = removeEnchantment(this.sideEffects, entry.key);
  }

  /** EnchantButton_OnMouseClick (:705-770). */
  _enchant() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const d = enchantDecision(this.selected, this.powers, this.sideEffects, { gold: this.gold() });
    if (d.kind !== 'enchant') { this._say(d.text); return; }
    // DeductGoldAmount, which spends letters of credit as well as the
    // purse - the one deduction seam (court.js).
    deductGold(this.hooks.player ?? this.hooks.entity, d.goldCost);
    // "Only enchant one item from stack" (:751-754): SplitStack(
    // selectedItem, 1) - the enchantment lands on a split-off single,
    // and the rest of the stack stays plain.
    if ((this.selected.stackCount ?? 1) > 1) {
      const items = (this.hooks.player ?? this.hooks.entity)?.items ?? [];
      this.selected = splitStack(items, this.selected, 1) ?? this.selected;
    }
    // SetEnchantments(combined, GameManager.Instance.PlayerEntity)
    // (:760) - the owner is passed, so the created payloads run and
    // the item comes OFF the paperdoll (DaggerfallUnityItem.cs:1338).
    applyEnchantments(this.selected, [...this.powers, ...this.sideEffects],
      { owner: this.hooks.player ?? this.hooks.entity });
    if (this.itemName) this.selected.name = this.itemName;
    audio.playOneShot(SOUND.MakeItem, 1);
    this._say(d.text);
    this.selected = null;
    this.powers = [];
    this.sideEffects = [];
    this.itemName = '';
    this.hooks.onEnchanted?.();
  }

  labels() {
    if (!this.selected) {
      return { itemName: '', availableGold: String(this.gold()), goldCost: '', enchantmentCost: '' };
    }
    return {
      itemName: this.itemName,
      availableGold: String(this.gold()),
      goldCost: String(totalGoldCost(this.powers)),
      enchantmentCost: enchantmentCostLabel(
        totalEnchantmentCost(this.powers, this.sideEffects), itemEnchantmentPower(this.selected)),
    };
  }

  input(code, e = null) {
    if (this.picker) { this.picker.input(code); if (this.picker?.done) this.picker = null; return; }
    if (this.box) { this.box = null; return; }
    if (this.renaming) {
      if (code === 'Enter' || code === 'Escape') { this.renaming = false; return; }
      if (code === 'backspace' || code === 'Backspace') { this.itemName = this.itemName.slice(0, -1); return; }
      const ch = typedChar(code, e);
      if (ch && this.itemName.length < MAX_ITEM_NAME) this.itemName += ch;
      return;
    }
    if (code === 'Escape' || code === 'KeyE') this._close();
  }

  click(vx, vy) {
    if (this.picker) { this.picker.click(vx, vy, this._font); if (this.picker?.done) this.picker = null; return true; }
    if (this.box) { this.box = null; return true; }
    if (this.renaming) { this.renaming = false; return true; }

    if (inRect(ITEM_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    for (let i = 0; i < TAB_PAGES.length; i++) {
      const key = ['weaponsAndArmor', 'magicItems', 'clothingAndMisc', 'ingredients'][i];
      if (inRect(ITEM_RECTS[key], vx, vy)) { this._selectTab(TAB_PAGES[i]); return true; }
    }
    if (inRect(ITEM_RECTS.powersButton, vx, vy)) { this._openPicker(true); return true; }
    if (inRect(ITEM_RECTS.sideEffectsButton, vx, vy)) { this._openPicker(false); return true; }
    if (inRect(ITEM_RECTS.enchant, vx, vy)) { this._enchant(); return true; }
    if (inRect(ITEM_RECTS.selectedItem, vx, vy)) { if (this.selected) this._deselect(); return true; }
    if (inRect(ITEM_RECTS.nameItem, vx, vy)) { if (this.selected) this.renaming = true; return true; }

    for (const [rect, list, scrollKey] of [[ITEM_RECTS.powersList, this.powers, 'powersScroll'],
      [ITEM_RECTS.sideEffectsList, this.sideEffects, 'sideEffectsScroll']]) {
      if (!inRect(rect, vx, vy)) continue;
      // F170: the hit maps through the live scroll - the C# panels
      // carry their click at their SCROLLED position (:262-276).
      const hit = rowLayout(list, this[scrollKey]).find((r) => vy >= rect[1] + r.y && vy < rect[1] + r.y + r.h);
      // "Can only click to remove parent panels, child panels are
      // removed by clicking on parent" (EnchantmentListPicker.cs:
      // 266-271) - a forced child is not the player's to take off.
      if (hit && (hit.entry.parentEnchantment ?? 0) === 0) this._removeRow(hit.entry);
      return true;
    }

    const list = this.items();
    // AUDIT 39 F126: the rail pages off the live thumb, so the hit
    // needs the scroll index and the list length.
    const hit = scrollerHit(ITEM_RECTS.itemList, vx, vy, safeScrollIndex(this.scroll, list.length), list.length);
    if (hit) {
      if (hit.kind === 'slot') {
        const item = list[safeScrollIndex(this.scroll, list.length) + hit.slot];
        if (item) this._selectItem(item);
      } else { playScrollerArrowClick(hit.kind); this.scroll = applyScroll(this.scroll, hit.kind, list.length); }   // ROAD-A7: the two arrows click
      return true;
    }
    return true;   // the background is the whole screen
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    this._font = font;
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);

    // the SELECTED tab is a row of the 81x36 gold strip, drawn back
    // over the base at the tab's own rect (:290-294)
    const tabIndex = TAB_PAGES.indexOf(this.tab);
    if (tabIndex >= 0 && _tabs) {
      const [tx, ty, tw, th] = ITEM_RECTS[['weaponsAndArmor', 'magicItems', 'clothingAndMisc', 'ingredients'][tabIndex]];
      renderer.drawScreenQuad(_tabs.tex,
        { x: m.ox + tx * m.s, y: m.oy + ty * m.s, w: tw * m.s, h: th * m.s },
        { u0: 0, v0: (tabIndex * 9) / _tabs.h, u1: 1, v1: (tabIndex * 9 + 9) / _tabs.h });
    }

    const L = this.labels();
    for (const [key, [x, y]] of Object.entries(ITEM_LABELS)) {
      shadowText(renderer, font, L[key] + (key === 'itemName' && this.renaming ? '_' : ''), m, x, y);
    }

    // the two enchantment lists
    for (const [rect, list, scrollKey] of [[ITEM_RECTS.powersList, this.powers, 'powersScroll'],
      [ITEM_RECTS.sideEffectsList, this.sideEffects, 'sideEffectsScroll']]) {
      const scrolled = list.length > ROWS_VISIBLE;
      // F170: rows lay out through the live scroll and hide only when
      // WHOLLY outside, either end (panel.Enabled = Overlaps, :289).
      for (const row of rowLayout(list, this[scrollKey])) {
        if (row.y + row.h <= 0 || row.y >= rect[3]) continue;
        // a FORCED row is the one thing this window colours
        // differently - it is how you can tell a row you did not pick
        const opts = row.entry.parentEnchantment !== 0 ? { color: FORCED_TEXT_COLOR } : undefined;
        shadowText(renderer, font, enchantmentName(row.entry.type), m, rect[0], rect[1] + row.y + 2, opts);
        // SecondaryDisplayName (EnchantmentListPicker.cs:333-334) -
        // the label for the row's PARAM VALUE, matched through the
        // mint order: a CastWhen* param is a sparse classic SPELL id,
        // not an index into the dense label list.
        const names = enchantmentParams(row.entry.type);
        if (names.length > 0 && row.entry.param !== PARAM_NONE) {
          shadowText(renderer, font, SECONDARY_INDENT + enchantmentParamName(row.entry.type, row.entry.param),
            m, rect[0], rect[1] + row.y + 8, opts);
        }
      }
      if (scrolled) {
        // the slim scroller, 4 wide at the right edge (:208-214), its
        // thumb the VerticalScrollBar formula the spellbook draws.
        const total = enchContentH(list);
        const th = Math.max(4, rect[3] * (rect[3] / total));
        const ty = (this[scrollKey] * (rect[3] - th)) / Math.max(1, total - rect[3]);
        drawRect(renderer, m, rect[0] + rect[2] - ENCH_SCROLLER_W, rect[1] + ty, ENCH_SCROLLER_W, th, [0.53, 0.53, 0.53, 1]);
      }
    }

    // the item list, through the shared scroller
    const items = this.items();
    const start = safeScrollIndex(this.scroll, items.length);
    for (let i = 0; i < LIST_SLOTS; i++) {
      const it = items[start + i];
      if (!it) continue;
      this._icon(renderer, m, it, ITEM_RECTS.itemList, i);
      drawStackLabel(renderer, font, m, it, ITEM_RECTS.itemList, i);
    }
    // ROAD-A7 DELIBERATELY STOPS SHORT HERE. The two windows that draw
    // the red/green arrows and the art thumb ride ItemListScroller's
    // DEFAULT rect - itemListPanelRect (9,0,50,152), which is what
    // itemScroller.js's constants are. This window hands the scroller
    // its OWN rect (DaggerfallItemMakerWindow.cs:44,
    // itemListPanelRect = (10,0,50,148)), so the down arrow sits at
    // 132 rather than 136 and the bar is 113 tall rather than 117.
    // Drawing the shared art here would put both four pixels wrong.
    // The scroller needs its rect parameterised before this window can
    // have them; the ARROW CLICK sound above is rect-independent and
    // lands today.
    // ...and the WELL, which shows the item being worked on. The
    // shared drawer places an icon by (rect, slot), and the well is
    // one 50x37 cell - close enough to the scroller's 50x38 that slot
    // 0 of a rect shifted back by CELL_X lands it right.
    if (this.selected) {
      const [sx, sy] = ITEM_RECTS.selectedItem;
      this._icon(renderer, m, this.selected, [sx - CELL_X, sy], 0);
    }

    if (this.picker && listPickerArtLoaded()) { this.picker.draw(renderer, canvas, font); return; }
    if (this.box) {
      this._boxLayout = layoutMessageBox(font, this.box.rows, []);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}

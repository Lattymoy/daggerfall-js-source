// U8d: the NATIVE INVENTORY WINDOW - the classic inventory screen on
// real art (DFU DaggerfallInventoryWindow, MIT Daggerfall Workshop).
// INVE00I0.IMG base; INVE01I0.IMG is the SELECTED-state sheet - DFU
// cuts each active tab/action button as a subtexture of it at the
// button's own rect (ImageReader.GetSubTexture), so the highlight is
// a drawImgSub of the gold sheet back over the base.
//
// Verbatim geometry (DaggerfallInventoryWindow.cs #region UI Rects):
//   tabs: weaponsAndArmor (0,0,92,10), magicItems (93,0,69,10),
//   clothingAndMisc (163,0,91,10), ingredients (255,0,65,10);
//   action buttons (31x14 at x226): wagon y14, info y36, equip y58,
//   remove y80, use y103, gold y126; local list (163,48,59,152),
//   remote list (261,48,59,152) - the shared ItemListScroller;
//   local/remote target icons (165/263,12,55,34); exit (222,178,39,22);
//   paperdoll at (49,13).
//
// THE TAB FILTER (AddLocalItem verbatim): WeaponsAndArmor = groups
// Weapons/Armor, not enchanted; MagicItems = enchanted or the
// Spellbook template (MiscItems.Spellbook = 132); Ingredients =
// isIngredient, not enchanted; ClothingAndMisc = everything else.
// isIngredient: DFU ItemTemplates.txt marks EXACTLY template indices
// 0..77 (verified over the shipping data - 78 rows, contiguous).
//
// THE MODE MACHINE (verbatim shape): selectedActionMode defaults to
// Equip (OnPush; Remove only for loot targets - pends); mode buttons
// select + highlight. THIS SLICE the window is the VIEW + INFO half:
// Info mode click pops an interim item panel (name/weight/value -
// DFU's full 1016 info text pends), Equip/Use local clicks and the
// whole remote (dropped-pile) side are FLAGGED loud - equipping
// needs the paperdoll arc, dropping needs the ground loot flat.
// Wagon/gold: consumed no-ops (no wagon owned; letter-of-credit
// pends).

import { loadImg, nativeMetrics, drawImg, drawImgSub, SCREEN_DIM, shadowText } from './nativePanel.js';
import { LIST_SLOTS, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel } from './itemScroller.js';
import { templateByIndex, itemBaseValue } from '../systems/itemTemplates.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from './text.js';

export const INV_RECTS = Object.freeze({
  tabWeapons: [0, 0, 92, 10],        // weaponsAndArmorRect
  tabMagic: [93, 0, 69, 10],         // magicItemsRect
  tabClothing: [163, 0, 91, 10],     // clothingAndMiscRect
  tabIngredients: [255, 0, 65, 10],  // ingredientsRect
  wagon: [226, 14, 31, 14],
  info: [226, 36, 31, 14],
  equip: [226, 58, 31, 14],
  remove: [226, 80, 31, 14],
  use: [226, 103, 31, 14],
  gold: [226, 126, 31, 14],
  localList: [163, 48, 59, 152],
  remoteList: [261, 48, 59, 152],
  exit: [222, 178, 39, 22],
});
export const TABS = ['weapons', 'magic', 'clothing', 'ingredients'];
const TAB_RECT = { weapons: INV_RECTS.tabWeapons, magic: INV_RECTS.tabMagic, clothing: INV_RECTS.tabClothing, ingredients: INV_RECTS.tabIngredients };
const MODES = ['wagon', 'info', 'equip', 'remove', 'use', 'gold'];
const SPELLBOOK_TEMPLATE = 132;    // MiscItems.Spellbook

// DFU ItemTemplates.txt isIngredient - exactly indices 0..77
export const isIngredientTemplate = (i) => i >= 0 && i <= 77;

/** AddLocalItem verbatim, over the session's {group, templateIndex,
 *  enchanted} item shape. */
export function filterByTab(items, tab) {
  return items.filter((it) => {
    const wa = it.group === 'Weapons' || it.group === 'Armor';
    const ench = !!it.enchanted;
    if (tab === 'weapons') return wa && !ench;
    if (tab === 'magic') return ench || it.templateIndex === SPELLBOOK_TEMPLATE;
    if (tab === 'ingredients') return isIngredientTemplate(it.templateIndex) && !ench;
    return !wa && !ench && !isIngredientTemplate(it.templateIndex) && it.templateIndex !== SPELLBOOK_TEMPLATE;
  });
}

let _art = null;
export async function preloadInventoryArt(deps) {
  if (_art) return;
  try {
    const [base, gold, fnt4] = await Promise.all([
      loadImg(deps, 'INVE00I0.IMG'), loadImg(deps, 'INVE01I0.IMG'),
      deps.fetchBytes('FONT0004.FNT'),
    ]);
    _art = { base, gold, font4: makeFont(deps.renderer, new FntFile().load(fnt4), 'FONT0004') };
  } catch { console.warn('[inventory] INVE00I0/INVE01I0 unavailable; F6 stays dark'); }
}
export const inventoryArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** hooks = { items() -> the player bag, icons: { getTexture,
 *  uploadRecord, textures }, onClose() }. */
export class NativeInventoryWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;    // raw codes through the overlay seam
    this.tab = 'weapons';          // SelectTabPage(TabPages.WeaponsAndArmor) on setup
    this.mode = 'equip';           // selectedActionMode default
    this.scroll = 0;
    this.popup = null;             // the interim info panel lines
    this._icon = makeIconDrawer(hooks.icons);
  }

  _filtered() { return filterByTab(this.hooks.items(), this.tab); }
  _setTab(t) { this.tab = t; this.scroll = 0; }
  _close() { this.done = true; this.hooks.onClose?.(); }

  _pick(slot) {
    const it = this._filtered()[this.scroll + slot];
    if (!it) return;
    if (this.mode === 'info') {
      // INTERIM info panel: name/weight/value (DFU's 1016 info text
      // + paperdoll cutout pend)
      const t = templateByIndex(it.templateIndex);
      this.popup = [
        it.name ?? t?.name ?? '?',
        `Weight: ${(t?.weight ?? 0) * (it.stackCount ?? 1)} kg`,
        `Value: ${itemBaseValue(it)} gold`,
      ];
    }
    // equip/use/remove: FLAGGED - the paperdoll/use/drop arcs pend
  }

  input(code) {
    if (this.popup) { this.popup = null; return; }
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE' || code === 'F6') { this._close(); return; }
    if (code === 'KeyN') this.scroll = applyScroll(this.scroll, 'down', this._filtered().length);
    if (code === 'KeyP') this.scroll = applyScroll(this.scroll, 'up', this._filtered().length);
    if (code === 'KeyI') this.mode = 'info';
    const t = /^Digit([1-4])$/.exec(code);   // digits jump tabs (interim accelerator)
    if (t) this._setTab(TABS[Number(t[1]) - 1]);
  }

  click(vx, vy) {
    if (this.popup) { this.popup = null; return true; }
    const R = INV_RECTS;
    if (inRect(R.exit, vx, vy)) { this._close(); return true; }
    for (const t of TABS) if (inRect(TAB_RECT[t], vx, vy)) { this._setTab(t); return true; }
    for (const mode of MODES) {
      if (!inRect(R[mode], vx, vy)) continue;
      // wagon/gold: consumed no-ops (flagged); the rest select
      if (mode !== 'wagon' && mode !== 'gold') this.mode = mode;
      return true;
    }
    const hit = scrollerHit(R.localList, vx, vy);
    if (hit) {
      if (hit.kind === 'slot') this._pick(hit.slot);
      else this.scroll = applyScroll(this.scroll, hit.kind, this._filtered().length);
      return true;
    }
    // the remote (dropped-pile) scroller: consumed, FLAGGED to the
    // ground-loot slice
    return !!scrollerHit(R.remoteList, vx, vy);
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    drawImg(renderer, _art.base, m, 0, 0);
    // the selected tab + action mode: the INVE01I0 subrect back over
    // the base (DFU's GetSubTexture highlight)
    const tr = TAB_RECT[this.tab];
    drawImgSub(renderer, _art.gold, m, tr[0], tr[1], tr[2], tr[3]);
    const mr = INV_RECTS[this.mode];
    drawImgSub(renderer, _art.gold, m, mr[0], mr[1], mr[2], mr[3]);
    // the filtered bag through the shared scroller
    const items = this._filtered();
    items.slice(this.scroll, this.scroll + LIST_SLOTS).forEach((it, s) => {
      this._icon(renderer, m, it, INV_RECTS.localList, s);
      drawStackLabel(renderer, _art.font4, m, it, INV_RECTS.localList, s);
    });
    // the interim info popup (paperdoll region is free space)
    if (this.popup) {
      renderer.drawScreenQuad(null, { x: m.ox + 49 * m.s, y: m.oy + 60 * m.s, w: 110 * m.s, h: (this.popup.length * 11 + 8) * m.s }, undefined, [0, 0, 0, 0.85]);
      this.popup.forEach((l, i) => shadowText(renderer, font, l, m, 53, 64 + i * 11));
    }
  }
}

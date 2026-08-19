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
// Equip when managing inventory, REMOVE when a loot target opened
// the window ("so player does not accidentially equip when picking
// up" - the OnPush law); mode buttons select + highlight.
//
// U8e - THE REMOTE SIDE: the remote scroller is DFU's droppedItems
// by default (OnPush: "Set dropped items as default target"), or a
// LOOT TARGET's items when a ground pile opened the window. Remove-
// mode local clicks transfer into the remote pile
// (LocalItemListScroller_OnItemClick); remote clicks in Equip or
// Remove mode transfer back to the player, and in EQUIP mode the
// taken item is equipped too (RemoteItemListScroller_OnItemClick's
// TransferItem equip:true - shipped in U8g). Closing with
// session-dropped items hands them to hooks.onDrop - the host mints
// the ground pile flat. Info mode pops an interim item panel
// (name/weight/value - DFU's 1016 info text PENDS).
// AUDIT 17e F39 / RETIRING A FLAG DELETES THE SENTENCE: this header
// still said Equip and equip-after-transfer were FLAGGED after U8g
// shipped both. STILL OPEN here: Use mode (UseItem / the
// IsLightSource branch of an Equip click), and wagon/gold as
// consumed no-ops (no wagon owned; letter-of-credit pends).

import { loadImg, nativeMetrics, drawImg, drawImgSub, SCREEN_DIM, shadowText } from './nativePanel.js';
import { addItem, isEnchanted } from '../systems/inventory.js';
import { isEquipped, equipItem, unequipSlot, isForbiddenEquip, FORBIDDEN_EQUIPMENT_TEXT_ID } from '../systems/equip.js';   // S23
import { drawPaperDoll, refreshPaperDoll, slotAtPaperDoll, ARMOR_LABEL_POS } from './paperDoll.js';
import { LIST_SLOTS, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel, safeScrollIndex } from './itemScroller.js';
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
  paperDoll: [49, 13, 110, 184],   // paperDoll.Position + its 110x184 panel
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

/** AUDIT 17e F36 - RefreshArmourValues' displayed number
 *  (PaperDoll.cs:159-173): (100 - armorValue) / 5, plus armorMod
 *  (DecreasedArmorValueModifier - IncreasedArmorValueModifier), which
 *  is 0 until those effect channels exist (FLAGGED). Exported so the
 *  law can be pinned against LIVE armor values - the old pin was
 *  `Math.trunc((100-55)/5) === 9`, pure literal arithmetic that
 *  touched no port code at all. */
export const armorLabelValue = (av, armorMod = 0) => Math.trunc((100 - av) / 5) + armorMod;

/** AddLocalItem verbatim, over the session's {group, templateIndex,
 *  enchanted} item shape. */
export function filterByTab(items, tab) {
  return items.filter((it) => {
    if (isEquipped(it)) return false;   // FilterLocalItems: worn items leave the list
    const wa = it.group === 'Weapons' || it.group === 'Armor';
    const ench = isEnchanted(it);   // AUDIT 17e C2: DERIVED, not a stored flag
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
 *  uploadRecord, textures }, loot?: { items() -> the ground pile }
 *  (a loot target opened the window), onDrop?(items) (the session's
 *  dropped pile needs a world flat), onClose() }. */
export class NativeInventoryWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;    // raw codes through the overlay seam
    this.tab = 'weapons';          // SelectTabPage(TabPages.WeaponsAndArmor) on setup
    // selectedActionMode: Remove for loot targets, Equip otherwise
    this.mode = hooks.loot ? 'remove' : 'equip';
    this.scroll = 0;
    this.remoteScroll = 0;
    this.dropped = [];             // droppedItems (the default remote target)
    this.popup = null;             // the interim info panel lines
    this._icon = makeIconDrawer(hooks.icons, () => hooks.entity);   // AUDIT 17f: icons follow the wearer's morphology
    if (hooks.entity) refreshPaperDoll(hooks.entity);   // U8g: the doll composes fresh on open
  }

  // AUDIT 17e F15: a list can shrink under a scrolled index (equip,
  // drop, sell). DFU's ItemListScroller delays the snap - it only
  // corrects when the index is PAST the end, leaving a partly filled
  // column otherwise - so a plain clamp would over-correct.
  _clampScroll() {
    this.scroll = safeScrollIndex(this.scroll, this._filtered().length);
    this.remoteScroll = safeScrollIndex(this.remoteScroll, this._remote().length);
  }
  _filtered() { return filterByTab(this.hooks.items(), this.tab); }
  _remote() { return this.hooks.loot ? this.hooks.loot.items() : this.dropped; }
  _setTab(t) { this.tab = t; this.scroll = 0; }
  _close() {
    this.done = true;
    if (this.dropped.length) this.hooks.onDrop?.(this.dropped);   // the world pile mints on close (OnPop)
    this.hooks.onClose?.();
  }

  /** S23: the career equip gate (DaggerfallInventoryWindow :1343-1381).
   *  DFU refuses the equip and pops TEXT.RSC 1068 on a
   *  ClickAnywhereToClose message box. FLAGGED loud, exactly as the
   *  info panel below is: this surface has no TEXT.RSC source and no
   *  parchment frame of its own yet, so the refusal shows on the same
   *  interim popup. The REFUSAL ITSELF is verbatim - the item does not
   *  equip, which is the half that changes play. */
  _refuseForbidden(it) {
    if (!isForbiddenEquip(this.hooks.entity?.career, it)) return false;
    this.popup = [`You cannot use this item.`, `(TEXT.RSC ${FORBIDDEN_EQUIPMENT_TEXT_ID})`];
    return true;
  }

  _info(it) {
    // INTERIM info panel: name/weight/value (DFU's 1016 info text
    // + paperdoll cutout pend)
    const t = templateByIndex(it.templateIndex);
    this.popup = [
      it.name ?? t?.name ?? '?',
      `Weight: ${(t?.weight ?? 0) * (it.stackCount ?? 1)} kg`,
      `Value: ${itemBaseValue(it)} gold`,
    ];
  }

  _pick(slot) {
    this._clampScroll();
    const it = this._filtered()[this.scroll + slot];
    if (!it) return;
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'remove') {
      // LocalItemListScroller_OnItemClick Remove: transfer to the
      // remote items (whole stacks - the split popup pends)
      const bag = this.hooks.items();
      bag.splice(bag.indexOf(it), 1);
      addItem(this._remote(), it);
      return;
    }
    if (this.mode === 'equip' && this.hooks.entity) {
      // U8g: EquipItem live (the unequipped swap-outs stay in the
      // bag and reappear in the lists; light-source Use pends)
      if (this._refuseForbidden(it)) return;   // S23
      if (equipItem(this.hooks.entity, it) !== null) refreshPaperDoll(this.hooks.entity);
      return;
    }
    // use: FLAGGED - the use arc pends
  }

  _pickRemote(slot) {
    this._clampScroll();
    const remote = this._remote();
    const it = remote[this.remoteScroll + slot];
    if (!it) return;
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'remove' || this.mode === 'equip') {
      // RemoteItemListScroller_OnItemClick: both modes transfer to
      // the player; Equip mode also EQUIPS the taken item (verbatim
      // TransferItem(..., equip: true))
      remote.splice(remote.indexOf(it), 1);
      addItem(this.hooks.items(), it);
      if (this.mode === 'equip' && this.hooks.entity) {
        // S23: the taken item still has to pass the career gate
        if (this._refuseForbidden(it)) return;
        if (equipItem(this.hooks.entity, it) !== null) refreshPaperDoll(this.hooks.entity);
      }
    }
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
    // U8g: the paperdoll takes clicks - Remove unequips the topmost
    // item layer under the point (GetEquipIndex), Info pops its panel
    if (inRect(R.paperDoll, vx, vy) && this.hooks.entity) {
      const slot = slotAtPaperDoll(Math.floor(vx - R.paperDoll[0]), Math.floor(vy - R.paperDoll[1]));
      const table = this.hooks.entity.equip?.slots;
      if (slot != null && table?.[slot]) {
        // AUDIT 17e F8 - PaperDoll_OnMouseClick verbatim
        // (DaggerfallInventoryWindow.cs:1932-1952): EQUIP (and Select)
        // unequips, Info reads, Use uses. REMOVE has no branch at all
        // - a Remove-mode doll click is inert. U8g had this inverted.
        if (this.mode === 'equip') { unequipSlot(this.hooks.entity, slot); refreshPaperDoll(this.hooks.entity); }
        else if (this.mode === 'info') this._info(table[slot]);
        // 'use' -> UseItem FLAGGED with the light-source/use arc
      }
      return true;
    }
    const hit = scrollerHit(R.localList, vx, vy);
    if (hit) {
      if (hit.kind === 'slot') this._pick(hit.slot);
      else this.scroll = applyScroll(this.scroll, hit.kind, this._filtered().length);
      return true;
    }
    const rhit = scrollerHit(R.remoteList, vx, vy);
    if (rhit) {
      if (rhit.kind === 'slot') this._pickRemote(rhit.slot);
      else this.remoteScroll = applyScroll(this.remoteScroll, rhit.kind, this._remote().length);
      return true;
    }
    return false;
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
    // U8f/U8g: the paperdoll at (49,13); U8h: the armor value labels
    // (RefreshArmourValues - (100 - av)/5 per body part; the
    // drained/increased colors pend their effect channels)
    drawPaperDoll(renderer, m, this.hooks.entity ?? { }, 49, 13);
    const av = this.hooks.entity?.armorValues;
    if (av) ARMOR_LABEL_POS.forEach(([lx, ly], i) =>
      shadowText(renderer, font, String(armorLabelValue(av[i] ?? 100)), m, 49 + lx, 13 + ly));
    this._clampScroll();
    // both sides through the shared scroller: the filtered bag
    // locally, the pile (loot target or session drops) remotely
    for (const [rect, scroll, items] of [
      [INV_RECTS.localList, this.scroll, this._filtered()],
      [INV_RECTS.remoteList, this.remoteScroll, this._remote()],
    ]) {
      items.slice(scroll, scroll + LIST_SLOTS).forEach((it, s) => {
        this._icon(renderer, m, it, rect, s);
        drawStackLabel(renderer, _art.font4, m, it, rect, s);
      });
    }
    // the interim info popup (paperdoll region is free space)
    if (this.popup) {
      renderer.drawScreenQuad(null, { x: m.ox + 49 * m.s, y: m.oy + 60 * m.s, w: 110 * m.s, h: (this.popup.length * 11 + 8) * m.s }, undefined, [0, 0, 0, 0.85]);
      this.popup.forEach((l, i) => shadowText(renderer, font, l, m, 53, 64 + i * 11));
    }
  }
}

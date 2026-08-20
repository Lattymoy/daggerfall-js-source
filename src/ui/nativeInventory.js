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
// shipped both. STILL OPEN here: the WAGON (no wagon owned;
// letter-of-credit pends). Use mode, the real 1016 info text and the
// IsLightSource equip branch shipped at U25 (AUDIT 23 trimmed the
// stale list).

import { loadImg, nativeMetrics, drawImg, drawImgSub, drawImgCrop, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';   // U25
import { useItem, isLightSource } from '../systems/useItem.js';   // U25
import { itemInfoRows, INFO_TEXT } from '../systems/itemInfo.js';   // U25
import { goldAmount, deductGold } from '../systems/court.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { addItem, isEnchanted, goldStack } from '../systems/inventory.js';
import { isEquipped, equipItem, unequipSlot, isForbiddenEquip, FORBIDDEN_EQUIPMENT_TEXT_ID } from '../systems/equip.js';   // S23
import { drawPaperDoll, refreshPaperDoll, slotAtPaperDoll, ARMOR_LABEL_POS } from './paperDoll.js';
import { LIST_SLOTS, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel, safeScrollIndex } from './itemScroller.js';
import { templateByIndex, itemBaseValue } from '../systems/itemTemplates.js';
import { FntFile } from '../formats/fntFile.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { makeFont, drawText } from './text.js';
import { typedChar } from './input.js';   // U26: one reader for both hosts' key routing

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
  // U25: itemInfoPanelRect + the ITEM00I0 cutout it draws
  // (DaggerfallInventoryWindow.cs :55-56, :1036-1037).
  itemInfoPanel: [223, 145, 37, 32],
  infoCutout: [196, 68, 50, 37],
});
/** itemInfoPanelLabel's own layout (:444-455): Position (2,0), middle
 *  aligned in the panel, TextScale 0.43 and ExtraLeading 3. */
export const INFO_LABEL = Object.freeze({ x: 2, scale: 0.43, extraLeading: 3, maxWidth: 37 });
/** TEXT.RSC 1016 - the "Item powers" box DFU chains behind an
 *  enchanted item's info (:1614). */
export const INFO_TEXT_POWERS = 1016;
/** The arms whose destination window the port has not built. Named,
 *  so a Use click SAYS something rather than eating itself. */
export const USE_PENDING = Object.freeze({
  book: 'You cannot read that yet.',
  potion: 'You drink the potion.',
  map: 'You study the map.',
  questItem: 'Nothing happens.',
  enchanted: 'Nothing happens.',
});

/** TEXT.RSC 25 - the drop-gold prompt (:1272). */
export const GOLD_TO_DROP_TEXT_ID = 25;
/** Internal_Strings "noWagon" (:1237). */
export const NO_WAGON_TEXT = "You don't own a wagon.";
/** The other half of the wagon button - ShowWagon swaps the REMOTE
 *  list to the cart's own 750kg collection. FLAGGED: Transportation
 *  items do not exist in the port, so nothing can reach it yet. */
export const WAGON_PENDING_TEXT = 'Your wagon is not available yet.';
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
    const [base, gold, info, fnt4] = await Promise.all([
      loadImg(deps, 'INVE00I0.IMG'), loadImg(deps, 'INVE01I0.IMG'),
      loadImg(deps, 'ITEM00I0.IMG'),   // U25: the item info panel's backing art
      deps.fetchBytes('FONT0004.FNT'),
    ]);
    _art = { base, gold, info, font4: makeFont(deps.renderer, new FntFile().load(fnt4), 'FONT0004') };
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
    this.boxes = [];               // U25: the message-box queue (info, use, wagon, gold)
    this.infoItem = null;
    this.goldEntry = null;         // the drop-gold field's live text
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
  _setTab(t) { audio.playOneShot(SOUND.ButtonClick, 1); this.tab = t; this.scroll = 0; }   // the four tab buttons (:1209-1227)
  _close() {
    audio.playOneShot(SOUND.ButtonClick, 1);   // exit, mouse and key alike (:2082, :2090)
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
    // U25: the record itself now draws, on the U11 parchment, through
    // the host's TEXT.RSC reader - the interim two lines are gone.
    this.boxes = [{
      rows: this.hooks.rows?.(FORBIDDEN_EQUIPMENT_TEXT_ID)
        ?? [{ text: 'You cannot use this item.', center: true }],
    }];
    return true;
  }

  /** ShowInfoPopup (:1594-1620). The REAL info text at last: DFU picks
   *  one of thirteen TEXT.RSC records by group and template and fills
   *  its macros from the item, so a sword, a shield, an arrow and a
   *  soul trap all read differently. An ENCHANTED item gets a second
   *  box, TEXT.RSC 1016 ("Item powers"), which DFU chains behind the
   *  first - here it simply queues behind it.
   *
   *  U8e's three invented lines (name / weight / value) are gone. */
  _info(it) {
    audio.playOneShot(SOUND.ButtonClick, 1);   // ShowInfoPopup (:1596)
    const rows = this.hooks.rows;
    if (!rows) {
      // No TEXT.RSC in this host: say so rather than inventing lines.
      this.boxes = [{ rows: [{ text: 'No item description available.', center: true }] }];
      return;
    }
    this.boxes = [{ rows: itemInfoRows(it, rows) }];
    if (isEnchanted(it)) this.boxes.push({ rows: rows(INFO_TEXT_POWERS) ?? [] });
    this.infoItem = it;
  }

  /** UseItem's outcome as a box, or nothing when the arm is silent
   *  (NextVariant on a garment repaints the doll and says nothing). */
  _useResult(r) {
    if (r.text) this.boxes = [{ rows: [{ text: r.text, center: true }] }];
    else if (r.textId && this.hooks.rows) this.boxes = [{ rows: this.hooks.rows(r.textId) ?? [] }];
    else if (r.pending) this.boxes = [{ rows: [{ text: USE_PENDING[r.kind] ?? 'Nothing happens.', center: true }] }];
    if (r.kind === 'variant' && this.hooks.entity) refreshPaperDoll(this.hooks.entity);
    // AUDIT 22 F9: `enchanted` is now a RIDER on the arm's own result
    // rather than a kind that replaced it, so the message the arm
    // produced still shows and the payload still closes the window.
    if (r.enchanted && !r.text && !r.textId) {
      this.boxes = [{ rows: [{ text: USE_PENDING.enchanted, center: true }] }];
    }
    if (r.closesWindow) this._close();
  }

  /** WagonButton_OnMouseClick (:1234-1243). The port has no
   *  Transportation items and no wagon inventory, so the first arm is
   *  the only reachable one - and it is the RIGHT answer, not a
   *  placeholder: a player who owns no cart is told so. The
   *  wagon-as-a-remote-target half lands with Transportation. */
  _wagon() {
    const hasCart = (this.hooks.items() ?? []).some((it) => it.group === 'Transportation');
    this.boxes = [{ rows: [{ text: hasCart ? WAGON_PENDING_TEXT : NO_WAGON_TEXT, center: true }] }];
  }

  /** GoldButton_OnMouseClick + DropGoldPopup_OnGotUserInput
   *  (:1269-1300). A numeric field of 8, opening on "0", and the
   *  entry is REFUSED OUTRIGHT below 1 or above what the player
   *  carries - not clamped. The gold lands in the remote pile, which
   *  is the ground when nothing else opened the window. */
  _dropGold() {
    this.goldEntry = '0';
    this.boxes = [{
      rows: this.hooks.rows?.(GOLD_TO_DROP_TEXT_ID) ?? [{ text: 'How much gold?', center: true }],
      field: true,
      onInput: (text) => {
        const carried = goldAmount(this.hooks.entity ?? { items: this.hooks.items() });
        const n = /^[0-9]+$/.test(text) ? Number(text) : 0;
        if (n < 1 || n > carried) return;
        deductGold(this.hooks.entity ?? { items: this.hooks.items() }, n);
        addItem(this._remote(), goldStack(n));
      },
    }];
  }

  _use(it, collection) {
    this._useResult(useItem(it, collection, {
      entity: this.hooks.entity,
      // AUDIT 22 F4: the oil arm looks for its lantern in the LOCAL
      // pack whatever list the click came from, so the bag travels
      // separately from the list the item lives in.
      localItems: this.hooks.items(),
      spellCount: () => this.hooks.entity?.spells?.length ?? 0,
      isEnchanted,
      nowMinute: this.hooks.nowMinute?.() ?? 0,
    }));
  }

  _pick(slot) {
    this._clampScroll();
    const it = this._filtered()[this.scroll + slot];
    if (!it) return;
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'remove') {
      // LocalItemListScroller_OnItemClick Remove: transfer to the
      // remote items (whole stacks - the split popup pends)
      audio.playOneShot(SOUND.ButtonClick, 1);   // DoTransferItem (:1583)
      const bag = this.hooks.items();
      bag.splice(bag.indexOf(it), 1);
      addItem(this._remote(), it);
      return;
    }
    if (this.mode === 'use') { this._use(it, this.hooks.items()); return; }   // U25
    if (this.mode === 'equip' && this.hooks.entity) {
      // U25 / LocalItemListScroller_OnItemClick (:1976-1985): an EQUIP
      // click on a LIGHT SOURCE does not equip it, it USES it - which
      // is how a torch is lit in play. The port flagged this from U8g
      // until the use arc existed.
      // AUDIT 22 F6: DFU calls UseItem(item) here with NO collection
      // (:1980), so an equip-click cannot consume anything - only the
      // light arm, which needs none, is reachable this way.
      if (isLightSource(it)) { this._use(it, null); return; }
      // U8g: EquipItem live (the unequipped swap-outs stay in the
      // bag and reappear in the lists)
      if (this._refuseForbidden(it)) return;   // S23
      if (equipItem(this.hooks.entity, it) !== null) refreshPaperDoll(this.hooks.entity);
      return;
    }
  }

  _pickRemote(slot) {
    this._clampScroll();
    const remote = this._remote();
    const it = remote[this.remoteScroll + slot];
    if (!it) return;
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'use') { this._use(it, remote); return; }   // U25 (:2048-2051)
    if (this.mode === 'remove' || this.mode === 'equip') {
      // RemoteItemListScroller_OnItemClick: both modes transfer to
      // the player; Equip mode also EQUIPS the taken item (verbatim
      // TransferItem(..., equip: true))
      // DoTransferItem: gold rides its own clink (:1569), everything
      // else the button click (:1583).
      audio.playOneShot(it.group === 'Currency' ? SOUND.GoldPieces : SOUND.ButtonClick, 1);
      remote.splice(remote.indexOf(it), 1);
      addItem(this.hooks.items(), it);
      if (this.mode === 'equip' && this.hooks.entity) {
        // S23: the taken item still has to pass the career gate
        if (this._refuseForbidden(it)) return;
        if (equipItem(this.hooks.entity, it) !== null) refreshPaperDoll(this.hooks.entity);
      }
    }
  }

  get topBox() { return this.boxes.length ? this.boxes[0] : null; }

  _dismissBox() { this.boxes.shift(); }

  input(code, e = null) {
    const box = this.topBox;
    if (box) {
      if (box.field) {
        if (code === 'Escape') { this._dismissBox(); return; }
        if (code === 'Enter') { const v = this.goldEntry ?? ''; this._dismissBox(); box.onInput?.(v); return; }
        if (code === 'backspace' || code === 'Backspace') { this.goldEntry = (this.goldEntry ?? '').slice(0, -1); return; }
        // U26: the two hosts route keys differently - raw codes here,
        // 'char:x' actions in the dungeon - so the field reads both
        // through the one helper that knows the difference.
        const ch = typedChar(code, e);
        if (ch && /^[0-9]$/.test(ch) && (this.goldEntry ?? '').length < 8) this.goldEntry = (this.goldEntry ?? '') + ch;
        return;
      }
      this._dismissBox();
      return;
    }
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE' || code === 'F6') { this._close(); return; }
    if (code === 'KeyN') this.scroll = applyScroll(this.scroll, 'down', this._filtered().length);
    if (code === 'KeyP') this.scroll = applyScroll(this.scroll, 'up', this._filtered().length);
    if (code === 'KeyI') this.mode = 'info';
    const t = /^Digit([1-4])$/.exec(code);   // digits jump tabs (interim accelerator)
    if (t) this._setTab(TABS[Number(t[1]) - 1]);
  }

  click(vx, vy) {
    if (this.topBox) {
      if (!this.topBox.field) this._dismissBox();   // a field takes keys, not clicks
      return true;
    }
    const R = INV_RECTS;
    if (inRect(R.exit, vx, vy)) { this._close(); return true; }
    for (const t of TABS) if (inRect(TAB_RECT[t], vx, vy)) { this._setTab(t); return true; }
    for (const mode of MODES) {
      if (!inRect(R[mode], vx, vy)) continue;
      audio.playOneShot(SOUND.ButtonClick, 1);   // every action button clicks (:1242-1272)
      // U25: WAGON and GOLD are not mode buttons at all - they ACT
      // (:1234-1285), which is why selecting them as a mode was
      // always wrong.
      if (mode === 'wagon') { this._wagon(); return true; }
      if (mode === 'gold') { this._dropGold(); return true; }
      this.mode = mode;
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
        // U25: Use uses. DFU passes NO COLLECTION from the doll
        // (UseItem(item) with collection defaulting to null), so the
        // arms that consume an item - a potion, a drug, a map, the
        // oil - deliberately do nothing to a WORN one.
        else if (this.mode === 'use') this._use(table[slot], null);
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
    // AUDIT 19 F2: OPAQUE BLACK, not a dim. DaggerfallBaseWindow's
    // constructor sets `parentPanel.BackgroundColor = Color.black`
    // (DaggerfallBaseWindow.cs:40) - ScreenDimColor is used only by the
    // handful of windows that explicitly override it, and this is not one.
    // Drawing a 50% dim here left the letterbox showing the world at half
    // brightness around the panel, which is the SAME defect U21 fixed for
    // the menu, U21b for chargen and U22 for the splash. Fourth, fifth and
    // sixth instance; one shared helper now.
    drawMenuBackdrop(renderer, canvas);
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
    // U25: the ITEM INFO PANEL - a 50x37 cutout of ITEM00I0 drawn into
    // the 37x32 rect at (223,145), with the last-inspected item's rows
    // at itemInfoPanelLabel's own TextScale 0.43 and ExtraLeading 3.
    // DFU fills it on HOVER; the port has no mouse-move surface on
    // this window, so it shows the item the last Info click read.
    // FLAGGED: the hover fill is the mouse-move seam's, not this
    // slice's.
    if (_art.info) {
      drawImgCrop(renderer, _art.info, m, INV_RECTS.infoCutout, INV_RECTS.itemInfoPanel);
      if (this.infoItem && this.hooks.rows) {
        const [px, py, , ph] = INV_RECTS.itemInfoPanel;
        const rows = itemInfoRows(this.infoItem, this.hooks.rows);
        const lineH = (font.fnt?.fixedHeight ?? 6) * INFO_LABEL.scale + INFO_LABEL.extraLeading;
        const top = py + Math.max(0, (ph - rows.length * lineH) / 2);   // VerticalAlignment.Middle
        rows.forEach((r, i) => drawText(renderer, font, r.text,
          m.ox + (px + INFO_LABEL.x) * m.s, m.oy + (top + i * lineH) * m.s,
          m.s * INFO_LABEL.scale, DEFAULT_TEXT_COLOR));
      }
    }
    // the message-box queue (info, use, the equip refusal, wagon, gold)
    const box = this.topBox;
    if (box) {
      const rows = box.field ? [...box.rows, ` > ${this.goldEntry ?? ''}_`] : box.rows;
      const laid = layoutMessageBox(font, rows, [],
        box.field ? { sizingRows: [...box.rows, ` > ${'0'.repeat(8)}_`] } : {});
      drawMessageBox(renderer, m, font, laid);
    }
  }
}

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
//   paperdoll at (49,13); the twelve ACCESSORY buttons in two columns
//   (x=1 and x=24), 21x20, first pair at y=11, rowOffset 31.
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
// shipped both. The WAGON shipped at the W-slice (ShowWagon as the
// computed remote target, the 750kg gates, the dungeon exit rule);
// STILL OPEN here: letter-of-credit. Use mode, the real 1016 info
// text and the IsLightSource equip branch shipped at U25 (AUDIT 23
// trimmed the stale list).

import { loadImg, nativeMetrics, drawImg, drawImgSub, drawImgCrop, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { getBool } from '../systems/settings.js';   // UI4: EnableInventoryInfoPanel
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';   // U25
import { useItem, isLightSource } from '../systems/useItem.js';   // U25
import { itemInfoRows, questLetterName, INFO_TEXT } from '../systems/itemInfo.js';   // U25
import { goldAmount, deductGold } from '../systems/court.js';
import { enchantArmorDisplayMod } from '../systems/enchantments.js';   // AUDIT 26 F122: PaperDoll.cs:161's armorMod
import { drawScreenDimBackdrop } from './chargenArt.js';
import { addItem, isEnchanted, goldStack, canHoldAmount, totalWeight, GOLD_PIECE_WEIGHT_KG } from '../systems/inventory.js';   // L-slice (items-9)
// U56: TransferItem's ladder - the guards, their order, and the split.
// AUDIT 26's quest arm is a rung of it and travelled with it, so the
// window no longer carries the settings or quest-resource imports it
// needed to run that rung itself.
import { planStore, planTake, applyTransfer, planDropGold } from '../systems/itemTransfer.js';
// U57: which list is the remote one, and what opening and closing
// this window decide.
import {
  openState, remoteTarget, planWagonToggle, closeSession,
} from '../systems/inventorySession.js';
import { isEquipped, equipItem, unequipSlot, isForbiddenEquip, isBrokenItem, EQUIP_SLOTS, FORBIDDEN_EQUIPMENT_TEXT_ID, ITEM_BROKEN_TEXT_ID, equipDelaySnapshot, billEquipDelayOnClose } from '../systems/equip.js';   // S23; FX1 (F128): the per-visit swap-pause clock
import { drawPaperDoll, refreshPaperDoll, slotAtPaperDoll, ARMOR_LABEL_POS } from './paperDoll.js';
import { LIST_SLOTS, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel, safeScrollIndex } from './itemScroller.js';
import { templateByIndex, itemBaseValue, inventoryItemImage } from '../systems/itemTemplates.js';
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
/** SetupAccessoryElements (DaggerfallInventoryWindow.cs:523-576) -
 *  THE TWELVE ACCESSORY BUTTONS, in equip-slot order Amulet0..Crystal1.
 *  Two columns, col0 x=1 and col1 x=24, buttonSize 21x20, the first
 *  pair at y=11 and each pair dropping by rowOffset 31.
 *
 *  These are the ONLY door to a worn amulet, bracelet, ring, bracer,
 *  mark or crystal. FilterLocalItems drops every equipped item from
 *  all four tabs (filterByTab's first line), and PaperDollRenderer
 *  blits Jewellery only above slot 11 (IsEquippedToBody), so nothing
 *  the doll hit-tests can reach slots 0..11. Without these buttons a
 *  ring, once worn, could never be unequipped, sold or dropped. */
export const ACCESSORY_SLOT_MIN = EQUIP_SLOTS.Amulet0;
export const ACCESSORY_SLOT_MAX = EQUIP_SLOTS.Crystal1;
export const ACCESSORY_RECTS = Object.freeze(
  Array.from({ length: ACCESSORY_SLOT_MAX - ACCESSORY_SLOT_MIN + 1 },
    (_, i) => Object.freeze([i % 2 === 0 ? 1 : 24, 11 + 31 * Math.floor(i / 2), 21, 20])));
/** accessoryButtonMarginSize = 1 (:152) - the icon panel is a
 *  ScaleToFit child of the button's INTERIOR, MaxAutoScale 1. */
export const ACCESSORY_MARGIN = 1;

/** itemInfoPanelLabel's own layout (:444-455): Position (2,0), middle
 *  aligned in the panel, TextScale 0.43 and ExtraLeading 3. */
export const INFO_LABEL = Object.freeze({ x: 2, scale: 0.43, extraLeading: 3, maxWidth: 37 });
/** TEXT.RSC 1016 - the "Item powers" box DFU chains behind an
 *  enchanted item's info (:1614). */
export const INFO_TEXT_POWERS = 1016;

/** U47: UpdateItemInfoPanelGold (:2249-2258). The GOLD button's hover
 *  fills the panel with two GENERATED lines rather than a TEXT.RSC
 *  record - Internal_Strings `goldAmount` and `goldWeight`, verbatim.
 *
 *  THE FORMAT IS CONDITIONAL: `weight.ToString(weight % 1 == 0 ?
 *  "F0" : "F2")`, so a whole number of kilograms shows none of the
 *  decimals and anything else shows exactly two. At 0.0025 kg a coin,
 *  that is every multiple of 400 gold and nothing between. */
export const goldPanelRows = (gold, weightKg) => [
  { text: `${gold} gold pieces`, center: true },
  { text: `Weight: ${weightKg % 1 === 0 ? weightKg.toFixed(0) : weightKg.toFixed(2)} kg`, center: true },
];
/** The arms whose destination window the port has not built. Named,
 *  so a Use click SAYS something rather than eating itself. */
export const USE_PENDING = Object.freeze({
  book: 'You cannot read that yet.',
  potion: 'You drink the potion.',
  map: 'You study the map.',
  questItem: 'Nothing happens.',
  enchanted: 'Nothing happens.',
  spellbook: 'You cannot open your spellbook here.',
});

/** TEXT.RSC 25 - the drop-gold prompt (:1272). */
export const GOLD_TO_DROP_TEXT_ID = 25;
// W-slice: the wagon goes live. U56: the strings the TRANSFER LADDER
// owns live with it now (systems/itemTransfer.js) and are re-exported
// here, because a caller reaching for the wagon's limit is usually
// already holding this window. AUDIT 26's `questTransferRefused` rides
// the same road: DaggerfallTradeWindow INHERITS TransferItem and
// imports it from here, and the ladder's home is where it belongs.
export {
  WAGON_KG_LIMIT, CANNOT_HOLD_TEXT, CANNOT_CARRY_TEXT, wagonFullGoldText,
  questTransferRefused,
} from '../systems/itemTransfer.js';
// U57: and the remote side's, for the same reason.
export {
  SMALL_CART_TEMPLATE, NO_WAGON_TEXT, EXIT_TOO_FAR_TEXT, WAGON_ACCESS_DISTANCE,
} from '../systems/inventorySession.js';
export const TABS = ['weapons', 'magic', 'clothing', 'ingredients'];
const TAB_RECT = { weapons: INV_RECTS.tabWeapons, magic: INV_RECTS.tabMagic, clothing: INV_RECTS.tabClothing, ingredients: INV_RECTS.tabIngredients };
const MODES = ['wagon', 'info', 'equip', 'remove', 'use', 'gold'];
const SPELLBOOK_TEMPLATE = 132;    // MiscItems.Spellbook

// DFU ItemTemplates.txt isIngredient - exactly indices 0..77
export const isIngredientTemplate = (i) => i >= 0 && i <= 77;

/** AUDIT 17e F36 - RefreshArmourValues' displayed number
 *  (PaperDoll.cs:159-173): (100 - armorValue) / 5, plus armorMod
 *  (DecreasedArmorValueModifier - IncreasedArmorValueModifier), fed
 *  by enchantArmorDisplayMod since AUDIT 26 F122 split the port's one
 *  additive armour channel into DFU's two min-sets. Exported so the
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

/** The accessory buttons' own icon panels (:556-563): ScaleToFit,
 *  MaxAutoScale 1, centered both axes inside the button's 1px margin.
 *  Separate from itemScroller's drawer because that one is welded to
 *  the 50x38 list cell - same warm/upload dance over the host texture
 *  pipeline, other geometry. */
function makeAccessoryIconDrawer(icons, identityOf = null) {
  const warm = new Set();
  const sizes = new Map();
  const drawer = (renderer, m, it, rect) => {
    const img = inventoryItemImage(it, identityOf?.() ?? undefined);
    if (!img || !img.archive) return false;
    const key = `${img.archive}_${img.record}`;
    if (!warm.has(key)) {
      warm.add(key);
      icons.getTexture(img.archive).then((tex) => {
        if (img.record < tex.recordCount) {
          icons.uploadRecord(img.archive, img.record);
          sizes.set(key, tex.getSize(img.record));
        }
      }).catch(() => {});
    }
    const glTex = icons.textures.get(key);
    const size = sizes.get(key);
    if (!glTex || !size?.width) return false;
    const [rx, ry, rw, rh] = rect;
    const fit = Math.min(1, (rw - ACCESSORY_MARGIN * 2) / size.width, (rh - ACCESSORY_MARGIN * 2) / size.height);
    const w = size.width * fit, h = size.height * fit;
    // the V-FLIPPED source rect: record textures store BOTTOM-UP rows
    renderer.drawScreenQuad(glTex, {
      x: m.ox + (rx + (rw - w) / 2) * m.s, y: m.oy + (ry + (rh - h) / 2) * m.s,
      w: w * m.s, h: h * m.s,
    }, { u0: 0, v0: 1, u1: 1, v1: 0 });
    return true;
  };
  drawer._warm = warm;       // test seams, as itemScroller's drawer has
  drawer._sizes = sizes;
  return drawer;
}

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
    // U57: selectedActionMode, CheckWagonAccess and SetChooseOne are
    // one read now (systems/inventorySession.js) - the enhanced pack
    // opens on the same three answers.
    const open = openState(hooks);
    this.mode = open.mode;
    this.scroll = 0;
    this.remoteScroll = 0;
    this.infoGold = false;   // U47: the gold button's hover fills the panel instead of an item
    this.dropped = [];             // droppedItems (the default remote target)
    this.boxes = [];               // U25: the message-box queue (info, use, wagon, gold)
    this.infoItem = null;
    this.goldEntry = null;         // the drop-gold field's live text
    // W-slice: the wagon as the remote target. usingWagon mirrors
    // ShowWagon's flag.
    this.usingWagon = open.usingWagon;
    // G6: SetChooseOne (:259-264). The reward list becomes the REMOTE
    // side and taking ONE item closes the window and fires the
    // callback (:1585-1591); the local Remove transfer is barred
    // while it is on (:1994). DFU clears the mode in OnPop, so
    // closing WITHOUT taking claims nothing.
    this.chooseOne = open.chooseOne;
    this.allowDungeonWagonAccess = open.allowDungeonWagonAccess;
    this._icon = makeIconDrawer(hooks.icons, () => hooks.entity);   // AUDIT 17f: icons follow the wearer's morphology
    this._accessoryIcon = makeAccessoryIconDrawer(hooks.icons, () => hooks.entity);   // the twelve worn slots
    if (hooks.entity) refreshPaperDoll(hooks.entity);   // U8g: the doll composes fresh on open
    // FX1 (F128): SetEquipDelayTime(false) on the window PUSH - the
    // hand snapshot the close bills against. The swap pause is billed
    // per inventory VISIT (once, and only for a hand that changed),
    // never per transition.
    this._handSnapshot = hooks.entity ? equipDelaySnapshot(hooks.entity) : null;
  }

  /** ShowWagon (:1047-1080): the flag flips and the remote scroll
   *  resets; the port's _remote() derives the target, so DFU's
   *  lastRemoteItems save/restore collapses into the computed read. */
  _showWagon(show) {
    this.usingWagon = show;
    this.remoteScroll = 0;   // remoteItemListScroller.ResetScroll()
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
  _remote() {
    return remoteTarget(this.hooks, {
      usingWagon: this.usingWagon,
      chooseOne: this.chooseOne,
      dropped: this.dropped,
      // A host with no wagon hook still needs somewhere for the
      // toggle to point, and it must be the SAME array every read.
      wagonLocal: (this._wagonLocal ??= []),
    });
  }
  _setTab(t) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.tab = t;
    this.scroll = 0;
    // U47: SelectTabPage CLEARS the info panel (:814-816). The panel
    // is otherwise STICKY - DFU never clears it on moving OFF an item,
    // only here and on a window push - so the last thing looked at
    // stays readable while the pointer travels.
    this._clearInfo();
  }   // the four tab buttons (:1209-1227)

  /** itemInfoPanelLabel.SetText(new Token[0]) - the panel's two clear
   *  sites, :663-664 (a window push) and :814-816 (a tab change). */
  _clearInfo() { this.infoItem = null; this.infoGold = false; }
  _close() {
    audio.playOneShot(SOUND.ButtonClick, 1);   // exit, mouse and key alike (:2082, :2090)
    this._closeSilently();
  }

  /** The close LAW without the exit click - the window ends, the
   *  session's dropped items mint their world pile (OnPop) and the
   *  loot container releases. AUDIT B-C1 split this out: handing off
   *  to another window (the book reader) replaces the port's single
   *  overlay slot WITHOUT closing this one, so those two effects were
   *  skipped and a session drop was silently LOST. */
  _closeSilently() {
    this.done = true;
    // FX1 (F128): SetEquipDelayTime(true) on the pop - the ONE bill
    // for this visit, then DFU's "Equipping %s" cue per changed hand
    // (:729-756; the string is Internal_Strings' equippingWeapon,
    // the name the item's TEMPLATE name). Runs on hand-offs too -
    // this is the B-C1 one-close-law seam.
    if (this._handSnapshot && this.hooks.entity) {
      const r = billEquipDelayOnClose(this.hooks.entity, this._handSnapshot);
      this._handSnapshot = null;   // a re-entrant close bills nothing
      for (const it of r.equipping) {
        this.hooks.say?.(`Equipping ${templateByIndex(it.templateIndex)?.name ?? it.name ?? ''}`);
      }
    }
    closeSession(this.hooks, this);   // the world pile mints on close (OnPop)
  }

  /** S23: the career equip gate (DaggerfallInventoryWindow :1343-1381).
   *  DFU refuses the equip and pops TEXT.RSC 1068 on a
   *  ClickAnywhereToClose message box. FLAGGED loud, exactly as the
   *  info panel below is: this surface has no TEXT.RSC source and no
   *  parchment frame of its own yet, so the refusal shows on the same
   *  interim popup. The REFUSAL ITSELF is verbatim - the item does not
   *  equip, which is the half that changes play. */
  _refuseForbidden(it) {
    // AUDIT 24 (wave 29): the BROKEN gate runs first
    // (DaggerfallInventoryWindow.cs:1330-1341) - before the
    // prohibition chain, and with its own TEXT.RSC record.
    if (isBrokenItem(it)) {
      this.boxes = [{
        rows: this.hooks.rows?.(ITEM_BROKEN_TEXT_ID)
          ?? [{ text: 'This item is broken.', center: true }],
      }];
      return true;
    }
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
    // %it is the item's LONG name (ItemHelper.ResolveItemLongName
    // :296-349), and its quest-letter arm is what makes one quest
    // letter tell apart from another. `getQuest` is the host's
    // QuestMachine.GetQuest; a host with none leaves the plain name.
    this.boxes = [{ rows: itemInfoRows(it, rows, { name: this._longName(it) }) }];
    if (isEnchanted(it)) this.boxes.push({ rows: rows(INFO_TEXT_POWERS) ?? [] });
    this.infoItem = it;
  }

  /** ResolveItemLongName over this window's quest seam. Null keeps
   *  expandItemInfo's own `item.name ?? template.name` fallback. */
  _longName(it) { return questLetterName(it, this.hooks.getQuest ?? null); }

  /** UseItem's outcome as a box, or nothing when the arm is silent
   *  (NextVariant on a garment repaints the doll and says nothing). */
  _useResult(r) {
    // DaggerfallUI.PopToHUD() + return (:1687-1688): a watched quest
    // item that is neither parchment nor clothing closes the window
    // stack so the quest system gets first shot at the click in the
    // game world. Nothing else on the ladder runs, and no box shows -
    // and PopToHUD is not the exit BUTTON, so it plays no click.
    if (r.popToHUD) { this._closeSilently(); return; }
    // B1: a book opens the reader through the host's hook; failure
    // (no id, missing/ruined file) shows the bookUnavailable box, and
    // a host with no hook keeps the pending text.
    if (r.kind === 'book') {
      if (this.hooks.openBook) {
        // AUDIT B-C1: DFU PUSHES the reader over the inventory (a
        // window stack); the port has ONE overlay slot, so the
        // inventory must run its close law here or its dropped pile
        // never mints. A failed open still reports on this window -
        // it is the live overlay until the reader actually shows.
        this.hooks.openBook(r.item, () => { this.boxes = [{ rows: [{ text: r.failText, center: true }] }]; });
        this._closeSilently();
      } else {
        this.boxes = [{ rows: [{ text: USE_PENDING.book, center: true }] }];
      }
      return;
    }
    // U42: USING the Spellbook ITEM opens the spellbook window
    // (DaggerfallInventoryWindow.cs:1748-1764 - PostMessage
    // dfuiOpenSpellBookWindow). The empty-book arm is the useItem law's
    // `noSpells` and lands in the textId branch below; this arm is the
    // OPEN. The port has ONE overlay slot, so the inventory runs its
    // close law FIRST (the same AUDIT B-C1 reason the book reader
    // does) and the host's hook then takes the slot - a host with no
    // hook keeps the window and says so.
    if (r.kind === 'spellbook') {
      if (this.hooks.openSpellbook) { this._closeSilently(); this.hooks.openSpellbook(); }
      else this.boxes = [{ rows: [{ text: USE_PENDING.spellbook, center: true }] }];
      return;
    }
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

  /** WagonButton_OnMouseClick (:1234-1243), whole at last: no cart ->
   *  the noWagon box; inside a dungeon away from the exit ->
   *  exitTooFar; else ShowWagon toggles the remote target. The click
   *  sound plays on every arm (:1242) - from the caller, once. */
  _wagon() {
    // AUDIT 24 ui: the sound is the click LOOP's (:1242, played once at
    // the end of WagonButton_OnMouseClick, whichever arm ran). This
    // method used to play a second one of its own, so the wagon button
    // fired two overlapping ButtonClicks where every other button
    // fires one.
    const plan = planWagonToggle(this.hooks, this);
    if (!plan.ok) { this._refuse(plan.refusal); return; }
    this._showWagon(plan.usingWagon);
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
        const player = this.hooks.entity ?? { items: this.hooks.items() };
        // U57: the range refusal and the wagon clamp are
        // systems/itemTransfer.js; the BOX is this window's.
        const plan = planDropGold(text, {
          carried: goldAmount(player),
          usingWagon: this.usingWagon,
          remote: this._remote(),
        });
        if (plan.notice) this.boxes = [{ rows: [{ text: plan.notice, center: true }] }];
        if (!plan.ok) return;
        deductGold(player, plan.amount);
        addItem(this._remote(), goldStack(plan.amount));
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
      // U44: RecordLocationFromMap's DiscoverRandomLocation. Only a
      // host with a region index can walk one, so this is a hook and
      // a host that has none leaves the map unread rather than
      // claiming a reveal it did not make.
      revealMap: this.hooks.revealMap ?? null,
      // U44: DrinkPotion. The host's cast engine owns it - assigning a
      // bundle needs the player's effect sinks.
      drinkPotion: this.hooks.drinkPotion ?? null,
      // QuestMachine.GetQuest (:1673) - the use-click block's reach.
      // The same seam the info panel's long name reads.
      getQuest: this.hooks.getQuest ?? null,
    }));
  }

  _pick(slot) {
    this._clampScroll();
    const it = this._filtered()[this.scroll + slot];
    if (!it) return;
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'remove') {
      // LocalItemListScroller_OnItemClick Remove's
      // `TransferItem(item, localItems, remoteItems, canHold, true)`
      // (DaggerfallInventoryWindow.cs:1999). U56: the guards, their
      // ORDER, and the split are systems/itemTransfer.js now - one
      // reading of TransferItem for every screen that transfers, and
      // AUDIT 26's QUEST ARM is one of those guards, sitting where DFU
      // puts it (:1480-1505, below the summoned one and above every
      // capacity gate). What is still this window's is what a CLASSIC
      // window does with the answer: a parchment box, or the click.
      const to = this._remote();
      const plan = planStore(it, {
        remote: to, usingWagon: this.usingWagon, chooseOne: this.chooseOne,
        getQuest: this.hooks.getQuest ?? null,
      });
      if (!plan.ok) { this._refuse(plan.refusal); return; }
      // AUDIT 26 F156: the map interception (:1471-1478) - the reveal
      // runs, the item is consumed, nothing lands in the destination.
      // The use arm IS RecordLocationFromMap here, no-seam pending law
      // included.
      if (plan.map) { this._use(it, this.hooks.items()); return; }
      audio.playOneShot(SOUND.ButtonClick, 1);   // DoTransferItem (:1583)
      applyTransfer(it, plan, this.hooks.items(), to, { entity: this.hooks.entity, fromLocal: true });   // F157: a lit torch leaving the pack goes out
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

  /** U56: the port's half of a refusal. The LADDER decides whether a
   *  transfer happens and whether the player is told; this decides
   *  what being told LOOKS like in the classic window, which is the
   *  one part the enhanced pack does differently. A refusal with no
   *  text - DFU's transport block, the choose-one pile - shows
   *  nothing, and none of them ever reaches the click sound. */
  _refuse(refusal) {
    if (refusal.text) this.boxes = [{ rows: [{ text: refusal.text, center: true }] }];
  }

  _pickRemote(slot) {
    this._clampScroll();
    const remote = this._remote();
    const it = remote[this.remoteScroll + slot];
    if (!it) return;
    // "Send click to quest system" (:2027-2037) - the FIRST act of
    // RemoteItemListScroller_OnItemClick, ahead of the action-mode
    // branch, so an Info or Use click on a quest item counts as well
    // as taking it. The ClickedItem trigger polls hasPlayerClicked.
    // Only the REMOTE list does this; LocalItemListScroller_OnItemClick
    // (:1974-2007) has no such call.
    if (it.questItem) this.hooks.getQuest?.(it.questUID)?.getItem?.(it.questSymbol)?.setPlayerClicked();
    if (this.mode === 'info') { this._info(it); return; }
    if (this.mode === 'use') { this._use(it, remote); return; }   // U25 (:2048-2051)
    if (this.mode === 'remove' || this.mode === 'equip') {
      // RemoteItemListScroller_OnItemClick: both modes transfer to
      // the player; Equip mode also EQUIPS the taken item (verbatim
      // TransferItem(..., equip: true)). U56: same ladder, other
      // direction - X11b's summoned guard and AUDIT 26's quest arm
      // included, which DFU has once and both callers run.
      const bag = this.hooks.items();
      const plan = planTake(it, {
        bag, entity: this.hooks.entity, mode: this.mode,
        chooseOne: this.chooseOne, usingWagon: this.usingWagon,
        getQuest: this.hooks.getQuest ?? null,
      });
      if (!plan.ok) { this._refuse(plan.refusal); return; }
      if (plan.map) { this._use(it, remote); return; }   // F156: either direction
      // DoTransferItem: gold rides its own clink (:1569), everything
      // else the button click (:1583) - after the carry gate, so a
      // refused transfer stays silent.
      audio.playOneShot(plan.sound === 'gold' ? SOUND.GoldPieces : SOUND.ButtonClick, 1);
      const taken = applyTransfer(it, plan, remote, bag);
      if (plan.equip && this.hooks.entity) {
        // S23: the taken item still has to pass the career gate
        if (this._refuseForbidden(taken)) return;
        if (equipItem(this.hooks.entity, taken) !== null) refreshPaperDoll(this.hooks.entity);
      }
      // G6 (:1585-1591): ONE is the whole gift. The window closes and
      // the callback runs - which is where the rank's flag is set, so
      // the claim and the taking are the same event.
      if (plan.claimsChoice) {
        const cb = this.chooseOne.onChoose;
        this.chooseOne = null;
        this._closeSilently();
        cb?.(taken);
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

  /** Which accessory BUTTON a point falls in, as an equip slot, or
   *  null. The rects live left of the paperdoll and below the tabs, so
   *  they overlap nothing else on the panel. */
  _accessoryAt(vx, vy) {
    for (let slot = ACCESSORY_SLOT_MIN; slot <= ACCESSORY_SLOT_MAX; slot++) {
      if (inRect(ACCESSORY_RECTS[slot - ACCESSORY_SLOT_MIN], vx, vy)) return slot;
    }
    return null;
  }

  /**
   * U47 - THE HOVER INFO PANEL. DFU fills the 37x32 panel from
   * OnMouseEnter on every list slot, the paperdoll and the gold
   * button; U37 built the mouse-move seam this waited on, and this is
   * the window growing its own `hover(vx, vy)` at last.
   *
   * THE PANEL IS STICKY. Nothing here clears it - DFU has no
   * OnMouseLeave arm at all, only the two SetText(empty) sites in
   * _clearInfo - so the last item looked at stays readable while the
   * pointer crosses dead space, which is what makes the panel usable
   * at 37 pixels wide.
   *
   * A BOX OWNS THE SCREEN. `topBox` is DFU's pushed window, which
   * clears the panel on the way in (:663-664) and takes the pointer
   * with it; hovering behind one changes nothing.
   */
  hover(vx, vy) {
    if (this.topBox) return;
    const R = INV_RECTS;
    // The GOLD button (:2243-2247). Not an item - two generated lines,
    // the amount and its weight.
    if (inRect(R.gold, vx, vy)) { this.infoItem = null; this.infoGold = true; return; }
    // The PAPERDOLL (:2185-2197). DFU reads EquipTable[index] and the
    // index comes from the doll's own item layers, so bare skin
    // resolves to no index and an empty slot cannot be reached - the
    // panel is left alone rather than cleared, exactly as the click
    // arm treats the same miss.
    if (inRect(R.paperDoll, vx, vy) && this.hooks.entity) {
      const slot = slotAtPaperDoll(Math.floor(vx - R.paperDoll[0]), Math.floor(vy - R.paperDoll[1]));
      const worn = slot != null ? this.hooks.entity.equip?.slots?.[slot] : null;
      if (worn) { this.infoItem = worn; this.infoGold = false; }
      return;
    }
    // The ACCESSORY BUTTONS (AccessoryItemsButton_OnMouseEnter,
    // :2210-2220). An EMPTY slot returns before the panel is touched,
    // exactly as the doll's own miss leaves it standing.
    const acc = this._accessoryAt(vx, vy);
    if (acc != null) {
      const worn = this.hooks.entity?.equip?.slots?.[acc];
      if (worn) { this.infoItem = worn; this.infoGold = false; }
      return;
    }
    // The two LISTS (:2224-2242). ItemListScroller raises OnHover for
    // a slot that HOLDS an item; the scroll arrows and the gaps raise
    // nothing, so they leave the panel as it stands.
    const local = scrollerHit(R.localList, vx, vy);
    if (local?.kind === 'slot') {
      const it = this._filtered()[this.scroll + local.slot];
      if (it) { this.infoItem = it; this.infoGold = false; }
      return;
    }
    const remote = scrollerHit(R.remoteList, vx, vy);
    if (remote?.kind === 'slot') {
      const it = this._remote()[this.remoteScroll + remote.slot];
      if (it) { this.infoItem = it; this.infoGold = false; }
    }
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
    // AccessoryItemsButton_OnMouseClick (:1883-1906). The click sound
    // plays FIRST, ahead of the empty-slot bail, in DFU's order - and
    // Info then plays ShowInfoPopup's own (:1596), which is two clicks
    // on that arm in classic too. Equip (and Select) UNEQUIPS: this is
    // the only reach a worn ring has, the doll's mask cannot see it.
    const acc = this._accessoryAt(vx, vy);
    if (acc != null) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      const worn = this.hooks.entity?.equip?.slots?.[acc];
      if (!worn) return true;
      if (this.mode === 'equip') { unequipSlot(this.hooks.entity, acc); refreshPaperDoll(this.hooks.entity); }
      else if (this.mode === 'info') this._info(worn);
      // UseItem(item) with NO collection, as the doll's arm passes none
      else if (this.mode === 'use') this._use(worn, null);
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
    // AUDIT 39 F126: the rail pages off the live thumb, so the hit
    // needs the scroll index and the list length.
    const hit = scrollerHit(R.localList, vx, vy, this.scroll, this._filtered().length);
    if (hit) {
      if (hit.kind === 'slot') this._pick(hit.slot);
      else this.scroll = applyScroll(this.scroll, hit.kind, this._filtered().length);
      return true;
    }
    const rhit = scrollerHit(R.remoteList, vx, vy, this.remoteScroll, this._remote().length);
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
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallInventoryWindow.cs:294),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, 0, 0);
    // the selected tab + action mode: the INVE01I0 subrect back over
    // the base (DFU's GetSubTexture highlight)
    const tr = TAB_RECT[this.tab];
    drawImgSub(renderer, _art.gold, m, tr[0], tr[1], tr[2], tr[3]);
    const mr = INV_RECTS[this.mode];
    drawImgSub(renderer, _art.gold, m, mr[0], mr[1], mr[2], mr[3]);
    // AUDIT 24 ui: the wagon button carries its OWN selected state,
    // independent of the action mode - ShowWagon(true) sets
    // `wagonButton.BackgroundTexture = wagonSelected` (:1051) and the
    // hide arm (:1062) / OnPush (:640) put it back. Without it nothing
    // on screen distinguished wagon mode from the ground pile, even
    // after CheckWagonAccess auto-opened onto the wagon.
    if (this.usingWagon) {
      const wr = INV_RECTS.wagon;
      drawImgSub(renderer, _art.gold, m, wr[0], wr[1], wr[2], wr[3]);
    }
    // U8f/U8g: the paperdoll at (49,13); U8h: the armor value labels
    // (RefreshArmourValues - (100 - av)/5 per body part, plus the
    // enchantment armorMod; the drained/increased label COLOURS are
    // still unported - F164 tracks the stat-sheet half of that law)
    drawPaperDoll(renderer, m, this.hooks.entity ?? { }, 49, 13);
    const av = this.hooks.entity?.armorValues;
    // F122: the same armorMod for every body part - RefreshArmourValues
    // recomputes it inside the loop but off entity-wide channels.
    const armorMod = enchantArmorDisplayMod(this.hooks.entity);
    if (av) ARMOR_LABEL_POS.forEach(([lx, ly], i) =>
      shadowText(renderer, font, String(armorLabelValue(av[i] ?? 100, armorMod)), m, 49 + lx, 13 + ly));
    // UpdateAccessoryItemsDisplay (:963-996): the twelve worn slots in
    // equip-slot order. An EMPTY slot draws nothing - the button's own
    // frame is already in INVE00I0.
    const wornSlots = this.hooks.entity?.equip?.slots;
    if (wornSlots) {
      for (let slot = ACCESSORY_SLOT_MIN; slot <= ACCESSORY_SLOT_MAX; slot++) {
        const it = wornSlots[slot];
        if (it) this._accessoryIcon(renderer, m, it, ACCESSORY_RECTS[slot - ACCESSORY_SLOT_MIN]);
      }
    }
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
    // the 37x32 rect at (223,145), at itemInfoPanelLabel's own
    // TextScale 0.43 and ExtraLeading 3. U47 filled it from HOVER, as
    // DFU does: `hover(vx, vy)` above reads the slot, the doll layer
    // or the gold button under the cursor, and the panel is STICKY
    // between them.
    // UI4: Setup only ADDS the panel when the setting is on (:303-307),
    // so with it off there is no cutout and no text - the plain
    // background shows through. It ships True, which is why the port
    // drawing it unconditionally has looked right all along.
    if (_art.info && getBool('GUI', 'EnableInventoryInfoPanel')) {
      drawImgCrop(renderer, _art.info, m, INV_RECTS.infoCutout, INV_RECTS.itemInfoPanel);
      // U47: the GOLD button's own two lines, which are generated and
      // need no TEXT.RSC - so they draw even in a host with none.
      const carriedGold = this.infoGold
        ? goldAmount(this.hooks.entity ?? { items: this.hooks.items() }) : 0;
      const panelRows = this.infoGold
        ? goldPanelRows(carriedGold, carriedGold * GOLD_PIECE_WEIGHT_KG)
        : ((this.infoItem && this.hooks.rows) ? itemInfoRows(this.infoItem, this.hooks.rows, { name: this._longName(this.infoItem) }) : null);
      if (panelRows) {
        const [px, py, , ph] = INV_RECTS.itemInfoPanel;
        const rows = panelRows;
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

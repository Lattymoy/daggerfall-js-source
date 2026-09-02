// U42: THE SPELLBOOK - DaggerfallSpellBookWindow.cs (MIT, Daggerfall
// Workshop; original authors Lypyl and Gavin Clayton) on the real
// SPBK00I0.IMG, with SPBK01I0.IMG behind the guilds' BUY mode. It
// retires the U4 keyed overlay that lived in ui/inventory.js (now
// ui/deathScreen.js, which is all that module has left), the last
// text stand-in on the daily loop: the book opens on every cast.
//
// THE NATIVE-WINDOW RULE, element by element (rects :33-55):
// - the whole window is one 259x164 panel, Center/Middle on the
//   320x200 native panel - so it sits at (30.5, 18), the half pixel
//   included, because that is what HorizontalAlignment.Center
//   computes and the classic art is an odd width.
// - the spell list is a 110x130 ListBox at (5,13) showing SIXTEEN
//   rows (:349), with its scroll bar at (122,28,7,103) and the two
//   arrow buttons at (121,11) and (121,132), 9x16 each.
// - the bottom row is four 38x9 buttons at y=152 - DELETE (or BUY),
//   UP, SORT, DOWN - and EXIT is 43x15 at (216,149).
// - the three icon panels: the spell's own at (149.25,14,16,16), the
//   TARGET at (182,14,25,16) - a 24-wide icon stretched one pixel -
//   and the ELEMENT at (223,14,16,16). All three are black behind
//   the art, so an unknown icon reads as a black square, not a hole.
// - three effect panels at (138,40/78/116,118,28), each carrying TWO
//   centred labels at y=5 and y=17: the effect's GROUP name and its
//   SUBGROUP name (:486-496, :624-649).
// - the labels: spell name at (123,2), spell points at (214,2), and
//   in buy mode the cost at (76,154) and the player's gold at
//   (116,154).
//
// THE LAWS, verbatim:
// - a row reads "{cost} - {name}" and the cost is recomputed EVERY
//   refresh, because it rides the caster's live skills (:256-282).
//   A spell the player cannot currently afford is DESATURATED 75%
//   toward grey rather than hidden.
// - the lycanthropy tag casts free, so its row shows 0 even though
//   classic shows a cost (:266-267).
// - DELETE refuses the vampire and lycanthropy tags with their own
//   messages BEFORE prompting (:821-831) - those spells have no way
//   back until the curse is cured.
// - the DELETE confirmation pops the BOX, not the book. This entry
//   used to read "both confirmations CLOSE THE BOOK ... Kept", off
//   the CloseWindow() that sits outside the Yes arm (:851). AUDIT-39r
//   read the call through: it is the non-virtual
//   UserInterfaceWindow.CloseWindow (:127-132) -> PopWindow ->
//   RemoveWindow (UserInterfaceManager.cs:190-199), which pops
//   TopWindow, and TopWindow is the YesNo box mb.Show() pushed -
//   DaggerfallMessageBox.ActivateButton (:479-484) raises the event
//   and never pops itself. So the box goes and the book stays, which
//   is the only reading under which that arm's own
//   RefreshSpellsList(true) and UpdateSelection() do any work; the
//   same law is written out in nativeTrade's _confirm.
//   SortSpellsConfirm (:924) is the identical construct and still
//   closes the book here - one audit's scope, not two.
// - SORT is alphabetical, and only if that changed nothing does it
//   sort by point cost (:911-921).
// - the swap buttons move the spell AND the selection, then force
//   one more row into view when the selection lands on the visible
//   edge (:876-897).
// - clicking the spell NAME renames it (a non-empty answer only,
//   :929-950); clicking the ICON opens the picker; clicking an
//   effect panel pops that effect's spellbook description (:730-763).
// - BUY mode offers every SPELLS.STD record whose name does NOT
//   start with '!' - the file's internal spells - sorted by name,
//   duplicates of what you already know included (:283-323).
// - BUY mode: the price is the casting cost x4, halved (floor 1) on
//   Witches Festival, then run through CalculateTradePrice against
//   the shop's quality (:519-536, :685-688). The ladder is
//   spellbook, then gold, then a haggle line chosen by how the
//   asking price compares - TEXT.RSC 260/261/262 - and Yes deducts,
//   adds the spell and closes (:975-1024). The gold read is
//   GetGoldAmount, so a letter of credit buys a spell.
//
// RENAME retires a ledger row. DFU's EffectBundleSettings is a
// STRUCT, so GetSpell hands the handler a COPY, the copy is renamed,
// and SetSpell writes it back into the player's slot - the shared
// SPELLS.STD record is untouched. The port's records are objects
// shared by every caster, so confirmRename copies explicitly and
// marks the copy `custom`, which is exactly the flag save.js:142
// already reads to store a whole record instead of a bare index.
// U4's "rename needs per-entity copies + name persistence first" is
// answered: it has both.
//
// THE STRINGS ARE REAL. U4 recorded that "the classic en string
// table is not in the source snapshot", and U42 inherited that and
// wrote its own prose for the prompts. The table IS in the snapshot -
// StreamingAssets/Text/Master Localization CSV Files/
// Internal_Strings.csv - and every string this window needs is in
// it: the two curse refusals (:850-851), deleteSpell and sortSpells
// (:956-957), enterSpellName (:954), effectNotFoundError (:958),
// selectIcon (:950), and the ten target/element descriptions
// (:940-949). All ten of those live in ui/spellIcons.js. The port
// has no localization LOOKUP, so these are the en values held as
// constants rather than TextManager calls - that is the departure,
// and it is a mechanism one, not a content one.
//
// RECORDED DEPARTURES:
// - no localization LOOKUP: every string above is DFU's own en text,
//   read out of Internal_Strings.csv and held as a constant with its
//   TextManager key named, rather than resolved at runtime.
// - DFU's spell VERSION gate (:746-747) has nothing to gate: the
//   port's records carry no bundle version.
// - DFU wires the name label's rename AND the icon panel's picker in
//   BOTH modes (:465, :437; SetupIcons is called unconditionally at
//   :145), and both handlers then index the PLAYER's book with the
//   OFFER's index (:929, :962) - editing whatever spell happens to
//   sit at that slot. The port gates BOTH to cast mode, and gates
//   the icon panel's `selectIcon` TOOLTIP with them, since a tip
//   naming a picker that is deliberately unreachable would be the
//   window advertising the bug it declines to port.
// - buy mode prices the offer with a bare CalculateTotalEffectCosts
//   (:521) - no minimumCastingCost - where the LIST rows
//   pass both (:262). The port has one castCost hook for both, so
//   the offer's price rides the player's live skills either way.
//
// FLAGGED, idling loudly: the effect popup's body
// (ShowEffectPopup reads each effect's own SpellBookDescription
// tokens, which the port's effect table does not carry yet, so the
// box shows the group/subgroup pair alone); and DFU's
// double-click-to-buy on the list (the port's list picks straight
// through, U24's own recorded departure).

import { nativeMetrics, drawImg, drawRect, shadowText, loadImg, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { drawText } from './text.js';
import { typedChar, bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import {
  preloadSpellIcons, drawSpellIcon, drawTargetIcon, drawElementIcon,
  TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS,
} from './spellIcons.js';
import { effectByKey } from '../systems/spellEffects.js';
import { calculateTradePrice } from '../systems/shopStock.js';
import { ROW_SPACING, SELECTED_TEXT_COLOR } from './listPicker.js';   // ListBox.cs:36-37 and DaggerfallUI.cs:62 - one home each
import { thumbSpan, scrollBarClick, drawScrollThumb } from './verticalScrollBar.js';   // ROAD-D2: DFU's own VerticalScrollBar, art and all
import { ALT_SHADOW_1 } from './chargenArt.js';   // DaggerfallAlternateShadowColor1, already homed
import { ToolTip } from './toolTip.js';   // U37's shared component - SetupIcons points three panels at it
import { SpellIconPickerWindow } from './spellIconPickerWindow.js';   // MC1: the window the icon panel's click pushes
import {
  expandGuildMacros, TRADE_MESSAGE_BASE_ID, NOT_ENOUGH_GOLD_ID, cureOfferMessageOffset,
} from '../systems/guildServiceActions.js';   // DaggerfallTradeWindow's shared ids (:33-34) and the three haggle BANDS, all already homed
import { getHolidayId, HOLIDAYS } from '../systems/holidays.js';
import { NO_SPELLBOOK_ID, SPELLBOOK_TEMPLATE_INDEX, MAX_SPELL_NAME, purchaseSpell } from '../systems/spellMaker.js';
import { totalGoldAmount } from '../systems/court.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/** The window's rects, verbatim (:33-55). */
export const SPELLBOOK_RECTS = Object.freeze({
  main: [0, 0, 259, 164],
  list: [5, 13, 110, 130],
  deleteOrBuy: [3, 152, 38, 9],
  up: [48, 152, 38, 9],
  sort: [90, 152, 38, 9],
  down: [132, 152, 38, 9],
  upArrow: [121, 11, 9, 16],
  downArrow: [121, 132, 9, 16],
  exit: [216, 149, 43, 15],
  scrollBar: [122, 28, 7, 103],
  spellIcon: [149.25, 14, 16, 16],
  targetIcon: [182, 14, 25, 16],
  elementIcon: [223, 14, 16, 16],
  effect: [[138, 40, 118, 28], [138, 78, 118, 28], [138, 116, 118, 28]],
});
/** The label anchors (:33-36) and the two rows inside an effect
 *  panel (:493-496). */
const LABEL_POS = Object.freeze({ name: [123, 2], points: [214, 2], cost: [76, 154], gold: [116, 154] });
const EFFECT_LABEL_ROWS = Object.freeze([5, 17]);
const EFFECT_LABEL_MAX_CHARS = 24;   // TextLabel.MaxCharacters (:489)
/** mainPanel is Center/Middle on the native panel (:342-343), which
 *  on a 259-wide panel lands it on a HALF pixel. */
const PANEL_X = (320 - SPELLBOOK_RECTS.main[2]) / 2;   // 30.5
const PANEL_Y = (200 - SPELLBOOK_RECTS.main[3]) / 2;   // 18
const ROWS_DISPLAYED = 16;             // spellsListBox.RowsDisplayed (:349)
/** ONE export for the geometry the tests and the hosts read, so
 *  PANEL_X/ROWS_DISPLAYED/LABEL_POS do not each become a second
 *  module-level home for a name another window already owns. */
export const SPELLBOOK_LAYOUT = Object.freeze({
  x: PANEL_X, y: PANEL_Y, rowsDisplayed: ROWS_DISPLAYED, rowSpacing: ROW_SPACING,
  labels: LABEL_POS, effectLabelRows: EFFECT_LABEL_ROWS, effectLabelMaxChars: EFFECT_LABEL_MAX_CHARS,
});
/** noSpellBook (:100) and the buy ladder's records (:977-979). */
export const NO_SPELLBOOK_TEXT_ID = NO_SPELLBOOK_ID;
const NOT_ENOUGH_GOLD_TEXT_ID = NOT_ENOUGH_GOLD_ID;
/** The window's strings, VERBATIM from DFU's own en table
 *  (StreamingAssets/Text/Master Localization CSV Files/
 *  Internal_Strings.csv :850-851, :954, :956-958). U42 first shipped
 *  these as the port's own prose, inheriting the U4 window's claim
 *  that "the classic en string table is not in the source snapshot";
 *  it is, and every one of them is in it. `enterSpellName` keeps the
 *  trailing space the window appends to the label (:934). */
export const CANNOT_DELETE_VAMP = 'Cannot delete special vampire spells.';     // cannotDeleteVamp
export const CANNOT_DELETE_WERE = 'Cannot delete special lycanthropy spell.';  // cannotDeleteWere
export const DELETE_SPELL_PROMPT = 'Do you want to delete this spell?';        // deleteSpell
export const SORT_SPELLS_PROMPT = 'Do you want to sort spells?';               // sortSpells
export const ENTER_SPELL_NAME = 'Enter spell name : ';                         // enterSpellName + " " (:934)
export const EFFECT_NOT_FOUND = '<effect not found>';                          // effectNotFoundError
export const SELECT_ICON_TIP = 'Select icon';                                  // selectIcon
/** PlayerEntity.cs:41-42 - the two tags DELETE refuses. V2a moved
 *  their HOME to systems/lycanthropy.js (the producer that grants the
 *  tagged spells lives there now); imported and re-exported so this
 *  window's own laws and its consumers keep one spelling. */
import { VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG } from '../systems/lycanthropy.js';
export { VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG };
/** ListItem's desaturation toward grey when the spell is unaffordable
 *  (:276-279). */
export const DESATURATION = 0.75;
/** DaggerfallUI.cs:57, :63 - the HOVERED row and the hovered SELECTED
 *  row (ListBox.cs:71, :73, applied by DecideTextColor :358-390). */
const HIGHLIGHT_TEXT_COLOR = Object.freeze([255 / 255, 130 / 255, 40 / 255, 1]);
const HIGHLIGHT_SELECTED_TEXT_COLOR = Object.freeze([254 / 255, 56 / 255, 18 / 255, 1]);

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
/** A window rect hit-tested in NATIVE coords (the panel offset out). */
const hitPanel = (rect, vx, vy) => inRect(rect, vx - PANEL_X, vy - PANEL_Y);
const lerpGrey = (c) => c.map((v, i) => (i === 3 ? v : v + (0.5 - v) * DESATURATION));

/** The effect slots a record really carries: the reader keeps three
 *  and marks the unused ones type -1, where DFU's converted bundle
 *  simply has fewer (:552-560 walks Effects.Length). */
export const spellEffects = (spell) => (spell?.effects ?? []).filter((e) => e && e.type >= 0);

/** PopulateSpellsList's row text (:271) and its free-cast quirk
 *  (:266-267). */
export function spellRowText(spell, cost) { return `${cost} - ${spell.name}`; }
export function spellPointCost(spell, castCost) {
  if (spell?.tag === LYCANTHROPY_SPELL_TAG) return 0;
  return rawSpellPointCost(spell, castCost);
}
/** The same CalculateTotalEffectCosts value WITHOUT the display
 *  quirk - what SortSpellsPointCost orders by (AUDIT 26 F179). */
export function rawSpellPointCost(spell, castCost) {
  return castCost ? castCost(spell) : (spell?.cost ?? 0);
}

let _art = null;
/** SPBK00I0 (cast) and SPBK01I0 (buy), plus the icon sheets. */
export async function preloadSpellbookArt(deps) {
  if (_art) return _art;
  const [base, buy] = await Promise.all([
    loadImg(deps, 'SPBK00I0.IMG'),
    loadImg(deps, 'SPBK01I0.IMG'),
  ]);
  await preloadSpellIcons(deps).catch((e) => console.warn('[spellbook] icon sheets unavailable:', e?.message ?? e));
  _art = { base, buy };
  return _art;
}
export const spellbookArtLoaded = () => !!_art;
export function _setSpellbookArtForTests(art) { _art = art; }

export class SpellbookWindow {
  /** deps: { spells(), entity, castCost(spell), onReady(spell,
   *  { noSpellPointCost }), onClose(), rows(id), offered(),
   *  buildingQuality(), shopName(), skills(), classicMinutes() }.
   *  `buyMode` swaps the art, the list and the bottom-left button,
   *  exactly as DFU's one window does - it is one class in DFU too. */
  constructor(deps = {}, { buyMode = false } = {}) {
    this.deps = deps;
    this.buyMode = !!buyMode;
    this.done = false;
    this.isChoiceWindow = true;
    this.selectedIndex = -1;
    this.scrollIndex = 0;
    this.top = null;          // the pushed box: see _boxRows
    this.renameText = '';
    this.deleteSpellIndex = -1;
    this.presentedCost = 0;
    this._box = null;
    this._noteRows = null;
    this._rows = [];
    this.offeredSpells = [];
    this.highlightedIndex = -1;
    // SetupIcons (:436, :448, :454) points all three icon panels at
    // the shared defaultToolTip. U37 built that component; this is
    // the second window to hold one.
    this.tip = new ToolTip();
    this.refreshSpellsList(false);
    this.setDefaults();
    // OnPush (:172-176): the book opens with a page turn, the shop
    // with a button click.
    audio.playOneShot(this.buyMode ? SOUND.ButtonClick : SOUND.OpenBook, 1);
  }

  // --- the list (:216-278) ---

  /** The spells the list shows: the player's book, or the guild's
   *  offer in buy mode (:229-240). */
  get spells() {
    return (this.buyMode ? this.offeredSpells : this.deps.spells?.()) ?? [];
  }

  /** LoadSpellsForSale (:284-323). Two laws live here and nowhere
   *  else: a record whose name starts with '!' is one of the file's
   *  INTERNAL spells and is never offered, and the offer is sorted by
   *  NAME before it reaches the list. Classic allows buying a
   *  duplicate of a spell you already know, and so does this - DFU's
   *  own note says to leave it alone. */
  loadSpellsForSale() {
    const all = this.deps.offered?.() ?? [];
    this.offeredSpells = all
      .filter((sp) => sp && !String(sp.name ?? '').startsWith('!'))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return this.offeredSpells;
  }

  /** RefreshSpellsList (:217-254). */
  refreshSpellsList(preservePosition = false) {
    const oldScroll = this.scrollIndex;
    const oldSelected = this.selectedIndex;
    if (this.buyMode) this.loadSpellsForSale();
    const list = this.spells;
    const available = this.buyMode ? null : (this.deps.entity?.magicka ?? null);
    this._rows = list.map((spell) => {
      const cost = spellPointCost(spell, this.deps.castCost);
      return {
        spell, cost, text: spellRowText(spell, cost),
        // Desaturate what the player cannot afford (:268-275)
        dim: available != null && available < cost,
      };
    });
    if (preservePosition) {
      this.scrollIndex = oldScroll;
      if (oldSelected >= this._rows.length) this.selectedIndex = this._rows.length ? this._rows.length - 1 : -1;
      else this.selectedIndex = oldSelected;
      this._clampScroll();
    }
  }

  /** SetDefaults (:186-203): the first spell, or none. */
  setDefaults() {
    this.selectedIndex = this._rows.length > 0 ? 0 : -1;
    this.scrollIndex = 0;
  }

  get selected() { return this._rows[this.selectedIndex]?.spell ?? null; }

  _clampScroll() {
    const max = Math.max(0, this._rows.length - ROWS_DISPLAYED);
    this.scrollIndex = Math.min(Math.max(0, this.scrollIndex), max);
  }

  /** SelectPrevious (ListBox.cs:709-724) and SelectNext (:726-741),
   *  which the two arrow buttons and the keyboard share.
   *
   *  The scroll clause lives INSIDE the movement guard and nudges by
   *  exactly one row - it does not snap. Both details are reachable,
   *  because the wheel moves scrollIndex without moving the selection
   *  (SpellsListBox_OnMouseScroll, :789-792): scroll five rows down,
   *  press Up at the top of the book, and DFU leaves the view where
   *  it is while a guard-outside version yanks it back to zero. */
  selectPrevious() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      if (this.selectedIndex < this.scrollIndex) this.scrollIndex = this.selectedIndex;
    }
  }

  selectNext() {
    if (this.selectedIndex < this._rows.length - 1) {
      this.selectedIndex++;
      if (this.selectedIndex > this.scrollIndex + (ROWS_DISPLAYED - 1)) this.scrollIndex++;
    }
  }

  wheel(dir) {
    if (this.top === 'iconPicker') { this._iconPicker?.wheel(dir); return; }   // MC1
    if (!dir || this.top) return;
    this.scrollIndex += Math.sign(dir);
    this._clampScroll();
  }

  /** ListBox.MouseMove (:427-438) and MouseLeave (:459-462): the row
   *  under the pointer is HIGHLIGHTED - a colour swap, not a bar -
   *  and leaving the list clears it to -1. */
  hover(vx, vy) {
    if (this.top === 'iconPicker') { this._iconPicker?.hover(vx, vy); return; }   // MC1: the selection follows the pointer
    const [lx, ly, lw, lh] = SPELLBOOK_RECTS.list;
    const x = vx - PANEL_X, y = vy - PANEL_Y;
    this._tipHover(x, y, vx, vy);
    if (this.top || !inRect([lx, ly, lw, lh], x, y)) { this.highlightedIndex = -1; return; }
    const row = Math.floor((y - ly) / this._rowHeight());
    const index = this.scrollIndex + row;
    this.highlightedIndex = (index >= 0 && index < this._rows.length) ? index : -1;
  }

  /** The three icon panels' tooltips. The spell icon's is the static
   *  `selectIcon` (:436) - it names the PICKER the click opens, not
   *  the icon - and the other two are recomputed per selection by
   *  UpdateSelection (:572, :574) from GetTargetTypeDescription and
   *  GetElementDescription. A panel is only tipped when ShowIcons is
   *  on (:565-575), i.e. when a spell is selected at all. */
  _tipHover(x, y, vx, vy) {
    const spell = this.selected;
    if (this.top || !spell) { this.tip.hide(); return; }
    if (inRect(SPELLBOOK_RECTS.spellIcon, x, y) && !this.buyMode) { this.tip.show(SELECT_ICON_TIP, vx, vy); return; }
    if (inRect(SPELLBOOK_RECTS.targetIcon, x, y)) {
      this.tip.show(TARGET_DESCRIPTIONS[spell.rangeType] ?? null, vx, vy);
      return;
    }
    if (inRect(SPELLBOOK_RECTS.elementIcon, x, y)) {
      this.tip.show(ELEMENT_DESCRIPTIONS[spell.element] ?? null, vx, vy);
      return;
    }
    this.tip.hide();
  }

  /** The tooltip's rest clock - the same `tick` name every host's
   *  overlay seam already calls (townTalk.frame, tickOverlay). */
  tick(dt) { this.tip.update(dt); }

  // --- the selection's panels (:508-575) ---

  /** UpdateSelection's buy-mode half (:520-534): the casting cost x4,
   *  halved on Witches Festival with a floor of one. */
  _updatePresentedCost() {
    const spell = this.selected;
    if (!spell) { this.presentedCost = 0; return; }
    // DEPARTURE, recorded: UpdateSelection prices the offer with a
    // bare CalculateTotalEffectCosts (:521) - no caster and no
    // minimumCastingCost, and so no lycanthropy free-cast quirk. The
    // port has one castCost hook, so the quirk is skipped HERE
    // rather than inside it; no offered spell carries the tag.
    let cost = (this.deps.castCost ? this.deps.castCost(spell) : (spell.cost ?? 0)) * 4;
    const minutes = this.deps.classicMinutes?.() ?? 0;
    if (getHolidayId(minutes, 0) === HOLIDAYS.Witches_Festival) {
      cost >>= 1;
      if (cost === 0) cost = 1;
    }
    this.presentedCost = cost;
  }

  /** GetTradePrice (:685-688) - the shop's quality prices the offer
   *  against the player's LIVE Mercantile and Personality, which is
   *  where FormulaHelper.CalculateTradePrice reaches for them
   *  (:1982-1998). The port passes them in, so the host supplies the
   *  same pair every other trade surface does. */
  tradePrice() {
    this._updatePresentedCost();
    return calculateTradePrice(this.presentedCost, this.deps.buildingQuality?.() ?? 0,
      this.deps.skills?.() ?? {}, false);
  }

  /** SetEffectLabels (:624-649): the group and subgroup names of the
   *  effect in this slot, or the not-found pair, which puts the RAW
   *  KEY on the second row.
   *
   *  The key is built with `& 0xff` because the port has TWO
   *  spellings of "no subtype": a SPELLS.STD record reads it as a
   *  SIGNED byte and stores -1, while a spell built in the maker
   *  copies the catalog's 255. Every other consumer normalizes the
   *  same way (systems/effects.js:158's classicSub, spellcost.js:128)
   *  and the effect table is keyed on 255, so a Free Action off the
   *  file would otherwise print "Effect not found" in the book. */
  effectLabels(slot) {
    const effects = spellEffects(this.selected);
    const e = effects[slot];
    if (!e) return ['', ''];
    const key = `${e.type},${e.subType & 0xff}`;
    const template = effectByKey(key);
    if (!template) return [EFFECT_NOT_FOUND, key];
    return [template.group, template.subgroup ?? ''];
  }

  // --- the buttons (:729-1020) ---

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }
  _edit() { audio.playOneShot(SOUND.PageTurn, 1); }

  /** SpellsListBox_OnUseSelectedItem (:770-787): ready the spell and
   *  drop back to the HUD. Lycanthropy casts free. */
  useSelected() {
    const spell = this.selected;
    if (!spell) return;
    this.deps.onReady?.(spell, { noSpellPointCost: spell.tag === LYCANTHROPY_SPELL_TAG });
    this._close();
  }

  /** DeleteButton_OnMouseClick (:811-837). */
  deleteButton() {
    if (this.selectedIndex === -1) return;
    const spell = this.selected;
    if (spell?.tag === VAMPIRE_SPELL_TAG) { this.top = 'note'; this._noteRows = [CANNOT_DELETE_VAMP]; return; }
    if (spell?.tag === LYCANTHROPY_SPELL_TAG) { this.top = 'note'; this._noteRows = [CANNOT_DELETE_WERE]; return; }
    this.deleteSpellIndex = this.selectedIndex;
    this.top = 'delete';
  }

  /** DeleteSpellConfirm_OnButtonClick (:839-852).
   *
   *  AUDIT-39r: the trailing `CloseWindow()` (:851) reads as "either
   *  answer closes the book" and is not. It is the non-virtual
   *  UserInterfaceWindow.CloseWindow (:127-132) -> PopWindow ->
   *  RemoveWindow (UserInterfaceManager.cs:190-199), which pops
   *  TopWindow - and TopWindow is the YesNo box `mb.Show()` pushed,
   *  because ActivateButton (DaggerfallMessageBox.cs:479-484) only
   *  raises the event and never pops itself. So the box goes and the
   *  BOOK STAYS, which is the only reading under which this arm's own
   *  `RefreshSpellsList(true); UpdateSelection();` do any work. This
   *  port already writes that law out in nativeTrade's _confirm; the
   *  book had been reading it backwards since U42. */
  confirmDelete(yes) {
    if (yes && this.deleteSpellIndex !== -1) {
      const list = this.deps.spells?.() ?? [];
      list.splice(this.deleteSpellIndex, 1);
      this.refreshSpellsList(true);   // UpdateSelection rides along: the clamp is in here
      this._edit();
    }
    this.deleteSpellIndex = -1;
    this.top = null;
  }

  /** SwapButton_OnMouseClick (:872-897), both arms including the
   *  force-one-more-row-into-view step. */
  swap(dir) {
    if (this.selectedIndex === -1) return;
    const list = this.deps.spells?.() ?? [];
    const i = this.selectedIndex;
    if (dir > 0 && i < list.length - 1) {
      [list[i], list[i + 1]] = [list[i + 1], list[i]];
      this.refreshSpellsList(true);
      this.selectNext();
      if (this.selectedIndex === this.scrollIndex + ROWS_DISPLAYED - 1) { this.scrollIndex++; this._clampScroll(); }
      this._edit();
    } else if (dir < 0 && i > 0) {
      [list[i], list[i - 1]] = [list[i - 1], list[i]];
      this.refreshSpellsList(true);
      this.selectPrevious();
      if (this.selectedIndex === this.scrollIndex) { this.scrollIndex--; this._clampScroll(); }
      this._edit();
    }
  }

  /** SortSpellsConfirm_OnButtonClick (:906-925): alphabetical, and
   *  point cost only if the alphabetical pass changed nothing (:912-
   *  918). This one closes the book on either answer too (:924). */
  confirmSort(yes) {
    if (yes) {
      const list = this.deps.spells?.() ?? [];
      const before = list.slice();
      list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      if (list.every((sp, i) => sp === before[i])) {
        // AUDIT 26 F179: the RAW cost, not the display one.
        // SortSpellsPointCost (DaggerfallEntity.cs:741-752) calls
        // CalculateTotalEffectCosts with no tag check at all - the
        // zero-cost lycanthropy quirk lives only in
        // PopulateSpellsList (:264-267), where its comment says it is
        // "so it displays correctly in spellbook". Sorting through
        // the display value floated that spell to the front of a
        // lycanthrope's book instead of leaving it at its real
        // position.
        const cost = new Map(list.map((sp) => [sp, rawSpellPointCost(sp, this.deps.castCost)]));
        list.sort((a, b) => cost.get(a) - cost.get(b));
      }
      this.refreshSpellsList(false);
      this.setDefaults();
      this._edit();
    }
    this.top = null;
    this._close();
  }

  /** SpellNameLabel_OnMouseClick (:927-938) + RenameSpellPromptHandler
   *  (:940-951). */
  renameButton() {
    if (this.selectedIndex === -1 || !this.selected) return;
    this.renameText = this.selected.name ?? '';
    this.top = 'rename';
  }

  /** RenameSpellPromptHandler (:937-950). DFU's EffectBundleSettings
   *  is a STRUCT: GetSpell hands back a COPY, the handler renames the
   *  copy, and SetSpell writes it into the player's slot - the shared
   *  SPELLS.STD record is never touched. The port's records are
   *  objects shared by every caster, so the copy has to be explicit,
   *  and it is marked `custom` so save.js:142 stores the whole record
   *  instead of the bare index it would otherwise write (which would
   *  reload the ORIGINAL name). That retires the U4 ledger's rename
   *  row: renaming is real and it persists. */
  confirmRename() {
    // RAW, not trimmed: DFU's guard is string.IsNullOrEmpty (:944), so
    // a name of three spaces is a legal rename in classic and the
    // port keeps it legal rather than quietly being stricter.
    const input = this.renameText;
    this.top = null;
    if (this.selectedIndex === -1 || !input) return;   // "Must not be blank" (:943-944)
    const list = this.deps.spells?.() ?? [];
    const spell = list[this.selectedIndex];
    if (!spell) return;
    list[this.selectedIndex] = { ...spell, name: input, custom: true };
    this.refreshSpellsList(true);
    this._edit();
  }

  /** MC1: the icon picker mounts over the book (uiManager.PushWindow,
   *  :957) and IconPicker_OnClose (:960-974) is the same struct
   *  copy-then-SetSpell shape as the rename above: a non-null pick
   *  writes the icon onto a COPY of the selected spell, marks it
   *  `custom` so the save keeps it, refreshes the selection and plays
   *  the edit sound; a cancel (null) changes nothing. */
  _openIconPicker() {
    this.top = 'iconPicker';
    this._iconPicker = new SpellIconPickerWindow({
      onClose: (icon) => {
        this.top = null;
        this._iconPicker = null;
        if (!icon) return;
        const list = this.deps.spells?.() ?? [];
        const spell = list[this.selectedIndex];
        if (!spell) return;   // GetSpell's false arm (:963-964)
        list[this.selectedIndex] = { ...spell, icon: icon.index, custom: true };
        this._edit();   // editSpellBook (:972)
      },
    });
  }

  /** BuyButton_OnMouseClick (:975-1013): spellbook, gold, then the
   *  haggle line chosen by how the price compares. */
  buyButton() {
    this._click();
    const entity = this.deps.entity;
    const price = this.tradePrice();
    const hasBook = (entity?.items ?? []).some(
      (it) => it.group === 'MiscItems' && it.templateIndex === SPELLBOOK_TEMPLATE_INDEX);
    if (!hasBook) { this.top = 'noSpellbook'; return; }
    if (totalGoldAmount(entity) < price) { this.top = 'notEnoughGold'; return; }
    // The three bands (:984-990) are cureOfferMessageOffset's - DFU
    // wrote the same comparison in the temple, the trade window and
    // here, and the port keeps ONE home (tradeModes.js already reuses
    // it for the trade records).
    this._tradeOffset = cureOfferMessageOffset(this.presentedCost, price);
    this.top = 'trade';
  }

  /** ConfirmTrade_OnButtonClick (:1011-1024) - and the close is
   *  outside the Yes arm here as well. */
  confirmTrade(yes) {
    if (yes) {
      const spell = this.selected;
      if (spell) {
        purchaseSpell(this.deps.entity, { ...spell }, this.tradePrice());
        audio.playOneShot(SOUND.GoldPieces, 1);
      }
    }
    this.top = null;
    this._close();
  }

  _close() {
    // OnPop (:178-183): the book turns a page shut, the shop clicks.
    audio.playOneShot(this.buyMode ? SOUND.ButtonClick : SOUND.PageTurn, 1);
    this.done = true;
    this.deps.onClose?.();
  }

  // --- the host seam ---

  input(code, e = null) {
    if (this.top === 'iconPicker') { this._iconPicker?.input(code); return; }   // MC1: the picker is modal
    if (this.top === 'rename') {
      if (code === 'Escape') { this.top = null; return; }
      if (code === 'Enter' || code === 'NumpadEnter') { this.confirmRename(); return; }
      if (code === 'Backspace') { this.renameText = this.renameText.slice(0, -1); return; }
      const ch = typedChar(code, e);
      // TextBox.maxCharacters (TextBox.cs:26, :425). The port already
      // homes the 31 in spellMaker.js, where the maker's own name box
      // reads it.
      if (ch && this.renameText.length < MAX_SPELL_NAME) this.renameText += ch;
      return;
    }
    if (this.top === 'delete') {
      if (code === 'KeyY') { this._click(); this.confirmDelete(true); }
      else if (code === 'KeyN' || code === 'Escape') { this._click(); this.confirmDelete(false); }
      return;
    }
    if (this.top === 'sort') {
      if (code === 'KeyY') { this._click(); this.confirmSort(true); }
      else if (code === 'KeyN' || code === 'Escape') { this._click(); this.confirmSort(false); }
      return;
    }
    if (this.top === 'trade') {
      if (code === 'KeyY') { this._click(); this.confirmTrade(true); }
      else if (code === 'KeyN' || code === 'Escape') { this._click(); this.confirmTrade(false); }
      return;
    }
    if (this.top) { this.top = null; return; }   // the click-anywhere boxes
    // Update's toggle-closed binding is the CAST key (:158-161,
    // :205-214), and the back button closes too.
    if (code === 'Escape' || actionForCode(bindings(), code) === 'CastSpell') { this._close(); return; }
    switch (code) {
      case 'ArrowUp': this.selectPrevious(); return;
      case 'ArrowDown': this.selectNext(); return;
      case 'Enter': case 'NumpadEnter':
        // OnUseSelectedItem - what Return raises - is subscribed ONLY
        // outside buy mode (:357-360); the shop wires
        // OnMouseDoubleClick instead, so Enter does nothing there and
        // B or the BUY button is the keyboard path.
        if (!this.buyMode) this.useSelected();
        return;
      case 'KeyE': this._close(); return;                                   // SpellbookExit
      default: break;
    }
    if (this.buyMode) {
      if (code === 'KeyB') this.buyButton();                                 // SpellbookBuy
      return;
    }
    if (code === 'KeyL') { this.deleteButton(); }                            // SpellbookDelete
    else if (code === 'KeyU') { this.swap(-1); }                             // SpellbookUp
    else if (code === 'KeyD') { this.swap(1); }                              // SpellbookDown
    else if (code === 'KeyS') { this.top = 'sort'; }                         // SpellbookSort
  }

  click(vx, vy) {
    if (this.top === 'iconPicker') return this._iconPicker?.click(vx, vy) ?? true;   // MC1
    if (this.top === 'delete' || this.top === 'sort' || this.top === 'trade') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this.input('KeyY');
      else if (hit === MB_BUTTONS.No) this.input('KeyN');
      return true;
    }
    if (this.top === 'rename') return true;   // a field answers keys only
    if (this.top) { this.top = null; return true; }
    if (hitPanel(SPELLBOOK_RECTS.exit, vx, vy)) { this._close(); return true; }
    if (hitPanel(SPELLBOOK_RECTS.upArrow, vx, vy)) { this._edit(); this.selectPrevious(); return true; }
    if (hitPanel(SPELLBOOK_RECTS.downArrow, vx, vy)) { this._edit(); this.selectNext(); return true; }
    if (hitPanel(SPELLBOOK_RECTS.deleteOrBuy, vx, vy)) {
      if (this.buyMode) this.buyButton();
      else this.deleteButton();
      return true;
    }
    if (!this.buyMode) {
      if (hitPanel(SPELLBOOK_RECTS.up, vx, vy)) { this.swap(-1); return true; }
      if (hitPanel(SPELLBOOK_RECTS.down, vx, vy)) { this.swap(1); return true; }
      if (hitPanel(SPELLBOOK_RECTS.sort, vx, vy)) { this.top = 'sort'; return true; }
      if (inRect([LABEL_POS.name[0], LABEL_POS.name[1], 110, 10], vx - PANEL_X, vy - PANEL_Y)) {
        this.renameButton();
        return true;
      }
      if (hitPanel(SPELLBOOK_RECTS.spellIcon, vx, vy)) {
        // MC1: SpellIconPanel_OnMouseClick pushes the picker (:954-958)
        this._click();
        this._openIconPicker();
        return true;
      }
    }
    // the three effect panels pop their effect's description (:730-763)
    for (let i = 0; i < 3; i++) {
      if (!hitPanel(SPELLBOOK_RECTS.effect[i], vx, vy)) continue;
      if (this.buyMode) this._click();
      const [group, subgroup] = this.effectLabels(i);
      if (!group) return true;
      this.top = 'note';
      this._noteRows = [subgroup ? `${group} ${subgroup}` : group,
        ...(this._effectDescription(i) ?? [])];
      return true;
    }
    // F180: VerticalScrollBar.MouseClick (:142-150) - a trough click
    // PAGES by displayUnits, above or below the thumb, with the same
    // thumb geometry draw() computes. (DFU also drags the thumb from
    // its per-frame Update loop, :101-130; no held-button state
    // reaches THIS window from its hosts - they hand it single-shot
    // clicks only - so the drag stays unported, and the trough +
    // wheel + arrows reach every index the drag can. The reason used
    // to read "the listPicker.js precedent"; ROAD-A7 retired that
    // half - listPicker's hosts DO poll the held button into
    // ui/verticalScrollBar.js's update(), so the limit is per-host,
    // not the port's seam. Recorded in the Ledger's F159/F170/F180
    // row.)
    if (this._rows.length > ROWS_DISPLAYED && hitPanel(SPELLBOOK_RECTS.scrollBar, vx, vy)) {
      // ROAD-D2: the thumb geometry and the two paging arms are
      // ui/verticalScrollBar.js's now - the same span the draw uses,
      // so the trough and the art can never disagree.
      const [, sy, , sh] = SPELLBOOK_RECTS.scrollBar;
      const span = thumbSpan(sh, this._rows.length, ROWS_DISPLAYED, this.scrollIndex);
      this.scrollIndex = scrollBarClick(vy - PANEL_Y - sy, span,
        this.scrollIndex, this._rows.length, ROWS_DISPLAYED);
      return true;
    }
    // a click in the list selects that row
    const [lx, ly, lw, lh] = SPELLBOOK_RECTS.list;
    if (inRect([lx, ly, lw, lh], vx - PANEL_X, vy - PANEL_Y)) {
      const row = Math.floor((vy - PANEL_Y - ly) / this._rowHeight());
      const index = this.scrollIndex + row;
      if (index >= 0 && index < this._rows.length) {
        if (index === this.selectedIndex) { if (!this.buyMode) this.useSelected(); else this.buyButton(); }
        else this.selectedIndex = index;
      }
      return true;
    }
    return true;
  }

  /** ShowEffectPopup (:651-660) reads the effect's own
   *  SpellBookDescription; the port has no per-effect description
   *  text source yet, so the box carries the name alone and says so. */
  _effectDescription() { return null; }

  _rowHeight() { return (this._font?.fnt?.fixedHeight ?? 6) + ROW_SPACING; }

  /** The rows a pushed box carries. `rows(id)` is the host's
   *  GetRandomTokens seam (variantLinesById), and every record goes
   *  through the ONE macro table - SpellbookMacroDataSource answers
   *  Amount (%a, the trade price), ShopName (%cpn) and GuildTitle
   *  (%pct, which MacroHelper.GetFirstname makes the PLAYER's first
   *  name here, not a rank; :711-722). */
  _boxText(id, amount = null) {
    const raw = this.deps.rows?.(id) ?? [];
    return raw.map((r) => {
      const text = expandGuildMacros(typeof r === 'string' ? r : r.text ?? '', {
        amount,
        gold: totalGoldAmount(this.deps.entity),
        guildTitle: String(this.deps.entity?.name ?? '').split(' ')[0],
        shopName: this.deps.shopName?.() ?? '',
        playerName: this.deps.entity?.name ?? '',
      });
      return typeof r === 'string' ? text : { ...r, text };
    });
  }

  _boxRows() {
    if (this.top === 'delete') return [DELETE_SPELL_PROMPT];
    if (this.top === 'sort') return [SORT_SPELLS_PROMPT];
    if (this.top === 'noSpellbook') {
      const rows = this._boxText(NO_SPELLBOOK_TEXT_ID);
      return rows.length ? rows : ['You have no spellbook.'];
    }
    if (this.top === 'notEnoughGold') {
      const rows = this._boxText(NOT_ENOUGH_GOLD_TEXT_ID);
      return rows.length ? rows : ['You do not have enough gold.'];
    }
    if (this.top === 'trade') {
      const price = this.tradePrice();
      const rows = this._boxText(TRADE_MESSAGE_BASE_ID + (this._tradeOffset ?? 0), price);
      return rows.length ? rows : [`That will be ${price} gold.`];
    }
    return this._noteRows ?? [];
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    this._font = font;
    const art = _art ? (this.buyMode ? _art.buy : _art.base) : null;
    if (art) drawImg(renderer, art, m, PANEL_X, PANEL_Y, SPELLBOOK_RECTS.main[2], SPELLBOOK_RECTS.main[3]);
    else drawRect(renderer, m, PANEL_X, PANEL_Y, SPELLBOOK_RECTS.main[2], SPELLBOOK_RECTS.main[3], [0.05, 0.04, 0.03, 0.95]);
    if (!font) return;

    // the list
    const [lx, ly] = SPELLBOOK_RECTS.list;
    const rh = this._rowHeight();
    for (let r = 0; r < ROWS_DISPLAYED; r++) {
      const i = this.scrollIndex + r;
      const row = this._rows[i];
      if (!row) break;
      // DecideTextColor's four arms (ListBox.cs:358-390). A SELECTED
      // row draws with selectedShadowPosition = Vector2.zero, so it
      // loses its drop shadow entirely - drawn flat, not shadowed.
      const selected = i === this.selectedIndex, hot = i === this.highlightedIndex;
      const base = selected
        ? (hot ? HIGHLIGHT_SELECTED_TEXT_COLOR : SELECTED_TEXT_COLOR)
        : (hot ? HIGHLIGHT_TEXT_COLOR : DEFAULT_TEXT_COLOR);
      const color = row.dim ? lerpGrey(base) : base;
      const x = PANEL_X + lx, y = PANEL_Y + ly + r * rh;
      if (selected) drawText(renderer, font, row.text, m.ox + x * m.s, m.oy + y * m.s, m.s, color);
      else shadowText(renderer, font, row.text, m, x, y, { color });
    }

    // VerticalScrollBar: Draw() returns early when the list fits
    // (:135-139), so a book of sixteen spells or fewer has NO thumb -
    // thumbSpan answers null there and drawScrollThumb paints nothing.
    // The geometry is :204-207 verbatim, minimum height included, and
    // ROAD-D2 gave it DFU's OWN three art slices (see below).
    const [sbx, sby, sbw, sbh] = SPELLBOOK_RECTS.scrollBar;
    drawScrollThumb(renderer, m, [PANEL_X + sbx, PANEL_Y + sby, sbw, sbh],
      thumbSpan(sbh, this._rows.length, ROWS_DISPLAYED, this.scrollIndex));

    const spell = this.selected;
    // The name and the spell-point labels carry
    // DaggerfallAlternateShadowColor1 (:465, :479); the buy-mode cost
    // and gold labels set ShadowPosition = Vector2.zero (:472-475),
    // so they draw FLAT - no shadow pass at all.
    if (spell) {
      shadowText(renderer, font, spell.name ?? '', m,
        PANEL_X + LABEL_POS.name[0], PANEL_Y + LABEL_POS.name[1], { shadow: ALT_SHADOW_1 });
    }
    if (!this.buyMode) {
      const e = this.deps.entity ?? {};
      shadowText(renderer, font, `${e.magicka ?? 0}/${e.maxMagicka ?? 0}`, m,
        PANEL_X + LABEL_POS.points[0], PANEL_Y + LABEL_POS.points[1], { shadow: ALT_SHADOW_1 });
    } else {
      const flat = (text, [lx2, ly2]) => drawText(renderer, font, text,
        m.ox + (PANEL_X + lx2) * m.s, m.oy + (PANEL_Y + ly2) * m.s, m.s, DEFAULT_TEXT_COLOR);
      // The label is the PRESENTED cost (:534) - the casting cost x4,
      // Witches-Festival-halved - NOT the trade price. They are
      // deliberately different numbers: the whole 260/261/262 ladder
      // exists to compare one against the other, so a shop asking
      // less than the sticker gets a friendlier line. GetTradePrice
      // (:685-688) is read only by the ladder, the %a macro and the
      // deduction.
      this._updatePresentedCost();
      flat(String(this.presentedCost), LABEL_POS.cost);
      flat(String(totalGoldAmount(this.deps.entity)), LABEL_POS.gold);
    }

    // the three icons - black panels behind whatever the sheets give
    if (spell) {
      for (const [rect, drawIcon, value] of [
        [SPELLBOOK_RECTS.spellIcon, drawSpellIcon, spell.icon ?? 0],
        [SPELLBOOK_RECTS.targetIcon, drawTargetIcon, spell.rangeType ?? 0],
        [SPELLBOOK_RECTS.elementIcon, drawElementIcon, spell.element ?? 0],
      ]) {
        const dst = [PANEL_X + rect[0], PANEL_Y + rect[1], rect[2], rect[3]];
        drawRect(renderer, m, ...dst, [0, 0, 0, 1]);
        drawIcon(renderer, m, value, dst);
      }
      // the effect panels' two labels each, centred IN THE PANEL
      // (HorizontalAlignment.Center, :490) and clipped to
      // MaxCharacters (:489)
      for (let i = 0; i < 3; i++) {
        const [ex, ey, ew] = SPELLBOOK_RECTS.effect[i];
        this.effectLabels(i).forEach((text, row) => {
          if (!text) return;
          shadowText(renderer, font, text.slice(0, EFFECT_LABEL_MAX_CHARS), m,
            PANEL_X + ex, PANEL_Y + ey + EFFECT_LABEL_ROWS[row],
            { align: 'center', w: ew, shadow: ALT_SHADOW_1 });
        });
      }
    }

    if (this.top === 'iconPicker') {
      this._box = null;
      this._iconPicker?.draw(renderer, canvas, font);   // MC1: the picker rides over the book
    } else if (this.top === 'rename') {
      this._box = layoutMessageBox(font, [`${ENTER_SPELL_NAME}${this.renameText}_`], []);
      this._drawBox(renderer, m, font);
    } else if (this.top) {
      const buttons = (this.top === 'delete' || this.top === 'sort' || this.top === 'trade')
        ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, this._boxRows(), buttons);
      this._drawBox(renderer, m, font);
    } else this._box = null;

    this.tip.draw(renderer, m, font);   // LAST - DFU's final-component order
  }

  _drawBox(renderer, m, font) {
    if (messageBoxArtLoaded() && drawMessageBox(renderer, m, font, this._box)) return;
    (this._box.rows ?? []).forEach((r, i) => drawText(renderer, font, r.text ?? r,
      m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, [0.9, 0.9, 0.75, 1]));
  }
}

/** DaggerfallUI.cs:52's default row colour is nativePanel's
 *  DEFAULT_TEXT_COLOR and :62's dark-red selected row is the list
 *  picker's SELECTED_TEXT_COLOR - both imported, neither rewritten. */
/** ROAD-D2 closed this file's thumb note. The "Resources sprite the
 *  port has no reader for" was stale: ROAD-A7 carried vScrollThumb
 *  Top/Body/Bottom into the repo as their fifteen literal bytes
 *  (ui/verticalScrollBar.js:56-58), so the book's thumb is DFU's own
 *  art - a 77 left edge, a 186 body under a 223 highlight, an all-77
 *  foot, each strip StretchToFill across the 7-wide rail - drawn by
 *  drawScrollThumb, and the local 10px floor and the flat brass
 *  rectangle it used to paint are both gone. THUMB_MIN_H
 *  (VerticalScrollBar.cs:209) and the whole of :204-221 live in that
 *  one file; this window states no geometry of its own.
 *  The DRAG (Update, :101-130) stays unported here and only here -
 *  no host hands this window a held-button frame - which is the
 *  Ledger's F159/F170/F180 row, not a thumb-art gap. */

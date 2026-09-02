// ROAD-E E8 - THE SPELL MAKER, NATIVE. DaggerfallSpellMakerWindow.cs
// (1071) + DaggerfallEffectSettingsEditorWindow.cs (484), MIT
// Daggerfall Workshop / Gavin Clayton, on real ARENA2 art.
//
// WHAT THIS FILE REPLACED, and why the replacement was owed. S1 built
// the maker's LAW (systems/spellMaker.js) under a keyed text sheet in
// the travel-map idiom, and recorded the window itself as a departure
// - a departure that never got a Ledger row, which is how
// Port-Status-2026-09-02 came to list it as the one window drawn in a
// different idiom. It is drawn in DFU's idiom now, and the departure
// is retired rather than papered over.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is INFO01I0.IMG, a full 320x200 background (:126), so
//   every rect here is screen-absolute and nothing is centred at draw
//   time. NativePanel.BackgroundColor is a 75% black under it (:172)
//   and the texture is read with alternateAlphaIndex 12 (:229); the
//   port's IMG loader carries one alpha rule, so the black is painted
//   under the art and shows only where the art itself is transparent.
// - the SELECTED-state art is MASK01I0.IMG (goldSelectIconsFilename,
//   :127), a 40x80 sheet (selectedIconsBaseSize, :30) holding the
//   five 24x16 target marks stacked down the left and the five 16x16
//   element marks stacked down the right at x24 (:56-65). The mark is
//   drawn back over the base at the button's own rect - which is
//   exactly what `BackgroundTexture = <selected>` does there.
//   MASK04I0 (colorSelectIconsFilename, :128) is DECLARED and never
//   loaded by DFU; ui/spellIcons.js already carries that sheet for
//   the spellbook, and this window does not need it.
// - the ICON button's background IS the chosen spell icon
//   (SetIcon, :340-352) - drawn through ui/spellIcons.js, the one
//   home for ICON00I0.
// - THE THREE EFFECT-NAME ROWS ARE NOT AT x3. Their rects read
//   (3, 30/62/94, 230, 9) (:33-35), but SetupLabels gives each panel
//   `HorizontalAlignment = Center` (:271, :280, :289), and
//   BaseScreenComponent's centring ASSIGNS x rather than offsetting
//   it - so the panel sits at (320-230)/2 = 45 and the 3 is dead.
//   The label inside is centred again, and its ShadowPosition is
//   ZERO (:275) - no shadow pass, the law nativePanel's shadowText
//   already carries. LargeFont (FONT0000) draws them, the same font
//   the quest journal's title uses; the warm is shared with it.
// - the four control buttons, the five target buttons, the five
//   element buttons, the two icon arrows, the icon well and the name
//   strip are INVISIBLE hit rects with hover TIPS - AddTipButton
//   (:365-375), whose tip text is the Internal_Strings row for the
//   button's tag plus " (<hotkey>)" when the shortcut table has one.
//   The tips read from systems/dialogShortcuts.js, which has carried
//   the eighteen SpellMaker* bindings since ROAD-A A8 with nothing
//   consuming them; this window is their consumer.
// - the TIP LOCK is DFU's own quirk, kept (:1039-1058): MouseEnter
//   fires before the previous button's MouseLeave, so moving between
//   two adjacent buttons LOCKS the tip and the leave that follows
//   spends the lock instead of wiping the new text.
// - the SETTINGS EDITOR is its own window on MASK05I0.IMG, eleven
//   UpDownSpinners (up 24x5, value 24x6, down 24x5 inside a 24x16
//   cell), the three panels gated by the effect's support flags, the
//   parchment description panel at (7,19,306,69) and a per-effect
//   spell-point label at (275,119).
//
// WHAT DID NOT MOVE: the law. systems/spellMaker.js is still
// UpdateAllowedButtons, the spinner ranges, the magnitude pair rules,
// the record builder and the purchase ladder; systems/spellEffects.js
// is still the effect-template registry; ui/spellIconPickerWindow.js
// is still SelectIconButton's window and ui/listPicker.js still
// DaggerfallListPickerWindow. This file is the panel, the hit rects
// and the boxes.
//
// RECORDED DEPARTURES, both the house idiom rather than this window's:
//   - the NAME strip pops the port's inline input box (the automap
//     note / travel-map find idiom) where DFU pops a
//     DaggerfallInputMessageBox. Same 31-character cap (TextBox's own
//     default, which RenameItem never narrows), same prompt string.
//     Ledger A carries the widget row already (Port-Ledger.md:686).
//   - a message box whose TEXT.RSC record cannot be read (no ARENA2)
//     falls back to the English of the record, as the rest of the
//     port's windows do. NEVER TRAPS: DFU throws when an effect has
//     no SpellMakerDescription (:262-266); here the parchment simply
//     draws empty.

import {
  loadImg, nativeMetrics, drawImg, drawRect, shadowText, NATIVE_W, NATIVE_H,
} from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { ListPickerWindow, listPickerArtLoaded } from './listPicker.js';
import { SpellIconPickerWindow } from './spellIconPickerWindow.js';   // SelectIconButton's window (:894-898)
import { preloadSpellIcons, drawSpellIcon } from './spellIcons.js';   // the one home for ICON00I0
import { preloadLargeFont, questJournalLargeFont } from './questJournal.js';   // DaggerfallUI.LargeFont = FONT0000, one warm and one home
// Internal_Strings.csv:954 ("enterSpellName" + " ") already has a home:
// the spellbook's own rename box types under the same prompt.
import { ENTER_SPELL_NAME } from './spellbookWindow.js';
import { typedChar } from './input.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  SPELL_MAKER_EFFECTS, spellMakerGroups, spellMakerSubgroups, spellMakerDescriptionId,
} from '../systems/spellEffects.js';
import {
  MAX_EFFECTS_PER_SPELL, MAX_SPELL_NAME, DEFAULT_SPELL_ICON,
  blankEffectSettings, stepSetting, buildCustomSpell, spellMakerCost,
  validateSpellPurchase, purchaseSpell, editedEffectCost,
  NO_SPELLBOOK_ID, SPELLMAKER_NOT_ENOUGH_GOLD_ID, MUST_CHOOSE_NAME_ID,
  SPELL_INSCRIBED_ID, NO_EFFECTS_TEXT,
  updateAllowedButtons, enforceSelected, flagOfIndex,
  DEFAULT_TARGET_INDEX, DEFAULT_ELEMENT_INDEX,
  TARGET_FLAGS_ALL, ELEMENT_FLAGS_MAGIC_ONLY, SPELL_ICON_COUNT,
} from '../systems/spellMaker.js';
import { goldAmount } from '../systems/court.js';
import { firstHotkey, shortcutBinding, sequenceString, normalizeCode } from '../systems/dialogShortcuts.js';

// TargetTypes / ElementTypes in DFU's declaration order, which IS the
// classic rangeType / element index order the record stores.
export const TARGET_LABELS = ['Caster Only', 'By Touch', 'Single Target at Range', 'Area Around Caster', 'Area at Range'];
export const ELEMENT_LABELS = ['Fire', 'Frost', 'Poison', 'Shock', 'Magic'];

/** Every button rect, verbatim (:36-53). INFO01I0 is a full-screen
 *  background, so these are screen-absolute. */
export const SPELL_MAKER_RECTS = Object.freeze({
  addEffect: [244, 114, 28, 28],
  buySpell: [244, 147, 24, 16],
  newSpell: [244, 163, 24, 16],
  exit: [244, 179, 24, 16],
  casterOnly: [275, 114, 24, 16],
  byTouch: [275, 130, 24, 16],
  singleTargetAtRange: [275, 146, 24, 16],
  areaAroundCaster: [275, 162, 24, 16],
  areaAtRange: [275, 178, 24, 16],
  fireBased: [299, 114, 16, 16],
  coldBased: [299, 130, 16, 16],
  poisonBased: [299, 146, 16, 16],
  shockBased: [299, 162, 16, 16],
  magicBased: [299, 178, 16, 16],
  nextIcon: [275, 80, 9, 16],
  previousIcon: [275, 96, 9, 16],
  selectIcon: [288, 94, 16, 16],
  nameSpell: [59, 184, 142, 7],
});

/** The three effect-name panels. DFU declares (3, y, 230, 9) and then
 *  centres each panel (:271, :280, :289), which ASSIGNS x - so the
 *  live rect starts at (320-230)/2 = 45. */
export const EFFECT_PANEL_W = 230;
export const EFFECT_PANEL_X = Math.trunc((NATIVE_W - EFFECT_PANEL_W) / 2);
export const EFFECT_NAME_PANELS = Object.freeze([
  [EFFECT_PANEL_X, 30, EFFECT_PANEL_W, 9],
  [EFFECT_PANEL_X, 62, EFFECT_PANEL_W, 9],
  [EFFECT_PANEL_X, 94, EFFECT_PANEL_W, 9],
]);

/** The live labels (:32, :261-267). */
export const SPELL_MAKER_LABELS = Object.freeze({
  tip: [5, 22],
  maxSpellPoints: [43, 149],
  money: [39, 158],
  goldCost: [59, 167],
  spellPointCost: [70, 176],
  spellName: [60, 185],
});

/** The ten selected-state subrects on the 40x80 MASK01I0 sheet
 *  (:56-65), in target order then element order. */
export const SELECT_SUBRECTS = Object.freeze({
  casterOnly: [0, 0, 24, 16],
  byTouch: [0, 16, 24, 16],
  singleTargetAtRange: [0, 32, 24, 16],
  areaAroundCaster: [0, 48, 24, 16],
  areaAtRange: [0, 64, 24, 16],
  fireBased: [24, 0, 16, 16],
  coldBased: [24, 16, 16, 16],
  poisonBased: [24, 32, 16, 16],
  shockBased: [24, 48, 16, 16],
  magicBased: [24, 64, 16, 16],
});
export const TARGET_BUTTONS = Object.freeze(['casterOnly', 'byTouch', 'singleTargetAtRange', 'areaAroundCaster', 'areaAtRange']);
export const ELEMENT_BUTTONS = Object.freeze(['fireBased', 'coldBased', 'poisonBased', 'shockBased', 'magicBased']);

/** AddTipButton's tag -> the localized string, VERBATIM from DFU's own
 *  en table (StreamingAssets/Text/Master Localization CSV Files/
 *  Internal_Strings.csv :936-955). The port has no localization
 *  table, so the en values stand in for the TextManager lookups -
 *  the same substitution ui/spellIcons.js's descriptions make. */
export const SPELL_MAKER_TIPS = Object.freeze({
  addEffect: 'Add effect',
  buySpell: 'Buy spell',
  newSpell: 'New spell',
  exit: 'Exit',
  casterOnly: 'Caster only',
  byTouch: 'By touch',
  singleTargetAtRange: 'Single target at range',
  areaAroundCaster: 'Area around caster',
  areaAtRange: 'Area at range',
  fireBased: 'Fire based',
  coldBased: 'Cold based',
  poisonBased: 'Poison based',
  shockBased: 'Shock based',
  magicBased: 'Magic based',
  selectIcon: 'Select icon',
  nextIcon: 'Next icon',
  previousIcon: 'Previous icon',
  nameSpell: 'Name spell',
});

/** Each tip button's DaggerfallShortcut.Buttons row (:311-334), which
 *  is where the " (hotkey)" half of the tip comes from. */
export const SPELL_MAKER_SHORTCUTS = Object.freeze({
  addEffect: 'SpellMakerAddEffect',
  buySpell: 'SpellMakerBuySpell',
  newSpell: 'SpellMakerNewSpell',
  exit: 'SpellMakerExit',
  nameSpell: 'SpellMakerNameSpell',
  casterOnly: 'SpellMakerTargetCaster',
  byTouch: 'SpellMakerTargetTouch',
  singleTargetAtRange: 'SpellMakerTargetSingleAtRange',
  areaAroundCaster: 'SpellMakerTargetAroundCaster',
  areaAtRange: 'SpellMakerTargetAreaAtRange',
  fireBased: 'SpellMakerElementFire',
  coldBased: 'SpellMakerElementCold',
  poisonBased: 'SpellMakerElementPoison',
  shockBased: 'SpellMakerElementShock',
  magicBased: 'SpellMakerElementMagic',
  nextIcon: 'SpellMakerNextIcon',
  previousIcon: 'SpellMakerPrevIcon',
  selectIcon: 'SpellMakerSelectIcon',
});

/** The classic records the window's five boxes read (:704, :737-740).
 *  The English is the record's own, from Internal_RSC.csv - the
 *  fallback when TEXT.RSC is not readable. */
export const SPELL_MAKER_TEXT = Object.freeze({
  1702: ['You do not have enough gold', 'to purchase this spell.'],
  1703: ['You do not have a spellbook', 'with which to inscribe this spell.'],
  1704: ['You must choose a name to call', 'this spell in your grimoire.'],
  1705: ['The spell has been inscribed', 'in your grimoire.'],
  1707: ['You can choose no more than three', 'effects for any spell.'],
  1708: ['How would you like to alter the spell?'],
});
export const NO_MORE_THAN_3_EFFECTS_ID = 1707;
export const HOW_TO_ALTER_SPELL_ID = 1708;

// ---- the settings editor's own metrics ------------------------------
/** UpDownSpinner's three parts inside a 24x16 cell (:28-30), and the
 *  eleven cells (:31-41) + the exit button (:43). */
export const SPINNER_W = 24, SPINNER_H = 16;
export const SPINNER_UP = Object.freeze([0, 0, SPINNER_W, 5]);
export const SPINNER_VALUE = Object.freeze([0, 5, SPINNER_W, 6]);
export const SPINNER_DOWN = Object.freeze([0, 11, SPINNER_W, 5]);
export const EDITOR_RECTS = Object.freeze({
  durationBase: [64, 94, SPINNER_W, SPINNER_H],
  durationMod: [104, 94, SPINNER_W, SPINNER_H],
  durationPerLevel: [160, 94, SPINNER_W, SPINNER_H],
  chanceBase: [64, 114, SPINNER_W, SPINNER_H],
  chanceMod: [104, 114, SPINNER_W, SPINNER_H],
  chancePerLevel: [160, 114, SPINNER_W, SPINNER_H],
  magnitudeBaseLow: [64, 134, SPINNER_W, SPINNER_H],
  magnitudeBaseHigh: [104, 134, SPINNER_W, SPINNER_H],
  magnitudeLevelBase: [144, 134, SPINNER_W, SPINNER_H],
  magnitudeLevelHigh: [184, 134, SPINNER_W, SPINNER_H],
  magnitudePerLevel: [235, 134, SPINNER_W, SPINNER_H],
  exit: [281, 94, 24, 16],
});
/** Which support flag gates each spinner (InitControlState, :268-315). */
export const EDITOR_COMPONENT = Object.freeze({
  durationBase: 'duration', durationMod: 'duration', durationPerLevel: 'duration',
  chanceBase: 'chance', chanceMod: 'chance', chancePerLevel: 'chance',
  magnitudeBaseLow: 'magnitude', magnitudeBaseHigh: 'magnitude',
  magnitudeLevelBase: 'magnitude', magnitudeLevelHigh: 'magnitude',
  magnitudePerLevel: 'magnitude',
});
/** The description parchment: parent (5,19,312,69) centred (:168-170)
 *  puts it at x4, and the 306-wide child centred inside that at x7
 *  (:172-177). The spell-point label is at (275,119) (:148). */
export const EDITOR_DESCRIPTION_PANEL = Object.freeze([7, 19, 306, 69]);
export const EDITOR_COST_LABEL = Object.freeze([275, 119]);

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
/** A spinner part's absolute rect: the part is declared relative to
 *  the cell (UpDownSpinner's own ctor takes them that way). */
export const spinnerPart = ([cx, cy], [px, py, pw, ph]) => [cx + px, cy + py, pw, ph];

let _art = null;          // INFO01I0
let _select = null;       // MASK01I0
let _editorArt = null;    // MASK05I0
export async function preloadSpellMakerArt(deps) {
  // The icons and the large font are shared warms - the icon well
  // draws through ui/spellIcons.js and the effect rows through
  // DaggerfallUI.LargeFont, and both already have one home.
  preloadSpellIcons(deps).catch(() => {});
  preloadLargeFont(deps).catch(() => {});
  if (_art) return;
  try {
    _art = await loadImg(deps, 'INFO01I0.IMG');
    _select = await loadImg(deps, 'MASK01I0.IMG');
    _editorArt = await loadImg(deps, 'MASK05I0.IMG');
  } catch { console.warn('[spellmaker] INFO01I0 unavailable; the spell maker stays closed'); }
}
export const spellMakerArtLoaded = () => !!_art && !!_select && !!_editorArt;
export function _setSpellMakerArtForTests(art, select, editor) {
  _art = art; _select = select; _editorArt = editor;
}

/** MASK01I0's own size (selectedIconsBaseSize, :30) - the subrects
 *  above are measured against it, so a sheet of any other size is
 *  mapped through it rather than through its own dimensions. */
export const SELECT_SHEET = Object.freeze({ w: 40, h: 80 });
function drawSelectMark(renderer, m, key, rect) {
  if (!_select) return;
  const [sx, sy, sw, sh] = SELECT_SUBRECTS[key];
  renderer.drawScreenQuad(_select.tex,
    { x: m.ox + rect[0] * m.s, y: m.oy + rect[1] * m.s, w: sw * m.s, h: sh * m.s },
    {
      u0: sx / SELECT_SHEET.w, v0: sy / SELECT_SHEET.h,
      u1: (sx + sw) / SELECT_SHEET.w, v1: (sy + sh) / SELECT_SHEET.h,
    });
}

/**
 * DaggerfallEffectSettingsEditorWindow, whole. It edits the SLOT's own
 * settings object in place, which is what DFU's
 * `effectEntries[editOrDeleteSlot] = effectEditor.EffectEntry` at
 * UpdateSpellCosts (:352-353) achieves the long way round.
 *
 * deps: { slot, effect, entity, rows, onSettingsChanged, onClose }
 */
export class EffectSettingsEditorWindow {
  constructor(deps) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;
    this._boxLayout = null;
  }

  /** InitControlState's three gates (:268-315): a spinner whose
   *  component the effect does not support is Enabled = false, and a
   *  disabled BaseScreenComponent is neither drawn nor clickable. */
  enabled(field) {
    const comp = EDITOR_COMPONENT[field];
    return !!this.deps.effect?.[comp];
  }

  /** UpdateCosts (:373-381) - the ONE effect's spell-point cost, with
   *  no target multiplier and no 5-point floor. */
  cost() { return editedEffectCost(this.deps.slot, this.deps.entity).sp; }

  /** SpellMakerDescription's tokens for this effect, or [] where the
   *  record cannot be read. DFU throws on an empty set (:262-266);
   *  the port draws an empty parchment (never traps). */
  descriptionRows() {
    const id = spellMakerDescriptionId(this.deps.effect?.key ?? '');
    if (id == null) return [];
    return this.deps.rows?.(id) ?? [];
  }

  _step(field, delta) {
    if (!this.enabled(field)) return;
    const slot = this.deps.slot;
    if (!slot) return;
    slot.settings = stepSetting(slot.settings ?? blankEffectSettings(), field, delta);
    this.deps.onSettingsChanged?.();   // OnValueChanged -> UpdateCosts (:409-470)
  }

  _close() {
    if (this.done) return;
    this.done = true;
    this.deps.onClose?.();
  }

  input(code) {
    if (normalizeCode(code) === 'Escape') { this._close(); return; }
  }

  click(vx, vy) {
    for (const [field, cell] of Object.entries(EDITOR_RECTS)) {
      if (field === 'exit') continue;
      if (!this.enabled(field)) continue;
      if (inRect(spinnerPart(cell, SPINNER_UP), vx, vy)) { this._step(field, 1); return true; }
      if (inRect(spinnerPart(cell, SPINNER_DOWN), vx, vy)) { this._step(field, -1); return true; }
    }
    // ExitButton_OnMouseClick (:475-478) - CloseWindow, no sound of
    // its own (the spinners are silent too; UpDownSpinner assigns none)
    if (inRect(EDITOR_RECTS.exit, vx, vy)) { this._close(); return true; }
    return true;   // the background is the whole screen
  }

  draw(renderer, canvas, font) {
    if (!_editorArt) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // NativePanel.BackgroundColor = new Color(0, 0, 0, 0.65f) (:140)
    drawRect(renderer, m, 0, 0, NATIVE_W, NATIVE_H, [0, 0, 0, 0.65]);
    drawImg(renderer, _editorArt, m, 0, 0);

    const slot = this.deps.slot;
    for (const [field, cell] of Object.entries(EDITOR_RECTS)) {
      if (field === 'exit' || !this.enabled(field)) continue;
      const value = String(slot?.settings?.[field] ?? 0);
      const [vx, vy, vw] = spinnerPart(cell, SPINNER_VALUE);
      shadowText(renderer, font, value, m, vx, vy, { align: 'center', w: vw });
    }
    shadowText(renderer, font, String(this.cost()), m, EDITOR_COST_LABEL[0], EDITOR_COST_LABEL[1]);

    // The parchment. SetupEffectDescriptionPanels (:175-193) is a FIXED
    // Rect, not a DaggerfallMessageBox: the panel is 306x69 at (7,19)
    // and only the MultiFormatTextLabel inside it is Center/Middle. It
    // sits ABOVE the first spinner row (durationBase, y94) - an
    // auto-sized, screen-centred box lands on top of the spinners.
    const rows = this.descriptionRows();
    this._boxLayout = layoutMessageBox(font, rows, [], { rect: EDITOR_DESCRIPTION_PANEL });
    // ...and it draws even with no rows: the recorded never-traps line
    // is an EMPTY parchment where DFU throws (:262-266), not no panel.
    drawMessageBox(renderer, m, font, this._boxLayout);
  }
}

/**
 * DaggerfallSpellMakerWindow.
 *
 * deps: { entity, rows(id) -> [{text, center}], onClose }
 */
export class SpellMakerWindow {
  constructor({ entity, rows = null, onClose = null } = {}) {
    this.entity = entity;
    this.rows = rows;
    this.onClose = onClose;
    this.done = false;
    this.isChoiceWindow = true;
    this.iconPicker = null;
    this._reset();
  }

  /** OnPush = InitEffectSlots + SetDefaults (:190-220). */
  _reset() {
    this.slots = [null, null, null];
    this.allowedTargets = TARGET_FLAGS_ALL;
    this.allowedElements = ELEMENT_FLAGS_MAGIC_ONLY;
    this.rangeType = DEFAULT_TARGET_INDEX;
    this.element = DEFAULT_ELEMENT_INDEX;
    this.icon = DEFAULT_SPELL_ICON;
    this.name = '';
    this.editOrDeleteSlot = -1;
    this.totalGoldCost = 0;
    this.totalSpellPointCost = 0;
    this.tip = '';
    this.lockTip = false;
    this._hot = null;
    this._mouse = [-1, -1];
    this.picker = null;
    this.editor = null;
    this.box = null;
    this._boxLayout = null;
    this.naming = false;
    this._updateAllowedButtons();
  }

  _close() {
    if (this.done) return;
    this.done = true;
    this.onClose?.();
  }

  // ---- the law, unchanged -------------------------------------------
  /** UpdateAllowedButtons (:561-603) through the shared law. */
  _updateAllowedButtons() {
    const { targets, elements, forced } = updateAllowedButtons(this.slots);
    this.allowedTargets = targets;
    this.allowedElements = elements;
    if (forced) {
      // the default arm CALLS SetSpellTarget/SetSpellElement (:564-570)
      this.rangeType = DEFAULT_TARGET_INDEX;
      this.element = DEFAULT_ELEMENT_INDEX;
    } else {
      this.rangeType = enforceSelected(this.rangeType, targets);
      this.element = enforceSelected(this.element, elements);
    }
    this._updateSpellCosts();
  }

  usedSlots() { return this.slots.filter(Boolean); }
  firstFreeSlot() { return this.slots.findIndex((s) => !s); }

  /** UpdateSpellCosts (:346-360). THE EMPTY-SHEET QUIRK IS DFU's:
   *  with no used slots it returns BEFORE CalculateTotalEffectCosts,
   *  so the labels read 0 and 0 - not the 5-point casting floor that
   *  formula would impose ("Daggerfall shows gold cost 0 and
   *  spellpoint cost 5 with no effects added... not copying this
   *  behaviour at this time intentionally", :338-341). */
  _updateSpellCosts() {
    if (this.usedSlots().length === 0) {
      this.totalGoldCost = 0;
      this.totalSpellPointCost = 0;
      return;
    }
    const { gold, sp } = spellMakerCost(this._spell(), this.entity);
    this.totalGoldCost = gold;
    this.totalSpellPointCost = sp;
  }

  _spell() {
    return buildCustomSpell({
      slots: this.slots, rangeType: this.rangeType, element: this.element,
      name: this.name, icon: this.icon, index: -1,   // a throwaway index; the BOUGHT spell mints a real one
    });
  }

  effectOf(slot) { return slot ? SPELL_MAKER_EFFECTS.find((e) => e.key === slot.key) ?? null : null; }

  /** SetStatusLabels (:354-360). moneyLabel is PlayerEntity.GoldPieces
   *  - COINS ONLY - while BuyButton tests GetGoldAmount(), which
   *  counts letters of credit too (:748). DFU's own asymmetry, kept. */
  labels() {
    return {
      maxSpellPoints: String(this.entity?.maxMagicka ?? 0),
      money: String(goldAmount(this.entity)),
      goldCost: String(this.totalGoldCost),
      spellPointCost: String(this.totalSpellPointCost),
      spellName: this.name,
    };
  }

  // ---- boxes ---------------------------------------------------------
  /** A TEXT.RSC box, or the record's own English when the file is not
   *  readable here. */
  _box(id, { buttons = null, onButton = null, onCancel = null, onDismiss = null } = {}) {
    const live = this.rows?.(id);
    const rows = live?.length ? live : (SPELL_MAKER_TEXT[id] ?? []).map((text) => ({ text, center: true }));
    this.box = { rows, buttons, onButton, onCancel, onDismiss };
  }

  _sayText(text) { this.box = { rows: [{ text, center: true }], buttons: null }; }

  _dismissBox(button = null) {
    const b = this.box;
    this.box = null;
    if (!b) return;
    if (b.buttons) {
      if (button === null) b.onCancel?.();
      else b.onButton?.(button);
      return;
    }
    b.onDismiss?.();
  }

  // ---- the buttons ---------------------------------------------------
  /** AddEffectButton_OnMouseClick (:703-733). */
  _addEffect() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (this.firstFreeSlot() === -1) { this._box(NO_MORE_THAN_3_EFFECTS_ID); return; }
    this.tip = '';                                   // tipLabel.Text = string.Empty (:719)
    const groups = spellMakerGroups();
    this.picker = new ListPickerWindow({
      items: groups,
      selectedIndex: 0,                              // ListBox.SelectedIndex = 0 (:727)
      onPick: (i) => this._pickGroup(groups[i]),
      onCancel: () => { this.picker = null; },
    });
  }

  /** AddEffectGroupListBox_OnUseSelectedItem (:934-969). */
  _pickGroup(group) {
    const subs = spellMakerSubgroups(group);
    if (subs.length === 1 && !subs[0].subgroup) {
      // "If this is a solo effect without any subgroups names defined
      // (e.g. "Regenerate") then go straight to effect editor" (:945)
      this.picker = null;
      this._addAndEditSlot(subs[0]);
      return;
    }
    this.picker = new ListPickerWindow({
      items: subs.map((e) => e.subgroup),
      selectedIndex: 0,
      onPick: (i) => { this.picker = null; this._addAndEditSlot(subs[i]); },
      // "allows user to hit escape and return to effect group list,
      // unlike classic which dumps whole spellmaker UI" (:299-300)
      onCancel: () => { this.picker = null; this._addEffectNoSound(); },
    });
  }

  /** The group picker reopened by the subgroup picker's Escape - the
   *  same window, without AddEffectButton's click sound. */
  _addEffectNoSound() {
    const groups = spellMakerGroups();
    this.picker = new ListPickerWindow({
      items: groups,
      selectedIndex: 0,
      onPick: (i) => this._pickGroup(groups[i]),
      onCancel: () => { this.picker = null; },
    });
  }

  /** AddAndEditSlot (:424-433). */
  _addAndEditSlot(effect) {
    const slot = this.firstFreeSlot();
    if (slot === -1) return;
    this.slots[slot] = {
      type: effect.type, subType: effect.subType, key: effect.key,
      // SetEffectTemplate -> SetSpinners(new EffectSettings()) (:388-392):
      // a fresh template starts every spinner at its own range floor.
      settings: blankEffectSettings(),
    };
    this._updateAllowedButtons();
    this.editOrDeleteSlot = slot;
    this._openEditor(slot);
  }

  _openEditor(slot) {
    const s = this.slots[slot];
    this.editor = new EffectSettingsEditorWindow({
      slot: s,
      effect: this.effectOf(s),
      entity: this.entity,
      rows: this.rows,
      onSettingsChanged: () => this._updateSpellCosts(),
      // EffectEditor_OnClose (:997-1001)
      onClose: () => { this.editor = null; this.editOrDeleteSlot = -1; this._updateAllowedButtons(); },
    });
  }

  /** EditOrDeleteSlot (:435-455) - the 1708 box with Edit and Delete. */
  _editOrDeleteSlot(slot) {
    if (!this.slots[slot]) return;   // "Do nothing if slot not set" (:439-440)
    this.editOrDeleteSlot = slot;
    this._box(HOW_TO_ALTER_SPELL_ID, {
      buttons: [MB_BUTTONS.Edit, MB_BUTTONS.Delete],
      onButton: (b) => {
        if (b === MB_BUTTONS.Delete) {
          // DeleteButton_OnMouseClick (:980-986)
          audio.playOneShot(SOUND.ButtonClick, 1);
          this._clearPendingDeleteSlot();
          this._updateSpellCosts();
        } else {
          // EditButton_OnMouseClick (:988-992)
          this._openEditor(this.editOrDeleteSlot);
        }
      },
      // EditOrDeleteSpell_OnCancel (:971-974)
      onCancel: () => { this.editOrDeleteSlot = -1; },
    });
  }

  /** ClearPendingDeleteEffectSlot (:391-400). */
  _clearPendingDeleteSlot() {
    if (this.editOrDeleteSlot === -1) return;
    this.slots[this.editOrDeleteSlot] = null;
    this.editOrDeleteSlot = -1;
    this._updateAllowedButtons();
  }

  /** SetSpellTarget (:487-521) - an illegal bit returns EARLY, so the
   *  button is inert rather than refusing out loud. */
  _setTarget(index) {
    if (!(this.allowedTargets & flagOfIndex(index))) return;
    this.rangeType = index;
    this._updateSpellCosts();   // SetSpellTarget ends in UpdateSpellCosts (:520)
  }

  /** SetSpellElement (:523-556) - the same gate, and NO cost update
   *  (the element does not price a spell). */
  _setElement(index) {
    if (!(this.allowedElements & flagOfIndex(index))) return;
    this.element = index;
  }

  /** NextIconButton (:875-884) / PreviousIconButton (:900-908). */
  _stepIcon(dir) {
    let index = this.icon + dir;
    if (index >= SPELL_ICON_COUNT) index = 0;
    if (index < 0) index = SPELL_ICON_COUNT - 1;
    this.icon = index;
    audio.playOneShot(SOUND.ButtonClick, 1);
  }

  /** SelectIconButton_OnMouseClick (:886-890) + IconPicker_OnClose
   *  (:1013-1017): a null pick keeps the icon. The picker instance is
   *  kept because SpellHasBeenInscribed_OnClose resets ITS scroll. */
  _openIconPicker() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.iconPicker = new SpellIconPickerWindow({
      onClose: (icon) => { this.picker = null; if (icon) this.icon = icon.index % SPELL_ICON_COUNT; },
    });
    this.picker = this.iconPicker;
  }

  /** BuyButton_OnMouseClick (:735-800), the ladder in DFU's order. */
  _buy() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const check = validateSpellPurchase({
      entity: this.entity, slots: this.slots, goldCost: this.totalGoldCost, name: this.name,
    });
    if (!check.ok) {
      if (check.textId) this._box(check.textId);
      else this._sayText(check.text ?? NO_EFFECTS_TEXT);
      return;
    }
    const spell = buildCustomSpell({
      slots: this.slots, rangeType: this.rangeType, element: this.element,
      name: this.name.trim(), icon: this.icon,
    });
    purchaseSpell(this.entity, spell, this.totalGoldCost);
    audio.playOneShot(SOUND.ParchmentScratching, 1);   // inscribeGrimoire (:136)
    // "Notify player and exit when this messagebox is dismissed"
    // (:790-795) - SpellHasBeenInscribed_OnClose is SetDefaults plus
    // the icon picker's ResetScrollPosition (:802-806).
    this._box(SPELL_INSCRIBED_ID, {
      onDismiss: () => {
        const keep = this.onClose;
        const picker = this.iconPicker;
        this._reset();
        this.onClose = keep;
        this.iconPicker = picker;
        picker?.resetScrollPosition();
      },
    });
  }

  /** NewSpellButton_OnMouseClick (:808-812) - SetDefaults, which does
   *  NOT touch the icon picker's scroll. */
  _newSpell() {
    const keep = this.onClose;
    const picker = this.iconPicker;
    this._reset();
    this.onClose = keep;
    this.iconPicker = picker;
    audio.playOneShot(SOUND.ButtonClick, 1);
  }

  /** NameSpellButton_OnMouseClick (:910-918). */
  _openNameBox() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.naming = true;
  }

  // ---- tips ----------------------------------------------------------
  /** The tip for a button: the localized string plus " (<hotkey>)"
   *  when the shortcut table carries one (:1043-1051). */
  tipFor(key) {
    const text = SPELL_MAKER_TIPS[key] ?? '';
    const seq = shortcutBinding(SPELL_MAKER_SHORTCUTS[key]);
    return seq?.code ? `${text} (${sequenceString(seq)})` : text;
  }

  /** TipButton_OnMouseEnter/Leave (:1039-1066). Unity raises the NEW
   *  button's Enter before the OLD button's Leave, which is what the
   *  lock exists for - "changing directly to adjacent button". */
  _setHot(now) {
    const prev = this._hot;
    if (now === prev) return;
    if (now) {
      if (this.tip) this.lockTip = true;
      this.tip = this.tipFor(now);
    }
    if (prev) {
      if (!this.lockTip) this.tip = '';
      else this.lockTip = false;
    }
    this._hot = now;
  }

  buttonAt(vx, vy) {
    for (const [key, rect] of Object.entries(SPELL_MAKER_RECTS)) {
      if (inRect(rect, vx, vy)) return key;
    }
    return null;
  }

  // ---- host seams ----------------------------------------------------
  hover(vx, vy, e = null) {
    this._mouse = [vx, vy];
    if (this.picker) { this.picker.hover?.(vx, vy, e); return; }
    if (this.editor || this.box || this.naming) return;
    this._setHot(this.buttonAt(vx, vy));
  }

  /** ROAD-E E1, on the class that OWNS the picker: the button-up drops
   *  the thumb-drag latch (VerticalScrollBar.Update's else arm,
   *  listPicker.js:123-129), instead of it surviving until the next
   *  hover whose buttons bit happens to be clear. The call is optional
   *  on `release` as well as on `picker` because `_openIconPicker`
   *  (:679) parks a SpellIconPickerWindow here, and that window scrolls
   *  by index with no drag latch to drop. */
  release() { this.picker?.release?.(); }

  wheel(dir) {
    if (this.picker) { this.picker.wheel?.(dir); return; }
  }

  input(code, e = null) {
    if (this.picker) {
      this.picker.input(code, e);
      if (this.picker?.done || this.picker?.closed) this.picker = null;
      return;
    }
    if (this.naming) { this._nameInput(code, e); return; }
    if (this.box) {
      const c = normalizeCode(code, e);
      if (this.box.buttons) { if (c === 'Escape') this._dismissBox(null); }
      else this._dismissBox();
      return;
    }
    if (this.editor) {
      this.editor.input(code, e);
      if (this.editor?.done) this.editor = null;
      return;
    }
    if (normalizeCode(code, e) === 'Escape') { this._close(); return; }
    // A8's shortcut table, finally consumed: every one of DFU's
    // eighteen SpellMaker* bindings fires its button's own handler.
    const keys = Object.keys(SPELL_MAKER_RECTS);
    const hit = firstHotkey(keys.map((k) => SPELL_MAKER_SHORTCUTS[k]), code, e);
    if (hit) {
      const key = keys.find((k) => SPELL_MAKER_SHORTCUTS[k] === hit);
      if (key) this._press(key);
    }
  }

  /** DaggerfallInputMessageBox's keyboard, at MaxCharacters 31. */
  _nameInput(code, e) {
    const c = normalizeCode(code, e);
    if (c === 'Enter') { this.naming = false; return; }   // EnterName_OnGotUserInput (:1030-1033)
    if (c === 'Escape') { this.naming = false; return; }
    if (c === 'Backspace') { this.name = this.name.slice(0, -1); return; }
    const ch = typedChar(code, e);
    if (ch && this.name.length < MAX_SPELL_NAME) this.name += ch;
  }

  /** One door for a button, whichever way it was pressed. */
  _press(key) {
    switch (key) {
      case 'addEffect': this._addEffect(); return;
      case 'buySpell': this._buy(); return;
      case 'newSpell': this._newSpell(); return;
      case 'exit': audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return;
      case 'nameSpell': this._openNameBox(); return;
      case 'nextIcon': this._stepIcon(1); return;
      case 'previousIcon': this._stepIcon(-1); return;
      case 'selectIcon': this._openIconPicker(); return;
      default: break;
    }
    const t = TARGET_BUTTONS.indexOf(key);
    if (t >= 0) { this._setTarget(t); audio.playOneShot(SOUND.ButtonClick, 1); return; }
    const el = ELEMENT_BUTTONS.indexOf(key);
    if (el >= 0) { this._setElement(el); audio.playOneShot(SOUND.ButtonClick, 1); }
  }

  click(vx, vy) {
    if (this.picker) {
      this.picker.click(vx, vy);
      if (this.picker?.done || this.picker?.closed) this.picker = null;
      return true;
    }
    if (this.naming) { this.naming = false; return true; }
    if (this.box) {
      if (this.box.buttons) {
        const hit = this._boxLayout ? messageBoxHit(this._boxLayout, vx, vy) : null;
        if (hit !== null) this._dismissBox(hit);
      } else this._dismissBox();
      return true;
    }
    if (this.editor) {
      this.editor.click(vx, vy);
      if (this.editor?.done) this.editor = null;
      return true;
    }
    // the three effect rows (Effect1/2/3NamePanel_OnMouseClick, :1019-1028)
    for (let i = 0; i < MAX_EFFECTS_PER_SPELL; i++) {
      if (inRect(EFFECT_NAME_PANELS[i], vx, vy)) { this._editOrDeleteSlot(i); return true; }
    }
    const key = this.buttonAt(vx, vy);
    if (key) this._press(key);
    return true;   // the background is the whole screen
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // ParentPanel.BackgroundColor = ScreenDimColor (:169), which for a
    // DaggerfallPopupWindow is Color.clear - the room stays visible.
    drawScreenDimBackdrop(renderer, canvas);
    // NativePanel.BackgroundColor = new Color(0, 0, 0, 0.75f) (:172)
    drawRect(renderer, m, 0, 0, NATIVE_W, NATIVE_H, [0, 0, 0, 0.75]);
    drawImg(renderer, _art, m, 0, 0);

    // the selected target and element marks, drawn back over the base
    drawSelectMark(renderer, m, TARGET_BUTTONS[this.rangeType], SPELL_MAKER_RECTS[TARGET_BUTTONS[this.rangeType]]);
    drawSelectMark(renderer, m, ELEMENT_BUTTONS[this.element], SPELL_MAKER_RECTS[ELEMENT_BUTTONS[this.element]]);
    // ...and the icon well, whose background IS the chosen icon
    drawSpellIcon(renderer, m, this.icon, SPELL_MAKER_RECTS.selectIcon);

    const L = this.labels();
    shadowText(renderer, font, this.tip, m, SPELL_MAKER_LABELS.tip[0], SPELL_MAKER_LABELS.tip[1]);
    for (const key of ['maxSpellPoints', 'money', 'goldCost', 'spellPointCost']) {
      shadowText(renderer, font, L[key], m, SPELL_MAKER_LABELS[key][0], SPELL_MAKER_LABELS[key][1]);
    }
    // spellNameLabel.ShadowPosition = Vector2.zero (:266)
    shadowText(renderer, font, L.spellName + (this.naming ? '_' : ''),
      m, SPELL_MAKER_LABELS.spellName[0], SPELL_MAKER_LABELS.spellName[1], { shadowOffset: 0 });

    // the three effect rows: LargeFont, centred, no shadow (:272-276)
    const big = questJournalLargeFont() ?? font;
    for (let i = 0; i < MAX_EFFECTS_PER_SPELL; i++) {
      const eff = this.effectOf(this.slots[i]);
      if (!eff) continue;
      const [px, py, pw] = EFFECT_NAME_PANELS[i];
      shadowText(renderer, big, eff.name, m, px, py, { align: 'center', w: pw, shadowOffset: 0 });
    }

    if (this.naming) {
      const entry = `${ENTER_SPELL_NAME}${this.name}_`;
      const box = layoutMessageBox(font, [{ text: entry, center: false }], [],
        { sizingRows: [`${ENTER_SPELL_NAME}${'M'.repeat(MAX_SPELL_NAME)}_`] });
      drawMessageBox(renderer, m, font, box);
      return;
    }
    if (this.editor) { this.editor.draw(renderer, canvas, font); return; }
    if (this.picker && (this.picker !== this.iconPicker ? listPickerArtLoaded() : true)) {
      this.picker.draw(renderer, canvas, font);
      return;
    }
    if (this.box) {
      this._boxLayout = layoutMessageBox(font, this.box.rows, this.box.buttons ?? []);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}

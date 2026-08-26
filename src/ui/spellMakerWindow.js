// S1: THE SPELL MAKER WINDOW - DaggerfallSpellMakerWindow.cs +
// DaggerfallEffectSettingsEditorWindow.cs (MIT, Daggerfall Workshop)
// in the port's keyed-overlay idiom. VERBATIM: the three effect
// slots, the group -> subgroup picker walk (a group whose single
// effect has no subgroup skips straight to the editor), the spinner
// ranges and the magnitude pair rules, the live gold + spell-point
// totals recomputed on every change, the five targets and five
// elements, the purchase ladder in DFU's order, and the window
// RESETTING for another spell after a successful inscribe rather
// than closing.
//
// DEPARTURES (recorded): DFU's window is native INFO01I0.IMG art
// with invisible hit-buttons, hover tips, an icon picker over
// ICON00I0's 69 icons, and modal message boxes; this is a keyed
// text window - one cursor, ENTER to act, in the travelMap/automap
// idiom the port's other map-and-list windows use. The icon is kept
// on the record (the runtime does not draw spell icons anywhere yet,
// so a picker would choose an invisible thing) at the default 1.
// Refusals show as an inline notice line rather than a modal box.
// The INERT MARK is the port's own: effects whose runtime arm is not
// ported are listed with a bullet, so nobody spends gold on a spell
// that cannot fire (systems/spellEffects.js records why).

import { drawText } from './text.js';
import { typedChar } from './input.js';
import {
  SPELL_MAKER_EFFECTS, spellMakerGroups, spellMakerSubgroups, effectByKey,
  targetFlag, TARGET_FLAGS_ALL,
} from '../systems/spellEffects.js';
import {
  MAX_EFFECTS_PER_SPELL, MAX_SPELL_NAME, DEFAULT_SPELL_ICON,
  blankEffectSettings, stepSetting, buildCustomSpell, spellMakerCost,
  validateSpellPurchase, purchaseSpell, NO_SPELLBOOK_ID,
  SPELLMAKER_NOT_ENOUGH_GOLD_ID, MUST_CHOOSE_NAME_ID,
} from '../systems/spellMaker.js';
import { goldAmount } from '../systems/court.js';
import { MAGIC_ONLY_KEYS } from '../systems/effects.js';

// TargetTypes / ElementTypes in DFU's declaration order, which IS the
// classic rangeType / element index order the record stores.
export const TARGET_LABELS = ['Caster Only', 'By Touch', 'Single Target at Range', 'Area Around Caster', 'Area at Range'];
export const ELEMENT_LABELS = ['Fire', 'Frost', 'Poison', 'Shock', 'Magic'];

/** ElementTypes as FLAGS (MagicAndEffectsEnums.cs:36-44) - Fire 1,
 *  Cold 2, Poison 4, Shock 8, Magic 16, which is 1 << the index the
 *  record stores, and EntityEffectBroker's two element sets
 *  (:46-48). */
export const elementFlag = (index) => 1 << index;
export const ELEMENT_FLAGS_MAGIC_ONLY = elementFlag(4);
export const ELEMENT_FLAGS_ALL = 0b11111;

/** UpdateAllowedButtons' ELEMENT half (:575-590): allowedElements
 *  starts at ElementFlags_MagicOnly and takes the MOST permissive
 *  union of every chosen effect's own AllowedElements - "magic always
 *  allowed". Each effect class is either ElementFlags_MagicOnly or
 *  ElementFlags_All, and which is which is the set systems/effects.js
 *  already reads off those classes (MAGIC_ONLY_KEYS) - imported, not
 *  restated. With no effect chosen the defaults arm (:565-570) leaves
 *  the same ElementFlags_MagicOnly. */
export const allowedElementsFor = (slots) => (slots ?? []).reduce(
  (allowed, slot) => (slot?.key
    ? allowed | (MAGIC_ONLY_KEYS.has(slot.key) ? ELEMENT_FLAGS_MAGIC_ONLY : ELEMENT_FLAGS_ALL)
    : allowed),
  ELEMENT_FLAGS_MAGIC_ONLY);

/** UpdateAllowedButtons' TARGET half (:575-586), which runs the OTHER
 *  WAY from the element half beside it: allowedTargets starts at
 *  TargetFlags_All and takes the LEAST permissive INTERSECTION of
 *  every chosen effect's own Properties.AllowedTargets, so each added
 *  effect can only narrow the five buttons - "least permissive result
 *  set from combined target flags". Which set each effect class
 *  carries is the `targets` column of systems/spellEffects.js, read
 *  off those classes' SetProperties. With no effect chosen the
 *  defaults arm (:565-570) leaves defaultTargetFlags, which IS
 *  TargetFlags_All (:133). */
export const allowedTargetsFor = (slots) => (slots ?? []).reduce(
  (allowed, slot) => (slot?.key ? allowed & (effectByKey(slot.key)?.targets ?? TARGET_FLAGS_ALL) : allowed),
  TARGET_FLAGS_ALL);

const SPINNER_ROWS = {
  duration: [['durationBase', 'Base'], ['durationMod', 'Plus'], ['durationPerLevel', 'Per level']],
  chance: [['chanceBase', 'Base'], ['chanceMod', 'Plus'], ['chancePerLevel', 'Per level']],
  magnitude: [['magnitudeBaseLow', 'Base min'], ['magnitudeBaseHigh', 'Base max'],
    ['magnitudeLevelBase', 'Plus min'], ['magnitudeLevelHigh', 'Plus max'], ['magnitudePerLevel', 'Per level']],
};
const GOLD = [0.85, 0.72, 0.35, 1];
const WHITE = [0.9, 0.9, 0.85, 1];
const HOT = [1, 0.95, 0.6, 1];
const DIM = [0.5, 0.5, 0.45, 1];
const WARN = [0.95, 0.55, 0.45, 1];
// The refusal lines. DFU shows classic records 1702-1704 in message
// boxes; the port has no TEXT.RSC reader wired here, so the window
// carries the English of each record (recorded).
const REFUSALS = {
  [NO_SPELLBOOK_ID]: 'You have no spellbook to inscribe.',
  [SPELLMAKER_NOT_ENOUGH_GOLD_ID]: 'You do not have enough gold.',
  [MUST_CHOOSE_NAME_ID]: 'You must choose a name for this spell.',
};

export class SpellMakerWindow {
  /** deps: { entity, onClose } */
  constructor({ entity, onClose = null } = {}) {
    this.entity = entity;
    this.onClose = onClose;
    this.done = false;
    this.reset();
  }

  /** SetDefaults: three blank slots, CasterOnly, Magic, no name. */
  reset() {
    this.slots = [null, null, null];
    this.rangeType = 0;      // CasterOnly
    this.element = 4;        // ElementFlags_MagicOnly is DFU's default
    this.name = '';
    this.icon = DEFAULT_SPELL_ICON;
    this.mode = 'main';
    this.cursor = 0;
    this.notice = '';
    this.pickGroup = null;
    this.pickCursor = 0;
    this.editSlot = -1;
    this.editCursor = 0;
  }

  /** SetSpellTarget (:488-492): a target the chosen effects do not
   *  allow is simply NOT TAKEN - DFU's button does nothing at all,
   *  rather than stepping past it. */
  _setTarget(index) {
    if ((allowedTargetsFor(this.slots) & targetFlag(index)) === 0) return;
    this.rangeType = index;
  }

  /** SetSpellElement (:525-530): an element the chosen effects do not
   *  allow is simply NOT TAKEN - DFU's button does nothing at all,
   *  rather than stepping past it. */
  _setElement(index) {
    if ((allowedElementsFor(this.slots) & elementFlag(index)) === 0) return;
    this.element = index;
  }

  /** UpdateAllowedButtons (:561-596) at each of DFU's four call sites
   *  (:226 SetDefaults, :338 Setup, :396 ClearPendingDeleteEffectSlot,
   *  :462 AddAndEditSlot), through EnforceSelectedButtons (:597-603):
   *  a selection the new allowed set no longer holds falls back to
   *  SelectFirstAllowedTargetType (:606-633), which walks CasterOnly,
   *  ByTouch, SingleTargetAtRange, AreaAroundCaster, AreaAtRange in
   *  that order, and to SelectFirstAllowedElementType (:635-660),
   *  which walks Fire, Cold, Poison, Shock, Magic. Both halves run,
   *  target first, as EnforceSelectedButtons does. */
  _updateAllowedButtons() {
    const targets = allowedTargetsFor(this.slots);
    if ((targets & targetFlag(this.rangeType)) === 0) {
      for (let i = 0; i < TARGET_LABELS.length; i++) {
        if ((targets & targetFlag(i)) !== 0) { this.rangeType = i; break; }
      }
    }
    const allowed = allowedElementsFor(this.slots);
    if ((allowed & elementFlag(this.element)) !== 0) return;
    for (let i = 0; i < ELEMENT_LABELS.length; i++) {
      if ((allowed & elementFlag(i)) !== 0) { this.element = i; return; }
    }
  }

  /** The live record for pricing and, on buy, for keeping. */
  _spell() {
    return buildCustomSpell({
      slots: this.slots, rangeType: this.rangeType, element: this.element,
      name: this.name, icon: this.icon, index: -1,   // a throwaway index; the BOUGHT spell mints a real one
    });
  }

  cost() { return spellMakerCost(this._spell(), this.entity); }

  // ---- rows on the main sheet ---------------------------------------
  _rows() {
    return [...this.slots.map((_, i) => ({ kind: 'slot', i })),
      { kind: 'target' }, { kind: 'element' }, { kind: 'name' }, { kind: 'buy' }];
  }

  input(action, e = null) {
    this.notice = '';
    if (this.mode === 'group') return this._inputList(action, spellMakerGroups().length, (i) => {
      this.pickGroup = spellMakerGroups()[i];
      const subs = spellMakerSubgroups(this.pickGroup);
      // a lone effect with no subgroup goes straight to the editor
      if (subs.length === 1 && !subs[0].subgroup) return this._addEffect(subs[0]);
      this.mode = 'sub'; this.pickCursor = 0;
      return undefined;
    });
    if (this.mode === 'sub') return this._inputList(action, spellMakerSubgroups(this.pickGroup).length, (i) =>
      this._addEffect(spellMakerSubgroups(this.pickGroup)[i]));
    if (this.mode === 'edit') return this._inputEdit(action);
    if (this.mode === 'name') return this._inputName(action, e);
    return this._inputMain(action);
  }

  _inputList(action, count, pick) {
    if (action === 'up') this.pickCursor = (this.pickCursor - 1 + count) % count;
    else if (action === 'down') this.pickCursor = (this.pickCursor + 1) % count;
    else if (action === 'confirm') pick(this.pickCursor);
    else if (action === 'back') this.mode = this.mode === 'sub' ? 'group' : 'main';
  }

  _addEffect(effect) {
    const slot = this.editSlot >= 0 ? this.editSlot : this.slots.findIndex((s) => !s);
    if (slot < 0) { this.mode = 'main'; this.notice = 'This spell already has three effects.'; return; }
    this.slots[slot] = { type: effect.type, subType: effect.subType, key: effect.key, settings: blankEffectSettings() };
    this._updateAllowedButtons();   // AddAndEditSlot (:462)
    this.editSlot = slot;
    this.editCursor = 0;
    this.mode = 'edit';
  }

  /** The settings editor's live spinner rows - only the components
   *  this effect SUPPORTS, which is what gates DFU's three panels. */
  _editRows() {
    const s = this.slots[this.editSlot];
    const eff = SPELL_MAKER_EFFECTS.find((x) => x.key === s?.key);
    if (!eff) return [];
    const rows = [];
    for (const comp of ['duration', 'chance', 'magnitude']) {
      if (eff[comp]) for (const [field, label] of SPINNER_ROWS[comp]) rows.push({ comp, field, label });
    }
    return rows;
  }

  _inputEdit(action) {
    const rows = this._editRows();
    if (action === 'back') { this.mode = 'main'; this.editSlot = -1; return; }
    if (!rows.length) return;
    if (action === 'up') this.editCursor = (this.editCursor - 1 + rows.length) % rows.length;
    else if (action === 'down') this.editCursor = (this.editCursor + 1) % rows.length;
    else if (action === 'plus' || action === 'confirm') this._step(rows[this.editCursor].field, 1);
    else if (action === 'minus') this._step(rows[this.editCursor].field, -1);
  }

  _step(field, delta) {
    const s = this.slots[this.editSlot];
    if (s) s.settings = stepSetting(s.settings, field, delta);
  }

  _inputName(action, e) {
    if (action === 'confirm' || action === 'back') { this.mode = 'main'; return; }
    if (action === 'backspace') { this.name = this.name.slice(0, -1); return; }
    const ch = typedChar(action, e);
    if (ch && this.name.length < MAX_SPELL_NAME) this.name += ch;
  }

  _inputMain(action) {
    const rows = this._rows();
    if (action === 'up') { this.cursor = (this.cursor - 1 + rows.length) % rows.length; return; }
    if (action === 'down') { this.cursor = (this.cursor + 1) % rows.length; return; }
    if (action === 'back') { this.done = true; this.onClose?.(); return; }
    const row = rows[this.cursor];
    if (action === 'char:n' || action === 'char:N') { const keep = this.onClose; this.reset(); this.onClose = keep; return; }
    if (action === 'char:d' || action === 'char:D') {
      // ClearPendingDeleteEffectSlot (:388-397) - emptying a slot can
      // narrow the allowed sets back down
      if (row.kind === 'slot') { this.slots[row.i] = null; this._updateAllowedButtons(); }
      return;
    }
    if (action !== 'confirm' && action !== 'plus' && action !== 'minus') return;
    const dir = action === 'minus' ? -1 : 1;
    if (row.kind === 'slot') {
      if (this.slots[row.i]) { this.editSlot = row.i; this.editCursor = 0; this.mode = 'edit'; }
      else if (this.slots.filter(Boolean).length >= MAX_EFFECTS_PER_SPELL) this.notice = 'This spell already has three effects.';
      else { this.editSlot = row.i; this.mode = 'group'; this.pickCursor = 0; }
    } else if (row.kind === 'target') {
      this._setTarget((this.rangeType + dir + TARGET_LABELS.length) % TARGET_LABELS.length);
    } else if (row.kind === 'element') {
      this._setElement((this.element + dir + ELEMENT_LABELS.length) % ELEMENT_LABELS.length);
    } else if (row.kind === 'name') {
      this.mode = 'name';
    } else if (row.kind === 'buy') {
      this._buy();
    }
  }

  /** BuyButton: the ladder, then deduct + inscribe + reset (the
   *  window stays open for another spell, as DFU's does). */
  _buy() {
    const { gold } = this.cost();
    const check = validateSpellPurchase({ entity: this.entity, slots: this.slots, goldCost: gold, name: this.name });
    if (!check.ok) { this.notice = check.text ?? REFUSALS[check.textId] ?? 'You cannot buy this spell.'; return; }
    const spell = buildCustomSpell({
      slots: this.slots, rangeType: this.rangeType, element: this.element, name: this.name.trim(), icon: this.icon,
    });
    purchaseSpell(this.entity, spell, gold);
    const keep = this.onClose;
    this.reset();
    this.onClose = keep;
    this.notice = `"${spell.name}" has been inscribed in your spellbook.`;   // record 1705
  }

  // ---- drawing --------------------------------------------------------
  draw(renderer, canvas, font, s) {
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.04, 0.03, 0.02, 0.92]);
    if (!font) return;
    const line = (t, row, c = WHITE) => drawText(renderer, font, t, 16 * s, (14 + row * 10) * s, s, c);
    if (this.mode === 'group') return this._drawList(line, 'Choose an effect group', spellMakerGroups(), (g) => g);
    if (this.mode === 'sub') {
      return this._drawList(line, this.pickGroup, spellMakerSubgroups(this.pickGroup),
        (eff) => `${eff.subgroup || eff.group}${eff.ported ? '' : '  (no effect yet)'}`);
    }
    if (this.mode === 'edit') return this._drawEdit(line);
    this._drawMain(line);
  }

  _drawList(line, title, items, label) {
    line(title, 0, GOLD);
    const view = Math.max(0, Math.min(this.pickCursor - 6, items.length - 13));
    items.slice(view, view + 13).forEach((it, i) => {
      const idx = view + i;
      const sel = idx === this.pickCursor;
      line(`${sel ? '> ' : '  '}${label(it)}`, i + 2, sel ? HOT : WHITE);
    });
    line('ENTER choose   ESC back', 16, DIM);
  }

  _drawEdit(line) {
    const slot = this.slots[this.editSlot];
    const eff = SPELL_MAKER_EFFECTS.find((x) => x.key === slot?.key);
    line(eff ? eff.name : 'Effect', 0, GOLD);
    if (eff && !eff.ported) line('This effect has no runtime yet - it will cast without result.', 1, WARN);
    const rows = this._editRows();
    if (!rows.length) line('This effect has no settings.', 3, DIM);
    let comp = '';
    let row = 2;
    rows.forEach((r, i) => {
      if (r.comp !== comp) { comp = r.comp; line(comp.toUpperCase(), row++, GOLD); }
      const sel = i === this.editCursor;
      line(`${sel ? '> ' : '  '}${r.label.padEnd(11)} ${String(slot.settings[r.field]).padStart(3)}`, row++, sel ? HOT : WHITE);
    });
    const { gold, sp } = this.cost();
    line(`Spell cost: ${gold} gold   ${sp} spell points`, row + 1, GOLD);
    line('+/- adjust   ESC back to the spell', 16, DIM);
  }

  _drawMain(line) {
    const rows = this._rows();
    const { gold, sp } = this.cost();
    line('SPELL MAKER', 0, GOLD);
    rows.forEach((r, i) => {
      const sel = i === this.cursor;
      const mark = sel ? '> ' : '  ';
      let text;
      if (r.kind === 'slot') {
        const slot = this.slots[r.i];
        const eff = slot ? SPELL_MAKER_EFFECTS.find((x) => x.key === slot.key) : null;
        text = `Effect ${r.i + 1}: ${eff ? eff.name + (eff.ported ? '' : '  (no effect yet)') : '-'}`;
      } else if (r.kind === 'target') text = `Target:  ${TARGET_LABELS[this.rangeType]}`;
      else if (r.kind === 'element') text = `Element: ${ELEMENT_LABELS[this.element]}`;
      else if (r.kind === 'name') text = `Name:    ${this.name || '-'}`;
      else text = `Buy this spell  (${gold} gold)`;
      line(mark + text, i + 2, sel ? HOT : WHITE);
    });
    line(`Cost: ${gold} gold, ${sp} spell points`, rows.length + 3, GOLD);
    line(`Your gold: ${goldAmount(this.entity)}   Max spell points: ${this.entity?.maxMagicka ?? 0}`, rows.length + 4, WHITE);
    if (this.notice) line(this.notice, rows.length + 6, WARN);
    line('ENTER choose/cycle   d clear effect   n new spell   ESC leave', 16, DIM);
  }

  /** The name row types when it is open - the host hands raw codes
   *  through for a keyed window, so this window is not native. */
  get isChoiceWindow() { return false; }
}

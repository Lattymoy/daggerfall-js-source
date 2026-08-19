// U24: THE THREE GUILD SERVICE FLOWS - training, donation, cure
// disease. From DaggerfallGuildServiceTraining.cs,
// DaggerfallGuildServiceDonation.cs and
// DaggerfallGuildServiceCureDisease.cs (MIT, Daggerfall Workshop).
//
// None of the three has art of its own. DFU says so about the first
// outright - "Note this is not a real UI window, and is not actually
// pushed onto the stack. This is so replacements are not constrained
// what to present first" - and the other two ARE message boxes by
// inheritance (Donation extends DaggerfallInputMessageBox, CureDisease
// extends DaggerfallMessageBox). So each is a short chain of U11
// parchment boxes, with the list picker in the middle of training's.
//
// The LAW is systems/guildServiceActions.js; this file is the chain.
// One class runs all three, because all three are the same shape: a
// queue of boxes, each optionally carrying buttons or an input field
// or a picker, and each able to push the next.

import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { ListPickerWindow, listPickerArtLoaded } from './listPicker.js';
import { wrapText } from './talkWindow.js';
import { typedChar } from './input.js';
import {
  trainingOffer, canAffordTraining, tooSkilledToTrain, trainSkill, trainableSkills,
  donate, DONATION_DEFAULT, DONATION_MAX_CHARACTERS,
  cureDiseaseOffer, payForCure, cureForFree,
  expandGuildMacros, NOT_ENOUGH_GOLD_ID, TRAINING_TOO_SKILLED_ID,
} from '../systems/guildServiceActions.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { goldAmount } from '../systems/court.js';

/** DaggerfallInputMessageBox's own field width for the donation box
 *  (DaggerfallGuildServiceDonation :48-50: Numeric, MaxCharacters 8). */
export const DONATION_FIELD = Object.freeze({ numeric: true, maxCharacters: DONATION_MAX_CHARACTERS });

/** The prompt DFU shows over the donation field, from its
 *  Internal_Strings ("serviceDonateHowMuch"). */
export const DONATE_HOW_MUCH = 'Donate how much money : ';
/** "freeHolidayCuring" and "curedDisease". */
export const FREE_HOLIDAY_CURING = "You are cured free from cost due to today's holiday.";
export const CURED_DISEASE = 'You are cured.';

/** A box in the chain:
 *    { rows }                      click-anywhere
 *    { rows, buttons: 'YesNo', onYes }
 *    { rows, field: {...}, onInput(text) }
 *    { picker: [labels], onPick(i) }
 */
export class ServiceFlowWindow {
  constructor(boxes = [], { onClose = null } = {}) {
    this.boxes = [...boxes];
    this.onClose = onClose;
    this.done = false;
    this.isChoiceWindow = true;
    this.value = '';
    this._picker = null;
    this._syncPicker();
  }

  get top() { return this.boxes.length ? this.boxes[0] : null; }

  _syncPicker() {
    const t = this.top;
    if (t?.picker && !this._picker) {
      // The handler runs FIRST and its boxes are what _advance takes.
      // Running _advance first emptied the queue, closed the window,
      // and threw the result box away - the live probe caught it: the
      // skill was trained and "you practice for three hours" never
      // appeared.
      this._picker = new ListPickerWindow({
        items: t.picker,
        onPick: (i, label) => this._advance(t.onPick?.(i, label) ?? null),
        onCancel: () => this._advance(t.onCancel?.() ?? null),
      });
    } else if (!t?.picker) this._picker = null;
  }

  /** Drop the current box and take whatever it queued. A handler that
   *  returns boxes pushes them to the FRONT, because DFU's handlers
   *  show their next box immediately rather than behind the rest. */
  _advance(next = null) {
    this.boxes.shift();
    this.value = '';
    if (next?.length) this.boxes.unshift(...next);
    this._picker = null;
    this._syncPicker();
    if (!this.boxes.length) this._close();
  }

  _close() { this.done = true; this.onClose?.(); }

  push(boxes) { if (boxes?.length) this.boxes.unshift(...boxes); this._syncPicker(); }

  input(code, e = null) {
    const t = this.top;
    if (!t) { this._close(); return; }
    if (t.picker) { this._picker?.input(code); if (this._picker?.done) this._syncPicker(); return; }
    if (t.field) {
      if (code === 'Escape') { this._advance(); return; }
      if (code === 'Enter') { const v = this.value; this._advance(t.onInput?.(v) ?? null); return; }
      if (code === 'backspace' || code === 'Backspace') { this.value = this.value.slice(0, -1); return; }
      const ch = typedChar(code, e);   // U26: raw codes or 'char:x'
      if (ch) {
        // TextBox.Numeric refuses anything but a digit (:49)
        if (t.field.numeric && !/^[0-9]$/.test(ch)) return;
        if (this.value.length < (t.field.maxCharacters ?? 8)) this.value += ch;
      }
      return;
    }
    if (t.buttons === 'YesNo') {
      if (code === 'KeyY') this._advance(t.onYes?.() ?? null);
      else if (code === 'KeyN' || code === 'Escape') this._advance(t.onNo?.() ?? null);
      return;
    }
    this._advance(t.onClick?.() ?? null);
  }

  click(vx, vy) {
    const t = this.top;
    if (!t) { this._close(); return true; }
    if (t.picker) { this._picker?.click(vx, vy, this._font); if (this._picker?.done) this._syncPicker(); return true; }
    if (t.buttons === 'YesNo') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this._advance(t.onYes?.() ?? null);
      else if (hit === MB_BUTTONS.No) this._advance(t.onNo?.() ?? null);
      return true;
    }
    if (t.field) return true;   // the field takes keys, not clicks
    this._advance(t.onClick?.() ?? null);
    return true;
  }

  draw(renderer, canvas, font) {
    this._font = font;
    const t = this.top;
    if (!t) { this._close(); return; }
    if (t.picker) {
      if (!listPickerArtLoaded()) { this._advance(); return; }
      this._picker?.draw(renderer, canvas, font);
      return;
    }
    const m = nativeMetrics(canvas);
    const rows = t.field ? [...t.rows, ` > ${this.value}_`] : t.rows;
    const sizing = t.field
      ? [...t.rows, ` > ${'0'.repeat(t.field.maxCharacters ?? 8)}_`]
      : null;
    const buttons = t.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
    this._box = layoutMessageBox(font, rows, buttons, sizing ? { sizingRows: sizing } : {});
    drawMessageBox(renderer, m, font, this._box);
  }
}

/** TEXT.RSC rows through the macro expansion, wrapped to the box.
 *  `rows(id)` is the host's TEXT.RSC reader. */
const macroRows = (rows, id, ctx) => (rows(id) ?? [])
  .map((r) => ({ ...r, text: expandGuildMacros(r.text, ctx) }))
  .filter((r) => r.text !== '' || true);

/** A plain string prompt as one centred row. */
const line = (text) => [{ text, center: true }];

// ── TRAINING ──────────────────────────────────────────────────────

/** TrainingService -> ConfirmTraining -> the skill picker ->
 *  TrainingSkill_OnItemPicked, as one chain (:50-127).
 *
 *  `deps.now()` is classic minutes; `deps.applyTraining(result)` is
 *  the host's - the clock advance and the fatigue drain belong to its
 *  ticker, not to a window. */
export function buildTrainingFlow(entity, guild, membership, deps) {
  const { rows, now, applyTraining, onClose, rolls = Math.random, guildTitle = '' } = deps;
  const offer = trainingOffer(entity, guild, membership, now());
  const ctx = { amount: offer.price, gold: goldAmount(entity), guildTitle, playerName: entity.name ?? '' };
  if (offer.kind === 'tooSoon') {
    return new ServiceFlowWindow([{ rows: macroRows(rows, offer.textId, ctx) }], { onClose });
  }
  const skills = trainableSkills(guild);
  return new ServiceFlowWindow([{
    rows: macroRows(rows, offer.textId, ctx),
    buttons: 'YesNo',
    onYes: () => {
      // The gold check happens BEFORE the picker opens (:76-89).
      if (!canAffordTraining(entity, membership)) {
        return [{ rows: macroRows(rows, NOT_ENOUGH_GOLD_ID, ctx) }];
      }
      return [{
        picker: skills.map((s) => SKILL_NAMES[s] ?? String(s)),
        onPick: (i) => {
          const skill = skills[i];
          if (tooSkilledToTrain(entity, guild, skill)) {
            return [{ rows: macroRows(rows, TRAINING_TOO_SKILLED_ID, { ...ctx, guildTitle }) }];
          }
          const result = trainSkill(entity, skill, now(), rolls);
          applyTraining?.(result, offer.price);
          return [{ rows: macroRows(rows, result.textId, ctx) }];
        },
      }];
    },
  }], { onClose });
}

// ── DONATION ──────────────────────────────────────────────────────

/** DonationService (:44-83). The field opens pre-filled with 1000 and
 *  is numeric-only. */
export function buildDonationFlow(entity, store, divineFactionId, deps) {
  const { rows, onClose, rolls = Math.random, godName = '' } = deps;
  let flow = null;
  flow = new ServiceFlowWindow([{
    rows: line(DONATE_HOW_MUCH),
    field: DONATION_FIELD,
    onInput: (text) => {
      // int.TryParse: a non-number does NOTHING AT ALL in DFU - not
      // even a message - so an empty or unparsable field simply closes.
      const amount = /^[0-9]+$/.test(text) ? Number(text) : null;
      if (amount === null) return null;
      const r = donate(entity, store, divineFactionId, amount, rolls);
      if (r.kind === 'invalid') return null;
      const ctx = { amount, gold: goldAmount(entity), god: godName, playerName: entity.name ?? '' };
      return [{ rows: macroRows(rows, r.textId, ctx) }];
    },
  }], { onClose });
  flow.value = DONATION_DEFAULT;   // TextBox.Text = "1000" (:51)
  return flow;
}

// ── CURE DISEASE ──────────────────────────────────────────────────

/** CureDiseaseService (:54-130). */
export function buildCureDiseaseFlow(entity, guild, membership, deps) {
  const { rows, onClose, quality = 0, regionIndex = 0, now, godName = '', becomingVampireOrWerebeast = false } = deps;
  const offer = cureDiseaseOffer(entity, guild, membership, {
    quality, regionIndex, nowClassicMinutes: now(), becomingVampireOrWerebeast,
  });
  const ctxFor = (amount) => ({ amount, gold: goldAmount(entity), god: godName, playerName: entity.name ?? '' });

  if (offer.kind === 'freeHoliday') {
    cureForFree(entity);
    return new ServiceFlowWindow([{ rows: line(FREE_HOLIDAY_CURING) }], { onClose });
  }
  if (offer.kind === 'noDisease') {
    return new ServiceFlowWindow([{ rows: macroRows(rows, offer.textId, ctxFor(0)) }], { onClose });
  }
  return new ServiceFlowWindow([{
    rows: macroRows(rows, offer.textId, ctxFor(offer.cost)),
    buttons: 'YesNo',
    onYes: () => {
      const r = payForCure(entity, offer.cost);
      return r.kind === 'cured'
        ? [{ rows: line(CURED_DISEASE) }]
        : [{ rows: macroRows(rows, r.textId, ctxFor(offer.cost)) }];
    },
  }], { onClose });
}

/** Wrap-text helper the host uses when a row is wider than the box's
 *  own wrap (the parchment sizes to its widest row, so a TEXT.RSC
 *  record with no line breaks would grow it past the screen). */
export const wrapRows = (font, rowsIn, width = 260) => (rowsIn ?? [])
  .flatMap((r) => wrapText(font.fnt, r.text, width).map((text) => ({ ...r, text })));

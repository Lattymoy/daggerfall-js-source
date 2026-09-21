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
import { InputMessageBoxWindow } from './inputMessageBox.js';   // CM11: a field box IS a pushed DaggerfallInputMessageBox
import {
  trainingOffer, canAffordTraining, tooSkilledToTrain, trainSkill, trainableSkills,
  donate, DONATION_DEFAULT, DONATION_MAX_CHARACTERS,
  cureDiseaseOffer, payForCure, cureForFree,
  expandGuildMacros, NOT_ENOUGH_GOLD_ID, TRAINING_TOO_SKILLED_ID,
} from '../systems/guildServiceActions.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { goldAmount } from '../systems/court.js';
import { raceDisplayName, honorificOf } from '../systems/talkSession.js';

/** The prompt DFU shows beside the donation field, from its
 *  Internal_Strings ("serviceDonateHowMuch") - the TextBox LABEL
 *  (SetTextBoxLabel, DaggerfallGuildServiceDonation.cs:46), on the
 *  field's own row; the box carries no text tokens above it. */
export const DONATE_HOW_MUCH = 'Donate how much money : ';
/** DaggerfallInputMessageBox's own field for the donation box
 *  (DaggerfallGuildServiceDonation.cs:46-51: the label, Numeric,
 *  MaxCharacters 8, Text "1000"). */
export const DONATION_FIELD = Object.freeze({
  numeric: true, maxCharacters: DONATION_MAX_CHARACTERS, initial: DONATION_DEFAULT, label: DONATE_HOW_MUCH,
});
/** "freeHolidayCuring" and "curedDisease". */
export const FREE_HOLIDAY_CURING = "You are cured free from cost due to today's holiday.";
export const CURED_DISEASE = 'You are cured.';

/** A box in the chain:
 *    { rows }                      click-anywhere
 *    { rows, buttons: 'YesNo', onYes }
 *    { rows, buttonsMulti: [recordNums], onButton(n) }   QG1: PromptMulti - click-only, no cancel
 *    { rows, field: { numeric, maxCharacters, initial, label? }, onInput(text) }   rows = the tokens ABOVE, label = the field's own (DFU sets one or the other)
 *    { picker: [labels], onPick(i) }
 */
export class ServiceFlowWindow {
  constructor(boxes = [], { onClose = null } = {}) {
    this.boxes = [...boxes];
    this.onClose = onClose;
    this.done = false;
    this.isChoiceWindow = true;
    this._input = null;     // CM11: the pushed DaggerfallInputMessageBox while the top box carries a field
    this._picker = null;
    this._syncPicker();
    this._syncValue();
  }

  /** The field's live text - the pushed box's, read and written through
   *  the flow so a probe sees one surface (the U24 pins). */
  get value() { return this._input?.value ?? ''; }
  set value(v) { if (this._input) this._input.value = String(v ?? ''); }

  get top() { return this.boxes.length ? this.boxes[0] : null; }

  /** DaggerfallInputMessageBox's `TextBox.Text = "..."` (donation
   *  :51, the tavern's day count :168). The pre-fill belongs to the
   *  FIELD, not to the window, because a chain can raise a second
   *  field with a different default - so it is read every time the
   *  top box changes rather than poked in once at construction. */
  _syncValue() {
    const t = this.top;
    // CM11: DFU's donation (DaggerfallGuildServiceDonation : DaggerfallInputMessageBox
    // :44-51) and the tavern's day count are PUSHED input boxes; the
    // flow raises the one box for a field box and advances on its
    // answer - Return through onInput, Escape through the plain close.
    this._input = t?.field ? new InputMessageBoxWindow({
      lines: t.rows,
      label: t.field.label ?? '',   // AUDIT-CM: no invented " > " - the donation's label is serviceDonateHowMuch, the tavern's day count has none
      value: t.field.initial ?? '',
      maxCharacters: t.field.maxCharacters ?? 8,
      numeric: !!t.field.numeric,   // TextBox.Numeric refuses anything but a digit (:49)
      onSubmit: (v) => this._advance(t.onInput?.(v) ?? null),
      onCancel: () => this._advance(),
    }) : null;
  }

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
    if (next?.length) this.boxes.unshift(...next);
    this._picker = null;
    this._syncPicker();
    this._syncValue();
    if (!this.boxes.length) this._close();
  }

  _close() { this.done = true; this.onClose?.(); }

  push(boxes) {
    if (boxes?.length) this.boxes.unshift(...boxes);
    this._syncPicker();
    this._syncValue();
  }

  input(code, e = null) {
    const t = this.top;
    if (!t) { this._close(); return; }
    if (t.picker) { this._picker?.input(code); if (this._picker?.done) this._syncPicker(); return; }
    if (t.field) { this._input?.input(code, e); return; }   // the pushed box owns the keyboard; its answer advances the chain
    if (t.buttons === 'YesNo') {
      if (code === 'KeyY') this._advance(t.onYes?.() ?? null);
      // AUDIT 28 W2c: a box that names onEscape takes Escape as
      // DaggerfallMessageBox's allowCancel does - CloseWindow with NO
      // button clicked (Update: `if (allowCancel && exitKey)`), which
      // is neither Yes nor No. The exit-door wagon prompt needs that:
      // No leaves the dungeon, Escape stays where you are.
      else if (code === 'Escape' && t.onEscape) this._advance(t.onEscape() ?? null);
      else if (code === 'KeyN' || code === 'Escape') this._advance(t.onNo?.() ?? null);
      return;
    }
    // QG1: a buttonsMulti box takes NO keys - PromptMulti.cs:87-88
    // sets AllowCancel and ClickAnywhereToClose false, and the C#
    // shortcut table has no rows for out-of-enum button records. The
    // only way out is a button click.
    if (t.buttonsMulti) return;
    this._advance(t.onClick?.() ?? null);
  }

  /** ROAD-A7: the picker's hover seam (ListBox.MouseMove's highlight
   *  and VerticalScrollBar.Update's drag) reaches it through here. */
  hover(vx, vy, e = null) { if (this.top?.picker) this._picker?.hover(vx, vy, e); }

  /** ROAD-E E1: and the release edge, on the same forwarding rule -
   *  VerticalScrollBar.Update's else arm (:123-129) needs the button
   *  coming up, which the hosts now deliver. */
  release() { this._picker?.release(); }

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
    // QG1: PromptMulti's 2-4 buttons - the hit answers the BUTTONS.RCI
    // record number and the box advances only on a real button (no
    // click-anywhere: PromptMulti.cs:87).
    if (t.buttonsMulti) {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit != null && t.buttonsMulti.includes(hit)) this._advance(t.onButton?.(hit) ?? null);
      return true;
    }
    if (t.field) { this._input?.click(); return true; }   // modal, not click-anywhere
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
    if (t.field) { this._box = null; this._input?.draw(renderer, canvas, font); return; }   // CM11: the pushed box
    const m = nativeMetrics(canvas);
    const buttons = t.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : (t.buttonsMulti ?? []);
    this._box = layoutMessageBox(font, t.rows, buttons);
    drawMessageBox(renderer, m, font, this._box);
  }
}

/** TEXT.RSC rows through the macro expansion. `rows(id)` is the host's
 *  TEXT.RSC reader. Exported because U39's tavern speaks the same
 *  records through the same expander - a second copy would be a second
 *  place to forget a macro. */
export const macroRows = (rows, id, ctx) => (rows(id) ?? [])
  .map((r) => ({ ...r, text: expandGuildMacros(r.text, ctx) }));

/** A plain string prompt as one centred row. */
const line = (text) => [{ text, center: true }];

/** U39: %ra and %hnr ride EVERY service record, because DFU expands
 *  the whole MacroHelper table over each one. The tavern's own prompt
 *  is where a live probe finally read one raw, but these three windows
 *  speak the same records and had the same hole. */
/** MAC-BUG2 (2026-09-20, Mac, over a screenshot of the temple's cure
 *  box: "curing disease in temple gives this %cpn thing") - AND IT IS
 *  U39'S OWN ARGUMENT, ONE TABLE ROW FURTHER ALONG.
 *
 *  U39 put `%ra` and `%hnr` here because "DFU expands the WHOLE
 *  MacroHelper table over each record", and a service window that
 *  fills only the symbols it expects to see leaves the rest raw. The
 *  same sentence covers `%cpn` (MacroHelper.cs:69, ShopName) and
 *  `%cn` (the city), and they were not here - so the cure offer, which
 *  speaks a TRADE record (cureDiseaseOffer answers
 *  TRADE_MESSAGE_BASE_ID + an offset, and those records quote the shop
 *  and the town back at you), printed the token verbatim and an empty
 *  city: *"%cpn prides itself on having the lowest prices in ."*
 *
 *  Both ride `identity` rather than each flow's own ctx for the reason
 *  the first two do: the next record to quote a symbol nobody expected
 *  is answered by the table, not by a fix at one call site. The host
 *  passes what it has; an absent name leaves the token alone, which is
 *  `expandGuildMacros`'s null rule and is what a service reached from
 *  the street (no building at all) honestly has to say. */
const identity = (entity, { shopName = null, cityName = null } = {}) => ({
  race: raceDisplayName(entity?.race),
  honorific: honorificOf(entity?.gender),
  shopName, cityName,
});

// ── TRAINING ──────────────────────────────────────────────────────

/** TrainingService -> ConfirmTraining -> the skill picker ->
 *  TrainingSkill_OnItemPicked, as one chain (:50-127).
 *
 *  `deps.now()` is classic minutes; `deps.applyTraining(result)` is
 *  the host's - the clock advance and the fatigue drain belong to its
 *  ticker, not to a window. */
export function buildTrainingFlow(entity, guild, membership, deps) {
  const { rows, now, applyTraining, onClose, rolls = Math.random, guildTitle = '', shopName = null, cityName = null } = deps;
  const offer = trainingOffer(entity, guild, membership, now());
  const ctx = { amount: offer.price, gold: goldAmount(entity), guildTitle, playerName: entity.name ?? '', ...identity(entity, { shopName, cityName }) };
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
  const { rows, onClose, rolls = Math.random, godName = '', shopName = null, cityName = null } = deps;
  return new ServiceFlowWindow([{
    rows: [],                // no tokens: the prompt is the field's LABEL (:46)
    field: DONATION_FIELD,   // TextBox.Text = "1000" (:51)
    onInput: (text) => {
      // int.TryParse: a non-number does NOTHING AT ALL in DFU - not
      // even a message - so an empty or unparsable field simply closes.
      const amount = /^[0-9]+$/.test(text) ? Number(text) : null;
      if (amount === null) return null;
      const r = donate(entity, store, divineFactionId, amount, rolls);
      if (r.kind === 'invalid') return null;
      const ctx = { amount, gold: goldAmount(entity), god: godName, playerName: entity.name ?? '', ...identity(entity, { shopName, cityName }) };
      return [{ rows: macroRows(rows, r.textId, ctx) }];
    },
  }], { onClose });
}

// ── CURE DISEASE ──────────────────────────────────────────────────

/** CureDiseaseService (:54-130). */
export function buildCureDiseaseFlow(entity, guild, membership, deps) {
  // A4: `becomingVampireOrWerebeast` is no longer a host argument -
  // cureDiseaseOffer reads TimeToBecomeVampireOrWerebeast off the
  // entity, exactly as DaggerfallGuildServiceCureDisease.cs:58 reads
  // it off playerEntity. One less thing for a host to remember.
  const { rows, onClose, quality = 0, regionIndex = 0, now, godName = '', priceAdjustment = 1000, shopName = null, cityName = null } = deps;
  const offer = cureDiseaseOffer(entity, guild, membership, {
    quality, regionIndex, nowClassicMinutes: now(), priceAdjustment,
  });
  const ctxFor = (amount) => ({ amount, gold: goldAmount(entity), god: godName, playerName: entity.name ?? '', ...identity(entity, { shopName, cityName }) });

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

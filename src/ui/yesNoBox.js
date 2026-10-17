// @ts-check
// UXB1-M (2026-09-25, the UX backlog: "Private Property uses daggerfall's default Y/N prompt. Make the options
// clickable at least or convert to new UI."): DaggerfallMessageBox WITH ITS YES AND NO -
// CommonMessageBoxButtons.YesNo (DaggerfallMessageBox.cs:630-632) - as a window any host's overlay slot can hold.
//
// PlayerActivate asks "This looks like private property..." with DFU's own YesNo box (PlayerActivate.cs:902-925):
// the TEXT.RSC record on the parchment and BUTTONS.RCI's Yes and No under it - buttons a mouse presses. The port
// raised it as a keyed ChoiceWindow, the interim flat panel reading "Y - yes / N - no", and that panel's click rows
// sat one row ABOVE their labels (ui/talkWindow.js, mended there for every keyed menu): a click on "Y - yes"
// answered No. This is the box DFU draws, on both skins:
//   - CLASSIC: DFU's parchment and its two buttons (ui/messageBox.js layoutMessageBox / drawMessageBox), hit through
//     messageBoxHit - the one door every box click in the port takes, which plays DFU's click (:487). Without the
//     parchment art it is the keyed panel, whose rows answer where they are drawn now.
//   - ENHANCED: the decision in the skin's own face - a card with two buttons, centred where the player looks. A box
//     with buttons is a DECISION, never ENH-NOTICE1's click-anywhere notice, and FONT1 ("any enhanced UI or text must
//     be our enhanced version") wants no parchment over the enhanced HUD.
//   - The KEYS are DFU's on both: Y and N (the buttons' DaggerfallShortcut hotkeys, :377); Return presses the DEFAULT
//     button, which for YesNo is NO (AddCommonButtons :630-632, Update :313-324); and Escape does nothing, because a
//     box with buttons cannot be cancelled (AddButton :383, AllowCancel = false).
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded, messageBoxHit, MB_BUTTONS, fitBoxRows } from './messageBox.js';
import { nativeMetrics } from './native/nativePanel.js';
import { ChoiceWindow } from './talkWindow.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { hotkeyHit } from '../systems/dialogShortcuts.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';   // DISC29-D: the watchdog counts frames, not milliseconds

export const YES_NO_BOX_ID = 'enhanced-yesno';
/** The card leaves when its draws stop - a host gone without closing it - as the input box's does (400 ms). */
export const YES_NO_WATCHDOG_MS = 400;
/** The card's words for the two buttons (BUTTONS.RCI's art says YES and NO) and its caption. */
export const YES_NO_LABELS = Object.freeze({ yes: 'Yes', no: 'No' });
export const YES_NO_HINT = 'Y yes · N or Enter no';
/** SOFTCAP3: the OK box (CommonMessageBoxButtons.OK - DaggerfallMessageBox.cs's single OK button, BUTTONS.RCI record 5):
 *  the same window with `okOnly`, for a box that only EXPLAINS. Return and the button's O answer it; Escape does not
 *  (a box with a button is not cancelled, as for YesNo). */
export const OK_LABEL = 'OK';
export const OK_HINT = 'Enter or O to close';

const rowText = (r) => (typeof r === 'string' ? r : String(r?.text ?? ''));

let face = null;   // { owner, root, rows, yes, no, rowsKey }
let watchdog = null;
let schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
export function _setYesNoClockForTests(s, c) { schedule = s ?? schedule; cancel = c ?? cancel; }

function buildFace(doc, owner) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = YES_NO_BOX_ID;
  root.className = 'inputbox yesnobox';
  root.setAttribute('role', 'alertdialog');
  const rows = doc.createElement('div');
  rows.className = 'inputbox-rows';
  const acts = doc.createElement('div');
  acts.className = 'yesnobox-acts';
  const press = (yes) => () => { audio.playOneShot(SOUND.ButtonClick, 1); owner.answer(yes); };   // ButtonClickHandler (:487)
  const yes = doc.createElement('button');
  yes.type = 'button'; yes.className = owner.okOnly ? 'act primary yesnobox-ok' : 'act yesnobox-yes'; yes.textContent = owner.okOnly ? OK_LABEL : YES_NO_LABELS.yes;
  yes.onclick = press(true);
  acts.append(yes);
  let no = null;
  if (!owner.okOnly) {   // SOFTCAP3: the OK box has its one button, and it is the default
    no = doc.createElement('button');
    no.type = 'button'; no.className = 'act primary yesnobox-no'; no.textContent = YES_NO_LABELS.no;   // the default button, marked as such
    no.onclick = press(false);
    acts.append(no);
  }
  const hint = doc.createElement('div');
  hint.className = 'notice-hint';
  hint.textContent = owner.okOnly ? OK_HINT : YES_NO_HINT;
  root.append(rows, acts, hint);
  doc.body.append(root);
  return { owner, root, rows, yes, no, rowsKey: null };
}

/** One frame of the card for `owner`; a second box replaces the first's face. Returns the root (null off a document). */
function drawFace(owner, rows, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  if (face && face.owner !== owner) releaseYesNoFace(face.owner);
  if (!face) face = buildFace(doc, owner);
  disarmDraw(watchdog);
  watchdog = armDrawWatchdog(YES_NO_WATCHDOG_MS, () => { if (face?.owner === owner) releaseYesNoFace(owner); }, { schedule, cancel });   // DISC29-D: a frame undrawn, not a slow one
  const key = rows.map(rowText).join('\n');
  if (face.rowsKey !== key) {
    face.rowsKey = key;
    face.rows.textContent = '';
    for (const r of rows) {
      const n = doc.createElement('div');
      n.className = `notice-row${typeof r === 'object' && r?.center === false ? '' : ' center'}`;
      n.textContent = rowText(r);
      face.rows.append(n);
    }
  }
  return face.root;
}

/** The box closed (or its draws stopped): the card goes. A no-op for a box whose card is not the one up. */
export function releaseYesNoFace(owner) {
  if (!face || face.owner !== owner) return;
  disarmDraw(watchdog); watchdog = null;
  try { face.root.remove(); } catch { /* already gone */ }
  face = null;
}
/** Whose card is up (tests). */
export const yesNoFaceOwner = () => face?.owner ?? null;

export class YesNoBoxWindow {
  /** @param {{ rows: Array<string|{text: string, center?: boolean}>, onYes?: (() => void)|null, onNo?: (() => void)|null, okOnly?: boolean }} opts */
  constructor({ rows, onYes = null, onNo = null, okOnly = false }) {
    this.okOnly = !!okOnly;   // SOFTCAP3: the OK box - one button, answered as Yes (onYes)
    this.rows = rows?.length ? rows : [''];
    this.onYes = onYes;
    this.onNo = onNo;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam: Y, N and Return are what DFU's box answers
    this._box = null;             // the parchment's last layout, in native space - click() hits it
    this._flat = null;            // the art-less panel, built on first need
    this._carded = false;         // the enhanced card drew last frame: its buttons take the presses
  }

  /** ButtonClickHandler (:487) -> PrivateProperty_OnButtonClick's shape: close, then the answer's arm. Once. */
  answer(yes) {
    if (this.done) return;
    this.done = true;
    releaseYesNoFace(this);
    (yes ? this.onYes : this.onNo)?.();
  }

  /** AUDIT OW4 P3 (scenes/world.js's party walk): the question TAKEN BACK unanswered - done, so it is inert wherever it
   *  stands (under a window pushed over it, a key or a click reaches neither arm) and the slot's own drain drops it the
   *  moment it is the top again (townTalk's `overlay?.done`); its card goes now. */
  withdraw() {
    this.done = true;
    releaseYesNoFace(this);
  }

  input(code, e = null) {
    if (this.done) return;
    if (this.okOnly) {   // SOFTCAP3: the OK box - Return (the default button) or O; nothing else closes it
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'confirm' || code === 'KeyO') this.answer(true);
      return;
    }
    if (hotkeyHit('Yes', code, e)) { this.answer(true); return; }
    if (hotkeyHit('No', code, e)) { this.answer(false); return; }
    // Return presses the default button (Update :313-324) - No, for YesNo (:631). Escape: nothing (:383).
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'confirm') this.answer(false);
  }

  /** Modal: a click that misses both buttons is swallowed, never answered. */
  click(vx, vy) {
    if (this.done || this._carded) return true;   // the card's own buttons take its presses
    if (this._box) {
      const hit = messageBoxHit(this._box, vx, vy);
      if (hit === MB_BUTTONS.Yes || hit === MB_BUTTONS.OK) this.answer(true);
      else if (hit === MB_BUTTONS.No) this.answer(false);
      return true;
    }
    return this._flat ? this._flat.click(vx, vy) : true;
  }

  draw(renderer, canvas, font, s = null) {
    if (this.done) return;
    this._carded = false;
    if (isEnhanced() && typeof document !== 'undefined' && drawFace(this, this.rows)) { this._carded = true; return; }
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      const box = layoutMessageBox(font, fitBoxRows(font, this.rows), this.okOnly ? [MB_BUTTONS.OK] : [MB_BUTTONS.Yes, MB_BUTTONS.No]);   // SOFTCAP3: the OK box's one button   // SS5: a long row wraps on the screen
      if (drawMessageBox(renderer, m, font, box)) { this._box = box; return; }
    }
    this._box = null;
    this._flat ??= new ChoiceWindow({
      lines: this.rows.map(rowText),
      options: this.okOnly ? [{ code: 'Enter', label: 'Enter - OK', action: () => this.answer(true) }] : [
        { code: 'KeyY', label: 'Y - yes', action: () => this.answer(true) },
        { code: 'KeyN', label: 'N - no', action: () => this.answer(false) },
      ],
    });
    this._flat.draw(renderer, canvas, font, s ?? nativeMetrics(canvas).s);
  }

  dispose() { releaseYesNoFace(this); }
}

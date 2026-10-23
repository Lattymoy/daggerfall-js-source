// @ts-check
// STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; design doc "DFO Staff
// Panel: design", Message on screen): THE BOX - "a box in the middle of their screen headed 'Message from staff', with
// the staff member's name and the text, until they press OK".
//
// Its own box, not ui/midScreenText.js: that line lasts 1.5 s and replaces itself (DaggerfallHUD's), too short for words
// a player must read. A page overlay on both skins (the enhanced sheet's input-box panel, laid on the classic skin too, as
// ui/yesNoBox.js lays it), so it stands indoors, in ground view and over any window. It takes no key and is no modal
// window: a player mid-fight keeps playing, and only the OK button closes it - nothing is focused, so a key pressed in
// play (Space, Enter) can never close it unread.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { t } from '../systems/textManager.js';

export const STAFF_MESSAGE_BOX_ID = 'staff-message-box';
/** The box up now, if any - one at a time. */
let current = /** @type {any} */ (null);

/** The box's words, each read when it is shown (design doc: "New player-facing text ... message box ... gets a row in
 *  every language the game ships"). */
export const staffMessageTitle = () => t('net.staffMsg.title', 'Message from staff');
export const staffMessageFrom = (/** @type {string} */ name) => t('net.staffMsg.from', 'From {name}', { name });
export const staffMessageOk = () => t('net.staffMsg.ok', 'OK');

/**
 * The box up, for one message - a second replaces the first's (the caller shows one at a time). `onOk` once, when the
 * player presses OK. Answers the box's root, or null off a document.
 * @param {{ from: string, text: string, onOk: () => void }} m
 * @param {Document|null} [doc]
 */
export function showStaffMessageBox({ from, text, onOk }, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc?.body) return null;
  current?.remove();
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const el = (/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ words) => { const n = doc.createElement(tag); n.className = cls; n.textContent = words; return n; };
  const root = doc.createElement('div');
  root.id = STAFF_MESSAGE_BOX_ID;
  root.className = 'inputbox yesnobox';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', `${STAFF_MESSAGE_BOX_ID}-head`);
  const rows = el('div', 'inputbox-rows', '');
  const head = el('div', 'notice-row center highlight', staffMessageTitle());
  head.id = `${STAFF_MESSAGE_BOX_ID}-head`;
  rows.append(head, el('div', 'notice-row center inputbox-label', staffMessageFrom(from)), el('div', 'notice-row', text));
  const acts = el('div', 'yesnobox-acts', '');
  const ok = el('button', 'act primary', staffMessageOk());
  /** @type {any} */ (ok).type = 'button';
  let done = false;
  ok.onclick = () => { if (done) return; done = true; root.remove(); onOk(); };
  acts.append(ok);
  root.append(rows, acts);
  doc.body.append(root);
  current = root;
  return root;
}

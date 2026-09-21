// ENH-NOTICE1 (2026-09-21, Mac: "classic DFU has text that shows in the
// middle of the screen, instead of this, for enhanced I want a panel
// that slides in from the right side of the screen showing the
// notification. This should work for any and all mods that utilize
// this text."): THE NOTICE PANEL, THE ENHANCED SKIN'S DaggerfallMessageBox.
//
// WHAT IT REPLACES. DFU's `DaggerfallUI.MessageBox(...)` is the parchment
// that lands in the middle of the screen with ClickAnywhereToClose set:
// a quest's text, an item's, a shop's or a guild's line, a holiday, a
// door, and every ported mod that speaks through the same call. The
// port has ONE home for that box - ui/actionText.js's ActionTextBox
// (its header counts the ~35 sites) and ui/talkWindow.js's no-options
// ChoiceWindow (CM1 made it the same shape) - and that is why this
// module can serve "any and all mods" without naming one: a mod that
// raises the box raises the panel.
//
// WHAT IT DOES NOT CHANGE. The box is still MODAL: the game waits, as
// it does under DFU's parchment, and a click or a key dismisses it. A
// box with buttons, a picker or a text field is a decision, not a
// notice, and keeps its own window on both skins. The classic skin is
// untouched, byte for byte. The panel's place is the enhanced skin's
// own choice, not DFU's: Ledger A row "THE NOTICE AT THE EDGE".
//
// THE MODEL IS THE BOX, THE DRAW IS THIS. ui/enhancedHudText.js's shape
// (its header says why): ActionTextBox keeps its rows, its chain
// (addNext) and its `done`; its draw hands this module the rows and
// its dismissal releases the panel. Keyed hosts - one panel per box,
// so a chain of two boxes (a level-up refusal over a sheet, a quest
// box over a talk box) stacks readably and neither can blank the
// other. A panel whose box stopped drawing without ever being
// dismissed (a host that dropped its overlay on a scene change) slides
// out on its own after NOTICE_WATCHDOG_MS: a persistent DOM overlay
// stays painted unless told otherwise (AUDIT 64 F37), and the only
// thing that can tell it is the draw not arriving.
//
// THE SLIDE. The panel is appended off the right edge, its resting
// style is flushed, and the `notice-in` class lets the sheet's
// transition carry it in; dismissal swaps `notice-in` for `notice-out`
// and the node leaves after NOTICE_SLIDE_MS. The waits go through
// `schedule`, which a test replaces to run them at once.
//
// ENH-NOTICE3 (2026-09-21, Mac: "All mods, including climates and
// calories need to utilize the enhanced notification popup"): THE
// SAME STACK CARRIES THE HUD LINE. DaggerfallUI.AddHUDText - the
// PopupText rows Climates & Calories, Ambient Text, the torches, the
// skill-ups and the loot tallies speak through - is not a box: it is
// timed, it is not modal, and nothing dismisses it. FONT1 gave it a
// DOM column of its own at the top of the screen, which was a second
// enhanced face beside this one, and the one the player did not read
// as "the notification". So the column is retired and each PopupText
// row is a TOAST here: its own panel in this stack, no hint, keyed by
// the row's id under its model's key, in for as long as PopupText's
// own timer keeps the row and out when the model pops it. The MODEL
// is still ui/hudText.js's single timer (drawEnhancedToasts is
// handed its frame each draw); only the face moved. And a DOM-native
// window that raises a box of its own (the tavern, the inventory,
// the held map) HOLDS a panel here - no per-frame draw, so no
// watchdog - until it releases it.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { isEnhanced } from '../systems/uiSkin.js';

export const ENHANCED_NOTICE_ID = 'enhanced-notice';
/** The sheet's transition length (ui/enhancedStyle.js .notice), in ms. */
export const NOTICE_SLIDE_MS = 260;
/** A box that has not drawn for this long is gone: slide its panel out. */
export const NOTICE_WATCHDOG_MS = 400;
/** ClickAnywhereToClose, said the enhanced way - a quiet caption under the text. */
export const NOTICE_HINT = 'click or press a key';

let stack = null;
/** key -> { host, rows, last, watchdog } - one entry per live box. */
const panels = new Map();
let schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
/** Tests replace the two clocks so a slide-out can be observed at once. */
export function _setNoticeClockForTests(s, c) { schedule = s ?? schedule; cancel = c ?? cancel; }

function buildStack(doc) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_NOTICE_ID;
  root.className = 'notice-stack';
  root.setAttribute('aria-live', 'polite');   // the box's words, read out where the parchment could not be
  doc.body.append(root);
  return root;
}

function buildPanel(doc, key, toast = false, hint = undefined) {
  const host = doc.createElement('div');
  host.className = toast ? 'notice notice-toast' : 'notice';
  host.dataset.owner = key;
  const body = doc.createElement('div');
  body.className = 'notice-body';
  host.append(body);
  // THE HINT TELLS THE TRUTH (AUDIT ENH-NOTICE3 B2-B4). "click or
  // press a key" is DFU's ClickAnywhereToClose said the enhanced way,
  // and it is the default because the box IS that. A toast is not
  // dismissed and carries none; and a window whose box clears on its
  // own terms - the hunt's busy page (Escape alone), the pack's and
  // the held map's refusals (the next action) - says so or says
  // nothing (`hint` false, or its own caption), never a promise the
  // page does not keep.
  const caption = toast ? false : (hint === undefined ? NOTICE_HINT : hint);
  let hintNode = null;
  if (caption) {
    hintNode = doc.createElement('div');
    hintNode.className = 'notice-hint';
    hintNode.textContent = String(caption);
    host.append(hintNode);
  }
  // THE BOX STANDS ABOVE THE TOASTS (AUDIT ENH-NOTICE3, seen in the
  // browser): a stack is read top-down, and the panel the player must
  // ANSWER goes first - a box raised under four skill-ups sat at the
  // foot of the column. A toast joins at the foot; a box goes in
  // front of the first toast (a fake document with no insertBefore
  // appends, which the order pin's own document does not).
  const firstToast = !toast && typeof stack.insertBefore === 'function'
    ? (stack.children ? [...stack.children].find((c) => c.className?.includes?.('notice-toast')) : null) : null;
  if (firstToast) stack.insertBefore(host, firstToast); else stack.append(host);
  // Appended off-screen, and the browser must COMPUTE that resting
  // style before the class changes it, or there is no "before" for
  // the transition to start from and the panel simply appears (a
  // class set in the same style pass as the insertion animates
  // nothing - measured, not assumed). Reading offsetWidth forces
  // the flush; the fake document has none and needs none.
  void host.offsetWidth;
  host.className = toast ? 'notice notice-toast notice-in' : 'notice notice-in';
  return { host, body, hintNode, rows: [], last: {}, watchdog: null, toast, key };
}

/** A row record as the box carries it: a string, a { text, center,
 *  highlight } record, or AUDIT 64 F28's { cells: [{ text, x }] }
 *  tab-stopped row. The panel keeps the columns the parchment kept. */
function paintRow(doc, node, row) {
  const rec = typeof row === 'string' ? { text: row } : (row ?? {});
  const cls = `notice-row${rec.center ? ' center' : ''}${rec.highlight ? ' highlight' : ''}${Array.isArray(rec.cells) ? ' cells' : ''}`;
  if (node.className !== cls) node.className = cls;
  if (Array.isArray(rec.cells)) {
    const want = rec.cells.map((c) => c?.text ?? '');
    const have = node.children ?? [];
    while (have.length < want.length) { const s = doc.createElement('span'); s.className = 'notice-cell'; node.append(s); }
    for (let i = 0; i < have.length; i++) {
      const s = have[i];
      const t = want[i] ?? '';
      if (s.style.display !== (i < want.length ? '' : 'none')) s.style.display = i < want.length ? '' : 'none';
      if (s.textContent !== t) s.textContent = t;
    }
    return;
  }
  const t = rec.text ?? '';
  if (node.children?.length) { for (const c of [...node.children]) c.remove(); }
  if (node.textContent !== t) node.textContent = t;
}

/**
 * One frame of ONE box's notice.
 *
 * `frame.rows` are the box's lines (strings or row records), in order;
 * `frame.visible === false` hides the panel without releasing it;
 * `frame.toast` makes the panel a toast (no hint - ENH-NOTICE3);
 * `frame.hint` is the caption under the rows - undefined for the
 * default NOTICE_HINT, false for none, a string for the window's own;
 * `frame.hold` arms no watchdog, for an owner that does not draw per
 * frame (a DOM window) and releases by hand. `key` names the OWNER -
 * two boxes never share a panel. Returns the panel (or null off a
 * document) so a test can read what was painted.
 */
export function drawEnhancedNotice(frame, doc = (typeof document === 'undefined' ? null : document), key = 'box') {
  if (!doc) return null;
  const lines = frame?.visible === false ? [] : (frame?.rows ?? []);
  let p = panels.get(key);
  if (!p && !lines.length) return null;
  if (!stack) stack = buildStack(doc);
  if (!p) { p = buildPanel(doc, key, !!frame?.toast, frame?.hint); panels.set(key, p); }
  const { host, body, rows, last } = p;
  if (p.hintNode && typeof frame?.hint === 'string' && p.hintNode.textContent !== frame.hint) p.hintNode.textContent = frame.hint;
  // the watchdog: re-armed on every draw, fires only when the draws stop
  cancel(p.watchdog);
  p.watchdog = frame?.hold ? null : schedule(() => { if (panels.get(key) === p) releaseEnhancedNotice(key); }, NOTICE_WATCHDOG_MS);

  const shown = lines.length > 0;
  if (last.on !== shown) { last.on = shown; host.style.display = shown ? '' : 'none'; }
  if (!shown) return host;
  while (rows.length < lines.length) {
    const n = doc.createElement('div');
    n.className = 'notice-row';
    body.append(n);
    rows.push(n);
  }
  for (let i = 0; i < rows.length; i++) {
    const n = rows[i];
    if (i >= lines.length) { if (n.style.display !== 'none') n.style.display = 'none'; continue; }
    if (n.style.display === 'none') n.style.display = '';
    paintRow(doc, n, lines[i]);
  }
  return host;
}

/** The box was dismissed (or its draws stopped): slide the panel out
 *  and take the node with it; the stack goes when the last panel does. */
export function releaseEnhancedNotice(key) {
  const p = panels.get(key);
  if (!p) return;
  panels.delete(key);
  cancel(p.watchdog);
  // AUDIT ENH-NOTICE3 A2: a toast the WATCHDOG swept (its model's
  // draws stopped - a backgrounded tab, a host gone without dispose)
  // must leave its owner's id set too, or the set outlives the model
  // as garbage and a resumed draw counts a row it has no panel for.
  if (p.toast && p.toastOwner != null) {
    const mine = toasts.get(p.toastOwner);
    if (mine) { mine.delete(p.rowId); if (!mine.size) toasts.delete(p.toastOwner); }
  }
  p.host.className = p.toast ? 'notice notice-toast notice-out' : 'notice notice-out';
  const gone = () => {
    try { p.host.remove(); } catch { /* already gone */ }
    if (!panels.size) { try { stack?.remove(); } catch { /* already gone */ } stack = null; }
  };
  if (schedule(gone, NOTICE_SLIDE_MS) == null) gone();
}

let seq = 0;
/** A fresh owner key: one per BOX, minted at its first enhanced draw,
 *  so two boxes alive at once never share a panel. */
export const noticeKey = (prefix = 'box') => `${prefix}${++seq}`;

/**
 * THE BOX'S DRAW, decided once for both homes (ActionTextBox,
 * ChoiceWindow; a window's own box goes through noticeFrame below). True when the panel took the frame and the box must
 * put up no canvas quads; false when the box paints its own parchment
 * - the classic skin, or the enhanced skin off a document. A box that
 * is DONE answers true without drawing: its panel is sliding out, and
 * a host that paints it one more frame before dropping it would
 * otherwise raise a second panel for the watchdog to chase.
 */
export function noticeDraw(box, rows) {
  if (!isEnhanced()) return false;
  if (box.done) return true;
  box._noticeKey ??= noticeKey();
  return drawEnhancedNotice({ rows }, undefined, box._noticeKey) != null;
}

/** The box (or the window that owns one) is gone: its panel leaves.
 *  A no-op for an owner that never drew a panel - the classic skin. */
export function noticeRelease(owner) {
  if (owner?._noticeKey) releaseEnhancedNotice(owner._noticeKey);
}

/**
 * A WINDOW'S OWN BOX, decided each frame (ENH-NOTICE2). Eight classic
 * windows drawn on both skins - the potion maker, the item maker, the
 * spell maker, the bank, the rest window, the coven, the guild service
 * window and the service flow - raise DFU's click-anywhere box from
 * inside themselves (`DaggerfallUI.MessageBox` over the window) and
 * paint it as their own parchment rather than pushing an
 * ActionTextBox, because a host holds one overlay slot. They hand
 * `rows` here while such a box is up and `null` when none is - or
 * when the box up is a DECISION (buttons) or a FIELD, which keep the
 * parchment. True: the panel took the frame. False: paint the
 * parchment (classic skin, no document, or nothing to show), and any
 * panel this owner had is released - so a text step that gives way
 * to a Yes/No step, or a box that clears, leaves on the next draw.
 */
export function noticeFrame(owner, rows, { hint = undefined } = {}) {
  if (!rows || !isEnhanced()) { noticeRelease(owner); return false; }
  owner._noticeKey ??= noticeKey();
  return drawEnhancedNotice({ rows, hint }, undefined, owner._noticeKey) != null;
}

/**
 * A DOM-NATIVE WINDOW'S OWN BOX (ENH-NOTICE3). The tavern, the
 * inventory and the held map are DOM under the enhanced skin and raise
 * DFU's click-anywhere box from inside themselves; they have no
 * per-frame draw, so the panel is HELD - no watchdog - from this call
 * until noticeRelease(owner). `rows` null releases. The window keeps
 * its own dismissal (its scrim, its key), exactly as the classic
 * windows keep theirs under noticeFrame. True: the panel is up.
 */
export function noticeHold(owner, rows, { hint = undefined } = {}) {
  if (!rows || !isEnhanced()) { noticeRelease(owner); return false; }
  owner._noticeKey ??= noticeKey();
  return drawEnhancedNotice({ rows, hold: true, hint }, undefined, owner._noticeKey) != null;
}

/** key -> Set of the row ids that owner has toasts for. */
const toasts = new Map();
const toastKey = (owner, id) => `${owner}:${id}`;

/**
 * ONE FRAME OF ONE PopupText MODEL, AS TOASTS (ENH-NOTICE3). `frame`
 * is ui/hudText.js's own (`rows` front first, `ids` beside them,
 * `visible` the host's draw gate); each row is a panel of its own,
 * keyed by its id under `key`, so a row that was there last frame and
 * is not in this one has been POPPED by PopupText's timer and slides
 * out, while the rows still queued stay put - a new line never
 * re-slides the old ones. `visible === false` hides them all without
 * releasing (a hidden HUD, AUDIT FONT F4's covering window); the
 * queue is untouched, as it always was. Returns the owner's live
 * panels, for a test.
 */
export function drawEnhancedToasts(frame, doc = (typeof document === 'undefined' ? null : document), key = 'hud') {
  if (!doc) return [];
  const ids = frame?.ids ?? [];
  const rows = frame?.rows ?? [];
  const visible = frame?.visible !== false;
  let mine = toasts.get(key);
  if (!mine && !ids.length) return [];
  if (!mine) { mine = new Set(); toasts.set(key, mine); }
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const host = drawEnhancedNotice({ rows: [rows[i] ?? ''], visible, toast: true }, doc, toastKey(key, ids[i]));
    if (host) {
      const p = panels.get(toastKey(key, ids[i]));
      if (p) { p.toastOwner = key; p.rowId = ids[i]; }   // AUDIT ENH-NOTICE3 A2: the watchdog's release finds the owner's set through these
      mine.add(ids[i]); out.push(host);
    }
  }
  for (const id of [...mine]) {
    if (ids.includes(id)) continue;
    // popped by the model (gone from the frame) - or hidden with an
    // empty frame, which is the same hide as above, not a release
    if (!visible && !ids.length) { drawEnhancedNotice({ visible: false, toast: true }, doc, toastKey(key, id)); out.push(panels.get(toastKey(key, id))?.host); continue; }
    releaseEnhancedNotice(toastKey(key, id));
    mine.delete(id);
  }
  if (!mine.size) toasts.delete(key);
  return out.filter(Boolean);
}

/** EVERY ALLOCATION HAS AN OWNER: a PopupText model whose host is
 *  ending takes its toasts with it (scenes/dungeonContext.js's destroy,
 *  through HudText.dispose). */
export function releaseEnhancedToasts(key) {
  const mine = toasts.get(key);
  if (!mine) return;
  for (const id of mine) releaseEnhancedNotice(toastKey(key, id));
  toasts.delete(key);
}

/** The live panels' keys, for a probe. */
export const enhancedNoticeKeys = () => [...panels.keys()];
/** The models that hold toasts, for a probe (AUDIT ENH-NOTICE3 A2). */
export const enhancedToastOwners = () => [...toasts.keys()];

/** Tests: drop everything at once. */
export function destroyEnhancedNotice() {
  for (const p of panels.values()) { cancel(p.watchdog); try { p.host.remove(); } catch { /* gone */ } }
  panels.clear();
  toasts.clear();
  try { stack?.remove(); } catch { /* gone */ }
  stack = null;
}

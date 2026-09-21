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
// THE SLIDE. The panel is appended off the right edge and takes the
// `notice-in` class on the next frame, so the sheet's transition
// carries it in; dismissal swaps `notice-in` for `notice-out` and the
// node leaves after NOTICE_SLIDE_MS. Both waits go through `schedule`,
// which a test replaces to run them at once.

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

function buildPanel(doc, key) {
  const host = doc.createElement('div');
  host.className = 'notice';
  host.dataset.owner = key;
  const body = doc.createElement('div');
  body.className = 'notice-body';
  host.append(body);
  const hint = doc.createElement('div');
  hint.className = 'notice-hint';
  hint.textContent = NOTICE_HINT;
  host.append(hint);
  stack.append(host);
  // appended off-screen; the class on the NEXT frame is what the transition carries in
  const arm = () => { host.className = 'notice notice-in'; };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(arm); else arm();
  return { host, body, rows: [], last: {}, watchdog: null };
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
 * `frame.visible === false` hides the panel without releasing it. `key`
 * names the OWNER - two boxes never share a panel. Returns the panel
 * (or null off a document) so a test can read what was painted.
 */
export function drawEnhancedNotice(frame, doc = (typeof document === 'undefined' ? null : document), key = 'box') {
  if (!doc) return null;
  const lines = frame?.visible === false ? [] : (frame?.rows ?? []);
  let p = panels.get(key);
  if (!p && !lines.length) return null;
  if (!stack) stack = buildStack(doc);
  if (!p) { p = buildPanel(doc, key); panels.set(key, p); }
  const { host, body, rows, last } = p;
  // the watchdog: re-armed on every draw, fires only when the draws stop
  cancel(p.watchdog);
  p.watchdog = schedule(() => { if (panels.get(key) === p) releaseEnhancedNotice(key); }, NOTICE_WATCHDOG_MS);

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
  p.host.className = 'notice notice-out';
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
 * ChoiceWindow). True when the panel took the frame and the box must
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

/** The live panels' keys, for a probe. */
export const enhancedNoticeKeys = () => [...panels.keys()];

/** Tests: drop everything at once. */
export function destroyEnhancedNotice() {
  for (const p of panels.values()) { cancel(p.watchdog); try { p.host.remove(); } catch { /* gone */ } }
  panels.clear();
  try { stack?.remove(); } catch { /* gone */ }
  stack = null;
}

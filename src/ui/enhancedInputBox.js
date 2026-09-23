// @ts-check
// AUDIT HCC U5 (2026-09-23, Mac: "any new notifications or UI elements are enhancified"; FONT1: "Any enhanced UI or
// text must be our enhanced version"): THE FIELD'S OWN WINDOW, IN THE SKIN'S FACE.
//
// DaggerfallInputMessageBox (ui/inputMessageBox.js) drew the SPOP parchment in the bitmap font on both skins, so
// Horse Cart and Cargo's "Name your horse:" - and every other line of text a raiser asks for - stood as a 1996
// parchment over the enhanced HUD. ENH-NOTICE1's law holds: a field is a DECISION, not a notice - it is not a
// click-anywhere panel at the right edge; it keeps a window of its own, where the player looks while typing. So
// this is that window: centred (or at the top, for showAtTopOfScreen), in the notice panel's pixel face and rule,
// the text tokens above, the label and the live entry with its caret on a field line, and a caption that says what
// closes it. It draws per frame from the box's own `draw` and is taken down by the box's close, or by a watchdog
// when the draws stop (a host gone without closing it) - the notice's own lifecycle, one box at a time.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

export const ENHANCED_INPUT_BOX_ID = 'enhanced-inputbox';
export const INPUT_BOX_WATCHDOG_MS = 400;

let host = null;
let owner = null;
let watchdog = null;
const last = {};
let schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
export function _setInputBoxClockForTests(s, c) { schedule = s ?? schedule; cancel = c ?? cancel; }

function build(doc) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_INPUT_BOX_ID;
  root.className = 'inputbox';
  root.setAttribute('role', 'dialog');
  const rows = doc.createElement('div'); rows.className = 'inputbox-rows';
  const field = doc.createElement('div'); field.className = 'inputbox-field';
  const label = doc.createElement('span'); label.className = 'inputbox-label';
  const before = doc.createElement('span');
  const caret = doc.createElement('span'); caret.className = 'inputbox-caret';
  const after = doc.createElement('span');
  field.append(label, before, caret, after);
  const hint = doc.createElement('div'); hint.className = 'notice-hint';
  root.append(rows, field, hint);
  doc.body.append(root);
  return { root, rows, field, label, before, caret, after, hint, rowNodes: [] };
}

/**
 * One frame of the box. `frame` = { key, rows: string[], label, value, cursor, atTop, hint }. The key is the box
 * (one window at a time; a second box replaces the first's face). Returns the root (null off a document).
 */
export function drawEnhancedInputBox(frame, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc || !frame) return null;
  if (!host) host = build(doc);
  if (owner !== frame.key) { owner = frame.key; for (const k of Object.keys(last)) delete last[k]; }
  cancel(watchdog);
  const key = frame.key;
  watchdog = schedule(() => { if (owner === key) releaseEnhancedInputBox(key); }, INPUT_BOX_WATCHDOG_MS);
  const rows = Array.isArray(frame.rows) ? frame.rows.map((r) => String(r ?? '')) : [];
  const rk = rows.join('\n');
  if (last.rows !== rk) {
    last.rows = rk;
    while (host.rowNodes.length < rows.length) { const n = doc.createElement('div'); n.className = 'notice-row center'; host.rows.append(n); host.rowNodes.push(n); }
    host.rowNodes.forEach((n, i) => { n.style.display = i < rows.length ? '' : 'none'; if (i < rows.length && n.textContent !== rows[i]) n.textContent = rows[i]; });
    host.rows.style.display = rows.length ? '' : 'none';
  }
  const value = String(frame.value ?? '');
  const cur = Math.max(0, Math.min(value.length, Number.isInteger(frame.cursor) ? frame.cursor : value.length));
  const label = String(frame.label ?? '');
  if (last.label !== label) { last.label = label; host.label.textContent = label; }
  const b = value.slice(0, cur), a = value.slice(cur);
  if (last.before !== b) { last.before = b; host.before.textContent = b; }
  if (last.after !== a) { last.after = a; host.after.textContent = a; }
  const hint = String(frame.hint ?? '');
  if (last.hint !== hint) { last.hint = hint; host.hint.textContent = hint; host.hint.style.display = hint ? '' : 'none'; }
  const cls = frame.atTop ? 'inputbox top' : 'inputbox';
  if (host.root.className !== cls) host.root.className = cls;
  if (last.on !== true) { last.on = true; host.root.style.display = ''; }
  return host.root;
}

/** The box closed (or its draws stopped): the window goes. A no-op for a key that is not the one up. */
export function releaseEnhancedInputBox(key) {
  if (!host || owner !== key) return;
  cancel(watchdog); watchdog = null;
  try { host.root.remove(); } catch { /* already gone */ }
  host = null; owner = null;
  for (const k of Object.keys(last)) delete last[k];
}

/** Whose face is up (tests). */
export const enhancedInputBoxOwner = () => owner;

// PORT3: THE ENHANCED LIST - DaggerfallListPickerWindow, in the skin.
//
// One classic control serves a dozen choices: the skill to train, the
// spell to buy, the recipe, the enchantment and its variant, the spell
// effect group, the magic item to use, the camp's actions. Under the
// enhanced skin ui/listPicker.js hands its draw here, and the list is a
// window of its own - every row visible in one scrolling column, the
// chosen one marked in brass - instead of nine rows of 1996 font.
//
// THE OWNER STILL DECIDES. A row press here is REPLAYED as the classic
// double-click on that row (DFU's MouseDoubleClick is what uses a row),
// after scrolling the classic list so the row is on it - so the owner's
// click path, which often does more than the picker (a service flow
// advancing, a maker clearing its picker), runs exactly as before.
// Cancel is the classic click outside the panel. The keys (arrows,
// Enter, Escape, 1-9) are the owner's, untouched.

import { injectEnhancedStyle } from './enhancedStyle.js';
import { inClassicScope } from './enhancedScope.js';
import { replayClick } from './enhancedDialog.js';
import { nativeMetrics } from './nativePanel.js';

export const PICKER_WATCHDOG_MS = 150;

let active = null;   // { picker, shell, list, canvas, m, sig, watchdog }

const el = (doc, tag, cls, text) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function closeEnhancedPicker() {
  if (!active) return;
  clearTimeout(active.watchdog);
  try { active.shell.remove(); } catch { /* gone */ }
  active = null;
}

/** Scroll the classic list so `index` is on it, then double-click its row. */
export function pickRow(a, index, geo) {
  const p = a.picker;
  if (!p || index < 0 || index >= p.items.length) return false;
  const rows = p.rowsDisplayed;
  if (index < p.scrollIndex || index >= p.scrollIndex + rows) p.scrollIndex = Math.max(0, Math.min(index, p.items.length - rows));
  const rh = p.rowHeight(p.pickerFont ?? p._font);
  const row = index - p.scrollIndex;
  const vx = geo.x + geo.list[0] + 10;
  const vy = geo.y + geo.list[1] + row * rh + Math.max(1, Math.floor(rh / 2));
  replayClick(a.canvas, a.m, vx, vy);
  return replayClick(a.canvas, a.m, vx, vy);   // the second press inside the double-click delay uses the row
}

function build(doc, picker, geo) {
  injectEnhancedStyle(doc);
  const shell = el(doc, 'div', 'dlg-shell pick-shell');
  const win = el(doc, 'section', 'dlg-win px-win pick-win');
  win.setAttribute('role', 'listbox');
  const list = el(doc, 'div', 'pick-list');
  const rows = picker.items.map((label, i) => {
    const b = el(doc, 'button', 'pick-row');
    b.type = 'button';
    b.tabIndex = -1;
    b.append(el(doc, 'span', 'pick-mark', '\u25c6'), el(doc, 'span', 'pick-label', String(label ?? '')));
    if (i < 9) b.append(el(doc, 'span', 'pick-num', String(i + 1)));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener('click', (e) => { e.stopPropagation(); if (active) pickRow(active, i, geo); });
    list.append(b);
    return b;
  });
  const acts = el(doc, 'footer', 'dlg-acts');
  if (picker.allowCancel) {
    const cancel = el(doc, 'button', 'dlg-btn');
    cancel.type = 'button';
    cancel.tabIndex = -1;
    cancel.append(el(doc, 'span', 'dlg-key', 'Esc'), el(doc, 'span', 'dlg-label', 'Cancel'));
    cancel.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    cancel.addEventListener('click', (e) => { e.stopPropagation(); if (active) replayClick(active.canvas, active.m, 1, 1); });
    acts.append(cancel);
  }
  win.append(list, acts);
  shell.append(win);
  shell.addEventListener('pointerdown', (e) => { if (e.target === shell) e.stopPropagation(); });
  doc.body.append(shell);
  return { shell, list, rows };
}

/**
 * Draw `picker` (a ui/listPicker.js ListPickerWindow) as the enhanced
 * list, this frame. `geo` is the classic panel's { x, y, list } so a
 * press can land on the classic row. False when it is not ours to draw.
 */
export function drawEnhancedPicker(picker, renderer, canvas, geo, doc = globalThis.document) {
  if (!doc?.body || inClassicScope() || !picker?.items) return false;
  const sig = JSON.stringify(picker.items);
  if (active && (active.picker !== picker || active.sig !== sig)) closeEnhancedPicker();
  if (!active) {
    let built = null;
    try { built = build(doc, picker, geo); } catch { return false; }   // a DOM that cannot hold it: the classic list
    active = { picker, sig, ...built };
  }
  active.canvas = renderer?.canvas ?? (canvas?.getBoundingClientRect ? canvas : active.canvas);
  active.m = nativeMetrics(canvas);
  // the classic selection, shown: the keys move it and the view follows
  const sel = picker.selectedIndex;
  if (active.sel !== sel) {
    active.rows[active.sel]?.classList.remove('on');
    active.rows[sel]?.classList.add('on');
    active.rows[sel]?.scrollIntoView?.({ block: 'nearest' });
    active.sel = sel;
  }
  clearTimeout(active.watchdog);
  active.watchdog = setTimeout(closeEnhancedPicker, PICKER_WATCHDOG_MS);
  return true;
}

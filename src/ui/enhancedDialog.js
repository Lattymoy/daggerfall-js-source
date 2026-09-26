// DLG1: THE ENHANCED DECISION BOX - a message box that asks something.
//
// ENH-NOTICE1 moved every box that only SAYS something onto the notice
// panel, and left "a box with buttons ... a decision, not a notice" on
// the classic parchment, drawn on the canvas with BUTTONS.RCI's 32x16
// art - the one surface in the enhanced skin still wearing 1996's
// chrome: the pause menu's Exit, the save window's Overwrite, the guild
// and coven services, the bank, the controls' Defaults, the travel
// map's diseased warning, trade, training...
//
// ONE DOOR FOR ALL OF THEM. Every such box goes through
// ui/messageBox.js drawMessageBox, so that is where this takes over:
// under the enhanced skin a box with buttons is handed here and drawn
// as a DOM window in the stone-and-brass kit instead of on the canvas.
//
// THE WINDOW BEHIND IT STILL DECIDES. Nothing here knows what Yes
// means. A press on a button here REPLAYS the press on the classic
// button's own spot: the box's layout knows each button's native rect,
// the draw knows the native->screen map, so this dispatches the same
// pointerdown the canvas would have had there - and the owning window's
// own click(vx, vy) -> messageBoxHit runs exactly as before, click sound
// included. The keys (Y, N) were always the windows' own and still are;
// the buttons just say them.
//
// THE BOX IS AS LONG-LIVED AS ITS DRAW. Some windows lay their box out
// again every frame, so a box is known by what it says and offers, not
// by object identity; when the draws stop the dialog closes (a short
// watchdog - the same law the notice panel keeps).

import { injectEnhancedStyle } from './enhancedStyle.js';
import { inClassicScope } from './enhancedScope.js';   // PORT0: the classic travel map keeps its own boxes

/** MessageBoxButtons (DaggerfallMessageBox.cs:67-90), in words. The
 *  numbers are ui/messageBox.js MB_BUTTONS (not imported: that module
 *  imports this one). 21 is Realistic Rest's week button ("5 Days"). */
export const BUTTON_LABELS = Object.freeze({
  0: 'Accept', 1: 'Reject', 2: 'Cancel', 3: 'Yes', 4: 'No', 5: 'OK',
  6: 'Male', 7: 'Female', 8: 'Add', 9: 'Delete', 10: 'Edit', 11: 'Counter',
  12: '12 Months', 13: '36 Months', 14: 'Copy', 15: 'Guilty', 16: 'Not Guilty',
  17: 'Debate', 18: 'Lie', 19: 'Anchor', 20: 'Teleport', 21: '5 Days',
});
/** The key each window already answers to, shown on its button. */
export const BUTTON_KEYS = Object.freeze({ 3: 'Y', 4: 'N' });
/** The answers that go ahead - drawn as the primary (brass) button. */
export const PRIMARY_BUTTONS = new Set([0, 3, 5]);
/** How long after its last draw a dialog is taken to be gone (ms). */
export const DIALOG_WATCHDOG_MS = 150;

let active = null;   // { sig, shell, box, m, canvas, watchdog }

/** A box is drawn here only if every one of its buttons has words, and
 *  it carries no painting (the painting arm stays on the canvas). */
export function dialogFits(box, opts = {}) {
  if (!box?.buttons?.length || opts.image || box.image) return false;
  return box.buttons.every((b) => BUTTON_LABELS[b.button] != null);
}

/** What a box says and offers - its identity across re-layouts. */
export const dialogSig = (box) => JSON.stringify([
  (box.rows ?? []).map((r) => (r.cells ? r.cells.map((c) => c.text).join('\t') : r.text)),
  box.buttons.map((b) => b.button),
]);

const el = (doc, tag, cls, text) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function build(doc, box) {
  injectEnhancedStyle(doc);
  const shell = el(doc, 'div', 'dlg-shell');
  const win = el(doc, 'section', 'dlg-win px-win');
  win.setAttribute('role', 'alertdialog');
  win.setAttribute('aria-modal', 'true');
  const body = el(doc, 'div', 'dlg-body');
  for (const r of box.rows ?? []) {
    const row = el(doc, 'p', `dlg-row${r.center ? ' center' : ''}${r.highlight ? ' hl' : ''}`);
    if (r.cells) for (const c of r.cells) row.append(el(doc, 'span', 'dlg-cell', c.text));
    else row.textContent = r.text || '\u00a0';
    body.append(row);
  }
  const acts = el(doc, 'footer', 'dlg-acts');
  for (const b of box.buttons) {
    const btn = el(doc, 'button', `dlg-btn${PRIMARY_BUTTONS.has(b.button) ? ' primary' : ''}`);
    btn.type = 'button';
    btn.tabIndex = -1;   // the keys are the game's; a focused button would eat Enter/Space
    const key = BUTTON_KEYS[b.button];
    if (key) btn.append(el(doc, 'span', 'dlg-key', key));
    btn.append(el(doc, 'span', 'dlg-label', BUTTON_LABELS[b.button]));
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    // DROPS-AUDIT F2: ONE press per dialog - it is spent and put away at once, so a double-click's second press can
    // never replay onto the window that is on top by then (the next frame builds it again if the box stands)
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (!active || active.spent) return; active.spent = true; press(b.button); closeEnhancedDialog(); });
    acts.append(btn);
  }
  win.append(body, acts);
  shell.append(win);
  // a press on the scrim is not an answer, and must not reach the world
  shell.addEventListener('pointerdown', (e) => { if (e.target === shell) e.stopPropagation(); });
  doc.body.append(shell);
  return shell;
}

/** Replay a press at native point (vx, vy): the pointerdown the canvas
 *  would have had there, dispatched on the canvas itself, so the host's
 *  own route (client -> canvas pixels -> native -> the top window's
 *  click) runs exactly as for a real press. Shared with the enhanced
 *  list (ui/enhancedPicker.js). */
export function replayClick(canvas, m, vx, vy) {
  if (!canvas?.getBoundingClientRect || !m) return false;
  const r = canvas.getBoundingClientRect();
  const kx = r.width / (canvas.width || r.width), ky = r.height / (canvas.height || r.height);
  const clientX = r.left + (m.ox + vx * m.s) * kx;
  const clientY = r.top + (m.oy + vy * m.s) * ky;
  const init = { clientX, clientY, button: 0, buttons: 1, bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, pointerId: 1 };
  const P = globalThis.PointerEvent ?? globalThis.MouseEvent;
  canvas.dispatchEvent(new P('pointerdown', init));
  (canvas.ownerDocument?.defaultView ?? globalThis).dispatchEvent(new P('pointerup', { ...init, buttons: 0 }));
  return true;
}

/** Replay a press on the classic button's own spot, so the owning
 *  window's click(vx, vy) -> messageBoxHit answers it as it always has. */
export function press(record, a = active) {
  if (!a) return false;
  const b = a.box.buttons.find((x) => x.button === record);
  if (!b) return false;
  const [bx, by, bw, bh] = b.rect;
  return replayClick(a.canvas, a.m, bx + bw / 2, by + bh / 2);
}

export function closeEnhancedDialog() {
  if (!active) return;
  clearTimeout(active.watchdog);
  try { active.shell.remove(); } catch { /* gone */ }
  active = null;
}

/**
 * Draw `box` (a ui/messageBox.js layout) as the enhanced dialog, this
 * frame. Returns false when it is not ours to draw - no document, no
 * buttons, a painting, a button with no words - and the canvas draws
 * the classic box as before.
 */
export function drawEnhancedDialog(renderer, m, box, opts = {}, doc = globalThis.document) {
  if (!doc?.body || inClassicScope() || !dialogFits(box, opts)) return false;
  const sig = dialogSig(box);
  if (active && active.sig !== sig) closeEnhancedDialog();
  if (!active) {
    let shell = null;
    try { shell = build(doc, box); } catch { return false; }   // a DOM that cannot hold it: the parchment, as before
    active = { sig, shell };
  }
  active.box = box;
  active.m = m;
  active.canvas = renderer?.canvas ?? active.canvas ?? null;
  clearTimeout(active.watchdog);
  active.watchdog = setTimeout(closeEnhancedDialog, DIALOG_WATCHDOG_MS);
  return true;
}

export const enhancedDialogOpen = () => !!active || !!choice;

// ── DLG2: THE KEYED MENU (ui/talkWindow.js ChoiceWindow) ──────────────
// The private-property prompt, the repair interrupt, the court, the
// surrender, the talk menus: a ChoiceWindow WITH options is a decision
// too, but it never went through messageBox.js - it painted its own flat
// canvas panel reading "Y - yes / N - no". Same window here; a press
// calls the window's own input(code), exactly what the key does.

/** "Y - yes" -> { key: 'Y', label: 'Yes' }; "Esc - close" -> Esc/Close;
 *  a label with no key prefix ("Invite to party") keeps its words. */
export function choiceLabel(text) {
  const m = /^\s*([A-Za-z0-9]{1,5})\s+-\s+(.+)$/.exec(String(text ?? ''));
  const word = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  return m ? { key: m[1], label: word(m[2]) } : { key: null, label: word(String(text ?? '')) };
}

let choice = null;   // { owner, sig, shell, watchdog }

export function closeEnhancedChoice(owner) {
  if (!choice || (owner && choice.owner !== owner)) return;
  clearTimeout(choice.watchdog);
  try { choice.shell.remove(); } catch { /* gone */ }
  choice = null;
}

/** Draw a keyed menu as the enhanced dialog this frame. `owner` is the
 *  ChoiceWindow (its input(code) answers a press); options with no label
 *  are keys only and get no button. False: not ours - the canvas panel. */
export function drawEnhancedChoice(owner, lines, options, doc = globalThis.document) {
  if (!doc?.body || inClassicScope() || !options?.length) return false;
  const shown = options.filter((o) => o.label);
  if (!shown.length) return false;
  const sig = JSON.stringify([lines, shown.map((o) => [o.code, o.label])]);
  if (choice && (choice.owner !== owner || choice.sig !== sig)) closeEnhancedChoice();
  if (!choice) {
    try {
      injectEnhancedStyle(doc);
      const shell = el(doc, 'div', 'dlg-shell dlg-choice');
      const win = el(doc, 'section', 'dlg-win px-win');
      win.setAttribute('role', 'alertdialog');
      win.setAttribute('aria-modal', 'true');
      const body = el(doc, 'div', 'dlg-body');
      for (const l of lines ?? []) body.append(el(doc, 'p', 'dlg-row', l || '\u00a0'));
      const acts = el(doc, 'footer', 'dlg-acts');
      for (const o of shown) {
        const { key, label } = choiceLabel(o.label);
        const btn = el(doc, 'button', `dlg-btn${o.code === 'KeyY' ? ' primary' : ''}`);
        btn.type = 'button';
        btn.tabIndex = -1;
        if (key) btn.append(el(doc, 'span', 'dlg-key', key));
        btn.append(el(doc, 'span', 'dlg-label', label));
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          closeEnhancedChoice();
          owner.input(o.code);
        });
        acts.append(btn);
      }
      win.append(body, acts);
      shell.append(win);
      shell.addEventListener('pointerdown', (e) => { if (e.target === shell) e.stopPropagation(); });
      doc.body.append(shell);
      choice = { owner, sig, shell, watchdog: null };
    } catch { return false; }
  }
  clearTimeout(choice.watchdog);
  choice.watchdog = setTimeout(closeEnhancedChoice, DIALOG_WATCHDOG_MS);
  return true;
}

// The dialog's own layout lives in ui/enhancedDialogStyle.js (a leaf, so
// the sheet can take it without an import loop through this module).

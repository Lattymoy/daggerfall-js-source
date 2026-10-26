// @ts-check
// BOX-ON-TOP (2026-10-25, the in-game check of the Identify refund: the "Casting Spells" tutorial page stood over the
// Identify window, and no click put it away) - A MESSAGE BOX OVER AN ENHANCED WINDOW TAKES THE CLICK.
//
// Daggerfall Unity gives input to the top window alone (UserInterfaceManager.cs:54-57, TopWindow). A message box with
// ClickAnywhereToClose listens on its parent panel, which is the whole screen (DaggerfallMessageBox.cs:264-266), and
// closes on a click there while it is the top window (:645-660). The port's message box is ui/actionText.js's
// ActionTextBox, and a host hands it the canvas's clicks while it holds the top of the host's window stack.
//
// The enhanced skin's windows (the counter, the spellbook, the pack) are DOM layers over the whole screen, above the
// canvas (z-index 11-14), and the box's notice panel stands at the right edge with no pointer events
// (ui/enhanced/enhancedStyle.js .notice-stack). A box pushed over one of these windows - a tutorial page a beat after
// the window opened, a refusal that the window's own action raised - was the top of its host's stack, but every click
// landed on the window under it. The box could not be clicked away, and a click meant for it pressed the window's
// buttons.
//
// So while a modal box is drawn as the top window and an enhanced window is open (ui/enhanced/enhancedOverlays.js
// overlayOpen), this module lays a transparent layer over the whole screen, above the windows and below the notice
// stack, and hands the layer's clicks to the box. The keyboard focus also leaves the covered window's control, so
// Enter reaches the box through the host and is not the browser's press of a button under it.
//
// The layer lasts as long as the box is drawn. Each draw arms it; the box's close or replacement removes it. A box
// whose draws stop without either (a host that dropped it from its slot by hand) loses the layer after a frame passes
// undrawn (ui/drawWatchdog.js), as its notice panel does: a layer left behind would take every click on the screen.

import { overlayOpen } from './enhanced/enhancedOverlays.js';
import { pauseWhileOpen, windowCovered } from './windowStack.js';
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';

/** Above the enhanced windows (11-14) and the bottom sheets (20); below the update scrim (30) and the notice stack (31). */
export const BOX_CLICK_CATCHER_Z = 29;
export const BOX_CLICK_CATCHER_CLASS = 'box-click-catcher';
/** How often an armed layer asks whether its box's draws stopped - the notice panel's own interval
 *  (ui/enhanced/enhancedNotice.js NOTICE_WATCHDOG_MS). */
const DRAW_WATCH_MS = 400;

/**
 * @typedef {object} ClickableBox
 * @property {boolean} done
 * @property {() => unknown} click   the box's own ClickAnywhereToClose
 * @property {boolean} [pauseWhileOpen]   false for a readout that is not modal (ui/statusBox.js)
 */

/** @typedef {{ layer: any, watchdog: any }} HeldLayer */

/** @type {WeakMap<ClickableBox, HeldLayer>} */
const layers = new WeakMap();

/** A box that is still open, modal, the top of its stack, and over an enhanced window. @param {ClickableBox} box */
function boxWantsTheClicks(box) {
  if (box.done) return false;
  if (!pauseWhileOpen(box)) return false;
  if (!overlayOpen()) return false;
  return !windowCovered(box);
}

/** @param {any} doc @param {ClickableBox} box */
function buildLayer(doc, box) {
  const layer = doc.createElement('div');
  layer.className = BOX_CLICK_CATCHER_CLASS;
  layer.style.cssText = `position:fixed;inset:0;z-index:${BOX_CLICK_CATCHER_Z};background:transparent`;
  // A click, not a press: removed on the press, the layer would hand the press's click to the window it uncovered.
  // The right and the middle buttons close too, as DFU's do (DaggerfallMessageBox.cs:264-266).
  /** @param {any} e */
  const takeClick = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    box.click();
  };
  layer.addEventListener('click', takeClick);
  layer.addEventListener('auxclick', takeClick);
  layer.addEventListener('contextmenu', (/** @type {any} */ e) => e.preventDefault?.());
  doc.body.append(layer);
  const focused = doc.activeElement;
  if (focused && focused !== doc.body) focused.blur?.();
  return layer;
}

/**
 * The box is being drawn now: while it wants the screen's clicks, its layer stands (built on the first such draw);
 * otherwise any layer it had is removed. Answers whether the layer stands.
 * @param {ClickableBox} box
 * @param {any} [doc]
 */
export function catchBoxClicks(box, doc = globalThis.document) {
  if (!doc?.createElement || !doc.body || !boxWantsTheClicks(box)) {
    releaseBoxClicks(box);
    return false;
  }
  let held = layers.get(box);
  if (!held) {
    held = { layer: buildLayer(doc, box), watchdog: null };
    layers.set(box, held);
  }
  disarmDraw(held.watchdog);
  held.watchdog = armDrawWatchdog(DRAW_WATCH_MS, () => releaseBoxClicks(box));
  return true;
}

/** The box closed or was replaced: its layer goes. Safe for a box that never had one. @param {ClickableBox} box */
export function releaseBoxClicks(box) {
  const held = layers.get(box);
  if (!held) return;
  layers.delete(box);
  disarmDraw(held.watchdog);
  held.layer.remove?.();
}

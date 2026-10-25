// @ts-check
// NOTICE1: THE NOTICE BOARD'S DOOR - the one place a host opens the board through (THE ONE CONSTRUCTION SEAM, PROF0
// 17.2). The bounty board's shape (ui/bounty/bountyDoor.js): a lazy chunk (ui/noticeWindow.js) mounted through the one home
// (ui/enhanced/enhancedChunk.js) in a host of its own, wrapped in the generic overlay shape every host's frame drives,
// registered with the overlay stack, and handed to the host's overlay slot (townTalk.showOverlay) - so the game stands
// still while it is up. THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: `done` reads true only once the DOM is gone,
// and the host's `onClose` runs last.
import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
import { lineBoard } from '../scenes/quest/questlineOffers.js';   // QL-OFFERED: the questlines on offer, posted on every town's board

/** @type {any} */ let _open = null;
/** Is the board up. */
export const noticeDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up. */
export function closeNoticeDoor() { const was = noticeDoorOpen(); _open?.dispose(); return was; }

/**
 * @param {any} deps the window's own deps (ui/noticeWindow.js mountNoticeBoard), less `onExit`; plus `onClose`. QL-OFFERED:
 *   `questlines` is this door's own - the page's bridge's offers (scenes/quest/questlineOffers.js lineBoard), so every host's
 *   board posts them and no host hands them (a host's own `questlines` stands, for the pins)
 * @returns {any} the overlay, or null with no document
 */
export function createNoticeOverlay(deps) {
  noteFirstUse('notice-board');   // TUT1
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'notice-board-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};
  const close = () => {
    if (fired) return;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.();
  };
  unregister = registerOverlay(close);
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the window's own capture keydown owns the keyboard */ },
    click() { /* a fixed div over the canvas */ },
    wheel() {},
    hover() {},
    tick() {},
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./noticeWindow.js'),
    mount: (m) => { view = m.mountNoticeBoard(host, { questlines: lineBoard, ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close(); }, label: 'notice-board',
  });
  return overlay;
}

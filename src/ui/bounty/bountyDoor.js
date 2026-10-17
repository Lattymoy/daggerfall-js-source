// @ts-check
// BOUNTY1: THE BOUNTY WINDOWS' DOOR - the one place a host opens the board and the payday notice through. The Broker's
// door's shape (ui/brokerDoor.js): a lazy chunk (ui/bounty/bountyWindow.js) mounted through the one home (ui/enhanced/enhancedChunk.js)
// in a host of its own, wrapped in the generic overlay shape every host's frame drives, registered with the overlay
// stack. Handed to the host's overlay slot (townTalk.showOverlay), so the game stands still while either is up.
import { mountEnhancedChunk } from '../enhanced/enhancedChunk.js';
import { registerOverlay } from '../enhanced/enhancedOverlays.js';
import { noteFirstUse } from '../../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

/** @type {any} */ let _open = null;
/** Is a bounty window up. */
export const bountyDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up. */
export function closeBountyDoor() { const was = bountyDoorOpen(); _open?.dispose(); return was; }

/**
 * @param {'board'|'notice'} kind
 * @param {any} deps the window's own deps, less `onExit`; plus `onClose` (the host's word it is shut) and, for the
 *   board, `attach(view)` / `detach()` so the host can repaint it
 * @returns {any} the overlay, or null with no document
 */
export function createBountyOverlay(kind, deps) {
  if (kind === 'board') noteFirstUse('bounties');   // TUT1: the board, not a finished bounty's notice
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = `bounty-${kind}-host`;
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};
  /** `read`: the window's own exit (its button, Escape, a tap outside) - false when it is taken down under the reader
   *  (another window took the slot, a death came), which the host hears as unread (AUDIT 28 H12). */
  const close = (read = false) => {
    if (fired) return;
    unregister();
    deps.detach?.();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.(read);
  };
  unregister = registerOverlay(() => close(true));   // the overlay stack's Escape: the player's own dismissal
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
    load: () => import('./bountyWindow.js'),
    mount: (m) => {
      view = kind === 'notice' ? m.mountBountyNotice(host, { ...deps, onExit: () => close(true) }) : m.mountBountyBoard(host, { ...deps, onExit: () => close(true) });
      deps.attach?.(view);
    },
    alive: () => !fired, host, onDismiss: () => { close(false); }, label: `bounty-${kind}`,   // a chunk that never loaded: unread
  });
  return overlay;
}

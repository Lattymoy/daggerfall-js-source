// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7): THE BROKER'S DOOR - the one place a
// host opens the Sigil Broker's window through. The window (ui/brokerWindow.js) is a lazy chunk mounted through the one
// home (ui/enhancedChunk.js - a chunk that will not arrive is a notice the player dismisses, MENU1), in a host of its
// own, wrapped in the generic overlay shape every host's frame already drives (ui/tavernDoor.js's own wrapper): `done`
// once it is shut, `dispose` to shut it, the keyboard and the pointer the window's own. It registers with the overlay
// stack, so the QuickDial key puts it away as it puts away every enhanced window (PX28b).
//
// The Broker is online's, and online is the enhanced skin's (systems/onlineLane.js), so there is no classic window to
// fork to: a page with no document answers null. One stands at a time - the host shuts it when the Broker goes (the
// gate fell, the court was entered) through `closeBrokerDoor`.
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';

/** The overlay standing now, or null. */
let _open = null;
/** Is the Broker's window up. */
export const brokerDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeBrokerDoor() {
  const was = brokerDoorOpen();
  _open?.dispose();
  return was;
}
/** Draw it again, if it is up (a stone won or dropped under it). */
export const repaintBrokerDoor = () => { _open?.repaint(); };

/**
 * Open the window, as an overlay for the host's slot (townTalk.showOverlay). `deps` is brokerWindow.js's own, less
 * `onExit` - the door's close is the window's way out - and plus `onClose`, the host's word that it is shut.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createBrokerOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'broker-host';
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
    click() { /* the window is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* its list scrolls itself */ },
    hover() { /* its own :hover */ },
    tick() { /* its own clock repaints it */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./brokerWindow.js'),
    mount: ({ mountBrokerWindow }) => { view = mountBrokerWindow(host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close(); }, label: 'broker',
  });
  return overlay;
}

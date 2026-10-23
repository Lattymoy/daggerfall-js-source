// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WYRD SISTER'S DOOR - the one place a host opens her
// window through (ui/wyrdWindow.js), the Broker's door's shape (ui/brokerDoor.js): a lazy chunk mounted through the one
// home (ui/enhanced/enhancedChunk.js), in a host of its own, wrapped in the overlay every host's frame drives - `done` once
// shut, `dispose` to shut it - and registered with the overlay stack. One stands at a time. A page with no document
// answers null. Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';

/** The overlay standing now, or null. */
let _open = null;
/** Is her window up. */
export const wyrdDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeWyrdDoor() {
  const was = wyrdDoorOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot (townTalk.showOverlay). `deps` is wyrdWindow.js's own, less
 * `onExit`, plus `onClose` - the host's word that it is shut.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createWyrdOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'wyrd-host';
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
    tick() { /* it repaints on what it hears */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./wyrdWindow.js'),
    mount: ({ mountWyrdWindow }) => { view = mountWyrdWindow(host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close(); }, label: 'wyrd',
  });
  return overlay;
}

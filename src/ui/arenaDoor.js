// @ts-check
// ARENA3 (2026-10-02): THE ARENA WINDOW'S DOOR - the one place a host opens the Arena window through, the Reforge's door's
// shape (ui/reforgeDoor.js): the window (ui/arenaWindow.js) a lazy chunk mounted through the one home
// (ui/enhancedChunk.js), in a host of its own, wrapped in the generic overlay shape every host's frame already drives -
// `done` once it is shut, `dispose` to shut it, the keyboard and the pointer the window's own; registered with the
// overlay stack, so the QuickDial key puts it away as it does every enhanced window. Opened by the Herald, the banners'
// recruiters and the bookmaker at the gate (scenes/arenaGate.js), and by the pause window's Arena door once a banner is
// worn. A page with no document answers null. One stands at a time.
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';

/** The overlay standing now, or null. */
let _open = null;
/** Is the Arena window up. */
export const arenaDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeArenaDoor() {
  const was = arenaDoorOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot. `deps` is arenaWindow.js's own, less `onExit` - the door's close
 * is the window's way out - and plus `onClose`, the host's word that it is shut.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createArenaOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'arena-window-host';
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
    wheel() { /* its pages scroll themselves */ },
    hover() { /* its own :hover */ },
    tick() { /* a press repaints it */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
    /** The page shown, or null while the chunk loads. */
    page() { return view?.page?.() ?? null; },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./arenaWindow.js'),
    mount: ({ mountArenaWindow }) => { view = mountArenaWindow(host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close(); }, label: 'arena',
  });
  return overlay;
}

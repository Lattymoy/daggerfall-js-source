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
/** AUDIT PRE-MERGE 1003 U1: how often the standing window asks whether its model moved, seconds of the host's frame. */
export const ARENA_DOOR_REFRESH_S = 1;
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
  let since = 0;   // AUDIT PRE-MERGE 1003 U1: seconds since the window last asked
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
    // AUDIT PRE-MERGE 1003 U1: "a press repaints it" was the whole of it - online the window's model moves with no press
    // (the board in, the hall open, the queue heard, an offer and its 20-second clock), and the hall's socket is kept
    // only while the window asks for it (scenes/arenaOnline.js model -> wantHall): an idle window lost its hall under it
    // after HALL_IDLE_MS. Once a second of the host's frame the window asks its model again - drawn only when it moved
    // (ui/arenaWindow.js refresh), the focus and the scroll kept (U2)
    tick(dt = 0) {
      since += Number(dt) || 0;
      if (since < ARENA_DOOR_REFRESH_S) return;
      since = 0;
      view?.refresh?.();
    },
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

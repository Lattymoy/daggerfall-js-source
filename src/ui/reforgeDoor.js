// @ts-check
// LOOT9 (2026-10-01, the Loot arc - bible/06-Systems/Loot-Arc.md section 11): THE REFORGE'S DOOR - the one place a host
// opens the Reforge's window through, the Broker's door's shape (ui/brokerDoor.js): the window (ui/reforgeWindow.js) a
// lazy chunk mounted through the one home (ui/enhanced/enhancedChunk.js), in a host of its own, wrapped in the generic overlay
// shape every host's frame already drives - `done` once it is shut, `dispose` to shut it, the keyboard and the pointer
// the window's own; registered with the overlay stack, so the QuickDial key puts it away as it does every enhanced
// window. The Mages Guild's Identify service opens it (scenes/worldModes.js openGuildService - the popup's fourth row on
// either skin). A page with no document answers null. One stands at a time.
import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';
import { imbuePiece } from '../systems/reforge.js';   // LOOT-GATE: the Imbue, on the payer the host hands in
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

/** The overlay standing now, or null. */
let _open = null;
/** Is the Reforge's window up. */
export const reforgeDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeReforgeDoor() {
  const was = reforgeDoorOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot. `deps` is reforgeWindow.js's own, less `onExit` - the door's close
 * is the window's way out - and plus `onClose`, the host's word that it is shut.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createReforgeOverlay(deps) {
  noteFirstUse('reforge');   // TUT1
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'reforge-host';
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
    tick() { /* a press repaints it */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./reforgeWindow.js'),
    // LOOT-GATE: the Imbue on the host's own payer, unless the host hands its own (the hosts do not grow)
    mount: ({ mountReforgeWindow }) => { view = mountReforgeWindow(host, { imbue: (it) => imbuePiece(it, deps.payer()), ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close(); }, label: 'reforge',
  });
  return overlay;
}

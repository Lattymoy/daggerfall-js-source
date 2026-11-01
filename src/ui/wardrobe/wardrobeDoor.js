// @ts-check
// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): THE WARDROBE'S DOOR - the Reforge's door's shape
// (ui/reforgeDoor.js): the window (ui/wardrobe/wardrobeWindow.js) a lazy chunk mounted through the one home
// (ui/enhanced/enhancedChunk.js), in a host of its own, wrapped in the overlay shape every host's frame drives - `done`
// once it is shut, `dispose` to shut it - and registered with the overlay stack, so the QuickDial key puts it away.
// On either skin: a shop's popup row opens it (scenes/wardrobeCounter.js). A page with no document answers null.
import { mountEnhancedChunk } from '../enhanced/enhancedChunk.js';
import { registerOverlay } from '../enhanced/enhancedOverlays.js';
import { noteFirstUse } from '../../systems/tutorials.js'; // TUT1: the first touch of a system pops its tutorial page

/** The overlay standing now, or null. */
let _open = /** @type {any} */ (null);
/** Is the Wardrobe up. */
export const wardrobeDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeWardrobeDoor() {
  const was = wardrobeDoorOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot. `deps` is wardrobeWindow.js's own less `onExit` - the door's close
 * is the window's way out - plus `onClose`, the host's word that it is shut.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createWardrobeOverlay(deps) {
  noteFirstUse('shops'); // TUT1: the counter is a shop's
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = /** @type {any} */ (null);
  const host = document.createElement('div');
  host.id = 'wardrobe-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};
  const close = () => {
    if (fired) return;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true; // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.();
  };
  unregister = registerOverlay(close);
  const overlay = {
    isChoiceWindow: true,
    get done() {
      return fired;
    },
    input() {
      /* the window's own capture keydown owns the keyboard */
    },
    click() {
      /* the window is a fixed div over the canvas; pointers never get here */
    },
    wheel() {
      /* its list scrolls itself */
    },
    hover() {
      /* its own :hover */
    },
    tick() {
      /* a press repaints it */
    },
    draw() {
      /* DOM, not canvas */
    },
    dispose() {
      close();
    },
    repaint() {
      view?.repaint();
    },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./wardrobeWindow.js'),
    mount: ({ mountWardrobeWindow }) => {
      view = mountWardrobeWindow(host, { ...deps, onExit: close });
    },
    alive: () => !fired,
    host,
    onDismiss: () => {
      close();
    },
    label: 'wardrobe',
  });
  return overlay;
}

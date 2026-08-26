// ═══════════════════════════════════════════════════════════════════
// U53 — THE INVENTORY DOOR: which pack the player opens, and the ONE
// place that builds either.
//
// The fourth seam of this shape, and the second that had to be MADE.
// FIVE sites constructed `new NativeInventoryWindow({ ... })`: three
// host factories, and TWO hand-rolled copies of a factory that was
// already in the same file and already took the extra keys they
// needed. The copies were verbatim - eleven identical hooks each,
// plus `loot` and `onClose`, which is exactly what `...extra` is for -
// and their indentation had drifted, which is what a copy-paste looks
// like a month later. Same finding as U52's, twice over.
//
// ── THE FORK IS NARROW, AND SAYS WHERE IT STOPS ──────────────────
//
// The classic window is not one screen. It is the pack, the LOOT pile,
// the WAGON, the guild REWARD picker, drop-gold and the whole USE
// chain (books, potions, maps, the spellbook item), each with its own
// DFU law. The enhanced screen answers the first of those - open your
// pack, see what you are wearing, wear something else - and the door
// hands the CLASSIC window every call that carries a `loot` target or
// a `chooseOne` list.
//
// That is a boundary, not a gap. A player who opens a corpse gets the
// proven window that has always opened it, and the never-traps law is
// served because nothing is unreachable; what would break the law is
// an enhanced pack that silently dropped the wagon on the floor. The
// remaining flows are their own slice and are named in the arc.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { NativeInventoryWindow, inventoryArtLoaded } from './nativeInventory.js';

export { inventoryArtLoaded };

/** The gate a host asks before it opens the pack. The classic window
 *  cannot draw without INVE00I0 and its icon archives; the enhanced
 *  one reads no ARENA2 at all. Same law as ui/pauseDoor.js and
 *  ui/charSheetDoor.js. */
export function inventoryDoorReady() {
  return isEnhanced() || inventoryArtLoaded();
}

/** The flows the enhanced pack does not answer yet, each of which is
 *  a whole DFU window's worth of law living inside the classic one.
 *  Exported so the pin reads the same list the fork does. */
export const CLASSIC_ONLY_MODES = Object.freeze(['loot', 'chooseOne']);

/** True when this call is one of those. */
export const needsClassicInventory = (deps = {}) =>
  CLASSIC_ONLY_MODES.some((k) => deps[k] != null);

/**
 * Build the pack this skin wears. `deps` is NativeInventoryWindow's
 * own hook bag, unchanged - a host says what it HAS and never which
 * window that adds up to.
 */
export function createInventoryWindow(deps = {}) {
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather
  // than getting a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined' && !needsClassicInventory(deps)) {
    return enhancedInventoryOverlay(deps);
  }
  return new NativeInventoryWindow(deps);
}

/**
 * THE ENHANCED PACK, in the shape the hosts already push.
 *
 * A leaf, unlike U52's sheet: nothing it opens is a canvas window, so
 * there is no child to hide behind and every host arm is a NO-OP BY
 * DESIGN - the wizard's and the pause door's contract rather than the
 * sheet's. It says so at each arm, because a silently empty input()
 * is indistinguishable from a broken one.
 */
function enhancedInventoryOverlay(deps) {
  let fired = false;
  let view = null;

  const host = document.createElement('div');
  host.id = 'enhanced-inventory';
  // z-index 13, the depth every in-game enhanced screen shares: they
  // are peers and are never stacked on each other.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:#0e1013;overflow:hidden';
  document.body.append(host);

  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
    // AUDIT 17e F28's law, carried: DFU frees the container on window
    // close, and a host that handed onClose is owed the call whatever
    // skin drew the window.
    deps.onClose?.();
  };

  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  import('./enhancedInventory.js').then(({ mountEnhancedInventory }) => {
    if (fired) { host.remove(); return; }   // disposed before the module landed
    view = mountEnhancedInventory(host, { ...deps, onExit: close });
  }).catch((e) => {
    console.warn('[inventory] the enhanced pack would not mount', e);
    host.remove();
    fired = true;
  });

  return overlay;
}

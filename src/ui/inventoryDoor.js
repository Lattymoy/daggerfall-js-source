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
// ── THE FORK WAS NARROW, AND U58 CLOSED IT ───────────────────────
//
// The classic window is not one screen. It is the pack, the LOOT pile,
// the WAGON, the guild REWARD picker, drop-gold and the whole USE
// chain, each with its own DFU law. U53 shipped the first of those and
// handed the classic window every call carrying a `loot` target or a
// `chooseOne` list - a boundary rather than a gap, since nothing was
// unreachable.
//
// U58 removed it, and could only remove it because U56 and U57 took
// the law out of the window first: TransferItem's ladder is
// systems/itemTransfer.js, the remote side's four claims and the
// wagon's two refusals are systems/inventorySession.js, and the
// enhanced pane runs both rather than a second reading of either.
// `CLASSIC_ONLY_MODES` is gone; the fork is now the plain skin
// question every other door asks.
//
// WHAT THE DOOR STILL OWES: the drop pile. DFU mints a world flat from
// the session's dropped items in OnPop (AUDIT B-C1), and the window
// GOING is the door's event rather than the view's - so the door reads
// the pile back out of the view and runs the same closeSession the
// classic window runs.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { NativeInventoryWindow, inventoryArtLoaded } from './nativeInventory.js';
import { closeSession } from '../systems/inventorySession.js';

export { inventoryArtLoaded };

/** The gate a host asks before it opens the pack. The classic window
 *  cannot draw without INVE00I0 and its icon archives; the enhanced
 *  one reads no ARENA2 at all. Same law as ui/pauseDoor.js and
 *  ui/charSheetDoor.js. */
export function inventoryDoorReady() {
  return isEnhanced() || inventoryArtLoaded();
}

/**
 * Build the pack this skin wears. `deps` is NativeInventoryWindow's
 * own hook bag, unchanged - a host says what it HAS and never which
 * window that adds up to.
 */
export function createInventoryWindow(deps = {}) {
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather
  // than getting a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') {
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
  // PX17c (Mac: "IT SHOULD BE TRANSPARENT LIKE THE REFERENCE"): the
  // pack's own scrims carry the tone now (PX16b/c) and the reference's
  // ground is THE GAME - this opaque slab was the pause door's pre-PX4
  // shape, one door over, and it blacked out every scrim behind it.
  // Same standing caveat as PX4: the classic window keeps its own
  // opaque draw; only the enhanced host goes glass.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);

  const close = () => {
    if (fired) return;
    // THE PILE IS READ BEFORE THE UNMOUNT, which clears the view's
    // state. A drop that mints nothing is not a visible bug - it looks
    // like the player misremembered dropping something.
    const dropped = view?.dropped?.() ?? [];
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
    // OnPop, through the module the classic window uses: the session's
    // dropped items mint their world flat and the container releases.
    // AUDIT 17e F28's law is the second half of that - a host that
    // handed onClose is owed the call whatever skin drew the window.
    closeSession(deps, { dropped });
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

// ═══════════════════════════════════════════════════════════════════
// U52 — THE CHARACTER SHEET DOOR: which sheet F5 opens, and the ONE
// place that builds either.
//
// The third seam of this shape (U50's createChargenWindow, U51's
// openPauseFlow) and the first one that had to be MADE rather than
// found: nothing funnelled the sheet. Three hosts each wrote
// `new CharSheet(playerEntity, charSheetHooks({ ... }))` by hand, and
// exterior.js wrote it TWICE - once as `makeCharSheetWindow` for the
// interior host to borrow, and once inline in its own F5 arm, with the
// second copy missing the first's reasoning about the withheld quest
// hooks. They agree today. That is what drift looks like the day
// before it stops being true, and it is the exact shape AUDIT 17i
// split createChargenWindow out for.
//
// So the door builds the hooks AND the window. A host says what it
// HAS - its inventory, its spellbook, its quest bridge - and never
// which sheet that adds up to.
//
// ── THE CHILD WINDOWS ARE THE HARD PART ──────────────────────────
//
// The sheet is not a leaf. Its four navigation buttons PUSH a window
// (DFU's UI stack), and the port's hosts hold ONE overlay slot, so
// CharSheet owns its child and delegates to it - see its constructor's
// own note. Those children are classic CANVAS windows, and the
// enhanced sheet is an opaque DOM div over that canvas: a child pushed
// under a live enhanced sheet would draw perfectly, underneath
// something you cannot see through.
//
// The enhanced overlay therefore HIDES ITSELF while a child is up and
// forwards the whole contract down - and `draw` is the one that only
// exists because the child is canvas. U42 is the warning: the classic
// sheet forwarded tick, wheel, input and click and NOT hover, and the
// spellbook silently lost its highlight and all three tooltips on
// exactly the route three of the four hosts take. Every arm is
// forwarded here and every arm is pinned.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { CharSheet, charSheetArtLoaded } from './charsheet.js';
import { charSheetHooks } from './charSheetNav.js';

export { charSheetArtLoaded };

/** The gate a host asks before it opens the sheet. The classic window
 *  has a text fallback and survives a failed art load; the enhanced
 *  one reads no ARENA2 at all. Same law as ui/pauseDoor.js. */
export function charSheetDoorReady() {
  return isEnhanced() || charSheetArtLoaded();
}

/**
 * Build the sheet this skin wears. `deps` is charSheetHooks' own bag -
 * { entity, inventory, spellbook, questMessages, notebook, artDeps } -
 * and a host that hands no hook gets the sheet's honest refusal on that
 * button, on either skin.
 */
export function createCharSheetWindow(deps = {}) {
  const hooks = charSheetHooks(deps);
  // `document` for the reason chargenSession's and pauseDoor's forks
  // give: node drives these hosts headless and keeps the canvas window
  // rather than getting a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') {
    // PX27: THE ENHANCED SHEET IS THE PAUSE WINDOW'S STATS PAGE.
    //
    // There were two enhanced character sheets - this door's overlay
    // and the pause window's Stats tab - reading the SAME four
    // sections out of the SAME sheetModel, which enhancedMenu imports
    // from enhancedCharSheet.js. One of them was the last pre-PX
    // surface in the game and drew its three columns hard against the
    // left edge; the other is the sheet this arc built. Keeping both
    // was the fault the F5 overlay existed to demonstrate.
    //
    // The DOOR's contract does not change - the host is handed an
    // overlay it mounts, exactly as before - so no host learns
    // anything new. What changes is which face is inside it, and the
    // sheet's own four buttons become that page's doors, out of these
    // same hooks: PX25 built the Stats page to take them.
    return enhancedSheetPageOverlay(hooks);
  }
  return new CharSheet(deps.entity, hooks);
}

/**
 * PX27: the pause window, opened on Stats, in the overlay shape the
 * hosts already push. The keyboard, the scrim and the frame are all
 * enhancedMenu's; this only chooses the page and forwards the sheet's
 * own four buttons onto it.
 */
function enhancedSheetPageOverlay(hooks) {
  let fired = false;
  let view = null;
  let unregister = () => {};   // PX28
  const host = document.createElement('div');
  host.id = 'enhanced-sheetpage';
  // z-index 13, the pause door's depth: they are peers, never stacked.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    try { view?.unmount?.(); } catch { /* already gone */ }
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
    unregister();
  };
  // PX28: AFTER `close` exists - a const is not hoisted, and the
  // first placement of this line read it before its initialiser.
  unregister = registerOverlay(close);
  import('./enhancedMenu.js').then(({ mountEnhancedMenu }) => {
    if (fired) return;
    view = mountEnhancedMenu(host, {
      mode: 'pause',
      at: 'stats',
      onAction: (a) => { if (a === 'resume') close(); },
      // The sheet's own buttons, onto the page PX25 built to take
      // them. A host that hands no hook gets no button, which is the
      // same honest refusal the classic sheet gives.
      hooks: {
        openPack: hooks.inventory ? () => { close(); hooks.inventory(); } : undefined,
        openSpellbook: hooks.spellbook ? () => { close(); hooks.spellbook(); } : undefined,
        openChronicle: hooks.logbook ? () => { close(); hooks.logbook(); } : undefined,
      },
    });
  }).catch((e) => {
    console.warn('[charsheet] the sheet page would not mount:', e?.message ?? e);
    close();
  });
  return {
    get done() { return fired; },
    draw() {},
    onKey() { return false; },
    onPointer() { return false; },
    close,
    // `dispose` and `destroy` are both the hosts' words for the same
    // act; the overlay this replaced answered both, so this does too.
    dispose: close,
    destroy: close,
  };
}

/* PX27: THE ENHANCED SHEET OVERLAY IS RETIRED.
 *
 * It lived here from U52 until this slice and was the last pre-PX
 * surface in the game: a `.sheet-shell` of three columns filling the
 * viewport from the left edge, with the sheet's four buttons down its
 * side. Everything it showed, the pause window's Stats page shows -
 * the same four sections out of the same sheetModel, which
 * enhancedMenu imports from ui/enhancedCharSheet.js - and since PX25
 * that page takes the four buttons too.
 *
 * `ui/enhancedCharSheet.js` STAYS: `sheetModel` is the model both
 * sheets always read, and it is now read by the one that remains.
 * What went is the ~200 lines of view that drew the second one.
 */


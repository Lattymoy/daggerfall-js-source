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
    return enhancedCharSheetOverlay(deps.entity, hooks);
  }
  return new CharSheet(deps.entity, hooks);
}

/**
 * THE ENHANCED SHEET, in the shape the hosts already push.
 *
 * With no child up it is the wizard's and the pause door's contract:
 * a fixed opaque div, its own keyboard, every host arm a no-op BY
 * DESIGN. With a child up it is the OPPOSITE - the div goes hidden and
 * every arm forwards, because the child is a canvas window drawing
 * underneath.
 */
function enhancedCharSheetOverlay(entity, hooks) {
  let fired = false;
  let view = null;
  let child = null;

  const host = document.createElement('div');
  host.id = 'enhanced-charsheet';
  // z-index 13, the pause door's depth: they are peers, never stacked.
  // PX17c: the same glass as the inventory door - one family, one
  // ground (the paused game), the pause door's PX4 law finished.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);

  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
  };

  /** A finished child pops, and the sheet comes back. CharSheet's own
   *  `_stepChild`, with the DOM half added. */
  const stepChild = () => {
    if (child?.done) {
      child.dispose?.();
      child = null;
      host.style.visibility = '';
      view?.repaint?.();   // the pack may have changed while it was up
    }
    return !!child;
  };

  /** PushWindow. The hook's own refusal travels: a host that hands no
   *  factory gets the sheet's notice, not a dead button. */
  const open = (which) => {
    const w = hooks[which]?.();
    if (!w) return false;
    child = w;
    // HIDDEN, NOT REMOVED. The child draws on the canvas underneath and
    // this div is opaque; visibility keeps the mounted view alive so
    // popping back is instant and the scroll position survives.
    host.style.visibility = 'hidden';
    return true;
  };

  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    // EVERY ARM FORWARDS WHILE A CHILD IS UP (U42's lesson), and does
    // nothing otherwise - the view owns its own input the way the
    // wizard's and the pause door's do.
    input(action, e = null) {
      if (child) { child.input?.(action, e); stepChild(); }
      /* else: the view's own capture keydown owns the keyboard */
    },
    click(vx, vy) {
      if (!child) return false;   /* the view is a fixed opaque div; pointers never get here */
      if (child.clickNative) child.clickNative(vx, vy);
      else child.click?.(vx, vy);
      stepChild();
      return true;
    },
    wheel(dir) {
      if (!child) return false;   /* the view scrolls itself */
      child.wheel?.(dir);
      stepChild();
      return true;
    },
    hover(vx, vy, e = null) {
      // U42 EXACTLY: the host seams test for `hover` on the OVERLAY and
      // never reach the child when it is missing, which cost the
      // spellbook its highlight and its tooltips on this very route.
      if (!child) return false;
      child.hover?.(vx, vy, e);
      stepChild();
      return true;
    },
    tick(dt) {
      if (child) { child.tick?.(dt); stepChild(); }
      /* else: nothing on this screen moves on a clock */
    },
    draw(renderer, canvas, font, s) {
      // The ONLY arm that exists because the child is canvas. With no
      // child there is nothing to draw - this screen is DOM.
      if (child) return child.draw?.(renderer, canvas, font, s);
      return undefined;
    },
    dispose() {
      child?.dispose?.();
      child = null;
      close();
    },
  };

  // Mounted lazily so a player on the classic skin never loads a byte
  // of the enhanced sheet. A failure costs the sheet, so it says so and
  // takes its empty div with it rather than leaving the host holding an
  // overlay that never reports done - a frozen game.
  import('./enhancedCharSheet.js').then(({ mountEnhancedCharSheet }) => {
    if (fired) { host.remove(); return; }   // disposed before the module landed
    view = mountEnhancedCharSheet(host, {
      entity,
      hooks,
      open,
      onExit: close,
    });
  }).catch((e) => {
    console.warn('[charsheet] the enhanced sheet would not mount', e);
    host.remove();
    fired = true;
  });

  return overlay;
}

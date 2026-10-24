// @ts-check
// RVN-STARS (2026-10-17; bible/06-Systems/Revenants.md section 44) - A SWORN REVENANT'S STARS, LAID OVER THE PAUSE WINDOW
// (named firmamentOver.js, not *Door.js: it hands no window to a host's slot - it lays a sky OVER a door's page, so
// CRASH2's slot contract is not its law): the Companions page's Stars, its sky (ui/revenantStarsWindow.js) over the pause
// window and the page put back on Companions when it closes, on either door that draws the page (ui/pauseDoor.js -
// Escape and Tab's dial; ui/charSheetDoor.js - the sheet key). ONE CONSTRUCTION SEAM (AUDIT 17i): both doors build the
// same thing, so it is built here once (`overPage`) - the page giving the keyboard up first (two capture handlers would
// answer Escape twice), and the page put back when the sky closes. Through the ONE lazy-chunk door
// (ui/enhanced/enhancedChunk.js), so a chunk that will not load says so and the page stays up behind the notice.
//
// FIRM1's Firmament had this door first (the Stats page's Firmament button); GROWTH3 (bible/10-UI/Growth.md section 6)
// draws the Firmament in the pause window's Growth tab, so its door went. The owner, of the revenants' (2026-10-17):
// "Keep it on the companion page" - this one stays.

import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';   // AUDIT RVN-STARS S8: the QuickDial's key asks the sky first

/**
 * A window laid over a door's page, through the lazy-chunk door: `load` its chunk, `mount(mod, host, arg, onExit)` it;
 * `alive()`, `below()`, `back()` the door's. Answers `{ open(arg), drop, up }`.
 * @param {{ alive: () => boolean, below: () => void, back: () => void, id: string, label: string, load: () => Promise<any>,
 *   mount: (mod: any, host: HTMLElement, arg: any, onExit: () => void) => { destroy?: () => void, back?: () => boolean } }} o
 */
function overPage({ alive, below, back, id, label, load, mount }) {
  let host = /** @type {HTMLElement|null} */ (null);
  let view = /** @type {{ destroy?: () => void, back?: () => boolean }|null} */ (null);
  function drop() {
    const v = view, h = host;
    view = null;   // the slot is emptied before the occupant is told (THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD)
    host = null;
    try { v?.destroy?.(); } catch { /* already gone */ }
    h?.remove();
  }
  function open(arg) {
    if (host || !alive()) return;
    const h = document.createElement('div');
    h.id = id;
    // 14: above the page's 13, the Ascension's own depth
    h.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
    document.body.append(h);
    host = h;
    const gone = () => { if (host === h) drop(); else h.remove(); };
    mountEnhancedChunk({
      load,
      alive: () => alive() && host === h,
      host: h, onDismiss: gone, label,
      mount: (mod) => {
        below();
        view = mount(mod, h, arg, () => {
          if (host !== h) return;
          host = null;
          view = null;
          h.remove();
          if (alive()) back();
        });
      },
    });
  }
  return { open, drop, up: () => !!host, view: () => view };
}

/**
 * RVN-STARS: a door's sworn revenant's stars - the Companions page's Stars (`hook(id)`), the sky over the page; `back()` puts the page back (on Companions), the focus on its Stars again (AUDIT RVN-STARS S21). Offline
 * and online alike: its sky is the save's. AUDIT RVN-STARS S8: on the overlays' stack while it stands, the QuickDial's key
 * asking it first, as the captain's door does (`dialCloser`) - the F5 sheet's own entry under
 * it had shut the sheet and thrown away an unaccepted sky unasked.
 * @param {{ alive: () => boolean, below: () => void, back: () => void }} o
 */
export function revenantStarsOver({ alive, below, back }) {
  let last = null;
  const o = overPage({
    alive, below, id: 'enhanced-revenant-stars-view', label: 'revenant-stars',
    back: () => { back(); refocus(last); },
    load: () => import('./revenantStarsWindow.js'),
    mount: ({ mountRevenantStarsWindow }, h, id, onExit) => {
      let unregister = () => {};
      const view = mountRevenantStarsWindow(h, { id, onExit: () => { unregister(); onExit(); } });
      const closer = () => { if (view.tryClose() === false) unregister = registerOverlay(closer); };
      unregister = registerOverlay(closer);
      return { ...view, destroy: () => { unregister(); view.destroy(); } };
    },
  });
  return {
    hook: (id) => { last = id; o.open(id); }, drop: o.drop, up: o.up,
    /** AUDIT GROWTH LANE4-1 (GROWTH5's law, S8's for the sheet's own keys): a press that would drop the sky asks it first -
     *  unaccepted stars said once (skyWindow.js back()), whether it took the press. */
    asks: () => { try { return !!o.view()?.back?.(); } catch { return false; } },
    /** Test seam: the window standing. */ view: o.view,
  };
}
/** The page's Stars button for `id` focused again (the page is mounted now, or a lazy chunk's moment later). */
function refocus(id) {
  if (!id || typeof document === 'undefined') return;
  const go = () => /** @type {any} */ (globalThis.document?.querySelector?.(`[data-focus="cmp-${id}-stars"]`))?.focus?.({ preventScroll: true });   // read late: a page gone by then focuses nothing
  go();
  setTimeout(go, 60);
}

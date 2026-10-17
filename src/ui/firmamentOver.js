// @ts-check
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - THE FIRMAMENT'S DOOR (named firmamentOver.js, not *Door.js: it hands no window to a host's slot - it lays the sky OVER a door's page, so CRASH2's slot contract is not its law): the Stats page's Firmament button, on either
// door that draws that page (ui/pauseDoor.js - Escape and Tab's dial; ui/charSheetDoor.js - the sheet key). ONE
// CONSTRUCTION SEAM (AUDIT 17i): both doors build the same thing, so it is built here once and each door calls it -
// ASCEND-ANYTIME's own shape: the sky swapped in OVER the page it is pressed from, the page giving the keyboard up first
// (two capture handlers would answer Escape twice), and the page put back when the sky closes. Through the ONE
// lazy-chunk door (ui/enhanced/enhancedChunk.js), so a chunk that will not load says so and the page stays up behind the notice.
//
// The button is drawn only ONLINE - where the page has a book (net/firmament/firmamentBook.js): offline there is no sky to spend.

import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';
import { firmamentBook } from '../net/firmament/firmamentBook.js';

/**
 * A door's Firmament: `alive()` whether the door is still up; `below()` takes the page down (its keyboard first);
 * `back()` puts the page back after the sky closes. Answers `{ hook, drop, up }` - `hook` the Stats page's button's
 * function (undefined offline, so no button is drawn), `drop` takes the sky down with the door.
 * @param {{ alive: () => boolean, below: () => void, back: () => void }} o
 */
export function firmamentOver({ alive, below, back }) {
  let host = /** @type {HTMLElement|null} */ (null);
  let view = /** @type {{ destroy?: () => void }|null} */ (null);
  function drop() {
    const v = view, h = host;
    view = null;   // the slot is emptied before the occupant is told (THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD)
    host = null;
    try { v?.destroy?.(); } catch { /* already gone */ }
    h?.remove();
  }
  function open() {
    if (host || !alive()) return;
    const h = document.createElement('div');
    h.id = 'enhanced-firmament-view';
    // 14: above the page's 13, the Ascension's own depth
    h.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
    document.body.append(h);
    host = h;
    const gone = () => { if (host === h) drop(); else h.remove(); };
    mountEnhancedChunk({
      load: () => import('./firmamentWindow.js'),
      alive: () => alive() && host === h,
      host: h, onDismiss: gone, label: 'firmament',
      mount: ({ mountFirmamentWindow }) => {
        below();
        view = mountFirmamentWindow(h, {
          onExit: () => {
            if (host !== h) return;
            host = null;
            view = null;
            h.remove();
            if (alive()) back();
          },
        });
      },
    });
  }
  return {
    get hook() { return firmamentBook() ? open : undefined; },
    drop,
    up: () => !!host,
  };
}

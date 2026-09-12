// ═══════════════════════════════════════════════════════════════════
// EB1 - THE BOOK READER'S ONE DOOR (2026-09-12).
//
// Mac: "For the book reader, I was wondering if we could use the
// animated book in my repo project-raum." Then: "Do it."
//
// The eighth door of the shape the pause, the pack, the sheet, the
// spellbook, the chronicle, the travel map and the talk panel wear:
// ONE function builds the reader this skin shows, and the hosts'
// openBook hook (DaggerfallInventoryWindow's book arm, the shelf's
// BS1 pick) never learns which face it got. The hook moved here from
// ui/bookReader.js with the fork, so the reader has exactly one
// construction site.
//
// ── ONE MODEL, TWO FACES (the talk panel's rule) ─────────────────
//
// The classic BookReaderWindow is built on BOTH skins: its
// constructor plays OpenBook, its lines are LocalizedBook's converted
// rows, its input arm is the exit's ButtonClick. Under the enhanced
// skin the face over it is project-raum's animated book
// (ui/enhancedBook.js over vendor/raum-book/), which cuts the model's
// laid-out labels into leaves and sets them in the skin's serif.
//
// ── THE HAND-OFF LAW STANDS ──────────────────────────────────────
//
// The inventory hands over THEN closes (UI-Arc: "a failed open still
// reports on this window - it is the live overlay until the reader
// actually shows"), so the reader mounts while the enhanced pack is
// still on the screen: its canvas sits ABOVE the pack (z-index 14 to
// the pack's 13) and the pack's close leaves it standing.
// EB4: the file lands a microtask after the pack said it was done and
// a frame before the slot drops it, so the hosts take a reader over a
// DONE occupant (townTalk.overlayDone), and the canvas is raised on
// the host's first draw - never at construction, where a declined
// hand-off left it standing over the view with nothing painting it.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { requestLook } from '../player/pointerLock.js';   // MAC1: the relock rides the closing gesture
import { BookReaderWindow } from './bookReader.js';
import { BookFile } from '../formats/bookFile.js';
import { getBookFileName } from '../systems/books.js';
import { setBookAuthor } from '../systems/itemInfo.js';   // IM1: the %ba cache

/** Build the reader this skin wears over an opened BookFile. */
export function createBookReaderWindow(bookFile) {
  const model = new BookReaderWindow(bookFile);
  // `document` for the reason every door gives: node drives the hosts
  // headless and keeps the canvas window.
  if (isEnhanced() && typeof document !== 'undefined') return enhancedBookOverlay(model);
  return model;
}

/** The hosts' openBook hook (DaggerfallInventoryWindow's book arm:
 *  OpenBook then push the reader; a failed open is the "ruined book"
 *  box, which the CALLER shows via onFail - the inventory owns its
 *  boxes). showReader swaps the host's overlay to the built window. */
export function makeOpenBookHook({ fetchBytes, showReader }) {
  return async (item, onFail) => {
    const name = getBookFileName(item?.message ?? -1);
    if (!name) { onFail?.(); return; }
    try {
      const bookFile = new BookFile();
      bookFile.load(await fetchBytes(name), name);
      // IM1: the file's author line feeds the %ba cache - DFU reads it
      // at info time (BookAuthor :162-183); the port's read is here.
      setBookAuthor(item?.message, bookFile.author);
      showReader(createBookReaderWindow(bookFile));
    } catch (e) {
      console.warn(`[book] ${name} failed to open:`, e?.message ?? e);
      onFail?.();
    }
  };
}

function enhancedBookOverlay(model) {
  let el = null;
  let view = null;
  let torn = false;
  let mounted = false;
  let hostCanvas = null;   // the world's canvas, learned from draw(): the relock's target
  let unregister = () => {};
  const teardown = () => {
    if (torn) return;
    torn = true;   // `done` reads this: true only once the book has left
    unregister();
    try { view?.destroy?.(); } catch { /* already gone */ }
    try { el?.remove(); } catch { /* ditto */ }
    el = null; view = null;
  };
  const relock = () => { if (hostCanvas) requestLook(hostCanvas); };
  // The exit through the FACE, so the cover shuts and the book sinks
  // before the overlay is dropped; before the face has mounted, the
  // classic arm (ButtonClick, done) and a plain teardown.
  const exit = () => {
    if (torn) return;
    if (view) view.key('Escape');
    else { if (!model.done) model.input('Escape'); relock(); teardown(); }
  };
  // EB4 (Mac: "tapping use doesn't do anything and then locks me out
  // of pointerclick in inventory"): THE CANVAS MOUNTS ON THE HOST'S
  // FIRST DRAW, not on construction. The hook builds this window
  // before it knows whether the host will take it - showReader can
  // decline - and a canvas raised at construction stood over the
  // whole view with nothing painting it, taking every pointer. Now
  // an overlay the host never draws leaves nothing behind.
  const mount = () => {
    if (mounted || torn) return;
    mounted = true;
    el = document.createElement('canvas');
    el.id = 'enhanced-book';
    // Above the enhanced pack (z 13): the inventory hands over THEN
    // closes, so for a moment both stand. No wash: the world reads
    // through, and the canvas takes every pointer so the world does not.
    el.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;z-index:14;image-rendering:pixelated;touch-action:none';
    document.body.append(el);
    unregister = registerOverlay(exit);
    import('./enhancedBook.js').then(({ mountEnhancedBook }) => {
      if (torn) return;
      view = mountEnhancedBook(el, { model, onExit: teardown, relock });
    }).catch((e) => {
      console.warn('[book] the enhanced book could not mount:', e?.message ?? e);
      exit();
    });
  };
  return {
    // THE HOST CONTRACT, in the hosts' own words (ui/pauseDoor.js's
    // shape): the arms the slots dereference, and dispose on
    // replacement.
    isChoiceWindow: true,
    get done() { return torn; },
    input(code) {
      if (torn) return;
      if (view) view.key(code);
      else if (code === 'Escape' || code === 'Enter' || code === 'KeyE') exit();
    },
    click() { return true; },   // consumed: nothing beside the book grabs the pointer
    wheel() { /* the canvas has its own wheel */ },
    hover() { /* no canvas hit-test: the book's own */ },
    tick() { /* the clock is paintBook's */ },
    /** Per frame: the first draw is the host's acceptance and mounts
     *  the canvas; after that the book paints itself, and the host's
     *  canvas is remembered for the relock. */
    draw(renderer, canvas) {
      hostCanvas = canvas ?? hostCanvas;
      if (!mounted) mount();
      view?.frame?.();
    },
    close: exit,
    dispose: teardown,
    destroy: teardown,
  };
}

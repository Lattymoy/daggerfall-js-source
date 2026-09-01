// PX23 - THE SPELLBOOK'S ONE DOOR.
//
// Mac's call: the spellbook next. The board named it and its own greps
// still hold - FOUR hosts built the player's book with the SAME deps
// and one difference each, the way each reaches TEXT.RSC:
//
//   scenes/dungeonContext.js   rows: textRsc?.variantLinesById(id)
//   scenes/exterior.js         rows: townTalk.lines(id)
//   scenes/world.js            rows: townTalk.lines(id)
//   scenes/worldModes.js       rows: townTalk?.lines?.(id) ?? []
//
// Everything else was byte-identical: the spell list latched onto the
// entity, the entity itself, calculateCastCost, and readySpell with the
// lycanthropy spell's free cast. That is U52's finding and U53's, a
// fifth time - and the answer is the same answer: ONE seam that builds
// the window, and each host hands it what only that host knows.
//
// THE BUY WINDOW IS NOT THIS. worldModes.js:2373 builds a SpellbookWindow
// too and looks like a duplicate from a distance; it is the spell
// merchant's shop - buyMode, with `offered`, the building's quality,
// the shop name, the haggling skills and the classic clock. Different
// question, different deps, and it stays where it is. The board called
// it "a hand-rolled second one"; it is a second WINDOW, and this door
// does not take it.
//
// The skin fork is charSheetDoor's, for the reason that door gives:
// the classic window survives a failed art load and the enhanced one
// reads no ARENA2 at all, so the readiness gate differs by skin.
import { isEnhanced } from '../systems/uiSkin.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { SpellbookWindow, spellbookArtLoaded } from './spellbookWindow.js';

export { spellbookArtLoaded };

/** The gate a host asks before it opens the book. Same law as
 *  ui/charSheetDoor.js and ui/pauseDoor.js. */
export function spellbookDoorReady() {
  return isEnhanced() || spellbookArtLoaded();
}

/**
 * Build the player's spellbook in the skin it is wearing.
 *
 * `deps` is what only the HOST knows:
 *   entity     the player
 *   magic      the one cast engine (M3: the ready laws live there)
 *   castCost   spell -> point cost for this entity
 *   rows       a TEXT.RSC id -> its lines, however this host reaches it
 *   onClose    optional; the host's own overlay bookkeeping
 *
 * Returns null when the skin's gate refuses, which is the answer every
 * host's `makeSpellbookWindow` already gave.
 */
export function createSpellbookWindow(deps = {}) {
  if (!spellbookDoorReady()) return null;
  const { entity, magic, castCost, rows, onClose } = deps;
  const shared = {
    // The latch is the hosts' own: `??=` so a player who has never cast
    // gets an array rather than undefined, and the SAME array every
    // call, because the window edits it in place (delete, sort).
    spells: () => (entity.spells ??= []),
    entity,
    castCost,
    // M3: SpellsListBox_OnUseSelectedItem (:770-784) is SetReadySpell
    // then PopToHUD, and the lycanthropy spell casts free. The window
    // decides WHICH spell is free; the engine owns what readying means.
    onReady: (sp, { noSpellPointCost } = {}) => magic?.readySpell?.(sp, { free: !!noSpellPointCost }),
    rows: rows ?? (() => []),
  };
  if (isEnhanced() && typeof document !== 'undefined') {
    // `document` for the reason charSheetDoor and pauseDoor give: node
    // drives these hosts headless and keeps the canvas window rather
    // than having a special case written for it.
    return enhancedSpellbookOverlay(shared, onClose);
  }
  const win = new SpellbookWindow({ ...shared, onClose });
  return win;
}

/**
 * THE ENHANCED BOOK, in the shape the hosts already push: an object
 * with the overlay contract they hand keys and frames to. The DOM is
 * mounted lazily so a host that builds the window and never shows it
 * costs nothing.
 */
function enhancedSpellbookOverlay(shared, onClose) {
  let host = null;
  let view = null;
  let done = false;
  let unregister = () => {};   // PX28: Tab must be able to put this away
  const close = () => {
    if (done) return;
    done = true;
    unregister();
    try { view?.destroy?.(); } catch { /* already gone */ }
    try { host?.remove(); } catch { /* ditto */ }
    host = null; view = null;
    onClose?.();
  };
  const mount = () => {
    if (host || done) return;
    host = document.createElement('div');
    host.id = 'enhanced-spellbook';
    host.style.cssText = 'position:fixed;inset:0;z-index:11';
    document.body.append(host);
  unregister = registerOverlay(close);
    import('./enhancedSpellbook.js').then(({ mountEnhancedSpellbook }) => {
      if (done) return;
      view = mountEnhancedSpellbook(host, { ...shared, onExit: close });
    }).catch((e) => {
      console.warn('[spellbook] the enhanced book could not mount:', e?.message ?? e);
      close();
    });
  };
  mount();
  return {
    // THE HOST CONTRACT, in the hosts' own words - `input`, not
    // `onKey`. The hosts dereference these unguarded
    // (dungeonContext.js `activeOverlay.input(action, e)`,
    // townTalk.js, worldModes.js) and the DOM view only claims the
    // keys it uses, so every other key arrives here; a missing arm is
    // a TypeError thrown inside the host's keydown handler. Same arms
    // as ui/pauseDoor.js and ui/inventoryDoor.js.
    isChoiceWindow: true,
    get done() { return done; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    // `close`, `dispose` and `destroy` are the hosts' three words for
    // the same act - townTalk's showOverlay frees the outgoing window
    // with `dispose?.()`, and without it the div outlives the object.
    close,
    dispose: close,
    destroy: close,
  };
}

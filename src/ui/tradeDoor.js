// THE TRADE DOOR — which shop counter the player sees, and the ONE
// place that builds either. The same fork ui/inventoryDoor.js already
// closed for the pack: the classic screen is nativeTrade.js's canvas
// window over INVE00I0/SHOP00I0, and the enhanced skin is
// enhancedTrade.js's DOM screen, built to the enhanced inventory's own
// `.packcol`/`.itemrow` structure. A host builds the hooks bag once
// (see the doc comment above `NativeTradeWindow` in nativeTrade.js)
// and hands it here; which window that becomes is this file's answer
// alone, exactly as inventoryDoor.js's is for the pack.

import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { registerOverlay } from './enhancedOverlays.js';
import { NativeTradeWindow, preloadTradeArt, tradeArtLoaded } from './nativeTrade.js';

export { preloadTradeArt };

/** The gate a host asks before it opens the counter. The classic
 *  window cannot draw without INVE00I0/SHOP00I0; the enhanced one
 *  reads no ARENA2 at all - same law as ui/inventoryDoor.js's
 *  `inventoryDoorReady`. */
export function tradeDoorReady() {
  return isEnhanced() || tradeArtLoaded();
}

/**
 * Build the counter this skin wears. `hooks` is nativeTrade.js's own
 * hooks bag, unchanged - a host says what it HAS and never which
 * window that adds up to, the same contract inventoryDoor.js keeps
 * for the pack.
 */
export function createTradeWindow(hooks = {}) {
  if (isEnhanced() && typeof document !== 'undefined') {
    return enhancedTradeOverlay(hooks);
  }
  return new NativeTradeWindow(hooks);
}

/**
 * THE ENHANCED COUNTER, wrapped in the generic overlay-window shape
 * every host's frame already drives (isChoiceWindow, done, input,
 * click, wheel, hover, tick, draw, dispose) - the same wrapper
 * ui/inventoryDoor.js builds around `mountEnhancedInventory`. A host
 * that sets `win.hooks.onClose` after construction (nativeTrade.js's
 * own `openMerchantSell`) still finds a `.hooks` here to write to; the
 * assignment is exactly as inert on this skin as the note there says
 * it is on the classic one - both skins clear themselves through the
 * host's own `done` sweep, not through that callback.
 */
function enhancedTradeOverlay(hooks) {
  let fired = false;
  let view = null;

  const host = document.createElement('div');
  host.id = 'enhanced-trade';
  // z-index 13: the depth every in-game enhanced screen shares.
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
  };
  unregister = registerOverlay(close);

  // THE SAME REFERENCE, NOT A COPY. worldModes.js writes to `win.hooks`
  // AFTER construction in two places - `openMerchantSell`'s
  // `onClose` (inert, per the note above) and `openIdentifyWindow`'s
  // `usingIdentifySpell = true`, which the Identify SPELL's mode
  // action reads at click time and is NOT inert. Spreading `hooks`
  // into a fresh object for the view (as ui/inventoryDoor.js's
  // `{ ...deps, onExit }` does for the pack, which owns no such
  // late write) would leave that flag on a copy the view never reads.
  // `onExit` is set on the one shared object instead, so both the
  // door's own `.hooks` and the view's `deps` stay the same bag.
  hooks.onExit = close;
  const overlay = {
    isChoiceWindow: true,
    hooks,   // NOTE (found wiring X6, nativeTrade.js): inert for onClose; see the doc comment above
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  mountEnhancedChunk({
    load: () => import('./enhancedTrade.js'),
    mount: ({ mountEnhancedTrade }) => {
      view = mountEnhancedTrade(host, hooks);
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'trade',
  });

  return overlay;
}

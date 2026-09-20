// THE TAVERN DOOR — which innkeeper panel the player sees, and the ONE
// place that builds either. The same fork ui/tradeDoor.js and
// ui/inventoryDoor.js already close for the shop and the pack: the
// classic screen is tavernWindow.js's canvas window over TVRN00I0, and
// the enhanced skin is enhancedTavern.js's DOM screen. A host builds
// the hooks bag once (see the doc comment above `TavernWindow` in
// tavernWindow.js) and hands it here.

import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';
import { TavernWindow, preloadTavernArt, tavernArtLoaded } from './tavernWindow.js';

export { preloadTavernArt };

/** The gate a host asks before it opens the panel. The classic window
 *  cannot draw without TVRN00I0; the enhanced one reads no ARENA2 at
 *  all - same law as ui/tradeDoor.js's `tradeDoorReady`. */
export function tavernDoorReady() {
  return isEnhanced() || tavernArtLoaded();
}

/** Build the panel this skin wears. `hooks` is tavernWindow.js's own
 *  hooks bag, unchanged. */
export function createTavernWindow(hooks = {}) {
  if (isEnhanced() && typeof document !== 'undefined') {
    return enhancedTavernOverlay(hooks);
  }
  return new TavernWindow(hooks);
}

/** THE ENHANCED PANEL, wrapped in the generic overlay-window shape
 *  every host's frame already drives - the same wrapper
 *  ui/tradeDoor.js builds around `mountEnhancedTrade`. */
function enhancedTavernOverlay(hooks) {
  let fired = false;
  let view = null;

  const host = document.createElement('div');
  host.id = 'enhanced-tavern';
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
    // TavernWindow's own `_close` calls `hooks.onClose` (unlike the
    // trade window's inert one) - it is how the host clears
    // `interiorOverlay`, so the enhanced skin owes it the same call.
    hooks.onClose?.();
  };
  unregister = registerOverlay(close);

  hooks.onExit = close;
  const overlay = {
    isChoiceWindow: true,
    hooks,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view has nothing to wheel */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  mountEnhancedChunk({
    load: () => import('./enhancedTavern.js'),
    mount: ({ mountEnhancedTavern }) => {
      view = mountEnhancedTavern(host, hooks);
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'tavern',
  });

  return overlay;
}

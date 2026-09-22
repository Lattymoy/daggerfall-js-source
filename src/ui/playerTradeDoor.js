// THE PLAYER-TRADE DOOR (TRADE1, 2026-09-21) - the one place the window two players share is built, the same fork
// ui/tradeDoor.js is for the shop counter. It exists ONLY in the enhanced skin (that is where this feature is drawn);
// `playerTradeReady()` is the gate a host asks before it offers the row, so a classic-skin player is never shown a
// Trade button that cannot open.
//
// The window is wrapped in the generic overlay shape every host's frame already drives (isChoiceWindow, done, input,
// click, wheel, hover, tick, draw, dispose) - tradeDoor.js's `enhancedTradeOverlay`, and for the same reason - and it
// loads as a LAZY CHUNK through ui/enhancedChunk.js, so a deploy that lands while a tab is open is SAID, not silent
// (MENU1). The session it draws is net/tradeSession.js's; this file owns only the overlay's life.
import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';

/** Can this skin draw the window? The enhanced one reads no ARENA2 at all, as the shop counter's does not. */
export const playerTradeReady = () => isEnhanced() && typeof document !== 'undefined';

/**
 * Build the window over `session`. `deps`: `{ items(), entity, gold() }` - the live pack, the player entity, the purse.
 * Returns the overlay object (`.repaint()` is the host's call on every session change), or null when the skin cannot.
 */
export function createPlayerTradeWindow(session, deps) {
  if (!playerTradeReady()) return null;
  let fired = false, view = null;
  const host = document.createElement('div');
  host.id = 'enhanced-player-trade';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';   // 13: the depth every in-game enhanced screen shares
  document.body.append(host);
  let unregister = () => {};
  const close = () => {
    if (fired) return;
    unregister(); view?.unmount(); view = null; host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
  };
  unregister = registerOverlay(() => { if (session.phase === 'open') session.cancel(); close(); });
  const overlay = {
    isChoiceWindow: true,
    hooks: {},
    get done() { return fired; },
    repaint() { view?.repaint(); },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* the session drives its own clock (tradeFrame) */ },
    draw() { /* the DOM is the picture */ },
    dispose() { if (session.phase === 'open') session.cancel(); close(); },
  };
  mountEnhancedChunk({
    load: () => import('./enhancedPlayerTrade.js'),
    mount: ({ mountEnhancedPlayerTrade }) => { view = mountEnhancedPlayerTrade(host, { session, deps: { ...deps, onExit: close } }); },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'player trade',
  });
  return overlay;
}

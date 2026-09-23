// THE MERCHANT REPAIR DOOR — same fork, for the four-button REPR01I0
// popup (Repair / Talk / Sell / Exit) a repair shop puts up.

import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';
import { MerchantRepairWindow, preloadMerchantRepairArt, merchantRepairArtLoaded } from './merchantRepairWindow.js';

export { preloadMerchantRepairArt };

export function merchantRepairDoorReady() {
  return isEnhanced() || merchantRepairArtLoaded();
}

export function createMerchantRepairWindow(hooks = {}) {
  if (isEnhanced() && typeof document !== 'undefined') return enhancedMerchantRepairOverlay(hooks);
  return new MerchantRepairWindow(hooks);
}

function enhancedMerchantRepairOverlay(hooks) {
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'enhanced-merchant-repair';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};

  const close = () => {
    if (fired) return;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;
    hooks.onClose?.();
  };
  unregister = registerOverlay(close);

  const overlay = {
    isChoiceWindow: true,
    hooks,
    get done() { return fired; },
    input() { /* the panel's own capture keydown owns the keyboard */ },
    click() { /* the panel is a fixed opaque div; pointers never get here */ },
    wheel() { /* nothing here scrolls */ },
    hover() { /* the panel has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  mountEnhancedChunk({
    load: () => import('./enhancedMerchantPanel.js'),
    mount: ({ mountEnhancedMerchantPanel }) => {
      view = mountEnhancedMerchantPanel(host, {
        title: 'Repair Shop',
        buttons: [
          { label: 'Repair item', onClick: () => { close(); hooks.onRepair?.(); } },
          { label: 'Talk', onClick: () => { close(); hooks.onTalk?.(); } },
          { label: 'Sell', onClick: () => { close(); hooks.onSell?.(); } },
          { label: 'Exit', onClick: close },
        ],
        onExit: close,
      });
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'merchant-repair',
  });

  return overlay;
}

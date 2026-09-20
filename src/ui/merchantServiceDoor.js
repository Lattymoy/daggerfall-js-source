// THE MERCHANT SERVICE DOOR — same fork as tradeDoor.js/tavernDoor.js,
// for the two/three-button GNRC01I0 popup (Talk / Sell or Banking /
// Exit) a general merchant or a bank teller puts up.

import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';
import {
  MerchantServiceWindow, preloadMerchantServiceArt, merchantServiceArtLoaded, merchantServiceLabel,
} from './merchantServiceWindow.js';

export { preloadMerchantServiceArt };

export function merchantServiceDoorReady() {
  return isEnhanced() || merchantServiceArtLoaded();
}

export function createMerchantServiceWindow(hooks = {}) {
  if (isEnhanced() && typeof document !== 'undefined') return enhancedMerchantServiceOverlay(hooks);
  return new MerchantServiceWindow(hooks);
}

function enhancedMerchantServiceOverlay(hooks) {
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'enhanced-merchant-service';
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
        title: 'Merchant',
        buttons: [
          { label: 'Talk', onClick: () => { close(); hooks.onTalk?.(); } },
          { label: merchantServiceLabel(hooks.service), onClick: () => { close(); hooks.onService?.(); } },
          { label: 'Exit', onClick: close },
        ],
        onExit: close,
      });
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'merchant-service',
  });

  return overlay;
}

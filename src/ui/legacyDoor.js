// @ts-check
// LEGACY3: THE SUCCESSION'S DOOR - the one place a host opens the Succession through (ui/legacySuccession.js). The
// Bounty board's door's shape (ui/bountyDoor.js): a lazy chunk mounted through the one home (ui/enhancedChunk.js) in a
// host of its own, wrapped in the generic overlay shape every host's frame drives, registered with the overlay stack -
// but the stack's Escape answers NOTHING here: a death must be answered, and an unanswered Succession is a dead player
// in a world with no one to play.
import { mountEnhancedChunk } from './enhancedChunk.js';

/** @type {any} */ let _open = null;
export const successionOpen = () => !!_open && !_open.done;

/**
 * @param {any} deps the window's deps (ui/legacySuccession.js mountSuccession), plus `onClose` (the host's word it is
 *   shut - the boot it asked for is under way, or the line ended).
 * @returns {any} the overlay, or null with no document
 */
export function createSuccessionOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'legacy-succession-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.();
  };
  const overlay = {
    isChoiceWindow: true,
    holdsTop: true,   // as the death screen it follows: a box pushed while it is up waits beneath
    get done() { return fired; },
    input() { /* the window's own buttons own the keyboard */ },
    click() {},
    wheel() {},
    hover() {},
    tick() {},
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./legacySuccession.js'),
    mount: (m) => {
      view = m.mountSuccession(host, {
        ...deps,
        choose: (key) => deps.choose(key),
        end: deps.end ? { ...deps.end, act: () => { deps.end.act(); } } : null,
      });
    },
    alive: () => !fired, host, onDismiss: () => close(), label: 'legacy-succession',
  });
  return overlay;
}

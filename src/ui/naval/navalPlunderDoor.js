// @ts-check
// NAV-F (2026-09-28) - THE PLUNDER WINDOW'S DOOR: the one place a host opens a taken ship's window through (ui/
// navalPlunderWindow.js), in the Sigil Broker's door's own shape (ui/brokerDoor.js): a lazy chunk mounted through the
// one home (ui/enhanced/enhancedChunk.js - a chunk that will not arrive is a notice the player dismisses, MENU1), in a host of
// its own, wrapped in the generic overlay every host's frame drives - `done` once it is shut, `dispose` to shut it, the
// keyboard and the pointer the window's own - and registered with the overlay stack, so the QuickDial key puts it away
// as it puts away every enhanced window (PX28b).
//
// THE WAY OUT SAYS WHY. The window leaves through `onExit(reason)`: 'hold' (Open her hold - the host lays the pack's
// loot window over the hold and brings this one back when it shuts), 'fate' (she was scuttled, cast off, or the voyage
// sails on), 'leave' (AUDIT NAV1: Leave her - back to the captor's own helm), 'close' (the back key, the scrim, the
// Close press, or anything that put it away). The host hears it
// through `onClose(reason)` before its slot drops the overlay. One stands at a time.
//
// AUDIT NAV1 (the helm): THE SHIPWRIGHT'S WINDOW (ui/naval/navalYardWindow.js) opens through the same door - one shape for the
// sea fight's two windows (`openNavalWindow`), each its own host, chunk and slot. ETHER-CHART: and the chart of the
// Eltheric Ocean (ui/etherChartWindow.js), the travel map's door past the Veil. SHIPYARDS (2026-10-11): and a port's
// shipmaster's (ui/shipyardWindow.js) - a slot of its own, the same shape. CAPTAIN-TREE (2026-10-17): and the captain's stars
// (ui/captainTreeWindow.js), the Captain page's door.
import { mountEnhancedChunk } from '../enhanced/enhancedChunk.js';
import { registerOverlay } from '../enhanced/enhancedOverlays.js';
import { noteFirstUse } from '../../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

/**
 * The sea fight's two window doors, one shape (AUDIT NAV1): each its host's id, its chunk and the chunk's mount, and
 * the overlay standing now (`open` - one at a time, each).
 * @typedef {{ id: string, label: string, load: () => Promise<any>, mount: (mod: any, host: HTMLElement, deps: any) => any, open: any }} NavalWindowSlot
 */
/** @type {NavalWindowSlot} */
const PLUNDER = {
  id: 'naval-plunder-host', label: 'naval-plunder', open: null,
  load: () => import('./navalPlunderWindow.js'),
  mount: ({ mountNavalPlunderWindow }, host, deps) => mountNavalPlunderWindow(host, deps),
};
/** @type {NavalWindowSlot} */
const YARD = {
  id: 'naval-yard-host', label: 'naval-yard', open: null,
  load: () => import('./navalYardWindow.js'),
  mount: ({ mountNavalYardWindow }, host, deps) => mountNavalYardWindow(host, deps),
};
/** ETHER-CHART: the chart of the Eltheric Ocean (ui/etherChartWindow.js) - the travel map's door past the Veil. */
/** @type {NavalWindowSlot} */
const ETHER_CHART = {
  id: 'ether-chart-host', label: 'ether-chart', open: null,
  load: () => import('../etherChartWindow.js'),
  mount: ({ mountEtherChartWindow }, host, deps) => mountEtherChartWindow(host, deps),
};
/** SHIPYARDS (2026-10-11): the shipmaster's window (ui/shipyardWindow.js) - a port's shipyard's, through the same door. */
/** @type {NavalWindowSlot} */
const SHIPYARD = {
  id: 'shipyard-host', label: 'shipyard', open: null,
  load: () => import('../shipyardWindow.js'),
  mount: ({ mountShipyardWindow }, host, deps) => mountShipyardWindow(host, deps),
};
/** CAPTAIN-TREE (2026-10-17): the captain's stars (ui/captainTreeWindow.js) - the Captain page's door, the same shape. */
/** @type {NavalWindowSlot} */
const CAPTAIN_STARS = {
  id: 'captain-stars-host', label: 'captain-stars', open: null,
  load: () => import('../captainTreeWindow.js'),
  mount: ({ mountCaptainTreeWindow }, host, deps) => mountCaptainTreeWindow(host, deps),
};
/** DECK-PROPS (2026-10-17): the plan of her deck (ui/deckPlanWindow.js) - the Fleet page's Deck, the same shape. */
/** @type {NavalWindowSlot} */
const DECK_PLAN = {
  id: 'deck-plan-host', label: 'deck-plan', open: null,
  load: () => import('../deckPlanWindow.js'),
  mount: ({ mountDeckPlanWindow }, host, deps) => mountDeckPlanWindow(host, deps),
};
/** @param {NavalWindowSlot} slot */
const isOpen = (slot) => !!slot.open && !slot.open.done;
/** @param {NavalWindowSlot} slot */
function shut(slot) {
  const was = isOpen(slot);
  slot.open?.dispose();
  return was;
}

/**
 * A window of the slot's, as an overlay for the host's slot (townTalk.showOverlay): its own host div, its chunk mounted
 * through the one home, `done` once it is shut, `dispose` to shut it - the one standing before it put away first.
 * @param {NavalWindowSlot} slot
 * @param {any} deps - the window's own, less `onExit` (the door's close is its way out), plus `onClose(reason)`
 */
/**
 * AUDIT 2: THE QUICKDIAL KEY'S CLOSE of a door's window (enhancedOverlays.js closeTopOverlay pops it, then calls this): a
 * window that asks before it lets a change go (the captain's sky's `tryClose`: a change not accepted said once, as its
 * Close and Escape say it - the Firmament's own overlayClose, AUDIT UICALM-FIRM1 L4) is asked; refused, the closer
 * stands again on the stack (`again`), and let go, the window's own close comes back through the door's `onExit`. Any
 * other window, and one not mounted yet, is closed. The key had closed the sky at once, its stars thrown away unasked.
 * @param {() => any} viewOf @param {() => boolean} firedOf @param {(why: string) => void} close @param {(closer: () => void) => void} again
 */
export function dialCloser(viewOf, firedOf, close, again) {
  return function closer() {
    const view = viewOf();
    if (typeof view?.tryClose !== 'function') { close('close'); return; }
    if (view.tryClose() === false && !firedOf()) again(closer);
  };
}

function openNavalWindow(slot, deps) {
  // ETHER-CHART (AUDIT CAPTAIN'S SEA, at the merge of SHIPYARDS): the chart of the Eltheric Ocean is neither a sea fight's
  // window nor a yard's, and pops no page - the branch's arm read it as the sea fight's, main's as the yard's
  if (slot !== ETHER_CHART && slot !== CAPTAIN_STARS && slot !== DECK_PLAN) noteFirstUse(slot === PLUNDER ? 'naval-combat' : 'shipyard');   // CAPTAIN-TREE: the captain's sky pops none either, DECK-PROPS her deck's plan none   // TUT1: a beaten ship's hold, or the shipwright's yard and a port's shipyard (SHIPYARDS) - one page
  if (typeof document === 'undefined') return null;
  slot.open?.dispose();
  let fired = false;
  let view = null;
  let why = 'close';
  const host = document.createElement('div');
  host.id = slot.id;
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};
  /** @param {string} [reason] */
  const close = (reason) => {
    if (fired) return;
    if (typeof reason === 'string') why = reason;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (slot.open === overlay) slot.open = null;
    deps.onClose?.(why);
  };
  unregister = registerOverlay(dialCloser(() => view, () => fired, close, (closer) => { unregister = registerOverlay(closer); }));   // AUDIT 2: the QuickDial key asks a window that asks
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the window's own capture keydown owns the keyboard */ },
    click() { /* the window is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* its list scrolls itself */ },
    hover() { /* its own :hover */ },
    tick() { /* nothing under it moves while it stands (the sea is paused) */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  slot.open = overlay;
  mountEnhancedChunk({
    load: slot.load,
    mount: (mod) => { view = slot.mount(mod, host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close('close'); }, label: slot.label,
  });
  return overlay;
}

/** Is a plunder window up. */
export const navalPlunderOpen = () => isOpen(PLUNDER);
/** Shut it, if it is up (the sea emptied under it: a transition, a load) - and say whether it was. */
export const closeNavalPlunder = () => shut(PLUNDER);
/**
 * Open the window, as an overlay for the host's slot (townTalk.showOverlay). `deps` is navalPlunderWindow.js's own,
 * less `onExit` - the door's close is the window's way out - and plus `onClose(reason)`.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export const createNavalPlunderOverlay = (deps) => openNavalWindow(PLUNDER, deps);

/** AUDIT NAV1: is the shipwright's window up. */
export const navalYardOpen = () => isOpen(YARD);
/** Shut the shipwright's window, if it is up - and say whether it was. */
export const closeNavalYard = () => shut(YARD);
/** The shipwright's window (ui/naval/navalYardWindow.js), as an overlay for the host's slot; `deps` as that window's, plus
 *  `onClose(reason)`. */
export const createNavalYardOverlay = (deps) => openNavalWindow(YARD, deps);
/** SEA-BOUNTY: the shipwright's window painted again, if it is up - an answer the harbourmaster's tab waited on came in
 *  (scenes/seaBountyHost.js). */
export const repaintNavalYard = () => { YARD.open?.repaint?.(); };

/** ETHER-CHART: is the chart of the Eltheric Ocean up. */
export const etherChartOpen = () => isOpen(ETHER_CHART);
/** ETHER-CHART: shut it, if it is up - and say whether it was. */
export const closeEtherChart = () => shut(ETHER_CHART);
/** ETHER-CHART: the chart (ui/etherChartWindow.js), as an overlay for the host's slot; `deps` as that window's, plus
 *  `onClose(reason)`. */
export const createEtherChartOverlay = (deps) => openNavalWindow(ETHER_CHART, deps);

/** SHIPYARDS: is the shipmaster's window up. */
export const shipyardOpen = () => isOpen(SHIPYARD);
/** Shut the shipmaster's window, if it is up - and say whether it was. */
export const closeShipyard = () => shut(SHIPYARD);
/** The shipmaster's window (ui/shipyardWindow.js), as an overlay for the host's slot; `deps` as that window's, plus
 *  `onClose(reason)`. */
export const createShipyardOverlay = (deps) => openNavalWindow(SHIPYARD, deps);

/** CAPTAIN-TREE: are the captain's stars up. */
export const captainStarsOpen = () => isOpen(CAPTAIN_STARS);
/** CAPTAIN-TREE: shut them, if they are up - and say whether they were. */
export const closeCaptainStars = () => shut(CAPTAIN_STARS);
/** CAPTAIN-TREE: the captain's stars (ui/captainTreeWindow.js), as an overlay for the host's slot; `deps` as that window's
 *  (`ledger`, `changed`), plus `onClose(reason)`. */
export const createCaptainStarsOverlay = (deps) => openNavalWindow(CAPTAIN_STARS, deps);

/** DECK-PROPS: is the plan of her deck up. */
export const deckPlanOpen = () => isOpen(DECK_PLAN);
/** DECK-PROPS: shut it, if it is up - and say whether it was. */
export const closeDeckPlan = () => shut(DECK_PLAN);
/** DECK-PROPS: the plan of her deck (ui/deckPlanWindow.js), as an overlay for the host's slot; `deps` as that window's,
 *  plus `onClose(reason)`. */
export const createDeckPlanOverlay = (deps) => openNavalWindow(DECK_PLAN, deps);

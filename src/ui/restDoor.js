// @ts-check
// THE REST DOOR (2026-09-22, the party-rest drop's own seam, which shipped in neither of the two drops that
// imported it): the enhanced/native fork for the rest window - the SAME law ui/tradeDoor.js keeps for the shop
// counter. The enhanced skin gets ui/enhancedRest.js's DOM card over the SAME systems/restSession.js engine;
// the classic skin keeps ui/restWindow.js's RestWindow exactly as it was, byte for byte ("modernize the resting
// window based on the inventory style... don't touch classic mode").
//
// ONE SHAPE AT BOTH ENDS. Every caller - world.js's outdoor toggleRest and its follower mirror, worldModes.js's
// building, dungeonContext.js's dungeon, exterior.js's standalone street - reads `.isRestWindow`,
// `.isPartyRestMirror`, `.session`, `.mode`, `.state`, `._start(mode, hours)` and `._end(result)` off whatever this
// returns, and never has to know which skin built it.
//
// NO WINDOW OBJECT IS BUILT HERE, AND NO DOM IS TOUCHED HERE - which is why CRASH2's window gate does not read
// this door: the enhanced window and its host element are ui/enhancedRest.js's (`openEnhancedRest`), where the
// generic arms the hosts' frames drive (done, input, click, wheel, hover, tick, draw, dispose) are assigned onto
// the ONE object every caller reads its `.state`/`.session` off - an object built here and handed in would have to
// be that same object, and test/partyrest1.test.js holds those arms on the view instead.
//
// THE PX28 STACK. The enhanced window registers itself on ui/enhancedOverlays.js's stack on open (so Escape and
// the chat's own open-key law see it) and `dispose` is wrapped to unregister it - enhancedRest.js's own close()
// calls the wrapped `dispose` on EVERY exit precisely so that registration never outlives the window
// (ENHANCED-REST-DISPOSE1, its own doc comment).
import { isEnhanced } from '../systems/uiSkin.js';
import { registerOverlay } from './enhancedOverlays.js';
import { RestWindow, preloadRestArt } from './restWindow.js';
import { openEnhancedRest } from './enhancedRest.js';

export { preloadRestArt };

/** The rest window for this skin over `deps` (scenes/shared.js createRestDeps's bag, or a follower's mirror deps).
 *
 *  OVH4 (2026-09-24, Mac chose "A": a party rest is not solo on the classic skin or under GrimoireUI): A PARTY REST
 *  IS AN ONLINE WINDOW, like the chat, the party panel and the player trade (OVH3) - it opens the party card on
 *  either skin. The vote, the mirror, a follower's Stop that stops the rester (onManualStop), the leader's unrested
 *  close that frees the next vote (onClosedUnrested) and the stack's Tab close (stopOrClose) are the card's arms;
 *  classic's RestWindow is Daggerfall's own solo window and carries none of them, so a party rest in it was a solo
 *  rest (ONLINE-REST1's classic arm, retired). `deps.partyRest()` is the host's word that this rest is a party's -
 *  online, in a party, outside a tavern, temple or guild hall (world.js partyRestHere); a mirror's deps say yes. A
 *  solo or offline rest on the classic skin keeps RestWindow, byte for byte. */
export function createRestWindow(deps, ignoreAllocatedBed = false) {
  if (typeof document !== 'undefined' && (isEnhanced() || deps?.partyRest?.() === true)) return enhancedRestOverlay(deps, ignoreAllocatedBed);
  return new RestWindow(deps, ignoreAllocatedBed);
}

/** The enhanced card, on the PX28 stack for its whole life - see the header. */
function enhancedRestOverlay(deps, ignoreAllocatedBed = false) {
  const overlay = openEnhancedRest(deps, ignoreAllocatedBed);
  const bare = overlay.dispose;   // enhancedRest.js's own close(), guarded against re-entry
  let unregister = () => {};
  // PARTY-REST29 (2026-09-23, per-request: "when the leader starts resting but closes the resting window he should
  // be able to initiate a resting vote again instantly"): a window closed with NO rest chosen (no session ever
  // began) tells its host so, once - the host lifts the start cooldown the granted vote stamped (world.js
  // cancelPartyRestStart), since no rest happened to cool down from.
  let closedOnce = false;
  overlay.dispose = () => {
    const unrested = !overlay.session;
    unregister(); unregister = () => {}; bare?.();
    if (unrested && !closedOnce) { closedOnce = true; try { deps.onClosedUnrested?.(); } catch (err) { console.warn(`[rest] onClosedUnrested threw: ${err?.message ?? err}`); } }
  };
  // AUDIT PARTY-REST: the stack's close (Tab) is the window's own Stop/OK/close, never a bare dispose - a running
  // rest ends into its wake box, a mirror's Stop asks the rester to stop too; only a page with no such arm disposes
  unregister = registerOverlay(() => { if (!overlay.stopOrClose?.()) overlay.dispose(); });
  return overlay;
}

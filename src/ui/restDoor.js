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

/** The rest window for this skin over `deps` (scenes/shared.js createRestDeps's bag, or a follower's mirror deps). */
export function createRestWindow(deps, ignoreAllocatedBed = false) {
  if (isEnhanced() && typeof document !== 'undefined') return enhancedRestOverlay(deps);
  return new RestWindow(deps, ignoreAllocatedBed);
}

/** The enhanced card, on the PX28 stack for its whole life - see the header. */
function enhancedRestOverlay(deps) {
  const overlay = openEnhancedRest(deps);
  const bare = overlay.dispose;   // enhancedRest.js's own close(), guarded against re-entry
  let unregister = () => {};
  overlay.dispose = () => { unregister(); unregister = () => {}; bare?.(); };
  unregister = registerOverlay(() => overlay.dispose());
  return overlay;
}

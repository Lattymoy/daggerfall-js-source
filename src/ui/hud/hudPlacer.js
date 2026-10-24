// MOVED-NOTICE (FIELD BUGS 2026-10-03): THE PLACER'S SEAT. A HUD piece built late (the notice stack, rebuilt for
// every burst) must stand where HUD-MOVE put it from its first frame, not at the next 250 ms sweep - so its builder
// asks for a sweep the moment it appends. The sweep lives in ui/hud/hudLayout.js, whose own imports (the previews' party,
// boss and revenant hosts) reach the quest machine; the notice module is on the quest herald's static path, which
// must never reach it (test/ui/quest/guide3_herald.test.js THE HUD STAYS LIGHT). So the builder imports this leaf - no imports
// of its own - and hudLayout seats its sweep here when it loads. Nothing seated, nothing is moved yet: no layout is
// put on any piece until hudLayout has loaded, so there is nothing to place.
let placer = null;

/** hudLayout's: the sweep that marks and places every piece on the page. */
export function seatHudPlacer(fn) { placer = typeof fn === 'function' ? fn : null; }

/** A piece was just appended: put it where the player moved it, now. Never throws into its builder. */
export function placeHudPieces(doc) {
  if (!placer) return;
  try { placer(doc); } catch { /* the sheet's own place */ }
}

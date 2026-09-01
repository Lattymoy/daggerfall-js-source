// A8 - POINTER PARITY: what ActivateCenterObject actually does in a
// frame. PlayerActivate.Update (:215-280) and EntityEffectManager's
// player block (:230-255), which are two MonoBehaviours reading ONE
// action off the same frame's InputManager state - so the whole law is
// the small state machine below and every host can share it.
//
// THE THREE FACTS THE PORT DID NOT HAVE:
//
// 1. THE CAST IS THE PRESS, THE ACTIVATE IS THE RELEASE. The spell
//    fires on ActionStarted (EntityEffectManager :250); the world
//    activation runs on ActionComplete (PlayerActivate :279) - the
//    button coming UP, not going down. The port's hosts have always
//    activated on the press edge of a held key.
//
// 2. A READIED SPELL BLOCKS ACTIVATION ENTIRELY, not just for the
//    frame of the cast. While HasReadySpell is true and the spell is
//    not a TOUCH spell, PlayerActivate sets castPending and RETURNS
//    (:245-254) - so with a spell up you cannot open a door with the
//    same button that casts it. A touch spell is the stated exception
//    (:255-258): it only fires once a target is in range, so doors
//    stay reachable under one.
//
// 3. castPending EATS THE NEXT FRAME (:260-265). The cast animation
//    keeps readySpell alive until its release frame, so the button is
//    long back up by the time HasReadySpell clears; the flag then
//    swallows one more frame so the cast's own click cannot fall
//    through into an activation.
//
// The port's E key stays live beside this as the port's own activate
// (DFU binds E to AbortSpell). Mouse2 stays the swing. Both are
// recorded departures, and neither is touched here - this module adds
// the DFU button rather than replacing the port's.

/** The per-host frame state: currentActions/previousActions reduced to
 *  the one action, plus PlayerActivate's castPending field (:71). */
export function createActivateGate() {
  return { down: false, castPending: false };
}

/**
 * One frame of the gate.
 *
 * `down` is HasAction(ActivateCenterObject) for THIS frame -
 * `held(keys, 'ActivateCenterObject')` in the port's idiom.
 * `hasReadySpell` is PlayerEffectManager.HasReadySpell.
 * `touchSpell` marks a readied spell whose TargetType is ByTouch.
 *
 * Returns { cast, activate }: whether this frame casts the readied
 * spell, and whether it runs the activation ray.
 */
export function activateFrame(gate, { down = false, hasReadySpell = false, touchSpell = false } = {}) {
  const started = down && !gate.down;      // ActionStarted (:626-629)
  const complete = !down && gate.down;     // ActionComplete (:634-637)
  gate.down = down;

  // EntityEffectManager.Update (:249-254). The no-anim and instant
  // arms above it (:236-248) fire without a button at all and are the
  // effect system's own business, not this gate's.
  const cast = started && hasReadySpell;

  // PlayerActivate.Update's spell block (:243-266), in order.
  if (hasReadySpell && !touchSpell) {
    gate.castPending = true;
    return { cast, activate: false };
  }
  if (gate.castPending) {
    gate.castPending = false;
    return { cast, activate: false };
  }
  return { cast, activate: complete };
}

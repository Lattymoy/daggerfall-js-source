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

// ROAD-Ar - THE THREE FACTS ABOVE WERE THE WHOLE GATE, AND THE WHOLE
// GATE IS NOT THE WHOLE LAW. PlayerActivate.Update runs two more
// guards ABOVE and BELOW the spell block, and the action the gate
// reads is itself switched off by InputManager while a window is up:
//
// 4. THE LARGE HUD EATS ITS OWN CLICKS (PlayerActivate.cs:230-236).
//    With the cursor freed over the docked bar, PlayerActivate
//    RETURNS before the spell block - so pressing REST on the bar is
//    a button press and nothing else. WeaponManager.cs:293-295
//    carries the identical guard for the swing. EntityEffectManager
//    has NO such guard (:229-255 read verbatim), so a readied spell
//    still fires on that click in DFU; the port keeps that asymmetry
//    rather than inventing a suppression Daggerfall Unity does not
//    have. `hudBlocked` is the port's ActiveMouseOverLargeHUD.
//
// 5. A WINDOW HOLDS THE ACTION ITSELF. PauseGame sets
//    InputManager.IsPaused (GameManager.cs:608) and InputManager.Update
//    returns before currentActions is populated (:486-503), so under
//    ANY open window HasAction/ActionStarted/ActionComplete are all
//    false: no cast, no activation, ever. `paused` is that return.
//
// 6. AND THE CLICK THAT CLOSED THE WINDOW MUST NOT REACH THE WORLD.
//    Two mechanisms in DFU, one law: UserInterfaceManager.RemoveWindow
//    calls PlayerActivate.SetClickDelay() the moment the stack pops
//    back to gameplay (:206/:214), which makes PlayerActivate return
//    for 0.3 s (:269-276); and InputManager's post-pause skip
//    (:504-507) withholds every action for inputWaitTotal - its own
//    comment is "This ensures GUI actions do not 'fall-through' to
//    main world as closing GUI and picking up next input all happen
//    same-frame". The port has no InputManager layer, so ONE
//    clickDelay window carries both: while it runs this gate reports
//    neither cast nor activate. Collapsing the two is DELIBERATE -
//    the delay-only reading would leave the cast half live, which is
//    the exact bug worldModes.js records for the right button ("a
//    readied spell was CAST by a right-click meant to remove an
//    item").

/** Time.realtimeSinceStartup, in seconds. Injectable at every reader
 *  below so the pins are frame sequences and not sleeps. */
const nowSeconds = () =>
  (typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now()) / 1000;

/** The per-host frame state: currentActions/previousActions reduced to
 *  the one action, plus PlayerActivate's castPending (:71) and its
 *  clickDelay/clickDelayStartTime pair (:1050-1054). */
export function createActivateGate() {
  return { down: false, castPending: false, clickDelay: 0, clickDelayStart: 0 };
}

/** PlayerActivate.SetClickDelay (:1050-1054), Mathf.Clamp01 included.
 *  DFU's only callers are UserInterfaceManager.RemoveWindow's two
 *  PauseGame(false) arms, which is why the gate arms it itself off
 *  `paused` below rather than asking four hosts to remember. */
export function setClickDelay(gate, delay = 0.3, now = nowSeconds()) {
  gate.clickDelay = Math.min(Math.max(delay, 0), 1);
  gate.clickDelayStart = now;
}

/**
 * One frame of the gate.
 *
 * `down` is HasAction(ActivateCenterObject) for THIS frame -
 * `held(keys, 'ActivateCenterObject')` in the port's idiom.
 * `hasReadySpell` is PlayerEffectManager.HasReadySpell.
 * `touchSpell` marks a readied spell whose TargetType is ByTouch.
 * `hudBlocked` is LargeHUD.ActiveMouseOverLargeHUD (cursor freed AND
 * over the bar); `paused` is InputManager.IsPaused - any open window.
 *
 * Returns { cast, activate }: whether this frame casts the readied
 * spell, and whether it runs the activation ray.
 */
export function activateFrame(gate, {
  down = false, hasReadySpell = false, touchSpell = false,
  hudBlocked = false, paused = false, now = nowSeconds(),
} = {}) {
  // Fact 5. InputManager.Update (:486-503): while paused the action
  // set is never populated, so the button is not down for anybody -
  // and the delay is armed for the frame the last window pops, which
  // is RemoveWindow's SetClickDelay (:206/:214).
  if (paused) {
    gate.down = false;
    setClickDelay(gate, 0.3, now);
    return { cast: false, activate: false };
  }

  const started = down && !gate.down;      // ActionStarted (:626-629)
  const complete = !down && gate.down;     // ActionComplete (:634-637)
  gate.down = down;

  // Fact 6. The window's own click cannot become a world click.
  if (gate.clickDelay > 0 && now < gate.clickDelayStart + gate.clickDelay) {
    return { cast: false, activate: false };
  }
  gate.clickDelay = 0;
  gate.clickDelayStart = 0;

  // EntityEffectManager.Update (:249-254). The no-anim and instant
  // arms above it (:236-248) fire without a button at all and are the
  // effect system's own business, not this gate's.
  const cast = started && hasReadySpell;

  // Fact 4. PlayerActivate.cs:230-236, in its own position: ABOVE the
  // spell block, so castPending is neither set nor consumed here.
  if (hudBlocked) return { cast, activate: false };

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

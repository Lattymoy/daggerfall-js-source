// TO1: THE GAME'S CLOCK RATE - Unity's `Time.timeScale` and
// `Time.fixedDeltaTime`, which the port did not have and Travel
// Options needs.
//
// WHAT IT IS FOR. An accelerated journey is not a fade to black: the
// player really walks, and the world really runs, at sixty times speed
// off the road and a hundred on it (RATE-LAW, below). The mod does that
// in one method
// (TravelOptionsMod.cs:382-390):
//
//     Time.timeScale = timeScale;
//     Time.fixedDeltaTime = timeScale * baseFixedDeltaTime;
//
// and its own comment says why the second line is there: "Must set
// fixed delta time to scale the fixed (physics) updates as well."
// That pair is the whole contract, and BOTH halves matter here. The
// port's frame runs the world off `dt` and the player motor off a
// FIXED accumulator at 1/60 (player/motor.js FIXED_DT); multiplying
// dt alone would leave the motor stepping sixty times a second of
// GAME time while the frame asked for sixty seconds of it - three
// thousand physics steps in one frame at x50, which is a freeze, not
// a fast walk. Scaling the step with the scale keeps the STEP COUNT
// where it was and makes each step cover more ground, which is what
// Unity does and what the mod's second line buys.
//
// ONE HOME, and a small one: a number and its readers. The frame
// multiplies its dt by `timeScale()`, and the motor scales its own fixed
// step by the same number (player/motor.js); and (CSA-G) the HUD's two
// message clocks, which DFU counts in `Time.deltaTime` - game time -
// where the port hands its HUD the frame's real dt (ui/midScreenText.js,
// ui/hudText.js). The mods whose Unity code reads `Time.timeScale` read
// it here too (AUDIT OW5, the audit before the merge, counted them: the
// bands' and the raiders' chases, the sea's helm, Come Sail Away, Warm
// Ashes, the horse and cart, Deep Waters, Ocean Holes). A system that
// wants to know whether a journey is running asks the journey, never
// this number.
//
// PAUSE IS NOT THIS. DFU pauses with `Time.timeScale = 0` and the port
// does not: it holds the frame (scenes/world.js `gamePaused()`,
// `_overlayHeld`), which is older than this module and stays as it is.
// This scale is the travel acceleration, or (CSA-G) Come Sail Away's
// helm's - its time keys walk the five steps 1, 5, 10, 15, 30
// (systems/comeSailAway.js SetTimeScale) - and it is 1 whenever neither
// runs.

/** The scale a journey may never exceed. The mod's own AccelerationLimit
 *  slider stopped at 100 (modsettings.json), and a scale beyond that is
 *  a physics step of a second and a half. */
export const MAX_TIME_SCALE = 100;

/** RATE-LAW (2026-10-04, Mac: "Remove travel options dials" / "Roads now
 *  travel at x100 and non roads at x60"): A JOURNEY'S RATE IS ITS GROUND'S.
 *  The panel's spinner, the mod's starting acceleration, its limit dial,
 *  the half limit while a path is followed and the near-enemies stepper
 *  are gone; a fast traveller on a road or a track runs at the road's
 *  rate and anywhere else - the open ground, a town's ring, the sea - at
 *  the open rate. What still holds the clock under the rate is not a
 *  dial: the land loading (systems/travelGovernor.js), an alerted enemy
 *  (systems/travelThreat.js) and the ring walk's own ceiling
 *  (travelPaths.js MAX_CIRCUMNAVIGATION_ACCEL). */
export const TRAVEL_ROAD_RATE = MAX_TIME_SCALE;
export const TRAVEL_OPEN_RATE = 60;
/** The rate a fast traveller's ground asks for: a road or a track, or not. */
export const travelRateOf = (onRoad) => (onRoad ? TRAVEL_ROAD_RATE : TRAVEL_OPEN_RATE);

let _scale = 1;

/** `Time.timeScale`. Always finite and at least a hundredth, so a bad
 *  caller cannot stop the world. */
export const timeScale = () => _scale;

/** `Time.timeScale = n`. `Time.fixedDeltaTime` rides along in the
 *  motor, which reads the same number (see below). Returns what was set. */
export function setTimeScale(n) {
  const v = Number(n);
  _scale = Number.isFinite(v) ? Math.max(0.01, Math.min(MAX_TIME_SCALE, v)) : 1;
  return _scale;
}

/* `Time.fixedDeltaTime` is the MOTOR's own read: player/motor.js
   multiplies its FIXED_DT by `timeScale()` so the step COUNT per real
   second stays where it was and each step covers more ground. A leaf
   cannot import the motor, and the motor is the only caller that needs
   the product, so the product lives there. */

/** Back to real time. The journey's every exit calls it
 *  (TravelOptionsMod.cs:1276 InterruptTravel, :543 the encounter). */
export const resetTimeScale = () => setTimeScale(1);

/** For the pins. */
export function _setTimeScaleForTest(n) { _scale = n; }

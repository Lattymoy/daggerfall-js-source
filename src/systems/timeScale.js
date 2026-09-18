// TO1: THE GAME'S CLOCK RATE - Unity's `Time.timeScale` and
// `Time.fixedDeltaTime`, which the port did not have and Travel
// Options needs.
//
// WHAT IT IS FOR. An accelerated journey is not a fade to black: the
// player really walks, and the world really runs, at up to sixty times
// speed. The mod does that in one method
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
// ONE HOME, and a small one: a number and two readers. The frame
// multiplies its dt by `timeScale()`; the motor takes its fixed step
// from `fixedStep()`. Nothing else may read it - a system that wants
// to know whether a journey is running asks the journey.
//
// PAUSE IS NOT THIS. DFU pauses with `Time.timeScale = 0` and the port
// does not: it holds the frame (scenes/world.js `gamePaused()`,
// `_overlayHeld`), which is older than this module and stays as it is.
// This scale is only ever the travel acceleration, and it is 1
// whenever no journey is running.

/** TravelControlUI.cs:76-79 - the acceleration the panel can reach:
 *  the setting rounded DOWN to a multiple of five (`(limit / 5) * 5`),
 *  and half of that while following a path (`(limit / 10) * 5`, which
 *  is the same rounding of half the number). The panel owns the
 *  spinner; these are here because the scale is what they bound. */
export const accelLimitOf = (limit) => Math.trunc(limit / 5) * 5;
export const halfAccelLimitOf = (limit) => Math.trunc(limit / 10) * 5;

/** The scale a journey may never exceed, whatever a setting says. The
 *  mod's own AccelerationLimit slider stops at 100 (modsettings.json),
 *  and a scale beyond that is a physics step of a second and a half. */
export const MAX_TIME_SCALE = 100;

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

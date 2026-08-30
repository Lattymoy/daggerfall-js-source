// AUDIT 28 W7 - MOUSE LOOK SMOOTHING: PlayerMouseLook.ApplySmoothing +
// GetFrameRateScaledFractionOfProgression (MIT, Daggerfall Workshop,
// PlayerMouseLook.cs:45-54, :100-105, :154-166), wired from
// Controls/MouseLookSmoothingFactor (StartGameBehaviour :215). The
// setting ships 0.5 - DFU's default look IS smoothed - and the port
// applied every raw delta straight to the camera on the event, so the
// setting sat stored and the feel was the unsmoothed one.
//
// DFU keeps lookTarget (the summed deltas) and lookCurrent (the camera)
// and, every Update, moves current a frame-rate-scaled fraction of the
// way to target:
//   smoothing' = 1 - G(1 - smoothing)      G(f) = 1 - c / (frames + c),
//   current   = current * smoothing' + target * (1 - smoothing')
// with c = (1 - f) / f and frames = unscaledDeltaTime * 60.
//
// The port keeps the DIFFERENCE instead - the residual still owed to
// the camera - and pays a fraction of it each frame. That is the same
// arithmetic (current += (target - current) * (1 - s')) with one
// property the hosts need: an external write to cam.yaw/cam.pitch (a
// dungeon door's facing, a load, a teleport) needs no resync, because
// the residual is a delta and rides along. The pitch clamp is applied
// to the TARGET as :142 does, so the camera never overshoots the range.

import { getFloat } from '../systems/settings.js';

/** PlayerMouseLook.SmoothingMax (:45): the setter clamps to it. */
export const SMOOTHING_MAX = 0.9;
/** The hosts' pitch range (radians), the port's pitchMin/pitchMax. */
export const PITCH_LIMIT = 1.5;

/** GetFrameRateScaledFractionOfProgression (:100-105), verbatim. */
export function frameRateScaledFraction(fractionAt60FPS, dt) {
  const frames = dt * 60;
  const c = (1 - fractionAt60FPS) / fractionAt60FPS;
  return 1 - c / (frames + c);
}

/** ApplySmoothing's per-frame factor (:156-163): the setting, clamped
 *  as the Smoothing setter clamps it, scaled for this frame's dt. */
export function frameSmoothing(smoothing, dt) {
  const s = Math.min(Math.max(smoothing, 0), SMOOTHING_MAX);
  return 1 - frameRateScaledFraction(1 - s, dt);
}

export class LookFilter {
  constructor() {
    this.residualYaw = 0;
    this.residualPitch = 0;
  }

  /** ApplyLook's `lookTarget += delta` (:126): the scaled deltas, in
   *  the camera's own units (radians; pitch already inverted). */
  add(dyaw, dpitch) {
    this.residualYaw += dyaw;
    this.residualPitch += dpitch;
  }

  /**
   * ApplySmoothing (:154-166) + the pitch clamp on the target (:142),
   * applied to the camera. Runs once per frame on the host's dt.
   */
  tick(dt, cam, { smoothing = getFloat('Controls', 'MouseLookSmoothingFactor', 0, SMOOTHING_MAX) } = {}) {
    // Clamp the TARGET pitch to the range, then owe only what remains.
    const targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.pitch + this.residualPitch));
    this.residualPitch = targetPitch - cam.pitch;
    const s = frameSmoothing(smoothing, dt);
    const stepYaw = this.residualYaw * (1 - s);
    const stepPitch = this.residualPitch * (1 - s);
    cam.yaw += stepYaw;
    cam.pitch += stepPitch;
    this.residualYaw -= stepYaw;
    this.residualPitch -= stepPitch;
  }
}

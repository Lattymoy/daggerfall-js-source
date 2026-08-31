// AUDIT 28 W9 - CAMERA RECOIL: CameraRecoiler.cs (MIT, Daggerfall
// Workshop), whole. Controls/CameraRecoilStrength ships 3 (High): DFU's
// camera reels when the player takes damage, and the port's never did.
//
// Every Update (:48-77): off, paused or cursor-active returns; a health
// loss above 2% of max starts (or restarts) a sway - a random unit axis
// and a timer of (5 + floor(percent * 5)) * PI - and while the timer
// runs it falls at 2*PI per second and the camera is ROTATED each frame
// by sin(timer) * scalar * axis, degrees, where the scalar is the
// setting's fraction of baseMaxRecoilSeverity 50, times timer/timerStart
// (it dies out), times clamp(healthLost * 0.015, 0.015, 1) - read off
// the detector's HealthLost THIS frame, which is 0 on every frame but
// the hit's, so after the first frame the factor is its floor 0.015.
// Transform.Rotate is additive on the camera, so the port adds to
// cam.pitch/cam.yaw the same way - x is pitch DOWN in Unity's frame, y
// is yaw right, both converted from degrees.
//
// Random.insideUnitCircle.normalized is Unity's stream; `rolls` stands
// in (Ledger A). VitalsChangeDetector's HealthLost/HealthLostPercent
// are hudVitals' lastHealthLost/lastHealthLostPercent, the values the
// HUD's own detector computed last frame - DFU's two MonoBehaviours
// have no fixed Update order either.

import { getInt } from '../systems/settings.js';

/** CameraRecoiler.cs:33. */
export const BASE_MAX_RECOIL_SEVERITY = 50;
/** :58, :65. */
export const MIN_PERCENT_THRESHOLD = 0.02;
export const TIMER_SPEED = 2 * Math.PI;
/** AdjustForUserSetting (:100-110): the setting's fraction. */
export const RECOIL_FRACTION = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
const DEG = Math.PI / 180;

/** CalculateTimerStart (:95-99). */
export function recoilTimerStart(percentHealthLost) {
  const piScalar = 5 + Math.floor(percentHealthLost * 5);
  return piScalar * Math.PI;
}

/** CalculateRotationScalar (:112-117). */
export function recoilRotationScalar(setting, healthLost, timer, timerStart) {
  const maxRotationScalar = BASE_MAX_RECOIL_SEVERITY * (RECOIL_FRACTION[setting] ?? 0);
  const healthLostFactor = Math.min(Math.max(healthLost * 0.015, 0.015), 1);
  return maxRotationScalar * (timer / timerStart) * healthLostFactor;
}

export class CameraRecoiler {
  constructor() {
    this.swaying = false;
    this.swayAxis = [0, 0];
    this.timerStart = 0;
    this.timer = 0;
  }

  /** ResetRecoil (:135-138): a world init, a load, the court screen. */
  reset() { this.swaying = false; }

  /**
   * Update (:48-77). `paused` covers IsGamePaused and cursorActive.
   * @returns {boolean} whether the camera was rotated this frame
   */
  update(dt, cam, { healthLost = 0, healthLostPercent = 0, paused = false,
    setting = getInt('Controls', 'CameraRecoilStrength', 0, 4), rolls = Math.random } = {}) {
    if (setting === 0 || paused) return false;
    if (healthLost > 0 && healthLostPercent > MIN_PERCENT_THRESHOLD) {
      this.swaying = true;
      this.timerStart = recoilTimerStart(healthLostPercent);
      this.timer = this.timerStart;
      const a = rolls() * 2 * Math.PI;   // insideUnitCircle.normalized
      this.swayAxis = [Math.cos(a), Math.sin(a)];
    }
    if (!this.swaying) return false;
    this.timer -= dt * TIMER_SPEED;
    const scalar = recoilRotationScalar(setting, healthLost, this.timer, this.timerStart);
    const xAngle = Math.sin(this.timer) * scalar * this.swayAxis[0];
    const yAngle = Math.sin(this.timer) * scalar * this.swayAxis[1];
    cam.pitch -= xAngle * DEG;   // Rotate(+x) pitches DOWN in Unity's frame; the port's +pitch looks up
    cam.yaw += yAngle * DEG;     // Rotate(+y) turns right, as the port's +yaw does
    this.swaying = this.timer > 0;
    return true;
  }
}

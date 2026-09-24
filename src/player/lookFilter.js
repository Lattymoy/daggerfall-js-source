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

import { getFloat, getInt } from '../systems/settings.js';   // MAC-O2: Controls/WeaponSwingMode, the term the swing suppression was missing
import { PITCH_LIMIT } from './mwCamera.js';

/** PlayerMouseLook.SmoothingMax (:45): the setter clamps to it. */
export const SMOOTHING_MAX = 0.9;
// MW-D30's clamp survives the filter takeover: the pitch range is the
// REFERENCE's +/-(PI/2 - 1e-6) (camera.cpp:323-331), one home in
// mwCamera - the 1.5 literal this filter briefly re-minted was the
// exact divergence MW-D30 removed from the four hosts.
export { PITCH_LIMIT };

/** MAC1 (Mac, 2026-09-10): "Looking straight down and moving is
 *  jarring. Add a stopper so the player's camera can not go down past a
 *  certain threshold." DFU's PlayerMouseLook clamps both ways at 90
 *  degrees (PitchMinLimit / PitchMaxLimit); the port keeps the
 *  reference CEILING (PITCH_LIMIT above) and takes the owner's FLOOR:
 *  75 degrees below the horizon, which keeps the ground under a walk in
 *  view without the view turning perpendicular to the motion. Ledger A,
 *  MAC1 - the number is Mac's to tune. Applied where the reference
 *  clamp is applied, to the TARGET, so a pitch restored from a save
 *  below the floor glides up to it rather than snapping. */
export const PITCH_FLOOR = (75 * Math.PI) / 180;
// RR2: `playerMouseLook.PitchMaxLimit = terrainAngle + 18` (EnhancedRiding.cs
// :288) - a mod lowers how far DOWN the rider may look. DFU's Pitch is
// down-positive; the port's is up-positive, so PitchMaxLimit is the
// FLOOR here. A registered provider answers DFU's limit in DEGREES
// (down-positive), or null for the owner's PITCH_FLOOR.
let _floorProvider = null;
export function setPitchFloorProvider(fn) { _floorProvider = typeof fn === 'function' ? fn : null; }
export const pitchFloor = () => { const d = _floorProvider?.(); return Number.isFinite(d) ? Math.min((Math.max(d, -90) * Math.PI) / 180, PITCH_FLOOR) : PITCH_FLOOR; };   // AUDIT-RR2 G23: `pitchMax = Mathf.Clamp(value, PitchMin, PitchMax)` (PlayerMouseLook.cs:87-90), PitchMin -90 - a steep bank cannot push the floor past vertical

/** GetFrameRateScaledFractionOfProgression (:100-105), verbatim - and
 *  AUDIT 68 S15-lookfilter-nan-dt0: at its two edges. A browser frame
 *  can repeat its timestamp (dt 0), where fraction 1 made 0/0 = NaN
 *  and the camera NaN for good; no smoothing is full progress at any
 *  dt, and a frame with no time in it makes none. */
export function frameRateScaledFraction(fractionAt60FPS, dt) {
  if (fractionAt60FPS >= 1) return 1;
  if (!(dt > 0)) return 0;
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

// GP1: ApplySmoothing :159-160 - "Enforce some minimum smoothing for
// controllers": while the pad is the live device (InputManager
// .UsingController) the fraction never drops below 0.5. One latch for
// every filter, set by ui/gamepadInput.js each frame.
let _controllerLook = false;
export function setControllerLook(on) { _controllerLook = !!on; }
export const controllerLook = () => _controllerLook;

/** WW1: THE FRAME'S LOOK, for a reader that is not the camera. DFU's
 *  InputManager.LookX/LookY are the frame's mouse axes after sensitivity,
 *  and Weapon Widget's inertia reads them straight; here the same
 *  numbers arrive at add() below, so the latch keeps the frame's sum and
 *  takeFrameLook hands it over once, zeroed for the next. */
let _frameYaw = 0, _framePitch = 0;
export function takeFrameLook() { const v = [_frameYaw, _framePitch]; _frameYaw = 0; _framePitch = 0; return v; }

/**
 * MAC-O2 - THE SWING SUPPRESSION, ONE LAW (Mac, 2026-09-16: "Can't
 * look around when holding right click").
 *
 * PlayerMouseLook.Update :246-248, whole:
 *
 *   if (InputManager.Instance.HasAction(InputManager.Actions.SwingWeapon)
 *       && DaggerfallUnity.Settings.WeaponSwingMode == 0
 *       && GameManager.Instance.WeaponManager.ScreenWeapon.WeaponType
 *          != WeaponTypes.Bow)
 *       applyLook = false;
 *
 * THREE terms, and the port's four copies carried two. The middle one
 * is the whole reason the freeze exists: in WeaponSwingMode 0 the held
 * drag IS the swing gesture (WeaponManager.cs:306-315 tracks the mouse
 * while the button is down), so the camera must stand still or the
 * player would be aiming and swinging with one motion. Modes 1 and 2 -
 * click to attack, click or hold - track NO gesture at all
 * (WeaponManager.cs:316-331 rolls the direction), so DFU leaves the
 * look alone and the player turns while holding the button. The port
 * froze the look in every mode, which is exactly the report.
 *
 * What is NOT in it is worth writing down, because three of the four
 * questions a reader asks are answered by DFU saying nothing:
 *   - SHEATHED is not a term. ApplyWeapon (WeaponManager.cs:732-757)
 *     writes ScreenWeapon.WeaponType from the equipped item whatever
 *     Sheathed is, so a sheathed player's held swing freezes the look
 *     too. That is DFU's behaviour and this port keeps it.
 *   - NO WEAPON is not a term either: bare hands are SetMelee
 *     (:760-767), which is not Bow, so the freeze applies.
 *   - INDOORS is not a term - PlayerMouseLook is one component for
 *     every world context.
 * The hosts' own gates (a walking motor, and which rig owns the
 * screen weapon in this frame) sit at the CALL SITES, where the host
 * can answer them; this function is the law alone.
 *
 * @param swingHeld    HasAction(SwingWeapon) - the raw button
 * @param weaponIsBow  ScreenWeapon.WeaponType == WeaponTypes.Bow
 * @param swingMode    Controls/WeaponSwingMode (0 gesture, 1 click, 2 click or hold)
 */
export function swingSuppressesLook({ swingHeld = false, weaponIsBow = false,
  swingMode = getInt('Controls', 'WeaponSwingMode', 0, 2) } = {}) {
  return !!swingHeld && swingMode === 0 && !weaponIsBow;
}

export class LookFilter {
  constructor() {
    this.residualYaw = 0;
    this.residualPitch = 0;
  }

  /** SetFacing -> Init (:274-279): lookTarget = lookCurrent - the owed
   *  look is dropped. DFU's Update runs it EVERY frame the swing action
   *  is held (WeaponSwingMode 0, not a bow: :248-253 "immediately stop
   *  at current heading"), so a swing never pays out a look it
   *  interrupted. F-C2 (self-audit 3). */
  settle() {
    this.residualYaw = 0;
    this.residualPitch = 0;
  }

  /** ApplyLook's `lookTarget += delta` (:126): the scaled deltas, in
   *  the camera's own units (radians; pitch already inverted). */
  add(dyaw, dpitch) {
    this.residualYaw += dyaw;
    this.residualPitch += dpitch;
    _frameYaw += dyaw; _framePitch += dpitch;   // WW1: the frame's look, latched for the weapon widget
  }

  /**
   * ApplySmoothing (:154-166) + the pitch clamp on the target (:142),
   * applied to the camera. Runs once per frame on the host's dt.
   */
  tick(dt, cam, { smoothing = getFloat('Controls', 'MouseLookSmoothingFactor', 0, SMOOTHING_MAX) } = {}) {
    // Clamp the TARGET pitch to the range, then owe only what remains.
    const targetPitch = Math.max(-pitchFloor(), Math.min(PITCH_LIMIT, cam.pitch + this.residualPitch));   // RR2: a mod's PitchMaxLimit rides the floor   // MAC1: the floor is the owner's, the ceiling the reference's
    this.residualPitch = targetPitch - cam.pitch;
    const s = frameSmoothing(_controllerLook && smoothing < 0.5 ? 0.5 : smoothing, dt);   // GP1: the controller's floor
    const stepYaw = this.residualYaw * (1 - s);
    const stepPitch = this.residualPitch * (1 - s);
    cam.yaw += stepYaw;
    cam.pitch += stepPitch;
    this.residualYaw -= stepYaw;
    this.residualPitch -= stepPitch;
  }
}

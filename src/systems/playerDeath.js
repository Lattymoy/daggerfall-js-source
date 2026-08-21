// THE DEATH SEQUENCE (D1) - PlayerDeath.cs, the whole timed law that
// sits between "health reached 0" and the title menu. DFU's shape,
// verbatim:
//   PlayerEntity_OnDeath  - guarded once (deathInProgress), input
//     paused, the HUD fades to black over FadeDuration, the death
//     sound plays, and the camera's target height is set to
//     `controllerHeight - controllerHeight * 1.25` - NEGATIVE, a
//     quarter of the capsule BELOW the feet, which is why the view
//     sinks through the floor as you die.
//   Update - the camera falls at fallSpeed toward that target while
//     movement is cancelled, and TimeBeforeReset seconds after death
//     the run ends: StartMethods.TitleMenuFromDeath, which is
//     DaggerfallUI's dfuiInitGameFromDeath -> InitGame(ANIM0012.VID)
//     -> the start menu. The video and the menu are the HOST's half
//     (onReset); the timing, the sink and the fade are here.
//
// The sound: classicPlayerDeathSound is WoodElfMalePain1 for every
// race and gender - DFU only picks a race/gender Pain3 when its
// CombatVoices setting is on, and that setting is a DFU-modern
// addition, so the classic clip is what this port plays (the
// race/gender table rides the combat-voices row if it ever lands).

import { EYE_HEIGHT, CAPSULE_HEIGHT } from '../player/motor.js';
import { SOUND } from './soundClips.js';

export const DEATH_FALL_SPEED = 2.5;        // PlayerDeath.fallSpeed
export const DEATH_TIME_BEFORE_RESET = 3;   // PlayerDeath.TimeBeforeReset
export const DEATH_FADE_DURATION = 2;       // PlayerDeath.FadeDuration
export const CLASSIC_PLAYER_DEATH_SOUND = SOUND.WoodElfMalePain1;

/** targetCameraHeight (PlayerEntity_OnDeath): height - height * 1.25,
 *  i.e. a quarter of the capsule BELOW the feet. */
export const deathCameraTarget = (capsuleHeight = CAPSULE_HEIGHT) =>
  capsuleHeight - capsuleHeight * 1.25;

export class PlayerDeathSequence {
  /**
   * @param {object} [deps]
   * @param {number} [deps.eyeHeight]      the live eye height (startCameraHeight)
   * @param {number} [deps.capsuleHeight]  the live capsule height
   * @param {function(number):void} [deps.playSound]  one-shot sink
   * @param {function():void} [deps.onReset]  the host's video + menu half
   */
  constructor({ eyeHeight = EYE_HEIGHT, capsuleHeight = CAPSULE_HEIGHT, playSound = null, onReset = null } = {}) {
    this.startCameraHeight = eyeHeight;
    this.targetCameraHeight = deathCameraTarget(capsuleHeight);
    this.currentCameraHeight = eyeHeight;
    this.elapsed = 0;
    this.reset = false;
    this._onReset = onReset;
    playSound?.(CLASSIC_PLAYER_DEATH_SOUND);
  }

  /** One frame of the death Update. */
  tick(dt) {
    if (this.reset) return;
    this.elapsed += dt;
    if (this.currentCameraHeight > this.targetCameraHeight) {
      this.currentCameraHeight -= DEATH_FALL_SPEED * dt;
      // C# never clamps: the camera can dip below the target within
      // the frame it arrives. Clamping here keeps the same resting
      // place without a sub-frame overshoot the port would render.
      if (this.currentCameraHeight < this.targetCameraHeight) {
        this.currentCameraHeight = this.targetCameraHeight;
      }
    }
    if (this.elapsed > DEATH_TIME_BEFORE_RESET) {
      this.reset = true;
      this._onReset?.();
    }
  }

  /** How far the eye has sunk - what a world-space host subtracts. */
  get drop() { return this.startCameraHeight - this.currentCameraHeight; }

  /** FadeHUDToBlack's 0..1 progress over FadeDuration. */
  get fade() { return Math.min(1, this.elapsed / DEATH_FADE_DURATION); }
}

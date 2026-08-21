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
// The sound (MERGE AUDIT): PlayerEntity_OnDeath picks it in two
// arms - classicPlayerDeathSound (WoodElfMalePain1, every race and
// gender in classic) unless CombatVoices is on, in which case it is
// the character's own race/gender PAIN3 (:164-170). This header used
// to justify playing the classic clip unconditionally on the grounds
// that CombatVoices "is a DFU-modern addition" with no store here.
// The SETT-slice built the store on the other side of this merge and
// the setting SHIPS TRUE, so the unconditional arm was DFU's minority
// path, not its default: the branch is live now, and the race/gender
// table it needs is in soundClips.js.

import { EYE_HEIGHT, CAPSULE_HEIGHT } from '../player/motor.js';
import { SOUND } from './soundClips.js';
import { RACES } from './races.js';
import { combatVoicesEnabled } from '../combat/combatVoices.js';   // SETT: reads the store at the point of use

export const DEATH_FALL_SPEED = 2.5;        // PlayerDeath.fallSpeed
export const DEATH_TIME_BEFORE_RESET = 3;   // PlayerDeath.TimeBeforeReset
export const DEATH_FADE_DURATION = 2;       // PlayerDeath.FadeDuration
export const CLASSIC_PLAYER_DEATH_SOUND = SOUND.WoodElfMalePain1;

/** GetRaceGenderPain3Sound (PlayerDeath.cs:179-201), verbatim - the
 *  switch's eight arms, each forking on gender. DFU returns
 *  SoundClips.None (-1) for a race outside the eight, which the
 *  playSound sink drops. */
const PAIN3 = Object.freeze({
  [RACES.Breton]: [SOUND.BretonMalePain3, SOUND.BretonFemalePain3],
  [RACES.Redguard]: [SOUND.RedguardMalePain3, SOUND.RedguardFemalePain3],
  [RACES.Nord]: [SOUND.NordMalePain3, SOUND.NordFemalePain3],
  [RACES.DarkElf]: [SOUND.DarkElfMalePain3, SOUND.DarkElfFemalePain3],
  [RACES.HighElf]: [SOUND.HighElfMalePain3, SOUND.HighElfFemalePain3],
  [RACES.WoodElf]: [SOUND.WoodElfMalePain3, SOUND.WoodElfFemalePain3],
  [RACES.Khajiit]: [SOUND.KhajiitMalePain3, SOUND.KhajiitFemalePain3],
  [RACES.Argonian]: [SOUND.ArgonianMalePain3, SOUND.ArgonianFemalePain3],
});
export const raceGenderPain3Sound = (race, gender) =>
  PAIN3[race]?.[gender === 'male' ? 0 : 1] ?? -1;

/** PlayerEntity_OnDeath's two arms (:164-170). The setting is read
 *  HERE, at the death, exactly where DFU reads it. */
export function playerDeathSound(race, gender, voices = combatVoicesEnabled) {
  if (!voices()) return CLASSIC_PLAYER_DEATH_SOUND;
  const clip = raceGenderPain3Sound(race, gender);
  // NEVER TRAPS: an unknown race yields None in DFU too; fall to the
  // classic clip rather than playing silence at the one moment the
  // player needs to hear something happened.
  return clip >= 0 ? clip : CLASSIC_PLAYER_DEATH_SOUND;
}

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
   * @param {number} [deps.race]    the dying character's race (Races enum)
   * @param {string} [deps.gender]  'male' | 'female'
   * @param {function():boolean} [deps.voices]  the CombatVoices seam, injectable for the pins
   */
  constructor({ eyeHeight = EYE_HEIGHT, capsuleHeight = CAPSULE_HEIGHT, playSound = null, onReset = null,
    race = null, gender = null, voices = combatVoicesEnabled } = {}) {
    this.startCameraHeight = eyeHeight;
    this.targetCameraHeight = deathCameraTarget(capsuleHeight);
    this.currentCameraHeight = eyeHeight;
    this.elapsed = 0;
    this.reset = false;
    this._onReset = onReset;
    // The race/gender arm needs an identity; without one (a host that
    // dies before chargen wrote it) DFU's classic clip stands.
    this.deathSound = race == null
      ? CLASSIC_PLAYER_DEATH_SOUND
      : playerDeathSound(race, gender, voices);
    playSound?.(this.deathSound);
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

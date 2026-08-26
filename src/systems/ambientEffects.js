// Scene ambience (Audio A3). Verbatim from DFU AmbientEffectsPlayer.cs
// + WeatherManager.SetAmbientEffects, with the wait windows from the
// DaggerfallUnityGame scene's SERIALIZED components (they override the
// script defaults 4/35): the Dungeon object runs 5/28, the exterior
// WeatherAmbientEffects object 5/25.
//
// Shape: one player per scene. A preset picks the sound set -
//   dungeon:    14 one-shots played "somewhere around" the player
//               (onUnitSphere x sqrt(Range(10^2, 20^2)), min dist 13)
//   rain:       the AmbientRaining loop only
//   storm:      rain loop + {lightning short/thunder/roll} one-shots
//               "somewhere on the horizon" (a random yaw 20deg above
//               the horizon, min dist 3000 - effectively everywhere)
//   sunnyDay:   {BirdCall1, BirdCall2} somewhere around
//   clearNight: the AmbientCrickets loop only
// Exteriors map weather/time exactly as WeatherManager does: raining
// -> Rain, storming -> Storm, else day -> SunnyDay / night ->
// ClearNight (snow/fog/overcast fold into day/night - only rain
// diverts). Building interiors carry NO ambient player in DFU -
// they stay silent, verbatim.
//
// One-shots share ONE ambient channel: a new effect is skipped while
// the previous is still playing (ambientAudioSource.isPlaying) - the
// busy clock rides the clip duration. The one-shot wait re-rolls
// System.Random.Next(min, max) - EXCLUSIVE max, integer seconds.
//
// Dungeon water (classic update cadence, verbatim): with a block
// water level, rand() < 50 plays WaterGentle at the surface beside
// the player (x/z +- Range(-3, 3), min dist 8); submerged, rand() <
// 100 adds AmbientWaterBubbles flat. doNotPlayInCastle gates the
// dungeon one-shots (deps.inCastle - LIVE since AUDIT 21 music F3, fed from
// the block the player stands in; it was read here and written by nobody).
//
// The CEMETERY layer is a SECOND channel on the same player, on its own
// clock: cemeteryAmbientSounds = {AmbientDistantHowl, AmbientCreepyBirdCall
// x2} (:45-50 - the bird call is listed TWICE, so it is two thirds of the
// draw), armed by OnEnterLocationRect when the location is a Graveyard and
// the player is outside (:518-529), ticked on its own scene-serialized
// 1/80-second window (:154-162) and played PlaySomewhereAround, min
// distance 13, with NO doNotPlayInCastle gate (:308-320). It shares the
// one ambient one-shot source, so it takes the same busy skip.

import { audio as defaultAudio } from './audio.js';
import { rand } from '../formats/dfRandom.js';
import { CLASSIC_UPDATE_INTERVAL } from '../characters/weaponStates.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';   // OnEnterLocationRect's Graveyard test

// ---- SoundClips indices, verbatim ----
export const AMBIENT_SOUNDS = Object.freeze({
  dungeon: Object.freeze([63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76]),
  // AmbientDripShort, AmbientDripLong, AmbientWindMoan, AmbientWindMoanDeep,
  // AmbientDoorOpen, AmbientGrind, AmbientStrumming, AmbientWindBlow1,
  // AmbientWindBlow1a, AmbientWindBlow1b, AmbientMonsterRoar,
  // AmbientGoldPieces, AmbientBirdCall, AmbientDoorClose
  storm: Object.freeze([348, 349, 350]),   // StormLightningShort/LightningThunder/ThunderRoll
  sunnyDay: Object.freeze([437, 438]),     // BirdCall1/2
});
export const AMBIENT_RAIN_LOOP = 389;      // AmbientRaining
export const AMBIENT_CRICKETS_LOOP = 6;    // AmbientCrickets
export const WATER_GENTLE = 439;
export const AMBIENT_WATER_BUBBLES = 114;

// cemeteryAmbientSounds (:45-50). AmbientDistantHowl = 113 and
// AmbientCreepyBirdCall = 14 (SoundClips.cs:169, :43) - and the bird
// call is listed TWICE, which is the whole of its 2-in-3 weight.
export const CEMETERY_AMBIENT_SOUNDS = Object.freeze([113, 14, 14]);

// The scene-serialized wait windows (DaggerfallUnityGame.unity)
export const DUNGEON_AMBIENT_WAITS = Object.freeze({ minWait: 5, maxWait: 28 });
export const EXTERIOR_AMBIENT_WAITS = Object.freeze({ minWait: 5, maxWait: 25 });
// CemeteryMinWaitTime/CemeteryMaxWaitTime, serialized on the same
// WeatherAmbientEffects object (1/80; the script defaults are 1/80 too).
export const CEMETERY_AMBIENT_WAITS = Object.freeze({ minWait: 1, maxWait: 80 });

/** WeatherManager.SetAmbientEffects, verbatim mapping. */
export function presetForExterior(weather, night) {
  if (weather === 'rain') return 'rain';        // IsRaining && !IsStorming
  if (weather === 'thunder') return 'storm';    // IsRaining && IsStorming
  return night ? 'clearNight' : 'sunnyDay';     // IsDay / IsNight
}

export class AmbientEffects {
  constructor({ minWait, maxWait }, engine = defaultAudio, rng = Math.random, classicRand = rand) {
    this.minWait = minWait;
    this.maxWait = maxWait;
    this.engine = engine;
    this.rng = rng;
    this.classicRand = classicRand;
    this.preset = 'none';
    this._busy = 0;            // the shared ambient channel (isPlaying)
    this._waterCounter = 0;
    this._rainLoop = null;
    this._cricketsLoop = null;
    // The component's own enabled state - see setActive.
    this.active = true;
    // IsCemeteryNearby + its own counter/window (:56-58).
    this.isCemeteryNearby = false;
    this._cemeteryCounter = 0;
    this._cemeteryWait = 0;
    this._startWaiting();
  }

  /** StartWaiting: System.Random.Next(min, max) - EXCLUSIVE max. */
  _startWaiting() {
    this._wait = this.minWait + Math.floor(this.rng() * (this.maxWait - this.minWait));
    this._counter = 0;
  }

  /** StartCemeteryWaiting (:406-411) - the same Next(min, max) over
   *  the cemetery window. */
  _startCemeteryWaiting() {
    this._cemeteryWait = CEMETERY_AMBIENT_WAITS.minWait
      + Math.floor(this.rng() * (CEMETERY_AMBIENT_WAITS.maxWait - CEMETERY_AMBIENT_WAITS.minWait));
    this._cemeteryCounter = 0;
  }

  /** PlayerGPS_OnEnterLocationRect (:518-529), verbatim: the flag is
   *  cleared first, then set only for a Graveyard reached from
   *  OUTSIDE, and setting it starts the cemetery countdown. Walking
   *  into a location rect while already indoors arms nothing. */
  onEnterLocationRect(locationType, { inside = false } = {}) {
    this.isCemeteryNearby = false;
    if (inside) return;
    this.isCemeteryNearby = locationType === LOCATION_TYPES.Graveyard;
    if (this.isCemeteryNearby) this._startCemeteryWaiting();
  }

  /** PlayerGPS_OnExitLocationRect (:531-534). */
  onExitLocationRect() {
    this.isCemeteryNearby = false;
  }

  /** The exterior ambient player is a CHILD of the scene's Exterior
   *  object - WeatherAmbientEffects' m_Father is the GameObject named
   *  "Exterior" (DaggerfallUnityGame.unity:483/1792-1822), which is
   *  the object PlayerEnterExit.ExteriorParent points at (:796-798 of
   *  the scene, PlayerEnterExit.cs:60). So EVERY transition indoors
   *  deactivates it: EnableInteriorParent (:1077-1084) and
   *  EnableDungeonParent (:1094-1106) both call DisableAllParents,
   *  whose ExteriorParent.SetActive(false) (:1048) stops the object's
   *  AudioSources and fires OnDisable, which nulls the rain and
   *  crickets handles (AmbientEffectsPlayer.cs:96-100). Update stops
   *  running with it; EnableExteriorParent (:1056-1071) turns it back
   *  on and Update's lazy branch restarts whichever loop the frozen
   *  Presets still names.
   *
   *  This module used to carry the opposite note - "VERBATIM QUIRK,
   *  the outdoor rain keeps playing indoors" - resting on
   *  WeatherManager.Update returning early while inside and on the
   *  cemetery tick's `!IsPlayerInside` guard supposedly being dead
   *  code otherwise. Both halves were misread: the Presets field does
   *  freeze, but the component holding it is switched off, and the
   *  cemetery guard is live for the DUNGEON instance of this same
   *  component, whose OnEnterLocationRect handler keeps running while
   *  its object is inactive.
   *
   *  The wait counters are plain fields and survive the round trip. */
  setActive(active) {
    active = !!active;
    if (active === this.active) return;
    this.active = active;
    // OnDisable/OnEnable both clear the loop handles; deactivation
    // silences the sources the loops were playing on.
    if (this._rainLoop) { this._rainLoop.stop(); this._rainLoop = null; }
    if (this._cricketsLoop) { this._cricketsLoop.stop(); this._cricketsLoop = null; }
  }

  /** Update's preset-change block (:134-152): the change clears the
   *  loop handles, stops the loop source and re-arms the wait.
   *
   *  WeatherManager.Update (:146-155) opens with "Do nothing if player
   *  inside" and RETURNS, so SetAmbientEffects is never called indoors
   *  and `Presets` stays frozen at whatever the last outdoor frame set
   *  - the preset is not what goes silent on the way in, setActive is.
   *  A setPreset('none') on the interior transition WOULD be a
   *  departure; setActive(false) is the source's own mechanism. */
  setPreset(preset) {
    if (preset === this.preset) return;
    this.preset = preset;
    // preset change stops any loop; the wanted one restarts next update
    if (this._rainLoop) { this._rainLoop.stop(); this._rainLoop = null; }
    if (this._cricketsLoop) { this._cricketsLoop.stop(); this._cricketsLoop = null; }
    this._startWaiting();
  }

  /** Scene teardown. */
  dispose() {
    this.setPreset('none');
  }

  /** The shared one-shot channel: skipped while a clip still plays. */
  _spatialized(index, pos, minDistance) {
    if (this._busy > 0) return;
    const d = this.engine.play3d(index, pos, 1, { refDistance: minDistance, maxDistance: minDistance * 8 });
    this._busy = d ?? 0;
  }

  _flat(index) {
    if (this._busy > 0) return;
    const d = this.engine.playOneShot(index, 1);
    this._busy = d ?? 0;
  }

  /** PlaySomewhereAround: player + onUnitSphere x sqrt(Range(10^2,
   *  20^2)), min 13. (The unit-sphere sample is distribution-
   *  equivalent, not Unity-RNG-exact - no consumer replays it.) */
  _playSomewhereAround(index, playerPos) {
    const z = this.rng() * 2 - 1;
    const theta = this.rng() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const dist = Math.sqrt(100 + this.rng() * (400 - 100));   // sqrt(Range(10^2, 20^2))
    this._spatialized(index, [
      playerPos[0] + r * Math.cos(theta) * dist,
      playerPos[1] + z * dist,
      playerPos[2] + r * Math.sin(theta) * dist,
    ], 13);
  }

  /** PlaySomewhereOnHorizon: a random yaw about +y applied to
   *  (0.94, 0.34, 0) - ~20deg above the horizon - min 3000. */
  _playSomewhereOnHorizon(index, playerPos) {
    const deg = Math.sqrt(this.rng() * 10000 * 10000);   // AngleAxis(sqrt(Range(0, 10000^2)))
    const a = deg * Math.PI / 180;
    const x = 0.94 * Math.cos(a), zz = -0.94 * Math.sin(a);   // Unity AngleAxis about +y (left-handed)
    this._spatialized(index, [playerPos[0] + x, playerPos[1] + 0.34, playerPos[2] + zz], 3000);
  }

  /** PlayCemeteryEffects (:308-320): a uniform Next(0, 3) over the
   *  three-entry table, played somewhere around the player. No
   *  doNotPlayInCastle gate and no preset test - the layer is
   *  independent of whichever sound set Presets names. */
  _playCemeteryEffects(deps) {
    const index = Math.floor(this.rng() * CEMETERY_AMBIENT_SOUNDS.length);
    this._playSomewhereAround(CEMETERY_AMBIENT_SOUNDS[index], deps.playerPos ?? [0, 0, 0]);
  }

  _playEffects(deps) {
    const sounds = AMBIENT_SOUNDS[this.preset];
    if (!sounds) return;   // rain/clearNight/none: loops only
    const index = Math.floor(this.rng() * sounds.length);   // Next(0, length)
    if (this.preset === 'storm') {
      this._playSomewhereOnHorizon(sounds[index], deps.playerPos ?? [0, 0, 0]);
    } else {
      if (deps.inCastle) return;   // doNotPlayInCastle
      this._playSomewhereAround(sounds[index], deps.playerPos ?? [0, 0, 0]);
    }
  }

  /**
   * Per-frame update. deps: { playerPos, inside (PlayerEnterExit
   * .IsPlayerInside - the cemetery layer's own gate), inCastle,
   * waterSurfaceY (the block water level - null when dry),
   * submerged (the P12 head-under flag) }.
   */
  update(dt, deps = {}) {
    // An inactive GameObject's Update does not run (see setActive).
    if (!this.active) return;
    // loops start lazily for their presets (Update, verbatim)
    if ((this.preset === 'rain' || this.preset === 'storm') && !this._rainLoop) {
      this._rainLoop = this.engine.loop(AMBIENT_RAIN_LOOP, 1);
    }
    if (this.preset === 'clearNight' && !this._cricketsLoop) {
      this._cricketsLoop = this.engine.loop(AMBIENT_CRICKETS_LOOP, 1);
    }
    this._busy = Math.max(0, this._busy - dt);
    this._counter += dt;
    this._waterCounter += dt;
    if (this._counter > this._wait) {
      this._playEffects(deps);
      this._startWaiting();
    }
    // The cemetery layer (:154-162). Its counter only advances while
    // the flag is armed AND the player is outside: the guard is what
    // keeps the DUNGEON instance of this component silent when its own
    // OnEnterLocationRect armed it from a graveyard above.
    if (this.isCemeteryNearby && !deps.inside) {
      this._cemeteryCounter += dt;
      if (this._cemeteryCounter > this._cemeteryWait) {
        this._playCemeteryEffects(deps);
        this._startCemeteryWaiting();
      }
    }
    // Water sound effects - "timing based on classic"
    if (this._waterCounter > CLASSIC_UPDATE_INTERVAL) {
      if (deps.waterSurfaceY != null && deps.playerPos) {
        if (this.classicRand() < 50) {
          this._spatialized(WATER_GENTLE, [
            deps.playerPos[0] + (this.rng() * 6 - 3),   // Range(-3f, 3f)
            deps.waterSurfaceY,
            deps.playerPos[2] + (this.rng() * 6 - 3),
          ], 8);
        }
        if (deps.submerged && this.classicRand() < 100) {
          this._flat(AMBIENT_WATER_BUBBLES);
        }
      }
      this._waterCounter = 0;
    }
  }
}

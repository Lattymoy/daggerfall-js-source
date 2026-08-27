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
// the block the player stands in; it was read here and written by nobody);
// the cemetery howl/bird layer pends locations (routed).

import { audio as defaultAudio } from './audio.js';
import { rand } from '../formats/dfRandom.js';
import { CLASSIC_UPDATE_INTERVAL } from '../characters/weaponStates.js';

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
/** AUDIT 26 F089: cemeteryAmbientSounds (:45-50) - the bird is listed
 *  TWICE, so a graveyard calls it two draws in three. */
export const CEMETERY_AMBIENT_SOUNDS = Object.freeze([113, 14, 14]);   // AmbientDistantHowl, AmbientCreepyBirdCall x2
/** CemeteryMinWaitTime / CemeteryMaxWaitTime (:28-29) - its OWN
 *  window, far wider than the shared one. */
export const CEMETERY_AMBIENT_WAITS = Object.freeze({ minWait: 1, maxWait: 80 });
export const WATER_GENTLE = 439;
export const AMBIENT_WATER_BUBBLES = 114;

// The scene-serialized wait windows (DaggerfallUnityGame.unity)
export const DUNGEON_AMBIENT_WAITS = Object.freeze({ minWait: 5, maxWait: 28 });
export const EXTERIOR_AMBIENT_WAITS = Object.freeze({ minWait: 5, maxWait: 25 });

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
    // F089: the SECOND channel - a graveyard's howl/bird layer, armed
    // by the location rect and ticking its own counter beside the
    // shared one (:57-59, :154-162).
    this.cemeteryNearby = false;
    this._cemeteryWait = 0;
    this._cemeteryCounter = 0;
    this._startWaiting();
  }

  /** PlayerGPS_OnEnterLocationRect / OnExitLocationRect (:518-534),
   *  F089: the layer arms when a GRAVEYARD's rect is entered from
   *  OUTSIDE, and disarms on any exit or an inside entry. DFU restarts
   *  the cemetery countdown on the arming edge only. */
  setCemeteryNearby(near) {
    const on = !!near;
    if (on && !this.cemeteryNearby) this._startCemeteryWaiting();
    this.cemeteryNearby = on;
  }

  /** StartCemeteryWaiting (:406-411): Next(1, 80), its own counter. */
  _startCemeteryWaiting() {
    const w = CEMETERY_AMBIENT_WAITS;
    this._cemeteryWait = w.minWait + Math.floor(this.rng() * (w.maxWait - w.minWait));
    this._cemeteryCounter = 0;
  }

  /** PlayCemeteryEffects (:308-320): one draw from the three-entry
   *  list, played somewhere around at minimum distance 13 - the same
   *  PlaySomewhereAround the dungeon one-shots use. */
  _playCemeteryEffects(deps) {
    const list = CEMETERY_AMBIENT_SOUNDS;
    const index = Math.floor(this.rng() * list.length);   // Next(0, length)
    this._playSomewhereAround(list[index], deps.playerPos ?? [0, 0, 0]);
  }

  /** StartWaiting: System.Random.Next(min, max) - EXCLUSIVE max. */
  _startWaiting() {
    this._wait = this.minWait + Math.floor(this.rng() * (this.maxWait - this.minWait));
    this._counter = 0;
  }

  /** VERBATIM QUIRK, checked at AUDIT 21, CHALLENGED by AUDIT 26 F088
   *  and NOT changed - twice now, so here is the decisive evidence.
   *
   *  The outdoor rain/crickets loop keeps playing when you walk into a
   *  building, and layers under the dungeon ambience underground. It is
   *  DFU's behaviour:
   *
   *    - WeatherManager.Update (:146-155) opens with "Do nothing if player
   *      inside" and RETURNS, so SetAmbientEffects is never called and
   *      `Presets` stays frozen at Rain.
   *    - AmbientEffectsPlayer.Update (:134-137) then keeps the loop alive for
   *      as long as Presets says Rain or Storm, and nothing ever stops it:
   *      Update's only early return is `IsMuted` (:109-110).
   *
   *  F088 argued the COMPONENT is disabled indoors - that it hangs off
   *  PlayerEnterExit.ExteriorParent, which DisableAllParents deactivates
   *  on every transition (:1048), OnDisable clearing the loop handles
   *  (:96-100). That hierarchy claim cannot be read from DFU's scripts at
   *  all (the .unity scenes are not in the source tree), and the code
   *  REFUTES it: Update's water arm (:165-175) acts only when
   *  `playerEnterExit.blockWaterLevel != 10000`, and blockWaterLevel is
   *  assigned in exactly one place - inside `if (dungeon &&
   *  isPlayerInsideDungeon)` (PlayerEnterExit.cs:328-343). If the
   *  component were deactivated on entering a dungeon, that whole arm -
   *  its DFRandom rolls, its surface positioning, its classic cadence -
   *  could never run at all. The same goes for the cemetery guard's
   *  `!playerEnterExit.IsPlayerInside` (:154), which is only meaningful
   *  inside a component that ticks while inside.
   *
   *  So a setPreset('none') on the interior transition would be a
   *  DEPARTURE, not a fix, and this port is bug-for-bug. Recorded in
   *  Port-Ledger B, and F088 struck REFUTED with this reasoning. */
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
   * Per-frame update. deps: { playerPos, inCastle,
   * waterSurfaceY (the block water level - null when dry),
   * submerged (the P12 head-under flag) }.
   */
  update(dt, deps = {}) {
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
    // F089: `if (IsCemeteryNearby && !playerEnterExit.IsPlayerInside)`
    // (:154-162) - a SEPARATE counter, so the graveyard layer plays
    // over the ordinary wilderness one rather than instead of it. The
    // inside test is the host's `deps.inside`.
    if (this.cemeteryNearby && !deps.inside) {
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

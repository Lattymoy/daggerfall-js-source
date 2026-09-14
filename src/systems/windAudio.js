// WIND3 (2026-09-14, Mac: "wind audio without being too loud or
// overbearing") - THE WIND, HEARD.
//
// Daggerfall's exterior ambience has no wind: WeatherManager.
// SetAmbientEffects picks rain, storm, a sunny day or a clear night
// (systems/ambientEffects.js presetForExterior), and the wind clips in
// DAGGER.SND - AmbientWindMoan, AmbientWindMoanDeep, AmbientWindBlow1
// /1a/1b - are drawn only as DUNGEON one-shots (AMBIENT_SOUNDS.dungeon).
// The port's wind is its own thing (WIND1) and this gives it a voice
// from those same clips: ONE named loop ('wind', audio.setLoop - the
// riding loop's shape, a clip swapped at its end, never restarted) whose
// gain follows the wind's STRENGTH and breathes with its GUSTS, and
// whose clip goes from the moan to the blow as the wind gets up. The
// ceiling is WIND_GAIN_MAX, a murmur under the rain loop and the birds -
// Mac's "not too loud" is a number here, pinned - and the gain is
// slew-limited so a front's rise is a rise and a gust never pops.
//
// It is NOT AmbientEffects: that module is DFU's AmbientEffectsPlayer
// bug for bug (its indoor carry-over included, AUDIT 26) and stays so.
// The hosts tick this beside it on the exterior frame and STOP it on
// every modal frame (inside a building or a dungeon), as they stop the
// mills' hum - the port's own sounds fall silent indoors. ENHANCED ONLY,
// behind its own row (`wind-sound` on the Features home, the pref
// `windSound`, the player's own online); `?windaudio=off` the kill door.

import { audio as defaultAudio } from './audio.js';
import { SOUND } from './soundClips.js';
import { isEnhanced } from './uiSkin.js';
import { getPref } from './uiPrefs.js';

/** The loudest the wind ever is, as a loop gain (the rain loop plays at
 *  1, the birds at their clips' own level). */
export const WIND_GAIN_MAX = 0.18;
/** How fast the gain may move, per second: a full rise over ~3 s. */
export const WIND_SLEW_PER_S = 0.06;
/** Below this the loop is stopped rather than left whispering. */
export const WIND_GAIN_FLOOR = 0.004;
/** The strength at which the clip goes from the moan to the blow. */
export const WIND_BLOW_AT = 0.62;
/** The loop's name on the engine (audio.setLoop). */
export const WIND_LOOP = 'wind';

const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

/** The gain a wind of `strength01` with gust `gust` asks for: nothing in
 *  a calm, the ceiling in a gale, the gust worth a fifth on top. Never
 *  above WIND_GAIN_MAX. Pure. */
export function windGain(strength01, gust = 1) {
  const g = Math.max(0, Math.min(1, gust));
  return Math.min(WIND_GAIN_MAX, WIND_GAIN_MAX * smooth(0.12, 0.85, strength01) * (0.80 + 0.20 * g));
}

/** The clip for a wind of `strength01`: the moan under WIND_BLOW_AT,
 *  the blow from there. */
export function windClipFor(strength01) {
  return strength01 >= WIND_BLOW_AT ? SOUND.AmbientWindBlow1 : SOUND.AmbientWindMoan;
}

/** The pitch: a touch lower in a breeze, a touch higher in a gale. */
export function windPitchFor(strength01) {
  return 0.92 + 0.16 * Math.max(0, Math.min(1, strength01));
}

/** The loop's switch: the enhanced skin, the `windSound` pref, and
 *  `?windaudio=off` the kill door. */
export function windSoundOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('windSound') && new URLSearchParams(search).get('windaudio') !== 'off';
}

/** The loop's driver: `update(wd, dt, on)` once a frame with
 *  windDrive's answer; `stop()` on a modal frame. */
export function createWindAudio(engine = defaultAudio) {
  let gain = 0;
  let playing = false;
  return {
    /** the current gain, for the record and the tests */
    get gain() { return gain; },
    get playing() { return playing; },
    update(wd, dt, on = true) {
      const target = on && wd?.on ? windGain(wd.strength01, wd.gust) : 0;
      const slew = WIND_SLEW_PER_S * Math.max(0, Number(dt) || 0);
      gain += Math.max(-slew, Math.min(slew, target - gain));
      if (gain < WIND_GAIN_FLOOR && target < WIND_GAIN_FLOOR) {
        gain = 0;
        if (playing) { engine.setLoop(WIND_LOOP, null); playing = false; }
        return;
      }
      const s = wd?.strength01 ?? 0;
      engine.setLoop(WIND_LOOP, windClipFor(s), { volume: gain, pitch: windPitchFor(s) });
      playing = true;
    },
    stop() {
      gain = 0;
      if (playing) { engine.setLoop(WIND_LOOP, null); playing = false; }
    },
  };
}

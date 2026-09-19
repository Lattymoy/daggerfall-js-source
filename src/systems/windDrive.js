// WIND3 (2026-09-14, Mac: "World space wisps that indicate the direction
// of wind and wind audio without being too loud or overbearing; tree and
// flora sprite movement with wind") - THE WIND IN EVERY CONSUMER'S UNITS,
// ONE HOME.
//
// WIND1 made the wind a state of its own and WM2b gave every consumer
// the ONE seam to read it from - the eased row's vector, in the deck's
// units. But the row's units are nobody's working units: the rain and
// the grass want the lab's slider (labWindSlider, 0..200), a rate in
// metres a second (slider * 0.16), a unit direction, the gust envelope
// and the travel integrated over the frame - and each host wrote that
// mapping out longhand, twice for the rain (world.js, exterior.js) and
// once more for the grass, with the rain still on the fixed three-sine
// gust WIND1 had replaced. Three more consumers arrive here - the wisps
// (render/windWisps.js), the wind loop (systems/windAudio.js) and the
// flats' sway (render/renderer.js BB_VS) - and a fourth, fifth and sixth
// copy is the fault WW2 just closed on the motion bag. So this is the
// one mapping: `windDrive(sky, tsec, dt)` reads the seam once a frame
// and answers every unit at once, and every consumer takes the same
// numbers by construction. PURE: it reads the controller and returns.
//
//   on          the deck is known (the enhanced sky, or Dynamic Skies'
//               deck) - false under the classic sky, where every unit
//               is 0 and nothing moves, blows or sounds
//   w           the row's vector, as WM2b hands it
//   dir         its unit direction (x, z), [1, 0] when calm
//   slider      the lab's slider, labWindSlider(w) (a sunny day ~70)
//   strength01  the slider over its top - 0..1, the ONE number the
//               wisps' count, the loop's gain and the sway's amplitude
//               are shaped by
//   gust        the wind's gust multiplier now (WIND1's envelope; the
//               fixed three-sine stack when the controller has none)
//   windV       the lab's rate without the gust, m/s (uWindV)
//   step        the travel THIS FRAME with the gust, m - the integral
//               the rain, the wisps and their wraps add up (PROTO-19's
//               law: the displacement is integrated on the CPU and handed
//               over as a distance already travelled), dt clamped to
//               WIND_STEP_DT_MAX so a hitch never throws the field

import { labWindSlider } from '../render/labGrass.js';
import { isEnhanced } from './uiSkin.js';
import { getPref } from './uiPrefs.js';
import { TALL_FLAT_HEIGHT } from '../world/flatDistance.js';

/** The lab's metres a second per slider unit (grass-proto.html frame()). */
export const LAB_WIND_RATE = 0.16;
/** The lab's slider top - labWindSlider clamps here. */
export const WIND_SLIDER_MAX = 200;
/** The longest frame the travel integrates over (WX1's dtp clamp). */
export const WIND_STEP_DT_MAX = 0.05;

/** WX1's fixed gust stack, kept as the fallback for a controller that has
 *  no envelope of its own (a bare deck in a test, the mod's deck). */
export function legacyGust(tsec) {
  return 0.72 + 0.20 * Math.sin(tsec * 0.31) + 0.14 * Math.sin(tsec * 0.83 + 1.7) + 0.10 * Math.sin(tsec * 2.10 + 0.4);
}

/** The frame's wind, in every unit. */
export function windDrive(sky, tsec, dt = 0) {
  const on = !!sky?.cloudShadow;
  const w = sky?.cloudShadow?.wind ?? [0, 0];
  const mag = Math.hypot(w[0], w[1]);
  const dir = mag > 1e-6 ? [w[0] / mag, w[1] / mag] : [1, 0];
  const slider = labWindSlider(w);
  const gust = sky?.gustAt?.(tsec) ?? legacyGust(tsec);
  const rate = slider * LAB_WIND_RATE;
  const windV = [dir[0] * rate, dir[1] * rate];
  const ds = Math.min(WIND_STEP_DT_MAX, Math.max(0, Number(dt) || 0));
  return {
    on, w, dir, slider,
    strength01: Math.min(1, slider / WIND_SLIDER_MAX),
    gust,
    windV,
    step: [windV[0] * gust * ds, windV[1] * gust * ds],
  };
}

/** The wind with nothing in it - what a consumer takes when its switch is
 *  off, so it winds down through the same path it winds up. */
export const WIND_NONE = Object.freeze({ on: false, w: [0, 0], dir: [1, 0], slider: 0, strength01: 0, gust: 1, windV: [0, 0], step: [0, 0] });

// ── THE FLATS' SWAY ──────────────────────────────────────────────────
/** How much a flat batch leans with the wind: the climate's NATURE
 *  archive is the trees and the plants, and a tall record (a tree,
 *  TALL_FLAT_HEIGHT and up, world/flatDistance.js) sways whole while a
 *  short one (a bush, a shrub) takes six tenths - a bush is stiffer than
 *  a crown. Every other archive (people, lights, signs, the dungeon's
 *  flats, the foes) stands still: 0. The renderer multiplies the lean by
 *  this per batch (uSway). */
export function floraSwayOf(archive, natureArchive, height) {
  if (archive !== natureArchive) return 0;
  return height >= TALL_FLAT_HEIGHT ? 1 : 0.6;
}

/** The sway's switch: the enhanced skin, the `floraSway` pref (a row on
 *  the Features home, the player's own online), and `?sway=off` the
 *  kill door. Read once a frame by the two exterior hosts. */
export function floraSwayOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('floraSway') && !swayDisabled(search);
}

/** PERF-SUN (2026-09-19): the `?sway=off` door, READ ONCE.
 *
 *  `floraSwayOn` is called once a frame by each exterior host, and it was
 *  minting a URLSearchParams and parsing the query string every time to
 *  ask a question whose answer cannot change while the page is open. The
 *  pref beside it stays live - the player can toggle that mid-session -
 *  and only the URL door is cached, which is `cullDisabled`'s own shape
 *  in render/frustum.js. Tiny, and it is the kind of thing that is only
 *  ever tiny one call site at a time. */
let _swayOff;
export function swayDisabled(search = globalThis.location?.search ?? '') {
  if (_swayOff === undefined || search !== _swaySearch) {
    _swaySearch = search;
    _swayOff = new URLSearchParams(search).get('sway') === 'off';
  }
  return _swayOff;
}
let _swaySearch;

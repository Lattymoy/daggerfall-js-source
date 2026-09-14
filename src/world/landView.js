// LV1 - LAND VIEW DISTANCE, ENHANCED (2026-09-12). Mac: "I wanna push
// the draw distance as far as we can push it while keeping performance
// perfect."
//
// WHAT THE DISTANCE IS. StreamingWorld.TerrainDistance (StreamingWorld.cs:
// 55-56, [Range(1,4)], default 3) is the Chebyshev radius in map pixels
// of the streamed grid - 3 is the 7x7, 49 pixels of 819.2 units. DFU's
// launcher caps it at 4 and the port's 1:1 lane keeps that cap and that
// default (Experimental/TerrainDistance, settingsDefaults). The ENHANCED
// lane already pays less for a far pixel than DFU does: from the third
// ring out the terrain builds strided 4x (EV4, a 16x triangle cut), its
// flats draw only when tall or moving (MAC1), the grass grows in the
// near pixels alone (PERF2), and the fog end scales with the radius
// (EV4's scaleFogForDistance) so the land streamed is land seen. So the
// enhanced lane takes its OWN radius, the Enhanced pane's Land view
// distance (uiPrefs landViewDistance), 1..6 with 5 the default: 121
// pixels, 72 of them the cheap kind, the haze at 4000 units. Six is the
// ceiling because past it the far province ring (EV8, radius 48) and
// the streamed grid's build queue are the binding costs on a walk, not
// the draw - a pixel crossing rebuilds a whole edge of the grid, 13
// pixels at 6 - and "perfect" was the word.
//
// ONE FUNCTION decides, pure, so both of the world host's reads - the
// grid's radius and the fog's scale - agree, and the tests can pin it
// without a world.
//
// FT2 (2026-09-14, the Features arc): ONE ROW FOR BOTH LANES. Two
// controls sat in two panes - the Enhanced category's Land view distance
// over the pref, Video's Land View Distance over DFU's key - for the one
// radius, and a player who set one could not see it had not moved the
// other. The Features home draws ONE row, wearing Enhanced and DFU
// Classic: it SHOWS the radius the current lane will use (landViewRead)
// and its control WRITES BOTH STORES (landViewWrite) - the pref whole,
// DFU's key capped at its own 4 - so the two lanes agree after every
// press. The tiers now span both lanes, 1..6, because the row must be
// able to name any value either lane can hold (an imported settings.ini
// with TerrainDistance 2 shows 2 on the classic skin).

import { getPref, setPref } from '../systems/uiPrefs.js';
import { getInt, setValue, saveSettings } from '../systems/settings.js';
import { isEnhanced } from '../systems/uiSkin.js';

export const LAND_VIEW_MIN = 1;
export const LAND_VIEW_MAX = 6;         // the enhanced lane's ceiling
export const LAND_VIEW_DFU_MAX = 4;     // StreamingWorld.cs [Range(1,4)]
export const LAND_VIEW_DEFAULT = 5;     // the Enhanced pane's default (uiPrefs landViewDistance)

/** The row's tiers: value and label, DFU's whole 1..4 and the enhanced
 *  lane's 5..6 (FT2), Daggerfall's own 3 named. */
export const LAND_VIEW_TIERS = Object.freeze([
  [1, '1'], [2, '2'], [3, 'Daggerfall\u2019s (3)'], [4, '4'], [5, '5'], [6, 'Furthest (6)'],
]);

const clampInt = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** The streamed grid's radius for this boot. `enhanced` is the enhanced
 *  lane (isEnhanced() and the Enhanced environments switch); `pref` the
 *  pane's landViewDistance; `setting` DFU's Experimental/TerrainDistance
 *  as the settings store answers it (already 1..4). The 1:1 lane is
 *  DFU's number untouched. */
export function landViewDistance({ enhanced, pref, setting }) {
  if (!enhanced) return clampInt(setting, LAND_VIEW_MIN, LAND_VIEW_DFU_MAX, 3);
  return clampInt(pref, LAND_VIEW_MIN, LAND_VIEW_MAX, LAND_VIEW_DEFAULT);
}

/** Is this boot the enhanced outdoors - the enhanced skin with its
 *  environments on? The world host's own question, asked once here. */
export const enhancedOutdoors = () => isEnhanced() && !!getPref('enhancedEnvironments');

/** FT2: the radius the current lane will use, off the live stores -
 *  what the world host reads at mount and what the Features row shows. */
export function landViewRead({ enhanced = enhancedOutdoors() } = {}) {
  return landViewDistance({ enhanced, pref: getPref('landViewDistance'), setting: getInt('Experimental', 'TerrainDistance', 1, 4) });
}

/** FT2: ONE control writes BOTH stores - the pref whole (1..6), DFU's
 *  Experimental/TerrainDistance capped at its own [Range(1,4)] - so
 *  the lanes agree after every press. Answers the value written. */
export function landViewWrite(v) {
  const n = clampInt(v, LAND_VIEW_MIN, LAND_VIEW_MAX, LAND_VIEW_DEFAULT);
  setPref('landViewDistance', n);
  setValue('Experimental', 'TerrainDistance', String(Math.min(n, LAND_VIEW_DFU_MAX)));
  saveSettings();
  return n;
}

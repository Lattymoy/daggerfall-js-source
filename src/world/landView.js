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

export const LAND_VIEW_MIN = 1;
export const LAND_VIEW_MAX = 6;         // the enhanced lane's ceiling
export const LAND_VIEW_DFU_MAX = 4;     // StreamingWorld.cs [Range(1,4)]
export const LAND_VIEW_DEFAULT = 5;     // the Enhanced pane's default (uiPrefs landViewDistance)

/** The Enhanced pane's tiers: value and label. Daggerfall's own 3 first. */
export const LAND_VIEW_TIERS = Object.freeze([
  [3, 'Daggerfall\u2019s (3)'], [4, '4'], [5, '5'], [6, 'Furthest (6)'],
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

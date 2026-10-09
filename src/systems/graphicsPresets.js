// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): THE GRAPHICS
// PRESET. One choice over the five settings that cost the most - how far the land is drawn, the grass, the clouds, the
// ground's sharpness into the distance and the water - each a Features row whose own note already says it is the one
// to turn down when the game runs slow (systems/features.js). HIGH IS HOW THE GAME SHIPS: every value in it is its row's
// default, so a player who never touched them reads High, not Custom (test/org2_options.test.js holds it to the rows'
// own defaults). Render scale is not in it - it is the picture's resolution, a choice of its own on the same page.
//
// A preset is the rows' VALUES, never their labels or positions: each is written through the row's own door (the
// menu's tileStates, so a lane's second store - land view's TerrainDistance - moves with it), and read back the same
// way to say which preset the rows stand at, or Custom when they stand at none.

/** The rows a preset sets, in the order the page draws them. */
export const PRESET_ROWS = Object.freeze(['land-view-distance', 'grass', 'cloud-quality', 'ground-sharpness', 'water-quality']);

export const GRAPHICS_PRESETS = Object.freeze([
  Object.freeze({ id: 'low', label: 'Low', note: 'For older machines: Daggerfall\u2019s own view distance, a quarter of the grass, light clouds, the ground blurred far off, simple water.',
    values: Object.freeze({ 'land-view-distance': 3, grass: 0.25, 'cloud-quality': 'lo', 'ground-sharpness': 'off', 'water-quality': 'simple' }) }),
  Object.freeze({ id: 'medium', label: 'Medium', note: 'Most of the look for less: a shorter view, half the grass, light clouds, simple water.',
    values: Object.freeze({ 'land-view-distance': 4, grass: 0.5, 'cloud-quality': 'lo', 'ground-sharpness': 'default', 'water-quality': 'simple' }) }),
  Object.freeze({ id: 'high', label: 'High', note: 'How the game ships.',
    values: Object.freeze({ 'land-view-distance': 5, grass: 1, 'cloud-quality': 'default', 'ground-sharpness': 'default', 'water-quality': 'full' }) }),
  Object.freeze({ id: 'ultra', label: 'Ultra', note: 'For a strong machine: the furthest view, the most detailed clouds and the sharpest ground.',
    values: Object.freeze({ 'land-view-distance': 6, grass: 1, 'cloud-quality': 'hi', 'ground-sharpness': 'max', 'water-quality': 'full' }) }),
]);

/** The preset the rows stand at, or null (Custom). `valueOf(id)` reads a row's current value. */
export function presetNow(valueOf) {
  return GRAPHICS_PRESETS.find((p) => PRESET_ROWS.every((id) => String(valueOf(id)) === String(p.values[id]))) ?? null;
}

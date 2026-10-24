// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): THE GRAPHICS
// PRESET. One choice over the settings that cost the most - how far the land is drawn, the grass, the clouds, the
// ground's sharpness into the distance, the water and (RW1) the real windows - each a Features row whose own note says it is the one
// to turn down when the game runs slow (systems/features.js). HIGH IS HOW THE GAME SHIPS: every value in it is its row's
// default, so a player who never touched them reads High, not Custom (test/systems/org2_options.test.js holds it to the rows'
// own defaults). Render scale is not in it - it is the picture's resolution, a choice of its own on the same page.
//
// A preset is the rows' VALUES, never their labels or positions: each is written through the row's own door (the
// menu's tileStates, so a lane's second store - land view's TerrainDistance - moves with it), and read back the same
// way to say which preset the rows stand at, or Custom when they stand at none.

import { FEATURES, resolveControl } from './features.js';

/** The rows a preset sets, in the order the page draws them. */
export const PRESET_ROWS = Object.freeze(['land-view-distance', 'grass', 'cloud-quality', 'ground-sharpness', 'water-quality', 'real-windows']);   // RW1: and the real windows - off on Low, the rooms alone on Medium, the view out too from High
/** MEM-AUDIT (2026-10-23, the owner: "dig into the performance settings ... ensuring they are perfect"): THE PARTS A PRESET
 *  SETS - a row's drawer switch, by its pref, whose own note says it costs frame rate. Steady shadows (Enhanced lighting's
 *  part, FLICKER-FIX) redraws every far caster and swaying wood's shadow every frame - 42 lantern face passes a frame at
 *  Knightstale by day (Performance-Next.md, item 9) - and the preset left it standing on Low; render scale, whose note
 *  says so too, is a choice of its own (the spec). Off on Low alone: Medium and up keep the steady picture, and High is
 *  still its default. */
export const PRESET_PARTS = Object.freeze(['steadyShadows']);

export const GRAPHICS_PRESETS = Object.freeze([
  Object.freeze({ id: 'low', label: 'Low', values: Object.freeze({ 'land-view-distance': 3, grass: 0.25, 'cloud-quality': 'lo', 'ground-sharpness': 'off', 'water-quality': 'simple', 'real-windows': 'off' }), parts: Object.freeze({ steadyShadows: false }) }),
  Object.freeze({ id: 'medium', label: 'Medium', values: Object.freeze({ 'land-view-distance': 4, grass: 0.5, 'cloud-quality': 'lo', 'ground-sharpness': 'default', 'water-quality': 'simple', 'real-windows': 'rooms' }), parts: Object.freeze({ steadyShadows: true }) }),
  Object.freeze({ id: 'high', label: 'High', values: Object.freeze({ 'land-view-distance': 5, grass: 1, 'cloud-quality': 'default', 'ground-sharpness': 'default', 'water-quality': 'full', 'real-windows': 'full' }), parts: Object.freeze({ steadyShadows: true }) }),
  Object.freeze({ id: 'ultra', label: 'Ultra', values: Object.freeze({ 'land-view-distance': 6, grass: 1, 'cloud-quality': 'hi', 'ground-sharpness': 'max', 'water-quality': 'full', 'real-windows': 'full' }), parts: Object.freeze({ steadyShadows: true }) }),
]);

/** AUDIT MEM-AUDIT G2: a preset's value for a row as the row reads once it is written - its lane's `readOf` (land view's,
 *  world/landView.js landViewAsRead: off the enhanced outdoors, DFU's number capped at 4), the value itself elsewhere. */
export function presetAsRead(id, v) {
  const c = resolveControl(FEATURES.find((f) => f.id === id));
  return typeof c?.readOf === 'function' ? c.readOf(v) : v;
}

/** The preset the rows and parts stand at, or null (Custom). `valueOf(id)` reads a row's current value, `partOf(key)` a
 *  part's pref; `asRead` what a row reads once a value is written (presetAsRead). */
export function presetNow(valueOf, partOf, asRead = presetAsRead) {
  return GRAPHICS_PRESETS.find((p) => PRESET_ROWS.every((id) => String(valueOf(id)) === String(asRead(id, p.values[id])))
    && PRESET_PARTS.every((k) => String(partOf(k)) === String(p.parts[k]))) ?? null;
}

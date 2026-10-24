// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BOAT-MARK (2026-10-01, the field: a Large Boat put in from its deed,
// her owner killed aboard her and woken at a temple - "is there any way
// to know where your ships are located at?", then "I want to build a
// compass icon that tracks your boat"): YOUR BOATS ON THE COMPASS. A
// Large Boat's deed and a Rowboat's parts are spent on placing
// (systems/comeSailAway/comeSailAway.js takePlaceItem), the boat is kept where she
// was left, and nothing in the game said where that was - the compass
// marked the sea's ships (scenes/naval/navalHost.js compassShips), never the
// player's own. Now every boat Come Sail Away keeps for me stands on
// both compasses (ui/hud/hud.js drawBoatCompassMarks, ui/enhanced/enhancedHud.js) as
// a little boat in one sea-glass teal, from anywhere on the street,
// however far off she lies:
//   - a boat in sight (her pixel within one of mine - UpdateBoatVisibility's
//     law) is marked where she floats;
//   - one out of sight is marked where she floats while that place still
//     stands on her own map pixel in this frame (every recentre and every
//     teleport carries her: OnPositionUpdate, OnWorldReanchored), and at
//     her pixel's middle when it does not - a dungeon's boat, which stands
//     in the dungeon's own frame, or a frame a load never carried her into;
//   - none for the boat at my helm, nor for one I stand at
//     (BOAT_MARK_NEAR_M), whose bearing would swing with every step.
// The colour keeps clear of every other mark on the strip (the party's
// green, the Detect markers' red, the gate's ember, the quest's gold, the
// ships' red, bone and grey, the professions' five - test/ui/boatmark.test.js
// holds the distances), and the shape is its own: a sail over a hull.
// A leaf - it imports nothing, so the HUD takes it without taking the
// sailing runtime.
// ═══════════════════════════════════════════════════════════════════

/** The mark's colour (CSS hex): sea-glass teal. */
export const BOAT_MARK_CSS = '#20e0b0';
/** The same as display-encoded floats [r, g, b, a] - the classic compass's quads. */
export const BOAT_MARK_RGB = Object.freeze([0x20 / 255, 0xe0 / 255, 0xb0 / 255, 1]);

/** Within this of a boat's root, flat (m), her mark stands down: I am at her - on her deck, or on the quay beside her. */
export const BOAT_MARK_NEAR_M = 12;
/** How far past her own pixel's edge a boat out of sight may float and still be taken at her place (m): a boat put in
 *  from a pixel's edge, or left just over one she was sailed across, keeps the pixel she was left on. */
export const BOAT_PIXEL_SLACK_M = 120;

/** The classic glyph, in native pixels: BOAT_GLYPH_W across, a row per entry, each row its runs `[from, length]` - a
 *  sail on its mast over a hull. */
export const BOAT_GLYPH_W = 7;
export const BOAT_GLYPH_ROWS = Object.freeze([
  Object.freeze([Object.freeze([3, 1])]),
  Object.freeze([Object.freeze([3, 2])]),
  Object.freeze([Object.freeze([3, 3])]),
  Object.freeze([Object.freeze([0, 7])]),
  Object.freeze([Object.freeze([1, 5])]),
]);

/** The enhanced strip's glyph: the same boat drawn at 14x12 CSS px, edged dark as every other mark on the strip is. */
export const BOAT_GLYPH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 14 12">'
  + `<path d="M7 1 L12 8 H7 Z M1 8.5 H13 L10.5 11.5 H3.5 Z" fill="${BOAT_MARK_CSS}" stroke="#0a0c11" stroke-width="1" `
  + 'stroke-linejoin="round" paint-order="stroke"/></svg>';
export const BOAT_GLYPH_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(BOAT_GLYPH_SVG)}")`;

/**
 * @typedef {{ GameObject?: { position?: ArrayLike<number>, activeSelf?: boolean } | null,
 *   MapPixel?: { X: number, Y: number } | null, inside?: boolean }} MarkedBoat Come Sail Away's Boat, as far as the
 *   mark reads it
 * @typedef {{ pixelTranslation: (px: number, py: number, out: number[]) => ArrayLike<number> }} MarkWorld the
 *   streaming world (world/streamingWorld.js StreamingWorldState): `pixelTranslation` a map pixel's corner in this
 *   frame, [x, y, z]
 */

const _t = [0, 0, 0];
/**
 * WHERE A BOAT'S MARK POINTS, scene XZ, into `out` - or null when she cannot be placed. In sight (active, never a
 * dungeon's): where she floats. Out of sight: where she floats while that stands within BOAT_PIXEL_SLACK_M of her own
 * pixel's square in this frame, else that pixel's middle; a dungeon's boat always the middle. Pure.
 * @param {MarkedBoat} boat
 * @param {MarkWorld} world
 * @param {number} terrainSize a map pixel's edge in the scene
 * @param {number[]} [out]
 */
export function boatMarkAt(boat, world, terrainSize, out = [0, 0]) {
  const p = boat?.GameObject?.position;
  const live = !!p && Number.isFinite(p[0]) && Number.isFinite(p[2]);
  if (boat?.GameObject?.activeSelf && !boat.inside) {
    if (!live) return null;
    out[0] = p[0]; out[1] = p[2];
    return out;
  }
  const px = boat?.MapPixel;
  if (!px || !Number.isInteger(px.X) || !Number.isInteger(px.Y)) return null;
  const t = world.pixelTranslation(px.X, px.Y, _t);
  const x0 = t[0], z0 = t[2];
  if (live && !boat.inside
    && p[0] >= x0 - BOAT_PIXEL_SLACK_M && p[0] <= x0 + terrainSize + BOAT_PIXEL_SLACK_M
    && p[2] >= z0 - BOAT_PIXEL_SLACK_M && p[2] <= z0 + terrainSize + BOAT_PIXEL_SLACK_M) {
    out[0] = p[0]; out[1] = p[2];
    return out;
  }
  out[0] = x0 + terrainSize / 2; out[1] = z0 + terrainSize / 2;
  return out;
}

/** The compass's points: one list, refilled (AUDIT WB D10's law) - the HUD reads it in the frame it is made. */
const _points = /** @type {number[][]} */ ([]);
const _pool = /** @type {number[][]} */ ([]);
/**
 * THE COMPASS'S BOAT POINTS: scene XZ, one a boat of mine the compass marks (boatMarkAt), the boat at my helm
 * (`current`) and any within BOAT_MARK_NEAR_M of my feet left out. Null with nothing to mark, or without my feet.
 * Positional, and nothing made but the points' own pool: the street's HUD asks it every frame.
 * @param {ReadonlyArray<MarkedBoat>|null|undefined} boats Come Sail Away's AllBoats
 * @param {MarkedBoat|null} current the boat at my helm
 * @param {ArrayLike<number>|null} feet my feet, scene [x, y, z]
 * @param {MarkWorld} world
 * @param {number} terrainSize a map pixel's edge in the scene
 * @returns {number[][]|null}
 */
export function boatCompassPoints(boats, current, feet, world, terrainSize) {
  _points.length = 0;
  if (!boats || !boats.length || !feet) return null;
  let used = 0;
  for (const boat of boats) {
    if (!boat || boat === current) continue;
    const p = _pool[used] ??= [0, 0];
    if (!boatMarkAt(boat, world, terrainSize, p)) continue;
    if (Math.hypot(p[0] - feet[0], p[1] - feet[2]) < BOAT_MARK_NEAR_M) continue;
    used++;
    _points.push(p);
  }
  return _points.length ? _points : null;
}

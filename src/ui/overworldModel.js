// ═══════════════════════════════════════════════════════════════════
// U61 — THE OVERWORLD MODEL: the whole Iliac Bay as one relief, from
// data alone.
//
// The enhanced travel map does not draw a picture OF the world - it
// draws the world: the same 1000x500 WOODS.WLD small heightmap every
// streamed terrain pixel is sampled from, one vertex per map pixel,
// tinted by the same CLIMATE.PAK byte the travel calculator charges.
// This module is PURE - typed arrays in, typed arrays out, no DOM, no
// GL - so a node test can hold the relief against the height law with
// synthetic bytes, and the browser probe can stand up a small
// synthetic bay on a machine that has no game data.
//
// ── WHAT IS LAW AND WHAT IS SKIN ─────────────────────────────────
//
// LAW (terrainSampler.js): base elevation = byte * 8, floored at
// SCALED_OCEAN_ELEVATION 27.2 - the noise terms add at most +14
// before normalization, invisible at one vertex per 819.2m. The
// relief keeps that formula and scales it by ONE documented
// exaggeration constant, because at true scale the Wrothgarians are
// 2.8 map-pixel units tall over a 1000-unit map - a plain.
//
// LAW (two water tests, both the port's): a pixel is water where its
// CLIMATE.PAK byte is Ocean (223) - the travel calculator's own test -
// OR its height byte floors out (byte*8 <= 27.2, i.e. byte <= 3), the
// streamed terrain's own test. Ocean pixels carry climateType Swamp
// in getWorldClimateSettings, so tinting by ground archive would
// paint the sea swamp-green (the recorded trap).
//
// SKIN (recorded departure): the terrain and dot COLORS are the
// enhanced skin's own. The classic map's terrain is baked art
// (TRAV0I00.IMG, FMAP pages) and its dots are FMAP_PAL.COL entries -
// there is no data-driven color table in DFU to port. The dot
// PALETTE here is ours; the dot BUCKETS are not: which locations a
// filter hides and which type gets which slot is getPixelColorIndex,
// imported from the classic window - one home, both skins.
// ═══════════════════════════════════════════════════════════════════

import { CLIMATES, getPixelFromPixelID } from '../formats/mapsFile.js';
import { SCALED_OCEAN_ELEVATION, BASE_HEIGHT_SCALE } from '../world/terrainSampler.js';   // AUDIT EV F-DOC7: one home for the byte*8 base term
import { getPixelColorIndex, checkLocationDiscovered } from './travelMapWindow.js';

// One map pixel = one scene unit; the streamed world's sign convention
// (scene z = -py, so north is +z) kept so a mind that knows one map
// knows both.
export const OVERWORLD_RELIEF = 24;   // vertical exaggeration - skin, documented above
export { BASE_HEIGHT_SCALE };   // AUDIT EV F-DOC7: re-exported from terrainSampler - was a private copy of the 8 here, one silent-divergence hazard
/** World units per map pixel in the STREAMED world - the divisor that
 *  brings the height law into map-pixel units. */
const UNITS_PER_PIXEL = 819.2;
const TRUE_VERTICAL = 1.5;            // DEFAULT_TERRAIN_SCALE - sample * 1539 * 1.5

/** The height law in overworld units: max(byte*8, 27.2) through the
 *  streamed world's own vertical scale, exaggerated by OVERWORLD_RELIEF. */
export function overworldHeight(byte) {
  return (Math.max(byte * BASE_HEIGHT_SCALE, SCALED_OCEAN_ELEVATION) * TRUE_VERTICAL
    / UNITS_PER_PIXEL) * OVERWORLD_RELIEF;
}
/** The flat sea, in the same units. */
export const OVERWORLD_SEA_LEVEL = overworldHeight(0);

/** BOTH port water tests, OR-ed (see header). `climate` may be -1
 *  (PakFile's out-of-range answer) - that is not water, it is the
 *  edge of the data. */
export function isWaterPixel(climate, byte) {
  return climate === CLIMATES.Ocean || byte * BASE_HEIGHT_SCALE <= SCALED_OCEAN_ELEVATION;
}

/** The enhanced skin's climate tints, keyed by the raw CLIMATE.PAK
 *  value (223..232). SKIN - see the header for why no DFU table backs
 *  this. The default arm mirrors getWorldClimateSettings' own default
 *  (temperate woodlands). */
export const OVERWORLD_CLIMATE_COLORS = Object.freeze({
  [CLIMATES.Ocean]: [24, 49, 74],
  [CLIMATES.Desert]: [187, 159, 111],
  [CLIMATES.Desert2]: [199, 170, 118],
  [CLIMATES.Mountain]: [128, 121, 109],
  [CLIMATES.Rainforest]: [45, 93, 53],
  [CLIMATES.Swamp]: [88, 99, 61],
  [CLIMATES.Subtropical]: [170, 154, 102],
  [CLIMATES.MountainWoods]: [88, 102, 75],
  [CLIMATES.Woodlands]: [75, 107, 63],
  [CLIMATES.HauntedWoodlands]: [67, 85, 67],
});
const DEFAULT_LAND = OVERWORLD_CLIMATE_COLORS[CLIMATES.Woodlands];
const SHALLOWS = [40, 76, 96];        // byte 1-3 water shades toward the coast
const HIGHLAND = [148, 142, 130];     // rock creeping in above the treeline
const SNOWLINE = [232, 236, 240];     // the peaks
/** Where the land tint starts lending itself to rock and then snow,
 *  in height-map bytes. SKIN. */
export const TREELINE_BYTE = 64;
export const SNOWLINE_BYTE = 104;

const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** One vertex's tint before slope shading: water by depth, land by
 *  climate with rock/snow blended in above the treeline. Exported for
 *  the probe, which asserts screen pixels against it. */
export function overworldTint(climate, byte) {
  if (isWaterPixel(climate, byte)) {
    const t = Math.min(1, Math.max(0, byte / 3));
    return lerp3(OVERWORLD_CLIMATE_COLORS[CLIMATES.Ocean], SHALLOWS, t);
  }
  let c = OVERWORLD_CLIMATE_COLORS[climate] ?? DEFAULT_LAND;
  if (byte > TREELINE_BYTE) {
    const t = Math.min(1, (byte - TREELINE_BYTE) / (SNOWLINE_BYTE - TREELINE_BYTE));
    c = lerp3(c, HIGHLAND, t);
  }
  if (byte > SNOWLINE_BYTE) {
    const t = Math.min(1, (byte - SNOWLINE_BYTE) / 24);
    c = lerp3(c, SNOWLINE, t);
  }
  return c;
}

/**
 * The relief. `heightBytes` is WOODS' own row-major buffer
 * (y * width + x - woodsFile.js:99's layout law); `climateAt(x, y)`
 * answers the raw CLIMATE.PAK value at a map pixel (the +1 PAK column
 * shift is the CALLER's - hand maps.getClimateIndex, which owns it).
 *
 * Returns { positions, colors, indices, width, height }:
 *   positions - Float32Array, xyz per vertex, x = px + 0.5,
 *               z = -(py + 0.5) (pixel CENTERS, so a location's marker
 *               stands on its own pixel's vertex), y = overworldHeight
 *   colors    - Uint8Array, rgb per vertex, slope-shaded
 *   indices   - Uint32Array, two triangles per cell
 */
/** ROADS 7: the thread a road draws on the relief. A packed-earth brown
 *  for a road, blended hard so it reads at one vertex per 819m; a
 *  lighter, fainter dirt for a track. Never on water - a road bit over
 *  water is a routing bug and the map should show the terrain, not hide
 *  it. Colours are ours, like the rest of this table (:33). */
export const OVERWORLD_ROAD = [118, 92, 62];
export const OVERWORLD_TRACK = [150, 128, 96];

export function buildOverworldGrid({ heightBytes, width, height, climateAt, pathAt = null }) {
  const positions = new Float32Array(width * height * 3);
  const colors = new Uint8Array(width * height * 3);
  const at = (x, y) => heightBytes[y * width + x];
  // Clamped-edge neighbour reads, WoodsFile.getHeightMapValue's own
  // clamp shape.
  const cl = (x, y) => at(Math.min(width - 1, Math.max(0, x)), Math.min(height - 1, Math.max(0, y)));

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      const byte = at(px, py);
      positions[i * 3] = px + 0.5;
      positions[i * 3 + 1] = overworldHeight(byte);
      positions[i * 3 + 2] = -(py + 0.5);

      const climate = climateAt(px, py);
      const water = isWaterPixel(climate, byte);
      let [r, g, b] = overworldTint(climate, byte);
      if (!water) {
        // A fixed north-west sun baked into the vertex color: the map
        // is read, not lit, so the light never moves and the shader
        // needs no normals. A NW-facing flank DESCENDS toward the sun
        // - its SE neighbour (px+1, py+1; map y runs SOUTH) stands
        // HIGHER - so that difference is what brightens. The first
        // draft had the operands swapped and lit the shadow side; the
        // review's verifier executed it and caught the inversion.
        const slope = (cl(px + 1, py + 1) - cl(px - 1, py - 1)) * BASE_HEIGHT_SCALE;
        const shade = Math.min(1.18, Math.max(0.55, 0.9 + slope * 0.004));
        r *= shade; g *= shade; b *= shade;
        // ROADS 7: the thread. 2 = road, 1 = track, 0 = nothing.
        const path = pathAt ? pathAt(px, py) : 0;
        if (path === 2) { [r, g, b] = lerp3([r, g, b], OVERWORLD_ROAD, 0.85); }
        else if (path === 1) { [r, g, b] = lerp3([r, g, b], OVERWORLD_TRACK, 0.55); }
      }
      colors[i * 3] = Math.min(255, r | 0);
      colors[i * 3 + 1] = Math.min(255, g | 0);
      colors[i * 3 + 2] = Math.min(255, b | 0);
    }
  }

  const indices = new Uint32Array((width - 1) * (height - 1) * 6);
  let k = 0;
  for (let py = 0; py < height - 1; py++) {
    for (let px = 0; px < width - 1; px++) {
      const a = py * width + px;
      const b2 = a + 1;
      const c = a + width;
      const d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b2;
      indices[k++] = b2; indices[k++] = c; indices[k++] = d;
    }
  }
  return { positions, colors, indices, width, height };
}

// ── THE MARKERS ──────────────────────────────────────────────────

/** The enhanced skin's dot palette, indexed by getPixelColorIndex's
 *  answer - the same fourteen slots the FMAP_PAL indices fill on the
 *  classic map, so the BUCKETS are the one law and only the paint is
 *  ours. Towns gold, temples cool, dungeons ember, homes hearth. */
export const OVERWORLD_DOT_COLORS = Object.freeze([
  [255, 92, 60],    // 0 DungeonLabyrinth
  [238, 118, 48],   // 1 DungeonKeep
  [204, 126, 66],   // 2 DungeonRuin
  [158, 116, 88],   // 3 Graveyard
  [176, 82, 134],   // 4 Coven
  [186, 168, 118],  // 5 HomeFarms
  [224, 198, 134],  // 6 HomeWealthy
  [166, 150, 114],  // 7 HomePoor
  [102, 194, 208],  // 8 ReligionTemple
  [134, 164, 224],  // 9 ReligionCult
  [242, 202, 84],   // 10 Tavern
  [255, 234, 152],  // 11 TownCity
  [238, 216, 142],  // 12 TownHamlet
  [212, 194, 132],  // 13 TownVillage
]);
/** Marker radius by the same slots, in screen pixels at rest - a city
 *  reads from across the bay, a coven has to be looked for. */
export const OVERWORLD_DOT_SIZES = Object.freeze([
  5, 5, 4.5, 4, 4.5, 4, 4.5, 4, 5, 4.5, 4.5, 7.5, 6, 5]);

/**
 * Every marker this skin may draw: the discovery law and the filter
 * buckets are the classic window's own functions, imported. `filters`
 * is the LIVE travelMapFilters() object; `isDiscovered` defaults to
 * checkLocationDiscovered and exists so node tests can drive the law
 * without the discovery store.
 *
 * Returns [{ x, z, colorIndex, summary }] - scene position on the
 * relief's own pixel centers.
 */
export function buildMarkerModel(summaries, filters, { isDiscovered = checkLocationDiscovered } = {}) {
  const out = [];
  for (const summary of summaries) {
    if (!isDiscovered(summary)) continue;
    const colorIndex = getPixelColorIndex(summary.locationType, filters);
    if (colorIndex === -1) continue;
    const { x, y } = getPixelFromPixelID(summary.id);
    out.push({ x: x + 0.5, z: -(y + 0.5), colorIndex, summary });
  }
  return out;
}

/**
 * The ONE mapping from a map pixel to a point on the relief: pixel
 * centre, the height law, the streamed world's sign convention, plus
 * a lift. Every line this map draws goes through here - the route did
 * it inline until a second layer needed the same arithmetic, and two
 * copies of a coordinate convention is how a layer ends up half a pixel
 * out from the ground it is drawn on. That second layer is gone with
 * the road system; the one mapping stays, because the reason it exists
 * is the convention, not the caller.
 *
 * Clamped rather than guarded: a path may touch the edge of the data,
 * and the edge byte is the honest answer there.
 */
/** RH1 (Mac, 2026-08-28) - the height under a point that need not sit
 *  on a pixel.
 *
 *  This used to index heightBytes with the raw coordinates, which was
 *  fine while every drawn vertex WAS a pixel: the values were integers
 *  and the clamp left them alone. The road layer's smoothing put
 *  fractional points between pixels, and a fractional array index is
 *  `undefined` - so the height came back NaN and half of every smoothed
 *  line had no height at all.
 *
 *  BILINEAR rather than a floor, because that is what the picture does.
 *  buildOverworldGrid puts one vertex per pixel at `px + 0.5`, so the
 *  drawn surface between two pixel centres is the GPU's interpolation
 *  of their heights - a line flooring to its pixel would ride above or
 *  below the very ground it is drawn on. At integer coordinates the
 *  weights are zero, so this returns exactly what the old line did.
 *
 *  The smoothing that forced it is gone with the road system and the
 *  route walks whole pixels, so nothing currently feeds it a fractional
 *  point. It stays because it is the CORRECT reading of the surface
 *  being drawn, and the next line that curves will want it rather than
 *  rediscover the NaN. */
export function sampleHeightByte(heightBytes, width, height, px, py) {
  const cx = Math.min(width - 1, Math.max(0, px));
  const cy = Math.min(height - 1, Math.max(0, py));
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0, fy = cy - y0;
  const h00 = heightBytes[y0 * width + x0], h10 = heightBytes[y0 * width + x1];
  const h01 = heightBytes[y1 * width + x0], h11 = heightBytes[y1 * width + x1];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
}

export function reliefPoint(px, py, { heightBytes, width, height }, lift = 0) {
  return [px + 0.5, overworldHeight(sampleHeightByte(heightBytes, width, height, px, py)) + lift, -(py + 0.5)];
}

/**
 * How far each line layer floats above the ground, and therefore what
 * paints over what. The ORDER is the law and the numbers are skin:
 *
 *   ground < track < trunk < route
 *
 * One layer remains - the player's own journey - and it keeps its lift
 * because the reason for a lift is the ground, not its neighbours: a
 * line at zero z-fights the surface it is drawn on.
 */
export const RELIEF_LIFT = Object.freeze({ route: 0.35 });

/**
 * The route line's points over the relief: the law's own pixel walk
 * (walkTravelPath - the start pixel is prepended here because a LINE
 * needs its anchor even though the time law never charges it), each
 * lifted a hair above its pixel's vertex so the line never z-fights
 * the ground it explains.
 */
export function routePoints(start, path, ctx) {
  const pts = new Float32Array((path.length + 1) * 3);
  const set = (i, px, py) => {
    const [x, y, z] = reliefPoint(px, py, ctx, RELIEF_LIFT.route);
    pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
  };
  set(0, start.x, start.y);
  path.forEach((p, i) => set(i + 1, p.x, p.y));
  return pts;
}

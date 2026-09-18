// TO1: THE TRAVEL MAP'S PATH AND DOT GEOMETRY - Travel Options'
// TravelOptionsMapWindow.DrawPath (:699-746), DrawLocation (:664-691)
// and DrawMapSection (:778-826), which are the three drawing routines
// its map window and its junction mini-map SHARE. Static in the mod for
// the same reason they are exported here: the mod's own junction map
// calls `travelMapWindow.DrawMapSection` (TravelOptionsMod.cs:912) to
// fill the HUD overlay, so the two pictures are one routine seen at two
// sizes.
//
// WHAT THE MOD CHANGES ABOUT THE MAP. The classic region page draws one
// texel per map pixel; with Basic Roads integrated the mod draws the
// same page FIVE TIMES bigger (`locationDotsTexture` becomes `width * 5`
// by `height * 5`, :183-184) so that a pixel has room for a path
// crossing it. Inside each 5x5 cell: the centre texel is the pixel
// itself, and each of the eight compass bits paints two texels running
// out towards that edge, so a road through a pixel reads as a line and a
// junction reads as a star. A location's dot is the 3x3 or the whole 5x5
// of the cell, by its type.
//
// THE BUFFER is the port's own packed-RGBA Uint32Array, the shape
// ui/travelMapWindow.js already fills and ui/bitmapCanvas.js already
// draws (the mod's is a Color32[]; same picture, one word a texel).
//
// A LEAF: numbers in, numbers in a buffer out. No DOM, no art, no
// world - which is what lets the pins draw a junction and read the
// texels back.

import { LOCATION_TYPES } from '../formats/mapsFile.js';   // a leaf of its own: the enum alone

/** :38-39 and :57-58 - the four path colours, the mod's own. Roads are
 *  near-black, tracks a dirt brown, rivers and streams two blues. The
 *  port's WORLD relief has its own four (ui/overworldModel.js
 *  OVERWORLD_ROAD and friends) and they are not these: this is the
 *  mod's travel map, drawn as the mod draws it. */
export const ROAD_COLOR = Object.freeze([60, 60, 60, 255]);
export const TRACK_COLOR = Object.freeze([160, 118, 74, 255]);
export const RIVER_COLOR = Object.freeze([48, 79, 250, 255]);
export const STREAM_COLOR = Object.freeze([48, 120, 230, 255]);

/** The port's packing, restated so this module imports nothing from the
 *  window it serves (ui/travelMapWindow.js:274). */
export const packRGBA = (r, g, b, a) => (((a << 24) >>> 0) | (b << 16) | (g << 8) | r) >>> 0;
export const packColor = (c) => packRGBA(c[0], c[1], c[2], c[3] ?? 255);

/** The mod's `locationDotsPixelBuffer` is five times the page in each
 *  direction (:183-184), so a page texel is a 5x5 cell. */
export const DOT_SCALE = 5;

/** TravelOptionsMapWindow.cs:699-746, DrawPath.
 *
 *  `offset` is the top-left texel of this map pixel's 5x5 cell,
 *  `width` the buffer's row stride (the page's width * 5). The buffer's
 *  rows run from the BOTTOM of the page up - the caller computes
 *  `((height - y - 1) * 5 * width5) + (x * 5)` - which is why S paints
 *  towards row 0 of the cell and N towards row 4.
 *
 *  The two texels per direction are the mod's own and are not
 *  symmetrical: the cardinals paint straight out from the centre, and
 *  each diagonal paints one texel beside the centre and one in the
 *  corner, which is what makes a diagonal read as a slope rather than
 *  a staircase. Carried texel for texel. */
export function drawPath(buf, offset, width, pathDataPt, color) {
  const data = pathDataPt & 0xff;
  if (data === 0) return;
  const px = typeof color === 'number' ? color : packColor(color);
  buf[offset + (width * 2) + 2] = px;                                  // the pixel itself
  if ((data & 8) !== 0) { buf[offset + 2] = px; buf[offset + width + 2] = px; }                       // S
  if ((data & 16) !== 0) { buf[offset + 4] = px; buf[offset + width + 3] = px; }                      // SE
  if ((data & 32) !== 0) { buf[offset + (width * 2) + 3] = px; buf[offset + (width * 2) + 4] = px; }  // E
  if ((data & 64) !== 0) { buf[offset + (width * 3) + 3] = px; buf[offset + (width * 4) + 4] = px; }  // NE
  if ((data & 128) !== 0) { buf[offset + (width * 3) + 2] = px; buf[offset + (width * 4) + 2] = px; } // N
  if ((data & 1) !== 0) { buf[offset + (width * 3) + 1] = px; buf[offset + (width * 4)] = px; }       // NW
  if ((data & 2) !== 0) { buf[offset + (width * 2)] = px; buf[offset + (width * 2) + 1] = px; }       // W
  if ((data & 4) !== 0) { buf[offset] = px; buf[offset + width + 1] = px; }                           // SW
}

/** TravelOptionsMapWindow.cs:664-691, DrawLocation.
 *
 *  A LARGE dot fills the whole 5x5 cell (st 0, en 5); a small one fills
 *  the middle 3x3 (st 1, en 4). `IsLocationLarge` (:693-696) says a city
 *  or a hamlet is always large, and every other type is large too unless
 *  the VariableSizeDots setting is on - `onlyLargeDots` is its negation
 *  (:145), so the setting's name reads backwards from its effect: ON
 *  means "vary them", which makes everything below a hamlet SMALL.
 *
 *  The HIGHLIGHT (:674-690) is the middle-click mark: a square ring in
 *  MarkLocationColor drawn two texels out from the cell, at y = -2 and
 *  y = 6 and x = -2 and x = 6. It writes OUTSIDE its own cell on purpose
 *  - that is what makes a ring around the dot - and at the buffer's
 *  edges the mod's own indices would run into the neighbouring row or
 *  off the array; the port clamps instead (`inside`), which is the one
 *  deliberate departure here and is recorded in the bible. */
export function drawLocation(buf, offset, width, color, large, { highlight = false, markColor = null } = {}) {
  const px = typeof color === 'number' ? color : packColor(color);
  const st = large ? 0 : 1;
  const en = large ? 5 : 4;
  for (let y = st; y < en; y++) {
    for (let x = st; x < en; x++) buf[offset + (y * width) + x] = px;
  }
  if (!highlight) return;
  const mark = markColor == null ? px : (typeof markColor === 'number' ? markColor : packColor(markColor));
  const inside = (i) => i >= 0 && i < buf.length;
  for (let y = -2; y < 8; y += 8) {
    for (let x = -2; x < 7; x++) { const i = offset + (y * width) + x; if (inside(i)) buf[i] = mark; }
  }
  for (let x = -2; x < 8; x += 8) {
    for (let y = -2; y < 7; y++) { const i = offset + (y * width) + x; if (inside(i)) buf[i] = mark; }
  }
}

/** :693-696, IsLocationLarge. `onlyLargeDots` is `!VariableSizeDots`
 *  (:145), so the setting ON is what makes the small dots small. */
export function isLocationLarge(locationType, onlyLargeDots) {
  return locationType === LOCATION_TYPES.TownCity || locationType === LOCATION_TYPES.TownHamlet || !!onlyLargeDots;
}

/** TravelOptionsMod.cs:172-180 - the junction mini-map is twenty map
 *  pixels square, drawn at the same five texels a pixel. */
export const JUNCTION_MAP_WIDTH = 20;
export const JUNCTION_MAP_HEIGHT = 20;
export const JUNCTION_MAP_W2 = JUNCTION_MAP_WIDTH / 2;
export const JUNCTION_MAP_H2 = JUNCTION_MAP_HEIGHT / 2;
export const JUNCTION_MAP_W5 = JUNCTION_MAP_WIDTH * DOT_SCALE;

/** :181 - where the player stands in that buffer. The mod writes it as
 *  an expression and it is kept as one: half the rows up, three rows of
 *  map pixels back down, half the columns across, plus two - which is
 *  the centre texel of the cell one map pixel BELOW the middle, because
 *  the buffer's rows run bottom-up. */
export const JUNCTION_HERE_PT = (JUNCTION_MAP_H2 * JUNCTION_MAP_WIDTH * 25) - (3 * JUNCTION_MAP_WIDTH * 5) + (JUNCTION_MAP_W2 * 5) + 2;

/** TravelOptionsMod.cs:930-952, GetDirectionIndex - the texel that
 *  carries the player's facing pip, one step from `herePt` in the
 *  facing's own direction. North is a row of map pixels UP the buffer
 *  (+ width5), east one texel right. */
export function junctionDirectionIndex(direction) {
  const here = JUNCTION_HERE_PT, w5 = JUNCTION_MAP_W5;
  switch (direction) {
    case 128: return here + w5;         // N
    case 64: return here + w5 + 1;      // NE
    case 32: return here + 1;           // E
    case 16: return here - w5 + 1;      // SE
    case 8: return here - w5;           // S
    case 4: return here - w5 - 1;       // SW
    case 2: return here - 1;            // W
    case 1: return here + w5 - 1;       // NW
    default: return 0;
  }
}

/** TravelOptionsMap:778-826, DrawMapSection - the junction mini-map's
 *  picture, and the same routine the region page uses per texel.
 *
 *  `width` and `height` are in MAP PIXELS; the buffer is `width * 5` by
 *  `height * 5`. `originX`/`originY` are the map pixel at the buffer's
 *  top-left. Off-map columns and rows are skipped, which leaves them
 *  transparent.
 *
 *  CIRCULAR (:795-796) crops to a disc when the section is square: a
 *  texel is dropped when its distance from the centre - measured
 *  half a pixel off, `|x - w/2 + 0.5|` - reaches `(height + 1.5) / 2`.
 *
 *  The order is the mod's: TRACKS first, then ROADS over them, then the
 *  location dot over both, so a road wins where a track shares the
 *  pixel and a town wins over everything. (The region page draws two
 *  more under these, streams then rivers - :621-628 - and this section
 *  draws neither, because the junction map is about where you can WALK.)
 *
 *  `deps`: { pathsAt(x, y, type) -> byte, locationAt(x, y) -> null |
 *  { locationType, mapId, discovered }, colorOf(locationType) -> packed
 *  colour or null, onlyLargeDots, markedMapId, markColor, showPaths }. */
export function drawMapSection(buf, { originX, originY, width, height, circular = false, mapWidth = 1000, mapHeight = 500 }, deps) {
  const {
    pathsAt, locationAt, colorOf, onlyLargeDots = false, markedMapId = -1, markColor = null,
    showPaths = [true, true, false, false],
  } = deps;
  buf.fill(0);
  const width5 = width * DOT_SCALE;
  const trackPx = packColor(TRACK_COLOR), roadPx = packColor(ROAD_COLOR);
  for (let y = 0; y < height; y++) {
    const mpY = originY + y;
    if (mpY < 0 || mpY >= mapHeight) continue;
    for (let x = 0; x < width; x++) {
      const mpX = originX + x;
      if (mpX < 0 || mpX >= mapWidth) continue;
      if (circular && height === width
        && Math.sqrt(Math.abs(x - Math.trunc(width / 2) + 0.5) ** 2 + Math.abs(y - Math.trunc(height / 2) + 0.5) ** 2) >= (height + 1.5) / 2) continue;
      const offset = ((height - y - 1) * width) + x;
      if (offset >= width * height) continue;
      const offset5 = ((height - y - 1) * DOT_SCALE * width5) + (x * DOT_SCALE);
      if (showPaths[1]) drawPath(buf, offset5, width5, pathsAt(mpX, mpY, 1), trackPx);
      if (showPaths[0]) drawPath(buf, offset5, width5, pathsAt(mpX, mpY, 0), roadPx);
      const loc = locationAt?.(mpX, mpY);
      if (loc && loc.discovered) {
        const color = colorOf(loc.locationType);
        if (color != null) {
          drawLocation(buf, offset5, width5, color, isLocationLarge(loc.locationType, onlyLargeDots),
            { highlight: loc.mapId === markedMapId, markColor });
        }
      }
    }
  }
  return buf;
}

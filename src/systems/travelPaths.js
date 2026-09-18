// TO1: THE PATH GEOMETRY of Travel Options 1.11 (Hazelnut, MIT) -
// TravelOptionsMod.cs's compass, its map-pixel bands and its direction
// arithmetic, extracted whole because three callers need it and none of
// them should own it: the mod's own follow/circumnavigate machine
// (systems/travelOptions.js), the junction mini-map
// (ui/travelJunctionMap.js) and the travel map's path overlay
// (ui/travelPathsOverlay.js).
//
// A LEAF: no DOM, no renderer, no world. Every function here takes
// numbers and returns numbers, which is what lets the pins drive the
// whole follow machine on a table of yaws and world positions.
//
// THE COMPASS is Basic Roads' own, copied into the mod at
// TravelOptionsMod.cs:76-83 with the comment "Path type and direction
// constants copied from BasicRoadsTexturing" - one byte per map pixel,
// a bit per edge the path leaves through. The port's own roads lane
// reads the same bytes out of the same four vendored arrays
// (world/roadsProducer.js MOD_ROADS, vendor/roads-hazelnut/), so the
// mod's data and the port's are one thing and this compass is shared:
// world/roadNetwork.js DIR carries the identical eight values, and
// `sameCompass` below is the pin that says so out loud.

import { DIR as NETWORK_DIR, MAP_W, MAP_H } from '../world/roadNetwork.js';

/** TravelOptionsMod.cs:73-75 - the four path arrays, in the mod's own
 *  index order (and Basic Roads' own: it answers `getPathData` by it). */
export const PATH_ROADS = 0;
export const PATH_TRACKS = 1;
export const PATH_RIVERS = 2;
export const PATH_STREAMS = 3;
/** The vendored arrays' keys in the port's road bundle, by that index. */
export const PATH_KEYS = Object.freeze(['roads', 'tracks', 'rivers', 'streams']);

/** TravelOptionsMod.cs:77-84. The compass mask, one bit an edge. */
export const N = 128;
export const NE = 64;
export const E = 32;
export const SE = 16;
export const S = 8;
export const SW = 4;
export const W = 2;
export const NW = 1;

/** The eight in the order the mod's own switches walk them (:821-843). */
export const DIRECTIONS = Object.freeze([N, NE, E, SE, S, SW, W, NW]);

/** The port's own road network uses the same eight values. Kept as a
 *  function rather than an assert so the pin can state it and no
 *  module pays for it at import. */
export function sameCompass() {
  return NETWORK_DIR.N === N && NETWORK_DIR.NE === NE && NETWORK_DIR.E === E && NETWORK_DIR.SE === SE
    && NETWORK_DIR.S === S && NETWORK_DIR.SW === SW && NETWORK_DIR.W === W && NETWORK_DIR.NW === NW;
}

/** TravelOptionsMod.cs:86-92 - the map pixel's world units and the
 *  bands inside it. MPworldUnits is MapsFile.WorldMapTerrainDim (the
 *  port's streamingWorld NATIVE_PIXEL); TSize is a terrain TILE
 *  (WorldMapTileDim 128 of them across a pixel, world/terrainTiles.js),
 *  and a path is two tiles wide. */
export const MP_WORLD_UNITS = 32768;
export const HALF_MP_WORLD_UNITS = MP_WORLD_UNITS / 2;      // 16384
export const T_SIZE = MP_WORLD_UNITS / 128;                 // 256 - one terrain tile
export const P_SIZE = T_SIZE * 2;                           // 512 - a path's width
export const MID_LO = HALF_MP_WORLD_UNITS - T_SIZE;         // 16128
export const MID_HI = HALF_MP_WORLD_UNITS + T_SIZE;         // 16640
/** :93 - half of 45, the half-width of a compass point. */
export const ANG_UNIT = 22.5;

/** TravelOptionsMod.cs:95-97 - the LocationPause setting's three modes. */
export const LOC_PAUSE_OFF = 0;
export const LOC_PAUSE_NEAR = 1;
export const LOC_PAUSE_ENTER = 2;

/** :34 - the circumnavigation speed ceiling. */
export const MAX_CIRCUMNAVIGATION_ACCEL = 15;

/** MapsFile.MapPixelToWorldCoord, as the mod calls it (:583, :606,
 *  :704): the pixel's SOUTH-WEST corner in world units. The port's
 *  streamingWorld.mapPixelToWorldCoords is the same mapping with the
 *  same 499 - it is restated here rather than imported so this module
 *  stays a leaf (world/streamingWorld.js reaches the renderer). The
 *  pin asserts the two agree over the whole map. */
export function mapPixelWorldOrigin(mapPixelX, mapPixelY) {
  return { x: mapPixelX * MP_WORLD_UNITS, z: (MAP_H - 1 - mapPixelY) * MP_WORLD_UNITS };
}

/** TravelOptionsMod.cs:427-434, GetNormalisedPlayerYaw. Degrees,
 *  clockwise from north, in [0, 360); `invert` answers the direction
 *  the player came FROM. The port's camera yaw is radians with 0 at
 *  +z (north) and the same clockwise sense (ui/hud.js:131-141), so the
 *  caller converts once and this takes degrees. */
export function normalisedYaw(yawDegrees, invert = false) {
  let yaw = (yawDegrees + (invert ? 180 : 0)) % 360;
  if (yaw < 0) yaw += 360;
  return yaw;
}

/** TravelOptionsMod.cs:436-455, GetDirection. THE BOUNDARIES ARE THE
 *  MOD'S, INCLUSIVE AND EXCLUSIVE AS IT WROTE THEM: the four cardinals
 *  test `>=` and `<=` (so 22.5 exactly is N, and 67.5 exactly is E),
 *  the four diagonals test `>` and `<` (so 22.5 is NOT NE). A yaw that
 *  matches nothing - which this arrangement never produces, every
 *  degree falling in some band - answers 0, and a 0 direction is
 *  "none" everywhere downstream. */
export function directionOfYaw(yaw) {
  if ((yaw >= 360 - ANG_UNIT && yaw <= 360) || (yaw >= 0 && yaw <= ANG_UNIT)) return N;
  if (yaw >= 90 - ANG_UNIT && yaw <= 90 + ANG_UNIT) return E;
  if (yaw >= 180 - ANG_UNIT && yaw <= 180 + ANG_UNIT) return S;
  if (yaw >= 270 - ANG_UNIT && yaw <= 270 + ANG_UNIT) return W;
  if (yaw > 45 - ANG_UNIT && yaw < 45 + ANG_UNIT) return NE;
  if (yaw > 135 - ANG_UNIT && yaw < 135 + ANG_UNIT) return SE;
  if (yaw > 225 - ANG_UNIT && yaw < 225 + ANG_UNIT) return SW;
  if (yaw > 315 - ANG_UNIT && yaw < 315 + ANG_UNIT) return NW;
  return 0;
}

/** TravelOptionsMod.cs:820-844, GetTargetPixel. North is -y on the map
 *  (map y counts south), which is why N takes one off and S adds one.
 *  A direction of 0 - or any value that is not one of the eight -
 *  answers the pixel itself, which is the mod's `default` arm and is
 *  how BeginPathTravel's "carry on into this pixel" case is spelled
 *  (:270, GetTargetPixel(0, currMapPixel)). */
export function targetPixel(direction, mapPixelX, mapPixelY) {
  switch (direction) {
    case N: return { x: mapPixelX, y: mapPixelY - 1 };
    case NE: return { x: mapPixelX + 1, y: mapPixelY - 1 };
    case E: return { x: mapPixelX + 1, y: mapPixelY };
    case SE: return { x: mapPixelX + 1, y: mapPixelY + 1 };
    case S: return { x: mapPixelX, y: mapPixelY + 1 };
    case SW: return { x: mapPixelX - 1, y: mapPixelY + 1 };
    case W: return { x: mapPixelX - 1, y: mapPixelY };
    case NW: return { x: mapPixelX - 1, y: mapPixelY - 1 };
    default: return { x: mapPixelX, y: mapPixelY };
  }
}

/** TravelOptionsMod.cs:876-885, CountSetBits. */
export function countSetBits(n) {
  let count = 0;
  let v = n & 0xff;
  while (v > 0) { count += v & 1; v >>= 1; }
  return count;
}

/** TravelOptionsMod.cs:577-604, IsPlayerOnPath. Which of the edges
 *  leaving this pixel the player is actually STANDING on, as a mask.
 *
 *  The four cardinals ask for the player inside the 512-unit band
 *  across the pixel's middle (MID_LO..MID_HI) and past its midpoint on
 *  the other axis; the four diagonals ask for the player within a path
 *  width of the pixel's diagonal - `|x - z|` for the NE/SW diagonal and
 *  `|x - (32768 - z)|` for the NW/SE one - and on the correct side.
 *  ALL of it in pixel-local world units, `posInMp`, which is the
 *  player's world position less the pixel's corner.
 *
 *  Note the mod's own asymmetry, carried: N tests `posInMp.Y > MidLo`
 *  and S tests `< MidHi` (never the far edge), so a player in the
 *  middle band is on BOTH, which is exactly what makes "the path I am
 *  standing on" answer two bits at a crossing.
 *
 *  `posInMpZ` is the C#'s `posInMp.Y`: the port's world +z is DFU's
 *  world +y here (streamingWorld.js keeps the same axis names). */
export function playerOnPath(pathsDataPt, posInMpX, posInMpZ) {
  const data = pathsDataPt & 0xff;
  if (data === 0) return 0;
  let onPath = 0;
  if ((data & N) !== 0 && posInMpX > MID_LO && posInMpX < MID_HI && posInMpZ > MID_LO) onPath |= N;
  if ((data & E) !== 0 && posInMpZ > MID_LO && posInMpZ < MID_HI && posInMpX > MID_LO) onPath |= E;
  if ((data & S) !== 0 && posInMpX > MID_LO && posInMpX < MID_HI && posInMpZ < MID_HI) onPath |= S;
  if ((data & W) !== 0 && posInMpZ > MID_LO && posInMpZ < MID_HI && posInMpX < MID_HI) onPath |= W;
  if ((data & NE) !== 0 && Math.abs(posInMpX - posInMpZ) < P_SIZE && posInMpX > MID_LO) onPath |= NE;
  if ((data & SW) !== 0 && Math.abs(posInMpX - posInMpZ) < P_SIZE && posInMpX < MID_HI) onPath |= SW;
  if ((data & NW) !== 0 && Math.abs(posInMpX - (MP_WORLD_UNITS - posInMpZ)) < P_SIZE && posInMpX < MID_HI) onPath |= NW;
  if ((data & SE) !== 0 && Math.abs(posInMpX - (MP_WORLD_UNITS - posInMpZ)) < P_SIZE && posInMpX > MID_LO) onPath |= SE;
  return onPath;
}

/** The same, from a WORLD position and the map pixel it stands in -
 *  the shape the mod's caller has (:579-581). */
export function playerOnPathAt(pathsDataPt, worldX, worldZ, mapPixelX, mapPixelY) {
  const origin = mapPixelWorldOrigin(mapPixelX, mapPixelY);
  return playerOnPath(pathsDataPt, worldX - origin.x, worldZ - origin.z);
}

/** TravelOptionsMod.cs:808-814, GetPathsDataPoint: roads OR tracks, one
 *  byte. `net` is the port's road bundle - the four Uint8Arrays of
 *  world/roadsProducer.js loadModRoads, or the generated fallback,
 *  which carries the same compass. A pixel off the map answers 0. */
export function pathsDataPoint(net, mapPixelX, mapPixelY) {
  return (dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY) | dataPoint(net, PATH_TRACKS, mapPixelX, mapPixelY)) & 0xff;
}

/** :815-819, GetRoadsDataPoint - roads alone, which is what decides
 *  whether a followed path is a ROAD (reckless speed, "Following a
 *  road.") or a dirt TRACK (cautious speed). */
export function roadsDataPoint(net, mapPixelX, mapPixelY) {
  return dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY);
}

/** One array's byte at a pixel, bounds-checked. The mod indexes
 *  `currMapPixel.X + (currMapPixel.Y * MapsFile.MaxMapPixelX)` with no
 *  check at all (:810) - off the map it would read another row or
 *  throw; the port answers 0, which every caller already treats as
 *  "no path here". */
export function dataPoint(net, pathType, mapPixelX, mapPixelY) {
  if (!net) return 0;
  if (mapPixelX < 0 || mapPixelY < 0 || mapPixelX >= MAP_W || mapPixelY >= MAP_H) return 0;
  const arr = net[PATH_KEYS[pathType]];
  if (!arr) return 0;
  return arr[mapPixelX + (mapPixelY * MAP_W)] & 0xff;
}

/** TravelOptionsMod.cs:1025-1050, SelectNextPath's junction arm. At a
 *  pixel with exactly two edges the mod carries straight on: keep the
 *  edge the player is already facing, and when the facing matches
 *  neither, take the OTHER edge - `pathsDataPt ^ fromDirection` - and,
 *  where that leaves more than one bit (the from-direction was not one
 *  of the two), walk the from-direction around the compass until it is.
 *
 *  The walk is the mod's own, quirks included: the shift is by the
 *  SEARCH COUNTER rather than by one (`fromDirection >> sc`), so it
 *  skips, and the wrap is to 128 going clockwise and 1 going anti-,
 *  and `clockwise` flips every step because it is `sc % 2 == 0`. Nine
 *  tries, then whatever it holds. It is "should work 99% of the time"
 *  in the mod's own comment (:1036) and it is carried as written: a
 *  cleverer search would take a different turn at some junction
 *  somewhere, and that is the mod's turn to take.
 *
 *  Returns the mask the mod would hold at :1053, RAW - not narrowed to
 *  a single bit when the search gave up. That matters: the mod uses it
 *  TWICE, once for `road = (roadDataPt & playerDirection) != 0` and
 *  once for GetTargetPixel, and a two-bit leftover can still say "this
 *  is a road" while GetTargetPixel's `default` arm holds the pixel. */
export function nextPathDirection(pathsDataPt, playerDirection, fromDirection) {
  const data = pathsDataPt & 0xff;
  let dir = data & playerDirection;
  if (dir !== 0) return dir;
  let from = fromDirection & 0xff;
  let sc = 1;
  let clockwise = sc % 2 === 0;
  dir = (data ^ from) & 0xff;
  while (countSetBits(dir) !== 1 && sc < 9) {
    from = (clockwise ? from >> sc : from << sc) & 0xff;
    if (from === 0) from = clockwise ? 128 : 1;
    sc++;
    clockwise = sc % 2 === 0;
    dir = (data ^ from) & 0xff;
  }
  return dir;
}

// THE LOCATION ENTRANCE - StreamingWorld's RepositionMethods
// .RandomStartMarker / .DirectionFromStartMarker arm, ported as a law
// rather than left to the hosts' own guesswork.
//
// StreamingWorld.cs:1437-1593. PositionPlayerToLocation() finds the
// location standing on the current map pixel, builds its terrain-tile
// origin, and hands the private overload the location's block
// dimensions plus two booleans read off the LocationType:
//     useNearestStartMarker = TownCity || HomeYourShips   (:1462-1463)
//     grounded              = LocationType != HomeYourShips (:1464)
// The overload picks ONE SIDE of the location's rectangle at random,
// stands the player just outside it facing in, and - when start
// markers are asked for and the location has any - moves to the
// marker nearest that outside point instead (:1568-1588).
//
// FIVE callers reach the arm in DFU, and they are not one caller:
// TransportManager.cs:378/:397 (the ship's boarding),
// DaggerfallCourtWindow.cs:460 (the release after a sentence, a
// banishment or an acquittal), DaggerfallTeleportPopUp.cs:143 (the
// guild's Teleportation service), PlayerEnterExit.cs:516 (the
// respawner's exterior arm) and DaggerfallTravelPopUp.cs:334 (the
// fast-travel arrival). Four pass RandomStartMarker; fast travel
// alone passes DirectionFromStartMarker. This module is the pure
// half; the host supplies the pixel, the origin and the markers.
//
// AUDIT 64 F18: the travelStartX/travelStartZ FACING HINT
// (:1481-1521) IS ported now, and it is the only thing that separates
// the two methods - Update() runs the SAME PositionPlayerToLocation()
// for both (:279-282). TeleportToMapPixel caches the pair from
// LocalPlayerGPS before it moves the GPS to the destination, and only
// for DirectionFromStartMarker (:1076-1083); every other caller
// arrives with `travelStartX == null` and takes the plain
// `Random.Range(0, 4)`. The hint weights the four sides by how far the
// journey ran E-W against N-S, so a trip that began far to the west
// arrives on the destination's WEST side, facing in.

import { RMB_SIDE } from './locationLayout.js';

/** RMBLayout.cs:34-35 - RMBSide is the block, RMBTileSide the ground
 *  tile. RMB_SIDE already carries 4096 * GlobalScale. */
export const RMB_TILE_SIDE = RMB_SIDE / 16;

/** "Extra distance places player a little bit outside location area"
 *  (:1528-1530): RMBLayout.RMBSide * 0.1f. */
export const EXTRA_DISTANCE = RMB_SIDE * 0.1;

/** The editor flat that IS a start marker: archive 199, record 10
 *  (MaterialReader.GetEditorFlatType, :994-1005 - record 8 is Enter,
 *  record 10 is Start). DaggerfallLocation.EnumerateStartMarkers
 *  (:289-301) is exactly this filter over the location's billboards. */
import { EDITOR_FLATS_ARCHIVE } from './rmbFlats.js';
export { EDITOR_FLATS_ARCHIVE };   // ONE home for archive 199 (rmbFlats), re-exported for the a3 pins
export const START_MARKER_RECORD = 10;

/** The four sides in Random.Range(0, 4) order, with the facing DFU's
 *  SetFacing gives each (:1537-1564). Unity yaw 0 looks down +Z, which
 *  is the port's own `fwd = [sin(yaw), 0, cos(yaw)]`, so the degrees
 *  convert straight across. Each side faces BACK INTO the location. */
export const LOCATION_SIDES = Object.freeze([
  Object.freeze({ name: 'north', dx: 0, dz: 1, facing: 180 }),
  Object.freeze({ name: 'south', dx: 0, dz: -1, facing: 0 }),
  Object.freeze({ name: 'east', dx: 1, dz: 0, facing: 270 }),
  Object.freeze({ name: 'west', dx: -1, dz: 0, facing: 90 }),
]);

/**
 * DaggerfallLocation.EnumerateStartMarkers (:289-301) over the port's
 * own flat records: every archive-199 record-10 billboard in the
 * location's blocks, in LOCATION-LOCAL coordinates.
 *
 * @param {Array<{originX:number,originZ:number,flats:Array<{archive:number,record:number,x:number,y:number,z:number}>}>} blocks
 * @returns {Array<[number,number,number]>}
 */
export function locationStartMarkers(blocks) {
  const out = [];
  for (const b of blocks ?? []) {
    for (const f of b.flats ?? []) {
      if (f.archive !== EDITOR_FLATS_ARCHIVE || f.record !== START_MARKER_RECORD) continue;
      out.push([f.x + (b.originX ?? 0), f.y ?? 0, f.z + (b.originZ ?? 0)]);
    }
  }
  return out;
}

/**
 * THE SIDE PICK (StreamingWorld.cs:1481-1521), the whole of what
 * separates RepositionMethods.DirectionFromStartMarker from
 * .RandomStartMarker - Update() runs the same PositionPlayerToLocation()
 * for both (:279-282).
 *
 * `travelStart` is the travelStartX/travelStartZ pair, which
 * TeleportToMapPixel caches off LocalPlayerGPS - the player's world
 * coordinates as they LEFT - and only for DirectionFromStartMarker
 * (:1076-1083). `worldPos` is LocalPlayerGPS.WorldX/WorldZ as they read
 * by the time this runs, which the same method has already moved to the
 * DESTINATION pixel (:1084-1086). Either missing is DFU's
 * `travelStartX == null || travelStartZ == null` (:1483) and takes the
 * plain Random.Range(0, 4).
 *
 * The weighting is DFU's own comment (:1500-1501): "if travel start is
 * distant enough, chances of hitting square sides are approximatively
 * px/(px+pz) and pz/(px+pz)".
 *
 * @returns {number} an index into LOCATION_SIDES - DFU's own 0 North,
 *   1 South, 2 East, 3 West.
 */
export function pickLocationSide({ travelStart = null, worldPos = null, roll = Math.random } = {}) {
  /** Random.Range(int, int) - the INT overload, [0, n). */
  const rnd = (n) => Math.min(n - 1, Math.floor(roll() * n));
  if (travelStart?.x == null || travelStart?.z == null || worldPos?.x == null || worldPos?.z == null) {
    return rnd(4);   // :1483-1487 - "Randomly pick one side of location to spawn"
  }
  // :1491-1492 - PlayerGPS's WorldX/WorldZ are ints
  const worldDeltaX = Math.trunc(worldPos.x) - Math.trunc(travelStart.x);
  const worldDeltaZ = Math.trunc(worldPos.z) - Math.trunc(travelStart.z);
  if (worldDeltaX === 0 && worldDeltaZ === 0) return rnd(4);   // :1494-1495
  const px = Math.abs(worldDeltaX);
  const pz = Math.abs(worldDeltaZ);
  const random = rnd(px + pz);   // :1502
  if (px > pz) {
    // :1503-1510 - mainly E-W; do we hit the square's front side?
    if (random < px) return worldDeltaX > 0 ? 3 : 2;
    return worldDeltaZ > 0 ? 1 : 0;
  }
  // :1511-1518 - mainly N-S
  if (random < pz) return worldDeltaZ > 0 ? 1 : 0;
  return worldDeltaX > 0 ? 3 : 2;
}

/**
 * PositionPlayerToLocation (StreamingWorld.cs:1470-1593), verbatim
 * apart from the travel facing hint noted in the header.
 *
 * @param {object} opts
 * @param {number} opts.mapWidth   location block width  (Summary.BlockWidth)
 * @param {number} opts.mapHeight  location block height (Summary.BlockHeight)
 * @param {[number,number,number]} [opts.origin] the location origin -
 *   GetLocationTerrainTileOrigin * RMBTileSide, y = 2 * GlobalScale
 *   (:1452-1453). Defaults to the zero corner, which is the frame the
 *   markers below are already in.
 * @param {Array<[number,number,number]>} [opts.startMarkers] location-local
 * @param {boolean} [opts.useNearestStartMarker] TownCity || HomeYourShips
 * @param {{x:number,z:number}} [opts.travelStart] travelStartX/travelStartZ -
 *   the DirectionFromStartMarker facing hint (:1076-1083)
 * @param {{x:number,z:number}} [opts.worldPos] LocalPlayerGPS.WorldX/WorldZ,
 *   already moved to the destination pixel (:1084-1086)
 * @param {Function} [opts.roll] UnityEngine.Random.Range's stream
 * @returns {{pos:[number,number,number], yaw:number, side:string, usedStartMarker:boolean}}
 *   `yaw` is RADIANS, the port's own camera unit.
 */
export function positionPlayerToLocation({
  mapWidth, mapHeight,
  origin = [0, 0, 0],
  startMarkers = [],
  useNearestStartMarker = false,
  travelStart = null,
  worldPos = null,
  roll = Math.random,
} = {}) {
  // :1481-1521
  const side = LOCATION_SIDES[pickLocationSide({ travelStart, worldPos, roll })];

  // :1521-1526
  const halfWidth = mapWidth * 0.5 * RMB_SIDE;
  const halfHeight = mapHeight * 0.5 * RMB_SIDE;
  const centre = [origin[0] + halfWidth, origin[1], origin[2] + halfHeight];

  // :1532-1565 - the player stands EXTRA_DISTANCE outside the chosen
  // edge, on that edge's own half-extent.
  const out = [
    centre[0] + side.dx * (halfWidth + EXTRA_DISTANCE),
    centre[1],
    centre[2] + side.dz * (halfHeight + EXTRA_DISTANCE),
  ];
  const yaw = (side.facing * Math.PI) / 180;

  // :1568-1588 - "Adjust to nearest start marker if requested". The
  // distance is measured from the OUTSIDE point just computed, in
  // three dimensions (Vector3.Distance), and a location with no
  // markers keeps the outside point.
  if (useNearestStartMarker && startMarkers.length) {
    let best = null, bestDist = Infinity;
    for (const m of startMarkers) {
      const world = [m[0] + origin[0], m[1] + origin[1], m[2] + origin[2]];
      const d = Math.hypot(world[0] - out[0], world[1] - out[1], world[2] - out[2]);
      if (d < bestDist) { bestDist = d; best = world; }
    }
    if (best) return { pos: [best[0], best[1], best[2]], yaw, side: side.name, usedStartMarker: true };
  }
  return { pos: out, yaw, side: side.name, usedStartMarker: false };
}

/** DFRegion.LocationTypes, the two rows :1462-1464 reads
 *  (DFRegion.cs:69, :97). */
export const LOCATION_TYPE_TOWN_CITY = 0;
export const LOCATION_TYPE_HOME_YOUR_SHIPS = 14;

/** The two booleans PositionPlayerToLocation() derives from the
 *  location type before calling the overload (:1462-1464). */
export function entranceOptionsForLocationType(locationType) {
  return {
    useNearestStartMarker: locationType === LOCATION_TYPE_TOWN_CITY
      || locationType === LOCATION_TYPE_HOME_YOUR_SHIPS,
    grounded: locationType !== LOCATION_TYPE_HOME_YOUR_SHIPS,
  };
}

/**
 * PositionPlayerToLocation's OUTER overload (StreamingWorld.cs:1437-1467) -
 * the arm Update() runs for RepositionMethods.RandomStartMarker AND
 * .DirectionFromStartMarker alike (:279-282), once the terrain update has
 * finished (:274-295). It reads the DFLocation that stands on the pixel,
 * derives the two booleans off its LocationType and hands the private
 * overload the location's block dimensions.
 *
 * GetPlayerLocationObject answering null is DFU's "No location found,
 * fail back to terrain origin" (:1441-1446); this reports it as `null`
 * and leaves the fallback to the host, which owns the terrain origin.
 *
 * THE SHIP TAKES THIS ARM LIKE ANY OTHER LOCATION. Map pixels (2,2) and
 * (5,5) carry region 31 ("High Rock sea coast") locations 1 and 2, both
 * named "Your Ship", both LocationTypes.HomeYourShips (14), both 1x1
 * with a single SHIPAA00/SHIPAA01 block - so the two booleans come out
 * useNearestStartMarker TRUE and grounded FALSE, and the boarding lands
 * on the deck rather than at a terrain origin.
 *
 * @param {object} dfLocation MapsFile.getLocation output
 * @param {object} [opts] origin / startMarkers / travelStart / worldPos /
 *   roll, as positionPlayerToLocation takes them
 * @returns {{pos:[number,number,number], yaw:number, side:string,
 *            usedStartMarker:boolean, grounded:boolean}|null}
 */
export function locationArrivalLanding(dfLocation, { origin, startMarkers = [], travelStart = null, worldPos = null, roll } = {}) {
  const ext = dfLocation?.exterior?.exteriorData;
  if (!ext) return null;   // :1441-1446 - no location object, no landing
  const opts = entranceOptionsForLocationType(dfLocation.mapTableData?.locationType ?? 0);
  const at = positionPlayerToLocation({
    mapWidth: ext.width,
    mapHeight: ext.height,
    origin,
    startMarkers,
    useNearestStartMarker: opts.useNearestStartMarker,
    travelStart,
    worldPos,
    ...(roll ? { roll } : {}),
  });
  return { ...at, grounded: opts.grounded };
}

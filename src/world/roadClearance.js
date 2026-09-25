// ROADS-CLEAR (2026-09-25, Mac: "Camps, mountains from WOD, shouldnt be placed on roads") - is a footprint
// clear of the painted road network?
//
// Basic Roads (and the port's own generated network, which carries the same compass) draws every path in a
// map pixel as a straight band from the pixel's CENTRE out to the edge or corner its compass bit names
// (systems/travelPaths.js: N is +z, E is +x, the diagonals run corner to corner), P_SIZE wide. So a footprint
// is on a road exactly when its box comes within half a path width of one of those segments - in its own
// pixel or in any pixel the box reaches into. That last part is the whole reason this exists: World of
// Daggerfall's mountain layouts spread their pieces up to ~1.9 km from the site and its large rock fields
// ~500 m, so 41,349 of the 114,087 sites the shipped lists stand reach outside their own pixel - which the
// mod's own test (LocationLoader.cs:146-151: no site on a pixel with a road or track) never looks at.
//
// Everything here is in the native world units the network is drawn in (32768 to a map pixel) and
// PIXEL-LOCAL to the pixel the caller names: x east, z north, (0, 0) its south-west corner - the frame
// travelPaths.js mapPixelWorldOrigin and the scene's per-pixel translation share. A leaf apart from
// travelPaths.js, so a pin can drive it on a table.

import { pathsDataPoint, MP_WORLD_UNITS, HALF_MP_WORLD_UNITS, P_SIZE, N, NE, E, SE, S, SW, W, NW } from '../systems/travelPaths.js';

/** Half a path's painted width - the band either side of a segment's centre line. */
export const PATH_HALF_WIDTH = P_SIZE / 2;
/** Scene metres to native units (819.2 m to a pixel). */
export const UNITS_PER_METRE = MP_WORLD_UNITS / 819.2;

/** A WoD piece stands at least this far (native units: 2 m) past a road's band - its mesh box already is its size. */
export const WOD_PIECE_ROAD_CLEAR = 2 * UNITS_PER_METRE;
/** A camp's clearance past a road's band, metres: its anchor adds the group's spacing, a member takes it alone. */
export const CAMP_ROAD_CLEAR_M = 4;

// each compass bit's segment end, as a step from the centre in half-pixels (x east, z north)
const SEGMENT_ENDS = Object.freeze([[N, 0, 1], [NE, 1, 1], [E, 1, 0], [SE, 1, -1], [S, 0, -1], [SW, -1, -1], [W, -1, 0], [NW, -1, 1]]);

/** Does the segment (ax,az)-(bx,bz) cross the rectangle [x0,x1] x [z0,z1]? Liang-Barsky clipping. */
export function segmentHitsRect(ax, az, bx, bz, x0, z0, x1, z1) {
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  // one clip plane: p the segment's rate across it, q the start's distance inside it
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az);
}

/**
 * Is the box [x0,x1] x [z0,z1] - pixel-local to (px, py), native units, free to reach past the pixel's edges -
 * within `clearance` of a road or track? Every pixel the grown box overlaps is asked for its compass byte
 * (pathsDataPoint: roads | tracks), and each of its segments is tested against the box grown by half a path
 * width plus the clearance (a square grow: conservative at the corners, never short).
 * @param {object} net terrainGen.roads() - null answers false (nothing is drawn yet)
 */
export function boxNearPath(net, px, py, x0, z0, x1, z1, clearance = 0) {
  if (!net) return false;
  const g = PATH_HALF_WIDTH + clearance;
  const gx0 = x0 - g, gz0 = z0 - g, gx1 = x1 + g, gz1 = z1 + g;
  const ix0 = Math.floor(gx0 / MP_WORLD_UNITS), ix1 = Math.floor(gx1 / MP_WORLD_UNITS);
  const iz0 = Math.floor(gz0 / MP_WORLD_UNITS), iz1 = Math.floor(gz1 / MP_WORLD_UNITS);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const bits = pathsDataPoint(net, px + ix, py - iz);   // north (+z) is the row above: py - 1
      if (!bits) continue;
      const ox = ix * MP_WORLD_UNITS, oz = iz * MP_WORLD_UNITS;   // that pixel's corner in this pixel's frame
      const cx = ox + HALF_MP_WORLD_UNITS, cz = oz + HALF_MP_WORLD_UNITS;
      for (const [bit, sx, sz] of SEGMENT_ENDS) {
        if ((bits & bit) && segmentHitsRect(cx, cz, cx + sx * HALF_MP_WORLD_UNITS, cz + sz * HALF_MP_WORLD_UNITS, gx0, gz0, gx1, gz1)) return true;
      }
    }
  }
  return false;
}

/** A point with a radius, pixel-local: boxNearPath over its square. */
export const pointNearPath = (net, px, py, x, z, radius = 0) => boxNearPath(net, px, py, x, z, x, z, radius);

/** World of Daggerfall's layouts that are TERRAIN - rock fields and mountains - filter piece by piece; every other
 *  site (camps, forts, shrines, ruins, the cave, the nature spots) is one place and goes whole or not at all. */
export const wodPiecewise = (prefabName) => /^WOD_(?:Rocks_(?!Cave)|Mountain_)/.test(String(prefabName ?? ''));

/** A WoD site's own objects stand within this of their position (a tent, a fire, a wagon) - the site test's margin. */
export const WOD_SITE_OBJECT_RADIUS_M = 8;

/**
 * Is a World of Daggerfall site (a pick: its prefab and its rect in terrain tiles) clear of the roads? Only the
 * whole-site kinds are asked (wodPiecewise answers the others piece by piece, with their meshes, at placement).
 * The objects' positions are the placement's own (wodLocationLoader.js placeObjects: tile * 6.4 m + the object's
 * offset, x east and z north), each grown by the site margin.
 */
export function wodSiteClear(net, px, py, prefabName, prefab, rect, tileMetres = 6.4) {
  if (!net || wodPiecewise(prefabName)) return true;
  const r = WOD_SITE_OBJECT_RADIUS_M * UNITS_PER_METRE;
  for (const o of prefab?.obj ?? []) {
    const x = (rect.x * tileMetres + o.pos.x) * UNITS_PER_METRE;
    const z = (rect.y * tileMetres + o.pos.z) * UNITS_PER_METRE;
    if (pointNearPath(net, px, py, x, z, r)) return false;
  }
  return true;
}

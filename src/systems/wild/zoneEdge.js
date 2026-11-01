// @ts-check
// PVP-EDGE (the PvP rework, 2026-10-29 - ): my word that I stood in the zone again by WALKING over its edge - the
// last frame outside within ZONE_EDGE.ms and ZONE_EDGE.m of my first inside. A teleport, a carriage, a town's streets left
// or a rise is no walk. The referee grants an entry's safe passage on this word alone (net/wild/wildRef.js wildZone).
// `here` is the zone's pixel alone (AUDIT TAMRIEL-WIDE III P2): a building or a dungeon in it is in it, so its door is no edge.
// Pure but for its clock and its one page's memory. A departure: DFU has no PvP.

/** How close and how soon the last step outside must be, and how long the walk stays said after it. */
export const ZONE_EDGE = Object.freeze({ m: 60, ms: 5_000, keepMs: 15_000 });

let out = null,
  inside = false,
  walkedAt = -Infinity;

/** Each frame: `here` whether I stand in the zone, `pos` my place (metres, [x, y, z]), `now` ms. Answers whether my latest
 *  step in was a walk over the edge, said for ZONE_EDGE.keepMs. */
export function zoneEdgeSee(here, pos, now) {
  const x = Number(pos?.[0]) || 0,
    z = Number(pos?.[2]) || 0;
  if (!here) {
    out = { x, z, at: now };
    inside = false;
    walkedAt = -Infinity;
    return false;
  } // outside, the last walk is spent
  if (!inside && out && now - out.at <= ZONE_EDGE.ms && Math.hypot(x - out.x, z - out.z) <= ZONE_EDGE.m) walkedAt = now;
  inside = true;
  return now - walkedAt <= ZONE_EDGE.keepMs;
}

/** Tests: forget. */
export function resetZoneEdge() {
  out = null;
  inside = false;
  walkedAt = -Infinity;
}

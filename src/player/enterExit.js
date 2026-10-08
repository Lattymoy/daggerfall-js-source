// Building enter/exit spawn math, 1:1 with Daggerfall Unity's
// PlayerEnterExit / DaggerfallStaticDoors (MIT, Daggerfall Workshop):
//   - Entering: checkPosition = the activated exterior door's world
//     position, snapped to the closest interior ENTER marker when one
//     exists; the landing is the closest INTERIOR static door to that
//     point, pushed along the door normal by (playerRadius + 0.4) =
//     0.75; the marker fallback lands at marker + up * (height * 0.6).
//   - Exiting: the closest EXTERIOR static door of the building, pushed
//     along its normal by (playerRadius * 3) = 1.05.
// Static-door geometry is stored in FINAL mesh space - meshReader
// scales and Y-negates the door plane verts exactly like positions -
// so world transforms apply the door's matrix directly (verified
// numerically: model 444's door centre lands halfway up its 14.45-unit
// gate only without re-scaling).

import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../player/motor.js';

export const ENTER_DOOR_OFFSET = CAPSULE_RADIUS + 0.4; // 0.75
export const EXIT_DOOR_OFFSET = CAPSULE_RADIUS * 3; // 1.05
export const MARKER_UP_OFFSET = CAPSULE_HEIGHT * 0.6; // 1.08
export const DUNGEON_EXIT_OFFSET = CAPSULE_RADIUS + 0.1; // 0.45

/** World position of a static door's centre under its matrix. */
export function doorWorldPosition(door) {
  const m = door.matrix;
  const x = door.centre.x;
  const y = door.centre.y;
  const z = door.centre.z;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** World-space unit normal of a static door (rotation only, Y negated). */
export function doorWorldNormal(door) {
  const m = door.matrix;
  const nx = door.normal.x;
  const ny = door.normal.y;
  const nz = door.normal.z;
  const x = m[0] * nx + m[4] * ny + m[8] * nz;
  const y = m[1] * nx + m[5] * ny + m[9] * nz;
  const z = m[2] * nx + m[6] * ny + m[10] * nz;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** World AABB of a static door trigger volume (for activation picking). */
export function doorWorldAabb(door) {
  const c = doorWorldPosition(door);
  const h = [
    door.size.x / 2 + 0.25,
    door.size.y / 2 + 0.25,
    door.size.z / 2 + 0.25,
  ];
  // The size triple is axis-agnostic (thickness-major); padding an
  // axis-aligned box around the centre covers any door orientation.
  const e = Math.max(h[0], h[2]);
  return {
    min: [c[0] - e, c[1] - h[1], c[2] - e],
    max: [c[0] + e, c[1] + h[1], c[2] + e],
  };
}

function closest(points, p) {
  let best = null;
  let bestD = Infinity;
  for (const point of points) {
    const dx = point.pos[0] - p[0];
    const dy = point.pos[1] - p[1];
    const dz = point.pos[2] - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = point; }
  }
  return best;
}

/** FIELD BUGS 2026-10-04d VOID-ENTRY: `points` nearest `p` first, in `closest`'s own measure - so the first is its pick
 *  (the sort is stable, and a tie keeps the array's order as its strict `<` does). */
function byDistance(points, p) {
  return points.map((point) => {
    const dx = point.pos[0] - p[0];
    const dy = point.pos[1] - p[1];
    const dz = point.pos[2] - p[2];
    return { point, d: dx * dx + dy * dy + dz * dz };
  }).sort((a, b) => a.d - b.d).map((e) => e.point);
}

/** FIELD BUGS 2026-10-04d VOID-ENTRY: what DaggerfallUI.AddHUDText says when TransitionInterior cannot lay a building
 *  out (PlayerEnterExit.cs:723-729, "use that old chestnut") - Internal_Strings `thisHouseHasNothingOfValue`
 *  (Internal_Strings_en.asset m_Id 8). The port says it for a room that stands nowhere it could be landed in, too. */
export const NOTHING_OF_VALUE_TEXT = 'This house has nothing of value.';
/** FIELD BUGS 2026-10-04d VOID-ENTRY: the failsafe's own line (the port's - DFU has no failsafe): a body that fell
 *  below everything a building stands on is stood again at the door it came in by. */
export const INTERIOR_VOID_TEXT = 'There was no floor beneath you. You are back at the door.';
/** FIELD BUGS 2026-10-04d VOID-ENTRY: how far under the lowest triangle a building has a body may be before it is in
 *  the void - nothing can stand it there, and a room's collider has no ground of its own to catch it. */
export const INTERIOR_VOID_DROP = 10;

/**
 * Verbatim TransitionInterior landing: exterior door world pos ->
 * closest enter marker -> closest interior door + normal * 0.75, with
 * the marker + up * 1.08 fallback.
 *
 * FIELD BUGS 2026-10-04d VOID-ENTRY ("Entering a house sent me to the
 * void", Warvale): `standsAt(p)` - is there a floor under p (the host
 * asks standsOnFloor over the room's collider). Beautiful Villages and
 * Beautiful Cities keep a copy of the building's own EXTERIOR model -
 * sometimes another building's - inside the room, and its door faces
 * OUT, as every exterior door does. Where it is the interior door
 * nearest the enter marker, DFU's landing stands 0.75 outside the room
 * over nothing (SetStanding's ray finds no floor, PlayerEnterExit.cs
 * :1240-1254, and the room has no ground): 146 of the 10,309 entries of
 * both packs (Warvale's GENRAS00 #1, #2 and #7), 16 of Daggerfall's own
 * 11,452 (floorless halves of rooms in ten blocks no location places -
 * ALCHAS00/01/03 and their kin, AUDIT FB1007b T1; FIELD BUGS 2026-10-07b
 * TOWER-FLOORS stood two more on their floors - interiorLayout.js
 * FLOOR_MODEL_TYPE). Handed `standsAt`, each of DFU's two arms takes only a spot it
 * stands: the doors in FindClosestInteriorDoor's order (nearest the
 * check first), then the markers in FindClosestEnterMarker's (nearest
 * the exterior door first) - every landing DFU makes on a floor is
 * DFU's, one over nothing goes to the nearest that is not, and none
 * answers null (the room is refused). Without it, verbatim.
 * @param {Array<[x,y,z]>} enterMarkers interior-space positions
 * @param {Array} interiorDoors staticDoors of the interior layout
 * @param {((p:[number,number,number]) => boolean)|null} standsAt
 * @returns {[x,y,z]|null}
 */
export function interiorLanding(exteriorDoorPos, enterMarkers, interiorDoors, standsAt = null) {
  let check = exteriorDoorPos;
  const markers = enterMarkers.map((m) => ({ pos: m }));
  const marker = closest(markers, check);
  if (marker) check = marker.pos;
  const doors = interiorDoors.map((d) => ({
    pos: doorWorldPosition(d),
    normal: doorWorldNormal(d),
  }));
  if (standsAt) {
    for (const d of byDistance(doors, check)) {
      const at = [d.pos[0] + d.normal[0] * ENTER_DOOR_OFFSET, d.pos[1] + d.normal[1] * ENTER_DOOR_OFFSET, d.pos[2] + d.normal[2] * ENTER_DOOR_OFFSET];
      if (standsAt(at)) return at;
    }
    for (const m of byDistance(markers, exteriorDoorPos)) {
      const at = [m.pos[0], m.pos[1] + MARKER_UP_OFFSET, m.pos[2]];
      if (standsAt(at)) return at;
    }
    return null;
  }
  const door = closest(doors, check);
  if (door) {
    return [
      door.pos[0] + door.normal[0] * ENTER_DOOR_OFFSET,
      door.pos[1] + door.normal[1] * ENTER_DOOR_OFFSET,
      door.pos[2] + door.normal[2] * ENTER_DOOR_OFFSET,
    ];
  }
  if (marker) {
    return [marker.pos[0], marker.pos[1] + MARKER_UP_OFFSET, marker.pos[2]];
  }
  return null;
}

/**
 * Verbatim DaggerfallStaticDoors.FindClosestDoorToPlayer (:249-277):
 * the door whose WORLD centre is nearest the given position. DFU's
 * dungeon walk-in uses it to orient the player away from the door they
 * just came through, which is the only thing that makes an entrance
 * read as an entrance.
 *
 * The DFU signature returns a bool and writes two out-params; here a
 * miss is null, which is the same information.
 *
 * @returns {{pos:[x,y,z], normal:[x,y,z], index:number}|null}
 */
export function closestDoorTo(pos, doors) {
  let best = null;
  let minDistance = Infinity;
  (doors ?? []).forEach((door, i) => {
    const c = doorWorldPosition(door);
    const d = Math.hypot(c[0] - pos[0], c[1] - pos[1], c[2] - pos[2]);
    if (d < minDistance) { minDistance = d; best = { pos: c, normal: doorWorldNormal(door), index: i }; }
  });
  return best;
}

/**
 * Verbatim DaggerfallStaticDoors.FindLowestOutermostDoor (:205-238)
 * behind DaggerfallInterior.FindLowestOuterInteriorDoor (:213-227) -
 * "the interior door that is closest to ground level and farthest
 * from the center of the building". PlayerEntity.SpawnCityGuards
 * (:632) is its ONLY caller: it is where the watch comes through when
 * the crime happened indoors.
 *
 * The predicate is BOTH terms at once and it is deliberately not a
 * two-key sort - C# writes
 *
 *     if (y <= lowestY && dist > farthestDist)
 *
 * over a single pass with `lowestY` starting at MaxValue and
 * `farthestDist` at 0, so a door only wins if it is no higher than
 * every previous WINNER and strictly farther out than every previous
 * WINNER. A low door near the middle can therefore lock `farthestDist`
 * at a small value and let a slightly-lower far door through later,
 * while an equally-low door closer in is rejected. Ported as written,
 * quirk included: the pick is order-dependent on the door array and
 * that IS the classic arrival point.
 *
 * `dist` is horizontal only (Vector2 of x/z) and measured from the
 * INTERIOR's own origin - GetSpawnParentTransform() is the interior
 * transform while the player is inside a building
 * (GameObjectHelper.cs:876-882), which is the same `transform.position`
 * the door centre is offset by, so this is the distance from the
 * building's centre out to the door.
 *
 * DFU returns TRUE even when nothing matched (doorIndexOut stays -1) -
 * `return true` sits outside the loop - and its caller then indexes
 * Doors[-1]. That is unreachable with real data (an interior with a
 * door array has at least one door and `record == -1` accepts every
 * one of them), so the port answers null for "no door" rather than
 * porting a crash.
 *
 * @param {Array} doors interior static doors, world-frame matrices
 * @param {[number,number,number]} interiorOrigin the interior's own
 *   origin in world space (parentPt(0,0,0))
 * @returns {{pos:[x,y,z], normal:[x,y,z], index:number}|null}
 */
export function findLowestOuterInteriorDoor(doors, interiorOrigin = [0, 0, 0]) {
  let best = null;
  let lowestY = Infinity;
  let farthestDist = 0;
  (doors ?? []).forEach((door, i) => {
    const c = doorWorldPosition(door);
    const dist = Math.hypot(c[0] - interiorOrigin[0], c[2] - interiorOrigin[2]);
    if (c[1] <= lowestY && dist > farthestDist) {
      best = { pos: c, normal: doorWorldNormal(door), index: i };
      lowestY = c[1];
      farthestDist = dist;
    }
  });
  return best;
}

/**
 * Verbatim PositionPlayerToDungeonExit: the LOWEST dungeon-entrance
 * door + normal * (radius + 0.1); the caller faces the normal.
 * @returns {{pos:[x,y,z], normal:[x,y,z]}|null}
 */
export function dungeonEntranceLanding(entranceDoors) {
  let best = null;
  let bestY = Infinity;
  for (const door of entranceDoors) {
    const p = doorWorldPosition(door);
    if (p[1] < bestY) {
      bestY = p[1];
      best = { pos: p, normal: doorWorldNormal(door) };
    }
  }
  if (!best) return null;
  return {
    pos: [
      best.pos[0] + best.normal[0] * DUNGEON_EXIT_OFFSET,
      best.pos[1] + best.normal[1] * DUNGEON_EXIT_OFFSET,
      best.pos[2] + best.normal[2] * DUNGEON_EXIT_OFFSET,
    ],
    normal: best.normal,
  };
}

/**
 * Verbatim StreamingWorld.RepositionPlayer's height law (:1330-1350),
 * in FEET. Both exterior exits hand DFU a reposition point - the
 * door's position plus its normal times an offset (BuildingTransition-
 * ExteriorLogic :860-864, PositionPlayerToDungeonExit :1416-1418) -
 * and RepositionPlayer places the controller's CENTRE there, unless
 * that point is below `terrain + height/2 + 0.15`, the floor it will
 * not let a player fall through. The port's spawn is the FEET, and
 * both exits handed it the door centre (about a body-half up), so the
 * player stood ~0.9u in the air at every exterior door and dropped.
 * Mac, 2026-08-27: "spawns in the air and drops".
 */
export function repositionFeetY(terrainY, centreY, height = CAPSULE_HEIGHT) {
  const minFeet = (Number.isFinite(terrainY) ? terrainY : -Infinity) + 0.15;   // terrain + height/2 + 0.15, as feet
  return Math.max(minFeet, centreY - height / 2);
}

export const LADDER_MODEL_ID = 41409;

/**
 * Verbatim DaggerfallLadder.ClimbLadder (interior-only upstream):
 * closest LadderTop / LadderBottom markers to the player; below the
 * top teleports TO the top, else above the bottom teleports to the
 * bottom. Markers arrive as {type, x, y, z} (interiorLayout).
 * @returns {[x,y,z]|null}
 */
export function climbLadder(playerPos, markers, markerTypes) {
  const closestOf = (type) => {
    let best = null;
    let bestD = Infinity;
    for (const m of markers) {
      if (m.type !== type) continue;
      const dx = m.x - playerPos[0];
      const dy = m.y - playerPos[1];
      const dz = m.z - playerPos[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  };
  const top = closestOf(markerTypes.LADDER_TOP);
  const bottom = closestOf(markerTypes.LADDER_BOTTOM);
  if (top && playerPos[1] < top.y) return [top.x, top.y, top.z];
  if (bottom && playerPos[1] > bottom.y) return [bottom.x, bottom.y, bottom.z];
  return null;
}

/** Verbatim TransitionExterior landing: closest building door + n * 1.05. */
export function exteriorLanding(playerPos, buildingDoors) {
  const doors = buildingDoors.map((d) => ({
    pos: doorWorldPosition(d),
    normal: doorWorldNormal(d),
  }));
  const door = closest(doors, playerPos);
  if (!door) return null;
  return [
    door.pos[0] + door.normal[0] * EXIT_DOOR_OFFSET,
    door.pos[1] + door.normal[1] * EXIT_DOOR_OFFSET,
    door.pos[2] + door.normal[2] * EXIT_DOOR_OFFSET,
  ];
}

/**
 * Verbatim FixStanding counterpart: DFU ends every transition
 * (TransitionInterior, MovePlayerToDungeonStart) with an instant
 * raycast snap to the floor - the port spawned at the raw landing
 * (door-centre height / marker + 1.08) and let GRAVITY floor it,
 * a visible ~1u drop on every building entry. Cast down from just
 * above the landing; on a hit, feet snap to the surface. No hit
 * (landing already at/below floor or nothing beneath) returns the
 * landing unchanged - gravity remains the fallback.
 */
export function floorLanding(collider, pos, maxDist = 10, extraHeight = 0) {
  // TL1 (Mac: "you don't remain on the ground after traveling, you
  // spawn in the air and drop"): the ARRIVAL raw is the location's
  // flattened height, and the edge landing stands ten units OUTSIDE the
  // location, on terrain the blend has not fully flattened. A steep site
  // puts that terrain more than ten units below the raw - the ray found
  // nothing and the raw stood, in the air - or ABOVE it, so the ray
  // started inside the hill and found nothing either. StreamingWorld's
  // FixStanding starts its ray `extraHeight` up and reaches further
  // down for exactly this; the arrival now passes both.
  pos = [pos[0], pos[1] + extraHeight, pos[2]];
  // Verbatim PlayerEnterExit.SetStanding shape: a downward ray finds
  // the floor and the body is placed relative to hit.point. DFU casts
  // ONE ray from transform.position - but a marker floating over a
  // seam/grate/tile-edge makes a single center ray MISS, and the old
  // code then returned the raw (airborne) position -> the player
  // free-fell and wedged on a lower ledge off-marker (Mac: feet
  // 26.10/38.40 vs marker 28.38/38.98, g:0, stuck in the hole).
  // Fix: sample the capsule FOOTPRINT (center + a ring at ~half the
  // radius), take the HIGHEST floor any sample hits (the tile the
  // feet actually rest on), so a marker over a seam still lands. This
  // is the CharacterController's footprint sweep, not a point probe.
  const bestFloorY = footprintFloorY(collider, pos, maxDist);
  if (bestFloorY === -Infinity) {
    // TSR4c (Mac: "Now I spawn in mid air after hitting ride out"):
    // THE RAY ONLY SEES MESHES. The exterior collider carries the
    // terrain as its `heightAt` callback - "floor beneath everything",
    // read by move() and never by raycastHit - so over bare ground
    // outside every block the footprint sweep finds nothing, and this
    // arm answered the raw LIFTED by extraHeight: an edge landing forty
    // units up, then the drop. TL1's own fast-travel edge arrival took
    // the same road. The collider's ground is the floor here whenever
    // it has one; a collider without (interiors, dungeons, the test
    // stubs) keeps the arm exactly as it was.
    const ground = collider.heightAt?.(pos[0], pos[2]);
    if (Number.isFinite(ground)) return [pos[0], ground, pos[2]];
    return pos;                                    // truly nothing below: leave to gravity
  }
  return [pos[0], bestFloorY, pos[2]];
}

/**
 * UNSTUCK-OUT (FIELD BUGS 2026-10-08, SaberGGaming: "Invisible walls around mountains often gets you stuck ... unstuck
 * didn't work"; Sahh: "I got stuck inside a mountain during fast travel"): THE NEAREST OPEN GROUND. World of
 * Daggerfall's mountain rocks are meshes scaled by hundreds, reaching past their pixel, and the collider holds both
 * faces of a skin while the renderer culls the back ones - so from inside a rock its walls are invisible and hold the
 * body in. Here: the terrain's own floor (`heightAt`) at the point and then on rings out from it, the first spot where
 * no static solid holds the body's feet or head (`insideSolid`, the collider's parity law - a rock open beneath holds
 * what stands under its crown) and its torso's sphere touches no mesh - and, where the host asks, `dry(floor)` (the
 * sea's floor is no ground to stand a body on). The feet of that spot, or null (nothing built there - `heightAt`
 * answers no floor - or no open ground within the last ring). Pure over the collider's queries.
 */
export const OPEN_GROUND_RINGS = Object.freeze([0, 4, 8, 16, 32, 64, 128, 256]);
/** UNSTUCK-OUT: the spacing of the spots on a ring (metres along it), and the body's points asked of the solids. */
export const OPEN_GROUND_STEP = 8;
export function openGroundNear(collider, x, z, { rings = OPEN_GROUND_RINGS, step = OPEN_GROUND_STEP, dry = null } = {}) {
  for (const r of rings) {
    const n = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const px = x + r * Math.cos(a), pz = z + r * Math.sin(a);
      const h = collider.heightAt?.(px, pz);
      if (!Number.isFinite(h) || (dry && !dry(h))) continue;
      if (heldInSolid(collider, [px, h, pz])) continue;
      if (collider.sphereOverlaps([px, h + CAPSULE_HEIGHT / 2, pz], CAPSULE_RADIUS)) continue;
      return [px, h, pz];
    }
  }
  return null;
}
/** UNSTUCK-OUT: whether a body standing with its feet at `feet` is held by a static solid (its feet or its head). */
export function heldInSolid(collider, feet) {
  return collider.insideSolid([feet[0], feet[1] + CAPSULE_RADIUS, feet[2]]) || collider.insideSolid([feet[0], feet[1] + CAPSULE_HEIGHT - CAPSULE_RADIUS, feet[2]]);
}

/** floorLanding's footprint sweep: the highest floor its five rays (the centre and a ring at ~half the capsule's
 *  radius, each from 0.2 above `pos`) meet within `maxDist`, or -Infinity. */
function footprintFloorY(collider, pos, maxDist) {
  const R = 0.18;                                  // ~half capsule radius
  const offs = [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]];
  let bestFloorY = -Infinity;
  for (const [ox, oz] of offs) {
    const origin = [pos[0] + ox, pos[1] + 0.2, pos[2] + oz];
    const d = collider.raycast(origin, [0, -1, 0], maxDist + 0.2);
    if (Number.isFinite(d)) bestFloorY = Math.max(bestFloorY, origin[1] - d);
  }
  return bestFloorY;
}

/** FIELD BUGS 2026-10-04d VOID-ENTRY: whether floorLanding STANDS a body at `pos` - its footprint meets a floor, or
 *  the collider's ground is under it - rather than handing it to gravity. A building's collider has no ground
 *  (heightAt -Infinity), so over nothing this is false, and the body would fall for good. */
export function standsOnFloor(collider, pos, maxDist = 10) {
  return footprintFloorY(collider, pos, maxDist) > -Infinity || Number.isFinite(collider.heightAt?.(pos[0], pos[2]));
}

/** FIELD BUGS 2026-10-04d VOID-ENTRY: THE FAILSAFE's record for a room just entered - `at`, where the door stood the
 *  player (the floored landing), and `belowY`, INTERIOR_VOID_DROP under the lowest triangle the room's collider holds;
 *  null for a collider that holds none. The host keeps it on the context, so it lives and dies with the room. */
export function interiorVoidRescue(collider, at) {
  const box = collider.bounds();
  return box ? { at, belowY: box.min[1] - INTERIOR_VOID_DROP } : null;
}

/** FIELD BUGS 2026-10-04d VOID-ENTRY: THE FAILSAFE. A body below `rescue.belowY` is under everything the building
 *  stands on - nothing can catch it there, and it falls for good, in the black, every door and light out of reach
 *  ("Complete darkness and possibly stuck"): a floorless half of a room walked off (in blocks of Daggerfall's own),
 *  a save or a Recall anchor made in the void (RestorePosition lands it there raw). It stands again where the door
 *  landed it - the spawn clears the fall a load carried in - and the answer is whether it did. */
export function standFromVoid(rescue, player) {
  if (!rescue || !(player.pos[1] < rescue.belowY)) return false;
  player.spawn(rescue.at[0], rescue.at[1], rescue.at[2]);
  return true;
}

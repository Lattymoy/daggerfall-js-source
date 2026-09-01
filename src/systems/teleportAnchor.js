// A10 - THE RECALL ANCHOR, ACROSS CONTEXTS. Teleport.cs (MIT,
// Daggerfall Workshop), the Mysticism effect the spellmaker calls
// Teleport and the player calls Recall.
//
// The TP slice ported the near half: the (43,255) effect prompts on a
// self arrival, the anchor lives on the entity, and teleporting
// consumes it. What it did NOT port is the half that makes Recall
// worth casting - the anchor set in ONE place and used from ANOTHER.
// The port stored `mode: 'world-exterior'` on the anchor and refused
// anything else with a line saying cross-host recall pended, which
// meant: no anchoring inside a shop, no anchoring in a dungeon, and
// no recall out of either.
//
// THE REFERENCE'S SHAPE, which is where every rule below comes from:
//
//   SetAnchor (:100-117) takes a WHOLE PlayerPositionData_v1 - the
//   world coordinates, the world compensation, the world CONTEXT
//   (exterior / interior / dungeon), and the insideBuilding /
//   insideDungeon flags. Inside a building it takes two more: the
//   exterior doors you came in by, and the building's discovery
//   record. Those two are the way back IN, and an anchor without them
//   can only land you outside.
//
//   TeleportPlayer (:119-164) asks ONE question first - IsSameInterior
//   - and takes one of two completely different arms:
//
//     SAME INTERIOR (:129-134): you are standing in the very room the
//     anchor names. Nothing is torn down and nothing is loaded; the
//     player is simply MOVED, and the anchor is consumed.
//
//     ANYWHERE ELSE (:136-163): restore the world compensation height
//     FIRST (an interior anchor carries its own, everything else
//     zero), CACHE THE SCENE YOU ARE LEAVING by the three-way arm at
//     :145-151, respawn at the anchor's world position, restore the
//     building record if the anchor was inside one, and fade in.
//     Then, when the respawner completes (:228-256), land the exact
//     saved transform, set PlayerTeleportedIntoDungeon from the
//     anchor, restore the ARRIVAL's cached scene, and consume.
//
// IsSameInterior (:190-222) is stricter than it looks, and every
// clause is here for a reason DFU wrote down:
//
//   - Outside, or no anchor: false. You can never be "in the same
//     interior" as anywhere while standing in the open.
//   - Building vs building: the building KEY must match AND the map
//     PIXEL must match. The pixel test is not redundant - DFU cites
//     the forum thread where two buildings in different places shared
//     a key ("in case we're unlucky", :202).
//   - Dungeon vs dungeon: the map pixel alone, "only one dungeon per
//     map pixel allowed" (:211). And this arm alone raises
//     PlayerTeleportedIntoDungeon (:216) on its way out.
//   - A building anchor while standing in a dungeon, or the reverse,
//     falls through both arms and answers false - which sends it to
//     the cross-context arm, correctly.
//
// This module is the DECISION, with no host in it. The caller reads
// the plan and does the work, because the three arms land in three
// different hosts and only they know how.

/** WorldContext (DaggerfallUnityEnums.cs:582-588), whole. The anchor
 *  carries one, and the interior arm of the compensation restore
 *  (:140-143) tests it by name. */
export const WORLD_CONTEXT = Object.freeze({
  Nothing: 'Nothing', Exterior: 'Exterior', Interior: 'Interior', Dungeon: 'Dungeon',
});

/** The two TEXT.RSC record ids the effect raises (:32-33). */
export const TELEPORT_OR_SET_ANCHOR = 4000;
export const ANCHOR_MUST_BE_SET = 4001;

/**
 * SetAnchor (:100-117) - GetPlayerPositionData plus the two fields a
 * building adds. The caller hands the live reads; this fixes the
 * SHAPE, so the three hosts that can set an anchor cannot each invent
 * their own.
 *
 * `mode` is kept beside `worldContext` on purpose: it is the field
 * the TP slice shipped and the field a pre-A10 save carries, and the
 * plan below reads the context through `anchorContextOf` so an old
 * anchor still recalls rather than throwing.
 *
 * @param {object} p
 * @param {string} p.worldContext - WORLD_CONTEXT member.
 * @param {{x:number,y:number}} p.pixel - the anchor's map pixel.
 * @param {number} p.nativeX @param {number} p.nativeZ - worldPosX/Z.
 * @param {number} p.y - the compensation-free height.
 * @param {number[]|null} p.local - the scene-local transform an
 *   interior or dungeon anchor lands at (RestorePosition's inside
 *   arm writes the saved transform raw).
 * @param {number} p.yaw @param {number} p.pitch - the pose half
 *   (PlayerPositionData_v1 :212-214).
 * @param {object|null} p.interior - the exteriorDoors +
 *   buildingDiscoveryData pair (:110-111), null outside a building.
 * @param {number} p.buildingKey - buildingDiscoveryData.buildingKey.
 * @param {number} p.worldCompensationY - the interior arm's own
 *   height (:141); 0 everywhere else.
 */
export function makeAnchor({
  worldContext = WORLD_CONTEXT.Exterior, pixel, nativeX, nativeZ, y = 0,
  local = null, yaw = 0, pitch = 0, interior = null, buildingKey = 0,
  worldCompensationY = 0,
} = {}) {
  const insideBuilding = worldContext === WORLD_CONTEXT.Interior;
  const insideDungeon = worldContext === WORLD_CONTEXT.Dungeon;
  return {
    worldContext,
    // The TP-slice field, kept live so a save written by either
    // version reads the same way in both directions.
    mode: insideBuilding ? 'interior' : insideDungeon ? 'dungeon' : 'world-exterior',
    pixel: { x: pixel.x, y: pixel.y },
    nativeX, nativeZ, y,
    local: local ? [...local] : null,
    yaw, pitch,
    insideBuilding, insideDungeon,
    buildingKey: insideBuilding ? buildingKey : 0,
    interior: insideBuilding ? interior : null,
    worldCompensationY: insideBuilding ? worldCompensationY : 0,
  };
}

/** A pre-A10 anchor carries `mode` and no `worldContext`; every one
 *  of them was set outside, because that was the only host that could
 *  set one. Reading through this rather than off the field means an
 *  old save recalls instead of falling down the dungeon arm with no
 *  local position. */
export function anchorContextOf(anchor) {
  if (!anchor) return WORLD_CONTEXT.Nothing;
  if (anchor.worldContext) return anchor.worldContext;
  if (anchor.mode === 'interior') return WORLD_CONTEXT.Interior;
  if (anchor.mode === 'dungeon') return WORLD_CONTEXT.Dungeon;
  return WORLD_CONTEXT.Exterior;
}

/**
 * IsSameInterior (:190-222), verbatim including the map-pixel test
 * DFU added after the forum report at :202.
 *
 * @param {object|null} anchor
 * @param {object} here - {insideBuilding, insideDungeon, buildingKey,
 *   pixel} - PlayerEnterExit's two flags, the live building record's
 *   key, and PlayerGPS.CurrentMapPixel.
 */
export function isSameInterior(anchor, here = {}) {
  // "Reject if outside or anchor not set" (:192-194). IsPlayerInside
  // is the OR of the two flags.
  const inside = !!here.insideBuilding || !!here.insideDungeon;
  if (!inside || !anchor) return false;
  const ctx = anchorContextOf(anchor);
  if (here.insideBuilding && ctx === WORLD_CONTEXT.Interior) {
    // The key first, then the pixel - "in case we're unlucky" (:202).
    if ((anchor.buildingKey ?? 0) !== (here.buildingKey ?? 0)) return false;
    return anchor.pixel?.x === here.pixel?.x && anchor.pixel?.y === here.pixel?.y;
  }
  if (here.insideDungeon && ctx === WORLD_CONTEXT.Dungeon) {
    // "only one dungeon per map pixel allowed" (:211).
    return anchor.pixel?.x === here.pixel?.x && anchor.pixel?.y === here.pixel?.y;
  }
  // A building anchor from inside a dungeon (or the reverse) is NOT
  // the same interior, and must take the cross-context arm.
  return false;
}

/**
 * TeleportPlayer (:119-164) + the respawner's tail (:228-256), as one
 * decision. The caller does the work.
 *
 * @returns {null} when no anchor is set - the caller raises 4001
 *   (:268-275) and the cast is spent either way.
 * @returns {{kind:'same-interior', local, yaw, pitch,
 *            teleportedIntoDungeon:boolean}}
 *   Just move the player (:129-134).
 * @returns {{kind:'cross', cacheScene:'exterior'|'building'|null,
 *            dungeonExitImmediate:boolean, worldCompensationY:number,
 *            arrive:'exterior'|'building'|'dungeon', anchor,
 *            teleportedIntoDungeon:boolean}}
 *   The whole cross-context flow.
 *
 * There is deliberately NO "restore scene on arrival" field. DFU's
 * (:248-252) keys off `IsPlayerInside` at the moment the respawner
 * completes, not off the anchor - so an arm that meant to land in a
 * building and repositioned outside restores the EXTERIOR scene. Only
 * the caller knows where the player actually ended up, so only the
 * caller can answer it.
 */
export function teleportPlan(anchor, here = {}) {
  if (!anchor) return null;
  if (isSameInterior(anchor, here)) {
    return {
      kind: 'same-interior',
      local: anchor.local ? [...anchor.local] : null,
      yaw: anchor.yaw ?? 0, pitch: anchor.pitch ?? 0,
      // The dungeon arm of IsSameInterior raises the flag on its way
      // out (:216); the building arm does not.
      teleportedIntoDungeon: !!here.insideDungeon,
    };
  }
  const ctx = anchorContextOf(anchor);
  const arrive = ctx === WORLD_CONTEXT.Dungeon ? 'dungeon'
    : ctx === WORLD_CONTEXT.Interior ? 'building' : 'exterior';
  return {
    kind: 'cross',
    // "Cache scene before departing" (:145-151), the three-way arm:
    // outside caches the streaming scene, inside a building caches
    // the interior, inside a dungeon caches NOTHING and takes
    // TransitionDungeonExteriorImmediate instead.
    cacheScene: here.insideDungeon ? null : here.insideBuilding ? 'building' : 'exterior',
    dungeonExitImmediate: !!here.insideDungeon,
    // "restore world compensation height early before initworld"
    // (:137-143): an INTERIOR anchor's own, zero for anything else -
    // "Ensures exterior world level is aligned with building height
    // at time of anchor".
    worldCompensationY: ctx === WORLD_CONTEXT.Interior ? (anchor.worldCompensationY ?? 0) : 0,
    arrive,
    anchor,
    // "Set 'teleported into dungeon' flag when anchor is inside a
    // dungeon" (:246).
    teleportedIntoDungeon: ctx === WORLD_CONTEXT.Dungeon,
  };
}

// ROAD-B (b3-exterior-water): THE EXTERIOR SURFACE MODEL.
//
// PlayerMotor.cs (MIT, Daggerfall Workshop) verbatim - the three
// "what am I standing on, outdoors" methods FixedUpdate/Update
// recomputes every frame (:367-369) and the properties that expose
// them (:229-248):
//
//     onExteriorWaterMethod = GetOnExteriorWaterMethod();
//     onExteriorPathMethod = GetOnExteriorPathMethod();
//     onExteriorStaticGeometryMethod = GetOnExteriorStaticGeometryMethod();
//
// Every one of them is TWO reads ANDed together:
//
//   1. a downward RAYCAST from the controller centre, which answers
//      *what object* is under the player (GetOnExteriorGroundMethod
//      :506-523, GetOnExteriorStaticGeometryMethod :531-548). Its
//      doc comment is the whole reason it exists: "Check if player is
//      really standing on an outdoor tile, not just positioned above
//      one. For example when player is on their ship they are
//      standing above water but should not be swimming. Same when
//      player is levitating above water they should not hear splash
//      sounds."
//   2. StreamingWorld.PlayerTileMapIndex - the TERRAIN TILE RECORD
//      under the player (StreamingWorld.cs:345, ported in
//      world/terrainSurface.js as playerTileMapIndex). Record 0 is
//      water (:175-178); OnShallowWaterTile (:551-563) and OnPathTile
//      (:568-574) enumerate the rest.
//
// WHAT THIS IS *NOT*. The exterior has NO submersion, NO breath and
// NO drowning in Daggerfall Unity. PlayerEnterExit.Update guards the
// entire underwater block with a comment that says so outright
// (PlayerEnterExit.cs:377): "Underwater swimming logic should only be
// processed in dungeons at this time" - and its else arm (:415-422)
// FORCES the exterior state:
//
//     if (GameManager.Instance.StreamingWorld.PlayerTileMapIndex != 0)
//         isPlayerSwimming = false;
//     isPlayerSubmerged = false;
//     levitateMotor.IsSwimming = false;
//
// So above ground isPlayerSubmerged is always false (no breathStep,
// no drowning), PlayerMotor.IsSwimming - which IS levitateMotor
// .IsSwimming (:149-152) - is always false, and the only exterior
// water state in the game is the OnExteriorWaterMethod below. The
// port's hosts already leave player.swimming false outdoors
// (shared.applyMotorEffectFlags:576), which is that law, and the
// motor's `onExteriorWater` flag - declared by A6 with "Wave B's
// exterior-water slice owns the model that raises it" - is this one.
//
// The lone exterior latch DFU does keep is isPlayerSwimming itself:
// it survives above ground while the tile under the player is water
// (the `!= 0` guard above, MeteoricDragon's note at :417). Nothing in
// the port reads a separate isPlayerSwimming - the motor's swimming
// flag is levitateMotor.IsSwimming, which is unconditionally cleared -
// so exteriorSwimLatch below carries it for the hosts that want it
// without letting it near the motor.

import { playerTileMapIndex, WATER_TILE_INDEX } from '../world/terrainSurface.js';

/** PlayerMotor.OnExteriorWaterMethod (:79-87). "Defines the way
 *  player can interact with exterior water tiles. Unrelated to deep
 *  water swimming such as in dungeons." */
export const ON_EXTERIOR_WATER = Object.freeze({
  /** "Player not touching exterior water at all." */
  None: 'None',
  /** "Player is swimming in exterior water." */
  Swimming: 'Swimming',
  /** "Player is walking on exterior water." */
  WaterWalking: 'WaterWalking',
});

/** PlayerMotor.cs:22-23. The raycast in GetOnExteriorGroundMethod and
 *  GetOnExteriorStaticGeometryMethod is cast `rayDistance * 2` deep
 *  (:512, :538) - the constant is a distance, the cast is twice it. */
export const WALKING_RAY_DISTANCE = 1.0;
export const RIDING_RAY_DISTANCE = 2.0;

/** `(TransportManager.IsOnFoot) ? walkingRayDistance : ridingRayDistance`
 *  (:507, :533). IsOnFoot is TransportModes.Foot ALONE
 *  (TransportManager.cs:55-58); Horse, Cart AND Ship all take the
 *  RIDING branch - which is why a player aboard their ship gets the
 *  long 2.0 distance and its 4.0-deep cast, the very case
 *  PlayerMotor's own comment (:499-502) is written for. The hosts pass
 *  the boolean (systems/transport.js:54), this file does not
 *  re-derive it. */
export const rayDistanceFor = (onFoot) => (onFoot ? WALKING_RAY_DISTANCE : RIDING_RAY_DISTANCE);

/** PlayerMotor.OnShallowWaterTile (:551-563), the tile-record set
 *  verbatim and in DFU's own order: "Check if player is really
 *  standing on an shallow water tile, determined by if the water
 *  design takes up the majority of the texture."
 *
 *  These are the shore/blend records of the terrain tile atlas, so a
 *  player at the water's EDGE water-walks rather than swims - which is
 *  why the deep arm below is record 0 alone. */
export function onShallowWaterTile(tileIndex) {
  return tileIndex === 5
    || tileIndex === 6
    || tileIndex === 8
    || tileIndex === 20
    || tileIndex === 21
    || tileIndex === 23
    || tileIndex === 30
    || tileIndex === 31
    || (tileIndex >= 33 && tileIndex <= 36)
    || tileIndex === 49;
}

/** PlayerMotor.OnPathTile (:568-574) - "Check if player is really
 *  standing on a path tile." Records 46, 47 and 55 are the road
 *  tiles. See exteriorPathMethod for what feeds this in the port. */
export function onPathTile(tileIndex) {
  return tileIndex === 46 || tileIndex === 47 || tileIndex === 55;
}

/**
 * The downward RaycastHit of :512/:538, in the port's terms.
 *
 * DFU casts `Physics.Raycast(transform.position, Vector3.down, out
 * hit, rayDistance * 2)` and then asks the hit ONE question each:
 * GetOnExteriorGroundMethod wants `hit.transform.GetComponent<
 * DaggerfallTerrain>()` non-null (:518-521), and
 * GetOnExteriorStaticGeometryMethod wants `hit.collider.tag.Equals(
 * "StaticGeometry")` (:546). Those two are mutually exclusive on one
 * hit, and the tag is what GameObjectHelper.TagStaticGeometry stamps
 * on every block/model mesh object (GameObjectHelper.cs:430-435,
 * RMBLayout.cs:530-532) - never on terrain.
 *
 * The port's exterior hosts split the same two surfaces along a
 * different seam: terrain is the Collider's `heightAt` floor (no
 * triangles), and every building, block and misc model IS a collider
 * mesh bucket. So the nearest of the two answers the same question
 * the Unity raycast does, and no new geometry is needed.
 *
 * @param {object} p
 * @param {number} p.centreY  controller centre = feet + height / 2
 *   (`transform.position.y` on a CharacterController).
 * @param {number} p.terrainY  the terrain floor under the player, or
 *   -Infinity / null where no pixel is built (DFU's "no terrain").
 * @param {number} p.meshDist  nearest collider-mesh hit distance
 *   straight down (Collider.raycast), Infinity on a miss.
 * @param {number} p.rayDistance  walking/riding, from rayDistanceFor.
 * @returns {{hit: boolean, terrain: boolean, staticGeometry: boolean, dist: number}}
 */
export function downProbe({ centreY, terrainY, meshDist = Infinity, rayDistance = WALKING_RAY_DISTANCE }) {
  const maxDist = rayDistance * 2;
  const ty = (terrainY == null || !Number.isFinite(terrainY)) ? -Infinity : terrainY;
  // A floor at or above the origin is not something the DOWN ray
  // reaches; -Infinity (no built pixel) falls out of this the same way.
  const terrainDist = (ty <= centreY) ? centreY - ty : Infinity;
  const md = (meshDist == null || !(meshDist >= 0)) ? Infinity : meshDist;
  const dist = Math.min(terrainDist, md);
  if (!(dist <= maxDist)) return { hit: false, terrain: false, staticGeometry: false, dist: Infinity };
  // Nearest wins, exactly as one Physics.Raycast does. Ties go to the
  // mesh: a model laid flat ON the terrain is what the player stands
  // on, and DFU's own colliders would report the model's face.
  const terrain = terrainDist < md;
  return { hit: true, terrain, staticGeometry: !terrain, dist };
}

/** PlayerMotor.GetOnExteriorGroundMethod (:506-523). "True if player
 *  is physically in range of an outdoor tile." Note the shape: inside
 *  OR a ray that hits nothing is an immediate false, and a ray that
 *  hits something without a DaggerfallTerrain on it is false too. */
export function onExteriorGroundMethod({ inside = false, probe = null } = {}) {
  if (inside || !probe?.hit) return false;
  return !!probe.terrain;
}

/** PlayerMotor.GetOnExteriorStaticGeometryMethod (:531-548). Same
 *  raycast, the other question: "True if player is physically in
 *  range of a StaticGeometry object." This one does NOT consult the
 *  tilemap at all - standing on a building roof, a bridge or a rock
 *  model is the whole test. */
export function onExteriorStaticGeometryMethod({ inside = false, probe = null } = {}) {
  if (inside || !probe?.hit) return false;
  return !!probe.staticGeometry;
}

/**
 * PlayerMotor.GetOnExteriorWaterMethod (:582-596), verbatim:
 *
 *     bool onShallowWaterTile = OnShallowWaterTile();
 *     if (!GetOnExteriorGroundMethod()
 *         || (PlayerTileMapIndex != 0 && !onShallowWaterTile))
 *        return OnExteriorWaterMethod.None;
 *     if (PlayerEntity.IsWaterWalking || onShallowWaterTile)
 *         return OnExteriorWaterMethod.WaterWalking;
 *     else
 *         return OnExteriorWaterMethod.Swimming;
 *
 * So SWIMMING is the narrow case: on the ground, on tile record 0
 * (deep water), and not water-walking. Everything at the shore, and
 * everything under a Water Walking effect, is WaterWalking - which
 * still splashes underfoot but never sinks the capsule.
 *
 * @param {object} p
 * @param {boolean} p.onGround  onExteriorGroundMethod's answer.
 * @param {number} p.tileIndex  StreamingWorld.PlayerTileMapIndex (-1
 *   off terrain, which is neither 0 nor shallow, so: None).
 * @param {boolean} p.waterWalking  PlayerEntity.IsWaterWalking.
 */
export function exteriorWaterMethod({ onGround = false, tileIndex = -1, waterWalking = false } = {}) {
  const shallow = onShallowWaterTile(tileIndex);
  if (!onGround || (tileIndex !== WATER_TILE_INDEX && !shallow)) return ON_EXTERIOR_WATER.None;
  if (waterWalking || shallow) return ON_EXTERIOR_WATER.WaterWalking;
  return ON_EXTERIOR_WATER.Swimming;
}

/** PlayerMotor.GetOnExteriorPathMethod (:600-603) -
 *  `GetOnExteriorGroundMethod() && OnPathTile()`. */
export function exteriorPathMethod({ onGround = false, tileIndex = -1 } = {}) {
  return onGround && onPathTile(tileIndex);
}

/**
 * The three methods as PlayerMotor.Update runs them (:367-369) - one
 * raycast, one tilemap read, three answers.
 *
 * `rawTile` is the tilemap BYTE under the player (what the hosts'
 * playerGroundTile probes already return); it goes through
 * terrainSurface.playerTileMapIndex, which is StreamingWorld.cs:345's
 * `TileMap[...].r / 4` and answers -1 for "no built terrain" exactly
 * as UpdatePlayerTerrainTileIndex:321 does.
 *
 * @returns {{water: string, path: boolean, staticGeometry: boolean,
 *            onGround: boolean, tileIndex: number}}
 */
export function exteriorSurfaces({
  inside = false, rawTile = null, tileIndex = null,
  waterWalking = false, probe = null,
} = {}) {
  const idx = tileIndex == null ? playerTileMapIndex(rawTile) : tileIndex;
  const onGround = onExteriorGroundMethod({ inside, probe });
  return {
    water: exteriorWaterMethod({ onGround, tileIndex: idx, waterWalking }),
    path: exteriorPathMethod({ onGround, tileIndex: idx }),
    staticGeometry: onExteriorStaticGeometryMethod({ inside, probe }),
    onGround,
    tileIndex: idx,
  };
}

/**
 * PlayerEnterExit.Update's exterior else arm (:415-422) - the ONLY
 * swim state above ground, and it is a clearing rule, not a setting
 * one:
 *
 *     // don't clear swimming if we're outside on a water tile - MeteoricDragon
 *     if (GameManager.Instance.StreamingWorld.PlayerTileMapIndex != 0)
 *         isPlayerSwimming = false;
 *     isPlayerSubmerged = false;
 *     levitateMotor.IsSwimming = false;
 *
 * A player who dives out of a dungeon onto open water keeps
 * IsPlayerSwimming until they reach any non-water tile; submersion and
 * the motor's swim mode are cleared unconditionally, every frame.
 *
 * @returns {{swimming: boolean, submerged: false, motorSwimming: false}}
 */
export function exteriorSwimLatch(wasSwimming, tileIndex) {
  return {
    swimming: tileIndex === WATER_TILE_INDEX ? !!wasSwimming : false,
    submerged: false,
    motorSwimming: false,
  };
}

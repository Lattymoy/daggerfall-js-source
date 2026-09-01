// Dungeon point lights. 1:1 with Daggerfall Unity's RDBLayout.AddLights /
// AddLight (MIT, Daggerfall Workshop): one light per RDB object of
// resource type Light, at the object's (X, -Y, Z) * GlobalScale, with
// range = LightResource.Radius * GlobalScale * 3. Light properties come
// from the DaggerfallLight [Dungeon] prefab (read from the prefab YAML):
// point light, intensity 0.8, color white, Animate ON - every dungeon
// light flickers with the verbatim DaggerfallLight state machine
// (worldClock.LightFlicker). Dungeon ambient is PlayerAmbientLight's
// verbatim DungeonAmbientLight (0.12, 0.12, 0.12); there is no sun.

import { getFloat } from '../systems/settings.js';   // AUDIT 28 W1: DungeonAmbientLightScale
import { GLOBAL_SCALE } from './meshReader.js';
import { RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';

export const DUNGEON_AMBIENT = Object.freeze([0.12, 0.12, 0.12]);
/** AUDIT 26 F183 - the two ambients a dungeon can take INSTEAD.
 *  UpdateAmbientLight (PlayerAmbientLight.cs:82-90) tests the castle
 *  block FIRST, then the special area, and only the plain-dungeon arm
 *  is multiplied by Settings.DungeonAmbientLightScale:
 *
 *      if (IsPlayerInsideDungeonCastle)   CastleAmbientLight
 *      else if (IsPlayerInsideSpecialArea) SpecialAreaLight
 *      else                                DungeonAmbientLight * scale
 *
 *  Both declared 0.58 (:32-33). Kept as two constants rather than one
 *  alias because they are two distinct serialized fields - an
 *  inspector override could split them, and this clone carries no
 *  scenes to say whether one has. */
export const CASTLE_AMBIENT = Object.freeze([0.58, 0.58, 0.58]);
export const SPECIAL_AREA_AMBIENT = Object.freeze([0.58, 0.58, 0.58]);
/** SpecialAreaCheck (PlayerEnterExit.cs:1221-1238): exactly one block
 *  name, the Daggerfall treasure room. */
export const SPECIAL_AREA_BLOCK = 'S0000161.RDB';

/** The selector, so neither host can get the precedence wrong. */
export function dungeonAmbientFor({ inCastle = false, inSpecialArea = false } = {}) {
  if (inCastle) return CASTLE_AMBIENT;
  if (inSpecialArea) return SPECIAL_AREA_AMBIENT;
  // AUDIT 28 W1: the multiply the comment above quotes. GetFloat 0..1
  // (SettingsManager :574); the castle and special-area arms are NOT
  // scaled, exactly as :82-90 has them.
  const scale = getFloat('Enhancements', 'DungeonAmbientLightScale', 0, 1);
  return scale === 1 ? DUNGEON_AMBIENT : DUNGEON_AMBIENT.map((v) => v * scale);
}
/** A10 - THE BLOCK-RANGE RULE (DungeonLightHandler.cs:25, :53-75).
 *
 *  Every dungeon light carries this handler, and every 0.4s it asks
 *  ONE question of ITSELF: is the player farther than
 *  `UnscaledBlockRange * MeshReader.GlobalScale` away, measured on XZ
 *  ALONE - "dungeon blocks have no defined vertical height" (:62)?
 *  Farther, the light is disabled; nearer or equal, enabled. It is a
 *  RANGE, not a budget: a room with forty lights around you keeps all
 *  forty lit, and a light two blocks off is dark however few lights
 *  the dungeon has.
 *
 *  2060 is 2048 (a dungeon block's DF-unit footprint) plus a 12-unit
 *  margin, so the rule reads "lights outside the block you stand in,
 *  and its immediate skirt, are off".
 *
 *  THE COMPOSITION, recorded rather than invented: the port's shader
 *  takes at most 16 point lights, so the hosts pick the nearest 16 by
 *  3D distance. That cap is OURS - the renderer's, not Daggerfall's -
 *  and it is the INNER bound. The reference rule runs FIRST and culls
 *  by XZ range; the 16-slot pick then runs over what survives. Where
 *  fewer than 16 lights are in range the port is now exactly the
 *  reference; where more are, the port keeps the nearest 16 of the
 *  in-range set rather than 16 of the whole dungeon, which is the
 *  closest a 16-slot renderer can stand to "all of them". The order
 *  matters: capping first and culling second would hand the shader
 *  fewer than 16 lights while in-range ones sat unlit. */
export const UNSCALED_BLOCK_RANGE = 2060;
export const DUNGEON_LIGHT_BLOCK_RANGE = UNSCALED_BLOCK_RANGE * GLOBAL_SCALE;

export const DUNGEON_LIGHT_INTENSITY = 0.8;
export const DUNGEON_LIGHT_COLOR = Object.freeze([
  DUNGEON_LIGHT_INTENSITY, DUNGEON_LIGHT_INTENSITY, DUNGEON_LIGHT_INTENSITY,
]);

/**
 * Collect point lights for one RDB block (block-local coordinates).
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rdb).
 * @returns {Array<{x:number,y:number,z:number,range:number}>}
 */
export function collectDungeonLights(dfBlock) {
  const lights = [];
  for (const group of dfBlock.rdbBlock.objectRootList) {
    if (!group.rdbObjects) continue;
    for (const obj of group.rdbObjects) {
      if (obj.type !== RDB_RESOURCE_TYPES.Light) continue;
      lights.push({
        x: obj.xPos * GLOBAL_SCALE,
        y: -obj.yPos * GLOBAL_SCALE,
        z: obj.zPos * GLOBAL_SCALE,
        range: obj.resources.lightResource.radius * GLOBAL_SCALE * 3,
      });
    }
  }
  return lights;
}

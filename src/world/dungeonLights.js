// Dungeon point lights. 1:1 with Daggerfall Unity's RDBLayout.AddLights /
// AddLight (MIT, Daggerfall Workshop): one light per RDB object of
// resource type Light, at the object's (X, -Y, Z) * GlobalScale, with
// range = LightResource.Radius * GlobalScale * 3. Light properties come
// from the DaggerfallLight [Dungeon] prefab (read from the prefab YAML):
// point light, intensity 0.8, color white, Animate ON - every dungeon
// light flickers with the verbatim DaggerfallLight state machine
// (worldClock.LightFlicker). Dungeon ambient is PlayerAmbientLight's
// UpdateAmbientLight dungeon arm (:84-92) - DungeonAmbientLight
// (0.12) on the floor, CastleAmbientLight / SpecialAreaLight (0.58)
// in a castle block or the treasure room; there is no sun.

import { GLOBAL_SCALE } from './meshReader.js';
import { RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';

export const DUNGEON_AMBIENT = Object.freeze([0.12, 0.12, 0.12]);
/** PlayerAmbientLight.CastleAmbientLight / SpecialAreaLight (:32-33):
 *  one value, twice - a castle block and the Daggerfall treasure room
 *  both light at 0.58, nearly five times the dungeon floor. */
export const CASTLE_AMBIENT = Object.freeze([0.58, 0.58, 0.58]);
export const SPECIAL_AREA_AMBIENT = CASTLE_AMBIENT;

/** PlayerEnterExit.SpecialAreaCheck (:1221-1237): the "special area"
 *  is ONE block - the Daggerfall treasure room. */
export const SPECIAL_AREA_BLOCK_NAME = 'S0000161.RDB';
export const isSpecialAreaBlock = (blockName) => blockName === SPECIAL_AREA_BLOCK_NAME;

/** PlayerAmbientLight.UpdateAmbientLight's DUNGEON arm (:84-92), the
 *  branch the port applied only the last line of: a castle block takes
 *  CastleAmbientLight, a special area SpecialAreaLight, and only what
 *  is neither takes DungeonAmbientLight. The castle predicate is
 *  IsPlayerInsideDungeonCastle (dungeonContext's live `inCastle`,
 *  which reads rdbLayout's castleBlock); the special-area predicate is
 *  isSpecialAreaBlock over the player's current block name. */
export function dungeonAmbient({ insideDungeonCastle = false, insideSpecialArea = false } = {}) {
  if (insideDungeonCastle) return CASTLE_AMBIENT;
  if (insideSpecialArea) return SPECIAL_AREA_AMBIENT;
  return DUNGEON_AMBIENT;
}
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

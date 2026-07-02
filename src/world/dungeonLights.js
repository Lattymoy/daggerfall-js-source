// Dungeon point lights. 1:1 with Daggerfall Unity's RDBLayout.AddLights /
// AddLight (MIT, Daggerfall Workshop): one light per RDB object of
// resource type Light, at the object's (X, -Y, Z) * GlobalScale, with
// range = LightResource.Radius * GlobalScale * 3. Light properties come
// from the DaggerfallLight [Dungeon] prefab (read from the prefab YAML):
// point light, intensity 0.8, color white, Animate ON - every dungeon
// light flickers with the verbatim DaggerfallLight state machine
// (worldClock.LightFlicker). Dungeon ambient is PlayerAmbientLight's
// verbatim DungeonAmbientLight (0.12, 0.12, 0.12); there is no sun.

import { GLOBAL_SCALE } from './meshReader.js';
import { RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';

export const DUNGEON_AMBIENT = Object.freeze([0.12, 0.12, 0.12]);
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

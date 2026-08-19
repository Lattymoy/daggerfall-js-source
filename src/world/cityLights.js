// City light collection: one point light per archive-210 flat. 1:1 with
// Daggerfall Unity's RMBLayout AddLights/AddLight and the exterior-subrecord
// light path (MIT, Daggerfall Workshop). Verbatim:
//   - Misc block flats with archive 210: light at
//     (XPos, -YPos + nativeSize.y, ZPos + 4096) * GlobalScale. DFU's
//     GetScaledBillboardSize returns NATIVE units (MeshReader.cs:549-568 -
//     cm.recordSizes is raw texture pixels, no GlobalScale), so the offset is
//     added INSIDE the scaled vector; our getScaledSize returns WORLD units
//     (the contract DaggerfallInterior.cs:939 relies on), so we add it AFTER
//     the multiply, which is the same number.
//     Note the light Y differs from the billboard Y (blockFlatsOffsetY -6).
//   - Exterior subrecord flats with archive 210: same formula plus the
//     unrotated (subX, 0, -subZ) * scale offset. Original archive is checked
//     (210 is excluded from climate swaps).
// Light properties come from the DaggerfallLight [City] prefab: point light,
// range 18, intensity 1, color white. The prefab's night-only enable and
// Animate flicker belong to the day/night cycle; our scenes gate lights on
// the night window style as the documented equivalence.

import { RMB_DIMENSION } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';

export const LIGHTS_ARCHIVE = 210;
export const CITY_LIGHT_RANGE = 18;
export const CITY_LIGHT_INTENSITY = 1;
export const CITY_LIGHT_COLOR = Object.freeze([1, 1, 1]);

/**
 * Collect point-light positions for one RMB block.
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rmb).
 * @param {(record:number) => {w:number,h:number}} getScaledSize -
 *   scaledBillboardSize for archive 210 records.
 * @returns {Array<{x:number,y:number,z:number}>}
 */
export function collectCityLights(dfBlock, getScaledSize) {
  const rmb = dfBlock.rmbBlock;
  const lights = [];

  // Misc block flats (AddLights -> AddLight).
  for (const obj of rmb.miscFlatObjectRecords) {
    if (obj.textureArchive !== LIGHTS_ARCHIVE) continue;
    const size = getScaledSize(obj.textureRecord);
    lights.push({
      x: obj.xPos * GLOBAL_SCALE,
      y: -obj.yPos * GLOBAL_SCALE + size.h,
      z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE,
    });
  }

  // Exterior subrecord flats: unrotated subrecord offset, verbatim.
  for (const subRecord of rmb.subRecords) {
    const subX = subRecord.xPos * GLOBAL_SCALE;
    const subZ = -subRecord.zPos * GLOBAL_SCALE;
    for (const obj of subRecord.exterior.blockFlatObjectRecords) {
      if (obj.textureArchive !== LIGHTS_ARCHIVE) continue;
      const size = getScaledSize(obj.textureRecord);
      lights.push({
        x: obj.xPos * GLOBAL_SCALE + subX,
        y: -obj.yPos * GLOBAL_SCALE + size.h,
        z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE + subZ,
      });
    }
  }

  return lights;
}

/**
 * Pick the nearest `max` lights to a position; returns flat vec4 data
 * [x, y, z, range] ready for the renderer.
 */
export function nearestLights(lights, pos, max = 16, range = CITY_LIGHT_RANGE) {
  const perLight = typeof range !== 'number' ? range : null;
  const sorted = lights
    .map((l, index) => {
      const dx = l.x - pos[0];
      const dy = l.y - pos[1];
      const dz = l.z - pos[2];
      return { l, index, d: dx * dx + dy * dy + dz * dz };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, max);
  const out = new Float32Array(sorted.length * 4);
  for (let i = 0; i < sorted.length; i++) {
    out[i * 4] = sorted[i].l.x;
    out[i * 4 + 1] = sorted[i].l.y;
    out[i * 4 + 2] = sorted[i].l.z;
    out[i * 4 + 3] = perLight ? perLight[sorted[i].index] : range;
  }
  return out;
}

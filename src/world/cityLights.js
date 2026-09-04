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
 *
 * LT1: pass `colorOf` - `(light, index) => [r, g, b]`, the light's
 * colour x intensity - and the return becomes `{ data, colors }`:
 * `colors` is the flat vec3 array in the SAME pick order as `data`,
 * from the ONE sort (a second sort could diverge on distance ties).
 * Without it the return is the bare vec4 array, unchanged - the
 * exterior lantern callers.
 */
/** EV2: the selection scratch. The old body allocated one {l, index,
 *  d} object PER LIGHT and full-sorted, every frame, in all four
 *  hosts. A bounded stable insertion into two module arrays keeps the
 *  exact same answer - `>` on the shift and strict `<` on admission
 *  reproduce a stable sort's tie order (earliest index wins, at the
 *  cut too) - with zero allocation until the small result arrays,
 *  which stay per-call because setPointLights holds the returned
 *  buffer across the frame's re-uploads. */
const _selD = [];
const _selIdx = [];

/** A10: `xzRange` is DungeonLightHandler's cut, handed in by the
 *  callers that have one (the dungeon hosts). It is a RANGE, not a
 *  count: a light farther than it on XZ is not a candidate at all,
 *  which is the reference's own per-light `myLight.enabled = false`
 *  (DungeonLightHandler.cs:60-74). 0 means "no cut" - every exterior
 *  and interior caller, unchanged. See dungeonLights.js for why the
 *  two rules compose in this order. */
export function nearestLights(lights, pos, max = 16, range = CITY_LIGHT_RANGE, colorOf = null, xzRange = 0) {
  const perLight = typeof range !== 'number' ? range : null;
  const xz2 = xzRange > 0 ? xzRange * xzRange : 0;
  let count = 0;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    const dx = l.x - pos[0];
    const dy = l.y - pos[1];
    const dz = l.z - pos[2];
    // The XZ block-range gate, BEFORE the nearest-N admission: DFU
    // compares XZ only ("dungeon blocks have no defined vertical
    // height", :62) and disables on strictly greater, so a light
    // exactly at the range stays lit.
    if (xz2 && dx * dx + dz * dz > xz2) continue;
    const d = dx * dx + dy * dy + dz * dz;
    if (count >= max && d >= _selD[count - 1]) continue;   // not admitted; ties keep the earlier light
    let j = count < max ? count++ : count - 1;
    while (j > 0 && _selD[j - 1] > d) { _selD[j] = _selD[j - 1]; _selIdx[j] = _selIdx[j - 1]; j--; }
    _selD[j] = d; _selIdx[j] = i;
  }
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const l = lights[_selIdx[i]];
    out[i * 4] = l.x;
    out[i * 4 + 1] = l.y;
    out[i * 4 + 2] = l.z;
    out[i * 4 + 3] = perLight ? perLight[_selIdx[i]] : range;
  }
  if (!colorOf) return out;
  // The colour arm rides the SAME selection - the one-sort law above
  // holds exactly as before: one ordering, two views of it.
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = colorOf(lights[_selIdx[i]], _selIdx[i]);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  return { data: out, colors };
}

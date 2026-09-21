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
 * @returns {Array<{record:number,x:number,y:number,z:number}>}
 */
export function collectCityLights(dfBlock, getScaledSize) {
  const rmb = dfBlock.rmbBlock;
  const lights = [];

  // Misc block flats (AddLights -> AddLight).
  for (const obj of rmb.miscFlatObjectRecords) {
    if (obj.textureArchive !== LIGHTS_ARCHIVE) continue;
    const size = getScaledSize(obj.textureRecord);
    lights.push({
      // HEARTH1: the RECORD rides along. A lantern and a brazier are the
      // same point light to this collector and NOT the same thing to the
      // survival law (survival/hearth.js), and this is the one walk of
      // the block that knows which is which - collecting the flats a
      // second time to ask again would be the same walk for the same
      // answer.
      record: obj.textureRecord,
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
        record: obj.textureRecord,   // HEARTH1
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
export function nearestLights(lights, pos, max = 16, range = CITY_LIGHT_RANGE, colorOf = null, xzRange = 0, n = -1) {
  const perLight = typeof range !== 'number' ? range : null;
  const xz2 = xzRange > 0 ? xzRange * xzRange : 0;
  // PERF-LIGHTS (2026-09-19): how many of `lights` are live. The world
  // host refills a POOL of light objects rather than minting one per
  // lantern per frame (a town at night is hundreds of them, sixty times a
  // second, in a frame that is already script-bound), so its array is
  // longer than its contents. Default -1 keeps every other caller's
  // meaning exactly: the whole array.
  const len = n < 0 ? lights.length : Math.min(n, lights.length);
  let count = 0;
  for (let i = 0; i < len; i++) {
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
    // AUDIT PERF-LIGHTS F2 (pre-existing, found by this audit): a
    // per-light range array SHORTER than the light list gives `undefined`
    // here, which lands in a Float32Array as NaN - and a NaN far plane
    // goes on to the point-shadow matrices and the shader's depth
    // reconstruction, where it fails silently and totally. The host sizes
    // its animator at 4096 lanterns and nothing checks the lights against
    // it; a big enough city at a long enough land view is a cliff with no
    // edge marked. The fallback is the module's own default range, which
    // is what an unanimated lantern is anyway.
    const w = perLight ? perLight[_selIdx[i]] : range;
    out[i * 4 + 3] = Number.isFinite(w) ? w : CITY_LIGHT_RANGE;
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

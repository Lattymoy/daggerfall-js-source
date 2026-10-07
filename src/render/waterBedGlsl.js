// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE BED'S FACE (2026-10-07): UNDER CLEAR WATER, THE GROUND IS A BED, NOT A PAINTING OF WATER. The water
// carves its bed (world/waterBed.js) and looks through to it - and the first shots from the real game (Daggerfall's
// moat, tools/waterLookProbe.mjs) showed the same flat blue as before: the ground under the water wore Daggerfall's
// WATER TILE, so the look through clear water was a look at more painted water. Where the enhanced water lies over the
// ground (`uWaterBed`, the hosts' switch - never the classic skin, which draws the tile as DFU does), each water texel
// of the ground - the draw's corner table's own coverage (world/waterCorners.js WATER_DRAW_MASK_TABLE), feathered as the
// water's shore is - takes the climate's DIRT (the tileset's record 1, the same texel turned the same way), darkened
// and cooled to silt. A puddle record keeps its art (WATER-PUDDLE: its water is its picture's).
// Both terrain programs take this text: renderer.js TERRAIN_FS and the lane's EL_TERRAIN_FS (enhancedLighting.js).
// ═══════════════════════════════════════════════════════════════════
import { PUDDLE_RECORDS } from '../world/puddleMask.js';

/** The silt: the dirt record's colour times this, under the water. */
export const BED_SILT = Object.freeze([0.62, 0.6, 0.52]);
/** The tileset's dirt record - the bed's texel. */
export const BED_RECORD = 1;

export const WATER_BED_GLSL = `
uniform float uWaterBed;       // WATER-NEXT 2: 1 where the enhanced water lies over this ground
uniform uvec4 uBedMask[8];     // the draw's water corners, packed as the water's own uWaterMask
float bedCover(uint data, vec2 f) {
  if (uWaterBed < 0.5) return 0.0;
  uint rec = data >> 2u;
  if (${PUDDLE_RECORDS.map((r) => `rec == ${r}u`).join(' || ')}) return 0.0;
  uvec4 v = uBedMask[data >> 5u];
  uint j = (data >> 3u) & 3u;
  uint word = j == 0u ? v.x : (j == 1u ? v.y : (j == 2u ? v.z : v.w));
  uint m = (word >> ((data & 7u) * 4u)) & 15u;
  if (m == 0u) return 0.0;
  float c = mix(mix(float(m & 1u), float((m >> 1u) & 1u), f.x), mix(float((m >> 2u) & 1u), float((m >> 3u) & 1u), f.x), f.y);
  return smoothstep(0.3, 0.7, c);
}`;

/** The call site's line: the bed's texel mixed into `tex` (a decode wrapped round the sample for the lane). */
export const waterBedMix = (decode = (s) => s) =>
  `float bedK = bedCover(data, tileUV);
  if (bedK > 0.0) tex = mix(tex, ${decode(`textureGrad(uTileArr, vec3(tuv, ${BED_RECORD.toFixed(1)}), gx, gy).rgb`)} * vec3(${BED_SILT.map((v) => v.toFixed(2)).join(', ')}), bedK);   // WATER-NEXT 2: under the water, a bed`;

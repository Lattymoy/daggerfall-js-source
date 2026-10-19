// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE BED'S FACE (2026-10-07): UNDER CLEAR WATER, THE GROUND IS A BED, NOT A PAINTING OF WATER. The water
// carves its bed (world/water/waterBed.js) and looks through to it - and the first shots from the real game (Daggerfall's
// moat, tools/waterLookProbe.mjs) showed the same flat blue as before: the ground under the water wore Daggerfall's
// WATER TILE, so the look through clear water was a look at more painted water. Where the enhanced water lies over the
// ground (`uWaterBed`, the hosts' switch - never the classic skin, which draws the tile as DFU does), each water texel
// of the ground - the draw's corner table's own coverage (world/water/waterCorners.js WATER_DRAW_MASK_TABLE), feathered as the
// water's shore is - takes the climate's DIRT (the tileset's record 1, the same texel turned the same way), darkened
// and cooled to silt. A puddle record keeps its art (WATER-PUDDLE: its water is its picture's).
// Both terrain programs take this text: renderer.js TERRAIN_FS and the lane's EL_TERRAIN_FS (enhancedLighting.js).
// ═══════════════════════════════════════════════════════════════════
import { PUDDLE_RECORDS } from '../world/puddleMask.js';

/** The silt: the dirt record's colour times this, under the water. */
export const BED_SILT = Object.freeze([0.62, 0.6, 0.52]);
/** The tileset's dirt record - the bed's texel. */
export const BED_RECORD = 1;
/** SHORE-SILT: the fringe's wet mud - the silt's grey times this, taken at WET_MUD_SHARE where no water lies over it
 *  (bare silt beside a pond read as bright orange flecks in Vanilla Enhanced's grass; wet ground is dark and dull). */
export const WET_MUD = 0.62;
export const WET_MUD_SHARE = 0.8;

export const WATER_BED_GLSL = `
uniform float uWaterBed;       // WATER-NEXT 2: 1 where the enhanced water lies over this ground
uniform uvec4 uBedMask[8];     // the draw's water corners, packed as the water's own uWaterMask
// SHORE-SILT: tl/gx/gy the ground's own texel of this tile (its layer, turned) - a shore's art paints its water past
// the corner table's line, and that paint goes under the silt too (its mask in the layer's alpha, world/puddleMask.js
// markShoreWater), or a bank is freckled with flat blue where neither the bed nor the sheet reaches. Answers the bed's
// share and, of it, the FRINGE's - the art's water past the sheet, which no water darkens: drawn as wet mud, not silt.
// AUDIT PRECIP GROUND-5: under the snow (\`snowC\`, the ground's cover - render/snowCoverGlsl.js) the art's water is the
// texel's it wears there: the summer record's mask walked to its winter record's (uSnowArr.x layers on) by the cover
vec2 bedCover(uint data, vec2 f, vec3 tl, vec2 gx, vec2 gy, float snowC) {
  if (uWaterBed < 0.5) return vec2(0.0);
  uint rec = data >> 2u;
  if (${PUDDLE_RECORDS.map((r) => `rec == ${r}u`).join(' || ')}) return vec2(0.0);
  uvec4 v = uBedMask[data >> 5u];
  uint j = (data >> 3u) & 3u;
  uint word = j == 0u ? v.x : (j == 1u ? v.y : (j == 2u ? v.z : v.w));
  uint m = (word >> ((data & 7u) * 4u)) & 15u;
  if (m == 0u) return vec2(0.0);
  float c = mix(mix(float(m & 1u), float((m >> 1u) & 1u), f.x), mix(float((m >> 2u) & 1u), float((m >> 3u) & 1u), f.x), f.y);
  float k = smoothstep(0.3, 0.7, c);
  float art = 0.0;
  if (m != 15u && k < 1.0) {
    float a = textureGrad(uTileArr, tl, gx, gy).a;
    if (snowC > 0.0) a = mix(a, textureGrad(uTileArr, vec3(tl.xy, tl.z + float(uSnowArr.x)), gx, gy).a, snowC);
    art = smoothstep(0.3, 0.7, a);
  }
  return vec2(max(k, art), max(art - k, 0.0));
}`;

/** The call site's line: the bed's texel mixed into `tex` (a decode wrapped round the sample for the lane). */
export const waterBedMix = (decode = (s) => s) =>
  `vec2 bedK = bedCover(data, tileUV, vec3(tuv, float(layer)), gx, gy, snowC);
  if (bedK.x > 0.0) {   // WATER-NEXT 2: under the water, a bed
    vec3 silt = ${decode(`textureGrad(uTileArr, vec3(tuv, ${BED_RECORD.toFixed(1)}), gx, gy).rgb`)} * vec3(${BED_SILT.map((v) => v.toFixed(2)).join(', ')});
    silt = mix(silt, vec3(dot(silt, vec3(0.299, 0.587, 0.114))) * ${WET_MUD.toFixed(2)}, ${WET_MUD_SHARE.toFixed(2)} * bedK.y);   // SHORE-SILT: the fringe past the sheet is wet mud - darker, greyer
    tex = mix(tex, silt, bedK.x);
  }`;

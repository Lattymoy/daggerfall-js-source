// @ts-check
// PRECIP4 (2026-10-19, the owner: "If its snowing in one area and raining in the next, the transition should be seamless
// both in ground texture and everything else") - THE GROUND'S SNOW, in both terrain programs (renderer.js TERRAIN_FS and
// the lane's EL_TERRAIN_FS), right after ECOTONE1's border (render/ecotoneGlsl.js). systems/weather/snowpack.js is the
// law: what fell and has not melted, at every place and height; scenes/snowCoverHost.js reads it about the player into
// a lattice of SNOWLINES - the heights where the cover crosses 10, 50 and 90 % at map-pixel corners every two pixels -
// and the renderer hands the window of them about the player to the frame as one small texture (uSnowLines, a texel a
// lattice point: AUDIT PRECIP GROUND-7, it was six uniforms a draw, and HOST-5/GROUND-4, the line a fragment read was
// another function from the one every reader on the CPU read). A fragment reads the line at its own place between the
// four points about it - snowCoverHost.js lineAt's bilinear, term for term - its cover off its own height against it
// (snowAtHeight - snowpack.js coverAtHeight), and breaks a thin cover into patches (snowCoverAt below is all of it on the CPU, for the grass and the feet: GROUND-3); then its tile is its OWN climate's WINTER record of the same tile (DFU's winter archive, TerrainMaterialProvider's +1 - every set is the same
// 56 records, R9) in that share. On the snow lane a ground set wearing a winter IS its twin - its summer records, then
// its winter ones, one array (renderer.js uploadTileArray; GROUND-2) - and the renderer sets each bound array's winter
// offset off the array itself (uSnowArr: GROUND-1, the host had kept its own record, and a released twin read layer 55
// of the summer set); a border's neighbours' twins are on ECOTONE1's units, and the winter texel crosses the border by
// the ecotone's own weights. uSnowSet.y is 0 for every draw off the lane - the classic skin, the interiors, a world whose
// ground wears DFU's season - and the whole chunk is then one uniform test.

/** The ground's snow constants: the patches' cells (in world tiles, 6.4 m) and weights, their edge, and how a patch
 *  octave fades with the fragment's footprint (AUDIT PRECIP GROUND-8). SNOW-FACE (FIELD BUGS 2026-10-21): no slope - a
 *  steep face keeps the snow its height lays, as DFU's winter set dresses every tile. The face's own record has no rock
 *  under it to shed to: its summer grass is what showed, a green wall up a white mountain where the landforms stand
 *  their faces past 52 degrees (and DFU's TerrainNature refuses a tree past 50, so it stood bare of them too). */
export const SNOW_GROUND = Object.freeze({
  patch: Object.freeze([Object.freeze({ cell: 1, weight: 0.35 }), Object.freeze({ cell: 4, weight: 0.4 }), Object.freeze({ cell: 16, weight: 0.25 })]),
  edge: 0.07,
  salt: 0x534e4f57,   // 'SNOW'
  fade: Object.freeze([2, 2]),   // an octave's share kept: a - b x footprint / cell (whole to half a cell a pixel, gone at one)
});
/** The layers a twin array holds before its winter half: a ground set's records (R9). */
export const TWIN_LAYERS = 56;
/** The texture unit the frame's snowlines bind on (renderer.js setSnowFrame) - free of every other pass's. */
export const SNOW_LINES_UNIT = 23;
/** A world tile (m) - the patches' lattice and the ecotone's. */
export const SNOW_TILE_M = 6.4;
const TILE_M = SNOW_TILE_M;
/** The ecotone's frame (world/ecotone.js ecoOrigin): a pixel's first tile north is (row0 - py) x 128. */
export const SNOW_TILE_ROW0 = 512;

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

/**
 * THE COVER'S CHUNK - what any program that asks the ground's snow needs: the frame's lines (uSnowLines, uSnowSet,
 * uSnowWin) and `float snowCover(vec2 local, float y, vec2 gx, vec2 gy)` - the cover of the ground at pixel-local
 * metres `local`, world height `y`, its tile footprint `gx`/`gy` (tiles a screen pixel): 0 off the lane, else the line
 * there, its height's cover, the patches as far as the footprint resolves them
 * (main asks it once and never reads the chunk's uniforms - AUDIT 47's rule: a unit uses what it declares), and
 * `float snowLaid(...)` the same at the same place for a snow lying on the ground - 1 off the lane. Reads the
 * draw's first world tile off `uEcoOrigin` (declared before it: the ecotone's in the terrain programs, its own in the
 * water's). The terrain's chunk (snowCoverGlsl) and the water's (AUDIT PRECIP GROUND-5: a puddle under snow is the winter
 * art's) both carry it.
 */
export function snowCoreGlsl() {
  const e = SNOW_GROUND.edge, P = SNOW_GROUND.patch;
  return `// PRECIP4 (render/snowCoverGlsl.js; the law is systems/weather/snowpack.js)
uniform highp sampler2D uSnowLines;   // the window's lattice of snowlines: texel (i, j) the point i east and j south of its first, rgb h10/h50/h90 (m above the sea)
uniform vec4 uSnowSet;                // x: world y -> metres above the sea; y: 1 on; z: the lattice's spacing (world tiles)
uniform highp ivec3 uSnowWin;         // the window's first point's world tile (x east, z north - the ecotone's frame), its side (points)
uniform highp ivec4 uSnowArr;         // the bound arrays' winter halves: x the draw's own (uTileArr), y-w uEcoArr1-3 (0 none)
float snowHash(highp ivec2 c, highp uint salt) {
  highp uint h = (uint(c.x) * 0x8da6b343u) ^ (uint(c.y) * 0xd8163841u) ^ (salt * 0xcb1ab31fu);
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
  return float(h >> 8u) * (1.0 / 16777216.0);
}
float snowNoise(vec2 lt, highp int cell, highp uint salt) {
  vec2 q = lt / float(cell);
  vec2 fl = floor(q);
  highp ivec2 i = uEcoOrigin.xy / cell + ivec2(fl);
  vec2 fr = q - fl;
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = snowHash(i, salt), b = snowHash(i + ivec2(1, 0), salt), c = snowHash(i + ivec2(0, 1), salt), d = snowHash(i + ivec2(1, 1), salt);
  float top = a + (b - a) * u.x, bot = c + (d - c) * u.x;
  return top + (bot - top) * u.y;
}
// snowpack.js coverAtHeight: piecewise linear through (h10, 0.1), (h50, 0.5), (h90, 0.9), out to 0 and 1 a quarter span on
float snowAtHeight(vec3 line, float h) {
  float lo = max(1.0, line.y - line.x), hi = max(1.0, line.z - line.y);
  if (h <= line.x) return max(0.0, 0.1 + 0.1 * (h - line.x) / (0.25 * lo));
  if (h <= line.y) return 0.1 + 0.4 * (h - line.x) / lo;
  if (h <= line.z) return 0.5 + 0.4 * (h - line.y) / hi;
  return min(1.0, 0.9 + 0.1 * (h - line.z) / (0.25 * hi));
}
vec3 snowLineAt(highp ivec2 p) {
  highp int s = uSnowWin.z - 1;
  return texelFetch(uSnowLines, clamp(p, ivec2(0), ivec2(s)), 0).rgb;
}
// the snowline at a pixel-local point: the lattice's bilinear between the four points about it (snowCoverHost.js lineAt)
vec3 snowLine(vec2 local) {
  vec2 rel = vec2(uEcoOrigin.xy - uSnowWin.xy) + local / ${f(TILE_M)};   // world tiles from the window's first point, x east, z north
  vec2 q = vec2(rel.x, -rel.y) / uSnowSet.z;
  vec2 fl = floor(q);
  highp ivec2 i = ivec2(fl);
  vec2 u = q - fl;
  vec3 a = snowLineAt(i), b = snowLineAt(i + ivec2(1, 0)), c = snowLineAt(i + ivec2(0, 1)), d = snowLineAt(i + ivec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float snowCover(vec2 local, float y, vec2 gx, vec2 gy) {
  if (uSnowSet.y < 0.5) return 0.0;   // off the lane: one uniform test
  float c = snowAtHeight(snowLine(local), y + uSnowSet.x);   // SNOW-FACE: a steep face keeps it (SNOW_GROUND)
  if (c <= 0.0 || c >= 1.0) return c;
  vec2 lt = local / ${f(TILE_M)};
  // AUDIT PRECIP GROUND-8: the patches band-limited by the fragment's footprint (gx, gy: tiles a screen pixel - the
  // tile's own gradient, GRAIN1's) - an octave whose cell the footprint reaches is its mean, and what the patches no
  // longer resolve is their mean, the share itself: the distant snowline stands still as the eye moves
  float fw = max(length(gx), length(gy)), p = 0.0, keep = 0.0;
${P.map((o, k) => `  { float a = clamp(${f(SNOW_GROUND.fade[0])} - ${f(SNOW_GROUND.fade[1])} * fw / ${f(o.cell)}, 0.0, 1.0); p += ${f(o.weight)} * mix(0.5, snowNoise(lt, ${o.cell}, ${SNOW_GROUND.salt + k}u), a); keep += ${f(o.weight)} * a; }`).join('\n')}
  if (keep <= 0.0) return c;
  p = clamp((p - 0.5) * 2.2 + 0.5, 0.0, 1.0);   // the sum's middle widened, so a half cover is half the ground
  return mix(c, smoothstep(${f(-e)}, ${f(e)}, ${f(-e)} + ${f(1 + 2 * e)} * c - p), keep);
}
// AUDIT PRECIP GROUND-9: the share of the ground a snow lying ON it may take (the Snowfall mod's surface,
// render/snowfallGlsl.js): the ground's own cover on the snow lane - never a drift on green grass - and the whole ground
// off it, where DFU's winter dresses every tile and the mod's own gate asks the season
float snowLaid(vec2 local, float y, vec2 gx, vec2 gy) {
  return uSnowSet.y < 0.5 ? 1.0 : snowCover(local, y, gx, gy);
}
`;
}

/**
 * The terrain's chunk, for a program whose texels decode through `decode` (the lane's elDecode; '' for the classic
 * program's display values) and whose own tile array is uTileArr. After ecotoneGlsl (its uEcoOrigin - every lane draw
 * sends the pixel's first world tile there). The cover's chunk, then
 * `vec3 snowGround(vec3 bare, vec4 ew, float c, vec3 tl, vec2 gx, vec2 gy)`: `bare` the ground's texel as the ecotone
 * left it, `ew` the ecotone's weights there (ecoWeights, computed once by main - AUDIT PRECIP GROUND-6), `c` its cover
 * (main's snowCover - the water bed reads it too), `tl` its (tuv, layer), `gx`/`gy` its gradient.
 * @param {string} decode
 */
export function snowCoverGlsl(decode = '') {
  return `${snowCoreGlsl()}
vec3 snowGround(vec3 bare, vec4 ew, float c, vec3 tl, vec2 gx, vec2 gy) {
  if (c <= 0.0) return bare;
  vec3 white = ${decode}(textureGrad(uTileArr, vec3(tl.xy, tl.z + float(uSnowArr.x)), gx, gy).rgb);
  if (ew.x < 1.0) {
    vec3 cw = white * ew.x;
    if (ew.y > 0.0) cw += ew.y * ${decode}(textureGrad(uEcoArr1, vec3(tl.xy, tl.z + float(uSnowArr.y)), gx, gy).rgb);
    if (ew.z > 0.0) cw += ew.z * ${decode}(textureGrad(uEcoArr2, vec3(tl.xy, tl.z + float(uSnowArr.z)), gx, gy).rgb);
    if (ew.w > 0.0) cw += ew.w * ${decode}(textureGrad(uEcoArr3, vec3(tl.xy, tl.z + float(uSnowArr.w)), gx, gy).rgb);
    white = cw;
  }
  return mix(bare, white, c);
}
`;
}

// ---- THE SAME, ON THE CPU (AUDIT PRECIP GROUND-3: the grass, the feet - snowCoverHost.js buries, winterAt) -------------

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** snowHash, in 32-bit integers as the GLSL takes them. Pure. */
export function snowHash(cx, cy, salt) {
  let h = (Math.imul(cx, 0x8da6b343) ^ Math.imul(cy, 0xd8163841) ^ Math.imul(salt >>> 0, 0xcb1ab31f)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return (h >>> 8) * (1 / 16777216);
}
/** snowNoise at pixel-local tiles `lt` of the pixel whose first world tile is (ox, oz) (the ecotone's ecoOrigin). Pure. */
function snowNoise(ltx, ltz, ox, oz, cell, salt) {
  const qx = ltx / cell, qz = ltz / cell, flx = Math.floor(qx), flz = Math.floor(qz);
  const ix = Math.trunc(ox / cell) + flx, iz = Math.trunc(oz / cell) + flz;
  const fx = qx - flx, fz = qz - flz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = snowHash(ix, iz, salt), b = snowHash(ix + 1, iz, salt), c = snowHash(ix, iz + 1, salt), d = snowHash(ix + 1, iz + 1, salt);
  const top = a + (b - a) * ux, bot = c + (d - c) * ux;
  return top + (bot - top) * uz;
}
/**
 * THE GROUND'S COVER AS IT IS DRAWN, on the CPU - snowCover term for term at a footprint below a cell (the near field,
 * where the grass and the feet are; AUDIT PRECIP GROUND-8's fade is the distance's): `cover` its cover off the snowline at its
 * height (snowpack.js coverAtHeight), `lx`/`lz` its pixel-local metres and (`ox`, `oz`) its pixel's first world tile
 * (ecotone.js ecoOrigin: the patches' lattice). 0 bare, 1 white. Pure. SNOW-FACE: no slope, as the chunk's.
 */
export function snowCoverAt(cover, lx, lz, ox, oz) {
  const e = SNOW_GROUND.edge, c = cover;
  if (c <= 0 || c >= 1) return Math.max(0, Math.min(1, c));
  const ltx = lx / TILE_M, ltz = lz / TILE_M;
  let p = 0;
  SNOW_GROUND.patch.forEach((o, k) => { p += o.weight * snowNoise(ltx, ltz, ox, oz, o.cell, (SNOW_GROUND.salt + k) >>> 0); });
  p = Math.min(1, Math.max(0, (p - 0.5) * 2.2 + 0.5));
  return smooth(-e, e, -e + (1 + 2 * e) * c - p);
}

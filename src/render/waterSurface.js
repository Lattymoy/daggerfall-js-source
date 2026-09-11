// THE WATER SURFACE (WATER1, 2026-09-08). Mac: "develop proper water
// shader for the oceans/rivers/ponds of daggerfall."
//
// WHAT DAGGERFALL DRAWS. Water is record 0 of the terrain tileset, and
// the terrain pass draws it exactly as it draws dirt: one opaque layer
// of the tile array, Lambert-lit, unmoving (render/renderer.js
// TERRAIN_FS - the verbatim TilemapTextureArray decode). The ocean's
// vertices are clamped flat at SCALED_OCEAN_ELEVATION (terrainSampler.js)
// but nothing about the shading says "water". Classic Daggerfall
// palette-cycled the tile; DFU draws it flat. This is the port's
// ENHANCED-LANE DEPARTURE (Ledger section A, row WATER1): a second pass
// over the same terrain grid, alpha-blended above it, that shades every
// water tile as a water surface - waves on the wind, the sky reflected
// by Fresnel, the sun and the moon glinting, the cloud deck's shadow,
// rain pocking the surface, the shore feathered along the marching
// squares' own diagonal. The classic lane and the terrain pass are
// untouched: the switch is `enhancedWater`, the kill door `?water=off`.
//
// THE GEOMETRY IS THE TERRAIN'S. There is no water mesh: the pass draws
// the pixel's own terrain surface (positions, normals, indices - the
// far ring's strided twin included) lifted WATER_LIFT above the ground,
// and the fragment shader DISCARDS everything that is not water. So the
// ocean is flat because the terrain under it is flat, a river follows
// its slope because the tiles do, and a town pond sits at the town's
// ground. Nothing here asserts a water surface height to the game
// (player/exteriorSurface.js: DFU has none outdoors) - it is a draw.
//
// WHICH TEXEL IS WATER. The tile byte says (the same byte the terrain
// pass decodes: record = data >> 2, transform = data & 3), through a
// 256-entry table of WATER CORNERS: which of the tile's four corners,
// in the TILEMAP'S OWN FRAME, stand in water. Record 0 is all four.
// The shore records are the marching-squares transitions
// (world/terrainTiles.js createLookupTable, DFU's AssignTilesJob): a
// shape's bits name the corners that are dirt, and the table maps that
// shape to a record plus its rotate/flip bits - so the table inverts
// exactly: the byte a shape wrote gets the shape's water corners back.
// The river painter (world/roadPainter.js) writes the same records with
// the same bits, and the water-grass (20-22, 49) and water-stone
// (30-32, 50) twins of the water-dirt shapes by the same columns, so
// they take the same corners. A shore record the painters never write
// (8, 9, 23, 33-36: town docks and moats) has no known shape and takes
// no water here: the classic tile stands. The coverage inside a tile is
// the bilinear blend of its corners - the diagonal the shore tile's own
// art follows - feathered by SHORE_SOFTNESS.
import { createLookupTable } from '../world/terrainTiles.js';
import { convertTile, WATER_TILE_INDEX } from '../world/terrainSurface.js';
import { WIND_ROW_CALM, WIND_ROW_SPAN } from '../systems/wind.js';

/** How far above the ground the surface is drawn, in world units (a
 *  tile is 6.4). Enough to clear the depth test on a slope, too little
 *  to read as a step at the shore. */
export const WATER_LIFT = 0.08;
/** The surface's base opacity; Fresnel raises it toward grazing. */
export const WATER_OPACITY = 0.82;
/** The classic water texel's tint under the surface - a deep blue-green
 *  multiplier, so the tile's own palette colour reads as the body of the
 *  water and not as a floor seen through it. */
export const WATER_TINT = Object.freeze([0.62, 0.78, 0.86]);
/** Schlick's F0 for water (n = 1.33). */
export const WATER_F0 = 0.02;
/** Half-width of the shore feather, in coverage (0.5 is the diagonal). */
export const SHORE_SOFTNESS = 0.16;
/** WATER2: the bed's depth under which the surface has faded to
 *  nothing - the shoreline is where the ground rises to meet the
 *  water, and the last hand's breadth is clear. World units. */
export const SHORE_DEPTH = 0.35;
/** WATER2: the surface's opacity over a bed just under it; the body
 *  climbs from here to WATER_OPACITY as the bed falls away. */
export const SHALLOW_OPACITY = 0.30;
/** WATER2: the colour of deep water - what the body tends to as the
 *  bed is lost, lit by the same ambient and sun as the texel. */
export const DEEP_COLOR = Object.freeze([0.05, 0.17, 0.22]);
/** WATER2: how fast the bed is lost, per world unit of depth
 *  (Beer-Lambert: 1 - exp(-depth * absorb); 0.45 is nine tenths lost
 *  at BASIN_DEPTH). */
export const WATER_ABSORB = 0.45;
/** WATER3: the bed's depth by which the swell lifts the surface in
 *  full - over a shallower bed the vertices ride less, so the sheet
 *  never lifts off its own shoreline. World units. */
export const SWELL_DEPTH = 1.0;
/** WATER3: the bed's depth under which the shore foams - the band of
 *  broken water along every bank, wider on a wind. World units. */
export const FOAM_DEPTH = 1.2;
/** The classic texel's slow flow, in tiles per second. AUDIT 65 CV-3:
 *  the ONE home for the rate - scenes/dungeon.js and scenes/worldModes.js
 *  import it, so a river and a dungeon pool crawl alike. */
export const WATER_SCROLL_TILES_PER_SEC = 0.05;
/** The sky the surface reflects when no sky says otherwise (a test, a
 *  lab without a dome): a plain day. */
export const DEFAULT_SKY_ZENITH = Object.freeze([0.17, 0.35, 0.72]);
export const DEFAULT_SKY_HORIZON = Object.freeze([0.66, 0.78, 0.92]);

/** The water-dirt shore family and its water-grass / water-stone twins,
 *  by column: corner, edge, three-corner, saddle - the painter's own
 *  columns (roadPainter.js STREAM_TILES / RIVER_TILES). */
export const SHORE_FAMILIES = Object.freeze([
  Object.freeze([5, 6, 7, 48]),
  Object.freeze([20, 21, 22, 49]),
  Object.freeze([30, 31, 32, 50]),
]);

/**
 * The 256-entry water-corner table, indexed by the CONVERTED tile byte
 * (record << 2 | transform). Bits: 1 = corner (0,0), 2 = (1,0),
 * 4 = (0,1), 8 = (1,1), in the tilemap's frame (x along the tile row,
 * y along the column - AssignTilesJob's b0..b3).
 */
export function buildWaterMaskTable() {
  const table = new Uint8Array(256);
  for (let t = 0; t < 4; t++) table[(WATER_TILE_INDEX << 2) | t] = 0xF;
  const lookup = createLookupTable();
  for (let shape = 0; shape < 16; shape++) {
    const raw = lookup[shape];               // ring 0: water below, dirt above
    const record = raw & 0x3f;
    const k = SHORE_FAMILIES[0].indexOf(record);
    if (k < 0) continue;                      // shape 0 is bare water (record 0, above), 15 bare dirt
    const t = convertTile(raw) & 3;
    const water = (~shape) & 0xF;             // the shape's bits are the DIRT corners
    for (const family of SHORE_FAMILIES) table[(family[k] << 2) | t] = water;
  }
  return table;
}

export const WATER_MASK_TABLE = buildWaterMaskTable();

/** The table packed eight nibbles to a uint, as the shader's
 *  `uvec4 uWaterMask[8]` takes it: entry i is word i >> 3, nibble i & 7. */
export function packWaterMask(table = WATER_MASK_TABLE) {
  const words = new Uint32Array(32);
  for (let i = 0; i < 256; i++) words[i >> 3] |= (table[i] & 0xF) << ((i & 7) * 4);
  return words;
}

/** WATER-AUDIT: does a sub-rectangle of a `dim`-wide tilemap carry any
 *  water? The fixed city pads its square tilemap with zeros past the
 *  location's real extent, and zero converts to water, so the whole map
 *  answered yes for every non-square town (AUDIT 65 MC-6: the one gate -
 *  the whole-map twin it replaced had no caller left and is retired). */
export function tilemapRectHasWater(bytes, dim, width, height, table = WATER_MASK_TABLE) {
  const w = Math.min(width, dim), h = Math.min(height, dim);
  for (let y = 0; y < h; y++) {
    const row = y * dim;
    for (let x = 0; x < w; x++) if (table[bytes[row + x]]) return true;
  }
  return false;
}

/**
 * WATER-AUDIT (M4): THE WATER'S OWN INDEX SET. The pass drew the pixel's
 * whole terrain grid - 32,768 triangles for one stream tile, the far
 * ring's twin skirt included (a 40-unit vertical curtain of water at a
 * coast, both windings, four times). The quads of buildTerrainIndices'
 * layout whose tiles carry any water corner, and nothing else: an open
 * sea keeps every quad, a stream pixel keeps a few hundred triangles, no
 * pixel keeps a skirt. Null when the tilemap carries no water at all.
 * A quad (x, z) of the stride-`stride` grid covers the stride x stride
 * tiles at (x * stride.., z * stride..) - the grid's cell IS the tile at
 * stride 1 (6.4 units), which is the frame the shader samples in.
 */
export function buildWaterIndices(bytes, stride = 1, table = WATER_MASK_TABLE, tileDim = 128) {
  const g = tileDim / stride + 1;
  const q = g - 1;
  const out = [];
  for (let z = 0; z < q; z++) {
    for (let x = 0; x < q; x++) {
      let wet = false;
      for (let tz = z * stride; tz < (z + 1) * stride && !wet; tz++) {
        const row = tz * tileDim;
        for (let tx = x * stride; tx < (x + 1) * stride; tx++) if (table[bytes[row + tx]]) { wet = true; break; }
      }
      if (!wet) continue;
      const i0 = z * g + x, i1 = i0 + 1, i2 = i0 + g, i3 = i2 + 1;
      out.push(i0, i2, i3, i0, i3, i1);
    }
  }
  return out.length ? Uint32Array.from(out) : null;
}

/** The water corners of one converted byte (the shader's own lookup, in JS). */
export const waterCorners = (convertedByte, table = WATER_MASK_TABLE) => table[convertedByte & 0xff];

/** The bilinear coverage the shader computes at (fx, fy) inside a tile -
 *  the JS twin of this file's own GLSL `coverage()` (the corner-bit
 *  order bit0=(0,0), bit1=(1,0), bit2=(0,1), bit3=(1,1)). No production
 *  caller: test/water.test.js holds the two bodies against each other. */
export function waterCoverage(mask, fx, fy) {
  const c00 = mask & 1, c10 = (mask >> 1) & 1, c01 = (mask >> 2) & 1, c11 = (mask >> 3) & 1;
  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return top + (bottom - top) * fy;
}

/** 0..1: the eased wind row's strength on the sky's own scale
 *  (systems/wind.js: a row's vector runs WIND_ROW_CALM to
 *  WIND_ROW_CALM + WIND_ROW_SPAN). null = no wind is known = calm. */
export function windStrength01(wind) {
  if (!wind) return 0;
  const m = Math.hypot(wind[0] ?? 0, wind[1] ?? 0);
  return Math.min(1, Math.max(0, (m - WIND_ROW_CALM) / WIND_ROW_SPAN));
}

/**
 * The frame's water uniforms, from what the hosts hold: the clock in
 * real seconds, the eased wind row (null = calm; the direction is the
 * row's), the front's rain intensity 0..1, and the sky's two colours
 * ({zenith, horizon} 0..1 rgb, or null for the default day).
 */
export function waterUniforms({ seconds = 0, wind = null, rain = 0, sky = null, still = false } = {}) {
  const t = still ? 0 : seconds;
  const s = windStrength01(wind);
  let dx = 0.7, dz = Math.sqrt(1 - 0.49);   // a unit direction: the wind the sea takes when none is known
  if (wind) {
    const m = Math.hypot(wind[0] ?? 0, wind[1] ?? 0);
    if (m > 1e-9) { dx = wind[0] / m; dz = wind[1] / m; }
  }
  return {
    time: t,
    windDir: [dx, dz],
    windStrength: s,
    rain: Math.min(1, Math.max(0, rain || 0)),
    zenith: sky?.zenith ?? DEFAULT_SKY_ZENITH,
    horizon: sky?.horizon ?? DEFAULT_SKY_HORIZON,
    scroll: (t * WATER_SCROLL_TILES_PER_SEC) % 1,
    lift: WATER_LIFT,
    opacity: WATER_OPACITY,
    tint: WATER_TINT,
    f0: WATER_F0,
    shoreSoft: SHORE_SOFTNESS,
    shoreDepth: SHORE_DEPTH,      // WATER2: the bed's four dials
    shallowOpacity: SHALLOW_OPACITY,
    deep: DEEP_COLOR,
    absorb: WATER_ABSORB,
    swellDepth: SWELL_DEPTH,      // WATER3: the swell and the foam
    foamDepth: FOAM_DEPTH,
  };
}

/** WATER2: the water's OWN grid - the ground's heights as they stood
 *  before the basin was carved (render/waterBasin.js waterMesh), and
 *  under each vertex the bed's depth, which the fragment reads as the
 *  bed's distance. The lift stays: the hand's breadth that clears the
 *  depth test where the bed comes up to meet the surface.
 *
 *  WATER3: THE SWELL. The vertex rides the same three wave trains the
 *  fragment takes its normal from - the height whose gradient the
 *  fragment's waveGradient() is, train for train: an amplitude of
 *  A / k for a gradient term A cos(k x + w t), the same distance fade
 *  on the same scale - so the surface the eye sees moving and the
 *  slopes it is lit by are ONE field. The rain's fine trains are not
 *  ridden: they are a texture on the water, not a sea. Over a bed
 *  shallower than uSwellDepth the ride is scaled down so the sheet
 *  never lifts off its own shoreline (WATER2's fade lives there). */
export const WATER_SURFACE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in float aDepth;   // WATER2: the bed below, world units
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLift;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uSwellDepth;
uniform vec3 uCamPos;
out vec3 vWorldPos;
out vec2 vLocalXZ;
out float vDepth;
// the height of the wave field at p - the integral of the fragment's
// waveGradient(), train for train (A / k, the same phase, the same fade)
float swellHeight(vec2 p, float t, float dist) {
  float s = 0.35 + 0.65 * uWindStrength;
  vec2 d0 = uWindDir;
  vec2 d1 = vec2(0.809 * d0.x - 0.588 * d0.y, 0.588 * d0.x + 0.809 * d0.y);
  vec2 d2 = vec2(0.766 * d0.x + 0.643 * d0.y, -0.643 * d0.x + 0.766 * d0.y);
  float h = 0.0;
  h += (0.11 / 0.55 * s * exp(-dist * 0.0015)) * sin(dot(p, d0) * 0.55 + t * 1.3);
  h += (0.08 / 1.10 * s * exp(-dist * 0.006)) * sin(dot(p, d1) * 1.10 + t * 2.1);
  h += (0.06 / 2.30 * s * exp(-dist * 0.015)) * sin(dot(p, d2) * 2.30 + t * 3.4);
  return h;
}
void main() {
  vec4 world = uModel * vec4(aPos.x, aPos.y + uLift, aPos.z, 1.0);
  float dist = length(uCamPos - world.xyz);
  float ride = clamp(aDepth / uSwellDepth, 0.0, 1.0);
  world.y += swellHeight(world.xz, uTime, dist) * ride;
  vWorldPos = world.xyz;
  vLocalXZ = aPos.xz;
  vDepth = aDepth;
  gl_Position = uProj * uView * world;
}`;

/**
 * The surface's fragment shader, with the renderer's cloud-shadow block
 * interpolated (a GLSL declaration is visible only to the compilation
 * unit that carries it - the EE5 lesson in renderer.js).
 *
 * The normal is the gradient of three wave trains (one down the wind,
 * two crossing it) and, under rain, two fine trains that pock the
 * surface; the amplitudes ride the wind's strength off a calm floor.
 * The colour is the classic water texel (layer 0, slowly scrolled,
 * tinted, lit by the SAME ambient / sun / moon / cloud-shadow law the
 * ground beside it is lit by, in the same palette space - no sRGB
 * anywhere in this engine) mixed toward the reflected sky by Schlick's
 * Fresnel, plus the sun's and the moon's Blinn-Phong glints. The alpha
 * is the opacity raised toward grazing by the same Fresnel, feathered
 * to nothing along the shore's diagonal; a texel outside any water is
 * discarded before it costs a blend.
 */
export const waterSurfaceFs = (cloudShadowGlsl) => `#version 300 es
precision highp float;
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vWorldPos;
in vec2 vLocalXZ;
in float vDepth;               // WATER2: the bed's depth under this texel
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform float uTileSize;
uniform int uTileDim;          // WATER-AUDIT: the tilemap's side (128 in the world, the town's own in the fixed city)
uniform uvec4 uWaterMask[8];   // WATER1: 256 nibbles - converted tile byte -> water corners
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;   // 0..1 on the sky's row scale
uniform float uRain;           // 0..1, the front's intensity
uniform float uScroll;         // the classic texel's flow, in tiles
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform int uPointCount;       // WATER-AUDIT: the ground's point lights and the player's indirect light, term for term
uniform vec4 uPointLights[16];
uniform vec3 uPointColors[16];
uniform vec4 uIndirect;
uniform vec3 uIndirectColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uF0;
uniform float uShoreSoft;
uniform float uShoreDepth;     // WATER2: the bed's four dials - see waterUniforms
uniform float uShallowOpacity;
uniform vec3 uDeep;
uniform float uAbsorb;
uniform float uFoamDepth;      // WATER3: the shore's foam band
${cloudShadowGlsl}
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }
  return exp(-uFogDensity * d);
}
uint waterCorners(uint data) {
  // the component by comparison, not by a dynamic index: a dynamic
  // component index on a uvec4 answered zero on ANGLE/SwiftShader (the
  // probe's first run), and a driver that cannot find the water is worse
  // than three compares
  uvec4 v = uWaterMask[data >> 5u];
  uint j = (data >> 3u) & 3u;
  uint word = j == 0u ? v.x : (j == 1u ? v.y : (j == 2u ? v.z : v.w));
  return (word >> ((data & 7u) * 4u)) & 15u;
}
// WATER3: a cheap value noise for the foam's lace - a hash of the
// cell, bilinear between four corners; no texture, no table
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float coverage(uint m, vec2 f) {
  float c00 = float(m & 1u), c10 = float((m >> 1u) & 1u);
  float c01 = float((m >> 2u) & 1u), c11 = float((m >> 3u) & 1u);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}
// the gradient of the wave field at p: three trains on the wind, two
// fine rain trains; returns d(height)/d(xz). Each train fades with the
// distance from the eye on its own wavelength's scale, so a train a few
// units long is gone before it is a texel wide and aliases - the far
// sea keeps the long swell only.
vec2 waveGradient(vec2 p, float t, float dist) {
  float s = 0.35 + 0.65 * uWindStrength;
  vec2 d0 = uWindDir;
  // WATER-AUDIT (H3): the crossing trains by ROTATION of the wind, never
  // by adding a fixed vector to it - the sum collapsed onto the wind at
  // one heading and was the zero vector (a NaN sea) at its opposite
  vec2 d1 = vec2(0.809 * d0.x - 0.588 * d0.y, 0.588 * d0.x + 0.809 * d0.y);   // +36 degrees
  vec2 d2 = vec2(0.766 * d0.x + 0.643 * d0.y, -0.643 * d0.x + 0.766 * d0.y);  // -40 degrees
  vec2 g = vec2(0.0);
  g += (0.11 * s * exp(-dist * 0.0015)) * cos(dot(p, d0) * 0.55 + t * 1.3) * d0;
  g += (0.08 * s * exp(-dist * 0.006)) * cos(dot(p, d1) * 1.10 + t * 2.1) * d1;
  g += (0.06 * s * exp(-dist * 0.015)) * cos(dot(p, d2) * 2.30 + t * 3.4) * d2;
  if (uRain > 0.0) {
    float near = exp(-dist * 0.012);
    vec2 r0 = vec2(0.96, 0.28), r1 = vec2(-0.28, 0.96);
    g += (0.16 * uRain * near) * cos(dot(p, r0) * 6.0 + t * 9.0) * r0;
    g += (0.16 * uRain * near) * cos(dot(p, r1) * 6.3 - t * 8.3) * r1;
  }
  return g;
}
void main() {
  vec2 unwrapped = vLocalXZ / uTileSize;
  ivec2 cell = clamp(ivec2(floor(unwrapped)), ivec2(0), ivec2(uTileDim - 1));
  uint data = texelFetch(uTilemap, cell, 0).r;
  uint corners = waterCorners(data);
  if (corners == 0u) discard;
  vec2 f = fract(unwrapped);
  float edge = smoothstep(0.5 - uShoreSoft, 0.5 + uShoreSoft, coverage(corners, f));
  // WATER2: the SHORELINE is where the bed rises to meet the surface -
  // the last hand's breadth of depth is clear water over ground, and
  // the art's diagonal (edge) only bounds it
  edge *= smoothstep(0.0, uShoreDepth, vDepth);
  if (edge <= 0.002) discard;
  // WATER2: how much of the bed is lost to the water above it
  float deep = 1.0 - exp(-max(vDepth, 0.0) * uAbsorb);
  vec3 toEye = uCamPos - vWorldPos;
  float dist = length(toEye);
  vec2 g = waveGradient(vWorldPos.xz, uTime, dist);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = toEye / max(dist, 1e-4);
  float NdV = clamp(dot(n, V), 0.0, 1.0);   // WATER-AUDIT (M1): two near-unit vectors can dot past one; pow of a negative is NaN
  // Schlick, capped: a sea is never the mirror a flat plane is - the
  // slopes the trains do not carry still scatter the grazing view - so
  // the reflection tops out short of one, and what it reflects leans a
  // little toward the zenith for the same reason
  float F = uF0 + (0.72 - uF0) * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, n);
  vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, clamp(0.2 + R.y * 1.4, 0.0, 1.0));
  float shadow = cloudShadowAt(vWorldPos);
  // the classic texel, the body of the water, lit as the ground is lit
  vec2 uv = fract(f + vec2(uScroll));
  vec3 tex = texture(uTileArr, vec3(uv, 0.0)).rgb * uTint;
  float diff = max(dot(n, uLightDir), 0.0) * shadow;
  float mdiff = max(dot(n, uMoonDir), 0.0);
  // WATER2: the body tends to the deep colour as the bed is lost, in
  // the same light - a deep pool at midnight is black, not blue
  tex = mix(tex, uDeep, deep);
  vec3 lit = tex * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
  // WATER-AUDIT (M2): the ground's other two terms - the sixteen point
  // lights and the player-following indirect light - so a torch by a
  // pond lights the water it lights the bank by, with no seam at the shore
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * max(dot(n, L / max(d, 1e-4)), 0.0) * uPointColors[i];
  }
  lit += tex * pointAcc;
  vec3 iL = uIndirect.xyz - vWorldPos;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  lit += tex * (iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0)) * uIndirectColor;
  vec3 col = mix(lit, skyRefl, F);
  vec3 H = normalize(uLightDir + V);
  float spec = pow(max(dot(n, H), 0.0), 180.0) * uSunScale * shadow;
  vec3 Hm = normalize(uMoonDir + V);
  float mspec = pow(max(dot(n, Hm), 0.0), 220.0) * uMoonScale;
  col += uSunColor * (1.6 * spec) + uMoonColor * (0.7 * mspec);
  // WATER3: THE FOAM. Two sources, one lace: the SHORE, where the bed
  // rises through the last uFoamDepth of water and the surface breaks
  // on it - a band that breathes with the swell and is wider on a wind
  // - and the CRESTS, where the field's slope is steep enough to break,
  // which only a strong wind reaches. The lace is a value noise drawn
  // along the wind, so it moves as the water does; the foam is lit
  // white by the ground's own ambient and sun, and it is not glass, so
  // the alpha rises with it.
  float lace = vnoise(vWorldPos.xz * 0.9 + uWindDir * (uTime * 0.6)) * 0.6 + vnoise(vWorldPos.xz * 3.1 - uWindDir * (uTime * 1.1)) * 0.4;
  float shoreFoam = (1.0 - smoothstep(0.0, uFoamDepth * (0.6 + 0.8 * uWindStrength), vDepth)) * smoothstep(0.35, 0.75, lace + 0.15 * sin(uTime * 1.7 + vWorldPos.x * 0.3));
  float crestFoam = smoothstep(0.16, 0.30, length(g)) * uWindStrength * smoothstep(0.45, 0.8, lace);
  float foam = clamp(shoreFoam + crestFoam, 0.0, 1.0) * exp(-dist * 0.004);
  vec3 foamLit = vec3(0.92) * (uAmbient + uSunColor * (uSunScale * shadow) + uMoonColor * uMoonScale);
  col = mix(col, foamLit, foam);
  // WATER2: clear over a bed just under the surface, the body's own
  // opacity where it is deep; Fresnel raises either toward grazing
  float body = mix(uShallowOpacity, uOpacity, deep);
  float alpha = (max(body, foam) + (1.0 - max(body, foam)) * F) * edge;
  outColor = vec4(mix(uFogColor, col, fogFactorAt(vWorldPos)), alpha);
}`;

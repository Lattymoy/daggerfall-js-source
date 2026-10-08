// @ts-check
// SNOWFALL1 (2026-10-08): THE MOD'S SNOW SURFACE, AS GLSL - Daggerfall/Mods/DynamicSnow (vendor/snowfall/shaders/
// DynamicSnow.glsl, read back from its DXBC), its one pass's vertex and fragment programs, with every constant the DXBC
// carries. One program draws the three tiers the runtime stands (systems/snowfallRuntime.js): the local window, the
// middle ring and the streamed blanket, told apart by their uniforms as the mod's three materials are.
//
// THE VERTEX LAW: a vertex stands on the ground (its object y) and rises by the snow the context mask resolves there
// (SnowDepthRules.Resolve in the shader: the wild's depth lerped to the location's, a berm's rise, the caps), times
// the static mask's depth multiplier (the coverage squared, the slope's taper - SnowContactRamp's ramp at bare edges),
// times what the tracks left (the dynamic mask's red, eroded by its four diagonal neighbours, focused toward the track's
// centre by ImpressionStrength; a body's hollow in its green), faded at the boundaries the material says - plus the
// coverage's 8 mm surface offset. The blanket rises by its vertex's own context instead; the middle ring morphs toward
// the blanket's surface over its outer band (104 to 120 m), so the two meet where the blanket takes over.
//
// THE FRAGMENT: discarded at the tier's edges (the ring's edge fade, the blanket's hole round the nearer tiers, the
// window's outer clip) and where the coverage is under 0.005; the albedo tiled over the world, 3% darker on a path,
// darkened by CompressionDarkening where the tracks pressed it (the deeper the snow, the darker, by a square root);
// the ring blends the far track mask in toward its edge. THE LIGHT IS THE GROUND'S: the mod lights its snow with the
// sun's Lambert over RenderSettings.ambientLight (its _TerrainAmbientLight - the terrain's own ambient); here the
// albedo goes into the ground's own fragment program in place of the tile (snowTerrainFs), so the snow takes every
// light the ground takes - the sun and its shadow map, the moon, the clouds' shadow, the lanterns, the fog - on either
// lane. Port-Ledger A, SNOWFALL1.

/** The attribute locations of a snow mesh: the mod's mesh channels (POSITION, NORMAL, TEXCOORD0..4, TANGENT). */
export const SNOW_ATTR = Object.freeze({ pos: 0, normal: 1, uv: 2, ctxA: 3, blanket: 4, ctxB: 5, ctxC: 6, blanketNormal: 7 });
/** The texture units the snow's five pictures take - above every unit the world programs reserve (0-15). */
export const SNOW_UNITS = Object.freeze({ dynamic: 16, static: 17, context: 18, far: 19, albedo: 20 });

/** The law both programs share: Resolve, one bounded read of a track mask, and what a track and a body leave. */
const SNOW_COMMON_GLSL = `
uniform vec4 uSnowDepths;     // _BaseSnowDepth (the wild's), _SettlementSnowDepth, _LocationMaximumSnowDepth, _PathMaximumSnowDepth
uniform vec4 uSnowLimits;     // _RoadBermRise, _WildernessMaximumDepth, _SettlementMaximumDepth, _CorpseRemainingDepth
uniform vec4 uSnowDynMap;     // _DynamicMaskMapping: the mask's origin x, z, 1 / its size; w >= 0.5 reads outside it as full snow
uniform vec4 uSnowStatMap;    // _StaticMaskMapping (the context mask shares it)
uniform vec4 uSnowFlags;      // _DynamicDepthEnabled, _BlanketSurface, _MorphToBlanket, _TrackImpressionStrength
uniform vec4 uSnowRadius;     // _SnowRadius, _EdgeFadeWidth, _SurfaceOffset, _TextureWorldSize
uniform vec4 uSnowInner;      // _InnerFadeCenter xz, _InnerFadeStart, _InnerFadeEnd
uniform vec4 uSnowOuter;      // _OuterClipCenter xz, _OuterClipStart, _OuterClipEnd
uniform sampler2D uSnowDynamic;
uniform sampler2D uSnowStatic;
uniform sampler2D uSnowContext;
// SnowDepthRules.Resolve: a context's depth - its settlement weight lerps the wild's depth to the location's, a road's
// berm rises it toward its ceiling, the authored locations' cap and the path's pull it down; an excluded one is none
float snowResolve(vec4 c) {
  if (c.x < 0.0) return 0.0;
  float d = uSnowDepths.x + c.x * (uSnowDepths.y - uSnowDepths.x);
  float ceil0 = uSnowLimits.y + c.x * (uSnowLimits.z - uSnowLimits.y);
  d += min(max(ceil0 - d, 0.0), c.w * uSnowLimits.x);
  vec2 l = d + c.yz * (min(vec2(d), uSnowDepths.zw) - d);
  return min(d, min(l.x, l.y));
}
// a track mask's red and green at uv, bounded (outside the mask, full snow) or clamped to its edge
vec2 snowBounded(vec2 t, vec2 uv, float bounded) {
  float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
  return bounded >= 0.5 ? mix(vec2(1.0), t, inside) : t;
}
// what is left of the snow's depth: a body's hollow leaves the corpse depth over the snow's (green), a track its red,
// focused toward the track's centre by ImpressionStrength - the lesser
float snowRemain(vec2 m, float depth) {
  float corpse = clamp(uSnowLimits.w / max(depth, 0.0001), 0.0, 1.0);
  corpse += m.y * (1.0 - corpse);
  float r = clamp(m.x, 0.0, 1.0);
  float track = r + clamp(uSnowFlags.w, 0.0, 1.0) * (1.0 - min(2.0 * (1.0 - r) * (1.0 - r), 1.0) - r);
  return min(corpse, track);
}
float snowStep(float t) { return t * t * (3.0 - 2.0 * t); }
`;

/** The vertex program (the DXBC's FORWARDBASE vertex shader). */
export const SNOW_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
layout(location=${SNOW_ATTR.pos}) in vec3 aPos;
layout(location=${SNOW_ATTR.normal}) in vec3 aNormal;
layout(location=${SNOW_ATTR.uv}) in vec2 aUV;
layout(location=${SNOW_ATTR.ctxA}) in vec4 aCtxA;              // TEXCOORD1: the vertex's own context (the blanket's corner A)
layout(location=${SNOW_ATTR.blanket}) in vec4 aBlanket;        // TEXCOORD2: the blanket's height, offset, and its corners' weights A and B
layout(location=${SNOW_ATTR.ctxB}) in vec4 aCtxB;              // TEXCOORD3
layout(location=${SNOW_ATTR.ctxC}) in vec4 aCtxC;              // TEXCOORD4
layout(location=${SNOW_ATTR.blanketNormal}) in vec3 aBlanketNormal;   // TANGENT: the blanket's normal
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec4 uSnowDynTexel;   // _DynamicMask_TexelSize
uniform float uSnowBoundaryFade;   // _BoundaryDepthFade
${SNOW_COMMON_GLSL}
vec2 snowDynAt(vec2 uv) { return snowBounded(textureLod(uSnowDynamic, uv, 0.0).rg, uv, uSnowDynMap.w); }
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vLocalXZ;
out vec4 vSnow;   // the grid's uv, the vertex's own depth, its path weight
void main() {
  bool blanket = uSnowFlags.y > 0.5, morph = uSnowFlags.z > 0.5;
  vec3 w3 = vec3(aBlanket.z, aBlanket.w, 1.0 - aBlanket.z - aBlanket.w);
  float vDepth = snowResolve(aCtxA);
  float pathW = clamp(aCtxA.z, 0.0, 1.0);
  if (morph) {
    vDepth = dot(w3, vec3(vDepth, snowResolve(aCtxB), snowResolve(aCtxC)));
    pathW = clamp(dot(w3, vec3(aCtxA.z, aCtxB.z, aCtxC.z)), 0.0, 1.0);
  }
  vec2 xz = (uModel * vec4(aPos, 1.0)).xz;
  vec2 dynUV = (xz - uSnowDynMap.xy) * uSnowDynMap.z;
  vec2 statUV = (xz - uSnowStatMap.xy) * uSnowStatMap.z;
  vec2 dyn = snowDynAt(dynUV);
  if (uSnowFlags.x >= 0.5) {   // the erosion: a track a texel wide is not lost between two vertices
    dyn = min(dyn, snowDynAt(dynUV + uSnowDynTexel.xy));
    dyn = min(dyn, snowDynAt(dynUV + uSnowDynTexel.xy * vec2(1.0, -1.0)));
    dyn = min(dyn, snowDynAt(dynUV + uSnowDynTexel.xy * vec2(-1.0, 1.0)));
    dyn = min(dyn, snowDynAt(dynUV - uSnowDynTexel.xy));
  }
  vec4 st = textureLod(uSnowStatic, statUV, 0.0);
  float depth = snowResolve(textureLod(uSnowContext, statUV, 0.0));
  float remain = 1.0 + uSnowFlags.x * (snowRemain(dyn, depth) - 1.0);
  float lifted = depth * clamp(st.r * 2.0, 0.0, 1.0) * remain;
  float fade = 1.0;
  if (uSnowRadius.y > 0.0) {   // the edge fade: the grid's own border
    vec2 e2 = min(aUV, 1.0 - aUV);
    fade = snowStep(clamp(2.0 * uSnowRadius.x * min(e2.x, e2.y) / uSnowRadius.y, 0.0, 1.0));
  }
  if (uSnowInner.z < uSnowInner.w) {
    vec2 d2 = abs(xz - uSnowInner.xy);
    fade *= snowStep(clamp((max(d2.x, d2.y) - uSnowInner.z) / (uSnowInner.w - uSnowInner.z), 0.0, 1.0));
  }
  vec2 o2 = abs(xz - uSnowOuter.xy);
  float outer = max(o2.x, o2.y) - uSnowOuter.z;
  float span = uSnowOuter.w - uSnowOuter.z;
  float outerFade = uSnowOuter.z < uSnowOuter.w ? 1.0 - snowStep(clamp(outer / span, 0.0, 1.0)) : 1.0;
  fade = 1.0 + uSnowBoundaryFade * (fade * outerFade - 1.0);
  float offset = st.g * uSnowRadius.z * st.a * fade;
  float y = aPos.y + (blanket ? vDepth : fade * lifted) + offset;
  vec3 n = aNormal;
  if (morph) {   // toward the blanket's surface over the ring's outer band
    float m = snowStep(clamp(outer / (span - 8.0), 0.0, 1.0));
    y += m * (vDepth + aBlanket.x + aBlanket.y + 0.002 - y);
    n = normalize(aNormal + m * (aBlanketNormal - aNormal));
  }
  vec4 world = uModel * vec4(aPos.x, y, aPos.z, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * n;
  vLocalXZ = world.xz;
  vSnow = vec4(aUV, vDepth, pathW);
  gl_Position = uProj * uView * world;
}`;

/** The fragment's snow - the DXBC's fragment shader up to its light - ending in `tex`, the colour the ground's light
 *  takes. `decode` wraps a picture's colour as the lane decodes its pictures. */
const snowFragment = (decode) => `  // SNOWFALL1: THE MOD'S SNOW IN PLACE OF THE TILE (DynamicSnow's fragment program); the light below is the ground's own
  vec4 sn = vSnow;
  bool blanket = uSnowFlags.y > 0.5, morph = uSnowFlags.z > 0.5;
  if (uSnowRadius.y > 0.0) {
    vec2 e2 = min(sn.xy, 1.0 - sn.xy);
    if (snowStep(clamp(2.0 * uSnowRadius.x * min(e2.x, e2.y) / uSnowRadius.y, 0.0, 1.0)) - 0.001 < 0.0) discard;
  }
  if (uSnowInner.z < uSnowInner.w) {
    vec2 d2 = abs(vWorldPos.xz - uSnowInner.xy);
    if (snowStep(clamp((max(d2.x, d2.y) - uSnowInner.z) / (uSnowInner.w - uSnowInner.z), 0.0, 1.0)) - 0.00001 < 0.0) discard;
  }
  vec2 o2 = abs(vWorldPos.xz - uSnowOuter.xy);
  float outer = max(o2.x, o2.y) - uSnowOuter.z;
  float span = uSnowOuter.w - uSnowOuter.z;
  if (uSnowOuter.z < uSnowOuter.w && 0.99999 - snowStep(clamp(outer / span, 0.0, 1.0)) < 0.0) discard;
  vec2 statUV = (vWorldPos.xz - uSnowStatMap.xy) * uSnowStatMap.z;
  vec4 st = texture(uSnowStatic, statUV);
  float coverage = st.g;
  if (blanket && st.b != 0.0) coverage = max(coverage, snowOnPath(st.b, statUV));
  vec4 ctx = texture(uSnowContext, statUV);
  float pathW = blanket ? sn.w : ctx.b;
  float depth = blanket ? sn.z : snowResolve(ctx);
  if (coverage - 0.005 < 0.0) discard;
  vec2 dynUV = (vWorldPos.xz - uSnowDynMap.xy) * uSnowDynMap.z;
  float remain = snowRemain(snowBounded(texture(uSnowDynamic, dynUV).rg, dynUV, uSnowDynMap.w), depth);
  if (morph) {   // the ring hands its tracks to the far mask, and its depth and path to its vertices', over its outer band
    float m = snowStep(clamp(outer / (span - 8.0), 0.0, 1.0));
    vec2 farUV = (vWorldPos.xz - uSnowFarMap.xy) * uSnowFarMap.z;
    float far = snowRemain(snowBounded(texture(uSnowFar, farUV).rg, farUV, 1.0), sn.z);
    remain += m * (far - remain);
    depth += m * (sn.z - depth);
    pathW += m * (sn.w - pathW);
  }
  vec3 albedo = ${decode('texture(uSnowAlbedo, vWorldPos.xz / max(uSnowRadius.w, 0.001)).rgb')} * (1.0 - clamp(pathW, 0.0, 1.0) * 0.03);
  float dd = clamp(depth * 1.3333334, 0.0, 1.0);
  dd = (dd + (sqrt(dd) - dd) * 0.25) * uSnowDarkening;
  vec3 tex = albedo * (1.0 - dd * (1.0 - remain));
`;

/** The fragment's own declarations: the law, the far mask and the albedo, and the blanket's path test (Basic Roads'
 *  track edge, as the blanket's static mask carries a path tile in its blue). */
const SNOW_FS_DECL = `precision highp sampler2D;   // the vertex program's samplers are the same uniforms, at its precision
in vec4 vSnow;
uniform vec4 uSnowFarMap;     // _FarTrackMapping
uniform float uSnowDarkening; // _CompressionDarkening
uniform sampler2D uSnowFar;
uniform sampler2D uSnowAlbedo;
${SNOW_COMMON_GLSL}
// BasicRoadsClassifier.PathEdgeDistance's sign, as the shader reads it: on a track tile's painted edge or inside it
float snowOnPath(float b, vec2 statUV) {
  float code = floor(b * 255.0 + 0.5);
  float rec = floor(code * 0.25);
  float turn = code - rec * 4.0;
  vec2 f = fract(clamp(statUV * 128.0, vec2(0.0), vec2(127.99999237060546875)));
  vec2 p = turn == 1.0 ? vec2(1.0 - f.x, f.y) : turn == 2.0 ? vec2(1.0 - f.y, 1.0 - f.x) : turn == 3.0 ? vec2(f.x, 1.0 - f.y) : f.yx;
  float x = p.y, y = p.x, d = 1.0;
  if (rec == 51.0 || rec == 52.0) d = abs(x - y) - 0.5;
  if (rec == 12.0 || rec == 27.0) d = y - x + 0.5;
  if (rec == 10.0 || rec == 25.0) d = y - x - 0.5;
  if (rec == 11.0 || rec == 26.0) d = 0.5 - x;
  return d <= 0.0 ? 1.0 : 0.0;
}
`;

const DECODE_FROM = '  vec2 unwrapped = vLocalXZ / uTileSize;\n';
const DECODE_TO = '  vec3 n = normalize(vNormal);\n';

/**
 * SNOWFALL1: a ground fragment program's SNOW variant - the same program, its tile decode (the tile array, the tilemap,
 * the ecotone, the bed) swapped for the mod's snow, so `tex` is the snow and every light after it is the ground's.
 * Made from either lane's terrain shader (TERRAIN_FS, EL_TERRAIN_FS: the lane decodes its pictures with elDecode).
 * @param {string} fs - a terrain fragment shader
 * @returns {string}
 */
export function snowTerrainFs(fs) {
  const from = fs.indexOf(DECODE_FROM), to = fs.indexOf(DECODE_TO);
  if (from < 0 || to < from || fs.indexOf(DECODE_FROM, from + 1) >= 0 || fs.indexOf(DECODE_TO, to + 1) >= 0) {
    throw new Error('SNOWFALL1: a terrain program decodes its tile in ONE span, from its unwrapped coordinate to its normal');
  }
  const main = fs.lastIndexOf('void main() {', from);
  if (main < 0) throw new Error('SNOWFALL1: the decode is inside main');
  const decode = fs.includes('elDecode(') ? (/** @type {string} */ t) => `elDecode(${t})` : (/** @type {string} */ t) => t;
  return fs.slice(0, main) + SNOW_FS_DECL + fs.slice(main, from) + snowFragment(decode) + fs.slice(to);
}

// @ts-check
// SNOWFALL1 (2026-10-08) - THE SNOW SURFACE. OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for
// everything") - OUR OWN GLSL, WRITTEN FROM THE EFFECT. One program draws the runtime's three tiers (the local window,
// the middle ring, the blanket). A vertex stands on the ground, raised by the snow's depth (systems/snowfall.js's law)
// times its coverage and what the tracks left, faded at the tier's edges. The fragment is our albedo, a path's snow
// trodden grey, a track packed darker and colder with its depth - in the ground's own fragment program in place of the
// tile (snowTerrainFs), so the snow takes every light the ground takes, on either lane. Port-Ledger A, SNOWFALL1.
// OWN-WORK4 AUDIT (2026-11-01): the vertex law is our design from what the snow must do (bible/03-World/Snowfall.md):
// a narrow track kept by the deepest press across the vertex's cell, a track's profile sharpened by an ease, the tiers'
// edges eased by a quintic, the ring landing on the blanket over three quarters of its band, our own layer offsets.
import { snowCoreGlsl, SNOW_TILE_M } from './snowCoverGlsl.js'; // AUDIT PRECIP GROUND-9: the ground's own snow, where this snow lies

/** The attribute locations of a snow mesh: position, normal, the grid's uv, three contexts, the blanket's target. */
export const SNOW_ATTR = Object.freeze({
  pos: 0,
  normal: 1,
  uv: 2,
  ctxA: 3,
  blanket: 4,
  ctxB: 5,
  ctxC: 6,
  blanketNormal: 7,
});
/** The texture units the snow's five pictures take - above every unit the world programs reserve (0-15). */
export const SNOW_UNITS = Object.freeze({ dynamic: 16, static: 17, context: 18, far: 19, albedo: 20 });
/** AUDIT ENVIRONS G2: the snow's polygon offset - one resolvable step and half its slope nearer the eye than the
 *  ground it lies on (OWN-WORK4 AUDIT: our values), so a snow surface standing at the ground's own height - a contact
 *  ramp's first texel, a faded rim - is the snow's and not a speckle of both. Under the sea's film
 *  (render/waterSurface.js WATER_LAYER_UNITS), a layer of the one stack. */
export const SNOW_LAYER = Object.freeze({ factor: -0.5, units: -1 });

/** SNOW-TELL (2026-10-11, from play: "Can't see any boss ground attack overlays with heavy snow"): the most a tier's
 *  surface stands over the ground under it, from the tier's own uniforms (systems/snowfallRuntime.js depthUniforms and
 *  its tier's `radius`) - snowResolve's highest answer (the wild's depth or the settlement's, whichever is deeper, and
 *  a road's berm over it; the caps and the path only pull it down), never more than SNOW_VS lifts it (the slope's
 *  multiplier and the tracks only lessen it), and the surface offset over that. A foe's telegraph lies this far over
 *  its ground while the snow is drawn (render/foeTelegraph.js telegraphLift), so the snow cannot bury it. */
export const snowSurfaceRise = (u) =>
  Math.max(0, u.depths[0], u.depths[1]) + Math.max(0, u.limits[0]) + Math.max(0, u.radius[2]);

/** AUDIT PRECIP GROUND-9: the frame the ground's own snow is read in on this surface - the scene point of the snow
 *  window's first world tile (renderer.js setSnowFrame's `anchor`; the tile itself is uEcoOrigin: the terrain program
 *  declares it in its ecotone, the vertex program beside this). */
const SNOW_LAID_DECL = 'uniform vec2 uSnowAnchor;';
const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

/** The law both programs share: Resolve, one bounded read of a track mask, and what a track and a body leave. */
const SNOW_COMMON_GLSL = `
uniform vec4 uSnowDepths;     // the wild's depth, a settlement's, the cap at a location, the cap on a path
uniform vec4 uSnowLimits;     // a road's berm, the wild's ceiling, a settlement's ceiling, what is left under a body
uniform vec4 uSnowDynMap;     // the track mask's origin x, z, 1 / its size; w >= 0.5 reads outside it as full snow
uniform vec4 uSnowStatMap;    // the static mask's frame (the context mask shares it)
uniform vec4 uSnowFlags;      // tracks read, a blanket tier, a ring that bends onto the blanket, how sharp a track is
uniform vec4 uSnowRadius;     // the tier's radius, its edge's fade, the surface offset, the albedo's tile in metres
uniform vec4 uSnowInner;      // the hole round a nearer tier: its centre xz, where it starts and ends
uniform vec4 uSnowOuter;      // the tier's outer clip: its centre xz, where it starts and ends
uniform sampler2D uSnowDynamic;
uniform sampler2D uSnowStatic;
uniform sampler2D uSnowContext;
// a context's depth (systems/snowfall.js resolveSnowDepth's law): its settlement weight lerps the wild's depth to the
// location's, a road's berm rises it toward its ceiling, the caps pull it down; an excluded one is none
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
// what is left of the snow's depth: under a body (green) the setting's depth stays; a track (red) is the stored profile
// eased toward a narrower, deeper centre and higher shoulders as tracks are made sharper (uSnowFlags.w) - the lesser
float snowRemain(vec2 m, float depth) {
  float body = mix(min(1.0, uSnowLimits.w / max(depth, 0.0001)), 1.0, m.y);
  float r = clamp(m.x, 0.0, 1.0);
  float track = mix(r, r * r * (3.0 - 2.0 * r), clamp(uSnowFlags.w, 0.0, 1.0));
  return min(body, track);
}
// our ease for every edge of a tier: a quintic, flat at both ends, so no fade shows a crease
float snowEase(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
// how far past a square band's start a point is (the tiers are squares about a centre: b.xy, the band b.z to b.w)
float snowPast(vec2 p, vec4 b) {
  vec2 d = abs(p - b.xy);
  return max(d.x, d.y) - b.z;
}
float snowBand(vec2 p, vec4 b) { return snowEase(snowPast(p, b) / (b.w - b.z)); }
// the ring lands on the blanket over the first three quarters of its outer band
float snowLanding(float past, float span) { return snowEase(past / (0.75 * span)); }
// on a track tile's painted edge or inside it (the blanket's static mask carries a path tile in its blue) - the
// vertex's surface offset and the fragment's coverage both
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

/** The vertex program. */
export const SNOW_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
layout(location=${SNOW_ATTR.pos}) in vec3 aPos;
layout(location=${SNOW_ATTR.normal}) in vec3 aNormal;
layout(location=${SNOW_ATTR.uv}) in vec2 aUV;
layout(location=${SNOW_ATTR.ctxA}) in vec4 aCtxA;              // the vertex's own context (the blanket's corner A)
layout(location=${SNOW_ATTR.blanket}) in vec4 aBlanket;        // the blanket's height, offset, and its corners' weights A and B
layout(location=${SNOW_ATTR.ctxB}) in vec4 aCtxB;              // the blanket's corner B
layout(location=${SNOW_ATTR.ctxC}) in vec4 aCtxC;              // and C
layout(location=${SNOW_ATTR.blanketNormal}) in vec3 aBlanketNormal;   // the blanket's normal
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec4 uSnowDynTexel;   // the track mask's texel
uniform float uSnowBoundaryFade;   // how much the tier's edges fade its depth
${SNOW_COMMON_GLSL}
${SNOW_LAID_DECL}
uniform highp ivec3 uEcoOrigin;   // the snow window's first world tile (the terrain's ecotone frame), z unread
${snowCoreGlsl()}
vec2 snowDynAt(vec2 uv) { return snowBounded(textureLod(uSnowDynamic, uv, 0.0).rg, uv, uSnowDynMap.w); }
// a track narrower than the grid's step still shows: the deepest press across the vertex's own cell - its point and
// the four along the axes a texel out
vec2 snowPressed(vec2 uv) {
  vec2 t = uSnowDynTexel.xy;
  vec2 m = min(snowDynAt(uv), snowDynAt(uv + vec2(t.x, 0.0)));
  m = min(m, snowDynAt(uv - vec2(t.x, 0.0)));
  m = min(m, snowDynAt(uv + vec2(0.0, t.y)));
  return min(m, snowDynAt(uv - vec2(0.0, t.y)));
}
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
  vec4 ground = uModel * vec4(aPos, 1.0);
  vec2 xz = ground.xz;
  // AUDIT PRECIP GROUND-9: laid only where the ground wears snow - its own cover at the vertex (snowLaid: 1 off the snow
  // lane) taken as the static mask's coverage is: the depth by its square (staticSnowMultiplier's), the offset by it
  float laid = snowLaid(xz - uSnowAnchor, ground.y, vec2(0.0), vec2(0.0));
  vDepth *= laid * laid;
  vec2 dynUV = (xz - uSnowDynMap.xy) * uSnowDynMap.z;
  vec2 statUV = (xz - uSnowStatMap.xy) * uSnowStatMap.z;
  vec4 st = textureLod(uSnowStatic, statUV, 0.0);
  float lifted = 0.0;
  if (!blanket) {   // AUDIT ENVIRONS G8: the blanket rises by its vertex's own context - the masks' depth and tracks are the window's and the ring's
    float depth = snowResolve(textureLod(uSnowContext, statUV, 0.0));
    float remain = 1.0;
    if (uSnowFlags.x != 0.0) {   // what the tracks left (with tracks off, the mask's read changes nothing)
      vec2 dyn = uSnowFlags.x >= 0.5 ? snowPressed(dynUV) : snowDynAt(dynUV);
      remain = mix(1.0, snowRemain(dyn, depth), uSnowFlags.x);
    }
    lifted = depth * clamp(st.r * 2.0, 0.0, 1.0) * laid * laid * remain;
  }
  float fade = 1.0;
  if (uSnowRadius.y > 0.0) {   // the edge fade: metres in from the grid's own border, over the fade's width
    vec2 e2 = min(aUV, 1.0 - aUV) * 2.0 * uSnowRadius.x;
    fade = snowEase(min(e2.x, e2.y) / uSnowRadius.y);
  }
  if (uSnowInner.z < uSnowInner.w) fade *= snowBand(xz, uSnowInner);   // the hole round a nearer tier
  float past = snowPast(xz, uSnowOuter);
  float span = uSnowOuter.w - uSnowOuter.z;
  float outerFade = uSnowOuter.z < uSnowOuter.w ? 1.0 - snowBand(xz, uSnowOuter) : 1.0;
  fade = mix(1.0, fade * outerFade, uSnowBoundaryFade);
  float cover = st.g;   // AUDIT ENVIRONS G9: the coverage the surface offset stands on - on the blanket, a painted track edge's too (the fragment's test)
  if (blanket && st.b != 0.0) cover = max(cover, snowOnPath(st.b, statUV));
  cover *= laid;
  float offset = cover * uSnowRadius.z * st.a * fade;
  float y = aPos.y + (blanket ? vDepth : fade * lifted) + offset;
  vec3 n = aNormal;
  if (morph) {   // onto the blanket's surface (its own offset over it) as the ring's outer band is crossed
    float m = snowLanding(past, span);
    y = mix(y, vDepth + aBlanket.x + aBlanket.y + uSnowRadius.z, m);
    n = normalize(mix(aNormal, aBlanketNormal, m));
  }
  vec4 world = uModel * vec4(aPos.x, y, aPos.z, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * n;
  vLocalXZ = world.xz;
  vSnow = vec4(aUV, vDepth, pathW);
  gl_Position = uProj * uView * world;
}`;

/** OWN-WORK4 AUDIT: the albedo's second read - a turn (column-major mat2), a scale of 1 / phi^2 (no whole number of
 *  tiles is a whole number of its own), a shift, and its share of the colour. */
export const SNOW_ALBEDO_SECOND = Object.freeze({
  turn: Object.freeze([0.8, 0.6, -0.6, 0.8]),
  scale: 0.381966,
  shift: Object.freeze([0.37, 0.71]),
  share: 0.4,
});

/** The fragment's snow, ending in `tex`, the colour the ground's light takes. `decode` wraps a picture's colour as the
 *  lane decodes its pictures. */
const snowFragment = (
  decode,
) => `  // SNOWFALL1 / OWN-WORK4: OUR SNOW IN PLACE OF THE TILE; the light below is the ground's own
  vec4 sn = vSnow;
  bool blanket = uSnowFlags.y > 0.5, morph = uSnowFlags.z > 0.5;
  // AUDIT ENVIRONS G10: the albedo's footprint, taken before the first discard (a derivative beside a discarded fragment
  // is undefined in GLSL ES 3.00 - the CLIP_AFTER law): its mip is the one its whole quad picks
  vec2 albedoUV = vWorldPos.xz / max(uSnowRadius.w, 0.001);
  vec2 albedoDx = dFdx(albedoUV), albedoDy = dFdy(albedoUV);
  // AUDIT PRECIP GROUND-9: the ground's own cover's frame and footprint (tiles a pixel), taken with the albedo's
  vec2 snowAt = vWorldPos.xz - uSnowAnchor;
  vec2 snowGx = dFdx(snowAt / ${f(SNOW_TILE_M)}), snowGy = dFdy(snowAt / ${f(SNOW_TILE_M)});
  if (uSnowRadius.y > 0.0) {
    vec2 e2 = min(sn.xy, 1.0 - sn.xy) * 2.0 * uSnowRadius.x;
    if (snowEase(min(e2.x, e2.y) / uSnowRadius.y) < 0.001) discard;
  }
  if (uSnowInner.z < uSnowInner.w && snowBand(vWorldPos.xz, uSnowInner) < 0.00001) discard;
  float past = snowPast(vWorldPos.xz, uSnowOuter);
  float span = uSnowOuter.w - uSnowOuter.z;
  if (uSnowOuter.z < uSnowOuter.w && snowBand(vWorldPos.xz, uSnowOuter) > 0.99999) discard;
  // AUDIT ENVIRONS G8: the masks have one level each - read at it (textureLod), the read's place free of the discards above
  vec2 statUV = (vWorldPos.xz - uSnowStatMap.xy) * uSnowStatMap.z;
  vec4 st = textureLod(uSnowStatic, statUV, 0.0);
  float coverage = st.g;
  if (blanket && st.b != 0.0) coverage = max(coverage, snowOnPath(st.b, statUV));
  coverage *= snowLaid(snowAt, vWorldPos.y, snowGx, snowGy);   // AUDIT PRECIP GROUND-9: where the ground wears it
  if (coverage - 0.005 < 0.0) discard;
  vec4 ctx = blanket ? vec4(0.0) : textureLod(uSnowContext, statUV, 0.0);   // the blanket's depth and path are its vertices'
  float pathW = blanket ? sn.w : ctx.b;
  float depth = blanket ? sn.z : snowResolve(ctx);
  vec2 dynUV = (vWorldPos.xz - uSnowDynMap.xy) * uSnowDynMap.z;
  float remain = snowRemain(snowBounded(textureLod(uSnowDynamic, dynUV, 0.0).rg, dynUV, uSnowDynMap.w), depth);
  if (morph) {   // the ring hands its tracks to the far mask, and its depth and path to its vertices', over its outer band
    float m = snowLanding(past, span);
    if (m > 0.0) {   // inside the band's start the hand-off is none: the far mask unread
      vec2 farUV = (vWorldPos.xz - uSnowFarMap.xy) * uSnowFarMap.z;
      float far = snowRemain(snowBounded(textureLod(uSnowFar, farUV, 0.0).rg, farUV, 1.0), sn.z);
      remain += m * (far - remain);
      depth += m * (sn.z - depth);
      pathW += m * (sn.w - pathW);
    }
  }
  // OWN-WORK4 AUDIT: the albedo read again, turned and at a scale no whole number of tiles meets (SNOW_ALBEDO_SECOND),
  // its footprint the first's turned the same - a field of snow never shows the tile's repeat
  mat2 turn = mat2(${SNOW_ALBEDO_SECOND.turn.map(f).join(', ')}) * ${f(SNOW_ALBEDO_SECOND.scale)};
  vec2 turnUV = turn * albedoUV + vec2(${SNOW_ALBEDO_SECOND.shift.map(f).join(', ')});
  vec3 second = ${decode('textureGrad(uSnowAlbedo, turnUV, turn * albedoDx, turn * albedoDy).rgb')};
  // OWN-WORK4: a path's snow trodden 5% grey; a track packed - darker, and colder, as the snow it pressed was deep
  vec3 albedo = mix(${decode('textureGrad(uSnowAlbedo, albedoUV, albedoDx, albedoDy).rgb')}, second, ${f(SNOW_ALBEDO_SECOND.share)}) * (1.0 - clamp(pathW, 0.0, 1.0) * 0.05);
  float packed = (1.0 - remain) * smoothstep(0.0, 0.75, depth) * uSnowDarkening;
  vec3 tex = albedo * (1.0 - packed) * mix(vec3(1.0), vec3(0.94, 0.97, 1.03), clamp(packed * 4.0, 0.0, 1.0));
`;

/** The fragment's own declarations: the law (the blanket's path test with it), the far mask and the albedo. */
const SNOW_FS_DECL = `precision highp sampler2D;   // the vertex program's samplers are the same uniforms, at its precision
in vec4 vSnow;
${SNOW_LAID_DECL}
uniform vec4 uSnowFarMap;     // the far track mask's frame
uniform float uSnowDarkening; // how dark a pressed track is (the Visual.CompressionDarkening setting)
uniform sampler2D uSnowFar;
uniform sampler2D uSnowAlbedo;
${SNOW_COMMON_GLSL}
`;

const DECODE_FROM = '  vec2 unwrapped = vLocalXZ / uTileSize;\n';
const DECODE_TO = '  vec3 n = normalize(vNormal);\n';

/**
 * SNOWFALL1: a ground fragment program's SNOW variant - the same program, its tile decode (the tile array, the tilemap,
 * the ecotone, the bed) swapped for our snow, so `tex` is the snow and every light after it is the ground's.
 * Made from either lane's terrain shader (TERRAIN_FS, EL_TERRAIN_FS: the lane decodes its pictures with elDecode).
 * @param {string} fs - a terrain fragment shader
 * @returns {string}
 */
export function snowTerrainFs(fs) {
  const from = fs.indexOf(DECODE_FROM),
    to = fs.indexOf(DECODE_TO);
  if (from < 0 || to < from || fs.indexOf(DECODE_FROM, from + 1) >= 0 || fs.indexOf(DECODE_TO, to + 1) >= 0) {
    throw new Error(
      'SNOWFALL1: a terrain program decodes its tile in ONE span, from its unwrapped coordinate to its normal',
    );
  }
  const main = fs.lastIndexOf('void main() {', from);
  if (main < 0) throw new Error('SNOWFALL1: the decode is inside main');
  const decode = fs.includes('elDecode(')
    ? (/** @type {string} */ t) => `elDecode(${t})`
    : (/** @type {string} */ t) => t;
  return fs.slice(0, main) + SNOW_FS_DECL + fs.slice(main, from) + snowFragment(decode) + fs.slice(to);
}

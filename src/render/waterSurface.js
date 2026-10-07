// @ts-check
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
// WHICH TEXEL IS WATER. The tile byte says, through the 256-entry
// table of WATER CORNERS in world/waterCorners.js (MAC2 lifted it out of
// this file: the player's feet read the same table now, so where this
// pass draws water the player swims). The coverage inside a tile is
// the bilinear blend of its corners - the diagonal the shore tile's own
// art follows - feathered by SHORE_SOFTNESS.
import { WATER_DRAW_MASK_TABLE } from '../world/waterCorners.js';
import { PUDDLE_RECORDS } from '../world/puddleMask.js';   // WATER-PUDDLE: the records whose water is their art's   // MAC2: the corner table is a leaf the player's feet share; WATER-DRAW1: the DRAW's half of it - the feet's is the law's own table, and the two are not the same question
import { WIND_ROW_CALM, WIND_ROW_SPAN } from '../systems/wind.js';
import { getPref } from '../systems/uiPrefs.js';   // FT6: the switch, read here alone
import { isEnhanced } from '../systems/uiSkin.js';
import { FOG_GLSL } from './fogGlsl.js';   // AUDIT 68 S17-fog-glsl-dup: the fog every world pass takes, one home
import { pageParam } from '../systems/pageQuery.js';
import { RIPPLE_CELLS, RIPPLE_SCALE } from '../world/waterRipples.js';   // WATER-NEXT 4: the ripple field the shader reads   // PERF-URL: the page's query, parsed once a search

/** FT6 (2026-09-14, the Features arc): THE SWITCH, ONE HOME. Both
 *  exterior hosts composed "the enhanced skin, the pref, the kill door"
 *  inline, word for word - two copies of one law. This is the copy:
 *  the enhanced skin (the classic lane draws DFU's flat tile), the
 *  Enhanced water pref, and `?water=off` as the kill door. A town host
 *  still asks tilemapRectHasWater beside it - that is the town's, not
 *  the switch's. */
export function waterSwitchOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('enhancedWater') && pageParam('water', search) !== 'off';   // PERF-URL
}

// ═══════════════════════════════════════════════════════════════════
// FIELD BUGS 2026-09-29 (the sea) #4 (the Discord, through Mac: "Water flickers from a distance"): THE WATER'S LAYERS
// IN WINDOW DEPTH. The sea is a stack of sheets a few centimetres apart: the ground under it (the beach at the sea's
// own 34 m, Iliac Puddle No More's carved floor at least 5 cm under it), the sea's surface film over that (Iliac Puddle
// No More's top 3 cm up, SurfaceRenderYOffset; WATER1 a hand's breadth over the ground it lies on), and Come Sail Away's
// breakers 10 cm up (WAVE_LIFT). Unity draws them on a reversed, floating-point depth buffer that parts a centimetre
// at any range; this port's world pass is the GL convention's - a 24-bit buffer, the near plane 0.2 m out - where a
// step of depth is z^2 / (0.2 x 2^24) metres of eye depth: 3 mm at 100 m, 30 cm at 1 km. Seen from a raised eye a
// sheet 3 cm over another is a fraction of a step apart at a few hundred metres, and which of the two a pixel shows is
// the rounding's, which moves with every centimetre the deck bobs the camera: the far beach and the breakers flicker
// (tools/fbseaWaterProbe.mjs measures it on a real pipeline). WATER1 met the same law first and took a polygon offset
// (renderer.js, WATER-AUDIT M3): a nudge in WINDOW depth, so worth one resolvable step at every distance, never a lift
// in metres that is worth nothing past a few hundred. Every sheet of the stack takes it now, in the order the sheets
// stand in, from this one table:
//
//   the ground and the floor .......... 0 (opaque, written)
//   the surface film (the top, WATER1)  SURFACE: it covers what lies under it by two steps
//   Come Sail Away's breakers ......... BREAKERS: they stand over the film by four more - they write their depth, and
//                                       the film is drawn after them and tested against it
//
// The CONSTANT term only (WATER-AUDIT M3's reason: a slope factor grows with the sheet's own depth slope, hundreds of
// units a pixel at a grazing look, and would pull the water in front of a hull or a shore standing above it). What a
// step of bias costs: a sheet shows through what stands within that many steps in front of it - under a millimetre
// at 100 m, and at a kilometre a hull's waterline creeps up by a few centimetres, a fraction of the one pixel it is.
// ═══════════════════════════════════════════════════════════════════

/** polygonOffset's units (constant term, factor 0) for each sheet of the sea, the ground's 0 under them. */
export const WATER_LAYER_UNITS = Object.freeze({
  /** The sea's surface film: Iliac Puddle No More's top and WATER1 - never both over one texel (DW-F). */
  surface: -2,
  /** Come Sail Away's breakers: opaque, written, and drawn before the film - so the film tests against them. */
  breakers: -6,
});

/** How far above the ground the surface is drawn, in world units (a
 *  tile is 6.4). Enough to clear the depth test on a slope, too little
 *  to read as a step at the shore. */
export const WATER_LIFT = 0.08;
/** The surface's base opacity; Fresnel raises it toward grazing. MAC2
 *  (2026-09-11, Mac: "I wish the water was darker and not as see
 *  through"): 0.82 -> 0.94, so the terrain pass's flat tile beneath
 *  barely shows. */
export const WATER_OPACITY = 0.94;
/** The classic water texel's tint under the surface - a deep blue-green
 *  multiplier, so the tile's own palette colour reads as the body of the
 *  water and not as a floor seen through it. MAC2: darkened from
 *  0.62/0.78/0.86 - the body is the water's depth now, not its floor. */
export const WATER_TINT = Object.freeze([0.36, 0.50, 0.60]);
/** Schlick's F0 for water (n = 1.33). */
export const WATER_F0 = 0.02;
/** Half-width of the shore feather, in coverage (0.5 is the diagonal). */
export const SHORE_SOFTNESS = 0.16;
/** The classic texel's slow flow, in tiles per second. AUDIT 65 CV-3:
 *  the ONE home for the rate - scenes/dungeon.js and scenes/worldModes.js
 *  import it, so a river and a dungeon pool crawl alike. */
export const WATER_SCROLL_TILES_PER_SEC = 0.05;
/** The sky the surface reflects when no sky says otherwise (a test, a
 *  lab without a dome): a plain day. */
export const DEFAULT_SKY_ZENITH = Object.freeze([0.17, 0.35, 0.72]);
export const DEFAULT_SKY_HORIZON = Object.freeze([0.66, 0.78, 0.92]);

/** WATER-AUDIT: does a sub-rectangle of a `dim`-wide tilemap carry any
 *  water? The fixed city pads its square tilemap with zeros past the
 *  location's real extent, and zero converts to water, so the whole map
 *  answered yes for every non-square town (AUDIT 65 MC-6: the one gate -
 *  the whole-map twin it replaced had no caller left and is retired). */
export function tilemapRectHasWater(bytes, dim, width, height, table = WATER_DRAW_MASK_TABLE) {
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
export function buildWaterIndices(bytes, stride = 1, table = WATER_DRAW_MASK_TABLE, tileDim = 128, width = tileDim, height = tileDim) {
  const g = width / stride + 1;   // WATER-NEXT 2: a grid `width` x `height` tiles (the fixed town's), `tileDim` a row
  const qx = g - 1, qz = height / stride;
  const out = [];
  for (let z = 0; z < qz; z++) {
    for (let x = 0; x < qx; x++) {
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
    swell: swellAmplitude(s),   // WATER-NEXT 2: the sheet's swell, the wind's
    absorb: WATER_ABSORB,
  };
}

// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE SWELL (2026-10-07, Mac: "real translucent water with proper waves"; asked, the waves "modest,
// weather-driven"): THE SHEET MOVES. WATER1's waves were a normal map on a still sheet; the sheet now rides three
// long trains - one down the wind, two crossing it - whose height the vertex shader lifts the sheet by and whose slope
// the fragment shader lights, ONE field (SWELL_GLSL, written from SWELL_TRAINS, and swellAt below for the CPU: a boat
// bobs on the height the eye sees). The trains run at deep water's own speed (omega = sqrt(g k), a unit a metre) and
// none is shorter than four of the sheet's 6.4-unit cells, so the grid carries it without facets. Over the bank the
// swell dies (the bed's depth fades it - water never lifts off its shore), and its height is the WIND's: a calm pond
// barely breathes, a gale heaves. The fine ripples and the rain stay WATER1's normal map (waveGradient).
// ═══════════════════════════════════════════════════════════════════

/** The swell's trains: [angle off the wind (radians), wavelength (units), share of the amplitude]. */
export const SWELL_TRAINS = Object.freeze([
  Object.freeze([0.0, 48.0, 0.55]),
  Object.freeze([0.54, 31.0, 0.28]),
  Object.freeze([-0.75, 25.6, 0.17]),
]);
/** g for the trains' speed, in units a second squared (a unit is a metre). */
export const SWELL_G = 9.8;
/** The swell's height (the sum of the trains' amplitudes, units) at a calm and at a gale, between them the wind's. */
export const SWELL_CALM = 0.05;
export const SWELL_GALE = 0.34;
/** The bed depth (units) over which the swell grows from nothing at the bank to its whole height. */
export const SWELL_DEPTH = 2.5;
/** The swell's height for a wind strength 0..1. */
export const swellAmplitude = (windStrength01) => SWELL_CALM + (SWELL_GALE - SWELL_CALM) * Math.min(1, Math.max(0, windStrength01));

/** The swell at a world point, the shader's own sum: [height, d/dx, d/dz]. `windDir` a unit [x, z]. */
export function swellAt(x, z, t, windDir, amplitude) {
  let h = 0, gx = 0, gz = 0;
  for (const [ang, len, share] of SWELL_TRAINS) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = c * windDir[0] - s * windDir[1], dz = s * windDir[0] + c * windDir[1];
    const k = (2 * Math.PI) / len, w = Math.sqrt(SWELL_G * k), a = amplitude * share;
    const ph = k * (dx * x + dz * z) - w * t;
    h += a * Math.sin(ph);
    gx += a * k * Math.cos(ph) * dx;
    gz += a * k * Math.cos(ph) * dz;
  }
  return [h, gx, gz];
}

/** The same sum in GLSL - the vertex shader's lift and the fragment shader's slope, one text. */
export const SWELL_GLSL = `
vec3 swellAt(vec2 p, float t, vec2 wind, float amp) {
  vec3 r = vec3(0.0);
${SWELL_TRAINS.map(([ang, len, share]) => {
    const k = (2 * Math.PI) / len, w = Math.sqrt(SWELL_G * k), f = (v) => `(${v.toFixed(6)})`;
    return `  { vec2 d = vec2(${f(Math.cos(ang))} * wind.x - ${f(Math.sin(ang))} * wind.y, ${f(Math.sin(ang))} * wind.x + ${f(Math.cos(ang))} * wind.y);
    float ph = ${k.toFixed(6)} * dot(d, p) - ${w.toFixed(6)} * t; float a = amp * ${share.toFixed(4)};
    r += vec3(a * sin(ph), (a * ${k.toFixed(6)} * cos(ph)) * d); }`;
  }).join('\n')}
  return r;
}`;

// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE BODY: water is a depth of something that swallows light, red first. What lies under it is seen
// through it by Beer-Lambert - exp(-WATER_ABSORB * path), the path the eye's through the water - and where the light is
// swallowed the water's own colour stands (the climate's water texel, averaged, tinted - a swamp's water is a swamp's).
// A hand's depth is clear, a man's depth green-blue, a lake's heart and the sea dark: Mac's MAC2 water, "darker and
// not as see through", is the deep water's, and the shallows are glass.
// ═══════════════════════════════════════════════════════════════════

/** Beer-Lambert's absorption, per unit of path, red, green, blue. */
export const WATER_ABSORB = Object.freeze([0.55, 0.30, 0.22]);
/** How far the refracted look is pushed by the waves' slope, in screen fractions at a unit of depth. */
export const REFRACT_STRENGTH = 0.035;
/** The depth a sheet without a bed stands for (a one-tile stream, the water on ground that was never carved): shallow,
 *  tinted, and never a shore - the renderer's constant for attribute 1 when the sheet has no depths of its own. */
export const NO_BED_DEPTH = 1.2;
/** The path, in units, past which the water is taken as deep everywhere it cannot measure itself (the open sea
 *  without a depth copy). */
export const OPEN_PATH = 60.0;
// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 3 - THE SHORE (Mac: "shoreline interactivity"): WHERE THE WATER RUNS OUT, IT BREAKS. A band of foam where
// the water is shallow - FOAM_DEPTH of it, wider in a wind - pushed up the bank by the swell's crest and drawn back by
// its trough (the run-up: the band's edge rides the swell's own height), cut into lace by a noise that drifts down the
// wind; and on open water in a strong wind, where the swell is steep, its crests whiten. Lit by the light the water
// is, never glowing. One field with the waves: no sprite, no second sheet.
// ═══════════════════════════════════════════════════════════════════

/** The water depth (units, vertical) over which the shore's foam fades out, at a calm; a gale doubles it. */
export const FOAM_DEPTH = 0.22;
/** How far the swell's height pushes the foam's edge up and down the bank, in multiples of that height. */
export const FOAM_RUNUP = 2.2;
/** The swell's slope past which a crest whitens, at a gale (never below a strong wind). */
export const CREST_SLOPE = 0.075;

/** The texture units the scene's copy rides (bound before every water draw, never trusted to persist - inside
 *  Dynamic Skies' nine and under the lane's own, as BB_SURFACE_UNIT). */
export const WATER_SCENE_UNIT = 7;
/** WATER-NEXT 4: the ripple field's unit - 1, the billboards' emission unit, its shadow forgotten after the bind. */
export const WATER_RIPPLE_UNIT = 1;
export const WATER_SCENE_DEPTH_UNIT = 6;

/** WATER-NEXT 2: the sheet - the grid AS IT STOOD before the bed was carved under it (world/waterBed.js), its bed's
 *  depth on attribute 1, lifted WATER_LIFT and heaved by the swell. The open sea's sheet (Deep Waters' top, `uOpen`)
 *  has no bed attribute - a constant - and swells everywhere. */
export const WATER_SURFACE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in float aDepth;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLift;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uSwell;
uniform int uOpen;
out vec3 vWorldPos;
out vec2 vLocalXZ;
out float vDepth;
out float vGrow;
${SWELL_GLSL}
void main() {
  vec4 world = uModel * vec4(aPos.x, aPos.y + uLift, aPos.z, 1.0);
  float grow = uOpen == 1 ? 1.0 : smoothstep(0.0, ${SWELL_DEPTH.toFixed(2)}, aDepth);
  vec3 sw = swellAt(world.xz, uTime, uWindDir, uSwell * grow);
  world.y += sw.x;
  vWorldPos = world.xyz;
  vLocalXZ = aPos.xz;
  vDepth = max(aDepth + sw.x, 0.0);
  vGrow = grow;
  gl_Position = uProj * uView * world;
}`;

/**
 * WATER-NEXT 2: the water's fragment shader, with the renderer's cloud-shadow block interpolated (a GLSL declaration
 * is visible only to the compilation unit that carries it - the EE5 lesson in renderer.js).
 *
 * WHERE: the terrain's water, a texel at a time - WATER1's corner table, its shore feather and WATER-PUDDLE's art
 * mask, unchanged - or, under `uOpen`, the whole sheet (Deep Waters' sea).
 * THE SLOPE: the swell's (the vertex shader's own field, per pixel) and WATER1's fine trains and rain.
 * THE PATH through the water: the scene's depth copy where the frame has one (the bed's own distance behind the
 * surface, so a boat's hull or a rock in a pond is where it is), else the bed's depth over the view's slant.
 * THE LOOK: what lies under the surface - the scene's colour copy, pushed by the waves' slope (never by a thing in
 * front of the water: a pushed look that lands on something nearer than the surface takes the straight look) - through
 * Beer-Lambert, the water's own lit colour where the light is swallowed, the sky reflected by Fresnel, the sun's, the
 * moon's and the lamps' glints, the fog. Without a copy (the classic lane's frame), the blend does the same sum: the
 * ground under the sheet is drawn, and the sheet's alpha is how much of it the water hides.
 */
export const waterSurfaceFs = (cloudShadowGlsl, shadowGlsl = '') => `#version 300 es   // EL7: with SHADOW_GLSL the water receives the lane's sun shadow
precision highp float;
precision highp int;   // WATER-NEXT 2: uOpen is the vertex stage's too - an int's precision must agree across the two
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vWorldPos;
in vec2 vLocalXZ;
in float vDepth;
in float vGrow;
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform float uTileSize;
uniform int uTileDim;          // WATER-AUDIT: the tilemap's side (128 in the world, the town's own in the fixed city)
uniform uvec4 uWaterMask[8];   // WATER1: 256 nibbles - converted tile byte -> water corners
uniform int uOpen;             // WATER-NEXT 2: the open sea's sheet - no tilemap, all water
uniform vec3 uOpenColor;       // and the mod's tint over its water's colour
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;   // 0..1 on the sky's row scale
uniform float uSwell;
uniform float uRain;           // 0..1, the front's intensity
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
uniform float uF0;
uniform float uShoreSoft;
uniform vec3 uAbsorb;
uniform int uSceneOn;          // WATER-NEXT 2: the frame's colour and depth, copied before the water (Renderer.captureUnderWater)
uniform sampler2D uScene;
uniform sampler2D uSceneDepth;
uniform vec2 uSceneSize;
uniform mat4 uProj;
uniform int uRippleOn;         // WATER-NEXT 4: the ripple field round the camera (world/waterRipples.js)
uniform sampler2D uRipple;
uniform vec3 uRippleRect;      // its corner's world x, z and its side
${cloudShadowGlsl}
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${shadowGlsl}
out vec4 outColor;
${FOG_GLSL}
${SWELL_GLSL}
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
// WATER-PUDDLE: a tile's turn as TERRAIN_FS applies it (render/renderer.js - DFU's row-major initializers transposed)
const mat2 PUDDLE_ROT[4] = mat2[4](mat2(1.0, 0.0, 0.0, 1.0), mat2(0.0, -1.0, 1.0, 0.0), mat2(-1.0, 0.0, 0.0, -1.0), mat2(0.0, 1.0, -1.0, 0.0));
const vec2 PUDDLE_TRANS[4] = vec2[4](vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));
bool isPuddleRecord(uint r) { return ${PUDDLE_RECORDS.map((r) => `r == ${r}u`).join(' || ')}; }
float coverage(uint m, vec2 f) {
  float c00 = float(m & 1u), c10 = float((m >> 1u) & 1u);
  float c01 = float((m >> 2u) & 1u), c11 = float((m >> 3u) & 1u);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}
// WATER1's fine trains: the gradient of three short trains on the wind and two rain trains, each fading with the
// distance on its own wavelength's scale, so a train a few units long is gone before it is a texel wide and aliases
vec2 waveGradient(vec2 p, float t, float dist) {
  float s = 0.35 + 0.65 * uWindStrength;
  vec2 d0 = uWindDir;
  // WATER-AUDIT (H3): the crossing trains by ROTATION of the wind, never
  // by adding a fixed vector to it - the sum collapsed onto the wind at
  // one heading and was the zero vector (a NaN sea) at its opposite
  vec2 d1 = vec2(0.809 * d0.x - 0.588 * d0.y, 0.588 * d0.x + 0.809 * d0.y);   // +36 degrees
  vec2 d2 = vec2(0.766 * d0.x + 0.643 * d0.y, -0.643 * d0.x + 0.766 * d0.y);  // -40 degrees
  vec2 g = vec2(0.0);
  g += (0.07 * s * exp(-dist * 0.004)) * cos(dot(p, d0) * 1.10 + t * 2.1) * d0;
  g += (0.06 * s * exp(-dist * 0.010)) * cos(dot(p, d1) * 2.30 + t * 3.4) * d1;
  g += (0.05 * s * exp(-dist * 0.020)) * cos(dot(p, d2) * 4.10 + t * 4.6) * d2;
  if (uRain > 0.0) {
    float near = exp(-dist * 0.012);
    vec2 r0 = vec2(0.96, 0.28), r1 = vec2(-0.28, 0.96);
    g += (0.16 * uRain * near) * cos(dot(p, r0) * 6.0 + t * 9.0) * r0;
    g += (0.16 * uRain * near) * cos(dot(p, r1) * 6.3 - t * 8.3) * r1;
  }
  return g;
}
// WATER-NEXT 3: the foam's lace - a value noise, two octaves
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float lace(vec2 p, float t) {
  vec2 drift = uWindDir * t * 0.35;
  return 0.65 * vnoise(p * 0.9 - drift) + 0.35 * vnoise(p * 2.7 + drift.yx);
}
// the eye's distance to a window depth, off the frame's own projection (a GL perspective: z_ndc = 2d - 1)
float eyeDepth(float d) { return uProj[3][2] / ((d * 2.0 - 1.0) + uProj[2][2]); }
void main() {
  float edge = 1.0;
  vec3 body;
  if (uOpen == 1) {
    // the sea's own colour: the climate's water texel, averaged, under the mod's own tint (its Top Color setting)
    body = textureLod(uTileArr, vec3(0.5, 0.5, 0.0), 8.0).rgb * uTint * uOpenColor;
  } else {
    vec2 unwrapped = vLocalXZ / uTileSize;
    // GRAIN1 / GRAIN AUDIT 1: the footprint taken above the discards - a derivative inside non-uniform control flow is
    // undefined in GLSL ES 3.00
    vec2 wgx = dFdx(unwrapped), wgy = dFdy(unwrapped);
    ivec2 cell = clamp(ivec2(floor(unwrapped)), ivec2(0), ivec2(uTileDim - 1));
    uint data = texelFetch(uTilemap, cell, 0).r;
    uint corners = waterCorners(data);
    if (corners == 0u) discard;
    vec2 f = fract(unwrapped);
    edge = smoothstep(0.5 - uShoreSoft, 0.5 + uShoreSoft, coverage(corners, f));
    // WATER-PUDDLE: a puddle record keeps only the texels its own art paints water (world/puddleMask.js)
    uint rec = data >> 2u;
    if (isPuddleRecord(rec)) {
      int turn = int(data & 3u);
      vec2 puv = PUDDLE_ROT[turn] * f + PUDDLE_TRANS[turn];
      edge *= smoothstep(0.3, 0.7, textureGrad(uTileArr, vec3(puv, float(rec)), PUDDLE_ROT[turn] * wgx, PUDDLE_ROT[turn] * wgy).a);
    }
    if (edge <= 0.002) discard;
    // the water's own colour: the climate's water texel (record 0), averaged to one colour by its mip chain
    body = textureLod(uTileArr, vec3(0.5, 0.5, 0.0), 8.0).rgb * uTint;
  }
  vec3 toEye = uCamPos - vWorldPos;
  float dist = length(toEye);
  vec3 V = toEye / max(dist, 1e-4);
  vec3 sw = swellAt(vWorldPos.xz, uTime, uWindDir, uSwell * vGrow);
  vec2 g = sw.yz + waveGradient(vWorldPos.xz, uTime, dist);
  // WATER-NEXT 4: the bodies' rings and wakes - the ripple field's slope, faded at its edge
  if (uRippleOn == 1) {
    vec2 ruv = (vWorldPos.xz - uRippleRect.xy) / uRippleRect.z;
    vec2 inside = smoothstep(vec2(0.0), vec2(0.08), ruv) * smoothstep(vec2(0.0), vec2(0.08), vec2(1.0) - ruv);
    if (inside.x * inside.y > 0.0) {
      float tx = ${(1 / RIPPLE_CELLS).toFixed(6)};
      vec2 rg = vec2(texture(uRipple, ruv + vec2(tx, 0.0)).r - texture(uRipple, ruv - vec2(tx, 0.0)).r,
                     texture(uRipple, ruv + vec2(0.0, tx)).r - texture(uRipple, ruv - vec2(0.0, tx)).r);
      g += rg * (255.0 * ${RIPPLE_SCALE.toFixed(4)} / (2.0 * tx * uRippleRect.z)) * (inside.x * inside.y);
    }
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float NdV = clamp(dot(n, V), 0.0, 1.0);   // WATER-AUDIT (M1): two near-unit vectors can dot past one; pow of a negative is NaN
  float F = uF0 + (0.85 - uF0) * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, n);
  vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, clamp(0.2 + R.y * 1.4, 0.0, 1.0));
  // PERF-SUN2: the shadow read only while the sun is up - a uniform branch
  float shadow = uSunScale > 0.0 ? cloudShadowAt(vWorldPos)${shadowGlsl ? ' * sunShadowAt(vWorldPos, n)' : ''} : 0.0;   // EL7: a quay's shadow lies on the water under the lane
  // the body lit as water is lit: the sky's light into it, the sun's and the moon's through it, softly
  float diff = max(dot(n, uLightDir), 0.0) * shadow;
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = body * (uAmbient + uSunColor * ((uSunScale * diff) * 0.6) + uMoonColor * (uMoonScale * mdiff));
  vec3 pointAcc = vec3(0.0), pointSpec = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    vec3 Ld = L / max(d, 1e-4);
    pointAcc += att * att * max(dot(n, Ld), 0.0) * uPointColors[i];
    // WATER-LIT1: water sends back little light diffusely and a lot as a glint - a lamp is a highlight on the waves
    pointSpec += att * pow(max(dot(n, normalize(Ld + V)), 0.0), 90.0) * uPointColors[i];
  }
  lit += body * pointAcc * 0.25;
  vec3 iL = uIndirect.xyz - vWorldPos;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  lit += body * (iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0)) * uIndirectColor * 0.25;
  // THE PATH through the water
  float slant = max(V.y, 0.12);
  float bedPath = uOpen == 1 ? 0.0 : (vDepth + 0.02) / slant;   // what the bed under the sheet says
  float path = uOpen == 1 ? ${OPEN_PATH.toFixed(1)} : bedPath;
  vec2 uv0 = gl_FragCoord.xy / uSceneSize;
  vec3 col;
  if (uSceneOn == 1) {
    float here = eyeDepth(gl_FragCoord.z);
    float bedD = eyeDepth(texture(uSceneDepth, uv0).r);
    path = max(bedD - here, bedPath);   // the scene's measure, never less than the bed's (a sheet with no bed stands for one)
    // the look pushed by the slope, by more the deeper the water under it, less the farther off
    vec2 push = n.xz * (${REFRACT_STRENGTH.toFixed(4)} * clamp(path, 0.0, 4.0)) / (1.0 + dist * 0.02);
    vec2 uv = clamp(uv0 + push, vec2(0.001), vec2(0.999));
    float pushedD = eyeDepth(texture(uSceneDepth, uv).r);
    if (pushedD < here) uv = uv0; else path = max(pushedD - here, bedPath);   // never what stands in front of the water
    vec3 T = exp(-uAbsorb * path);
    vec3 under = texture(uScene, uv).rgb * T + lit * (vec3(1.0) - T);
    col = mix(under, skyRefl, F);
  } else {
    // the blend draws the ground under the sheet; the sheet's alpha is the share the water hides
    float t = dot(exp(-uAbsorb * path), vec3(0.3333));
    float a = 1.0 - t * (1.0 - F);
    col = (lit * (1.0 - t) * (1.0 - F) + skyRefl * F) / max(a, 1e-3);
    edge *= a;
  }
  // WATER-NEXT 3: THE FOAM - the shore's band (the water's vertical depth here, the swell's crest pushing it up the
  // bank) and, on open water in a strong wind, the steep crests
  float vdepth = uSceneOn == 1 ? path * slant : (uOpen == 1 ? ${OPEN_PATH.toFixed(1)} : vDepth);
  // the open sea's sheets are 6.4-unit cells, their edge a staircase over the beach: where a sheet covers no water
  // (the scene's ground at or above it) it is gone, so the shore is where the sea's plane meets the sand
  if (uOpen == 1 && uSceneOn == 1) edge *= smoothstep(0.0, 0.12, vdepth);
  float band = ${FOAM_DEPTH.toFixed(3)} * (1.0 + uWindStrength);
  float shore = 1.0 - smoothstep(0.0, band, vdepth - sw.x * ${FOAM_RUNUP.toFixed(2)});
  float crest = smoothstep(${CREST_SLOPE.toFixed(4)}, ${(CREST_SLOPE * 1.6).toFixed(4)}, length(sw.yz)) * smoothstep(0.55, 0.9, uWindStrength);
  // a lace, never a rim: the noise cuts the band into threads, thicker the shallower the water and the harder the wind
  float l = lace(vWorldPos.xz, uTime);
  float foam = max(shore * shore * smoothstep(0.62 - 0.25 * shore * uWindStrength, 0.82, l), crest * smoothstep(0.6, 0.85, l)) * 0.75 * exp(-dist * 0.004);
  vec3 foamLit = vec3(0.92, 0.95, 0.96) * (uAmbient + uSunColor * (uSunScale * shadow * max(n.y, 0.0)) + uMoonColor * (uMoonScale * 0.5));
  col = mix(col, foamLit, foam * 0.9);
  edge = max(edge, foam * smoothstep(0.0, 0.2, edge));   // foam is not glass: where it lies the sheet is opaque
  vec3 H = normalize(uLightDir + V);
  float spec = pow(max(dot(n, H), 0.0), 180.0) * uSunScale * shadow * (1.0 - foam);
  vec3 Hm = normalize(uMoonDir + V);
  float mspec = pow(max(dot(n, Hm), 0.0), 220.0) * uMoonScale;
  col += uSunColor * (1.6 * spec) + uMoonColor * (0.7 * mspec) + pointSpec * 1.2;   // WATER-LIT1: the lamps' and the torch's glints
  outColor = vec4(dwWaterFog(mix(uFogColor, col, fogFactorAt(vWorldPos)), vWorldPos), edge);   // DW-C: the sea's distance fog
}`;

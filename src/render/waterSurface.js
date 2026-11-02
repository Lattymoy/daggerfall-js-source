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
// table of WATER CORNERS in world/water/waterCorners.js (MAC2 lifted it out of
// this file: the player's feet read the same table now, so where this
// pass draws water the player swims). The coverage inside a tile is
// the bilinear blend of its corners - the diagonal the shore tile's own
// art follows - feathered by SHORE_SOFTNESS.
import { WATER_DRAW_MASK_TABLE, RISE_MAX } from '../world/water/waterCorners.js'; // And the bank's rise's range
import { snowCoreGlsl } from './snowCoverGlsl.js'; // AUDIT PRECIP GROUND-5: the ground's snow, for a puddle's mask under it
import { PUDDLE_RECORDS } from '../world/puddleMask.js'; // WATER-PUDDLE: the records whose water is their art's   // MAC2: the corner table is a leaf the player's feet share; WATER-DRAW1: the DRAW's half of it - the feet's is the law's own table, and the two are not the same question
import { WIND_ROW_CALM, WIND_ROW_SPAN } from '../systems/wind/wind.js';
import { getPref } from '../systems/uiPrefs.js'; // FT6: the switch, read here alone
import { isEnhanced } from '../systems/uiSkin.js';
import { FOG_GLSL } from './fogGlsl.js'; // AUDIT 68 S17-fog-glsl-dup: the fog every world pass takes, one home
import { SEA_LOOK_GLSL, SEA_HAZE_BAND } from './horizonHaze.js'; // FAR-SEA1: the sea takes the far ring's haze; AUDIT FAR-SEA1 C12: and the open sea's light is one text with the ring's sea
import { pageParam } from '../systems/pageQuery.js';
import { EDGE_NOISE_GLSL } from './roadEdgeGlsl.js'; // COAST-LOOK: the edges' lattice noise, its one text

import { groundWanderGlsl, groundKindsGlsl } from './groundEdgeGlsl.js'; // COAST-LOOK: the shore's wander and the transitions' table, the ground's own (the sheet, the sand and the silt on one line)
import { RIPPLE_CELLS, RIPPLE_SCALE } from '../world/water/waterRipples.js';

/** FT6 (2026-09-14, the Features arc): THE SWITCH, ONE HOME. Both
 *  exterior hosts composed "the enhanced skin, the pref, the kill door"
 *  inline, word for word - two copies of one law. This is the copy:
 *  the enhanced skin (the classic lane draws DFU's flat tile), the
 *  Enhanced water pref, and `?water=off` as the kill door. A town host
 *  still asks tilemapRectHasWater beside it - that is the town's, not
 *  the switch's. */
export function waterSwitchOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('enhancedWater') && pageParam('water', search) !== 'off'; // PERF-URL
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
/** The classic water texel's tint under the surface - a deep blue-green
 *  multiplier, so the tile's own palette colour reads as the body of the
 *  water and not as a floor seen through it. MAC2: darkened from
 *  0.62/0.78/0.86 - the body is the water's depth now, not its floor. */
export const WATER_TINT = Object.freeze([0.36, 0.5, 0.6]);
/** Schlick's F0 for water (n = 1.33). */
export const WATER_F0 = 0.02;
/** Half-width of the shore feather, in coverage (0.5 is the diagonal). */
export const SHORE_SOFTNESS = 0.16;
/** The depth over the ground (units) over which the water fades in where the ground rises through its
 *  plane - under the lift, so a shelf standing at the level is water whole. */
export const SHORE_MEET = 0.06;
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
  const w = Math.min(width, dim),
    h = Math.min(height, dim);
  for (let y = 0; y < h; y++) {
    const row = y * dim;
    for (let x = 0; x < w; x++) if (table[bytes[row + x]]) return true;
  }
  return false;
}

/** 0..1: the eased wind row's strength on the sky's own scale
 *  (systems/wind/wind.js: a row's vector runs WIND_ROW_CALM to
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
 * ({zenith, horizon} 0..1 rgb, or null for the default day) - SKYRIM-AURORA: and its `aurora`, the aurora's dome map
 * ({ tex }) the water reflects, or none.
 */
export function waterUniforms({ seconds = 0, wind = null, rain = 0, sky = null, still = false } = {}) {
  const t = still ? 0 : seconds;
  const s = windStrength01(wind);
  let dx = 0.7,
    dz = Math.sqrt(1 - 0.49); // a unit direction: the wind the sea takes when none is known
  if (wind) {
    const m = Math.hypot(wind[0] ?? 0, wind[1] ?? 0);
    if (m > 1e-9) {
      dx = wind[0] / m;
      dz = wind[1] / m;
    }
  }
  return {
    time: t,
    windDir: [dx, dz],
    windStrength: s,
    rain: Math.min(1, Math.max(0, rain || 0)),
    zenith: sky?.zenith ?? DEFAULT_SKY_ZENITH,
    horizon: sky?.horizon ?? DEFAULT_SKY_HORIZON,
    aurora: sky?.aurora?.tex ?? null, // SKYRIM-AURORA: the dome map's texture, or null
    // AUDIT WATER-NEXT m6: no `scroll` and no `opacity` - WATER-NEXT 2's sheet scrolls no texel and has no one opacity
    // (the body swallows light by its depth; MAC2's "darker and not as see through" is the deep water's now), and
    // WATER_OPACITY, forwarded here and pinned as the surface's floor, was a law nothing drew
    lift: WATER_LIFT,
    tint: WATER_TINT,
    f0: WATER_F0,
    shoreSoft: SHORE_SOFTNESS,
    swell: swellAmplitude(s), // WATER-NEXT 2: the sheet's swell, the wind's
    absorb: WATER_ABSORB,
  };
}

// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE SWELL (2026-10-07, Mac: "real translucent water with proper waves"; asked, the waves "modest,
// weather-driven"): THE SHEET MOVES. WATER1's waves were a normal map on a still sheet; the sheet now rides three
// long trains - one down the wind, two crossing it - whose height the vertex shader lifts the sheet by and whose slope
// the fragment shader lights, ONE field (SWELL_GLSL, written from SWELL_TRAINS, and swellAt below, the same sum for the
// CPU - AUDIT WATER-NEXT m10: its pins read it; no hull bobs on it yet, so a still boat's waterline rides the swell's
// height up and down its side, as a wave runs along a moored hull). The trains run at deep water's own speed (omega = sqrt(g k), a unit a metre) and
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
/** AUDIT WATER-NEXT G8: the distance (units) over which the sheet's heave fades out - inside a near pixel's reach of the
 *  eye (a pixel is 819.2 across), before a strided ring's cells grow as long as the shortest train. */
export const SWELL_REACH = Object.freeze([300, 600]);
/** The swell's height for a wind strength 0..1. */
export const swellAmplitude = (windStrength01) =>
  SWELL_CALM + (SWELL_GALE - SWELL_CALM) * Math.min(1, Math.max(0, windStrength01));

/** The swell at a world point, the shader's own sum: [height, d/dx, d/dz]. `windDir` a unit [x, z]. */
export function swellAt(x, z, t, windDir, amplitude) {
  let h = 0,
    gx = 0,
    gz = 0;
  for (const [ang, len, share] of SWELL_TRAINS) {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const dx = c * windDir[0] - s * windDir[1],
      dz = s * windDir[0] + c * windDir[1];
    const k = (2 * Math.PI) / len,
      w = Math.sqrt(SWELL_G * k),
      a = amplitude * share;
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
  const k = (2 * Math.PI) / len,
    w = Math.sqrt(SWELL_G * k),
    f = (v) => `(${v.toFixed(6)})`;
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
export const WATER_ABSORB = Object.freeze([0.55, 0.3, 0.22]);
/** How far the refracted look is pushed by the waves' slope, in screen fractions at a unit of depth. */
export const REFRACT_STRENGTH = 0.035;
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
/** The bank's rise over which the sheet fades out (world/water/waterLevel.js shoreMap's fourth field), units -
 *  done short of WATER_LIFT, so the water ends on that smoothed curve before the ground's own triangles cut it. */
export const RISE_FADE = Object.freeze([0.025, 0.065]);
/** The unit a water sheet's smoothed fields ride (world/water/waterLevel.js shoreMap) - the water's and its
 *  ground's (the silt's line), no other pass's. */
export const WATER_SHORE_UNIT = 26;
/** WATER-NEXT 4: the ripple field's unit - 1, the billboards' emission unit, its shadow forgotten after the bind. */
export const WATER_RIPPLE_UNIT = 1;
export const WATER_SCENE_DEPTH_UNIT = 6;
/** SKYRIM-AURORA: the aurora's dome map's unit - no other fixed unit's (the snow's are 16-20, the skin's 21, the panes' 22,
 *  the snow lines' 23, the window light's 24); the black texel while there is none. */
export const AURORA_SKY_UNIT = 25;
/** SKYRIM-AURORA: where the aurora's dome map (render/auroraPass.js AURORA_DOME_FS) holds direction R - its azimuth from the
 *  north toward the east across, its height up. Here, beside its reader, so the boot's graph takes no new file. */
export const AURORA_DOME_UV_GLSL = `vec2 auroraDomeUv(vec3 R) { return vec2((length(R.xz) > 1e-6 ? atan(R.x, R.z) : 0.0) * 0.15915494 + 0.5, R.y); }`; // atan(0, 0) is undefined: straight up, any azimuth
/** SKYRIM-AURORA: the least share of the aurora the water reflects - its Fresnel where that is more. Calm water at night
 *  shows the curtains as it shows a lamp's glint; the bare Fresnel, a few hundredths looking down, hid them. */
export const AURORA_MIRROR = 0.3;

/** The sheet AT ITS LEVEL (world/water/waterLevel.js), lifted WATER_LIFT and heaved by the swell -
 *  attribute 1 its depth over the carved ground and the shading's depth, attribute 2 the shore's cut, attribute 3 the
 *  sea's marks (the share of Deep Waters' clip about it and its standing at the sea's level). The swell
 *  grows with the depth over the ground, or over the clip, so a trough never dips under it. The open sea's sheet (Deep
 *  Waters' top, `uOpen`) reads none and swells everywhere. */
export const WATER_SURFACE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aDepth;
layout(location=2) in float aCut;
layout(location=3) in vec2 aSea;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLift;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uSwell;
uniform int uOpen;
uniform vec3 uCamPos;          // AUDIT WATER-NEXT G8: the eye, for the swell's reach
out vec3 vWorldPos;
out vec2 vLocalXZ;
out vec2 vDepth;
out float vGrow;
out float vCut;               // the shore's cut field (world/water/waterLevel.js waterSheet)
out vec2 vSea;                // the clip's share (the open sea) and the sea's level
${SWELL_GLSL}
void main() {
  vec4 world = uModel * vec4(aPos.x, aPos.y + uLift, aPos.z, 1.0);
  vec2 sea = uOpen == 1 ? vec2(0.0) : aSea;   // the open sea's sheet binds its uvs on 2 and nothing on 3
  float grow = uOpen == 1 ? 1.0 : max(smoothstep(0.0, ${SWELL_DEPTH.toFixed(3)}, aDepth.x), sea.x);
  vec3 sw = swellAt(world.xz, uTime, uWindDir, uSwell * grow);
  // AUDIT WATER-NEXT G8: the heave fades out before the far rings' strided grids, whose cells are as long as the
  // shortest train (a vertex a wave: the distant sheet heaved in an aliased lattice); the slope stays the fragment's
  float lift = sw.x * (1.0 - smoothstep(${SWELL_REACH[0].toFixed(1)}, ${SWELL_REACH[1].toFixed(1)}, length(world.xz - uCamPos.xz)));
  world.y += lift;
  vWorldPos = world.xyz;
  vLocalXZ = aPos.xz;
  vDepth = vec2(aDepth.x + uLift + lift, max(aDepth.y + lift, 0.0));
  vGrow = grow;
  vCut = aCut;
  vSea = sea;
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
export const waterSurfaceFs = (
  cloudShadowGlsl,
  shadowGlsl = '',
) => `#version 300 es   // EL7: with SHADOW_GLSL the water receives the lane's sun shadow
precision highp float;
precision highp int;   // WATER-NEXT 2: uOpen is the vertex stage's too - an int's precision must agree across the two
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vWorldPos;
in vec2 vLocalXZ;
in vec2 vDepth;
in float vGrow;
in float vCut;
in vec2 vSea;
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform highp ivec3 uEcoOrigin;   // AUDIT PRECIP GROUND-5: the pixel's first world tile on the snow lane (render/snowCoverGlsl.js)
${snowCoreGlsl()}
uniform float uTileSize;
uniform int uTileDim;          // WATER-AUDIT: the tilemap's side (128 in the world, the town's own in the fixed city)
uniform int uOpen;             // WATER-NEXT 2: the open sea's sheet - no tilemap, all water
uniform vec3 uOpenColor;       // and the mod's tint over its water's colour - the sea's, on the terrain's sheet too (vSea.y)
uniform sampler2D uShore;      // the sheet's smoothed fields (world/water/waterLevel.js shoreMap), half a tile a texel
uniform int uShoreOn;
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
uniform sampler2D uAuroraSky;   // SKYRIM-AURORA: the aurora's dome map (render/auroraPass.js), read while uAuroraSkyOn is 1
uniform int uAuroraSkyOn;
${AURORA_DOME_UV_GLSL}
uniform vec3 uTint;
uniform float uF0;
uniform float uShoreSoft;
${EDGE_NOISE_GLSL}
${groundWanderGlsl()}
${groundKindsGlsl()}
uniform vec3 uAbsorb;
uniform int uSceneOn;          // WATER-NEXT 2: the frame's colour and depth, copied before the water (Renderer.captureUnderWater)
uniform sampler2D uScene;
uniform sampler2D uSceneDepth;
uniform vec2 uSceneSize;
uniform mat4 uProj;
uniform int uRippleOn;         // WATER-NEXT 4: the ripple field round the camera (world/water/waterRipples.js)
uniform sampler2D uRipple;
uniform vec3 uRippleRect;      // its corner's world x, z and its side
${cloudShadowGlsl}
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec2 uSeaHaze;         // FAR-SEA1: the far ring's haze hold (0: off - the world's fog alone) and the sea's height (AUDIT FAR-SEA1 P3: the rim never reaches the streamed sea)
uniform vec3 uCamPos;
${shadowGlsl}
out vec4 outColor;
${FOG_GLSL}
${SEA_LOOK_GLSL}
${SWELL_GLSL}
// WATER-PUDDLE: a tile's turn as TERRAIN_FS applies it (render/renderer.js - DFU's row-major initializers transposed)
const mat2 PUDDLE_ROT[4] = mat2[4](mat2(1.0, 0.0, 0.0, 1.0), mat2(0.0, -1.0, 1.0, 0.0), mat2(-1.0, 0.0, 0.0, -1.0), mat2(0.0, 1.0, -1.0, 0.0));
const vec2 PUDDLE_TRANS[4] = vec2[4](vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));
bool isPuddleRecord(uint r) { return ${PUDDLE_RECORDS.map((r) => `r == ${r}u`).join(' || ')}; }
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
// The sheet's smoothed fields here (world/water/waterLevel.js shoreMap): r the cut, b the clip's share, a the
// bank's rise
vec4 shoreAt() { return textureLod(uShore, (2.0 * vLocalXZ / uTileSize + 0.5) / vec2(textureSize(uShore, 0)), 0.0); }
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
    uint data = texelFetch(uTilemap, cell, 0).r;   // WATER-LEVEL: the record, for a puddle's art and the ground's line - never the water's extent
    vec2 f = fract(unwrapped);
    // WATER-LEVEL: where the plane runs on over ground no higher than it, the cut field ends it (world/water/waterLevel.js),
    // on the ground's wandering line where the ground blends (COAST-LOOK); elsewhere the ground rises through it.
    // The field smoothed, read bilinear - the shore a curve, never a tile's edge
    vec4 sh = uShoreOn == 1 ? shoreAt() : vec4(0.0);
    float cut = uShoreOn == 1 ? sh.r * 2.0 - 1.0 : vCut;
    edge = smoothstep(0.5 - uShoreSoft, 0.5 + uShoreSoft, 0.5 - 0.5 * cut - (geEntry(data) != 0u ? geWander(unwrapped) : 0.0));
    // Where the bank rises through the plane the water fades out on the rise's smoothed field, short of the
    // ground's own triangles - the bank a curve, not their zigzag
    edge *= 1.0 - smoothstep(${RISE_FADE[0].toFixed(3)}, ${RISE_FADE[1].toFixed(3)}, sh.a * ${RISE_MAX.toFixed(3)});
    // WATER-PUDDLE: a puddle record keeps only the texels its own art paints water (world/puddleMask.js)
    uint rec = data >> 2u;
    if (isPuddleRecord(rec)) {
      int turn = int(data & 3u);
      vec2 puv = PUDDLE_ROT[turn] * f + PUDDLE_TRANS[turn];
      float pa = textureGrad(uTileArr, vec3(puv, float(rec)), PUDDLE_ROT[turn] * wgx, PUDDLE_ROT[turn] * wgy).a;
      // AUDIT PRECIP GROUND-5: under the snow the water is the texel's the ground wears there - its winter record's mask
      // in the cover's share (a puddle frozen under snow is the winter art's, a thaw's the summer's)
      float pc = snowCover(vLocalXZ, vWorldPos.y, wgx, wgy);
      if (pc > 0.0) pa = mix(pa, textureGrad(uTileArr, vec3(puv, float(rec) + float(uSnowArr.x)), PUDDLE_ROT[turn] * wgx, PUDDLE_ROT[turn] * wgy).a, pc);
      edge *= smoothstep(0.3, 0.7, pa);
    }
    if (edge <= 0.002) discard;
    // the water's own colour: the climate's water texel (record 0), averaged to one colour by its mip chain
    body = textureLod(uTileArr, vec3(0.5, 0.5, 0.0), 8.0).rgb * uTint * mix(vec3(1.0), uOpenColor, vSea.y);   // the sea wears the mod's tint
  }
  // AUDIT WATER-NEXT G7: the open sea from under its own crest is not drawn - the mod's top discards the same
  // (uCamPos.y - vWorldPos.y + 0.02 < 0): a swimmer at the surface under a heaving sheet saw the wave's underside
  if ((uOpen == 1 || vSea.x > 0.5) && uCamPos.y - vWorldPos.y + 0.02 < 0.0) discard;   // the terrain's sheet over the clip too
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
      // AUDIT WATER-NEXT G10: an explicit level - an implicit one is undefined in non-uniform flow (the field has one)
      vec2 rg = vec2(textureLod(uRipple, ruv + vec2(tx, 0.0), 0.0).r - textureLod(uRipple, ruv - vec2(tx, 0.0), 0.0).r,
                     textureLod(uRipple, ruv + vec2(0.0, tx), 0.0).r - textureLod(uRipple, ruv - vec2(0.0, tx), 0.0).r);
      g += rg * (255.0 * ${RIPPLE_SCALE.toFixed(4)} / (2.0 * tx * uRippleRect.z)) * (inside.x * inside.y);
    }
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float NdV = clamp(dot(n, V), 0.0, 1.0);   // WATER-AUDIT (M1): two near-unit vectors can dot past one; pow of a negative is NaN
  float F = seaFresnel(NdV, uF0);   // AUDIT FAR-SEA1 C12: the open sea's light, one text with the far ring's sea (render/horizonHaze.js)
  vec3 R = reflect(-V, n);
  vec3 skyRefl = seaSkyRefl(R.y, uSkyZenith, uSkyHorizon);
  // SKYRIM-AURORA: the aurora in the water, by the reflected ray (an explicit level: the flow here is not uniform), at the
  // water's Fresnel or AURORA_MIRROR, the more - added as the glints are, below
  vec3 auroraRefl = vec3(0.0);
  if (uAuroraSkyOn == 1) auroraRefl = textureLod(uAuroraSky, auroraDomeUv(R), 0.0).rgb * step(0.0, R.y) * max(F, ${AURORA_MIRROR.toFixed(2)});
  // PERF-SUN2: the shadow read only while the sun is up - a uniform branch
  float shadow = uSunScale > 0.0 ? cloudShadowAt(vWorldPos)${shadowGlsl ? ' * sunShadowAt(vWorldPos, n)' : ''} : 0.0;   // EL7: a quay's shadow lies on the water under the lane
  // the body lit as water is lit: the sky's light into it, the sun's and the moon's through it, softly
  float diff = max(dot(n, uLightDir), 0.0) * shadow;
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = body * seaLight(uAmbient, uSunColor, uSunScale * diff, uMoonColor, uMoonScale * mdiff);
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
  // Over the clip, with the frame's copy the sea reads the mod's floor as the mod's own sheet does; without one it is
  // the open sea's depth, faded in by the clip's smoothed share
  float open = uOpen == 1 ? 1.0 : (uShoreOn == 1 ? shoreAt().b : vSea.x);
  float bedPath = uOpen == 1 ? 0.0 : (mix(vDepth.y, ${OPEN_PATH.toFixed(1)}, uSceneOn == 1 ? 0.0 : open) + 0.02) / slant;   // what the bed under the sheet says
  float meet = vDepth.x;   // WATER-LEVEL: how far over the ground the plane stands here - 0 where the ground rises through it
  float path = uOpen == 1 ? ${OPEN_PATH.toFixed(1)} : bedPath;
  vec2 uv0 = gl_FragCoord.xy / uSceneSize;
  // AUDIT WATER-NEXT G1/G3: THE COMPOSITION, PREMULTIPLIED. own is the water's own light at its share of the pixel;
  // with the scene's copy, under is the copy's colour at trans (its share: a finished, fogged image - fogged again
  // with the rest, every pond read paler and foggier than its bank); without one, cover is how much of the frame the
  // blend leaves under the sheet that the water hides. The foam and the glints are added to own at their full
  // strength - divided out of the blend after edge *= a, a glint over shallow water was a twentieth of Full's.
  vec3 own, under = vec3(0.0), trans = vec3(0.0);
  float cover = 1.0;
  if (uSceneOn == 1) {
    float here = eyeDepth(gl_FragCoord.z);
    float bedD = eyeDepth(textureLod(uSceneDepth, uv0, 0.0).r);   // AUDIT WATER-NEXT G10: after the discards, an explicit level
    path = max(bedD - here, bedPath);   // the scene's measure, never less than the bed's (a sheet with no bed stands for one)
    meet = (bedD - here) * slant;
    // the look pushed by the slope, by more the deeper the water under it, less the farther off
    vec2 push = n.xz * (${REFRACT_STRENGTH.toFixed(4)} * clamp(path, 0.0, 4.0)) / (1.0 + dist * 0.02);
    vec2 uv = clamp(uv0 + push, vec2(0.001), vec2(0.999));
    float pushedD = eyeDepth(textureLod(uSceneDepth, uv, 0.0).r);
    if (pushedD < here) uv = uv0; else path = max(pushedD - here, bedPath);   // never what stands in front of the water
    vec3 T = exp(-uAbsorb * path);
    under = textureLod(uScene, uv, 0.0).rgb;   // AUDIT WATER-NEXT G10: an explicit level
    trans = T * (1.0 - F);
    own = lit * (vec3(1.0) - T) * (1.0 - F) + skyRefl * F;
  } else {
    // the blend draws the ground under the sheet; cover is the share the water hides
    float t = dot(exp(-uAbsorb * path), vec3(0.3333));
    cover = 1.0 - t * (1.0 - F);
    own = lit * (1.0 - t) * (1.0 - F) + skyRefl * F;
  }
  // WATER-NEXT 3: THE FOAM - the shore's band (the water's vertical depth here, the swell's crest pushing it up the
  // bank) and, on open water in a strong wind, the steep crests
  float vdepth = uSceneOn == 1 ? path * slant : mix(vDepth.y, ${OPEN_PATH.toFixed(1)}, open);
  if (uOpen == 0) edge *= smoothstep(0.0, ${SHORE_MEET.toFixed(3)}, meet);   // WATER-LEVEL: the shore where the ground meets the plane, soft
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
  float k = foam * 0.9;   // foam is not glass: where it lies it hides what is under it
  own = mix(own, foamLit, k); trans *= 1.0 - k; cover = mix(cover, 1.0, k);
  edge = max(edge, foam * smoothstep(0.0, 0.2, edge));
  vec3 H = normalize(uLightDir + V);
  float spec = seaSunLobe(dot(n, H)) * uSunScale * shadow * (1.0 - foam);
  vec3 Hm = normalize(uMoonDir + V);
  float mspec = seaMoonLobe(dot(n, Hm)) * uMoonScale;
  own += seaGlints(uSunColor, spec, uMoonColor, mspec) + pointSpec * 1.2;   // WATER-LIT1: the lamps' and the torch's glints
  own += auroraRefl * (1.0 - foam);   // SKYRIM-AURORA: the curtains in the water, under no foam
  // the fogs over the water's own light at its share - the air's, then DW-C's sea fog - as a premultiplied colour takes
  // them (an affine fog of x is x * m + c; at a share s, x * m + c * s): the copy's share is left as it was drawn
  vec3 ownShare = uSceneOn == 1 ? vec3(1.0) - trans : vec3(cover);
  float fw = weatherFogAt(vWorldPos);   // BANTHA1: the weather's half - the sea's haze below is its law; the jungle's haze multiplies after
  // FAR-SEA1: THE SEA REACHES THE HORIZON. On a frame the far ring is drawn (the host sets uSeaHaze), the water at the
  // sea's own level takes the ring's haze - the world's linear ramp capped at the hold - so it no longer closes into a
  // band of solid fog in front of the ring's sea: the two meet at one haze at the streamed grid's edge. Nearer than the
  // hold the cap is the world's fog exactly; a lake or a river above the coast keeps the world's fog whole. AUDIT
  // FAR-SEA1 P3: the law's half that reaches the streamed sea is the world's own linear factor floored at 1 - hold
  // (render/horizonHaze.js: the rim opens past the grid's farthest corner) - no second distance, no second ramp; L3:
  // faded over the band's outer half, so water running down to the sea crosses into its haze without a line.
  if (uSeaHaze.x > 0.0 && uFogMode == 1) {
    float seaW = 1.0 - smoothstep(${(SEA_HAZE_BAND * 0.5).toFixed(2)}, ${SEA_HAZE_BAND.toFixed(2)}, abs(vWorldPos.y - uSeaHaze.y));
    fw = mix(fw, max(fw, 1.0 - uSeaHaze.x), seaW);
  }
  fw *= hazeAt(vWorldPos, focusOrigin());   // BANTHA1: the jungle's haze closes over the sea's floor too - no sea shows through it
  vec3 fogged = own * fw + uFogColor * (1.0 - fw) * ownShare;
  fogged = dwWaterFogAdd(fogged, vWorldPos) + dwWaterFog(vec3(0.0), vWorldPos) * ownShare;
  outColor = uSceneOn == 1 ? vec4(under * trans + fogged, edge) : vec4(fogged / max(cover, 1e-3), edge * cover);
}`;

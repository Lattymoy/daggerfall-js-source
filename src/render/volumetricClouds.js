// @ts-check
// VC3 (2026-09-07): THE VOLUMETRIC CLOUDS. VC4: AND THEIR SHADOW.
//
// Mac: "true volumetric clouds that move across the sky, build during
// weather... on top of real cloud shadows that reflect on the ground".
// A raymarched cloud SLAB - a layer of the atmosphere between two
// altitudes, in world metres, over a flat earth that fades into the
// dome's horizon with distance - lit by the sun (or the moon at night)
// with a short light march, shaped by the two noise volumes VC2 made,
// and driven by the SAME numbers the rest of the outdoors already
// keeps: the eased weather row (cover, softness, greyness, the two
// cloud colours), a per-weather PROFILE eased on the same clock, and
// the one wind integral (WIND2's drift), so the clouds build over a
// front's lead as the rain and the wind do, and drift as the ground's
// shadow does.
//
// NOT PER SCREEN PIXEL. The march writes a SKY-SPACE MAP - an
// equirectangular hemisphere, azimuth across, elevation up - from the
// camera's own world position (a cloud is at infinity for the camera's
// rotation, not for its travel: a walk of a kilometre moves the bank
// overhead, and the shadow under it). A stripe of the map is
// re-marched each frame (a full sweep every SWEEP_FRAMES), with a
// per-texel jitter that is FIXED (a hash of the texel, not the clock)
// so the dithered banding never flickers; the composite pass then
// draws the whole sky with one bilinear sample per pixel, blending the
// map's colour over the dome by its transmittance (ONE, SRC_ALPHA:
// sky * T + cloud). The stars and the sun's disc show through the gaps
// by construction.
//
// THE SHADOW (VC4) is the SAME FIELD seen from the ground: a world-
// space map, a square of SHADOW_EXTENT metres snapped to the streaming
// world's 819.2-metre pixel grid around the camera, each texel the
// transmittance along the sun's ray from that ground point up through
// the slab - the projection of the bank overhead, not a noise that
// resembles it. THE FLOATING ORIGIN: a recenter shifts every world
// position by whole pixels; the controller hands the shift here
// (offsetOrigin) and both marches sample the field at the ABSOLUTE
// position (uShift, the shifts accumulated), so the clouds stay where
// they were over the land, the shadow square moves with the world and
// its map is kept, not re-marched. When the camera crosses a pixel
// without a recenter (the fixed city), the map is SHIFTED by whole
// texels (a blit) and only the uncovered strip is marched, over the
// next sweep, so a crossing costs no spike. The terrain, the models,
// the characters and the flats sample the map through one shared GLSL
// block (renderer.js CLOUD_SHADOW_GLSL); the sun's disc dims through
// the sky map's own transmittance, so the disc, the light and the
// ground agree because they are one field.
//
// The ray construction in the composite is the dome's own, line for
// line (test/volumetricClouds.test.js pins the two texts against each
// other), so a cloud sits where the dome's sun is.
//
// Behind Enhanced Environments only (the one switch), on the port's own
// dome only (never under the Dynamic Skies mod, whose sky is its own),
// `?clouds=off` the kill switch, `?clouds=lo|hi` the quality doors.

import { createRenderTarget, withTarget, frameTarget } from './renderTarget.js';
import { CloudNoise } from './cloudNoise.js';
import { buildProgram } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link
import { WEATHER_EASE_MINUTES, WEATHER_SKY, WIND_SECONDS_PER_MINUTE, sunSkyDirection, paletteAt } from './enhancedSky.js';   // WEATHER2c: a cell's cover and grey are its weather's row; VC7a: the sun that drives the day's convection
import { DREAD_GLSL } from '../world/dreadSky.js';   // EVENT1: the live event's grade, the sky's last word

/** VC7e: a JS number as a GLSL float literal (airPass.js glslFloat's law: `${1}` is an int to the compiler). */
const glslF = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
/** The streaming world's pixel, in metres (terrainSampler.js TERRAIN_SIZE). */
export const PIXEL_METRES = 819.2;
/** The quality tiers: the sky map's texels, the march's steps, the
 *  shadow map's texels and steps. */
export const QUALITY = Object.freeze({
  lo: Object.freeze({ width: 512, height: 128, steps: 32, light: 4, shadow: 256, shadowSteps: 8, cells: 3 }),
  default: Object.freeze({ width: 1024, height: 256, steps: 56, light: 5, shadow: 512, shadowSteps: 12, cells: 8 }),
  hi: Object.freeze({ width: 2048, height: 512, steps: 80, light: 6, shadow: 1024, shadowSteps: 16, cells: 8 }),
});
/** WEATHER2c: the most cells the field takes (the shader's arrays);
 *  a tier may cap lower (`cells`). */
export const MAX_CELLS = 8;
/** WEATHER2c: a cell's rim, as a fraction of its radius - the band over
 *  which its profile blends into the zone's. */
export const CELL_EDGE = 0.35;
/** A full sweep of either map takes this many frames. */
export const SWEEP_FRAMES = 8;
/** VC6d: the steps a ray may take BEYOND its tier's budget. Empty-space
 *  skipping normally finishes a ray early, but a ray that enters and
 *  leaves cloud several times pays one step for each stride it backs
 *  out of; this is what keeps such a ray reaching the end of its slab
 *  instead of stopping short and losing the far bank. Twelve is above
 *  the most transitions a slab this deep can hold and leaves every tier
 *  (32, 56, 80) inside the loop's own hard cap of 96. */
export const MARCH_SLACK = 12;
/** VC6b: mean Earth radius, metres - the ONE number behind the whole
 *  golden hour. A cloud at height h sees over the ground's horizon by
 *  sqrt(2h/R) radians, which for this slab is a degree and a half: the
 *  sun sets for the player a full ninety seconds before it sets for the
 *  cloud deck above them. That gap IS the sunset, and the field did not
 *  have it. */
export const EARTH_RADIUS_M = 6371000;
/** VC6b: how far a point at height `h` metres sees past the ground's
 *  horizon, in radians. Pure. */
export const horizonDip = (h) => Math.sqrt(2 * Math.max(0, h) / EARTH_RADIUS_M);
/** One unit of the WIND2 drift integral is this many world metres -
 *  1 / 0.0038, the scale the terrain's shadow field moved by before
 *  VC4, so the sky drifts at the pace the ground was already keeping. */
export const WORLD_PER_DRIFT = 1 / 0.0038;
/** The fields' periods, in whole pixels (the shape volume tiles every
 *  15, the detail every 1, the weather's variation every 80, the
 *  ambient's mottle every 5) - a recenter is answered by uShift, not
 *  by the periods; these keep the shadow square's texel grid exact.
 *
 *  VC6a (2026-09-18, Mac: "clouds repeat pretty consistently when its
 *  partly cloudy"): the variation was SIXTEEN pixels, 13107 m, against
 *  the shape volume's 12288 m - two grids within seven per cent of each
 *  other, so they walked in step and the same bank came round every
 *  twelve kilometres, which is well inside the march's own 24 km reach.
 *  Eighty pixels is 65536 m: five times the shape's tile, sharing only
 *  the factor 5 with it, so the two beat over the field's whole period
 *  (196 km) instead of over one visible sky. It is also the truer
 *  number - how much cloud there is varies over tens of kilometres of
 *  land, not over one valley. */
export const SHAPE_METRES = PIXEL_METRES * 15;
export const DETAIL_METRES = PIXEL_METRES;
export const VARIATION_METRES = PIXEL_METRES * 80;
export const MOTTLE_METRES = PIXEL_METRES * 5;
/** VC6a: how far the domain WARP bends a sample's position, in metres.
 *  The warp is read from the variation sample's own spare channels, so
 *  it costs no texture read; it bends the shape volume's lattice so the
 *  eye cannot find the tile's straight edges even where the tile does
 *  come round.
 *
 *  ONE PIXEL, AND THE PROBE CHOSE IT. Three was tried first, on the
 *  reasoning that a fifth of the shape's period would bend the grid
 *  without tearing a cloud. It tore them: the warp field's own features
 *  are the variation volume's Worley cells, about 2 km across, so an
 *  amplitude of 2458 m is larger than the gradient it rides and the map
 *  q -> q + A*f(q) FOLDS - it stops being one-to-one, and the sky grew a
 *  smeared fan near the zenith that the bare field never had. The
 *  amplitude has to stay well under the warp field's own feature size,
 *  not under the field it is bending. Seen in the lab, against the same
 *  shot on the tree before this change. */
export const WARP_METRES = PIXEL_METRES * 1;
/** CLK1: the field's COMMON PERIOD - the least common multiple of the
 *  four periods above (15, 1, 80 and 5 pixels: 240), so a position
 *  moved by a whole number of it samples the same cloud. The drift and
 *  the recenter shift are both unbounded integrals (a year of game
 *  time is tens of thousands of kilometres of wind) and the shader
 *  takes them as float32; they are wrapped to this period at upload,
 *  so neither ever outgrows the mantissa. Pinned: every period divides
 *  it. */
export const FIELD_PERIOD_METRES = PIXEL_METRES * 240;
export const wrapField = (v) => v - Math.floor(v / FIELD_PERIOD_METRES) * FIELD_PERIOD_METRES;
/** Extinction per metre at density 1. */
export const EXTINCTION = 0.006;
/** VC7e (2026-09-23, Mac: "Whatever is the most visually detailed and immersive"): THE LIGHT THROUGH A THICK DECK.
 *  Beer's law alone is single scattering: a storm deck's optical depth ran 5.1 to 6.3 along the sun (the arc's
 *  measurement; an overcast's 0.56 to 0.80), and exp(-5.1) and exp(-6.3) are both black, so every point under a
 *  storm got the same nothing, and the overcast's narrow range the same grey - the deck was one
 *  flat lid whatever its thickness above. A real cloud passes light on by scattering it many times, which falls off
 *  far more slowly - thin places in a deck glow and thick cores go dark, and THAT is its structure. The octave
 *  approximation (Wrenninge, "Production Volume Rendering", 2013): octave i carries MS_A^i of the light,
 *  extinguished by MS_B^i of the depth, its phase flattened by MS_C^i toward isotropic. MS_OCTAVES counts them,
 *  the single-scattering term (octave 0) included. The same thickness dims the SKY's light on the cloud: the
 *  ambient passes AMBIENT_THROUGH_K of the depth, never below AMBIENT_FLOOR, so a thick core's underside is darker
 *  than a thin place beside it rather than one grey with it. */
export const MS_OCTAVES = 3;
export const MS_A = 0.5;
export const MS_B = 0.35;
export const MS_C = 0.5;
/** VC7e: the octaves' total share at zero depth - the light is divided by it, so no depth takes more than an unshadowed path. */
export const msSum = () => { let a = 1, t = 0; for (let o = 0; o < MS_OCTAVES; o++) { t += a; a *= MS_A; } return t; };
export const AMBIENT_THROUGH_K = 0.35;
export const AMBIENT_FLOOR = 0.15;
/** VC7e: the deck's cells (density()): the Worley threshold band a cell's edge is drawn across, the cover band a
 *  sky becomes a deck over, how far (in the band's height) a lane's base lifts, and how much of the column a lane
 *  loses at the top. */
export const CELL_EDGE_LO = 0.35;
export const CELL_EDGE_HI = 0.65;
export const DECK_COVER_LO = 0.4;
export const DECK_COVER_HI = 0.95;
export const CELL_BASE_LIFT = 0.07;
export const CELL_THIN = 0.55;
/** VC7c (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - rain shafts): THE CURTAINS
 *  UNDER A STORM. A cell whose weather falls hangs a veil from its base to the ground: a vertical cylinder of
 *  CURTAIN_SHARE of the cell's radius (the fall comes out of the core, not the skirt), its optical depth CURTAIN_EXT
 *  a metre at a full fall, thinning toward its rim, streaked vertically by CURTAIN_STREAKS streaks around its axis,
 *  and fading as the eye comes under it (the falling rain itself takes over there). CURTAIN_FALL is each word's
 *  fall - rain, the storm's heavier, snow lighter and paler (kind 1); a sandstorm is already a wall on the ground,
 *  and fog and cloud do not fall. */
export const CURTAIN_SHARE = 0.55;
/** VC7c: rain's own extinction, per metre at a fall of one - Koschmieder's 3.0 over moderate rain's five-kilometre
 *  visibility. The first cut took a fifth of it and a storm's curtain was a faint smear at the horizon: a real shaft
 *  a few kilometres across is near opaque, which is why one reads from thirty kilometres off. */
export const CURTAIN_EXT = 0.0006;
export const CURTAIN_STREAKS = 40;
/** VC7c: the fibres - a second, finer octave of streaks (three to each), and the share of a streak's weight it takes. */
export const CURTAIN_FIBRE = 0.4;
/** VC7c: THE RAGGED FOOT - toward its rim a curtain's streaks stop short of the ground (the rain evaporates on the
 *  way down: virga), each by its own amount - at the rim this share of the base on the average, half as much again
 *  at the most (0.9); the core reaches the ground. */
export const CURTAIN_VIRGA = 0.6;
/** VC7c: how many sky-map texels a streak must span before it is drawn at full contrast - under it, a far curtain's
 *  streaks would alias to shimmer as they cross the map's texels, so they fade to the curtain's mean. */
export const CURTAIN_STREAK_TEXELS = 3;
/** VC7c: how far up INTO its cell a curtain reaches, a share of the cell's depth, thinning to nothing at the top -
 *  a cloud's visible underside sits above its nominal base (the height ramp, VC7e's lifted lanes), and a curtain cut
 *  at the base left a strip of sky between the rain and the cloud it falls from. */
export const CURTAIN_INTO = 0.12;
/** VC7c: the veils' own aerial perspective, metres - the slab's 14 km is the far lid's, and at a storm's 20 km it
 *  handed three quarters of a curtain to the horizon: a storm that far off stands out plainly in clear air. */
export const CURTAIN_FADE_M = 40000;
export const CURTAIN_FALL = Object.freeze({ rain: Object.freeze([1, 0]), thunder: Object.freeze([1.3, 0]), snow: Object.freeze([0.7, 1]) });
/** VC7c: how far under the coverage cut the shape must read before the sky march may stride past it, where the
 *  column's profile can move within a stride - the margin that measured the same picture as no stride at all (the
 *  arc's AUDIT-VC7 table: under a rain cell 50 pixels off by more than 8 levels and none by 24, the dither's own
 *  jitter at a cloud's edge; every other sky none). */
export const SKIP_ROOM = 0.02;
/** VC7d (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - the high cirrus, the last of
 *  the four chosen): THE ICE LAYER. A thin shell of ice cloud at CIRRUS_ALT_M, far above the slab, read ONCE per ray
 *  where the ray meets it over a round earth (so it runs out to its own horizon, 339 km off, instead of to infinity).
 *  Its streaks lie along the upper wind - at these latitudes the westerly jet, whatever the surface wind is doing, so
 *  they ride east on the game's clock at CIRRUS_JET_M_PER_MINUTE (five times a fair day's surface drift, the ratio
 *  of a jet to the wind under it) and every player sees one ice sky. The tiles are CIRRUS_ALONG shape tiles down the jet
 *  and CIRRUS_ACROSS across it (the streaks), and the fibres CIRRUS_FIBRE_ALONG/ACROSS detail tiles - each dividing
 *  the field's period, so neither a recenter nor the jet's own wrap moves a streak. Its peak optical depth is
 *  CIRRUS_TAU (real cirrus runs 0.03 to 3; a veil you can see the blue through), fading into the horizon's haze over
 *  CIRRUS_FADE_M. */
export const CIRRUS_ALT_M = 9000;
export const CIRRUS_TAU = 0.6;
export const CIRRUS_ALONG = 16;
export const CIRRUS_ACROSS = 1;
export const CIRRUS_FIBRE_ALONG = 48;
export const CIRRUS_FIBRE_ACROSS = 1;
export const CIRRUS_FIBRE = 0.35;
/** VC7d: where the high air holds ice at all - a round, slow field CIRRUS_PATCH shape tiles across (the field's own
 *  period), so a fair sky has streaks in places and clear blue in others, not a sheet; and how far across the jet
 *  a medium field (CIRRUS_BEND shape tiles) bends the streaks, so they curve like mare's tails. The first cut was a
 *  sheet of parallel stripes from horizon to horizon, its fibres aliasing to a dotted grain. */
export const CIRRUS_PATCH = 16;
/** VC7d: THE WISPS - where the smooth fbm of the stretched volume stands above a threshold the cover lowers, a soft
 *  elongated wisp; the rest of the patch is blue. CIRRUS_WISP_TOP is the threshold with no cover, CIRRUS_WISP_COVER
 *  how far a full cover lowers it, CIRRUS_WISP_SOFT the width of a wisp's edge. (Two cuts drew the sky as a sheet:
 *  the Perlin-Worley cut by the cover crazed by its cell borders into dark contour lines, and the fbm's ridge, which
 *  drew EVERY contour - marbling, not cirrus.) */
export const CIRRUS_WISP_TOP = 0.66;
export const CIRRUS_WISP_COVER = 0.24;
export const CIRRUS_WISP_SOFT = 0.18;
export const CIRRUS_BEND = 16;
export const CIRRUS_BEND_M = 2500;
/** VC7d: a jet runs about five times the surface wind under it; the fair day's surface drift is the clouds' own
 *  integral (WIND2: the row's wind, on game minutes, in world metres), so the jet is five of those. */
export const CIRRUS_JET_RATIO = 5;
export const CIRRUS_JET_M_PER_MINUTE = CIRRUS_JET_RATIO * Math.hypot(...WEATHER_SKY.sunny.wind) * WIND_SECONDS_PER_MINUTE * WORLD_PER_DRIFT;
export const CIRRUS_FADE_M = 120000;
/** VC7d: ice crystals scatter hard forward - the sun's side of a cirrus veil is its brightest - but a crystal cloud
 *  scatters white light many times over, so from ANY side it is brighter than the clear sky behind it. The first cut
 *  lit it by the forward lobe alone and away from the sun it came out darker than the blue: dark contour lines round
 *  every streak. CIRRUS_FWD of the sun's share follows the lobe, the rest is isotropic; CIRRUS_AMB of the lit cloud
 *  colour is the sky's light on it. */
export const CIRRUS_G = 0.7;
export const CIRRUS_SUN = 0.8;
export const CIRRUS_FWD = 0.6;
export const CIRRUS_AMB = 0.45;
/** VC7d: how much of the sky carries cirrus under each word (eased with the weather). A fair sky shows it most - an
 *  overcast lid or a storm keeps theirs, but their own cloud hides it, which the march does by itself. */
export const CIRRUS_COVER = Object.freeze({ sunny: 0.45, cloudy: 0.5, overcast: 0.5, fog: 0.3, rain: 0.5, snow: 0.45, thunder: 0.6, sandstorm: 0.15 });
/** VC7e: how full a column is on the average (the shape noise past its coverage cut) - columnAbove's estimate. */
export const COLUMN_FILL = 0.5;
/** The shadow map's square, in metres: SIXTEEN pixels a side, the
 *  camera's pixel in the middle, so the near edge stands 6144 m out -
 *  past the fog's end at Land View Distance 4 (3200 m) either way.
 *  Sixteen and not twelve: a pixel must be a WHOLE number of the map's
 *  texels at every tier (256/16, 512/16, 1024/16), which the crossing's
 *  texel shift (`_shiftShadowMap`) depends on - twelve left 0.67 of a
 *  texel behind at every crossing. Pinned. */
export const SHADOW_EXTENT = PIXEL_METRES * 16;
/** How much of the sun a full shadow takes (the ambient is never
 *  touched - a cloud dims the sun and leaves the sky's light alone). */
export const SHADOW_AMOUNT = 1.0;

/** Per-weather PROFILE, eased on the weather ease's own clock: the
 *  slab's base and top (metres), how dense the cloud is, how dark
 *  (the storm's underside), how flat (0 towers, 1 a stratus lid),
 *  how far the tops lead the base per metre of height - and VC6a's
 *  `vary`, how much the cloud's TYPE changes from one part of the sky
 *  to the next.
 *
 *  VC6a: `vary` is the answer to the second half of Mac's report. Every
 *  cloud in a sunny sky used to be the same cloud - one flatness, one
 *  ceiling, for the whole zone - so even a field that never repeated
 *  its noise would still have read as repetitive, because it only had
 *  ONE THING TO SAY. It leans on the variation field that is already
 *  read for the coverage: where there is more cloud there is flatter,
 *  deeper cloud (more cover means a settling deck), where there is less
 *  there are shallow towers. A lid weather takes 0 and is unchanged -
 *  fog and a sandstorm ARE one thing, everywhere. */
export const VC_PROFILE = Object.freeze({
  sunny:    Object.freeze({ base: 1400, top: 3200, density: 0.60, dark: 0.00, flat: 0.10, shear: 0.35, vary: 0.50 }),
  cloudy:   Object.freeze({ base: 1200, top: 3000, density: 0.70, dark: 0.10, flat: 0.35, shear: 0.40, vary: 0.45 }),
  overcast: Object.freeze({ base: 800,  top: 1600, density: 0.80, dark: 0.30, flat: 0.90, shear: 0.20, vary: 0.15 }),
  fog:      Object.freeze({ base: 150,  top: 600,  density: 1.00, dark: 0.20, flat: 1.00, shear: 0.05, vary: 0.00 }),
  rain:     Object.freeze({ base: 600,  top: 2600, density: 0.90, dark: 0.50, flat: 0.70, shear: 0.30, vary: 0.25 }),
  snow:     Object.freeze({ base: 600,  top: 2000, density: 0.80, dark: 0.30, flat: 0.85, shear: 0.20, vary: 0.20 }),
  thunder:  Object.freeze({ base: 500,  top: 4200, density: 1.00, dark: 0.70, flat: 0.50, shear: 0.50, vary: 0.40 }),
  sandstorm: Object.freeze({ base: 0,   top: 900,  density: 1.00, dark: 0.35, flat: 0.95, shear: 0.05, vary: 0.00 }),   // WEATHER2d: a wall on the ground, a lid 900 m up
});
/** AUDIT-VC7 (B3): the type variation at which a sky is wholly a deck's - the least any varying row takes, so every
 *  row that varies at all is (overcast's 0.15), and fog and a sandstorm (0: one thing everywhere) are not, with a
 *  cell's rim easing between them instead of snapping. */
export const DECK_VARY_FULL = Math.min(...Object.values(VC_PROFILE).map((r) => r.vary).filter((v) => v > 0));
/** WEATHER2d: a cell's TINT on the zone's cloud colours - the sandstorm's
 *  tan; every other word takes the row's colours unchanged. */
export const CELL_TINT = Object.freeze({ sandstorm: Object.freeze([0.88, 0.72, 0.46]) });
const PROFILE_KEYS = ['base', 'top', 'density', 'dark', 'flat', 'shear', 'vary'];   // VC6a: `vary` eases with the rest

// ═══ VC7a (2026-09-23): LIVING CLOUDS ════════════════════════════════
// Mac: "improve the volumetric cloud system to be more immersive". The
// field was a fixed noise volume slid across the land by the wind: a bank
// was the same bank from the horizon to the horizon. Three clocks now
// give it a life, every one of them read from the GAME's minutes (the
// sky state's `minutes`), so every player online sees the same boil (the cover's drift rides the session's own wind
// integral, WIND2's, as the whole field always has):
//   - THE BOIL: the shape volume is read through its own height as the
//     minutes pass (EVOLVE_M_PER_MINUTE), the detail faster, so the
//     towers' structure rises through the cloud and its edges churn;
//   - THE COVER'S OWN WIND: the coverage field drifts at COVER_DRIFT_SHARE
//     of the air, not with it, and turns through its own slice over the
//     day, so a place's cover changes under the air passing through it -
//     banks build on one side and dissolve on the other as they travel;
//   - THE DAY'S CONVECTION: fair-weather cloud (FAIR_WEATHERS) builds
//     through the day (`convection`): its TOPS hold the night's floor
//     until mid-morning (8:30), rise to the towers two and a half hours
//     after the sun is highest (14:30), and sink through the evening to
//     the floor again by 20:30.
//     Its cover stays DFU's row: the lab showed this slab's scattered
//     cumulus sits right at its coverage threshold - a fair row's cover
//     raised by a tenth turned the afternoon into a smeared haze - so the
//     day lives in the towers' height, not in how much sky they take.
// And a weather-map cell's cloud takes its system's envelope (`grownCell`):
// a newborn front is a thin deck that deepens as it grows. Every offset
// is wrapped to its own volume's period, as CLK1 wraps the drift, so a
// year of game minutes never outgrows a float.
/** Metres per game minute the shape volume is read upward - an updraft's
 *  order (2 m/s of game time), and the detail's two and a half times it. */
export const EVOLVE_M_PER_MINUTE = 120;
export const DETAIL_EVOLVE_M_PER_MINUTE = 300;
/** The share of the air's drift the coverage field moves with. */
export const COVER_DRIFT_SHARE = 0.6;
/** How far through the coverage volume's slice a game minute turns it: a
 *  whole turn a game day, so the weather's lay of cover renews daily. */
export const COVER_EVOLVE_PER_MINUTE = 1 / 1440;
/** The rows that convect - the fair-weather sky; a deck, a front, fog and a
 *  sandstorm keep their own profile through the day. */
export const FAIR_WEATHERS = Object.freeze(['sunny', 'cloudy']);
/** THE DAY'S CONVECTION: the ground heats behind the sun, so the lift
 *  follows the sun's height CONVECTION_LAG_MINUTES late (the towers peak
 *  mid-afternoon); the tops never below CONVECTION_DEPTH_FLOOR of the
 *  row's depth - a morning's and a night's flat cumulus. */
export const CONVECTION_LAG_MINUTES = 150;
export const CONVECTION_DEPTH_FLOOR = 0.4;
const liftAt = (minuteOfDay) => Math.max(0, sunSkyDirection((((minuteOfDay - CONVECTION_LAG_MINUTES) % 1440) + 1440) % 1440)[1]);
const LIFT_PEAK = (() => { let peak = 0; for (let m = 0; m < 1440; m++) peak = Math.max(peak, liftAt(m)); return peak; })();
/** The day's convection at a minute of the day: `depth`, the share of a
 *  fair row's depth its tops reach - 1 at the afternoon's peak,
 *  CONVECTION_DEPTH_FLOOR through the night. Pure. */
export function convection(minuteOfDay) {
  return { depth: CONVECTION_DEPTH_FLOOR + (1 - CONVECTION_DEPTH_FLOOR) * liftAt(minuteOfDay) / LIFT_PEAK };
}
/** A cloud cell of a fair weather under the day's convection `conv`: its
 *  tops brought down toward its base by the hour, its cover the row's;
 *  any other weather's cell as it is. Pure. */
export function convectCell(cell, conv) {
  if (!cell || !conv || !FAIR_WEATHERS.includes(cell.word)) return cell;
  return { ...cell, top: cell.base + (cell.top - cell.base) * conv.depth };
}
/** AUDIT-VC7 (R3): the zone's slab under the day's convection `conv`, weighed in by `fair` - how much of a fair
 *  weather's the zone is by now (1 all, 0 none: a deck, a front, fog and a sandstorm keep their own tops). Pure. */
export function convectZone(profile, conv, fair) {
  if (!conv) return { base: profile.base, top: profile.top };
  return { base: profile.base, top: profile.base + (profile.top - profile.base) * (1 - fair * (1 - conv.depth)) };
}
/** How thin a cell's cloud is at its system's birth: the share of its
 *  cover, its depth and its density at an envelope of 0 (1 at full
 *  growth). */
export const GROWTH_FLOOR = Object.freeze({ cover: 0.5, depth: 0.45, density: 0.7 });
/** A cell's cloud at its system's envelope `env`: grown in cover, depth
 *  and density from GROWTH_FLOOR at birth to the whole profile; no
 *  envelope, the whole profile. Pure. */
export function grownCell(cell, env) {
  if (!cell || env == null || env >= 1) return cell;
  const e = Math.max(0, env), at = (floor) => floor + (1 - floor) * e;
  return { ...cell, cover: cell.cover * at(GROWTH_FLOOR.cover), top: cell.base + (cell.top - cell.base) * at(GROWTH_FLOOR.depth), density: cell.density * at(GROWTH_FLOOR.density), fall: (cell.fall ?? 0) * e };   // VC7c: a young system's rain is young too
}
/** The three clocks at a game minute and a drift (world metres, already
 *  wrapped): the shape's and the detail's reading offsets (metres, each
 *  wrapped to its own volume's period), the coverage slice's turn (0..1)
 *  and the coverage field's own drift (wrapped to the field's period).
 *  Pure. */
export function cloudClocks(minutes, driftWorld) {
  const wrap = (v, period) => v - Math.floor(v / period) * period;
  return {
    evolve: [wrap(minutes * EVOLVE_M_PER_MINUTE, SHAPE_METRES), wrap(minutes * DETAIL_EVOLVE_M_PER_MINUTE, DETAIL_METRES), wrap(minutes * COVER_EVOLVE_PER_MINUTE, 1)],
    coverDrift: [wrapField(driftWorld[0] * COVER_DRIFT_SHARE), wrapField(driftWorld[1] * COVER_DRIFT_SHARE)],
    cirrus: wrapField(minutes * CIRRUS_JET_M_PER_MINUTE),   // VC7d: the jet's offset east, wrapped to the field's period - every tile the ice reads divides it
    // AUDIT 68 S17-cirrus-boil-wrap: the ice boils at half the slab's rate on its OWN clock, a share (0..1) of the
    // shape volume wrapped to a whole volume - half of evolve[0] jumped half a volume at each of its wraps
    cirrusBoil: wrap(minutes * EVOLVE_M_PER_MINUTE * 0.5, SHAPE_METRES) / SHAPE_METRES,
  };
}

// ═══ WEATHER2c (2026-09-14): CLOUD TYPES BY PLACE ═══════════════════
// Mac: "different generative cloud types, like being able to see a
// thunderhead in the distance with the weather happening elsewhere."
// The field had ONE profile for the whole sky - the zone's word, eased.
// It takes CELLS now: a world position, a radius and a soft rim, and a
// profile of its own (base, top, density, flat, dark, shear) with its
// weather's cover and grey, blended over the zone's terms by the rim's
// weight at every sample both marches take, so a thunderhead stands
// over the hills under a sunny zone and its shadow falls where it
// stands. The slab both marches walk is the UNION of the zone's and
// the cells', so a cell's tops are reached under a lower zone. The
// cells are in the HOST's world metres (the space `pos` is in - the
// floating origin moves the host, the controller hands fresh cells
// every frame, and a test cell is shifted on the recenter with the
// camera); the noise still samples at the absolute, wrapped position.
// Ships with `?cloudcell=<weather>[,<metres ahead>[,<radius>]]` - one
// static cell east of the boot position - and takes the weather
// field's cells (slice B) through the same door in setState.

/** A cell of `weather`'s profile at (x, z), radius r (metres). Pure. */
export function cellOf(weather, x, z, r) {
  const p = VC_PROFILE[weather];
  if (!p) return null;
  const fall = CURTAIN_FALL[weather];   // VC7c: what falls under it, and what kind
  return { x, z, r, edge: r * CELL_EDGE, ...p, word: weather, cover: WEATHER_SKY[weather]?.cover ?? 1, grey: WEATHER_SKY[weather]?.grey ?? 0, fall: fall ? fall[0] : 0, fallKind: fall ? fall[1] : 0, ...(CELL_TINT[weather] ? { tint: CELL_TINT[weather] } : {}) };   // VC7a: the word it is, for the day's convection
}

/** WEATHER3c/3g: a world weather map cell (weatherMap.js skyCells, in
 *  field metres) as a cloud cell in the host's metres - `toHost(x, z)`
 *  the host's own frame change - carrying its importance and rank to the
 *  pick, and a storm cell's `clip`: the disc it paints within (its front's
 *  core), moved by the same frame change. The one conversion both
 *  exterior hosts make. Pure over toHost. */
export function cellOfField(c, toHost) {
  const [x, z] = toHost(c.x, c.z);
  const cell = grownCell(cellOf(c.word, x, z, c.r), c.env);   // VC7a: as grown as its system
  if (!cell || c.imp == null) return cell;
  const out = { ...cell, imp: c.imp, rank: c.rank };
  if (c.shape) out.shape = c.shape;   // WEATHER3h: its outline; a frame change is a translation, the shape rides it
  if (c.clip) out.clip = [...toHost(c.clip[0], c.clip[1]), c.clip[2], c.clip[3] ?? null];
  return out;
}

/** AUDIT-VC7 (R4): HOW FAST A SHAPE'S OUTLINE TURNS - the most its reach m(theta) = n (1 + sum a_k cos k(theta -
 *  phi_k)) can change a radian of bearing: n sum k a_k, the bound of |m'| (each harmonic's slope at most k a_k). The
 *  sky march asks it whether a stride's disc can meet a rim (resolveAt's rimReach). 0 for a circle. Pure. */
export function shapeTurn(sh) {
  if (!sh) return 0;
  return sh[0] * (2 * Math.hypot(sh[1], sh[2]) + 3 * Math.hypot(sh[3], sh[4]) + 4 * Math.hypot(sh[5], sh[6]));
}

/** The cells packed for the shader's nine arrays (x, z, r, edge |
 *  base, top, density, flat | dark, shear, cover, grey | tint, vary |
 *  WEATHER3g the clip disc: x, z, r, its rim - r -1 for none | WEATHER3h
 *  the cell's shape and its clip's, each two vec4s: n, c2, s2, c3 | s3,
 *  c4, s4, AUDIT-VC7 how fast it turns (shapeTurn) - a circle is 1, 0, 0, 0 | 0, 0, 0, 0), capped at `cap`;
 *  the rim never narrower than a metre (smoothstep's edges must be
 *  ordered). Pure over the arrays it is handed. */
export function packCells(cells, cap, out = { c: new Float32Array(MAX_CELLS * 4), a: new Float32Array(MAX_CELLS * 4), b: new Float32Array(MAX_CELLS * 4), t: new Float32Array(MAX_CELLS * 4), k: new Float32Array(MAX_CELLS * 4) }) {
  const n = Math.min(cells?.length ?? 0, cap, MAX_CELLS);
  out.t ??= new Float32Array(MAX_CELLS * 4);   // WEATHER2d: the tints
  out.k ??= new Float32Array(MAX_CELLS * 4);   // WEATHER3g: the clips
  for (const key of ['s', 'u', 'ks', 'ku']) out[key] ??= new Float32Array(MAX_CELLS * 4);   // WEATHER3h: the shapes
  out.f ??= new Float32Array(MAX_CELLS * 4);   // VC7c: the fall under each
  const shape = (sh, a, b, o) => {
    a[o] = sh ? sh[0] : 1; a[o + 1] = sh ? sh[1] : 0; a[o + 2] = sh ? sh[2] : 0; a[o + 3] = sh ? sh[3] : 0;
    b[o] = sh ? sh[4] : 0; b[o + 1] = sh ? sh[5] : 0; b[o + 2] = sh ? sh[6] : 0; b[o + 3] = shapeTurn(sh);   // AUDIT-VC7 (R4): the spare w
  };
  for (let i = 0; i < n; i++) {
    const c = cells[i], o = i * 4;
    out.c[o] = c.x; out.c[o + 1] = c.z; out.c[o + 2] = c.r; out.c[o + 3] = Math.max(1, c.edge ?? c.r * CELL_EDGE);
    out.a[o] = c.base; out.a[o + 1] = c.top; out.a[o + 2] = c.density; out.a[o + 3] = c.flat;
    out.b[o] = c.dark; out.b[o + 1] = c.shear; out.b[o + 2] = c.cover; out.b[o + 3] = c.grey ?? 0;
    const t = c.tint ?? [1, 1, 1];
    out.t[o] = t[0]; out.t[o + 1] = t[1]; out.t[o + 2] = t[2]; out.t[o + 3] = c.vary ?? 0;   // VC6a: the spare w is the cell's own type variation
    // WEATHER3g: a storm cell's clip - its front's core - with the cell's own rim, so the cloud stands where the word is
    if (c.clip) { out.k[o] = c.clip[0]; out.k[o + 1] = c.clip[1]; out.k[o + 2] = c.clip[2]; out.k[o + 3] = out.c[o + 3]; } else { out.k[o] = 0; out.k[o + 1] = 0; out.k[o + 2] = -1; out.k[o + 3] = 1; }
    shape(c.shape, out.s, out.u, o);
    shape(c.clip?.[3], out.ks, out.ku, o);
    out.f[o] = c.fall ?? 0; out.f[o + 1] = c.fallKind ?? 0; out.f[o + 2] = 0; out.f[o + 3] = 0;   // VC7c
  }
  out.count = n;
  return out;
}

/** WEATHER3c: THE CELLS THE SLOTS HOLD, IN THE ORDER THEY ARE DRAWN.
 *  Cells that carry an `imp` (the world weather map's) are chosen by it
 *  - the `cap` that matter most to the eye - and then ordered by their
 *  word's `rank` from the lowest priority to the highest (a larger disc
 *  first within a word), because the blend is last-over-first and the
 *  storm's heart must win its own skirt. Cells without one (WEATHER2b's
 *  field, the test door) keep their order and are cut at the cap, as
 *  before. Pure. */
export function pickCells(cells, cap) {
  const list = cells ?? [];
  if (!list.some((c) => c.imp != null)) return list.slice(0, cap);
  return [...list].sort((a, b) => (b.imp ?? 0) - (a.imp ?? 0)).slice(0, cap)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || b.r - a.r);
}

/** WEATHER3d: the height a distant strike's light is aimed at - a
 *  thunderhead's middle (VC_PROFILE.thunder's slab, 500 m to 4200 m). */
export const BOLT_HEIGHT = (VC_PROFILE.thunder.base + VC_PROFILE.thunder.top) / 2;
/** WEATHER3d: a strike at (x, z), its cloud `r` across, seen from the
 *  camera at `cam` ([x, z]): the unit direction to the cloud's middle and
 *  the cosine of the cone the cloud fills (a little wider, for the glow
 *  about it). Pure. */
export function boltOf({ x, z, r, strength }, cam) {
  const dx = x - cam[0], dz = z - cam[1];
  const flat = Math.max(1, Math.hypot(dx, dz)), len = Math.hypot(flat, BOLT_HEIGHT);
  const half = Math.min(Math.PI / 3, Math.atan2(r * 1.3, len));
  return { dir: [dx / len, BOLT_HEIGHT / len, dz / len], cos: Math.cos(half), strength: Math.max(0, Math.min(1, strength)) };
}

/** The test door: `thunder`, `thunder,6000`, `thunder,6000,3000` - a
 *  cell of that weather `ahead` metres east (+x) of `pos`, radius `r`.
 *  Null for no door or an unknown weather. Pure. */
export function parseCloudCellDoor(spec, pos) {
  if (!spec || !pos) return null;
  const [weather, ahead = '6000', r = '3000'] = String(spec).split(',');
  const d = Number(ahead), rad = Number(r);
  if (!VC_PROFILE[weather] || !Number.isFinite(d) || !(rad > 0)) return null;
  return cellOf(weather, pos[0] + d, pos[2], rad);
}

/** One eased value, the profile's own exponential over `dt` game minutes: none yet, the target whole. Pure. */
export function easeOnWeatherSpan(from, to, dt, span = WEATHER_EASE_MINUTES) {
  if (from == null) return to;
  return from + (to - from) * (span <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / span));
}
/** The profile's ease - the SAME exponential the weather row takes
 *  (enhancedSky.js easeWeather), on the same `dt` (game minutes, CLK1)
 *  the controller stretches across a front, so the slab rises and
 *  thickens at the pace the cover does. Pure. */
export function easeProfile(from, to, dt, span = WEATHER_EASE_MINUTES) {
  if (!from) return { ...to };
  const k = span <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / span);
  const out = {};
  for (const key of PROFILE_KEYS) out[key] = from[key] + (to[key] - from[key]) * k;
  return out;
}

/** The light the clouds take: the sun while it is up, else the
 *  brighter visible moon (EV5's colour, dimmed), else none. `profile`
 *  is the slab the light falls on - its mid-height sets how far past
 *  the ground's horizon the deck can still see the sun (VC6b). Pure. */
export function cloudLight(state, profile = null) {
  // VC6b: THE SUN SETS FOR THE CLOUD LAST. The weight used to be
  // `(sunDir.y + 0.02) / 0.08` - a window fitted by eye that put the
  // light out by the time the sun reached two and a half degrees, which
  // is the exact half hour Mac is describing. It is not a matter of
  // taste: a deck whose middle stands 2300 m up sees 1.54 degrees
  // further than the player does, so it holds the sun until the sun is
  // that far BELOW the player's horizon - and holds it in the colour
  // the palette gives a sun at that elevation, which is ember. The
  // fade is over the last degree and a bit (0.025 in sine), the width
  // of the disc plus the depth of the deck, so the light goes out the
  // way it does over a real landscape and not at a line.
  const mid = profile ? (profile.base + profile.top) / 2 : 2300;
  const w = Math.min(1, Math.max(0, (state.sunDir[1] + horizonDip(mid)) / 0.025));
  const moons = [state.masser, state.secunda].filter((m) => m && m.dir[1] > 0.02 && m.vis > 0);
  const m = moons.length ? moons.reduce((a, b) => (a.vis * a.color[0] >= b.vis * b.color[0] ? a : b)) : null;
  const moon = m ? [m.color[0] * 0.12 * m.vis, m.color[1] * 0.12 * m.vis, m.color[2] * 0.14 * m.vis] : [0, 0, 0];
  if (w > 0) return { dir: state.sunDir, color: [state.sun[0] * w + moon[0] * (1 - w), state.sun[1] * w + moon[1] * (1 - w), state.sun[2] * w + moon[2] * (1 - w)], day: w };
  return { dir: m ? m.dir : [0, 1, 0], color: moon, day: 0 };
}

/** VC7d: the light on the ice layer - cloudLight at CIRRUS_ALT_M (it sees three degrees past the ground's horizon),
 *  and the sun in the colour the palette gives it at the elevation the ICE sees it at: the player's elevation plus
 *  that dip. So when the sun has set for the player and gone to ember for the deck, the cirrus is still gold - the
 *  last colour in a sunset sky - and it goes out three degrees after the ground. Pure. */
export function cirrusLight(state) {
  const L = cloudLight(state, { base: CIRRUS_ALT_M, top: CIRRUS_ALT_M });
  if (L.day <= 0) return L;
  const elev = (state.elevDeg ?? Math.asin(Math.max(-1, Math.min(1, state.sunDir[1]))) * 180 / Math.PI) + horizonDip(CIRRUS_ALT_M) * 180 / Math.PI;
  const sun = paletteAt(elev).sun, w = L.day;
  return { dir: L.dir, color: [0, 1, 2].map((i) => sun[i] * w + (L.color[i] - state.sun[i] * w)), day: w };
}

/** VC6b: HOW MUCH OF THE LOW-SUN LOOK THIS FRAME TAKES, 0..1 - the one
 *  weight behind all three of VC6b's terms. Pure.
 *
 *  It lives here, on the CPU, and not as a smoothstep on uLightDir in
 *  the march, because uLightDir is NOT ALWAYS THE SUN: once the sun is
 *  down it is the brighter visible MOON's, and a moon near the horizon
 *  read as "the sun is low" - it lit the undersides, opened the direct
 *  gain and tinted half the sky, a swing that appeared and vanished as
 *  the moon crossed seventeen degrees, driven by the wrong body.
 *  `dayWeight` is the SUN's own weight (cloudLight's `day`), so this is
 *  exactly zero at night and the whole of VC6b is off: a night sky is
 *  the one it was before the slice. Pinned by value.
 *
 *  @param {number} sunY the sun's direction's y - its own, never the light's
 *  @param {number} dayWeight cloudLight's `day`: 1 while the DECK still sees the sun
 */
export function duskWeight(sunY, dayWeight) {
  const t = Math.min(1, Math.max(0, (0.30 - sunY) / 0.33));   // 0 above 17 degrees, 1 at and below the horizon
  return dayWeight * t * t * (3 - 2 * t);
}

/** VC4: the shadow map's square for a camera at (x, z): its corner,
 *  snapped to the pixel grid with the camera's pixel in the middle.
 *  Pure - the seam that keeps a recenter from moving the map. */
export function shadowOrigin(camX, camZ, extent = SHADOW_EXTENT, pixel = PIXEL_METRES) {
  return [Math.floor(camX / pixel) * pixel - extent / 2 + pixel / 2, Math.floor(camZ / pixel) * pixel - extent / 2 + pixel / 2];
}

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`;   // PERF2: at the far plane for the composite's depth test; the marches test nothing

/** THE FIELD: the density at a world point, and everything both
 *  marches share. Declared with its own uniforms and interpolated into
 *  each march's template (the AUDIT 47 sweep expands it there). */
export const CLOUD_FIELD_GLSL = `
uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform float uCover;
uniform float uSoft;
uniform float uBase;
uniform float uTop;
uniform float uDensity;
uniform float uFlat;
uniform float uShear;
uniform float uDark;
uniform float uVary;      // VC6a: how much the cloud's TYPE changes across the zone
uniform int uCellCount;   // WEATHER2c: the cells, in the host's world metres
uniform vec4 uCell[8];    // x, z, radius, the rim's width
uniform vec4 uCellA[8];   // base, top, density, flat
uniform vec4 uCellB[8];   // dark, shear, cover, grey
uniform vec4 uCellC[8];   // WEATHER2d: the tint on the zone's cloud colours (rgb); VC6a: w the cell's own vary
uniform vec4 uCellK[8];   // WEATHER3g: the disc a storm cell paints within (its front's core): x, z, radius (-1 none), rim
uniform vec4 uCellS[8];   // WEATHER3h: a cell's shape, n c2 s2 c3 | s3 c4 s4 - weatherMap.js shapeFactor's polynomial
uniform vec4 uCellU[8];   // ...w (AUDIT-VC7) how fast its outline turns: the most its reach changes a radian
uniform vec4 uCellKS[8];  // WEATHER3h: its clip's shape (its front's)
uniform vec4 uCellKU[8];
uniform vec2 uDrift;      // world metres
uniform vec3 uEvolve;     // VC7a: the shape's and the detail's reading offset up their volumes (metres), the coverage slice's turn
uniform vec2 uCoverDrift; // VC7a: the coverage field's own drift - a share of the air's, so cover builds and dissolves in it
uniform vec2 uShift;      // the floating origin's recenters, accumulated - added to every position so the field is sampled where it ABSOLUTELY is
uniform vec2 uCamXZ;      // the camera's world position, the sky map's own origin
const float EXT = ${EXTINCTION.toFixed(4)};
const float SHAPE_M = ${SHAPE_METRES.toFixed(1)};
const float DETAIL_M = ${DETAIL_METRES.toFixed(1)};
const float VARIATION_M = ${VARIATION_METRES.toFixed(1)};
const float MOTTLE_M = ${MOTTLE_METRES.toFixed(1)};
const float WARP_M = ${WARP_METRES.toFixed(1)};
float remap(float v, float lo, float hi, float nlo, float nhi) { return nlo + (v - lo) / (hi - lo) * (nhi - nlo); }
// WEATHER3h: m(theta) of a shape along the unit direction u - cos and sin of 2, 3 and 4 theta by the multiple-angle
// identities, as weatherMap.js shapeFactor reads them; a point's distance in the shape's own measure is its distance
// over this
float shapeF(vec4 a, vec4 b, vec2 u) {
  float c = u.x, s = u.y;
  float c2 = c * c - s * s, s2 = 2.0 * c * s, c3 = c * (4.0 * c * c - 3.0), s3 = s * (3.0 - 4.0 * s * s), c4 = 2.0 * c2 * c2 - 1.0, s4 = 2.0 * s2 * c2;
  return a.x * (1.0 + a.y * c2 + a.z * s2 + a.w * c3 + b.x * s3 + b.y * c4 + b.z * s4);
}
float shapedDist(vec2 v, vec4 a, vec4 b) { float l = length(v); return l / shapeF(a, b, v / max(l, 1e-3)); }
// VC7c / AUDIT-VC7 (R4): WHETHER A STRIDE'S DISC - reach metres about v - lies wholly inside an outline's band
// (x: every point under inner in the shape's measure) or wholly outside it (y: every point past outer). The disc spans
// bearings within asin(reach / |v|) of v's, and over them the outline's reach moves at most its turn a radian (b.w,
// packCells), never past its bounds whatever the bearing - so the answer is the shape's own, not a circle's.
vec2 rimReach(vec2 v, vec4 a, vec4 b, float inner, float outer, float reach) {
  float l = length(v);
  float m = shapeF(a, b, v / max(l, 1e-3));
  float spread = a.x * (length(a.yz) + length(vec2(a.w, b.x)) + length(b.yz));
  float turn = l > reach ? asin(reach / l) * b.w : spread;
  float lo = max(m - turn, a.x - spread), hi = min(m + turn, a.x + spread);
  return vec2(l + reach < inner * lo ? 1.0 : 0.0, l - reach > outer * hi ? 1.0 : 0.0);
}
// SLAB-SPAN: WHERE A RAY CAN MEET CLOUD - the parts of o + d t (d.y > 0) inside the zone's slab, or inside a cell's
// column: the disc its outline can reach (shapeF is never past n + spread), between the lowest base and the highest
// top its weight can blend a column to. Sorted by entry and merged, so spanA/spanB hold disjoint spans in order;
// the return is their length. Both marches walk these and nothing else: the union slab they walked before
// (WEATHER2c) took every cell's reach for every ray, so a low cell anywhere in the sky started every ray under the
// zone's deck, and at a grazing angle the sky march's 24 km ran out in the air beneath it - a strip of bare dome
// round the whole horizon.
const int SPANS = 9;
float spanA[SPANS];
float spanB[SPANS];
int spanN;
void addSpan(float a, float b) {
  if (b <= a) return;
  int i = spanN;
  for (int j = 0; j < SPANS; j++) {
    if (i == 0 || spanA[i - 1] <= a) break;
    spanA[i] = spanA[i - 1]; spanB[i] = spanB[i - 1]; i--;
  }
  spanA[i] = a; spanB[i] = b; spanN++;
}
float raySpans(vec3 o, vec3 d) {
  spanN = 0;
  addSpan((uBase - o.y) / d.y, (uTop - o.y) / d.y);
  float a2 = dot(d.xz, d.xz);
  for (int i = 0; i < 8; i++) {
    if (i >= uCellCount) break;
    vec4 c = uCell[i], s = uCellS[i], u = uCellU[i], a = uCellA[i];
    float reach = c.z * s.x * (1.0 + length(s.yz) + length(vec2(s.w, u.x)) + length(u.yz));
    float lo = (min(uBase, a.x) - o.y) / d.y, hi = (max(uTop, a.y) - o.y) / d.y;
    vec2 q = o.xz - c.xy;
    float qq = dot(q, q) - reach * reach;
    if (a2 < 1e-12) { if (qq <= 0.0) addSpan(lo, hi); continue; }   // straight up: in the disc or not
    float b = dot(q, d.xz) / a2, disc = b * b - qq / a2;
    if (disc <= 0.0) continue;
    float r = sqrt(disc);
    addSpan(max(lo, -b - r), min(hi, -b + r));
  }
  int n = 0;
  for (int i = 0; i < SPANS; i++) {
    if (i >= spanN) break;
    if (n > 0 && spanA[i] <= spanB[n - 1]) spanB[n - 1] = max(spanB[n - 1], spanB[i]);
    else { spanA[n] = spanA[i]; spanB[n] = spanB[i]; n++; }
  }
  spanN = n;
  float len = 0.0;
  for (int i = 0; i < SPANS; i++) { if (i >= spanN) break; len += spanB[i] - spanA[i]; }
  return len;
}
// VC7c: THE STRIDE'S EVIDENCE - density() sets it with every answer: 1 when its zero is one that holds for a stride
// (outside the band, whose ends move only at a cell's rim; above or below every height a deck's lane and its core
// can put the cloud; under the coverage cut, whose field is kilometres across), 0 when it does not. VC7e's deck cells
// lift a lane's base and lower its ceiling every two kilometres, and a ray that read "nothing here" above a lane
// strode clean over the core beside it - specks of sky in a cloud's crown.
float fSkip;
// VC7c: whether a cell's rim - its own outline's, or its clip's - is within a stride of here (resolveAt), so the
// column's base, top and type can change before the next sample; fReach is how far a stride reaches, set by the sky
// march (0 for the shadow march, which never strides)
float fNear;
float fReach = 0.0;
// WEATHER2c: THE PROFILE AT A PLACE. The zone's terms, with every cell
// whose rim reaches this ground point blended over them by its weight -
// resolved before a march and again at every step while cells stand,
// so a ray through a thunderhead takes the storm's terms only where the
// storm is. The light march reads what the step resolved.
float fBase, fTop, fDensity, fFlat, fShear, fCover, fDark, fGrey, fVary;
vec3 fTint;
void resolveAt(vec2 xz) {
  fBase = uBase; fTop = uTop; fDensity = uDensity; fFlat = uFlat; fShear = uShear; fCover = uCover; fDark = uDark; fGrey = 0.0; fTint = vec3(1.0); fVary = uVary;
  fNear = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uCellCount) break;
    vec4 c = uCell[i];
    float dc = shapedDist(xz - c.xy, uCellS[i], uCellU[i]);
    float w = 1.0 - smoothstep(c.z - c.w, c.z, dc);   // WEATHER3h: its own outline
    vec4 k = uCellK[i];
    float dk = k.z > 0.0 ? shapedDist(xz - k.xy, uCellKS[i], uCellKU[i]) : 0.0;
    if (k.z > 0.0) w *= 1.0 - smoothstep(k.z - k.w, k.z, dk);   // WEATHER3g: only inside its front
    // VC7c: whether its weight can change within a stride - it cannot where either term stays 0 for a stride's reach,
    // or where both stay 1: a cell's inside is its own terms all through, and only its rims move the profile
    vec2 rc = rimReach(xz - c.xy, uCellS[i], uCellU[i], c.z - c.w, c.z, fReach);
    vec2 rk = k.z > 0.0 ? rimReach(xz - k.xy, uCellKS[i], uCellKU[i], k.z - k.w, k.z, fReach) : vec2(1.0, 0.0);
    if (rc.y < 0.5 && rk.y < 0.5 && (rc.x < 0.5 || rk.x < 0.5)) fNear = 1.0;
    if (w <= 0.0) continue;
    vec4 a = uCellA[i], b = uCellB[i];
    fBase = mix(fBase, a.x, w); fTop = mix(fTop, a.y, w); fDensity = mix(fDensity, a.z, w); fFlat = mix(fFlat, a.w, w);
    fDark = mix(fDark, b.x, w); fShear = mix(fShear, b.y, w); fCover = mix(fCover, b.z, w); fGrey = mix(fGrey, b.w, w);
    fTint = mix(fTint, uCellC[i].rgb, w);   // WEATHER2d
    fVary = mix(fVary, uCellC[i].w, w);     // VC6a: the cell's own type variation
  }
}
// AUDIT-VC7 (B3): HOW MUCH OF A DECK THE SKY IS HERE - the cover's band, and only where the cloud's type varies at all
// (fog and a sandstorm are one thing everywhere: no lanes and no cores, no octaves). ONE function, so the column's
// lanes, the stride's evidence and the light's octaves can never disagree about it.
float deckWeight() {
  return smoothstep(${glslF(DECK_COVER_LO)}, ${glslF(DECK_COVER_HI)}, fCover) * smoothstep(0.0, ${glslF(DECK_VARY_FULL)}, fVary);
}
// the towers' profile against a stratus lid's, by the flatness AT THIS
// PLACE (VC6a: the zone's, moved by the variation field; it was fFlat
// for the whole sky, which is why every cloud was the same cloud)
float heightGradient(float h, float lidness) {   // not 'flat': GLSL ES 3.00 reserves it as an interpolation qualifier, and the shader will not compile
  float towers = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.5, 1.0, h));
  float lid = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.25, 0.5, h));
  return mix(towers, lid, lidness);
}
// VC7e: THE COLUMN over a ground point - everything density() knows before it reads the shape volume, and all of
// it the same at every height: the variation sample, the cloud's type here, its ceiling, and the deck's cells.
// Returns (the point's height in the band after its lane's lift, the ceiling, the local lidness, the variation);
// v is the variation sample itself (its gb warp the shape read); span (AUDIT-VC7) the least and the most the point's
// height under its ceiling can be anywhere from a lane's middle to a core's, the range a stride can carry it through.
// ONE function, so the density and the sky's light through the column above (columnAbove) can never disagree about
// where the cloud is.
vec4 columnAt(vec3 p, out vec4 v, out vec2 span) {
  // VC6a: ONE SAMPLE, FOUR JOBS. The weather's variation over the land
  // was already read here for the coverage alone, and only its R was
  // used. The volume is RGBA: R and A are two frequencies of the same
  // field (a Worley at 8 cells and at 32), which give a coverage that
  // changes at two scales instead of one; G and B are a second pair,
  // read as a VECTOR that bends the sample's position - a domain warp.
  // The warp is what actually kills the repeat Mac saw: the shape
  // volume still tiles every 12288 m, but its lattice arrives bent by
  // up to 2458 m along a field with a 65536 m period, so the straight
  // edges the eye locks onto are not there to find. It costs no texture
  // read, and it keeps CLK1's invariant: the warp's own period (80
  // pixels) divides the field's (240), so a position moved by a whole
  // field period is still warped by the same vector and still samples
  // the same cloud.
  // VC7a: the coverage rides its own, slower wind and turns through its slice over the day
  vec2 qv = vec2(p.x + uShift.x - uCoverDrift.x + fShear * (p.y - fBase), p.z + uShift.y - uCoverDrift.y);
  v = textureLod(uShape, vec3(qv.x / VARIATION_M, 0.37 + uEvolve.z, qv.y / VARIATION_M), 0.0);
  float variation = clamp(v.r * 0.65 + v.a * 0.35, 0.0, 1.0);
  // VC6a: the cloud's TYPE at this place. Where there is more cloud
  // there is flatter, deeper cloud - a settling deck; where there is
  // less, shallow towers with room above them. fVary is 0 for fog and
  // a sandstorm, which ARE one thing everywhere, and the whole term
  // collapses to the zone's flatness and its full ceiling.
  float flatHere = clamp(fFlat + (variation - 0.5) * fVary, 0.0, 1.0);
  float ceiling = 1.0 - fVary * (1.0 - variation) * 0.8;
  // VC7e: THE DECK'S CELLS. A deck's column was the same thickness everywhere (its optical depth along the sun
  // ran 0.56 to 0.80 across a whole overcast view), so no lighting could draw structure into it. The 32-cell Worley of the sample above - two
  // kilometres a cell, a stratocumulus's own size, and the same at every height, so it shapes whole COLUMNS - thins
  // the lanes between cells: a lower ceiling and a higher base there, so the underside hangs in lumps. It scales in
  // with the cover, so a fair sky's towers are what they were.
  float cells = smoothstep(${glslF(CELL_EDGE_LO)}, ${glslF(CELL_EDGE_HI)}, v.a);
  float deck = deckWeight();   // AUDIT-VC7 (B3): not a fog's or a sandstorm's
  float lift = deck * ${glslF(CELL_BASE_LIFT)}, thin = deck * ${glslF(CELL_THIN)};
  float h0 = (p.y - fBase) / max(fTop - fBase, 1.0);
  float h = h0 - lift * (1.0 - cells);
  // AUDIT-VC7 (G1): a lane's middle (cells 0) and a core (cells 1) bound every column between them - the height under
  // the ceiling is monotone in the cells' weight from one to the other
  float atLane = (h0 - lift) / max(ceiling * (1.0 - thin), 0.05), atCore = h0 / max(ceiling, 0.05);
  span = vec2(min(atLane, atCore), max(atLane, atCore));
  ceiling *= 1.0 - thin * (1.0 - cells);
  return vec4(h, ceiling, flatHere, variation);
}
float density(vec3 p, float mip) {
  // VC6d: OUTSIDE THE BAND, NO SAMPLE IS TAKEN. Both marches walk the
  // UNION slab - the zone's widened to hold every cell's - so under a
  // sunny zone with a thunderhead somewhere on the horizon every ray
  // walked 500 m to 4200 m while the zone's own cloud lives between
  // 1400 and 3200. heightGradient answered 0 at both ends already (its
  // two profiles are zero at h <= 0 and at h >= 1), but only after two
  // 3D texture reads had been paid for. This is the same answer, for
  // nothing. It must stay on the UNCLAMPED height and on the band's
  // own ends, never on the gradient: the local flatness below can
  // reopen a height the zone's would have closed.
  fSkip = 0.0;   // AUDIT-VC7: no stride unless a branch below vouches for one - a zero is never a stride by default
  float hr = (p.y - fBase) / max(fTop - fBase, 1.0);
  // VC7c: outside the band - whose ends move only at a cell's rim - a stride holds; AUDIT-VC7: under it, only where
  // the stride cannot climb into it (it rises at most its own length), and over it always (the sky march looks up)
  if (hr <= 0.0 || hr >= 1.0) { fSkip = hr >= 1.0 || fBase - p.y > fReach ? 1.0 - fNear : 0.0; return 0.0; }
  // WIND4 (2026-09-15, Mac: "clouds dont follow on the world timer with
  // the direction of the wind"): the drift is SUBTRACTED. uShift is the
  // floating origin's recenter and is ADDED, because q must be the
  // point's ABSOLUTE position in the field (setState does
  // shift -= offset for exactly that). The drift is not a position - it
  // is how far the AIR has travelled - and a field sampled at p + d
  // shows the cloud that was at p + d standing at p, so the whole sky
  // crept UPWIND at the wind's own speed. It is the one sign that
  // cannot be seen from inside the shader and is plain from the ground:
  // the wisps carry the wind one way (windWisps.js advances the wisp's
  // POSITION by the offset) and the sky went the other.
  vec3 q = vec3(p.x + uShift.x - uDrift.x + fShear * (p.y - fBase), p.y, p.z + uShift.y - uDrift.y);
  vec4 v;
  vec2 span;
  vec4 col = columnAt(p, v, span);   // VC7e: the column's own terms - its lane's lift, its ceiling, its type
  float variation = col.w;
  float h = col.x;
  if (h <= 0.0) return 0.0;   // VC7c: under a lane's lifted base - no stride: the core beside it comes lower
  float hn = clamp(h / max(col.y, 0.05), 0.0, 1.0);
  float grad = heightGradient(hn, col.z);
  // VC7c: over the profile's end (a tower's at 1, a lid's at 0.5) a stride holds only if no column a stride can reach
  // brings the cloud this high - AUDIT-VC7 (G1): the span's foot, the lowest a lane or a core puts this point, is over
  // it too; and no cell's rim is near
  float end = col.z < 1.0 ? 1.0 : 0.5;
  if (grad <= 0.0) { fSkip = fNear < 0.5 && span.x >= end ? 1.0 : 0.0; return 0.0; }
  // VC7c: the ramp can grow within a stride - sideways between a lane and a core (a span at all) or at a cell's rim,
  // and UP the ramp's foot (heightGradient peaks at 0.08 for a tower and 0.12 for a lid), which every ray climbs
  bool moves = span.y > span.x || fNear > 0.5 || hn < mix(0.08, 0.12, col.z);
  q.xz += (v.gb * 2.0 - 1.0) * WARP_M;   // VC6a: the warp
  vec4 s = textureLod(uShape, (q + vec3(0.0, uEvolve.x, 0.0)) / SHAPE_M, mip);   // VC7a: the boil - read up the volume as the minutes pass
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float raw = remap(s.r, -(1.0 - lowFbm), 1.0, 0.0, 1.0);
  float base = raw * grad;
  // the row's cover is the dome's deck's word; the slab's coverage is
  // sharper - a sunny 0.32 is a scattered sky, an overcast 0.94 a lid
  float coverage = clamp(pow(fCover, 1.6) * (0.6 + 0.8 * variation), 0.0, 1.0);
  // VC7c: under the cut, a stride by a margin - on the shape BEFORE the height ramp where the profile moves (a lid's
  // thin top reads far under the cut where the shape itself is not), on the value itself where it does not
  float room = (1.0 - coverage) - (moves ? raw : base);
  base = remap(base, 1.0 - coverage, 1.0, 0.0, 1.0);
  if (base <= 0.0) { fSkip = room > ${glslF(SKIP_ROOM)} ? 1.0 : 0.0; return 0.0; }
  vec4 d = textureLod(uDetail, (q + vec3(0.0, uEvolve.y, 0.0)) / DETAIL_M, mip);   // VC7a: the edges churn faster
  float dfbm = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
  float erode = mix(dfbm, 1.0 - dfbm, clamp(h * 10.0, 0.0, 1.0));
  base = remap(base, erode * (0.15 + 0.35 * uSoft), 1.0, 0.0, 1.0);
  return clamp(base, 0.0, 1.0) * fDensity;
}
// VC7e: the optical depth of the column ABOVE p - the sky's light on a cloud comes down through it, whatever the
// sun is doing (the sun's own path, lightDepth, runs sideways through kilometres of deck at dusk). heightGradient's
// two profiles end at 1 (the towers) and 0.5 (the lid); the column is COLUMN_FILL full on the average.
float columnAbove(vec3 p) {
  vec4 v;
  vec2 span;
  vec4 col = columnAt(p, v, span);
  float top = col.y * mix(1.0, 0.5, col.z);
  return EXT * fDensity * ${glslF(COLUMN_FILL)} * (fTop - fBase) * max(top - max(col.x, 0.0), 0.0);
}
`;

/** The march: one texel of the sky map per fragment. */
export const MARCH_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uMapSize;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uHorizonColor;
uniform vec3 uSkyTint;    // VC6b: the zenith's colour - the sky that lights a cloud's shaded side
uniform float uDusk;      // VC6b: how much of the low-sun look this frame takes (duskWeight) - the SUN's own angle and weight, so the MOON can never drive it
uniform int uSteps;
uniform int uLightSteps;
uniform vec4 uCellF[8];   // VC7c: the fall under each cell - its amount (0 none), its kind (0 rain, 1 snow)
uniform vec4 uCirrus;     // VC7d: the ice layer's cover (0 none), peak optical depth, the jet's offset east (metres); AUDIT 68: .w its boil (cloudClocks cirrusBoil)
uniform vec3 uCirrusLight;   // VC7d: the light on it (cirrusLight) - the sun at the ice's own elevation, else the moon
uniform vec3 uCirrusDir;     // ...and where that light comes from
out vec4 outColor;
const float PI = 3.14159265;
${CLOUD_FIELD_GLSL}
// VC7c: a smooth 1D noise, periodic in its period - the streaks around a curtain's axis close on themselves.
// AUDIT-VC7 (G4): the lattice's values are an integer hash, which GLSL ES 3.00 defines exactly (unsigned arithmetic
// wraps); a sine hash's is whatever each GPU's sine does with a large argument.
float latticeHash(uint n) {
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return float(n & 0x7fffffffu) / 2147483647.0;
}
float streakNoise(float x, float period) {
  float i = floor(x), f = fract(x);
  float a = latticeHash(uint(mod(i, period)));
  float b = latticeHash(uint(mod(i + 1.0, period)));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}
// VC7c: a curtain's weight across the ground at xz, 0 outside: its core's, thinning to its rim in the cell's own
// shape (AUDIT-VC7 R1: WEATHER3h's outline, the cell's shape at CURTAIN_SHARE of its size), inside its clip (WEATHER3g:
// a storm falls only where its front's core is, as its cloud stands only there)
float veilAcross(int i, vec2 xz, float rad) {
  float r = shapedDist(xz - uCell[i].xy, uCellS[i], uCellU[i]) / rad;
  float w = max(1.0 - r * r, 0.0);
  vec4 k = uCellK[i];
  if (k.z > 0.0) w *= 1.0 - smoothstep(k.z - k.w, k.z, shapedDist(xz - k.xy, uCellKS[i], uCellKU[i]));
  return w;
}
// VC7c: THE VEIL'S DEPTH along the ray from t = a to b, over its weight a metre: across the ground (veilAcross) times
// up the column (whole below the base yb, thinning linearly to nothing at yt) - by Simpson's rule, on a piece the
// caller has cut at the base, so the vertical term is smooth within it
const int VEIL_PANELS = 16;   // Simpson's panels a piece: 2.4% of the depth at worst over lobed outlines and clips (vc7c_curtains), exact on a circle
float veilPiece(int i, vec3 cam, vec3 dir, float a, float b, float rad, float yb, float yt) {
  if (b <= a) return 0.0;
  float h = (b - a) / float(VEIL_PANELS), sum = 0.0;
  for (int k = 0; k <= VEIL_PANELS; k++) {
    float t = a + h * float(k);
    float y = cam.y + dir.y * t;
    float up = y <= yb ? 1.0 : clamp((yt - y) / max(yt - yb, 1.0), 0.0, 1.0);
    sum += (k == 0 || k == VEIL_PANELS ? 1.0 : (k % 2 == 1 ? 4.0 : 2.0)) * veilAcross(i, cam.xz + dir.xz * t, rad) * up;
  }
  return sum * h / 3.0;
}
// VC7c: THE CURTAINS - the veils under the falling cells, analytic (no texture read): each cell's column from its
// foot to a little inside its base, in its own outline and clip, thinning toward the rim, streaked around its axis in
// two octaves (the shafts and their fibres, each faded to its mean where the map's texels could not hold it), the
// rim's streaks stopping short of the ground each by its own amount, gone as the eye comes under it.
// AUDIT-VC7 (B4): the ray is cut at tSplit, where the slab begins - front is the veil before it (premultiplied
// colour and transmittance, in its own aerial perspective), back the veil past it, which hangs among the slab's
// cloud and is composited in the march at tBack, its depth-weighted distance, under the slab's own perspective.
void curtains(vec3 cam, vec3 dir, float tSplit, out vec4 front, out vec4 back, out float tBack) {
  float tauF = 0.0, tauB = 0.0, tNear = 1e9, tSum = 0.0;
  vec3 tintF = vec3(0.0), tintB = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uCellCount) break;
    vec4 F = uCellF[i];
    if (F.x <= 0.0) continue;
    float rad = uCell[i].z * ${glslF(CURTAIN_SHARE)};
    vec2 o = cam.xz - uCell[i].xy, d = dir.xz;
    float dd = dot(d, d);
    if (dd < 1e-8) continue;
    // gone as the eye comes under it - the falling rain takes over there; first, so the bearing below is never
    // taken at the axis (AUDIT-VC7 G5: atan(0, 0) is undefined)
    float near = smoothstep(0.5 * rad, 1.5 * rad, shapedDist(o, uCellS[i], uCellU[i]));
    if (near <= 0.0) continue;
    // the ray against the outline's bounding circle (its shape's reach at its widest), analytic
    vec4 S = uCellS[i], U = uCellU[i];
    float reach = rad * S.x * (1.0 + length(S.yz) + length(vec2(S.w, U.x)) + length(U.yz));
    float b = dot(o, d) / dd;
    float h2 = dot(o, o) - b * b * dd;   // the ray's closest approach to the axis, squared
    if (h2 >= reach * reach) continue;
    float hw = sqrt((reach * reach - h2) / dd);   // not 'half': GLSL ES 3.00 reserves it
    float yb = uCellA[i].x, yt = yb + ${glslF(CURTAIN_INTO)} * (uCellA[i].y - yb);   // the base, and the top it thins to inside the cell
    float up = max(dir.y, 1e-4);
    float ta = max(-b - hw, 0.0), tb = min(-b + hw, yt / up);
    if (tb <= ta) continue;
    vec2 e = o + d * ta;
    float around = atan(e.y, e.x) / (2.0 * PI) + 0.5;
    // a streak's width on the map, in texels: the arc between two streaks over the distance, against a texel's turn
    float span = rad * uMapSize.x / (${glslF(CURTAIN_STREAKS)} * max(ta, rad));
    float s = 0.5 + ${glslF(1 - CURTAIN_FIBRE)} * smoothstep(1.0, ${glslF(CURTAIN_STREAK_TEXELS)}, span) * (streakNoise(around * ${glslF(CURTAIN_STREAKS)}, ${glslF(CURTAIN_STREAKS)}) - 0.5)
                  + ${glslF(CURTAIN_FIBRE)} * smoothstep(1.0, ${glslF(CURTAIN_STREAK_TEXELS)}, span / 3.0) * (streakNoise(around * ${glslF(3 * CURTAIN_STREAKS)}, ${glslF(3 * CURTAIN_STREAKS)}) - 0.5);
    float streak = 0.35 + 0.65 * s;
    // the ragged foot: the core's streaks reach the ground, the rim's stop short, each its own way - by how near the
    // core the ray passes (its closest approach)
    float core = veilAcross(i, cam.xz + d * clamp(-b, ta, tb), rad);
    float foot = min(yb * ${glslF(CURTAIN_VIRGA)} * (1.0 - core) * (0.5 + s), 0.95 * yb);
    ta = max(ta, foot / up);
    if (tb <= ta) continue;
    float w = ${glslF(CURTAIN_EXT)} * F.x * streak * near;
    // the chord's pieces: below the base and above it, each side of the slab's start
    float tB = yb / up;
    float c0 = ta, c3 = tb, c1 = clamp(min(tB, tSplit), c0, c3), c2 = clamp(max(tB, tSplit), c1, c3);
    float lo = veilPiece(i, cam, dir, c0, c1, rad, yb, yt), mid = veilPiece(i, cam, dir, c1, c2, rad, yb, yt), hi = veilPiece(i, cam, dir, c2, c3, rad, yb, yt);
    float inF = w * (lo + (c2 <= tSplit ? mid : 0.0)), inB = w * (hi + (c2 <= tSplit ? 0.0 : mid));
    vec3 tint = mix(mix(uCloudShade * (1.0 - 0.6 * uCellB[i].x), uHorizonColor, 0.3), mix(uCloudLit, uHorizonColor, 0.4), F.y);   // rain the cell's own dark grey, snow pale
    tauF += inF; tintF += tint * inF;
    tauB += inB; tintB += tint * inB; tSum += inB * 0.5 * (max(ta, tSplit) + tb);
    if (inF > 0.0) tNear = min(tNear, ta);
  }
  front = vec4(0.0, 0.0, 0.0, 1.0);
  back = vec4(0.0, 0.0, 0.0, 1.0);
  tBack = tauB > 0.0 ? tSum / tauB : 1e9;
  if (tauF > 0.0) {
    float Tv = exp(-tauF);
    vec3 veil = tintF / tauF * (1.0 - Tv);
    front = vec4(mix(veil, uHorizonColor * (1.0 - Tv), 1.0 - exp(-tNear / ${glslF(CURTAIN_FADE_M)})), Tv);   // their own aerial perspective
  }
  if (tauB > 0.0) { float Tv = exp(-tauB); back = vec4(tintB / tauB * (1.0 - Tv), Tv); }
}
// VC7c: a ray with no slab to cut at - the horizon's own rows (where the rain meets the ground) carry the veil too
vec4 underCurtains(vec3 col, float T, vec3 cam, vec3 dir) {
  vec4 front, back;
  float tBack;
  curtains(cam, dir, 1e9, front, back, tBack);
  return vec4(front.rgb + front.a * col, T * front.a);
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// VC6b: a colour's HUE at luminance one. Every tint below is taken
// through this, so a tint can only move a colour's hue and never its
// brightness - the dusk must not be a way of turning the exposure up.
vec3 hue(vec3 c) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return l > 1e-3 ? c / l : vec3(1.0); }   // a colour with no light in it has no hue to lend: white, the tint that changes nothing
// toward the light: a short march; the optical depth it found (VC7e: the octaves and the ambient read it)
float lightDepth(vec3 p) {
  float sum = 0.0;
  float ds = (fTop - fBase) / float(uLightSteps) * 0.5;
  // VC6d: past exp(-6) no step can be seen - VC7e: of the furthest-seeing term the light takes here, the LAST octave
  // where the sky is a deck (lightOctaves), the single scattering where it is not (AUDIT-VC7 B1)
  float sees = deckWeight() > 0.0 ? ${glslF(MS_B ** (MS_OCTAVES - 1))} : 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uLightSteps) break;
    float step = ds * (1.0 + float(i) * 0.6);
    p += uLightDir * step;
    sum += density(p, 0.0) * step;   // the field itself, not a blurred level - a blurred one never occludes
    if (sum * EXT * sees > 6.0) break;
  }
  return sum * EXT;
}
// VC7e: the light a point takes from the sun through depth tau, at the phase for its angle - octave 0 is Beer's law
// with the powder term (the single scattering it always was), each further octave i a share of the light carried on
// by scattering again: MS_A^i of it, reaching MS_B^i as deep, its phase flattened MS_C^i of the way toward
// isotropic (Wrenninge), the whole divided by the octaves' total share so no depth takes more than an unshadowed
// path. AUDIT-VC7 (B1): the octaves are a DECK's - deck weighs them in, and a fair sky (0) takes exactly the
// single scattering it was tuned with, the way the ambient's column is weighed in.
float lightOctaves(float tau, float phase, float deck) {
  float powder = 1.0 - exp(-tau * 2.0);
  float single = exp(-tau) * mix(1.0, powder, 0.4) * phase;
  float multi = 0.0, a = ${glslF(MS_A)}, b = ${glslF(MS_B)}, c = ${glslF(MS_C)};
  for (int o = 1; o < ${MS_OCTAVES}; o++) { multi += a * exp(-b * tau) * mix(1.0, phase, c); a *= ${glslF(MS_A)}; b *= ${glslF(MS_B)}; c *= ${glslF(MS_C)}; }
  return mix(single, (single + multi) / ${glslF(msSum())}, deck);
}
// VC7d: THE ICE LAYER - where the ray meets the shell CIRRUS_ALT_M up over a round earth (the stable root: no
// cancellation at the zenith, finite at the horizon), read once from the shape volume stretched down the westerly jet
// and its fibres from the detail volume, lit by the ice's own sun in hard forward scatter, fading into the horizon's
// haze. Returns its premultiplied colour and transmittance; the slab stands in front of it.
vec4 cirrus(vec3 cam, vec3 dir) {
  if (uCirrus.x <= 0.0 || dir.y <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  const float R = ${glslF(EARTH_RADIUS_M)}, H = ${glslF(CIRRUS_ALT_M)};
  float t = (2.0 * R * H + H * H) / (R * dir.y + sqrt(R * R * dir.y * dir.y + 2.0 * R * H + H * H));
  vec2 q = cam.xz + dir.xz * t + uShift;
  q.x -= uCirrus.z;   // the jet carries it east
  float mip = clamp(log2(t / 15000.0), 0.0, 4.0);
  // where the high air holds ice at all: the cover sets how much of this slow round field is in
  float patchField = textureLod(uShape, vec3(q.x, 0.61 * SHAPE_M, q.y) / (SHAPE_M * ${glslF(CIRRUS_PATCH)}), 0.0).g;
  float patchIn = smoothstep(1.0 - uCirrus.x - 0.12, 1.0 - uCirrus.x + 0.12, patchField);
  if (patchIn <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  // the wisps, bent gently across the jet by the slow field (mare's tails)
  float bend = (textureLod(uShape, vec3(q.x, 0.47 * SHAPE_M, q.y) / (SHAPE_M * ${glslF(CIRRUS_BEND)}), 0.0).b - 0.5) * ${glslF(CIRRUS_BEND_M)};
  vec4 sk = textureLod(uShape, vec3(q.x / (SHAPE_M * ${glslF(CIRRUS_ALONG)}), 0.83 + uCirrus.w, (q.y + bend) / (SHAPE_M * ${glslF(CIRRUS_ACROSS)})), mip + 1.0);   // a mip soft: the volume's texels, stretched this far, jag a wisp's edge
  float wispAt = ${glslF(CIRRUS_WISP_TOP)} - ${glslF(CIRRUS_WISP_COVER)} * uCirrus.x;
  float streak = smoothstep(wispAt, wispAt + ${glslF(CIRRUS_WISP_SOFT)}, sk.g * 0.6 + sk.b * 0.4);
  if (streak <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  // the striations down each wisp: smooth fbm of the detail volume, long down the jet, a mip softer than the map
  float fib = textureLod(uDetail, vec3(q.x / (DETAIL_M * ${glslF(CIRRUS_FIBRE_ALONG)}), 0.29, (q.y + bend) / (DETAIL_M * ${glslF(CIRRUS_FIBRE_ACROSS)})), mip + 1.0).g;
  float d = patchIn * streak * mix(1.0, fib, ${glslF(CIRRUS_FIBRE)});
  float a = 1.0 - exp(-uCirrus.y * d);
  a *= exp(-t / ${glslF(CIRRUS_FADE_M)});   // gone into the horizon's haze
  if (a <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float phase = min(hg(dot(dir, uCirrusDir), ${glslF(CIRRUS_G)}) * 4.0 * PI, 4.0);
  vec3 c = uCirrusLight * ${glslF(CIRRUS_SUN)} * mix(1.0, phase, ${glslF(CIRRUS_FWD)}) + uCloudLit * ${glslF(CIRRUS_AMB)};
  return vec4(c * a, 1.0 - a);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uMapSize;
  float az = uv.x * 2.0 * PI, el = uv.y * 0.5 * PI;
  vec3 dir = vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  vec3 cam = vec3(uCamXZ.x, 0.0, uCamXZ.y);
  // DSH1: the rows the slab cannot be reached from are the AERIAL FADE'S
  // colour at full opacity, not clear sky. They used to write "no cloud,
  // nothing absorbed", which let whatever the dome drew in the last
  // quarter-degree through the lid - under Dynamic Skies the bare
  // in-scattering strip, a hard red line at dusk under a full overcast.
  // The far early-out below already answers uHorizonColor; this is the
  // same answer for the near one.
  if (dir.y <= 0.004) { outColor = underCurtains(uHorizonColor, 0.0, cam, dir); return; }
  // the march covers the slab, or the first 24 km of it at a grazing
  // angle - the aerial fade takes the rest, so the deck reaches the
  // horizon instead of stopping short of it in a rim of bare dome.
  // SLAB-SPAN: the slab is THIS RAY's - its spans (raySpans), their first 24 km walked and the air between them jumped
  float len = raySpans(cam, dir);
  float t0 = spanA[0];
  if (t0 > 120000.0) { outColor = underCurtains(uHorizonColor, 0.0, cam, dir); return; }
  float walk = min(len, 24000.0);
  float t1 = t0, left = walk;   // where the spans' first walk metres end
  for (int k = 0; k < SPANS; k++) {
    if (k >= spanN) break;
    float l = spanB[k] - spanA[k];
    if (l >= left) { t1 = spanA[k] + left; break; }
    left -= l; t1 = spanB[k];
  }
  float ds = walk / float(uSteps);
  float coarse = ds * 3.0;   // VC6d: the stride over empty air
  fReach = coarse;   // VC7c: how near a cell's rim must be to count
  float jit = hash12(gl_FragCoord.xy);
  float t = t0 + ds * jit;
  int span = 0;
  // aerial perspective: a far bank takes the horizon's colour - by the distance its span begins at (SLAB-SPAN: a
  // span's own, so a storm near and the deck far behind it on one ray are each faded by their own distance; with one
  // span, the ray's entry for all of it, as it was)
  float fade = 1.0 - exp(-t0 / 14000.0);
  float cosTheta = dot(dir, uLightDir);
  float phase = min(mix(hg(cosTheta, 0.55), hg(cosTheta, -0.1), 0.4) * 4.0 * PI, 2.5);   // the average over the sphere is 1; the forward peak capped
  // ═══ VC6b: THE LOW SUN ══════════════════════════════════════════════
  // Mac: "in the evening when the sun is setting and the sky is golden,
  // clouds arent influenced by the sun". Three terms, all of them
  // WEIGHTED BY HOW LOW THE SUN IS and all of them zero by day, so noon
  // is the picture it was:
  //   low    - 0 above 17 degrees, 1 at and below the horizon, and 0
  //            at night: it is computed on the CPU (duskWeight) from
  //            the SUN's own direction and weight, never from
  //            uLightDir, which is the MOON's once the sun is down.
  //   toward - 0 looking away from the sun, 1 looking at it. At dusk
  //              the sky is not one colour: the half of it the sun is in
  //              is gold and the other half is blue, and a cloud takes
  //              whichever half it stands in.
  //   sideLit- by day the light comes from ABOVE, so a cloud's top is
  //              lit and its underside is the shade colour; at sunset it
  //              comes from the SIDE, and the underside is the part that
  //              burns. The ambient's height ramp rolls over to match.
  // The direct term's gain opens with it (0.7 -> 1.05): a rim lit by a
  // sun on the horizon is the brightest thing in the sky.
  float low = uDusk;
  float toward = clamp(cosTheta * 0.5 + 0.5, 0.0, 1.0);
  vec3 duskTint = mix(hue(uSkyTint), hue(uLightColor), toward);
  float gain = mix(0.7, 1.05, low);
  vec3 col = vec3(0.0);
  float T = 1.0;
  int empty = 0;   // VC6d: how many steps in a row have found nothing
  bool strode = false;   // VC7c: whether the last step was a stride - only a stride is backed out
  // VC7c: the curtains, cut where the slab begins (AUDIT-VC7 B4) - the veil past it hangs among the slab's cloud
  vec4 front, back;
  float tBack;
  curtains(cam, dir, t0, front, back, tBack);
  bool veiled = back.a >= 1.0;
  resolveAt((cam + dir * t0).xz);   // WEATHER2c: the zone's terms, and the cell at the slab's foot
  for (int i = 0; i < 96; i++) {
    // VC6d: the ray may now finish BEFORE its step budget (it strides
    // over empty air) or need a few steps more than it (each stride it
    // backs out of costs one). The slack is what buys back the second
    // case - without it a ray that crosses several banks could stop
    // short of t1 and lose the far one.
    // SLAB-SPAN: past a span's end, on to the next - the air between holds no cloud, so it costs no step
    while (span < spanN && t > spanB[span]) { span++; if (span < spanN) fade = 1.0 - exp(-spanA[span] / 14000.0); }
    if (span >= spanN) break;
    if (t < spanA[span]) { t = spanA[span] + ds * jit; strode = false; empty = 0; }
    if (i >= uSteps + ${MARCH_SLACK} || t > t1) break;
    vec3 p = cam + dir * t;
    if (uCellCount > 0) resolveAt(p.xz);   // WEATHER2c: the profile where this step is
    float mip = clamp(t / 12000.0, 0.0, 2.0);
    float rho = density(p, mip);
    // ═══ VC6d: EMPTY-SPACE SKIPPING ═══════════════════════════════════
    // A scattered sky is mostly air: at a sunny cover of 0.32 most of
    // the slab a ray crosses holds no cloud at all, and every one of
    // those steps used to cost the same as a step inside a cloud. After
    // four empty steps the ray strides three times as far; the step it
    // first finds cloud on, it backs the stride out and walks in fine,
    // so the cloud's EDGE is never resolved coarsely - which is the
    // whole reason a plain 'take bigger steps' would have shown.
    if (rho <= 0.0) { empty++; strode = empty > 4 && fSkip > 0.5; t += strode ? coarse : ds; continue; }   // VC7c: a stride only on a zero that holds for one
    if (strode) { t -= coarse; strode = false; empty = 0; continue; }
    empty = 0;
    // VC7c: the veil past the slab's start goes in before the first cloud behind it - only a lit sample can stand in
    // front of it or behind it, so the empty air between needs no order
    if (!veiled && tBack <= t) { col += T * mix(back.rgb, uHorizonColor * (1.0 - back.a), fade); T *= back.a; veiled = true; }
    {
      float h = clamp((p.y - fBase) / max(fTop - fBase, 1.0), 0.0, 1.0);
      float tau = lightDepth(p);
      float deckHere = deckWeight();   // VC7e: how much of a deck the sky is here (AUDIT-VC7 B3: never a fog's)
      // the ambient carries the field's own low-frequency structure, so a
      // lid is mottled and an underside is not one flat grey
      float mottle = textureLod(uShape, vec3(p.x + uShift.x - uDrift.x, p.y, p.z + uShift.y - uDrift.y) / MOTTLE_M, 1.0).g;   // WIND4: the same sign as the density above - the mottle rides the same air
      float sideLit = mix(h, 0.25 * h + 0.75, low);   // VC6b: top-lit by day, whole-lit at dusk
      // WEATHER2c: a cell's grey pulls the lit colour toward the shade's, so a storm under a sunny zone is a storm's colour
      vec3 ambient = mix(uCloudShade, uCloudLit, sideLit * (1.0 - fGrey)) * (0.75 + 0.5 * mottle) * (1.0 - 0.5 * fDark * (1.0 - h)) * fTint;   // WEATHER2d: the cell's tint
      ambient *= mix(vec3(1.0), duskTint, low * 0.8);   // VC6b: gold toward the sun, blue away from it - a hue, never a brightness
      // VC7e: the sky's light comes DOWN through a deck - a thick core's underside darker than a thin place's. Weighted
      // by how much of a deck the sky is (the cells' own weight): a fair or cloudy sky's looks were tuned with the
      // ambient whole, and a low sun's gold rides it (VC6b), so they keep it
      ambient *= mix(1.0, max(${glslF(AMBIENT_FLOOR)}, exp(-columnAbove(p) * ${glslF(AMBIENT_THROUGH_K)})), deckHere);
      float light = lightOctaves(tau, phase, deckHere);   // VC7e: the octaves - a deck's
      vec3 S = uLightColor * light * gain * (1.0 - 0.8 * fDark) * (1.0 - 0.5 * fGrey) * fTint + ambient;
      float Ti = exp(-rho * EXT * ds);
      col += T * mix(S, uHorizonColor, fade) * (1.0 - Ti);
      T *= Ti;
      if (T < 0.01) break;
    }
    t += ds;
  }
  if (!veiled) { col += T * mix(back.rgb, uHorizonColor * (1.0 - back.a), fade); T *= back.a; }   // VC7c: behind every cloud the march lit
  vec4 ice = cirrus(cam, dir);   // VC7d: far above the slab - behind it along the ray
  col += T * ice.rgb;
  T *= ice.a;
  outColor = vec4(front.rgb + front.a * col, T * front.a);   // VC7c: the veil before the slab's start stands in front of all of it
}`;

/** VC4: the shadow map - one ground texel per fragment, the
 *  transmittance along the sun's ray up through the slab. */
export const SHADOW_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uMapSize;
uniform vec2 uOrigin;      // the square's corner, world metres
uniform float uExtent;     // its side
uniform vec3 uLightDir;
uniform int uSteps;
out vec4 outColor;
${CLOUD_FIELD_GLSL}
void main() {
  if (uLightDir.y <= 0.05) { outColor = vec4(1.0); return; }   // no sun to shadow: the moon casts none
  vec2 g = uOrigin + gl_FragCoord.xy / uMapSize * uExtent;
  float len = raySpans(vec3(g.x, 0.0, g.y), uLightDir);   // SLAB-SPAN: this ground point's own spans toward the sun
  // the steps follow the path: a low sun's long slant is sampled no
  // coarser than 150 m, the tier's count the floor, 24 the ceiling
  int steps = min(24, max(uSteps, int(ceil(len / 150.0))));
  float ds = len / float(steps);
  float t = spanA[0] + ds * 0.5;
  int span = 0;
  float sum = 0.0;
  resolveAt(g);   // WEATHER2c: the zone's terms, and the cell over this ground
  for (int i = 0; i < 24; i++) {
    if (i >= steps) break;
    // SLAB-SPAN: the steps are the spans' length laid end to end - a step past one span's end goes on in the next
    while (span < spanN && t > spanB[span]) { float over = t - spanB[span]; span++; if (span < spanN) t = spanA[span] + over; }
    if (span >= spanN) break;
    vec3 p = vec3(g.x, 0.0, g.y) + uLightDir * t;
    if (uCellCount > 0) resolveAt(p.xz);   // WEATHER2c: a slanted sun's ray may leave the cell
    sum += density(p, 0.5) * ds;
    t += ds;
  }
  float T = exp(-sum * EXT);
  outColor = vec4(T, T, T, 1.0);
}`;

/** DSH1: how far BELOW the horizon the lid is carried, radians. The
 *  number to clear is Unity's SKY_GROUND_THRESHOLD (0.01 in sine, the
 *  width of the strip Dynamic Skies lerps its sky to its ground over);
 *  this is that with a little room, and small enough that a clear sky's
 *  ground half is unchanged to the eye. */
export const HORIZON_SKIRT = 0.012;

/** The composite: the whole sky, one sample per pixel, over the dome. */
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
uniform float uYaw;
uniform float uPitch;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uFlash;     // lightning: the WHOLE sky lit for the frame (the march writes one stripe a frame; the flash cannot ride it)
uniform vec4 uBolt;       // WEATHER3d: a DISTANT storm's strike - xyz the direction to its cloud, w its light
uniform float uBoltCos;   // ...and the cosine of the cone its cloud fills from here
uniform float uDread;     // EVENT1: the live event's grade, 0 = none
out vec4 outColor;
const float PI = 3.14159265;
${DREAD_GLSL}
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));
  float el = asin(clamp(dir.y, -1.0, 1.0));
  // DSH1 (2026-09-20, Mac: "The far away horizon is still viewable even
  // though it's cloudy"): THE LID CLEARS THE HORIZON BY A SKIRT. The
  // composite discarded at the horizon exactly, and a dome's own last
  // half-degree is not a half-degree of nothing: under Dynamic Skies it
  // is the bare in-scattering strip (Unity's procedural skybox lerps sky
  // to ground over SKY_GROUND_THRESHOLD, 0.57 degrees), which is red at
  // dusk - so a full overcast lid ended in a hard sunset line wherever
  // the streamed world did not reach the horizon. The lid now carries
  // the map's bottom row down over that strip and stops. It is a skirt,
  // not a floor: past it the dome is the dome again, so nothing about a
  // clear sky's ground half changes, and only sky pixels reach this pass
  // at all (the far plane under LEQUAL).
  if (el <= -${HORIZON_SKIRT}) discard;
  float az = atan(dir.x, dir.z);
  vec2 uv = vec2(az / (2.0 * PI), max(el, 0.0) / (0.5 * PI));   // DSH1: the bottom row over the skirt
  vec4 c = texture(uMap, uv);
  // WEATHER3d: the distant strike lights its own cloud and nothing else - the cone its disc fills from here, soft at
  // the rim - on the cloud's own radiance (c.rgb carries its opacity), so clear sky in that direction stays dark
  float bolt = uBolt.w * smoothstep(uBoltCos, mix(uBoltCos, 1.0, 0.6), dot(dir, uBolt.xyz));
  // EVENT1: THE CLOUD GRADED, NOT ITS PREMULTIPLIED SUM - c.rgb carries the cloud's opacity (1 - c.a: the composite
  // is sky * T + cloud), so the grade reads the cloud's own colour and puts the opacity back; clear sky adds nothing
  float op = 1.0 - c.a;
  vec3 cloud = op > 1e-4 ? dreadGrade(c.rgb / op, uDread) * op : c.rgb;
  outColor = vec4(cloud * (1.0 + uFlash * 2.0 + bolt * 3.0), c.a);
}`;

/** The lab's shadow-map viewer: the square as a picture. */
export const SHADOW_VIEW_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uMap;
out vec4 outColor;
void main() { outColor = vec4(texture(uMap, vNdc * 0.5 + 0.5).rrr, 1.0); }`;

/** The field's uniforms, shared by both marches. */
export const FIELD_UNIFORMS = ['uShape', 'uDetail', 'uCover', 'uSoft', 'uBase', 'uTop', 'uDensity', 'uFlat', 'uShear', 'uDark', 'uVary', 'uCellCount', 'uCell', 'uCellA', 'uCellB', 'uCellC', 'uCellK', 'uCellS', 'uCellU', 'uCellKS', 'uCellKU', 'uDrift', 'uShift', 'uCamXZ', 'uEvolve', 'uCoverDrift'];   // WEATHER2c: uDark moved in (a cell has its own), the slab and the cells added; VC6a: uVary
export const MARCH_UNIFORMS = [...FIELD_UNIFORMS, 'uMapSize', 'uLightDir', 'uLightColor', 'uCloudLit', 'uCloudShade', 'uHorizonColor', 'uSkyTint', 'uDusk', 'uSteps', 'uLightSteps', 'uCellF', 'uCirrus', 'uCirrusLight', 'uCirrusDir'];   // VC6b: uSkyTint, uDusk; VC7c: the falls
export const SHADOW_UNIFORMS = [...FIELD_UNIFORMS, 'uMapSize', 'uOrigin', 'uExtent', 'uLightDir', 'uSteps'];
export const COMPOSITE_UNIFORMS = ['uMap', 'uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', 'uFlash', 'uBolt', 'uBoltCos', 'uDread'];   // EVENT1: the live event's grade   // WEATHER3d: the distant strike

export class VolumetricClouds {
  /** `quality` a QUALITY key; `viewport` the caller's rect to restore
   *  after the noise is generated (a draw path at construction). */
  constructor(gl, quality = 'default', viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]) {
    this.gl = gl;
    this.q = QUALITY[quality] ?? QUALITY.default;
    this.noise = new CloudNoise(gl, viewport);
    this.map = createRenderTarget(gl, this.q.width, this.q.height, { filter: 'LINEAR', wrapS: 'REPEAT', wrapT: 'CLAMP_TO_EDGE' });
    // both shadow targets are born ALL LIGHT (T = 1): nothing samples an
    // unmarched texel as shadow, and nothing CLEARS (the renderer keeps a
    // JS shadow of the clear colour that a clear here would make a lie)
    this.white = new Uint8Array(this.q.shadow * this.q.shadow * 4).fill(255);
    this.shadowMap = createRenderTarget(gl, this.q.shadow, this.q.shadow, { filter: 'LINEAR', wrap: 'CLAMP_TO_EDGE', data: this.white });
    this.shadowScratch = createRenderTarget(gl, this.q.shadow, this.q.shadow, { filter: 'LINEAR', wrap: 'CLAMP_TO_EDGE', data: this.white });
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.marchProgram = buildProgram(gl, VS, MARCH_FS);
    this.shadowProgram = buildProgram(gl, VS, SHADOW_FS);
    this.compositeProgram = buildProgram(gl, VS, COMPOSITE_FS);
    this.viewProgram = buildProgram(gl, VS, SHADOW_VIEW_FS);
    this.mu = {}; for (const n of MARCH_UNIFORMS) this.mu[n] = gl.getUniformLocation(this.marchProgram, n);
    this.su = {}; for (const n of SHADOW_UNIFORMS) this.su[n] = gl.getUniformLocation(this.shadowProgram, n);
    this.cu = {}; for (const n of COMPOSITE_UNIFORMS) this.cu[n] = gl.getUniformLocation(this.compositeProgram, n);
    this.vu = { uMap: gl.getUniformLocation(this.viewProgram, 'uMap') };
    this.profile = null;      // the eased profile
    this.weather = null;
    this.state = null;        // the dome's skyState
    this.row = null;          // the eased weather row
    this.drift = [0, 0];
    this.shift = [0, 0];      // the floating origin's recenters, accumulated (metres)
    this.cam = [0, 0];        // the camera's world XZ
    this.flash = 0;
    /** EVENT1: the live event's grade over the clouds, 0..1 (world/dreadSky.js) - the host's. */
    this.dread = 0;
    this.bolt = null;   // WEATHER3d: a distant strike's light, or none
    this.cells = [];          // WEATHER2c: this frame's cells, in the host's world metres, capped at the tier's count
    this.testCellSpec = null; // WEATHER2c: `?cloudcell=` as handed by the controller; resolved against the first camera position seen
    this.testCell = null;
    this._packed = { c: new Float32Array(MAX_CELLS * 4), a: new Float32Array(MAX_CELLS * 4), b: new Float32Array(MAX_CELLS * 4), t: new Float32Array(MAX_CELLS * 4), k: new Float32Array(MAX_CELLS * 4), s: new Float32Array(MAX_CELLS * 4), u: new Float32Array(MAX_CELLS * 4), ks: new Float32Array(MAX_CELLS * 4), ku: new Float32Array(MAX_CELLS * 4), count: 0 };
    this.stripe = 0;
    this.sweeps = 0;          // full sweeps of the sky map completed (the probe waits for one); the first is striped like every other - no stall
    this.origin = null;       // the shadow square's corner the camera asks for
    this.mapOrigin = null;    // the corner the map HOLDS - the deck's rect (the two differ for the frame between a crossing and its blit)
    this.shadowStripe = 0;
    this.shadowFull = true;   // the first march of the shadow map is whole (a quarter of a sky sweep)
    this.shadowMarched = false;
    this.pendingShift = null; // a pixel crossing's texel shift, applied on the next update (a draw path)
  }

  /** The host's recenter: every world position moved by `offset`; the
   *  field is sampled at the absolute position, so the shift is
   *  accumulated here, and the shadow square moves with the world - its
   *  map is the same land, kept. */
  offsetOrigin(offset) {
    this.shift[0] -= offset[0]; this.shift[1] -= offset[2];
    this.cam[0] += offset[0]; this.cam[1] += offset[2];
    if (this.origin) { this.origin[0] += offset[0]; this.origin[1] += offset[2]; }
    if (this.mapOrigin) { this.mapOrigin[0] += offset[0]; this.mapOrigin[1] += offset[2]; }
    if (this.testCell) { this.testCell.x += offset[0]; this.testCell.z += offset[2]; }   // WEATHER2c: the test cell keeps its place over the land
  }

  /** Per frame, from the controller: the dome's state, the eased row,
   *  the sim's weather word and the (front-stretched) ease dt, the
   *  drift integral, the lightning flash, the camera's world position. */
  setState(state, row, weather, easeDt, drift, flash = 0, pos = null, cells = null) {
    this.state = state; this.row = row;
    // WEATHER2c: the field's cells for this frame - the controller's, else the test door's one
    if (this.testCellSpec && !this.testCell && pos) this.testCell = parseCloudCellDoor(this.testCellSpec, pos);
    // VC7a: the day's convection at the sky's own minute, on the fair cells and the fair zone
    this.conv = convection(state.minuteOfDay ?? ((((state.minutes ?? 0) % 1440) + 1440) % 1440));
    // WEATHER3c: the map's cells by importance, drawn by rank. AUDIT-VC7: the door's cell joins them - the hosts always
    // hand a list (the map's, empty in clear air), so a cell taken only in its place never stood in the game
    const host = cells ?? [];
    this.cells = pickCells(this.testCell ? [...host, this.testCell] : host, this.q.cells ?? MAX_CELLS).map((c) => convectCell(c, this.conv));
    const target = VC_PROFILE[weather] ?? VC_PROFILE.sunny;
    this.profile = easeProfile(this.profile, target, easeDt);
    this.weather = weather;
    // VC7d: the ice layer's cover eases with the weather, on the profile's own span
    this.cirrusCover = easeOnWeatherSpan(this.cirrusCover, CIRRUS_COVER[weather] ?? CIRRUS_COVER.sunny, easeDt);
    // AUDIT-VC7 (R3): and so does how FAIR the zone is - the day's convection takes the eased profile's tops, so it
    // is weighed in as the profile turns, not all at once when the word does (a kilometre's jump at a front)
    this.fair = easeOnWeatherSpan(this.fair, FAIR_WEATHERS.includes(weather) ? 1 : 0, easeDt);
    this.drift = [wrapField(drift[0] * WORLD_PER_DRIFT), wrapField(drift[1] * WORLD_PER_DRIFT)];   // CLK1: wrapped to the field's period
    this.clocks = cloudClocks(state.minutes ?? 0, [drift[0] * WORLD_PER_DRIFT, drift[1] * WORLD_PER_DRIFT]);   // VC7a: the boil and the cover's own wind
    this.flash = flash;
    if (pos) { this.cam[0] = pos[0]; this.cam[1] = pos[2]; }
    const o = shadowOrigin(this.cam[0], this.cam[1]);
    if (!this.origin) { this.origin = o; this.mapOrigin = [o[0], o[1]]; this.shadowFull = true; }
    else if (Math.abs(o[0] - this.origin[0]) > 1e-3 || Math.abs(o[1] - this.origin[1]) > 1e-3) {
      // the camera crossed a pixel: the square moves by whole texels;
      // the map is shifted on the next update and the new strip marched
      const texel = SHADOW_EXTENT / this.q.shadow;
      const dx = Math.round((o[0] - this.origin[0]) / texel), dz = Math.round((o[1] - this.origin[1]) / texel);
      this.pendingShift = [(this.pendingShift?.[0] ?? 0) + dx, (this.pendingShift?.[1] ?? 0) + dz];
      this.origin = o;
    }
  }

  /** DRAW PATH: move the shadow map by whole texels (a blit into the
   *  scratch target, the uncovered strips left all light), so a pixel
   *  crossing keeps the land it already marched. */
  _shiftShadowMap(dx, dz, viewport) {
    const gl = this.gl, n = this.q.shadow;
    if (Math.abs(dx) >= n || Math.abs(dz) >= n) { this.shadowFull = true; this.pendingShift = null; return; }
    const dst = this.shadowScratch, src = this.shadowMap;
    withTarget(gl, dst, viewport, () => {});   // attached, if it never was
    // the strips the blit will not cover are re-filled ALL LIGHT by upload
    gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    if (dx !== 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, dx > 0 ? n - dx : 0, 0, Math.abs(dx), n, gl.RGBA, gl.UNSIGNED_BYTE, this.white.subarray(0, Math.abs(dx) * n * 4));
    if (dz !== 0) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, dz > 0 ? n - dz : 0, n, Math.abs(dz), gl.RGBA, gl.UNSIGNED_BYTE, this.white.subarray(0, Math.abs(dz) * n * 4));
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fbo);
    // old texel (i, j) is new texel (i - dx, j - dz)
    const sx0 = Math.max(0, dx), sx1 = Math.min(n, n + dx), sy0 = Math.max(0, dz), sy1 = Math.min(n, n + dz);
    gl.blitFramebuffer(sx0, sy0, sx1, sy1, sx0 - dx, sy0 - dz, sx1 - dx, sy1 - dz, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, frameTarget());   // EL4: the frame, or the canvas
    this.shadowMap = dst; this.shadowScratch = src;
    this.mapOrigin = [this.origin[0], this.origin[1]];
    this.pendingShift = null;
  }

  /** A weather JUMP (a load, a travel landing): the profile is dropped
   *  so the next setState takes the new weather whole, as the row does,
   *  and both maps are marched whole again - the old sky is not eased
   *  into the new one. */
  jump() { this.profile = null; this.cirrusCover = null; this.fair = null; this.stripe = 0; this.shadowFull = true; }

  /** WEATHER3d: a distant storm's strike this frame - `{ x, z, r,
   *  strength }` in the host's world metres, or null. Its cloud is lit
   *  in the direction of its middle (boltOf); the storm overhead is the
   *  whole-sky `flash`, as before. */
  setBolt(b) { this.bolt = b ? boltOf(b, this.cam) : null; }

  /** VC4: what the ground samples - the map and its square, for the
   *  deck the controller hands the renderer. */
  get shadow() {
    if (!this.mapOrigin || !this.shadowMarched) return null;
    // VC7b: and the SKY map, once a sweep has filled it - its alpha is the transmittance by direction (the slab's, the
    // curtains' and the ice's, AUDIT-VC7), which
    // is what cuts the sun's beams into spokes (airPass.js SHAFT_FS); null before, and the mask is the sky's alone
    return { map: this.shadowMap.tex, rect: [this.mapOrigin[0], this.mapOrigin[1], 1 / SHADOW_EXTENT, SHADOW_AMOUNT], sky: this.sweeps > 0 ? this.map.tex : null };
  }

  _fieldUniforms(u) {
    const gl = this.gl, r = this.row, p = this.profile;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, this.noise.shape.tex); gl.uniform1i(u.uShape, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.noise.detail.tex); gl.uniform1i(u.uDetail, 1);
    // VC7a: the zone convects as a fair cell does, by how fair it is by now (AUDIT-VC7 R3)
    const zone = convectZone(p, this.conv, this.fair ?? 0);
    gl.uniform1f(u.uCover, r.cover); gl.uniform1f(u.uSoft, r.soft);
    gl.uniform1f(u.uBase, p.base); gl.uniform1f(u.uTop, zone.top); gl.uniform1f(u.uDensity, p.density);
    gl.uniform1f(u.uFlat, p.flat); gl.uniform1f(u.uShear, p.shear);
    gl.uniform1f(u.uDark, p.dark); gl.uniform1f(u.uVary, p.vary ?? 0);   // VC6a
    // WEATHER2c: the cells (SLAB-SPAN: each ray finds its own slab among them)
    const k = packCells(this.cells, this.q.cells ?? MAX_CELLS, this._packed);
    gl.uniform1i(u.uCellCount, k.count);
    if (k.count > 0) { gl.uniform4fv(u.uCell, k.c); gl.uniform4fv(u.uCellA, k.a); gl.uniform4fv(u.uCellB, k.b); gl.uniform4fv(u.uCellC, k.t); gl.uniform4fv(u.uCellK, k.k); gl.uniform4fv(u.uCellS, k.s); gl.uniform4fv(u.uCellU, k.u); gl.uniform4fv(u.uCellKS, k.ks); gl.uniform4fv(u.uCellKU, k.ku); }
    gl.uniform2f(u.uDrift, this.drift[0], this.drift[1]);
    gl.uniform2f(u.uShift, wrapField(this.shift[0]), wrapField(this.shift[1]));   // CLK1: wrapped to the field's period
    gl.uniform2f(u.uCamXZ, this.cam[0], this.cam[1]);
    const ck = this.clocks ?? cloudClocks(0, [0, 0]);
    gl.uniform3f(u.uEvolve, ck.evolve[0], ck.evolve[1], ck.evolve[2]);
    gl.uniform2f(u.uCoverDrift, ck.coverDrift[0], ck.coverDrift[1]);
  }

  /** DRAW PATH: march this frame's stripe of the sky map and of the
   *  shadow map (both whole on the first call, the shadow map whole
   *  again whenever its square moves). `viewport` the caller's rect. */
  update(viewport) {
    if (!this.state || !this.profile) return;
    const gl = this.gl, q = this.q, s = this.state, p = this.profile;
    const light = cloudLight(s, p);   // VC6b: the slab it falls on decides how far past the horizon it reaches
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    if (this.pendingShift) this._shiftShadowMap(this.pendingShift[0], this.pendingShift[1], viewport);
    // the sky map, a stripe at a time from the first frame on
    {
      const u = this.mu;
      const rows = Math.ceil(q.height / SWEEP_FRAMES);
      const y0 = this.stripe * rows;
      gl.useProgram(this.marchProgram);
      this._fieldUniforms(u);
      gl.uniform2f(u.uMapSize, q.width, q.height);
      gl.uniform3fv(u.uLightDir, light.dir); gl.uniform3fv(u.uLightColor, light.color);
      gl.uniform3fv(u.uCloudLit, s.cloudLit); gl.uniform3fv(u.uCloudShade, s.cloudShade);
      gl.uniform3fv(u.uHorizonColor, s.horizon);
      gl.uniform3fv(u.uSkyTint, s.zenith);   // VC6b: the sky that lights the side the sun does not
      gl.uniform1f(u.uDusk, duskWeight(s.sunDir[1], light.day));   // VC6b: the SUN's own angle and weight - zero at night, so the whole slice is off
      gl.uniform1i(u.uSteps, q.steps); gl.uniform1i(u.uLightSteps, q.light);
      if (this._packed?.count > 0) gl.uniform4fv(u.uCellF, this._packed.f);
      const ice = cirrusLight(s);   // VC7d
      gl.uniform4f(u.uCirrus, this.cirrusCover ?? 0, CIRRUS_TAU, this.clocks?.cirrus ?? 0, this.clocks?.cirrusBoil ?? 0);
      gl.uniform3fv(u.uCirrusLight, ice.color); gl.uniform3fv(u.uCirrusDir, ice.dir);   // VC7c: the curtains' falls, packed with the cells this frame
      withTarget(gl, this.map, viewport, () => {
        gl.viewport(0, y0, q.width, Math.min(rows, q.height - y0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      this.stripe++;
      if (this.stripe * rows >= q.height) { this.stripe = 0; this.sweeps++; }
    }
    // the shadow map (VC4)
    {
      const u = this.su;
      const rows = this.shadowFull ? q.shadow : Math.ceil(q.shadow / SWEEP_FRAMES);
      const y0 = this.shadowFull ? 0 : this.shadowStripe * rows;
      gl.useProgram(this.shadowProgram);
      this._fieldUniforms(u);
      gl.uniform2f(u.uMapSize, q.shadow, q.shadow);
      gl.uniform2f(u.uOrigin, this.origin[0], this.origin[1]);
      gl.uniform1f(u.uExtent, SHADOW_EXTENT);
      gl.uniform3fv(u.uLightDir, s.sunDir);   // the SUN's: the moon casts none
      gl.uniform1i(u.uSteps, q.shadowSteps);
      withTarget(gl, this.shadowMap, viewport, () => {
        gl.viewport(0, y0, q.shadow, Math.min(rows, q.shadow - y0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
      if (this.shadowFull) { this.shadowFull = false; this.shadowMarched = true; this.mapOrigin = [this.origin[0], this.origin[1]]; }
      else {
        this.shadowStripe++;
        if (this.shadowStripe * rows >= q.shadow) this.shadowStripe = 0;
      }
    }
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }

  /** DRAW PATH: the composite over the dome. Same contract as the
   *  dome's draw; the host's marker after the sky covers it. */
  draw(yaw, pitch, fovY, aspect) {
    if (this.sweeps === 0) return;
    const gl = this.gl, u = this.cu;
    gl.useProgram(this.compositeProgram);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE);   // PERF2: only the sky's own pixels
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.SRC_ALPHA, gl.ZERO, gl.ONE);   // sky * T + cloud; the buffer's alpha untouched (ONE, SRC_ALPHA on both would leave it 2T)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.map.tex); gl.uniform1i(u.uMap, 0);
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uFlash, this.flash);
    gl.uniform1f(u.uDread, this.dread);   // EVENT1
    const b = this.bolt;   // WEATHER3d
    gl.uniform4f(u.uBolt, b ? b.dir[0] : 0, b ? b.dir[1] : 1, b ? b.dir[2] : 0, b ? b.strength : 0); gl.uniform1f(u.uBoltCos, b ? b.cos : 1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthFunc(gl.LESS); gl.depthMask(true); gl.enable(gl.CULL_FACE);   // PERF2
  }

  /** DRAW PATH, the lab's: the shadow map as a picture over the frame. */
  drawShadowView() {
    if (!this.origin) return;
    const gl = this.gl;
    gl.useProgram(this.viewProgram);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.tex); gl.uniform1i(this.vu.uMap, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }
}

// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EV8 — THE FAR PROVINCE RING. Beyond the streamed grid the horizon
// was fog meeting sky; the province's actual mountains were sitting
// unread in the same WOODS.WLD heightmap the travel map already
// renders. This module puts them on the horizon: a coarse relief -
// ONE vertex per map pixel - built around the player and drawn as a
// self-contained pass between the sky and the streamed world.
//
// THE HEIGHT LAW IS THE STREAMED TERRAIN'S OWN, un-exaggerated:
// max(byte*8, oceanElevation) * terrainScale, in world units - the
// exact macro-shape generateSamples builds its detail on top of. The
// travel map's x24 OVERWORLD_RELIEF is display skin and stays there.
// Tints are overworldTint(climate, byte), the port's one documented
// map-pixel-to-ground-colour law (ocean-swamp trap and all); normals
// are real central differences so the ring takes the live sun.
//
// PLACEMENT rides the floating origin for free: vertices are built in
// pixel-corner units relative to a BASE pixel, and the draw takes
// state.pixelTranslation(base) as its one origin - a recenter changes
// that translation before the next draw, so the mesh never moves by
// hand (the law every hand-offset consumer in world.js exists for
// having broken).
//
// THE HOLE: the streamed grid draws AFTER the ring with a full depth
// story, so painter's order already hides the ring wherever real
// terrain covers it. The one case it cannot fix is a coarse ring peak
// spiking ABOVE the streamed silhouette from inside the grid - so the
// ring's range of the index buffer skips every cell inside the streamed
// rect (FAR-SEA1: the flat sea's cells there are a range of their own,
// below), re-punched per pixel crossing (indices only - the vertex grid
// rebuilds only when the player has drifted far from the ring base).
//
// THE FADE is the pass's own, NOT the world fog: the world's linear
// fog saturates at 2400/3200 units and the ring lives entirely beyond
// it - drawn through renderer.setFog it would be an invisible flat
// wash. Instead the mix toward the live fog colour follows the world
// fog's own ramp but CAPS at RING_HAZE_HOLD through the middle
// distance (peaks read through haze - the point of the feature) and
// only closes to 1 at the mesh rim, where the ring must dissolve into
// the sky it sits against. FAR-SEA1: the law is render/horizonHaze.js's
// now, the one the streamed sea takes too - min(ramp, hold), not
// hold * ramp - so the ocean runs from the streamed grid onto the ring
// at one haze, and the ring's sea is the water's own (AUDIT FAR-SEA1
// L1/L2: the water's body texel, its light, its Fresnel and its glints -
// render/horizonHaze.js SEA_LOOK_GLSL, which the water's shader calls
// too) rather than flat ground under the overworld's ocean tint.
//
// FAR-SEA1: THE SEA INSIDE THE HOLE. The streamed world is drawn
// through a 6000-unit far plane, and a grid of radius 5 or 6 reaches
// past it toward its corners - there the sky showed between the clipped
// sea and the ring. The cells inside the hole whose four corners are all
// sea, flat at the sea's own height, are kept as a SECOND range of the
// index buffer: at the far plane (LEQUAL) they paint only where nothing
// streamed was drawn, and a flat sea cannot stand above anything. AUDIT
// FAR-SEA1 P1: sorted farthest first, and drawn only as far as they can
// lie past the world's far plane from where the eye stands (seaFillCount)
// - none with the eye under the sea, where a swimmer looks up at the
// surface, not at the ring. Whole, the range shaded most of the screen's
// sea to show in a hundredth of it.
//
// GL DISCIPLINE: drawn between sky.draw and the host's existing
// markForeignPass, so the renderer's EV6 state shadows are already
// due a reset and this pass needs no save/restore of its own (the R9
// law: the next entry point owns its binding). Depth is tested and never
// written, like the sky it extends - PERF2's: at the far plane under
// LEQUAL, so it draws only where nothing nearer has. AUDIT FAR-SEA1 P1:
// placed there by depthRange(1, 1) around the draw, not by a depth write
// in the shader, which would run the shader for every fragment before
// the test and take the GPU's early rejection from the whole pass.
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { overworldTint, isWaterPixel, BASE_HEIGHT_SCALE } from '../ui/overworldModel.js';   // FAR-SEA1: and the overworld's own water rule, for the ring's sea
import { nodeGround, centreGround, cliffFadeAt, CLIFF_REACH, byteBeyond, byteBase } from '../world/landforms.js';   // LANDFORM1: the landforms' lift on a pixel's byte; AUDIT LANDFORMS II I1: faded beside the sea; BREATHTAKER2: and its continuation past the 7-bit top, past the Bay; RELIEF-PEAKS: the kernel's own ground at a node and at a pixel's centre
import { redMountainLiftAt, redMountainNodeLift, redMountainFrame, redMountainGround } from '../world/tamriel/redMountain.js';   // RED-MOUNTAIN: the volcano on the horizon, its lava's levels
import { RedMountainFire, ashTint, fireCone, coneIn, FIRE_PROGRAMS } from './redMountainFire.js';   // RED-MOUNTAIN: its fire, drawn in this pass; its ash on the horizon; the cone the far draws hide behind
import { GhostfenceGlow, fenceGlowDisabled, fenceFeet, GLOW_PROGRAMS } from './ghostfenceGlow.js';   // GHOSTFENCE: its glow, drawn after the fire
import { ghostfenceFrame } from '../world/tamriel/ghostfence.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { buildProgram, compiledPass } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link; AUDIT RED-MOUNTAIN F5: the fire's and the glow's doors
import { RING_SEA_GLSL, FLORA_GLSL, FLORA_CROWN_M, FLORA_GROVE_M } from './horizonHaze.js';   // FAR-SEA1: the horizon's haze and the sea's own look, one text for the ring (both lanes) and the sea
import { RING_CLOUD_GLSL, cloudFarOf } from './cloudShadow.js';   // OW-HORIZON: the clouds' shadows on the ring, as on the ground beside it
import { RING_HAZE_GLSL } from './hazeGlsl.js';   // BANTHA1: the jungle's haze over the ring, both lanes' one text (render/hazeGlsl.js)
import { WATER_F0, WATER_TINT } from './waterSurface.js';   // FAR-SEA1: the water's own Fresnel; AUDIT FAR-SEA1 L1: and its tint
import { MidRingMesh, midRingVertexSteps, midRingDisabled, plantCanopy, layGround } from './midRing.js';   // MID-RING: the kernel's own ground between the grid and this ring
import { MID_RADIUS, MID_SUB, MID_REBUILD_DRIFT, FAR_CELL, FAR_RADIUS, FAR_REBUILD_DRIFT, FAR_CLIMATE_ASK, midRingSide } from '../world/terrain/midRingGrid.js';
import { FarFieldMesh, farFieldVertexSteps, farFieldDisabled, cellOffsets, FAR_RIM_START, FAR_RIM_END, FAR_LENS_FAR } from './farField.js';   // FAR-FIELD: the land past this ring
import { FarLandmark, landmarkDistance } from './farLandmarks.js';   // FAR-LANDMARK: a city's silhouette in this pass's painter's order
import { SCALED_OCEAN_ELEVATION as OCEAN_Y, BASE_HEIGHT_SCALE as BYTE_SCALE } from '../world/terrain/terrainSampler.js';
import { CLIMATES } from '../formats/mapsFile.js';   // FAR-FIELD: a cell's centre on the ocean's climate is the sea
import { pageHas } from '../systems/pageQuery.js';
import { expectedTrees, standsTrees, FLORA } from '../world/terrain/floraCover.js';   // FAR-FLORA: the near law's woods, where the field is past the vertices' reach
import { createFloraArt, floraDisabled, FLORA_MIN_LAND_VIEW } from './farFlora.js';   // FAR-FLORA: the trees' own art
import { tamrielLandsOn } from '../systems/landsSwitch.js';   // TESA-LANDS: the lands' row - the far woods and ground a zone's own
import { FarTreesBand, farTreesDisabled } from './farTrees.js';   // FAR-TREES: the near trees carried past the grid
import { capLineOfPixel, capShare, whiten } from '../world/peaks/snowcap.js';   // PEAKS1: the summits' snow on the horizon   // MID-RING: the probes' read stands behind the shot gate (AUDIT ANTICHEAT A2)
/** MID-RING: the band (metres, Chebyshev from the traveller) over which the middle ring's ground eases onto the far
 *  ring's - ending where the traveller's farthest drift from its base still leaves its rim (MID_RADIUS - MID_REBUILD_DRIFT
 *  pixels: the far ring's ground there whatever the base), two pixels wide. */
export const MID_MORPH_END = (MID_RADIUS - MID_REBUILD_DRIFT) * TERRAIN_SIZE;
export const MID_MORPH_START = MID_MORPH_END - 2 * TERRAIN_SIZE;
/** MID-RING / FAR-FIELD: a frame's share of the horizon's builds (milliseconds) - a landed ground's vertices laid a step of
 *  rows at a time (render/midRing.js midRingVertexSteps, render/farField.js farFieldVertexSteps), one step at the least. */
export const HORIZON_BUDGET_MS = 2;

/** Ring radius in map pixels around the base - ~39 km of horizon. */
export const RING_RADIUS = 48;
/** Rebuild the vertex grid when the player drifts this far (pixels)
 *  from the ring base; until then only the hole re-punches. */
export const RING_REBUILD_DRIFT = 12;
/** OW-RING: a tree's art landed rebuilds the grid once the book has stood still FLORA_SETTLE_MS, or FLORA_WAIT_MAX_MS after
 *  the first landed - a new zone's arts land in a burst, and each was a build of its own (13 of 20-150 ms in a minute's
 *  journey past the Bay). */
export const FLORA_SETTLE_MS = 1500;
export const FLORA_WAIT_MAX_MS = 6000;
/** The haze mix held through the middle distance - the last 15% is
 *  silhouette, and only the rim closes fully into the sky. */
export const RING_HAZE_HOLD = 0.85;
/** AUDIT EV F-R3: the rim close keys on the NEAREST rim the square mesh can present - an edge midpoint with the base
 *  drifted RING_REBUILD_DRIFT toward it. FAR-SEA1: exported, because the streamed sea closes over the same rim. */
export const RING_RIM_END = (RING_RADIUS - RING_REBUILD_DRIFT) * TERRAIN_SIZE * 0.95;
export const RING_RIM_START = RING_RIM_END * 0.6;

/** RED-MOUNTAIN-SEEN (FIELD FEEDBACK 2026-10-31, "Red Mountain doesn't always render"): how the far views stand under the
 *  frame's fog row, or null where they stand not. A linear row is the draw distance's haze: its ramp, held at
 *  RING_HAZE_HOLD, the summits in thinner air. An exp row is weather: under a sky drawn clear (`excludeSky`: rain, snow,
 *  ash, Dynamic Skies' overcast) the land past the grid fogs by the row's own law, as the streamed ground does - its shape
 *  against the sky where the fog has closed, as the streamed ground's far hills stand. Where the fog covers the sky too
 *  (the heavy fog, the sandstorm) there is no shape to see. */
export function ringFogOf(row) {
  if (row?.mode !== 'linear') {
    if (!row?.excludeSky || (row.mode !== 'exp' && row.mode !== 'exp2')) return null;
    // AUDIT FB1031 L2: the row's own law and density (horizonHaze.js horizonHazeOf) - wholly the fog's colour had stood
    // a seam at the grid's edge wherever the ground still showed through (a sprinkle, a near Land View)
    _weatherAir.law = row.mode === 'exp2' ? 2 : 1; _weatherAir.density = row.density;
    return _weatherAir;
  }
  _clearAir.start = row.start ?? 0; _clearAir.end = row.end;   // one scratch, read in the frame it is asked
  return _clearAir;
}
const _weatherAir = { start: 0, end: 0, hold: 1, weather: true, law: 1, density: 0 };
const _clearAir = { start: 0, end: 0, hold: RING_HAZE_HOLD, weather: false, law: 0, density: 0 };
/** RED-MOUNTAIN-SEEN: the summits' thinner air past no distance - under weather nothing stands through. */
const NO_SUMMIT = 1e9;

/** The streamed law's own macro height for one map-pixel byte, world units, at the byte's own NODE (where the kernel stands
 *  it). RELIEF-PEAKS: world/landforms.js nodeGround - the kernel's two terms (the large map by its law of the small: it had
 *  been left out, and the horizon stood the Bay's Dragontails some 470 m under the ground it hands over to) and, LANDFORM1,
 *  with `relief` (the Landforms row) the landforms' lift on it; `fade`, the node's own cliffFadeAt beside the sea (AUDIT
 *  LANDFORMS II I1), as the kernel fades it; `beyond` the continent's share there (BREATHTAKER2). */
export const ringHeight = (byte, relief = false, fade = 1, beyond = 0) => nodeGround(byte, relief ? fade : 1, relief ? beyond : 0, relief) * STREAMING_TERRAIN_SCALE;
/** BREATHTAKER2 (CYRODIIL-RELIEF, stream G): a byte's node height as the stream's ground stands it - ringHeight with the
 *  continent's share at its byte node (world/landforms.js byteBeyond: 0 on the Bay and its seam, past it the lift that
 *  goes on over the 7-bit top, CONTINENT_LIFT), never a copy of the law. */
export const ringHeightAt = (x, y, byte, relief = false, fade = 1) => ringHeight(byte, relief, fade, relief ? byteBeyond(x, y) : 0);
/** RELIEF-PEAKS: THE RING'S GROUND AT PIXEL (x, y)'s CENTRE, where its vertex stands - the kernel's own mean ground there
 *  (world/landforms.js centreGround: the small term's cubic over the pixel's window, the large map by its law, the lift
 *  faded by its nodes' fades), world units. The ring stood a pixel's own byte at its centre, half a pixel from where the
 *  kernel stands it, and 410 to 500 m off the kernel's ground in the continent's ranges; this is 1 to 12 m. `byteAt` the
 *  ground's bytes; `fadeAt` a node's fade (cliffFadeAt on them, unless the caller holds its own). */
export const ringGroundAt = (x, y, byteAt, relief = false, fadeAt = null) =>
  (centreGround(byteAt, x, y, relief, fadeAt) + (relief ? redMountainLiftAt(x, y) : 0)) * STREAMING_TERRAIN_SCALE;   // RED-MOUNTAIN: and its smooth cone
/** RED-MOUNTAIN: a far view's tint at pixel (x, y) with the cone's ash and rock laid over it (render/redMountainFire.js
 *  ashTint), with the landforms' lift alone - where the cone stands. */
export const ringTintAt = (tint, x, y, relief) => (relief ? ashTint(tint, redMountainLiftAt(x, y) * STREAMING_TERRAIN_SCALE) : tint);
/** FAR-SEA1: the ring's sea level - a vertex standing here over a water pixel is the sea (after ringHeight: a const). */
const RING_SEA_Y = ringHeight(0);

/**
 * The ring's vertex grid: (2R+1)^2 vertices at map-pixel centres,
 * pixel-corner units relative to `base` (x = (px - baseX + 0.5) *
 * 819.2, z = -(py - baseY - 0.5) * 819.2 - map Y runs south, the
 * streamed world's own sign), heights un-exaggerated, tints from the
 * overworld law, normals by clamped central differences over the
 * neighbouring bytes.
 *
 * @param {object} o
 * @param {Uint8Array} o.heightBytes - woods.heightMapBuffer, y*width+x.
 * @param {number} o.mapWidth
 * @param {number} o.mapHeight
 * @param {(x:number,y:number)=>number} o.climateAt - raw CLIMATE.PAK value.
 * @param {number} o.baseX
 * @param {number} o.baseY
 * @param {number} [o.radius]
 * @param {boolean} [o.relief] - LANDFORM1: the Landforms row's lift on every height (ringHeight)
 * @param {?((x: number, y: number) => number)} [o.byteAt] - TAMRIEL2: the height byte past the map's edge, or null for the clamp
 * @param {?((x: number, y: number) => number)} [o.climatePast] - ETHER-SEA: the climate past the map's edge, or null for the clamp
 * @param {?((x: number, y: number) => boolean)} [o.pastOwn] - AUDIT CAPTAIN'S SEA G6: whether `byteAt` answers a pixel past
 *   the map with its own ground (the continent's, the Eltheric Ocean's) rather than the clamp - its cliffs then faded at its
 *   own pixel; null: every pixel past the map it is handed
 * @param {?((x: number, y: number) => number)} [o.snowAt] - PEAKS1: a pixel's cap line (m above the sea - ringSnowAt), or
 *   null for no cap: a vertex over it whitened by its height and its slope (world/peaks/snowcap.js capShare)
 * @param {?((climate: number, px?: number, py?: number) => ?{ spec: any, art: any, ground: any })} [o.floraOf] - FAR-FLORA: a climate's flora (render/farFlora.js
 *   floraOf), or null for none: a land vertex's woods the near law's expectation (floraCover.js expectedTrees - the field's
 *   waves are under its 819 m), in the trees' art and raised to their height; `flora` its cover (0-255) and `ground` the
 *   heights under the canopy. TESA-LANDS: asked at the vertex's map pixel (px, py) - past the Bay a zone's own
 */
export function buildFarRingGrid({ heightBytes, mapWidth, mapHeight, climateAt, baseX, baseY, radius = RING_RADIUS, relief = false, byteAt: byteAtPast = null, climatePast = null, pastOwn = null, snowAt = null, floraOf = null }) {
  const side = radius * 2 + 1;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  const colors = new Uint8Array(side * side * 3);
  const sea = new Uint8Array(side * side);   // FAR-SEA1: 255 where the vertex is the sea - a water pixel at the sea's own height
  const flora = floraOf ? new Uint8Array(side * side * 4) : null, ground = floraOf ? new Float32Array(side * side) : null;   // FAR-FLORA: the canopy (render/midRing.js plantCanopy's four bytes) and the ground under it
  const clampX = (x) => Math.max(0, Math.min(mapWidth - 1, x));
  const clampY = (y) => Math.max(0, Math.min(mapHeight - 1, y));
  const { byteAt, climateOf } = ringReaders({ heightBytes, mapWidth, mapHeight, climateAt, byteAt: byteAtPast, climatePast });
  // RELIEF-PEAKS: each vertex the kernel's own mean ground at its pixel's centre (ringGroundAt) - off the bytes read once
  // into a grid padded by the normals' reach, the window's (two) and the fade's (the composed read is a law's, not an
  // array's), and the nodes' fades once a node into a grid of their own (sixteen a vertex).
  // AUDIT LANDFORMS II I1: each node's lift faded beside the sea as the kernel fades it - from the same clamped bytes.
  // AUDIT CAPTAIN'S SEA G6: where the host hands the ground past the map, a node there faded at its OWN pixel (the clamped
  // corner's fade, 1, stood every isle on the horizon with its whole lift)
  const pad = radius + 3 + CLIFF_REACH, gside = 2 * pad + 1, gx0 = baseX - pad, gy0 = baseY - pad;
  const grid = new Uint8Array(gside * gside);
  for (let j = 0; j < gside; j++) for (let i = 0; i < gside; i++) grid[j * gside + i] = byteAt(gx0 + i, gy0 + j);
  const gridByte = (x, y) => grid[(y - gy0) * gside + (x - gx0)];
  const own = (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight) || (!!byteAtPast && (!pastOwn || pastOwn(x, y)));
  const fpad = radius + 3, fside = 2 * fpad + 1, fx0 = baseX - fpad, fy0 = baseY - fpad, fades = relief ? new Float32Array(fside * fside) : null;
  if (fades) for (let j = 0; j < fside; j++) for (let i = 0; i < fside; i++) { const x = fx0 + i, y = fy0 + j; fades[j * fside + i] = own(x, y) ? cliffFadeAt(gridByte, x, y) : cliffFadeAt(byteAt, clampX(x), clampY(y)); }
  const fadeAt = fades ? (x, y) => fades[(y - fy0) * fside + (x - fx0)] : null;
  const hside = side + 2, heights = new Float64Array(hside * hside);   // the vertices' and the normals' one row beyond them
  for (let j = 0; j < hside; j++) for (let i = 0; i < hside; i++) heights[j * hside + i] = ringGroundAt(baseX - radius - 1 + i, baseY - radius - 1 + j, gridByte, relief, fadeAt);
  const heightOf = (x, y) => heights[(y - baseY + radius + 1) * hside + (x - baseX + radius + 1)];
  let o = 0;
  for (let j = 0; j < side; j++) {
    const py = baseY - radius + j;
    for (let i = 0; i < side; i++) {
      const px = baseX - radius + i;
      const byte = byteAt(px, py);
      positions[o] = (px - baseX + 0.5) * TERRAIN_SIZE;
      positions[o + 1] = heightOf(px, py);
      positions[o + 2] = -(py - baseY - 0.5) * TERRAIN_SIZE;
      // central differences; +py is -z, so the z slope negates
      const nx = heightOf(px - 1, py) - heightOf(px + 1, py);
      const nz = heightOf(px, py + 1) - heightOf(px, py - 1);
      const ny = 2 * TERRAIN_SIZE;
      const l = Math.hypot(nx, ny, nz);
      normals[o] = nx / l;
      normals[o + 1] = ny / l;
      normals[o + 2] = nz / l;
      const climate = climateOf(px, py);
      const tint = ringTintAt(overworldTint(climate, byte), px, py, relief);   // RED-MOUNTAIN: its ash
      colors[o] = tint[0]; colors[o + 1] = tint[1]; colors[o + 2] = tint[2];
      if (ground) ground[o / 3] = positions[o + 1];
      if (isWaterPixel(climate, byte) && Math.abs(positions[o + 1] - RING_SEA_Y) < 1e-3) sea[o / 3] = 255;
      else {
        if (floraOf && standsTrees(normals[o + 1], byte * BASE_HEIGHT_SCALE)) {   // FAR-FLORA: the near law's beach line and face
          const f = floraOf(climate, px, py);   // TESA-LANDS: at its pixel - a zone's own past the Bay
          if (f) {
            layGround(colors, o, f.ground, FLORA.ground[1], FLORA.ground[2], FLORA.ground[3]);   // the near ground's own tiles, by the law's mean shares
            positions[o + 1] += plantCanopy(flora, o / 3, expectedTrees(f.spec, byte), f.art);
          }
        }
        if (snowAt) {
          const share = capShare(positions[o + 1] - RING_SEA_Y, normals[o + 1], snowAt(px, py));
          whiten(colors, o, share);   // PEAKS1
          if (flora?.[(o / 3) * 4]) whiten(flora, (o / 3) * 4 + 1, share);   // FAR-FLORA: and the canopy under it
        }
      }
      o += 3;
    }
  }
  return { positions, normals, colors, sea, side, flora, ground };
}

/** PEAKS1: the cap line the horizon's snow reads at a pixel (world/peaks/snowcap.js capLineOfPixel on the ring's own climate
 *  reader), with the Landforms row (`relief`) - none without it: the classic ground's horizon stays its own. */
export const ringSnowAt = (inputs) => (inputs.relief ? ((climateOf) => (x, y) => capLineOfPixel(x, y, climateOf))(ringReaders(inputs).climateOf) : null);

/**
 * A pixel's height byte and climate as the ring reads them (buildFarRingGrid; MID-RING's tints the same, render/midRing.js):
 * TAMRIEL2: past the map the host may hand the continent's own bytes (world/tamriel/tamrielGround.js groundWoods); the
 * map's bytes stay the buffer's, read as ever - the clamp is the host's edge-of-the-world when it hands none. ETHER-SEA:
 * and the climate past the map, where the host hands one (the Eltheric Ocean's isles wear their own; the clamp read the
 * Bay's edge's there, and an isle stood in the edge's climate).
 */
export function ringReaders({ heightBytes, mapWidth, mapHeight, climateAt, byteAt: byteAtPast = null, climatePast = null }) {
  const clampX = (x) => Math.max(0, Math.min(mapWidth - 1, x));
  const clampY = (y) => Math.max(0, Math.min(mapHeight - 1, y));
  const byteAt = byteAtPast
    ? (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight ? heightBytes[y * mapWidth + x] : byteAtPast(x, y))
    : (x, y) => heightBytes[clampY(y) * mapWidth + clampX(x)];
  const climateOf = climatePast
    ? (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight ? climateAt(x, y) : climatePast(x, y))
    : (x, y) => climateAt(clampX(x), clampY(y));
  return { byteAt, climateOf };
}

/**
 * The ring's triangles, with the HOLE punched. AUDIT EV F-R2 made the
 * rule exact: vertices sit at pixel CENTRES, so cell (px, py) spans
 * corner-units [px+0.5, px+1.5] while the streamed footprint spans
 * [cx-d, cx+d+1] - the two lattices are offset by half a pixel and no
 * hole can match the footprint exactly. The rule skips every cell
 * that lies FULLY inside the footprint (px in [cx-d, cx+d-1], same in
 * y), which leaves one straddling cell on EVERY side, each
 * overlapping the streamed rim by half a pixel. That direction is the
 * law: an overlap costs nothing (the streamed grid draws after the
 * ring with the full depth story and paints over it), while the first
 * cut of this rule skipped the east/south straddlers too and opened a
 * 409.6-unit strip along those rims that NEITHER surface covered - a
 * sky gap under grazing sightlines. The residual exposure - a coarse
 * straddle vertex half a pixel inside the rect spiking above the
 * streamed silhouette where the sampler's noise runs low - is half a
 * pixel deep on all four sides, symmetric, and sits past the fog end
 * under the haze hold. Recorded, watched.
 */
export function buildFarRingIndices(hole) {
  const side = (hole.radius ?? RING_RADIUS) * 2 + 1;
  const out = new Uint32Array((side - 1) * (side - 1) * 6);
  return out.subarray(0, writeRingCells(out, hole));
}

/**
 * Whether the cell at (px, py) is in the hole - the streamed world's: fully inside its footprint (AUDIT EV F-R2's rule)
 * and, OW-HORIZON, when the host hands the pixels it has built (`built`: the footprint's own, one byte a pixel, row by
 * row from its north-west corner - footprintBuilt), every one of the four pixels the cell spans built. A pixel the stream
 * still owes is the ring's until its own ground stands: drawn at the far plane, the coarse cell shows only through the
 * gap, where the sky showed before - unseen while the haze closed inside the grid, and plain from the Overworld once it
 * no longer does (the grid's edge ring is built as the traveller goes, and the journey's governor never waits on it).
 */
function inHole(px, py, { holeX, holeY, holeRadius, built = null }) {
  if (px < holeX - holeRadius || px > holeX + holeRadius - 1 || py < holeY - holeRadius || py > holeY + holeRadius - 1) return false;
  if (!built) return true;
  const w = 2 * holeRadius + 1, k = (py - holeY + holeRadius) * w + (px - holeX + holeRadius);
  return !!(built[k] && built[k + 1] && built[k + w] && built[k + w + 1]);
}

/**
 * OW-HORIZON: THE HOST'S BUILT PIXELS (scenes/world.js `built`, keyed "x,y") - a Map that counts the times its keys
 * changed: `changes` moves on a key added and on a key removed, never on an entry replaced under its key (a rebuild
 * published over its own pixel covers the same ground). punchHole keys the hole by it, so the hole is asked again
 * exactly when the pixels it covers may have moved - the set's size alone stood still when the stream dropped one
 * pixel and built another between two frames (a season's re-skin tearing a pixel down while another's build lands),
 * and left the dropped one open to the sky.
 */
export class BuiltPixels extends Map {
  constructor(entries) {
    super();
    this.changes = 0;
    if (entries) for (const [k, v] of entries) this.set(k, v);
  }
  set(k, v) { if (!this.has(k)) this.changes++; return super.set(k, v); }
  delete(k) { const had = super.delete(k); if (had) this.changes++; return had; }
  clear() { if (this.size) this.changes++; super.clear(); }
}

/** RED-MOUNTAIN F2: the widest square about (holeX, holeY), within the hole, whose every pixel the host has built
 *  (`built` its pixel map; none handed, the hole's every pixel counts) - its radius in pixels, -1 with the centre unbuilt. */
export function builtCore(built, holeX, holeY, holeRadius) {
  if (!built) return holeRadius;
  for (let r = 0; r <= holeRadius; r++) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if ((Math.abs(i) === r || Math.abs(j) === r) && !built.has(`${holeX + i},${holeY + j}`)) return r - 1;
    }
  }
  return holeRadius;
}
/** RED-MOUNTAIN F6: the streamed grid's edge, metres from its centre pixel's centre, at Land View `radius` - where the
 *  summits' thinner air starts coming in (horizonHaze.js SUMMIT_HAZE). */
export const summitFromOf = (radius) => (radius + 0.5) * TERRAIN_SIZE;

/** OW-HORIZON: the footprint's pixels the host has built - `built` its pixel map (keyed "x,y", scenes/world.js `built`) -
 *  one byte a pixel, row by row from the north-west corner (inHole's `built`). Asked only when the hole is punched. */
export function footprintBuilt(built, holeX, holeY, holeRadius) {
  const w = 2 * holeRadius + 1, out = new Uint8Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) out[j * w + i] = built.has(`${holeX - holeRadius + i},${holeY - holeRadius + j}`) ? 1 : 0;
  return out;
}

/** The ring's cells (outside the hole) written into `out` from 0; the count of indices written. AUDIT FAR-SEA1 P4: the
 *  pass writes the ring and the sea's fill into ONE buffer a crossing, as the ring alone did before the slice. */
function writeRingCells(out, hole) {
  const { baseX, baseY, radius = RING_RADIUS } = hole;
  const side = radius * 2 + 1;
  let o = 0;
  // FAR-LANDMARK: THE PAINTER'S ORDER - with the traveller's pixel (`from`), the cells farthest first from it (their
  // centres, a pixel corner each: the far field's offsets, sorted once), each cell's distance (map pixels) into `dist` -
  // so a nearer hill is drawn over a farther one, and a landmark takes its place between them (render/farLandmarks.js)
  if (hole.from) {
    const [fx, fy] = hole.from, offs = cellOffsets(radius + RING_REBUILD_DRIFT + 2);
    let c = 0;
    for (let t = 0; t < offs.length; t += 2) {
      const px = fx + offs[t], py = fy + offs[t + 1], i = px - baseX + radius, j = py - baseY + radius;
      if (i < 0 || j < 0 || i >= side - 1 || j >= side - 1 || inHole(px, py, hole)) continue;
      const i0 = j * side + i, i1 = i0 + 1, i2 = i0 + side, i3 = i2 + 1;
      out[o++] = i0; out[o++] = i2; out[o++] = i3;
      out[o++] = i0; out[o++] = i3; out[o++] = i1;
      if (hole.dist) hole.dist[c] = Math.hypot(offs[t] + 0.5, offs[t + 1] + 0.5);
      c++;
    }
    return o;
  }
  for (let j = 0; j < side - 1; j++) {
    const py = baseY - radius + j;
    for (let i = 0; i < side - 1; i++) {
      const px = baseX - radius + i;
      if (inHole(px, py, hole)) continue;
      const i0 = j * side + i;
      const i1 = i0 + 1;
      const i2 = i0 + side;
      const i3 = i2 + 1;
      out[o++] = i0; out[o++] = i2; out[o++] = i3;
      out[o++] = i0; out[o++] = i3; out[o++] = i1;
    }
  }
  return o;
}

/**
 * FAR-SEA1: THE SEA INSIDE THE HOLE - the cells buildFarRingIndices skips (fully inside the streamed footprint) whose
 * four corners are all the sea (`sea`, buildFarRingGrid's), in the same winding. Flat at the sea's own height, a cell
 * here can never stand above the streamed silhouette (the case the hole exists for): drawn at the far plane, it shows
 * only where the streamed world drew nothing - past the world's far plane, in the grid's corners.
 *
 * AUDIT FAR-SEA1 P1: AND ONLY THE CELLS THAT CAN BE PAST IT. The ring's fragments are depth-tested at the far plane,
 * and shading them all would cost the screen's whole sea: drawn whole, the fill shaded 55-60% of the frame from a
 * raised eye and showed in less than a hundredth of it. So the cells are sorted by `reach` - the farthest corner's
 * distance (world units) from the hole pixel's centre, descending - and the pass draws only the prefix that can lie
 * past the far plane from where the eye stands (seaFillCount). Returns { indices, reach }.
 */
export function buildSeaFillIndices(hole) {
  const cells = seaFillCells(hole);
  const indices = new Uint32Array(cells.length * 6);
  writeSeaFill(indices, 0, cells, (hole.radius ?? RING_RADIUS) * 2 + 1);
  return { indices, reach: Float32Array.from(cells, (c) => c[0]) };
}

/** The fill's cells, [reach, i0] each, farthest first - the hole's own (inHole: a cell the ring draws is no fill's). */
function seaFillCells(hole) {
  const { baseX, baseY, radius = RING_RADIUS, holeX, holeY, sea } = hole;
  const side = radius * 2 + 1;
  const cells = [];
  for (let j = 0; j < side - 1; j++) {
    const py = baseY - radius + j;
    for (let i = 0; i < side - 1; i++) {
      const px = baseX - radius + i;
      if (!inHole(px, py, hole)) continue;
      const i0 = j * side + i;
      if (!(sea[i0] && sea[i0 + 1] && sea[i0 + side] && sea[i0 + side + 1])) continue;
      // the cell's corners are the pixel centres px, px+1 and py, py+1: its farthest point from the hole pixel's centre
      const ax = Math.max(Math.abs(px - holeX), Math.abs(px + 1 - holeX));
      const ay = Math.max(Math.abs(py - holeY), Math.abs(py + 1 - holeY));
      cells.push([TERRAIN_SIZE * Math.hypot(ax, ay), i0]);
    }
  }
  return cells.sort((a, b) => b[0] - a[0]);
}

/** The fill's cells written into `out` from `at`, in the ring's winding; the count of indices written. */
function writeSeaFill(out, at, cells, side) {
  let o = at;
  for (const [, i0] of cells) {
    const i1 = i0 + 1, i2 = i0 + side, i3 = i2 + 1;
    out[o++] = i0; out[o++] = i2; out[o++] = i3;
    out[o++] = i0; out[o++] = i3; out[o++] = i1;
  }
  return o - at;
}

/**
 * AUDIT FAR-SEA1 P1: how many of the fill's cells (reach, farthest first) can lie past the world's far plane - `far`,
 * view depth - for an eye `h` over the ring's sea and `offset` across from the hole pixel's centre. A point's view
 * depth is never more than its distance from the eye, and a cell's points are no farther from the eye than
 * hypot(reach + offset, h): a cell under sqrt(far^2 - h^2) - offset can never be past the plane, from anywhere. An eye
 * at or under the sea draws none (a swimmer looks up at the surface, not at the ring).
 */
export function seaFillCount(reach, { far, h, offset }) {
  if (!(h > 0) || !(far > 0)) return 0;
  const bound = Math.sqrt(Math.max(0, far * far - h * h)) - offset;
  let k = 0;
  while (k < reach.length && reach[k] > bound) k++;
  return k;
}

/** The far plane of a GL perspective matrix (world/mat4.js perspective: m[10] = (f+n)/(n-f), m[14] = 2fn/(n-f)) - the
 *  world's own, so the fill reads the plane it fills past rather than a second copy of its number. Float32 storage
 *  costs it about a part in a thousand; seaFillCount is handed 99% of it, the conservative side. */
export const perspectiveFar = (m) => m[14] / (m[10] + 1);

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in float aSea;   // FAR-SEA1: 1 at the sea's vertices
layout(location=4) in float aCoarse;   // MID-RING: the far ring's own height under a middle ring's vertex
layout(location=5) in vec4 aCanopy;    // FAR-FLORA: x the canopy's cover, yzw its colour - (0, 0, 0, 1) where no array is bound: none
uniform vec4 uCanopyBand;   // FAR-TREES: x, y the band's dither (metres, Chebyshev from uCanopyFrom) - the canopy over it, its trees under it; z 1 while the band stands
uniform vec3 uCanopyFrom;
uniform vec3 uMorph;      // MID-RING: x, y the band (metres, Chebyshev from uMorphFrom) its ground eases onto the far ring's over; z 1 to ease
uniform vec3 uMorphFrom;  // the traveller (the haze's own point, else the eye)
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uOrigin;
uniform highp sampler2DArray uSeaTiles;   // AUDIT FAR-SEA1 L1: the camera climate's ground tiles - record 0 is its water
uniform vec3 uSeaTint;                    // the water's tint (and Iliac Puddle No More's over its open sea)
uniform vec4 uHazeFrom;   // OW-HORIZON: the point the haze is measured from (w 1: the travel view's traveller, the world fog's focus); w 0: the eye
out vec3 vNormal;
out vec3 vColor;
out float vDist;
out float vSea;
out vec3 vWorld;     // the sea's point, for its facing to the eye (world space: the frame's light directions are too)
out vec3 vSeaBody;   // the water's own body: its texel averaged by the mip chain, tinted - waterSurface.js's body, one fetch a vertex
out float vFlora;
out vec3 vCanopy;
void main() {
  vec3 world = aPos + uOrigin;
  // MID-RING: toward its rim the middle ring's ground eases onto the far ring's surface under it, by the traveller's own
  // distance - so where the far ring takes over the two are one surface, and the band moves with the traveller, not with
  // the ring's rebuilds
  if (uMorph.z > 0.5) {
    vec2 d = abs(world.xz - uMorphFrom.xz);
    world.y = mix(aPos.y, aCoarse, smoothstep(uMorph.x, uMorph.y, max(d.x, d.y))) + uOrigin.y;
  }
  vNormal = aNormal;
  // FAR-FLORA: the canopy's share of the ground, its cover - FAR-TREES: under the band, whose own trees stand there, none
  // (the band's trees dither out over the same metres as the canopy comes in); the program mixes it (FLORA_GLSL)
  vec2 cb = abs(world.xz - uCanopyFrom.xz);
  vFlora = aCanopy.x * (uCanopyBand.z > 0.5 ? smoothstep(uCanopyBand.x, uCanopyBand.y, max(cb.x, cb.y)) : 1.0);
  vColor = aColor;
  vCanopy = aCanopy.yzw;
  vSea = aSea;
  vWorld = world;
  vSeaBody = textureLod(uSeaTiles, vec3(0.5, 0.5, 0.0), 8.0).rgb * uSeaTint;
  vec4 view = uView * vec4(world, 1.0);
  vDist = uHazeFrom.w > 0.5 ? length(world - uHazeFrom.xyz) : length(view.xyz);   // OW-HORIZON: from where the world's fog is
  gl_Position = uProj * view;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in float vDist;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // AUDIT EV F-R4: the moonlit night reaches the horizon too
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform vec3 uFogColor;
uniform float uFogStart; // the WORLD fog's start (0 for DFU's rows; Dynamic Skies' Sunny starts at 2000 - AUDIT 61)
uniform float uFogEnd;   // the WORLD fog's end - the ramp the seam must match
uniform float uRimStart; // where the hold starts closing into the sky
uniform float uRimEnd;   // the mesh rim - fully sky by here
uniform float uHazeHold;
${RING_SEA_GLSL}
${RING_CLOUD_GLSL}
${RING_HAZE_GLSL}
${FLORA_GLSL}
out vec4 outColor;
void main() {
  // PERF2: at the far plane - under LEQUAL it draws only where the streamed world did not, and over the sky. AUDIT
  // FAR-SEA1 P1: placed there by the pass's depthRange(1, 1), not written here - a shader that writes its depth runs
  // before its depth test, for every fragment the streamed world already covers
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  float mdiff = max(dot(n, uMoonDir), 0.0);
  float sun = ringSun();   // OW-HORIZON: the clouds' shadow where their map knows the ground, the far law past it
  // FAR-FLORA: the canopy over the ground by its cover, lit as the trees are near (horizonHaze.js floraLight) and grained
  vec3 lit = mix(vColor * (uAmbient + uSunColor * (sun * diff) + uMoonColor * (uMoonScale * mdiff)), vCanopy * floraLight(uAmbient, uSunColor, sun, uMoonColor, uMoonScale) * floraGrain(vWorld.xz), vFlora);
  // FAR-SEA1: the sea is the water's own (AUDIT FAR-SEA1 L1/L2: its body, its light, its glints) - the land pays nothing for it
  float sea = vSea * uSeaLook;
  if (sea > 0.0) lit = mix(lit, ringSea(uAmbient, uSunColor, uMoonColor, sun), sea);
  // the world fog's own ramp, capped at the hold - silhouettes read
  // through the haze - then closed to 1 at the rim (FAR-SEA1: the horizon's one law)
  outColor = vec4(mix(lit, uFogColor, ringHaze(horizonHazeOf(uFogLaw, vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, summitHold(uHazeHold, vDist)))), 1.0);   // BANTHA1: and the jungle's haze
}`;
// SHADER-EASE MOUNT-START (2026-10-29): what the constructor builds, started at page load (render/mountPrograms.js).
/** @param {any} lane the installed lane (renderer.lightingLane), or null */
export const farRingPrograms = (lane) => [/** @type {const} */ ([VS, lane ? lane.farRingFs : FS])];

const FLAT_UP = new Float32Array([0, 1, 0]);
const NO_SKY = new Float32Array(3);   // FAR-SEA1: a frame with no sky to reflect (uSeaLook 0 reads none)
/** AUDIT FAR-SEA1 L1: the unit the sea's tiles ride for the pass - inside the host's sky-to-markForeignPass span, whose
 *  mark forgets the renderer's texture shadows after it (PERF-TEX), beside the lane's eye on 11. */
export const RING_SEA_UNIT = 12;
const FLAT_WHITE = new Float32Array([1, 1, 1]);
const NO_HAZE = new Float32Array(8);   // BANTHA1: uJungleHaze off ([1].x 0)
const NO_FOCUS = new Float32Array(4);   // OW-HORIZON: no focus (w 0) - the haze from the eye, as ever
const NO_RECT = new Float32Array(4);    // OW-HORIZON: no deck (w 0) - no shadow, the far law's 1
/** OW-HORIZON: the unit the ring binds the deck's map on - the renderer's own CLOUD_SHADOW_UNIT, and the same map it
 *  binds there for the ground, so the renderer's record of that unit stays true across the ring's pass. */
export const RING_CLOUD_UNIT = 15;

/** ?ring=off - the escape hatch, read once at scene build. */
export function ringDisabled(search = globalThis.location?.search) {
  try { return /[?&]ring=off\b/.test(search ?? ''); }
  catch { return false; }
}
/** RED-MOUNTAIN: `?redfire=off` - the volcano's lava and plume not drawn (its cone is the ground's, and stands). */
export function fireDisabled(search = globalThis.location?.search) {
  try { return /[?&]redfire=off\b/.test(search ?? ''); }
  catch { return false; }
}

export class FarRingRenderer {
  /** EL1: `opts.lane` (render/enhancedLighting.js's EL_LANE, or null) picks
   *  the lane's fragment shader over the classic one - two programs, never
   *  one with a switch - and decodes the scene colours draw() takes.
   *  OW-HORIZON: `opts.renderer`, the renderer the world is drawn by - its lane (when no `lane` is handed), and each
   *  frame its focus (the point the world's fog is measured from) and its cloud deck, so the ring hazes and shades
   *  as the ground beside it does. MID-RING: `opts.mid`, the terrain's client (world/terrain/terrainGenClient.js midRing) -
   *  the middle ring's heights are asked of its worker, and the ring stands between the streamed grid and this one. */
  constructor(gl, opts = {}) {
    this.gl = gl;
    this.renderer = opts.renderer ?? null;
    this._midSource = opts.mid && !midRingDisabled() ? opts.mid : null;
    this._mid = null;           // MID-RING: its mesh, once a ring's heights have landed
    this._midAsk = null;        // the base a request is out for ("x,y"), or null
    this._midGen = 0;           // a request's generation: one answered after a newer one is let go
    this._inputs = null;        // the grid's inputs (build's), the middle ring's tints read through them
    this._farSource = opts.mid && !farFieldDisabled() ? opts.mid : null;   // FAR-FIELD: the far field's cells, asked of the same worker
    this._far = null; this._farAsk = null; this._farGen = 0;
    this._work = [];            // the horizon's landed grounds still being laid: { it, done }, a frame's share at a time
    /** @type {?Float32Array} */ this._midOrigin = null;   // the middle ring's and the far field's origins, made once
    /** @type {FarLandmark[]} */ this._landmarks = [];   // FAR-LANDMARK: the silhouettes handed in (addLandmark)
    /** @type {?Float32Array} */ this._lmOrigin = null;
    /** @type {?Float32Array} */ this._ringDist = null;   // each written cell's distance from the traveller's pixel
    /** @type {any} */ this._builtNow = null;
    /** @type {?Float32Array} */ this._farOrigin = null;
    this._now = opts.now ?? (() => performance.now());
    this._fire = null; this._fireDoor = null; this._fireOff = fireDisabled();   // RED-MOUNTAIN: the volcano's fire, made the first frame it stands and its programs are done
    this._fence = null; this._fenceDoor = null; this._fenceOff = fenceGlowDisabled(); this._midGround = null;   // GHOSTFENCE: its glow, and the middle ring's ground it stands on
    this._depthR = -1; this._depthBoxOut = null; this._cone = null;   // RED-MOUNTAIN F2: the built square about the hole's centre (pixels), where the world's depth stands; the cone
    // FAR-FLORA: the trees' art (render/farFlora.js) - `opts.flora` a book of one's own (a test's), null for none; by
    // default the pipeline's, unless `?farflora=off`. The woods stand at Land View FLORA_MIN_LAND_VIEW and up (the knob).
    this._flora = opts.flora !== undefined ? opts.flora : (floraDisabled() ? null : createFloraArt({ lands: tamrielLandsOn() }));   // TESA-LANDS: a zone's own past the Bay, with the row
    this._floraRadius = 0;      // the streamed radius the woods were last judged by (punchHole's)
    this._floraVersion = -1;    // the book's version this ring's grid was built with
    this._floraSeen = null;     // OW-RING: the book's version last seen moving, when, and since when the grid is owed it
    // the probes' read (tools/horizonProbe.mjs): which of the horizon's layers stand, and round which bases - let go by
    // the ring that set it (dispose)
    this._statsFn = () => this.horizonStats();
    if (pageHas('shot')) globalThis.__horizonRings = this._statsFn;
    this.lane = opts.lane ?? this.renderer?.lightingLane ?? null;
    this._dec = new Float32Array(3);
    const p = buildProgram(gl, VS, this.lane ? this.lane.farRingFs : FS, 'far ring');
    // FAR-TREES: the band past the grid - with the woods (the knob's), a worker to lay it, and not `?fartrees=off`
    this._band = this._flora && opts.mid && !farTreesDisabled() ? new FarTreesBand(gl, { source: opts.mid, lane: this.lane }) : null;
    this._bandOrigin = new Float32Array(3);
    this._bandLight = [new Float32Array(3), new Float32Array(3), new Float32Array(3)];
    this.program = p;
    this.u = {};
    for (const name of ['uProj', 'uView', 'uOrigin', 'uLightDir', 'uAmbient', 'uSunScale', 'uSunColor',
      'uMoonDir', 'uMoonScale', 'uMoonColor',
      'uFogColor', 'uFogStart', 'uFogEnd', 'uRimStart', 'uRimEnd', 'uHazeHold', 'uSummitFrom', 'uFogLaw',   // RED-MOUNTAIN F6: the summits' thinner air past the grid's edge; AUDIT FB1031 L2: the weather's law
      'uSkyZenith', 'uSkyHorizon', 'uSeaF0', 'uSeaLook',   // FAR-SEA1: the sea's sky, its Fresnel, and whether it has one
      'uEye', 'uSeaTiles', 'uSeaTint', 'uSeaAmbient', 'uSeaSunColor', 'uSeaMoonColor',   // AUDIT FAR-SEA1 L1: the water's body, its light (the lane's in the water's own space)
      'uELExposure', 'uAdapt', 'uJungleHaze', 'uHazeEye',   // BANTHA1: the jungle's haze and the eye it is measured from
      'uHazeFrom', 'uCloudShadowMap', 'uCloudShadowRect', 'uCloudShadowFar', 'uCloudFar',   // OW-HORIZON: the fog's focus, the clouds' map and its far law
      'uMorph', 'uMorphFrom',   // MID-RING: the middle ring's ease onto this one
      'uFlora', 'uCanopyBand', 'uCanopyFrom']) {   // FAR-FLORA: the woods on, and their crowns' and groves' spacing; FAR-TREES: the band's crossfade
      this.u[name] = gl.getUniformLocation(p, name);
    }
    this.vao = null;
    this.buffers = [];
    this.indexCount = 0;
    this.ringCount = 0;   // FAR-SEA1: the indices outside the hole; indexCount adds the sea inside it
    this._sea = null;
    this._fillReach = new Float32Array(0);   // AUDIT FAR-SEA1 P1: the fill's cells' reach, farthest first
    this._holeX = 0; this._holeY = 0;
    this._seaTint = new Float32Array(3);
    this.baseX = 0; this.baseY = 0;
    this._holeKey = '';
    this._proj = null;
    this._projKey = '';
    this._built = false;
  }

  /** (Re)build the vertex grid around `base` and punch the hole (`built`: punchHole's). */
  build(gridInputs, holeX, holeY, holeRadius, built = null) {
    const gl = this.gl;
    this._inputs = gridInputs;   // MID-RING: the middle ring's tints are read the way this grid's are
    this._readers = null;   // FAR-TREES: the band's climate reader, made again for these inputs
    this._floraRadius = holeRadius;
    const floraOf = this._floraOf();   // FAR-FLORA: the woods, with the knob's Land View
    this._floraVersion = floraOf ? /** @type {any} */ (this._flora).version : -1;
    const { positions, normals, colors, sea, side, flora, ground } = buildFarRingGrid({ ...gridInputs, snowAt: ringSnowAt(gridInputs), floraOf });   // PEAKS1: the summits white
    this._ringY = { positions, ground, side, baseX: gridInputs.baseX, baseY: gridInputs.baseY, radius: gridInputs.radius ?? RING_RADIUS };   // MID-RING: this ring's heights at the pixel centres (its canopy's: its ease's ground); FAR-FLORA: and the ground under it
    this.baseX = gridInputs.baseX; this.baseY = gridInputs.baseY;
    this.dispose(false);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (data, loc, type, normalized, size = 3) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, type, normalized, 0, 0);
      this.buffers.push(b);
    };
    buf(positions, 0, gl.FLOAT, false);
    buf(normals, 1, gl.FLOAT, false);
    buf(colors, 2, gl.UNSIGNED_BYTE, true);
    buf(sea, 3, gl.UNSIGNED_BYTE, true, 1);   // FAR-SEA1
    if (flora) buf(flora, 5, gl.UNSIGNED_BYTE, true, 4);   // FAR-FLORA: the canopy's cover and colour
    this._sea = sea;
    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    this.buffers.push(this._indexBuffer);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._built = true;
    this._holeKey = '';
    this.punchHole(holeX, holeY, holeRadius, built);
  }

  /** Re-punch the hole (indices only; the vertex grid stands). OW-HORIZON: `built`, the host's pixel map (BuiltPixels),
   *  keeps every pixel it has not built the ring's (inHole) - asked again whenever its keys change: a pixel built or
   *  dropped. A plain Map (no `changes`) is keyed by its size. */
  punchHole(holeX, holeY, holeRadius, built = null) {
    this._floraRadius = holeRadius;   // FAR-FLORA: the knob's Land View, as the frame has it
    const mid = this._midFrame(holeX, holeY, built);   // MID-RING: the middle ring asked for, ordered and cut first
    const key = `${holeX},${holeY},${holeRadius},${built ? (built.changes ?? built.size) : -1},${mid ? `${mid.baseX},${mid.baseY},${mid.radius}` : '-'}`;
    if (!this._built || key === this._holeKey) return;
    const gl = this.gl;
    this._builtNow = built;   // FAR-LANDMARK: a landmark whose pixel the stream has built stands down
    const from = [holeX, holeY], dist = (this._ringDist ??= new Float32Array((RING_RADIUS * 2) ** 2));   // FAR-LANDMARK: the cells by distance
    const grid = { baseX: this.baseX, baseY: this.baseY, holeX, holeY, holeRadius, built: built ? footprintBuilt(built, holeX, holeY, holeRadius) : null, from, dist };
    // MID-RING: with the middle ring standing, this ring's hole is its footprint whole (it stands there, built pixel or
    // none); the sea's fill stays the streamed grid's, the built pixels the middle ring leaves to the stream
    const hole = mid ? { baseX: this.baseX, baseY: this.baseY, holeX: mid.baseX, holeY: mid.baseY, holeRadius: mid.radius, built: null, from, dist } : grid;
    const side = RING_RADIUS * 2 + 1;
    const out = new Uint32Array((side - 1) * (side - 1) * 6);   // AUDIT FAR-SEA1 P4: one buffer - the hole's cells are the fill's room
    const ringN = writeRingCells(out, hole);
    const cells = seaFillCells({ ...grid, sea: this._sea });   // FAR-SEA1: the sea inside the streamed grid's hole, after the ring, farthest first
    const fillN = writeSeaFill(out, ringN, cells, side);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, out.subarray(0, ringN + fillN), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this.ringCount = ringN;
    this.indexCount = ringN + fillN;
    this._fillReach = Float32Array.from(cells, (c) => c[0]);
    this._holeX = holeX; this._holeY = holeY;
    this._depthR = builtCore(built, holeX, holeY, holeRadius);
    this._holeKey = key;
  }

  /**
   * MID-RING: the middle ring's turn of a frame (punchHole's) - its heights asked of the terrain's worker for the
   * traveller's pixel when it has none or the traveller has drifted MID_REBUILD_DRIFT from its base (one ask at a time; an
   * answer for a base let go is dropped), its painter's order written for the traveller's pixel, and its runs cut where
   * the stream has built. Answers the mesh while it stands, else null (the far ring's hole is then the grid's, as before).
   */
  _midFrame(curX, curY, built) {
    this._workFrame();   // the grounds landed: a frame's share of their vertices laid
    this._farFrame(curX, curY);   // FAR-FIELD: the land past this ring, its own turn
    if (this._band && this._inputs && this._floraOf()) {   // FAR-TREES: the band's turn - with the woods, the knob's Land View
      this._readers ??= ringReaders(this._inputs);
      this._band.frame({ curX, curY, radius: this._floraRadius, built, climateOf: this._readers.climateOf, forests: /** @type {any} */ (this._flora).forests ?? true, landform: !!this._inputs.relief, lands: !!(/** @type {any} */ (this._flora).lands), work: this._work });   // TESA-LANDS: and the zones' own trees
    }
    if (!this._midSource || !this._inputs) return null;
    const mid = this._mid;
    const drift = mid ? Math.max(Math.abs(curX - mid.baseX), Math.abs(curY - mid.baseY)) : Infinity;
    if ((drift > MID_REBUILD_DRIFT || this._floraStale(mid) || this._groundStale(mid)) && this._midAsk === null) this._askMid(curX, curY);   // FAR-FLORA: and a tree's art landed since; FLORA-GROUND: and the ground the band's trees stand on moved
    if (!mid?.built) return null;
    mid.reorder(curX, curY);
    mid.cut(built ? (k) => built.has(k) : () => false, built ? (built.changes ?? built.size) : -1);
    return mid;
  }

  /** FAR-FLORA: the climate's flora the far views build with - the book's floraOf while the woods stand (a book, not
   *  `?farflora=off`, Land View FLORA_MIN_LAND_VIEW and up), else null. */
  _floraOf() {
    const book = this._flora;
    return book && this._floraRadius >= FLORA_MIN_LAND_VIEW ? (climate, x, y) => book.floraOf(climate, x, y) : null;   // TESA-LANDS: at the map pixel
  }

  /** FAR-FLORA: whether a layer built with the book at `layer.floraVersion` is owed a build with the art landed since (or
   *  with the woods turned on or off by the knob). */
  _floraStale(layer) {
    if (!layer) return false;
    const now = this._floraOf() ? /** @type {any} */ (this._flora).version : -1;
    return (layer.floraVersion ?? -1) !== now;
  }

  /** FLORA-GROUND: whether the middle ring was laid on a ground whose inputs have moved since (the terrain client's
   *  `groundEpoch` - the band's trees are laid again on the moved ground, render/farTrees.js, so the ground under them is
   *  too). */
  _groundStale(layer) {
    return !!layer && (layer.groundEpoch ?? 0) !== (this._midSource?.groundEpoch ?? 0);
  }

  /** MID-RING / FAR-FIELD: the frame's share of the grounds' builds - steps until HORIZON_BUDGET_MS is spent, one at the
   *  least; a build whose generation was let go is dropped. */
  _workFrame() {
    const t0 = this._now();
    let stepped = false;
    while (this._work.length && (!stepped || this._now() - t0 < HORIZON_BUDGET_MS)) {
      const w = this._work[0], r = w.it.next();
      stepped = true;
      if (r.done) { this._work.shift(); w.done(r.value); }
    }
  }

  /** FAR-FIELD: the far field's turn - asked for the traveller's cell when it has none or they drifted FAR_REBUILD_DRIFT
   *  cells from its base (one ask at a time), and ordered for their cell and this ring's footprint. */
  _farFrame(curX, curY) {
    if (!this._farSource || !this._inputs || !this._built) return;
    const ccx = Math.floor(curX / FAR_CELL), ccy = Math.floor(curY / FAR_CELL), far = this._far;
    const drift = far ? Math.max(Math.abs(ccx - far.baseCX), Math.abs(ccy - far.baseCY)) : Infinity;
    if ((drift > FAR_REBUILD_DRIFT || this._floraStale(far)) && this._farAsk === null) this._askFar(ccx, ccy);   // FAR-FLORA: and a tree's art landed since
    if (!far?.built) return;
    const R = RING_RADIUS, bx = this.baseX, by = this.baseY;
    far.reorder(ccx, ccy, `${bx},${by}`, { x0: bx - R + 0.5, x1: bx + R + 0.5, y0: by - R + 0.5, y1: by + R + 0.5 });   // this ring's vertices' span
  }

  /** FAR-FIELD: the far field's cells asked of the worker round (baseCX, baseCY); built into its mesh when they land - its
   *  height RELIEF-PEAKS the ground at its vertex's own node (the worker's `ground`: world/landforms.js nodeGroundAt), its
   *  tint this ring's at the cell's centre. */
  _askFar(baseCX, baseCY) {
    const gen = ++this._farGen, inputs = this._inputs, floraOf = this._floraOf();
    const floraVersion = floraOf ? /** @type {any} */ (this._flora).version : -1;
    this._farAsk = `${baseCX},${baseCY}`;
    const seaByte = Math.floor(OCEAN_Y / BYTE_SCALE);   // isWaterPixel's byte arm: byte x 8 at or under the ocean's floor
    Promise.resolve(this._farSource.farField?.({ baseCX, baseCY, radius: FAR_RADIUS, cell: FAR_CELL, seaByte, relief: !!inputs.relief }) ?? null).then((answer) => {
      if (gen !== this._farGen) return;
      if (!answer?.high || !this.gl) { this._farAsk = null; return; }   // the ask stands until its ground is laid
      const { climateOf } = ringReaders(inputs);
      // a cell's climate the worker's where it read one (past the Bay: the continent's biomes, worked out off the frame),
      // else this ring's own reader's
      const clim = answer.clim ?? null, climAt = (x, y, v) => (clim && clim[v] !== FAR_CLIMATE_ASK ? clim[v] : climateOf(x, y));
      const it = farFieldVertexSteps({
        high: answer.high, low: answer.low, baseCX, baseCY,
        heightOf: (byte, x, y, v) => answer.ground[v] + (inputs.relief ? redMountainNodeLift(x, y) * STREAMING_TERRAIN_SCALE : 0),   // RELIEF-PEAKS: the ground at the vertex's node, worked out on the worker (the lift and its continuation, BREATHTAKER2); RED-MOUNTAIN: the smooth cone at the node
        tintAt: (x, y, byte, v) => ringTintAt(overworldTint(climAt(x, y, v), byte), x, y, !!inputs.relief),   // RED-MOUNTAIN: its ash
        oceanAt: (x, y, v) => climAt(x, y, v) === CLIMATES.Ocean,
        seaY: RING_SEA_Y,
        snowAt: inputs.relief ? (x, y, v) => capLineOfPixel(x, y, () => climAt(x, y, v)) : null,   // PEAKS1: a range white 300 km off
        floraAt: floraOf ? (x, y, byte, v) => floraOf(climAt(x, y, v), x, y) : null,   // FAR-FLORA: the woods' expectation in the trees' art; TESA-LANDS: a zone's
      });
      // one ask at a time and it stands until laid, so no newer ask can come while this is laid; a dispose drops the work
      this._work.push({ it, done: (v) => {
        this._farAsk = null;
        (this._far ??= new FarFieldMesh(this.gl)).build(v, { baseCX, baseCY });
        this._far.floraVersion = floraVersion;
      } });
    }, (e) => { if (gen === this._farGen) this._farAsk = null; console.warn('[ring] the far field failed', e?.message ?? e); });
  }

  /** MID-RING: one ring's heights asked of the worker round (baseX, baseY); built into the mesh when they land. */
  _askMid(baseX, baseY) {
    const gen = ++this._midGen, inputs = this._inputs, floraOf = this._floraOf();
    const floraVersion = floraOf ? /** @type {any} */ (this._flora).version : -1;
    this._midAsk = `${baseX},${baseY}`;
    const job = { baseX, baseY, radius: MID_RADIUS, sub: MID_SUB, landform: !!inputs.relief, flora: !!floraOf, lands: !!floraOf && !!(/** @type {any} */ (this._flora).lands) };   // TESA-LANDS: and the field's own value   // FAR-FLORA: the near law's woods beside the heights
    const groundEpoch = this._midSource.groundEpoch ?? 0;   // FLORA-GROUND: the ground this ask is laid on
    Promise.resolve(this._midSource.midRing?.(job) ?? null).then((answer) => {
      if (gen !== this._midGen) return;   // a newer ask, or the renderer disposed
      if (!answer?.heights || !this.gl) { this._midAsk = null; return; }   // the ask stands until its ground is laid
      const { byteAt, climateOf } = ringReaders(inputs);
      const tintAt = (x, y) => ringTintAt(overworldTint(climateOf(x, y), byteAt(x, y)), x, y, !!inputs.relief);   // RED-MOUNTAIN: its ash
      const g = this._ringY;   // a pixel centre's height on this ring - world-fixed, whichever base the grid was built round
      const ringAt = (x, y) => {
        const i = x - g.baseX + g.radius, j = y - g.baseY + g.radius;
        return i >= 0 && j >= 0 && i < g.side && j < g.side ? g.positions[(j * g.side + i) * 3 + 1] : RING_SEA_Y;
      };
      const floraAt = floraOf ? (x, y) => ({ ...floraOf(climateOf(x, y), x, y), byte: byteAt(x, y) }) : null;   // FAR-FLORA: the climate's woods and the WOODS byte; TESA-LANDS: a zone's
      const it = midRingVertexSteps({ heights: answer.heights, baseX, baseY, radius: MID_RADIUS, sub: MID_SUB, tintAt, seaY: RING_SEA_Y, ringAt, wet: answer.wet ?? null, snowAt: ringSnowAt(inputs), flora: answer.flora ?? null, cover: answer.cover ?? null, floraAt });   // PEAKS1: and its summits' snow   // MAP-WATERS: G's rivers as water
      this._work.push({ it, done: (v) => {   // as the far field's: one ask, standing until laid; a dispose drops the work
        this._midAsk = null;
        (this._mid ??= new MidRingMesh(this.gl)).build(v, { baseX, baseY, radius: MID_RADIUS, sub: MID_SUB, curX: baseX, curY: baseY });
        this._mid.floraVersion = floraVersion;
        this._mid.groundEpoch = groundEpoch;   // FLORA-GROUND
        this._midGround = { heights: answer.heights, baseX, baseY, radius: MID_RADIUS, sub: MID_SUB };   // GHOSTFENCE: the ground under the glow's feet
        this._holeKey = '';   // the far ring's hole is the new footprint's
      } });
    }, (e) => { if (gen === this._midGen) this._midAsk = null; console.warn('[ring] the middle ring failed', e?.message ?? e); });
  }

  /**
   * FAR-LANDMARK: A SILHOUETTE ON THE HORIZON - `mesh` in map pixel (px, py)'s own frame (render/farLandmarks.js
   * FarLandmark: x east and z north from its south-west corner, y the world's own heights; `indices`, `normals`, `colors`
   * optional), drawn in this pass by this ring's program - its light, its haze, its clouds' shadows - in the painter's
   * order at its distance from the traveller, while the stream has not built pixel (px, py) (the city's own models stand
   * there then). Answers a handle whose `remove()` lets it go.
   * @param {{ px: number, py: number, mesh: { positions: Float32Array, indices?: ?(Uint16Array | Uint32Array), normals?: ?Float32Array, colors?: ?Uint8Array }, key?: string }} o
   */
  addLandmark({ px, py, mesh, key }) {
    const lm = new FarLandmark(this.gl, { px, py, mesh, key });
    this._landmarks.push(lm);
    return { landmark: lm, remove: () => { const k = this._landmarks.indexOf(lm); if (k >= 0) this._landmarks.splice(k, 1); lm.dispose(); } };
  }
  /** IC-GRAND x FAR-LANDMARK: this ring's ground at map pixel (px, py)'s centre - the world's own height its vertex stands
   *  at (a landmark's foot: scenes/capitalSkyline.js) - or null before a build or off its grid. */
  groundAt(px, py) {
    const g = this._ringY;
    if (!g) return null;
    const i = px - g.baseX + g.radius, j = py - g.baseY + g.radius;
    return i >= 0 && j >= 0 && i < g.side && j < g.side ? (g.ground ? g.ground[j * g.side + i] : g.positions[(j * g.side + i) * 3 + 1]) : null;   // FAR-FLORA: the ground, never the canopy over it
  }

  /** FAR-LANDMARK: the landmarks this frame draws - not on a built pixel - farthest first, each ordered for the traveller. */
  _landmarksNow() {
    if (!this._landmarks.length || this._holeX == null) return [];
    const cx = this._holeX, cy = this._holeY, built = this._builtNow;
    const out = [];
    for (const lm of this._landmarks) {
      if (built?.has?.(`${lm.px},${lm.py}`)) continue;
      lm.reorder(cx, cy);
      out.push({ lm, d: landmarkDistance(lm.px, lm.py, cx, cy) });
    }
    return out.sort((a, b) => b.d - a.d);
  }

  /** FAR-LANDMARK: one landmark drawn at its pixel's origin (this ring's moved by the pixels between), never eased. */
  _drawLandmark(lm, origin) {
    const gl = this.gl, o = this._lmOrigin ??= new Float32Array(3);
    o[0] = origin[0] + (lm.px - this.baseX) * TERRAIN_SIZE; o[1] = origin[1]; o[2] = origin[2] - (lm.py - this.baseY) * TERRAIN_SIZE;
    gl.uniform3f(this.u.uMorph, 0, 0, 0);
    lm.draw(this.u.uOrigin, o);
  }

  /** FAR-LANDMARK: this ring's cells (farthest first, `_ringDist`) cut at each landmark's distance - the farther cells, the
   *  landmark, on - then the rest and the sea's fill; answers the landmarks nearer than every cell (the middle ring's). */
  _ringWithLandmarks(lms, fill, origin) {
    const gl = this.gl, cells = this.ringCount / 6, dist = /** @type {Float32Array} */ (this._ringDist);
    let at = 0;
    const near = [];
    for (const e of lms) {
      let lo = at, hi = cells;   // the first cell nearer than the landmark (the distances fall)
      while (lo < hi) { const m = (lo + hi) >> 1; if (dist[m] >= e.d) lo = m + 1; else hi = m; }
      if (lo >= cells) { near.push(e); continue; }
      if (lo > at) gl.drawElements(gl.TRIANGLES, (lo - at) * 6, gl.UNSIGNED_INT, at * 24);
      this._drawLandmark(e.lm, origin);
      gl.uniform3f(this.u.uOrigin, origin[0], origin[1], origin[2]);
      gl.bindVertexArray(this.vao);
      at = lo;
    }
    gl.drawElements(gl.TRIANGLES, (cells - at) * 6 + 6 * fill, gl.UNSIGNED_INT, at * 24);
    return near;
  }

  /** FAR-LANDMARK: the middle ring's runs cut at each near landmark's distance (its pixels farthest first, MidRingMesh's
   *  order), the landmark drawn between them, its ease off for it. */
  _midWithLandmarks(mid, o, near, origin) {
    const gl = this.gl;
    let at = 0;
    for (const e of near) {
      const k = mid.order.findIndex((p) => p.d < e.d), to = k < 0 ? mid.total : mid.order[k].at;
      mid.drawRange(this.u.uOrigin, o, at, to);
      this._drawLandmark(e.lm, origin);
      gl.uniform3f(this.u.uMorph, MID_MORPH_START, MID_MORPH_END, 1);
      at = to;
    }
    mid.drawRange(this.u.uOrigin, o, at, mid.total);
  }

  /** FAR-TREES: the band drawn by its own program, in this pass's state - this ring's lens, its haze and its light (the
   *  lane's decoded as this ring's are), at its base pixel's origin (this ring's moved by the pixels between). */
  _drawBand(view, origin, f) {
    const gl = this.gl, b = /** @type {FarTreesBand} */ (this._band), d = b.drawn, o = this._bandOrigin;
    o[0] = origin[0] + (d.baseX - this.baseX) * TERRAIN_SIZE; o[1] = origin[1]; o[2] = origin[2] - (d.baseY - this.baseY) * TERRAIN_SIZE;
    const [a, s, m] = this._bandLight, dec = (c, out) => (this.lane ? this.lane.decode3(c, out) : (out.set(c), out));
    const farSun = cloudFarOf(f.deck);
    b.draw({
      proj: this._proj, view, origin: o, radius: this._floraRadius, viewportH: this.renderer?.worldViewportPx?.[3] ?? gl.drawingBufferHeight,
      hazeFrom: this.renderer?.focus ?? NO_FOCUS, ambient: dec(f.ambient, a), sunScale: f.sunScale, sunColor: dec(f.sunColor, s),
      moonScale: f.moonScale, moonColor: dec(f.moonColor ?? FLAT_WHITE, m), fogColor: f.fogColor, fogStart: f.fogStart, fogEnd: f.fogEnd,
      rimStart: f.farField ? FAR_RIM_START : RING_RIM_START, rimEnd: f.farField ? FAR_RIM_END : RING_RIM_END, hold: f.hold, law: f.law, density: f.density,
      haze: f.haze ?? NO_HAZE, hazeEye: f.hazeEye, cloudFar: farSun, cloudRect: f.deck?.map ? f.deck.rect : NO_RECT, cloudUnit: RING_CLOUD_UNIT, exposure: f.exposure,
      ground: this._bandGround(origin),   // HORIZON-TREES: the middle ring's heights, the band's trees cut at its skyline
    });
  }

  /** HORIZON-TREES: the middle ring's heights as the band reads them - its vertex (0, 0) in the scene (this ring's origin
   *  moved by the bases' pixels, the ring's corner radius * sub cells south-west of its base's), its cell and side; none
   *  while no middle ring stands. */
  _bandGround(origin) {
    const mid = this._mid;
    if (!mid?.built || !mid.heights) return null;
    const cell = TERRAIN_SIZE / mid.sub, back = mid.radius * mid.sub * cell;
    return {
      heights: mid.heights, side: midRingSide(mid.radius, mid.sub), cell,
      x0: origin[0] + (mid.baseX - this.baseX) * TERRAIN_SIZE - back, z0: origin[2] - (mid.baseY - this.baseY) * TERRAIN_SIZE - back,
    };
  }

  /** MID-RING / FAR-FIELD: which of the horizon's layers stand (the probes' read): the far ring's base, the middle ring's
   *  base and runs, the far field's base cell and cells drawn, and the grounds still being laid. */
  horizonStats() {
    return {
      far: this._built ? { baseX: this.baseX, baseY: this.baseY, ring: this.ringCount / 6 } : null,
      mid: this._mid?.built ? { baseX: this._mid.baseX, baseY: this._mid.baseY, runs: this._mid.runs.length } : null,
      field: this._far?.built ? { baseCX: this._far.baseCX, baseCY: this._far.baseCY, cells: this._far.count / 6 } : null,
      laying: this._work.length, asking: [this._midAsk, this._farAsk].filter(Boolean).length, landmarks: this._landmarks.length,
      trees: this._band ? this._band.count : null,   // FAR-TREES: the band's trees drawn
      fire: this._fire ? { mesh: !!this._fire.mesh, drawn: this._fire.drawn } : null,   // RED-MOUNTAIN: the volcano's fire, made and drawn
    };
  }

  /** EL4: a 1x1 image holding the multiplier 1 (the log encoding's midpoint), for a lane frame with no adaptation image. */
  _adaptOne() {
    if (this._one) return this._one;
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return (this._one = tex);
  }

  /** True when the player has drifted far enough that the grid should
   *  re-centre (build() again) rather than just re-punch. */
  needsRebuild(px, py) {
    return !this._built
      || Math.max(Math.abs(px - this.baseX), Math.abs(py - this.baseY)) > RING_REBUILD_DRIFT
      || this._floraDue();   // FAR-FLORA: a tree's art landed since the grid was built
  }

  /** OW-RING: whether the art landed since the grid was built is owed a build now - the book still FLORA_SETTLE_MS, or the
   *  grid owed it FLORA_WAIT_MAX_MS. */
  _floraDue() {
    if (!this._floraStale({ floraVersion: this._floraVersion })) { this._floraSeen = null; return false; }
    const now = this._now(), v = /** @type {any} */ (this._flora).version, seen = this._floraSeen;
    if (!seen) this._floraSeen = { v, at: now, since: now };
    else if (seen.v !== v) { seen.v = v; seen.at = now; }
    const s = /** @type {{ at: number, since: number }} */ (this._floraSeen);
    return now - s.at >= FLORA_SETTLE_MS || now - s.since >= FLORA_WAIT_MAX_MS;
  }

  /**
   * Draw the ring. Depth untouched (tests nothing, writes nothing -
   * the streamed world paints over it); its OWN projection, because
   * the world's 6000-unit far plane is 7.3 map pixels.
   */
  draw(view, { origin, lightDir, ambient, sunScale, sunColor, moonDir, moonScale = 0, moonColor, fogColor, fogStart = 0, fogEnd, fog = null, fovY, aspect, exposure = 1, adaptTex = null,
    skyZenith = null, skyHorizon = null, eye = null, worldProj = null, seaTiles = null, seaTint = null, haze = null, hazeEye = null }) {   // BANTHA1: the jungle's haze and its eye; FAR-SEA1: the sky the sea reflects (the water's); AUDIT FAR-SEA1: the eye and the world's lens the fill is counted from (P1), the water's tiles and tint (L1)
    if (!this._built || !this.indexCount) return;
    const rf = ringFogOf(fog ?? { mode: 'linear', start: fogStart, end: fogEnd });   // RED-MOUNTAIN-SEEN: the frame's row (`fog`), or its ramp
    if (!rf) return;
    fogStart = rf.start; fogEnd = rf.end;
    const gl = this.gl;
    const farField = this._far?.built ? this._far : null;   // FAR-FIELD: the land past this ring, while it stands
    const far = farField ? FAR_LENS_FAR : (RING_RADIUS + 1) * TERRAIN_SIZE * 1.5;
    const projKey = `${fovY},${aspect},${far}`;
    if (projKey !== this._projKey) {
      this._proj = mirrorProjectionX(perspective(fovY, aspect, 40, far));
      this._projKey = projKey;
    }
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.uProj, false, this._proj);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniform3f(this.u.uOrigin, origin[0], origin[1], origin[2]);
    gl.uniform3fv(this.u.uLightDir, lightDir);
    const c3 = (c) => (this.lane ? this.lane.decode3(c, this._dec) : c);   // EL1: linear for the lane, as the renderer's _c3
    gl.uniform3fv(this.u.uAmbient, c3(ambient));
    gl.uniform1f(this.u.uSunScale, sunScale);
    gl.uniform3fv(this.u.uSunColor, c3(sunColor));
    gl.uniform3fv(this.u.uMoonDir, moonDir ?? FLAT_UP);
    gl.uniform1f(this.u.uMoonScale, moonScale);
    gl.uniform3fv(this.u.uMoonColor, c3(moonColor ?? FLAT_WHITE));
    if (this.lane) {
      gl.uniform1f(this.u.uELExposure, exposure);
      // EL4: the eye's multiplier, on the lane's reserved unit; a lane without the air pass has none and the shader reads the texture's default 0 -> exp2(-2)... so a bare 1x1 is bound instead
      gl.activeTexture(gl.TEXTURE0 + 11);
      gl.bindTexture(gl.TEXTURE_2D, adaptTex ?? this._adaptOne());
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(this.u.uAdapt, 11);
    }
    gl.uniform3fv(this.u.uFogColor, fogColor);
    gl.uniform1f(this.u.uFogStart, fogStart);
    gl.uniform1f(this.u.uFogEnd, fogEnd);
    // AUDIT EV F-R3: the rim close must key on the NEAREST rim the
    // square mesh can present - an edge midpoint with the base drifted
    // RING_REBUILD_DRIFT toward it - not on the far plane that covers
    // the corners. Keyed on the far plane, the mix at edge midpoints
    // topped out at ~0.885 and tall ring terrain terminated against
    // the sky as a faint unblended straight edge at the four cardinal
    // directions; only the corners actually dissolved.
    gl.uniform1f(this.u.uRimStart, farField ? FAR_RIM_START : RING_RIM_START);   // FAR-FIELD: the land runs on past this ring to the far field's rim
    gl.uniform1f(this.u.uRimEnd, farField ? FAR_RIM_END : RING_RIM_END);
    gl.uniform1f(this.u.uHazeHold, rf.hold);
    gl.uniform2f(this.u.uFogLaw, rf.law, rf.density);   // AUDIT FB1031 L2: a weather's own factor at the far views' distance
    gl.uniform1f(this.u.uSummitFrom, summitFromOf(this._floraRadius));
    if (rf.weather) gl.uniform1f(this.u.uSummitFrom, NO_SUMMIT);   // RED-MOUNTAIN-SEEN: no summit through the weather
    gl.uniform3f(this.u.uFlora, this._floraOf() ? 1 : 0, FLORA_CROWN_M, FLORA_GROVE_M);   // FAR-FLORA: the crowns' grain while the woods stand
    // FAR-TREES: under the band its own trees stand, the canopy over its dithered rim - measured from the band's base pixel
    const bandOn = !!(this._band?.count && this._floraOf()), bd = this._band?.drawn;
    const cf = this._band?.canopyFade ?? [0, 1];
    gl.uniform4f(this.u.uCanopyBand, bandOn ? (this._floraRadius + cf[0]) * TERRAIN_SIZE : 0, bandOn ? (this._floraRadius + cf[1]) * TERRAIN_SIZE : 1, bandOn ? 1 : 0, 0);
    gl.uniform3f(this.u.uCanopyFrom, bandOn ? origin[0] + (bd.baseX - this.baseX + 0.5) * TERRAIN_SIZE : 0, 0, bandOn ? origin[2] - (bd.baseY - this.baseY) * TERRAIN_SIZE + 0.5 * TERRAIN_SIZE : 0);
    gl.uniform4fv(this.u.uJungleHaze, haze ?? NO_HAZE);   // BANTHA1: the jungle's haze (renderer.setJungleHaze) - off ([1].x 0) when none is handed
    gl.uniform3fv(this.u.uHazeEye, hazeEye ?? eye ?? FLAT_UP);
    // OW-HORIZON: the haze from where the world's fog is measured - the travel view's traveller (renderer.setFocus), the
    // eye with none - and the clouds' map and its far law on the ring's sun, the ground's own deck
    gl.uniform4fv(this.u.uHazeFrom, this.renderer?.focus ?? NO_FOCUS);
    const deck = this.renderer?.cloudShadow ?? null, farSun = cloudFarOf(deck);
    gl.uniform1f(this.u.uCloudFar, farSun);
    gl.uniform2f(this.u.uCloudShadowFar, farSun, 1);
    gl.uniform4fv(this.u.uCloudShadowRect, deck?.map ? deck.rect : NO_RECT);
    if (deck?.map) { gl.activeTexture(gl.TEXTURE0 + RING_CLOUD_UNIT); gl.bindTexture(gl.TEXTURE_2D, deck.map); gl.activeTexture(gl.TEXTURE0); }
    gl.uniform1i(this.u.uCloudShadowMap, RING_CLOUD_UNIT);
    // FAR-SEA1: the sky the water reflects this frame and the water's own Fresnel - and without a sky (the classic
    // panorama publishes none: sky.waterSky() is null; AUDIT FAR-SEA1 H2: nor does the host with the Enhanced water off)
    // the sea lit as ground, as it was, never a day sky at night. AUDIT FAR-SEA1 L1: nor without the water's tiles - its
    // body is the water's own texel
    const look = !!(skyZenith && skyHorizon && seaTiles && eye);
    gl.uniform3fv(this.u.uSkyZenith, skyZenith ?? NO_SKY);
    gl.uniform3fv(this.u.uSkyHorizon, skyHorizon ?? NO_SKY);
    gl.uniform1f(this.u.uSeaF0, WATER_F0);
    gl.uniform1f(this.u.uSeaLook, look ? 1 : 0);
    gl.uniform3fv(this.u.uEye, eye ?? FLAT_UP);
    const t = seaTint ?? FLAT_WHITE;
    for (let c = 0; c < 3; c++) this._seaTint[c] = WATER_TINT[c] * t[c];
    gl.uniform3fv(this.u.uSeaTint, this._seaTint);
    // the water's light in the water's own (classic) space: the lane decoded the frame's colours for its ground, the
    // water surface takes them as the host gave them (renderer.js _waterFrameBlock), and so does the sea beside it
    gl.uniform3fv(this.u.uSeaAmbient, ambient);
    gl.uniform3fv(this.u.uSeaSunColor, sunColor);
    gl.uniform3fv(this.u.uSeaMoonColor, moonColor ?? FLAT_WHITE);
    gl.activeTexture(gl.TEXTURE0 + RING_SEA_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, look ? seaTiles : null);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.u.uSeaTiles, RING_SEA_UNIT);
    // AUDIT FAR-SEA1 P1: the fill's cells that can lie past the world's far plane from where the eye stands
    let fill = 0;
    if (eye && worldProj && this._fillReach.length) {
      const cx = origin[0] + (this._holeX - this.baseX + 0.5) * TERRAIN_SIZE;
      const cz = origin[2] - (this._holeY - this.baseY - 0.5) * TERRAIN_SIZE;
      fill = seaFillCount(this._fillReach, {
        far: perspectiveFar(worldProj) * 0.99, h: eye[1] - (origin[1] + RING_SEA_Y), offset: Math.hypot(eye[0] - cx, eye[2] - cz),
      });
    }
    // depth off whole: like the sky it extends, and the streamed world
    // repaints everything nearer; culling off under the mirrored
    // projection (the handedness law every fullscreen pass learned).
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);   // PERF2: tested, not ordered
    gl.depthMask(false);
    gl.depthRange(1, 1);   // AUDIT FAR-SEA1 P1: every fragment at the far plane by the viewport, so the test runs BEFORE the shader
    gl.disable(gl.CULL_FACE);
    const lms = this._landmarksNow();   // FAR-LANDMARK: the silhouettes standing, farthest first (ordered before any array is bound)
    gl.bindVertexArray(this.vao);
    gl.uniform3f(this.u.uMorph, 0, 0, 0);   // MID-RING: the far ring is its own ground
    if (farField) {   // FAR-FIELD: the farthest first - the painter's order the three layers keep
      const o = this._farOrigin ??= new Float32Array(3);
      o[0] = origin[0] + (farField.baseCX * FAR_CELL - this.baseX) * TERRAIN_SIZE; o[1] = origin[1]; o[2] = origin[2] - (farField.baseCY * FAR_CELL - this.baseY) * TERRAIN_SIZE;
      farField.draw(this.u.uOrigin, o);
      gl.uniform3f(this.u.uOrigin, origin[0], origin[1], origin[2]);
      gl.bindVertexArray(this.vao);
    }
    if (!lms.length) gl.drawElements(gl.TRIANGLES, this.ringCount + 6 * fill, gl.UNSIGNED_INT, 0);   // FAR-SEA1: the sea inside the hole is the range's tail - its farthest cells first
    const near = lms.length ? this._ringWithLandmarks(lms, fill, origin) : lms;
    gl.bindVertexArray(null);
    // MID-RING: the middle ring over it, in the same pass - its base's origin is this ring's moved by the bases' pixels, its
    // rim eased onto this ring by the traveller's distance (the haze's own point: the travel view's traveller, else the eye)
    const mid = this._mid;
    if (mid?.built) {
      const o = this._midOrigin ??= new Float32Array(3);
      o[0] = origin[0] + (mid.baseX - this.baseX) * TERRAIN_SIZE; o[1] = origin[1]; o[2] = origin[2] - (mid.baseY - this.baseY) * TERRAIN_SIZE;
      const focus = this.renderer?.focus, from = focus && focus[3] > 0.5 ? focus : (eye ?? o);
      gl.uniform3f(this.u.uMorphFrom, from[0], from[1], from[2]);
      gl.uniform3f(this.u.uMorph, MID_MORPH_START, MID_MORPH_END, 1);
      if (!near.length) mid.draw(this.u.uOrigin, o);
      else this._midWithLandmarks(mid, o, near, origin);
    } else {
      for (const { lm } of near) this._drawLandmark(lm, origin);   // no middle ring: the near ones after this ring
    }
    if (this._band?.count && this._floraOf()) this._drawBand(view, origin, { ambient, sunScale, sunColor, moonScale, moonColor, fogColor, fogStart, fogEnd, hold: rf.hold, law: rf.law, density: rf.density, exposure, haze, hazeEye: hazeEye ?? eye ?? FLAT_UP, farField: !!farField, deck: this.renderer?.cloudShadow ?? null });   // FAR-TREES: the near trees past the grid, nearest of the pass
    // RED-MOUNTAIN: the volcano's lava and plume, then GHOSTFENCE's curtain and halos - each hidden by the cone where no
    // depth stands, both hazed by this ring's own law. AUDIT FB1031 II G1: through the weather too, by its law from the
    // world fog's own point (TV1: the traveller under the travel view), no summit in thinner air - they had been dropped
    // whole under every weather row, no lava even at the crater's rim
    const cone = eye && worldProj ? this._coneNow() : null, fire = cone ? this._fireNow(cone) : null, fence = eye && worldProj ? this._fenceNow() : null;
    if (fire || fence) {
      const focus = this.renderer?.focus;
      const pass = { ringOrigin: origin, baseX: this.baseX, baseY: this.baseY, view, worldProj, worldFar: worldProj[14] / (worldProj[10] + 1), fovY, aspect, far, eye,
        fog: { color: fogColor, start: fogStart, end: fogEnd, law: rf.law, density: rf.density }, rim: farField ? [FAR_RIM_START, FAR_RIM_END] : [RING_RIM_START, RING_RIM_END], hold: RING_HAZE_HOLD,
        summitFrom: rf.weather ? NO_SUMMIT : summitFromOf(this._floraRadius), hazeFrom: rf.weather && focus && focus[3] > 0.5 ? focus : eye, depth: this._depthBox(origin), light: Math.max(ambient[0], ambient[1], ambient[2]) + 0.6 * sunScale, lightDir, seconds: this._now() / 1000,
        cone: cone ? coneIn(cone.at, origin, this.baseX, this.baseY) : null,
        ground: { feet: fenceFeet(), built: this._builtNow, mid: mid?.built ? this._midGround : null, ring: this._ringY },
        morph: { from: focus && focus[3] > 0.5 ? focus : eye, start: MID_MORPH_START, end: MID_MORPH_END } };
      fire?.draw(pass);
      if (fence && this.renderer?.afterFlats) this.renderer.afterFlats(() => fence.draw(pass));   // AUDIT RED-MOUNTAIN N2: over the water and the flats
      else fence?.draw(pass);
    }
    gl.depthRange(0, 1);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    // no program save/restore: this pass draws inside the host's
    // sky-to-markForeignPass span, where the renderer's EV6 shadows
    // are already due their reset (the R9 law).
  }

  /** RED-MOUNTAIN: the cone the far draws hide behind (redMountainFire.js fireCone) on the levels its lava lies at, read
   *  off this ring's own bytes (world/landforms.js byteBase - the kernel's own law of them) - none without the landforms'
   *  lift, which stands it. The glow's with the fire off (`?redfire=off`). */
  _coneNow() {
    const inputs = this._inputs;
    if (!inputs?.relief) return null;
    const frame = redMountainFrame();
    if (!frame) return null;
    const ground = redMountainGround(byteBase(ringReaders(inputs).byteAt), inputs);
    if (this._cone?.frame !== frame || this._cone.ground !== ground) this._cone = { frame, ground, at: fireCone(frame, ground) };
    return this._cone;
  }

  /** RED-MOUNTAIN: the volcano's fire (render/redMountainFire.js) on `cone` (_coneNow's), made the first frame it stands
   *  once its programs are done (AUDIT RED-MOUNTAIN F5: compiledPass - never a frame frozen on their compile) - none by
   *  `?redfire=off`. */
  _fireNow(cone) {
    if (this._fireOff) return null;
    const gl = this.gl;
    this._fire = (this._fireDoor ??= compiledPass(gl, FIRE_PROGRAMS, () => new RedMountainFire(gl), (e) => console.warn('[red mountain] the fire would not build', e?.message ?? e)))();
    this._fire?.update(cone.frame, cone.ground);
    return this._fire;
  }

  /** GHOSTFENCE: the Ghostfence's glow (render/ghostfenceGlow.js), made the first frame the land stands the fence once its
   *  programs are done - with the landforms' row or without it (the fence is the Tribunal's, not the land's), none by
   *  `?fenceglow=off`. */
  _fenceNow() {
    if (this._fenceOff || !this._inputs) return null;
    const frame = ghostfenceFrame();
    if (!frame) return null;
    const gl = this.gl;
    this._fence = (this._fenceDoor ??= compiledPass(gl, GLOW_PROGRAMS, () => new GhostfenceGlow(gl), (e) => console.warn('[ghostfence] the glow would not build', e?.message ?? e)))();
    this._fence?.update(frame);
    return this._fence;
  }

  /** RED-MOUNTAIN F2: the box the world's depth stands over (scene x0, z0, x1, z1) - the built square about the hole's
   *  centre (builtCore) - or null with none built. */
  _depthBox(origin) {
    const r = this._depthR;
    if (r < 0) return null;
    const b = this._depthBoxOut ??= new Float32Array(4);
    b[0] = origin[0] + (this._holeX - r - this.baseX) * TERRAIN_SIZE; b[2] = origin[0] + (this._holeX + r + 1 - this.baseX) * TERRAIN_SIZE;
    b[1] = origin[2] - (this._holeY + r - this.baseY) * TERRAIN_SIZE; b[3] = origin[2] - (this._holeY - r - 1 - this.baseY) * TERRAIN_SIZE;
    return b;
  }

  /** Free the GL objects (every allocation has an owner). */
  dispose(whole = true) {
    const gl = this.gl;
    if (whole) { this._fire?.dispose(); this._fire = null; this._fireDoor = null; }   // RED-MOUNTAIN: the volcano's fire, and its door
    if (whole) { this._fence?.dispose(); this._fence = null; this._fenceDoor = null; }   // GHOSTFENCE: its glow, and its door
    if (whole) { this._midGen++; this._midAsk = null; this._mid?.dispose(); this._mid = null; }   // MID-RING: an answer still out is let go
    if (whole) { this._farGen++; this._farAsk = null; this._far?.dispose(); this._far = null; this._work = []; }   // FAR-FIELD: the same, and any ground still being laid
    if (whole && globalThis.__horizonRings === this._statsFn) delete globalThis.__horizonRings;   // the probes' read, if it is still this ring's
    if (whole) { for (const lm of this._landmarks) lm.dispose(); this._landmarks = []; }   // FAR-LANDMARK: the silhouettes it was handed
    if (whole && this._band) { this._band.dispose(); this._band = null; }   // FAR-TREES: the band's buffers, its atlas, its program
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vao = null;
    this._built = false;
    this.indexCount = 0;
    this.ringCount = 0;
    if (whole && this.program) { gl.deleteProgram(this.program); this.program = null; }
  }
}

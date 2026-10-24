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
import { reliefByteHeight, cliffFadeAt, CLIFF_REACH } from '../world/landforms.js';   // LANDFORM1: the landforms' lift on a pixel's byte; AUDIT LANDFORMS II I1: faded beside the sea
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { buildProgram } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link
import { RING_SEA_GLSL } from './horizonHaze.js';   // FAR-SEA1: the horizon's haze and the sea's own look, one text for the ring (both lanes) and the sea
import { RING_CLOUD_GLSL, cloudFarOf } from './cloudShadow.js';   // OW-HORIZON: the clouds' shadows on the ring, as on the ground beside it
import { RING_HAZE_GLSL } from './hazeGlsl.js';   // BANTHA1: the jungle's haze over the ring, both lanes' one text (render/hazeGlsl.js)
import { WATER_F0, WATER_TINT } from './waterSurface.js';   // FAR-SEA1: the water's own Fresnel; AUDIT FAR-SEA1 L1: and its tint

/** Ring radius in map pixels around the base - ~39 km of horizon. */
export const RING_RADIUS = 48;
/** Rebuild the vertex grid when the player drifts this far (pixels)
 *  from the ring base; until then only the hole re-punches. */
export const RING_REBUILD_DRIFT = 12;
/** The haze mix held through the middle distance - the last 15% is
 *  silhouette, and only the rim closes fully into the sky. */
export const RING_HAZE_HOLD = 0.85;
/** AUDIT EV F-R3: the rim close keys on the NEAREST rim the square mesh can present - an edge midpoint with the base
 *  drifted RING_REBUILD_DRIFT toward it. FAR-SEA1: exported, because the streamed sea closes over the same rim. */
export const RING_RIM_END = (RING_RADIUS - RING_REBUILD_DRIFT) * TERRAIN_SIZE * 0.95;
export const RING_RIM_START = RING_RIM_END * 0.6;

/** The streamed law's own macro height for one map-pixel byte. LANDFORM1: with `relief` (the Landforms row), the
 *  landforms' lift on it - world/landforms.js reliefByteHeight, the same lift the streamed kernel puts on the byte's own
 *  small-heightmap term - so the horizon stands the massifs the ground it hands over to stands; `fade`, the byte node's
 *  own cliffFadeAt beside the sea (AUDIT LANDFORMS II I1), as the kernel fades it. */
export const ringHeight = (byte, relief = false, fade = 1) =>
  (relief ? reliefByteHeight(byte, fade) : Math.max(byte * BASE_HEIGHT_SCALE, SCALED_OCEAN_ELEVATION)) * STREAMING_TERRAIN_SCALE;
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
 */
export function buildFarRingGrid({ heightBytes, mapWidth, mapHeight, climateAt, baseX, baseY, radius = RING_RADIUS, relief = false, byteAt: byteAtPast = null, climatePast = null, pastOwn = null }) {
  const side = radius * 2 + 1;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  const colors = new Uint8Array(side * side * 3);
  const sea = new Uint8Array(side * side);   // FAR-SEA1: 255 where the vertex is the sea - a water pixel at the sea's own height
  const clampX = (x) => Math.max(0, Math.min(mapWidth - 1, x));
  const clampY = (y) => Math.max(0, Math.min(mapHeight - 1, y));
  // TAMRIEL2: past the map the host may hand the continent's own bytes (world/tamriel/tamrielGround.js groundWoods); the map's
  // bytes stay the buffer's, read as ever - the clamp is the host's edge-of-the-world when it hands none
  const byteAt = byteAtPast
    ? (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight ? heightBytes[y * mapWidth + x] : byteAtPast(x, y))
    : (x, y) => heightBytes[clampY(y) * mapWidth + clampX(x)];
  // ETHER-SEA: and the climate past the map, where the host hands one (the Eltheric Ocean's isles wear their own; the clamp
  // read the Bay's edge's there, and an isle stood in the edge's climate)
  const climateOf = climatePast
    ? (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight ? climateAt(x, y) : climatePast(x, y))
    : (x, y) => climateAt(clampX(x), clampY(y));
  // AUDIT LANDFORMS II I1: each node's lift faded beside the sea as the kernel fades it - from the same clamped bytes.
  // AUDIT CAPTAIN'S SEA G6: where the host hands the ground past the map, a node there faded at its OWN pixel (the clamped
  // corner's fade, 1, stood every isle on the horizon with its whole lift) - off the bytes read once into a grid padded
  // by the fade's reach (the composed read is a law's, not an array's: 49 reads a node, five nodes a vertex)
  let heightOf = relief ? (x, y) => ringHeight(byteAt(x, y), true, cliffFadeAt(byteAt, clampX(x), clampY(y))) : (x, y) => ringHeight(byteAt(x, y));
  if (relief && byteAtPast) {
    const pad = radius + 1 + CLIFF_REACH, gside = 2 * pad + 1, gx0 = baseX - pad, gy0 = baseY - pad;
    const grid = new Uint8Array(gside * gside);
    for (let j = 0; j < gside; j++) for (let i = 0; i < gside; i++) grid[j * gside + i] = byteAt(gx0 + i, gy0 + j);
    const gridByte = (x, y) => grid[(y - gy0) * gside + (x - gx0)];
    const own = (x, y) => (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight) || !pastOwn || pastOwn(x, y);
    heightOf = (x, y) => ringHeight(gridByte(x, y), true, own(x, y) ? cliffFadeAt(gridByte, x, y) : cliffFadeAt(byteAt, clampX(x), clampY(y)));
  }
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
      const tint = overworldTint(climate, byte);
      colors[o] = tint[0]; colors[o + 1] = tint[1]; colors[o + 2] = tint[2];
      if (isWaterPixel(climate, byte) && Math.abs(positions[o + 1] - RING_SEA_Y) < 1e-3) sea[o / 3] = 255;
      o += 3;
    }
  }
  return { positions, normals, colors, sea, side };
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
void main() {
  vec3 world = aPos + uOrigin;
  vNormal = aNormal;
  vColor = aColor;
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
out vec4 outColor;
void main() {
  // PERF2: at the far plane - under LEQUAL it draws only where the streamed world did not, and over the sky. AUDIT
  // FAR-SEA1 P1: placed there by the pass's depthRange(1, 1), not written here - a shader that writes its depth runs
  // before its depth test, for every fragment the streamed world already covers
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  float mdiff = max(dot(n, uMoonDir), 0.0);
  float sun = ringSun();   // OW-HORIZON: the clouds' shadow where their map knows the ground, the far law past it
  vec3 lit = vColor * (uAmbient + uSunColor * (sun * diff) + uMoonColor * (uMoonScale * mdiff));
  // FAR-SEA1: the sea is the water's own (AUDIT FAR-SEA1 L1/L2: its body, its light, its glints) - the land pays nothing for it
  float sea = vSea * uSeaLook;
  if (sea > 0.0) lit = mix(lit, ringSea(uAmbient, uSunColor, uMoonColor, sun), sea);
  // the world fog's own ramp, capped at the hold - silhouettes read
  // through the haze - then closed to 1 at the rim (FAR-SEA1: the horizon's one law)
  outColor = vec4(mix(lit, uFogColor, ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold))), 1.0);   // BANTHA1: and the jungle's haze
}`;

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

export class FarRingRenderer {
  /** EL1: `opts.lane` (render/enhancedLighting.js's EL_LANE, or null) picks
   *  the lane's fragment shader over the classic one - two programs, never
   *  one with a switch - and decodes the scene colours draw() takes.
   *  OW-HORIZON: `opts.renderer`, the renderer the world is drawn by - its lane (when no `lane` is handed), and each
   *  frame its focus (the point the world's fog is measured from) and its cloud deck, so the ring hazes and shades
   *  as the ground beside it does. */
  constructor(gl, opts = {}) {
    this.gl = gl;
    this.renderer = opts.renderer ?? null;
    this.lane = opts.lane ?? this.renderer?.lightingLane ?? null;
    this._dec = new Float32Array(3);
    const p = buildProgram(gl, VS, this.lane ? this.lane.farRingFs : FS, 'far ring');
    this.program = p;
    this.u = {};
    for (const name of ['uProj', 'uView', 'uOrigin', 'uLightDir', 'uAmbient', 'uSunScale', 'uSunColor',
      'uMoonDir', 'uMoonScale', 'uMoonColor',
      'uFogColor', 'uFogStart', 'uFogEnd', 'uRimStart', 'uRimEnd', 'uHazeHold',
      'uSkyZenith', 'uSkyHorizon', 'uSeaF0', 'uSeaLook',   // FAR-SEA1: the sea's sky, its Fresnel, and whether it has one
      'uEye', 'uSeaTiles', 'uSeaTint', 'uSeaAmbient', 'uSeaSunColor', 'uSeaMoonColor',   // AUDIT FAR-SEA1 L1: the water's body, its light (the lane's in the water's own space)
      'uELExposure', 'uAdapt', 'uJungleHaze', 'uHazeEye',   // BANTHA1: the jungle's haze and the eye it is measured from
      'uHazeFrom', 'uCloudShadowMap', 'uCloudShadowRect', 'uCloudShadowFar', 'uCloudFar']) {   // OW-HORIZON: the fog's focus, the clouds' map and its far law
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
    const { positions, normals, colors, sea } = buildFarRingGrid(gridInputs);
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
    const key = `${holeX},${holeY},${holeRadius},${built ? (built.changes ?? built.size) : -1}`;
    if (!this._built || key === this._holeKey) return;
    const gl = this.gl;
    const hole = { baseX: this.baseX, baseY: this.baseY, holeX, holeY, holeRadius, built: built ? footprintBuilt(built, holeX, holeY, holeRadius) : null };
    const side = RING_RADIUS * 2 + 1;
    const out = new Uint32Array((side - 1) * (side - 1) * 6);   // AUDIT FAR-SEA1 P4: one buffer - the hole's cells are the fill's room
    const ringN = writeRingCells(out, hole);
    const cells = seaFillCells({ ...hole, sea: this._sea });   // FAR-SEA1: the sea inside the hole, after the ring, farthest first
    const fillN = writeSeaFill(out, ringN, cells, side);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, out.subarray(0, ringN + fillN), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this.ringCount = ringN;
    this.indexCount = ringN + fillN;
    this._fillReach = Float32Array.from(cells, (c) => c[0]);
    this._holeX = holeX; this._holeY = holeY;
    this._holeKey = key;
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
      || Math.max(Math.abs(px - this.baseX), Math.abs(py - this.baseY)) > RING_REBUILD_DRIFT;
  }

  /**
   * Draw the ring. Depth untouched (tests nothing, writes nothing -
   * the streamed world paints over it); its OWN projection, because
   * the world's 6000-unit far plane is 7.3 map pixels.
   */
  draw(view, { origin, lightDir, ambient, sunScale, sunColor, moonDir, moonScale = 0, moonColor, fogColor, fogStart = 0, fogEnd, fovY, aspect, exposure = 1, adaptTex = null,
    skyZenith = null, skyHorizon = null, eye = null, worldProj = null, seaTiles = null, seaTint = null, haze = null, hazeEye = null }) {   // BANTHA1: the jungle's haze and its eye; FAR-SEA1: the sky the sea reflects (the water's); AUDIT FAR-SEA1: the eye and the world's lens the fill is counted from (P1), the water's tiles and tint (L1)
    if (!this._built || !this.indexCount) return;
    const gl = this.gl;
    const far = (RING_RADIUS + 1) * TERRAIN_SIZE * 1.5;
    const projKey = `${fovY},${aspect}`;
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
    gl.uniform1f(this.u.uRimStart, RING_RIM_START);
    gl.uniform1f(this.u.uRimEnd, RING_RIM_END);
    gl.uniform1f(this.u.uHazeHold, RING_HAZE_HOLD);
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
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.ringCount + 6 * fill, gl.UNSIGNED_INT, 0);   // FAR-SEA1: the sea inside the hole is the range's tail - its farthest cells first
    gl.bindVertexArray(null);
    gl.depthRange(0, 1);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    // no program save/restore: this pass draws inside the host's
    // sky-to-markForeignPass span, where the renderer's EV6 shadows
    // are already due their reset (the R9 law).
  }

  /** Free the GL objects (every allocation has an owner). */
  dispose(whole = true) {
    const gl = this.gl;
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

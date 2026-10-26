// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-FIELD (2026-10-26, BREATHTAKER 1 of KPbICA's spec, through the owner: "render landscapes and landforms way further
// than actual distance to load. To see the mountain from 300km for example by rendering it's simplified version";
// bible/06-Systems/Travel-View.md MID-RING): THE FAR FIELD - the land past the far ring, out to 393 km.
//
// THE LAYERS BY DISTANCE, each the one inside it drawn over it, at the far plane, in one pass (render/farRing.js draw):
//   the streamed grid (Land View: 4.5 km)  ->  the middle ring (the kernel's own ground, 102 m cells, to 11.5 km,
//   render/midRing.js)  ->  the far ring (the byte's macro height, 819 m cells, to 39 km)  ->  THE FAR FIELD (a cell's
//   highest byte, 6.55 km cells, to 393 km - world/terrain/midRingGrid.js buildFarFieldBytes, on the terrain worker).
// Its height is the far ring's own law (render/farRing.js ringHeight - the landforms' lift with the Landforms row), read
// off the heightmap's own reader: the ground the stream grows, never a copy of it. Its colour is the far ring's tint at
// the cell's centre, its sea the majority's, its light, haze, clouds' shadows and sea the far ring's program. A cell
// inside the far ring's footprint is left to it (the hole), and the cells are written farthest first from the
// traveller's cell (the painter's order the middle ring keeps), so a near range stands over a farther one.
//
// WHY NO SPRITES. The spec asks for "multilayered 2D sprite composition"; the far field is the layered composition as
// geometry instead: 14,641 vertices, one draw - cheaper than the impostor cards it would take to show the same ranges,
// and stable where a card is not (a card re-baked as the traveller moves shimmers; these vertices are world-fixed, a cell
// a vertex on its own centre, and a rebuild moves none of them - the new cells are added at the rim, past the haze).
//
// THE HAZE. The far ring's law (render/horizonHaze.js horizonHaze: the world fog's ramp held at RING_HAZE_HOLD), its rim
// closed over the far field's (FAR_RIM_START..FAR_RIM_END) while the far field stands - the far ring no longer closes into
// the sky at 28 km, the land runs on at the hold's 15% to the far field's rim. A range 2 km high 300 km off stands about
// half a degree over the horizon.
// ═══════════════════════════════════════════════════════════════════

import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { FAR_CELL, FAR_RADIUS, FAR_REBUILD_DRIFT, FAR_SAMPLES, farFieldSide } from '../world/terrain/midRingGrid.js';
import { runSteps } from './midRing.js';

/** The far field's rim: its nearest edge with the base drifted FAR_REBUILD_DRIFT cells toward it (the far ring's own
 *  RING_RIM_END law), and the haze closed into the sky over its outer two fifths. */
export const FAR_RIM_END = (FAR_RADIUS - FAR_REBUILD_DRIFT) * FAR_CELL * TERRAIN_SIZE * 0.95;
export const FAR_RIM_START = FAR_RIM_END * 0.6;
/** The far plane the rings' own lens takes while the far field stands. */
export const FAR_LENS_FAR = (FAR_RADIUS + 1) * FAR_CELL * TERRAIN_SIZE * 1.5;

/** ?farfield=off - the far field's kill door (the far ring closes into the sky at its rim, as before). */
export function farFieldDisabled(search = globalThis.location?.search) {
  try { return /[?&]farfield=off\b/.test(search ?? ''); }
  catch { return false; }
}

/**
 * The far field's vertex data from the worker's bytes, round base cell (baseCX, baseCY): positions in the frame of the
 * base cell's north-west pixel (x east, z north: x = (corner x - baseX) S, z = (baseY + 1 - corner y) S - the far ring's
 * frame), each vertex its cell's centre; its height `heightOf(byte)` (the far ring's law), or the sea's `seaY` where the
 * cell is the sea (more than half its samples at the sea's floor, or the ocean's climate at its centre); its colour
 * `tintAt(px, py, byte)` at the centre pixel; normals by central differences over the field.
 * @param {{ high: Uint8Array, low: Uint8Array, baseCX: number, baseCY: number, radius?: number, cell?: number,
 *   heightOf: (byte: number) => number, tintAt: (px: number, py: number, byte: number) => ArrayLike<number>,
 *   oceanAt: (px: number, py: number) => boolean, seaY: number }} o
 */
export const farFieldVertices = (o) => runSteps(farFieldVertexSteps(o));

/** How many of the far field's rows a step of its build lays (the frame's share of a rebuild). */
export const FAR_ROWS_A_STEP = 16;

/** farFieldVertices a step of rows at a time - its answer the generator's own. @param {Parameters<typeof farFieldVertices>[0]} o */
export function* farFieldVertexSteps({ high, low, baseCX, baseCY, radius = FAR_RADIUS, cell = FAR_CELL, heightOf, tintAt, oceanAt, seaY }) {
  const side = farFieldSide(radius), n = side * side, S = TERRAIN_SIZE;
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), colors = new Uint8Array(n * 3), sea = new Uint8Array(n);
  const bx = baseCX * cell, by = baseCY * cell, half = cell / 2, majority = (FAR_SAMPLES.length ** 2) / 2;
  for (let j = 0; j < side; j++) {
    if (j && j % FAR_ROWS_A_STEP === 0) yield;
    for (let i = 0; i < side; i++) {
      const v = j * side + i, o = v * 3;
      const cx = baseCX - radius + i, cy = baseCY - radius + j;
      const xc = cx * cell + half, yc = cy * cell + half, px = Math.floor(xc), py = Math.floor(yc);
      const wet = low[v] > majority || oceanAt(px, py);
      positions[o] = (xc - bx) * S;
      positions[o + 1] = wet ? seaY : heightOf(high[v]);
      positions[o + 2] = (by + 1 - yc) * S;
      const t = tintAt(px, py, wet ? 0 : high[v]);
      colors[o] = t[0]; colors[o + 1] = t[1]; colors[o + 2] = t[2];
      if (wet) sea[v] = 255;
    }
  }
  const h = (i, j) => positions[(Math.max(0, Math.min(side - 1, j)) * side + Math.max(0, Math.min(side - 1, i))) * 3 + 1];
  const span = cell * S;
  yield;
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      // rows run south (+j is -z): the far ring's own differences
      const nx = h(i - 1, j) - h(i + 1, j), nz = h(i, j + 1) - h(i, j - 1), ny = 2 * span;
      const l = Math.hypot(nx, ny, nz), o = (j * side + i) * 3;
      normals[o] = nx / l; normals[o + 1] = ny / l; normals[o + 2] = nz / l;
    }
  }
  return { positions, normals, colors, sea, side };
}

/**
 * The far field's cells in the painter's order - farthest first from the traveller's cell (curCX, curCY) - in the far
 * ring's winding, leaving out each cell whose four corners lie in `covered` (the far ring's footprint, a rectangle of
 * pixel-corner coordinates {x0, x1, y0, y1}: it is that ring's).
 * @returns {Uint16Array | Uint32Array}
 */
export function farFieldOrder({ baseCX, baseCY, curCX, curCY, radius = FAR_RADIUS, cell = FAR_CELL, covered }) {
  const side = farFieldSide(radius), centre = (k) => k * cell + cell / 2, cells = side - 1;
  // THE OFFSETS, SORTED ONCE: a grid's cells ordered by their distance from a cell are its offsets from that cell so
  // ordered - farthest first, then the lower row and column (the index's own order) - so a crossing walks the one list
  // and keeps the cells the field holds (sorting the cells a crossing cost the field 16-30 ms on a loaded machine)
  const reach = radius + 2 * FAR_REBUILD_DRIFT + 1, offs = cellOffsets(reach);   // the traveller within twice the drift of the base
  const ci = curCX - (baseCX - radius), cj = curCY - (baseCY - radius);
  const keep = new Uint8Array(cells * cells);
  let k = 0;
  for (let j = 0; j < cells; j++) {
    const cy = baseCY - radius + j, inY = centre(cy) >= covered.y0 && centre(cy + 1) <= covered.y1;
    for (let i = 0; i < cells; i++) {
      const cx = baseCX - radius + i;
      if (inY && centre(cx) >= covered.x0 && centre(cx + 1) <= covered.x1) continue;
      keep[j * cells + i] = 1; k++;
    }
  }
  const out = new (side * side <= 65536 ? Uint16Array : Uint32Array)(k * 6);
  let o = 0;
  for (let t = 0; t < offs.length; t += 2) {
    const i = ci + offs[t], j = cj + offs[t + 1];
    if (i < 0 || j < 0 || i >= cells || j >= cells || !keep[j * cells + i]) continue;
    const i0 = j * side + i;
    const i1 = i0 + 1, i2 = i0 + side, i3 = i2 + 1;
    out[o++] = i0; out[o++] = i2; out[o++] = i3;
    out[o++] = i0; out[o++] = i3; out[o++] = i1;
  }
  return out;
}

/** Every (dx, dy) within `reach` cells either way, by the distance of its cell's centre (dx + 0.5, dy + 0.5) - the
 *  farthest first, then dy, then dx, ascending: farFieldOrder's walk. Kept a reach at a time. */
const _offsets = new Map();
function cellOffsets(reach) {
  let out = _offsets.get(reach);
  if (out) return out;
  const list = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) list.push([dx, dy, (dx + 0.5) ** 2 + (dy + 0.5) ** 2]);
  list.sort((a, b) => b[2] - a[2] || a[1] - b[1] || a[0] - b[0]);
  out = Int16Array.from(list.flatMap(([dx, dy]) => [dx, dy]));
  _offsets.set(reach, out);
  return out;
}

/** The far field's GL side: its vertex arrays and its ordered indices, drawn by the far ring's program (FarRingRenderer
 *  .draw). Owns every buffer it makes. */
export class FarFieldMesh {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.vao = null;
    this.buffers = [];
    this.indexBuffer = null;
    this.count = 0;
    this.indexType = 0;
    this.baseCX = 0; this.baseCY = 0;
    this._orderKey = '';
  }

  get built() { return !!this.vao; }

  /** The vertex arrays uploaded round the base cell. */
  build(v, { baseCX, baseCY }) {
    const gl = this.gl;
    this.dispose();
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
    buf(v.positions, 0, gl.FLOAT, false);
    buf(v.normals, 1, gl.FLOAT, false);
    buf(v.colors, 2, gl.UNSIGNED_BYTE, true);
    buf(v.sea, 3, gl.UNSIGNED_BYTE, true, 1);
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.buffers.push(this.indexBuffer);
    gl.bindVertexArray(null);
    this.vao = vao;
    this.baseCX = baseCX; this.baseCY = baseCY;
    this._orderKey = '';
  }

  /** The order written again when the traveller's cell or the far ring's footprint (`holeKey`) moved. */
  reorder(curCX, curCY, holeKey, covered) {
    const key = `${curCX},${curCY}|${holeKey}`;
    if (!this.vao || key === this._orderKey) return;
    const gl = this.gl;
    const idx = farFieldOrder({ baseCX: this.baseCX, baseCY: this.baseCY, curCX, curCY, covered });
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.count = idx.length;
    this.indexType = idx instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    this._orderKey = key;
  }

  /** Drawn inside the far ring's pass, at its origin. */
  draw(uOrigin, origin) {
    if (!this.vao || !this.count) return;
    const gl = this.gl;
    gl.uniform3f(uOrigin, origin[0], origin[1], origin[2]);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, this.indexType, 0);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    this.indexBuffer = null;
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vao = null;
    this.count = 0;
  }
}

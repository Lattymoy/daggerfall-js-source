// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MID-RING (2026-10-26, the owner: "we need to find a way to expand the overworld view distance without killing
// performance. Currently tiles visibly load in with distance"; bible/06-Systems/Travel-View.md MID-RING):
// THE MIDDLE RING - the streamed kernel's own ground past the streamed grid, between it and the far ring.
//
// WHAT IT IS. A grid of MID_SUB cells a map pixel (a vertex every 102.4 m) over MID_RADIUS pixels round its base, its
// heights the stream's own kernel at whole samples (world/terrain/midRingGrid.js, built on the terrain worker - never
// on the frame), its colour the far ring's (overworldTint at the pixel centres, read bilinearly, so the two rings are one
// field of colour), its light, its haze, its sea and its clouds' shadows the far ring's own program: it is drawn by
// FarRingRenderer.draw right after the far ring, in the same pass, under the same uniforms (render/farRing.js), the far
// ring holed for its footprint. Where the stream has built a pixel the ring skips it (the streamed ground stands there);
// a pixel the stream still owes - the grid's edge as the traveller goes, a teleport's whole grid - is the middle ring's,
// the kernel's own shape, so a pixel built lands on the hills already standing there instead of out of the far ring's
// 819 m facets.
//
// HOW IT IS ORDERED. The pass is the far ring's - at the far plane, depth tested and never written, so it shows only
// where the streamed world drew nothing (PERF2's law: the sky and the rings after the ground). Its own hills are put in
// front of one another by the PAINTER'S ORDER: a pixel's cells are written into the index buffer farthest pixel first
// (by the distance of its centre from the traveller's pixel), and inside a pixel farthest cell first along each axis, so
// a nearer hill is drawn over a farther one. The order is written again when the traveller's pixel changes; the pixels
// the stream has built are left out of the draw by RUNS - the ordered list cut where a built pixel stands - never by
// rewriting the buffer, so a pixel landing costs a walk of the list.
//
// THE COST. 54,289 vertices and 107,648 triangles in one buffer, drawn in a handful of runs inside the far ring's pass;
// its fragments only where nothing nearer stands. The heights are the worker's (about 100 ms a ring there, every
// MID_REBUILD_DRIFT pixels); this thread uploads the buffers (1.5 MB) and reads the tints (841 pixels).
// ═══════════════════════════════════════════════════════════════════

import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { MID_RADIUS, MID_SUB, MID_REBUILD_DRIFT, midRingSide, midRingNormals } from '../world/terrain/midRingGrid.js';
import {
  treesPerTile,
  landsTreesAt,
  canopyCover,
  expectedTrees,
  FLORA,
  FLORA_WOOD,
  FLORA_DIRT,
  FLORA_GRASS,
  FLORA_STONE,
} from '../world/terrain/floraCover.js'; // FAR-FLORA: the near law's woods
import { capShare, whiten } from '../world/peaks/snowcap.js'; // PEAKS1: the summits' snow

/** ?midring=off - the middle ring's kill door (the far ring stands as before), read once as the ring is made. */
export function midRingDisabled(search = globalThis.location?.search) {
  try {
    return /[?&]midring=off\b/.test(search ?? '');
  } catch {
    return false;
  }
}

/** How near a vertex must stand to the sea's floor to be the sea (world units) - the kernel's ocean clamp, through a float. */
export const MID_SEA_EPS = 0.01;

/** How many of the ring's vertex rows a step of its build lays (midRingVertexSteps) - the frame's share of a rebuild is
 *  a few such steps (render/farRing.js HORIZON_BUDGET_MS), never the whole 54,289 vertices in one frame; a step about a
 *  millisecond on a loaded machine. Its tints a row of pixel centres a step: a centre past the Bay the stream has not read
 *  is the continent's biome asked for the first time (some 40 microseconds). */
export const MID_ROWS_A_STEP = 12;

/** FAR-FLORA: the band (map pixels, Chebyshev from the base pixel's centre) over which the ring's woods ease from the
 *  forest field's own to the far ring's expectation (floraCover.js expectedTrees) - the geomorph's band (render/farRing.js
 *  MID_MORPH_START..MID_MORPH_END: MID_RADIUS - MID_REBUILD_DRIFT pixels, two wide), so where the far ring takes the ground
 *  over it takes the woods over too. */
export const MID_FLORA_EASE = Object.freeze([MID_RADIUS - MID_REBUILD_DRIFT - 2, MID_RADIUS - MID_REBUILD_DRIFT]);

/**
 * FAR-FLORA: A VERTEX'S WOODS - written into `canopy` at vertex `k` as four bytes: the canopy's cover (0-255: the share of
 * the ground its crowns hide, from the trees a tile grows there, `trees` - floraCover.js treesPerTile - and the climate's
 * art, render/farFlora.js treeArt `{ rgb, h, w }`) and its colour, the trees' art. The far ring's program lays it over
 * the ground's by the cover, lit as the flats are (horizonHaze.js floraLight) - FAR-TREES: but under the band, whose trees
 * stand there themselves. None without art. Answers the canopy's lift (world units). Pure.
 */
export function plantCanopy(canopy, k, trees, art) {
  const cover = art ? canopyCover(trees, art.w) : 0,
    o = k * 4;
  canopy[o] = Math.round(cover * 255);
  if (!(cover > 0)) return 0;
  for (let c = 0; c < 3; c++) canopy[o + 1 + c] = Math.round(art.rgb[c]);
  return cover * art.h * FLORA.lift;
}

/** FAR-FLORA: A VERTEX'S GROUND - the near ground's own tiles (render/farFlora.js groundArt: `{ dirt, grass, stone }` mean
 *  colours) mixed by the shares of its classes there (`rgb` written in place at `o`); left as it was where none grows
 *  (`dirt + grass + stone` 0: the sea, the beach line, a face) or no art is read. Pure. */
export function layGround(colors, o, ground, dirt, grass, stone) {
  const sum = dirt + grass + stone;
  if (!ground || !(sum > 0)) return;
  for (let c = 0; c < 3; c++)
    colors[o + c] = Math.round((ground.dirt[c] * dirt + ground.grass[c] * grass + ground.stone[c] * stone) / sum);
}

/** A pixel's climate flora with the far ring's expectation of its trees worked out once (floraCover.js expectedTrees). */
const withExpected = (f) => (f ? { ...f, expected: expectedTrees(f.spec, f.byte) } : false);
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A stepped build run whole: its generator's answer. */
export function runHorizonSteps(it) {
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/**
 * The ring's vertex data from the worker's heights: positions in the base pixel's corner frame (x east, z north - the
 * far ring's frame: render/farRing.js buildFarRingGrid), the heights' normals, each vertex's colour the bilinear of the
 * four pixel centres round it (`tintAt(px, py)` a pixel's [r, g, b], 0-255), the sea's byte where a vertex stands at
 * the sea's floor (`seaY`), and `coarse` - the far ring's surface under the vertex (`ringAt(px, py)` a pixel centre's
 * height on that ring, through its own triangles), the ground its rim eases onto. Whole (midRingVertices), or a step
 * of MID_ROWS_A_STEP rows at a time (midRingVertexSteps: the frame's share of a rebuild).
 * PEAKS1: `snowAt(px, py)` a pixel centre's cap line (m above the sea - render/farRing.js ringSnowAt), bilinear between the
 * centres as the tints are; a vertex over it whitened by its height and its normal (world/peaks/snowcap.js capShare).
 * FAR-FLORA: `flora` the worker's woods at each sample (world/terrain/floraCover.js midRingFloraPixel, packed) and
 * `floraAt(px, py)` the sample's pixel's climate flora ({ spec, art, byte } - render/farFlora.js floraOf, the WOODS byte):
 * a vertex's canopy (plantCanopy) coloured in the trees' art, raised to their height - its normals the canopy's - and its
 * cover answered (`flora`, 0-255, the shader's crowns); eased to the far ring's expectation over MID_FLORA_EASE.
 * @param {{ heights: Float32Array, baseX: number, baseY: number, radius?: number, sub?: number, tintAt: (px: number, py: number) => ArrayLike<number>, seaY: number, ringAt?: ?((px: number, py: number) => number), wet?: ?Uint8Array, snowAt?: ?((px: number, py: number) => number), flora?: ?Uint32Array, floraAt?: ?((px: number, py: number) => ?{ spec: any, art: any, byte: number }), cover?: ?Uint8Array }} o
 */
export const midRingVertices = (o) => runHorizonSteps(midRingVertexSteps(o));

/** midRingVertices a step of rows at a time - its answer the generator's own. @param {Parameters<typeof midRingVertices>[0]} o */
export function* midRingVertexSteps({
  heights,
  baseX,
  baseY,
  radius = MID_RADIUS,
  sub = MID_SUB,
  tintAt,
  seaY,
  ringAt = null,
  wet = null,
  snowAt = null,
  flora = null,
  floraAt = null,
  cover = null,
}) {
  const side = midRingSide(radius, sub),
    n = 2 * radius + 1,
    cell = TERRAIN_SIZE / sub;
  const positions = new Float32Array(side * side * 3);
  const coarse = new Float32Array(side * side); // the far ring's surface under each vertex (its ease's ground)
  // the far ring's pixel-centre heights, one row of padding round the footprint (ringAt: a pixel's height on that ring)
  const rw = n + 2,
    ring = new Float32Array(rw * rw);
  for (let tj = 0; tj < rw; tj++)
    for (let ti = 0; ti < rw; ti++)
      ring[tj * rw + ti] = ringAt ? ringAt(baseX - radius - 1 + ti, baseY + radius + 1 - tj) : 0;
  const colors = new Uint8Array(side * side * 3);
  const sea = new Uint8Array(side * side);
  // the pixel centres' tints, one row of padding round the footprint (a vertex at its rim reads past it)
  const tw = n + 2,
    tints = new Uint8Array(tw * tw * 3),
    caps = snowAt ? new Float32Array(tw * tw) : null;
  for (let tj = 0; tj < tw; tj++) {
    if (tj) yield;
    for (let ti = 0; ti < tw; ti++) {
      const t = tintAt(baseX - radius - 1 + ti, baseY + radius + 1 - tj),
        o = (tj * tw + ti) * 3;
      tints[o] = t[0];
      tints[o + 1] = t[1];
      tints[o + 2] = t[2];
      if (caps) caps[tj * tw + ti] = snowAt(baseX - radius - 1 + ti, baseY + radius + 1 - tj); // PEAKS1
    }
  }
  const capAt = caps ? new Float32Array(side * side) : null; // PEAKS1: each vertex's cap line, the centres' bilinear
  // FAR-FLORA: the canopy's cover a vertex (the shader's crowns), the ground under the canopy's lift (the normals' and the
  // positions' height), and each pixel's climate flora read once
  const woods = flora && floraAt ? new Uint8Array(side * side * 4) : null,
    lifted = woods ? new Float32Array(heights) : heights;
  const pixFlora = woods ? new Array(n * n) : null;
  const floraOfPixel = (pi, pj) =>
    (pixFlora[pj * n + pi] ??= withExpected(floraAt(baseX - radius + pi, baseY + radius - pj)));
  const rowsAStep = woods ? MID_ROWS_A_STEP / 2 : MID_ROWS_A_STEP; // the woods' rows twice the work: half as many a step
  for (let gz = 0; gz < side; gz++) {
    if (gz && gz % rowsAStep === 0) yield;
    // the pixel centres' lattice: centre k (0 the padding's) at gz = (k - 1) * sub + sub / 2
    const fz = (gz - sub / 2) / sub + 1,
      kz = Math.min(tw - 2, Math.max(0, Math.floor(fz))),
      wz = Math.min(1, Math.max(0, fz - kz));
    for (let gx = 0; gx < side; gx++) {
      const v = gz * side + gx,
        o = v * 3;
      positions[o] = (gx - radius * sub) * cell;
      positions[o + 1] = heights[v];
      positions[o + 2] = (gz - radius * sub) * cell;
      const fx = (gx - sub / 2) / sub + 1,
        kx = Math.min(tw - 2, Math.max(0, Math.floor(fx))),
        wx = Math.min(1, Math.max(0, fx - kx));
      const a = (kz * tw + kx) * 3,
        b = a + 3,
        c = a + tw * 3,
        d = c + 3;
      for (let k = 0; k < 3; k++) {
        colors[o + k] = Math.round(
          (tints[a + k] * (1 - wx) + tints[b + k] * wx) * (1 - wz) + (tints[c + k] * (1 - wx) + tints[d + k] * wx) * wz,
        );
      }
      if (capAt)
        capAt[v] =
          (caps[a / 3] * (1 - wx) + caps[b / 3] * wx) * (1 - wz) + (caps[c / 3] * (1 - wx) + caps[d / 3] * wx) * wz;
      // the far ring's own triangles over the four centres (render/farRing.js writeRingCells: i0 i2 i3 and i0 i3 i1, its
      // rows running south - here u east and v south from the north-west centre)
      if (ringAt) {
        const h00 = ring[(kz + 1) * rw + kx],
          h10 = ring[(kz + 1) * rw + kx + 1],
          h01 = ring[kz * rw + kx],
          h11 = ring[kz * rw + kx + 1];
        const u = wx,
          w = 1 - wz; // v south: the centre row kz is the south one
        coarse[v] = u >= w ? h00 + u * (h10 - h00) + w * (h11 - h10) : h00 + w * (h01 - h00) + u * (h11 - h01);
      } else coarse[v] = heights[v];
      if (Math.abs(heights[v] - seaY) < MID_SEA_EPS || (wet && wet[v]))
        sea[v] = 255; // MAP-WATERS: and stream G's rivers and lakes (the worker's flags)
      else if (woods) {
        // FAR-FLORA: the woods the near law grows here, in its climate's art
        const f = floraOfPixel(Math.min(n - 1, Math.floor(gx / sub)), Math.min(n - 1, Math.floor(gz / sub)));
        if (f) {
          const p = flora[v],
            dirt = ((p >>> FLORA_DIRT) & 255) / 255,
            grass = ((p >>> FLORA_GRASS) & 255) / 255,
            stone = ((p >>> FLORA_STONE) & 255) / 255;
          const ease = smooth01(
            (Math.max(Math.abs(positions[o] / TERRAIN_SIZE - 0.5), Math.abs(positions[o + 2] / TERRAIN_SIZE - 0.5)) -
              MID_FLORA_EASE[0]) /
              (MID_FLORA_EASE[1] - MID_FLORA_EASE[0]),
          );
          // TESA-LANDS (AUDIT): a zone's woods its own edge on the forest field's own value (floraCover.js midRingCoverPixel)
          const near =
            cover && f.spec.lands
              ? landsTreesAt(f.spec, f.spec.lands.woodAt(cover[v]), dirt, grass, stone)
              : treesPerTile(((p >>> FLORA_WOOD) & 255) / 255, dirt, grass, stone, f.spec, f.byte); // TESA-LANDS: `cover` the forest field's own value (floraCover.js midRingCoverPixel), a zone's woods its own edge
          const trees = near * (1 - ease) + f.expected * ease;
          const g = FLORA.ground; // the ground's shares eased toward the near law's mean as the woods are
          layGround(
            colors,
            o,
            f.ground,
            dirt + (g[1] - dirt) * ease,
            grass + (g[2] - grass) * ease,
            stone + (g[3] - stone) * ease,
          );
          lifted[v] = heights[v] + plantCanopy(woods, v, trees, f.art);
          positions[o + 1] = lifted[v];
        }
      }
    }
  }
  const normals = new Float32Array(side * side * 3);
  for (let z0 = 0; z0 < side; z0 += MID_ROWS_A_STEP) {
    yield;
    midRingNormals(lifted, side, sub, normals, z0, Math.min(side, z0 + MID_ROWS_A_STEP)); // FAR-FLORA: the canopy's own
    if (capAt) {
      for (let v = z0 * side; v < Math.min(side, z0 + MID_ROWS_A_STEP) * side; v++) {
        if (sea[v]) continue;
        const share = capShare(heights[v] - seaY, normals[v * 3 + 1], capAt[v]);
        whiten(colors, v * 3, share); // PEAKS1
        if (woods?.[v * 4]) whiten(woods, v * 4 + 1, share); // FAR-FLORA: the canopy under the same snow (whiten is a mix: the mix of the two whitened is the mix whitened)
      }
    }
  }
  return { positions, normals, colors, sea, coarse, side, flora: woods };
}

/**
 * THE PAINTER'S ORDER (the header): the footprint's pixels farthest first from the traveller's pixel (`curX`, `curY`), each
 * its sub x sub cells farthest first along each axis, written as triangles in the far ring's winding. Answers the
 * indices and, for each pixel in the order, its key and where its cells start - the runs' list.
 * @returns {{ indices: Uint16Array | Uint32Array, order: Array<{ px: number, py: number, key: string, at: number, d: number }> }}
 */
export function midRingOrder({ baseX, baseY, curX, curY, radius = MID_RADIUS, sub = MID_SUB }) {
  const n = 2 * radius + 1,
    side = midRingSide(radius, sub);
  const pixels = [];
  for (let pj = 0; pj < n; pj++)
    for (let pi = 0; pi < n; pi++) {
      const px = baseX - radius + pi,
        py = baseY + radius - pj;
      pixels.push({ px, py, pi, pj, d: Math.hypot(px - curX, py - curY) });
    }
  pixels.sort((a, b) => b.d - a.d || a.pj - b.pj || a.pi - b.pi);
  const Idx = side * side <= 65536 ? Uint16Array : Uint32Array;
  const indices = new Idx(n * n * sub * sub * 6);
  const order = [];
  const tpl = cellTemplates(side, sub),
    per = sub * sub * 6;
  let o = 0;
  for (const p of pixels) {
    order.push({ px: p.px, py: p.py, key: `${p.px},${p.py}`, at: o, d: p.d }); // FAR-LANDMARK: its distance, a landmark's cut
    // east of the traveller the east cells are the farther, west of them the west; north (pj up, py down) likewise -
    // a pixel's cells written off the template of its quarter, offsets from its south-west vertex
    const t = tpl[(p.px > curX ? 1 : 0) + (p.py < curY ? 2 : 0)],
      first = p.pj * sub * side + p.pi * sub;
    for (let k = 0; k < per; k++) indices[o + k] = first + t[k];
    o += per;
  }
  return { indices, order };
}

/** A pixel's sub x sub cells as index offsets from its south-west vertex, in the far ring's winding - four orders, by
 *  the quarter the traveller sees it from (bit 0: east of them, the east cells first; bit 1: north, the north first).
 *  Kept a ring shape at a time. */
const _templates = new Map();
function cellTemplates(side, sub) {
  const key = `${side},${sub}`;
  let out = _templates.get(key);
  if (out) return out;
  out = [0, 1, 2, 3].map((q) => {
    const t = new Int32Array(sub * sub * 6);
    let o = 0;
    for (let jj = 0; jj < sub; jj++) {
      const j = q & 2 ? sub - 1 - jj : jj;
      for (let ii = 0; ii < sub; ii++) {
        const i = q & 1 ? sub - 1 - ii : ii;
        const i0 = j * side + i,
          i1 = i0 + 1,
          i2 = i0 + side,
          i3 = i2 + 1;
        t[o++] = i0;
        t[o++] = i2;
        t[o++] = i3;
        t[o++] = i0;
        t[o++] = i3;
        t[o++] = i1;
      }
    }
    return t;
  });
  _templates.set(key, out);
  return out;
}

/** The draw's runs over the order: [first index, count] for each stretch of pixels `solid(key)` does not stand - a built
 *  pixel cuts a run. */
export function midRingRuns(order, total, solid) {
  const runs = [];
  let start = -1;
  for (let k = 0; k < order.length; k++) {
    const p = order[k];
    if (solid(p.key)) {
      if (start >= 0) {
        runs.push([start, p.at - start]);
        start = -1;
      }
      continue;
    }
    if (start < 0) start = p.at;
  }
  if (start >= 0) runs.push([start, total - start]);
  return runs;
}

/** HORIZON-TREES: the heights of a ring's vertex positions (x, y, z a vertex), a vertex in turn - the ground the ring draws,
 *  handed to the far trees' skyline (render/farTrees.js). Pure. @param {Float32Array} positions */
export function groundHeights(positions) {
  const out = new Float32Array(positions.length / 3);
  for (let v = 0; v < out.length; v++) out[v] = positions[v * 3 + 1];
  return out;
}

/**
 * The middle ring's GL side: the vertex arrays, the ordered index buffer and the runs, drawn by the far ring's program
 * (FarRingRenderer.draw hands its gl and its uOrigin). Owns every buffer it makes (`dispose`).
 */
export class MidRingMesh {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.vao = null;
    this.buffers = [];
    this.indexBuffer = null;
    this.baseX = 0;
    this.baseY = 0;
    this.radius = MID_RADIUS;
    this.sub = MID_SUB;
    this.order = [];
    this.total = 0;
    this.indexType = 0;
    this.runs = [];
    this._orderKey = '';
    this._runsKey = '';
  }

  get built() {
    return !!this.vao;
  }

  /** The vertex arrays (midRingVertices') round `baseX`, `baseY` uploaded, the order written for the traveller's pixel. */
  build(v, { baseX, baseY, radius = MID_RADIUS, sub = MID_SUB, curX, curY }) {
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
    buf(v.coarse, 4, gl.FLOAT, false, 1); // the far ring's surface under it (render/farRing.js VS: the ease)
    if (v.flora) buf(v.flora, 5, gl.UNSIGNED_BYTE, true, 4); // FAR-FLORA: the canopy's cover and colour (the program lays it); off, its constant (0, 0, 0, 1): none
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.buffers.push(this.indexBuffer);
    gl.bindVertexArray(null);
    this.vao = vao;
    Object.assign(this, { baseX, baseY, radius, sub });
    this.heights = groundHeights(v.positions); // HORIZON-TREES: the drawn ground, for the band's skyline (render/farTrees.js)
    this._orderKey = '';
    this.reorder(curX, curY);
  }

  /** The painter's order written again for the traveller's pixel - only when it moved. */
  reorder(curX, curY) {
    const key = `${curX},${curY}`;
    if (!this.vao || key === this._orderKey) return;
    const gl = this.gl;
    const { indices, order } = midRingOrder({
      baseX: this.baseX,
      baseY: this.baseY,
      curX,
      curY,
      radius: this.radius,
      sub: this.sub,
    });
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.order = order;
    this.total = indices.length;
    this.indexType = indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    this._orderKey = key;
    this._runsKey = '';
  }

  /** The runs past the pixels `solid` stands (a built pixel's key) - asked again when `stamp` (the built set's change count)
   *  or the order moved. */
  cut(solid, stamp) {
    const key = `${this._orderKey}|${stamp}`;
    if (key === this._runsKey) return;
    this.runs = midRingRuns(this.order, this.total, solid);
    this._runsKey = key;
  }

  /** Drawn inside the far ring's pass: its program bound, its uniforms set; `uOrigin` the pass's origin uniform and
   *  `origin` this ring's base in the scene. */
  draw(uOrigin, origin) {
    if (!this.vao || !this.runs.length) return;
    const gl = this.gl,
      bytes = this.indexType === gl.UNSIGNED_SHORT ? 2 : 4;
    gl.uniform3f(uOrigin, origin[0], origin[1], origin[2]);
    gl.bindVertexArray(this.vao);
    for (const [first, count] of this.runs) gl.drawElements(gl.TRIANGLES, count, this.indexType, first * bytes);
    gl.bindVertexArray(null);
  }

  /** FAR-LANDMARK: the runs that fall in indices [a, b) - the ring drawn in two parts round a landmark between them. */
  drawRange(uOrigin, origin, a, b) {
    if (!this.vao || b <= a) return;
    const gl = this.gl,
      bytes = this.indexType === gl.UNSIGNED_SHORT ? 2 : 4;
    gl.uniform3f(uOrigin, origin[0], origin[1], origin[2]);
    gl.bindVertexArray(this.vao);
    for (const [first, count] of this.runs) {
      const s = Math.max(first, a),
        e = Math.min(first + count, b);
      if (e > s) gl.drawElements(gl.TRIANGLES, e - s, this.indexType, s * bytes);
    }
    gl.bindVertexArray(null);
  }

  /** Every buffer this ring made (EVERY ALLOCATION HAS AN OWNER). */
  dispose() {
    const gl = this.gl;
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    this.indexBuffer = null;
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vao = null;
    this.order = [];
    this.runs = [];
    this.total = 0;
  }
}

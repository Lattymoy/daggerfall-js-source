// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-LANDMARK (2026-10-26, the coordinator for stream A's Imperial City at some 20 km: "Build the city-skyline hook ...
// so stream A can hand in the Imperial City's silhouette"; bible/06-Systems/Travel-View.md FAR-LANDMARK): A LANDMARK ON
// THE HORIZON - a low-poly silhouette (a city's walls and towers) handed to the far ring and drawn in its pass, by its
// program, under its light and its haze, where the stream has not built the landmark's pixel.
//
// HOW IT IS ORDERED. The far pass stands at the far plane (depth tested against the world's, never written: render/
// farRing.js), so its layers are put in front of one another by the PAINTER'S ORDER - the far field, the far ring's cells
// and the middle ring's pixels each written farthest first from the traveller. A landmark takes its place in that order
// by its distance: the cells and pixels farther than it are drawn before it, the nearer after it, so a nearer hill stands
// over the city and the city over the ranges behind it. Its own triangles are written farthest first from the traveller
// too (their centres, again each pixel the traveller crosses), so a tower behind a wall is drawn before the wall.
//
// WHY NOT A DEPTH SUB-RANGE. The world's own lens writes depths up to its far plane, and a fragment near that plane stands
// within a few 24-bit steps of 1.0: any range [r, 1] the far pass took for depths of its own would sort a far hill in
// front of the world's distant ground there, and the world's framebuffers carry no stencil to mask it. The painter's
// order is the far pass's law already (the middle ring's and the far field's), and holds for a landmark at the cost of a
// sort of its triangles.
// ═══════════════════════════════════════════════════════════════════

import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';

/** A landmark's distance from the traveller, map pixels: its pixel's centre from theirs (the middle ring's own measure). */
export const landmarkDistance = (px, py, curX, curY) => Math.hypot(px - curX, py - curY);

/** A mesh's vertex normals where none is handed: each triangle's face normal (area-weighted) summed at its corners. */
export function landmarkNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3,
      b = indices[t + 1] * 3,
      c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a],
      uy = positions[b + 1] - positions[a + 1],
      uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a],
      vy = positions[c + 1] - positions[a + 1],
      vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k] += nx;
      n[k + 1] += ny;
      n[k + 2] += nz;
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
    n[k] /= l;
    n[k + 1] /= l;
    n[k + 2] /= l;
    if (n[k + 1] < 0) {
      n[k] = -n[k];
      n[k + 1] = -n[k + 1];
      n[k + 2] = -n[k + 2];
    } // the sun's side up: winding is no law here
  }
  return n;
}

/** A landmark's grey where no colours are handed (0-255). */
export const LANDMARK_GREY = Object.freeze([178, 172, 160]);

/**
 * One landmark's GL side. `mesh.positions` in pixel (px, py)'s own frame - x east and z north from its south-west corner
 * (map pixel units of TERRAIN_SIZE), y up in the world's own heights (the streamed ground's: terrainSurface.js) - with
 * `mesh.indices` (triangles; sequential when absent), `mesh.normals` (made when absent) and `mesh.colors` (rgb 0-255 a
 * vertex; LANDMARK_GREY when absent).
 */
export class FarLandmark {
  /** @param {WebGL2RenderingContext} gl @param {{ px: number, py: number, mesh: { positions: Float32Array, indices?: ?(Uint16Array | Uint32Array), normals?: ?Float32Array, colors?: ?Uint8Array }, key?: string }} o */
  constructor(gl, { px, py, mesh, key = `${px},${py}` }) {
    this.gl = gl;
    this.px = px;
    this.py = py;
    this.key = key;
    const count = mesh.positions.length / 3;
    const Idx = count <= 65536 ? Uint16Array : Uint32Array;
    const tris = new Idx(mesh.indices ? mesh.indices.length : count);
    for (let i = 0; i < tris.length; i++) tris[i] = mesh.indices ? mesh.indices[i] : i; // sequential triangles where none are handed
    this.tris = tris;
    this.positions = mesh.positions;
    const normals = mesh.normals ?? landmarkNormals(mesh.positions, this.tris);
    const colors = mesh.colors ?? Uint8Array.from({ length: count * 3 }, (_, i) => LANDMARK_GREY[i % 3]);
    this.order = new Idx(this.tris.length);
    this.indexType = Idx === Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    this._orderKey = '';
    this.buffers = [];
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
    buf(mesh.positions, 0, gl.FLOAT, false);
    buf(normals, 1, gl.FLOAT, false);
    buf(colors, 2, gl.UNSIGNED_BYTE, true);
    // locations 3 (the sea) and 4 (the middle ring's ease) stay off: their constant 0 - the land, never eased
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.buffers.push(this.indexBuffer);
    gl.bindVertexArray(null);
    this.vao = vao;
  }

  /** Its triangles written farthest first from the traveller's pixel (curX, curY) - only when that pixel moved. */
  reorder(curX, curY) {
    const key = `${curX},${curY}`;
    if (!this.vao || key === this._orderKey) return;
    const S = TERRAIN_SIZE,
      p = this.positions,
      t = this.tris,
      n = t.length / 3;
    const tx = (curX - this.px + 0.5) * S,
      tz = (this.py - curY + 0.5) * S; // the traveller in this pixel's frame (z north)
    const keyed = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      let cx = 0,
        cz = 0;
      for (let c = 0; c < 3; c++) {
        const v = t[3 * k + c] * 3;
        cx += p[v];
        cz += p[v + 2];
      }
      const dx = cx / 3 - tx,
        dz = cz / 3 - tz;
      keyed[k] = -Math.round(Math.hypot(dx, dz)) * 1048576 + k; // ascending: the farthest first (metres), then the mesh's own order
    }
    keyed.sort();
    for (let k = 0; k < n; k++) {
      const s = ((keyed[k] % 1048576) + 1048576) % 1048576;
      this.order[3 * k] = t[3 * s];
      this.order[3 * k + 1] = t[3 * s + 1];
      this.order[3 * k + 2] = t[3 * s + 2];
    }
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.order, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this._orderKey = key;
  }

  /** Drawn inside the far pass at `origin` (the scene point of its pixel's south-west corner) through `uOrigin`. */
  draw(uOrigin, origin) {
    if (!this.vao) return;
    const gl = this.gl;
    gl.uniform3f(uOrigin, origin[0], origin[1], origin[2]);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.order.length, this.indexType, 0);
    gl.bindVertexArray(null);
  }

  /** Every buffer it made (EVERY ALLOCATION HAS AN OWNER). */
  dispose() {
    const gl = this.gl;
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vao = null;
  }
}

/** A box of `w` x `d` metres (x east, z north) standing `h` over ground `y` at (x, z) of its pixel - a tower, a wall's run:
 *  the parts a silhouette is built of, and the pins' landmark. Ten triangles (its floor left open). */
export function landmarkBox({ x, z, w, d, y, h, color = LANDMARK_GREY }) {
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2,
    y1 = y + h;
  const positions = Float32Array.from([
    x0,
    y,
    z0,
    x1,
    y,
    z0,
    x1,
    y,
    z1,
    x0,
    y,
    z1,
    x0,
    y1,
    z0,
    x1,
    y1,
    z0,
    x1,
    y1,
    z1,
    x0,
    y1,
    z1,
  ]);
  const indices = Uint16Array.from([
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7,
  ]);
  const colors = Uint8Array.from({ length: 24 }, (_, i) => color[i % 3]);
  return { positions, indices, colors };
}

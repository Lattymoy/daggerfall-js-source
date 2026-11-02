// @ts-check
// LPT1 (bible/07-Rendering/Low-Poly-Trees.md): THE LOW-POLY TREES' BUFFERS - every mesh of the mod in one vertex buffer
// and one index buffer (uploaded once, ~2 MB), and the frame's instances in a third. The billboard program draws them in
// its mesh mode (render/renderer.js BB_VS, `_drawLowPolyTrees`), so this module owns buffers and a vertex array, never
// a program: a tree is lit, fogged and shadowed by the very shader that lights the flats, under either lane.
//
// THE LAYOUT, the billboard program's: location 0 the vertex (BB_VS aCenter), 1 its uv (aCorner), 2 its normal (aNormal)
// - the vendored f32 x 8 a vertex as it stands (tools/lowPolyTreesExtract.mjs packMeshes); 3 and 4 the instance, a
// divisor each: [x, y, z, yaw] (aInst) and its scale (aScale) - LPT_INSTANCE_FLOATS a tree (world/lowPolyTrees.js's).
import { LPT_INSTANCE_FLOATS } from '../world/lowPolyTrees.js';

export class LowPolyTreesGpu {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {{vertexBytes:number, meshes:{vertex:number,vertices:number,index:number,subs:number[][]}[]}} index trees.json's
   * @param {Uint8Array} bin trees.bin
   */
  constructor(gl, index, bin) {
    this.gl = gl;
    const vertexFloats = index.vertexBytes / 4;
    const verts = new Float32Array(
      bin.buffer.slice(bin.byteOffset, bin.byteOffset + index.vertexBytes),
      0,
      vertexFloats,
    );
    // the indices made whole-buffer (WebGL2 has no base vertex): each mesh's u16 run plus its first vertex, as u32
    let total = 0;
    for (const m of index.meshes) for (const [, n] of m.subs) total += n;
    const u16 = new Uint16Array(
      bin.buffer.slice(bin.byteOffset + index.vertexBytes, bin.byteOffset + index.vertexBytes + total * 2),
    );
    const idx = new Uint32Array(total);
    /** each mesh's submeshes as [byte offset into the index buffer, count] */
    this.subs = index.meshes.map((m) =>
      m.subs.map(([at, n]) => {
        const start = m.index + at;
        for (let k = 0; k < n; k++) idx[start + k] = u16[start + k] + m.vertex;
        return [start * 4, n];
      }),
    );
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 24);
    this.ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.instanceBuffer = gl.createBuffer();
    this.instanceCapacity = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribDivisor(4, 1);
    this.pointInstances(0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** The frame's instances (the visible ones), `count` of them, packed LPT_INSTANCE_FLOATS a tree; the buffer grows by
   *  doubling. */
  setInstances(data, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const need = count * LPT_INSTANCE_FLOATS;
    if (need > this.instanceCapacity) {
      this.instanceCapacity = Math.max(need, this.instanceCapacity * 2, 1024 * LPT_INSTANCE_FLOATS);
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceCapacity * 4, gl.DYNAMIC_DRAW);
    }
    if (need) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, need);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** The instance attributes pointed at instance `first` - a run's start (the vertex array must be bound). */
  pointInstances(first) {
    const gl = this.gl,
      stride = LPT_INSTANCE_FLOATS * 4,
      at = first * stride;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, at);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, at + 16);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    for (const b of [this.vb, this.ib, this.instanceBuffer]) gl.deleteBuffer(b);
    this.vao = null;
  }
}

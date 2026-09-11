// PERF4 - STATIC BATCHES PER PIXEL (2026-09-11, Mac: "look for
// opportunities"). A streamed pixel draws every one of its RMB models
// with its own drawMesh - one draw call per sub-mesh, a city block's
// fifty to a hundred models each in three to six pieces, a city pixel
// of up to sixty-four blocks - and a WebGL draw call is tens of
// microseconds of validation whatever it draws. The models never move
// (a block's 3D objects are placed once; the gates that swap meshes
// and the mills whose rotors turn stay out of the batch), so their
// geometry is merged ONCE at build time into one vertex array per
// pixel, grouped by resolved texture, and the pixel draws that with
// one call per texture. Same triangles, same textures, same lighting
// (the fragment shader lights by world position and normal, both of
// which the merge carries), the pixel matrix the one model matrix.
//
// Pure: no GL here. The builder takes each model's CPU mesh and its
// pixel-local matrix, transforms the vertices as they arrive (spread
// across the build's own awaits), and `finish()` regroups the index
// ranges by texture into the shape `renderer.createMesh` takes.

/** The rotation part of a TRS matrix applied to a normal. The block
 *  matrices are rotations and translations (rmbLayout's trs, scale 1),
 *  so the upper 3x3 is orthonormal and the result is renormalised
 *  only against float drift. */
function rotateNormal(m, x, y, z, out, o) {
  const nx = m[0] * x + m[4] * y + m[8] * z;
  const ny = m[1] * x + m[5] * y + m[9] * z;
  const nz = m[2] * x + m[6] * y + m[10] * z;
  const l = Math.hypot(nx, ny, nz) || 1;
  out[o] = nx / l; out[o + 1] = ny / l; out[o + 2] = nz / l;
}

export class StaticBatchBuilder {
  constructor() {
    this.chunks = [];        // [{positions, normals, uvs, base}] one per model, already transformed
    this.groups = new Map(); // resolved key -> [Uint32Array index runs, already offset by base]
    this.vertexCount = 0;
    this.triangles = 0;
    this.models = 0;
  }

  /**
   * One model into the batch.
   * @param {{positions:Float32Array, normals:Float32Array, uvs:Float32Array, indices:Uint32Array, subMeshes:Array}} cpu
   * @param {Float32Array} local the model's pixel-local matrix
   * @param {(archive:number, record:number) => string} resolveKey the pixel's texture remap, as drawMesh applies it
   */
  add(cpu, local, resolveKey) {
    const n = cpu.positions.length / 3;
    if (!n || !cpu.subMeshes?.length) return;
    const base = this.vertexCount;
    const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = cpu.positions[i * 3], y = cpu.positions[i * 3 + 1], z = cpu.positions[i * 3 + 2];
      positions[i * 3] = local[0] * x + local[4] * y + local[8] * z + local[12];
      positions[i * 3 + 1] = local[1] * x + local[5] * y + local[9] * z + local[13];
      positions[i * 3 + 2] = local[2] * x + local[6] * y + local[10] * z + local[14];
      rotateNormal(local, cpu.normals[i * 3], cpu.normals[i * 3 + 1], cpu.normals[i * 3 + 2], normals, i * 3);
    }
    this.chunks.push({ positions, normals, uvs: cpu.uvs });
    for (const sm of cpu.subMeshes) {
      const count = sm.primitiveCount * 3;
      if (!count) continue;
      const run = new Uint32Array(count);
      for (let i = 0; i < count; i++) run[i] = cpu.indices[sm.startIndex + i] + base;
      const key = resolveKey(sm.textureArchive, sm.textureRecord);
      let g = this.groups.get(key);
      if (!g) { g = []; this.groups.set(key, g); }
      g.push(run);
      this.triangles += sm.primitiveCount;
    }
    this.vertexCount += n;
    this.models++;
  }

  /** The merged mesh in createMesh's shape, or null when nothing was added. */
  finish() {
    if (!this.vertexCount || !this.triangles) return null;
    const positions = new Float32Array(this.vertexCount * 3);
    const normals = new Float32Array(this.vertexCount * 3);
    const uvs = new Float32Array(this.vertexCount * 2);
    let v = 0;
    for (const c of this.chunks) {
      positions.set(c.positions, v * 3); normals.set(c.normals, v * 3); uvs.set(c.uvs, v * 2);
      v += c.positions.length / 3;
    }
    const indices = new Uint32Array(this.triangles * 3);
    const subMeshes = [];
    let at = 0;
    for (const [key, runs] of this.groups) {
      const start = at;
      for (const run of runs) { indices.set(run, at); at += run.length; }
      const [archive, record] = key.split('_').map(Number);   // the resolved key is `${archive}_${record}`, drawMesh's own spelling
      subMeshes.push({ textureArchive: archive, textureRecord: record, startIndex: start, primitiveCount: (at - start) / 3 });
    }
    return { positions, normals, uvs, indices, subMeshes, vertexCount: this.vertexCount, triangles: this.triangles, models: this.models };
  }
}

/** drawMesh's key resolution, as a function of a pixel's remap map. */
export const keyResolver = (texRemap) => (archive, record) => {
  const key = `${archive}_${record}`;
  return texRemap && texRemap.has(key) ? texRemap.get(key) : key;
};

// @ts-check
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

import { boundsOf, boundsSteps } from './bounds.js';   // PERF-EXT23: the spheres createMesh takes, measured in the merge's own slices - a leaf, no GL

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

/** The determinant of a column-major matrix's upper 3x3. */
function det3(m) {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
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
   * @param {?Float32Array} [normalMatrix] WOD2: the matrix the NORMALS take when `local` scales
   *   non-uniformly - its upper 3x3 the inverse transpose of local's (World of Daggerfall stands
   *   952 models scaled unevenly, most of them rocks, which Unity lights through the inverse transpose). Absent,
   *   the normals take `local` itself, exact for every rotation-and-translation block model.
   */
  add(cpu, local, resolveKey, normalMatrix = null) {
    const nm = normalMatrix ?? local;
    const n = cpu.positions.length / 3;
    if (!n || !cpu.subMeshes?.length) return;
    // WOD5: a MIRRORED model - a negative determinant, World of
    // Daggerfall's one wall at scaleX -1.57 - turns every triangle's
    // winding over, and the renderer culls by winding. Unity reverses the
    // culling of a transform whose scale is negative, so the merge
    // reverses the winding: each triangle's last two corners swap.
    const mirrored = det3(local) < 0;
    const base = this.vertexCount;
    const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = cpu.positions[i * 3], y = cpu.positions[i * 3 + 1], z = cpu.positions[i * 3 + 2];
      positions[i * 3] = local[0] * x + local[4] * y + local[8] * z + local[12];
      positions[i * 3 + 1] = local[1] * x + local[5] * y + local[9] * z + local[13];
      positions[i * 3 + 2] = local[2] * x + local[6] * y + local[10] * z + local[14];
      rotateNormal(nm, cpu.normals[i * 3], cpu.normals[i * 3 + 1], cpu.normals[i * 3 + 2], normals, i * 3);
    }
    this.chunks.push({ positions, normals, uvs: cpu.uvs });
    for (const sm of cpu.subMeshes) {
      const count = sm.primitiveCount * 3;
      if (!count) continue;
      const run = new Uint32Array(count);
      for (let i = 0; i < count; i++) run[i] = cpu.indices[sm.startIndex + i] + base;
      if (mirrored) for (let i = 0; i + 2 < count; i += 3) { const t = run[i + 1]; run[i + 1] = run[i + 2]; run[i + 2] = t; }
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
    const it = this._merge(false);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /**
   * PERF-EXT23 (2026-09-25, the players: "fps issues in the exterior but
   * fine in the interior", "me too my friend.. don't know why. I got a
   * RX6600"): THE MERGE, A UNIT AT A TIME. A streamed pixel's build breathes
   * between its models (PERF7), and then ran its whole tail in one piece:
   * this merge, and createMesh's bounds - the whole mesh's sphere and one
   * per texture group, two passes over every vertex each. A synthetic city
   * pixel (3,000 models, 600k vertices, 160 groups) put 45-60 ms of that on
   * ONE frame; a town 6-26 ms. The same merge awaits `breathe()` after each
   * model's copy, each range of the sphere's two passes (bounds.js
   * boundsSteps) and each group's copy and sphere, so no unit is over ~0.6
   * ms, and it hands the spheres over (`bounds`) so createMesh does not
   * walk the vertices again. The arrays and every sphere are the bytes
   * finish() and createMesh make. The interior and the dungeon merge once,
   * at their first frame, and keep finish().
   * @param {() => Promise<void>} breathe the build's breather
   */
  async finishSliced(breathe) {
    const it = this._merge(true);
    for (let r = it.next(); ; r = it.next()) {
      if (r.done) return r.value;
      await breathe();
    }
  }

  /** PERF4's merge, once: a generator that yields between units (PERF-EXT23) - finish() runs it straight
   *  through, finishSliced() a breath at a time. With `withBounds` it also measures the spheres createMesh
   *  would (boundsOf's own passes) and returns them as `bounds: { whole, subs }`. */
  *_merge(withBounds) {
    if (!this.vertexCount || !this.triangles) return null;
    const positions = new Float32Array(this.vertexCount * 3);
    const normals = new Float32Array(this.vertexCount * 3);
    const uvs = new Float32Array(this.vertexCount * 2);
    let v = 0;
    for (const c of this.chunks) {
      positions.set(c.positions, v * 3); normals.set(c.normals, v * 3); uvs.set(c.uvs, v * 2);
      v += c.positions.length / 3;
      yield;
    }
    const whole = withBounds ? yield* boundsSteps(positions) : null;
    const indices = new Uint32Array(this.triangles * 3);
    yield;   // the index array's allocation is a unit of its own (3.6 MB on a synthetic city)
    const subMeshes = [];
    const subs = [];
    let at = 0;
    for (const [key, runs] of this.groups) {
      const start = at;
      for (const run of runs) { indices.set(run, at); at += run.length; }
      const [archive, record] = key.split('_').map(Number);   // the resolved key is `${archive}_${record}`, drawMesh's own spelling
      subMeshes.push({ textureArchive: archive, textureRecord: record, startIndex: start, primitiveCount: (at - start) / 3 });
      if (withBounds) { subs.push(boundsOf(positions, indices, start, at - start)); yield; }
    }
    const merged = /** @type {any} */ ({ positions, normals, uvs, indices, subMeshes, vertexCount: this.vertexCount, triangles: this.triangles, models: this.models });
    if (withBounds) merged.bounds = { whole, subs };
    return merged;
  }
}

/** drawMesh's key resolution, as a function of a pixel's remap map. */
export const keyResolver = (texRemap) => (archive, record) => {
  const key = `${archive}_${record}`;
  return texRemap && texRemap.has(key) ? texRemap.get(key) : key;
};

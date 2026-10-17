// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-2 (2026-10-14) - A POI AS THE RENDERER DRAWS IT: PURE.
//
// The POI editor's document (poi/poiLaw.js) and meshes (poi/poiMesh.js) as the game stands them (bible/06-Systems/
// POI-Editor-Arc.md). Everything here is arithmetic over arrays - no GL, no DOM - so the host (scenes/poiHost.js) and
// the tests read a POI the same way:
//
//   - THE LOOK OF A MATERIAL (`materialLook`): what the texture it is drawn with depends on - its picture, its tint, its
//     alpha (opaque, a cutout at its cutoff, or blended), its sampler, its emission. Two materials that look alike share
//     one texture; the book (`createTextureBook`) gives each look its record in POI_TEXTURE_ARCHIVE.
//   - THE PICTURES BAKED (`bakeAlbedo`, `bakeEmission`): the renderer's mesh shader has no tint and cuts at a half
//     (render/realWindows.js RW_MAIN_CUTOUT), so the tint is multiplied in and a cutout's alpha thresholded at ITS cutoff
//     to all or nothing - exactly the cut the material asks for; a blend keeps its alpha times the tint's. The emission
//     map is the emissive picture times its colour (a colour alone, a plain map), clamped to one - the game draws in
//     low dynamic range. Both turned to the port's color32 order (row 0 the bottom: formats/color32Order.js).
//   - THE MODELS (`poiPartModels`): a part's mesh as `createMesh` takes it - UVs through the material's transform
//     (KHR_texture_transform's order) and turned to the renderer's convention (glTF's v down from the top; the uploaded
//     picture's row 0 its bottom: v' = 1 - v), a two-sided material's faces doubled back with their normals turned, and
//     the blended submeshes apart in a model of their own (drawn translucent, after the opaque world, back to front).
//   - THE MATRICES (`placeMatrix`, `partMatrix`): in the pixel's own frame - metres east (x) and north (z) of its
//     south-west corner, up (y) from the frame's zero - so a floating-origin recentre moves only the pixel's
//     translation, never a POI's matrix.
//
// AUDIT POI R8: THE HEAVY HALVES ARE STEPS. A 4096-texel picture's bake is 209 ms and a mesh at the law's vertex limit,
// two-sided, 458 ms - too long for one task of a playing game. `bakeAlbedoSteps`, `bakeEmissionSteps` and
// `poiPartModelSteps` are generators that yield every POI_STEP_UNITS texels or faces (render/retroPass.js
// retroLutSteps' way), so the host (scenes/poiHost.js) runs them a time slice a frame; `bakeAlbedo`, `bakeEmission` and
// `poiPartModels` drive them whole (`runSteps`) for a caller that wants the answer now.
// ═══════════════════════════════════════════════════════════════════

import { applyTextureTransform } from './gltfImport.js';
import { multiply } from '../world/mat4.js';   // the port's one column-major product (a fresh matrix each call here)
import { mat4FromQuatPosScale } from '../world/quat.js';   // Unity's T * R(q) * S - outside the relay's bundle (test/net/relayversion.test.js)

/** The texture archive every POI picture is uploaded under - one record a look (render/meshAlpha.js keys the sampler
 *  apart). Numeric, so world art's mip chain is its own; clear of every archive the port draws (the classic 0-511 and
 *  its own 38001-38990, 56790, 112358-112395, 900000 - test/world/superDungeon/sd26_render.test.js ONE ARCHIVE, ONE OWNER). */
export const POI_TEXTURE_ARCHIVE = 600000;

const r255 = (v) => Math.round(Math.min(Math.max(Number(v) || 0, 0), 1) * 255);

/** AUDIT POI R8: the texels (or faces) a step does before it yields - a millisecond's work or so. */
export const POI_STEP_UNITS = 65_536;

/** A step generator driven to its end, synchronously - its return value. Every yield it makes is a bare one (a step's
 *  end); the host's own runner (scenes/poiHost.js) is the one that waits on a promise. @param {Iterator<any>} it */
function runSteps(it) {
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** A material's sampler as the renderer reads it (render/meshAlpha.js samplerParams). @param {any} m */
export const samplerOf = (m) => ({ wrapS: m.wrap?.[0] ?? 'repeat', wrapT: m.wrap?.[1] ?? 'repeat', filter: m.filter ?? 'linear' });

/**
 * The look of a material - a stable string of everything its drawn texture depends on, and nothing else (its UV
 * transform and two-sidedness are the mesh's, not the picture's). @param {any} m
 */
export function materialLook(m) {
  return JSON.stringify([
    m.texture ?? null, (m.color ?? [1, 1, 1, 1]).map(r255), m.alpha ?? 'opaque',
    m.alpha === 'cutout' ? r255(m.cutoff ?? 0.5) : null, samplerOf(m), m.emissive ?? null,
    (m.emissiveColor ?? [0, 0, 0]).map((c) => r255(Math.min(c, 1))),
  ]);
}

/** Does this material draw anything of its own light? @param {any} m */
export const emits = (m) => !!m.emissive || (m.emissiveColor ?? [0, 0, 0]).some((c) => c > 0);

/** A book of looks: the record each look's texture is uploaded under, the same record for the same look for the
 *  session's life. `recordOf(look)` and `size()`. */
export function createTextureBook() {
  const records = new Map();
  return {
    recordOf(/** @type {string} */ look) { if (!records.has(look)) records.set(look, records.size); return records.get(look); },
    size: () => records.size,
  };
}

/**
 * The albedo a material draws with, in color32 order - `{ width, height, colors }`. `image` the decoded picture (an RGBA
 * raster TOP row first, as a browser decodes one), or null for a material with no picture (a plain colour, one texel).
 * AUDIT POI R9: a cut-out or blended picture's CLEAR texels (alpha nought, as drawn) take their colour from the nearest
 * texels that are not (`bleedClearSteps`) - a linear filter and the mip chain average a texel's colour whatever its
 * alpha, so a clear texel's own colour (black, where a 2D canvas decoded it: poi/poiImageDecode.js) is a dark fringe
 * round every edge. What is drawn is unchanged: those texels stay clear.
 * @param {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null} image @param {any} m
 */
export const bakeAlbedo = (image, m) => runSteps(bakeAlbedoSteps(image, m));

/** bakeAlbedo's steps (AUDIT POI R8): a yield every POI_STEP_UNITS texels; returns the albedo.
 * @param {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null} image @param {any} m */
export function* bakeAlbedoSteps(image, m) {
  const [cr, cg, cb, ca] = (m.color ?? [1, 1, 1, 1]).map((c) => Math.min(Math.max(c, 0), 1));
  const w = image?.width ?? 1, h = image?.height ?? 1;
  const src = image?.data ?? new Uint8Array([255, 255, 255, 255]);
  if (src.length !== w * h * 4) throw new Error(`poi albedo: ${w}x${h} carries ${src.length} bytes`);
  const out = new Uint8Array(w * h * 4);
  const cut = m.alpha === 'cutout' ? Math.min(Math.max(m.cutoff ?? 0.5, 0), 1) : null;
  let work = 0;
  for (let y = 0; y < h; y++) {
    const from = y * w * 4, to = (h - 1 - y) * w * 4;   // color32: row 0 the picture's bottom
    for (let x = 0; x < w * 4; x += 4) {
      const i = from + x, o = to + x;
      out[o] = Math.round(src[i] * cr);
      out[o + 1] = Math.round(src[i + 1] * cg);
      out[o + 2] = Math.round(src[i + 2] * cb);
      const a = (src[i + 3] / 255) * ca;
      // a cutout's own cut, made all or nothing so the renderer's cut at a half is the same cut; an opaque picture opaque
      out[o + 3] = m.alpha === 'blend' ? Math.round(a * 255) : cut !== null ? (a >= cut ? 255 : 0) : 255;
    }
    if ((work += w) >= POI_STEP_UNITS) { work = 0; yield null; }
  }
  if (m.alpha === 'blend' || cut !== null) yield* bleedClearSteps(out, w, h);
  return { width: w, height: h, colors: out };
}

/**
 * AUDIT POI R9: EVERY CLEAR TEXEL COLOURED FROM ITS NEAREST - a breadth-first walk out from the texels that are not clear,
 * a ring at a time: each texel of a ring takes the mean of its eight neighbours already coloured (one that is not clear
 * weighed by its alpha, one of an earlier ring whole), so the colour runs out from every edge and a far texel
 * of a mip's footprint carries its nearest edge's. Alphas untouched. In place over RGBA `c` (`w` x `h`); a picture with
 * no clear texel, or nothing but, is left as it is. Yields every POI_STEP_UNITS texels.
 * @param {Uint8Array} c @param {number} w @param {number} h
 */
export function* bleedClearSteps(c, w, h) {
  const n = w * h;
  const state = new Uint8Array(n);   // 0 clear, 1 in a ring still to colour, 2 coloured
  let solid = 0, work = 0;
  for (let i = 0; i < n; i++) if (c[i * 4 + 3] > 0) { state[i] = 2; solid++; }
  if (solid === 0 || solid === n) return;
  const ring = new Int32Array(n - solid);
  let end = 0;
  // the first ring: every clear texel beside one that is not
  for (let i = 0; i < n; i++) {
    if (state[i] !== 0) continue;
    const x = i % w, y = (i - x) / w;
    near: for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w && state[yy * w + xx] === 2) { state[i] = 1; ring[end++] = i; break near; }
      }
    }
    if (++work >= POI_STEP_UNITS) { work = 0; yield null; }
  }
  for (let start = 0; start < end;) {
    const stop = end;
    for (let q = start; q < stop; q++) {
      const i = ring[q], x = i % w, y = (i - x) / w;
      let r = 0, g = 0, b = 0, wt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (state[j] === 2) {
            const k = c[j * 4 + 3] || 255;   // a texel of an earlier ring is clear, and counts whole
            r += c[j * 4] * k; g += c[j * 4 + 1] * k; b += c[j * 4 + 2] * k; wt += k;
          } else if (state[j] === 0) { state[j] = 1; ring[end++] = j; }   // the next ring
        }
      }
      c[i * 4] = Math.round(r / wt); c[i * 4 + 1] = Math.round(g / wt); c[i * 4 + 2] = Math.round(b / wt);
      if (++work >= POI_STEP_UNITS) { work = 0; yield null; }
    }
    for (let q = start; q < stop; q++) state[ring[q]] = 2;   // the ring coloured: the next reads it
    start = stop;
  }
}

/**
 * The emission map a material draws with, in color32 order - its emissive picture times its emissive colour, or that
 * colour alone; each channel clamped to one (the game's light is low dynamic range). Null for a material that emits
 * nothing. Sized as `size` (its albedo's), so both are sampled alike.
 * @param {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null} image @param {any} m
 * @param {{ width: number, height: number }} size
 */
export const bakeEmission = (image, m, size) => runSteps(bakeEmissionSteps(image, m, size));

/** bakeEmission's steps (AUDIT POI R8): a yield every POI_STEP_UNITS texels; returns the map, or null.
 * @param {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null} image @param {any} m
 * @param {{ width: number, height: number }} size */
export function* bakeEmissionSteps(image, m, size) {
  if (!emits(m)) return null;
  const [er, eg, eb] = (m.emissiveColor ?? [0, 0, 0]).map((c) => Math.min(Math.max(c, 0), 1));
  const w = image?.width ?? size.width, h = image?.height ?? size.height;
  const out = new Uint8Array(w * h * 4);
  let work = 0;
  for (let y = 0; y < h; y++) {
    const from = y * w * 4, to = (h - 1 - y) * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      const i = from + x, o = to + x;
      out[o] = Math.round((image ? image.data[i] : 255) * er);
      out[o + 1] = Math.round((image ? image.data[i + 1] : 255) * eg);
      out[o + 2] = Math.round((image ? image.data[i + 2] : 255) * eb);
      out[o + 3] = 255;
    }
    if ((work += w) >= POI_STEP_UNITS) { work = 0; yield null; }
  }
  return { width: w, height: h, colors: out };
}

/**
 * A part's mesh as the renderer takes it: `{ opaque, translucent }`, each a createMesh model (or null) - the opaque and
 * cutout submeshes in one, the blended in the other - every submesh's texture the record its material's look was given.
 * `mirrored`: the part's matrix turns the mesh inside out (a negative determinant - a negative scale on one axis or
 * three), so every face is wound back to face the eye as drawn (the static batch's WOD5 law; drawMesh winds nothing).
 *
 * AUDIT POI R5: `scale`, the part's own per-axis size (poiLaw: 0.001-1000 each), is BAKED IN - positions times it,
 * normals through its inverse and made unit again - and the part is drawn through its turn and the place's one size
 * alone (scenes/poiHost.js), because the mesh shader lights `mat3(uModel) * aNormal`: through a stretch that tilts every
 * slanted face's normal (a 45-degree roof stretched four times along x lit N.L 0.243 by an overhead sun, not 0.970). A
 * negative scale's mirror is the baked scale's too (R6): `mirrored` follows its sign unless it is given.
 *
 * AUDIT POI R14: a two-sided BLENDED submesh lays its back faces down first - drawn in index order with no depth written,
 * the far inner faces then lie under the near outer ones, not over them.
 * @param {import('./poiMesh.js').PoiMesh} mesh @param {any[]} materials one a submesh @param {(m: any) => number} recordOf
 * @param {{ mirrored?: boolean, scale?: number[] | null }} [opts]
 */
export const poiPartModels = (mesh, materials, recordOf, opts = {}) => runSteps(poiPartModelSteps(mesh, materials, recordOf, opts));

/** poiPartModels' steps (AUDIT POI R8): a yield every POI_STEP_UNITS faces; returns `{ opaque, translucent }`.
 * @param {import('./poiMesh.js').PoiMesh} mesh @param {any[]} materials @param {(m: any) => number} recordOf
 * @param {{ mirrored?: boolean, scale?: number[] | null }} [opts] */
export function* poiPartModelSteps(mesh, materials, recordOf, { scale = null, mirrored = !!scale && scale[0] * scale[1] * scale[2] < 0 } = {}) {
  const groups = { opaque: [], translucent: [] };
  mesh.submeshes.forEach((sm, i) => {
    const m = materials[i];
    (m?.alpha === 'blend' ? groups.translucent : groups.opaque).push(i);
  });
  const [sx, sy, sz] = scale ?? [1, 1, 1];
  const scaled = sx !== 1 || sy !== 1 || sz !== 1;
  const V = mesh.positions.length / 3;
  // a vertex's new number in this submesh, front (v) and back (V + v), stamped with the submesh it was made for
  const stamp = new Int32Array(V * 2).fill(-1), slot = new Int32Array(V * 2);
  let gen = 0, work = 0;
  function* build(list) {
    if (!list.length) return null;
    let maxV = 0, maxI = 0;
    for (const i of list) { const k = materials[i].twoSided ? 2 : 1; maxI += mesh.submeshes[i].count * k; maxV += Math.min(V, mesh.submeshes[i].count) * k; }
    const positions = new Float32Array(maxV * 3), normals = new Float32Array(maxV * 3), uvs = new Float32Array(maxV * 2), indices = new Uint32Array(maxI);
    const subMeshes = [];
    let nv = 0, ni = 0;
    for (const i of list) {
      const sm = mesh.submeshes[i];
      const m = materials[i];
      const tt = m.uv && (m.uv.rotation || m.uv.offset[0] || m.uv.offset[1] || m.uv.scale[0] !== 1 || m.uv.scale[1] !== 1) ? m.uv : null;
      // the submesh's own vertices, renumbered from nought - a vertex two submeshes share is copied to each
      const own = gen++;
      const start = ni;
      const vert = (v, flip) => {
        const key = flip ? V + v : v;
        if (stamp[key] === own) return slot[key];
        const at = nv++;
        positions[at * 3] = mesh.positions[v * 3] * sx; positions[at * 3 + 1] = mesh.positions[v * 3 + 1] * sy; positions[at * 3 + 2] = mesh.positions[v * 3 + 2] * sz;
        let nx = mesh.normals[v * 3], ny = mesh.normals[v * 3 + 1], nz = mesh.normals[v * 3 + 2];
        if (scaled) { nx /= sx; ny /= sy; nz /= sz; const l = Math.hypot(nx, ny, nz); if (l > 0) { nx /= l; ny /= l; nz /= l; } }   // AUDIT POI R5: the inverse transpose of a scale is its inverse
        const s = flip ? -1 : 1;
        normals[at * 3] = s * nx + 0; normals[at * 3 + 1] = s * ny + 0; normals[at * 3 + 2] = s * nz + 0;
        let u = mesh.uvs[v * 2], w = mesh.uvs[v * 2 + 1];
        if (tt) [u, w] = applyTextureTransform(tt, u, w);
        uvs[at * 2] = u; uvs[at * 2 + 1] = 1 - w;   // glTF's v (down from the top) to the renderer's (up from row 0, the picture's bottom)
        stamp[key] = own; slot[key] = at;
        return at;
      };
      // the front faces as stored (wound back where the part mirrors them), then - two-sided - every face again the other
      // way, on its own vertices with their normals turned (world/shipyardModel.js's way); a blended one's back faces first
      const sides = !m.twoSided ? 1 : 2, backFirst = m.twoSided && m.alpha === 'blend';
      for (let side = 0; side < sides; side++) {
        const back = side === 0 ? backFirst : !backFirst;
        for (let k = sm.start; k < sm.start + sm.count; k += 3) {
          const a = mesh.indices[k], b = mesh.indices[k + 1], c = mesh.indices[k + 2];
          if (back !== mirrored) { indices[ni] = vert(a, back); indices[ni + 1] = vert(c, back); indices[ni + 2] = vert(b, back); }
          else { indices[ni] = vert(a, back); indices[ni + 1] = vert(b, back); indices[ni + 2] = vert(c, back); }
          ni += 3;
          if (++work >= POI_STEP_UNITS) { work = 0; yield null; }
        }
      }
      subMeshes.push({ textureArchive: POI_TEXTURE_ARCHIVE, textureRecord: recordOf(m), startIndex: start, primitiveCount: (ni - start) / 3 });
    }
    return { positions: positions.slice(0, nv * 3), normals: normals.slice(0, nv * 3), uvs: uvs.slice(0, nv * 2), indices: indices.slice(0, ni), subMeshes };
  }
  const opaque = yield* build(groups.opaque);
  const translucent = yield* build(groups.translucent);
  return { opaque, translucent };
}

// ── MATRICES (column-major Float32Array(16), the renderer's) ─────────

/** The determinant of a column-major matrix's upper 3x3 - negative where it mirrors. */
export const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
/** A point through a matrix. */
export const xform = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

/**
 * The place's matrix in its pixel's frame - its spot (`x` east, `z` north from the pixel's south-west corner) at height
 * `y` (the ground's under it plus the document's `y` for 'snap', the document's own for 'absolute'), its turn and size.
 * @param {any} place the document's `place` @param {number} y the height it stands at, resolved by the host
 */
export const placeMatrix = (place, y) => mat4FromQuatPosScale(place.r, [place.x, y, place.z], [place.s, place.s, place.s]);

/** A part's matrix in its pixel's frame: the place's, then the part's own. @param {Float32Array} place @param {any} part */
export const partMatrix = (place, part) => multiply(place, mat4FromQuatPosScale(part.r, part.t, part.s));

/** The box a mesh's bounds make through a matrix - `{ min, max }`, its eight corners' bounds. */
export function boxThrough(m, min, max) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const p = xform(m, [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  }
  return { min: lo, max: hi };
}

/** The document's lights in the pixel's frame: `{ at, range, color, intensity, flicker }` each - a light's spot through
 *  the place's matrix, its range scaled with the place. @param {any} doc @param {Float32Array} place */
export const lightsOf = (doc, place) => (doc.lights ?? []).map((l) => ({
  at: xform(place, l.t), range: l.radius * doc.place.s, color: l.color.map((c) => c * l.intensity), intensity: l.intensity, flicker: l.flicker,
}));

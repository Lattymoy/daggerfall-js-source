// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 4):
// THE WRECK ON THIS SCREEN - a band's wreck (world/eliteGates/egVista.js) made into two meshes and their draws, every one noShadow:
//   THE WINGS, BATCHED - every wing of the band in one mesh, a sub-mesh a record (the far stone, the foundations, the
//     band's crystal or its forges' flame, its metal - at most four), so the band's wreck is four draws however many wings
//     drift. The pieces' own law (scenes/eliteGates/egPieceBatch.js): the world's program has no instance attribute, so each wing is
//     written on the CPU through renderer.updateMeshVertices, in the world's own light. The mesh stands in the hall's
//     frame about its centre - a frame moves it to the hall the eye stands in by its matrix alone - and each wing is re-laid
//     there turned about its own axis on the shared clock (its lean, then its turn: Ry(spin t) Rx(tilt) - the same turn on
//     every screen), EG_WRECK_TURN_HZ times a second of that clock: a turn of minutes moves a wing's far edge well under
//     a pixel between two lays, and the buffers go up a dozen times a second, never every frame. The phones' wings never
//     turn: laid once. About a Court hall each wing stands at its `court` place (out of the lord's sky - world/eliteGates/egVista.js
//     EG_VISTA_PLACES): laid again when the eye's hall changes kind (the pull, under the veil).
//   THE UNDERSIDE - its own mesh (its two records), hung from the eye (`under.at`) at its scale: at a sky's distance that
//     no step of the eye moves against the sky, inside the far plane from wherever it stands.
// Made once a band (scenes/eliteGates/egGroundLook.js), freed with the band (another band's stand, the breach's end); a frame makes
// nothing.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { buildEgVista } from '../../world/eliteGates/egVista.js';

/** How many times a second of the shared clock the turning wings are re-laid. */
export const EG_WRECK_TURN_HZ = 12;

/**
 * THE WINGS BATCHED (pure): every wing's model (`{ model, at, spin, tilt }` - world/eliteGates/egVista.js) in one model, a sub-mesh
 * a record (lowest first, its archive the wings'), each corner its own vertex; `src` each vertex where its wing's own
 * model has it (position, normal), `owner` its wing, `wings` their places (a trial's and a Court's) and turns, `turns`
 * whether any turns, `court` which places it is laid at. Laid at the clock's 0 about a trial (egWreckLay).
 * @param {Array<{ model: any, at: number[], court?: number[], spin: number, tilt: number }>} wings
 */
export function egWreckBatch(wings) {
  const recs = [...new Set(wings.flatMap((w) => w.model.subMeshes.map((s) => s.textureRecord)))].sort((a, b) => a - b);
  let n = 0;
  for (const w of wings) for (const s of w.model.subMeshes) n += s.primitiveCount * 3;
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2), indices = new Uint32Array(n);
  const src = new Float32Array(n * 6), owner = new Uint16Array(n), subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const start = v;
    let archive = 0;
    wings.forEach((w, wi) => {
      const m = w.model;
      for (const s of m.subMeshes) {
        if (s.textureRecord !== rec) continue;
        archive = s.textureArchive;
        for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i++, v++) {
          const j = m.indices[i];
          for (let k = 0; k < 3; k++) { src[v * 6 + k] = m.positions[j * 3 + k]; src[v * 6 + 3 + k] = m.normals[j * 3 + k]; }
          uvs[v * 2] = m.uvs[j * 2]; uvs[v * 2 + 1] = m.uvs[j * 2 + 1];
          owner[v] = wi; indices[v] = v;
        }
      }
    });
    subMeshes.push({ textureArchive: archive, textureRecord: rec, startIndex: start, primitiveCount: (v - start) / 3 });
  }
  const batch = {
    model: { positions, normals, uvs, indices, subMeshes }, src, owner, mats: new Float32Array(wings.length * 12),
    wings: wings.map((w) => ({ at: [w.at[0], w.at[1], w.at[2]], court: [...(w.court ?? w.at)], spin: w.spin || 0, tilt: w.tilt || 0 })), turns: wings.some((w) => (w.spin || 0) !== 0), court: false,
  };
  egWreckLay(batch, 0, false);
  return batch;
}

/**
 * THE WINGS LAID at clock `t` (s) into the batch's own positions and normals (the hall's frame about its centre): each
 * wing leaned by its tilt about x, turned by spin t about y and stood at its place - its Court's when `court`. Makes
 * nothing.
 * @param {ReturnType<typeof egWreckBatch>} B @param {number} t @param {boolean} [court]
 */
export function egWreckLay(B, t, court = false) {
  const M = B.mats, W = B.wings;
  B.court = court;
  for (let w = 0; w < W.length; w++) {
    const r = W[w].spin * t, cy = Math.cos(r), sy = Math.sin(r), cx = Math.cos(W[w].tilt), sx = Math.sin(W[w].tilt), o = w * 12, at = court ? W[w].court : W[w].at;
    // R = Ry(r) Rx(tilt), its rows; then the place
    M[o] = cy; M[o + 1] = sy * sx; M[o + 2] = sy * cx;
    M[o + 3] = 0; M[o + 4] = cx; M[o + 5] = -sx;
    M[o + 6] = -sy; M[o + 7] = cy * sx; M[o + 8] = cy * cx;
    M[o + 9] = at[0]; M[o + 10] = at[1]; M[o + 11] = at[2];
  }
  const S = B.src, P = B.model.positions, N = B.model.normals, own = B.owner;
  for (let v = 0; v < own.length; v++) {
    const o = own[v] * 12, i = v * 6, j = v * 3, x = S[i], y = S[i + 1], z = S[i + 2], nx = S[i + 3], ny = S[i + 4], nz = S[i + 5];
    P[j] = M[o] * x + M[o + 1] * y + M[o + 2] * z + M[o + 9];
    P[j + 1] = M[o + 3] * x + M[o + 4] * y + M[o + 5] * z + M[o + 10];
    P[j + 2] = M[o + 6] * x + M[o + 7] * y + M[o + 8] * z + M[o + 11];
    N[j] = M[o] * nx + M[o + 1] * ny + M[o + 2] * nz;
    N[j + 1] = M[o + 3] * nx + M[o + 4] * ny + M[o + 5] * nz;
    N[j + 2] = M[o + 6] * nx + M[o + 7] * ny + M[o + 8] * nz;
  }
}

/** A matrix written in place: a move, and a scale `s` (column-major). */
function moveTo(M, x, y, z, s = 1) {
  M.fill(0);
  M[0] = s; M[5] = s; M[10] = s; M[12] = x; M[13] = y; M[14] = z; M[15] = 1;
  return M;
}

/**
 * @param {{ renderer?: any, lite?: boolean }} [deps]
 */
export function createEgWreckLook({ renderer = null, lite = false } = {}) {
  /** @type {null | { band: number, batch: any, wings: any, under: any, tick: number, tris: number }} */
  let held = null;
  const make = (model) => {
    if (!model || !renderer?.createMesh) return null;
    try { return renderer.createMesh(model); } catch (e) { console.warn('[eg] the wreck would not build', e?.message ?? e); return null; }
  };
  const free = (gpu) => { if (gpu) { try { renderer?.destroyMesh?.(gpu); } catch { /* gone */ } } };
  const drawOf = (gpu) => (gpu ? { gpu, object: { matrix: moveTo(new Float32Array(16), 0, 0, 0) }, noShadow: true, hidden: false } : null);
  const api = {
    lite,
    /** Band `band`'s wreck held - `built` the swap's worker's (world/eliteGates/egVista.js buildEgVista's), else made here; nothing
     *  done when it is held already. Answers whether a new one was made. */
    stand(band, built = null) {
      if (held?.band === band) return false;
      api.release();
      let v = built && built.band === band ? built : null;
      if (!v) { try { v = buildEgVista(band, { lite }); } catch (e) { console.warn('[eg] the wreck would not build', e?.message ?? e); v = null; } }
      const batch = v?.wings?.length ? egWreckBatch(v.wings) : null, gpu = batch ? make(batch.model) : null;
      const ug = v?.under ? make(v.under.model) : null;
      held = {
        band, tick: 0,
        batch, wings: gpu ? { gpu, draw: drawOf(gpu) } : null,
        under: ug ? { gpu: ug, draw: drawOf(ug), at: v.under.at, scale: v.under.scale ?? 1, recs: v.under.model.subMeshes.length } : null,
        tris: (batch ? batch.owner.length / 3 : 0) + (v?.under ? v.under.model.indices.length / 3 : 0),
      };
      return true;
    },
    /** Its draws (the wings', then the underside's). */
    draws() { return [held?.wings?.draw, held?.under?.draw].filter(Boolean); },
    /** A frame: the wings moved to the eye's hall's centre (cx, cy, cz - the dungeon's frame) and laid again when they
     *  turn (at the shared clock `seconds`, EG_WRECK_TURN_HZ a second of it) or the hall is of the other kind (`court`: a
     *  Court hall's places); the underside hung from `eye`. Makes nothing. */
    frame(eye, cx, cy, cz, seconds = 0, court = false) {
      if (!held) return;
      const W = held.wings, B = held.batch, U = held.under;
      if (W) {
        moveTo(W.draw.object.matrix, cx, cy, cz);
        const tick = B.turns && Number.isFinite(seconds) ? Math.floor(seconds * EG_WRECK_TURN_HZ) : 0;
        if (tick !== held.tick || !!court !== B.court) {
          held.tick = tick;
          egWreckLay(B, tick / EG_WRECK_TURN_HZ, !!court);
          try { renderer?.updateMeshVertices?.(W.gpu, B.model.positions, B.model.normals); } catch (e) { console.warn('[eg] the wreck would not turn', e?.message ?? e); }
        }
      }
      if (U && eye) moveTo(U.draw.object.matrix, eye[0] + U.at[0], eye[1] + U.at[1], eye[2] + U.at[2], U.scale);
    },
    /** The band let go: its meshes freed (the draws' slots emptied first). */
    release() {
      const h = held;
      held = null;
      free(h?.wings?.gpu); free(h?.under?.gpu);
    },
    /** What it holds (tests, stats): its band, its wings, its draws (a sub-mesh a record), its triangles, whether it turns. */
    stats: () => ({
      band: held?.band ?? -1, wings: held?.batch?.wings.length ?? 0, under: !!held?.under,
      draws: (held?.wings ? held.batch.model.subMeshes.length : 0) + (held?.under?.recs ?? 0), tris: held?.tris ?? 0, turns: !!held?.batch?.turns,
    }),
  };
  return api;
}

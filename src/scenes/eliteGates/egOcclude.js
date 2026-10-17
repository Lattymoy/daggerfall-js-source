// @ts-check
// EG-ZN (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.8, "The camera in
// rock"): OCCLUDERS BETWEEN THE CAMERA AND THE BODY DITHER OUT - the circle's rock a camera ray to my body crosses drawn
// through the renderer's ordered dither (render/renderer.js setDissolve - SHIP-FADE's: bayer4's 4x4 threshold over the
// screen, a fragment kept where it stands under the share), every other piece of the circle drawn whole.
//
// WHAT AN OCCLUDER IS. The circle is one mesh and one upload (world/eliteGates/egHall.js buildEgCircleModel), and stays one: its rock
// is marked as it is laid (`model.occluders` - a passage's wall runs and vault, each box of its kit's dress, a niche's walls
// and lid, a vignette, a ring wall's segment, an arch's walls, a door's posts and lintel, a slag spout), each piece a few
// runs of the mesh's own indices. The cameras' casts meet only the collider's proxy (the drawn rock's inner envelope), so
// the dress is what most often stands between; the walls and vaults are marked too, for the eye a cast never reached.
//
// THE RAY. Each frame in third person, a segment from the eye to the body's pivot (the lane's focal) and to its chest
// (EG_OCCLUDE_CHEST_M over the feet), each stopped EG_OCCLUDE_BODY_M short of the body, is tried against every piece's box
// and then its own triangles: a piece it crosses dithers out to EG_OCCLUDE_KEEP over EG_OCCLUDE_FADE_S, and back the same
// way once the ray is clear. A witness's eye, first person and every frame outside the Spire try nothing.
//
// THE DRAW, AND THE BUDGET. While nothing stands between, the circle's draw is the loop's own, untouched: the GL draws are
// the mesh's sub-meshes, as before. While pieces dither, this pass takes the circle's draw for the frame (`hidden` - the
// loop skips it): it records the WHOLE mesh's shadow, as the loop would have (the lanterns' caches see the record they
// always saw), draws the rest of the mesh as a view of its own buffers with the pieces' runs cut out (render/renderer.js
// meshView), and each share's pieces as one view at that share - their adjacent runs drawn as one. Nothing is uploaded;
// only the cut sub-meshes cost a draw more. Measured in test/world/eliteGates/egz_camera.test.js.
//
// EVERY ALLOCATION HAS AN OWNER: the views share the circle mesh's buffers and own none; `clear()` drops them (and the
// mesh) before the mesh is freed - the swap's and the stand's slot emptied first - and a dead mesh is never drawn through.
//
// Not a DFU member. Ledger A (ELITE-GATES).

/** The share of an occluder's fragments kept while it stands between the camera and the body (4 of bayer4's 16). */
export const EG_OCCLUDE_KEEP = 0.25;
/** How long an occluder takes to dither out to its keep, and back (s). */
export const EG_OCCLUDE_FADE_S = 0.2;
/** How far short of the body's point the ray stops (m) - the ground it stands on and the wall it leans on are no occluders. */
export const EG_OCCLUDE_BODY_M = 0.3;
/** The body's second point over its feet (m): its chest. The first is the camera's own pivot (its focal). */
export const EG_OCCLUDE_CHEST_M = 0.9;
/** The most views kept for one circle before the cache is let go (a view is a few small objects - no GL object). */
export const EG_OCCLUDE_VIEWS_MAX = 64;
const NO_SHADOW = Object.freeze({ noShadow: true });
/** AUDIT EG III (lane4 #10): the ray's unit way, one scratch for every segment tried (egOccludersHit is synchronous). */
const _dir = [0, 0, 0];

/**
 * Whether the segment from `o` along the unit `d` for `len` crosses triangle `k` of `T` (nine floats a triangle - its three
 * corners), from either face. Moller-Trumbore. Pure.
 * @param {number[]} o @param {number[]} d @param {number} len @param {Float32Array} T @param {number} k
 */
export function egSegTri(o, d, len, T, k) {
  const i = k * 9;
  const e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2];
  const e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return false;   // the segment runs along the triangle's plane
  const inv = 1 / det, sx = o[0] - T[i], sy = o[1] - T[i + 1], sz = o[2] - T[i + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 && t < len;
}
/** Whether the segment from `o` along unit `d` for `len` meets box `b` ([x0, y0, z0, x1, y1, z1]) - the slab test. Pure. */
export function egSegBox(o, d, len, b) {
  let t0 = 0, t1 = len;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < b[a] || o[a] > b[a + 3]) return false; continue; }
    let ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  return true;
}
/**
 * The occluders a camera ray crosses: the indices of `pieces` (each `{ b, at, n }` - its box, and its `n` triangles from
 * triangle `at` of `T`) that a segment from `eye` to any of `points` - stopped EG_OCCLUDE_BODY_M short of it - crosses,
 * in the pieces' order, each once. Pure. AUDIT EG III (lane4 #10): `out` and `seen` the caller's own to fill (emptied and
 * cleared here - a frame's pass hands its scratch, never a new list a frame); none, and they are made.
 * @param {Array<{ b: number[], at: number, n: number }>} pieces @param {Float32Array} T @param {number[]} eye @param {number[][]} points
 * @param {number[]} [out] @param {Uint8Array|null} [seen]
 */
export function egOccludersHit(pieces, T, eye, points, out = [], seen = null) {
  out.length = 0;
  if (!eye || !points?.length) return out;
  if (!seen || seen.length < pieces.length) seen = new Uint8Array(pieces.length); else seen.fill(0, 0, pieces.length);
  const d = _dir;
  for (const p of points) {
    if (!p) continue;
    const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2], full = Math.hypot(dx, dy, dz), len = full - EG_OCCLUDE_BODY_M;
    if (!(len > 0)) continue;
    d[0] = dx / full; d[1] = dy / full; d[2] = dz / full;
    for (let i = 0; i < pieces.length; i++) {
      if (seen[i]) continue;
      const q = pieces[i];
      if (!egSegBox(eye, d, len, q.b)) continue;
      for (let k = q.at; k < q.at + q.n; k++) if (egSegTri(eye, d, len, T, k)) { seen[i] = 1; break; }
    }
  }
  for (let i = 0; i < pieces.length; i++) if (seen[i]) out.push(i);
  return out;
}
/** An occluder's share kept after `dt` (s): toward EG_OCCLUDE_KEEP while the ray crosses it (`hit`), toward whole when it
 *  does not, at (1 - keep) every EG_OCCLUDE_FADE_S. Pure. */
export function egOccludeEase(k, hit, dt) {
  const step = ((1 - EG_OCCLUDE_KEEP) * Math.max(0, Number(dt) || 0)) / EG_OCCLUDE_FADE_S;
  return hit ? Math.max(EG_OCCLUDE_KEEP, k - step) : Math.min(1, k + step);
}
/**
 * The runs of `ids`' pieces (`pieces[i].r` - `[subMesh, startIndex, primitiveCount]`), merged where one ends where the next
 * begins, as sub-meshes of `subs` (the model's, for their archive and record). `cut` true: every sub-mesh's runs OUTSIDE
 * them instead - the rest of the mesh. Pure.
 * @param {any[]} subs @param {Array<{ r: number[][] }>} pieces @param {number[]} ids @param {boolean} cut
 */
export function egOccludeRanges(subs, pieces, ids, cut) {
  const by = subs.map(() => /** @type {number[][]} */ ([]));
  for (const i of ids) for (const [s, at, n] of pieces[i].r) by[s].push([at, n * 3]);
  const out = [];
  const put = (s, at, len) => { if (len > 0) out.push({ textureArchive: subs[s].textureArchive, textureRecord: subs[s].textureRecord, startIndex: at, primitiveCount: len / 3 }); };
  for (let s = 0; s < subs.length; s++) {
    const runs = by[s].sort((a, b) => a[0] - b[0]), merged = [];
    for (const [at, len] of runs) { const m = merged[merged.length - 1]; if (m && m[0] + m[1] === at) m[1] += len; else merged.push([at, len]); }
    if (!cut) { for (const [at, len] of merged) put(s, at, len); continue; }
    let from = subs[s].startIndex;
    const end = from + subs[s].primitiveCount * 3;
    for (const [at, len] of merged) { put(s, from, at - from); from = at + len; }
    put(s, from, end - from);
  }
  return out;
}

/**
 * The circle's occluders on this screen. EG-LOOK (Elite-Gates-Look.md section 3, THE RUIN): `shadow` false for a mesh drawn
 * `noShadow` (the ruin's - scenes/eliteGates/egGroundLook.js): its dithering frame records no shadow for it, as the loop would not.
 * @param {{ renderer?: any, shadow?: boolean }} deps
 */
export function createEgOccluders({ renderer = null, shadow = true } = {}) {
  /** @type {any} */
  let mesh = null, subs = /** @type {any[]} */ ([]), draw = null, hid = false, lastDraws = 0;
  /** @type {Array<{ b: number[], at: number, n: number, r: number[][] }>} */
  let pieces = [];
  let T = new Float32Array(0);
  /** each dithering piece's share kept (1 whole) */
  const share = new Map();
  /** AUDIT EG III (lane4 #10): the frame's scratch - the pieces the ray crosses (and as a set), the seen marks, the draw's
   *  dithering pieces - kept, never made a frame */
  const _hits = [], _hitSet = new Set(), _act = [];
  let _seen = new Uint8Array(0);
  const views = new Map();
  const viewOf = (key, ids, cut) => {
    let v = views.get(key);
    if (v === undefined) {
      if (views.size >= EG_OCCLUDE_VIEWS_MAX) views.clear();
      v = renderer?.meshView?.(mesh, egOccludeRanges(subs, pieces, ids, cut)) ?? null;
      views.set(key, v);
    }
    return v;
  };
  const unhide = () => { if (draw && hid) draw.hidden = false; hid = false; };
  return {
    /** The circle stood: its mesh (the renderer's) and the model it was made from (its sub-meshes and `occluders`). Only
     *  the occluders' own triangles are kept, for the ray. */
    set(gpu, model) {
      unhide();
      mesh = gpu ?? null; subs = model?.subMeshes ?? []; share.clear(); views.clear();
      const occ = model?.occluders ?? [], P = model?.positions, I = model?.indices;
      let n = 0;
      for (const o of occ) for (const r of o.r) n += r[2];
      T = new Float32Array(P && I ? n * 9 : 0);
      pieces = [];
      let at = 0;
      if (P && I) for (const o of occ) {
        const first = at;
        for (const [, s, c] of o.r) for (let j = s; j < s + c * 3; j++) { const v = I[j] * 3; T[at * 3] = P[v]; T[at * 3 + 1] = P[v + 1]; T[at * 3 + 2] = P[v + 2]; at++; }
        pieces.push({ b: o.b, at: first / 3, n: (at - first) / 3, r: o.r });
      }
      return pieces.length;
    },
    /** The circle's draw in this context's list (a stand's, a swap's): the one this pass hides while pieces dither. */
    stand(d) { unhide(); draw = d ?? null; share.clear(); },
    /** Gone: the mesh, the views and the shares let go (before the mesh is freed - the slot emptied first). */
    clear() { unhide(); mesh = null; subs = []; pieces = []; T = new Float32Array(0); draw = null; lastDraws = 0; share.clear(); views.clear(); },
    /**
     * This frame's ray (`eye` and the body's `points`; none - first person, a witness - tries nothing) and every piece's
     * share eased by `dt`. Answers how many pieces dither.
     * @param {{ eye?: number[] | null, points?: number[][] | null, dt?: number }} f
     */
    frame({ eye = null, points = null, dt = 0 } = {}) {
      if (!share.size && (!mesh || !eye || !points?.length)) return 0;   // AUDIT EG III (lane4 #10): first person, a witness, nothing dithering - nothing tried, nothing made
      if (_seen.length < pieces.length) _seen = new Uint8Array(pieces.length);
      const hit = _hitSet;
      hit.clear();
      if (mesh) for (const i of egOccludersHit(pieces, T, eye, points, _hits, _seen)) hit.add(i);
      for (const i of hit) share.set(i, egOccludeEase(share.get(i) ?? 1, true, dt));
      for (const [i, k] of share) if (!hit.has(i)) { const v = egOccludeEase(k, false, dt); if (v >= 1) share.delete(i); else share.set(i, v); }
      let n = 0;
      for (const k of share.values()) if (k < 1) n++;
      return n;
    },
    /**
     * THE DRAW (after the frame's beginFrame - the shadow record open - and before the loop draws the list): nothing while
     * no piece dithers (the loop draws the circle whole); else the whole mesh's shadow recorded, the rest of the mesh drawn,
     * and each share's pieces at that share. Answers the GL draws it made.
     * @param {any} [texRemap]
     */
    draw(texRemap = null) {
      lastDraws = 0;
      if (!share.size) { unhide(); return 0; }   // AUDIT EG III (lane4 #10): the common frame - nothing dithers, nothing made
      const act = _act;
      act.length = 0;
      for (const e of share) if (e[1] < 1) act.push(e);
      if (!act.length || !draw || !mesh || mesh._dead || !renderer?.meshView || !renderer.setDissolve) { unhide(); return 0; }
      const M = draw.object?.matrix, remap = draw.texRemap ?? texRemap;
      const ids = act.map(([i]) => i).sort((a, b) => a - b);
      const rest = viewOf(`r:${ids.join(',')}`, ids, true);
      if (!rest) { unhide(); return 0; }
      draw.hidden = true; hid = true;
      if (shadow) renderer.recordShadowMesh?.(mesh, M, remap);
      renderer.drawMesh(rest, M, remap, NO_SHADOW);
      lastDraws += rest.subMeshes.length;
      const byShare = new Map();
      for (const [i, k] of act) { const g = byShare.get(k); if (g) g.push(i); else byShare.set(k, [i]); }
      for (const [k, g] of byShare) {
        g.sort((a, b) => a - b);
        const v = viewOf(`d:${g.join(',')}`, g, false);
        if (!v) continue;
        renderer.setDissolve(k);
        renderer.drawMesh(v, M, remap, NO_SHADOW);
        lastDraws += v.subMeshes.length;
      }
      renderer.setDissolve(1);
      return lastDraws;
    },
    /** Each dithering piece's share (tests): `[[piece, share], ...]`. */
    shares: () => [...share].filter(([, k]) => k < 1),
    /** What the pass holds and drew last (tests, the budget's measure). */
    stats: () => ({ pieces: pieces.length, tris: T.length / 9, dithering: [...share.values()].filter((k) => k < 1).length, glDraws: lastDraws, views: views.size, hidden: hid }),
  };
}

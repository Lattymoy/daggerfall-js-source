// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-5 (2026-10-14) - THE UV EDITOR'S HANDS: WHAT IS SELECTED, WHAT A PRESS DOES, AND EVERY STEP BACK.
//
// Mac: "Full UV editor" (bible/06-Systems/POI-Editor-Arc.md POI-5). Over one part's mesh as poi/uv/uvMesh.js holds it, one
// material's faces at a time (the submesh its picture is drawn on), pure - the panel (ui/poi/poiUvPanel.js) draws it and
// hands it the presses, a test drives it alone:
//
//   - FOUR WAYS TO SELECT: a UV VERTEX (every corner at that point of its island), an EDGE (a face's side, as the picture
//     shows it - a seam's two copies are two edges), a FACE, an ISLAND; a click the nearest within reach (or the face
//     under it), Shift adding to the selection (or taking away what is already in it), a box everything inside it. The
//     islands and the UV vertices are the UVs' own (uvMesh.js uvVertices), read once for each change of the UVs.
//   - THE TOOLS over the selection (the whole material when nothing is selected): move, turn and size about the
//     selection's centre, flip; mark and clear seams along selected edges; unwrap (on a worker of its own when one can
//     be had - poi/uv/uvUnwrapClient.js); project (planar along an axis, box, cylindrical, spherical); pack the islands;
//     read and set the texel density against the material's picture.
//   - EVERY TOOL IS ONE STEP of the UV editor's own undo (what it changed - the corners' UVs and the seams - as they were);
//     a drag is one step however long (`begin` / `drag` / `end`); a tool that changes nothing is no step.
//   - THE RESULT (`result`): the part's mesh made again (uvMesh.js meshFromSession) - the editor uploads it under its
//     new name and the part wears it, one step of the POI's undo.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import {
  uvSessionOf, cornersOf, uvCentre, transformCorners, edgeKey, setSeam, projectPlanar, projectBox, projectCylinder,
  projectSphere, unwrapLscm, packIslands, texelDensity, setTexelDensity, meshFromSession, uvBounds, uvVertices, uvIslandsOf,
} from './uvMesh.js';
import { createUnwrapThread } from './uvUnwrapClient.js';

/** The steps the UV editor's undo keeps. */
export const UV_UNDO_DEPTH = 100;
/** AUDIT POI M6: and the bytes they may hold between them - the oldest let go past it (the latest step is always kept).
 *  A step holds only what it changed, so a hundred small ones are a few kilobytes; one that moved every corner of the
 *  mesh law's largest part holds about 60 MB, and this keeps two of those. */
export const UV_UNDO_BYTES = 128 * 1024 * 1024;
export const UV_MODES = Object.freeze(['vertex', 'edge', 'face', 'island']);

/** The distance from a point to a segment, in UV. */
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
/** Is p inside the triangle (either winding)? */
function inTri(p, a, b, c) {
  const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
  const s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

/**
 * @param {any} mesh a POI mesh (poiMesh.js decodePoiMesh's `mesh`)
 * @param {{ sub?: number, workerFactory?: (() => any) | null, undoBytes?: number }} [opts] the material's submesh; the
 *   unwrap worker's factory (a test's fake, or null for this thread alone - poi/uv/uvUnwrapClient.js); the undo's bytes
 */
export function createUvEdit(mesh, { sub = 0, workerFactory = undefined, undoBytes = UV_UNDO_BYTES } = {}) {
  const s = uvSessionOf(mesh);
  /** @type {'vertex' | 'edge' | 'face' | 'island'} */
  let mode = 'face';
  let shownSub = sub;
  /** @type {Set<number>} the selection: corners (vertex), face*3+side (edge), faces (face, island) */
  let sel = new Set();
  let undo = [], redo = [];
  let dragStart = null;
  let gen = 0;
  let selGen = 0;   // the selection, its mode or its material changed
  let uvGen = 0;    // the UVs or the seams changed (a drag's moves are not counted until it ends: they move whole UV vertices)
  let busy = false;   // AUDIT POI M13: an unwrap is out on the worker - the UVs wait for it
  let thread = null;
  let disposed = false;   // let go (the panel closed): an unwrap still out is dropped, never run here instead
  const shownFaces = () => { const out = []; for (let f = 0; f < s.faces; f++) if (s.triSub[f] === shownSub) out.push(f); return out; };
  const uv = (c) => [s.cornerUv[c * 2], s.cornerUv[c * 2 + 1]];

  // AUDIT POI M5: THE UV VERTICES AND THE ISLANDS, READ ONCE FOR EACH CHANGE OF THE UVS (uvMesh.js uvVertices) - a
  // selection's corners were found by walking a whole island for every corner, its island by a search of every island,
  // on every press and every draw: a move of 12,800 faces 4 s, a box over them in island mode 42 s
  let topoCache = null;
  const topo = () => {
    if (!topoCache || topoCache.uvGen !== uvGen || topoCache.sub !== shownSub) topoCache = { uvGen, sub: shownSub, ...uvVertices(s, shownFaces()) };
    return topoCache;
  };
  const islandOf = (f) => { const t = topo(), i = t.islandOf[f]; return i >= 0 ? t.islands[i] : [f]; };

  // AUDIT POI M6: THE UNDO KEEPS WHAT A STEP CHANGED, NOT THE WHOLE MESH. A step holds the corners whose UVs it moved -
  // their numbers and their UVs on the other side of it - and the seams it marked and cleared; `kept` is the UVs as the
  // last step left them, the one whole copy, which a step is read against and a drag starts from. (A whole copy a step,
  // a hundred deep, was 1.2 GB at 250,000 triangles and 5 GB at the law's million.)
  const kept = Float64Array.from(s.cornerUv);
  let held = 0, dropped = false;
  const bytesOf = (e) => e.corners.byteLength + e.uv.byteLength + 64 * (e.add.length + e.del.length + 1);
  const clearRedo = () => { for (const e of redo) held -= bytesOf(e); redo = []; };
  /** One step from what changed since `kept`: the corners in `within` (every corner when null) whose UVs differ from it,
   *  and the seams `marked` and `cleared`. No step when nothing changed. Answers whether there was one. */
  const record = (within, marked = [], cleared = []) => {
    const cs = [];
    const look = (c) => { if (s.cornerUv[c * 2] !== kept[c * 2] || s.cornerUv[c * 2 + 1] !== kept[c * 2 + 1]) cs.push(c); };
    if (within) for (const c of within) look(c); else for (let c = 0; c < s.faces * 3; c++) look(c);
    if (!cs.length && !marked.length && !cleared.length) return false;
    const corners = Int32Array.from(new Set(cs)), was = new Float64Array(corners.length * 2);
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      was[i * 2] = kept[c * 2]; was[i * 2 + 1] = kept[c * 2 + 1];
      kept[c * 2] = s.cornerUv[c * 2]; kept[c * 2 + 1] = s.cornerUv[c * 2 + 1];
    }
    // `add` / `del`: the seams to mark and to clear when the step is next applied (undone first)
    const e = { corners, uv: was, add: cleared, del: marked };
    clearRedo();
    undo.push(e); held += bytesOf(e);
    while (undo.length > UV_UNDO_DEPTH || (held > undoBytes && undo.length > 1)) { held -= bytesOf(undo.shift()); dropped = true; }
    uvGen++; gen++;
    return true;
  };
  /** A step applied - undone or redone, the same act: its corners and the session swap UVs, so it holds the other side
   *  after; its seams marked and cleared as it says, and its two lists swapped likewise. */
  const swap = (e) => {
    for (let i = 0; i < e.corners.length; i++) for (let h = 0; h < 2; h++) {
      const a = e.corners[i] * 2 + h, was = s.cornerUv[a];
      s.cornerUv[a] = kept[a] = e.uv[i * 2 + h];
      e.uv[i * 2 + h] = was;
    }
    for (const k of e.del) s.seams.delete(k);
    for (const k of e.add) s.seams.add(k);
    [e.add, e.del] = [e.del, e.add];
    uvGen++; gen++;
  };
  /** A tool's press: `fn` changes the UVs, then one step of what it changed - none while an unwrap is out. */
  const step = (fn, within = null) => { if (busy) return false; fn(); return record(within); };

  /** The faces the selection stands on (the whole material when nothing is selected). */
  function selectedFaces() {
    if (!sel.size) return shownFaces();
    const out = new Set();
    if (mode === 'face' || mode === 'island') for (const f of sel) out.add(f);
    else if (mode === 'edge') for (const e of sel) out.add(Math.floor(e / 3));
    else for (const c of sel) out.add(Math.floor(c / 3));
    return [...out];
  }
  /** The corners a tool moves: every corner sharing a UV vertex with the selection (or the whole material). Kept until
   *  the selection or the UVs change - the panel asks on every draw; read it, do not change it. */
  let cornersCache = null;
  function selectedCorners() {
    if (!sel.size) return cornersOf(shownFaces());
    const t = topo();
    if (cornersCache && cornersCache.selGen === selGen && cornersCache.topo === t) return cornersCache.out;
    const seen = new Uint8Array(t.start.length - 1), out = [];
    const addVertex = (c) => {
      const v = t.vertOf[c];
      if (v < 0 || seen[v]) return;
      seen[v] = 1;
      for (let p = t.start[v]; p < t.start[v + 1]; p++) out.push(t.corners[p]);
    };
    if (mode === 'vertex') for (const c of sel) addVertex(c);
    else if (mode === 'edge') for (const e of sel) { const f = Math.floor(e / 3), i = e % 3; addVertex(f * 3 + i); addVertex(f * 3 + (i + 1) % 3); }
    else for (const f of sel) for (let k = 0; k < 3; k++) addVertex(f * 3 + k);
    cornersCache = { selGen, topo: t, out };
    return out;
  }
  const selChanged = () => { selGen++; gen++; };
  /** The unwrap's answer laid as one step (from this thread or the worker). */
  const lay = (corners, uvs) => {
    for (let i = 0; i < corners.length; i++) { const c = corners[i]; s.cornerUv[c * 2] = uvs[i * 2]; s.cornerUv[c * 2 + 1] = uvs[i * 2 + 1]; }
    record(corners);
  };

  const api = {
    session: s,
    generation: () => gen,
    mode: () => mode,
    setMode(/** @type {'vertex' | 'edge' | 'face' | 'island'} */ m) { if (m !== mode) { mode = m; sel = new Set(); selChanged(); } },
    submesh: () => shownSub,
    setSubmesh(n) { if (n >= 0 && n < s.submeshes && n !== shownSub) { shownSub = n; sel = new Set(); selChanged(); } },
    faces: shownFaces,
    selection: () => new Set(sel),
    selectedCorners,
    selectedFaces,
    clear() { if (sel.size) { sel = new Set(); selChanged(); } },
    selectAll() {
      sel = new Set();
      if (mode === 'vertex') for (const c of cornersOf(shownFaces())) sel.add(c);
      else if (mode === 'edge') for (const f of shownFaces()) for (let i = 0; i < 3; i++) sel.add(f * 3 + i);
      else for (const f of shownFaces()) sel.add(f);
      selChanged();
    },

    /**
     * A click at (u, v): the nearest thing of the mode within `reach` (UV units - the panel's few pixels), or the face
     * under it. `add` (Shift): added to the selection, or taken from it if it is there already. Answers what was hit.
     */
    pick(u, v, reach, add = false) {
      const p = [u, v];
      let hit = null;
      const faces = shownFaces();
      if (mode === 'vertex') {
        let best = reach;
        for (const c of cornersOf(faces)) { const d = Math.hypot(uv(c)[0] - u, uv(c)[1] - v); if (d <= best) { best = d; hit = c; } }
      } else if (mode === 'edge') {
        let best = reach;
        for (const f of faces) for (let i = 0; i < 3; i++) { const d = segDist(p, uv(f * 3 + i), uv(f * 3 + (i + 1) % 3)); if (d <= best) { best = d; hit = f * 3 + i; } }
      } else {
        for (const f of faces) if (inTri(p, uv(f * 3), uv(f * 3 + 1), uv(f * 3 + 2))) { hit = f; break; }
      }
      const items = hit === null ? [] : mode === 'island' ? islandOf(hit) : [hit];
      if (!add) sel = new Set();
      const all = items.length && items.every((x) => sel.has(x));
      for (const x of items) { if (add && all) sel.delete(x); else sel.add(x); }
      selChanged();
      return hit;
    },
    /** A box from (u0, v0) to (u1, v1): every vertex inside it, every edge wholly inside, every face (or island) whose
     *  centre is inside. */
    box(u0, v0, u1, v1, add = false) {
      const [a0, a1] = [Math.min(u0, u1), Math.max(u0, u1)], [b0, b1] = [Math.min(v0, v1), Math.max(v0, v1)];
      const inside = (q) => q[0] >= a0 && q[0] <= a1 && q[1] >= b0 && q[1] <= b1;
      if (!add) sel = new Set();
      const faces = shownFaces();
      if (mode === 'vertex') { for (const c of cornersOf(faces)) if (inside(uv(c))) sel.add(c); }
      else if (mode === 'edge') { for (const f of faces) for (let i = 0; i < 3; i++) if (inside(uv(f * 3 + i)) && inside(uv(f * 3 + (i + 1) % 3))) sel.add(f * 3 + i); }
      else {
        // AUDIT POI M5: an island by the table, and each island once however many of its faces stand in the box
        const t = mode === 'island' ? topo() : null, taken = t ? new Uint8Array(t.islands.length) : null;
        for (const f of faces) {
          const c = [(uv(f * 3)[0] + uv(f * 3 + 1)[0] + uv(f * 3 + 2)[0]) / 3, (uv(f * 3)[1] + uv(f * 3 + 1)[1] + uv(f * 3 + 2)[1]) / 3];
          if (!inside(c)) continue;
          if (!t) { sel.add(f); continue; }
          const i = t.islandOf[f];
          if (i < 0) { sel.add(f); continue; }
          if (taken[i]) continue;
          taken[i] = 1;
          for (const g of t.islands[i]) sel.add(g);
        }
      }
      selChanged();
    },

    /** The selection's centre (the tools' pivot). */
    pivot: () => uvCentre(s, selectedCorners()),
    /** Move, turn and size the selection about its centre - one step. */
    transform(op) { const cs = selectedCorners(); const pivot = uvCentre(s, cs); return step(() => transformCorners(s, cs, { ...op, pivot: op.pivot ?? pivot }), cs); },
    /** A drag: begun (from the UVs as they stand), moved (each time from the start - no error gathered), ended (one step). */
    begin() { if (busy) return; const cs = selectedCorners(); dragStart = { corners: cs, pivot: uvCentre(s, cs) }; },
    drag(op) {
      if (!dragStart) return;
      for (const c of dragStart.corners) { s.cornerUv[c * 2] = kept[c * 2]; s.cornerUv[c * 2 + 1] = kept[c * 2 + 1]; }
      transformCorners(s, dragStart.corners, { ...op, pivot: op.pivot ?? dragStart.pivot });
      gen++;
    },
    end() {
      if (!dragStart) return false;
      const cs = dragStart.corners;
      dragStart = null;
      return record(cs);
    },
    cancel() {
      if (!dragStart) return;
      for (const c of dragStart.corners) { s.cornerUv[c * 2] = kept[c * 2]; s.cornerUv[c * 2 + 1] = kept[c * 2 + 1]; }
      dragStart = null; gen++;
    },
    dragging: () => !!dragStart,
    /** Flip the selection over its centre, along u or v. */
    flip(/** @type {'u' | 'v'} */ axis) { return api.transform({ scale: axis === 'u' ? [-1, 1] : [1, -1] }); },

    /** Seams along the selected edges (edge mode): marked, or cleared. Answers how many changed. */
    seams(on) {
      if (busy || mode !== 'edge' || !sel.size) return 0;
      const changed = [];
      for (const e of sel) {
        const f = Math.floor(e / 3), i = e % 3;
        const a = s.weld[s.tris[f * 3 + i]], b = s.weld[s.tris[f * 3 + (i + 1) % 3]];
        const had = s.seams.has(edgeKey(a, b));
        if (had !== on && setSeam(s, a, b, on)) changed.push(edgeKey(a, b));
      }
      record([], on ? changed : [], on ? [] : changed);
      return changed.length;
    },
    /** Unwrap the selection's faces (their islands, cut by the seams) - least-squares conformal maps - on this thread.
     *  Answers the pieces it laid. */
    unwrap() {
      if (busy) return 0;
      const fs = selectedFaces();
      let pieces = [];
      step(() => { pieces = unwrapLscm(s, fs); });
      return pieces.length;
    },
    /**
     * AUDIT POI M13: THE SAME UNWRAP, OFF THIS THREAD (poi/uv/uvUnwrapClient.js) - the page paints, the view zooms and pans
     * and the selection moves while it works; the UVs wait for it (`busy`: every tool that changes them does nothing
     * meanwhile), and its answer lands as one step. Where no worker can be had it runs here, as `unwrap`. Resolves the
     * pieces it laid.
     */
    async unwrapOffThread() {
      if (busy || disposed) return 0;
      const fs = selectedFaces();
      thread ??= createUnwrapThread(mesh, { workerFactory });
      const seams = [];
      for (const k of s.seams) { const i = k.indexOf('_'); seams.push(Number(k.slice(0, i)), Number(k.slice(i + 1))); }
      busy = true; gen++;
      let r = null;
      try { r = await thread.unwrap(fs, seams); }
      finally { busy = false; gen++; }
      // AUDIT POI (the lead's): the dialog closed while it was out - the worker let go answers it null, and the whole
      // unwrap ran on this thread after all, into an editor no one has (the freeze M13 took off the thread)
      if (disposed) return 0;
      if (!r) {
        // the old path: this thread, the same unwrap over the same faces
        let pieces = [];
        step(() => { pieces = unwrapLscm(s, fs); });
        return pieces.length;
      }
      lay(r.corners, r.uvs);
      return r.pieces;
    },
    /** An unwrap is out on the worker: the tools that change the UVs wait. */
    busy: () => busy,
    /** Project the selection's faces: 'x' 'y' 'z' planar along that axis, 'box', 'cylinder' (about `axis`), 'sphere'. */
    project(kind, axis = 'y') {
      const fs = selectedFaces();
      const dir = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis] ?? [0, 1, 0];
      // the curved projections about the selection's own centre in the mesh
      let cx = 0, cy = 0, cz = 0, n = 0;
      for (const c of cornersOf(fs)) { const v = s.tris[c]; cx += s.positions[v * 3]; cy += s.positions[v * 3 + 1]; cz += s.positions[v * 3 + 2]; n++; }
      const centre = n ? [cx / n, cy / n, cz / n] : [0, 0, 0];
      return step(() => {
        if (kind === 'box') projectBox(s, fs);
        else if (kind === 'cylinder') projectCylinder(s, fs, dir, centre);
        else if (kind === 'sphere') projectSphere(s, fs, centre);
        else projectPlanar(s, fs, { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[kind] ?? dir);
      });
    },
    /** Pack the selection's islands - as the UVs hold them (AUDIT POI M3) - into the square (the material's, when nothing
     *  is selected). Answers the scale; 0 when they do not fit at that margin, and then nothing moved and there is no
     *  step (AUDIT POI M9). */
    pack({ margin = 0.01, rotate = true } = {}) {
      if (busy) return 0;
      const isl = uvIslandsOf(s, selectedFaces());
      let k = 0;
      step(() => { k = packIslands(s, isl, { margin, rotate }); });
      return k;
    },
    /** Fit the selection into the square, its proportions kept. */
    fit() {
      const cs = selectedCorners();
      const [u0, v0, u1, v1] = uvBounds(s, cs);
      const w = u1 - u0, h = v1 - v0, k = 1 / Math.max(w, h, 1e-9);
      return step(() => transformCorners(s, cs, { pivot: [u0, v0], scale: [k, k], move: [-u0, -v0] }), cs);
    },
    /** The selection's texel density against a `w` x `h` picture (pixels a metre). */
    density: (w, h) => texelDensity(s, selectedFaces(), w, h),
    /** Set each selected island's texel density (its islands as the UVs hold them - AUDIT POI M3). */
    setDensity(target, w, h) { const isl = uvIslandsOf(s, selectedFaces()); return step(() => setTexelDensity(s, isl, target, w, h)); },

    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    undo() { if (busy) return false; const e = undo.pop(); if (!e) return false; swap(e); redo.push(e); return true; },
    redo() { if (busy) return false; const e = redo.pop(); if (!e) return false; swap(e); undo.push(e); return true; },
    /** Whether anything was changed since it opened (a step let go past the undo's depth or its bytes was a change). */
    changed: () => undo.length > 0 || dropped,
    /** The bytes the undo and redo hold (AUDIT POI M6). */
    undoBytes: () => held,
    /** The part's mesh made again from the UVs as they stand. */
    result: () => meshFromSession(s),
    /** Every shown face's three UV points, for the panel to draw. */
    faceUvs(f) { return [uv(f * 3), uv(f * 3 + 1), uv(f * 3 + 2)]; },
    /** Whether a face's side is a seam (the panel draws it red). */
    isSeam(f, i) { return s.seams.has(edgeKey(s.weld[s.tris[f * 3 + i]], s.weld[s.tris[f * 3 + (i + 1) % 3]])); },
    /** Let the unwrap's worker go (the panel's close); an unwrap still out lays nothing. */
    dispose() { disposed = true; thread?.close(); thread = null; },
  };
  return api;
}

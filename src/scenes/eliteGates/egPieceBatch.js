// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.9 - "The moving
// pieces are instanced", "The cull"): THE PIECES BATCHED, AND CULLED - every moving piece of a circle's spans drawn as
// ONE DRAW A KIND, its copies culled against this frame's frustum.
//
// Before: every step, weight, wall segment and tube segment was a draw of its own (scenes/eliteGates/egSpan.js - a dynamic draw
// each, its matrix written as the law moved it), so a circle of 46 pieces and a Falling Wall's 50 segments stood ~100
// dynamic draws and, a piece's sub-meshes each a GL draw, 150-250 GL draws - past the Hour's whole frame (82). Now each
// mesh kind (a Drift's, a Beat's, a 3 x 2.4 slab's, a wall segment's...) is one mesh holding a copy for every piece of
// its kind, and each frame the copies that are seen and inside the frustum are written where the law stands them; a
// hidden or culled copy is written as one point (no triangle it holds covers a pixel), and a kind with no copy seen is
// not drawn at all. The draw count is the kinds', whatever the pieces'.
//
// HOW, AND WHY NOT GPU INSTANCES. The page asks for "per-instance matrices from stepAt". The world's mesh program (the
// renderer's own - its lane, its point lights, its fog and its grade) has no instance attribute, and giving it one is the
// renderer's change, not this slice's: a pass of our own beside it would light the pieces differently from the floors
// they stand between. So the copies are written on the CPU (every piece moves by a translation alone - the law's
// egPieceAt, the walls' fall, the tubes' - so a copy is its kind's vertices plus one offset) and drawn by the renderer's
// own program through renderer.updateMeshVertices, in the pieces' own light. Measured in test/net/eliteGates/eglook_pieces.test.js.
//
// THE SLOT IS THE DRAW IT REPLACED. egSpan's pose code writes each piece's `object.matrix` (a translation, or zeros when
// it is gone) and its `hidden`, as it always did - the batch hands it a slot of that shape and reads the slots at the
// cull (`cull(planes)`), so not one line of the law's posing changed. Every piece is `noShadow` (section 11.9), so a culled
// copy leaves no shadow record behind.
//
// EG-ZL (2026-10-12, Elite-Gates.md sections 10.3 and 10.8 - the pieces' tells): A KIND THAT TURNS, AND A KIND'S OWN
// PICTURES. A Drift's chains lean with its swing, a Crumble's chunks tumble as they fall and fly back, a Gust island's
// banner swings to the coming push - each turns as well as moves, so a kind added `turns` writes its copies through the
// slot's whole matrix (its turn and its move - normals turned with it), its cull sphere's centre turned too, and a copy
// re-laid when any of the twelve numbers moved; a kind that only moves keeps the translation's own law above, untouched. And
// a kind's draw takes a picture map (`remap` - the Beat's dial frames by its beat, a Crumble's crack stage), one map a
// kind, so the pieces a frame of law shows alike share one draw.
//
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md "What was
// wrong" - "The span pieces wore the Steps' clock faces"): A KIND OF MANY MODELS. Each piece is now a torn piece of the
// academy of its own (world/eliteGates/egPlatformModel.js - its foundation, its cornice's breaks and its ornament drawn off its own
// seed), so no two slabs of a kind share a mesh. A kind holds a model a copy (each `add` names its own; the copies that
// share one share its vertices' source): its copies laid one after another in the kind's mesh (each its own vertex run and
// its own cull sphere), and a sub-mesh a record over every copy that wears it (the records in the order the copies first
// wear them) - so a kind is still one draw a record however many shapes it holds, and the pieces that move alike (the
// still slabs, the clock's movers, a Beat's phase) share their draws. A kind of one model is laid exactly as before.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { sphereInPlanes } from '../../render/bounds.js';
import { meshKitBounds } from '../../world/eliteGates/meshKit.js';

/** Where a hidden or culled copy's vertices are put: one point, far under every floor (no triangle covers a pixel). */
export const EG_BATCH_HIDE_Y = -4000;
/** The cull's margin over a copy's own sphere (m) - a copy is drawn while any of it may be. */
export const EG_BATCH_CULL_PAD = 0.5;
/** EG-ZL: a turning copy's matrix entries the batch keeps (its turn's three columns and its move) - column-major. */
const TURN_AT = Object.freeze([0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]);

/** EG-LOOK: a model a kind holds - its packed shape, its vertex count and its cull sphere (its own frame). */
/** @typedef {{ model: any, verts: number, centre: number[], r: number }} EgBatchModel */
/**
 * A circle's pieces, batched.
 * @param {{ renderer?: any }} deps
 */
export function createEgPieceBatch({ renderer = null } = {}) {
  /** EG-LOOK: each kind's models (`models`, a copy's index into them `mi`), its copies' slots and, once built, each copy's
   *  first vertex (`vo`, its run's start - copy i's run is vo[i] to vo[i + 1]).
   *  @type {Map<string, { models: EgBatchModel[], byModel: Map<any, number>, mi: number[], slots: any[], vo: Uint32Array, gpu: any, draw: any, pos: Float32Array|null, nrm: Float32Array|null, at: Float32Array, seen: Uint8Array, turns: boolean, remap: any, subs: number }>} */
  const kinds = new Map();
  let built = false, lastDrawn = 0, lastCulled = 0, lastHidden = 0;
  return {
    /**
     * A piece of kind `key` wearing `model` (EG-LOOK: each add its own - a copy shares a model only with the adds that
     * name the same one), its slot `slot` - the `{ object: { matrix }, hidden }` its pose code writes. Before `build`.
     * EG-ZL: `turns` (the kind's first add says) - its copies written through the slot's whole matrix, not its move alone.
     */
    add(key, model, slot, { turns = false } = {}) {
      if (built || !model || !slot) return false;
      let k = kinds.get(key);
      if (!k) kinds.set(key, k = { models: [], byModel: new Map(), mi: [], slots: [], vo: new Uint32Array(1), gpu: null, draw: null, pos: null, nrm: null, at: new Float32Array(0), seen: new Uint8Array(0), turns: !!turns, remap: null, subs: 0 });
      let m = k.byModel.get(model);
      if (m === undefined) { const b = meshKitBounds(model.positions); m = k.models.length; k.models.push({ model, verts: model.positions.length / 3, centre: b.centre, r: b.r }); k.byModel.set(model, m); }
      k.slots.push(slot); k.mi.push(m);
      return true;
    },
    /** EG-ZL: kind `key`'s picture map (a draw's texRemap - null its model's own), before or after `build`. Answers whether
     *  the kind is held. */
    remap(key, map) {
      const k = kinds.get(key);
      if (!k) return false;
      k.remap = map ?? null;
      if (k.draw) k.draw.texRemap = k.remap;
      return true;
    },
    /** Every kind made one mesh of its copies (all hidden until the first cull) and its one draw pushed onto `draws`. */
    build(draws) {
      if (built) return 0;
      built = true;
      let n = 0;
      for (const k of kinds.values()) {
        const c = k.slots.length, vo = new Uint32Array(c + 1);
        for (let i = 0; i < c; i++) vo[i + 1] = vo[i] + k.models[k.mi[i]].verts;
        const V = vo[c], positions = new Float32Array(V * 3), normals = new Float32Array(V * 3), uvs = new Float32Array(V * 2);
        // EG-LOOK: the kind's records, in the order its copies first wear them, each its triangles over every copy
        /** @type {Map<string, { textureArchive: number, textureRecord: number, tris: number }>} */
        const recs = new Map();
        for (let i = 0; i < c; i++) for (const sm of k.models[k.mi[i]].model.subMeshes) {
          const id = `${sm.textureArchive}_${sm.textureRecord}`, q = recs.get(id);
          if (q) q.tris += sm.primitiveCount; else recs.set(id, { textureArchive: sm.textureArchive, textureRecord: sm.textureRecord, tris: sm.primitiveCount });
        }
        let acc = 0;
        /** @type {Map<string, { textureArchive: number, textureRecord: number, startIndex: number, primitiveCount: number }>} */
        const subOf = new Map();
        for (const [id, q] of recs) { subOf.set(id, { textureArchive: q.textureArchive, textureRecord: q.textureRecord, startIndex: acc, primitiveCount: q.tris }); acc += q.tris * 3; }
        const indices = new Uint32Array(acc), fill = new Map([...subOf].map(([id, s]) => [id, s.startIndex]));
        for (const id of recs.keys()) for (let i = 0; i < c; i++) {
          const m = k.models[k.mi[i]].model;
          for (const sm of m.subMeshes) {
            if (`${sm.textureArchive}_${sm.textureRecord}` !== id) continue;
            let at = fill.get(id);
            for (let q = 0; q < sm.primitiveCount * 3; q++) indices[at++] = m.indices[sm.startIndex + q] + vo[i];
            fill.set(id, at);
          }
        }
        for (let i = 0; i < c; i++) {
          const m = k.models[k.mi[i]].model;
          normals.set(m.normals, vo[i] * 3); uvs.set(m.uvs, vo[i] * 2);
          for (let p = vo[i]; p < vo[i + 1]; p++) { positions[p * 3] = 0; positions[p * 3 + 1] = EG_BATCH_HIDE_Y; positions[p * 3 + 2] = 0; }
        }
        const subMeshes = [...subOf.values()];
        k.vo = vo; k.pos = positions; k.nrm = normals; k.subs = subMeshes.length;
        k.at = new Float32Array(c * (k.turns ? TURN_AT.length : 3)).fill(NaN); k.seen = new Uint8Array(c);
        try { k.gpu = renderer?.createMesh ? renderer.createMesh({ positions, normals, uvs, indices, subMeshes }) : null; } catch (e) { console.warn('[eg] a batch would not build', e?.message ?? e); k.gpu = null; }
        if (k.gpu) { k.draw = { gpu: k.gpu, object: { matrix: IDENTITY }, noShadow: true, texRemap: null, hidden: true }; k.draw.texRemap = k.remap; draws?.push?.(k.draw); n++; }
      }
      return n;
    },
    /**
     * THE CULL, this frame (`planes` - render/bounds.js spherePlanes of the view-projection; null culls nothing): each copy
     * that is seen and inside written where its slot stands it, each other one put away; a kind with none seen not drawn.
     * The vertices are sent only when a copy moved, came or went. Answers how many kinds draw.
     */
    cull(planes = null) {
      let drawn = 0, culled = 0, hidden = 0;
      for (const k of kinds.values()) {
        if (!k.pos) continue;
        let any = false, dirty = false;
        if (k.turns) { const q = cullTurning(k, planes); culled += q.culled; hidden += q.hidden; any = q.any; dirty = q.dirty; }   // EG-ZL: a kind that turns
        else for (let i = 0; i < k.slots.length; i++) {
          const s = k.slots[i], M = s.object?.matrix, B = k.models[k.mi[i]];
          let show = !s.hidden && !!M && M[15] !== 0;   // a pose's zeros (a gone piece) are no place
          if (!show) hidden++;
          const x = show ? M[12] : 0, y = show ? M[13] : 0, z = show ? M[14] : 0;
          if (show && planes && !sphereInPlanes(planes, B.centre[0] + x, B.centre[1] + y, B.centre[2] + z, B.r + EG_BATCH_CULL_PAD)) { show = false; culled++; }
          if (show) any = true;
          const was = k.seen[i] === 1;
          if (show === was && (!show || (k.at[i * 3] === x && k.at[i * 3 + 1] === y && k.at[i * 3 + 2] === z))) continue;
          dirty = true;
          k.seen[i] = show ? 1 : 0;
          k.at[i * 3] = x; k.at[i * 3 + 1] = y; k.at[i * 3 + 2] = z;
          const o = k.vo[i] * 3, src = B.model.positions, V = B.verts;
          if (show) for (let p = 0; p < V; p++) { k.pos[o + p * 3] = src[p * 3] + x; k.pos[o + p * 3 + 1] = src[p * 3 + 1] + y; k.pos[o + p * 3 + 2] = src[p * 3 + 2] + z; }
          else for (let p = 0; p < V; p++) { k.pos[o + p * 3] = 0; k.pos[o + p * 3 + 1] = EG_BATCH_HIDE_Y; k.pos[o + p * 3 + 2] = 0; }
        }
        if (dirty && k.gpu) { try { renderer?.updateMeshVertices?.(k.gpu, k.pos, k.nrm); } catch (e) { console.warn('[eg] a batch would not move', e?.message ?? e); } }
        if (k.draw) k.draw.hidden = !any;
        if (any) drawn++;
      }
      lastDrawn = drawn; lastCulled = culled; lastHidden = hidden;
      return drawn;
    },
    /** What the batch holds and what its last cull drew (tests, the budget's measure). EG-LOOK: `tris` every copy's
     *  triangles, `models` the shapes the kinds hold. */
    stats() {
      let copies = 0, glDraws = 0, tris = 0, models = 0;
      for (const k of kinds.values()) {
        copies += k.slots.length; models += k.models.length;
        for (const m of k.mi) tris += k.models[m].model.indices.length / 3;
        if (k.draw && !k.draw.hidden) glDraws += k.subs;
      }
      return { kinds: kinds.size, copies, drawn: lastDrawn, culled: lastCulled, hidden: lastHidden, glDraws, tris, models };
    },
    /** EG-ZL: copy `i`'s vertex `p` where the cull wrote it (tests), or null. */
    copyVertex(key, i, p = 0) {
      const k = kinds.get(key);
      if (!k?.pos || i >= k.slots.length || p >= k.models[k.mi[i]].verts) return null;
      const o = (k.vo[i] + p) * 3;
      return [k.pos[o], k.pos[o + 1], k.pos[o + 2]];
    },
    /** A copy's written place (tests): its model's first vertex where the cull put it, or null. */
    copyAt(key, i) {
      const k = kinds.get(key);
      if (!k?.pos || i >= k.slots.length) return null;
      const o = k.vo[i] * 3, src = k.models[k.mi[i]].model.positions;
      return [k.pos[o] - src[0], k.pos[o + 1] - src[1], k.pos[o + 2] - src[2]];
    },
    /** EG-LOOK: the kinds held (tests, the lab): each its name, its copies, its models, its records and whether it turns. */
    kinds() { return [...kinds].map(([key, k]) => ({ key, copies: k.slots.length, models: k.models.length, subs: k.subs, turns: k.turns })); },
    /** Gone with the level: every batch's mesh freed. */
    clear() {
      for (const k of kinds.values()) { if (k.gpu) { try { renderer?.destroyMesh?.(k.gpu); } catch { /* gone */ } } k.gpu = null; k.draw = null; k.pos = null; }
      kinds.clear();
      built = false;
    },
  };
}
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** EG-ZL - A TURNING KIND'S CULL: each copy shown and inside written through its slot's whole matrix (its normals turned
 *  with it), each other put away; a copy re-laid only when it came, went or any of its twelve numbers moved. Answers what
 *  the frame found (its own scratch - a frame makes nothing). EG-LOOK: each copy its own model's vertices and sphere. */
const _turnCounts = { culled: 0, hidden: 0, any: false, dirty: false };
function cullTurning(k, planes) {
  const T = _turnCounts, A = TURN_AT.length;
  T.culled = 0; T.hidden = 0; T.any = false; T.dirty = false;
  for (let i = 0; i < k.slots.length; i++) {
    const s = k.slots[i], M = s.object?.matrix, B = k.models[k.mi[i]], c = B.centre;
    let show = !s.hidden && M != null && M[15] !== 0;   // a pose's zeros: no place
    if (!show) T.hidden++;
    if (show && planes && !sphereInPlanes(planes, M[0] * c[0] + M[4] * c[1] + M[8] * c[2] + M[12], M[1] * c[0] + M[5] * c[1] + M[9] * c[2] + M[13], M[2] * c[0] + M[6] * c[1] + M[10] * c[2] + M[14], B.r + EG_BATCH_CULL_PAD)) { show = false; T.culled++; }
    if (show) T.any = true;
    const was = k.seen[i] === 1, o12 = i * A;
    if (show === was) {
      if (!show) continue;
      let same = true;
      for (let j = 0; j < A; j++) if (k.at[o12 + j] !== M[TURN_AT[j]]) { same = false; break; }
      if (same) continue;
    }
    T.dirty = true;
    k.seen[i] = show ? 1 : 0;
    const o = k.vo[i] * 3, V = B.verts, src = B.model.positions, sn = B.model.normals;
    if (!show) {
      k.at.fill(NaN, o12, o12 + A);
      for (let p = 0; p < V; p++) { k.pos[o + p * 3] = 0; k.pos[o + p * 3 + 1] = EG_BATCH_HIDE_Y; k.pos[o + p * 3 + 2] = 0; }
      continue;
    }
    for (let j = 0; j < A; j++) k.at[o12 + j] = M[TURN_AT[j]];
    const a0 = M[0], a1 = M[1], a2 = M[2], b0 = M[4], b1 = M[5], b2 = M[6], c0 = M[8], c1 = M[9], c2 = M[10], tx = M[12], ty = M[13], tz = M[14];
    for (let p = 0; p < V; p++) {
      const q = p * 3, x = src[q], y = src[q + 1], z = src[q + 2], nx = sn[q], ny = sn[q + 1], nz = sn[q + 2];
      k.pos[o + q] = a0 * x + b0 * y + c0 * z + tx; k.pos[o + q + 1] = a1 * x + b1 * y + c1 * z + ty; k.pos[o + q + 2] = a2 * x + b2 * y + c2 * z + tz;
      k.nrm[o + q] = a0 * nx + b0 * ny + c0 * nz; k.nrm[o + q + 1] = a1 * nx + b1 * ny + c1 * nz; k.nrm[o + q + 2] = a2 * nx + b2 * ny + c2 * nz;
    }
  }
  return T;
}

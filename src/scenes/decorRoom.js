// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1c (2026-09-25) — THE PIECES STANDING IN A ROOM.
//
// Mac: decor "Gold per placement"; the catalogue "Everything Daggerfall
// furnishes"; offline "kept in the save". The room's own furniture is
// the block's and stands where Daggerfall laid it (one collider bucket,
// one static batch - interiorContext.js); a PLACED piece is one of these
// instead: its own model or flat, its own collider bucket and activation
// key (`decor:<id>`, the same string both, as player/activate.js's pick
// compares them), its own light. The room is one of these pools a host
// (worldModes.js), torn down with the interior at all three of its
// teardowns, as the torch and the loot pools are.
//
// A piece's position is from the BUILDING's origin (net/decorLaw.js - the
// door matrix's translation, the scene cache's 'building' frame), so the
// same numbers stand the same chair in the same place for every client
// and every visit; `origin()` is this visit's.
//
// A model stands with its ORIGIN at `pos` (a Daggerfall model's origin is
// not its base - interiorLayout.js lifts its props by their bottom; the
// placement tool does the lifting, so the record says where the model's
// own origin is and nothing is re-derived at a restore). A flat stands on
// its base at `pos`, as every Daggerfall billboard does, and turns to the
// eye whatever its record says (a flat has no turn of its own).
//
// DECOR2c: A MOUNT - one of the owner's weapons or shields
// (net/decorLaw.js decorIsMount) - is the one flat that does NOT turn to
// the eye. It hangs flat against the surface it was set on, CENTRED at
// `pos` (a hair off the surface), its picture framed by `rot` - the
// surface's heading and tilt, then its own spin on it - and drawn by the
// blood marks' own pass (render/renderer.js drawDecals: a quad lying on
// a surface, lit by that surface's light, its clear texels cut out).
// ═══════════════════════════════════════════════════════════════════

import { trs } from '../world/mat4.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';
import { billboardSize } from '../world/rmbFlats.js';
import { armFlatAnim } from '../render/flatAnimation.js';
import { collectInteriorLights } from '../world/interiorLights.js';
import { decorIsMount, decorMountFrame, DECOR_MOUNT_LIFT } from '../net/decorLaw.js';
import { decorMountDye } from '../systems/decorItems.js';
import { writeDecalQuad, clearDecalQuad, DECAL_FLOATS } from '../combat/bloodDecals.js';

/** How far the eye reaches a placed piece - the room's own furniture's reach (a bed's, a shelf's: 128 units). */
export const DECOR_REACH = DEFAULT_ACTIVATION_DISTANCE;
export const decorKeyOf = (id) => `decor:${id}`;
export const decorIdOfKey = (key) => (typeof key === 'string' && key.startsWith('decor:') ? key.slice(6) : null);

/** Where a lit piece's light hangs above its base: a TEXTURE.210 light where the room's own light of that record hangs
 *  (interiorLights.js - the flame, not the foot), any other flat at its middle, a model at its origin. */
export function decorLightLift(piece, size) {
  if (!piece.flat) return 0;
  if (!size) return null;
  const [own] = collectInteriorLights([{ archive: piece.flat[0], record: piece.flat[1], x: 0, y: 0, z: 0 }], () => size);
  return own ? own.y : size.h / 2;
}

/** DECOR2c: a mount's quad in THIS visit's frame - its centre, its frame, and its four corners (bottom-left first,
 *  round as the decal pass writes them) for `size` {w, h}, the picture's scaled size. */
export function decorMountQuad(piece, origin, size) {
  const f = decorMountFrame(piece.rot);
  const centre = [origin[0] + piece.pos[0], origin[1] + piece.pos[1], origin[2] + piece.pos[2]];
  const hw = size.w / 2;
  const hh = size.h / 2;
  const at = (sx, sy) => [0, 1, 2].map((i) => centre[i] + f.right[i] * sx * hw + f.up[i] * sy * hh);
  return { centre, ...f, w: size.w, h: size.h, corners: [at(-1, -1), at(-1, 1), at(1, 1), at(1, -1)] };
}

/** DECOR2c: the decal pass's floats for a mount's quad (bloodDecals.js writeDecalQuad - a square of `size` stretched
 *  along `right`), untinted and dry; none for no quad. */
export function decorMountFloats(quad) {
  const out = new Float32Array(DECAL_FLOATS);
  if (!quad || !(quad.w > 0) || !(quad.h > 0)) { clearDecalQuad(out, 0); return out; }
  writeDecalQuad(out, 0, { pos: quad.centre, size: quad.h, stretch: quad.w / quad.h, right: quad.right, up: quad.up, wet: 0 });
  return out;
}

/**
 * DECOR2c: A MOUNT'S PICTURE - uploaded as the pack's own is (the cut-out and the dye: scenes/dataPipeline.js
 * uploadRecord, the icons' door), sized as a flat of its archive is - answering `{ tex, w, h }`, or null (no such
 * record, or no texture to be had). `deps` the room's or the tool's: getTexture, uploadRecord, renderer.
 */
export function loadMountArt({ getTexture, uploadRecord, renderer }, a, r, dye) {
  return Promise.resolve(getTexture?.(a)).then((t) => {
    if (!t || !(r < t.recordCount)) return null;
    const variant = uploadRecord?.(a, r, { mips: false, removeMask: true, dye });
    const tex = renderer?.textures?.get?.(`${a}_${r}${variant ?? '#ui'}`) ?? null;
    if (!tex) return null;
    const { w, h } = billboardSize(t, r);
    return { tex, w, h };
  }).catch(() => null);
}

/** The model matrix of a placed piece in THIS visit's frame. */
export function decorMatrix(piece, origin) {
  const [x, y, z] = piece.pos;
  const [yaw, pitch, roll] = piece.rot;
  return trs(origin[0] + x, origin[1] + y, origin[2] + z, pitch, yaw, roll, piece.scale, piece.scale, piece.scale);
}

/**
 * THE ROOM'S PLACED PIECES. `deps`:
 *   meshes    - { getGpuMesh(id) -> Promise<gpu>, cpuModels: Map<id, {positions, indices}> }
 *   renderer  - { createBillboardBatch, destroyBillboardBatch, drawMesh } - DECOR2c: and the decal pass's four
 *               (createDecalBatch, writeDecalSlot, drawDecals, destroyDecalBatch) and its `textures`, for the mounts
 *   getTexture(archive) -> Promise<TextureFile>, uploadRecord(archive, record), uploadRecordFrame(archive, record, frame)
 *                  - a flat is uploaded, sized and animated exactly as the room's own flats are (interiorContext.js)
 *   flatAnims()  - the room's own flat animator (FA1, which the host ticks), or null
 *   collider()   - the interior's collider (addMesh / removeBucket), or null
 *   origin()     - this visit's building origin [x, y, z]
 *   roomLights() - the room's own live light list (interiorContext.js `lights`), or null: a lit piece's light joins
 *                  it, so the frame sorts it with the room's by distance and the renderer's cap keeps the nearest -
 *                  never two hundred placed candles ahead of the room's own lamps
 */
export function createDecorRoom({
  meshes, renderer, getTexture, uploadRecord, uploadRecordFrame, flatAnims = () => null, collider, origin, roomLights = () => null,
}) {
  /** @type {Map<string, {piece: any, gpu: any, box: any, matrix: Float32Array, batch: any, anims: any, size: any, light: any, mount: any}>} */
  const standing = new Map();
  const models = new Map();   // model id -> Promise<{gpu, cpu, box}>
  const flats = new Map();    // "a.r" -> Promise<{t, w, h} | null>
  const arts = new Map();     // DECOR2c: "a.r.dye" -> Promise<{tex, w, h} | null>, a mount's picture
  const artOf = (a, r, dye) => {
    const k = `${a}.${r}.${dye ?? '-'}`;
    if (!arts.has(k)) arts.set(k, loadMountArt({ getTexture, uploadRecord, renderer }, a, r, dye));
    return arts.get(k);
  };

  function modelOf(id) {
    if (!models.has(id)) {
      models.set(id, Promise.resolve(meshes?.getGpuMesh?.(id)).then((gpu) => {
        const cpu = meshes?.cpuModels?.get?.(id) ?? null;
        return { gpu: gpu ?? null, cpu, box: cpu?.positions ? localAabb(cpu.positions) : null };
      }).catch(() => ({ gpu: null, cpu: null, box: null })));
    }
    return models.get(id);
  }
  /** A flat's texture, uploaded and sized as the room's own flats are (a record the archive lacks is none). */
  function flatOf(a, r) {
    const k = `${a}.${r}`;
    if (!flats.has(k)) {
      flats.set(k, Promise.resolve(getTexture?.(a)).then((t) => {
        if (!t || !(r < t.recordCount)) return null;
        uploadRecord?.(a, r);
        const { w, h } = billboardSize(t, r);
        return { t, w, h };
      }).catch(() => null));
    }
    return flats.get(k);
  }

  /** A lit piece's light, into the room's list - `lift` above its base (decorLightLift). */
  function mountLight(entry, o, lift) {
    const { piece } = entry;
    if (!piece.light || lift == null) return;
    entry.light = {
      x: o[0] + piece.pos[0], y: o[1] + piece.pos[1] + lift, z: o[2] + piece.pos[2],
      range: piece.light.range, intensity: piece.light.intensity, color: [...piece.light.color], decor: piece.id,
    };
    roomLights?.()?.push(entry.light);
  }
  function unmount(entry) {
    if (!entry) return;
    collider?.()?.removeBucket?.(decorKeyOf(entry.piece.id));
    if (entry.mount) { renderer?.destroyDecalBatch?.(entry.mount.batch); entry.mount = null; }   // DECOR2c
    if (entry.batch) {
      entry.anims?.remove?.(entry.batch);   // its FlatAnim goes with it (the room's animator outlives no batch)
      renderer?.destroyBillboardBatch?.(entry.batch);
      entry.batch = null;
    }
    const lights = roomLights?.();
    if (lights && entry.light) {
      const i = lights.indexOf(entry.light);
      if (i >= 0) lights.splice(i, 1);
    }
    entry.light = null;
  }

  /** Stand one piece - a fresh placement, a move, a restore. Replaces a piece of the same id. */
  function put(piece) {
    unmount(standing.get(piece.id));
    const o = origin?.() ?? [0, 0, 0];
    const entry = { piece, gpu: null, box: null, matrix: decorMatrix(piece, o), batch: null, anims: null, size: null, light: null, mount: null };
    standing.set(piece.id, entry);
    if (decorIsMount(piece)) {   // DECOR2c: hung flat on its surface, as its pack picture
      const [a, r] = piece.flat;
      artOf(a, r, decorMountDye(piece.item)).then((art) => {
        if (standing.get(piece.id) !== entry || !art || !renderer?.createDecalBatch) return;
        entry.size = { w: art.w * piece.scale, h: art.h * piece.scale };
        const quad = decorMountQuad(piece, o, entry.size);
        entry.mount = { batch: renderer.createDecalBatch(1), tex: art.tex, quad };
        renderer.writeDecalSlot?.(entry.mount.batch, 0, decorMountFloats(quad));
        mountLight(entry, o, 0);   // a lit one's light at its middle - the centre is where it stands
      });
    } else if (piece.model != null) {
      mountLight(entry, o, decorLightLift(piece, null));
      modelOf(piece.model).then((m) => {
        if (standing.get(piece.id) !== entry) return;   // moved or removed while it loaded
        entry.gpu = m.gpu;
        entry.box = m.box;
        if (m.cpu?.positions && m.cpu?.indices) collider?.()?.addMesh?.(decorKeyOf(piece.id), m.cpu.positions, m.cpu.indices, entry.matrix);
      });
    } else {
      const [a, r] = piece.flat;
      flatOf(a, r).then((f) => {
        if (standing.get(piece.id) !== entry || !f || !renderer?.createBillboardBatch) return;
        entry.size = { w: f.w * piece.scale, h: f.h * piece.scale };
        // the renderer bottom-anchors every batch (rmbFlats.js AlignToBase): the base goes in, as the room's flats' do
        entry.batch = renderer.createBillboardBatch(a, r, entry.size, [[o[0] + piece.pos[0], o[1] + piece.pos[1], o[2] + piece.pos[2]]]);
        const anims = flatAnims?.() ?? null;
        if (armFlatAnim(entry.batch, f.t, a, r, anims, uploadRecordFrame ?? null)) entry.anims = anims;   // FA1: a lamp's flame moves as the room's own do
        mountLight(entry, o, decorLightLift(piece, entry.size));
      });
    }
    return entry;
  }

  function remove(id) {
    const e = standing.get(id);
    unmount(e);
    standing.delete(id);
    return e?.piece ?? null;
  }

  /** Replace every piece (a visit's load). */
  function set(pieces) {
    for (const e of standing.values()) unmount(e);
    standing.clear();
    for (const p of pieces ?? []) put(p);
  }

  /** The room goes: every piece unmounted, what they hold, the owner's own items and the kept record forgotten (the
   *  scene already wrote them). */
  function destroyAll() { set([]); held = new Map(); own = new Map(); kept = []; }

  /** The models, in the host's interior world pass - the room's texture remap, so a piece wears the climate the
   *  room's own furniture wears. */
  function draw(r = renderer, texRemap = null) {
    let n = 0;
    for (const e of standing.values()) if (e.gpu) { r?.drawMesh?.(e.gpu, e.matrix, texRemap); n++; }
    return n;
  }
  /** The flats' batches, for the host's billboard pass. */
  const batches = () => [...standing.values()].map((e) => e.batch).filter(Boolean);
  /** DECOR2c: the mounts, on the host's decal pass (after the room's solid geometry, as the blood marks go). */
  function drawMounts(r = renderer) {
    let n = 0;
    for (const e of standing.values()) if (e.mount) { r?.drawDecals?.(e.mount.batch, e.mount.tex); n++; }
    return n;
  }

  /** The lights the lit pieces carry - the very objects in the room's list. */
  const lights = () => [...standing.values()].map((e) => e.light).filter(Boolean);

  /** The eye's targets: every piece by its box, keyed `decor:<id>` (the collider's bucket, for a model). A flat has no
   *  collider, so its box answers the ray alone (`noSurface`, the hearth's own convention). */
  function targets() {
    const out = [];
    const o = origin?.() ?? [0, 0, 0];
    for (const e of standing.values()) {
      const key = decorKeyOf(e.piece.id);
      if (e.piece.model != null) {
        if (!e.box) continue;
        const b = transformedAabb(e.box, e.matrix);
        out.push({ key, aabb: { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]] }, distance: RAY_DISTANCE, reach: DECOR_REACH, meshCollider: true });
      } else if (e.mount) {   // DECOR2c: the box round its four corners, a hair thick either side of it
        const cs = e.mount.quad.corners;
        const min = [0, 1, 2].map((i) => Math.min(...cs.map((c) => c[i])) - DECOR_MOUNT_LIFT);
        const max = [0, 1, 2].map((i) => Math.max(...cs.map((c) => c[i])) + DECOR_MOUNT_LIFT);
        out.push({ key, aabb: { min, max }, distance: RAY_DISTANCE, reach: DECOR_REACH, noSurface: true });
      } else if (e.size) {
        const p = [o[0] + e.piece.pos[0], o[1] + e.piece.pos[1], o[2] + e.piece.pos[2]];
        const hw = e.size.w / 2;
        out.push({ key, aabb: { min: [p[0] - hw, p[1], p[2] - hw], max: [p[0] + hw, p[1] + e.size.h, p[2] + hw] }, distance: RAY_DISTANCE, reach: DECOR_REACH, noSurface: true });
      }
    }
    return out;
  }

  // WHAT A PIECE HOLDS, by its id - always the SAVE's (an online home's pieces are the service's, what the owner keeps
  // in them is the owner's own, as HOME1's cupboards are), restored with the room's scene and written back with it.
  /** @type {Map<string, any[]>} */
  let held = new Map();
  /** The items a storage piece holds - the live array the inventory window binds to. */
  function itemsOf(id) {
    let list = held.get(id);
    if (!list) { list = []; held.set(id, list); }
    return list;
  }
  /** Whether a piece holds anything (a full chest is not removed out from under its contents). */
  const holdsAny = (id) => (held.get(id)?.length ?? 0) > 0;
  /** The scene's record of what the pieces hold - only the non-empty, deep-copied. */
  function itemsSnapshot() {
    const out = {};
    for (const [id, list] of held) if (list.length) out[id] = list.map((it) => ({ ...it }));
    return out;
  }
  /** Restore what the pieces hold from a scene's record (a record written before DECOR1 holds none). */
  function setItems(record) {
    held = new Map();
    if (!record || typeof record !== 'object') return;
    for (const [id, list] of Object.entries(record)) if (Array.isArray(list)) held.set(id, list.map((it) => ({ ...it })));
  }

  // DECOR2a: THE OWNER'S OWN ITEMS STANDING HERE, by the piece's id - the save's, always (an online home's piece is
  // the service's, the thing itself the owner's), restored with the room's scene and written back with it; the item
  // leaves this record only to go back into the pack.
  /** @type {Map<string, any>} */
  let own = new Map();
  /** The item a piece of the owner's own is, or null. */
  const ownOf = (id) => own.get(id) ?? null;
  /** A piece is the owner's own item - kept here while it stands. */
  function keepOwn(id, item) { if (item) own.set(id, item); }
  /** The item taken back out of the record (for the pack), or null. */
  function takeOwn(id) {
    const item = own.get(id) ?? null;
    own.delete(id);
    return item;
  }
  /** The scene's record of the owner's own items - copies. */
  function ownSnapshot() {
    const out = {};
    for (const [id, item] of own) out[id] = { ...item };
    return out;
  }
  /** Restore the owner's own items from a scene's record (a record written before DECOR2 holds none). */
  function setOwn(record) {
    own = new Map();
    if (!record || typeof record !== 'object') return;
    for (const [id, item] of Object.entries(record)) if (item && typeof item === 'object') own.set(id, { ...item });
  }
  const ownIds = () => [...own.keys()];

  // THE SAVE'S PIECES FOR A ROOM STANDING ANOTHER'S. An online home is the service's room (HOME1: "Online, the server's
  // list is the only truth"), and the same building can be this character's own OFFLINE house, whose pieces are this
  // save's under the very scene a visitor's visit writes: held here untouched and written back as they came, so a
  // visit that stood none of them never wipes them ("The offline house keeps working offline").
  let kept = [];
  const keep = (pieces) => { kept = [...(pieces ?? [])]; };

  const pieceOf = (id) => standing.get(id)?.piece ?? null;
  const list = () => [...standing.values()].map((e) => e.piece);

  return {
    put, remove, set, destroyAll, draw, batches, drawMounts, lights, targets, pieceOf, list, size: () => standing.size,
    itemsOf, holdsAny, itemsSnapshot, setItems, keep, kept: () => kept,
    ownOf, keepOwn, takeOwn, ownSnapshot, setOwn, ownIds,
  };
}

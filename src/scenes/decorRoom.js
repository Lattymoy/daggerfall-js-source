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
// DECOR2c: A MOUNT - one of the owner's weapons or pieces of armour
// (net/decorLaw.js decorIsMount) - is the one flat that does NOT turn to
// the eye. It hangs flat against the surface it was set on, CENTRED at
// `pos` (a hair off the surface), its picture framed by `rot` - the
// surface's heading and tilt, then its own spin on it - and drawn by the
// blood marks' own pass (a quad lying on a surface, lit by that
// surface's light, its clear texels cut out) through its picture door
// (render/renderer.js drawDecalPicture - WEAPON-MOUNT: the texel is the
// colour, never a film's thickness).
// ═══════════════════════════════════════════════════════════════════

import { trs } from '../world/mat4.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';
import { billboardSize } from '../world/rmbFlats.js';
import { armFlatAnim } from '../render/flatAnimation.js';
import { collectInteriorLights } from '../world/interiorLights.js';
import { decorIsMount, decorMountFrame, DECOR_MOUNT_LIFT, decorFlatMirrored } from '../net/decorLaw.js';
import { decorMountDye, decorMountDyeTarget, decorMountItem } from '../systems/decorItems.js';
import { toColor32 } from '../formats/color32Order.js';   // MW-MOUNT: a rendered picture's rows, as the upload reads them
import { preloadTextureRecord } from '../systems/textureReplacement.js';   // MOUNT-LAZY: the record's own replacement, decoded before its upload
import { writeDecalQuad, clearDecalQuad, DECAL_FLOATS } from '../combat/bloodDecals.js';

/** How far the eye reaches a placed piece - the room's own furniture's reach (a bed's, a shelf's: 128 units). */
export const DECOR_REACH = DEFAULT_ACTIVATION_DISTANCE;
/** AUDIT DECOR-SHELL 3: how long after a model failed to load it is asked again, milliseconds - by a standing piece of
 *  it, and by the decorator (scenes/decorTool.js modelFor). */
export const DECOR_MODEL_RETRY_MS = 2000;
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
export function loadMountArt({ getTexture, uploadRecord, renderer }, a, r, dye, dyeTarget = null) {
  return Promise.resolve(getTexture?.(a)).then(async (t) => {
    if (!t || !(r < t.recordCount)) return null;
    // MOUNT-LAZY: the record's replacement by the item's dye, decoded BEFORE the upload asks for it - the pack's own ask
    // (ui/itemScroller.js preloadIconRecord). A lazy one (Diverse Weapons' metals, Roleplay Realism Items' archives) is
    // never decoded by the archive's preload: a mount hung before any list drew its record hung as the classic
    // picture, or as nothing where the mod's picture is the only one, and a ghost put up before the decode landed was
    // not the picture that then stood (Mac, the house: "changes after placment", "disapeared").
    await preloadTextureRecord(a, r, 0, 'Albedo', dye);
    const variant = uploadRecord?.(a, r, { mips: false, removeMask: true, dye, dyeTarget });   // DYE-ICON: the pack's picture, its metal dyed
    const tex = renderer?.textures?.get?.(`${a}_${r}${variant ?? '#ui'}`) ?? null;
    if (!tex) return null;
    const { w, h } = billboardSize(t, r);
    return { tex, w, h };
  }).catch(() => null);
}

/**
 * MW-MOUNT: A MOUNT'S MORROWIND PICTURE - the item's ground mesh face-on at its own size, from the host's Morrowind
 * build (`mwPicture`, combat/fpArm.js mountPicture), uploaded once under its own key: `{ tex, w, h }` in metres, or
 * null (no build, no record, a file that will not read) and the classic picture hangs.
 */
export function loadMwMountArt({ mwPicture, renderer }, item, archive = 'mw-mount') {
  if (typeof mwPicture !== 'function' || !item) return Promise.resolve(null);
  return Promise.resolve().then(() => mwPicture(item)).then((pic) => {
    if (!pic?.image?.width || !pic.key) return null;
    const tex = renderer?.uploadTexture?.(archive, pic.key, toColor32(pic.image), { mips: false, variant: '' }) ?? null;
    return tex ? { tex, w: pic.w, h: pic.h, key: pic.key } : null;   // MW-ASSIGN: the key, for a billboard's own
  }).catch(() => null);
}

/** MW-ASSIGN (2026-09-27, Discord: "Some sprites not assigned morrowind skin"): the archive a STANDING thing's Morrowind
 *  picture goes up under - one's own item set down (a garment), drawn on the room's billboard pass as its flats are. */
export const MW_STAND_ARCHIVE = 'mw-stand';
/** Whether a piece is one's own thing STANDING (not hung): the kind whose picture may be its Morrowind one. */
export const decorStandsOwn = (piece) => !!piece?.item && piece.model == null && Array.isArray(piece.flat) && !decorIsMount(piece);

/**
 * MW-MOUNT: THE PICTURE A MOUNT HANGS AS - its Morrowind one where the host has a build to take it from, else its pack
 * picture, dyed (loadMountArt). The ghost and the room ask this one door, so what the ghost shows is what stands.
 */
export function loadMountPicture(deps, flat, d) {
  return loadMwMountArt(deps, decorMountItem(d))
    .then((mw) => mw ?? loadMountArt(deps, flat[0], flat[1], decorMountDye(d), decorMountDyeTarget(d)));
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
 *   mwPicture(item) - MW-MOUNT: the host's Morrowind picture of a mount's item (combat/fpArm.js mountPicture), or
 *                  none; a mount hangs as it while a build stands (loadMountPicture)
 *   later(f, ms)  - AUDIT DECOR-SHELL 3: setTimeout's shape, for a model asked again
 */
export function createDecorRoom({
  meshes, renderer, getTexture, uploadRecord, uploadRecordFrame, flatAnims = () => null, collider, origin, roomLights = () => null,
  mwPicture = null, later = setTimeout,
}) {
  /** @type {Map<string, {piece: any, gpu: any, box: any, matrix: Float32Array, batch: any, anims: any, size: any, light: any, mount: any}>} */
  const standing = new Map();
  const models = new Map();   // model id -> Promise<{gpu, cpu, box}>
  const flats = new Map();    // "a.r" -> Promise<{t, w, h} | null>
  const arts = new Map();     // DECOR2c: "a.r|t.g.m.v.a" -> Promise<{tex, w, h} | null>, a mount's picture (MW-MOUNT: its Morrowind one, or its pack's)
  // AUDIT DYE-ICON 5: the Morrowind pictures asked for here, by the key each goes up under (fpArm.js mountPicture's -
  // per record and generation). Nothing let them go, so each Remove data or re-attach left one texture per mounted
  // record; refreshMounts does, once the mounts that drew them are down.
  const mwKeys = new Set();
  const mwAsk = typeof mwPicture === 'function'
    ? async (item) => { const pic = await mwPicture(item); if (pic?.key) mwKeys.add(pic.key); return pic; }
    : null;
  const borrowers = new Set();   // AUDIT DYE-ICON r3 1: who else hangs these pictures (the decorator's ghost) - told at a refresh
  // MW-ASSIGN: a STANDING thing's Morrowind picture (a garment set down), by its item's numbers - null where there is
  // none (no build, no record: the classic picture stands); a miss is never remembered, as a mount's is not
  const stands = new Map();
  const standKeys = new Set();   // the keys those went up under - let go at a refresh, as the mounts' are (AUDIT DYE-ICON 5)
  const standAsk = typeof mwPicture === 'function'
    ? async (item) => { const pic = await mwPicture(item); if (pic?.key) standKeys.add(pic.key); return pic; }
    : null;
  const standArtOf = (item) => {
    if (!standAsk || !item) return Promise.resolve(null);
    const k = `${item.t}.${item.g}.${item.m}.${item.v}.${item.a}`;
    if (!stands.has(k)) {
      const got = loadMwMountArt({ mwPicture: standAsk, renderer }, decorMountItem(item), MW_STAND_ARCHIVE);
      stands.set(k, got);
      got.then((art) => { if (!art && stands.get(k) === got) stands.delete(k); });
    }
    return stands.get(k);
  };
  const artOf = (piece) => {
    const it = piece.item ?? {};
    const k = `${piece.flat[0]}.${piece.flat[1]}|${it.t}.${it.g}.${it.m}.${it.v}.${it.a}`;
    if (!arts.has(k)) {
      const got = loadMountPicture({ getTexture, uploadRecord, renderer, mwPicture: mwAsk }, piece.flat, piece.item);
      arts.set(k, got);
      // AUDIT DYE-ICON 3: a picture that would not load is not remembered as none for the session (modelOf's
      // DECOR-SHELL law) - one blip, and that item never hung again, re-put, a second of it or a later visit
      got.then((art) => { if (!art && arts.get(k) === got) arts.delete(k); });
    }
    return arts.get(k);
  };

  function modelOf(id) {
    if (!models.has(id)) {
      const got = Promise.resolve(meshes?.getGpuMesh?.(id)).then((gpu) => {
        const cpu = meshes?.cpuModels?.get?.(id) ?? null;
        return { gpu: gpu ?? null, cpu, box: cpu?.positions ? localAabb(cpu.positions) : null };
      }).catch(() => ({ gpu: null, cpu: null, box: null }));
      models.set(id, got);
      // DECOR-SHELL: a model that would not load is not remembered as nothing for the session - the next piece of it
      // asks again (a piece stood with no mesh is listed and never drawn)
      got.then((m) => { if (!m.gpu && models.get(id) === got) models.delete(id); });
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
    if (decorIsMount(piece)) {   // DECOR2c: hung flat on its surface, as its pack picture (MW-MOUNT: or its Morrowind one)
      artOf(piece).then((art) => {
        if (standing.get(piece.id) !== entry || !art || !renderer?.createDecalBatch) return;
        entry.size = { w: art.w * piece.scale, h: art.h * piece.scale };
        const quad = decorMountQuad(piece, o, entry.size);
        entry.mount = { batch: renderer.createDecalBatch(1), tex: art.tex, quad };
        renderer.writeDecalSlot?.(entry.mount.batch, 0, decorMountFloats(quad));
        mountLight(entry, o, 0);   // a lit one's light at its middle - the centre is where it stands
      });
    } else if (piece.model != null) {
      mountLight(entry, o, decorLightLift(piece, null));
      const stand = (wait = DECOR_MODEL_RETRY_MS) => modelOf(piece.model).then((m) => {
        if (standing.get(piece.id) !== entry) return;   // moved or removed while it loaded
        // AUDIT DECOR-SHELL 3: a model that would not load is asked again while the piece stands - it stood undrawn, not
        // solid and not pointable for the visit, and only the next put of it asked (node: never holds a process open).
        // AUDIT2 DECOR-SHELL 7: twice as long each time, to the list's own bound - a build that throws was rebuilt every
        // two seconds a piece for the whole visit
        if (!m.gpu) { /** @type {any} */ (later(() => stand(Math.min(2 * wait, DECOR_LIST_RETRY_MAX_MS)), wait))?.unref?.(); return; }
        entry.gpu = m.gpu;
        entry.box = m.box;
        if (m.cpu?.positions && m.cpu?.indices) collider?.()?.addMesh?.(decorKeyOf(piece.id), m.cpu.positions, m.cpu.indices, entry.matrix);
      });
      stand();
    } else {
      const [a, r] = piece.flat;
      // MW-ASSIGN: one's own thing set down stands as its Morrowind picture while a build stands (a garment, not the
      // classic pile of cloth), on the billboard pass as every flat - else as its own world picture, as ever
      const mw = decorStandsOwn(piece) ? standArtOf(piece.item) : Promise.resolve(null);
      Promise.all([flatOf(a, r), mw]).then(([f, pic]) => {
        if (standing.get(piece.id) !== entry || !f || !renderer?.createBillboardBatch) return;
        const [da, dr, seen] = pic ? [MW_STAND_ARCHIVE, pic.key, pic] : [a, r, f];   // MW-ASSIGN: its own picture, its own size
        entry.size = { w: seen.w * piece.scale, h: seen.h * piece.scale };
        // the renderer bottom-anchors every batch (rmbFlats.js AlignToBase): the base goes in, as the room's flats' do.
        // DECOR-FLIP: turned half round, the picture faces the other way - the renderer's flip is the sign of its width
        // (the size the eye's box reads stays whole)
        const drawn = decorFlatMirrored(piece) ? { w: -entry.size.w, h: entry.size.h } : entry.size;
        entry.batch = renderer.createBillboardBatch(da, dr, drawn, [[o[0] + piece.pos[0], o[1] + piece.pos[1], o[2] + piece.pos[2]]]);
        const anims = flatAnims?.() ?? null;
        if (!pic && armFlatAnim(entry.batch, f.t, a, r, anims, uploadRecordFrame ?? null)) entry.anims = anims;   // FA1: a lamp's flame moves as the room's own do
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
    for (const e of standing.values()) if (e.mount) { (r?.drawDecalPicture ?? r?.drawDecals)?.call(r, e.mount.batch, e.mount.tex); n++; }   // WEAPON-MOUNT: a picture, not a film
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

  /** MW-MOUNT: a Morrowind build landed, or went (the host watches fpArm.js mountPictureStamp) - every mount asks
   *  for its picture again and hangs as the answer, where it stood. */
  function refreshMounts() {
    const was = [...mwKeys];
    const wasStand = [...standKeys];   // MW-ASSIGN: and the standing things' pictures
    mwKeys.clear();
    standKeys.clear();
    arts.clear();
    stands.clear();
    for (const e of [...standing.values()]) if (decorIsMount(e.piece) || decorStandsOwn(e.piece)) put(e.piece);
    for (const k of was) renderer?.releaseTexture?.('mw-mount', k);   // AUDIT DYE-ICON 5: the old pictures, their mounts down (one asked again uploads anew)
    for (const k of wasStand) renderer?.releaseTexture?.(MW_STAND_ARCHIVE, k);
    for (const fn of [...borrowers]) fn();   // AUDIT DYE-ICON r3 1: and whoever else hangs them lets its own go and asks again
  }

  /** AUDIT DYE-ICON r3 1: A MOUNT'S PICTURE FOR ANOTHER TO HANG - the decorator's ghost - through the room's own cache and
   *  keys, since a hung piece's ghost is its very texture: a refresh let it go under the ghost, still drawn, and a
   *  cancelled ghost's upload was never let go at all. `onRefresh(fn)` - told once a refresh has let the old ones go;
   *  answers the way to stop. */
  const mountPicture = (flat, item) => artOf({ flat, item });
  /** MW-ASSIGN: a standing thing's Morrowind picture for the decorator's ghost - the room's own cache and keys. */
  const standPicture = (item) => standArtOf(item);
  function onRefresh(fn) {
    borrowers.add(fn);
    return () => borrowers.delete(fn);
  }

  return {
    put, remove, set, destroyAll, draw, batches, drawMounts, lights, targets, pieceOf, list, size: () => standing.size,
    itemsOf, holdsAny, itemsSnapshot, setItems, keep, kept: () => kept,
    ownOf, keepOwn, takeOwn, ownSnapshot, setOwn, ownIds, refreshMounts, mountPicture, standPicture, onRefresh,
  };
}

/** AUDIT DECOR-SHELL 2: how long after an online home's list did not stand it is asked again - twice as long each time
 *  after, to the most. */
export const DECOR_LIST_RETRY_MS = 2_000;
export const DECOR_LIST_RETRY_MAX_MS = 30_000;

/**
 * AUDIT DECOR-SHELL 2: AN ONLINE HOME'S LIST, ASKED UNTIL IT STANDS. The host opened the room's decorator on any answer,
 * a refusal or the service unreachable too: the room then stood none of the service's pieces and none of its owner's
 * taken-out furniture, and the first piece taken out wrote the room's whole list from that - the service's own list
 * wiped, for every visitor. `ask()` answers the list (net/accountClient.js accountDecor.list); `live()` whether it is
 * still wanted (the visit that asked goes on, its list not yet stood); `stand(r)` stands the room from an answer that
 * holds pieces - the host's gate opens there and nowhere else. Anything else stands nothing, and the list is asked
 * again `wait` on, twice as long each time to DECOR_LIST_RETRY_MAX_MS, by `later` (setTimeout's shape; node: never
 * holding a process open).
 * @param {{ ask: () => any, live: () => boolean, stand: (r: any) => void, later?: (f: () => void, ms: number) => any, wait?: number }} o
 */
export function askDecorList({ ask, live, stand, later = setTimeout, wait = DECOR_LIST_RETRY_MS }) {
  const again = () => {
    if (live()) later(() => { if (live()) askDecorList({ ask, live, stand, later, wait: Math.min(2 * wait, DECOR_LIST_RETRY_MAX_MS) }); }, wait)?.unref?.();
  };
  return Promise.resolve().then(ask).then((r) => {
    if (!live()) return;
    if (r?.ok && Array.isArray(r.data?.pieces)) stand(r); else again();
  }).catch(again);
}

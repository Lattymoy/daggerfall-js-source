// SURV3 - THE CAMPS A HOST STANDS: the pool one host owns, on the
// dropped torches' shape (scenes/droppedTorches.js) - the pure law is
// systems/survival/camp.js; this is the ground, the sprite, the mesh,
// the light, the ray and the menu.
//
// A camp's FIRE is TEXTURE.210 record 1 (the town brazier's flame, the
// lights archive at 12 fps - FlatAnim picks the rate off the archive)
// as one billboard batch, base-aligned at the spot, with a point light
// over it while it burns. A TENT is model 41606 through the host's
// pipeline (the wagon's getGpuMesh law, player/eotbWagon.js), stood
// TENT_BEHIND behind its fire and facing it. Both are one activation
// target at CAMP_REACH under the host's one ray; Info and Talk name it,
// Grab and Steal open the menu (a list picker: rest, cook, stoke, pack).
//
// THE CLOCK is the world's minute (worldMinutes): a fire dies at its
// minute whether the player lived through it or slept, and a kit's
// fire that dies is swept. THE GROUND is the host's: snapshot/restore
// in the host's own frame (the save envelope and the scene cache, in
// natives outdoors), collectPixel with the streaming host's sweep,
// offsetAll with the floating origin, destroyAll on a transition.
//
// ONLINE, two doors. `wireRecords` says this player's own camps
// (a cell's foes frame carries them beside the foes; a world room's
// act frame and memory carry them as `c`); `applyOwner` lands another's
// through validCampRecord, replacing that owner's and no one else's;
// `sweepOwners` drops an owner whose stream has gone quiet, the cell's
// own law for its puppets.
import { GLOBAL_SCALE, RAY_DISTANCE } from '../player/activate.js';
import { worldMinutes } from '../systems/worldTick.js';
import { FlatAnim } from '../render/flatAnimation.js';
import { trs } from '../world/mat4.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { ListPickerWindow } from '../ui/listPicker.js';
import {
  TENT_MODEL, FIRE_FLAT, FIRE_LIGHT_RANGE, CAMP_REACH, CAMP_KIND, CAMP_TEXT, CAMPS_PER_OWNER,
  placeCampItem, packCamp, stokeFire, fireLit, campExpired, tentPos, nearestFire, campInfoText, campMenu,
  cookables, cookFood, hasSkillet, campWire, mergeOwnerCamps,
} from '../systems/survival/camp.js';

/** The light hangs this far over the flame's base. */
export const FIRE_LIGHT_UP = 0.6;
/** The eye's box over a fire (a flame is about a metre tall) and a tent (its mesh's own bounds, or this). */
export const FIRE_HALF = 0.5;

/**
 * deps = { renderer, getTexture, uploadRecordFrame, meshes ({ getGpuMesh, cpuModels } - the host's pipeline), entity (the player),
 *          camera() -> { feet, yaw }, collider() (raycast(origin, dir, max) -> distance), place() -> { insideBuilding,
 *          insideDungeon, inTown, enemiesNearby, inWater }, pixelKeyAt(pos) (the streaming host's, or null),
 *          say(line), showOverlay(win), openRest(camp), advanceMinutes(n) (offline; online the clock is nobody's),
 *          selfId() (this player's online id, or null), onChanged() (the host's online publish) }
 */
export function createCamps({
  renderer = null, getTexture = null, uploadRecordFrame = null, meshes = null, entity = null,
  camera = () => null, collider = () => null, place = () => ({}), pixelKeyAt = () => null,
  say = () => {}, showOverlay = null, openRest = null, advanceMinutes = null, selfId = () => null, onChanged = null,
} = {}) {
  const camps = [];   // { rec, batch, anim, pixelKey, mine }
  let _nextId = 0;
  let _fire = null;   // { count, size } once TEXTURE.210 record 1 is up
  let _fireLoading = null;
  let _tent = null;   // { gpu, box } once model 41606 is up
  let _tentLoading = null;
  const _owners = new Map();   // owner -> { at }
  const now = () => worldMinutes();
  const mine = (rec) => rec.owner == null || rec.owner === (selfId?.() ?? null);

  function ensureFire() {
    if (_fire || _fireLoading || !getTexture) return;
    _fireLoading = Promise.resolve(getTexture(FIRE_FLAT.archive)).then((t) => {
      if (!t) return;
      const count = t.getFrameCount?.(FIRE_FLAT.record) ?? 1;
      for (let i = 0; i < count; i++) uploadRecordFrame?.(FIRE_FLAT.archive, FIRE_FLAT.record, i);
      const size = t.getSize(FIRE_FLAT.record);
      _fire = { count, size: { w: size.width * GLOBAL_SCALE, h: size.height * GLOBAL_SCALE } };
      for (const c of camps) if (!c.batch) mountFire(c);
    }).catch((e) => console.warn('[camps] the fire would not load', e));
  }
  function ensureTent() {
    if (_tent || _tentLoading || !meshes?.getGpuMesh) return;
    _tentLoading = Promise.resolve(meshes.getGpuMesh(TENT_MODEL)).then((gpu) => {
      const cpu = meshes.cpuModels?.get?.(TENT_MODEL);
      _tent = { gpu: gpu ?? null, box: cpu?.positions ? localAabb(cpu.positions) : null };
    }).catch((e) => console.warn('[camps] the tent would not load', e));
  }
  function mountFire(c) {
    if (c.batch || !_fire || !renderer?.createBillboardBatch) return;
    c.batch = renderer.createBillboardBatch(FIRE_FLAT.archive, FIRE_FLAT.record, _fire.size, [c.rec.pos]);
    c.batch.frame = 0;
    c.anim = _fire.count > 1 ? new FlatAnim(FIRE_FLAT.archive, _fire.count, false) : null;
  }
  function unmount(c) {
    if (c.batch) { renderer?.destroyBillboardBatch?.(c.batch); c.batch = null; }
  }
  function remount(c) { unmount(c); mountFire(c); }

  /** Stand one record (a fresh placing, a restore, an owner's word). */
  function stand(rec, { owner = null } = {}) {
    const c = { rec, batch: null, anim: null, pixelKey: pixelKeyAt?.(rec.pos) ?? null, owner };
    camps.push(c);
    ensureFire(); mountFire(c);
    if (rec.kind === CAMP_KIND.Tent) ensureTent();
    return c;
  }
  function drop(c) {
    unmount(c);
    const i = camps.indexOf(c);
    if (i >= 0) camps.splice(i, 1);
  }
  const own = () => camps.filter((c) => c.owner == null).map((c) => c.rec);

  /** THE PLACING: the pack's use of Camping Equipment or a Campfire Kit lands here (useItem's 'pitchCamp' / 'placeFire'). */
  function placeItem(item, list) {
    const cam = camera?.();
    if (!cam?.feet) return false;
    const col = collider?.();
    const r = placeCampItem(item, list, {
      now: now(), owner: selfId?.() ?? null, feet: cam.feet, yaw: cam.yaw ?? 0,
      probe: col?.raycast ? (o, d, m) => col.raycast(o, d, m) : null,
      place: place?.() ?? {}, standing: own().length, id: `${selfId?.() ?? 'me'}:${++_nextId}:${Math.trunc(now())}`,
    });
    if (r.text) say(r.text);
    if (!r.ok) return false;
    stand(r.camp);
    onChanged?.();
    return true;
  }

  /** The burn: a fire dies at its minute; a kit's camp goes with it. */
  function tick(dt) {
    const t = now();
    for (let i = camps.length - 1; i >= 0; i--) {
      const c = camps[i];
      if (campExpired(c.rec, t)) { drop(c); if (c.owner == null) onChanged?.(); continue; }
      if (c.batch) {
        if (!fireLit(c.rec, t)) { unmount(c); continue; }   // embers: no flame
        if (c.anim) c.batch.frame = c.anim.tick(dt);
      } else if (fireLit(c.rec, t) && _fire) mountFire(c);   // stoked: the flame is back
    }
  }
  const batches = () => camps.map((c) => c.batch).filter(Boolean);
  function lights() {
    const t = now();
    return camps.filter((c) => fireLit(c.rec, t)).map((c) => ({ x: c.rec.pos[0], y: c.rec.pos[1] + FIRE_LIGHT_UP, z: c.rec.pos[2], range: FIRE_LIGHT_RANGE }));
  }
  const tentMatrix = (rec) => { const p = tentPos(rec); return trs(p[0], p[1], p[2], 0, rec.yaw * 180 / Math.PI, 0); };
  /** The tents, in the host's world pass. */
  function draw(r = renderer, texRemap = null) {
    if (!_tent?.gpu || !r?.drawMesh) return 0;
    let n = 0;
    for (const c of camps) if (c.rec.kind === CAMP_KIND.Tent) { r.drawMesh(_tent.gpu, tentMatrix(c.rec), texRemap); n++; }
    return n;
  }

  /** The eye's targets: the fire's box and, for a tent, the mesh's bounds. */
  function targets() {
    const out = [];
    for (const c of camps) {
      const p = c.rec.pos;
      out.push({ key: `camp:${c.rec.id}`, aabb: { min: [p[0] - FIRE_HALF, p[1], p[2] - FIRE_HALF], max: [p[0] + FIRE_HALF, p[1] + 1, p[2] + FIRE_HALF] }, distance: RAY_DISTANCE, reach: CAMP_REACH });
      if (c.rec.kind === CAMP_KIND.Tent) {
        const m = tentMatrix(c.rec);
        const tp = tentPos(c.rec);
        const box = _tent?.box ? transformedAabb(_tent.box, m) : [tp[0] - 1.5, tp[1], tp[2] - 1.5, tp[0] + 1.5, tp[1] + 2, tp[2] + 1.5];
        out.push({ key: `camp:${c.rec.id}`, aabb: { min: [box[0], box[1], box[2]], max: [box[3], box[4], box[5]] }, distance: RAY_DISTANCE, reach: CAMP_REACH });
      }
    }
    return out;
  }
  const forKey = (key) => camps.find((c) => `camp:${c.rec.id}` === key) ?? null;
  /** Info and Talk name it; Grab and Steal open the menu. */
  function activate(key, mode) {
    const c = forKey(key);
    if (!c) return false;
    if (mode === 'info' || mode === 'dialogue') { say(campInfoText(c.rec, now(), mine(c.rec))); return true; }
    openMenu(c);
    return true;
  }
  function openMenu(c) {
    const rows = campMenu(c.rec, now(), mine(c.rec));
    const win = new ListPickerWindow({ items: rows.map((r) => r.text), onPick: (i) => act(c, rows[i]?.key) });
    if (showOverlay) showOverlay(win); else act(c, rows[0]?.key);
    return win;
  }
  function act(c, key) {
    if (!camps.includes(c)) return;
    if (key === 'rest') { openRest?.(c.rec); return; }
    if (key === 'stoke') { stokeFire(c.rec, now()); remount(c); say(CAMP_TEXT.stoked); if (c.owner == null) onChanged?.(); return; }
    if (key === 'pack') {
      if (!mine(c.rec)) { say(CAMP_TEXT.notYours); return; }
      const r = packCamp(c.rec);
      if (r.item && entity) (entity.items ??= []).push(r.item);
      drop(c); say(r.text); onChanged?.();
      return;
    }
    if (key === 'cook') openCook(c);
  }
  function openCook(c) {
    const items = entity?.items ?? [];
    const raw = cookables(items);
    if (!raw.length) { say(CAMP_TEXT.nothingToCook); return null; }
    if (!fireLit(c.rec, now())) { say(CAMP_TEXT.cold); return null; }
    const win = new ListPickerWindow({
      items: raw.map((it) => ((it.stackCount ?? 1) > 1 ? `${it.name} (${it.stackCount})` : it.name)),
      onPick: (i) => {
        const r = cookFood(raw[i], items, { skillet: hasSkillet(items) });
        if (!r) return;
        say(r.text);
        advanceMinutes?.(r.minutes);
      },
    });
    if (showOverlay) showOverlay(win);
    return win;
  }

  /** The needs law's `byFire`: within BY_FIRE_REACH of a lit fire, anyone's. */
  const byFire = (pos) => !!nearestFire(camps.map((c) => c.rec), pos, now());
  const campAt = (pos) => nearestFire(camps.map((c) => c.rec), pos, now());

  /** DestroyLightSources' twin: every transition and every load. */
  function destroyAll() {
    for (const c of camps) unmount(c);
    camps.length = 0;
    _owners.clear();
  }
  /** The streaming host's sweep: a camp on an evicted pixel goes with it - it comes back from the scene cache. */
  function collectPixel(key) {
    for (let i = camps.length - 1; i >= 0; i--) if (camps[i].pixelKey === key) { unmount(camps[i]); camps.splice(i, 1); }
  }
  /** A floating-origin recenter moves the pool. */
  function offsetAll(offset) {
    const [dx, dy, dz] = offset;
    for (const c of camps) { c.rec.pos[0] += dx; c.rec.pos[1] += dy; c.rec.pos[2] += dz; if (c.batch) remount(c); }
  }
  /** This player's own camps for the save and the scene cache, in the host's frame. */
  const snapshot = (toWorld = (p) => p) => own().map((rec) => { const p = toWorld(rec.pos); return { ...rec, pos: [p[0], p[1], p[2]] }; });
  function restore(list, fromWorld = (p) => p) {
    for (let i = camps.length - 1; i >= 0; i--) if (camps[i].owner == null) drop(camps[i]);
    for (const r of Array.isArray(list) ? list : []) {
      if (!r || typeof r !== 'object' || !Array.isArray(r.pos) || r.pos.length !== 3 || !(r.kind === CAMP_KIND.Tent || r.kind === CAMP_KIND.Fire)) continue;
      const p = fromWorld(r.pos);
      stand({ id: String(r.id ?? `me:${++_nextId}`), owner: r.owner ?? null, kind: r.kind, pos: [p[0], p[1], p[2]], yaw: Number(r.yaw) || 0, litUntil: Number.isFinite(r.litUntil) ? r.litUntil : null, wear: r.wear | 0, placedAt: r.placedAt ?? null });
      if (own().length >= CAMPS_PER_OWNER) break;
    }
  }

  // ---- ONLINE ----
  /** My camps as the wire says them. */
  const wireRecords = (toWire = (p) => p) => own().map((rec) => campWire(rec, toWire));
  /** Another's word: their camps replace theirs, through the door. */
  function applyOwner(owner, records, toScene = (p) => p, nowMs = 0) {
    if (typeof owner !== 'string' || !owner || owner === (selfId?.() ?? null)) return false;
    const merged = mergeOwnerCamps(camps.filter((c) => c.owner === owner).map((c) => c.rec), owner, records, toScene);
    const fresh = merged.filter((r) => r.owner === owner);
    // keep a batch whose record is unchanged in place; re-stand the rest
    const before = new Map(camps.filter((c) => c.owner === owner).map((c) => [c.rec.id, c]));
    for (const c of [...before.values()]) {
      const r = fresh.find((x) => x.id === c.rec.id);
      if (!r || r.kind !== c.rec.kind || r.pos.some((v, i) => Math.abs(v - c.rec.pos[i]) > 0.01)) drop(c);
      else { c.rec.litUntil = r.litUntil; c.rec.wear = r.wear; c.rec.yaw = r.yaw; before.delete(c.rec.id); fresh.splice(fresh.indexOf(r), 1); }
    }
    for (const r of fresh) stand(r, { owner });
    _owners.set(owner, { at: nowMs });
    return true;
  }
  /** An owner gone from the room, or quiet past staleMs, takes their camps with them. */
  function sweepOwners(alive, nowMs, staleMs = 0) {
    for (const [owner, o] of [..._owners]) {
      if (alive?.has?.(owner) && !(staleMs > 0 && nowMs - o.at > staleMs)) continue;
      for (let i = camps.length - 1; i >= 0; i--) if (camps[i].owner === owner) drop(camps[i]);
      _owners.delete(owner);
    }
  }

  return {
    placeItem, tick, batches, lights, draw, targets, activate, openMenu, openCook, byFire, campAt,
    destroyAll, collectPixel, offsetAll, snapshot, restore, wireRecords, applyOwner, sweepOwners,
    get camps() { return camps; }, own,
  };
}

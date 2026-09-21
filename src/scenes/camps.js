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
import { survivalOn } from '../systems/survival/switch.js';   // AUDIT SURV B: the pool stands nothing with the mod off
import {
  TENT_MODEL, FIRE_FLAT, FIRE_LIGHT_RANGE, CAMP_REACH, CAMP_KIND, CAMP_TEXT, CAMPS_PER_OWNER,
  placeCampItem, packCamp, stokeFire, fireLit, campExpired, tentPos, nearestFire, campInfoText, campMenu,
  cookables, cookFood, hasSkillet, campWire, mergeOwnerCamps, BY_FIRE_REACH,
} from '../systems/survival/camp.js';
import { nearestHearth, hearthNear } from '../systems/survival/hearth.js';   // HEARTH1: the world's own fires answer the same question this pool does

/** The light hangs this far over the flame's base. */
export const FIRE_LIGHT_UP = 0.6;
/** The eye's box over a fire (a flame is about a metre tall) and a tent (its mesh's own bounds, or this). */
export const FIRE_HALF = 0.5;
/** HEARTH1: the eye's box over a world fire - a brazier's bowl is about this wide. */
export const HEARTH_HALF = 0.6;
/** HEARTH1 / AUDIT F3: how far the eye's box reaches BELOW a world fire.
 *  The position a host hands over is its LIGHT - the flame - and the
 *  three collectors put that anywhere from the middle of the flat to
 *  its top (survival/hearth.js says which is which), never at its foot.
 *  So the box reaches a sprite's height down to cover the bowl under
 *  the flame, and only HEARTH_HALF up, where there is nothing to aim
 *  at. It is deliberately not larger than that: a taller box would
 *  start eating clicks meant for whatever stands behind the fire. */
export const HEARTH_DROP = 1.8;

/**
 * deps = { renderer, getTexture, uploadRecordFrame, meshes ({ getGpuMesh, cpuModels } - the host's pipeline), entity (the player),
 *          camera() -> { feet, yaw }, collider() (raycast(origin, dir, max) -> distance), place() -> { insideBuilding,
 *          insideDungeon, inTown, enemiesNearby, inWater }, pixelKeyAt(pos) (the streaming host's, or null),
 *          say(line), showOverlay(win), openRest(camp), advanceMinutes(n) (offline; online the clock is nobody's),
 *          selfId() (this player's online id, or null), onChanged() (the host's online publish),
 *          hearths() -> [{x, y, z}] (HEARTH1: the world's own cooking fires in the host's frame - the braziers
 *            and fire bowls survival/hearth.js picks out of the lantern list the host already builds; a host
 *            that passes none has none, which is what every caller did before this) }
 */
export function createCamps({
  renderer = null, getTexture = null, uploadRecordFrame = null, meshes = null, entity = null,
  camera = () => null, collider = () => null, place = () => ({}), pixelKeyAt = () => null,
  say = () => {}, showOverlay = null, openRest = null, advanceMinutes = null, selfId = () => null, onChanged = null,
  hearths = null,   // HEARTH1: the host's own braziers and fire bowls, in the host's frame - see below
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

  /** The eye's targets: the fire's box and, for a tent, the mesh's bounds.
   *  HEARTH1: and a box on every world fire, so a brazier answers the
   *  ray as a camp does - HEARTH_HALF either way, HEARTH_DROP below
   *  (AUDIT F3: the position is the FLAME and the bowl is under it, by
   *  a distance the three hosts each measure differently). */
  function targets() {
    const out = [];
    const wf = worldFires();
    if (wf) for (let i = 0; i < wf.length; i++) {
      const h = wf[i];
      out.push({
        key: `hearth:${i}`,
        aabb: { min: [h.x - HEARTH_HALF, h.y - HEARTH_DROP, h.z - HEARTH_HALF], max: [h.x + HEARTH_HALF, h.y + HEARTH_HALF, h.z + HEARTH_HALF] },
        distance: RAY_DISTANCE, reach: CAMP_REACH,
      });
    }
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
  /** WORLD-HOVER: the port's OWN world objects, named through World
   *  Tooltips' extension API (vendor .cs:225-257) rather than wedged
   *  into its ladder - the mod has no word for a camp because
   *  Daggerfall has no camps. A tent and its fire share one `camp:`
   *  key (two boxes, one subject), so the kind decides the word; a
   *  `hearth:` is any world fire, which HEARTH1 stood a box on. */
  function hoverName(key) {
    if (key.startsWith('hearth:')) return { title: 'Fire' };
    const c = forKey(key);
    if (!c) return null;
    return { title: c.rec.kind === CAMP_KIND.Tent ? 'Camp' : 'Campfire' };
  }
  /** Info and Talk name it; Grab and Steal open the menu. */
  function activate(key, mode) {
    // HEARTH1: a world fire is not a camp. It cannot be rested AT as an
    // act (the rest window reads `byFire` and already sees it), stoked
    // or packed - it is nobody's - so the only thing it opens is the
    // cooking list, and Info and Talk say what it is.
    if (typeof key === 'string' && key.startsWith('hearth:')) {
      if (mode === 'info' || mode === 'dialogue') { say(CAMP_TEXT.seeHearth); return true; }
      openCook(null);
      return true;
    }
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
  /** The cooking list. HEARTH1: `c` is the camp whose fire this is, or
   *  NULL for one of the world's own - a brazier burns for ever and
   *  belongs to nobody, so there is no burn-down test to make. */
  function openCook(c) {
    const items = entity?.items ?? [];
    const raw = cookables(items);
    if (!raw.length) { say(CAMP_TEXT.nothingToCook); return null; }
    if (c && !fireLit(c.rec, now())) { say(CAMP_TEXT.cold); return null; }
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

  /**
   * HEARTH1: the world's own fires, live off the host's door.
   *
   * A brazier does not move, burn down or belong to anyone, so there is
   * no pool and no record - the host hands over the positions it read
   * out of the block it was already reading, and this asks them the
   * same question it asks the camps.
   *
   * AUDIT HEARTH1 F1: AND IT IS BEHIND THE MOD'S OWN SWITCH. The camps
   * never needed one here - nothing can be PLACED with Climates &
   * Calories off, so the pool is empty and every question about it
   * answers no by itself. A brazier is in the world whether the mod is
   * on or not, so without this gate the survival arc leaked out through
   * it: a fire bowl answered the activation ray with a cooking list and
   * reported `byFire` to a law nobody had turned on. Off, every seam is
   * DFU's - that is the arc's own sentence and this is where it was
   * about to stop being true.
   */
  const worldFires = () => (survivalOn() && hearths ? hearths() : null);
  const hearthAt = (pos) => nearestHearth(worldFires(), pos, BY_FIRE_REACH);

  /**
   * The needs law's `byFire`: within BY_FIRE_REACH of a lit fire.
   *
   * HEARTH1 (Mac: "Does this version of C&C not let you use braziers as
   * extra campfires to cook from?"): anyone's CAMP, and now the world's
   * own braziers and fire bowls with them. A fire is a fire - it warms
   * you, dries you and makes a rest a camp's rest (SURV4 reads this
   * through `restKind`), and a player standing over a roaring brazier
   * had been as cold and as roughly rested as one standing in a field.
   */
  const byFire = (pos) => !!nearestFire(camps.map((c) => c.rec), pos, now())
    || hearthNear(worldFires(), pos, BY_FIRE_REACH);   // AUDIT HEARTH1 F2: the FIRST fire in reach, not the nearest - this runs every frame
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
    if (!survivalOn()) return null;
    // AUDIT SURV B: a MERGE by id, not a clear-and-stand - the save's list and a peer's memory join what stands
    for (const r of Array.isArray(list) ? list : []) {
      if (!r || typeof r !== 'object' || !Array.isArray(r.pos) || r.pos.length !== 3 || !(r.kind === CAMP_KIND.Tent || r.kind === CAMP_KIND.Fire)) continue;
      if (r.id != null && camps.some((c) => c.owner == null && c.rec.id === String(r.id))) continue;
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
    if (!survivalOn()) return null;
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
    placeItem, tick, batches, lights, draw, targets, hoverName, activate, openMenu, openCook, byFire, campAt,
    destroyAll, collectPixel, offsetAll, snapshot, restore, wireRecords, applyOwner, sweepOwners,
    get camps() { return camps; }, own,
  };
}

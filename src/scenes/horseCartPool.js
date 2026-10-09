// @ts-check
// HORSE CART AND CARGO - THE PRESENTATION (HCC, 2026-09-23). What the runtime (systems/horseCart.js) says, drawn:
// the trailing / following wagon and the parked one as the five pieces of classic model 41214 (systems/wagon41214.js
// - the body and shafts on the wagon's frame, each wheel turned about its own pivot), the cargo pieces the tier
// shows (WagonCargoVisual's twelve), and the horse as an eight-orientation billboard off the mod's own 45 PNGs
// (five drawn views, three mirrored - StationaryHorseBillboard). It also ANSWERS the runtime's physics
// (Physics.RaycastAll / SphereCast over the port's collider, the threats off the foe pool), stands the parked
// wagon's collider (the mod's non-trigger BoxCollider over the model's bounds - mine; another player's stands none,
// PR-WAGON1), hands the hosts their activation
// targets and hover names, and - HCC-ONLINE - draws every peer's wagon and horse off their `hv` records the way
// camps.js draws a peer's camps.
//
// deps = { renderer, meshes: { getGpuMesh, cpuModels }, collider() -> the host's, now() -> unscaled seconds,
//          threats() -> [[x,y,z]] (the qualifying foes' positions, CollectThreats), fetchFn, selfId(),
//          peerName(id) -> string | null, onChanged() (the host's online publish), toWire(p) (the scene-to-wire law, so
//          the change key is the WIRE's and a floating-origin rebase of mine is not a word),
//          peerAnchor(id) -> [x,y,z] | null (WAGON-HITCH: where that player's cart rider is drawn this frame, scene
//          frame - their trailing wagon hangs from it on its shafts here, as mine does there), log,
//          wagonKind() -> 'cart' | 'openWagon' | 'caravan' (WAGONS1: which wagon of mine is driven - systems/wagonKinds.js),
//          bakedWagon(kind) -> Promise<bake> | null (WAGONS1: Mac's wagon of that kind, src/assets/wagons/*.json - the
//          hosts' fetch; absent, the classic model 41214 stands for every kind, as before WAGONS1),
//          enterCaravan() (WAGONS1: my parked caravan's "Step inside" row - scenes/caravanRoom.js; absent, no row),
//          riders (WAGONS1: the seats in the back - scenes/wagonRiders.js: { passengers(), go(), declined() - my word's
//          `ps`, `go` and `pn`; acts(owner, kind, kept) -> plaque rows over another player's wagon; press(owner, id, distance) }),
//          wagonEntry() -> { entry, guild } | null (WAGONS2-VISIT: who may enter my caravan - the word's `we` and `wg`),
//          caravanEntry ({ row() -> label | null, turn() -> line | null } - WAGONS2-VISIT: my parked caravan's "Who may
//          enter" row, and its press), visit ({ may(target), enter(target) } - WAGONS2-VISIT: another's parked caravan whose
//          door is open to me, its "Step inside" row and press; absent, no row) }
//
// WAGONS1 (2026-10-09, Mac: "1. Is a replacement model for the current cart ingame 2. Theres an open wagon ... 3. Is a
// closed wagon varient"): THE WAGON DRAWN IS MAC'S. With the hosts' `bakedWagon` the parts are his Wagon Cart, Open
// Wagon or Caravan (world/wagonModels.js - their statics, each wheel on its pivot, the rear pair the parked solve's;
// painted under world/wagonArt.js's archive, which this pool uploads and owns), by the kind each owner drives: mine by
// `wagonKind`, a peer's by their word's `wk` (systems/horseCartWire.js). The cart is borne level on its axle while a
// horse is in its shafts and rests tipped on them when none is (`hitchPitch`), and every kind hangs its own length
// behind its horse (`hitchOf`). A bake that will not load or build falls back to the classic wagon for that kind, as a
// ship's does (systems/comeSailAwayModels.js).
import { GLOBAL_SCALE, RAY_DISTANCE, pickActivatableHit } from '../player/activate.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { multiply } from '../world/mat4.js';
import { mat4FromQuatPos, mat4FromQuatPosScale, quatAngleAxis, quatLookRotation, quatSlerp, quatForward, quatRotate, UNITY_QUAT_IDENTITY } from '../world/quat.js';
import { buildWagonParts, usableBounds, CARGO_DEFINITIONS, cargoPiecesShown } from '../systems/wagon41214.js';
import {
  WAGON_MODEL_ID, HORSE_VIEWS, HORSE_WALK_FRAMES, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_WALK_SPRITE_HEIGHT,
  calculateHorseOrientation, horseViewFor, horseTargetLabel, ACTIVATION_REACH, HORSE_BOX_CENTER, HORSE_BOX_SIZE,
  stepHorseWalk, freshHorseWalk, START_WALKING_SPEED, WAGON_MODE, HORSE_MODE,
  pickGround, STATIONARY_PROBE_HEIGHT, STATIONARY_PROBE_DISTANCE, GROUND_RETRY_SECONDS,   // DISC20-C: a peer's standing team, stood on my ground
  HITCHED_HORSE_LOCAL_Z, NORMAL_GROUND_OFFSET, GROUND_RAY_HEIGHT, GROUND_RAY_DISTANCE, TELEPORT_DISTANCE, ROTATION_SMOOTHING_RATE, POSITION_SMOOTHING_RATE,   // WAGON-HITCH
} from '../systems/horseCartLaw.js';
import { hitchAxle } from '../systems/horseFollow.js';   // WAGON-HITCH: the shafts' one law, for a peer's trailing wagon
import { DeployedWagonVisual } from '../systems/horseCart.js';   // DISC20-C: the mod's own two-wheel solve, for a peer's parked wagon
import { PARK_REACH, PARK_TTL_MS } from '../net/wire.js';   // HCC-PARK: how far a kept team's parts may stand from its anchor, and how long the relay keeps one
import { WAGON_HOVER_TEXT } from '../player/eotbWagon.js';   // the hover word for a wagon - the noun of Eye Of The Beholder's Info line, so both carts read alike
import { hccWireRecord, validHccRecord, hccRecordKey, easeToward, HCC_WIRE_KIND } from '../systems/horseCartWire.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toColor32 } from '../formats/color32Order.js';
import { wagonGeometry, buildBakedWagonParts, rendererModelOf, pitchedPoint } from '../world/wagonModels.js';   // WAGONS1: Mac's wagons
import { wagonArt, WAGON_ARCHIVE, wagonLookArt, isGlassRecord, LOOK_RECORDS, lookRecord } from '../world/wagonArt.js';
import { caravanRoomModel } from '../world/caravanRoomModel.js';   // WAGONS2: the caravan's room, seen through its windows
import { readWagonLook, wagonLookOfCode, WAGON_OUTSIDE_LOOKS, CARAVAN_INSIDE_LOOKS, CARAVAN_INSIDE_PARTS } from '../systems/wagonLooks.js';
import { validWagonKind, wagonHitchOf, WAGON_KINDS } from '../systems/wagonKinds.js';
import { CARAVAN_TEXT } from '../systems/caravanRoom.js';

/** The horse art's archive key and record names on the renderer's texture map: `hcc_h<view>` a standing view,
 *  `hcc_w<view>#<frame>` a walk frame (the foes' own `record#frame` folding, scenes/exteriorFoes.js). */
export const HORSE_ARCHIVE = 'hcc';
export const horseStillRecord = (view) => `h${view}`;
export const horseWalkRecord = (view, frame) => `w${view}#${frame}`;
/** StationaryHorseVisual.Initialize [IL_40b7-IL_40d9]: 121 x 0.025 by 94 (or 95, the walk set) x 0.025. */
export const HORSE_BILLBOARD_WIDTH = HORSE_SPRITE_WIDTH * GLOBAL_SCALE;
export const HORSE_BILLBOARD_HEIGHT = HORSE_SPRITE_HEIGHT * GLOBAL_SCALE;
export const HORSE_WALK_BILLBOARD_HEIGHT = HORSE_WALK_SPRITE_HEIGHT * GLOBAL_SCALE;
/** The parked wagon's collider bucket on the host's collider - skipped by the runtime's own ground probes. MY wagon's
 *  alone: PR-WAGON1 took AUDIT HCC O3's `hccWagon:<owner>` box away from another player's (targets(), below). */
export const WAGON_BUCKET = 'hccWagon';
/** WAGONS1: the plaque row that takes the player into their parked caravan (a row id the mod's modes never are). */
export const CARAVAN_ENTER_ROW = 'wagon:enter';
/** WAGONS2-VISIT (2026-10-09, Mac: "Like an online home"): "Step inside" another player's parked caravan whose door is
 *  open to me, and "Who may enter" on my own - row ids neither the mod's modes nor the riders' ('wagon:...') are. */
export const CARAVAN_VISIT_ROW = 'caravan:visit';
export const CARAVAN_ENTRY_ROW = 'caravan:entry';
/** The activation keys the hosts race. */
export const KEY_WAGON = 'hccWagon', KEY_FOLLOWING_WAGON = 'hccFollowingWagon', KEY_HORSE = 'hccHorse';
export { WAGON_HOVER_TEXT, HORSE_BOX_CENTER, HORSE_BOX_SIZE };   // the pool's callers read them here (the pins do)
export const peerKey = (owner, what) => `hccPeer:${owner}:${what}`;
/** HCC-TIP: the plaque's owner row for another player's horse or wagon. */
export const ownedLine = (who) => (who ? `Owned by ${who}` : 'Owned by another player');
/** HCC-PARK: how near (natives, either axis) an owner's live part must stand to a kept part to be the same one -
 *  ten metres: a parked team's rounding and a live word's ease, never a second team a street away. */
export const PARK_SAME_NATIVES = 400;
/** How many surfaces a RaycastAll answers before it stops looking (a ray through a town meets a handful). */
export const RAYCAST_ALL_MAX_HITS = 8;

const texturePath = (file) => new URL(`../../vendor/horse-cart-and-cargo/Textures/${file}`, import.meta.url).href;
const horseStillFile = (view) => `horse${view + 1}.png`;
const horseWalkFile = (view, frame) => `Walk.${view}-${frame + 1}.png`;
const WHEEL_AXIS = Object.freeze([1, 0, 0]);
const ZERO3 = Object.freeze([0, 0, 0]);
const HORSE_LOCAL_BOX = Object.freeze([
  HORSE_BOX_CENTER[0] - HORSE_BOX_SIZE[0] / 2, HORSE_BOX_CENTER[1] - HORSE_BOX_SIZE[1] / 2, HORSE_BOX_CENTER[2] - HORSE_BOX_SIZE[2] / 2,
  HORSE_BOX_CENTER[0] + HORSE_BOX_SIZE[0] / 2, HORSE_BOX_CENTER[1] + HORSE_BOX_SIZE[1] / 2, HORSE_BOX_CENTER[2] + HORSE_BOX_SIZE[2] / 2,
]);
const aabbOf = (box) => ({ min: [box[0], box[1], box[2]], max: [box[3], box[4], box[5]] });
const NO_SHADOW = Object.freeze({ noShadow: true });   // AUDIT WAGON-HITCH B2: renderer.drawMesh's option

/** The twelve triangles of a local box (the mod's BoxCollider over the model's bounds) for the collider. */
export function boxTriangles(min, max) {
  const p = [
    min[0], min[1], min[2], max[0], min[1], min[2], max[0], max[1], min[2], min[0], max[1], min[2],
    min[0], min[1], max[2], max[0], min[1], max[2], max[0], max[1], max[2], min[0], max[1], max[2],
  ];
  const i = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(p), indices: new Uint32Array(i) };
}

/** WAGON-HITCH x OW-BIG (2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld"): under
 *  the travel view the traveller is drawn `g` times their size about their feet (OW-BIG, tvOwnGrow - eight or nine
 *  times at the view's usual height), and a wagon drawn at its own size hung a speck under the grown horse's belly. A
 *  wagon on its shafts is grown with its team, about the point it hangs from: its axle `g` times as far from the
 *  hitch on the same line, the model `g` times its size, its wheels on the ground found there (`groundYAt`, the
 *  surface nearest the hitch's height; where none answers, the height it had). Only the DRAW grows - the pose the
 *  runtime keeps, parks, saves and sends stays the wagon's own, as the traveller's capsule does. Pure. */
export function grownHitchedPosition(position, hitch, g, groundYAt, baseY = position[1] - NORMAL_GROUND_OFFSET) {
  if (!(g > 1) || !hitch) return position;
  const x = hitch[0] + (position[0] - hitch[0]) * g, z = hitch[2] + (position[2] - hitch[2]) * g;
  // AUDIT WAGON-HITCH B1: the probe rises with the reach - the grown axle stands g hitch-lengths back, and ground that
  // climbs more than the mod's 8 m over that span put a fixed-height ray's origin under the hill, where the collider
  // meets nothing (it meets a floor only from above) and the wagon sank its own height into the slope
  const gy = groundYAt([x, hitch[1], z], Math.hypot(x - hitch[0], z - hitch[2]));
  const base = Number.isFinite(gy) ? gy : baseY;
  return [x, base + NORMAL_GROUND_OFFSET * g, z];
}

/** AUDIT WAGON-HITCH B7: a grown wheel turns `g` times slower for the same ground - its radius is `g` times the
 *  turned-by-travel wheel's. `state` is { last, acc } (null to start); answers the next state, whose `acc` is the angle
 *  to draw: the runtime's wrapped step since `last`, taken the short way and divided by `g`. Pure. */
export function grownWheelStep(state, angle, g) {
  if (!state) return { last: angle, acc: angle };
  const step = ((((angle - state.last) % 360) + 540) % 360) - 180;
  return { last: angle, acc: (((state.acc + step / (g > 1 ? g : 1)) % 360) + 360) % 360 };
}

/**
 * Physics.RaycastAll over the port's collider: every surface along the ray, nearest first, the parked wagon's own
 * bucket left out (the mod's IsIgnoredCollider). `surfaceHit` answers the nearest mesh-or-terrain hit; the ray is
 * re-cast from just past each hit until nothing answers or the budget is spent.
 * @returns {{ point:number[], distance:number, normal:number[] }[]}
 */
export function raycastAllOver(col, origin, dir, maxDist, skip = [WAGON_BUCKET]) {
  const hits = [];
  if (!col?.surfaceHit) return hits;
  const filter = skip.length ? { skip } : null;
  let travelled = 0;
  let o = [origin[0], origin[1], origin[2]];
  for (let n = 0; n < RAYCAST_ALL_MAX_HITS && travelled < maxDist; n++) {
    const h = col.surfaceHit(o, dir, maxDist - travelled, filter);
    if (!h || !Number.isFinite(h.dist)) break;
    const d = travelled + h.dist;
    hits.push({ point: [origin[0] + dir[0] * d, origin[1] + dir[1] * d, origin[2] + dir[2] * d], distance: d, normal: h.normal ?? [0, 1, 0] });
    const step = h.dist + 1e-3;
    travelled += step;
    o = [o[0] + dir[0] * step, o[1] + dir[1] * step, o[2] + dir[2] * step];
  }
  return hits;
}

export function createHorseCartPool({
  renderer = null, meshes = null, collider = () => null, now = () => performance.now() / 1000, threats = () => [],
  fetchFn = null, decode = decodePng, selfId = () => null, peerName = (/** @type {string} */ _id) => null, onChanged = null,
  toWire = (/** @type {number[]} */ p) => p, log = console,
  peerAnchor = (/** @type {string} */ _id) => /** @type {number[] | null} */ (null),
  wagonKind = () => 'cart', bakedWagon = /** @type {((kind: string) => Promise<any>) | null} */ (null),
  wagonLook = /** @type {() => any} */ (() => null),
  enterCaravan = /** @type {(() => any) | null} */ (null),
  riders = /** @type {any} */ (null),
  wagonEntry = /** @type {() => any} */ (() => null),
  caravanEntry = /** @type {any} */ (null),
  visit = /** @type {any} */ (null),
} = {}) {
  /** @type {any} */ let runtime = null;
  let enabled = true;   // the mod's Enabled switch: off, nothing of the mod stands, draws, answers the ray or rides the wire
  // the wagon: the five part meshes, the cargo meshes, the collider's box
  let _parts = null;         // buildWagonParts' result plus gpu handles: { ..., gpu: { body, shaftLeft, shaftRight, wheelLeft, wheelRight }, box }
  let _partsLoading = null, _partsFailed = null;
  const _cargo = new Map();  // modelId -> gpu | null
  const _cargoLoading = new Map();
  let _bucketKey = null;     // the pose the parked wagon's collider stands at
  // the horse art
  let _stillLoading = null, _stillReady = false, _stillFailed = false;
  let _walkLoading = null, _walkReady = false, _walkFailed = false;
  // the billboards: mine and the peers'
  const _horseBatches = new Map();   // owner ('' mine) -> batch
  // the peers: owner -> { wire: { w, h } (the validated record, WIRE frame), toScene, wagon, horse (this frame's targets,
  // SCENE frame), name, at, shownWagon, shownRotation, shownHorse, walk (the reader's own stride), ground (DISC20-C:
  // where the word stands on my ground - groundPeer) }
  const _peers = new Map();
  const _live = new Map();   // HCC-PARK: owner -> their live word { w, h, n, toScene, at } (the foes frame's `hv`)
  const _kept = new Map();   // HCC-PARK: `${room}|${k}` -> a cell's kept word { room, k, id, w, h, n, name, expires, toScene, seq } (the relay's memory; AUDIT HCC-PARK: per ROOM and per owner KEY, so one cell's word never unsays another's)
  let _keptSeq = 0;
  let _lastKey = '';

  const fetchPng = async (file) => {
    const f = fetchFn ?? globalThis.fetch;
    const res = await f(texturePath(file));
    if (!res?.ok) throw new Error(`${file}: HTTP ${res?.status}`);
    return toColor32(await decode(new Uint8Array(await res.arrayBuffer())));
  };

  // ── the wagon's meshes (DeployedWagonVisual.Initialize's CreateDaggerfallMeshGameObject(41214) + TryBuild)
  function ensureParts() {
    if (_parts || _partsLoading || _partsFailed || !meshes?.getGpuMesh) return;
    _partsLoading = Promise.resolve(meshes.getGpuMesh(WAGON_MODEL_ID)).then((gpu) => {
      const cpu = meshes.cpuModels?.get?.(WAGON_MODEL_ID);
      if (!gpu || !cpu) throw new Error('DFU returned no object for vanilla wagon model 41214');
      const parts = buildWagonParts(cpu);
      const up = (m) => (renderer?.createMesh ? renderer.createMesh(m) : null);
      _parts = { ...parts, gpu: { body: up(parts.body), shaftLeft: up(parts.shaftLeft), shaftRight: up(parts.shaftRight), wheelLeft: up(parts.wheelLeft), wheelRight: up(parts.wheelRight) }, box: [...parts.bounds.min, ...parts.bounds.max] };
      for (const d of CARGO_DEFINITIONS) ensureCargo(d.modelId);
      onChanged?.();
    }).catch((e) => { _partsFailed = e?.message ?? String(e); log?.error?.(`[TrailingWagon] the wagon's mesh would not build: ${_partsFailed}`); }).finally(() => { _partsLoading = null; });
  }
  function ensureCargo(modelId) {
    if (_cargo.has(modelId) || _cargoLoading.has(modelId) || !meshes?.getGpuMesh) return;
    _cargoLoading.set(modelId, Promise.resolve(meshes.getGpuMesh(modelId)).then((gpu) => { _cargo.set(modelId, gpu ?? null); }).catch(() => { _cargo.set(modelId, null); }).finally(() => _cargoLoading.delete(modelId)));
  }
  // ── WAGONS1: Mac's wagons, by kind (world/wagonModels.js), their pictures uploaded once and owned here
  const _baked = new Map();   // kind -> { parts (buildBakedWagonParts + gpu + box) | null, loading, failed }
  let _wagonArtUp = false;
  function ensureWagonArt() {
    if (_wagonArtUp || !renderer?.uploadTexture) return;
    _wagonArtUp = true;
    for (const [rec, pic] of wagonArt()) uploadWagonPicture(rec, pic);
  }
  /** One of the wagons' pictures: opaque as a model's is (dataPipeline.js uploadRecord's), but a CUT-OUT where it holds
   *  glass (WAGONS2: the caravan's windows, outside and in - world/wagonArt.js isGlassRecord). */
  function uploadWagonPicture(rec, pic) {
    renderer.uploadTexture(WAGON_ARCHIVE, rec, toColor32(pic), isGlassRecord(rec) ? { cutout: true } : { opaque: true });
  }
  // ── WAGONS2: a paint's pictures, painted and uploaded the first time a wagon wears it, and the remap it is drawn by
  const _lookUp = new Set();   // `${list}:${i}` painted and uploaded
  const _remaps = new Map();   // `${kind}:${code}` -> the body's remap; `room:${code}` -> the room's
  function ensureLook(list, i, names) {
    if (!(i > 0) || !renderer?.uploadTexture || _lookUp.has(`${list}:${i}`)) return;
    _lookUp.add(`${list}:${i}`);
    for (const [rec, pic] of wagonLookArt(list, i, names[i])) uploadWagonPicture(rec, pic);
  }
  /** The remap a wagon of `kind` wearing `look` is drawn by: each built record its paint repaints, to the paint's
   *  (null for the wagon as built - its own pictures, no remap). `room` the caravan's inside's instead of its outside's. */
  function lookRemap(kind, look, room = false) {
    const l = readWagonLook(look), k = validWagonKind(kind) ?? 'cart';
    const lists = room ? CARAVAN_INSIDE_PARTS.map((part) => [part, l[part[0]], CARAVAN_INSIDE_LOOKS[part]]) : [[k, l.o, WAGON_OUTSIDE_LOOKS[k]]];
    if (lists.every(([, i]) => !i)) return null;
    const key = room ? `room:${l.w}.${l.f}.${l.c}` : `${k}:${l.o}`;
    let map = _remaps.get(key);
    if (!map) {
      map = new Map();
      for (const [list, i, names] of lists) {
        ensureLook(list, i, names);
        for (const rec of LOOK_RECORDS[list]) if (i) map.set(`${WAGON_ARCHIVE}_${rec}`, `${WAGON_ARCHIVE}_${lookRecord(rec, i)}`);
      }
      _remaps.set(key, map);
    }
    return map;
  }
  let _roomGpu;   // WAGONS2: the caravan's room (world/caravanRoomModel.js), built once on the built pictures
  const roomGpu = () => (_roomGpu === undefined ? (_roomGpu = renderer?.createMesh ? renderer.createMesh(caravanRoomModel()) : null) : _roomGpu);
  function loadBaked(kind) {
    const e = { parts: null, loading: null, failed: null };
    _baked.set(kind, e);
    e.loading = Promise.resolve().then(() => bakedWagon(kind)).then((bake) => {
      const parts = buildBakedWagonParts(wagonGeometry(bake), rendererModelOf);
      const up = (m) => (m && renderer?.createMesh ? renderer.createMesh(m) : null);
      ensureWagonArt();
      e.parts = { ...parts, gpu: { body: up(parts.body), wheels: parts.wheels.map((w) => ({ gpu: up(w.model), pivot: w.pivot })) }, box: [...parts.bounds.min, ...parts.bounds.max] };
      for (const d of parts.cargo) ensureCargo(d.modelId);
      onChanged?.();
    }).catch((err) => {
      e.failed = err?.message ?? String(err);
      log?.warn?.(`[TrailingWagon] the ${kind} model would not build, the classic wagon stands for it: ${e.failed}`);
      ensureParts();
    }).finally(() => { e.loading = null; });
  }
  /** The parts a wagon of `kind` is drawn by: Mac's once built, the classic wagon where there is no bake or it failed;
   *  null while either is still building (the runtime retries every second, the draw waits). */
  function partsOf(kind = myKind()) {
    const k = validWagonKind(kind) ?? 'cart';
    if (bakedWagon) {
      const e = _baked.get(k);
      if (!e) { loadBaked(k); return null; }
      if (e.parts) return e.parts;
      if (!e.failed) return null;
    }
    ensureParts();
    return _parts;
  }
  const myKind = () => validWagonKind(wagonKind?.()) ?? 'cart';
  /** WAGONS2: my driven wagon's paint (systems/wagonLooks.js), checked. */
  const myLook = () => readWagonLook(wagonLook?.());
  /** How far ahead of a wagon's rear axle its horse stands: the kind's own when Mac's wagon is drawn, the mod's 3.1
   *  for the classic one (HITCHED_HORSE_LOCAL_Z). */
  function hitchOf(kind = myKind()) {
    const k = validWagonKind(kind) ?? 'cart';
    return bakedWagon && !_baked.get(k)?.failed ? wagonHitchOf(k) : HITCHED_HORSE_LOCAL_Z;
  }
  /** The runtime's `presentation.wagonParts()`: the pivots, the radius and the bounds once the mesh is up, else null (it retries every second). */
  function wagonParts() { return partsOf(myKind()); }

  // ── the horse art (HorseTextureSet.TryLoad / HorseWalkAnimationSet.TryLoad)
  function ensureStationary() {
    if (_stillReady) return true;
    if (_stillFailed || _stillLoading || !renderer?.uploadTexture) return false;
    _stillLoading = Promise.all(Array.from({ length: HORSE_VIEWS }, (_, v) => fetchPng(horseStillFile(v)).then((px) => {
      renderer.uploadTexture(HORSE_ARCHIVE, horseStillRecord(v), px);
    }))).then(() => { _stillReady = true; onChanged?.(); }).catch((e) => { _stillFailed = true; log?.error?.(`[TrailingWagon] the horse art would not load: ${e?.message ?? e}`); }).finally(() => { _stillLoading = null; });
    return false;
  }
  function ensureWalk() {
    if (_walkReady || _walkFailed || _walkLoading || !renderer?.uploadTexture) return;   // AUDIT 68 S27-hcc-walk-fetch-storm: a failed set is not fetched again every frame - TryLoad fails once, as the stills do
    const jobs = [];
    for (let v = 0; v < HORSE_VIEWS; v++) for (let f = 0; f < HORSE_WALK_FRAMES; f++) jobs.push(fetchPng(horseWalkFile(v, f)).then((px) => renderer.uploadTexture(HORSE_ARCHIVE, horseWalkRecord(v, f), px)));
    _walkLoading = Promise.all(jobs).then(() => { _walkReady = true; }).catch((e) => { _walkFailed = true; log?.warn?.(`[TrailingWagon] the horse walk frames would not load; the standing views stay: ${e?.message ?? e}`); }).finally(() => { _walkLoading = null; });
  }
  const horseArt = { ensureStationary, ensureWalk, hasWalk: () => _walkReady };

  // ── the runtime's physics
  const phys = {
    now,
    raycastAll: (origin, dir, maxDist) => raycastAllOver(collider(), origin, dir, maxDist),
    sphereCastClear: (origin, radius, dir, distance) => { const col = collider(); if (!col?.sphereCast) return true; const h = col.sphereCast(origin, radius, dir, distance, { skip: [WAGON_BUCKET] }); return !(h.dist < distance); },
    threats: () => threats() ?? [],
  };

  // ── the parked wagon's collider (the root's non-trigger BoxCollider over the source mesh's bounds)
  /** Stand (or take down) one wagon's box under `bucket` at matrix `m`; answers the pose key it now stands at
   *  (null: nothing stands, so the next call tries again). */
  /** The box stands again only when its matrix moved past a millimetre - compared number by number (AUDIT HCC, the
   *  branch audit: a sixteen-string key was built and joined every frame for every parked wagon). */
  const sameMatrix = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) >= 5e-4) return false; return true; };
  function standBox(bucket, m, prevKey, parts = partsOf(myKind())) {
    const col = collider();
    if (!col?.addMesh || !parts) return prevKey;
    if (m ? sameMatrix(m, prevKey) : prevKey === null) return prevKey;
    const key = m ? Float64Array.from(m) : null;
    col.removeBucket?.(bucket);
    if (!m) return null;
    const b = usableBounds(parts.bounds);   // EnsureUsableBoundsSize [IL_10f1]
    const tri = boxTriangles(b.min, b.max);
    col.addMesh(bucket, tri.positions, tri.indices, m);
    return key;
  }
  function standWagonCollider(m) { _bucketKey = standBox(WAGON_BUCKET, m, _bucketKey); }

  // ── matrices
  const wagonMatrix = (position, rotation) => mat4FromQuatPos(rotation, position);
  const wheelMatrix = (m, pivot, angle) => multiply(m, mat4FromQuatPos(quatAngleAxis(angle, WHEEL_AXIS), pivot));
  const cargoMatrix = (m, def) => multiply(m, mat4FromQuatPosScale(def.rotation, def.position, def.scale));

  /** WAGONS1: a wagon's body under the cart's hitched tilt - nose up about its axle by `pitch` degrees. */
  const pitchedMatrix = (m, parts, pitch) => {
    if (!pitch || !parts?.axlePivot) return m;
    const a = parts.axlePivot;
    return multiply(multiply(m, mat4FromQuatPos(quatAngleAxis(-pitch, WHEEL_AXIS), a)), mat4FromQuatPos(UNITY_QUAT_IDENTITY, [-a[0], -a[1], -a[2]]));
  };
  /** One wagon - mine or a peer's - in the host's world pass. `scale` is WAGON-HITCH x OW-BIG's grown draw (1 off it);
   *  a grown wagon casts no shadow (AUDIT WAGON-HITCH B2 - OW-BIG's law for every grown figure). WAGONS1: `kind` the
   *  wagon's (its parts), `hitched` whether a horse is in its shafts (the cart borne level). WAGONS2: `look` its paint
   *  (systems/wagonLooks.js - a look or its wire code), its body and wheels drawn on the paint's pictures; and a
   *  caravan's room inside its body, seen through its windows (world/caravanRoomModel.js - casting no shadow: the body
   *  casts the caravan's). */
  function drawWagon(r, texRemap, position, rotation, tier, angle, scale = 1, kind = myKind(), hitched = false, look = null) {
    const parts = partsOf(kind);
    if (!parts?.gpu?.body || !r?.drawMesh) return false;
    const grown = scale > 1;
    const m = grown ? mat4FromQuatPosScale(rotation, position, [scale, scale, scale]) : wagonMatrix(position, rotation);
    const g = parts.gpu;
    const o = grown ? NO_SHADOW : undefined;
    if (g.wheels) {
      const pitch = hitched ? parts.hitchPitch ?? 0 : 0;
      const body = pitchedMatrix(m, parts, pitch);
      const l = typeof look === 'number' ? wagonLookOfCode(look) : readWagonLook(look);
      const paint = lookRemap(kind, l) ?? texRemap;
      r.drawMesh(g.body, body, paint, o);
      if (parts.kind === 'caravan') { const room = roomGpu(); if (room) r.drawMesh(room, body, lookRemap(kind, l, true) ?? texRemap, NO_SHADOW); }
      for (const w of g.wheels) if (w.gpu) r.drawMesh(w.gpu, wheelMatrix(m, w.pivot, angle), paint, o);
      for (const def of parts.cargo) if (tier >= def.threshold) { const gpu = _cargo.get(def.modelId); if (gpu) r.drawMesh(gpu, cargoMatrix(body, def), texRemap, o); }
      return true;
    }
    r.drawMesh(g.body, m, texRemap, o);
    if (g.shaftLeft) r.drawMesh(g.shaftLeft, m, texRemap, o);
    if (g.shaftRight) r.drawMesh(g.shaftRight, m, texRemap, o);
    if (g.wheelLeft) r.drawMesh(g.wheelLeft, wheelMatrix(m, parts.wheelLeftPivot, angle), texRemap, o);
    if (g.wheelRight) r.drawMesh(g.wheelRight, wheelMatrix(m, parts.wheelRightPivot, angle), texRemap, o);
    for (const def of cargoPiecesShown(tier)) { const gpu = _cargo.get(def.modelId); if (gpu) r.drawMesh(gpu, cargoMatrix(m, def), texRemap, o); }
    return true;
  }
  /** AUDIT WAGON-HITCH B7: each grown wagon's wheel clock (owner, '' mine), dropped when it is no longer grown. */
  const _grownWheels = new Map();
  function grownAngle(key, angle, g) {
    if (!(g > 1)) { _grownWheels.delete(key); return angle; }
    const next = grownWheelStep(_grownWheels.get(key) ?? null, angle, g);
    _grownWheels.set(key, next);
    return next.acc;
  }

  /** What the runtime shows this frame, in one shape (the wire's, the draw's, the targets'). */
  function shown() {
    if (!runtime || !enabled) return null;
    const v = runtime.view();
    let wagon = null;
    if (v.deployed?.isGrounded) wagon = { kind: HCC_WIRE_KIND.Deployed, position: v.deployed.position, rotation: v.deployed.rotation, tier: v.deployed.cargoTier, angle: 0, hitched: v.state?.HorseMode === HORSE_MODE.HitchedToWagon };
    else if (v.moving?.pose?.active) wagon = { kind: v.teamFollowing ? HCC_WIRE_KIND.Following : HCC_WIRE_KIND.Trailing, position: v.moving.pose.position, rotation: v.moving.pose.rotation, tier: v.moving.cargoTier, angle: v.moving.wheel?.angle ?? 0, hitch: v.moving.pose.hitch ?? null, axle: v.moving.pose.axle ?? null, hitched: true };   // WAGON-HITCH: the point it hangs from and where its wheels stand (the draw's grow; the wire carries neither)
    if (wagon) { wagon.model = myKind(); wagon.passengers = riders?.passengers?.() ?? []; }   // WAGONS1: which of the three it is (the draw's parts, the wire's `wk`), and who rides in its back
    if (wagon) wagon.look = myLook();   // WAGONS2: its paint (the wire's `wl`)
    const entry = wagon ? wagonEntry?.() : null;   // WAGONS2-VISIT: who may enter it (the wire's `we`, and the guild's `wg`)
    if (entry) { wagon.entry = entry.entry; wagon.guild = entry.guild ?? null; }
    const h = v.horse;
    const horse = h?.isInteractive ? { position: h.position, forward: h.forward, frame: h.walk?.animationFrame ?? 0, walking: !!h.walk?.walking } : null;
    return { wagon, horse, name: v.state?.HorseName ?? '', interaction: !!v.moving?.interaction, deployed: !!v.deployed?.isGrounded, go: riders?.go?.() ?? null, declined: riders?.declined?.() ?? [] };   // WAGONS1: a journey my riders go on, who I turned away
  }

  // ── the horse billboards
  function horseBatch(owner) {
    let b = _horseBatches.get(owner);
    if (b || !renderer?.createBillboardBatch) return b ?? null;
    b = renderer.createBillboardBatch(HORSE_ARCHIVE, horseStillRecord(0), { w: HORSE_BILLBOARD_WIDTH, h: HORSE_BILLBOARD_HEIGHT }, [[0, 0, 0]]);
    b.origin = [0, 0, 0];
    _horseBatches.set(owner, b);
    return b;
  }
  function dropHorseBatch(owner) { const b = _horseBatches.get(owner); if (b) { renderer?.destroyBillboardBatch?.(b); _horseBatches.delete(owner); } }
  /** StationaryHorseBillboard.LateUpdate: the orientation off the camera, the view and the flip, the frame. */
  function poseHorseBatch(b, cameraPos, horse) {
    const view = horseViewFor(calculateHorseOrientation(cameraPos, horse.position, horse.forward));
    if (!view) return;
    const walk = _walkReady;
    b.record = walk ? horseWalkRecord(view.view, horse.frame) : horseStillRecord(view.view);
    const h = walk ? HORSE_WALK_BILLBOARD_HEIGHT : HORSE_BILLBOARD_HEIGHT;
    b.size = { w: view.flip ? -HORSE_BILLBOARD_WIDTH : HORSE_BILLBOARD_WIDTH, h };
    b.origin[0] = horse.position[0]; b.origin[1] = horse.position[1]; b.origin[2] = horse.position[2];
  }

  /** The frame: the runtime's LateUpdate, then the collider and the billboards after what it decided. */
  /** One frame. `dt` real seconds (the peers' easing and strides - another player's team keeps moving while my
   *  window is open); `gameDt` Unity's Time.deltaTime for MY runtime [IL_1dac, IL_5d8d, IL_37c3]: zero while the game
   *  is paused, scaled with the world's time (AUDIT HCC, the branch audit - a following horse walked on under an open
   *  inventory, and a Travel Options journey left the trailing wagon 15 m behind the cart). */
  let peerLook = null;   // AUDIT (pre-merge) I-B: setPeerLook's
  function frame(dt, cameraPos, gameDt = dt) {
    if (!enabled) { if (_horseBatches.size || _peers.size || _bucketKey) destroyAll(); return; }
    runtime?.lateUpdate(gameDt);
    const s = shown();
    if (s?.wagon) partsOf(s.wagon.model);   // a wagon shown before the runtime asked for the parts (a peer's, a restored one) starts the build
    if (s?.deployed && s.wagon && partsOf(myKind())) standWagonCollider(wagonMatrix(s.wagon.position, s.wagon.rotation)); else standWagonCollider(null);
    if (s?.horse && _stillReady) { const b = horseBatch(''); if (b) poseHorseBatch(b, cameraPos, s.horse); } else dropHorseBatch('');
    for (const [owner, p] of _peers) {
      const look = peerLook?.(owner) ?? null;   // AUDIT (pre-merge) I-B: 'hidden', a concealed look, or null
      p.hidden = look === 'hidden'; p.look = p.hidden ? null : look;
      groundPeer(p);   // DISC20-C: a parked wagon and a standing horse, on MY ground
      retarget(p);   // AUDIT HCC O1: the wire frame, converted THIS frame - a rebase or a re-anchor of mine moves nothing of theirs
      if (p.horse) {
        const was = p.shownHorse;
        p.shownHorse = easeToward(p.shownHorse, p.horse.position, dt);
        // AUDIT HCC O5: the stride is the READER's (HorseWalkAnimationState over the shown pace), the owner says only
        // whether it walks - a frame on the wire changed the word twice a second while the horse merely stood
        const pace = was && dt > 0 ? Math.hypot(p.shownHorse[0] - was[0], p.shownHorse[2] - was[2]) / dt : 0;
        p.walk = stepHorseWalk(p.walk, p.horse.walking ? Math.max(pace, 2 * START_WALKING_SPEED) : 0, dt, _walkReady);
        // AUDIT (the pre-merge audit, I-B): the owner's concealment (INVIS-NET/INVIS-LOOK) is its team's - a horse the
        // classic lane's hidden owner leads stands nowhere, and the enhanced lane's is drawn in the owner's own look
        if (_stillReady && !p.hidden) { const b = horseBatch(owner); if (b) { poseHorseBatch(b, cameraPos, { ...p.horse, position: p.shownHorse, frame: p.walk.animationFrame }); b.conceal = p.look; } }
        else if (p.hidden) dropHorseBatch(owner);
      } else { dropHorseBatch(owner); p.walk = freshHorseWalk(); }
      const anchor = p.wagon?.kind === HCC_WIRE_KIND.Trailing && !p.hidden ? peerAnchor(p.ownerId ?? owner) : null;
      if (anchor) hitchPeerWagon(p, anchor, dt);   // WAGON-HITCH: their cart's wagon on its shafts from their rider as drawn HERE
      else if (p.wagon) { p.hitch = null; p.shownUp = null; p.shownWagon = easeToward(p.shownWagon, p.wagon.position, dt); p.shownRotation = p.shownRotation ? quatSlerp(p.shownRotation, p.wagon.rotation, 1 - Math.exp(-12 * dt)) : [...p.wagon.rotation]; }
    }
    // HCC-ONLINE: a moved word asks for a frame (the host's stream reads `dirty`); a full frame carries it regardless.
    // AUDIT HCC O5: keyed in the WIRE frame, so my own rebase is not a word
    const key = hccRecordKey(hccWireRecord(s, toWire));
    if (key !== _lastKey) { _lastKey = key; onChanged?.(); }
  }
  /** WAGON-HITCH: a peer's TRAILING wagon hangs from their rider as this client draws them (`peerAnchor` - their eased
   *  pose, the one peerRiders stands the rider on), by the shafts' own law: the owner's wagon is on its shafts at the
   *  owner's, but here their rider eases over a send interval and the wagon's word comes on its own clock, so easing the
   *  two apart pulled the wagon off the horse at speed. The height is the word's, eased; the tilt is the word's ground,
   *  the facing toward the rider. An anchor that leapt past the mod's 20 m starts again from the word. */
  function hitchPeerWagon(p, anchor, dt) {
    const word = p.wagon.position;
    const far = !p.shownWagon || Math.hypot(p.shownWagon[0] - anchor[0], p.shownWagon[2] - anchor[2]) > TELEPORT_DISTANCE;
    const from = far ? word : p.shownWagon;
    const { axle, dir } = hitchAxle(from, anchor, hitchOf(p.wagon.model), quatForward(p.wagon.rotation));   // WAGONS1: their wagon's own length
    const wordUp = quatRotate(p.wagon.rotation, [0, 1, 0]);
    // AUDIT WAGON-HITCH B4: the height of the ground the axle stands on HERE (the word's height belonged to where the
    // owner's wagon stood, which the shafts have moved it off), eased at the mod's 12 as the owner's is; no ground
    // built here yet, the word's, eased
    const gy = groundYAt([axle[0], word[1], axle[2]], 0);
    const target = Number.isFinite(gy) ? gy + NORMAL_GROUND_OFFSET * Math.max(0, wordUp[1]) : word[1];
    const y = far ? target : p.shownWagon[1] + (target - p.shownWagon[1]) * (1 - Math.exp(-POSITION_SMOOTHING_RATE * Math.max(0, dt)));
    p.shownWagon = [axle[0], y, axle[2]];
    const t = far || !p.shownUp ? 1 : 1 - Math.exp(-ROTATION_SMOOTHING_RATE * dt);
    const u = p.shownUp ? [p.shownUp[0] + (wordUp[0] - p.shownUp[0]) * t, p.shownUp[1] + (wordUp[1] - p.shownUp[1]) * t, p.shownUp[2] + (wordUp[2] - p.shownUp[2]) * t] : wordUp;
    const ul = Math.hypot(u[0], u[1], u[2]);
    const up = ul > 1e-6 ? [u[0] / ul, u[1] / ul, u[2] / ul] : [0, 1, 0];
    const d = dir[0] * up[0] + dir[1] * up[1] + dir[2] * up[2];
    const f = [dir[0] - up[0] * d, dir[1] - up[1] * d, dir[2] - up[2] * d];
    const fl = Math.hypot(f[0], f[1], f[2]);
    p.shownUp = up;
    p.shownRotation = quatLookRotation(fl > 1e-6 ? [f[0] / fl, f[1] / fl, f[2] / fl] : dir, up);
    p.hitch = [anchor[0], anchor[1], anchor[2]];
  }
  /** WAGON-HITCH x OW-BIG: the ground at `q` - the mod's own probe (8 m over the reference height, 40 m down, the
   *  surface nearest that height), my wagon's box left out; `rise` more metres up and twice as far down (AUDIT B1: a
   *  grown axle's reach, so a hill the length of a grown wagon does not swallow the ray's origin). */
  const groundYAt = (q, rise = 0) => pickGround(phys.raycastAll([q[0], q[1] + GROUND_RAY_HEIGHT + rise, q[2]], [0, -1, 0], GROUND_RAY_DISTANCE + 2 * rise), q[1])?.point?.[1] ?? null;
  const batches = () => [..._horseBatches.values()];
  /** The world pass. WAGON-HITCH x OW-BIG: under the travel view the host says how far the traveller is grown
   *  (`selfGrow`, the view's own step) and how far another player is at a point (`grow`, OW-PEERS' peerGrow); a cart's
   *  trailing wagon - mine and theirs - is drawn grown with its rider about the hitch. A parked wagon and a following
   *  team are world objects beside a horse billboard drawn at its own size, and stay at theirs. */
  function draw(r = renderer, texRemap = null, { selfGrow = 1, grow = null } = {}) {
    let n = 0;
    const s = shown();
    if (s?.wagon) {
      const g = s.wagon.kind === HCC_WIRE_KIND.Trailing && s.wagon.hitch ? selfGrow : 1;
      // AUDIT WAGON-HITCH A1 x B: grown from where its wheels stand (the drawn position leans downhill on a slope, and
      // grown that lean is g times as long)
      const at = g > 1 && s.wagon.axle ? grownHitchedPosition(s.wagon.axle, s.wagon.hitch, g, groundYAt, s.wagon.axle[1]) : grownHitchedPosition(s.wagon.position, s.wagon.hitch, g, groundYAt);
      if (drawWagon(r, texRemap, at, s.wagon.rotation, s.wagon.tier, grownAngle('', s.wagon.angle, g), g, s.wagon.model, s.wagon.hitched, s.wagon.look)) n++;
    } else _grownWheels.delete('');
    for (const [owner, p] of _peers) {
      if (!p.wagon || !p.shownWagon || (p.hidden && p.wagon.kind !== HCC_WIRE_KIND.Deployed)) continue;   // AUDIT (pre-merge) I-B: a hidden owner's trailing or following wagon rolls unseen with it; a parked one is a wagon in the world
      const g = p.hitch && grow ? grow(p.hitch) : 1;
      if (drawWagon(r, texRemap, grownHitchedPosition(p.shownWagon, p.hitch, g, groundYAt), p.shownRotation ?? p.wagon.rotation, p.wagon.tier, grownAngle(owner, p.wagon.angle, g), g, p.wagon.model, p.wagon.kind !== HCC_WIRE_KIND.Deployed || p.wagon.hitched, p.wagon.look)) n++;
    }
    return n;
  }

  // ── the ray: the activation targets (RegisterCustomActivation at 3.2 - the runtime's ACTIVATION_REACH)
  const horseBox = (horse) => transformedAabb(HORSE_LOCAL_BOX, mat4FromQuatPos(quatLookRotation(horse.forward), horse.position));
  function targets() {
    const out = [];
    const s = shown();
    const mine = s?.wagon ? partsOf(s.wagon.model) : null;
    if (s?.wagon && mine) {
      const box = transformedAabb(mine.box, wagonMatrix(s.wagon.position, s.wagon.rotation));
      if (s.wagon.kind === HCC_WIRE_KIND.Deployed) out.push({ key: KEY_WAGON, aabb: aabbOf(box), distance: RAY_DISTANCE, reach: ACTIVATION_REACH });
      else if (s.wagon.kind === HCC_WIRE_KIND.Following && s.interaction) out.push({ key: KEY_FOLLOWING_WAGON, aabb: aabbOf(box), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true });
    }
    if (s?.horse) out.push({ key: KEY_HORSE, aabb: aabbOf(horseBox(s.horse)), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true });
    for (const [owner, p] of _peers) {
      // PR-WAGON1 (2026-09-24, a player's report Mac relayed: "Players can grief other players with the wagon by
      // putting it in front of dungeon entryways and building entrances"; Mac's choice: "Others' wagons don't
      // block"): ANOTHER PLAYER'S TEAM NEVER STOPS ME. AUDIT HCC O3 stood a peer's parked wagon a box in my collider,
      // and HCC-PARK keeps a parked team for 72 hours after its owner leaves - so a wagon left across a shop door or
      // a dungeon's mouth walled it off for everyone for days, and shadowed the door from the ray besides. Their
      // wagon and horse stand NO collider here, live or kept, parked or moving (mine keeps the mod's BoxCollider,
      // WAGON_BUCKET: it is mine to move), so the wagon has no surface for the ray to meet either; and both are
      // marked to YIELD the ray (player/activate.js firmFirst holds the law): the door, the body, the person behind
      // them takes the click, and with nothing else on the ray they are still named and pressed (HCC-TIP's "Owned
      // by ...").
      // AUDIT BRANCH-0925 PRW1-A: with no box of theirs the ray meets the wagon's OWN turned box (`obb`, DISC10 - as
      // Eye Of The Beholder's cart, player/eotbWagon.js). The square box around a slanted wagon bulges past it at every
      // corner, and an eye in a corner (a crouch beside it) read as INSIDE and was dropped by CASTLE1's no-surface
      // rule - while from further off the corner's empty road was measured as the wagon.
      const theirs = p.wagon && p.shownWagon ? partsOf(p.wagon.model) : null;
      if (theirs) {
        const pm = wagonMatrix(p.shownWagon, p.shownRotation ?? p.wagon.rotation);
        out.push({ key: peerKey(owner, 'w'), aabb: aabbOf(transformedAabb(theirs.box, pm)), obb: { m: pm, box: theirs.box }, distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true, yields: true });
      }
      // AUDIT HCC O9: a horse not drawn (its art still loading, or failed) is not named or pressed
      if (p.horse && p.shownHorse && _stillReady) out.push({ key: peerKey(owner, 'h'), aabb: aabbOf(horseBox({ ...p.horse, position: p.shownHorse })), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true, yields: true });
    }
    return out;
  }
  const peerOfKey = (key) => { if (typeof key !== 'string' || !key.startsWith('hccPeer:')) return null; const i = key.lastIndexOf(':'); return { owner: key.slice(8, i), what: key.slice(i + 1) }; };
  /** ACT-MENU: a word with the runtime's verbs for it, when it has any (none while the mod is not ready). */
  const withActions = (named, target) => { const actions = runtime?.actionRows?.(target) ?? []; return actions.length ? { ...named, actions } : named; };
  /** WAGONS1: the plaque's word for a wagon - the mod's "Wagon" for the Small Cart, each bigger one by its own name. */
  const wagonTitle = (kind) => (validWagonKind(kind) && kind !== 'cart' ? WAGON_KINDS[kind].name : WAGON_HOVER_TEXT);
  /** WAGONS1: my parked caravan's door - "Step inside" after the mod's own rows (its storage stays "Open the wagon"). */
  const withCaravanRow = (named, parked = true) => (parked && enterCaravan && WAGON_KINDS[myKind()]?.enterable ? { ...named, actions: [...(named.actions ?? []), { id: CARAVAN_ENTER_ROW, label: CARAVAN_TEXT.enter }] } : named);
  /** WAGONS2-VISIT: and on my parked caravan, online, who may enter it - "Who may enter: ..." after its door (the host's
   *  words; a press moves it on). */
  const withEntryRow = (named, parked = true) => { const label = parked && WAGON_KINDS[myKind()]?.enterable ? caravanEntry?.row?.() ?? null : null; return label ? { ...named, actions: [...(named.actions ?? []), { id: CARAVAN_ENTRY_ROW, label }] } : named; };
  /** WAGONS2-VISIT: "Step inside" over another player's parked caravan whose door is open to me (the host's word). */
  const caravanVisitRows = (owner) => { const t = visit?.may ? visitTarget(owner) : null; return t && visit.may(t) ? [{ id: CARAVAN_VISIT_ROW, label: CARAVAN_TEXT.enter }] : []; };
  /** WORLD-HOVER: the plaque's word - the horse's name or "Horse" (HorseTargetLabel), "Wagon", and a peer's by whose it is. */
  function hoverName(key) {
    if (typeof key !== 'string') return null;
    // ACT-MENU: my own three carry the mod's verbs as the plaque's rows (horseCartLaw.js hccActionRows) - the wheel
    // lights one and the activate key presses it, in place of the interaction mode set beforehand
    if ((key === KEY_WAGON || key === KEY_FOLLOWING_WAGON) && myKind() !== 'cart') return withEntryRow(withCaravanRow(withActions({ title: wagonTitle(myKind()) }, key === KEY_WAGON ? 'deployedWagon' : 'followingWagon'), key === KEY_WAGON), key === KEY_WAGON);   // WAGONS1: a bigger wagon by its own name, the caravan's door on the parked one
    if (key === KEY_WAGON) return withActions({ title: WAGON_HOVER_TEXT }, 'deployedWagon');
    if (key === KEY_FOLLOWING_WAGON) return withActions({ title: WAGON_HOVER_TEXT }, 'followingWagon');
    if (key === KEY_HORSE) return withActions({ title: runtime ? runtime.horseTargetLabel : horseTargetLabel('') }, 'horse');
    const pk = peerOfKey(key);
    if (!pk) return null;
    const p = _peers.get(pk.owner);
    if (!p) return null;
    // HCC-TIP (2026-09-23, Mac: "ensure it shows owned if another players"): the World Tooltips plaque names the THING
    // as the mod names it - the horse by its name (HorseTargetLabel's "Horse" when unnamed), the wagon "Wagon" - and a
    // second row says whose it is, the way the plaque's other rows speak: the owner's session name, or the name the
    // relay stamped on the cell's memory when the owner is away (HCC-PARK), never nobody's.
    const who = peerName(p.ownerId ?? pk.owner) ?? (p.ownerName || null);
    const owned = ownedLine(who);
    if (pk.what === 'w') {
      const rows = riders?.acts?.(p.ownerId ?? pk.owner, p.wagon?.model, p.kept) ?? [];   // WAGONS1: ask to ride, get down
      const inside = caravanVisitRows(pk.owner);   // WAGONS2-VISIT: step into it, where its door is open to me
      if (inside.length) return { title: wagonTitle(p.wagon?.model), subs: [owned], actions: [...rows, ...inside] };
      return rows.length ? { title: wagonTitle(p.wagon?.model), subs: [owned], actions: rows } : { title: wagonTitle(p.wagon?.model), subs: [owned] };
    }
    return { title: horseTargetLabel(p.name ?? ''), subs: [owned] };
  }
  /** AUDIT HCC U6: HorseNameTooltipController.Update [IL_2e16-IL_2ea9] - the activation ray at the mod's 3.2 meets MY
   *  standing horse (OwnsStationaryHorseActivator: never a peer's, never the wagon): the runtime's HorseTargetLabel,
   *  else '' (Hide). The host gates IsPlayingGame and hands the ray. */
  function tooltipText(eye, dir, col) {
    if (!runtime || !enabled) return '';
    const pick = pickActivatableHit(eye, dir, targets(), col);
    return pick?.key === KEY_HORSE && pick.distance <= ACTIVATION_REACH ? String(runtime.horseTargetLabel ?? '') : '';
  }
  /** The press: the runtime's three activators; a peer's answers with whose it is (nothing of theirs opens here) -
   *  inside the mod's own reach, else DFU's "too far" (AUDIT HCC O6, the dropped torch's arm). ACT-MENU: `mode` is
   *  the plaque row the player lit (null where no plaque stands: the interaction mode decides, as the mod's does). */
  function activate(key, distance, say = null, tooFar = null, mode = null) {
    if (!runtime) return false;
    if (key === KEY_WAGON && mode === CARAVAN_ENTER_ROW) {   // WAGONS1: into the caravan, at the mod's own reach
      if (!(distance <= ACTIVATION_REACH)) { tooFar?.(); return true; }   // the mod's own reach
      void enterCaravan?.();
      return true;
    }
    if (key === KEY_WAGON && mode === CARAVAN_ENTRY_ROW) {   // WAGONS2-VISIT: who may enter my caravan, moved on - at the mod's own reach
      if (!(distance <= ACTIVATION_REACH)) { tooFar?.(); return true; }   // the mod's own reach
      const line = caravanEntry?.turn?.() ?? null;
      if (line) say?.(line);
      return true;
    }
    if (key === KEY_WAGON) return runtime.handleDeployedWagonActivation(distance, mode);
    if (key === KEY_FOLLOWING_WAGON) return runtime.handleFollowingWagonActivation(distance, mode);
    if (key === KEY_HORSE) return runtime.handleStationaryHorseActivation(distance, mode);
    const pk = peerOfKey(key);
    if (!pk || !_peers.has(pk.owner)) return false;
    if (pk.what === 'w' && mode === CARAVAN_VISIT_ROW) {   // WAGONS2-VISIT: into another's caravan, at the mod's own reach
      if (!(distance <= ACTIVATION_REACH)) { tooFar?.(); return true; }   // the mod's own reach
      const t = visitTarget(pk.owner);
      if (t) void visit?.enter?.(t);
      return true;
    }
    if (pk.what === 'w' && typeof mode === 'string' && mode.startsWith('wagon:') && riders?.press) return !!riders.press(_peers.get(pk.owner)?.ownerId ?? pk.owner, mode, distance);   // WAGONS1: the seats' own reach (systems/wagonSeats.js RIDE_ASK_REACH)
    if (!(distance <= ACTIVATION_REACH)) { tooFar?.(); return true; }
    const n = hoverName(key);
    if (n) say?.(`${pk.what === 'w' ? 'This wagon' : `${n.title}`} - ${n.subs[0].charAt(0).toLowerCase()}${n.subs[0].slice(1)}.`);   // HCC-TIP: the press says what the plaque says
    return true;
  }

  /** WAGONS1: where seat `k` of a wagon drawn at `position` / `rotation` is - its floor under the rider (`feet`) and the
   *  way they face (radians, the camera's) - or null (no such seat, no model up). */
  function seatWorld(kind, position, rotation, k, hitched = false) {
    const parts = partsOf(kind);
    const seat = parts?.seats?.[k];
    if (!seat || !position || !rotation) return null;
    const local = pitchedPoint(parts, seat.feet, hitched ? parts.hitchPitch ?? 0 : 0);
    const off = quatRotate(rotation, local), fwd = quatRotate(rotation, [0, 0, 1]);
    return { feet: [position[0] + off[0], position[1] + off[1], position[2] + off[2]], yaw: Math.atan2(fwd[0], fwd[2]) + (seat.yaw * Math.PI) / 180 };
  }
  /** WAGONS1: seat `k` of MY wagon as drawn this frame (a companion's), or null. */
  function mySeat(k) {
    const w = shown()?.wagon;
    return w ? seatWorld(w.model, w.position, w.rotation, k, w.hitched) : null;
  }
  /** WAGONS1: seat `k` of another player's wagon as drawn here (where I ride), or null. */
  function peerSeat(owner, k) {
    const p = _peers.get(owner);
    return p?.wagon && p.shownWagon ? seatWorld(p.wagon.model, p.shownWagon, p.shownRotation ?? p.wagon.rotation, k, p.wagon.kind !== HCC_WIRE_KIND.Deployed || p.wagon.hitched) : null;
  }
  /** WAGONS1: what another player's live word says of their wagon's back - its kind, who sits where, a journey, who was
   *  turned away - or null when they show no wagon here. */
  function peerRide(owner) {
    const p = _peers.get(owner);
    if (!p || p.kept) return null;
    return { model: p.wagon?.model ?? null, kind: p.wagon?.kind ?? null, passengers: p.wagon?.passengers ?? [], go: p.go ?? null, declined: p.pn ?? [], position: p.shownWagon ?? null, wire: p.wire?.w?.position ?? null };
  }
  /** WAGONS1: the seats my wagon has - its model's, once up (0 for no wagon of mine standing). */
  function mySeatCount() {
    const w = shown()?.wagon;
    return w ? partsOf(w.model)?.seats?.length ?? 0 : 0;
  }
  /** WAGONS1: my parked caravan's door (scenes/caravanRoom.js parked): its pose, the ground behind its rear door the
   *  player steps out onto, and the way they face there (the camera's yaw - away from the caravan); null when no
   *  caravan of mine stands parked or its model is not up. */
  function parkedDoor() {
    const s = shown();
    const w = s?.wagon;
    if (!w || w.kind !== HCC_WIRE_KIND.Deployed || !WAGON_KINDS[w.model]?.enterable) return null;
    return caravanDoorAt(w.model, w.position, w.rotation);
  }
  /** WAGONS1: THE CARAVAN'S DOOR LAW, one home for mine and another's (WAGONS2-VISIT): a caravan of `kind` standing at
   *  `position` / `rotation` - its pose, the ground behind its rear door and the way out, facing away; null without its
   *  model's door. */
  function caravanDoorAt(kind, position, rotation) {
    const door = partsOf(kind)?.door;
    if (!door) return null;
    const off = quatRotate(rotation, door.step);
    const out = quatRotate(rotation, [0, 0, -1]);
    return { position: [...position], rotation: [...rotation], step: [position[0] + off[0], position[1] + off[1], position[2] + off[2]], yaw: Math.atan2(out[0], out[2]) };
  }
  /**
   * WAGONS2-VISIT: ANOTHER PLAYER'S PARKED CARAVAN, AS A VISIT NAMES IT - its owner key `k` (the cell's record of it names
   * it: the room is `caravan:<k>`; a live word alone names none, so a caravan the cell keeps no record of opens to
   * nobody), its owner (the session's name for them, else the relay's stamp on the record), who may enter (`entry`,
   * `guild`), its inside's paint (`look`), where its record stands (`at`, natives - the visit's own test that it still
   * does) and its door as drawn here (caravanDoorAt). Null for anything but a parked caravan.
   */
  function visitTarget(owner) {
    const p = _peers.get(owner);
    const w = p?.wagon;
    if (!w || w.kind !== HCC_WIRE_KIND.Deployed || !WAGON_KINDS[w.model]?.enterable || !p.shownWagon || !p.wire?.w) return null;
    let kept = null;
    for (const e of _kept.values()) if ((p.kept ? keptKey(e.k) === owner : e.id === (p.ownerId ?? owner)) && (!kept || e.seq > kept.seq)) kept = e;
    if (!kept) return null;
    const door = caravanDoorAt(w.model, p.shownWagon, p.shownRotation ?? w.rotation);
    if (!door) return null;
    const name = peerName(p.ownerId ?? owner) ?? (kept.name || p.ownerName || null);
    return { ...door, k: kept.k, owner: name, entry: w.entry ?? 'private', guild: w.guild ?? null, look: w.look ?? null, at: [...p.wire.w.position] };
  }

  // ── the floating origin
  function offsetAll(offset) {
    runtime?.rebase?.(offset);
    for (const p of _peers.values()) {
      for (const v of [p.shownHorse, p.shownWagon]) if (v) { v[0] += offset[0]; v[1] += offset[1]; v[2] += offset[2]; }
    }
    // the collider box stands again at the shifted pose on the next frame. DISC20-C: and the box that stood goes NOW -
    // its matrix is the old frame's, and a crossing that also leaves the wagon's pixel shows no wagon to stand it
    // again, which left it in the pixel entered, 819 m off: a wall no one could see
    if (_bucketKey) collider()?.removeBucket?.(WAGON_BUCKET);
    _bucketKey = null;
  }
  /** Every transition and every load: the peers' LIVE words go (their art with them, where the cell keeps nothing of
   *  theirs); the runtime keeps its own record (the mod's handlers). HCC-PARK: the kept records are the cell's and
   *  go with the cell (pruneKept), not with a room change's puppets. */
  function clearPeers() { const owners = [..._live.keys()]; _live.clear(); for (const owner of owners) syncPeer(owner); for (const key of [..._peers.keys()]) if (!isKeptKey(key)) dropPeer(key); }
  function dropPeer(owner) { dropHorseBatch(owner); _peers.delete(owner); _grownWheels.delete(owner); }
  /** The switch off, a teardown: nothing of anyone's stands (the kept words stay as DATA, so the switch back on shows
   *  the cell's parked teams again without waiting on a welcome - HCC-PARK). */
  function destroyAll() { _live.clear(); for (const owner of [..._peers.keys()]) dropPeer(owner); dropHorseBatch(''); standWagonCollider(null); }

  // ── ONLINE (HCC-ONLINE)
  /** My word, or null when nothing of mine stands. */
  const wireRecord = (toWire = (p) => p) => hccWireRecord(shown(), toWire);
  /** AUDIT HCC O1: the targets out of the WIRE record through the host's conversion, every frame - the camps shift
   *  their scene points in offsetAll, but a fast travel re-anchors the origin with no offset to ride, and only a
   *  conversion at the time of use is right after both (horseCartWire's header: "a reader converts at landing and
   *  every frame after"). */
  function retarget(p) {
    p.wagon = p.wire.w ? { ...p.wire.w, position: p.toScene(p.wire.w.position) } : null;
    p.horse = p.wire.h ? { ...p.wire.h, position: p.toScene(p.wire.h.position) } : null;
    const g = p.ground;   // DISC20-C: where this word stands on my ground, as a delta off it
    if (!g || g.wire !== p.wire) return;
    if (p.wagon && g.dw) { const q = p.wagon.position; p.wagon.position = [q[0] + g.dw[0], q[1] + g.dw[1], q[2] + g.dw[2]]; p.wagon.rotation = g.rot; }
    if (p.horse && g.dh !== null) { const q = p.horse.position; p.horse.position = [q[0], q[1] + g.dh, q[2]]; }
  }
  /**
   * DISC20-C (2026-09-24, Mac: "Horse and carts can be seen parked in the sky"): A PEER'S STANDING TEAM, ON MY
   * GROUND. A word carries the height its OWNER's client stood the team at - the owner's ground, never re-read on
   * mine. The one place the two part by much is a word older than the ground: the relay keeps a parked team for 72
   * hours (HCC-PARK, an identical word refreshing it), and TERRAIN-SCALE1 lowered every ground from the prefab's 1.5
   * to the game scene's 1.25 four hours after HCC-PARK shipped - re-standing the heights a save, a scene cache and an
   * anchor carry, and not this one. Every team kept from before it, and every word from a tab still on the old build,
   * stood a fifth of the ground's height up: 20 m over 100 m of ground, 60 m over 300. (World of Daggerfall's levelled
   * sites and Basic Roads' smoothing, on for one player and off for the other, part them the same way, by less.)
   *
   * So a PARKED wagon and a STANDING horse are stood on my ground by the mod's own law - the wagon by its two-wheel
   * solve (DeployedWagonVisual, the owner's heading), the horse by the stationary probe - once per word, from 1000 m
   * over to 3000 m down, the surface nearest the word's height kept, my own wagon's box left out of the ray (the
   * owner's stands none here since PR-WAGON1). Kept as a delta off the word, so my floating origin and a re-anchor
   * carry it; a word my ground is not under yet stands as said and tries again in GROUND_RETRY_SECONDS, and a pixel
   * built under it asks again at once (groundMoved). A moving team is its owner's live word and stands as said.
   */
  function groundPeer(p) {
    let g = p.ground;
    if (!g || g.wire !== p.wire) g = p.ground = { wire: p.wire, dw: null, rot: null, dh: null, due: 0 };
    if (g.due === null || now() < g.due) return;   // stood, or waiting out its retry
    const col = collider();
    const phys = { raycastAll: (o, d, m) => raycastAllOver(col, o, d, m), log: null };   // raycastAllOver's own skip: my box
    let missing = false;
    const w = p.wire.w;
    if (w?.kind === HCC_WIRE_KIND.Deployed && !g.dw) {
      const at = p.toScene(w.position);
      const parts = partsOf(w.model);
      const v = parts ? new DeployedWagonVisual(parts, at, quatForward(w.rotation), 0, 1, phys, 0) : null;   // the pivots need the mesh
      if (v?.isGrounded) { g.dw = [v.position[0] - at[0], v.position[1] - at[1], v.position[2] - at[2]]; g.rot = v.rotation; } else missing = true;
    }
    const h = p.wire.h;
    if (h && !h.walking && g.dh === null) {
      const at = p.toScene(h.position);
      const best = pickGround(phys.raycastAll([at[0], at[1] + STATIONARY_PROBE_HEIGHT, at[2]], [0, -1, 0], STATIONARY_PROBE_DISTANCE), at[1]);
      if (best) g.dh = best.point[1] - at[1]; else missing = true;
    }
    g.due = missing ? now() + GROUND_RETRY_SECONDS : null;
  }
  /** DISC20-C: the ground in [x0, x1] x [z0, z1] (scene metres) was built again - a pixel streamed in, the road
   *  network or a late World of Daggerfall pack rebuilding one. What stands on it stands again on what is there now:
   *  my parked wagon and waiting horse (the mod grounds them once - its terrain never changes under a scene - and the
   *  port's can) and every peer's. A margin of a wagon's length, for a team astride the edge. */
  function groundMoved(x0, z0, x1, z1) {
    const M = 6;
    const within = (q) => !!q && q[0] >= x0 - M && q[0] <= x1 + M && q[2] >= z0 - M && q[2] <= z1 + M;
    runtime?.regroundStanding?.(within);
    for (const p of _peers.values()) if (p.ground && (within(p.wagon?.position) || within(p.horse?.position))) p.ground = null;
  }
  /**
   * HCC-PARK: WHAT STANDS FOR A PEER. Two kinds of word, two kinds of display. An owner's LIVE word (`hv` on their
   * foes frame, present while they are in the room) stands under their peer id. A cell's KEPT word (the relay's
   * memory of a parked team, present whether its owner is here or not) stands under its owner KEY (`kept:<k>`, the
   * relay's opaque account-and-character key) - so an owner who came back in a new tab, or plays another character
   * in the same tab, is never confused with the team they left (AUDIT HCC-PARK D2). One team is never drawn twice: a
   * kept part stands down while its owner's live word shows that same part in the same place (PARK_SAME_NATIVES) -
   * the owner is here saying it, and the live word is the fresher one.
   */
  const keptKey = (k) => `kept:${k}`;
  const isKeptKey = (key) => typeof key === 'string' && key.startsWith('kept:');
  function showPeer(key, v) {
    if (!enabled || !v || (!v.w && !v.h)) { if (_peers.has(key)) dropPeer(key); return; }
    let p = _peers.get(key);
    if (!p) { p = { wire: null, toScene: null, wagon: null, horse: null, name: '', ownerId: null, ownerName: '', at: 0, kept: false, shownWagon: null, shownHorse: null, shownRotation: null, walk: freshHorseWalk(), ground: null }; _peers.set(key, p); }
    p.wire = { w: v.w, h: v.h };
    p.toScene = v.toScene ?? ((q) => q);
    p.at = v.at ?? p.at;
    p.name = v.n ?? '';
    p.ownerId = v.ownerId; p.ownerName = v.ownerName ?? ''; p.kept = !!v.kept;
    p.go = v.go ?? null; p.pn = v.pn ?? [];   // WAGONS1
    retarget(p);
    if (!p.wagon) { p.shownWagon = null; p.shownRotation = null; }
    if (!p.horse) p.shownHorse = null;
    if (p.horse) { ensureStationary(); ensureWalk(); }
    if (p.wagon) partsOf(p.wagon.model);
  }
  function syncPeer(owner) {
    const l = _live.get(owner) ?? null;
    showPeer(owner, l ? { w: l.w, h: l.h, n: l.h ? l.n : '', go: l.go, pn: l.pn, toScene: l.toScene, at: l.at, ownerId: owner, ownerName: '', kept: false } : null);
    for (const k of new Set([..._kept.values()].filter((e) => e.id === owner).map((e) => e.k))) syncKept(k);
  }
  const samePlace = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) <= PARK_SAME_NATIVES && Math.abs(a[2] - b[2]) <= PARK_SAME_NATIVES;
  /** The kept word a key stands on: the newest any held cell said (two cells hold one owner's record only while the
   *  registry's drop of the older is in flight). */
  function syncKept(k) {
    let e = null;
    for (const x of _kept.values()) if (x.k === k && (!e || x.seq > e.seq)) e = x;
    if (!e) { showPeer(keptKey(k), null); return; }
    const l = _live.get(e.id) ?? null;
    const w = e.w && !(l?.w && samePlace(l.w.position, e.w.position)) ? e.w : null;
    const h = e.h && !(l?.h && samePlace(l.h.position, e.h.position)) ? e.h : null;
    showPeer(keptKey(k), { w, h, n: h ? e.n : '', toScene: e.toScene, ownerId: e.id, ownerName: e.name, kept: true });
  }
  /** Another's word through validHccRecord, kept in the WIRE frame; `null` (or an invalid record) drops theirs. */
  function applyOwner(owner, raw, toScene = (p) => p, nowMs = 0) {
    if (!enabled) return false;   // AUDIT HCC O8: a disabled mod is one DFU never loaded - nothing of a peer's stands or loads
    if (typeof owner !== 'string' || !owner || owner === (selfId?.() ?? null)) return false;
    const r = raw == null ? null : validHccRecord(raw);
    if (!r) { _live.delete(owner); syncPeer(owner); return raw == null; }
    _live.set(owner, { w: r.w ?? null, h: r.h ?? null, n: r.n ?? '', go: r.go ?? null, pn: r.pn ?? [], toScene, at: nowMs });   // WAGONS1: the owner's journey and refusals ride with the word
    syncPeer(owner);
    return true;
  }
  /** An owner gone from the room, or quiet past staleMs, takes their LIVE word with them (the camps' law); what the
   *  cell keeps of theirs stands (HCC-PARK). */
  function sweepOwners(alive, nowMs, staleMs = 0) {
    for (const [owner, l] of [..._live]) {
      if (alive?.has?.(owner) && !(staleMs > 0 && nowMs - l.at > staleMs)) continue;
      _live.delete(owner);
      syncPeer(owner);
    }
  }

  // ── HCC-PARK: THE CELL'S MEMORY OF A PARKED TEAM (net/wire.js's header)
  /** A cell room's word about one owner's parked team (online.js's projection): `k` the owner key, `id` the peer id
   *  it was last said under, `name` the owner's as the relay stamped it (so a team whose owner is away is still
   *  named), `r` the record or null - gone, `ttl` its life left. Only THIS room's word for that key changes. */
  function applyKept(room, e, toScene = (p) => p, nowMs = 0) {
    if (!e || typeof e !== 'object' || typeof e.k !== 'string' || !e.k || typeof e.id !== 'string' || !e.id) return false;
    if (e.id === (selfId?.() ?? null)) return false;
    const slot = `${room}|${e.k}`;
    const v = e.r == null ? null : validHccRecord(e.r);
    if (!v || !(v.w?.kind === HCC_WIRE_KIND.Deployed || v.w == null) || (!v.w && !v.h)) {
      _kept.delete(slot);
      syncKept(e.k);
      return e.r == null;
    }
    const ttl = Number.isFinite(e.ttl) ? Math.max(0, Math.min(PARK_TTL_MS, e.ttl)) : PARK_TTL_MS;
    _kept.set(slot, { room, k: e.k, id: e.id, w: v.w ?? null, h: v.h ?? null, n: v.n ?? '', name: typeof e.name === 'string' ? e.name.slice(0, 32) : '', expires: nowMs + ttl, toScene, seq: ++_keptSeq });
    syncKept(e.k);
    return true;
  }
  /** A cell room's whole memory (its welcome - an empty one included): every kept word of that room replaced. */
  function replaceKept(room, list, toScene = (p) => p, nowMs = 0) {
    const touched = new Set();
    for (const [slot, e] of [..._kept]) if (e.room === room) { _kept.delete(slot); touched.add(e.k); }
    for (const e of Array.isArray(list) ? list : []) if (e && typeof e === 'object' && applyKept(room, e, toScene, nowMs)) touched.delete(e.k);
    for (const k of touched) syncKept(k);
  }
  /** The rooms I hold now (my cell, my halo): a kept word of a room I left goes, and one past its life on the relay
   *  (AUDIT HCC-PARK D5: the relay's sweep says so only to a socket it is listing for). */
  function pruneKept(rooms, nowMs = null) {
    const held = rooms instanceof Set ? rooms : new Set(rooms ?? []);
    const touched = new Set();
    for (const [slot, e] of [..._kept]) if (!held.has(e.room) || (nowMs !== null && nowMs >= e.expires)) { _kept.delete(slot); touched.add(e.k); }
    for (const k of touched) syncKept(k);
  }
  /**
   * HCC-PARK: MY word for the cell - what of mine is PARKED, off the save record (the runtime's WagonSaveData), never
   * off what happens to be drawn: a wagon left at a shop door is parked whether or not I am standing where my client
   * shows it. null: nothing of mine is parked (or the switch is off, or persistence is: nothing stays in the world).
   * `a` the anchor (the wagon's natives, else the loose horse's), `r` the team as SHOWN, when my client is showing it
   * (the pose, the rotation, the cargo, the name) - the cell stores only a word that has one.
   */
  function parkWord(toWire = (p) => p) {
    if (!runtime || !enabled) return null;
    const v = runtime.view();
    const st = v?.state;
    if (!st || v.persistence === false) return null;
    const wagonParked = st.Mode === WAGON_MODE.Deployed;
    const horseParked = st.HorseMode === HORSE_MODE.LooseStationary || (wagonParked && st.HorseMode === HORSE_MODE.HitchedToWagon);
    if (!wagonParked && !horseParked) return null;
    const a = wagonParked ? [st.WorldX, st.WorldZ] : [st.HorseWorldX, st.HorseWorldZ];
    if (!a.every(Number.isFinite)) return null;
    const rec = hccWireRecord(shown(), toWire);
    const r = {};
    if (wagonParked && rec?.w?.[0] === HCC_WIRE_KIND.Deployed) { r.w = [...rec.w]; r.w[9] = 0; if (rec.wk) r.wk = rec.wk; if (rec.wh) r.wh = rec.wh; if (rec.wl) r.wl = rec.wl; }   // WAGONS1: which wagon, its horse in its shafts; WAGONS2: its paint
    const near = (x, z) => Math.abs(x - a[0]) <= PARK_REACH && Math.abs(z - a[1]) <= PARK_REACH;
    if (horseParked && rec?.h && !v.horseFollowing && !v.teamFollowing && near(rec.h[0], rec.h[2])) { r.h = [...rec.h]; r.h[5] = 0; if (rec.n) r.n = rec.n; }
    if (r.w && !near(r.w[1], r.w[3])) { delete r.w; delete r.wk; delete r.wh; delete r.wl; }
    if (r.w && rec.we) { r.we = rec.we; if (rec.wg) r.wg = rec.wg; }   // WAGONS2-VISIT: who may enter it, the cell's to keep while its owner is away
    return r.w || r.h ? { a, r } : { a };
  }

  return {
    attach(rt) { runtime = rt; return this; },
    /** AUDIT (the pre-merge audit, I-B): the host's word on each other player's look - 'hidden' (INVIS-NET's classic
     *  lane), a concealed visual (INVIS-LOOK), or null - so a concealed owner's team is concealed with it. */
    setPeerLook(fn) { peerLook = typeof fn === 'function' ? fn : null; },
    /** The mod's own switch (modSettings Enabled): a disabled mod is one DFU never loaded. */
    setEnabled(on) {
      const was = enabled;
      enabled = !!on;
      if (!was && enabled) { for (const k of new Set([..._kept.values()].map((e) => e.k))) syncKept(k); return; }   // HCC-PARK: the cell's parked teams, back with the switch
      if (!was || enabled) return;
      runtime?.suspend?.();   // AUDIT HCC H4: the machine lets go of what it was observing
      destroyAll();
      // AUDIT HCC O7: the switch turned off is a moved word - the peers drop mine now, not at my next full frame
      if (_lastKey !== '') { _lastKey = ''; onChanged?.(); }
    },
    get enabled() { return enabled; },
    get runtime() { return runtime; },
    presentation: { wagonParts, horseArt, hitchOf: () => hitchOf(myKind()), onChanged: () => onChanged?.() },
    phys,
    frame, batches, draw, targets, hoverName, tooltipText, activate, offsetAll, destroyAll, clearPeers, shown, groundMoved,
    wireRecord, applyOwner, sweepOwners, applyKept, replaceKept, pruneKept, parkWord, parkedDoor, mySeat, peerSeat, peerRide, mySeatCount,
    visitTarget,   // WAGONS2-VISIT
    get peers() { return _peers; }, get kept() { return _kept; }, get parts() { return partsOf(myKind()); }, partsOf, hitchOf,
  };
}

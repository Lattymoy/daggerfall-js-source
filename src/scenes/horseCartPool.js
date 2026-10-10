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
//          `ps`, `go` and `pn`; acts(owner, kind, kept) -> plaque rows over another player's wagon; press(owner, id, distance);
//          sitsIn(peer, owner, seat) - FINAL AUDIT: whether that peer's own word seats them there }),
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
//
// WAGONS2 (2026-10-09, Mac: "Real wheel movement"): EACH WHEEL ROLLS ON ITS OWN, AND THE FOUR-WHEELERS STEER. A wheel is
// drawn at its own angle (`turn.angles`, systems/horseCart.js rolledAngles - its contact's travel along its heading over
// its radius), the open wagon's and the caravan's front axle, pole and front pair turned on their kingpin by the steer
// (`turn.steer`, horseFollow.js bogieAxle). Mine are the runtime's; a peer's are turned HERE off the pose this client
// draws (`turnPeer`, `hitchPeerWagon`'s two bars); a parked wagon's stay as they stood. The wire is unchanged.
//
// WAGONS3 (2026-10-10, Mac: "sit on the wagon itself, the ledge its built for and requiring 2 horses to use", "Proper
// animated rope mechanics that connect the horses to the wagon", "All the wagons/carts are oversized in the overworld",
// "Spawning the wagon can trap you under the wagon"): THE TEAM, THE DRIVER AND THE HARNESS.
//  - THE TEAM (`teamOf`): the horses a wagon's harness holds, drawn as the mod's billboard each - the Open Wagon's and
//    the Caravan's pair either side of the pole (world/wagonModels.js TEAM), the Small Cart's one in its shafts. While a
//    bench wagon is driven the pair stands where the driven horse would (the player's capsule, the hitch) and faces down
//    the pole; parked, hitched, they stand at its end; a following team walks its lead horse's path two abreast. My
//    parked bench wagon keeps its second horse in harness while I ride the other (`horses` - I own two). A peer's team
//    is drawn off their word the same way (their driven pair at their rider as drawn here, `peerAnchor`).
//  - THE DRIVER (`driverDrawn`, `driverSeat`, `driverGlue`): the bench's seat (wagonModels.js driverSeatFor) as the wagon
//    is drawn - where the hosts stand my camera and body while I drive, and where another player's driver is drawn
//    seated (their pose's `rd` 2 at the puller, glued onto their bench as their back seats' riders are - seatGlue).
//  - THE HARNESS (`_harness`, systems/wagonRopes.js): each hitched horse's two traces from its collar to its singletree
//    (the Small Cart's to its shafts' roots), and a seated driver's two reins from the hands to the pair's bits - Verlet
//    ropes stepped each frame on the frame's own clock, drawn as one leather tube mesh an owner (renderer.updateMeshVertices).
//  - THE OVERWORLD (`drawnFrameOf`): a driven rig is grown by world/wagonModels.js rigGrowOf - every kind read as long as
//    a rider on horseback, not the traveller's grow times its own length - its team, driver and harness with it.
//  - THE PARKED BOX: never stood round my capsule (`capsuleInBox` - its two-sided faces cannot push a body out, and a
//    wagon laid where I stood held me in it), and stood again when the wagon's model changes under it.
// deps (WAGONS3) = { horses() -> how many horses I own; playerCapsule() -> { feet, height, radius } | null;
//          renderShift() -> [dx, dy, dz] | null - where the player is DRAWN this frame less where the motor stands them (its
//          fixed step's interpolation): my driven wagon hangs from the motor's step, and is drawn - with its team, its
//          harness and its driver's seat, where the camera sits - where the player is drawn, or a display faster than the
//          step saw the bench shake under the eye }
import { GLOBAL_SCALE, RAY_DISTANCE, pickActivatableHit } from '../player/activate.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { multiply, transformPoint } from '../world/mat4.js';
import { mat4FromQuatPos, mat4FromQuatPosScale, quatAngleAxis, quatLookRotation, quatSlerp, quatForward, quatRotate, UNITY_QUAT_IDENTITY } from '../world/quat.js';
import { buildWagonParts, usableBounds, CARGO_DEFINITIONS, cargoPiecesShown } from '../systems/wagon41214.js';
import {
  WAGON_MODEL_ID, HORSE_VIEWS, HORSE_WALK_FRAMES, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_WALK_SPRITE_HEIGHT,
  calculateHorseOrientation, horseViewFor, horseTargetLabel, ACTIVATION_REACH, HORSE_BOX_CENTER, HORSE_BOX_SIZE,
  stepHorseWalk, freshHorseWalk, START_WALKING_SPEED, WAGON_MODE, HORSE_MODE,
  pickGround, STATIONARY_PROBE_HEIGHT, STATIONARY_PROBE_DISTANCE, GROUND_RETRY_SECONDS,   // DISC20-C: a peer's standing team, stood on my ground
  HITCHED_HORSE_LOCAL_Z, NORMAL_GROUND_OFFSET, GROUND_RAY_HEIGHT, GROUND_RAY_DISTANCE, TELEPORT_DISTANCE, ROTATION_SMOOTHING_RATE, POSITION_SMOOTHING_RATE,   // WAGON-HITCH
} from '../systems/horseCartLaw.js';
import { hitchAxle, bogieAxle, steerToward, yawed } from '../systems/horseFollow.js';   // WAGON-HITCH: the shafts' one law, for a peer's trailing wagon (WAGONS2: and a four-wheeler's two)
import { DeployedWagonVisual, wheelContacts, rolledAngles } from '../systems/horseCart.js';   // DISC20-C: the mod's own two-wheel solve, for a peer's parked wagon (WAGONS2: and each wheel's roll)
import { PARK_REACH, PARK_TTL_MS } from '../net/wire.js';   // HCC-PARK: how far a kept team's parts may stand from its anchor, and how long the relay keeps one
import { WAGON_HOVER_TEXT } from '../player/eotbWagon.js';   // the hover word for a wagon - the noun of Eye Of The Beholder's Info line, so both carts read alike
import { hccWireRecord, validHccRecord, hccRecordKey, easeToward, HCC_WIRE_KIND } from '../systems/horseCartWire.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toColor32 } from '../formats/color32Order.js';
import { wagonGeometry, buildBakedWagonParts, rendererModelOf, pitchedPoint, teamSidesOf, TEAM, rigGrowOf } from '../world/wagonModels.js';   // WAGONS1: Mac's wagons; WAGONS3: the team, the rig's grow
import { seatRigInput, seatTopByte } from '../player/seatPose.js';   // WAGONS3: the driver's hands, and a seated peer's `st`
import { newRope, stepRope, tubeModel, tubeInto, tubeVertexCount, ROPE } from '../systems/wagonRopes.js';   // WAGONS3: the harness
import { wagonArt, WAGON_ARCHIVE, wagonLookArt, isGlassRecord, LOOK_RECORDS, lookRecord, TEX as WAGON_TEX } from '../world/wagonArt.js';
import { caravanRoomModel } from '../world/caravanRoomModel.js';   // WAGONS2: the caravan's room, seen through its windows
import { readWagonLook, wagonLookOfCode, WAGON_OUTSIDE_LOOKS, CARAVAN_INSIDE_LOOKS, CARAVAN_INSIDE_PARTS } from '../systems/wagonLooks.js';
import { validWagonKind, wagonHitchOf, WAGON_KINDS, wagonHorsesOf } from '../systems/wagonKinds.js';
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
/** WAGONS3: the most horses an owner's team draws (a pair, and a horse ridden apart from a parked pair). */
export const TEAM_MAX = 3;
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
const STEER_AXIS = Object.freeze([0, 1, 0]);   // WAGONS2: the kingpin's
/** WAGONS2: how near a seat a peer's companion stands to be taken for seated in it (m) - its owner's seat and this
 *  client's copy of it part by the ease alone. */
export const PUPPET_SEAT_REACH = 0.75;
/** WAGONS2 (AUDIT): and how far above or below it (m) - its feet on the seat, not the ground beside the bed. */
export const PUPPET_SEAT_RISE = 0.5;
/** WAGONS2 (AUDIT): how far from a seat a player said to sit in it may stand and be drawn on it (m) - their own pin
 *  and the owner's wagon eased here apart, never a player elsewhere. */
export const SEAT_GLUE_REACH = 3;
/** RW1 x WAGONS2: how near the room the player stands in a wagon stands to be that room's caravan (m) - its pose and the
 *  room's are one point, set as it parked. */
export const OUTSIDE_SKIP_REACH = 1.5;
/** WAGONS3: how near my capsule's skin may come to my parked wagon's box before the box is not stood (m) - the motor's
 *  own contact margin, so a body touching the box is a body the box would hold. */
export const CAPSULE_BOX_SKIN = 0.05;
const ZERO3 = Object.freeze([0, 0, 0]);
const HORSE_LOCAL_BOX = Object.freeze([
  HORSE_BOX_CENTER[0] - HORSE_BOX_SIZE[0] / 2, HORSE_BOX_CENTER[1] - HORSE_BOX_SIZE[1] / 2, HORSE_BOX_CENTER[2] - HORSE_BOX_SIZE[2] / 2,
  HORSE_BOX_CENTER[0] + HORSE_BOX_SIZE[0] / 2, HORSE_BOX_CENTER[1] + HORSE_BOX_SIZE[1] / 2, HORSE_BOX_CENTER[2] + HORSE_BOX_SIZE[2] / 2,
]);
const aabbOf = (box) => ({ min: [box[0], box[1], box[2]], max: [box[3], box[4], box[5]] });
const NO_SHADOW = Object.freeze({ noShadow: true });   // AUDIT WAGON-HITCH B2: renderer.drawMesh's option
const WORLD_MATRIX = mat4FromQuatPos(UNITY_QUAT_IDENTITY, [0, 0, 0]);   // WAGONS3: the harness is laid in the scene's own frame

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
  horses = () => 1,   // WAGONS3
  playerCapsule = /** @type {() => ({ feet: number[], height?: number, radius?: number } | null)} */ (() => null),   // WAGONS3
  renderShift = /** @type {() => (number[] | null)} */ (() => null),   // WAGONS3
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
      e.parts = { ...parts, gpu: { body: up(parts.body), bogie: up(parts.bogie?.model), wheels: parts.wheels.map((w) => ({ gpu: up(w.model), pivot: w.pivot, front: w.front })) }, box: [...parts.bounds.min, ...parts.bounds.max] };   // WAGONS2: the bogie, and which wheels turn with it
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
  /** WAGONS3: the box stands again when the parts under it change (the classic wagon's while Mac's bake loaded, then
   *  his) - the pose alone was its key, and a box sized for the parts it first stood with stayed. */
  let _bucketParts = null;
  function standWagonCollider(m, parts = partsOf(myKind())) {
    if (parts !== _bucketParts) { _bucketKey = standBox(WAGON_BUCKET, null, _bucketKey, parts); _bucketParts = parts; }
    _bucketKey = standBox(WAGON_BUCKET, m, _bucketKey, parts);
  }
  /** WAGONS3 (Mac: "Spawning the wagon can trap you under the wagon"): WHETHER MY CAPSULE STANDS IN (or touches) A BOX OF
   *  `parts` AT MATRIX `m` - the box's faces are two-sided and push no body out, so it is never stood round one: a wagon
   *  laid where I stand (a summon, a dismount, a door) stands its box once I have stepped clear of it. The capsule's
   *  spine sampled foot to head, each point's distance to the box in its own frame. */
  function capsuleInBox(m, parts) {
    const c = playerCapsule?.();
    if (!c?.feet || !m || !parts?.bounds) return false;
    const b = usableBounds(parts.bounds), r = c.radius ?? 0.35, h = Math.max(2 * r, c.height ?? 1.8), reach = r + CAPSULE_BOX_SKIN;
    for (let i = 0; i <= 4; i++) {
      const y = c.feet[1] + r + ((h - 2 * r) * i) / 4;
      const d = [c.feet[0] - m[12], y - m[13], c.feet[2] - m[14]];
      const l = [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
      let q = 0;
      for (let k = 0; k < 3; k++) { const e = Math.max(b.min[k] - l[k], 0, l[k] - b.max[k]); q += e * e; }
      if (q < reach * reach) return true;
    }
    return false;
  }

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
  /** WAGONS2: a four-wheeler's bogie turned `steer` degrees on its kingpin, in the wagon's frame - T(k) Ry(steer) T(-k). */
  const steeredMatrix = (kingpin, steer) => multiply(mat4FromQuatPos(quatAngleAxis(steer, STEER_AXIS), kingpin), mat4FromQuatPos(UNITY_QUAT_IDENTITY, [-kingpin[0], -kingpin[1], -kingpin[2]]));
  /** One wagon - mine or a peer's - in the host's world pass. `scale` is WAGON-HITCH x OW-BIG's grown draw (1 off it);
   *  a grown wagon casts no shadow (AUDIT WAGON-HITCH B2 - OW-BIG's law for every grown figure). WAGONS1: `kind` the
   *  wagon's (its parts), `hitched` whether a horse is in its shafts (the cart borne level). WAGONS2: `turn` its wheels
   *  and bogie - `{ angle, angles, steer }`: wheel i at `angles[i]` (the mod's one `angle` where it has none), a
   *  four-wheeler's front axle, pole and front pair turned `steer` on the kingpin; and `look` its paint
   *  (systems/wagonLooks.js - a look or its wire code), its body, bogie and wheels drawn on the paint's pictures, and a
   *  caravan's room inside its body, seen through its windows (world/caravanRoomModel.js - casting no shadow: the body
   *  casts the caravan's). */
  function drawWagon(r, texRemap, position, rotation, tier, turn, scale = 1, kind = myKind(), hitched = false, look = null) {
    const parts = partsOf(kind);
    if (!parts?.gpu?.body || !r?.drawMesh) return false;
    const grown = scale > 1;
    const m = grown ? mat4FromQuatPosScale(rotation, position, [scale, scale, scale]) : wagonMatrix(position, rotation);
    const g = parts.gpu;
    const o = grown ? NO_SHADOW : undefined;
    const angleOf = (i) => turn?.angles?.[i] ?? turn?.angle ?? 0;
    if (g.wheels) {
      const pitch = hitched ? parts.hitchPitch ?? 0 : 0;
      const body = pitchedMatrix(m, parts, pitch);
      const l = typeof look === 'number' ? wagonLookOfCode(look) : readWagonLook(look);
      const paint = lookRemap(kind, l) ?? texRemap;
      r.drawMesh(g.body, body, paint, o);
      const steered = parts.bogie ? steeredMatrix(parts.bogie.kingpin, turn?.steer ?? 0) : null;
      if (g.bogie && steered) r.drawMesh(g.bogie, multiply(body, steered), paint, o);
      const front = steered ? multiply(m, steered) : m;
      g.wheels.forEach((w, i) => { if (w.gpu) r.drawMesh(w.gpu, wheelMatrix(w.front ? front : m, w.pivot, angleOf(i)), paint, o); });
      for (const def of parts.cargo) if (tier >= def.threshold) { const gpu = _cargo.get(def.modelId); if (gpu) r.drawMesh(gpu, cargoMatrix(body, def), texRemap, o); }
      if (parts.kind === 'caravan') { const room = roomGpu(); if (room) r.drawMesh(room, body, lookRemap(kind, l, true) ?? texRemap, NO_SHADOW); }   // WAGONS2: its room, last
      return true;
    }
    r.drawMesh(g.body, m, texRemap, o);
    if (g.shaftLeft) r.drawMesh(g.shaftLeft, m, texRemap, o);
    if (g.shaftRight) r.drawMesh(g.shaftRight, m, texRemap, o);
    if (g.wheelLeft) r.drawMesh(g.wheelLeft, wheelMatrix(m, parts.wheelLeftPivot, angleOf(0)), texRemap, o);
    if (g.wheelRight) r.drawMesh(g.wheelRight, wheelMatrix(m, parts.wheelRightPivot, angleOf(1)), texRemap, o);
    for (const def of cargoPiecesShown(tier)) { const gpu = _cargo.get(def.modelId); if (gpu) r.drawMesh(gpu, cargoMatrix(m, def), texRemap, o); }
    return true;
  }
  /** AUDIT WAGON-HITCH B7: each grown wagon's wheel clocks (owner, '' mine), dropped when it is no longer grown.
   *  WAGONS2: one clock per wheel - keyed by owner, then by wheel (the mod's one angle under 'angle'). */
  const _grownWheels = new Map();
  function grownTurn(owner, turn, g) {
    if (!(g > 1) || !turn) { _grownWheels.delete(owner); return turn; }
    const clocks = _grownWheels.get(owner) ?? new Map();
    _grownWheels.set(owner, clocks);
    const step = (wheel, angle) => { const next = grownWheelStep(clocks.get(wheel) ?? null, angle, g); clocks.set(wheel, next); return next.acc; };
    return { ...turn, angle: step('angle', turn.angle ?? 0), angles: turn.angles ? turn.angles.map((a, i) => step(i, a)) : null };
  }
  /** WAGONS2: another player's wheels and bogie, turned HERE off the pose this client draws their wagon at (the wire's
   *  one angle, eased at nothing, stepped at its word's cadence): each wheel rolls by its own contact's travel - a leap
   *  past the mod's 20 m is no travel - and a following team's four-wheeler steers toward its horse as drawn here (a
   *  trailing one is steered on its shafts, hitchPeerWagon; a parked one keeps its last). The word's angle is only the
   *  first frame's. */
  function turnPeer(p) {
    const parts = p.wagon && p.shownWagon ? partsOf(p.wagon.model) : null;
    if (!parts) return;
    const rotation = p.shownRotation ?? p.wagon.rotation;
    if (p.wagon.kind === HCC_WIRE_KIND.Following && parts.bogie && p.shownHorse) p.steer = steerToward(p.shownWagon, quatForward(rotation), p.shownHorse, parts.bogie);
    if (p.turn && p.turn.model !== p.wagon.model) { p.turn = null; p.steer = 0; }   // WAGONS2 (AUDIT): another kind (their `wk` moved) - its wheels its own, not the last kind's spun to them
    const contacts = wheelContacts(parts, p.shownWagon, rotation, p.steer ?? 0);
    const t = p.turn ?? (p.turn = { model: p.wagon.model, angle: p.wagon.angle ?? 0, angles: contacts.map(() => p.wagon.angle ?? 0), contacts: null, steer: 0 });
    if (p.wagon.kind === HCC_WIRE_KIND.Deployed) { t.contacts = contacts; return; }   // WAGONS2 (AUDIT): a parked wagon's stay as they stood - re-stood on the ground (groundPeer), it did not roll there
    const was = t.contacts?.[0]?.p, at = contacts[0]?.p;
    const leapt = !!was && !!at && Math.hypot(at[0] - was[0], at[2] - was[2]) > TELEPORT_DISTANCE;
    t.angles = rolledAngles(t.angles, leapt ? null : t.contacts, contacts, parts);
    t.contacts = contacts; t.steer = p.steer ?? 0;
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
    // WAGONS2: what the draw turns its wheels and bogie by (the wire carries none of it): the moving wagon's own, the
    // parked one's as they stood when it stopped (none: as the mod stands a parked wagon's, at 0)
    if (wagon) wagon.turn = wagon.kind === HCC_WIRE_KIND.Deployed ? v.rest ?? null : { angle: v.moving.wheel?.angle ?? 0, angles: v.moving.wheel?.angles ?? null, steer: v.moving.pose.steer ?? 0 };
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
  /** WAGONS3: every billboard of an owner's team - the first under the owner's own key (the one horse it always was),
   *  the rest `${owner}|${i}`. */
  const teamKey = (owner, i) => (i ? `${owner}|${i}` : owner);
  function dropTeamBatches(owner, from = 0) { for (let i = from; i < TEAM_MAX; i++) dropHorseBatch(teamKey(owner, i)); }
  /** StationaryHorseBillboard.LateUpdate: the orientation off the camera, the view and the flip, the frame. WAGONS3: `g`
   *  the rig's grow under the Overworld (the billboard stands on its foot, so it grows from the ground). */
  function poseHorseBatch(b, cameraPos, horse, g = 1) {
    const view = horseViewFor(calculateHorseOrientation(cameraPos, horse.position, horse.forward));
    if (!view) return;
    const walk = _walkReady;
    b.record = walk ? horseWalkRecord(view.view, horse.frame) : horseStillRecord(view.view);
    const h = walk ? HORSE_WALK_BILLBOARD_HEIGHT : HORSE_BILLBOARD_HEIGHT;
    b.size = { w: (view.flip ? -HORSE_BILLBOARD_WIDTH : HORSE_BILLBOARD_WIDTH) * g, h: h * g };
    b.origin[0] = horse.position[0]; b.origin[1] = horse.position[1]; b.origin[2] = horse.position[2];
  }
  /** WAGONS3: an owner's team posed - each horse `drawn` its billboard, the rest's taken down. `conceal` a peer's look. */
  function poseTeam(owner, team, cameraPos, conceal = null) {
    _teams.set(owner, team);
    let i = 0;
    if (_stillReady) for (const h of team) {
      if (!h.drawn) continue;
      const b = horseBatch(teamKey(owner, i++));
      if (b) { poseHorseBatch(b, cameraPos, h, h.g); if (owner) b.conceal = conceal; }
    }
    dropTeamBatches(owner, i);
  }

  /** The frame: the runtime's LateUpdate, then the collider and the billboards after what it decided. */
  /** One frame. `dt` real seconds (the peers' easing and strides - another player's team keeps moving while my
   *  window is open); `gameDt` Unity's Time.deltaTime for MY runtime [IL_1dac, IL_5d8d, IL_37c3]: zero while the game
   *  is paused, scaled with the world's time (AUDIT HCC, the branch audit - a following horse walked on under an open
   *  inventory, and a Travel Options journey left the trailing wagon 15 m behind the cart). */
  let peerLook = null;   // AUDIT (pre-merge) I-B: setPeerLook's
  function frame(dt, cameraPos, gameDt = dt) {
    if (!enabled) { if (_horseBatches.size || _peers.size || _bucketKey || _harness.size) destroyAll(); return; }
    runtime?.lateUpdate(gameDt);
    const s = shown();
    if (s?.wagon) partsOf(s.wagon.model);   // a wagon shown before the runtime asked for the parts (a peer's, a restored one) starts the build
    const myParts = partsOf(myKind());
    const parked = s?.deployed && s.wagon && myParts ? wagonMatrix(s.wagon.position, s.wagon.rotation) : null;
    standWagonCollider(parked && !capsuleInBox(parked, myParts) ? parked : null, myParts);   // WAGONS3: never round my capsule
    poseTeam('', teamOf('', s, dt), cameraPos);   // WAGONS3: my horse - or my team, two abreast
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
      } else p.walk = freshHorseWalk();
      const anchor = p.wagon?.kind === HCC_WIRE_KIND.Trailing && !p.hidden ? peerAnchor(p.ownerId ?? owner) : null;
      if (anchor) hitchPeerWagon(p, anchor, dt);   // WAGON-HITCH: their cart's wagon on its shafts from their rider as drawn HERE
      else if (p.wagon) { p.hitch = null; p.shownUp = null; p.shownWagon = easeToward(p.shownWagon, p.wagon.position, dt); p.shownRotation = p.shownRotation ? quatSlerp(p.shownRotation, p.wagon.rotation, 1 - Math.exp(-12 * dt)) : [...p.wagon.rotation]; }
      turnPeer(p);   // WAGONS2: its wheels and bogie, off the pose drawn here
      // AUDIT (the pre-merge audit, I-B): the owner's concealment (INVIS-NET/INVIS-LOOK) is its team's - a horse the
      // classic lane's hidden owner leads stands nowhere, and the enhanced lane's is drawn in the owner's own look.
      // WAGONS3: their team as their wagon is drawn here (a driven pair at their rider, after the shafts above)
      if (p.hidden) { dropTeamBatches(owner); _teams.delete(owner); } else poseTeam(owner, teamOf(owner, null, dt), cameraPos, p.look);
    }
    stepHarness(dt);   // WAGONS3: the traces and the reins, between the team and the wagons as both now stand
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
    // WAGONS2: a four-wheeler hangs on its two bars (horseFollow.js bogieAxle) - its kingpin pulled from where it was
    // drawn here, a wheelbase ahead of its axle along it; a leap lays it straight
    const length = hitchOf(p.wagon.model), bogie = partsOf(p.wagon.model)?.bogie ?? null;
    const f0 = p.shownRotation ? quatForward(p.shownRotation) : null, fl0 = f0 ? Math.hypot(f0[0], f0[2]) : 0;
    const kingpinFrom = far || !bogie || !(fl0 > 1e-6) ? null : [from[0] + (f0[0] / fl0) * bogie.wheelbase, from[1], from[2] + (f0[2] / fl0) * bogie.wheelbase];
    const turn = bogie && length > bogie.wheelbase ? bogieAxle(from, kingpinFrom, anchor, length, bogie, quatForward(p.wagon.rotation)) : null;
    p.steer = turn?.steer ?? 0;
    const { axle, dir } = turn ?? hitchAxle(from, anchor, length, quatForward(p.wagon.rotation));   // WAGONS1: their wagon's own length
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
  function draw(r = renderer, texRemap = null, grows = {}) {
    _lastGrows = grows ?? {};   // WAGONS2: the seats as drawn read the grow this pass drew at
    let n = 0;
    const s = shown();
    const mine = drawnFrameOf('', grows, s);
    if (mine) {
      if (drawWagon(r, texRemap, mine.at, mine.rotation, s.wagon.tier, grownTurn('', s.wagon.turn ?? { angle: s.wagon.angle }, mine.g), mine.g, s.wagon.model, s.wagon.hitched, s.wagon.look)) n++;
    } else _grownWheels.delete('');
    for (const [owner, p] of _peers) {
      const f = drawnFrameOf(owner, grows);
      if (!f) continue;
      if (drawWagon(r, texRemap, f.at, f.rotation, p.wagon.tier, grownTurn(owner, p.turn ?? { angle: p.wagon.angle }, f.g), f.g, p.wagon.model, f.hitched, p.wagon.look)) n++;
    }
    drawHarness(r);   // WAGONS3: the traces and the reins
    return n;
  }
  /** RW1 x WAGONS2: THE WAGONS IN THE STREET A WINDOW LOOKS OUT ON (render/renderer.js outsideViewDraws - the view out's
   *  pass) - mine and the others', as they stand, ungrown (the view out is an interior's; the Overworld is none), and
   *  never the one whose room the player stands in (`skipAt`, its pose in this scene - from inside, its own body would
   *  stand between the pane and the street). */
  function drawOutside(r = renderer, skipAt = null) {
    let n = 0;
    const s = shown();
    const frames = [['', drawnFrameOf('', {}, s), s?.wagon ?? null, s?.wagon?.turn ?? (s?.wagon ? { angle: s.wagon.angle } : null)]];
    for (const [owner, p] of _peers) frames.push([owner, drawnFrameOf(owner, {}), p.wagon, p.turn ?? { angle: p.wagon?.angle ?? 0 }]);
    for (const [, f, w, turn] of frames) {
      if (!f || !w || (skipAt && Math.hypot(f.at[0] - skipAt[0], f.at[2] - skipAt[2]) < OUTSIDE_SKIP_REACH)) continue;
      if (drawWagon(r, null, f.at, f.rotation, w.tier, turn, 1, w.model, f.hitched, w.look)) n++;
    }
    return n;
  }
  /** WAGONS2: WHERE A WAGON IS DRAWN THIS FRAME - mine (`owner` '') or an owner's: its point, its rotation, how many
   *  times its size (WAGON-HITCH x OW-BIG's grow under the Overworld - `grows` the host's `{ selfGrow, grow }`) and
   *  whether a horse bears it - the one frame the draw and the seats in its back (seatDrawn, seatGlue) stand on. Null
   *  where no wagon of that owner's is drawn. */
  function drawnFrameOf(owner, { selfGrow = 1, grow = null } = {}, s = owner === '' ? shown() : null) {
    if (owner === '') {
      if (!s?.wagon) return null;
      const driven = s.wagon.kind === HCC_WIRE_KIND.Trailing && !!s.wagon.hitch;
      const g = driven ? rigGrowOf(selfGrow, s.wagon.model, hitchOf(s.wagon.model)) : 1;   // WAGONS3: the rig's own grow
      // WAGONS3: driven, drawn where the player is drawn (renderShift - the motor's step interpolated), level
      const lag = driven ? renderShift?.() ?? null : null;
      const shift = (q) => (lag && q ? [q[0] + lag[0], q[1], q[2] + lag[2]] : q);
      const hitch = shift(s.wagon.hitch), axle = shift(s.wagon.axle), position = shift(s.wagon.position);
      // AUDIT WAGON-HITCH A1 x B: grown from where its wheels stand (the drawn position leans downhill on a slope, and
      // grown that lean is g times as long)
      const at = g > 1 && axle ? grownHitchedPosition(axle, hitch, g, groundYAt, axle[1]) : grownHitchedPosition(position, hitch, g, groundYAt);
      return { wagon: s.wagon, at, rotation: s.wagon.rotation, g, hitched: !!s.wagon.hitched, hitch };
    }
    const p = _peers.get(owner);
    if (!p?.wagon || !p.shownWagon || (p.hidden && p.wagon.kind !== HCC_WIRE_KIND.Deployed)) return null;   // AUDIT (pre-merge) I-B: a hidden owner's trailing or following wagon rolls unseen with it; a parked one is a wagon in the world
    const g = p.hitch && grow ? rigGrowOf(grow(p.hitch), p.wagon.model, hitchOf(p.wagon.model)) : 1;   // WAGONS3: the rig's own grow
    return { wagon: p.wagon, at: grownHitchedPosition(p.shownWagon, p.hitch, g, groundYAt), rotation: p.shownRotation ?? p.wagon.rotation, g, hitched: p.wagon.kind !== HCC_WIRE_KIND.Deployed || p.wagon.hitched, hitch: p.hitch ?? null };
  }
  /** WAGONS2: seat `k` of a wagon AS DRAWN this frame (drawnFrameOf - grown with it under the Overworld): its floor
   *  under the rider (`feet`), the way they face (radians, the camera's) and the wagon's grow `g`; or null. The seat a
   *  body stands on in the world is the wagon's own (peerSeat, mySeat - the pose the wire carries); this is where it is
   *  DRAWN. */
  let _lastGrows = {};
  function seatDrawn(owner, k, grows = _lastGrows) {
    const f = drawnFrameOf(owner, grows);
    const parts = f ? partsOf(f.wagon.model) : null;
    const seat = parts?.seats?.[k];
    if (!seat) return null;
    const local = pitchedPoint(parts, seat.feet, f.hitched ? parts.hitchPitch ?? 0 : 0).map((v) => v * f.g);
    const off = quatRotate(f.rotation, local), fwd = quatRotate(f.rotation, [0, 0, 1]);
    return { feet: [f.at[0] + off[0], f.at[1] + off[1], f.at[2] + off[2]], yaw: Math.atan2(fwd[0], fwd[2]) + (seat.yaw * Math.PI) / 180, g: f.g };
  }
  /** WAGONS2: A PEER'S COMPANION SEATED IN THEIR WAGON'S BACK, AS DRAWN HERE - the owner's stream stands it on a true
   *  seat of their wagon (their crewAshore's), which is where this client's copy of that wagon has the seat too (its
   *  ease aside): the seat its feet stand within PUPPET_SEAT_REACH of is its seat, and the seat as drawn (grown under the
   *  Overworld) is where it is drawn - or null, not seated or not grown (it is drawn where it stands). */
  function puppetSeatDrawn(owner, feet, wire = null) {
    const p = _peers.get(owner);
    const n = p?.wagon && feet ? partsOf(p.wagon.model)?.seats?.length ?? 0 : 0;
    // FINAL AUDIT: and the companion's own record against the wagon's own word - both the owner's, off one frame - for
    // under the Overworld each is eased on its own clock and the drawn pair stood tens of metres apart while it moved
    const raw = n && wire && p.toScene ? p.toScene(wire) : null;
    const on = (q, s) => !!q && !!s && Math.hypot(s.feet[0] - q[0], s.feet[2] - q[2]) <= PUPPET_SEAT_REACH && Math.abs(s.feet[1] - q[1]) <= PUPPET_SEAT_RISE;   // WAGONS2 (AUDIT): and at its height - not one passing under the bed
    for (let k = 0; k < n; k++) {
      if (!on(feet, peerSeat(owner, k)) && !on(raw, wordSeat(owner, k))) continue;
      const drawn = seatDrawn(owner, k);
      return drawn && drawn.g > 1 ? drawn : null;
    }
    return null;
  }
  /** WAGONS2: THE OTHERS SEATED IN A WAGON'S BACK, DRAWN IN IT - comeSailAwayAboard.js glue's law for a wagon: each
   *  entry of `drawable` (online.drawable()'s, a fresh list - its entries replaced, never written) whose player a drawn
   *  wagon's word seats (mine - my own riders' book - or another owner's `ps`) stands on that seat as the wagon is
   *  drawn here (seatDrawn: on its ease, grown with it under the Overworld - their own client pins them to its
   *  ungrown seat, which the Overworld draws a speck short of the grown bed), its place in the bed its `deck` so its
   *  pace reads as sitting still (net/peerPace.js). `toWire` the scene's point in the pose's frame; `grows` the last
   *  draw's (the frame's online pass runs before its draw - the grow a frame old, its pace the camera's). WAGONS2
   *  (AUDIT): only a player who stands within SEAT_GLUE_REACH of that seat as it truly stands - their own client pins
   *  them there - so an owner's word cannot draw anyone else where they are not. */
  function seatGlue(drawable, { toWire = (q) => q, grows = _lastGrows } = {}) {
    const seated = new Map();
    for (const [peer, k] of riders?.passengers?.() ?? []) seated.set(peer, ['', k]);
    for (const [owner, p] of _peers) for (const [peer, k] of p.wagon?.passengers ?? []) if (!seated.has(peer)) seated.set(peer, [owner, k]);
    if (!seated.size) return drawable;
    for (let i = 0; i < drawable.length; i++) {
      const d = drawable[i], at = d?.shown ? seated.get(d.id) : null;
      const seat = at ? seatDrawn(at[0], at[1], grows) : null;
      if (!seat) continue;
      // FINAL AUDIT: or their own word says that seat (wagonRiders.js sitsIn) - under the Overworld their drawn pose
      // lags the seat by tens of metres, and the reach alone refused every seated rider while the wagon moved
      if (!riders?.sitsIn?.(d.id, at[0], at[1])) {
        const truly = at[0] ? peerSeat(at[0], at[1]) : mySeat(at[1]);
        const tw = truly ? toWire(truly.feet) : null;
        if (!tw || !(Math.hypot(d.shown.x - tw[0], d.shown.z - tw[2]) <= SEAT_GLUE_REACH)) continue;
      }
      const w = toWire(seat.feet);
      drawable[i] = { ...d, shown: { ...d.shown, x: w[0], y: w[1], z: w[2], deck: [0, 0, at[1]], deckKey: `wagon:${at[0]}:${at[1]}` } };
    }
    return drawable;
  }

  // ── WAGONS3: the team, the driver, the harness
  const _teams = new Map();   // owner -> this frame's team (teamOf), for the harness
  const _teamWalk = new Map();   // owner -> { at, walk } - a driven team's stride, off its hitch's pace
  /** The way a wagon's team faces as it is drawn: down its pole (a four-wheeler's turned `steer` degrees on its
   *  kingpin), level. */
  function poleForward(f, parts, steer) {
    const fw = quatForward(f.rotation);
    const d = parts?.bogie && steer ? yawed(fw, steer) : fw;
    const l = Math.hypot(d[0], d[2]);
    return l > 1e-6 ? [d[0] / l, 0, d[2] / l] : [0, 0, 1];
  }
  /** A point of a horse's own frame (world/wagonModels.js TEAM's) where horse `h` stands, at its grow. */
  function horsePoint(h, [x, y, z]) {
    const f = h.forward, g = h.g ?? 1;
    return [h.position[0] + (f[2] * x + f[0] * z) * g, h.position[1] + y * g, h.position[2] + (-f[0] * x + f[2] * z) * g];
  }
  /** A driven team's stride: the hitch's pace (grown: the stride a horse of the rig's size takes) over its frame. */
  function teamWalk(owner, hitch, dt, g) {
    let t = _teamWalk.get(owner);
    if (!t) { t = { at: [...hitch], walk: freshHorseWalk() }; _teamWalk.set(owner, t); }
    const step = Math.hypot(hitch[0] - t.at[0], hitch[2] - t.at[2]) / Math.max(1, g);
    if (dt > 0) t.walk = stepHorseWalk(t.walk, step > TELEPORT_DISTANCE ? 0 : step / dt, dt, _walkReady);   // a leap is no stride
    t.at = [...hitch];
    return t.walk;
  }
  /** One of a driven team: `x` across the pole from the hitch (grown), stood on the ground under it. */
  function drivenHorse(hitch, fwd, x, walk, g, drawn) {
    const q = [hitch[0] + fwd[2] * x, hitch[1], hitch[2] - fwd[0] * x];
    const gy = groundYAt(q, 0);
    return { position: [q[0], Number.isFinite(gy) ? gy : hitch[1] - 0.9, q[2]], forward: fwd, frame: walk?.animationFrame ?? 0, walking: !!walk?.walking, g, drawn, hitched: true, side: x };
  }
  /** Where a parked bench wagon's second horse stands in harness: its pole's end beside the pole, on the ground. */
  function parkedPairHorse(w, parts) {
    const fwd = poleForward({ rotation: w.rotation }, parts, w.turn?.steer ?? 0);
    const base = parts.bogie ? (() => { const k = quatRotate(w.rotation, parts.bogie.kingpin); return [w.position[0] + k[0], w.position[1], w.position[2] + k[2]]; })() : w.position;
    const reach = hitchOf(w.model) - (parts.bogie?.wheelbase ?? 0);
    const q = [base[0] + fwd[0] * reach + fwd[2] * TEAM.side, w.position[1], base[2] + fwd[2] * reach - fwd[0] * TEAM.side];
    const gy = groundYAt(q, 0);
    return { position: [q[0], Number.isFinite(gy) ? gy : w.position[1] - NORMAL_GROUND_OFFSET, q[2]], forward: fwd, frame: 0, walking: false, g: 1, drawn: true, hitched: true, side: TEAM.side };
  }
  /**
   * WAGONS3: THE TEAM OF AN OWNER'S WAGON THIS FRAME ('' mine) - each horse `{ position, forward, frame, walking, g,
   * drawn, hitched, side }`: `drawn` a billboard stands for it (the Small Cart's driven horse is the driver's own mount,
   * the rider drawn), `hitched` its traces reach the wagon, `side` where it stands across the pole, `g` the rig's grow.
   * Driven, the team stands at the hitch facing down the pole; parked in harness or following, the horse the runtime (or
   * the word) stands leads it, its mate beside it; my parked pair keeps its second horse in harness while the first is
   * away (I own two). A horse with no wagon to pull is itself, alone.
   */
  function teamOf(owner, s = owner === '' ? shown() : null, dt = 0, grows = _lastGrows) {
    const mine = owner === '';
    const p = mine ? null : _peers.get(owner);
    const w = mine ? s?.wagon ?? null : p?.wagon ?? null;
    const lone = mine ? s?.horse ?? null : p?.horse && p.shownHorse ? { ...p.horse, position: p.shownHorse, frame: p.walk?.animationFrame ?? 0 } : null;
    const f = w ? drawnFrameOf(owner, grows, mine ? s : undefined) : null;
    const parts = f ? partsOf(w.model) : null;
    const pair = !!parts?.driver && wagonHorsesOf(w.model) === 2;
    const hitch = w?.kind === HCC_WIRE_KIND.Trailing ? f?.hitch ?? null : null;
    if (f && parts && hitch) {   // driven
      const fwd = poleForward(f, parts, mine ? w.turn?.steer ?? 0 : p.turn?.steer ?? 0);
      const walk = teamWalk(owner, hitch, dt, f.g);
      return pair ? teamSidesOf(w.model).map((x) => drivenHorse(hitch, fwd, x * f.g, walk, f.g, true)) : [drivenHorse(hitch, fwd, 0, walk, f.g, false)];
    }
    _teamWalk.delete(owner);
    const out = [];
    const inHarness = !!lone && !!w && (w.kind === HCC_WIRE_KIND.Following || (w.kind === HCC_WIRE_KIND.Deployed && !!w.hitched));
    if (inHarness && parts) {
      for (const x of pair ? teamSidesOf(w.model) : [0]) {
        const f0 = lone.forward;
        out.push({ ...lone, position: [lone.position[0] + f0[2] * x, lone.position[1], lone.position[2] - f0[0] * x], g: 1, drawn: true, hitched: true, side: x });
      }
      return out;
    }
    if (lone) out.push({ ...lone, g: 1, drawn: true, hitched: false, side: 0 });
    if (mine && pair && w?.kind === HCC_WIRE_KIND.Deployed && (horses?.() ?? 1) >= 2) out.push(parkedPairHorse(w, parts));
    return out;
  }
  /**
   * WAGONS3: THE DRIVER'S SEAT OF AN OWNER'S DRIVEN BENCH WAGON AS DRAWN THIS FRAME ('' mine; `grows` the draw's - grown
   * with the rig under the Overworld): `{ feet, yaw, top, g, hands: [left, right] }` - the seated feet's floor, the way
   * they face (radians, the camera's), the hands' height over the feet (player/seatPose.js `top`), the rig's grow, and
   * where the hands hold the reins (seatPose's seatRigInput - the hands the seated body's rig is solved to). Null where
   * no bench wagon of theirs is driven (parked, following, the Small Cart, the classic model).
   */
  function driverDrawn(owner, grows = _lastGrows) {
    const s = owner === '' ? shown() : null;
    const w = owner === '' ? s?.wagon : _peers.get(owner)?.wagon;
    if (!w || w.kind !== HCC_WIRE_KIND.Trailing) return null;
    const f = drawnFrameOf(owner, grows, owner === '' ? s : undefined);
    const parts = f ? partsOf(w.model) : null;
    const seat = parts?.driver;
    if (!seat) return null;
    const local = pitchedPoint(parts, seat.feet, f.hitched ? parts.hitchPitch ?? 0 : 0).map((v) => v * f.g);
    const off = quatRotate(f.rotation, local), fwd = quatRotate(f.rotation, [0, 0, 1]);
    const feet = [f.at[0] + off[0], f.at[1] + off[1], f.at[2] + off[2]];
    const yaw = Math.atan2(fwd[0], fwd[2]) + (seat.yaw * Math.PI) / 180;
    const hands = seatRigInput(feet, yaw, seat.top).req.hands;
    const grown = (q) => [feet[0] + (q[0] - feet[0]) * f.g, feet[1] + (q[1] - feet[1]) * f.g, feet[2] + (q[2] - feet[2]) * f.g];
    return { feet, yaw, top: seat.top, g: f.g, hands: [grown(hands.L.at), grown(hands.R.at)] };
  }
  /** WAGONS3: my seat on my driven bench wagon where it truly stands (ungrown) - the hosts stand my camera and my body
   *  on it - or null while I drive none. */
  const driverSeat = () => driverDrawn('', {});
  /**
   * WAGONS3: ANOTHER PLAYER DRIVING A BENCH WAGON, DRAWN ON ITS BENCH - seatGlue's law for the driver: each entry of
   * `drawable` whose pose says the cart (`rd` 2 - their capsule at the puller, where their trailing wagon hangs from,
   * `peerAnchor`) and whose wagon drawn here has a driver's seat stands on that seat as drawn (driverDrawn - grown with
   * the rig under the Overworld), seated: `st` the reins' height over the feet (player/seatPose.js seatTopByte), `rd` 0
   * so no mount is drawn under them (the team is the pool's), `bench` 2 so the cart is still heard (net/remotePlayers.js),
   * and a `deck` so their pace reads still. The host reads `peerAnchor` off the poses BEFORE this glue: the wagon still
   * hangs from the puller. `toWire` the scene's point in the pose's frame.
   */
  function driverGlue(drawable, { toWire = (q) => q, grows = _lastGrows } = {}) {
    for (let i = 0; i < drawable.length; i++) {
      const d = drawable[i];
      if (!d?.shown || (d.shown.rd | 0) !== 2 || !_peers.has(d.id)) continue;
      const seat = driverDrawn(d.id, grows);
      if (!seat) continue;
      const w = toWire(seat.feet);
      drawable[i] = { ...d, shown: { ...d.shown, x: w[0], y: w[1], z: w[2], yaw: seat.yaw, st: seatTopByte(seat.top), rd: 0, bench: 2, deck: [0, 0, -1], deckKey: `wagon:${d.id}:driver` } };
    }
    return drawable;
  }
  /** WAGONS3: a driven wagon's body under its grow and its cart's hitched tilt - drawWagon's own matrix. */
  function bodyMatrixOf(f, parts) {
    const m = f.g > 1 ? mat4FromQuatPosScale(f.rotation, f.at, [f.g, f.g, f.g]) : wagonMatrix(f.at, f.rotation);
    return pitchedMatrix(m, parts, f.hitched ? parts.hitchPitch ?? 0 : 0);
  }
  /**
   * WAGONS3: THE HARNESS'S ENDS FOR AN OWNER THIS FRAME - `[{ kind, a, b, g }]`: each hitched horse's two traces from its
   * collar to their roots on the wagon (a pair's singletrees, turned with the pole; the Small Cart's shafts' roots,
   * tilted with its body), and a seated driver's reins from each hand to its horse's bit. Empty: nothing in harness.
   */
  function harnessEnds(owner) {
    const mine = owner === '';
    const p = mine ? null : _peers.get(owner);
    if (!mine && (!p || p.hidden)) return [];
    const s = mine ? shown() : null;
    const w = mine ? s?.wagon : p.wagon;
    const team = _teams.get(owner);
    if (!w || !team?.length) return [];
    const f = drawnFrameOf(owner, _lastGrows, mine ? s : undefined);
    const parts = f ? partsOf(w.model) : null;
    if (!parts?.traces?.length) return [];
    const body = bodyMatrixOf(f, parts);
    const steer = mine ? w.turn?.steer ?? 0 : p.turn?.steer ?? 0;
    const bogie = parts.bogie ? multiply(body, steeredMatrix(parts.bogie.kingpin, steer)) : body;
    const ends = [];
    for (const [hi, side, q, onBogie] of parts.traces) {
      const h = team.find((t) => t.hitched && Math.sign(t.side) === Math.sign(teamSidesOf(w.model)[hi])) ?? null;
      if (!h) continue;
      ends.push({ kind: 'trace', a: horsePoint(h, [side * TEAM.collar[0], TEAM.collar[1], TEAM.collar[2]]), b: transformPoint(onBogie ? bogie : body, q[0], q[1], q[2]), g: f.g });
    }
    const drv = driverDrawn(owner);
    if (drv) team.forEach((h) => { if (h.hitched && h.drawn) ends.push({ kind: 'rein', a: drv.hands[h.side < 0 ? 0 : 1], b: horsePoint(h, [TEAM.bit[0], TEAM.bit[1], TEAM.bit[2]]), g: f.g }); });
    return ends;
  }
  const _harness = new Map();   // owner -> { key, ropes, model, gpu }
  function dropHarness(owner) { const h = _harness.get(owner); if (h?.gpu) renderer?.destroyMesh?.(h.gpu); _harness.delete(owner); }
  /** WAGONS3: every owner's harness stepped on the frame's `dt` and its mesh refilled; one whose ropes changed (a horse
   *  hitched or loosed, a driver sat or rose) is laid again. */
  function stepHarness(dt) {
    for (const owner of ['', ..._peers.keys()]) {
      const ends = harnessEnds(owner);
      if (!ends.length) { dropHarness(owner); continue; }
      const key = ends.map((e) => e.kind[0]).join('');
      let h = _harness.get(owner);
      if (!h || h.key !== key) { dropHarness(owner); h = { key, ropes: ends.map((e) => newRope(e.kind)), model: null, gpu: null }; _harness.set(owner, h); }
      ends.forEach((e, i) => stepRope(h.ropes[i], e.a, e.b, dt, e.g));
      if (!renderer?.createMesh) continue;
      const model = h.model ?? (h.model = tubeModel(h.ropes.length, WAGON_ARCHIVE, WAGON_TEX.harness));
      h.ropes.forEach((r, i) => tubeInto(r, i, ROPE[r.kind].radius * Math.max(1, ends[i].g), model.positions, model.normals));
      if (h.gpu) renderer.updateMeshVertices?.(h.gpu, model.positions, model.normals);
      else { ensureWagonArt(); h.gpu = renderer.createMesh({ ...model, positions: model.positions.slice(), normals: model.normals.slice() }); }
    }
    for (const owner of [..._harness.keys()]) if (owner !== '' && !_peers.has(owner)) dropHarness(owner);
  }
  /** WAGONS3: every team's billboards turned to `cameraPos` - the eye that draws them, known only once the host has built
   *  its view (the bench's, the third person's, the travel view's), where frame() turned them to the eye it was handed. */
  function faceTeams(cameraPos) {
    if (!cameraPos) return;
    for (const [owner, team] of _teams) {
      let i = 0;
      for (const h of team) { if (!h.drawn) continue; const b = _horseBatches.get(teamKey(owner, i++)); if (b) poseHorseBatch(b, cameraPos, h, h.g); }
    }
  }
  /** WAGONS3: the harnesses in the world pass - world-space meshes, casting no shadow (a strap's would be a speckle). */
  function drawHarness(r) {
    let n = 0;
    for (const h of _harness.values()) if (h.gpu && r?.drawMesh) { r.drawMesh(h.gpu, WORLD_MATRIX, null, NO_SHADOW); n++; }
    return n;
  }
  /**
   * WAGONS3 (Mac: "Using a wagon doesnt allow you to zoom out into 3rd person"): HOW FAR ALONG A RAY MY DRIVEN WAGON'S
   * BODY STANDS - the third-person camera's wall while I sit its bench (the moving wagon stands no collider, so the
   * camera behind me stood inside the caravan). From `o` along unit `d` up to `max` m, less `radius` (the camera's
   * sphere); Infinity where the ray misses it, starts inside it, or no bench wagon of mine is driven.
   */
  function cameraHit(o, d, max, radius = 0) {
    const w = shown()?.wagon;
    if (!w || w.kind !== HCC_WIRE_KIND.Trailing) return Infinity;
    const parts = partsOf(w.model), box = parts?.cabin;
    if (!box || !parts.driver) return Infinity;
    const m = wagonMatrix(w.position, w.rotation);
    const t = [o[0] - m[12], o[1] - m[13], o[2] - m[14]];
    const lo = [m[0] * t[0] + m[1] * t[1] + m[2] * t[2], m[4] * t[0] + m[5] * t[1] + m[6] * t[2], m[8] * t[0] + m[9] * t[1] + m[10] * t[2]];
    const ld = [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(ld[k]) < 1e-9) { if (lo[k] < box.min[k] || lo[k] > box.max[k]) return Infinity; continue; }
      let a = (box.min[k] - lo[k]) / ld[k], b = (box.max[k] - lo[k]) / ld[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (!(t0 <= t1) || t0 < 0 || t0 > max) return Infinity;
    return Math.max(0, t0 - radius);
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
  /** WAGONS2 (FINAL AUDIT): seat `k` of another player's wagon where its WORD stands it (the pose the owner's frame
   *  carries, before this client eases it) - the seat their own companions are pinned to on their client. */
  function wordSeat(owner, k) {
    const p = _peers.get(owner);
    return p?.wagon ? seatWorld(p.wagon.model, p.wagon.position, p.wagon.rotation, k, p.wagon.kind !== HCC_WIRE_KIND.Deployed || p.wagon.hitched) : null;
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
  /** WAGONS2 (AUDIT): whether my wagon stands here to count its seats - shown, its model up (on a journey's road, or
   *  before the bake lands, mySeatCount counts none that are not gone). */
  const mySeatsKnown = () => { const w = shown()?.wagon; return !!(w && partsOf(w.model)); };
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
    // WAGONS2-VISIT (AUDIT): its owner the name the relay stamped on its record first - a kept record's peer id may be
    // anyone's after a drain; and the cell that keeps the record its listener's (the drawn pose can stand past an edge)
    const name = kept.name || peerName(p.ownerId ?? owner) || p.ownerName || null;
    return { ...door, k: kept.k, owner: name, entry: w.entry ?? 'private', guild: w.guild ?? null, look: w.look ?? null, at: [...p.wire.w.position], cell: kept.room ?? null };
  }

  // ── the floating origin
  function offsetAll(offset) {
    runtime?.rebase?.(offset);
    for (const p of _peers.values()) {
      for (const v of [p.shownHorse, p.shownWagon, ...(p.turn?.contacts ?? []).map((c) => c.p)]) if (v) { v[0] += offset[0]; v[1] += offset[1]; v[2] += offset[2]; }   // WAGONS2: and where each wheel last met the ground
    }
    // WAGONS3: the harness and a driven team's last step ride the shift - a rope across a crossing is not a leap
    for (const h of _harness.values()) for (const rope of h.ropes) {
      for (let i = 0; i < rope.n; i++) for (let k = 0; k < 3; k++) { rope.p[i * 3 + k] += offset[k]; rope.q[i * 3 + k] += offset[k]; }
      for (let k = 0; k < 3; k++) { rope.a[k] += offset[k]; rope.b[k] += offset[k]; }
    }
    for (const t of _teamWalk.values()) for (let k = 0; k < 3; k++) t.at[k] += offset[k];
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
  function dropPeer(owner) { dropTeamBatches(owner); dropHarness(owner); _teams.delete(owner); _teamWalk.delete(owner); _peers.delete(owner); _grownWheels.delete(owner); }
  /** The switch off, a teardown: nothing of anyone's stands (the kept words stay as DATA, so the switch back on shows
   *  the cell's parked teams again without waiting on a welcome - HCC-PARK). */
  function destroyAll() { _live.clear(); for (const owner of [..._peers.keys()]) dropPeer(owner); dropTeamBatches(''); dropHarness(''); _teams.delete(''); _teamWalk.delete(''); standWagonCollider(null); }

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
    if (!p.wagon) { p.shownWagon = null; p.shownRotation = null; p.turn = null; p.steer = 0; }   // WAGONS2: its wheels and bogie go with it
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
    wireRecord, applyOwner, sweepOwners, applyKept, replaceKept, pruneKept, parkWord, parkedDoor, mySeat, peerSeat, peerRide, mySeatCount, mySeatsKnown,
    seatDrawn, seatGlue, drawnFrameOf, puppetSeatDrawn, wordSeat,   // WAGONS2: the seats as drawn - the Overworld's grown wagons
    teamOf, driverDrawn, driverSeat, driverGlue, cameraHit, harnessEnds, faceTeams,   // WAGONS3: the team, the driver, the harness, the camera's wall
    get harness() { return _harness; }, capsuleInBox,
    visitTarget,   // WAGONS2-VISIT
    drawOutside,   // RW1 x WAGONS2: the wagons in the street a window looks out on
    get peers() { return _peers; }, get kept() { return _kept; }, get parts() { return partsOf(myKind()); }, partsOf, hitchOf,
    /** MERCHANT-YARDS (scenes/merchantYardsHost.js): A WAGON ON SHOW in a town's Wagon Yard - one of `kind`, standing
     *  empty, unhitched, its wheels at rest and its paint its own, at `position` turned by `rotation` (Unity's quaternion):
     *  drawn as a parked one is (drawWagon). Answers whether it drew (false while its parts still build). */
    drawShowWagon: (r, texRemap, position, rotation, kind) => drawWagon(r, texRemap, position, rotation, 0, null, 1, kind, false, null),
  };
}

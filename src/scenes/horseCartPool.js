// @ts-check
// HORSE CART AND CARGO - THE PRESENTATION (HCC, 2026-09-23). What the runtime (systems/horseCart.js) says, drawn:
// the trailing / following wagon and the parked one as the five pieces of classic model 41214 (systems/wagon41214.js
// - the body and shafts on the wagon's frame, each wheel turned about its own pivot), the cargo pieces the tier
// shows (WagonCargoVisual's twelve), and the horse as an eight-orientation billboard off the mod's own 45 PNGs
// (five drawn views, three mirrored - StationaryHorseBillboard). It also ANSWERS the runtime's physics
// (Physics.RaycastAll / SphereCast over the port's collider, the threats off the foe pool), stands the parked
// wagon's collider (the mod's non-trigger BoxCollider over the model's bounds), hands the hosts their activation
// targets and hover names, and - HCC-ONLINE - draws every peer's wagon and horse off their `hv` records the way
// camps.js draws a peer's camps.
//
// deps = { renderer, meshes: { getGpuMesh, cpuModels }, collider() -> the host's, now() -> unscaled seconds,
//          threats() -> [[x,y,z]] (the qualifying foes' positions, CollectThreats), fetchFn, selfId(),
//          peerName(id) -> string | null, onChanged() (the host's online publish), toWire(p) (the scene-to-wire law, so
//          the change key is the WIRE's and a floating-origin rebase of mine is not a word), log }
import { GLOBAL_SCALE, RAY_DISTANCE, pickActivatableHit } from '../player/activate.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { multiply } from '../world/mat4.js';
import { mat4FromQuatPos, mat4FromQuatPosScale, quatAngleAxis, quatLookRotation, quatSlerp, UNITY_QUAT_IDENTITY } from '../world/quat.js';
import { buildWagonParts, usableBounds, CARGO_DEFINITIONS, cargoPiecesShown } from '../systems/wagon41214.js';
import {
  WAGON_MODEL_ID, HORSE_VIEWS, HORSE_WALK_FRAMES, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_WALK_SPRITE_HEIGHT,
  calculateHorseOrientation, horseViewFor, horseTargetLabel, ACTIVATION_REACH, HORSE_BOX_CENTER, HORSE_BOX_SIZE,
  stepHorseWalk, freshHorseWalk, START_WALKING_SPEED, WAGON_MODE, HORSE_MODE,
} from '../systems/horseCartLaw.js';
import { PARK_REACH, PARK_TTL_MS } from '../net/wire.js';   // HCC-PARK: how far a kept team's parts may stand from its anchor, and how long the relay keeps one
import { WAGON_HOVER_TEXT } from '../player/eotbWagon.js';   // the hover word for a wagon - the noun of Eye Of The Beholder's Info line, so both carts read alike
import { hccWireRecord, validHccRecord, hccRecordKey, easeToward, HCC_WIRE_KIND } from '../systems/horseCartWire.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toColor32 } from '../formats/color32Order.js';

/** The horse art's archive key and record names on the renderer's texture map: `hcc_h<view>` a standing view,
 *  `hcc_w<view>#<frame>` a walk frame (the foes' own `record#frame` folding, scenes/exteriorFoes.js). */
export const HORSE_ARCHIVE = 'hcc';
export const horseStillRecord = (view) => `h${view}`;
export const horseWalkRecord = (view, frame) => `w${view}#${frame}`;
/** StationaryHorseVisual.Initialize [IL_40b7-IL_40d9]: 121 x 0.025 by 94 (or 95, the walk set) x 0.025. */
export const HORSE_BILLBOARD_WIDTH = HORSE_SPRITE_WIDTH * GLOBAL_SCALE;
export const HORSE_BILLBOARD_HEIGHT = HORSE_SPRITE_HEIGHT * GLOBAL_SCALE;
export const HORSE_WALK_BILLBOARD_HEIGHT = HORSE_WALK_SPRITE_HEIGHT * GLOBAL_SCALE;
/** The parked wagon's collider bucket on the host's collider - skipped by the runtime's own ground probes. */
export const WAGON_BUCKET = 'hccWagon';
/** AUDIT HCC O3: a peer's parked wagon stands a collider of its own - a physical thing to walk around, as mine is to
 *  them. Not in the runtime's skip list: the mod ignores its OWN wagon's colliders, and a peer's is any other box. */
export const peerWagonBucket = (owner) => `${WAGON_BUCKET}:${owner}`;
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

/** The twelve triangles of a local box (the mod's BoxCollider over the model's bounds) for the collider. */
export function boxTriangles(min, max) {
  const p = [
    min[0], min[1], min[2], max[0], min[1], min[2], max[0], max[1], min[2], min[0], max[1], min[2],
    min[0], min[1], max[2], max[0], min[1], max[2], max[0], max[1], max[2], min[0], max[1], max[2],
  ];
  const i = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { positions: new Float32Array(p), indices: new Uint32Array(i) };
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
  const _still = new Array(HORSE_VIEWS).fill(null);   // view -> true once uploaded
  let _stillLoading = null, _stillReady = false, _stillFailed = false;
  let _walkLoading = null, _walkReady = false;
  // the billboards: mine and the peers'
  const _horseBatches = new Map();   // owner ('' mine) -> batch
  // the peers: owner -> { wire: { w, h } (the validated record, WIRE frame), toScene, wagon, horse (this frame's targets,
  // SCENE frame), name, at, shownWagon, shownRotation, shownHorse, walk (the reader's own stride), bucketKey }
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
  /** The runtime's `presentation.wagonParts()`: the pivots, the radius and the bounds once the mesh is up, else null (it retries every second). */
  function wagonParts() { ensureParts(); return _parts; }

  // ── the horse art (HorseTextureSet.TryLoad / HorseWalkAnimationSet.TryLoad)
  function ensureStationary() {
    if (_stillReady) return true;
    if (_stillFailed || _stillLoading || !renderer?.uploadTexture) return false;
    _stillLoading = Promise.all(Array.from({ length: HORSE_VIEWS }, (_, v) => fetchPng(horseStillFile(v)).then((px) => {
      renderer.uploadTexture(HORSE_ARCHIVE, horseStillRecord(v), px);
      _still[v] = true;
    }))).then(() => { _stillReady = true; onChanged?.(); }).catch((e) => { _stillFailed = true; log?.error?.(`[TrailingWagon] the horse art would not load: ${e?.message ?? e}`); }).finally(() => { _stillLoading = null; });
    return false;
  }
  function ensureWalk() {
    if (_walkReady || _walkLoading || !renderer?.uploadTexture) return;
    const jobs = [];
    for (let v = 0; v < HORSE_VIEWS; v++) for (let f = 0; f < HORSE_WALK_FRAMES; f++) jobs.push(fetchPng(horseWalkFile(v, f)).then((px) => renderer.uploadTexture(HORSE_ARCHIVE, horseWalkRecord(v, f), px)));
    _walkLoading = Promise.all(jobs).then(() => { _walkReady = true; }).catch((e) => { log?.warn?.(`[TrailingWagon] the horse walk frames would not load; the standing views stay: ${e?.message ?? e}`); }).finally(() => { _walkLoading = null; });
  }
  const horseArt = { ensureStationary, ensureWalk, hasWalk: () => _walkReady, failed: () => _stillFailed };

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
  function standBox(bucket, m, prevKey) {
    const col = collider();
    if (!col?.addMesh || !_parts) return prevKey;
    if (m ? sameMatrix(m, prevKey) : prevKey === null) return prevKey;
    const key = m ? Float64Array.from(m) : null;
    col.removeBucket?.(bucket);
    if (!m) return null;
    const b = usableBounds(_parts.bounds);   // EnsureUsableBoundsSize [IL_10f1]
    const tri = boxTriangles(b.min, b.max);
    col.addMesh(bucket, tri.positions, tri.indices, m);
    return key;
  }
  function standWagonCollider(m) { _bucketKey = standBox(WAGON_BUCKET, m, _bucketKey); }
  /** AUDIT HCC O3: a peer's PARKED wagon is a box to walk around, as mine is to them; any other kind takes it down. */
  function standPeerCollider(owner, p) {
    const m = p.wagon?.kind === HCC_WIRE_KIND.Deployed && _parts ? wagonMatrix(p.wagon.position, p.wagon.rotation) : null;
    p.bucketKey = standBox(peerWagonBucket(owner), m, p.bucketKey);
  }

  // ── matrices
  const wagonMatrix = (position, rotation) => mat4FromQuatPos(rotation, position);
  const wheelMatrix = (m, pivot, angle) => multiply(m, mat4FromQuatPos(quatAngleAxis(angle, WHEEL_AXIS), pivot));
  const cargoMatrix = (m, def) => multiply(m, mat4FromQuatPosScale(def.rotation, def.position, def.scale));

  /** One wagon - mine or a peer's - in the host's world pass. */
  function drawWagon(r, texRemap, position, rotation, tier, angle) {
    if (!_parts?.gpu?.body || !r?.drawMesh) return false;
    const m = wagonMatrix(position, rotation);
    const g = _parts.gpu;
    r.drawMesh(g.body, m, texRemap);
    if (g.shaftLeft) r.drawMesh(g.shaftLeft, m, texRemap);
    if (g.shaftRight) r.drawMesh(g.shaftRight, m, texRemap);
    if (g.wheelLeft) r.drawMesh(g.wheelLeft, wheelMatrix(m, _parts.wheelLeftPivot, angle), texRemap);
    if (g.wheelRight) r.drawMesh(g.wheelRight, wheelMatrix(m, _parts.wheelRightPivot, angle), texRemap);
    for (const def of cargoPiecesShown(tier)) { const gpu = _cargo.get(def.modelId); if (gpu) r.drawMesh(gpu, cargoMatrix(m, def), texRemap); }
    return true;
  }

  /** What the runtime shows this frame, in one shape (the wire's, the draw's, the targets'). */
  function shown() {
    if (!runtime || !enabled) return null;
    const v = runtime.view();
    let wagon = null;
    if (v.deployed?.isGrounded) wagon = { kind: HCC_WIRE_KIND.Deployed, position: v.deployed.position, rotation: v.deployed.rotation, tier: v.deployed.cargoTier, angle: 0 };
    else if (v.moving?.pose?.active) wagon = { kind: v.teamFollowing ? HCC_WIRE_KIND.Following : HCC_WIRE_KIND.Trailing, position: v.moving.pose.position, rotation: v.moving.pose.rotation, tier: v.moving.cargoTier, angle: v.moving.wheel?.angle ?? 0 };
    const h = v.horse;
    const horse = h?.isInteractive ? { position: h.position, forward: h.forward, frame: h.walk?.animationFrame ?? 0, walking: !!h.walk?.walking } : null;
    return { wagon, horse, name: v.state?.HorseName ?? '', interaction: !!v.moving?.interaction, deployed: !!v.deployed?.isGrounded };
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
  function frame(dt, cameraPos, gameDt = dt) {
    if (!enabled) { if (_horseBatches.size || _peers.size || _bucketKey) destroyAll(); return; }
    runtime?.lateUpdate(gameDt);
    const s = shown();
    if (s?.wagon) ensureParts();   // a wagon shown before the runtime asked for the parts (a peer's, a restored one) starts the build
    if (s?.deployed && _parts && s.wagon) standWagonCollider(wagonMatrix(s.wagon.position, s.wagon.rotation)); else standWagonCollider(null);
    if (s?.horse && _stillReady) { const b = horseBatch(''); if (b) poseHorseBatch(b, cameraPos, s.horse); } else dropHorseBatch('');
    for (const [owner, p] of _peers) {
      retarget(p);   // AUDIT HCC O1: the wire frame, converted THIS frame - a rebase or a re-anchor of mine moves nothing of theirs
      if (p.horse) {
        const was = p.shownHorse;
        p.shownHorse = easeToward(p.shownHorse, p.horse.position, dt);
        // AUDIT HCC O5: the stride is the READER's (HorseWalkAnimationState over the shown pace), the owner says only
        // whether it walks - a frame on the wire changed the word twice a second while the horse merely stood
        const pace = was && dt > 0 ? Math.hypot(p.shownHorse[0] - was[0], p.shownHorse[2] - was[2]) / dt : 0;
        p.walk = stepHorseWalk(p.walk, p.horse.walking ? Math.max(pace, 2 * START_WALKING_SPEED) : 0, dt, _walkReady);
        if (_stillReady) { const b = horseBatch(owner); if (b) poseHorseBatch(b, cameraPos, { ...p.horse, position: p.shownHorse, frame: p.walk.animationFrame }); }
      } else { dropHorseBatch(owner); p.walk = freshHorseWalk(); }
      if (p.wagon) { p.shownWagon = easeToward(p.shownWagon, p.wagon.position, dt); p.shownRotation = p.shownRotation ? quatSlerp(p.shownRotation, p.wagon.rotation, 1 - Math.exp(-12 * dt)) : [...p.wagon.rotation]; }
      standPeerCollider(owner, p);
    }
    // HCC-ONLINE: a moved word asks for a frame (the host's stream reads `dirty`); a full frame carries it regardless.
    // AUDIT HCC O5: keyed in the WIRE frame, so my own rebase is not a word
    const key = hccRecordKey(hccWireRecord(s, toWire));
    if (key !== _lastKey) { _lastKey = key; onChanged?.(); }
  }
  const batches = () => [..._horseBatches.values()];
  function draw(r = renderer, texRemap = null) {
    let n = 0;
    const s = shown();
    if (s?.wagon && drawWagon(r, texRemap, s.wagon.position, s.wagon.rotation, s.wagon.tier, s.wagon.angle)) n++;
    for (const p of _peers.values()) if (p.wagon && p.shownWagon && drawWagon(r, texRemap, p.shownWagon, p.shownRotation ?? p.wagon.rotation, p.wagon.tier, p.wagon.angle)) n++;
    return n;
  }

  // ── the ray: the activation targets (RegisterCustomActivation at 3.2 - the runtime's ACTIVATION_REACH)
  const horseBox = (horse) => transformedAabb(HORSE_LOCAL_BOX, mat4FromQuatPos(quatLookRotation(horse.forward), horse.position));
  function targets() {
    const out = [];
    const s = shown();
    if (s?.wagon && _parts) {
      const box = transformedAabb(_parts.box, wagonMatrix(s.wagon.position, s.wagon.rotation));
      if (s.wagon.kind === HCC_WIRE_KIND.Deployed) out.push({ key: KEY_WAGON, aabb: aabbOf(box), distance: RAY_DISTANCE, reach: ACTIVATION_REACH });
      else if (s.wagon.kind === HCC_WIRE_KIND.Following && s.interaction) out.push({ key: KEY_FOLLOWING_WAGON, aabb: aabbOf(box), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true });
    }
    if (s?.horse) out.push({ key: KEY_HORSE, aabb: aabbOf(horseBox(s.horse)), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true });
    for (const [owner, p] of _peers) {
      // AUDIT HCC O3: a parked peer wagon with its box standing HAS a surface (the wall pardon applies, as mine)
      if (p.wagon && p.shownWagon && _parts) out.push({ key: peerKey(owner, 'w'), aabb: aabbOf(transformedAabb(_parts.box, wagonMatrix(p.shownWagon, p.shownRotation ?? p.wagon.rotation))), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: !p.bucketKey });
      // AUDIT HCC O9: a horse not drawn (its art still loading, or failed) is not named or pressed
      if (p.horse && p.shownHorse && _stillReady) out.push({ key: peerKey(owner, 'h'), aabb: aabbOf(horseBox({ ...p.horse, position: p.shownHorse })), distance: RAY_DISTANCE, reach: ACTIVATION_REACH, noSurface: true });
    }
    return out;
  }
  const peerOfKey = (key) => { if (typeof key !== 'string' || !key.startsWith('hccPeer:')) return null; const i = key.lastIndexOf(':'); return { owner: key.slice(8, i), what: key.slice(i + 1) }; };
  /** ACT-MENU: a word with the runtime's verbs for it, when it has any (none while the mod is not ready). */
  const withActions = (named, target) => { const actions = runtime?.actionRows?.(target) ?? []; return actions.length ? { ...named, actions } : named; };
  /** WORLD-HOVER: the plaque's word - the horse's name or "Horse" (HorseTargetLabel), "Wagon", and a peer's by whose it is. */
  function hoverName(key) {
    if (typeof key !== 'string') return null;
    // ACT-MENU: my own three carry the mod's verbs as the plaque's rows (horseCartLaw.js hccActionRows) - the wheel
    // lights one and the activate key presses it, in place of the interaction mode set beforehand
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
    if (pk.what === 'w') return { title: WAGON_HOVER_TEXT, subs: [owned] };
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
    if (key === KEY_WAGON) return runtime.handleDeployedWagonActivation(distance, mode);
    if (key === KEY_FOLLOWING_WAGON) return runtime.handleFollowingWagonActivation(distance, mode);
    if (key === KEY_HORSE) return runtime.handleStationaryHorseActivation(distance, mode);
    const pk = peerOfKey(key);
    if (!pk || !_peers.has(pk.owner)) return false;
    if (!(distance <= ACTIVATION_REACH)) { tooFar?.(); return true; }
    const n = hoverName(key);
    if (n) say?.(`${pk.what === 'w' ? 'This wagon' : `${n.title}`} - ${n.subs[0].charAt(0).toLowerCase()}${n.subs[0].slice(1)}.`);   // HCC-TIP: the press says what the plaque says
    return true;
  }

  // ── the floating origin
  function offsetAll(offset) {
    runtime?.rebase?.(offset);
    for (const p of _peers.values()) {
      for (const v of [p.shownHorse, p.shownWagon]) if (v) { v[0] += offset[0]; v[1] += offset[1]; v[2] += offset[2]; }
    }
    _bucketKey = null;   // the collider box stands again at the shifted pose on the next frame
  }
  /** Every transition and every load: the peers' LIVE words go (their art with them, where the cell keeps nothing of
   *  theirs); the runtime keeps its own record (the mod's handlers). HCC-PARK: the kept records are the cell's and
   *  go with the cell (pruneKept), not with a room change's puppets. */
  function clearPeers() { const owners = [..._live.keys()]; _live.clear(); for (const owner of owners) syncPeer(owner); for (const key of [..._peers.keys()]) if (!isKeptKey(key)) dropPeer(key); }
  function dropPeer(owner) {
    const p = _peers.get(owner);
    if (p?.bucketKey) collider()?.removeBucket?.(peerWagonBucket(owner));
    dropHorseBatch(owner); _peers.delete(owner);
  }
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
    if (!p) { p = { wire: null, toScene: null, wagon: null, horse: null, name: '', ownerId: null, ownerName: '', at: 0, kept: false, shownWagon: null, shownHorse: null, shownRotation: null, walk: freshHorseWalk(), bucketKey: null }; _peers.set(key, p); }
    p.wire = { w: v.w, h: v.h };
    p.toScene = v.toScene ?? ((q) => q);
    p.at = v.at ?? p.at;
    p.name = v.n ?? '';
    p.ownerId = v.ownerId; p.ownerName = v.ownerName ?? ''; p.kept = !!v.kept;
    retarget(p);
    if (!p.wagon) { p.shownWagon = null; p.shownRotation = null; }
    if (!p.horse) p.shownHorse = null;
    if (p.horse) { ensureStationary(); ensureWalk(); }
    if (p.wagon) ensureParts();
  }
  function syncPeer(owner) {
    const l = _live.get(owner) ?? null;
    showPeer(owner, l ? { w: l.w, h: l.h, n: l.h ? l.n : '', toScene: l.toScene, at: l.at, ownerId: owner, ownerName: '', kept: false } : null);
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
    _live.set(owner, { w: r.w ?? null, h: r.h ?? null, n: r.n ?? '', toScene, at: nowMs });
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
    if (wagonParked && rec?.w?.[0] === HCC_WIRE_KIND.Deployed) { r.w = [...rec.w]; r.w[9] = 0; }
    const near = (x, z) => Math.abs(x - a[0]) <= PARK_REACH && Math.abs(z - a[1]) <= PARK_REACH;
    if (horseParked && rec?.h && !v.horseFollowing && !v.teamFollowing && near(rec.h[0], rec.h[2])) { r.h = [...rec.h]; r.h[5] = 0; if (rec.n) r.n = rec.n; }
    if (r.w && !near(r.w[1], r.w[3])) delete r.w;
    return r.w || r.h ? { a, r } : { a };
  }

  return {
    attach(rt) { runtime = rt; return this; },
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
    presentation: { wagonParts, horseArt, onChanged: () => onChanged?.() },
    phys,
    frame, batches, draw, targets, hoverName, tooltipText, activate, offsetAll, destroyAll, clearPeers, shown,
    wireRecord, applyOwner, sweepOwners, applyKept, replaceKept, pruneKept, parkWord,
    get peers() { return _peers; }, get kept() { return _kept; }, get parts() { return _parts; },
  };
}

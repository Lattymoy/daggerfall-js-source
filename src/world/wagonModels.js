// @ts-check
// WAGONS1 (2026-10-09, Mac, sending his three wagons: "1. Is a replacement model for the current cart ingame 2. Theres
// an open wagon ... 3. Is a closed wagon varient"): THE THREE WAGONS, BUILT FOR THE CART'S PRESENTATION.
//
// Mac's models (src/assets/wagons/*.json, baked by tools/bakeWagons.mjs - each in its wagon's frame: metres, +x its
// right, +y up, +z the way it is pulled, the origin on the ground under its rear wheels' centres) built here into the
// PARTS Horse Cart and Cargo's presentation draws (scenes/horseCartPool.js; the classic model's are systems/
// wagon41214.js buildWagonParts): what stands still on the wagon's frame (`statics` - its body, its bench, its rear
// axle, the cart's shafts), the four-wheelers' front axle and pole turning on their kingpin (`bogie`, WAGONS2), each
// wheel re-based on its own turning centre with its own radius (`wheels`), the rear pair
// the two the parked wagon is grounded on (`wheelLeft` / `wheelRight` and their pivots, DeployedWagonVisual's two-wheel
// solve) and the wheels' radius (the ground the turning reads off) - and, the port's own: the cargo the wagon's
// fullness shows (`cargo`, WagonCargoVisual's twelve classic pieces laid in this wagon's bed), where a passenger sits
// (`seats`, the open wagon's), the cart's tilt on its axle (`hitchPitch`) and where its door is (`door`, the caravan's).
//
// THE LIFT. The mod's wagon stands NORMAL_GROUND_OFFSET (1 m) up from where its wheels meet the ground - its trailing
// pose is "settled a metre over the ground along its normal" (systems/horseFollow.js hitchedPoseStep) and its parked
// pose stands its wheels' pivots a radius over the ground (solveTwoWheelPose), and the classic model's origin is that
// metre over its wheels' feet. So every part is lifted DOWN that metre here, its pictures laid first on the bake's own
// heights (world/wagonArt.js's liveries are read on them): the wheels meet the ground at y -1 either way.
//
// THE CART'S TILT. Mac drew the Wagon Cart standing as a cart stands unhitched: tipped forward on its one axle until
// its shafts' tips rest on the ground (its bed 10.1 degrees down at the front - `CART_REST_PITCH_DEG`, read off its
// bottom). Hitched, a cart is borne level by the horse, so while a horse is in its shafts the presentation turns it
// back about its axle (`hitchPitch`) - its bed level, its shafts at the horse's flank 0.7 m up.
//
// Each face wears its picture by `wagonFaceSkin` (world/largeBoatModel.js faceSkin's law): the sides' liveries banded on their
// height, everything else tiled planar (world/galleonMesh.js planarUv), the wheels' faces and the caravan's ends laid
// whole on their pictures. Not a DFU member. Ledger A (WAGONS1).
import { WAGON_ARCHIVE, TEX, WAGON_TILE, BANDS, wagonArt } from './wagonArt.js';
import { toColor32 } from '../formats/color32Order.js';
import { MeshBench, prism, box, planarUv, sub, add, dot } from './galleonMesh.js';
import { benchPart } from './galleonModel.js';
import { pointsOf, boxOfPoints } from './shipKit.js';
import { quatAngleAxis, quatRotate, quatMultiply } from './quat.js';
import { NORMAL_GROUND_OFFSET } from '../systems/horseCartLaw.js';
import { CARGO_DEFINITIONS } from '../systems/wagon41214.js';
import { WAGON_KINDS, activeWagonKind, activeWagonItem } from '../systems/wagonKinds.js';
import { wagonLookOf } from '../systems/wagonLooks.js';   // WAGONS2: the driven wagon's paint

/** Where each wagon's bake is (fetched at the load, as the ships' are - systems/comeSailAwayModels.js). */
export const WAGON_MODEL_URLS = Object.freeze({
  cart: new URL('../assets/wagons/cart.json', import.meta.url).href,
  openWagon: new URL('../assets/wagons/openWagon.json', import.meta.url).href,
  caravan: new URL('../assets/wagons/caravan.json', import.meta.url).href,
});

/** How far down every part is lifted: the mod's own metre (above). */
export const LIFT = NORMAL_GROUND_OFFSET;

/** Each wagon's measurements in its frame (metres over the ground, before the lift): read off the bake and pinned
 *  there (test/wagons1.test.js). `floorY` the bed's (or the caravan's) floor, `sideX` the body's half width outside,
 *  `innerX` inside, `bedZ` the bed's run (back to front), `frontZ` the wagon's foremost point. */
export const MEASURED = Object.freeze({
  cart: Object.freeze({ axleY: 0.5445, floorY: 0.69, innerX: 1.0543, sideX: 1.1589, bedZ: Object.freeze([-0.37, 2.2]), frontZ: 3.14, bottomFront: Object.freeze([0.1452, 2.1778]), bottomBack: Object.freeze([0.6201, -0.4852]) }),
  openWagon: Object.freeze({ axleY: 0.7811, floorY: 1.0142, innerX: 1.2, sideX: 1.36, bedZ: Object.freeze([-0.6, 5.0]), frontZ: 5.65, frontAxle: Object.freeze([0, 0.824, 3.8659]) }),
  caravan: Object.freeze({ axleY: 0.7811, floorY: 0.9425, innerX: 1.2, sideX: 1.36, bedZ: Object.freeze([-0.7077, 5.1164]), frontZ: 6.25, frontAxle: Object.freeze([0, 0.824, 3.8659]), rearZ: -0.7077, endTopY: 3.5166 }),
});

/** THE CART'S REST: its bottom's fall from its back edge to its front (degrees) - as Mac drew it, unhitched. */
export const CART_REST_PITCH_DEG = (() => {
  const { bottomFront: f, bottomBack: b } = MEASURED.cart;
  return (Math.atan2(b[0] - f[0], f[1] - b[1]) * 180) / Math.PI;
})();

// ── the faces, textured ─────────────────────────────────────────────────────────────────────────────────────────────

const keyOf = (rec) => Object.keys(TEX).find((k) => TEX[k] === rec);
/** A wheel's face laid whole on the wheel's picture: its centre the picture's, `R` its radius (the face's corners
 *  measured off its own pivot - `pivot`, the bake's ground frame). */
const wheelUv = (pivot, R) => (p) => [0.5 + (p[2] - pivot[2]) / (2 * R), 0.5 + (p[1] - pivot[1]) / (2 * R)];
/** A caravan's end laid whole on its picture: across it (x - read from outside, so the door is the right way round)
 *  and up it from its foot to its gable's peak. */
const endUv = (sign) => (p) => {
  const m = MEASURED.caravan;
  return [0.5 + (sign * p[0]) / (2 * m.sideX), (p[1] - m.floorY) / (m.endTopY - m.floorY)];
};

/** Which picture a face of a wagon's baked part wears, and how it lies on it: `{ rec, uv(p) }`, or `{ band, u(p) }`
 *  a face of a livery (world/galleonModel.js benchPart's skins). `kind` the wagon, `role` the part, `n` the face's
 *  normal, `c` its centre, `pivot` / `R` a wheel's. */
export function wagonFaceSkin(kind, role, n, c, pivot = null, R = 1) {
  const tiled = (rec, key = keyOf(rec)) => ({ rec, uv: (p) => planarUv(p, n, WAGON_TILE[key]) });
  const banded = (name) => ({ band: BANDS[name], u: (p) => planarUv(p, n, [WAGON_TILE[name][0], 1])[0] });
  const up = n[1] > 0.7, down = n[1] < -0.7, side = Math.abs(n[0]) > 0.7, end = Math.abs(n[2]) > 0.7;
  if (role.startsWith('wheel')) return side ? { rec: TEX.wheel, uv: wheelUv(pivot ?? c, R) } : tiled(TEX.tyre);
  if (role.startsWith('axle') || role.startsWith('shaft')) return tiled(TEX.beam);
  if (role === 'bench' || role === 'step') return tiled(up ? TEX.bench : TEX.beam);
  const m = MEASURED[kind];
  const inward = side && dot(n, sub([0, c[1], c[2]], c)) > 0;   // a side wall's face looking into the wagon
  if (kind === 'cart') {
    if (down) return tiled(TEX.beam);
    if (up && c[1] < 1) return tiled(TEX.floor);   // the bed (it falls 10 degrees forward, as drawn: `up` still)
    if (up) return tiled(TEX.beam);                // the walls' top rail
    return tiled(inward || (end && c[2] < 0 && n[2] > 0) ? TEX.inner : TEX.side);
  }
  if (kind === 'openWagon') {
    if (down && c[1] < m.floorY + 0.1) return tiled(TEX.beam);    // the bed's underside
    if (up && c[1] < m.floorY + 0.1) return tiled(TEX.floor);     // the bed
    if (Math.abs(n[0]) > 0.95 && !inward && c[1] < 2.6) return banded('openSide');   // the side: its box, its tilt
    if (inward || down || (side && c[1] >= 2.6)) return tiled(c[1] < 1.62 && inward ? TEX.inner : TEX.tiltInner);
    if (end) return tiled(c[1] < 2.6 ? TEX.side : TEX.tilt);       // the box's and the tilt's edges at its ends
    return tiled(TEX.tilt);                                        // the tilt over the roof
  }
  // the caravan
  if (down) return tiled(TEX.beam);
  if (end && c[1] > m.floorY) return { rec: n[2] > 0 ? TEX.caravanFront : TEX.caravanRear, uv: endUv(n[2] > 0 ? -1 : 1) };
  if (Math.abs(n[0]) > 0.95) return banded('caravanSide');
  return tiled(TEX.caravanRoof);
}

// ── the parts ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The renderer's model of a bench's geometry (createMesh's shape: each sub-mesh its texture). */
export function rendererModelOf(g, name = 'Wagon') {
  if (!g) return null;
  const subMeshes = g.subMeshes.map((sm, k) => ({ textureArchive: g.slots[k].archive, textureRecord: g.slots[k].record, startIndex: sm.startIndex, primitiveCount: sm.primitiveCount }));
  return { name, positions: g.positions, normals: g.normals, uvs: g.uvs, indices: g.indices, subMeshes, doors: [] };
}
/** A finished geometry moved down the lift (its box with it). */
function lifted(g, dy = -LIFT) {
  if (!g) return g;
  for (let i = 1; i < g.positions.length; i += 3) g.positions[i] += dy;
  g.aabb.center[1] += dy;
  return g;
}

/** The pole a four-wheeler is drawn by (it has no shafts): from its front axle forward to where the horse stands
 *  (`hitch` m ahead of the rear axle, the kind's), a doubletree across its end and the hounds braced back to the axle. */
function poleGeometry(bench, kind) {
  const ax = MEASURED[kind].frontAxle, tip = [0, 1.0, WAGON_KINDS[kind].hitch - 1.25];
  prism(bench, TEX.beam, [0, ax[1], ax[2]], tip, 0.07, 0.055, 6, { tileV: WAGON_TILE.beam[1] });
  box(bench, TEX.beam, [0, tip[1], tip[2]], [0.55, 0.05, 0.05], { tile: WAGON_TILE.beam });
  for (const s of [-1, 1]) prism(bench, TEX.beam, [s * 0.7, ax[1], ax[2] - 0.05], [0, 0.88, ax[2] + 1.0], 0.035, 0.035, 5, { tileV: WAGON_TILE.beam[1] });
  prism(bench, TEX.iron, [0, tip[1], tip[2]], [0, tip[1], tip[2] + 0.25], 0.04, 0.025, 6);   // its iron
}

/** The radius a wheel rolls on: its pivot over the ground (its lowest corner - the bake's frame stands it there). */
const rollRadius = (part, pivot) => { let lo = Infinity; for (let i = 1; i < part.positions.length; i += 3) lo = Math.min(lo, part.positions[i]); return pivot[1] - lo; };

/** WAGONS2: the bake's parts that turn with a four-wheeler's front wheels on its kingpin (with the pole drawn here). */
export const BOGIE_ROLES = Object.freeze(['axleFront']);

/**
 * WAGONS2 (2026-10-09, Mac: "Real wheel movement"): THE LOCK - how far a four-wheeler's front axle may turn on its
 * kingpin (degrees, either way) before a front wheel's rim cuts into what stands beside it. Measured off the bake (its
 * ground frame, before the lift): each front wheel a disc of its roll radius about its pivot, its inner face at its
 * innermost x; each static part beside it (narrower than that face, its foot below the wheel's top) a wall at its
 * outermost x from its foot up. The rim meets a wall first at the end of the chord the wall's foot cuts across the
 * face (`c` its half, `reach` its end's run from the kingpin along the wagon), turned until `inner cos a - reach sin a`
 * comes in to the wall: a = acos(wall / hypot(inner, reach)) - atan2(reach, inner), where that end then stands along
 * the wall's run. The least such angle is the lock. Mac's open wagon and caravan: the body's side 1.3594 m out from its
 * foot 0.9425 m up, the front-left rim's face 1.4616 m out (0.10 m clear), radius 0.7811 - a chord's half of 0.7642,
 * so 6.85 degrees; the bench in front of the wheels would allow 12.7.
 * @param {any} bake @param {number[]} kingpin the bake frame's
 */
export function steerLimitOf(bake, kingpin) {
  const walls = bake.parts.filter((p) => !p.role.startsWith('wheel') && !BOGIE_ROLES.includes(p.role)).map((p) => boxOfPoints(pointsOf(p)));
  let lock = 90;
  for (const wheel of bake.parts.filter((p) => p.role.startsWith('wheelFront'))) {
    const pivot = wheel.origin, R = rollRadius(wheel, pivot), dz = pivot[2] - kingpin[2];
    const inner = Math.min(...pointsOf(wheel).map((q) => Math.abs(q[0])));
    for (const { min: lo, max: hi } of walls) {
      const wall = Math.max(Math.abs(lo[0]), Math.abs(hi[0]));
      if (wall >= inner || lo[1] >= pivot[1] + R) continue;   // not beside the wheel: across its face, or over its top
      const c = lo[1] > pivot[1] ? Math.sqrt(R * R - (lo[1] - pivot[1]) ** 2) : R;
      for (const [reach, side] of [[c + dz, 1], [c - dz, -1]]) {   // the chord's front end turning in, and its back end
        const a = Math.acos(wall / Math.hypot(inner, reach)) - Math.atan2(reach, inner);
        const z = kingpin[2] + side * (inner * Math.sin(a) + reach * Math.cos(a));
        if (z >= lo[2] && z <= hi[2]) lock = Math.min(lock, (a * 180) / Math.PI);
      }
    }
  }
  return lock;
}

/**
 * A wagon's parts from its bake (`bake` a parsed src/assets/wagons/*.json): every geometry built, its pictures laid,
 * lifted down the mod's metre. Pure; no renderer.
 * WAGONS2: a four-wheeler's front axle and pole are its `bogie` - their own geometry, turning on the `kingpin` (the
 * front axle's centre, lifted), with the `wheelbase` from the rear axle and the lock (`steerLimitOf`).
 * @param {any} bake
 */
export function wagonGeometry(bake) {
  const kind = bake?.wagon;
  if (!WAGON_KINDS[kind] || !Array.isArray(bake.parts)) throw new Error(`no wagon's bake (${kind})`);
  const statics = new MeshBench(WAGON_ARCHIVE);
  const front = kind !== 'cart' ? new MeshBench(WAGON_ARCHIVE) : null;   // WAGONS2: the bogie
  const wheels = [];
  let radius = 0, rear = 0, rearZ = 0, kingpin = null;
  for (const part of bake.parts) {
    if (part.role.startsWith('wheel')) {
      const pivot = part.origin;
      const R = rollRadius(part, pivot);
      const bench = new MeshBench(WAGON_ARCHIVE);
      benchPart(bench, part, { offset: pivot, role: part.role, keep: null, skin: (role, n, c) => wagonFaceSkin(kind, role, n, c, pivot, R) });
      wheels.push({ role: part.role, geometry: bench.finish(), pivot: [pivot[0], pivot[1] - LIFT, pivot[2]], radius: R });
      if (part.role.startsWith('wheelRear')) { radius += R; rear++; rearZ += pivot[2] / 2; }
    } else if (front && BOGIE_ROLES.includes(part.role)) {
      benchPart(front, part, { offset: [0, 0, 0], role: part.role, keep: null, skin: (role, n, c) => wagonFaceSkin(kind, role, n, c) });
      kingpin = part.origin;
    } else benchPart(statics, part, { offset: [0, 0, 0], role: part.role, keep: null, skin: (role, n, c) => wagonFaceSkin(kind, role, n, c) });
  }
  if (rear !== 2) throw new Error(`the ${kind} has ${rear} rear wheels`);
  if (front && !kingpin) throw new Error(`the ${kind} has no front axle`);
  if (front) poleGeometry(front, kind);
  const bogie = front ? { geometry: lifted(front.finish()), kingpin: [kingpin[0], kingpin[1] - LIFT, kingpin[2]], wheelbase: kingpin[2] - rearZ, steerLimit: steerLimitOf(bake, kingpin) } : null;
  return { kind, statics: lifted(statics.finish()), wheels, wheelRadius: radius / 2, bogie };
}

/** The bounds of every point a wagon's geometry has (its statics and its wheels in place) - the parked wagon's
 *  collider (DeployedWagonVisual's BoxCollider over the model's bounds). WAGONS2: its bogie as it stands straight. */
function boundsOf(geo) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const take = (p, at) => { for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k] + at[k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; } };
  take(geo.statics.positions, [0, 0, 0]);
  if (geo.bogie) take(geo.bogie.geometry.positions, [0, 0, 0]);
  for (const w of geo.wheels) take(w.geometry.positions, w.pivot);
  return { min, max, center: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

/** A point of the cart's LEVEL frame (its bed level, as it is borne hitched) in its drawn one (tipped on its axle as
 *  Mac drew it) - so what rides in it rides tipped with it. Every other wagon's frames are one. */
function fromLevel(kind, p) {
  if (kind !== 'cart') return p;
  const pivotY = MEASURED.cart.axleY - LIFT;
  const q = quatAngleAxis(CART_REST_PITCH_DEG, [1, 0, 0]);   // nose down by the rest's fall (Unity: +x turns +z down)
  const r = quatRotate(q, [p[0], p[1] - pivotY, p[2]]);
  return [r[0], r[1] + pivotY, r[2]];
}

/** The cargo a wagon's fullness shows: WagonCargoVisual's twelve classic pieces (systems/wagon41214.js
 *  CARGO_DEFINITIONS - their models, tiers, turns and sizes) moved into this wagon's bed - the classic bed's middle
 *  (x 0, z -0.79, its floor y -0.02) onto this one's, the open wagon's spread over the front of its bed (its back is
 *  the passengers'), none in the caravan (its load is inside it). In the wagon's lifted frame. */
export function cargoFor(kind) {
  if (kind === 'caravan') return [];
  const m = MEASURED[kind];
  const floor = m.floorY - LIFT, classicMid = -0.79, classicFloor = -0.0175;
  const [z0, z1] = kind === 'openWagon' ? [2.1, 4.6] : m.bedZ;
  const mid = (z0 + z1) / 2, stretch = kind === 'openWagon' ? 1.6 : 1.3;
  const tilt = kind === 'cart' ? quatAngleAxis(CART_REST_PITCH_DEG, [1, 0, 0]) : null;
  return CARGO_DEFINITIONS.map((d) => Object.freeze({
    threshold: d.threshold, modelId: d.modelId, scale: d.scale,
    position: fromLevel(kind, [d.position[0] * (m.innerX / 0.95), floor + (d.position[1] - classicFloor), mid + (d.position[2] - classicMid) * stretch]),
    rotation: tilt ? quatMultiply(tilt, d.rotation) : d.rotation,
  }));
}

/** Where a passenger sits in the open wagon's bed (the lifted frame): `feet` on its floor, `yaw` (degrees, the
 *  wagon's) the way they face - two a side along its back half, each facing across it. */
export function seatsFor(kind) {
  const n = WAGON_KINDS[kind]?.seats ?? 0;
  if (!n) return [];
  const m = MEASURED[kind], y = m.floorY - LIFT, x = m.innerX - 0.38;
  const at = [[-x, 0.1, 90], [x, 0.1, -90], [-x, 1.2, 90], [x, 1.2, -90]];
  return at.slice(0, n).map(([sx, z, yaw]) => Object.freeze({ feet: Object.freeze([sx, y, z]), yaw }));
}

/** The caravan's door: on its rear end, where its painted door stands (world/wagonArt.js caravanEndArt) - the point
 *  in front of it (lifted frame) a player walks out of the caravan onto, and the way they face (the wagon's, back). */
export function doorFor(kind) {
  if (kind !== 'caravan') return null;
  const m = MEASURED.caravan;
  return Object.freeze({ step: Object.freeze([0, -LIFT, m.rearZ - 1.1]), yaw: 180 });
}

/**
 * The parts the cart's presentation draws, from a wagon's geometry (`wagonGeometry`): `make(geometry, name)` turns
 * a geometry into whatever the caller draws (the pool's `rendererModelOf`; a test's identity). The classic contract
 * (systems/wagon41214.js buildWagonParts: body, the shafts, the wheels and their pivots, the radius, the bounds) with
 * the wagon's own beside it.
 */
export function buildBakedWagonParts(geo, make = rendererModelOf) {
  // WAGONS2: each wheel rolls on its own radius, and a four-wheeler's front pair turns with its bogie
  const wheels = geo.wheels.map((w) => ({ role: w.role, model: make(w.geometry, `Wagon_${w.role}`), pivot: w.pivot, radius: w.radius, front: !!geo.bogie && w.role.startsWith('wheelFront') }));
  const rearLeft = wheels.find((w) => w.role === 'wheelRearLeft'), rearRight = wheels.find((w) => w.role === 'wheelRearRight');
  return {
    kind: geo.kind,
    body: make(geo.statics, `Wagon_${geo.kind}`), shaftLeft: null, shaftRight: null,
    wheelLeft: rearLeft.model, wheelRight: rearRight.model,
    wheelLeftPivot: rearLeft.pivot, wheelRightPivot: rearRight.pivot,
    wheels, wheelRadius: geo.wheelRadius,
    bounds: boundsOf(geo),
    hitchPitch: geo.kind === 'cart' ? CART_REST_PITCH_DEG : 0,
    axlePivot: [0, (rearLeft.pivot[1] + rearRight.pivot[1]) / 2, (rearLeft.pivot[2] + rearRight.pivot[2]) / 2],
    cargo: cargoFor(geo.kind), seats: seatsFor(geo.kind), door: doorFor(geo.kind),
    bogie: geo.bogie ? { model: make(geo.bogie.geometry, `Wagon_${geo.kind}_bogie`), kingpin: geo.bogie.kingpin, wheelbase: geo.bogie.wheelbase, steerLimit: geo.bogie.steerLimit } : null,   // WAGONS2
  };
}

/** The whole wagon as one model, its wheels in place: the item's picture (ui/modelIcon.js's port door). */
export function wagonIconModel(geo) {
  const parts = [geo.statics, ...(geo.bogie ? [geo.bogie.geometry] : []), ...geo.wheels.map((w) => ({ ...w.geometry, positions: w.geometry.positions.map((v, i) => v + w.pivot[i % 3]) }))];
  const groups = new Map();
  for (const g of parts) g.subMeshes.forEach((sm, k) => {
    const rec = g.slots[k].record;
    const out = groups.get(rec) ?? { p: [], n: [], uv: [] };
    for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) {
      const v = g.indices[i];
      out.p.push(g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]);
      out.n.push(g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]);
      out.uv.push(g.uvs[v * 2], g.uvs[v * 2 + 1]);
    }
    groups.set(rec, out);
  });
  const recs = [...groups.keys()].sort((a, b) => a - b);
  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  for (const rec of recs) {
    const g = groups.get(rec), start = indices.length, base = positions.length / 3;
    positions.push(...g.p); normals.push(...g.n); uvs.push(...g.uv);
    for (let i = 0; i < g.p.length / 3; i++) indices.push(base + i);
    subMeshes.push({ textureArchive: WAGON_ARCHIVE, textureRecord: rec, startIndex: start, primitiveCount: (indices.length - start) / 3 });
  }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices), subMeshes, doors: [] };
}

/** A built wagon's static mesh as a world point: `p` in the lifted frame under the cart's hitched tilt (`pitch`
 *  degrees nose up about its axle, 0 for any other) - what a seat or a door is drawn and stood at. */
export function pitchedPoint(parts, p, pitch) {
  if (!pitch) return p;
  const a = parts.axlePivot, q = quatAngleAxis(-pitch, [1, 0, 0]);
  const r = quatRotate(q, sub(p, a));
  return add(r, a);
}

/** THE HOSTS' TWO WORDS (THE ONE CONSTRUCTION SEAM - scenes/world.js and scenes/exterior.js build the cart's pool, and
 *  each hands it these, so neither can forget one): `wagonKind` the kind the player drives off what they carry
 *  (systems/wagonKinds.js activeWagonKind - the Small Cart when they own none: the classic transport's), `bakedWagon`
 *  Mac's wagon of a kind, fetched once (a failed fetch is the pool's to fall back from). */
export function wagonPoolDeps(items, fetchFn = (u) => globalThis.fetch(u)) {
  const loads = new Map();
  return {
    wagonKind: () => activeWagonKind(items()) ?? 'cart',
    wagonLook: () => wagonLookOf(activeWagonItem(items())),   // WAGONS2: the driven wagon's paint
    bakedWagon: (kind) => {
      if (!loads.has(kind)) loads.set(kind, Promise.resolve(fetchFn(WAGON_MODEL_URLS[kind])).then((r) => { if (!r?.ok) throw new Error(`HTTP ${r?.status}`); return r.json(); }));
      return loads.get(kind);
    },
  };
}

/** WAGONS1: an item's picture of a wagon of `kind` (ui/modelIcon.js's port door): the whole wagon as one model, its
 *  pictures painted here - `{ model, texels(archive, record) }`, the shape the icon's rasteriser takes. */
export async function wagonIconSource(kind, fetchFn = (u) => globalThis.fetch(u)) {
  const r = await fetchFn(WAGON_MODEL_URLS[kind]);
  if (!r?.ok) throw new Error(`the ${kind}'s model: HTTP ${r?.status}`);
  const model = wagonIconModel(wagonGeometry(await r.json()));
  const pics = new Map(wagonArt().map(([rec, pic]) => [rec, toColor32(pic)]));
  return { model, texels: (arc, rec) => (arc === WAGON_ARCHIVE ? pics.get(rec) ?? null : null) };
}

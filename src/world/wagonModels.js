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
import { SEATED_HIP_HEIGHT } from '../player/seatPose.js';   // WAGONS3: the seated hips' height over the feet, the measured biped's

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
  openWagon: Object.freeze({ axleY: 0.7811, floorY: 1.0142, innerX: 1.2, sideX: 1.36, bedZ: Object.freeze([-0.6, 5.0]), frontZ: 5.65, frontAxle: Object.freeze([0, 0.824, 3.8659]), bench: Object.freeze({ y: 1.54, z: 5.28 }) }),
  caravan: Object.freeze({ axleY: 0.7811, floorY: 0.9425, innerX: 1.2, sideX: 1.36, bedZ: Object.freeze([-0.7077, 5.1164]), frontZ: 6.25, frontAxle: Object.freeze([0, 0.824, 3.8659]), rearZ: -0.7077, endTopY: 3.5166, bench: Object.freeze({ y: 2.476, z: 5.49 }) }),
});
/** WAGONS3: `bench` above - where the driver's hips sit on a front bench (metres, the bake's frame): `y` the bench's top
 *  under them, `z` their run - a thigh's length or less behind the bench's front edge, so the knees stand at its lip,
 *  and clear of the body's front wall behind them. Read off the bake (test/wagons3.test.js): the open wagon's bench is
 *  level at 1.525-1.556 m over 4.90-5.65 m, its back half under the body's front wall (5.12 m) - the hips 0.37 m before
 *  its edge, 0.16 m before the wall; the caravan's falls from 2.564 m at its back (4.81 m) to 2.417 m at its front
 *  (5.94 m), the hips a thigh (0.45 m) before its edge, and its step - the footboard before it, 1.88-1.92 m high - is
 *  where the seated feet come down. */

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
 *  (`hitch` m ahead of the rear axle, the kind's), a doubletree across its end and the hounds braced back to the axle.
 *  WAGONS3 (Mac: "requiring 2 horses"): a PAIR's pole - run on between the two horses to their collars (`TEAM.poleTip`
 *  past the hitch) with the neck yoke across its tip, and the doubletree across it behind their hocks, a singletree at
 *  each end where that horse's traces meet it (`TEAM.tree`). */
function poleGeometry(bench, kind) {
  const ax = MEASURED[kind].frontAxle, hitch = WAGON_KINDS[kind].hitch;
  const tip = [0, TEAM.yokeY, hitch + TEAM.poleTip], tree = TEAM.tree, tz = hitch - tree.back;
  prism(bench, TEX.beam, [0, ax[1], ax[2]], tip, 0.07, 0.05, 6, { tileV: WAGON_TILE.beam[1] });
  box(bench, TEX.beam, [0, tip[1], tip[2]], [TEAM.side - TEAM.collar[0] - 0.05, 0.025, 0.025], { tile: WAGON_TILE.beam });   // the neck yoke, between the collars (box's sizes are halves)
  box(bench, TEX.beam, [0, tree.y, tz], [TEAM.side, 0.03, 0.03], { tile: WAGON_TILE.beam });   // the doubletree, its ends at each horse's middle
  for (const s of [-1, 1]) box(bench, TEX.beam, [s * TEAM.side, tree.y, tz - 0.04], [tree.half, 0.025, 0.025], { tile: WAGON_TILE.beam });   // a singletree each, its ends at that horse's traces
  for (const s of [-1, 1]) prism(bench, TEX.beam, [s * 0.7, ax[1], ax[2] - 0.05], [0, 0.88, ax[2] + 1.0], 0.035, 0.035, 5, { tileV: WAGON_TILE.beam[1] });
  prism(bench, TEX.iron, [0, tip[1], tip[2]], [0, tip[1], tip[2] + 0.2], 0.04, 0.025, 6);   // its iron
}

/**
 * WAGONS3 (2026-10-10, Mac: "requiring 2 horses to use" and "Proper animated rope mechanics that connect the horses to
 * the wagon"): THE TEAM, measured on the horse the pool draws (scenes/horseCartPool.js - the mod's billboard, 121 x 94
 * pixels at the global scale: 3.03 m long, 2.35 m high, its body HORSE_BOX_SIZE's 2.6 m) in a horse's own frame (metres:
 * +x its right, +y up, +z the way it faces, the origin on the ground under its middle). A pair stands `side` either side
 * of the pole; each horse's two TRACES run from its `collar` (either side of its chest) back to the ends of its
 * singletree (`tree`: `back` behind its middle, `y` over the ground, `half` its half width - the bake's frame, before the
 * lift); the REINS from the driver's hands to its `bit`. The Small Cart's one horse pulls from its shafts' roots
 * (`cartTrace`, the bake's frame: either side of the body's front at the shafts' line). The neck yoke rides the pole's
 * tip `poleTip` past the hitch at `yokeY`.
 */
export const TEAM = Object.freeze({
  side: 0.65,
  collar: Object.freeze([0.24, 1.35, 0.75]),
  bit: Object.freeze([0, 1.7, 1.3]),
  tree: Object.freeze({ back: 1.55, y: 0.92, half: 0.3 }),
  cartTrace: Object.freeze([0.57, 0.62, 2.2]),
  poleTip: 0.5, yokeY: 1.15,
});
/** WAGONS3: where each horse of a kind's team stands across its hitch - its x in the wagon's frame (the pole's line):
 *  the Small Cart's one on it, a pair either side. */
export const teamSidesOf = (kind) => (WAGON_KINDS[kind]?.horses === 2 ? [-TEAM.side, TEAM.side] : [0]);
/** WAGONS3: THE DRIVER'S SEAT on a kind's front bench (the lifted frame): `feet` the seated feet's floor under the hips
 *  (the bench's top less SEATED_HIP_HEIGHT - player/seatPose.js's measured biped), `yaw` the way they face (the wagon's,
 *  degrees), `top` where the hands hold the reins over the feet (seatPose's `top`: the hands a forearm over it, before
 *  the hips). Null for a kind with no bench - the Small Cart's driver rides its horse, the mod's own way. The seat a
 *  pool stands is this one (buildBakedWagonParts `driver`), drawn under the cart's tilt as a back seat is (none tilts:
 *  the cart has none). */
// FLAGGED: the Small Cart has no bench (Mac's choice) - its driver rides its horse the mod's way, and RIDE-POV keeps the Morrowind body in the head on it (bible/06-Systems/Wagons.md WAGONS3).
export function driverSeatFor(kind) {
  const b = MEASURED[kind]?.bench;
  if (!b) return null;
  return Object.freeze({ feet: Object.freeze([0, b.y - SEATED_HIP_HEIGHT - LIFT, b.z]), yaw: 0, top: DRIVER_HANDS_TOP });
}
/** WAGONS3: the reins' hands over the seated feet - a hand's breadth over the lap (SEATED_HIP_HEIGHT), not a card
 *  table's SEAT_TOP_DEFAULT. */
export const DRIVER_HANDS_TOP = SEATED_HIP_HEIGHT + 0.11;
/** WAGONS3: where each trace meets the wagon (the lifted frame): `[horse, side, point, onBogie]` per trace - a pair's on
 *  their singletrees (which turn with the pole on the kingpin: `onBogie`), the Small Cart's at its shafts' roots (the
 *  body's frame, borne level with it). `horse` the team's index (teamSidesOf), `side` -1 its left trace, +1 its right. */
export function traceRootsOf(kind) {
  if (!WAGON_KINDS[kind]) return [];
  const out = [];
  if (kind === 'cart') {
    const [x, y, z] = TEAM.cartTrace;
    for (const s of [-1, 1]) out.push(Object.freeze([0, s, Object.freeze(fromLevel(kind, [s * x, y - LIFT, z])), false]));
    return out;
  }
  const hitch = WAGON_KINDS[kind].hitch, t = TEAM.tree;
  teamSidesOf(kind).forEach((hx, i) => { for (const s of [-1, 1]) out.push(Object.freeze([i, s, Object.freeze([hx + s * t.half, t.y - LIFT, hitch - t.back - 0.04]), true])); });
  return out;
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
  let radius = 0, rear = 0, rearZ = 0, kingpin = null, axleBox = null, cabinBox = null;
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
      axleBox = boxOfPoints(pointsOf(part));   // WAGONS3: the front axle's own reach - the parked box's, the pole's left out
    } else {
      benchPart(statics, part, { offset: [0, 0, 0], role: part.role, keep: null, skin: (role, n, c) => wagonFaceSkin(kind, role, n, c) });
      // WAGONS3: the body's own box - a third-person camera's wall. AUDIT WAGONS3 B1: the caravan's alone (`enterable`,
      // a room with walls and a roof) - the open wagon's body is its two hoops, and their box stood 5.6 cm behind its
      // bench, so every cast back from the driver's head met it at once and the camera never left the head
      if (part.role === 'body' && WAGON_KINDS[kind].enterable) cabinBox = boxOfPoints(pointsOf(part));
    }
  }
  if (rear !== 2) throw new Error(`the ${kind} has ${rear} rear wheels`);
  if (front && !kingpin) throw new Error(`the ${kind} has no front axle`);
  if (front) poleGeometry(front, kind);
  const reach = axleBox ? { min: [axleBox.min[0], axleBox.min[1] - LIFT, axleBox.min[2]], max: [axleBox.max[0], axleBox.max[1] - LIFT, axleBox.max[2]] } : null;
  const bogie = front ? { geometry: lifted(front.finish()), kingpin: [kingpin[0], kingpin[1] - LIFT, kingpin[2]], wheelbase: kingpin[2] - rearZ, steerLimit: steerLimitOf(bake, kingpin), reach } : null;
  const cabin = cabinBox ? { min: [cabinBox.min[0], cabinBox.min[1] - LIFT, cabinBox.min[2]], max: [cabinBox.max[0], cabinBox.max[1] - LIFT, cabinBox.max[2]] } : null;
  return { kind, statics: lifted(statics.finish()), wheels, wheelRadius: radius / 2, bogie, cabin };
}

/** The bounds of every point a wagon's geometry has (its statics and its wheels in place) - the parked wagon's
 *  collider (DeployedWagonVisual's BoxCollider over the model's bounds). WAGONS2: its bogie as it stands straight.
 *  WAGONS3 (Mac: "Spawning the wagon can trap you under the wagon"): its front axle, never its pole - a pair's pole runs
 *  on between the two horses to their collars, and a box to its tip stood round the team and the player beside it. */
function boundsOf(geo) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const take = (p, at) => { for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k] + at[k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; } };
  take(geo.statics.positions, [0, 0, 0]);
  if (geo.bogie?.reach) take([...geo.bogie.reach.min, ...geo.bogie.reach.max], [0, 0, 0]);
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
 * WAGONS3 (2026-10-10, Mac: "All the wagons/carts are oversized in the overworld"): A DRIVEN RIG'S GROW UNDER THE
 * OVERWORLD. OW-BIG grows the traveller `g` times (player/travelCamera.js tvOwnGrow - 10 at the view's own height) so a
 * body reads from hundreds of metres up, and WAGON-HITCH grew a driven wagon with its rider by the same `g`: a horse and
 * rider read 30 m long, and the wagons behind them 60, 95 and 100 m - longer than the towns they drove past. A rig is
 * drawn as long as RIG_READ_M grown by the traveller's `g` - a rider on horseback's length, a little more - whichever of
 * the three it is: `g` times RIG_READ_M over the rig's own length (its hitch, the horse's half before it, the rear
 * wheels' half behind the axle), never smaller than the rig itself (1) and never grown past `g`.
 */
export const RIG_READ_M = 4;
/** WAGONS3: a kind's driven rig, end to end (m): its hitch (`hitch` - the pool's, the classic wagon's 3.1 where it
 *  stands for the kind), a horse's half ahead of it (HORSE_BOX_SIZE's 2.6 m), its rear wheels' radius behind the axle. */
export const rigLengthOf = (kind, hitch = null) => { const k = WAGON_KINDS[kind] ? kind : 'cart'; return (Number.isFinite(hitch) && hitch > 0 ? hitch : WAGON_KINDS[k].hitch) + 1.3 + (k === 'cart' ? 0.57 : 0.8); };
/** WAGONS3: how many times a driven rig of `kind` (hitched `hitch` m ahead) is drawn under a traveller grown `g` times. */
export const rigGrowOf = (g, kind, hitch = null) => (g > 1 ? Math.max(1, g * Math.min(1, RIG_READ_M / rigLengthOf(kind, hitch))) : 1);

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
    cargo: cargoFor(geo.kind), seats: seatsFor(geo.kind), door: doorFor(geo.kind), driver: driverSeatFor(geo.kind), traces: traceRootsOf(geo.kind), cabin: geo.cabin ?? null,   // WAGONS3: the bench's driver, the traces' roots, the body's box
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

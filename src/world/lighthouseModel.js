// @ts-check
// SHIPYARDS (2026-10-11; asked what the lighthouse is, Mac chose "Climbable, with keeper - stone tower and keeper's
// cottage; the lamp lit from dusk with a sweeping beam seen far out at sea; the keeper lets you climb to the gallery for
// the view"): WHAT A PORT TOWN'S LIGHTHOUSE IS MADE OF - the port's own geometry in its own frame (y up from its ground,
// its FRONT - its gate and its doors, the town's side - along +z, the SEA behind it along -z, x across), worn in the
// port's own art (world/portArt.js) through the yards' face kit (world/merchantYards/merchantYardModels.js). Every face is wound
// outward and the collider is the same triangles - with one more: a GUARD round the gallery (`guardBand`), a closed
// corridor the eye never sees - a band from the floor just inside the parapet and a lid over it to the lantern - so
// neither a step back, nor a jump, nor a climb takes anyone off the gallery (AUDIT SHIPYARDS L4-1), stood by the pool
// while someone is on the gallery under it (its lid kept nobody coming down from landing).
//
// BEACON-TOWER (2026-10-11, Mac: "The lighthouse model is insanely good but way too modern for daggerfall's lore"): THE
// ILIAC BAY'S LIGHT IS A BEACON. The first tower was a lighthouse of the age of steam - whitewash and two red bands, a
// glazed lantern room in iron mullions, a copper dome and its vent ball, an iron railing - and the Third Era lights its
// coasts as a medieval coast was lit: a tower of bare stone with a fire on its head. Its shape and every point the climb,
// the guard and the keeper stand on are the first tower's; what it wears and what crowns it are the beacon's.
//
// THE COMPOUND (world/portSites.js PORT_FOOT.lighthouse, 13 m square): a low stone wall round cobbles, its gate in the
// front. THE TOWER stands toward the sea: a stone PLINTH, then the tower in grey ashlar, tapering, two string courses round
// it, slit windows up its faces, a studded door at its foot to the town under its lintel; at its head a CORBEL TABLE - three
// stepped stones under each face - carrying the gallery, and round the gallery a battlemented PARAPET, a merlon on every
// other face (a crenel to the town and one to the sea, where the climb comes out). On the gallery the LANTERN: an open
// stone arcade of eight round arches on their sills, a cornice over them, the lantern's ceiling under it, and a steep slate
// cone over that - the pepper-pot roof of High Rock's towers - an iron rod and vane at its point. In the lantern the
// BEACON: an iron brazier on a stone pedestal, its coals smouldering (`embers`: their own light, by day too), and its
// FLAMES - a mesh of their own (`buildLighthouseFire`), drawn casting no shadow, the lamp's light standing in them (AUDIT
// SHIPYARDS L5-2's law), and only in the lanterns' hours (scenes/portHost.js draw); the flames are no solid, the brazier
// and the stone are. A hatch in the gallery's floor on its town side is the way down. THE KEEPER'S COTTAGE stands beside
// it: whitewashed walls, a slate gable, a chimney, its door and windows to the yard; a bench, a water butt and the
// beacon's oil casks by the tower's door.
//
// The keeper is the host's (scenes/portHost.js), as are the light and its beams (`LIGHTHOUSE_POINTS.lamp`, the fire's
// middle), and the climb - the door at the tower's foot and the hatch at its head (`LIGHTHOUSE_POINTS`).
//
// Pure: no renderer, no GL, no clock. Not a DFU member. Ledger A (SHIPYARDS, BEACON-TOWER).
import { YARD_MESH_KIT, YARD_SINK, YARD_TILE_M } from './merchantYards/merchantYardModels.js';
import { PORT_ARCHIVE, PORT_REC } from './portArt.js';
import { PORT_FOOT } from './portSites.js';

const { faces, hexa, box, floor, drum, assemble, uvOf } = YARD_MESH_KIT;   // the yards' face kit

const R = PORT_REC;
const F = PORT_FOOT.lighthouse;
/** The tower's sides (a sixteen-sided prism, a face square to each axis), its middle, its plinth, its taper, its string
 *  courses, its gallery and parapet, its lantern and the beacon in it - metres in the lighthouse's frame. The gallery's
 *  `parapetR` is the parapet's inner face (its corners'): the walk's edge, which the guard stands just inside. */
export const TOWER_SIDES = 16;
export const LIGHTHOUSE = Object.freeze({
  wall: Object.freeze({ x0: -F.hx + 0.3, x1: F.hx - 0.3, z0: -F.hz + 0.3, z1: F.hz - 0.3, h: 1.0, t: 0.4, gate: 1.1 }),
  tower: Object.freeze({ x: 0, z: -1.7, plinthR: 3.35, plinthH: 1.0, r0: 2.85, r1: 2.1, top: 17.6, courses: Object.freeze([6.4, 12.4]), courseH: 0.3, courseOut: 0.1 }),
  gallery: Object.freeze({ r: 3.3, t: 0.3, parapetR: 3.0, parapetH: 1.0, merlonH: 0.5, corbels: 3, corbelH: 0.28, corbelW: 0.34, guardH: 2.2 }),
  lantern: Object.freeze({ r: 1.72, t: 0.3, sides: 8, sillH: 0.75, archH: 2.05, archW: 0.92, spring: 1.3, cornice: 0.2, roofH: 2.6, eaves: 0.26 }),
  brazier: Object.freeze({ pedestalR: 0.3, pedestalH: 0.95, r0: 0.22, r1: 0.52, h: 0.45, lip: 0.035, coals: 0.07, flameH: 1.15, flameW: 0.86 }),
  cottage: Object.freeze({ x0: 2.6, x1: 6.0, z0: 0.7, z1: 5.6, wallH: 2.6, ridge: 4.0 }),
  door: Object.freeze({ w: 1.1, h: 2.15 }),
});
const T = LIGHTHOUSE.tower, G = LIGHTHOUSE.gallery, L = LIGHTHOUSE.lantern, B = LIGHTHOUSE.brazier;
/** The tower's radius at height y (its taper from the plinth to the gallery). */
export const towerR = (y) => T.r0 + ((T.r1 - T.r0) * Math.max(0, Math.min(T.top, y) - T.plinthH)) / (T.top - T.plinthH);
/** The gallery's floor (y). */
export const GALLERY_Y = T.top + 0.0;
/** The lantern's height over the gallery's floor to its roof's point - its sills, its arches, its cornice and its roof
 *  (the rod and the vane over the point are iron a hand across). */
export const LANTERN_H = L.sillH + L.archH + L.cornice + L.roofH;
/** How far before the door's step a climb down stands the player (m): past a body's capsule (player/motor.js
 *  CAPSULE_RADIUS) by a hand, so the way down lands on the ground and not in the step. */
export const STEP_CLEAR = 0.5;
/** The door's step before the tower, in the lighthouse's frame - [x0, y0, z0, x1, y1, z1]. */
export const STEP_BOX = Object.freeze([T.x - 0.9, 0, T.z + T.plinthR - 0.05, T.x + 0.9, T.plinthH * 0.5, T.z + T.plinthR + 0.55]);
/** The lamp's middle - the beacon's fire - and where the people and the climb stand - [x, y, z] in the lighthouse's frame:
 *  the keeper by the tower's door; the door's foot (where a climb starts and a climb down ends, facing the town); the
 *  gallery's sea side (where the climb comes out, facing the sea); the hatch on its town side (the way down). */
export const LIGHTHOUSE_POINTS = Object.freeze({
  lamp: Object.freeze([T.x, GALLERY_Y + L.sillH + L.archH * 0.55, T.z]),
  keeper: Object.freeze([T.x - 1.6, 0, T.z + T.r0 + 1.25]),
  foot: Object.freeze([T.x, 0, T.z + T.plinthR + 0.55 + STEP_CLEAR]),   // AUDIT SHIPYARDS L4-4: before the door's step, never in it
  gallery: Object.freeze([T.x, GALLERY_Y, T.z - (L.r + G.parapetR) / 2]),
  hatch: Object.freeze([T.x, GALLERY_Y, T.z + (L.r + G.parapetR) / 2]),
});

const UP = Object.freeze([0, 1, 0]), DOWN = Object.freeze([0, -1, 0]);
/** A section of a prism about (cx, cz) of `sides` faces, a face square to each axis (its corners half a step round),
 *  from radius r0 at y0 to r1 at y1 - its sides alone, dressed in `rec`; `cap` lays its top too, `under` its foot.
 *  BEACON-TOWER: the top and the foot worn flat off the world's axes (uvOf), as a floor is - each slice wore the whole
 *  picture from the middle out, and the gallery's floor and the slab over the corbels showed a star of seams. */
function section(f, rec, cx, cz, sides, r0, r1, y0, y1, { cap = null, under = null } = {}) {
  const step = (Math.PI * 2) / sides, phase = step / 2;
  const p = (r, k, y) => [cx + Math.cos(phase + k * step) * r, y, cz + Math.sin(phase + k * step) * r];
  const around = (r0 + r1) * Math.PI / sides / YARD_TILE_M;
  for (let k = 0; k < sides; k++) {
    const mid = phase + (k + 0.5) * step, out = [Math.cos(mid), 0, Math.sin(mid)];
    const u0 = (k * around) % 8, u1 = u0 + around;
    f.quad(rec, p(r0, k, y0), p(r0, k + 1, y0), p(r1, k + 1, y1), p(r1, k, y1), [u0, y1 / YARD_TILE_M], [u1, y1 / YARD_TILE_M], [u1, y0 / YARD_TILE_M], [u0, y0 / YARD_TILE_M], out);
  }
  if (cap != null) for (let k = 0; k < sides; k++) {
    const m = [cx, y1, cz], q = p(r1, k + 1, y1), r = p(r1, k, y1);
    f.tri(cap, m, q, r, uvOf(m, UP), uvOf(q, UP), uvOf(r, UP));
  }
  if (under != null) for (let k = 0; k < sides; k++) {
    const m = [cx, y0, cz], q = p(r0, k, y0), r = p(r0, k + 1, y0);
    f.tri(under, m, q, r, uvOf(m, DOWN), uvOf(q, DOWN), uvOf(r, DOWN));
  }
}
/** Corner k of a ring of `sides` about the tower's axis at radius r and height y - section's corners. */
function corner(sides, r, k, y) {
  const a = Math.PI / sides + (k * Math.PI * 2) / sides;
  return [T.x + Math.cos(a) * r, y, T.z + Math.sin(a) * r];
}
/** BEACON-TOWER: a triangle wound to face `out` (the kit's `tri` takes its winding as its outside). */
function triOut(f, rec, a, b, c, ua, ub, uc, out) {
  const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], g = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e[1] * g[2] - e[2] * g[1], e[2] * g[0] - e[0] * g[2], e[0] * g[1] - e[1] * g[0]];
  if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) f.tri(rec, a, c, b, ua, uc, ub);
  else f.tri(rec, a, b, c, ua, ub, uc);
}
/** BEACON-TOWER: A RING OF STONE about the tower's axis - its faces k0 to k1 of `sides`, from radius rIn to rOut (the
 *  corners'), y0 to y1: its outer faces outward, its inner faces inward, its top (`top`), and its two ends where it stops
 *  short of a whole ring (`ends`). Its courses run on from piece to piece (v off the height). */
function ring(f, rec, sides, k0, k1, rIn, rOut, y0, y1, { top = true, ends = false } = {}) {
  const step = (Math.PI * 2) / sides, chord = 2 * Math.sin(step / 2), vb = -y0 / YARD_TILE_M, vt = -y1 / YARD_TILE_M;
  for (let k = k0; k < k1; k++) {
    const mid = (k + 1) * step, out = [Math.cos(mid), 0, Math.sin(mid)];
    for (const [r, n] of [[rOut, out], [rIn, [-out[0], 0, -out[2]]]]) {
      const u0 = (k * chord * r) / YARD_TILE_M, u1 = u0 + (chord * r) / YARD_TILE_M;
      f.quad(rec, corner(sides, r, k, y0), corner(sides, r, k + 1, y0), corner(sides, r, k + 1, y1), corner(sides, r, k, y1), [u0, vb], [u1, vb], [u1, vt], [u0, vt], n);
    }
    if (top) ringTop(f, rec, sides, k, rIn, rOut, y1);
  }
  if (ends) for (const [k, s] of [[k0, -1], [k1, 1]]) {
    const ang = step / 2 + k * step, n = [-Math.sin(ang) * s, 0, Math.cos(ang) * s];   // along the ring, out of the piece
    const a = corner(sides, rIn, k, y0), b = corner(sides, rOut, k, y0), c = corner(sides, rOut, k, y1), d = corner(sides, rIn, k, y1);
    f.quad(rec, a, b, c, d, uvOf(a, n), uvOf(b, n), uvOf(c, n), uvOf(d, n), n);
  }
}
/** The top of face k of a ring - from rIn to rOut at height y, facing up. */
function ringTop(f, rec, sides, k, rIn, rOut, y) {
  const a = corner(sides, rIn, k, y), b = corner(sides, rIn, k + 1, y), c = corner(sides, rOut, k + 1, y), d = corner(sides, rOut, k, y);
  f.quad(rec, a, b, c, d, uvOf(a, UP), uvOf(b, UP), uvOf(c, UP), uvOf(d, UP), UP);
}

/** The tower's flat face square to +z or -z at height y, `out` proud of it (its z). */
const faceZ = (zSide, y, out) => T.z + zSide * (towerR(y) * Math.cos(Math.PI / TOWER_SIDES) + out);
/** A flat panel on the tower's face square to +z or -z (its door, its windows), standing proud of it by `out` - leaning
 *  with the tower's taper, each edge on the face at its own height (AUDIT SHIPYARDS L5-3: laid flat, a door's foot sank
 *  into the wall and its head stood off it). */
function onFace(f, rec, zSide, x0, x1, y0, y1, out = 0.03) {
  const za = faceZ(zSide, y0, out), zb = faceZ(zSide, y1, out);
  if (zSide > 0) f.quad(rec, [T.x + x1, y0, za], [T.x + x0, y0, za], [T.x + x0, y1, zb], [T.x + x1, y1, zb], [0, 1], [1, 1], [1, 0], [0, 0], [0, 0, 1]);
  else f.quad(rec, [T.x + x0, y0, za], [T.x + x1, y0, za], [T.x + x1, y1, zb], [T.x + x0, y1, zb], [0, 1], [1, 1], [1, 0], [0, 0], [0, 0, -1]);
}

function tower(f) {
  // the plinth, its footing sunk; then the tower, ashlar from the plinth to its head, two string courses round it
  section(f, R.stone, T.x, T.z, TOWER_SIDES, T.plinthR, T.plinthR, -YARD_SINK, T.plinthH, { cap: R.stone });
  section(f, R.stone, T.x, T.z, TOWER_SIDES, towerR(T.plinthH), towerR(T.top), T.plinthH, T.top - G.t, { cap: R.stone });
  for (const y of T.courses) stringCourse(f, y);
  // its door to the town, a lintel over it, a step before it; its slit windows up the town's face and the sea's
  const D = LIGHTHOUSE.door;
  onFace(f, R.door, 1, -D.w / 2, D.w / 2, T.plinthH, T.plinthH + D.h, 0.04);
  const lz = faceZ(1, T.plinthH + D.h, 0);   // the lintel set into the wall at its own height
  box(f, R.stone, T.x - D.w / 2 - 0.2, T.plinthH + D.h, lz - 0.1, T.x + D.w / 2 + 0.2, T.plinthH + D.h + 0.25, lz + 0.25);
  box(f, R.stone, ...STEP_BOX, { top: R.stone });
  for (const wy of [4.2, 9.4, 14.8]) onFace(f, R.window, 1, -0.22, 0.22, wy, wy + 1.0);
  for (const wy of [3.4, 8.6, 15.2]) onFace(f, R.window, -1, -0.22, 0.22, wy, wy + 1.0);
}
/** A STRING COURSE round the tower at y: a band of stone `courseOut` proud of the wall, `courseH` high, following the
 *  taper - its face, its top and its underside run back into the wall. */
function stringCourse(f, y) {
  const y1 = y + T.courseH, o = T.courseOut;
  section(f, R.stone, T.x, T.z, TOWER_SIDES, towerR(y) + o, towerR(y1) + o, y, y1);
  for (let k = 0; k < TOWER_SIDES; k++) {
    ringTop(f, R.stone, TOWER_SIDES, k, towerR(y1) - 0.05, towerR(y1) + o, y1);
    const a = corner(TOWER_SIDES, towerR(y) - 0.05, k, y), b = corner(TOWER_SIDES, towerR(y) - 0.05, k + 1, y);
    const c = corner(TOWER_SIDES, towerR(y) + o, k + 1, y), d = corner(TOWER_SIDES, towerR(y) + o, k, y);
    f.quad(R.stone, a, b, c, d, uvOf(a, DOWN), uvOf(b, DOWN), uvOf(c, DOWN), uvOf(d, DOWN), DOWN);
  }
}

function gallery(f) {
  const y0 = T.top - G.t, y1 = GALLERY_Y;
  // the floor slab over its CORBEL TABLE: under each of the tower's faces three stones stepped out, the top one to the
  // slab's edge (a machicolated head, as the Bay's keeps carry their walks)
  section(f, R.stone, T.x, T.z, TOWER_SIDES, G.r, G.r, y0, y1, { cap: R.stone, under: R.stone });
  const step = (Math.PI * 2) / TOWER_SIDES, apo = Math.cos(step / 2), w = G.corbelW / 2;
  for (let k = 0; k < TOWER_SIDES; k++) {
    const a = (k + 1) * step, c = Math.cos(a), s = Math.sin(a);
    const P = (r, t, y) => [T.x + c * r - s * t, y, T.z + s * r + c * t];
    const wall = towerR(y0) * apo, reach = G.r * apo - 0.06 - wall;
    for (let j = 0; j < G.corbels; j++) {
      const yt = y0 - j * G.corbelH, yb = yt - G.corbelH, r0 = towerR(yb) * apo - 0.12, r1 = wall + (reach * (G.corbels - j)) / G.corbels;
      hexa(f, R.stone, [P(r0, -w, yb), P(r1, -w, yb), P(r1, w, yb), P(r0, w, yb), P(r0, -w, yt), P(r1, -w, yt), P(r1, w, yt), P(r0, w, yt)], { under: true });
    }
  }
  // THE PARAPET round the walk: its wall all round to `parapetH`, and a merlon on every other face to `merlonH` over it -
  // the crenels to the town and to the sea (faces 3 and 11) open, where the hatch is and where the climb comes out
  const yp = y1 + G.parapetH;
  ring(f, R.stone, TOWER_SIDES, 0, TOWER_SIDES, G.parapetR, G.r, y1, yp, { top: false });
  for (let k = 0; k < TOWER_SIDES; k++) {
    if (k % 2 === 0) ring(f, R.stone, TOWER_SIDES, k, k + 1, G.parapetR, G.r, yp, yp + G.merlonH, { ends: true });
    else ringTop(f, R.stone, TOWER_SIDES, k, G.parapetR, G.r, yp);
  }
  // the hatch in the floor on the town's side: its frame and its lid, a centimetre proud of it (as the yards' posts stand
  // off their walls: nearer is one plane to the depth buffer at a distance)
  const [hx, , hz] = LIGHTHOUSE_POINTS.hatch;
  box(f, R.wood, hx - 0.45, y1, hz - 0.4, hx + 0.45, y1 + 0.06, hz + 0.4);
  f.quad(R.door, [hx - 0.38, y1 + 0.07, hz + 0.33], [hx + 0.38, y1 + 0.07, hz + 0.33], [hx + 0.38, y1 + 0.07, hz - 0.33], [hx - 0.38, y1 + 0.07, hz - 0.33], [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]);
  box(f, R.iron, hx - 0.04, y1 + 0.07, hz + 0.05, hx + 0.04, y1 + 0.125, hz + 0.22);   // its ring
}

/** The lantern's arches: each face's opening `archW` across over its sill, its jambs to the springing `spring` over the
 *  sill, then a half-round of ARCH_STEPS stones - [s across the face, y over the gallery's floor, the angle] each, left to
 *  right. */
export const ARCH_STEPS = 8;
const archCurve = () => Array.from({ length: ARCH_STEPS + 1 }, (_, i) => {
  const a = Math.PI - (i * Math.PI) / ARCH_STEPS;
  return [(L.archW / 2) * Math.cos(a), L.sillH + L.spring + (L.archW / 2) * Math.sin(a), a];
});
/** The crown of the lantern's arches over the gallery's floor. */
export const ARCH_CROWN = L.sillH + L.spring + L.archW / 2;

/** THE LANTERN: eight faces of stone `t` thick round the beacon, each opened by a round arch over its sill - its face
 *  either side of the arch and under it, the strips over the arch's stones up to the cornice, inside and out; its
 *  jambs, its sill's top and its soffit through the wall - then the cornice, the lantern's ceiling under it, the roof. */
function lantern(f) {
  const n = L.sides, step = (Math.PI * 2) / n, half = step / 2;
  const ao = L.r * Math.cos(half), ai = ao - L.t, ho = L.r * Math.sin(half), hi = ai * Math.tan(half);
  const y0 = GALLERY_Y, ys = y0 + L.sillH, yk = ys + L.spring, yt = ys + L.archH, w2 = L.archW / 2;
  const arch = archCurve().map(([s, y, a]) => [s, y0 + y, a]);
  const T_ = YARD_TILE_M, V = (y) => -y / T_;
  for (let k = 0; k < n; k++) {
    const phi = (k + 1) * step, nx = Math.cos(phi), nz = Math.sin(phi), tx = -nz, tz = nx;
    const P = (s, d, y) => [T.x + nx * d + tx * s, y, T.z + nz * d + tz * s];
    const U = (s) => (s + k * 2 * ho) / T_;
    for (const [d, h, N] of [[ao, ho, [nx, 0, nz]], [ai, hi, [-nx, 0, -nz]]]) {
      f.quad(R.stone, P(-h, d, y0), P(-w2, d, y0), P(-w2, d, yt), P(-h, d, yt), [U(-h), V(y0)], [U(-w2), V(y0)], [U(-w2), V(yt)], [U(-h), V(yt)], N);
      f.quad(R.stone, P(w2, d, y0), P(h, d, y0), P(h, d, yt), P(w2, d, yt), [U(w2), V(y0)], [U(h), V(y0)], [U(h), V(yt)], [U(w2), V(yt)], N);
      f.quad(R.stone, P(-w2, d, y0), P(w2, d, y0), P(w2, d, ys), P(-w2, d, ys), [U(-w2), V(y0)], [U(w2), V(y0)], [U(w2), V(ys)], [U(-w2), V(ys)], N);
      for (let i = 0; i < ARCH_STEPS; i++) {
        const [sa, ya] = arch[i], [sb, yb] = arch[i + 1];
        f.quad(R.stone, P(sa, d, ya), P(sb, d, yb), P(sb, d, yt), P(sa, d, yt), [U(sa), V(ya)], [U(sb), V(yb)], [U(sb), V(yt)], [U(sa), V(yt)], N);
      }
    }
    // through the wall: the jambs facing into the opening, the sill's top, the arch's soffit facing its middle
    const D = (d) => d / T_;
    f.quad(R.stone, P(-w2, ao, ys), P(-w2, ai, ys), P(-w2, ai, yk), P(-w2, ao, yk), [D(ao), V(ys)], [D(ai), V(ys)], [D(ai), V(yk)], [D(ao), V(yk)], [tx, 0, tz]);
    f.quad(R.stone, P(w2, ao, ys), P(w2, ai, ys), P(w2, ai, yk), P(w2, ao, yk), [D(ao), V(ys)], [D(ai), V(ys)], [D(ai), V(yk)], [D(ao), V(yk)], [-tx, 0, -tz]);
    f.quad(R.stone, P(-w2, ai, ys), P(w2, ai, ys), P(w2, ao, ys), P(-w2, ao, ys), [U(-w2), D(ai)], [U(w2), D(ai)], [U(w2), D(ao)], [U(-w2), D(ao)], UP);
    for (let i = 0; i < ARCH_STEPS; i++) {
      const [sa, ya, aa] = arch[i], [sb, yb, ab] = arch[i + 1], am = (aa + ab) / 2, cm = Math.cos(am), sm = Math.sin(am);
      const ua = (i * Math.PI * w2) / ARCH_STEPS / T_, ub = ((i + 1) * Math.PI * w2) / ARCH_STEPS / T_;
      f.quad(R.stone, P(sa, ao, ya), P(sb, ao, yb), P(sb, ai, yb), P(sa, ai, ya), [ua, D(ao)], [ub, D(ao)], [ub, D(ai)], [ua, D(ai)], [-cm * tx, -sm, -cm * tz]);
    }
  }
  section(f, R.stone, T.x, T.z, n, L.r + 0.1, L.r + 0.1, yt, yt + L.cornice, { under: R.stone });   // the cornice; its underside the ceiling
  roof(f, yt + L.cornice);
}
/** THE ROOF: a steep cone of slate on the lantern's eight faces, from its eaves `eaves` out past the arches' faces to its
 *  point `roofH` over them, its eaves' underside out from the cornice; an iron rod at its point with a vane on it. */
function roof(f, ye) {
  const n = L.sides, re = L.r + L.eaves, rc = L.r + 0.1, top = [T.x, ye + L.roofH, T.z];
  const half = Math.PI / n, side = (2 * re * Math.sin(half)) / YARD_TILE_M, slant = Math.hypot(L.roofH, re * Math.cos(half)) / YARD_TILE_M;
  for (let k = 0; k < n; k++) {
    const mid = (k + 1) * 2 * half, a = corner(n, re, k, ye), b = corner(n, re, k + 1, ye);
    triOut(f, R.slate, a, b, top, [0, 0], [side, 0], [side / 2, -slant], [Math.cos(mid) * L.roofH, re * Math.cos(half), Math.sin(mid) * L.roofH]);
    const c = corner(n, rc, k, ye), d = corner(n, rc, k + 1, ye);
    f.quad(R.stone, c, d, b, a, uvOf(c, DOWN), uvOf(d, DOWN), uvOf(b, DOWN), uvOf(a, DOWN), DOWN);
  }
  const yp = top[1];
  drum(f, R.iron, T.x, T.z, 6, 0.035, 0.03, yp - 0.15, yp + 0.95, R.iron);
  drum(f, R.iron, T.x, T.z, 8, 0.075, 0.075, yp + 0.4, yp + 0.5, R.iron);
  box(f, R.iron, T.x + 0.04, yp + 0.62, T.z - 0.012, T.x + 0.46, yp + 0.86, T.z + 0.012, { under: true });   // the vane, a pennant of iron
}
/** THE BEACON'S BRAZIER: a stone pedestal, an iron bowl on it - its outside, its inside down to the coals, its lip - and
 *  its coals, smouldering (their own light, `embers`). */
function brazier(f) {
  const y0 = GALLERY_Y, yb = y0 + B.pedestalH, yr = yb + B.h, yc = yr - B.coals, n = 8, step = (Math.PI * 2) / n;
  drum(f, R.stone, T.x, T.z, n, B.pedestalR + 0.06, B.pedestalR, y0, yb, R.stone);
  const rAt = (y) => B.r0 + ((B.r1 - B.r0) * (y - yb)) / B.h;
  const p = (r, k, y) => [T.x + Math.cos(k * step) * r, y, T.z + Math.sin(k * step) * r];
  for (let k = 0; k < n; k++) {
    const m = (k + 0.5) * step, out = [Math.cos(m), 0, Math.sin(m)], inn = [-out[0], 0, -out[2]];
    const u = (2 * Math.PI * B.r1) / n / YARD_TILE_M;
    f.quad(R.iron, p(B.r0, k, yb), p(B.r0, k + 1, yb), p(B.r1, k + 1, yr), p(B.r1, k, yr), [0, B.h / YARD_TILE_M], [u, B.h / YARD_TILE_M], [u, 0], [0, 0], out);
    f.quad(R.iron, p(rAt(yc) - B.lip, k, yc), p(rAt(yc) - B.lip, k + 1, yc), p(B.r1 - B.lip, k + 1, yr), p(B.r1 - B.lip, k, yr), [0, B.coals / YARD_TILE_M], [u, B.coals / YARD_TILE_M], [u, 0], [0, 0], inn);
    const a = p(B.r1 - B.lip, k, yr), b = p(B.r1 - B.lip, k + 1, yr), c = p(B.r1, k + 1, yr), d = p(B.r1, k, yr);
    f.quad(R.iron, a, b, c, d, uvOf(a, UP), uvOf(b, UP), uvOf(c, UP), uvOf(d, UP), UP);
    f.tri(R.embers, [T.x, yc, T.z], p(rAt(yc) - B.lip, k + 1, yc), p(rAt(yc) - B.lip, k, yc), [0.5, 0.5], [0.5 + Math.cos((k + 1) * step) * 0.5, 0.5 + Math.sin((k + 1) * step) * 0.5], [0.5 + Math.cos(k * step) * 0.5, 0.5 + Math.sin(k * step) * 0.5]);
  }
}
/** THE BEACON'S FLAMES over its coals: three crossed sheets of fire through the brazier's middle, each both ways - the
 *  flame's picture a cutout, its tips at the picture's top. */
function beaconFire(f) {
  const yc = GALLERY_Y + B.pedestalH + B.h - B.coals, w = B.flameW / 2;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 12 + (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a), n = [-s, 0, c];
    const p = (u, y) => [T.x + c * u, y, T.z + s * u];
    const q = [p(-w, yc), p(w, yc), p(w, yc + B.flameH), p(-w, yc + B.flameH)];
    f.quad(R.flame, q[0], q[1], q[2], q[3], [0, 1], [1, 1], [1, 0], [0, 0], n);
    f.quad(R.flame, q[1], q[0], q[3], q[2], [0, 1], [1, 1], [1, 0], [0, 0], [-n[0], 0, -n[2]]);
  }
}

function cottage(f) {
  const C = LIGHTHOUSE.cottage, W = 0.3, zm = (C.z0 + C.z1) / 2;
  box(f, R.whitewash, C.x0, -YARD_SINK, C.z0, C.x1, C.wallH, C.z0 + W);
  box(f, R.whitewash, C.x0, -YARD_SINK, C.z1 - W, C.x1, C.wallH, C.z1);
  box(f, R.whitewash, C.x0, -YARD_SINK, C.z0, C.x0 + W, C.wallH, C.z1);
  box(f, R.whitewash, C.x1 - W, -YARD_SINK, C.z0, C.x1, C.wallH, C.z1);
  // the gables over its front and its back (the ridge along z), and the slate roof
  const xm = (C.x0 + C.x1) / 2;
  // AUDIT SHIPYARDS L5-1: the gable's apex at the roof's UNDERSIDE (its slab `t` under the ridge) - at the ridge its slopes
  // lay in the slate's own plane and the two pictures fought for every pixel
  const t = 0.14;
  for (const [a, b] of [[C.z0, C.z0 + W], [C.z1 - W, C.z1]]) {
    hexa(f, R.whitewash, [[C.x0, C.wallH, a], [C.x1, C.wallH, a], [C.x1, C.wallH, b], [C.x0, C.wallH, b], [xm - 0.01, C.ridge - t, a], [xm + 0.01, C.ridge - t, a], [xm + 0.01, C.ridge - t, b], [xm - 0.01, C.ridge - t, b]]);
  }
  const o = 0.3, slope = (C.ridge - C.wallH) / (xm - C.x0);
  for (const s of [-1, 1]) {
    const xe = s < 0 ? C.x0 - o : C.x1 + o, ye = C.wallH - o * slope;
    hexa(f, R.stone, [
      [xm, C.ridge - t, C.z0 - o], [xm, C.ridge - t, C.z1 + o], [xe, ye - t, C.z1 + o], [xe, ye - t, C.z0 - o],
      [xm, C.ridge, C.z0 - o], [xm, C.ridge, C.z1 + o], [xe, ye, C.z1 + o], [xe, ye, C.z0 - o],
    ], { top: R.slate, under: true, uv: (p, n) => (n[1] > 0.3 ? [p[2] / YARD_TILE_M, Math.abs(p[0] - xm) / YARD_TILE_M] : uvOf(p, n)) });
  }
  // its chimney on the back gable, its door and a window to the yard, a window to the front
  box(f, R.stone, xm - 0.4, C.wallH, C.z0 + 0.05, xm + 0.4, C.ridge + 0.9, C.z0 + 0.7, { top: R.tar });
  const door = [3.4, 4.4];
  f.quad(R.door, [C.x0 - 0.02, 0, door[1]], [C.x0 - 0.02, 0, door[0]], [C.x0 - 0.02, 2.0, door[0]], [C.x0 - 0.02, 2.0, door[1]], [0, 1], [1, 1], [1, 0], [0, 0], [-1, 0, 0]);
  f.quad(R.window, [C.x0 - 0.02, 1.0, 2.2], [C.x0 - 0.02, 1.0, 1.4], [C.x0 - 0.02, 1.8, 1.4], [C.x0 - 0.02, 1.8, 2.2], [0, 1], [1, 1], [1, 0], [0, 0], [-1, 0, 0]);
  f.quad(R.window, [3.9, 1.0, C.z1 + 0.02], [4.7, 1.0, C.z1 + 0.02], [4.7, 1.8, C.z1 + 0.02], [3.9, 1.8, C.z1 + 0.02], [1, 1], [0, 1], [0, 0], [1, 0], [0, 0, 1]);
  // a bench by its door, a water butt at its corner
  box(f, R.plank, C.x0 - 0.75, 0.42, 4.6, C.x0 - 0.4, 0.5, 5.45, { under: true });
  for (const z of [4.7, 5.35]) box(f, R.wood, C.x0 - 0.68, 0, z - 0.04, C.x0 - 0.47, 0.42, z + 0.04);
  drum(f, R.plank, WATER_BUTT[0], WATER_BUTT[1], 10, WATER_BUTT[2], WATER_BUTT[2], 0, 1.0, R.water);   // clear of the plinth and the casks (AUDIT SHIPYARDS L5-3)
}

function compound(f) {
  const Wl = LIGHTHOUSE.wall;
  floor(f, R.cobble, Wl.x0 + Wl.t, Wl.z0 + Wl.t, Wl.x1 - Wl.t, Wl.z1 - Wl.t);
  const cap = { top: R.stone };
  box(f, R.stone, Wl.x0, -YARD_SINK, Wl.z0, Wl.x1, Wl.h, Wl.z0 + Wl.t, cap);   // its back, to the sea
  box(f, R.stone, Wl.x0, -YARD_SINK, Wl.z0, Wl.x0 + Wl.t, Wl.h, Wl.z1, cap);
  box(f, R.stone, Wl.x1 - Wl.t, -YARD_SINK, Wl.z0, Wl.x1, Wl.h, Wl.z1, cap);
  box(f, R.stone, Wl.x0, -YARD_SINK, Wl.z1 - Wl.t, -Wl.gate, Wl.h, Wl.z1, cap);   // its front, either side of the gate
  box(f, R.stone, Wl.gate, -YARD_SINK, Wl.z1 - Wl.t, Wl.x1, Wl.h, Wl.z1, cap);
  for (const x of [-Wl.gate, Wl.gate]) box(f, R.stone, x - 0.25, -YARD_SINK, Wl.z1 - Wl.t - 0.05, x + 0.25, Wl.h + 0.45, Wl.z1 + 0.05, { top: R.stone });
  // the beacon's oil casks by the tower's door
  for (const [x, z] of OIL_CASKS) drum(f, R.plank, x, z, 10, 0.32, 0.32, 0, 0.82, R.wood);
}

/** The beacon's oil casks by the tower's door, [x, z] in its frame - off the plinth, the step and the water butt. */
export const OIL_CASKS = Object.freeze([Object.freeze([T.x + 1.45, T.z + T.plinthR + 0.3]), Object.freeze([T.x + 1.55, T.z + T.plinthR + 0.97])]);
/** The water butt at the cottage's corner, [x, z, r]. */
export const WATER_BUTT = Object.freeze([LIGHTHOUSE.cottage.x0 - 0.4, LIGHTHOUSE.cottage.z0 + 0.75, 0.4]);

/** THE LIGHTHOUSE, in its own frame: renderer.createMesh's model shape (and the collider's but the guard), under
 *  PORT_ARCHIVE - all but the beacon's flames (buildLighthouseFire). Pure. */
export function buildLighthouseModel() {
  const f = faces();
  compound(f);
  tower(f);
  gallery(f);
  lantern(f);
  brazier(f);
  cottage(f);
  return assemble(f, PORT_ARCHIVE);
}
/** BEACON-TOWER: THE BEACON'S FLAMES, a mesh of their own - drawn casting no shadow, since the lamp's light stands in them
 *  (AUDIT SHIPYARDS L5-2's law: the lantern's glass, a caster round its own lamp, shadowed it on every side), and only in
 *  the lanterns' hours (scenes/portHost.js draw); never in the collider - a fire is no floor and no wall. Pure. */
export function buildLighthouseFire() {
  const f = faces();
  beaconFire(f);
  return assemble(f, PORT_ARCHIVE);
}

/** THE GUARD round the gallery - collider alone, never drawn: a CORRIDOR, a band of the parapet's ring just inside it
 *  (so no stone of it is a step) from the gallery's floor to `guardH` over it, and a LID over the walk at that height from
 *  the lantern's faces out to the band, faces both ways. AUDIT SHIPYARDS L4-1: an open band over the rail let a climb, a
 *  boosted jump or a vault go over it - a twenty-metre fall - and walking into the rail stepped the body onto its edge.
 *  The pool stands it only while the feet are on the gallery under its lid (scenes/portHost.js guardFor): standing
 *  always, the lid was a floor to a body coming down onto the gallery from over it. `{ positions, indices }` in the
 *  lighthouse's frame. Pure. */
export function guardBand() {
  const positions = [], indices = [];
  const step = (Math.PI * 2) / TOWER_SIDES, y0 = GALLERY_Y, y1 = GALLERY_Y + G.guardH, rIn = G.parapetR - 0.08, rLid = L.r - 0.05;
  const p = (k, r, y) => [T.x + Math.cos(k * step + step / 2) * r, y, T.z + Math.sin(k * step + step / 2) * r];
  const quad = (a, b, c, d) => {
    const v = positions.length / 3;
    for (const q of [a, b, c, d]) positions.push(...q);
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3, v, v + 2, v + 1, v, v + 3, v + 2);
  };
  for (let k = 0; k < TOWER_SIDES; k++) {
    quad(p(k, rIn, y0), p(k + 1, rIn, y0), p(k + 1, rIn, y1), p(k, rIn, y1));   // the band, from the floor
    quad(p(k, rLid, y1), p(k + 1, rLid, y1), p(k + 1, rIn, y1), p(k, rIn, y1));   // the lid
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
/** The tower's door's box in the lighthouse's frame (the eye's: a press on it asks to climb), and the hatch's. */
export function doorBox() {
  const D = LIGHTHOUSE.door, z = T.z + towerR(T.plinthH);
  return [T.x - D.w / 2 - 0.1, T.plinthH - 0.1, z - 0.2, T.x + D.w / 2 + 0.1, T.plinthH + D.h + 0.1, z + 0.35];
}
export function hatchBox() {
  const [hx, hy, hz] = LIGHTHOUSE_POINTS.hatch;
  return [hx - 0.5, hy - 0.1, hz - 0.45, hx + 0.5, hy + 0.35, hz + 0.45];
}
/** The lantern's box (its arches and the beacon in them - a press on it from the gallery asks the keeper's word of it). */
export function lanternBox() {
  return [T.x - L.r, GALLERY_Y, T.z - L.r, T.x + L.r, GALLERY_Y + L.sillH + L.archH, T.z + L.r];
}

// @ts-check
// THE ASCENT (LAW 9, 2026-10-16, Mac: "I want it to feel like you're actually traverversing corridors, different rooms, etc.";
// bible/11-Multiplayer/Elite-Gates-Ascent.md sections 3, 4 and 8): THE ROOMS BUILT - a spec law 9 hall's rooms (net/eliteGates/egLaw.js's
// `heroes` whose `room` names their archetype - net/eliteGates/egRoomLaw.js) as the circle's collider and a PLAIN mesh: no baked mesh
// stands behind a room (it is code-built from the hall's die), so its walls are built again here from its own words - its
// archetype, its numbers, its sockets used and its turn (egRoomBuild, egRoomTurned: the relay never needs them) - and its
// floors and ceilings are its hero's own, said in the spec. What a room is made of:
//   its FLOORS     each polygon at its height, a slab under it (EG_ROOM_SLAB_M) - the top you see is the top you stand on;
//   its CEILINGS   each polygon at its height, the slab over it;
//   its WALLS      every wall of its law (a door and a window its gaps), a balustrade, a CLIMB FACE (the climbing motor's
//                  wall - player/parkour.js free-climbs any face whose normal's y is under a half: these are vertical);
//   its STAIRS     the hall's own ramps (world/eliteGates/egHall.js draws and collides every ramp a room's hero said into the spec).
// The look's slice dresses them (world/eliteGates/egGround.js); this is the law's shape, plain and true, so the lab shows the way.
//
// Pure (the swap's worker builds it): a spec in, triangles and faces out. Not a DFU member. Ledger A (ELITE-GATES).
import { egRoomBuild, egRoomTurned } from '../../net/eliteGates/egRoomLaw.js';
import { realmToDungeon } from '../../net/superDungeon/sdBrain.js';

/** A floor's and a ceiling's slab (m): its top or its underside the law's, the rest of it under or over. */
export const EG_ROOM_SLAB_M = 0.3;

/** The rooms of hall `spec` (spec law 9's heroes with a `room`), each built again from its words: `[{ q, walls }]` - its said
 *  hero and its walls in the hall's frame (metres: `{ a: [x, z], b: [x, z], y0, y1, k }`). Pure. */
export function egRoomsOf(spec) {
  const out = [];
  for (const q of spec?.heroes ?? []) {
    if (!q.room) continue;
    const { k, p, u, t } = q.room;
    const R = egRoomTurned(egRoomBuild(k, p, u, spec.band ?? 0, q.kit), u[0], t);
    out.push({ q, walls: R.walls.map((w) => ({ a: [q.x + w.s[0] / 100, q.z + w.s[1] / 100], b: [q.x + w.s[2] / 100, q.z + w.s[3] / 100], y0: q.y + w.y0 / 100, y1: q.y + w.y1 / 100, k: w.k })) });
  }
  return out;
}

/** A polygon's triangles as a fan (every room's floor and ceiling is a convex outline - net/eliteGates/egRoomLaw.js's rectangles). */
const fan = (poly) => { const out = []; for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]); return out; };

/**
 * A ROOM'S COLLIDER (the dungeon's frame; both faces are one to the collider): its floors' tops and its ceilings' undersides
 * (each polygon at its height), its walls (each its quad - a door and a window are its gaps), pushed onto `out` as the circle's
 * collider bucket takes them (nine numbers a triangle). Pure.
 * @param {any} spec @param {number[]} out
 */
export function egRoomColliderInto(spec, out) {
  const D = (x, y, z) => realmToDungeon(spec.x0 + x, y, z);
  const tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (const { q, walls } of egRoomsOf(spec)) {
    for (const f of q.floors) for (const [a, b, c] of fan(f.poly)) tri(D(a[0], f.y, a[1]), D(b[0], f.y, b[1]), D(c[0], f.y, c[1]));
    for (const c of q.ceil ?? []) for (const [a, b, e] of fan(c.poly)) tri(D(a[0], c.y, a[1]), D(b[0], c.y, b[1]), D(e[0], c.y, e[1]));
    for (const w of walls) {
      const p0 = D(w.a[0], w.y0, w.a[1]), p1 = D(w.b[0], w.y0, w.b[1]), p2 = D(w.b[0], w.y1, w.b[1]), p3 = D(w.a[0], w.y1, w.a[1]);
      tri(p0, p1, p2); tri(p0, p2, p3);
    }
  }
  return out;
}

/**
 * A ROOM'S PLAIN MESH into faces `f` (world/gate/gateModel.js faces): its floors (their tops in the floor's record, their slabs'
 * edges and undersides in the root's), its ceilings, its walls (both their faces - a wall in the pillar's record, a balustrade
 * in the brass, a climb face in the root's rock), each wall and ceiling one occluder (`occ` - world/eliteGates/egHall.js's EG-ZN marker).
 * `recs` the records it wears. Pure.
 * @param {any} f @param {any} spec @param {{ floor: number, root: number, wall: number, rail: number }} recs @param {(fn: () => void) => void} occ
 */
export function egRoomModelInto(f, spec, recs, occ) {
  const D = (x, y, z) => realmToDungeon(spec.x0 + x, y, z);
  const S = EG_ROOM_SLAB_M;
  /** a triangle wound to face `ny` (up +1, down -1 - faces' normal is (b - a) x (c - a)), its UVs its plan's half-metres */
  const triTo = (rec, a, b, c, ny) => {
    const n = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const uv = (p) => [p[0] / 2, p[2] / 2];
    if (n * ny >= 0) f.tri(rec, a, b, c, uv(a), uv(b), uv(c)); else f.tri(rec, a, c, b, uv(a), uv(c), uv(b));
  };
  /** a vertical quad from (a, y0) to (b, y1), both its faces */
  const both = (rec, a, b, y0, y1) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), h = y1 - y0;
    const p0 = D(a[0], y0, a[1]), p1 = D(b[0], y0, b[1]), p2 = D(b[0], y1, b[1]), p3 = D(a[0], y1, a[1]);
    f.quad(rec, p0, p1, p2, p3, [0, 0], [L / 2, 0], [L / 2, h / 2], [0, h / 2]);
    f.quad(rec, p1, p0, p3, p2, [L / 2, 0], [0, 0], [0, h / 2], [L / 2, h / 2]);
  };
  for (const { q, walls } of egRoomsOf(spec)) {
    for (const g of q.floors) {
      // the top you stand on, the slab's underside, its edges (both faces - a slab is thin)
      for (const [a, b, c] of fan(g.poly)) triTo(recs.floor, D(a[0], g.y, a[1]), D(b[0], g.y, b[1]), D(c[0], g.y, c[1]), 1);
      for (const [a, b, c] of fan(g.poly)) triTo(recs.root, D(a[0], g.y - S, a[1]), D(b[0], g.y - S, b[1]), D(c[0], g.y - S, c[1]), -1);
      for (let i = 0; i < g.poly.length; i++) both(recs.root, g.poly[i], g.poly[(i + 1) % g.poly.length], g.y - S, g.y);
    }
    occ(() => {
      for (const c of q.ceil ?? []) {
        for (const [a, b, e] of fan(c.poly)) triTo(recs.root, D(a[0], c.y, a[1]), D(b[0], c.y, b[1]), D(e[0], c.y, e[1]), -1);
        for (const [a, b, e] of fan(c.poly)) triTo(recs.root, D(a[0], c.y + S, a[1]), D(b[0], c.y + S, b[1]), D(e[0], c.y + S, e[1]), 1);
      }
    });
    occ(() => { for (const w of walls) both(w.k === 'r' ? recs.rail : w.k === 'c' ? recs.root : recs.wall, w.a, w.b, w.y0, w.y1); });
  }
}

/** THE CLIMB ZONES (section 4's clamp): each climb of hall `spec` (spec law 9's `climbs`) as the motor's zone - its faces' plan
 *  (from its first face out EG_CLIMB_ZONE_OUT_M toward the climber, back to its top face), from under its foot to over its lip.
 *  `{ t: 'climb', c, x0, z0, x1, z1, y, ceil }`. Pure. */
export const EG_CLIMB_ZONE_OUT_M = 1.5;
export function egClimbZones(spec) {
  const out = [];
  for (const c of spec?.climbs ?? []) {
    const back = c.d * c.ledges.length, [nx, nz] = c.face;
    const xs = [c.x0, c.x1, c.x0 + nx * EG_CLIMB_ZONE_OUT_M, c.x1 + nx * EG_CLIMB_ZONE_OUT_M, c.x0 - nx * back, c.x1 - nx * back];
    const zs = [c.z0, c.z1, c.z0 + nz * EG_CLIMB_ZONE_OUT_M, c.z1 + nz * EG_CLIMB_ZONE_OUT_M, c.z0 - nz * back, c.z1 - nz * back];
    out.push({ t: 'climb', c, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y: c.y0 - 0.5, ceil: c.y1 + 2.5 });
  }
  return out;
}
/** A CLIMB'S KEEP: (x, z) held along its face's span (a climber shimmies no further than the face built for it), `r` its body's
 *  radius - `[x, z]` where it is put, null where it stands within. Pure. */
export function egClimbKeep(q, x, z, r) {
  const c = q.c, ax = c.x0, az = c.z0, ex = c.x1 - c.x0, ez = c.z1 - c.z0, L = Math.hypot(ex, ez) || 1, ux = ex / L, uz = ez / L;
  const t = (x - ax) * ux + (z - az) * uz;
  if (t >= r && t <= L - r) return null;
  const tt = Math.max(r, Math.min(L - r, t));
  return [x + (tt - t) * ux, z + (tt - t) * uz];
}

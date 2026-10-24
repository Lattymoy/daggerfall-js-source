// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 2):
// THE GROUND - the law's floors, walls and vaults dressed as the Battlemages' academy, laid into the circle's one mesh
// (world/eliteGates/egHall.js buildEgCircleModel) where the law's own surfaces stand, never past them:
//   THE FLOORS (egDiscFloor) - a disc's top cut into regions IN its own plane (re-triangulated, never a decal over it): a
//     running border of inlay between two fillets of the band's metal a metre in from every plate's and court's rim; each
//     court's great mosaic of its band's sigil (world/eliteGates/egKit.js EG_KIT_STYLE `sigil` - the Battlemages' eight-pointed star in
//     a ring, a soul-gem's facets, Nocturnal's crescent, Dagon's war-sigil) in a frame of the same; the arrival plate's gold
//     ring kept, inside a compass of inlay pointing down the course. Every region a ray-and-ring cell of the disc, so the
//     regions share their corners and the rim's 48 sides are the collider's own.
//   THE ACADEMY'S WALL (academyWall) - every wall run of a passage, a chamber's long walls: a plinth course flush with the
//     collider's plane, pilasters every 3 m (their faces on the plane, the bays between them 0.3 m back), a round-arched
//     window in each bay (the band's arch - round, pointed, lancet, squat) opening onto the void through the wall's 0.6 m,
//     its archivolt and keystone, a sill course, and a cornice that projects only over the collider's ceiling;
//   THE VAULT (passageVault) - a barrel of voussoir ribs over the pilasters with coffers between, broken open to the sky in
//     one or two bays a passage (by the hall's seed), springing from the cornice above the ceiling the law holds;
//   THE KITS' OWN FORMS - the Caverns' basalt walls and vault displaced by noise, the Stacks' bookcases set in the bays,
//     the Colonnade's drums on a stylobate past the walk, the Ossuary's bone ribs and loculi, the Mist Stair's pit stepping
//     its windows down with the stair, the Thicket's black-glass trunks, the Forge's pipe channel and hearths;
//   THE CHAMBERS (ringArcade, tierBenches, chokeArch) - a ring wall an arcade of piers, arches and a parapet outward of the
//     collider's ring, open at the course's gaps; a pit's tiers stepped stone benches; a chokepoint's arch voussoirs over
//     its lintel's line;
//   THE DOOR (egDoorway) - two pilasters on plinths inside the posts' own boxes, a round arch of voussoirs and a keystone
//     carrying the band's sigil, an entablature over it;
//   THE VIGNETTES (egVignette) - each inside the box the collider gives it: a barricade of lecterns, a rack of broken
//     staves, the Kyn's shrine, a fallen shelf, a weapon rack.
// THE LAW KEPT (the laws Elite-Gates-Look.md section 2 sets, pinned in test/world/eliteGates/eglook_halls.test.js): nothing drawn here stands
// over a floor's top inside its footprint but the floors themselves; every wall face at or OUT from its collider's plane
// (`d` >= 0 in a wall's frame) and every vault over the collider's ceiling; the collider (egHall.js egCircleColliderTris)
// is not read or moved. Every piece but a floor is laid by the caller as an occluder of its own (EG-ZN - the camera
// dithers it).
// THE RECORDS: the ground's eight (world/eliteGates/egBandArt.js EG_DRESS) and three of the kit's (world/eliteGates/egKit.js EG_KIT_RECORD: the
// moulding 61, the voussoir 62, the inlay 71) - eleven, so the circle stays one draw a record; the vault's coffers and the
// pilasters are the wall's ashlar (56) cut in geometry. UV at 0.5 a metre (2 m a repeat - 32 texels a metre on the 64 px
// records), walls' v up the picture.
//
// Built with the mesh kit (world/eliteGates/meshKit.js) a piece at a time and laid into the circle's faces (world/gate/gateModel.js), so the
// occluders' runs (egHall.js egOccluderRuns) and the one pack stay as they were. Pure: no DOM, no GL - the swap's worker
// builds it (world/eliteGates/egCircleParts.js). Deterministic: the same seed lays the same bytes.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { realmToDungeon } from '../../net/superDungeon/sdBrain.js';
import { createMeshKit } from './meshKit.js';
import { GATE_PART } from '../gate/gateModel.js';
import { EG_DRESS, EG_KIT_MAP } from './egBandArt.js';   // the ground's records, and how each kit picture is worn
import { EG_KIT_RECORD, egKitStyle } from './egKit.js';
import { egRingSideWalls, EG_RING_DOOR } from '../../net/eliteGates/egWalkGraph.js';   // EG-PERFECT (spec law 10): the ring open at an alcove's doorway (THE AUDIT: its doorway alone)

/** THE GROUND'S RECORDS: the ground's eight and the kit's shaft, moulding, voussoir and inlay - twelve draws at most a circle. */
export const EG_GROUND_RECORD = Object.freeze({
  floor: EG_DRESS.floor, metal: EG_DRESS.brass, root: EG_DRESS.root, arena: EG_DRESS.arena, cobble: EG_DRESS.cobble, edge: EG_DRESS.edge,
  molten: EG_DRESS.molten, wall: EG_DRESS.pillar, shaft: EG_KIT_RECORD.shaft, moulding: EG_KIT_RECORD.moulding, voussoir: EG_KIT_RECORD.voussoir, inlay: EG_KIT_RECORD.inlay,
});
/** @type {ReadonlyArray<number>} */
export const EG_GROUND_RECORDS = Object.freeze([...new Set(Object.values(EG_GROUND_RECORD))].sort((a, b) => a - b));
const R = EG_GROUND_RECORD;
/** UV a metre (2 m a repeat). */
const S = 0.5;
const TAU = Math.PI * 2;
/** Hall `spec`'s frame point in the dungeon's (world/eliteGates/egHall.js egToDungeon's own). */
const DG = (spec, x, y, z) => realmToDungeon(spec.x0 + x, y, z);
const UP = [0, 1, 0], DOWN = [0, -1, 0];

/** A seeded hash of integers in [0, 1) - the ground's one die (Math.imul: the same on every engine). */
export function egGroundHash(...n) {
  let h = 0x2545f491;
  for (const v of n) { h = Math.imul(h ^ (Math.round(v) | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}

// ── laying a kit's piece into the circle's faces ──────────────────────────────────────────────────────────────────
/** The mesh kit (world/eliteGates/meshKit.js) each faces build lays its pieces with: its shapes (box, prism, lathe, sweep) as the kit
 *  makes them, its one face and one triangle - which every shape lays through - writing straight into faces `f`'s records
 *  (world/gate/gateModel.js faces' byRec), wound as the kit winds them (`out`: a direction, or with `dir` false a point to look
 *  away from), so a piece's triangles are a run of its records' own and the circle packs once (world/superDungeon/sdRealm.js
 *  packRealmFaces). */
const _kits = new WeakMap();
function facesKit(f) {
  let kit = _kits.get(f);
  if (kit) return kit;
  kit = createMeshKit({ start: 3 });
  const put = (rec, a, b, c, ua, ub, uc) => {
    let g = f.byRec.get(rec);
    if (!g) f.byRec.set(rec, g = { p: [], n: [], uv: [], parts: [] });
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    g.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    g.parts.push(GATE_PART.Stone);
  };
  const facing = (a, b, c, out, dir) => {
    if (!out) return true;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (dir) return nx * out[0] + ny * out[1] + nz * out[2] >= 0;
    return nx * ((a[0] + b[0] + c[0]) / 3 - out[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - out[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - out[2]) >= 0;
  };
  const k = kit;
  k.tri = (rec, a, b, c, out = null, dir = true, ua = [0, 0], ub = [1, 0], uc = [1, 1]) => { if (facing(a, b, c, out, dir)) put(rec, a, b, c, ua, ub, uc); else put(rec, a, c, b, ua, uc, ub); return k; };
  k.quad = (rec, a, b, c, d, out = null, dir = true, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    if (facing(a, b, c, out, dir)) { put(rec, a, b, c, uv[0], uv[1], uv[2]); put(rec, a, c, d, uv[0], uv[2], uv[3]); } else { put(rec, a, d, c, uv[0], uv[3], uv[2]); put(rec, a, c, b, uv[0], uv[2], uv[1]); }
    return k;
  };
  _kits.set(f, kit);
  return kit;
}
/** A piece laid into faces `f` by `build(kit)` with the mesh kit (facesKit): its triangles, normals and UVs as the kit winds
 *  them, a run of each record it wears (the caller's occluder marks them). */
export function egKitInto(f, build) { build(facesKit(f)); }

// ── THE FLOORS ────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE FLOORS' LOOK (m): the running border (a band of inlay, its outer edge `in` from the rim), the court's mosaic (its
 *  radius `k` of the court's, between `min` and `max`; its frame a band of inlay between two fillets of the band's metal),
 *  the rays every floor is cut on (the rim's own 48 sides), the plates' rings a court lays between its mosaic and its
 *  border, the arrival plate's compass (its long point down the course, on 16 rays - its points' tips and valleys), the
 *  smallest disc that takes a border. */
export const EG_FLOOR_LOOK = Object.freeze({
  border: Object.freeze({ in: 1.0, band: 0.5 }),
  frame: Object.freeze({ fillet: 0.12, band: 0.45 }),
  mosaic: Object.freeze({ k: 0.32, max: 7, min: 3 }),
  rim: 48, plate: 3.5, minBorder: 4.4,
  compass: Object.freeze({ rays: 16, north: 2.9, cardinal: 2.0, diagonal: 1.25, valley: 0.4, boss: 0.16, out: 3.05 }),
});
/** The radius along the ray at angle `a` (from the disc's centre) where it meets the line through p and q ([x, z]). */
function rayHit(a, p, q) {
  const ux = Math.cos(a), uz = Math.sin(a), ex = q[0] - p[0], ez = q[1] - p[1], den = ux * ez - uz * ex;
  return Math.abs(den) < 1e-12 ? Math.hypot(p[0], p[1]) : (p[0] * ez - p[1] * ex) / den;
}
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
/** Where the ray at `a` stands among `m` evenly spaced points from `a0`: the point before it `k` and the fraction on. */
function sectorOf(a, m, a0) {
  let s = ((a - a0) / (TAU / m)) % m;
  if (s < 0) s += m;
  const k = Math.floor(s + 1e-9);
  return { k: k % m, frac: Math.max(0, s - k) };
}
/** A STAR's outline along the ray at `a`: `m` points from `a0`, point k `tip(k)` out, the valleys between `rv` out - and
 *  which half of a point the ray is in (the two-toned point's: 0 the half before its tip, 1 after). */
function starAt(a, m, a0, tip, rv) {
  const { k, frac } = sectorOf(a, m, a0), step = TAU / m, tk = a0 + k * step;
  const r = frac < 0.5 ? rayHit(a, polar(tip(k), tk), polar(rv, tk + step / 2)) : rayHit(a, polar(rv, tk + step / 2), polar(tip((k + 1) % m), tk + step));
  return { r, half: frac < 0.5 ? 1 : 0 };
}
/**
 * THE SIGILS (Elite-Gates-Look.md section 1, EG_KIT_STYLE's `sigil`): each a cut of the disc inside radius `ri` - for the ray
 * at `a`, its breakpoints out from the centre (always the same count, rising) and each ring's record (`half` the two-toned
 * point's half). Every straight edge runs between two rays' points, so the cut is exact on the rim's 48 rays.
 *   star      the Battlemages' eight points (four long, four short) in inlay round a boss of the band's metal;
 *   gem       a soul-gem from above: its table and its girdle facets in inlay, its star facets in the metal (bone);
 *   crescent  Nocturnal's moon - the crescent in inlay inside a ring of moon-silver tracery;
 *   dagon     Dagon's war-sigil: six spikes (three long) each half iron, half the band's molten-hued inlay, on an inlay boss.
 * Pure.
 */
export const EG_GROUND_SIGILS = Object.freeze({
  star: (ri) => ({
    at: (a) => { const s = starAt(a, 8, Math.PI / 2, (k) => (k % 2 ? 0.7 : 1) * ri, 0.36 * ri); return { b: [0, 0.14 * ri, Math.max(0.14 * ri, s.r), ri], half: s.half }; },
    rec: () => [INLAY_METAL, R.inlay, R.arena],
  }),
  gem: (ri) => {
    const G = (k) => polar(ri, Math.PI / 2 + (k * TAU) / 8), T = (k) => polar(0.48 * ri, Math.PI / 2 + (k * TAU) / 8), M = (k) => { const a = G(k), b = G(k + 1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    return {
      at: (a) => {
        const { k, frac } = sectorOf(a, 8, Math.PI / 2);
        const table = rayHit(a, T(k), T(k + 1)), girdle = rayHit(a, G(k), G(k + 1)), line = frac < 0.5 ? rayHit(a, T(k), M(k)) : rayHit(a, T(k + 1), M(k));
        return { b: [0, table, Math.min(girdle, Math.max(table, line)), girdle, ri], half: 0 };
      },
      rec: () => [R.inlay, INLAY_METAL, R.inlay, R.arena],
    };
  },
  crescent: (ri) => {
    const rc = 0.88 * ri, off = 0.22 * rc, rb = 0.86 * rc;   // the bite's circle toward +z (the way on): the horns point down the course
    return {
      at: (a) => { const ub = Math.sin(a) * off, t2 = ub + Math.sqrt(ub * ub - off * off + rb * rb); return { b: [0, Math.min(t2, rc), rc, rc + 0.1, ri], half: 0 }; },
      rec: () => [R.arena, R.inlay, INLAY_METAL, R.arena],
    };
  },
  dagon: (ri) => ({
    at: (a) => { const s = starAt(a, 6, Math.PI / 2, (k) => (k % 2 ? 0.6 : 1) * ri, 0.3 * ri); return { b: [0, 0.12 * ri, Math.max(0.12 * ri, s.r), ri], half: s.half }; },
    rec: (half) => [R.inlay, half ? INLAY_METAL : R.inlay, R.arena],
  }),
});
/** The arrival plate's compass (EG_FLOOR_LOOK.compass): eight points, the long one down the course (+z), each half the
 *  band's metal, half inlay, on a boss of the metal. */
const compassAt = (a) => {
  const C = EG_FLOOR_LOOK.compass, s = starAt(a, 8, Math.PI / 2, (k) => (k === 0 ? C.north : k % 2 ? C.diagonal : C.cardinal), C.valley);
  return { b: [0, C.boss, Math.max(C.boss, s.r)], half: s.half };
};
/** One triangle of faces `f`, wound up (+y). */
function upTri(f, rec, a, b, c, ua, ub, uc) {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny >= 0) f.tri(rec, a, b, c, ua, ub, uc); else f.tri(rec, a, c, b, ua, uc, ub);
}
/**
 * A FLOOR'S TOP CUT INTO REGIONS: the disc about realm (cx, cz) at height y laid between rays - `rays` `[{ a, b }]` (each
 * ray's breakpoints out from the centre, every ray the same count, rising); the cell between rays i and i + 1 and
 * breakpoints j and j + 1 a quad (a triangle where a side closes to nothing) in record `recOf(i, j)` (none below 0), its
 * uv `uvOf(rec, r, a, j)`. Every cell shares its corners with its neighbours: no gap, no overlap, one plane.
 */
function polarFloor(f, cx, cz, y, rays, recOf, uvOf, figure = /** @type {(j: number) => boolean} */ (() => true)) {
  const n = rays.length - 1, m = rays[0].b.length - 1, full = Math.abs(rays[n].a - rays[0].a - TAU) < 1e-9;
  const same = (p, q) => (p[0] < 1e-7 && q[0] < 1e-7) || (Math.abs(p[0] - q[0]) < 1e-7 && Math.abs(p[1] - q[1]) < 1e-9);
  const recs = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => recOf(i, j)));
  const isInlay = (r) => r === R.inlay || r === INLAY_METAL;
  const inlayAt = (i, j) => { if (j < 0 || j >= m || !figure(j)) return false; const ii = full ? (i + n) % n : i; return ii >= 0 && ii < n && isInlay(recs[ii][j]); };
  const at = (p) => [cx + Math.cos(p[1]) * p[0], cz + Math.sin(p[1]) * p[0]];
  /** an edge's crossings of the inlay's 2 m lines (z = 2k), strictly inside it, from whichever end comes first - the same
   *  points from both cells that share it */
  const crossings = (p, q) => {
    const [a, b] = p[0] < q[0] || (p[0] === q[0] && p[1] <= q[1]) ? [p, q] : [q, p], A = at(a), B = at(b), out = [];
    const z0 = Math.min(A[1], B[1]), z1 = Math.max(A[1], B[1]);
    for (let k = Math.floor(z0 / INLAY_LINE) + 1; k * INLAY_LINE < z1 - 1e-9; k++) { const zk = k * INLAY_LINE, t = (zk - A[1]) / (B[1] - A[1]); if (zk > z0 + 1e-9) out.push([A[0] + (B[0] - A[0]) * t, zk]); }
    const along = (P) => Math.hypot(P[0] - at(p)[0], P[1] - at(p)[1]);
    return out.sort((u, v) => along(u) - along(v));
  };
  for (let i = 0; i < n; i++) {
    const A = rays[i], B = rays[i + 1];
    for (let j = 0; j < m; j++) {
      const rec = recs[i][j];
      if (rec < 0) continue;
      // the cell's corners (one closed to nothing at the centre, or a star's tip), and where its edges cross the inlay's
      // lines - on every edge an inlay cell has, so the cells about it share each point
      const corners = [[[A.b[j], A.a], 'r', i], [[A.b[j + 1], A.a], 'o', j + 1], [[B.b[j + 1], B.a], 'r', i + 1], [[B.b[j], B.a], 'o', j]];
      const nb = [inlayAt(i - 1, j), inlayAt(i, j + 1), inlayAt(i + 1, j), inlayAt(i, j - 1)], mine = isInlay(rec) && figure(j), ringed = isInlay(rec) && !figure(j);
      const ring = [];
      for (let e = 0; e < 4; e++) {
        const p = corners[e][0], q = corners[(e + 1) % 4][0];
        const last = ring[ring.length - 1];
        if (!last || !last.rp || !same(last.rp, p)) ring.push({ rp: p, xz: at(p) });
        if ((mine || nb[e]) && !same(p, q)) for (const c of crossings(p, q)) ring.push({ rp: null, xz: c });
      }
      if (ring.length > 1 && ring[0].rp && ring[ring.length - 1].rp && same(ring[0].rp, ring[ring.length - 1].rp)) ring.pop();
      if (ring.length < 3) continue;
      const plain = ring.every((v) => v.rp);
      const real = rec === INLAY_METAL ? R.inlay : rec, zone = rec === INLAY_METAL ? 0.5 : 0;
      // an inlay ring (a border, a frame) laid along itself: u its arc, v across it from its inner edge - never 2 m across
      const r0 = Math.min(A.b[j], B.b[j]), am = (A.a + B.a) / 2;
      const uvAt = (v, slab) => (mine ? [v.xz[0] * S, zone + (v.xz[1] - slab) / (2 * INLAY_LINE)] : ringed ? (v.rp ? [v.rp[1] * ((A.b[j] + A.b[j + 1]) / 2) * S, zone + Math.max(0, v.rp[0] - r0) / (2 * INLAY_LINE)] : [am * r0 * S, zone]) : v.rp ? uvOf(rec, v.rp[0], v.rp[1], j) : uvOf(rec, Math.hypot(v.xz[0] - cx, v.xz[1] - cz), angleIn(Math.atan2(v.xz[1] - cz, v.xz[0] - cx), A.a), j));
      const D = (v) => realmToDungeon(v.xz[0], y, v.xz[1]);
      if (!mine) {
        if (plain) { const U = ring.map((v) => uvAt(v, 0)); upTri(f, real, D(ring[0]), D(ring[1]), D(ring[2]), U[0], U[1], U[2]); if (ring.length === 4) upTri(f, real, D(ring[0]), D(ring[2]), D(ring[3]), U[0], U[2], U[3]); }
        else fan(f, real, ring, (v) => uvAt(v, 0), D);
        continue;
      }
      // an inlay cell: cut into its 2 m slabs (each wears one zone of the picture, its tesserae running on across the cells)
      const zs = ring.map((v) => v.xz[1]), k0 = Math.floor(Math.min(...zs) / INLAY_LINE + 1e-9), k1 = Math.ceil(Math.max(...zs) / INLAY_LINE - 1e-9);
      for (let k = k0; k < Math.max(k0 + 1, k1); k++) {
        const lo = k * INLAY_LINE, hi = lo + INLAY_LINE, piece = ring.filter((v) => v.xz[1] >= lo - 1e-9 && v.xz[1] <= hi + 1e-9);
        if (piece.length >= 3) fan(f, real, piece, (v) => uvAt(v, lo), D);
      }
    }
  }
}
/** An angle brought round to `from` or past it (a cell's own range). */
const angleIn = (a, from) => (a < from - 1e-9 ? a + Math.ceil((from - 1e-9 - a) / TAU) * TAU : a);
/** The inlay's lines (m): its picture's two zones each span this much in the floor (EG_KIT_MAP inlay: 2 m a repeat). */
const INLAY_LINE = 2;
/** A region in the inlay's second zone (its metal tesserae): the inlay's record, read as the metal half. */
const INLAY_METAL = 1000 + EG_KIT_RECORD.inlay;
/** A convex polygon `ring` laid as a fan about its middle (every point on its edges a corner of it - no point of a
 *  neighbour's left on an edge), wound up. */
function fan(f, rec, ring, uvAt, D) {
  if (ring.length === 3) { upTri(f, rec, D(ring[0]), D(ring[1]), D(ring[2]), uvAt(ring[0]), uvAt(ring[1]), uvAt(ring[2])); return; }
  const c = { rp: null, xz: [ring.reduce((s, v) => s + v.xz[0], 0) / ring.length, ring.reduce((s, v) => s + v.xz[1], 0) / ring.length] }, uc = uvAt(c), pc = D(c);
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; upTri(f, rec, pc, D(a), D(b), uc, uvAt(a), uvAt(b)); }
}
/** A ring from `n` rays at r0 out to n x `k` at r1 (a compass's 16 rays to the rim's 48): each inner side fanned to the k
 *  outer sides over it, every corner shared both sides. */
function ringUp(f, cx, cz, y, n, k, r0, r1, rec, uvOf) {
  const at = (r, i, m) => { const a = (i / m) * TAU; return { p: realmToDungeon(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r), u: uvOf(rec, r, a, 0) }; };
  for (let i = 0; i < n; i++) {
    const i0 = at(r0, i, n), i1 = at(r0, i + 1, n), mid = Math.floor(k / 2);
    for (let j = 0; j < k; j++) { const o0 = at(r1, i * k + j, n * k), o1 = at(r1, i * k + j + 1, n * k), c = j < mid ? i0 : j > mid ? i1 : null; if (c) upTri(f, rec, c.p, o0.p, o1.p, c.u, o0.u, o1.u); else { upTri(f, rec, i0.p, o0.p, o1.p, i0.u, o0.u, o1.u); upTri(f, rec, i0.p, o1.p, i1.p, i0.u, o1.u, i1.u); } }
  }
}
/**
 * A DISC'S FLOOR (Elite-Gates-Look.md section 2): disc `d` of hall `spec` (its `role`), its top cut into regions in its own
 * plane - `rec` its ground (the floor's flags, the courts' plates), `band` the band whose sigil a court wears. A court: its
 * mosaic and frame on EG_FLOOR_LOOK.rays rays, its plates in rings, the border, the outer ring stepping down to the rim's
 * 48 sides. A plate (arrive, end), a bastion, a balcony: its ground, its border (the arrival plate's compass inside, its gold
 * ring - the edge line's record - between two bands of inlay). Anything smaller: its ground whole, as the Hour laid it. The
 * rim's 48 corners are the collider's own (egHall.js egCircleColliderTris).
 */
export function egDiscFloor(f, spec, d, rec, band) {
  const cx = spec.x0 + d.x, cz = d.z, y = d.y ?? 0, r = d.r, L = EG_FLOOR_LOOK, Bd = L.border, Fr = L.frame;
  const plan = (_rec, rr, a) => [(cx + Math.cos(a) * rr) * S, (cz + Math.sin(a) * rr) * S];
  /** the uv of each ring of `rings` ([[r0, r1, mode]...]): 'plan' the floor's tile, 'ring' a plate a ring (the Hour's), 'strip' a fillet of metal along its ring */
  const uvRings = (rings) => (rc, rr, a, j) => {
    const [r0, r1, mode] = rings[j] ?? [0, r, 'plan'];
    if (mode === 'ring') { const um = (r0 + r1) / 2 * S; return [a * um, (rr - r0) / Math.max(1e-6, r1 - r0)]; }
    if (mode === 'strip') return [a * ((r0 + r1) / 2) * S, 3 / 64 + (rr - r0) * S];
    return plan(rc, rr, a);
  };
  const rays = (n, fn) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * TAU, o = fn(a); return { a, b: o.b, half: o.half ?? 0 }; });
  const borderAt = r - Bd.in - Bd.band, border = /** @type {[number, number, string, number]} */ ([borderAt, r - Bd.in, 'plan', R.inlay]);
  if (d.role === 'court') {
    // the mosaic, its frame, the plates in rings, the border and the plates out to the rim - one cut on the rim's 48 rays
    const style = egKitStyle(band), ri = Math.max(L.mosaic.min, Math.min(L.mosaic.max, L.mosaic.k * r)), sig = (EG_GROUND_SIGILS[style.sigil] ?? EG_GROUND_SIGILS.star)(ri);
    /** @type {Array<[number, number, string, number]>} */
    const frame = [[ri, ri + Fr.fillet, 'plan', INLAY_METAL], [ri + Fr.fillet, ri + Fr.fillet + Fr.band, 'plan', R.inlay], [ri + Fr.fillet + Fr.band, ri + 2 * Fr.fillet + Fr.band, 'plan', INLAY_METAL]];
    const ro = frame[2][1], span = borderAt - ro, nPlates = Math.max(1, Math.round(span / L.plate)), w = span / nPlates;
    /** @type {Array<[number, number, string, number]>} */
    const outerRings = [...frame, ...Array.from({ length: nPlates }, (_, k) => /** @type {[number, number, string, number]} */ ([ro + k * w, ro + (k + 1) * w, 'ring', rec])), border, [r - Bd.in, r, 'ring', rec]];
    const all = rays(L.rim, (a) => { const s = sig.at(a); return { b: [...s.b, ...outerRings.map((q) => q[1])], half: s.half }; });
    const nSig = all[0].b.length - 1 - outerRings.length, rings = [...Array.from({ length: nSig }, () => [0, ri, 'plan']), ...outerRings];
    polarFloor(f, cx, cz, y, all, (i, j) => { if (j < nSig) { const rr = sig.rec(all[i].half)[j]; return rr === R.arena ? rec : rr; } return outerRings[j - nSig][3]; }, uvRings(rings), (j) => j < nSig);
    return;
  }
  const plate = d.role === 'arrive' || d.role === 'end' || d.role === 'bastion' || d.role === 'balcony';
  if (!plate || r < L.minBorder) {
    polarFloor(f, cx, cz, y, rays(L.rim, () => ({ b: [0, r] })), () => rec, uvRings([[0, r, 'plan']]));
    return;
  }
  if (d.role === 'arrive') {
    // the compass on its own 16 rays and the floor about it, out to the rim's 48; the border, the gold ring (the gather's -
    // r - 1.4 to r - 1.2, where it always lay) at its heart between two bands of inlay
    const C = L.compass, g0 = r - 1.4, g1 = r - 1.2, b1 = g1 + 0.35;
    const inner = rays(C.rays, (a) => { const c = compassAt(a); return { b: [...c.b, C.out], half: c.half }; });
    polarFloor(f, cx, cz, y, inner, (i, j) => (j === 0 ? INLAY_METAL : j === 1 ? (inner[i].half ? INLAY_METAL : R.inlay) : rec), (rc, rr, a) => plan(rc, rr, a));
    ringUp(f, cx, cz, y, C.rays, L.rim / C.rays, C.out, g0, rec, (rc, rr, a) => plan(rc, rr, a));
    const rings = [[g0, g1, 'ring', R.edge], [g1, b1, 'plan', R.inlay], [b1, r, 'plan', rec]];
    polarFloor(f, cx, cz, y, rays(L.rim, () => ({ b: [g0, ...rings.map((q) => q[1])] })), (_i, j) => rings[j][3], uvRings(rings), () => false);
    return;
  }
  const rings = [[0, borderAt, 'plan', rec], border, [r - Bd.in, r, 'plan', rec]];
  polarFloor(f, cx, cz, y, rays(L.rim, () => ({ b: [0, ...rings.map((q) => q[1])] })), (_i, j) => rings[j][3], uvRings(rings), () => false);
}

// ── ARCHES ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * AN ARCH'S CURVE (Elite-Gates-Look.md section 1 - EG_KIT_STYLE's `arch`): `m + 1` points [x, y] from its left springing (x <
 * 0, y 0) over its crown to its right, its opening `hw` half-wide, `off` out from its intrados (a rib's underside below 0,
 * an archivolt's back or a vault's above). `round` a half circle; `pointed` two arcs struck from the opposite springings
 * (equilateral); `lancet` two arcs of one and a half spans; `squat` a segment rising 0.45 of its half-width. m even. Pure.
 */
export function egArchCurve(style, hw, off = 0, m = 8) {
  const out = [];
  if (style === 'pointed' || style === 'lancet') {
    const Rr = (style === 'lancet' ? 3 : 2) * hw, c = Rr - hw, ro = Rr + off, crown = Math.sqrt(Math.max(0, ro * ro - c * c)), a1 = Math.atan2(crown, -c);
    for (let k = 0; k <= m / 2; k++) { const a = Math.PI + (a1 - Math.PI) * (k / (m / 2)); out.push([k === m / 2 ? 0 : c + Math.cos(a) * ro, Math.sin(a) * ro]); }
    for (let k = m / 2 - 1; k >= 0; k--) out.push([-out[k][0], out[k][1]]);
  } else if (style === 'squat') {
    const c = 0.8864 * hw, ro = Math.hypot(hw, c) + off, aL = Math.atan2(c, -Math.sqrt(Math.max(0, ro * ro - c * c)));
    for (let k = 0; k <= m; k++) { const a = aL + (Math.PI - 2 * aL) * (k / m); out.push([Math.cos(a) * ro, -c + Math.sin(a) * ro]); }
  } else {
    const ro = hw + off;
    for (let k = 0; k <= m; k++) { const a = Math.PI * (1 - k / m); out.push([Math.cos(a) * ro, Math.sin(a) * ro]); }
  }
  return out;
}
/** An arch's rise over its springing (its crown's height) for a half-width `hw`. */
export const egGroundArchRise = (style, hw) => Math.max(...egArchCurve(style, hw, 0, 8).map((p) => p[1]));

// ── A WALL'S FRAME ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A WALL'S FRAME in hall `spec`: its plane through (ax, az) and (bx, bz) (the hall's frame), the walk on the side the unit
 * (nx, nz) points to - `at(d, y, t)` the dungeon point `t` along it, `d` OUT from the plane (away from the walk), at y; and
 * its directions (dungeon frame): IN toward the walk, OUT, ALONG +t, BACK -t.
 */
export function egWallFrame(spec, ax, az, bx, bz, nx, nz) {
  const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L;
  return { L, at: (d, y, t) => DG(spec, ax + ux * t - nx * d, y, az + uz * t - nz * d), IN: [nx, 0, nz], OUT: [-nx, 0, -nz], ALONG: [ux, 0, uz], BACK: [-ux, 0, -uz] };
}
/** A quad of frame `W`'s corners ([d, y, t] each), in record `rec`, facing `out` (a dungeon direction), its uv `uv`. */
const fq = (kit, W, rec, c, out, uv) => kit.quad(rec, W.at(c[0][0], c[0][1], c[0][2]), W.at(c[1][0], c[1][1], c[1][2]), W.at(c[2][0], c[2][1], c[2][2]), W.at(c[3][0], c[3][1], c[3][2]), out, true, uv);
const mix = (a, b, s, k) => [a[0] * s + b[0] * k, a[1] * s + b[1] * k, a[2] * s + b[2] * k];
/** uv of a face across t and y (u along, v up: the wall's ashlar is worn v up - world/eliteGates/egBandArt.js pillarArt), across d and
 *  y, across t and d. */
const uvTY = (c) => c.map((p) => [p[2] * S, p[1] * S]);
const uvDY = (c) => c.map((p) => [p[0] * S, p[1] * S]);
const uvTD = (c) => c.map((p) => [p[2] * S, p[0] * S]);
/** THE MOULDING'S BANDS (world/eliteGates/egBandArt.js EG_KIT_MAP - its v from the profile's top): a face laid in one of them, or across
 *  `capital` (its fillet, its ornament and its metal band - a capital's, an entablature's face). */
const MB = EG_KIT_MAP[EG_KIT_RECORD.moulding].bands;
export const EG_MOULD_BAND = Object.freeze({ fillet: MB.fillet, ornament: MB.ornament, band: MB.band, cove: MB.cove, torn: MB.torn, capital: Object.freeze([MB.fillet[0], MB.band[1]]) });
/** An upright face of the moulding in frame W at depth d, t0..t1 by y0..y1, its v down band `b` from its top. */
const mouldTY = (kit, W, d, t0, y0, t1, y1, out, b) => { if (t1 - t0 > 1e-6 && y1 - y0 > 1e-6) fq(kit, W, R.moulding, [[d, y0, t0], [d, y0, t1], [d, y1, t1], [d, y1, t0]], out, [[t0 * S, b[1]], [t1 * S, b[1]], [t1 * S, b[0]], [t0 * S, b[0]]]); };
/** A level face of the moulding in frame W at y, d0..d1 by t0..t1, its v across band `b`. */
const mouldDT = (kit, W, y, d0, t0, d1, t1, out, b) => { if (t1 - t0 > 1e-6 && Math.abs(d1 - d0) > 1e-6) fq(kit, W, R.moulding, [[d0, y, t0], [d0, y, t1], [d1, y, t1], [d1, y, t0]], out, [[t0 * S, b[0]], [t1 * S, b[0]], [t1 * S, b[1]], [t0 * S, b[1]]]); };
/** An end face of the moulding in frame W at t, d0..d1 by y0..y1, its v down band `b`. */
const mouldDY = (kit, W, t, d0, y0, d1, y1, out, b) => { if (Math.abs(d1 - d0) > 1e-6 && y1 - y0 > 1e-6) fq(kit, W, R.moulding, [[d0, y0, t], [d1, y0, t], [d1, y1, t], [d0, y1, t]], out, [[d0 * S, b[1]], [d1 * S, b[1]], [d1 * S, b[0]], [d0 * S, b[0]]]); };
/** A rectangle of frame W at depth d from (t0, y0) to (t1, y1), facing `out`. */
const rectTY = (kit, W, rec, d, t0, y0, t1, y1, out) => { if (t1 - t0 > 1e-6 && y1 - y0 > 1e-6) { const c = [[d, y0, t0], [d, y0, t1], [d, y1, t1], [d, y1, t0]]; fq(kit, W, rec, c, out, uvTY(c)); } };
/** A level rectangle of frame W at height y from (d0, t0) to (d1, t1), facing up or down. */
const rectDT = (kit, W, rec, y, d0, t0, d1, t1, out) => { if (t1 - t0 > 1e-6 && Math.abs(d1 - d0) > 1e-6) { const c = [[d0, y, t0], [d0, y, t1], [d1, y, t1], [d1, y, t0]]; fq(kit, W, rec, c, out, uvTD(c)); } };
/** An upright rectangle of frame W across its depth at t, from (d0, y0) to (d1, y1), facing `out` (ALONG or BACK). */
const rectDY = (kit, W, rec, t, d0, y0, d1, y1, out) => { if (Math.abs(d1 - d0) > 1e-6 && y1 - y0 > 1e-6) { const c = [[d0, y0, t], [d1, y0, t], [d1, y1, t], [d0, y1, t]]; fq(kit, W, rec, c, out, uvDY(c)); } };
/** A box of frame W: d0..d1 (out), y0..y1, t0..t1, the faces named in `faces` ('in', 'out', 'top', 'bottom', 'back', 'along'). */
function wbox(kit, W, rec, d0, d1, y0, y1, t0, t1, faces) {
  for (const k of faces) {
    if (k === 'in') rectTY(kit, W, rec, d0, t0, y0, t1, y1, W.IN);
    else if (k === 'out') rectTY(kit, W, rec, d1, t0, y0, t1, y1, W.OUT);
    else if (k === 'top') rectDT(kit, W, rec, y1, d0, t0, d1, t1, UP);
    else if (k === 'bottom') rectDT(kit, W, rec, y0, d0, t0, d1, t1, DOWN);
    else if (k === 'back') rectDY(kit, W, rec, t0, d0, y0, d1, y1, W.BACK);
    else if (k === 'along') rectDY(kit, W, rec, t1, d0, y0, d1, y1, W.ALONG);
  }
}
/**
 * A FACE WITH AN ARCHED OPENING: frame W's face at depth d over t0..t1, y0..y1, facing `out`, cut by `hole` (`{ tc, hw,
 * sill, spring, curve }` - the opening's middle, half-width, sill, springing and its curve of egArchCurve points) - below
 * the sill in three, the piers in two each, the curve's strips up to y1; whole where `hole` is null. Every corner shared.
 */
function holedFace(kit, W, rec, d, t0, t1, y0, y1, out, hole) {
  if (!hole) { rectTY(kit, W, rec, d, t0, y0, t1, y1, out); return; }
  const { tc, hw, sill, spring, curve } = hole, hl = tc - hw, hr = tc + hw;
  for (const [a, b] of [[t0, hl], [hl, hr], [hr, t1]]) rectTY(kit, W, rec, d, a, y0, b, Math.max(y0, sill), out);
  for (const [a, b] of [[t0, hl], [hr, t1]]) { rectTY(kit, W, rec, d, a, Math.max(y0, sill), b, spring, out); rectTY(kit, W, rec, d, a, spring, b, y1, out); }
  for (let i = 0; i + 1 < curve.length; i++) {
    const p = curve[i], q = curve[i + 1], c = [[d, spring + p[1], tc + p[0]], [d, spring + q[1], tc + q[0]], [d, y1, tc + q[0]], [d, y1, tc + p[0]]];
    if (y1 - spring - Math.max(p[1], q[1]) > -1e-6) fq(kit, W, rec, c, out, uvTY(c));
  }
}
/** THE OPENING'S REVEAL through frame W from depth d0 to d1: its jambs, its sill and the soffit of its arch, each facing in. */
function reveal(kit, W, rec, d0, d1, hole, withSill = true) {
  const { tc, hw, sill, spring, curve } = hole;
  rectDY(kit, W, rec, tc - hw, d0, sill, d1, spring, W.ALONG);
  rectDY(kit, W, rec, tc + hw, d0, sill, d1, spring, W.BACK);
  if (withSill) rectDT(kit, W, rec, sill, d0, tc - hw, d1, tc + hw, UP);
  let s = 0;
  for (let i = 0; i + 1 < curve.length; i++) {
    const p = curve[i], q = curve[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = [q[1] - p[1], -(q[0] - p[0])];
    const c = [[d0, spring + p[1], tc + p[0]], [d0, spring + q[1], tc + q[0]], [d1, spring + q[1], tc + q[0]], [d1, spring + p[1], tc + p[0]]];
    fq(kit, W, rec, c, mix(W.ALONG, UP, n[0], n[1]), [[s * S, d0 * S], [(s + len) * S, d0 * S], [(s + len) * S, d1 * S], [s * S, d1 * S]]);
    s += len;
  }
}
/** AN ARCH'S RING in voussoirs: between the curves at `off0` and `off1` out from its intrados, at depth d (its face, facing
 *  `out`), its back (the outer curve's face from d to dBack) and - `soffit` - its underside lip from d to dBack. */
function voussoirRing(kit, W, d, dBack, tc, hw, spring, style, off0, off1, m, out, soffit = false) {
  const a = egArchCurve(style, hw, off0, m), b = egArchCurve(style, hw, off1, m);
  let s = 0;
  for (let i = 0; i < m; i++) {
    const len = Math.hypot(b[i + 1][0] - b[i][0], b[i + 1][1] - b[i][1]);
    const c = [[d, spring + a[i][1], tc + a[i][0]], [d, spring + a[i + 1][1], tc + a[i + 1][0]], [d, spring + b[i + 1][1], tc + b[i + 1][0]], [d, spring + b[i][1], tc + b[i][0]]];
    fq(kit, W, R.voussoir, c, out, [[s * S, 0], [(s + len) * S, 0], [(s + len) * S, (off1 - off0) * S], [s * S, (off1 - off0) * S]]);
    const nb = [b[i + 1][1] - b[i][1], -(b[i + 1][0] - b[i][0])];   // the outer curve's inward normal: its back faces the other way
    const cb = [[d, spring + b[i][1], tc + b[i][0]], [d, spring + b[i + 1][1], tc + b[i + 1][0]], [dBack, spring + b[i + 1][1], tc + b[i + 1][0]], [dBack, spring + b[i][1], tc + b[i][0]]];
    if (Math.abs(dBack - d) > 1e-6) fq(kit, W, R.voussoir, cb, mix(W.ALONG, UP, -nb[0], -nb[1]), [[s * S, 0], [(s + len) * S, 0], [(s + len) * S, Math.abs(dBack - d) * S], [s * S, Math.abs(dBack - d) * S]]);
    if (soffit && Math.abs(dBack - d) > 1e-6) {
      const na = [a[i + 1][1] - a[i][1], -(a[i + 1][0] - a[i][0])];
      const cs = [[d, spring + a[i][1], tc + a[i][0]], [d, spring + a[i + 1][1], tc + a[i + 1][0]], [dBack, spring + a[i + 1][1], tc + a[i + 1][0]], [dBack, spring + a[i][1], tc + a[i][0]]];
      fq(kit, W, R.voussoir, cs, mix(W.ALONG, UP, na[0], na[1]), [[s * S, 0], [(s + len) * S, 0], [(s + len) * S, Math.abs(dBack - d) * S], [s * S, Math.abs(dBack - d) * S]]);
    }
    s += len;
  }
}

// ── THE ACADEMY'S WALL ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE ACADEMY'S WALL (m, a wall's frame - `d` out from the collider's plane): the pilasters' pitch and width; the bays
 * `proud` back from the pilasters' faces (which stand ON the plane); the wall's `thick` (the window's reveal from the bay's
 * face to the outer face: 0.6 m); the plinth's height over the floor, a pilaster's base and capital and how far its shaft
 * stands back; the window's sill over the floor, its head under the wall's top, its half-width, the piers it leaves, the
 * tallest opening an arch style takes; the sill course's height and reach; the archivolt's width and reach; the cornice's
 * height (its profile `cornice` [d, up] - it reaches IN only over the collider's ceiling) and the ressaut over each pilaster
 * the vault's ribs land on.
 */
export const EG_WALL = Object.freeze({
  m: 6, pitch: 3, pil: 0.7, proud: 0.3, thick: 0.9, plinth: 0.5, base: 0.3, cap: 0.45, shaftIn: 0.06,
  sill: 1.2, head: 0.8, hw: 0.65, pier: 0.45, open: Object.freeze({ round: 3.4, pointed: 3.9, lancet: 4.4, squat: 2.6 }),
  course: 0.16, courseOut: 0.14, volt: 0.22, voltOut: 0.08,
  corniceH: 0.35, cornice: Object.freeze([[0.3, 0], [-0.05, 0], [-0.05, 0.12], [-0.24, 0.2], [-0.24, 0.27], [-0.3, 0.35]].map((p) => Object.freeze(p))),
  ressaut: 0.48,
});
/** The cornice's faces (EG_WALL.cornice, from the wall up) each in its band of the moulding: its soffit a fillet, its
 *  fascia the band's ornament, its cove, its metal band, its top a fillet. */
const CORNICE_BANDS = Object.freeze([EG_MOULD_BAND.fillet, EG_MOULD_BAND.ornament, EG_MOULD_BAND.cove, EG_MOULD_BAND.band, EG_MOULD_BAND.fillet]);
/** The pilasters of a wall run t0..t1 on a passage's grid `grid` (its ribs' centres): an anta flush at each end, each grid
 *  point that leaves a bay of at least 0.8 m either side - their centres. */
export function egPilasters(t0, t1, grid) {
  const W = EG_WALL, hp = W.pil / 2, out = [t0 + hp];
  for (const g of grid) if (g - hp >= out[out.length - 1] + hp + 0.8 && g + hp <= t1 - W.pil - 0.8) out.push(g);
  if (t1 - hp > out[out.length - 1] + W.pil) out.push(t1 - hp);
  return out;
}
/** A bay's window (`hole` for holedFace) between pilasters ta..tb over floor yb under the wall's top yTop, or null where none
 *  fits. */
function bayWindow(ta, tb, yb, yTop, style, { sill = /** @type {number} */ (EG_WALL.sill), hwMax = /** @type {number} */ (EG_WALL.hw) } = {}) {
  const W = EG_WALL, hw = Math.min(hwMax, (tb - ta) / 2 - W.pier), s = yb + sill;
  if (hw < 0.3) return null;
  const crown = Math.min(yTop - W.head, s + (W.open[style] ?? W.open.round)), rise = egGroundArchRise(style, hw), spring = crown - rise;
  if (spring - s < 0.6) return null;
  return { tc: (ta + tb) / 2, hw, sill: s, spring, curve: egArchCurve(style, hw, 0, EG_WALL.m) };
}
/**
 * THE ACADEMY'S WALL along frame `W` from t0 to t1 (Elite-Gates-Look.md section 2): each bay a piece of its own (`piece(fn)` -
 * the caller's occluder), holding its pilaster, its plinth (flush with the plane, down to `yFoot`), its face `proud` back,
 * its window through the wall with its reveal, archivolt, keystone and sill course, its outer face, and the cornice over
 * it. `ybAt(t)` the floor a bay stands over (the Mist Stair's windows step down with it), `yTop` the collider's top,
 * `style` the band's arch, `pil` the pilasters' centres (egPilasters), `ends` an end face at each end ([t0's, t1's] - a
 * passage's mouth, never a cut a niche's own walls stand in), `top` the cornice and wall-top (null: none - a Collapsing
 * Tube's lid sits on it), `bay(kit, ta, tb, yb)` a kit's own dress in a bay (it answers false to keep its window), `vault`
 * whether a vault springs from the cornice (the ressauts its ribs land on).
 */
function academyWall(W, o, piece) {
  const E = EG_WALL, { t0, t1, yFoot, ybAt, yTop, style, pil, vault } = o, ys = yTop + E.corniceH, hp = E.pil / 2, D = E.thick;
  const mode = o.crown ?? 'cornice', top = mode === 'cornice', yHead = top ? ys : yTop, ends = o.ends ?? [null, null];
  const crownOf = (kit, ta, tb, capA, capB) => (top ? cornice(kit, W, ta, tb, yTop, vault, capA, capB) : coping(kit, W, ta, tb, yTop, mode, capA, capB));
  for (let k = 0; k < pil.length; k++) {
    const tp = pil[k], pa = Math.max(t0, tp - hp), pb = Math.min(t1, tp + hp), ybp = ybAt(tp) + E.plinth;
    const ta = pb, tb = k + 1 < pil.length ? pil[k + 1] - hp : t1, ybay = ybAt((ta + tb) / 2), yb0 = ybay + E.plinth;
    const first = k === 0, last = k === pil.length - 1;
    // a pilaster's sides, but where it ends the wall (the end's own face, or a niche's wall, stands there)
    const sides = [...(first ? [] : ['back']), ...(last && tb - ta < 1e-3 ? [] : ['along'])];
    piece((kit) => {
      // THE PILASTER, its face ON the plane: its plinth, its base and capital (the moulding), its shaft; its sides into the bay
      const flat = Math.abs(ybp - yb0) < 1e-6 && tb - ta > 1e-3;   // its plinth one face with the bay's
      if (!flat) rectTY(kit, W, R.wall, 0, pa, yFoot, pb, ybp, W.IN);
      mouldTY(kit, W, 0, pa, ybp, pb, ybp + E.base, W.IN, EG_MOULD_BAND.band);
      fq(kit, W, R.shaft, [[0, ybp + E.base, pa], [0, ybp + E.base, pb], [0, yTop - E.cap, pb], [0, yTop - E.cap, pa]], W.IN, [[0, (ybp + E.base) * S], [0.5, (ybp + E.base) * S], [0.5, (yTop - E.cap) * S], [0, (yTop - E.cap) * S]]);   // its shaft fluted (the kit's shaft, four flutes across)
      mouldTY(kit, W, 0, pa, yTop - E.cap, pb, yTop, W.IN, EG_MOULD_BAND.capital);
      for (const sd of sides) rectDY(kit, W, R.wall, sd === 'back' ? pa : pb, 0, ybp, E.proud, yTop, sd === 'back' ? W.BACK : W.ALONG);
      rectDT(kit, W, R.wall, yFoot, 0, pa, D, Math.max(pb, tb), DOWN);
      if (first && ends[0]) rectDY(kit, W, R.wall, t0, 0, ends[0][0], D, ends[0][1], W.BACK);
      if (last && ends[1]) rectDY(kit, W, R.wall, t1, 0, ends[1][0], D, ends[1][1], W.ALONG);
      if (top && vault) {   // the ressaut the rib lands on
        mouldTY(kit, W, -E.ressaut, pa, yTop + 0.12, pb, ys, W.IN, EG_MOULD_BAND.ornament);
        mouldDT(kit, W, yTop + 0.12, -E.ressaut, pa, -0.1, pb, DOWN, EG_MOULD_BAND.fillet);
        mouldDY(kit, W, pa, -E.ressaut, yTop + 0.12, -0.1, ys, W.BACK, EG_MOULD_BAND.ornament);
        mouldDY(kit, W, pb, -E.ressaut, yTop + 0.12, -0.1, ys, W.ALONG, EG_MOULD_BAND.ornament);
      }
      crownOf(kit, pa, Math.max(pb, tb), first && !!ends[0], last && !!ends[1]);   // its crown over the pilaster and the bay, one run
      if (tb - ta < 1e-3) { rectTY(kit, W, R.wall, D, pa, yFoot, pb, yHead, W.OUT); return; }
      // THE BAY: its plinth (one face with the pilaster's), its ledge, its face back from the plane with its window, the
      // reveal through the wall, the outer face (the pilaster's with it)
      rectTY(kit, W, R.wall, 0, flat ? pa : ta, yFoot, tb, yb0, W.IN);
      mouldDT(kit, W, yb0, 0, ta, E.proud, tb, UP, EG_MOULD_BAND.fillet);
      const own = o.bay ? o.bay(kit, ta, tb, ybay) : null;
      const hole = own && own.hole !== undefined ? own.hole : bayWindow(ta, tb, ybay, yTop, style);
      holedFace(kit, W, R.wall, E.proud, ta, tb, own?.from ?? yb0, yTop, W.IN, hole);
      holedFace(kit, W, R.wall, D, pa, tb, yFoot, yHead, W.OUT, hole);
      if (hole) {
        reveal(kit, W, R.wall, E.proud, D, hole);
        // the sill course across the bay, the archivolt round the head (its face proud of the bay's), its keystone
        const cs = hole.sill, cd = E.proud - E.courseOut;
        if (!own?.noCourse) { mouldDT(kit, W, cs, cd, ta, E.proud, tb, UP, EG_MOULD_BAND.fillet); mouldTY(kit, W, cd, ta, cs - E.course, tb, cs, W.IN, EG_MOULD_BAND.band); }
        voussoirRing(kit, W, E.proud - E.voltOut, E.proud - E.voltOut, hole.tc, hole.hw, hole.spring, style, 0, E.volt, E.m, W.IN);
        const crown = hole.spring + egGroundArchRise(style, hole.hw);
        wbox(kit, W, R.voussoir, E.proud - E.voltOut - 0.06, E.proud, crown - 0.04, crown + E.volt + 0.12, hole.tc - 0.13, hole.tc + 0.13, ['in', 'top', 'back', 'along']);
      }
    });
  }
}
/** A WALL'S CROWN where no ceiling of the law stands over it (nothing may reach in over the walk): `coping` a moulded coping
 *  flush with the plane, overhanging outward; `flat` its top alone (a Collapsing Tube's lid sits on it). */
function coping(kit, W, ta, tb, yTop, mode, capA, capB) {
  const D = EG_WALL.thick;
  if (mode === 'flat') { rectDT(kit, W, R.wall, yTop, 0, ta, D, tb, UP); return; }
  mouldTY(kit, W, 0, ta, yTop, tb, yTop + 0.3, W.IN, EG_MOULD_BAND.capital);
  mouldTY(kit, W, D + 0.12, ta, yTop, tb, yTop + 0.3, W.OUT, EG_MOULD_BAND.capital);
  mouldDT(kit, W, yTop + 0.3, 0, ta, D + 0.12, tb, UP, EG_MOULD_BAND.fillet);
  mouldDT(kit, W, yTop, D, ta, D + 0.12, tb, DOWN, EG_MOULD_BAND.fillet);
  if (capA) mouldDY(kit, W, ta, 0, yTop, D + 0.12, yTop + 0.3, W.BACK, EG_MOULD_BAND.capital);
  if (capB) mouldDY(kit, W, tb, 0, yTop, D + 0.12, yTop + 0.3, W.ALONG, EG_MOULD_BAND.capital);
}
/** THE CORNICE over frame W from ta to tb on the wall's top yTop: its profile (EG_WALL.cornice) in the moulding's record, u
 *  along and v down its profile; its caps where it ends; the wall's top behind it where no vault springs. */
function cornice(kit, W, ta, tb, yTop, vault, capA, capB) {
  const P = EG_WALL.cornice, ys = yTop + EG_WALL.corniceH, bands = CORNICE_BANDS;
  for (let i = 0; i + 1 < P.length; i++) {
    // the profile runs in and up from the bay's face: each face looks down and in, (-dv, dd) in the frame's (d, up); each
    // laid in its band of the moulding (its v down from the face's upper edge)
    const p = P[i], q = P[i + 1], n = [-(q[1] - p[1]), q[0] - p[0]], b = bands[i], v0 = q[1] > p[1] ? b[1] : b[0], v1 = q[1] > p[1] ? b[0] : b[1];
    const c = [[p[0], yTop + p[1], ta], [p[0], yTop + p[1], tb], [q[0], yTop + q[1], tb], [q[0], yTop + q[1], ta]];
    fq(kit, W, R.moulding, c, mix(W.OUT, UP, n[0], n[1]), [[ta * S, v0], [tb * S, v0], [tb * S, v1], [ta * S, v1]]);
  }
  if (!vault) mouldDT(kit, W, ys, P[P.length - 1][0], ta, EG_WALL.thick, tb, UP, EG_MOULD_BAND.fillet);
  // its caps where it ends, in front of the wall's end face (d < 0): fanned from the plane at its top
  for (const [t, on, dir] of [[ta, capA, W.BACK], [tb, capB, W.ALONG]]) {
    if (!on) continue;
    const ring = [[0, yTop], ...P.filter((p) => p[0] < 0).map((p) => [p[0], yTop + p[1]]), [0, ys]];
    for (let i = 0; i + 2 < ring.length; i++) {
      const a = ring[ring.length - 1], b = ring[i], c = ring[i + 1];
      const cv = (pt) => [pt[0] * S, EG_MOULD_BAND.cove[0] + (ys - pt[1]) * S];
      kit.tri(R.moulding, W.at(a[0], a[1], t), W.at(b[0], b[1], t), W.at(c[0], c[1], t), dir, true, cv(a), cv(b), cv(c));
    }
  }
}

// ── THE VAULT ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE VAULT (m): its ribs' reach under the barrel (a pilaster's width - each over one), the coffers' depth into it (a
 *  coffer a segment, the second from each springing; the crown's two and the springers flush between), the barrel's back
 *  (it springs at the walls' outer faces), the curve's segments; a broken bay lies open across the crown's two segments. */
export const EG_VAULT = Object.freeze({ rib: 0.18, coffer: 0.15, back: 1.2, m: 6 });
/** Which bays of a vault of `n` lie open to the sky (Elite-Gates-Look.md section 2): one, or two when the passage is long
 *  enough, by the hall's seed - never a mouth's. Pure. */
export function egVaultOpen(spec, q, n) {
  if (n < 4) return [];
  const h = egGroundHash(spec.seed ?? 0, spec.h ?? 0, q.z0 * 100, q.x * 100), a = 1 + Math.floor(h * (n - 2));
  const b = 1 + ((a - 1 + Math.floor((n - 2) / 2)) % (n - 2));
  return h > 0.4 && n >= 7 && b !== a ? [a, b].sort((x, y) => x - y) : [a];
}
/**
 * THE VAULT over passage `q` (Elite-Gates-Look.md section 2): springing from the cornice over the collider's ceiling - a
 * barrel of the band's arch, a voussoir rib over each pilaster of `grid` (the mouths' two its ends, flush), coffers between
 * (each segment's middle set back EG_VAULT.coffer, framed), its back the roof seen from over the halls; the bays of `open`
 * broken across the crown to the sky, their ribs crossing the gap. A bay a piece.
 */
function passageVault(spec, q, grid, style, open, piece) {
  const V = EG_VAULT, E = EG_WALL, hp = E.pil / 2, yTop = Math.max(q.y, q.yB ?? q.y) + q.height, ys = yTop + E.corniceH, rv = q.halfW + E.cornice[E.cornice.length - 1][0];
  const P = (p, z) => DG(spec, q.x + p[0], ys + p[1], z);
  const A = egArchCurve(style, rv, 0, V.m), Rb = egArchCurve(style, rv, -V.rib, V.m), Pn = egArchCurve(style, rv, V.coffer, V.m), Ex = egArchCurve(style, rv, V.back, V.m);
  const inward = (C, j) => [C[j + 1][1] - C[j][1], -(C[j + 1][0] - C[j][0]), 0];
  const along = (C, j) => [C[j + 1][0] - C[j][0], C[j + 1][1] - C[j][1], 0];
  const arc = (C) => { const o = [0]; for (let j = 0; j < V.m; j++) o.push(o[j] + Math.hypot(C[j + 1][0] - C[j][0], C[j + 1][1] - C[j][1])); return o; };
  const sA = arc(A), sE = arc(Ex), sR = arc(Rb), lo = V.m / 2 - 1, hi = V.m / 2;
  const holeIn = (k, j) => open.includes(k) && j >= lo && j <= hi, coffer = (j) => j === 1 || j === V.m - 2;
  /** a quad between curve points a0 and a1 from z0 to z1 */
  const strip = (kit, rec, a0, a1, z0, z1, out, uv) => kit.quad(rec, P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1), out, true, uv);
  /** a quad across the passage at z, between curve points a0-a1 and b1-b0 */
  const across = (kit, rec, a0, a1, b1, b0, z, out, s0 = 0, s1 = 1, h0 = 0, h1 = 0.3) => kit.quad(rec, P(a0, z), P(a1, z), P(b1, z), P(b0, z), out, true, [[s0 * S, 0], [s1 * S, 0], [s1 * S, h1 * S], [s0 * S, h0 * S]]);
  const rib = (kit, k) => {
    const z0 = Math.max(q.z0, grid[k] - hp), z1 = Math.min(q.z1, grid[k] + hp);
    for (let j = 0; j < V.m; j++) {
      strip(kit, R.voussoir, Rb[j], Rb[j + 1], z0, z1, inward(Rb, j), [[sR[j] * S, 0], [sR[j + 1] * S, 0], [sR[j + 1] * S, (z1 - z0) * S], [sR[j] * S, (z1 - z0) * S]]);
      // its sides: up into the coffers' depth, or to the barrel's back where it meets a mouth or crosses an open bay
      const top0 = k === 0 || holeIn(k - 1, j) ? Ex : coffer(j) ? Pn : A, top1 = k === grid.length - 1 || holeIn(k, j) ? Ex : coffer(j) ? Pn : A;
      // its sides: u along its arc, v out from its underside (EG_KIT_MAP voussoir)
      const d0 = Math.hypot(top0[j][0] - Rb[j][0], top0[j][1] - Rb[j][1]), d1 = Math.hypot(top1[j][0] - Rb[j][0], top1[j][1] - Rb[j][1]);
      across(kit, R.voussoir, Rb[j], Rb[j + 1], top0[j + 1], top0[j], z0, [0, 0, -1], sR[j], sR[j + 1], d0, d0);
      across(kit, R.voussoir, Rb[j], Rb[j + 1], top1[j + 1], top1[j], z1, [0, 0, 1], sR[j], sR[j + 1], d1, d1);
    }
  };
  /** the roof over z0..z1 on segment j: the barrel's back seen from above */
  const roof = (kit, j, z0, z1) => { if (z1 - z0 > 1e-6) strip(kit, R.wall, Ex[j + 1], Ex[j], z0, z1, inward(Ex, j).map((v) => -v), [[sE[j + 1] * S, z0 * S], [sE[j] * S, z0 * S], [sE[j] * S, z1 * S], [sE[j + 1] * S, z1 * S]]); };
  for (let k = 0; k + 1 < grid.length; k++) {
    const za = grid[k] + hp, zb = grid[k + 1] - hp, r0 = k === 0 ? q.z0 : grid[k], r1 = k + 2 === grid.length ? q.z1 : grid[k + 1];
    piece((kit) => {
      rib(kit, k);
      if (k + 2 === grid.length) rib(kit, k + 1);
      for (let j = 0; j < V.m; j++) {
        if (holeIn(k, j)) { roof(kit, j, r0, za); roof(kit, j, zb, r1); continue; }
        roof(kit, j, r0, r1);
        const n = inward(A, j), t = along(A, j), u = (s) => (sA[j] + (sA[j + 1] - sA[j]) * s) * S;
        const uvz = (s0, s1) => [[za * S, u(s0)], [za * S, u(s1)], [zb * S, u(s1)], [zb * S, u(s0)]];
        if (!coffer(j)) { strip(kit, R.wall, A[j], A[j + 1], za, zb, n, uvz(0, 1)); continue; }
        // a coffer: its panel set back the segment's width, its two long sides (its ends are the ribs')
        strip(kit, R.wall, A[j], Pn[j], za, zb, t, uvz(0, 0.1));
        strip(kit, R.wall, Pn[j + 1], A[j + 1], za, zb, t.map((v) => -v), uvz(0.9, 1));
        strip(kit, R.wall, Pn[j], Pn[j + 1], za, zb, n, uvz(0, 1));
      }
      if (open.includes(k)) {   // the broken edges: the barrel's thickness facing the gap
        strip(kit, R.wall, A[lo], Ex[lo], za, zb, along(A, lo), [[0, za * S], [V.back * S, za * S], [V.back * S, zb * S], [0, zb * S]]);
        strip(kit, R.wall, Ex[hi + 1], A[hi + 1], za, zb, along(A, hi).map((v) => -v), [[0, za * S], [V.back * S, za * S], [V.back * S, zb * S], [0, zb * S]]);
      }
    });
  }
}

// ── THE PASSAGES ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A passage's grid: the centres of its ribs and its pilasters - the mouths' two flush, the rest EG_WALL.pitch apart (as
 *  near as its length allows). */
export function egPassageGrid(q, pitch = /** @type {number} */ (EG_WALL.pitch)) {
  const hp = EG_WALL.pil / 2, n = Math.max(1, Math.round((q.z1 - q.z0) / pitch)), step = (q.z1 - q.z0) / n;
  return [q.z0 + hp, ...Array.from({ length: n - 1 }, (_, k) => q.z0 + (k + 1) * step), q.z1 - hp];
}
/** The floor passage `q` stands on at z: its near floor, its far floor, and across its chasm the line between (the Mist
 *  Stair's windows step down with its flights). */
export function egPassageFloorAt(q, z) {
  const yB = q.yB ?? q.y;
  if (yB === q.y || q.zA == null || q.zB == null || q.zB <= q.zA) return q.y;
  if (z <= q.zA) return q.y;
  return z >= q.zB ? yB : q.y + ((yB - q.y) * (z - q.zA)) / (q.zB - q.zA);
}
/**
 * A PASSAGE OF THE ACADEMY (Elite-Gates-Look.md section 2 - world/eliteGates/egHall.js caveModel's mesh): passage `q` of hall `spec`,
 * `runs` its walls' runs a side ([side -1's, side 1's], each [[z0, z1], ...] - egHall.js wallRuns: broken at its alcoves),
 * `cuts` each side's niches ([[za, zb, y0, y1], ...] - a niche's mouth, floor and lid), `foot` how far its walls run under its
 * lowest floor (egHall.js egWallFoot), `band` the band, `piece(build)` the caller's occluder laying a kit's piece. Its walls
 * the academy's (each bay a piece), the lintel over each niche's mouth, its vault (none open to the moon, none over a
 * Collapsing Tube - the spans' lid), and its kit's own form. An open passage (the Colonnade) its drums alone.
 */
export function egPassage(spec, q, { runs, cuts, foot, band, piece }) {
  const E = EG_WALL, w = q.halfW, yLo = Math.min(q.y, q.yB ?? q.y), yHi = Math.max(q.y, q.yB ?? q.y), yTop = yHi + q.height, ys = yTop + E.corniceH;
  const yFoot = yLo - foot, style = egKitStyle(band).arch, kit = q.kit, grid = egPassageGrid(q);
  if (q.open) { colonnade(spec, q, grid, band, piece); return; }
  if (kit === 'caverns' || kit === 'deep') { cavernRock(spec, q, runs, cuts, yFoot, yTop, piece); return; }
  const vault = !q.tube && kit !== 'gloam', crown = q.tube ? 'flat' : vault ? 'cornice' : 'coping', head = vault ? ys : yTop;
  const crownOf = (kt, W, a, b) => (vault ? cornice(kt, W, a, b, yTop, true, false, false) : coping(kt, W, a, b, yTop, crown, false, false));
  for (const s of [-1, 1]) {
    const W = egWallFrame(spec, q.x + s * w, 0, q.x + s * w, 1, -s, 0), sideCuts = cuts[s < 0 ? 0 : 1];
    const endAt = (z) => {
      if (Math.abs(z - q.z0) < 1e-6 || Math.abs(z - q.z1) < 1e-6) return [yFoot, head];
      const c = sideCuts.find((g) => Math.abs(g[0] - z) < 1e-6 || Math.abs(g[1] - z) < 1e-6);
      return c ? [yFoot, c[2]] : null;
    };
    for (const [ra, rb] of runs[s < 0 ? 0 : 1]) {
      if (rb - ra < E.pil * 2 + 0.2) {   // a stub between two niches: a pier of plain ashlar
        piece((kt) => { wbox(kt, W, R.wall, 0, E.thick, yFoot, head, ra, rb, ['in', 'out', 'bottom']); crownOf(kt, W, ra, rb); });
        continue;
      }
      academyWall(W, { t0: ra, t1: rb, yFoot, ybAt: (z) => egPassageFloorAt(q, z), yTop, style, pil: egPilasters(ra, rb, grid), vault, ends: [endAt(ra), endAt(rb)], crown, bay: kitBay(spec, q, W, band) }, piece);
    }
    // over each niche's mouth the wall goes on: a lintel from its lid to the cornice, and the plinth under its floor
    for (const [za, zb, y0, y1] of sideCuts) piece((kt) => {
      wbox(kt, W, R.wall, 0, E.thick, y1, head, za, zb, ['in', 'out']);
      wbox(kt, W, R.wall, 0, E.thick, yFoot, y0, za, zb, ['in', 'out', 'bottom']);
      crownOf(kt, W, za, zb);
    });
  }
  if (vault) passageVault(spec, q, grid, style, egVaultOpen(spec, q, grid.length - 1), piece);
  if (kit === 'gloam') thicket(spec, q, yFoot, yTop, piece);
}
/** A kit's own dress in a bay (academyWall's `bay`): the Stacks' bookcase under a clerestory window, the Forge's hearth -
 *  or null (the academy's window). */
function kitBay(spec, q, W, band) {
  const yTop = Math.max(q.y, q.yB ?? q.y) + q.height, style = egKitStyle(band).arch;
  if (q.kit === 'stacks') return (kit, ta, tb, yb) => { bookcase(kit, W, ta, tb, yb, spec); return { from: yb + EG_STACKS.h, hole: bayWindow(ta, tb, yb, yTop, style, { sill: EG_STACKS.h + 0.5, hwMax: 0.5 }), noCourse: true }; };
  // every other bay of the Forge a hearth, of the Ossuary its loculi (the rest the academy's windows)
  const odd = (ta) => Math.round((ta - q.z0) / EG_WALL.pitch) % 2 === 1;
  if (q.kit === 'forge') return (kit, ta, tb, yb) => (odd(ta) ? forgeBay(kit, W, ta, tb, yb, yTop, spec) : null);
  if (q.kit === 'ossuary') return (kit, ta, tb, yb) => (odd(ta) ? loculi(kit, W, ta, tb, yb, yTop, style, spec) : null);
  return null;
}

// ── THE KITS' OWN FORMS ──────────────────────────────────────────────────────────────────────────────────────────
/** THE STACKS' BOOKCASE (m): its top over the floor, its back into the wall (out from the plane), its front just behind the
 *  plane, its boards' thickness, its shelves. */
export const EG_STACKS = Object.freeze({ h: 3.0, back: 0.55, front: 0.04, board: 0.06, shelves: 5 });
/** A bookcase set into a bay of the Fallen Stacks (frame W, ta..tb over floor yb): its frame, its back sunk into the wall,
 *  its shelves, and on each shelf its books - runs of spines (the dark of the band's root, the gilt of its moulding), some
 *  leaning, some gone - all behind the collider's plane. */
function bookcase(kit, W, ta, tb, yb, spec) {
  const B = EG_STACKS, y0 = yb + EG_WALL.plinth, y1 = yb + B.h, f = B.front, k = B.board;
  rectTY(kit, W, R.metal, f, ta, y1 - 0.16, tb, y1, W.IN);   // the cornice board
  rectDT(kit, W, R.metal, y1 - 0.16, f, ta, B.back, tb, DOWN);
  rectTY(kit, W, R.metal, f, ta, y0, ta + k, y1 - 0.16, W.IN);   // the stiles
  rectTY(kit, W, R.metal, f, tb - k, y0, tb, y1 - 0.16, W.IN);
  rectDY(kit, W, R.metal, ta + k, f, y0, B.back, y1 - 0.16, W.ALONG);
  rectDY(kit, W, R.metal, tb - k, f, y0, B.back, y1 - 0.16, W.BACK);
  rectTY(kit, W, R.root, B.back, ta + k, y0, tb - k, y1 - 0.16, W.IN);   // the back, in the wall
  rectDT(kit, W, R.metal, EG_WALL.proud, 0, ta, f, tb, DOWN);
  const n = B.shelves, gap = (y1 - 0.16 - y0) / n;
  for (let i = 0; i < n; i++) {
    const ys = y0 + i * gap;
    // the shelf: its front edge and its top
    rectTY(kit, W, R.metal, f, ta + k, ys, tb - k, ys + 0.05, W.IN);
    rectDT(kit, W, R.metal, ys + 0.05, f, ta + k, B.back, tb - k, UP);
    if (i > 0) rectDT(kit, W, R.metal, ys, f, ta + k, B.back, tb - k, DOWN);
    // its books: runs of spines of a height and a depth, a gap where some fell
    let t = ta + k + 0.02;
    for (let r = 0; t < tb - k - 0.12 && r < 6; r++) {
      const hsh = egGroundHash(spec.seed ?? 0, Math.round(ta * 10), i, r), len = Math.min(tb - k - 0.02 - t, 0.25 + hsh * 0.55);
      if (hsh < 0.16) { t += len; continue; }   // a gap: these fell
      const hgt = Math.min(gap - 0.12, 0.24 + 0.2 * egGroundHash(r, i, Math.round(tb * 10))), dep = 0.08 + 0.1 * egGroundHash(i, r, 7);
      const rec = hsh > 0.82 ? R.metal : R.root;
      wbox(kit, W, rec, f + dep, B.back - 0.02, ys + 0.05, ys + 0.05 + hgt, t, t + len, ['in', 'top', 'back', 'along']);
      t += len + 0.01;
    }
  }
}
/** THE FORGE GUT'S BAY (m): a hearth sunk in the wall at the floor (its mouth's half-width, its springing over the plinth, its
 *  depth into the wall), its glow the band's liquid; an anvil on the plinth before it; two pipes from the hearth's head to
 *  the capitals; the bay's window over them. */
export const EG_FORGE = Object.freeze({ hw: 0.55, spring: 0.75, deep: 0.45, zone: 2.1, pipe: 0.09, sill: 2.5 });
function forgeBay(kit, W, ta, tb, yb, yTop, spec) {
  const F = EG_FORGE, E = EG_WALL, y0 = yb + E.plinth, tc = (ta + tb) / 2, top = yb + F.zone;
  const hole = { tc, hw: F.hw, sill: y0, spring: y0 + F.spring, curve: egArchCurve('squat', F.hw, 0, 6) };
  holedFace(kit, W, R.wall, E.proud, ta, tb, y0, top, W.IN, hole);
  reveal(kit, W, R.wall, E.proud, E.proud + F.deep, hole);
  // the hearth's back: its fire, the band's liquid (its light capped - world/eliteGates/egBandArt.js EG_MOLTEN_LUMA_MAX)
  const db = E.proud + F.deep;
  rectTY(kit, W, R.molten, db, tc - F.hw, y0, tc + F.hw, hole.spring, W.IN);
  for (let i = 0; i + 1 < hole.curve.length; i++) {
    const p = hole.curve[i], q = hole.curve[i + 1];
    kit.tri(R.molten, W.at(db, hole.spring, tc), W.at(db, hole.spring + p[1], tc + p[0]), W.at(db, hole.spring + q[1], tc + q[0]), W.IN, true);
  }
  voussoirRing(kit, W, E.proud - 0.06, E.proud, tc, F.hw, hole.spring, 'squat', 0, 0.2, 6, W.IN, true);
  // the anvil on the plinth before it: its block, its face, its horn
  wbox(kit, W, R.metal, 0.08, 0.26, y0, y0 + 0.28, tc - 0.18, tc + 0.18, ['in', 'top', 'back', 'along']);
  wbox(kit, W, R.metal, 0.05, 0.28, y0 + 0.28, y0 + 0.4, tc - 0.32, tc + 0.3, ['in', 'top', 'bottom', 'back', 'along']);
  kit.quad(R.metal, W.at(0.08, y0 + 0.4, tc - 0.32), W.at(0.25, y0 + 0.4, tc - 0.32), W.at(0.2, y0 + 0.36, tc - 0.48), W.at(0.12, y0 + 0.36, tc - 0.48), UP, true);
  // the pipes, from the hearth's head up the bay to the capitals
  for (const t of [ta + 0.24]) {
    const ring = Array.from({ length: 6 }, (_, k) => [Math.cos((k / 6) * TAU) * F.pipe, Math.sin((k / 6) * TAU) * F.pipe]);
    kit.sweep(R.metal, ring, [W.at(0.15, y0, t), W.at(0.15, yTop - EG_WALL.cap, t)]);
    for (const yy of [yTop - 1.4]) wbox(kit, W, R.metal, 0.02, E.proud, yy, yy + 0.08, t - 0.13, t + 0.13, ['in', 'top', 'bottom', 'back', 'along']);
  }
  void spec;
  return { from: top, hole: bayWindow(ta, tb, yb, yTop, 'squat', { sill: F.sill, hwMax: 0.5 }) };
}
/** THE OSSUARY'S LOCULI (m): a row in each bay under its window - each a recess `deep` into the wall, a skull and a long bone
 *  in it (the band's metal: bone) - the zone they stand in over the plinth, and the window's sill over them. */
export const EG_LOCULI = Object.freeze({ w: 0.42, h: 0.34, deep: 0.3, zone: 0.75, sill: 1.6 });
function loculi(kit, W, ta, tb, yb, yTop, style, spec) {
  const L = EG_LOCULI, E = EG_WALL, y0 = yb + E.plinth, y1 = y0 + L.zone, d = E.proud, n = Math.max(1, Math.min(2, Math.floor((tb - ta - 0.2) / (L.w + 0.22))));
  const step = (tb - ta) / n, yh0 = y0 + (L.zone - L.h) / 2, yh1 = yh0 + L.h, edges = [ta];
  for (let i = 0; i < n; i++) { const c = ta + step * (i + 0.5); edges.push(c - L.w / 2, c + L.w / 2); }
  edges.push(tb);
  // the face round them, every corner shared; each recess, its skull and its bone
  for (let i = 0; i + 1 < edges.length; i++) {
    rectTY(kit, W, R.wall, d, edges[i], y0, edges[i + 1], yh0, W.IN);
    rectTY(kit, W, R.wall, d, edges[i], yh1, edges[i + 1], y1, W.IN);
    if (i % 2 === 0) rectTY(kit, W, R.wall, d, edges[i], yh0, edges[i + 1], yh1, W.IN);
  }
  for (let i = 0; i < n; i++) {
    const a = edges[1 + 2 * i], b = edges[2 + 2 * i], c = (a + b) / 2, h = egGroundHash(spec.seed ?? 0, Math.round(c * 10), Math.round(yb));
    wbox(kit, W, R.root, d, d + L.deep, yh0, yh1, a, b, ['bottom', 'top', 'back', 'along']);
    rectTY(kit, W, R.root, d + L.deep, a, yh0, b, yh1, W.IN);
    rectDT(kit, W, R.root, yh0, d, a, d + L.deep, b, UP);
    if (h < 0.85) wbox(kit, W, R.metal, d + 0.06, d + 0.22, yh0, yh0 + 0.15, c - 0.08 + (h - 0.5) * 0.1, c + 0.08 + (h - 0.5) * 0.1, ['in', 'top', 'back', 'along']);   // the skull
    if (h > 0.3) wbox(kit, W, R.metal, d + 0.12, d + 0.17, yh0, yh0 + 0.04, a + 0.03, b - 0.03, ['in', 'top']);   // a long bone along its floor
  }
  return { from: y1, hole: bayWindow(ta, tb, yb, yTop, style, { sill: L.sill }) };
}
/** A TAPERED TRUNK along polyline `path` (dungeon points), radius `radii[i]` at each, `sides` round - its sides out from its
 *  axis, its top closed. */
function trunk(kit, rec, path, radii, sides) {
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], t0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], tl = Math.hypot(t0[0], t0[1], t0[2]) || 1, t = [t0[0] / tl, t0[1] / tl, t0[2] / tl];
    const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], sx = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]], sl = Math.hypot(sx[0], sx[1], sx[2]) || 1, s = [sx[0] / sl, sx[1] / sl, sx[2] / sl];
    const u = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
    return Array.from({ length: sides }, (_, k) => { const an = (k / sides) * TAU, c = Math.cos(an) * radii[i], sn = Math.sin(an) * radii[i]; return [p[0] + s[0] * c + u[0] * sn, p[1] + s[1] * c + u[1] * sn, p[2] + s[2] * c + u[2] * sn]; });
  });
  let v = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const len = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]), mid = [(path[i][0] + path[i + 1][0]) / 2, (path[i][1] + path[i + 1][1]) / 2, (path[i][2] + path[i + 1][2]) / 2];
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides, w = (TAU * radii[i]) / sides;
      kit.quad(rec, rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k], mid, false, [[k * w * S, ROCK_BED[1]], [(k + 1) * w * S, ROCK_BED[1]], [(k + 1) * w * S, ROCK_BED[0]], [k * w * S, ROCK_BED[0]]]);
    }
    v += len;
  }
  const last = rings[rings.length - 1], tip = path[path.length - 1];
  for (let k = 0; k < sides; k++) kit.tri(rec, last[k], last[(k + 1) % sides], tip, [tip[0] - path[path.length - 2][0], tip[1] - path[path.length - 2][1], tip[2] - path[path.length - 2][2]], true);
}
/** THE BROKEN COLONNADE (an open passage): on each side, past the walk, a stylobate a step under the floor, and the band's
 *  columns on it every 4 m - whole with their capitals, broken at a height the seed draws, or fallen in drums along it. */
export const EG_COLONNADE = Object.freeze({ pitch: 4, at: 0.95, r: 0.38, h: 4.6, flutes: 8, step: 0.15, width: 1.8 });
/** A column's sides round `ring` (points [x, z] about `c`) from y0 up to each point's own top, wearing the shaft's picture
 *  round it `around` times and up it (EG_KIT_MAP shaft: u round, v up 2 m a repeat). */
function shaftSides(kit, ring, c, y0, tops, around) {
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const p = ring[k], q = ring[(k + 1) % n], u0 = (k / n) * around, u1 = ((k + 1) / n) * around;
    kit.quad(R.shaft, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], tops[(k + 1) % n], q[1]], [p[0], tops[k], p[1]], [p[0] + q[0] - 2 * c[0], 0, p[1] + q[1] - 2 * c[1]], true, [[u0, y0 * S], [u1, y0 * S], [u1, tops[(k + 1) % n] * S], [u0, tops[k] * S]]);
  }
}
/** A fallen drum from p0 to p1 (dungeon points), radius r, `sides` round: its sides wearing the shaft's picture along it. */
function drum(kit, p0, p1, r, sides, around) {
  const ax = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(ax[0], ax[1], ax[2]) || 1, t = [ax[0] / L, ax[1] / L, ax[2] / L];
  const sx = [t[2], 0, -t[0]], sl = Math.hypot(sx[0], sx[2]) || 1, sd = [sx[0] / sl, 0, sx[2] / sl], up = [t[1] * sd[2] - t[2] * sd[1], t[2] * sd[0] - t[0] * sd[2], t[0] * sd[1] - t[1] * sd[0]];
  const at = (o, k) => { const a = (k / sides) * TAU, c = Math.cos(a) * r, si = Math.sin(a) * r; return [o[0] + sd[0] * c + up[0] * si, o[1] + sd[1] * c + up[1] * si, o[2] + sd[2] * c + up[2] * si]; };
  const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
  for (let k = 0; k < sides; k++) kit.quad(R.shaft, at(p0, k), at(p0, k + 1), at(p1, k + 1), at(p1, k), mid, false, [[(k / sides) * around, 0], [((k + 1) / sides) * around, 0], [((k + 1) / sides) * around, L * S], [(k / sides) * around, L * S]]);
}
function colonnade(spec, q, grid, band, piece) {
  const C = EG_COLONNADE, y = q.y, yS = y - C.step;
  void grid; void band;
  for (const s of [-1, 1]) {
    const W = egWallFrame(spec, q.x + s * (q.halfW + 0.02), 0, q.x + s * (q.halfW + 0.02), 1, -s, 0);
    piece((kit) => {   // the stylobate: two steps down from the walk, a ledge over the void
      wbox(kit, W, R.wall, 0, C.width, yS - 0.9, yS, q.z0, q.z1, ['in', 'out', 'top', 'bottom', 'back', 'along']);
      wbox(kit, W, R.wall, 0.3, C.width + 0.3, yS - 1.6, yS - 0.9, q.z0 + 0.3, q.z1 - 0.3, ['in', 'out', 'top', 'bottom', 'back', 'along']);
    });
    for (let z = q.z0 + C.pitch / 2; z < q.z1 - 0.8; z += C.pitch) {
      const h = egGroundHash(spec.seed ?? 0, spec.h ?? 0, Math.round(z * 10), s), cx = q.x + s * (q.halfW + C.at), base = DG(spec, cx, yS, z);
      piece((kit) => column(kit, base, h < 0.35 ? C.h : h < 0.8 ? 1.2 + (h - 0.35) * 5 : 0.45, h < 0.35, h >= 0.8 ? { s, z, spec, cx, yS, q } : null, h));
    }
  }
}
/** A FLUTED COLUMN standing at dungeon point `base`: its plinth, its base's torus, its shaft `hgt` tall with EG_COLONNADE's
 *  flutes; whole (`capital` - the Galleries' scroll: an echinus, two volutes, an abacus) or broken at a jagged top; its
 *  drums fallen beside it (`fall`). */
function column(kit, base, hgt, capital, fall, h) {
  const C = EG_COLONNADE, [bx, by, bz] = base, r = C.r, n = C.flutes * 2;
  kit.box(R.moulding, [bx - 0.5, by, bz - 0.5], [bx + 0.5, by + 0.16, bz + 0.5], { skip: ['bottom'] });
  kit.lathe(R.moulding, [[0.47, 0.16], [0.47, 0.24], [0.43, 0.3], [r + 0.02, 0.34]], 12, { centre: [bx, by, bz] });
  const ring = Array.from({ length: n }, (_, k) => { const a = (k / n) * TAU; return [bx + Math.cos(a) * r, bz + Math.sin(a) * r]; });
  const y0 = by + 0.34, y1 = by + hgt, around = EG_KIT_MAP[EG_KIT_RECORD.shaft].around[0];
  if (capital) {
    shaftSides(kit, ring, [bx, bz], y0, ring.map(() => y1), around);
    kit.lathe(R.moulding, [[r, 0], [r + 0.1, 0.14], [r + 0.12, 0.2]], 12, { centre: [bx, y1, bz] });
    kit.box(R.moulding, [bx - 0.52, y1 + 0.2, bz - 0.52], [bx + 0.52, y1 + 0.34, bz + 0.52]);
    for (const sz of [-1, 1]) {   // the volutes: two scrolls under the abacus's front and back edges
      const ring = Array.from({ length: 8 }, (_, k) => [Math.cos((k / 8) * TAU) * 0.13, Math.sin((k / 8) * TAU) * 0.13]);
      kit.sweep(R.moulding, ring, [[bx - 0.5, y1 + 0.1, bz + sz * 0.42], [bx + 0.5, y1 + 0.1, bz + sz * 0.42]]);
      for (const sx of [-1, 1]) kit.prism(R.moulding, ring.map((p) => [bx + sx * 0.5, bz + sz * 0.42 + p[0]]), y1 + 0.1 - 0.001, y1 + 0.1, { top: false });
    }
    return;
  }
  // broken: its top a jagged break, the seed's
  const tops = ring.map((_, k) => y1 + (egGroundHash(h * 1e6, k) - 0.6) * 0.35);
  shaftSides(kit, ring, [bx, bz], y0, tops, around);
  for (let k = 0; k < n; k++) { const p = ring[k], q2 = ring[(k + 1) % n]; kit.tri(R.shaft, [p[0], tops[k], p[1]], [q2[0], tops[(k + 1) % n], q2[1]], [bx, y1 - 0.06, bz], UP, true, [(k / n) * around, tops[k] * S], [((k + 1) / n) * around, tops[(k + 1) % n] * S], [((k + 0.5) / n) * around, (y1 - 0.25) * S]); }
  if (fall) {   // its drums, toppled along the stylobate beside it
    const { s, z, spec, cx, yS, q } = fall;
    let at = z + 0.7;
    for (let k = 0; k < 3 && at + 1.0 < q.z1; k++) {
      const len = 0.75 + 0.3 * egGroundHash(h * 1e5, k), yaw = (egGroundHash(k, h * 1e4) - 0.5) * 0.5, x0 = cx + s * 0.08 * k, p0 = DG(spec, x0 - Math.sin(yaw) * len / 2, yS + r - 0.02, at), p1 = DG(spec, x0 + Math.sin(yaw) * len / 2, yS + r - 0.02, at + Math.cos(yaw) * len);
      drum(kit, p0, p1, r - 0.02, 12, around);
      for (const [pp, dir] of /** @type {Array<[number[], number]>} */ ([[p0, -1], [p1, 1]])) {
        const ax = [(p1[0] - p0[0]) * dir, 0, (p1[2] - p0[2]) * dir];
        for (let i = 1; i + 1 < 12; i++) {
          const corner = (j) => { const a = (j / 12) * TAU, sx = Math.cos(yaw), sz = -Math.sin(yaw); return [pp[0] + sx * Math.cos(a) * (r - 0.02), pp[1] + Math.sin(a) * (r - 0.02), pp[2] + sz * Math.cos(a) * (r - 0.02)]; };
          kit.tri(R.shaft, corner(0), corner(i), corner(i + 1), ax, true);
        }
      }
      at += len + 0.15;
    }
  }
}
/**
 * THE OBLIVION CAVERNS' ROCK (the Caverns and the deep): the passage's walls and vault as one cave of the band's stone - its
 * section the walls' planes and a round vault over the collider's ceiling, every point pushed OUT by noise (never in: the
 * collider's proxy is the inner envelope), flush at its foot where the floor meets it (a body's fire-lit channel runs along
 * it); open at each niche's mouth (its own walls line it); a shell behind it the void sees, its mouths' rings. A slice of 3 m
 * a piece.
 */
/** The root's bed of the band's own deep stone (world/eliteGates/egBandArt.js rootArt's strata: rows 70 to 100 of 128) - the rock's
 *  and the trunks' picture. */
const ROCK_BED = Object.freeze([70 / 128, 100 / 128]);
export const EG_ROCK = Object.freeze({ cell: 1.4, row: 1.0, amp: 0.6, flush: 0.45, shell: 0.9, back: 0.35 });
function cavernRock(spec, q, runs, cuts, yFoot, yTop, piece) {
  const K = EG_ROCK, w = q.halfW, seed = (spec.seed ?? 0) ^ ((spec.h ?? 0) * 977);
  // the section: [x, y, nx, ny] from the left foot up the wall, over the vault, down the right wall
  // the walls' rows: even, and at every floor's height, the flush band's top and each niche's floor and lid
  const rows = Math.max(2, Math.ceil((yTop - yFoot) / K.row)), hs = new Set(Array.from({ length: rows + 1 }, (_, i) => yFoot + ((yTop - yFoot) * i) / rows));
  for (const y of [q.y, q.yB ?? q.y]) { hs.add(y); hs.add(y + K.flush); }
  for (const c of cuts.flat()) { hs.add(c[2]); hs.add(c[3]); }
  const ys = [...hs].map((y) => Math.round(y * 1e4) / 1e4).filter((y) => y >= yFoot - 1e-6 && y <= yTop + 1e-6).sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1] > 0.05);
  const sec = [];
  for (const y of ys) sec.push([-w, y, -1, 0]);
  for (let i = 1; i < 10; i++) { const a = Math.PI * (1 - i / 10); sec.push([Math.cos(a) * w, yTop + Math.sin(a) * w, Math.cos(a), Math.sin(a)]); }
  for (const y of [...ys].reverse()) sec.push([w, y, 1, 0]);
  const L = q.z1 - q.z0, cols = Math.max(2, Math.round(L / K.cell));
  const zs = Array.from({ length: cols + 1 }, (_, k) => q.z0 + (L * k) / cols);
  // the niches' mouths: rows and columns at their edges, their cells left open
  const extraZ = cuts.flat().flatMap((c) => [c[0], c[1]]);
  const Z = [...new Set([...zs, ...extraZ].map((z) => Math.round(z * 1e4) / 1e4))].sort((a, b) => a - b);
  const noise = (a, b, c) => {
    const f = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), hh = (i, j) => egGroundHash(seed, s, xi + i, yi + j);
      return (hh(0, 0) * (1 - sx) + hh(1, 0) * sx) * (1 - sy) + (hh(0, 1) * (1 - sx) + hh(1, 1) * sx) * sy; };
    return 0.65 * f(a / 2.2, b / 2.2, c) + 0.35 * f(a / 0.9, b / 0.9, c + 7);
  };
  const floorY = (z) => egPassageFloorAt(q, z), inChasm = (z) => q.zA != null && q.zB != null && z > q.zA + 0.3 && z < q.zB - 0.3;
  const cut = (side, z0, z1, y0, y1) => (cuts[side < 0 ? 0 : 1] ?? []).some((c) => z0 >= c[0] - 1e-6 && z1 <= c[1] + 1e-6 && y0 >= c[2] - 1e-6 && y1 <= c[3] + 1e-6);
  const onEdge = (side, z, y) => (cuts[side < 0 ? 0 : 1] ?? []).some((c) => z >= c[0] - 1e-6 && z <= c[1] + 1e-6 && y >= c[2] - 1e-6 && y <= c[3] + 1e-6);
  const pushOut = (p, z, i) => {
    const wallSide = p[3] === 0 ? Math.sign(p[0]) : 0, fy = floorY(z);
    let d = K.amp * noise(z * 1.0 + i * 0.37, p[1] + (wallSide > 0 ? 100 : 0), 3);
    if (wallSide && !inChasm(z) && p[1] <= fy + K.flush) d = 0;   // flush where the floor meets it, and under it
    if (wallSide && onEdge(wallSide, z, p[1])) d = 0;   // and round a niche's mouth
    if (Math.abs(z - q.z0) < 1e-6 || Math.abs(z - q.z1) < 1e-6) d *= 0.4;
    return [p[0] + p[2] * d, p[1] + p[3] * d];
  };
  const inner = Z.map((z) => sec.map((p, i) => pushOut(p, z, i)));
  // THE SHELL the void sees: coarse - each wall one face from its foot to its top, the vault in four - its corners pushed out
  // by the noise but at its feet
  const shA = [Math.PI, (3 * Math.PI) / 4, Math.PI / 2, Math.PI / 4, 0], sh = w + K.shell;
  const shell = (z) => [[-sh, yFoot], ...shA.map((a, i) => { const e = K.back * noise(z, i * 3.1, 11); return [Math.cos(a) * (sh + e), yTop + Math.sin(a) * (sh + e)]; }), [sh, yFoot]];
  /** a section point's place on the shell at z: on its wall at its height, or on the vault's chord at its bearing */
  const onShell = (z, p) => {
    const s = shell(z);
    if (p[3] === 0) { const top = p[0] < 0 ? s[1] : s[5]; return [top[0], p[1]]; }
    const a = Math.atan2(p[1] - yTop, p[0]), j = Math.min(3, Math.floor((Math.PI - a) / (Math.PI / 4))), f = (Math.PI - a) / (Math.PI / 4) - j;
    return [s[1 + j][0] + (s[2 + j][0] - s[1 + j][0]) * f, s[1 + j][1] + (s[2 + j][1] - s[1 + j][1]) * f];
  };
  const P = (xy, z) => DG(spec, q.x + xy[0], xy[1], z);
  const slice = (k0, k1) => piece((kit) => {
    for (let k = k0; k < k1; k++) {
      const za = Z[k], zb = Z[k + 1];
      for (let i = 0; i + 1 < sec.length; i++) {
        const side = sec[i][3] === 0 && sec[i + 1][3] === 0 ? Math.sign(sec[i][0]) : 0;
        if (side && cut(side, za, zb, Math.min(sec[i][1], sec[i + 1][1]), Math.max(sec[i][1], sec[i + 1][1]))) continue;
        // the axis each face looks to: the section's middle at its height, or the vault's centre
        // its uv: along the passage, and each row of the section one bed of the band's deep stone (the root's strata)
        const up = sec[i + 1][1] >= sec[i][1], vi = up ? ROCK_BED[1] : ROCK_BED[0], vj = up ? ROCK_BED[0] : ROCK_BED[1];
        const ax = side ? [0, (sec[i][1] + sec[i + 1][1]) / 2] : [0, yTop], uv = [[za * S, vi], [zb * S, vi], [zb * S, vj], [za * S, vj]];
        const a = inner[k][i], b = inner[k + 1][i], c = inner[k + 1][i + 1], d = inner[k][i + 1], cm = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        kit.quad(R.root, P(a, za), P(b, zb), P(c, zb), P(d, za), P([2 * cm[0] - ax[0], 2 * cm[1] - ax[1]], (za + zb) / 2), false, uv);
      }
      // the foot: the rock's underside, wall to shell
      for (const i of [0, sec.length - 1]) { const o = [Math.sign(sec[i][0]) * sh, yFoot]; kit.quad(R.root, P(inner[k][i], za), P(o, za), P(o, zb), P(inner[k + 1][i], zb), DOWN, true); }
    }
    // the shell over the slice: its walls (round a niche's mouth) and its vault
    const z0 = Z[k0], z1 = Z[k1], s0 = shell(z0), s1 = shell(z1);
    for (let i = 0; i + 1 < s0.length; i++) {
      const wallSide = i === 0 ? -1 : i === s0.length - 2 ? 1 : 0, ax = [0, wallSide ? (s0[i][1] + s0[i + 1][1]) / 2 : yTop];
      const cutsHere = wallSide ? (cuts[wallSide < 0 ? 0 : 1] ?? []).filter((g) => g[1] > z0 + 1e-6 && g[0] < z1 - 1e-6) : [];
      if (!cutsHere.length) { kit.quad(R.root, P(s0[i], z0), P(s1[i], z1), P(s1[i + 1], z1), P(s0[i + 1], z0), P(ax, (z0 + z1) / 2), false, [[z0 * S, ROCK_BED[0]], [z1 * S, ROCK_BED[0]], [z1 * S, ROCK_BED[1]], [z0 * S, ROCK_BED[1]]]); continue; }
      const x = wallSide * sh, rect = (za, zb, ya, yb) => { if (zb - za > 1e-6 && yb - ya > 1e-6) kit.quad(R.root, P([x, ya], za), P([x, ya], zb), P([x, yb], zb), P([x, yb], za), [wallSide, 0, 0], true, [[za * S, ROCK_BED[1]], [zb * S, ROCK_BED[1]], [zb * S, ROCK_BED[0]], [za * S, ROCK_BED[0]]]); };
      const g = cutsHere[0], c0 = Math.max(z0, g[0]), c1 = Math.min(z1, g[1]);
      rect(z0, z1, yFoot, g[2]); rect(z0, z1, g[3], yTop); rect(z0, c0, g[2], g[3]); rect(c1, z1, g[2], g[3]);
    }
    // the mouths: the rock's thickness, inner to shell
    for (const k of [k0, k1].filter((kk) => kk === 0 || kk === Z.length - 1)) {
      const z = Z[k], dir = k === 0 ? [0, 0, -1] : [0, 0, 1];
      for (let i = 0; i + 1 < sec.length; i++) kit.quad(R.root, P(inner[k][i], z), P(inner[k][i + 1], z), P(onShell(z, sec[i + 1]), z), P(onShell(z, sec[i]), z), dir, true);
    }
  });
  void runs;
  let k0 = 0;
  for (let k = 1; k < Z.length; k++) if (Z[k] - Z[k0] >= 2.9 || k === Z.length - 1) { slice(k0, k); k0 = k; }
}
/** THE GLOAM THICKET's TRUNKS: black glass rising past the edge of sight outside each wall, at its pitch, their feet in the
 *  dark under the walls and their crowns far over the open passage, each leaning its own way. */
export const EG_THICKET = Object.freeze({ pitch: 2.5, out: 1.25, r: 0.42, under: 4, over: 9 });
function thicket(spec, q, yFoot, yTop, piece) {
  const T = EG_THICKET;
  for (const s of [-1, 1]) for (let z = q.z0 + T.pitch / 2; z < q.z1; z += T.pitch) {
    const h = egGroundHash(spec.seed ?? 0, spec.h ?? 0, Math.round(z * 10), s * 3), x = q.x + s * (q.halfW + EG_WALL.thick + T.out * (0.6 + 0.6 * h));
    const top = yTop + T.over * (0.6 + 0.8 * egGroundHash(h * 1e6, 2)), lean = (egGroundHash(h * 1e6, 3) - 0.5) * 2.4, r0 = T.r * (0.75 + 0.5 * h);
    const path = [0, 0.35, 0.7, 1].map((u) => DG(spec, x + s * lean * u * u, yFoot - T.under + (top - yFoot + T.under) * u, z + lean * 0.3 * u * u));
    piece((kit) => trunk(kit, R.root, path, [r0, r0 * 0.78, r0 * 0.5, r0 * 0.18], 6));
  }
}

// ── THE CHAMBERS ──────────────────────────────────────────────────────────────────────────────────────────────────
/** THE ARCADE (m, a bay's frame): its piers' width at the plane, its thickness out from the collider's ring, the base course
 *  under the openings, the spandrels' setback, the entablature's and the parapet's heights at the top, the parapet's
 *  thickness, the piers' feet under the base. The ring's sides (32 - the collider's own) are its bays. */
export const EG_ARCADE = Object.freeze({ sides: 32, pier: 0.6, thick: 1.0, base: 0.6, setback: 0.1, blind: 0.18, ent: 0.6, parapet: 1.0, pThick: 0.5, foot: 1.8, m: 6 });
/** A frame along a side of a ring (egWallFrame's) stretched as it goes out so its two ends lie on the ring's radii - a bay's
 *  faces meet its neighbour's in a mitre (`mA`, `mB` 1 where a neighbour stands, 0 at a gap's flat end). */
function mitred(W, half, mA, mB) {
  const k = Math.tan(half);
  return { ...W, at: (d, y, t) => W.at(d, y, t + d * k * ((t / W.L) * mB - (1 - t / W.L) * mA)) };
}
/** Whether the ring's side k of n is one of its two gaps (the course in at -z, on at +z - world/eliteGates/egHall.js's ring wall). */
const ringGapSide = (k, n) => Math.abs(Math.sin(((k + 0.5) / n) * TAU)) < 0.2;
/** EG-PERFECT (spec law 10): what stands of chamber ring `d`'s side k of n - none at its gaps, the wall beside an alcove's doorway
 *  (net/eliteGates/egWalkGraph.js egRingSideWalls, every reader's one law). */
const ringWalls = (spec, d, k, n) => egRingSideWalls(spec, d, k, n);
/**
 * A CHAMBER'S RING WALL AS THE ACADEMY'S ARCADE (Elite-Gates-Look.md section 2): deco `d` (a `wall` ring) of hall `spec`, each
 * of the collider's 32 sides a bay out from its plane - its piers, an open arch of the band's style between them (its
 * archivolt and keystone, its soffit through the wall), the spandrels set back, an entablature and a parapet to the ring's
 * top, a base course under the openings and the piers' feet under it; open where the course comes in and goes on, the
 * gaps' sides closed. Each bay a piece.
 */
export function egRingArcade(spec, d, band, piece) {
  const A = EG_ARCADE, n = A.sides, y = d.y ?? 0, h = d.h, style = egKitStyle(band).arch, D = A.thick;
  const yb = y - A.base, yE = y + h - A.parapet - A.ent, yP = yE + A.ent, yT = y + h;
  for (let k = 0; k < n; k++) {
    const walls = ringWalls(spec, d, k, n);
    if (!walls.length) continue;
    const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, mid = (a0 + a1) / 2;
    const W0 = egWallFrame(spec, d.x + Math.sin(a0) * d.r, d.z + Math.cos(a0) * d.r, d.x + Math.sin(a1) * d.r, d.z + Math.cos(a1) * d.r, -Math.sin(mid), -Math.cos(mid));
    // mitred to a neighbour whose wall meets this side's end (THE AUDIT: a doorway's side meets it where its wall reaches the end)
    const gA = !ringWalls(spec, d, (k + n - 1) % n, n).some((w) => w[1] === 1), gB = !ringWalls(spec, d, (k + 1) % n, n).some((w) => w[0] === 0);
    const W = mitred(W0, Math.PI / n, gA ? 0 : 1, gB ? 0 : 1), L = W0.L, pw = A.pier;
    if (!(walls.length === 1 && walls[0][0] === 0 && walls[0][1] === 1)) {
      // THE AUDIT (spec law 10): AN ALCOVE'S DOORWAY through the ring (EG_RING_DOOR) - the wall beside it plain to the ring's top,
      // its jambs, a lintel over it (the whole side stood open: a gap 3.4-5.4 m wide and the arcade's height about a 2 m niche)
      const yD = Math.min(yE, y + EG_RING_DOOR.h), doors = [];
      let at = 0;
      for (const [s0, s1] of walls) { if (s0 > at) doors.push([at, s0]); at = s1; }
      if (at < 1) doors.push([at, 1]);
      piece((kit) => {
        for (const [s0, s1] of walls) {
          const ta = s0 * L, tb = s1 * L;
          rectTY(kit, W, R.wall, 0, ta, yb, tb, yT, W.IN);
          rectTY(kit, W, R.wall, D, ta, yb, tb, yT, W.OUT);
          rectDT(kit, W, R.wall, yT, 0, ta, D, tb, UP);
          rectDT(kit, W, R.wall, yb, 0, ta, D, tb, DOWN);
          if (s0 > 0) rectDY(kit, W, R.wall, ta, 0, yb, D, yD, W.BACK);
          if (s1 < 1) rectDY(kit, W, R.wall, tb, 0, yb, D, yD, W.ALONG);
        }
        for (const [s0, s1] of doors) {
          const ta = s0 * L, tb = s1 * L;
          rectTY(kit, W, R.wall, 0, ta, yD, tb, yT, W.IN);
          rectTY(kit, W, R.wall, D, ta, yD, tb, yT, W.OUT);
          rectDT(kit, W, R.wall, yT, 0, ta, D, tb, UP);
          rectDT(kit, W, R.wall, yD, 0, ta, D, tb, DOWN);
        }
      });
      continue;
    }
    const hw = (L - 2 * pw) / 2, crown = yE - 0.35, spring = Math.max(y + 1.5, crown - egGroundArchRise(style, hw)), hole = { tc: L / 2, hw, sill: y, spring, curve: egArchCurve(style, hw, 0, A.m) };
    const open = k % 2 === 0;   // the arcade's rhythm: an open arch, a blind bay, an open arch...
    piece((kit) => {
      // the entablature and the parapet over every bay, on the collider's ring; the ledge behind the parapet, its coping
      mouldTY(kit, W, 0, 0, yE, L, yP, W.IN, EG_MOULD_BAND.capital);
      rectTY(kit, W, R.wall, 0, 0, yP, L, yT, W.IN);
      mouldDT(kit, W, yT, 0, 0, A.pThick, L, UP, EG_MOULD_BAND.fillet);
      rectTY(kit, W, R.wall, A.pThick, 0, yP, L, yT, W.OUT);
      mouldDT(kit, W, yP, A.pThick, 0, D, L, UP, EG_MOULD_BAND.fillet);
      mouldTY(kit, W, D, 0, yE, L, yP, W.OUT, EG_MOULD_BAND.capital);
      rectDT(kit, W, R.wall, yb, 0, 0, D, L, DOWN);
      if (!open) {
        // a blind arch: its face on the plane cut by the arch, the panel sunk behind it, its jambs and soffit, its archivolt
        // (its face a hand back from the plane, the archivolt on the plane before it, the step closed at its ends)
        const blind = { ...hole, sill: y + 0.6 }, back = A.blind, fd = 0.04;
        holedFace(kit, W, R.wall, fd, 0, L, yb, yE, W.IN, blind);
        rectDY(kit, W, R.wall, 0, 0, yb, fd, yE, W.ALONG);
        rectDY(kit, W, R.wall, L, 0, yb, fd, yE, W.BACK);
        reveal(kit, W, R.wall, fd, back, blind);
        rectTY(kit, W, R.wall, back, L / 2 - hw, blind.sill, L / 2 + hw, spring, W.IN);
        for (let i = 0; i + 1 < blind.curve.length; i++) { const p = blind.curve[i], q = blind.curve[i + 1]; kit.tri(R.wall, W.at(back, spring, L / 2), W.at(back, spring + p[1], L / 2 + p[0]), W.at(back, spring + q[1], L / 2 + q[0]), W.IN, true, [L / 4, spring * S], [(L / 2 + p[0]) * S, (spring + p[1]) * S], [(L / 2 + q[0]) * S, (spring + q[1]) * S]); }
        voussoirRing(kit, W, 0, 0, L / 2, hw, spring, style, 0, 0.32, A.m, W.IN);
        rectTY(kit, W, R.wall, D, 0, yb, L, yE, W.OUT);
      }
      else {
        // the base course and the piers on the plane; the spandrels set back between them, the piers' sides beside them
        for (const [ta, tb] of [[0, pw], [pw, L - pw], [L - pw, L]]) rectTY(kit, W, R.wall, 0, ta, yb, tb, y, W.IN);
        for (const [ta, tb] of [[0, pw], [L - pw, L]]) rectTY(kit, W, R.wall, 0, ta, y, tb, yE, W.IN);
        holedFace(kit, W, R.wall, A.setback, pw, L - pw, spring, yE, W.IN, { ...hole, sill: spring });
        rectDY(kit, W, R.wall, pw, 0, spring, A.setback, yE, W.ALONG);
        rectDY(kit, W, R.wall, L - pw, 0, spring, A.setback, yE, W.BACK);
        // the archivolt and its keystone; the opening through the wall (its jambs the piers' sides, its sill the base
        // course's top, its soffit); the outer face; the piers' feet under the base
        voussoirRing(kit, W, 0.03, 0.03, L / 2, hw, spring, style, 0, 0.32, A.m, W.IN);
        const top = spring + egGroundArchRise(style, hw);
        wbox(kit, W, R.voussoir, 0, A.setback, top - 0.05, Math.min(yE, top + 0.5), L / 2 - 0.18, L / 2 + 0.18, ['in', 'back', 'along']);
        reveal(kit, W, R.wall, 0, D, hole);
        holedFace(kit, W, R.wall, D, 0, L, yb, yE, W.OUT, hole);
        for (const [ta, tb] of [[0.08, pw - 0.04], [L - pw + 0.04, L - 0.08]]) wbox(kit, W0, R.wall, 0.12, D - 0.12, yb - A.foot, yb, ta, tb, ['in', 'out', 'bottom', 'back', 'along']);
      }
      // a gap's side: the wall's end, closed
      if (gA) { rectDY(kit, W, R.wall, 0, 0, yb, D, yE, W.BACK); mouldDY(kit, W, 0, 0, yE, D, yP, W.BACK, EG_MOULD_BAND.capital); rectDY(kit, W, R.wall, 0, 0, yP, A.pThick, yT, W.BACK); }
      if (gB) { rectDY(kit, W, R.wall, L, 0, yb, D, yE, W.ALONG); mouldDY(kit, W, L, 0, yE, D, yP, W.ALONG, EG_MOULD_BAND.capital); rectDY(kit, W, R.wall, L, 0, yP, A.pThick, yT, W.ALONG); }
    });
  }
}
/** THE PIT'S TIERS (deco `tiers`): its ring wall a podium flush with the old ring and, stepping up and out from it, three
 *  benches of stone - each a riser and a seat - to a back wall; open where the course comes in and goes on. Each side of
 *  the ring a piece. */
export function egTierBenches(spec, d, piece) {
  const n = 32, y0 = (d.y ?? 0) - 0.5, step = d.h / 6, deep = 1.2, foot = 1.6;
  for (let k = 0; k < n; k++) {
    if (ringGapSide(k, n)) continue;
    const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, mid = (a0 + a1) / 2;
    const P = (r, a, yy) => DG(spec, d.x + Math.sin(a) * r, yy, d.z + Math.cos(a) * r), inW = [-Math.sin(mid), 0, -Math.cos(mid)];
    const riser = (kit, rec, r, ya, yb, out) => { const arc = r * (a1 - a0); kit.quad(rec, P(r, a0, ya), P(r, a1, ya), P(r, a1, yb), P(r, a0, yb), out, true, [[0, -ya * S], [arc * S, -ya * S], [arc * S, -yb * S], [0, -yb * S]]); };
    const tread = (kit, rec, ra, rb, yy, out) => kit.quad(rec, P(ra, a0, yy), P(ra, a1, yy), P(rb, a1, yy), P(rb, a0, yy), out, true, [[0, 0], [ra * (a1 - a0) * S, 0], [rb * (a1 - a0) * S, (rb - ra) * S], [0, (rb - ra) * S]]);
    piece((kit) => {
      riser(kit, R.wall, d.r, y0 - foot, y0 + step, inW);   // the podium, flush with the old ring
      for (let s = 1; s <= 3; s++) {
        const r0 = d.r + (s - 1) * deep, r1 = d.r + s * deep, yy = y0 + s * step;
        if (s > 1) riser(kit, R.wall, r0, y0 + (s - 1) * step, yy, inW);
        tread(kit, R.moulding, r0, r0 + 0.12, yy, UP);   // the seat's nosing, then the seat
        tread(kit, R.wall, r0 + 0.12, r1, yy, UP);
      }
      riser(kit, R.wall, d.r + 3 * deep, y0 - foot, y0 + 3 * step, inW.map((v) => -v));
      tread(kit, R.wall, d.r, d.r + 3 * deep, y0 - foot, DOWN);
      for (const [a, g, dir] of /** @type {Array<[number, boolean, number]>} */ ([[a0, ringGapSide((k + n - 1) % n, n), -1], [a1, ringGapSide((k + 1) % n, n), 1]])) {
        if (!g) continue;   // a gap's side: the benches' end, stepped
        const tang = [Math.cos(a) * dir, 0, -Math.sin(a) * dir];
        for (let s = 0; s <= 3; s++) {
          const ra = s === 0 ? d.r : d.r + (s - 1) * deep, rb = d.r + 3 * deep, ya = y0 - foot, yb2 = y0 + Math.max(1, s) * step;
          if (s === 0) continue;
          kit.quad(R.wall, P(ra, a, s === 1 ? ya : y0 + (s - 1) * step), P(rb, a, s === 1 ? ya : y0 + (s - 1) * step), P(rb, a, yb2), P(ra, a, yb2), tang, true);
        }
      }
    });
  }
}
/**
 * A CHAMBER'S LONG WALLS (deco `hall` - the Forge Gut's long chamber): each the academy's wall out from its plane, from
 * under the floor to the law's top, its windows in two storeys where it stands tall, a coping over it (no ceiling of the law
 * stands there, so nothing reaches in).
 */
export function egLongWalls(spec, d, band, piece) {
  const y = d.y ?? 0, yTop = y + d.h, style = egKitStyle(band).arch, grid = egPassageGrid({ z0: d.z0, z1: d.z1 }, EG_WALL.pitch * 4 / 3);
  for (const s of [-1, 1]) {
    const W = egWallFrame(spec, d.x + s * d.hw, 0, d.x + s * d.hw, 1, -s, 0);
    academyWall(W, { t0: d.z0, t1: d.z1, yFoot: y - 1.6, ybAt: () => y, yTop, style, pil: egPilasters(d.z0, d.z1, grid), vault: false, crown: 'coping', ends: [[y - 1.6, yTop], [y - 1.6, yTop]] }, piece);
  }
}
/**
 * A CHOKEPOINT'S ARCH (deco `arch` - section 11.4, a wall across the chamber with a gap 6 m wide): its two arms the boxes the
 * collider holds, dressed IN them (pilaster strips on their faces, the bays between sunk into the wall, a coping flush with
 * its top), and over the gap a round arch of voussoirs springing from the lintel's underside (the collider's), its
 * spandrels and an attic over it - everything over the gap above the law's lintel line.
 */
export function egChokeArch(spec, d, band, boxes, piece) {
  const y = d.y ?? 0, top = y + d.h, half = d.w / 2;
  void band;
  for (const s of [-1, 1]) {
    // an arm: x from the gap's side out past the ring, z either side of d.z
    const xa = d.x + s * half, xb = d.x + s * (d.r + 1), x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    for (const f of [-1, 1]) {
      const W = egWallFrame(spec, x0, d.z + f * 0.4, x1, d.z + f * 0.4, 0, f), L = x1 - x0;   // its face looks out of the wall (f), d runs into it
      piece((kit) => {
        const n = Math.max(1, Math.round(L / 3)), step = L / n;
        for (let i = 0; i <= n; i++) { const t0 = Math.max(0, i * step - 0.3), t1 = Math.min(L, i * step + 0.3); rectTY(kit, W, R.wall, 0, t0, y - 0.5, t1, top, W.IN); }
        for (let i = 0; i < n; i++) {
          const ta = i * step + 0.3, tb = (i + 1) * step - 0.3;
          rectTY(kit, W, R.wall, 0, ta, y - 0.5, tb, y + 0.5, W.IN);
          rectTY(kit, W, R.wall, 0, ta, top - 0.6, tb, top, W.IN);
          rectTY(kit, W, R.wall, 0.12, ta, y + 0.5, tb, top - 0.6, W.IN);
          rectDY(kit, W, R.wall, ta, 0, y + 0.5, 0.12, top - 0.6, W.ALONG);
          rectDY(kit, W, R.wall, tb, 0, y + 0.5, 0.12, top - 0.6, W.BACK);
          mouldDT(kit, W, y + 0.5, 0, ta, 0.12, tb, UP, EG_MOULD_BAND.fillet);
          mouldDT(kit, W, top - 0.6, 0, ta, 0.12, tb, DOWN, EG_MOULD_BAND.fillet);
        }
        mouldDT(kit, W, top, 0, 0, 0.4, L, UP, EG_MOULD_BAND.fillet);
      });
    }
    // the arm's ends: at the gap (its jamb) and out over the void
    const Wend = egWallFrame(spec, xa, d.z - 0.4, xa, d.z + 0.4, -s, 0), Wout = egWallFrame(spec, xb, d.z - 0.4, xb, d.z + 0.4, s, 0);
    piece((kit) => { rectTY(kit, Wend, R.wall, 0, 0, y - 0.5, 0.8, top, Wend.IN); rectTY(kit, Wout, R.wall, 0, 0, y - 0.5, 0.8, top, Wout.IN); rectDT(kit, Wend, R.wall, y - 0.5, 0, 0, Math.abs(xb - xa), 0.8, DOWN); });
  }
  // the arch over the gap: springing at the lintel's underside, its ring, its spandrels and attic, both faces in the arms' planes
  const sp = top - 1, ring = 0.7, ext = egArchCurve('round', half, ring, 8), crown = sp + half + ring, attic = crown + 0.6;
  piece((kit) => {
    for (const f of [-1, 1]) {
      const W = egWallFrame(spec, d.x - half - ring, d.z + f * 0.4, d.x + half + ring, d.z + f * 0.4, 0, f), tc = half + ring;
      voussoirRing(kit, W, 0, 0, tc, half, sp, 'round', 0, ring, 8, W.IN);
      holedFace(kit, W, R.wall, 0, 0, 2 * tc, sp, attic, W.IN, { tc, hw: half + ring, sill: sp, spring: sp, curve: ext });
      mouldTY(kit, W, 0, -0.2, attic, 2 * tc + 0.2, attic + 0.4, W.IN, EG_MOULD_BAND.capital);
      wbox(kit, W, R.voussoir, -0.08, 0, crown - ring - 0.05, crown + 0.25, tc - 0.22, tc + 0.22, ['in', 'top', 'back', 'along']);
    }
    const Wm = egWallFrame(spec, d.x - half - ring, d.z - 0.4, d.x + half + ring, d.z - 0.4, 0, 1);
    reveal(kit, Wm, R.voussoir, -0.8, 0, { tc: half + ring, hw: half, sill: sp, spring: sp, curve: egArchCurve('round', half, 0, 8) }, false);
    mouldDT(kit, Wm, attic + 0.4, -0.8, -0.2, 0, 2 * (half + ring) + 0.2, UP, EG_MOULD_BAND.fillet);
  });
  void boxes;
}

// ── THE DOOR ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE DOORWAY (m, the end plate's frame - world/eliteGates/egHall.js EG_DOOR's posts): each post's plinth, base, shaft (a hand in
 *  from the post's box) and capital, every face inside the box the collider holds; the arch's ring springing from the
 *  capitals (its intrados the posts' inner faces, its back their outer), its keystone, the entablature and the pediment
 *  over it. */
export const EG_DOORWAY = Object.freeze({ plinth: 0.55, base: 0.15, inset: 0.05, cap: 0.4, key: 0.34, ent: 0.55, ped: 0.75 });
/** The band's sigil on a keystone's face: its outline as a polygon about the face's centre, `r` across (EG_GROUND_SIGILS's shapes
 *  drawn small) - [[u, v], ...] in the face's plane. */
function sigilOutline(sigil, r) {
  const out = [];
  if (sigil === 'gem') for (let k = 0; k < 8; k++) out.push(polar(r, Math.PI / 2 + (k * TAU) / 8));
  else if (sigil === 'crescent') {
    const rc = r, off = 0.4 * r, rb = 0.82 * r;
    for (let k = 0; k <= 12; k++) { const a = -Math.PI / 4 - (k / 12) * 1.5 * Math.PI; out.push(polar(rc, a + Math.PI)); }
    for (let k = 11; k >= 1; k--) { const a = -Math.PI / 4 - (k / 12) * 1.5 * Math.PI + Math.PI, u = [Math.cos(a), Math.sin(a)], ub = u[1] * off, t2 = ub + Math.sqrt(Math.max(0, ub * ub - off * off + rb * rb)); out.push([u[0] * Math.min(t2, rc), u[1] * Math.min(t2, rc)]); }
  } else {
    const m = sigil === 'dagon' ? 6 : 8;
    for (let k = 0; k < 2 * m; k++) { const a = Math.PI / 2 + (k * Math.PI) / m, rr = k % 2 ? 0.38 * r : (sigil === 'dagon' && (k / 2) % 2 ? 0.6 : 1) * r; out.push(polar(rr, a)); }
  }
  return out;
}
/**
 * THE END PLATE'S DOOR (Elite-Gates-Look.md section 2): disc `d` of hall `spec` (its door across its middle - EG_DOOR's posts
 * `post` square, `halfW` from it, `h` tall), `band` its sigil: two pilasters on plinths, each inside its post's box; a round
 * arch of voussoirs from the capitals with a keystone carrying the band's sigil in the metal; an entablature and a low
 * pediment. The door's gold beam stands inside it (world/eliteGates/egLights.js). The posts each a piece, the arch and what stands on
 * it a piece.
 */
export function egDoorway(spec, d, door, band, piece) {
  const O = EG_DOORWAY, y = d.y, hp = door.post / 2, P = (x, yy, z) => DG(spec, d.x + x, yy, d.z + z), yc = y + door.h;
  for (const s of [-1, 1]) piece((kit) => {
    const cx = s * door.halfW, box = (rec, w, y0, y1, skip = []) => kit.box(rec, P(cx - w, y0, -w), P(cx + w, y1, w), { skip });
    box(R.moulding, hp, y, y + O.plinth, ['bottom']);
    box(R.moulding, hp - 0.02, y + O.plinth, y + O.plinth + O.base, ['bottom', 'top']);
    rectDT0(kit, P, cx, hp, hp - 0.02, y + O.plinth);
    box(R.shaft, hp - O.inset, y + O.plinth + O.base, yc - O.cap, ['bottom', 'top']);   // the shaft, a hand in, fluted
    box(R.moulding, hp, yc - O.cap, yc, []);
  });
  // the arch: its intrados the posts' inner faces, its back their outer, both its faces the posts' own planes
  const style = egKitStyle(band), ri = door.halfW - hp, ro = door.halfW + hp, crown = yc + ro, ent = crown + 0.1;
  piece((kit) => {
    for (const f of [-1, 1]) {
      const W = egWallFrame(spec, d.x - ro, d.z + f * hp, d.x + ro, d.z + f * hp, 0, f);
      voussoirRing(kit, W, 0, 0, ro, ri, yc, 'round', 0, ro - ri, 6, W.IN);
      holedFace(kit, W, R.wall, 0, 0, 2 * ro, yc, ent, W.IN, { tc: ro, hw: ro, sill: yc, spring: yc, curve: egArchCurve('round', ro, 0, 6) });
      // the keystone, standing proud of the ring, its face carrying the band's sigil
      wbox(kit, W, R.voussoir, -0.07, 0, yc + ri - 0.06, crown + 0.22, ro - O.key / 2, ro + O.key / 2, ['in', 'back', 'along']);   // the keystone
      const sc = [ro, (yc + ri - 0.06 + crown + 0.22) / 2], outline = sigilOutline(style.sigil, 0.13);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        kit.tri(R.metal, W.at(-0.085, sc[1], sc[0]), W.at(-0.085, sc[1] + a[1], sc[0] + a[0]), W.at(-0.085, sc[1] + b[1], sc[0] + b[0]), W.IN, true);
      }
    }
    const Wm = egWallFrame(spec, d.x - ro, d.z - hp, d.x + ro, d.z - hp, 0, 1);
    reveal(kit, Wm, R.voussoir, -2 * hp, 0, { tc: ro, hw: ri, sill: yc, spring: yc, curve: egArchCurve('round', ri, 0, 6) }, false);
    // the entablature over it, and its pediment
    const e0 = P(-ro - 0.25, ent, -hp - 0.08), e1 = P(ro + 0.25, ent + O.ent, hp + 0.08);
    kit.box(R.moulding, e0, e1, {});
    const pk = ent + O.ent + O.ped, L = ro + 0.25;
    for (const f of [-1, 1]) kit.tri(R.wall, P(-L, ent + O.ent, f * (hp + 0.02)), P(L, ent + O.ent, f * (hp + 0.02)), P(0, pk, f * (hp + 0.02)), [0, 0, f], true);
    for (const sx of [-1, 1]) kit.quad(R.moulding, P(sx * (L + 0.06), ent + O.ent - 0.02, -hp - 0.1), P(0, pk + 0.06, -hp - 0.1), P(0, pk + 0.06, hp + 0.1), P(sx * (L + 0.06), ent + O.ent - 0.02, hp + 0.1), [sx, 1.4, 0], true);
  });
}
/** The ledge a post's base leaves on its plinth (a strip round it, facing up). */
function rectDT0(kit, P, cx, w0, w1, yy) {
  for (const [a, b, c, e] of [[[-w0, -w0], [w0, -w0], [w1, -w1], [-w1, -w1]], [[w0, -w0], [w0, w0], [w1, w1], [w1, -w1]], [[w0, w0], [-w0, w0], [-w1, w1], [w1, w1]], [[-w0, w0], [-w0, -w0], [-w1, -w1], [-w1, w1]]]) kit.quad(R.moulding, P(cx + a[0], yy, a[1]), P(cx + b[0], yy, b[1]), P(cx + c[0], yy, c[1]), P(cx + e[0], yy, e[1]), UP, true);
}

// ── THE VIGNETTES ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A VIGNETTE's box (m, about its place - the collider's: world/eliteGates/egHall.js egCircleColliderTris): its half-width across,
 *  its half-length along, its height. Everything drawn stands inside it. */
export const EG_VIGNETTE_BOX = Object.freeze({ x: 0.4, z: 1.0, h: 1.4 });
/**
 * A VIGNETTE (section 11.10 - the lore the halls tell), at its footprint (`v` - x, y, z, its kind `t`), inside its collider's
 * box: a barricade of lecterns (two standing, one thrown on its side, a plank across); a rack of broken staves; the Kyn's
 * shrine (a stepped basalt altar, iron horns, a bowl of the band's fire); a fallen shelf, its books spilled; a weapon rack.
 */
export function egVignette(kit, spec, v) {
  const B = EG_VIGNETTE_BOX, P = (x, yy, z) => DG(spec, v.x + x, v.y + yy, v.z + z);
  const box = (rec, x0, y0, z0, x1, y1, z1, skip = ['bottom']) => kit.box(rec, P(x0, y0, z0), P(x1, y1, z1), { skip });
  const rod = (rec, a, b, r, sides = 6) => kit.sweep(rec, Array.from({ length: sides }, (_, k) => [Math.cos((k / sides) * TAU) * r, Math.sin((k / sides) * TAU) * r]), [P(a[0], a[1], a[2]), P(b[0], b[1], b[2])]);
  const lectern = (z, lean) => {
    box(R.metal, -0.2, 0, z - 0.16, 0.2, 0.08, z + 0.16);
    box(R.wall, -0.06, 0.08, z - 0.06, 0.06, 0.95, z + 0.06);
    const yy = 0.95, w = 0.24, dz = 0.2;
    kit.quad(R.metal, P(-w, yy, z - dz), P(w, yy, z - dz), P(w, yy + 0.22 + lean, z + dz), P(-w, yy + 0.22 + lean, z + dz), [0, 1, -0.4], true);
    kit.quad(R.metal, P(-w, yy - 0.04, z - dz), P(w, yy - 0.04, z - dz), P(w, yy + 0.18 + lean, z + dz), P(-w, yy + 0.18 + lean, z + dz), [0, -1, 0.4], true);
  };
  if (v.t === 'barricade') {
    lectern(-0.6, 0); lectern(0.15, 0.04);
    // one thrown on its side, its desk against the others; a plank laid across them
    box(R.metal, -0.3, 0, 0.55, 0.3, 0.22, 0.95);
    box(R.wall, -0.36, 0.05, 0.62, 0.05, 0.17, 0.92, ['bottom']);
    kit.quad(R.metal, P(-0.36, 0.95, -0.95), P(0.36, 0.95, -0.95), P(0.36, 1.2, 0.98), P(-0.36, 1.2, 0.98), UP, true);
    kit.quad(R.metal, P(-0.36, 0.9, -0.95), P(0.36, 0.9, -0.95), P(0.36, 1.15, 0.98), P(-0.36, 1.15, 0.98), DOWN, true);
  } else if (v.t === 'staves') {
    // the rack: two uprights, two rails; the staves leaning in it, some broken, their heads the band's metal
    for (const z of [-0.8, 0.8]) box(R.metal, -0.05, 0, z - 0.05, 0.05, 1.2, z + 0.05);
    for (const yy of [0.3, 0.95]) box(R.metal, -0.04, yy, -0.8, 0.04, yy + 0.06, 0.8, []);
    for (let k = 0; k < 5; k++) {
      const z = -0.6 + k * 0.3, broken = k % 2 === 1, top = broken ? 0.55 + 0.1 * k : 1.3;
      rod(R.wall, [0.25, 0.025, z], [-0.08, top, z + 0.05], 0.025);   // its foot's round on the floor, never through it
      if (!broken) box(R.metal, -0.14, top - 0.02, z - 0.04, -0.02, top + 0.08, z + 0.1, []);
    }
    rod(R.wall, [0.3, 0.03, -0.9], [-0.3, 0.06, -0.2], 0.025);   // fallen, lying ON the floor (its radius over it)
  } else if (v.t === 'shrine') {
    // the Kyn's shrine: a stepped altar of basalt, its iron horns, its bowl of the band's fire
    box(R.wall, -0.4, 0, -0.4, 0.4, 0.2, 0.4);
    box(R.wall, -0.32, 0.2, -0.32, 0.32, 0.75, 0.32);
    box(R.wall, -0.36, 0.75, -0.36, 0.36, 0.85, 0.36, []);
    kit.lathe(R.metal, [[0.08, 0.85], [0.22, 0.95], [0.26, 1.08], [0.2, 1.1]], 8, { centre: P(0, 0, 0) });
    kit.lathe(R.molten, [[0.2, 1.1], [0.12, 1.16], [0, 1.18]], 8, { centre: P(0, 0, 0) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const base = [sx * 0.3, 0.85, sz * 0.3];
      kit.tri(R.metal, P(base[0] - 0.05, base[1], base[2]), P(base[0] + 0.05, base[1], base[2]), P(sx * 0.38, 1.35, sz * 0.38), [sx, 0.2, sz], true);
      kit.tri(R.metal, P(base[0], base[1], base[2] - 0.05), P(base[0], base[1], base[2] + 0.05), P(sx * 0.38, 1.35, sz * 0.38), [sx, 0.2, sz], true);
    }
  } else if (v.t === 'shelf') {
    // a fallen shelf: a bookcase on its back along the floor, its shelves standing up, its books spilled about it
    box(R.metal, -0.38, 0, -0.98, 0.38, 0.08, 0.98);
    for (const z of [-0.98, -0.5, 0, 0.5, 0.92]) box(R.metal, -0.38, 0.08, z, 0.38, 0.42, z + 0.06, ['bottom']);
    for (const x of [-0.38, 0.32]) box(R.metal, x, 0.08, -0.98, x + 0.06, 0.42, 0.98, ['bottom']);
    for (let k = 0; k < 6; k++) { const z = -0.85 + k * 0.3, h = egGroundHash(spec.seed ?? 0, Math.round(v.z * 10), k); box(h > 0.7 ? R.metal : R.root, -0.3 + h * 0.2, 0.08, z, -0.06 + h * 0.2, 0.16 + 0.1 * h, z + 0.18); }
  } else {
    // a weapon rack: its two posts and rails, blades and spears in it
    for (const z of [-0.8, 0.8]) box(R.metal, -0.18, 0, z - 0.08, 0.18, 1.35, z + 0.08);
    for (const yy of [0.45, 0.85, 1.25]) box(R.metal, -0.05, yy, -0.75, 0.05, yy + 0.06, 0.75, []);
    for (let k = 0; k < 4; k++) {
      const z = -0.5 + k * 0.33;
      box(R.metal, -0.02, 0.15, z - 0.03, 0.02, 1.3, z + 0.03, []);
      if (k % 2 === 0) box(R.metal, -0.1, 1.0, z - 0.02, 0.1, 1.06, z + 0.02, []);
    }
  }
  void B;
}

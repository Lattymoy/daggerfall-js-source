// @ts-check
// EG-ZO (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 25.1 and 25.8):
// THE SPIRE'S UNDERSIDE, MODELLED - the torn academy the halls fell from, modelled with the arc's one mesh kit
// (world/eliteGates/meshKit.js) in the band's own dress (world/eliteGates/egBandArt.js): the torn floor (its flags on top, the walls' ashlar on
// its broken edge); the rock it was torn up with, hanging under it like a cake cut through (the undersides' record, its
// strata by depth: the torn lip, the courses, the works, the haze at the tip); the spires of rock hanging round it; the
// galleries' broken floors jutting from its flanks; the colonnade of the hall above, torn through and hanging upside down
// under the rim; and girders of the band's metal welded through the rock. One plan for every band (the Spire is one),
// seeded: the same on every screen. The stair's fall passes it (world/eliteGates/egUnderside.js - THE FALL, render/eliteGates/egStairPass.js).
//
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 4):
// moved here out of world/eliteGates/egUnderside.js, which re-exports every name, so THE WRECK (world/eliteGates/egVista.js) stands the same
// model overhead from the swap's worker: the fall's own module reads the stair's clock (world/eliteGates/egLights.js), whose graph
// (the score, the lords' bodies, the hall law's lights) is no worker's to load. And each part lays its faces in a record
// map (EG_UNDERSIDE_DRESS, the fall's - the default; the wreck lays it in the kit's far stone and foundations - world/
// egVista.js EG_VISTA_UNDER_DRESS).
//
// THE SLICES: the model and its four pictures are made a slice at a time (`egUndersideParts(band).step()`), so the veil
// makes them across the closing's first frames and never in the frame the swap lands in (section 7's "time-sliced",
// THE SWAP's own rule). The model is packed once, in renderer.createMesh's shape: Uint32 indices, a sub-mesh a record.
//
// Pure: no DOM, no GL. Not a DFU member. Ledger A (ELITE-GATES).
import { createMeshKit } from './meshKit.js';
import { EG_DRESS, egBandArchive, egBandArtOf } from './egBandArt.js';
import { rng } from '../superDungeon/sdPixelKit.js';

/** THE UNDERSIDE (m, its own frame: the torn floor's top at y 0, its axis at x = z = 0): the floor's radius, its rim's
 *  corners (the rock's rings have as many), how ragged its rim is (a share of r, either way), the floor's thickness, how
 *  far the rock hangs under it to its main tip, its rings, its top ring against the rim (a share), how it narrows (its
 *  radius (1 - t)^taper down its depth), each corner's jitter below the top ring, the cake's step at each inner ring, and
 *  the plan's seed. */
export const EG_UNDERSIDE = Object.freeze({ r: 44, sides: 32, rag: 0.1, slab: 4.5, depth: 40, rings: 8, waist: 0.9, taper: 1.35, jitter: 0.14, step: 0.12, seed: 0xe60f });
/** THE SPIRES of rock hanging round it: how many, their lengths and top radii (m, a range each), sides, rings, how far a
 *  tip bends (a share of its length), a broken tip's radius (a share of its top's), and where they hang (a share of r). */
export const EG_UNDERSIDE_SPIRES = Object.freeze({ n: 10, len: Object.freeze([14, 30]), r: Object.freeze([2.4, 5.2]), sides: 6, rings: 5, bend: 0.08, tip: 0.2, at: Object.freeze([0.45, 0.8]) });
/** THE GALLERIES' BROKEN FLOORS jutting from the rock's flank: how many, their heights (m), how far each juts past the
 *  flank, its width and its thickness. */
export const EG_UNDERSIDE_GALLERIES = Object.freeze({ n: 6, y: Object.freeze([-8, -24]), out: Object.freeze([4, 9]), w: Object.freeze([6, 10]), thick: 0.8 });
/** THE COLONNADE torn through, hanging upside down under the floor between the rock and the rim: how many, their lengths
 *  (m), a shaft's radius and its capital's, and their sides. */
export const EG_UNDERSIDE_COLUMNS = Object.freeze({ n: 7, len: Object.freeze([4, 9]), r: 0.6, cap: 0.85, sides: 8 });
/** THE GIRDERS of the band's metal welded through the rock: how many, their heights (m), how far each juts past the
 *  flank, how much it droops along that, its width and its depth. */
export const EG_UNDERSIDE_GIRDERS = Object.freeze({ n: 6, y: Object.freeze([-6, -20]), out: Object.freeze([3, 6]), droop: 1.5, w: 0.6, h: 0.8 });
/** The records the underside wears (the band's own - world/eliteGates/egBandArt.js EG_DRESS), lowest first: the floor's flags, the
 *  band's metal, the undersides' strata, the walls' ashlar. */
export const EG_UNDERSIDE_RECORDS = Object.freeze([EG_DRESS.floor, EG_DRESS.brass, EG_DRESS.root, EG_DRESS.pillar]);
/** EG-LOOK: the record each of its parts lays its faces in - `floor` the torn floor's flags and the galleries' floors,
 *  `metal` the girders, `rock` the rock and its spires (their strata by depth), `stone` the broken edge and the
 *  colonnade. The fall's dress (EG_UNDERSIDE_RECORDS) by default; THE WRECK lays it in the kit's own (world/eliteGates/egVista.js). */
/** @type {Readonly<{ floor: number, metal: number, rock: number, stone: number }>} */
export const EG_UNDERSIDE_DRESS = Object.freeze({ floor: EG_DRESS.floor, metal: EG_DRESS.brass, rock: EG_DRESS.root, stone: EG_DRESS.pillar });
/** Where a spire's broken tip fades into the haze, at the least (the strata's v - the islands' own law, sdIslandModel.js
 *  SD_SPIRE.haze). */
export const EG_UNDERSIDE_HAZE = 0.84;

const TAU = Math.PI * 2;
const lerp = (r, u) => r[0] + (r[1] - r[0]) * u;
/** The rock's radius `t` down its depth (0 the floor's foot, 1 the main tip), before its jitter. */
export const egUndersideRockR = (t) => EG_UNDERSIDE.waist * EG_UNDERSIDE.r * (1 - Math.max(0, Math.min(1, t))) ** EG_UNDERSIDE.taper;
/** The strata's v at height `y` (0 the torn lip, 1 the main tip's haze). */
const vOf = (y) => Math.max(0, Math.min(1, -y / (EG_UNDERSIDE.slab + EG_UNDERSIDE.depth)));

/**
 * THE UNDERSIDE PLANNED (pure, seeded - every screen the same): the rim's corners (xz), the rock's rings (each its height,
 * its corners and its cake step - the top ring under the floor follows the rim inward, so the floor's underside is never
 * folded), the main tip, the spires (each its top, length, radius, bend and corners' jitter), the galleries' floors (each
 * a convex polygon and its height), the columns (each its foot under the floor and its length) and the girders (each its
 * two ends). Drawn once in a fixed order from one stream.
 */
export function egUndersidePlan() {
  const U = EG_UNDERSIDE, N = U.sides, rnd = rng(U.seed);
  const rim = [];
  for (let k = 0; k < N; k++) { const a = (k / N) * TAU, rr = U.r * (1 + U.rag * (2 * rnd() - 1)); rim.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const rings = [];
  for (let i = 0; i < U.rings; i++) {
    const t = i / U.rings, y = -U.slab - U.depth * t, corners = [];
    for (let k = 0; k < N; k++) {
      if (i === 0) { const s = U.waist * (1 - 0.04 * rnd()); corners.push([rim[k][0] * s, y, rim[k][1] * s]); continue; }   // under the floor, inside its rim
      const a = (k / N) * TAU + i * 0.07, rr = egUndersideRockR(t) * (1 + U.jitter * (2 * rnd() - 1));
      corners.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
    }
    rings.push({ y, corners, step: i > 0 ? 1 + U.step * (0.6 + 0.8 * rnd()) : 1 });
  }
  const tip = [(rnd() - 0.5) * 3, -U.slab - U.depth - 2 * rnd(), (rnd() - 0.5) * 3];
  const S = EG_UNDERSIDE_SPIRES, spires = [];
  for (let j = 0; j < S.n; j++) {
    const a = (j / S.n) * TAU + (rnd() - 0.5) * 0.4, rho = U.r * lerp(S.at, rnd());
    spires.push({ x: Math.cos(a) * rho, z: Math.sin(a) * rho, y: -U.slab + 0.5, len: lerp(S.len, rnd()), R: lerp(S.r, rnd()), bendA: a, jit: Array.from({ length: S.rings * S.sides }, () => rnd()), steps: Array.from({ length: S.rings }, () => rnd()) });
  }
  const G = EG_UNDERSIDE_GALLERIES, galleries = [];
  for (let g = 0; g < G.n; g++) {
    const a = (g / G.n) * TAU + 0.5 + (rnd() - 0.5) * 0.6, y = lerp(G.y, rnd()), flank = egUndersideRockR((-y - U.slab) / U.depth);
    const inner = flank - 3, outer = flank + lerp(G.out, rnd()), w = lerp(G.w, rnd()), c = Math.cos(a), s = Math.sin(a);
    const at = (u, v) => [c * u - s * v, s * u + c * v];   // u out along a, v across it
    // a convex slab: its inner edge in the rock, its torn outer edge broken to a point
    galleries.push({ y, poly: [at(inner, -w / 2), at(outer, -w * 0.3), at(outer + 1.2, w * 0.05), at(outer - 0.4, w * 0.36), at(inner, w / 2)] });
  }
  const C = EG_UNDERSIDE_COLUMNS, columns = [];
  for (let k = 0; k < C.n; k++) {
    const i = Math.floor(((k + rnd() * 0.6) / C.n) * N) % N, ring0 = rings[0].corners[i];
    // between the rock's top ring and the rim, under the floor
    columns.push({ x: (rim[i][0] + ring0[0]) / 2, z: (rim[i][1] + ring0[2]) / 2, len: lerp(C.len, rnd()) });
  }
  const R = EG_UNDERSIDE_GIRDERS, girders = [];
  for (let k = 0; k < R.n; k++) {
    const a = (k / R.n) * TAU + 0.25 + (rnd() - 0.5) * 0.5, y = lerp(R.y, rnd()), flank = egUndersideRockR((-y - U.slab) / U.depth), out = lerp(R.out, rnd());
    girders.push({ a: [Math.cos(a) * (flank - 2), y, Math.sin(a) * (flank - 2)], b: [Math.cos(a) * (flank + out), y - R.droop, Math.sin(a) * (flank + out)] });
  }
  return { rim, rings, tip, spires, galleries, columns, girders };
}

/** THE FLOOR AND THE ROCK laid into `kit`: the floor's top (its flags, fanned from the axis - the rim is ragged, never
 *  convex), its torn edge (the walls' ashlar), its underside out to the rock (the torn lip), the rock's flank ring by ring
 *  with its cake steps (each ledge facing down, into the deep's light), and the main tip. */
function layRock(kit, plan, recs = EG_UNDERSIDE_DRESS) {
  const U = EG_UNDERSIDE, N = U.sides, { rim, rings, tip } = plan;
  for (let k = 0; k < N; k++) {
    const p = rim[k], q = rim[(k + 1) % N];
    kit.tri(recs.floor, [0, 0, 0], [p[0], 0, p[1]], [q[0], 0, q[1]], [0, 1, 0], true, [0, 0], [p[0] * 0.5, p[1] * 0.5], [q[0] * 0.5, q[1] * 0.5]);
  }
  kit.prism(recs.stone, rim, -U.slab, 0, { top: false, bottom: false });
  const circ = rim.reduce((s, p, k) => s + Math.hypot(rim[(k + 1) % N][0] - p[0], rim[(k + 1) % N][1] - p[1]), 0);
  const Ur = Math.max(1, Math.round((circ * 2) / (U.slab + U.depth)));   // the strata's texels square across (world/superDungeon/sdIslandModel.js uRep)
  const ring0 = rings[0].corners, v0 = vOf(-U.slab);
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N, u0 = (k / N) * Ur, u1 = ((k + 1) / N) * Ur;
    kit.quad(recs.rock, [rim[k][0], -U.slab, rim[k][1]], [rim[k1][0], -U.slab, rim[k1][1]], ring0[k1], ring0[k], [0, -1, 0], true, [[u0, 0], [u1, 0], [u1, v0], [u0, v0]]);
  }
  for (let i = 0; i + 1 < rings.length; i++) {
    const A = rings[i], B = rings[i + 1], outer = B.corners.map((p) => [p[0] * B.step, p[1], p[2] * B.step]), mid = [0, (A.y + B.y) / 2, 0];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N, u0 = (k / N) * Ur, u1 = ((k + 1) / N) * Ur;
      kit.quad(recs.rock, A.corners[k], A.corners[k1], outer[k1], outer[k], mid, false, [[u0, vOf(A.y)], [u1, vOf(A.y)], [u1, vOf(B.y)], [u0, vOf(B.y)]]);
      kit.quad(recs.rock, outer[k], outer[k1], B.corners[k1], B.corners[k], [0, -1, 0], true, [[u0, vOf(B.y)], [u1, vOf(B.y)], [u1, vOf(B.y)], [u0, vOf(B.y)]]);
    }
  }
  const last = rings[rings.length - 1], above = [0, last.y + 1, 0];
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    kit.tri(recs.rock, last.corners[k], last.corners[k1], tip, above, false, [(k / N) * Ur, vOf(last.y)], [((k + 1) / N) * Ur, vOf(last.y)], [((k + 0.5) / N) * Ur, 1]);
  }
}

/** A spire's ring `i` (0 its top, buried in the floor; the last its broken tip): its centre and its radius before the
 *  jitter - bending away from the axis as it falls (world/superDungeon/sdIslandModel.js spireRing's law). */
export function egUndersideSpireRing(s, i) {
  const S = EG_UNDERSIDE_SPIRES, t = i / (S.rings - 1), b = S.bend * s.len * t * t;
  return { x: s.x + Math.cos(s.bendA) * b, y: s.y - s.len * t, z: s.z + Math.sin(s.bendA) * b, R: s.R * (1 - (1 - S.tip) * t ** 1.1) };
}
/** THE SPIRES laid into `kit`: each a ring sweep with its seeded jitter and its cake steps, its tip broken jagged and
 *  closed to a point, its strata by depth and never under the haze at the tip. */
function laySpires(kit, plan, recs = EG_UNDERSIDE_DRESS) {
  const S = EG_UNDERSIDE_SPIRES, n = S.sides;
  plan.spires.forEach((s, j) => {
    const U = Math.max(1, Math.round((TAU * s.R * 2) / (EG_UNDERSIDE.slab + EG_UNDERSIDE.depth))), rings = [];
    for (let i = 0; i < S.rings; i++) {
      const c = egUndersideSpireRing(s, i), tip = i === S.rings - 1, ring = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + j, h = s.jit[i * n + k], rr = c.R * (1 + 0.18 * (2 * h - 1));
        ring.push([c.x + Math.cos(a) * rr, c.y + (tip ? c.R * 1.2 * (h - 0.5) : 0), c.z + Math.sin(a) * rr]);   // the broken tip, jagged
      }
      const step = i > 0 && !tip ? 1 + 0.14 * (0.6 + 0.8 * s.steps[i]) : 1;
      const outer = ring.map((p) => [c.x + (p[0] - c.x) * step, p[1], c.z + (p[2] - c.z) * step]);
      rings.push({ c, ring, outer, v: ring.map((p) => (tip ? Math.max(EG_UNDERSIDE_HAZE, vOf(p[1])) : vOf(p[1]))) });
    }
    for (let i = 0; i + 1 < rings.length; i++) {
      const A = rings[i], B = rings[i + 1], mid = [(A.c.x + B.c.x) / 2, (A.c.y + B.c.y) / 2, (A.c.z + B.c.z) / 2], ledge = i + 1 < rings.length - 1;
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, u0 = (k / n) * U, u1 = ((k + 1) / n) * U;
        kit.quad(recs.rock, A.ring[k], A.ring[k1], B.outer[k1], B.outer[k], mid, false, [[u0, A.v[k]], [u1, A.v[k1]], [u1, B.v[k1]], [u0, B.v[k]]]);
        if (ledge) kit.quad(recs.rock, B.outer[k], B.outer[k1], B.ring[k1], B.ring[k], [0, -1, 0], true, [[u0, B.v[k]], [u1, B.v[k1]], [u1, B.v[k1]], [u0, B.v[k]]]);
      }
    }
    const last = rings[rings.length - 1], point = [last.c.x + last.c.R * 0.3, last.c.y - last.c.R * 1.6, last.c.z], above = [last.c.x, last.c.y + 1, last.c.z];
    for (let k = 0; k < n; k++) kit.tri(recs.rock, last.ring[k], last.ring[(k + 1) % n], point, above, false, [(k / n) * U, last.v[k]], [((k + 1) / n) * U, last.v[(k + 1) % n]], [((k + 0.5) / n) * U, 1]);
  });
}

/** THE WRECK laid into `kit`: the galleries' broken floors (prisms of the band's flags), the colonnade hanging upside down
 *  under the floor (lathed drums of the walls' stone: the capital against the floor, the shaft, its broken stump), and
 *  the girders of the band's metal (extruded, jutting and drooping from the rock). */
function layWreck(kit, plan, recs = EG_UNDERSIDE_DRESS) {
  const G = EG_UNDERSIDE_GALLERIES, C = EG_UNDERSIDE_COLUMNS, R = EG_UNDERSIDE_GIRDERS;
  for (const g of plan.galleries) kit.prism(recs.floor, g.poly, g.y - G.thick, g.y, { top: true, bottom: true });
  for (const c of plan.columns) {
    const L = c.len;
    kit.lathe(recs.stone, [[0, -L - 0.5], [C.r * 0.7, -L], [C.r, -L + 0.25], [C.r, -0.7], [C.cap, -0.35], [C.cap, 0]], C.sides, { centre: [c.x, -EG_UNDERSIDE.slab, c.z] });
  }
  const w = R.w / 2, h = R.h / 2;
  for (const g of plan.girders) kit.extrude(recs.metal, [[-w, -h], [w, -h], [w, h], [-w, h]], g.a, g.b);
}
/** The model's three parts, each laid into a kit from the plan - `(kit, plan, recs?)` (EG-LOOK: `recs` the record map,
 *  EG_UNDERSIDE_DRESS by default) - in the order they are made. */
export const EG_UNDERSIDE_LAYS = Object.freeze({ rock: layRock, spires: laySpires, wreck: layWreck });
const LAYS = Object.freeze(Object.values(EG_UNDERSIDE_LAYS));

/** THE UNDERSIDE'S MODEL in band `band`'s dress (renderer.createMesh's shape, under the band's archive - a sub-mesh for
 *  each of EG_UNDERSIDE_RECORDS, lowest first), built whole. EG-LOOK: `recs` the record each part lays in (THE WRECK's
 *  overhead copy - world/eliteGates/egVista.js), the fall's dress by default. Pure.
 *  @param {number} band @param {{ recs?: { floor: number, metal: number, rock: number, stone: number } }} [o] */
export function buildEgUndersideModel(band, { recs = EG_UNDERSIDE_DRESS } = {}) {
  const kit = createMeshKit({ start: 1024 }), plan = egUndersidePlan();
  for (const lay of LAYS) lay(kit, plan, recs);
  return kit.pack(egBandArchive(band));
}

/**
 * THE UNDERSIDE MADE A SLICE AT A TIME for band `band` (0-3): `step()` makes one slice and answers whether all are made -
 * the floor and the rock, the spires, the wreck, the pack, then each of its four pictures (world/eliteGates/egBandArt.js
 * egBandArtOf, `[record, { albedo, emission }]`). `model` the packed model once made, `art` the pictures made so far,
 * `slices` how many there are, `done` whether all are made. Pure: the same model and pixels as built whole.
 */
export function egUndersideParts(band) {
  const b = Math.max(0, Math.min(3, band | 0)), kit = createMeshKit({ start: 1024 }), plan = egUndersidePlan();
  /** @type {Array<() => void>} */
  const slices = [
    ...LAYS.map((lay) => () => lay(kit, plan)),
    () => { parts.model = kit.pack(egBandArchive(b)); },
    ...EG_UNDERSIDE_RECORDS.map((rec) => () => { parts.art.push(egBandArtOf(b, rec)); }),
  ];
  let i = 0;
  const parts = {
    band: b,
    /** @type {null | ReturnType<typeof buildEgUndersideModel>} */ model: null,
    /** @type {Array<ReturnType<typeof egBandArtOf>>} */ art: [],
    slices: slices.length,
    get done() { return i >= slices.length; },
    step() { if (i < slices.length) slices[i++](); return i >= slices.length; },
  };
  return parts;
}

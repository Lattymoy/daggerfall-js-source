// @ts-check
// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area, a gate
// of oblivion"): THE GATE'S SHAPE - built in code, because no Daggerfall record looks like an Oblivion gate and
// Morrowind's data is the player's own and optional (MWA4). Design: bible/11-Multiplayer/World-Bosses.md section 3.
//
// Two horns of black volcanic stone rise from a stepped plinth and curve toward each other over the threshold until
// their tips nearly meet; a row of spines runs down the back of each; the portal hangs between them (the membrane is
// a pass of its own - render/gatePass.js - never this mesh). Faceted on purpose: every face is flat-shaded (its own
// three vertices and one normal), the low-polygon stone the rest of Daggerfall's world is cut from.
//
// PURE: positions, normals, uvs and indices in the GATE'S OWN FRAME - metres, origin at the centre of the threshold on
// the ground, +y up, the horns spread along x and the portal facing +z and -z - and the sub-meshes by texture. The pool
// (scenes/gatePool.js) uploads it once, draws it with the gate's matrix and hands the collider the same triangles.
//
// Not a DFU member. Ledger A (WB).

/** The gate's textures (world/gateArt.js): the horns' cracked basalt and the plinth's carved flags - the port's own
 *  pseudo-archive, far above any classic archive (bloodArt.js's law, BLOOD_ATLAS_ARCHIVE 38001). */
export const GATE_ARCHIVE = 38101;
export const GATE_STONE_RECORD = 0;
export const GATE_PLINTH_RECORD = 1;

/** The horns' spine, in the x/y plane of the left horn (the right is its mirror): a cubic from its root on the plinth
 *  out, up, and in over the threshold. Metres. */
export const HORN_SPINE = Object.freeze([[-4.6, 0.6], [-6.9, 7.2], [-4.9, 13.6], [-0.5, 15.6]]);
/** The horn's cross-section: sides, the radius at its root and at its tip, and how much deeper (z) than wide (x) it is. */
export const HORN_SIDES = 7;
export const HORN_ROOT_R = 1.85;
export const HORN_TIP_R = 0.14;
export const HORN_DEPTH = 1.25;
/** Rings along a horn - enough that its curve reads as a curve and not a bent stick. */
export const HORN_RINGS = 30;
/** The horn's growth ridges: every RIDGE_EVERY-th ring stands proud by RIDGE_OUT of the rest. */
export const RIDGE_EVERY = 4;
export const RIDGE_OUT = 0.09;
/** The spines down each horn's back: how many, where along the spine they start and end, how long at most. */
export const SPINE_COUNT = 7;
export const SPINE_FROM = 0.18;
export const SPINE_TO = 0.86;
export const SPINE_LEN = 2.8;
/** The plinth: its radius, the step's radius and both heights. */
export const PLINTH_R = 8.2;
export const PLINTH_STEP_R = 6.1;
export const PLINTH_H = 0.35;
export const PLINTH_STEP_H = 0.3;
export const PLINTH_SIDES = 12;
/** The portal: where the membrane hangs between the horns (its centre's height and its half-width and half-height). */
export const PORTAL_CENTRE_Y = 6.9;
export const PORTAL_HALF_W = 3.2;
export const PORTAL_HALF_H = 6.1;
/** The whole gate's height, for the rise out of the ground and the eye's box. */
export const GATE_HEIGHT = 16.2;
/** The lesser spires round the plinth's rim: where (degrees from +x toward +z - never within fifty degrees of the
 *  two ways in, +z and -z), how tall, and how far they lean out. */
export const RIM_SPIRE_ANGLES = Object.freeze([0, 38, 142, 180, 218, 322]);
export const RIM_SPIRE_H = 3.4;
export const RIM_SPIRE_LEAN = 0.9;
/** The claws each horn's root grips the plinth with. */
export const CLAWS = 3;
export const CLAW_LEN = 1.6;

const cubic = (p, t) => {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
};
const cubicTangent = (p, t) => {
  const u = 1 - t;
  const a = -3 * u * u, b = 3 * u * u - 6 * u * t, c = 6 * u * t - 3 * t * t, d = 3 * t * t;
  const x = a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0];
  const y = a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1];
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** What a face belongs to - the pins measure each by its own law (a horn's skin against its spine, a spike against
 *  its own axis, the plinth against its centre). */
export const GATE_PART = Object.freeze({ Plinth: 0, Horn: 1, Spike: 2 });

/** A builder of flat-shaded triangles, gathered by texture record, each tagged with its part. */
function faces() {
  const byRec = new Map();
  let part = GATE_PART.Plinth;
  const tri = (rec, a, b, c, ua, ub, uc) => {
    let g = byRec.get(rec);
    if (!g) byRec.set(rec, g = { p: [], n: [], uv: [], parts: [] });
    g.parts.push(part);
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const [v, u] of [[a, ua], [b, ub], [c, uc]]) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.uv.push(u[0], u[1]); }
  };
  const quad = (rec, a, b, c, d, ua, ub, uc, ud) => { tri(rec, a, b, c, ua, ub, uc); tri(rec, a, c, d, ua, uc, ud); };
  return { tri, quad, byRec, as: (p) => { part = p; } };
}

/** One horn, left (`side` -1) or right (+1), swept along HORN_SPINE: rings of HORN_SIDES, tapering root to tip, closed
 *  at the tip by a point. u runs round the section, v up the horn (a texture every ~3 m). */
function horn(f, side) {
  f.as(GATE_PART.Horn);
  const rings = [];
  let len = 0, prev = null;
  for (let i = 0; i <= HORN_RINGS; i++) {
    const t = i / HORN_RINGS;
    const [sx, sy] = cubic(HORN_SPINE, t);
    const [tx, ty] = cubicTangent(HORN_SPINE, t);
    const c = [side < 0 ? sx : -sx, sy, 0];   // the left horn as written, the right mirrored in x
    if (prev) len += Math.hypot(c[0] - prev[0], c[1] - prev[1]);
    prev = c;
    // the section's frame: n across the curve in the x/y plane, z deep; a little twist so the facets spiral
    const nx = side < 0 ? -ty : ty, ny = tx;   // the tangent turned a quarter, mirrored with the horn
    const ridge = i > 0 && i < HORN_RINGS - 2 && i % RIDGE_EVERY === 0 ? 1 + RIDGE_OUT : 1;
    const r = (HORN_ROOT_R + (HORN_TIP_R - HORN_ROOT_R) * Math.pow(t, 1.1)) * ridge;
    const twist = t * 0.9;
    const ring = [];
    for (let k = 0; k < HORN_SIDES; k++) {
      const a = (k / HORN_SIDES) * Math.PI * 2 + twist;
      const along = Math.cos(a) * r, deep = Math.sin(a) * r * HORN_DEPTH;
      ring.push([c[0] + nx * along, c[1] + ny * along, deep]);
    }
    rings.push({ ring, v: len / 3 });
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let k = 0; k < HORN_SIDES; k++) {
      const k2 = (k + 1) % HORN_SIDES;
      const u0 = k / HORN_SIDES, u1 = (k + 1) / HORN_SIDES;
      // wound so the outside faces out (the section runs counter-clockwise seen from the tip for the left horn)
      if (side < 0) f.quad(GATE_STONE_RECORD, A.ring[k], A.ring[k2], B.ring[k2], B.ring[k], [u0, A.v], [u1, A.v], [u1, B.v], [u0, B.v]);
      else f.quad(GATE_STONE_RECORD, A.ring[k], B.ring[k], B.ring[k2], A.ring[k2], [u0, A.v], [u0, B.v], [u1, B.v], [u1, A.v]);
    }
  }
  // the tip: a point just past the last ring along the spine
  const last = rings[rings.length - 1];
  const [ex, ey] = cubic(HORN_SPINE, 1);
  const [etx, ety] = cubicTangent(HORN_SPINE, 1);
  const tip = [side < 0 ? ex + etx * 0.6 : -(ex + etx * 0.6), ey + ety * 0.6, 0];
  for (let k = 0; k < HORN_SIDES; k++) {
    const k2 = (k + 1) % HORN_SIDES;
    if (side < 0) f.tri(GATE_STONE_RECORD, last.ring[k], last.ring[k2], tip, [k / HORN_SIDES, last.v], [(k + 1) / HORN_SIDES, last.v], [(k + 0.5) / HORN_SIDES, last.v + 0.2]);
    else f.tri(GATE_STONE_RECORD, last.ring[k], tip, last.ring[k2], [k / HORN_SIDES, last.v], [(k + 0.5) / HORN_SIDES, last.v + 0.2], [(k + 1) / HORN_SIDES, last.v]);
  }
  // the spines: down the horn's back (its outside), each a four-sided spike leaning up and out
  for (let s = 0; s < SPINE_COUNT; s++) {
    const t = SPINE_FROM + (SPINE_TO - SPINE_FROM) * (s / (SPINE_COUNT - 1));
    const [sx, sy] = cubic(HORN_SPINE, t);
    const [tx, ty] = cubicTangent(HORN_SPINE, t);
    const out = [side < 0 ? -Math.abs(ty) : Math.abs(ty), -tx];   // the spine's outward normal: away from the threshold
    const r = HORN_ROOT_R + (HORN_TIP_R - HORN_ROOT_R) * Math.pow(t, 1.1);
    const len = SPINE_LEN * (1 - 0.55 * (s / (SPINE_COUNT - 1)));
    const base = [(side < 0 ? sx : -sx) + out[0] * r * 0.8, sy + out[1] * r * 0.8, 0];
    spike(f, base, r * 0.45, [base[0] + out[0] * len * 0.8, base[1] + out[1] * len * 0.8 + len * 0.55, 0]);
  }
}

/** The plinth's top wears its carved texture ONE tile across the step, so the rune ring stands once, under the
 *  threshold; the wider slab below repeats it round the step's foot. */
export const PLINTH_TILE_M = 2 * PLINTH_STEP_R;

/** The plinth: a twelve-sided slab and a smaller step on it, their tops carved (the plinth's own texture), their
 *  sides the horns' stone. */
function plinth(f) {
  f.as(GATE_PART.Plinth);
  const uvTop = (p) => [0.5 + p[0] / PLINTH_TILE_M, 0.5 + p[2] / PLINTH_TILE_M];
  const tier = (r, y0, y1) => {
    const top = (a) => [Math.cos(a) * r, y1, Math.sin(a) * r];
    const bot = (a) => [Math.cos(a) * r, y0, Math.sin(a) * r];
    for (let k = 0; k < PLINTH_SIDES; k++) {
      const a0 = (k / PLINTH_SIDES) * Math.PI * 2, a1 = ((k + 1) / PLINTH_SIDES) * Math.PI * 2;
      const t0 = top(a0), t1 = top(a1), b0 = bot(a0), b1 = bot(a1);
      f.quad(GATE_STONE_RECORD, b0, t0, t1, b1, [0, 0], [0, (y1 - y0) / 3], [1, (y1 - y0) / 3], [1, 0]);
      const c = [0, y1, 0];
      f.tri(GATE_PLINTH_RECORD, c, t1, t0, uvTop(c), uvTop(t1), uvTop(t0));
    }
  };
  tier(PLINTH_R, -1.2, PLINTH_H);   // its foot sunk below the ground, so a slope never shows light under it
  tier(PLINTH_STEP_R, PLINTH_H, PLINTH_H + PLINTH_STEP_H);
}

/** A four-sided spike from a base square (centre `b`, half-size `w`, in the plane its axis `ax` leaves) to `tip` -
 *  the spines', the claws' and the rim spires' one shape, wound outward whatever way it points. */
function spike(f, b, w, tip) {
  f.as(GATE_PART.Spike);
  const ax = norm(sub(tip, b));
  const up = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s1 = norm(cross(ax, up)), s2 = norm(cross(ax, s1));
  const q = [0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; return [b[0] + (s1[0] * Math.cos(a) + s2[0] * Math.sin(a)) * w, b[1] + (s1[1] * Math.cos(a) + s2[1] * Math.sin(a)) * w, b[2] + (s1[2] * Math.cos(a) + s2[2] * Math.sin(a)) * w]; });
  for (let k = 0; k < 4; k++) {
    const a = q[k], c = q[(k + 1) % 4];
    const n = cross(sub(c, a), sub(tip, a));
    const mid = [(a[0] + c[0] + tip[0]) / 3 - b[0], (a[1] + c[1] + tip[1]) / 3 - b[1], (a[2] + c[2] + tip[2]) / 3 - b[2]];
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] >= 0) f.tri(GATE_STONE_RECORD, a, c, tip, [0, 0], [0.25, 0], [0.12, 0.8]);
    else f.tri(GATE_STONE_RECORD, a, tip, c, [0, 0], [0.12, 0.8], [0.25, 0]);
  }
}

/** The claws each horn's root grips the plinth with, splayed outward and down onto the step, and the lesser spires
 *  standing round the plinth's rim, leaning out. */
function clawsAndSpires(f) {
  for (const side of [-1, 1]) {
    const root = [side < 0 ? HORN_SPINE[0][0] : -HORN_SPINE[0][0], PLINTH_H + PLINTH_STEP_H, 0];
    for (let k = 0; k < CLAWS; k++) {
      const a = (-0.5 + k / (CLAWS - 1)) * 1.9;   // fanned across the root's outer half
      const dir = [(side < 0 ? -1 : 1) * Math.cos(a), 0, Math.sin(a)];   // outward from the threshold, fanned fore and aft
      const b = [root[0] + dir[0] * HORN_ROOT_R * 0.7, root[1] + 0.55, root[2] + dir[2] * HORN_ROOT_R * 0.9];
      spike(f, b, 0.38, [b[0] + dir[0] * CLAW_LEN, root[1] - 0.05, b[2] + dir[2] * CLAW_LEN]);
    }
  }
  for (const deg of RIM_SPIRE_ANGLES) {
    const a = (deg / 180) * Math.PI;
    const rr = PLINTH_R - 0.7;
    const b = [Math.cos(a) * rr, PLINTH_H - 0.1, Math.sin(a) * rr];
    spike(f, b, 0.45, [b[0] + Math.cos(a) * RIM_SPIRE_LEAN, PLINTH_H + RIM_SPIRE_H, b[2] + Math.sin(a) * RIM_SPIRE_LEAN]);
  }
}

/**
 * The gate, whole: `{ positions, normals, uvs, indices, subMeshes: [{ textureArchive, textureRecord, startIndex,
 * primitiveCount }] }` - renderer.createMesh's own model shape - and `triangles`, the collider's copy (the positions,
 * unindexed, which flat shading makes them anyway), and `parts`, each triangle's GATE_PART.
 */
export function buildGateModel() {
  const f = faces();
  plinth(f);
  horn(f, -1);
  horn(f, 1);
  clawsAndSpires(f);
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const parts = new Uint8Array(count / 3);
  const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec);
    const n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2); parts.set(g.parts, v / 3);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: GATE_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes, triangles: positions, parts };
}

/** The portal's place in the gate's frame: the membrane's centre and its half-extents (render/gatePass.js draws it). */
export const gatePortal = () => ({ centre: [0, PORTAL_CENTRE_Y, 0], halfW: PORTAL_HALF_W, halfH: PORTAL_HALF_H });

/** How many heights the arch's opening is measured at - the membrane's mask (render/gatePass.js uProfile). */
export const ARCH_PROFILE_N = 24;
/** The opening's bottom and top, metres (the step's top to just under the tips). */
export const ARCH_Y0 = PLINTH_H + PLINTH_STEP_H;
export const ARCH_Y1 = GATE_HEIGHT - 0.9;
/**
 * THE OPENING'S SHAPE: at ARCH_PROFILE_N heights from ARCH_Y0 to ARCH_Y1, the half-width of the clear space between
 * the horns - the least |x| of either horn's surface in that height's band, less `margin`, never below zero. Measured
 * off the built mesh itself, so the membrane fits the stone it hangs in whatever the horns' numbers become.
 * @param {{positions: Float32Array}} [model] @param {number} [margin] metres left between the fire and the stone
 */
export function gateArchProfile(model = buildGateModel(), margin = 0.15) {
  const out = new Float32Array(ARCH_PROFILE_N).fill(Infinity);
  const P = model.positions;
  const band = (ARCH_Y1 - ARCH_Y0) / (ARCH_PROFILE_N - 1);
  for (let i = 0; i < P.length; i += 3) {
    const x = Math.abs(P[i]), y = P[i + 1], z = Math.abs(P[i + 2]);
    if (y <= ARCH_Y0 + 1e-3 || z > HORN_ROOT_R * HORN_DEPTH * 1.3 || x > 12) continue;   // the plinth's top is no horn
    const k = Math.round((y - ARCH_Y0) / band);
    if (k < 0 || k >= ARCH_PROFILE_N) continue;
    if (x < out[k]) out[k] = x;
  }
  // a band no horn vertex reached (the top, where the tips meet) closes the arch
  for (let k = 0; k < ARCH_PROFILE_N; k++) out[k] = Number.isFinite(out[k]) ? Math.max(0, out[k] - margin) : 0;
  // the root's own band sees only the horns' outer faces over the plinth's lip: the opening is never wider there than above
  out[0] = Math.min(out[0], out[1]);
  return out;
}


// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GRAHT1 (bible/03-World/Graht-Oaks.md; the owner, 2026-10-25: "Vardenfell needs proper super tall low poly tree sprites
// with branchs/leaves that expand to cover the sky. The current simple skybox method is very low quality and band
// aided") - THE GRAHT-OAK, MADE: Valenwood's giant tree as the port's own low-poly geometry - no file, no picture of
// anyone's, every vertex a function of its variant's seed. PURE (world/ and nothing else): the host
// (scenes/grahtHost.js) uploads what this makes, the tests measure it, the law (world/jungle/grahtOaks.js) holds the
// measures the terrain worker stands it by.
//
//   - THE SKELETON (grahtSkeleton): a variant's trunk - a ringed column that flares into its BUTTRESSES, thin fins
//     snaking out to the foot, surface roots past them - its LIMBS, great branches leaving the trunk high up, climbing
//     and spreading, each forking twice, and its CROWN: flat-bottomed masses of leaves at every limb's and fork's end and
//     over the leader, with lianas hung from the limbs. One skeleton, every LOD: the far tree is the near tree's shape.
//   - THE MESHES (grahtOakMesh): a skeleton at a LOD, flat-shaded (a face one normal - the low-poly look the game's 3D
//     trees wear), in three submeshes - its bark, its leaves, its cards (the alpha-cut leaf sprays and lianas). LOD 0 the
//     whole tree, LOD 1 its silhouette at a tenth of the faces, LOD 2 the far tree: a column and a mass a limb.
//   - Its frame is the game's meshes': y up, metres at scale 1, the trunk's root at the origin, and a face wound so its
//     cross(b - a, c - a) points out of it - the front face under the renderer's frontFace(CW) and its mirrored
//     projection (render/renderer.js HANDEDNESS) - so the solids cull their backs.
// ═══════════════════════════════════════════════════════════════════

/** The variants (each its own seed) and the LODs every variant is made at. */
export const GRAHT_VARIANTS = 3;
export const GRAHT_LODS = 3;
/** A mesh's submeshes, in order - its bark (trunk, buttresses, roots, limbs), its leaves (the crown's masses) and its
 *  cards (the leaf sprays and the lianas, cut by their pictures' alpha). */
export const GRAHT_SUBS = Object.freeze(['bark', 'leaves', 'cards']);

/** THE TREE'S NUMBERS at scale 1 (metres): a variant draws each from its range. */
export const GRAHT_SHAPE = Object.freeze({
  /** the trunk: its radius at the ground before the flare, at the crown's start and at the leader's top; where the
   *  crown starts and the leader ends; the flare (added at the ground, falling by e every flareH); how far it is sunk */
  trunk: Object.freeze({
    r0: Object.freeze([8.6, 10.2]),
    rCrown: Object.freeze([4.8, 5.8]),
    rTop: 1.6,
    crownFrom: Object.freeze([74, 88]),
    leaderTop: Object.freeze([140, 158]),
    flare: 3.2,
    flareH: 9,
    sink: 9,
    lean: 3.5,
  }),
  /** the buttresses: how many, how far each reaches over the ground from the trunk's axis, how high up it it meets the
   *  trunk, its thickness at the trunk and at its edge, and how far its edge snakes sideways */
  fins: Object.freeze({
    count: Object.freeze([6, 8]),
    reach: Object.freeze([20, 24.5]),
    rise: Object.freeze([20, 32]),
    thick: Object.freeze([3.4, 0.9]),
    snake: 3,
  }),
  /** the surface roots past each buttress's foot: how far, and their radius */
  roots: Object.freeze({ reach: Object.freeze([5, 11]), r: 1.15 }),
  /** the limbs: how many, where on the trunk (a share of the crown's span over crownFrom), how long, how far the tip
   *  rises over its length, its radius where it leaves the trunk */
  limbs: Object.freeze({
    count: Object.freeze([7, 8]),
    from: Object.freeze([0, 0.62]),
    length: Object.freeze([50, 70]),
    rise: Object.freeze([0.28, 0.5]),
    r0: Object.freeze([2.4, 3.1]),
  }),
  /** each limb's two forks: where along it, how far round from it (radians), their share of its length and their rise */
  forks: Object.freeze({
    at: Object.freeze([0.5, 0.82]),
    turn: Object.freeze([0.55, 0.95]),
    length: Object.freeze([0.36, 0.5]),
    rise: Object.freeze([0.3, 0.6]),
  }),
  /** a crown's mass: its radius, its height's share of it, how flat its underside is, and how far its corners are
   *  pushed about (a share of its radius) */
  blob: Object.freeze({ r: Object.freeze([16, 24]), squash: Object.freeze([0.42, 0.52]), under: 0.62, jitter: 0.14 }),
  /** the leaf cards about each mass (LOD 0 and LOD 1) and their size */
  cards: Object.freeze({ lod0: 7, lod1: 2, size: Object.freeze([9, 14]) }),
  /** the lianas hung from the limbs (LOD 0): how many a limb, their length and width */
  vines: Object.freeze({ perLimb: 2, length: Object.freeze([14, 36]), width: 1.7 }),
});

/** Each LOD's detail: the trunk's sides, a limb's sides and segments, a mass's subdivisions (0 the icosahedron), and
 *  whether it stands its roots, its buttresses, its cards and its lianas, one mass a limb (`merged`) and its forks' own
 *  limbs. LOD 2 stands one mass a limb, its forks under them. */
export const GRAHT_DETAIL = Object.freeze([
  Object.freeze({
    trunkSides: 16,
    limbSides: 6,
    limbSegments: 6,
    blobSub: 1,
    roots: true,
    fins: true,
    cards: GRAHT_SHAPE.cards.lod0,
    vines: true,
    merged: false,
    forks: true,
  }),
  Object.freeze({
    trunkSides: 10,
    limbSides: 5,
    limbSegments: 4,
    blobSub: 0,
    roots: false,
    fins: true,
    cards: GRAHT_SHAPE.cards.lod1,
    vines: false,
    merged: false,
    forks: true,
  }),
  Object.freeze({
    trunkSides: 6,
    limbSides: 3,
    limbSegments: 1,
    blobSub: 0,
    roots: false,
    fins: false,
    cards: 0,
    vines: false,
    merged: true,
    forks: false,
  }),
]);

/** A seeded draw stream (mulberry32): the same numbers on every client and every run. */
export function grahtRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
/** A draw within a range. @param {() => number} r @param {ReadonlyArray<number>} ab */
const within = (r, ab) => lerp(ab[0], ab[1], r());

/** A variant's seed. */
export const grahtSeed = (variant) => (0x47524148 ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0;

/**
 * A VARIANT'S SKELETON - every number its meshes are made from, drawn once from its seed.
 * @param {number} variant 0..GRAHT_VARIANTS-1
 */
export function grahtSkeleton(variant) {
  const r = grahtRng(grahtSeed(variant)),
    S = GRAHT_SHAPE,
    T = S.trunk;
  const trunk = {
    r0: within(r, T.r0),
    rCrown: within(r, T.rCrown),
    rTop: T.rTop,
    crownFrom: within(r, T.crownFrom),
    leaderTop: within(r, T.leaderTop),
    flare: T.flare,
    flareH: T.flareH,
    sink: T.sink,
    lean: [T.lean * (r() * 2 - 1), T.lean * (r() * 2 - 1)],
    leanK: [lerp(55, 90, r()), lerp(55, 90, r())],
    leanP: [r() * 6.283, r() * 6.283],
    twist: lerp(-0.004, 0.004, r()),
    flutes: Math.round(lerp(5, 8, r())),
    flutePhase: r() * 6.283,
  };
  // the buttresses, evenly about the trunk and pushed off even
  const nFins = Math.round(within(r, S.fins.count)),
    fin0 = r() * 6.283;
  const fins = [];
  for (let k = 0; k < nFins; k++) {
    fins.push({
      angle: fin0 + (k + (r() - 0.5) * 0.55) * (6.283185307 / nFins),
      reach: within(r, S.fins.reach),
      rise: within(r, S.fins.rise),
      snake: S.fins.snake * (r() * 2 - 1),
      root: within(r, S.roots.reach),
      rootTurn: (r() - 0.5) * 0.9,
    });
  }
  // the limbs, spiralling up the crown's span; each forked twice; their masses at their ends
  const nLimbs = Math.round(within(r, S.limbs.count)),
    limb0 = r() * 6.283;
  const span = trunk.leaderTop - trunk.crownFrom;
  const limbs = [],
    blobs = [],
    vines = [];
  const blobAt = (c, limb, scaleR = 1) => {
    const rad = within(r, S.blob.r) * scaleR;
    blobs.push({ c, r: rad, squash: within(r, S.blob.squash), limb, seed: (r() * 4294967296) >>> 0 });
  };
  for (let k = 0; k < nLimbs; k++) {
    const at = lerp(S.limbs.from[0], S.limbs.from[1], (k + r() * 0.8) / nLimbs);
    const y0 = trunk.crownFrom + at * span;
    const az = limb0 + (k + (r() - 0.5) * 0.6) * (6.283185307 / nLimbs) * 2.618; // a golden turn a limb: they spiral, never stack
    const len = within(r, S.limbs.length) * (1 - 0.35 * at),
      rise = within(r, S.limbs.rise);
    const base = trunkAxis(trunk, y0);
    const h = [Math.cos(az), 0, Math.sin(az)];
    const p0 = [base[0], y0, base[2]];
    const p1 = [p0[0] + h[0] * len * 0.38, y0 + len * rise * 0.5, p0[2] + h[2] * len * 0.38];
    const p2 = [p0[0] + h[0] * len * 0.78, y0 + len * rise * 0.86, p0[2] + h[2] * len * 0.78];
    const p3 = [p0[0] + h[0] * len, y0 + len * rise, p0[2] + h[2] * len];
    const limb = { path: [p0, p1, p2, p3], r0: within(r, S.limbs.r0), r1: 0.7, az, len, forks: [] };
    for (const t of S.forks.at) {
      const ft = t + (r() - 0.5) * 0.08,
        side = r() < 0.5 ? -1 : 1;
      const faz = az + side * within(r, S.forks.turn),
        flen = len * within(r, S.forks.length),
        frise = within(r, S.forks.rise);
      const q0 = bezier(limb.path, ft),
        fh = [Math.cos(faz), 0, Math.sin(faz)];
      const q3 = [q0[0] + fh[0] * flen, q0[1] + flen * frise, q0[2] + fh[2] * flen];
      const q1 = [q0[0] + fh[0] * flen * 0.4, q0[1] + flen * frise * 0.25, q0[2] + fh[2] * flen * 0.4];
      const q2 = [q0[0] + fh[0] * flen * 0.75, q0[1] + flen * frise * 0.7, q0[2] + fh[2] * flen * 0.75];
      limb.forks.push({ path: [q0, q1, q2, q3], r0: limb.r0 * lerp(0.82, 0.62, ft), r1: 0.5, at: ft });
    }
    limbs.push(limb);
    // the masses: two at the limb's end, one over its middle, two at each fork's end
    const tip = limb.path[3];
    for (let i = 0; i < 2; i++) {
      const a = r() * 6.283,
        d = lerp(3, 11, r());
      blobAt([tip[0] + Math.cos(a) * d, tip[1] + lerp(1, 6, r()), tip[2] + Math.sin(a) * d], k, i ? 0.88 : 1.08);
    }
    const mid = bezier(limb.path, lerp(0.42, 0.6, r()));
    blobAt([mid[0], mid[1] + lerp(6, 11, r()), mid[2]], k, 0.85);
    for (const f of limb.forks) {
      const e = f.path[3];
      for (let i = 0; i < 2; i++) {
        const a = r() * 6.283,
          d = lerp(2, 9, r());
        blobAt([e[0] + Math.cos(a) * d, e[1] + lerp(1, 6, r()), e[2] + Math.sin(a) * d], k, i ? 0.8 : 0.96);
      }
    }
    for (let i = 0; i < S.vines.perLimb; i++) {
      const p = bezier(limb.path, lerp(0.3, 0.92, r()));
      vines.push({ top: [p[0], p[1] - limb.r0 * 0.5, p[2]], length: within(r, S.vines.length), turn: r() * 3.1416 });
    }
  }
  // the leader's own crown over the trunk's top
  const top = trunkAxis(trunk, trunk.leaderTop);
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.283 + i * 2.09,
      d = lerp(5, 12, r());
    blobs.push({
      c: [top[0] + Math.cos(a) * d, trunk.leaderTop + lerp(2, 10, r()), top[2] + Math.sin(a) * d],
      r: within(r, S.blob.r) * 1.05,
      squash: within(r, S.blob.squash),
      limb: -1,
      seed: (r() * 4294967296) >>> 0,
    });
  }
  let height = 0,
    crownR = 0;
  for (const b of blobs) {
    height = Math.max(height, b.c[1] + b.r * b.squash);
    crownR = Math.max(crownR, Math.hypot(b.c[0], b.c[2]) + b.r);
  }
  return { variant, trunk, fins, limbs, blobs, vines, height, crownR };
}

/** The trunk's axis at height y (its gentle lean, nothing at the ground). */
export function trunkAxis(t, y) {
  const yy = Math.max(0, y);
  return [
    t.lean[0] * (Math.sin(yy / t.leanK[0] + t.leanP[0]) - Math.sin(t.leanP[0])),
    y,
    t.lean[1] * (Math.sin(yy / t.leanK[1] + t.leanP[1]) - Math.sin(t.leanP[1])),
  ];
}
/** The trunk's radius at height y, before its flutes: the column's taper and the flare at the ground. */
export function grahtTrunkRadius(t, y) {
  const yy = Math.max(0, y);
  if (yy >= t.crownFrom) return lerp(t.rCrown, t.rTop, Math.min(1, (yy - t.crownFrom) / (t.leaderTop - t.crownFrom)));
  return t.rCrown + (t.r0 - t.rCrown) * Math.pow(1 - yy / t.crownFrom, 1.4) + t.flare * Math.exp(-yy / t.flareH);
}
/**
 * A BUTTRESS'S CROSS-SECTION at `u` (0 its foot, under the ground; 1 its top, on the trunk) - the fin's one law, the
 * mesh's and the bodies' (world/jungle/grahtOaks.js grahtBodies): its height `y`, how far its edge stands from the trunk's
 * axis (`out`), how far that edge snakes sideways (`sn` - along the fin's tangent, the share of it a point at distance d
 * takes is (d - inner) / (out - inner)), where its inner edge stands inside the trunk (`inner`), and its half thickness at
 * the trunk and at its edge (`ti`, `to`).
 * @param {any} t the skeleton's trunk @param {{ reach: number, rise: number, snake: number }} f @param {number} u
 */
export function finSection(t, f, u) {
  const y = -3 + (f.rise + 3) * u; // from under the ground at its foot to its top on the trunk
  const r0 = grahtTrunkRadius(t, y);
  const out = r0 + (f.reach - r0) * Math.pow(1 - u, 1.7);
  const sn = f.snake * Math.sin(Math.PI * Math.min(1, (1 - u) * 1.2));
  const ti = lerp(GRAHT_SHAPE.fins.thick[0], GRAHT_SHAPE.fins.thick[0] * 0.55, u) / 2;
  return { y, out, sn, inner: r0 * 0.62, ti, to: lerp(GRAHT_SHAPE.fins.thick[1], ti * 1.6, u) / 2 };
}

/** A cubic Bezier's point at t. @param {ReadonlyArray<ArrayLike<number>>} path its four points @param {number} t */
export function bezier(path, t) {
  const [a, b, c, d] = path,
    u = 1 - t,
    w0 = u * u * u,
    w1 = 3 * u * u * t,
    w2 = 3 * u * t * t,
    w3 = t * t * t;
  return [0, 1, 2].map((i) => w0 * a[i] + w1 * b[i] + w2 * c[i] + w3 * d[i]);
}
/** The trunk's surface radius at (y, angle) - its flutes and ridges over its radius. */
export function trunkSurface(t, y, a) {
  return (
    grahtTrunkRadius(t, y) *
    (1 +
      0.05 * Math.sin(t.flutes * a + t.flutePhase + y * 0.03) +
      0.025 * Math.sin(3 * a - y * 0.05 + t.flutePhase * 2))
  );
}

// ─── the mesh builder ─────────────────────────────────────────────

/** A growing flat-shaded mesh: three vertices a face (position, normal, uv), in three submeshes. */
function builder() {
  const subs = GRAHT_SUBS.map(() => ({ p: [], n: [], uv: [] }));
  const sub = (s) => subs[s];
  /** a face a, b, c (wound outward: cross(b - a, c - a) its normal) with its uvs, in submesh s */
  const tri = (s, a, b, c, ua, ub, uc) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-9)) return; // a degenerate face draws nothing
    nx /= l;
    ny /= l;
    nz /= l;
    const m = sub(s);
    m.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    m.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    m.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };
  /** a quad a b c d (in order round it, wound outward) */
  const quad = (s, a, b, c, d, ua, ub, uc, ud) => {
    tri(s, a, b, c, ua, ub, uc);
    tri(s, a, c, d, ua, uc, ud);
  };
  /** a quad a b c d wound to face along `out` whichever way round it was handed */
  const quadOut = (s, a, b, c, d, ua, ub, uc, ud, out) => {
    if (dot(cross(sub3(b, a), sub3(c, a)), out) >= 0) quad(s, a, b, c, d, ua, ub, uc, ud);
    else quad(s, a, d, c, b, ua, ud, uc, ub);
  };
  return { tri, quad, quadOut, subs };
}

/** An icosphere's unit vertices and faces, subdivided `n` times (0: the icosahedron), its faces wound outward. */
const _spheres = new Map();
export function icosphere(n) {
  if (_spheres.has(n)) return _spheres.get(n);
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map(norm);
  let f = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let k = 0; k < n; k++) {
    const mid = new Map(),
      nf = [];
    const m = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mid.has(key)) {
        mid.set(key, v.length);
        v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]));
      }
      return mid.get(key);
    };
    for (const [a, b, c] of f) {
      const ab = m(a, b),
        bc = m(b, c),
        ca = m(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = nf;
  }
  // wound outward in this frame: cross(b - a, c - a) along the vertex's own direction
  f = f.map(([a, b, c]) => {
    const A = v[a],
      B = v[b],
      C = v[c];
    const cr = cross(sub3(B, A), sub3(C, A));
    return dot(cr, A) >= 0 ? [a, b, c] : [a, c, b];
  });
  const out = { v, f };
  _spheres.set(n, out);
  return out;
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
}
function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** A mass's vertex in the tree's frame: the unit direction `d` pushed about by its own seed (`j`), its underside flattened. */
export function blobPoint(b, d, j) {
  const k = 1 + GRAHT_SHAPE.blob.jitter * j;
  const y = d[1] < 0 ? d[1] * GRAHT_SHAPE.blob.under : d[1];
  return [b.c[0] + d[0] * b.r * k, b.c[1] + y * b.r * b.squash * k, b.c[2] + d[2] * b.r * k];
}
/** A vertex's push for a mass: a hash of the mass's seed and the vertex, in [-1, 1] - the same push for a vertex every
 *  face of it shares, so the mass stays closed. */
export function blobJitter(seed, i) {
  let h = Math.imul(seed ^ Math.imul(i + 1, 0x27d4eb2d), 0x165667b1) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 2147483648 - 1;
}

/** A mass, LOD 2's: one mass standing for a limb's - their middle, their reach. */
function mergedBlobs(sk) {
  const out = [];
  const groups = new Map();
  for (const b of sk.blobs) {
    if (!groups.has(b.limb)) groups.set(b.limb, []);
    groups.get(b.limb).push(b);
  }
  for (const [limb, list] of groups) {
    const c = [0, 0, 0];
    for (const b of list) for (let i = 0; i < 3; i++) c[i] += b.c[i] / list.length;
    let reach = 0,
      squash = 0;
    for (const b of list) {
      reach = Math.max(reach, Math.hypot(b.c[0] - c[0], b.c[2] - c[2]) + b.r * 0.8);
      squash += b.squash / list.length;
    }
    out.push({ c, r: reach, squash: squash * 0.75, limb, seed: list[0].seed });
  }
  return out;
}

/**
 * A VARIANT AT A LOD - `{ positions, normals, uvs }` (f32, three vertices a face), `subs` ([first vertex, vertex count] a
 * submesh, GRAHT_SUBS' order), `skeleton`.
 * @param {number} variant @param {number} lod 0..GRAHT_LODS-1
 */
export function grahtOakMesh(variant, lod) {
  const sk = grahtSkeleton(variant),
    D = GRAHT_DETAIL[lod],
    t = sk.trunk;
  const m = builder();
  const BARK = 0,
    LEAVES = 1,
    CARDS = 2;
  // THE TRUNK: rings up its column, denser at the ground where it flares
  const heights =
    lod === 0
      ? [
          -t.sink,
          0,
          2.5,
          6,
          11,
          18,
          27,
          38,
          52,
          66,
          t.crownFrom,
          lerp(t.crownFrom, t.leaderTop, 0.35),
          lerp(t.crownFrom, t.leaderTop, 0.7),
          t.leaderTop,
        ]
      : lod === 1
        ? [-t.sink, 0, 6, 16, 34, t.crownFrom, lerp(t.crownFrom, t.leaderTop, 0.5), t.leaderTop]
        : [-t.sink, 8, t.crownFrom, t.leaderTop];
  const N = D.trunkSides;
  const ring = (y) => {
    const ax = trunkAxis(t, y),
      pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 6.283185307 + t.twist * y,
        rr = trunkSurface(t, y, a);
      pts.push([ax[0] + Math.cos(a) * rr, y, ax[2] + Math.sin(a) * rr]);
    }
    return pts;
  };
  let prev = ring(heights[0]);
  for (let j = 1; j < heights.length; j++) {
    const cur = ring(heights[j]),
      v0 = heights[j - 1] / 18,
      v1 = heights[j] / 18;
    for (let i = 0; i < N; i++) {
      const u0 = (i / N) * 4,
        u1 = ((i + 1) / N) * 4;
      const a = ((i + 0.5) / N) * 6.283185307 + t.twist * heights[j];
      m.quadOut(
        BARK,
        prev[i],
        cur[i],
        cur[i + 1],
        prev[i + 1],
        [u0, v0],
        [u0, v1],
        [u1, v1],
        [u1, v0],
        [Math.cos(a), 0, Math.sin(a)],
      ); // out of the column
    }
    prev = cur;
  }
  const topAx = trunkAxis(t, t.leaderTop),
    tip = [topAx[0], t.leaderTop + 6, topAx[2]];
  for (let i = 0; i < N; i++) m.tri(BARK, prev[i], tip, prev[i + 1], [i / N, 0], [i / N, 0.5], [(i + 1) / N, 0]);

  // THE BUTTRESSES: wedges from inside the trunk out to the foot, snaking, sunk at their ends
  if (D.fins) {
    const steps = lod === 0 ? 7 : 3;
    for (const f of sk.fins) {
      const rad = [Math.cos(f.angle), 0, Math.sin(f.angle)],
        tan = [-Math.sin(f.angle), 0, Math.cos(f.angle)];
      const sec = [];
      for (let s = 0; s <= steps; s++) {
        const { y, out, sn, inner, ti, to } = finSection(t, f, s / steps);
        const ax = trunkAxis(t, y);
        const at = (d, side, half) => [
          ax[0] + rad[0] * d + tan[0] * (side * half + ((d - inner) / Math.max(1, out - inner)) * sn),
          y,
          ax[2] + rad[2] * d + tan[2] * (side * half + ((d - inner) / Math.max(1, out - inner)) * sn),
        ];
        sec.push({ il: at(inner, -1, ti), ol: at(out, -1, to), or: at(out, 1, to), ir: at(inner, 1, ti), y, out });
      }
      for (let s = 0; s < steps; s++) {
        const a = sec[s],
          b = sec[s + 1],
          v0 = a.y / 18,
          v1 = b.y / 18,
          uo0 = a.out / 18,
          uo1 = b.out / 18;
        const nt = [-tan[0], 0, -tan[2]];
        m.quadOut(BARK, a.il, a.ol, b.ol, b.il, [0, v0], [uo0, v0], [uo1, v1], [0, v1], nt); // its left face (-tan)
        m.quadOut(BARK, a.ir, a.or, b.or, b.ir, [0, v0], [uo0, v0], [uo1, v1], [0, v1], tan); // its right face (+tan)
        m.quadOut(BARK, a.ol, a.or, b.or, b.ol, [0, v0], [0.2, v0], [0.2, v1], [0, v1], [rad[0], 0.3, rad[2]]); // its edge
      }
      // THE ROOT past its foot: a tube along the ground, half sunk, winding off the buttress's line
      if (D.roots) {
        const foot = sec[0];
        const a0 = f.angle,
          a1 = f.angle + f.rootTurn;
        const s0 = [(foot.ol[0] + foot.or[0]) / 2, 0.15, (foot.ol[2] + foot.or[2]) / 2];
        const path = [
          s0,
          [s0[0] + Math.cos(a0) * f.root * 0.4, 0.4, s0[2] + Math.sin(a0) * f.root * 0.4],
          [s0[0] + Math.cos(a1) * f.root * 0.75, 0.25, s0[2] + Math.sin(a1) * f.root * 0.75],
          [s0[0] + Math.cos(a1) * f.root, -0.6, s0[2] + Math.sin(a1) * f.root],
        ];
        tube(m, BARK, path, GRAHT_SHAPE.roots.r, 0.35, 5, 4);
      }
    }
  }
  // THE LIMBS and their forks
  for (const L of sk.limbs) {
    tube(m, BARK, L.path, L.r0, L.r1, D.limbSides, D.limbSegments);
    if (D.forks)
      for (const f of L.forks) tube(m, BARK, f.path, f.r0, f.r1, D.limbSides, Math.max(1, D.limbSegments >> 1));
  }
  // THE CROWN: its masses (LOD 2: one a limb)
  const blobs = D.merged ? mergedBlobs(sk) : sk.blobs;
  const sph = icosphere(D.blobSub);
  for (const b of blobs) {
    const pts = sph.v.map((d, i) => blobPoint(b, d, blobJitter(b.seed, i)));
    for (const [i, j, k] of sph.f) {
      const A = pts[i],
        B = pts[j],
        C = pts[k];
      m.tri(LEAVES, A, B, C, leafUv(A, B, C, A), leafUv(A, B, C, B), leafUv(A, B, C, C));
    }
    // THE CARDS: leaf sprays standing out of its rim and its underside
    if (D.cards) {
      const r = grahtRng(b.seed ^ 0x5bd1e995);
      for (let c = 0; c < D.cards; c++) {
        const az = r() * 6.283,
          el = lerp(-1.05, 0.35, r());
        const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
        const s = lerp(GRAHT_SHAPE.cards.size[0], GRAHT_SHAPE.cards.size[1], r());
        const at = blobPoint(b, d, 0.6);
        const tg = norm([-Math.sin(az), (r() - 0.5) * 0.6, Math.cos(az)]);
        const out = norm([d[0], d[1] - 0.35, d[2]]); // out of the mass and hanging a little
        const c0 = [at[0] - out[0] * s * 0.25, at[1] - out[1] * s * 0.25, at[2] - out[2] * s * 0.25];
        const P = (x, y) => [
          c0[0] + tg[0] * x * s + out[0] * y * s,
          c0[1] + tg[1] * x * s + out[1] * y * s,
          c0[2] + tg[2] * x * s + out[2] * y * s,
        ];
        m.quad(CARDS, P(-0.5, 0), P(0.5, 0), P(0.5, 1), P(-0.5, 1), [0, 0], [0.5, 0], [0.5, 1], [0, 1]); // the spray's half of the cards' picture
      }
    }
  }
  // THE LIANAS: two crossed strips from a limb to well over the floor
  if (D.vines) {
    for (const v of sk.vines) {
      const w = GRAHT_SHAPE.vines.width / 2,
        rep = v.length / 9;
      for (const a of [v.turn, v.turn + Math.PI / 2]) {
        const dx = Math.cos(a) * w,
          dz = Math.sin(a) * w;
        const t0 = v.top,
          b0 = [v.top[0], v.top[1] - v.length, v.top[2]];
        m.quad(
          CARDS,
          [b0[0] - dx, b0[1], b0[2] - dz],
          [b0[0] + dx, b0[1], b0[2] + dz],
          [t0[0] + dx, t0[1], t0[2] + dz],
          [t0[0] - dx, t0[1], t0[2] - dz],
          [0.5, 0],
          [0.75, 0],
          [0.75, rep],
          [0.5, rep],
        ); // the liana's quarter of the picture, repeated down it
      }
    }
  }
  // the three submeshes laid end to end
  const counts = m.subs.map((s) => s.p.length / 3);
  const total = counts.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(total * 3),
    normals = new Float32Array(total * 3),
    uvs = new Float32Array(total * 2);
  const subs = [];
  let at = 0;
  m.subs.forEach((s, i) => {
    positions.set(s.p, at * 3);
    normals.set(s.n, at * 3);
    uvs.set(s.uv, at * 2);
    subs.push([at, counts[i]]);
    at += counts[i];
  });
  return { positions, normals, uvs, subs, skeleton: sk, lod };
}

/** A leaf face's uv: its points on the plane its normal faces most (16 m a picture). */
function leafUv(A, B, C, P) {
  const n = cross(sub3(B, A), sub3(C, A)),
    ax = Math.abs(n[0]),
    ay = Math.abs(n[1]),
    az = Math.abs(n[2]);
  const k = 1 / 16;
  if (ay >= ax && ay >= az) return [P[0] * k, P[2] * k];
  if (ax >= az) return [P[2] * k, P[1] * k];
  return [P[0] * k, P[1] * k];
}

/** A tube of `sides` along a cubic path, its radius r0 to r1, `segs` segments, capped at its end; bark uv (12 m a
 *  picture along it). */
function tube(m, s, path, r0, r1, sides, segs) {
  const rings = [];
  let len = 0,
    last = null;
  for (let k = 0; k <= segs; k++) {
    const tt = k / segs,
      p = bezier(path, tt);
    const q = bezier(path, Math.min(1, tt + 0.01)),
      q0 = bezier(path, Math.max(0, tt - 0.01));
    const dir = norm(sub3(q, q0));
    const side = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(cross(dir, side)),
      e2 = cross(e1, dir);
    const r = lerp(r0, r1, tt);
    if (last) len += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
    last = p;
    const pts = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * 6.283185307;
      pts.push([
        p[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r,
        p[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r,
        p[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r,
      ]);
    }
    rings.push({ pts, v: len / 12, c: p });
  }
  for (let k = 0; k < segs; k++) {
    const A = rings[k],
      B = rings[k + 1];
    for (let i = 0; i < sides; i++) {
      const u0 = i / sides,
        u1 = (i + 1) / sides;
      const a = A.pts[i],
        b = B.pts[i],
        c = B.pts[i + 1],
        d = A.pts[i + 1];
      // outward: the ring's own direction from its middle
      const cr = cross(sub3(b, a), sub3(c, a)),
        mid = [(a[0] + c[0]) / 2 - A.c[0], (a[1] + c[1]) / 2 - A.c[1], (a[2] + c[2]) / 2 - A.c[2]];
      if (dot(cr, mid) >= 0) m.quad(s, a, b, c, d, [u0, A.v], [u0, B.v], [u1, B.v], [u1, A.v]);
      else m.quad(s, a, d, c, b, [u0, A.v], [u1, A.v], [u1, B.v], [u0, B.v]);
    }
  }
  const E = rings[segs],
    end = bezier(path, 1);
  for (let i = 0; i < sides; i++) {
    const a = E.pts[i],
      b = E.pts[i + 1];
    const cr = cross(sub3(b, a), sub3(end, a)),
      out = sub3(bezier(path, 1), bezier(path, 0.98));
    if (dot(cr, out) >= 0) m.tri(s, a, b, end, [0, E.v], [0.1, E.v], [0.05, E.v + 0.1]);
    else m.tri(s, a, end, b, [0, E.v], [0.05, E.v + 0.1], [0.1, E.v]);
  }
}

// @ts-check
// CAPITAL-TREES (2026-10-27, bible/03-World/Arena-Provinces.md CAPITAL-TREES; KPbICA, forwarded by the owner: "The main
// trees in Falinesti and Mournhold should get some love. They are too draftish for now") - THE CAPITALS' TREES' KIT: the
// shapes Falinesti's Great Graht-Oak (world/capitalFalinesti.js) and Mournhold's garden trees (world/capitalMournhold.js)
// are built of, on the port's MeshBuilder (world/detStandIns.js), in metres, y up. No game data.
//
// The drafts they replace were a tree of the capitals' first shapes (world/capitalShapes.js): a rough column for a
// trunk, straight tubes for its limbs and roots, and its leaves balls of ten sides by six. These are the shapes the
// forests' own graht-oaks are made of (GRAHT1, world/jungle/grahtOakMesh.js - its Bezier, its icosphere and its masses'
// seeded push are borrowed, ONE MEMBER, ONE EXPORT), at a capital's measure:
//   - a COLUMN of rings, fluted (its furrows and ridges a vertex's own radius), twisting a little as it rises;
//   - a BUTTRESS, a wedge of living wood from inside the trunk to its foot under the ground, thick at the trunk and thin at
//     its edge, its top falling away from the trunk, its edge snaking;
//   - a LIMB, a tube along a cubic Bezier, its rings carried along it without a twist, tapering to a point;
//   - a MASS of leaves, an icosphere pushed about by its seed, its underside flattened as a crown's is;
//   - its CARDS, sprays cut by their picture's alpha standing out of a mass's rim and underside (the game's own way with
//     a tree's leaves, a flat), and a LIANA, two crossed strips hung from a limb.
// Every face is flat-shaded - both halves of a quad on the quad's own normal, turned out of its shape - so the low-poly
// look is the capitals' (and vanillaTexels lays a quad on one plane, AUDIT TESA II C14).
import { bezier, icosphere, blobJitter, grahtRng } from './jungle/grahtOakMesh.js';

/** @typedef {number[]} V3 */
const sub = (/** @type {V3} */ a, /** @type {V3} */ b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (/** @type {V3} */ a, /** @type {V3} */ b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (/** @type {V3} */ a, /** @type {number} */ k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (/** @type {V3} */ a, /** @type {V3} */ b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (/** @type {V3} */ a, /** @type {V3} */ b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (/** @type {V3} */ a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ t) => a + (b - a) * t;
export { bezier, grahtRng as treeRng };

/** A seeded draw in [lo, hi] off a stream. @param {() => number} r @param {ReadonlyArray<number>} ab */
export const within = (r, ab) => lerp(ab[0], ab[1], r());

/**
 * A FACET: the quad a b c d (in order round its edge) on its own normal - the sum of its two halves' - turned away from
 * `from`. `uv` its corners' coordinates (the stand-in view's; vanillaTexels lays every solid face again).
 */
export function facet(mb, tex, a, b, c, d, from, uv = undefined) {
  let n = unit(add(cross(sub(b, a), sub(c, a)), cross(sub(c, a), sub(d, a))));
  const mid = scale(add(add(a, b), add(c, d)), 0.25);
  if (dot(n, sub(mid, from)) < 0) n = scale(n, -1);
  mb.quad(tex, a, b, c, d, n, uv);
}
/** A flat-shaded triangle turned away from `from`. */
export function facet3(mb, tex, a, b, c, from) {
  let n = unit(cross(sub(b, a), sub(c, a)));
  if (dot(n, sub(scale(add(add(a, b), c), 1 / 3), from)) < 0) n = scale(n, -1);
  mb.tri(tex, a, b, c, n);
}

/**
 * A COLUMN: rings at `levels` ([y, r] from its foot up), `sides` corners a ring, each corner's radius its ring's times
 * `flute(i, y)` (a furrow under 1, a ridge over), the whole turned `twist` radians a metre as it rises about its `axis(y)`
 * ([x, z]); its top closed to a point `crown` metres over its last ring (none at 0). Answers its rings' corners.
 * @param {any} mb @param {any} tex @param {ReadonlyArray<ReadonlyArray<number>>} levels
 * @param {{ sides: number, flute?: (i: number, y: number) => number, twist?: number, axis?: (y: number) => number[], crown?: number }} o
 */
export function column(mb, tex, levels, { sides, flute = () => 1, twist = 0, axis = () => [0, 0], crown = 0 }) {
  const rings = levels.map(([y, r]) => {
    const [ax, az] = axis(y);
    return Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 + twist * y,
        rr = r * flute(i, y);
      return [ax + Math.cos(a) * rr, y, az + Math.sin(a) * rr];
    });
  });
  for (let l = 0; l + 1 < rings.length; l++) {
    const y = (levels[l][0] + levels[l + 1][0]) / 2,
      [ax, az] = axis(y),
      from = [ax, y, az];
    for (let i = 0; i < sides; i++)
      facet(mb, tex, rings[l][i], rings[l][(i + 1) % sides], rings[l + 1][(i + 1) % sides], rings[l + 1][i], from);
  }
  if (crown > 0) {
    const top = levels[levels.length - 1][0],
      [ax, az] = axis(top),
      tip = [ax, top + crown, az],
      last = rings[rings.length - 1];
    for (let i = 0; i < sides; i++) facet3(mb, tex, last[i], last[(i + 1) % sides], tip, [ax, top, az]);
  }
  return rings;
}

/**
 * A LIMB: a tube of `sides` along the cubic Bezier `path`, its radius `r0` at its start to `r1` at its end (or `radius(t)`),
 * `segs` rings carried along it without a twist (each ring's frame the last one's, turned onto the path), closed to a
 * point `tip` metres past its end (a flat cap at 0). Answers its rings' middles.
 * @param {any} mb @param {any} tex @param {ReadonlyArray<ReadonlyArray<number>>} path
 * @param {number} r0 @param {number} r1
 * @param {{ sides?: number, segs?: number, tip?: number, radius?: (t: number) => number }} [o]
 */
export function tube(mb, tex, path, r0, r1, { sides = 8, segs = 6, tip = 0, radius = null } = {}) {
  const rings = [];
  let e1 = null;
  for (let k = 0; k <= segs; k++) {
    const t = k / segs,
      p = bezier(path, t),
      dir = unit(sub(bezier(path, Math.min(1, t + 0.01)), bezier(path, Math.max(0, t - 0.01))));
    // the ring's frame: the last ring's first axis, laid onto the plane square to the path (no twist down the limb)
    const ref = e1 ?? (Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]);
    e1 = unit(sub(ref, scale(dir, dot(ref, dir))));
    const e2 = cross(dir, e1),
      r = radius ? radius(t) : lerp(r0, r1, t);
    rings.push({
      c: p,
      dir,
      pts: Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return add(p, add(scale(e1, Math.cos(a) * r), scale(e2, Math.sin(a) * r)));
      }),
    });
  }
  for (let k = 0; k < segs; k++) {
    const A = rings[k],
      B = rings[k + 1],
      from = scale(add(A.c, B.c), 0.5);
    for (let i = 0; i < sides; i++)
      facet(mb, tex, A.pts[i], A.pts[(i + 1) % sides], B.pts[(i + 1) % sides], B.pts[i], from);
  }
  const E = rings[segs],
    end = add(E.c, scale(E.dir, tip));
  for (let i = 0; i < sides; i++) facet3(mb, tex, E.pts[i], E.pts[(i + 1) % sides], end, sub(E.c, scale(E.dir, 1)));
  return rings.map((g) => g.c);
}

/**
 * A BUTTRESS of living wood at `angle` about (x, z), from inside its trunk (`inner` metres from the axis) to its `reach`
 * from it, where it goes under the ground `sink` deep: its top `top` metres up at the trunk falling to its foot as
 * (1 - s)^1.6 (s its share of the way out), `thick` [at the trunk, at its edge] across, its edge snaking `snake` metres
 * to one side; `steps` sections. Its two faces and its top; nothing under the ground, nothing inside the trunk.
 * Answers its foot [x, z] and its top law (the height of its top `d` metres from the axis).
 * @param {any} mb @param {any} tex
 * @param {{ x?: number, z?: number, angle: number, inner: number, reach: number, top: number, sink?: number, thick: ReadonlyArray<number>, snake?: number, steps?: number }} o
 */
export function buttress(mb, tex, { x = 0, z = 0, angle, inner, reach, top, sink = 2, thick, snake = 0, steps = 8 }) {
  const rad = [Math.cos(angle), 0, Math.sin(angle)],
    tan = [-Math.sin(angle), 0, Math.cos(angle)];
  const topAt = (s) => top * Math.pow(1 - s, 1.6) - sink * s;
  const sec = [];
  for (let k = 0; k <= steps; k++) {
    const s = k / steps,
      d = lerp(inner, reach, s),
      t = lerp(thick[0], thick[1], s) / 2,
      sn = snake * Math.sin(Math.PI * Math.min(1, s * 1.15));
    const P = (side, y) => [x + rad[0] * d + tan[0] * (side * t + sn), y, z + rad[2] * d + tan[2] * (side * t + sn)];
    sec.push({
      lo: [P(-1, -sink), P(1, -sink)],
      hi: [P(-1, Math.max(-sink, topAt(s))), P(1, Math.max(-sink, topAt(s)))],
      d,
    });
  }
  for (let k = 0; k < steps; k++) {
    const A = sec[k],
      B = sec[k + 1];
    for (const side of [0, 1])
      facet(mb, tex, A.lo[side], B.lo[side], B.hi[side], A.hi[side], [
        x + (rad[0] * (A.d + B.d)) / 2 + tan[0] * (side ? -50 : 50),
        0,
        z + (rad[2] * (A.d + B.d)) / 2 + tan[2] * (side ? -50 : 50),
      ]);
    facet(mb, tex, A.hi[0], B.hi[0], B.hi[1], A.hi[1], [
      x + (rad[0] * (A.d + B.d)) / 2,
      -1e3,
      z + (rad[2] * (A.d + B.d)) / 2,
    ]); // its top, facing up and out
  }
  return {
    foot: [x + rad[0] * reach, z + rad[2] * reach],
    topAt: (/** @type {number} */ d) => topAt(Math.min(1, Math.max(0, (d - inner) / (reach - inner)))),
  };
}

/**
 * A MASS OF LEAVES at `c`: an icosphere subdivided `detail` times, radius `r`, `squash` as tall, its underside flattened
 * to `under` of that, every corner pushed out or in by up to `push` of its radius by its seed (the push a corner's own,
 * so the mass stays closed). Answers the mass, its `point(d, j)` the surface along unit direction d pushed by j.
 * @param {any} mb @param {any} tex @param {V3} c @param {number} r
 * @param {{ squash?: number, under?: number, push?: number, detail?: number, seed?: number }} [o]
 */
export function mass(mb, tex, c, r, { squash = 0.5, under = 0.62, push = 0.14, detail = 1, seed = 1 } = {}) {
  const point = (/** @type {V3} */ d, /** @type {number} */ j) => {
    const k = 1 + push * j,
      y = d[1] < 0 ? d[1] * under : d[1];
    return [c[0] + d[0] * r * k, c[1] + y * r * squash * k, c[2] + d[2] * r * k];
  };
  const sph = icosphere(detail),
    pts = sph.v.map((d, i) => point(d, blobJitter(seed >>> 0, i)));
  for (const [i, j, k] of sph.f) facet3(mb, tex, pts[i], pts[j], pts[k], c);
  return { c, r, squash, under, seed, point, faces: sph.f.length };
}

/**
 * A MASS'S CARDS: `n` sprays standing out of its rim and its underside (their elevations `elev` [lo, hi] radians), each
 * a card `size` [lo, hi] metres tall and `aspect` of that wide, its base a share `base` of it inside the mass, hanging
 * `hang` out of the straight; both its faces drawn (a flat is seen from either side), its picture's columns `u` [u0, u1],
 * v 0 at its base; `crossed`, each spray a second card turned a right angle about its length (a spray seen from its
 * side shows that one's face, never a lone card's edge - a bright line across a crown). A spray `keep` refuses (handed
 * a card's four corners, either card's) is not hung - one that would stand in a house or over a deck. Answers how many
 * cards it hung.
 * @param {any} mb @param {any} tex @param {{ point: Function, seed: number }} m
 * @param {{ n: number, size: ReadonlyArray<number>, aspect?: number, elev?: ReadonlyArray<number>, hang?: number, base?: number, u?: ReadonlyArray<number>, seed?: number, crossed?: boolean, keep?: (corners: number[][]) => boolean }} o
 */
export function cards(
  mb,
  tex,
  m,
  {
    n,
    size,
    aspect = 1,
    elev = [-1.05, 0.35],
    hang = 0.35,
    base = 0.28,
    u = [0, 1],
    seed = 0,
    crossed = false,
    keep = null,
  },
) {
  const r = grahtRng((m.seed ^ 0x5bd1e995 ^ seed) >>> 0);
  let hung = 0;
  for (let i = 0; i < n; i++) {
    const az = r() * Math.PI * 2,
      el = within(r, elev),
      s = within(r, size),
      tilt = (r() - 0.5) * 0.6;
    const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const at = m.point(d, 0.6),
      out = unit([d[0], d[1] - hang, d[2]]),
      t0 = [-Math.sin(az), tilt, Math.cos(az)],
      tg = unit(sub(t0, scale(out, dot(t0, out)))); // square to its length: its texels square
    const c0 = sub(at, scale(out, s * base));
    const spray = (crossed ? [tg, unit(cross(out, tg))] : [tg]).map((side) => {
      const P = (/** @type {number} */ x, /** @type {number} */ y) =>
        add(c0, add(scale(side, x * s * aspect), scale(out, y * s)));
      return { side, corners: [P(-0.5, 0), P(0.5, 0), P(0.5, 1), P(-0.5, 1)] };
    });
    if (keep && !spray.every(({ corners }) => keep(corners))) continue; // a spray hung whole or not at all
    for (const { side, corners } of spray) {
      mb.sheet(tex, corners[0], corners[1], corners[2], corners[3], unit(cross(side, out)), [
        [u[0], 0],
        [u[1], 0],
        [u[1], 1],
        [u[0], 1],
      ]);
      hung++;
    }
  }
  return hung;
}

/**
 * A LIANA hung from `top`: two crossed strips `width` across and `length` long, turned `turn` radians, its picture's
 * columns `u` [u0, u1] repeated down it every `per` metres (the picture's liana tiles down).
 * @param {any} mb @param {any} tex @param {V3} top @param {number} length @param {number} width @param {number} turn
 * @param {{ u: ReadonlyArray<number>, per: number }} o
 */
export function liana(mb, tex, top, length, width, turn, { u, per }) {
  const rep = length / per;
  for (const a of [turn, turn + Math.PI / 2]) {
    const dx = (Math.cos(a) * width) / 2,
      dz = (Math.sin(a) * width) / 2,
      b = [top[0], top[1] - length, top[2]];
    mb.sheet(
      tex,
      [b[0] - dx, b[1], b[2] - dz],
      [b[0] + dx, b[1], b[2] + dz],
      [top[0] + dx, top[1], top[2] + dz],
      [top[0] - dx, top[1], top[2] - dz],
      unit([-dz, 0, dx]),
      [
        [u[0], 0],
        [u[1], 0],
        [u[1], rep],
        [u[0], rep],
      ],
    );
  }
}

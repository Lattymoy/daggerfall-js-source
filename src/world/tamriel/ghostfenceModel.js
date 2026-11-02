// @ts-check
// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): its pylons and Ghostgate as models the pixel build stands
// (scenes/ghostfenceBuild.js) - metres from a foot, x along the fence, z across it, y up - their solids,
// and their pictures, painted here: GHOSTFENCE_ARCHIVE's records are the port's own, no Daggerfall art. A face winds so
// its cross product points out of its solid (the meshes' law, render/renderer.js HANDEDNESS). Pure.
import { GHOSTGATE_HALF } from './ghostfence.js';

/** The pseudo-archive the fence's pictures go up under, and its records. */
export const GHOSTFENCE_ARCHIVE = 38331;
export const GF_RECORD = Object.freeze({ stone: 0, orb: 1 });

/** THE PYLON, metres over its foot: sunk `sink` under it; a plinth (half-widths at its foot and top, its top, its cap's
 *  half-width and rise); an eight-sided shaft (its foot, top, radii) banded at `band`; a collar flaring to `collar.r`;
 *  four horns curling in from it to `horns.tip`; and the orb they hold, its own light (the ancestors' spirit, UESP). */
export const PYLON = Object.freeze({
  sink: 3,
  plinth: Object.freeze([2.4, 2.1]),
  plinthTop: 1.6,
  cap: Object.freeze([2.3, 0.5]),
  shaft: Object.freeze({ from: 2.1, to: 20, r: Object.freeze([1.25, 0.8]), sides: 8 }),
  band: Object.freeze({ at: 11, half: 0.4, r: 1.15 }),
  collar: Object.freeze({ to: 21.4, r: 1.6, rim: 0.6 }),
  horns: Object.freeze({
    base: 1.2,
    mid: Object.freeze([1.6, 25.2]),
    tip: Object.freeze([0.3, 28.6]),
    thick: Object.freeze([0.35, 0.2]),
  }),
  orb: Object.freeze({ at: 24.8, r: 1.25 }),
});
/** THE CURTAIN between two pylons, metres over their feet: from under the ground to under the collar. */
export const CURTAIN = Object.freeze({ from: -4, to: 20 });
/** GHOSTGATE (UESP: the Tower of Dawn and the Tower of Dusk either side of the gate): two towers `half` along the fence
 *  from its middle to their outer faces, the passage between them `passage` either side of it, their half-depth across
 *  the fence, their height and cornice, their stepped tops (half-width at foot and top, rise), the lintel over the
 *  passage (its foot and top) and an orb on each tower. */
export const GHOSTGATE = Object.freeze({
  sink: 8,
  half: GHOSTGATE_HALF,
  passage: 5,
  depth: 6,
  height: 30,
  cornice: 1.5,
  top: Object.freeze([5, 3, 5.5]),
  lintel: Object.freeze([12, 17]),
  orb: Object.freeze({ over: 1.6, r: 1.6 }),
});

/** A model under construction: one list of corners, an index list per picture. */
function builder() {
  const pos = [],
    nrm = [],
    uv = [],
    groups = new Map();
  const tri = (rec, ...ix) => (groups.get(rec) ?? groups.set(rec, []).get(rec)).push(...ix);
  const vert = (p, n, t) => {
    pos.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
    uv.push(t[0], t[1]);
    return pos.length / 3 - 1;
  };
  /** A flat face of 3 or 4 corners, wound out from `inside` (a point within its solid), its picture's u, v per corner. */
  const face = (rec, pts, uvs, inside) => {
    const [a, b, c] = pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = pts.reduce(
      (s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length],
      [0, 0, 0],
    );
    let order = pts.map((_, i) => i);
    if ((m[0] - inside[0]) * n[0] + (m[1] - inside[1]) * n[1] + (m[2] - inside[2]) * n[2] < 0) {
      order = order.reverse();
      n = n.map((x) => -x);
    }
    const l = Math.hypot(n[0], n[1], n[2]) || 1,
      nn = [n[0] / l, n[1] / l, n[2] / l];
    const ix = order.map((i) => vert(pts[i], nn, uvs[i]));
    tri(rec, ix[0], ix[1], ix[2]);
    if (ix.length === 4) tri(rec, ix[0], ix[2], ix[3]);
  };
  /** A frustum round the y axis at (cx, cz): `sides` faces from radius r0 at y0 to r1 at y1, turned by `turn` of a side;
   *  its top and foot capped when asked. */
  const frustum = (rec, { cx = 0, cz = 0, sides, r0, r1, y0, y1, turn = 0.5, top = false, foot = false }) => {
    const at = (k, r, y) => {
      const a = ((k + turn) / sides) * 2 * Math.PI;
      return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
    };
    const inside = [cx, (y0 + y1) / 2, cz];
    const side = 2 * r0 * Math.sin(Math.PI / sides);
    for (let k = 0; k < sides; k++) {
      face(
        rec,
        [at(k, r0, y0), at(k + 1, r0, y0), at(k + 1, r1, y1), at(k, r1, y1)],
        [
          [(k * side) / 2, y0 / 2],
          [((k + 1) * side) / 2, y0 / 2],
          [((k + 1) * side) / 2, y1 / 2],
          [(k * side) / 2, y1 / 2],
        ],
        inside,
      );
    }
    const cap = (r, y, below) => {
      const c = [cx, y, cz],
        ins = [cx, y + (below ? 1 : -1), cz];
      for (let k = 0; k < sides; k++) {
        const p = at(k, r, y),
          q = at(k + 1, r, y);
        face(
          rec,
          [c, p, q],
          [
            [cx / 2, cz / 2],
            [p[0] / 2, p[2] / 2],
            [q[0] / 2, q[2] / 2],
          ],
          ins,
        );
      }
    };
    if (top) cap(r1, y1, false);
    if (foot) cap(r0, y0, true);
  };
  /** A box, x0..x1 by y0..y1 by z0..z1. */
  const box = (rec, x0, x1, y0, y1, z0, z1) => {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      s = 0.5;
    const P = (x, y, z) => [x, y, z];
    face(
      rec,
      [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
      [
        [x0 * s, y0 * s],
        [x1 * s, y0 * s],
        [x1 * s, y1 * s],
        [x0 * s, y1 * s],
      ],
      c,
    );
    face(
      rec,
      [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
      [
        [x0 * s, y0 * s],
        [x1 * s, y0 * s],
        [x1 * s, y1 * s],
        [x0 * s, y1 * s],
      ],
      c,
    );
    face(
      rec,
      [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)],
      [
        [z0 * s, y0 * s],
        [z1 * s, y0 * s],
        [z1 * s, y1 * s],
        [z0 * s, y1 * s],
      ],
      c,
    );
    face(
      rec,
      [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)],
      [
        [z0 * s, y0 * s],
        [z1 * s, y0 * s],
        [z1 * s, y1 * s],
        [z0 * s, y1 * s],
      ],
      c,
    );
    face(
      rec,
      [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
      [
        [x0 * s, z0 * s],
        [x1 * s, z0 * s],
        [x1 * s, z1 * s],
        [x0 * s, z1 * s],
      ],
      c,
    );
    face(
      rec,
      [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
      [
        [x0 * s, z0 * s],
        [x1 * s, z0 * s],
        [x1 * s, z1 * s],
        [x0 * s, z1 * s],
      ],
      c,
    );
  };
  /** A ball of radius r at c, its normals its own (smooth), `around` by `up`. */
  const ball = (rec, c, r, around = 10, up = 6) => {
    const base = pos.length / 3;
    for (let j = 0; j <= up; j++) {
      const t = (j / up) * Math.PI,
        y = Math.cos(t),
        s = Math.sin(t);
      for (let i = 0; i <= around; i++) {
        const a = (i / around) * 2 * Math.PI,
          n = [s * Math.cos(a), y, s * Math.sin(a)];
        vert([c[0] + r * n[0], c[1] + r * n[1], c[2] + r * n[2]], n, [i / around, j / up]);
      }
    }
    for (let j = 0; j < up; j++)
      for (let i = 0; i < around; i++) {
        const a = base + j * (around + 1) + i,
          b = a + 1,
          d = a + around + 1,
          e = d + 1;
        tri(rec, a, b, d);
        tri(rec, b, e, d); // out of the ball: the rows run down from its top, the columns round toward +z
      }
  };
  /** The model in meshReader's shape: one picture a sub-mesh, in GF_RECORD's order. */
  const done = () => {
    const indices = [],
      subMeshes = [];
    for (const rec of [...groups.keys()].sort((a, b) => a - b)) {
      const g = groups.get(rec);
      subMeshes.push({
        textureArchive: GHOSTFENCE_ARCHIVE,
        textureRecord: rec,
        startIndex: indices.length,
        primitiveCount: g.length / 3,
      });
      indices.push(...g);
    }
    return {
      positions: new Float32Array(pos),
      normals: new Float32Array(nrm),
      uvs: new Float32Array(uv),
      indices: new Uint32Array(indices),
      subMeshes,
    };
  };
  return { face, frustum, box, ball, done };
}

/** THE PYLON'S MODEL (PYLON), its stone and its orb. Made once. */
export const pylonModel = (() => {
  let m = null;
  return () => {
    if (m) return m;
    const b = builder(),
      S = GF_RECORD.stone,
      P = PYLON;
    b.frustum(S, {
      sides: 4,
      r0: P.plinth[0] * Math.SQRT2,
      r1: P.plinth[1] * Math.SQRT2,
      y0: -P.sink,
      y1: P.plinthTop,
      turn: 0.5,
    });
    b.frustum(S, {
      sides: 4,
      r0: P.cap[0] * Math.SQRT2,
      r1: P.cap[0] * Math.SQRT2,
      y0: P.plinthTop,
      y1: P.plinthTop + P.cap[1],
      turn: 0.5,
      top: true,
      foot: true,
    });
    b.frustum(S, { sides: P.shaft.sides, r0: P.shaft.r[0], r1: P.shaft.r[1], y0: P.shaft.from, y1: P.shaft.to });
    const rAt = (y) =>
      P.shaft.r[0] + (P.shaft.r[1] - P.shaft.r[0]) * ((y - P.shaft.from) / (P.shaft.to - P.shaft.from));
    b.frustum(S, {
      sides: P.shaft.sides,
      r0: P.band.r,
      r1: P.band.r,
      y0: P.band.at - P.band.half,
      y1: P.band.at + P.band.half,
      top: true,
      foot: true,
    });
    b.frustum(S, { sides: P.shaft.sides, r0: rAt(P.shaft.to), r1: P.collar.r, y0: P.shaft.to, y1: P.collar.to });
    b.frustum(S, {
      sides: P.shaft.sides,
      r0: P.collar.r,
      r1: P.collar.r * 0.94,
      y0: P.collar.to,
      y1: P.collar.to + P.collar.rim,
      top: true,
    });
    const H = P.horns,
      y0 = P.collar.to + P.collar.rim;
    for (const [sx, sz] of [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      // a horn: two tapered four-sided runs, out and up to its bend, then in to its tip over the orb
      const pt = (r, y) => [(sx * r) / Math.SQRT2, y, (sz * r) / Math.SQRT2];
      const run = (a, b2, ta, tb) => {
        const ax = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]],
          al = Math.hypot(...ax);
        const side = Math.abs(ax[1]) / al > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const u = [
            ax[1] * side[2] - ax[2] * side[1],
            ax[2] * side[0] - ax[0] * side[2],
            ax[0] * side[1] - ax[1] * side[0],
          ],
          ul = Math.hypot(...u);
        const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]],
          wl = Math.hypot(...w);
        const ring = (c, t) =>
          [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
          ].map(([p, q]) => [0, 1, 2].map((k) => c[k] + (u[k] / ul) * p * t + (w[k] / wl) * q * t));
        const A = ring(a, ta),
          B = ring(b2, tb),
          mid = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (a[2] + b2[2]) / 2];
        for (let k = 0; k < 4; k++)
          b.face(
            S,
            [A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]],
            [
              [0, 0],
              [0.5, 0],
              [0.5, al / 2],
              [0, al / 2],
            ],
            mid,
          );
        b.face(
          S,
          B,
          [
            [0, 0],
            [0.5, 0],
            [0.5, 0.5],
            [0, 0.5],
          ],
          a,
        );
      };
      run(pt(H.base, y0), pt(H.mid[0], H.mid[1]), H.thick[0], H.thick[1]);
      run(pt(H.mid[0], H.mid[1]), pt(H.tip[0], H.tip[1]), H.thick[1], 0.04);
    }
    b.ball(GF_RECORD.orb, [0, P.orb.at, 0], P.orb.r);
    return (m = b.done());
  };
})();

/** THE PYLON'S SOLID: its plinth and its shaft to the collar, two boxes (the horns and the orb overhead). */
export const pylonSolid = (() => {
  let m = null;
  return () => {
    if (m) return m;
    const b = builder(),
      P = PYLON;
    b.box(0, -P.cap[0], P.cap[0], -P.sink, P.plinthTop + P.cap[1], -P.cap[0], P.cap[0]);
    const r = P.shaft.r[0] * Math.cos(Math.PI / P.shaft.sides);
    b.box(0, -r, r, P.plinthTop, P.collar.to + P.collar.rim, -r, r);
    return (m = b.done());
  };
})();

/** A PYLON'S FOOTING (AUDIT RED-MOUNTAIN N4: seated on its lowest ground, a pylon on a steep slope was buried uphill to
 *  24 m): the plinth's foot carried down `depth` metres under its sunk foot, to the lowest ground under it - its model
 *  and its solid, one box each. */
export function pylonFooting(depth) {
  const P = PYLON,
    w = P.plinth[0],
    y1 = -P.sink + 0.25,
    y0 = -P.sink - depth;
  const m = builder(),
    s = builder();
  m.box(GF_RECORD.stone, -w, w, y0, y1, -w, w);
  s.box(0, -w, w, y0, y1, -w, w);
  return { model: m.done(), solid: s.done() };
}

/** GHOSTGATE'S MODEL (GHOSTGATE): its two towers, their cornices and stepped tops, the lintel, and an orb on each. */
export const ghostgateModel = (() => {
  let m = null;
  return () => {
    if (m) return m;
    const b = builder(),
      S = GF_RECORD.stone,
      G = GHOSTGATE;
    for (const s of [-1, 1]) {
      const x0 = s * G.passage,
        x1 = s * G.half,
        cx = (x0 + x1) / 2,
        half = Math.abs(x1 - x0) / 2;
      b.box(S, Math.min(x0, x1), Math.max(x0, x1), -G.sink, G.height, -G.depth, G.depth);
      b.box(S, cx - half - 0.4, cx + half + 0.4, G.height, G.height + G.cornice, -G.depth - 0.4, G.depth + 0.4);
      const y = G.height + G.cornice;
      b.frustum(S, {
        cx,
        sides: 4,
        r0: G.top[0] * Math.SQRT2,
        r1: G.top[1] * Math.SQRT2,
        y0: y,
        y1: y + G.top[2],
        turn: 0.5,
        top: true,
      });
      b.ball(GF_RECORD.orb, [cx, y + G.top[2] + G.orb.over, 0], G.orb.r);
    }
    b.box(S, -G.passage, G.passage, G.lintel[0], G.lintel[1], -G.depth * 0.7, G.depth * 0.7);
    return (m = b.done());
  };
})();

/** GHOSTGATE'S SOLID: its towers and the lintel (the passage under it open). */
export const ghostgateSolid = (() => {
  let m = null;
  return () => {
    if (m) return m;
    const b = builder(),
      G = GHOSTGATE;
    for (const s of [-1, 1])
      b.box(
        0,
        Math.min(s * G.passage, s * G.half),
        Math.max(s * G.passage, s * G.half),
        -G.sink,
        G.height + G.cornice,
        -G.depth,
        G.depth,
      );
    b.box(0, -G.passage, G.passage, G.lintel[0], G.lintel[1], -G.depth * 0.7, G.depth * 0.7);
    return (m = b.done());
  };
})();

/** A texel's hash, 0..1 (its picture's own grain, the same on every client). */
const grain = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** THE FENCE'S PICTURES (RGBA, top row first, as a PNG decodes): the stone - dark basalt laid in courses with a paler
 *  seam, 64 x 64 - and the orb, 16 x 16, the spirit's pale green fading to its edge. */
export function ghostfencePictures() {
  const W = 64,
    stone = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4,
        n = 0.6 * grain(x, y, 1) + 0.4 * grain(x >> 2, y >> 2, 2);
      const joint = y % 16 === 0 || (x + ((y >> 4) & 1) * 16) % 32 === 0;
      const k = (joint ? 0.62 : 0.85 + 0.3 * n) * (1 - 0.08 * (((x >> 3) + (y >> 3)) & 1));
      stone[o] = Math.round(58 * k);
      stone[o + 1] = Math.round(50 * k);
      stone[o + 2] = Math.round(50 * k);
      stone[o + 3] = 255;
    }
  const O = 16,
    orb = new Uint8Array(O * O * 4);
  for (let y = 0; y < O; y++)
    for (let x = 0; x < O; x++) {
      const o = (y * O + x) * 4,
        d = Math.min(1, Math.hypot(x - 7.5, y - 7.5) / 9),
        k = 1 - 0.45 * d;
      orb[o] = Math.round(176 * k);
      orb[o + 1] = Math.round(255 * k);
      orb[o + 2] = Math.round(226 * k);
      orb[o + 3] = 255;
    }
  return { stone: { width: W, height: W, data: stone }, orb: { width: O, height: O, data: orb } };
}

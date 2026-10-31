// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-LOOK (bible/03-World/Roads.md ROAD-LOOK) - A BRIDGE'S MESH, made on the page's thread from the kernel's answer
// (world/road/roadBridges.js bridgesOf, terrainGen.js `bridges`) in its pixel's own frame: metres, x east, y up, z north.
//
// WHY THE PORT'S OWN. Daggerfall stands no bridge over a river in the open: its exteriors have no rivers (Basic Roads'
// are painted water, crossed at grade), and ARCH3D's long pieces are the castles' gatehouses (725, a ramp up a keep's
// wall) and the dungeons' (62031, a rope bridge 2.4 m wide over a pit; 70500-70700, corridor spans) - read off the
// freeware's ARCH3D and its blocks, none a road's bridge. The capitals' bridges are the port's (world/capitalImperial.js
// Talos Bridge, world/capitalAlinor.js Alinor's): these are built of the same kit (the MeshBuilder, the capitals'
// pictures at vanilla's texel density - world/capitalModels.js vanillaTexels) - a road's of the bridges' stone
// (CAPITAL_ART.bridgeStone) on arches between piers, a track's of timber (CAPITAL_ART.timber) on trestles.
//
// THE SHAPE (roadBridges.js bridgeShape's numbers): along the road's line `s` (0 at the crossing) and across it `n`, the
// deck stands at `deck` from `-abut` to `abut` and comes down its ramps to the river's level at `+-reach`; the water's
// length (`-half` to `half`) is cut into openings no longer than `span` with `pier`-thick piers between; a road's arches
// spring a little over the water and rise to `clearance` under the deck; its walls and piers stand `foot` into the
// ground and the river's bed, so the bridge never floats where the bank falls under the river's level. Every face is in
// the collider: the deck and the ramps are walked, the parapets and rails stop a body and a horse.
// ═══════════════════════════════════════════════════════════════════
import { MeshBuilder } from '../detStandIns.js';
import { art, CAPITAL_ART } from '../capitalShapes.js';
import { vanillaTexels } from '../capitalModels.js';
import { BRIDGE, bridgeFrame } from './roadBridges.js';

const STONE = art(CAPITAL_ART.bridgeStone),
  TIMBER = art(CAPITAL_ART.timber);
/** The arches' springing over the water, metres. */
export const SPRING = 0.4;
/** A road's arch drawn in this many straight runs. */
const ARCH_STEPS = 8;

/** The deck's top at `s` along the line: level on its length, its ramps down to the river's level past the abutments. */
export function deckTop(b, s) {
  const k = b.kind === 'road' ? BRIDGE.road : BRIDGE.track,
    a = Math.abs(s);
  if (a <= b.abut) return b.deck;
  if (a >= b.reach) return b.level;
  return b.deck - (a - b.abut) / k.ramp;
}

/** The openings over the water: `[from, to]` along the line, no longer than the kind's span, its piers between. */
export function openings(b) {
  const k = b.kind === 'road' ? BRIDGE.road : BRIDGE.track,
    L = 2 * b.half;
  const n = Math.max(1, Math.ceil((L + k.pier) / (k.span + k.pier))),
    o = (L - (n - 1) * k.pier) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -b.half + i * (o + k.pier);
    out.push([a, a + o]);
  }
  return out;
}

/** A face's normal off its corners, turned to agree with `hint`. */
function normalOf(p0, p1, p3, hint) {
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
    v = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  return n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
}
const quadArea = (p0, p1, p2, p3) =>
  Math.hypot(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]) * Math.hypot(p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]);

/**
 * A BRIDGE'S MESH in the pixel (px, py)'s own frame - dfMeshToModel's shape (world/detStandIns.js MeshBuilder), its
 * pictures at vanilla's texel density - and its box ([x0, y0, z0, x1, y1, z1]).
 * @param {ReturnType<typeof import('./roadBridges.js').bridgeShape>} b @param {number} px @param {number} py
 */
export function buildBridgeMesh(b, px, py) {
  const f = bridgeFrame(b, px, py),
    road = b.kind === 'road',
    k = road ? BRIDGE.road : BRIDGE.track;
  const nx = -f.az,
    nz = f.ax;
  /** (s along, n across, y up) to the pixel's frame */
  const P = (s, n, y) => [f.cx + s * f.ax + n * nx, y, f.cz + s * f.az + n * nz];
  const along = [f.ax, 0, f.az],
    across = [nx, 0, nz],
    up = [0, 1, 0];
  const mb = new MeshBuilder();
  const face = (tex, p0, p1, p2, p3, hint) => {
    if (quadArea(p0, p1, p2, p3) > 1e-6) mb.quad(tex, p0, p1, p2, p3, normalOf(p0, p1, p3, hint));
  };
  const hw = k.width / 2,
    bed = b.level - k.foot;
  // the line's samples: the ramps' feet, the abutments, every opening's ends (a road's arches cut finer)
  const ops = openings(b),
    ss = new Set([-b.reach, -b.abut, b.abut, b.reach]);
  for (const [a, c] of ops)
    for (let i = 0; i <= (road ? ARCH_STEPS : 1); i++) ss.add(a + ((c - a) * i) / (road ? ARCH_STEPS : 1));
  const S = [...ss].sort((p, q) => p - q);
  if (road) {
    const crown = b.level + k.clearance,
      spring = b.level + SPRING;
    const archAt = (s) => {
      for (const [a, c] of ops)
        if (s >= a - 1e-9 && s <= c + 1e-9) {
          const t = (2 * (s - a)) / (c - a) - 1;
          return spring + (crown - spring) * (1 - t * t);
        }
      return bed;
    };
    // the walls each side, from the arches (or the ground) to the parapet's top; the ramps' and the abutments' to the bed
    for (const side of [-1, 1]) {
      for (let i = 0; i + 1 < S.length; i++) {
        const s0 = S[i],
          s1 = S[i + 1],
          mid = (s0 + s1) / 2,
          inWater = ops.some(([a, c]) => mid > a && mid < c);
        const b0 = inWater ? archAt(s0) : bed,
          b1 = inWater ? archAt(s1) : bed;
        face(
          STONE,
          P(s0, side * hw, b0),
          P(s1, side * hw, b1),
          P(s1, side * hw, deckTop(b, s1) + k.parapet),
          P(s0, side * hw, deckTop(b, s0) + k.parapet),
          [side * nx, 0, side * nz],
        );
        // the parapet's inner face and its top
        const inner = side * (hw - k.wall);
        face(
          STONE,
          P(s0, inner, deckTop(b, s0)),
          P(s1, inner, deckTop(b, s1)),
          P(s1, inner, deckTop(b, s1) + k.parapet),
          P(s0, inner, deckTop(b, s0) + k.parapet),
          [-side * nx, 0, -side * nz],
        );
        face(
          STONE,
          P(s0, inner, deckTop(b, s0) + k.parapet),
          P(s1, inner, deckTop(b, s1) + k.parapet),
          P(s1, side * hw, deckTop(b, s1) + k.parapet),
          P(s0, side * hw, deckTop(b, s0) + k.parapet),
          up,
        );
      }
      // the parapet's end at each ramp's foot
      for (const e of [-1, 1])
        face(
          STONE,
          P(e * b.reach, side * (hw - k.wall), b.level),
          P(e * b.reach, side * hw, b.level),
          P(e * b.reach, side * hw, b.level + k.parapet),
          P(e * b.reach, side * (hw - k.wall), b.level + k.parapet),
          [e * f.ax, 0, e * f.az],
        );
    }
    // the deck between the parapets
    for (let i = 0; i + 1 < S.length; i++) {
      const s0 = S[i],
        s1 = S[i + 1],
        w = hw - k.wall;
      face(
        STONE,
        P(s0, -w, deckTop(b, s0)),
        P(s1, -w, deckTop(b, s1)),
        P(s1, w, deckTop(b, s1)),
        P(s0, w, deckTop(b, s0)),
        up,
      );
    }
    // under each arch its vault, and at each opening's ends the pier's or the abutment's face from the bed to the springing
    for (const [a, c] of ops) {
      for (let i = 0; i < ARCH_STEPS; i++) {
        const s0 = a + ((c - a) * i) / ARCH_STEPS,
          s1 = a + ((c - a) * (i + 1)) / ARCH_STEPS;
        face(
          STONE,
          P(s0, -hw, archAt(s0)),
          P(s1, -hw, archAt(s1)),
          P(s1, hw, archAt(s1)),
          P(s0, hw, archAt(s0)),
          [0, -1, 0],
        );
      }
      face(STONE, P(a, -hw, bed), P(a, hw, bed), P(a, hw, spring), P(a, -hw, spring), along);
      face(STONE, P(c, -hw, bed), P(c, hw, bed), P(c, hw, spring), P(c, -hw, spring), [-f.ax, 0, -f.az]);
    }
  } else {
    // a track's: the plank deck (its top, its edges, its underside), on trestles - two posts and a cap a bent - with a
    // rail each side on posts of its own
    const t = k.deck;
    for (let i = 0; i + 1 < S.length; i++) {
      const s0 = S[i],
        s1 = S[i + 1],
        y0 = deckTop(b, s0),
        y1 = deckTop(b, s1);
      face(TIMBER, P(s0, -hw, y0), P(s1, -hw, y1), P(s1, hw, y1), P(s0, hw, y0), up);
      face(TIMBER, P(s0, -hw, y0 - t), P(s1, -hw, y1 - t), P(s1, hw, y1 - t), P(s0, hw, y0 - t), [0, -1, 0]);
      for (const side of [-1, 1])
        face(TIMBER, P(s0, side * hw, y0 - t), P(s1, side * hw, y1 - t), P(s1, side * hw, y1), P(s0, side * hw, y0), [
          side * nx,
          0,
          side * nz,
        ]);
    }
    const bents = Math.max(2, Math.ceil((2 * b.reach) / k.span) + 1);
    for (let j = 0; j < bents; j++) {
      const s = -b.reach + (2 * b.reach * j) / (bents - 1),
        top = deckTop(b, s);
      for (const side of [-1, 1]) {
        const n = side * (hw - k.pier / 2);
        if (top - t > bed + 0.05) beam(mb, P(s, n, bed), P(s, n, top - t), k.pier, k.pier, along); // the post under the deck
        beam(mb, P(s, n, top), P(s, n, top + k.parapet), k.pier * 0.7, k.pier * 0.7, along); // the rail's post
      }
      if (top - t > bed + 0.05)
        beam(mb, P(s, -hw, top - t - k.pier / 2), P(s, hw, top - t - k.pier / 2), k.pier, k.pier, along); // the cap under the deck
    }
    for (const side of [-1, 1]) {
      // the rails, a beam a run - the top rail and a mid rail under it
      const n = side * (hw - k.pier / 2);
      for (const h of [k.parapet, k.parapet / 2])
        for (let i = 0; i + 1 < S.length; i++)
          beam(
            mb,
            P(S[i], n, deckTop(b, S[i]) + h),
            P(S[i + 1], n, deckTop(b, S[i + 1]) + h),
            k.pier * 0.6,
            k.pier * 0.6,
            across,
          );
    }
  }
  const m = vanillaTexels(mb.build());
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3)
    for (let a = 0; a < 3; a++) {
      box[a] = Math.min(box[a], m.positions[i + a]);
      box[3 + a] = Math.max(box[3 + a], m.positions[i + a]);
    }
  return { mesh: m, box };
}

/** The pixel's own frame, as a model's matrix: a bridge's mesh is built in it. */
export const PIXEL_FRAME = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); // read, never written
/**
 * A PIXEL'S BRIDGES STOOD (world/terrain/terrainGen.js `bridges`, the kernel's): each one's mesh merged with the pixel's
 * statics (`addStatic`, its own pictures - the capitals' are climate-free), solid in the pixel's bucket (`solid`, through
 * the world collider's gate), its box grown into the pixel's (`grow`) - all freed with the pixel. Answers how many.
 * @param {?Array<any>} bridges @param {number} px @param {number} py
 * @param {{ addStatic: (mesh: any, at: Float32Array) => void, solid: (mesh: any, at: Float32Array) => void, grow: (box: number[]) => void }} o
 */
export function standBridges(bridges, px, py, { addStatic, solid, grow }) {
  let n = 0;
  for (const b of bridges ?? []) {
    const { mesh, box } = buildBridgeMesh(b, px, py);
    addStatic(mesh, PIXEL_FRAME);
    solid(mesh, PIXEL_FRAME);
    grow(box);
    n++;
  }
  return n;
}

/** A timber's box from p0 to p1 (its centre line), `w` wide across `side` and `h` deep - a post, a cap, a rail. */
function beam(mb, p0, p1, w, h, side) {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
    L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-6) return;
  const a = [d[0] / L, d[1] / L, d[2] / L];
  // u: `side` made square to the beam; v: square to both
  const dot = side[0] * a[0] + side[1] * a[1] + side[2] * a[2];
  let u = [side[0] - dot * a[0], side[1] - dot * a[1], side[2] - dot * a[2]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  if (ul < 1e-6) return;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const c = (p, su, sv) => [
    p[0] + (su * w * u[0]) / 2 + (sv * h * v[0]) / 2,
    p[1] + (su * w * u[1]) / 2 + (sv * h * v[1]) / 2,
    p[2] + (su * w * u[2]) / 2 + (sv * h * v[2]) / 2,
  ];
  for (const [su, sv, n] of [
    [1, 0, u],
    [-1, 0, [-u[0], -u[1], -u[2]]],
    [0, 1, v],
    [0, -1, [-v[0], -v[1], -v[2]]],
  ]) {
    const q = (o) => (su ? [su, o] : [o, sv]);
    const [a0, b0] = q(-1),
      [a1, b1] = q(1);
    const p00 = c(p0, a0, b0),
      p01 = c(p0, a1, b1),
      p10 = c(p1, a0, b0),
      p11 = c(p1, a1, b1);
    mb.quad(TIMBER, p00, p10, p11, p01, n);
  }
  for (const [p, n] of [
    [p0, [-a[0], -a[1], -a[2]]],
    [p1, a],
  ])
    mb.quad(TIMBER, c(p, -1, -1), c(p, 1, -1), c(p, 1, 1), c(p, -1, 1), n);
}

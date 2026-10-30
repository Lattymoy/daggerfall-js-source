// @ts-check
// FIGUREHEAD (2026-10-30; bible/03-World/Naval-Refit.md FIGUREHEAD) - THE CARVINGS, low-poly meshes built in code in the
// port's own style: flat-shaded, a few sides a limb, the yards' face kit (world/merchantYards/merchantYardModels.js
// YARD_MESH_KIT). Each faces by role (world/ships/figureheadArt.js ROLE) and is laid out in its own frame: its root at
// the origin on the stem's face, +z forward out of her bow, +y up, leaning forward as a figurehead leans, inside
// CARVING_BOX - so one mount a hull serves every carving (scenes/comeSailAway/shipFigurehead.js). Pure. Not a DFU member.
import { YARD_MESH_KIT } from '../merchantYards/merchantYardModels.js';
import { FIGUREHEADS } from '../../systems/naval/figurehead.js';
import { FIGUREHEAD_ARCHIVE, ROLE, roleRecords } from './figureheadArt.js';

const { faces, hexa, assemble } = YARD_MESH_KIT;
const B = ROLE.body, T = ROLE.trim, O = ROLE.base, E = ROLE.eye, I = ROLE.bone;

/** Every carving stands inside this box of its frame [x0, y0, z0, x1, y1, z1] (a pin holds each to it). */
export const CARVING_BOX = Object.freeze([-0.5, -0.36, -0.16, 0.5, 1.02, 1.08]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mirror = (p) => [-p[0], p[1], p[2]];

/** A triangle wound so its face looks along `out`. */
function tri(f, rec, a, b, c, out) {
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, out) >= 0) f.tri(rec, a, b, c, [0, 0], [1, 0], [0.5, 1]);
  else f.tri(rec, a, c, b, [0, 0], [0.5, 1], [1, 0]);
}

/**
 * A TUBE along `path` - each point `[x, y, z, rAcross, rAlong]` (its radius across x, and across the path within its
 * own plane; one radius serves both) - `sides` faces round, its ends capped; a radius of 0 is a point (a horn's tip).
 */
function tube(f, rec, path, sides = 6) {
  const pts = path.map((q) => [q[0], q[1], q[2]]);
  const rings = pts.map((p, i) => {
    const t = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    const v = norm(cross(t, Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), u = norm(cross(v, t));
    const ru = path[i][3], rv = path[i][4] ?? ru;
    if (!(ru > 0 || rv > 0)) return { tip: p };
    return { pts: Array.from({ length: sides }, (_, k) => { const a = (k / sides) * Math.PI * 2; return add(p, add(mul(u, Math.cos(a) * ru), mul(v, Math.sin(a) * rv))); }) };
  });
  let len = 0;
  for (let i = 0; i + 1 < rings.length; i++) {
    const A = rings[i], C = rings[i + 1], mid = mul(add(pts[i], pts[i + 1]), 0.5), v0 = len, v1 = (len += Math.hypot(...sub(pts[i + 1], pts[i])) * 3);
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides, u0 = k / sides, u1 = (k + 1) / sides;
      if (A.tip && C.tip) continue;
      if (A.tip || C.tip) {
        const R = A.tip ? C : A, tip = A.tip ?? C.tip, a = R.pts[k], b = R.pts[k1];
        tri(f, rec, a, b, tip, sub(mul(add(add(a, b), tip), 1 / 3), mid));
        continue;
      }
      const a = A.pts[k], b = A.pts[k1], c = C.pts[k1], d = C.pts[k];
      f.quad(rec, a, b, c, d, [u0, v0], [u1, v0], [u1, v1], [u0, v1], norm(sub(mul(add(add(a, b), add(c, d)), 0.25), mid)));
    }
  }
  for (const [i, j] of [[0, 1], [rings.length - 1, rings.length - 2]]) {
    const R = rings[i];
    if (R.tip) continue;
    const out = norm(sub(pts[i], pts[j]));
    for (let k = 0; k < sides; k++) tri(f, rec, pts[i], R.pts[k], R.pts[(k + 1) % sides], out);
  }
}
/** A BLOB - an ellipsoid along `dir` from its middle `c`: radii `rx` across x, `ry` across, `rz` along. */
function blob(f, rec, c, rx, ry, rz, dir = [0, 0, 1], sides = 6, stacks = 4) {
  const d = norm(dir), path = [];
  for (let k = 0; k <= stacks; k++) {
    const a = -Math.PI / 2 + (k / stacks) * Math.PI, s = Math.cos(a);
    path.push([...add(c, mul(d, Math.sin(a) * rz)), s > 1e-6 ? rx * s : 0, s > 1e-6 ? ry * s : 0]);
  }
  tube(f, rec, path, sides);
}
/** A SPIKE - a cone from `base` (radius r) to `tip`. */
const spike = (f, rec, base, tip, r, sides = 4) => tube(f, rec, [[...base, r], [...tip, 0]], sides);
/** A FIN - a thin plate on triangle abc, `t` thick. */
function fin(f, rec, a, b, c, t = 0.012) {
  const n = norm(cross(sub(b, a), sub(c, a))), h = mul(n, t / 2);
  const [a0, b0, c0, a1, b1, c1] = [sub(a, h), sub(b, h), sub(c, h), add(a, h), add(b, h), add(c, h)];
  tri(f, rec, a1, b1, c1, n); tri(f, rec, a0, b0, c0, mul(n, -1));
  const mid = mul(add(add(a, b), c), 1 / 3);
  for (const [p, q, p1, q1] of [[a0, b0, a1, b1], [b0, c0, b1, c1], [c0, a0, c1, a1]]) f.quad(rec, p, q, q1, p1, [0, 0], [1, 0], [1, 1], [0, 1], norm(sub(mul(add(p, q), 0.5), mid)));
}
/** Both sides' of a part: `make(s)` called with s 1 and -1 (x mirrored). */
const pair = (make) => { make(1); make(-1); };
const X = (s, p) => (s > 0 ? p : mirror(p));

/** THE BRACKET every carving stands on: an oak corbel on her stem, a gilt scroll curled at its foot. */
function bracket(f) {
  hexa(f, O, [[-0.04, -0.34, -0.08], [0.04, -0.34, -0.08], [0.04, -0.34, 0.03], [-0.04, -0.34, 0.03],
    [-0.11, 0.06, -0.08], [0.11, 0.06, -0.08], [0.11, 0.06, 0.2], [-0.11, 0.06, 0.2]], { under: true });
  const scroll = [];
  for (let k = 0; k <= 6; k++) { const a = Math.PI * 0.2 + (k / 6) * Math.PI * 1.5; scroll.push([0, -0.26 + Math.sin(a) * 0.06, 0.06 + Math.cos(a) * 0.06, 0.03]); }
  tube(f, T, scroll, 5);
}
/** An eye each side at `p` (its starboard one). */
const eyes = (f, p, r = 0.018) => pair((s) => blob(f, E, X(s, p), r, r, r, [0, 0, 1], 4, 2));

/** AKATOSH'S DRAGON: a long neck rising forward, a horned head, its jaws open, spines down its neck and wings folded. */
function dragon(f) {
  bracket(f);
  blob(f, B, [0, 0.1, 0.12], 0.15, 0.14, 0.17, [0, 0.6, 0.8]);
  const neck = [[0, 0.04, 0.06, 0.13, 0.12], [0, 0.24, 0.18, 0.12, 0.11], [0, 0.44, 0.33, 0.105, 0.1], [0, 0.6, 0.5, 0.09, 0.09], [0, 0.69, 0.64, 0.085, 0.085]];
  tube(f, B, neck, 7);
  blob(f, B, [0, 0.71, 0.71], 0.09, 0.08, 0.12, [0, 0.05, 1]);
  tube(f, B, [[0, 0.71, 0.78, 0.065, 0.05], [0, 0.69, 0.9, 0.05, 0.04], [0, 0.68, 0.99, 0.034, 0.03]], 6);   // the upper jaw
  tube(f, B, [[0, 0.63, 0.75, 0.05, 0.03], [0, 0.6, 0.87, 0.04, 0.024], [0, 0.585, 0.95, 0.028, 0.016]], 5);   // the lower, open
  for (const z of [0.84, 0.9, 0.95]) pair((s) => spike(f, I, X(s, [0.028, 0.67, z]), X(s, [0.026, 0.63, z]), 0.01, 3));
  eyes(f, [0.07, 0.74, 0.76]);
  pair((s) => spike(f, I, X(s, [0.05, 0.76, 0.67]), X(s, [0.09, 0.88, 0.5]), 0.026));   // the horns, swept back
  for (let i = 0; i < neck.length - 1; i++) {   // the spines down its neck's back
    const p = neck[i], q = neck[i + 1], up = norm(cross(norm(sub(q, p)), [1, 0, 0])), base = add([p[0], p[1], p[2]], mul(up, p[4] * 0.85));
    fin(f, T, base, add(base, mul(norm(sub(q, p)), 0.12)), add(add(base, mul(up, 0.1)), mul(norm(sub(q, p)), -0.02)));
  }
  pair((s) => { fin(f, B, X(s, [0.1, 0.16, 0.18]), X(s, [0.32, 0.5, 0.14]), X(s, [0.12, 0.42, 0.36])); fin(f, T, X(s, [0.32, 0.5, 0.14]), X(s, [0.36, 0.62, 0.24]), X(s, [0.12, 0.42, 0.36])); });   // the wings, folded
}

/** THE MAORMER'S SEA SERPENT: a coil low over the bracket rising to a finned head, a frill fanned behind its jaws. */
function serpent(f) {
  bracket(f);
  const coil = [[0, -0.02, 0.04, 0.1], [0, 0.1, 0.2, 0.1], [0, 0.12, 0.4, 0.095], [0, 0.22, 0.56, 0.09], [0, 0.42, 0.6, 0.085], [0, 0.6, 0.62, 0.08], [0, 0.72, 0.7, 0.075]];
  tube(f, B, coil, 7);
  for (let i = 1; i < coil.length - 1; i++) {   // the dorsal fin, along its back
    const p = coil[i], q = coil[i + 1], d = norm(sub(q, p)), up = norm(cross(d, [1, 0, 0])), base = add([p[0], p[1], p[2]], mul(up, p[3] * 0.85));
    fin(f, T, base, add(base, mul(d, 0.14)), add(base, mul(up, 0.09)));
  }
  blob(f, B, [0, 0.76, 0.8], 0.07, 0.065, 0.11, [0, 0.1, 1]);
  tube(f, B, [[0, 0.77, 0.86, 0.05, 0.04], [0, 0.75, 1.0, 0.025, 0.02]], 6);
  tube(f, B, [[0, 0.7, 0.84, 0.04, 0.025], [0, 0.66, 0.97, 0.02, 0.014]], 5);
  pair((s) => spike(f, I, X(s, [0.02, 0.75, 0.96]), X(s, [0.02, 0.69, 0.97]), 0.012, 3));   // its fangs
  eyes(f, [0.055, 0.79, 0.84]);
  pair((s) => { fin(f, T, X(s, [0.05, 0.8, 0.76]), X(s, [0.16, 0.94, 0.64]), X(s, [0.06, 0.7, 0.7])); fin(f, T, X(s, [0.06, 0.7, 0.72]), X(s, [0.18, 0.74, 0.6]), X(s, [0.05, 0.64, 0.76])); });   // the frill
  fin(f, T, [0, 0.82, 0.76], [0, 0.98, 0.62], [0, 0.8, 0.66]);
}

/** THE COVENANT'S LION, crowned: its forepart rampant, a paw raised, a mane fanned round its head. */
function lion(f) {
  bracket(f);
  tube(f, B, [[0, 0.0, 0.06, 0.15, 0.16], [0, 0.2, 0.2, 0.15, 0.16], [0, 0.38, 0.34, 0.14, 0.15], [0, 0.5, 0.46, 0.12, 0.12]], 7);
  blob(f, B, [0, 0.62, 0.57], 0.12, 0.12, 0.12, [0, 0.2, 1], 7);
  tube(f, B, [[0, 0.59, 0.63, 0.07, 0.06], [0, 0.57, 0.75, 0.055, 0.045]], 6);   // the muzzle
  blob(f, E, [0, 0.6, 0.77], 0.022, 0.016, 0.014, [0, 0, 1], 4, 2);   // its nose
  eyes(f, [0.06, 0.67, 0.66]);
  for (let k = 0; k < 11; k++) {   // the mane
    const a = (k / 11) * Math.PI * 2, d = [Math.cos(a), Math.sin(a), -0.35], c = [0, 0.62, 0.53];
    spike(f, T, add(c, mul([d[0], d[1], 0], 0.09)), add(c, add(mul([d[0], d[1], 0], 0.22), [0, 0, -0.08])), 0.05, 4);
  }
  tube(f, T, Array.from({ length: 2 }, (_, k) => [0, 0.73 + k * 0.05, 0.55, 0.075]), 8);   // the crown's band
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; spike(f, T, [Math.cos(a) * 0.065, 0.78, 0.55 + Math.sin(a) * 0.065], [Math.cos(a) * 0.07, 0.86, 0.55 + Math.sin(a) * 0.07], 0.022, 3); }
  tube(f, B, [[0.08, 0.36, 0.38, 0.05], [0.1, 0.42, 0.58, 0.048], [0.1, 0.48, 0.7, 0.045]], 5);   // the raised paw
  blob(f, B, [0.1, 0.49, 0.74], 0.058, 0.05, 0.06);
  tube(f, B, [[-0.08, 0.28, 0.34, 0.05], [-0.1, 0.2, 0.5, 0.048], [-0.1, 0.18, 0.6, 0.045]], 5);
  blob(f, B, [-0.1, 0.17, 0.64], 0.058, 0.05, 0.06);
  for (const x of [0.07, 0.1, 0.13]) { spike(f, I, [x, 0.5, 0.78], [x, 0.47, 0.82], 0.01, 3); spike(f, I, [-x, 0.17, 0.68], [-x, 0.13, 0.7], 0.01, 3); }
}

/** THE DOMINION'S EAGLE: its breast forward, its head turned to the sea, its wings raised behind it. */
function eagle(f) {
  bracket(f);
  tube(f, B, [[0, 0.0, 0.06, 0.12], [0, 0.24, 0.22, 0.13, 0.14], [0, 0.44, 0.36, 0.11], [0, 0.58, 0.46, 0.07]], 7);
  blob(f, B, [0, 0.66, 0.56], 0.075, 0.075, 0.09, [0, 0.1, 1]);
  tube(f, T, [[0, 0.67, 0.62, 0.035, 0.03], [0, 0.65, 0.71, 0.026, 0.022], [0, 0.6, 0.75, 0]], 5);   // the hooked beak
  eyes(f, [0.05, 0.69, 0.6], 0.015);
  pair((s) => {
    const sh = X(s, [0.1, 0.42, 0.3]), el = X(s, [0.28, 0.64, 0.22]), tip = X(s, [0.4, 0.92, 0.16]);
    fin(f, B, sh, el, X(s, [0.16, 0.2, 0.24]), 0.02);
    fin(f, B, el, tip, X(s, [0.3, 0.42, 0.16]), 0.02);
    fin(f, B, el, X(s, [0.3, 0.42, 0.16]), X(s, [0.16, 0.2, 0.24]), 0.02);
    for (let k = 0; k < 4; k++) { const a = add(tip, mul(sub(X(s, [0.3, 0.42, 0.16]), tip), k / 4)); fin(f, T, a, add(a, X(s, [0.07, -0.02, -0.03])), add(a, mul(sub(X(s, [0.3, 0.42, 0.16]), tip), 0.2))); }   // its pinions
  });
  pair((s) => spike(f, T, X(s, [0.05, 0.02, 0.1]), X(s, [0.07, -0.12, 0.2]), 0.03, 4));   // the talons over the bracket
}

/** SKYRIM'S WOLF: its neck thrust forward, its ruff, pricked ears and a snarl. */
function wolf(f) {
  bracket(f);
  tube(f, B, [[0, 0.0, 0.06, 0.13, 0.14], [0, 0.22, 0.2, 0.12], [0, 0.42, 0.36, 0.1], [0, 0.56, 0.5, 0.085]], 7);
  for (let k = 0; k < 9; k++) {   // the ruff
    const a = (k / 9) * Math.PI * 2, c = [0, 0.48, 0.44];
    spike(f, T, add(c, [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0]), add(c, [Math.cos(a) * 0.17, Math.sin(a) * 0.15, -0.1]), 0.045, 4);
  }
  blob(f, B, [0, 0.62, 0.6], 0.085, 0.08, 0.1, [0, 0, 1]);
  tube(f, B, [[0, 0.63, 0.66, 0.05, 0.045], [0, 0.6, 0.86, 0.028, 0.026]], 6);   // the muzzle
  tube(f, B, [[0, 0.56, 0.66, 0.04, 0.02], [0, 0.52, 0.82, 0.022, 0.014]], 5);   // the jaw, open
  blob(f, E, [0, 0.61, 0.88], 0.018, 0.014, 0.012, [0, 0, 1], 4, 2);
  pair((s) => { spike(f, I, X(s, [0.018, 0.59, 0.8]), X(s, [0.016, 0.55, 0.81]), 0.009, 3); spike(f, B, X(s, [0.05, 0.68, 0.58]), X(s, [0.07, 0.8, 0.53]), 0.03, 3); });   // fangs, ears
  eyes(f, [0.05, 0.66, 0.68], 0.015);
}

/** A CROWNED MAIDEN: a gown flowing into the bracket, her hands at her breast, her hair down her back, a gilt crown. */
function maiden(f) {
  bracket(f);
  tube(f, B, [[0, -0.06, 0.08, 0.17, 0.18], [0, 0.14, 0.2, 0.14, 0.15], [0, 0.3, 0.3, 0.1, 0.1], [0, 0.42, 0.38, 0.12, 0.11], [0, 0.54, 0.46, 0.1, 0.09]], 7);
  tube(f, I, [[0, 0.54, 0.46, 0.04], [0, 0.62, 0.52, 0.035]], 5);   // her neck
  blob(f, I, [0, 0.7, 0.58], 0.07, 0.08, 0.07, [0, 0.3, 1], 6);
  eyes(f, [0.03, 0.72, 0.64], 0.01);
  tube(f, T, [[0, 0.74, 0.52, 0.075, 0.06], [0, 0.6, 0.42, 0.08, 0.05], [0, 0.42, 0.32, 0.06, 0.03]], 6);   // her hair
  tube(f, T, [[0, 0.77, 0.58, 0.07], [0, 0.82, 0.58, 0.072]], 8);   // the crown's band
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; spike(f, T, [Math.cos(a) * 0.066, 0.82, 0.58 + Math.sin(a) * 0.066], [Math.cos(a) * 0.07, 0.9, 0.58 + Math.sin(a) * 0.07], 0.018, 3); }
  pair((s) => { tube(f, I, [[...X(s, [0.11, 0.5, 0.42]), 0.035], [...X(s, [0.12, 0.38, 0.5]), 0.03], [...X(s, [0.04, 0.44, 0.56]), 0.028]], 5); });   // her arms, hands at her breast
  blob(f, I, [0, 0.45, 0.57], 0.05, 0.035, 0.04);
}

/** THE STEED'S HORSE: an arched neck, its head bowed to the sea, a gilt mane, its forelegs raised. */
function horse(f) {
  bracket(f);
  const neck = [[0, 0.0, 0.06, 0.14, 0.15], [0, 0.22, 0.18, 0.12, 0.13], [0, 0.44, 0.3, 0.1, 0.11], [0, 0.62, 0.44, 0.085, 0.09], [0, 0.72, 0.58, 0.075]];
  tube(f, B, neck, 7);
  tube(f, B, [[0, 0.74, 0.6, 0.075, 0.07], [0, 0.66, 0.76, 0.06, 0.055], [0, 0.6, 0.86, 0.045, 0.045]], 6);   // the head, bowed
  blob(f, B, [0, 0.59, 0.87], 0.05, 0.045, 0.04);
  pair((s) => { blob(f, E, X(s, [0.03, 0.6, 0.9]), 0.012, 0.01, 0.008, [0, 0, 1], 4, 2); spike(f, B, X(s, [0.04, 0.8, 0.6]), X(s, [0.05, 0.9, 0.56]), 0.022, 3); });   // nostrils, ears
  eyes(f, [0.06, 0.72, 0.68], 0.014);
  for (let i = 0; i < neck.length - 1; i++) {   // the mane
    const p = neck[i], q = neck[i + 1], d = norm(sub(q, p)), up = norm(cross(d, [1, 0, 0])), base = add([p[0], p[1], p[2]], mul(up, (p[4] ?? p[3]) * 0.8));
    fin(f, T, base, add(base, mul(d, 0.16)), add(add(base, mul(up, 0.08)), mul(d, -0.04)), 0.03);
  }
  pair((s) => {
    tube(f, B, [[...X(s, [0.08, 0.3, 0.3]), 0.05], [...X(s, [0.1, 0.38, 0.52]), 0.045], [...X(s, [0.1, 0.24, 0.62]), 0.04]], 5);
    tube(f, E, [[...X(s, [0.1, 0.24, 0.62]), 0.042], [...X(s, [0.1, 0.19, 0.64]), 0.045]], 5);   // a hoof
  });
}

/** THE ILIAC BAY'S DREUGH: a ridged shell, eyes on stalks, two great claws raised and tentacles curled under it. */
function dreugh(f) {
  bracket(f);
  for (let k = 0; k < 4; k++) {   // its shell, in four ridges
    const c = [0, 0.1 + k * 0.13, 0.14 + k * 0.1], r = 0.22 - k * 0.025;
    blob(f, k % 2 ? T : B, c, r, r * 0.85, 0.14, [0, 0.62, 0.78], 8);
  }
  blob(f, B, [0, 0.62, 0.58], 0.13, 0.09, 0.12, [0, 0.4, 1], 7);   // its head
  pair((s) => {
    tube(f, B, [[...X(s, [0.05, 0.68, 0.62]), 0.02], [...X(s, [0.08, 0.8, 0.66]), 0.016]], 4);   // an eye on its stalk
    blob(f, E, X(s, [0.08, 0.82, 0.67]), 0.03, 0.03, 0.03, [0, 0, 1], 4, 2);
    tube(f, B, [[...X(s, [0.16, 0.34, 0.34]), 0.07], [...X(s, [0.27, 0.46, 0.54]), 0.06], [...X(s, [0.24, 0.6, 0.7]), 0.06]], 6);   // a claw's arm
    blob(f, B, X(s, [0.24, 0.66, 0.78]), 0.09, 0.07, 0.11, [0, 0.4, 1], 7);
    fin(f, T, X(s, [0.26, 0.72, 0.84]), X(s, [0.24, 0.84, 1.02]), X(s, [0.19, 0.7, 0.9]), 0.04);   // its pincers
    fin(f, T, X(s, [0.26, 0.62, 0.86]), X(s, [0.24, 0.58, 1.0]), X(s, [0.19, 0.64, 0.88]), 0.04);
    for (const k of [0, 1]) tube(f, B, [[...X(s, [0.06 + k * 0.07, 0.08, 0.2]), 0.05], [...X(s, [0.1 + k * 0.08, -0.08, 0.32]), 0.04], [...X(s, [0.08 + k * 0.08, -0.2, 0.26]), 0.03], [...X(s, [0.05 + k * 0.08, -0.17, 0.16]), 0.015], [...X(s, [0.04 + k * 0.08, -0.1, 0.18]), 0]], 5);   // tentacles, curled
  });
}

/** Each carving's builder, by its id (systems/naval/figurehead.js FIGUREHEADS). */
export const CARVING_BUILDS = Object.freeze({ dragon, serpent, lion, eagle, wolf, maiden, horse, dreugh });

const _models = new Map();
/** A carving's model in its own frame - renderer.createMesh's shape, its sub-meshes' records its faces' ROLES - or null
 *  for none. Built once. */
export function carvingModel(id) {
  if (!Object.prototype.hasOwnProperty.call(CARVING_BUILDS, id)) return null;
  if (!_models.has(id)) { const f = faces(); CARVING_BUILDS[/** @type {keyof typeof CARVING_BUILDS} */ (id)](f); _models.set(id, assemble(f, FIGUREHEAD_ARCHIVE)); }
  return _models.get(id);
}
/** A carving's model under `paint` (0 as built): its roles worn as figureheadArt.js roleRecords says. */
export function paintedCarving(id, paint) {
  const m = carvingModel(id);
  if (!m) return null;
  const recs = roleRecords(paint);
  return { ...m, subMeshes: m.subMeshes.map((s) => ({ ...s, role: s.textureRecord, textureRecord: recs[s.textureRecord] })) };
}
/** Every carving's model, its id's order (FIGUREHEADS, none left out). */
export const allCarvings = () => FIGUREHEADS.filter(Boolean).map((id) => carvingModel(id));

// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"; "make this something truly special"): SETHRAKUL,
// DRAWN. The port's own pass, in the foreign-pass convention (render/navalRender.js's): the renderer's own matrices,
// light and fog, and `markForeignPass` after. Design: bible/11-Multiplayer/Sea-Serpent.md section 9.
//
// NO ASSET. Daggerfall has no sea serpent and the port ships none: the body is MADE here each frame from the relay's
// own law (net/serpent/serpentBody.js bodyAt, through scenes/serpentHost.js drawFrame) - its spine's points smoothed (a
// Catmull-Rom through them, BODY_SUB rings to a segment), a ring of RING_SIDES about each, laid by parallel transport so
// no ring twists where the neck rears straight up, the section an ellipse a little wider than it is deep. Its hide is
// coloured per vertex: a sea-dark back, a bone-pale belly, the scales' bands down its length; a ragged dorsal sail of
// membrane and spines from the neck to the tail's last third; two horns swept back off the skull; two eyes that burn.
// Lit by the scene's ambient and sun with a wet sheen, fogged by the world's fog and the carved sea's - and drawn with
// the boats, BEFORE the sea's top, so the water lies over every coil under it.
//
// THE SEA'S MARKS are a second, flat pass AFTER the sea's top (the naval aim's place): each attack's wind-up laid on
// the water - its shape washed in, filling as the wind-up runs, its rim hard (a coil's ring purple, the venom's green,
// the rest the warning's red-orange); the maelstrom's spiral arms of foam turning about a black eye; the venom's pools.
//
// Not a DFU member. Ledger A (SERPENT1).
import { buildProgram } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';

/** Rings a segment (the smoothing), and the sides of a ring. */
export const BODY_SUB = 4;
export const RING_SIDES = 12;
/** The section: wider than deep. */
export const SECTION_W = 1.12;
export const SECTION_H = 0.92;
/** The hide's colours: its back, its flanks' bands, its belly, the eyes' fire, the horns' bone. */
export const HIDE = Object.freeze({
  back: Object.freeze([0.07, 0.17, 0.16]), band: Object.freeze([0.12, 0.27, 0.23]), belly: Object.freeze([0.56, 0.52, 0.36]),
  fin: Object.freeze([0.22, 0.12, 0.10]), eye: Object.freeze([1.0, 0.82, 0.25]), bone: Object.freeze([0.72, 0.68, 0.55]), glob: Object.freeze([0.45, 0.95, 0.25]),
});
/** The scales' bands: this long (m) each, every other one the lighter. */
export const BAND_M = 2.8;
/** The dorsal sail: from this far behind the snout to this far (m), its height a share of the girth, its spines. */
export const FIN_FROM = 11;
export const FIN_TO = 128;
export const FIN_H = 0.9;
export const FIN_SPINE_M = 3.5;
/** Floats a vertex of the body: position 3, normal 3, colour 3, emissive 1. */
export const MESH_STRIDE = 10;
/** Floats a vertex of the sea's marks: position 3, colour 4 (premultiplied). */
export const FLAT_STRIDE = 7;
/** The marks' colours (rgb, and the fill's and the rim's alpha). */
export const MARK = Object.freeze({
  warn: Object.freeze([0.98, 0.34, 0.12]), coil: Object.freeze([0.62, 0.28, 0.95]), venom: Object.freeze([0.45, 0.9, 0.22]),
  foam: Object.freeze([0.92, 0.96, 0.98]), eye: Object.freeze([0.02, 0.05, 0.07]),
});

// ── the body's geometry (pure) ─────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** Catmull-Rom between p1 and p2 (p0, p3 the neighbours) at u. */
const cr = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
};

/**
 * THE SMOOTHED SPINE: `points` (the host's - `{x, y, z, r}` snout first, SEG_LEN apart) through a Catmull-Rom, BODY_SUB
 * rings a segment; each ring `{p, r, s}` - its centre, girth, and metres behind the snout - with its frame laid by
 * parallel transport (`t` along the body toward the tail, `n` its up, `b` its side). Pure.
 * @param {ReadonlyArray<{x: number, y: number, z: number, r: number}>} points @param {number} segLen
 */
export function spineRings(points, segLen = 7) {
  const P = points.map((q) => [q.x, q.y, q.z]);
  const n = P.length;
  if (n < 2) return [];
  const rings = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
    for (let k = 0; k < BODY_SUB; k++) {
      const u = k / BODY_SUB;
      rings.push({ p: cr(p0, p1, p2, p3, u), r: points[i].r + (points[i + 1].r - points[i].r) * u, s: (i + u) * segLen });
    }
  }
  rings.push({ p: P[n - 1], r: points[n - 1].r, s: (n - 1) * segLen });
  // the frames: the tangent toward the tail, the up carried ring to ring (no twist where it rears)
  let up = [0, 1, 0];
  for (let i = 0; i < rings.length; i++) {
    const a = rings[Math.max(0, i - 1)].p, c = rings[Math.min(rings.length - 1, i + 1)].p;
    const t = norm(sub(c, a));
    let nUp = sub(up, mul(t, dot(up, t)));
    if (Math.hypot(nUp[0], nUp[1], nUp[2]) < 1e-4) nUp = Math.abs(t[1]) < 0.9 ? sub([0, 1, 0], mul(t, t[1])) : sub([1, 0, 0], mul(t, t[0]));
    nUp = norm(nUp);
    // a world-up pull, so the back keeps to the sky as it swims flat
    const wu = sub([0, 1, 0], mul(t, t[1]));
    if (Math.hypot(wu[0], wu[1], wu[2]) > 0.3) nUp = norm(add(mul(nUp, 0.85), mul(norm(wu), 0.15)));
    up = nUp;
    rings[i].t = t; rings[i].n = nUp; rings[i].b = norm(cross(t, nUp));
  }
  return rings;
}
/** The colour of the hide at metres `s` behind the snout, `top` 1 on the back and 0 on the belly. */
export function hideAt(s, top) { const c = [0, 0, 0]; hideInto(s, top, c, 0); return c; }
/** hideAt written into `out` at `o` - the tube's every vertex, no array made (AUDIT SERPENT L5). */
function hideInto(s, top, out, o) {
  const banded = Math.floor(s / BAND_M) % 2 === 1;
  const back = banded ? HIDE.band : HIDE.back;
  const k = Math.max(0, Math.min(1, (top - 0.28) / 0.44));
  const kk = k * k * (3 - 2 * k);
  const head = s < 9 ? 0.75 : 1;   // the skull darker
  for (let i = 0; i < 3; i++) out[o + i] = (HIDE.belly[i] * (1 - kk) + back[i] * kk) * head;
}
/** The tube's ring vertices, reused frame to frame: position 3, normal 3, colour 3 (AUDIT SERPENT L5 - the tube made
 *  some ten thousand small arrays a frame). */
let _ringVerts = new Float32Array(0);

/**
 * THE BODY'S TRIANGLES into `out` (Float32Array, MESH_STRIDE a vertex) from vertex 0 - the tube, the sail, the horns,
 * the eyes, the glob - and answers how many vertices. `f` the host's draw frame. Pure.
 */
export function bodyMesh(f, out) {
  let v = 0;
  const put = (p, nrm, c, e = 0) => {
    const o = v * MESH_STRIDE;
    if (o + MESH_STRIDE > out.length) return;
    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2];
    out[o + 3] = nrm[0]; out[o + 4] = nrm[1]; out[o + 5] = nrm[2];
    out[o + 6] = c[0]; out[o + 7] = c[1]; out[o + 8] = c[2]; out[o + 9] = e;
    v++;
  };
  const rings = spineRings(f.points);
  if (!rings.length) return 0;
  // the snout's ring closes to a blunt point, the tail's to a tip
  const need = rings.length * RING_SIDES * 9;
  if (_ringVerts.length < need) _ringVerts = new Float32Array(need);
  const S = _ringVerts;
  for (let i = 0; i < rings.length; i++) {
    const g = rings[i];
    const r = g.r * (i === 0 ? 0.35 : 1);
    for (let k = 0; k < RING_SIDES; k++) {
      const a = (k / RING_SIDES) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const o = (i * RING_SIDES + k) * 9;
      // the section: the back up (`n`), wider than deep
      const dh = ca * SECTION_H, dw = sa * SECTION_W, nh = ca / SECTION_H, nw = sa / SECTION_W;
      for (let j = 0; j < 3; j++) S[o + j] = g.p[j] + (g.n[j] * dh + g.b[j] * dw) * r;
      const nx = g.n[0] * nh + g.b[0] * nw, ny = g.n[1] * nh + g.b[1] * nw, nz = g.n[2] * nh + g.b[2] * nw;
      const l = Math.hypot(nx, ny, nz) || 1;
      S[o + 3] = nx / l; S[o + 4] = ny / l; S[o + 5] = nz / l;
      hideInto(g.s, (ca + 1) / 2, S, o + 6);
    }
  }
  /** A ring vertex (ring `i`, side `k`) into the mesh. */
  const ringPut = (i, k) => {
    const o = v * MESH_STRIDE;
    if (o + MESH_STRIDE > out.length) return;
    const q = (i * RING_SIDES + k) * 9;
    for (let j = 0; j < 9; j++) out[o + j] = S[q + j];
    out[o + 9] = 0;
    v++;
  };
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < RING_SIDES; k++) {
      const k2 = (k + 1) % RING_SIDES;
      ringPut(i, k); ringPut(i + 1, k); ringPut(i + 1, k2);
      ringPut(i, k); ringPut(i + 1, k2); ringPut(i, k2);
    }
  }
  // the snout capped
  const tip = add(rings[0].p, mul(rings[0].t, -rings[0].r * 0.9)), tipN = mul(rings[0].t, -1);
  for (let k = 0; k < RING_SIDES; k++) {
    const k2 = (k + 1) % RING_SIDES;
    put(tip, tipN, HIDE.back); ringPut(0, k2); ringPut(0, k);
  }
  // THE SAIL: membrane from the back's ridge up to its ragged edge, a spine standing every FIN_SPINE_M
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1];
    if (a.s < FIN_FROM || b.s > FIN_TO) continue;
    const hOf = (g) => {
      const life = Math.sin(Math.PI * (g.s - FIN_FROM) / (FIN_TO - FIN_FROM));
      const spine = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(Math.PI * g.s / FIN_SPINE_M)), 6);
      return g.r * FIN_H * life * spine + 0.15;
    };
    const ra = add(a.p, mul(a.n, a.r * SECTION_H * 0.95)), rb = add(b.p, mul(b.n, b.r * SECTION_H * 0.95));
    const ta = add(ra, mul(a.n, hOf(a))), tb = add(rb, mul(b.n, hOf(b)));
    const nrm = a.b;
    put(ra, nrm, HIDE.fin); put(rb, nrm, HIDE.fin); put(tb, nrm, HIDE.fin);
    put(ra, nrm, HIDE.fin); put(tb, nrm, HIDE.fin); put(ta, nrm, HIDE.fin);
  }
  // THE HORNS: swept back and out from the skull's crown
  if (rings.length > 6) {
    const g = rings[Math.min(rings.length - 1, 5)];
    for (const side of [-1, 1]) {
      const base = add(g.p, add(mul(g.n, g.r * 0.7), mul(g.b, side * g.r * 0.55)));
      const tipH = add(base, add(mul(g.t, g.r * 2.6), add(mul(g.n, g.r * 1.1), mul(g.b, side * g.r * 0.8))));
      const w1 = add(base, mul(g.t, g.r * 0.5)), w2 = add(base, mul(g.b, side * g.r * 0.35));
      const nrm = norm(cross(sub(w1, base), sub(tipH, base)));
      put(base, nrm, HIDE.bone); put(w1, nrm, HIDE.bone); put(tipH, nrm, HIDE.bone);
      put(base, nrm, HIDE.bone); put(tipH, nrm, HIDE.bone); put(w2, nrm, HIDE.bone);
      put(w1, nrm, HIDE.bone); put(w2, nrm, HIDE.bone); put(tipH, nrm, HIDE.bone);
    }
  }
  // THE EYES: a burning diamond each side of the skull
  if (rings.length > 3) {
    const g = rings[2];
    const burn = f.stunned ? 0.35 : f.dying ? 0.15 : 1;
    for (const side of [-1, 1]) {
      const c = add(g.p, add(mul(g.b, side * g.r * SECTION_W * 1.01), mul(g.n, g.r * 0.35)));
      const out1 = mul(g.b, side);
      const e = 0.55 * g.r * 0.35;
      const up = mul(g.n, e), fw = mul(g.t, e * 1.6);
      put(add(c, up), out1, HIDE.eye, burn); put(add(c, fw), out1, HIDE.eye, burn); put(sub(c, up), out1, HIDE.eye, burn);
      put(add(c, up), out1, HIDE.eye, burn); put(sub(c, up), out1, HIDE.eye, burn); put(sub(c, fw), out1, HIDE.eye, burn);
    }
  }
  // THE GLOB of venom in flight: an octahedron, burning green
  if (f.glob) {
    const c = f.glob, R = 1.6;
    const ax = [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]].map((d) => add(c, d));
    const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
    for (const [a, b, d] of faces) { const nrm = norm(sub(add(add(ax[a], ax[b]), ax[d]), mul(c, 3))); put(ax[a], nrm, HIDE.glob, 1); put(ax[b], nrm, HIDE.glob, 1); put(ax[d], nrm, HIDE.glob, 1); }
  }
  return v;
}

// ── the sea's marks (pure) ─────────────────────────────────────────────
/**
 * THE SEA'S MARKS into `out` (FLAT_STRIDE a vertex, premultiplied colour) - each attack's shape on the water, the
 * maelstrom, the venom - answers how many vertices. Pure.
 */
export function marksMesh(f, out) {
  let v = 0;
  const y = f.seaY + 0.25;
  const put = (x, z, c, a, dy = 0) => {
    const o = v * FLAT_STRIDE;
    if (o + FLAT_STRIDE > out.length) return;
    out[o] = x; out[o + 1] = y + dy; out[o + 2] = z; out[o + 3] = c[0] * a; out[o + 4] = c[1] * a; out[o + 5] = c[2] * a; out[o + 6] = a;
    v++;
  };
  const tri = (a, b, c, col, aa, ab = aa, ac = aa, dy = 0) => { put(a[0], a[1], col, aa, dy); put(b[0], b[1], col, ab, dy); put(c[0], c[1], col, ac, dy); };
  /** An annulus sector (r0..r1, angles a0..a1 - 0 north), its alpha at its inner and outer edge. */
  const band = (c, r0, r1, a0, a1, col, ai, ao, n = 40, dy = 0) => {
    const steps = Math.max(2, Math.ceil(n * Math.abs(a1 - a0) / (2 * Math.PI)));
    for (let i = 0; i < steps; i++) {
      const u0 = a0 + (a1 - a0) * (i / steps), u1 = a0 + (a1 - a0) * ((i + 1) / steps);
      const p = (r, u) => [c[0] + Math.sin(u) * r, c[1] + Math.cos(u) * r];
      tri(p(r0, u0), p(r1, u0), p(r1, u1), col, ai, ao, ao, dy);
      tri(p(r0, u0), p(r1, u1), p(r0, u1), col, ai, ao, ai, dy);
    }
  };
  for (const t of f.tele ?? []) {
    const col = t.key === 'coil' ? MARK.coil : t.key === 'spit' ? MARK.venom : MARK.warn;
    const hot = t.landed ? 1 : 0.55 + 0.45 * t.k;
    const rim = 0.7 * hot, fill = (t.mine ? 0.28 : 0.18) * hot;
    if (t.shape === 'disc' || t.shape === 'ring') {
      band(t.c, 0, t.r * t.k, 0, 2 * Math.PI, col, fill, fill);
      band(t.c, Math.max(0, t.r - 1.4), t.r, 0, 2 * Math.PI, col, rim * 0.3, rim, 48, 0.02);
      if (t.shape === 'ring') band(t.c, t.r * 0.62, t.r * 0.68, 0, 2 * Math.PI, col, rim * 0.6, rim * 0.6, 48, 0.02);
    } else if (t.shape === 'rings') {
      band(t.c, t.r0, t.r0 + (t.r1 - t.r0) * t.k, 0, 2 * Math.PI, col, fill, fill);
      band(t.c, t.r1 - 1.6, t.r1, 0, 2 * Math.PI, col, rim * 0.3, rim, 64, 0.02);
      band(t.c, t.r0, t.r0 + 1.2, 0, 2 * Math.PI, col, rim, rim * 0.3, 32, 0.02);
    } else if (t.shape === 'sector') {
      const half = (t.arc * Math.PI) / 360;
      band(t.c, 0, t.r * t.k, t.yw - half, t.yw + half, col, fill, fill);
      band(t.c, t.r - 1.6, t.r, t.yw - half, t.yw + half, col, rim * 0.3, rim, 40, 0.02);
    } else if (t.shape === 'lane' && t.e) {
      const dx = t.e[0] - t.c[0], dz = t.e[1] - t.c[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, w = t.width / 2;
      const q = (a, s) => [t.c[0] + ux * a + uz * s, t.c[1] + uz * a - ux * s];
      const fl = L * t.k;
      tri(q(0, -w), q(fl, -w), q(fl, w), col, fill); tri(q(0, -w), q(fl, w), q(0, w), col, fill);
      for (const s of [-1, 1]) { tri(q(0, s * w), q(L, s * w), q(L, s * (w - 1.2)), col, rim, rim, rim * 0.3, 0.02); tri(q(0, s * w), q(L, s * (w - 1.2)), q(0, s * (w - 1.2)), col, rim, rim * 0.3, rim * 0.3, 0.02); }
    }
  }
  // THE MAELSTROM: its black eye, its turning arms of foam, its rim
  if (f.mael) {
    const m = f.mael, grow = Math.min(1, Math.max(0, (f.t - m.at) / 4000)) * m.fade;
    if (grow > 0) {
      band(m.c, 0, 40, 0, 2 * Math.PI, MARK.eye, 0.85 * grow, 0.55 * grow, 40, -0.1);
      const spin = (f.t / 1000) * 0.45;
      for (let arm = 0; arm < 6; arm++) {
        const a0 = (arm / 6) * 2 * Math.PI + spin;
        const N = 28;
        for (let i = 0; i < N; i++) {
          const u0 = i / N, u1 = (i + 1) / N;
          const r0 = 40 + (m.r - 40) * u0, r1 = 40 + (m.r - 40) * u1;
          const t0 = a0 + u0 * 3.2, t1 = a0 + u1 * 3.2;
          const w0 = 3 + 9 * u0, w1 = 3 + 9 * u1;
          const al = (u) => 0.42 * grow * Math.sin(Math.PI * u);
          const P = (r, tt, s) => [m.c[0] + Math.sin(tt) * (r + s), m.c[1] + Math.cos(tt) * (r + s)];
          tri(P(r0, t0, -w0), P(r1, t1, -w1), P(r1, t1, w1), MARK.foam, al(u0) * 0.4, al(u1) * 0.4, al(u1));
          tri(P(r0, t0, -w0), P(r1, t1, w1), P(r0, t0, w0), MARK.foam, al(u0) * 0.4, al(u1), al(u0));
        }
      }
      band(m.c, m.r - 3, m.r, 0, 2 * Math.PI, MARK.foam, 0, 0.3 * grow, 64);
    }
  }
  for (const p of f.venom ?? []) band(p.c, 0, p.r, 0, 2 * Math.PI, MARK.venom, 0.35 * p.k, 0.12 * p.k, 32, 0.05);
  return v;
}

// ── the passes ─────────────────────────────────────────────────────────
const MESH_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aEmit;
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vNormal;
out vec3 vColor;
out float vEmit;
out vec3 vWorldPos;
void main() {
  vNormal = aNormal; vColor = aColor; vEmit = aEmit; vWorldPos = aPos;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in float vEmit;
in vec3 vWorldPos;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform float uSeaY;
out vec4 outColor;
${FOG_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  vec3 l = normalize(uLightDir);
  vec3 v = normalize(uCamPos - vWorldPos);
  if (dot(n, v) < 0.0) n = -n;   // the sail and the horns are two-sided
  float diff = max(dot(n, l), 0.0);
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 28.0) * 0.45;   // a wet hide's sheen
  vec3 lit = vColor * clamp(uAmbient + uSunColor * uSunScale * diff, vec3(0.0), vec3(1.5)) + uSunColor * uSunScale * spec * 0.6;
  vec3 c = mix(lit, vColor * 1.6, vEmit);
  // under the sea it darkens toward the deep the further down it lies (the water's own top blends over it after)
  float under = clamp((uSeaY - vWorldPos.y) / 9.0, 0.0, 1.0);
  c = mix(c, vec3(0.01, 0.05, 0.07), under * (1.0 - vEmit) * 0.85);
  float f = fogFactorAt(vWorldPos);
  outColor = vec4(dwWaterFog(mix(uFogColor, c, f), vWorldPos), 1.0);
}`;
const FLAT_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;
uniform mat4 uProj;
uniform mat4 uView;
out vec4 vColor;
out vec3 vWorldPos;
void main() { vColor = aColor; vWorldPos = aPos; gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
const FLAT_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in vec3 vWorldPos;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  if (vColor.a < 0.003) discard;
  float f = fogFactorAt(vWorldPos);
  outColor = vec4(dwWaterFog(vColor.rgb * f, vWorldPos), vColor.a * f);
}`;

const LIGHT_FOG = ['uAmbient', 'uSunColor', 'uSunScale', 'uLightDir', 'uCamPos', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus', 'uJungleHaze', 'uSeaY'];
/** The most vertices a frame lays: the tube, its cap, the sail, the horns, the eyes, the glob - and the marks. */
export const MESH_MAX_VERTS = 24 * BODY_SUB * RING_SIDES * 6 + RING_SIDES * 3 + 24 * BODY_SUB * 6 + 64;
export const FLAT_MAX_VERTS = 24_000;

export class SerpentRenderer {
  /** @param {any} renderer render/renderer.js's */
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    /** @type {any} */ this._mesh = null;
    /** @type {any} */ this._flat = null;
    this.mesh = new Float32Array(MESH_MAX_VERTS * MESH_STRIDE);
    this.flat = new Float32Array(FLAT_MAX_VERTS * FLAT_STRIDE);
    this.drawn = { body: 0, marks: 0 };
  }
  _program(vs, fs, label, attribs) {
    const gl = this.gl;
    const p = buildProgram(gl, vs, fs, label);
    const u = Object.fromEntries(['uProj', 'uView', ...LIGHT_FOG].map((n) => [n, gl.getUniformLocation(p, n)]));
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const stride = attribs.reduce((s, n) => s + n, 0) * 4;
    let off = 0;
    attribs.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); off += n * 4; });
    gl.bindVertexArray(null);
    return { p, u, vao, vbo, cap: 0 };
  }
  _uniforms(u, seaY) {
    const gl = this.gl, r = this.renderer;
    gl.uniformMatrix4fv(u.uProj, false, r._proj);
    gl.uniformMatrix4fv(u.uView, false, r._view);
    if (u.uAmbient) gl.uniform3fv(u.uAmbient, r._ambient);
    if (u.uSunColor) gl.uniform3fv(u.uSunColor, r._sunColor);
    if (u.uSunScale) gl.uniform1f(u.uSunScale, r._sunScale ?? 0);
    if (u.uLightDir) gl.uniform3fv(u.uLightDir, r._lightDir);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform3fv(u.uFogColor, r._fogColor);
    gl.uniform1i(u.uFogMode, r._fogMode);
    gl.uniform1f(u.uFogDensity, r._fogDensity);
    gl.uniform2fv(u.uFogRange, r._fogRange);
    if (u.uDwFog && r._dwFog) gl.uniform4fv(u.uDwFog, r._dwFog);
    if (u.uFocus && r._focus) gl.uniform4fv(u.uFocus, r._focus);
    if (u.uJungleHaze && r._haze) gl.uniform4fv(u.uJungleHaze, r._haze);   // BANTHA1: the jungle's haze (render/hazeGlsl.js)
    if (u.uSeaY) gl.uniform1f(u.uSeaY, seaY);
  }
  _upload(prog, data, n, stride) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, prog.vbo);
    const bytes = n * stride * 4;
    if (prog.cap < bytes) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); prog.cap = data.byteLength; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, n * stride));
  }
  /** THE BODY, with the opaque world (before the sea's top). Answers whether it drew. */
  drawBody(f) {
    this.drawn.body = 0;
    const r = this.renderer;
    if (!f?.points?.length || !r?._proj || !r?._view) return false;
    const n = bodyMesh(f, this.mesh);
    if (!n) return false;
    const gl = this.gl;
    this._mesh ??= this._program(MESH_VS, MESH_FS, 'serpent body', [3, 3, 3, 1]);
    gl.useProgram(this._mesh.p);
    this._uniforms(this._mesh.u, f.seaY);
    gl.bindVertexArray(this._mesh.vao);
    this._upload(this._mesh, this.mesh, n, MESH_STRIDE);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);   // the world pass's baseline back
    this.drawn.body = n;
    r.markForeignPass?.();   // the pass bound its own program and VAO
    return true;
  }
  /** THE SEA'S MARKS, over the sea's top. Answers whether it drew. */
  drawSea(f) {
    this.drawn.marks = 0;
    const r = this.renderer;
    if (!f || !r?._proj || !r?._view) return false;
    const n = marksMesh(f, this.flat);
    if (!n) return false;
    const gl = this.gl;
    this._flat ??= this._program(FLAT_VS, FLAT_FS, 'serpent marks', [3, 4]);
    gl.useProgram(this._flat.p);
    this._uniforms(this._flat.u, f.seaY);
    gl.bindVertexArray(this._flat.vao);
    this._upload(this._flat, this.flat, n, FLAT_STRIDE);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    this.drawn.marks = n;
    r.markForeignPass?.();
    return true;
  }
}

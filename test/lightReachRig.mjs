// LIGHT-REACH's rig: the window and cluster helpers test/render/lightreach.test.js and test/render/audit_lightreach.test.js
// share - a seeded random, a box test, a recording GL, the masks, house fronts and a town of them, and the tiers' weights
// read off a frame (AUDIT LIGHT-REACH W1: each tile's near fade and far weight, as the shader sums them).
import { LC_BOX } from '../src/render/lightClusters.js';
import { windowAperturesOf, WL_FAR_MAX, WL_VEC4, WL_LAMP_GOBO, wlFade } from '../src/render/windowLight.js';
import { identity } from '../src/world/mat4.js';

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Is `p` inside a box of LC_BOX floats at `at` (centre, three half-axes)? */
export function inBox(B, at, p) {
  for (let h = at + 3; h < at + LC_BOX; h += 3) {
    const L2 = B[h] ** 2 + B[h + 1] ** 2 + B[h + 2] ** 2;
    if (Math.abs(((p[0] - B[at]) * B[h] + (p[1] - B[at + 1]) * B[h + 1] + (p[2] - B[at + 2]) * B[h + 2]) / L2) > 1 + 1e-5) return false;
  }
  return true;
}
export const boxVolume = (B, at = 0) => 8 * [3, 6, 9].reduce((v, h) => v * Math.hypot(B[at + h], B[at + h + 1], B[at + h + 2]), 1);
export const fakeGl = (log = []) => new Proxy({}, { get: (o, k) => (typeof k === 'string' && k.toUpperCase() === k ? k : (...a) => { log.push([k, ...a]); return {}; }) });
/** A window picture's mask: a cross of lead over four panes. */
export const glassAt = (u, v) => u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9 && Math.abs(u - 0.5) > 0.06 && Math.abs(v - 0.5) > 0.06;
export function crossMask(W = 64, at = glassAt) {
  const colors = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (at((x + 0.5) / W, (y + 0.5) / W)) colors.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 4);
  return { width: W, height: W, colors };
}
/** Glass high in its tile and off to one side, so the glass's centre is not the tile's. */
export const highAt = (u, v) => u > 0.2 && u < 0.95 && v > 0.45 && v < 0.95 && Math.abs(u - 0.6) > 0.05;
/** A house front `tiles` x 2 tiles of `tw` m from x = `x0`, its glass facing +z at z = -10, turned by `yaw` about the origin;
 *  its picture's u starting at `u0` (a fraction: the first and last tiles covered in part). */
export function front(tiles = 8, yaw = 0, tw = 2.5, x0 = -0.5 * tw * tiles, u0 = 0) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), rot = (x, z) => [x * cs + z * sn, -x * sn + z * cs];
  const P = [], N = [], UV = [];
  for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const [x, z] = rot(x0 + tw * tiles * a, -10), [nx, nz] = rot(0, 1);
    P.push(x, 5 * b, z); N.push(nx, 0, nz); UV.push(u0 + tiles * a, 2 * b);
  }
  const set = windowAperturesOf(new Float32Array(P), new Float32Array(N), new Float32Array(UV), new Uint32Array([0, 1, 2, 0, 2, 3]), 0, 6);
  return { key: 'm', ap: set.recs, cells: set.cells, rot };
}

/** A front in its mesh's own space for the pass's note: `tiles` x `storeys` tiles of `tw` by `th` m, glass facing +z at
 *  z = 0, x from 0, under picture `key`. */
export function frontMesh(tiles = 8, storeys = 2, tw = 2.5, th = 2.5, key = 'm') {
  const P = [], N = [], UV = [];
  for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(tw * tiles * a, th * storeys * b, 0); N.push(0, 0, 1); UV.push(tiles * a, storeys * b); }
  const set = windowAperturesOf(new Float32Array(P), new Float32Array(N), new Float32Array(UV), new Uint32Array([0, 1, 2, 0, 2, 3]), 0, 6);
  return { wl: [{ key, ap: set.recs, cells: set.cells }] };
}
/** A placement turned by `yaw` (+z toward +x) and moved to (x, y, z). */
export function place(x, y, z, yaw) {
  const m = identity(), c = Math.cos(yaw), s = Math.sin(yaw);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c; m[12] = x; m[13] = y; m[14] = z;
  return m;
}
/** A town: `streets` streets along z, 40 m apart; each side `perSide` fronts 20 m long every 22 m, facing the street. */
export function town(streets = 7, perSide = 19, mesh = frontMesh()) {
  const out = [];
  for (let si = 0; si < streets; si++) {
    const sx = -40 * ((streets - 1) / 2) + 40 * si;
    for (let h = 0; h < perSide; h++) {
      const z = -200 + 22 * h;
      out.push({ mesh, m: place(sx - 6, 0, z, Math.PI / 2) }, { mesh, m: place(sx + 6, 0, z - 20, -Math.PI / 2) });
    }
  }
  return out;
}
/** The pass watched: each near light written (its tile) and each far row recorded, in the frame's order. */
export function watchTiers(pass) {
  const near = [], rows = [];
  const ll = pass._lampLight.bind(pass), rr = pass._rowRecord.bind(pass);
  pass._lampLight = (c, lamp, fade) => { const l = ll(c, lamp, fade); if (l) near.push({ t: c.t, j: c.j, d: c.d }); return l; };
  pass._rowRecord = (c) => { const ok = rr(c); if (ok) rows.push({ row: c.row, t: c.t }); return ok; };
  return { near, rows, reset() { near.length = 0; rows.length = 0; } };
}
/** AUDIT LIGHT-REACH W1: every lit tile's weight after a street frame - its near light's fade (the written gobo over the
 *  lamp's) plus its row's (1 - near fade) x far fade at its coverage centre, by the far block's words - against the
 *  whole a tile is owed: its near fade, and the far fade of the rest. Answers the gaps and doubles past `eps`. */
export function tierWeights(pass, watch, eye, lamp, eps = 1e-3) {
  const h = WL_FAR_MAX * WL_VEC4 * 4, F = pass.farData, cut = F[h + 3], cutF = F[h + 7];
  const W = new Map(), key = (t, j) => { let id = watch.ids.get(t); if (id === undefined) watch.ids.set(t, id = watch.ids.size); return `${id}:${j}`; };
  watch.ids ??= new Map();
  for (const [, list] of pass.sources.street) for (const s of list) for (const p of s.subs ?? []) if (p) for (const t of p.tiles) if (t) {
    for (let j = 0; j < t.street.length; j++) if (t.street[j]) W.set(key(t, j), { n: 0, f: 0, d: Math.hypot(t.cent[3 * j] - eye[0], t.cent[3 * j + 1] - eye[1], t.cent[3 * j + 2] - eye[2]) });
  }
  for (let i = 0; i < pass.count; i++) W.get(key(watch.near[i].t, watch.near[i].j)).n += pass.data[i * WL_VEC4 * 4 + 20] / (lamp[0] * WL_LAMP_GOBO);
  for (let i = 0; i < pass.farCount; i++) {
    const rec = F.subarray(i * WL_VEC4 * 4, (i + 1) * WL_VEC4 * 4), code = Math.round(rec[27]);
    const { row, t } = watch.rows.find((x) => x.row.rec[0] === rec[0] && x.row.rec[1] === rec[1] && x.row.rec[2] === rec[2] && x.row.rec[27] === rec[27]);
    row.js.forEach((j, k) => {
      if (!(Math.floor(code / 3 ** k) % 3)) return;
      const dq = Math.hypot(rec[0] + rec[24] + rec[20] * k - F[h], rec[1] + rec[25] + rec[21] * k - F[h + 1], rec[2] + rec[26] + rec[22] * k - F[h + 2]);
      W.get(key(t, j)).f += (1 - wlFade(dq, cut)) * wlFade(dq, cutF);
    });
  }
  const out = { cut, cutF, tiles: 0, gaps: [], doubles: [] };
  for (const w of W.values()) {
    const n = wlFade(w.d, cut), want = n + (1 - n) * wlFade(w.d, cutF), got = w.n + w.f;
    if (want > 0 || got > 0) out.tiles++;
    if (got < want - eps) out.gaps.push({ d: +w.d.toFixed(2), want: +want.toFixed(3), got: +got.toFixed(3) });
    if (got > want + eps) out.doubles.push({ d: +w.d.toFixed(2), want: +want.toFixed(3), got: +got.toFixed(3) });
  }
  return out;
}

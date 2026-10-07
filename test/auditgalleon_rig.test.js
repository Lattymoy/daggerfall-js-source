// AUDIT GALLEON (2026-10-02, Mac: "Audit this. It must be perfect") - HER RIG AND HER RIG'S HIT BOXES (world/
// galleonRig.js, systems/naval/navalShips.js HULL_BUILDS[2].rig, scenes/navalHost.js rigBoxesOf). Every pin reads her
// rig AS BUILT, off the runtime's own models (test/csaScene.mjs's MODELS - hull 2 on Mac's galleon): the sails' bones
// where their clips stand them, the spars and the standing rope out of their meshes (each prism's two rings), the
// running rope's ends where their bones stand, her solids' triangles - and turns it as Come Sail Away's trim turns her
// booms (quatAngleAxis about up). No formula of galleonRig.js is restated here.
//
// THE SWEEP: the square yards at 0, 15, 30 (the auto-trim's most with a large square sail and a gaff, HasLargeSquare-
// SailWithGaff) and the manual 45, either way; the gaff to 90 either way in 15s; every sail at every Wind its blend tree
// stands it at (-1, -0.5, 0, 0.5, 1) and stowed. Inside the auto-trim's range (both to 30) nothing may meet anything it
// is not made fast to; past it the clashes left are the gaff's sweep through the main shrouds and under the main
// topsail and the yards at 45 - pinned by name, so a new one fails.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MODELS, scene } from './csaScene.mjs';
import { sea } from './navalSea.mjs';
import { GALLEON_PREFAB_ID } from '../src/world/galleonModel.js';
import { TEX } from '../src/world/galleonArt.js';
import { HULL, HULL_BUILDS, hullBuild } from '../src/systems/naval/navalShips.js';
import { rigBoxesOf } from '../src/scenes/navalHost.js';
import { stowSail } from '../src/systems/comeSailAway.js';   // AUDIT GALLEON-2 RG3: her canvas set, where her rig's boxes stand
import { animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { rigBand } from '../src/systems/naval/navalAI.js';
import { toBoxLocal, orientedBox } from '../src/systems/naval/navalBallistics.js';
import { mat4FromQuatPosScale, quatAngleAxis, quatRotate } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';
import { pathHash, quatEuler } from '../src/world/unityAnimator.js';

// ── vectors ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const fmt = (p) => `[${p.map((v) => v.toFixed(3)).join(', ')}]`;
const bboxOf = (pts, pad = 0) => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const p of pts) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k] - pad); max[k] = Math.max(max[k], p[k] + pad); } return { min, max }; };
const meets = (A, B) => A.min.every((v, k) => v <= B.max[k] && A.max[k] >= B.min[k]);
/** Closest points of segments p1-q1 and p2-q2 (`s`, `t` their fractions). */
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a > 1e-12 || e > 1e-12) {
    if (a <= 1e-12) t = Math.min(1, Math.max(0, f / e));
    else {
      const c = dot(d1, r);
      if (e <= 1e-12) s = Math.min(1, Math.max(0, -c / a));
      else {
        const b = dot(d1, d2), den = a * e - b * b;
        s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
      }
    }
  }
  const c1 = add(p1, scl(d1, s)), c2 = add(p2, scl(d2, t));
  return { d: len(sub(c1, c2)), s, t, c1 };
}
/** The closest point of triangle abc to p (Ericson's regions). */
function ptTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scl(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scl(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, scl(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return add(a, add(scl(ab, vb * den), scl(ac, vc * den)));
}
/** Where segment p-q crosses triangle abc (its fraction), or null. */
function segTriCross(p, q, a, b, c) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-14) return null;
  const s = sub(p, a), u = dot(s, h) / det;
  if (u < 0 || u > 1) return null;
  const qq = cross(s, e1), v = dot(d, qq) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, qq) / det;
  return t >= 0 && t <= 1 ? t : null;
}
/** Segment p-q to triangle abc: the distance (0 crossing) and where on the segment. */
function segTriDist(p, q, a, b, c) {
  const t = segTriCross(p, q, a, b, c);
  if (t != null) return { d: 0, at: lerp(p, q, t) };
  let best = { d: Infinity, at: p };
  for (const e of [p, q]) { const d = len(sub(e, ptTri(e, a, b, c))); if (d < best.d) best = { d, at: e }; }
  for (const [x, y] of [[a, b], [b, c], [c, a]]) { const r = segSeg(p, q, x, y); if (r.d < best.d) best = { d: r.d, at: r.c1 }; }
  return best;
}

// ── her rig as built ────────────────────────────────────────────────────────────────────────────────────────────────
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const comps = MODELS.components;
const compOf = (n, type) => n.components.map((i) => comps[i]).find((c) => c?.type === type) ?? null;
const nodes = [], byPath = new Map();
(function walk(n, path, pm, parent, boom) {
  const world = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
  const isBoom = n.name.includes('Boom');   // Come Sail Away's walk: every node whose name holds 'Boom'
  const rec = { node: n, name: n.name, world, parent, boom: isBoom ? null : boom, isBoom };
  nodes.push(rec); byPath.set(path, rec);
  for (const c of n.children) walk(c, `${path}/${c.name}`, world, rec, isBoom ? rec : boom);
}(MODELS.prefab(GALLEON_PREFAB_ID), String(GALLEON_PREFAB_ID), I4, null, null));
const boomOf = (r) => (r.isBoom ? r : r.boom);
const posOf = (r) => [r.world[12], r.world[13], r.world[14]];
/** Her booms in Come Sail Away's walk order, each its pivot (her frame). */
const BOOMS = nodes.filter((r) => r.isBoom).map((r, k) => ({ rec: r, name: r.name, k, pivot: posOf(r) }));
const SQ_BOOMS = BOOMS.filter((b) => b.name.includes('Square')).map((b) => b.name), GAFF_BOOM = BOOMS.find((b) => b.name.includes('Gaff')).name;
const trimsOf = (sq, gf) => ({ ...Object.fromEntries(SQ_BOOMS.map((n) => [n, sq])), [GAFF_BOOM]: gf });
/** A rest point (her frame) on a boom's subtree, turned by the trim about the boom's pivot. */
const turned = (b, p, trims) => { const deg = b ? trims[b.name] ?? 0 : 0; if (!deg) return p; const P = posOf(b); return add(P, quatRotate(quatAngleAxis(deg, [0, 1, 0]), sub(p, P))); };

// the sails: each one's bones and every clip its controller plays
const SAILS = [];
for (const r of nodes) {
  const an = compOf(r.node, 'Animator'), ov = an ? MODELS.animation.overrides[an.m_Controller?.controller] : null;
  if (!ov || !/Sail$/.test(r.name)) continue;
  const bonesRec = nodes.find((x) => x.parent === r && /SailBones$/.test(x.name)), meshRec = nodes.find((x) => x.parent === r && /SailMesh$/.test(x.name));
  const bones = nodes.filter((x) => x.parent === bonesRec).sort((a, b) => +a.name.slice(1) - +b.name.slice(1));
  const clip = (state) => { const c = MODELS.animation.clips[ov.clips.find(([s]) => s === state)[1]]; const at = new Map(c.curves.map((q) => [q.path, q.components.map((k) => k.constant)])); return bones.map((b) => at.get(pathHash(`${bonesRec.name}/${b.name}`))); };
  const stay = ov.base === 'Staysail Controller';
  const set = (stay ? [[-1, 'Staysail Unstowed Left'], [-0.5, 'Staysail Unstowed Center Left'], [0, 'Staysail Unstowed Center'], [0.5, 'Staysail Unstowed Center Right'], [1, 'Staysail Unstowed Right']] : [[-1, 'Sail Unstowed Left'], [0, 'Sail Unstowed Center'], [1, 'Sail Unstowed Right']]).map(([w, s]) => [w, clip(s)]);
  const geometry = MODELS.geometry(compOf(meshRec.node, 'SkinnedMeshRenderer').m_Mesh.mesh);
  const grid = bones.length === 72 ? [9, 8] : [8, 7];
  SAILS.push({ rec: r, name: r.name, key: bonesRec.name.replace(/SailBones$/, ''), bonesRec, bones, set, stowed: clip('Sail Stowed'), geometry, grid, boom: boomOf(r) });
}
const sailBy = (key) => SAILS.find((s) => s.key === key);
const SQUARES = ['ForeCourse', 'ForeTopsail', 'MainTopsail'];
/** A sail's bones (its bones node's frame) at a Wind (the 1D blend tree's blend) or stowed. */
function poseLocal(sail, wind) {
  if (wind === 'stowed') return sail.stowed;
  const w = Math.max(sail.set[0][0], Math.min(sail.set[sail.set.length - 1][0], wind));
  for (let i = 0; i + 1 < sail.set.length; i++) {
    const [w0, a] = sail.set[i], [w1, b] = sail.set[i + 1];
    if (w <= w1 + 1e-12) return a.map((p, k) => lerp(p, b[k], (w - w0) / (w1 - w0)));
  }
  return sail.set[sail.set.length - 1][1];
}
const canvasAt = (sail, wind, trims) => poseLocal(sail, wind).map((p) => turned(sail.boom, xf(sail.bonesRec.world, p), trims));
/** The canvas's triangles and edges (one face's: the first nGrid vertices). */
function canvasTopology(sail) {
  const I = sail.geometry.indices, n = sail.bones.length, tris = [], edges = [], seen = new Set();
  for (let t = 0; t < I.length; t += 3) if (I[t] < n && I[t + 1] < n && I[t + 2] < n) tris.push([I[t], I[t + 1], I[t + 2]]);
  for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? `${p},${q}` : `${q},${p}`; if (!seen.has(k)) { seen.add(k); edges.push([p, q]); } }
  return { tris, edges };
}
for (const s of SAILS) Object.assign(s, canvasTopology(s));

// the spars and the standing rope: each mesh's rope and spar prisms as segments - their rings bunched along the prism
const RIG_KEY = /^galleon:(yard:|gaff$|rigging:)/;
function piecesOf(g, record) {
  const k = g.slots.findIndex((s) => s.record === record);
  if (k < 0) return [];
  const sm = g.subMeshes[k], P = g.positions, I = g.indices;
  const kf = (v) => Math.round(v * 1e5) + 0;
  const key = (i) => `${kf(P[i * 3])},${kf(P[i * 3 + 1])},${kf(P[i * 3 + 2])}`;
  const tris = [];
  for (let t = 0; t < sm.primitiveCount; t++) tris.push([0, 1, 2].map((j) => I[sm.startIndex + t * 3 + j]));
  const parent = tris.map((_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const owner = new Map();
  tris.forEach((t, i) => { const ks = t.map(key); for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const e = ks[x] < ks[y] ? `${ks[x]}|${ks[y]}` : `${ks[y]}|${ks[x]}`; if (owner.has(e)) { const a = find(i), b = find(owner.get(e)); if (a !== b) parent[a] = b; } else owner.set(e, i); } });
  const groups = new Map();
  tris.forEach((t, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); });
  return [...groups.values()].map((ts) => { const u = new Map(); for (const t of ts) for (const i of t) u.set(key(i), [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); return { pts: [...u.values()], tris: ts.map((t) => t.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])) }; });
}
function ringsOf(pts) {
  const c = scl(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  let v = [0.577, 0.577, 0.577];
  for (let k = 0; k < 80; k++) { const w = [dot(C[0], v), dot(C[1], v), dot(C[2], v)]; v = scl(w, 1 / (len(w) || 1)); }
  const order = pts.map((p) => [dot(sub(p, c), v), p]).sort((x, y) => x[0] - y[0]), bunches = [[order[0][1]]];
  for (let i = 1; i < order.length; i++) { if (order[i][0] - order[i - 1][0] > 0.04) bunches.push([]); bunches[bunches.length - 1].push(order[i][1]); }
  return bunches.map((s) => { const o = scl(s.reduce((q, p) => add(q, p), [0, 0, 0]), 1 / s.length); return { c: o, r: s.reduce((q, p) => { const d = sub(p, o); return q + len(sub(d, scl(v, dot(d, v)))); }, 0) / s.length }; });
}
const SEGS = [], FITTINGS = [];
for (const r of nodes) {
  const mf = compOf(r.node, 'MeshFilter');
  if (!mf || !RIG_KEY.test(mf.m_Mesh?.mesh ?? '')) continue;
  const g = MODELS.geometry(mf.m_Mesh.mesh), bm = boomOf(r);
  for (const [record, kind] of [[TEX.rope, 'rope'], [TEX.spar, 'spar']]) piecesOf(g, record).forEach((pc, i) => {
    const rings = ringsOf(pc.pts);
    for (let k = 0; k + 1 < rings.length; k++) SEGS.push({ name: `${r.name}.${kind}${i}.${k}`, kind, owner: r.name, boom: bm, a: xf(r.world, rings[k].c), b: xf(r.world, rings[k + 1].c), ra: rings[k].r, rb: rings[k + 1].r, r: Math.max(rings[k].r, rings[k + 1].r) });
  });
  for (const [record, kind] of [[TEX.trim, 'trim'], [TEX.iron, 'iron']]) piecesOf(g, record).forEach((pc, i) => FITTINGS.push({ name: `${r.name}.${kind}${i}`, kind, owner: r.name, pts: pc.pts.map((p) => xf(r.world, p)) }));
}
// what each segment is
for (const s of SEGS) {
  if (/Yard$/.test(s.owner)) { s.sail = s.owner.replace(/Yard$/, ''); s.role = s.kind === 'spar' ? 'yard' : Math.max(s.a[1], s.b[1]) > s.boom.world[13] + 0.3 ? 'lift' : 'footrope'; }
  else if (s.owner === 'MainGaffSpars') s.role = s.kind === 'rope' ? 'halyard' : Math.abs(s.a[1] - s.b[1]) < 0.05 ? 'boom' : 'gaff';
  else if (/Shrouds$/.test(s.owner)) { s.mast = s.owner === 'MainShrouds' ? 'main' : 'fore'; s.side = Math.sign(s.a[0] + s.b[0]); s.role = Math.abs(s.a[1] - s.b[1]) < 1e-3 ? 'ratline' : 'shroud'; }
  else if (s.owner === 'Stays') { const fwd = Math.max(s.a[2], s.b[2]) > 25; s.role = fwd ? (Math.min(s.a[1], s.b[1]) > 8 ? 'forestay' : 'bobstay') : 'mainstay'; }
  else if (s.owner === 'Backstays') { const head = s.a[1] > s.b[1] ? s.a : s.b; s.mast = head[2] > 4 ? 'fore' : 'main'; s.side = Math.sign(s.a[0] + s.b[0]); s.role = 'backstay'; }
  else s.role = s.owner === 'Flagstaff' ? 'flagstaff' : 'other';
  s.part = ['yard', 'lift', 'footrope'].includes(s.role) ? `${s.role}:${s.sail}` : ['shroud', 'ratline', 'backstay'].includes(s.role) ? `${s.role}:${s.mast}:${s.side}` : s.role;
}
const segAt = (s, trims) => ({ ...s, a: turned(s.boom, s.a, trims), b: turned(s.boom, s.b, trims) });

// the running rope: two-bone skinned lines, each end wherever its bone stands
const RUNNING = [];
for (const r of nodes) {
  const smr = compOf(r.node, 'SkinnedMeshRenderer');
  if (!smr || !/Line$/.test(r.name)) continue;
  const g = MODELS.geometry(smr.m_Mesh.mesh), bones = smr.m_Bones.map((b) => byPath.get(b.node));
  const a = posOf(bones[0]), b = posOf(bones[1]), u = scl(sub(b, a), 1 / len(sub(b, a)));
  let rr = 0;
  for (let v = 0; v < g.vertexCount; v++) { const d = sub(xf(r.world, [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]), a); rr = Math.max(rr, len(sub(d, scl(u, dot(d, u))))); }
  RUNNING.push({ name: r.name.replace(/Line$/, ''), bones, r: rr, geometry: g });
}
function boneAt(b, trims, winds) {
  const sail = SAILS.find((s) => s.bonesRec === b.parent);
  if (sail) return canvasAt(sail, winds[sail.key] ?? 0, trims)[+b.name.slice(1)];
  return turned(boomOf(b), posOf(b), trims);
}

// her solids: every mesh of hers outside the rig, in her frame. One convex (her masts, her bowsprit - each face's plane
// holds the whole within 2 cm) is solid through: an end inside it is made fast in it. Her hull, decks, castle and rails
// are shells: an end is made fast on one only on its surface. The crow's nest is a cup, solid only under its floor.
const SOLIDS = [];
for (const r of nodes) {
  const mf = compOf(r.node, 'MeshFilter');
  if (!mf?.m_Mesh?.mesh || RIG_KEY.test(mf.m_Mesh.mesh) || boomOf(r)) continue;
  let on = true;
  for (let p = r; p; p = p.parent) if (!p.node.active) on = false;
  const g = MODELS.geometry(mf.m_Mesh.mesh);
  if (!g || !on) continue;
  const P = g.positions, I = g.indices, tris = [];
  for (let t = 0; t < I.length; t += 3) tris.push([0, 1, 2].map((j) => xf(r.world, [P[I[t + j] * 3], P[I[t + j] * 3 + 1], P[I[t + j] * 3 + 2]])));
  const { min, max } = bboxOf(tris.flat());
  const pts = tris.flat(), planes = [];
  let concave = 0;
  for (const t of tris) {
    const n = cross(sub(t[1], t[0]), sub(t[2], t[0])), l = len(n);
    if (l < 1e-12) continue;
    const u = scl(n, 1 / l), d = dot(u, t[0]);
    let over = -Infinity, under = Infinity;
    for (const p of pts) { const e = dot(u, p) - d; over = Math.max(over, e); under = Math.min(under, e); }
    if (over <= 1e-4) planes.push([u, d]);
    else if (under >= -1e-4) planes.push([scl(u, -1), -d]);
    else concave = Math.max(concave, Math.min(over, -under));
  }
  const s = { name: r.name, tris, min, max, planes, floorY: null, convex: concave <= 0.02 };
  if (r.name === 'CrowsNest') s.floorY = Math.min(...tris.filter((t) => { const n = cross(sub(t[1], t[0]), sub(t[2], t[0])), l = len(n); return l > 1e-12 && n[1] / l > 0.9 && Math.min(t[0][1], t[1][1], t[2][1]) > min[1] + 0.1; }).map((t) => Math.max(t[0][1], t[1][1], t[2][1])));
  SOLIDS.push(s);
}
const solid = (name) => SOLIDS.find((s) => s.name === name);
const insideHull = (s, p, eps = 1e-6) => (s.convex || s.floorY != null) && s.planes.length > 0 && p.every((v, k) => v >= s.min[k] - eps && v <= s.max[k] + eps) && (s.floorY == null || p[1] <= s.floorY + eps) && s.planes.every(([u, d]) => dot(u, p) <= d + eps);
const surfaceDist = (s, p) => { let best = Infinity; for (const t of s.tris) best = Math.min(best, len(sub(p, ptTri(p, t[0], t[1], t[2])))); return best; };
/** The masthead is the main mast and the crow's nest over it: a rope made fast there may go into either. */
const headOf = (s) => (/MainMast|CrowsNest/.test(s.name) ? SOLIDS.filter((x) => /MainMast|CrowsNest/.test(x.name)) : [s]);
const depthIn = (s, p) => Math.max(0, ...headOf(s).map((h) => (insideHull(h, p) ? surfaceDist(h, p) : 0)));
/** ON_SOLID: how near its solid a rope's end lies to be on it. */
const ON_SOLID = 0.03;
const attachedTo = (p) => SOLIDS.filter((s) => p.every((v, k) => v >= s.min[k] - 0.1 && v <= s.max[k] + 0.1) && (insideHull(s, p) || surfaceDist(s, p) <= ON_SOLID));
/** A segment's crossings of her solids that are not its ends' own: an end on a surface enters it within 5 cm, an end
 *  deep (5 cm and more) inside a solid enters it once and stays in - never through it to its far side. */
function segmentThrough(a, b, r = 0) {
  const bb = bboxOf([a, b], r + 0.01), L = len(sub(b, a)), ends = [attachedTo(a), attachedTo(b)], out = [];
  const stays = (s, t0, t1) => { const n = Math.max(2, Math.ceil((t1 - t0) * L / 0.02)); for (let i = 1; i < n; i++) { const p = lerp(a, b, t0 + (t1 - t0) * i / n); if (!headOf(s).some((h) => insideHull(h, p, 0.002))) return false; } return true; };
  for (const s of SOLIDS) {
    if (!meets(bb, s)) continue;
    for (const t of s.tris) {
      const k = segTriCross(a, b, t[0], t[1], t[2]);
      if (k == null) continue;
      const okA = ends[0].includes(s) && (k * L <= 0.05 || (depthIn(s, a) >= 0.05 && stays(s, 0, k)));
      const okB = ends[1].includes(s) && ((1 - k) * L <= 0.05 || (depthIn(s, b) >= 0.05 && stays(s, k, 1)));
      if (!okA && !okB) out.push({ solid: s.name, at: lerp(a, b, k) });
    }
  }
  return out;
}
/** A canvas against her solids: its edges through her faces, her edges through its triangles. */
function canvasThrough(pts, edges, tris) {
  const bb = bboxOf(pts, 0.05), out = [];
  for (const s of SOLIDS) {
    if (!meets(bb, s)) continue;
    for (const [p, q] of edges) for (const t of s.tris) { const k = segTriCross(p, q, t[0], t[1], t[2]); if (k != null) { out.push({ solid: s.name, at: lerp(p, q, k) }); break; } }
    for (const t of s.tris) for (const [x, y] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) for (const c of tris) { const k = segTriCross(x, y, c[0], c[1], c[2]); if (k != null) { out.push({ solid: s.name, at: lerp(x, y, k) }); break; } }
  }
  return out;
}

// ── the sweep: her rig as parts, each a function of what it reads ──────────────────────────────────────────────────
const WINDS = [-1, -0.5, 0, 0.5, 1, 'stowed'];
const VALUES = { sq: [0, 15, -15, 30, -30, 45, -45], gf: [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90], ...Object.fromEntries([...SQUARES, 'MainGaff', 'Jib'].map((k) => [`w${k}`, WINDS])) };
const AUTO = (p) => (p.sq == null || Math.abs(p.sq) <= 30) && (p.gf == null || Math.abs(p.gf) <= 30);
const segPart = (id, list) => ({ id, segs: list, bb: bboxOf(list.flatMap((s) => [s.a, s.b]), Math.max(0, ...list.map((s) => s.r))) });
function parts() {
  const out = [];
  for (const k of [...SQUARES, 'MainGaff', 'Jib']) {
    const sail = sailBy(k), deps = [...(k === 'Jib' ? [] : k === 'MainGaff' ? ['gf'] : ['sq']), `w${k}`];
    out.push({ id: `canvas:${k}`, deps, build: (p) => { const pts = canvasAt(sail, p[`w${k}`], trimsOf(p.sq ?? 0, p.gf ?? 0)); return { id: `canvas:${k}`, pts, tris: sail.tris.map((t) => t.map((i) => pts[i])), edges: sail.edges.map(([i, j]) => [pts[i], pts[j]]), bb: bboxOf(pts) }; } });
  }
  const groups = new Map();
  for (const s of SEGS) { if (!groups.has(s.part)) groups.set(s.part, []); groups.get(s.part).push(s); }
  for (const [id, list] of groups) {
    const b = list[0].boom;
    out.push({ id, deps: !b ? [] : b.name.includes('Gaff') ? ['gf'] : ['sq'], build: (p) => segPart(id, list.map((s) => segAt(s, trimsOf(p.sq ?? 0, p.gf ?? 0)))) });
  }
  for (const rp of RUNNING) {
    const deps = new Set();
    for (const bn of rp.bones) {
      const sail = SAILS.find((s) => s.bonesRec === bn.parent);
      const bm = sail ? sail.boom : boomOf(bn);
      if (sail) deps.add(`w${sail.key}`);
      if (bm) deps.add(bm.name.includes('Gaff') ? 'gf' : 'sq');
    }
    const id = `running:${rp.name}`;
    out.push({ id, deps: [...deps], build: (p) => { const trims = trimsOf(p.sq ?? 0, p.gf ?? 0), w = Object.fromEntries(SAILS.map((s) => [s.key, p[`w${s.key}`] ?? 0])); return segPart(id, [{ name: rp.name, a: boneAt(rp.bones[0], trims, w), b: boneAt(rp.bones[1], trims, w), ra: rp.r, rb: rp.r, r: rp.r }]); } });
  }
  return out;
}
const NEAR_END = 0.35;
const nearEnd = (p, s) => Math.min(len(sub(p, s.a)), len(sub(p, s.b))) <= NEAR_END;
/** What may touch what, and where: a yard and its own footropes, lifts, canvas and (at the arm) braces; a sheet at its
 *  clew; the jib on its stay; the gaff sail on its gaff and boom; the gaff's own spars and halyard; the mainsheet at
 *  the boom's end; a side's ratlines on its shrouds; a part's own pieces; and two ropes where both are made fast
 *  together (each within NEAR_END of an end). */
function allowed(A, B, sa, sb, at) {
  const ia = A.id, ib = B.id, pair = (x, y) => (x.test(ia) && y.test(ib)) || (x.test(ib) && y.test(ia));
  const key = (id) => /:(\w+)$/.exec(id)?.[1];
  const rope = /^running:/.test(ia) ? sa : sb;
  if (ia === ib) return true;
  if (pair(/^yard:/, /^(footrope|lift|canvas):/) && key(ia) === key(ib)) return true;
  if (pair(/^yard:/, /^running:\w+Brace/)) { const y = key(/^yard:/.test(ia) ? ia : ib); if (rope.name.startsWith(y) && nearEnd(at, rope)) return true; }
  if (pair(/^canvas:ForeCourse$/, /^running:ForeCourseSheet/) && nearEnd(at, rope)) return true;
  if (pair(/^canvas:Jib$/, /^running:JibSheet/) && nearEnd(at, rope)) return true;
  if (pair(/^canvas:Jib$/, /^forestay$/) || pair(/^canvas:MainGaff$/, /^(gaff|boom)$/) || pair(/^(gaff|boom)$/, /^(gaff|boom|halyard)$/)) return true;
  if (pair(/^boom$/, /^running:MainGaffSheet$/) && nearEnd(at, rope)) return true;
  if (pair(/^shroud:/, /^ratline:/) && ia.split(':').slice(1).join() === ib.split(':').slice(1).join()) return true;
  return !!(sa && sb && nearEnd(at, sa) && nearEnd(at, sb));
}
const radiusAt = (s, t) => s.ra + (s.rb - s.ra) * t;
/** The clearance of two parts (metres between their surfaces; a canvas has none): the least, and where. Two canvases:
 *  0 where an edge of one crosses the other, else their nearest grid points' distance (it reads high, never low). */
function clearance(A, B) {
  let best = { c: Infinity };
  if (A.segs && B.segs) {
    for (const sa of A.segs) for (const sb of B.segs) { const r = segSeg(sa.a, sa.b, sb.a, sb.b), c = r.d - radiusAt(sa, r.s) - radiusAt(sb, r.t); if (c < best.c && !allowed(A, B, sa, sb, r.c1)) best = { c, at: r.c1 }; }
    return best;
  }
  if (A.pts && B.pts) {
    if (!meets(bboxOf(A.pts, 0.3), B.bb)) return best;
    for (const [P, Q] of [[A, B], [B, A]]) for (const [p, q] of P.edges) { if (!meets(bboxOf([p, q], 0.3), Q.bb)) continue; for (const t of Q.tris) { const x = segTriCross(p, q, t[0], t[1], t[2]); if (x != null) return { c: 0, at: lerp(p, q, x) }; } }
    for (const p of A.pts) for (const q of B.pts) { const d = len(sub(p, q)); if (d < best.c) best = { c: d, at: p }; }
    return best;
  }
  const [S, C] = A.segs ? [A, B] : [B, A];
  for (const s of S.segs) {
    if (!meets(bboxOf([s.a, s.b], s.r + 0.5), C.bb)) continue;   // past half a metre, no nearer than that
    for (const t of C.tris) { const r = segTriDist(s.a, s.b, t[0], t[1], t[2]), c = r.d - s.r; if (c < best.c && !allowed(S, C, s, null, r.at)) best = { c, at: r.at }; }
  }
  return best;
}
function* product(deps, i = 0, acc = {}) { if (i === deps.length) { yield { ...acc }; return; } for (const v of VALUES[deps[i]]) { acc[deps[i]] = v; yield* product(deps, i + 1, acc); } }
let _sweep = null;
/** Every pair of her parts over the product of what they read: { A, B, auto: their least clearance inside the auto-trim's
 *  range, past: beyond it } - each with where, and at what. */
function sweep() {
  if (_sweep) return _sweep;
  const F = parts(), cache = new Map(), rows = [];
  const built = (f, p) => { const k = `${f.id}|${f.deps.map((d) => p[d]).join(',')}`; if (!cache.has(k)) cache.set(k, f.build(p)); return cache.get(k); };
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const A = F[i], B = F[j], deps = [...new Set([...A.deps, ...B.deps])];
    let auto = { c: Infinity }, past = { c: Infinity };
    for (const p of product(deps)) { const r = clearance(built(A, p), built(B, p)); if (AUTO(p)) { if (r.c < auto.c) auto = { ...r, p }; } else if (r.c < past.c) past = { ...r, p }; }
    rows.push({ A: A.id, B: B.id, auto, past });
  }
  _sweep = { rows, parts: F, built };
  return _sweep;
}
const row = (a, b) => sweep().rows.find((r) => (r.A === a && r.B === b) || (r.A === b && r.B === a));
const shown = (r) => `${r.c.toFixed(3)} m${r.at ? ` at ${fmt(r.at)}` : ''}${r.p ? ` ${JSON.stringify(r.p)}` : ''}`;

// ── the pins ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A rigid matrix's inverse. */
function invRigid(m) {
  const o = new Float32Array(16);
  o[0] = m[0]; o[1] = m[4]; o[2] = m[8]; o[4] = m[1]; o[5] = m[5]; o[6] = m[9]; o[8] = m[2]; o[9] = m[6]; o[10] = m[10];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]); o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]); o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]); o[15] = 1;
  return o;
}

test('AUDIT GALLEON R1 a square sail\'s head is bent to its yard in every pose - its head row 6 cm and less off the yard (never in it), aback, hanging, full, every blend between and furled - and its furled roll seated on the yard, each column\'s nearest turn 4 cm and less off it and none 0.3 m out (the full belly stood the course\'s head 0.77 m off its yard, the topsails\' 0.59-0.62 m; the furled roll\'s nearest turn hung 0.11-0.17 m off it) (mutants: the head bellied, the head off the arms\' taper, the roll hung off the yard)', (t) => {
  const bad = [];
  for (const key of SQUARES) {
    const sail = sailBy(key), back = invRigid(sail.bonesRec.world);
    // the yard as built: its two tapered halves (axis and radius), in the frame its bones stand in
    const halves = SEGS.filter((s) => s.role === 'yard' && s.sail === key).map((s) => ({ a: xf(back, s.a), b: xf(back, s.b), ra: s.ra, rb: s.rb }));
    assert.equal(halves.length, 2, `${key}: a yard of two tapered halves`);
    const offYard = (p) => Math.min(...halves.map((h) => { const r = segSeg(p, p, h.a, h.b); return r.d - radiusAt(h, r.t); }));
    const [NU] = sail.grid, said = [];
    for (const w of WINDS) {
      const pts = poseLocal(sail, w), head = pts.slice(0, NU).map(offYard);
      said.push(`${w} ${Math.min(...head).toFixed(3)}-${Math.max(...head).toFixed(3)}`);
      head.forEach((g, i) => { if (!(g >= -0.005 && g <= 0.06)) bad.push(`${key} at ${w}: head point ${i} ${g.toFixed(3)} m off its yard`); });
      if (w !== 'stowed') continue;
      // the roll: its turns stand 1.25 rad apart round it, so a column's nearest is within 0.35 rad of the yard's side
      const all = pts.map(offYard), near = [], far = [];
      for (let i = 0; i < NU; i++) { const col = all.filter((_, k) => k % NU === i); near.push(Math.min(...col)); far.push(Math.max(...col)); }
      said.push(`the roll's nearest ${Math.min(...near).toFixed(3)}-${Math.max(...near).toFixed(3)}, its farthest ${Math.max(...far).toFixed(3)}`);
      near.forEach((g, i) => { if (!(g >= -0.005 && g <= 0.04)) bad.push(`${key} furled: column ${i} ${g.toFixed(3)} m off its yard at its nearest`); });
      far.forEach((g, i) => { if (!(g <= 0.3)) bad.push(`${key} furled: column ${i} ${g.toFixed(3)} m out from its yard`); });
    }
    t.diagnostic(`${key}'s head off its yard (m): ${said.join('; ')}`);
  }
  assert.deepEqual(bad, [], 'every square sail\'s head on its yard');
});

test('AUDIT GALLEON R2 the jib set clear of the fore topsail, its yard, footropes and lifts, and the forestay clear of them, at every trim to the manual 45, every pose either sail stands in (the jib was set 0.17 m into the yard and the stay 0.095 m into it at 30, the topsail set full 0.045 m through the stay and against the jib); the stay\'s head and the jib\'s 0.2 m and more over the yard, the stay\'s under the fore masthead, the jib\'s clew 19.5 m and more forward (mutants: the old yard, the old stay, the old clew)', (t) => {
  const bad = [];
  for (const a of ['canvas:Jib', 'forestay']) for (const b of ['yard:ForeTopsail', 'canvas:ForeTopsail', 'footrope:ForeTopsail', 'lift:ForeTopsail']) {
    const r = row(a, b);
    t.diagnostic(`${a} x ${b}: ${shown(r.auto)} | to 45: ${shown(r.past)}`);
    if (!(r.auto.c > 0 && r.past.c > 0)) bad.push(`${a} x ${b}: ${shown(r.auto.c <= 0 ? r.auto : r.past)}`);
  }
  const yardTop = Math.max(...SEGS.filter((s) => s.role === 'yard' && s.sail === 'ForeTopsail').flatMap((s) => [s.a[1] + s.ra, s.b[1] + s.rb]));
  const stay = SEGS.find((s) => s.role === 'forestay'), stayHead = stay.a[1] > stay.b[1] ? stay.a : stay.b, masthead = solid('ForeMast').max[1];
  const jib = sailBy('Jib'), [NU, NV] = jib.grid, rest = canvasAt(jib, 0, trimsOf(0, 0));
  const rows = Array.from({ length: NV }, (_, j) => rest.slice(j * NU, (j + 1) * NU)), mean = (r) => r.reduce((a, p) => a + p[1], 0) / r.length;
  const head = rows.reduce((h, r) => (mean(r) > mean(h) ? r : h)), corners = [rest[0], rest[NU - 1], rest[(NV - 1) * NU], rest[NV * NU - 1]];
  const clew = corners.sort((p, q) => p[1] - q[1]).slice(0, 2).sort((p, q) => p[2] - q[2])[0];   // the lower two: the tack forward, the clew aft
  const jibHead = Math.min(...head.map((p) => p[1]));
  t.diagnostic(`the fore topsail's yard's top ${yardTop.toFixed(3)}, the forestay's head ${stayHead[1].toFixed(3)}, the jib's head ${jibHead.toFixed(3)}, the fore masthead ${masthead.toFixed(3)}; the jib's clew ${fmt(clew)}`);
  if (!(stayHead[1] - yardTop >= 0.2 && jibHead - yardTop >= 0.2)) bad.push('the forestay and the jib\'s head 0.2 m and more over the fore topsail\'s yard');
  if (!(stayHead[1] < masthead)) bad.push('the forestay made fast under the fore masthead');
  if (!(clew[2] >= 19.5)) bad.push(`the jib's clew forward (${clew[2].toFixed(2)})`);
  assert.deepEqual(bad, [], 'the jib and its stay clear of the fore topsail');
});

test('AUDIT GALLEON R3 the main stay clear of the main topsail - its canvas any way it stands, its yard, footropes and lifts - at every trim to the manual 45 (it ran 0.12 m into the yard at 30, 0.156 m at 45, and 0.05 m through the topsail set) (mutants: the old main stay)', (t) => {
  const bad = [];
  for (const b of ['yard:MainTopsail', 'canvas:MainTopsail', 'footrope:MainTopsail', 'lift:MainTopsail']) {
    const r = row('mainstay', b);
    t.diagnostic(`mainstay x ${b}: ${shown(r.auto)} | to 45: ${shown(r.past)}`);
    if (!(r.auto.c > 0 && r.past.c > 0)) bad.push(`mainstay x ${b}: ${shown(r.auto.c <= 0 ? r.auto : r.past)}`);
  }
  assert.deepEqual(bad, [], 'the main stay clear of the main topsail');
});

/** The clashes the manual trim past the auto-trim's range still makes - each the gaff swung 45 and more, or a square
 *  yard braced to 45: the gaff's sweep crosses the main shrouds' sector wherever they stand and its peak passes under
 *  the main topsail's foot at 60-90 (a shorter topsail or a lower peak would be another ship); the mainsheet to her
 *  deck crosses the main shrouds with the boom out to 75-90; the halyard and a main topsail brace meet with both
 *  braced to 45 to one side; a fore topsail brace touches the gaff sail squared across at 90, a fore course brace from
 *  its arm swung forward to 45 the aftmost fore shroud (2 cm). */
const PAST_AUTO = new Set([
  'canvas:MainTopsail x canvas:MainGaff', 'canvas:MainTopsail x halyard', 'canvas:MainTopsail x gaff', 'yard:MainTopsail x halyard',
  'canvas:MainGaff x shroud:main:-1', 'canvas:MainGaff x shroud:main:1', 'canvas:MainGaff x ratline:main:-1', 'canvas:MainGaff x ratline:main:1',
  'halyard x shroud:main:-1', 'halyard x shroud:main:1', 'halyard x running:MainTopsailBracePort', 'halyard x running:MainTopsailBraceStarboard',
  'shroud:main:-1 x running:MainGaffSheet', 'shroud:main:1 x running:MainGaffSheet', 'ratline:main:1 x running:MainGaffSheet',   // AUDIT GALLEON-2 RG7: not 'ratline:main:-1 x running:MainGaffSheet', which never met
  'canvas:MainGaff x running:ForeTopsailBracePort', 'canvas:MainGaff x running:ForeTopsailBraceStarboard',
  'shroud:fore:-1 x running:ForeCourseBracePort', 'shroud:fore:1 x running:ForeCourseBraceStarboard',
]);
const pairKey = (r) => (PAST_AUTO.has(`${r.B} x ${r.A}`) ? `${r.B} x ${r.A}` : `${r.A} x ${r.B}`);

test('AUDIT GALLEON R4 nothing of her rig meets what it is not made fast to at any trim the auto-trim sets (squares and gaff to 30), any sail at any Wind and furled - canvas, yards, gaff, boom, stays, shrouds, ratlines, footropes, lifts, braces and sheets, each against every other; past it only the clashes PAST_AUTO names; and no rope, spar or canvas through her hull, decks, castle, rails, masts, nest or bowsprit at any trim (32 pairs met inside the auto-trim\'s range: every square sail set aback at 30 through its mast\'s shrouds and ratlines, the fore course\'s yard through them, each furled roll through its footropes, the course\'s sheets through the foremost fore shroud, its braces through the fore backstays, the jib through the fore topsail and its yard, each stay through its topsail and yard; and ten of her parts ran through her: the gaff sail through the main mast, the main topsail\'s lifts through the crow\'s nest, the bobstay through the bowsprit and her stem, the backstays through the castle rail and the fore mast, the mainsheet through the castle and its parapet) (mutants: the shrouds forward again, a yard\'s footropes before it, the course sheets aft, the fore braces forward of the gangway, the gaff sail on the mast)', (t) => {
  const { rows, parts: F, built } = sweep();
  const autoBad = rows.filter((r) => r.auto.c <= 0).map((r) => `${r.A} x ${r.B}: ${shown(r.auto)}`);
  for (const r of rows.filter((x) => x.auto.c < Infinity).sort((x, y) => x.auto.c - y.auto.c).slice(0, 6)) t.diagnostic(`closest in the auto-trim's range: ${r.A} x ${r.B} ${shown(r.auto)}`);
  const past = rows.filter((r) => r.past.c <= 0);
  for (const r of past) t.diagnostic(`past the auto-trim: ${pairKey(r)} ${shown(r.past)}`);
  const unnamed = past.map(pairKey).filter((k) => !PAST_AUTO.has(k));
  // her solids, at every trim
  const through = new Set();
  for (const f of F) for (const p of product(f.deps)) {
    const e = built(f, p);
    const hits = e.segs ? e.segs.flatMap((s) => segmentThrough(s.a, s.b, s.r)) : canvasThrough(e.pts, e.edges, e.tris);
    for (const h of hits) through.add(`${f.id} through ${h.solid}`);
  }
  t.diagnostic(`${autoBad.length} pairs meet inside the auto-trim's range, ${past.length} past it (${unnamed.length} unnamed); through her solids: ${[...through].join(', ') || 'none'}`);
  assert.deepEqual(autoBad, [], 'clear at every trim the auto-trim sets');
  assert.deepEqual(unnamed, [], 'past the auto-trim, no clash but the ones named');
  assert.deepEqual([...through], [], 'nothing of her rig through her');
});

test('AUDIT GALLEON-2 RG7: every pair PAST_AUTO names clashes past the auto-trim - a name that never clashes would let a new clash on that pair pass unseen (\'ratline:main:-1 x running:MainGaffSheet\' was named and never met: 20 names, 19 clashing) (mutants: a stale name)', (t) => {
  const clashing = new Set(sweep().rows.filter((r) => r.past.c <= 0).map(pairKey));
  const stale = [...PAST_AUTO].filter((k) => !clashing.has(k));
  t.diagnostic(`${PAST_AUTO.size} names, ${[...PAST_AUTO].filter((k) => clashing.has(k)).length} clashing`);
  assert.deepEqual(stale, [], 'every name a clash');
});

test('AUDIT GALLEON R5/G9 her rig\'s hit boxes follow her trim: each square sail\'s rides its yard\'s boom and her gaff sail\'s its gaff\'s (rigBoxesOf turns each about its mast\'s axis by its boom\'s own rotation), her jib\'s three lie along its luff, leech and foot - every point of her set canvas inside one at every trim to the manual 45 and the gaff\'s 90, at any Wind, heeled; each box three quarters and more canvas across its face; the chain shot\'s band over her roof; a Large Boat\'s, a galley\'s and a Carrack\'s boxes as they stood (they stood still: 261,913 of 517,720 points of her set canvas lay outside every one) (mutants: the boom unread, the pivot dropped, a box home, the gaff\'s box on a yard\'s boom, the jib\'s one box, its boxes square or pitched the wrong way, a topsail bellied as the course, the band under her roof)', async (t) => {
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false } });
  const boat = s.place(HULL.SmallShip, 0, [37, 2, -91], [0.6, 0, 0.8]);
  boat.MeshObject.localRotation = quatEuler(3, 0, -8);   // her heel and pitch: the boxes ride her MeshObject
  for (const sail of boat.Sails) stowSail(animatorOf(sail), false);   // PIN MOVED (AUDIT GALLEON-2 RG3): her canvas set - a furled sail's box is gone
  const rig = hullBuild(HULL.SmallShip).rig, mo = boat.MeshObject, lp = mo.localPosition;
  // each boom's box on its own boom - the k-th of Come Sail Away's walk - and turned about where that boom stands
  for (const box of rig.filter((b) => b.boom != null)) {
    const b = boat.Booms[box.boom];
    assert.ok(b && b.children[0].name.includes('Sail'), `box on boom ${box.boom}: ${b?.name}`);
    const off = len(sub(xf(mo.worldMatrix(), sub(box.pivot, lp)), b.position));
    assert.ok(off < 1e-3, `${b.name} turns its box about its own pivot (${off.toFixed(4)} m off it)`);
  }
  const sails = boat.Sails.map((sail) => {
    const bonesNode = sail.children.find((c) => /SailBones$/.test(c.name));
    return { sail, bones: bonesNode.children.slice().sort((a, b) => +a.name.slice(1) - +b.name.slice(1)), own: SAILS.find((x) => x.name === sail.name), k: boat.Booms.indexOf(sail.parent) };
  });
  const pose = (sl, w) => { poseLocal(sl.own, w).forEach((p, k) => { sl.bones[k].localPosition = [...p]; }); return sl.bones.map((b) => b.position); };
  const samplesOf = (pts, tris) => { const out = [...pts]; for (const [a, b, c] of tris) for (let m = 1; m < 6; m++) for (let n = 1; n < 6 - m; n++) { const w1 = m / 6, w2 = n / 6, w0 = 1 - w1 - w2; out.push([0, 1, 2].map((k) => pts[a][k] * w0 + pts[b][k] * w1 + pts[c][k] * w2)); } return out; };
  const inBox = (bx, p) => toBoxLocal(bx, p).every((v, k) => Math.abs(v) <= bx.h[k] + 1e-4);
  let n = 0;
  const out = [];
  for (const sq of VALUES.sq) for (const gf of VALUES.gf) {
    for (const b of boat.Booms) b.localRotation = quatAngleAxis(b.name.includes('Square') ? sq : gf, [0, 1, 0]);
    const boxes = rigBoxesOf(boat);
    for (const sl of sails) {
      if (sl.k >= 0 && (sl.sail.name.includes('Square') ? gf !== 0 : sq !== 0)) continue;   // a sail reads its own boom
      for (const [w] of sl.own.set) for (const p of samplesOf(pose(sl, w), sl.own.tris)) { n++; if (!boxes.some((bx) => inBox(bx, p))) out.push(`${sl.sail.name} at sq ${sq} gf ${gf} wind ${w}: ${fmt(p)}`); }
    }
  }
  t.diagnostic(`${n} points of her set canvas (every grid point and its triangles' insides), ${out.length} outside every box`);
  assert.deepEqual(out.slice(0, 6), [], 'every point of her set canvas in a box');
  // each box's fill: its own sail's canvas across its broad face (the box's axis most along the canvas's normal dropped)
  for (const b of boat.Booms) b.localRotation = quatAngleAxis(b.name.includes('Square') ? 30 : -30, [0, 1, 0]);
  const boxes = rigBoxesOf(boat);
  const in2 = (p, a, b, c) => { const e = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]); const d1 = e(a, b, p), d2 = e(b, c, p), d3 = e(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
  boxes.forEach((bx, i) => {
    const sl = rig[i].boom != null ? sails.find((q) => q.k === rig[i].boom) : sails.find((q) => q.k < 0);
    let worst = Infinity;
    for (const [w] of sl.own.set) {
      const pts = pose(sl, w).map((p) => toBoxLocal(bx, p)), nrm = [0, 0, 0];
      for (const [a, b, c] of sl.own.tris) { const nn = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a])); for (let k = 0; k < 3; k++) nrm[k] += nn[k]; }
      const drop = [0, 1, 2].reduce((m, k) => (Math.abs(nrm[k]) > Math.abs(nrm[m]) ? k : m), 0), [ka, kb] = [0, 1, 2].filter((k) => k !== drop);
      let hit = 0;
      for (let a = 0; a < 90; a++) for (let c = 0; c < 90; c++) { const q = [bx.h[ka] * ((2 * a + 1) / 90 - 1), bx.h[kb] * ((2 * c + 1) / 90 - 1)]; if (sl.own.tris.some(([x, y, z]) => in2(q, [pts[x][ka], pts[x][kb]], [pts[y][ka], pts[y][kb]], [pts[z][ka], pts[z][kb]]))) hit++; }
      worst = Math.min(worst, hit / 8100);
    }
    t.diagnostic(`box ${i} (${sl.sail.name}): canvas across ${(worst * 100).toFixed(1)}% of its face, the worst of its Winds`);
    assert.ok(worst >= 0.7, `box ${i} (${sl.sail.name}) three parts canvas and more (${(worst * 100).toFixed(1)}%)`);
  });
  // hers reach out of her hull's box (over her roof, past her stem or her side), and the chain shot's band starts at her
  // roof; the other hulls' boxes stand as they did - each turned with her hull alone, whatever her booms do
  const sb = hullBuild(HULL.SmallShip);
  for (const [mn, mx] of sb.rig) assert.ok(mx[1] > sb.top || mx[2] > sb.bowZ || mn[2] < sb.aftZ || mx[0] > sb.halfWidth || mn[0] < -sb.halfWidth, 'each of her boxes reaches out of her hull\'s box');
  assert.deepEqual(rigBand(sb), [sb.top, Math.max(...sb.rig.map(([, mx]) => mx[1]))], 'the band from her roof to her highest box\'s top');
  // PIN MOVED (SHIPS-2, 2026-10-07): hulls 4 and 1 are Mac's carrack and Tiny Ship - their boxes ride their booms and
  // their sails as hers do (test/ships2_carrack.test.js, test/ships2_largeboat.test.js); the galley's stand as they did
  const theirs = [HULL.SmallShip, HULL.Carrack, HULL.LargeBoat];
  for (const b of HULL_BUILDS.filter((x) => !theirs.includes(x.hull))) for (const box of b.rig) assert.ok(box.boom == null && box.obb == null, `hull ${b.hull}'s boxes as they stood`);
  for (const hull of [HULL.Carrack, HULL.LargeBoat]) assert.ok(hullBuild(hull).rig.some((box) => box.boom != null), `hull ${hull}'s boxes ride her booms`);
  for (const hull of [HULL.LargeGalley]) {
    const h = await sea({ hull });
    h.boat.MeshObject.localRotation = quatEuler(0, 0, 9);
    for (const b of h.boat.Booms) b.localRotation = quatAngleAxis(40, [0, 1, 0]);
    const m = h.boat.MeshObject.worldMatrix(), hp = h.boat.MeshObject.localPosition;
    const want = hullBuild(hull).rig.map(([mn, mx]) => orientedBox(m, [0, 1, 2].map((k) => (mn[k] + mx[k]) / 2 - hp[k]), [0, 1, 2].map((k) => (mx[k] - mn[k]) / 2)));
    assert.deepEqual(rigBoxesOf(h.boat), want, `hull ${hull}'s boxes turned with her hull alone`);
  }
});

test('AUDIT GALLEON R6 the mainsheet belayed on her main deck at the castle\'s foot, clear of its door, and never through the castle, its parapet or a stair at any swing of the gaff to 90 (it was belayed at (0, 11.05, -10.6), 4.85 m over her main deck, and ran through the castle and its parapet) (mutants: the old belay, the belay in the doorway, the belay under the stair)', (t) => {
  const sheet = RUNNING.find((r) => r.name === 'MainGaffSheet'), foot = posOf(sheet.bones[1]);
  const deck = solid('MainDeck'), door = solid('CastleDoor'), castle = solid('Castle'), bad = [];
  if (!(surfaceDist(deck, foot) <= ON_SOLID && foot[1] >= deck.max[1] - ON_SOLID)) bad.push(`on her main deck (${fmt(foot)}, ${surfaceDist(deck, foot).toFixed(3)} m off it)`);
  if (!(Math.abs(foot[0]) >= door.max[0] + 0.3)) bad.push(`clear of the castle's door (|x| ${Math.abs(foot[0]).toFixed(2)} by its ${door.max[0].toFixed(2)})`);
  if (!(foot[2] > castle.max[2] && foot[2] - castle.max[2] <= 0.6)) bad.push(`at the castle's foot (${(foot[2] - castle.max[2]).toFixed(2)} m forward of it)`);
  const tilt = [];
  for (const gf of VALUES.gf) {
    const trims = trimsOf(0, gf), a = boneAt(sheet.bones[0], trims, {}), b = boneAt(sheet.bones[1], trims, {});
    for (const h of segmentThrough(a, b, sheet.r)) bad.push(`with the gaff at ${gf} through ${h.solid} at ${fmt(h.at)}`);
    // its boom-end ring rides the boom: how far off square to the rope it stands (square to it at rest)
    const n = quatRotate(quatAngleAxis(gf, [0, 1, 0]), sub(boneAt(sheet.bones[1], trimsOf(0, 0), {}), boneAt(sheet.bones[0], trimsOf(0, 0), {}))), d = sub(b, a);
    tilt.push(`${gf}:${(Math.acos(Math.min(1, Math.abs(dot(n, d)) / (len(n) * len(d)))) * 180 / Math.PI).toFixed(0)}`);
  }
  t.diagnostic(`the mainsheet's belay ${fmt(foot)}; its boom-end ring off square to it, by the gaff's swing (deg): ${tilt.join(' ')}`);
  assert.deepEqual(bad, [], 'the mainsheet on her deck, clear of her castle');
});

/** Every rope's end and what it is made fast to (her solids by name). */
function ropeEnds() {
  const out = [];
  for (const s of SEGS) {
    const [hi, lo] = s.a[1] > s.b[1] ? [s.a, s.b] : [s.b, s.a];
    if (s.role === 'forestay') out.push(['forestay head', hi, ['ForeMast']], ['forestay foot', lo, ['Bowsprit']]);
    else if (s.role === 'mainstay') out.push(['main stay head', hi, ['MainMast', 'CrowsNest']], ['main stay foot', lo, ['ForeMast']]);
    else if (s.role === 'bobstay') out.push(['bobstay head', hi, ['Bowsprit']], ['bobstay foot', lo, ['NewGalleon']]);
    else if (s.role === 'backstay') out.push([`${s.mast} backstay head`, hi, [s.mast === 'main' ? 'MainMast' : 'ForeMast']], [`${s.mast} backstay foot`, lo, [s.mast === 'main' ? 'CastleRail' : 'NewGalleon']]);
    else if (s.role === 'shroud') out.push([`${s.mast} shroud head`, hi, [s.mast === 'main' ? 'MainMast' : 'ForeMast']]);
    else if (s.role === 'lift') out.push([`${s.sail} lift head`, hi, s.sail.startsWith('Main') ? ['MainMast', 'CrowsNest'] : ['ForeMast']]);
    else if (s.role === 'halyard') out.push(['peak halyard head', hi, ['MainMast']]);
    else if (s.role === 'flagstaff') out.push(['flagstaff foot', lo, ['CrowsNest', 'MainMast']]);
  }
  for (const r of RUNNING) out.push([`${r.name} belay`, posOf(r.bones[1]), /^MainTopsailBrace/.test(r.name) ? ['CastleRail'] : r.name === 'MainGaffSheet' ? ['MainDeck'] : ['NewGalleon']]);
  return out;
}

test('AUDIT GALLEON R7 every rope\'s end on what it is made fast to - a stay\'s, a shroud\'s, a backstay\'s, a lift\'s and the halyard\'s head on or in its masthead, the stays\' feet on the bowsprit, the fore mast and her stem, every brace and sheet on her bulwark\'s top, her castle rail\'s or her deck - ON_SOLID and less off its surface, or in a mast (15 were off: the fore topsail\'s lifts met 0.71 m over the fore masthead, the main topsail\'s in the crow\'s nest 0.18 m over its floor, the jib\'s sheets in the air 0.75 m over her deck, the main topsail\'s braces 7-10 cm off the castle rail, the main backstays 8.5-13 cm, the fore backstays 5.5 cm outboard of her side, the forestay\'s head 6.3 cm forward of its mast, the bobstay\'s foot 6.4 cm off her stem) (mutants: a lift in the air, the main topsail\'s lifts through the nest, the jib sheets in the air, a brace off the rail, a backstay off it)', (t) => {
  const bad = [], ends = ropeEnds();
  for (const [what, p, to] of ends) {
    const on = to.map((name) => { const s = solid(name); return { name, d: insideHull(s, p) ? 0 : surfaceDist(s, p) }; }).sort((x, y) => x.d - y.d)[0];
    if (!(on.d <= ON_SOLID)) bad.push(`${what} ${fmt(p)}: ${on.d.toFixed(3)} m off ${on.name}`);
  }
  t.diagnostic(`${ends.length} rope ends, ${bad.length} off what they are made fast to`);
  assert.deepEqual(bad, [], 'every rope\'s end on its solid');
});

test('AUDIT GALLEON R9 the bobstay from the bowsprit\'s underside to her stem - never inside the spar (it began on the bowsprit\'s end, 0.58 m from its underside, ran 1.10 m inside the spar and ended inside her stem, 6.4 cm from its face) (mutants: the old head, the old foot)', (t) => {
  const bob = SEGS.find((s) => s.role === 'bobstay'), head = bob.a[1] > bob.b[1] ? bob.a : bob.b, foot = head === bob.a ? bob.b : bob.a;
  const bowsprit = solid('Bowsprit'), under = bowsprit.tris.filter((tr) => { const n = cross(sub(tr[1], tr[0]), sub(tr[2], tr[0])); return n[1] / len(n) < -0.8; });
  assert.ok(under.length > 0, 'the bowsprit has an underside');
  const d = Math.min(...under.map((tr) => len(sub(head, ptTri(head, tr[0], tr[1], tr[2])))));
  let inside = 0;
  for (let i = 0; i < 400; i++) if (insideHull(bowsprit, lerp(head, foot, (i + 0.5) / 400))) inside += len(sub(foot, head)) / 400;
  t.diagnostic(`its head ${fmt(head)} ${d.toFixed(3)} m off the bowsprit's underside, ${inside.toFixed(2)} m of it inside the spar; its foot ${fmt(foot)} ${surfaceDist(solid('NewGalleon'), foot).toFixed(3)} m off her stem`);
  assert.ok(d <= ON_SOLID, `its head on the bowsprit's underside (${d.toFixed(3)} m)`);
  assert.ok(inside <= 0.05, `never along inside the spar (${inside.toFixed(2)} m)`);
  assert.ok(surfaceDist(solid('NewGalleon'), foot) <= ON_SOLID, 'its foot on her stem');
  assert.deepEqual(segmentThrough(bob.a, bob.b, bob.r).map((h) => `${h.solid} at ${fmt(h.at)}`), [], 'never through the spar or her bow');
});

test('AUDIT GALLEON R10 her channels against her side (they stood 3.1-3.5 cm off it), each deadeye on its channel and its chainplate down to her planking (they hung under the channel 0.33-0.40 m off her), every ratline\'s end on its shroud\'s rope (244 of 408 were off it), and every boom on its mast\'s axis as the bake measures it (each pivoted 6.5-6.9 cm forward of it) (mutants: the channel off her side, a chainplate in the air, the ratlines off the rope, the old axes)', (t) => {
  const hull = solid('NewGalleon'), bad = [];
  const sideX = (y, z, s) => { let best = null; for (const tr of hull.tris) { const k = segTriCross([s * 8, y, z], [0, y, z], tr[0], tr[1], tr[2]); if (k != null && (best == null || k < best)) best = k; } return best == null ? null : s * 8 * (1 - best); };
  // the channels: the long trim pieces of the shroud meshes
  const channels = FITTINGS.filter((f) => /Shrouds/.test(f.owner) && f.kind === 'trim').map((f) => ({ f, bb: bboxOf(f.pts) })).filter(({ bb }) => bb.max[2] - bb.min[2] > 1);
  assert.equal(channels.length, 4, 'a channel each side of each mast');
  const gaps = [];
  for (const { f, bb } of channels) {
    const s = Math.sign(bb.max[0] + bb.min[0]), inner = s > 0 ? bb.min[0] : bb.max[0];
    let most = -Infinity;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 4; j++) { const z = bb.min[2] + (bb.max[2] - bb.min[2]) * i / 16, y = bb.min[1] + (bb.max[1] - bb.min[1]) * j / 4; most = Math.max(most, s * (inner - sideX(y, z, s))); }
    gaps.push(`${f.owner} ${s > 0 ? 'starboard' : 'port'} ${(most * 1000).toFixed(1)} mm`);
    if (!(most <= 0.005)) bad.push(`${f.owner}'s ${s > 0 ? 'starboard' : 'port'} channel ${(most * 1000).toFixed(1)} mm off her side`);
    const deadeyes = FITTINGS.filter((q) => q.owner === f.owner && q.kind === 'trim' && q !== f).map((q) => bboxOf(q.pts)).filter((d) => Math.sign(d.max[0] + d.min[0]) === s && d.max[2] - d.min[2] < 0.5);
    if (!(deadeyes.length >= 3 && deadeyes.every((d) => Math.abs(d.min[1] - bb.max[1]) < 0.01 && d.min[2] >= bb.min[2] && d.max[2] <= bb.max[2] && Math.abs(s > 0 ? d.max[0] : d.min[0]) <= Math.abs(s > 0 ? bb.max[0] : bb.min[0]) + 1e-3))) bad.push(`${f.owner}'s ${s > 0 ? 'starboard' : 'port'} deadeyes off their channel`);
  }
  // the chainplates: from their deadeye's channel down to her planking
  const plates = [];
  for (const f of FITTINGS.filter((q) => /Shrouds/.test(q.owner) && q.kind === 'iron')) {
    const lo = f.pts.reduce((m, p) => (p[1] < m[1] ? p : m)), ring = f.pts.filter((p) => p[1] < lo[1] + 0.1), foot = scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length);
    const top = f.pts.reduce((m, p) => (p[1] > m[1] ? p : m)), off = surfaceDist(hull, foot);
    plates.push(off);
    if (!(off <= ON_SOLID)) bad.push(`${f.name}'s foot ${off.toFixed(3)} m off her planking`);
    if (!channels.some(({ bb }) => top[1] >= bb.min[1] && Math.abs(top[2] - (bb.min[2] + bb.max[2]) / 2) <= (bb.max[2] - bb.min[2]) / 2)) bad.push(`${f.name} not from its channel`);
  }
  // the ratlines' ends on the shrouds' ropes (their centrelines, within a shroud's radius)
  const shrouds = SEGS.filter((s) => s.role === 'shroud');
  let off = 0, n = 0;
  for (const r of SEGS.filter((s) => s.role === 'ratline')) for (const e of [r.a, r.b]) { n++; if (!shrouds.some((s) => segSeg(e, e, s.a, s.b).d <= s.r)) off++; }
  if (off) bad.push(`${off} of ${n} ratline ends off their shroud's rope`);
  // the booms on the masts' axes: the bake's pentagons' middles
  const bake = JSON.parse(readFileSync(new URL('../src/assets/galleon/galleon.json', import.meta.url), 'utf8'));
  const axis = (role) => { const P = bake.parts.find((p) => p.role === role).positions; let x = 0, z = 0; for (let i = 0; i < P.length; i += 3) { x += P[i]; z += P[i + 2]; } return [x / (P.length / 3), z / (P.length / 3)]; };
  const pivots = BOOMS.map((b) => { const [x, z] = axis(b.name.startsWith('Fore') ? 'foreMast' : 'mainMast'); return [b.name, Math.hypot(b.pivot[0] - x, b.pivot[2] - z)]; });
  for (const [name, d] of pivots) if (!(d < 0.001)) bad.push(`${name} pivots ${(d * 100).toFixed(2)} cm off its mast's axis`);
  t.diagnostic(`channels off her side: ${gaps.join(', ')}; chainplates' feet ${Math.min(...plates).toFixed(3)}-${Math.max(...plates).toFixed(3)} m off her planking; ${off} of ${n} ratline ends off their shroud; booms off their masts' axes ${pivots.map(([name, d]) => `${name} ${(d * 100).toFixed(2)} cm`).join(', ')}`);
  assert.deepEqual(bad, [], 'her channels, chainplates, ratlines and booms where they belong');
});

test('AUDIT GALLEON R13 every sail\'s picture stands upright: v 1 along its head row (its highest), 0 along its foot (the gaff sail\'s and the jib\'s stood upside down) (mutants: the gaff\'s rows foot first, the jib\'s foot first)', (t) => {
  const bad = [];
  for (const sail of SAILS) {
    const g = sail.geometry, [NU, NV] = sail.grid, n = NU * NV;
    const rowY = Array.from({ length: NV }, (_, j) => sail.bones.slice(j * NU, (j + 1) * NU).reduce((a, b) => a + b.world[13], 0) / NU);
    const head = rowY.indexOf(Math.max(...rowY)), foot = rowY.indexOf(Math.min(...rowY));
    let ok = true;
    for (const side of [0, 1]) for (let i = 0; i < NU; i++) if (!(Math.abs(g.uvs[(side * n + head * NU + i) * 2 + 1] - 1) < 1e-6 && Math.abs(g.uvs[(side * n + foot * NU + i) * 2 + 1]) < 1e-6)) ok = false;
    if (!ok) bad.push(`${sail.name}: its head row ${head}, v ${g.uvs[(head * NU) * 2 + 1]} there`);
  }
  t.diagnostic(`${SAILS.length} sails, ${bad.length} upside down`);
  assert.deepEqual(bad, [], 'every sail upright');
});

test('AUDIT GALLEON NO TRIANGLE OF HER RIG WITHOUT AREA: every triangle of every rig mesh - her canvas, her spars, her standing and running rope - has area as built (the jib closed its grid to a point at its head: fourteen of its triangles had none) (mutants: the jib to a point)', (t) => {
  const bad = new Map();
  for (const key of Object.keys(MODELS.meshes).filter((k) => /^galleon:(yard:|gaff$|rigging:|sail:|rope:)/.test(k))) {
    const g = MODELS.geometry(key), P = g.positions, I = g.indices;
    for (let k = 0; k < I.length; k += 3) {
      const v = (i) => [P[I[k + i] * 3], P[I[k + i] * 3 + 1], P[I[k + i] * 3 + 2]];
      if (len(cross(sub(v(1), v(0)), sub(v(2), v(0)))) / 2 < 1e-5) bad.set(key, (bad.get(key) ?? 0) + 1);
    }
  }
  t.diagnostic(`triangles without area: ${[...bad].map(([k, c]) => `${k} ${c}`).join(', ') || 'none'}`);
  assert.deepEqual([...bad], []);
});

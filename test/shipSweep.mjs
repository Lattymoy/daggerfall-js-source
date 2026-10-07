// SHIPS-2: A SHIP'S RIG SWEPT - the tests' one sweep (test/ships2_carrack.test.js, test/ships2_largeboat.test.js): a
// built prefab of the port's (world/carrackModel.js, world/largeBoatModel.js), one sail plan switched on, every canvas
// at every Wind and stowed (each sail's own clips), every boom turned through the trims asked (square booms `sq`, gaffs'
// and lateens' `lat`, about the boom's own axis), against every other part of her rig (her canvas, her spars and her
// standing rope read out of their meshes as tubes, her running rope bone to bone), her solids (the drawn meshes `solid`
// names; a rudder turned through its turns) and her helmsman's capsule. Answers each clash once, its nearest.
import { mat4FromQuatPosScale, quatAngleAxis, quatRotate } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';
import { pathHash } from '../src/world/unityAnimator.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const bboxOf = (pts, pad = 0) => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const p of pts) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k] - pad); max[k] = Math.max(max[k], p[k] + pad); } return { min, max }; };
const meets = (A, B) => A.min.every((v, k) => v <= B.max[k] && A.max[k] >= B.min[k]);
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a > 1e-12 || e > 1e-12) {
    if (a <= 1e-12) t = Math.min(1, Math.max(0, f / e));
    else { const c = dot(d1, r); if (e <= 1e-12) s = Math.min(1, Math.max(0, -c / a)); else { const b = dot(d1, d2), den = a * e - b * b; s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } } }
  }
  const c1 = add(p1, scl(d1, s)), c2 = add(p2, scl(d2, t));
  return { d: len(sub(c1, c2)), c1 };
}
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
function segTriDist(p, q, a, b, c) {
  const t = segTriCross(p, q, a, b, c);
  if (t != null) return { d: 0, at: lerp(p, q, t) };
  let best = { d: Infinity, at: p };
  for (const e of [p, q]) { const d = len(sub(e, ptTri(e, a, b, c))); if (d < best.d) best = { d, at: e }; }
  for (const [x, y] of [[a, b], [b, c], [c, a]]) { const r = segSeg(p, q, x, y); if (r.d < best.d) best = { d: r.d, at: r.c1 }; }
  return best;
}


const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function piecesOf(g, record) {
  const k = g.slots.findIndex((s) => s.record === record);
  if (k < 0) return [];
  const sm = g.subMeshes[k], P = g.positions, I = g.indices;
  const kf = (v) => Math.round(v * 1e5) + 0, key = (i) => `${kf(P[i * 3])},${kf(P[i * 3 + 1])},${kf(P[i * 3 + 2])}`;
  const tris = [];
  for (let t = 0; t < sm.primitiveCount; t++) tris.push([0, 1, 2].map((j) => I[sm.startIndex + t * 3 + j]));
  const parent = tris.map((_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const owner = new Map();
  tris.forEach((t, i) => { const ks = t.map(key); for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const e = ks[x] < ks[y] ? `${ks[x]}|${ks[y]}` : `${ks[y]}|${ks[x]}`; if (owner.has(e)) { const a = find(i), b = find(owner.get(e)); if (a !== b) parent[a] = b; } else owner.set(e, i); } });
  const groups = new Map();
  tris.forEach((t, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); });
  return [...groups.values()].map((ts) => { const u = new Map(); for (const t of ts) for (const i of t) u.set(key(i), [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); return { pts: [...u.values()] }; });
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


/**
 * @param {any} built - the prefab builder's answer ({ prefab, components, meshes, animation })
 * @param {any[]} modComponents - Come Sail Away's components (the shared table's head)
 * @param {object} o
 * @param {number|null} [o.variant] - the plan switched on (its `Variants` child), every other off
 * @param {RegExp} o.rigKey - her spars' and standing rope's meshes
 * @param {{ rope: number, spar: number }} o.records - their rope's and spar's pictures
 * @param {(key: string, name: string) => boolean} o.solid - which drawn meshes are her solids
 * @param {(key: string) => any} [o.geometryOf] - a mesh not hers (the mod's)
 * @param {{ key: string, turns: number[] }} [o.rudder] - a rudder turned through its turns about its parent's y
 * @param {{ a: number[], b: number[], r: number }} [o.helmsman] - the helmsman's capsule (its axis's ends, its radius)
 * @param {number[]} o.sq @param {number[]} o.lat @param {Array<number|string>} o.winds
 * @param {(at: number[]) => boolean} o.madeFast - where two lines are made fast together (a masthead, a bowsprit's end)
 * @param {(solid: string, at: number[]) => boolean} [o.ledIn] - another line led into a solid there by design
 */
export function sweepRig(built, modComponents, o) {
  const comps = [...modComponents, ...built.components];
  const compOf = (n, type) => n.components.map((i) => comps[i]).find((c) => c?.type === type) ?? null;
  const geometryOf = (key) => built.meshes[key] ?? o.geometryOf?.(key) ?? null;
  const nodes = [], byPath = new Map();
  (function walk(n, path, pm, parent, boom) {
    if (parent?.name === 'Variants' && n.name !== String(o.variant)) return;
    if (n.active === false && parent?.name !== 'Variants') return;
    const world = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
    const isBoom = n.name.includes('Boom');
    const rec = { node: n, name: n.name, world, parent, boom: isBoom ? null : boom, isBoom, path };
    nodes.push(rec); byPath.set(path, rec);
    for (const c of n.children) walk(c, `${path}/${c.name}`, world, rec, isBoom ? rec : boom);
  }(built.prefab, built.prefab.name, I4, null, null));
  const boomOf = (r) => (r.isBoom ? r : r.boom);
  const posOf = (r) => [r.world[12], r.world[13], r.world[14]];
  const trimOf = (b, p) => (b.name.includes('Square') ? p.sq : p.lat);
  const turned = (b, pt, p) => { if (!b) return pt; const deg = trimOf(b, p); if (!deg) return pt; const P = posOf(b); return add(P, quatRotate(quatAngleAxis(deg, [0, 1, 0]), sub(pt, P))); };

  // the sails: each one's grid at its clips' poses
  const SAILS = [];
  for (const r of nodes) {
    const an = compOf(r.node, 'Animator'), ov = an ? built.animation.overrides[an.m_Controller?.controller] : null;
    const bonesRec = nodes.find((x) => x.parent === r && /SailBones$/.test(x.name));
    if (!ov || !bonesRec) continue;
    const meshRec = nodes.find((x) => x.parent === r && /SailMesh$/.test(x.name));
    const bones = nodes.filter((x) => x.parent === bonesRec).sort((a, b) => +a.name.slice(1) - +b.name.slice(1));
    const clip = (state) => { const c = built.animation.clips[ov.clips.find(([s]) => s === state)[1]]; const at = new Map(c.curves.map((q) => [q.path, q.components.map((k) => k.constant)])); return bones.map((b) => at.get(pathHash(`${bonesRec.name}/${b.name}`))); };
    const set = ov.base === 'Staysail Controller'
      ? [[-1, clip('Staysail Unstowed Left')], [-0.5, clip('Staysail Unstowed Center Left')], [0, clip('Staysail Unstowed Center')], [0.5, clip('Staysail Unstowed Center Right')], [1, clip('Staysail Unstowed Right')]]
      : [[-1, clip('Sail Unstowed Left')], [0, clip('Sail Unstowed Center')], [1, clip('Sail Unstowed Right')]];
    const g = built.meshes[compOf(meshRec.node, 'SkinnedMeshRenderer').m_Mesh.mesh];
    const n = bones.length, tris = [], edges = [], seen = new Set();
    for (let t = 0; t < g.indices.length; t += 3) if (g.indices[t] < n && g.indices[t + 1] < n && g.indices[t + 2] < n) tris.push([g.indices[t], g.indices[t + 1], g.indices[t + 2]]);
    for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? `${p},${q}` : `${q},${p}`; if (!seen.has(k)) { seen.add(k); edges.push([p, q]); } }
    SAILS.push({ key: bonesRec.name.replace(/SailBones$/, ''), bonesRec, set, stowed: clip('Sail Stowed'), tris, edges, boom: boomOf(r) });
  }
  const poseLocal = (sail, w) => { if (w === 'stowed') return sail.stowed; for (let i = 0; i + 1 < sail.set.length; i++) { const [w0, a] = sail.set[i], [w1, b] = sail.set[i + 1]; if (w <= w1 + 1e-12) return a.map((p, k) => lerp(p, b[k], (w - w0) / (w1 - w0))); } return sail.set[sail.set.length - 1][1]; };
  const canvasAt = (sail, w, p) => poseLocal(sail, w).map((q) => turned(sail.boom, xf(sail.bonesRec.world, q), p));

  // her spars and standing rope, out of their meshes: a sail's yard or spars its own, every other piece its own part
  const SEGS = [];
  const ownerSail = (owner) => (/(Yard|Spars)$/.test(owner) ? SAILS.map((s) => s.key).filter((k) => owner.startsWith(k)).sort((a, b) => b.length - a.length)[0] ?? null : null);
  for (const r of nodes) {
    const mf = compOf(r.node, 'MeshFilter');
    if (!mf || !o.rigKey.test(mf.m_Mesh?.mesh ?? '')) continue;
    const g = built.meshes[mf.m_Mesh.mesh], bm = boomOf(r), sail = ownerSail(r.name);
    for (const [record, kind] of [[o.records.rope, 'rope'], [o.records.spar, 'spar']]) piecesOf(g, record).forEach((pc, i) => {
      // a parrel or a jaw: a rope ring about its boom's axis - it hugs the mast, it is not a line
      const c = scl(pc.pts.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / pc.pts.length), ext = bboxOf(pc.pts);
      if (bm && kind === 'rope' && Math.hypot(c[0], c[2]) < 0.06 && Math.max(ext.max[0] - ext.min[0], ext.max[2] - ext.min[2]) < 0.8 && ext.max[1] - ext.min[1] < 0.2) return;
      const rings = ringsOf(pc.pts);
      const part = sail ? `${kind}:${sail}` : `${r.name}:${i}:${kind}`;
      for (let k = 0; k + 1 < rings.length; k++) SEGS.push({ part, boom: bm, a: xf(r.world, rings[k].c), b: xf(r.world, rings[k + 1].c), r: Math.max(rings[k].r, rings[k + 1].r) });
    });
  }
  // a rigid mesh of rope or spar that is not a sail's (her shrouds, her stays) is one part a side
  for (const s of SEGS) if (!/^(rope|spar):/.test(s.part) && /Shrouds/.test(s.part)) s.part = `${s.part.split(':')[0]}:${Math.sign(s.a[0] + s.b[0])}`;
  const segAt = (s, p) => ({ ...s, a: turned(s.boom, s.a, p), b: turned(s.boom, s.b, p) });

  // her running rope, bone to bone
  const RUNNING = [];
  for (const r of nodes) {
    const smr = compOf(r.node, 'SkinnedMeshRenderer');
    if (!smr || !/Line$/.test(r.name)) continue;
    RUNNING.push({ name: r.name.replace(/Line$/, ''), bones: smr.m_Bones.map((b) => byPath.get(b.node)), r: 0.028 });
  }
  const boneAt = (b, p, winds) => { const sail = SAILS.find((s) => s.bonesRec === b.parent); return sail ? canvasAt(sail, winds[sail.key] ?? 0, p)[+b.name.slice(1)] : turned(boomOf(b), posOf(b), p); };

  // her solids
  const SOLIDS = [];
  const trisOf = (g, m) => { const P = g.positions, I = g.indices, out = []; for (let t = 0; t < I.length; t += 3) out.push([0, 1, 2].map((j) => xf(m, [P[I[t + j] * 3], P[I[t + j] * 3 + 1], P[I[t + j] * 3 + 2]]))); return out; };
  for (const r of nodes) {
    const mf = compOf(r.node, 'MeshFilter'), mr = compOf(r.node, 'MeshRenderer'), key = mf?.m_Mesh?.mesh;
    if (!key || !mr || o.rigKey.test(key) || boomOf(r) || !o.solid(key, r.name, r.path)) continue;
    const g = geometryOf(key);
    if (!g) continue;
    const ms = key === o.rudder?.key ? o.rudder.turns.map((d) => [`${r.name}@${d}`, multiply(r.parent.world, mat4FromQuatPosScale(quatAngleAxis(d, [0, 1, 0]), [0, 0, 0], [1, 1, 1]), new Float32Array(16))]) : [[r.name, r.world]];
    for (const [name, m] of ms) { const tris = trisOf(g, m), { min, max } = bboxOf(tris.flat()); SOLIDS.push({ name, tris, min, max }); }
  }

  const clashes = new Map();
  const note = (k, d, ctx) => { const was = clashes.get(k); if (!was || d < was.d) clashes.set(k, { d, ...ctx }); };
  const parts = (p, winds) => {
    const out = [];
    for (const s of SAILS) { const pts = canvasAt(s, winds[s.key], p); out.push({ id: `canvas:${s.key}`, kind: 'canvas', tris: s.tris.map((t) => t.map((i) => pts[i])), edges: s.edges.map(([i, j]) => [pts[i], pts[j]]), bb: bboxOf(pts) }); }
    const groups = new Map();
    for (const s of SEGS) { if (!groups.has(s.part)) groups.set(s.part, []); groups.get(s.part).push(segAt(s, p)); }
    for (const [id, list] of groups) out.push({ id, kind: 'segs', segs: list, bb: bboxOf(list.flatMap((s) => [s.a, s.b]), Math.max(...list.map((s) => s.r))) });
    for (const rp of RUNNING) { const a = boneAt(rp.bones[0], p, winds), b = boneAt(rp.bones[1], p, winds); out.push({ id: `running:${rp.name}`, kind: 'segs', segs: [{ a, b, r: rp.r }], bb: bboxOf([a, b], rp.r) }); }
    return out;
  };
  const sailOf = (id) => /^(canvas|spar|rope):(\w+)$/.exec(id)?.[2] ?? null;
  const ranFrom = (id) => (/^running:/.test(id) ? id.slice(8).replace(/(Brace|Sheet)(Port|Starboard)$/, '') : null);
  function allowed(A, B, at) {
    const sa = sailOf(A.id), sb = sailOf(B.id);
    if (sa && sa === sb) return true;   // a sail and its own spars and ropes
    for (const [X, Y] of [[A, B], [B, A]]) {
      const key = ranFrom(X.id);
      if (!key) continue;
      const s = X.segs[0], atEnd = Math.min(len(sub(at, s.a)), len(sub(at, s.b))) < 0.35;
      if (atEnd && (sailOf(Y.id) === key || ranFrom(Y.id) === key)) return true;   // at its arm or its clew
    }
    return A.kind === 'segs' && B.kind === 'segs' && o.madeFast(at);
  }
  function checkPair(A, B, ctx) {
    if (!meets(A.bb, B.bb)) return;
    if (A.kind === 'canvas' && B.kind === 'canvas') {
      for (const [p, q] of A.edges) for (const t of B.tris) if (segTriCross(p, q, t[0], t[1], t[2]) != null) { note(`${A.id} x ${B.id}`, 0, ctx); return; }
      return;
    }
    const [C, S] = A.kind === 'canvas' ? [A, B] : B.kind === 'canvas' ? [B, A] : [null, null];
    if (C) {
      for (const s of S.segs) {
        if (!meets(bboxOf([s.a, s.b], s.r + 0.02), C.bb)) continue;
        for (const t of C.tris) { const r = segTriDist(s.a, s.b, t[0], t[1], t[2]); if (r.d < s.r + 0.01 && !allowed(C, S, r.at)) { note(`${C.id} x ${S.id}`, r.d - s.r, ctx); break; } }
      }
      return;
    }
    for (const s of A.segs) for (const q of B.segs) { const r = segSeg(s.a, s.b, q.a, q.b); if (r.d < s.r + q.r + 0.01 && !allowed(A, B, r.c1)) note(`${A.id} x ${B.id}`, r.d - s.r - q.r, ctx); }
  }
  function throughSolids(P, ctx) {
    const H = o.helmsman;
    for (const A of P) {
      if (H) {
        if (A.kind === 'canvas') { for (const t of A.tris) if (segTriDist(H.a, H.b, t[0], t[1], t[2]).d < H.r) { note(`${A.id} x helmsman`, 0, ctx); break; } }
        else for (const s of A.segs) if (segSeg(s.a, s.b, H.a, H.b).d < s.r + H.r) note(`${A.id} x helmsman`, 0, ctx);
      }
      for (const S of SOLIDS) {
        if (!meets(A.bb, S)) continue;
        if (A.kind === 'canvas') {
          for (const [p, q] of A.edges) for (const t of S.tris) if (segTriCross(p, q, t[0], t[1], t[2]) != null) { note(`${A.id} x solid:${S.name}`, 0, ctx); break; }
        } else for (const s of A.segs) for (const t of S.tris) {
          const k = segTriCross(s.a, s.b, t[0], t[1], t[2]);
          if (k == null) continue;
          const at = lerp(s.a, s.b, k);
          if (Math.min(k, 1 - k) * len(sub(s.b, s.a)) < 0.25) continue;   // an end made fast on it
          // a line led into it: its end inside the solid near where it goes in (a lift or a halyard into a masthead on
          // its axis, a spritsail's lift into the bowsprit)
          const inside = (q) => q.every((v, n) => v >= S.min[n] && v <= S.max[n]);
          if ([s.a, s.b].some((q) => inside(q) && len(sub(q, at)) < 0.8)) continue;
          if (o.ledIn?.(S.name, at)) continue;
          note(`${A.id} x solid:${S.name}`, 0, { ...ctx, at: at.map((v) => +v.toFixed(2)), seg: [s.a, s.b].map((q) => q.map((v) => +v.toFixed(2))) });
        }
      }
    }
  }
  let combos = 0;
  for (const sq of o.sq) for (const lat of o.lat) for (const w of o.winds) {
    const p = { sq, lat }, winds = Object.fromEntries(SAILS.map((s) => [s.key, w]));
    const P = parts(p, winds);
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) checkPair(P[i], P[j], { sq, lat, w });
    throughSolids(P, { sq, lat, w });
    combos++;
  }
  return { combos, sails: SAILS.map((s) => s.key), segments: SEGS.length, running: RUNNING.length, solids: SOLIDS.map((s) => s.name), clashes: [...clashes].map(([k, v]) => `${k} (d ${v.d.toFixed(3)} at sq ${v.sq} lat ${v.lat} wind ${v.w}${v.at ? ` at ${v.at} on ${JSON.stringify(v.seg)}` : ''})`) };
}

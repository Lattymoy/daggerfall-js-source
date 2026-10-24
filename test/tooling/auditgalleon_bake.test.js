// AUDIT GALLEON (2026-10-02) - THE BAKE: the audit's bake lens on Mac's new galleon (Mac: "Audit this. It must be
// perfect"), findings GN-B1 to GN-B7 pinned over tools/bakeGalleon.mjs, tools/fbxMesh.mjs's port of Blender's
// tessellation, the committed export (src/assets/galleon/source/New_Ship.fbx) and the file it bakes to
// (src/assets/galleon/galleon.json). The source is the judge here: every pin reads the FBX itself - its polygons, the
// mesh's own float coordinates Blender cuts them in, its objects' placements - beside the shipped bake, so a bake that
// drifts from either fails by name. Where Blender's own cut is the truth and the audit's hope was not (a triangle of no
// area along a gunport's sill; five faces Blender cuts unlike their mirror images), the pin says so and holds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as BAKE from '../../tools/bakeGalleon.mjs';   // its AUDIT GN names, read where the tree may not have them yet
import * as MESH from '../../tools/fbxMesh.mjs';
import { readFbx, nodeAt, childNamed, childrenNamed, objectName } from '../../tools/fbxRead.mjs';

const BYTES = readFileSync(new URL(`../../${BAKE.SOURCE_FBX}`, import.meta.url));
const SHIPPED = JSON.parse(readFileSync(new URL(`../../${BAKE.OUT}`, import.meta.url), 'utf8'));
const SOURCE = new Map(BAKE.sceneObjects(readFbx(BYTES)).map((o) => [o.name, o]));
const BAKE_SRC = readFileSync(new URL('../../tools/bakeGalleon.mjs', import.meta.url), 'utf8');

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const newell = (ring) => {
  const n = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
};
const posOf = (part, v) => [part.positions[v * 3], part.positions[v * 3 + 1], part.positions[v * 3 + 2]];
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

// ── the FBX read apart from the bake ──────────────────────────────────────────────────────────────────────────────────

const TREE = readFbx(BYTES);
const modelOf = (tree, name) => childrenNamed(nodeAt(tree.nodes, 'Objects'), 'Model').find((m) => objectName(m.props[1]) === name);
const geometryOf = (tree, name) => {
  const m = modelOf(tree, name);
  const objects = nodeAt(tree.nodes, 'Objects');
  const geos = childrenNamed(objects, 'Geometry');
  const link = childrenNamed(nodeAt(tree.nodes, 'Connections'), 'C').find((c) => c.props[0] === 'OO' && String(c.props[2]) === String(m.props[0]) && geos.some((g) => String(g.props[0]) === String(c.props[1])));
  return geos.find((g) => String(g.props[0]) === String(link.props[1]));
};
const rowOf = (node, prop) => childrenNamed(childNamed(node, 'Properties70'), 'P').find((r) => r.props[0] === prop);
/** An object's mesh vertices exactly as the file stores them - Blender's own floats. */
const RAW = new Map();
const rawOf = (name) => {
  if (!RAW.has(name)) {
    const v = childNamed(geometryOf(TREE, name), 'Vertices').props[0];
    const out = [];
    for (let i = 0; i < v.length; i += 3) out.push([v[i], v[i + 1], v[i + 2]]);
    RAW.set(name, out);
  }
  return RAW.get(name);
};

/**
 * A baked part read back against its source: the object, the source polygons it holds in its order (the hull's less
 * the rudder's five, the rudder's five, every other part's all), each baked polygon's ring in the SOURCE's corner order
 * (the bake reverses it - the mirror), and each baked vertex's source vertex.
 */
function sourceOf(part) {
  const o = SOURCE.get(part.object);
  const all = o.polygons.map((_, k) => k);
  let ids = all;
  if (part.role === 'hull' || part.role === 'rudder') {
    const rudder = all.filter((k) => o.polygons[k].every((vi) => o.scene[vi][0] < BAKE.RUDDER.aftOf && Math.abs(o.scene[vi][1] - BAKE.FRAME.centreline) <= BAKE.RUDDER.halfThickness));
    ids = part.role === 'rudder' ? rudder : all.filter((k) => !rudder.includes(k));
  }
  assert.equal(part.polygons.length, ids.length, `${part.role}/${part.object}: a baked polygon for each of the source's`);
  const rings = part.polygons.map((r) => [...r].reverse());
  const corner = new Map();
  rings.forEach((ring, j) => {
    const poly = o.polygons[ids[j]];
    assert.equal(ring.length, poly.length, `${part.object} #${ids[j]}: its corners`);
    ring.forEach((v, i) => {
      assert.ok(!corner.has(v) || corner.get(v) === poly[i], `${part.object}: baked vertex ${v} stands for one source vertex`);
      corner.set(v, poly[i]);
    });
  });
  return { o, ids, rings, corner };
}
/** A baked part's triangles, polygon by polygon (baked vertex triples). */
const trianglesOf = (part) => {
  const by = part.polygons.map(() => []);
  for (let t = 0; t < part.triangleOf.length; t++) by[part.triangleOf[t]].push(part.triangles.slice(t * 3, t * 3 + 3));
  return by;
};

/** Two unit vectors spanning the plane square to `n`, (e1, e2, n) right-handed: a face that winds about n winds
 *  counter-clockwise in them. */
function planeOf(n) {
  const w = n.map((v) => v / len(n));
  const a = Math.abs(w[0]) < 0.6 ? [1, 0, 0] : [0, 1, 0];
  const e1 = cross(w, a); const l1 = len(e1);
  const u = e1.map((v) => v / l1);
  return [u, cross(w, u)];
}

/**
 * Whether triangles TILE a face in its own plane (2D corners, the face's ring in order): null, or what is wrong. Written
 * apart from the bake's tools/fbxMesh.mjs tilingFault on purpose - the bake's own check is not its own judge here. A
 * triangle narrower than a micrometre is one of no area (it covers nothing); every other one must wind as the face
 * does, their areas sum to the face's to 1e-6, and every cell of the plane its edges and theirs make must be covered
 * as many times as the face winds about it.
 */
function tilingError(ring, tris) {
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const d2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let face = 0;
  for (let i = 1; i + 1 < ring.length; i++) face += area2(ring[0], ring[i], ring[i + 1]) / 2;
  if (!(Math.abs(face) > 1e-12)) return 'the face has no area';
  const sense = Math.sign(face);
  let total = 0;
  const solid = [];
  for (const t of tris) {
    const a = area2(...t) / 2;
    total += a;
    if (Math.abs(2 * a) <= 1e-6 * Math.max(d2(t[0], t[1]), d2(t[1], t[2]), d2(t[2], t[0]))) continue;
    if (Math.sign(a) !== sense) return `a triangle of ${a.toFixed(6)} wound against a face of ${face.toFixed(6)}`;
    solid.push(t);
  }
  if (Math.abs(total - face) > 1e-6 * Math.abs(face)) return `its triangles cover ${total} of its ${face}`;
  const segs = [...ring.map((p, i) => [p, ring[(i + 1) % ring.length]]), ...tris.flatMap((t) => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]])];
  const xs = new Set(segs.flat().map((p) => p[0]));
  for (const [a, b] of segs) {
    for (const [c, d] of segs) {
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-15) continue;
      const s = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (s > 1e-12 && s < 1 - 1e-12 && u > 1e-12 && u < 1 - 1e-12) xs.add(a[0] + s * (b[0] - a[0]));
    }
  }
  const X = [...xs].sort((a, b) => a - b);
  const wind = (q) => {
    let w = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a[1] <= q[1] && b[1] > q[1] && area2(a, b, q) > 0) w++;
      else if (a[1] > q[1] && b[1] <= q[1] && area2(a, b, q) < 0) w--;
    }
    return w;
  };
  // a point within a micrometre of an edge is inside a sliver of no area, however it leans
  const nearEdge = (q) => segs.some(([a, b]) => {
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / l2)) : 0;
    return Math.hypot(q[0] - a[0] - u * (b[0] - a[0]), q[1] - a[1] - u * (b[1] - a[1])) < 1e-6;
  });
  for (let i = 0; i + 1 < X.length; i++) {
    if (X[i + 1] - X[i] < 1e-9) continue;
    const xm = (X[i] + X[i + 1]) / 2;
    const ys = segs.filter(([a, b]) => Math.min(a[0], b[0]) <= X[i] && Math.max(a[0], b[0]) >= X[i + 1]).map(([a, b]) => a[1] + (b[1] - a[1]) * (xm - a[0]) / (b[0] - a[0])).sort((a, b) => a - b);
    for (let k = 0; k + 1 < ys.length; k++) {
      if (ys[k + 1] - ys[k] < 1e-9) continue;
      const q = [xm, (ys[k] + ys[k + 1]) / 2];
      if (nearEdge(q)) continue;
      let cover = 0;
      for (const t of solid) if (sense * area2(t[0], t[1], q) > 0 && sense * area2(t[1], t[2], q) > 0 && sense * area2(t[2], t[0], q) > 0) cover += sense;
      if (cover !== wind(q)) return `${Math.abs(cover)} triangles over a point the face winds ${wind(q)} times about`;
    }
  }
  return null;
}

// ── B1: her cut is Blender's ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B1 HER CUT IS BLENDER\'S: every polygon of every part - triangle, quad and n-gon, all 401 - is cut as Blender cuts it (tools/fbxMesh.mjs blenderTessellate on the mesh\'s own float coordinates, its corners in their own order) and carried through the mirror as its polygon is, triangle for triangle; the bake cuts in Blender\'s coordinates, not the scene\'s, which cut four of her hull\'s sides otherwise (mutants: the scene\'s coordinates, double precision, the Newell sum from the first corner, the clip-even step dropped, the sweep dropped, neighbours never re-signed)', () => {
  let n = 0, filled = 0;
  for (const part of SHIPPED.parts) {
    const { o, ids, rings } = sourceOf(part);
    assert.deepEqual(o.local, rawOf(part.object), `${part.object}: the bake reads the mesh's vertices as the file stores them`);
    const by = trianglesOf(part);
    ids.forEach((k, j) => {
      const at = new Map(rings[j].map((v, i) => [v, i]));
      const baked = by[j].map((t) => t.map((v) => at.get(v)));
      const blender = MESH.blenderTessellate(o.polygons[k].map((vi) => rawOf(part.object)[vi]));
      assert.deepEqual(baked, blender.map(([a, b, c]) => [a, c, b]), `${part.object} polygon #${k}: Blender's cut, through the mirror`);
      n++;
      if (o.polygons[k].length > 4) filled++;
    });
  }
  assert.equal(n, 401, 'every polygon of every part');
  // the coordinates matter: four of her hull's n-gons cut otherwise in the scene's (float rounding at their ports'
  // corners, which stand on a line)
  const hull = SOURCE.get('Cube');
  const differ = hull.polygons.map((p, k) => k).filter((k) => JSON.stringify(MESH.blenderTessellate(hull.polygons[k].map((vi) => hull.local[vi]))) !== JSON.stringify(MESH.blenderTessellate(hull.polygons[k].map((vi) => hull.scene[vi]))));
  assert.deepEqual(differ, [2, 33, 34, 76], 'the hull\'s sides #2, #33 and her inner planking #34, #76 cut otherwise in scene coordinates');
  assert.ok(filled > 40, `n-gons filled (${filled})`);
});

test('AUDIT GALLEON B1 EVERY POLYGON TILES: every baked polygon of every part, carried back to its source corners (unrounded, in her frame) and laid in its own Newell plane, is tiled by its triangles - their areas its own to 1e-6, none wound against it, none outside it, none over another, every cell covered as often as the face winds about it (her port inner planking, #76, runs back along two port lintels and is tiled as it winds); a triangle of no area only where its three corners stand on a line (mutants: the fill\'s ear search, passes, desperate mode, quad flip, projection)', () => {
  let n = 0;
  for (const part of SHIPPED.parts) {
    const { o, ids, corner } = sourceOf(part);
    const by = trianglesOf(part);
    const at = (v) => (corner.has(v) ? BAKE.toBoat(o.scene[corner.get(v)]) : posOf(part, v));
    part.polygons.forEach((ring, j) => {
      const ring3 = ring.map(at);
      const [e1, e2] = planeOf(newell(ring3));
      const flat = (p) => [dot(p, e1), dot(p, e2)];
      const err = tilingError(ring3.map(flat), by[j].map((t) => t.map((v) => flat(at(v)))));
      assert.equal(err, null, `${part.role}/${part.object} polygon #${ids[j]} (${ring.length} corners): ${err}`);
      n++;
    });
  }
  assert.equal(n, 401);
});

test('AUDIT GALLEON B1 A CUT THAT DOES NOT TILE IS REFUSED BY NAME: the bake never patches a face its own way - a bow-tied quad, by fillFace or in the hull\'s own mesh through the whole bake, throws naming the object and the polygon; tilingFault finds a fold, an overlap that sums to the face\'s area, a triangle too many and a corner the face does not have, and passes Blender\'s own cuts (mutants: the refusal dropped, each check of tilingFault dropped)', () => {
  const bow = { name: 'Bow', polygons: [[0, 1, 2, 3]], local: [[0, 0, 0], [2, 2, 0], [2, 0, 0], [0, 2, 0]] };
  assert.throws(() => BAKE.fillFace(bow, 0), /Bow polygon #0 \(4 corners\): Blender's cut does not tile it/);
  // the hull's first quad bow-tied in the file itself (and in her twin, Cube.044, so it stays her twin): its Newell normal
  // lies across its two lobes and its cut stands edge-on to it - the whole bake refuses it, by name
  const tree = readFbx(BYTES);
  for (const name of ['Cube', 'Cube.044']) {
    const pvi = childNamed(geometryOf(tree, name), 'PolygonVertexIndex').props[0];
    [pvi[1], pvi[2]] = [pvi[2], pvi[1]];
  }
  assert.throws(() => BAKE.bakeGalleon(BYTES, tree), /Cube polygon #0 \(4 corners\): Blender's cut does not tile it - triangle \[0,1,3\] stands edge-on to the face/);
  // and in the plane alone that cut would pass: its corners 0 and 3 project to one point
  const hull = SOURCE.get('Cube'), bowed = [0, 2, 1, 3].map((i) => rawOf('Cube')[hull.polygons[0][i]]);
  assert.equal(MESH.tilingFault(MESH.blenderProject(bowed), MESH.blenderTessellate(bowed)), null);
  // tilingFault, square on its faults
  const P = [[0, 0], [2, 0], [2, 2], [1, 3], [0, 2]];
  assert.equal(MESH.tilingFault(P, [[0, 1, 2], [0, 2, 3], [0, 3, 4]]), null, 'a fan of a convex face tiles it');
  assert.match(MESH.tilingFault(P, [[0, 1, 2], [0, 2, 4], [1, 2, 3]]), /lie over a point it winds 1 times/, 'an overlap that sums to the face\'s area');
  assert.match(MESH.tilingFault(P, [[0, 2, 1], [0, 2, 3], [0, 3, 4]]), /wound against the face/, 'a fold');
  assert.match(MESH.tilingFault(P, [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 0, 1]]), /4 triangles where 5 corners take 3/, 'a triangle too many, even of no area');
  assert.match(MESH.tilingFault(P, [[0, 1, 2], [0, 2, 3], [0, 3, 7]]), /names a corner the face does not have/);
  assert.match(MESH.tilingFault(P, [[0, 1, 2], [0, 2, 3], [0, 0, 0]]), /cover 4\.\d+ of its 5/, 'a triangle short');
  assert.match(MESH.tilingFault([[0, 0], [1, 0], [2, 0]], [[0, 1, 2]]), /no area in its plane/);
  // a sliver of no area is no fault, however it leans: a 10 m square bulged 1 um at the middle of a side, cut with the
  // sliver alone along it, turned 5 degrees in its plane so the sliver stands steep - its inside is rounding's, unasked
  const c = Math.cos(5 * Math.PI / 180), s = Math.sin(5 * Math.PI / 180);
  const bulged = [[0, 0], [10, 0], [10, 10], [0, 10], [-1e-6, 5]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  assert.equal(MESH.tilingFault(bulged, [[3, 4, 0], [0, 1, 2], [0, 2, 3]]), null);
});

test('AUDIT GALLEON B1 THE PORT OF BLENDER\'S FILL ON HAND-MADE FACES: answers derived from mesh_tessellate and BLI_polyfill_calc step by step - a convex pentagon and hexagon clip even ([4,0,1] [1,2,3] [1,3,4]), flat or standing; a dart quad flips to its 1-3 diagonal, a square does not; a notched heptagon whose notch lies ON the first two ears\' diagonals (a corner on an edge blocks); a folded rectangle that needs the tangential pass; a tangential corner 0 the convex pass skips; and, in the 2D fill alone, the desperate mode (from where the search began, forward, the first corner not concave, else that corner), the walk\'s bounds (AUDIT GN2-BK1: Blender 5.1\'s, a corner\'s own point asked before any box), the sweep and the re-signing of a cut ear\'s neighbours on faces with coincident corners (mutants: each of those)', () => {
  const flat = (xy) => xy.map(([x, y]) => [x, y, 0]);
  const T = (pts) => MESH.blenderTessellate(pts);
  // a convex face: every corner convex, no corner asked; ear 0, then two on (clip even), the last three
  assert.deepEqual(T(flat([[2, 0], [4, 1.5], [3, 4], [1, 4], [0, 1.5]])), [[4, 0, 1], [1, 2, 3], [1, 3, 4]]);
  assert.deepEqual(T(flat([[2, 0], [4, 1], [4, 3], [2, 4], [0, 3], [0, 1]])), [[5, 0, 1], [1, 2, 3], [3, 4, 5], [1, 3, 5]]);
  assert.deepEqual(T([[0, 2, 0], [0, 4, 1.5], [0, 3, 4], [0, 1, 4], [0, 0, 1.5]]), [[4, 0, 1], [1, 2, 3], [1, 3, 4]], 'standing in the YZ plane (ortho_basis\'s other branch)');
  // the quad: is_quad_flip_v3_first_third_fast
  assert.deepEqual(T(flat([[0, 0], [1, 0.9], [2, 0], [1, 2]])), [[0, 1, 3], [1, 2, 3]], 'a dart: its 0-2 diagonal outside it');
  assert.deepEqual(T(flat([[0, 0], [1, 0], [1, 1], [0, 1]])), [[0, 1, 2], [0, 2, 3]]);
  assert.equal(MESH.blenderQuadFlip(flat([[0, 0], [1, 0.9], [2, 0], [1, 2]])), true);
  // the notch (2,1) lies ON ear 0's diagonal 1-6 and ear 1's 2-0: both blocked; ear 2 free; then the sweep
  assert.deepEqual(T(flat([[0, 0], [4, 0], [4, 2], [3, 2], [2, 1], [1, 2], [0, 2]])), [[1, 2, 3], [4, 5, 6], [1, 3, 4], [4, 6, 0], [0, 1, 4]]);
  // the top runs back along itself: after ear 0 every convex ear is blocked by a corner on its edge, so the tangential
  // corner 3 is cut ([2,3,4], of no area)
  assert.deepEqual(T(flat([[0, 0], [4, 0], [4, 2], [1, 2], [3, 2], [0, 2]])), [[5, 0, 1], [2, 3, 4], [4, 5, 1], [1, 2, 4]]);
  // corner 0 tangential: the convex pass passes it by (#103913), corner 1 cut first
  assert.deepEqual(T(flat([[1, 0], [2, 0], [2, 2], [0, 2], [0, 0]])), [[0, 1, 2], [2, 3, 4], [0, 2, 4]]);
  // projected the right way round: the negated normal makes a face wound about it positive for the fill
  // AUDIT GN2-BK2: cross_poly_v2 as math_geom.cc sums it, (prev.x - cur.x) * (cur.y + prev.y) - polyfill_prepare's
  // coords_sign 1 is cross_poly_v2 <= 0
  const proj = MESH.blenderProject(flat([[0, 0], [4, 0], [4, 2], [0, 2]]));
  let crossPoly = 0;
  for (let i = 0; i < 4; i++) { const p = proj[(i + 3) % 4], c = proj[i]; crossPoly += (p[0] - c[0]) * (c[1] + p[1]); }
  assert.ok(crossPoly < 0, 'cross_poly_v2 <= 0: coords_sign 1, as BLI_polyfill_calc is told');
  const F = (xy) => MESH.blenderPolyfill(xy);
  // wound the other way in the fill's plane: every corner concave, desperate every cut - each time the corner the search
  // began at (the first from 0; then, cut 0 and two on, corner 2 concave so 3, sweeping back)
  assert.deepEqual(F([[0, 0], [4, 0], [4, 2], [2, 3], [0, 2]]), [[4, 0, 1], [2, 3, 4], [1, 2, 4]]);
  // desperate with a tangential corner the first not concave: corner 0 concave, 1 tangential (every corner on a line
  // or on another corner, so every ear blocked); AUDIT GN2-BK1: then desperate again - ear 2's three corners stand on one
  // point, and 5.1's point test passes any corner the walk reaches against a triangle of no extent (5.0's box let it
  // go, [0,2,3]) - from corner 4, where the sweep turned back: tangential, cut
  assert.deepEqual(F([[0, 2], [0, 1], [0, 2], [0, 2], [2, 0]]), [[0, 1, 2], [3, 4, 0], [0, 2, 3]]);
  // desperate while sweeping back: forward from corner 3 the first not concave is 5 (backward it would be 1)
  assert.deepEqual(F([[0, 0], [1, 0], [1, 2], [0, 1], [1, 1], [1, 2]]), [[5, 0, 1], [4, 5, 1], [3, 4, 1], [1, 2, 3]]);
  // AUDIT GN2-BK1: no bounding box asked of a corner (5.1's walk asks each node's own point first): at the second cut
  // corner 0's tangential ear lies on y = 3 over x 0..2, and corner 2 at x 3, on its line past its end, is reached and
  // blocks it - every ear blocked, desperate from corner 2, where the sweep turned back (5.0 asked the box, and cut ear 0)
  assert.deepEqual(F([[1, 3], [0, 3], [3, 3], [2, 3], [3, 0]]), [[3, 4, 0], [1, 2, 3], [0, 1, 3]]);
  // the sweep: after ear 0, corner 2 is concave, so the search starts at 3 and runs BACK - to ear 1
  assert.deepEqual(F([[3, 3], [3, 0], [0, 2], [0, 1], [3, 3]]), [[4, 0, 1], [4, 1, 2], [2, 3, 4]]);
  // a cut ear's neighbours re-signed: corner 0 turns tangential after ear 1, and is the next tangential ear
  assert.deepEqual(F([[2, 2], [1, 3], [2, 2], [3, 2], [0, 1]]), [[0, 1, 2], [4, 0, 2], [2, 3, 4]]);
  // and a CONVEX neighbour never re-signed: corner 3 stays convex after ear 2, though its corners now lie on a line
  assert.deepEqual(F([[2, 0], [2, 3], [2, 1], [0, 0], [2, 3]]), [[1, 2, 3], [1, 3, 4], [0, 1, 4]]);
});

// ── B1 and B6: her sides mirror ───────────────────────────────────────────────────────────────────────────────────────

/** Ericson's closest point on a triangle. */
function closest(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
/** The farthest any point inside these triangles, mirrored across her centreline, stands from those. */
function mirrorGap(tris, others) {
  let worst = 0;
  for (const [a, b, c] of tris) {
    if (len(cross(sub(b, a), sub(c, a))) < 1e-9) continue;
    for (let i = 1; i < 8; i++) {
      for (let k = 1; i + k < 8; k++) {
        const u = i / 8, v = k / 8, w = 1 - u - v;
        const m = [-(a[0] * w + b[0] * u + c[0] * v), a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v];
        let best = Infinity;
        for (const t of others) best = Math.min(best, len(sub(m, closest(m, ...t))));
        worst = Math.max(worst, best);
      }
    }
  }
  return worst;
}
/** Blender cuts these five of her hull's faces unlike their mirror images: Mac drew each the mirror of its partner, but
 *  its corners start elsewhere, so Blender's cut runs on other diagonals - and the faces lean out of their planes
 *  (#9, her stern quarter, 0.53 m), so the two sides' surfaces part by up to this much (m). It is Blender's drawing, and
 *  the bake's (cut alike, the pair stands within a millimetre); only a planar face, or one cut in Blender, closes it. */
const BLENDER_UNLIKE = Object.freeze({ 9: 0.37, 10: 0.21, 31: 0.23, 88: 0.08, 89: 0.23 });

test('AUDIT GALLEON B1 HER SIDES MIRROR AS BLENDER DRAWS THEM: every starboard polygon of her hull and of every part Mac mirrored (each vertex with a partner across her centreline within 1 mm) stands within 5 cm of the mirror of its side - her lower sides\' 24-gons (#11 and #2, 0.49 m apart under the old ear clip) to 3.3 cm, each carrying Blender\'s 6 m2 wedge alike - but for the five hull faces Blender itself cuts unlike their mirror images, each held to the gap it has and shown to be the cut alone (mutants: the scene\'s coordinates, the ear search order, the passes swapped)', (t) => {
  const partner = { balustradeStarboard: 'balustradePort', balustradePort: 'balustradeStarboard' };
  const tris3 = (part) => trianglesOf(part).flatMap((ts) => ts.map((tr) => tr.map((v) => posOf(part, v))));
  const mirrored = (part) => {
    const q = SHIPPED.parts.find((x) => x.role === (partner[part.role] ?? part.role) && (partner[part.role] || x.object === part.object));
    for (let i = 0; i < part.positions.length; i += 3) {
      let best = Infinity;
      for (let k = 0; k < q.positions.length; k += 3) best = Math.min(best, Math.hypot(part.positions[i] + q.positions[k], part.positions[i + 1] - q.positions[k + 1], part.positions[i + 2] - q.positions[k + 2]));
      if (best > 1e-3) return null;
    }
    return q;
  };
  const over = {};
  const checked = [];
  for (const part of SHIPPED.parts) {
    if (part.role === 'balustradePort') continue;
    const q = part.role === 'hull' ? part : mirrored(part);
    if (!q) continue;
    checked.push(part.role === 'deckBeam' ? `deckBeam ${part.object}` : part.role);
    const { ids } = sourceOf(part);
    const by = trianglesOf(part), Q = tris3(q);
    part.polygons.forEach((ring, j) => {
      const pts = ring.map((v) => posOf(part, v));
      if (!pts.every((p) => p[0] >= 0) || pts.every((p) => p[0] === 0)) return;   // starboard faces
      const gap = mirrorGap(by[j].map((tr) => tr.map((v) => posOf(part, v))), Q);
      if (part.role === 'hull' && ids[j] === 11) t.diagnostic(`her starboard lower side #11 against the mirror of her port side: ${(gap * 100).toFixed(1)} cm`);
      if (gap > 0.05) over[`${part.role} #${ids[j]}`] = gap;
    });
  }
  assert.deepEqual(checked, ['hull', 'rudder', 'gunDeck', 'mainDeck', 'hatchFore', 'bulkhead', 'deckBeam Cube.012', 'deckBeam Cube.013', 'balustradeStarboard', 'deckBeam Cube.016', 'deckBeam Cube.017', 'deckBeam Cube.018', 'deckBeam Cube.019'], 'her hull and the parts Mac mirrored');
  assert.deepEqual(Object.keys(over).sort(), Object.keys(BLENDER_UNLIKE).map((k) => `hull #${k}`).sort(), `over 5 cm: ${JSON.stringify(Object.fromEntries(Object.entries(over).map(([k, v]) => [k, +(v * 100).toFixed(1)])))}`);
  // each of the five: a mirror image of its partner, cut otherwise by Blender, and alike they would stand together
  const hull = SOURCE.get('Cube');
  const B = hull.scene.map((p) => BAKE.toBoat(p));
  const partnerOf = (vi) => B.findIndex((b) => Math.hypot(B[vi][0] + b[0], B[vi][1] - b[1], B[vi][2] - b[2]) < 1e-3);
  const key = (tr) => [...tr].sort((a, b) => a - b).join('-');
  for (const [k, ceiling] of Object.entries(BLENDER_UNLIKE)) {
    assert.ok(over[`hull #${k}`] <= ceiling, `hull #${k}: ${(over[`hull #${k}`] * 100).toFixed(1)} cm, no more than ${ceiling * 100}`);
    const poly = hull.polygons[k], want = poly.map(partnerOf);
    const m = hull.polygons.findIndex((pp) => pp.length === poly.length && pp.every((v) => want.includes(v)));
    assert.ok(m >= 0, `hull #${k}: Mac drew its mirror image`);
    const mine = MESH.blenderTessellate(poly.map((vi) => rawOf('Cube')[vi]));
    const theirs = MESH.blenderTessellate(hull.polygons[m].map((vi) => rawOf('Cube')[vi])).map((tr) => tr.map((i) => want.indexOf(hull.polygons[m][i])));
    assert.notDeepEqual(mine.map(key).sort(), theirs.map(key).sort(), `hull #${k} and #${m}: Blender cuts them on other diagonals`);
    const alike = mine.map((tr) => tr.map((i) => B[hull.polygons[m][hull.polygons[m].indexOf(want[i])]]));
    assert.ok(mirrorGap(mine.map((tr) => tr.map((i) => B[poly[i]])), alike) < 1e-3, `hull #${k}: cut alike, it and #${m} stand together`);
  }
});

test('AUDIT GALLEON B6 HER CENTRELINE IS HER HULL\'S OWN Y, AND HER MIRROR PAIRS BAKE MIRRORED: FRAME.centreline is the hull object\'s Lcl Translation through the file\'s frame, 36.24673828125 to the bit (it was her beam halved to 0.1 mm, 38 um off); every vertex Mac mirrored exactly - its mesh\'s own (x, -y, z) on an object turned only by the export\'s quarter turn, its origin on her centreline - bakes to |x| equal and y, z the same, the exporter\'s float32 noise in that quarter turn (the hull\'s -90.0000093) read as the quarter turn it is; a hull moved off the centreline is refused (mutants: the old centreline, the quarter turn unread, the hull\'s origin unchecked)', (t) => {
  const hullModel = modelOf(TREE, 'Cube');
  const T = rowOf(hullModel, 'Lcl Translation').props.slice(4);
  const unit = Number(rowOf(nodeAt(TREE.nodes, 'GlobalSettings'), 'UnitScaleFactor').props[4]);
  assert.equal(-T[2] * unit / 100, 36.24673828125, 'the hull\'s Y in the scene: -Z (FBX) a centimetre a hundredth');
  assert.equal(BAKE.FRAME.centreline, 36.24673828125);
  assert.equal(SHIPPED.frame.centreline, 36.24673828125, 'the file carries it');
  let pairs = 0, mirrorObjects = 0;
  for (const part of SHIPPED.parts) {
    const m = modelOf(TREE, part.object);
    const R = rowOf(m, 'Lcl Rotation').props.slice(4), Tz = rowOf(m, 'Lcl Translation').props[6];
    if (!(Math.abs(R[0] + 90) < 1e-4 && Math.abs(R[1]) < 1e-4 && Math.abs(R[2]) < 1e-4 && Tz === T[2])) continue;
    mirrorObjects++;
    const { corner } = sourceOf(part);
    const raw = rawOf(part.object);
    const bakedOf = new Map([...corner].map(([v, vi]) => [vi, v]));
    for (const [v, vi] of corner) {
      const [x, y, z] = raw[vi];
      const wi = raw.findIndex((p) => p[0] === x && p[1] === -y && p[2] === z);
      if (wi < 0 || !bakedOf.has(wi)) continue;
      const a = posOf(part, v), b = posOf(part, bakedOf.get(wi));
      assert.deepEqual(b, [-a[0] + 0, a[1], a[2]], `${part.role}/${part.object}: vertex ${vi} and its mirror ${wi}`);
      pairs++;
    }
  }
  t.diagnostic(`${pairs} baked vertices on ${mirrorObjects} parts checked against their exact mirrors`);
  assert.ok(pairs >= 280 && mirrorObjects === 20, `the mirrored parts read (${pairs} vertices on ${mirrorObjects} parts)`);
  // a hull moved a centimetre across her: inside her box's 2 cm, off her centreline - refused
  const tree = readFbx(BYTES);
  rowOf(modelOf(tree, 'Cube'), 'Lcl Translation').props[6] += 1;
  assert.throws(() => BAKE.bakeGalleon(BYTES, tree), /the hull's origin stands at scene Y 36\.2367\d* and FRAME\.centreline is 36\.24673828125/);
});

// ── B2: no fold ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B2 NO TRIANGLE FACES AGAINST ITS FACE: every baked triangle with area turns its front the way its polygon\'s Newell normal does, as the file holds them - the fin folded under her port stern quarter (#8, its [2,3,4] at 100 degrees) is gone; the most any triangle of a part leans off its face is reported (her lower sides\' 6 m2 wedges lean 65 degrees, Blender\'s own cut of a side 0.55 m out of its plane, alike both sides) (mutants: the projection not negated, the quads filled as n-gons)', (t) => {
  for (const part of SHIPPED.parts) {
    let worst = 0, at = null;
    trianglesOf(part).forEach((ts, j) => {
      const nf = newell(part.polygons[j].map((v) => posOf(part, v)));
      for (const tr of ts) {
        const [a, b, c] = tr.map((v) => posOf(part, v));
        const nt = cross(sub(b, a), sub(c, a));
        if (len(nt) < 1e-12) continue;   // no area: no front to face
        const cos = dot(nt, nf) / (len(nt) * len(nf));
        assert.ok(cos > 0, `${part.role}/${part.object} polygon ${j}: triangle [${tr}] faces against it (cos ${cos.toFixed(3)})`);
        const tilt = Math.acos(Math.min(1, cos)) * 180 / Math.PI;
        if (tilt > worst) { worst = tilt; at = `polygon ${j}, ${(len(nt) / 2).toFixed(3)} m2`; }
      }
    });
    if (worst > 0.5) t.diagnostic(`${part.role}/${part.object}: leans at most ${worst.toFixed(1)} deg (${at})`);
  }
});

// ── B3: nothing of the bake's own ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B3 THE BAKE MAKES NOTHING OF ITS OWN: every baked vertex is a source corner (its position the source\'s in her frame to 0.1 mm, one baked vertex a source vertex), every triangle\'s corners are its own polygon\'s, no part holds two vertices at one place (nor does the source), and a triangle of no area stands only where Mac drew its three corners on one line - a gunport\'s sill or lintel, the fold of her port inner planking - where Blender\'s own cut lays one (the old slab fill made 21 points, one on the edge #76 shares with #77, and a triangle of no area on a point it made twice) (mutants: the refusal dropped)', (t) => {
  let flatTris = 0;
  for (const part of SHIPPED.parts) {
    const { o, rings, corner } = sourceOf(part);
    const n = part.positions.length / 3;
    assert.equal(corner.size, n, `${part.role}/${part.object}: ${n} baked vertices, ${corner.size} of them source corners`);
    assert.equal(new Set(corner.values()).size, n, `${part.object}: one baked vertex a source vertex`);
    for (const [v, vi] of corner) assert.deepEqual(posOf(part, v), BAKE.toBoat(o.scene[vi]).map(r4), `${part.object}: vertex ${v} is source vertex ${vi}`);
    const where = new Set();
    for (let v = 0; v < n; v++) { const k = posOf(part, v).join(); assert.ok(!where.has(k), `${part.object}: two vertices at ${k}`); where.add(k); }
    const srcAt = new Set(o.scene.map((p) => p.join()));
    assert.equal(srcAt.size, o.scene.length, `${part.object}: the source has no two vertices at one place either`);
    trianglesOf(part).forEach((ts, j) => {
      for (const tr of ts) {
        assert.ok(tr.every((v) => rings[j].includes(v)), `${part.object} polygon ${j}: triangle [${tr}] on its own corners`);
        const [a, b, c] = tr.map((v) => posOf(part, v));
        if (len(cross(sub(b, a), sub(c, a))) > 1e-12) continue;
        flatTris++;
        const [p, q, r] = tr.map((v) => o.scene[corner.get(v)]);
        const off = len(cross(sub(q, p), sub(r, p))) / Math.max(len(sub(q, p)), len(sub(r, p)), len(sub(r, q)));
        assert.ok(off < 1e-6, `${part.object} polygon ${j}: a triangle of no area on corners Mac set ${off} m off one line`);
      }
    });
  }
  t.diagnostic(`${flatTris} triangles of no area, each on three corners Mac drew on one line`);
  assert.equal(flatTris, 11, 'as many triangles of no area as Blender 5.1.1\'s cut lays (AUDIT GN2-BK1: 5.0.1\'s laid 13)');
});

// ── B4: the bake's own fills are gone ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B4 THE BAKE\'S OWN FILLS ARE GONE AND ITS HEADER SAYS WHAT IT DOES: no polyfill, slabFill or fillInside left in tools/bakeGalleon.mjs, every polygon through fillFace; its header names Blender\'s tessellation and the refusal, and no longer claims an ear clip, a fan or a fill by winding', () => {
  for (const gone of ['polyfill', 'slabFill', 'fillInside']) assert.equal(BAKE[gone], undefined, `${gone} is gone`);
  assert.equal(typeof BAKE.fillFace, 'function');
  const header = BAKE_SRC.slice(0, BAKE_SRC.indexOf('import '));
  assert.match(header, /blenderTessellate/);
  assert.match(header, /refused by object and number/);
  assert.doesNotMatch(header, /ear-clipped when not|fanned when convex|by its winding/);
});

// ── B5: what it cannot read, it refuses ───────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B5 WHAT THE BAKE CANNOT READ IT REFUSES BY NAME: an object mirrored by its own scale (two negatives are a turn, and bake); a RotationOffset or a ScalingOffset; each of GlobalSettings\' six axes but this export\'s (Y up, Z front, X right, all positive); a part 3 cm from the box it was read in (1 cm is let pass) - each on the real export, changed in one place (mutants: each refusal dropped, the box\'s slack widened)', () => {
  const changed = (edit) => { const tree = readFbx(BYTES); edit(tree); return () => BAKE.bakeGalleon(BYTES, tree); };
  const scale = (name, f) => (tree) => { const row = rowOf(modelOf(tree, name), 'Lcl Scaling'); row.props[4] *= f[0]; row.props[5] *= f[1]; row.props[6] *= f[2]; };
  // a deck beam stands square on its own origin, so a mirror leaves its box as it was: only the determinant tells
  assert.throws(changed(scale('Cube.012', [-1, 1, 1])), /Cube\.012's transform mirrors it \(scale \[-100,100,100\], determinant -1\.000\) - its faces would bake inside out/);
  const both = (f) => (tree) => { scale('Cube.012', f)(tree); scale('Cube.032', f)(tree); };   // and its twin, alike
  assert.doesNotThrow(changed(both([-1, -1, 1])), 'two negatives turn it half round, in its own place');
  assert.throws(changed(both([-1, 1, 1])), /Cube\.012's transform mirrors it/);
  const add = (name, prop, v) => (tree) => childNamed(modelOf(tree, name), 'Properties70').children.push({ name: 'P', props: [prop, 'Vector3D', 'Vector', '', ...v], children: [] });
  assert.throws(changed(add('Cube.004', 'RotationOffset', [0, 5, 0])), /Cube\.004 carries RotationOffset \[0,5,0\] - the bake reads T\*R\*S only/);
  assert.throws(changed(add('Cube.004', 'ScalingOffset', [1, 0, 0])), /Cube\.004 carries ScalingOffset \[1,0,0\]/);
  assert.doesNotThrow(changed(add('Cube.004', 'RotationOffset', [0, 0, 0])), 'an offset of nought is no offset');
  const axes = { UpAxis: 2, UpAxisSign: -1, FrontAxis: 1, FrontAxisSign: -1, CoordAxis: 2, CoordAxisSign: -1 };
  assert.deepEqual(Object.keys(axes), Object.keys(BAKE.EXPORT_AXES));
  for (const [key, wrong] of Object.entries(axes)) {
    const set = (tree) => { rowOf(nodeAt(tree.nodes, 'GlobalSettings'), key).props[4] = wrong; };
    assert.throws(changed(set), new RegExp(`GlobalSettings ${key} is ${wrong} where this export's is ${BAKE.EXPORT_AXES[key]}`), key);
  }
  const move = (name, cm) => (tree) => { rowOf(modelOf(tree, name), 'Lcl Translation').props[4] += cm; };
  assert.throws(changed(move('Cube.004', 3)), /Cube\.004 \(hatchFore\) was read standing in the box \[\[6\.913,34\.456,11\.701\],\[11\.757,38\.038,12\.111\]\] and stands in \[\[6\.943,34\.456,11\.701\],\[11\.787,38\.038,12\.111\]\] - 3\.0 cm out/);
  assert.doesNotThrow(changed(move('Cube.004', 1)), 'a centimetre is inside the slack');
  assert.equal(BAKE.BOX_SLACK, 0.02);
  // every role carries the box it was read in, and the export stands in every one
  for (const [name, r] of Object.entries(BAKE.ROLES)) {
    assert.ok(Array.isArray(r.box) && r.box.length === 2 && r.box.every((e) => e.length === 3 && e.every((v) => Math.round(v * 1000) / 1000 === v)), `${name}: a box to the millimetre`);
    assert.equal(r.at, undefined, `${name}: no point-in-box left`);
  }
});

// ── B7: the file says what it holds ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B7 THE FILE SAYS WHAT THE BAKE DID: each part\'s `split` is how many of its polygons were cut (four corners or more; the rest were triangles), and `earClipped` - a count of ear clips the bake no longer runs - is gone', () => {
  for (const part of SHIPPED.parts) {
    assert.equal(part.earClipped, undefined, `${part.role}: no earClipped`);
    assert.equal(part.split, part.polygons.filter((p) => p.length > 3).length, `${part.role}/${part.object}: split`);
  }
  assert.equal(SHIPPED.parts.reduce((s, p) => s + p.split, 0), 332, 'of her 401 polygons, 69 triangles');
});

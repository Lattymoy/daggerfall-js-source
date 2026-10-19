// FIELD BUGS 2026-10-13e HILL-SEAT (SylviaBun on the Discord: "Some locations have floating houses - Temple of Kynareth
// has floating houses due to terrain modifications, may be others" - a night screenshot of a house on a grass mound, the
// mound's crest falling away under its front wall and a lit gap under the wall; the travel map's mark on a southern
// peninsula).
//
// Beautiful Villages stands about a fifth of Kynareth's temples as TEMPASH3 (Ipsham's block), whose houses 127, 129 and
// 201 and temple 402 the author stood on the RMB Resource Pack's hill 52758, its plateau 4.1-4.2 m up. HILL-SHAPES drew
// the hill at its measured profile and seated them at their ORIGINS, but the profile is each cell's median and it falls
// away towards the plateau's edge, so a house's far wall hung over the drawn slope (fb1005_hills read only the middle
// half of each footprint). A HILL HOLDS WHAT THE AUTHOR STOOD ON IT: world/townStandIns.js blockHillPatch lays a pad
// under each model stood up on a drawn hill, its top HILL_PATCH_SINK under the model's base over the whole footprint.
//
// No game data: TEMPASH3's subrecords and misc records are carried WHOLE in the vendored pack (rows, never a reference
// into the player's BLOCKS.BSA), built by the door's own converter and laid out by layoutRmbBlock; the hill is the
// pipeline's own stand-in (RMBRP_PIECES - hillMesh over RMBRP_HILL_SHAPES[52758]). The houses' meshes are ARCH3D's, so
// each stands here as a synthetic box of a documented size at its authored matrix: HOUSE_W x HOUSE_H x HOUSE_W, its
// origin at the middle of its floor - 14 m (560 classic units) on a side, the reach the report's measure ran to (7 m out
// from each origin, the middle of this box's walls). The drawn top is measured on its own, a ray straight down through
// every triangle drawn (fb1003b_trees' drawnTopAt), never through the seat under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { NATURE_FLATS_Y } from '../../src/world/rmbFlats.js';
import { RMBRP_HILLS, RMBRP_PIECES, blockHillSeat, blockHillPatch, seatNatureFlat, HILL_SEAT_TOLERANCE, HILL_PATCH_SINK, HILL_SEAT_PLANE, HILL_SEAT_STAND } from '../../src/world/townStandIns.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { StaticBatchBuilder, keyResolver } from '../../src/render/staticBatch.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TOLERANCE = 0.15;   // the law's bar, the test's own number (HILL_SEAT_TOLERANCE is pinned to it below)
const HOUSES = [127, 129, 201, 402];
const HOUSE_W = 14, HOUSE_H = 6;
const drawn = (id) => (RMBRP_HILLS[id] ? RMBRP_PIECES[id]() : null);   // the pipeline's stand-in, as fb1005_hills reads it
const boxMesh = (w, h) => { const m = new MeshBuilder(); m.box([302, 1], [0, h / 2, 0], [w, h, w]); return m.build(); };
const HOUSE = boxMesh(HOUSE_W, HOUSE_H);

// ---- the pack's own records, as the door serves them -------------------------------------------------------------
const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL('../../vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', import.meta.url))).toString('utf8'));
const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const nodes = pack.nodes.map(P);
function expand(v) {
  if (Array.isArray(v)) return v.map(expand);
  if (!v || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  assert.ok(!keys.includes('$c') && !keys.includes('$o'), 'a record carried whole, not read from the player\'s BLOCKS.BSA');
  if (v.$n !== undefined) return expand(nodes[v.$n]);
  const k = keys.find((key) => ROW_CODECS[key]);
  if (k) return v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : expand(row)));
  return Object.fromEntries(keys.map((key) => [key, expand(v[key])]));
}
function whole(name, key) {
  for (let n = `${name}.json`; n;) {
    const [, base, ops] = P(pack.files[n]);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === `RmbBlock.${key}`);
    if (op) return expand(op[2]);
    n = base[0] === 'f' ? base[1] : null;
  }
  return [];
}
const TEMPASH3 = blockFromJson({ Name: 'TEMPASH3.RMB', RmbBlock: { FldHeader: {}, SubRecords: whole('TEMPASH3.RMB', 'SubRecords'), Misc3dObjectRecords: whole('TEMPASH3.RMB', 'Misc3dObjectRecords'), MiscFlatObjectRecords: [] } }, 9200);
const { models } = layoutRmbBlock(TEMPASH3);
const house = (id) => models.find((m) => m.modelIdNum === id);
const meshOf = (placed) => (HOUSES.includes(placed.modelIdNum) ? HOUSE : null);   // the houses as synthetic boxes; nothing else has a classic mesh here

/** Every triangle of `meshes` ([mesh, matrix] each) laid in the block's frame - its three corners. */
function layFlat(meshes) {
  const out = [];
  for (const [mesh, m] of meshes) {
    const p = mesh.positions, w = [];
    for (let i = 0; i < p.length; i += 3) for (let r = 0; r < 3; r++) w.push(m[r] * p[i] + m[4 + r] * p[i + 1] + m[8 + r] * p[i + 2] + m[12 + r]);
    for (let t = 0; t < mesh.indices.length; t += 3) out.push([0, 1, 2].map((k) => w.slice(mesh.indices[t + k] * 3, mesh.indices[t + k] * 3 + 3)));
  }
  return out;
}
/** THE DRAWN TOP, measured on its own: a ray straight down (Moller-Trumbore) through every triangle of `tris`
 *  (layFlat's) - the highest hit, or null. */
function rayTop(tris, x, z) {
  let top = null;
  for (const [a, b, c] of tris) {
    if (x < Math.min(a[0], b[0], c[0]) - 1e-6 || x > Math.max(a[0], b[0], c[0]) + 1e-6 || z < Math.min(a[2], b[2], c[2]) - 1e-6 || z > Math.max(a[2], b[2], c[2]) + 1e-6) continue;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const pv = [-e2[2], 0, e2[0]];   // (0, -1, 0) x e2
    const det = e1[0] * pv[0] + e1[2] * pv[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = [x - a[0], 1000 - a[1], z - a[2]];
    const u = (s[0] * pv[0] + s[2] * pv[2]) / det;
    if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = -q[1] / det;
    if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const y = 1000 - (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (top === null || y > top) top = y;
  }
  return top;
}
const IDENTITY = trs(0, 0, 0, 0, 0, 0);
const HILLS = layFlat(models.filter((m) => RMBRP_HILLS[m.modelIdNum]).map((m) => [drawn(m.modelIdNum), m.matrix]));
/** What the block draws over (x, z): its hills, the pads (`patch` laid flat, or null), or its plane. */
const drawnTop = (pads, x, z) => Math.max(rayTop(pads ? [...HILLS, ...pads] : HILLS, x, z) ?? 0, 0);

/** A box's WHOLE footprint, edges included: its floor's points on a 21 x 21 grid (u, v from 0 to 1), laid by `m`. */
function footprint(m, w = HOUSE_W) {
  const pts = [];
  for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
    const lx = -w / 2 + (w * i) / 20, lz = -w / 2 + (w * j) / 20;
    pts.push([m[0] * lx + m[8] * lz + m[12], m[1] * lx + m[9] * lz + m[13], m[2] * lx + m[10] * lz + m[14]]);
  }
  return pts;
}
const worstGap = (pads, m, w) => Math.max(...footprint(m, w).map(([x, y, z]) => y - drawnTop(pads, x, z)));

test('HILL-SEAT: the report - TEMPASH3 stands its houses and temple on hill 52758\'s plateau, and the drawn hill fell away under their walls (a house\'s whole footprint, edges included, hung up to 2.2 m); with the pads every point of every footprint stands within 0.15 m of what is drawn under it', () => {
  assert.equal(TOLERANCE, HILL_SEAT_TOLERANCE, 'the bar');
  assert.ok(Math.abs(HILL_PATCH_SINK - 0.05) < 1e-12, 'the pad\'s top 2 classic units under a base, as a town\'s models stand over their ground');
  assert.ok(models.some((m) => m.modelIdNum === 52758), 'the hill the block stands on');
  const before = {}, after = {};
  const hills = blockHillSeat(models, drawn), seat = blockHillSeat(models, drawn);
  const patch = blockHillPatch(seat, models, meshOf, drawn);
  assert.ok(patch, 'pads laid');
  const pads = layFlat([[patch, IDENTITY]]);
  for (const id of HOUSES) {
    const m = house(id).matrix;
    assert.ok(m[13] > 4.1 && m[13] < 4.25, `${id}: authored on the plateau (${m[13].toFixed(2)})`);
    assert.ok(hills.topAt(m[12], m[14]) !== null, `${id}: over the drawn hill`);
    before[id] = worstGap(null, m, HOUSE_W);
    after[id] = worstGap(pads, m, HOUSE_W);
    assert.ok(after[id] <= TOLERANCE, `${id}: the worst point of its footprint ${after[id].toFixed(3)} m over what is drawn (before the pads ${before[id].toFixed(3)} m)`);
    // the model is not moved, and nothing is raised over its base: the drawn top under it, pads and all, is at most
    // the higher of the hill and its base
    for (const [x, y, z] of footprint(m)) {
      assert.ok(drawnTop(pads, x, z) <= Math.max(drawnTop(null, x, z), y) + 1e-4, `${id} at (${x.toFixed(1)}, ${z.toFixed(1)}): nothing raised over its base`);
    }
  }
  // the report: the houses' far walls hung a metre and more over the median's slope (the screenshot's lit gap)
  assert.ok(before[127] > 2 && before[129] > 2 && before[201] > 0.8 && before[402] > 0.4, `before: ${JSON.stringify(before)}`);
  assert.ok(Object.values(after).every((g) => Math.abs(g - HILL_PATCH_SINK) < 1e-3), `after: each pad's top a sink under its base where the hill fell away (${JSON.stringify(after)})`);
});

test('HILL-SEAT: what the author did not stand on a hill gets nothing - a model on the block\'s plane (the hill over it, or its foot under it), one over no hill, one hung over the hill, one the hill holds already; and a pad is laid under the houses alone', () => {
  const at = (x, y, z, yaw = 0) => ({ modelIdNum: 9001, matrix: trs(x, y, z, 0, yaw, 0) });
  const hillsOf = () => models.filter((m) => RMBRP_HILLS[m.modelIdNum]);
  const padFor = (placed, mesh = HOUSE) => blockHillPatch(blockHillSeat(models, drawn), [...hillsOf(), placed], () => mesh, drawn);
  const m129 = house(129).matrix, hill = house(52758).matrix;
  const seat = blockHillSeat(models, drawn);
  // on the plane, under the hill's foot where it rises over the base: the hill buries it, as the pack's does
  assert.equal(padFor(at(m129[12], 0, m129[14])), null, 'on the plane, inside the hill');
  // on the plane by the hill's foot, where the drawn top falls under its base: stood on the plane, not up a hill
  const foot = [hill[12] + 28.5, hill[14]];
  assert.ok(seat.topAt(foot[0], foot[1]) !== null && seat.topAt(foot[0], foot[1]) < 0.3, 'the hill\'s foot');
  const small = boxMesh(1, 1);
  assert.ok(0.4 < HILL_SEAT_PLANE, 'under the plane\'s bar');
  assert.equal(padFor(at(foot[0], 0.4, foot[1]), small), null, 'its base 0.4 m up, over the foot: the block\'s plane holds it');
  assert.ok(padFor(at(foot[0], 0.7, foot[1]), small), 'the same model 0.7 m up the foot stands on the hill, and is held');
  // over no hill
  assert.equal(seat.topAt(10, 90), null);
  assert.equal(padFor(at(10, 4.2, 90)), null, 'over no drawn hill: the author\'s own air');
  // hung: more than HILL_SEAT_STAND over every drawn top under it; within it, stood (and held)
  const lifted = (dy) => ({ modelIdNum: 9001, matrix: Float32Array.from(m129, (v, i) => (i === 13 ? v + dy : v)) });
  const highest = Math.max(...footprint(m129).map(([x, , z]) => drawnTop(null, x, z)));
  assert.ok(m129[13] + 1.6 - highest > HILL_SEAT_STAND && m129[13] + 0.6 - highest < HILL_SEAT_STAND, `the plateau's highest under 129: ${highest.toFixed(2)}`);
  assert.equal(padFor(lifted(1.6)), null, 'hung 1.6 m over the plateau: it keeps its air');
  assert.ok(padFor(lifted(0.6)), '0.6 m over it: stood on the hill, and held');
  // held already: TEMPASH3's own props on the plateau (40014, seated within 0.15 m by HILL-SHAPES) as a 2 m box
  for (const p of models.filter((m) => m.modelIdNum === 40014)) assert.equal(padFor(p, boxMesh(2, 1)), null, '40014: the hill holds it');
  // the four houses' pads, and nowhere else: every pad vertex within its bank's reach of a house's footprint
  const patch = blockHillPatch(blockHillSeat(models, drawn), models, meshOf, drawn);
  const reach = 0.25 + (4.22 + 0.25) / 1 + 0.01;   // the flat margin, then the bank's longest run (under the plane)
  for (let i = 0; i < patch.positions.length; i += 3) {
    const [x, z] = [patch.positions[i], patch.positions[i + 2]];
    const near = HOUSES.some((id) => {
      const m = house(id).matrix, dx = x - m[12], dz = z - m[14];
      const lx = Math.abs(m[0] * dx + m[2] * dz), lz = Math.abs(m[8] * dx + m[10] * dz);
      return Math.max(lx, lz) <= HOUSE_W / 2 + reach;
    });
    assert.ok(near, `a pad vertex at (${x.toFixed(1)}, ${z.toFixed(1)}) by no house`);
  }
});

test('HILL-SEAT: the footprint\'s lowest drawn point is found wherever the drawn top puts it - where a crease of the top crosses the footprint\'s edge, or at a pit\'s corner inside it - though no corner of the footprint and no sample of its inside comes near (two drawn hills of the test\'s own)', () => {
  const ROCK = [302, 3], h = 2;
  const steep = (tris) => { const m = new MeshBuilder(); for (const [a, b, c] of tris) m.tri(ROCK, a, b, c, [0, 1, 0]); return m.build(); };
  // a V: two faces meeting along x = z at `h`, rising 40 m to the far corners - the crease crosses the footprint
  const crease = steep([[[-10, h, -10], [10, h, 10], [10, h + 40, -10]], [[-10, h, -10], [-10, h + 40, 10], [10, h, 10]]]);
  // a pit: a fan of four faces down to (0.3, h, 0.2), rising 40 m to the corners of a 20 m square
  const c = [0.3, h, 0.2], sq = [[-10, h + 40, -10], [10, h + 40, -10], [10, h + 40, 10], [-10, h + 40, 10]];
  const pit = steep(sq.map((q, i) => [c, q, sq[(i + 1) % 4]]));
  const cases = [
    { name: 'crease', mesh: crease, placed: { modelIdNum: 9002, matrix: trs(0.3, h + 0.3, 0, 0, 45, 0) }, box: boxMesh(2, 1), critical: [] },
    { name: 'pit', mesh: pit, placed: { modelIdNum: 9002, matrix: trs(0, h + 0.3, 0, 0, 0, 0) }, box: boxMesh(4, 1), critical: [[c[0], c[2]]] },
  ];
  // the crease's crossings with the turned box's four edges, worked out here: x = z against each edge
  const M = cases[0].placed.matrix, corner = (lx, lz) => [M[0] * lx + M[8] * lz + M[12], M[2] * lx + M[10] * lz + M[14]];
  const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  for (let i = 0; i < 4; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % 4]], fa = a[0] - a[1], fb = b[0] - b[1];
    if (fa * fb < 0) { const t = fa / (fa - fb); cases[0].critical.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  assert.equal(cases[0].critical.length, 2, 'the crease crosses two edges');
  for (const { name, mesh, placed, box, critical } of cases) {
    const hill = { modelIdNum: 77001, matrix: IDENTITY }, drawnHere = (id) => (id === 77001 ? mesh : null);
    const tris = layFlat([[mesh, IDENTITY]]);
    const base = placed.matrix[13];
    for (const [x, z] of critical) assert.ok(base - rayTop(tris, x, z) > TOLERANCE + 0.1, `${name}: the drawn top falls ${(base - rayTop(tris, x, z)).toFixed(2)} m under the base at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    const seat = blockHillSeat([hill, placed], drawnHere);
    const patch = blockHillPatch(seat, [hill, placed], () => box, drawnHere);
    assert.ok(patch, `${name}: a pad`);
    const all = [...tris, ...layFlat([[patch, IDENTITY]])];
    for (const [x, z] of critical) assert.ok(base - rayTop(all, x, z) <= TOLERANCE, `${name}: held at its lowest point`);
  }
});

test('HILL-SEAT: a pad is the hill\'s own ground - the hill\'s picture (52758\'s grass), the hill\'s texture coordinates in the hill\'s frame (the grass runs on where the bank meets the hill), every face up, and its bank\'s edge never in the open (under the hill or the plane wherever it ends)', () => {
  const seat = blockHillSeat(models, drawn), patch = blockHillPatch(seat, models, meshOf, drawn);
  const hillMesh = drawn(52758), hm = house(52758).matrix;
  assert.deepEqual(patch.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), [[hillMesh.subMeshes[0].textureArchive, hillMesh.subMeshes[0].textureRecord]], 'one picture, the hill\'s');
  assert.deepEqual([hillMesh.subMeshes[0].textureArchive, hillMesh.subMeshes[0].textureRecord], [302, 2], 'grass');
  const p = patch.positions, n = patch.normals, uv = patch.uvs;
  for (let i = 0; i < p.length / 3; i++) {
    // the hill's frame: a turn about y and a translation, so its inverse is the turn's transpose
    const dx = p[i * 3] - hm[12], dy = p[i * 3 + 1] - hm[13], dz = p[i * 3 + 2] - hm[14];
    const lx = hm[0] * dx + hm[1] * dy + hm[2] * dz, lz = hm[8] * dx + hm[9] * dy + hm[10] * dz;
    assert.ok(Math.abs(uv[i * 2] - lx / 4) < 1e-3 && Math.abs(uv[i * 2 + 1] + lz / 4) < 1e-3, `vertex ${i}: the hill's own (x / 4, -z / 4) in its frame`);
    assert.ok(n[i * 3 + 1] > 0, `vertex ${i}: faces up`);
  }
  for (let t = 0; t < patch.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => patch.indices[t + k] * 3);
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    assert.ok(u[2] * v[0] - u[0] * v[2] > 0, `triangle ${t / 3}: wound to face up`);
  }
  // the pad's outline - the edges one triangle alone holds - stands at or under what the hills and the plane draw there
  const key = (i) => `${p[i * 3].toFixed(4)},${p[i * 3 + 1].toFixed(4)},${p[i * 3 + 2].toFixed(4)}`;
  const edges = new Map();
  for (let t = 0; t < patch.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = patch.indices[t + k], b = patch.indices[t + ((k + 1) % 3)], e = [key(a), key(b)].sort().join('|');
    edges.set(e, [(edges.get(e)?.[0] ?? 0) + 1, a, b]);
  }
  let outline = 0;
  for (const [count, a, b] of edges.values()) {
    if (count !== 1) continue;
    for (const i of [a, b]) {
      outline++;
      const ground = drawnTop(null, p[i * 3], p[i * 3 + 2]);
      assert.ok(p[i * 3 + 1] <= ground + 1e-4, `the bank ends at (${p[i * 3].toFixed(1)}, ${p[i * 3 + 2].toFixed(1)}) ${(p[i * 3 + 1] - ground).toFixed(2)} m over what is drawn - a cliff in the open`);
    }
  }
  assert.ok(outline > 0, 'the pads have an outline');
});

test('HILL-SEAT x TREES-SEATED: the seat the hosts read stands a tree on the pad as on the hill - where the pad stands over the hill, a nature flat stands on the pad\'s top, the top drawn there', () => {
  const hills = blockHillSeat(models, drawn), seat = blockHillSeat(models, drawn);
  const patch = blockHillPatch(seat, models, meshOf, drawn);
  const all = [...HILLS, ...layFlat([[patch, IDENTITY]])];
  let onPad = 0;
  for (const id of HOUSES) {
    for (const [x, , z] of footprint(house(id).matrix)) {
      const drawnThere = Math.max(rayTop(all, x, z) ?? NATURE_FLATS_Y, NATURE_FLATS_Y);
      const seated = seatNatureFlat(seat, x, z, NATURE_FLATS_Y);
      assert.ok(Math.abs(seated - drawnThere) < 1e-3, `${id} (${x.toFixed(1)}, ${z.toFixed(1)}): seated ${seated.toFixed(3)}, drawn ${drawnThere.toFixed(3)}`);
      if (seated > seatNatureFlat(hills, x, z, NATURE_FLATS_Y) + 0.5) onPad++;
    }
  }
  assert.ok(onPad > 50, `${onPad} spots where the pad stands half a metre or more over the hill, and a tree there stands on it`);
});

test('HILL-SEAT: the pads ride the pixel\'s own static merge - one GPU mesh with the block\'s models, in the hill\'s resolved picture, freed by the one destroyMesh that frees the pixel\'s batch (a recording renderer)', () => {
  const seat = blockHillSeat(models, drawn), patch = blockHillPatch(seat, models, meshOf, drawn);
  const live = new Set();
  const renderer = { createMesh: (model) => { const h = { model }; live.add(h); return h; }, destroyMesh: (h) => { live.delete(h); } };
  const origin = trs(1000, 50, -2000, 0, 0, 0);   // the block's origin in its pixel
  const remap = new Map([['302_2', '102_2']]);   // a climate's grass
  const sb = new StaticBatchBuilder(), resolve = keyResolver(remap), hill = drawn(52758);
  sb.add(hill, multiply(origin, house(52758).matrix), resolve);   // the hill, merged as any model of the block is
  sb.add(patch, origin, resolve);   // world.js's own call: addStatic(hillPatch, originMatrix, false) - staticBuilder.add through the pixel's table (PIN MOVED, AUDIT PRECIP HOST-7: the merge's models logged)
  const merged = sb.finish();
  const batch = renderer.createMesh(merged);
  assert.equal(live.size, 1, 'one GPU mesh for the pixel\'s statics, pads and all');
  assert.equal(merged.triangles, hill.indices.length / 3 + patch.indices.length / 3, 'the pads\' triangles in it');
  assert.deepEqual(merged.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`), ['102_2'], 'the hill\'s picture as the pixel resolves it, one run with the hill');
  for (const i of [0, 1, 2]) assert.ok(Math.abs(merged.positions[hill.positions.length + i] - (patch.positions[i] + origin[12 + i])) < 1e-3, 'laid by the block\'s origin');
  renderer.destroyMesh(batch);   // destroyPixel's `renderer.destroyMesh(p.staticBatch)`
  assert.equal(live.size, 0, 'nothing of the pads outlives the pixel');
});

test('HILL-SEAT by source: THE FOUR HOSTS - world.js lays the pads into its pixel\'s static merge and its collider bucket (both freed in destroyPixel and on a failed build) before its flats read the seat; exterior.js draws and collides them before its flats; worldModes.js and dungeonContext.js stand no hill', () => {
  const w = hostText('src/scenes/world.js');
  const seatAt = w.indexOf('const hillSeat = blockHillSeat(b.layout.models);');
  const wPatch = 'const hillPatch = blockHillPatch(hillSeat, b.layout.models, (m) => (m.enhancedOnly && !isEnhanced() ? null : cpuModels.get(m.modelIdNum)));';
  const wWire = 'if (hillPatch) { addStatic(hillPatch, originMatrix, false); collider.addMesh(key, hillPatch.positions, hillPatch.indices, originMatrix, onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]))); unionBox(transformedAabb(localAabb(hillPatch.positions), originMatrix)); }';
  assert.ok(seatAt > 0 && w.indexOf(wPatch) > seatAt, 'world.js: the pads, off the block\'s seat and the meshes it drew');
  assert.ok(w.indexOf(wWire) > w.indexOf(wPatch), 'world.js: merged with the pixel\'s statics, solid in the pixel\'s bucket, inside its culling box');
  assert.ok(w.indexOf(wWire) < w.indexOf('seatNatureFlat(hillSeat, flat.x, flat.z, NATURE_FLATS_Y + groundOffPlane(samples, avg, fx, fz))'), 'world.js: before the trees read the seat');
  assert.doesNotMatch(w, /createMesh\(hillPatch/, 'world.js: no GPU mesh of their own - the pixel\'s batch is theirs');
  assert.match(w, /if \(p\.staticBatch\) \{ renderer\.destroyMesh\(p\.staticBatch\); p\.staticBatch = null; \}/, 'world.js destroyPixel frees the batch');
  assert.match(w, /function destroyPixel\([^]*?collider\.removeBucket\(key\);/, 'world.js destroyPixel drops the pixel\'s bucket');
  assert.match(w, /if \(m\.staticBatch\) renderer\.destroyMesh\(m\.staticBatch\);/, 'world.js: a failed build frees its batch too');
  const e = src('src/scenes/exterior.js');
  const eSeat = e.indexOf('hillSeat = blockHillSeat(b.layout.models);');
  const ePatch = e.indexOf('const hillPatch = blockHillPatch(hillSeat, b.layout.models, (m) => ((m.enhancedOnly && !isEnhanced()) || !gpuMeshes.get(m.modelIdNum) ? null : cpuModels.get(m.modelIdNum)));');
  const eWire = e.indexOf('if (hillPatch) { drawList.push({ mesh: renderer.createMesh(hillPatch), matrix: originMatrix, order: -2, box: transformedAabb(localAabb(hillPatch.positions), originMatrix) }); collider.addMesh(\'world\', hillPatch.positions, hillPatch.indices, originMatrix);');
  assert.ok(eSeat > 0 && ePatch > eSeat && eWire > ePatch, 'exterior.js: the pads drawn and solid in the location\'s frame');
  assert.ok(eWire < e.indexOf('seatNatureFlat(hillSeat, flat.x, flat.z, NATURE_FLATS_Y)'), 'exterior.js: before the trees read the seat');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(src(host), /blockHillSeat|blockHillPatch|layoutRmbBlock/, `${host}: stands no town block, so no hill`);
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

/** The test's own hull ([x, z] round the outside, gift-wrapped) - independent of the producer's. */
function wrap(points) {
  const pts = [...new Map(points.map((q) => [`${q[0].toFixed(5)},${q[1].toFixed(5)}`, q])).values()];
  if (pts.length < 3) return pts;
  let start = pts.reduce((a, q) => (q[0] < a[0] || (q[0] === a[0] && q[1] < a[1]) ? q : a));
  const out = [];
  let p = start;
  do {
    out.push(p);
    let next = pts[0] === p ? pts[1] : pts[0];
    for (const q of pts) {
      if (q === p) continue;
      const c = (next[0] - p[0]) * (q[1] - p[1]) - (next[1] - p[1]) * (q[0] - p[0]);
      if (c < 0 || (c === 0 && Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(next[0] - p[0], next[1] - p[1]))) next = q;
    }
    p = next;
  } while (p !== start && out.length <= pts.length);
  return out;
}

// FIELD BUGS 2026-10-15f TEMPLE-STEPS: THE SHAPE THE PRODUCER MINTS. This sweep fed blockHillPatch Daggerfall's own models
// alone, where the hosts feed it every mesh they draw (the stand-ins too - scenes/world.js cpuModels), and held a model
// to the hills and the pads alone, where the author stood temples on his foundations and a stair on the landing or the
// stair under it. So each block is the pack's own as the door serves it (tools/townSolidsSweep.mjs eachPackBlock), its
// models the pipeline's (tools/townQuestMarkers.mjs openTownData), and what holds a model is what is drawn under it:
// the hills, the pads, or another of the block's models whose top there is at most its base and the bar.
test('HILL-SEAT with ARENA2: over every block of both packs that stands a hill, every model the author stood up on one stands on what is drawn under it - the hills, the pads, or the block\'s own models (TEMPLE-STEPS: a temple on its foundations, a stair on its landing) - its own walls\' and floors\' footprint, edges included, within 0.15 m everywhere; save two, named', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 600000 }, async () => {
  const WDR = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { openTownData } = await import('../../tools/townQuestMarkers.mjs');
  const { eachPackBlock } = await import('../../tools/townSolidsSweep.mjs');
  const quiet = console.log; console.log = () => {};
  const hung = [];
  let stood = 0, padded = 0;
  try {
    const data = await openTownData(ARENA2);
    eachPackBlock(data, (vendor, name, laid) => {
      const hills = blockHillSeat(laid);
      if (!hills) return;
      const seat = blockHillSeat(laid);
      const meshOf = (m) => (RMBRP_HILLS[m.modelIdNum] ? null : data.getModel(m.modelIdNum));
      if (blockHillPatch(seat, laid, meshOf)) padded++;
      // each of the block's models as drawn: its own top (what the author may have stood another on)
      const tops = laid.map((m) => (meshOf(m)?.positions?.length ? blockHillSeat([{ modelIdNum: 1, matrix: m.matrix }], () => meshOf(m)) : null));
      for (const [i, m] of laid.entries()) {
        const mesh = meshOf(m);
        if (!mesh?.positions?.length) continue;
        const M = mesh.positions, T = m.matrix, pts = [];
        let base = Infinity;
        for (let k = 0; k < M.length; k += 3) {
          const w = [0, 1, 2].map((a) => T[a] * M[k] + T[4 + a] * M[k + 1] + T[8 + a] * M[k + 2] + T[12 + a]);
          base = Math.min(base, w[1]); pts.push([w[0], w[2]]);
        }
        const hull = wrap(pts);
        if (hull.length < 3 || base < 0.5) continue;   // on the plane
        const mid = hull.reduce((s, q) => [s[0] + q[0] / hull.length, s[1] + q[1] / hull.length], [0, 0]);
        if (hills.topAt(mid[0], mid[1]) === null) continue;   // on no hill
        const samples = [...hull];
        for (let h = 0; h < hull.length; h++) {
          const a = hull[h], c = hull[(h + 1) % hull.length], n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.25);
          for (let k = 1; k < n; k++) samples.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n]);
        }
        const xs = hull.map((q) => q[0]), zs = hull.map((q) => q[1]);
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) {
          if (hull.every((a, h) => { const c = hull[(h + 1) % hull.length]; return (c[0] - a[0]) * (z - a[1]) - (c[1] - a[1]) * (x - a[0]) >= -1e-9; })) samples.push([x, z]);
        }
        const high = Math.max(...samples.map(([x, z]) => hills.topAt(x, z) ?? -Infinity));
        if (base - high > 1) continue;   // hung by its author over the hill
        stood++;
        const under = (x, z) => Math.max(seat.topAt(x, z) ?? 0, 0, ...tops.map((t, j) => {
          const v = j === i || !t ? null : t.topAt(x, z);
          return v !== null && v <= base + TOLERANCE ? v : -Infinity;
        }));
        // under the model's own walls and floors - its hull spans air where it is not convex (TEMPASH4's temple: 1.8 m of
        // it past its own floor, over the hill's fall, the pack's own hill no higher)
        const worst = Math.max(...samples.filter(([x, z]) => tops[i].topAt(x, z) !== null).map(([x, z]) => base - under(x, z)));
        if (worst > TOLERANCE) hung.push(`${vendor} ${name} ${m.modelIdNum}#${i} ${worst.toFixed(2)} m`);
      }
    });
  } finally {
    console.log = quiet;
    WDR._resetWorldDataReplacement();
  }
  assert.ok(stood > 20 && padded > 0, `${stood} models stood up on the hills, ${padded} blocks padded`);
  // Two, named, measured against the pack's own meshes (its hills, foundations and platforms, as Unity imports them):
  // - TEMPASD1 #56 is the third of the four pieces of Merdale's temple flight, stacked on the fourth (#57): its pad would
  //   lay its top over the fourth's treads and its bank over the second's (TEMPLE-STEPS: a pad buries nothing the author
  //   left in the open), so it has none, and the median falls away under its foot - the pack's own hill holds it;
  // - TEMPASH4 #14 is Kynareth's temple on its five foundations: its back edge stands 2.27 m over the pack's own hill
  //   there, the author's own, and its pad would bury the stair's top step and the rocks at the foundations' feet.
  assert.deepEqual(hung, ['beautiful-villages TEMPASD1.RMB 21728#56 0.43 m', 'beautiful-villages TEMPASH4.RMB 402#14 2.14 m'], 'none hangs over what is drawn but the two named');
});

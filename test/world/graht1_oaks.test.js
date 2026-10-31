// GRAHT1 (2026-10-26, bible/03-World/Graht-Oaks.md; the owner, 2026-10-25: "Vardenfell needs proper super tall low poly
// tree sprites with branchs/leaves that expand to cover the sky. The current simple skybox method is very low quality and
// band aided") - Valenwood's graht-oaks: the tree made (world/jungle/grahtOakMesh.js), its pictures painted
// (render/grahtOakArt.js), the law of where it stands and what it stands (world/jungle/grahtOaks.js, the terrain
// worker's jungle layout), the sky its crowns close, its bodies, its host (scenes/grahtHost.js) and the wiring of all of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  grahtOakMesh, grahtSkeleton, grahtTrunkRadius, icosphere, GRAHT_VARIANTS, GRAHT_LODS, GRAHT_SUBS, GRAHT_DETAIL, GRAHT_SHAPE,
} from '../../src/world/jungle/grahtOakMesh.js';
import {
  GRAHT, GRAHT_MEASURES, GRAHT_FOOT_MAX, GRAHT_TREE_FLOATS, GRAHT_FIN_BODY_R, GRAHT_LAND_RECORDS, grahtSites, grahtFootMask, grahtBodies, grahtLodOf,
} from '../../src/world/jungle/grahtOaks.js';
import { barkPicture, leavesPicture, cardsPicture, mipChain, GRAHT_ART } from '../../src/render/grahtOakArt.js';
import { createGrahtHost, grahtOaksOn, packGrahtMeshes, crownBlocks, fogReach, GRAHT_SLOT, GRAHT_DRAW } from '../../src/scenes/grahtHost.js';
import { jungleLayout, JUNGLE_PALMS, JUNGLE } from '../../src/world/terrain/jungleNature.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';
import { LowPolyTreesGpu } from '../../src/render/lowPolyTreesRender.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';
import { groundAt, tileDraw } from '../../src/world/terrain/terrainNature.js';
import { JUNGLE_ARCHIVE } from '../../src/world/jungle/jungleModels.js';
import { mirrorProjectionX, perspective, lookAt, multiply } from '../../src/world/mat4.js';
import { trailClear } from '../../src/world/jungle/jungleTrails.js';
import { MAP_W, MAP_H } from '../../src/world/road/roadNetwork.js';
import { N, S, NE, NW } from '../../src/world/road/pathData.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TILE = PIXEL_M / 128;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const at3 = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
/** the tree's turn, as the billboard program's mesh mode turns it (render/renderer.js BB_VS: x' = c x + s z, z' = -s x + c z) */
const turn = (p, yaw, s = 1) => { const c = Math.cos(yaw), n = Math.sin(yaw); return [(c * p[0] + n * p[2]) * s, p[1] * s, (-n * p[0] + c * p[2]) * s]; };

/** The distance from `p` to the triangle `t` (three points) - its nearest point (Ericson's closest point on a triangle). */
function pointTriangle(p, [a, b, c]) {
  const ab = sub3(b, a), ac = sub3(c, a), ap = sub3(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  const to = (q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  if (d1 <= 0 && d2 <= 0) return to(a);
  const bp = sub3(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return to(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return to([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]); }
  const cp = sub3(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return to(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return to([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return to([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return to([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** A synthetic pixel's ground: grass a little over the beach, its heights `rise(a, b)` more (a east, b the tile rows),
 *  a track down column `track` (or none), `water` rows (tile y under it) a lake. */
function ground({ rise = () => 0, track = 64, water = -1 } = {}) {
  const H = HEIGHTMAP_DIMENSION, base = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT * 1.6;
  const hm = new Float32Array(H * H);
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] = base + rise(a, b);
  const tm = new Uint8Array(128 * 128).fill(2), paths = new Uint8Array(128 * 128);
  if (track >= 0) for (let y = 0; y < 128; y++) paths[y * 128 + track] = 1;
  for (let y = 0; y <= water; y++) for (let x = 0; x < 128; x++) tm[y * 128 + x] = 0;
  return { hm, tm, paths };
}
const WHOLE = Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3]);
const PY = 2000;
const layout = (g, px, { canopy = WHOLE, rect = null, pois = [] } = {}) => jungleLayout([], g.hm, g.tm, { mapPixelX: px, mapPixelY: PY, locationRect: rect, jungle: { nine: WHOLE, pois, paths: g.paths, canopy } });
const treesOf = (graht) => Array.from({ length: graht.length / GRAHT_TREE_FLOATS }, (_, k) => Array.from(graht.subarray(k * GRAHT_TREE_FLOATS, (k + 1) * GRAHT_TREE_FLOATS)));

test('GRAHT1: the tree, made - every variant at every LOD flat-shaded and wound out of itself (the front face under the renderer\'s frontFace(CW) through its mirrored projection), in its three submeshes, the same on every run, its LODs one silhouette at falling cost', () => {
  // the renderer's handedness, measured: a face whose cross(b - a, c - a) points at the eye lands clockwise on the screen
  const vp = multiply(mirrorProjectionX(perspective(1, 1.6, 0.1, 1000)), lookAt([0, 0, 0], [0, 0, 10], [0, 1, 0]));
  const scr = (p) => { const r = [0, 1, 3].map((i) => vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]); return [r[0] / r[2], r[1] / r[2]]; };
  const [A, B, C] = [[0, 0, 10], [0, 1, 10], [1, 0, 10]].map(scr);   // cross((0,1,0), (1,0,0)) = (0,0,-1): toward the eye
  assert.ok((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) < 0, 'a face toward the eye winds clockwise on the screen - its front under frontFace(CW)');
  for (let v = 0; v < GRAHT_VARIANTS; v++) {
    for (let l = 0; l < GRAHT_LODS; l++) {
      const m = grahtOakMesh(v, l), n = m.positions.length / 3;
      assert.equal(m.subs.length, GRAHT_SUBS.length);
      assert.equal(m.subs.reduce((a, s) => a + s[1], 0), n, 'its submeshes laid end to end, every vertex in one');
      assert.equal(n % 3, 0);
      // flat-shaded and wound by its normal: a face's three normals one, its cross(b - a, c - a)
      for (let k = 0; k < n; k += 3) {
        const a = at3(m.positions, k), b = at3(m.positions, k + 1), c = at3(m.positions, k + 2), cr = cross(sub3(b, a), sub3(c, a));
        const nn = at3(m.normals, k), l2 = Math.hypot(...cr);
        assert.ok(dot(cr, nn) > 0.999 * l2 && Math.abs(Math.hypot(...nn) - 1) < 1e-5, `${v}/${l} face ${k / 3}: its normal its winding, a unit`);
        assert.deepEqual(at3(m.normals, k + 1), nn); assert.deepEqual(at3(m.normals, k + 2), nn);
      }
    }
  }
  // OUT OF ITSELF: the crown's masses' faces face away from each mass's middle; the trunk's rings' faces away from its axis
  const sk = grahtSkeleton(0), m0 = grahtOakMesh(0, 0), [lf, ln] = m0.subs[1], per = icosphere(GRAHT_DETAIL[0].blobSub).f.length * 3;
  assert.equal(ln, sk.blobs.length * per, 'a mass a run of its sphere\'s faces');
  let out = 0, all = 0, push = 0;
  for (let k = lf; k < lf + ln; k += 3) {
    const b = sk.blobs[Math.floor((k - lf) / per)], cen = [0, 1, 2].map((q) => (m0.positions[k * 3 + q] + m0.positions[k * 3 + 3 + q] + m0.positions[k * 3 + 6 + q]) / 3);
    all++; if (dot(at3(m0.normals, k), sub3(cen, b.c)) > 0) out++;
    for (let q = 0; q < 3; q++) {   // each vertex its sphere's, squashed, its underside flattened, pushed about by its seed
      const p = at3(m0.positions, k + q), dy = (p[1] - b.c[1]) / (b.r * b.squash);
      push = Math.max(push, Math.abs(Math.hypot((p[0] - b.c[0]) / b.r, dy < 0 ? dy / GRAHT_SHAPE.blob.under : dy, (p[2] - b.c[2]) / b.r) - 1));
    }
  }
  assert.ok(out / all > 0.97, `the masses' faces out of them (${out} of ${all})`);
  assert.ok(push > 0.12 && push < 0.1401, `a mass's vertices pushed about by up to a seventh of its radius, no more (${push.toFixed(4)})`);
  const t = sk.trunk;
  let tOut = 0, tAll = 0;
  for (let k = m0.subs[0][0]; k < m0.subs[0][0] + m0.subs[0][1]; k += 3) {
    const cen = [0, 1, 2].map((q) => (m0.positions[k * 3 + q] + m0.positions[k * 3 + 3 + q] + m0.positions[k * 3 + 6 + q]) / 3);
    const r = Math.hypot(cen[0], cen[2]);
    if (cen[1] < 30 || cen[1] > t.crownFrom - 2 || r > grahtTrunkRadius(t, cen[1]) * 1.12) continue;   // the column alone: no buttress, root or limb
    tAll++; if (dot([m0.normals[k * 3], 0, m0.normals[k * 3 + 2]], [cen[0], 0, cen[2]]) > 0) tOut++;
  }
  assert.ok(tAll > 50 && tOut === tAll, `the trunk's faces out of its column (${tOut} of ${tAll})`);
  // the same tree on every run, every client
  const again = grahtOakMesh(0, 0);
  assert.deepEqual(again.positions, m0.positions);
  assert.deepEqual(again.uvs, m0.uvs);
  // the LODs: falling cost, one silhouette (the leaves' box within a tenth of the near tree's)
  const tris = [0, 1, 2].map((l) => grahtOakMesh(0, l).subs.map((s) => s[1] / 3));
  assert.deepEqual(tris, [[2337, 4720, 890], [1036, 1180, 236], [114, 180, 0]], 'the LODs\' faces a submesh - bark, leaves, cards');
  const box = (l) => { const g = grahtOakMesh(1, l), [f, c] = g.subs[1], b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = f; i < f + c; i++) for (let q = 0; q < 3; q++) { b[q] = Math.min(b[q], g.positions[i * 3 + q]); b[q + 3] = Math.max(b[q + 3], g.positions[i * 3 + q]); } return b; };
  const b0 = box(0);
  for (const l of [1, 2]) {
    const b = box(l);
    for (let q = 0; q < 6; q++) assert.ok(Math.abs(b[q] - b0[q]) < 0.12 * (b0[q % 3 + 3] - b0[q % 3]), `LOD ${l}'s crown is LOD 0's (axis ${q})`);
  }
});

test('GRAHT1: the measures - each variant\'s height, crown, trunk and foot off its skeleton and drawn so; colossal over the jungle (its emergents\' crowns 34 m), a trunk tens of metres thick, the largest foot inside its cell\'s inset (no foot crosses its pixel)', () => {
  const r1 = (x) => Math.round(x * 10) / 10;
  assert.deepEqual(GRAHT_MEASURES.map((M) => [r1(M.height), r1(M.crownR), r1(M.crownFrom), r1(M.trunk), r1(M.ground), r1(M.foot), M.finBodies.length, r1(Math.max(...M.finBodies.map((b) => Math.hypot(b[0], b[1]))))]),
    [[159.5, 101.6, 78.7, 12.5, 13.1, 23.2, 16, 19.3], [178.9, 101.8, 79.9, 12.1, 12.7, 24.4, 20, 19], [160.3, 103.5, 81.5, 12.5, 13.1, 24.1, 18, 19.4]],
    'each variant\'s height, crown, crown\'s underside, trunk at a man\'s height and at the ground, foot, buttress bodies and their reach');
  for (let v = 0; v < GRAHT_VARIANTS; v++) {
    const sk = grahtSkeleton(v), M = GRAHT_MEASURES[v];
    assert.deepEqual([M.height, M.crownR, M.crownFrom, M.trunk, M.ground, M.foot], [sk.height, sk.crownR, sk.trunk.crownFrom, grahtTrunkRadius(sk.trunk, 1.5), grahtTrunkRadius(sk.trunk, 0), Math.max(...sk.fins.map((f) => f.reach))]);
    assert.ok(M.height * GRAHT.scale[0] > 120 && M.height * GRAHT.scale[1] < 240, `${v}: ${M.height.toFixed(0)} m - colossal, under the shadow pass's depth and the far plane`);
    assert.ok(M.crownFrom * GRAHT.scale[0] > 34 + 28, `${v}: its limbs leave the trunk over the jungle's emergents (34 m) and the haze's floor over them (28 m)`);
    assert.ok(M.crownR * GRAHT.scale[0] > GRAHT.cell * TILE * 0.8, `${v}: a crown that reaches its neighbours' (${M.crownR.toFixed(0)} m)`);
    assert.ok(M.trunk * 2 * GRAHT.scale[0] > 20, `${v}: a trunk over 20 m across (${(M.trunk * 2).toFixed(1)})`);
    // drawn so: the bark reaches its foot at the ground and no further; the leaves within the crown's reach and height
    const m = grahtOakMesh(v, 0);
    let foot = 0, reach = 0, top = 0;
    for (let i = m.subs[0][0]; i < m.subs[0][0] + m.subs[0][1]; i++) { const p = at3(m.positions, i); if (p[1] > -0.5 && p[1] < 1.5) foot = Math.max(foot, Math.hypot(p[0], p[2])); }
    for (let i = m.subs[1][0]; i < m.subs[1][0] + m.subs[1][1]; i++) { const p = at3(m.positions, i); reach = Math.max(reach, Math.hypot(p[0], p[2])); top = Math.max(top, p[1]); }
    assert.ok(foot > M.foot - 1 && foot < M.foot + 12, `${v}: the drawn buttresses reach the foot (${foot.toFixed(1)} against ${M.foot.toFixed(1)}; the roots past it)`);
    assert.ok(reach <= M.crownR * 1.05 && reach > M.crownR * 0.97 && top <= M.height * 1.05 && top > M.height * 0.985, `${v}: the leaves fill the crown its measures say (${(reach / M.crownR).toFixed(3)}, ${(top / M.height).toFixed(3)})`);
  }
  assert.ok(GRAHT_FOOT_MAX < GRAHT.inset[0] * GRAHT.cell * TILE && GRAHT_FOOT_MAX < (1 - GRAHT.inset[1]) * GRAHT.cell * TILE, `the largest foot (${GRAHT_FOOT_MAX.toFixed(1)} m) never reaches its cell's edge`);
  assert.equal(128 % GRAHT.cell, 0, 'a cell divides a pixel');
  assert.deepEqual([grahtLodOf(0), grahtLodOf(GRAHT.lod[0] - 1), grahtLodOf(GRAHT.lod[0]), grahtLodOf(GRAHT.lod[1] - 1), grahtLodOf(GRAHT.lod[1])], [0, 0, 1, 1, 2]);
});

test('GRAHT1: where they stand - the canopy\'s zones whole stand GRAHT.occupancy of the sites, none without the canopy, thinning to none at its line; every foot wholly on land (DFU\'s dirt, grass and stone and the edges between them - off a track, a place\'s rect, water), at the lowest ground under it; every draw the world tile\'s (mutants: the edges refused; water\'s edges land; the foot read on the flats\' ground; an edge tile\'s slope unread)', () => {
  const flat = ground();
  let n = 0, sites = 0;
  for (let px = 1600; px < 1606; px++) {
    const g = layout(flat, px).graht;
    n += g.length / GRAHT_TREE_FLOATS; sites += (128 / GRAHT.cell) ** 2;
    for (const [x, y, z, yaw, s, v] of treesOf(g)) {
      assert.ok(Number.isInteger(v) && v >= 0 && v < GRAHT_VARIANTS && s >= GRAHT.scale[0] && s <= GRAHT.scale[1] && yaw >= 0 && yaw < 2 * Math.PI);
      // its foot off the track (column 64): the trunk's foot circle never reaches a path tile's middle
      assert.ok(Math.abs(x - 64.5 * TILE) > GRAHT_MEASURES[v].foot * s, `the foot off the track (${x.toFixed(1)})`);
      assert.ok(Math.abs(y - (groundAt(flat.hm, x, z) - GRAHT.sink)) < 1e-3, 'at its ground, sunk');
    }
  }
  const share = n / sites;
  assert.ok(share > GRAHT.occupancy * 0.72 && share < GRAHT.occupancy * 0.95, `a whole canopy's sites mostly stood, the track's column off (${share.toFixed(2)})`);
  assert.equal(layout(flat, 1600, { canopy: null }).graht.length, 0, 'no canopy, no graht-oak');
  assert.equal(layout(flat, 1600, { canopy: [-3, -3, -3, -3, -3, -3, -3, -3, -3] }).graht.length, 0, 'outside the canopy\'s zones none');
  // thinning to its line: the canopy's field a pixel's width across - none on its outside half, most deep in
  const edge = [-0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5];
  let west = 0, east = 0;
  for (let px = 1600; px < 1610; px++) for (const [x] of treesOf(layout(flat, px, { canopy: edge }).graht)) { if (x < PIXEL_M / 2) west++; else east++; }
  assert.ok(west < east * 0.35, `thinning to the line (${west} on its outer half, ${east} on its inner)`);
  // a place's rect and water stand none
  const rect = { xMin: 40, xMax: 90, yMin: 40, yMax: 90 };
  for (let px = 1600; px < 1604; px++) {
    for (const [x, , z, , s, v] of treesOf(layout(flat, px, { rect }).graht)) {
      const f = GRAHT_MEASURES[v].foot * s, tx0 = (x - f) / TILE, tx1 = (x + f) / TILE, tz0 = (z - f) / TILE, tz1 = (z + f) / TILE;
      assert.ok(tx1 < rect.xMin || tx0 > rect.xMax || tz1 < rect.yMin || tz0 > rect.yMax, 'no foot in a place\'s rect');
    }
    const wet = ground({ water: 40 });
    for (const [x, , z, , s, v] of treesOf(layout(wet, px).graht)) assert.ok(z - GRAHT_MEASURES[v].foot * s > 40 * TILE, 'no foot in the water');
  }
  // the land a foot covers: DFU's dirt, grass and stone and every edge between them, never one with water - where the
  // jungle's own flats grow on the three alone (a foot held to them stood on 59% of the Bay's whole jungle's sites)
  assert.deepEqual([...GRAHT_LAND_RECORDS], [1, 2, 3, 10, 11, 12, 15, 16, 17, 51, 53]);
  const edges = [10, 11, 12, 51, 15, 16, 17, 53], wetEdges = [5, 6, 7, 48];
  const mixed = ground(), shore = ground();
  for (let y = 1; y < 128; y += 4) for (let x = 1; x < 128; x += 4) { mixed.tm[y * 128 + x] = edges[(x + y) % edges.length]; shore.tm[y * 128 + x] = wetEdges[(x + y) % wetEdges.length]; }
  let onGrass = 0, onEdges = 0;
  for (let px = 1600; px < 1604; px++) {
    onGrass += layout(flat, px).graht.length; onEdges += layout(mixed, px).graht.length;
    assert.equal(layout(shore, px).graht.length, 0, 'every foot over an edge of water stands none');
    for (const f of layout(mixed, px).flats) assert.ok([1, 2, 3].includes(mixed.tm[Math.floor(f.z / TILE) * 128 + Math.floor(f.x / TILE)] & 0x3f), 'the jungle\'s own flats on dirt, grass and stone alone');
  }
  assert.ok(onGrass > 100 && onEdges === onGrass, `a foot over the edges between dirt, grass and stone stands as on grass (${onEdges / GRAHT_TREE_FLOATS} of ${onGrass / GRAHT_TREE_FLOATS})`);
  // ground too rough under the foot stands none; the lowest under the foot on a slope
  const rough = ground({ rise: (a) => a * 0.0016 });   // 26 degrees: a foot's ground rises 22 m across it
  assert.equal(layout(rough, 1600).graht.length, 0, 'ground rougher under a foot than GRAHT.bury stands none');
  const slope = ground({ rise: (a) => a * 0.0004 });   // 7 degrees
  const sl = treesOf(layout(slope, 1601).graht);
  assert.ok(sl.length > 10, 'a gentle slope stands them');
  for (const [x, y, z, , s, v] of sl) {
    const f = GRAHT_MEASURES[v].foot * s;
    assert.ok(y <= groundAt(slope.hm, Math.max(0, x - f + TILE), z) - GRAHT.sink + 0.6, 'stood at the downhill side of its foot');
  }
  // off the jungle's trails, at the foot's reach (world/jungle/jungleTrails.js - where the jungle is whole they run)
  let checked = 0;
  for (let px = 1600; px < 1610; px++) for (const [x, , z, , s, v] of treesOf(layout(flat, px).graht)) { checked++; assert.ok(trailClear(px, PY, x, z, GRAHT_MEASURES[v].foot * s), 'no foot on a trail'); }
  assert.ok(checked > 300);
  // the trunk's own tile no steeper than the jungle trees' 34 degrees: a 9.6 m step down the middle of cell 3 (its tiles
  // 55 and 56 at 37 degrees; a foot over it under GRAHT.bury)
  const ridge = ground({ rise: (a) => (a >= 56 ? 0.005 : 0) });
  let onRidge = 0, near = 0;
  for (let px = 1600; px < 1616; px++) for (const [x] of treesOf(layout(ridge, px).graht)) { const tx = Math.floor(x / TILE); if (tx === 55 || tx === 56) onRidge++; if (tx >= 52 && tx <= 59) near++; }
  assert.equal(onRidge, 0, 'no trunk on the step');
  assert.ok(near > 10, 'beside it, trees whose feet span it');
  for (let y = 0; y < 128; y++) { ridge.tm[y * 128 + 55] = 11; ridge.tm[y * 128 + 56] = 11; }   // the step an edge of dirt and grass: its slope read all the same
  for (let px = 1600; px < 1616; px++) for (const [x] of treesOf(layout(ridge, px).graht)) { const tx = Math.floor(x / TILE); assert.ok(tx !== 55 && tx !== 56, 'no trunk on a steep edge tile'); }
  // every draw the world tile's: the same trees on every call, and a pixel's own
  assert.deepEqual(layout(flat, 1603).graht, layout(flat, 1603).graht);
  assert.notDeepEqual(layout(flat, 1603).graht, layout(flat, 1604).graht);
  const a = treesOf(layout(flat, 1603).graht)[0];
  const C = GRAHT.cell, cx = Math.floor(a[0] / TILE / C), cy = Math.floor(a[2] / TILE / C), wx = 1603 * 128 + cx * C, wz = -PY * 128 + cy * C;
  assert.ok(Math.abs(a[0] / TILE - (cx * C + C * (GRAHT.inset[0] + (GRAHT.inset[1] - GRAHT.inset[0]) * tileDraw(wx, wz, GRAHT.salt)))) < 1e-3, 'its place its world cell\'s draw');
});

test('GRAHT1: the storeys keep off - no canopy tree, young tree, palm or roadside pair on a graht-oak\'s foot, no floor plant out of its trunk; the canopy off, the jungle stands as it stood', () => {
  // the roadside pairs: a road north-south through the pixel's middle and two tracks off it, its band painted as the
  // road painter paints it
  const PXR = 400, PYR = 100, net = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  const at = (x, y) => y * MAP_W + x;
  net.roads[at(PXR, PYR)] = N | S; net.tracks[at(PXR, PYR)] = NE | NW; net.roads[at(PXR, PYR - 1)] = S; net.roads[at(PXR, PYR + 1)] = N;
  const road = ground({ track: -1 });
  for (let y = 0; y < 128; y++) for (let x = 62; x <= 65; x++) road.paths[y * 128 + x] = 1;
  const withPairs = jungleLayout([], road.hm, road.tm, { mapPixelX: PXR, mapPixelY: PYR, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: road.paths, net, canopy: WHOLE } });
  const gt = treesOf(withPairs.graht);
  assert.ok(withPairs.pairs.length > 2 && gt.length > 20);
  for (const p of withPairs.pairs) for (const t of p.trees) for (const [x, , z, , s, v] of gt) assert.ok(Math.hypot(t.x - x, t.z - z) > GRAHT_MEASURES[v].foot * s - TILE, 'no pair\'s tree on a graht-oak\'s foot');
  const unpaired = jungleLayout([], road.hm, road.tm, { mapPixelX: PXR, mapPixelY: PYR, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: road.paths, net, canopy: null } });
  assert.ok(unpaired.pairs.length > withPairs.pairs.length, 'the pairs a graht-oak\'s foot would hold stand no more');
  const flat = ground();
  for (let px = 1600; px < 1603; px++) {
    const r = layout(flat, px), trees = treesOf(r.graht), mask = grahtFootMask(r.graht, 128, TILE);
    assert.ok(trees.length > 20);
    for (const f of r.flats) {
      const ti = Math.min(127, Math.floor(f.z / TILE)) * 128 + Math.min(127, Math.floor(f.x / TILE));
      const tree = f.jungle != null || (f.archive === JUNGLE_ARCHIVE && JUNGLE_PALMS.includes(f.record));   // a canopy or young tree, or a palm
      if (tree) assert.equal(mask[ti], 0, 'no jungle tree on a graht-oak\'s foot');
      assert.notEqual(mask[ti], 2, 'no plant of the floor out of a trunk');
    }
    // by the trunks themselves, the mask apart: every jungle tree and palm off every foot, every plant off every trunk
    for (const f of r.flats) {
      const tree = f.jungle != null || (f.archive === JUNGLE_ARCHIVE && JUNGLE_PALMS.includes(f.record));
      for (const [x, , z, , s, v] of trees) {
        const d = Math.hypot(f.x - x, f.z - z), M = GRAHT_MEASURES[v];
        assert.ok(tree ? d > M.foot * s - 0.25 * TILE : d > M.ground * s + 1, `${tree ? 'a tree' : 'a plant'} ${d.toFixed(1)} m from a graht-oak`);
      }
    }
    // the mask: the foot's tiles 1, the trunk's 2
    for (const [x, , z, , s, v] of trees) {
      const M = GRAHT_MEASURES[v];
      assert.equal(mask[Math.floor(z / TILE) * 128 + Math.floor(x / TILE)], 2, 'the trunk\'s own tile');
      const off = Math.floor(z / TILE) * 128 + Math.floor((x + (M.ground + GRAHT.floorClear) * s + TILE) / TILE);
      assert.equal(mask[off], 1, 'past the trunk, the foot');
    }
    // the canopy off: the jungle exactly as it stands without the graht-oaks; with them, its canopy the same off their feet
    // (under it the young trees and the floor take the light a missing canopy tree leaves)
    const without = jungleLayout([], flat.hm, flat.tm, { mapPixelX: px, mapPixelY: PY, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: flat.paths } });
    const off = layout(flat, px, { canopy: null });
    assert.deepEqual(off.flats, without.flats);
    const canopy = (fl) => fl.filter((f) => f.jungle != null && f.js >= JUNGLE.canopyScale[0]).map((f) => `${f.record},${f.x},${f.z}`);
    const tileOf = (k) => { const [, x, z] = k.split(',').map(Number); return Math.min(127, Math.floor(z / TILE)) * 128 + Math.min(127, Math.floor(x / TILE)); };
    assert.deepEqual(canopy(r.flats), canopy(without.flats).filter((k) => !mask[tileOf(k)]), 'the canopy as it stood, but on the graht-oaks\' feet');
    assert.ok(canopy(r.flats).length < canopy(without.flats).length);
  }
});

/** A ray from `o` along `d` against a tree's drawn bark and leaves (its mesh at its root, turn and scale): the nearest hit's distance, or Infinity. */
function rayTree(o, d, tree, meshes) {
  const [x, y, z, yaw, s, v] = tree, m = meshes[v], M = GRAHT_MEASURES[v];
  // the tree's frame: undo the turn and the scale (BB_VS's inverse)
  const c = Math.cos(yaw), n = Math.sin(yaw);
  const lo = [(c * (o[0] - x) - n * (o[2] - z)) / s, (o[1] - y) / s, (n * (o[0] - x) + c * (o[2] - z)) / s];
  const ld = [c * d[0] - n * d[2], d[1], n * d[0] + c * d[2]];
  // its crown's cylinder first
  const R = M.crownR * 1.25, a = ld[0] * ld[0] + ld[2] * ld[2], b = 2 * (lo[0] * ld[0] + lo[2] * ld[2]), cc = lo[0] * lo[0] + lo[2] * lo[2] - R * R;
  if (a > 1e-9 && b * b - 4 * a * cc < 0) return Infinity;
  let best = Infinity;
  const end = m.subs[1][0] + m.subs[1][1], P = m.positions;
  for (let k = 0; k < end; k += 3) {
    const e1 = [P[k * 3 + 3] - P[k * 3], P[k * 3 + 4] - P[k * 3 + 1], P[k * 3 + 5] - P[k * 3 + 2]];
    const e2 = [P[k * 3 + 6] - P[k * 3], P[k * 3 + 7] - P[k * 3 + 1], P[k * 3 + 8] - P[k * 3 + 2]];
    const p = cross(ld, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-9) continue;
    const tv = [lo[0] - P[k * 3], lo[1] - P[k * 3 + 1], lo[2] - P[k * 3 + 2]], u = dot(tv, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(tv, e1), w = dot(ld, q) / det;
    if (w < 0 || u + w > 1) continue;
    const t = dot(e2, q) / det;
    if (t > 0 && t < best) best = t;
  }
  return best * s;
}

test('GRAHT1: the sky is the trees\' - from the forest floor their crowns close it overhead and all but close it lower, with gaps the light comes through; deep in the forest no ray reaches the sky low', () => {
  const flat = ground({ track: -1 });
  const meshes = Array.from({ length: GRAHT_VARIANTS }, (_, v) => grahtOakMesh(v, 0));   // what is drawn near the eye
  const trees = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const t of treesOf(layout(flat, 1600 + i, {}).graht)) trees.push([t[0] + i * PIXEL_M, t[1], t[2] - j * PIXEL_M, t[3], t[4], t[5]]);
  // eyes on the middle pixel's floor, off every trunk
  const eyes = [];
  for (let k = 0; eyes.length < 6 && k < 400; k++) {
    const e = [PIXEL_M * (0.2 + 0.6 * ((k * 0.618) % 1)), 0, PIXEL_M * (0.2 + 0.6 * ((k * 0.381) % 1))];
    if (trees.every((t) => Math.hypot(t[0] - e[0], t[2] - e[2]) > GRAHT_MEASURES[t[5]].foot * t[4] + 4)) { e[1] = trees[0][1] + 1.7; eyes.push(e); }
  }
  assert.equal(eyes.length, 6);
  const covered = (el0, el1) => {
    let hit = 0, all = 0;
    for (const e of eyes) {
      for (let k = 0; k < 14; k++) {
        const el = (el0 + (el1 - el0) * ((k * 0.37) % 1)) * Math.PI / 180, az = k * 2.39996;
        const d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
        all++;
        for (const t of trees) if (rayTree(e, d, t, meshes) < Infinity) { hit++; break; }
      }
    }
    return hit / all;
  };
  const over = covered(60, 90), mid = covered(25, 60);
  assert.ok(over > 0.86 && over < 0.99, `overhead the crowns close the sky, with gaps (${over.toFixed(3)})`);
  assert.ok(mid > 0.92, `lower, all but closed (${mid.toFixed(3)})`);
});

test('GRAHT1: the bodies - the trunk to where its limbs begin, each buttress a run of bodies out to its foot, turned as the billboard program turns the mesh; each on the drawn buttress', () => {
  const tree = [300, 12, 400, 1.1, 1.13, 2], [x, y, z, yaw, s, v] = tree, M = GRAHT_MEASURES[v];
  const bodies = grahtBodies(tree, 0);
  assert.deepEqual(bodies[0], { c: [x, y, z], r: M.trunk * s, h: (M.crownFrom + 4) * s, lift: 0, body: true, nature: true, _mark: 0 }, 'the trunk');   // TRUNK-FOES: a nature body - foes kept out
  assert.equal(bodies.length, 1 + M.finBodies.length);
  assert.ok(M.finBodies.length >= grahtSkeleton(v).fins.length * 2, 'every buttress a run');
  assert.ok(bodies.every((b) => b.body && b.r >= GRAHT_FIN_BODY_R * s - 1e-9 && b.h >= 2 && b.c.length === 3));
  // each buttress body on the drawn fin: the near tree's bark (turned and scaled as drawn) within its reach, a metre up
  const m = grahtOakMesh(v, 0), faces = [];
  for (let i = m.subs[0][0]; i < m.subs[0][0] + m.subs[0][1]; i += 3) {
    const f = [0, 1, 2].map((q) => { const w = turn(at3(m.positions, i + q), yaw, s); return [w[0] + x, w[1] + y, w[2] + z]; });
    if (Math.min(f[0][1], f[1][1], f[2][1]) < y + 4) faces.push(f);
  }
  for (const b of bodies.slice(1)) {
    const at = [b.c[0], y + 1, b.c[2]];
    const near = faces.reduce((d, f) => Math.min(d, pointTriangle(at, f)), Infinity);
    assert.ok(near < b.r, `a buttress body on its fin (${near.toFixed(2)} m off its bark)`);
  }
  // the farthest body near the foot
  const far = Math.max(...bodies.slice(1).map((b) => Math.hypot(b.c[0] - x, b.c[2] - z)));
  assert.ok(far > (M.foot - 6) * s && far < M.foot * s, `out to where the buttress meets the ground (${far.toFixed(1)})`);
});

test('GRAHT1: the pictures - the port\'s own, each tiling at its size, a handful of shades; the cards cut whole by their alpha; the chain down to a texel', () => {
  const bark = barkPicture(), leaves = leavesPicture(), cards = cardsPicture();
  for (const [p, sz] of [[bark, GRAHT_ART.bark], [leaves, GRAHT_ART.leaves], [cards, GRAHT_ART.cards]]) {
    assert.deepEqual([p.width, p.height, p.data.length], [sz.w, sz.h, sz.w * sz.h * 4]);
    assert.ok(Number.isInteger(Math.log2(p.width)) && Number.isInteger(Math.log2(p.height)), 'powers of two');
  }
  for (const p of [bark, leaves]) {
    const shades = new Set();
    for (let i = 0; i < p.data.length; i += 4) { shades.add(`${p.data[i]},${p.data[i + 1]},${p.data[i + 2]}`); assert.equal(p.data[i + 3], 255); }
    assert.ok(shades.size >= 4 && shades.size <= 12, `pixel art: ${shades.size} shades`);
    // it tiles: a column's step across the wrap no bigger than its steps inside
    const lum = (x, y) => { const o = (y * p.width + x) * 4; return p.data[o] + p.data[o + 1] + p.data[o + 2]; };
    let wrap = 0, inner = 0;
    for (let y = 0; y < p.height; y++) { wrap += Math.abs(lum(0, y) - lum(p.width - 1, y)); inner += Math.abs(lum(1, y) - lum(0, y)); }
    assert.ok(wrap < inner * 2.2, `it tiles across its edge (${wrap} against ${inner})`);
  }
  let spray = 0, liana = 0, clear = 0;
  for (let y = 0; y < cards.height; y++) for (let x = 0; x < cards.width; x++) {
    const a = cards.data[(y * cards.width + x) * 4 + 3];
    assert.ok(a === 0 || a === 255, 'cut whole');
    if (!a) continue;
    if (x < cards.width / 2) spray++; else if (x < cards.width * 3 / 4) liana++; else clear++;
  }
  assert.ok(spray > 600 && liana > 150 && clear === 0, `the spray, the liana, the clear quarter (${spray}, ${liana}, ${clear})`);
  const chain = mipChain(cards);
  assert.deepEqual(chain.at(-1).width + chain.at(-1).height, 2);
  assert.equal(chain.length, 8);
  assert.ok(chain.every((l) => l.data.every((_, i) => i % 4 !== 3 || l.data[i] === 0 || l.data[i] === 255)), 'every level cut whole');
});

/** A renderer that records what it is asked - the GPU's calls through a GL that answers anything. */
function fakeRenderer(over = {}) {
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); return {}; }) });
  const r = {
    gl, calls, slots: [], made: [], freed: [], cast: [], _casting: true, _fogMode: 0, _fogRange: [0, 0],
    setLowPolyTrees(f, s) { this.slots[s] = f; },
    createAtlasTexture(w, h, n) { const t = { w, h, n }; this.made.push(t); return t; }, uploadAtlasRows() {},
    releaseAtlasTexture(t) { this.freed.push(t); },
    createMesh(m) { const mesh = { vao: {}, model: m }; this.made.push(mesh); return mesh; }, destroyMesh(m) { this.freed.push(m); },
    recordShadowMesh(mesh, M) { this.cast.push([mesh, Float32Array.from(M)]); },
    ...over,
  };
  return r;
}

test('GRAHT1: the host - a pixel\'s trees stood whole by the keep, their bodies with them; the GPU made on the slice clock; the frame buckets every visible tree a run a variant and LOD on the third slot, culled by the view, the fog and the haze, the travel view\'s well; the nearest cast, as the mesh turns; destroy gives it all back', async () => {
  const r = fakeRenderer();
  let breaths = 0, hidden = null;
  const host = createGrahtHost({ renderer: r, breathe: async () => { breaths++; }, hides: (box) => hidden?.(box) ?? false });
  assert.equal(host.stand(1, 2, new Float32Array(0)), null);
  // met out of their runs' order (the far one first), so the counting sort moves every one of them
  const raw = new Float32Array([600, 5, 640, 2, 1.1, 2, 100, 5, 100, 0.3, 1, 0, 380, 5, 360, 1.2, 0.9, 1, 700, 5, 50, 0.5, 1, 1]);
  const kept = host.stand(1600, 2000, raw, (x) => x !== 700);
  assert.equal(kept.set.trees.length, 3 * GRAHT_TREE_FLOATS, 'the keep refused one whole');
  assert.equal(kept.bodies.length, [0, 6, 12].reduce((a, i) => a + grahtBodies(kept.set.trees, i).length, 0), 'its trees\' bodies');
  assert.ok(r.made.length === 0, 'nothing made until the slice clock runs it');
  await host.prepare();
  assert.equal(breaths, GRAHT_VARIANTS * GRAHT_LODS + 2, 'a mesh a breath, then the pack and the pictures');
  assert.deepEqual(r.made.filter((m) => m.w).map((m) => [m.w, m.h, m.n]), [[64, 128, 8], [64, 64, 7], [128, 64, 8]], 'the three pictures, each its whole chain');
  assert.equal(r.made.filter((m) => m.model).length, GRAHT_VARIANTS, 'a caster a variant');
  const castMesh = r.made.find((m) => m.model).model, lod1 = grahtOakMesh(0, 1);
  assert.equal(castMesh.positions.length / 3, lod1.subs[0][1] + lod1.subs[1][1], 'the caster its LOD 1\'s bark and leaves - no card');
  const p = { grahtOaks: kept.set, _t: [10, 0, -20] };
  host.frame([p], [110, 2, 60], null);
  const f = r.slots[GRAHT_SLOT];
  assert.equal(GRAHT_SLOT, 2);
  assert.ok(f && f.gpu === host._gpu && f.radius > 1e8, 'the third slot, every tree whole (no far picture to hand over to)');
  // the runs: each tree in its variant's run at its LOD, its instance [x, y, z, yaw, scale] at its translation
  const runOf = (v, l) => host._runs[v * GRAHT_LODS + l];
  assert.deepEqual(f.runs.map((x) => host._runs.indexOf(x)), [0 * 3 + 0, 1 * 3 + 1, 2 * 3 + 1], 'the near tree at LOD 0; 396 m off at 0.9 its scale, LOD 1 (440 over its scale); the far one LOD 1');
  assert.equal(runOf(2, 1).drawCount, 1);
  // the instances as uploaded: a run's own, [x, y, z, yaw, scale] at the pixel's translation
  const up = r.calls.filter((c) => c[0] === 'bufferSubData').at(-1)[3];
  const inst = (run) => Array.from(up.subarray(run.drawStart * 5, run.drawStart * 5 + 5));
  const want = (k) => { const t = kept.set.trees; return [t[k] + 10, t[k + 1], t[k + 2] - 20, t[k + 3], t[k + 4]].map((x) => Math.fround(x)); };
  assert.deepEqual(inst(runOf(0, 0)), want(6)); assert.deepEqual(inst(runOf(1, 1)), want(12)); assert.deepEqual(inst(runOf(2, 1)), want(0));
  assert.equal(f.sunLift, GRAHT_DRAW.sunLift);
  assert.deepEqual(runOf(0, 0).subs.map((sb) => [sb.alpha, sb.cull]), [[0, 2], [0, 2], [1, 0]], 'the bark and leaves opaque and culled, the cards cut and two-sided');
  const sizes = runOf(1, 2).subs.map((sb) => sb.count);
  assert.deepEqual(sizes, grahtOakMesh(1, 2).subs.filter(([, n]) => n).map(([, n]) => n), 'LOD 2 its bark and leaves - no empty draw');
  assert.deepEqual(host.stats, { trees: 3, drawn: 3, lod: [1, 2, 0], casters: 2, sets: 1 }, 'the far one past the casters\' reach');
  // the casters nearest first, each its variant's mesh at its root, turn and scale as BB_VS turns the tree
  const [c0] = r.cast;
  assert.equal(c0[0].model.positions.length, r.made.filter((m) => m.model)[0].model.positions.length);
  const M = c0[1], tree = kept.set.trees.subarray(6, 12), pt = [3, 7, -2], w = turn(pt, tree[3], tree[4]);
  const mp = [M[0] * pt[0] + M[4] * pt[1] + M[8] * pt[2] + M[12], M[1] * pt[0] + M[5] * pt[1] + M[9] * pt[2] + M[13], M[2] * pt[0] + M[6] * pt[1] + M[10] * pt[2] + M[14]];
  for (let q = 0; q < 3; q++) assert.ok(Math.abs(mp[q] - (w[q] + [tree[0] + 10, tree[1], tree[2] - 20][q])) < 1e-3, 'the caster where the tree is drawn');
  // culled: by the view (a plane behind every tree), the fog's reach, the haze; the travel view's well
  r.cast.length = 0;
  host.frame([p], [110, 2, 60], new Float32Array([0, 0, 1, -5000, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6]));
  assert.equal(host.stats.drawn, 0, 'the view culls');
  assert.equal(r.slots[GRAHT_SLOT], null, 'nothing to draw: the slot empty');
  assert.equal(r.cast.length, 2, 'and still they cast');
  r._fogMode = 1; r._fogRange = [0, 400];
  host.frame([p], [110, 2, 60], null);
  assert.equal(host.stats.drawn, 2, 'the fog\'s reach culls the far one');
  r._fogMode = 0;
  hidden = (box) => box[0] > 200;
  host.frame([p], [110, 2, 60], null);
  assert.equal(host.stats.drawn, 1, 'the haze hides what it hides whole');
  hidden = null;
  r._focus = new Float32Array([110, 5, 100, 1]);
  host.frame([p], [110, 400, -150], null);
  assert.equal(host.stats.drawn, 2, 'the travel view\'s well: the crown between the eye and the traveller undrawn');
  r._focus = null;
  // nothing standing: the slot emptied once
  host.frame([], [0, 0, 0], null);
  assert.equal(r.slots[GRAHT_SLOT], null);
  // the casters: the nearest GRAHT_DRAW.casters of many, nearest first
  const many = [];
  for (let k = 0; k < 40; k++) many.push(100 + (k % 8) * 30, 5, 100 + Math.floor(k / 8) * 30, 0, 1, k % 3);
  r.cast.length = 0;
  host.frame([{ grahtOaks: { trees: Float32Array.from(many) }, _t: [0, 0, 0] }], [100, 2, 100], null);
  assert.equal(r.cast.length, GRAHT_DRAW.casters);
  const dist = r.cast.map(([, M]) => Math.hypot(M[12] - 100, M[14] - 100));
  assert.deepEqual(dist, [...dist].sort((a, b) => a - b), 'nearest first');
  const all = []; for (let k = 0; k < 40; k++) all.push(Math.hypot(many[k * 6] - 100, many[k * 6 + 2] - 100));
  assert.ok(Math.abs(dist.at(-1) - all.sort((a, b) => a - b)[GRAHT_DRAW.casters - 1]) < 1e-3, 'the nearest of them all');
  host.destroy();
  assert.equal(r.freed.length, 3 + GRAHT_VARIANTS, 'the three pictures and the casters given back');
  assert.equal(host._gpu, null);
  // torn down while it is made: nothing made after
  const r2 = fakeRenderer(), h2 = createGrahtHost({ renderer: r2 });
  h2.stand(1, 1, raw);
  h2.destroy();
  await h2.prepare();
  await new Promise((go) => setTimeout(go, 0));
  assert.equal(r2.made.length, 0, 'a host torn down while its GPU was made makes none');
});

test('GRAHT1: the travel view\'s well and the fog\'s reach, exactly', () => {
  const m = { crownFrom: 80, height: 170, crownR: 80 };
  assert.ok(crownBlocks([0, 300, -300], [0, 0, 0], 0, 0, -100, m, 1), 'the crown a third of the way back stands in the line');
  assert.ok(!crownBlocks([0, 300, -300], [0, 0, 0], 200, 0, -100, m, 1), 'one beside it does not');
  assert.ok(!crownBlocks([0, 300, -300], [0, 0, 0], 0, 0, -290, m, 1), 'nor one past the line\'s crossing of the crowns');
  assert.ok(!crownBlocks([0, 60, -10], [0, 0, 0], 0, 0, -5, m, 1), 'an eye under the crowns looks under them');
  assert.ok(crownBlocks([0, 300, -300], [0, 0, 0], 0, 0, -100 + 80 * GRAHT_DRAW.well - 2, m, 1) && !crownBlocks([0, 300, -300], [0, 0, 0], 0, 0, -100 + 80 * GRAHT_DRAW.well + 22, m, 1), 'its reach the crown\'s, by the well\'s share');
  assert.equal(fogReach({ _fogMode: 1, _fogRange: [10, 2400] }), 2400);
  assert.ok(Math.abs(fogReach({ _fogMode: 2, _fogDensity: 0.002 }) - Math.log(256) / 0.002) < 1e-9);
  assert.ok(Math.abs(fogReach({ _fogMode: 3, _fogDensity: 0.002 }) - Math.sqrt(Math.log(256)) / 0.002) < 1e-9);
  assert.equal(fogReach({ _fogMode: 0 }), Infinity);
});

test('GRAHT1: the GPU - every variant at every LOD in Low Poly Trees\' own buffers, a mesh its own vertices from 0, its submeshes where they lie', () => {
  const { index, bin, made } = packGrahtMeshes();
  assert.equal(index.meshes.length, GRAHT_VARIANTS * GRAHT_LODS);
  let at = 0;
  index.meshes.forEach((m, k) => {
    assert.equal(m.vertex, at); assert.equal(m.index, at); assert.equal(m.vertices, made[k].positions.length / 3);
    assert.deepEqual(m.subs, made[k].subs);
    at += m.vertices;
  });
  assert.equal(index.vertexBytes, at * 32);
  assert.equal(bin.byteLength, at * 32 + at * 2);
  const gpu = new LowPolyTreesGpu(fakeRenderer().gl, index, bin);
  assert.deepEqual(gpu.subs[4], made[4].subs.map(([f, n]) => [(index.meshes[4].index + f) * 4, n]), 'a submesh\'s bytes in the one index buffer');
  const f32 = new Float32Array(bin.buffer, 0, at * 8), m1 = made[1];
  for (const i of [0, 7, 99]) {
    const o = (index.meshes[1].vertex + i) * 8;
    assert.deepEqual([f32[o], f32[o + 3], f32[o + 6]], [m1.positions[i * 3], m1.normals[i * 3], m1.uvs[i * 2]], 'position, normal, uv - the layout BB_VS reads');
  }
});

test('GRAHT1: the wiring - the jungle host builds it on the canopy\'s zones (?graht=off offline its kill door) and hands the job the canopy\'s field; the trees\' host frames it before its own return; the pixel build stands it and files its bodies; the kernel hands the canopy in and the trees out; the ceiling of leaves retired', () => {
  assert.equal(grahtOaksOn(''), true);
  assert.equal(grahtOaksOn('?graht=off'), false);
  assert.equal(grahtOaksOn('?graht=off&online'), true, 'online the graht-oaks stand for everyone');
  const zone = (x, y) => (x >= 20 && x < 60 && y >= 20 && y < 60 ? { jungle: true, canopy: true } : x >= 60 && x < 90 && y >= 20 && y < 60 ? { jungle: true } : null);
  const mk = (zoneAt) => createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze() {} }, maps: {}, insideAt: () => false, mapWidth: 4, mapHeight: 4,
    stateOf: () => ({ mapOrigin: { x: 0, y: 0 }, compensation: [0, 0, 0], pixelTranslation: (px, py, o = [0, 0, 0]) => { o[0] = px * PIXEL_M; o[1] = 0; o[2] = -py * PIXEL_M; return o; } }),
    builtOf: () => new Map(), heightAt: () => 0, trees: { door: true }, zoneAt });
  const h = mk(zone);
  assert.ok(h.graht, 'the canopy\'s zones: the graht-oaks\' host');
  assert.equal(h.job(40, 40).canopy.length, 9, 'the job carries the canopy\'s 3x3');
  assert.ok(h.job(40, 40).canopy.every((d) => d > 0));
  assert.equal(h.job(85, 40).canopy, null, 'past the canopy field\'s reach none');
  assert.equal(mk((x, y) => (zone(x, y) ? { jungle: true } : null)).job(40, 40).canopy, null, 'a jungle with no canopy: no graht-oak stands');
  const trees = read('src/scenes/treesHost.js');
  // PIN MOVED (TESA-LANDS): the lands' landmarks framed beside them, before the same return (scenes/landPropsHost.js)
  assert.match(trees, /frame\(pixels, eye, planes\) \{\n\s+jungle\?\.graht\?\.frame\(pixels, eye, planes\);[^\n]*\n\s+landProps\?\.frame\(pixels, eye, planes\);[^\n]*\n\s+if \(!lowPolyTrees && !jungleDoor\) return;/);
  const pb = read('src/scenes/pixelBuild.js');
  assert.match(pb, /wodAverages, graht, beach, roadside, townGround, arenaRoads, bridges, meets \} = await terrainGen\.generate\(/);   // PIN MOVED (FB1029 ACROSS-EDGE): the pixel's town meets answered last. PIN MOVED (ROAD-LOOK): the pixel's bridges answered beside its roads
  assert.match(pb, /const grahtStood = jungle\?\.graht\?\.stand\(px, py, graht, \(x, z\) => !pointNearGate\(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M\) && !insideRocks\(pixelRocks, x, z\)\) \?\? null;\n\s+if \(grahtStood\) coverItems\.push\(\.\.\.grahtStood\.bodies\);/);
  assert.ok(pb.indexOf('if (grahtStood) coverItems.push(...grahtStood.bodies);') < pb.indexOf('collider.cover.add(key, coverItems.slice(i, i + COVER_SLICE), coverT);'), 'filed with the pixel\'s cover');
  assert.match(pb, /\n\s+grahtOaks: grahtStood\?\.set \?\? null,   \/\/ GRAHT1: its graht-oaks/, 'the built entry carries them');   // PIN MOVED (TESA-LANDS' merge): the seat's call carries the same words now, so the entry's own line
  const tg = read('src/world/terrain/terrainGen.js');
  assert.match(tg, /const \{ flats: nature, pairs: roadside, graht \} = jungleLayout\(/);
  assert.match(tg, /net: roads, canopy: jungle\.canopy \?\? null \} : null \}\);/);
  assert.match(tg, /\n\s+graht,   \/\/ GRAHT1/);
  const jh = read('src/scenes/jungleHost.js');
  assert.match(jh, /const graht = canopyAt && grahtOaksOn\(\) \? createGrahtHost\(\{ renderer, hides: hidesBox, breathe \}\) : null;/);
  assert.ok(!existsSync(new URL('../../src/render/canopySky.js', import.meta.url)), 'the ceiling of leaves retired');
});

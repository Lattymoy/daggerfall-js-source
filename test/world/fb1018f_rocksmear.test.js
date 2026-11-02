// ROCK-SMEAR (FIELD BUGS 2026-10-18f, thread T6 "Collection: Broken world objects", æther: "Rock missing textures and
// clipping with the pole. In Ipsmoth." - a grey stone rock by a stream at dusk, its texture a flat grey smear).
//
// Ipsmoth is Beautiful Villages' (location-36-183: GENRAS03, CLOTAS01, RESIAS06, FARMAA03), and its blocks stand
// sixteen of the RMB Resource Pack's rocks (53029-53039), nine of them on water tiles - six in the stream down its west
// side, two more where it runs on through RESIAS06, one in RESIAS06's pond.
// The port draws no pack mesh; each rock is the port's own stand-in, a boulder over the pack mesh's box at its prefab's
// scale (world/townStandIns.js rockMesh / boulderMesh), dressed in the climate's rock (302_3). The boulder was drawn
// INSIDE OUT: 40 of its 48 faces (its sides and its underside) took a normal looking into the rock, and MeshBuilder winds
// a face to look along its normal, so under the world's back-face culling the near side of every rock was culled and
// the inside of its far side drawn - a hollow grey shell, an "arch", and a pole standing in it seen through it. And its
// picture was laid by one plan for every face - (x, -y), the side view along z: the underside took one row of the texture
// smeared across it, and every side that faces x took the picture squeezed to a sliver - every one of the 23 rocks had a
// face with no change of texture along it at all, and 25 to 75 per cent of each rock's surface stretched past four to
// one. Now every face looks out of the boulder, and takes the plan of the axis it faces most (box mapping): no face
// stretched past 1 : 1/sqrt(3), the picture's rows level on every side. Found beside it, the same law broken in the
// pack's dock pieces: prismZ took its corners as counter-clockwise on trust and both callers hand it a clockwise list,
// so the ramp's (53143) deck and the steps' (53144) stringers looked into their prisms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { rockMesh, boulderMesh, prismZ, RMBRP_ROCKS, RMBRP_ROCK_SCALE, RMBRP_PIECES } from '../../src/world/townStandIns.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';

/** Per triangle: the texture map's two singular values (repeats per metre along the face's most and least stretched
 *  directions), its area, and how the texture's v runs with height along the face (dv per metre up). */
function uvStretch(mesh) {
  const p = mesh.positions, uv = mesh.uvs, ix = mesh.indices, out = [];
  for (let t = 0; t + 2 < ix.length; t += 3) {
    const P = (i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], U = (i) => [uv[i * 2], uv[i * 2 + 1]];
    const [a, b, c] = [P(ix[t]), P(ix[t + 1]), P(ix[t + 2])], [ua, ub, uc] = [U(ix[t]), U(ix[t + 1]), U(ix[t + 2])];
    const e1 = b.map((v, k) => v - a[k]), e2 = c.map((v, k) => v - a[k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const area = Math.hypot(...n) / 2, l1 = Math.hypot(...e1);
    if (area < 1e-9 || l1 < 1e-9) continue;
    const t1 = e1.map((v) => v / l1), nn = n.map((v) => v / (2 * area));
    const t2 = [nn[1] * t1[2] - nn[2] * t1[1], nn[2] * t1[0] - nn[0] * t1[2], nn[0] * t1[1] - nn[1] * t1[0]];
    const x2 = e2[0] * t1[0] + e2[1] * t1[1] + e2[2] * t1[2], y2 = e2[0] * t2[0] + e2[1] * t2[1] + e2[2] * t2[2];
    const d1 = [ub[0] - ua[0], ub[1] - ua[1]], d2 = [uc[0] - ua[0], uc[1] - ua[1]];
    // J (face metres -> uv): the columns its derivative along t1 and along t2
    const j00 = d1[0] / l1, j10 = d1[1] / l1, j01 = (d2[0] - j00 * x2) / y2, j11 = (d2[1] - j10 * x2) / y2;
    const A = j00 * j00 + j10 * j10, B = j00 * j01 + j10 * j11, C = j01 * j01 + j11 * j11;
    const half = (A + C) / 2, disc = Math.sqrt(Math.max(0, half * half - (A * C - B * B)));
    // dv along the face's steepest climb (its up direction in the plane), per metre of height
    const up = [-nn[0] * nn[1], 1 - nn[1] * nn[1], -nn[2] * nn[1]], ul = Math.hypot(...up);
    let dvUp = null;
    if (ul > 0.2) {
      const u = up.map((v) => v / ul), s = u[0] * t1[0] + u[1] * t1[1] + u[2] * t1[2], r = u[0] * t2[0] + u[1] * t2[1] + u[2] * t2[2];
      dvUp = (j10 * s + j11 * r) / u[1];
    }
    out.push({ sMax: Math.sqrt(half + disc), sMin: Math.sqrt(Math.max(0, half - disc)), area, ny: nn[1], dvUp });
  }
  return out;
}

/** Per closed part of a mesh (its triangles joined by shared corners): how many of its faces are wound - and lit - to
 *  look out of it, against its corners' centre, and how many into it. A part here is convex (a boulder, a box, a pile,
 *  a prism), so a face looking out is wound away from that centre. */
function partsFacing(mesh) {
  const p = mesh.positions, n = mesh.normals, ix = mesh.indices, key = (i) => `${p[i * 3].toFixed(4)},${p[i * 3 + 1].toFixed(4)},${p[i * 3 + 2].toFixed(4)}`;
  const parent = new Map(), find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (let i = 0; i < p.length / 3; i++) if (!parent.has(key(i))) parent.set(key(i), key(i));
  for (let t = 0; t < ix.length; t += 3) { const r = find(key(ix[t])); for (const i of [ix[t + 1], ix[t + 2]]) parent.set(find(key(i)), r); }
  const centre = new Map();
  for (let i = 0; i < p.length / 3; i++) { const r = find(key(i)), c = centre.get(r) ?? [0, 0, 0, 0]; c[0] += p[i * 3]; c[1] += p[i * 3 + 1]; c[2] += p[i * 3 + 2]; c[3]++; centre.set(r, c); }
  let out = 0, into = 0, litIn = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]], q = centre.get(find(key(a)));
    const e1 = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]), e2 = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
    const w = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const g = [0, 1, 2].map((k) => (p[a * 3 + k] + p[b * 3 + k] + p[c * 3 + k]) / 3 - q[k] / q[3]);
    if (w[0] * g[0] + w[1] * g[1] + w[2] * g[2] > 0) out++; else into++;
    if (n[a * 3] * g[0] + n[a * 3 + 1] * g[1] + n[a * 3 + 2] * g[2] <= 0) litIn++;
  }
  return { out, into, litIn };
}

test('ROCK-SMEAR: every rock stand-in, and the pack\'s docks, ramp and steps beside them, are drawn outside in - each face wound and lit to look out of its part, none into it (the culling draws a face from the side it looks to)', () => {
  // the docks' decks and piles are boxes and cylinders, each face given its outward normal; 53142's three decks abut,
  // which joins them here into one T whose inner walls read as looking in - so the prisms' two pieces stand for them
  const ids = [...Object.keys(RMBRP_ROCKS), '53140', '53141', '53143', '53144'];
  assert.equal(ids.length, 27, 'the 23 rocks, two docks, the ramp and the steps');
  for (const id of ids) {
    const { out, into, litIn } = partsFacing(RMBRP_PIECES[id]());
    assert.ok(out > 0, `${id}: faces`);
    assert.deepEqual([into, litIn], [0, 0], `${id}: ${into} of ${out + into} faces wound into the piece, ${litIn} lit from inside`);
  }
});

// AUDIT FB1018f L4-6 (bible/01-Overview/audits/Audit-Field-Bugs-2026-10-18f.md): the pack's rocks stand near their
// origins and their prisms wind one way, so the law's two terms were not read - a face's centre against the boulder's
// own axis (round (cx, cz)), and the corners' signed area whichever way they run
test('ROCK-SMEAR THE LAW, NOT THE PACK\'S CASE (AUDIT FB1018f L4-6): a boulder whose box stands off its origin by more than its width still faces out - its faces are read against its own axis - and a prism faces out whichever way its corners run, in any quadrant', () => {
  const far = partsFacing(boulderMesh(2, 1, 0.5, 2, 7, 6, -5));
  assert.deepEqual([far.into, far.litIn], [0, 0], `a boulder round (6, -5): ${far.into} faces wound in, ${far.litIn} lit from inside`);
  const sq = [[1, 1], [3, 1], [3, 2], [1, 2]];
  for (const pts of [sq, [...sq].reverse(), sq.map(([x, y]) => [x, -y]), sq.map(([x, y]) => [x, -y]).reverse(), sq.map(([x, y]) => [-x, -y]).reverse()]) {
    const m = new MeshBuilder();
    prismZ(m, [0, 0], pts, 0, 1);
    const f = partsFacing(m.build());
    assert.deepEqual([f.into, f.litIn], [0, 0], `the prism on ${JSON.stringify(pts)}`);
  }
});

test('ROCK-SMEAR: every RMB Resource Pack rock stand-in takes its picture with no smear - on every face the texture changes along both of its directions, at no more than the box mapping\'s 1 : 1/sqrt(3)', () => {
  const ids = Object.keys(RMBRP_ROCKS);
  assert.equal(ids.length, 23);
  for (const id of ids) {
    const faces = uvStretch(rockMesh(id));
    assert.equal(faces.length, 48, `${id}: a boulder's faces - eight sides of two bands, a crown and an underside`);
    for (const f of faces) {
      assert.ok(f.sMin >= 1 / Math.sqrt(3) - 1e-6, `${id}: a face smeared (${f.sMin.toFixed(4)} : ${f.sMax.toFixed(4)} repeats a metre)`);
      assert.ok(f.sMax <= 1 + 1e-6, `${id}: a face's picture finer than a repeat a metre (${f.sMax.toFixed(4)})`);
    }
  }
});

test('ROCK-SMEAR: the underside and the crown are mapped from above, and every side keeps the picture\'s rows level - its v falls a repeat a metre up the rock, as it did', () => {
  for (const id of Object.keys(RMBRP_ROCKS)) {
    for (const f of uvStretch(rockMesh(id))) {
      if (Math.abs(f.ny) > Math.SQRT1_2 + 0.05) { assert.ok(f.sMin > 0.7, `${id}: a face that looks up or down, mapped from above (${f.sMin.toFixed(3)})`); continue; }
      if (Math.abs(f.ny) < 0.5 && f.dvUp !== null) assert.ok(Math.abs(f.dvUp + 1) < 1e-6, `${id}: a side's rows not level (dv ${f.dvUp.toFixed(4)} a metre up)`);
    }
  }
  // the underside in particular: a fan at one height, the face the old plan smeared to a single row
  const flat = uvStretch(boulderMesh(4, 1, 0.5, 3, 7)).filter((f) => f.ny < -0.99);
  assert.ok(flat.length >= 8, 'the boulder\'s underside');
  for (const f of flat) assert.ok(Math.abs(f.sMin - 1) < 1e-6 && Math.abs(f.sMax - 1) < 1e-6, `the underside, a repeat a metre each way (${f.sMin.toFixed(4)}, ${f.sMax.toFixed(4)})`);
});

test('ROCK-SMEAR: the report - Ipsmoth\'s four blocks stand the pack\'s rocks, nine of them on its water\'s tiles, every one a stand-in this law dresses', () => {
  const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL('../../vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', import.meta.url))).toString('utf8'));
  const loc = JSON.parse(pack.files['location-36-183.json']);
  assert.equal(loc[1][3], 'Ipsmoth');
  const names = loc[2].find((o) => o[0] === 's' && o[1].join('.') === 'Exterior.ExteriorData.BlockNames')[2];
  assert.deepEqual(names, ['GENRAS03.RMB', 'CLOTAS01.RMB', 'RESIAS06.RMB', 'FARMAA03.RMB']);
  const WATER = new Set([0, 5, 6, 7, 48, 20, 21, 22, 49, 30, 31, 32, 50, 8, 23, 33, 34, 35, 36]);   // world/water/waterCorners.js's records
  let rocks = 0, wet = 0;
  for (const name of names) {
    const [, , ops] = JSON.parse(pack.files[`${name}.json`]);
    const get = (path) => ops.find((o) => o[0] === 's' && o[1].join('.') === path)?.[2];
    const tiles = get('RmbBlock.FldHeader.GroundData.GroundTiles')?.$t;
    for (const m of get('RmbBlock.Misc3dObjectRecords')?.$m ?? []) {
      if (!RMBRP_ROCKS[m[0]]) continue;
      rocks++;
      assert.ok(RMBRP_ROCK_SCALE[m[0]] >= 2, `${m[0]}: stood at its prefab's scale`);
      const col = Math.floor(m[2] / 256), row = 15 - Math.floor((m[4] + 4096) / 256);
      if (tiles && WATER.has(tiles[row * 16 + col][1] & 0x3f)) wet++;
    }
  }
  assert.deepEqual([rocks, wet], [16, 9]);
});

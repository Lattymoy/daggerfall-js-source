// TESA-LORE (2026-10-24, the owner: "polishing and refining each capital city design and bringing them more in line with
// lore and the mainline games"; bible/03-World/Arena-Provinces.md TESA-LORE) - THE CAPITALS, REFINED TOWARD THE LORE, pinned:
// each refinement against the reading it came from (UESP's), the place it stands, its ground and its walkers' way.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPERIAL, IMPERIAL_SECTORS, IMPERIAL_SLICE_NAMES, IMPERIAL_MODELS, IMPERIAL_CARRY, IMPERIAL_CITY_PLAN, IMPERIAL_BLOCKS, polar, imperialBearing,
  imperialDistrictAt, imperialTile, imperialClosed, imperialTree, prisonAt, watchTowersAt, divinesAt, divinePlinths,
} from '../src/world/imperialCity.js';
import { CAPITALS, CAPITAL_MODELS, BLOCK_M, capitalModelCarriers } from '../src/world/tamrielCapitals.js';
import { buildCityWall, buildNineDivines } from '../src/world/capitalImperial.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART, installCapitals, _resetCapitals } from '../src/world/capitalModels.js';
import { customModelFor } from '../src/world/customModels.js';

const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite));
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  assert.ok(m.subMeshes.every((s) => s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)));
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
};
/** Does the segment p-q cross any face of the model (Moller-Trumbore)? */
const crosses = (m, p, q) => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    const V = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [V(0), V(1), V(2)], e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const sv = p.map((v, i) => v - a[i]), u = (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const k = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (k >= 0 && k <= 1) return true;
  }
  return false;
};
const P3 = (b, r, y) => { const [x, z] = polar(b, r); return [x, y, z]; };
const capOf = (key) => CAPITALS.find((c) => c.key === key);

// ── THE IMPERIAL CITY ───────────────────────────────────────────

const IC = capOf('imperial-city'), B = BLOCK_M;
/** The slice (0-8, from the north-west) and the plan's cell a point of the city stands in. */
const sliceAt = (x, z) => Math.floor((z + 12 * B) / (8 * B)) * 3 + Math.floor((x + 12 * B) / (8 * B));
const cellAt = (x, z) => IMPERIAL_CITY_PLAN[Math.floor(z / B + 12)][Math.floor(x / B + 12)];

test('TESA-LORE the Imperial City\'s Prison on the isle\'s north-eastern shore (UESP: "northeast of the main city walls") - its compound in the north-east pixel, named for it and carrying it; the city wall\'s gate to it open, its causeway stone', () => {
  const [px, pz] = prisonAt();
  assert.ok(Math.abs(imperialBearing(px, pz) - 45) < 1e-9, 'north-east');
  assert.equal(imperialDistrictAt(px, pz), 'Prison District');
  assert.equal(sliceAt(px, pz), 2, 'the north-east pixel');
  assert.equal(IMPERIAL_SLICE_NAMES[2], 'Prison District');
  assert.equal(IMPERIAL_CARRY[IMPERIAL_MODELS.prison], 2);
  const carrier = capitalModelCarriers(IC).get(IMPERIAL_MODELS.prison);
  const at = IMPERIAL_CITY_PLAN.flatMap((row, r) => row.map((cell, c) => [cell, c, r])).find(([cell]) => cell === carrier);
  assert.ok(at && Object.hasOwn(IMPERIAL_BLOCKS, carrier) && Math.floor(at[2] / 8) * 3 + Math.floor(at[1] / 8) === 2, `carried in its pixel: ${carrier}`);
  const W = IMPERIAL.cityWall;
  assert.ok(W.gates.includes(IMPERIAL.prison.b), 'a gate on its bearing');
  assert.equal(crosses(buildCityWall(), P3(IMPERIAL.prison.b, W.r - 10, W.gateH / 2), P3(IMPERIAL.prison.b, W.r + 10, W.gateH / 2)), false, 'open');
  for (const r of [930, 980]) assert.equal(imperialTile(...polar(IMPERIAL.prison.b, r)), 3, `its causeway at ${r}`);
});

test('TESA-LORE the Imperial City\'s watch towers: one where each district wall meets the city wall (the North, North-East, South-East, South, South-West and North-West Watch Towers between the districts they border), standing over the wall\'s other towers; their ground the city\'s own', () => {
  const W = IMPERIAL.cityWall, wall = buildCityWall();
  sane(wall);
  assert.deepEqual(watchTowersAt(), IMPERIAL_SECTORS.map(([, b]) => polar(b, W.r)));
  assert.ok(W.watchR > W.towerR && W.watchH > W.towerH + W.towerR * 1.4);
  const over = W.towerH + W.towerR * 1.4 + 4;   // past the ten-degree towers' cones
  for (const [, b] of IMPERIAL_SECTORS) {
    assert.equal(crosses(wall, P3(b, W.r - W.watchR - 2, over), P3(b, W.r + W.watchR + 2, over)), true, `the watch tower at ${b}`);
    assert.equal(crosses(wall, P3(b + 10, W.r - W.watchR - 2, over), P3(b + 10, W.r + W.watchR + 2, over)), false, `none at ${b + 10}`);
    const [x, z] = polar(b, W.r);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(Object.hasOwn(IMPERIAL_BLOCKS, cellAt(x + dx * (W.watchR + 1), z + dz * (W.watchR + 1))), `its foot on the city's own at ${b}`);
  }
});

test('TESA-LORE the Arboretum\'s Nine Divines (UESP: "statues of the Nine Divines including a statue of Talos in the center"): eight on their plinths in a ring, Talos at the middle the tallest with his sword raised; a paved court of the city\'s own, its plinths closed, its way between them open, no tree on it; the model installed and carried in its pixel', () => {
  const D = IMPERIAL.divines, [cx, cz] = divinesAt(), m = buildNineDivines();
  sane(m);
  assert.equal(imperialDistrictAt(cx, cz), 'Arboretum');
  assert.equal(D.b, 150, 'the sector\'s middle bearing');
  const plinths = divinePlinths();
  assert.equal(plinths.length, 8);
  for (const [x, z] of plinths) {
    assert.ok(Math.abs(Math.hypot(x - cx, z - cz) - D.ring) < 1e-9);
    assert.equal(imperialClosed(x, z), true, 'a plinth');
    assert.equal(crosses(m, [x, D.plinthH + D.figure * 0.5, z - 3], [x, D.plinthH + D.figure * 0.5, z + 3]), true, 'its figure on it');
  }
  assert.equal(imperialClosed(cx, cz), true, 'Talos\'s plinth');
  const between = [(plinths[0][0] + plinths[1][0]) / 2, (plinths[0][1] + plinths[1][1]) / 2];
  assert.equal(imperialClosed(...between), false, 'the way between');
  let top = 1;
  for (let i = 1; i < m.positions.length; i += 3) if (m.positions[i] > m.positions[top]) top = i;
  assert.ok(m.positions[top] > D.talosPlinthH + D.talos + 3 && Math.hypot(m.positions[top - 1] - cx, m.positions[top + 1] - cz) < D.talosPlinth, 'Talos\'s blade the top, over the middle');
  for (const [x, z] of plinths) assert.ok(!crosses(m, [x, D.plinthH + D.figure + 1.5, z - 4], [x, D.plinthH + D.figure + 1.5, z + 4]), 'the eight below him');
  assert.equal(imperialTile(cx, cz), 3, 'the court paved');
  assert.equal(imperialTile(...polar(D.b, D.r + D.court + 12)), 2, 'the park round it');
  for (let x = cx - D.court + 2; x < cx + D.court - 2; x += 3.2) for (let z = cz - D.court + 2; z < cz + D.court - 2; z += 3.2) if (Math.hypot(x - cx, z - cz) < D.court - 2) assert.equal(imperialTree(x, z), -1);
  for (const [dx, dz] of [[0, 0], [D.court - 4, 0], [0, D.court - 4], [-(D.court - 4), 0], [0, -(D.court - 4)]]) assert.ok(Object.hasOwn(IMPERIAL_BLOCKS, cellAt(cx + dx, cz + dz)), 'the court the city\'s own');
  assert.ok(IC.models.includes(IMPERIAL_MODELS.nineDivines) && CAPITAL_MODELS.nineDivines === IMPERIAL_MODELS.nineDivines);
  assert.equal(IMPERIAL_CARRY[IMPERIAL_MODELS.nineDivines], sliceAt(cx, cz), 'carried in its pixel');
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const got = customModelFor(IMPERIAL_MODELS.nineDivines);
  assert.ok(got?.positions?.length > 0);
  sane(got);
});

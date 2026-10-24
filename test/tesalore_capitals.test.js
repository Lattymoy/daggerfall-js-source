// TESA-LORE (2026-10-24, the owner: "polishing and refining each capital city design and bringing them more in line with
// lore and the mainline games"; bible/03-World/Arena-Provinces.md TESA-LORE) - THE CAPITALS, REFINED TOWARD THE LORE, pinned:
// each refinement against the reading it came from (UESP's), the place it stands, its ground and its walkers' way.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPERIAL, IMPERIAL_SECTORS, IMPERIAL_SLICE_NAMES, IMPERIAL_MODELS, IMPERIAL_CARRY, IMPERIAL_CITY_PLAN, IMPERIAL_BLOCKS, polar, imperialBearing,
  imperialDistrictAt, imperialTile, imperialClosed, imperialTree, prisonAt, watchTowersAt, divinesAt, divinePlinths,
} from '../src/world/imperialCity.js';
import { CAPITALS, CAPITAL_MODELS, BLOCK_M, capitalModelCarriers, capitalDistrict, SOLITUDE, SOLITUDE_PLAN, SOLITUDE_BLOCKS } from '../src/world/tamrielCapitals.js';
import { buildCityWall, buildNineDivines } from '../src/world/capitalImperial.js';
import { buildCastleDour, buildBluePalace } from '../src/world/capitalSolitude.js';
import { MOURNHOLD, MOURNHOLD_PLAN, MOURNHOLD_DISTRICTS, MOURNHOLD_BLOCKS } from '../src/world/capitalPlans.js';
import { buildMournholdPlaza, buildHighFane, buildMournholdPalace, buildGreatBazaar } from '../src/world/capitalMournhold.js';
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

// ── SOLITUDE ────────────────────────────────────────────────────

test('TESA-LORE Solitude\'s Castle Dour "just within the city\'s main gate" (UESP): its square on the city\'s own blocks by the south gate\'s lane, its two gateways (UESP: "Castle Dour has two gateways") - west to that lane, north to the city and the Temple of the Divines on its grounds - open, walled between; its keep\'s corner turrets under the Emperor\'s Tower', () => {
  const sol = capOf('solitude'), S = SOLITUDE, C = S.castle, W = S.wall, cd = buildCastleDour();
  sane(cd);
  const near = Math.hypot(Math.max(C.x - C.half - W.southGate, 0, W.southGate - C.x - C.half), Math.max(C.z - C.half - W.south, 0, W.south - C.z - C.half));
  assert.ok(near < 45, `the main gate ${near.toFixed(1)} m from the curtain`);
  const cellOf = (x, z) => [Math.floor(x / BLOCK_M + sol.anchor[0]), Math.floor(z / BLOCK_M + sol.anchor[1])];
  for (const [x, z] of [[C.x - C.half, C.z - C.half], [C.x + C.half, C.z + C.half], [C.x - C.half, C.z + C.half], [C.x + C.half, C.z - C.half]]) {
    const [cx, cy] = cellOf(x, z);
    assert.ok(Object.hasOwn(SOLITUDE_BLOCKS, SOLITUDE_PLAN[cy][cx]), `the curtain's corner on the city's own at ${cx},${cy}`);
    assert.equal(capitalDistrict(sol, cx, cy), 'Castle Dour District');
  }
  const g = C.gateH / 2;
  assert.equal(crosses(cd, [C.x - C.half - 5, g, C.z], [C.x - C.half + 5, g, C.z]), false, 'the west gate');
  assert.equal(crosses(cd, [C.x, g, C.z - C.half - 5], [C.x, g, C.z - C.half + 5]), false, 'the north gate');
  assert.equal(crosses(cd, [C.x + 30, g, C.z - C.half - 5], [C.x + 30, g, C.z - C.half + 5]), true, 'walled beside it');
  assert.equal(crosses(cd, [C.x + C.half - 5, g, C.z], [C.x + C.half + 5, g, C.z]), true, 'no gate east');
  const shut = SOLITUDE_BLOCKS.D0.closed;
  assert.deepEqual([shut(C.x - C.half, C.z), shut(C.x, C.z - C.half), shut(C.x + 30, C.z - C.half)], [false, false, true], 'the walkers\' gates the model\'s');
  const [tx, ty] = cellOf(C.x + 30, C.z - C.half - 30);
  assert.equal(SOLITUDE_PLAN[ty][tx], 'TEMP', 'the Temple of the Divines before the north gate');
  assert.equal(capitalDistrict(sol, tx, ty), 'Castle Dour District', 'on its grounds');
  const K = S.keep, E = S.emperorsTower;
  for (const sx of [1, -1]) for (const sz of [1, -1]) assert.equal(crosses(cd, [C.x + K.dx + sx * (K.w / 2 + 4), K.h + 3, C.z + K.dz + sz * K.d / 2], [C.x + K.dx + sx * (K.w / 2 - 4), K.h + 3, C.z + K.dz + sz * K.d / 2]), true, `a turret at ${sx},${sz}`);
  assert.ok(E.h > K.h + 6 + 1.4 + 5, 'the Emperor\'s Tower over them');
});

test('TESA-LORE Solitude\'s Avenues: the Bards College and the Hall of the Dead are the Avenues\' (UESP), the Hall of the Dead beside the palace\'s terrace; the Blue Palace "at the tip of the Great Arch, directly above the Karth River" - wholly over the river', () => {
  const sol = capOf('solitude'), P = SOLITUDE_PLAN;
  const at = (kind) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (P[y][x] === kind) return [x, y]; return null; };
  for (const kind of ['LIBR', 'GRVE']) assert.equal(capitalDistrict(sol, ...at(kind)), 'The Avenues District', kind);
  const [gx, gy] = at('GRVE'), [px, py] = at('P1');
  assert.equal(Math.abs(gx - px) + Math.abs(gy - py), 1, 'beside the terrace');
  const pal = buildBluePalace();
  for (let i = 0; i < pal.positions.length; i += 3) {
    const cx = Math.floor(pal.positions[i] / BLOCK_M + sol.anchor[0]), cy = Math.floor(pal.positions[i + 2] / BLOCK_M + sol.anchor[1]);
    assert.equal(P[cy][cx], 'L', `the palace over the Karth at ${cx},${cy}`);
  }
});

// ── MOURNHOLD ───────────────────────────────────────────────────

test('TESA-LORE Mournhold on Tribunal\'s plan (UESP): the Temple Courtyard at the northern end round the High Fane, the Royal Palace "the center of the city", Godsreach west with its tavern and its museum, the Great Bazaar east before its shops, Plaza Brindisi Dorom "the southernmost quadrant" - the landmarks on their districts\' cells', () => {
  const mh = capOf('mournhold'), D = MOURNHOLD_DISTRICTS, P = MOURNHOLD_PLAN, M = MOURNHOLD;
  assert.ok(D['Temple Courtyard'].every(([, y]) => y <= 2), 'the courtyard north');
  assert.deepEqual([...D['Royal Palace']].map((c) => [...c]).sort(), [[3, 3], [3, 4], [4, 3], [4, 4]], 'the palace the middle');
  assert.ok(D.Godsreach.every(([x]) => x <= 2) && D['Great Bazaar'].every(([x]) => x >= 5), 'Godsreach west, the Bazaar east');
  assert.ok(D['Plaza Brindisi Dorom'].every(([x, y]) => y >= 5 && x >= 3 && x <= 4), 'the plaza south');
  assert.ok(D['Temple Courtyard'].some(([x, y]) => P[y][x] === 'TEMP'), 'the temple\'s block on the courtyard');
  for (const kind of ['TVRN', 'LIBR']) assert.ok(D.Godsreach.some(([x, y]) => P[y][x] === kind), `Godsreach's ${kind}`);
  const cellOf = (x, z) => [Math.floor(x / BLOCK_M + mh.anchor[0]), Math.floor(z / BLOCK_M + mh.anchor[1])];
  assert.equal(capitalDistrict(mh, ...cellOf(M.fane.x, M.fane.z)), 'Temple Courtyard');
  assert.equal(capitalDistrict(mh, ...cellOf(M.palace.x - 1, M.palace.z - 1)), 'Royal Palace');
  assert.equal(capitalDistrict(mh, ...cellOf(M.plaza.x, M.plaza.z)), 'Plaza Brindisi Dorom');
  const bz = buildGreatBazaar();
  for (let i = 0; i < bz.positions.length; i += 3) assert.equal(capitalDistrict(mh, ...cellOf(bz.positions[i], bz.positions[i + 2])), 'Great Bazaar', 'the stalls the Bazaar\'s');
  assert.ok(M.fane.z < M.palace.z && M.palace.z < M.plaza.z && M.fane.x === M.palace.x && M.palace.x === M.plaza.x, 'one way from the Fane through the palace to the plaza');
});

test('TESA-LORE Mournhold\'s Plaza Brindisi Dorom "a public garden dominated by a great statue at its center" (UESP) - "Almalexia in battle with Mehrunes Dagon": its grass, its paths, its trees, its plinth closed; Dagon west, his axe the statue\'s top, Almalexia east with Hopesfire gilt; the High Fane\'s porch south over the courtyard\'s pools and braziers; the palace\'s doors north and south', () => {
  const M = MOURNHOLD, P = M.plaza, S = M.statue, own = MOURNHOLD_BLOCKS.P0;
  assert.equal(own.tile(P.x + 40, P.z + 40), 2, 'the garden\'s grass');
  assert.deepEqual([own.tile(P.x, P.z + 50), own.tile(P.x + 50, P.z), own.tile(P.x + 10, P.z + 10), own.tile(0, 0), own.tile(M.fane.x, M.fane.z + 60)], [3, 3, 3, 3, 3], 'its paths, its court, the stone beyond');
  let trees = 0, grass = 0;
  for (let x = -100; x < 100; x += 6.4) for (let z = P.z - 100; z < P.z + 100; z += 6.4) {
    const t = own.tree(x, z);
    if (own.tile(x, z) === 2) grass++;
    if (t >= 0) { trees++; assert.equal(own.tile(x, z), 2); assert.ok(Math.hypot(x - P.x, z - P.z) >= P.paved); }
  }
  assert.ok(trees > grass / 12 && trees < grass / 3, `${trees} trees on ${grass} grass`);
  assert.equal(own.tree(0, 0), -1, 'none off the garden');
  assert.equal(own.closed(P.x, P.z), true, 'the plinth');
  const m = buildMournholdPlaza();
  sane(m);
  let top = 1, west = 0, east = 0;
  for (let i = 1; i < m.positions.length; i += 3) {
    if (m.positions[i] > m.positions[top]) top = i;
    if (m.positions[i] > S.plinthH + 7) { if (m.positions[i - 1] < P.x - 1) west++; if (m.positions[i - 1] > P.x + 1) east++; }
  }
  assert.ok(west > 0 && east > 0, 'two figures');
  assert.ok(m.positions[top - 1] < P.x && m.positions[top] > S.plinthH + S.dagon + 2, 'Dagon\'s axe raised over all');
  const gold = m.subMeshes.find((sm) => sm.textureRecord === CAPITAL_ART.gold);
  assert.ok(gold, 'Hopesfire');
  for (let i = gold.startIndex; i < gold.startIndex + gold.primitiveCount * 3; i++) assert.ok(m.positions[m.indices[i] * 3 + 1] > S.plinthH + S.almalexia * 0.9, 'raised high');
  const F = M.fane, fane = buildHighFane(), C = M.court;
  sane(fane);
  assert.equal(crosses(fane, [F.x, 4, F.z + F.plinth / 2 + F.porch + 2], [F.x, 4, F.z + F.plinth / 2 + 2]), true, 'the porch south');
  assert.equal(crosses(fane, [F.x - F.plinth / 2 - 6, 4, F.z], [F.x - F.plinth / 2 + 2, 4, F.z]), true, 'the plinth west');
  for (const px of C.pools) {
    const pz = (C.poolZ[0] + C.poolZ[1]) / 2;
    assert.equal(own.closed(px, pz), true, 'a pool');
    assert.equal(crosses(fane, [px, 1, pz], [px, 0, pz]), true, 'its water');
  }
  assert.equal(own.closed(0, (C.poolZ[0] + C.poolZ[1]) / 2), false, 'the way between the pools');
  for (const bx of C.braziers) assert.equal(crosses(fane, [bx, C.brazierH + 1.4, C.brazierZ[0] - 3], [bx, C.brazierH + 1.4, C.brazierZ[0] + 3]), true, 'a brazier\'s flame');
  const pal = buildMournholdPalace(), PL = M.palace;
  sane(pal);
  const door = (z, nz) => { for (let t = 0; t < pal.indices.length; t += 3) { const sm = pal.subMeshes.find((q) => t >= q.startIndex && t < q.startIndex + q.primitiveCount * 3); if (sm.textureRecord !== CAPITAL_ART.dark) continue; const zs = [0, 1, 2].map((k) => pal.positions[pal.indices[t + k] * 3 + 2]); if (zs.every((v) => Math.abs(v - z) < 0.2) && Math.sign(pal.normals[pal.indices[t] * 3 + 2]) === nz) return true; } return false; };
  assert.ok(door(PL.z + PL.d / 2, 1) && door(PL.z - PL.d / 2, -1), 'its doors to the plaza and the courtyard');
});

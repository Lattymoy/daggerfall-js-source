// TESA-LORE (2026-10-24, the owner: "polishing and refining each capital city design and bringing them more in line with
// lore and the mainline games"; bible/03-World/Arena-Provinces.md TESA-LORE) - THE CAPITALS, REFINED TOWARD THE LORE, pinned:
// each refinement against the reading it came from (UESP's), the place it stands, its ground and its walkers' way.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPERIAL, IMPERIAL_SECTORS, imperialSliceName, IMPERIAL_MODELS, IMPERIAL_CARRY, imperialCell, imperialCodeCell, polar, imperialBearing,
  imperialDistrictAt, imperialTile, imperialClosed, imperialTree, prisonAt, watchTowersAt, divinesAt, divinePlinths, IMPERIAL_SPAN, IMPERIAL_CELLS,
  imperialPartId, causewayLines,
} from '../src/world/imperialCity.js';
import { CAPITALS, CAPITAL_MODELS, BLOCK_M, capitalModelCarriers, capitalDistrict, SOLITUDE, SOLITUDE_PLAN, SOLITUDE_BLOCKS } from '../src/world/tamrielCapitals.js';
import { buildCityWall, buildNineDivines, nearRect } from '../src/world/capitalImperial.js';
import { imperialOwnLaws } from '../src/world/imperialBlocks.js';   // IC-GRAND: a cell's own laws (the fabric's ground with the landmarks')
import { buildCastleDour, buildBluePalace } from '../src/world/capitalSolitude.js';
import { MOURNHOLD, MOURNHOLD_PLAN, MOURNHOLD_DISTRICTS, MOURNHOLD_BLOCKS } from '../src/world/capitalPlans.js';
import { buildMournholdPlaza, buildHighFane, buildMournholdPalace, buildGreatBazaar } from '../src/world/capitalMournhold.js';
import { ALINOR, ALINOR_PLAN, ALINOR_BLOCKS, FALINESTI, TORVAL, TORVAL_PLAN, TORVAL_BLOCKS, estateBeds, HELSTROM, HELSTROM_BLOCKS, histStones } from '../src/world/capitalPlans.js';
import { buildManeEstate, buildManePalace, buildTwoMoonsTemple } from '../src/world/capitalTorval.js';
import { buildHist } from '../src/world/capitalHelstrom.js';
import { buildGrahtOak, spiralAt, spiralInner, limbForks } from '../src/world/capitalFalinesti.js';
import { buildAlinorPalace, buildAlinorBridges, buildAlinorWall, alinorStairY, alinorTowers } from '../src/world/capitalAlinor.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART, CAPITAL_ART_SIZE, CAPITAL_TEXEL_METRES, capitalArt, vanillaTexels, installCapitals, _resetCapitals } from '../src/world/capitalModels.js';
import { customModelFor } from '../src/world/customModels.js';
import { URBAN_ARCHIVE, URBAN_ART } from '../src/world/urban/urbanRecords.js';   // URBANIZER U2
import { CAPITAL_CUT_RECORDS, flatTriangles } from '../src/world/capitalShapes.js';   // CAPITAL-TREES

const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite));
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  // PIN MOVED (URBANIZER U2): a landmark's pictures the capitals' own or the towns' (cut stone, brick, half-timbering)
  assert.ok(m.subMeshes.every((s) => (s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)) || (s.textureArchive === URBAN_ARCHIVE && Object.values(URBAN_ART).includes(s.textureRecord))));
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
/** Does the segment p-q cross a face of the model whose normal faces up - a floor one stands on? */
const crossesUp = (m, p, q) => {
  const up = { ...m, indices: m.indices.filter((_, i, ix) => m.normals[ix[i - (i % 3)] * 3 + 1] > 0.5) };
  return crosses(up, p, q);
};
const P3 = (b, r, y) => { const [x, z] = polar(b, r); return [x, y, z]; };
const capOf = (key) => CAPITALS.find((c) => c.key === key);

// ── THE IMPERIAL CITY ───────────────────────────────────────────

const IC = capOf('imperial-city'), B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
/** The slice (from the north-west, a row of IMPERIAL_SPAN) and the plan's cell a point of the city stands in. PIN MOVED
 *  (TOWN-SHAPES TS5): seven pixels a side, the anchor the plan's middle. */
const sliceAt = (x, z) => Math.floor((z + HALF * B) / (8 * B)) * IMPERIAL_SPAN + Math.floor((x + HALF * B) / (8 * B));
const cellAt = (x, z) => imperialCell(Math.floor(z / B + HALF), Math.floor(x / B + HALF));   // PIN MOVED (IC-GRAND): the plan by its law
const isOwn = (cell) => !!imperialCodeCell(cell);
/** IC-GRAND: the city wall's runs near a point alone (a long wall's part is built so - world/capitalModels.js imperialPartBuild). */
const wallNear = ([x, z], m = 80) => buildCityWall(undefined, nearRect([x - m, z - m, x + m, z + m], 40));
/** TS5: a landmark carried in its parts - its part in slice `s` (world/imperialCity.js IMPERIAL_PARTS). */
const partIn = (base, s) => imperialPartId(base, s);

test('TESA-LORE the Imperial City\'s Prison on the isle\'s north-eastern shore (UESP: "northeast of the main city walls") - its compound in the north-east pixel, named for it and carrying it; the city wall\'s gate to it open, its causeway stone', () => {
  const [px, pz] = prisonAt();
  assert.ok(Math.abs(imperialBearing(px, pz) - 45) < 1e-9, 'north-east');
  assert.equal(imperialDistrictAt(px, pz), 'Prison District');
  const s = sliceAt(px, pz);   // PIN MOVED (TS5): the north-east pixel of seven a side
  assert.ok(s % IMPERIAL_SPAN > (IMPERIAL_SPAN - 1) / 2 && Math.floor(s / IMPERIAL_SPAN) < (IMPERIAL_SPAN - 1) / 2, 'the north-east pixel');
  // PIN MOVED (IC-GRAND): its compound 600 m across over the corner of four slices of twenty-five a side - a slice of it
  // named for it (the rest the Market District's or the isle's, whichever holds the more)
  const h = IMPERIAL.prison.half, slices = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([dx, dz]) => sliceAt(px + dx, pz + dz));
  assert.ok(slices.some((q) => imperialSliceName(q) === 'Prison District'), slices.map(imperialSliceName).join());
  assert.equal(IMPERIAL_CARRY[partIn(IMPERIAL_MODELS.prison, s)], s);
  const carrier = capitalModelCarriers(IC).get(partIn(IMPERIAL_MODELS.prison, s));
  const at = imperialCodeCell(carrier);
  assert.ok(at && Math.floor(at[0] / 8) * IMPERIAL_SPAN + Math.floor(at[1] / 8) === s, `carried in its pixel: ${carrier}`);
  const W = IMPERIAL.cityWall;
  assert.ok(W.gates.includes(IMPERIAL.prison.b), 'a gate on its bearing');
  assert.equal(crosses(wallNear(polar(IMPERIAL.prison.b, W.r)), P3(IMPERIAL.prison.b, W.r - 10, W.gateH / 2), P3(IMPERIAL.prison.b, W.r + 10, W.gateH / 2)), false, 'open');
  // PIN MOVED (TS5 with AUDIT TESA II C3): the causeway from the wall's gate to the compound's own gate - off its bearing on
  // seven pixels, where the compound's half is a sixth of the way out
  const [[ax, az], [bx, bz]] = causewayLines()[0];
  for (const t of [0.25, 0.5, 0.75]) assert.equal(imperialTile(ax + (bx - ax) * t, az + (bz - az) * t), 3, `its causeway at ${t}`);
});

test('TESA-LORE the Imperial City\'s watch towers: one where each district wall meets the city wall (the North, North-East, South-East, South, South-West and North-West Watch Towers between the districts they border), standing over the wall\'s other towers; their ground the city\'s own', () => {
  const W = IMPERIAL.cityWall;
  sane(wallNear(polar(0, W.r)));
  assert.deepEqual(watchTowersAt(), IMPERIAL_SECTORS.map(([, b]) => polar(b, W.r)));
  assert.ok(W.watchR > W.towerR && W.watchH > W.towerH + W.towerR * 1.4);
  const over = W.towerH + W.towerR * 1.4 + 4;   // past the ten-degree towers' cones
  for (const [, b] of IMPERIAL_SECTORS) {
    assert.equal(crosses(wallNear(polar(b, W.r)), P3(b, W.r - W.watchR - 2, over), P3(b, W.r + W.watchR + 2, over)), true, `the watch tower at ${b}`);
    assert.equal(crosses(wallNear(polar(b + 10, W.r)), P3(b + 10, W.r - W.watchR - 2, over), P3(b + 10, W.r + W.watchR + 2, over)), false, `none at ${b + 10}`);
    const [x, z] = polar(b, W.r);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(isOwn(cellAt(x + dx * (W.watchR + 1), z + dz * (W.watchR + 1))), `its foot on the city's own at ${b}`);
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
  // PIN MOVED (IC-GRAND): off the Arboretum's avenue and its ring road, both of which cross the court (its heart)
  const a = ((D.b - 45) * Math.PI) / 180, [px, pz] = [cx + Math.sin(a) * (D.court + 12), cz - Math.cos(a) * (D.court + 12)];
  assert.equal(imperialOwnLaws(Math.floor(pz / B + HALF), Math.floor(px / B + HALF)).tile(px, pz), 2, 'the park round it (PIN MOVED, IC-GRAND: its grass the cell\'s own laws\' - the landmarks\' tile says none there, the Arboretum\'s ground the fabric\'s)');
  for (let x = cx - D.court + 2; x < cx + D.court - 2; x += 3.2) for (let z = cz - D.court + 2; z < cz + D.court - 2; z += 3.2) if (Math.hypot(x - cx, z - cz) < D.court - 2) assert.equal(imperialTree(x, z), -1);
  for (const [dx, dz] of [[0, 0], [D.court - 4, 0], [0, D.court - 4], [-(D.court - 4), 0], [0, -(D.court - 4)]]) assert.ok(isOwn(cellAt(cx + dx, cz + dz)), 'the court the city\'s own');
  assert.ok(IC.drawn.includes(IMPERIAL_MODELS.nineDivines) && CAPITAL_MODELS.nineDivines === IMPERIAL_MODELS.nineDivines);   // PIN MOVED (TS5): drawn whole, carried in parts
  assert.ok(IC.models.includes(partIn(IMPERIAL_MODELS.nineDivines, sliceAt(cx, cz))));
  assert.equal(IMPERIAL_CARRY[partIn(IMPERIAL_MODELS.nineDivines, sliceAt(cx, cz))], sliceAt(cx, cz), 'carried in its pixel');
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
  // PIN MOVED (CAPITAL-TREES): the garden's trees are the city's own in their planters - its gardens' model
  // (world/capitalMournhold.js buildMournholdGardens, test/world/capitaltrees.test.js) - and its own blocks plant none of
  // the Bay's scenery trees (a fir and an oak of the Iliac Bay's woods, one tile in five of its grass, they were)
  for (const code of Object.keys(MOURNHOLD_BLOCKS)) assert.equal(MOURNHOLD_BLOCKS[code].tree, undefined, `${code} plants no scenery tree`);
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

// ── ALINOR ──────────────────────────────────────────────────────

test('TESA-LORE Alinor: no Crystal Tower in it (UESP: "a large structure found on the northern tip of Summerset"); the Royal Palace at the top of the city "built on mountain slopes" - three terraces stepping in and up, closed whole, the grand stair up their south face open and walkable, the palace\'s door at its head', () => {
  const al = capOf('alinor'), P = ALINOR.palace;
  assert.ok(!Object.hasOwn(CAPITAL_MODELS, 'crystalTower') && !Object.values(CAPITAL_MODELS).includes(910131), 'its model retired');
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  for (const id of al.models) assert.ok(!customModelFor(id).subMeshes.some((sm) => sm.textureRecord === CAPITAL_ART.crystal), `no crystal in ${id}`);
  for (let i = 1; i < P.terraces.length; i++) assert.ok(P.terraces[i][0] < P.terraces[i - 1][0] && P.terraces[i][1] > P.terraces[i - 1][1], 'each a step in and up');
  const m = buildAlinorPalace(), top = P.terraces[P.terraces.length - 1][1], [side] = P.terraces[0];
  sane(m);
  assert.deepEqual([ALINOR_BLOCKS.P0.closed(side / 2 - 2, 0), ALINOR_BLOCKS.P0.closed(0, -side / 2 + 2), ALINOR_BLOCKS.P0.closed(0, side / 2 + 3)], [true, true, false], 'the height closed, the street round it open');
  const head = P.terraces[P.terraces.length - 1][0] / 2, run = P.stairFoot - head;
  assert.ok(top / run < 0.6, 'a walkable slope');
  for (const t of [0.2, 0.5, 0.8]) {
    const z = P.stairFoot - run * t, y = alinorStairY(z);
    assert.ok(Math.abs(y - top * t) < 1e-9);
    assert.equal(crosses(m, [0, y + 1, z], [0, y - 1, z]), true, `the stair at ${z.toFixed(1)}`);
    assert.equal(crosses(m, [0, y + 0.8, z + 1], [0, y + 0.8 + top / run * 2, z - 1]), false, 'nothing across it');
    for (const sx of [1, -1]) assert.equal(crosses(m, [sx * (P.stairW / 2 + 3), top + 2, z], [sx * (P.stairW / 2 + 3), 0.1, z]), true, 'the terraces beside it');
  }
  let door = false;
  for (let t = 0; t < m.indices.length; t += 3) {
    const sm = m.subMeshes.find((q) => t >= q.startIndex && t < q.startIndex + q.primitiveCount * 3);
    if (sm.textureRecord === CAPITAL_ART.dark && [0, 1, 2].every((k) => m.positions[m.indices[t + k] * 3 + 1] >= top - 1e-6)) door = true;
  }
  assert.ok(door, 'its door at the stair\'s head');
});

test('TESA-LORE Alinor\'s river: "a great river runs through Alinor\'s southern portion and empties into the Sea of Pearls" (UESP) - a row of water across the city to the sea in the east, under two bridges from bank to bank, arched and walkable; the walls open where it runs, a tower on either bank', () => {
  const al = capOf('alinor'), R = ALINOR.river, P = ALINOR_PLAN, B = BLOCK_M;
  const row = Math.round(R.z0 / B + al.anchor[1]);
  assert.ok(Math.abs(row - (R.z0 / B + al.anchor[1])) < 1e-9 && Math.abs(R.z1 - R.z0 - B) < 1e-9, 'one row of the plan');
  assert.deepEqual(P[row], Array(8).fill('L'), 'water across the city');
  assert.ok(P[row + 1][7] === 'L' && P[row + 2].every((c) => c === 'L'), 'to the sea');
  assert.ok(P[row - 1].slice(1, 7).every((c) => c !== 'L' && c !== 'G') && P[row + 1].slice(1, 7).every((c) => Object.hasOwn(ALINOR_BLOCKS, c)), 'the city on its north bank, the quay on its south');
  const br = buildAlinorBridges(), mid = (R.z0 + R.z1) / 2;
  sane(br);
  assert.equal(ALINOR.bridges.length, 2);
  for (const x of ALINOR.bridges) {
    const z = R.z0 + (R.z1 - R.z0) * 0.375;   // between its piers
    assert.equal(crosses(br, [x, 0.5, z], [x, 2.5, z]), false, 'the water clear under its arch');
    assert.equal(crosses(br, [x, 2.5, z], [x, ALINOR.bridgeRise + 2, z]), true, 'its deck arched over it');
    for (const z of [R.z0 + 0.5, R.z1 - 0.5]) assert.equal(crosses(br, [x, 1, z], [x, 0, z]), true, 'from bank to bank');
    const cx = Math.floor(x / B + al.anchor[0]);
    assert.ok(P[row - 1][cx] !== 'L' && P[row + 1][cx] !== 'L', 'on land at both ends');
  }
  let steep = 0;
  for (let i = 0; i < br.normals.length; i += 3) if (br.normals[i + 1] > 0.5) steep = Math.max(steep, Math.hypot(br.normals[i], br.normals[i + 2]) / br.normals[i + 1]);
  assert.ok(steep < 0.6, `its decks walkable: ${steep.toFixed(2)}`);
  const W = ALINOR.wall, wall = buildAlinorWall();
  sane(wall);
  for (const x of [W.west, W.east]) {
    assert.equal(crosses(wall, [x - 6, 2, mid], [x + 6, 2, mid]), false, `the river's way at ${x}`);
    assert.equal(crosses(wall, [x - 6, 2, R.z0 - 40], [x + 6, 2, R.z0 - 40]), true, 'walled north of it');
    assert.ok(alinorTowers().some(([tx, tz]) => tx === x && tz > R.z0 && tz < mid) && alinorTowers().some(([tx, tz]) => tx === x && tz < R.z1 && tz > mid), 'a tower on either bank');
  }
});

// ── FALINESTI ───────────────────────────────────────────────────

/** A model's triangles of one picture, each its three corners. */
const trisOf = (m, record) => {
  const out = [];
  for (const sm of m.subMeshes) if (sm.textureRecord === record) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) out.push([0, 1, 2].map((k) => [0, 1, 2].map((a) => m.positions[m.indices[i + k] * 3 + a])));
  return out;
};

test('TESA-LORE Falinesti, the city in the boughs (UESP: "Bosmer live ... coaxing the living wood into pathways winding around hide structures nestled in hollows"): hide houses on every platform and at every limb\'s fork on its deck; the walkway winding up the trunk from the ground to the highest platform, a turn a level, walkable', () => {
  const F = FALINESTI, m = buildGrahtOak(), hide = trisOf(m, CAPITAL_ART.hide);
  sane(m);
  const housesAt = (pred) => hide.filter((t) => t.every(pred)).length;
  for (const y of F.platforms) assert.ok(housesAt((p) => p[1] >= y - 0.01 && p[1] <= y + F.hutH + 0.01) >= F.huts * 8, `the houses on the platform at ${y}`);
  const forks = limbForks(), wood = m.subMeshes.find((sm) => sm.textureRecord === CAPITAL_ART.timber), timber = { ...m, indices: m.indices.slice(wood.startIndex, wood.startIndex + wood.primitiveCount * 3) };
  assert.equal(forks.length, F.limbs);
  for (const [x, y, z] of forks) {
    assert.equal(crosses(timber, [x, y + 0.3, z], [x, y - 0.9, z]), true, `a deck at the fork ${x.toFixed(0)},${z.toFixed(0)}`);   // PIN MOVED (CAPITAL-TREES): its timber - the limb runs under it now
    assert.ok(housesAt((p) => Math.hypot(p[0] - x, p[2] - z) < F.forkDeck && p[1] >= y - 0.01) >= 16, 'its two houses on it');
  }
  assert.deepEqual(spiralAt(0), [0, 0], 'from the ground');
  F.platforms.forEach((y, k) => assert.ok(Math.abs(spiralAt((k + 1) / F.platforms.length)[1] - y) < 1e-9 && Math.abs(spiralAt((k + 1) / F.platforms.length)[0] - (k + 1) * Math.PI * 2) < 1e-9, `a turn to the platform at ${y}`));
  for (let i = 0; i < 40; i++) {   // PIN MOVED (AUDIT TESA II C4): between the turns' ends - a landing's floor the walkway's own now, the platform's deck open over it
    const [a, y] = spiralAt((i + 0.5) / 40), r = spiralInner(y) + F.spiral.w / 2;
    assert.equal(crossesUp(m, [Math.cos(a) * r, y + 0.6, Math.sin(a) * r], [Math.cos(a) * r, y - 0.6, Math.sin(a) * r]), true, `the walkway's floor at ${y.toFixed(1)}`);
  }
  let steep = 0;
  for (const [a, b, c] of trisOf(m, CAPITAL_ART.timber)) {
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]), n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (Math.abs(n[1]) > 0.5 * Math.hypot(...n)) steep = Math.max(steep, Math.hypot(n[0], n[2]) / Math.abs(n[1]));
  }
  assert.ok(steep < 0.6, `its decks walkable: ${steep.toFixed(2)}`);
});

// ── TORVAL ──────────────────────────────────────────────────────

test('TESA-LORE Torval\'s estate (UESP: "the Mane\'s palaces stand among gardens of sugarcane laid out in symmetry, where the Mane meditates on a palanquin"): the palace\'s own blocks walled, its one gate south; the cane beds mirrored about the palace\'s axis, closed, off the palace and the palanquin, the estate\'s grass and its axis path between; the palanquin on its dais north of the palace, under its canopy', () => {
  const to = capOf('torval'), T = TORVAL, E = T.estate, P = T.palace, Q = T.palanquin, own = TORVAL_BLOCKS.P0, beds = estateBeds();
  assert.ok(beds.length >= 20);
  const key = (b) => b.map((v) => v.toFixed(3)).join();
  const set = new Set(beds.map(key));
  for (const [x, z, w, d] of beds) {
    assert.ok(set.has(key([-x, z, w, d])), `the mirror of ${x.toFixed(0)},${z.toFixed(0)}`);
    assert.ok(Math.abs(x - P.x) + w / 2 < E.half && Math.abs(z - P.z) + d / 2 < E.half, 'within the wall');
    assert.ok(Math.abs(x - P.x) - w / 2 > P.w / 2 + P.minaretR || Math.abs(z - P.z) - d / 2 > P.d / 2 + P.minaretR, 'off the palace');
    assert.ok(Math.abs(x - P.x) - w / 2 > Q.dais / 2 || Math.abs(z - P.z - Q.dz) - d / 2 > Q.dais / 2, 'off the palanquin');
    assert.equal(own.closed(x, z), true, 'a bed closed');
  }
  const [bx, bz, , bd] = beds[0];
  assert.equal(own.closed(bx, bz + bd / 2 + (E.pitch - bd) / 2), false, 'the way between two beds open');
  assert.deepEqual([own.tile(bx, bz + E.pitch / 2), own.tile(P.x, P.z + P.d / 2 + 10), own.tile(P.x, P.z + E.half + 10)], [2, 3, 3], 'the estate\'s grass, its axis path, the city\'s stone past its wall');
  const m = buildManeEstate(), cellOf = (x, z) => TORVAL_PLAN[Math.floor(z / BLOCK_M + to.anchor[1])]?.[Math.floor(x / BLOCK_M + to.anchor[0])];
  sane(m);
  for (let i = 0; i < m.positions.length; i += 3) assert.ok(/^P\d$/.test(cellOf(m.positions[i], m.positions[i + 2])), 'the estate on the palace\'s own blocks');
  const g = E.gateH / 2, sz = P.z + E.half;
  assert.equal(crosses(m, [P.x, g, sz - 3], [P.x, g, sz + 3]), false, 'its gate south');
  for (const [a, b] of [[[P.x + 40, g, sz - 3], [P.x + 40, g, sz + 3]], [[P.x - E.half - 3, g, P.z], [P.x - E.half + 3, g, P.z]], [[P.x + E.half - 3, g, P.z], [P.x + E.half + 3, g, P.z]], [[P.x, g, P.z - E.half - 3], [P.x, g, P.z - E.half + 3]]]) assert.equal(crosses(m, a, b), true, 'walled elsewhere');
  assert.equal(own.closed(P.x, P.z + Q.dz), true, 'the palanquin\'s dais');
  assert.ok(Q.dz < -(P.d / 2 + P.minaretR), 'north of the palace');
  assert.equal(crosses(m, [P.x, Q.daisH + 5, P.z + Q.dz], [P.x, Q.daisH + 3, P.z + Q.dz]), true, 'its canopy');
  assert.ok(m.subMeshes.some((sm) => sm.textureRecord === CAPITAL_ART.cane) && m.subMeshes.some((sm) => sm.textureRecord === CAPITAL_ART.cloth));
  assert.ok(to.models.includes(CAPITAL_MODELS.maneEstate));
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  assert.ok(customModelFor(CAPITAL_MODELS.maneEstate)?.positions?.length > 0, 'installed');
});

test('TESA-LORE Torval\'s moons: a gilt crescent over every dome of the palace, its minarets and the Temple of the Two Moons - none a spike', () => {
  const T = TORVAL, P = T.palace, M = T.temple, top = M.tiers.length * M.tierH;
  const goldOver = (m, x, z, y, r) => { const g = trisOf(m, CAPITAL_ART.gold).filter((t) => t.every((p) => Math.hypot(p[0] - x, p[2] - z) < r * 1.4 && p[1] > y - 0.5)); return g.length; };
  const pal = buildManePalace(), tem = buildTwoMoonsTemple();
  assert.ok(goldOver(pal, P.x, P.z, P.h + P.drumH + P.domeH - 0.4, 2.6) >= 50, 'the palace\'s dome');
  for (const sx of [1, -1]) for (const sz of [1, -1]) assert.ok(goldOver(pal, P.x + sx * (P.w / 2 + P.minaretR * 0.4), P.z + sz * (P.d / 2 + P.minaretR * 0.4), P.minaretH + 0.8 + P.minaretR * 1.3 - 0.2, 1.1) >= 50, 'a minaret\'s');
  for (const [dx, r, h] of [M.masser, M.secunda]) assert.ok(goldOver(tem, M.x + dx, M.z, top + M.drumH + h - 0.2, r * 0.16) >= 50, 'each moon\'s dome');
  // a crescent's horns stand off its axis: the palace's highest gilt is not on it
  let hi = null;
  for (const t of trisOf(pal, CAPITAL_ART.gold)) for (const p of t) if (!hi || p[1] > hi[1]) hi = p;
  assert.ok(Math.hypot(hi[0] - P.x, hi[2] - P.z) > 1.5, 'its horns, not a point');
});

// ── HELSTROM ────────────────────────────────────────────────────

test('TESA-LORE Helstrom in the heart-mud (UESP: "the marsh of Helstrom is very dense and heavily consumed by Heart-Mud"): its own ground the mud but the paving at the Xanmeer\'s foot; the Hist grown greater, its standing stones ringed about it on its isle - closed, the way between open', () => {
  const H = HELSTROM, X = H.xanmeer, own = HELSTROM_BLOCKS.X0, T = H.hist;
  assert.deepEqual([own.tile(X.paved + 10, -X.paved - 10), own.tile(0, X.tiers[0] / 2 + 6), own.tile(T.x, T.z), own.tile(150, 150)], [1, 3, 2, 0], 'the mud, the paving, the isle, the canal');
  assert.ok(T.h >= 60 && T.crown >= 30, 'grown from its 44 m');
  const m = buildHist(), stones = histStones();
  sane(m);
  assert.equal(stones.length, T.stones);
  for (const [x, z] of stones) {
    assert.ok(Math.hypot(x - T.x, z - T.z) + T.stoneW < T.isle, 'on its isle');
    assert.equal(own.closed(x, z), true, 'a stone');
    assert.equal(crosses(m, [x - 3, T.stoneH / 2, z], [x + 3, T.stoneH / 2, z]), true, 'its pillar');
  }
  const [ax, az] = stones[0], [bx, bz] = stones[1];
  assert.equal(own.closed((ax + bx) / 2, (az + bz) / 2), false, 'the way between');
  let top = 1;
  for (let i = 1; i < m.positions.length; i += 3) if (m.positions[i] > m.positions[top]) top = i;
  assert.ok(m.positions[top] > T.h, 'its crown over its trunk\'s height');
});

// ── THE PICTURES AND THEIR TEXELS ───────────────────────────────

/** A picture's detail as the freeware's was measured: its distinct colours, the mean |dL| from a texel to the next on
 *  its row, its luminance's spread - and, for its tiling, the mean |dL| across its wrap (its last column to its first,
 *  its last row to its first) beside the strongest across any of its inner columns and rows (a joint, a seam of its own):
 *  a picture that does not tile shows a seam stronger than any it paints. */
const detail = (px, S = CAPITAL_ART_SIZE, H = S) => {   // IC-GRAND: H, a picture taller than wide (vanilla's 64 x 128 wall)
  const L = (i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2], at = (x, y) => ((y % H) * S + (x % S)) * 4;
  const set = new Set(), cols = new Float64Array(S), rows = new Float64Array(H);
  let hf = 0, s = 0, s2 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
    const i = at(x, y), l = L(i), dx = Math.abs(l - L(at(x + 1, y))), dy = Math.abs(l - L(at(x, y + 1)));
    set.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]); hf += dx; s += l; s2 += l * l; cols[x] += dx / H; rows[y] += dy / S;
  }
  const n = S * H, m = s / n;
  return { colours: set.size, hf: hf / n, std: Math.sqrt(s2 / n - m * m), seam: [cols[S - 1], rows[H - 1]], inner: [Math.max(...cols.slice(0, S - 1)), Math.max(...rows.slice(0, H - 1))] };
};
/** IC-GRAND: the Imperial City's street walls, a storey each - vanilla's 64 x 128 wall (world/imperialArt.js). */
const TALL = new Set(['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop', 'groundArcade']);

test('TESA-LORE the capitals\' pictures at vanilla\'s detail (the owner: "fall in line with the detail of vanilla textures. Same resolution and all"): each 64 x 64 - the width of Daggerfall\'s wall and ground textures - and each but the doors\' dark within the freeware\'s own band (its 475 such textures, the tenth to the ninetieth percentile): 16 to 84 colours, a texel 5.4 to 18.4 from the next, a spread of 11.3 to 41.6; every one tiling without a seam', () => {
  const art = capitalArt();
  assert.equal(CAPITAL_ART_SIZE, 64);
  for (const [name, record] of Object.entries(CAPITAL_ART)) {
    if (CAPITAL_CUT_RECORDS.includes(record)) continue;   // PIN MOVED (CAPITAL-TREES): a tree's flats, cut by their alpha, are a flat's size and detail (test/world/capitaltrees.test.js)
    const img = art.get(record), h = TALL.has(name) ? 128 : 64;   // PIN MOVED (IC-GRAND): the street walls 64 x 128, vanilla's own wall's
    assert.deepEqual([img.width, img.height], [64, h], name);
    const d = detail(img.data, 64, h);
    if (name !== 'dark') {
      assert.ok(d.colours >= 16 && d.colours <= 84, `${name}: ${d.colours} colours`);
      assert.ok(d.hf >= 5.4 && d.hf <= 18.4, `${name}: ${d.hf.toFixed(1)} from texel to texel`);
      assert.ok(d.std >= 11.3 && d.std <= 41.6, `${name}: a spread of ${d.std.toFixed(1)}`);
    }
    for (const a of [0, 1]) assert.ok(d.seam[a] <= d.inner[a] + 1, `${name} tiles ${a ? 'down' : 'across'}: ${d.seam[a].toFixed(1)} over its wrap, ${d.inner[a].toFixed(1)} the strongest inside`);
  }
});

test('TESA-LORE vanilla\'s texel density on every capital model (the freeware\'s ARCH3D faces: the middle half 22.5 to 41 texels a metre, a 64 x 128 wall 40.9): every face of every installed model 30.4 to 40 texels a metre, the box projection\'s law', () => {
  const full = CAPITAL_ART_SIZE / CAPITAL_TEXEL_METRES;
  assert.ok(Math.abs(full - 40) < 1e-9, 'a 64-texel picture across 1.6 m');
  const quad = vanillaTexels({ positions: [0, 0, 0, 2, 0, 0, 2, 3, 0], indices: [0, 1, 2] });
  // PIN MOVED (BLD): v RISES up the wall - MeshReader's law (v = -(texel row / height)); it had fallen, every capital's
  // masonry upside down on the GL's bottom-up pictures
  assert.deepEqual([...quad.uvs].map((v) => +v.toFixed(4)), [0, 0, 1.25, 0, 1.25, 1.875], 'a wall facing z: x across, y up (v rising up it, MeshReader\'s)');
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  let faces = 0;
  for (const id of Object.values(CAPITAL_MODELS)) {
    const m = customModelFor(id), flats = flatTriangles(m);   // PIN MOVED (CAPITAL-TREES): a tree's flats on their own coordinates, at the density of Daggerfall's trees' flats (test/world/capitaltrees.test.js)
    for (let t = 0; t < m.indices.length; t += 3) {
      if (flats?.[t / 3]) continue;
      const ix = [0, 1, 2].map((k) => m.indices[t + k]);
      const P = ix.map((v) => [0, 1, 2].map((a) => m.positions[v * 3 + a])), U = ix.map((v) => [m.uvs[v * 2] * 64, m.uvs[v * 2 + 1] * 64]);
      const e1 = P[1].map((x, k) => x - P[0][k]), e2 = P[2].map((x, k) => x - P[0][k]);
      const wa = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      if (wa < 0.01) continue;
      // PIN MOVED (IC-GRAND): a sliver under 5 cm on a side read off float32 kilometres out (a cone's tip 2.3 km from the middle) is no face to measure
      if (Math.min(Math.hypot(...e1), Math.hypot(...e2), Math.hypot(...P[2].map((x, k) => x - P[1][k]))) < 0.05) continue;
      const ta = Math.abs((U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1])) / 2, dens = Math.sqrt(ta / wa);
      assert.ok(dens >= full * Math.sqrt(1 / Math.sqrt(3)) - 0.05 && dens <= full + 0.05, `model ${id}: ${dens.toFixed(2)} texels a metre`);
      faces++;
    }
  }
  assert.ok(faces > 100000, `${faces} faces`);
});

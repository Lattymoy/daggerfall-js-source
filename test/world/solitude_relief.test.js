// SOLITUDE-RELIEF (2026-10-27, the owner, with Skyrim's Solitude over the Karth: "I really want to transform solitude to
// match this as close to 1:1 as possible", then "when it comes to cities they are all flat and solitude is the first city
// where I want to really explore varied depths of terrain"; bible/03-World/Arena-Provinces.md SOLITUDE-RELIEF) - SOLITUDE
// ON ITS ROCK, pinned: its relief's heights (world/solitudeRelief.js), its pixel's ground on them (world/terrain/
// capitalRelief.js), its tiles, its blocks' tiers (world/tamrielCapitals.js capitalBlockLift), its markers, every landmark at
// its height (world/capitalSolitude.js), its walkers kept to their tiers (world/townWalls.js shutRelief), its fabric and
// its festival on its tiers - on synthetic ground, and on the player's own files where ARENA2_PATH names them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as R from '../../src/world/solitudeRelief.js';
import {
  CAPITALS, SOLITUDE, SOLITUDE_PLAN, BLOCK_M, capitalBlockLift, capitalPortBlocks, capitalBlockNames, capitalLakeName, synthesizeCapitalLocation,
  startMarkerAt, capitalGardenName, anchorMetres, autoCentre, tileCentre, inCapitalRim, CAPITAL_CLOSED_BYTE,
} from '../../src/world/tamrielCapitals.js';
import { capitalReliefGround, reliefFlat, reliefSample, reliefOf, reliefVertexAt, CAPITAL_RELIEFS } from '../../src/world/terrain/capitalRelief.js';
import {
  buildSolitudeArch, buildBluePalace, buildSolitudeWall, buildCastleDour, buildSolitudeDocks, buildSolitudeCliffs, buildSolitudeTerraces,
  archTop, archOpening, levelY, CLIFF_STEEP, CLIFF_SKIN, solitudeDrawn,
} from '../../src/world/capitalSolitude.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART } from '../../src/world/capitalModels.js';
import { URBAN_ARCHIVE, URBAN_ART } from '../../src/world/urban/urbanRecords.js';
import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { surfaceHeightAt, convertTile } from '../../src/world/terrain/terrainSurface.js';
import { shutRelief } from '../../src/world/townWalls.js';
import { townFabricModel } from '../../src/world/urban/townFabricModel.js';
import { witchesDressing } from '../../src/world/witchesDecor.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';

const L = R.SOLITUDE_LEVELS, P = R.SOLITUDE_PIXEL, CELL = P.side / 128, H = HEIGHTMAP_DIMENSION, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, SEA = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const sol = CAPITALS.find((c) => c.key === 'solitude');

const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite), 'finite');
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  assert.ok(m.subMeshes.every((s) => (s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)) || (s.textureArchive === URBAN_ARCHIVE && Object.values(URBAN_ART).includes(s.textureRecord))), 'the capitals\' pictures');
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
};
const bounds = (m) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); }
  return { lo, hi };
};
/** Does the segment p-q cross any face of the model (Moller-Trumbore)? */
const crosses = (m, p, q) => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    const V = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [V(0), V(1), V(2)], e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-9) continue;
    const s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const w = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (w >= 0 && w <= 1) return true;
  }
  return false;
};

test('SOLITUDE-RELIEF the city on its rock: the Well District inside the main gate and the lane at its level, the upper tier 6 m over it, the palace terrace and the stack higher, the quay at the water - the cliffs falling to the sea west and north and to the country east, never under the sea', () => {
  assert.deepEqual([L.city, L.upper, L.terrace, L.stack, L.quay], [46, 52, 60, 64, 2.4]);
  // the tiers: the Well District's six blocks and the lane, every other cell of the plateau the upper
  for (const [c, r] of [[2, 5], [3, 5], [4, 5], [2, 6], [3, 6], [4, 6]]) assert.equal(R.plateauHeight(P.x0 + (c + 0.5) * BLOCK_M, P.z0 + (r + 0.5) * BLOCK_M), L.city, `(${c},${r}) the Well District`);
  for (const [c, r] of [[3, 2], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [6, 2], [7, 3]]) assert.equal(R.plateauHeight(P.x0 + (c + 0.5) * BLOCK_M, P.z0 + (r + 0.5) * BLOCK_M), L.upper, `(${c},${r}) the upper tier`);
  assert.equal(R.plateauHeight(318.4, 400), L.city, 'the lane inside the main gate');
  assert.equal(R.plateauHeight(SOLITUDE.castle.x, SOLITUDE.castle.z), L.upper, 'Castle Dour\'s yard on the upper tier');
  // a cell's edge reads the cell south of it: the step is the upper block's own edge cell (the retaining wall's body)
  assert.equal(R.plateauHeight(150, R.SOLITUDE_TERRACES.line.z), L.city);
  assert.equal(R.plateauHeight(150, R.SOLITUDE_TERRACES.line.z - CELL), L.upper);
  // the lane's stair and the castle's west ramp climb between them
  const N = R.SOLITUDE_LANE, mid = R.plateauHeight(315, (N.stairTop + N.stairFoot) / 2);
  assert.ok(mid > L.city + 2 && mid < L.upper - 2, `the lane's stair ${mid}`);
  const C = R.SOLITUDE_CRAG, ramp = R.plateauHeight(C.x - C.half + 4, C.z);
  assert.ok(ramp > L.city && ramp < L.upper, `the west gate's ramp ${ramp}`);
  // the docks: the quay, the ledge and the causeway falling from the north gate's landing, the hairpin between
  const D = R.SOLITUDE_DOCKS;
  assert.equal(R.solitudeHeight(200, -150), L.quay);
  assert.equal(R.solitudeHeight(250, -115.2), L.upper, 'the north gate\'s landing on the upper tier');
  assert.equal(R.solitudeHeight(D.hairpin.x0 + 4, -125), D.hairpin.h);
  assert.equal(R.solitudeHeight(D.lower.x1, -130), L.quay, 'the causeway comes down to the quay');
  // each deck flat across: its two rows are the terrain's sample lines, the same height on both - the deck's - read at the
  // vertices' own metres (capitalRelief.js reliefVertexAt), float's error and all; the quay's from its sea edge to the decks
  const vAt = (x, z) => R.solitudeHeight(...reliefVertexAt(CAPITAL_RELIEFS.solitude, Math.round((x - P.x0) / CELL), 128 - Math.round((z - P.z0) / CELL)));
  for (let x = D.x0; x <= D.x1 + 1e-9; x += CELL) for (const z of [D.edge, D.back - CELL]) assert.equal(vAt(x, z), L.quay, `the quay's vertex at ${x.toFixed(1)},${z}`);
  for (const deck of [D.upper, D.lower]) {
    for (const z of [deck.z0, deck.z1]) assert.ok(near((z - P.z0) / CELL, Math.round((z - P.z0) / CELL), 1e-9), `a deck's edge ${z} on a sample row`);
    for (let x = deck.x0; x <= deck.x1 + 1e-9; x += CELL) {
      assert.equal(R.solitudeHeight(x, deck.z0), R.solitudeHeight(x, deck.z1));
      assert.ok(near(vAt(x, deck.z0), R.docksHeight(x, (deck.z0 + deck.z1) / 2), 1e-9) && near(vAt(x, deck.z1), vAt(x, deck.z0), 1e-9), `the deck's vertices at ${x.toFixed(1)}`);
    }
    const grade = Math.abs(deck.h1 - deck.h0) / (deck.x1 - deck.x0);
    assert.ok(grade <= 0.135, `its grade ${grade.toFixed(3)} a road's`);
  }
  // inside the docks' square no ground is the sea's - between the samples too, where the models read it
  for (let x = D.x0; x <= D.x1; x += CELL / 4) for (let z = D.edge; z < D.top; z += CELL / 4) assert.ok(R.solitudeHeight(x, z) >= L.quay, `the docks at ${x},${z}`);
  // the cliffs: the Karth west of the city and the sea north of it the water's, the city's edges on its tiers
  assert.equal(R.solitudeHeight(-80, 0), 0, 'the Karth under the arch');
  assert.equal(R.solitudeHeight(40, -200), 0, 'the sea north of the city');
  assert.equal(R.solitudeHeight(-4, 0), L.upper, 'the west cliff\'s top outside the wall');
  assert.equal(R.solitudeHeight(40, -108.8), L.upper, 'the north cliff\'s top');
  // the east cliff falls to the country's own height (the pixel's east edge), not to the sea, south of the headland's neck
  assert.ok(Math.abs(R.solitudeHeight(608, 409.6) - 43) < 0.5, `the east cliff's foot at the country ${R.solitudeHeight(608, 409.6)}`);
  assert.equal(R.solitudeHeight(608, -200), 0, 'the sea north of the neck');
  for (let x = P.x0; x <= P.x0 + P.side; x += 12.8) for (let z = P.z0; z <= P.z0 + P.side; z += 12.8) assert.ok(R.solitudeHeight(x, z) >= 0);
  // the cliffs clear of the walls: every wall's outer face stands on its own tier's ground
  const W = SOLITUDE.wall;
  for (let x = W.west; x <= W.east; x += 6.4) assert.ok(R.solitudeHeight(x, W.north - W.thick / 2) >= L.upper - 1e-9 || R.inDocks(x, W.north - W.thick / 2), `the north wall's face at ${x}`);
  for (let z = W.north; z <= W.south; z += 6.4) assert.ok(R.solitudeHeight(W.west - W.thick / 2, z) >= L.city - 1e-9, `the west wall's face at ${z}`);
  for (let z = W.north; z <= W.south; z += 6.4) assert.equal(R.solitudeHeight(W.east + W.thick / 2, z), L.upper, `the east wall's face at ${z}`);
});

test('SOLITUDE-RELIEF the Gate Road and the slope below the walls: the road runs on from where the country\'s road ends at the pixel\'s south edge, heading as it came, climbs at a road\'s grade and never falls, flat across, and comes square into the main gate on the gate\'s own line, the gate\'s width, on through its passage; the slope falls from each tier to the country at the pixel\'s south edge', () => {
  const pts = R.gateRoadPoints, line = R.gateRoadLine, G = R.SOLITUDE_GATE_ROAD, W = SOLITUDE.wall;
  assert.deepEqual(pts.map((p) => p.slice(0, 2)), line.map((p) => [...p]), 'its points its line\'s');
  // where the country's road ends (world/tamrielRoads.js: the gate pixel's step north ends at the pixel's middle column)
  assert.deepEqual(pts[0].slice(0, 2), [P.x0 + P.side / 2, P.z0 + P.side], 'from the pixel\'s south edge\'s middle');
  assert.ok(near(pts[0][2], R.southSlope(...pts[0].slice(0, 2)), 1e-9), 'at the land\'s own height there');
  // heading as the country's road came, north, out past the edge band
  const band = P.z0 + P.side - R.SOLITUDE_EDGE_BAND * CELL;
  for (const p of pts.filter(([, z]) => z >= band - 4)) assert.equal(p[0], P.x0 + P.side / 2, `due north from the edge at ${p[1]}`);
  // never falling, never steeper than its grade, the gate's level at the most
  for (let i = 1; i < pts.length; i++) {
    const g = (pts[i][2] - pts[i - 1][2]) / Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    assert.ok(g >= 0 && g <= G.grade + 1e-9, `leg ${i} at ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}: ${g.toFixed(3)}`);
    assert.ok(pts[i][2] <= L.city);
  }
  // square into the gate: its last straight run on the gate's own middle line, due north, at the gate's level, through
  // its passage - and as wide as the gate
  const last = pts.filter(([x]) => x === W.southGate);
  assert.ok(last.length >= 3 && last.at(-1)[1] - 0 <= W.south - W.thick / 2 && last[0][1] - W.south >= 15, `the last run ${last.map((p) => p[1])}`);
  assert.ok(last.every((p) => p[2] === L.city), 'at the gate\'s level');
  assert.ok(near(2 * G.half, W.gate, 1e-9), 'the gate\'s width');
  // no bend tighter than a cart turns, every run's direction turned smoothly (15 degrees a point at the most)
  for (let i = 1; i + 1 < line.length; i++) {
    const a = Math.atan2(line[i][1] - line[i - 1][1], line[i][0] - line[i - 1][0]), b = Math.atan2(line[i + 1][1] - line[i][1], line[i + 1][0] - line[i][0]);
    assert.ok(Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) <= Math.PI / 12 + 1e-9, `a turn at ${line[i]}`);
  }
  // flat across: on its line and a half-width either side the same height (south of the wall's slope's top)
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, z, h] = pts[i];
    if (z <= R.SOLITUDE_CLIFFS.south) continue;
    assert.ok(near(R.southHeight(x, z), h, 1e-6), `on its line at ${x},${z}`);
  }
  // the slope's top each tier's - the Well District's and the lane west of the spur, the castle's south yard east of it
  assert.equal(R.southSlope(100, R.SOLITUDE_CLIFFS.south), L.city);
  assert.equal(R.southSlope(450, R.SOLITUDE_CLIFFS.south), L.upper);
  assert.ok(near(R.southSlope(300, P.z0 + P.side), 16 + (8 * 44) / 51.2, 1e-6), 'the country\'s own height at the south edge (the design line, between its 256 m and 307.2 m points)');
  assert.ok(G.half > 0 && G.shoulder > G.half);
  assert.equal(W.southGate, R.SOLITUDE_MAIN_GATE.x, 'the gate where the road\'s law stands it');
});

test('SOLITUDE-RELIEF the country\'s road reaches the city\'s own ground: its approach (ROAD-FOLLOW, world/capitalApproaches.js) the Gate Road\'s own line - the road\'s surface from where the country\'s road ends at the pixel\'s edge, over its rim, to the main gate\'s passage, no tree on it, never a block of its own; its rim no more than its relief\'s edge band; the paving on the ground the terrain draws', async () => {
  const { LOCATION_TYPES: T } = await import('../../src/formats/mapsFile.js');
  const { capitalRimTiles, inCapitalRim, CAPITAL_RIM_TILES, capitalDims, capitalGates, planCell } = await import('../../src/world/tamrielCapitals.js');
  const { onCapitalApproach, capitalApproachCells, capitalArrival, APPROACH_TILE } = await import('../../src/world/capitalApproaches.js');
  const k = CAPITALS.indexOf(sol), dims = capitalDims(sol), on = onCapitalApproach(sol, dims), W = SOLITUDE.wall;
  // where the road's arm ends (world/tamrielRoads.js: the gate pixel's step north, at its side's middle) its approach begins
  assert.deepEqual(capitalGates(k, { walkable: () => true }).map((g) => g.side), ['S']);
  const start = capitalArrival(sol, dims, 'S');   // its anchor's metres
  assert.deepEqual(start, R.gateRoadLine[0].slice(), 'the Gate Road from the arm\'s end');
  // the approach the Gate Road's line, every metre of it from the edge to the gate's passage, and none past either
  for (const [x, z] of R.gateRoadLine) assert.equal(on(x, z), z >= W.south - W.thick / 2 - 0.5, `on its line at ${x.toFixed(1)},${z.toFixed(1)}`);
  assert.ok(!on(start[0], start[1] + 3), 'none past the span\'s edge');
  assert.ok(!on(W.southGate, W.south - W.thick), 'none past the gate\'s passage - the city\'s own street');
  assert.ok(!on(W.southGate - 30, W.south + 30) && !on(140, 480), 'none off its line');
  const cells = capitalApproachCells(sol, dims), [ax, ar] = sol.anchor;
  for (const [r, c] of cells) assert.equal(planCell(sol, r, c), 'G', `the approach over gardens alone (${r},${c})`);
  // every cell its line crosses - the switchback's too, off a straight approach's rectangle
  const crossed = new Set(R.gateRoadLine.filter(([x, z]) => on(x, z) && z < P.z0 + P.side).map(([x, z]) => `${Math.floor(z / BLOCK_M + ar)},${Math.floor(x / BLOCK_M + ax)}`));
  const got = new Set(cells.map(([r, c]) => `${r},${c}`));
  assert.ok(crossed.size >= 2 && [...crossed].every((c) => got.has(c)), `the cells its line crosses: ${[...crossed]} of ${[...got]}`);
  assert.equal(APPROACH_TILE, 46, 'the road\'s own surface');
  // its rim its relief's band and a tile: the country's road painted on the land's own tiles there, the city's own past it
  assert.equal(capitalRimTiles(sol), R.SOLITUDE_EDGE_BAND + 1);
  assert.ok(CAPITALS.filter((c) => c !== sol).every((c) => capitalRimTiles(c) === CAPITAL_RIM_TILES));
  assert.ok(inCapitalRim(sol, 409.6, 8 * BLOCK_M - 25.5) && !inCapitalRim(sol, 409.6, 8 * BLOCK_M - 25.7), 'its south rim 25.6 m');
  const loc = synthesizeCapitalLocation({ cap: sol, k }, { base: { name: 'B', regionIndex: 1, mapTableData: { mapId: 9, locationType: T.TownCity }, exterior: { exteriorData: { width: 8, height: 8 }, buildings: [] } }, names: new Map([['RESI', ['RESIAA00.RMB']]]), blockOf: () => ({ rmbBlock: { fldHeader: { numBlockDataRecords: 0, buildingDataList: [] } } }), px: 1, py: 1 });
  assert.deepEqual({ ...loc.capital.rim }, { W: 4, E: 4, N: 4, S: 4 }, 'the location\'s rect four tiles in on every side');
  // the paving from the band's last row: its south end within a cell of the painted road's end, never in the band
  const wall = buildSolitudeWall(), band = P.z0 + P.side - R.SOLITUDE_EDGE_BAND * CELL;
  let south = -Infinity;
  for (let i = 0; i < wall.positions.length; i += 3) {
    const x = wall.positions[i], z = wall.positions[i + 2];
    if (Math.abs(x - (P.x0 + P.side / 2)) < 12 && z > 470) south = Math.max(south, z);
  }
  assert.ok(south <= band + 1e-6 && south >= band - CELL, `the paving's south end ${south}`);
  // the paving on the ground the terrain draws, a hand over it, across its whole width - never under it where the ground
  // creases (an embankment's crest), never floating
  const D = solitudeDrawn(), G = R.SOLITUDE_GATE_ROAD, line = R.gateRoadLine.filter(([, z]) => z < band - 2 && z > SOLITUDE.wall.south + 4);
  for (const [i, [x, z]] of line.entries()) {
    if (i % 4) continue;
    const at = i + 1 < line.length ? line[i + 1] : line[i - 1], l = Math.hypot(at[0] - x, at[1] - z), n = [-(at[1] - z) / l, (at[0] - x) / l];
    for (const s of [-0.75, -0.3, 0, 0.3, 0.75]) {
      const px = x + n[0] * G.half * s, pz = z + n[1] * G.half * s, g = levelY(D.at(px, pz));
      let top = null;
      for (let y = g + 1; y > g - 1 && top == null; y -= 0.02) if (crosses(wall, [px, y, pz], [px, y - 0.02, pz])) top = y;
      assert.ok(top != null && top >= g && top <= g + 0.3, `the paving at ${px.toFixed(1)},${pz.toFixed(1)}: ${top} over ${g.toFixed(2)}`);
    }
  }
  // the road's banks the ground's, not a cliff's rock
  const rock = buildSolitudeCliffs();
  for (let i = 0; i < rock.positions.length; i += 3) assert.ok(R.gateRoadAt(rock.positions[i], rock.positions[i + 2]).d >= G.half + G.shoulder - 2, `rock on the road's bank at ${rock.positions[i].toFixed(1)},${rock.positions[i + 2].toFixed(1)}`);
});

test('SOLITUDE-RELIEF the pixel stands on it: the city flattened to the Well District\'s level, every vertex the relief\'s height, the sea\'s where its water is, the land\'s own along the pixel\'s edge, eased in over the band', () => {
  assert.equal(reliefOf({ capital: { flattenAt: { relief: 'solitude' } } }), CAPITAL_RELIEFS.solitude);
  assert.equal(reliefOf({ capital: { flattenAt: { sea: true } } }), null);
  assert.equal(reliefOf({}), null);
  const flat = reliefFlat('solitude');
  assert.ok(near(flat.avg * M - SEA, L.city, 1e-3) && flat.classic === flat.avg, 'the flatten its streets\' level');
  const natural = new Float32Array(H * H).fill(reliefSample(30)), S = Float32Array.from(natural);
  capitalReliefGround(S, natural, 'solitude');
  const r = CAPITAL_RELIEFS.solitude, at = (x, y) => S[x * H + y] * M - SEA;
  for (const [x, y] of [[64, 64], [40, 40], [100, 90], [20, 100], [70, 103], [60, 98]]) {
    const [ax, az] = reliefVertexAt(r, x, y), want = R.solitudeHeight(ax, az);
    assert.ok(Math.abs(at(x, y) - (want <= 1e-3 ? 0 : want)) < 0.01, `vertex ${x},${y} (${ax.toFixed(1)}, ${az.toFixed(1)}): ${at(x, y)} for ${want}`);
  }
  // the edge the land's own, the band eased between
  for (let k = 0; k <= 128; k += 16) for (const [x, y] of [[0, k], [128, k], [k, 0], [k, 128]]) assert.ok(Math.abs(at(x, y) - 30) < 0.01, `the edge ${x},${y}`);
  const [bx, bz] = reliefVertexAt(r, 64, 1), mix = at(64, 1);
  assert.ok(mix > Math.min(30, R.solitudeHeight(bx, bz)) - 0.01 && mix < Math.max(30, R.solitudeHeight(bx, bz)) + 0.01, 'the band between');
  // never under the sea, and at it exactly where the relief is the water's (the sheet level, the carve's)
  for (const v of S) assert.ok(v * M >= SEA - 1e-3);
  let wet = 0;
  for (let x = r.band; x <= 128 - r.band; x++) for (let y = r.band; y <= 128 - r.band; y++) if (R.solitudeHeight(...reliefVertexAt(r, x, y)) <= 1e-3) { wet++; assert.equal(S[x * H + y], Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT)); }
  assert.ok(wet > 1000, `${wet} vertices of the sea`);
});

test('SOLITUDE-RELIEF the terrain job lays it: a capital flattened with its relief named stands at its streets\' level, every vertex on the relief and the sea\'s where it is - never the sea capital\'s two heights', () => {
  const woods = new WoodsFile();
  assert.equal(woods.load(syntheticWoodsBytes()), true);
  const job = (flattenAt) => generatePixelTerrain({ woods, px: 400, py: 200, tilemap: new Uint8Array(128 * 128), locationRect: { xMin: 11, xMax: 117, yMin: 11, yMax: 117 }, hasLocation: true, climateType: 0, flattenAt });
  const g = job({ px: 400, py: 200, sea: true, relief: 'solitude' }), r = CAPITAL_RELIEFS.solitude;
  assert.equal(g.avg, reliefFlat('solitude').avg, 'its streets\' level, the flatten its blocks stand on');
  for (const [x, y] of [[64, 64], [40, 40], [100, 90], [20, 100], [70, 103], [30, 64]]) {
    const want = R.solitudeHeight(...reliefVertexAt(r, x, y)), got = g.samples[x * H + y] * M - SEA;
    assert.ok(Math.abs(got - want) < 0.01, `vertex ${x},${y}: ${got} for ${want}`);
  }
  assert.notEqual(job({ px: 400, py: 200, sea: true }).avg, g.avg, 'a sea capital\'s land a metre over the sea');
});

test('SOLITUDE-RELIEF the hosts\' wiring: every block built on its tier - its models, its doors, its people, its flats and its lights; the walk grid shut where the relief\'s works stand; the fabric on its blocks\' tiers; the festival\'s floor each block\'s', () => {
  const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const pb = rd('src/scenes/pixelBuild.js');
  assert.ok(pb.includes('const blockY = locLocal[1] + capitalBlockLift(dfLocation, b.x, b.y);'), 'a block\'s tier');
  assert.ok(pb.includes('locLocal[0] + b.originX, blockY, locLocal[2] + b.originZ, 0, 0, 0);'), 'its models');
  assert.ok(pb.includes('y: blockY + npc.y + fabricLift(fabric, b.originX + npc.x, b.originZ + npc.z),'), 'its people');   // PIN MOVED (AUDIT PROP-GROUND): on the street its fabric lays
  assert.ok(pb.includes('blockY + light.y,'), 'its lights');
  assert.ok(pb.includes(': flat.archive === natureArchive ? locLocal[1] + flat.y + off : blockY + flat.y + lift;'), 'its flats, a tree on the drawn ground');   // PIN MOVED (AUDIT PROP-GROUND): `lift` its street's
  assert.ok(pb.includes('floorAt: dfLocation?.capital && locOrigin ? (x, z) => witchFloor + capitalBlockLift(dfLocation, Math.floor((x - locOrigin[0]) / RMB_SIDE), Math.floor((z - locOrigin[2]) / RMB_SIDE)) : null,'), 'the festival');
  assert.ok(rd('src/world/townWalls.js').includes('if (relief) shutRelief(nav, relief);'), 'the walk grid');
  assert.ok(rd('src/world/urban/townFabricStand.js').includes('const lift = CAPITALS[dfLocation.capital?.k]?.lift ? (bx, by) => capitalBlockLift(dfLocation, bx, by) : null;'), 'the fabric');
});

test('SOLITUDE-RELIEF its tiles: the sea only where all four corners are the water\'s, a cliff\'s rock where its corners climb, its own blocks\' paving and its gardens\' grass; every lake cell its own block on the relief', () => {
  const T = R.SOLITUDE_TILES;
  assert.equal(R.solitudeGroundTile(-80, 0), T.water);
  assert.equal(R.solitudeGroundTile(200, -150), T.stone, 'the quay');
  assert.equal(R.solitudeGroundTile(100, 480, T.grass), T.grass, 'a garden on the slope below the south wall');
  // a cliff's cell is the rock
  let rock = 0;
  for (let x = -40; x < 0; x += CELL) if (R.solitudeGroundTile(x + CELL / 2, 3.2) === T.rock) rock++;
  assert.ok(rock >= 1, 'the west cliff\'s rock');
  // the water never where a corner stands over the sea
  for (let x = P.x0 + CELL; x < P.x0 + P.side; x += CELL * 3) {
    for (let z = P.z0 + CELL; z < P.z0 + P.side; z += CELL * 3) {
      if (R.solitudeGroundTile(x, z) !== T.water) continue;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(R.solitudeHeight(x + (dx * CELL) / 2, z + (dz * CELL) / 2) <= 1e-3);
    }
  }
  // every lake cell of Solitude's plan its own block, laid on its relief
  const k = CAPITALS.indexOf(sol), names = capitalBlockNames(SOLITUDE_PLAN, k, new Map([['RESI', ['RESIAA00.RMB']]]), undefined, [0, 0]);
  SOLITUDE_PLAN.forEach((row, r) => row.forEach((cell, c) => { if (cell === 'L') assert.equal(names[(7 - r) * 8 + c], capitalLakeName(sol, c, r), `(${c},${r})`); }));
  const blocks = capitalPortBlocks(), lake = blocks.find((b) => b.name === capitalLakeName(sol, 1, 3));
  const tiles = lake.json.RmbBlock.FldHeader.GroundData.GroundTiles.map((t) => t.TileBitfield);
  assert.ok(tiles.includes(T.water) && tiles.includes(T.rock), 'the Karth\'s water and the west cliff\'s rock in one lake cell');
  // a garden's cliff no walker's ground: every automap cell of its rock closed, its rim's aside
  let shut = 0;
  SOLITUDE_PLAN.forEach((row, r) => row.forEach((cell, c) => {
    if (cell !== 'G') return;
    const A = blocks.find((b) => b.name === capitalGardenName(sol, c, r)).json.RmbBlock.FldHeader.AutoMapData;
    for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) {
      const [x, z] = autoCentre(ax, ay), [dx, dz] = anchorMetres(sol, c, r, x, z);
      if (inCapitalRim(sol, c * BLOCK_M + x, (r + 1) * BLOCK_M - z) || R.solitudeGroundTile(dx, dz, T.grass) === T.grass) continue;
      shut++;
      assert.equal(A[ay * 64 + ax], CAPITAL_CLOSED_BYTE, `the garden (${c},${r}) at ${dx.toFixed(1)},${dz.toFixed(1)}: its rock closed`);
    }
  }));
  assert.ok(shut > 1000, `${shut} cells of the gardens' rock`);
  // the Gate Road through the gardens: its tiles the road's own surface under its paving (ROAD-FOLLOW's approach), no tree on it
  let road = 0;
  SOLITUDE_PLAN.forEach((row, r) => row.forEach((cell, c) => {
    if (cell !== 'G') return;
    const g = blocks.find((b) => b.name === capitalGardenName(sol, c, r)).json.RmbBlock.FldHeader.GroundData;
    for (let i = 0; i < 256; i++) {
      const [x, z] = tileCentre(i % 16, Math.floor(i / 16)), [dx, dz] = anchorMetres(sol, c, r, x, z);
      if (inCapitalRim(sol, c * BLOCK_M + x, (r + 1) * BLOCK_M - z) || R.gateRoadAt(dx, dz).d > R.SOLITUDE_GATE_ROAD.half || dz < SOLITUDE.wall.south - 3) continue;
      road++;
      assert.equal(g.GroundTiles[i].TileBitfield, 46, `the road's tile at ${dx.toFixed(1)},${dz.toFixed(1)}`);   // ROAD-FOLLOW's approach: the road's surface
      assert.equal(g.GroundScenery[i].TextureRecord, -1, `no tree on the road at ${dx.toFixed(1)},${dz.toFixed(1)}`);
    }
  }));
  assert.ok(road > 40, `${road} tiles of the road`);
});

test('SOLITUDE-RELIEF its blocks\' tiers: every classic block of the upper tier stands 6 m over the location\'s flatten, the Well District\'s on it, its own blocks, gardens and water on it (their ground and models the relief\'s); no other capital, no other town lifted', () => {
  const loc = (k) => ({ capital: { k, s: 0 }, exterior: { exteriorData: { width: 8, height: 8 } } }), k = CAPITALS.indexOf(sol);
  const want = SOLITUDE_PLAN.map((row, r) => row.map((cell, c) => (/^(L|G|P\d|Q\d|D\d)$/.test(cell) || (r >= 5 && c >= 2 && c <= 4) ? 0 : L.upper - L.city)));
  const got = SOLITUDE_PLAN.map((row, r) => row.map((_, c) => capitalBlockLift(loc(k), c, 7 - r)));
  assert.deepEqual(got, want);
  assert.equal(got.flat().filter((v) => v > 0).length, 13, 'the Avenues\' ten, the north-east\'s two and the Temple');
  for (const c of CAPITALS) if (c !== sol) assert.equal(capitalBlockLift(loc(CAPITALS.indexOf(c)), 3, 3), 0, c.key);
  assert.equal(capitalBlockLift({ exterior: { exteriorData: { width: 8, height: 8 } } }, 3, 3), 0, 'a town of the Bay');
});

test('SOLITUDE-RELIEF its start markers stand on their tiers: a marker carries its street\'s height over the flatten (the arrival refuses a floor over 3 m above its marker)', () => {
  assert.equal(startMarkerAt(10, 20).YPos, 0);
  assert.equal(startMarkerAt(10, 20, 6).YPos, -240);
  const carrier = capitalPortBlocks().find((b) => b.name === 'TESASOP0.RMB'), flats = carrier.json.RmbBlock.MiscFlatObjectRecords;
  assert.equal(flats.length, sol.markers.length);
  for (const [i, [dx, dz, h = 0]] of sol.markers.entries()) {
    const ground = R.solitudeHeight(dx, dz);
    assert.ok(Math.abs(L.city + h - ground) < 0.01, `marker ${i} at ${dx},${dz}: ${L.city + h} on ${ground}`);
    assert.equal(flats[i].YPos, h ? -Math.round(h / 0.025) : 0);
  }
});

test('SOLITUDE-RELIEF the arch, the stack and the palace: the deck from the stack\'s top to the terrace, the opening clear over the water between its springs to its crown, the stack from under the water to the palace\'s floor, the palace on it, its door to the arch, its spire the city\'s highest', () => {
  const A = SOLITUDE.arch, st = SOLITUDE.stack, arch = buildSolitudeArch();
  sane(arch);
  assert.equal(archTop(A.from), L.stack);
  assert.equal(archTop(A.to), L.terrace);
  assert.equal(archOpening(A.springW), 0);
  assert.equal(archOpening(A.springE), 0);
  assert.ok(near(archOpening((A.springW + A.springE) / 2), A.crown, 1e-9));
  // nothing of the arch in its opening, over the water between its springs
  for (let t = 0; t < arch.indices.length; t += 3) {
    const c = [0, 1, 2].map((a) => (arch.positions[arch.indices[t] * 3 + a] + arch.positions[arch.indices[t + 1] * 3 + a] + arch.positions[arch.indices[t + 2] * 3 + a]) / 3);
    const stack = Math.hypot(c[0] - st.x, c[2] - st.z) < st.foot + 8;   // the stack's foot, its flank the opening's west side
    const inside = !stack && c[0] > A.springW + 6 && c[0] < A.springE - 6 && Math.abs(c[2]) < A.w / 2 + 4 && c[1] > levelY(0) + 0.5 && c[1] < levelY(archOpening(c[0])) - 2.5;
    assert.ok(!inside, `a face in the opening at ${c.map((v) => v.toFixed(1))}`);
  }
  // a boat passes under it, a walker over it
  const mx = (A.springW + A.springE) / 2;
  assert.equal(crosses(arch, [mx, levelY(4), -60], [mx, levelY(4), 60]), false, 'the water open under its crown');
  assert.equal(crosses(arch, [mx, levelY(archTop(mx)) + 3, 0], [mx, levelY(archTop(mx)) - 0.5, 0]), true, 'its deck under a walker');
  const ab = bounds(arch);
  assert.ok(ab.lo[1] <= levelY(-10), 'its feet and the stack\'s under the water');
  assert.ok(ab.hi[0] >= SOLITUDE.landing.stairTo - 1e-6, 'to the terrace stair\'s foot');
  const pal = buildBluePalace();
  sane(pal);
  const pb = bounds(pal);
  assert.ok(pb.lo[1] >= levelY(st.top) - 3.01, 'on the stack\'s top (its turrets\' drums sunk into it)');
  assert.ok(pb.lo[0] >= st.x - st.r && Math.max(-pb.lo[2], pb.hi[2]) <= st.r + 0.6, 'within it');
  assert.equal(pal.doors.length, 1, 'WW7-4: the palace\'s halls behind its door');
  assert.ok(pal.doors[0].normal.x > 0.99 && pal.doors[0].vert0.y >= levelY(st.top) - 1e-6, 'its door to the arch on its floor');
  for (const m of [buildSolitudeWall(), buildCastleDour(), buildSolitudeDocks(), buildSolitudeTerraces()]) assert.ok(pb.hi[1] > bounds(m).hi[1], 'the palace\'s spire the highest');
});

test('SOLITUDE-RELIEF the walls on their tiers and their cliffs: the north and east and the west\'s upper reach on the upper tier, the west\'s lower reach and the south\'s to the lane on the Well District\'s, sunk into the cliffs they stand on; the gates open at their streets\' levels; the main gate\'s storey', () => {
  const W = SOLITUDE.wall, wall = buildSolitudeWall(), up = levelY(L.upper);
  sane(wall);
  const top = (x, z) => { for (let y = 40; y > -30; y -= 0.25) if (crosses(wall, [x - 0.01, y, z - 0.01], [x + 0.01, y - 0.25, z + 0.01])) return y; return null; };
  // its wall-walk on its middle line (the merlons on its outer edge)
  assert.ok(near(top(150, W.north), up + W.h, 0.3), `the north wall on the upper tier (${top(150, W.north)})`);
  assert.ok(near(top(W.east, 100), up + W.h, 0.3), 'the east wall');
  assert.ok(near(top(W.west, 120), up + W.h, 0.3), 'the west wall\'s upper reach');
  assert.ok(near(top(W.west, 330), W.h, 0.3), 'its lower reach');
  assert.ok(near(top(100, W.south), W.h, 0.3), 'the south wall by the Well District');
  assert.ok(near(top(450, W.south), up + W.h, 0.3), 'the south wall by the castle\'s south yard');
  // the gates open at their streets' levels, their lintels over them
  assert.equal(crosses(wall, [W.northGate, up + W.gateH / 2, W.north - 6], [W.northGate, up + W.gateH / 2, W.north + 6]), false, 'the north gate at the upper tier');
  assert.equal(crosses(wall, [W.northGate, up + (W.gateH + W.h) / 2, W.north - 6], [W.northGate, up + (W.gateH + W.h) / 2, W.north + 6]), true);
  assert.equal(crosses(wall, [W.southGate, W.gateH / 2, W.south - 6], [W.southGate, W.gateH / 2, W.south + 6]), false, 'the main gate at the Well District\'s');
  assert.equal(crosses(wall, [W.southGate, W.h + 3, W.south - 6], [W.southGate, W.h + 3, W.south + 6]), true, 'its gatehouse\'s storey');
  assert.equal(crosses(wall, [W.west - 6, up + 6, 0], [W.west + 6, up + 6, 0]), false, 'the arch\'s gap open');
  // sunk into the cliffs: the north wall's face reaches under its cliff's top by its sink
  assert.ok(bounds(wall).lo[1] <= up - W.cliffSink.north + 1e-6);
});

test('SOLITUDE-RELIEF Castle Dour on the upper tier: its curtain from the lane to its walk, its west gate at the lane\'s level with the ramp inside, its north gate level with the upper tier\'s court, the Emperor\'s Tower its top', () => {
  const C = SOLITUDE.castle, cd = buildCastleDour(), up = levelY(L.upper);
  sane(cd);
  assert.equal(crosses(cd, [C.x - C.half - 5, C.gateH / 2, C.z], [C.x - C.half + 5, C.gateH / 2, C.z]), false, 'the west gate open at the lane');
  assert.equal(crosses(cd, [C.x - C.half - 5, C.gateH / 2, C.z + 20], [C.x - C.half + 5, C.gateH / 2, C.z + 20]), true, 'walled beside it');
  assert.equal(crosses(cd, [C.x, up + C.gateH / 2, C.z - C.half - 5], [C.x, up + C.gateH / 2, C.z - C.half + 5]), false, 'the north gate open at the upper tier');
  assert.equal(crosses(cd, [C.x, up + C.gateH + 2, C.z - C.half - 5], [C.x, up + C.gateH + 2, C.z - C.half + 5]), true, 'its lintel');
  assert.ok(Math.abs(bounds(cd).hi[1] - (up + SOLITUDE.emperorsTower.h + 1.4 + SOLITUDE.emperorsTower.roof)) < 1e-4, 'the Emperor\'s Tower its top');
});

test('SOLITUDE-RELIEF the docks at the water: the warehouse and the kerb on the quay, the piers out over the sea at a deck\'s height over it, the Docks Way\'s parapets along its decks\' outer edges', () => {
  const D = SOLITUDE.docks, q = levelY(L.quay), docks = buildSolitudeDocks();
  sane(docks);
  const db = bounds(docks);
  assert.ok(near(db.lo[2], D.pierTo, 1e-6), 'out to the piers\' ends');
  assert.ok(db.lo[1] <= levelY(-3.9), 'the piers\' posts in the sea');
  assert.equal(crosses(docks, [D.piers[0], q + D.deck + 1, -200], [D.piers[0], q + D.deck - 1, -200]), true, 'a pier\'s deck at its height');
  const H = D.warehouse;
  assert.ok(H.z - H.d / 2 >= D.edge && H.z + H.d / 2 <= R.SOLITUDE_DOCKS.back - CELL, 'the warehouse on the quay, clear of the causeway\'s wall');
  assert.equal(crosses(docks, [H.x, q + 2, H.z - 20], [H.x, q + 2, H.z]), true, 'the warehouse stands on the quay');
  // the ledge's parapet follows its deck down
  const U = R.SOLITUDE_DOCKS.upper;
  for (const x of [100, 160, 220]) {
    const deck = levelY(R.solitudeHeight(x, U.z0)), z = U.z0 + 0.5;
    assert.equal(crosses(docks, [x, deck + 0.8, z - 2], [x, deck + 0.8, z + 2]), true, `the ledge's parapet at ${x}`);
    assert.equal(crosses(docks, [x, deck + 2.5, z - 2], [x, deck + 2.5, z + 2]), false, 'a parapet\'s height');
  }
});

test('SOLITUDE-RELIEF the terraces\' works: the retaining wall\'s top the upper tier\'s along the Well District\'s north edge, its stairs walkable (no step over 0.5 m) from the Well District\'s street to a landing at its top, the lane\'s stair up to Castle Dour\'s north court, the spur', () => {
  const T = R.SOLITUDE_TERRACES, up = levelY(L.upper), m = buildSolitudeTerraces();
  sane(m);
  for (const x of [20, 90, 200, 300]) assert.equal(crosses(m, [x, up + 0.5, T.line.z - 2], [x, up - 0.5, T.line.z - 2]), true, `the wall's top at ${x}`);
  // its face from the Well District's street to the upper tier, wherever no stair climbs it
  for (const x of [20, 100, 200, 300]) for (const y of [0.5, up / 2, up - 0.5]) assert.equal(crosses(m, [x, y, T.line.z + 1.5], [x, y, T.line.z - 1]), true, `its face at ${x}, ${y} m`);
  // its parapet on its top alone: nothing inside the wall's body behind its face (a face doubled on the face flickers)
  for (const x of [20, 100, 200, 300]) assert.equal(crosses(m, [x, up / 2, T.line.z + 0.3], [x, up / 2, T.line.z - 0.5]), false, `the wall's body hollow at ${x}`);
  // each stair: the height under a walker's feet along it never steps more than the walk's 0.5 m
  const floorAt = (x, z) => { for (let y = up + 2; y > -2; y -= 0.05) if (crosses(m, [x, y, z], [x, y - 0.05, z])) return y - 0.025; return null; };
  for (const [a, b] of T.stairs) {
    const z = T.line.z + 0.4 + T.stairW / 2;
    let last = floorAt(a - 0.5, z) ?? 0;
    for (let x = a + 0.05; x <= b + T.stairW / 2; x += 0.25) {
      const f = floorAt(x, z);
      assert.ok(f != null && f - last <= 0.5 + 0.06, `the stair ${a}-${b} at ${x}: ${last} to ${f}`);
      last = f;
    }
    assert.ok(Math.abs(last - up) < 0.1, 'its landing at the top');
  }
  const N = R.SOLITUDE_LANE, lx = (N.x0 + N.x1) / 2 - 2;
  let last = 0;
  for (let z = N.stairFoot + 0.5; z >= N.stairTop - 1; z -= 0.25) { const f = floorAt(lx, z) ?? last; assert.ok(f - last <= 0.56, `the lane's stair at ${z}`); last = f; }
  assert.ok(Math.abs(last - up) < 0.1, 'the lane\'s stair to the upper tier');
  assert.equal(crosses(m, [T.spur.x, up + 0.5, (T.spur.z0 + T.spur.z1) / 2], [T.spur.x, up - 0.5, (T.spur.z0 + T.spur.z1) / 2]), true, 'the spur\'s top');
});

test('SOLITUDE-RELIEF the cliffs\' rock: over every steep cell of the ground outside the walls and clear of the pixel\'s band, never under the drawn ground, the Docks Way\'s masonry in the docks\' square; none inside the walls', () => {
  const m = buildSolitudeCliffs(), W = SOLITUDE.wall;
  sane(m);
  // the drawn ground, from the relief at the terrain's vertices (world/terrain/terrainSurface.js surfaceHeightAt's frame)
  const S = new Float32Array(H * H), r = CAPITAL_RELIEFS.solitude;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) { const [ax, az] = reliefVertexAt(r, x, y), h = R.solitudeHeight(ax, az); S[x * H + y] = (SEA + h) / M; }
  const ground = (ax, az) => surfaceHeightAt(S, ax - P.x0, P.z0 + P.side - az) - SEA;
  let n = 0;
  // the model as built is the map's frame (+z south): every vertex over the drawn ground under it, or plunged under the sea
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2];
    if (x < P.x0 + CELL || x > P.x0 + P.side - CELL || z < P.z0 + CELL || z > P.z0 + P.side - CELL) continue;
    const g = levelY(ground(x, z));
    if (y < levelY(0)) continue;   // its foot plunged into the sea
    assert.ok(y >= g - 0.05 || y >= levelY(0) - 0.05, `a rock vertex under the ground at ${x.toFixed(1)},${z.toFixed(1)}: ${y.toFixed(2)} < ${g.toFixed(2)}`);
    n++;
    assert.ok(!(x > W.west + 1 && x < W.east - 1 && z > W.north + 1 && z < W.south - 1), 'none inside the walls');
  }
  assert.ok(n > 1000);
  assert.ok(m.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.rock) && m.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.nordStone), 'the rock, and the Docks Way\'s masonry');
  assert.ok(CLIFF_STEEP > 0 && CLIFF_SKIN.least > 0, 'stood off the ground');
});

test('SOLITUDE-RELIEF its walkers keep to their tiers: the retaining wall, its stairs, the lane\'s stair and the spur shut on the walk grid, the tiers either side open', () => {
  const nav = { width: 512, height: 512, grid: new Uint8Array(512 * 512).fill(16) };
  shutRelief(nav, CAPITAL_RELIEFS.solitude);
  const cell = (x, z) => { const gx = Math.floor((x - P.x0) / 1.6), gy = Math.floor((P.z0 + P.side - z) / 1.6); return nav.grid[gy * 512 + gx]; };
  const T = R.SOLITUDE_TERRACES;
  assert.equal(cell(150, T.line.z - 2), 0, 'the wall\'s body');
  assert.equal(cell(T.stairs[1][0] + 5, T.line.z + 2), 0, 'a stair');
  assert.equal(cell(315, 222), 0, 'the lane\'s stair');
  assert.equal(cell(T.spur.x, 400), 0, 'the spur');
  assert.equal(cell(150, T.line.z - 15), 16, 'the upper tier\'s street');
  assert.equal(cell(150, T.line.z + 15), 16, 'the Well District\'s');
  assert.equal(cell(318.4, 400), 16, 'the lane inside the main gate');
});

test('SOLITUDE-RELIEF the fabric on its blocks\' tiers: every piece cut at a block\'s edge and stood on its block\'s lift; a town on one ground\'s fabric as it was, to the byte', async () => {
  const { fabricPlan, FABRIC_KIND } = await import('../../src/world/urban/townFabric.js');
  void fabricPlan;
  const W = 128, Hh = 64, n = W * Hh, K = FABRIC_KIND;
  const plan = { W, H: Hh, kind: new Uint8Array(n), under: new Uint8Array(n), fences: [], gates: [], walls: [], props: [] };
  for (let x = 0; x < W; x++) for (let z = 28; z < 34; z++) plan.kind[z * W + x] = K.main;   // a street across two blocks
  for (let x = 0; x < W; x++) plan.kind[34 * W + x] = K.pave;
  const flat = townFabricModel(plan, 'nord'), same = townFabricModel(plan, 'nord', { lift: null });
  assert.deepEqual(Array.from(same.positions), Array.from(flat.positions), 'no lift: as it was');
  const lifted = townFabricModel(plan, 'nord', { lift: (bx) => (bx === 1 ? 6 : 0) });
  for (let i = 0; i < lifted.positions.length; i += 3) {
    const x = lifted.positions[i], y = lifted.positions[i + 1];
    if (x < 64 * 1.6 - 1e-3) assert.ok(y < 1, `the west block's at its ground (${x}, ${y})`);
    else if (x > 64 * 1.6 + 1e-3) assert.ok(y >= 6 - 0.05 - 1e-6, `the east block's 6 m up, a kerb's foot on its land (${x}, ${y})`);   // PIN MOVED (AUDIT PROP-GROUND): FABRIC_LAND_Y
  }
});

test('SOLITUDE-RELIEF the Witches\' Festival dresses each block\'s street at its tier (floorAt), the town\'s one floor where none is given', () => {
  // a tavern on the lower tier and a temple on the upper (test/world/witch1_decor.test.js's town, in the festival's days)
  const frame = (x, z, type) => ({ at: [x, 0, z - 5], box: [x - 5, 0, z - 10, x + 5, 6, z], rects: [], type, faction: 0, door: { a: [x - 0.6, 0, z], b: [x + 0.6, 2.4, z] } });
  const frames = new Map([[101, frame(0, 0, BUILDING_TYPES.Tavern)], [102, frame(40, 0, BUILDING_TYPES.Temple)]]);
  const base = { frames, taverns: [101], temples: [102], mapId: 7, nowMs: Date.UTC(2026, 9, 25), floorY: 3 };
  const tier = (x) => 3 + (x > 20 ? 6 : 0), a = witchesDressing(base), b = witchesDressing({ ...base, floorAt: (x) => tier(x) });
  assert.ok(a && b && a.flats.length > 4 && a.flats.length === b.flats.length, 'the town dressed');
  assert.ok(a.flats.every((f) => f.c[1] === 3) && a.sisters.every((s) => s.y === 3), 'one floor');
  assert.ok(b.flats.every((f) => f.c[1] === tier(f.c[0])) && b.sisters.every((s) => s.y === tier(s.x)), 'each spot on its own tier');
  assert.ok(b.flats.some((f) => f.c[1] === 9) && b.flats.some((f) => f.c[1] === 3), 'both tiers dressed');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('SOLITUDE-RELIEF (ARENA2): on the player\'s own files Solitude stands on its rock - its pixel\'s streets on their tiers, its quay at the water, the Karth and the sea the sea\'s own height (sailed, carved), its edge the country\'s, its blocks on their tiers', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { terrainSampleHeightAt } = await import('../../src/world/terrain/terrainSurface.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const blocks = new BlocksFile(); assert.ok(blocks.load(bytes('BLOCKS.BSA')));
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    groundMaps(maps);
    wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
    installCapitals({ addTextures: () => 0 });
    const ground = groundWoods(woods), k = tc.CAPITALS.indexOf(sol), at = tc.capitalCentrePixel(k);
    assert.ok(at, 'Solitude stands');
    const a = tc.capitalOnPixel(at.px, at.py), tm = new Uint8Array(16384);
    const loc = synthesizeCapitalLocation(/** @type {any} */ (a), { base: tc.capitalBase(rows, isMainStoryDungeon), names: tc.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm), px: at.px, py: at.py });
    assert.equal(loc.capital.flattenAt.relief, 'solitude');
    const rect = setLocationTiles(loc, maps, blocks, tm);
    const g = generatePixelTerrain({ woods: ground, px: at.px, py: at.py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
    assert.ok(Math.abs(g.avg * M - SEA - L.city) < 0.01, 'flattened to the Well District\'s level');
    const h = (ax, az) => terrainSampleHeightAt(g.samples, ax - P.x0, P.z0 + P.side - az) - SEA;
    assert.ok(Math.abs(h(100, 300) - L.city) < 0.05, `the Well District ${h(100, 300)}`);
    assert.ok(Math.abs(h(250, 0) - L.upper) < 0.05, `the Avenues ${h(250, 0)}`);
    assert.ok(Math.abs(h(200, -150) - L.quay) < 0.05, `the quay ${h(200, -150)}`);
    assert.ok(Math.abs(h(-80, 0)) < 0.05, `the Karth under the arch ${h(-80, 0)}`);
    // the hull's line (systems/comeSailAway/comeSailAway.js: under 34 m is water): the Karth sailed, the quay not
    const hull = (ax, az) => terrainSampleHeightAt(g.samples, ax - P.x0, P.z0 + P.side - az);
    assert.ok(hull(-80, 0) < 34 && hull(200, -150) > 34);
    // its own blocks' water tiles where the relief is the sea's, none on a cliff; a pond or a stream of one of Daggerfall's
    // blocks (a residence's, the graveyard's) on its block's tier, never sunk to the sea
    const names = loc.exterior.exteriorData.blockNames;
    let water = 0, wrong = 0, ponds = 0;
    for (let ty = 11; ty < 117; ty++) {
      for (let tx = 11; tx < 117; tx++) {
        if (tm[tx + ty * 128] === 0 || convertTile(tm[tx + ty * 128]) >> 2 !== 0) continue;
        const ax = P.x0 + (tx + 0.5) * CELL, az = P.z0 + P.side - (ty + 0.5) * CELL, rel = R.solitudeHeight(ax, az);
        if (/^TES/.test(names[Math.floor(ty / 16) * 8 + Math.floor(tx / 16)])) { water++; if (rel > 1e-3) wrong++; continue; }
        ponds++;
        assert.ok(Math.abs(h(ax, az) - rel) < 0.05 && rel >= L.city, `a block's pond at ${ax},${az}: ${h(ax, az)} on ${rel}`);
      }
    }
    assert.ok(water > 1000 && wrong === 0, `${water} water tiles, ${wrong} on land`);
    assert.ok(ponds > 0, 'Daggerfall\'s blocks\' own water, on their tiers');
    // the terraces' works in Daggerfall's blocks on the freeware: each stair, its landing and its walls, and the street
    // before its foot, on cells its lower block's automap holds nothing on; its head onto an upper block's edge clear too
    const T = R.SOLITUDE_TERRACES, z1 = T.line.z + 0.4, [AX, AR] = sol.anchor;
    const heldAt = (x, z) => {
      const cx = Math.floor(x / BLOCK_M + AX), r = Math.floor(z / BLOCK_M + AR), name = names[(7 - r) * 8 + cx];
      const A = blocks.getBlockByName(name).rmbBlock.fldHeader.autoMapData, lx = x - (cx - AX) * BLOCK_M, lz = z - (r - AR) * BLOCK_M;
      return A[Math.floor(lz / 1.6) * 64 + Math.floor(lx / 1.6)] !== 0 ? name : null;   // its automap's row 0 the north's
    };
    for (const [a, b] of T.stairs) {
      for (let x = a - 2.5; x <= b + T.stairW + 0.6; x += 0.4) for (let z = z1 + 0.05; z <= z1 + T.stairW + 0.6; z += 0.4) assert.equal(heldAt(x, z), null, `the stair ${a}-${b} at ${x.toFixed(1)},${z.toFixed(1)}`);
      for (let x = b; x <= b + T.stairW; x += 0.4) for (let z = T.line.z - 4; z < T.line.z; z += 0.4) assert.equal(heldAt(x, z), null, `its head onto the upper tier at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
    // its blocks on their tiers, as the build lays them
    const lay = layoutLocation(loc, maps, blocks, {});
    const lifted = lay.blocks.filter((b) => tc.capitalBlockLift(loc, b.x, b.y) > 0).map((b) => b.blockName.slice(0, 4)).sort();
    assert.deepEqual(lifted, ['ALCH', 'ARMR', 'BANK', 'BOOK', 'GEMS', 'GENR', 'GRVE', 'LIBR', 'MAGE', 'RESI', 'RESI', 'TEMP', 'TVRN']);
  } finally {
    setTamrielTrace(null); setTamrielFit(null);
  }
});

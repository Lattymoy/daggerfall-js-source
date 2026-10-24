// TESA11 (2026-10-13, the owner: "the imperial city needs to be much larger and be split into distinct districts with the
// tower very large. The entire city also needs to be lore accurate to daggerfall"; asked, "3x3 pixels" and "Canon layout,
// DF era"; bible/03-World/Arena-Provinces.md TESA11) - THE IMPERIAL CITY OVER NINE PIXELS, pinned: its plan (City Isle in
// Lake Rumare, the six districts on their sectors, Green Emperor Way, the Prison, the University, the Waterfront), its
// slices (each pixel's location, its name, id and index, its buildings' seeds, its ground flattened to the centre's), its
// pixel law over nine pixels, Arena's places off its pixels, its ground's laws, its landmarks, and the host and the kernel
// that stand it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, IMPERIAL_SECTORS, IMPERIAL_SLICE_NAMES, IMPERIAL_MIX, IMPERIAL_SIGNATURE, IMPERIAL_MODELS, IMPERIAL_CARRY,
  IMPERIAL_CITY_PLAN, IMPERIAL_DISTRICTS, IMPERIAL_BLOCKS, polar, imperialBearing, imperialLand, imperialDistrictAt, imperialReserved, imperialCode,
  imperialTile, imperialClosed, imperialTree, districtWallLines, prisonAt, universityTowerAt, colosseumGate,
} from '../src/world/imperialCity.js';
import {
  CAPITALS, CAPITAL_MODELS, BLOCK_M, capitalSpan, capitalCentre, capitalSliceOrdinal, capitalSliceName, capitalPlaceId, capitalLocationIndex, isCapitalPlaceId,
  capitalPixel, capitalOnPixel, capitalPin, capitalPortBlocks, capitalModelCarriers, capitalCarrier, synthesizeCapitalLocation, capitalBlockNames, anchorMetres,
  capitalGardenName,
} from '../src/world/tamrielCapitals.js';
import {
  buildImperialTower, buildPalaceWall, buildEmperorsTombs, buildCityWall, buildDistrictWalls, buildColosseum, buildTempleOfTheOne, buildTalosStatue,
  buildImperialPrison, buildArcaneUniversity, buildWaterfront, buildTalosBridge,
} from '../src/world/capitalImperial.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART } from '../src/world/capitalShapes.js';
import { installCapitals } from '../src/world/capitalModels.js';
import { customModelFor } from '../src/world/customModels.js';
import { isCountryPlaceId } from '../src/world/tamrielCountry.js';
import { standArenaPixels } from '../src/world/arenaPlaces.js';
import { setTamrielFit } from '../src/world/tamrielFrame.js';
import { setTamrielTrace } from '../src/world/tamrielLand.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { syntheticWoodsBytes } from './landformWorld.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielFit(null); setTamrielTrace(null); });
const IC = CAPITALS[0], B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
const isOwn = (cell) => Object.hasOwn(IMPERIAL_BLOCKS, cell);
const cellRect = (r, c) => [(c - HALF) * B, (r - HALF) * B, (c - HALF + 1) * B, (r - HALF + 1) * B];

// ── THE PLAN ────────────────────────────────────────────────────

test('TESA11 the plan: 24 x 24, its anchor the middle grid point; the lake where a cell holds no land, the city\'s own where it holds a shore, a wall or a landmark, else one of Daggerfall\'s blocks of its district\'s trade - every district its signature', () => {
  assert.equal(IMPERIAL_SPAN, 3);
  assert.equal(IMPERIAL_CITY_PLAN.length, 24);
  assert.ok(IMPERIAL_CITY_PLAN.every((r) => r.length === 24));
  assert.deepEqual(IC.anchor, [12, 12]);
  assert.equal(IC.plan, IMPERIAL_CITY_PLAN);
  const counts = { L: 0, own: 0, classic: 0, G: 0 };
  IMPERIAL_CITY_PLAN.forEach((row, r) => row.forEach((cell, c) => {
    const [x0, z0, x1, z1] = cellRect(r, c), pts = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) pts.push(imperialLand(x0 + (i + 0.5) * (B / 5), z0 + (j + 0.5) * (B / 5)));
    if (cell === 'L') { counts.L++; assert.ok(pts.every((v) => !v), `${c},${r} the lake holds no land`); return; }
    assert.ok(pts.some(Boolean), `${c},${r}`);
    if (isOwn(cell)) { counts.own++; assert.equal(cell, imperialCode(r, c)); return; }
    // one of Daggerfall's blocks or a garden: all land, no landmark, its district's trade
    assert.ok(pts.every(Boolean), `${c},${r} ${cell} wholly land`);
    assert.equal(imperialReserved(x0, z0, x1, z1), false, `${c},${r} ${cell} no landmark`);
    const d = imperialDistrictAt(x0 + B / 2, z0 + B / 2);
    assert.ok(IMPERIAL_MIX[d]?.includes(cell) || IMPERIAL_SIGNATURE[d] === cell, `${c},${r} ${cell} of ${d}'s trade`);
    counts[cell === 'G' ? 'G' : 'classic']++;
  }));
  assert.ok(counts.classic >= 80 && counts.G >= 15, JSON.stringify(counts));
  for (const [d, kind] of Object.entries(IMPERIAL_SIGNATURE)) assert.ok(IMPERIAL_DISTRICTS[d].some(([c, r]) => IMPERIAL_CITY_PLAN[r][c] === kind), `${d}'s ${kind}`);
  for (const [d] of IMPERIAL_SECTORS) assert.ok(IMPERIAL_DISTRICTS[d].filter(([c, r]) => !isOwn(IMPERIAL_CITY_PLAN[r][c])).length >= 8, `${d} its blocks`);
  assert.equal(Object.keys(IMPERIAL_BLOCKS).length, counts.own);
  for (const [code, b] of Object.entries(IMPERIAL_BLOCKS)) assert.equal(b.name, `TESA${code}.RMB`);
});

test('TESA11 the districts on their sectors: Green Emperor Way inside the palace wall; the Market north-east, the Arena District east, the Arboretum south-east, the Temple District south-west, Talos Plaza west, the Elven Gardens north-west; outside the walls the Prison, the University, the Waterfront and the isle; the lake past it', () => {
  assert.deepEqual(IMPERIAL_SECTORS.map(([d, b]) => [d, b]), [['Market District', 0], ['Arena District', 60], ['Arboretum', 120], ['Temple District', 180], ['Talos Plaza District', 240], ['Elven Gardens District', 300]]);
  assert.equal(imperialDistrictAt(0, 0), 'Green Emperor Way');
  assert.equal(imperialDistrictAt(...polar(45, 299)), 'Green Emperor Way');
  for (const [b, d] of [[45, 'Market District'], [90, 'Arena District'], [135, 'Arboretum'], [225, 'Temple District'], [270, 'Talos Plaza District'], [315, 'Elven Gardens District']]) assert.equal(imperialDistrictAt(...polar(b, 600)), d, `${b}`);
  assert.equal(imperialDistrictAt(...prisonAt()), 'Prison District');
  assert.equal(imperialDistrictAt(...polar(IMPERIAL.university.b, IMPERIAL.university.r)), 'Arcane University');
  assert.equal(imperialDistrictAt(...polar(180, 1060)), 'Waterfront District');
  assert.equal(imperialDistrictAt(...polar(300, 960)), 'City Isle');
  assert.equal(imperialDistrictAt(...polar(300, 1100)), null, 'the lake');
  assert.ok(Math.abs(imperialBearing(...polar(123.4, 50)) - 123.4) < 1e-9 && Math.abs(imperialBearing(0, -5)) < 1e-9 && Math.abs(imperialBearing(5, 0) - 90) < 1e-9);
  // the canon's own placings: the Prison on the isle's north-eastern shore (PIN MOVED, TESA-LORE: it stood north of
  // north-east, in the north pixel), the University south-east, Talos Bridge west, the Waterfront south
  assert.ok(IMPERIAL.prison.b === 45 && IMPERIAL.university.b === 135 && IMPERIAL.bridge.b === 270 && IMPERIAL.waterfront.b0 < 180 && IMPERIAL.waterfront.b1 > 180);
});

// ── THE SLICES ──────────────────────────────────────────────────

test('TESA11 the slices: nine, each its district\'s name (the centre the city\'s own), its ordinal (the centre 0), its own map id and location index - every one a capital\'s, a place the port made', () => {
  assert.deepEqual([capitalSpan(IC), capitalCentre(IC), capitalSpan(CAPITALS[1]), capitalCentre(CAPITALS[1])], [3, 4, 1, 0]);
  assert.deepEqual(IMPERIAL_SLICE_NAMES, ['Elven Gardens District', 'Market District', 'Prison District', 'Talos Plaza District', 'Imperial City', 'Arena District', 'Temple District', 'Waterfront District', 'Arboretum']);   // PIN MOVED (TESA-LORE): the Prison north-east
  assert.deepEqual(Array.from({ length: 9 }, (_, s) => capitalSliceName(IC, s)), IMPERIAL_SLICE_NAMES);
  assert.equal(capitalSliceName(CAPITALS[1], 0), 'Solitude');
  assert.equal(capitalSliceName({ ...IC, sliceNames: Array(9).fill('Somewhere') }, 4), 'Imperial City', 'the centre the city\'s own name, whatever its slices are called');
  assert.deepEqual(Array.from({ length: 9 }, (_, s) => capitalSliceOrdinal(IC, s)), [1, 2, 3, 4, 0, 5, 6, 7, 8]);
  const ids = Array.from({ length: 9 }, (_, s) => capitalPlaceId(0, capitalSliceOrdinal(IC, s)));
  assert.equal(new Set(ids).size, 9);
  assert.equal(capitalPlaceId(0, 0), capitalPlaceId(0), 'the centre the capital\'s own id');
  for (const id of ids) assert.ok(isCapitalPlaceId(id) && isCountryPlaceId(id));
  const others = CAPITALS.slice(1).map((_, k) => capitalPlaceId(k + 1));
  assert.ok(ids.every((id) => !others.includes(id)), 'apart from every other capital\'s');
  assert.equal(new Set(Array.from({ length: 9 }, (_, s) => capitalLocationIndex(0, capitalSliceOrdinal(IC, s)))).size, 9);
});

test('TESA11 the pixel law over nine: the centre the nearest pixel all nine of whose pixels are the Imperial Province\'s land; every slice on its pixel, the centre\'s pin Arena\'s place of its name', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const at = capitalPixel(IC);
  assert.deepEqual(at, { px: 2177, py: 612 });
  for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
    const o = capitalOnPixel(at.px + sx - 1, at.py + sy - 1);
    assert.deepEqual([o.cap, o.k, o.s, [...o.slice], o.centre], [IC, 0, sy * 3 + sx, [sx, sy], at]);
  }
  assert.equal(capitalOnPixel(at.px + 2, at.py), null);
  assert.equal(capitalOnPixel(at.px, at.py - 2), null);
  assert.deepEqual(capitalPin({ name: 'Imperial City', province: 'Imperial' }), at);
  // a picture whose Imperial land begins at column 179, east of the point's: the Bay's pixels of column 178 another
  // province's - the centre moves east till all nine stand on the Imperial land, one past the single pixel's law
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(9);
  for (let y = 0; y < h; y++) for (let x = 0; x < 179; x++) province[y * w + x] = 3;
  setTamrielTrace({ w, h, land, province });
  const first = 2185;   // the first Bay pixel whose centre is column 179's: (2185.5 + 589) / 15.5 = 179
  assert.deepEqual([Math.floor((first - 1 + 0.5 + 589) / 15.5), Math.floor((first + 0.5 + 589) / 15.5)], [178, 179]);
  assert.deepEqual(capitalPixel(IC), { px: first + 1, py: 612 }, 'its west slice on the land\'s first pixel');
  assert.deepEqual(capitalPixel({ ...IC, span: 1 }), { px: first, py: 612 }, 'one pixel: the first');
});

test('TESA11 Arena\'s places off the city\'s pixels: a place whose point falls on a reserved pixel stands on the nearest free one; the pinned place on the centre; no reserve, no change', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  const w = 320, h = 200, trace = { w, h, land: new Uint8Array(w * h).fill(1), province: new Uint8Array(w * h).fill(3) };
  const P = (id, name, bx, by) => ({ province: 'Skyrim', provinceIndex: 2, id, kind: 'city-state', name, px: (bx + 0.5 + 400) / 10, py: (by + 0.5 + 500) / 10, snapped: 0 });
  const model = { places: [P(0, 'Capital', 1500, -100), P(1, 'Neighbour', 1501, -100), P(2, 'Far', 1600, -150)] };
  const pin = (p) => (p.name === 'Capital' ? { px: 1500, py: -100 } : null);
  const reserved = (bx, by) => Math.abs(bx - 1500) <= 1 && Math.abs(by + 100) <= 1;
  const s = standArenaPixels(model, trace, pin, reserved);
  const got = Object.fromEntries(s.stood.map((p) => [p.name, [p.bx, p.by, !!p.pinned]]));
  assert.deepEqual(got.Capital, [1500, -100, true]);
  assert.ok(!reserved(got.Neighbour[0], got.Neighbour[1]), 'off the city');
  assert.ok(Math.abs(got.Neighbour[0] - 1502) <= 0 || Math.max(Math.abs(got.Neighbour[0] - 1501), Math.abs(got.Neighbour[1] + 100)) === 1, 'the nearest free');
  assert.deepEqual(got.Far, [1600, -150, false]);
  assert.deepEqual(standArenaPixels(model, trace, pin).stood.map((p) => [p.name, p.bx, p.by]).find(([n]) => n === 'Neighbour'), ['Neighbour', 1501, -100], 'no reserve, no change');
});

test('TESA11 a slice\'s location: its eight by eight of the plan (its hash and gardens the plan\'s), its name, id and index, its buildings\' seeds its own; every slice\'s ground flattened to the centre\'s pixel; Arena\'s slot on the centre alone', () => {
  const kinds = [...new Set(IMPERIAL_CITY_PLAN.flat())].filter((c) => c !== 'L' && c !== 'G' && !isOwn(c));
  const names = new Map(kinds.map((k) => [k, [`${k}AA00.RMB`, `${k}AA01.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
  const base = { name: 'Broadvale', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
  const seeds = new Set();
  for (let s = 0; s < 9; s++) {
    const sx = s % 3, sy = Math.floor(s / 3), px = 2177 + sx - 1, py = 612 + sy - 1;
    const loc = synthesizeCapitalLocation({ cap: IC, k: 0, s }, { base, names, blockOf: (n) => (n.startsWith('TES') ? null : fh), px, py, arena: s === 4 ? { id: 0 } : undefined });
    const sub = IMPERIAL_CITY_PLAN.slice(sy * 8, sy * 8 + 8).map((r) => r.slice(sx * 8, sx * 8 + 8));
    const ed = loc.exterior.exteriorData, so = capitalSliceOrdinal(IC, s);
    assert.equal(loc.name, IMPERIAL_SLICE_NAMES[s]);
    assert.deepEqual([ed.width, ed.height, ed.blockNames.length, ed.mapId, loc.locationIndex], [8, 8, 64, capitalPlaceId(0, so), capitalLocationIndex(0, so)]);
    assert.deepEqual(ed.blockNames, capitalBlockNames(sub, 0, names, IMPERIAL_BLOCKS, [sx * 8, sy * 8]));
    assert.deepEqual(loc.capital, { key: 'imperial-city', k: 0, s, flattenAt: { px: 2177, py: 612 } }, `${s}: flattened to the centre's`);
    assert.equal('arena' in loc, s === 4);
    const classic = sub.flat().filter((c) => c !== 'L' && c !== 'G' && !isOwn(c)).length;
    assert.equal(loc.exterior.buildings.length, classic);
    for (const b of loc.exterior.buildings) { assert.equal(seeds.has(b.nameSeed + ':' + b.sector + ':' + s), false); seeds.add(b.nameSeed + ':' + b.sector + ':' + s); }
    // its gardens named by the whole plan's cell
    sub.forEach((row, r) => row.forEach((cell, x) => { if (cell === 'G') assert.ok(ed.blockNames.includes(capitalGardenName(IC, sx * 8 + x, sy * 8 + r))); }));
  }
  const a = synthesizeCapitalLocation({ cap: IC, k: 0, s: 0 }, { base, names, blockOf: () => fh, px: 2176, py: 611 }).exterior.buildings.map((b) => b.nameSeed);
  const b = synthesizeCapitalLocation({ cap: IC, k: 0, s: 2 }, { base, names, blockOf: () => fh, px: 2178, py: 611 }).exterior.buildings.map((d) => d.nameSeed);
  assert.notDeepEqual(a.slice(0, 5), b.slice(0, 5), 'each slice\'s seeds its own');
  assert.equal('flattenAt' in synthesizeCapitalLocation({ cap: CAPITALS[1], k: 1 }, { base, names: new Map([...names, ...['MAGE', 'GENR', 'TVRN', 'RESI', 'LIBR', 'ALCH', 'GEMS', 'BOOK', 'ARMR', 'TEMP', 'PAWN', 'GRVE', 'BANK', 'FIGH'].map((k) => [k, [`${k}AA00.RMB`]])]), blockOf: () => fh, px: 1, py: 1 }).capital, false, 'a one-pixel capital flattens as any location');
});

// ── THE GROUND ──────────────────────────────────────────────────

test('TESA11 the ground\'s laws: the lake\'s water off the isle; the plaza\'s and Green Emperor Way\'s stone, its lawns\' grass; the walls\' feet stone; the tower\'s plinth, the tombs, the Colosseum\'s stands and the Temple closed, the Colosseum\'s ways in open; trees on grass alone', () => {
  assert.equal(imperialTile(...polar(300, 1100)), 0);
  assert.equal(imperialTile(0, 60), 3, 'the plaza');
  assert.equal(imperialTile(...polar(10, 260)), 3, 'Green Emperor Way');
  assert.equal(imperialTile(...polar(10, 160)), 2, 'its lawns');
  assert.equal(imperialTile(...polar(50, 900)), 3, 'the city wall\'s foot');
  assert.equal(imperialTile(...polar(130, 600)), 2, 'the Arboretum');   // PIN MOVED (TESA-LORE): its middle the Divines' court
  assert.equal(imperialTile(...polar(45, 600)), 3, 'the Market\'s streets');
  assert.equal(imperialClosed(0, 0), true);
  assert.equal(imperialClosed(...polar(22.5, IMPERIAL.tombs.r)), true, 'a tomb');
  assert.equal(imperialClosed(...polar(10, 150)), false, 'the lawn');
  const C = IMPERIAL.colosseum, [cx, cz] = polar(C.b, C.r);
  assert.equal(imperialClosed(cx + (C.floor[0] + C.rx) / 2, cz + 10), true, 'the stands');
  assert.equal(imperialClosed(cx + (C.floor[0] + C.rx) / 2, cz), false, 'its way in on its axis');
  assert.equal(imperialClosed(cx, cz), false, 'the sand');
  assert.ok(colosseumGate(C.floor[0] + 5, 0) && !colosseumGate(C.floor[0] + 5, 10));
  assert.equal(imperialClosed(...polar(IMPERIAL.temple.b, IMPERIAL.temple.r)), true, 'the Temple');
  let grass = 0, trees = 0;
  for (let x = -1200; x < 1200; x += 6.4) for (let z = -1200; z < 1200; z += 6.4) {
    const t = imperialTree(x, z);
    if (t >= 0) { trees++; assert.equal(imperialTile(x, z), 2, `${x},${z}`); assert.ok([12, 15, 16, 18].includes(t)); }
    if (imperialTile(x, z) === 2) grass++;
  }
  assert.ok(trees > grass / 30 && trees < grass / 3, `${trees} trees on ${grass} grass`);
});

test('TESA11 the port blocks: one a cell of the city\'s own, its ground, trees and closed cells its laws\'; its landmarks carried each by its own slice (the centre\'s by the anchor\'s block), laid at the city\'s middle', () => {
  const blocks = capitalPortBlocks(), byName = new Map(blocks.map((b) => [b.name, b]));
  for (const b of Object.values(IMPERIAL_BLOCKS)) assert.ok(byName.has(b.name), b.name);
  const carriers = capitalModelCarriers(IC);
  assert.deepEqual(IC.models, Object.values(IMPERIAL_MODELS));
  for (const [id, s] of Object.entries(IMPERIAL_CARRY)) {
    const code = carriers.get(Number(id)), [r, c] = [parseInt(code[1], 36), parseInt(code[2], 36)];
    assert.equal(Math.floor(r / 8) * 3 + Math.floor(c / 8), s, `model ${id} in slice ${s}`);
    if (s === 4) assert.equal(code, capitalCarrier(IC), 'the centre\'s on the anchor\'s block');
    const blk = byName.get(IMPERIAL_BLOCKS[code].name), laid = layoutRmbBlock(blockFromJson(blk.json, blk.index));
    const m = laid.models.find((x) => x.modelIdNum === Number(id));
    assert.ok(m, `${id} laid`);
    assert.deepEqual([...m.matrix.slice(12, 15)].map((v) => +v.toFixed(2)), [+((12 - c) * B).toFixed(2), 0, +((r + 1 - 12) * B).toFixed(2)].map((v) => v + 0), `${id} at the city's middle`);
  }
  // each landmark carried by the slice its geometry stands in
  const builds = { [IMPERIAL_MODELS.whiteGoldTower]: buildImperialTower, [IMPERIAL_MODELS.palaceWall]: buildPalaceWall, [IMPERIAL_MODELS.tombs]: buildEmperorsTombs, [IMPERIAL_MODELS.cityWall]: buildCityWall,
    [IMPERIAL_MODELS.districtWalls]: buildDistrictWalls, [IMPERIAL_MODELS.colosseum]: buildColosseum, [IMPERIAL_MODELS.templeOfTheOne]: buildTempleOfTheOne, [IMPERIAL_MODELS.talosStatue]: buildTalosStatue,
    [IMPERIAL_MODELS.prison]: buildImperialPrison, [IMPERIAL_MODELS.university]: buildArcaneUniversity, [IMPERIAL_MODELS.waterfront]: buildWaterfront, [IMPERIAL_MODELS.talosBridge]: buildTalosBridge };
  const PIX = 8 * B, sliceAt = (x, z) => Math.floor((z + 1.5 * PIX) / PIX) * 3 + Math.floor((x + 1.5 * PIX) / PIX);
  for (const [id, build] of Object.entries(builds)) {
    const { lo, hi } = bounds(build()), code = carriers.get(Number(id));
    assert.equal(Math.floor(parseInt(code[1], 36) / 8) * 3 + Math.floor(parseInt(code[2], 36) / 8), sliceAt((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2), `model ${id} carried where it stands`);
  }
  // an own block's tiles and trees its laws' at its cells - one of Green Emperor Way's lawns, with its trees
  const lawn = IMPERIAL_CITY_PLAN.flatMap((row, r) => row.map((cell, c) => [r, c, cell])).find(([r, c, cell]) => isOwn(cell) && imperialDistrictAt((c - HALF + 0.5) * B, (r - HALF + 0.5) * B) === 'Green Emperor Way' && Math.hypot((c - HALF + 0.5) * B, (r - HALF + 0.5) * B) > 180);
  const [lr, lc, code] = lawn, blk = byName.get(IMPERIAL_BLOCKS[code].name);
  const g = blk.json.RmbBlock.FldHeader.GroundData;
  let planted = 0;
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const [x, z] = [(tx + 0.5) * 6.4, (15 - ty + 0.5) * 6.4], at = anchorMetres(IC, lc, lr, x, z);
    assert.equal(g.GroundTiles[ty * 16 + tx].TileBitfield, imperialTile(...at));
    assert.equal(g.GroundScenery[ty * 16 + tx].TextureRecord, imperialTree(...at));
    if (imperialTree(...at) >= 0) planted++;
  }
  assert.ok(planted > 0, 'its lawn planted');
});

// ── THE LANDMARKS ───────────────────────────────────────────────

const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite));
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  assert.ok(m.subMeshes.every((s) => s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)));
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
  for (let t = 0; t < m.indices.length; t += 3) {
    const P = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [P(0), P(1), P(2)], n = [0, 1, 2].map((a2) => m.normals[m.indices[t] * 3 + a2]);
    const u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]);
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cr) > 1e-6) assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'every face wound along its normal');
  }
};
const bounds = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); } return { lo, hi }; };
/** Does the segment p-q cross any face of the model (Moller-Trumbore)? - a way is open where nothing does. */
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

test('TESA11 the White-Gold Tower: 680 m to its gilt spire\'s tip over a plinth 172 m across, its fins within 104 m of its axis, marble and gold, the palace\'s door on the east', () => {
  const t = buildImperialTower(), T = IMPERIAL.tower;
  sane(t);
  const { lo, hi } = bounds(t);
  assert.ok(Math.abs(hi[1] - T.spireTop) < 1e-6 && T.spireTop === 680);
  assert.ok(Math.abs(lo[1] + 3) < 1e-6, 'its plinth sunk');
  assert.ok(Math.max(hi[0], -lo[0], hi[2], -lo[2]) <= T.finR + 1, 'the fins its widest');
  assert.ok(Math.hypot(T.plinthR, 0) * 2 >= 170);
  const recs = new Set(t.subMeshes.map((s) => s.textureRecord));
  for (const r of [CAPITAL_ART.marble, CAPITAL_ART.gold, CAPITAL_ART.dark]) assert.ok(recs.has(r));
  assert.equal(crosses(t, [T.plinthR + 20, T.plinthH / 2, 30], [T.plinthR * 0.7, T.plinthH / 2, 30]), true, 'the plinth stands in the way');
});

test('TESA11 the walls: the city wall\'s four gates open under their lintels and walled between; the palace wall\'s six gates; the district walls each a gate at its middle; all inside the isle', () => {
  const W = IMPERIAL.cityWall, wall = buildCityWall(), palace = buildPalaceWall(), districts = buildDistrictWalls();
  for (const m of [wall, palace, districts, buildEmperorsTombs()]) sane(m);
  for (const b of W.gates) {
    assert.equal(crosses(wall, P3(b, W.r - 10, W.gateH / 2), P3(b, W.r + 10, W.gateH / 2)), false, `the gate at ${b} open`);
    assert.equal(crosses(wall, P3(b, W.r - 10, (W.gateH + W.h) / 2), P3(b, W.r + 10, (W.gateH + W.h) / 2)), true, `its lintel`);
  }
  for (const b of [50, 100, 200, 300]) assert.equal(crosses(wall, P3(b, W.r - 10, 4), P3(b, W.r + 10, 4)), true, `walled at ${b}`);
  const pw = IMPERIAL.palaceWall;
  for (const [, b] of IMPERIAL_SECTORS) {
    assert.equal(crosses(palace, P3(b + 30, pw.r - 6, 3), P3(b + 30, pw.r + 6, 3)), false, `the palace gate to ${b + 30}`);
    assert.equal(crosses(palace, P3(b + 10, pw.r - 6, 3), P3(b + 10, pw.r + 6, 3)), true);
  }
  const D = IMPERIAL.districtWall, mid = (pw.r + W.r) / 2;
  for (const [[ax, az], [bx, bz]] of districtWallLines()) {
    const ux = (bx - ax), uz = (bz - az), l = Math.hypot(ux, uz), nx = -uz / l, nz = ux / l, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    assert.equal(crosses(districts, [mx - nx * 5, D.gateH / 2, mz - nz * 5], [mx + nx * 5, D.gateH / 2, mz + nz * 5]), false, 'the district gate');
    assert.equal(crosses(districts, [mx + ux / l * 60 - nx * 5, 3, mz + uz / l * 60 - nz * 5], [mx + ux / l * 60 + nx * 5, 3, mz + uz / l * 60 + nz * 5]), true, 'walled beside it');
  }
  void mid;
  const { hi } = bounds(wall);
  assert.ok(Math.max(hi[0], hi[2]) <= W.r + W.watchR + 4 && W.r + W.watchR + 4 < IMPERIAL.isle);   // PIN MOVED (TESA-LORE): its watch towers the widest
});

test('TESA11 the districts\' landmarks: the Colosseum\'s ways in open and its stands walled; the Temple of the One\'s dome over its roof and its towers over the dome; Talos Plaza\'s dragon on its plinth; the Prison\'s Bastion; the University\'s tower; the Waterfront\'s piers over the water; Talos Bridge to the city\'s west edge', () => {
  const C = IMPERIAL.colosseum, col = buildColosseum(), [cx, cz] = polar(C.b, C.r);
  const temple = buildTempleOfTheOne(), statue = buildTalosStatue(), prison = buildImperialPrison(), uni = buildArcaneUniversity(), front = buildWaterfront(), bridge = buildTalosBridge();
  for (const m of [col, temple, statue, prison, uni, front, bridge]) sane(m);
  assert.equal(crosses(col, [cx + C.rx + 5, 3, cz], [cx, 3, cz]), false, 'the east way in');
  assert.equal(crosses(col, [cx, 3, cz + C.rz + 5], [cx, 3, cz]), false, 'the south way in');
  assert.equal(crosses(col, [cx + (C.rx + 5) * 0.7, 3, cz + (C.rz + 5) * 0.7], [cx, 3, cz]), true, 'walled between');
  assert.ok(Math.abs(bounds(col).hi[1] - C.h) < 1e-6);
  const T = IMPERIAL.temple, tb = bounds(temple);
  assert.ok(tb.hi[1] > T.h + T.domeR * 1.5 && tb.hi[1] >= T.towerH + T.towerS * 1.8 - 1e-6, 'the towers\' spires its top');
  const sb = bounds(statue), [sx, sz] = polar(IMPERIAL.statue.b, IMPERIAL.statue.r);
  assert.ok(sb.lo[0] >= sx - 15 && sb.hi[0] <= sx + 15 && sb.hi[1] > 20, 'the dragon on its plinth');
  assert.ok(statue.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.bronze));
  const [px, pz] = prisonAt(), pb = bounds(prison);
  assert.ok(pb.hi[1] >= IMPERIAL.prison.bastionH && Math.abs((pb.lo[0] + pb.hi[0]) / 2 - px) < 15 && Math.abs((pb.lo[2] + pb.hi[2]) / 2 - pz) < 15);
  const [ux, uz] = universityTowerAt();
  assert.ok(Math.abs(bounds(uni).hi[1] - (IMPERIAL.university.spireH + 34)) < 1e-6);
  assert.equal(crosses(uni, [ux - 40, 50, uz], [ux + 40, 50, uz]), true, 'the Arch-Mage\'s tower');
  const fb = bounds(front), W = IMPERIAL.waterfront;
  assert.ok(Math.hypot(...polar(180, W.pierTo)) - 1 <= Math.hypot(fb.hi[0], fb.hi[2]) + 1);
  assert.equal(imperialLand(...polar(W.piers[0], W.pierTo - 2)), false, 'the piers\' ends over the water');
  const bb = bounds(bridge);
  assert.ok(Math.abs(bb.lo[0] + 12 * B) < 1e-3 && bb.hi[0] <= -IMPERIAL.cityWall.r && bb.hi[1] <= IMPERIAL.bridge.deck + IMPERIAL.bridge.parapet + 1e-3, 'from the west gate to the edge');
});

test('TESA11 the install: the twelve on the model door, each the drawn model turned north', () => {
  installCapitals({ addTextures: () => 0 });
  for (const id of Object.values(IMPERIAL_MODELS)) assert.ok(customModelFor(id)?.positions.length > 0, `${id}`);
  assert.equal(CAPITAL_MODELS.whiteGoldTower, IMPERIAL_MODELS.whiteGoldTower);
  const t = customModelFor(IMPERIAL_MODELS.talosBridge), d = buildTalosBridge();
  assert.ok(Math.abs(bounds(t).hi[2] + bounds(d).lo[2]) < 1e-6);
});

// ── THE KERNEL AND THE HOST ─────────────────────────────────────

test('TESA11 one ground: every slice of a city over several pixels flattened to its centre pixel\'s average - two pixels side by side meet level; the centre\'s its own; a location without it its own average as ever', () => {
  const woods = new WoodsFile();
  assert.equal(woods.load(syntheticWoodsBytes()), true);
  const rect = { xMin: -3, xMax: 130, yMin: -3, yMax: 130 };
  const job = (px, py, flattenAt = null) => generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 0, flattenAt });
  // a pair whose own averages part
  let pair = null;
  for (let x = 200; x < 900 && !pair; x += 37) { const a = job(x, 200).avg, b = job(x + 1, 200).avg; if (Math.abs(a - b) > 1e-4) pair = [x, a, b]; }
  assert.ok(pair, 'two pixels of different ground');
  const [x, own, next] = pair;
  const centre = { px: x, py: 200 };
  const a = job(x, 200, centre), b = job(x + 1, 200, centre);
  assert.equal(a.avg, own, 'the centre its own average');
  assert.equal(b.avg, own, 'its neighbour the centre\'s');
  assert.notEqual(next, own);
  assert.ok(b.samples.every((v) => v === Math.fround(own)), 'the whole of it flat at that height');
  assert.equal(job(x + 1, 200).avg, next, 'without it, its own');
  // another ground under the same pixels (another woods): the centre's average its own - never the one kept for the last
  const higher = new Proxy(woods, { get: (t, k) => (k === 'getHeightMapValuesRange1Dim' ? (...a) => Array.from(t.getHeightMapValuesRange1Dim(...a), (v) => Math.min(255, v + 40)) : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
  const tall = (px, f = null) => generatePixelTerrain({ woods: higher, px, py: 200, tilemap: new Uint8Array(128 * 128), locationRect: rect, hasLocation: true, climateType: 0, flattenAt: f }).avg;
  const own2 = tall(x);
  assert.notEqual(own2, own);
  assert.equal(tall(x + 1, centre), own2);
  assert.match(read('src/scenes/world.js'), /flattenAt: dfLocation\?\.capital\?\.flattenAt \?\? null,/);
});

test('TESA11 the host: a slice stood once on its pixel - a slice moved is stood again; the plan\'s Arena slot the centre\'s', () => {
  const W = read('src/scenes/world.js');
  assert.match(W, /if \(at && had\.capital\.k === at\.k && had\.capital\.s === at\.s && \(had\.arena\?\.id \?\? null\) === \(slot\?\.id \?\? null\)/);
  assert.match(read('src/world/arenaPlaces.js'), /standArenaPixels\(model, \/\*\* @type \{any\} \*\/ \(tamrielTrace\(\)\), capitalPin, \(bx, by\) => !!capitalOnPixel\(bx, by\)\);/);
  assert.match(read('src/world/arenaPlaces.js'), /const free = \(bx, by\) => !inBay\(bx, by\) && !byPixel\.has\(`\$\{bx\},\$\{by\}`\) && !reserved\?\.\(bx, by\) && own\(/);
});

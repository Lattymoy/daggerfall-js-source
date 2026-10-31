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
  IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, IMPERIAL_SECTORS, IMPERIAL_MODELS, IMPERIAL_CARRY, PALACE,   // PIN MOVED (IC-PROPS): no IMPERIAL_MIX nor IMPERIAL_SIGNATURE - the trade is the fabric's
  polar, imperialBearing, imperialLand, imperialDistrictAt, imperialReserved, imperialCode, imperialCell, imperialSliceName, imperialSlicePlan,
  imperialTile, imperialClosed, imperialTree, districtWallLines, prisonAt, universityTowerAt, IMPERIAL_PARTS, imperialSliceRect, imperialPartId, OPEN_TILE,
  imperialArenaCell, IMPERIAL_ARENA_CODE, tombAt,
} from '../src/world/imperialCity.js';
import {
  CAPITALS, CAPITAL_MODELS, BLOCK_M, capitalSpan, capitalCentre, capitalSliceOrdinal, capitalSliceName, capitalPlaceId, capitalLocationIndex, isCapitalPlaceId,
  capitalPixel, capitalOnPixel, capitalPin, capitalCarrier, capitalSliceCarriers, synthesizeCapitalLocation, capitalBlockNames, anchorMetres,
  CAPITAL_RIM_M, CAPITAL_RIM_TILES, capitalApproachName, capitalDims,
} from '../src/world/tamrielCapitals.js';
import { capitalApproachCells } from '../src/world/capitalApproaches.js';   // ROAD-FOLLOW: Talos Bridge's approach
import {
  buildImperialTower, buildPalaceWall, buildEmperorsTombs, buildCityWall, buildDistrictWalls, buildTempleOfTheOne, buildTalosStatue,
  buildImperialPrison, buildArcaneUniversity, buildWaterfront, buildTalosBridge, nearRect,
} from '../src/world/capitalImperial.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART } from '../src/world/capitalShapes.js';
import { installCapitals, modelPart, imperialPartBuild, _resetCapitals } from '../src/world/capitalModels.js';
import { imperialOwnName } from '../src/world/imperialBlocks.js';
import { fabricGroundAt, GROUND } from '../src/world/imperialFabric.js';
import { TOWN_OUTLINE_BLOCK } from '../src/world/townOutline.js';
import { customModelFor } from '../src/world/customModels.js';
import { isCountryPlaceId } from '../src/world/tamrielCountry.js';
import { standArenaPixels } from '../src/world/arenaPlaces.js';
import { setTamrielFit } from '../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { getDFBlockReplacementData, getNewDFBlockIndex } from '../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { ARENA_BLOCK } from '../src/world/arena/arenaCity.js';
import { syntheticWoodsBytes } from './landformWorld.mjs';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielFit(null); setTamrielTrace(null); });
const IC = CAPITALS[0], B = BLOCK_M, HALF = IMPERIAL_CELLS / 2, N = IMPERIAL_SPAN, CENTRE = (N * N - 1) / 2;   // PIN MOVED (IC-GRAND): twenty-five pixels a side (TS5's seven)
const isOwn = (cell) => /^I[0-9a-z]{4}$/.test(cell ?? '');
const cellRect = (r, c) => [(c - HALF) * B, (r - HALF) * B, (c - HALF + 1) * B, (r - HALF + 1) * B];
/** PIN MOVED (IC-GRAND): the plan is no table the module holds (forty thousand cells, each worked with its slice when first
 *  asked) - the pins read it whole once, through its law. */
let _plan = null;
const PLAN = () => (_plan ??= Array.from({ length: IMPERIAL_CELLS }, (_, r) => Array.from({ length: IMPERIAL_CELLS }, (_, c) => imperialCell(r, c))));

// ── THE PLAN ────────────────────────────────────────────────────

test('TESA11 the plan: 200 x 200 (PIN MOVED, IC-GRAND: twenty-five pixels; TS5 56 x 56), its anchor the middle grid point, worked by its law a slice at a time; the lake where a cell holds no land (IC-GRAND: or the city\'s own where a landmark crosses it), open ground past the lake\'s far shore, the arena\'s cell Daggerfall\'s arena, else the city\'s own (PIN MOVED, IC-PROPS - the owner, 2026-10-27: "Old daggerfall city layout placements are in imperial city": no block of Daggerfall\'s but the arena\'s; each district\'s trade and signature the fabric\'s, test/world/icprops_city.test.js)', () => {
  assert.equal(IMPERIAL_SPAN, 25);
  const plan = PLAN();
  assert.equal(plan.length, 200);
  assert.ok(plan.every((r) => r.length === 200));
  assert.deepEqual(IC.anchor, [100, 100]);
  assert.equal(IC.plan, null, 'IC-GRAND: no table');
  assert.equal(IC.cellAt, imperialCell);
  assert.deepEqual(imperialSlicePlan(CENTRE), plan.slice(96, 104).map((r) => r.slice(96, 104)));
  const counts = { L: 0, O: 0, own: 0, classic: 0, arena: 0, bridged: 0 };
  plan.forEach((row, r) => row.forEach((cell, c) => {
    const [x0, z0, x1, z1] = cellRect(r, c), pts = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) pts.push(imperialLand(x0 + (i + 0.5) * (B / 5), z0 + (j + 0.5) * (B / 5)));
    if (cell === 'L') { counts.L++; assert.ok(pts.every((v) => !v), `${c},${r} the lake holds no land`); return; }
    if (cell === 'O') { counts.O++; assert.ok(pts.every(Boolean) && imperialDistrictAt(x0 + B / 2, z0 + B / 2) === 'Rumare Shore', `${c},${r} open ground: the far shore wholly`); return; }
    if (cell === IMPERIAL_ARENA_CODE) { counts.arena++; assert.deepEqual([r, c], imperialArenaCell()); return; }
    if (isOwn(cell)) {
      counts.own++;
      assert.equal(cell, imperialCode(r, c));
      if (!pts.some(Boolean)) { counts.bridged++; assert.equal(imperialReserved(x0, z0, x1, z1), true, `${c},${r} a lake cell its own only where a landmark crosses it`); }
      return;
    }
    // PIN MOVED (IC-PROPS): no other cell - 671 of Daggerfall's blocks stood here till 2026-10-27
    counts.classic++;
  }));
  assert.ok(counts.classic === 0 && counts.O >= 9000 && counts.L >= 10000 && counts.own >= 19900 && counts.arena === 1 && counts.bridged > 0, JSON.stringify(counts));   // PIN MOVED (IC-GRAND; IC-PROPS: no block of Daggerfall's but the arena's)
});

test('TESA11 the districts on their sectors: the Palace District inside the palace wall (PIN MOVED, IC-GRAND: the team\'s list names it; TESA11\'s "Green Emperor Way" is its ring road\'s name); the Market north-east, the Arena District east, the Arboretum south-east, the Temple District south-west, Talos Plaza west, the Elven Gardens north-west; outside the walls the Prison, the University, the Waterfront and the isle; the lake past it', () => {
  assert.deepEqual(IMPERIAL_SECTORS.map(([d, b]) => [d, b]), [['Market District', 0], ['Arena District', 60], ['Arboretum', 120], ['Temple District', 180], ['Talos Plaza District', 240], ['Elven Gardens District', 300]]);
  assert.equal(PALACE, 'Palace District');
  assert.equal(imperialDistrictAt(0, 0), PALACE);
  assert.equal(imperialDistrictAt(...polar(45, IMPERIAL.palaceWall.r - 1)), PALACE);
  for (const [b, d] of [[45, 'Market District'], [90, 'Arena District'], [135, 'Arboretum'], [225, 'Temple District'], [270, 'Talos Plaza District'], [315, 'Elven Gardens District']]) assert.equal(imperialDistrictAt(...polar(b, 4600)), d, `${b}`);   // PIN MOVED (IC-GRAND): the wheel at twenty-five pixels
  assert.equal(imperialDistrictAt(...prisonAt()), 'Prison District');
  assert.equal(imperialDistrictAt(...polar(IMPERIAL.university.b, IMPERIAL.university.r)), 'Arcane University');
  assert.equal(imperialDistrictAt(...polar(180, 7500)), 'Waterfront District');
  assert.equal(imperialDistrictAt(...polar(300, 7400)), 'City Isle');
  assert.equal(imperialDistrictAt(...polar(300, 9000)), null, 'the lake');
  assert.equal(imperialDistrictAt(...polar(300, IMPERIAL.lake + 20)), 'Rumare Shore', 'TS5: the land past the lake, no district of the city\'s');
  assert.equal(IC.districtOf(100, 100), PALACE, 'IC-GRAND: the districts by cell, a law');
  assert.equal(IC.districtOf(0, 0), null, 'the land past the lake none');
  assert.ok(Math.abs(imperialBearing(...polar(123.4, 50)) - 123.4) < 1e-9 && Math.abs(imperialBearing(0, -5)) < 1e-9 && Math.abs(imperialBearing(5, 0) - 90) < 1e-9);
  // the canon's own placings: the Prison on the isle's north-eastern shore (PIN MOVED, TESA-LORE: it stood north of
  // north-east, in the north pixel), the University south-east, Talos Bridge west, the Waterfront south
  assert.ok(IMPERIAL.prison.b === 45 && IMPERIAL.university.b === 135 && IMPERIAL.bridge.b === 270 && IMPERIAL.waterfront.b0 < 180 && IMPERIAL.waterfront.b1 > 180);
});

// ── THE SLICES ──────────────────────────────────────────────────

test('TESA11 the slices: six hundred and twenty-five (PIN MOVED, IC-GRAND; TS5 forty-nine), each named for the district holding most of it (the centre the city\'s own; the lake Lake Rumare, the land past it Rumare Shore), its ordinal (the centre 0), its own map id and location index - every one a capital\'s, a place the port made', () => {
  assert.deepEqual([capitalSpan(IC), capitalCentre(IC), capitalSpan(CAPITALS[1]), capitalCentre(CAPITALS[1])], [25, 312, 1, 0]);
  const names = Array.from({ length: N * N }, (_, s) => imperialSliceName(s));
  assert.equal(names[CENTRE], 'Imperial City');
  for (const s of [0, N - 1, N * (N - 1), N * N - 1]) assert.equal(names[s], 'Rumare Shore', `corner ${s}: the land past the lake`);
  for (const s of [12, 300, 324, 612]) assert.equal(names[s], 'Lake Rumare', `side ${s}: the lake`);
  for (const d of ['Palace District', 'Market District', 'Arena District', 'Arboretum', 'Temple District', 'Talos Plaza District', 'Elven Gardens District', 'Prison District', 'Arcane University', 'Waterfront District', 'City Isle']) assert.ok(names.includes(d), `${d} names a slice`);
  assert.deepEqual(Array.from({ length: N * N }, (_, s) => capitalSliceName(IC, s)), names);
  assert.equal(capitalSliceName(CAPITALS[1], 0), 'Solitude');
  assert.deepEqual(Array.from({ length: N * N }, (_, s) => capitalSliceOrdinal(IC, s)), Array.from({ length: N * N }, (_, s) => (s === CENTRE ? 0 : s < CENTRE ? s + 1 : s)));
  const ids = Array.from({ length: N * N }, (_, s) => capitalPlaceId(0, capitalSliceOrdinal(IC, s)));
  assert.equal(new Set(ids).size, N * N);
  assert.equal(capitalPlaceId(0, 0), capitalPlaceId(0), 'the centre the capital\'s own id');
  for (const id of ids) assert.ok(isCapitalPlaceId(id) && isCountryPlaceId(id));
  const others = CAPITALS.slice(1).map((_, k) => capitalPlaceId(k + 1));
  assert.ok(ids.every((id) => !others.includes(id)), 'apart from every other capital\'s');
  assert.equal(new Set(Array.from({ length: N * N }, (_, s) => capitalLocationIndex(0, capitalSliceOrdinal(IC, s)))).size, N * N);
});

test('TESA11 the pixel law over six hundred and twenty-five (PIN MOVED, IC-GRAND; TS5 forty-nine): the centre the nearest pixel all of whose pixels are the Imperial Province\'s land; every slice on its pixel, the centre\'s pin Arena\'s place of its name', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const at = capitalPixel(IC);
  assert.deepEqual(at, { px: 2069, py: 658 });   // PIN MOVED (IC-RING): the middle of Lake Rumare's ring, (2177, 612) on its east rim before
  const hs = (N - 1) / 2;
  for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
    const o = capitalOnPixel(at.px + sx - hs, at.py + sy - hs);
    assert.deepEqual([o.cap, o.k, o.s, [...o.slice], o.centre], [IC, 0, sy * N + sx, [sx, sy], at]);
  }
  assert.equal(capitalOnPixel(at.px + hs + 1, at.py), null);
  assert.equal(capitalOnPixel(at.px, at.py - hs - 1), null);
  assert.deepEqual(capitalPin({ name: 'Imperial City', province: 'Imperial' }), at);
  // a picture whose Imperial land begins at column 172, east of the point's: the Bay's pixels of column 171 another
  // province's - the centre moves east till all six hundred and twenty-five stand on the Imperial land, twelve past the
  // single pixel's law
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(9);
  for (let y = 0; y < h; y++) for (let x = 0; x < 172; x++) province[y * w + x] = 3;
  setTamrielTrace({ w, h, land, province });
  const first = 2077;   // the first Bay pixel whose centre is column 172's: (2077.5 + 589) / 15.5 = 172.03 (PIN MOVED, IC-RING: 2185 and 179 before)
  assert.deepEqual([Math.floor((first - 1 + 0.5 + 589) / 15.5), Math.floor((first + 0.5 + 589) / 15.5)], [171, 172]);
  assert.deepEqual(capitalPixel(IC), { px: first + hs, py: 658 }, 'its west slice on the land\'s first pixel');   // PIN MOVED (IC-GRAND): twelve slices west of its centre (TS5's three)
  assert.deepEqual(capitalPixel({ ...IC, span: 1 }), { px: first, py: 658 }, 'one pixel: the first');
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

test('TESA11 a slice\'s location: its eight by eight of the plan (its hash the plan\'s), its name, id and index, its buildings\' seeds its own (PIN MOVED, IC-PROPS: on a plan that lays Daggerfall\'s blocks - the city\'s lays none); every slice\'s ground flattened to the centre\'s pixel; Arena\'s slot on the centre alone (PIN MOVED, IC-GRAND: every slice of six hundred and twenty-five; Daggerfall\'s arena\'s block in the Arena District\'s cell; no garden)', () => {
  const plan = PLAN();
  const kinds = [...new Set(plan.flat())].filter((c) => c !== 'L' && c !== 'O' && c !== IMPERIAL_ARENA_CODE && !isOwn(c));
  const names = new Map(kinds.map((k) => [k, [`${k}AA00.RMB`, `${k}AA01.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
  const base = { name: 'Broadvale', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
  const seeds = new Set(), bySector = [];
  const wayCells = new Set(capitalApproachCells(IC, capitalDims(IC)).map(([r, c]) => `${r},${c}`));
  assert.equal(wayCells.size, 4, 'ROAD-FOLLOW: the approach over four open cells');
  let arenaSlices = 0;
  for (let s = 0; s < N * N; s++) {
    const sx = s % N, sy = Math.floor(s / N), px = 2069 + sx - (N - 1) / 2, py = 658 + sy - (N - 1) / 2;
    const loc = synthesizeCapitalLocation({ cap: IC, k: 0, s }, { base, names, blockOf: (n) => (n.startsWith('TES') || n === ARENA_BLOCK ? null : fh), px, py, arena: s === CENTRE ? { id: 0 } : undefined });
    const sub = plan.slice(sy * 8, sy * 8 + 8).map((r) => r.slice(sx * 8, sx * 8 + 8));
    const ed = loc.exterior.exteriorData, so = capitalSliceOrdinal(IC, s);
    assert.equal(loc.name, imperialSliceName(s));
    assert.deepEqual([ed.width, ed.height, ed.blockNames.length, ed.mapId, loc.locationIndex], [8, 8, 64, capitalPlaceId(0, so), capitalLocationIndex(0, so)]);
    assert.deepEqual(ed.blockNames, capitalBlockNames(sub, 0, names, undefined, [sx * 8, sy * 8]));
    const R = CAPITAL_RIM_TILES, edge = N - 1;   // TESA x AUDIT TESA II: the rim's tiles on its outer sides
    assert.deepEqual(loc.capital, { key: 'imperial-city', k: 0, s, flattenAt: { px: 2069, py: 658 }, rim: { W: sx === 0 ? R : 0, E: sx === edge ? R : 0, N: sy === 0 ? R : 0, S: sy === edge ? R : 0 } }, `${s}: flattened to the centre's`);
    assert.equal('arena' in loc, s === CENTRE);
    // PIN MOVED (ROAD-FOLLOW, 03-World/Town-Shapes.md ROAD-FOLLOW): but a cell Talos Bridge's approach crosses, a block of its own
    assert.ok(sub.flat().every((c, i) => c !== 'O' || ed.blockNames[(7 - Math.floor(i / 8)) * 8 + (i % 8)] === (wayCells.has(`${sy * 8 + Math.floor(i / 8)},${sx * 8 + (i % 8)}`) ? capitalApproachName(IC, sx * 8 + (i % 8), sy * 8 + Math.floor(i / 8)) : TOWN_OUTLINE_BLOCK)), 'TS5: open ground the open block');
    sub.forEach((row, i) => row.forEach((c, j) => { if (isOwn(c)) assert.equal(ed.blockNames[(7 - i) * 8 + j], imperialOwnName(sy * 8 + i, sx * 8 + j)); }));
    if (ed.blockNames.includes(ARENA_BLOCK)) arenaSlices++;
    const classic = sub.flat().filter((c) => c !== 'L' && c !== 'O' && c !== IMPERIAL_ARENA_CODE && !isOwn(c)).length;
    assert.equal(loc.exterior.buildings.length, classic);
    for (const b of loc.exterior.buildings) { assert.equal(seeds.has(b.nameSeed + ':' + b.sector + ':' + s), false); seeds.add(b.nameSeed + ':' + b.sector + ':' + s); }
    if (loc.exterior.buildings.length) bySector.push(new Map(loc.exterior.buildings.map((b) => [b.sector, b.nameSeed])));
  }
  assert.equal(arenaSlices, 1, 'IC-GRAND: Daggerfall\'s arena in one slice, its block the arena\'s own');
  // PIN MOVED (IC-PROPS, 2026-10-27: "Old daggerfall city layout placements are in imperial city"): no slice of the city
  // stands one of Daggerfall's blocks now - its buildings are its fabric's, each record its own seed
  // (world/imperialFabricBuildings.js, test/world/icbld_buildings.test.js) - so none is on a slice's list
  assert.equal(bySector.length, 0, 'no slice a building of Daggerfall\'s list');
  // each slice's seeds its own, held on a plan that lays Daggerfall's blocks: two slices' buildings in the same cell of
  // their grids named apart (PIN MOVED, IC-GRAND: every slice against the first - the same sector's seed a shared one if
  // the slice's ordinal were not in it)
  const laid = { ...IC, slicePlan: () => Array.from({ length: 8 }, () => Array(8).fill('GENR')) };
  for (const s of [1, 40, 300, 600]) {
    const sx = s % N, sy = Math.floor(s / N);
    const loc = synthesizeCapitalLocation({ cap: laid, k: 0, s }, { base, names: new Map([['GENR', ['GENRAA00.RMB']]]), blockOf: () => fh, px: 2069 + sx - (N - 1) / 2, py: 658 + sy - (N - 1) / 2 });
    bySector.push(new Map(loc.exterior.buildings.map((b) => [b.sector, b.nameSeed])));
  }
  let pairs = 0, same = 0;
  for (const m of bySector.slice(1)) for (const [sector, seed] of m) if (bySector[0].has(sector)) { pairs++; if (bySector[0].get(sector) === seed) same++; }
  assert.ok(pairs >= 10 && same < pairs / 10, `each slice's seeds its own: ${same} of ${pairs} the same`);
  assert.equal('flattenAt' in synthesizeCapitalLocation({ cap: CAPITALS[2], k: 2 }, { base, names: new Map([...names, ...['MAGE', 'GENR', 'TVRN', 'RESI', 'LIBR', 'ALCH', 'GEMS', 'BOOK', 'ARMR', 'TEMP', 'PAWN', 'GRVE', 'BANK', 'FIGH'].map((k) => [k, [`${k}AA00.RMB`]])]), blockOf: () => fh, px: 1, py: 1 }).capital, false, 'a one-pixel capital flattens as any location (PIN MOVED, AUDIT TESA II C2: an inland one - a shore capital stands at the sea\'s floor)');
});

// ── THE GROUND ──────────────────────────────────────────────────

test('TESA11 the ground\'s laws: the lake\'s water off the isle; the plaza\'s and Green Emperor Way\'s stone, its lawns\' grass; the walls\' feet stone; the tower\'s plinth, the tombs and the Temple closed; trees on grass alone (PIN MOVED, IC-GRAND: the wheel at twenty-five pixels; the Colosseum\'s stands and ways retired with it - Daggerfall\'s arena stands in its cell; the Arboretum\'s grass the fabric\'s park, world/imperialFabric.js)', () => {
  assert.equal(imperialTile(...polar(300, 9000)), 0);
  assert.equal(imperialTile(0, 150), 3, 'the plaza');
  assert.equal(imperialTile(...polar(10, (IMPERIAL.way.r0 + IMPERIAL.way.r1) / 2)), 3, 'Green Emperor Way');
  assert.equal(imperialTile(...polar(10, 1000)), 2, 'its lawns');
  assert.equal(imperialTile(...polar(50, IMPERIAL.cityWall.r)), 3, 'the city wall\'s foot');
  assert.equal(imperialTile(...polar(45, 4000)), 3, 'the Market\'s radial road (IC-GRAND: its streets the fabric\'s - imperialTile -1 there)');
  assert.equal(imperialTile(...polar(52, 4000)), -1, 'off the roads, the fabric\'s');
  assert.equal(imperialTile(...polar(300, IMPERIAL.lake + 5)), 1, 'TS5: the far shore\'s sand');
  assert.equal(imperialTile(...polar(300, IMPERIAL.lake + 40)), OPEN_TILE, 'TS5: past it, the land\'s own');
  let park = 0;
  for (let k = 0; k < 80 && !park; k++) { const [x, z] = polar(128 + (k % 9) * 0.5, 3600 + k * 17); if (fabricGroundAt(x, z) === GROUND.park) park++; }
  assert.ok(park > 0, 'the Arboretum\'s park, the fabric\'s');
  assert.equal(imperialClosed(0, 0), true);
  assert.equal(imperialClosed(...tombAt(0)), true, 'a tomb');
  assert.equal(imperialClosed(...polar(10, 1000)), false, 'the lawn');
  assert.equal(imperialClosed(...polar(IMPERIAL.temple.b, IMPERIAL.temple.r)), true, 'the Temple');
  let grass = 0, trees = 0;
  for (let x = -10000; x < 10000; x += 51.2) for (let z = -10000; z < 10000; z += 51.2) {
    const t = imperialTree(x, z);
    if (t >= 0) { trees++; assert.equal(imperialTile(x, z), 2, `${x},${z}`); assert.ok([12, 15, 16, 18].includes(t)); }
    if (imperialTile(x, z) === 2) grass++;
  }
  assert.ok(trees > grass / 30 && trees < grass / 3, `${trees} trees on ${grass} grass`);
});

test('TESA11 the port blocks (PIN MOVED, IC-GRAND: a family on the world-data door, each made when first read): a cell of the city\'s own its block, its ground and trees its laws\'; its landmarks carried each by its own slice (the centre\'s by the anchor\'s block), laid at the city\'s middle; each landmark in its parts, a part the whole\'s triangles in its slice', () => {
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const blockOf = (name) => getDFBlockReplacementData(getNewDFBlockIndex(name), name);
  assert.deepEqual(IC.models, IMPERIAL_PARTS.map((q) => q.id), 'PIN MOVED (TS5): its landmarks carried in parts');
  assert.deepEqual(IC.drawn, Object.values(IMPERIAL_MODELS));
  const firsts = capitalSliceCarriers(IC);
  for (const s of [CENTRE, CENTRE + 3, CENTRE - 2 * N]) {
    const code = s === CENTRE ? capitalCarrier(IC) : firsts.get(s), [r, c] = [parseInt(code.slice(1, 3), 36), parseInt(code.slice(3, 5), 36)];
    assert.equal(Math.floor(r / 8) * N + Math.floor(c / 8), s, `the carrier of slice ${s} in it`);
    const laid = layoutRmbBlock(blockOf(imperialOwnName(r, c)));
    for (const q of IMPERIAL_PARTS.filter((p) => p.s === s)) {
      assert.equal(IMPERIAL_CARRY[q.id], s);
      const m = laid.models.find((x) => x.modelIdNum === q.id);
      assert.ok(m, `${q.id} laid`);
      assert.deepEqual([...m.matrix.slice(12, 15)].map((v) => +v.toFixed(2)), [+((HALF - c) * B).toFixed(2), 0, +((r + 1 - HALF) * B).toFixed(2)].map((v) => v + 0), `${q.id} at the city's middle`);
    }
  }
  // each landmark in its parts - a part the whole's triangles whose middles stand in its slice (a long wall's built of
  // its runs near the slice alone, world/capitalModels.js imperialPartBuild - the same triangles)
  const tower = customModelFor(IMPERIAL_MODELS.whiteGoldTower), towerParts = IMPERIAL_PARTS.filter((q) => q.base === IMPERIAL_MODELS.whiteGoldTower);
  assert.deepEqual(towerParts.map((q) => q.s), [CENTRE], 'the tower wholly in the centre');
  assert.equal(customModelFor(towerParts[0].id).indices.length, tower.indices.length);
  const wall = customModelFor(IMPERIAL_MODELS.cityWall);
  for (const q of IMPERIAL_PARTS.filter((p) => p.base === IMPERIAL_MODELS.cityWall).slice(0, 3)) {
    assert.equal(q.id, imperialPartId(q.base, q.s));
    assert.equal(customModelFor(q.id).indices.length, modelPart(wall, imperialSliceRect(q.s)).indices.length, `the city wall's part in ${q.s}: the whole's triangles there`);
    assert.ok(customModelFor(q.id).indices.length > 0);
    assert.equal(modelPart(imperialPartBuild(q.base, imperialSliceRect(q.s)), imperialSliceRect(q.s)).indices.length, customModelFor(q.id).indices.length);
  }
  // an own block's tiles and trees its laws' at its cells - one of Green Emperor Way's lawns, with its trees
  let lawn = null;
  for (let r = 92; r < 108 && !lawn; r++) for (let c = 92; c < 108 && !lawn; c++) {
    const [x, z] = [(c - HALF + 0.5) * B, (r - HALF + 0.5) * B];
    if (isOwn(imperialCell(r, c)) && Math.hypot(x, z) > IMPERIAL.plaza + 120) lawn = [r, c];
  }
  const [lr, lc] = lawn, g = blockOf(imperialOwnName(lr, lc)).rmbBlock.fldHeader.groundData;
  let planted = 0;
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const [x, z] = [(tx + 0.5) * 6.4, (15 - ty + 0.5) * 6.4], at = anchorMetres(IC, lc, lr, x, z);
    assert.equal(g.groundTiles[tx][ty].tileBitfield, imperialTile(...at));
    const tree = g.groundScenery[tx][ty].textureRecord;   // the law's tree, but where a landmark's face stands over it
    if (tree >= 0) { assert.equal(tree, imperialTree(...at)); planted++; }
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

test('TESA11 the White-Gold Tower (PIN MOVED, IC-GRAND - the team\'s spec the owner forwarded: "500m+ height, like 150-200m diameter in the foundation and like 60-70m diameter in the shaft"; TS5\'s 1360 m over a 344 m plinth before; PIN MOVED again, the owner, 2026-10-26: "the imperial city tower model needs to be much larger and taller like this with the surrounding gate have large pillars like the image shows"): ROUND, 1360 m to its gilt spire\'s tip, out of the palace\'s rotunda 320 m across under its low dome; its shaft fluted in tiers, 144 m across at its foot tapering to 108 m, every tier\'s cornice round it; marble and gold, the palace\'s door on the east, its plaza round it (mutants: the tower short; the shaft unfluted; the tiers unringed)', () => {
  const t = buildImperialTower(), T = IMPERIAL.tower;
  sane(t);
  const { lo, hi } = bounds(t);
  assert.ok(Math.abs(hi[1] - T.spireTop) < 1e-6 && T.spireTop === 1360, 'TS5\'s 1360 m, the owner\'s "much larger and taller"');
  assert.ok(Math.abs(lo[1] + 3) < 1e-6, 'its rotunda sunk');
  assert.ok(2 * T.plinthR >= 300 && T.plinthH < T.plinthR / 2 && T.domeH > 0, 'a wide, low, domed rotunda');
  assert.ok(2 * T.shaftR0 > 120 && T.shaftR1 < T.shaftR0 && T.sides >= 32, 'its shaft round, wide, tapering');
  assert.ok(Math.max(hi[0], -lo[0], hi[2], -lo[2]) <= T.plinthR + 1.5, 'the rotunda its widest');
  // round and fluted: at a tier's middle the shaft's faces turn every way, and its corners stand at two radii (the ribs)
  const yMid = T.plinthH + T.domeH * 0.6 + T.tier / 2, rs = new Set();
  for (let i = 0; i < t.positions.length; i += 3) if (Math.abs(t.positions[i + 1] - (T.plinthH + T.domeH * 0.6)) < 0.01) rs.add(Math.round(Math.hypot(t.positions[i], t.positions[i + 2]) * 10));
  assert.ok([...rs].some((r) => Math.abs(r / 10 - T.shaftR0) < 0.2) && [...rs].some((r) => Math.abs(r / 10 - T.shaftR0 * (1 - T.flute)) < 0.2), 'fluted: corners at the shaft\'s radius and inside it');
  // in tiers: a cornice proud of the shaft at every tier's top
  const foot = T.plinthH + T.domeH * 0.6, rAt = (y) => T.shaftR0 + (T.shaftR1 - T.shaftR0) * ((y - foot) / (T.shaftTop - foot));
  for (let y = foot + T.tier; y < T.shaftTop - 1; y += T.tier) assert.equal(crosses(t, [rAt(y) + 12, y - 1, 0], [rAt(y) + 0.8, y - 1, 0]), true, `a cornice at ${y.toFixed(0)} m`);
  assert.equal(crosses(t, [T.shaftR0 + 12, yMid, 0], [T.shaftR0 + 4, yMid, 0]), false, 'the shaft\'s face between them');
  assert.ok(IMPERIAL.plaza > T.plinthR + 20 && IMPERIAL.plaza < IMPERIAL.tombs.r - IMPERIAL.tombs.w, 'its plaza round its foundation, inside the tombs');
  for (const [mx, mz] of IC.markers) assert.ok(Math.hypot(mx, mz) > T.plinthR && !imperialClosed(mx, mz) && imperialTile(mx, mz) === 3, 'its start markers on the plaza, clear of it');
  const recs = new Set(t.subMeshes.map((s) => s.textureRecord));
  for (const r of [CAPITAL_ART.marble, CAPITAL_ART.gold, CAPITAL_ART.dark]) assert.ok(recs.has(r));
  assert.equal(crosses(t, [T.plinthR + 20, T.plinthH / 2, 30], [T.plinthR * 0.7, T.plinthH / 2, 30]), true, 'the plinth stands in the way');
});

test('TESA11 the walls (PIN MOVED, IC-GRAND - the team\'s spec: "Walls should be higher. Like 35-40 meters"; TS5\'s 28 m before): the city wall 38 m, its nine gates open under their lintels and walled between; the palace wall\'s six gates; each district wall three gates where the ring roads cross it, walled between; all inside the isle - each asked of the runs near the probe (a long wall\'s part is built so, world/capitalModels.js imperialPartBuild)', () => {
  const W = IMPERIAL.cityWall, pw = IMPERIAL.palaceWall, D = IMPERIAL.districtWall;
  assert.ok(W.h >= 35 && W.h <= 40 && W.h === 38);
  const near = (p, m = 60) => nearRect([p[0] - m, p[2] - m, p[0] + m, p[2] + m], 40);
  const city = (p) => buildCityWall(undefined, near(p)), palace = (p) => buildPalaceWall(undefined, near(p)), districts = (p) => buildDistrictWalls(undefined, near(p));
  for (const m of [city(P3(50, W.r, 0)), palace(P3(50, pw.r, 0)), districts(P3(0, 4000, 0)), buildEmperorsTombs()]) sane(m);
  for (const b of W.gates) {
    const m = city(P3(b, W.r, 0));
    assert.equal(crosses(m, P3(b, W.r - 10, W.gateH / 2), P3(b, W.r + 10, W.gateH / 2)), false, `the gate at ${b} open`);
    assert.equal(crosses(m, P3(b, W.r - 10, (W.gateH + W.h) / 2), P3(b, W.r + 10, (W.gateH + W.h) / 2)), true, 'its lintel');
  }
  for (const b of [51, 101, 201, 301]) assert.equal(crosses(city(P3(b, W.r, 0)), P3(b, W.r - 10, 4), P3(b, W.r + 10, 4)), true, `walled at ${b}`);
  for (const [, b] of IMPERIAL_SECTORS) {
    assert.equal(crosses(palace(P3(b + 30, pw.r, 0)), P3(b + 30, pw.r - 6, 3), P3(b + 30, pw.r + 6, 3)), false, `the palace gate to ${b + 30}`);
    assert.equal(crosses(palace(P3(b + 10, pw.r, 0)), P3(b + 10, pw.r - 6, 3), P3(b + 10, pw.r + 6, 3)), true);
  }
  assert.deepEqual(D.gates.map((t) => pw.r + (W.r - pw.r) * t), IMPERIAL.roads.rings, 'the district gates on the ring roads');
  for (const [[ax, az], [bx, bz]] of districtWallLines()) {
    const ux = (bx - ax), uz = (bz - az), l = Math.hypot(ux, uz), nx = -uz / l, nz = ux / l;
    for (const t of D.gates) {
      const r = pw.r + (W.r - pw.r) * t, mx = ux / l * (r - pw.r) + ax, mz = uz / l * (r - pw.r) + az, m = districts([mx, 0, mz]);
      assert.equal(crosses(m, [mx - nx * 5, D.gateH / 2, mz - nz * 5], [mx + nx * 5, D.gateH / 2, mz + nz * 5]), false, 'a district gate');
      assert.equal(crosses(m, [mx + ux / l * 40 - nx * 5, 3, mz + uz / l * 40 - nz * 5], [mx + ux / l * 40 + nx * 5, 3, mz + uz / l * 40 + nz * 5]), true, 'walled beside it');
    }
  }
  const { hi } = bounds(city(P3(0, W.r, 0)));
  assert.ok(Math.max(hi[0], hi[2]) <= W.r + W.watchR + 4 && W.r + W.watchR + 4 < IMPERIAL.isle);   // PIN MOVED (TESA-LORE): its watch towers the widest
});

test('TESA11 the districts\' landmarks (PIN MOVED, IC-GRAND: the Colosseum retired - Daggerfall\'s arena stands in its cell, test/world/icgrand_arena.test.js): the Temple of the One\'s dome over its roof and its towers over the dome; Talos Plaza\'s dragon on its plinth; the Prison\'s Bastion; the University\'s tower; the Waterfront\'s piers over the water; Talos Bridge to the lake\'s far shore', () => {
  const temple = buildTempleOfTheOne(), statue = buildTalosStatue(), prison = buildImperialPrison(), uni = buildArcaneUniversity(), front = buildWaterfront(), bridge = buildTalosBridge();
  for (const m of [temple, statue, prison, uni, front, bridge]) sane(m);
  assert.equal(Object.hasOwn(IMPERIAL, 'colosseum'), false, 'no Colosseum of the port\'s own');
  const T = IMPERIAL.temple, tb = bounds(temple);
  assert.ok(tb.hi[1] > T.h + T.domeR * 1.5 && tb.hi[1] >= T.towerH + T.towerS * 1.8 - 1e-6, 'the towers\' spires its top');
  const sb = bounds(statue), [sx] = polar(IMPERIAL.statue.b, IMPERIAL.statue.r);
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
  assert.ok(Math.abs(bb.lo[0] + IMPERIAL.lake + IMPERIAL.bridge.landing) < 1e-3 && bb.lo[0] >= -HALF * B + CAPITAL_RIM_M && bb.hi[0] <= -IMPERIAL.cityWall.r && bb.hi[1] <= IMPERIAL.bridge.deck + IMPERIAL.bridge.parapet + 1e-3, 'from the west gate to the far shore\'s landing, short of the rim (PIN MOVED, TS5; AUDIT TESA II C1)');
});

test('TESA11 the install: the twelve on the model door (PIN MOVED, IC-GRAND: the Colosseum\'s 910205 retired - Daggerfall\'s arena\'s 864102 stands in its cell), each the drawn model turned north', () => {
  installCapitals({ addTextures: () => 0 });
  for (const id of Object.values(IMPERIAL_MODELS)) assert.ok(customModelFor(id)?.positions.length > 0, `${id}`);
  assert.equal(Object.values(IMPERIAL_MODELS).includes(910205), false);
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
  // PIN MOVED (WG2-TOWNS): a World 2.0 town's own ground after it (scenes/pixelBuild.js, world/settle2/settle2Location.js)
  assert.match(hostText('src/scenes/world.js'), /flattenAt: dfLocation\?\.capital\?\.flattenAt \?\? dfLocation\?\.settle2\?\.ground \?\? null,/);
});

test('TESA11 the host: a slice stood once on its pixel - a slice moved is stood again; the plan\'s Arena slot the centre\'s', () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /if \(at && had\.capital\.k === at\.k && had\.capital\.s === at\.s && \(had\.arena\?\.id \?\? null\) === \(slot\?\.id \?\? null\)/);
  assert.match(read('src/world/arenaPlaces.js'), /standArenaPixels\(model, \/\*\* @type \{any\} \*\/ \(tamrielTrace\(\)\), capitalPin, \(bx, by\) => !!capitalOnPixel\(bx, by\), continentDry\);/, 'PIN MOVED (AUDIT TESA II P8): a port on the dry shore');
  assert.match(read('src/world/arenaPlaces.js'), /const free = \(bx, by\) => !inBay\(bx, by\) && !byPixel\.has\(`\$\{bx\},\$\{by\}`\) && !reserved\?\.\(bx, by\) && own\(/);
});

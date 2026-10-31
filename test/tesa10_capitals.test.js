// TESA10 (2026-10-12, the owner: "Can we redesign each capital city as close to 1:1 with other games. For example,
// oblivion's capital, skyrims solitude, etc"; "You build them yourself. No files needed"; bible/03-World/
// Arena-Provinces.md TESA10) - THE CAPITALS, BUILT BY HAND, pinned. The Imperial City first: its plan (a lake, a towered
// wall of eight sides, the districts of Daggerfall's own city blocks, the White-Gold Tower's grounds), its port blocks, its
// buildings (each block's own records under the capital's seeds), its landmarks and their pictures, its id, its pixel,
// Arena's place of its name pinned to it, and the host that stands it first past the Bay.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CAPITAL_LANE, CAPITAL_INDEX_BASE, CAPITAL_SALT, CAPITAL_BLOCK_INDEX, CAPITAL_BLOCKS, CAPITAL_MODELS, CAPITALS, capitalGardenName, CAPITAL_CLOSED_BYTE, ownBlockOf,
  BLOCK_M, capitalPlaceId, capitalLocationIndex, isCapitalPlaceId, capitalPixel, capitalOnPixel,
  capitalPin, capitalBase, cityBlockNames, capitalBlockNames, capitalBuildings, portBlockJson, miscModelAt, tileCentre, autoCentre,
  capitalPortBlocks, synthesizeCapitalLocation, capitalDistrict, capitalCarrier, anchorMetres, SOLITUDE, SOLITUDE_PLAN, SOLITUDE_DISTRICTS,
  SOLITUDE_BLOCKS, capitalLakeName, inCapitalRim, CAPITAL_NO_GROUND,
  capitalSlicePort, capitalCentrePixel,   // BAY-LEFT-SEA: the host's ask hands its harbour's port word
} from '../src/world/tamrielCapitals.js';
import { solitudeGroundTile, SOLITUDE_TILES, SOLITUDE_LEVELS } from '../src/world/solitudeRelief.js';   // PIN MOVED (SOLITUDE-RELIEF): its ground
import {
  buildSolitudeArch, buildBluePalace, buildSolitudeWall, buildCastleDour, buildSolitudeDocks, archTop, archOpening, solitudeWallCorners,
  solitudeTowers,
} from '../src/world/capitalSolitude.js';
import {
  CAPITAL_ARCHIVE, CAPITAL_ART, CAPITAL_ART_SIZE, capitalArt, installCapitals, _resetCapitals, northward,
} from '../src/world/capitalModels.js';
import { LAIR_LANE, isCountryPlaceId } from '../src/world/tamrielCountry.js';
import { LAIR_INDEX_BASE } from '../src/world/tamrielDungeons.js';
import { standArenaPixels } from '../src/world/arenaPlaces.js';
import { buildImperialTower, buildTalosBridge } from '../src/world/capitalImperial.js';
import { imperialTile, imperialClosed, imperialSliceName, imperialPartId, imperialSlicePlan, imperialClassic, IMPERIAL_SPAN } from '../src/world/imperialCity.js';   // PIN MOVED (IC-GRAND): the plan and the slices' names by their laws
import { getDFBlockReplacementData, getNewDFBlockIndex } from '../src/formats/worldData/worldDataReplacement.js';
import { imperialOwnName } from '../src/world/imperialBlocks.js';
import { setTamrielFit, pictureToBay, inBay, tamrielFit as tamrielFitNow } from '../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace, tamrielLandVersion, provinceKeyBeyondBay } from '../src/world/tamriel/tamrielLand.js';
import { CITIES } from '../src/world/tamriel/tamrielGeography.js';
import { blockFromJson } from '../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { customModelFor } from '../src/world/customModels.js';
import { hash32 } from '../src/world/spawnedDungeons.js';
import { LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { capitalsOn } from '../src/scenes/shared.js';
import { locationKeyOf } from '../src/world/locationKey.js';   // PIN MOVED (BAY-LEFT-B): the clone carries its own buildings' key
import { fabricSliceSites } from '../src/world/imperialFabricBuildings.js';   // PIN MOVED (BAY-LEFT-B): and the Imperial City's fabric's
import { regionOfTheatre } from '../src/formats/mapsTables.js';   // PIN MOVED (AUDIT FOUNDATION A1): the clone's region its province's
import { THEATRE_KEYS } from '../src/world/worldWide/worldGrid.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js
import { createSwapBehind } from '../src/scenes/swapBehind.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
import { URBAN_ARCHIVE, URBAN_ART } from '../src/world/urban/urbanRecords.js';   // URBANIZER U2
import { CAPITAL_CUT_RECORDS } from '../src/world/capitalShapes.js';   // CAPITAL-TREES: a tree's flats
afterEach(() => setTamrielFit(null));

// ── THE ID, THE PIXEL, THE PIN ──────────────────────────────────

test('TESA10 the id: the capitals\' lane after the lairs\', the ordinal in the low 20 with 0x80000; a place the port made (no house sold, no deed read); the index past the lairs\'', () => {
  assert.equal(CAPITAL_LANE, LAIR_LANE + 1);
  for (const k of [0, 1, 7]) {
    const id = capitalPlaceId(k);
    assert.equal(id >>> 20, CAPITAL_LANE);
    assert.equal(id & 0xfffff, 0x80000 | k);
    assert.ok(isCapitalPlaceId(id) && isCountryPlaceId(id));
    assert.equal(capitalLocationIndex(k), -(CAPITAL_INDEX_BASE + k));
    assert.ok(capitalLocationIndex(k) < -(LAIR_INDEX_BASE + (1 << 19)));
  }
  assert.equal(isCapitalPlaceId((CAPITAL_LANE << 20) | 5), false, 'the low bit');
  assert.equal(isCapitalPlaceId((LAIR_LANE << 20) | 0x80000), false, 'a lair');
  assert.equal(isCountryPlaceId(((CAPITAL_LANE + 1) << 20) | 0x80000), false, 'nothing past it');
});

test('TESA10 the pixel: the capital\'s point on Daggerfall\'s map (TAMRIEL1\'s CITIES) on the live fit, the one capital a pixel, kept a fit; Arena\'s place of its name and province pinned to it, no other', () => {
  const ic = CAPITALS[0];
  assert.equal(ic.name, 'Imperial City');
  assert.deepEqual(ic.at, CITIES.find((c) => c.name === 'Imperial City' && c.capital).at, 'TAMRIEL1\'s own point');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const [x, y] = pictureToBay(171.5, 99.5);
  assert.deepEqual(capitalPixel(ic), { px: Math.floor(x), py: Math.floor(y) });
  assert.deepEqual(capitalPixel(ic), { px: 2069, py: 658 }, 'the freeware\'s fit');
  assert.ok(!inBay(2069, 658));
  assert.equal(capitalOnPixel(2069, 658).cap, ic);
  assert.equal(capitalOnPixel(2069, 658).k, 0);
  // PIN MOVED (TESA11): the Imperial City over nine pixels - its east slice beside it, nothing past them; PIN MOVED (TOWN-SHAPES
  // TS5): over forty-nine, three a side of its centre; PIN MOVED (IC-GRAND): over six hundred and twenty-five, twelve a side
  assert.deepEqual([capitalOnPixel(2070, 658).cap, capitalOnPixel(2070, 658).s], [ic, 313]);
  assert.deepEqual([capitalOnPixel(2081, 658).cap, capitalOnPixel(2081, 658).s], [ic, 324]);
  assert.equal(capitalOnPixel(2082, 658), null);
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  assert.equal(capitalOnPixel(2069, 658), null, 'a new fit, the pixel moves');
  assert.equal(capitalOnPixel(1315, 495).cap, ic);
  assert.deepEqual(capitalPin({ name: 'Imperial City', province: 'Imperial' }), { px: 1315, py: 495 });
  assert.equal(capitalPin({ name: 'Imperial City', province: 'Skyrim' }), null);
  assert.deepEqual(capitalPin({ name: 'Solitude', province: 'Skyrim' }), capitalPixel(CAPITALS[1]), 'Solitude\'s, by the pixel law');
  assert.equal(capitalPin({ name: 'Wayrest', province: 'HighRock' }), null);
  assert.equal(capitalPin(null), null);
});

test('TESA10 Arena\'s place pinned: a place its pin names stands on that pixel exactly, before any other takes it; the rest as ever; a pin on the Bay none', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(3);
  const trace = { w, h, land, province };
  const P = (id, name, bx, by) => ({ province: 'Skyrim', provinceIndex: 2, id, kind: 'city-state', name, px: (bx + 0.5 + 400) / 10, py: (by + 0.5 + 500) / 10, snapped: 0 });
  const model = { places: [P(0, 'First', 1500, -100), P(1, 'Pinned', 1600, -150), P(2, 'OnBay', 1700, -150)] };
  const pin = (p) => (p.name === 'Pinned' ? { px: 1500, py: -100 } : p.name === 'OnBay' ? { px: 10, py: 10 } : null);
  const s = standArenaPixels(model, trace, pin);
  assert.deepEqual(s.stood.map((p) => [p.name, p.bx, p.by, !!p.pinned]), [['First', 1500, -101, false], ['Pinned', 1500, -100, true], ['OnBay', 1700, -150, false]], 'the pinned first, the first moved off it; a pin on the Bay ignored');
  assert.equal(s.byPixel.get('1500,-100').name, 'Pinned');
  assert.deepEqual(standArenaPixels(model, trace).stood.map((p) => [p.name, p.bx, p.by]), [['First', 1500, -100], ['Pinned', 1600, -150], ['OnBay', 1700, -150]], 'no pin, no change');
  assert.match(read('src/world/arenaPlaces.js'), /_model\.pixels = standArenaPixels\(model, \/\*\* @type \{any\} \*\/ \(tamrielTrace\(\)\), capitalPin, \(bx, by\) => !!capitalOnPixel\(bx, by\), continentDry\);/, 'PIN MOVED (TESA11): and no other place on a capital\'s pixels; PIN MOVED (AUDIT TESA II P8): a port on the dry shore');
});

// ── THE PLAN ────────────────────────────────────────────────────

const city = (mapId, names, o = {}) => ({ name: `C${mapId}`, mapTableData: { mapId, locationType: LOCATION_TYPES.TownCity, longitude: 0, latitude: 0 }, exterior: { exteriorData: { blockNames: names, width: 2, height: 1 }, buildings: [] }, hasDungeon: false, ...o });

test('TESA10 the blocks: every name the game\'s cities lay by its kind, sorted, never a wall or a palace; the plan\'s names - the port\'s own for its lake, gardens and grounds, a classic of each kind off the cell\'s hash; none where a kind has none', () => {
  const rows = [city(1, ['TVRNAL02.RMB', 'WALLAA00.RMB']), city(2, ['TVRNAL01.RMB', 'PALAAA00.RMB', 'TVRNAL02.RMB']), { ...city(3, ['GENRAL09.RMB']), mapTableData: { mapId: 3, locationType: LOCATION_TYPES.TownHamlet } }];
  const names = cityBlockNames(rows);
  assert.deepEqual([...names], [['TVRN', ['TVRNAL01.RMB', 'TVRNAL02.RMB']]]);
  // PIN MOVED (TESA11): the capital's own blocks handed (the Imperial City's grounds are its plan's own now)
  const own = Object.fromEntries(['C0', 'C1', 'C2', 'C3'].map((c, i) => [c, { name: `OWN${i}.RMB` }]));
  const plan = [['L', 'G', 'TVRN'], ['C0', 'C1', 'TVRN'], ['C2', 'C3', 'L']];
  const out = capitalBlockNames(plan, 0, names, own);
  // the grid's rows from the south: the plan's last row first
  assert.deepEqual(out.slice(0, 3), ['OWN2.RMB', 'OWN3.RMB', CAPITAL_BLOCKS.lake]);
  assert.deepEqual(out.slice(3, 5), ['OWN0.RMB', 'OWN1.RMB']);
  assert.deepEqual(out.slice(6, 8), [capitalLakeName(CAPITALS[0], 0, 0), capitalGardenName(CAPITALS[0], 1, 0)], 'PIN MOVED (AUDIT-TESA A6-2): a garden the capital\'s own, by its cell; PIN MOVED (AUDIT TESA II C1): a lake on the whole plan\'s outer ring too');
  assert.equal(out[8], names.get('TVRN')[hash32(CAPITAL_SALT, 0, 2, 0) % 2], 'the hash the plan\'s column and row');
  assert.equal(out[5], names.get('TVRN')[hash32(CAPITAL_SALT, 0, 2, 1) % 2]);
  assert.deepEqual(capitalBlockNames([['L'], ['G']], 0, names), [capitalGardenName(CAPITALS[0], 0, 1), capitalLakeName(CAPITALS[0], 0, 0)], 'the plan\'s south row the grid\'s first');
  assert.deepEqual(capitalBlockNames([['L']], 0, names, {}, [5, 9]), [CAPITAL_BLOCKS.lake], 'AUDIT TESA II C1: a lake off the outer ring the shared one');
  assert.equal(capitalBlockNames([['MAGE']], 0, names), null);
  // TESA11: a kind the game's cities lay none of falls back to a house, else a general store; a slice's hash the plan's
  const homes = new Map([['RESI', ['RESIAA00.RMB', 'RESIAA01.RMB', 'RESIAA02.RMB']]]);
  assert.equal(capitalBlockNames([['MAGE']], 0, homes)[0], homes.get('RESI')[hash32(CAPITAL_SALT, 0, 0, 0) % 3]);
  assert.equal(capitalBlockNames([['RESI']], 0, homes, {}, [5, 9])[0], homes.get('RESI')[hash32(CAPITAL_SALT, 0, 5, 9) % 3], 'the cell (5, 9) of the whole plan');
  assert.equal(capitalBlockNames([['G']], 0, homes, {}, [10, 13])[0], capitalGardenName(CAPITALS[0], 10, 13));
  assert.equal(capitalGardenName(CAPITALS[0], 10, 13), 'TESGIC0d0a.RMB', 'base 36 - PIN MOVED (TS5): two characters each past 36 cells');
  assert.equal(capitalGardenName(CAPITALS[1], 3, 5), 'TESGSO53.RMB', 'one on a plan of 36 or fewer');
});

test('TESA10 the buildings: each classic block\'s own named records in grid order (its guild\'s faction, its quality), under the capital\'s seeds (1 to 65535, the cell\'s and the record\'s), its sector the cell, its location the capital', () => {
  const fh = (list) => ({ rmbBlock: { fldHeader: { numBlockDataRecords: list.length, buildingDataList: [...list, { buildingType: 2, factionId: 0, quality: 1 }] } } });
  const blocks = { 'MAGEAA00.RMB': fh([{ buildingType: 11, factionId: 40, quality: 18, nameSeed: 0 }, { buildingType: 18, factionId: 0, quality: 4 }]), 'TVRNAL00.RMB': fh([{ buildingType: 15, factionId: 0, quality: 9 }, { buildingType: 23, quality: 3 }]) };
  const list = capitalBuildings([CAPITAL_BLOCKS.lake, 'MAGEAA00.RMB', 'TVRNAL00.RMB'], (n) => blocks[n] ?? null, 0, 777);
  assert.deepEqual(list.map((d) => [d.buildingType, d.factionId, d.quality, d.sector, d.locationId]), [[11, 40, 18, 1, 777], [15, 0, 9, 2, 777]], 'houses, walls and the records past the count none');
  assert.equal(list[0].nameSeed, (hash32(CAPITAL_SALT, 0, 1, 0, 7) % 65535) + 1);
  assert.ok(list.every((d) => d.nameSeed >= 1 && d.nameSeed <= 65535));
  assert.notEqual(capitalBuildings(['MAGEAA00.RMB'], (n) => blocks[n], 1, 1)[0].nameSeed, capitalBuildings(['MAGEAA00.RMB'], (n) => blocks[n], 0, 1)[0].nameSeed, 'each capital its own');
  assert.equal(blocks['MAGEAA00.RMB'].rmbBlock.fldHeader.buildingDataList[0].nameSeed, 0, 'the block untouched');
});

// ── THE PORT BLOCKS ─────────────────────────────────────────────

test('TESA10 the port blocks: the lake all water, the garden grass with a tree in about five; a capital\'s own block its ground and its closed cells by its laws of the anchor\'s metres; the landmarks in the anchor\'s block at the city\'s middle (PIN MOVED, TESA11: the Imperial City\'s own blocks its plan\'s, its centre\'s landmarks five)', () => {
  const b = capitalPortBlocks();
  assert.deepEqual(b.slice(0, 2).map((x) => [x.name, x.index]), [[CAPITAL_BLOCKS.lake, CAPITAL_BLOCK_INDEX], [CAPITAL_BLOCKS.garden, CAPITAL_BLOCK_INDEX + 1]]);
  assert.ok(CAPITAL_BLOCK_INDEX >= 900000 && CAPITAL_BLOCK_INDEX !== 900100, 'past any BSA, apart from the arena\'s');
  const tiles = (j) => j.RmbBlock.FldHeader.GroundData.GroundTiles.map((t) => t.TileBitfield);
  assert.ok(tiles(b[0].json).every((t) => t === 0), 'the lake: water');
  assert.ok(tiles(b[1].json).every((t) => t === 2), 'the garden: grass');
  const trees = b[1].json.RmbBlock.FldHeader.GroundData.GroundScenery.filter((s) => s.TextureRecord >= 0).length;
  assert.ok(trees > 25 && trees < 80, `trees ${trees}`);
  // the Imperial City's anchor block (the plan's (99, 99) - PIN MOVED, IC-GRAND: (27, 27) of 56 at TS5 - the anchor its
  // south-east corner): its ground by the city's laws, its closed cells theirs and its landmarks' footprint's (IC-GRAND: a
  // family's block, made on the world-data door when first read - world/imperialBlocks.js)
  const ic = CAPITALS[0], code = capitalCarrier(ic);
  assert.equal(code, 'I2r2r');
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const name = imperialOwnName(99, 99), blk = getDFBlockReplacementData(getNewDFBlockIndex(name), name), g = blk.rmbBlock.fldHeader.groundData, A = blk.rmbBlock.fldHeader.autoMapData;
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) assert.equal(g.groundTiles[tx][ty].tileBitfield, imperialTile(...anchorMetres(ic, 99, 99, ...tileCentre(tx, ty))));
  let closed = 0;
  for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) {
    if (imperialClosed(...anchorMetres(ic, 99, 99, ...autoCentre(ax, ay)))) assert.equal(A[ay * 64 + ax], CAPITAL_CLOSED_BYTE);   // PIN MOVED (AUDIT-TESA A6-5): a wall's byte in no quarter
    if (A[ay * 64 + ax]) { assert.equal(A[ay * 64 + ax], CAPITAL_CLOSED_BYTE); closed++; }
  }
  assert.ok(closed > 500, 'the tower\'s plinth');
  // the landmarks, laid by the classic law, stand at the city's middle: the anchor block's south-east corner
  const laid = layoutRmbBlock(blk);
  // PIN MOVED (TS5): the centre slice's parts of the landmarks standing in it - PIN MOVED (IC-GRAND): the White-Gold
  // Tower's alone (the tombs' ring 1.4 km out, past the centre's square) - PIN MOVED (IC-GRAND's palace district, the
  // coordinator's review: "the palace at the tower's foot"): the tower's, the palace's round it and the gardens' nearest
  // statues (the tombs on Green Emperor Way's verge, 2.1 km out)
  assert.deepEqual(laid.models.map((m) => m.modelIdNum), [imperialPartId(CAPITAL_MODELS.whiteGoldTower, 312), imperialPartId(CAPITAL_MODELS.imperialPalace, 312), imperialPartId(CAPITAL_MODELS.palaceGardens, 312)]);
  for (const m of laid.models) assert.deepEqual([...m.matrix.slice(12, 15)].map((v) => +v.toFixed(3)), [102.4, 0, 0]);
  assert.deepEqual(miscModelAt(5, 51.2, 25.6), { ModelId: '5', ModelIdNum: 5, ObjectType: 0, XPos: 2048, YPos: -4, ZPos: 1024 - 4096, XRotation: 0, YRotation: 0, ZRotation: 0 });
  // the stamp's own flips (world/terrain/terrainTiles.js setLocationTiles, world/city/cityNavigation.js setBlockData) - pinned at their source
  assert.match(read('src/world/terrain/terrainTiles.js'), /const tile = groundTiles\[tileX\]\[\(RMB_TILES_PER_BLOCK - 1\) - tileY\];/);
  assert.match(read('src/world/city/cityNavigation.js'), /const worldRow = yBlock \* NAV_CELLS_PER_BLOCK \+ \(NAV_CELLS_PER_BLOCK - 1 - y\);/);
  const one = portBlockJson('X.RMB', { tile: (x, z) => (z < 51.2 ? 3 : 2) });
  const converted = blockFromJson(one, 1).rmbBlock.fldHeader.groundData.groundTiles;
  assert.equal(converted[0][15].textureRecord, 3, 'data row 15 is the block\'s near edge (z 0..6.4)');
  assert.equal(converted[0][0].textureRecord, 2, 'data row 0 its far edge');
});

// ── THE LOCATION ────────────────────────────────────────────────

test('TESA10 the location: its plan\'s grid and its blocks\' buildings on a city\'s shape, its own id, index, longitude and latitude, the host\'s region, its centre\'s castle (WW7-4), no harbour, `capital`, Arena\'s slot where one stands; none without a base or with a kind missing; the base untouched', () => {
  // PIN MOVED (TESA11): the Imperial City's centre slice - its eight by eight of the plan, its name the city's
  const own = (cell) => ownBlockOf(CAPITALS[0], cell), isClassic = imperialClassic;
  const kinds = [...new Set(Array.from({ length: IMPERIAL_SPAN ** 2 }, (_, s) => imperialSlicePlan(s).flat()).flat())].filter(isClassic);   // PIN MOVED (IC-GRAND): the plan by its law
  const names = new Map(kinds.map((k) => [k, [`${k}AA00.RMB`, `${k}AA01.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
  const centre = imperialSlicePlan(312), classic = centre.flat().filter(isClassic).length;   // PIN MOVED (TS5): the centre slice of seven; PIN MOVED (IC-GRAND): of twenty-five
  const base = { ...city(9, ['X']), name: 'Broadvale', regionIndex: 1, regionName: 'R', politic: 129, climate: { worldClimate: 231 }, hasDungeon: false, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1, mapId: 9, portTownAndUnknown: 1 }, buildings: [{ buildingType: 2 }], recordElement: { header: { locationId: 9 } } } };
  const snap = JSON.stringify(base);
  const slot = Object.freeze({ province: 'Imperial', provinceIndex: 8, id: 0, kind: 'city-state', port: false });
  const loc = synthesizeCapitalLocation({ cap: CAPITALS[0], k: 0 }, { base, names, blockOf: (n) => (n.startsWith('TES') ? null : fh), px: 2177, py: 612, arena: slot, where: { regionIndex: 23, regionName: 'Wrothgarian Mountains', politic: 151, climate: { worldClimate: 230 } } });
  assert.equal(JSON.stringify(base), snap);
  const id = capitalPlaceId(0), ll = mapPixelToLongitudeLatitude(2177, 612), ed = loc.exterior.exteriorData;
  assert.equal(loc.name, 'Imperial City');
  assert.deepEqual([ed.width, ed.height, ed.blockNames.length, ed.mapId, ed.locationId, ed.portTownAndUnknown, ed.buildingCount], [8, 8, 64, id, id, 0, classic]);
  assert.deepEqual(ed.blockNames, capitalBlockNames(centre, 0, names, own, [96, 96]));
  assert.equal(loc.exterior.buildings.length, classic, 'one named record a classic block');
  assert.ok(loc.exterior.buildings.every((d) => d.locationId === id));
  assert.equal(loc.exterior.recordElement.header.locationId, id);
  assert.deepEqual([loc.mapTableData.mapId, loc.mapTableData.locationType, loc.mapTableData.longitude, loc.mapTableData.latitude], [id, LOCATION_TYPES.TownCity, ll.x, ll.y]);
  // PIN MOVED (WW7-4): the centre's dungeon the capital's castle's halls (world/capitalCastles.js; ww7_castles.test.js)
  assert.deepEqual([loc.locationIndex, loc.hasDungeon, loc.dungeon.recordElement.header.locationId, loc.mapTableData.dungeonType], [capitalLocationIndex(0), true, id, 2]);
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate], [23, 'Wrothgarian Mountains', 151, 230]);
  assert.deepEqual(loc.capital, { key: 'imperial-city', k: 0, s: 312, flattenAt: { px: 2177, py: 612 }, rim: { W: 0, E: 0, N: 0, S: 0 } }, 'TESA11: the centre slice, its ground its own pixel\'s (PIN MOVED, TS5: slice 24 of forty-nine; IC-GRAND: 312 of six hundred and twenty-five; TESA x AUDIT TESA II: no side of it the rim\'s)');
  assert.equal(loc.arena, slot);
  assert.equal('arena' in synthesizeCapitalLocation({ cap: CAPITALS[0], k: 0 }, { base, names, blockOf: () => fh, px: 2177, py: 612 }), false, 'no Arena place, no slot');
  assert.equal(synthesizeCapitalLocation({ cap: CAPITALS[0], k: 0 }, { base: null, names, blockOf: () => fh, px: 0, py: 0 }), null);
  // PIN MOVED (TS5): the centre slice is the tower's grounds alone (its blocks all the city's own) - a slice of Daggerfall's
  // blocks stands none with a kind missing (PIN MOVED, IC-PROPS, 2026-10-27: no slice of the city lays one now -
  // world/imperialCity.js cellOf - so the law is held on a plan that lays them)
  assert.equal(kinds.length, 0, 'IC-PROPS: no block of Daggerfall\'s in the city\'s plan');
  const laid = { ...CAPITALS[0], slicePlan: () => Array.from({ length: 8 }, () => Array(8).fill('GENR')) };
  assert.equal(synthesizeCapitalLocation({ cap: laid, k: 0, s: 110 }, { base, names: new Map(), blockOf: () => fh, px: 0, py: 0 }), null);
  assert.ok(synthesizeCapitalLocation({ cap: laid, k: 0, s: 110 }, { base, names: new Map([['GENR', ['GENRAA00.RMB']]]), blockOf: () => fh, px: 0, py: 0 }), 'its kind named, it stands');
  assert.ok(synthesizeCapitalLocation({ cap: CAPITALS[0], k: 0 }, { base, names: new Map(), blockOf: () => fh, px: 0, py: 0 }), 'the centre needs none');
  const rows = [city(30, ['A']), city(10, ['A'], { hasDungeon: true }), city(20, ['A']), city(15, ['A'], { exterior: {} }), city(5, ['A'], { arena: {} }), city(6, ['A'])];
  assert.equal(capitalBase(rows, (mapId) => mapId === 6).mapTableData.mapId, 20, 'the first plain city of the game\'s, in map-id order');
});

// ── THE LANDMARKS ───────────────────────────────────────────────

const bounds = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); } return { lo, hi }; };
const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite));
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  // PIN MOVED (URBANIZER U2): a landmark's pictures the capitals' own or the towns' (cut stone, brick, half-timbering)
  assert.ok(m.subMeshes.every((s) => (s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)) || (s.textureArchive === URBAN_ARCHIVE && Object.values(URBAN_ART).includes(s.textureRecord))));
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
  for (let t = 0; t < m.indices.length; t += 3) {
    const P = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [P(0), P(1), P(2)], n = [0, 1, 2].map((a2) => m.normals[m.indices[t] * 3 + a2]);
    const u = b.map((v, i) => v - a[i]), v = c.map((w, i) => w - a[i]);
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cr) > 1e-6) assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'every face wound along its normal');
  }
};

/** Does the segment p-q cross any face of the model (Moller-Trumbore)? - a gate is open where nothing does. */
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

test('TESA10 the pictures: the port\'s own, 64 x 64 (PIN MOVED, IC-GRAND: the Imperial City\'s street walls 64 x 128, vanilla\'s own wall - world/imperialArt.js), opaque, the same every time; the install puts the blocks, models and pictures on their doors once', () => {
  const a = capitalArt(), b = capitalArt();
  assert.deepEqual([...a.keys()].sort(), Object.values(CAPITAL_ART).sort());
  const tall = new Set(['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop', 'groundArcade'].map((k) => CAPITAL_ART[k]));
  for (const [r, img] of a) {
    assert.deepEqual(img.data, b.get(r).data);
    if (CAPITAL_CUT_RECORDS.includes(r)) continue;   // PIN MOVED (CAPITAL-TREES): a tree's flats, a flat's size and cut by their alpha (test/world/capitaltrees.test.js)
    const h = tall.has(r) ? 2 * CAPITAL_ART_SIZE : CAPITAL_ART_SIZE;
    assert.deepEqual([img.width, img.height, img.data.length], [CAPITAL_ART_SIZE, h, CAPITAL_ART_SIZE * h * 4]);
    for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255);
  }
  const marble = a.get(CAPITAL_ART.marble).data, gold = a.get(CAPITAL_ART.gold).data;
  assert.ok(marble[0] > 150 && marble[1] > 150 && marble[2] > 150, 'the marble pale');
  assert.ok(gold[0] > gold[2] + 40, 'the gold warm');
  _resetCapitals();
  const entries = [];
  assert.equal(installCapitals({ addTextures: (e) => { entries.push(...e); return e.length; } }), true);
  assert.equal(installCapitals({ addTextures: () => 0 }), false, 'once');
  assert.deepEqual(entries.map((e) => [e.archive, e.record, e.standIn]), Object.values(CAPITAL_ART).map((r) => [CAPITAL_ARCHIVE, r, true]));
  for (const id of Object.values(CAPITAL_MODELS)) assert.ok(customModelFor(id)?.positions?.length > 0, `model ${id}`);
  assert.match(read('src/scenes/modWorldData.js'), /await installArena\(\);[^\n]*\n\s+installCapitals\(\);/);
});

// ── THE HOST ────────────────────────────────────────────────────

const W = hostText('src/scenes/world.js');
const lift = (head) => { const i = W.indexOf(head); assert.ok(i > 0, head); return W.slice(i, W.indexOf('\n  }\n', i) + 4); };

test('TESA10 the host by source: the base and the blocks off the game\'s rows before they go, under its door; past the Bay a capital first, before Arena\'s place', () => {
  assert.equal(capitalsOn('?capitals=off'), false);
  assert.equal(capitalsOn(''), true);
  assert.match(W, /const _capitalBase = tamrielLand && capitalsOn\(\) \? capitalBase\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\), isMainStoryDungeon\) : null;/);
  assert.match(W, /const _capitalNames = _capitalBase \? cityBlockNames\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\)\) : null;/);
  assert.ok(W.indexOf('const _capitalNames = ') < W.indexOf('  _classicRows = null;   // read, let go'));
  // PIN MOVED (AUDIT TESA II P1): online the open zone's hall of the day first - Cyrodiil's lie past the Bay
  // PIN MOVED (WG2-TOWNS): a World 2.0 town asked first past the Bay, before a capital (scenes/settle2Host.js)
  assert.match(W, /if \(\(_arenaTemplates \|\| _countryTemplates \|\| _capitalBase\) && !onTheBay\(px, py\)\) return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\) && zoneHalls\.standIn\(cyrodiilMask\(\), px, py\)\) \|\| settle2LocationAt\(px, py\) \|\| host\.capitalLocationAt\(px, py\) \|\| \(_arenaTemplates && host\.arenaLocationAt\(px, py\)\) \|\| host\.countryLocationAt\(px, py\) \|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/);   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild is scenes/spawnStandHost.js's, the places' rolls through `host`   // PIN MOVED (SPAWN-WORLD 2026-10-26): online, the spawner's last - never on a place   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js) - carried into scenes/spawnStandHost.js at the packages' merge (AUDIT BAY-LEFT)
});

test('TESA10 the host\'s ask: the capital on its pixel stood once, its region its province\'s; Arena\'s place on it its slot, and stood again when the slot changes; none elsewhere, and none with the door shut', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const kinds = [...new Set(Array.from({ length: IMPERIAL_SPAN ** 2 }, (_, s) => imperialSlicePlan(s).flat()).flat())].filter(imperialClassic);   // PIN MOVED (IC-GRAND): the plan by its law
  const names = new Map(kinds.map((k) => [k, [`${k}AA00.RMB`]]));
  const base = { ...city(9, ['X']), exterior: { exteriorData: { blockNames: ['X'] }, buildings: [] } };
  // PIN MOVED (BAY-LEFT-B): the clone's MapTable key its own buildings' (world/locationKey.js), the Imperial City's fabric's
  // with them - the harness hands the clone its three leaves
  const make = (open, arena) => new Function('capitalOnPixel', 'synthesizeCapitalLocation', 'base', 'names', 'arena', 'capitalSlicePort', 'capitalCentrePixel', 'locationKeyOf', 'CAPITALS', 'fabricSliceSites', 'regionOfTheatre', 'THEATRE_KEYS', `
    const _capitalBase = ${open ? 'base' : 'null'}, _capitalNames = names, _arenaTemplates = {}, locationIndex = new Map();
    const arenaPlaceOnPixel = () => (arena.on ? arena.place : null), blocks = { getBlockByName: () => null };
    const maps = { getRegionIndexAt: () => 23, getClimateIndex: () => 231 }, REGION_NAMES = { 23: 'Wrothgarian Mountains', 70: 'Cyrodiil' }, getWorldClimateSettings = (c) => ({ worldClimate: c });
    const host = { _locIndexGen: 0 };   // PIN MOVED (HOST-SPLIT, at the merge of main): the place law is scenes/tamrielPlacesHost.js's, the index's generation the host's live name
    const registerTamrielPlaces = () => {};   // PIN MOVED (WW7-1): the capital's ask registers the places past the Bay first - none here
    const townClimateAt = (px, py, c) => c;   // PIN MOVED (AUDIT RELEASE R2-5f): the clone's own climate law - the city's ground stands on the pixel's
    ${lift('  function capitalLocationAt(px, py) {')}
    ${lift('  function capitalCloneOf(at, px, py, slot) {')}   // PIN MOVED (AUDIT RELEASE R2-5f): the clone laid out apart from its standing, as the quest layer reads it
    const arenaPixels = () => null;   // PIN MOVED (BAY-LEFT-SEA): the clone handed its harbour's pin (tamrielPlacesHost.js capitalPinPort) - none pinned here
    ${lift('  function capitalPinPort(k) {')}
    return { capitalLocationAt, index: locationIndex, gen: () => host._locIndexGen };`)(capitalOnPixel, synthesizeCapitalLocation, base, names, arena, capitalSlicePort, capitalCentrePixel, locationKeyOf, CAPITALS, fabricSliceSites, regionOfTheatre, THEATRE_KEYS);
  const arena = { on: false, place: null };
  const h = make(true, arena);
  const loc = h.capitalLocationAt(2069, 658);
  assert.equal(loc.name, 'Imperial City');
  assert.equal(h.index.get('2069,658'), loc);
  // PIN MOVED (AUDIT FOUNDATION A1): its region its province's, as the registry's row - never the pixel's, which reads 0 on
  // a harbour's sea
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate], [70, 'Cyrodiil', 198, 231]);
  assert.equal(h.capitalLocationAt(2069, 658), loc, 'once');
  assert.equal(h.gen(), 1);
  // PIN MOVED (TESA11): the pixel east of it the city's east slice - a location of its own, the Arena District's; PIN MOVED
  // (TS5): its slice 25 of forty-nine, the city three a side; PIN MOVED (IC-GRAND): its slice 313 of six hundred and
  // twenty-five, the Palace District's (the Arena District's six pixels out), the city twelve a side
  const east = h.capitalLocationAt(2070, 658);
  assert.deepEqual([east.name, east.capital.s, east.mapTableData.mapId], [imperialSliceName(313), 313, capitalPlaceId(0, 313)]);
  assert.equal(imperialSliceName(313), 'Palace District');
  assert.equal(h.capitalLocationAt(2075, 658).name, 'Arena District');
  assert.equal(h.capitalLocationAt(2082, 658), null);
  arena.on = true; arena.place = { province: 'Imperial', provinceIndex: 8, id: 0, kind: 'city-state', name: 'Imperial City' };
  const withArena = h.capitalLocationAt(2069, 658);
  assert.notEqual(withArena, loc, 'Arena landed: stood again');
  assert.deepEqual(withArena.arena, { province: 'Imperial', provinceIndex: 8, id: 0, kind: 'city-state', port: false });
  assert.equal(h.capitalLocationAt(2069, 658), withArena);
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  assert.equal(h.capitalLocationAt(2069, 658), null, 'the fit moved it off this pixel: out');
  assert.equal(h.index.has('2069,658'), false);
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  assert.equal(make(false, { on: false, place: null }).capitalLocationAt(2069, 658), null, 'the door shut');
});

test('TESA10 the sweep: on the frame, when the fit moves, every built pixel past the Bay whose capital came or went is built again, nearest first - the Bay\'s own pixels never; a fit unmoved sweeps nothing', () => {
  assert.match(W, /if \(_capitalBase && !building\) sweepCapitalPixels\(\);/);
  const sweep = lift('  function sweepCapitalPixels() {');
  const run = (cop, tf, tlv, otb, rolled = false) => new Function('capitalOnPixel', 'tamrielFit', 'tamrielLandVersion', 'onTheBay', 'rolled', 'createSwapBehind', `
    const built = new Map([['2069,658', { px: 2069, py: 658 }], ['2300,600', { px: 2300, py: 600 }], ['5,5', { px: 5, py: 5 }], ['1315,495', { px: 1315, py: 495 }]]);
    const locationIndex = new Map([['2069,658', { capital: { k: 0 } }]]), destroyed = [], queue = [], state = { current: { x: 2069, y: 658 } };
    const walkMode = false, playerSpawned = false, nearestFirstFrom = () => () => 0, destroyPixel = (x, y) => destroyed.push(x + ',' + y);
    const _swept = { arena: null, capital: null, capitalLand: -1 };   // PIN MOVED (HOST-SPLIT, at the merge of main): the sweep is scenes/tamrielSweepsHost.js's, its live names the host's
    const host = { built, locationIndex, queue, state, walkMode, playerSpawned, _seasonHoldKey: null, _countryTemplates: rolled ? {} : null, _lairTemplates: null };
    const sweepCapitalLod = () => {};   // PIN MOVED (IC-GRAND): the Imperial City's near and far asked first - its own pins, test/world/icgrand_lod.test.js
    const capitalSkyline = { sweep: () => {} };   // PIN MOVED (IC-GRAND x FAR-LANDMARK): and its landmarks on the far ring - the same pins
    const capitalPrebuild = { sweep: () => {} };   // PIN MOVED (IC-GRAND's perf pass): and its worker told the slices coming - test/world/icgrand_prebuild.test.js
    // PIN MOVED (IC-SWAP-BEHIND): the sweep's tail is the swap's (scenes/swapBehind.js rebuild) - here with its switch off, each
    // pixel torn down and queued as it was; behind its standing view, test/scenes/swapbehind.test.js
    const swap = createSwapBehind({ built, destroyPixel, collider: { hold() {} }, buildingDoors: [], doorsMoved() {}, queue, nearestFirst: nearestFirstFrom, state,
      walkMode: () => walkMode, playerSpawned: () => playerSpawned, seasonHold: (k) => { host._seasonHoldKey = k; }, off: () => true });
    ${sweep}
    return { sweep: sweepCapitalPixels, destroyed, queue };`)(cop, tf, tlv, otb, rolled, createSwapBehind);
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const h = run(capitalOnPixel, () => tamrielFitNow(), () => tamrielLandVersion(), inBay);
  // AUDIT-TESA A7-1: with the countryside standing, the land's moving builds again every pixel past the Bay it rolls -
  // never on the first frame's ask, never the Bay's, never a capital's or an Arena place's (their own sweeps)
  {
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    const r = run(capitalOnPixel, () => tamrielFitNow(), () => tamrielLandVersion(), inBay, true);
    r.sweep();
    assert.deepEqual(r.destroyed, [], 'the first ask: the fit they were built by');
    setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
    r.sweep();
    assert.deepEqual(r.destroyed.sort(), ['1315,495', '2069,658', '2300,600'], 'the land moved: the country pixel too, the capitals\' as ever, the Bay\'s never');
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  }
  h.sweep();
  assert.deepEqual(h.destroyed, [], 'the fit the capital was built by: nothing');
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  h.sweep();
  assert.deepEqual(h.destroyed.sort(), ['1315,495', '2069,658'], 'the capital gone from its old pixel and come to its new one; the Bay\'s pixel untouched');
  assert.deepEqual(h.queue.map((k) => `${k.px},${k.py}`).sort(), ['1315,495', '2069,658']);
  h.sweep();
  assert.equal(h.destroyed.length, 2, 'once a fit');
  // the land moves (the trace lands): the Imperial City's point at sea, its pixel the nearest of its province's
  const w = 320, ht = 200, land = new Uint8Array(w * ht), province = new Uint8Array(w * ht);
  for (let y = 0; y < ht; y++) for (let x = 200; x < w; x++) { land[y * w + x] = 1; province[y * w + x] = 9; }
  setTamrielTrace({ w, h: ht, land, province });
  try {
    h.sweep();
    assert.equal(h.destroyed.length, 3, 'the land moved: swept again');
  } finally { setTamrielTrace(null); }
});

// ── THE PIXEL LAW (TESA10b) ─────────────────────────────────────

/** A picture of sea north of row 29 and land south of it: Skyrim west of column 160, the Imperial Province east. */
const shoreTrace = () => {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 29; y < h; y++) for (let x = 0; x < w; x++) { land[y * w + x] = 1; province[y * w + x] = x < 160 ? 3 : 9; }
  return { w, h, land, province };
};

test('TESA10b the pixel law: the nearest pixel of its own province\'s land, ring by ring - its own point\'s where that is; a capital on the shore the nearest beside the sea; none in reach, none; kept a fit and a land', () => {
  setTamrielFit({ ox: 400.3, oy: 500.2, ppu: 10 });
  setTamrielTrace(shoreTrace());
  try {
    const ic = CAPITALS[0], sol = CAPITALS[1];
    assert.equal(ic.shore, false);
    assert.equal(sol.shore, true);
    const [x, y] = pictureToBay(ic.at[0] + 0.5, ic.at[1] + 0.5);
    assert.deepEqual(capitalPixel(ic), { px: Math.floor(x), py: Math.floor(y) }, 'on its own land: its point');
    // Solitude's point is at sea: the nearest Skyrim pixel with the sea along a side - the shore's first row (PIN MOVED,
    // AUDIT TESA II C9: a shore capital of no plan's side; Solitude's own plan's water both north and west, below)
    const coast = { ...sol, sea: undefined };
    assert.deepEqual(capitalPixel(coast), { px: 964, py: -210 });
    assert.equal(provinceKeyBeyondBay(964, -210), 'Skyrim');
    assert.equal(provinceKeyBeyondBay(964, -211), null);
    assert.equal(capitalPixel(sol), null, 'AUDIT TESA II C9: a straight coast has no sea west of it - Solitude stands only where the Karth meets the sea');
    // a point on another province's land: the nearest of its own, its row kept
    assert.deepEqual(capitalPixel({ at: [150, 50], province: 'Imperial', shore: false }), { px: 1200, py: 4 });
    assert.equal(provinceKeyBeyondBay(1199, 4), 'Skyrim');
    // inland, a shore capital walks to the coast; with no such land in reach, none
    assert.deepEqual(capitalPixel({ at: [150, 31], province: 'Skyrim', shore: true }), { px: 1104, py: -210 });
    assert.equal(capitalPixel({ at: [100, 100], province: 'Morrowind', shore: false }), null);
    // the Bay is no sea: a shore capital beside Daggerfall's own pixels walks on to the picture's coast
    assert.deepEqual(capitalPixel({ at: [138, 45], province: 'Skyrim', shore: true }), { px: 984, py: -210 });
    // AUDIT TESA II C9: a bay west of column 130 - Solitude on its corner, the sea along its north and its west. PIN MOVED
    // (SMOOTH-LAND, test/world/smoothland.test.js): the land's smooth law rounds the picture's corner, so the corner's
    // first pixel on the land and the sea at its north and west is five map pixels (half a picture's here) east of it
    const t0 = shoreTrace();
    for (let y2 = 29; y2 < 60; y2++) for (let x2 = 0; x2 < 130; x2++) t0.land[y2 * 320 + x2] = 0;
    setTamrielTrace(t0);
    assert.deepEqual(capitalPixel(sol), { px: 905, py: -210 });
    assert.equal(provinceKeyBeyondBay(900, -210), null, 'the corner rounded');
    assert.equal(capitalOnPixel(905, -210).cap, sol);
    assert.equal(capitalOnPixel(905, -210).k, 1);
    assert.deepEqual(capitalPin({ name: 'Solitude', province: 'Skyrim' }), { px: 905, py: -210 });
    // the land moves (a new trace): the pixels with it
    const t = shoreTrace();
    for (let y2 = 29; y2 < 60; y2++) for (let x2 = 0; x2 < 130; x2++) t.land[y2 * 320 + x2] = 0;
    for (let x2 = 0; x2 < 320; x2++) { t.land[29 * 320 + x2] = 0; }
    setTamrielTrace(t);
    assert.equal(capitalOnPixel(905, -210), null, 'the shore moved a row south');
    assert.equal(capitalOnPixel(905, -200).cap, sol);
  } finally { setTamrielTrace(null); }
});

// ── SOLITUDE ────────────────────────────────────────────────────

test('TESA10b Solitude\'s plan: 8 x 8 - the Sea of Ghosts its north row and the Karth its west two columns, the quay below the city, the terrace at the arch\'s end, Castle Dour\'s square, 20 of Daggerfall\'s city blocks, fields south of the wall; every district\'s cells on land', () => {
  const sol = CAPITALS[1], P = SOLITUDE_PLAN;
  assert.deepEqual([sol.key, sol.name, sol.province, sol.plan, sol.districts, sol.blocks], ['solitude', 'Solitude', 'Skyrim', SOLITUDE_PLAN, SOLITUDE_DISTRICTS, SOLITUDE_BLOCKS]);
  assert.deepEqual(sol.at, CITIES.find((c) => c.name === 'Solitude' && c.capital).at, 'TAMRIEL1\'s own point');
  assert.ok(P.length === 8 && P.every((r) => r.length === 8));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (y === 0 || x < 2) assert.equal(P[y][x], 'L', `${x},${y}`);
  assert.deepEqual([P[1][3], P[1][4], P[1][5], P[2][2], P[3][2], P[5][5], P[5][6], P[6][5], P[6][6]], ['Q0', 'Q1', 'Q2', 'P0', 'P1', 'D0', 'D1', 'D2', 'D3']);   // PIN MOVED (TESA-LORE): Castle Dour by the main gate
  assert.deepEqual(P[7].slice(2), Array(6).fill('G'), 'the fields');
  const kinds = P.flat().filter((c) => c !== 'L' && c !== 'G' && !Object.hasOwn(SOLITUDE_BLOCKS, c));
  assert.equal(kinds.length, 19);   // PIN MOVED (TESA-LORE): Castle Dour's square four of the city's cells
  for (const k of ['MAGE', 'TEMP', 'FIGH', 'TVRN', 'GENR', 'ARMR', 'ALCH', 'BANK', 'GEMS', 'PAWN', 'BOOK', 'LIBR', 'RESI', 'GRVE']) assert.ok(kinds.includes(k), k);
  const seen = new Set();
  for (const [d, cells] of Object.entries(SOLITUDE_DISTRICTS)) for (const [x, y] of cells) { assert.ok(!['L', 'G'].includes(P[y][x]), `${d} ${x},${y}`); assert.equal(seen.has(`${x},${y}`), false); seen.add(`${x},${y}`); }
  assert.equal(seen.size, P.flat().filter((c) => c !== 'L' && c !== 'G').length, 'every cell of the city in a district');
  assert.equal(capitalDistrict(sol, 2, 2), 'Blue Palace');
  assert.equal(capitalDistrict(sol, 3, 3), 'The Avenues District', 'PIN MOVED (TESA-LORE): the Bards College the Avenues\'');
  assert.equal(capitalDistrict(sol, 6, 5), 'Castle Dour District');
  assert.equal(P[3][3], 'LIBR', 'the college a library');
  assert.equal(P[4][2], 'GRVE', 'the Hall of the Dead a graveyard (PIN MOVED, TESA-LORE: beside the palace\'s terrace)');
  assert.deepEqual(sol.anchor, [2, 3]);
  assert.equal(capitalCarrier(sol), 'P0');
  assert.equal(capitalCarrier(CAPITALS[0]), 'I2r2r', 'PIN MOVED (TESA11): the Imperial City\'s own block on its anchor; PIN MOVED (TS5): (27, 27) of 56; PIN MOVED (IC-GRAND): (99, 99) of 200');
});

test('TESA10b Solitude\'s port blocks: the quay\'s stone to its edge and the sea past it, the terrace\'s and Castle Dour\'s stone; the terrace and its ramp, the warehouse, the north wall (its gate open), the east wall, the curtain (its gate open), its towers, its keep and the Emperor\'s Tower closed; the landmarks on the terrace\'s first block at the anchor', () => {
  const b = capitalPortBlocks(), own = b.filter((x) => x.name.startsWith('TESASO'));
  assert.deepEqual(b.slice(0, 2).map((x) => x.name), [CAPITAL_BLOCKS.lake, CAPITAL_BLOCKS.garden], 'PIN MOVED (TESA11): the lake and the garden first, the Imperial City\'s own after them');
  assert.deepEqual(own.map((x) => x.name), ['TESASOQ0.RMB', 'TESASOQ1.RMB', 'TESASOQ2.RMB', 'TESASOP0.RMB', 'TESASOP1.RMB', 'TESASOD0.RMB', 'TESASOD1.RMB', 'TESASOD2.RMB', 'TESASOD3.RMB'], 'in the plan\'s order');
  assert.deepEqual(b.map((x) => x.index), b.map((_, i) => CAPITAL_BLOCK_INDEX + i));
  const S = SOLITUDE, at = (name) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (SOLITUDE_BLOCKS[SOLITUDE_PLAN[y][x]]?.name === name) return [x, y]; return null; };
  let water = 0, closed = 0;
  for (const blk of own) {
    const [cx, cy] = at(blk.name), ox = (cx - 2) * BLOCK_M, oz = (cy - 3) * BLOCK_M;
    const T = blk.json.RmbBlock.FldHeader.GroundData.GroundTiles.map((t) => t.TileBitfield), A = blk.json.RmbBlock.FldHeader.AutoMapData;
    for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
      // PIN MOVED (SOLITUDE-RELIEF): its tiles its relief's (world/solitudeRelief.js solitudeGroundTile) - the sea where all
      // four corners are the water's, a cliff's rock where they climb, the paving else; none of its own in the rim
      const [x, z] = tileCentre(tx, ty), [dx, dz] = anchorMetres(CAPITALS[1], cx, cy, x, z);
      const rim = inCapitalRim(CAPITALS[1], cx * BLOCK_M + x, (cy + 1) * BLOCK_M - z);
      assert.equal(T[ty * 16 + tx], rim ? CAPITAL_NO_GROUND : solitudeGroundTile(dx, dz, SOLITUDE_TILES.stone));
      if (!rim && dz < S.docks.edge) water++;
      void ox; void oz;
    }
    for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) if (A[ay * 64 + ax]) closed++;
  }
  assert.ok(water > 0 && water < 3 * 256, 'the quay\'s north part the sea');
  assert.ok(closed > 0);
  const P0 = own.find((x) => x.name === 'TESASOP0.RMB'), Q0 = own.find((x) => x.name === 'TESASOQ0.RMB');
  // a closed cell by the anchor's metres (x east, z south): the block's own (z north) and its automap cell
  const cell = (blk, dx, dz) => { const [cx, cy] = at(blk.name), x = dx - (cx - 2) * BLOCK_M, z = (cy + 1 - 3) * BLOCK_M - dz; assert.ok(x >= 0 && x < BLOCK_M && z >= 0 && z < BLOCK_M, `${blk.name} ${dx},${dz}`); const ax = Math.floor(x / 1.6), ay = 63 - Math.floor(z / 1.6); return blk.json.RmbBlock.FldHeader.AutoMapData[ay * 64 + ax]; };
  assert.equal(cell(P0, 20, -5), CAPITAL_CLOSED_BYTE, 'the terrace');
  assert.equal(cell(P0, 90, -40), 0, 'the street beside the stair (PIN MOVED, SOLITUDE-RELIEF: the terrace\'s grand stair)');
  const Q1 = own.find((x) => x.name === 'TESASOQ1.RMB');
  assert.equal(cell(Q1, 230, S.wall.north), CAPITAL_CLOSED_BYTE, 'the north wall');
  assert.equal(cell(Q1, S.wall.northGate, S.wall.north), 0, 'its gate');
  assert.equal(cell(own.find((x) => x.name === 'TESASOQ0.RMB'), S.docks.warehouse.x, S.docks.warehouse.z), CAPITAL_CLOSED_BYTE, 'the warehouse (PIN MOVED, SOLITUDE-RELIEF: against the causeway\'s wall, west on the quay)');
  const D0 = own.find((x) => x.name === 'TESASOD0.RMB'), D2 = own.find((x) => x.name === 'TESASOD2.RMB');
  assert.equal(cell(D0, S.castle.x - S.castle.half, S.castle.z - 10), CAPITAL_CLOSED_BYTE, 'the curtain\'s west side');
  assert.equal(cell(D2, S.castle.x - S.castle.half, S.castle.z + 1), 0, 'its gate');
  assert.equal(cell(D0, S.castle.x + S.emperorsTower.dx, S.castle.z + S.emperorsTower.dz), CAPITAL_CLOSED_BYTE, 'the Emperor\'s Tower');
  assert.equal(cell(D0, S.castle.x - 20, S.castle.z - 2), 0, 'the yard');
  assert.equal(Q0.json.RmbBlock.Misc3dObjectRecords.length, 0);
  const laid = layoutRmbBlock(blockFromJson(P0.json, P0.index));
  assert.deepEqual(laid.models.map((m) => m.modelIdNum), CAPITALS[1].models);
  for (const m of laid.models) assert.deepEqual([...m.matrix.slice(12, 15)].map((v) => +v.toFixed(3)), [0, 0, 0], 'the anchor: the terrace block\'s south-west corner');
});

test('TESA10b Solitude\'s arch: the sea stack to its top, the deck falling from the stack\'s top to the terrace\'s, the opening clear over the river between its springs to its crown, the terrace and the stair to the street', () => {
  // PIN MOVED (SOLITUDE-RELIEF, test/world/solitude_relief.test.js): its heights metres over the sea (world/solitudeRelief.js
  // SOLITUDE_LEVELS), a model's y those less the streets' 46 (levelY); the terrace's ramp a stair
  const A = SOLITUDE.arch, m = buildSolitudeArch(), y = (h) => h - SOLITUDE_LEVELS.city;
  sane(m);
  assert.equal(archTop(A.from), SOLITUDE_LEVELS.stack);
  assert.equal(archTop(A.to), SOLITUDE_LEVELS.terrace);
  assert.equal(archOpening(A.springW), 0);
  assert.equal(archOpening(A.springE), 0);
  assert.ok(Math.abs(archOpening((A.springW + A.springE) / 2) - A.crown) < 1e-9);
  // nothing of it inside the opening: below the intrados, over the river, within the deck's width
  for (let t = 0; t < m.indices.length; t += 3) {
    const c = [0, 1, 2].map((a) => (m.positions[m.indices[t] * 3 + a] + m.positions[m.indices[t + 1] * 3 + a] + m.positions[m.indices[t + 2] * 3 + a]) / 3);
    const stack = Math.hypot(c[0] - SOLITUDE.stack.x, c[2] - SOLITUDE.stack.z) < SOLITUDE.stack.foot + 8;   // the stack's foot, its flank the opening's west side
    const inside = !stack && c[0] > A.springW + 6 && c[0] < A.springE - 6 && Math.abs(c[2]) < A.w / 2 + 4 && c[1] > y(0.5) && c[1] < y(archOpening(c[0])) - 2.5;
    assert.ok(!inside, `a face in the opening at ${c.map((v) => v.toFixed(1))}`);
  }
  const { lo, hi } = bounds(m);
  assert.ok(hi[1] >= y(SOLITUDE.stack.top) + A.parapet, 'the stack\'s top and the palace gate over it');
  assert.ok(lo[0] < SOLITUDE.stack.x - SOLITUDE.stack.r && hi[0] === SOLITUDE.landing.stairTo);
  assert.ok(SOLITUDE.stack.x + SOLITUDE.stack.r >= A.from, 'the deck starts at the stack\'s top');
  assert.ok(A.springW <= SOLITUDE.stack.x + SOLITUDE.stack.foot, 'it springs from within the stack\'s foot');
});

test('TESA10b the Blue Palace, the walls, Castle Dour and the docks: the palace on the stack\'s top under blue roofs, its spire the city\'s highest; the walls\' gates open below their lintels and the arch\'s gap open; the curtain\'s gate open and the Emperor\'s Tower over the keep; the piers over the sea', () => {
  // PIN MOVED (SOLITUDE-RELIEF): its heights metres over the sea, a model's y those less the streets' 46; each wall run on its
  // tier - the north gate on the upper tier, 6 m over the main gate's Well District (test/world/solitude_relief.test.js)
  const S = SOLITUDE, pal = buildBluePalace(), y = (h) => h - SOLITUDE_LEVELS.city, up = y(SOLITUDE_LEVELS.upper);
  sane(pal);
  const pb = bounds(pal);
  assert.ok(pb.lo[1] >= y(S.stack.top) - 3.01, 'on the stack');
  assert.ok(Math.hypot(pb.lo[0] - S.stack.x, 0) <= S.stack.r && Math.hypot(pb.hi[0] - S.stack.x, 0) <= S.stack.r && Math.max(-pb.lo[2], pb.hi[2]) <= S.stack.r, 'within its top');
  assert.ok(pal.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.blueSlate));
  const wall = buildSolitudeWall();
  sane(wall);
  const W = S.wall, faces = (m) => { const out = []; for (let t = 0; t < m.indices.length; t += 3) out.push([0, 1, 2].map((a) => (m.positions[m.indices[t] * 3 + a] + m.positions[m.indices[t + 1] * 3 + a] + m.positions[m.indices[t + 2] * 3 + a]) / 3)); return out; };
  const floor = (m, t) => Math.abs(m.normals[m.indices[t * 3] * 3 + 1]) > 0.9;   // PIN MOVED (SOLITUDE-RELIEF): the Gate Road's paving runs in under the main gate
  for (const [t, c] of faces(wall).entries()) {
    if (floor(wall, t)) continue;
    const lowGate = (Math.abs(c[2] - W.north) < 3 && Math.abs(c[0] - W.northGate) < W.gate / 2 - 0.01 && c[1] > up + 0.1 && c[1] < up + W.gateH - 0.01)
      || (Math.abs(c[2] - W.south) < 3 && Math.abs(c[0] - W.southGate) < W.gate / 2 - 0.01 && c[1] > 0.1 && c[1] < W.gateH - 0.01);
    const arch = Math.abs(c[0] - W.west) < 3 && Math.abs(c[2]) < W.archGap - 0.01;
    assert.ok(!lowGate && !arch, `a face in a gate at ${c.map((v) => v.toFixed(1))}`);
  }
  for (const [x, z, what, at] of [[W.northGate, W.north, 'north', up], [W.southGate, W.south, 'south', 0]]) {
    assert.equal(crosses(wall, [x, at + W.gateH / 2, z - 6], [x, at + W.gateH / 2, z + 6]), false, `the ${what} gate open`);
    assert.equal(crosses(wall, [x, at + (W.gateH + W.h) / 2, z - 6], [x, at + (W.gateH + W.h) / 2, z + 6]), true, `its lintel`);
    assert.equal(crosses(wall, [x - 40, at + W.gateH / 2, z - 6], [x - 40, at + W.gateH / 2, z + 6]), true, `the ${what} side walled`);
  }
  assert.equal(crosses(wall, [W.west - 6, up + 6, 0], [W.west + 6, up + 6, 0]), false, 'the arch\'s gap open');
  assert.deepEqual(solitudeWallCorners(), [[W.east, W.north], [W.west, W.north], [W.west, W.south], [W.east, W.south]]);
  assert.ok(solitudeTowers().every(([x, z]) => (x === W.west || x === W.east || z === W.north || z === W.south)), 'every tower on the wall');
  assert.ok(bounds(pal).hi[1] > bounds(wall).hi[1] + 50);
  const cd = buildCastleDour();
  sane(cd);
  const C = S.castle;
  assert.equal(crosses(cd, [C.x - C.half - 5, C.gateH / 2, C.z], [C.x - C.half + 5, C.gateH / 2, C.z]), false, 'the curtain\'s gate open');
  assert.equal(crosses(cd, [C.x - C.half - 5, C.gateH / 2, C.z + 20], [C.x - C.half + 5, C.gateH / 2, C.z + 20]), true, 'the curtain walled beside it');
  assert.ok(Math.abs(bounds(cd).hi[1] - (up + S.emperorsTower.h + 1.4 + S.emperorsTower.roof)) < 1e-4, 'the Emperor\'s Tower the castle\'s top');
  assert.ok(S.emperorsTower.h > S.keep.h + S.keep.roof);
  assert.ok(pb.hi[1] > bounds(cd).hi[1], 'the palace over the castle');
  const docks = buildSolitudeDocks();
  sane(docks);
  const db = bounds(docks);
  assert.ok(Math.abs(db.lo[2] - S.docks.pierTo) < 1e-6 && db.hi[2] < W.north - W.thick / 2, 'out over the sea, outside the wall');
  assert.ok(S.docks.piers.every((x) => x - S.docks.pierW / 2 >= S.quay.x0 && x + S.docks.pierW / 2 <= S.quay.x1));
});

test('TESA10b the landmarks turned north: a model drawn as the map reads (+z south) stands in the world\'s frame (+z north) - every z and normal\'s z negated, every face still wound along its normal; the installed models are the turned ones', () => {
  for (const build of [buildImperialTower, buildTalosBridge, buildSolitudeArch, buildSolitudeDocks]) {   // PIN MOVED (TESA11): the Imperial City's own
    const m = build(), n = northward(m);
    sane(n);
    assert.equal(n.positions.length, m.positions.length);
    for (let i = 0; i < m.positions.length; i += 3) { assert.equal(n.positions[i], m.positions[i]); assert.equal(n.positions[i + 2], -m.positions[i + 2]); assert.equal(n.normals[i + 2], -m.normals[i + 2]); }
    assert.equal(m.positions[2] === n.positions[2] && m.positions[2] !== 0, false, 'the drawn model untouched');
  }
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const docks = customModelFor(CAPITAL_MODELS.solitudeDocks), drawn = buildSolitudeDocks();
  assert.ok(Math.abs(bounds(docks).hi[2] + bounds(drawn).lo[2]) < 1e-6, 'the docks north of the anchor in the world');
});

test('TESA10d the map\'s capitals, Arena or none: where a host stands the capitals, each capital the map inks stands on its pixel and is a portal\'s end there (the teleport map\'s - TESA-NO-FAST); no other city is; none while no host stands them; the ink made again when that changes', async () => {
  const { buildTamrielInk, tamrielInkFor } = await import('../src/ui/tamrielInk.js');
  const { setCapitalsStanding, capitalsStanding, capitalsVersion } = await import('../src/world/tamrielCapitals.js');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    assert.equal(capitalsStanding(), false);
    const v = capitalsVersion();
    const before = tamrielInkFor(null);
    assert.ok(before.cities.every((c) => !c.pixel), 'no host: no journey');
    setCapitalsStanding(true); setCapitalsStanding(true);
    assert.equal(capitalsVersion(), v + 1, 'the version moves once, on the change');
    assert.notEqual(tamrielInkFor(null), before, 'the ink made again');
    const ink = buildTamrielInk();
    for (const cap of CAPITALS) {
      const c = ink.cities.find((x) => x.name === cap.name && x.province === cap.province);
      const p = capitalPixel(cap);
      if (inBay(p.px, p.py)) continue;
      assert.ok(c, cap.name);
      assert.deepEqual(c.pixel, { x: p.px, y: p.py }, `${cap.name}: its journey`);
      assert.deepEqual([c.x, c.y], [p.px + 0.5, p.py + 0.5], `${cap.name}: inked on its pixel`);
    }
    assert.ok(ink.cities.filter((c) => c.pixel).every((c) => CAPITALS.some((cap) => cap.name === c.name)), 'no other city a journey');
    assert.match(W, /setCapitalsStanding\(!!_capitalBase\);/);
  } finally { setCapitalsStanding(false); }
});

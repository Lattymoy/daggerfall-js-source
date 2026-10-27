// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 31 - C6): THE FOUR CAPITAL HARBOURS -
// Solitude, Alinor, Torval and the Imperial City's Waterfront - a port to their own byte where the registry calls them one
// (tamrielCapitals.js capitalSlicePort: the registry's row and the slice's PortTownAndUnknown, one law), so each stands its
// shipyard, crew hall, lighthouse and Docks and its bank sells a ship; and a capital's landmarks measured by their
// footprint, which their blocks' automap already closes (isCapitalLandmark) - by its box a ring wall closed the whole city.
// On the freeware: every slice of the seven capitals, and the four harbours' shipyard and lighthouse each at the water
// (bible/03-World/Arena-Provinces.md BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CAPITALS, CAPITAL_MODELS, capitalSlicePort, capitalHarbourSlice, capitalCentre, isCapitalLandmark, synthesizeCapitalLocation } from '../../../src/world/tamrielCapitals.js';
import { IMPERIAL_PARTS } from '../../../src/world/imperialCity.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { portTownByData } from '../../../src/systems/portPlaces.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const K = Object.fromEntries(CAPITALS.map((c, k) => [c.key, k]));

test('BAY-LEFT-SEA A CAPITAL SLICE\'S PORT WORD: its harbour\'s slice where the place pinned on its centre is a port (or its harbour meets its canal) - every other slice none; the slice\'s own byte the same word (mutants: the harbour slice unasked; the pin unread; the byte never written)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const so = K.solitude, al = K.alinor;
  assert.deepEqual([capitalHarbourSlice(CAPITALS[so]), capitalHarbourSlice(CAPITALS[al]), capitalCentre(CAPITALS[al])], [0, 0, 0], 'a shore capital\'s harbour its own slice');
  assert.deepEqual([capitalSlicePort(so, 0, true), capitalSlicePort(so, 0, false), capitalSlicePort(al, 1, true), capitalSlicePort(K.mournhold, 0, false)], [true, false, false, false]);
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 0, buildingDataList: [] } } };
  const base = { name: 'Base', regionIndex: 1, mapTableData: { mapId: 9, locationType: LOCATION_TYPES.TownCity, longitude: 0, latitude: 0 }, exterior: { exteriorData: { width: 8, height: 8, portTownAndUnknown: 0 }, buildings: [] } };
  const names = new Map(['GRVE', 'CUST', 'SHIP', 'MARK', 'MAGE', 'GENR', 'TVRN', 'RESI', 'LIBR', 'ALCH', 'GEMS', 'BOOK', 'ARMR', 'BANK', 'TEMP', 'FIGH', 'PAWN', 'THIE'].map((k) => [k, [`${k}AA00.RMB`]]));
  const byteOf = (k, pinPort, s) => synthesizeCapitalLocation({ cap: CAPITALS[k], k, ...(s == null ? {} : { s }) }, { base, names, blockOf: () => fh, px: 1, py: 1, pinPort }).exterior.exteriorData.portTownAndUnknown;
  assert.deepEqual([byteOf(so, true), byteOf(so, false), byteOf(so), byteOf(al, true), byteOf(al, true, 1)], [1, 0, 0, 1, 0]);
  const solitude = synthesizeCapitalLocation({ cap: CAPITALS[so], k: so }, { base, names, blockOf: () => fh, px: 1, py: 1, pinPort: true });
  assert.equal(portTownByData(solitude, () => false), true, 'a port by its own data - the shipyard\'s gate (pixelBuild.js portTown)');
});

test('BAY-LEFT-SEA A CAPITAL\'S LANDMARKS ARE MEASURED BY THEIR FOOTPRINT: every CAPITAL_MODELS model and every Imperial City part is one, no ARCH3D record and no other registered model; the host\'s yards and port places never read one\'s box, the bank\'s ship sale reads a place past the Bay\'s own port byte, the capitals\' host hands each slice its harbour\'s pin (mutants: a landmark unrecognised; the yards\' measure unchanged; the bank by the slot; the pin unhanded; the kept slice never made again)', () => {
  for (const id of Object.values(CAPITAL_MODELS)) assert.equal(isCapitalLandmark(id), true, `${id}`);
  assert.ok(IMPERIAL_PARTS.length > 100 && IMPERIAL_PARTS.every((p) => isCapitalLandmark(p.id)));
  assert.deepEqual([isCapitalLandmark(100), isCapitalLandmark(41606), isCapitalLandmark(900100), isCapitalLandmark(910131)], [false, false, false, false], 'an ARCH3D model, the camps\' tent, the arena\'s colosseum, the retired Crystal Tower');
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('            custom: (cid) => (hasCustomModel(cid) && !customModelNeeds(cid).length && !isCapitalLandmark(cid) ? customModelFor(cid)?.positions ?? null : null),'));
  assert.ok(w.includes("portTown: (loc.ether ? loc.etherKind === 'port' : loc.arena || loc.capital ? (loc.exterior?.exteriorData?.portTownAndUnknown ?? 0) !== 0 : modSetting("));
  const h = rd('src/scenes/tamrielPlacesHost.js');
  assert.ok(h.includes('px, py, arena: slot, pinPort: capitalPinPort(at.k),'));
  assert.ok(h.includes('&& (had.exterior?.exteriorData?.portTownAndUnknown !== 0) === capitalSlicePort(at.k, at.s, capitalPinPort(at.k))) return had;'));
  assert.ok(h.includes('return !!(c && _arenaTemplates && arenaPixels()?.byPixel.get(`${c.px},${c.py}`)?.port);'));
  assert.ok(rd('src/world/pastBayRows.js').includes('port: capitalSlicePort(k, s, pin?.port),'));
});

const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
test('BAY-LEFT-SEA (ARENA2): on the freeware the registry\'s four capital harbours and no other slice of the seven capitals are ports to their own byte; each bears the open sea and stands its shipyard and its lighthouse at the water, measured as the host measures a town, and its crew hall and its Docks (six berths at its own reach) - where by a landmark\'s box Solitude stood its lighthouse alone and Alinor and Torval neither', { skip: realSkip }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const { groundMaps, groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const wd = await import('../../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../../../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const { layoutLocation } = await import('../../../src/world/locationLayout.js');
  const ys = await import('../../../src/world/merchantYards/merchantYardSites.js');
  const ps = await import('../../../src/world/portSites.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../../src/world/arenaPlaces.js');
  const { rumareSeaPixel } = await import('../../../src/world/rumareWaters.js');
  const { isYardTown } = await import('../../../src/systems/merchantYards.js');
  const { customModelFor, hasCustomModel, customModelNeeds, classicModelIdOf } = await import('../../../src/world/customModels.js');
  const { collectBlockFlats } = await import('../../../src/world/rmbFlats.js');
  const { flatFieldFor } = await import('../../../src/world/flatFields.js');
  const { ARENA_BLOCK } = await import('../../../src/world/arena/arenaCity.js');
  const { pastBayPlaceRows } = await import('../../../src/world/pastBayRows.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(FIT);
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
    const woods0 = new WoodsFile(); woods0.load(bytes('WOODS.WLD'));
    const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
    groundMaps(maps); const woods = groundWoods(woods0);
    wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
    installCapitals({ addTextures: () => 0 });
    const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
    // the host's own: tamrielPlacesHost.js capitalPinPort, world.js openSea past the Bay
    const pinPortOf = (k) => { const c = tc.capitalCentrePixel(k); return !!(c && arenaPixels()?.byPixel.get(`${c.px},${c.py}`)?.port); };
    const openSea = (x, y) => (isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)) && !pastBayLakeAt(x, y)) || rumareSeaPixel(x, y);
    const clone = (px, py) => tc.synthesizeCapitalLocation(/** @type {any} */ (tc.capitalOnPixel(px, py)), { base, names, blockOf: (n) => blocks.getBlockByName(n), px, py, pinPort: pinPortOf(tc.capitalOnPixel(px, py).k) });
    // every slice of the seven: the registry's port word and the clone's own byte - one law
    const templates = arenaTemplates(rows);
    const registry = pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(templates, p), capitals: true }).filter((r) => tc.isCapitalPlaceId(r.mapId));
    const ported = [];
    for (const r of registry) {
      const byte = clone(r.px, r.py).exterior.exteriorData.portTownAndUnknown;
      assert.equal(byte !== 0, r.port, `${r.name} (${r.px},${r.py}): its byte its registry row's word`);
      if (byte) ported.push([r.name, r.px, r.py]);
    }
    assert.equal(registry.length, 625 + 6);   // the Imperial City's 625 and each other capital's own slice (a shore capital's sea slice is no place)
    assert.deepEqual(ported, [['Waterfront District', 2069, 668], ['Solitude', 1569, -430], ['Alinor', 8, 1533], ['Torval', 1922, 1705]]);
    // each harbour measured as townPlacesFor measures a town: its layout, every model's box - a capital's landmark by its
    // footprint (`foot`) or, as before, by its box - its yards, then the port's two on what they left, off the sea
    const sizes = new Map();
    const dfMeshSize = (id) => { if (!sizes.has(id)) { const i = arch.getRecordIndex(id); sizes.set(id, i === -1 ? null : arch.getMesh(i)?.size ?? null); } return sizes.get(id); };
    const portsOf = (loc, foot) => {
      const lp = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      assert.equal(ps.portTownOnSea(loc, () => false, openSea), true, `${loc.name}: a port the open sea bears on`);
      const yl = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true }), cache = new Map();
      const measures = { ...ys.yardMeasuresOf(yl, {
        boxOf: (id, m) => ys.placedModelBox(id, m, { custom: (cid) => (hasCustomModel(cid) && !customModelNeeds(cid).length && !(foot && tc.isCapitalLandmark(cid)) ? customModelFor(cid)?.positions ?? null : null), classic: (cid) => dfMeshSize(classicModelIdOf(cid)), cache }),
        fieldOf: (id) => flatFieldFor(id), flatsOf: (b) => collectBlockFlats(b.dfBlock, 0),
        closedBlock: (b) => b.blockName === ARENA_BLOCK || (b.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? []).some((x) => x?.buildingType === 16),
      }), keep: [] };
      const g = ys.townGroundOf(yl, measures, null);
      if (isYardTown(loc)) ys.yardSitesOn(g);
      const bearing = ps.seaBearing(lp.x, lp.y, openSea), townSea = ps.townSeaOf(yl, bearing), field = ps.seaField(g.width, g.height, townSea, bearing);
      const sites = ps.portSitesOn(g, field);
      sitesOf.set(loc, sites);
      return sites.map((t) => [t.kind, t.gx, t.gy, field.kind === 'water' ? field.at(...ps.backMiddle(t.gx, t.gy, t.nx, t.nz, t.turn)) : null]);
    };
    const sitesOf = new Map();
    const at = Object.fromEntries(ported.map(([n, x, y]) => [n, clone(x, y)]));
    assert.deepEqual(Object.fromEntries(Object.entries(at).map(([n, loc]) => [n, portsOf(loc, false).map((p) => p[0])])), {
      'Waterfront District': ['shipyard', 'lighthouse'], Solitude: ['lighthouse'], Alinor: ['lighthouse'], Torval: [],
    }, 'by a landmark\'s box: a ring wall\'s box closes the city');   // PIN MOVED (IC-PROPS): the yards by their law (merchantYardSites.js yardLaw - never a way, the Stable by an exit) leave Alinor's lighthouse its room even so
    assert.deepEqual(Object.fromEntries(Object.entries(at).map(([n, loc]) => [n, portsOf(loc, true)])), {
      // its own sea within a few cells of each one's back (its water: the lake, the Sea of Pearls, Topal Bay); Solitude's own
      // blocks hold no sea a navgrid reaches (its outer ring is its rim's), so it stands by the bearing, at its land's
      // north-west corner - its back on the plan's lake blocks, the Sea of Ghosts
      // PIN MOVED (IC-PROPS): the Waterfront's yards placed by their law, the port's two along the same quay on what they left
      'Waterfront District': [['shipyard', 200, 316, 5], ['lighthouse', 246, 316, 5]],
      Solitude: [['shipyard', 129, 373, null], ['lighthouse', 193, 405, null]],
      Alinor: [['shipyard', 62, 93, 2], ['lighthouse', 105, 93, 2]],
      Torval: [['shipyard', 67, 93, 2], ['lighthouse', 110, 93, 2]],
    });
    // the town's directory rows as the host hands its talk (world.js portPlacesOf, world/portSites.js portPlaceRows): the
    // shipyard, its crew hall at the crewmaster's table, the lighthouse, and the Docks - the harbour book's first berth
    // (systems/naval/harbourBook.js, which reads no byte), sounded at its own reach on the ground the game builds past the
    // Bay (each pixel's tiles as the terrain job lays them, a capital's at its own flatten; the tiles' water, Deep Waters
    // off - world.js navalIsWater's arm)
    const { SHIPYARD } = await import('../../../src/world/shipyardModel.js');
    const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
    const { setLocationTiles } = await import('../../../src/world/terrain/terrainTiles.js');
    const { TERRAIN_SIZE } = await import('../../../src/world/terrain/terrainSampler.js');
    const { locationWorldRect } = await import('../../../src/world/streamingWorld.js');
    const { GLOBAL_SCALE } = await import('../../../src/world/meshReader.js');
    const { findHarbour, HARBOUR_REACH } = await import('../../../src/systems/naval/shipLife.js');
    const tiles = new Map();
    const tilesAt = (px, py) => {
      const key = `${px},${py}`;
      if (!tiles.has(key)) {
        const tm = new Uint8Array(16384), on = tc.capitalOnPixel(px, py), loc = on ? clone(px, py) : null;
        const rect = loc ? setLocationTiles(loc, maps, blocks, tm) : null;
        tiles.set(key, generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: !!loc, climateType: 0, flattenAt: loc?.capital?.flattenAt ?? null }).tilemapBytes);
      }
      return tiles.get(key);
    };
    const isWater = (x, z) => {
      const px = Math.floor(x / TERRAIN_SIZE), py = 499 - Math.floor(z / TERRAIN_SIZE);
      const tx = Math.min(127, Math.max(0, Math.trunc(((x - px * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
      const tz = Math.min(127, Math.max(0, Math.trunc(((z - (499 - py) * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
      return (tilesAt(px, py)[tz * 128 + tx] >> 2) === 0;
    };
    assert.equal(HARBOUR_REACH, 420);
    assert.deepEqual(Object.fromEntries(ported.map(([n, x, y]) => {
      const r = locationWorldRect(at[n], x, y);
      const berths = findHarbour({ rect: { minX: r.minX * GLOBAL_SCALE, maxX: r.maxX * GLOBAL_SCALE, minZ: r.minZ * GLOBAL_SCALE, maxZ: r.maxZ * GLOBAL_SCALE }, isWater })?.berths ?? [];
      const rows = ps.portPlaceRows(sitesOf.get(at[n]), SHIPYARD.points.crewmaster, berths[0]?.pos ?? null, n);
      return [n, [berths.length, rows.map((p) => p.kind)]];
    })), {
      'Waterfront District': [6, ['shipyard', 'crewhall', 'lighthouse', 'docks']], Solitude: [6, ['shipyard', 'crewhall', 'lighthouse', 'docks']],
      Alinor: [6, ['shipyard', 'crewhall', 'lighthouse', 'docks']], Torval: [6, ['shipyard', 'crewhall', 'lighthouse', 'docks']],
    }, 'each harbour its four places: the shipyard, its crew hall, the lighthouse and the Docks, six berths at its own reach');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

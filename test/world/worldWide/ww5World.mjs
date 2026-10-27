// WW5 (bible/03-World/World-Wide.md WW5): THE FREEWARE'S WORLD AS THE WORLD HOST MAKES IT, for the stars' and the Hollows'
// tests - the player's own ARENA2 (ARENA2_PATH; sh tools/fetch-data.sh), MAPS.BSA's rows, the Bay's gate scan (the
// world host's gateScanner over the map files), TAMRIEL2's composed ground and politic (the trace and its shipped fit),
// and the world's registry with the Bay's places and TESA's (the capitals and Arena's places as the live list WW7-1
// registers, the countryside and the lairs as its pixel providers, on the plateau's own ground), and the theatres' gate
// scans over it (scenes/gate/gateLanes.js createTheatreGateScans, its `wet` the world host's). Made once a process.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const ARENA2 = process.env.ARENA2_PATH ?? '';
export const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));

let _world = null;
/** The world, made once. */
export async function ww5World() {
  if (_world) return _world;
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace, tamrielLandVersion } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods, tamrielClimateAt } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { createTheatreGateScans } = await import('../../../src/scenes/gate/gateLanes.js');
  const { gateScanner, gateSeaPixel } = await import('../../../src/systems/gate/gateSite.js');
  const { WORLD_SALT, createSpawnGround } = await import('../../../src/world/spawnedDungeons.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const C = await import('../../../src/world/tamrielCountry.js');
  const D = await import('../../../src/world/tamrielDungeons.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
  }
  // the Bay's gate scan, the world host's own (scenes/world.js gateScanOf), over the map files before the land is composed
  const scanner = gateScanner(maps, { spawnSalt: WORLD_SALT, heightAt: (x, y) => woods.getHeightMapValue(x, y) });
  let bayScan = null;
  while (!(bayScan = scanner.step(() => true)));
  // TAMRIEL2: the land past the Bay, at the shipped fit
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  groundMaps(maps);
  const ground = groundWoods(woods);
  const climate = (x, y) => maps.getClimateIndex(x, y);
  const land = C.bayLand(climate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
  const cT = C.countryTemplates(rows, isMainStoryDungeon), lT = D.lairTemplates(rows, isMainStoryDungeon), aT = arenaTemplates(rows, isMainStoryDungeon);
  const plateau = C.createCountryGround(ground);
  const at = { climateAt: climate, heightAt: (x, y) => ground.getHeightMapValue(x, y), ground: plateau };
  const country = { ...at, rates: C.countryRates(C.countryCounts(cT, climate), land), templates: cT };
  const lairs = { ...at, rates: C.countryRates(C.countryCounts(lT, climate), land, D.LAIR_TYPES), templates: lT };
  // the registry, as WW7-1 registers it (scenes/tamrielPlacesHost.js registerTamrielPlaces), the Bay's first
  const places = createWorldPlaces();
  places.register(BAY_SOURCE, bayPlaceRows(rows));
  places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(aT, p), capitals: true }) });
  places.registerPixels('tesa-country', (px, py) => { if (inBay(px, py)) return null; const pick = C.countryStandsAt(country, px, py); return pick && { mapId: C.countryPlaceId(C.countryOrdinal(px, py)), name: '', px, py, type: pick.type }; });
  places.registerPixels('tesa-lairs', (px, py) => { if (inBay(px, py)) return null; const a = D.lairStandsAt(lairs, px, py); return a && { mapId: D.lairPlaceId(a.c), name: '', px, py, type: a.pick.type, hasDungeon: true }; });
  // the theatres' scans, the world host's own (scenes/world.js theatreGates)
  const scans = createTheatreGateScans({ places, spawnSalt: WORLD_SALT, land: tamrielLandVersion, wet: (x, y) => gateSeaPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y)), open: () => true });
  _world = { maps, woods, ground, rows, bayScan, places, scans, spawnGround: createSpawnGround(ground), isMainStoryDungeon };
  return _world;
}

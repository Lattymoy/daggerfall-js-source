#!/usr/bin/env node
// FOUNDATION F1 (2026-10-30, bible/03-World/Foundation-Arc.md): the atlas filled from the player's own ARENA2 in Node, and
// its numbers - the world half of the measurement pass the proposal "A Foundation for Scale" asked for. CLASSIC reads the
// files as Daggerfall shipped them (no world-data door); SERVED reads them as the game serves them - the game's own
// installs on the door and the listed places past the Bay (capitals, Arena's) on the player's trace. WORLD adds every
// place the countryside and the lairs roll past the Bay. PACKS adds the vendored town packs as a player who loads both.
// The door is one per process, so a run is one of the four.
//   ARENA2_PATH=... node tools/atlasMeasure.mjs            the classic files
//   ARENA2_PATH=... node tools/atlasMeasure.mjs --served   as the game serves them, the listed places past the Bay
//   ARENA2_PATH=... node tools/atlasMeasure.mjs --world    served, and every rolled place past the Bay
//   ARENA2_PATH=... node tools/atlasMeasure.mjs --packs    served, and the town packs on
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { createAtlas, fillAtlas } from '../src/world/atlas/atlas.js';
import { servedBlockOf } from '../src/world/atlas/atlasServed.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { createWorldPlaces } from '../src/world/worldWide/worldPlaces.js';
import { bayPlaceRows, BAY_SOURCE } from '../src/world/worldWide/bayPlaces.js';
import * as GRID from '../src/world/worldWide/worldGrid.js';
import { landServedBytes } from '../src/world/land/landLayer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The town packs and their load order (scenes/modWorldData.js WORLD_DATA_PRIORITY). */
export const TOWN_PACKS = Object.freeze([['beautiful-villages', 10], ['beautiful-cities', 20]]);

/** TESA12's fit of the Bay on the player's trace (test/tesa12_places.test.js pins its 283 places on it). */
export const TRACE_FIT = Object.freeze({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });

/**
 * The atlas of the world from an ARENA2 directory. `served`: through the door with the game's own installs, and the
 * places past the Bay as the places host stands them (the capitals' slices and Arena's places listed); `world`: and the
 * countryside's and the lairs' rolled places over every province (minutes); `packs`: and the town packs (once a process -
 * the door and the trace are the process's). A mod's added location is bundled under its own source ('additions'),
 * beside the registry's Bay (HUB1 keeps it out of the game's registry: it stands on one client and not another).
 * @param {string} arena2 @param {{ served?: boolean, packs?: boolean, world?: boolean }} [o]
 */
export async function loadWorldAtlas(arena2, { served = false, packs = false, world = false } = {}) {
  served ||= packs || world;
  const bytes = (/** @type {string} */ n) => landServedBytes(n, new Uint8Array(readFileSync(join(arena2, n))));   // the land's rows on the Bay, as fetchBytes serves them
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  if (served) {
    await installServed(blocks);
    if (packs) await loadTownPacks(blocks);
  }
  /** @type {Map<number, any>} */ const locOf = new Map();
  const locs = [], added = [];
  // BAY-OWN: the Bay's provider reads MAPS.BSA's own rows (the world host's walk, scenes/world.js); every other read is the registry's
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    const base = reg ? maps.baseLocationCount(r) : 0;
    for (let l = 0; l < (reg?.locationCount ?? 0); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.mapTableData) continue;
      (l < base ? locs : added).push(loc);
      locOf.set(loc.mapTableData.mapId >>> 0, loc);
    }
  }
  const places = createWorldPlaces();
  places.register(BAY_SOURCE, bayPlaceRows(locs));
  if (added.length) places.register('additions', bayPlaceRows(added));
  const tp = served ? await standPastBay({ bytes, maps, blocks, locs, places }) : null;
  const locate = (/** @type {any} */ p) => locOf.get(p.mapId) ?? tp?.provinceQuestPlaces.standAt(p.px, p.py) ?? null;
  const atlas = createAtlas({ resolveBlock: servedBlockOf(blocks) });
  const filled = fillAtlas(atlas, places.all(), locate);
  let rolled = null;
  if (world && tp) {
    const rows = rolledPlacesPastBay(tp);
    rolled = fillAtlas(atlas, rows.map((r) => ({ ...r, region: tp.provinceQuestPlaces.regionAt(r.px, r.py), source: 'rolled' })), locate);
    rolled.rows = rows.length;
  }
  const names = Array.from({ length: blocks.count }, (_, i) => blocks.getBlockName(i));
  return { atlas, places, filled, rolled, blockNames: names, maps, blocks, tamriel: tp };
}

/** The town packs on the door, each rebuilt from the player's own blocks, in their load order (scenes/modWorldData.js). */
async function loadTownPacks(/** @type {any} */ blocks) {
  const W = await import('../src/formats/worldData/worldDataReplacement.js');
  const { openWorldDataPack } = await import('../src/formats/worldData/worldDataPack.js');
  const { setValue } = await import('../src/systems/settings/settings.js');
  setValue('Enhancements', 'AssetInjection', 'True');
  for (const [v, priority] of TOWN_PACKS) {
    const json = JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString('utf8'));
    W.registerWorldDataPack(openWorldDataPack(json, { blocks }), () => true, { priority });
  }
  W.quietLocationOverrides(true);
}

/** The world past the Bay as the world host stands it: the places host (scenes/tamrielPlacesHost.js createTamrielPlaces)
 *  composed as scenes/world.js composes it - the trace, the capitals, Arena's places, the countryside and the lairs, each
 *  off the game's own rows as MAPS.BSA holds them. Its listed places (the capitals' slices, Arena's) join the registry. */
async function standPastBay({ bytes, maps, blocks, locs, places }) {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { groundWoods, groundMaps } = await import('../src/world/tamriel/tamrielGround.js');
  const { isMainStoryDungeon } = await import('../src/world/dungeon/dungeonTextures.js');
  const C = await import('../src/world/tamrielCountry.js');
  const D = await import('../src/world/tamrielDungeons.js');
  const { arenaTemplates } = await import('../src/world/arenaLocations.js');
  const { setArenaStanding } = await import('../src/world/arenaPlaces.js');
  const { capitalBase, cityBlockNames, setCapitalsStanding } = await import('../src/world/tamrielCapitals.js');
  const { createTamrielPlaces } = await import('../src/scenes/tamrielPlacesHost.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (/** @type {string} */ n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(TRACE_FIT);
  const woodsFile = new WoodsFile(); woodsFile.load(bytes('WOODS.WLD'));
  const woods = groundWoods(woodsFile);
  groundMaps(maps);
  // as world.js's classicRow: a row the door replaced read as MAPS.BSA holds it
  const rows = locs.map((/** @type {any} */ l) => (maps.locationReplaced(l.regionIndex, l.locationIndex) ? maps.readClassicLocation(l.regionIndex, l.locationIndex) : l)).filter(Boolean);
  const climate = (/** @type {number} */ x, /** @type {number} */ y) => maps.getClimateIndex(x, y);
  setArenaStanding(true);
  setCapitalsStanding(true);
  const countryT = C.countryTemplates(rows, isMainStoryDungeon), lairT = D.lairTemplates(rows, isMainStoryDungeon);
  const host = {
    _arenaTemplates: arenaTemplates(rows, isMainStoryDungeon), _capitalBase: capitalBase(rows, isMainStoryDungeon), _capitalNames: cityBlockNames(rows),
    _countryCounts: C.countryCounts(countryT, climate), _countryTemplates: countryT, _lairCounts: C.countryCounts(lairT, climate), _lairPools: D.lairPools(lairT), _lairTemplates: lairT,
    arenaJoinLand: null, arenaRoadsLanded: null, arenaStands: true, blocks, locationIndex: new Map(), maps, tamrielLand: null, terrainGen: null,
    townSeats: null, woodsBytes: null, worldPlaces: places, zoneHalls: null, _locIndexGen: 0, woods,
  };
  return createTamrielPlaces(host);
}

/** The world-data installs the game makes before its first layout (scenes/modWorldData.js loadModWorldData), the
 *  colosseum's binary read off disk. */
async function installServed(/** @type {any} */ blocks) {
  const W = await import('../src/formats/worldData/worldDataReplacement.js');
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  const { installArena } = await import('../src/world/arena/arenaCity.js');
  const { installCapitals } = await import('../src/world/capitalModels.js');
  const { installTownOutline } = await import('../src/world/townOutline.js');
  const { installUrbanArt } = await import('../src/world/urban/urbanArt.js');
  const { installShipRefit } = await import('../src/world/shipRefit.js');
  const { installCuratedBlocks } = await import('../src/world/dungeon/curatedInstall.js');
  await installArena({ readBin: async () => new Uint8Array(readFileSync(join(ROOT, 'vendor/daggerfall-arena/Models/864102.bin'))) });
  installCapitals({ addTextures: () => {} }); installTownOutline(); installUrbanArt({ addTextures: () => {} });
  installShipRefit(W.boundWorldDataBlocks()); installCuratedBlocks();
}

/**
 * The places past the Bay no list holds - the countryside's and the lairs' rolls - over every district a province
 * holds: each district's square read through the host's own bounded reads (countryNear, lairsNear), each place once.
 * @param {any} tp the places host @returns {{ px: number, py: number, mapId: number, name: string, type: number }[]}
 */
export function rolledPlacesPastBay(tp) {
  const { theatreAt, DISTRICT_PX, WORLD_PIXEL_SPAN, DISTRICTS_ACROSS } = GRID;
  const P = tp.provinceQuestPlaces, half = DISTRICT_PX / 2, seen = new Set(), out = [];
  for (let cy = 0; cy < DISTRICTS_ACROSS; cy++) for (let cx = 0; cx < DISTRICTS_ACROSS; cx++) {
    const x0 = cx * DISTRICT_PX - WORLD_PIXEL_SPAN, y0 = cy * DISTRICT_PX - WORLD_PIXEL_SPAN;
    let held = false;
    for (let j = 0; j <= 4 && !held; j++) for (let i = 0; i <= 4 && !held; i++) held = theatreAt(x0 + Math.min(DISTRICT_PX - 1, i * 24), y0 + Math.min(DISTRICT_PX - 1, j * 24)) > 0;
    if (!held) continue;
    const mx = x0 + half, my = y0 + half;
    for (const r of [...P.countryNear(mx, my, half), ...P.lairsNear(mx, my, half)]) {
      if (r.px < x0 || r.py < y0 || r.px >= x0 + DISTRICT_PX || r.py >= y0 + DISTRICT_PX || seen.has(r.mapId)) continue;
      seen.add(r.mapId); out.push(r);
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('set ARENA2_PATH (sh tools/fetch-data.sh fetches it)'); process.exit(2); }
  const packs = process.argv.includes('--packs'), world = process.argv.includes('--world'), served = packs || world || process.argv.includes('--served');
  const log = console.log;
  if (served) console.log = () => {};   // the door's own "Found a new DFBlock" lines, one a pack's block
  const { atlas, filled, rolled, blockNames } = await loadWorldAtlas(arena2, { served, packs, world });
  console.log = log;
  const c = atlas.counts();
  const unusedRmb = atlas.unused(blockNames, 'rmb'), allRmb = blockNames.filter((n) => /\.RMB$/i.test(n));
  const unusedRdb = atlas.unused(blockNames, 'rdb'), allRdb = blockNames.filter((n) => /\.RDB$/i.test(n));
  console.log(packs ? 'PACKS (served, and the town packs on)' : world ? 'WORLD (served, and every rolled place past the Bay)' : served ? 'SERVED (the door, the game\'s installs, the listed places past the Bay)' : 'CLASSIC (the files as shipped)');
  if (rolled) console.log(`rolled past the Bay: ${rolled.rows} places (${rolled.unlocated.length} unlocated)`);
  console.log(`places ${c.places} (${filled.unlocated.length} unlocated), regions ${c.regions}, buildings ${c.buildings}, doors ${c.doors}, dungeons ${c.dungeons}`);
  console.log(`exterior slots ${c.exteriorSlots} over ${c.rmb} blocks (mean reuse ${(c.exteriorSlots / Math.max(1, c.rmb)).toFixed(1)}); dungeon slots ${c.dungeonSlots} over ${c.rdb} blocks`);
  console.log(`BLOCKS.BSA RMB named by no place: ${unusedRmb.length} of ${allRmb.length} (${((100 * unusedRmb.length) / Math.max(1, allRmb.length)).toFixed(1)}%); RDB: ${unusedRdb.length} of ${allRdb.length}`);
  const probs = atlas.problems();
  console.log(`problems: ${probs.filter((p) => p.why === 'unresolved').length} unresolved, ${probs.filter((p) => p.why === 'aliased').length} aliased`);
  for (const p of probs.slice(0, 20)) console.log(`  ${p.why} ${p.part} ${p.name}${p.as ? ` -> ${p.as}` : ''} (place ${p.place})`);
  const byRegion = [...atlas.parts('region')].filter((r) => r.region >= 62);
  if (byRegion.length) console.log(`past the Bay: ${byRegion.map((r) => `${r.region}:${r.places}`).join(' ')}`);
}

#!/usr/bin/env node
// FOUNDATION F1 (2026-10-30, bible/03-World/Foundation-Arc.md): the atlas filled from the player's own ARENA2 in Node, and
// its numbers - the world half of the measurement pass the proposal "A Foundation for Scale" asked for. CLASSIC reads the
// files as Daggerfall shipped them (no world-data door); SERVED reads them as the game serves them - the port's own
// edits on the door (the walled cities' rings, a town's open cells) and the places past the Bay on the player's trace.
// PACKS adds the vendored town packs (Beautiful Villages, Beautiful Cities) as a player who loads both serves them.
// The door is one per process, so a run is one of the three.
//   ARENA2_PATH=... node tools/atlasMeasure.mjs            the classic files
//   ARENA2_PATH=... node tools/atlasMeasure.mjs --served   as the game serves them, past the Bay included
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The town packs and their load order (scenes/modWorldData.js WORLD_DATA_PRIORITY). */
export const TOWN_PACKS = Object.freeze([['beautiful-villages', 10], ['beautiful-cities', 20]]);

/** TESA12's fit of the Bay on the player's trace (test/tesa12_places.test.js pins its 283 places on it). */
export const TRACE_FIT = Object.freeze({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });

/**
 * The atlas of the world from an ARENA2 directory. `served`: through the door with the port's own edits, and the places
 * past the Bay on the trace; `packs`: and the town packs (once a process - the door and the trace are the process's).
 * A mod's added location is bundled under its own source ('additions'), beside the registry's Bay (HUB1 keeps it out of
 * the game's registry: it stands on one client and not another).
 * @param {string} arena2 @param {{ served?: boolean, packs?: boolean }} [o]
 */
export async function loadWorldAtlas(arena2, { served = false, packs = false } = {}) {
  served ||= packs;
  const bytes = (/** @type {string} */ n) => new Uint8Array(readFileSync(join(arena2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  if (served) {
    const { installWorldDataReplacement, bindWorldDataBlocks } = await import('../src/formats/worldData/worldDataReplacement.js');
    const { installTownOutline } = await import('../src/world/townOutline.js');
    installWorldDataReplacement(); bindWorldDataBlocks(blocks); installTownOutline();
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
  if (served) await standPastBay({ arena2, bytes, maps, blocks, locs, places, locOf });
  const atlas = createAtlas({ resolveBlock: servedBlockOf(blocks) });
  const filled = fillAtlas(atlas, places.all(), (p) => locOf.get(p.mapId));
  const names = Array.from({ length: blocks.count }, (_, i) => blocks.getBlockName(i));
  return { atlas, places, filled, blockNames: names, maps, blocks };
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

/** The places past the Bay as the world host stands them (scenes/tamrielPlacesHost.js arenaLocationAt), into the
 *  registry and `locOf`: the trace, the model's pixels, each place's clone of its template with its outline. Capitals
 *  stand on their own plans (TESA10) and are left out here. */
async function standPastBay({ bytes, maps, blocks, locs, places, locOf }) {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../src/world/tamriel/tamrielFrame.js');
  const { arenaPixels } = await import('../src/world/arenaPlaces.js');
  const { arenaTemplates, arenaTemplateOf, synthesizeArenaLocation, arenaPlaceId } = await import('../src/world/arenaLocations.js');
  const { outlineTownLocation, unwalledLocation, townOutlineBlockJson } = await import('../src/world/townOutline.js');
  const { standTownWall } = await import('../src/world/townWalls.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../src/world/pastBayRows.js');
  const { REGION_NAMES } = await import('../src/formats/mapsTables.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (/** @type {string} */ n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(TRACE_FIT);
  const pixels = arenaPixels();
  const templates = arenaTemplates(locs.map(unwalledLocation));
  const templateOf = (/** @type {any} */ p) => arenaTemplateOf(templates, p);
  places.register(PAST_BAY_SOURCE, pastBayPlaceRows({ pixels, templateOf, capitals: false }));
  const io = { classicOf: (/** @type {string} */ n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (/** @type {string} */ n) => blocks.getBlockByName(n) };
  for (const p of pixels?.stood ?? []) {
    const t = templateOf(p);
    if (!t) continue;
    const regionIndex = maps.getRegionIndexAt(p.bx, p.by);
    const loc = outlineTownLocation(synthesizeArenaLocation(t, p, { regionIndex, regionName: REGION_NAMES[regionIndex] }), io);
    if (loc.outline?.walled) standTownWall(loc, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);   // its wall's carrier, as the host stands it
    locOf.set(arenaPlaceId(p), loc);
  }
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('set ARENA2_PATH (sh tools/fetch-data.sh fetches it)'); process.exit(2); }
  const packs = process.argv.includes('--packs'), served = packs || process.argv.includes('--served');
  const log = console.log;
  if (packs) console.log = () => {};   // the door's own "Found a new DFBlock" lines, one a pack's block
  const { atlas, filled, blockNames } = await loadWorldAtlas(arena2, { served, packs });
  console.log = log;
  const c = atlas.counts();
  const unusedRmb = atlas.unused(blockNames, 'rmb'), allRmb = blockNames.filter((n) => /\.RMB$/i.test(n));
  const unusedRdb = atlas.unused(blockNames, 'rdb'), allRdb = blockNames.filter((n) => /\.RDB$/i.test(n));
  console.log(packs ? 'PACKS (served, and the town packs on)' : served ? 'SERVED (the door, the port\'s edits, the places past the Bay)' : 'CLASSIC (the files as shipped)');
  console.log(`places ${c.places} (${filled.unlocated.length} unlocated), regions ${c.regions}, buildings ${c.buildings}, doors ${c.doors}, dungeons ${c.dungeons}`);
  console.log(`exterior slots ${c.exteriorSlots} over ${c.rmb} blocks (mean reuse ${(c.exteriorSlots / Math.max(1, c.rmb)).toFixed(1)}); dungeon slots ${c.dungeonSlots} over ${c.rdb} blocks`);
  console.log(`BLOCKS.BSA RMB named by no place: ${unusedRmb.length} of ${allRmb.length} (${((100 * unusedRmb.length) / Math.max(1, allRmb.length)).toFixed(1)}%); RDB: ${unusedRdb.length} of ${allRdb.length}`);
  const probs = atlas.problems();
  console.log(`problems: ${probs.filter((p) => p.why === 'unresolved').length} unresolved, ${probs.filter((p) => p.why === 'aliased').length} aliased`);
  for (const p of probs.slice(0, 20)) console.log(`  ${p.why} ${p.part} ${p.name}${p.as ? ` -> ${p.as}` : ''} (place ${p.place})`);
  const byRegion = [...atlas.parts('region')].filter((r) => r.region >= 62);
  if (byRegion.length) console.log(`past the Bay: ${byRegion.map((r) => `${r.region}:${r.places}`).join(' ')}`);
}

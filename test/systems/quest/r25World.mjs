// AUDIT RELEASE R2-5: THE WORLD PAST THE BAY AS THE BUILD STANDS IT, in Node over the freeware (ARENA2_PATH) - the
// places host (scenes/tamrielPlacesHost.js createTamrielPlaces) on the game's own rows, templates and blocks, the
// trace from the player's Daggerfall files on the freeware's fit, the world's registry (the Bay's rows and the places
// past it), and the quest layer (scenes/questWorld.js createQuestWorld) over it with a real QuestMachine - what
// test/systems/quest/auditrelease_r25.test.js drives a questor through. The world host's own boot (scenes/world.js) is
// what this follows, step for step, without a renderer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Stand the world past the Bay. @param {string} ARENA2 */
export async function standWorldPastBay(ARENA2) {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { FactionFile } = await import('../../../src/formats/factionFile.js');
  const { groundWoods, groundMaps } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const C = await import('../../../src/world/tamrielCountry.js');
  const D = await import('../../../src/world/tamrielDungeons.js');
  const { arenaTemplates } = await import('../../../src/world/arenaLocations.js');
  const { setArenaStanding } = await import('../../../src/world/arenaPlaces.js');
  const { capitalBase, cityBlockNames, setCapitalsStanding } = await import('../../../src/world/tamrielCapitals.js');
  const { installWorldDataReplacement, bindWorldDataBlocks } = await import('../../../src/formats/worldData/worldDataReplacement.js');
  const { installCapitals } = await import('../../../src/world/capitalModels.js');
  const { installTownOutline } = await import('../../../src/world/townOutline.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { createTamrielPlaces } = await import('../../../src/scenes/tamrielPlacesHost.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');

  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit
  const woodsFile = new WoodsFile(); woodsFile.load(bytes('WOODS.WLD'));
  const woods = groundWoods(woodsFile);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  groundMaps(maps);
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  installWorldDataReplacement(); installCapitals(); installTownOutline();
  bindWorldDataBlocks(blocks);   // QUEST-FABRIC: as the world host binds it (scenes/world.js) - BLD-3's fabric buildings read off BLOCKS.BSA's donors
  const factions = new FactionFile(); factions.load(bytes('FACTION.TXT'));
  // PROVINCE-COURTS: the talk host's reader as scenes/townTalk.js loads it - FACTION.TXT, then the door every non-FACTION.TXT
  // faction comes in by (systems/faction/factionRep.js addCustomFactions: the provinces' own courts and people first)
  const { addCustomFactions } = await import('../../../src/systems/faction/factionRep.js');
  addCustomFactions(factions.factionDict, factions.factionNameToId);
  const rows = [];
  for (let r = 0; r < 62; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const climate = (x, y) => maps.getClimateIndex(x, y);
  setArenaStanding(true);
  const _countryTemplates = C.countryTemplates(rows, isMainStoryDungeon);
  const _lairTemplates = D.lairTemplates(rows, isMainStoryDungeon);
  const _capitalBase = capitalBase(rows, isMainStoryDungeon);
  setCapitalsStanding(true);
  const worldPlaces = createWorldPlaces();
  worldPlaces.register(BAY_SOURCE, bayPlaceRows(rows.filter((l) => l?.exterior?.exteriorData)));
  const locationIndex = new Map();
  const host = {
    _arenaTemplates: arenaTemplates(rows, isMainStoryDungeon), _capitalBase, _capitalNames: cityBlockNames(rows),
    _countryCounts: C.countryCounts(_countryTemplates, climate), _countryTemplates,
    _lairCounts: C.countryCounts(_lairTemplates, climate), _lairPools: D.lairPools(_lairTemplates), _lairTemplates,
    arenaJoinLand: null, arenaRoadsLanded: null, arenaStands: true, blocks, locationIndex, maps, tamrielLand: null, terrainGen: null,
    townSeats: null, woodsBytes: null, worldPlaces, zoneHalls: null, _locIndexGen: 0, woods,
  };
  void isWaterPixel;
  const places = createTamrielPlaces(host);
  return { maps, blocks, woods, factions, worldPlaces, locationIndex, places, rows };
}

/**
 * The quest layer over the world, a questor standing at `pixel` (in `location`, inside `inside`), as the world host wires
 * it (scenes/world.js createQuestWorld) - with a QuestMachine.
 */
export async function questLayerAt(world, { pixel, location }) {
  const { createQuestWorld } = await import('../../../src/scenes/questWorld.js');
  const { QuestMachine } = await import('../../../src/systems/quest/machine.js');
  const { questActionsExtensionTemplates } = await import('../../../src/systems/quest/questActionsExtension.js');
  const { questlineActionTemplates } = await import('../../../src/systems/questlines/qlActions.js');
  const { ensureFactionRep } = await import('../../../src/systems/faction/factionRep.js');
  const { playerEntity } = await import('../../../src/characters/playerEntity.js');
  const { maps, blocks, locationIndex, places, factions } = world;
  const state = { pixel, location, inside: null, machine: null };
  const placeByName = (regionName, locationName) => maps.getLocationByName(regionName, locationName)
    ?? [...locationIndex.values()].find((l) => (l?.ether || l?.arena || l?.country || l?.capital) && l.name === locationName && l.regionName === regionName) ?? null;
  const host = {
    maps, blocks, params: new URLSearchParams(), placeByName, provinceQuestPlaces: places.provinceQuestPlaces,
    _questLoc: () => state.location, _questRegionIndex: () => maps.getRegionIndexAt(state.pixel.x, state.pixel.y),
    playerTravelOrigin: () => state.pixel, playerTravelPixel: () => state.pixel,
    _questStore: () => ensureFactionRep(playerEntity, factions.factionDict), _regionFaction: () => null,
    townTalk: { nameOpts: () => ({}), buildingDirectory: [], factionDict: factions.factionDict },
    pipeline: { flatCaption: () => '' }, onlineHomes: null, homeLayoutsOnline: false, _homeLayoutsApplied: true,
    get questBridge() { return state.machine ? { machine: state.machine } : null; },
    get modes() { return state.inside ? { mode: state.inside.dungeon ? 'dungeon' : 'interior', interiorBuilding: state.inside.building ?? null, dungeonLocation: state.inside.dungeon ?? null } : { mode: 'exterior' }; },
    npcSession: { npcData: null }, _musicInLocationRect: () => !state.inside,
  };
  const { questWorld } = createQuestWorld(host);
  const machine = new QuestMachine({ nowSeconds: () => 0, world: questWorld, getReputation: () => 0, changeReputation: () => {}, playerLevel: () => 1 });
  for (const t of questActionsExtensionTemplates()) machine.registerAction(t);
  for (const t of questlineActionTemplates()) machine.registerAction(t);
  state.machine = machine;
  return { state, questWorld, machine };
}

// QUEST-AUDIT IV (bible/01-Overview/audits/Quest-Audit-IV.md): THE REAL QUEST BRIDGE ON THE FREEWARE WORLD - the bridge
// (scenes/quest/questBridge.js) over test/systems/quest/r25World.mjs standWorldPastBay, its questWorld
// (scenes/questWorld.js createQuestWorld) the machine's world; two or more bridges on one world, each with its own clock,
// pack and popups (the audit's CORE lane rig, kept for its pins). Needs ARENA2_PATH.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../../modsOff.js';
import { standWorldPastBay } from './r25World.mjs';
import * as QS from '../../qlSources.mjs';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { ensureFactionRep } from '../../../src/systems/faction/factionRep.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { TextRsc } from '../../../src/formats/textRsc.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { findFactions } from '../../../src/systems/talk/talk.js';

const ARENA2 = process.env.ARENA2_PATH;
let _textRsc = null;
const textRsc = () => (_textRsc ??= new TextRsc().load(new Uint8Array(readFileSync(join(ARENA2, 'TEXT.RSC')))));
export { QS };

export const quiet = (fn) => { const w = console.warn, l = console.log, e = console.error; console.warn = () => {}; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.error = e; } };
export const quietAsync = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

let _world = null;
export async function world() {
  if (!_world) { QS.loadTables(); setPref(QUESTLINES_PREF, true); _world = await quietAsync(() => standWorldPastBay(ARENA2)); }
  return _world;
}

/** A location the world stands, by region and name (the Bay's MAPS.BSA, or a province's through its places). */
export function locationOf(w, region, name) {
  if (region === 'px') { const [x, y] = name.split(',').map(Number); const loc = w.places.provinceQuestPlaces.standAt(x, y); return loc ? { location: loc, pixel: { x, y } } : null; }
  const bay = w.maps.getLocationByName(region, name);
  if (bay) return { location: bay, pixel: longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude) };
  return null;
}

/** A bridge at `location` (pixel), on world `w`. */
export function makeBridge(w, { location, pixel, start = 400 * 86400 + 12 * 3600, sharedClock = false, ctxOver = {} } = {}) {
  const { maps, blocks, locationIndex, places, factions } = w;
  const state = { pixel, location, inside: null, bridge: null };
  const placeByName = (regionName, locationName) => maps.getLocationByName(regionName, locationName)
    ?? [...locationIndex.values()].find((l) => (l?.ether || l?.arena || l?.country || l?.capital) && l.name === locationName && l.regionName === regionName) ?? null;
  const host = {
    maps, blocks, params: new URLSearchParams(), placeByName, provinceQuestPlaces: places.provinceQuestPlaces,
    _questLoc: () => state.location, _questRegionIndex: () => maps.getRegionIndexAt(state.pixel.x, state.pixel.y),
    playerTravelOrigin: () => state.pixel, playerTravelPixel: () => state.pixel,
    _questStore: () => ensureFactionRep(playerEntity, factions.factionDict), _regionFaction: () => { const dict = ensureFactionRep(playerEntity, factions.factionDict)?.dict ?? null; return dict ? findFactions(dict, { type: FACTION_TYPES.Province, region: maps.getRegionIndexAt(state.pixel.x, state.pixel.y) })[0] ?? null : null; },
    townTalk: { nameOpts: () => ({}), buildingDirectory: [], factionDict: factions.factionDict, randomText: (id) => textRsc().randomTextById(id, Math.random) ?? '' },
    talkBuildingCompassDirection: () => 'north',
    built: new Map(), player: { pos: [0, 0, 0] }, exteriorFoePool: () => [], exteriorFoes: [], collider: null, arenaCityPixel: () => null, _respawnAtSite: () => Promise.resolve(false),
    pipeline: { flatCaption: () => '' }, onlineHomes: null, homeLayoutsOnline: false, _homeLayoutsApplied: true,
    get questBridge() { return state.bridge; },
    get modes() { return state.inside ? { mode: state.inside.dungeon ? 'dungeon' : 'interior', interiorBuilding: state.inside.building ?? null, dungeonLocation: state.inside.dungeon ?? null } : { mode: 'exterior' }; },
    npcSession: { npcData: null }, _musicInLocationRect: () => !state.inside,
  };
  const { questWorld } = createQuestWorld(host);
  const st = { s: start, pack: [], rewards: [], popups: [], hud: [], rep: [], gold: 0, prompts: [] };
  const pe = { name: 'Hero', level: 10, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30), items: null };
  const bridge = createQuestBridge({
    world: questWorld,
    data: { readListTable: () => null, getQuestSourceLines: (n, on) => QS.questSource(n, on ?? true) },
    classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => true, questlineService: null,
    sharedClock: () => sharedClock, playerRaceName: () => 'Breton',
    playerEntity: pe,
    showChoice: () => {}, giveItemToPlayer: (item) => st.pack.push(item), removeItemFromPlayer: (item) => { const i = st.pack.indexOf(item); if (i >= 0) st.pack.splice(i, 1); },
    carriesQuestItem: (r) => st.pack.some((x) => x === r?.daggerfallUnityItem || (x?.questItem && x.questUID === r?.parentQuest?.uid && x.questSymbol?.name === r?.symbol?.name)),   // the world host's match (scenes/world.js)
    offerReward: (_q, item) => st.rewards.push(item), onQuestlineOffer: () => {},
    showPopup: (q, tokens) => st.popups.push({ q: q.questName, tokens }),
    addHUDText: (t) => st.hud.push(t), changeReputation: (f, a) => st.rep.push([f, a]),
    addGold: (n) => { st.gold += n; }, getGoldPieces: () => st.gold, getTotalGold: () => st.gold,
    ...ctxOver,
  });
  state.bridge = bridge;
  return { bridge, machine: bridge.machine, st, state, questWorld };
}

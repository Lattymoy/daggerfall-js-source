// @ts-check
// SHIPYARDS (2026-10-11, Mac: "I want to give ports the same treatment we did wagons and horses. A new highly detailed
// shipmaster vendor and crew recruitment station within it ... This should also come with a detailed overhaul to piers
// and introduce the new lighthouse building. Everything should show on the map/overworld and be able to be asked by
// NPCs"): THE PORT'S PLACES, NAMED AND FOUND AS A YARD IS - the law of what a port town stands beside its Stable and its
// Wagon Yard, and how the town's talk directory, its two maps and the Overworld know each one.
//
// THE PLACES. A port town (a city, a town or a village that is a port by its own data - `portTownByData`: Travel Options'
// hand-written harbours or Daggerfall's PortTownAndUnknown byte, never a seat's members' harbour, which is one guild's
// word, so every client stands the same shipyard - and that the open sea bears on: world/portSites.js portTownOnSea,
// FIELD BUGS 2026-10-14 INLAND-PORTS) stands two of its own, on
// its seaward ground (world/portSites.js - Mac chose "the town's seaward edge", placed off the town's layout like the
// Stables): a SHIPYARD, the shipmaster's - with its CREW HALL inside its fence, where the crewmaster signs hands on -
// and a LIGHTHOUSE, the lightkeeper's. Its DOCKS are the harbour's quays, found off the terrain (systems/naval/quays.js).
// Like the yards they are not buildings: no building record, no deed, no quest place; each is found by a row of the
// town's directory under a key no Daggerfall building can hold (`foundBuildingKey`), its ground and its name on the town
// maps (world/merchantYards/merchantYardMap.js), and a mark on the Overworld (scenes/portHost.js).
//
// WHO KEEPS THEM: a person of the town's own people, named on the region's bank off a seed of the town's map id and the
// place's own salt (systems/merchantYards.js townKeeper - the yards' one draw), so every client meets the same
// shipmaster. The shipyard and its crew hall are named for their keepers ("Halbrecht's Shipyard", "Voss's Crew Hall");
// the lighthouse and the docks for the town ("The Sentinel Light", "Sentinel Docks").
//
// A LEAF: the talk window, the topic tree and the maps read it, so it imports the yards' law alone. The trade is
// systems/shipyards.js; the recruits systems/crewHall.js. Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A
// (SHIPYARDS).
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { YARD_KIND_ORDER, CRAFT_YARD_ORDER, YARD_TALK_GROUPS, YARD_KEY_BASE, YARD_QUALITY, townSeed, townKeeper, namedAfter } from './merchantYards.js';

/** The two places a port town's layout stands, in the order they are placed (world/portSites.js). */
export const PORT_SITE_ORDER = Object.freeze(['shipyard', 'lighthouse']);
/** Every place of a port a person can be asked after, in the Where-is page's order: the shipyard, the crew hall inside
 *  its fence, the lighthouse, and the harbour's docks. */
export const PORT_PLACE_ORDER = Object.freeze(['shipyard', 'crewhall', 'lighthouse', 'docks']);
/**
 * Each place: `title` what follows its keeper's name (or the town's), `keeper` what its keeper is called, `trade` its
 * plaque's line, `sign` its board's word (the shipyard's alone), `seed` its own salt on the town's map id (its keeper's
 * name and face), `group` the Where-is page's group (as DFU's are worded - "General stores", "Taverns").
 */
export const PORT_PLACES = Object.freeze({
  shipyard: Object.freeze({ key: 'shipyard', title: 'Shipyard', keeper: 'Shipmaster', trade: 'Ships sold, bought back, mended and refitted', sign: 'SHIPS', seed: 0x5419a7, group: 'Shipyards' }),
  crewhall: Object.freeze({ key: 'crewhall', title: 'Crew Hall', keeper: 'Crewmaster', trade: 'Hands signed on for any ship', sign: 'CREW', seed: 0x0c4e11, group: 'Crew halls' }),
  lighthouse: Object.freeze({ key: 'lighthouse', title: 'Lighthouse', keeper: 'Lightkeeper', trade: 'The harbor\'s light', sign: '', seed: 0x011947, group: 'Lighthouses' }),
  docks: Object.freeze({ key: 'docks', title: 'Docks', keeper: '', trade: 'Ships made fast and cargo landed', sign: '', seed: 0x00d0c5, group: 'Docks' }),
});
/** A place the law knows, or null. */
export const validPortPlace = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(PORT_PLACES, k) ? k : null);
/** A place a town's layout stands (PORT_SITE_ORDER's), or null. */
export const validPortSite = (k) => (PORT_SITE_ORDER.includes(/** @type {any} */ (k)) ? /** @type {string} */ (k) : null);

/** The towns that stand the port's places: the cities, towns and villages the port's harbour law calls ports (the
 *  host's `isPort` - its map pixel's port). No farm, manor, temple or dungeon stands a shipyard. */
export const PORT_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
/** Whether a map table's location type is a town's (PORT_TOWN_TYPES) - the half of `isPortTown` a map summary answers
 *  alone (FIELD BUGS 2026-10-13c PORT-TOWNS: the harbour board's ports, scenes/world.js navalPortList). Pure.
 *  @param {number} type */
export const isPortTownType = (type) => PORT_TOWN_TYPES.includes(/** @type {any} */ (type));
/** Whether a location stands the port's places: a town of PORT_TOWN_TYPES that `isPort` says is a port (the host's
 *  portOnSea - world/portSites.js portTownOnSea: a port by its data that the open sea bears on). */
export const isPortTown = (loc, isPort) => isPortTownType(loc?.mapTableData?.locationType) && !!isPort;
/** Whether a location is a port by its own data - `hasPort(mapId)` (Travel Options' hand-written harbours, travelPorts.js)
 *  or Daggerfall's PortTownAndUnknown byte (AUDIT SHIPYARDS L6-10: executed here, not read off world.js's text) - the
 *  data's half of world/portSites.js portTownOnSea. The data alone is no coast (FIELD BUGS 2026-10-14 INLAND-PORTS): the
 *  byte's 0x10 is the region capitals' mark, and the table copied the byte's list. Pure. */
export const portTownByData = (loc, hasPort) => !!hasPort?.(loc?.mapTableData?.mapId) || (loc?.exterior?.exteriorData?.portTownAndUnknown ?? 0) !== 0;

/**
 * THE FOUND PLACES' ONE ORDER (YARDS-FOUND's law, widened): the town's yards (systems/merchantYards.js), then the port's
 * places - the Where-is page's groups after the shops, and each one's key in the town's directory: YARD_KEY_BASE and its
 * place here, so the Stable and the Wagon Yard keep the keys they had (YARD_KEY_BASE + 0, + 1) and the port's follow.
 * CARP-YARD: the professions' yards last (the joinery's YARD_KEY_SLOT is its place here), so every key before it stays.
 */
export const FOUND_KIND_ORDER = Object.freeze([...YARD_KIND_ORDER, ...PORT_PLACE_ORDER, ...CRAFT_YARD_ORDER]);
/** The Where-is page's group of each found place. */
export const FOUND_TALK_GROUPS = Object.freeze({
  ...YARD_TALK_GROUPS,
  ...Object.fromEntries(PORT_PLACE_ORDER.map((k) => [k, PORT_PLACES[k].group])),
});
/** A found place's key in its town's directory (YARD_KEY_BASE + its place in FOUND_KIND_ORDER), or -1 for none. */
export const foundBuildingKey = (kind) => {
  const i = FOUND_KIND_ORDER.indexOf(/** @type {any} */ (kind));
  return i < 0 ? -1 : YARD_KEY_BASE + i;
};
/** The found places the town maps never letter - the crew hall (inside the shipyard's fence) and the docks (the harbour's
 *  quays), by their keys. */
const UNLETTERED = new Set(['crewhall', 'docks'].map((k) => foundBuildingKey(k)));
/** Whether the town maps letter a building (`buildingKey`) - every one but those: asked where the crew hall or the docks
 *  are, the answer is the way there, never "let me mark it on your map" - a mark that marks nothing (AUDIT SHIPYARDS
 *  L7-5; scenes/townTalk.js's hint and systems/answerPipeline.js getKeySubjectBuildingHint ask it). Pure. */
export const lettersOnMap = (buildingKey) => !UNLETTERED.has(buildingKey);

/** A place's keeper: townKeeper's draw on the town's map id and the place's salt. Pure.
 *  @param {number} mapId @param {string} place @param {number} regionIndex */
export const portKeeper = (mapId, place, regionIndex) => townKeeper(townSeed(mapId, PORT_PLACES[validPortPlace(place) ?? 'shipyard'].seed), regionIndex);

/**
 * A place's name: the shipyard and the crew hall after their keepers ("Halbrecht's Shipyard", "Voss's Crew Hall"), the
 * lighthouse and the docks after the town ("The Sentinel Light", "Sentinel Docks") - "The Lighthouse", "The Docks" with
 * no town. Pure.
 * @param {string} place @param {{ keeperName?: string|null, townName?: string|null }} [o]
 */
export function portPlaceName(place, { keeperName = '', townName = '' } = {}) {
  const k = validPortPlace(place) ?? 'shipyard';
  const town = String(townName ?? '').trim();
  if (k === 'lighthouse') return town ? `The ${town} Light` : 'The Lighthouse';
  if (k === 'docks') return town ? `${town} Docks` : 'The Docks';
  return namedAfter(keeperName, PORT_PLACES[k].title);
}

/**
 * A PORT TOWN'S PLACES AS ROWS OF ITS TALK DIRECTORY - YARDS-FOUND's shape (systems/talk/talkTopics.js
 * buildBuildingDirectory's: `name`, `buildingType`, `factionId`, `quality`, `position` in the location frame,
 * `buildingKey`), `yard` its place (the Where-is page groups by it, as it does the yards). `places` the host's -
 * `{ kind, x, z, name }` in the location frame (scenes/world.js portPlacesFor: the shipyard, its crew hall, the
 * lighthouse, the docks where the harbour is known); none, or one the law does not know, is no row. Its type is
 * `port:<place>` - never a DFU building type, so no table of Daggerfall's, no regional row and no quest place takes it.
 * Pure; a fresh list.
 * @param {Array<any>|null|undefined} places
 */
export function portDirectoryRows(places) {
  const out = [];
  for (const s of places ?? []) {
    const kind = validPortPlace(s?.kind);
    if (!kind || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
    out.push({
      name: typeof s.name === 'string' && s.name ? s.name : portPlaceName(kind), buildingType: `port:${kind}`, factionId: 0, quality: YARD_QUALITY,
      position: [s.x, 0, s.z], buildingKey: foundBuildingKey(kind), yard: kind,
    });
  }
  return out;
}

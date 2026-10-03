// WD3 (2026-10-01): LAYOUT PINS - A TOWN KEEPS THE LAYOUT A SAVE'S THINGS WERE MADE IN.
//
// Mac, 2026-10-01, handing over Beautiful Villages and Beautiful Cities: "ensure this doesn't conflict or regress
// anything (For example housing customization)". The two mods do not edit Daggerfall's towns, they REPLACE them:
// 7,727 locations get a new block grid and a new building list, and the blocks themselves are rebuilt (only one
// house interior in eight keeps nine tenths of its classic furniture). A building is known to the game by WHERE it
// stands - DFU's building key, (block x << 16) + (block y << 8) + record (systems/talkTopics.js) - so every record a
// save keeps by building key would wake up in another building:
//   - the house you bought (banking's deed) and everything you did to it: the decor placed in its frame, the built-in
//     furniture taken out by name, the chests filled by index, its yard (systems/sceneCache.js, scenes/decorTool.js);
//   - a room rented at an inn (systems/tavern.js), a quest's building and the markers its people stand on
//     (systems/quest/place.js), an item left at a smith (systems/repairService.js), a Recall anchor set indoors.
// DFU itself would let them wake in the wrong building; a port that promised not to regress house customisation
// cannot. So a save's building-keyed records are STAMPED with the layout they were made in - which of these mods were
// serving their town - and a town holding such a record is served in that layout for that save: without a mod that
// was not serving it then, and WITH one that was (a house bought in a Beautiful Village keeps its village if the mod
// is switched off since). Everything else in the world follows the switches as they stand. A town is released the
// moment nothing it holds needs it (the room expires, the quest ends, the house is sold), and next loads as the mods
// would have it.
//
// The door (formats/worldDataReplacement.js) asks `pinAt(locationKey)` for the location it is serving and for the
// blocks laid out in it (WorldDataVariants' last location - the location read right before its blocks, as in DFU).
// This module holds no game state: the hosts hand it the save's records (`layoutRecordsOf`) and the location of a map
// id, and refresh the towns whose answer changed.

import { setLayoutPinOracle, worldDataVendorCarries, locationReplacementFilename, blockReplacementFilename } from '../formats/worldDataReplacement.js';

/** The world-data mods that MOVE BUILDINGS in towns - the only ones a pin speaks for. A mod that adds scenery to a
 *  dungeon or a ship's deck (Aquatic Sprites, Detailed Ships) moves no building a save keeps by key. */
export const LAYOUT_MODS = Object.freeze(['beautiful-villages', 'beautiful-cities']);

/**
 * WD3 (AUDIT WD3 B5): THE VERSIONS EVERY STAMP WAS MADE AGAINST. Two stamps are one layout whatever versions they
 * name (layoutsMatch) - true while each mod ships one version. A pack of another version may move buildings, and every
 * stamped house, room, site and home would name another one with nothing to say so: updating a vendored pack is a
 * layout migration (records stamped with the old version re-keyed, or their towns kept in the old pack), and
 * test/wd3_layoutPins.test.js holds the vendored packs to these versions until one is written.
 */
export const LAYOUT_MOD_VERSIONS = Object.freeze({ 'beautiful-villages': '1.4.2', 'beautiful-cities': '0.5.0' });

/** AUDIT WD3 B6: said when a town a save holds could not be stood in the layout it was left in. */
export const PINS_DROPPED_LINE = 'Some of your places could not be shown as you left them. Switch on Replace Game Artwork, or check your connection, then reload.';

/** The layout of a town no layout mod serves. */
export const CLASSIC_LAYOUT = 'classic';

/** Online, how long the boot waits for the service's homes' towns before it builds the first (world.js), and how many
 *  times it asks again behind the play, each wait one longer. */
export const HOME_LAYOUTS_WAIT_MS = 6000;
export const HOME_LAYOUTS_RETRIES = 4;

let _vendorOn = () => false;            // a layout mod loaded for this game
let _vendorVersion = () => '';          // its version, carried in a stamp
let _keyOfMapId = () => null;           // a town's map id -> its location key
let _keyOfPixel = () => null;           // a map pixel -> the location key of the town on it
let _gridOf = () => null;               // a location key -> the block names its town is laid out from now, or null
let _keyOfTown = () => null;            // (regionIndex, town name) -> its location key (the discovery store's town id)
let _typeOf = () => null;               // a location key -> its MapTable LocationType, or null
let _pins = new Map();                  // locationKey -> { out:Set, in:Set, stamp, why }
let _displaced = () => false;           // ARENA1: a record whose building the port itself took away (world/arenaCity.js)

/** The hosts' half: which layout mods are loaded for the game (the latch) and their versions (the world-data loader,
 *  scenes/modWorldData.js), and where a town is (the world host, which holds the map). Each is kept until replaced. */
export function configureLayoutPins({ vendorOn = null, vendorVersion = null, locationKeyOfMapId = null, locationKeyOfPixel = null, gridOf = null, locationKeyOfTown = null, locationTypeOf = null, recordDisplaced = null } = {}) {
  if (typeof recordDisplaced === 'function') _displaced = recordDisplaced;
  if (typeof locationTypeOf === 'function') _typeOf = locationTypeOf;
  if (typeof locationKeyOfTown === 'function') _keyOfTown = locationKeyOfTown;
  if (typeof vendorOn === 'function') _vendorOn = vendorOn;
  if (typeof vendorVersion === 'function') _vendorVersion = vendorVersion;
  if (typeof locationKeyOfMapId === 'function') _keyOfMapId = locationKeyOfMapId;
  if (typeof locationKeyOfPixel === 'function') _keyOfPixel = locationKeyOfPixel;
  if (typeof gridOf === 'function') _gridOf = gridOf;
}

/**
 * Whether a mod CHANGES a town: it carries the town's location file, or a block its grid names. Beautiful Villages
 * replaces 7,317 villages, hamlets, farms, manors and temples by location and every roadside tavern by its blocks
 * alone; Beautiful Cities the 410 cities; neither touches a dungeon, a graveyard or a poor home. A stamp names only
 * the mods that change its town, so a record made where a mod changes nothing never pins its town to that mod (and
 * never fetches the mod's pack when it is switched off). A town whose grid the host cannot say is changed by every
 * mod that is serving (the safe answer: a pin that changes nothing costs nothing).
 */
export function layoutModTouches(vendor, locationKey) {
  if (locationKey == null || locationKey < 0) return true;
  const regionIndex = locationKey % 100, locationIndex = Math.floor(locationKey / 100);
  if (worldDataVendorCarries(vendor, locationReplacementFilename(regionIndex, locationIndex))) return true;
  const grid = _gridOf(locationKey);
  if (!Array.isArray(grid)) return true;
  return grid.some((name) => typeof name === 'string' && worldDataVendorCarries(vendor, blockReplacementFilename(name)));
}

/** A stamp: the layout mods serving a town, `vendor@version` sorted and joined by '+', or 'classic'. */
export function layoutStampOf(vendors) {
  const list = [...vendors].filter((v) => LAYOUT_MODS.includes(v)).sort().map((v) => `${v}@${_vendorVersion(v) || '?'}`);
  return list.length ? list.join('+') : CLASSIC_LAYOUT;
}
/** The vendors a stamp names. A record written before WD3 carries none and reads as the classic layout - every such
 *  record was made in a classic town, because no layout mod existed to serve it otherwise. */
export function stampVendors(stamp) {
  if (typeof stamp !== 'string' || !stamp || stamp === CLASSIC_LAYOUT) return new Set();
  return new Set(stamp.split('+').map((s) => s.split('@')[0]).filter((v) => LAYOUT_MODS.includes(v)));
}

/**
 * WD3 (AUDIT WD3 G2, Mac: "Fix anything. This needs to be perfect"): THE PORT'S CURATION - a town a mod would leave
 * without what it IS. Beautiful Villages rebuilds TVRNAS00 and TVRNAS06 as houses, no tavern among them (the classic
 * blocks hold three each), and leaves the 274 roadside taverns standing on them (142 and 132, their location files not
 * replaced) with no tavern: no room to rent, no innkeeper, no tavern quest. The mod is kept out of a TAVERN location
 * whose grid names one of them - Daggerfall's own tavern stands, as a pin would stand it, and its records are stamped
 * so; the villages that lay those blocks out among their own are the author's. A save's own pin on the town wins.
 */
export const CURATED_CLASSIC = Object.freeze([
  Object.freeze({ vendor: 'beautiful-villages', locationType: 6, blocks: Object.freeze(['TVRNAS00.RMB', 'TVRNAS06.RMB']), why: 'a tavern with no tavern' }),
]);
/** The mods the curation keeps out of a town, or null. */
let _curating = false;   // a resolver that reads the location through the door asks the door's oracle again: no answer inside
export function curatedOut(locationKey) {
  if (locationKey == null || locationKey < 0 || _curating) return null;
  _curating = true;
  try {
    const type = _typeOf(locationKey);
    if (type == null) return null;
    let out = null;
    for (const c of CURATED_CLASSIC) {
      if (type !== c.locationType) continue;
      const grid = _gridOf(locationKey);
      if (Array.isArray(grid) && grid.some((n) => c.blocks.includes(n))) (out ??= new Set()).add(c.vendor);
    }
    return out;
  } finally { _curating = false; }
}
/** A curated town's standing pin (no save holds it). */
const curatedPin = (locationKey) => {
  const out = curatedOut(locationKey);
  return out ? { out, in: new Set(), stamp: CLASSIC_LAYOUT, why: 'curated' } : null;
};
/** Whether a mod serves a town, the curation aside of any save's pin - what a record is stamped against. */
const servesUnpinned = (v, locationKey) => !!_vendorOn(v) && !(curatedOut(locationKey)?.has(v));

/** The pin on a town, or null - the door's oracle: a save's, else the curation's. */
export const pinAt = (locationKey) => _pins.get(locationKey) ?? curatedPin(locationKey);
setLayoutPinOracle(pinAt);

/** The layout a town is served in NOW - what a record made there now is stamped with. */
export function layoutStampAt(locationKey) {
  const p = locationKey == null ? null : pinAt(locationKey);
  const live = LAYOUT_MODS.filter((v) => (p?.in.has(v)) || (_vendorOn(v) && !p?.out.has(v)));
  return layoutStampOf(live.filter((v) => layoutModTouches(v, locationKey)));
}
/** The layout of the town a map id names, now. A town the host cannot place is no pinned town (a pin is keyed by the
 *  same answer), so it is served as the mods loaded for the game serve every town. */
export const layoutStampOfMapId = (mapId) => layoutStampAt(mapId ? _keyOfMapId(mapId) : null);
/** The layout of the town on a map pixel, now. */
export const layoutStampOfPixel = (x, y) => layoutStampAt(Number.isFinite(x) && Number.isFinite(y) ? _keyOfPixel(x, y) : null);
/** Whether two stamps are one layout - the same layout mods, whatever versions they name. A missing stamp is the
 *  classic layout (stampVendors). */
export function layoutsMatch(a, b) {
  const va = stampVendors(a), vb = stampVendors(b);
  return va.size === vb.size && [...va].every((v) => vb.has(v));
}
/**
 * WD3 (AUDIT WD3 H1/S5): WHETHER A RECORD KEYED BY BUILDING NAMES ITS BUILDING HERE. A record stamped in one layout of
 * its town names a building only in that layout; where its town stands in another all the same (offline, a pack that
 * could not be loaded for it; online, a record of the player's own from before the mods, which no home of the
 * service's pins) its key names another building, or none. A record naming no town, or one the host cannot place,
 * stands as Daggerfall always read it.
 */
export function recordStands(rec) {
  if (!rec?.mapId || layoutLocationKeyOfMapId(rec.mapId) == null) return true;
  // ARENA1: a building the arena took (Daggerfall's cell 4,3, in every layout) is no building at all - a room rented
  // there is honoured at any inn of the city, a ticket at any smith, a quest site chosen again (place.js
  // reseatMovedSite); a house deed is moved before it is ever asked (systems/arenaMove.js)
  if (_displaced(rec)) return false;
  return layoutsMatch(rec.layout, layoutStampOfMapId(rec.mapId));
}
/** The layout of a town by the discovery store's id for it (`<regionIndex>:<name>`, systems/discovery.js), now - or
 *  null for a town the host cannot place, which the store neither stamps nor prunes. */
export function layoutStampOfTown(locationId) {
  const m = /^(\d+):(.+)$/.exec(String(locationId ?? ''));
  const key = m ? _keyOfTown(Number(m[1]), m[2]) : null;
  return key == null ? null : layoutStampAt(key);
}
/** A record's stamp, written as the pins read it back: the classic layout is NO field (a record from before WD3 carries
 *  none, and is classic), so a game without the town mods saves exactly what it saved before them. Answers the record. */
export function stampLayout(rec, stamp) {
  if (!rec || typeof rec !== 'object') return rec;
  if (typeof stamp === 'string' && stamp && stamp !== CLASSIC_LAYOUT) rec.layout = stamp;
  else delete rec.layout;
  return rec;
}
/** The location key of the town a map id names, or null - the hosts' resolver, shared. */
export const layoutLocationKeyOfMapId = (mapId) => (mapId ? _keyOfMapId(mapId) ?? null : null);

/** How strongly a kind of record holds its town: the house outranks the rest (a quest site made in a town a house
 *  pinned is made in the house's layout anyway - the strongest record's stamp is the town's). */
export const RECORD_WEIGHT = Object.freeze({ house: 5, room: 4, quest: 3, questor: 3, inside: 2, anchor: 2, repair: 1 });

/**
 * The pins a save's records ask for. `records`: [{ locationKey, stamp, kind }] - a record whose town is unknown
 * (`locationKey` null) asks nothing. A town whose strongest record's stamp is the layout it would be served in
 * anyway needs no pin.
 * @returns {Map<number, {out:Set<string>, in:Set<string>, stamp:string, why:string}>}
 */
export function pinsFrom(records) {
  const best = new Map();
  for (const r of records ?? []) {
    if (r?.locationKey == null || r.locationKey < 0) continue;
    const w = RECORD_WEIGHT[r.kind] ?? 0;
    const b = best.get(r.locationKey);
    if (!b || w > b.w) best.set(r.locationKey, { w, r });
  }
  const pins = new Map();
  for (const [key, { r }] of best) {
    const want = stampVendors(r.stamp);
    const out = new Set(), inn = new Set();
    for (const v of LAYOUT_MODS) {
      const on = servesUnpinned(v, key);   // AUDIT WD3 G2: a curated town's baseline is Daggerfall's own
      if (on && !want.has(v) && layoutModTouches(v, key)) out.add(v);   // a mod that changes nothing here needs no pin
      if (!on && want.has(v)) inn.add(v);   // the stamp names it only where it changed the town
    }
    if (out.size || inn.size) pins.set(key, { out, in: inn, stamp: typeof r.stamp === 'string' && r.stamp ? r.stamp : CLASSIC_LAYOUT, why: r.kind });
  }
  return pins;
}

/** Install a save's pins. Answers the towns whose layout changed (pinned, released, or pinned otherwise) - the
 *  hosts read those locations again and rebuild them if they stand. */
export function setLayoutPins(pins) {
  const next = pins instanceof Map ? pins : new Map();
  const changed = new Set();
  const same = (a, b) => !!a && !!b && a.out.size === b.out.size && a.in.size === b.in.size && [...a.out].every((v) => b.out.has(v)) && [...a.in].every((v) => b.in.has(v));
  for (const [k, p] of next) if (!same(p, _pins.get(k))) changed.add(k);
  for (const k of _pins.keys()) if (!next.has(k)) changed.add(k);
  _pins = next;
  return changed;
}

/** The layout mods some pin lets in though they are not loaded for the game - their packs must be on the door. */
export function vendorsPinnedIn() {
  const out = new Set();
  for (const p of _pins.values()) for (const v of p.in) out.add(v);
  return out;
}

/** Every pin, for the save's debug line and the tests. */
export const layoutPins = () => new Map(_pins);

/**
 * A save's building-keyed records, as the pins read them. Pure: the hosts hand in what the save holds and how to find
 * a record's town (`locationKeyOfMapId(mapId)`, `locationKeyOfPixel(x, y)`).
 *   - houses: banking's per-region deeds { mapId, buildingKey, layout }
 *   - rooms: the tavern's rented rooms { mapId, buildingKey, layout }
 *   - sites: the active quests' building sites (Place.siteDetails) { mapId, buildingKey, layout }
 *   - questors: the active quests' questors met in a building (Person.questorData { mapID, buildingKey, layout })
 *   - repairs: items at a smith (item.repairData { buildingKey, mapId, layout }) - a ticket from before WD3 names no
 *     town and holds none
 *   - anchor: a Recall anchor set inside a building { pixel, insideBuilding, layout }
 *   - inside: the save itself, made inside a building { pixel, layout } - the load re-enters that building by its door
 *     (worldModes.js restoreInterior), and a door of the same block in another layout is another building
 * The resolvers default to the hosts' (configureLayoutPins).
 */
export function layoutRecordsOf({ houses = [], rooms = [], sites = [], questors = [], repairs = [], anchor = null, inside = null } = {}, { locationKeyOfMapId = _keyOfMapId, locationKeyOfPixel = _keyOfPixel } = {}) {
  const out = [];
  for (const h of houses ?? []) if (h && h.buildingKey > 0 && h.mapId) out.push({ locationKey: locationKeyOfMapId(h.mapId), stamp: h.layout, kind: 'house' });
  for (const r of rooms ?? []) if (r && r.buildingKey > 0 && r.mapId) out.push({ locationKey: locationKeyOfMapId(r.mapId), stamp: r.layout, kind: 'room' });
  for (const s of sites ?? []) if (s && s.buildingKey > 0 && s.mapId) out.push({ locationKey: locationKeyOfMapId(s.mapId), stamp: s.layout, kind: 'quest' });
  for (const q of questors ?? []) if (q && q.buildingKey > 0 && q.mapID) out.push({ locationKey: locationKeyOfMapId(q.mapID), stamp: q.layout, kind: 'questor' });
  for (const d of repairs ?? []) if (d && d.buildingKey > 0 && d.mapId) out.push({ locationKey: locationKeyOfMapId(d.mapId), stamp: d.layout, kind: 'repair' });
  if (anchor?.insideBuilding && anchor.pixel) out.push({ locationKey: locationKeyOfPixel(anchor.pixel.x, anchor.pixel.y), stamp: anchor.layout, kind: 'anchor' });
  if (inside?.pixel) out.push({ locationKey: locationKeyOfPixel(inside.pixel.x, inside.pixel.y), stamp: inside.layout, kind: 'inside' });
  return out;
}

/** Tests: back to no pins, no mods. */
export function _resetLayoutPins() {
  _pins = new Map();
  _typeOf = () => null;
  _vendorOn = () => false;
  _vendorVersion = () => '';
  _keyOfMapId = () => null;
  _keyOfPixel = () => null;
  _gridOf = () => null;
  _keyOfTown = () => null;
  _displaced = () => false;
}

// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT RELEASE R2-5 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-5; bible/06-Systems/Quest-Arc.md
// "A province's region"; the owner, for the release that carries TESA: "expand our world seamlessly. All systems should be
// integrated precisely") - A PROVINCE'S REGION FOR THE QUEST LAYER: where a quest giver past the Bay sends the player.
//
// DFU draws a remote site from the questor's region's MAPS.BSA rows (Place.SelectRemoteTownSite :790-870,
// SelectRemoteDungeonSite :880-935, SelectRemoteLocationExteriorSite :940-985 - systems/quest/place.js ports each whole).
// A province's region (62..70, WW-R) has no MAPS.BSA rows, so every quest that wanted another town or a dungeon threw at
// its parse, and DFU's own catch answered: a guild "has no work", a Daedra "has no task for you in this region". The quest
// layer's maps (scenes/questWorld.js) answer a province's region from here - a DFRegion of the province's places as the
// world's build stands them:
//  - ITS TOWNS: the theatre's LISTED places on the world's registry (world/worldWide/worldPlaces.js inTheatre;
//    world/pastBayRows.js: the capitals' slices, the model's cities, towns and villages that stand a location) whose
//    pixel the politic map reads as this region (the region the place's clone carries), in the registry's order - the
//    same on every client. R2-5e: and the countryside's places nearest the questor (countryNear, TESA7: a pixel's roll and no list) - PROVINCE_COUNTRY_COUNT within PROVINCE_COUNTRY_REACH.
//  - ITS DUNGEONS: the province's lairs (world/tamrielDungeons.js, TESA8) nearest the questor - PROVINCE_LAIR_COUNT within
//    PROVINCE_LAIR_REACH, on the pixels the build stands them (no capital, Arena place or countryside place first). A lair
//    is a pixel's roll and a province holds thousands (some 250 within a Bay region's span, each read a few milliseconds),
//    so the table holds the nearest, reading at most PROVINCE_LAIR_ROLLS cells nearest first (each read once, kept).
//  - A CAPITAL OF MANY SLICES IS A DESTINATION SLICE BY SLICE (the owner, 2026-10-26: "Take care of exclusions and gaps";
//    R2-5b): the Imperial City's 625 slices (TESA11, IC-GRAND) are 625 locations under fourteen names, which DFU's name
//    lookup (DFRegion.MapNameLookup, a name to one index) reads as fourteen. Each slice is its row under a QUEST NAME of
//    its own (capitalQuestNames: its district's name, and where the district spans several slices ", quarter N" - N its
//    rank among them by slice index), the same on every client and in every session, so a site in one slice is never read
//    as another's. The quest layer sees every slice location under that name (questView: the location shallow-copied, its
//    name the quest name; questWorld.js currentLocation), so a site drawn in one, local or remote, keeps it. Left out
//    by the plan alone (isUnsitedSlice), the same on every client whatever has been built: the centre slice (the White-Gold
//    Tower's grounds, no building stands there; its castle's halls are the capital's own, WW7-4), a shore capital's harbour
//    sea (capitalDims `sea`), and the slices the plan names after none of its districts (PLAN_FILL_NAMES: its isle, lake and
//    shore - 367 slices, none standing a building). Of the 257 left, 96 stand none today (the palace grounds, the prison,
//    a district's edge - measured on the freeware at IC-GRAND's merge): each a row whose dart misses, as DFU's dart misses a
//    town without the building.
// Each row is DFU's MapTable shape (mapId, locationType, dungeonType, the longitude and latitude its pixel reads back -
// formats/mapsFile.js mapPixelToLongitudeLatitude), so NEARBY-QUESTS' reach measures it. getLocation(r, i) is the place's
// built location (scenes/tamrielPlacesHost.js standQuestSite: the build's own order and the same object, its building
// keys and its dungeon's blocks the ones the player meets) or null where the pixel stands another place now - so DFU's
// draw runs over it unchanged: the building types a town must have (the directory's pre-check, then the block walk), the
// dungeon types, the markers, the smaller-dungeon law (the quest layer's sizing over getLocation).
//
// A NAME THE TABLE DOES NOT HOLD - a lair drawn from another pixel, a session after the draw, a party member's copy of
// the quest - is found by the site that names it: a quest's site past the Bay carries its pixel (START3 `worldPixel`,
// quest/place.js siteWorldPixel), and the place standing there under that name and map id joins the table. So a site
// resolves after a save's load and a relog as at its draw.
//
// Not a DFU member: DFU has no provinces. Ledger A (R2-5).
// ═══════════════════════════════════════════════════════════════════
import { REGION_NAMES, isProvinceRegion, theatreOfRegion } from '../../formats/mapsTables.js';
import { mapPixelToLongitudeLatitude, longitudeLatitudeToMapPixel, DUNGEON_TYPES } from '../../formats/mapsFile.js';
import {
  CAPITALS,
  capitalOnPixel,
  capitalSliceName,
  capitalDims,
  capitalCentre,
  capitalSpanPixels,
} from '../../world/tamrielCapitals.js';

/** R2-5e: how far, map pixels (the travel reckoning's longest axis), a province's countryside places are drawn from the
 *  questor - the reach NEARBY-QUESTS gives at level 4 twice over (systems/quest/questReach.js), a day or two on foot. */
export const PROVINCE_COUNTRY_REACH = 24;
/** R2-5e: how many countryside places a province's table holds - the nearest to the questor within the reach. */
export const PROVINCE_COUNTRY_COUNT = 16;
/** R2-5e: how many pixels that may stand one a table reads whole (each its plateau, some 1 ms), kept or not: the bound by
 *  count the first table at a pixel holds to, with the lairs', under the 100 ms a task may take. */
export const PROVINCE_COUNTRY_ROLLS = 32;
/** How far, map pixels (the travel reckoning's longest axis), a province's lairs are drawn from the questor: a Bay region's
 *  span (systems/quest/questReach.js - level 15's reach, "about a region"). */
export const PROVINCE_LAIR_REACH = 66;
/** How many lairs a province's table holds - the nearest to the questor within the reach: NEARBY-QUESTS draws among the
 *  nearest few. R2-5e: 16 then, 12 beside the countryside's, the first table at a pixel under the 100 ms a task may take. */
export const PROVINCE_LAIR_COUNT = 12;
/** How many lair cells a table reads, kept or not (a cell never read is a roll - its plateau and its plan, some 4 ms): the
 *  work a quest offer past the Bay may add as one task, bounded by count (the coordinator, 2026-10-26); R2-5e: 40 then, 16
 *  beside the countryside's. */
export const PROVINCE_LAIR_ROLLS = 16;

/** R2-5b: the names the Imperial City's plan gives a slice that holds none of its districts (world/imperialCity.js
 *  imperialSliceName's own last arm - its isle, its lake, its shore): no building of the city stands in one (measured on the
 *  freeware at IC-GRAND's merge: 367 slices, none). */
export const PLAN_FILL_NAMES = Object.freeze(['City Isle', 'Lake Rumare', 'Rumare Shore']);
/** R2-5b: is a pixel a slice of a capital of many that no site may stand in - its centre (the Imperial City's White-Gold
 *  Tower: no building stands there), its harbour's sea (capitalDims `sea`: a shore capital's water), or a slice its plan
 *  names after none of its districts (PLAN_FILL_NAMES). A law of the plan alone: the same on every client, nothing built. */
export function isUnsitedSlice(/** @type {number} */ px, /** @type {number} */ py) {
  const at = capitalOnPixel(px, py);
  if (!at || !manySlices(at.cap)) return false;
  return (
    at.s === capitalCentre(at.cap) ||
    (capitalDims(at.cap).sea ?? []).includes(at.s) ||
    PLAN_FILL_NAMES.includes(capitalSliceName(at.cap, at.s))
  );
}
/** Is a capital laid over several pixels (TESA11: the Imperial City's square; a shore capital's land and harbour). */
const manySlices = (/** @type {any} */ cap) => {
  const D = capitalDims(cap);
  return D.w * D.h > 1;
};
/** @type {Map<number, Map<number, string>>} */
const _questNames = new Map();
/** R2-5b: A CAPITAL'S SLICES' QUEST NAMES - slice index to name: its district's name (capitalSliceName), and where the
 *  district spans several slices ", quarter N", N its rank among them by slice index. A key, the same in every language
 *  and session (a site's name is how it is found again); shown through getLocalizedLocationName as every place's name.
 *  @param {number} k */
export function capitalQuestNames(k) {
  let names = _questNames.get(k);
  if (names) return names;
  const cap = CAPITALS[k],
    D = capitalDims(cap);
  const of = [],
    count = new Map();
  for (let s = 0; s < D.w * D.h; s++) {
    const d = capitalSliceName(cap, s);
    of.push(d);
    count.set(d, (count.get(d) ?? 0) + 1);
  }
  const rank = new Map();
  names = new Map();
  of.forEach((d, s) => {
    const r = (rank.get(d) ?? 0) + 1;
    rank.set(d, r);
    names.set(s, count.get(d) > 1 ? `${d}, quarter ${r}` : d);
  });
  _questNames.set(k, names);
  return names;
}
/** R2-5b: the quest name of the capital slice a pixel stands, or null (no capital of many slices there). */
export function sliceQuestName(/** @type {number} */ px, /** @type {number} */ py) {
  const at = capitalOnPixel(px, py);
  return at && manySlices(at.cap) ? (capitalQuestNames(at.k).get(at.s) ?? null) : null;
}
/** @type {WeakMap<object, any>} */
const _views = new WeakMap();
/** R2-5b: A LOCATION AS THE QUEST LAYER SEES IT - a capital slice under its quest name (a shallow copy, kept per location:
 *  its record, blocks and buildings the build's own), any other location itself. @param {any} loc */
export function questView(loc) {
  const t = loc?.capital ? loc.mapTableData : null;
  if (!t) return loc;
  const p = longitudeLatitudeToMapPixel(t.longitude, t.latitude);
  const name = sliceQuestName(p.x, p.y);
  if (!name || name === loc.name) return loc;
  let v = _views.get(loc);
  if (v?.name !== name) {
    v = { ...loc, name };
    _views.set(loc, v);
  }
  return v;
}

/**
 * R2-5c: A CAPITAL IS ONE TOWN (WW7-11 capitalStreet; the owner: "Take care of exclusions and gaps") - the other slices of
 * the capital a location is a slice of, nearest first (the travel reckoning's longest axis from it, a tie by slice index -
 * the same on every client), each as the quest layer sees it (questView), stood only as a search reaches it (a generator);
 * none past the slices no site may stand in (isUnsitedSlice), none for any other location. A local site the questor's own
 * slice cannot give is the city's (quest/place.js _citySites).
 * R2-5f: with `admits`, a slice whose sites index (`indexAt` - quest/place.js townSitesIndex, kept a slice) cannot give
 * the search's kind is passed over unstood: a search stands the slices it picks, no more (`picked` counts them).
 * @param {any} loc @param {(px: number, py: number) => any} standAt
 * @param {((index: readonly any[]) => boolean) | null} [admits] @param {(px: number, py: number) => readonly any[]} [indexAt]
 * @param {{ picked: number }} [count]
 */
export function* capitalSlicesNear(loc, standAt, admits = null, indexAt = () => [], count = { picked: 0 }) {
  const t = loc?.capital ? loc.mapTableData : null;
  if (!t) return;
  const p = longitudeLatitudeToMapPixel(t.longitude, t.latitude);
  const at = capitalOnPixel(p.x, p.y);
  if (!at || !manySlices(at.cap)) return;
  const others = [];
  for (const q of capitalSpanPixels(at.k)) {
    const s = capitalOnPixel(q.x, q.y)?.s;
    if (s == null || s === at.s || isUnsitedSlice(q.x, q.y)) continue;
    others.push({ x: q.x, y: q.y, s, d: Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) });
  }
  others.sort((a, b) => a.d - b.d || a.s - b.s);
  for (const q of others) {
    if (admits && !admits(indexAt(q.x, q.y))) continue;
    count.picked++;
    const l = standAt(q.x, q.y);
    if (l?.loaded && l.capital) yield questView(l);
  }
}

/**
 * A MapTable row for a place past the Bay. BAY-LEFT-B: with its location's KEY (`tableKey` - DFU's MapTable.Key, its
 * buildings' directory, world/locationKey.js; the talk's regional "Where is" counts a region's rows by it,
 * answerPipeline.js getLocationWithRegionalBuilding - 0, none, where it is not known), and a place with no dungeon
 * (a registry's town - its `hasDungeon` false - or a row that names no dungeon type) NoDungeon, as MAPS.BSA's towns are
 * (255): a town's row read as type 0, a crypt, to the Mages Guild's scrying (systems/loot/lootScry.js nearestHidden).
 * @param {{ mapId: number, name: string, px: number, py: number, type: number, dungeonType?: number, hasDungeon?: boolean, tableKey?: ?number }} p
 */
export function provinceRow(p) {
  const ll = mapPixelToLongitudeLatitude(p.px, p.py);
  const dungeonType = p.hasDungeon === false ? DUNGEON_TYPES.NoDungeon : (p.dungeonType ?? DUNGEON_TYPES.NoDungeon);
  return Object.freeze({
    mapId: p.mapId >>> 0,
    name: p.name,
    px: p.px,
    py: p.py,
    locationType: p.type,
    dungeonType,
    key: (p.tableKey ?? 0) >>> 0,
    longitude: ll.x,
    latitude: ll.y,
    discovered: false,
  });
}

/**
 * The quest layer's provinces.
 * @param {{
 *   worldPlaces: ?{ inTheatre: (t: number) => readonly any[], generation: () => number },
 *   regionAt: (px: number, py: number) => number,
 *   standAt: (px: number, py: number) => any,
 *   lairsNear?: (px: number, py: number, reach: number, count?: number, rolls?: number) => Array<{ mapId: number, name: string, px: number, py: number, type: number, dungeonType: number }>,
 *   countryNear?: (px: number, py: number, reach: number, count?: number, rolls?: number) => Array<{ mapId: number, name: string, px: number, py: number, type: number }>,
 *   origin?: () => ?{ x: number, y: number },
 *   heldSites?: () => Iterable<any>,
 *   refresh?: () => void,
 *   sliceAt?: (px: number, py: number) => any,
 *   sitesIndexOf?: (loc: any) => readonly any[],
 *   tableKeyAt?: (px: number, py: number) => ?number,
 * }} deps `regionAt` the politic map's region (maps.getRegionIndexAt); `standAt` the location the build stands on a pixel
 *   past the Bay, or null; `lairsNear` the lairs the build stands within a reach of a pixel; `origin` the questor's pixel
 *   (the quest layer's playerPixel); `heldSites` every quest's site details (the machine's); `refresh` the places'
 *   registry brought up to date (tamrielPlacesHost.js registerTamrielPlaces); `sliceAt` a capital's slice on a pixel laid
 *   out before it stands (tamrielPlacesHost.js capitalSliceAt), `sitesIndexOf` its sites by kind (quest/place.js
 *   townSitesIndex) - AUDIT RELEASE R2-5f; `tableKeyAt` a place's MapTable key as its location carries it, read without
 *   standing it (tamrielPlacesHost.js tableKeyAt, BAY-LEFT-B), or null
 */
export function createQuestProvinceSites({
  worldPlaces,
  regionAt,
  standAt,
  lairsNear = () => [],
  countryNear = () => [],
  origin = () => null,
  heldSites = () => [],
  refresh = () => {},
  sliceAt = () => null,
  sitesIndexOf = () => [],
  tableKeyAt = () => null,
}) {
  /** R2-5f: A CAPITAL SLICE'S SITES BY KIND, kept a slice (by its pixel) for the session - quest/place.js townSitesIndex over
   *  the slice as the build stands it, read off its clone where it has not stood (`sliceAt`, scenes/tamrielPlacesHost.js
   *  capitalSliceAt): the law no quest or owner changes, the same on every client. @type {Map<string, readonly any[]>} */
  const sliceIndexes = new Map();
  const count = { picked: 0 };
  /** @param {number} px @param {number} py */
  const sliceIndexAt = (px, py) => {
    const k = `${px},${py}`;
    let index = sliceIndexes.get(k);
    if (!index) {
      const loc = sliceAt(px, py);
      index = loc ? sitesIndexOf(questView(loc)) : Object.freeze([]);
      sliceIndexes.set(k, index);
    }
    return index;
  };
  /** Is row `row` a slice of a capital of many. @param {any} row */
  const sliceRow = (row) => !!row && sliceQuestName(row.px, row.py) != null;
  /** @type {Map<number, { key: string, region: any }>} */
  const tables = new Map();
  /** the rows a name lookup found by a site's pixel, by region: name -> row (kept across tables) */
  /** @type {Map<number, Map<string, any>>} */
  const found = new Map();
  const keyOf = (/** @type {any} */ o) => `${worldPlaces?.generation?.() ?? 0}|${o ? `${o.x},${o.y}` : '-'}`;
  /** A row joined to a table: its index. @param {any} region @param {any} row */
  const join = (region, row) => {
    const i = region.mapTable.length;
    region.mapTable.push(row);
    region.mapNames.push(row.name);
    region.locationCount = region.mapTable.length;
    if (!region.mapNameLookup.has(row.name)) region.mapNameLookup.set(row.name, i);
    if (!region.mapIdLookup.has(row.mapId)) region.mapIdLookup.set(row.mapId, i);
    return i;
  };
  /** @param {number} r @param {any[]} rows */
  const regionOf = (r, rows) => {
    // the name lookup's miss is the held sites' (findBySite): every reader of a site by its name - quest/place.js siteTown
    // and fitSiteToBuild, questRepair.js's re-lay, the travel clock - finds it as the draw left it
    const region = {
      name: REGION_NAMES[r],
      provinceRegion: true,
      locationCount: 0,
      mapNames: [],
      mapTable: [],
      mapNameLookup: new HeldNames((name) => findBySite(r, name)),
      mapIdLookup: new Map(),
    };
    for (const row of rows) join(region, row);
    return region;
  };
  /** The province's table for the questor where it stands now. @param {number} r */
  function getRegion(r) {
    if (!isProvinceRegion(r) || !worldPlaces) return null;
    refresh();
    const o = origin();
    const key = keyOf(o);
    const had = tables.get(r);
    if (had?.key === key) return had.region;
    const rows = [],
      ids = new Set(),
      names = new Set();
    // R2-5e: a name once a table (the listed towns first) - a site's name names one place
    const add = (/** @type {any} */ row) => {
      if (!ids.has(row.mapId) && !names.has(row.name)) {
        ids.add(row.mapId);
        names.add(row.name);
        rows.push(row);
      }
    };
    for (const p of worldPlaces.inTheatre(theatreOfRegion(r))) {
      if (regionAt(p.px, p.py) !== r || isUnsitedSlice(p.px, p.py)) continue;
      add(provinceRow({ ...p, name: sliceQuestName(p.px, p.py) ?? p.name, tableKey: tableKeyAt(p.px, p.py) })); // R2-5b: a slice under its quest name; BAY-LEFT-B: its key
    }
    if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
      // R2-5e: the countryside's places nearest the questor, after the listed towns - a courier's town near, as on the Bay
      for (const c of countryNear(o.x, o.y, PROVINCE_COUNTRY_REACH, PROVINCE_COUNTRY_COUNT, PROVINCE_COUNTRY_ROLLS))
        if (regionAt(c.px, c.py) === r) add(provinceRow({ ...c, tableKey: tableKeyAt(c.px, c.py) }));
      for (const l of lairsNear(o.x, o.y, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS))
        if (regionAt(l.px, l.py) === r) add(provinceRow({ ...l, tableKey: tableKeyAt(l.px, l.py) }));
    }
    for (const row of found.get(r)?.values() ?? []) add(row);
    const region = regionOf(r, rows);
    tables.set(r, { key, region });
    return region;
  }
  /** The table last handed out for `r` (a draw reads its rows by index between its two calls), else a new one. */
  const tableOf = (/** @type {number} */ r) => tables.get(r)?.region ?? getRegion(r);
  /** The place of row `i` of the province's table, as the build stands it - null where its pixel stands another. */
  function getLocation(/** @type {number} */ r, /** @type {number} */ i) {
    const row = isProvinceRegion(r) ? tableOf(r)?.mapTable?.[i] : null;
    if (!row) return null;
    const loc = standAt(row.px, row.py);
    return loc && loc.mapTableData?.mapId >>> 0 === row.mapId ? questView(loc) : null; // R2-5b: a slice under its quest name
  }
  /** The site a quest holds of this name in this region, carried by its pixel, joined to the table (and to every table
   *  of the region made after); its index, or undefined. */
  function findBySite(/** @type {number} */ r, /** @type {string} */ name) {
    for (const sd of heldSites()) {
      const p = sd?.worldPixel;
      if (sd?.regionIndex !== r || sd.locationName !== name || !p) continue;
      const loc = questView(standAt(p.x, p.y));
      if (!loc || loc.name !== name || loc.mapTableData?.mapId >>> 0 !== sd.mapId >>> 0) continue;
      const row = provinceRow({
        mapId: sd.mapId,
        name,
        px: p.x,
        py: p.y,
        type: loc.mapTableData?.locationType ?? 0,
        dungeonType: loc.mapTableData?.dungeonType ?? 0,
        tableKey: loc.mapTableData?.key,
      });
      if (!found.has(r)) found.set(r, new Map());
      /** @type {Map<string, any>} */ (found.get(r)).set(name, row);
      const table = tables.get(r)?.region;
      return table ? join(table, row) : getRegion(r)?.mapNameLookup.get(name);
    }
    return undefined;
  }
  /** A province's region's place by name: the table's, else a held site's (the lookup's miss); its index, or -1. */
  const indexOfName = (/** @type {number} */ r, /** @type {string} */ name) =>
    tableOf(r)?.mapNameLookup.get(name) ?? -1;
  return {
    getRegion,
    getLocation,
    indexOfName,
    /** R2-5c: the capital's other slices nearest a slice location (capitalSlicesNear over the build's places). @param {any} loc */
    capitalSlicesNear: (/** @type {any} */ loc, /** @type {any} */ admits = null) =>
      capitalSlicesNear(loc, standAt, admits, sliceIndexAt, count),
    /** R2-5f: a capital slice's sites by kind (kept), by its pixel. */
    sliceIndexAt,
    /** R2-5f: whether row `i` of a province's table is a capital slice whose sites index `gives` refuses - a dart's miss
     *  known before the slice stands; false for every other row (a town, a lair, the countryside: its own walk decides). */
    siteIndexRefuses(
      /** @type {number} */ r,
      /** @type {number} */ i,
      /** @type {(index: readonly any[]) => boolean} */ gives,
    ) {
      const row = isProvinceRegion(r) ? tableOf(r)?.mapTable?.[i] : null;
      return sliceRow(row) && !gives(sliceIndexAt(row.px, row.py));
    },
    /** R2-5f: how many capital slices a search has picked to stand (the count's pin). */
    picked: () => count.picked,
    /** MapsFile.GetLocationByName for a province's region: the place, or null (any other region: null). */
    locationByName(/** @type {string} */ regionName, /** @type {string} */ locationName) {
      const r = REGION_NAMES.indexOf(regionName);
      if (!isProvinceRegion(r)) return null;
      const i = indexOfName(r, locationName);
      return i < 0 ? null : getLocation(r, i);
    },
    /** PlayerGPS's location index in the province's table: where the player stands, its row; -1 for none (a draw sets
     *  the questor's own place aside by it - SelectRemoteTownSite's playerLocationIndex). */
    locationIndexOf(/** @type {number} */ r, /** @type {any} */ loc) {
      const id = loc?.mapTableData?.mapId;
      if (!isProvinceRegion(r) || id == null) return -1;
      return tableOf(r)?.mapIdLookup.get(id >>> 0) ?? -1;
    },
  };
}

/** A province's name lookup (DFRegion.MapNameLookup): its rows' names, and a name it misses asked of `miss` (the held
 *  sites) - `has` the rows' alone. */
class HeldNames extends Map {
  /** @param {(name: string) => number|undefined} miss */
  constructor(miss) {
    super();
    this.miss = miss;
  }
  /** @param {string} name */
  get(name) {
    return super.has(name) ? super.get(name) : this.miss(name);
  }
}

/** Every site details a quest machine's quests hold (their Places'). @param {any} machine */
export function* machineSites(machine) {
  for (const q of machine?.quests?.values?.() ?? [])
    for (const res of q?.resources?.values?.() ?? []) if (res?.isPlace && res.siteDetails) yield res.siteDetails;
}

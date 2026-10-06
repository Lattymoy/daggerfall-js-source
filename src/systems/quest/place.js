// THE QUEST PLACE (Q1 declaration + Q3-i site binding) - Place.cs.
// Scope is local|remote|permanent|randompermanent (the last picks one
// site from a comma list - UnityEngine.Random -> injectable roll,
// Ledger A) and p1/p2/p3 come from the Quests-Places table
// (CustomParseInt: 0x-prefixed values parse hex).
//
// Q3-i ships SITE RESOLUTION - the SetupLocalSite / SetupRemoteSite /
// SetupFixedLocation selection laws whole, the quest-marker
// enumeration over the port's own block shapes (editor flat archive
// 199, records 11/18 - the two records the world layer read but
// never named), the marker selection/assignment law, and the
// player-at-place checks - all over quest.hooks.world, the world
// seam a running host wires from its MapsFile/BlocksFile instances
// and player state (the contract is documented at machine.js's dep
// block). A HEADLESS parse (no world seam - the corpus gate's
// charter) leaves `sitePending` true - a FLAG, not a noise (AUDIT-QUEST
// F1); the bridge's construction report is what speaks. Exactly the
// travelTimePending precedent; with a world present the resolution
// runs AT PARSE and throws exactly where DFU throws. Selection draws
// ride the quest's injectable roll (Ledger A; DFU uses
// UnityEngine.Random throughout).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { intParse } from './parseUtils.js';   // AUDIT 68 S30-tryparse-dup: the quest layer's one int.Parse
import { placesTable } from './tables.js';
import { mergeNamedBuildings, makeBuildingKey, blockBuildingCount } from '../talkTopics.js';
import { generateBuildingName } from '../../world/buildingNames.js';
import { surname, firstName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { RDB_RESOURCE_TYPES } from '../../formats/blocksFile.js';
import { stampLayout, layoutStampOfMapId, recordStands, recordHeldBack, CLASSIC_LAYOUT } from '../layoutPins.js';   // WD3: a building site keeps its town's layout
import { curatedMarkerSpot, curateSiteMarkers } from './markerCuration.js';   // FIELD BUGS 2026-10-04d QUEST-MARKERS: the town packs' unreachable markers, on the floor
import { questReachOn, questReachPixels, nearbyIndices, indicesWithin, mapTablePixel, mapPixelDistance } from './questReach.js';   // NEARBY-QUESTS
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';
import { stringHash } from '../../formats/netRuntime.js';   // QUEST-AUDIT II SHARED-SEAT: a shared copy's re-seat, seeded (a leaf)
import { getSeed, setSeed } from '../../formats/dfRandom.js';   // AUDIT QA2: a shared re-seat's residence name, seeded and the state put back
import { seededFirst } from '../wind.js';   // QUEST-AUDIT II SHARED-SEAT: the port's one seeded die (imports nothing)
import { boundWorldDataBlocks } from '../../formats/worldDataReplacement.js';   // AUDIT QA2: Daggerfall's own blocks (BLOCKS.BSA, past the door) - what the mods took away

export const Scopes = Object.freeze({ None: 'none', Local: 'local', Remote: 'remote', Fixed: 'fixed' });

/** SiteTypes (DaggerfallUnityEnums.cs:611) - numeric for save parity. */
export const SITE_TYPES = Object.freeze({ None: 0, Town: 1, Dungeon: 2, Building: 3 });

/** MarkerTypes (DaggerfallUnityEnums.cs:624) - the enum VALUES are the
 *  editor flat records themselves. */
export const MARKER_TYPES = Object.freeze({ None: -1, QuestSpawn: 11, QuestItem: 18 });

/** MarkerPreference (DaggerfallUnityEnums.cs:634). */
export const MARKER_PREFERENCE = Object.freeze({ Default: 0, UseQuestMarker: 1, AnyMarker: 2 });

// Place.cs:36-38 - the editor flat archive and the two quest records.
const EDITOR_FLAT_ARCHIVE = 199;
const SPAWN_MARKER_RECORD = 11;
const ITEM_MARKER_RECORD = 18;

/** FIELD BUGS 29h (BOUNTY-LAIR): WHERE DFU STANDS A DUNGEON QUEST'S FOE - every quest spawn marker (199.11, the records
 *  EnumerateDungeonQuestMarkers :1522 collects) of a laid-out dungeon, in its scene's frame: the marker's place under its
 *  block's origin, as markerScenePosition puts a mounted one and collectDungeonEnemies an enemy's. `blocks` is the
 *  dungeon context's own (world/rdbLayout.js markers - archive-199 flats carry no archive, a treasure flat carries its
 *  216). */
export function dungeonQuestSpawnSpots(blocks) {
  const spots = [];
  for (const b of blocks ?? []) {
    for (const m of b?.layout?.markers ?? []) {
      if ((m.archive ?? EDITOR_FLAT_ARCHIVE) !== EDITOR_FLAT_ARCHIVE || m.record !== SPAWN_MARKER_RECORD) continue;
      spots.push([m.x + b.originX, m.y, m.z + b.originZ]);
    }
  }
  return spots;
}

// Place.cs:621-623 - the wildcard building-type sets (exported so the
// gate can pin them as literals).
export const VALID_BUILDING_TYPES = Object.freeze([0, 2, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20]);
export const VALID_HOUSE_TYPES = Object.freeze([17, 18, 19, 20]);
export const VALID_SHOP_TYPES = Object.freeze([0, 2, 5, 6, 7, 8, 9, 12, 13]);   // not including bank and library

// DFLocation.BuildingTypes sentinels (DFLocation.cs:138-140) and the
// members the laws name (values shared with DFRegion.BuildingTypes).
const BT_GUILDHALL = 11, BT_HOUSE1 = 17, BT_HOUSE4 = 20, BT_HOUSE6 = 22;
export const BT_ANY_SHOP = 0xfffd, BT_ANY_HOUSE = 0xfffe, BT_ALL_VALID = 0xffff;

// FactionFile.FactionIDs (API/FactionFile.cs:91,135) - random quests
// never use these guilds' buildings.
const THIEVES_GUILD_FACTION = 42;
const DARK_BROTHERHOOD_FACTION = 108;

// DFRegion.LocationTypes members IsDungeonType names (DFRegion.cs:66).
const LT_DUNGEON_LABYRINTH = 4, LT_DUNGEON_KEEP = 7, LT_DUNGEON_RUIN = 10, LT_GRAVEYARD = 12;

const GLOBAL_SCALE = 0.025;   // MeshReader.GlobalScale

/** Internal_Strings "theNamedResidence" (en id 52). */
export const THE_NAMED_RESIDENCE = 'The %s Residence';

/** Place.CustomParseInt: 0x prefix parses hex, else decimal. AUDIT
 *  quest-6: C# int.Parse throws on malformed input in BOTH arms; JS
 *  parseInt would answer NaN ('0x') or silently truncate ('0x12G'). */
export function customParseInt(value) {
  if (/^0x/i.test(value)) {
    // C# QUIRK KEPT (Q3-i VERIFY): the prefix CHECK ignores case but
    // the Replace("0x","") is case-SENSITIVE, so '0X1A' keeps its
    // prefix and int.Parse(NumberStyles.HexNumber) throws on the X.
    const hex = value.replace('0x', '');
    if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error(`int.Parse failed on '${value}'`);
    return parseInt(hex, 16);
  }
  // int.Parse rejects trailing garbage outright; parseInt would
  // truncate '12abc' to 12 (Q3-i VERIFY - the comment claimed the
  // both-arms throw law, the decimal arm now delivers it) - and, AUDIT
  // 68 S30-tryparse-dup, throws past int32 as well.
  return intParse(value);
}

/** RMBLayout.IsResidence (:753): only House1-House4. */
const isResidence = (buildingType) => buildingType >= BT_HOUSE1 && buildingType <= BT_HOUSE4;

// GetQuestLocation (ContentReader): locationId -> {regionIndex,
// locationIndex}, indexed lazily over the world's MapsFile via
// readLocationIdFast, cached per maps instance.
const questLocationIndexCache = new WeakMap();
function findQuestLocation(maps, locationId) {
  let index = questLocationIndexCache.get(maps);
  if (!index) {
    index = new Map();
    for (let r = 0; r < maps.regionCount; r++) {
      const region = maps.getRegion(r);
      if (!region) continue;
      for (let l = 0; l < region.locationCount; l++) {
        const id = maps.readLocationIdFast(r, l);
        if (!index.has(id)) index.set(id, { regionIndex: r, locationIndex: l });
      }
    }
    questLocationIndexCache.set(maps, index);
  }
  const hit = index.get(locationId);
  return hit ? maps.getLocation(hit.regionIndex, hit.locationIndex) : null;
}

const DECL = [
  /(Place|place) (?<symbol>[a-zA-Z0-9_.-]+) (?<siteType>local|remote|permanent) (?<siteName>\w+)/,
  /(Place|place) (?<sym2>[a-zA-Z0-9_.-]+) (?<siteType2>randompermanent) (?<siteList>[a-zA-Z0-9_.,]+)/,
];

export class Place extends QuestResource {
  constructor(parentQuest, line = null, { nearTowns = true } = {}) {
    super(parentQuest);
    this.scope = Scopes.None;
    this.name = '';
    this.p1 = 0; this.p2 = 0; this.p3 = 0;
    this.siteDetails = null;
    this._die = null;   // QUEST-AUDIT II SHARED-SEAT: set only for the length of a shared copy's re-seat
    this._nearTowns = nearTowns;   // AUDIT QA2: false for a person's first ask of a home (person.js) - Person.cs's own fallback, a house, comes first
    this.sitePending = true;   // no world seam -> the binding PENDS. AUDIT-QUEST F1: this line used to say
                               // it pended "LOUDLY"; setting a boolean is the definition of quiet, and 262
                               // of the 265 vendored quests started headless with nothing in the log at all.
                               // The flag is the record; scenes/questBridge.js's construction report is the
                               // noise, and it names the seam that was never wired.
    if (line !== null) this.setResource(line);
  }

  get isPlace() { return true; }

  setResource(line) {
    super.setResource(line);
    let randomSiteList = false;
    const match = matchFirst(line, DECL);
    if (!match) return;
    const g = match.groups;
    this.symbol = new QuestSymbol(g.symbol ?? g.sym2);
    const siteType = g.siteType ?? g.siteType2;
    if (/^local$/i.test(siteType)) this.scope = Scopes.Local;
    else if (/^remote$/i.test(siteType)) this.scope = Scopes.Remote;
    else if (/^permanent$/i.test(siteType)) this.scope = Scopes.Fixed;
    else if (/^randompermanent$/i.test(siteType)) { this.scope = Scopes.Fixed; randomSiteList = true; }
    else throw new Error(`Place found no site type match found for source: '${line}'. Must be local|remote|permanent.`);

    this.name = g.siteName ?? '';
    if (!this.name && !randomSiteList) throw new Error(`Place site name empty for source: '${line}'`);

    if (randomSiteList) {
      const siteNames = g.siteList.split(',');
      if (!siteNames.length) throw new Error(`Place randompermanent must have at least one site name in source: '${line}'`);
      const roll = this.parentQuest?.rolls ?? Math.random;
      this.name = siteNames[Math.floor(roll() * siteNames.length)];   // Random.Range(0, length)
    }

    const table = placesTable();
    if (!table.hasValue(this.name)) throw new Error(`Could not find place name in data table: '${this.name}'`);
    this.p1 = customParseInt(table.getValue('p1', this.name));
    this.p2 = customParseInt(table.getValue('p2', this.name));
    this.p3 = customParseInt(table.getValue('p3', this.name));

    // The scope dispatch (Place.cs:217-236). The fall-through throw
    // fires for a Fixed place whose p1 <= 0x300 - preserved even
    // headless so bad data still fails the parse where DFU fails it.
    const valid = this.scope === Scopes.Local || this.scope === Scopes.Remote
      || (this.scope === Scopes.Fixed && this.p1 > 0x300);
    if (!valid) throw new Error('Invalid placeType in line: ' + line);

    const world = this.parentQuest?.hooks?.world;
    if (!world) return;   // sitePending stays true - the headless charter (the BRIDGE reports the absent seam)
    if (this.scope === Scopes.Local) this._setupLocalSite(world, line);
    else if (this.scope === Scopes.Remote) this._setupRemoteSite(world, line);
    else this._setupFixedLocation(world);
    this.sitePending = false;
    this._stampSiteLayout();
  }

  /** WD3 (a port addition): a BUILDING site names its building by key, and a key names a building only in the layout
   *  its town stood in - so the site carries that layout, and a load keeps the town in it while the quest runs
   *  (systems/layoutPins.js). A town or dungeon site holds no building and carries none. */
  _stampSiteLayout() {
    const sd = this.siteDetails;
    if (sd?.siteType === SITE_TYPES.Building && sd.buildingKey > 0) stampLayout(sd, layoutStampOfMapId(sd.mapId));
  }

  /**
   * WD3 (AUDIT WD3 S5): A BUILDING SITE IN A TOWN THAT NOW STANDS IN ANOTHER LAYOUT than the site was chosen in (online,
   * a quest of the player's own from before the town mods; offline, a pack that could not be loaded for the town's
   * pin) names another building by its key - a stranger's, a shop for a house, or none. It is chosen again in the town
   * as it stands, by the place's own law (P2/P3, the same exclusions), keeping what was already assigned to it, and
   * stamped anew. Answers whether its record changed.
   * QUESTOR-MOVED: a questor's hall is not such a site - it moves with its questor (person.js reseatMovedQuestor).
   *
   * FIELD BUGS 2026-10-04d RESEAT-GAPS: A SITE NO BUILDING OF ITS KIND STANDS FOR IS UNSEATED. It used to keep its old
   * key, which names another building in the town as it stands - a stranger's house, a shop, or nothing - whose interior
   * its markers do not belong to: its quest's person or thing stood at another building's coordinates there, `pc at`
   * fired inside it, a house was opened to the quest's holder as the quest's (IsActiveQuestBuilding), talk and the town
   * map named it, and the quest's end took it off the map. Unseated, the site names no building - key 0, DFU's own
   * "none" - and keeps its record: its town and its building's name for the journal, its markers and what they hold, and
   * the key and layout it was chosen in (`unseated`), which the town's pin still asks for (layoutPins.js
   * layoutRecordsOf). Every load tries it again: it is seated back on its own key the moment its town stands in that
   * layout again (offline, a pack that could not be loaded), and chosen again where a building of its kind stands.
   */
  reseatMovedSite(world) {
    // QUEST-AUDIT II SHARED-SEAT: a copy kept in step with the party chooses again by ONE die per share and Place (its
    // `shareId` and symbol - VERMIN-SHARED's own, actions.js sharedPickRoll), never its own roll: a resync hands each
    // copy the other's site (machine.js updateSharedQuest), and where two members' towns stood apart (a client whose pack
    // would not load) each chose again by its own roll - the site, and what stood in it, moved to another building at
    // every resync. The same envelope over the same town now lands in the same building and on the same marker.
    const shareId = this.parentQuest?.shareId;
    if (!shareId || !this.parentQuest.hooks?.sharedCopy?.(this.parentQuest)) return this._reseatMovedSite(world);   // AUDIT QA2: a copy kept in step now (actions.js PickOneOf's gate) - a shareId is saved for good
    let n = 0;
    this._die = () => seededFirst(stringHash(`${shareId}|reseat|${this.symbol?.name ?? ''}|${n++}`));
    try { return this._reseatMovedSite(world); } finally { this._die = null; }
  }
  /** reseatMovedSite's law, under whichever die it was handed. */
  _reseatMovedSite(world) {
    const sd = this.siteDetails;
    if (sd?.siteType !== SITE_TYPES.Building) return false;
    const held = sd.unseated ? { ...sd, ...sd.unseated } : sd;   // RESEAT-GAPS: an unseated site is asked by its own record
    if (!(held.buildingKey > 0)) return false;
    if (recordStands(held)) return sd.unseated ? this._seatBack(held) : false;
    // QUEST-AUDIT II PIN-SLEEP: a town whose pin this session could not honour (a pack that did not load) stands in
    // another layout for this session only - the record sleeps, unseated, and is seated back the session it stands again;
    // chosen again here it was stamped with the failed session's layout for good (layoutPins.js recordHeldBack)
    if (recordHeldBack(held)) return this._unseat(held);
    // QUESTOR-MOVED (FIELD BUGS 2026-10-03b): a Place minted where the player stood (ConfigureFromPlayerLocation,
    // `_<person>_home_`) has no P1-P3 law to be chosen again by - its P2 of 0 read as Alchemist, and a questor's hall (the
    // journal's `__qgiver_`) went to the town's apothecary. QUEST-AUDIT II HOUSE-HALL: and it is UNSEATED, never left on
    // its old key - a key that names a stranger's building in the town as it stands (RESEAT-GAPS' own defect: `pc at`
    // fired there, the house was the quest's, and the quest's end took it off the map). The questors are seated first
    // (machine.js _reseatMovedOf), so a hall whose questor stands in this layout has moved with them and stands already
    if (this.scope === Scopes.None) return this._unseat(held);
    const location = this.siteTown(world);
    if (!location) return false;
    // FIELD BUGS 2026-10-04d RESEAT-DECLARED: by the place's DECLARED P2/P3 and its own house fallback - never the -1
    // that fallback wrote into it, which read as `random` and moved a House1 site into a tavern or a shop
    let { p2, p3 } = this.declaredSiteLaw();
    let { found } = this._searchTownSites(world, location, p2, p3);
    // AUDIT QA2: a person's home asked by its group's building (Person.cs's first ask) takes Person.cs's own fallback, a
    // house of its town, before any other town
    if (!found.length && this.scope === Scopes.Local && this.isPersonHome() && !(p2 === -1 && p3 === 1)) {
      [p2, p3] = [-1, 1];   // Quests-Places' `house`
      ({ found } = this._searchTownSites(world, location, p2, p3));
    }
    // QUEST-AUDIT II NEAR-SITE: a LOCAL site whose town the mods took its kind from - the nearest town's (AUDIT QA2: only
    // what the mods took away, _modsTookKind)
    if (!found.length && this.scope === Scopes.Local && this._modsTookKind(world, location, p2, p3)) found = this._nearTownSites(world, location, p2, p3)?.found ?? [];
    // AUDIT PRE-MERGE 1003 WD2: a building with no marker to carry them to is none (_collectQuestSitesOfBuildingType never offers one)
    const next = found.length ? this._carryAssignments(held, found[this._range(found.length)]) : null;
    if (!next) return this._unseat(held);
    this.siteDetails = { ...next, questUID: held.questUID ?? next.questUID, magicNumberIndex: held.magicNumberIndex ?? 0 };
    this._stampSiteLayout();
    return true;
  }

  /** RESEAT-GAPS: the site names no building and keeps its record - false when it already did. */
  _unseat(held) {
    if (this.siteDetails.unseated) return false;
    const { layout, ...record } = held;
    this.siteDetails = { ...record, buildingKey: 0, unseated: { buildingKey: held.buildingKey, ...(layout ? { layout } : {}) } };
    return true;
  }
  /** RESEAT-GAPS: an unseated site whose town stands in the layout it was chosen in is its building again. */
  _seatBack(held) {
    const { unseated: _was, ...record } = held;
    this.siteDetails = record;
    return true;
  }

  /** FIELD BUGS 2026-10-04d QUEST-MARKERS: a building site enumerated before the curation (a save's, a party member's
   *  copy) holds the markers it was given - one, maybe, where no player reaches it, what was assigned to it standing
   *  there. The load's mend moves each one the curation moves (markerCuration.js), what it holds with it - in the
   *  building the site's key names as its town stands, only where the site stands in that layout. Answers how many. */
  mendCuratedMarkers(world) {
    const sd = this.siteDetails;
    if (sd?.siteType !== SITE_TYPES.Building || !(sd.buildingKey > 0) || !recordStands(sd)) return 0;
    const location = this.siteTown(world);
    if (!location) return 0;
    const key = sd.buildingKey;
    const name = world.maps?.getRmbBlockName?.(location, (key >> 16) & 0xff, (key >> 8) & 0xff);
    const dfBlock = name ? world.getBlock?.(name) : null;
    return dfBlock ? curateSiteMarkers(sd, dfBlock, key & 0xff) : 0;
  }

  /**
   * AUDIT PRE-MERGE 1003 WD2: THE ASSIGNMENTS MOVE, NEVER THE MARKERS. A marker's flatPosition is in its own building's
   * interior frame: the old selectedMarker kept stood the quest's person or thing at the old building's coordinates in
   * the new one (in a wall, outside its rooms), and the new building's numbered markers dropped what was placed "at
   * marker N". So the selected marker is one of `next`'s own, of the old one's type (the other where it has none, as
   * _getSiteMarker falls back), given the old one's targets; each numbered marker's targets go to the same index of the
   * new list, or onto the selected marker where the new building has no such marker. Answers `next` so assigned, or null
   * for a building with no marker (_collectQuestSitesOfBuildingType never offers one). `keepSelected` (SHARED-SEAT's
   * keepOwnSite: `next` is this copy's own site, the building it already stands in) keeps `next`'s selected marker where
   * it stands at a spot - AUDIT QA2: and only there; DFU's "none selected" has no spot, and the partner's targets put on it
   * stood nowhere (the interior mount read its flatPosition and threw).
   */
  _carryAssignments(sd, next, { keepSelected = false } = {}) {
    const fresh = (list) => (list ?? []).map((m) => ({ ...m, targetResources: null }));
    const spawn = fresh(next.questSpawnMarkers), item = fresh(next.questItemMarkers);
    if (!validateQuestMarkers(spawn, item)) return null;
    let selectedMarker = { ...next.selectedMarker, targetResources: null };
    const standing = keepSelected && !!next.selectedMarker?.flatPosition;
    const select = (type) => {
      if (standing) { selectedMarker.targetResources ??= []; return; }
      const own = type === MARKER_TYPES.QuestItem ? item : spawn;
      const pool = own.length ? own : (own === item ? spawn : item);
      selectedMarker = { ...pool[this._range(pool.length)], targetResources: [] };
    };
    if (sd.selectedMarker?.targetResources) {
      select(sd.selectedMarker.markerType);
      for (const s of sd.selectedMarker.targetResources) assignResourceToMarker(s, selectedMarker);
    }
    const carry = (from, to, type) => (from ?? []).forEach((m, i) => {
      for (const s of m?.targetResources ?? []) {
        if (to[i]) { assignResourceToMarker(s, to[i]); continue; }
        if (!selectedMarker.targetResources) select(type);
        assignResourceToMarker(s, selectedMarker);
      }
    });
    carry(sd.questSpawnMarkers, spawn, MARKER_TYPES.QuestSpawn);
    carry(sd.questItemMarkers, item, MARKER_TYPES.QuestItem);
    return { ...next, questSpawnMarkers: spawn.length ? spawn : null, questItemMarkers: item.length ? item : null, selectedMarker };
  }

  /**
   * QUEST-AUDIT II SHARED-SEAT: A PARTNER'S SITE THAT NAMES NO BUILDING IN THIS COPY'S TOWN, WHERE THIS COPY'S OWN DOES.
   * A resync restores the partner's Place whole (machine.js updateSharedQuest); where their town stood in another layout
   * (a client whose pack would not load), the site they send names another building here, and choosing it again moved
   * the quest's building - and what the player may already have found standing in it - at every resync. Here the
   * building stays this copy's (`own`, the site as it stood before the resync, in the same town) and what the quest
   * assigned comes from the partner (_carryAssignments, keepSelected): the selected marker keeps its spot and takes the
   * partner's targets - one of this building's own is chosen where this copy had selected none yet (AUDIT QA2) - and each
   * numbered marker's go to the same index (onto the selected marker where this building has no such marker). Answers
   * whether the site was kept; false leaves the partner's for the re-seat, as before.
   */
  keepOwnSite(own) {
    const sd = this.siteDetails;
    if (sd?.siteType !== SITE_TYPES.Building || own?.siteType !== SITE_TYPES.Building) return false;
    const held = sd.unseated ? { ...sd, ...sd.unseated } : sd;
    if (!(held.buildingKey > 0) || recordStands(held)) return false;   // the partner's names a building here: theirs is the quest's
    if (!(own.buildingKey > 0) || own.unseated || own.mapId !== held.mapId || !recordStands(own)) return false;
    const kept = this._carryAssignments(sd, own, { keepSelected: true });
    if (!kept) return false;
    this.siteDetails = { ...kept, questUID: sd.questUID ?? own.questUID };
    return true;
  }

  _rolls() { return this._die ?? this.parentQuest?.rolls ?? Math.random; }   // QUEST-AUDIT II SHARED-SEAT: a shared copy's re-seat die
  _range(n) { return n > 0 ? Math.floor(this._rolls()() * n) : 0; }   // Random.Range(0, n)

  // ---- local sites (Place.cs:701-747) ----

  _setupLocalSite(world, line) {
    // Daggerfall has no local dungeons but some quests (e.g. Sx007)
    // can request one - setup a remote dungeon instead.
    if (this.p1 === 1) { this._setupRemoteSite(world, line); return; }

    const location = world.currentLocation?.();
    if (!location?.loaded) throw new Error('Tried to setup a local site but player is not in a location (i.e. player in wilderness).');

    const asked = { p2: this.p2, p3: this.p3 };   // QUEST-AUDIT II NEAR-SITE: the law asked, before the fallback writes -1
    const { found: foundSites, houseFallback } = this._searchTownSites(world, location, this.p2, this.p3);
    // House-type fallback: there should almost always be a local house - and DFU writes it into the place (Place.cs:735)
    if (houseFallback) this.p2 = -1;
    if (!foundSites.length) {
      // QUEST-AUDIT II NEAR-SITE - AUDIT QA2: only where the mods took the kind away (_modsTookKind), and never for a
      // person's first ask of a home, whose own fallback is a house here (person.js)
      const near = this._nearTowns && this._modsTookKind(world, location, asked.p2, asked.p3) ? this._nearTownSites(world, location, asked.p2, asked.p3) : null;
      if (near) {
        this.p2 = near.houseFallback ? -1 : asked.p2;
        this.siteDetails = near.found[this._range(near.found.length)];
        return;
      }
      throw new Error(`Could not find local site for ${this.symbol.original} with P2=${this.p2} in ${location.regionName}/${location.name}.`);
    }
    this.siteDetails = foundSites[this._range(foundSites.length)];
  }

  /**
   * QUEST-AUDIT II NEAR-SITE (the owner, on the audit's findings: "Rework so quests can work"): A TOWN THE TOWN MODS LAY
   * HOLDS FEWER BUILDINGS OF A KIND THAN DAGGERFALL'S QUESTS ASK OF IT. Beautiful Villages keeps one tavern in 121
   * villages and three houses in its Kynareth temples, Beautiful Cities drops the only weaponsmith, pawnshop or apothecary
   * of a city, and a quest whose local sites outnumber them (two taverns - A0C00Y12, A0C01Y13; five houses - A0C00Y16; a
   * second apothecary - A0C0XY04; a weaponsmith - N0C00Y10) threw, and its questor answered "You're too late" in that town
   * every time. Where the mods took the kind away (_modsTookKind - AUDIT QA2: the town's own layout held more than the
   * mods' holds; nowhere else), a local site that finds no building of its kind - none, or every one already a quest's -
   * is taken in the NEAREST town that has one, by the travel reckoning's distance (questReach.js mapPixelDistance) and in
   * any region (AUDIT QA2: a region-first order sent an apothecary 126 pixels off past one 6 pixels over the border), by
   * the same search there (its house fallback with it) and the MAPS directory pre-check for a named kind as DFU's remote
   * search reads it. The quest's words that name a site's town name that town (its macros read the site; a word naming
   * the building alone says no town) and its travel-armed clocks measure the trip to it. Answers `{ found, houseFallback }`
   * in the nearest town that has sites, or null.
   */
  _nearTownSites(world, location, p2, p3) {
    const mapId = location?.mapTableData?.mapId;
    const origin = mapTablePixel(location?.mapTableData);
    if (!mapId || !origin) return null;
    // the MAPS directory pre-check for a named kind that is no house (SelectRemoteTownSite's, :838-843): a town whose
    // directory has none is passed over unwalked
    const named = p2 >= 0 && !(p2 >= BT_HOUSE1 && p2 <= BT_HOUSE6);
    const towns = [];
    for (let r = 0; r < (world.maps?.regionCount ?? 0); r++) {
      const regionData = world.maps.getRegion?.(r);
      for (let i = 0; i < (regionData?.locationCount ?? 0); i++) {
        const entry = regionData.mapTable[i];
        if (!entry || entry.mapId === mapId || this._isDungeonType(entry.locationType)) continue;
        const px = mapTablePixel(entry);
        if (px) towns.push([r, i, mapPixelDistance(px, origin)]);
      }
    }
    towns.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
    for (const [r, i] of towns) {
      const near = world.maps.getLocation(r, i);
      if (!near?.loaded || (named && !this._hasBuildingType(near, p2))) continue;
      const { found, houseFallback } = this._searchTownSites(world, near, p2, p3);
      if (found.length) return { found, houseFallback };
    }
    return null;
  }

  /**
   * AUDIT QA2: DID THE TOWN MODS TAKE THIS KIND AWAY FROM THE TOWN? NEAR-SITE answered every town a layout mod lays, and
   * 3,058 of the 3,059 tavern-less towns the mods lay had no tavern in Daggerfall's own layout either: their commoners
   * offered A0C00Y10's duel "at _inn_ in ___giver_" with the inn in another town and its 6- and 12-hour clocks, and a
   * questor in a village no library ever stood in sent its friend to another town's. A quest DFU never offers there is
   * not one the mods broke. True where the town stands a layout the mods changed (its stamp) and that layout holds FEWER
   * buildings a search of p2/p3 could offer (_siteSupply: the kind, a house kind as any house - its fallback - the guild
   * hall's faction, quest markers; before any quest or owner takes one) than Daggerfall's own layout of the town held -
   * its MAPS.BSA record and BLOCKS.BSA's blocks. A town with no record of its own to measure (a spawned clone, a host
   * without MAPS.BSA) keeps DFU's law.
   */
  _modsTookKind(world, location, p2, p3) {
    const mapId = location?.mapTableData?.mapId;
    if (!mapId || layoutStampOfMapId(mapId) === CLASSIC_LAYOUT) return false;
    const own = world.maps?.readClassicLocation?.(location.regionIndex, location.locationIndex);
    if (!own?.loaded || !own.exterior?.exteriorData) return false;
    return this._siteSupply(own, classicBlockGrid(own), p2, p3) > this._siteSupply(location, townBlockGrid(world, location), p2, p3);
  }

  /** AUDIT QA2: how many buildings of a town's `blocks` a search of p2/p3 could ever offer (_searchTownSites' kinds, a
   *  house kind as any house), by CollectQuestSitesOfBuildingType's law that no quest or owner changes - counted no
   *  further than `atLeast`. */
  _siteSupply(location, blocks, p2, p3, atLeast = Infinity) {
    let kind = p2;
    if (p2 >= BT_HOUSE1 && p2 <= BT_HOUSE6) kind = BT_ANY_HOUSE;
    else if (p2 === -1 && p3 === 0) kind = BT_ALL_VALID;
    else if (p2 === -1 && p3 === 1) kind = BT_ANY_HOUSE;
    else if (p2 === -1 && p3 === 2) kind = BT_ANY_SHOP;
    let n = 0;
    for (const { b, i } of this._townBuildingsOfType(location, blocks, kind, p3)) {
      const { questSpawnMarkers, questItemMarkers } = this._enumerateBuildingQuestMarkers(b.dfBlock, i);
      if (validateQuestMarkers(questSpawnMarkers, questItemMarkers) && ++n >= atLeast) break;
    }
    return n;
  }

  /** AUDIT QA2: is this place a home a Person of its quest was given (Person.cs's `_<person>_home_`)? */
  isPersonHome() {
    for (const r of this.parentQuest?.resources?.values() ?? []) if (r.isPerson && r.homePlaceSymbol?.name === this.symbol?.name) return true;
    return false;
  }

  /** SetupLocalSite's search (Place.cs:717-736) in one town, by `p2`/`p3`: the wildcard sets, else the building type -
   *  and where a house type finds none, any house. Answers the sites and whether that house fallback ran. One search,
   *  the setup's and a moved site's (reseatMovedSite). */
  _searchTownSites(world, location, p2, p3) {
    let found;
    if (p2 === -1 && p3 === 0) found = this._collectQuestSitesOfBuildingType(world, location, BT_ALL_VALID, p3);
    else if (p2 === -1 && p3 === 1) found = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, p3);
    else if (p2 === -1 && p3 === 2) found = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_SHOP, p3);
    else found = this._collectQuestSitesOfBuildingType(world, location, p2, p3);
    if (!found.length && p2 >= BT_HOUSE1 && p2 <= BT_HOUSE6) {
      return { found: this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, p3), houseFallback: true };
    }
    return { found, houseFallback: false };
  }

  /** FIELD BUGS 2026-10-04d RESEAT-DECLARED: the place's DECLARED P2/P3 - its row of Quests-Places, read again by its
   *  name. The house fallback writes P2 = -1 into the place (SetupLocalSite, Place.cs:735; SelectRemoteTownSite after
   *  250 darts, :815), and -1 with a P3 of 0 is `random`, any valid building; a place built by hand, with no row, has
   *  only what it holds. */
  declaredSiteLaw() {
    const table = placesTable();
    if (!this.name || !table.hasValue(this.name)) return { p2: this.p2, p3: this.p3 };
    return { p2: customParseInt(table.getValue('p2', this.name)), p3: customParseInt(table.getValue('p3', this.name)) };
  }

  // ---- remote sites (Place.cs:755-990) ----

  _setupRemoteSite(world, line) {
    let result = false;
    switch (this.p1) {
      case 0: result = this._selectRemoteTownSite(world, this.p2); break;
      case 1: result = this._selectRemoteDungeonSite(world, this.p2); break;
      case 2: result = this._selectRemoteLocationExteriorSite(world, this.p2); break;
      default: throw new Error(`An unknown P1 value of ${this.p1} was encountered for Place ${this.symbol.original}`);
    }
    // A missing numbered dungeon type retries as any dungeon
    if (!result && this.p1 === 1) result = this._selectRemoteDungeonSite(world, -1);
    if (!result && this.p1 === 0 && this._nearTowns) result = this._nearRegionTownSite(world, this.p2);   // QUEST-AUDIT II NEAR-REGION (AUDIT QA2: never a person's first ask)
    if (!result) {
      throw new Error(`Search failed to locate matching remote site for Place ${this.symbol.original} in region ${world.currentRegionName?.() ?? world.currentRegionIndex?.()}. Resource source: '${line}'`);
    }
  }

  /** SelectRemoteTownSite (:790-870): "throw darts instead" - random
   *  location attempts with the 250-attempt house fallback and the
   *  500-attempt failure, verbatim. */
  _selectRemoteTownSite(world, requiredBuildingType) {
    const maxAttemptsBeforeFallback = 250;
    const maxAttemptsBeforeFailure = 500;
    const regionIndex = world.currentRegionIndex();
    const regionData = world.maps.getRegion(regionIndex);
    const playerLocationIndex = world.currentLocationIndex?.() ?? -1;
    if (!regionData || regionData.locationCount === 0) return false;

    // NEARBY-QUESTS: the towns within the reach, each tried once in a drawn order, then within twice it; only then
    // DFU's darts over the whole region below (a quest that wants a building no near town has must still start)
    const reach = this._questReach(world);
    if (reach) {
      const towns = [];
      for (let i = 0; i < regionData.locationCount; i++) {
        if (i !== playerLocationIndex && !this._isDungeonType(regionData.mapTable[i].locationType)) towns.push(i);
      }
      for (const r of [reach.pixels, reach.pixels * 2]) {
        const pool = indicesWithin(regionData, towns, reach.origin, r);
        if (pool === null) break;   // an unmeasured town: DFU's darts
        if (this._tryTownPool(world, regionIndex, regionData, pool, requiredBuildingType)) return true;
        if (requiredBuildingType >= BT_HOUSE1 && requiredBuildingType <= BT_HOUSE6) {
          // DFU's house fallback (the 250th dart), at once here: no near town has that house - any house will do
          requiredBuildingType = BT_ANY_HOUSE; this.p2 = -1;
          if (this._tryTownPool(world, regionIndex, regionData, pool, requiredBuildingType)) return true;
        }
      }
    }

    let attempts = 0;
    let found = false;
    while (!found) {
      if (++attempts >= maxAttemptsBeforeFallback
        && requiredBuildingType >= BT_HOUSE1 && requiredBuildingType <= BT_HOUSE6) {
        requiredBuildingType = BT_ANY_HOUSE;
        this.p2 = -1;
      }
      if (attempts >= maxAttemptsBeforeFailure) {
        console.warn(`[quest] Could not find remote town site with building type ${requiredBuildingType} within ${attempts} attempts`);
        break;
      }
      const locationIndex = this._range(regionData.locationCount);
      if (locationIndex === playerLocationIndex) continue;
      if (this._isDungeonType(regionData.mapTable[locationIndex].locationType)) continue;
      found = this._tryTownLocation(world, regionIndex, locationIndex, requiredBuildingType);
    }
    return found;
  }

  /**
   * QUEST-AUDIT II NEAR-REGION (the owner: "Rework so quests can work"): A REGION THE TOWN MODS LEFT WITHOUT A KIND OF
   * BUILDING. Beautiful Cities lays Pothago and Menakat without a weaponsmith, the region's only two, so the Dark
   * Brotherhood's L0B60Y10 (`remote weaponstore`) threw at all four of the region's halls: DFU's remote site is the
   * questor's region's alone (SelectRemoteTownSite), and its 500 darts found none. Where the mods took the kind from the
   * region (_modsTookKindFromRegion - AUDIT QA2: fewer of its towns' directories name it than in Daggerfall's own layout;
   * a region that never held it, Isle of Balfiera's palace for the main quest's courier among them, keeps DFU's law), the
   * site is taken in the region's own towns nearest first (AUDIT QA2: the darts can miss the few towns the mods left),
   * and only then in the nearest town of another region - the travel reckoning's distance from the player's pixel - by
   * the same landing a dart makes (`_tryTownLocation`: the directory pre-check, the block walk, the markers). Answers
   * whether a site was set.
   */
  _nearRegionTownSite(world, requiredBuildingType) {
    const regionIndex = world.currentRegionIndex?.();
    if (!this._modsTookKindFromRegion(world, regionIndex, requiredBuildingType)) return false;
    let origin = world.playerPixel?.() ?? null;
    if (!origin) origin = mapTablePixel(world.currentLocation?.()?.mapTableData);
    if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return false;
    const playerLocationIndex = world.currentLocationIndex?.() ?? -1;
    const nearestOf = (regions) => {
      const towns = [];
      for (const r of regions) {
        const region = world.maps.getRegion(r);
        for (let i = 0; i < (region?.locationCount ?? 0); i++) {
          const entry = region.mapTable[i];
          if (!entry || this._isDungeonType(entry.locationType) || (r === regionIndex && i === playerLocationIndex)) continue;
          const px = mapTablePixel(entry);
          if (px) towns.push([r, i, mapPixelDistance(px, origin)]);
        }
      }
      return towns.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
    };
    for (const [r, i] of nearestOf([regionIndex])) if (this._tryTownLocation(world, r, i, requiredBuildingType)) return true;
    const others = [];
    for (let r = 0; r < (world.maps.regionCount ?? 0); r++) if (r !== regionIndex) others.push(r);
    for (const [r, i] of nearestOf(others)) if (this._tryTownLocation(world, r, i, requiredBuildingType)) return true;
    return false;
  }

  /**
   * AUDIT QA2: DID THE TOWN MODS TAKE THIS KIND FROM THE REGION? NEAR-REGION answered every region holding one town a
   * layout mod lays - 43 of the 44 - and so 45 (region, kind) pairs no town of the region held in Daggerfall's own layout
   * either: the main quest's courier (S0000012, `remote palace`) went from Isle of Balfiera's hamlets to another region,
   * where DFU's own law fails it. True where fewer of the region's towns (the player's own and the dungeons aside, as the
   * darts set them aside) can give the site as the region stands now than in Daggerfall's own records of them
   * (MapsFile.readClassicLocation over BLOCKS.BSA): a town GIVES it where the search a dart makes would find one - the
   * MAPS directory's pre-check for a named kind that is no house (`_tryTownLocation`'s), then the block walk's law and
   * markers (_siteSupply). Never the directory alone: Beautiful Cities' Pothago and Menakat still LIST their weaponsmiths,
   * and lay none a quest can use.
   */
  _modsTookKindFromRegion(world, regionIndex, requiredBuildingType) {
    const region = world.maps?.getRegion?.(regionIndex);
    if (!region || !world.maps.readClassicLocation) return false;
    const playerLocationIndex = world.currentLocationIndex?.() ?? -1;
    const wildcard = this.p2 === -1 && (this.p3 === 0 || this.p3 === 1);   // _tryTownLocation's two arms with no pre-check
    const gives = (loc, blocksOf) => !!loc?.loaded && !!loc.exterior?.exteriorData
      && (wildcard || this._hasBuildingType(loc, requiredBuildingType))
      && this._siteSupply(loc, blocksOf(loc), this.p2, this.p3, 1) > 0;
    const towns = [];
    for (let i = 0; i < region.locationCount; i++) {
      const entry = region.mapTable[i];
      if (entry && i !== playerLocationIndex && !this._isDungeonType(entry.locationType)) towns.push(i);
    }
    let own = 0;
    for (const i of towns) if (gives(world.maps.readClassicLocation(regionIndex, i), classicBlockGrid)) own++;
    if (!own) return false;
    let now = 0;
    for (const i of towns) if (gives(world.maps.getLocation(regionIndex, i), (loc) => townBlockGrid(world, loc)) && ++now >= own) return false;
    return true;
  }

  /** One dart's landing (SelectRemoteTownSite's loop body from the location load on, lifted verbatim so the darts and
   *  NEARBY-QUESTS' pools share it): the site set and true, or false and nothing drawn. */
  _tryTownLocation(world, regionIndex, locationIndex, requiredBuildingType) {
    const location = world.maps.getLocation(regionIndex, locationIndex);
    if (!location?.loaded) return false;

    let foundSites;
    if (this.p2 === -1 && this.p3 === 0) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ALL_VALID, this.p3);
    else if (this.p2 === -1 && this.p3 === 1) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, this.p3);
    else {
      // The MAPS.BSA directory pre-check (can be inaccurate, always
      // followed by the full block walk)
      if (!this._hasBuildingType(location, requiredBuildingType)) return false;
      foundSites = this._collectQuestSitesOfBuildingType(world, location, this.p2, this.p3);
    }
    if (!foundSites.length) return false;
    this.siteDetails = foundSites[this._range(foundSites.length)];
    return true;
  }

  /** NEARBY-QUESTS: each town of `pool` once, in an order the quest's roll draws (Fisher-Yates), until one holds a site. */
  _tryTownPool(world, regionIndex, regionData, pool, requiredBuildingType) {
    const order = pool.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = this._range(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    for (const locationIndex of order) if (this._tryTownLocation(world, regionIndex, locationIndex, requiredBuildingType)) return true;
    return false;
  }

  /** NEARBY-QUESTS: the reach this quest's remote sites are drawn within - { origin, pixels } - or null for DFU's own
   *  region-wide draw (the row off, or no pixel to measure from). The origin is the travel reckoning's own
   *  (world.playerPixel, the quest clock's), else the player's location's pixel. */
  _questReach(world) {
    if (!questReachOn()) return null;
    let origin = world.playerPixel?.() ?? null;
    if (!origin) {
      const t = world.currentLocation?.()?.mapTableData;
      if (t) origin = longitudeLatitudeToMapPixel(t.longitude, t.latitude);
    }
    if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
    return { origin, pixels: questReachPixels(this.parentQuest?.hooks?.playerLevel?.() ?? 1) };
  }

  /** SelectRemoteDungeonSite (:880-935): types 0-16 only (17-18 carry
   *  no quest markers), the assigned-dungeon exclusion, and the
   *  marker requirement. */
  _selectRemoteDungeonSite(world, dungeonTypeIndex) {
    const regionIndex = world.currentRegionIndex();
    const regionData = world.maps.getRegion(regionIndex);
    if (!regionData || regionData.locationCount === 0) return false;

    let foundIndices = this._collectDungeonIndicesOfType(regionData, dungeonTypeIndex);
    if (!foundIndices.length) return false;
    const reach = this._questReach(world);   // NEARBY-QUESTS: the dungeons within reach, or the nearest few
    if (reach) foundIndices = nearbyIndices(regionData, foundIndices, reach.origin, reach.pixels);
    const index = this._range(foundIndices.length);
    const location = world.maps.getLocation(regionIndex, foundIndices[index]);
    if (!location?.loaded) return false;

    const { questSpawnMarkers, questItemMarkers } = this._enumerateDungeonQuestMarkers(world, location);
    if (!validateQuestMarkers(questSpawnMarkers, questItemMarkers)) return false;

    this.siteDetails = {
      questUID: this.parentQuest?.uid ?? 0,
      siteType: SITE_TYPES.Dungeon,
      mapId: location.mapTableData.mapId,
      locationId: location.exterior.exteriorData.locationId,
      regionIndex: location.regionIndex,
      regionName: location.regionName,
      locationName: location.name,
      // AUDIT 63 F0: SelectRemoteDungeonSite (Place.cs:921-931) never
      // assigns siteDetails.buildingName, and SiteDetails.buildingName
      // is a plain `string` field of a struct
      // (DaggerfallUnityStructs.cs:424-441), so `new SiteDetails()`
      // leaves it NULL. That null disarms UndiscoverBuilding's
      // matchName gate (PlayerGPS.cs:1015-1016).
      buildingKey: 0, buildingName: null, magicNumberIndex: 0,
      questSpawnMarkers, questItemMarkers,
      selectedMarker: { targetResources: null },
    };
    return true;
  }

  /** SelectRemoteLocationExteriorSite (:940-985): a Town exterior with
   *  NO markers - "reveal on travel map" sites. */
  _selectRemoteLocationExteriorSite(world, locationTypeIndex) {
    const regionIndex = world.currentRegionIndex();
    const regionData = world.maps.getRegion(regionIndex);
    if (!regionData || regionData.locationCount === 0) return false;
    let foundIndices = [];
    for (let i = 0; i < regionData.locationCount; i++) {
      if (locationTypeIndex === -1 || regionData.mapTable[i].locationType === locationTypeIndex) foundIndices.push(i);
    }
    if (!foundIndices.length) return false;
    const reach = this._questReach(world);   // NEARBY-QUESTS
    if (reach) foundIndices = nearbyIndices(regionData, foundIndices, reach.origin, reach.pixels);
    const location = world.maps.getLocation(regionIndex, foundIndices[this._range(foundIndices.length)]);
    if (!location?.loaded) return false;
    this.siteDetails = {
      questUID: this.parentQuest?.uid ?? 0,
      siteType: SITE_TYPES.Town,
      mapId: location.mapTableData.mapId,
      locationId: location.exterior.exteriorData.locationId,
      regionIndex: location.regionIndex,
      regionName: location.regionName,
      locationName: location.name,
      // AUDIT 63 F0: SelectRemoteLocationExteriorSite (Place.cs:967-978)
      // assigns no buildingName either - null, not ''.
      buildingKey: 0, buildingName: null, magicNumberIndex: 0,
      questSpawnMarkers: null, questItemMarkers: null,
      selectedMarker: { targetResources: null },
    };
    return true;
  }

  // ---- fixed sites (Place.cs:992-1105) ----

  _setupFixedLocation(world) {
    // locationId by p1, then p1-1 (dungeons); 50000 is MantellanCrux
    let buildingKey = 0;
    let siteType;
    let location = findQuestLocation(world.maps, this.p1);
    if (!location) {
      location = findQuestLocation(world.maps, this.p1 - 1);
      if (!location) throw new Error(`Could not find locationId from p1 using: '${this.p1}' or '${this.p1 - 1}'`);
      siteType = location.hasDungeon ? SITE_TYPES.Dungeon : SITE_TYPES.Building;
    } else if (this.p1 === 50000) {
      siteType = SITE_TYPES.Dungeon;
    } else {
      siteType = SITE_TYPES.Town;
    }

    let questSpawnMarkers = null, questItemMarkers = null;
    if (siteType === SITE_TYPES.Dungeon) {
      ({ questSpawnMarkers, questItemMarkers } = this._enumerateDungeonQuestMarkers(world, location));
      if (this.p1 === 50000) {
        if (!questSpawnMarkers?.length) throw new Error('Could not find spawn marker in MantellanCrux');
      } else if (!validateQuestMarkers(questSpawnMarkers, questItemMarkers)) {
        throw new Error(`Could not find any quest markers in random dungeon ${location.name}`);
      }
    } else if (siteType === SITE_TYPES.Building) {
      // Walk the exterior directory for the building whose LocationId
      // is p1, then its block record for markers + buildingKey.
      for (const locBuilding of location.exterior.buildings) {
        if (locBuilding.locationId !== this.p1) continue;
        const blockName = location.exterior.exteriorData.blockNames[locBuilding.sector];
        const blockData = world.getBlock(blockName);
        if (blockData) {
          const width = location.exterior.exteriorData.width;
          const x = locBuilding.sector % width;
          const y = Math.trunc(locBuilding.sector / width);
          const list = blockData.rmbBlock.fldHeader.buildingDataList;
          for (let recordIndex = 0; recordIndex < list.length; recordIndex++) {
            if (list[recordIndex].locationId === locBuilding.locationId) {
              ({ questSpawnMarkers, questItemMarkers } = this._enumerateBuildingQuestMarkers(blockData, recordIndex));
              buildingKey = makeBuildingKey(x, y, recordIndex);
            }
          }
        }
        break;
      }
    }

    // The fixed-dungeon magic number (p2 = 0xfa??)
    let magicNumberIndex = 0;
    if (siteType === SITE_TYPES.Dungeon && (this.p2 >> 8) === 0xfa) magicNumberIndex = this.p2 & 0xff;

    this.siteDetails = {
      questUID: this.parentQuest?.uid ?? 0,
      siteType,
      mapId: location.mapTableData.mapId,
      locationId: location.exterior.exteriorData.locationId,
      regionIndex: location.regionIndex,
      regionName: location.regionName,
      locationName: location.name,
      // AUDIT 63 F0: SetupFixedLocation (Place.cs:1088-1101) assigns a
      // REAL buildingKey for its SiteTypes.Building arm (:1066) but
      // never a buildingName - so the tombstone's
      // UndiscoverBuilding(key, true, null) DOES take that residence
      // back off the map, the matchName gate never firing.
      buildingKey, buildingName: null, magicNumberIndex,
      questSpawnMarkers, questItemMarkers,
      selectedMarker: { targetResources: null },
    };
  }

  // ---- collectors (Place.cs:1111-1440) ----

  _isDungeonType(locationType) {
    // 3 major dungeon types + graveyards; excludes towns WITH dungeons
    return locationType === LT_DUNGEON_KEEP || locationType === LT_DUNGEON_LABYRINTH
      || locationType === LT_DUNGEON_RUIN || locationType === LT_GRAVEYARD;
  }

  /** WD3: the town this Place's site names, as the world serves it now (its region's name lookup), or null - where a
   *  moved site (reseatMovedSite) and a moved questor's hall (person.js reseatMovedQuestor) are chosen again. */
  siteTown(world) {
    const sd = this.siteDetails;
    const index = world?.maps?.getRegion?.(sd?.regionIndex)?.mapNameLookup?.get?.(sd?.locationName);
    const location = index == null ? null : world.maps.getLocation(sd.regionIndex, index);
    return location?.exterior?.exteriorData ? location : null;
  }

  /** CollectQuestSitesOfBuildingType (:1131-1250): the full block walk
   *  with the wildcard sets, the owned-house / guild-faction / TG+DB /
   *  already-assigned exclusions, the marker requirement, and the
   *  building NAME (residences draw a surname). */
  _collectQuestSitesOfBuildingType(world, location, buildingType, guildHallFaction) {
    const foundSites = [];
    const activeQuestSites = this.parentQuest?.hooks?.getAllActiveQuestSites?.() ?? [];
    const parentQuestPlaces = [...(this.parentQuest?.resources.values() ?? [])].filter((r) => r.isPlace && r !== this);

    for (const { b, i, summary, buildingKey } of this._townBuildingsOfType(location, townBlockGrid(world, location), buildingType, guildHallFaction)) {
      if (world.isHouseOwned?.(buildingKey)) continue;
      if (world.isPlayerHome?.(location.mapTableData?.mapId, buildingKey)) continue;   // HOME1: nor a player's online home (a departure: DFU has one player)
      if (this._isBuildingAssigned(activeQuestSites, parentQuestPlaces, location, summary, buildingKey)) continue;

      const { questSpawnMarkers, questItemMarkers } = this._enumerateBuildingQuestMarkers(b.dfBlock, i);
      if (!validateQuestMarkers(questSpawnMarkers, questItemMarkers)) continue;

      foundSites.push({
        questUID: this.parentQuest?.uid ?? 0,
        siteType: SITE_TYPES.Building,
        mapId: location.mapTableData.mapId,
        locationId: location.exterior.exteriorData.locationId,
        regionIndex: location.regionIndex,
        regionName: location.regionName,
        locationName: location.name,
        buildingKey,
        buildingName: this._getBuildingName(world, summary.buildingType, location, summary, buildingKey),
        magicNumberIndex: 0,
        questSpawnMarkers, questItemMarkers,
        selectedMarker: { targetResources: null },
      });
    }
    return foundSites;
  }

  /** CollectQuestSitesOfBuildingType's walk (Place.cs:1335-1392) over a town's `blocks` (townBlockGrid's shape): each
   *  building of the kind asked that the law no quest or owner changes admits - the guild hall's faction, never the Dark
   *  Brotherhood's or the Thieves Guild's - as { b, i, summary, buildingKey }. The search asks the rest (the owners, the
   *  quests, the markers); AUDIT QA2's supply the markers alone. */
  *_townBuildingsOfType(location, blocks, buildingType, guildHallFaction) {
    const merged = mergeNamedBuildings(location.exterior.buildings, blocks.filter((b) => b.dfBlock), { locationIndex: location.locationIndex ?? 0 });   // AUDIT-RR F34: the replacement seed is NameSeed + LocationIndex here too (RMBLayout.cs:669)
    for (const b of blocks) {
      if (!b.dfBlock) continue;
      const list = merged.get(b) ?? [];
      const count = Math.min(list.length, blockBuildingCount(b.dfBlock) ?? list.length);
      for (let i = 0; i < count; i++) {
        const summary = list[i];
        let wildcardFound = false;
        if (buildingType === BT_ALL_VALID) wildcardFound = VALID_BUILDING_TYPES.includes(summary.buildingType);
        else if (buildingType === BT_ANY_HOUSE) wildcardFound = VALID_HOUSE_TYPES.includes(summary.buildingType);
        else if (buildingType === BT_ANY_SHOP) wildcardFound = VALID_SHOP_TYPES.includes(summary.buildingType);
        if (summary.buildingType !== buildingType && !wildcardFound) continue;
        if (summary.buildingType === BT_GUILDHALL
          && !(guildHallFaction === 0 || summary.factionId === guildHallFaction)) continue;
        if (summary.factionId === DARK_BROTHERHOOD_FACTION || summary.factionId === THIEVES_GUILD_FACTION) continue;
        yield { b, i, summary, buildingKey: makeBuildingKey(b.x, b.y, i) };
      }
    }
  }

  _isBuildingAssigned(activeQuestSites, parentQuestPlaces, location, summary, buildingKey) {
    // Guild halls are excluded from the same-building check (N0B10Y03:
    // the questor's hall hosts the quest's own action)
    // FIELD BUGS 2026-10-04d RESEAT-GAPS: and a site holds a building only where its key names it - in the layout it was
    // chosen in (recordStands). A moved site not chosen again yet - the sibling the load's re-seat comes to next, another
    // quest's - names a stranger by its old key, and that stranger was taken from the choice: two sites that both left a
    // town's only House2 could both be kept out of it.
    if (summary.buildingType !== BT_GUILDHALL) {
      for (const place of parentQuestPlaces) {
        if (place.siteDetails?.siteType === SITE_TYPES.Building
          && place.siteDetails.mapId === location.mapTableData.mapId
          && place.siteDetails.buildingKey === buildingKey && recordStands(place.siteDetails)) return true;
      }
    }
    for (const site of activeQuestSites) {
      if (site.siteType === SITE_TYPES.Building
        && site.mapId === location.mapTableData.mapId
        && site.buildingKey === buildingKey && recordStands(site)) return true;
    }
    return false;
  }

  /** GetBuildingName (:1296-1325): a residence draws a random surname
   *  ("The %s Residence"); Redguards have a single name - and C#'s
   *  fallback rolls Range(0, 1), which is ALWAYS 0/Male (quirk kept);
   *  everything else reads the fixed building name. */
  _getBuildingName(world, buildingType, location, summary, buildingKey = 0) {
    if (isResidence(buildingType)) {
      const bank = getNameBankOfRegion(location.regionIndex);
      const named = () => {
        let name = surname(bank);
        if (!name) name = firstName(bank, [GENDERS.Male, GENDERS.Female][this._range(1)] ?? GENDERS.Male);
        return name;
      };
      // AUDIT QA2: a shared copy's re-seat draws the house's name from the share and the building - DFRandom's one
      // state is each member's own, and two copies seated in one house named it twice; the state is put back after
      const shareId = this._die ? this.parentQuest?.shareId : null;
      if (!shareId) return THE_NAMED_RESIDENCE.replace('%s', named());
      const was = getSeed();
      setSeed(stringHash(`${shareId}|residence|${location.mapTableData?.mapId ?? 0}|${buildingKey}`));
      try { return THE_NAMED_RESIDENCE.replace('%s', named()); } finally { setSeed(was); }
    }
    return generateBuildingName(summary.nameSeed, summary.buildingType,
      { ...(world.buildingNameOpts?.() ?? {}), locationName: location.name, regionName: location.regionName, factionId: summary.factionId });
  }

  _hasBuildingType(location, buildingType) {
    return location.exterior.buildings.some((b) => b.buildingType === buildingType);
  }

  _collectDungeonIndicesOfType(regionData, dungeonTypeIndex, allowFullRange = false) {
    const upperLimit = allowFullRange ? 18 : 16;
    const activeQuestSites = this.parentQuest?.hooks?.getAllActiveQuestSites?.() ?? [];
    const parentQuestPlaces = [...(this.parentQuest?.resources.values() ?? [])].filter((r) => r.isPlace && r !== this);
    const found = [];
    for (let i = 0; i < regionData.locationCount; i++) {
      if (!this._isDungeonType(regionData.mapTable[i].locationType)) continue;
      if (this._isDungeonAssigned(activeQuestSites, parentQuestPlaces, regionData.mapTable[i].mapId)) continue;
      const type = regionData.mapTable[i].dungeonType;
      if (dungeonTypeIndex === -1) {
        if (type >= 0 && type <= upperLimit) found.push(i);
      } else if (type === dungeonTypeIndex) {
        found.push(i);
      }
    }
    return found;
  }

  _isDungeonAssigned(activeQuestSites, parentQuestPlaces, mapId) {
    for (const place of parentQuestPlaces) {
      if (place.siteDetails?.siteType === SITE_TYPES.Dungeon && place.siteDetails.mapId === mapId) return true;
    }
    for (const site of activeQuestSites) {
      if (site.siteType === SITE_TYPES.Dungeon && site.mapId === mapId) return true;
    }
    return false;
  }

  // ---- quest markers (Place.cs:1444-1585) ----

  _createQuestMarker(markerType, flatPosition, dungeonX = 0, dungeonZ = 0, markerID = 0) {
    return {
      questUID: this.parentQuest?.uid ?? 0,
      placeSymbol: this.symbol.clone(),
      targetResources: null,
      markerType, flatPosition, dungeonX, dungeonZ, buildingKey: 0, markerID,
    };
  }

  /** EnumerateBuildingQuestMarkers (:1486): the building INTERIOR's
   *  flat records, archive 199 records 11/18, positions scaled as
   *  (x, -y, z) * GlobalScale. */
  _enumerateBuildingQuestMarkers(blockData, recordIndex) {
    const spawn = [], item = [];
    const recordData = blockData.rmbBlock.subRecords[recordIndex];
    for (const obj of recordData?.interior?.blockFlatObjectRecords ?? []) {
      if (obj.textureArchive !== EDITOR_FLAT_ARCHIVE) continue;
      // FIELD BUGS 2026-10-04d QUEST-MARKERS: a town pack's marker no player can reach stands at its measured floor spot
      const [x, y, z] = curatedMarkerSpot(blockData, recordIndex, obj.textureRecord, obj.xPos, obj.yPos, obj.zPos) ?? [obj.xPos, obj.yPos, obj.zPos];
      const position = { x: x * GLOBAL_SCALE, y: -y * GLOBAL_SCALE, z: z * GLOBAL_SCALE };
      if (obj.textureRecord === SPAWN_MARKER_RECORD) spawn.push(this._createQuestMarker(MARKER_TYPES.QuestSpawn, position));
      else if (obj.textureRecord === ITEM_MARKER_RECORD) item.push(this._createQuestMarker(MARKER_TYPES.QuestItem, position));
    }
    return { questSpawnMarkers: spawn.length ? spawn : null, questItemMarkers: item.length ? item : null };
  }

  /** EnumerateDungeonQuestMarkers (:1522): every RDB block's flats,
   *  markerID = block position + object position (the classic marker
   *  identity), block X/Z carried for layout. */
  _enumerateDungeonQuestMarkers(world, location) {
    const spawn = [], item = [];
    for (const dungeonBlock of location.dungeon?.blocks ?? []) {
      const blockData = world.getBlock(dungeonBlock.blockName);
      if (!blockData) continue;
      for (const group of blockData.rdbBlock.objectRootList ?? []) {
        if (!group?.rdbObjects) continue;
        for (const obj of group.rdbObjects) {
          if (obj.type !== RDB_RESOURCE_TYPES.Flat) continue;
          const flat = obj.resources?.flatResource;
          if (!flat || flat.textureArchive !== EDITOR_FLAT_ARCHIVE) continue;
          const markerID = blockData.position + obj.position;
          const position = { x: obj.xPos * GLOBAL_SCALE, y: -obj.yPos * GLOBAL_SCALE, z: obj.zPos * GLOBAL_SCALE };
          if (flat.textureRecord === SPAWN_MARKER_RECORD) {
            spawn.push(this._createQuestMarker(MARKER_TYPES.QuestSpawn, position, dungeonBlock.x, dungeonBlock.z, markerID));
          } else if (flat.textureRecord === ITEM_MARKER_RECORD) {
            item.push(this._createQuestMarker(MARKER_TYPES.QuestItem, position, dungeonBlock.x, dungeonBlock.z, markerID));
          }
        }
      }
    }
    return { questSpawnMarkers: spawn.length ? spawn : null, questItemMarkers: item.length ? item : null };
  }

  // ---- marker selection + assignment (Place.cs:362-540) ----

  /** GetSiteMarker (:362-440): reuse the previously selected marker;
   *  a specific index assigns DIRECTLY to that marker slot; anymarker
   *  draws from the combined pool; otherwise the preferred type
   *  (spawn for Person/Foe/UseQuestMarker, item for Item) with
   *  cross-type fallback. Returns false when the caller must NOT
   *  assign to selectedMarker (already assigned directly). */
  _getSiteMarker(resource, markerIndex, markerIndexPreference) {
    const sd = this.siteDetails;
    if (sd.selectedMarker.targetResources !== null) {
      if (markerIndex > -1) {
        if (resource.isPerson || resource.isFoe || markerIndexPreference === MARKER_PREFERENCE.UseQuestMarker) {
          assignResourceToMarker(resource.symbol.clone(), sd.questSpawnMarkers[markerIndex]);
        } else if (resource.isItem) {
          assignResourceToMarker(resource.symbol.clone(), sd.questItemMarkers[markerIndex]);
        }
        return false;
      }
      return true;
    }
    if (markerIndexPreference === MARKER_PREFERENCE.AnyMarker) {
      // C# AddRanges BOTH arrays unguarded (Place.cs:384-385): a site
      // holding only one marker type throws ArgumentNullException and
      // the quest error-terminates - kept (Q3-i VERIFY).
      if (!sd.questSpawnMarkers || !sd.questItemMarkers) {
        throw new Error('Value cannot be null. (AnyMarker pool AddRange on a null marker array)');
      }
      const all = [...sd.questSpawnMarkers, ...sd.questItemMarkers];
      if (all.length > 0) { sd.selectedMarker = { ...all[this._range(all.length)] }; return true; }
      return false;
    }
    let preferred = MARKER_TYPES.None;
    if (resource.isPerson || resource.isFoe || markerIndexPreference === MARKER_PREFERENCE.UseQuestMarker) preferred = MARKER_TYPES.QuestSpawn;
    else if (resource.isItem) preferred = MARKER_TYPES.QuestItem;

    const hasSpawn = !!sd.questSpawnMarkers?.length;
    const hasItem = !!sd.questItemMarkers?.length;
    // Q3-i VERIFY: QuestMarker is a C# STRUCT - selecting COPIES it,
    // so the normal path builds targetResources on the COPY and the
    // array slots stay null; only the direct-index arm writes into an
    // array slot. A shallow spread is the exact struct-copy: it
    // shares an already-created list reference, as C# does.
    if (preferred === MARKER_TYPES.QuestSpawn && hasSpawn) {
      sd.selectedMarker = { ...(markerIndex === -1 ? sd.questSpawnMarkers[this._range(sd.questSpawnMarkers.length)] : sd.questSpawnMarkers[markerIndex]) };
    } else if (preferred === MARKER_TYPES.QuestItem && hasItem) {
      sd.selectedMarker = { ...(markerIndex === -1 ? sd.questItemMarkers[this._range(sd.questItemMarkers.length)] : sd.questItemMarkers[markerIndex]) };
    } else if (hasSpawn) {
      sd.selectedMarker = { ...sd.questSpawnMarkers[this._range(sd.questSpawnMarkers.length)] };
    } else if (hasItem) {
      sd.selectedMarker = { ...sd.questItemMarkers[this._range(sd.questItemMarkers.length)] };
    }
    return true;
  }

  /** AssignQuestResource (:448-540): validate markers, resolve the
   *  resource, cull it from other sites, and pin its symbol to the
   *  selected (or indexed) marker - then the SCENE halves (Q4-iii):
   *  hot-place when the player is already at this Place at assign
   *  time (PlayerEnterExit could not have run layout for it - the
   *  M0B30Y08 after-7pm zombie), and hot-remove of a behaviour stood
   *  somewhere the player is not. world.mountCurrentSiteQuestResources
   *  is the host's AddQuestResourceObjects over the player's current
   *  interior/dungeon; its ABSENCE mirrors C#'s missing
   *  PlayerEnterExit, whose `return` also skips the hot-remove,
   *  verbatim. */
  assignQuestResource(targetSymbol, markerIndex = -1, markerIndexPreference = MARKER_PREFERENCE.Default, cullExisting = true) {
    const sd = this.siteDetails;
    if (!sd || !validateQuestMarkers(sd.questSpawnMarkers, sd.questItemMarkers)) {
      throw new Error(`Tried to assign resource ${targetSymbol?.name} to Place without at least a spawn or item marker.`);
    }
    const resource = this.parentQuest.getResource(targetSymbol);
    if (!resource) throw new Error(`Could not locate quest resource with symbol ${targetSymbol?.name}`);
    if (cullExisting) this.parentQuest.hooks?.cullResourceTarget?.(resource, this.symbol);
    if (this._getSiteMarker(resource, markerIndex, markerIndexPreference)) {
      assignResourceToMarker(targetSymbol.clone(), sd.selectedMarker);
    }
    const world = this.parentQuest.hooks?.world;
    if (this.isPlayerHere()) {
      if (!world?.mountCurrentSiteQuestResources) return;
      world.mountCurrentSiteQuestResources();
    }
    if (!this.isPlayerHere() && resource.questResourceBehaviour) {
      resource.questResourceBehaviour.destroyGameObject();
    }
  }

  /** ConfigureFromPlayerLocation (Place.cs:296-360, Q3-ii): a Place
   *  minted directly from wherever the player stands - the questor /
   *  at-home-individual home. Dungeon and Building sites carry the
   *  current context's name/key; NO markers enumerate here, verbatim
   *  (a questor's hall hosts clicks and dialog, not placements). */
  configureFromPlayerLocation(world, symbolName) {
    const location = world.currentLocation?.();
    if (!location?.loaded) return false;
    const inside = world.playerInside?.() ?? null;
    let siteType, buildingKey = 0, buildingName = '';
    if (inside?.dungeon) {
      siteType = SITE_TYPES.Dungeon;
      buildingName = inside.dungeon.name ?? '';
    } else if (inside?.building) {
      siteType = SITE_TYPES.Building;
      buildingKey = inside.building.buildingKey;
      buildingName = inside.building.name ?? '';
    } else {
      siteType = SITE_TYPES.Town;
    }
    this.siteDetails = {
      questUID: this.parentQuest?.uid ?? 0,
      siteType,
      mapId: location.mapTableData.mapId,
      locationId: location.exterior.exteriorData.locationId,
      regionIndex: location.regionIndex,
      regionName: location.regionName,
      locationName: location.name,
      buildingKey, buildingName, magicNumberIndex: 0,
      questSpawnMarkers: null, questItemMarkers: null,
      selectedMarker: { targetResources: null },
    };
    this._stampSiteLayout();   // WD3
    this.symbol = new QuestSymbol(symbolName);
    this.sitePending = false;
    return true;
  }

  // ---- player checks (Place.cs:545-560, 1590-1656) ----

  /** IsPlayerHere: building compares the entered building's key, town
   *  needs outside + the location rect, dungeon compares mapId. */
  /** ExpandMacro (Place.cs): stores this place as the quest's last
   *  referenced (%di reads it). _symbol_ building name, __symbol_
   *  and ___symbol_ the location name, ____symbol_ the region name
   *  with the OLDER-SAVE workaround arm (regionIndex 0 that is not
   *  Alik'r Desert re-derives the index from the legacy name). */
  expandMacro(macroType) {
    const quest = this.parentQuest;
    // AUDIT 24 systems: Place.ExpandMacro (Place.cs:250) latches
    // LastPlaceReferenced and NOTHING else. LastResourceReferenced is
    // written in exactly two places in the whole DFU tree -
    // Person.cs:295 and Foe.cs:157 - so a place symbol expanded
    // earlier in a message must NOT steal the pronoun context from
    // the questor: `_qgiver_ ... visit _house_. Bring %g3 the book.`
    // renders "her" for a female questor, not the Place's inherited
    // male default.
    quest.lastPlaceReferenced = this;
    const sd = this.siteDetails;
    if (!sd) return false;
    const world = quest.hooks?.world;
    switch (macroType) {
      case 1: return sd.buildingName;           // NameMacro1
      case 2: case 3: return sd.locationName;   // NameMacro2/3
      case 4: {                                 // NameMacro4
        if (sd.regionIndex === 0 && sd.regionName !== "Alik'r Desert") {
          const index = world?.maps?.getRegionIndex?.(sd.regionName);
          return world?.maps?.getRegion?.(index)?.name ?? sd.regionName;
        }
        return world?.maps?.getRegion?.(sd.regionIndex)?.name ?? sd.regionName;
      }
      default: return false;
    }
  }

  isPlayerHere() {
    const world = this.parentQuest?.hooks?.world;
    const sd = this.siteDetails;
    if (!world || !sd) return false;
    const inside = world.playerInside?.() ?? null;
    if (sd.siteType === SITE_TYPES.Building) {
      if (!inside?.building) return false;
      const location = world.currentLocation?.();
      if (!location?.loaded || location.mapTableData.mapId !== sd.mapId) return false;
      return inside.building.buildingKey === sd.buildingKey;
    }
    if (sd.siteType === SITE_TYPES.Town) {
      if (inside) return false;
      const location = world.currentLocation?.();
      return !!(location?.loaded && world.isPlayerInLocationRect?.() && location.mapTableData.mapId === sd.mapId);
    }
    if (sd.siteType === SITE_TYPES.Dungeon) {
      if (!inside?.dungeon) return false;
      const location = world.currentLocation?.();
      return !!(location?.loaded && location.mapTableData.mapId === sd.mapId);
    }
    return false;
  }

  // ---- the save envelope (Q4-iv; Place.cs:1668-1706) ----

  /** GetSaveData: scope, the parse triple, and the WHOLE SiteDetails
   *  (markers, targets, names) as plain data - marker targetResources
   *  round-trip as {original, name} records, exactly the shape C#'s
   *  serializer writes for Symbol. */
  getSaveData() {
    return {
      scope: this.scope,
      name: this.name,
      p1: this.p1, p2: this.p2, p3: this.p3,
      siteDetails: this.siteDetails ? structuredClone(this.siteDetails) : null,
    };
  }

  /** RestoreSaveData: plain assigns; a restored site is RESOLVED, so
   *  the port's sitePending flag (headless-only, no C# counterpart)
   *  clears when details landed. */
  restoreSaveData(dataIn) {
    if (dataIn == null) return;
    this.scope = dataIn.scope;
    this.name = dataIn.name;
    this.p1 = dataIn.p1; this.p2 = dataIn.p2; this.p3 = dataIn.p3;
    this.siteDetails = dataIn.siteDetails ? structuredClone(dataIn.siteDetails) : null;
    this.sitePending = !this.siteDetails;
  }
}

/** The town's RMB grid as CollectQuestSitesOfBuildingType's block loop walks it: `{ dfBlock, x, y }` for each cell in
 *  row order, `dfBlock` null where the world holds no block of the name. The one walk - the site collector's and a moved
 *  questor's (person.js reseatMovedQuestor). */
/** AUDIT QA2: a town as Daggerfall laid it - its MAPS.BSA record's block names (read straight: the door's note of the
 *  town about to be laid, MapsFile.getRmbBlockName's, is not this) over BLOCKS.BSA's own blocks (the door's bound
 *  BlocksFile, read past the door) - in townBlockGrid's shape. A block BLOCKS.BSA does not hold is none. */
export function classicBlockGrid(location) {
  const { width, height, blockNames } = location.exterior.exteriorData;
  const bsa = boundWorldDataBlocks();
  const read = new Map();
  const blockOf = (name) => {
    if (!read.has(name)) { const i = bsa?.getBlockIndex?.(name) ?? -1; read.set(name, i >= 0 ? bsa.readClassicBlock?.(i) ?? null : null); }
    return read.get(name);
  };
  const blocks = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) blocks.push({ dfBlock: blockOf(blockNames[y * width + x]), x, y });
  }
  return blocks;
}

export function townBlockGrid(world, location) {
  const width = location.exterior.exteriorData.width;
  const height = location.exterior.exteriorData.height;
  const blocks = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const blockName = world.maps.getRmbBlockName(location, x, y);
      const dfBlock = world.getBlock(blockName);
      blocks.push({ dfBlock, x, y });
    }
  }
  return blocks;
}

/** ValidateQuestMarkers (Place.cs:1462). */
export function validateQuestMarkers(questSpawnMarkers, questItemMarkers) {
  return !!(questSpawnMarkers?.length || questItemMarkers?.length);
}

/** AssignResourceToMarker (Place.cs:1473). */
export function assignResourceToMarker(symbol, marker) {
  if (!marker.targetResources) marker.targetResources = [];
  marker.targetResources.push(symbol);
}

/** Place.IsPlayerAtBuildingType (:624-663) - PcAt's type form. */
export function isPlayerAtBuildingType(world, p2, p3) {
  const inside = world?.playerInside?.() ?? null;
  if (!inside?.building) return false;
  const buildingType = inside.building.buildingType;
  if (p2 === -1) {
    switch (p3) {
      case 0: return VALID_BUILDING_TYPES.includes(buildingType);
      case 1: return VALID_HOUSE_TYPES.includes(buildingType);
      case 2: return VALID_SHOP_TYPES.includes(buildingType);
      default:
        console.warn(`[quest] Unhandled building type: p1=0, p2=${p2}, p3=${p3}`);
        return false;
    }
  } else if (p2 === BT_GUILDHALL) {
    if (buildingType !== p2) return false;
    if (p3 === 0) return true;
    return inside.building.factionId === p3;
  }
  return buildingType === p2;
}

/** Place.IsPlayerAtDungeonType (:666-680). */
export function isPlayerAtDungeonType(world, p2) {
  const inside = world?.playerInside?.() ?? null;
  if (!inside?.dungeon) return false;
  if (p2 === -1) return true;
  return p2 === inside.dungeon.dungeonType;
}

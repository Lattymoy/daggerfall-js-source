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
// charter) leaves `sitePending` true, loudly, exactly the
// travelTimePending precedent; with a world present the resolution
// runs AT PARSE and throws exactly where DFU throws. Selection draws
// ride the quest's injectable roll (Ledger A; DFU uses
// UnityEngine.Random throughout).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { placesTable } from './tables.js';
import { mergeNamedBuildings, makeBuildingKey } from '../talkTopics.js';
import { generateBuildingName } from '../../world/buildingNames.js';
import { surname, firstName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { RDB_RESOURCE_TYPES } from '../../formats/blocksFile.js';

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

// Place.cs:621-623 - the wildcard building-type sets.
const VALID_BUILDING_TYPES = Object.freeze([0, 2, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20]);
const VALID_HOUSE_TYPES = Object.freeze([17, 18, 19, 20]);
const VALID_SHOP_TYPES = Object.freeze([0, 2, 5, 6, 7, 8, 9, 12, 13]);   // not including bank and library

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
    const hex = value.replace(/0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error(`int.Parse failed on '${value}'`);
    return parseInt(hex, 16);
  }
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`int.Parse failed on '${value}'`);
  return n;
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
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.scope = Scopes.None;
    this.name = '';
    this.p1 = 0; this.p2 = 0; this.p3 = 0;
    this.siteDetails = null;
    this.sitePending = true;   // no world seam -> the binding pends LOUDLY (travelTimePending precedent)
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
    if (!world) return;   // sitePending stays true - the headless charter
    if (this.scope === Scopes.Local) this._setupLocalSite(world, line);
    else if (this.scope === Scopes.Remote) this._setupRemoteSite(world, line);
    else this._setupFixedLocation(world);
    this.sitePending = false;
  }

  _rolls() { return this.parentQuest?.rolls ?? Math.random; }
  _range(n) { return n > 0 ? Math.floor(this._rolls()() * n) : 0; }   // Random.Range(0, n)

  // ---- local sites (Place.cs:701-747) ----

  _setupLocalSite(world, line) {
    // Daggerfall has no local dungeons but some quests (e.g. Sx007)
    // can request one - setup a remote dungeon instead.
    if (this.p1 === 1) { this._setupRemoteSite(world, line); return; }

    const location = world.currentLocation?.();
    if (!location?.loaded) throw new Error('Tried to setup a local site but player is not in a location (i.e. player in wilderness).');

    let foundSites;
    if (this.p2 === -1 && this.p3 === 0) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ALL_VALID, this.p3);
    else if (this.p2 === -1 && this.p3 === 1) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, this.p3);
    else if (this.p2 === -1 && this.p3 === 2) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_SHOP, this.p3);
    else foundSites = this._collectQuestSitesOfBuildingType(world, location, this.p2, this.p3);

    // House-type fallback: there should almost always be a local house
    const required = this.p2;
    if (!foundSites.length && required >= BT_HOUSE1 && required <= BT_HOUSE6) {
      this.p2 = -1;
      foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, this.p3);
    }
    if (!foundSites.length) {
      throw new Error(`Could not find local site for ${this.symbol.original} with P2=${this.p2} in ${location.regionName}/${location.name}.`);
    }
    this.siteDetails = foundSites[this._range(foundSites.length)];
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
      const location = world.maps.getLocation(regionIndex, locationIndex);
      if (!location?.loaded) continue;

      let foundSites;
      if (this.p2 === -1 && this.p3 === 0) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ALL_VALID, this.p3);
      else if (this.p2 === -1 && this.p3 === 1) foundSites = this._collectQuestSitesOfBuildingType(world, location, BT_ANY_HOUSE, this.p3);
      else {
        // The MAPS.BSA directory pre-check (can be inaccurate, always
        // followed by the full block walk)
        if (!this._hasBuildingType(location, requiredBuildingType)) continue;
        foundSites = this._collectQuestSitesOfBuildingType(world, location, this.p2, this.p3);
      }
      if (!foundSites.length) continue;
      this.siteDetails = foundSites[this._range(foundSites.length)];
      found = true;
    }
    return found;
  }

  /** SelectRemoteDungeonSite (:880-935): types 0-16 only (17-18 carry
   *  no quest markers), the assigned-dungeon exclusion, and the
   *  marker requirement. */
  _selectRemoteDungeonSite(world, dungeonTypeIndex) {
    const regionIndex = world.currentRegionIndex();
    const regionData = world.maps.getRegion(regionIndex);
    if (!regionData || regionData.locationCount === 0) return false;

    const foundIndices = this._collectDungeonIndicesOfType(regionData, dungeonTypeIndex);
    if (!foundIndices.length) return false;
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
      buildingKey: 0, buildingName: '', magicNumberIndex: 0,
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
    const foundIndices = [];
    for (let i = 0; i < regionData.locationCount; i++) {
      if (locationTypeIndex === -1 || regionData.mapTable[i].locationType === locationTypeIndex) foundIndices.push(i);
    }
    if (!foundIndices.length) return false;
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
      buildingKey: 0, buildingName: '', magicNumberIndex: 0,
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
      buildingKey, buildingName: '', magicNumberIndex,
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

  /** CollectQuestSitesOfBuildingType (:1131-1250): the full block walk
   *  with the wildcard sets, the owned-house / guild-faction / TG+DB /
   *  already-assigned exclusions, the marker requirement, and the
   *  building NAME (residences draw a surname). */
  _collectQuestSitesOfBuildingType(world, location, buildingType, guildHallFaction) {
    const foundSites = [];
    const activeQuestSites = this.parentQuest?.hooks?.getAllActiveQuestSites?.() ?? [];
    const parentQuestPlaces = [...(this.parentQuest?.resources.values() ?? [])].filter((r) => r.isPlace && r !== this);

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
    const merged = mergeNamedBuildings(location.exterior.buildings, blocks.filter((b) => b.dfBlock));

    for (const b of blocks) {
      if (!b.dfBlock) continue;
      const list = merged.get(b) ?? [];
      const count = Math.min(list.length, b.dfBlock.rmbBlock.subRecords?.length ?? list.length);
      for (let i = 0; i < count; i++) {
        const summary = list[i];
        let wildcardFound = false;
        if (buildingType === BT_ALL_VALID) wildcardFound = VALID_BUILDING_TYPES.includes(summary.buildingType);
        else if (buildingType === BT_ANY_HOUSE) wildcardFound = VALID_HOUSE_TYPES.includes(summary.buildingType);
        else if (buildingType === BT_ANY_SHOP) wildcardFound = VALID_SHOP_TYPES.includes(summary.buildingType);
        if (summary.buildingType !== buildingType && !wildcardFound) continue;

        const buildingKey = makeBuildingKey(b.x, b.y, i);
        if (world.isHouseOwned?.(buildingKey)) continue;
        if (summary.buildingType === BT_GUILDHALL
          && !(guildHallFaction === 0 || summary.factionId === guildHallFaction)) continue;
        if (summary.factionId === DARK_BROTHERHOOD_FACTION || summary.factionId === THIEVES_GUILD_FACTION) continue;
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
          buildingName: this._getBuildingName(world, summary.buildingType, location, summary),
          magicNumberIndex: 0,
          questSpawnMarkers, questItemMarkers,
          selectedMarker: { targetResources: null },
        });
      }
    }
    return foundSites;
  }

  _isBuildingAssigned(activeQuestSites, parentQuestPlaces, location, summary, buildingKey) {
    // Guild halls are excluded from the same-building check (N0B10Y03:
    // the questor's hall hosts the quest's own action)
    if (summary.buildingType !== BT_GUILDHALL) {
      for (const place of parentQuestPlaces) {
        if (place.siteDetails?.siteType === SITE_TYPES.Building
          && place.siteDetails.mapId === location.mapTableData.mapId
          && place.siteDetails.buildingKey === buildingKey) return true;
      }
    }
    for (const site of activeQuestSites) {
      if (site.siteType === SITE_TYPES.Building
        && site.mapId === location.mapTableData.mapId
        && site.buildingKey === buildingKey) return true;
    }
    return false;
  }

  /** GetBuildingName (:1296-1325): a residence draws a random surname
   *  ("The %s Residence"); Redguards have a single name - and C#'s
   *  fallback rolls Range(0, 1), which is ALWAYS 0/Male (quirk kept);
   *  everything else reads the fixed building name. */
  _getBuildingName(world, buildingType, location, summary) {
    if (isResidence(buildingType)) {
      const bank = getNameBankOfRegion(location.regionIndex);
      let name = surname(bank);
      if (!name) name = firstName(bank, [GENDERS.Male, GENDERS.Female][this._range(1)] ?? GENDERS.Male);
      return THE_NAMED_RESIDENCE.replace('%s', name);
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
      const position = { x: obj.xPos * GLOBAL_SCALE, y: -obj.yPos * GLOBAL_SCALE, z: obj.zPos * GLOBAL_SCALE };
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
      const all = [...(sd.questSpawnMarkers ?? []), ...(sd.questItemMarkers ?? [])];
      if (all.length > 0) { sd.selectedMarker = all[this._range(all.length)]; return true; }
      return false;
    }
    let preferred = MARKER_TYPES.None;
    if (resource.isPerson || resource.isFoe || markerIndexPreference === MARKER_PREFERENCE.UseQuestMarker) preferred = MARKER_TYPES.QuestSpawn;
    else if (resource.isItem) preferred = MARKER_TYPES.QuestItem;

    const hasSpawn = !!sd.questSpawnMarkers?.length;
    const hasItem = !!sd.questItemMarkers?.length;
    if (preferred === MARKER_TYPES.QuestSpawn && hasSpawn) {
      sd.selectedMarker = markerIndex === -1 ? sd.questSpawnMarkers[this._range(sd.questSpawnMarkers.length)] : sd.questSpawnMarkers[markerIndex];
    } else if (preferred === MARKER_TYPES.QuestItem && hasItem) {
      sd.selectedMarker = markerIndex === -1 ? sd.questItemMarkers[this._range(sd.questItemMarkers.length)] : sd.questItemMarkers[markerIndex];
    } else if (hasSpawn) {
      sd.selectedMarker = sd.questSpawnMarkers[this._range(sd.questSpawnMarkers.length)];
    } else if (hasItem) {
      sd.selectedMarker = sd.questItemMarkers[this._range(sd.questItemMarkers.length)];
    }
    return true;
  }

  /** AssignQuestResource (:448-540): validate markers, resolve the
   *  resource, cull it from other sites, and pin its symbol to the
   *  selected (or indexed) marker. The scene halves (hot-place when
   *  the player is already inside, hot-remove of a stood behaviour)
   *  ride the world seam's layout wiring (Q4). */
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
    this.parentQuest.hooks?.world?.onResourceAssigned?.(this, resource);
  }

  // ---- player checks (Place.cs:545-560, 1590-1656) ----

  /** IsPlayerHere: building compares the entered building's key, town
   *  needs outside + the location rect, dungeon compares mapId. */
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

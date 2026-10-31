// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPixels, arenaPlaceOnPixel, arenaPlaces, arenaPlacesVersion } from '../world/arenaPlaces.js';
import { arenaRoadTowns, arenaTemplateOf, synthesizeArenaLocation, arenaPlaceId } from '../world/arenaLocations.js';
import { bayLand, countryMayStandAt, countryName, countryNameSeed, countryRates, countryStandsAt, createCountryGround, synthesizeCountryLocation, countryOrdinal, countryPlaceId, countryPixelOfId, countryLocationIndex } from '../world/tamrielCountry.js';
import { capitalOnPixel, capitalPixel, synthesizeCapitalLocation, CAPITALS, capitalPlaceId, capitalSliceOrdinal, capitalSpanPixels, capitalsVersion, imperialOutskirts, capitalCentrePixel, capitalSlicePort } from '../world/tamrielCapitals.js';
import { createTamrielRoadsHost } from './tamrielRoadsHost.js';
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { getWorldClimateSettings, REGION_NAMES, LOCATION_TYPES } from '../formats/mapsFile.js';
import { isWaterPixel } from '../ui/overworldModel.js';
import { LAIR_TYPES, lairBlockCount, lairCellOf, lairLayout, lairMayStandAt, lairName, lairNameSeed, lairPlaceId, lairSite, lairStandsAt, synthesizeLairLocation } from '../world/tamrielDungeons.js';
import { provinceKeyBeyondBay, tamrielLandVersion, PROVINCE_OF_ID } from '../world/tamriel/tamrielLand.js';
import { regionOfTheatre } from '../formats/mapsTables.js';
import { THEATRE_KEYS } from '../world/worldWide/worldGrid.js';   // AUDIT FOUNDATION A1: a capital's province's theatre
import { replaceSeats, tamrielSeatsOf } from '../systems/town/townSeats.js';
import { inBay, inBay as onBayPixel, tamrielFit } from '../world/tamriel/tamrielFrame.js';   // AUDIT TESA II P7: the registry's live list's stamp
import { provinceNameBank } from '../world/tamrielPeople.js';
import { rollSpec } from '../world/tamrielRoads.js';
import { outlineTownLocation, townOutlineBlockJson } from '../world/townOutline.js';   // TOWN-SHAPES TS3: a town past the Bay laid as its own outline of blocks
import { standTownWall, setTownWallPaths, townWallPathsReader } from '../world/townWalls.js';   // TOWN-SHAPES TS4: a city past the Bay walled on its outline; ROAD-FOLLOW: its gates where its roads come in
import { startLairSites } from '../systems/starts/startSite.js';
import { pastBayPlaceRows, PAST_BAY_SOURCE } from '../world/pastBayRows.js';
import { settlementPlaceRows, SETTLEMENTS_SOURCE } from '../world/settlement/settlementPlaces.js';   // RMB-CONTRACTS RMBC5: the settlements on the registry   // AUDIT TESA II P7: the places past the Bay on the world's registry
import { pastBayPlacesIn } from '../world/pastBayPlaces.js';   // WW7-7: a pixel the roads past the Bay rolled a place on is dry
import { nearestSafePlace } from '../systems/deathRespawn.js';   // AUDIT TESA II P2/P3: the nearest town of the world
import { townClimateAt } from '../world/urban/townLook.js';   // URBANIZER U1: a town past the Bay in its province's own stone (the Imperial City aside)
import { locationKeyOf } from '../world/locationKey.js';   // BAY-LEFT-B: a capital's MapTable key its own buildings'
import { fabricSliceSites } from '../world/imperialFabricBuildings.js';   // BAY-LEFT-B: and the Imperial City's fabric's
import { createAtlasHost } from './atlasHost.js';   // FOUNDATION F1: the world's places read whole
import { homeListings } from '../net/homeListingLaw.js';   // FOUNDATION F3: the property rows the atlas checks
import { filedClimate, filedHeight } from '../world/land/landLayer.js';   // AUDIT FOUNDATION II L1: the Bay's rates read the files as they came
import { placeOfRow } from '../world/worldWide/worldPlaces.js';   // FOUNDATION F1: a mod's addition as the registry would read it
import { bayPlaceRows } from '../world/worldWide/bayPlaces.js';
import { worldDataDoorOpen } from '../formats/worldData/worldDataReplacement.js';   // FOUNDATION F1: a check when the door serves edits

/** @param {any} host */
export function createTamrielPlaces(host) {
  const {
    _arenaTemplates, _capitalBase, _capitalNames, _countryCounts, _countryTemplates, _lairCounts, _lairPools,
    _lairTemplates, arenaJoinLand, arenaRoadsLanded, arenaStands, blocks, locationIndex, maps, tamrielLand, terrainGen,
    townSeats, woodsBytes, worldPlaces, zoneHalls
  } = host;
  /** TESA2 (world/arenaLocations.js): THE PLACE A PIXEL PAST THE BAY STANDS - the place standing on it (world/arenaPlaces.js
   *  arenaPlaceOnPixel: TESA12, the port's own, on the trace) cloned off the game's own rows under its own id, name and
   *  index, the region and the climate the pixel's (TAMRIEL2: the province's climate; the region the clamp's until TESA3) -
   *  stood in the index once, or null: no place there, or none stood yet (the trace still to land; the sweep builds the
   *  pixel again when it does). A place the land no longer stands there leaves the index here. */
  /** TOWN-SHAPES TS3 (world/townOutline.js): a block by its name for a clone's outline - the game's own (past the world-data
   *  door: every client keeps the same cells) and as the layout reads it. */
  const blockOf = { classicOf: (name) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(name))), servedOf: (name) => blocks.getBlockByName(name) };
  function arenaLocationAt(px, py) {
    registerTamrielPlaces();   // WW7: the registry kept with what stands the places (a version's compare)
    const key = `${px},${py}`;
    const place = arenaPlaceOnPixel(px, py);
    const had = locationIndex.get(key);
    if (had?.capital) return capitalLocationAt(px, py);   // AUDIT-TESA A4-F2: a capital's pixel is the capital's - never cloned over
    if (had?.arena) {
      if (place && had.arena.provinceIndex === place.provinceIndex && had.arena.id === place.id && had.arena.port === !!place.port) return had;   // TESA6: a city made a port is cloned again
      host._locIndexGen += 1;
      locationIndex.delete(key);
    }
    if (!place) return null;
    const template = arenaTemplateOf(_arenaTemplates, place);
    if (!template) return null;
    const loc = arenaCloneOf(template, place, px, py);
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** An Arena place's clone on (px, py) - NOT stood (AUDIT FOUNDATION II A1: the atlas's check reads it; arenaLocationAt
   *  stands the same clone). */
  function arenaCloneOf(template, place, px, py) {
    const regionIndex = maps.getRegionIndexAt(px, py);
    const loc = outlineTownLocation(synthesizeArenaLocation(template, place, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: townClimateAt(px, py, getWorldClimateSettings(maps.getClimateIndex(px, py))) }), blockOf, { round: imperialOutskirts(px, py) });   // TS5: the Imperial City's outskirts round
    if (loc.outline?.walled) standTownWall(loc, template.exterior.exteriorData.blockNames, blockOf, townOutlineBlockJson);   // TOWN-SHAPES TS4; TS7: what stands at its gates from the game's own blocks
    return loc;
  }
  /** TESA7 (world/tamrielCountry.js): THE COUNTRYSIDE'S RATES - each climate's chances, the Bay's count over the Bay's land
   *  (CLIMATE.PAK and WOODS.WLD's water law, ui/overworldModel.js isWaterPixel), worked out at the first pixel past the Bay
   *  that asks (the Bay's half a million pixels read once). */
  const _pastBay = { countryRates: null, lairRates: null, bayLand: null, countryRoll: null, lairRoll: null };   // TESA7-8: each made once, when first asked (a holder, so the place law moves out whole - scenes/tamrielPlacesHost.js)
  const bayLandNow = () => (_pastBay.bayLand ??= bayLand((x, y) => filedClimate(x, y, maps.getClimateIndex(x, y)), (x, y, c) => isWaterPixel(c, filedHeight(x, y, host.woods.getHeightMapValue(x, y)))));   // AUDIT FOUNDATION II L1: the Bay as it came
  const countryRatesNow = () => (_pastBay.countryRates ??= countryRates(_countryCounts, bayLandNow()));
  const lairRatesNow = () => (_pastBay.lairRates ??= countryRates(_lairCounts, bayLandNow(), LAIR_TYPES));   // TESA8: the lairs' over the same land
  const _countryGround = _countryTemplates ? createCountryGround(host.woods) : null;
  /** TESA14: the world the roll reads past the Bay - the climate, the ground's bytes and its dry plateau - and the two
   *  rolls' own rates and templates, made at the first ask (the rates read the Bay's land once). WW7-7 (bible/03-World/
   *  World-Wide.md): a pixel the roads past the Bay rolled a place on (world/pastBayPlaces.js - their workers' roll, the one
   *  roll, its plateau read there) is dry: its plateau is not summed again (the dear part - a 129 x 129 kernel, ~1 ms a
   *  place; the living world's squares past the Bay ask sixty places at a time). The same answer, read once. */
  const _pastBayAt = { climateAt: (x, y) => maps.getClimateIndex(x, y), heightAt: (x, y) => host.woods.getHeightMapValue(x, y), ground: (x, y) => pastBayPlacesIn(x, y, x + 1, y + 1).length > 0 || _countryGround(x, y) };
  /** TESA7: THE COUNTRYSIDE'S ROLL ON A PIXEL PAST THE BAY - world/tamrielCountry.js countryStandsAt (its kind and
   *  template on dry ground clear of the sea's edge; TESA14: a road no longer takes its pixel, the places are the roads'
   *  own nodes and obstacles), named off its province's people (world/tamrielPeople.js, the clamp's region's where it has
   *  none) - `{ pick, regionIndex, name }`, or null. TESA13: it reads the world and writes nothing - TESA15: the roads'
   *  workers roll it as numbers (world/tamrielRoads.js rollTypeAt), and the held map reads the places they laid. */
  function countryRollAt(px, py) {
    if (!_countryTemplates) return null;
    const pick = countryStandsAt(_pastBay.countryRoll ??= { ..._pastBayAt, rates: countryRatesNow(), templates: _countryTemplates }, px, py);
    if (!pick) return null;
    const regionIndex = maps.getRegionIndexAt(px, py);
    return { pick, regionIndex, name: countryName(pick.type, provinceNameBank(provinceKeyBeyondBay(px, py)) ?? getNameBankOfRegion(regionIndex), countryNameSeed(px, py)) };
  }
  /** TESA7: THE PLACE THE COUNTRYSIDE STANDS ON A PIXEL PAST THE BAY that no Arena place takes - its roll (countryRollAt)
   *  cloned under its own id, name and index, the region and climate the pixel's - stood in the index once (and again when
   *  what the pixel stands moves: the trace landing, a road), or null. */
  function countryLocationAt(px, py) {
    if (!_countryTemplates) return null;
    const key = `${px},${py}`;
    const had = locationIndex.get(key);
    const at = countryRollAt(px, py);
    if (had?.country && !had.country.dungeon) {   // TESA8: a lair is lairLocationAt's
      if (at && had.country.type === at.pick.type && had.country.template === at.pick.template.mapTableData?.mapId && had.name === at.name) return had;
      host._locIndexGen += 1;
      locationIndex.delete(key);
    }
    if (!at) return null;
    const { pick, regionIndex, name } = at;
    const made = synthesizeCountryLocation(pick.template, { px, py, type: pick.type, name }, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: townClimateAt(px, py, getWorldClimateSettings(maps.getClimateIndex(px, py))) });
    if (!made) return null;
    const loc = outlineTownLocation(made, blockOf, { round: imperialOutskirts(px, py) });   // TOWN-SHAPES TS3; TS5: the Imperial City's outskirts round
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** TESA8 (world/tamrielDungeons.js): THE LAIRS' ROLL ON A PIXEL PAST THE BAY - lairStandsAt (its cell's one site, the
   *  cell's roll, the countryside's ground law; TESA14: no road takes its pixel), named off its province's people or its
   *  dungeon type's monster bank - `{ c, pick, regionIndex, dungeonType, name }`, or null. TESA13: it reads the world and
   *  writes nothing. */
  function lairRollAt(px, py) {
    if (!_lairTemplates) return null;
    const at = lairStandsAt(_pastBay.lairRoll ??= { ..._pastBayAt, rates: lairRatesNow(), templates: _lairTemplates }, px, py);
    if (!at) return null;
    const { c, pick } = at, regionIndex = maps.getRegionIndexAt(px, py), dungeonType = pick.template.mapTableData?.dungeonType;
    return { c, pick, regionIndex, dungeonType, name: lairName(pick.type, dungeonType, provinceNameBank(provinceKeyBeyondBay(px, py)) ?? getNameBankOfRegion(regionIndex), lairNameSeed(c)) };
  }
  /** TESA8: a rolled lair's own plan off its dungeon type's blocks (lairLayout), or null - a lair with none stands nowhere. */
  const lairBlocksOf = (at) => lairLayout(_lairPools.get(at.dungeonType), lairBlockCount(at.pick.template), lairPlaceId(at.c));
  /** TESA8: THE LAIR A PIXEL PAST THE BAY STANDS that neither Arena nor the countryside takes - its roll (lairRollAt) laid
   *  out to its plan (lairBlocksOf) and cloned under its own id, name and index - stood in the index once, and again when
   *  what the pixel stands moves. */
  function lairLocationAt(px, py) {
    const key = `${px},${py}`, had = locationIndex.get(key), at = lairRollAt(px, py);
    const same = !!had?.country?.dungeon && !!at && had.country.cell === at.c && had.country.template === at.pick.template.mapTableData?.mapId && had.name === at.name;
    if (same) return had;
    if (had?.country?.dungeon) { host._locIndexGen += 1; locationIndex.delete(key); }   // its cell's roll moved (the trace landing, a road): out
    const loc = at ? lairCloneOf(at, px, py) : null;
    if (!loc) return null;
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** TESA8: a rolled lair laid out to its plan and cloned under its own id, name and index - NOT stood (START2: the start
   *  host weighs a candidate's dungeon before any stands); null for a lair with no plan. */
  function lairCloneOf(at, px, py) {
    const blocks = lairBlocksOf(at);
    if (!blocks) return null;
    const { c, pick, regionIndex, name } = at;
    return synthesizeLairLocation(pick.template, { c, px, py, type: pick.type, name, blocks }, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) });
  }
  /** A pixel a lair may stand on as the build stands it: no capital, Arena place or countryside place first (world.js
   *  _locationToBuild) - START2's start lairs and AUDIT RELEASE R2-5's quest lairs. */
  const lairFree = (x, y) => !capitalOnPixel(x, y) && !(_arenaTemplates && arenaPlaceOnPixel(x, y)) && !countryRollAt(x, y);
  /** START2 (systems/starts/startSite.js): A PROVINCE'S START DUNGEON - the first of its candidates (the kinds its story
   *  wants, nearest its capital first; then any lair in reach) whose dungeon `usable` takes, stood in the index as its
   *  pixel's build stands it; or null - the land past the Bay with no lairs, its capital on no pixel, none in reach. */
  function startLairAt(start, usable = () => true) {
    const cap = _lairTemplates ? CAPITALS.find((k) => k.key === start?.capital) : null;
    const centre = cap ? capitalPixel(cap) : null;
    const rollAt = (x, y) => { const at = lairRollAt(x, y); return at && lairBlocksOf(at) ? { type: at.pick.type, dungeonType: at.dungeonType } : null; };
    for (const site of startLairSites(start, { centre, rollAt, free: lairFree, provinceAt: provinceKeyBeyondBay })) {
      const at = lairRollAt(site.px, site.py), loc = at ? lairCloneOf(at, site.px, site.py) : null;
      if (loc && usable(loc)) return lairLocationAt(site.px, site.py);
    }
    return null;
  }
  /** TESA14 (scenes/tamrielRoadsHost.js): THE ROADS PAST THE BAY - the Bay's own road law at its own scale over every place
   *  past it, a region at a time on the roads' own workers, each region's layer to the kernels as it lands. Its inputs:
   *  Arena's places that stand as towns (a capital's own place is its gates while the capitals stand), the roll's numbers
   *  (the same roll the build and the map read), the capitals; TESA15: every pixel an Arena place with its template holds
   *  (routed round, and no rolled place on it). The land past the Bay streamed. */
  const _roadsMade = { towns: null, townsFor: null, spec: null };   // TESA14: the towns the roads run between (for the places standing then), the roll's spec
  const tamrielRoadTowns = () => {
    const now = _arenaTemplates ? arenaPixels() : null;
    if (now !== _roadsMade.townsFor) { _roadsMade.townsFor = now; _roadsMade.towns = arenaRoadTowns(now && { stood: now.stood.filter((p) => !(p.pinned && _capitalBase) && arenaTemplateOf(_arenaTemplates, p)) }) ?? []; }
    return _roadsMade.towns ?? [];
  };
  const tamrielRoadsSpec = () => (_roadsMade.spec ??= rollSpec(_countryTemplates
    ? { countryRates: countryRatesNow(), countryTemplates: _countryTemplates, lairRates: lairRatesNow(), lairTemplates: _lairTemplates, lairPools: _lairPools }
    : { countryRates: new Map(), countryTemplates: new Map(), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() }));
  const tamrielRoadHeld = () => (_arenaTemplates ? arenaPixels()?.stood.filter((p) => arenaTemplateOf(_arenaTemplates, p)).map((p) => ({ x: p.bx, y: p.by })) : null) ?? [];
  const _tamrielRoads = tamrielLand ? createTamrielRoadsHost({ terrainGen, woodsBytes, heightAt: (x, y) => host.woods.getHeightMapValue(x, y), joinLand: arenaJoinLand, onLanded: arenaRoadsLanded,
    standing: { pixels: arenaPixels, towns: tamrielRoadTowns, spec: tamrielRoadsSpec, capitals: () => !!_capitalBase, held: tamrielRoadHeld } }) : null;
  // ROAD-FOLLOW (world/townWalls.js): a walled city's gates stand where its pixel's painted roads come in - the Bay's network
  // as this thread holds it, the roads past the Bay once their regions have landed; a wall waits for them. A host that
  // paints no roads (no terrain generator) hands none: the template's gates, as before
  setTownWallPaths(terrainGen ? townWallPathsReader({ bay: () => terrainGen.roads(), landedIn: _tamrielRoads ? (x0, y0, x1, y1) => _tamrielRoads.landedIn(x0, y0, x1, y1) : null }) : null);
  /** TESA15 (world/pastBayPlaces.js): a place's name the held map's hover says - the places are the roads' regions'. */
  const tamrielPlaceName = (px, py) => countryRollAt(px, py)?.name ?? lairRollAt(px, py)?.name ?? '';
  /** TESA10 (world/tamrielCapitals.js): THE CAPITAL A PIXEL PAST THE BAY STANDS - its own, laid out by its plan (its
   *  districts of the game's city blocks round the port's own landmarks), the region and climate the pixel's, and where
   *  Arena's place of its name stands on it (world/arenaPlaces.js standArenaPixels' pin) that place's slot (the Arena
   *  sweep and the port readers read it) - stood in the index once, and again when the place on it changes; or null.
   *  TESA11: a capital over several pixels stands a slice on each (capitalOnPixel's `s`), its own location. */
  function capitalLocationAt(px, py) {
    registerTamrielPlaces();   // WW7
    const at = _capitalBase ? capitalOnPixel(px, py) : null;
    const key = `${px},${py}`, had = locationIndex.get(key);
    const place = at && _arenaTemplates ? arenaPlaceOnPixel(px, py) : null;
    const slot = place ? Object.freeze({ province: place.province, provinceIndex: place.provinceIndex, id: place.id, kind: place.kind, port: !!place.port }) : null;
    if (had?.capital) {
      if (at && had.capital.k === at.k && had.capital.s === at.s && (had.arena?.id ?? null) === (slot?.id ?? null) && (had.arena?.provinceIndex ?? null) === (slot?.provinceIndex ?? null)
        && !!had.arena?.port === !!slot?.port   // AUDIT-TESA A4-F2: its place made a port, its slot too
        && (had.exterior?.exteriorData?.portTownAndUnknown !== 0) === capitalSlicePort(at.k, at.s, capitalPinPort(at.k))) return had;   // BAY-LEFT-SEA: and its harbour's port word (its canal opened)
      host._locIndexGen += 1;
      locationIndex.delete(key);
    }
    if (!at) return null;
    const loc = capitalCloneOf(at, px, py, slot);
    if (!loc) return null;
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** BAY-LEFT-SEA (world/tamrielCapitals.js capitalSlicePort): whether the place of capital `k`'s name pinned on its centre is
   *  a port - the registry's own read (world/pastBayRows.js: the places the model stands, its centre's), so a capital's
   *  harbour slice is a port to its own byte exactly where the registry calls it one. */
  function capitalPinPort(k) {
    const c = capitalCentrePixel(k);
    return !!(c && _arenaTemplates && arenaPixels()?.byPixel.get(`${c.px},${c.py}`)?.port);
  }
  /** A capital's slice laid out by its plan on (px, py) - NOT stood (AUDIT RELEASE R2-5f: the quest layer reads a slice's
   *  buildings by kind before it stands one; capitalLocationAt stands the same clone). */
  function capitalCloneOf(at, px, py, slot) {
    const regionIndex = regionOfTheatre(THEATRE_KEYS.indexOf(CAPITALS[at.k]?.province));   // AUDIT FOUNDATION A1: its capital's province, as the registry's row (pastBayRows.js) - a harbour on the picture's sea read 0
    const loc = synthesizeCapitalLocation(at, { base: _capitalBase, names: _capitalNames, blockOf: (name) => blocks.getBlockByName(name), px, py, arena: slot, pinPort: capitalPinPort(at.k),   // BAY-LEFT-SEA: its harbour's port word
      where: { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: at.k === 0 ? getWorldClimateSettings(maps.getClimateIndex(px, py)) : townClimateAt(px, py, getWorldClimateSettings(maps.getClimateIndex(px, py))) } });
    // BAY-LEFT-B (world/locationKey.js): its MapTable key its own buildings' - its blocks', and the Imperial City's fabric's
    // (world/imperialFabricBuildings.js fabricSliceSites) - never the city it borrowed its shape from (the talk's regional
    // "Where is" reads it: answerPipeline.js checkLocationKeyForRegionalBuilding)
    if (loc) loc.mapTableData = { ...loc.mapTableData, key: locationKeyOf(CAPITALS[at.k]?.family ? [...(loc.exterior?.buildings ?? []), ...fabricSliceSites(at.s)] : loc.exterior?.buildings ?? []) };
    return loc;
  }
  /** BAY-LEFT-B: A PLACE'S MapTable KEY (its buildings' directory - world/locationKey.js) as its location carries it, read
   *  without standing it: the stood location's own; else an Arena place's, a country place's and a lair's template's (the
   *  clone keeps it - pinned equal to every stood one's on the freeware); a capital's slice none until it stands (its
   *  buildings' are read as it stands - the quest layer's province warm stands them in idle time); null for none. */
  function tableKeyAt(px, py) {
    const had = locationIndex.get(`${px},${py}`);
    if (had) return had.mapTableData?.key ?? null;
    if (onBayPixel(px, py) || (_capitalBase && capitalOnPixel(px, py))) return null;
    const place = _arenaTemplates ? arenaPlaceOnPixel(px, py) : null;
    const template = place ? arenaTemplateOf(_arenaTemplates, place) : countryRollAt(px, py)?.pick?.template ?? lairRollAt(px, py)?.pick?.template ?? null;
    return template?.mapTableData?.key ?? null;
  }
  /** AUDIT RELEASE R2-5f (scenes/quest/questProvinceSites.js sliceIndexAt): the capital slice on (px, py) as the build
   *  stands it - the stood one, else its clone, not stood; or null. */
  function capitalSliceAt(px, py) {
    const had = locationIndex.get(`${px},${py}`);
    if (had?.capital) return had;
    const at = _capitalBase ? capitalOnPixel(px, py) : null;
    if (!at) return null;
    const place = _arenaTemplates ? arenaPlaceOnPixel(px, py) : null;
    return capitalCloneOf(at, px, py, place ? Object.freeze({ province: place.province, provinceIndex: place.provinceIndex, id: place.id, kind: place.kind, port: !!place.port }) : null);
  }
  // WW7 (2026-10-25, the owner: "We also need to fully integrate our living world into the entirety of tamriel";
  // bible/03-World/World-Wide.md WW7): TESA'S PLACES IN THE WORLD'S REGISTRY (world/worldWide/worldPlaces.js) - every
  // system that reads the world's places (the living world's index, its trips and lanes, the gates' scans, the zone's
  // halls) read none past the Bay, and a town there stood its LivingTown on a bare record. Four providers after the Bay's,
  // in the build's own order (_locationToBuild: a capital, an Arena place, the countryside, a lair): the capitals' slices
  // and Arena's places as lists (a capital's pixel the capital's - the first list holds it), the countryside and the
  // lairs as pixel providers (the same rolls the build reads). Registered again when the land, Arena's standing or the
  // capitals' move; only where the land past the Bay stands (as every place past the Bay is).
  const TESA_SOURCES = Object.freeze({ country: 'tesa-country', lairs: 'tesa-lairs' });   // TESA x AUDIT TESA II: the capitals and Arena's places the live list's (PAST_BAY_SOURCE, below)
  const exteriorSize = (loc) => ({ w: loc?.exterior?.exteriorData?.width ?? 1, h: loc?.exterior?.exteriorData?.height ?? 1 });
  /** The countryside's place on a pixel past the Bay, as its location stands it. */
  function countryRow(px, py) {
    if (inBay(px, py)) return null;
    const at = countryRollAt(px, py);
    return at && { mapId: countryPlaceId(countryOrdinal(px, py)), name: at.name, px, py, type: at.pick.type, ...exteriorSize(at.pick.template), location: countryLocationIndex(countryOrdinal(px, py)) };   // WW7-5: its location's index
  }
  /** A lair on a pixel past the Bay - a dungeon the living world's divers may go down. */
  function lairRow(px, py) {
    if (inBay(px, py)) return null;
    const at = lairRollAt(px, py);
    return at && { mapId: lairPlaceId(at.c), name: at.name, px, py, type: at.pick.type, dungeonType: at.dungeonType ?? 0, hasDungeon: true };
  }
  /** WW7-3: a province key's region (WW-R: its theatre's, PROVINCE_OF_ID's numbering). */
  const regionOfProvince = (key) => regionOfTheatre(Number(Object.keys(PROVINCE_OF_ID).find((id) => PROVINCE_OF_ID[id] === key)));
  /** WW7-3 (systems/town/townSeats.js tamrielSeatsOf): the places past the Bay the seats stand at - each capital's centre
   *  slice (its province's region), and each Arena city-state on the trace but one a capital's pixel holds. */
  function seatPlaces() {
    const capitals = [];
    for (let k = 0; _capitalBase && k < CAPITALS.length; k++) {
      const at = capitalSpanPixels(k).find(({ x, y }) => { const c = capitalOnPixel(x, y); return c?.k === k && capitalSliceOrdinal(CAPITALS[k], c.s) === 0; });
      if (at) capitals.push({ key: capitalPlaceId(k, 0), name: CAPITALS[k].name, px: at.x, py: at.y, region: regionOfProvince(CAPITALS[k].province) });
    }
    const cities = (_arenaTemplates ? arenaPixels()?.stood ?? [] : []).filter((p) => p.kind === 'city-state' && !capitalOnPixel(p.bx, p.by))
      .map((p) => ({ key: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, region: maps.getRegionIndexAt(p.bx, p.by) }));
    return { capitals, cities };
  }
  let _registered = '';
  /** TESA's places into the registry, again only when what stands them moved; true when it registered. */
  function registerTamrielPlaces() {
    if (!worldPlaces || !tamrielLand) return false;
    const key = `${tamrielLandVersion()}|${arenaPlacesVersion()}|${capitalsVersion()}`;
    if (key === _registered) return false;
    _registered = key;
    if (_countryTemplates) worldPlaces.registerPixels(TESA_SOURCES.country, countryRow, countryPixelOfId);   // AUDIT FB1029g P1: its id read back to its pixel
    if (_lairTemplates) worldPlaces.registerPixels(TESA_SOURCES.lairs, lairRow);
    if (townSeats) replaceSeats(townSeats, 'tesa', tamrielSeatsOf(seatPlaces()));   // WW7-3: the seats past the Bay with their places
    return true;
  }
  let arenaSaid = null;
  /** TESA1: the places onto the trace that just landed (said once a model) - WW7: and into the world's registry. */
  const arenaWarm = () => {
    registerTamrielPlaces();
    const m = arenaStands ? arenaPlaces() : null;
    if (!m || m === arenaSaid) return;   // said once a model
    arenaSaid = m;
    console.log(`[places] ${m.places.length} places past the Bay on the picture: ${m.places.filter((p) => p.kind === 'city-state').length} cities (${m.places.filter((p) => p.snapped > 0).length} snapped onto their province's land, ${m.lost.length} left off), ${m.places.filter((p) => p.kind !== 'city-state').length} towns and villages`);
  };
  /** AUDIT TESA II P7 (bible/03-World/World-Wide.md "Folded into TESA"): THE PLACES PAST THE BAY ON THE WORLD'S REGISTRY -
   *  the capitals and the model's places that stand a location (world/pastBayRows.js), a LIVE list (world/worldWide/
   *  worldPlaces.js registerLive): made again whenever the places' pixels, the fit or the land move under them, so every
   *  reader of the registry - the living world's towns, the world's ports, the zone's halls - sees the towns the build
   *  stands. The countryside and the lairs are no list (a pixel's roll): not registered (a district's walk through the roll
   *  is 276 ms on this thread - the registry's inArea and near). */
  if (worldPlaces && (_arenaTemplates || _capitalBase)) {
    worldPlaces.registerLive(PAST_BAY_SOURCE, {
      stamp: () => [_arenaTemplates ? arenaPixels() : null, tamrielFit(), tamrielLandVersion()],
      rows: () => pastBayPlaceRows({ pixels: _arenaTemplates ? arenaPixels() : null, templateOf: (p) => arenaTemplateOf(_arenaTemplates, p), capitals: !!_capitalBase }),   // WW7-5: each its location's index
    });
  }
  // RMB-CONTRACTS RMBC5: THE SETTLEMENTS (world/settlement/settlementPlaces.js) - after the places past the Bay, so a town of
  // theirs keeps its pixel; no location index (no raid's town), no RMB location behind them (the pixel's worker lays them out)
  if (worldPlaces) worldPlaces.registerLive(SETTLEMENTS_SOURCE, { stamp: () => [tamrielFit()], rows: () => settlementPlaceRows() });
  /** AUDIT TESA II Z7: whether the countryside or a lair may stand on a pixel past the Bay - their rolls' own pick and the
   *  beach line (tamrielCountry.js countryMayStandAt, tamrielDungeons.js lairMayStandAt: no plateau summed, no name drawn;
   *  every pixel either stands, and the few under the beach it would): the zone's halls keep off them and their
   *  neighbours as off every place (scenes/zoneHallsHost.js). */
  const pastBayRolledAt = (px, py) => !onBayPixel(px, py) && ((!!_countryTemplates && countryMayStandAt(_pastBay.countryRoll ??= { ..._pastBayAt, rates: countryRatesNow(), templates: _countryTemplates }, px, py))
    || (!!_lairTemplates && lairMayStandAt(_pastBay.lairRoll ??= { ..._pastBayAt, rates: lairRatesNow(), templates: _lairTemplates }, px, py)));
  if (_countryTemplates) zoneHalls?.standsToo(pastBayRolledAt);
  /** AUDIT TESA II P2/P3/Z3: THE NEAREST TOWN OF THE WORLD to a map pixel - of the world's registry (the Bay's MAPS.BSA rows
   *  and the places past the Bay) and the countryside's towns and temples this session stood (the index's: no list of them
   *  exists), the nearest safe place (systems/deathRespawn.js nearestSafePlace) `accept` takes; or null. The one law the
   *  rise past the Bay, the open zone's rise and /unstuck ask - each had read MAPS.BSA's rows alone, a Bay town a
   *  continent away, or the index's towns within 48 pixels and else where the player fell (at sea, in the water).
   *  BAY-LEFT-B: and Project Legacy's birth in a house with no seat (systems/legacy/places.js nearestTownAnywhere) - so a
   *  countryside town carries its name, its region and its map id, as the registry's places do. */
  const nearestTownOf = (/** @type {{ x: number, y: number }} */ px, /** @type {((hit: any) => boolean)|null} */ accept = null) => nearestSafePlace([worldPlaces?.all() ?? [], countryTowns()], px, accept);
  const countryTowns = () => {
    const out = [];
    for (const l of locationIndex.values()) if (l?.country && !l.country.dungeon) out.push({ type: l.mapTableData?.locationType, dungeonType: l.mapTableData?.dungeonType, px: l.country.px, py: l.country.py, name: l.name, region: l.regionIndex, mapId: l.mapTableData?.mapId });
    return out;
  };
  /** AUDIT RELEASE R2-5 (scenes/quest/questProvinceSites.js): THE LAIRS A QUEST PAST THE BAY MAY BE SENT TO - the nearest
   *  `count` lairs the build stands (its cell's roll, a plan of blocks, its pixel free of the places stood first) within
   *  `reach` of a pixel (the travel reckoning's longest axis; a tie by the cell), north-west first:
   *  `{ mapId, name, px, py, type, dungeonType }`. BOUNDED BY COUNT: at most `rolls` cells are read a call, nearest first,
   *  whether kept or not - so the answer is the pixel's alone, the same on every client whatever it has read before
   *  (AUDIT RELEASE R2-5d: the bound had counted first-time rolls only, and a warm client read further); a cell never read
   *  is a roll (its plateau, its plan - about 4 ms), kept. `lairsNear.rolled` is the last call's first-time rolls. */
  function lairsNear(px, py, reach, count = Infinity, rolls = Infinity) {
    const out = [];
    lairsNear.rolled = 0;
    if (!_lairTemplates) return out;
    const cells = [], seen = new Set();
    for (let y = py - reach; y <= py + reach; y++) {
      for (let x = px - reach; x <= px + reach; x++) {
        const c = lairCellOf(x, y);
        if (c < 0 || seen.has(c)) continue;
        seen.add(c);
        const s = lairSite(c), d = Math.max(Math.abs(s.px - px), Math.abs(s.py - py));
        if (!inBay(s.px, s.py) && d <= reach) cells.push({ c, s, d });
      }
    }
    cells.sort((a, b) => a.d - b.d || a.c - b.c);
    let read = 0;
    for (const { c, s } of cells) {
      if (out.length >= count || read >= rolls) break;
      read++;
      if (!lairCellKept(c)) lairsNear.rolled++;
      const row = lairOfCell(c, s);
      if (row) out.push(row);
    }
    return out.sort((a, b) => a.py - b.py || a.px - b.px);
  }
  lairsNear.rolled = 0;
  /** A cell's lair row as lairsNear reads it, or null - kept while what stands the places is (the roll's plateau is a
   *  millisecond a pixel; a questor a pixel over asks the same cells). */
  const _lairCells = { key: '', rows: new Map() };
  const lairCellKept = (c) => {
    const key = `${tamrielLandVersion()}|${arenaPlacesVersion()}|${capitalsVersion()}`;
    if (key !== _lairCells.key) { _lairCells.key = key; _lairCells.rows.clear(); }
    return _lairCells.rows.has(c);
  };
  function lairOfCell(c, s) {
    if (lairCellKept(c)) return _lairCells.rows.get(c);
    const at = lairRollAt(s.px, s.py);
    const row = at && lairBlocksOf(at) && lairFree(s.px, s.py) ? { mapId: lairPlaceId(at.c), name: at.name, px: s.px, py: s.py, type: at.pick.type, dungeonType: at.dungeonType ?? 0 } : null;
    _lairCells.rows.set(c, row);
    return row;
  }
  /** LAIR-WORLD (2026-10-26, the owner: "with revenants and their lairs, this will work everywhere correct?"; asked, "Fix
   *  both in this PR"): THE LAIR A PIXEL PAST THE BAY HOLDS, as the build stands it - its cell's one site (lairSite), rolled
   *  and planned, on a pixel no capital, Arena place or countryside place takes first (lairOfCell, lairsNear's own row):
   *  `{ mapId, name, px, py, type, dungeonType }`, or null - on the Bay, off a cell's site, or none stands. Kept with the
   *  cells, the same on every client. The revenants' lairs (scenes/lairHost.js) and the boards' dungeons (world.js
   *  createBountyHost's dungeonAt) read it past the Bay as they read MAPS.BSA's rows on it. */
  function lairAt(px, py) {
    if (!_lairTemplates || !Number.isInteger(px) || !Number.isInteger(py) || inBay(px, py)) return null;
    const c = lairCellOf(px, py);
    if (c < 0) return null;
    const s = lairSite(c);
    return s.px === px && s.py === py ? lairOfCell(c, s) : null;
  }
  /** LAIR-WORLD: that lair laid out as it would stand, NOT stood (lairCloneOf) - what the lair door lays to ask whether
   *  the player can go down into it (a graveyard's template may place no door: scenes/lairHost.js LAIR-DOOR); or null. */
  const lairCloneAt = (px, py) => { const at = lairAt(px, py) ? lairRollAt(px, py) : null; return at ? lairCloneOf(at, px, py) : null; };
  /** LAIR-WORLD: does a place stand on a pixel past the Bay - a capital's, an Arena place, the countryside's or a lair - as
   *  a board's hunt ground asks of it (the Bay's: the game's own rows' pixels). */
  const placeOnPixel = (px, py) => !lairFree(px, py) || !!lairAt(px, py);
  /** LAIR-WORLD: the stamp of what the places past the Bay stand on - a board keeps a town's ground and dungeons under it. */
  const placesVersion = () => `${tamrielLandVersion()}|${arenaPlacesVersion()}|${capitalsVersion()}`;
  /** AUDIT RELEASE R2-5e (scenes/quest/questProvinceSites.js; the owner: "Take care of exclusions and gaps"): THE
   *  COUNTRYSIDE A QUEST PAST THE BAY MAY BE SENT TO - the nearest `count` places the countryside's roll stands (TESA7:
   *  its hamlets, villages, farms, homes, inns, temples and shrines; on a pixel no capital or Arena place takes - the build
   *  stands those first) within `reach` of a pixel, north-west first: `{ mapId, name, px, py, type }`. BOUNDED BY COUNT
   *  and the same on every client: the pixels are read nearest first (a tie north-west first), a pixel the roll may stand a
   *  place on (countryMayStandAt - no plateau summed) is one of at most `rolls` read whole (its plateau, some 1 ms; kept a
   *  pixel), whatever was read before. `countryNear.rolled` is the last call's first-time rolls. */
  function countryNear(px, py, reach, count = Infinity, rolls = Infinity) {
    const out = [];
    countryNear.rolled = 0;
    if (!_countryTemplates) return out;
    const roll = (_pastBay.countryRoll ??= { ..._pastBayAt, rates: countryRatesNow(), templates: _countryTemplates });
    const pixels = [];
    for (let y = py - reach; y <= py + reach; y++) for (let x = px - reach; x <= px + reach; x++) if (!inBay(x, y)) pixels.push({ x, y, d: Math.max(Math.abs(x - px), Math.abs(y - py)) });
    pixels.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    let read = 0;
    for (const { x, y } of pixels) {
      if (read >= rolls || out.length >= count) break;
      if (!countryMayStandAt(roll, x, y) || capitalOnPixel(x, y) || (_arenaTemplates && arenaPlaceOnPixel(x, y))) continue;
      read++;
      const row = countryOfPixel(x, y);
      if (row) out.push(row);
    }
    return out.sort((a, b) => a.py - b.py || a.px - b.px);
  }
  countryNear.rolled = 0;
  /** A pixel's countryside row as countryNear reads it, or null - kept while what stands the places is. */
  const _countryPixels = { key: '', rows: new Map() };
  function countryOfPixel(x, y) {
    const key = `${tamrielLandVersion()}|${arenaPlacesVersion()}|${capitalsVersion()}`, k = `${x},${y}`;
    if (key !== _countryPixels.key) { _countryPixels.key = key; _countryPixels.rows.clear(); }
    if (_countryPixels.rows.has(k)) return _countryPixels.rows.get(k);
    countryNear.rolled++;
    const at = countryRollAt(x, y);
    const row = at ? { mapId: countryPlaceId(countryOrdinal(x, y)), name: at.name, px: x, py: y, type: at.pick.type } : null;
    _countryPixels.rows.set(k, row);
    return row;
  }
  /** The place the build stands on a pixel past the Bay, stood now - its own order (world.js _locationToBuild): a capital,
   *  an Arena place, the countryside, a lair; null on the Bay or where none stands. */
  const standAt = (px, py) => (inBay(px, py) ? null : capitalLocationAt(px, py) || (_arenaTemplates && arenaLocationAt(px, py)) || countryLocationAt(px, py) || lairLocationAt(px, py) || null);
  /** BAY-LEFT-MAPS: THE PLACE THE BUILD WOULD STAND ON A PIXEL PAST THE BAY, AS A ROW - read, never stood: the registry's
   *  (a capital's slice and an Arena place off its list; where the land stands, the countryside's and a lair's off its pixel
   *  providers), else the countryside's roll (countryRow) and the lair on its cell's site (lairAt) - the registry's own
   *  order, and the build's. Its region the pixel's, as the location stood there carries. Null on the Bay or where none
   *  would stand. */
  function rowAt(px, py) {
    if (inBay(px, py)) return null;
    registerTamrielPlaces();
    const row = worldPlaces?.at(px, py) ?? countryRow(px, py) ?? lairAt(px, py);
    return row ? { ...row, region: maps.getRegionIndexAt(px, py) } : null;
  }
  /** AUDIT RELEASE R2-5: what the quest layer's provinces read of the places past the Bay (scenes/quest/questProvinceSites.js
   *  createQuestProvinceSites' deps) - the registry, the politic map's region, the place the build stands on a pixel (its
   *  own order: a capital, an Arena place, the countryside, a lair), the lairs near one, and the registry kept up.
   *  BAY-LEFT-MAPS: and the row a pixel would stand (a place known there before it stands). */
  const provinceQuestPlaces = Object.freeze({
    worldPlaces, lairsNear, countryNear, refresh: registerTamrielPlaces, startLairAt, sliceAt: capitalSliceAt,   // R2-5f: a capital slice read before it stands   // START2's start lair rides with them (the quest layer's startSiteOfId)
    lairAt, lairCloneAt, placeOnPixel, version: placesVersion,   // LAIR-WORLD: a lair, a place and their stamp on a pixel past the Bay - the revenants' lairs and the boards' hunts
    tableKeyAt,   // BAY-LEFT-B: a place's MapTable key, for its province's table (the talk's regional "Where is")
    regionAt: (px, py) => maps.getRegionIndexAt(px, py),
    standAt, rowAt,   // BAY-LEFT-MAPS
  });
  /** FOUNDATION F1: this client's world-data additions with their locations - a mod's places past a region's base rows
   *  (HUB1 keeps them off the registry: each client's own) - for the atlas's check. */
  const modAdditions = () => {
    const out = [];
    for (let r = 0; r < maps.regionCount; r++) {   // BAY-OWN: a mod's addition is a MAPS.BSA region's row past its base count (formats/mapsFile.js baseLocationCount)
      const reg = maps.getRegion(r);
      for (let l = reg ? maps.baseLocationCount(r) : 0; l < (reg?.locationCount ?? 0); l++) {
        const loc = maps.getLocation(r, l), p = loc?.mapTableData ? placeOfRow(bayPlaceRows([loc])[0], 'additions') : null;
        if (p) out.push([p, loc]);
      }
    }
    return out;
  };
  /** AUDIT FOUNDATION II A1: the location a registry place would stand as, read and not indexed - the index's where it
   *  stands; past the Bay a capital's slice, else an Arena place's clone (the atlas's check reads every listed place). */
  const peekAt = (p) => locationIndex.get(`${p.px},${p.py}`) ?? (inBay(p.px, p.py) ? null : capitalSliceAt(p.px, p.py) ?? arenaPeekAt(p.px, p.py));
  const arenaPeekAt = (px, py) => {
    const place = _arenaTemplates ? arenaPlaceOnPixel(px, py) : null, template = place ? arenaTemplateOf(_arenaTemplates, place) : null;
    return template ? arenaCloneOf(template, place, px, py) : null;
  };
  /** FOUNDATION F1 (scenes/atlasHost.js): the world's places whole - a place's bundle off the location the host holds
   *  for it (the Bay's in the index, a place past the Bay as the build stands it); checked once at idle where the door
   *  serves edits. */
  const worldAtlas = worldPlaces ? createAtlasHost({ places: worldPlaces, blocks, standing: (p) => locationIndex.get(`${p.px},${p.py}`) ?? null, stand: (p) => locationIndex.get(`${p.px},${p.py}`) ?? standAt(p.px, p.py), peek: peekAt, listings: homeListings, additions: modAdditions, stamp: () => host._locIndexGen }) : null;
  if (worldAtlas && (worldDataDoorOpen() || homeListings().length)) worldAtlas.check();   // FOUNDATION F3: and where property rows stand
  return { _tamrielRoads, arenaLocationAt, arenaWarm, capitalLocationAt, countryLocationAt, lairLocationAt, nearestTownOf, provinceQuestPlaces, registerTamrielPlaces, startLairAt, tamrielPlaceName, worldAtlas };
}

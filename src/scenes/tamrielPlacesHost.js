// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPixels, arenaPlaceOnPixel } from '../world/arenaPlaces.js';
import { arenaRoadTowns, arenaTemplateOf, synthesizeArenaLocation } from '../world/arenaLocations.js';
import { bayLand, countryMayStandAt, countryName, countryNameSeed, countryRates, countryStandsAt, createCountryGround, synthesizeCountryLocation } from '../world/tamrielCountry.js';
import { capitalOnPixel, synthesizeCapitalLocation } from '../world/tamrielCapitals.js';
import { createTamrielRoadsHost } from './tamrielRoadsHost.js';
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { getWorldClimateSettings, REGION_NAMES } from '../formats/mapsFile.js';
import { isWaterPixel } from '../ui/overworldModel.js';
import { LAIR_TYPES, lairBlockCount, lairLayout, lairMayStandAt, lairName, lairNameSeed, lairPlaceId, lairStandsAt, synthesizeLairLocation } from '../world/tamrielDungeons.js';
import { provinceKeyBeyondBay, tamrielLandVersion } from '../world/tamriel/tamrielLand.js';
import { inBay as onBayPixel, tamrielFit } from '../world/tamriel/tamrielFrame.js';   // AUDIT TESA II P7: the registry's live list's stamp
import { provinceNameBank } from '../world/tamrielPeople.js';
import { rollSpec } from '../world/tamrielRoads.js';
import { pastBayPlaceRows, PAST_BAY_SOURCE } from '../world/pastBayRows.js';   // AUDIT TESA II P7: the places past the Bay on the world's registry
import { nearestSafePlace } from '../systems/deathRespawn.js';   // AUDIT TESA II P2/P3: the nearest town of the world

/** @param {any} host */
export function createTamrielPlaces(host) {
  const {
    _arenaTemplates, _capitalBase, _capitalNames, _countryCounts, _countryTemplates, _lairCounts, _lairPools,
    _lairTemplates, arenaJoinLand, arenaRoadsLanded, blocks, locationIndex, maps, tamrielLand, terrainGen,
    woodsBytes, worldPlaces, zoneHalls
  } = host;
  /** TESA2 (world/arenaLocations.js): THE PLACE A PIXEL PAST THE BAY STANDS - the place standing on it (world/arenaPlaces.js
   *  arenaPlaceOnPixel: TESA12, the port's own, on the trace) cloned off the game's own rows under its own id, name and
   *  index, the region and the climate the pixel's (TAMRIEL2: the province's climate; the region the clamp's until TESA3) -
   *  stood in the index once, or null: no place there, or none stood yet (the trace still to land; the sweep builds the
   *  pixel again when it does). A place the land no longer stands there leaves the index here. */
  function arenaLocationAt(px, py) {
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
    const regionIndex = maps.getRegionIndexAt(px, py);
    const loc = synthesizeArenaLocation(template, place, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) });
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** TESA7 (world/tamrielCountry.js): THE COUNTRYSIDE'S RATES - each climate's chances, the Bay's count over the Bay's land
   *  (CLIMATE.PAK and WOODS.WLD's water law, ui/overworldModel.js isWaterPixel), worked out at the first pixel past the Bay
   *  that asks (the Bay's half a million pixels read once). */
  const _pastBay = { countryRates: null, lairRates: null, bayLand: null, countryRoll: null, lairRoll: null };   // TESA7-8: each made once, when first asked (a holder, so the place law moves out whole - scenes/tamrielPlacesHost.js)
  const bayLandNow = () => (_pastBay.bayLand ??= bayLand((x, y) => maps.getClimateIndex(x, y), (x, y, c) => isWaterPixel(c, host.woods.getHeightMapValue(x, y))));
  const countryRatesNow = () => (_pastBay.countryRates ??= countryRates(_countryCounts, bayLandNow()));
  const lairRatesNow = () => (_pastBay.lairRates ??= countryRates(_lairCounts, bayLandNow(), LAIR_TYPES));   // TESA8: the lairs' over the same land
  const _countryGround = _countryTemplates ? createCountryGround(host.woods) : null;
  /** TESA14: the world the roll reads past the Bay - the climate, the ground's bytes and its dry plateau - and the two
   *  rolls' own rates and templates, made at the first ask (the rates read the Bay's land once). */
  const _pastBayAt = { climateAt: (x, y) => maps.getClimateIndex(x, y), heightAt: (x, y) => host.woods.getHeightMapValue(x, y), ground: (x, y) => _countryGround(x, y) };
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
    const loc = synthesizeCountryLocation(pick.template, { px, py, type: pick.type, name }, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) });
    if (!loc) return null;
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
    if (!at) return null;
    const blocks = lairBlocksOf(at);
    if (!blocks) return null;
    const { c, pick, regionIndex, name } = at;
    const loc = synthesizeLairLocation(pick.template, { c, px, py, type: pick.type, name, blocks }, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) });
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
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
  /** TESA15 (world/pastBayPlaces.js): a place's name the held map's hover says - the places are the roads' regions'. */
  const tamrielPlaceName = (px, py) => countryRollAt(px, py)?.name ?? lairRollAt(px, py)?.name ?? '';
  /** TESA10 (world/tamrielCapitals.js): THE CAPITAL A PIXEL PAST THE BAY STANDS - its own, laid out by its plan (its
   *  districts of the game's city blocks round the port's own landmarks), the region and climate the pixel's, and where
   *  Arena's place of its name stands on it (world/arenaPlaces.js standArenaPixels' pin) that place's slot (the Arena
   *  sweep and the port readers read it) - stood in the index once, and again when the place on it changes; or null.
   *  TESA11: a capital over several pixels stands a slice on each (capitalOnPixel's `s`), its own location. */
  function capitalLocationAt(px, py) {
    const at = _capitalBase ? capitalOnPixel(px, py) : null;
    const key = `${px},${py}`, had = locationIndex.get(key);
    const place = at && _arenaTemplates ? arenaPlaceOnPixel(px, py) : null;
    const slot = place ? Object.freeze({ province: place.province, provinceIndex: place.provinceIndex, id: place.id, kind: place.kind, port: !!place.port }) : null;
    if (had?.capital) {
      if (at && had.capital.k === at.k && had.capital.s === at.s && (had.arena?.id ?? null) === (slot?.id ?? null) && (had.arena?.provinceIndex ?? null) === (slot?.provinceIndex ?? null)
        && !!had.arena?.port === !!slot?.port) return had;   // AUDIT-TESA A4-F2: its place made a port, its slot too
      host._locIndexGen += 1;
      locationIndex.delete(key);
    }
    if (!at) return null;
    const regionIndex = maps.getRegionIndexAt(px, py);
    const loc = synthesizeCapitalLocation(at, { base: _capitalBase, names: _capitalNames, blockOf: (name) => blocks.getBlockByName(name), px, py, arena: slot,
      where: { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) } });
    if (!loc) return null;
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  /** AUDIT TESA II P7 (bible/03-World/World-Wide.md "Folded into TESA"): THE PLACES PAST THE BAY ON THE WORLD'S REGISTRY -
   *  the capitals and the model's places that stand a location (world/pastBayRows.js), a LIVE list (world/worldWide/
   *  worldPlaces.js registerLive): made again whenever the places' pixels, the fit or the land move under them, so every
   *  reader of the registry - the living world's towns, the world's ports, the zone's halls - sees the towns the build
   *  stands. The countryside and the lairs are no list (a pixel's roll): not registered (a district's walk through the roll
   *  is 276 ms on this thread - the registry's inArea and near). */
  if (worldPlaces && (_arenaTemplates || _capitalBase)) {
    worldPlaces.registerLive(PAST_BAY_SOURCE, {
      stamp: () => [_arenaTemplates ? arenaPixels() : null, tamrielFit(), tamrielLandVersion()],
      rows: () => pastBayPlaceRows({ pixels: _arenaTemplates ? arenaPixels() : null, templateOf: (p) => arenaTemplateOf(_arenaTemplates, p), capitals: !!_capitalBase }),
    });
  }
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
   *  continent away, or the index's towns within 48 pixels and else where the player fell (at sea, in the water). */
  const nearestTownOf = (/** @type {{ x: number, y: number }} */ px, /** @type {((hit: any) => boolean)|null} */ accept = null) => nearestSafePlace([worldPlaces?.all() ?? [], countryTowns()], px, accept);
  const countryTowns = () => {
    const out = [];
    for (const l of locationIndex.values()) if (l?.country && !l.country.dungeon) out.push({ type: l.mapTableData?.locationType, dungeonType: l.mapTableData?.dungeonType, px: l.country.px, py: l.country.py });
    return out;
  };
  return { _tamrielRoads, arenaLocationAt, capitalLocationAt, countryLocationAt, lairLocationAt, nearestTownOf, tamrielPlaceName };
}

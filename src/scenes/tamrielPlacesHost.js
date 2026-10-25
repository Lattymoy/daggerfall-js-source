// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPixels, arenaPlaceOnPixel, arenaPlaces, arenaPlacesVersion } from '../world/arenaPlaces.js';
import { arenaRoadTowns, arenaTemplateOf, synthesizeArenaLocation, arenaPlaceId, arenaLocationIndex, ARENA_TEMPLATE_KINDS } from '../world/arenaLocations.js';
import { bayLand, countryName, countryNameSeed, countryRates, countryStandsAt, createCountryGround, synthesizeCountryLocation, countryOrdinal, countryPlaceId, countryLocationIndex } from '../world/tamrielCountry.js';
import { capitalOnPixel, synthesizeCapitalLocation, CAPITALS, capitalPlaceId, capitalLocationIndex, capitalSliceName, capitalSliceOrdinal, capitalSpan, capitalSpanPixels, capitalsVersion } from '../world/tamrielCapitals.js';
import { createTamrielRoadsHost } from './tamrielRoadsHost.js';
import { getNameBankOfRegion } from '../characters/nameHelper.js';
import { getWorldClimateSettings, REGION_NAMES, LOCATION_TYPES } from '../formats/mapsFile.js';
import { isWaterPixel } from '../ui/overworldModel.js';
import { LAIR_TYPES, lairBlockCount, lairLayout, lairName, lairNameSeed, lairPlaceId, lairStandsAt, synthesizeLairLocation } from '../world/tamrielDungeons.js';
import { provinceKeyBeyondBay, tamrielLandVersion, PROVINCE_OF_ID } from '../world/tamriel/tamrielLand.js';
import { regionOfTheatre } from '../formats/mapsTables.js';
import { replaceSeats, tamrielSeatsOf } from '../systems/town/townSeats.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { provinceNameBank } from '../world/tamrielPeople.js';
import { rollSpec } from '../world/tamrielRoads.js';
import { outlineTownLocation } from '../world/townOutline.js';   // TOWN-SHAPES TS3: a town past the Bay laid as its own outline of blocks

/** @param {any} host */
export function createTamrielPlaces(host) {
  const {
    _arenaTemplates, _capitalBase, _capitalNames, _countryCounts, _countryTemplates, _lairCounts, _lairPools,
    _lairTemplates, arenaJoinLand, arenaRoadsLanded, arenaStands, blocks, locationIndex, maps, tamrielLand, terrainGen,
    townSeats, woodsBytes, worldPlaces
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
    const regionIndex = maps.getRegionIndexAt(px, py);
    const loc = outlineTownLocation(synthesizeArenaLocation(template, place, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) }), blockOf);
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
    const made = synthesizeCountryLocation(pick.template, { px, py, type: pick.type, name }, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) });
    if (!made) return null;
    const loc = outlineTownLocation(made, blockOf);   // TOWN-SHAPES TS3
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
    registerTamrielPlaces();   // WW7
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
  // WW7 (2026-10-25, the owner: "We also need to fully integrate our living world into the entirety of tamriel";
  // bible/03-World/World-Wide.md WW7): TESA'S PLACES IN THE WORLD'S REGISTRY (world/worldWide/worldPlaces.js) - every
  // system that reads the world's places (the living world's index, its trips and lanes, the gates' scans, the zone's
  // halls) read none past the Bay, and a town there stood its LivingTown on a bare record. Four providers after the Bay's,
  // in the build's own order (_locationToBuild: a capital, an Arena place, the countryside, a lair): the capitals' slices
  // and Arena's places as lists (a capital's pixel the capital's - the first list holds it), the countryside and the
  // lairs as pixel providers (the same rolls the build reads). Registered again when the land, Arena's standing or the
  // capitals' move; only where the land past the Bay stands (as every place past the Bay is).
  const TESA_SOURCES = Object.freeze({ capitals: 'tesa-capitals', arena: 'tesa-arena', country: 'tesa-country', lairs: 'tesa-lairs' });
  const exteriorSize = (loc) => ({ w: loc?.exterior?.exteriorData?.width ?? 1, h: loc?.exterior?.exteriorData?.height ?? 1 });
  /** The capitals' slices, a row a pixel (TESA11: the Imperial City nine). */
  function capitalRows() {
    const rows = [];
    for (let k = 0; _capitalBase && k < CAPITALS.length; k++) {
      const cap = CAPITALS[k], n = capitalSpan(cap), size = n > 1 ? { w: 8, h: 8 } : { w: cap.plan[0].length, h: cap.plan.length };
      for (const { x, y } of capitalSpanPixels(k)) {
        const at = capitalOnPixel(x, y);
        if (at?.k !== k) continue;
        const so = capitalSliceOrdinal(cap, at.s);
        rows.push({ mapId: capitalPlaceId(k, so), name: capitalSliceName(cap, at.s), px: x, py: y, type: LOCATION_TYPES.TownCity, ...size, port: !!arenaPlaceOnPixel(x, y)?.port, location: capitalLocationIndex(k, so) });   // WW7-5: its location's index
      }
    }
    return rows;
  }
  /** Arena's places standing on the trace with a template to stand on (a capital's own pixel the capital's). */
  function arenaRows() {
    const stood = _arenaTemplates ? arenaPixels()?.stood ?? [] : [];
    return stood.map((p) => { const t = arenaTemplateOf(_arenaTemplates, p); return t && { mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, ...exteriorSize(t), port: !!p.port, location: arenaLocationIndex(p) }; }).filter(Boolean);   // WW7-5: its location's index
  }
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
    worldPlaces.register(TESA_SOURCES.capitals, capitalRows());
    worldPlaces.register(TESA_SOURCES.arena, arenaRows());
    if (_countryTemplates) worldPlaces.registerPixels(TESA_SOURCES.country, countryRow);
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
  return { _tamrielRoads, arenaLocationAt, arenaWarm, capitalLocationAt, countryLocationAt, lairLocationAt, registerTamrielPlaces, tamrielPlaceName };
}

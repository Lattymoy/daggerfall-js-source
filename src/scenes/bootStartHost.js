// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) - by hand, as
// tools/hostMove.mjs refuses this group (its `let startLoc` is written by the statements after it, which declare no name
// to group them by). The host constructs it where the code stood. What it reads of the host's scope comes through
// `host`: the settled names by value at construction (`_worldReady` the host's own readiness, asked at each look), every
// live one (`arenaTraced`, `townTalk`, declared below the construction) asked at its use.
//
// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" B1; bible/06-Systems/Legacy-Arc.md BAY-LEFT-B):
// A START PAST THE BAY. The named start (`?region=&loc=`) read MAPS.BSA alone, so a Project Legacy birth whose family seat
// is past the Bay (`?region=Skyrim&loc=Solitude` - the seat is the first town the house stands in, and TESA's places
// stand in the location index as they build) threw "location not found" and the page never booted, a reload neither.
// Such a start is booted the way a save made in a town past the Bay loads (TESA2): the world stands first on the Bay -
// the nearest Bay town to the place where its pixel is known before the trace, else the boot's own default - and once
// the land past the Bay has its trace (world.js arenaTraced, ARENA_LOAD_WAIT_MS at most, the load's own wait) and the
// boot's world stands, the player is moved to the place by its kept map id (`seat`, LEGACY-HOME's: the registry's row, a
// country place's id read back to its pixel, an isle's to its centre) or by its region's name and its own (the
// registry's first listed place of that name past the Bay). `farStart` settles when the move is made (or none could
// be): a birth waits on it before the heir is made (world.js's birth chain), so they are born, and first saved, there.
// Where no way stands they are born where the world stood, and it is said.
import { getInt } from '../systems/settings/settings.js'; // U31: StartCellX/Y + StartInDungeon, the classic start's own three keys
import { REGION_NAMES, isProvinceRegion } from '../formats/mapsTables.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { BAY_THEATRE } from '../world/worldWide/worldGrid.js';
import { countryPixelOfId } from '../world/tamrielCountry.js';
import { etherPlacePixelOfId } from '../world/etherPlaces.js';
import { ARENA_LOAD_WAIT_MS } from '../world/arenaLocations.js';
import { nearestSafePlace } from '../systems/deathRespawn.js';
import { REPOSITION } from '../systems/ship.js';
import { START_READY_MS, START_READY_TRIES, STARTS_TEXT } from './startsHost.js';

/** The boot's own start when the address names none it can stand (world.js regionName/locationName's defaults). */
export const BAY_DEFAULT_START = Object.freeze({ region: 'Daggerfall', loc: 'Daggerfall' });

/**
 * A start the Bay's tables do not hold, past the Bay: the address's kept map id (`seat`), or a province's region named
 * (formats/mapsTables.js 62..70) - `{ id, region, loc }`; null for any other name (a Bay name MAPS.BSA lacks still throws).
 * @param {{ get: (key: string) => string|null }} params the boot's address (its search's parameters, read once at boot)
 * @param {string} regionName @param {string} locationName
 */
export function farStartOf(params, regionName, locationName) {
  const seat = params.get('seat') ?? '';
  const id = /^\d+$/.test(seat) ? Number(seat) >>> 0 : null;
  if (id == null && !isProvinceRegion(REGION_NAMES.indexOf(regionName))) return null;
  return { id, region: String(regionName), loc: String(locationName) };
}

/**
 * Where a start past the Bay stands now: by its map id - the registry's place (world/worldWide/worldPlaces.js byMapId: a
 * capital's slice, an Arena place), a country place's own pixel where the countryside stands it there
 * (world/tamrielCountry.js countryPixelOfId), an isle's centre (world/etherPlaces.js etherPlacePixelOfId) - else by name:
 * the registry's first listed place past the Bay of that name in that region. `{ x, y }`, or null.
 * @param {{ id: ?number, region: string, loc: string }} far @param {any} worldPlaces
 */
export function farPixelOf(far, worldPlaces) {
  if (far.id != null) {
    const listed = worldPlaces?.byMapId?.(far.id) ?? null;
    if (listed) return { x: listed.px, y: listed.py }; // a Bay place by its id too, where its names no longer answer
    const country = countryPixelOfId(far.id);
    if (country && (worldPlaces?.at?.(country.x, country.y)?.mapId ?? -1) === far.id) return country;
    const isle = etherPlacePixelOfId(far.id);
    if (isle) return isle;
  }
  const named = (worldPlaces?.all?.() ?? []).find(
    (p) => !inBay(p.px, p.py) && p.name === far.loc && REGION_NAMES[p.region] === far.region,
  );
  return named ? { x: named.px, y: named.py } : null;
}

/** The world's stand on the Bay while a start past the Bay waits for its land: the Bay's town nearest the place's pixel
 *  as the registry reads it now (null: none known yet), else the boot's default. */
function bayGuardOf(far, { worldPlaces, locationIndex, maps }) {
  const at = farPixelOf(far, worldPlaces);
  const hit = at ? nearestSafePlace([worldPlaces?.inTheatre?.(BAY_THEATRE) ?? []], at, (h) => h.kind === 'city') : null;
  return (
    (hit ? locationIndex.get(`${hit.mapPixel.x},${hit.mapPixel.y}`) : null) ??
    maps.getLocationByName(BAY_DEFAULT_START.region, BAY_DEFAULT_START.loc)
  );
}

const wait = (/** @type {number} */ ms) =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** @param {any} host */
export function createBootStart(host) {
  const { locationIndex, locationName, maps, params, regionName, _teleportToPixel, worldPlaces, _worldReady } = host;
  // U31 / THE CLASSIC START. StartGameBehaviour (:371-401) does not
  // resolve the start by NAME - it reads a map pixel out of settings
  // (StartCellX/StartCellY, 109/158 = Privateer's Hold) and asks the
  // world what location is there. ?classic takes that path so the new
  // game begins where Daggerfall begins; every dev boot keeps the
  // region/loc names it has always used.
  //
  // NEVER TRAPS: a start cell with no location falls back to the named
  // location rather than throwing the player at a black screen.
  let startLoc = null;
  if (params.has('classic')) {
    const cell = `${getInt('Startup', 'StartCellX')},${getInt('Startup', 'StartCellY')}`;
    startLoc = locationIndex.get(cell) ?? null;
    if (!startLoc)
      console.warn(`[world] start cell ${cell} holds no location; falling back to ${regionName}/${locationName}`);
  }
  // EE13 (Mac: a season test that spawns somewhere random, from the
  // menu): ?spawn=random picks any TOWN in the index - a place with
  // ground, roads and people, which is what the outdoors is being tested
  // with. Seeded from the clock so two presses give two towns; the town
  // is logged so a good one can be found again by ?region=&loc=.
  if (!startLoc && params.get('spawn') === 'random') {
    const towns = [...locationIndex.values()].filter((l) => [0, 1, 2].includes(l.mapTableData?.locationType)); // TownCity, TownHamlet, TownVillage (MapsFile LocationTypes)
    const pick = towns.length ? towns[Math.floor((Date.now() / 7919) % towns.length)] : null;
    if (pick) {
      startLoc = pick;
      console.info(
        `[world] random spawn: ${pick.regionName ?? pick.mapTableData?.regionName ?? '?'} / ${pick.name ?? '?'} (${params.get('season') ?? 'the calendar’s season'})`,
      );
    }
  }
  if (!startLoc) startLoc = maps.getLocationByName(regionName, locationName);
  // BAY-LEFT-B: a start past the Bay stands the world on the Bay first, and is reached once its land stands
  const far = startLoc ? null : farStartOf(params, regionName, locationName);
  if (far) startLoc = bayGuardOf(far, { worldPlaces, locationIndex, maps });
  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);

  /** The move to a start past the Bay, once the boot's world stands and the land past the Bay has its trace - as a save
   *  past the Bay loads (world.js: the load's wait on arenaTraced, then its teleport). Answers the pixel reached, or null. */
  async function reach(/** @type {{ id: ?number, region: string, loc: string }} */ to) {
    for (let i = 0; !_worldReady() && i < START_READY_TRIES; i++) await wait(START_READY_MS);
    const landed =
      _worldReady() &&
      (await Promise.race([
        Promise.resolve(host.arenaTraced).then(
          () => true,
          () => true,
        ),
        wait(ARENA_LOAD_WAIT_MS).then(() => false),
      ]));
    const at = landed ? farPixelOf(to, worldPlaces) : null;
    if (!at) {
      console.warn(
        `[world] no way to ${to.region}/${to.loc} past the Bay (seat ${to.id ?? '-'}): the world stands at ${startLoc.name}`,
      );
      host.townTalk?.say(STARTS_TEXT.noSite);
      return null;
    }
    try {
      await _teleportToPixel(at.x, at.y, null, { reposition: REPOSITION.RandomStartMarker });
    } catch (e) {
      console.warn(`[world] the move to ${to.region}/${to.loc} failed`, e);
      return null;
    }
    console.info(`[world] start past the Bay: ${to.region} / ${to.loc} at ${at.x},${at.y}`);
    return at;
  }
  // a load's own place is the save's (the load teleports there), never the address's
  const farStart = far && !params.has('load') && !params.has('classicload') ? reach(far) : Promise.resolve(null);
  return { startLoc, farStart };
}

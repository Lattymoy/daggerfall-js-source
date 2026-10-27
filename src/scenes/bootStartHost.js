// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) - by hand, as
// tools/hostMove.mjs refuses this group (its `let startLoc` is written by the statements after it, which declare no name
// to group them by). The host constructs it where the code stood. What it reads of the host's scope comes through
// `host`, by value at construction: every name it reads is settled there.
import { getInt } from '../systems/settings/settings.js';   // U31: StartCellX/Y + StartInDungeon, the classic start's own three keys

/** @param {any} host */
export function createBootStart(host) {
  const { locationIndex, locationName, maps, params, regionName } = host;
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
    if (!startLoc) console.warn(`[world] start cell ${cell} holds no location; falling back to ${regionName}/${locationName}`);
  }
  // EE13 (Mac: a season test that spawns somewhere random, from the
  // menu): ?spawn=random picks any TOWN in the index - a place with
  // ground, roads and people, which is what the outdoors is being tested
  // with. Seeded from the clock so two presses give two towns; the town
  // is logged so a good one can be found again by ?region=&loc=.
  if (!startLoc && params.get('spawn') === 'random') {
    const towns = [...locationIndex.values()].filter((l) => [0, 1, 2].includes(l.mapTableData?.locationType));   // TownCity, TownHamlet, TownVillage (MapsFile LocationTypes)
    const pick = towns.length ? towns[Math.floor((Date.now() / 7919) % towns.length)] : null;
    if (pick) { startLoc = pick; console.info(`[world] random spawn: ${pick.regionName ?? pick.mapTableData?.regionName ?? '?'} / ${pick.name ?? '?'} (${params.get('season') ?? 'the calendar’s season'})`); }
  }
  if (!startLoc) startLoc = maps.getLocationByName(regionName, locationName);
  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);
  return { startLoc };
}

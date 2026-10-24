// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV6 - THE DUNGEONS, DISCOVERED ON APPROACH (bible/06-Systems/Travel-View.md, THE OVERHAUL).
//
// Mac (2026-09-28): "Random encounters and nearby dungeons implemented should somehow be detailed implemented into the
// new overworld ... Like a true overhaul for the new overworld"; his call "Discover on approach". Every dungeon within
// TV_FAR_RANGE of the traveller stands on the Overworld: a discovered one is a plate with its name and distance (a
// journey there, as a far town is), an undiscovered one an unnamed mark at its place. Coming within TV_DUNGEON_FIND_M of
// an undiscovered one DISCOVERS it and says so - a departure from DFU (PlayerGPS discovers on the location's rect and
// says nothing), Mac's call, on the enhanced interface alone.
//
// A dungeon is DFU's travel-map "dungeons" filter (the map's pixel colours 0-4): a labyrinth, a keep, a ruin, a
// graveyard, a coven.
//
// PURE: the host hands the map rows, the live index, the discovery tests and each dungeon's middle; the list is rebuilt
// when the traveller's pixel (or what is known, or the index) changes, and the find is asked a few times a second.
//
// AUDIT OW3 D1: AND THE SPAWNED ONES. Online most dungeons near a player are SPAWNED (world/spawnedDungeons.js: a clone
// on an empty pixel, in no MAPS table) - Mac's "nearby dungeons", the ones its "nearby direction message" speaks of -
// and the list asked a map row of every entry, so it dropped every one. They stand here now under their own key, told
// the way that feature tells them: NOTHING until it has (it says a spawn when its pixel is entered, never before - a
// spawn next door is not said), then its mark, named once the pixel entry has filed it in the store.
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES, getPixelFromPixelID, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../../formats/mapsFile.js';
import { TV_FAR_RANGE } from './travelFarPlaces.js';
import { ARRIVAL_BUFFER } from './travelAutopilot.js';

/** The dungeons the Overworld speaks for - the travel map's own "dungeons" filter. */
export const TV_DUNGEON_TYPES = Object.freeze(new Set([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep,
  LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard, LOCATION_TYPES.Coven]));
/** The most dungeons marked at once, the nearest first. */
export const TV_DUNGEON_MAX = 12;
/** How near an undiscovered dungeon's middle the traveller comes to find it (metres). */
export const TV_DUNGEON_FIND_M = 1000;
/** Native world units a metre (a map pixel is 32768 units, 819.2 m). */
export const NATIVE_PER_M = 32768 / 819.2;

/** The words a find says. */
export const dungeonFoundText = (name) => `You have found ${name}.`;

/**
 * AUDIT OW3 D3: THE WORLD'S DUNGEONS, FROM THE MAP ROWS - `{ x, y, row }` for every row of TV_DUNGEON_TYPES in the
 * host's map dict (systems/map/mapDirectory.js: pixel id -> MAPS.BSA's summary). These are fixed for the session, so the host
 * gathers them once; the list was a one-time snapshot of the LIVE pixel index, which streaming and the spawns keep
 * changing (a spawn in it at the first ask stood for good, one after it never did). Each list reads the index afresh.
 * @param {Map<number, any>} mapDict
 */
export function dungeonRows(mapDict) {
  const out = [];
  for (const row of mapDict?.values() ?? []) {
    if (!row || !TV_DUNGEON_TYPES.has(row.locationType)) continue;
    const p = getPixelFromPixelID(row.id);
    out.push({ x: p.x, y: p.y, row });
  }
  return out;
}

/**
 * AUDIT OW3 D1: THE SPAWNED DUNGEONS standing in the live pixel index NOW (a Map of "x,y" -> the location, world.js
 * locationIndex; world/spawnedDungeons.js flags each clone `spawned`) - `{ x, y, loc }`, read for every list: a spawn
 * comes as its pixel streams and goes when its time runs out (TTL1) or a road takes it back (SPAWN-ROADS).
 * @param {Map<string, any>} index
 */
export function spawnedPixels(index) {
  const out = [];
  for (const [key, loc] of index ?? []) {
    if (!loc?.spawned) continue;
    const c = key.indexOf(',');
    out.push({ x: Number(key.slice(0, c)), y: Number(key.slice(c + 1)), loc });
  }
  return out;
}

/**
 * THE DUNGEONS about pixel `at`, within `range` (a circle, map pixels), nearest first, at most `max`. Each
 * `{ key, x, y, loc, row, d, found, spawn }` - `found` whether it is discovered, `d` in map pixels.
 *
 * AUDIT OW3 D3: FILTERED, THEN CAPPED - the host dropped what it could not mark AFTER the twelve were taken, so a row
 * with no place to name, or a found dungeon inside the grid (TV2's own plate stands for it), spent a slot of the twelve
 * and a farther dungeon that could have been marked never was. Nothing is taken now that is not marked:
 *  - a map row (`dungeons`, dungeonRows) whose pixel holds no named place in the live index (`locAt`), or holds a spawn
 *    (the spawn's own entry speaks for it), is none; a FOUND one within `grid` (the view's grid, Chebyshev) is TV2's;
 *  - AUDIT OW3 D1: a spawn (`spawns`, spawnedPixels) is marked only once the spawned feature has told the player of it
 *    (`spawnKnown`), under `spawn:<its map id>`, and is `found` (named, a journey) once the store has it (`spawnFound`).
 *  - AUDIT OW4 D2: and never one whose time has run out (`spawnGone`, the spawn ledger's own test) - the index keeps an
 *    expired spawn until its pixel next BUILDS (spawnedDungeonAt checks the clocks there alone), so it stood as a plate,
 *    and walked, for as long as the traveller never went back.
 * AUDIT OW4 D7: THE FOUND FIRST, THEN THE REST NEAREST - the twelve were the nearest twelve whatever they were, so a
 * found dungeon (a plate, a journey) went off the Overworld behind nearer "?"s it could do nothing with. The cap is
 * taken of the found ones first, then of the unfound nearest first; what is kept is handed back nearest first.
 * AUDIT OW5b D1: AND AN UNFOUND ONE WITHIN THE GRID SPENDS NONE OF THEM - the ground the view shows (as a found one
 * there is TV2's plate and spends none). Found first, twelve found within the far range left not one "?" on the
 * Overworld, the one five hundred metres off included.
 * @param {{ at: {x:number,y:number}, dungeons: Array<{x:number,y:number,row:any}>, locAt: (x:number, y:number) => any,
 *   isFound: (x:number, y:number) => boolean, spawns?: Array<{x:number,y:number,loc:any}>, spawnKnown?: (s:any) => boolean,
 *   spawnFound?: (s:any) => boolean, spawnGone?: (s:any) => boolean, grid?: number, range?: number, max?: number }} q
 */
export function nearDungeons({ at, dungeons, locAt, isFound, spawns = [], spawnKnown = () => false, spawnFound = () => false,
  spawnGone = () => false, grid = -1, range = TV_FAR_RANGE, max = TV_DUNGEON_MAX }) {
  const out = [];
  for (const g of dungeons ?? []) {
    const d = Math.hypot(g.x - at.x, g.y - at.y);
    if (d > range) continue;
    const loc = locAt(g.x, g.y);
    if (!loc?.name || loc.spawned) continue;
    const found = !!isFound(g.x, g.y);
    if (found && Math.max(Math.abs(g.x - at.x), Math.abs(g.y - at.y)) <= grid) continue;
    out.push({ key: `dng:${g.row.mapID}`, x: g.x, y: g.y, loc, row: g.row, d, found, spawn: false });
  }
  for (const s of spawns ?? []) {
    const d = Math.hypot(s.x - at.x, s.y - at.y);
    if (d > range || !s.loc?.name || !spawnKnown(s)) continue;
    if (spawnGone(s)) continue;   // AUDIT OW4 D2: its time ran out - gone, whatever the index still holds
    out.push({ key: `spawn:${s.loc.mapTableData?.mapId}`, x: s.x, y: s.y, loc: s.loc, row: null, d, found: !!spawnFound(s), spawn: true });
  }
  const nearer = (a, b) => a.d - b.d || a.x - b.x || a.y - b.y;
  const inGrid = (g) => !g.found && Math.max(Math.abs(g.x - at.x), Math.abs(g.y - at.y)) <= grid;   // AUDIT OW5b D1
  const rest = out.filter((g) => !inGrid(g));
  rest.sort((a, b) => (b.found ? 1 : 0) - (a.found ? 1 : 0) || nearer(a, b));   // AUDIT OW4 D7: the found first
  return [...out.filter(inGrid), ...rest.slice(0, max)].sort(nearer);
}

/**
 * AUDIT OW4 D4: THE FOUND SPAWNS PAST THE STREAM. The live index holds a spawn only once its pixel has been BUILT this
 * session (spawnedDungeonAt stands it there), so after a reload every found spawn past the streamed pixels lost its far
 * plate until the traveller came within a few pixels of it again. A spawn is a pure hash of its pixel and the world's
 * salt, and the discovery store keeps what was found across the save - so each pixel within `range` (a circle, map
 * pixels, on the map) whose roll holds a spawn (`rolls`) and whose id is FILED (`filed`), and that the index does not
 * already speak for (`indexed` - a built spawn, or a real place), is asked what stands there (`stand`: the host's own
 * spawn tests and its clone, side-effect free - null for none) and comes back `{ x, y, loc }`, spawnedPixels' shape.
 * @param {{ at: {x:number,y:number}, rolls: (x:number, y:number) => boolean, filed: (x:number, y:number) => boolean,
 *   indexed: (x:number, y:number) => boolean, stand: (x:number, y:number) => any, range?: number }} q
 */
export function filedSpawns({ at, rolls, filed, indexed, stand, range = TV_FAR_RANGE }) {
  const out = [], r = Math.floor(range);
  for (let y = Math.max(0, at.y - r); y <= Math.min(MAX_MAP_PIXEL_Y - 1, at.y + r); y++) {
    for (let x = Math.max(0, at.x - r); x <= Math.min(MAX_MAP_PIXEL_X - 1, at.x + r); x++) {
      if (Math.hypot(x - at.x, y - at.y) > range || !rolls(x, y) || !filed(x, y) || indexed(x, y)) continue;
      const loc = stand(x, y);
      if (loc) out.push({ x, y, loc });
    }
  }
  return out;
}

/**
 * AUDIT OW4 D6: WHERE A JOURNEY'S LAST LEG STARTS - the leg before it's aim (its own point for a join, OW-ROADSIDE; else
 * its pixel's middle, `centre` -> native `[x, z]`, the drawn route's own), or the traveller's `feet` when the journey is
 * that one leg (travelOptions.js startRouteLeg walks each leg to its aim, then the last to the journey's point). A walk to
 * a spawn's door faces THIS (dungeonApproach): faced to the feet, a route that bent round and came in from the far side
 * walked its last leg straight through the exterior's walls and stalled there.
 * @param {Array<{x:number, y:number, at?:{x:number,z:number}}>} legs
 * @param {{x:number, z:number}} feet
 * @param {(leg: {x:number,y:number}) => number[]} centre
 */
export function lastLegStart(legs, feet, centre) {
  const prev = legs?.length > 1 ? legs[legs.length - 2] : null;
  if (!prev) return { x: feet.x, z: feet.z };
  if (prev.at) return { x: prev.at.x, z: prev.at.z };
  const [x, z] = centre(prev);
  return { x, z };
}

/**
 * AUDIT OW3 D1: WHERE A WALK TO A SPAWN ENDS. A spawn stands in no MAPS table, so no place journey can name it; its
 * plate is a SPOT journey (TV2's), and a spot's arrival square is one path wide about its point - so the point is not
 * the exterior's middle (that would walk the traveller into its walls) but the nearest point to `feet` (native `{x, z}`)
 * of its rect (native `{minX, maxX, minZ, maxZ}`) grown by the buffer a place journey stops at (travelAutopilot.js
 * ARRIVAL_BUFFER, 20 m): at its edge, on the traveller's side, where a place's journey ends. Feet already within: there.
 * AUDIT OW4 D6: the host's "feet" are where the walk's LAST LEG starts (lastLegStart) - the side the walk comes in from.
 * @param {{minX:number, maxX:number, minZ:number, maxZ:number}} rect
 * @param {{x:number, z:number}} feet
 */
export function dungeonApproach(rect, feet, grow = ARRIVAL_BUFFER, within = null) {
  const x = Math.min(Math.max(feet.x, rect.minX - grow), rect.maxX + grow);
  const z = Math.min(Math.max(feet.z, rect.minZ - grow), rect.maxZ + grow);
  if (!within) return { x, z };
  // AUDIT OW5 J4: and never out of the walk's own pixel (`within`, its box): a spot's arrival is asked only inside its
  // pixel, and a place whose footprint fills the pixel (eight blocks across) put the point 20 m into the next one - the
  // walk passed through it, turned at each pixel edge and never arrived
  return { x: Math.min(Math.max(x, within.minX), within.maxX), z: Math.min(Math.max(z, within.minZ), within.maxZ) };
}
/** AUDIT OW5 J4: a map pixel's own box (native), `inset` in from each edge. */
export function pixelBox(px, py, inset = 256) {
  const x0 = px * 32768, z0 = (499 - py) * 32768;
  return { minX: x0 + inset, maxX: x0 + 32768 - inset, minZ: z0 + inset, maxZ: z0 + 32768 - inset };
}

/**
 * THE FIND: the undiscovered dungeon whose middle (`mid(g)`, native units) lies within TV_DUNGEON_FIND_M of the
 * traveller's feet (native `{x, z}`), the nearest - or null. AUDIT OW3 D1: never a spawn - the spawned feature files its
 * own on its pixel's entry, and a kilometre reaches into the next pixel, whose spawn that feature does not say.
 * @param {{ feet: {x:number,z:number}, list: Array<any>, mid: (g:any) => ({x:number,z:number}|null) }} q
 */
export function dungeonToFind({ feet, list, mid }) {
  let best = null, bestD = TV_DUNGEON_FIND_M * NATIVE_PER_M;
  for (const g of list ?? []) {
    if (g.found || g.spawn) continue;
    const m = mid(g);
    if (!m) continue;
    const d = Math.hypot(m.x - feet.x, m.z - feet.z);
    if (d <= bestD) { best = g; bestD = d; }
  }
  return best;
}

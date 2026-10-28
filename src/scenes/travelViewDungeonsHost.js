// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { dungeonRows, filedSpawns, nearDungeons, spawnedPixels } from '../systems/travel/travelDungeons.js';
import { etherPlaceRows } from '../world/etherPlaces.js';
import { hasDiscoveredLocationId } from '../systems/discovery.js';
import { inEther } from '../world/ethericSea.js';
import { locationWorldRect } from '../world/streamingWorld.js';
import { spawnedMapId, spawnsDungeon } from '../world/spawnedDungeons.js';
import { TV_FAR_RANGE } from '../systems/travel/travelFarPlaces.js';
import { createTravelLairs } from '../systems/travel/travelLairs.js';   // TVD-WORLD: the lairs past the Bay, a few cells a call
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';

/** @param {any} host */
export function createTravelViewDungeons(host) {
  const {
    _announcedSpawnPixels, _spawnSalt, etherSea, locationIndex, mapDict, params, playerTravelPixel, state,
    tvEtherPlace, tvKnownGen, tvPlaceSummary, tvSpawnAt, tvSpawnGone, provinceQuestPlaces
  } = host;
  /** TVD-WORLD (2026-10-27, bible/06-Systems/Travel-View.md TVD-WORLD; the audit NO SYSTEM LEFT BEHIND IN THE BAY C4): THE LAIRS
   *  PAST THE BAY (TESA8, the places host's - scenes/tamrielPlacesHost.js), read about the traveller a few new cells a call
   *  (systems/travel/travelLairs.js): past the Bay no lair had a plate, a "?", a find or a model - TV6's dungeons were the
   *  map's rows alone. */
  const P = provinceQuestPlaces;
  const tvLairs = P ? createTravelLairs({ lairAt: P.lairAt, cloneAt: P.lairCloneAt, regionAt: P.regionAt, version: P.version }) : null;
  /** ETHER-OW: THE DUNGEONS TV6's law reads about the traveller - the map's rows, and past the Veil the ruin isles within
   *  `range` (their places' own rows, world/etherPlaces.js etherPlaceRows) - and what stands on a row's pixel: the
   *  index's, else past the Veil the isle's place (tvEtherPlace: marked, never built). */
  const tvDungeonRowsAt = (at, range = TV_FAR_RANGE) => {
    const bay = (host._tvDungeonRows ??= dungeonRows(mapDict));
    const rows = etherSea && inEther(at.x, at.y) ? [...bay, ...etherPlaceRows(at, range, 'ruin')] : bay;
    return tvLairs ? [...rows, ...tvLairs.rowsNear(at, range)] : rows;   // TVD-WORLD: and the lairs past the Bay (none read on the Bay's own cells)
  };
  /** TVD-WORLD: moves while the lairs in a list's reach are still being read - what a list keeps itself by. */
  tvDungeonRowsAt.gen = () => tvLairs?.gen() ?? 0;
  const tvDungeonAt = (x, y) => locationIndex.get(`${x},${y}`) ?? (etherSea && inEther(x, y) ? tvEtherPlace(x, y)
    : tvLairs && !onTheBay(x, y) ? tvLairs.lairPlaceAt(x, y) : null);   // TVD-WORLD: past the Bay a lair laid out, marked and never built
  /** TVD-WORLD: WHAT A FOUND DUNGEON'S PLATE JOURNEYS TO - the place's summary (tvPlaceSummary), else past the Bay a lair
   *  found (its own id in the store: the find, a quest, the pixel entered) laid out where its pixel is not built: its own
   *  summary, as an isle's place past the Veil is (ETHER-OW). */
  const tvDungeonSummary = (x, y) => {
    const s = tvPlaceSummary(x, y);
    if (s || !tvLairs || onTheBay(x, y)) return s;
    const loc = tvLairs.lairPlaceAt(x, y), id = (loc?.mapTableData?.mapId ?? 0) >>> 0;
    return loc?.name && id && hasDiscoveredLocationId(id) ? { pixel: { x, y }, name: loc.name, mapId: id, regionIndex: loc.regionIndex, locationIndex: loc.locationIndex, loc } : null;
  };
  /** TV6's found test, the lairs past the Bay's with it. */
  const tvDungeonFound = (x, y) => !!tvDungeonSummary(x, y);
  /** AUDIT OW3 D1: what the spawned feature has told the player of a spawn - its pixel's line (announceNearbySpawns, this
   *  session), or the pixel entry's filing in the store (syncTopics' discoverLocation, the same crossing, saved): the
   *  store's is its name too. Nothing else - a spawn not yet said is not marked (that feature never says one next door). */
  const tvSpawnFound = (s) => hasDiscoveredLocationId(s.loc.mapTableData.mapId);
  const tvSpawnKnown = (s) => tvSpawnFound(s) || _announcedSpawnPixels.has(`${s.x},${s.y}`);
  /** AUDIT OW4 D4: the found spawns within the far range that the index does not hold (filedSpawns) - online alone, as
   *  the spawns are (spawnedDungeonAt's own gate). The store files a spawn under its pixel's id (spawnedMapId). */
  const tvFiledSpawns = (at) => (params.has('online') ? filedSpawns({ at, rolls: (x, y) => spawnsDungeon(_spawnSalt, x, y),
    filed: (x, y) => hasDiscoveredLocationId(spawnedMapId(_spawnSalt, x, y)), indexed: (x, y) => locationIndex.has(`${x},${y}`), stand: tvSpawnAt }) : []);
  function travelViewDungeons() {
    if (typeof host._tvListsReady !== 'undefined' && !host._tvListsReady) return [];   // BOOT-TDZ II (typeof: a slice lifted without the flag reads as standing)
    const at = playerTravelPixel();
    const dg = tvKnownGen();   // AUDIT ETHER-OW C2-2: the finds and the charts
    // AUDIT OW3 D1/D3: and the grid's reach (what TV2 plates), and the index's churn - a spawn comes as its pixel streams
    // and goes when its time runs out or a road takes it back, on a pixel the traveller has not left (AUDIT OW4 D5: its
    // generation - the size missed one spawn gone and another come in the same window)
    const grid = Math.max(1, state.terrainDistance ?? 3), n = `${host._locIndexGen}:${tvDungeonRowsAt.gen()}`;   // TVD-WORLD: and the lairs still owed
    // AUDIT OW4 D2: and time - a kept spawn whose clock has run out since is dropped now, asked of the kept list each time
    if (host.tvDng.list.some((g) => g.spawn && tvSpawnGone(g.px, g.py))) host.tvDng.at = null;
    if (host.tvDng.at && host.tvDng.at.x === at.x && host.tvDng.at.y === at.y && host.tvDng.dg === dg && host.tvDng.grid === grid && host.tvDng.n === n) return host.tvDng.list;
    const dungeons = tvDungeonRowsAt(at), locAt = tvDungeonAt, isFound = tvDungeonFound;   // TVD-WORLD: a lair past the Bay found by its own id
    const placed = (g) => {
      const r = locationWorldRect(g.loc, g.x, g.y);
      return { key: g.key, row: g.row, loc: g.loc, found: g.found, spawn: g.spawn, summary: g.found && !g.spawn ? tvDungeonSummary(g.x, g.y) : null,
        px: g.x, py: g.y, x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, rect: r };
    };
    const list = nearDungeons({ at, grid, dungeons, locAt, isFound, spawns: [...spawnedPixels(locationIndex), ...tvFiledSpawns(at)], spawnKnown: tvSpawnKnown,
      spawnFound: tvSpawnFound, spawnGone: (s) => tvSpawnGone(s.x, s.y) }).map(placed);
    host.tvDng = { at, dg, grid, n, list };
    return list;
  }
  return { travelViewDungeons, tvDungeonAt, tvDungeonFound, tvDungeonRowsAt, tvDungeonSummary, tvFiledSpawns, tvSpawnFound, tvSpawnKnown };
}

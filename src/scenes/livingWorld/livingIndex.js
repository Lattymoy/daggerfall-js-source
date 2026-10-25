// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW1 (2026-10-24, bible/03-World/World-Wide.md): THE LIVING WORLD'S TOWNS AND DUNGEONS, wherever the world's places
// stand. Out of scenes/world.js (HOST-SPLIT: the host wires it), where LW3's and LW6's two indices walked the game's own
// MAPS.BSA rows and filed each place by `y * 1000 + x` - the Bay's pixel id, one key for two pixels a thousand apart
// past the Bay. The index reads the world's registry (world/worldWide/worldPlaces.js) instead: the Bay's rows are its
// first provider, so on the Bay every record is the one the old index made (with its AREA beside its region); a
// provider past the Bay (TESA's places) is in it the moment it registers, and every book the index keeps is made again
// when the registry's generation moves.
//
//  - A TOWN is a place of a populated type (LW3: DFU's PopulatesWanderingNpcs, the host's `populated`): its record
//    `{ mapId, name, px, py, type, region, area, people, blocks, w, h, port }` - `people` the climate's under it (the
//    host's `peopleAt`, the composed climate past the Bay), `area` what the living world groups by (the region on the
//    Bay, the province's district past it - world/worldWide/worldGrid.js). One record a place, made the first time
//    anything asks for it.
//  - A DUNGEON is a place of a diver's kind (LW6: a labyrinth, a keep, a ruin, a graveyard).
//  - NEAR is a square of pixels about one (Chebyshev), sorted by map id - kept by (pixel, reach) as OW-HITCH kept it,
//    under the world's key.
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { livingNearKey, LIVING_NEAR_KEPT } from '../../systems/livingWorld/trips.js';
import { portIdOf } from '../../world/worldWide/worldPorts.js';   // WW3: a port's one number, the Bay's masked id or the world's key
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { theatreOfArea, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

/** AUDIT TESA II P7: WHERE THE LIVING WORLD'S PEOPLE GO - the Bay's theatre alone, until WW7 (bible/03-World/World-Wide.md):
 *  the places past the Bay are the registry's now (world/pastBayRows.js), each a town's record (townAt, townOfId,
 *  townOfPort, towns - its residents named and its port known), but never a trip's end, a dive's or a band's town - the
 *  ways' planner (systems/livingWorld/ways.js createWayBook, over the host's roads and ground) reads the Bay's, so a
 *  traveller set out from Windhelm would walk the Bay's. `townsNear`, `dungeonsNear` and `townsIn` answer the Bay's
 *  places alone, asked from the Bay alone, and a town past the Bay sails no traveller (livingLanes.js from).
 *  @param {{ px: number, py: number }} p */
export const livingRoams = (p) => inBay(p.px, p.py);

/** AUDIT TESA II P7: what a pixel past the Bay has near it for a trip - none. */
const NONE_NEAR = Object.freeze([]);

/** LW6: the dungeons an adventurer dives - the game's own rows of a dungeon's kind, each with its dungeon's type. */
export const LIVING_DIVE_TYPES = /** @type {Set<number>} */ (new Set([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard]));

/**
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, populated: (type: number) => boolean,
 *   peopleAt: (px: number, py: number) => number|undefined }} o
 */
export function createLivingIndex({ places, populated, peopleAt }) {
  let gen = -1;
  /** @type {Map<number, any>} */ const townById = new Map();
  /** @type {Map<number, any>} */ const dungeonById = new Map();
  /** @type {Map<number, any>|null} */ let towns = null;
  /** @type {Map<number, any>|null} */ let dungeons = null;
  /** @type {Map<number, any[]>} */ const byArea = new Map();
  /** @type {Map<number, any>|null} */ let byPort = null;
  /** @type {Map<number, any[]>} */ const townsNearKept = new Map();
  /** @type {Map<number, any[]>} */ const dungeonsNearKept = new Map();
  const fresh = () => {
    const g = places.generation();
    if (g === gen) return;
    gen = g;
    towns = null; dungeons = null; byPort = null;
    townById.clear(); dungeonById.clear(); byArea.clear(); townsNearKept.clear(); dungeonsNearKept.clear();
  };
  /** A place's town record - the same object every time it is asked this generation - or null for no town. */
  const townOf = (/** @type {import('../../world/worldWide/worldPlaces.js').WorldPlace|null} */ p) => {
    if (!p || !populated(p.type)) return null;
    let t = townById.get(p.mapId);
    if (!t) {
      t = {
        mapId: p.mapId, name: p.name, px: p.px, py: p.py, type: p.type, region: p.region, area: p.area,
        people: peopleAt(p.px, p.py), blocks: p.blocks,
        w: p.w, h: p.h,   // WALL-WAY: its grid's own shape - a road party leaves it past its walls
        port: p.port,
      };
      townById.set(t.mapId, t);
    }
    return t;
  };
  const dungeonOf = (/** @type {import('../../world/worldWide/worldPlaces.js').WorldPlace|null} */ p) => {
    if (!p || !LIVING_DIVE_TYPES.has(p.type)) return null;
    let d = dungeonById.get(p.mapId);
    if (!d) {
      d = { mapId: p.mapId, name: p.name, px: p.px, py: p.py, type: p.type, region: p.region, area: p.area, blocks: 1, dungeon: true, dungeonType: p.dungeonType };
      dungeonById.set(d.mapId, d);
    }
    return d;
  };
  /** Every LISTED town (a pixel provider's are found by place), by world key, the registry's order. */
  const townsIndex = () => {
    fresh();
    if (towns) return towns;
    towns = new Map();
    for (const p of places.all()) { const t = townOf(p); if (t) towns.set(p.key, t); }
    return towns;
  };
  const dungeonsIndex = () => {
    fresh();
    if (dungeons) return dungeons;
    dungeons = new Map();
    for (const p of places.all()) { const d = dungeonOf(p); if (d) dungeons.set(p.key, d); }
    return dungeons;
  };
  /** @param {typeof townOf} recOf @param {Map<number, any[]>} kept */
  const nearOf = (recOf, kept) => (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ r) => {
    fresh();
    if (!livingRoams({ px, py })) return NONE_NEAR;   // AUDIT TESA II P7: no trip sets out from past the Bay either
    const key = livingNearKey(px, py, r);   // OW-HITCH
    let got = kept.get(key);
    if (got) return got;
    got = [];
    for (const p of places.near(px, py, r)) { const t = livingRoams(p) ? recOf(p) : null; if (t) got.push(t); }   // AUDIT TESA II P7: the Bay's alone (livingRoams)
    got.sort((a, b) => a.mapId - b.mapId);
    if (kept.size > LIVING_NEAR_KEPT) kept.clear();
    kept.set(key, got);
    return got;
  };
  return {
    /** The registry's generation the books were made at moves - a reader keeping trips keeps them by it. */
    generation: () => places.generation(),
    /** Every listed town, by its world pixel key. */
    towns: townsIndex,
    /** The town on a pixel, or null. @param {number} px @param {number} py */
    townAt: (px, py) => { fresh(); return townOf(places.at(px, py)); },
    /** A town by its map id, or null. @param {number} id */
    townOfId: (id) => { fresh(); return townById.get(id) ?? townOf(places.byMapId(id)); },
    /** LW12: an area's towns (a region's on the Bay), the registry's order. @param {number} area */
    townsIn: (area) => {
      fresh();
      let got = byArea.get(area | 0);
      if (!got) { got = []; if (theatreOfArea(area | 0) === BAY_THEATRE) for (const p of places.inArea(area | 0)) { const t = townOf(p); if (t) got.push(t); } byArea.set(area | 0, got); }   // AUDIT TESA II P7: a band's towns the Bay's alone (livingRoams)
      return got;
    },
    /** The towns within `r` pixels, sorted by map id. */
    townsNear: nearOf(townOf, townsNearKept),
    /** LW5: the town a port id names (Travel Options' masked id; WW3: the world's key past the Bay - worldPorts.js
     *  portIdOf), or null. @param {number} portId */
    townOfPort: (portId) => {
      const all = townsIndex();
      if (!byPort) { byPort = new Map(); for (const t of all.values()) if (t.port) byPort.set(portIdOf(t), t); }
      return byPort.get(portId) ?? null;
    },
    /** Every listed dungeon, by its world pixel key. */
    dungeons: dungeonsIndex,
    /** A dungeon by its map id, or null. @param {number} id */
    dungeonOfId: (id) => { fresh(); return dungeonById.get(id >>> 0) ?? dungeonOf(places.byMapId(id)); },
    /** LW6: the dungeons within `r` pixels, sorted by map id. */
    dungeonsNear: nearOf(dungeonOf, dungeonsNearKept),
  };
}

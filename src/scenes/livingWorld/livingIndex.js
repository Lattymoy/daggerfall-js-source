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
//  - WW7-7 (2026-10-26, the owner: "Yes travellers to need to travel everywhere. Same for ships."): TWO SIDES OF THE
//    BAY'S EDGE (`livingSide`). Near, a town's travellers' ends, an area's bands: each the asker's own side's - the Bay's
//    places for a pixel of the Bay, the land past the Bay's for a pixel past it. The Bay is every client's, the land past
//    it only the clients that stand it (TAMRIEL2's switch is a player's own, online too): a Bay town that sent its people
//    past the edge would send them on one client and not the next, so the Bay's living world is the one it always was,
//    whatever a client stands, and the land past the Bay's is every client's that stands it.
//  - WW7-7: PAST THE BAY, BY THE ROADS' PLACES. The registry's pixel providers (the countryside, the lairs) are found by
//    place - its `near` asks each pixel of the square through their rolls, ~110 microseconds a pixel past the Bay (77 ms a
//    square of eighteen on the freeware's data), where the Bay's rows are listed. The roads past the Bay rolled every place
//    of the land to lay their roads to them (world/pastBayPlaces.js, TESA15: the same roll, every region's); past the Bay
//    a square is its listed places and the roads' places in it, each found on the registry (`at`, its own pixel) - the
//    walk's answer, place for place (pinned with ARENA2), a hundred times cheaper. So a square past the Bay is asked only
//    once the roads past the Bay are whole (`beyond.epoch()`: 0 while a region is still to land, and none is near), and its
//    books are made again whenever they are laid again (the epoch moves; the generation with it).
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { livingNearKey, LIVING_NEAR_KEPT } from '../../systems/livingWorld/trips.js';
import { portIdOf } from '../../world/worldWide/worldPorts.js';   // WW3: a port's one number, the Bay's masked id or the world's key
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { inEther } from '../../world/ethericSea.js';
import { theatreOfArea, districtOfArea, inWorldGrid, BAY_THEATRE, DISTRICT_PX, WORLD_PIXEL_SPAN } from '../../world/worldWide/worldGrid.js';

/** WW7-7: THE SIDES OF THE BAY'S EDGE a trip keeps to - the Bay's (every client's), the land past it (the clients that
 *  stand it), none (the Eltheric Ocean's box, off the world's grid: no living world there). */
export const LIVING_SIDES = Object.freeze({ none: -1, bay: 0, beyond: 1 });
/** WW7-7: the side of the Bay's edge a place or a pixel is on. @param {{ px: number, py: number }} p */
export const livingSide = (p) => (inBay(p.px, p.py) ? LIVING_SIDES.bay : inWorldGrid(p.px, p.py) && !inEther(p.px, p.py) ? LIVING_SIDES.beyond : LIVING_SIDES.none);
/** WW7-7: a square past the Bay's listed places are kept in bins this many pixels a side. */
export const BEYOND_BIN_PX = 64;

/** What a pixel has near it for a trip while its side's places are not known - none. */
const NONE_NEAR = Object.freeze([]);

/** LW6: the dungeons an adventurer dives - the game's own rows of a dungeon's kind, each with its dungeon's type. */
export const LIVING_DIVE_TYPES = /** @type {Set<number>} */ (new Set([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard]));

/**
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, populated: (type: number) => boolean,
 *   peopleAt: (px: number, py: number) => number|undefined,
 *   beyond?: { epoch: () => number, placesIn: (x0: number, y0: number, x1: number, y1: number) => Array<{ x: number, y: number }> } | null }} o
 *   WW7-7 `beyond` the land past the Bay's: `epoch` the roads past the Bay's (0 while a region is still to land, else a
 *   stamp that moves when they are laid again), `placesIn` the places they rolled on x0 <= x < x1, y0 <= y < y1
 *   (world/pastBayPlaces.js pastBayPlacesIn). None: no place past the Bay is ever near.
 */
export function createLivingIndex({ places, populated, peopleAt, beyond = null }) {
  let gen = -1, epoch = -1, stamp = 0;
  /** WW7-7: the listed places past the Bay, in BEYOND_BIN_PX bins. @type {Map<number, any[]>|null} */ let bins = null;
  /** @type {Map<number, any>} */ const townById = new Map();
  /** @type {Map<number, any>} */ const dungeonById = new Map();
  /** @type {Map<number, any>|null} */ let towns = null;
  /** @type {Map<number, any>|null} */ let dungeons = null;
  /** @type {Map<number, any[]>} */ const byArea = new Map();
  /** @type {Map<number, any>|null} */ let byPort = null;
  /** @type {Map<number, any[]>} */ const townsNearKept = new Map();
  /** @type {Map<number, any[]>} */ const dungeonsNearKept = new Map();
  const fresh = () => {
    const g = places.generation(), e = beyond?.epoch() ?? 0;
    if (g === gen && e === epoch) return;
    if (g !== gen) { towns = null; dungeons = null; byPort = null; townById.clear(); dungeonById.clear(); }
    gen = g; epoch = e; stamp++;
    bins = null;
    byArea.clear(); townsNearKept.clear(); dungeonsNearKept.clear();
  };
  /** WW7-7: the places on x0 <= x < x1, y0 <= y < y1 past the Bay, each once - the listed, then the roads' found on the
   *  registry - or none while the roads past the Bay are not whole. */
  const beyondIn = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => {
    if (!beyond || !epoch) return NONE_NEAR;
    if (!bins) {
      bins = new Map();
      for (const p of places.all()) {
        if (livingSide(p) !== LIVING_SIDES.beyond) continue;
        const k = Math.floor(p.py / BEYOND_BIN_PX) * 65536 + Math.floor(p.px / BEYOND_BIN_PX);
        let bin = bins.get(k);
        if (!bin) bins.set(k, (bin = []));
        bin.push(p);
      }
    }
    /** @type {Map<number, import('../../world/worldWide/worldPlaces.js').WorldPlace>} */ const got = new Map();
    for (let by = Math.floor(y0 / BEYOND_BIN_PX); by <= Math.floor((y1 - 1) / BEYOND_BIN_PX); by++) {
      for (let bx = Math.floor(x0 / BEYOND_BIN_PX); bx <= Math.floor((x1 - 1) / BEYOND_BIN_PX); bx++) {
        for (const p of bins.get(by * 65536 + bx) ?? NONE_NEAR) if (p.px >= x0 && p.px < x1 && p.py >= y0 && p.py < y1) got.set(p.key, p);
      }
    }
    for (const q of beyond.placesIn(x0, y0, x1, y1)) {
      const p = places.at(q.x, q.y);
      if (p && livingSide(p) === LIVING_SIDES.beyond) got.set(p.key, p);
    }
    return [...got.values()];
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
    const side = livingSide({ px, py });
    const key = livingNearKey(px, py, r);   // OW-HITCH
    let got = kept.get(key);
    if (got) return got;
    got = [];
    if (side === LIVING_SIDES.bay) { for (const p of places.near(px, py, r)) { const t = livingSide(p) === LIVING_SIDES.bay ? recOf(p) : null; if (t) got.push(t); } }   // WW7-7: the Bay's alone for a pixel of the Bay
    else if (side === LIVING_SIDES.beyond) for (const p of beyondIn(px - r, py - r, px + r + 1, py + r + 1)) { const t = recOf(p); if (t) got.push(t); }   // WW7-7: past the Bay its own, by the roads' places (none before they are whole); past the Veil none
    got.sort((a, b) => a.mapId - b.mapId);
    if (kept.size > LIVING_NEAR_KEPT) kept.clear();
    kept.set(key, got);
    return got;
  };
  return {
    /** The registry's generation the books were made at moves - a reader keeping trips keeps them by it. WW7-7: and the
     *  roads past the Bay's epoch - a stamp that moves with either. */
    generation: () => { fresh(); return stamp; },
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
      if (!got) {
        got = [];
        const d = districtOfArea(area | 0);
        if (theatreOfArea(area | 0) === BAY_THEATRE) { for (const p of places.inArea(area | 0)) { const t = townOf(p); if (t) got.push(t); } }
        else if (d) {   // WW7-7: a province's district - its towns by the roads' places (never its 9,216 pixels through the rolls)
          const x0 = d[0] * DISTRICT_PX - WORLD_PIXEL_SPAN, y0 = d[1] * DISTRICT_PX - WORLD_PIXEL_SPAN;
          for (const p of beyondIn(x0, y0, x0 + DISTRICT_PX, y0 + DISTRICT_PX)) { const t = p.area === (area | 0) ? townOf(p) : null; if (t) got.push(t); }
          got.sort((a, b) => a.mapId - b.mapId);
        }
        byArea.set(area | 0, got);
      }
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

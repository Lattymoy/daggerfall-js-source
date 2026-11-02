// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW1 (2026-10-24, bible/03-World/World-Wide.md) - THE WORLD'S PLACES: the one door the systems read the world's places
// through, wherever they stand.
//
// Every system that walked the world's places walked MAPS.BSA - `for (let r = 0; r < maps.regionCount; r++)` - and filed
// them by `y * 1000 + x`, so nothing past the Bay could ever be one of them, however it was stood. The registry is the
// one door: a PROVIDER registers its places by name, the Bay's own first (world/worldWide/bayPlaces.js, the game's own
// rows - HUB1's law: a world-data mod's addition stands on one client and not another, so it is never a system's), and
// a provider past the Bay (TESA's places, PR #1184) registers its own the same way, any time after the boot. Every
// reader asks the registry; nothing reads a provider's rows.
//
//  - TWO KINDS OF PROVIDER. A LIST hands in its rows (`register` - the Bay's 15,000, a province's cities and capitals);
//    a PIXEL provider hands in a function that answers the place on a pixel, or none (`registerPixels` - a countryside
//    rolled pixel by pixel, a hundred thousand places nobody lists up front). A list's places are listed (`all`, an area's,
//    a theatre's); a pixel provider's are found by place (`at`, `near`) and, for an area past the Bay, by walking its
//    district's pixels once (`inArea`).
//  - ONE PLACE A PIXEL. A pixel holds the place of the first list that registered one there (and of a list the first
//    row), else the first pixel provider's - the game's location index's own law ("One location per map pixel
//    game-wide"). A list's row on a held pixel or map id is counted (`shadowed`) and stands nowhere.
//  - A GENERATION. Every register and drop moves it; a reader that keeps an answer off the registry keeps it by the
//    generation it read (the living world's books, the event scans).
//  - EACH PLACE KNOWS ITS AREA AND ITS THEATRE (world/worldWide/worldGrid.js): the Bay's region and theatre 0 on the Bay,
//    the province's district and the province past it. `region` is the politic map's - the Bay's row's region, WW-R a
//    province's past the Bay (formats/mapsTables.js regionOfTheatre), -1 for a place no province holds.
//
// Pure: plain records in, answers out. Not a DFU member: DFU has the Bay and nothing past it. Ledger A (WW1).
// ═══════════════════════════════════════════════════════════════════
import {
  worldPixelKey,
  inWorldGrid,
  theatreAt,
  theatreOfArea,
  districtOfArea,
  areaAt,
  BAY_THEATRE,
  DISTRICT_PX,
  WORLD_PIXEL_SPAN,
} from './worldGrid.js';
import { inBay } from '../tamriel/tamrielFrame.js';
import { regionOfTheatre } from '../../formats/mapsTables.js'; // WW-R: a province's region

/**
 * @typedef {{ mapId: number, name: string, px: number, py: number, type: number, region?: number, area?: number,
 *   w?: number, h?: number, port?: boolean, dungeonType?: number, hasDungeon?: boolean, location?: number }} PlaceRow - what a provider hands
 *   in: the place's map id (unique across the world - MAPS.BSA's own, a provider past the Bay its own lanes), its pixel in
 *   the Bay's coordinates (negative west and north of the Bay), its MAPS location type, and its RMB grid's width and
 *   height; `region` MapsFile's (the Bay's rows), `area` where a provider knows better than the pixel; WW7-5: `location`
 *   its location's index (a place past the Bay its own, negative - the town economy's report names it)
 * @typedef {{ key: number, mapId: number, name: string, px: number, py: number, type: number, region: number, area: number,
 *   theatre: number, w: number, h: number, blocks: number, port: boolean, dungeonType: number, hasDungeon: boolean,
 *   source: string, location: ?number }} WorldPlace - a place as every system reads it
 */

/** How many pixels' answers from the pixel providers are kept before the keeping starts again. */
export const PIXEL_PLACES_KEPT = 65536;

/**
 * A place's record, from a provider's row. On the Bay a row's area is its region (the Bay's areas ARE its regions);
 * past it the province's district under the pixel, or the row's own.
 * @param {PlaceRow} row @param {string} source @returns {WorldPlace|null}
 */
export function placeOfRow(row, source) {
  const px = row?.px,
    py = row?.py;
  if (!inWorldGrid(px, py) || !Number.isFinite(row?.mapId)) return null;
  const bay = inBay(px, py);
  const bayRegion = Number.isInteger(row.region) && bay ? /** @type {number} */ (row.region) : -1;
  const area = Number.isInteger(row.area) ? /** @type {number} */ (row.area) : areaAt(px, py, () => bayRegion);
  const theatre = bay ? BAY_THEATRE : area >= 0 ? theatreOfArea(area) : theatreAt(px, py);
  const region = bay ? bayRegion : regionOfTheatre(theatre); // WW-R: past the Bay its province's region
  const w = Math.max(1, row.w ?? 1),
    h = Math.max(1, row.h ?? 1);
  return Object.freeze({
    key: worldPixelKey(px, py),
    mapId: row.mapId >>> 0,
    name: String(row.name ?? ''),
    px,
    py,
    type: row.type | 0,
    region,
    area,
    theatre,
    w,
    h,
    blocks: w * h,
    port: !!row.port,
    dungeonType: row.dungeonType ?? 0,
    hasDungeon: !!row.hasDungeon,
    source,
    location: Number.isSafeInteger(row.location) ? /** @type {number} */ (row.location) : null, // WW7-5
  });
}

/** The registry. */
export function createWorldPlaces() {
  /** @type {Map<string, WorldPlace[]>} */
  const lists = new Map();
  /** @type {Map<string, (px: number, py: number) => PlaceRow|null|undefined>} */
  const pixels = new Map();
  /** NOTICE-PANEL (AUDIT FB1029g P1): a pixel provider's map id read back to its pixel - so a place is found by its id
   *  before anything asked its pixel (a town's panel, its counters' prices). @type {Map<string, (mapId: number) => ({ x: number, y: number }|null)>} */
  const pixelOfId = new Map();
  let generation = 0;
  /** @type {{ byKey: Map<number, WorldPlace>, byMapId: Map<number, WorldPlace>, list: WorldPlace[], byArea: Map<number, WorldPlace[]>, byTheatre: Map<number, WorldPlace[]>, shadowed: number } | null} */
  let idx = null;
  /** a pixel provider's answers: by world key, the place or null; by map id, the places found so far */
  /** @type {Map<number, WorldPlace|null>} */ const pixelKept = new Map();
  /** @type {Map<number, WorldPlace>} */ const pixelById = new Map();
  /** @type {Map<number, WorldPlace[]>} */ const areaKept = new Map();
  const moved = () => {
    generation++;
    idx = null;
    pixelKept.clear();
    pixelById.clear();
    areaKept.clear();
  };
  /** AUDIT TESA II P7: the LIVE lists - a list whose rows move with the world under them (TESA's places, made again when
   *  the trace, the fit or the land moves): asked their stamp at every read, made again (a register: the generation
   *  moves) the read after it moved. @type {Map<string, { stamp: () => readonly any[], rows: () => Iterable<PlaceRow>, seen: readonly any[]|null }>} */
  const live = new Map();
  const sameStamp = (/** @type {readonly any[]|null} */ a, /** @type {readonly any[]} */ b) =>
    !!a && a.length === b.length && a.every((v, i) => v === b[i]);
  const sync = () => {
    for (const [source, l] of live) {
      const s = l.stamp();
      if (sameStamp(l.seen, s)) continue;
      l.seen = s;
      /** @type {WorldPlace[]} */ const made = [];
      for (const row of l.rows() ?? []) {
        const p = placeOfRow(row, source);
        if (p) made.push(p);
      }
      lists.set(source, made);
      moved();
    }
  };
  const build = () => {
    if (live.size) sync();
    if (idx) return idx;
    const byKey = new Map(),
      byMapId = new Map(),
      byArea = new Map(),
      byTheatre = new Map();
    /** @type {WorldPlace[]} */ const list = [];
    let shadowed = 0;
    for (const rows of lists.values()) {
      for (const p of rows) {
        if (byKey.has(p.key) || byMapId.has(p.mapId)) {
          shadowed++;
          continue;
        }
        byKey.set(p.key, p);
        byMapId.set(p.mapId, p);
        list.push(p);
        if (!byArea.has(p.area)) byArea.set(p.area, []);
        byArea.get(p.area).push(p);
        if (!byTheatre.has(p.theatre)) byTheatre.set(p.theatre, []);
        byTheatre.get(p.theatre).push(p);
      }
    }
    return (idx = { byKey, byMapId, list, byArea, byTheatre, shadowed });
  };
  /** The place on a pixel of the grid: a list's, else the first pixel provider's that answers one ON that pixel. */
  const at = (/** @type {number} */ px, /** @type {number} */ py) => {
    if (!inWorldGrid(px, py)) return null;
    const key = worldPixelKey(px, py);
    const listed = build().byKey.get(key);
    if (listed || !pixels.size) return listed ?? null;
    let p = pixelKept.get(key);
    if (p !== undefined) return p;
    p = null;
    for (const [source, fn] of pixels) {
      const row = fn(px, py);
      if (!row || row.px !== px || row.py !== py) continue;
      const made = placeOfRow(row, source);
      if (!made || build().byMapId.has(made.mapId)) continue;
      p = made;
      break;
    }
    if (pixelKept.size >= PIXEL_PLACES_KEPT) pixelKept.clear();
    pixelKept.set(key, p);
    if (p) pixelById.set(p.mapId, p);
    return p;
  };
  const NONE = Object.freeze([]);
  return {
    /** A list provider's places, by its name - a second register of the same name replaces its first.
     *  @param {string} source @param {Iterable<PlaceRow>} rows @returns {number} how many rows made a place */
    register(source, rows) {
      /** @type {WorldPlace[]} */ const made = [];
      for (const row of rows ?? []) {
        const p = placeOfRow(row, source);
        if (p) made.push(p);
      }
      pixels.delete(source);
      pixelOfId.delete(source);
      live.delete(source);
      lists.set(source, made);
      moved();
      return made.length;
    },
    /** A pixel provider, by its name: `at(px, py)` the place it stands on that pixel (its own pixel - an answer for
     *  another is no answer), or none. Pure and the same on every client, as a list is.
     *  `idPixel` its map id read back to the pixel it stands on (null for an id not its own), so `byMapId` finds its place
     *  unasked. @param {string} source @param {(px: number, py: number) => PlaceRow|null|undefined} fn
     *  @param {((mapId: number) => ({ x: number, y: number }|null))=} idPixel */
    registerPixels(source, fn, idPixel) {
      lists.delete(source);
      live.delete(source);
      pixels.set(source, fn);
      if (idPixel) pixelOfId.set(source, idPixel);
      else pixelOfId.delete(source);
      moved();
    },
    /** AUDIT TESA II P7: a LIVE list provider, by its name - `rows()` its rows as they stand now, `stamp()` a list of what
     *  they are made of (compared item by item: the trace, the fit, the land); every read asks the stamp, and the rows are
     *  made again (the generation moving) when it moved. Pure and the same on every client, as a list is.
     *  @param {string} source @param {{ stamp: () => readonly any[], rows: () => Iterable<PlaceRow> }} o */
    registerLive(source, { stamp, rows }) {
      pixels.delete(source);
      pixelOfId.delete(source);
      lists.delete(source);
      live.set(source, { stamp, rows, seen: null });
      moved();
    },
    /** A provider's places gone. @param {string} source */
    drop(source) {
      const a = lists.delete(source),
        b = pixels.delete(source),
        c = live.delete(source);
      pixelOfId.delete(source);
      if (a || b || c) moved();
    },
    /** Moves on every register and drop - and, AUDIT TESA II P7, when a live list's stamp moved. */
    generation: () => {
      if (live.size) sync();
      return generation;
    },
    /** The providers, lists first, each in the order it registered. */
    sources: () => [...new Set([...lists.keys(), ...live.keys()]), ...pixels.keys()],
    /** Every LISTED place, the providers' order (a pixel provider's are found by place). */
    all: () => build().list,
    /** The place on a pixel, or null. */
    at,
    /** The place of a map id - a list's, or a pixel provider's (found, or read back to its pixel) - or null. @param {number} mapId */
    byMapId(mapId) {
      const id = mapId >>> 0,
        got = build().byMapId.get(id) ?? pixelById.get(id);
      if (got) return got;
      for (const read of pixelOfId.values()) {
        const px = read(id),
          p = px ? at(px.x, px.y) : null;
        if (p?.mapId === id) return p;
      }
      return null;
    },
    /** An area's places: its lists', and past the Bay its district's pixel providers' (its district walked once a
     *  generation). @param {number} area */
    inArea(area) {
      const listed = build().byArea.get(area) ?? NONE;
      const d = pixels.size ? districtOfArea(area) : null;
      if (!d) return listed;
      let got = areaKept.get(area);
      if (got) return got;
      got = [...listed];
      const x0 = d[0] * DISTRICT_PX - WORLD_PIXEL_SPAN,
        y0 = d[1] * DISTRICT_PX - WORLD_PIXEL_SPAN;
      for (let y = y0; y < y0 + DISTRICT_PX; y++)
        for (let x = x0; x < x0 + DISTRICT_PX; x++) {
          if (build().byKey.has(worldPixelKey(x, y))) continue;
          const p = at(x, y);
          if (p && p.area === area) got.push(p);
        }
      areaKept.set(area, got);
      return got;
    },
    /** The areas that hold a LISTED place, ascending. */
    areas: () => [...build().byArea.keys()].filter((a) => a >= 0).sort((a, b) => a - b),
    /** A theatre's LISTED places. @param {number} t */
    inTheatre: (t) => build().byTheatre.get(t) ?? NONE,
    /** The theatres that hold a LISTED place, ascending. */
    theatres: () => [...build().byTheatre.keys()].filter((t) => t >= 0).sort((a, b) => a - b),
    /** The places within `r` pixels (Chebyshev) of a pixel, row by row from the north-west, filtered.
     *  @param {number} px @param {number} py @param {number} r @param {(p: WorldPlace) => boolean} [keep] */
    near(px, py, r, keep) {
      /** @type {WorldPlace[]} */ const got = [];
      for (let y = py - r; y <= py + r; y++)
        for (let x = px - r; x <= px + r; x++) {
          const p = at(x, y);
          if (p && (!keep || keep(p))) got.push(p);
        }
      return got;
    },
    /** Rows a list handed in that stood on a held pixel (or a held map id) and stand nowhere. */
    shadowed: () => build().shadowed,
  };
}

/** @typedef {ReturnType<typeof createWorldPlaces>} WorldPlaces */

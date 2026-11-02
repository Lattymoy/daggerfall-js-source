// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW1 (2026-10-24, bible/03-World/World-Wide.md) - THE WORLD'S GRID: the one key, the theatres and the areas every
// system reads once the world is more than the Iliac Bay.
//
// The owner: "My goal for you is expanding our systems, if not already, out into the entire world. Living world,
// ships, world events, etc. Everything so its not centralized to just daggerfall. That means we can expand world events
// to happen more than once at a time since the world will be massive. No band aids."
//
// THREE LAWS, each one home:
//
//  - A PIXEL'S KEY. The systems filed a place by `y * 1000 + x` - MapsFile's own pixel id (DFU's GetMapPixelID), unique
//    on the Bay's 1000 x 500 and nowhere else: past the Bay (TAMRIEL2's land, the frame's -862..5138 west to east) two
//    pixels a thousand apart share it. `worldPixelKey` is one whole number for every pixel the wire carries
//    (net/wire.js WORLD_PIXEL_BOUND, pinned equal - not imported: the terrain worker may read this module, and its graph
//    is world/ and formats/ alone, TAMRIEL2-WORKER).
//
//  - A THEATRE. Where one instance of a world event lives. The Iliac Bay is one - Daggerfall's own map, every system's
//    data where there is data, kept as it was - and each of the nine provinces BEYOND the Bay's rectangle is another
//    (TAMRIEL3's picture: High Rock past the Bay's north edge, Hammerfell past its east, Skyrim, Morrowind and the rest).
//    A family that runs one at a time runs one a theatre, so the count of events at once grows with the world that holds
//    places for them, and the Bay's own is exactly what it was.
//
//  - AN AREA. What a region was to a system that grouped by it (the outlaws' bands, a patrol's beat, the raids' draw):
//    on the Bay the region itself, 0..61, the same number; past it a province's DISTRICT, a square about a region's size
//    (62 and up). NOT A REGION:
//    the 62 regions are the wall the online game stands on (chat, banks, law, prices, seats - TESA3, and the owner's
//    call on the provinces as regions of their own); an area is the systems' own grouping and never goes on the wire as
//    a region.
// ═══════════════════════════════════════════════════════════════════
import { inBay, bayToPicture } from '../tamriel/tamrielFrame.js';
import { provinceKeyAt, PROVINCE_OF_ID } from '../tamriel/tamrielLand.js';
import { provinceByKey } from '../tamriel/tamrielGeography.js';
import { REGION_NAMES, REGION_RACES, BAY_REGION_COUNT } from '../../formats/mapsTables.js';

// ═══ THE KEY ═════════════════════════════════════════════════════════

/** A map pixel the world holds lies within this of the Bay's corner, either way, on both axes (net/wire.js
 *  WORLD_PIXEL_BOUND - pinned equal by test/world/worldWide/ww1_grid.test.js). */
export const WORLD_PIXEL_SPAN = 8192;
const SIDE = 2 * WORLD_PIXEL_SPAN;

/** Is (px, py) a whole pixel of the world's grid? */
export const inWorldGrid = (px, py) =>
  Number.isInteger(px) && Number.isInteger(py) && Math.abs(px) < WORLD_PIXEL_SPAN && Math.abs(py) < WORLD_PIXEL_SPAN;

/** A pixel's one key over the whole world - a whole number in [0, 2^28), distinct for every pixel of the grid. The
 *  Bay's `y * 1000 + x` is not it (that is MapsFile's pixel id, a MapId's low 20 bits, and stays theirs).
 *  @param {number} px @param {number} py */
export const worldPixelKey = (px, py) => (py + WORLD_PIXEL_SPAN) * SIDE + (px + WORLD_PIXEL_SPAN);

/** How many keys there are: every key is under this (a reach or a layer kept beside one is its multiple). */
export const WORLD_PIXEL_KEYS = SIDE * SIDE;

/** The pixel a key names: [px, py]. @param {number} key */
export const worldPixelOfKey = (key) => [(key % SIDE) - WORLD_PIXEL_SPAN, Math.floor(key / SIDE) - WORLD_PIXEL_SPAN];

// ═══ THE THEATRES ════════════════════════════════════════════════════

/** The Iliac Bay's theatre: Daggerfall's own 1000 x 500. */
export const BAY_THEATRE = 0;
/** Theatre `t` (1..9) beyond the Bay is the province of PROVINCE_OF_ID's id `t` - TAMRIEL3's picker's own numbering
 *  (world/tamriel/tamrielLand.js: 1..8 the races, 9 the Imperial Province). */
export const THEATRE_COUNT = 10;
/** Each theatre's key: the Bay's, then the provinces' (world/tamriel/tamrielLand.js PROVINCE_OF_ID). */
export const THEATRE_KEYS = Object.freeze([
  'IliacBay',
  ...Array.from({ length: THEATRE_COUNT - 1 }, (_, i) => PROVINCE_OF_ID[/** @type {1} */ (i + 1)]),
]);
const THEATRE_OF_PROVINCE = new Map(THEATRE_KEYS.map((k, t) => [k, t]));

/** A theatre past the Bay's name, as a player reads it: its province's ("Skyrim"); the Bay's own names are its regions'
 *  (none here). @param {number} t */
export const theatreName = (t) => (t === BAY_THEATRE ? '' : (provinceByKey(THEATRE_KEYS[t])?.name ?? ''));

/** The theatre a pixel stands in: the Bay's on the Bay's own map, else the province the picture (or the authored
 *  shape, untraced) puts the pixel's centre in; -1 at sea past the Bay and off the continent.
 *  @param {number} px @param {number} py */
export function theatreAt(px, py) {
  if (inBay(px, py)) return BAY_THEATRE;
  const [x, y] = bayToPicture(px + 0.5, py + 0.5);
  const key = provinceKeyAt(x, y);
  return key == null ? -1 : (THEATRE_OF_PROVINCE.get(key) ?? -1);
}

// ═══ THE AREAS ═══════════════════════════════════════════════════════

/** The Bay's areas are its regions, 0..61 (MapsFile's REGION_NAMES). */
export const BAY_AREA_COUNT = BAY_REGION_COUNT; // WW-R: the Bay's 62 - REGION_NAMES holds the provinces' regions after them, never an area
/** Past the Bay a province is cut into DISTRICTS on a square of this many pixels (in the Bay's own coordinates, so a
 *  district never moves with the picture's fit) - about a Bay region's size: the Bay's 62 regions share its 500,000
 *  pixels, some 8,000 each, and a district is 9,216. A province the size of Skyrim is then a few dozen areas, as the
 *  Bay is, where one area a province would have held all of Skyrim to one region's outlaws. */
export const DISTRICT_PX = 96;
/** Districts across the world's grid, each way. */
export const DISTRICTS_ACROSS = Math.ceil((2 * WORLD_PIXEL_SPAN) / DISTRICT_PX);
/** An area past the Bay is BAY_AREA_COUNT + its theatre's slot + THEATRE_SLOTS times its district's index - one whole
 *  number for each (district, province), a province's part of a district its own area where a border cuts it. */
const THEATRE_SLOTS = 16;
/** Every area is under this: the Bay's 62, then a district's slots. */
export const AREA_COUNT = BAY_AREA_COUNT + THEATRE_SLOTS * DISTRICTS_ACROSS * DISTRICTS_ACROSS;

/** The district a pixel stands in, [cx, cy] on the districts' grid. @param {number} px @param {number} py */
export const districtOf = (px, py) => [
  Math.floor((px + WORLD_PIXEL_SPAN) / DISTRICT_PX),
  Math.floor((py + WORLD_PIXEL_SPAN) / DISTRICT_PX),
];

/** The area of a province's part of a district (theatre 1..9, a district's [cx, cy]); -1 for the Bay's theatre and none.
 *  @param {number} t @param {number} cx @param {number} cy */
export function areaOfDistrict(t, cx, cy) {
  if (!Number.isInteger(t) || t <= BAY_THEATRE || t >= THEATRE_COUNT) return -1;
  if (
    !Number.isInteger(cx) ||
    !Number.isInteger(cy) ||
    cx < 0 ||
    cy < 0 ||
    cx >= DISTRICTS_ACROSS ||
    cy >= DISTRICTS_ACROSS
  )
    return -1;
  return BAY_AREA_COUNT + (t - 1) + THEATRE_SLOTS * (cy * DISTRICTS_ACROSS + cx);
}
/** The theatre an area stands in, or -1. @param {number} a */
export const theatreOfArea = (a) =>
  !Number.isInteger(a) || a < 0 || a >= AREA_COUNT
    ? -1
    : a < BAY_AREA_COUNT
      ? BAY_THEATRE
      : ((a - BAY_AREA_COUNT) % THEATRE_SLOTS) + 1;
/** A district area's district, [cx, cy]; null for a Bay area and none. @param {number} a */
export const districtOfArea = (a) => {
  if (theatreOfArea(a) <= BAY_THEATRE) return null;
  const d = Math.floor((a - BAY_AREA_COUNT) / THEATRE_SLOTS);
  return [d % DISTRICTS_ACROSS, Math.floor(d / DISTRICTS_ACROSS)];
};
/** Is an area one of the Bay's regions (the number a region-keyed system may read as its region)? @param {number} a */
export const isBayArea = (a) => Number.isInteger(a) && a >= 0 && a < BAY_AREA_COUNT;

/** The area a pixel stands in: on the Bay its region (`regionAt` - MapsFile.getRegionIndexAt), past it its province's
 *  district; -1 where no province is.
 *  @param {number} px @param {number} py @param {(px: number, py: number) => number} regionAt */
export function areaAt(px, py, regionAt) {
  if (inBay(px, py)) return regionAt(px, py);
  const [cx, cy] = districtOf(px, py);
  return areaOfDistrict(theatreAt(px, py), cx, cy);
}

/** An area's name: the region's on the Bay, its province's past it. @param {number} a */
export const areaName = (a) => (isBayArea(a) ? REGION_NAMES[a] : theatreName(theatreOfArea(a)) || '');

/** The people an area's names and walkers are of (systems/races.js keys): on the Bay FALL.EXE's REGION_RACES (0 Breton,
 *  1 Redguard - MapsFile.GetNameBankOfRegion's own table, so the Bay's answer is DFU's), past it the province's race
 *  (world/tamriel/tamrielGeography.js PROVINCES), the Imperial Province's Imperial. Null for no area.
 *  @param {number} a @returns {string|null} */
export function areaRace(a) {
  if (isBayArea(a)) return REGION_RACES[a] === 1 ? 'Redguard' : 'Breton';
  const t = theatreOfArea(a);
  if (t <= BAY_THEATRE) return null;
  return provinceByKey(THEATRE_KEYS[t])?.race ?? 'Imperial';
}

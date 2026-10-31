// @ts-check
// REGION-HOTSPOT (bible/05-Combat/Fixed-PvE.md section 9): each area's hot spot, where its level 36-45 foes stand. On
// the Bay a region's own, measured from MAPS.BSA by tools/pveHotspots.mjs; past the Bay a province's 96-pixel district
// has its middle. A leaf: the table and the district grid, nothing else.
import { BAY_REGION_COUNT } from '../../formats/mapsTables.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { districtOf, DISTRICT_PX, WORLD_PIXEL_SPAN } from '../../world/worldWide/worldGrid.js';

/** BAY-OWN: each Bay region's [x, y, reach] in MAPS.BSA pixels - its land farthest from its edge and the sea, and how far
 *  its land runs from there (90th centile). Null for a region with no land. Made by tools/pveHotspots.mjs. */
export const BAY_HOTSPOTS = Object.freeze([
  [348,  456,  240],
  [748,  437,  221],
  null,
  null,
  [736,  494,  4],
  [524,  89,  72],
  null,
  null,
  null,
  [707,  208,  66],
  null,
  [614,  464,  109],
  null,
  null,
  null,
  null,
  [792,  75,  196],
  [188,  187,  93],
  [187,  114,  51],
  [116,  260,  13],
  [412,  397,  79],
  [398,  145,  82],
  [680,  301,  82],
  [891,  220,  76],
  null,
  null,
  [875,  158,  29],
  null,
  null,
  null,
  null,
  [971,  271,  4],
  [220,  36,  69],
  [824,  185,  38],
  [710,  112,  51],
  [681,  82,  38],
  [584,  121,  64],
  [610,  66,  48],
  [467,  21,  128],
  [453,  91,  51],
  [323,  27,  104],
  [383,  75,  43],
  [308,  133,  58],
  [193,  482,  36],
  [212,  444,  32],
  [247,  418,  20],
  [301,  416,  49],
  [467,  383,  71],
  [555,  336,  63],
  [713,  333,  26],
  [808,  297,  52],
  [842,  348,  94],
  [961,  318,  72],
  [847,  446,  67],
  [648,  427,  18],
  [467,  427,  37],
  [420,  466,  23],
  [982,  221,  43],
  [96,  128,  37],
  [125,  78,  48],
  [247,  96,  86],
  [428,  342,  9],
].map((h) => (h ? Object.freeze(h) : null)));
/** Past the Bay: a district's hot spot is its middle, and its reach the district's half diagonal. */
export const DISTRICT_REACH = Math.round(DISTRICT_PX * Math.SQRT1_2);

/**
 * The hot spot of the area (`px`, `py`) stands in: `[x, y, reach]`, or null for a Bay region with no land.
 * @param {number} px @param {number} py @param {number} region @returns {readonly number[]|null}
 */
export function hotspotAt(px, py, region) {
  if (inBay(px, py) && region < BAY_REGION_COUNT) return BAY_HOTSPOTS[region] ?? null;   // BAY-OWN: the Bay's regions
  const [cx, cy] = districtOf(px, py), half = DISTRICT_PX / 2;
  return [cx * DISTRICT_PX - WORLD_PIXEL_SPAN + half, cy * DISTRICT_PX - WORLD_PIXEL_SPAN + half, DISTRICT_REACH];
}

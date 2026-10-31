// @ts-check
// REGION-HOTSPOT (bible/05-Combat/Fixed-PvE.md section 9): where an area's hot spots - its level 36-45 foes - may stand.
// On the Bay the regions' hearts, measured from MAPS.BSA by tools/pveHotspots.mjs; past the Bay the middles of a
// province's 96-pixel districts. pveZones.js picks three. A leaf: the table and the map, nothing else.
import { inBay, bayToPicture } from '../../world/tamriel/tamrielFrame.js';
import { DISTRICT_PX, WORLD_PIXEL_SPAN } from '../../world/worldWide/worldGrid.js';
import { provinceAt } from '../../world/tamriel/tamrielGeography.js';

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
/**
 * Where an area's hot spots may stand: on the Bay its regions' hearts (BAY_HOTSPOTS); past it the middle of each
 * 96-pixel district the province's map (tamrielGeography.js provinceAt, fixed, the same on every machine) holds.
 * @param {string} area @returns {ReadonlyArray<readonly number[]>}
 */
export function hotspotCandidates(area) {
  if (area === 'IliacBay') return BAY_SPOTS;   // BAY-OWN: the Bay's regions
  if (!_byArea) {
    _byArea = new Map();
    const half = DISTRICT_PX / 2, n = Math.ceil((2 * WORLD_PIXEL_SPAN) / DISTRICT_PX);
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
      const x = cx * DISTRICT_PX - WORLD_PIXEL_SPAN + half, y = cy * DISTRICT_PX - WORLD_PIXEL_SPAN + half;
      if (inBay(x, y)) continue;
      const key = provinceAt(...bayToPicture(x, y))?.key;
      if (key) { if (!_byArea.has(key)) _byArea.set(key, []); _byArea.get(key).push(Object.freeze([x, y])); }
    }
  }
  return _byArea.get(area) ?? [];
}
const BAY_SPOTS = Object.freeze(BAY_HOTSPOTS.filter((h) => h).map((h) => Object.freeze([h[0], h[1]])));
/** @type {Map<string, Array<readonly number[]>>|null} */
let _byArea = null;

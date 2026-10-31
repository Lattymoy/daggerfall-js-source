// @ts-check
// RMB-CONTRACTS RMBC6 (bible/03-World/RMB-Contracts.md): a built pixel's town as the terrain worker's growth job - its
// theatre's style and its region beside it, the main thread's half of townGrowth.js (which the worker reaches alone).
import { townGrowthJob } from './townGrowth.js';
import { theatreAt, THEATRE_KEYS } from '../worldWide/worldGrid.js';
import { regionOfTheatre } from '../../formats/mapsTables.js';
import { inBay } from '../tamriel/tamrielFrame.js';

/** The growth job of a pixel's location, or null. @param {any} location @param {number} px @param {number} py */
export function growthJobAt(location, px, py) {
  if (!location) return null;
  const theatre = theatreAt(px, py);
  const style = THEATRE_KEYS[theatre] ?? 'IliacBay';
  const regionIndex = inBay(px, py) ? location.regionIndex ?? -1 : regionOfTheatre(theatre);
  return townGrowthJob(location, style, regionIndex);
}

/** RMBC8: the homes' town of a pixel with no location - its settlement's place, or 0. @param {any} settlement */
export const settlementHomeTown = (settlement) => (settlement && !settlement.growth ? settlement.mapId >>> 0 : 0);

/** RMBC8: a settlement pixel's homes' region - its province's past the Bay; 0 where none stands. @param {any} settlement
 *  @param {number} px @param {number} py */
export const settlementHomeRegion = (settlement, px, py) => (settlement ? regionOfTheatre(theatreAt(px, py)) : 0);

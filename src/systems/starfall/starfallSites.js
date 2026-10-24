// @ts-check
// STAR2 (2026-10-20): WHERE A NIGHT'S STARS FALL - three pixels in the wilds of the night's coven's region, the client's to
// find over the world's own data, every client finding the same. Design: bible/11-Multiplayer/Starfall.md section 2.
//
// THE GROUND IS THE GATE'S. A star falls on a pixel the Oblivion Gate's scan finds suitable (systems/gate/gateSite.js
// gateScanner - land, no location on it or its eight neighbours, 2 to 4 pixels from a town a traveller can fast travel
// to, MAPS.BSA's own rows alone), which is Daggerfall's own word for the Witches' Festival exactly: "the wilderness
// outside %cn". Each of a night's stars is drawn by hash (net/starfall/starfallLaw.js starRoll) from that region's list:
// STAR_APART_PX from the others and from the gate's site of its game day, near a town none of the others is named by
// where the region has them, the town the pixel's nearest. A region too small for three gives fewer; none gives none.
//
// Not a DFU member. Ledger A (STARFALL).
import { starRoll, starTimes, starSpotLocal, STAR_PER_NIGHT } from '../../net/starfall/starfallLaw.js';
import { gameDayAt } from '../../net/gate/gateLaw.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { starCovenOf } from './starfallCovens.js';
import { starSiteId } from '../../world/worldOfDaggerfall/wodShared.js';

const W = 1000;
/** How far apart a night's stars stand, and how far from the gate's site, map pixels (Chebyshev) - about four km. */
export const STAR_APART_PX = 5;
/** How many draws a star is given to find its pixel under the strict law (a town of its own), then the loose one. */
export const STAR_DRAWS = 32;

/**
 * @typedef {{ n: number, k: number, region: number, regionName: string, coven: import('./starfallCovens.js').StarCoven,
 *   px: number, py: number, town: {name: string, px: number, py: number, region: number}|null, near: string,
 *   spot: number[], times: ReturnType<typeof starTimes> }} StarSite
 */

const apart = (a, px, py) => Math.max(Math.abs(a.px - px), Math.abs(a.py - py)) >= STAR_APART_PX;

/**
 * THE NIGHT'S STARS: up to STAR_PER_NIGHT sites, star index order, each `{ n, k, region, regionName, coven, px, py, town,
 * near, spot, times }`. `gateSiteOf(day)` answers the gate's site of a game day (systems/gate/gateSite.js findGateSite) or
 * null. Pure over the scan.
 * @param {number} n the night
 * @param {import('../gate/gateSite.js').GateScan} scan
 * @param {{ gateSiteOf?: (day: number) => ({px: number, py: number}|null) }} [o]
 * @returns {StarSite[]}
 */
export function findStarSites(n, scan, { gateSiteOf = () => null } = {}) {
  const coven = starCovenOf(n);
  const pixels = scan?.byRegion?.get(coven.region);
  if (!pixels?.length) return [];
  /** @type {StarSite[]} */ const out = [];
  const towns = new Set();
  for (let k = 0; k < STAR_PER_NIGHT; k++) {
    const times = starTimes(n, k);
    const gate = gateSiteOf(gameDayAt(times.fallAt));
    const fits = (id, strict) => {
      const px = id % W, py = Math.floor(id / W);
      if (gate && !apart(gate, px, py)) return false;
      if (!out.every((s) => apart(s, px, py))) return false;
      return !strict || !towns.has(scan.townAt[id]);
    };
    let pick = -1;
    for (const strict of [true, false]) {
      for (let d = 0; d < STAR_DRAWS && pick < 0; d++) {
        const id = pixels[starRoll(n, k, 100 + d + (strict ? 0 : STAR_DRAWS)) % pixels.length];
        if (fits(id, strict)) pick = id;
      }
      if (pick >= 0) break;
    }
    if (pick < 0) continue;
    const town = scan.towns[scan.townAt[pick]] ?? null;
    towns.add(scan.townAt[pick]);
    const regionName = REGION_NAMES[coven.region] ?? '';
    out.push({ n, k, region: coven.region, regionName, coven, px: pick % W, py: Math.floor(pick / W), town, near: town?.name || regionName, spot: starSpotLocal(n, k), times });
  }
  return out;
}

/** A star's site key on the camp's law (world/worldOfDaggerfall/wodShared.js starSiteId): `px,py:star.<night>.<k>`. */
export const starSiteKey = (s) => starSiteId(s.px, s.py, s.n, s.k);

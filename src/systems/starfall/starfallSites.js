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
import { starRoll, starTimes, starSpotLocal, STAR_PER_NIGHT, starOfLane } from '../../net/starfall/starfallLaw.js';
import { gameDayAt } from '../../net/gate/gateLaw.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { starCovenOf } from './starfallCovens.js';
import { starSiteId } from '../../world/worldOfDaggerfall/wodShared.js';
import { worldPixelOfKey } from '../../world/worldWide/worldGrid.js'; // WW5: a theatre's pixels are the world's keys

const W = 1000;
/** How far apart a night's stars stand, and how far from the gate's site, map pixels (Chebyshev) - about four km. */
export const STAR_APART_PX = 5;
/** How many draws a star is given to find its pixel under the strict law (a town of its own), then the loose one. */
export const STAR_DRAWS = 32;

/**
 * @typedef {{ n: number, k: number, lane?: number, region: number, regionName: string, coven: import('./starfallCovens.js').StarCoven,
 *   px: number, py: number, town: {name: string, px: number, py: number, region: number, area?: number}|null, near: string,
 *   spot: number[], times: ReturnType<typeof starTimes> }} StarSite
 *   WW5: `lane` the theatre (a province's site's; the Bay's carry none, as before)
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
  const coven = /** @type {import('./starfallCovens.js').StarCoven} */ (starCovenOf(n));
  const pixels = scan?.byRegion?.get(coven.region);
  if (!pixels?.length) return [];
  /** @type {StarSite[]} */ const out = [];
  const towns = new Set();
  for (let k = 0; k < STAR_PER_NIGHT; k++) {
    const times = starTimes(n, k);
    const gate = gateSiteOf(gameDayAt(times.fallAt));
    const fits = (id, strict) => {
      const px = id % W,
        py = Math.floor(id / W);
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
    out.push({
      n,
      k,
      region: coven.region,
      regionName,
      coven,
      px: pick % W,
      py: Math.floor(pick / W),
      town,
      near: town?.name || regionName,
      spot: starSpotLocal(n, k),
      times,
    });
  }
  return out;
}

/** WW5: a theatre scan's every suitable pixel, ascending by the world's key (row by row, as the Bay scan lists a region's)
 *  - its areas' lists merged, made once a scan. */
const _theatrePixels = new WeakMap();
function theatrePixels(scan) {
  let l = _theatrePixels.get(scan);
  if (!l) {
    const all = [];
    for (const a of scan.byArea.values()) for (const k of a) all.push(k);
    l = Int32Array.from(all.sort((a, b) => a - b));
    _theatrePixels.set(scan, l);
  }
  return l;
}

/**
 * WW5 (bible/03-World/World-Wide.md WW5): A PROVINCE'S NIGHT - the stars of theatre `lane`'s coven (systems/starfall/
 * starfallCovens.js covensOfLane), drawn by findStarSites' own law over the province's own ground: the gate's suitable
 * pixels of its theatre (systems/gate/theatreGateSite.js scanTheatreGate - the registry's places, TESA's, the land's own
 * water, no place on a pixel or its eight neighbours, two to four pixels from a town) - the province is the coven's land,
 * as a Bay coven's region is its own. Each star STAR_APART_PX from the others and from its theatre's gate of that game day
 * (`gateSiteOf(day)` - the lane's day, net/gate/gateLaw.js gameDayAt), near a town none of the others is named by where the
 * province has them, the town the pixel's nearest. Its number the lane's (net/starfall/starfallLaw.js starOfLane), so its
 * rolls, its spot and its ledger are its own. `{ n, k, lane, region, regionName, coven, px, py, town, near, spot, times }`.
 * Pure over the scan; none for the Bay's lane (findStarSites) or a lane with no coven.
 * @param {number} n the night @param {number} lane the theatre
 * @param {import('../gate/theatreGateSite.js').TheatreGateScan} scan
 * @param {{ gateSiteOf?: (day: number) => ({px: number, py: number}|null) }} [o]
 * @returns {StarSite[]}
 */
export function findTheatreStarSites(n, lane, scan, { gateSiteOf = () => null } = {}) {
  const coven = lane > 0 ? starCovenOf(n, lane) : null;
  if (!coven || !scan?.byArea?.size) return [];
  const pixels = theatrePixels(scan);
  if (!pixels.length) return [];
  /** @type {StarSite[]} */ const out = [];
  const towns = new Set();
  const regionName = REGION_NAMES[coven.region] ?? '';
  for (let j = 0; j < STAR_PER_NIGHT; j++) {
    const k = starOfLane(lane, j);
    const times = starTimes(n, k);
    const gate = gateSiteOf(gameDayAt(times.fallAt, lane));
    const fits = (key, strict) => {
      const [px, py] = worldPixelOfKey(key);
      if (gate && !apart(gate, px, py)) return false;
      if (!out.every((s) => apart(s, px, py))) return false;
      return !strict || !towns.has(scan.townOf.get(key));
    };
    let pick = -1;
    for (const strict of [true, false]) {
      for (let d = 0; d < STAR_DRAWS && pick < 0; d++) {
        const key = pixels[starRoll(n, k, 100 + d + (strict ? 0 : STAR_DRAWS)) % pixels.length];
        if (fits(key, strict)) pick = key;
      }
      if (pick >= 0) break;
    }
    if (pick < 0) continue;
    const ti = scan.townOf.get(pick);
    const t = ti == null ? null : scan.towns[ti];
    towns.add(ti);
    const [px, py] = worldPixelOfKey(pick);
    const town = t ? { name: t.name, px: t.px, py: t.py, region: coven.region, area: t.area } : null;
    out.push({
      n,
      k,
      lane,
      region: coven.region,
      regionName,
      coven,
      px,
      py,
      town,
      near: town?.name || regionName,
      spot: starSpotLocal(n, k),
      times,
    });
  }
  return out;
}

/** A star's site key on the camp's law (world/worldOfDaggerfall/wodShared.js starSiteId): `px,py:star.<night>.<k>`. */
export const starSiteKey = (s) => starSiteId(s.px, s.py, s.n, s.k);

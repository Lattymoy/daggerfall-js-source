// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 7 - B2 = E1; the owner: "Every single
// thing here needs to be addressed. No exceptions.") - THE MARKET'S HUBS, THE PROVINCES' TOO
// (bible/06-Systems/Professions-Arc.md BAY-LEFT-SEA).
//
// The courier's road runs hub to hub (PROF0 26, net/marketLaw.js roadPixels): every market request hands the service
// the hubs this client derived, `{ [region]: [x, y] }`, and the service takes the witnesses' answer for a region, else
// the asking client's (marketLaw hubPixel). The hubs were HUB1's alone (systems/region/regionHubs.js pickRegionHubs),
// read off MAPS.BSA's rows, so the nine provinces past the Bay (regions 62-70, WW-R) had none: every buy, fill and bid
// between a province's board and any other region answered `market-no-road`, both ways - though the service has taken
// a hub on the world's grid since WW7-5 (marketLaw.js hubPixelOk).
//
// A PROVINCE'S HUB (`provinceHubOf`), on every client the same:
//   1. its CROWN SEAT's pixel - the province's capital's centre, the seat of power the seats past the Bay stand
//      (systems/town/townSeats.js replaceSeats' `powers`, WW7-3: a crown first);
//   2. else its LARGEST LISTED CITY on the world's registry (world/worldWide/worldPlaces.js - the capitals' slices and
//      Arena's places): HUB1's own claim on a registry row - a city over a town over a village (regionHubs.js
//      settlementRank), then the most blocks, then the lower map id. High Rock and Hammerfell past the Bay keep no
//      capital: theirs is the largest of Arena's city-states there.
//   A province that stands neither on this client (its places not yet landed, Arena not attached) has no hub of this
//   client's - the witnesses' answer, where one stands, is the road's.
// MADE AGAIN WHENEVER THE SEATS OR THE PLACES MOVE (`createMarketHubs`): the seats' book's `version` and the registry's
// `generation()` - the trace landing, Arena attached, the capitals standing. The Bay's hubs are HUB1's, byte for byte.
//
// Pure: the hubs, the seats' book and the registry are arguments. Not a DFU member (DFU has no market). No account
// change: the service's hub law already takes a pixel past the Bay.
// ═══════════════════════════════════════════════════════════════════
import { PROVINCE_REGION_NAMES, regionOfTheatre } from '../../formats/mapsTables.js';
import { settlementRank } from './regionHubs.js';

/** The province regions, past the Bay's 62 (WW-R: region 61 + theatre). */
export const PROVINCE_HUB_REGIONS = Object.freeze(PROVINCE_REGION_NAMES.map((_, i) => regionOfTheatre(i + 1)));

/**
 * A province region's hub pixel, `[x, y]` - its crown seat's, else its largest listed city's - or null.
 * @param {number} region
 * @param {{ seats?: { powers?: Map<number, number>, byMapId?: Map<number, any> } | null,
 *   places?: { all: () => Array<{ mapId: number, px: number, py: number, type: number, region: number, blocks: number }> } | null }} o
 * @returns {[number, number] | null}
 */
export function provinceHubOf(region, { seats = null, places = null } = {}) {
  if (!PROVINCE_HUB_REGIONS.includes(region)) return null;
  const key = seats?.powers?.get(region);
  const seat = key == null ? null : seats?.byMapId?.get(key);
  if (seat?.tier === 'crown' && seat.region === region) return [seat.pixel[0], seat.pixel[1]];
  let best = null,
    claim = null;
  for (const p of places?.all() ?? []) {
    if (p.region !== region) continue;
    const kind = settlementRank(p.type);
    if (!kind) continue;
    const c = [kind, p.blocks, -(p.mapId >>> 0)];
    if (
      !claim ||
      c[0] > claim[0] ||
      (c[0] === claim[0] && (c[1] > claim[1] || (c[1] === claim[1] && c[2] > claim[2])))
    ) {
      best = p;
      claim = c;
    }
  }
  return best ? [best.px, best.py] : null;
}

/**
 * THE HUBS A MARKET REQUEST CARRIES: the Bay's (HUB1's, `regionHubs.byRegion`, as they always were) and each province's
 * this client stands (provinceHubOf), `{ [region]: [x, y] }`, the regions ascending.
 * @param {{ regionHubs?: { byRegion?: Map<number, any> } | null, seats?: any, places?: any }} o
 * @returns {Record<number, [number, number]>}
 */
export function marketHubsOf({ regionHubs = null, seats = null, places = null } = {}) {
  /** @type {Record<number, [number, number]>} */
  const out = Object.fromEntries(
    [...(regionHubs?.byRegion?.values?.() ?? [])].map((h) => [h.regionIndex, [h.pixel.x, h.pixel.y]]),
  );
  for (const r of PROVINCE_HUB_REGIONS) {
    const at = provinceHubOf(r, { seats, places });
    if (at) out[r] = at;
  }
  return out;
}

/**
 * THE HOST'S HUBS (scenes/marketPiecesHost.js): `() => hubs` - marketHubsOf, made again only when the seats' book's
 * `version` or the registry's `generation()` moved (the same object while neither does).
 * @param {{ regionHubs?: any, seats?: { version?: number } | null, places?: { generation?: () => number } | null }} o
 */
export function createMarketHubs({ regionHubs = null, seats = null, places = null } = {}) {
  let made = null,
    at = '';
  return () => {
    const stamp = `${seats?.version ?? -1}|${places?.generation?.() ?? -1}`;
    if (!made || stamp !== at) {
      made = Object.freeze(marketHubsOf({ regionHubs, seats, places }));
      at = stamp;
    }
    return made;
  };
}

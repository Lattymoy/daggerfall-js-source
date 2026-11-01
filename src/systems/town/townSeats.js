// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") — THE SEATS OF THE ILIAC
// BAY, as every client derives them (bible/11-Multiplayer/Seats-Arc.md
// 3.1).
//
// Mac: "So the 3 main castle hubs should be larger capture points, while
// every other location with a palace (must have) will be a lower capture
// point"; asked which palace locations: "Every palace location". So:
//   - a CROWN seat: a location named for one of the three kingdoms'
//     capitals (regionHubs.js HUB_CAPITALS) that stands in the region of
//     that name - Daggerfall (17), Wayrest (23), Sentinel (20);
//   - a PALACE seat: every other location whose building records hold a
//     Palace (buildingType 16, world/buildingNames.js) - read off
//     MAPS.BSA's own building list, no block loaded;
//   - one seat a location however many Palace records it holds; a
//     capital is never also a palace seat; no palace, no seat.
//
// THE GAME'S OWN ROWS ALONE (HUB1's and GATE-SEEN's law): a world-data
// mod's rows are appended where Replace Game Artwork is on, which is each
// client's own switch, so they never count - the host hands this the same
// base rows pickRegionHubs reads. And the servers hold no ARENA2: each
// client reports the seats it derived, and the account service trusts a
// seat only when enough of them agree (net/townSeatLaw.js, 3.2).
//
// Pure: the rows are an argument. tools/seatCount.mjs runs it over a
// player's own ARENA2 (SEAT-COUNT).
// ═══════════════════════════════════════════════════════════════════
import { longitudeLatitudeToMapPixel, REGION_NAMES } from '../../formats/mapsFile.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { HUB_CAPITALS, hubClaim, outranks } from '../region/regionHubs.js';
import { kingdomOf, isMarch, isFreeLand } from '../../net/kingdomLaw.js';
import { CROWN_SEAT_REGIONS, seatReportOf } from '../../net/townSeatLaw.js';

const same = (a, b) =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether a location's building records hold a Palace (buildingType 16). */
export const hasPalace = (loc) =>
  (loc?.exterior?.buildings ?? []).some((b) => b?.buildingType === BUILDING_TYPES.Palace);

/**
 * A location's seat, or null - `{ key, name, region, tier, pixel: [x, y], kingdom, isHub }`, `key` its map id unsigned.
 * `regionNameOf` names a region; `isHub(key)` says whether the location is its region's hub (regionHubs.js).
 * @param {any} loc
 * @param {{ regionNameOf?: (r: number) => string, isHub?: (key: number) => boolean }} [opts]
 */
export function seatOfLocation(loc, { regionNameOf = (r) => REGION_NAMES[r] ?? '', isHub = () => false } = {}) {
  if (!loc || !Number.isInteger(loc.regionIndex) || !loc.mapTableData) return null;
  const region = loc.regionIndex;
  const crown =
    Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region) &&
    HUB_CAPITALS.some((c) => same(c, loc.name) && same(c, regionNameOf(region)));
  if (!crown && !hasPalace(loc)) return null;
  const px = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  const seat = seatReportOf({
    key: loc.mapTableData.mapId >>> 0,
    name: String(loc.name ?? '').trim(),
    region,
    tier: crown ? 'crown' : 'palace',
    pixel: [px.x, px.y],
  });
  if (!seat) return null;
  return Object.freeze({
    ...seat,
    pixel: Object.freeze(seat.pixel),
    kingdom: kingdomOf(region),
    isHub: !!isHub(seat.key),
  });
}

/**
 * DOMAIN3 (bible/11-Multiplayer/Domains.md section 7): WHETHER SEAT `a` (its location's hub claim `ca`) OUTRANKS SEAT `b`
 * (`cb`) AS ITS REGION'S SEAT OF POWER - the crown first, then HUB1's own claim (regionHubs.js hubClaim: a city over a
 * town, the one named for its region, the largest), a seat whose location claims no hub after every one that does, and
 * the lower key last.
 */
const powerOutranks = (a, ca, b, cb) => {
  if ((a.tier === 'crown') !== (b.tier === 'crown')) return a.tier === 'crown';
  if (!ca !== !cb) return !!ca;
  if (ca && cb && (outranks(ca, cb) || outranks(cb, ca))) return outranks(ca, cb);
  return a.key < b.key;
};

/**
 * THE SEATS over `locations` (the host's own reading of every location, the game's own rows - `isBase`), each once, in
 * key order. Answers `{ list, byMapId, powers }` - DOMAIN3: `powers` each region's SEAT OF POWER, region -> its key (the
 * seat its Charter is keyed by, which this client reports beside the seat it stands in - net/townSeatBook.js witness).
 * @param {Iterable<any>|null|undefined} locations
 * @param {{ regionNameOf?: (r: number) => string, isBase?: (loc: any) => boolean, isHub?: (key: number) => boolean }} [opts]
 */
export function deriveTownSeats(
  locations,
  { regionNameOf = (r) => REGION_NAMES[r] ?? '', isBase = () => true, isHub } = {},
) {
  /** @type {Map<number, any>} */
  const byMapId = new Map();
  /** @type {Map<number, { seat: any, claim: number[]|null }>} */
  const best = new Map();
  for (const loc of locations ?? []) {
    if (!loc || !isBase(loc)) continue;
    const seat = seatOfLocation(loc, { regionNameOf, isHub });
    if (!seat || byMapId.has(seat.key)) continue;
    byMapId.set(seat.key, seat);
    const claim = hubClaim(loc, regionNameOf(seat.region));
    const had = best.get(seat.region);
    if (!had || powerOutranks(seat, claim, had.seat, had.claim)) best.set(seat.region, { seat, claim });
  }
  const powers = new Map([...best].sort((a, b) => a[0] - b[0]).map(([region, { seat }]) => [region, seat.key]));
  return seatsBook(byMapId, powers);
}
/** WW7-3: the seats' answer - `list` the seats in key order, made again when `byMapId` changes (replaceSeats); the maps
 *  are the seats' own, read by reference by the seats' book and the host. */
function seatsBook(byMapId, powers) {
  let made = null,
    madeAt = -1;
  const book = { byMapId, powers, extra: new Map(), version: 0 };
  Object.defineProperty(book, 'list', {
    enumerable: true,
    get() {
      if (madeAt !== book.version) {
        made = Object.freeze([...byMapId.values()].sort((a, b) => a.key - b.key));
        madeAt = book.version;
      }
      return made;
    },
  });
  return Object.seal(book); // its `version` replaceSeats' to move; nothing else added or taken
}

/**
 * WW7-3 (2026-10-25, bible/03-World/World-Wide.md WW7; the owner: "we need the same city nodes populating the entire map
 * of tamriel"): THE SEATS PAST THE BAY, as every client derives them off the port's own places - a CROWN at each
 * province's capital (world/tamrielCapitals.js CAPITALS, its centre's id, `capitals`), its kingdom the province's
 * (net/kingdomLaw.js); a PALACE at every Arena city-state standing on the trace (world/arenaPlaces.js; every city-state
 * of Arena's holds a palace - its ruler's), but one a capital's pixel holds (`cities`). Each `{ key, name, px, py, region }`
 * (`region` the province's, WW-R). Answers the seats (seatOfLocation's record), each through the law's report - a name or
 * a pixel the law refuses stands no seat.
 * @param {{ capitals?: Array<{ key: number, name: string, px: number, py: number, region: number }>,
 *   cities?: Array<{ key: number, name: string, px: number, py: number, region: number }> }} places
 */
export function tamrielSeatsOf({ capitals = [], cities = [] } = {}) {
  const out = [];
  for (const [tier, rows] of /** @type {const} */ ([
    ['crown', capitals],
    ['palace', cities],
  ])) {
    for (const r of rows) {
      const seat = seatReportOf({
        key: r.key >>> 0,
        name: String(r.name ?? '').trim(),
        region: r.region,
        tier,
        pixel: [r.px, r.py],
      });
      if (seat)
        out.push(
          Object.freeze({ ...seat, pixel: Object.freeze(seat.pixel), kingdom: kingdomOf(seat.region), isHub: false }),
        );
    }
  }
  return out;
}
/**
 * WW7-3: A SOURCE'S SEATS, REPLACED - the seats `source` (a provider's name: 'tesa') last added leave, `seats` take their
 * place (a key the Bay's derivation holds keeps the Bay's), and each region they touch has its seat of power chosen
 * again (powerOutranks: a crown first, then the lower key - a place past the Bay claims no hub). Moves `version`.
 * @param {ReturnType<typeof deriveTownSeats>} book @param {string} source @param {any[]} seats
 */
export function replaceSeats(book, source, seats) {
  const touched = new Set();
  for (const key of book.extra.get(source) ?? []) {
    const s = book.byMapId.get(key);
    if (s) touched.add(s.region);
    book.byMapId.delete(key);
  }
  const keys = [];
  for (const seat of seats ?? []) {
    if (book.byMapId.has(seat.key)) continue;
    book.byMapId.set(seat.key, seat);
    keys.push(seat.key);
    touched.add(seat.region);
  }
  book.extra.set(source, keys);
  const mine = new Set([...book.extra.values()].flat());
  for (const region of touched) {
    let best = null;
    for (const s of book.byMapId.values())
      if (s.region === region && (!best || powerOutranks(s, null, best, null))) best = s;
    const had = book.powers.get(region);
    if (had != null && !mine.has(had) && book.byMapId.has(had)) continue; // a Bay region's power is the Bay's derivation's
    if (best) book.powers.set(region, best.key);
    else book.powers.delete(region);
  }
  book.version++;
}

/** DOMAIN1 (HOST-SPLIT): whether this client's own derivation holds a seat at map pixel (x, y) - the seats' book's
 *  `isSeatPixel` (a Watch tick is kept only in a seat's own pixel), built once over `seats` where the host had kept its
 *  own set beside the book. */
export function seatPixelTest(seats) {
  let at = null,
    of = null; // WW7-3: made again when the seats' list is (replaceSeats - the seats past the Bay landing)
  return (x, y) => {
    const list = seats?.list ?? [];
    if (list !== of) {
      of = list;
      at = new Set(list.map((s) => `${s.pixel[0]},${s.pixel[1]}`));
    }
    return at.has(`${x},${y}`);
  };
}

/** The seat a location IS, by its map id (signed as MAPS.BSA reads it, or not), or null. */
export const seatAtMapId = (seats, mapId) =>
  mapId == null || !Number.isFinite(Number(mapId)) ? null : (seats?.byMapId?.get(Number(mapId) >>> 0) ?? null);

/** The totals SEAT-COUNT prints: seats, crowns, palaces, hubs among them, and each kingdom's (a March and a Free Land
 *  by their own words). */
export function seatTotals(list) {
  const out = { seats: 0, crown: 0, palace: 0, hubs: 0, kingdoms: /** @type {Record<string, number>} */ ({}) };
  for (const s of list ?? []) {
    out.seats++;
    out[s.tier]++;
    if (s.isHub) out.hubs++;
    const k = s.kingdom ?? (isMarch(s.region) ? 'march' : isFreeLand(s.region) ? 'free' : 'none');
    out.kingdoms[k] = (out.kingdoms[k] ?? 0) + 1;
  }
  return out;
}

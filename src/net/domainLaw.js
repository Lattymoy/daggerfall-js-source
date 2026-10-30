// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOMAIN3 (2026-10-24, the owner: "A transition to tamriel region control
// instead of just city control"; asked, "Replace seats") - THE REGION'S
// CHARTER, one home for every end (bible/11-Multiplayer/Domains.md section
// 7).
//
// ONE REGION, ONE CHARTER (Domains law 1). From the seat week the service's
// DOMAINS_WEEK names, what a guild holds is a region: its Charter is its
// SEAT OF POWER's - the region's seat that ranks first by HUB1's own claim
// (systems/region/regionHubs.js hubClaim: a city over a town, the one named
// for its region, the largest), the crown city in a crown's region - and
// every other seat town of the region is that Charter's holding, never
// fought over apart from it. THE KEYS STAY (law 4): the Charter is keyed by
// its seat of power's map id, so every seat table, the siege room and the
// works read it as they read a seat.
//
// The servers hold no ARENA2, so the seat of power is WITNESSED as a seat
// is (SEAT0 3.2; net/nodeLaw.js witnessedFact): a client reports its
// region's beside the seat it stands in (the bytes `[region, key]`; the
// service's own table, server-account/src/domains.js), and three agreeing
// confirm it - a key the registry confirms as a seat OF THAT REGION, the
// crown in a crown's region (domainSeats).
//
// Pure, and no words: the account service (the pledge, the Watch, the
// homes, the bailiwick, the Turning's fold), the seats' list and, through
// the list's marks (chartersMarked), the seats' book read it.
// ═══════════════════════════════════════════════════════════════════
import { seatKeyOk, seatRegionOk, CROWN_SEAT_REGIONS } from './townSeatLaw.js';

/** The seat week the region law first rules, off the service's `DOMAINS_WEEK` (a whole week number), or null: not yet. */
export const domainsWeekOf = (v) => (/^\d{1,7}$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);
/** Does the region law rule seat week `week`? */
export const domainsRule = (week, domainsWeek) =>
  Number.isSafeInteger(domainsWeek) && Number.isSafeInteger(week) && week >= domainsWeek;

/** A region's seat of power as a client reports it, checked and canonical - `{ region, key }` - or null. */
export function domainReportOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { region, key } = raw;
  return seatRegionOk(region) && seatKeyOk(key) ? { region, key } : null;
}
/** The report's bytes - what three witnesses must agree on. */
export const domainReportText = (d) => JSON.stringify([d.region, d.key]);
/** A report read back (witnessedFact's `parse`): `{ domain }`, or null for bytes that are no domain's. */
export function parseDomainReport(text) {
  let a;
  try {
    a = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(a) || a.length !== 2) return null;
  const domain = domainReportOf({ region: a[0], key: a[1] });
  return domain && domainReportText(domain) === text ? { domain } : null;
}

/**
 * THE CHARTERS - region -> its seat of power, the confirmed seat (`seats`: key -> `{ key, region, tier }`) each confirmed
 * domain fact (`facts`: region -> key) names, where that key is a seat OF THAT REGION and, in a crown's region, the
 * crown. Pure.
 * @param {Map<number, { key: number, region: number, tier: string }>} seats @param {Map<number, number>} facts
 */
export function domainSeats(seats, facts) {
  /** @type {Map<number, any>} */
  const out = new Map();
  for (const [region, key] of facts ?? []) {
    const s = seats?.get?.(key);
    if (!s || s.region !== region) continue;
    if (Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region) && s.tier !== 'crown') continue;
    out.set(region, s);
  }
  return out;
}

/**
 * THE CHARTERS AMONG `seats` (Domains law 1): where the region law rules (`domains` domainSeats' map), each region's seat
 * of power alone - and every seat of a region whose seat of power is not yet confirmed, which keeps the seat law until it
 * is (the fold's rule); where it does not (`domains` null), every seat. In `seats`' order. Pure.
 * @template {{ key: number, region: number }} S
 * @param {Iterable<S>} seats @param {Map<number, { key: number }>|null} domains
 * @returns {S[]}
 */
export function charterSeats(seats, domains) {
  const out = [];
  for (const s of seats ?? []) {
    const d = domains?.get?.(s.region);
    if (!d || d.key === s.key) out.push(s);
  }
  return out;
}
/** THE CHARTER A SEAT IS HELD UNDER: its region's seat of power where the region law rules and has one (`domains`), else
 *  the seat itself - a holding's war, Watch and homes count there. */
export const charterUnder = (seat, domains) => (seat ? (domains?.get?.(seat.region) ?? seat) : null);
/**
 * THE SEATS' LIST UNDER THE REGION LAW: each seat of power marked `domain` and each holding marked with its Charter's key
 * (`charter`) - `powers` `[region, key]` pairs, the confirmed seats of power - every other seat as it was. The client
 * dresses a holding in its Charter and reads a board's bailiwick among the Charters alone (townSeatLaw.js bailiwickOf).
 * @template {{ key: number, region: number }} S
 * @param {S[]} seats @param {[number, number][]} powers
 */
export function chartersMarked(seats, powers) {
  const by = new Map(powers ?? []);
  return (seats ?? []).map((s) => {
    const k = by.get(s.region);
    return k == null ? s : k === s.key ? { ...s, domain: true } : { ...s, charter: k };
  });
}

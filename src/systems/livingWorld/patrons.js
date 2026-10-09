// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW15 (2026-10-09, bible/06-Systems/Living-World-II.md "LW15"): THE PATRONS, DRAWN - the client's half of the sale the
// service decides (net/patronLaw.js). The service names a SEED and a MINUTE, never a person; here the seed is DEALT to
// one of the town's own residents (`patronOf` - its households, never the watch or a visitor: every reader deals the
// same one, the census being pure), who walks to the trader's house at that minute, goes in, and comes out again
// (`patronVisits` - dayPlan.js's shop errand, its `at` the house's door), and whom the owner's Vendor page names. A
// public trader's house is now and then a browser's errand too (dayPlan.js `browse`, PATRON_BROWSE_SHARE) - a browser
// looks and never buys: only the service sells.
import { DAY_MIN, PATRON_BROWSE_SHARE } from './dayPlan.js';
export { PATRON_BROWSE_SHARE };

/** A patron's minutes at the trader. */
export const PATRON_STAY_MIN = 25;

/**
 * THE BUYER DEALT: the resident of the town a patron's seed names - one of its households (the census's `h` roll), never
 * the watch, in the order of their ids. Null with none.
 * @param {number} seed @param {readonly any[]} residents @returns {any | null}
 */
export function patronOf(seed, residents) {
  const pool = (residents ?? []).filter((r) => r && r.roll === 'h' && !r.guard).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool.length ? pool[(seed >>> 0) % pool.length] : null;
}

/** The hours a patron comes in: a sale's sky minute outside them (online a real hour is a whole sky day - TIME1 - and
 *  a third of the hour's minutes fall in the night) comes at its place in the open hours' fold. */
export const PATRON_OPEN_H = Object.freeze([8, 20]);

/**
 * A day's patrons' visits for a town: each sale told (`{ door, t, seed }` - the trader's house's building key, the sky
 * minute of the sale, the seed) on living day `day`, dealt to its resident: `{ resId, door, from, dur }` - `from` the
 * minute in the open hours (PATRON_OPEN_H) the sale's falls to.
 * @param {readonly { door: number, t: number, seed: number }[]} told @param {number} day @param {readonly any[]} residents
 */
export function patronVisits(told, day, residents) {
  const D0 = day * DAY_MIN + 4 * 60, D1 = D0 + DAY_MIN;
  const open = PATRON_OPEN_H[0] * 60, span = (PATRON_OPEN_H[1] - PATRON_OPEN_H[0]) * 60;
  const out = [];
  for (const v of told ?? []) {
    if (!(v.t >= D0 && v.t < D1)) continue;
    const res = patronOf(v.seed, residents);
    const tod = v.t - day * DAY_MIN;
    if (res) out.push({ resId: res.id, door: v.door, from: day * DAY_MIN + open + ((((tod - open) % span) + span) % span), dur: PATRON_STAY_MIN });
  }
  return out;
}

/** What the Vendor page says of a sale to a patron: their name and town, or a townsperson's. @param {any} res @param {string} town */
export const patronWords = (res, town) => (res?.name ? `${res.name}${town ? ` of ${town}` : ''}` : `a townsperson${town ? ` of ${town}` : ''}`);

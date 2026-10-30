// @ts-check
// CREW-SIGNED (2026-10-27, the SEA-OPEN slice; bible/03-World/Shipyards.md CREW-SIGNED) - A CREW HALL'S RECRUIT SIGNED ONCE
// ONLINE, the law both ends read. A town's hall draws the same sailors for every client on the same day (systems/
// crewHall.js recruitsOf: a seed of the town's map id and the day), so two players could sign one named man. Online, a
// hire asks the account service first (server-account/src/crewSigns.js): the first account to sign a recruit holds him
// for that day, and a hand paid off is let go to the hall again.
//
// A recruit's id is the hall's own, `town:day:slot`. Pure: the numbers and the id's reading.
import { sharedClassicMinutes } from './wire.js';

/** The sailors a hall has each day (systems/crewHall.js RECRUITS_A_DAY - pinned equal). */
export const CREW_SIGN_SLOTS = 6;
/** The days either side of the shared clock's a sign may name - a client's clock a little off the service's. */
export const CREW_SIGN_DAY_SPAN = 1;
/** The most recruits one account holds signed for one day: a squatter cannot empty every hall. */
export const CREW_SIGN_DAY_MAX = 24;
/** How long a row is kept past its day (days) - the service's sweep. */
export const CREW_SIGN_KEEP_DAYS = 3;

/** The shared world's day at wall-clock `nowMs` (net/wire.js sharedClassicMinutes, a day of 1440 minutes). */
export const crewDayAt = (/** @type {number} */ nowMs) => Math.floor(sharedClassicMinutes(nowMs) / 1440);

/**
 * A recruit's id read: `{ town, day, slot }`, or null when it names no hall's sailor.
 * @param {unknown} id
 * @returns {{ town: number, day: number, slot: number } | null}
 */
export function crewSignOf(id) {
  const m = /^(\d{1,10}):(\d{1,9}):(\d)$/.exec(typeof id === 'string' ? id : '');
  if (!m) return null;
  const town = Number(m[1]),
    day = Number(m[2]),
    slot = Number(m[3]);
  if (town > 0xffffffff || slot >= CREW_SIGN_SLOTS) return null;
  return { town, day, slot };
}

/** Whether a sign's `day` stands near enough the shared day at `nowMs` to be asked. */
export const crewDayOk = (/** @type {number} */ day, /** @type {number} */ nowMs) =>
  Math.abs(day - crewDayAt(nowMs)) <= CREW_SIGN_DAY_SPAN;

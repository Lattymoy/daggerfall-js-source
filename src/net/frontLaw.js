// @ts-check
// FRONTS (2026-10-29, the owner: "events are way overdone with their spawning. I like players planning routes to farm
// world events, but we need to reduce or design around this"; bible/03-World/World-Wide.md FRONTS). The Bay stands its
// events every game day. Past it, two of the eight provinces stir each game day, and only they stand a gate, raids, stars
// and a new Abyss Dungeon. Each province stirs once a four-day cycle, in an order the cycle's number shuffles, never two
// days running, so a province's turn moves round the real clock and every machine knows the days ahead with no data.
// Imports nothing: the relay's and the account service's graphs stay flat. Not a DFU member - DFU has no shared events.

/** The provinces that take turns (net/wire.js SITE_EVENT_LANES less the Bay's - pinned equal); no other lane is a front. */
export const FRONT_PROVINCES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
/** The provinces stirred a game day. */
export const FRONT_PER_DAY = 2;
/** The days in which every province stirs once. */
export const FRONT_CYCLE_DAYS = FRONT_PROVINCES.length / FRONT_PER_DAY;
/** Classic minutes in a game day (gameDate.js MINUTES_PER_DAY - pinned equal). The front's day is the shared clock's. */
export const FRONT_DAY_MINUTES = 1440;
/** The one salt every machine shuffles a cycle with. Changing it moves every province's turn. */
export const FRONT_SALT = 0x46524f4e;

/** mulberry32 (systems/wind/wind.js seededRng's), off a cycle's number and the salt. */
function cycleRandom(c) {
  let a = (Math.imul(c, 0x9e3779b1) ^ FRONT_SALT) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A cycle's shuffle as drawn, before the turn law: Fisher-Yates over FRONT_PROVINCES. */
function drawnOrder(c) {
  const out = [...FRONT_PROVINCES],
    random = cycleRandom(c);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** A cycle's order of turns. A province that closed the cycle before is swapped out of the first day for one of the
 *  middle days', so none stirs two days running; the last day is never moved, so this reads the cycle before's draw alone. */
function cycleOrder(c) {
  const out = drawnOrder(c);
  if (c <= 0) return out;
  const prev = drawnOrder(c - 1),
    last = prev.slice(-FRONT_PER_DAY);
  for (let p = 0; p < FRONT_PER_DAY; p++) {
    if (!last.includes(out[p])) continue;
    const q = out.findIndex((v, i) => i >= FRONT_PER_DAY && i < out.length - FRONT_PER_DAY && !last.includes(v));
    [out[p], out[q]] = [out[q], out[p]];
  }
  return out;
}
/** The cycles' orders made once - a frame asks for a day's fronts many times. */
const _orders = new Map();
const ORDERS_KEPT = 8;
function orderOf(c) {
  let o = _orders.get(c);
  if (o) return o;
  o = Object.freeze(cycleOrder(c));
  if (_orders.size >= ORDERS_KEPT) _orders.delete(_orders.keys().next().value);
  _orders.set(c, o);
  return o;
}

/**
 * THE DAY'S FRONTS: the provinces (lanes) stirred on game day `day`, ascending - none for a day that is no whole day.
 * @param {number} day the shared clock's game day @returns {ReadonlyArray<number>}
 */
export function frontLanes(day) {
  if (!Number.isSafeInteger(day) || day < 0) return Object.freeze([]);
  const o = orderOf(Math.floor(day / FRONT_CYCLE_DAYS)),
    i = (day % FRONT_CYCLE_DAYS) * FRONT_PER_DAY;
  return Object.freeze(o.slice(i, i + FRONT_PER_DAY).sort((a, b) => a - b));
}
/** Does lane `lane` stand its events on game day `day`? Every lane outside the fronts does; a province on its turn. */
export const frontStands = (day, lane) => !FRONT_PROVINCES.includes(lane) || frontLanes(day).includes(lane);
/** The game day a classic minute of the shared clock stands in. @param {number} minute */
export const frontDayOfMinute = (minute) => Math.floor(minute / FRONT_DAY_MINUTES);
/** The first game day from `day` on that lane `lane` stands its events (`day` itself for a lane outside the fronts). A
 *  province's turn is at most two cycles away. @param {number} day @param {number} lane */
export function frontNextDay(day, lane) {
  if (!Number.isSafeInteger(day) || day < 0) return day;
  for (let d = day; d < day + 2 * FRONT_CYCLE_DAYS; d++) if (frontStands(d, lane)) return d;
  return day;
}

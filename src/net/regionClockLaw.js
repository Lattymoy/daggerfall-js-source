// @ts-check
// FOUNDATION F2 (2026-10-30, bible/03-World/Foundation-Arc.md) - THE REGIONS' CLOCK AND THEIR PROSPERITY. A tick is a UTC
// day. A region is RESIDENT on tick t when players acted at one of its towns on day t - REGION_ACTS_SETTLE_DAYS
// (derived); it steps, and the rotation REGION_CLOCK_TURN more, so none is more than REGION_CLOCK_MAX_LAG behind. A rule
// steps a region's integer state a day at a time: a catch-up of n days is n steps, nothing added a closed form. The
// account service keeps the state (server-account/src/regionClock.js). Leaf: imports nothing.
export const REGION_CLOCK_REGIONS = 71;   // regions 0..70: the Bay's 62 and the nine provinces'
/** The days a day's acts take to be whole: tick t adds day t - 3's. A Watch receipt is claimed up to two days after its
 *  tick (watchReceipt.js WATCH_RECEIPT_TTL_S) and a patron's sale reckoned up to 48 hours after its hour (patronLaw.js
 *  PATRON_RECKON_HOURS), each counted on its own day; a day read sooner missed them for good. */
export const REGION_ACTS_SETTLE_DAYS = 3;
/** The regions the rotation steps a tick, resident or not. */
export const REGION_CLOCK_TURN = 2;
/** The most ticks a region falls behind the clock: the rotation's round. The proposal's bound is 45. */
export const REGION_CLOCK_MAX_LAG = Math.ceil(REGION_CLOCK_REGIONS / REGION_CLOCK_TURN);

/** A region's number, or false. @param {unknown} r */
export const regionClockOk = (r) => Number.isSafeInteger(r) && /** @type {number} */ (r) >= 0 && /** @type {number} */ (r) < REGION_CLOCK_REGIONS;

/**
 * The regions a tick steps - the resident ones, then the rotation's REGION_CLOCK_TURN from `cursor` - ascending, and the
 * cursor after. @param {Iterable<number>} resident @param {number} cursor
 * @returns {{ due: number[], cursor: number }}
 */
export function regionClockDue(resident, cursor) {
  const due = new Set();
  for (const r of resident) if (regionClockOk(r)) due.add(r);
  const c = ((cursor % REGION_CLOCK_REGIONS) + REGION_CLOCK_REGIONS) % REGION_CLOCK_REGIONS;
  for (let i = 0; i < REGION_CLOCK_TURN; i++) due.add((c + i) % REGION_CLOCK_REGIONS);
  return { due: [...due].sort((a, b) => a - b), cursor: (c + REGION_CLOCK_TURN) % REGION_CLOCK_REGIONS };
}

// ─── THE FIRST RULE: A REGION'S PROSPERITY ─────────────────────────────
// The players' acts at a region's towns (TOWN-ECON's weighed acts, the account service's town_econ_days) are added to
// its prosperity REGION_ACTS_SETTLE_DAYS days on; on every REGION_HALF_DAYS-th day it halves toward nothing. The
// restoring force is the shift: a region nobody walks falls back to its towns' own economy. The town reads it as a term
// (townEconLaw.js).

/** The days over which a region's prosperity halves: on each tick that is a multiple of it. */
export const REGION_HALF_DAYS = 4;
/** The most one day's acts add. */
export const REGION_IMPULSE_MAX = 2000;
/** The most a region's prosperity holds. */
export const REGION_PROSPERITY_MAX = 16000;
/** The bound a region's term approaches (it adds REGION_TERM_MAX - 1 at most), and the prosperity at which it adds half. */
export const REGION_TERM_MAX = 6;
export const REGION_TERM_HALF = 600;

/** Halved toward nothing the same either side - an arithmetic shift alone floors, and a 1 would never fall.
 *  @param {number} v @param {number} n halvings */
export const halvedToward0 = (v, n) => { const k = Math.min(31, Math.max(0, n)); return v < 0 ? 0 - ((-v) >> k) : v >> k; };
/** One day's acts as the prosperity they add. @param {unknown} acts */
export const regionImpulse = (acts) => { const n = Math.floor(Number(acts)); return n > 0 ? Math.min(REGION_IMPULSE_MAX, n) : 0; };
/** The halvings between two ticks: the multiples of REGION_HALF_DAYS in (from, to]. @param {number} from @param {number} to */
export const regionHalvings = (from, to) => (to > from ? Math.floor(to / REGION_HALF_DAYS) - Math.floor(from / REGION_HALF_DAYS) : 0);

/** A region's prosperity stepped one tick: halved on its day, then the tick's acts added. @param {number} v
 *  @param {number} tick @param {number} impulse */
export const regionProsperityStep = (v, tick, impulse) => Math.min(REGION_PROSPERITY_MAX, halvedToward0(v, tick % REGION_HALF_DAYS === 0 ? 1 : 0) + regionImpulse(impulse));

/**
 * A region's prosperity stepped from tick `from` to `to`, a day at a time - `impulseOf(t)` the acts that tick adds (day
 * t - REGION_ACTS_SETTLE_DAYS's). Where nothing is added it is the closed form (regionProsperityAt), so a region read off its own tick
 * answers what stepping it would. @param {number} v @param {number} from @param {number} to
 * @param {((tick: number) => number)|null} [impulseOf]
 */
export function regionProsperityStepTo(v, from, to, impulseOf = null) {
  if (!impulseOf) return regionProsperityAt(v, from, to);
  let s = v;
  for (let t = from + 1; t <= to; t++) s = regionProsperityStep(s, t, impulseOf(t));
  return s;
}
/** A region's prosperity on tick `to`, kept at `v` on tick `from` with nothing added since. @param {number} v
 *  @param {number} from @param {number} to */
export const regionProsperityAt = (v, from, to) => halvedToward0(Math.min(REGION_PROSPERITY_MAX, Math.max(0, v | 0)), regionHalvings(from, to));
/** What a region's prosperity adds to a town's: REGION_TERM_MAX x v / (v + REGION_TERM_HALF), whole. @param {unknown} v */
export const regionTermOf = (v) => { const n = Number(v); return n > 0 && Number.isFinite(n) ? Math.floor((REGION_TERM_MAX * Math.min(n, REGION_PROSPERITY_MAX)) / (Math.min(n, REGION_PROSPERITY_MAX) + REGION_TERM_HALF)) : 0; };

// FOUNDATION F2 (2026-10-30, bible/03-World/Foundation-Arc.md): THE REGIONS' CLOCK, kept (src/net/regionClockLaw.js).
// The cron's minute asks; once a UTC day the clock ticks. Tick t adds the acts of day t - REGION_ACTS_SETTLE_DAYS (a day
// whole): each region with acts steps, and the rotation steps REGION_CLOCK_TURN more. Days the service missed are ticked
// when it is back, with the acts it still keeps; past them a region reads its closed form. AUDIT FOUNDATION C2: the
// rows and the tick are written in one batch, each on the tick it was read at - a failed write loses no day, and a
// second runner writes nothing.
import { regionClockDue, regionClockOk, regionProsperityStepTo, regionProsperityAt, REGION_ACTS_SETTLE_DAYS } from '../../src/net/regionClockLaw.js';
import { TOWN_ECON_WEIGHTS, TOWN_ECON_DAYS } from '../../src/net/townEconLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

/** The days' acts by region, weighed as TOWN-ECON weighs them - every day a tick reads, in one statement. */
const WEIGHED = `SUM(d.n * CASE d.src ${Object.entries(TOWN_ECON_WEIGHTS).map(([s, w]) => `WHEN '${s}' THEN ${w}`).join(' ')} ELSE 0 END)`;
const ACTS_SQL = `SELECT d.day AS day, t.region AS region, ${WEIGHED} AS acts FROM town_econ_days d JOIN town_econ_towns t ON t.map = d.map
  WHERE d.day BETWEEN ?1 AND ?2 GROUP BY d.day, t.region`;
/** The regions stepped, written only while the clock still stands at the tick they were read at. */
const ROWS_SQL = `INSERT INTO region_clock (region, v, tick) SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]')
  FROM json_each(?1) WHERE (SELECT tick FROM region_clock_meta WHERE id = 1) = ?2 ON CONFLICT (region) DO UPDATE SET v = excluded.v, tick = excluded.tick`;

/** The day this isolate last found ticked - a quiet minute asks the database nothing (AUDIT SCALE D7). */
let _tickedDay = -1;
/** For the pins: a stood service is a fresh isolate (townEcon.js _resetTownEconForTests). */
export const _resetRegionClockForTests = () => { _tickedDay = -1; };

/**
 * THE CLOCK'S TICK (cron.js MINUTE_JOBS `town-shares`): every day to today not yet ticked, ticked - the regions it
 * stepped, or 0. A service with no clock yet starts it today; a region with no row is at nothing. Five statements a
 * day ticked, whatever the regions (AUDIT FOUNDATION C4).
 * @param {any} db @param {number} nowS
 */
export async function tickRegionClock(db, nowS) {
  const today = utcDay(nowS);
  if (_tickedDay === today) return 0;
  const meta = await db.prepare('SELECT tick, cursor FROM region_clock_meta WHERE id = 1').first();
  if (!meta) {
    await db.prepare('INSERT OR IGNORE INTO region_clock_meta (id, tick, cursor) VALUES (1, ?1, 0)').bind(today).run();
    _tickedDay = today;
    return 0;
  }
  const from = Number(meta.tick);
  if (from >= today) { _tickedDay = today; return 0; }
  const first = Math.max(from + 1, today - TOWN_ECON_DAYS + 1 + REGION_ACTS_SETTLE_DAYS);
  const { results: actRows = [] } = await db.prepare(ACTS_SQL).bind(first - REGION_ACTS_SETTLE_DAYS, today - REGION_ACTS_SETTLE_DAYS).all();
  /** @type {Map<number, Map<number, number>>} day -> region -> acts */ const byDay = new Map();
  for (const r of actRows) {
    if (!regionClockOk(Number(r.region)) || !(Number(r.acts) > 0)) continue;
    if (!byDay.has(Number(r.day))) byDay.set(Number(r.day), new Map());
    byDay.get(Number(r.day))?.set(Number(r.region), Number(r.acts));
  }
  const { results: rows = [] } = await db.prepare('SELECT region, v, tick FROM region_clock').all();
  /** @type {Map<number, { v: number, tick: number }>} */ const state = new Map(rows.map((/** @type {any} */ r) => [Number(r.region), { v: Number(r.v), tick: Number(r.tick) }]));
  /** @type {Set<number>} */ const moved = new Set();
  let cursor = Number(meta.cursor);
  for (let t = first; t <= today; t++) {
    const acts = byDay.get(t - REGION_ACTS_SETTLE_DAYS) ?? new Map();
    const turn = regionClockDue(acts.keys(), cursor);
    cursor = turn.cursor;
    for (const r of turn.due) {
      const s = state.get(r) ?? { v: 0, tick: t - 1 };
      if (!s.v && !acts.get(r)) continue;   // at nothing and nothing added: nothing to keep
      s.v = regionProsperityStepTo(s.v, s.tick, t, (k) => (k === t ? acts.get(r) ?? 0 : 0));
      s.tick = t;
      state.set(r, s);
      moved.add(r);
    }
  }
  const write = JSON.stringify([...moved].map((r) => [r, state.get(r)?.v ?? 0, state.get(r)?.tick ?? today]));
  const [, took] = await db.batch([
    db.prepare(ROWS_SQL).bind(write, from),
    db.prepare('UPDATE region_clock_meta SET tick = ?1, cursor = ?2 WHERE id = 1 AND tick = ?3').bind(today, cursor, from),
  ]);
  if (!took?.meta?.changes) return 0;   // AUDIT FOUNDATION II C4: another runner took it - read again next minute, never marked
  _tickedDay = today;
  return moved.size;
}

/** THE REGIONS' PROSPERITY on `nowS`'s day, as the clients read it: `[[region, v], ...]` for each above nothing, each
 *  read off its own tick in its closed form. @param {any} db @param {number} nowS */
export async function regionsProsperity(db, nowS) {
  const today = utcDay(nowS);
  const { results = [] } = await db.prepare('SELECT region, v, tick FROM region_clock ORDER BY region').all();
  const out = [];
  for (const r of results) {
    const v = regionProsperityAt(Number(r.v), Number(r.tick), today);
    if (v > 0) out.push([Number(r.region), v]);
  }
  return out;
}

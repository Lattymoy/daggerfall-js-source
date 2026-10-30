// FOUNDATION F2 (2026-10-30, bible/03-World/Foundation-Arc.md): THE REGIONS' CLOCK, kept (src/net/regionClockLaw.js).
// The cron's minute asks; once a UTC day the clock ticks. Each region whose towns saw players' acts the day before steps
// with them, and the rotation steps REGION_CLOCK_TURN regions more. Days the service missed are ticked when it is back,
// with the acts it still keeps (TOWN_ECON_DAYS); past them a region reads its closed form. The tick is taken first, so
// a second runner on the same minute writes nothing.
import { REGION_CLOCK_REGIONS, regionClockDue, regionClockOk, regionProsperityStepTo, regionProsperityAt } from '../../src/net/regionClockLaw.js';
import { TOWN_ECON_WEIGHTS, TOWN_ECON_DAYS } from '../../src/net/townEconLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

/** A day's acts by region, weighed as TOWN-ECON weighs them. */
const WEIGHED = `SUM(d.n * CASE d.src ${Object.entries(TOWN_ECON_WEIGHTS).map(([s, w]) => `WHEN '${s}' THEN ${w}`).join(' ')} ELSE 0 END)`;
const ACTS_SQL = `SELECT t.region AS region, ${WEIGHED} AS acts FROM town_econ_days d JOIN town_econ_towns t ON t.map = d.map WHERE d.day = ?1 GROUP BY t.region`;

/**
 * THE CLOCK'S TICK (cron.js MINUTE_JOBS `region-clock`): every day to today not yet ticked, ticked - the regions it
 * stepped, or 0. A service with no clock yet starts it today, every region at nothing.
 * @param {any} db @param {number} nowS
 */
export async function tickRegionClock(db, nowS) {
  const today = utcDay(nowS);
  const meta = await db.prepare('SELECT tick, cursor FROM region_clock_meta WHERE id = 1').first();
  if (!meta) {
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO region_clock_meta (id, tick, cursor) VALUES (1, ?1, 0)').bind(today),
      ...Array.from({ length: REGION_CLOCK_REGIONS }, (_, r) => db.prepare('INSERT OR IGNORE INTO region_clock (region, v, tick) VALUES (?1, 0, ?2)').bind(r, today)),
    ]);
    return 0;
  }
  const from = Number(meta.tick);
  if (from >= today) return 0;
  const first = Math.max(from + 1, today - TOWN_ECON_DAYS + 1);
  const ticks = [];
  let cursor = Number(meta.cursor);
  for (let t = first; t <= today; t++) {
    const { results = [] } = await db.prepare(ACTS_SQL).bind(t - 1).all();
    /** @type {Map<number, number>} */ const acts = new Map();
    for (const r of results) if (regionClockOk(Number(r.region)) && Number(r.acts) > 0) acts.set(Number(r.region), Number(r.acts));
    const turn = regionClockDue(acts.keys(), cursor);
    cursor = turn.cursor;
    ticks.push({ t, acts, due: turn.due });
  }
  const took = await db.prepare('UPDATE region_clock_meta SET tick = ?1, cursor = ?2 WHERE id = 1 AND tick = ?3').bind(today, cursor, from).run();
  if (!took?.meta?.changes) return 0;
  const { results: rows = [] } = await db.prepare('SELECT region, v, tick FROM region_clock').all();
  /** @type {Map<number, { v: number, tick: number }>} */ const state = new Map(rows.map((/** @type {any} */ r) => [Number(r.region), { v: Number(r.v), tick: Number(r.tick) }]));
  /** @type {Set<number>} */ const moved = new Set();
  for (const { t, acts, due } of ticks) {
    for (const r of due) {
      const s = state.get(r) ?? { v: 0, tick: t - 1 };
      s.v = regionProsperityStepTo(s.v, s.tick, t, (k) => (k === t ? acts.get(r) ?? 0 : 0));
      s.tick = t;
      state.set(r, s);
      moved.add(r);
    }
  }
  if (moved.size) {
    await db.batch([...moved].map((r) => db.prepare('INSERT INTO region_clock (region, v, tick) VALUES (?1, ?2, ?3) ON CONFLICT (region) DO UPDATE SET v = excluded.v, tick = excluded.tick')
      .bind(r, state.get(r)?.v ?? 0, state.get(r)?.tick ?? today)));
  }
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

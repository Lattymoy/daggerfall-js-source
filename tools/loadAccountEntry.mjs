// SCALE3 (2026-10-08, Mac: "Do 1 2 and 3"): THE ACCOUNT SERVICE AS THE LOAD HARNESS RUNS IT. Never deployed -
// tools/loadHarness.mjs hands this file to `wrangler dev` as the entry, over server-account/wrangler.toml's own bindings.
//
// It is the real Worker (server-account/src/index.js), unchanged, with two things kept in the isolate that a deploy sends
// elsewhere, so the harness can read them back at /__load/stats:
//   - the service's own metrics point a request (metrics.js `measured`: the route as a template, the status, wall ms and
//     the D1 statements it ran) - where the deploy writes them to Analytics Engine, and miniflare's local dataset drops
//     every one;
//   - D1's own count of the ROWS each statement read and wrote (`meta.rows_read`, `meta.rows_written`), by its SQL - the
//     figure the database is billed and throttled by, the one `wrangler d1 insights` read in YARD-SHED and STORM-SHED.
//
// THE DATABASE IS WRAPPED ONCE AN ISOLATE, never a request: the service keys its kept answers by the binding
// (service.js DB_ROOT - the yards, the homes' layouts, the seats' rows), and this answers DB_ROOT with the binding itself,
// so a kept answer is kept here exactly as it is in the deploy. A `first()` is asked as `all()` and its first row
// returned - the same row, and the only door D1 opens on a statement's meta.
import service from '../server-account/src/index.js';
import { DB_ROOT } from '../server-account/src/service.js';

/** The points and statements kept between two reads of /__load/stats - bounded, so a long run cannot grow the isolate. */
const POINTS_MAX = 500_000;
const points = [];
/** @type {Map<string, { n: number, rowsRead: number, rowsWritten: number, ms: number }>} */
const bySql = new Map();
const sink = { writeDataPoint(/** @type {any} */ p) { if (points.length < POINTS_MAX) points.push(p); } };

const note = (/** @type {string} */ sql, /** @type {any} */ meta) => {
  const key = sql.replace(/\s+/g, ' ').trim().slice(0, 240);
  const row = bySql.get(key) ?? { n: 0, rowsRead: 0, rowsWritten: 0, ms: 0 };
  row.n += 1;
  row.rowsRead += Number(meta?.rows_read ?? 0);
  row.rowsWritten += Number(meta?.rows_written ?? 0);
  row.ms += Number(meta?.duration ?? 0);
  bySql.set(key, row);
};

/** The real statement behind each one this wrapper handed out - a batch is given the real ones. */
const realOf = new WeakMap();
const sqlOf = new WeakMap();

function statement(/** @type {any} */ real, /** @type {string} */ sql) {
  const st = new Proxy(real, {
    get(target, key) {
      if (key === 'bind') return (/** @type {any[]} */ ...a) => statement(target.bind(...a), sql);
      if (key === 'first') {
        return async (/** @type {string|undefined} */ col) => {
          const r = await target.all();
          note(sql, r?.meta);
          const row = r?.results?.[0] ?? null;
          return col === undefined ? row : (row?.[col] ?? null);
        };
      }
      if (key === 'all' || key === 'run') return async () => { const r = await target[key](); note(sql, r?.meta); return r; };
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  realOf.set(st, real);
  sqlOf.set(st, sql);
  return st;
}

let wrapped = null, wrappedOf = null;
function database(/** @type {any} */ db) {
  if (!db) return db;
  if (wrappedOf === db) return wrapped;
  wrappedOf = db;
  wrapped = new Proxy(db, {
    get(target, key) {
      if (key === DB_ROOT) return Reflect.get(target, DB_ROOT) ?? target;
      if (key === 'prepare') return (/** @type {string} */ sql) => statement(target.prepare(sql), String(sql));
      if (key === 'batch') {
        return async (/** @type {any[]} */ list) => {
          const out = await target.batch(list.map((st) => realOf.get(st) ?? st));
          list.forEach((st, i) => note(sqlOf.get(st) ?? '(batch)', out?.[i]?.meta));
          return out;
        };
      }
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return wrapped;
}

const withLoad = (/** @type {any} */ env) => ({ ...env, DB: database(env.DB), METRICS: sink });

export default {
  async fetch(/** @type {Request} */ request, /** @type {any} */ env, /** @type {any} */ ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/__load/stats') {
      const body = JSON.stringify({ points: points.splice(0), statements: [...bySql].map(([sql, s]) => ({ sql, ...s })) });
      if (url.searchParams.get('reset') === '1') bySql.clear();
      return new Response(body, { headers: { 'content-type': 'application/json' } });
    }
    return service.fetch(request, withLoad(env), ctx);
  },
  async scheduled(/** @type {any} */ event, /** @type {any} */ env, /** @type {any} */ ctx) {
    const s = /** @type {any} */ (service);
    if (typeof s.scheduled === 'function') return s.scheduled(event, withLoad(env), ctx);
  },
};

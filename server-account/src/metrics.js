// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCALE1 (2026-09-30, the scaling audit - Mac: "set the stage for a
// larger player base in the future"): WHAT THE SERVICE DOES, COUNTED.
//
// Until this the service logged one thing - an uncaught error - and
// nobody could see a request rate, a latency, a 429, a 503 or the D1
// calls a route makes. Every request now writes ONE data point to
// Workers Analytics Engine (the METRICS binding, wrangler.toml):
//
//   index1  the route, as a template (no ids, no names: a bounded set)
//   blob1   the route again (Analytics Engine groups by blobs)
//   blob2   the method
//   blob3   the status, as text ("200", "429"...)
//   blob4   a refusal's one word (`rate`, `too-large`...), or ""
//   double1 wall time in ms (Workers' clock moves across I/O, so this
//           is the time the caller waited, not CPU)
//   double2 the status
//   double3 D1 statements the request ran (a batch counts each one)
//   double4 D1 rows written (SCALE4f; a cron point's double4 is the rows
//           its job changed - the same measure)
//   double5 D1 wait in ms: the wall time the request spent awaiting its
//           statements, summed (SCALE4f)
//   double6 D1 rows read (SCALE4f)
//   double7 statements a read replica served (SCALE4f)
//   double8-11 rows written to the plan's hot rows, by table: `players`,
//           `sessions`, `renown_tracks`, `realm_characters` (SCALE4h)
//   blob5   every table the request wrote, "table:rows" by rows, most
//           first (SCALE4h)
//   blob6   a heartbeat's parts, "beat,board,mail,post" - the ones its
//           body asked (SCALE4h); "" for any other route
//
// SCALE4f (2026-10-10, Mac: "really future proof our archetecture"; bible
// 11-Multiplayer/Scale-Arc.md SCALE4f): HOW BUSY THE ONE PRIMARY IS. The
// statements a request ran said how much it asked of D1, never how long
// D1 made it wait - and a primary going under shows first as that wait,
// a queue nothing else exposes, before the 'overloaded' refusals begin.
// Every statement a request awaits is timed now (first, all, run, raw,
// and a batch whole), and the rows its answers say it read and wrote are
// summed, with how many a READ REPLICA served (the answer's
// `served_by_primary` false): SCALE4d put the mint's reads on a session a
// replica may serve, and this is where it shows whether one does.
//
// SCALE4h (2026-10-11, "10k writes, by the metrics"; Scale-Arc.md SCALE4h):
// WHICH ROWS. A `first()` answers a row with no meta, so its rows went
// uncounted - and the play beat's write (accounts.js creditPlay) is one, so
// the heartbeat's rows written never showed it. A `first()` is now run as
// the statement's own `all()` - the query D1 sends is the same, first()
// only drops the meta - and its first row answered. Each statement's rows
// written are charged to the table it writes (tableOf), so the point says
// which hot row a route writes, not only how many; and a heartbeat says
// which parts it carried, so the beat, the board and the box are apart.
//
// AUDIT SCALE II A-3 (2026-10-11; Mac: "Lets do an audit on everything.
// Ensure perfection"): THE PARTS ARE THE SERVICE'S WORD, NEVER A SECOND
// READ. SCALE4h read them off a copy of the request (`clone().json()`),
// whole and unbounded, before the service had looked at a header - every
// heartbeat, a stranger's included. That undid AUDIT 68 X8 (index.js
// readCapped): a 64 MiB unauthenticated POST to /v1/heartbeat cost the
// isolate +325 MiB, and a body that never ended held the request before any
// service code ran. The service now says the parts of the body it read
// itself, within MAX_BODY_BYTES and behind the session (`said.parts`, set by
// the heartbeat's route): a refused heartbeat says none.
//
// NOTHING IDENTIFIES A PLAYER. The route is a template, the word is one
// of the service's own, and no header, id, handle or body is written.
//
// A METRIC NEVER COSTS A REQUEST. No binding, a write that throws, a
// body that is not JSON: the request is answered exactly as it would
// have been, and the point is skipped.
//
// Querying: the SQL API over the dataset, e.g.
//   SELECT index1 AS route, blob3 AS status, SUM(_sample_interval) AS n,
//          quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms
//   FROM daggerfall_accounts WHERE timestamp > NOW() - INTERVAL '1' HOUR
//   GROUP BY route, status ORDER BY n DESC
// ═══════════════════════════════════════════════════════════════════

import { ROUTES, savePathOf, realmPathOf, DB_ROOT, noteD1Wait, SLOW_SHED_TRIP_CAP_MS } from './service.js';   // SLOW-SHED: a request's D1 wait heard by the isolate's shed
import { HEARTBEAT_PARTS } from './heartbeat.js';

/** The route as a TEMPLATE: a served path as it stands, a save slot or a realm character's save by its shape - never
 *  the ids or the names they carry - and anything else one word, so the set of labels is bounded. */
export function routeLabel(/** @type {string} */ path) {
  if (ROUTES.has(path)) return path;
  const slot = savePathOf(path);
  if (slot) return `/v1/saves/:slot${slot.part ? `/${slot.part}` : ''}`;
  if (realmPathOf(path)) return '/v1/realm/:id/data';
  return 'other';
}

/** SCALE4f: a tally's field moved by `v` - a tally a caller made with `n` alone grows the rest as they come. */
const add = (/** @type {any} */ tally, /** @type {string} */ key, /** @type {number} */ v) => { if (Number.isFinite(v)) tally[key] = (tally[key] ?? 0) + v; };

/** SCALE4h: the table a statement writes - `INSERT [OR ...] INTO t`, `REPLACE INTO t`, `UPDATE [OR ...] t`, `DELETE
 *  FROM t` - or null for a read. */
export const tableOf = (/** @type {unknown} */ sql) => {
  const m = typeof sql === 'string' ? /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+["`]?(\w+)/i.exec(sql) : null;
  return m ? m[1].toLowerCase() : null;
};

/** SCALE4h: the plan's hot rows (Scale-Arc.md SCALE4h), each its own double on the point - the session, the account's
 *  row (the play clock, the Renown hour, the touch), the Renown tally and the realm's checkpoint. */
export const HOT_TABLES = Object.freeze(['players', 'sessions', 'renown_tracks', 'realm_characters']);

/** SCALE4f: what an answer's meta says D1 did - its rows read and written, and whether a replica served it. SCALE4h:
 *  and the rows written charged to the table its statement (`sql`) writes. */
function noteMeta(/** @type {any} */ result, /** @type {any} */ tally, /** @type {unknown} */ sql = null) {
  const m = result?.meta;
  if (!m || typeof m !== 'object') return;
  add(tally, 'rr', m.rows_read);
  add(tally, 'rw', m.rows_written);
  if (m.served_by_primary === false) add(tally, 'replica', 1);
  const t = Number.isFinite(m.rows_written) && m.rows_written > 0 ? tableOf(sql) : null;
  if (t) { const by = tally.tables ??= {}; by[t] = (by[t] ?? 0) + m.rows_written; }
}

/** SCALE4h: the point's blob of every table written - "table:rows", most first, at most eight. */
export const tablesBlob = (/** @type {Record<string, number>|undefined} */ by) => Object.entries(by ?? {})
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(([t, n]) => `${t}:${n}`).join(' ');

/** SCALE4f: the real statement behind a timed one - D1's batch is handed its own. */
const REAL = new WeakMap();
/** SCALE4h: a timed statement's SQL, for the table its batch answer's rows are charged to. */
const SQL = new WeakMap();

/** SCALE4f: A STATEMENT WHOSE WAIT IS COUNTED. Every member is the statement's own, called on the statement itself
 *  (workerd's are a class with private fields - a method called on a Proxy throws, AUDIT SCALE4d D8); `bind` answers a
 *  timed statement in turn, and each way of running it adds its wall time (and an answer's rows) to the tally. */
function timedStatement(/** @type {any} */ stmt, /** @type {any} */ tally, /** @type {unknown} */ sql = null) {
  if (!stmt || typeof stmt !== 'object') return stmt;
  const timed = new Proxy(stmt, {
    get(target, key) {
      const v = Reflect.get(target, key);
      if (typeof v !== 'function') return v;
      if (key === 'bind') return (/** @type {any[]} */ ...args) => timedStatement(v.apply(target, args), tally, sql);
      if (key === 'first' || key === 'all' || key === 'run' || key === 'raw') {
        // SCALE4h: a `first()` (no column named) run as the statement's own `all()`, so its meta is read - its first row
        // answered, or null, as first() answers it
        const all = key === 'first' ? Reflect.get(target, 'all') : null;
        return async (/** @type {any[]} */ ...args) => {
          const started = Date.now();
          try {
            if (typeof all === 'function' && args.length === 0) {
              const r = await all.call(target);
              noteMeta(r, tally, sql);
              return r?.results?.[0] ?? null;
            }
            const r = await v.apply(target, args);
            if (key === 'all' || key === 'run') noteMeta(r, tally, sql);   // rows (`raw`), or a column (`first('c')`), carry no meta
            return r;
          } finally { tripDone(tally, Date.now() - started); }   // SLOW-SHED (AUDIT LEAN-READS C1): a statement awaited is a trip
        };
      }
      return v.bind(target);
    },
  });
  REAL.set(timed, stmt);
  SQL.set(timed, sql);
  return timed;
}

/** A round trip to D1 ended after `ms`: its wait on the tally (`ms`, the metrics point's), one trip, and SLOW-SHED's
 *  measure of it, at most SLOW_SHED_TRIP_CAP_MS (`capped` - AUDIT LEAN-READS C4, a trip's own cap: one heavy statement
 *  among a request's quick ones is no queue either). A trip that threw counts as one: it waited all the same. */
function tripDone(/** @type {any} */ tally, /** @type {number} */ ms) {
  add(tally, 'ms', ms);
  add(tally, 'trips', 1);
  add(tally, 'capped', Math.min(ms, SLOW_SHED_TRIP_CAP_MS));
}

/** D1 with its statements counted: a statement prepared is one, a batch counts each of its own (they were prepared
 *  already, and are not counted twice - `prepare` inside a batch's list is what counts them). Every other member is
 *  the binding's own. STORM-SHED: and DB_ROOT the binding itself, which outlives this request's Proxy. SCALE4d: and a
 *  session opened through it (`withSession`, service.js replicaDb) is counted into the same tally - a mint served by a
 *  replica is still a mint's dozen statements on its metrics point. SCALE4f: and each statement's wait, its rows, and
 *  a replica's serving - `ms`, `rr`, `rw`, `replica` on the same tally (timedStatement). */
export function countedDb(/** @type {any} */ db, /** @type {{ n: number }} */ tally) {
  return new Proxy(db, {
    get(target, key) {
      if (key === DB_ROOT) return Reflect.get(target, DB_ROOT) ?? target;
      if (key === 'prepare') return (/** @type {any[]} */ ...args) => { tally.n += 1; return timedStatement(target.prepare(...args), tally, args[0]); };
      if (key === 'batch') {
        const batch = Reflect.get(target, key);
        if (typeof batch !== 'function') return batch;
        return async (/** @type {any[]} */ list, /** @type {any[]} */ ...rest) => {
          const started = Date.now();
          try {
            const rs = await batch.call(target, Array.isArray(list) ? list.map((st) => REAL.get(st) ?? st) : list, ...rest);
            if (Array.isArray(rs)) rs.forEach((r, i) => noteMeta(r, tally, Array.isArray(list) ? SQL.get(list[i]) : null));
            return rs;
          } finally { tripDone(tally, Date.now() - started); }   // SLOW-SHED (AUDIT LEAN-READS C1): and a batch one, whatever it carries
        };
      }
      if (key === 'withSession') {
        const open = Reflect.get(target, key);
        return typeof open === 'function' ? (/** @type {any[]} */ ...args) => countedDb(open.apply(target, args), tally) : open;
      }
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

/** A refusal's one word, off a JSON answer that is not a 2xx (the service's refusals are `{ error }`) - or "". */
async function refusalOf(/** @type {Response} */ res) {
  if (res.status < 300 || !(res.headers.get('content-type') ?? '').includes('json')) return '';
  try {
    const body = await res.clone().json();
    return typeof body?.error === 'string' ? body.error.slice(0, 64) : '';
  } catch {
    return '';
  }
}

/**
 * THE REQUEST, SERVED AND COUNTED. `serve(request, env, said)` is the service; with no METRICS binding it is simply
 * called. AUDIT SCALE II A-3: `said` is what the service tells its point of the request - `parts`, a heartbeat's.
 * @param {Request} request @param {any} env
 * @param {(request: Request, env: any, said: { parts: string }) => Promise<Response>} serve
 */
export async function measured(request, env, serve, exec = null) {
  const sink = env?.METRICS;
  const said = { parts: '' };
  if (!sink || typeof sink.writeDataPoint !== 'function') return serve(request, env, said, exec);   // AUDIT SAFE DISCORD-4: the Worker's ExecutionContext, for what follows an answer
  const started = Date.now();
  const tally = { n: 0, ms: 0, trips: 0, capped: 0, rr: 0, rw: 0, replica: 0, tables: /** @type {Record<string, number>} */ ({}) };
  const counted = env.DB ? { ...env, DB: countedDb(env.DB, tally) } : env;
  const res = await serve(request, counted, said, exec);
  noteD1Wait(tally.capped, tally.trips, Date.now());   // SLOW-SHED: the isolate's shed hears how long the database made it wait, a trip at a time
  const parts = typeof said.parts === 'string' ? said.parts : '';   // AUDIT SCALE II A-3: the service's own word on the body it read
  try {
    const route = routeLabel(new URL(request.url).pathname);
    sink.writeDataPoint({
      indexes: [route],
      blobs: [route, request.method, String(res.status), await refusalOf(res), tablesBlob(tally.tables), parts],   // SCALE4h: the tables written, a heartbeat's parts
      doubles: [Date.now() - started, res.status, tally.n, tally.rw, tally.ms, tally.rr, tally.replica,   // SCALE4f: rows written, D1's wait, rows read, a replica's statements
        ...HOT_TABLES.map((t) => tally.tables[t] ?? 0)],   // SCALE4h: the hot rows, by table
    });
  } catch { /* a metric never costs a request */ }
  return res;
}

/** SCALE4h: the parts a heartbeat's body asked (heartbeat.js HEARTBEAT_PARTS, in its order), comma-joined - "" for a
 *  body that is not an object. AUDIT SCALE II A-3: of the body the heartbeat's route read (index.js, `said.parts`) -
 *  never a copy of the request read here. */
export function heartbeatPartsOf(/** @type {unknown} */ body) {
  if (!body || typeof body !== 'object') return '';
  const b = /** @type {Record<string, unknown>} */ (body);
  return HEARTBEAT_PARTS.filter((k) => b[k] !== undefined && b[k] !== false).join(',');
}

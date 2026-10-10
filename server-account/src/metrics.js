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

import { ROUTES, savePathOf, realmPathOf, DB_ROOT } from './service.js';

/** The route as a TEMPLATE: a served path as it stands, a save slot or a realm character's save by its shape - never
 *  the ids or the names they carry - and anything else one word, so the set of labels is bounded. */
export function routeLabel(/** @type {string} */ path) {
  if (ROUTES.has(path)) return path;
  const slot = savePathOf(path);
  if (slot) return `/v1/saves/:slot${slot.part ? `/${slot.part}` : ''}`;
  if (realmPathOf(path)) return '/v1/realm/:id/data';
  return 'other';
}

/** D1 with its statements counted: a statement prepared is one, a batch counts each of its own (they were prepared
 *  already, and are not counted twice - `prepare` inside a batch's list is what counts them). Every other member is
 *  the binding's own. STORM-SHED: and DB_ROOT the binding itself, which outlives this request's Proxy. SCALE4d: and a
 *  session opened through it (`withSession`, service.js replicaDb) is counted into the same tally - a mint served by a
 *  replica is still a mint's dozen statements on its metrics point. */
export function countedDb(/** @type {any} */ db, /** @type {{ n: number }} */ tally) {
  return new Proxy(db, {
    get(target, key) {
      if (key === DB_ROOT) return Reflect.get(target, DB_ROOT) ?? target;
      if (key === 'prepare') return (/** @type {any[]} */ ...args) => { tally.n += 1; return target.prepare(...args); };
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
 * THE REQUEST, SERVED AND COUNTED. `serve(request, env)` is the service; with no METRICS binding it is simply called.
 * @param {Request} request @param {any} env
 * @param {(request: Request, env: any) => Promise<Response>} serve
 */
export async function measured(request, env, serve) {
  const sink = env?.METRICS;
  if (!sink || typeof sink.writeDataPoint !== 'function') return serve(request, env);
  const started = Date.now();
  const tally = { n: 0 };
  const counted = env.DB ? { ...env, DB: countedDb(env.DB, tally) } : env;
  const res = await serve(request, counted);
  try {
    const route = routeLabel(new URL(request.url).pathname);
    sink.writeDataPoint({
      indexes: [route],
      blobs: [route, request.method, String(res.status), await refusalOf(res)],
      doubles: [Date.now() - started, res.status, tally.n],
    });
  } catch { /* a metric never costs a request */ }
  return res;
}

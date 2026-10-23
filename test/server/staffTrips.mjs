// STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "The click takes a while before the new page shows
// (it's waiting on the server)") - HOW MANY D1 ROUND TRIPS A STAFF ROUTE WAITS ON. The service's own SQL is a few
// milliseconds a page; what a click waits on is each statement awaited after the last, times the network to D1. So every
// call over this database answers on a later macrotask, as D1 answers over the network: calls made together (a batch,
// a Promise.all) share one trip, and a call made after an await starts the next.

/** Count the trips on a test/accountDb.mjs database (s.env.DB). `take()` answers `{ trips, statements }` since the last
 *  take and starts again. @param {any} db */
export function countTrips(db) {
  let wave = 0, last = -1, trips = 0, statements = 0;
  const later = () => new Promise((r) => setImmediate(r)).then(() => { wave++; });
  const mark = (n) => { statements += n; if (last !== wave) { trips++; last = wave; } };
  const prepare = db.prepare.bind(db);
  db.prepare = (/** @type {string} */ sql) => {
    const st = prepare(sql);
    for (const k of ['first', 'all', 'run']) {
      const f = st[k].bind(st);
      st[k] = async (/** @type {any[]} */ ...a) => { mark(1); await later(); return f(...a); };
    }
    return st;
  };
  const batch = db.batch.bind(db);
  db.batch = async (/** @type {any[]} */ list) => { mark(list.length); await later(); return batch(list); };
  return { take() { const r = { trips, statements }; trips = 0; statements = 0; last = -1; return r; } };
}

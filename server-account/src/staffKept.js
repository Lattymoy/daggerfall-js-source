// @ts-check
// STAFF-SPEED-2 (2026-10-29, the staff panel slow on every page, "server refuses a lot"): Home, Status and Economy
// were kept in isolate memory, and a busy Worker's next request lands in another isolate, so nearly every open read it
// all again (live: Home p95 22 s, Economy p50 14 s, D1 answering `overloaded`).
// So an answer is kept in `staff_kept` (migration 0195): one row a key. Inside `freshS` the row answers. Inside
// `staleS` it answers at once and one request (the `busy_until` claim) makes it again after (`ctx.later`). Past that,
// or no row, it is made before it is sent. Never kept: what one staff member sees and another does not. No table: no row.
import { DB_ROOT } from './service.js';

/** The longest answer kept, bytes of its JSON: D1 takes a value to 2 MB; past this one the answer is made every time. */
export const STAFF_KEPT_MAX_BYTES = 900_000;
/** How long one request's claim to make a stale row again holds, seconds: past it another request may. */
export const STAFF_KEPT_BUSY_S = 60;

/** This isolate's parsed rows, per database binding (a request's counted Proxy names its binding, service.js DB_ROOT):
 *  key -> { at, value }. @type {WeakMap<object, Map<string, { at: number, value: any }>>} */
let keptBy = new WeakMap();
/** Tests only: a fresh start sets every key apart from the rows before it (0 in a Worker - its keys as they are). */
let era = 0;
const rowKey = (/** @type {string} */ key) => (era ? `${era}:${key}` : key);
/** Tests stand fresh services: nothing kept before counts. */
export const _resetStaffKeptForTests = () => {
  keptBy = new WeakMap();
  era++;
};
/** Tests stand another isolate: its memory empty, the rows every isolate reads as they stand. */
export const _otherIsolateForTests = () => {
  keptBy = new WeakMap();
};
/** @param {any} db */
const mineOf = (db) => {
  const root = db?.[DB_ROOT] ?? db;
  let m = keptBy.get(root);
  if (!m) keptBy.set(root, (m = new Map()));
  return m;
};

/** The statement that keeps `value` under `key` - null for one past STAFF_KEPT_MAX_BYTES (made every time, never kept).
 *  A row made later than this one is never overwritten by it. @param {any} db @param {string} key @param {number} nowS @param {any} value */
function storeStatement(db, key, nowS, value) {
  const body = JSON.stringify(value);
  if (typeof body !== 'string' || body.length > STAFF_KEPT_MAX_BYTES) return null;
  try {
    return db
      .prepare(
        `INSERT INTO staff_kept (key, at, body, busy_until) VALUES (?1, ?2, ?3, 0)
    ON CONFLICT (key) DO UPDATE SET at = excluded.at, body = excluded.body, busy_until = 0 WHERE excluded.at >= staff_kept.at`,
      )
      .bind(rowKey(key), nowS, body);
  } catch {
    return null;
  } // a database that will not even take it (no table): never kept
}
/** Run statements off the answer's path where the Worker lets it (`ctx.later`), else awaited; never throws.
 *  @param {any} ctx @param {any[]} list @param {string} what */
async function writeOff(ctx, list, what) {
  if (!list.length) return;
  const p = (list.length === 1 ? list[0].run() : ctx.db.batch(list)).catch((/** @type {any} */ e) =>
    console.warn(`[staff-kept] ${what} kept`, e?.message ?? e),
  );
  if (typeof ctx.later === 'function') ctx.later(p);
  else await p;
}

/**
 * ONE READ FOR MANY: `fn` run with `ctx.kept` - every row of `keys` read in one statement before it (each staffKept inside
 * answers from it, never asking the table again) and every answer it makes kept in one batch after it. Answers `fn`'s
 * answer.
 * @template T @param {any} ctx @param {string[]} keys @param {(ctx: any) => Promise<T>} fn @returns {Promise<T>}
 */
export async function staffKeptAll(ctx, keys, fn) {
  const { db } = ctx;
  /** @type {Map<string, any>} */
  const rows = new Map();
  const ask = [...new Set(keys)];
  if (ask.length) {
    try {
      const got =
        (
          await db
            .prepare(
              `SELECT key, at, body, busy_until FROM staff_kept WHERE key IN (${ask.map((_, i) => `?${i + 1}`).join(', ')})`,
            )
            .bind(...ask.map(rowKey))
            .all()
        )?.results ?? [];
      for (const k of ask) rows.set(k, got.find((r) => r.key === rowKey(k)) ?? null);
    } catch {
      rows.clear();
    }
  }
  /** @type {any[]} */
  const writes = [];
  const out = await fn({ ...ctx, kept: { rows, writes } });
  await writeOff(ctx, writes, keys.join(','));
  return out;
}

/**
 * An answer kept `freshS` seconds for every isolate, and served stale up to `staleS` while one request makes it again.
 * `make` answers the value (JSON); its throw is the caller's, as it was. Answers the value. Inside staffKeptAll its row
 * is the one read there, and its keeping waits for that batch.
 * @template T
 * @param {{ db: any, nowS: number, later?: (p: Promise<any>) => void, kept?: { rows: Map<string, any>, writes: any[] } }} ctx
 * @param {string} key @param {number} freshS @param {number} staleS @param {() => Promise<T>} make @returns {Promise<T>}
 */
export async function staffKept(ctx, key, freshS, staleS, make) {
  const { db, nowS } = ctx;
  const mine = mineOf(db);
  const here = mine.get(key);
  if (here && nowS >= here.at && nowS - here.at < freshS) return here.value;
  /** @type {any} */
  let row = null;
  if (ctx.kept?.rows.has(key)) row = ctx.kept.rows.get(key);
  else {
    try {
      row = await db.prepare('SELECT at, body, busy_until FROM staff_kept WHERE key = ?1').bind(rowKey(key)).first();
    } catch {
      row = null;
    }
  }
  const at = Number(row?.at);
  let value;
  if (row && Number.isFinite(at) && nowS >= at && nowS - at < staleS) {
    try {
      value = JSON.parse(String(row.body));
    } catch {
      row = null;
    }
  } else row = null;
  if (row) {
    mine.set(key, { at, value });
    if (nowS - at < freshS) return value;
    // stale: answered now, made again after - by the one request whose claim lands
    const again = (async () => {
      const claim = await db
        .prepare('UPDATE staff_kept SET busy_until = ?2 WHERE key = ?1 AND at = ?3 AND busy_until <= ?4')
        .bind(rowKey(key), nowS + STAFF_KEPT_BUSY_S, at, nowS)
        .run();
      if (!claim?.meta?.changes) return;
      const fresh = await make();
      mine.set(key, { at: nowS, value: fresh });
      await storeStatement(db, key, nowS, fresh)?.run();
    })().catch((e) => console.warn(`[staff-kept] ${key} made again`, /** @type {any} */ (e)?.message ?? e));
    if (typeof ctx.later === 'function') ctx.later(again);
    else await again;
    return value;
  }
  value = await make();
  mine.set(key, { at: nowS, value });
  const st = storeStatement(db, key, nowS, value);
  if (st) {
    if (ctx.kept) ctx.kept.writes.push(st);
    else await writeOff(ctx, [st], key);
  }
  return value;
}

/** A kept answer forgotten (a limit set changes the tiles at once): the row and this isolate's copy. Never throws.
 *  @param {any} db @param {string[]} keys */
export function staffKeptForget(db, keys) {
  const mine = mineOf(db);
  for (const k of keys) mine.delete(k);
  return db
    .prepare(`DELETE FROM staff_kept WHERE key IN (${keys.map((_, i) => `?${i + 1}`).join(', ')})`)
    .bind(...keys.map(rowKey));
}

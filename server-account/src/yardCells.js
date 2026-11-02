// @ts-check
// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md section 10): A TOWN'S YARDS, KEPT AND READ ONE BLOCK AT A
// TIME, in place of YARD-SNAP's whole-town row and YARD-TOWN's 6,500-piece bound (one D1 row's size, not a game rule).
// A CELL is one RMB block of one town (net/yardCellLaw.js yardCellOf). Migration 0190 keeps per cell home_yard_cell_ver
// (`ver`, moved by triggers on every yard row written, and `built`; a partial index on `ver <> built` finds stale cells)
// and home_yard_cells (its rows built at `built`, keptBoard.js `shape`, NULL past KEPT_BOARD_MAX_BYTES - never met: a
// cell holds 1,920 pieces at most, 415 KB). A decor write rebuilds its cell (settleYardCell), the clock the rest
// (settleStaleYardCells); a reader is answered the moved cells alone (yardCellsOf), kept YARDS_KEPT_S (yardCellsKept).
import { DB_ROOT, replicaDb, bookmarkOf } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { decorYardPieceOf, decorYardHighOk } from '../../src/net/decorLaw.js';
import { yardCellOf, yardCellAskOf, YARD_CELL_PIECES_MAX } from '../../src/net/yardCellLaw.js';
import { shapeOf, keptPast, KEPT_BOARD_MAX_BYTES } from './keptBoard.js';
import { pieceOfRow } from './decor.js';

/** The columns a built row keeps, in order - pieceOfRow's. */
export const YARD_CELL_COLS = Object.freeze([
  'map_id',
  'building_key',
  'id',
  'model',
  'flat_archive',
  'flat_record',
  'place',
  'placed_at',
  'item',
  'paid',
  'yard',
]);

/** A cell's yard rows as they stand: one key range of idx_home_decor_yard_order (migration 0136), in its order, so
 *  there is no sort. `town` and `cell` are SQL - parameters, or the build's version row. */
export const cellRowsSql = (
  /** @type {string} */ town,
  /** @type {string} */ cell,
) => `SELECT ${YARD_CELL_COLS.join(', ')} FROM home_decor
    WHERE map_id = ${town} AND yard = 1 AND building_key BETWEEN ${cell} * 256 AND ${cell} * 256 + 255
    ORDER BY building_key, placed_at, id LIMIT ${YARD_CELL_PIECES_MAX}`;

/** The build's shape: its read whole and its bound. A deploy that changes it marks every cell stale in its own
 *  migration (`UPDATE home_yard_cell_ver SET built = 0`), so the clock finds them by the index. Migration 0190 builds
 *  every cell in this shape; its literal is pinned to this. */
export const YARD_CELL_SHAPE = shapeOf(
  'yard cell: [columns...] each, NULL past the bound',
  cellRowsSql('?', '?'),
  KEPT_BOARD_MAX_BYTES,
);

/** How many stale cells the minute's clock builds a firing. Only a cascade leaves a cell stale (a decor route builds
 *  its own), so this paces the clock and is never seen by a player: a stale cell is read as its rows stand. */
export const YARD_CELLS_SETTLE_A_MINUTE = 200;

/** A built row that answers for its cell: built at the version row's version, in this shape. */
const FRESH_SQL = (/** @type {string} */ v) =>
  `EXISTS (SELECT 1 FROM home_yard_cells c WHERE c.map_id = ${v}.map_id AND c.cell = ${v}.cell AND c.built = ${v}.ver AND c.shape = '${YARD_CELL_SHAPE}')`;

/** The build of every stale cell `where` names (`v` its version row): its rows read and kept at the version read with
 *  them, in one statement, so no write lands between the read and the version. */
const cellBuildSql = (/** @type {string} */ where) => `INSERT INTO home_yard_cells (map_id, cell, built, shape, rows)
  SELECT v.map_id, v.cell, v.ver, '${YARD_CELL_SHAPE}', (SELECT CASE WHEN length(CAST(j AS BLOB)) <= ${KEPT_BOARD_MAX_BYTES} THEN j END
    FROM (SELECT json_group_array(json_array(${YARD_CELL_COLS.join(', ')})) AS j FROM (${cellRowsSql('v.map_id', 'v.cell')})))
  FROM home_yard_cell_ver v WHERE v.ver <> v.built AND ${where}
  ON CONFLICT (map_id, cell) DO UPDATE SET built = excluded.built, shape = excluded.shape, rows = excluded.rows`;

/** The version rows whose cells now stand built, marked so - off the partial index (`ver <> built`). */
const cellMarkSql = (/** @type {string} */ where) => `UPDATE home_yard_cell_ver SET built = ver
  WHERE ver <> built AND ${where} AND ${FRESH_SQL('home_yard_cell_ver')}`;

/** A cell built again after a decor route's write - a no-op when the write moved no yard row. Answers the cell and the
 *  version this statement built it at (YC2: the YARD ORDER's `v`), or null when it built nothing - the write moved no
 *  yard row, or the minute's clock built the cell first. */
export async function settleYardCell(
  /** @type {any} */ db,
  /** @type {unknown} */ mapId,
  /** @type {unknown} */ buildingKey,
) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return null;
  const cell = yardCellOf(/** @type {number} */ (buildingKey));
  const [built] = await db.batch([
    db.prepare(`${cellBuildSql('v.map_id = ?1 AND v.cell = ?2')} RETURNING built`).bind(mapId, cell),
    db.prepare(cellMarkSql('map_id = ?1 AND cell = ?2')).bind(mapId, cell),
  ]);
  const ver = Number(built?.results?.[0]?.built);
  return Number.isSafeInteger(ver) && ver > 0 ? { cell, ver } : null;
}

/** The minute's clock (cron.js `yard-cells`): the stale cells built, YARD_CELLS_SETTLE_A_MINUTE a firing; how many. On a
 *  quiet world - no cell stale - it is the one look at the stale index (AUDIT SCALE D7 counts the clock's statements). */
export async function settleStaleYardCells(/** @type {any} */ db) {
  const any = await db.prepare('SELECT 1 AS n FROM home_yard_cell_ver WHERE ver <> built LIMIT 1').first();
  if (!any) return 0;
  const stale = `(v.map_id, v.cell) IN (SELECT map_id, cell FROM home_yard_cell_ver WHERE ver <> built LIMIT ${YARD_CELLS_SETTLE_A_MINUTE})`;
  const [built] = await db.batch([db.prepare(cellBuildSql(stale)), db.prepare(cellMarkSql('true'))]);
  return Number(built?.meta?.changes ?? 0);
}

/** About how much of a cell's text one answer carries before the rest waits for the asker's next request - transport
 *  pacing, never seen by a player. The first changed cell is always answered whole (at most some 415 KB). */
export const YARD_CELLS_ANSWER_BYTES = 1_000_000;

/** The asked cells' versions, and of each whether its built row answers and how large it is. A cell no version row
 *  names stood no yard piece - unless (AUDIT LEAN-READS 2 B4's case) its rows stand all the same, `orphan`, read as
 *  they stand. Binds (map, the request's cells as JSON - one bind, D1 takes 100). In the request's order. */
const CELLS_STATE_SQL = `SELECT json_extract(a.value, '$[0]') AS cell, json_extract(a.value, '$[1]') AS have, v.ver AS ver,
    (c.built = v.ver AND c.shape = '${YARD_CELL_SHAPE}' AND c.rows IS NOT NULL) AS fresh, length(CAST(c.rows AS BLOB)) AS bytes,
    (c.built = v.ver AND c.shape = '${YARD_CELL_SHAPE}' AND c.rows IS NULL) AS past,
    (v.ver IS NULL AND EXISTS (SELECT 1 FROM home_decor d WHERE d.map_id = ?1 AND d.yard = 1
      AND d.building_key BETWEEN json_extract(a.value, '$[0]') * 256 AND json_extract(a.value, '$[0]') * 256 + 255)) AS orphan
  FROM json_each(?2) a
  LEFT JOIN home_yard_cell_ver v ON v.map_id = ?1 AND v.cell = json_extract(a.value, '$[0]')
  LEFT JOIN home_yard_cells c ON c.map_id = ?1 AND c.cell = json_extract(a.value, '$[0]')
  ORDER BY a.key`;
/** The built rows of the cells chosen, with the version each was built at. Binds (map, the cells as JSON). */
const CELLS_ROWS_SQL = `SELECT cell, built, rows FROM home_yard_cells WHERE map_id = ?1 AND cell IN (SELECT value FROM json_each(?2))
  AND shape = '${YARD_CELL_SHAPE}' AND rows IS NOT NULL`;
const CELL_STANDING_SQL = cellRowsSql('?1', '?2');

/** A built row's rows, as CELL_STANDING_SQL answers them - or null for a text that is not one. */
export function yardCellRowsOf(/** @type {unknown} */ text) {
  let list;
  try {
    list = JSON.parse(String(text));
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  const rows = [];
  for (const values of list) {
    if (!Array.isArray(values) || values.length !== YARD_CELL_COLS.length) return null;
    rows.push(Object.fromEntries(YARD_CELL_COLS.map((column, i) => [column, values[i]])));
  }
  return rows;
}

/** @typedef {{ buildingKey: number, pieces: any[] }} YardOfCell */
/** @typedef {{ cell: number, ver: number, yards: YardOfCell[] }} CellAnswer  `ver` the version read (0: a cell no version row names) */

/** A cell's rows as its yards - each home's pieces, oldest first. A piece the yard's law refuses, or one standing past
 *  DECOR_YARD_HIGH from before YARD-HEIGHT (migration 0109), is never served. */
function yardsOfRows(/** @type {any[]} */ rows) {
  /** @type {Map<number, any[]>} */
  const byBuilding = new Map();
  for (const row of rows) {
    const piece = pieceOfRow(row);
    if (!piece || !decorYardPieceOf(piece) || !decorYardHighOk(piece)) continue;
    if (!byBuilding.has(row.building_key)) byBuilding.set(row.building_key, []);
    byBuilding.get(row.building_key)?.push(piece);
  }
  return [...byBuilding].map(([buildingKey, pieces]) => ({ buildingKey, pieces }));
}

/**
 * THE CELLS OF A TOWN THAT MOVED, read off `db`: of `cells` ([cell, version held] pairs, nearest first), each whose
 * version is past the one held, until the answer's text passes `budget` bytes - the first always. A version older than
 * the one held is answered as unchanged (a replica behind the asker never takes a cell back). Answers the cells read,
 * the changed cells left for the asker's next request (`more`), and every asked cell's version as read (`vers` - 0 for
 * a cell that never stood a yard piece).
 * @returns {Promise<{ cells: CellAnswer[], more: number[], vers: Map<number, number> }>}
 */
export async function readYardCells(
  /** @type {any} */ db,
  /** @type {number} */ mapId,
  /** @type {Array<[number, number]>} */ cells,
  budget = YARD_CELLS_ANSWER_BYTES,
) {
  const { results: states = [] } = await db.prepare(CELLS_STATE_SQL).bind(mapId, JSON.stringify(cells)).all();
  /** @type {any[]} */
  const fresh = [];
  /** @type {any[]} */
  const standing = [];
  const more = [];
  /** @type {Map<number, number>} */
  const vers = new Map();
  let bytes = 0;
  for (const state of states) {
    if (!state.orphan) vers.set(Number(state.cell), Number(state.ver ?? 0));
    const moved = state.ver != null ? Number(state.ver) > Number(state.have) : !!state.orphan;
    if (!moved) continue;
    const taken = fresh.length + standing.length;
    if (taken > 0 && bytes >= budget) {
      more.push(Number(state.cell));
      continue;
    }
    if (state.fresh) {
      fresh.push(state);
      bytes += Number(state.bytes ?? 0);
    } else {
      standing.push(state);
    }
  }
  /** @type {Map<number, CellAnswer>} */
  const answers = new Map();
  if (fresh.length) {
    const { results = [] } = await db
      .prepare(CELLS_ROWS_SQL)
      .bind(mapId, JSON.stringify(fresh.map((state) => Number(state.cell))))
      .all();
    for (const row of results) {
      const rows = yardCellRowsOf(row.rows);
      if (rows)
        answers.set(Number(row.cell), { cell: Number(row.cell), ver: Number(row.built), yards: yardsOfRows(rows) });
    }
  }
  // A cell whose built row is behind its version (a cascade the clock has not reached), of another deploy's shape, or
  // past the kept bound: read as its rows stand, at the version read before them - so never an answer older than the
  // rows, and at worst one the asker reads once more.
  for (const state of [...standing, ...fresh.filter((s) => !answers.has(Number(s.cell)))]) {
    const cell = Number(state.cell);
    if (state.past) keptPast('a yard cell', `town ${mapId} cell ${cell}`);
    const { results: rows = [] } = await db.prepare(CELL_STANDING_SQL).bind(mapId, cell).all();
    answers.set(cell, { cell, ver: Number(state.ver ?? 0), yards: yardsOfRows(rows) });
  }
  const order = states.map((state) => Number(state.cell));
  return {
    cells: order.filter((cell) => answers.has(cell)).map((cell) => /** @type {CellAnswer} */ (answers.get(cell))),
    more,
    vers,
  };
}

// ═══ THE ISOLATE'S KEPT CELLS ════════════════════════════════════════
//
// YARD-SHED's law (one isolate keeps an answer every caller of the moment gets alike) and YARDS-REPLICA's (a read on a
// replica, from the bookmark the last kept read ended at; the primary's right after this isolate's own write), a cell
// at a time. Bounded by BYTES, the least recently used let go first - never by a count of towns, which grows by an
// order of magnitude with the rest of Tamriel - and nothing here is keyed by a town that is not also kept: a write's
// mark is a kept entry of its own, and the answer a read in flight must not keep is marked on the read, not in a map.

/** How long an isolate believes a kept cell, seconds. */
export const YARDS_KEPT_S = 30;
/** How many bytes of cells an isolate keeps (a Worker isolate has 128 MB). */
export const YARD_CELLS_KEPT_BYTES = 16 * 1024 * 1024;
let keptBytesMax = YARD_CELLS_KEPT_BYTES;
/** Where a cell with no mark is read: any instance's. */
export const YARD_CELLS_FROM = 'first-unconstrained';
/** A kept entry's weight past its text - what a write's mark weighs. */
const ENTRY_BYTES = 64;

/** @typedef {object} KeptCell
 * @property {number} at          when it was read, seconds
 * @property {number} ver         its version as read
 * @property {YardOfCell[] | null} yards  null: only its version is known (it was read unchanged for its asker)
 * @property {number} bytes       what it weighs in the isolate
 * @property {string | null} mark the bookmark the read ended at
 * @property {boolean} written    this isolate wrote it since: its next read is the primary's, and nothing is believed */
/** @type {Map<string, KeptCell>} in use order, the least recent first */
const kept = new Map();
let keptBytes = 0;
/**
 * @typedef {object} Flight  a read out now
 * @property {Set<string>} stale       the cells written here since it left - their answers are not kept
 * @property {Promise<unknown>} done    settles when the read is over, kept or not
 */
/** @type {Map<string, Flight>} each cell being read now */
const reading = new Map();
/** The newest bookmark let go with an evicted cell: a cell read after it starts there, never older than this isolate
 *  already answered (D1's bookmarks sort oldest to newest). */
let floor = /** @type {string | null} */ (null);

const keyOf = (/** @type {number} */ mapId, /** @type {number} */ cell) => `${mapId}:${cell}`;
const WRITTEN = Object.freeze({ at: 0, ver: 0, yards: null, bytes: ENTRY_BYTES, mark: null, written: true });

function keep(/** @type {string} */ key, /** @type {KeptCell} */ entry) {
  const had = kept.get(key);
  if (had) {
    keptBytes -= had.bytes;
    kept.delete(key);
  }
  kept.set(key, entry);
  keptBytes += entry.bytes;
  while (keptBytes > keptBytesMax && kept.size > 1) {
    const [oldestKey, oldest] = /** @type {[string, KeptCell]} */ (kept.entries().next().value);
    if (oldest.mark && (floor == null || oldest.mark > floor)) floor = oldest.mark;
    keptBytes -= oldest.bytes;
    kept.delete(oldestKey);
  }
}

/** A cell kept here and believed now - touched as the most recently used. */
function keptNow(/** @type {string} */ key, /** @type {number} */ nowS) {
  const entry = kept.get(key);
  if (!entry || entry.written || nowS - entry.at >= YARDS_KEPT_S) return null;
  kept.delete(key);
  kept.set(key, entry);
  return entry;
}

/** Where the read of `keys` starts: the primary's after this isolate's own write to one of them, else the newest mark
 *  among them, else the floor, else any instance's. */
function readFrom(/** @type {string[]} */ keys) {
  let newest = /** @type {string | null} */ (null);
  for (const key of keys) {
    const entry = kept.get(key);
    if (entry?.written) return 'first-primary';
    if (entry?.mark && (newest == null || entry.mark > newest)) newest = entry.mark;
  }
  return newest ?? floor ?? YARD_CELLS_FROM;
}

/**
 * A TOWN'S CELLS AS THE ROUTE ANSWERS THEM (index.js `/v1/homes/yards/cells`, no session): each asked cell this
 * isolate keeps answered from memory - unchanged where the asker holds its version, its yards where the isolate holds
 * them - and the rest read in one go on a replica.
 * @param {{db: any}} ctx
 * @returns {Promise<{ error: string } | { mapId: number, cells: CellAnswer[], more: number[] }>}
 */
export async function yardCellsKept(ctx, /** @type {unknown} */ body, /** @type {number} */ nowS) {
  const ask = yardCellAskOf(body);
  if (!ask) return { error: 'bad-cells' };
  const { mapId } = ask;
  // YARD-SHED: the asks of one moment share one read - an asked cell another ask is reading now is waited for, then
  // answered from what that read kept like any kept cell
  const flights = new Set(
    ask.cells.map(([cell]) => reading.get(keyOf(mapId, cell))).filter((flight) => flight != null),
  );
  if (flights.size) await Promise.allSettled([...flights].map((flight) => flight.done));
  /** @type {Map<number, CellAnswer>} */
  const answered = new Map();
  /** @type {Array<[number, number]>} */
  const toRead = [];
  const more = [];
  let bytes = 0;
  for (const [cell, have] of ask.cells) {
    const entry = keptNow(keyOf(mapId, cell), nowS);
    if (entry && entry.ver <= have) continue;
    if (!entry?.yards) {
      toRead.push([cell, have]);
      continue;
    }
    if (answered.size > 0 && bytes >= YARD_CELLS_ANSWER_BYTES) {
      more.push(cell);
      continue;
    }
    answered.set(cell, { cell, ver: entry.ver, yards: entry.yards });
    bytes += entry.bytes;
  }
  if (toRead.length) {
    const keys = toRead.map(([cell]) => keyOf(mapId, cell));
    const from = readFrom(keys);
    const root = ctx.db?.[DB_ROOT] ?? ctx.db;
    let db = ctx.db;
    try {
      db = replicaDb(typeof ctx.db?.withSession === 'function' ? ctx.db : root, from);
    } catch {
      /* a bookmark D1 refuses: the request's database */
    }
    /** @type {() => void} */
    let land = () => {};
    /** @type {Flight} */
    const flight = {
      stale: new Set(),
      done: new Promise((resolve) => {
        land = () => resolve(undefined);
      }),
    };
    for (const key of keys) reading.set(key, flight);
    try {
      const budget = answered.size ? Math.max(0, YARD_CELLS_ANSWER_BYTES - bytes) : YARD_CELLS_ANSWER_BYTES;
      const read = await readYardCells(db, mapId, toRead, budget);
      const mark = bookmarkOf(db);
      /** @type {Map<number, CellAnswer>} */
      const readAnswers = new Map(read.cells.map((answer) => [answer.cell, answer]));
      for (const [cell, ver] of read.vers) {
        const key = keyOf(mapId, cell);
        if (flight.stale.has(key) || read.more.includes(cell)) continue;
        const answer = readAnswers.get(cell);
        // a cell read unchanged for its asker is kept by its version alone, so the next asker who holds it is answered
        // from memory; one with no version row stood no yard piece, and is kept as such
        const yards = answer?.yards ?? (ver === 0 ? [] : null);
        keep(key, {
          at: nowS,
          ver,
          yards,
          bytes: ENTRY_BYTES + (yards ? JSON.stringify(yards).length : 0),
          mark,
          written: false,
        });
      }
      for (const answer of read.cells) answered.set(answer.cell, answer);
      more.push(...read.more);
    } catch (e) {
      if (floor === from) floor = null; // a read that failed from a bookmark: the next starts from none
      throw e;
    } finally {
      for (const key of keys) if (reading.get(key) === flight) reading.delete(key);
      land();
    }
  }
  const order = ask.cells.map(([cell]) => cell);
  return {
    mapId,
    cells: order.filter((cell) => answered.has(cell)).map((cell) => /** @type {CellAnswer} */ (answered.get(cell))),
    more,
  };
}

/** A cell this isolate wrote: its kept answer let go, its next read the primary's, and a read in flight not kept. */
export function forgetYardCell(/** @type {unknown} */ mapId, /** @type {unknown} */ buildingKey) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return;
  const key = keyOf(/** @type {number} */ (mapId), yardCellOf(/** @type {number} */ (buildingKey)));
  reading.get(key)?.stale.add(key);
  keep(key, { ...WRITTEN });
}

/** Every cell of a town this isolate keeps or is reading, let go as written (an account deleted: its homes' towns -
 *  index.js). A cell of the town not kept here is read as any cell is. */
export function forgetYardTown(/** @type {unknown} */ mapId) {
  if (!homeMapIdOk(mapId)) return;
  const prefix = `${mapId}:`;
  for (const key of new Set([...kept.keys(), ...reading.keys()])) {
    if (!key.startsWith(prefix)) continue;
    reading.get(key)?.stale.add(key);
    keep(key, { ...WRITTEN });
  }
}

/** Tests: a fresh isolate. */
export function _resetYardCellsKept() {
  kept.clear();
  reading.clear();
  keptBytes = 0;
  floor = null;
  keptBytesMax = YARD_CELLS_KEPT_BYTES;
}
/** Tests: an isolate that keeps fewer bytes, so its eviction can be reached. */
export function _setYardCellsKeptBytes(/** @type {number} */ bytes) {
  keptBytesMax = bytes;
}
/** Tests: what the isolate keeps. */
export const _yardCellsKeptState = () => ({ keys: [...kept.keys()], bytes: keptBytes, floor });

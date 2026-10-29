// @ts-check
// YC4 HOME-CELL (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14): THE SHARED PART OF A TOWN'S HOMES, KEPT
// AND READ ONE BLOCK AT A TIME, as yardCells.js keeps the yards. A cell is net/yardCellLaw.js yardCellOf's. Migration
// 0194 keeps per cell home_cell_ver (`ver`, moved by triggers on homes, home_rooms and guilds; `built`; `stale_at`, when
// a let room next falls vacant) and home_cells (its rows built at `built`). A home write rebuilds its cell
// (settleHomeCellsAfter), the minute's clock moves cells past their `stale_at` and builds the rest (settleHomeCellsClock),
// and a reader is answered the moved cells alone (homeCellsKept). The caller's own part is homes.js homesOwn.
import { DB_ROOT, replicaDb, bookmarkOf } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { yardCellOf, yardCellAskOf } from '../../src/net/yardCellLaw.js';
import { shapeOf, keptPast, KEPT_BOARD_MAX_BYTES } from './keptBoard.js';
import { roomsFreeSql, sharedHomeOf } from './homes.js';

/** The columns a built row keeps, in order - what homes.js sharedHomeOf reads. No player's id, no character's. */
export const HOME_CELL_COLS = Object.freeze(['building_key', 'owner_name', 'entry', 'look', 'score', 'guild_id', 'deed', 'guild_name', 'guild_tag', 'guild_heraldry', 'vacant', 'rent_from']);

/** A cell's homes as they stand at `now`: one key range of the homes' primary key, in its order. `town`, `cell` and
 *  `now` are SQL - parameters, or the build's version row and bind. */
export const cellRowsSql = (/** @type {string} */ town, /** @type {string} */ cell, /** @type {string} */ now) => `SELECT h.building_key, h.owner_name, h.entry, h.look, h.score, h.guild_id, h.deed,
      g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry,
      ${roomsFreeSql(now)}
    FROM homes h LEFT JOIN guilds g ON g.id = h.guild_id
    WHERE h.map_id = ${town} AND h.building_key BETWEEN ${cell} * 256 AND ${cell} * 256 + 255
    ORDER BY h.building_key`;

/** When a cell's free rooms next change with no write: the soonest end of a listed room's tenancy past `now`. */
export const staleAtSql = (/** @type {string} */ town, /** @type {string} */ cell, /** @type {string} */ now) => `(SELECT MIN(r.until) FROM home_rooms r
    WHERE r.map_id = ${town} AND r.building_key BETWEEN ${cell} * 256 AND ${cell} * 256 + 255 AND r.listed = 1 AND r.tenant IS NOT NULL AND r.until > ${now})`;

/** The build's shape: its read whole and its bound. A deploy that changes it marks every cell stale in its own
 *  migration (`UPDATE home_cell_ver SET built = 0`). Migration 0194 builds every cell in this shape; its literal is
 *  pinned to this. */
export const HOME_CELL_SHAPE = shapeOf('home cell: [columns...] each, NULL past the bound', cellRowsSql('?', '?', '?'), KEPT_BOARD_MAX_BYTES);

/** How many stale cells the minute's clock builds a firing - pacing, never seen by a player: a stale cell is read as
 *  its rows stand. */
export const HOME_CELLS_SETTLE_A_MINUTE = 200;

/** A built row that answers for its cell: built at the version row's version, in this shape. */
const FRESH_SQL = (/** @type {string} */ v) => `EXISTS (SELECT 1 FROM home_cells c WHERE c.map_id = ${v}.map_id AND c.cell = ${v}.cell AND c.built = ${v}.ver AND c.shape = '${HOME_CELL_SHAPE}')`;

/** The build of every stale cell `where` names (`v` its version row) at `now`: its rows read and kept at the version
 *  read with them, in one statement, so no write lands between the read and the version. */
const cellBuildSql = (/** @type {string} */ where, /** @type {string} */ now) => `INSERT INTO home_cells (map_id, cell, built, shape, rows)
  SELECT v.map_id, v.cell, v.ver, '${HOME_CELL_SHAPE}', (SELECT CASE WHEN length(CAST(j AS BLOB)) <= ${KEPT_BOARD_MAX_BYTES} THEN j END
    FROM (SELECT json_group_array(json_array(${HOME_CELL_COLS.join(', ')})) AS j FROM (${cellRowsSql('v.map_id', 'v.cell', now)})))
  FROM home_cell_ver v WHERE v.ver <> v.built AND ${where}
  ON CONFLICT (map_id, cell) DO UPDATE SET built = excluded.built, shape = excluded.shape, rows = excluded.rows`;

/** The version rows whose cells now stand built, marked so (off the partial index), with when they next go stale. */
const cellMarkSql = (/** @type {string} */ where, /** @type {string} */ now) => `UPDATE home_cell_ver
  SET built = ver, stale_at = ${staleAtSql('home_cell_ver.map_id', 'home_cell_ver.cell', now)}
  WHERE ver <> built AND ${where} AND ${FRESH_SQL('home_cell_ver')}`;

/** A cell built again after a home write - a no-op when the write moved nothing shared. Answers the cell and the
 *  version this statement built it at, or null when it built nothing. */
export async function settleHomeCell(/** @type {any} */ db, /** @type {unknown} */ mapId, /** @type {unknown} */ buildingKey, /** @type {number} */ nowS) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return null;
  const cell = yardCellOf(/** @type {number} */ (buildingKey));
  const [built] = await db.batch([
    db.prepare(`${cellBuildSql('v.map_id = ?1 AND v.cell = ?2', '?3')} RETURNING built`).bind(mapId, cell, nowS),
    db.prepare(cellMarkSql('map_id = ?1 AND cell = ?2', '?3')).bind(mapId, cell, nowS),
  ]);
  const ver = Number(built?.results?.[0]?.built);
  return Number.isSafeInteger(ver) && ver > 0 ? { cell, ver } : null;
}

/** The minute's clock (cron.js `yard-cells`): first every cell past its `stale_at` moved a version (a tenancy ran out,
 *  so a page holding it hears it changed), then the stale cells built, HOME_CELLS_SETTLE_A_MINUTE a firing; how many
 *  built. On a quiet world it is one statement: the look at both indexes. */
export async function settleHomeCellsClock(/** @type {any} */ db, /** @type {number} */ nowS) {
  const look = await db.prepare(`SELECT EXISTS (SELECT 1 FROM home_cell_ver WHERE ver <> built) AS stale,
      EXISTS (SELECT 1 FROM home_cell_ver WHERE stale_at IS NOT NULL AND stale_at <= ?1) AS due`).bind(nowS).first();
  if (!look?.stale && !look?.due) return 0;
  const stale = `(v.map_id, v.cell) IN (SELECT map_id, cell FROM home_cell_ver WHERE ver <> built LIMIT ${HOME_CELLS_SETTLE_A_MINUTE})`;
  const statements = [
    db.prepare(cellBuildSql(stale, '?1')).bind(nowS),
    db.prepare(cellMarkSql('true', '?1')).bind(nowS),
  ];
  if (look.due) statements.unshift(db.prepare('UPDATE home_cell_ver SET ver = ver + 1, stale_at = NULL WHERE stale_at IS NOT NULL AND stale_at <= ?1').bind(nowS));
  const answers = await db.batch(statements);
  return Number(answers.at(-2)?.meta?.changes ?? 0);
}

/** The homes a write route names, [mapId, buildingKey] each: an arena move's two, an accepted offer's (the body names
 *  only the offer), and the body's own for the rest. */
async function keysOfWrite(/** @type {any} */ db, /** @type {string} */ path, /** @type {any} */ body) {
  if (path === '/v1/homes/arena-move') return [[body?.mapId, body?.from], [body?.mapId, body?.to]];
  if (path === '/v1/homes/transfer' && body?.op === 'accept' && typeof body.id === 'string') {
    const offer = await db.prepare('SELECT map_id, building_key FROM home_offers WHERE id = ?1').bind(body.id).first();
    return offer ? [[offer.map_id, offer.building_key]] : [];
  }
  return [[body?.mapId, body?.buildingKey]];
}

/** @typedef {{ mapId: number, cell: number, ver: number }} HomeCellMoved */

/**
 * After a home write route's write landed (index.js): each cell it names let go in this isolate and built again.
 * Answers the cells whose version moved, as built - each one a HOME CELL ORDER in the route's answer (index.js withHomeCells).
 * @returns {Promise<HomeCellMoved[]>}
 */
export async function settleHomeCellsAfter(/** @type {any} */ db, /** @type {string} */ path, /** @type {any} */ body, /** @type {number} */ nowS) {
  const keys = await keysOfWrite(db, path, body);
  /** @type {HomeCellMoved[]} */
  const moved = [];
  const seen = new Set();
  for (const [mapId, buildingKey] of keys) {
    if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) continue;
    forgetHomeCell(mapId, buildingKey);
    const key = keyOf(mapId, yardCellOf(buildingKey));
    if (seen.has(key)) continue;
    seen.add(key);
    const settled = await settleHomeCell(db, mapId, buildingKey, nowS);
    if (settled) moved.push({ mapId, ...settled });
  }
  return moved;
}

/** About how much of a cell's text one answer carries before the rest waits for the asker's next request - transport
 *  pacing, never seen by a player. The first changed cell is always answered whole. */
export const HOME_CELLS_ANSWER_BYTES = 1_000_000;

/** The asked cells' versions, and of each whether its built row answers and how large it is. A cell no version row
 *  names held no home - unless (AUDIT LEAN-READS 2 B4's case) its homes stand all the same, `orphan`, read as they
 *  stand. Binds (map, the request's cells as JSON). In the request's order. */
const CELLS_STATE_SQL = `SELECT json_extract(a.value, '$[0]') AS cell, json_extract(a.value, '$[1]') AS have, v.ver AS ver,
    (c.built = v.ver AND c.shape = '${HOME_CELL_SHAPE}' AND c.rows IS NOT NULL) AS fresh, length(CAST(c.rows AS BLOB)) AS bytes,
    (c.built = v.ver AND c.shape = '${HOME_CELL_SHAPE}' AND c.rows IS NULL) AS past,
    (v.ver IS NULL AND EXISTS (SELECT 1 FROM homes h WHERE h.map_id = ?1
      AND h.building_key BETWEEN json_extract(a.value, '$[0]') * 256 AND json_extract(a.value, '$[0]') * 256 + 255)) AS orphan
  FROM json_each(?2) a
  LEFT JOIN home_cell_ver v ON v.map_id = ?1 AND v.cell = json_extract(a.value, '$[0]')
  LEFT JOIN home_cells c ON c.map_id = ?1 AND c.cell = json_extract(a.value, '$[0]')
  ORDER BY a.key`;
/** The built rows of the cells chosen, with the version each was built at. Binds (map, the cells as JSON). */
const CELLS_ROWS_SQL = `SELECT cell, built, rows FROM home_cells WHERE map_id = ?1 AND cell IN (SELECT value FROM json_each(?2))
  AND shape = '${HOME_CELL_SHAPE}' AND rows IS NOT NULL`;
const CELL_STANDING_SQL = cellRowsSql('?1', '?2', '?3');

/** A built row's rows, as CELL_STANDING_SQL answers them - or null for a text that is not one. */
export function homeCellRowsOf(/** @type {unknown} */ text) {
  let list;
  try {
    list = JSON.parse(String(text));
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  const rows = [];
  for (const values of list) {
    if (!Array.isArray(values) || values.length !== HOME_CELL_COLS.length) return null;
    rows.push(Object.fromEntries(HOME_CELL_COLS.map((column, i) => [column, values[i]])));
  }
  return rows;
}

/** @typedef {{ cell: number, ver: number, homes: object[] }} HomeCellAnswer  `ver` the version read (0: no home ever) */

/**
 * THE CELLS OF A TOWN THAT MOVED, read off `db` at `nowS`: of `cells` ([cell, version held] pairs, nearest first), each
 * whose version is past the one held, until the answer's text passes `budget` bytes - the first always. A version older
 * than the one held is answered as unchanged (a replica behind the asker never takes a cell back). Answers the cells
 * read, the changed cells left for the next request (`more`), and every asked cell's version as read (`vers`).
 * @returns {Promise<{ cells: HomeCellAnswer[], more: number[], vers: Map<number, number> }>}
 */
export async function readHomeCells(/** @type {any} */ db, /** @type {number} */ mapId, /** @type {Array<[number, number]>} */ cells, /** @type {number} */ nowS, budget = HOME_CELLS_ANSWER_BYTES) {
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
  /** @type {Map<number, HomeCellAnswer>} */
  const answers = new Map();
  if (fresh.length) {
    const { results = [] } = await db.prepare(CELLS_ROWS_SQL).bind(mapId, JSON.stringify(fresh.map((state) => Number(state.cell)))).all();
    for (const row of results) {
      const rows = homeCellRowsOf(row.rows);
      if (rows) answers.set(Number(row.cell), { cell: Number(row.cell), ver: Number(row.built), homes: rows.map(sharedHomeOf) });
    }
  }
  // A cell whose built row is behind its version (a cascade the clock has not reached), of another deploy's shape, or
  // past the kept bound: read as its homes stand now, at the version read before them - never older than the rows.
  for (const state of [...standing, ...fresh.filter((s) => !answers.has(Number(s.cell)))]) {
    const cell = Number(state.cell);
    if (state.past) keptPast('a home cell', `town ${mapId} cell ${cell}`);
    const { results: rows = [] } = await db.prepare(CELL_STANDING_SQL).bind(mapId, cell, nowS).all();
    answers.set(cell, { cell, ver: Number(state.ver ?? 0), homes: rows.map(sharedHomeOf) });
  }
  const order = states.map((state) => Number(state.cell));
  return { cells: order.filter((cell) => answers.has(cell)).map((cell) => /** @type {HomeCellAnswer} */ (answers.get(cell))), more, vers };
}

// ═══ THE ISOLATE'S KEPT CELLS ════════════════════════════════════════
//
// yardCells.js's kept cells, for homes: bounded by bytes (the least recently used let go first), read on a replica from
// the bookmark the last kept read ended at, the primary's right after this isolate's own write, and the answer a read
// in flight must not keep marked on the read. A parallel copy: the yards' stays as it was proven.

/** How long an isolate believes a kept cell, seconds. */
export const HOMES_KEPT_S = 30;
/** How many bytes of home cells an isolate keeps (a Worker isolate has 128 MB; the yards keep 16 MB beside these). */
export const HOME_CELLS_KEPT_BYTES = 8 * 1024 * 1024;
let keptBytesMax = HOME_CELLS_KEPT_BYTES;
/** Where a cell with no mark is read: any instance's. */
export const HOME_CELLS_FROM = 'first-unconstrained';
/** A kept entry's weight past its text - what a write's mark weighs. */
const ENTRY_BYTES = 64;

/** @typedef {object} KeptCell
 * @property {number} at          when it was read, seconds
 * @property {number} ver         its version as read
 * @property {object[] | null} homes  null: only its version is known (it was read unchanged for its asker)
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
const WRITTEN = Object.freeze({ at: 0, ver: 0, homes: null, bytes: ENTRY_BYTES, mark: null, written: true });

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
  if (!entry || entry.written || nowS - entry.at >= HOMES_KEPT_S) return null;
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
  return newest ?? floor ?? HOME_CELLS_FROM;
}

/**
 * A TOWN'S HOME CELLS AS THE ROUTE ANSWERS THEM (index.js `/v1/homes/cells`, under the session pass): each asked cell
 * this isolate keeps answered from memory - unchanged where the asker holds its version, its homes where the isolate
 * holds them - and the rest read in one go on a replica.
 * @param {{db: any}} ctx
 * @returns {Promise<{ error: string } | { mapId: number, cells: HomeCellAnswer[], more: number[] }>}
 */
export async function homeCellsKept(ctx, /** @type {unknown} */ body, /** @type {number} */ nowS) {
  const ask = yardCellAskOf(body);
  if (!ask) return { error: 'bad-cells' };
  const { mapId } = ask;
  // YARD-SHED: the asks of one moment share one read - an asked cell another ask is reading now is waited for, then
  // answered from what that read kept like any kept cell
  const flights = new Set(ask.cells.map(([cell]) => reading.get(keyOf(mapId, cell))).filter((flight) => flight != null));
  if (flights.size) await Promise.allSettled([...flights].map((flight) => flight.done));
  /** @type {Map<number, HomeCellAnswer>} */
  const answered = new Map();
  /** @type {Array<[number, number]>} */
  const toRead = [];
  const more = [];
  let bytes = 0;
  for (const [cell, have] of ask.cells) {
    const entry = keptNow(keyOf(mapId, cell), nowS);
    if (entry && entry.ver <= have) continue;
    if (!entry?.homes) {
      toRead.push([cell, have]);
      continue;
    }
    if (answered.size > 0 && bytes >= HOME_CELLS_ANSWER_BYTES) {
      more.push(cell);
      continue;
    }
    answered.set(cell, { cell, ver: entry.ver, homes: entry.homes });
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
      // a bookmark D1 refuses: the request's database
    }
    /** @type {() => void} */
    let land = () => {};
    /** @type {Flight} */
    const flight = { stale: new Set(), done: new Promise((resolve) => { land = () => resolve(undefined); }) };
    for (const key of keys) reading.set(key, flight);
    try {
      const budget = answered.size ? Math.max(0, HOME_CELLS_ANSWER_BYTES - bytes) : HOME_CELLS_ANSWER_BYTES;
      const read = await readHomeCells(db, mapId, toRead, nowS, budget);
      const mark = bookmarkOf(db);
      /** @type {Map<number, HomeCellAnswer>} */
      const readAnswers = new Map(read.cells.map((answer) => [answer.cell, answer]));
      for (const [cell, ver] of read.vers) {
        const key = keyOf(mapId, cell);
        if (flight.stale.has(key) || read.more.includes(cell)) continue;
        const answer = readAnswers.get(cell);
        // a cell read unchanged for its asker is kept by its version alone; one with no version row held no home
        const homes = answer?.homes ?? (ver === 0 ? [] : null);
        keep(key, { at: nowS, ver, homes, bytes: ENTRY_BYTES + (homes ? JSON.stringify(homes).length : 0), mark, written: false });
      }
      for (const answer of read.cells) answered.set(answer.cell, answer);
      more.push(...read.more);
    } catch (e) {
      if (floor === from) floor = null;   // a read that failed from a bookmark: the next starts from none
      throw e;
    } finally {
      for (const key of keys) if (reading.get(key) === flight) reading.delete(key);
      land();
    }
  }
  const order = ask.cells.map(([cell]) => cell);
  return { mapId, cells: order.filter((cell) => answered.has(cell)).map((cell) => /** @type {HomeCellAnswer} */ (answered.get(cell))), more };
}

/** A cell this isolate wrote: its kept answer let go, its next read the primary's, and a read in flight not kept. */
export function forgetHomeCell(/** @type {unknown} */ mapId, /** @type {unknown} */ buildingKey) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return;
  const key = keyOf(/** @type {number} */ (mapId), yardCellOf(/** @type {number} */ (buildingKey)));
  reading.get(key)?.stale.add(key);
  keep(key, { ...WRITTEN });
}

/** Every cell of a town this isolate keeps or is reading, let go as written (an account deleted: its homes' towns). */
export function forgetHomeTown(/** @type {unknown} */ mapId) {
  if (!homeMapIdOk(mapId)) return;
  const prefix = `${mapId}:`;
  for (const key of new Set([...kept.keys(), ...reading.keys()])) {
    if (!key.startsWith(prefix)) continue;
    reading.get(key)?.stale.add(key);
    keep(key, { ...WRITTEN });
  }
}

/** Tests: a fresh isolate. */
export function _resetHomeCellsKept() {
  kept.clear();
  reading.clear();
  keptBytes = 0;
  floor = null;
  keptBytesMax = HOME_CELLS_KEPT_BYTES;
}
/** Tests: an isolate that keeps fewer bytes, so its eviction can be reached. */
export function _setHomeCellsKeptBytes(/** @type {number} */ bytes) {
  keptBytesMax = bytes;
}
/** Tests: what the isolate keeps. */
export const _homeCellsKeptState = () => ({ keys: [...kept.keys()], bytes: keptBytes, floor });

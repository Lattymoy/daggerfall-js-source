// @ts-check
// YC4 (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14.5): A TOWN'S HOMES READ IN TWO PARTS. The shared part
// comes by cell and version (server-account/src/homeCells.js, `/v1/homes/cells`), as scenes/yardCellSync.js reads the
// yards; the caller's own part (`/v1/homes/own`) is one read of the caller's rows. `read` answers what `/v1/homes/town`
// answers, so the registry (onlineHomes.js) believes it by the same rules: a home's own row where the own part has one,
// else its shared row - its entry 'public' under Open Gates unless it is a hall (homes.js homeRowOf) - with the deeds
// the own part hides left out. A service from before acct223 answers the new routes with a refusal: from then on this
// page reads `/v1/homes/town` as before.

import { yardCellOf } from '../../net/yardCellLaw.js';
import { HOME_KEY_MAX, HOME_TOWN_BLOCKS_MAX } from '../../net/homeLaw.js';

/** How long the caller's own part of a town is believed when nothing of the caller's moved - its own writes, a word on a
 *  cell where it holds a row, and a change of character ask it at once. */
export const HOME_OWN_TTL_MS = 300_000;
/** How long a home this page saw go (its own sale, a hub word) stays gone from the shared part. Another isolate of the
 *  service may answer the cell as it stood for its 30 s (homeCells.js HOMES_KEPT_S); the poll's next answer is past it. */
export const HOME_GONE_HOLD_MS = 60_000;
/** The most requests one read makes for the cells a byte-bounded answer left for later (`more`). */
export const HOME_CELLS_ROUNDS_MAX = 4;

/** A town's side in blocks (MAPS.BSA's exterior is 8 x 8 at most). */
const TOWN_SIDE = Math.sqrt(HOME_TOWN_BLOCKS_MAX);

/**
 * Every cell a town's homes can stand in: each block of the widest town, and BUILDING_KEY_0's cell. The registry knows
 * a town by its map id alone, so it asks them all with the versions it holds; the service answers only the cells that
 * moved, and keeps a cell that never held a home at version 0 (homeCells.js homeCellsKept).
 */
export const HOME_TOWN_CELLS = Object.freeze([
  ...Array.from({ length: HOME_TOWN_BLOCKS_MAX }, (_, i) => Math.floor(i / TOWN_SIDE) * 256 + (i % TOWN_SIDE)),
  yardCellOf(HOME_KEY_MAX),
]);

/** How a service from before acct223 refuses `/v1/homes/cells` and `/v1/homes/own`: a 404 or a 405, or - the paths
 *  unknown to it fall through to its home write routes - the refusals those give a body with no building and no entry
 *  (`bad-entry`, `no-home`) or a guest (`homes-need-account`). Never a ban's or a freeze's 403: those pass. */
const OLDER_SERVICE_STATUSES = new Set([404, 405]);
const OLDER_SERVICE_ERRORS = new Set(['bad-entry', 'no-home', 'homes-need-account']);

/** @typedef {{ ok: boolean, data?: any, error?: string, status?: number }} Answer  net/accountClient.js `call`'s shape */
/** @typedef {{ ver: number, homes: any[] }} HeldCell  a cell's shared rows at the version answered */
/** @typedef {{ at: number, character: string | null, openGates: boolean, homes: any[], hidden: Set<number> }} HeldOwn  the caller's own part, as asked for `character` */
/** @typedef {{ cells: Map<number, HeldCell>, own: HeldOwn | null, gone: Map<number, number> }} HeldTown  `gone`: building key -> when this page saw it go (ms) */

/** Whether an answer is a service from before acct223 refusing a route it does not know. */
function fromOlderService(/** @type {Answer | null} */ answer) {
  if (!answer || answer.ok) return false;
  return OLDER_SERVICE_STATUSES.has(Number(answer.status)) || OLDER_SERVICE_ERRORS.has(String(answer.error));
}

/** The refusal `read` answers for an `ok` answer whose body is not the route's shape. */
const MALFORMED = Object.freeze({ ok: false, error: 'server' });

/**
 * The page's two-part reads of towns' homes over `api` (net/accountClient.js accountHomes). An `api` without `cells` and
 * `own` (a test's fake, an older client door) reads `/v1/homes/town` alone.
 * @param {{ api: any, now?: () => number }} deps
 */
export function createHomeCellSync({ api, now = () => Date.now() }) {
  let older = typeof api?.cells !== 'function' || typeof api?.own !== 'function';
  /** @type {Map<number, HeldTown>} */
  const towns = new Map();

  function townOf(/** @type {number} */ mapId) {
    let town = towns.get(mapId);
    if (!town) {
      town = { cells: new Map(), own: null, gone: new Map() };
      towns.set(mapId, town);
    }
    return town;
  }

  /** One cells answer laid into the town: a version older than the one held never takes a cell back, and a cell asked
   *  and not answered (nor left for later) is unchanged - or, asked for the first time, held empty at version 0. */
  function takeCells(/** @type {HeldTown} */ town, /** @type {Array<[number, number]>} */ asked, /** @type {any[]} */ answers, /** @type {number[]} */ more) {
    for (const answer of answers) {
      if (!Number.isSafeInteger(answer?.cell) || !Array.isArray(answer.homes)) continue;
      const held = town.cells.get(answer.cell);
      const ver = Number(answer.ver) || 0;
      if (held && ver < held.ver) continue;
      town.cells.set(answer.cell, { ver, homes: answer.homes });
    }
    for (const [cell] of asked) {
      if (!town.cells.has(cell) && !more.includes(cell)) town.cells.set(cell, { ver: 0, homes: [] });
    }
  }

  /** Every cell of the town with the versions held, then the cells a full answer left for later. Answers the last
   *  answer - a refusal as it came. */
  async function askCells(/** @type {number} */ mapId, /** @type {HeldTown} */ town) {
    /** @type {number[]} */
    let wanted = [...HOME_TOWN_CELLS];
    /** @type {Answer} */
    let answer = MALFORMED;
    for (let round = 0; round < HOME_CELLS_ROUNDS_MAX && wanted.length; round++) {
      /** @type {Array<[number, number]>} */
      const asked = wanted.map((cell) => [cell, town.cells.get(cell)?.ver ?? 0]);
      answer = await api.cells(mapId, asked);
      if (!answer?.ok) return answer;
      const data = answer.data;
      if (!data || !Array.isArray(data.cells)) return MALFORMED;
      const more = Array.isArray(data.more) ? data.more.filter((cell) => wanted.includes(cell)) : [];
      takeCells(town, asked, data.cells, more);
      wanted = more;
    }
    return answer;
  }

  /** The own part's answer as held, or null for a body that is not the route's shape. */
  function ownOf(/** @type {any} */ data, /** @type {string | null} */ character) {
    if (!data || !Array.isArray(data.homes)) return null;
    const hidden = new Set(Array.isArray(data.hidden) ? data.hidden.filter(Number.isSafeInteger) : []);
    return { at: now(), character, openGates: data.openGates === true, homes: data.homes, hidden };
  }

  /** Whether a home this page saw go is still held gone (HOME_GONE_HOLD_MS); a hold run out is let go. */
  function goneNow(/** @type {HeldTown} */ town, /** @type {number} */ buildingKey) {
    const at = town.gone.get(buildingKey);
    if (at === undefined) return false;
    if (now() - at < HOME_GONE_HOLD_MS) return true;
    town.gone.delete(buildingKey);
    return false;
  }

  /** The town's homes as `/v1/homes/town` lists them for this caller: own rows over shared rows, by building key. */
  function mergedOf(/** @type {HeldTown} */ town) {
    const own = /** @type {HeldOwn} */ (town.own);
    const ownKeys = new Set(own.homes.map((row) => row?.buildingKey));
    const rows = [...own.homes];
    for (const cell of town.cells.values()) {
      for (const shared of cell.homes) {
        const buildingKey = shared?.buildingKey;
        if (ownKeys.has(buildingKey) || own.hidden.has(buildingKey) || goneNow(town, buildingKey)) continue;
        // Open Gates opens a home's door to every caller it is not the owner of - never a hall's (homes.js homeRowOf)
        rows.push(own.openGates && !shared.hall ? { ...shared, entry: 'public' } : shared);
      }
    }
    return rows;
  }

  return {
    /**
     * A town's homes for `character`, in `/v1/homes/town`'s answer shape. The cells are asked each read with the
     * versions held; the own part when `own` says so, on the town's first read, for another character, or once
     * HOME_OWN_TTL_MS has passed. A refusal of either part is the read's refusal.
     * @param {number} mapId @param {string | null} character @param {{ own?: boolean }} [opts]
     * @returns {Promise<Answer>}
     */
    async read(mapId, character, { own = false } = {}) {
      if (older) return api.town(mapId, character);
      const town = townOf(mapId);
      const ownDue = own || !town.own || town.own.character !== character || now() - town.own.at >= HOME_OWN_TTL_MS;
      const [cellsAnswer, ownAnswer] = await Promise.all([askCells(mapId, town), ownDue ? api.own(mapId, character) : null]);
      if (fromOlderService(cellsAnswer) || fromOlderService(ownAnswer)) {
        older = true;
        towns.clear();
        return api.town(mapId, character);
      }
      if (!cellsAnswer?.ok) return cellsAnswer ?? MALFORMED;
      if (ownAnswer) {
        if (!ownAnswer.ok) return ownAnswer;
        const held = ownOf(ownAnswer.data, character);
        if (!held) return MALFORMED;
        town.own = held;
      }
      return { ok: true, data: { mapId, homes: mergedOf(town) } };
    },
    /** Whether a hub word on `cell` at `version` is news: a town read in two parts, that cell held below `version`. */
    wants(/** @type {number} */ mapId, /** @type {number} */ cell, /** @type {number} */ version) {
      const town = older ? undefined : towns.get(mapId);
      if (!town) return false;
      return (town.cells.get(cell)?.ver ?? 0) < version;
    },
    /** Whether the caller's own part holds a home in that cell - a word on it asks the own part too. */
    ownIn(/** @type {number} */ mapId, /** @type {number} */ cell) {
      const own = towns.get(mapId)?.own;
      if (!own) return false;
      return own.homes.some((row) => Number.isSafeInteger(row?.buildingKey) && yardCellOf(row.buildingKey) === cell);
    },
    /** A home this page saw go (its own sale, a hub word): left out of the shared part for HOME_GONE_HOLD_MS. */
    forget(/** @type {number} */ mapId, /** @type {number} */ buildingKey) {
      towns.get(mapId)?.gone.set(buildingKey, now());
    },
    /** Whether this page reads `/v1/homes/town` (an older service, or no cell routes on its door). */
    older: () => older,
  };
}

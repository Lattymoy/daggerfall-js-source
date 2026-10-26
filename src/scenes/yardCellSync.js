// @ts-check
// ═══════════════════════════════════════════════════════════════════
// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md YC1) - THE YARDS A PAGE HOLDS, ONE BLOCK AT A TIME.
//
// The town-wide answer (a whole town every minute, cut at 6,500 pieces) is replaced by cells: one RMB block of one town
// (net/yardCellLaw.js). The yards' host (scenes/homeYards.js) says each sync which cells it wants and how far each is;
// this module asks the account service for them (server-account/src/yardCells.js) and holds what it answered:
//
//   which      the cells within YARD_ASK_M that hold a home the town's homes answer lists - a yard stands only for a
//              listed home, so a cell with none is never asked;
//   when       at once for a cell that comes into reach; again each YARD_TOWN_TTL_MS for the cells in reach, as one
//              request with the versions held, which is answered only with the cells that moved. No poll goes while
//              `polling()` says no (indoors, under a window, the tab hidden); one that came due meanwhile goes the
//              moment it says yes again - the catch-up - and one that did not, at its time;
//   order      every town's request nearest town first, each town's cells nearest first;
//   memory     a cell that leaves the wishes (the host keeps a margin past YARD_ASK_M) is let go with its yards, so what
//              a page holds follows its reach, never the size of the town.
//
// The owner's own writes stand over any answer for YARD_WRITE_HOLD_MS (FB1001 YARD-STALE and the PRIMARY-TRIPS audit:
// the service keeps a cell 30 s an isolate and reads it off a replica, so an answer asked after a write can be from
// before it), and over an answer asked before them whatever its age.
// ═══════════════════════════════════════════════════════════════════

import { decorYardPieceOf, decorYardHighOk } from '../net/decorLaw.js';
import { yardCellOf } from '../net/yardCellLaw.js';
import { YARD_DRAW_M } from '../net/yardRange.js';

/** A cell's yards, believed this long before the cells in reach are asked again. */
export const YARD_TOWN_TTL_MS = 60_000;
/** YARD-SHED: the first wait after a failed ask; each failure in a row doubles it, to YARD_RETRY_MAX_MS. */
export const YARD_RETRY_MS = 10_000;
export const YARD_RETRY_MAX_MS = 300_000;
/** The wait before a town's next ask after `n` failures in a row (ms). */
export const yardRetryMs = (n) => Math.min(YARD_RETRY_MAX_MS, YARD_RETRY_MS * 2 ** Math.max(0, n - 1));
/** PRIMARY-TRIPS audit: how long the owner's own write stands over ANY answer of its cell. */
export const YARD_WRITE_HOLD_MS = 60_000;
/** YARD-SHED: how far from the player's feet a home's cell is asked - past the draw distance, so a yard stands before
 *  it is in sight. */
export const YARD_ASK_M = YARD_DRAW_M + 200;
/** How far past YARD_ASK_M a cell already held is kept, so a step back across the edge does not ask it again. */
export const YARD_KEEP_MARGIN_M = 100;

/**
 * @typedef {object} CellWish  a cell the host wants, this sync
 * @property {number} mapId
 * @property {number} cell
 * @property {number} distance  metres from the player's feet to the cell's nearest listed home
 */
/**
 * @typedef {object} HeldCell
 * @property {number} ver                  the version the service answered (0: none yet)
 * @property {Map<number, any[]>} byKey     each home's pieces as the service answered them, by building key
 * @property {number} askedTurn            the page's write turn when the answer standing for this cell was asked - a
 *                                         write after it is not in it
 */
/**
 * @typedef {object} HeldTown
 * @property {Map<number, HeldCell>} cells
 * @property {number} polledAt   when the last answer to a poll of the cells in reach landed (ms)
 * @property {boolean} asking
 * @property {number} failedAt
 * @property {number} failures   in a row
 * @property {number[]} more     cells the service left for the next request
 */
/**
 * @typedef {object} OwnWrite  the owner's own write to one yard (FB1001 YARD-STALE)
 * @property {number} turn   the write's turn among this page's writes
 * @property {number} at     when (ms)
 * @property {any[]} list    the yard as it left it
 */

/**
 * The page's yard cells. `api.yardCells(mapId, cells)` asks the service (net/accountClient.js accountDecor);
 * `polling()` says whether a poll may go now - first asks always go.
 * @param {{ api: any, now?: () => number, polling?: () => boolean }} deps
 */
export function createYardCellSync({ api, now = () => Date.now(), polling = () => true }) {
  /** @type {Map<number, HeldTown>} */
  const towns = new Map();
  /** @type {Map<string, OwnWrite>} by `mapId:buildingKey` */
  const writes = new Map();
  let turn = 0;

  function townOf(/** @type {number} */ mapId) {
    let town = towns.get(mapId);
    if (!town) {
      town = { cells: new Map(), polledAt: -Infinity, asking: false, failedAt: -Infinity, failures: 0, more: [] };
      towns.set(mapId, town);
    }
    return town;
  }

  /** A cell's answer as the page holds it: each home's pieces the yard's law allows (YARD-SWEEP: never a tower's piece
   *  from before YARD-HEIGHT). The owner's own writes are laid over it when it is read (piecesOf), not written into it. */
  function heldOf(/** @type {any} */ answer, /** @type {number} */ askedTurn) {
    /** @type {Map<number, any[]>} */
    const byKey = new Map();
    for (const yard of answer.yards ?? []) {
      if (!Number.isSafeInteger(yard?.buildingKey) || !Array.isArray(yard.pieces)) continue;
      byKey.set(yard.buildingKey, yard.pieces.map(decorYardPieceOf).filter((piece) => piece && decorYardHighOk(piece)));
    }
    return { ver: Number(answer.ver) || 0, byKey, askedTurn };
  }
  /** Whether the owner's write stands over the cell's answer: written after that answer was asked, or within
   *  YARD_WRITE_HOLD_MS of now (the service keeps a cell 30 s and reads it off a replica). */
  const writeStands = (/** @type {OwnWrite} */ write, /** @type {HeldCell | undefined} */ held) => !held || write.turn > held.askedTurn || now() - write.at < YARD_WRITE_HOLD_MS;

  /** One request for a town: `cells` [cell, version held] nearest first; `poll` when it is the cells in reach, whose
   *  answer starts the next poll's wait. */
  async function ask(/** @type {number} */ mapId, /** @type {HeldTown} */ town, /** @type {Array<[number, number]>} */ cells, poll = false) {
    town.asking = true;
    const askedTurn = turn;
    try {
      const answer = await api?.yardCells?.(mapId, cells);
      const data = answer?.ok ? answer.data : null;
      if (!data || !Array.isArray(data.cells)) {
        town.failedAt = now();
        town.failures++;
        return;
      }
      for (const cellAnswer of data.cells) {
        if (!Number.isSafeInteger(cellAnswer?.cell)) continue;
        const held = town.cells.get(cellAnswer.cell);
        if (held && Number(cellAnswer.ver) < held.ver) continue;   // a version older than the one held never takes a cell back
        town.cells.set(cellAnswer.cell, heldOf(cellAnswer, askedTurn));
      }
      const answered = new Set(data.cells.map((cellAnswer) => cellAnswer?.cell));
      for (const [cell] of cells) {
        if (answered.has(cell) || (data.more ?? []).includes(cell)) continue;
        const held = town.cells.get(cell);
        // answered as no change: what the page holds is the service's word as of this ask; a cell asked for the first
        // time stood no yard piece - held, empty, at version 0
        if (held) held.askedTurn = Math.max(held.askedTurn, askedTurn);
        else town.cells.set(cell, { ver: 0, byKey: new Map(), askedTurn });
      }
      town.more = Array.isArray(data.more) ? data.more.filter(Number.isSafeInteger) : [];
      town.failures = 0;
      if (poll || town.polledAt === -Infinity) town.polledAt = now();
    } catch {
      town.failedAt = now();
      town.failures++;
    } finally {
      town.asking = false;
    }
  }

  /**
   * THE CELLS BROUGHT IN LINE with the host's wishes: every cell within YARD_ASK_M + YARD_KEEP_MARGIN_M, nearest first
   * across towns. Asks what is new, polls what is due (and may poll now), and lets go of what is out of reach.
   * @param {CellWish[]} wishes
   */
  function update(wishes) {
    const pollingNow = polling();
    /** @type {Map<number, CellWish[]>} each town's wishes, in the order the towns are nearest */
    const byTown = new Map();
    for (const wish of [...wishes].sort((a, b) => a.distance - b.distance)) {
      if (!byTown.has(wish.mapId)) byTown.set(wish.mapId, []);
      byTown.get(wish.mapId)?.push(wish);
    }
    for (const [mapId, town] of towns) {
      const wanted = new Set((byTown.get(mapId) ?? []).map((wish) => wish.cell));
      for (const cell of town.cells.keys()) if (!wanted.has(cell)) town.cells.delete(cell);
      if (!wanted.size && !town.asking) towns.delete(mapId);
    }
    for (const [mapId, townWishes] of byTown) {
      const town = townOf(mapId);
      if (town.asking || now() - town.failedAt < yardRetryMs(town.failures)) continue;
      const inReach = townWishes.filter((wish) => wish.distance <= YARD_ASK_M);
      const fresh = inReach.filter((wish) => !town.cells.has(wish.cell));
      const due = pollingNow && now() - town.polledAt >= YARD_TOWN_TTL_MS;
      /** @type {Array<[number, number]>} */
      let cells = [];
      if (due) {
        cells = inReach.map((wish) => [wish.cell, town.cells.get(wish.cell)?.ver ?? 0]);
      } else if (fresh.length || town.more.length) {
        const asked = new Set([...fresh.map((wish) => wish.cell), ...town.more]);
        cells = inReach.filter((wish) => asked.has(wish.cell)).map((wish) => [wish.cell, town.cells.get(wish.cell)?.ver ?? 0]);
      }
      if (cells.length) ask(mapId, town, cells, due);
    }
  }

  return {
    update,
    /** A home's yard pieces as held now - the owner's own write where it stands, else the service's answer - or null
     *  while its cell is not answered. */
    piecesOf(/** @type {number} */ mapId, /** @type {number} */ buildingKey) {
      const held = towns.get(mapId)?.cells.get(yardCellOf(buildingKey));
      const write = writes.get(`${mapId}:${buildingKey}`);
      if (write && writeStands(write, held)) return write.list;
      return held ? held.byKey.get(buildingKey) ?? null : null;
    },
    /** The owner's own write to a yard: it stands at once, and over the answers that follow it (writeStands). A write no
     *  answer is behind any more is let go. */
    hold(/** @type {number} */ mapId, /** @type {number} */ buildingKey, /** @type {any[]} */ list) {
      writes.set(`${mapId}:${buildingKey}`, { turn: ++turn, at: now(), list });
      for (const [key, write] of writes) {
        const [writeMap, writeKey] = key.split(':').map(Number);
        const held = towns.get(writeMap)?.cells.get(yardCellOf(writeKey));
        if (held && !writeStands(write, held)) writes.delete(key);
      }
    },
    /** Whether any town's request is out (the tests' window). */
    asking: () => [...towns.values()].some((town) => town.asking),
  };
}

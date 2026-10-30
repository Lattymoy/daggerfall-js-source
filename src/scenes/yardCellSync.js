// @ts-check
// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md sections 10, 11): THE YARDS A PAGE HOLDS, BY BLOCK.
// The yards' host (scenes/homeYards.js) names each sync the cells it wants (net/yardCellLaw.js) and how far each is;
// this module asks the account service (server-account/src/yardCells.js) and holds the answers. Only a cell within
// YARD_ASK_M that holds a listed home is asked, nearest first. The cells in reach are polled with the versions held each
// YARD_TOWN_TTL_MS, or each YARD_SLOW_POLL_MS (doubling to YARD_SLOW_POLL_MAX_MS) while the hub's push is healthy, and at
// once when the hub link is welcomed again; never while `polling()` says no. A pushed cell waits up to YARD_PUSH_WAIT_MS
// (random). The owner's own writes stand over any answer for YARD_WRITE_HOLD_MS and one asked before them, to their version.

import { decorYardPieceOf, decorYardHighOk } from '../net/decorLaw.js';
import { yardCellOf } from '../net/yardCellLaw.js';
import { YARD_DRAW_M } from '../net/yardRange.js';

/** A cell's yards, believed this long before the cells in reach are asked again - while the push is not healthy. */
export const YARD_TOWN_TTL_MS = 60_000;
/** YC2: the poll's wait while the push is healthy, and the longest a quiet reach doubles it to. */
export const YARD_SLOW_POLL_MS = 300_000;
export const YARD_SLOW_POLL_MAX_MS = 1_200_000;
/** YC2: the longest random wait before a pushed cell is asked. */
export const YARD_PUSH_WAIT_MS = 2_000;
/** YC2: a pushed cell answered at an older version (another isolate's kept answer, up to 30 s) is asked again after
 *  this, up to YARD_PUSH_TRIES times in all; the poll finds what that misses. */
export const YARD_PUSH_RETRY_MS = 15_000;
export const YARD_PUSH_TRIES = 3;
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

/** @typedef {{ mapId: number, cell: number, distance: number }} CellWish  a cell the host wants, `distance` in metres */
/** @typedef {{ ver: number, byKey: Map<number, any[]>, askedTurn: number, ownVer?: number }} HeldCell  `ver` 0 before an answer; `byKey` by building key; `askedTurn` the write turn its answer was asked at; `ownVer` the highest version the owner's own writes answered */
/** @typedef {{ v: number, at: number, tries: number }} PushedCell  a hub word not yet asked: its version, when to ask (ms), the asks made */
/** @typedef {{ cells: Map<number, HeldCell>, polledAt: number, asking: boolean, failedAt: number, failures: number, more: number[], interval: number, epoch: number, pushed: Map<number, PushedCell> }} HeldTown  `failures` in a row; `more` the cells left for the next request; `interval` the slow poll's wait (ms); `epoch` the hub link's welcome count at the last poll */
/** @typedef {{ turn: number, at: number, list: any[] }} OwnWrite  the owner's own write to one yard (FB1001 YARD-STALE): its turn, when (ms), the yard it left */

/** The page's yard cells: `api.yardCells` asks the service, `polling()` whether a poll may go, `push()` (yardPushState) the link.
 *  @param {{ api: any, now?: () => number, polling?: () => boolean, push?: () => { healthy: boolean, epoch: number }, rand?: () => number }} deps */
export function createYardCellSync({
  api,
  now = () => Date.now(),
  polling = () => true,
  push = () => ({ healthy: false, epoch: 0 }),
  rand = Math.random,
}) {
  /** @type {Map<number, HeldTown>} */
  const towns = new Map();
  /** @type {Map<string, OwnWrite>} by `mapId:buildingKey` */
  const writes = new Map();
  let turn = 0;

  function townOf(/** @type {number} */ mapId) {
    let town = towns.get(mapId);
    if (!town) {
      town = {
        cells: new Map(),
        polledAt: -Infinity,
        asking: false,
        failedAt: -Infinity,
        failures: 0,
        more: [],
        interval: YARD_SLOW_POLL_MS,
        epoch: -1,
        pushed: new Map(),
      };
      towns.set(mapId, town);
    }
    return town;
  }

  /** A cell's answer as the page holds it: each home's pieces the yard's law allows (YARD-SWEEP: never a tower's piece
   *  from before YARD-HEIGHT). The owner's own writes are laid over it when it is read (piecesOf), not written into it. */
  function heldOf(/** @type {any} */ answer, /** @type {number} */ askedTurn, /** @type {HeldCell | undefined} */ was) {
    /** @type {Map<number, any[]>} */
    const byKey = new Map();
    for (const yard of answer.yards ?? []) {
      if (!Number.isSafeInteger(yard?.buildingKey) || !Array.isArray(yard.pieces)) continue;
      byKey.set(
        yard.buildingKey,
        yard.pieces.map(decorYardPieceOf).filter((piece) => piece && decorYardHighOk(piece)),
      );
    }
    return { ver: Number(answer.ver) || 0, byKey, askedTurn, ...(was?.ownVer ? { ownVer: was.ownVer } : {}) };
  }
  /** Whether the owner's write stands over the cell's answer: written after that answer was asked, or within
   *  YARD_WRITE_HOLD_MS of now (the service keeps a cell 30 s and reads it off a replica). */
  const writeStands = (/** @type {OwnWrite} */ write, /** @type {HeldCell | undefined} */ held) =>
    !held || write.turn > held.askedTurn || now() - write.at < YARD_WRITE_HOLD_MS;

  /** YC2: what is left of a pushed cell's word once its ask is answered - gone if the cell now holds its version, else
   *  asked again later, YARD_PUSH_TRIES asks in all. */
  function settlePushed(/** @type {HeldTown} */ town, /** @type {number} */ cell) {
    const word = town.pushed.get(cell);
    if (!word) return;
    const held = town.cells.get(cell);
    if ((held?.ver ?? 0) >= word.v || word.tries >= YARD_PUSH_TRIES) town.pushed.delete(cell);
    else word.at = now() + YARD_PUSH_RETRY_MS;
  }

  /** One request for a town: `cells` [cell, version held] nearest first; `poll` when it is the cells in reach, whose
   *  answer starts the next poll's wait. */
  async function ask(
    /** @type {number} */ mapId,
    /** @type {HeldTown} */ town,
    /** @type {Array<[number, number]>} */ cells,
    poll = false,
  ) {
    town.asking = true;
    const askedTurn = turn;
    const askedEpoch = push().epoch;
    for (const [cell] of cells) {
      const word = town.pushed.get(cell);
      if (word) word.tries++;
    }
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
        if (held && Number(cellAnswer.ver) < held.ver) continue; // a version older than the one held never takes a cell back
        town.cells.set(cellAnswer.cell, heldOf(cellAnswer, askedTurn, held));
      }
      const answered = new Set(data.cells.map((cellAnswer) => cellAnswer?.cell));
      for (const [cell] of cells) {
        if (!answered.has(cell) && !(data.more ?? []).includes(cell)) {
          const held = town.cells.get(cell);
          // answered as no change: what the page holds is the service's word as of this ask; a cell asked for the first
          // time stood no yard piece - held, empty, at version 0
          if (held) held.askedTurn = Math.max(held.askedTurn, askedTurn);
          else town.cells.set(cell, { ver: 0, byKey: new Map(), askedTurn });
        }
        settlePushed(town, cell);
      }
      town.more = Array.isArray(data.more) ? data.more.filter(Number.isSafeInteger) : [];
      town.failures = 0;
      // YC2: a quiet reach doubles the healthy poll's wait; anything moved sets it back
      if (poll)
        town.interval = data.cells.length ? YARD_SLOW_POLL_MS : Math.min(YARD_SLOW_POLL_MAX_MS, town.interval * 2);
      if (poll || town.polledAt === -Infinity) {
        town.polledAt = now();
        town.epoch = askedEpoch;
      }
    } catch {
      town.failedAt = now();
      town.failures++;
    } finally {
      town.asking = false;
    }
  }

  /**
   * THE CELLS BROUGHT IN LINE with the host's wishes: every cell within YARD_ASK_M + YARD_KEEP_MARGIN_M, nearest first
   * across towns. Asks what is new and what was pushed, polls what is due (and may poll now), and lets go of what is out
   * of reach.
   * @param {CellWish[]} wishes
   */
  function update(wishes) {
    const pollingNow = polling();
    const link = push();
    /** @type {Map<number, CellWish[]>} each town's wishes, in the order the towns are nearest */
    const byTown = new Map();
    for (const wish of [...wishes].sort((a, b) => a.distance - b.distance)) {
      if (!byTown.has(wish.mapId)) byTown.set(wish.mapId, []);
      byTown.get(wish.mapId)?.push(wish);
    }
    for (const [mapId, town] of towns) {
      const wanted = new Set((byTown.get(mapId) ?? []).map((wish) => wish.cell));
      for (const cell of town.cells.keys()) {
        if (wanted.has(cell)) continue;
        town.cells.delete(cell);
        town.pushed.delete(cell);
      }
      if (!wanted.size && !town.asking) towns.delete(mapId);
    }
    for (const [mapId, townWishes] of byTown) {
      const town = townOf(mapId);
      if (town.asking || now() - town.failedAt < yardRetryMs(town.failures)) continue;
      const inReach = townWishes.filter((wish) => wish.distance <= YARD_ASK_M);
      const fresh = inReach.filter((wish) => !town.cells.has(wish.cell));
      if (fresh.length) town.interval = YARD_SLOW_POLL_MS;
      const asked = town.polledAt !== -Infinity;
      const slow = link.healthy && town.epoch === link.epoch;
      const broke = link.healthy && town.epoch !== link.epoch; // welcomed again since its last poll: the gap's words are lost
      const due =
        pollingNow && (now() - town.polledAt >= (slow ? town.interval : YARD_TOWN_TTL_MS) || (asked && broke));
      const pushedDue = pollingNow
        ? inReach.filter((wish) => (town.pushed.get(wish.cell)?.at ?? Infinity) <= now())
        : [];
      /** @type {Array<[number, number]>} */
      let cells = [];
      if (due) {
        cells = inReach.map((wish) => [wish.cell, town.cells.get(wish.cell)?.ver ?? 0]);
      } else if (fresh.length || town.more.length || pushedDue.length) {
        const wanted = new Set([
          ...fresh.map((wish) => wish.cell),
          ...town.more,
          ...pushedDue.map((wish) => wish.cell),
        ]);
        cells = inReach
          .filter((wish) => wanted.has(wish.cell))
          .map((wish) => [wish.cell, town.cells.get(wish.cell)?.ver ?? 0]);
      }
      if (cells.length) ask(mapId, town, cells, due);
    }
  }

  return {
    update,
    /** YC2: the hub's words `[mapId, cell, version]`. A word for a cell this page holds, past the version it holds and
     *  past the owner's own write's, is asked after a random wait; any other is dropped, and the same word twice is one
     *  ask at most. */
    hear(/** @type {number[][]} */ words) {
      for (const [mapId, cell, v] of words) {
        const town = towns.get(mapId);
        const held = town?.cells.get(cell);
        if (!town || !held) continue;
        if (v <= Math.max(held.ver, held.ownVer ?? 0)) continue;
        if ((town.pushed.get(cell)?.v ?? 0) >= v) continue;
        town.pushed.set(cell, { v, at: now() + rand() * YARD_PUSH_WAIT_MS, tries: 0 });
        town.interval = YARD_SLOW_POLL_MS;
      }
    },
    /** YC2: the version the owner's own write to a yard answered - its own word, when it comes, is dropped. */
    wrote(/** @type {number} */ mapId, /** @type {number} */ buildingKey, /** @type {number} */ ver) {
      const held = towns.get(mapId)?.cells.get(yardCellOf(buildingKey));
      if (held && Number.isSafeInteger(ver)) held.ownVer = Math.max(held.ownVer ?? 0, ver);
    },
    /** A home's yard pieces as held now - the owner's own write where it stands, else the service's answer - or null
     *  while its cell is not answered. */
    piecesOf(/** @type {number} */ mapId, /** @type {number} */ buildingKey) {
      const held = towns.get(mapId)?.cells.get(yardCellOf(buildingKey));
      const write = writes.get(`${mapId}:${buildingKey}`);
      if (write && writeStands(write, held)) return write.list;
      return held ? (held.byKey.get(buildingKey) ?? null) : null;
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

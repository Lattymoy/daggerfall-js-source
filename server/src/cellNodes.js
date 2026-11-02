// @ts-check
// THE CELL DIRECTORY AND THE WORKER'S DOOR TO A CELL (bible/11-Multiplayer/Scale-Arc.md, COST-2).
//
// A page asks for its 16-pixel cell (`/room/world:<cx>,<cy>`). The Worker asks the directory for the cell tree
// (net/cellTree.js) - the directory is one object, named CELL_DIRECTORY, a name no page can ask for because wire.js
// roomOf takes no `#` - and keeps the tree for CELL_TREE_KEEP_MS in its isolate. It then hands the page's request,
// unchanged, to the NODE that holds the cell: the object is named after the node (its layers after it, walked as any
// crowded place's are), the socket's key is still the fine cell, and the object is told its node (NODE_HEADER). A halo
// whose node is a room the page already holds (`?of=`, wire.js HALO_OF_PARAM) is answered with a socket closed
// CLOSE_SAME_ROOM, because that object already hears the page.
//
// The Worker falls back to the last tree its isolate saw, and to the fine key only when it never saw one. Once the tree
// is seeded coarse the fine key is no longer a safe default - it would stand a player alone in a fine object no one else
// in its node is in - so a tree once seen outlives a directory that stops answering. A failed ask is not repeated for
// CELL_TREE_RETRY_MS, so a directory that is down costs each isolate one deadline, not each page.
//
// This lives outside index.js because every named export of the entrypoint is read as an entrypoint (relayScale.js).
import { readTree, L0_TREE, seedTree, cellSeedOf, isL0Tree, leafOf, isNodeRoom, isCoarseNode, nodeLevelOf, nodeAt, coversCell, cellsOfNode } from '../../src/net/cellTree.js';
import { relayCfgValue } from '../../src/net/relayCfg.js';
import { isCellRoom, cellOfRoom, layerOf, layerName, LAYER_HEADER, CLOSE_SAME_ROOM, HALO_OF_PARAM, HALO_OF_MAX } from './relay.js';
import { layerWalk, ROOM_CALL_MS } from './relayScale.js';

/**
 * The fields the cell modules keep on a Room (index.js). A Room is the runtime's object, so they are set where they are
 * first known rather than in its constructor; this is their one declaration.
 * @typedef {object} CellRoomFields
 * @property {string | null | undefined} _node - the node this object is (cellTree.js key), told at an upgrade or read
 *   back off a socket
 * @property {boolean | undefined} _nodeRead - whether a woken instance has looked for its node on its sockets yet
 * @property {boolean | undefined} _cellTell - whether this object tells the directory its count (the tree moves)
 * @property {number | undefined} _cellLy - the layer of the node this object is
 * @property {import('../../src/net/cellTree.js').CellTree | null | undefined} _cellTree - the directory's tree, read
 *   once an instance
 */

/** The directory's object - a name wire.js roomOf can never give, so no page reaches it. */
export const CELL_DIRECTORY = '#cells';
/** The directory's door: the tree, as JSON. */
export const CELL_INTERNAL_TREE = '/internal/cells/tree';
/** Where the directory keeps its tree - seeded the first time `cellSeed` is on, moved by cellMoves.js since. */
export const CELL_TREE_KEY = 'celltree';
/** How long an isolate keeps the tree it was told, and how long it waits to ask again after an ask that failed. */
export const CELL_TREE_KEEP_MS = 30_000;
export const CELL_TREE_RETRY_MS = 5_000;
/** The header the Worker tells an object its node by - never the page's word (it is set whatever the page sent). */
export const NODE_HEADER = 'x-df-node';
/** The Worker's word that the tree moves (it is not L0_TREE), so the object tells the directory its count
 *  (cellMoves.js) - never the page's word. */
export const CELL_TELL_HEADER = 'x-df-cells-tell';
/** A node a move closed answers a socket or a call naming a cell 503 with this header: the tree its caller holds is
 *  older than the move (cellMoves.js). */
export const MOVED_HEADER = 'x-df-moved';

const json = (/** @type {any} */ body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The isolate's copy of the tree, `{ tree, at }` once one was read; and when the last ask failed. */
let isolateCopy = /** @type {{ tree: any, at: number } | null} */ (null);
let failedAt = -Infinity;
/** The isolate's copy, for the pins and for a node that answers "moved". `stale` marks the copy older than the
 *  directory's tree: it is asked again at once, but KEPT as the fallback, so a directory that is down still leaves the
 *  last tree seen and never the fine key. */
export const cellTreeCache = {
  get: () => isolateCopy,
  reset: () => {
    isolateCopy = null;
    failedAt = -Infinity;
  },
  stale: () => {
    if (isolateCopy) isolateCopy.at = -Infinity;
    failedAt = -Infinity;
  },
};

/**
 * THE TREE, as this isolate knows it: its copy while fresh; else the directory's answer within ROOM_CALL_MS; else, after
 * a failed ask, the last tree it saw (null - the fine key - if it never saw one), asked again CELL_TREE_RETRY_MS on.
 * @param {any} env @param {number} [now]
 */
export async function cellTreeOf(env, now = Date.now()) {
  if (isolateCopy && now - isolateCopy.at < CELL_TREE_KEEP_MS) return isolateCopy.tree;
  if (now - failedAt < CELL_TREE_RETRY_MS) return isolateCopy?.tree ?? null;
  try {
    const directory = env.ROOMS.get(env.ROOMS.idFromName(CELL_DIRECTORY));
    const response = await directory.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TREE}`, { signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    const tree = response.ok ? readTree(await response.json()) : null;
    if (tree) {
      isolateCopy = { tree, at: now };
      return tree;
    }
  } catch {
    // an ask that throws is a failed ask, like an answer that cannot be read: the last tree seen, below
  }
  failedAt = now;
  return isolateCopy?.tree ?? null;
}

/** The node a fine cell's key is in under `tree` - the key itself with no tree. @param {any} tree @param {string} key */
export const cellNodeOf = (tree, key) => (tree && leafOf(tree, key)) || key;

/** A socket the Worker opens and closes at once, CLOSE_SAME_ROOM: a browser sees no HTTP status on a refused upgrade,
 *  so the close code is how the page learns its halo is its own room. */
export function sameRoomAnswer() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.close(CLOSE_SAME_ROOM, 'same room');
  return new Response(null, { status: 101, webSocket: client });
}

/** Is `response` a node's "moved" (MOVED_HEADER) - the tree that named it older than its move? @param {Response} response */
const movedAnswer = (response) => response.status === 503 && response.headers.get(MOVED_HEADER) === '1';

/**
 * THE WORKER'S DOOR TO A CELL (`key` a fine cell's): its node found, a halo of a room the page holds answered
 * CLOSE_SAME_ROOM, and the request walked through the node's layers with the node named and told whether the tree moves
 * (CELL_TELL_HEADER). A node that answers "moved" sends the Worker to the directory again, and the request is walked
 * once more under the tree it answers.
 * @param {any} env @param {string} key @param {URL} url @param {Request} request
 */
export async function cellDoor(env, key, url, request) {
  for (let attempt = 0; ; attempt++) {
    const tree = await cellTreeOf(env);
    const node = cellNodeOf(tree, key);
    // the rooms the page holds already (`?of=`, its own first): a halo whose node one of them is in is that room's object
    const held = String(url.searchParams.get(HALO_OF_PARAM) ?? '').split(';').slice(0, HALO_OF_MAX).filter((room) => room !== key && isCellRoom(room));
    if (held.some((room) => cellNodeOf(tree, room) === node)) return sameRoomAnswer();
    // A Headers lower-cases its names, as these are, so the Worker's word overwrites whatever the page sent under them.
    const headers = { ...Object.fromEntries(request.headers), [NODE_HEADER]: node, [CELL_TELL_HEADER]: tree && !isL0Tree(tree) ? '1' : '' };
    const response = await layerWalk(env.ROOMS, node, new Request(request, { headers }), layerOf(url.searchParams.get('ly')));
    if (attempt || !movedAnswer(response)) return response;
    cellTreeCache.stale();
  }
}

/**
 * A CALL BETWEEN ROOMS THAT NAMES A CELL (the park registry's drop, a staff event's call): posted to layer `layer` of the
 * node that holds fine cell `cell` now, under this isolate's tree as the Worker's door walks it, and once more under the
 * directory's answer when that node says "moved". Null with no ROOMS binding.
 * @param {any} env @param {string} cell @param {number} layer @param {string} path @param {unknown} body
 * @param {number} [deadlineMs]
 */
export async function cellCall(env, cell, layer, path, body, deadlineMs = ROOM_CALL_MS) {
  const rooms = env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return null;
  for (let attempt = 0; ; attempt++) {
    const tree = await cellTreeOf(env);
    // a node answers "moved" only to a caller in a moving tree
    const headers = { [CELL_TELL_HEADER]: tree && !isL0Tree(tree) ? '1' : '' };
    const response = await rooms.get(rooms.idFromName(layerName(cellNodeOf(tree, cell), layer))).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), headers, signal: AbortSignal.timeout(deadlineMs) }));
    if (attempt || !movedAnswer(response)) return response;
    cellTreeCache.stale();
  }
}

/**
 * THE DIRECTORY'S TREE: L0_TREE while the `cellSeed` setting is off (net/relayCfg.js - off unset, and off is the way
 * back); else the tree it stores, seeded at that level the first time it holds none it can read (net/cellTree.js
 * seedTree) and moved by cellMoves.js since. A stored tree outlives a setting turned off and on again. The hub's
 * settings are asked as a ground room's door asks them (index.js _groundRefusal): awaited before this instance's first
 * answer, beside it after. @param {any} room the directory's Room (index.js) @param {number} [now]
 */
export async function directoryTree(room, now = Date.now()) {
  if (room._relayCfgAt === -Infinity) await room._relayCfgFresh(now);
  else void room._relayCfgFresh(now);
  const seed = cellSeedOf(relayCfgValue(await room._relayCfgOf(), room.env, 'cellSeed')) ?? 0;
  if (!seed) return L0_TREE;
  if (room._cellTree === undefined) room._cellTree = readTree(await room.state.storage.get(CELL_TREE_KEY));
  if (!room._cellTree) {
    room._cellTree = seedTree(seed);
    await room.state.storage.put(CELL_TREE_KEY, room._cellTree);
  }
  return room._cellTree;
}
/** THE DIRECTORY'S DOOR: its tree, as JSON. @param {any} room the directory's Room (index.js) */
export async function cellTreeInternal(room) {
  return json(await directoryTree(room));
}

/** An object told its node (NODE_HEADER) for a socket of fine cell `key` keeps it only when it names a node that holds
 *  that cell, so a header that does not fit is never believed. Answers the node when it is COARSE - the socket's
 *  attachment keeps it (`nd`), so a woken object still knows what each socket covers - else null.
 *  @param {any} room @param {Request} request @param {string} key */
export function nodeHeard(room, request, key) {
  const node = request.headers.get(NODE_HEADER);
  const cell = cellOfRoom(key);
  if (!cell || !node || !isNodeRoom(node)) return null;
  const level = /** @type {number} */ (nodeLevelOf(node));
  if (nodeAt(level, cell[0], cell[1]) !== node) return null;
  room._node = node;
  room._cellTell = request.headers.get(CELL_TELL_HEADER) === '1';   // the tree moves: this object tells its count (cellMoves.js)
  room._cellLy = layerOf(request.headers.get(LAYER_HEADER));
  return level > 0 ? node : null;
}

/** THE NODE THIS OBJECT IS: the one the Worker told it at an upgrade, or - for an instance woken by a frame, since the
 *  runtime tells a hibernated object nothing at its wake - the coarse node a socket's attachment keeps (`nd`), read
 *  once an instance. A coarse node stands only in a tree that moves, so one read back tells its count again
 *  (cellMoves.js cellTell). Null for none. @param {any} room */
export function nodeOfRoom(room) {
  if (room._node == null && !room._nodeRead) {
    room._nodeRead = true;
    for (const [, attachment] of room._all?.() ?? [])
      if (isCoarseNode(attachment?.nd)) {
        room._node = attachment.nd;
        room._cellTell = true;
        room._cellLy = attachment.ly | 0;
        break;
      }
  }
  return room._node ?? null;
}
/** The node level a room's metrics point carries (relayScale.js RoomMetrics blob11): its node's, or '' for a room that
 *  was never told one this instance life (no cell; or a fine cell woken by a frame or its alarm alone - a coarse node
 *  reads its own back, nodeOfRoom). @param {any} room */
export const cellLevelOf = (room) => {
  const node = nodeOfRoom(room);
  return node ? String(nodeLevelOf(node)) : '';
};

/** A SOCKET'S COVER - its coarse node (`nd`, kept on its attachment) or its own room's key. Every cell-scoped law reads
 *  it (net/cellTree.js coversCell): a word by its pixel's cell, a grant by its `q`, a park by its anchor and a ledger
 *  row by its pixel stand in the room when the cover covers them. At L0 the cover is the room itself.
 *  @param {any} attachment a socket's attachment */
export const coverOf = (attachment) => attachment?.nd ?? attachment?.key;
/** Does a socket's cover cover cell `cell`? @param {any} attachment @param {unknown} cell */
export const inCover = (attachment, cell) => coversCell(coverOf(attachment), cell);
/** THE COVER GUARD, one home for every word that names its cell (the relay's arms in index.js, staffEvents.js): a
 *  frame naming a cell outside the socket's cover is junk, as a frame naming another room was before the tree.
 *  Returns true when the frame was junked, so the caller returns.
 *  @param {{ _junk: (ws: any) => void }} room @param {any} ws @param {any} attachment the socket's @param {unknown} cell
 *  @returns {boolean} */
export function junkOutsideCover(room, ws, attachment, cell) {
  if (inCover(attachment, cell)) return false;
  room._junk(ws);
  return true;
}
/** A park word's law of its room (index.js, the `park` arm): `cover` is a cell socket's cover, or null for a place that
 *  is no cell. A cell holds a team whose anchor's cell it covers; a place holds one that names no cell.
 *  @param {unknown} cover @param {unknown} cell */
export const atCover = (cover, cell) => (cover == null ? cell == null : coversCell(cover, cell));
/** A cell's welcome's `cells` field - the fine cells the socket covers, `[x0, y0, x1, y1]` - for a cell's socket, and ''
 *  for any other room. @param {any} attachment */
export const cellsWelcome = (attachment) => (isCellRoom(attachment?.key) ? `,"cells":${JSON.stringify(cellsOfNode(coverOf(attachment)))}` : '');

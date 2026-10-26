// @ts-check
// THE CELL TREE MOVES (bible/11-Multiplayer/Scale-Arc.md, COST-2 part two). The directory (cellNodes.js CELL_DIRECTORY)
// seeds its tree at the `cellSeed` setting's level (cellNodes.js directoryTree) and moves it one node at a time, by the
// counts its nodes tell it:
//   COUNTS   - an object the Worker says stands in a moving tree (CELL_TELL_HEADER) tells the directory its named
//              sockets, by node and layer, at most every COUNT_TELL_MS, from its metrics tick. There is no timer: a page
//              poses at least every HEARTBEAT_MS, so a node with players is heard, and a node unheard for COUNT_STALE_MS
//              counts none, so a node its players left merges.
//   THE LAW  - net/cellTree.js cellMoveDue, its thresholds the relay's vars (cellLawOf): a split past CELL_SPLIT_AT for
//              CELL_SPLIT_DWELL_MS, a merge under CELL_MERGE_AT for CELL_MERGE_DWELL_MS. The gap between the two lines is
//              what keeps a split's children from merging back, since together they hold its crowd. A node whose move
//              its rows blocked, or a layer of which never answered, is left alone for MOVE_COOLDOWN_MS.
//   THE MOVE - planned at a count and made by the directory's alarm, never inside a node's own call to the directory.
//              The plan is stored before each stage, so a directory that stops resumes where it stopped:
//              1 MOVE   - each departing node, every layer, sends its rows to the receivers and keeps them
//                         (cellHandover.js handOver `keep`); a key that blocks, or a receiver that never takes, drops the
//                         plan with nothing committed;
//              2 COMMIT - the tree written;
//              3 CLOSE  - each departing layer marks itself moved, closes every socket CLOSE_REPARTITION, and sends its
//                         rows again, letting them go. Its pages join again under the new tree; an isolate whose tree is
//                         older is answered "moved" (MOVED_HEADER) for MOVED_KEEP_MS and asks the directory again.
//   THE SEED - has no handover: a coarse node PULLS a fine cell's rows from that cell's own object the first time a
//              socket of that cell reaches it (give, then forget), and remembers the cells it pulled (CELL_PULLED_KEY).
//
// This lives outside index.js because every named export of the entrypoint is read as an entrypoint (relayScale.js).
import { isL0Tree, cellMoveDue, treeAfter, isNodeRoom, isCoarseNode, nodeHoldsCell } from '../../src/net/cellTree.js';
import { CELL_HELLO_LAW, CLOSE_REPARTITION, LAYERS_MAX, LAYER_HEADER, PARK_INTERNAL_DROP, isCellRoom, layerName, layerOf, roomOf } from './relay.js';
import { ROOM_CALL_MS } from './relayScale.js';
import { CELL_DIRECTORY, CELL_INTERNAL_TREE, CELL_TREE_KEY, CELL_TREE_KEEP_MS, CELL_TREE_RETRY_MS, CELL_TELL_HEADER, MOVED_HEADER, NODE_HEADER, cellTreeInternal, directoryTree, nodeOfRoom } from './cellNodes.js';
import { CELL_INTERNAL_TAKE, CELL_MOVED_KEY, CELL_PULLED_KEY, cellTakeInternal, handOver, handoverPayloads, letGo, roomPost, rowsOf, takeHandover } from './cellHandover.js';
import { SEV_INTERNAL_CALL } from './staffEvents.js';

/**
 * The move the directory is making, as it stores it (CELL_PLAN_KEY).
 * @typedef {import('../../src/net/cellTree.js').TreeMove & { stage: 'move' | 'close', at: number }} CellPlan
 */
/**
 * A node's count as the directory heard it - one per node and layer (`<node>#<layer>`).
 * @typedef {object} CountReport
 * @property {string} node
 * @property {number} n - its named sockets
 * @property {number} at - when it was heard
 */
/**
 * What the directory keeps for its instance's life (`room._cellDir`). Lost with the instance: a dwell begins again,
 * which only delays a move.
 * @typedef {object} DirectoryState
 * @property {Map<string, CountReport>} reports
 * @property {import('../../src/net/cellTree.js').MoveDwell} dwell
 * @property {Record<string, number>} cool - a node, and the time before which no move touches it
 */
/**
 * The fields this file keeps on a Room (index.js), beside cellNodes.js CellRoomFields.
 * @typedef {object} CellMoveFields
 * @property {boolean | undefined} _isCellDir - whether this object is the directory, known once an instance
 * @property {number | undefined} _cellToldAt - when this object last told the directory its count
 * @property {number | null | undefined} _cellMoved - when a move closed this node (CELL_MOVED_KEY), read once an instance
 * @property {Set<string> | undefined} _cellPulled - the fine cells this coarse node pulled at the seed
 * @property {Map<string, number> | undefined} _cellPullAt - a fine cell, and the time before which its pull is not asked again
 * @property {DirectoryState | undefined} _cellDir - the directory's counts, dwell and cool
 * @property {CellPlan | null | undefined} _cellPlan - the move the directory is making
 */

/** Every door of the cell tree's own, between objects (the public Worker forwards `/room/<key>` alone). */
export const CELL_INTERNAL_PREFIX = '/internal/cells/';
export const CELL_INTERNAL_COUNT = '/internal/cells/count';
export const CELL_INTERNAL_MOVE = '/internal/cells/move';
export const CELL_INTERNAL_CLOSE = '/internal/cells/close';
export const CELL_INTERNAL_GIVE = '/internal/cells/give';
export const CELL_INTERNAL_FORGET = '/internal/cells/forget';
/** How often an object tells its count at most; how long a count stands; how long the directory remembers a node it
 *  has not heard (its parent's merge is found by it). */
export const COUNT_TELL_MS = 15_000;
export const COUNT_STALE_MS = 60_000;
export const COUNT_FORGET_MS = 30 * 60_000;
/** The most players a count may say. */
export const COUNT_MAX = 100_000;
/** How long a node whose move its rows blocked (or a layer of which never answered) is left alone. */
export const MOVE_COOLDOWN_MS = 10 * 60_000;
/** How long a node a move closed answers "moved": twice an isolate's keep of its tree, so no isolate holds one older. */
export const MOVED_KEEP_MS = 2 * CELL_TREE_KEEP_MS;
/** How soon a close a departing layer did not answer is asked again. */
export const CLOSE_RETRY_MS = 5_000;
/** Where the directory keeps the move it is making. */
export const CELL_PLAN_KEY = 'cellplan';
/** THE THRESHOLDS: a split past 150 named sockets for a minute - SOCKETS_MAX is 256, so a crowd splits before its node
 *  fills and layers - and a merge of four siblings under 40 together for ten minutes (a split's children sum to its
 *  150, far over). Each is a relay var. */
export const CELL_LAW_DEFAULT = Object.freeze({ splitAt: 150, splitDwellMs: 60_000, mergeAt: 40, mergeDwellMs: 600_000 });
export const CELL_LAW_VARS = Object.freeze({ splitAt: 'CELL_SPLIT_AT', splitDwellMs: 'CELL_SPLIT_DWELL_MS', mergeAt: 'CELL_MERGE_AT', mergeDwellMs: 'CELL_MERGE_DWELL_MS' });
/** The law the relay's vars say: each a whole number, else its default - and all four their defaults when the merge
 *  line is not under the split line (four siblings that sum to a split's crowd would merge back the minute it split).
 *  @param {any} env */
export function cellLawOf(env) {
  const law = /** @type {Record<string, number>} */ ({});
  for (const [field, varName] of Object.entries(CELL_LAW_VARS)) {
    const text = String(env?.[varName] ?? '');
    law[field] = /^\d{1,9}$/.test(text) ? Number(text) : CELL_LAW_DEFAULT[/** @type {keyof typeof CELL_LAW_DEFAULT} */ (field)];
  }
  return law.mergeAt < law.splitAt ? /** @type {typeof CELL_LAW_DEFAULT} */ (law) : CELL_LAW_DEFAULT;
}

const json = (/** @type {any} */ body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const post = (/** @type {string} */ path, /** @type {unknown} */ body) => new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) });
const bodyOf = async (/** @type {Request} */ request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};
/** A move's receivers or departers, as a door is told them: one to four node keys. @param {unknown} listed */
const nodesOf = (listed) => (Array.isArray(listed) && listed.length >= 1 && listed.length <= 4 && listed.every(isNodeRoom) ? /** @type {string[]} */ (listed) : null);

/** Is `room` the directory? Its id against the directory's name, once an instance - so no other room's alarm reads
 *  storage to find out. @param {any} room */
export function isCellDirectory(room) {
  if (room._isCellDir === undefined) {
    let isDirectory = false;
    try {
      const id = room.state?.id,
        directoryId = room.env?.ROOMS?.idFromName?.(CELL_DIRECTORY);
      isDirectory = id != null && directoryId != null && (typeof id.equals === 'function' ? id.equals(directoryId) : id === directoryId);
    } catch {
      isDirectory = false;
    }
    room._isCellDir = isDirectory;
  }
  return room._isCellDir;
}

// ── THE NODE'S SIDE ─────────────────────────────────────────────────────────────────────────────────────────────

/** THE COUNT, TOLD (from the metrics tick, never awaited): this object's named sockets, its node's and its layer's, to the
 *  directory at most every COUNT_TELL_MS - while the Worker says the tree moves (cellNodes.js nodeHeard).
 *  @param {any} room @param {number} now */
export function cellTell(room, now) {
  const node = nodeOfRoom(room);
  if (!room._cellTell || !node || now - (room._cellToldAt ?? -Infinity) < COUNT_TELL_MS) return;
  const rooms = room.env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return;
  room._cellToldAt = now;
  const body = { node, ly: room._cellLy | 0, n: room._namedCount() };
  // begun in a promise so that a binding that throws at once is caught with the rest, never in the frame's handler
  void Promise.resolve()
    .then(() => rooms.get(rooms.idFromName(CELL_DIRECTORY)).fetch(post(CELL_INTERNAL_COUNT, body)))
    .catch((/** @type {any} */ error) => console.warn('[cells] count', error?.message ?? error));
}

/** Has a move closed this node, within MOVED_KEEP_MS? An older mark is let go. @param {any} room @param {number} now */
async function movedNow(room, now) {
  if (room._cellMoved === undefined) room._cellMoved = (await room.state.storage.get(CELL_MOVED_KEY)) ?? null;
  if (room._cellMoved == null) return false;
  if (now - room._cellMoved < MOVED_KEEP_MS) return true;
  room._cellMoved = null;
  await room.state.storage.delete(CELL_MOVED_KEY);
  return false;
}

/**
 * THE SEED'S PULL: a socket of fine cell `key` reaching this coarse node (its place, layer 0) for the first time pulls
 * the rows that cell's own object kept before the seed - given, taken, the cell remembered as pulled, then forgotten
 * there. A cell that gave once gives nothing again (its rows are this node's, or a node's after it), so the pulled set
 * is never handed over. A failed pull is asked again CELL_TREE_RETRY_MS on, by the cell's next socket.
 * @param {any} room @param {Request} request @param {string} key @param {number} now
 */
async function cellPull(room, request, key, now) {
  const node = request.headers.get(NODE_HEADER);
  if (!isCoarseNode(node) || !nodeHoldsCell(node, key) || layerOf(request.headers.get(LAYER_HEADER)) !== 0) return;
  const storage = room.state.storage;
  room._cellPulled ??= new Set((await storage.get(CELL_PULLED_KEY)) ?? []);
  room._cellPullAt ??= new Map();
  if (room._cellPulled.has(key) || now < (room._cellPullAt.get(key) ?? -Infinity)) return;
  const rooms = room.env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return;
  room._cellPullAt.set(key, now + CELL_TREE_RETRY_MS);
  try {
    const cellObject = rooms.get(rooms.idFromName(key));
    const response = await cellObject.fetch(post(CELL_INTERNAL_GIVE, { to: [node] }));
    if (!response.ok) return;
    const payload = await response.json();
    const rowCount = (payload?.parks?.length ?? 0) + (payload?.sp?.length ?? 0) + (payload?.dg?.length ?? 0) + (payload?.gr?.length ?? 0) + Object.keys(payload?.copy ?? {}).length;
    if (rowCount && (await takeHandover(room, payload, now)) == null) return;
    room._cellPulled.add(key);
    await storage.put(CELL_PULLED_KEY, [...room._cellPulled]);
    if (rowCount) await cellObject.fetch(post(CELL_INTERNAL_FORGET, {}));
  } catch (error) {
    console.warn('[cells] pull', /** @type {any} */ (error)?.message ?? error);
  }
}

/** The cell door's refusal: a cell's hello in a COARSE node from a build below CELL_HELLO_LAW (wire.js). A build without
 *  `of` would open a halo into this very object and be replaced by it. A fine cell's object refuses nobody.
 *  @param {any} room @param {any} socket @param {any} hello the hello, parsed */
export const cellDoorShut = (room, socket, hello) => isCoarseNode(room._attach(socket)?.nd) && !(hello.cv >= CELL_HELLO_LAW);

/**
 * THE CELL TREE'S DOORS, AT THE TOP OF Room.fetch (null: none of theirs - the fetch goes on): every `/internal/cells/`
 * door, and - for a request the Worker sent under a moving tree - a moved node's answer to a socket or a call that names
 * a cell (the park registry's drop, a staff event's call), and the seed's pull before a socket is admitted.
 * @param {any} room @param {string} path @param {Request} request
 */
export async function cellDoors(room, path, request) {
  if (path.startsWith(CELL_INTERNAL_PREFIX)) return cellInternal(room, path, request);
  if (request.headers.get(CELL_TELL_HEADER) !== '1') return null;
  const key = path.startsWith('/room/') ? roomOf(path) : null;
  const isSocket = isCellRoom(key);
  if (!isSocket && path !== PARK_INTERNAL_DROP && path !== SEV_INTERNAL_CALL) return null;
  const now = Date.now();
  if (await movedNow(room, now)) {
    const answer = json({ error: 'moved' }, 503);
    answer.headers.set(MOVED_HEADER, '1');
    return answer;
  }
  if (isSocket) await cellPull(room, request, /** @type {string} */ (key), now);
  return null;
}

/** @param {any} room @param {string} path @param {Request} request */
async function cellInternal(room, path, request) {
  if (path === CELL_INTERNAL_TREE) return cellTreeInternal(room);
  if (path === CELL_INTERNAL_TAKE) return cellTakeInternal(room, request);
  const body = await bodyOf(request);
  if (path === CELL_INTERNAL_COUNT) return countInternal(room, body, Date.now());
  if (path === CELL_INTERNAL_FORGET) {
    await letGo(room, (await rowsOf(room.state.storage, Date.now())).parks);
    return json({ ok: true });
  }
  const to = nodesOf(body?.to);
  if (!to) return json({ ok: false, error: 'no receivers' }, 400);
  if (path === CELL_INTERNAL_GIVE) return json(handoverPayloads(await rowsOf(room.state.storage, Date.now()), to).get(to[0]));
  if (path === CELL_INTERNAL_MOVE) return json(await handOver(room, to, roomPost(room.env), Date.now(), { keep: true }));
  if (path === CELL_INTERNAL_CLOSE) return closeInternal(room, to, layerOf(body?.ly));
  return json({ error: 'no such door' }, 404);
}

/** STAGE 3 AT A DEPARTING LAYER: marked moved (its place always, and a layer that held anyone - an empty layer is walked
 *  past to its place), every socket closed CLOSE_REPARTITION and reaped as a refusal's is, then the rows sent again and
 *  let go (`force`: a key that blocks and came since stage 1 is left behind, named). @param {any} room
 *  @param {string[]} to @param {number} layer */
async function closeInternal(room, to, layer) {
  const now = Date.now();
  const sockets = room.state.getWebSockets();
  if (layer === 0 || sockets.length) {
    await room.state.storage.put(CELL_MOVED_KEY, now);
    room._cellMoved = now;
  }
  for (const socket of sockets) {
    try {
      socket.close(CLOSE_REPARTITION, 'cells moved');
    } catch {
      // already closed
    }
    room._dead.add(socket);   // the runtime calls no webSocketClose for a close the object made, so the room reaps it
    room._closed(socket);
  }
  await room._reap();
  const result = await handOver(room, to, roomPost(room.env), now, { force: true });
  if (result.orphaned) console.warn(`[cells] a move left behind ${result.orphaned.join(' ')}`);
  return json(result);
}

// ── THE DIRECTORY'S SIDE ────────────────────────────────────────────────────────────────────────────────────────

/** The directory's instance state, made at its first use. @param {any} room @returns {DirectoryState} */
const directoryOf = (room) => (room._cellDir ??= { reports: new Map(), dwell: { over: {}, under: {} }, cool: {} });
/** The move being made, read once an instance. @param {any} room @returns {Promise<CellPlan | null>} */
async function planOf(room) {
  if (room._cellPlan === undefined) room._cellPlan = (await room.state.storage.get(CELL_PLAN_KEY)) ?? null;
  return room._cellPlan;
}

/** A NODE'S COUNT, HEARD - and the law asked whether a move is due. @param {any} room @param {any} body @param {number} now */
async function countInternal(room, body, now) {
  if (!body || !isNodeRoom(body.node) || !Number.isInteger(body.ly) || body.ly < 0 || body.ly >= LAYERS_MAX || !Number.isInteger(body.n) || body.n < 0 || body.n > COUNT_MAX) return json({ ok: false }, 400);
  room._kind ??= 'cells';   // the directory's metrics point (relayScale.js RoomMetrics: blob12 and blob13, its moves)
  directoryOf(room).reports.set(`${body.node}#${body.ly}`, { node: body.node, n: body.n, at: now });
  await cellPlanDue(room, now);
  room._metricsTick();
  return json({ ok: true });
}

/** THE LAW, ASKED: under a tree that moves and with no move being made, the counts summed by node (a count older than
 *  COUNT_STALE_MS is none) and cellMoveDue asked; a move due is stored and the alarm set for it at once.
 *  @param {any} room @param {number} now */
async function cellPlanDue(room, now) {
  const tree = await directoryTree(room, now);
  if (isL0Tree(tree) || (await planOf(room))) return;
  const directory = directoryOf(room);
  const counts = new Map();
  for (const [reportKey, report] of directory.reports) {
    if (now - report.at > COUNT_FORGET_MS) {
      directory.reports.delete(reportKey);
      continue;
    }
    counts.set(report.node, (counts.get(report.node) ?? 0) + (now - report.at <= COUNT_STALE_MS ? report.n : 0));
  }
  const { move, dwell } = cellMoveDue(tree, counts, directory.dwell, directory.cool, now, cellLawOf(room.env));
  directory.dwell = dwell;
  if (!move) return;
  room._cellPlan = { ...move, stage: 'move', at: now };
  await room.state.storage.put(CELL_PLAN_KEY, room._cellPlan);
  await room.state.storage.setAlarm(now);
  console.log(`[cells] ${move.kind} planned: ${move.from.join(' ')} -> ${move.to.join(' ')}`);
}

/** Each departing node's every layer asked at `path` in turn - one at a time, since a layer's take merges into its
 *  receiver's ledger. At stage 1 the first that blocks or fails ends the asking. @param {any} room @param {any} plan
 *  @param {string} path */
async function askDeparting(room, plan, path) {
  const rooms = room.env?.ROOMS;
  const blocked = [],
    failed = [];
  for (const node of plan.from) {
    for (let layer = 0; layer < LAYERS_MAX; layer++) {
      const name = layerName(node, layer);
      let answer = null;
      try {
        const response = await rooms.get(rooms.idFromName(name)).fetch(post(path, { to: plan.to, ly: layer }));
        answer = response.ok ? await response.json() : null;
      } catch {
        answer = null;
      }
      if (answer?.blocked?.length) blocked.push(`${name} (${answer.blocked.join(', ')})`);
      else if (!answer?.ok) failed.push(name);
      if (path === CELL_INTERNAL_MOVE && (blocked.length || failed.length)) return { blocked, failed };
    }
  }
  return { blocked, failed };
}

/**
 * THE DIRECTORY'S ALARM: the move it is making, from the stage it stored. Stage 1 asked of every departing layer -
 * blocked or failed, the plan dropped and its departers cooled; else the tree and the closing plan written together.
 * Stage 3 asked of every departing layer - one that did not answer asked again CLOSE_RETRY_MS on; all answered, the
 * plan gone. @param {any} room @param {number} [now]
 */
export async function cellPlanAlarm(room, now = Date.now()) {
  const plan = await planOf(room);
  if (!plan) return;
  const storage = room.state.storage,
    directory = directoryOf(room);
  room._kind ??= 'cells';
  if (plan.stage === 'move') {
    const { blocked, failed } = await askDeparting(room, plan, CELL_INTERNAL_MOVE);
    const next = blocked.length || failed.length ? null : treeAfter(await directoryTree(room, now), plan);
    if (!next) {
      await storage.delete(CELL_PLAN_KEY);
      room._cellPlan = null;
      for (const node of plan.from) directory.cool[node] = now + MOVE_COOLDOWN_MS;
      room._metrics.c.cellBlocked++;
      room._metricsTick(true);
      console.warn(`[cells] ${plan.kind} of ${plan.from.join(' ')} not made: ${blocked.length ? `blocked by ${blocked.join('; ')}` : failed.length ? `no answer from ${failed.join(' ')}` : 'the tree is no longer its'}`);
      return;
    }
    room._cellPlan = { ...plan, stage: 'close' };
    await storage.put({ [CELL_TREE_KEY]: next, [CELL_PLAN_KEY]: room._cellPlan });
    room._cellTree = next;
    for (const node of plan.from)
      for (let layer = 0; layer < LAYERS_MAX; layer++) directory.reports.delete(`${node}#${layer}`);
  }
  const { failed } = await askDeparting(room, plan, CELL_INTERNAL_CLOSE);
  if (failed.length) {
    await storage.setAlarm(now + CLOSE_RETRY_MS);
    console.warn(`[cells] close unanswered by ${failed.join(' ')} - asked again`);
    return;
  }
  await storage.delete(CELL_PLAN_KEY);
  room._cellPlan = null;
  room._metrics.c.cellMoves++;
  room._metricsTick(true);
  console.log(`[cells] ${plan.kind} made: ${plan.from.join(' ')} -> ${plan.to.join(' ')}`);
}

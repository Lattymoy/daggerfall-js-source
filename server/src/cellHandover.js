// @ts-check
// A NODE'S ROWS HANDED OVER (bible/11-Multiplayer/Scale-Arc.md, COST-2). When the cell tree moves - a node split into its
// four children, or four siblings merged into their parent - what the departing node stores goes to the nodes that hold
// it now, by pixel (net/cellTree.js partitionRows), before its sockets are closed. Every key a node can hold has a class:
//   part  - addressed by a pixel, so partitioned by the receiving nodes' squares: the parked teams (`park:`) and the
//           overworld ledger (`ow:led` - its spent ids, its dungeons' rows, its searched graves);
//   copy  - per-place config, copied to every receiver: the relay's settings, the room's bans and freezes;
//   drop  - swept at every drain and made again at the next hello: ids' looks and secrets, the old hello bucket;
//   block - everything else, an unknown key included: a live fight, a debt owed an account, a raid, a star, a serpent,
//           the wild's remains. A node holding any key that blocks is not repartitioned, so the tree only moves where the
//           handover is whole, and a store this file does not know stops a move rather than being lost by it.
// The receiver takes rows IDEMPOTENTLY by their own keys (a park by its key, the newest; a ledger entry by its id, row or
// grave key), so a handover asked again after a partial failure leaves every receiver as one handover would.
//
// This lives outside index.js because every named export of the entrypoint is read as an entrypoint (relayScale.js).
import { partitionRows, nodeBounds } from '../../src/net/cellTree.js';
import { owLedgerOf, owIdPixel, owPrune, owGraveKey, owRowKey } from '../../src/net/overworldLaw.js';
import { OW_LEDGER_KEY, parkSpotOf, mapPixelOfWire, SWEEP_PAGE } from './relay.js';
import { ROOM_CALL_MS } from './relayScale.js';
import { FREEZES_KEY } from './staffFreeze.js';

/**
 * The rows of a node that part or copy, as rowsOf reads them.
 * @typedef {object} NodeRows
 * @property {Array<[string, any]>} parks - each parked team's key and record
 * @property {any} led - the overworld ledger (net/overworldLaw.js owLedgerOf), pruned
 * @property {Record<string, unknown>} copy - each copy key the node holds, and its value
 */
/**
 * What one receiving node is posted (CELL_INTERNAL_TAKE).
 * @typedef {object} HandoverPayload
 * @property {number} v - HANDOVER_V
 * @property {Array<[string, any]>} parks - the parks whose spot this receiver holds
 * @property {Array<[string, number]>} sp - the ledger's spent ids, each with when it ends
 * @property {any[]} dg - the ledger's dungeon rows
 * @property {any[]} gr - the ledger's searched graves
 * @property {Record<string, unknown>} copy - the copy keys, the same for every receiver
 */

/** The receiving node's door. */
export const CELL_INTERNAL_TAKE = '/internal/cells/take';
/** A node closed by a move keeps when it was, so an isolate's older tree is answered "moved" for a while; a coarse node
 *  keeps the fine cells whose rows it pulled at the seed (cellMoves.js). */
export const CELL_MOVED_KEY = 'cellmoved';
export const CELL_PULLED_KEY = 'cellpulled';
/** The payload's shape. */
export const HANDOVER_V = 1;
/** Every key class, `[key or prefix (ending ':'), class, what it is]`; any key matching none blocks. */
export const KEY_CLASSES = Object.freeze([
  ['park:', 'part', 'a parked team - by its spot'],
  [OW_LEDGER_KEY, 'part', 'the overworld ledger - its spent ids, dungeons and graves, each by its pixel'],
  ['relaycfg', 'copy', 'the relay\'s settings, as the hub said them'],
  ['bans', 'copy', 'the room\'s bans'],
  [FREEZES_KEY, 'copy', 'the room\'s freezes'],
  ['look:', 'drop', 'an id\'s look - swept at the drain, said again at its hello'],
  ['secret:', 'drop', 'an id\'s secret - swept at the drain, said again at its hello'],
  ['hellos', 'drop', 'a relay before SCALE2b\'s hello bucket'],
  [CELL_MOVED_KEY, 'drop', 'when a move closed this node - a node that takes rows is one again'],
  [CELL_PULLED_KEY, 'drop', 'the fine cells a coarse node pulled at the seed - a cell that gave once gives nothing again'],
].map((entry) => Object.freeze(entry)));
/** A key's class - 'part', 'copy', 'drop', or 'block' for any key no entry names. @param {string} key */
export const keyClass = (key) => {
  for (const [pattern, kind] of KEY_CLASSES) if (pattern.endsWith(':') ? key.startsWith(pattern) : key === pattern) return kind;
  return 'block';
};

/** The keys of a node's storage that block a handover, `max` at most - every key listed, a page at a time.
 *  @param {any} storage @param {number} [max] */
export async function blockersOf(storage, max = 8) {
  const blockers = [];
  let after = null;
  for (;;) {
    const page = await storage.list({ limit: SWEEP_PAGE, ...(after ? { startAfter: after } : {}) });
    for (const key of page.keys()) {
      if (keyClass(key) === 'block') {
        blockers.push(key);
        if (blockers.length >= max) return blockers;
      }
      after = key;
    }
    if (page.size < SWEEP_PAGE) return blockers;
  }
}

/** A park record's map pixel - its spot (natives) on the map. @param {any} record @returns {[number, number] | null} */
export const parkPixel = (record) => {
  const spot = parkSpotOf(record?.r);
  return spot && Number.isFinite(spot[0]) && Number.isFinite(spot[1]) ? /** @type {[number, number]} */ (mapPixelOfWire(spot[0], spot[1])) : null;
};

/**
 * THE PARTITION OF A NODE'S ROWS among `targets` (node keys whose squares tile one square - a node's four children, or
 * the one parent), each row by its pixel CLAMPED INTO that square: a ledger row may stand up to OW_CELL_MARGIN_PX past
 * its cell (a band met at the seam), so a pixel outside goes to the nearest target, never nowhere. Rows with no pixel at
 * all (a record a law no longer reads) are left out. Pure.
 * @param {NodeRows} rows @param {string[]} targets
 * @returns {Map<string, HandoverPayload>}
 */
export function handoverPayloads(rows, targets) {
  const square = targets.map(nodeBounds).reduce((union, bounds) => (union && bounds ? { x0: Math.min(union.x0, bounds.x0), y0: Math.min(union.y0, bounds.y0), x1: Math.max(union.x1, bounds.x1), y1: Math.max(union.y1, bounds.y1) } : null));
  if (!square) throw new Error('handover: a target that is no node');
  const clamp = (/** @type {[number, number] | null} */ pixel) => (pixel ? /** @type {[number, number]} */ ([Math.min(Math.max(pixel[0], square.x0), square.x1 - 1), Math.min(Math.max(pixel[1], square.y0), square.y1 - 1)]) : null);
  const parks = partitionRows(rows.parks, ([, record]) => clamp(parkPixel(record)), targets).by;
  const spent = partitionRows(rows.led.sp, (entry) => {
    const pixel = owIdPixel(entry[0]);
    return clamp(pixel ? [pixel.x, pixel.y] : null);
  }, targets).by;
  const dungeons = partitionRows(Object.values(rows.led.dg), (row) => clamp([row[0], row[1]]), targets).by;
  const graves = partitionRows(Object.values(rows.led.gr ?? {}), (grave) => clamp([grave[0], grave[1]]), targets).by;
  return new Map(targets.map((target) => [target, { v: HANDOVER_V, parks: parks.get(target), sp: spent.get(target), dg: dungeons.get(target), gr: graves.get(target), copy: rows.copy }]));
}

/** A POST to node `target`'s take door, inside ROOM_CALL_MS - production's `post` for handOver. @param {any} env */
export const roomPost = (env) => async (/** @type {string} */ target, /** @type {any} */ payload) => {
  const response = await env.ROOMS.get(env.ROOMS.idFromName(target)).fetch(new Request(`https://relay.internal${CELL_INTERNAL_TAKE}`, { method: 'POST', body: JSON.stringify(payload), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
  return response.ok;
};

/**
 * THE HANDOVER: the departing node `room`'s rows posted to `targets` (each asked again once on a miss), and only when
 * every target took its part are the handed rows let go here. A node holding a key that blocks hands nothing.
 *
 * A move hands over TWICE (cellMoves.js). First with `keep` - sent, nothing let go - while the node still serves its
 * sockets, so a directory that stops before its tree is committed loses nothing. Then at the close, once its sockets
 * are gone, the whole again (a take is idempotent, so the second send is the first's delta) and let go. The close
 * passes `force`, because the tree is committed by then: a key that blocks and arrived since the first send is left
 * behind and named (`orphaned`), rather than holding the move half made. A node that holds no row posts nothing.
 * Answers `{ ok, blocked?, failed?, sent?, orphaned? }`.
 * @param {any} room the departing Room (index.js) @param {string[]} targets
 * @param {(target: string, payload: any) => Promise<boolean>} post @param {number} [now]
 * @param {{ keep?: boolean, force?: boolean }} [how]
 */
export async function handOver(room, targets, post, now = Date.now(), { keep = false, force = false } = {}) {
  const storage = room.state.storage;
  const blocked = await blockersOf(storage);
  if (blocked.length && !force) return { ok: false, blocked };
  const orphaned = blocked.length ? { orphaned: blocked } : {};
  const rows = await rowsOf(storage, now);
  if (emptyRows(rows)) return { ok: true, sent: {}, ...orphaned };
  const payloads = handoverPayloads(rows, targets);
  const postOnce = async (/** @type {string} */ target) => {
    try {
      return await post(target, payloads.get(target));
    } catch {
      return false;
    }
  };
  const failed = [];
  for (const target of targets) if (!(await postOnce(target)) && !(await postOnce(target))) failed.push(target);
  if (failed.length) return { ok: false, failed };
  if (!keep) await letGo(room, rows.parks);
  return { ok: true, sent: Object.fromEntries([...payloads].map(([target, payload]) => [target, payload.parks.length + payload.sp.length + payload.dg.length + payload.gr.length])), ...orphaned };
}
/** A node's rows that part or copy: its parks, its ledger (pruned), its copy keys. @param {any} storage @param {number} now
 *  @returns {Promise<NodeRows>} */
export async function rowsOf(storage, now) {
  const parks = [...(await storage.list({ prefix: 'park:' }))];
  const ledger = owLedgerOf(await storage.get(OW_LEDGER_KEY));
  owPrune(ledger, now);
  const copy = /** @type {Record<string, unknown>} */ ({});
  for (const [key, kind] of KEY_CLASSES)
    if (kind === 'copy') {
      const value = await storage.get(key);
      if (value !== undefined) copy[key] = value;
    }
  return { parks, led: ledger, copy };
}
/** Does a node hold no row that parts or copies? @param {{ parks: any[], led: any, copy: object }} rows */
const emptyRows = (rows) => !rows.parks.length && !rows.led.sp.length && !Object.keys(rows.led.dg).length && !Object.keys(rows.led.gr ?? {}).length && !Object.keys(rows.copy).length;
/** The handed rows let go here - the parks listed and the ledger - and the instance's kept copies read again on their
 *  next use. @param {any} room @param {Array<[string, any]>} parks */
export async function letGo(room, parks) {
  const storage = room.state.storage;
  const handed = parks.map(([key]) => key);
  // the runtime deletes at most 128 keys a call
  for (let offset = 0; offset < handed.length; offset += 128) await storage.delete(handed.slice(offset, offset + 128));
  await storage.delete(OW_LEDGER_KEY);
  room._parks = null;
  room._owLoad = null;
}

/**
 * THE RECEIVING SIDE: a handover's payload taken into `room` - a park kept where none stands under its key or it is the
 * newer; the ledger's entries merged by their own keys (the later end of a spent id, the newer sighting of a dungeon, a
 * grave once) through the room's own ledger (index.js _owLedger, _owWrite, so the instance's copy stays its storage's);
 * a config key copied where the room holds none. A node that takes rows is a node again, so its moved mark goes.
 * Answers how many rows it took.
 * @param {any} room @param {any} payload @param {number} [now]
 */
export async function takeHandover(room, payload, now = Date.now()) {
  if (!payload || payload.v !== HANDOVER_V) return null;
  const storage = room.state.storage;
  let taken = 0;
  if (room._cellMoved !== null) {
    await storage.delete(CELL_MOVED_KEY);
    room._cellMoved = null;
  }
  const keptParks = room._parks ? await room._parks : null;
  for (const entry of Array.isArray(payload.parks) ? payload.parks : []) {
    const [key, record] = Array.isArray(entry) ? entry : [];
    if (typeof key !== 'string' || keyClass(key) !== 'part' || !key.startsWith('park:') || typeof record?.k !== 'string') continue;
    const standing = await storage.get(key);
    if (standing && (standing.at ?? 0) >= (record.at ?? 0)) continue;
    await storage.put(key, record);
    keptParks?.set(key, record);
    taken++;
  }
  const ledger = await room._owLedger(now);
  const ends = new Map(ledger.sp.map((/** @type {[string, number]} */ entry) => [entry[0], entry[1]]));
  for (const entry of Array.isArray(payload.sp) ? payload.sp : [])
    if (Array.isArray(entry) && typeof entry[0] === 'string' && Number.isFinite(entry[1]) && !(ends.get(entry[0]) >= entry[1])) {
      ends.set(entry[0], entry[1]);
      taken++;
    }
  const dungeons = { ...ledger.dg };
  for (const row of Array.isArray(payload.dg) ? payload.dg : []) {
    if (!Array.isArray(row)) continue;
    const key = owRowKey(row[0], row[1]);
    if (!(dungeons[key]?.[2] >= row[2])) {
      dungeons[key] = row;
      taken++;
    }
  }
  const graves = { ...(ledger.gr ?? {}) };
  for (const grave of Array.isArray(payload.gr) ? payload.gr : []) {
    if (!Array.isArray(grave)) continue;
    const key = owGraveKey(grave);
    if (!graves[key]) {
      graves[key] = grave;
      taken++;
    }
  }
  const merged = owLedgerOf({ sp: [...ends].sort((left, right) => left[1] - right[1]), dg: dungeons, gr: graves });   // its law's bounds and sanity, the newest kept
  owPrune(merged, now);
  Object.assign(ledger, merged);   // the instance's own ledger object, so a word that lands next reads the merge
  await room._owWrite(ledger);
  for (const [key, value] of Object.entries(payload.copy && typeof payload.copy === 'object' ? payload.copy : {})) {
    if (keyClass(key) === 'copy' && (await storage.get(key)) === undefined) await storage.put(key, value);
  }
  return taken;
}

/** The take's door (CELL_INTERNAL_TAKE): a payload posted by a departing node. @param {any} room @param {Request} request */
export async function cellTakeInternal(room, request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const taken = await takeHandover(room, body);
  return new Response(JSON.stringify(taken == null ? { error: 'not a handover' } : { ok: true, n: taken }), { status: taken == null ? 400 : 200, headers: { 'content-type': 'application/json' } });
}

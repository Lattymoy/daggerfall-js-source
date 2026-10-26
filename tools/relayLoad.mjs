#!/usr/bin/env node
// RELAY-LOAD (2026-10-18, from play: "Server is kinda breaking down near oblivion gate cause so many ppl lol"; the owner,
// at a thousand online: "We really need to future proof even more and improve our server. Like really deep") - WHAT IS
// FILLING THE RELAY, READ BY THE OPERATOR. Every room writes one Analytics Engine point a window it was busy in
// (server/src/relayScale.js RoomMetrics: its kind, its sockets, hellos, refusals, poses, sends, bytes, drops and peak),
// and nothing read them back: the question "which room broke at the gate" was answered by arithmetic from the constants.
// This builds the questions, as tools/d1Load.mjs does for the account service (its book and its command line are
// d1Load.mjs's: questionBook, runBook), and .github/workflows/relay-load.yml asks them with the deploy's token, by hand.
// It writes nothing.
//
//   node tools/relayLoad.mjs --sql <name> [hours]   one question's SQL (kinds | windows | crowds | fulls | storage | levels | moves)
//   node tools/relayLoad.mjs --names                the questions' names, one a line
//   node tools/relayLoad.mjs --table <name> <file>  an answer (the SQL API's JSON) as a Markdown table
//   node tools/relayLoad.mjs --hours [hours]        the window a run asks (an empty input is one hour)
//
// THE WEIGHT IS THE SAMPLE'S (d1Load.mjs's law): every count and sum is weighted by `_sample_interval`. A MAX is not - a
// room's peak is its own. A POINT IS ONE ROOM'S WINDOW (METRICS_WINDOW_MS): written on the room's first frame or close
// after its window ends, so a kind's sockets summed over a five-minute bucket's points are an ESTIMATE from below of that
// kind's sockets across the relay - a room that wrote no point in the bucket (its window ended in the next), or that
// slept inside its window (an object evicted between frames keeps no window), is not in it (AUDIT PLAN-1000 A5).
// WHAT A KIND COUNTS (AUDIT PLAN-1000 A1): `world` is the cells' sockets, halos counted; `gate` a court's and its copies';
// `chat` is every channel object - each hub shard and region shard its players' real sockets, AND each bus (`chat:world`,
// `chat:region.<r>`) every shard's player again as a ShardSocket in its own index (server/src/index.js `_vhello`): about
// four `chat` sockets a player with a hub link and a region link, and a bus's hellos and sends counted beside its shards'.
// A bus is the largest `chat` room by far, which is why the crowds question leaves the kind out.

import { isMain } from './lib/isMain.mjs';
import { loadHours, since, questionBook, runBook } from './d1Load.mjs';

/** The dataset the relay writes (server/wrangler.toml's [[analytics_engine_datasets]]). */
export const DATASET = 'daggerfall_relay';
/** AUDIT PLAN-1000 A3: the kinds the five-minute rows are read for - a crowd's (the cells, a court, the channels) - and the
 *  most hours they span. Every kind and the whole window is the kinds question's; a table of every kind's five minutes over
 *  a week is tens of thousands of rows, and a LIMIT cut it without saying so. */
export const WINDOW_KINDS = Object.freeze(['world', 'gate', 'chat']);
export const WINDOW_HOURS_MAX = 24;
/** Weighted sums of the point's doubles (relayScale.js RoomMetrics names each). */
const W = {
  n: 'SUM(_sample_interval)',
  sockets: 'SUM(double2 * _sample_interval)',
  hellos: 'SUM(double3 * _sample_interval)',
  busy: 'SUM(double4 * _sample_interval)',
  poses: 'SUM(double7 * _sample_interval)',
  sends: 'SUM(double8 * _sample_interval)',
  mbOut: 'SUM(double9 * _sample_interval) / 1000000',
  storage: 'SUM((double10 + double11) * _sample_interval)',
  refused: 'SUM(double12 * _sample_interval)',
  full: 'SUM(double13 * _sample_interval)',
  drops: 'SUM(double14 * _sample_interval)',
};
/** FOES-FIRST and FOES-HOLD: weighted sums of the blobs past the doubles (relayScale.js RoomMetrics names each), each a
 *  count in decimal read back by `toUInt32` - the one conversion of the SQL API's reference past `toUInt8`. */
const B = {
  hitDrops: 'SUM(_sample_interval * toUInt32(blob3))',
  fullDrops: 'SUM(_sample_interval * toUInt32(blob4))',
  fulls: 'SUM(_sample_interval * toUInt32(blob5))',
  held: 'SUM(_sample_interval * toUInt32(blob6))',
  heldSent: 'SUM(_sample_interval * toUInt32(blob7))',
  heldGone: 'SUM(_sample_interval * toUInt32(blob8))',
  heldMs: 'SUM(_sample_interval * toUInt32(blob9))',
  beats: 'SUM(_sample_interval * toUInt32(blob10))',
};
/** The windows question's span: the asked hours, at most WINDOW_HOURS_MAX (the window refused before it, as every other). */
const windowHours = (h) => Math.min(loadHours(h), WINDOW_HOURS_MAX);

/**
 * THE QUESTIONS, each `[name, title, columns, sql(hours)]`:
 * - kinds: every room kind over the window - its room-windows, its largest room, the hellos it took and refused busy,
 *   the sockets refused full (every layer of a place full) and closed with a reason, the frames its byte budgets
 *   dropped, the poses in and the sends each cost, the data out and the storage it touched - the most sends first;
 * - windows: every five minutes of the last WINDOW_HOURS_MAX hours at most, each of WINDOW_KINDS - its sockets across the
 *   relay (an estimate from below), its largest room, busy, full, drops, poses and sends - so a gate's crowd shows as its
 *   rows (a gate opens at HH:32:30 UTC every even hour); every row of the span, never cut;
 * - crowds: the forty busiest room-windows by their peak that are not a channel's (`chat` - its buses hold everyone) -
 *   when, which kind, how many it held and what it refused: the site's cell and the court, at a gate's hour;
 * - fulls (FOES-FIRST and FOES-HOLD, 2026-10-21; bible/11-Multiplayer/Scale-Arc.md FOES-HOLD): every kind's foes budget
 *   read by its blobs - the full frames asked and dropped, the frames held for their turn, sent, and gone unsent, the
 *   mean wait of a held frame sent, the beats said for a held sender, and the blows the hit funnels dropped - over the
 *   points that carry the hold's blobs (`blob6 != ''`: a relay before FOES-HOLD wrote none, and the SQL API's
 *   `toUInt32` reads no empty string); whether the line holds live, kind by kind;
 * - storage (FIELD BUGS 2026-10-21c, the rooms' resets: 877 "Internal error in Durable Object storage caused object to
 *   be reset" on the evening of 2026-10-20, cause not found): the forty room-windows that wrote storage most - when,
 *   which kind, its reads and writes and the sockets it held - so a night of resets is read beside the rooms that were
 *   writing then (the resets themselves are Workers Observability's, not this dataset's);
 * - levels (COST-2 part two, bible/11-Multiplayer/Scale-Arc.md): the cells' objects by their node's level (blob11: 0 a
 *   fine cell, 1-4 a coarse node, '' a relay before COST-2 or a room woken by its alarm alone) - the room-windows each
 *   level was awake (over 12 an hour: its objects awake on the mean), the sockets and the most one held, the sockets
 *   refused full, the poses and the sends - so the seed's before and after are read side by side;
 * - moves (COST-2 part two): the cell directory's moves made and moves its nodes' rows blocked (blob12, blob13), over the
 *   points that carry them (`blob12 != ''`: a relay before part two wrote none).
 */
export const QUESTIONS = Object.freeze([
  ['kinds', 'The rooms by kind (sends, most first)', ['kind', 'room_windows', 'peak', 'hellos', 'busy', 'room_full', 'refused', 'drops', 'poses', 'sends', 'sends_per_pose', 'mb_out', 'storage'],
    (h) => `SELECT blob1 AS kind, ${W.n} AS room_windows, MAX(double15) AS peak, ${W.hellos} AS hellos, ${W.busy} AS busy, ${W.full} AS room_full, ${W.refused} AS refused, ${W.drops} AS drops, ${W.poses} AS poses, ${W.sends} AS sends, IF(${W.poses} > 0, ${W.sends} / ${W.poses}, 0.0) AS sends_per_pose, ${W.mbOut} AS mb_out, ${W.storage} AS storage FROM ${DATASET} WHERE ${since(h)} GROUP BY kind ORDER BY sends DESC LIMIT 40`],
  ['windows', `Every five minutes, by kind (${WINDOW_KINDS.join(', ')}; the last ${WINDOW_HOURS_MAX} hours at most)`, ['bucket', 'kind', 'sockets', 'peak', 'busy', 'room_full', 'drops', 'poses', 'sends'],
    (h) => `SELECT toStartOfInterval(timestamp, INTERVAL '5' MINUTE) AS bucket, blob1 AS kind, ${W.sockets} AS sockets, MAX(double15) AS peak, ${W.busy} AS busy, ${W.full} AS room_full, ${W.drops} AS drops, ${W.poses} AS poses, ${W.sends} AS sends FROM ${DATASET} WHERE ${since(windowHours(h))} AND blob1 IN (${WINDOW_KINDS.map((k) => `'${k}'`).join(', ')}) GROUP BY bucket, kind ORDER BY bucket DESC, kind LIMIT ${12 * windowHours(h) * WINDOW_KINDS.length + 12 * WINDOW_KINDS.length}`],
  ['crowds', 'The busiest rooms but the channels (peak sockets, most first)', ['stamp', 'kind', 'peak', 'sockets', 'hellos', 'busy', 'room_full', 'drops', 'poses', 'sends'],
    (h) => `SELECT timestamp AS stamp, blob1 AS kind, double15 AS peak, double2 AS sockets, double3 AS hellos, double4 AS busy, double13 AS room_full, double14 AS drops, double7 AS poses, double8 AS sends FROM ${DATASET} WHERE ${since(h)} AND blob1 != 'chat' ORDER BY peak DESC LIMIT 40`],
  ['fulls', 'The foes budget\'s full frames and its hold, by kind (FOES-FIRST, FOES-HOLD)', ['kind', 'fulls', 'full_drops', 'held', 'held_sent', 'held_gone', 'wait_ms', 'beats', 'hit_drops'],
    (h) => `SELECT blob1 AS kind, ${B.fulls} AS fulls, ${B.fullDrops} AS full_drops, ${B.held} AS held, ${B.heldSent} AS held_sent, ${B.heldGone} AS held_gone, IF(${B.heldSent} > 0, ${B.heldMs} / ${B.heldSent}, 0.0) AS wait_ms, ${B.beats} AS beats, ${B.hitDrops} AS hit_drops FROM ${DATASET} WHERE ${since(h)} AND blob6 != '' GROUP BY kind ORDER BY fulls DESC LIMIT 40`],
  ['storage', 'The room-windows that wrote storage most (writes, most first)', ['stamp', 'kind', 'writes', 'reads', 'room_sockets', 'room_peak'],
    (h) => `SELECT timestamp AS stamp, blob1 AS kind, double11 AS writes, double10 AS reads, double2 AS room_sockets, double15 AS room_peak FROM ${DATASET} WHERE ${since(h)} ORDER BY writes DESC LIMIT 40`],
  ['levels', 'The cells by their node\'s level (COST-2: 0 a 16-pixel cell, 1-4 a coarse node)',['kind', 'level', 'room_windows', 'sockets', 'peak', 'room_full', 'poses', 'sends'],
    (h) => `SELECT blob1 AS kind, blob11 AS level, ${W.n} AS room_windows, ${W.sockets} AS sockets, MAX(double15) AS peak, ${W.full} AS room_full, ${W.poses} AS poses, ${W.sends} AS sends FROM ${DATASET} WHERE ${since(h)} AND blob1 = 'world' GROUP BY kind, level ORDER BY level LIMIT 10`],
  ['moves', 'The cell directory\'s moves (COST-2 part two)',['kind', 'points', 'moves', 'blocked'],
    (h) => `SELECT blob1 AS kind, ${W.n} AS points, SUM(_sample_interval * toUInt32(blob12)) AS moves, SUM(_sample_interval * toUInt32(blob13)) AS blocked FROM ${DATASET} WHERE ${since(h)} AND blob1 = 'cells' AND blob12 != '' GROUP BY kind LIMIT 1`],
]);

const book = questionBook(QUESTIONS);
/** One question's SQL over the last `hours`, asked as JSON. */
export const loadSql = book.loadSql;
/** An answer as a Markdown table under its title (d1Load.mjs's drawing: none said so, a refusal thrown). */
export const loadTable = book.loadTable;

if (isMain(import.meta.url)) runBook(book, 'relayLoad.mjs');

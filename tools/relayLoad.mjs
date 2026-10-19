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
//   node tools/relayLoad.mjs --sql <name> [hours]   one question's SQL (kinds | windows | crowds)
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
 *   when, which kind, how many it held and what it refused: the site's cell and the court, at a gate's hour.
 */
export const QUESTIONS = Object.freeze([
  ['kinds', 'The rooms by kind (sends, most first)', ['kind', 'room_windows', 'peak', 'hellos', 'busy', 'room_full', 'refused', 'drops', 'poses', 'sends', 'sends_per_pose', 'mb_out', 'storage'],
    (h) => `SELECT blob1 AS kind, ${W.n} AS room_windows, MAX(double15) AS peak, ${W.hellos} AS hellos, ${W.busy} AS busy, ${W.full} AS room_full, ${W.refused} AS refused, ${W.drops} AS drops, ${W.poses} AS poses, ${W.sends} AS sends, IF(${W.poses} > 0, ${W.sends} / ${W.poses}, 0.0) AS sends_per_pose, ${W.mbOut} AS mb_out, ${W.storage} AS storage FROM ${DATASET} WHERE ${since(h)} GROUP BY kind ORDER BY sends DESC LIMIT 40`],
  ['windows', `Every five minutes, by kind (${WINDOW_KINDS.join(', ')}; the last ${WINDOW_HOURS_MAX} hours at most)`, ['bucket', 'kind', 'sockets', 'peak', 'busy', 'room_full', 'drops', 'poses', 'sends'],
    (h) => `SELECT toStartOfInterval(timestamp, INTERVAL '5' MINUTE) AS bucket, blob1 AS kind, ${W.sockets} AS sockets, MAX(double15) AS peak, ${W.busy} AS busy, ${W.full} AS room_full, ${W.drops} AS drops, ${W.poses} AS poses, ${W.sends} AS sends FROM ${DATASET} WHERE ${since(windowHours(h))} AND blob1 IN (${WINDOW_KINDS.map((k) => `'${k}'`).join(', ')}) GROUP BY bucket, kind ORDER BY bucket DESC, kind LIMIT ${12 * windowHours(h) * WINDOW_KINDS.length + 12 * WINDOW_KINDS.length}`],
  ['crowds', 'The busiest rooms but the channels (peak sockets, most first)', ['stamp', 'kind', 'peak', 'sockets', 'hellos', 'busy', 'room_full', 'drops', 'poses', 'sends'],
    (h) => `SELECT timestamp AS stamp, blob1 AS kind, double15 AS peak, double2 AS sockets, double3 AS hellos, double4 AS busy, double13 AS room_full, double14 AS drops, double7 AS poses, double8 AS sends FROM ${DATASET} WHERE ${since(h)} AND blob1 != 'chat' ORDER BY peak DESC LIMIT 40`],
]);

const book = questionBook(QUESTIONS);
/** One question's SQL over the last `hours`, asked as JSON. */
export const loadSql = book.loadSql;
/** An answer as a Markdown table under its title (d1Load.mjs's drawing: none said so, a refusal thrown). */
export const loadTable = book.loadTable;

if (isMain(import.meta.url)) runBook(book, 'relayLoad.mjs');

#!/usr/bin/env node
// D1-LOAD (2026-10-11, from play: the account service stayed slow after SEAT-CAP and SEAT-LEASE - "So it works, but it
// takes forever to load"; the owner: "do whatever is the most detailed. I dont want band aid fixes") - WHAT IS FILLING
// THE ONE DATABASE, READ BY THE OPERATOR. Every request and every cron firing writes one point to Workers Analytics
// Engine (server-account/src/metrics.js: the route, its wall ms, its D1 statements, its D1 WAIT, its rows read and
// written), and nothing ever read them back but a person with the SQL API at hand. This builds the questions, and
// .github/workflows/d1-load.yml asks them with the deploy's token, by hand, beside D1's own query insights. It writes
// nothing.
//
//   node tools/d1Load.mjs --sql <name> [hours]   one question's SQL (routes | minutes | cron | errors | written)
//   node tools/d1Load.mjs --names                the questions' names, one a line
//   node tools/d1Load.mjs --table <name> <file>  an answer (the SQL API's JSON) as a Markdown table
//
// THE WEIGHT IS THE SAMPLE'S: Analytics Engine samples under load, and each point carries `_sample_interval`, the
// points it stands for - every count and sum here is weighted by it, as metrics.js's own example query is.

import { readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';

/** The dataset the service writes (server-account/wrangler.toml's [[analytics_engine_datasets]]). */
export const DATASET = 'daggerfall_accounts';
/** The longest window asked - a week; the shortest an hour. */
export const HOURS_MAX = 168;

/** A window in whole hours, 1 to HOURS_MAX, or throw: digits only, so nothing in it can reach the SQL. */
export function loadHours(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return 1;
  const h = /^[0-9]{1,3}$/.test(s) ? Number(s) : NaN;
  if (!Number.isSafeInteger(h) || h < 1 || h > HOURS_MAX) throw new Error(`not a window: ${JSON.stringify(raw)} - whole hours, 1 to ${HOURS_MAX}`);
  return h;
}

/** The window's WHERE over the last `h` whole hours (loadHours: refused before it reaches the SQL). */
export const since = (h) => `timestamp > NOW() - INTERVAL '${loadHours(h)}' HOUR`;
/** Weighted sums of the point's doubles (metrics.js names each). */
const W = {
  n: 'SUM(_sample_interval)',
  waitS: 'SUM(double5 * _sample_interval) / 1000',
  stmts: 'SUM(double3 * _sample_interval)',
  read: 'SUM(double6 * _sample_interval)',
  written: 'SUM(double4 * _sample_interval)',
  // the hot tables' rows written (metrics.js HOT_TABLES), each table's own double
  players: 'SUM(double8 * _sample_interval)',
  sessions: 'SUM(double9 * _sample_interval)',
  renown: 'SUM(double10 * _sample_interval)',
  realm: 'SUM(double11 * _sample_interval)',
};

/**
 * THE QUESTIONS, each `[name, title, columns, sql(hours)]`:
 * - routes: every route and the cron's jobs by the D1 WAIT they spent in all - the database's time, most first - with
 *   how often each was asked, its statements and rows, its p95 wall time;
 * - minutes: the window minute by minute - requests, D1 wait, statements - so a once-a-minute spike shows as a row;
 * - cron: the clock's own jobs (`CRON` points), each its firings, failures, statements and wait;
 * - errors: every answer that was not a 2xx, by route, status and its one word (an `overloaded` 500 among them);
 * - written: the rows written by route and by the tables its requests wrote (blob5, metrics.js tablesBlob -
 *   "table:rows", most first; the SQL API cannot split it, so a route's rows are grouped by the set of tables it wrote),
 *   beside the four hot tables' exact sums (double8-11), the most rows first. D1 rows written were $11 of a ~$90 day on
 *   the owner's bill of 2026-10-24, some 11 million rows, and nothing said whose (Scale-Arc.md COST-0).
 */
export const QUESTIONS = Object.freeze([
  ['routes', 'D1 wait by route (the database\'s time, most first)', ['route', 'method', 'requests', 'd1_wait_s', 'statements', 'rows_read', 'rows_written', 'p95_ms'],
    (h) => `SELECT blob1 AS route, blob2 AS method, ${W.n} AS requests, ${W.waitS} AS d1_wait_s, ${W.stmts} AS statements, ${W.read} AS rows_read, ${W.written} AS rows_written, quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms FROM ${DATASET} WHERE ${since(h)} GROUP BY route, method ORDER BY d1_wait_s DESC LIMIT 40`],
  ['minutes', 'Minute by minute', ['minute', 'requests', 'd1_wait_s', 'statements', 'rows_written'],
    (h) => `SELECT toStartOfInterval(timestamp, INTERVAL '1' MINUTE) AS minute, ${W.n} AS requests, ${W.waitS} AS d1_wait_s, ${W.stmts} AS statements, ${W.written} AS rows_written FROM ${DATASET} WHERE ${since(h)} GROUP BY minute ORDER BY minute DESC LIMIT 180`],
  ['cron', 'The clock\'s jobs', ['job', 'firings', 'failed', 'd1_wait_s', 'statements', 'changed', 'p95_ms'],
    (h) => `SELECT blob1 AS job, ${W.n} AS firings, SUM(IF(blob3 = '200', 0, 1) * _sample_interval) AS failed, ${W.waitS} AS d1_wait_s, ${W.stmts} AS statements, ${W.written} AS changed, quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms FROM ${DATASET} WHERE ${since(h)} AND blob2 = 'CRON' GROUP BY job ORDER BY d1_wait_s DESC`],
  ['errors', 'Answers that were not 2xx', ['route', 'status', 'word', 'requests'],
    (h) => `SELECT blob1 AS route, blob3 AS status, blob4 AS word, ${W.n} AS requests FROM ${DATASET} WHERE ${since(h)} AND NOT startsWith(blob3, '2') GROUP BY route, status, word ORDER BY requests DESC LIMIT 40`],
  ['written', 'D1 rows written by route and tables (most first)', ['route', 'tables', 'requests', 'rows_written', 'players', 'sessions', 'renown_tracks', 'realm_characters'],
    (h) => `SELECT blob1 AS route, blob5 AS tables, ${W.n} AS requests, ${W.written} AS rows_written, ${W.players} AS players, ${W.sessions} AS sessions, ${W.renown} AS renown_tracks, ${W.realm} AS realm_characters FROM ${DATASET} WHERE ${since(h)} AND double4 > 0 GROUP BY route, tables ORDER BY rows_written DESC LIMIT 40`],
]);

/** AUDIT PLAN-1000 A9 (tools/relayLoad.mjs asks its own book the same way): A BOOK OF QUESTIONS - each `[name, title,
 *  columns, sql(hours)]` - asked by name: its SQL over a window, as JSON, and its answer drawn. One home for both tools. */
export function questionBook(questions) {
  const questionOf = (name) => {
    const q = questions.find(([n]) => n === name);
    if (!q) throw new Error(`no question ${JSON.stringify(name)} - one of ${questions.map(([n]) => n).join(', ')}`);
    return q;
  };
  return {
    names: () => questions.map(([n]) => n),
    /** One question's SQL over the last `hours`, asked as JSON. */
    loadSql: (name, hours) => `${questionOf(name)[3](hours)} FORMAT JSON`,
    /** An answer as a Markdown table under its title - the columns the question names, in order. */
    loadTable: (name, answer) => { const [, title, cols] = questionOf(name); return answerTable(name, title, cols, answer); },
  };
}
const book = questionBook(QUESTIONS);
/** One question's SQL over the last `hours`, asked as JSON. */
export const loadSql = book.loadSql;

const cell = (v) => {
  if (v == null) return '';
  const n = typeof v === 'number' ? v : (/^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v) : null);
  if (n == null) return String(v).replace(/\|/g, '\\|');
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
};
/**
 * An answer as a Markdown table under its title - the columns the question names, in order. An answer that carries
 * none is said so; one that is not the SQL API's JSON throws, so the run fails where it broke.
 * @param {string} name @param {any} answer the SQL API's body (`{ data: [...] }`)
 */
export function loadTable(name, answer) {
  return book.loadTable(name, answer);
}
/** RELAY-LOAD: the drawing itself, any question's (questionBook's). */
export function answerTable(name, title, cols, answer) {
  const rows = answer?.data;
  if (!Array.isArray(rows)) throw new Error(`${name}: the answer carries no rows - ${JSON.stringify(answer).slice(0, 300)}`);
  const head = `**${title}**\n\n`;
  if (!rows.length) return `${head}No points in the window.\n`;
  return `${head}| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n${rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`).join('\n')}\n`;
}

/** AUDIT PLAN-1000 A9: a book's command line - `--names`, `--sql <name> [hours]`, `--table <name> <answer.json>`, and
 *  `--hours [hours]`, the window a run asks (an empty input is loadHours' own hour, said as the SQL will say it). */
export function runBook(b, tool, argv = process.argv.slice(2)) {
  const [flag, x, y] = argv;
  if (flag === '--names') console.log(b.names().join('\n'));
  else if (flag === '--sql') console.log(b.loadSql(x, y));
  else if (flag === '--table') process.stdout.write(b.loadTable(x, JSON.parse(readFileSync(y, 'utf8'))));
  else if (flag === '--hours') console.log(loadHours(x));
  else { console.error(`usage: ${tool} --names | --sql <name> [hours] | --table <name> <answer.json> | --hours [hours]`); process.exit(2); }
}

if (isMain(import.meta.url)) runBook(book, 'd1Load.mjs');

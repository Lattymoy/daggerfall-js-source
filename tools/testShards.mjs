#!/usr/bin/env node
// FLOW1 (2026-09-26, Mac: "is there a way to really ensure we have a faster workflow with the same standards?"): THE
// SUITE IN SHARDS, BALANCED. CI ran the whole suite in one job - 1,300 files, ~6 minutes on a four-core runner - and ran
// it twice in a row, the PR's check and again on main before the deploy. Now the files are split into N shards by their
// recorded times (tools/testTimes.json, written by `npm run test:times`): the longest first, each onto the lightest shard,
// so every shard finishes near the others and the N jobs run at once. EVERY FILE IS IN EXACTLY ONE SHARD (the pin,
// test/tooling/flow1_ci.test.js, holds it): a file with no recorded time weighs the median, so a new test file is never left
// out - at worst it is placed a little less well until the times are taken again. Inside a shard `node --test` is
// handed its files longest first, so its workers start on the long ones.
//
//   node tools/testShards.mjs 2/4            # run shard 2 of 4 (what CI runs)
//   node tools/testShards.mjs 2/4 --list     # print its files, one a line
//   node tools/testShards.mjs 2/8 --record t.json   # run it, adding each file's wall time to t.json (CI-TIMES)
//   node tools/testShards.mjs --plan 4       # each shard's file count and recorded seconds
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TIMES_FILE = 'tools/testTimes.json';

/** The suite's files - every `*.test.js` under test/, its folders' among them - sorted. */
export function testFiles(root = ROOT) {
  // TIDY5: every test file under test/, its area's folder and its feature's (bible/01-Overview/Code-Map.md)
  return readdirSync(join(root, 'test'), { recursive: true }).map((f) => f.split('\\').join('/')).filter((f) => f.endsWith('.test.js')).sort().map((f) => `test/${f}`);
}

/** The recorded times (file -> ms), or none. */
export function readTimes(root = ROOT) {
  const p = join(root, TIMES_FILE);
  if (!existsSync(p)) return {};
  try { const t = JSON.parse(readFileSync(p, 'utf8')); return t && typeof t === 'object' ? t : {}; } catch { return {}; }
}

/** `i/n` -> {index, total}, or null for anything else (1 <= i <= n). */
export function parseShard(s) {
  const m = /^(\d+)\/(\d+)$/.exec(String(s ?? ''));
  if (!m) return null;
  const index = Number(m[1]), total = Number(m[2]);
  return total >= 1 && index >= 1 && index <= total ? { index, total } : null;
}

/**
 * THE SPLIT. `files` into `n` shards by `times` (file -> ms; a file without one weighs the median of those given, or
 * 1 with none): longest first (ties by name), each onto the shard with the least time so far (ties to the lower
 * shard) - deterministic, so every job of one run computes the same split. Each shard's files come back longest first.
 * Pure.
 * @param {string[]} files @param {number} n @param {Record<string, number>} [times]
 * @returns {{files: string[], ms: number}[]}
 */
export function shardsOf(files, n, times = {}) {
  const known = files.map((f) => times[f]).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weight = (f) => (Number.isFinite(times[f]) && times[f] >= 0 ? times[f] : median);
  const order = [...new Set(files)].sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : a > b ? 1 : 0));
  const shards = Array.from({ length: Math.max(1, n | 0) }, () => ({ files: [], ms: 0 }));
  for (const f of order) {
    let best = 0;
    for (let k = 1; k < shards.length; k++) if (shards[k].ms < shards[best].ms) best = k;
    shards[best].files.push(f);
    shards[best].ms += weight(f);
  }
  return shards;
}

/**
 * FAST-SUITE (2026-10-04, Mac: "Our workflow is extremely slow"): HOW A LIST OF TEST FILES IS RUN - the one home `npm
 * test` (this file's `1/1`), a CI shard and `npm run test:changed` share. Two things, neither a test's business:
 *   - LONGEST FIRST (`shardsOf`'s own order, by the recorded times). `node --test "test/*.test.js"` took the files in
 *     name order, so the slowest - roadsReal, slam7, slam8, weather3a - started near the END and ran on alone while the
 *     other workers sat idle; started first, they run beside everything else.
 *   - EVERY CORE. Node's runner takes `availableParallelism() - 1` files at once by default, leaving a core to its own
 *     process, which only gathers the children's reports. Measured on a four-core machine over every twelfth file
 *     (185 files, 1628 tests): 140 s at the default three, 126 s at four.
 * The files run, and what each does, are unchanged: the same `test/*.test.js` set (`testFiles`), each in its own
 * process, every test in it. Answers the runner's exit status. `cores` and `spawn` are the machine's, a test's to stand in.
 *
 * AUDIT FAST-SUITE F7: the list rides the runner's COMMAND LINE, which `node --test "test/*.test.js"` never did (Node
 * expanded the glob itself) - 2,232 paths are ~59,000 characters, and Windows' CreateProcess takes 32,767. So where the
 * platform caps it (`budget`, win32's), the list runs in as few runners as fit, one after another, each longest first
 * in its turn; elsewhere it is one runner, as before. A runner that cannot start says why (it was a bare exit 1), and
 * `extra` - the runner's own flags a caller hands on (`npm test -- --test-name-pattern=...`) - rides every runner, after
 * this file's, so a caller's own `--test-concurrency` wins.
 *
 * CI-FAST (2026-10-19): and THE FAILURES NAMED (`summary`, on unless a caller says no): every runner reports twice to
 * stdout - the runner's own reporter, as it chose before (spec on a terminal, TAP elsewhere), and tools/failSummary.mjs,
 * which names each failing test at the end of the log, and on GitHub Actions as an annotation and in the job's summary.
 * A red shard said "# fail 2" and no more; its two names now stand at its end.
 *
 * CI-TIMES (2026-10-19): and THE TIMES RECORDED (`record`, a path - a CI shard's `--record`): the summary's reporter
 * (on for it whatever `summary` says) adds each file's wall time in this run to that JSON file (TEST_TIMES_RECORD,
 * tools/fileTimes.mjs) - every runner of a split list to the one file. The next run's shards are balanced by them
 * (verify.yml, test-times.yml).
 * @param {string[]} files
 */
export const WIN32_ARGV_BUDGET = 30000;
export function runTests(files, { root = ROOT, times = readTimes(root), cores = availableParallelism(), spawn = spawnSync, extra = [],
  budget = process.platform === 'win32' ? WIN32_ARGV_BUDGET : Infinity, summary = true, record = '' } = {}) {
  if (!files.length) return 0;
  const ordered = shardsOf(files, 1, times)[0].files;
  const head = ['--test', `--test-concurrency=${Math.max(1, cores | 0)}`, ...(summary || record ? summaryReporters(root) : []), ...extra];
  const env = record ? { ...process.env, TEST_TIMES_RECORD: resolve(record) } : undefined;
  const base = process.execPath.length + head.reduce((n, a) => n + a.length + 3, 0);   // a space and two quotes an argument
  const runs = [];
  let run = [], used = base;
  for (const f of ordered) {
    if (run.length && used + f.length + 3 > budget) { runs.push(run); run = []; used = base; }
    run.push(f); used += f.length + 3;
  }
  runs.push(run);
  let status = 0;
  for (const list of runs) {
    const r = spawn(process.execPath, [...head, ...list], { cwd: root, stdio: 'inherit', ...(env ? { env } : {}) });
    if (r.error) console.error(`[tests] the test runner did not start: ${r.error.message ?? r.error}`);
    const s = r.status ?? 1;
    if (s !== 0 && status === 0) status = s;
  }
  return status;
}

/** CI-FAST: the runner's two reporters - its own, as it would choose it (spec on a terminal, TAP elsewhere), and the
 *  failures' summary (tools/failSummary.mjs) - both to stdout. */
export const summaryReporters = (root = ROOT, tty = !!process.stdout.isTTY) => [
  `--test-reporter=${tty ? 'spec' : 'tap'}`, '--test-reporter-destination=stdout',
  `--test-reporter=${pathToFileURL(join(root, 'tools/failSummary.mjs')).href}`, '--test-reporter-destination=stdout',
];

/** AUDIT FAST-SUITE F7: the runner's own flags among a tool's arguments (`--test-name-pattern=x`, `--test-only`, ...),
 *  handed on to it; the tool's own (`--list`, `--base`) are not the runner's. */
export const runnerFlags = (argv) => argv.filter((a) => /^--test-[a-z-]+(=.*)?$/.test(a));

function main(argv) {
  if (argv[0] === '--plan') {
    const n = Number(argv[1]) || 4;
    const shards = shardsOf(testFiles(), n, readTimes());
    shards.forEach((s, k) => console.log(`shard ${k + 1}/${n}: ${s.files.length} files, ${(s.ms / 1000).toFixed(1)} s recorded`));
    return 0;
  }
  const shard = parseShard(argv[0]);
  if (!shard) { console.error('usage: node tools/testShards.mjs <i>/<n> [--list] [--record <times.json>] | --plan <n>'); return 2; }
  const times = readTimes();
  const { files } = shardsOf(testFiles(), shard.total, times)[shard.index - 1];
  if (argv.includes('--list')) { for (const f of files) console.log(f); return 0; }
  const at = argv.indexOf('--record'), record = at > 0 ? argv[at + 1] ?? '' : '';
  if (at > 0 && !record) { console.error('--record wants the file to write the times to'); return 2; }
  console.log(`shard ${shard.index}/${shard.total}: ${files.length} files (split by ${Object.keys(times).length} recorded times)`);
  return runTests(files, { times, extra: runnerFlags(argv.slice(1)), record });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));

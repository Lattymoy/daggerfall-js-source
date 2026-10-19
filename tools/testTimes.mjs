#!/usr/bin/env node
// FLOW1 (2026-09-26): THE SHARDS' WEIGHTS - each test file's own wall time (a fresh `node --test <file>`: its start, its
// imports and its tests), taken `--jobs` at a time and written to tools/testTimes.json for tools/testShards.mjs. Only
// the balance reads them: a stale or missing time never leaves a file out of a shard, it only places it less well. Run
// it again when the suite's shape moves (a new slow file, a slow file made fast).
//
//
// CI-TIMES (2026-10-19, Mac: "Do it"): the times are RECORDED BY CI now - every shard adds each of its files' wall time
// to a record (tools/fileTimes.mjs), and after a green run test-times.yml merges the eight onto the times that run was
// split by (`--merge`) and keeps them in the Actions cache, where the next run's shards read them (verify.yml). This
// tool's re-take stays for a machine of one's own.
//
//   npm run test:times                # every file, as many at a time as the machine has cores
//   node tools/testTimes.mjs --jobs 2
//   node tools/testTimes.mjs --merge <dir>   # the records under <dir> (*.json) onto tools/testTimes.json
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { testFiles, readTimes, TIMES_FILE } from './testShards.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * CI-TIMES: THE MERGE. Each of the suite's `files` takes its time from the records (a run's, file -> ms; a later record
 * over an earlier), else keeps the one `base` held, else has none (the split weighs it the median); a file no longer in
 * the suite is dropped. Sorted by file. Pure.
 * @param {Record<string, number>} base @param {Record<string, number>[]} records @param {string[]} files
 */
export function mergeTimes(base, records, files) {
  const ok = (v) => Number.isFinite(v) && v >= 0;
  const out = {};
  for (const f of [...new Set(files)].sort()) {
    let t = ok(base?.[f]) ? base[f] : undefined;
    for (const r of records) if (ok(r?.[f])) t = Math.round(r[f]);
    if (t !== undefined) out[f] = t;
  }
  return out;
}

/** `--merge`: every `*.json` record under `dir` (a folder an artifact, as the download lays them) onto `root`'s
 *  tools/testTimes.json, written back; what it did, counted. */
export function mergeDir(dir, root = ROOT) {
  const base = readTimes(root), files = testFiles(root);
  const records = readdirSync(dir, { recursive: true }).map((f) => String(f)).filter((f) => f.endsWith('.json')).sort().map((f) => {
    try { const t = JSON.parse(readFileSync(join(dir, f), 'utf8')); return t && typeof t === 'object' ? t : {}; } catch { return {}; }
  });
  const merged = mergeTimes(base, records, files);
  writeFileSync(join(root, TIMES_FILE), JSON.stringify(merged, null, 1) + '\n');
  const seen = new Set(records.flatMap((r) => Object.keys(r)));
  const recorded = Object.keys(merged).filter((f) => seen.has(f)).length;
  return { files: files.length, recorded, kept: Object.keys(merged).length - recorded, untimed: files.length - Object.keys(merged).length };
}

function timeOne(file) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const child = spawn(process.execPath, ['--test', file], { cwd: ROOT, stdio: 'ignore' });
    child.on('close', (code) => resolve({ file, ms: Math.round(Number(process.hrtime.bigint() - t0) / 1e6), code }));
  });
}

async function main(argv) {
  const m = argv.indexOf('--merge');
  if (m >= 0) {
    if (!argv[m + 1]) { console.error('usage: node tools/testTimes.mjs --merge <dir of records>'); process.exitCode = 2; return; }
    const r = mergeDir(argv[m + 1]);
    console.log(`${r.files} files: ${r.recorded} timed by the records, ${r.kept} kept from before, ${r.untimed} untimed - written to ${TIMES_FILE}`);
    return;
  }
  const at = argv.indexOf('--jobs');
  const jobs = Math.max(1, at >= 0 ? Number(argv[at + 1]) || 1 : availableParallelism());
  const files = testFiles();
  const times = {}, failed = [];
  let next = 0, done = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const r = await timeOne(f);
      times[r.file] = r.ms;
      if (r.code !== 0) failed.push(r.file);
      if (++done % 100 === 0) console.log(`${done}/${files.length}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const sorted = Object.fromEntries(Object.keys(times).sort().map((k) => [k, times[k]]));
  writeFileSync(join(ROOT, TIMES_FILE), JSON.stringify(sorted, null, 1) + '\n');
  const total = Object.values(times).reduce((a, b) => a + b, 0);
  console.log(`${files.length} files, ${(total / 1000).toFixed(0)} s of wall time in all, written to ${TIMES_FILE}`);
  if (failed.length) console.log(`(these failed while timed - their times stand all the same: ${failed.join(', ')})`);
}

if (isMain(import.meta.url)) main(process.argv.slice(2));

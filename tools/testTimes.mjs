#!/usr/bin/env node
// FLOW1 (2026-09-26): THE SHARDS' WEIGHTS - each test file's own wall time (a fresh `node --test <file>`: its start, its
// imports and its tests), taken `--jobs` at a time and written to tools/testTimes.json for tools/testShards.mjs. Only
// the balance reads them: a stale or missing time never leaves a file out of a shard, it only places it less well. Run
// it again when the suite's shape moves (a new slow file, a slow file made fast).
//
//   npm run test:times                # every file, as many at a time as the machine has cores
//   node tools/testTimes.mjs --jobs 2
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { testFiles, TIMES_FILE } from './testShards.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function timeOne(file) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const child = spawn(process.execPath, ['--test', file], { cwd: ROOT, stdio: 'ignore' });
    child.on('close', (code) => resolve({ file, ms: Math.round(Number(process.hrtime.bigint() - t0) / 1e6), code }));
  });
}

async function main(argv) {
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

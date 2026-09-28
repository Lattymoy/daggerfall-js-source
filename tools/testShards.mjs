#!/usr/bin/env node
// FLOW1 (2026-09-26, Mac: "is there a way to really ensure we have a faster workflow with the same standards?"): THE
// SUITE IN SHARDS, BALANCED. CI ran the whole suite in one job - 1,300 files, ~6 minutes on a four-core runner - and ran
// it twice in a row, the PR's check and again on main before the deploy. Now the files are split into N shards by their
// recorded times (tools/testTimes.json, written by `npm run test:times`): the longest first, each onto the lightest shard,
// so every shard finishes near the others and the N jobs run at once. EVERY FILE IS IN EXACTLY ONE SHARD (the pin,
// test/flow1_ci.test.js, holds it): a file with no recorded time weighs the median, so a new test file is never left
// out - at worst it is placed a little less well until the times are taken again. Inside a shard `node --test` is
// handed its files longest first, so its workers start on the long ones.
//
//   node tools/testShards.mjs 2/4            # run shard 2 of 4 (what CI runs)
//   node tools/testShards.mjs 2/4 --list     # print its files, one a line
//   node tools/testShards.mjs --plan 4       # each shard's file count and recorded seconds
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TIMES_FILE = 'tools/testTimes.json';

/** The suite's files, as `npm test` globs them (`test/*.test.js`), sorted. */
export function testFiles(root = ROOT) {
  return readdirSync(join(root, 'test')).filter((f) => f.endsWith('.test.js')).sort().map((f) => `test/${f}`);
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

function main(argv) {
  if (argv[0] === '--plan') {
    const n = Number(argv[1]) || 4;
    const shards = shardsOf(testFiles(), n, readTimes());
    shards.forEach((s, k) => console.log(`shard ${k + 1}/${n}: ${s.files.length} files, ${(s.ms / 1000).toFixed(1)} s recorded`));
    return 0;
  }
  const shard = parseShard(argv[0]);
  if (!shard) { console.error('usage: node tools/testShards.mjs <i>/<n> [--list] | --plan <n>'); return 2; }
  const { files } = shardsOf(testFiles(), shard.total, readTimes())[shard.index - 1];
  if (argv.includes('--list')) { for (const f of files) console.log(f); return 0; }
  console.log(`shard ${shard.index}/${shard.total}: ${files.length} files`);
  if (!files.length) return 0;
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));

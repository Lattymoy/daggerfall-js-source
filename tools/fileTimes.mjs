// CI-TIMES (2026-10-19, Mac: "Do it" - the shards' times recorded by CI): EACH TEST FILE'S WALL TIME, TAKEN WHERE IT
// RUNS. The shards are balanced by tools/testTimes.json, and `npm run test:times` re-took it by running every file
// again on its own - 500 of 3,557 files in an hour, so it was rarely run, and 1,327 files stood at the median and the
// shards ran 6.7 to 13.6 minutes. The runner already reports one event a FILE - the file's own `test:complete` at
// nesting 0, named the path it was given, from its process's start to its end (its imports and every test in it). The
// run's summary reporter (tools/failSummary.mjs - one reporter more trips Node's listener warning) keeps those, and once
// the run ends adds them to the JSON file named by TEST_TIMES_RECORD (file -> ms, a path as the repository holds it):
// taken in the run that matters - a CI shard, every core busy - not on a quiet machine.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoPath } from './failSummary.mjs';

/** The runner's event for a whole FILE: nesting 0, its name the file's own path (a test is named by its author). */
export const fileEvent = (data, cwd = process.cwd()) => data?.nesting === 0 && !!data.file
  && repoPath(data.file, cwd) === repoPath(resolve(cwd, String(data.name ?? '')), cwd);

/** A runner event's file time - `[file, ms]` for a file's own `test:complete`, else null. */
export function fileTimeOf(ev, cwd = process.cwd()) {
  if (ev?.type !== 'test:complete' || !fileEvent(ev.data, cwd)) return null;
  const ms = ev.data.details?.duration_ms;
  return Number.isFinite(ms) && ms >= 0 ? [repoPath(ev.data.file, cwd), Math.round(ms)] : null;
}

/** `times` (file -> ms) added to the JSON file at `path` - what it held kept, a file timed again replaced - sorted. */
export function addTimes(path, times) {
  let held = {};
  if (existsSync(path)) { try { const t = JSON.parse(readFileSync(path, 'utf8')); if (t && typeof t === 'object') held = t; } catch { /* a broken record is written afresh */ } }
  const all = { ...held, ...times };
  writeFileSync(path, JSON.stringify(Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]])), null, 1) + '\n');
}

// What is left of the manifest gate after LEGIBLE 1b (bible/01-Overview/Readability-Arc.md).
//
// Until 2026-10-19 this file failed the suite unless bible/09-Testing/Testing.md carried one row per test file, each
// with that file's test count, and one line with the suite's total. Every pull request that added a test edited that
// line, so any two of them conflicted on it, and the rows mostly repeated what the test files' own titles say. The
// table is closed and kept as a record in bible/09-Testing/Testing-Rows-2026-10-19.md; what this file still holds:
//
// - Test file names stay unique. The bible names a test by its file name alone (`hostceiling.test.js`), so two files
//   with one name would make every such mention ambiguous.
// - Testing.md does not grow a file table again.
// - The closed table stays closed: it keeps exactly the rows it closed with. Its cites into our code are still kept
//   true by `npm run cites`, like every other page's, so it is held by its rows, not by its bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTING = 'bible/09-Testing/Testing.md';
const CLOSED_TABLE = 'bible/09-Testing/Testing-Rows-2026-10-19.md';
/** The rows the table held on the day it closed. */
const CLOSED_ROW_COUNT = 3_571;
/** A row of the file table: `| name.test.js | count | ...`. */
const TABLE_ROW = /^\| [^ |]+\.test\.js \| \d+ \|/gm;

const read = (path) => readFileSync(join(root, path), 'utf8');

test('manifest: no two test files share a name - the bible names a test by its file name alone', () => {
  const names = readdirSync(join(root, 'test'), { recursive: true })
    .filter((path) => path.endsWith('.test.js'))
    .map((path) => path.split(/[\\/]/).pop());
  const twice = names.filter((name, i) => names.indexOf(name) !== i);
  assert.ok(names.length > 1000, `only ${names.length} test files found - the walk is reading the wrong tree`);
  assert.deepEqual(twice, [], 'two test files share a name - a mention of it in the bible could mean either');
});

test('manifest: Testing.md carries no file table and no suite total - a test file describes itself, and the suite counts itself (LEGIBLE 1b)', () => {
  const page = read(TESTING);
  assert.deepEqual(page.match(TABLE_ROW) ?? [], [], 'Testing.md has a file-table row again');
  assert.doesNotMatch(page, /Suite: \d+ tests across \d+ files\./, 'Testing.md has a suite total again');
});

test('manifest: the closed file table keeps exactly the 3,571 rows it closed with - it is a record, and nothing adds to it (LEGIBLE 1b)', () => {
  const rows = read(CLOSED_TABLE).match(TABLE_ROW) ?? [];
  assert.equal(rows.length, CLOSED_ROW_COUNT, `${CLOSED_TABLE} holds ${rows.length} rows, not the ${CLOSED_ROW_COUNT} it closed with`);
});

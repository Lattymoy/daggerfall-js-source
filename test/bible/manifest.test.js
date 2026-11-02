// The manifest gate: test file names stay unique (the bible names a test by its file name alone, so two files with
// one name would make every such mention ambiguous), and Testing.md does not grow a file table again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTING = 'bible/09-Testing/Testing.md';
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


import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Drift guard: the suite counts documented in bible/09-Testing/Testing.md
// must match the real suite. Counts tests as top-of-line `test(` calls,
// exactly how they are written in this repo. If this fails, someone added or
// removed a test without updating the bible - fix the doc, not the guard.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('manifest: Testing.md pins the real suite', () => {
  const testDir = join(root, 'test');
  const files = readdirSync(testDir)
    .filter((f) => f.endsWith('.test.js'))
    .sort();

  const perFile = new Map();
  let total = 0;
  for (const f of files) {
    const src = readFileSync(join(testDir, f), 'utf8');
    const count = (src.match(/^test\(/gm) || []).length;
    perFile.set(f, count);
    total += count;
  }

  const doc = readFileSync(join(root, 'bible/09-Testing/Testing.md'), 'utf8');

  // V1: NO UNRESOLVED MERGE, and only ONE Suite line. Both halves are
  // here because the manifest gate let a real defect through: a merge
  // resolved with a regex that collapsed only the FIRST conflict block
  // left four marker lines and THREE Suite lines in the committed doc,
  // and this test passed anyway - `match` returns the first hit, which
  // happened to be the correct one. The count agreeing says nothing
  // about the file being intact.
  const markers = doc.match(/^(<<<<<<<|>>>>>>>|=======)/gm) || [];
  assert.deepEqual(markers, [], 'Testing.md carries unresolved merge markers');
  const suiteLines = doc.match(/Suite: \d+ tests across \d+ files\./g) || [];
  assert.equal(suiteLines.length, 1, `Testing.md has ${suiteLines.length} Suite lines, expected exactly 1`);

  // Total line: "Suite: N tests across M files."
  const totalMatch = doc.match(/Suite: (\d+) tests across (\d+) files\./);
  assert.ok(totalMatch, 'Testing.md is missing the "Suite: N tests across M files." line');
  assert.equal(Number(totalMatch[1]), total, 'Testing.md total test count drifted');
  assert.equal(Number(totalMatch[2]), files.length, 'Testing.md file count drifted');

  // Per-file table rows: "| name.test.js | N | ..."
  for (const [f, count] of perFile) {
    const rows = [...doc.matchAll(new RegExp(`^\\| ${f.replace('.', '\\.')} \\| (\\d+) \\|`, 'gm'))];
    assert.ok(rows.length, `Testing.md table is missing a row for ${f}`);
    // MERGE AUDIT: matchAll, not match. `String.match` without /g
    // returns the FIRST hit only, so a SECOND, retired row for the
    // same file sat in this table describing a suite that no longer
    // existed and the guard read straight past it - green doc, wrong
    // doc. A subject gets ONE row (the project's own "retiring a row
    // strikes the row" rule); a struck row is prose, not a table row.
    assert.equal(rows.length, 1, `Testing.md has ${rows.length} rows for ${f} - one subject, one row`);
    assert.equal(Number(rows[0][1]), count, `Testing.md count for ${f} drifted`);
  }

  // ... and the rows must account for every file and no others: a row
  // for a DELETED suite is the same drift from the other side, and it
  // is invisible to the loop above, which only ever asks about files
  // that still exist.
  const rowNames = [...doc.matchAll(/^\| ([a-zA-Z0-9_]+\.test\.js) \| \d+ \|/gm)].map((m) => m[1]);
  const orphans = rowNames.filter((n) => !perFile.has(n));
  assert.deepEqual(orphans, [], 'Testing.md has rows for suites that no longer exist');
  assert.equal(rowNames.length, files.length, 'Testing.md row count drifted from the real file count');
});

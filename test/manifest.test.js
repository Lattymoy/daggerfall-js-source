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

  // Total line: "Suite: N tests across M files."
  const totalMatch = doc.match(/Suite: (\d+) tests across (\d+) files\./);
  assert.ok(totalMatch, 'Testing.md is missing the "Suite: N tests across M files." line');
  assert.equal(Number(totalMatch[1]), total, 'Testing.md total test count drifted');
  assert.equal(Number(totalMatch[2]), files.length, 'Testing.md file count drifted');

  // Per-file table rows: "| name.test.js | N | ..."
  for (const [f, count] of perFile) {
    const row = doc.match(new RegExp(`\\| ${f.replace('.', '\\.')} \\| (\\d+) \\|`));
    assert.ok(row, `Testing.md table is missing a row for ${f}`);
    assert.equal(Number(row[1]), count, `Testing.md count for ${f} drifted`);
  }
});

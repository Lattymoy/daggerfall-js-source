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

test('manifest: a row whose COUNT moved says what its new pins hold', () => {
  // The guard above is a NUMBER guard, and that is exactly the hole
  // ledger.test.js's header describes from the other side: rows "wrong
  // in their NUMBERS rather than their substance... Prose cannot notice
  // that, and it is the drift that most misleads." Here it ran the
  // other way. One wave moved nine counts and left nine Covers cells
  // byte-identical, so the table went on describing the pre-wave
  // suites - nativetalk's row still described two tests while the file
  // held eight - and one row (encounterplace) kept a "NOT WIRED"
  // sentence the suite it describes now forbids.
  //
  // A Covers cell is prose and cannot be derived. What CAN be held is
  // that a row names the law its NEWEST pins hold, and that no row
  // states the negation of one. Both halves below are two-way: rip the
  // pin out of the suite and the second list fails; revert the row and
  // the first does.
  const doc = readFileSync(join(root, 'bible/09-Testing/Testing.md'), 'utf8');
  const row = (f) => {
    const hit = doc.split('\n').find((l) => l.startsWith(`| ${f} | `));
    assert.ok(hit, `Testing.md is missing a row for ${f}`);
    return hit;
  };
  const NAMES = [
    ['mysticism.test.js', [/GetArtifactTextureIndices/, /castBySkeletonKey/]],
    ['cityguards.test.js', [/placeFoeFreely/, /SPAWNER_ARMS\.cityGuards/]],
    ['nativetalk.test.js', [/UpdateQuestion runs on SELECTION/, /GetPortraitIndexFromStaticNPCBillboard/, /SetPerson/]],
    ['books.test.js', [/GlyphHeight/, /FontPrefix names a FontName/]],
    ['enchantcast.test.js', [/instant held effect fires EVERY magic round/]],
    ['spellbookwindow.test.js', [/SpellBookDescription/]],
    ['hudlarge.test.js', [/horseOffsetHeight/, /weaponOffsetHeight/]],
    ['enemyspells.test.js', [/KEEPS SelectedSpell/]],
    ['audit24_wave35.test.js', [/CurrentMagicka > 0, NOT CanCastRangedSpell/]],
    ['encounterplace.test.js', [/SpawnCityGuards \(:687\) is WIRED as of D9/]],
  ];
  const silent = [];
  for (const [f, names] of NAMES) {
    const cell = row(f);
    for (const n of names) if (!n.test(cell)) silent.push(`${f}: the row never names ${n}`);
  }
  assert.deepEqual(silent, [], 'a row grew by a numeral and did not say what the new pins hold');

  // ...and the retired claim may not stand. EF1c's rule holds here as
  // everywhere: the row may QUOTE what it retired (this one does), so
  // the ban is on the sentence as an assertion.
  assert.equal(/SpawnCityGuards is carried in the table and NOT WIRED/.test(row('encounterplace.test.js')), false,
    'the encounterplace row states the opposite of the suite it describes');

  // the other half: every law named above is really in its suite.
  const suite = (f) => readFileSync(join(root, 'test', f), 'utf8');
  const IN_SUITE = [
    ['mysticism.test.js', /castBySkeletonKey\(/],
    ['cityguards.test.js', /spot = placeFoeFreely\\\(env, SPAWNER_ARMS\\\.cityGuards\\\);/],
    ['nativetalk.test.js', /portraitIndexFromStaticNPCBillboard\(/],
    ['books.test.js', /placeBookLabels\(/],
    ['enchantcast.test.js', /INSTANT held effect fires EVERY magic round/],
    ['spellbookwindow.test.js', /spellBookDescriptionId\(/],
    ['hudlarge.test.js', /horseOffsetHeight\(/],
    ['enemyspells.test.js', /the tick KEEPS SelectedSpell/],
    ['audit24_wave35.test.js', /hasMagickaToCast/],
    ['encounterplace.test.js', /SPAWNER_ARMS\.cityGuards/],
  ];
  for (const [f, re] of IN_SUITE) {
    assert.match(suite(f), re, `Testing.md credits ${f} with a law its suite does not hold`);
  }
});

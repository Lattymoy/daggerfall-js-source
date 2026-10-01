// GROWTH1 (2026-10-01, Mac: "bible cleanup", then "Growth rules") - THE
// BIBLE'S INDEXES STOP GROWING INTO ESSAYS (tools/bibleGrowth.mjs). Nothing
// existing was removed: a Testing.md row, an Active-Arcs block or a dated
// page longer than its cap on the day is frozen at its length in
// tools/bibleGrowth.json, and what comes after is held to the cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  measure, readRecord, growthProblems, loweredRecord, recordText, rowLengths, arcsParts, isDatedPage, main,
  ROW_MAX, ENTRY_MAX, PAGE_MAX, MARKER, RECORD_FILE, TESTING, ACTIVE_ARCS, DATED_DIR,
} from '../tools/bibleGrowth.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('GROWTH1: the bible holds its growth rules - no row, entry or dated page past its cap or its frozen length, and nothing stale in the record', () => {
  const measured = measure();
  assert.ok(measured.rows.size > 1000, `Testing.md's rows were read (${measured.rows.size})`);
  assert.ok(measured.arcs, 'Active-Arcs.md carries its GROWTH1 marker');
  assert.ok(measured.arcs.above.length >= 1 && measured.arcs.below > 100 * 1024, 'an entry above it, and the frozen block below');
  assert.ok(measured.dated.size > 100, `the dated pages were read (${measured.dated.size})`);
  const record = readRecord();
  assert.ok(Object.keys(record.testingRows).length > 500 && Object.keys(record.datedPages).length > 5, 'the record is the one written on the day');
  assert.deepEqual(growthProblems(measured, record), []);
  assert.equal(rd(RECORD_FILE), recordText(record), 'the record reads as the tool writes it');
});

test('GROWTH1: the rules, on a bible made up for them - a cap for the new, a frozen length for the old, and the record letting go of what came within its cap', () => {
  const rows = new Map([['at-cap.test.js', ROW_MAX], ['new.test.js', ROW_MAX + 1], ['old.test.js', 5000], ['shrunk.test.js', 900], ['edge.test.js', ROW_MAX]]);
  const arcs = { above: ['- a short entry', `- ${'x'.repeat(ENTRY_MAX - 2)}`], below: 500 };
  const dated = new Map([['Field-Bugs-2026-10-02.md', PAGE_MAX], ['Audit-99.md', PAGE_MAX + 1], ['Field-Bugs-2026-09-23.md', 98356], ['Audit-24.md', 20000]]);
  const record = {
    testingRows: { 'old.test.js': 5000, 'shrunk.test.js': 1500, 'edge.test.js': 1200, 'gone.test.js': 2000 },
    activeArcsBelow: 500,
    datedPages: { 'Field-Bugs-2026-09-23.md': 98356, 'Audit-24.md': 40000 },
  };
  const said = growthProblems({ rows, arcs, dated }, record);
  assert.equal(said.length, 6, said.join('\n'));
  assert.match(said[0], /^Testing\.md's new\.test\.js row is 1001 characters - at most 1000/, 'a new row past the cap');
  assert.match(said[1], /freezes Testing\.md's shrunk\.test\.js row, which is 900 now - within its cap: run node tools\/bibleGrowth\.mjs --write/);
  assert.match(said[2], /freezes Testing\.md's edge\.test\.js row, which is 1000 now/, 'AT the cap is within it');
  assert.match(said[3], /freezes Testing\.md's gone\.test\.js row, which is gone/);
  assert.match(said[4], /^Audit-99\.md is 32769 bytes - a dated page is at most 32768/, 'a new page past the cap');
  assert.match(said[5], /freezes Audit-24\.md, which is 20000 now - within its cap/);
  // the old may shrink but never grow; the new may not pass the cap
  const grown = growthProblems({ rows: new Map([['old.test.js', 5001]]), arcs: { above: [`- ${'x'.repeat(ENTRY_MAX - 1)}`], below: 501 }, dated: new Map([['Field-Bugs-2026-09-23.md', 98357]]) },
    { testingRows: { 'old.test.js': 5000 }, activeArcsBelow: 500, datedPages: { 'Field-Bugs-2026-09-23.md': 98356 } });
  assert.equal(grown.length, 4, grown.join('\n'));
  assert.match(grown[0], /old\.test\.js row grew to 5001 characters - it is frozen at 5000: rewrite it to say what the file pins now, shorter, never appended to/);
  assert.match(grown[1], /^an Active-Arcs entry is 701 characters - at most 700/);
  assert.match(grown[2], /below the GROWTH1 marker grew to 501 characters, frozen at 500 - a new entry goes above the marker/);
  assert.match(grown[3], /^Field-Bugs-2026-09-23\.md grew to 98357 bytes - it is frozen at 98356: the batch's next part starts its own page/);
  assert.deepEqual(growthProblems({ rows: new Map([['old.test.js', 10]]), arcs: { above: [], below: 1 }, dated: new Map() },
    { testingRows: {}, activeArcsBelow: 500, datedPages: {} }), [], 'shrinking is always allowed');
  assert.deepEqual(growthProblems({ rows: new Map(), arcs: null, dated: new Map() }, { testingRows: {}, activeArcsBelow: 0, datedPages: {} }),
    ['bible/01-Overview/Active-Arcs.md has lost its GROWTH1 marker - the new entries stand above it']);
  // --write lowers, lets go, and never raises or adds
  const lowered = loweredRecord(
    { rows: new Map([['old.test.js', 4000], ['risen.test.js', 3000], ['shrunk.test.js', 900], ['new.test.js', 5000]]), arcs: { above: [], below: 450 }, dated: new Map([['Audit-61.md', 50000], ['Audit-62.md', 1000]]) },
    { testingRows: { 'old.test.js': 5000, 'risen.test.js': 2000, 'shrunk.test.js': 1500, 'gone.test.js': 2000 }, activeArcsBelow: 500, datedPages: { 'Audit-61.md': 60000, 'Audit-62.md': 40000 } });
  assert.deepEqual(lowered, { testingRows: { 'old.test.js': 4000, 'risen.test.js': 2000 }, activeArcsBelow: 450, datedPages: { 'Audit-61.md': 50000 } });
  assert.equal(loweredRecord({ rows: new Map(), arcs: { above: [], below: 900 }, dated: new Map() }, { testingRows: {}, activeArcsBelow: 500, datedPages: {} }).activeArcsBelow, 500, 'never raised');
  assert.equal(recordText({ testingRows: { 'b.test.js': 2, 'a.test.js': 1 }, activeArcsBelow: 7, datedPages: {} }),
    '{\n  "testingRows": {\n    "a.test.js": 1,\n    "b.test.js": 2\n  },\n  "activeArcsBelow": 7,\n  "datedPages": {}\n}\n', 'one frozen thing to a line, sorted');
});

test('GROWTH1: what it measures - a row\'s Covers cell, the entries above the marker and the block below it, the dated pages and not the indexes', () => {
  const rows = rowLengths('| File | Tests | Covers |\n|---|---|---|\n| a.test.js | 3 | pins it |\n| b.test.js | 12 | x |\nnot a row | a.test.js | 1 | y |\n');
  assert.deepEqual([...rows], [['a.test.js', 9], ['b.test.js', 3]]);
  const parts = arcsParts(`# Active arcs\n\nOne line per arc.\n\n- new one\n- new two\n${MARKER} (2026-10-01): ... -->\n- old one\n- old two`);
  assert.deepEqual(parts, { above: ['- new one', '- new two'], below: '- old one\n- old two'.length });
  assert.equal(arcsParts('# Active arcs\n- an entry\n'), null);
  for (const page of ['Field-Bugs-2026-10-01.md', 'Field-Bugs-2026-09-27-field-console.md', 'Audit-61.md', 'Audit-Install.md', 'Mac-Bugs-T.md', 'Janome-Bugs.md', 'Mac-Bugs.md', 'Handoff-FixPackage2.md', 'Port-Status-2026-09.md', 'Incident-2026-09-01.md', 'Bible-Review-2026-08-25.md']) {
    assert.ok(isDatedPage(page), `${page} is a dated page`);
  }
  for (const page of ['Audit-Log.md', 'Active-Arcs.md', 'Port-Ledger.md', 'Desktop-App.md', 'Audit-61.txt', 'Mac-Bugs']) {
    assert.ok(!isDatedPage(page), `${page} is not`);
  }
});

test('GROWTH1: the rules are written where they bind, in the tool\'s own numbers - Home.md\'s Process, Testing.md over its table, the marker, CLAUDE.md', () => {
  const n = (x) => x.toLocaleString('en-US');
  const home = rd('bible/Home.md');
  const rule = home.slice(home.indexOf('THE BIBLE GROWS BY ITS RECORDS, NOT ITS INDEXES (GROWTH1'), home.indexOf('\n## Sections'));
  assert.ok(rule.length > 100, 'Home.md\'s Process states the rule');
  for (const said of [`at most ${ENTRY_MAX} characters`, `in at most ${n(ROW_MAX)}`, `at most ${PAGE_MAX / 1024} KB`, 'tools/bibleGrowth.json', 'test/growth1_bible.test.js']) {
    assert.ok(rule.replace(/\s+/g, ' ').includes(said), `Home.md's rule says "${said}"`);
  }
  const testing = rd('bible/09-Testing/Testing.md');
  const overTable = testing.slice(0, testing.indexOf('| File | Tests | Covers |')).replace(/\s+/g, ' ');
  assert.ok(overTable.includes(`GROWTH1 (2026-10-01, Mac: "Growth rules"): a row says what its file pins NOW, in at most ${n(ROW_MAX)} characters`), 'Testing.md says it over its table');
  const marker = rd('bible/01-Overview/Active-Arcs.md').split('\n').find((l) => l.startsWith(MARKER));
  assert.ok(marker?.includes(`each at most ${ENTRY_MAX} characters`), 'the marker says the cap the entries above it are held to');
  const claude = rd('CLAUDE.md').replace(/\s+/g, ' ');
  for (const said of [`at most ${ENTRY_MAX} characters`, `a Testing.md row at most ${n(ROW_MAX)}`, `at most ${PAGE_MAX / 1024} KB`]) {
    assert.ok(claude.includes(said), `CLAUDE.md says "${said}"`);
  }
});

test('GROWTH1: the command - spawned over the bible as it stands, and run over a made-up one that breaks a rule, mends it and lowers its record', () => {
  const tool = fileURLToPath(new URL('../tools/bibleGrowth.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, 'the bible holds its growth rules\n');
  const root = mkdtempSync(join(tmpdir(), 'growth1-'));
  const said = [];
  const { log, error } = console;
  try {
    mkdirSync(join(root, DATED_DIR), { recursive: true });
    mkdirSync(join(root, 'bible/09-Testing'), { recursive: true });
    mkdirSync(join(root, 'tools'), { recursive: true });
    const testing = (fresh) => writeFileSync(join(root, TESTING), `| File | Tests | Covers |\n|---|---|---|\n| old.test.js | 9 | ${'o'.repeat(1500)} |\n| new.test.js | 1 | ${'n'.repeat(fresh)} |\n`);
    testing(ROW_MAX);   // its cell is the text and " |": two past the cap
    writeFileSync(join(root, ACTIVE_ARCS), `# Active arcs\n\n- new\n${MARKER} -->\n- old\n`);
    writeFileSync(join(root, DATED_DIR, 'Field-Bugs-2026-10-02.md'), '# small\n');
    writeFileSync(join(root, RECORD_FILE), recordText({ testingRows: { 'old.test.js': 1600 }, activeArcsBelow: 6, datedPages: {} }));
    console.log = (line) => said.push(line);
    console.error = (line) => said.push(line);
    assert.equal(main([], root), 1, 'a rule broken: the check fails');
    assert.match(said.join('\n'), /new\.test\.js row is 1002 characters - at most 1000/);
    testing(ROW_MAX - 2);
    said.length = 0;
    assert.equal(main([], root), 0, 'mended, it passes');
    assert.deepEqual(said, ['the bible holds its growth rules']);
    assert.equal(main(['--write'], root), 0);
    assert.deepEqual(readRecord(root), { testingRows: { 'old.test.js': 1502 }, activeArcsBelow: 6, datedPages: {} }, 'the shrunk row\'s record lowered to it');
  } finally {
    console.log = log;
    console.error = error;
    rmSync(root, { recursive: true, force: true });
  }
});

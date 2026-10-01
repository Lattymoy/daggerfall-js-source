#!/usr/bin/env node
// GROWTH1 (2026-10-01, Mac: "bible cleanup", then "Growth rules"): THE
// BIBLE'S INDEXES STOP GROWING INTO ESSAYS. The bible was 16 MB, and most
// of it was not records but the ways into them: Testing.md's rows (3.5 MB -
// a median row of 1,361 characters, the longest 53,335, each slice
// appending its history to the row of every file it touched),
// Active-Arcs.md's entries (708 KB - "one line per arc", grown into
// essays one slice at a time; its longest line 55,717 characters), and a
// dated page for every batch of field bugs and every audit (119 pages,
// some of them 100 KB). Nothing existing is removed here; what is there is
// FROZEN at its length, and what comes next is held to a cap:
//
//   - a Testing.md row's Covers cell is at most ROW_MAX characters - what
//     the file pins NOW; history is the arc page's and git's. A row
//     already longer is frozen at its length: rewritten shorter, never
//     longer.
//   - an Active-Arcs entry above the GROWTH1 marker is at most ENTRY_MAX
//     characters - the page, the tag, the date, the change; the page is
//     the record. Everything below the marker is frozen as a whole.
//   - a dated page in 01-Overview (a field-bug batch, an audit, a bug
//     list, a handoff, a status snapshot) is at most PAGE_MAX bytes; a
//     bigger one is frozen at its size. A batch that outgrows its page
//     starts the next one (Field-Bugs-2026-10-01b.md).
//
// The frozen numbers are tools/bibleGrowth.json. test/growth1_bible.test.js
// holds the bible to them both ways: a frozen row or page that has come
// within its cap, or is gone, must leave the record.
//
//   node tools/bibleGrowth.mjs           what breaks the rules - exit 1 if anything
//   node tools/bibleGrowth.mjs --write   lower the record to the bible as it stands (never raises, never adds)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const RECORD_FILE = 'tools/bibleGrowth.json';
export const TESTING = 'bible/09-Testing/Testing.md';
export const ACTIVE_ARCS = 'bible/01-Overview/Active-Arcs.md';
export const DATED_DIR = 'bible/01-Overview';

/** A Testing.md row's Covers cell, at most, in characters. */
export const ROW_MAX = 1000;
/** An Active-Arcs entry above the marker, at most, in characters. */
export const ENTRY_MAX = 700;
/** A dated page, at most, in bytes. */
export const PAGE_MAX = 32 * 1024;

/** The Active-Arcs line the new entries stand above. */
export const MARKER = '<!-- GROWTH1';

/** A dated record page - Audit-Log.md is the index of audits, not one. */
export const isDatedPage = (name) =>
  /^(?:Field-Bugs|Mac-Bugs|Janome-Bugs|Audit|Handoff|Port-Status|Incident|Bible-Review)(?:-.+)?\.md$/.test(name) && name !== 'Audit-Log.md';

/** Testing.md's rows: file -> the length of its Covers cell. */
export function rowLengths(text) {
  const rows = new Map();
  for (const m of String(text).matchAll(/^\| ([a-zA-Z0-9_]+\.test\.js) \| \d+ \| (.*)$/gm)) rows.set(m[1], m[2].length);
  return rows;
}

/** Active-Arcs.md: the entries above the marker, and the length of everything below it - null without a marker. */
export function arcsParts(text) {
  const lines = String(text).split('\n');
  const at = lines.findIndex((l) => l.startsWith(MARKER));
  if (at < 0) return null;
  return { above: lines.slice(0, at).filter((l) => l.startsWith('- ')), below: lines.slice(at + 1).join('\n').length };
}

/** The bible's three measures, read from `root`. */
export function measure(root = ROOT) {
  const dir = join(root, DATED_DIR);
  return {
    rows: rowLengths(readFileSync(join(root, TESTING), 'utf8')),
    arcs: arcsParts(readFileSync(join(root, ACTIVE_ARCS), 'utf8')),
    dated: new Map(readdirSync(dir).filter(isDatedPage).sort().map((name) => [name, statSync(join(dir, name)).size])),
  };
}

/** The record, or an empty one. */
export function readRecord(root = ROOT) {
  const p = join(root, RECORD_FILE);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { testingRows: {}, activeArcsBelow: 0, datedPages: {} };
}

/** Each frozen thing that is gone or has come within its cap - the record must let it go. */
function stale(frozen, now, cap, what) {
  const out = [];
  for (const name of Object.keys(frozen)) {
    const size = now.get(name);
    if (size === undefined || size <= cap) {
      out.push(`${RECORD_FILE} freezes ${what(name)}, which ${size === undefined ? 'is gone' : `is ${size} now - within its cap`}: run node tools/bibleGrowth.mjs --write`);
    }
  }
  return out;
}

/** What the bible breaks of the growth rules, against the record - [] when nothing. */
export function growthProblems({ rows, arcs, dated }, record) {
  const problems = [];
  const frozenRows = record.testingRows ?? {};
  for (const [file, len] of rows) {
    const frozen = Object.hasOwn(frozenRows, file);
    const cap = frozen ? frozenRows[file] : ROW_MAX;
    if (len <= cap) continue;
    problems.push(frozen
      ? `Testing.md's ${file} row grew to ${len} characters - it is frozen at ${cap}: rewrite it to say what the file pins now, shorter, never appended to`
      : `Testing.md's ${file} row is ${len} characters - at most ${ROW_MAX}: what the file pins now, not its history`);
  }
  problems.push(...stale(frozenRows, rows, ROW_MAX, (f) => `Testing.md's ${f} row`));
  if (!arcs) {
    problems.push(`${ACTIVE_ARCS} has lost its GROWTH1 marker - the new entries stand above it`);
  } else {
    for (const entry of arcs.above) {
      if (entry.length > ENTRY_MAX) {
        problems.push(`an Active-Arcs entry is ${entry.length} characters - at most ${ENTRY_MAX}: the page, the tag, the date and the change; the page is the record ("${entry.slice(0, 72)}...")`);
      }
    }
    if (arcs.below > record.activeArcsBelow) {
      problems.push(`the Active-Arcs entries below the GROWTH1 marker grew to ${arcs.below} characters, frozen at ${record.activeArcsBelow} - a new entry goes above the marker, and an old one is never added to`);
    }
  }
  const frozenPages = record.datedPages ?? {};
  for (const [name, size] of dated) {
    const frozen = Object.hasOwn(frozenPages, name);
    const cap = frozen ? frozenPages[name] : PAGE_MAX;
    if (size <= cap) continue;
    problems.push(frozen
      ? `${name} grew to ${size} bytes - it is frozen at ${cap}: the batch's next part starts its own page`
      : `${name} is ${size} bytes - a dated page is at most ${PAGE_MAX}: the batch's next part starts its own page`);
  }
  problems.push(...stale(frozenPages, dated, PAGE_MAX, (n) => n));
  return problems;
}

/** The record lowered to the bible as it stands: every frozen number brought down to what it is now, a
 *  frozen thing gone or within its cap let go - never raised, and nothing new ever frozen. */
export function loweredRecord({ rows, arcs, dated }, record) {
  const lower = (frozen, now, cap) => Object.fromEntries(Object.entries(frozen ?? {})
    .filter(([name]) => now.has(name) && now.get(name) > cap)
    .map(([name, was]) => [name, Math.min(was, now.get(name))]));
  return {
    testingRows: lower(record.testingRows, rows, ROW_MAX),
    activeArcsBelow: arcs ? Math.min(record.activeArcsBelow, arcs.below) : record.activeArcsBelow,
    datedPages: lower(record.datedPages, dated, PAGE_MAX),
  };
}

/** The record as JSON - one frozen thing to a line, so a diff of it reads. */
export function recordText(record) {
  const block = (o) => {
    const keys = Object.keys(o).sort();
    return keys.length ? `{\n${keys.map((k) => `    ${JSON.stringify(k)}: ${o[k]}`).join(',\n')}\n  }` : '{}';
  };
  return `{\n  "testingRows": ${block(record.testingRows)},\n  "activeArcsBelow": ${record.activeArcsBelow},\n  "datedPages": ${block(record.datedPages)}\n}\n`;
}

/** The command, over the bible at `root`: 0 when it holds its rules, 1 when not; `--write` lowers the record. */
export function main(argv, root = ROOT) {
  const measured = measure(root);
  const record = readRecord(root);
  if (argv.includes('--write')) {
    writeFileSync(join(root, RECORD_FILE), recordText(loweredRecord(measured, record)));
    console.log(`${RECORD_FILE} lowered to the bible as it stands`);
    return 0;
  }
  const problems = growthProblems(measured, record);
  for (const p of problems) console.error(p);
  if (!problems.length) console.log('the bible holds its growth rules');
  return problems.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));

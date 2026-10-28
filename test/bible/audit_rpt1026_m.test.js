// AUDIT RPT1026 M1 (the record lane of the audit of FIELD BUGS 2026-10-26r): THE TALLY IS THE ROWS'.
//
// bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md opens with a table of how many of the 293 reports took each verdict,
// and the PR's notes and Active-Arcs repeat it. It was counted before RPT1026-WORLD's second pass turned three rows into
// fixes and before two rows were given their sections' verdicts, so it said 100 fixed where the rows say 103 - a record
// whose head disagrees with its own body. This reads the rows the way the head says to read them and holds the two equal:
// every report 1-293 has a row, one report alone (#245, read in two lanes) has two and is counted once, and each
// verdict's count is the number of reports whose rows give it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGE = 'bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md';
const text = readFileSync(new URL(`../../${PAGE}`, import.meta.url), 'utf8');
const REPORTS = 293;
const VERDICTS = ['FIXED', 'ALREADY FIXED', 'AS DESIGNED', 'NOT REPRODUCED', 'NEEDS DATA', 'STAFF', 'WITHDRAWN'];
/** The reports the head names as read in two lanes, each counted once. */
const SPLIT = [245];

/** A table row's cells, split on ` | ` outside backticks. */
function cells(body) {
  const out = [];
  let cur = '', tick = false;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '`') tick = !tick;
    if (!tick && body.startsWith(' | ', i)) { out.push(cur); cur = ''; i += 2; continue; }
    cur += body[i];
  }
  out.push(cur);
  return out;
}

/** The verdict a cell's first words give, or null (a fix's own name: FIXED, decided by the caller). */
function leading(cell) {
  const s = cell.trim().toUpperCase();
  if (s.startsWith('NEEDS STAFF')) return 'STAFF';
  for (const v of ['ALREADY FIXED', 'AS DESIGNED', 'NOT REPRODUCED', 'NEEDS DATA', 'STAFF', 'WITHDRAWN']) if (s.startsWith(v)) return v;
  return null;
}

/** A row's verdict, as the head says to read it: the Done column's first words; an "Answer the player" row's What it was. */
function verdictOf(what, done) {
  const d = done.trim();
  if (/^answer the player/i.test(d)) {
    const v = leading(what);
    assert.ok(v, `an "Answer the player" row says its verdict first: ${what.slice(0, 60)}`);
    return v;
  }
  return leading(d) ?? (/^(RPT1026-[A-Z]+ ?)?\(?[A-Z][A-Z0-9]*(-[A-Z0-9]+|[A-Z0-9]{3,})(\b|-)/.test(d) ? 'FIXED' : null);   // a fix's name: TRAFFIC-REAL, CAUSEWAY
}

function rows() {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^\| ([\d, ]+) \| (.*) \|$/.exec(line);
    if (!m) continue;
    const c = cells(m[2]);
    assert.equal(c.length, 3, `a report row has Report, What it was and Done: ${line.slice(0, 80)}`);
    const v = verdictOf(c[1], c[2]);
    assert.ok(v, `a row's Done names a verdict or a fix: ${line.slice(0, 80)}`);
    for (const n of m[1].split(',').map(Number)) out.push({ n, v });
  }
  return out;
}

function head() {
  const out = {};
  for (const v of VERDICTS) {
    const m = new RegExp(`^\\| ${v} \\| (\\d+) \\|`, 'm').exec(text);
    assert.ok(m, `the head's table has a ${v} row`);
    out[v] = Number(m[1]);
  }
  return out;
}

test('AUDIT RPT1026 M1: every report 1-293 has a row, and only a report the head names as split has two', () => {
  const byReport = new Map();
  for (const r of rows()) byReport.set(r.n, [...(byReport.get(r.n) ?? []), r.v]);
  const missing = Array.from({ length: REPORTS }, (_, i) => i + 1).filter((n) => !byReport.has(n));
  assert.deepEqual(missing, [], 'reports with no row');
  assert.deepEqual([...byReport.keys()].filter((n) => n < 1 || n > REPORTS), [], 'rows for reports the inbox never held');
  assert.deepEqual([...byReport].filter(([, vs]) => vs.length > 1).map(([n]) => n), SPLIT, 'a report read twice is the head\'s split alone');
});

test('AUDIT RPT1026 M1: the head\'s tally is the rows\' - a split report counted once, FIXED where a half is', () => {
  const byReport = new Map();
  for (const r of rows()) byReport.set(r.n, [...(byReport.get(r.n) ?? []), r.v]);
  const count = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  for (const vs of byReport.values()) count[vs.includes('FIXED') ? 'FIXED' : vs[0]]++;
  assert.deepEqual(head(), count, 'the head counts what the rows say');
  assert.equal(Object.values(head()).reduce((a, b) => a + b, 0), REPORTS, 'and sums to the inbox');
  assert.match(text, new RegExp(`^The 293 reports open in the private-report inbox`, 'm'));
});

test('AUDIT RPT1026 M1: the pages that repeat the tally repeat the head\'s', () => {
  const h = head();
  const arcs = readFileSync(new URL('../../bible/01-Overview/Active-Arcs.md', import.meta.url), 'utf8');
  const line = arcs.split('\n').find((l) => l.includes('Field-Bugs-2026-10-26r.md'));
  assert.ok(line, 'Active-Arcs names the record');
  assert.match(line, new RegExp(`- ${h.FIXED} fixed and pinned \\(`), 'its fixed count');
  assert.match(line, new RegExp(`, ${h['ALREADY FIXED']} already fixed by a newer record,`), 'its already-fixed count');
});

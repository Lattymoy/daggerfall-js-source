import { test } from 'node:test';
import { indexText } from '../bibleIndex.mjs';   // HARD5: the index is Home.md AND the pages it hands off to
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EFFECT_COST_TABLE } from '../../src/systems/spellcost.js';
import { flagLines } from '../../tools/flagSites.mjs';   // IN1: the ONE definition of an open-flag site

// AUDIT 18 - the DOC-TRUTH sweep.
//
// The bible is load-bearing: AUDIT 17m proved that a false "recorded in the
// Ledger" claim actively hid a live defect from the person checking whether
// it was known. These pins are the mechanical half of that audit's fix -
// every claim corrected there is held by a check here, and every check is
// TWO-WAY: it fails if the correction is reverted AND it fails the next time
// a slice makes the same claim false again.
//
// bible/ has zero execution coverage and cannot be "run", so most of these
// are source sweeps over the tree the doc is making claims about (the idiom
// this repo already uses for the scene hosts). Where real code can settle a
// doc claim it is imported instead of grepped - see the spell-cost pin.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lines = (p) => read(p).split('\n');

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, ext, out);
    else if (entry.endsWith(ext)) out.push(rel);
  }
  return out;
}

const SRC_FILES = walk('src', '.js');
const BIBLE_FILES = walk('bible', '.md');

// ---------------------------------------------------------------------------
// 1. Home.md's open-flags list resolves - every entry, to a line of its file.
// CITE-ANCHOR: an entry names its file and quotes its flag; the words are
// the address (a number was a claim about every line above the flag).
// ---------------------------------------------------------------------------

const FLAG_ENTRY = /^- `(src\/[^`:]+)` - (.*)$/;

/** The doc quotes the source line trimmed, optionally with its `// ` gone,
 *  and may truncate with a trailing "...". */
function citationMatches(rawLine, quoted) {
  const trimmed = rawLine.trim();
  const candidates = [trimmed, trimmed.replace(/^\/\/\s*/, '')];
  const truncated = quoted.endsWith('...');
  const want = truncated ? quoted.slice(0, -3) : quoted;
  return candidates.some((c) => (truncated ? c.startsWith(want) : c === want));
}

test('AUDIT 18: every open-flags entry in Home.md quotes a line its file holds', () => {
  const home = lines('bible/Home.md');
  const wrong = [];
  let seen = 0;
  for (const l of home) {
    const m = FLAG_ENTRY.exec(l);
    if (!m) continue;
    seen++;
    const [, file, quoted] = m;
    if (!existsSync(join(root, file))) { wrong.push(`${file} - file does not exist`); continue; }
    if (!lines(file).some((s) => citationMatches(s, quoted.trim()))) wrong.push(`${file} quotes "${quoted.trim()}" - no line of it reads so`);
  }
  // Guard against the list silently emptying out - a regex that stopped
  // matching would make this test vacuous. Deliberately NOT an exact count:
  // the BOTH-ways rule below already pins the list and src/ to exact
  // agreement, and a hard number here is one more thing to rot (AUDIT 21
  // found Testing.md still quoting 109 when the list had reached 115).
  // The floor is a floor: the Road-to-1:1 closeout retired 96 flags in
  // one afternoon (145 -> 53) and Wave D took it to 17, and a floor set at the old population
  // would have punished the retirement (CR-35's lesson).
  assert.ok(seen >= 5, `only ${seen} open-flag citations parsed - the list or its format changed`);
  assert.deepEqual(wrong, [], `stale open-flags citations:\n${wrong.join('\n')}`);
});

test('AUDIT 18: the open-flags list and the FLAGGED/INTERIM sites in src/ agree BOTH ways', () => {
  // IN1: the rule for "is this line a flag?" is imported, not copied.
  // This guard carried its own `/FLAGGED|INTERIM/` and the tool carried
  // another, which is two rules the day one of them moves - and one
  // moved: the guard went red the moment the tool learned that an
  // identifier and a quotation are not open work. One home, both sides.
  // CITE-ANCHOR: a site is its file and its words, counted - two flags in one
  // file that read alike are two entries, and each must be there.
  const inSrc = [];
  for (const f of SRC_FILES) {
    const src = readFileSync(join(root, f), 'utf8'), at = src.split('\n');
    for (const n of flagLines(src)) inSrc.push(`${f} - ${at[n - 1].trim().replace(/^\/\/\s*/, '')}`);
  }
  const inDoc = [];
  for (const l of lines('bible/Home.md')) {
    const m = FLAG_ENTRY.exec(l);
    if (m) inDoc.push(`${m[1]} - ${m[2].trim()}`);
  }
  const less = (a, b) => { const left = [...b]; return a.filter((s) => { const i = left.indexOf(s); if (i < 0) return true; left.splice(i, 1); return false; }); };
  const missing = less(inSrc, inDoc);
  const extra = less(inDoc, inSrc);
  assert.deepEqual(missing, [], `flagged in src/ but absent from Home.md's list:\n${missing.join('\n')}`);
  assert.deepEqual(extra, [], `listed in Home.md but not flagged in src/:\n${extra.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 2. The bible may not name a module that is not there.
// ---------------------------------------------------------------------------

test('AUDIT 18: every src/ path the bible names in backticks exists (or is marked DELETED)', () => {
  const pathRef = /`((?:src|test|tools)\/[A-Za-z0-9_./-]+\.(?:js|mjs|md|json|html))(?::\d+(?:-\d+)?)?`/g;
  const bad = [];
  for (const f of BIBLE_FILES) {
    lines(f).forEach((l, i) => {
      for (const m of l.matchAll(pathRef)) {
        if (existsSync(join(root, m[1]))) continue;
        // A historical milestone record may still NAME a module that has
        // since been deleted - but it has to say so on the same line.
        if (/DELETED|RETIRED/.test(l)) continue;
        bad.push(`${f}:${i + 1} names ${m[1]}, which does not exist`);
      }
    });
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// ---------------------------------------------------------------------------
// 3. A section index may not contradict its own arc file.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 4. The Ledger may not exempt code that has shipped.
// ---------------------------------------------------------------------------

/** Section C rows, split into struck (~~...~~ SHIPPED) and live ones. */

// ---------------------------------------------------------------------------
// 5. Doc claims settled by importing the code they describe.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. Self-retiring pins: a doc claim that is only false while the code is.
//    Each of these stops asserting the moment the code fix lands.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AUDIT 21: the list is regenerated MECHANICALLY, and now that is true.
//
// Testing.md has said so for three audits and no such tool existed, so the
// list rotted on every host edit and three audits spent time hand-patching
// line numbers - each patch a chance to point a citation at the wrong line.
// tools/regenOpenFlags.mjs writes the list; this asserts the checked-in list
// is what the tool would write, so the two can never drift apart again.
// ---------------------------------------------------------------------------

test('AUDIT 21: bible/Home.md open-flags list matches the regenerator', () => {
  const r = spawnSync(process.execPath, [join(root, 'tools/regenOpenFlags.mjs'), '--check'],
    { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0,
    `${r.stderr || r.stdout}\nthe checked-in open-flags list is not what the tool produces - `
    + 'run: node tools/regenOpenFlags.mjs');
});

// ---------------------------------------------------------------------------
// U42: the two arc pages COUNT their own modules, and nothing checked the
// number.
//
// UI.md said 52 while `src/ui/` held 56, and Systems.md said 37 while
// `src/systems/` held 93 - the systems figure had been wrong by a factor of
// two and a half since the S arc's early slices, on a page whose whole job
// is to tell a reader how big the arc is. Both pages already carry a
// standing gate for their PROSE (the "Not started" latch above); this is
// the same gate for their arithmetic, and the failure message carries the
// real number so the fix is a copy rather than a recount.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WM2h: NO CONFLICT MARKER REACHES THE BIBLE, in any file.
//
// This has now happened three times. "Repair: the previous merge went out
// with conflict markers in Testing.md" is in the log; manifest.test.js
// grew a marker check for THAT ONE FILE because of it; and then markers
// went out in Port-Ledger.md's windmill row, which another lane had to
// fix - and the row arrived back here NESTED, a conflict inside a
// conflict, because the resolution that shipped them was a regex over
// the markers rather than a reading of the two sides.
//
// A per-file guard was the wrong shape: the file that breaks next is the
// one nobody has broken yet. This is every tracked bible document, and it
// costs one walk.
// ---------------------------------------------------------------------------

test('WM2h: no bible document carries a merge conflict marker', () => {
  const bad = [];
  for (const f of BIBLE_FILES) {
    lines(f).forEach((l, i) => {
      if (/^(<{7}|={7}|>{7})(\s|$)/.test(l)) bad.push(`${f}:${i + 1} ${l.slice(0, 40)}`);
    });
  }
  assert.deepEqual(bad, [], `merge conflict markers in the bible:\n${bad.join('\n')}`);
});

// ---------------------------------------------------------------------------
// AUDIT 39: the tripwire the EV arc said was already here.
//
// Enhanced-Visuals-Arc.md's hard-constraints section told every following
// slice that this file pins Rendering.md's "directional light 0.45 +
// 0.55*diffuse", and EV5's own record leans on that pin - but no test in the
// repo held the string. The base term is not a GLSL literal a shader-text
// sweep could catch either: it is renderer.js's JS defaults, so a retune
// would leave Rendering.md stating a formula the renderer no longer had with
// the suite green. Both halves are pinned, so the doc and the defaults can
// only move together.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AUDIT 39: the index indexes.
//
// Home.md declared "Bible is flat under `bible/`. This file is the index",
// and the two newest audit records (Audit-DA, Audit-EV) were reachable only
// from the arc pages they close - a reader following the instruction reached
// AUDIT 38 and stopped. The gate is the same both-ways shape as the
// open-flags list: a new record must be indexed, and a renamed one cannot
// leave a dead row behind.
//
// CR-39 widened it from RECORDS NAMED "Audit-*" to every record under
// 01-Overview/, because the prefix was doing the work the law does: the
// road-to-1:1 campaign ledger and the 2026-09-01 incident record - whose
// four Standing lessons are binding process law - both slipped in
// unindexed while this test reported green. What is deliberately NOT
// indexed is an explicit list, so leaving a record out is a decision
// somebody writes down rather than a name that happens not to match.
// ---------------------------------------------------------------------------

/** Every page under 01-Overview/, by its name - its records' folders among them (TIDY6: `audits/`, `bugs/`,
 *  `handoffs/` - 01-Overview/Code-Map.md). A record is found by its name wherever it is filed, so a name is one page. */

/** Records under 01-Overview/ the index deliberately does not name. */

// AUDIT 58 (seams): AND EVERY ARC PLAN, wherever it lives. The law
// above reads ONE directory, so an unindexed arc plan under
// 07-Rendering/ passed green: `Enhanced-Environments-Arc.md` - the
// live plan for the ground/sky/grass/weather arc, opened 2026-09-01,
// the arc four of the most recent audits were written about, and the
// document doctrine.test.js opens by path to assert the render gate
// and the upload law - was named nowhere in the index that calls
// itself the index. Its only prose reachability was one second hop
// from Rendering.md. That is the same fault the AUDIT 39 header
// describes (Audit-DA and Audit-EV reachable only from the arc pages
// they close), one directory over, so the same law covers it: a
// `*-Arc.md` anywhere under bible/ is named in Home.md, or it is on
// the written list below.
/** Arc plans Home.md deliberately reaches another way. */

// ---------------------------------------------------------------------------
// AUDIT 39r: the five passages the fix wave outdated and did not correct.
//
// AUDIT 39 rewrote source and moved pins under five bible passages without
// touching the prose, so each page went on teaching the law its own suite had
// just reversed - the exact failure mode AUDIT 17m named, where a confident
// doc hides a live defect from the person checking whether it is known. Each
// pin below is TWO-WAY in this file's own idiom: it fails if the prose
// correction is reverted, AND it fails if the source it mirrors moves back.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AUDIT 58 (records lane): THE PAGES THAT POINT AT THEMSELVES.
//
// Three defects of one kind, all in the campaign's own status page and
// all invisible to every gate the tree had. (1) Six citations named
// `Audit-49.md` as the record of the Road-to-1:1 campaign; two lanes
// took the number 49 the same day, the campaign record was renumbered
// to `Audit-53.md`, and the pointers were not moved - so a reader
// following "the record" of the closing campaign landed on a 64-line
// grass and weather audit. (2) The page called `Testing.md:4` "the
// smallest stale record in the tree"; Testing.md:4 is the one record
// that CANNOT be stale, pinned line and row by `test/bible/manifest.test.js`
// against a live walk of `test/`. (3) Two half-paragraphs survived
// their own rewrites and stood as second, contradicting claims - the
// exact shape `manifest.test.js`'s duplicate guard was written for
// over one other file.
//
// Each pin below reads the claim out of the page and resolves it
// against the thing it is a claim ABOUT.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// CD - THE CITATION IS PART OF THE CLAIM (ROAD-E fix-D, 2026-09-02).
//
// Wave E's review found the same defect four times over, and every
// instance was a POINTER rather than a behaviour: a comment, a status
// page or a test header naming a line that had been exact one commit
// earlier and named a stranger at the merge.
//
//   - `ui/spell/spellMakerWindow.js` declared "RECORDED DEPARTURES" and closed
//     the first with "Ledger A carries the widget row already
//     (Port-Ledger.md:988)". Section A carried no widget row at all -
//     the AUDIT 17m / F7 shape, a claim of approval standing in for one -
//     and :686 was the stat-colour NIT row by then. The row exists now
//     (Ledger A, TB1) and the sites cite it BY NAME.
//   - `Road-To-1-1.md` and `Port-Status-2026-09-02.md` both said the
//     wave left 17 open flags, one of them as the falsifiable claim
//     that "`regenOpenFlags --check` now answers 17". Six lanes each
//     retired a flag against their own 19-row base and none could see
//     the others; the tool answers 13.
//   - every Port-Ledger row identifier in Port-Status section 2 moved
//     when the wave inserted two rows above section C, so fourteen
//     `:NNN` cites named unrelated rows, as did the section's own bounds.
//   - three in-range comments and two test headers cited sibling-lane
//     files at lines those lanes had just moved.
//
// A line number is a claim like any other, and the only durable answer
// is to make it CHECKABLE: each pin below reads the citation out of the
// document that makes it and resolves it against the file it names. Bump
// any one of them by a line and the suite goes red at the citation, not
// three waves later at a reader.
//
// CITE-ANCHOR (2026-10-06): a cite into our code names its line by a QUOTE
// now (tools/citeAnchor.mjs, test/tooling/citeanchor.test.js) - a number was a
// claim about every line above it, and keeping thousands of them true
// rewrote the same doc lines on every branch that touched a host. The law
// here stands; what the pins read changed. A pick captures the anchor's
// quote (and an after-form's line) and resolves it as the gate does, and a
// range is named by its first line - so where a pin held a range's END,
// it holds the block that line opens. The records keep their numbers: a
// struck row's measurement, and a renumbering told as history.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dfuFile, missingDfu } from '../dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone
import { resolveAnchor, maskAnchors, citedLines, anchorLine, bracesAt, forbidAt } from '../../tools/citeAnchor.mjs';   // CITE-ANCHOR: the gate's own resolver

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
/** The tracked files under a directory - test/tooling/doctrine.test.js's own
 *  population, so a walk here and a walk there see the same tree. */
const lines = (rel) => read(rel).split('\n');

/** CITE-ANCHOR: the line an anchor's quote (and after-form line) names in `target`, as the gate resolves it - 0 for
 *  none. Masked as the gate masks: a quote counts outside the anchors. */
/** CITE-ANCHOR's brace rule: in a code file's comment a block's head with nothing to quote but its brace (a hook whose
 *  text stands twice, `onLevelUp: () => {`) is named at its block's first line - the tool's nudge (anchorLine). Whether
 *  the anchor at `n`, cited from `from`, is that nudge of a line `want` names: one of the three above it, which the
 *  tool's own rule names here. */
/** A pick's capture of an anchor: its quote, and an after-form's line. */
/** The block line `n` (1-based) opens: through the first later line at or above its indent that closes it. A range
 *  cited by its first line is that block. */

/** The Ledger's line N, 1-based, as the citations write it. */

/** A heading's line number, 1-based. */

/** Table rows in a line range: the doc's own `awk '/^\|/ && !/^\|---/'`. */

// ═══ CD4: the in-source citations the wave invalidated resolve again ═══
/** `<file> ... :<line>` cited from a comment, and what must be on it. */

// ---------------------------------------------------------------------------
// CD7 (ROAD-G G1 review, 2026-09-04): A RANGE WHOSE END PRECEDES ITS
// START IS NOT A CITATION AT ALL.
//
// The G1 lane re-resolved ~180 `:NNN` cites after moving code in four
// hosts, and the pass advanced only the LEADING number of every
// multi-number citation: cityGuards.js's 1108-1012, world.js's 16599-16503,
// worldModes.js's 1590 against 1356. Forty of them came out as ranges
// that cannot exist, and every pin in this file was green throughout,
// because each one resolves a single number a human chose to list.
//
// This pin needs no list. It reads every tracked source, test, tool and
// bible page and refuses any citation into a PORT file (`*.js`/`*.mjs`)
// whose second number is smaller than its first - the range form
// `A-B`, the slash pair `A/:B` and the `A against :B` form alike. C#
// reference cites are exempt: DFU's own members are legitimately cited
// out of order (a caller at :481 against its callee at :409).
// MUTANT: put any one of the forty back and this goes red.
// ---------------------------------------------------------------------------
test('CD7: no citation into a port file names a range that runs backwards', () => {
  const CITE = /([A-Za-z0-9_./-]+\.(?:js|mjs)):(\d+)\s*(?:-|\/:|\/|\s+against\s+:)\s*:?(\d+)/g;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (/\.(js|mjs|md)$/.test(e.name) ? [rel] : []);
  });
  const backwards = [];
  // this file alone is exempt: it QUOTES the corrupted forms above, as
  // the record of what the check is for.
  for (const rel of ['src', 'test', 'tools', 'bible'].flatMap(walk).filter((r) => r !== 'test/scenes/citedrift.test.js')) {
    lines(rel).forEach((l, i) => {
      for (const m of l.matchAll(CITE)) {
        if (Number(m[3]) < Number(m[2])) backwards.push(`${rel}:${i + 1}: ${m[0]}`);
      }
    });
  }
  assert.deepEqual(backwards, [], 'a citation names a range whose end precedes its start');
});

// CD7b (AUDIT 625 D3, 2026-10-05): A RANGE IS WRITTEN WITH AN ASCII
// HYPHEN. citeShift and citeMerge read a range as `A-B`, and CD7 above
// reads the same, so a range set with a typographic dash (a hyphen, a
// non-breaking hyphen, a figure, en or em dash, a minus) is a cite of
// `A` alone to all three: every shift moved its head and left its tail,
// and CD7 never saw the backwards range that made. Settings-Screen-Spec
// set its sixteen ranges with U+2011 - eight had run backwards (the
// settings store's 89 to 81, the renderer's 4378 to 4053), and PR #625's
// own shift made a ninth (the settings pin's 35 to 35 became 36 to 35).
// The sixteen were re-resolved and set in ASCII.
// MUTANT: set any range's hyphen back to U+2011 and this goes red.
test('CD7b: no citation names a range with a typographic dash - the tools that keep cites read an ASCII hyphen', () => {
  const DASHED = /:\d+[‐-―−]\d+/g;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (/\.(js|mjs|md)$/.test(e.name) ? [rel] : []);
  });
  const dashed = [];
  for (const rel of ['src', 'test', 'tools', 'bible'].flatMap(walk)) {
    lines(rel).forEach((l, i) => { for (const m of l.matchAll(DASHED)) dashed.push(`${rel}:${i + 1}: ${m[0]}`); });
  }
  assert.deepEqual(dashed, [], 'a range set with a typographic dash - write it A-B');
});

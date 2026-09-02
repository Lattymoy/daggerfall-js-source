// IN1 - THE OPEN-FLAGS HARVEST COUNTED QUOTATIONS AND IDENTIFIERS
// AS FLAGS (2026-08-29).
//
// FS1 recorded that the ledger count is inflated and deliberately did
// not fix it, because most of the inflation is prose. This is the part
// that is not prose.
//
// tools/regenOpenFlags.mjs grepped `/FLAGGED|INTERIM/` per line, so two
// kinds of line that are not open work landed on the board:
//
//   - an IDENTIFIER starting with the token. INTERIM_WEAPON is a frozen
//     export; its declaration, its default parameter and every mention
//     of it by name were all listed as open flags.
//   - a QUOTATION. A correction that says what it retired has to write
//     the retired words down - and writing them down put the flag back
//     on the board. The tree grew a WORKAROUND for this: dungeonContext
//     quoted a retired flag with the token deliberately lower-cased,
//     and the comment said why. That is EF1c's lesson leaking out of
//     the pins and into the ledger, so the fix is EF1c's rule: strip
//     quoted spans, then look.
//
// What IN1 does NOT do is decide the past-tense case - a block that
// mentions a flag in order to say it is gone. A heuristic over that
// matched OPEN flags whose blocks merely carry narrative, so it is
// left to the reader. A wrong count is worse than a known-incomplete
// one, and this file pins that choice rather than hiding it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagLines, blankQuoted } from '../tools/flagSites.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('IN1: a bare marker on a line is still a flag', () => {
  assert.deepEqual(flagLines('a\n// FLAGGED: the thing pends\nb'), [2]);
  assert.deepEqual(flagLines('// INTERIM, loud: the stand-in\n'), [1]);
  // both tokens, both ways, exactly as the tool's contract says
  assert.deepEqual(flagLines('// FLAGGED\n// INTERIM\n'), [1, 2]);
});

test('IN1: an IDENTIFIER that starts with the token is not a flag', () => {
  assert.deepEqual(flagLines('export const INTERIM_WEAPON = Object.freeze({});'), []);
  assert.deepEqual(flagLines('constructor({ weapon = INTERIM_WEAPON } = {}) {'), []);
  assert.deepEqual(flagLines('const FLAGGED_IDS = [];'), []);
  // but a token merely ADJACENT to punctuation still is one
  assert.deepEqual(flagLines('// (FLAGGED); the browser reload'), [1]);
  assert.deepEqual(flagLines('// FLAGGED, above ground only:'), [1]);
});

test('IN1: a QUOTED marker is a quotation, not an assertion', () => {
  assert.deepEqual(flagLines('// the note read "other effects FLAGGED to the slice" and is gone'), []);
  // and an assertion on the same line as a quotation still counts
  assert.deepEqual(flagLines('// "was FLAGGED" - but FLAGGED: the other half still pends'), [1]);
});

test('IN1: the quotation may WRAP, which is the case that forced the workaround', () => {
  // the opening quote and the token on one line, the close on the next
  const wrapped = '// this read "the classic family... other effects FLAGGED to the\n// effect-library slice" long after it stopped being true';
  assert.deepEqual(flagLines(wrapped), [], 'a wrapped quotation is one quotation');
  // a per-line strip cannot do this - the proof the whole-file pass is needed
  const perLine = wrapped.split('\n')
    .filter((l) => /(?<![A-Za-z0-9_])(FLAGGED|INTERIM)(?![A-Za-z0-9_])/.test(l.replace(/"[^"]*"/g, '""')));
  assert.equal(perLine.length, 1, 'the per-line rule sees an unpaired quote and strips nothing');
});

test('IN1: the span is bounded at two newlines, and FAILS TOWARD KEEPING FLAGS VISIBLE', () => {
  // Prose quotes do not always pair. A closing quote whose opener is far
  // above, then an unrelated opener later, brackets everything between -
  // and a generous bound blanks whatever is in there. A 400-character
  // bound did exactly that on the first run and swallowed talkMacros'
  // GetValue flag, an OPEN one.
  const far = [
    '// (e.g. macros with random generated names)". So a record naming',
    '// `%fn` in two places names the SAME woman twice.',
    '//',
    '// THE PIPE IS EATEN: `|` terminates a macro AND is swallowed.',
    '//',
    '// Unknown macros answer whatever the table has. FLAGGED:',
    '// GetValue answers symbolStr + "[undefined]" for a missing symbol.',
  ].join('\n');
  assert.deepEqual(flagLines(far), [6], 'the open flag between two unrelated quotes survives');
  // the bound is what does it: three lines reaches a wrapped quotation
  // and cannot reach across a paragraph
  assert.equal(blankQuoted('"a\nb\nc"'), '  \n \n  ', 'two newlines inside a span is fine, and the line structure survives');
  assert.equal(blankQuoted('"a\nb\nc\nd"'), '"a\nb\nc\nd"', 'three is too far, and is left alone');
});

test('IN1: the rule has ONE home, imported by the tool and by the AUDIT 18 guard', () => {
  const tool = read('tools/regenOpenFlags.mjs');
  const guard = read('test/audit18_bible_docs.test.js');
  for (const [name, src] of [['the tool', tool], ['the guard', guard]]) {
    assert.match(src, /import \{ flagLines[^}]*\} from '\.[./]*\/?tools\/flagSites\.mjs'|from '\.\/flagSites\.mjs'/,
      `${name} imports the rule`);
    assert.equal(/\/FLAGGED\|INTERIM\/\.test\(/.test(src), false, `${name} carries no second copy of it`);
  }
  // the guard went red the moment the tool learned the rule - which is
  // exactly what two copies buys you, and why there is now one.
  assert.match(guard, /the rule for "is this line a flag\?" is imported, not copied/);
});

test('IN1: the workaround the tool forced is retired, verbatim', () => {
  // dungeonContext lower-cased a quoted flag ON PURPOSE and said so.
  // With quoting safe, the quote is the retired words again.
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /"the classic damage-health family\.\.\. other effects FLAGGED to the\n\s*\/\/ effect-library slice"/,
    'the quotation is upper-case again - it quotes what it retired');
  assert.equal(/The quote is deliberately lower-cased/.test(dc), false, 'and the note explaining the workaround is gone');
  // it also asserted a COUNT of retirement notes that nothing measured
  assert.equal(/eleven retirement notes are already sitting there/.test(dc), false);
  // the line is not on the board any more
  assert.equal(flagLines(dc).includes(776), false, 'and the quoted line is no longer harvested');
});

test('IN1: the board lists exactly the sites the rule finds', () => {
  // the AUDIT 18 guard checks the two sets line by line; this checks
  // the COUNT, so a slice that regenerates half the board fails here.
  const listed = read('bible/Home.md').split('\n').filter((l) => /^- `src\//.test(l)).length;
  const files = [];
  (function rec(d) {
    for (const n of readdirSync(join(ROOT, d))) {
      const rel = `${d}/${n}`;
      if (statSync(join(ROOT, rel)).isDirectory()) rec(rel);
      else if (n.endsWith('.js')) files.push(rel);
    }
  })('src');
  const harvested = files.reduce((n, f) => n + flagLines(read(f)).length, 0);
  assert.equal(listed, harvested, 'Home.md lists exactly the sites the rule finds');
  // a floor, not a count: the closeout retired 96 flags (145 -> 53) and Wave D 36 more (-> 17),
  // and a floor at the old population would have refused the retirement.
  assert.ok(harvested > 5, 'and the rule is measuring a real population, not an empty one');
});

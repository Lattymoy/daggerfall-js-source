// IN1 - WHAT COUNTS AS AN OPEN FLAG, in ONE place.
//
// tools/regenOpenFlags.mjs writes bible/Home.md's list and
// test/audit18_bible_docs.test.js checks the list against the tree.
// Both need the same answer to "is this line a flag?", and both used
// to carry their own copy of it - a bare `/FLAGGED|INTERIM/` per
// line. Two copies of a rule is two rules the day one of them moves,
// and this one moved: the guard went red the moment the tool learned
// what is NOT a flag. The rule lives here now and they import it.
//
// Two things answer the token and are not open work:
//
//  - an IDENTIFIER that starts with it. `INTERIM_WEAPON` is a frozen
//    export; its declaration, its default parameter and every mention
//    of it by name were all on the board.
//  - a QUOTATION. A correction that says what it retired has to write
//    the retired words down, and writing them down put the flag
//    straight back on the board - so the tree grew a workaround:
//    dungeonContext quoted a retired flag with the token deliberately
//    lower-cased, and said so. That is EF1c's lesson leaking into the
//    ledger, and the answer is EF1c's rule - strip quoted spans, then
//    look. A correction may now quote what it retired, verbatim.
//
// What this does NOT try to decide is the past-tense case: a block
// that mentions a flag in order to say it is gone. That is prose. A
// heuristic over it matched open flags whose blocks merely carry
// narrative - "FLAGGED: DFU binds each button..." sitting under a
// paragraph of history - so it is left to the reader. A wrong count is
// worse than a known-incomplete one.

const MARKER = /(?<![A-Za-z0-9_])(FLAGGED|INTERIM)(?![A-Za-z0-9_])/;

/**
 * Blank every quoted span in a file, keeping the line structure
 * exactly - each non-newline character inside a span becomes a space,
 * so line numbers and the quoted text are untouched.
 *
 * Whole-file rather than per-line because comments WRAP, and the quote
 * that made this necessary wraps: the opening `"` and the token sit on
 * one line and the closing `"` on the next, so a per-line strip sees an
 * unpaired quote, strips nothing, and the flag goes back on the board.
 *
 * A span may cross at most TWO newlines, and that bound is the whole
 * design. Prose quotes do not always pair - a comment quoting DFU can
 * close a quotation opened many lines above - so a generous span
 * mis-pairs and blanks whatever sits between two unrelated quotes. A
 * 400-character bound did exactly that on the first run: it swallowed
 * talkMacros' GetValue flag, an OPEN one, between a closing quote and
 * the next opening quote ten lines later. THE FAILURE DIRECTION IS THE
 * POINT. Missing a quotation leaves a retired flag listed, which a
 * reader can see and dismiss; blanking an open flag hides real work,
 * which nobody sees at all. Three lines catches every wrapped
 * quotation in the tree and cannot reach across a paragraph.
 */
export const blankQuoted = (src) => src.replace(/"[^"\n]*(?:\n[^"\n]*){0,2}?"/g,
  (m) => m.replace(/[^\n]/g, ' '));

/** The 1-based line numbers in `src` that are open-flag sites. */
export function flagLines(src) {
  const bare = blankQuoted(src).split('\n');
  const out = [];
  for (let i = 0; i < bare.length; i++) if (MARKER.test(bare[i])) out.push(i + 1);
  return out;
}

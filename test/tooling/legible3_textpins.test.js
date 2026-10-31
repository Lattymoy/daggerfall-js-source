// LEGIBLE 3 (bible/01-Overview/Readability-Arc.md): a test that quotes source text - a string it looks for, a regex it
// matches - is carried through a layout change by tools/carryTextPins.mjs, the quote rewritten to the same code's new
// text, mapped token by token. These fixtures are the shapes the rollout met.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { offsetMap, carriedIn, literalRun } from '../../tools/carryTextPins.mjs';

const OLD = "export const a = { name: this.name.trim(), icon: this.icon };\nfunction f(x) { return x+1 }\n";
const NEW = 'export const a = {\n  name: this.name.trim(),\n  icon: this.icon,\n};\nfunction f(x) {\n  return x + 1;\n}\n';
const sources = [{ file: 'src/x.js', old: OLD, new: NEW }];
const carried = (test) => carriedIn(test, sources).map((f) => f.spelled ?? f.why);

test('LEGIBLE 3 text pins: an offset maps through the tokens both versions share, into a token by its offset when it kept its text (mutants: the end mapped as a start; a token\'s own offset dropped)', () => {
  const at = offsetMap(OLD, NEW);
  assert.equal(at(OLD.indexOf('name:'), 'start'), NEW.indexOf('name:'));
  assert.equal(at(OLD.indexOf('icon') + 4, 'end'), NEW.indexOf('icon') + 4);
  assert.equal(at(OLD.indexOf('trim') + 2, 'start'), NEW.indexOf('trim') + 2);
  assert.equal(at(OLD.indexOf('return'), 'start'), NEW.indexOf('return'));
});

test('LEGIBLE 3 text pins: a regex the change left behind becomes the new text, a line break and its indent read as \\n\\s*; a string becomes the new text, in its own quotes (mutants: the regex unescaped; the quote changed)', () => {
  assert.deepEqual(carried("assert.match(s, /name: this\\.name\\.trim\\(\\), icon: this\\.icon/);"), ['/name: this\\.name\\.trim\\(\\),\\n\\s*icon: this\\.icon/']);
  assert.deepEqual(carried("assert.ok(s.includes('function f(x) { return x+1 }'));"), ["'function f(x) {\\n  return x + 1;\\n}'"]);
});

test('LEGIBLE 3 text pins: a quote that still finds the code, one that never found it, or a short one is left as it is; a regex a const names matches either text (mutants: a found quote rewritten; a named regex narrowed)', () => {
  assert.deepEqual(carried("assert.ok(s.includes('this.name.trim()'));"), []);
  assert.deepEqual(carried("assert.ok(s.includes('nothing of the kind at all'));"), []);
  assert.deepEqual(carried("const R = /return x\\+1/;"), ['/(?:return x\\+1|return x \\+ 1)/']);
});

test('LEGIBLE 3 text pins: a regex with a capture group outside an assertion is named, not carried - its groups are read (mutant: the capture rule unread)', () => {
  assert.deepEqual(carried("const m = s.match(/return (x)\\+1/); use(m[1]);"), ['a capture group read outside an assertion']);
  assert.deepEqual(carried("assert.match(s, /return (x)\\+1/);"), ['/return x \\+ 1/']);
});

test('LEGIBLE 3 text pins: a regex is tried only on a text holding its longest literal run - an escaped mark is a letter of it, a class or a quantifier ends it (mutant: the run never cut)', () => {
  assert.equal(literalRun('name: this\\.name\\.trim\\(\\), icon'), 'name: this.name.trim(), icon');
  assert.equal(literalRun('release\\(\\) \\{\\n\\s*this'), 'release() {');
  assert.equal(literalRun('a[bc]+d'), null, 'nothing six long');
  assert.equal(literalRun('abcdefg+hij'), 'abcdef', 'a quantified letter is not in the run');
  assert.deepEqual(carried('assert.match(s, /nowhere at all[^x]*icon/);'), [], 'never run on a text without its run');
});

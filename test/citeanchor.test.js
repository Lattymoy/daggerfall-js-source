// CITE-ANCHOR (2026-10-06, Mac - asked how to stop the merge conflicts the cites made, "Merge #630, then fix cites";
// tools/citeAnchor.mjs, bible/09-Testing/Testing.md CITE-ANCHOR): A CITE INTO OUR OWN CODE NAMES WHAT IT POINTS AT.
// The law the line numbers served stands (test/citedrift.test.js: the citation is part of the claim, and checkable);
// the claim is a quote now - the one line of the file that holds it - and a change to a file moves no doc but the ones
// that cite the lines it changed. CA1 resolves every anchor in the docs; CA2 holds the tree to the law: no live line
// number into our code is left (a struck record's, the relay bundle's and another repository's are held, by name);
// the rest pins the tool's own rules on fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  quoteFor, afterFor, resolveAnchor, anchorFor, anchorLine, maskAnchors, planDoc, applyPlan, checkDoc, convertAll,
  makeResolver, reader, trackedSets, relayFiles, forbidAt, ESCAPED_NUM_CITE, SELF_DOCS, QUOTE_MIN, tokenEdge, codeOpenAt,
  struckSpans, headOwns, balanced, opensBlock, bracesAt, ANCHOR,
} from '../tools/citeAnchor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readFile = (f) => readFileSync(join(root, f), 'utf8');

test('CA1: every anchor in the docs names one line - its quote stands once in the file, outside the anchors (a quote that stops being true goes red in the change that made it so, at the doc and the quote)', () => {
  const { docs, code } = trackedSets(root);
  const resolve = makeResolver(code);
  const read = reader(readFile);
  const bad = [];
  let seen = 0;
  for (const d of docs) {
    for (const a of checkDoc({ docText: readFile(d), resolve, read })) {
      seen++;
      if (a.error) bad.push(`${d}:${a.line} ${a.text} - ${a.error}`);
    }
  }
  assert.ok(seen >= 1500, `only ${seen} anchors read - the docs or the anchor's spelling changed`);
  assert.deepEqual(bad, [], `anchors that name no line:\n${bad.join('\n')}`);
});

test('CA2: no live line number into our code is left in the docs - a struck record\'s, a file of the relay\'s bundle\'s and another repository\'s are held, and nothing else (run `node tools/citeAnchor.mjs --apply`)', () => {
  const { docs, code } = trackedSets(root);
  const resolve = makeResolver(code);
  const read = reader(readFile);
  const relay = relayFiles(root);
  const open = [];
  for (const d of docs) {
    const docText = readFile(d);
    for (const p of planDoc({ docPath: d, docText, resolve, read, relay })) {
      if (!['struck', 'relay', 'foreign'].includes(p.status)) open.push(`${d}:${p.line} ${p.text} (${p.status})`);
    }
    for (const m of docText.matchAll(ESCAPED_NUM_CITE)) open.push(`${d}:${docText.slice(0, m.index).split('\n').length} ${m[0]} (escaped)`);
  }
  assert.deepEqual(open, [], `line numbers still cited into our code:\n${open.join('\n')}`);
  assert.ok(SELF_DOCS.includes('tools/citeAnchor.mjs') && SELF_DOCS.includes('test/citeanchor.test.js'), 'the tool\'s own fixtures are not docs');
});

test('CA3: every anchor in a code file balances its brackets, braces included, read as one text - its quote, then its line: the tests\' scanners count them in a comment as in code (FOE1 a call\'s parentheses, BOOT-TDZ2 a function\'s braces)', () => {
  const { docs } = trackedSets(root);
  const bad = [];
  let seen = 0;
  for (const d of docs.filter(bracesAt)) {
    readFile(d).split('\n').forEach((l, i) => {
      if (!l.includes(':"')) return;
      for (const m of l.matchAll(ANCHOR)) {
        seen++;
        if (!balanced(m[2] + (m[3] ?? ''), true)) bad.push(`${d}:${i + 1} ${m[0]}`);
      }
    });
  }
  assert.ok(seen >= 500, `only ${seen} anchors read in code files - the files or the anchor's spelling changed`);
  assert.deepEqual(bad, [], `anchors in code files whose brackets do not balance (node tools/citeAnchor.mjs writes them balanced):\n${bad.join('\n')}`);
});

// ---- the tool's rules, on fixtures -------------------------------------------------------------------------------

const FILE = [
  "import { a } from './a.js';",                       // 1
  '',                                                   // 2
  '/**',                                                // 3
  ' * THE QUOTED SEAM - the doc block a cite names.',   // 4
  ' */',                                                // 5
  'export function seam(x) {',                          // 6
  '  if (x) {',                                         // 7
  '    return 1;',                                      // 8
  '  }',                                                // 9
  '  return 2;',                                        // 10
  '}',                                                  // 11
  'export function other(y) {',                         // 12
  '  if (y) {',                                         // 13
  '    return 1;',                                      // 14
  '  }',                                                // 15
  "  const s = 'quoted \"text\" here' * 2;",            // 16
  '}',                                                  // 17
].join('\n');
const LINES = FILE.split('\n');
const ANY = /["`\\]/;

test('CITE-ANCHOR quoteFor: the shortest run of at least QUOTE_MIN characters from a word\'s start that stands once (or the whole line, shorter), past the indent and a comment\'s opener; none across a forbidden character; null for a line with no such run (mutants: the minimum, the whole line, the word\'s start, the opener, the forbidden stop)', () => {
  assert.equal(quoteFor(FILE, LINES, 6, ANY), 'export function seam', 'a callee\'s name ends before its `(`');
  assert.ok('export function seam'.length >= QUOTE_MIN);
  assert.equal(quoteFor(FILE, LINES, 4, ANY), 'THE QUOTED SEAM -', 'the comment\'s opener and indent are not quoted');
  assert.equal(quoteFor(FILE, LINES, 10, ANY), 'return 2;', 'a whole line may be shorter');
  assert.equal(quoteFor(FILE, LINES, 8, ANY), null, '`return 1;` stands twice');
  assert.equal(quoteFor(FILE, LINES, 9, ANY), null, 'a brace');
  assert.equal(quoteFor(FILE, LINES, 2, ANY), null, 'a blank line');
  assert.equal(quoteFor(FILE, LINES, 16, ANY), "const s = 'quoted", 'the run stops before a `"`');
  assert.equal(quoteFor(FILE, LINES, 16, /["`\\']/), null, 'every run crosses a forbidden mark, and a tail (`* 2;`) is no whole line');
});

test('CITE-ANCHOR tokenEdge: a quote ends at whitespace, at a name before its call, index or closing mark, or after a closing bracket - never inside a name, an operator, a member or a path (mutants: each arm)', () => {
  const l = 'go: () => Math.floor(dir.js) + arr[k];';
  const after = (s) => { assert.ok(l.includes(s), s); return l.indexOf(s) + s.length; };
  assert.equal(tokenEdge(l, after('go:')), true, 'whitespace follows');
  assert.equal(tokenEdge(l, after('go: () =')), false, 'inside `=>` - `nothingText: () =` read as a typo');
  assert.equal(tokenEdge(l, after('Math.')), false, 'inside a member');
  assert.equal(tokenEdge(l, after('Math.fl')), false, 'inside a name');
  assert.equal(tokenEdge(l, after('Math.floor')), true, 'a callee before its `(`');
  assert.equal(tokenEdge(l, after('(dir.')), false, 'inside a path');
  assert.equal(tokenEdge(l, after('(dir.js')), true, 'a name before its closing mark');
  assert.equal(tokenEdge(l, after(' arr')), true, 'a name before its index');
  assert.equal(tokenEdge(l, after('arr[k]')), true, 'a closing bracket before what follows it');
  assert.equal(tokenEdge('f(a)b', 4), false, 'a closing bracket glued to a name is inside a token');
});

test('CITE-ANCHOR codeOpenAt: a code span opened on an earlier line of its paragraph is open at this one, a blank line ends it, a fence is code - so a cite inside a wrapped span may quote a `*`, and one after the span closes may not (mutants: the carry, the blank, the fence)', () => {
  const md = ['a `span that', 'wraps x.js:1` and y.js:2', '', 'new para', '```', 'code x.js:3', '```', 'after'].join('\n');
  assert.deepEqual(codeOpenAt(md), [false, true, false, false, true, true, true, false]);
  const l = 'wraps x.js:1` and y.js:2';
  assert.equal(forbidAt('a.md', l, l.indexOf('x.js'), true).test('a * b'), false, 'inside the span the line above opened');
  assert.equal(forbidAt('a.md', l, l.indexOf('y.js'), true).test('a * b'), true, 'after it closed');
});

test('CITE-ANCHOR struckSpans: a cite inside struck text is the record\'s and held; beside it on the same line, live; a line whose strike marks do not pair is held whole (mutants: the span, the pairing)', () => {
  assert.deepEqual(struckSpans('a ~~b~~ c ~~d~~'), [[2, 7], [10, 15]]);
  assert.equal(struckSpans('a ~~b c'), null);
  const files = { 'src/a.js': FILE };
  const resolve = makeResolver(Object.keys(files));
  const read = (f) => ({ text: maskAnchors(files[f]), lines: files[f].split('\n') });
  const doc = ['| ~~OLD a.js:6~~ **CLOSED**: `a.js:4` |', 'a ~~strike opened here a.js:6', 'and closed here~~ a.js:4'].join('\n');
  assert.deepEqual(planDoc({ docPath: 'bible/x.md', docText: doc, resolve, read }).map((p) => p.status), ['struck', 'anchor', 'struck', 'struck']);
});

test('CITE-ANCHOR afterFor and resolveAnchor: a line too common to quote is the first line after the nearest quotable one above it with the same trimmed text - or, past a twin of that text, with the same text as written, indentation included; null when no indentation tells them apart; an anchor resolves to its line, or says why not (mutants: the twin, the nearest, the indentation, the trimmed match, missing, ambiguous, no-line)', () => {
  assert.deepEqual(afterFor(FILE, LINES, 9, ANY), { quote: 'if (x) {', line: '}' }, 'the nearest quotable line above');
  assert.deepEqual(afterFor(FILE, LINES, 8, ANY), { quote: 'if (x) {', line: 'return 1;' });
  assert.deepEqual(afterFor(FILE, LINES, 11, ANY), { quote: 'return 2;', line: '}' });
  const T = ['function solo() {', '  tick();', '  tick();', '}'];
  assert.equal(afterFor(T.join('\n'), T, 3, ANY), null, 'a twin stands between: a person\'s');
  // the outer block's close past the inner one's: told apart by its indentation, and resolved as written
  const N = ['function nest() {', '  if (a) {', '    if (b) {', '      go();', '    }', '  }', '}'];
  assert.deepEqual(afterFor(N.join('\n'), N, 6, ANY), { quote: 'go();', line: '  }' }, 'the indented line past its twin');
  assert.deepEqual(resolveAnchor(N.join('\n'), N, 'go();', '  }'), { line: 6 });
  assert.deepEqual(resolveAnchor(N.join('\n'), N, 'go();', '}'), { line: 5 }, 'a trimmed after-form takes the first twin');
  assert.equal(afterFor(N.join('\n'), N, 7, ANY), null, 'no indentation tells the outermost close from the twins: a person\'s');
  assert.deepEqual(resolveAnchor(FILE, LINES, 'export function seam'), { line: 6 });
  assert.deepEqual(resolveAnchor(FILE, LINES, 'export function seam', '}'), { line: 9 });
  assert.deepEqual(resolveAnchor(FILE, LINES, 'export function other', 'return 1;'), { line: 14 });
  assert.deepEqual(resolveAnchor(FILE, LINES, 'no such text'), { error: 'missing' });
  assert.deepEqual(resolveAnchor(FILE, LINES, 'return 1;'), { error: 'ambiguous' });
  assert.deepEqual(resolveAnchor(FILE, LINES, 'export function other', 'never'), { error: 'no-line' });
  assert.equal(anchorFor('a.js', FILE, LINES, 9, ANY), 'a.js:"if (x) {".."}"');
  assert.equal(anchorFor('a.js', FILE, LINES, 6, ANY), 'a.js:"export function seam"');
});

// a code file's blocks: an if/else-if/else chain, two loops that read alike, and a string that holds a brace
const BR = [
  'export function gate(x, people) {',      // 1
  '  if (people) {',                        // 2
  '    run(x);',                            // 3
  "  } else if (x.mode === 'fast') {",     // 4
  '    if (x) {',                           // 5
  '      stop();',                          // 6
  '    }',                                  // 7
  '    halt(x);',                           // 8
  '  } else {',                             // 9
  '    wait(x);',                           // 10
  '  }',                                    // 11
  '  for (const p of people) {',            // 12
  '    p.go();',                            // 13
  '  }',                                    // 14
  '  for (const p of people) {',            // 15
  '    p.rest();',                          // 16
  '  }',                                    // 17
  '  return x;',                            // 18
  '}',                                      // 19
  'export function stray(y) {',             // 20
  '  if (y) {',                             // 21
  "    const s = '}';",                     // 22
  '    log(s);',                            // 23
  '  }',                                    // 24
  '}',                                      // 25
].join('\n');
const BRL = BR.split('\n');

test('CITE-ANCHOR braces: in a code file an anchor\'s braces balance, quote then line - a quote stops short of a block\'s brace (a line that ends opening one is whole without it); a block\'s close is named from the line that opens it, or from the link before it in its chain; a line that leaves a brace open has no after-form, and a block\'s head with nothing to quote but its brace is named at the block\'s first line; Markdown keeps its braces (mutants: the brace count, the close first, the open left, the opener\'s quote, the indentation, the chain, the closing line, the nudge)', () => {
  assert.equal(balanced('} else {'), true, 'braces are free unless asked');
  assert.equal(balanced('} else {', true), false, 'a close before its open');
  assert.equal(balanced('if (x) {', true), false, 'an open left');
  assert.equal(balanced('{ a: [1] }', true), true);
  assert.deepEqual(['} else {', '}', '{ a }', 'x = {'].map(opensBlock), [true, false, false, true]);
  // the quote
  assert.equal(quoteFor(BR, BRL, 2, ANY, null, true), 'if (people)', 'the whole line without its brace');
  assert.equal(quoteFor(BR, BRL, 2, ANY), 'if (people) {', 'Markdown quotes the brace');
  assert.equal(quoteFor(BR, BRL, 4, ANY, null, true), "else if (x.mode === 'fast')", 'past the close, short of the open');
  assert.equal(quoteFor(BR, BRL, 4, ANY), "} else if (x.mode === 'fast')");
  // a block's close: from the line that opens it, whose quote holds the brace it closes
  assert.deepEqual(afterFor(BR, BRL, 7, ANY, null, true), { quote: 'if (x) {', line: '}' });
  assert.deepEqual(afterFor(BR, BRL, 7, ANY), { quote: 'stop();', line: '}' }, 'Markdown: the nearest quotable line');
  // the close of a chain whose last link (`} else {`) cannot be quoted: from the link before it, indented past the twin at 7
  assert.deepEqual(afterFor(BR, BRL, 11, ANY, null, true), { quote: "else if (x.mode === 'fast') {", line: '  }' });
  assert.deepEqual(resolveAnchor(BR, BRL, "else if (x.mode === 'fast') {", '  }'), { line: 11 });
  assert.equal(afterFor(BR, BRL, 9, ANY, null, true), null, 'a line that leaves a brace open');
  assert.equal(afterFor(BR, BRL, 14, ANY, null, true), null, 'its opener stands twice: a person\'s');
  assert.equal(afterFor(BR, BRL, 24, ANY, null, true), null, 'the string\'s brace miscounts the opener to another indentation: a person\'s');
  // a block's head with nothing to quote but its brace: the block's first line, nudged
  assert.deepEqual(anchorLine(BR, BRL, 9, null, ANY, true), { n: 10, nudged: true });
  assert.deepEqual(anchorLine(BR, BRL, 12, null, ANY, true), { n: 13, nudged: true });
  assert.deepEqual(anchorLine(BR, BRL, 12, null, ANY), { n: 12, nudged: false }, 'Markdown names the head itself');
  assert.deepEqual(anchorLine(BR, BRL, 14, null, ANY, true), { n: null }, 'a close is never nudged');
  // the wiring: a code file's comment against a Markdown doc, the same cites
  const files = { 'src/b.js': BR };
  const resolve = makeResolver(Object.keys(files));
  const read = (f) => ({ text: maskAnchors(files[f]), lines: files[f].split('\n') });
  const plan = (docPath, docText) => planDoc({ docPath, docText, resolve, read }).map((p) => [p.status, p.to]);
  assert.deepEqual(plan('src/c.js', '// b.js:7 and b.js:12'), [['anchor', 'b.js:"if (x) {".."}"'], ['nudged', 'b.js:"p.go();"']]);
  assert.deepEqual(plan('bible/x.md', 'b.js:7 and b.js:12'), [['anchor', 'b.js:"stop();".."}"'], ['anchor', 'b.js:"wait(x);".."for (const p of people) {"']]);
});

test('CITE-ANCHOR anchorLine: a range is named at its first line that takes an anchor; a single line with nothing on it (blank, a comment\'s bare opener, star or close) at the next one that does, within three, nudged; any other line without an anchor names none (mutants: the range, the nudge, the reach)', () => {
  assert.deepEqual(anchorLine(FILE, LINES, 2, 6, ANY), { n: 4, nudged: false }, 'blank 2 and the opener 3 skipped');
  assert.deepEqual(anchorLine(FILE, LINES, 5, null, ANY), { n: 6, nudged: true }, 'a doc block\'s close names what it documents');
  assert.deepEqual(anchorLine(FILE, LINES, 3, null, ANY), { n: 4, nudged: true });
  assert.deepEqual(anchorLine(FILE, LINES, 11, null, ANY), { n: 11, nudged: false });
  const T = ['function solo() {', '  tick();', '  tick();', '}'];
  assert.deepEqual(anchorLine(T.join('\n'), T, 3, null, ANY), { n: null }, 'a line with a twin before it is a person\'s, never nudged');
});

test('CITE-ANCHOR maskAnchors: every anchor\'s quote blanked, lines and offsets kept - so a file that cites its own line counts its quote once (mutants: the mask, the after-form, the escaped spelling)', () => {
  const t = 'const seam = 1;\n// see self.js:"const seam = 1;" and self.js:"x y".."}" and self\\.js:"q\\(r"\n';
  const m = maskAnchors(t);
  assert.equal(m.length, t.length);
  assert.equal(m.split('\n').length, t.split('\n').length);
  assert.equal(m.indexOf('const seam = 1;'), 0);
  assert.equal(m.indexOf('const seam = 1;', 1), -1, 'the anchor\'s copy is masked');
  assert.ok(!m.includes('"x y"') && !m.includes('"}"') && !m.includes('q\\(r'));
});

test('CITE-ANCHOR forbidAt: in a Markdown doc no `"`, backtick or backslash, no `|` in a table row and no `*` outside a code span; in a code file none in a comment but `*\\/`, and a cite outside a comment is a person\'s (mutants: the span, the row, the comment, the code)', () => {
  assert.equal(forbidAt('a.md', 'see `x.js:1` here', 5).test('a * b'), false, 'inside a code span');
  assert.equal(forbidAt('a.md', 'see x.js:1 here', 4).test('a * b'), true, 'outside one');
  assert.equal(forbidAt('a.md', '| row | x.js:1 |', 8).test('a | b'), true, 'a table row');
  assert.equal(forbidAt('a.md', 'see x.js:1', 4).test('a | b'), false);
  assert.equal(forbidAt('a.js', '  // see x.js:1', 9).test("it's"), false, 'a comment takes a quote mark');
  assert.equal(forbidAt('a.js', '  // see x.js:1', 9).test('a */ b'), true, 'but not a comment\'s close');
  assert.equal(forbidAt('a.js', '   * see x.js:1', 9).test('a * b'), false, 'a doc block\'s star line');
  assert.equal(forbidAt('a.js', "test('see x.js:1', () => {", 10), null, 'a test\'s title is code');
  assert.equal(forbidAt('a.js', 'const r = 1;   // see x.js:1', 21).test('x'), false, 'a trailing comment');
});

test('CITE-ANCHOR planDoc and applyPlan: a path cite, a basename cite, a range and its continuations each become a full anchor that names the cited line; a struck line, a relay file and a foreign basename are held (mutants: the continuation, the struck hold, the relay hold, the foreign hold, the range)', () => {
  const files = { 'src/a.js': FILE, 'src/b/c.js': 'x\nconst unique = 42;\ny\n' };
  const resolve = makeResolver(Object.keys(files));
  const read = (f) => ({ text: maskAnchors(files[f]), lines: files[f].split('\n') });
  const doc = [
    'see `src/a.js:6` and `a.js:4-9`/:12 (:16) and `c.js:2`',
    '| ~~struck a.js:6~~ |',
    'other repo: main.js:12',
  ].join('\n');
  const plan = planDoc({ docPath: 'bible/x.md', docText: doc, resolve, read });
  const st = plan.map((p) => p.status);
  assert.deepEqual(st, ['anchor', 'anchor', 'anchor', 'anchor', 'anchor', 'struck', 'foreign']);
  const out = applyPlan(doc, plan).split('\n');
  assert.equal(out[0], 'see `src/a.js:"export function seam"` and `a.js:"THE QUOTED SEAM -"`/a.js:"export function other" (a.js:"const s = \'quoted") and `c.js:"const unique = 42"`');
  assert.equal(out[1], doc.split('\n')[1], 'the struck record keeps its number');
  for (const a of checkDoc({ docText: out[0], resolve, read })) assert.equal(a.error, undefined, a.text);
  const relay = planDoc({ docPath: 'src/net/wire.js', docText: '// see a.js:6', resolve, read, relay: new Set(['src/net/wire.js']) });
  assert.deepEqual(relay.map((p) => p.status), ['relay']);
});

test('CITE-ANCHOR headOwns: a bare continuation is its head\'s only while the prose between names no other code - after DFU or C# by name, a PascalCase name (DFU\'s classes, methods and fields) or another file of ours it is a person\'s, unclear; a capitalised word and the head\'s own file named again are not other code (mutants: each signal, the hump, the other file, the own file, the wiring)', () => {
  const files = { 'src/a.js': FILE, 'src/b/c.js': 'x\nconst unique = 42;\ny\n' };
  const resolve = makeResolver(Object.keys(files));
  const read = (f) => ({ text: maskAnchors(files[f]), lines: files[f].split('\n') });
  const st = (line) => planDoc({ docPath: 'bible/x.md', docText: line, resolve, read }).map((p) => p.status);
  assert.deepEqual(st('`a.js:6`. The same seam returns early (:12)'), ['anchor', 'anchor'], 'prose that names nothing else');
  assert.deepEqual(st('`a.js:6`; StaticNPC.SetRuntimeData sets the bank (:12)'), ['anchor', 'unclear'], 'a C# member');
  assert.deepEqual(st('`a.js:6` against MinDamage 20 (:12)'), ['anchor', 'unclear'], 'a PascalCase field');
  assert.deepEqual(st('`a.js:6`; DFU plays it first (:12)'), ['anchor', 'unclear'], 'DFU by name');
  assert.deepEqual(st('`a.js:6`, which the C# runs later (:12)'), ['anchor', 'unclear'], 'C# by name');
  assert.deepEqual(st('`a.js:6`, and the shared `b/c.js`, whose seam (:2)'), ['anchor', 'unclear'], 'another file of ours');
  assert.deepEqual(st('`a.js:6`, where `a.js` returns early (:12)'), ['anchor', 'anchor'], 'the head\'s own file');
  assert.equal(headOwns('the same seam ', 'src/a.js'), true);
  assert.equal(headOwns('the port\'s own `b/c.js:"x"` anchor ', 'src/a.js'), true, 'an anchor of another file is a cite (a stop), not prose');
});

test('CITE-ANCHOR convertAll: a file that cites its own lines, and two files that cite each other, settle - every anchor written names the line its number named; a line its own cites leave unquotable keeps its cite\'s number, a person\'s (mutants: the settle pass, the mask, the hold)', () => {
  const texts = new Map([
    ['src/p.js', 'export const PI_SEAM = 3.14159;\n// THE SEAM\'S VALUE, read at p.js:1 and q.js:2\n'],
    ['src/q.js', 'export const Q_SEAM = PI_SEAM * 2;   // see p.js:2\nexport const Q_OTHER = Q_SEAM + 1;\n'],
  ]);
  const resolve = makeResolver([...texts.keys()]);
  convertAll(texts, { resolve, readFile: () => { throw new Error('every file is a doc here'); } });
  const read = reader((f) => texts.get(f));
  const want = { 'p.js': [1, 2], 'q.js': [2] };
  for (const [doc, text] of texts) {
    for (const a of checkDoc({ docText: text, resolve, read })) {
      assert.equal(a.error, undefined, `${doc}: ${a.text}`);
      assert.ok(want[a.file.slice(4)].includes(a.line), `${doc}: ${a.text} names ${a.file}:${a.line}`);
    }
  }
  assert.ok(!/p\.js:\d|q\.js:\d/.test([...texts.values()].join('\n')), 'no number left');

  // a line made of cites holds nothing to quote once they are anchors: its own cite keeps its number, a person's
  const t2 = new Map([
    ['src/r.js', 'export const R_FIRST_SEAM = 1;\nexport const R_OTHER_SEAM = 2;\n// (r.js:1 out, :2 back)\n'],
    ['bible/d.md', 'the round trip: `r.js:3`\n'],
  ]);
  const { plans } = convertAll(t2, { resolve: makeResolver(['src/r.js']), readFile: () => { throw new Error('every file is a doc here'); } });
  assert.equal(t2.get('bible/d.md'), 'the round trip: `r.js:3`\n', 'the number stands where no quote can');
  assert.deepEqual(plans.get('bible/d.md').map((p) => p.status), ['unquotable']);
  assert.match(t2.get('src/r.js'), /\(r\.js:"export const R_FIRST_SEAM" out, r\.js:"export const R_OTHER_SEAM" back\)/);

  // the settle pass re-quotes under the same rule: a block's close cited from a code comment, named from its opener by
  // a quote that ran into a cite the conversion then rewrote (`(q.js:1)`), takes no balanced anchor again - its number
  // stands, a person's, and never the line above it with an unbalanced `.."}"`
  const t3 = new Map([
    ['src/p.js', 'export const PI_SEAM = 3.14159;\nexport function piCheck(v) {\n  if (v) { // (q.js:1)\n    return PI_SEAM;\n  }\n  return 0;\n}\n'],
    ['src/q.js', 'export const Q_SEAM = 2;   // see p.js:5\n'],
  ]);
  const r3 = convertAll(t3, { resolve: makeResolver([...t3.keys()]), readFile: () => { throw new Error('every file is a doc here'); } });
  assert.match(t3.get('src/p.js'), /\(q\.js:"export const Q_SEAM"\)/);
  assert.equal(t3.get('src/q.js'), 'export const Q_SEAM = 2;   // see p.js:5\n', 'the number stands where no balanced anchor can');
  assert.deepEqual(r3.plans.get('src/q.js').map((p) => p.status), ['unquotable']);
});

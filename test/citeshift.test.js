// CS1 (2026-09-10) - THE CITE SHIFT, tools/citeShift.mjs: AUDIT 64's last
// lesson ("the cite mappers need a Ledger arm ... fold it into the first
// before AUDIT 65") landed as one tool. The pure half is pinned here on
// synthetic files and hand-written hunks; the CLI is the same functions
// over git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hunksFromDiff, lineMap, citeSpellings, planDoc, applyPlan, continuations } from '../tools/citeShift.mjs';

test('CS1: hunk headers parse and a pure insertion moves only the lines below it', () => {
  const hunks = hunksFromDiff('@@ -10,0 +11,3 @@ ctx\n+a\n+b\n+c\n@@ -40,2 +44,5 @@\n-x\n-y\n+p\n+q\n+r\n+s\n+t\n');
  assert.deepEqual(hunks, [{ oldStart: 10, oldLen: 0, newStart: 11, newLen: 3 }, { oldStart: 40, oldLen: 2, newStart: 44, newLen: 5 }]);
  const map = lineMap(hunks);
  assert.equal(map(9), 9, 'above the insertion nothing moves');
  assert.equal(map(10), 10, 'the insertion sits AFTER line 10 - line 10 itself stays');
  assert.equal(map(11), 14, 'below it, +3');
  assert.equal(map(39), 42);
  assert.equal(map(40), null, 'inside a rewritten hunk there is no answer');
  assert.equal(map(41), null);
  assert.equal(map(42), 42 + 3 + 3, 'past it, +3 (insert) +3 (the hunk grew by 3)');
  // a bare `@@ -5 +5 @@` (no counts) is one line each
  assert.deepEqual(hunksFromDiff('@@ -5 +5 @@'), [{ oldStart: 5, oldLen: 1, newStart: 5, newLen: 1 }]);
});

test('CS1: the spellings - path, basename, range, the tests\' escaped form, and the Ledger arm', () => {
  const t = 'src/scenes/world.js';
  const pick = (s) => citeSpellings(t).flatMap((re) => [...s.matchAll(re)].map((m) => `${m[0]}|${m[1]}|${m[2] ?? ''}`));
  assert.deepEqual(pick('see `src/scenes/world.js:1234` and world.js:77-80'), ['src/scenes/world.js:1234|1234|', 'world.js:77-80|77|80']);
  assert.deepEqual(pick("/exterior\\.js:(\\d+), world\\.js:2408\\)/"), ['world\\.js:2408|2408|'], 'the regex spelling inside a test');
  assert.deepEqual(pick('worldModes.js:12 is not world.js'), [], 'a longer basename does not match a shorter one');
  assert.deepEqual(pick('otherworld.js:5'), [], 'nor a suffix of another name');
  const L = 'bible/01-Overview/Port-Ledger.md';
  const pickL = (s) => citeSpellings(L).flatMap((re) => [...s.matchAll(re)].map((m) => `${m[0]}|${m[1]}`));
  assert.deepEqual(pickL('(Port-Ledger.md:522) and Port-Ledger row :522 and Ledger row `:601` and Ledger rows `:604`'),
    ['Port-Ledger.md:522|522', 'Port-Ledger row :522|522', 'Ledger row `:601`|601', 'Ledger rows `:604`|604']);
  assert.deepEqual(pickL('a visible row at `:436`'), [], 'a bare "row `:N`" is a JS line as often as a Ledger row - not a spelling');
});

test('CS1: a plan moves only what moved, verifies by content, holds struck lines, and refuses a mismatch', () => {
  // the target: three lines, one inserted above line 2 -> old 2,3 become 3,4
  const oldLines = ['alpha', 'beta', 'gamma'];
  const newLines = ['alpha', 'INSERTED', 'beta', 'gamma'];
  const map = lineMap([{ oldStart: 1, oldLen: 0, newStart: 2, newLen: 1 }]);
  const doc = [
    'see thing.js:1 (unmoved)',
    'see thing.js:2 (moved)',
    '~~struck: thing.js:3~~',
    'range thing.js:2-3',
    'wrong thing.js:9',
  ].join('\n');
  const plan = planDoc({ docText: doc, target: 'src/thing.js', oldLines, newLines, map });
  const by = Object.fromEntries(plan.map((p) => [p.line, p]));
  assert.equal(by[1].status, 'same');
  assert.equal(by[2].status, 'move'); assert.deepEqual(by[2].to, [3, null]);
  assert.equal(by[3].status, 'struck', 'a struck line is held by default');
  assert.equal(by[4].status, 'move'); assert.deepEqual(by[4].to, [3, 4]);
  assert.equal(by[5].status, 'mismatch', 'a line past the file cannot be verified');
  // --struck moves it
  const plan2 = planDoc({ docText: doc, target: 'src/thing.js', oldLines, newLines, map, moveStruck: true });
  assert.equal(plan2.find((p) => p.line === 3).status, 'move');
  // apply rewrites the moves and nothing else
  const out = applyPlan(doc, plan).split('\n');
  assert.equal(out[0], 'see thing.js:1 (unmoved)');
  assert.equal(out[1], 'see thing.js:3 (moved)');
  assert.equal(out[2], '~~struck: thing.js:3~~', 'held');
  assert.equal(out[3], 'range thing.js:3-4');
  assert.equal(out[4], 'wrong thing.js:9', 'a mismatch is left for a person');
  // a rewritten line is INSIDE: no answer, not a guess
  const map2 = lineMap([{ oldStart: 2, oldLen: 1, newStart: 2, newLen: 2 }]);
  const p3 = planDoc({ docText: 'see thing.js:2', target: 'src/thing.js', oldLines, newLines: ['alpha', 'b1', 'b2', 'gamma'], map: map2 });
  assert.equal(p3[0].status, 'inside');
});

test('CS1: the escaped spelling and the Ledger arm apply with their punctuation intact', () => {
  const oldLines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
  const newLines = ['NEW', ...oldLines];
  const map = lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);
  const doc = "/exterior\\.js:(\\d+), world\\.js:20\\)/ and `src/scenes/world.js:5-7`";
  const out = applyPlan(doc, planDoc({ docText: doc, target: 'src/scenes/world.js', oldLines, newLines, map }));
  assert.equal(out, "/exterior\\.js:(\\d+), world\\.js:21\\)/ and `src/scenes/world.js:6-8`");
  const L = 'bible/01-Overview/Port-Ledger.md';
  const ldoc = 'Port-Ledger.md:12, Port-Ledger row :12, Ledger row `:12` and Ledger rows `:12-13`';
  const lout = applyPlan(ldoc, planDoc({ docText: ldoc, target: L, oldLines, newLines, map }));
  assert.equal(lout, 'Port-Ledger.md:13, Port-Ledger row :13, Ledger row `:13` and Ledger rows `:13-14`');
});

test('CS1: bare continuations are reported with their mapped value and never applied', () => {
  const map = lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);
  const doc = 'the fast-travel path (`world.js:1861`, `:1667`); C# `:524-525` is not a world line\nno cite here `:9`';
  const c = continuations(doc, 'src/scenes/world.js', map);
  assert.deepEqual(c.map((x) => [x.line, x.text, x.to]), [[1, '`:1667`', 1668], [1, '`:524-525`', 525]], 'every later token on a citing line is a candidate, C# ones included - a person reads the line');
  const oldLines = Array.from({ length: 2000 }, (_, i) => `l${i}`), newLines = ['NEW', ...oldLines];
  const out = applyPlan(doc, planDoc({ docText: doc, target: 'src/scenes/world.js', oldLines, newLines, map }));
  assert.match(out, /`world\.js:1862`, `:1667`/, 'the explicit cite moved, the continuation did not');
});

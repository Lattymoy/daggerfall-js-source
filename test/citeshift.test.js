// CS1 (2026-09-10) - THE CITE SHIFT, tools/citeShift.mjs: AUDIT 64's last
// lesson ("the cite mappers need a Ledger arm ... fold it into the first
// before AUDIT 65") landed as one tool. The pure half is pinned here on
// synthetic files and hand-written hunks; the CLI is the same functions
// over git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hunksFromDiff, lineMap, citeSpellings, planDoc, applyPlan, continuations, continuationsIn, regionStops, ANY_CITE, CONTINUATION, SELF_DOCS } from '../tools/citeShift.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

test('RF3: bare continuations MOVE under the content check - every spelling, up to the next cite of any file, a C# one included', () => {
  const oldLines = Array.from({ length: 6000 }, (_, i) => `l${i}`), newLines = ['NEW', ...oldLines];   // long enough for the real numbers below
  const map = lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);
  const t = 'src/scenes/world.js';
  const plan = (doc) => planDoc({ docText: doc, target: t, oldLines, newLines, map });
  const out = (doc) => applyPlan(doc, plan(doc));
  assert.equal(out('the fast-travel path (`world.js:1861`, `:1667`); C# `:524-525` is not a world line'),
    'the fast-travel path (`world.js:1862`, `:1668`); C# `:525-526` is not a world line',
    'the backtick continuation moves; the C# one on the SAME citing region moves too when the target really has such lines - a person still reads a line that mixes the two (the old CS1 caveat, unchanged)');
  assert.equal(out('FLAG ONLY, presence-gated, exactly as world.js:4371/:4384 and'), 'FLAG ONLY, presence-gated, exactly as world.js:4372/:4385 and', 'the /:N pair');
  assert.equal(out("expressions are world.js:5681/5681's verbatim"), "expressions are world.js:5682/5682's verbatim", 'the /N pair');
  assert.equal(out('(world.js:757) and spliced out at the end of it (:939).'), '(world.js:758) and spliced out at the end of it (:940).', 'the (:N form');
  // RF4: the SPACED slash - the form that survived the MAC-D shift and left CD7 a backwards range
  assert.equal(out('the held Set and the edge ring (world.js:1861 / :1867 / :1871)'), 'the held Set and the edge ring (world.js:1862 / :1868 / :1872)', 'the "/ :N" pair, spaces and all');
  assert.equal(out('world.js:1861 and 6 / 10 of them'), 'world.js:1862 and 6 / 10 of them', 'a spaced slash with NO colon is prose, not a cite');
  // RF5: the prose connector - a cite and its tail joined by a word
  assert.equal(out('(world.js:1861 against :1867)'), '(world.js:1862 against :1868)', 'the "against :N" tail moves with its head');
  assert.equal(out('world.js:1861 and the case against 10 of them'), 'world.js:1862 and the case against 10 of them', 'a connector with NO colon is prose, not a cite');
  assert.equal(out('see world.js:10, :12, :14-15 and :20'), 'see world.js:11, :13, :15-16 and :20', 'the ", :N" form and a range; a bare " :N" after "and" is no spelling (too loose to be one)');
  assert.equal(out('world.js:100 sets it; SerializablePlayer.cs:421 reads it (:423)'), 'world.js:101 sets it; SerializablePlayer.cs:421 reads it (:423)', 'a C# cite stops the region: its (:N) is the C#\'s');
  assert.equal(out('world.js:100 and talk.js:50/:60'), 'world.js:101 and talk.js:50/:60', 'another file\'s continuation is its own');
  assert.equal(out('no cite here `:9`'), 'no cite here `:9`', 'a continuation with no cite before it is nothing');
  // a continuation that would land on different text is held, like any cite
  const drifted = ['a', 'b', 'c'], driftedNew = ['a', 'X', 'b', 'c'];
  const map2 = lineMap([{ oldStart: 1, oldLen: 0, newStart: 2, newLen: 1 }]);
  const p = planDoc({ docText: 'thing.js:2/:3', target: 'src/thing.js', oldLines: drifted, newLines: ['a', 'X', 'b', 'Q'], map: map2 });
  assert.deepEqual(p.map((x) => [x.kind, x.status]), [['cite', 'move'], ['cont', 'mismatch']], 'the primary moves, the drifted continuation is held');
  assert.equal(applyPlan('thing.js:2/:3', p), 'thing.js:3/:3');
  assert.deepEqual(planDoc({ docText: 'thing.js:2/:3', target: 'src/thing.js', oldLines: drifted, newLines: driftedNew, map: map2 }).map((x) => x.status), ['move', 'move']);
  // the old report view still answers, off the plan
  assert.deepEqual(continuations('see world.js:10, :12', t, map, { oldLines, newLines }).map((c) => [c.text, c.from, c.to, c.status]), [[', :12', 12, 13, 'move']]);
  // the two regexes are one law, shared with citeMerge
  assert.ok(ANY_CITE.source.includes('|cs)') && CONTINUATION.source.includes('\\(:'), 'the .cs stop and the (: opener');
  assert.match(readFileSync(join(root, 'tools/citeMerge.mjs'), 'utf8'), /import \{ hunksFromDiff, lineMap, citeSpellings, regionStops, continuationsIn, SELF_DOCS \} from '.\/citeShift\.mjs';/, 'citeMerge imports them (CITE-SLASH, CITE-CS: through the two helpers that read ANY_CITE and CONTINUATION)');
  assert.doesNotMatch(readFileSync(join(root, 'tools/citeMerge.mjs'), 'utf8'), /\b(ANY_CITE|CONTINUATION|CS_MEMBER)\b|function\*? *(continuationsIn|regionStops)/, 'and declares no copy, nor reads a regex past the helpers');
});

test('CITE-SLASH: a bare slash continues only the chain it touches - "8076/8077" a sentence after a cite is two message ids, not world.js:8077 (mutant: the touch dropped)', () => {
  const oldLines = Array.from({ length: 9000 }, (_, i) => `l${i}`), newLines = ['NEW', ...oldLines];   // long enough that line 8077 exists and passes the content check
  const map = lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);
  const out = (doc) => applyPlan(doc, planDoc({ docText: doc, target: 'src/scenes/world.js', oldLines, newLines, map }));
  // the Ledger row that found it: the id moved at every shift (8076/11995, then 8076/12009 on main, 8076/12322 on the arc)
  assert.equal(out('to this very seam (`answerPipeline.js:262`, `world.js:3714`). Work bands to 8076/8077 where DFU refuses with 8075'),
    'to this very seam (`answerPipeline.js:262`, `world.js:3715`). Work bands to 8076/8077 where DFU refuses with 8075');
  // the chain still moves: a slash against the cite, against a continuation, after a range, and a colon form anywhere
  assert.equal(out("expressions are world.js:5681/5682's verbatim"), "expressions are world.js:5682/5683's verbatim");
  assert.equal(out('see world.js:10, :12/14 and (:20/21)'), 'see world.js:11, :13/15 and (:21/22)');
  assert.equal(out('world.js:100-120/130'), 'world.js:101-121/131');
  // prose after a cite keeps its own numbers, however it spells them
  assert.equal(out('world.js:1861 leaves 33/33 dead, 0.9/0.7/0.5 and rank-6/8 alone'), 'world.js:1862 leaves 33/33 dead, 0.9/0.7/0.5 and rank-6/8 alone');
  assert.deepEqual([...continuationsIn('world.js:1/2 and 3/4', 'world.js:1'.length, 'world.js:1/2 and 3/4'.length)].map(({ m }) => m[0]), ['/2'], 'the helper yields the touching slash alone');
});

test('RF3: a test\'s escaped literal follows the row it pins - held while the docs carry the number on struck lines only', () => {
  const oldLines = ['a', 'b', 'c'], newLines = ['a', 'X', 'b', 'c'];
  const map = lineMap([{ oldStart: 1, oldLen: 0, newStart: 2, newLen: 1 }]);
  const t = 'src/scenes/dungeonContext.js';
  const testDoc = "['bible/01-Overview/Port-Ledger.md', /`exterior\\.js:(\\d+)`, `dungeonContext\\.js:2`/]";
  // no hold: the literal moves with the target
  assert.equal(applyPlan(testDoc, planDoc({ docText: testDoc, target: t, oldLines, newLines, map })), testDoc.replace(':2`', ':3`'));
  // the CLI's hold: the docs carry :2 on a struck line alone
  const held = planDoc({ docText: testDoc, target: t, oldLines, newLines, map, holdEscaped: new Set([2]) });
  assert.deepEqual(held.map((p) => [p.spelling, p.status]), [['escaped', 'pinned-struck']]);
  assert.equal(applyPlan(testDoc, held), testDoc, 'the quote of a struck row stays with the row');
  // the same number on an UNSTRUCK doc line is not held (the CLI only holds numbers the docs carry struck alone)
  const both = planDoc({ docText: 'live dungeonContext.js:2\n~~struck dungeonContext.js:2~~', target: t, oldLines, newLines, map });
  assert.deepEqual(both.map((p) => p.status), ['move', 'struck']);
  const cli = readFileSync(join(root, 'tools/citeShift.mjs'), 'utf8');
  assert.match(cli, /const holdEscaped = new Set\(\[\.\.\.struckNums\]\.filter\(\(n\) => !movedNums\.has\(n\)\)\);/, 'the CLI derives the hold from pass one');
  assert.match(cli, /if \(p\.spelling === 'escaped'\) continue;/, 'a literal never votes for its own hold');
});

test('RF3: the tools\' own fixtures are not docs', () => {
  assert.deepEqual([...SELF_DOCS], ['tools/citeShift.mjs', 'tools/citeMerge.mjs', 'test/citeshift.test.js', 'test/citemerge.test.js']);
  // the LAW is that each tool filters its doc list by SELF_DOCS - not the
  // punctuation that happened to follow it. The old pin quoted citeMerge's
  // `))) {` and went red when the struck law (2026-09-15) lifted that list
  // into a `const docs`, which changed nothing about the rule.
  for (const tool of ['tools/citeShift.mjs', 'tools/citeMerge.mjs']) {
    assert.match(readFileSync(join(root, tool), 'utf8'), /\.filter\([^\n]*!SELF_DOCS\.includes\(f\)\)[^\n]*\/\/ RF3/,
      `${tool} filters its doc list by SELF_DOCS`);
  }
});

test('CITE-CS: a C# member, or a table cell\'s edge, ends a cite\'s region as a `.cs:N` cite does - the Ledger\'s DFU column is C#, not the row\'s JS file (mutant: either stop dropped)', () => {
  const oldLines = Array.from({ length: 2000 }, (_, i) => `l${i}`), newLines = ['NEW', ...oldLines];
  const map = lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);
  const out = (doc) => applyPlan(doc, planDoc({ docText: doc, target: 'src/scenes/world.js', oldLines, newLines, map }));
  // the Ledger row: the port's cite moves, the DFU column's lines are DFU's (they had moved from :689 to :874)
  assert.equal(out('| **Work bands high** - the seam (`world.js:1714`, `:1716`) | TalkManager.GetReactionToPlayer_0_1_2 (:689-693) | Talk arc |'),
    '| **Work bands high** - the seam (`world.js:1715`, `:1717`) | TalkManager.GetReactionToPlayer_0_1_2 (:689-693) | Talk arc |');
  assert.equal(out('| `world.js:100` | TalkManager reaction seed (:744-748) |'), '| `world.js:101` | TalkManager reaction seed (:744-748) |', 'a DFU cell with no member name: the cell\'s edge stops it');
  // in prose, the member name stops it; a JS continuation before the member still moves
  assert.equal(out('world.js:1861 and (:1867) wrap it; the one underneath: DaggerfallRestWindow.CanRest (:762-831)'),
    'world.js:1862 and (:1868) wrap it; the one underneath: DaggerfallRestWindow.CanRest (:762-831)');
  // a JS name is camelCase after its dot, and a line that is not a table row has no cells: `a || b` is code
  assert.equal(out('world.js:10 then terrainGen.setRoads (:12)'), 'world.js:11 then terrainGen.setRoads (:13)');
  assert.equal(out('world.js:10 falls back `a || b` (:12)'), 'world.js:11 falls back `a || b` (:13)');
  assert.deepEqual(regionStops('| a `world.js:1` | B.Cc (:2) |'), [0, 5, 17, 19, 29], 'the cite, the member and the cells\' edges, in order');
});

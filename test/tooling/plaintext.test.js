// PLAIN-TEXT (2026-10-26; the owner: "We need a law to reduce over explanatory text + reduce the amount of ai-like
// crafted text"). bible/Home.md, SAY IT ONCE, PLAINLY: player strings, comments and the bible are held to the limits in
// tools/plainText.mjs. What was already past them is in tools/plainTextBaseline.json, which may only go down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { measure, verdict, seeded, seedFrom, holdsLaw, stringBreach, renderings, messageWords, commentExcess, paragraphExcess, BASELINE, ROOT, PARTS, STRING_WORDS_MAX, SENTENCE_WORDS_MAX, COMMENT_LINES_MAX, PARAGRAPH_WORDS_MAX } from '../../tools/plainText.mjs';

const base = JSON.parse(readFileSync(new URL(`../../${BASELINE}`, import.meta.url), 'utf8'));
const none = Object.fromEntries(PARTS.map((p) => [p, {}]));
/** git's empty tree: a ref that holds nothing, so no baseline. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

test('PLAIN-TEXT the limits are the law\'s: 40 words a string, 25 a sentence, 8 lines a comment block, 150 words a bible paragraph', () => {
  assert.deepEqual([STRING_WORDS_MAX, SENTENCE_WORDS_MAX, COMMENT_LINES_MAX, PARAGRAPH_WORDS_MAX], [40, 25, 8, 150]);
});

test('PLAIN-TEXT a string: plain and short passes; too long, a sentence too long, or padding fails', () => {
  assert.equal(stringBreach('You cannot rest with enemies nearby.'), null);
  assert.equal(stringBreach('Your game could not be saved just now.'), null, '"just now" is plain English');
  assert.deepEqual(stringBreach(Array(41).fill('word.').join(' ')), { words: 41, sentence: 1, padding: [] });
  assert.equal(stringBreach(`${Array(26).fill('word').join(' ')}.`).sentence, 26);
  assert.equal(stringBreach('Simply press the key.').padding.length, 1);
  assert.equal(stringBreach('It is not just a sentence.').padding.length, 1);
  assert.equal(stringBreach('A seamless journey.').padding.length, 1);
  assert.equal(stringBreach('{n, plural, one {# piece} other {# pieces}} made.'), null);
});

test('PLAIN-TEXT AUDIT HORIZONTAL PT3: a message is read in each of its renderings - every plural or select branch, an argument one word - so a long branch breaks the law whether or not it holds an argument (mutants: a branch read as one word; the branches unread)', () => {
  assert.deepEqual(renderings('{n, plural, one {# piece} other {# pieces}} made.'), ['# piece made.', '# pieces made.']);
  assert.equal(messageWords('{n, plural, one {# piece} other {# pieces}} made.'), 3, 'the plural is the words it renders, not seven tokens');
  assert.equal(messageWords('{xp, number} XP to rank {rank}'), 5, 'an argument is one word');
  const long = Array(60).fill('word').join(' ');
  assert.deepEqual(stringBreach(`{n, plural, one {${long}.} other {${long}.}}`), { words: 60, sentence: 60, padding: [] }, 'no argument in it');
  assert.deepEqual(stringBreach(`{n, plural, one {${long} {x}.} other {x.}}`), { words: 61, sentence: 61, padding: [] }, 'one holding an argument');
  assert.equal(stringBreach(`Done{full, select, yes {. ${Array(30).fill('w').join(' ')}} other {.}}`).sentence, 30, 'a select\'s branch too');
  assert.deepEqual(renderings('a {broken'), ['a {broken'], 'unbalanced braces are the text itself');
});

test('PLAIN-TEXT AUDIT HORIZONTAL PT1, PT2: a comment block\'s lines past 8 and a paragraph\'s words past 150 are its excess, summed a file or a page - a block or a paragraph that grows grows it; a blank line ends no block, a code line does; a table is never a paragraph (mutants: the excess a count; a blank line ending a block; the last block dropped)', () => {
  const block = (n) => `${Array(n).fill('// a line').join('\n')}\nconst x = 1;\n`;
  assert.equal(commentExcess(block(8)), 0);
  assert.equal(commentExcess(block(9)), 1);
  assert.equal(commentExcess(block(69)), 61, 'a long block that grows by sixty lines grows its file\'s excess by sixty');
  assert.equal(commentExcess(`/*\n${Array(8).fill(' * a line').join('\n')}\n */\nconst x = 1;\n`), 2);
  assert.equal(commentExcess(`${block(9)}${block(12)}`), 5, 'two blocks, a code line between');
  assert.equal(commentExcess(Array(9).fill('// a line').join('\n')), 1, 'a block that ends the file counts');
  const split = [8, 8, 8].map((n) => Array(n).fill('// a line').join('\n')).join('\n\n');
  assert.equal(commentExcess(`${split}\nconst x = 1;\n`), 16, 'twenty-four comment lines split by blank lines are one block');
  assert.equal(paragraphExcess(Array(150).fill('w').join(' ')), 0);
  assert.equal(paragraphExcess(`${Array(151).fill('w').join(' ')}\n\n${Array(151).fill('w').join(' ')}`), 2);
  assert.equal(paragraphExcess(Array(551).fill('w').join(' ')), 401, 'a long paragraph grown by 400 words is 400 more');
  assert.equal(paragraphExcess(`| ${Array(200).fill('w').join(' ')} |`), 0);
  assert.equal(commentExcess(`${block(8).replace('const x = 1;\n', '')}// world271: a note\n// acct198: another\n${block(8)}`), 0, 'PT6: a version log\'s entry is a block of its own - a bump grows nothing');
  assert.equal(commentExcess(`${Array(9).fill('// world271 is no entry').join('\n')}\nconst x = 1;\n`), 1, 'a line that only names a version is a comment');
  const item = (n) => `- ${Array(n).fill('w').join(' ')}`;
  assert.equal(paragraphExcess([item(140), item(140), item(151)].join('\n')), 2, 'a top-level list item is its own paragraph - an index\'s next entry is not its last grown');
  assert.equal(paragraphExcess(`${item(99)}\n  ${Array(60).fill('w').join(' ')}`), 10, 'an item\'s indented lines are its own');
  const was = { ...none, comments: { 'a.js': commentExcess(block(12)) }, bible: { 'p.md': paragraphExcess(Array(851).fill('w').join(' ')) } };
  const grown = { ...none, comments: { 'a.js': commentExcess(block(13)) }, bible: { 'p.md': paragraphExcess(Array(967).fill('w').join(' ')) } };
  assert.deepEqual(verdict(grown, was).over, ['comments a.js: 5 (allowed 4)', 'bible p.md: 817 (allowed 701)'], 'the slice\'s own two growths, seen');
});

test('PLAIN-TEXT nothing grows past the law: every player string, every source file and every bible page is within its limit or its baseline, and a baseline lowered by a cleanup is written lower (node tools/plainText.mjs --lower)', () => {
  const { over, stale } = verdict(measure(ROOT), base);
  assert.deepEqual(over, [], 'past the law - shorten it, never raise the baseline');
  assert.deepEqual(stale, [], 'text got plainer - lower the baseline: node tools/plainText.mjs --lower');
});

test('PLAIN-TEXT the baseline is the five parts, each listing only what breaks the law, and only ever with its excess', () => {
  assert.deepEqual(Object.keys(base), [...PARTS]);
  for (const part of PARTS) {
    for (const [k, n] of Object.entries(base[part])) assert.ok(Number.isSafeInteger(n) && n > 0, `${part} ${k}`);
  }
});

test('PLAIN-TEXT a merge from a base without the law admits the base\'s own excess and no more: past the baseline up to the base\'s figure, never past it, never an entry the base does not have, and never lower than written (mutants: the base\'s cap unread; an absent entry admitted)', () => {
  const was = { ...none, comments: { 'a.js': 2 }, bible: { 'p.md': 5 } };
  const now = { ...none, strings: { k: 4 }, sentences: { k: 3 }, comments: { 'a.js': 4, 'b.js': 1 }, bible: { 'p.md': 3 } };
  const at = { ...none, sentences: { k: 1 }, comments: { 'a.js': 3 }, bible: { 'p.md': 9 } };
  assert.deepEqual(seeded(was, now, at), { ...none, sentences: { k: 1 }, comments: { 'a.js': 3 }, bible: { 'p.md': 5 } });
});

test('PLAIN-TEXT AUDIT HORIZONTAL PT4: a seed is refused from a ref that holds the law already - the branch\'s own HEAD admitted everything it wrote - and read from one that does not (mutants: the ref unread; the refusal gone)', () => {
  assert.equal(holdsLaw('HEAD'), true);
  assert.equal(holdsLaw(EMPTY_TREE), false);
  assert.equal(seedFrom('HEAD', base, { ...none, strings: { 'new.key': 50 } }), null, 'refused: nothing admitted');
});

test('PLAIN-TEXT the verdict: an entry the baseline does not list is over at its first breach; one the baseline lists higher than today is stale until lowered; a string\'s sentence and padding are held as its words are (mutants: an unlisted entry let through)', () => {
  assert.deepEqual(verdict({ ...none, strings: { k: 1 } }, none), { over: ['strings k: 1 (allowed 0)'], stale: [] });
  assert.deepEqual(verdict({ ...none, sentences: { k: 2 } }, { ...none, sentences: { k: 1 } }).over, ['sentences k: 2 (allowed 1)'], 'a longer sentence at the same word count');
  assert.deepEqual(verdict({ ...none, padding: { k: 1 } }, none).over, ['padding k: 1 (allowed 0)']);
  assert.deepEqual(verdict(none, { ...none, bible: { 'p.md': 2 } }), { over: [], stale: ['bible p.md: 0 (baseline 2)'] });
  assert.deepEqual(verdict({ ...none, comments: { 'a.js': 2 } }, { ...none, comments: { 'a.js': 2 } }), { over: [], stale: [] });
});

test('PLAIN-TEXT LEGIBLE 3: a cite into our code is one word however long its quote, and a code line that opens with a JSDoc cast is code, not comment (mutants: the anchor counted; the cast read as comment)', () => {
  const words = Array.from({ length: 150 }, () => 'word').join(' ');
  assert.equal(paragraphExcess(`${words} world.js:"const a = b + c + d + e + f"`), 1, 'the anchor one word');
  assert.equal(paragraphExcess(`${words} a b c d e f`), 6);
  const block = Array.from({ length: 8 }, () => '// why').join('\n');
  assert.equal(commentExcess(`/** @type {any} */ (x).y();\n${block}`), 0, 'the cast line is code');
  assert.equal(commentExcess(`/** a note */\n${block}`), 1, 'a comment alone on its line is comment');
  assert.equal(commentExcess(`/** a note */ // and more\n${block}`), 1);
});

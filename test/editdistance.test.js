// U41: the travel map's FIND is a weighted edit distance, not a
// prefix match - EditDistance.cs + DaggerfallDistance.cs. These pin
// the cost table (separators are cheap, letters are not), the seek
// and trim paddings that make an exact prefix free and a word
// boundary nearly free, the relevance curve, the heap's ordering law,
// the upperBound early-out, and MatchesCutOff's two bands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDaggerfallDistance, EditDistance, MatchesCutOff, getRelevance, getNumberOfWords, isSeparator,
  PREFIX_WORDS_PADDING, WORD_PREFIX_PADDING, WORD_SUFFIX_PADDING, SUFFIX_WORDS_PADDING,
} from '../src/systems/editDistance.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} !~ ${b}`);

test('editDistance: the separators and the four paddings are DFU\'s', () => {
  assert.equal(isSeparator(' '), true);
  assert.equal(isSeparator('-'), true);
  assert.equal(isSeparator("'"), true);
  assert.equal(isSeparator('_'), false);
  assert.equal(getNumberOfWords("the kings' rest", 0, 15), 3,
    'SEPARATORS, not words - DFU\'s own name lies, and the count is what the padding multiplies');
  assert.deepEqual(
    [PREFIX_WORDS_PADDING, WORD_PREFIX_PADDING, WORD_SUFFIX_PADDING, SUFFIX_WORDS_PADDING],
    [0.8, 0.8, 0.4, 0.4]);
  near(getRelevance(0), 1, 'a perfect match is relevance 1');
  near(getRelevance(10), Math.exp(-1), 'the drop is 0.1 per unit of distance');
});

test('editDistance: the distances the find box actually produces', () => {
  const d = getDaggerfallDistance();
  near(d.getDistance('wayrest', 'wayrest'), 0, 'exact');
  // GetDistance takes ALREADY-canonized strings; the canonizer runs
  // in setDictionary and findBestMatches, exactly as C# arranges it
  assert.ok(d.getDistance('WAYREST', 'wayrest') > 0, 'GetDistance itself does not canonize');
  d.setDictionary(['Wayrest']);
  near(d.findBestMatches('  WAYREST  ', 1000)[0].relevance, 1, 'the search canonizes both sides');
  // a PREFIX is free to seek and cheap to trim: "rest" is four
  // characters of one word, 0.4 each
  near(d.getDistance('way', 'wayrest'), 1.6, 'prefix');
  // a SUFFIX is free to trim and costs the word-prefix padding to
  // seek: three characters at 0.8
  near(d.getDistance('rest', 'wayrest'), 2.4, 'suffix');
  // one MISSING letter inside the word is a real edit
  near(d.getDistance('wayrst', 'wayrest'), 12, 'one deletion at the letter price');
  // one missing letter off the END is only the trim padding
  near(d.getDistance('daggerfal', 'daggerfall'), 0.4);
  // and the same query reaches into a longer name for 0.4 more
  near(d.getDistance('daggerfal', 'daggerfall chapel'), 0.8);
  // a separator is cheap to insert (3) where a letter is not (12)
  near(d.getDistance('kings rest', "kings' rest"), 3);
  near(d.getDistance('kingsrest', 'kings rest'), 3, 'a missing space costs a separator');
});

test('editDistance: findBestMatches orders by relevance, then by text ASCENDING', () => {
  const d = getDaggerfallDistance();
  d.setDictionary(['Wayrest', 'Waycrest Manor', 'Gothway Garden', 'Daggerfall']);
  const matches = d.findBestMatches('way', 1000);
  assert.deepEqual(matches.map((m) => m.text),
    ['Wayrest', 'Waycrest Manor', 'Gothway Garden', 'Daggerfall']);
  assert.ok(matches[0].relevance > matches[1].relevance);
  // the tie-break: string.Compare(other.text, this.text) reversed by
  // the reverse dump, so equal relevances come back ascending
  const tie = getDaggerfallDistance();
  tie.setDictionary(['Cave', 'Bath', 'Alta']);
  const tied = tie.findBestMatches('zzzz', 1000);
  assert.deepEqual(tied.map((m) => m.text), ['Alta', 'Bath', 'Cave']);
  assert.equal(new Set(tied.map((m) => m.relevance)).size, 1, 'all three really are tied');
  // SetDictionary dedupes by DISPLAY string (C#'s indexer, not Add)
  const dupes = getDaggerfallDistance();
  dupes.setDictionary(['Tavern', 'Tavern', 'Tavern']);
  assert.equal(dupes.findBestMatches('tavern', 1000).length, 1);
});

test('editDistance: ntop drops the worst, and upperBound prunes to infinity', () => {
  const d = getDaggerfallDistance();
  d.setDictionary(['Wayrest', 'Waycrest Manor', 'Gothway Garden', 'Daggerfall']);
  const two = d.findBestMatches('way', 2);
  assert.deepEqual(two.map((m) => m.text), ['Wayrest', 'Waycrest Manor'], 'the heap keeps the best ntop');
  assert.equal(d.getDistance('zzzzzz', 'wayrest', 1), Infinity,
    'once no cell of a row is under the bound, no completion can be');
  assert.ok(Number.isFinite(d.getDistance('zzzzzz', 'wayrest')), 'and an unbounded call still answers');
});

test('editDistance: the six cost functions are the whole configuration', () => {
  // charge the seek and the trim and plain Levenshtein falls out -
  // the class is generic, exactly as C#'s constructor is
  const plain = new EditDistance((s) => s, () => 1, () => 1, () => 1,
    (s, i) => i, (s, i) => s.length - i);
  assert.equal(plain.getDistance('kitten', 'sitting'), 3, 'the textbook answer');
  assert.equal(plain.getDistance('abc', 'abc'), 0);
  // with FREE seek and trim it becomes a substring search instead,
  // which is what DFU's paddings are tuned to approach
  const substring = new EditDistance((s) => s, () => 1, () => 1, () => 1, () => 0, () => 0);
  assert.equal(substring.getDistance('rest', 'wayrest'), 0, 'a contained needle costs nothing');
});

test('editDistance: MatchesCutOff keeps only perfect matches when one exists', () => {
  const perfect = new MatchesCutOff(1);
  assert.equal(perfect.threshold, 1);
  assert.equal(perfect.keep(1), true);
  assert.equal(perfect.keep(0.999999), false);
  const half = new MatchesCutOff(0.8);
  assert.equal(half.threshold, 0.4);
  assert.equal(half.keep(0.4), true, 'the gate is >=');
  assert.equal(half.keep(0.39), false);
});

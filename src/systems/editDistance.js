// W1-i: THE FUZZY FIND - EditDistance.cs + Distance.cs +
// DaggerfallDistance.cs (MIT, Daggerfall Workshop), the matcher
// behind the travel map's FIND box. DFU does not do a prefix
// search there: it runs a weighted edit distance over every
// location name in the OPEN region and keeps the best matches by
// relevance, which is why "daggerfal" finds Daggerfall and
// "wayrst" finds Wayrest.
//
// VERBATIM: the cost table (a separator inserts/deletes at 3 and
// every other character at 12; a replacement is 18 unless both
// sides are separators, then 3), the seek/trim paddings that make
// an exact prefix free and a word boundary cheap
// (prefixWordsPadding 0.8, wordPrefixPadding 0.8, wordSuffixPadding
// 0.4, suffixWordsPadding 0.4), the row/future_row DP with its
// upperBound early-out (EditDistance.cs:83-146), relevance =
// exp(-0.1 * distance) (:213-217), and the heap's ordering law -
// relevance first, then string.Compare(other.text, this.text), so
// equal relevances come back in ASCENDING text order (:37-46,
// :219-248 dumps the heap in reverse).
//
// RECORDED DEPARTURES:
// - C# computes in float32; JS has one number type. The port
//   follows the house convention (no Math.fround anywhere in
//   src/), so a tie that float32 rounding would break can land
//   the other way. Nothing in the window depends on it: the
//   relevance CUTOFF is a >= test, and both sides of an exact tie
//   are kept.
// - SortedDictionary<string,string> iterates by the CURRENT
//   CULTURE's string order; this sorts ORDINAL. The iteration
//   order is only observable once the heap starts dropping
//   results, which needs more names than ntop - and the window
//   passes ntop = 1000 against regions of a few hundred
//   locations, so it never does.

/** DaggerfallDistance.IsSeparator (:64-67). */
export const isSeparator = (c) => c === ' ' || c === '-' || c === '\'';

/** DaggerfallDistance.GetNumberOfWords (:69-77) - separators in
 *  [start, stop), not words. DFU's name; DFU's meaning. */
export function getNumberOfWords(s, start, stop) {
  let count = 0;
  for (let i = start; i < stop; i++) if (isSeparator(s[i])) count++;
  return count;
}

/** DistanceMatch (Distance.cs:5-15): { text, relevance } with
 *  relevance 0 (low) .. 1 (high). */
export function distanceMatch(text, relevance) { return { text, relevance }; }

/** EditDistance.GetRelevance (:213-217). */
const RELEVANCE_DROP = 0.1;
export const getRelevance = (distance) => Math.exp(-RELEVANCE_DROP * distance);

/** InternalMatchResult.CompareTo (:37-46) as a JS comparator:
 *  relevance ascending, then the REVERSED text compare (DFU
 *  compares other.text to this.text), which is what puts equal
 *  relevances back in ascending text order after the reverse dump. */
function compareMatches(a, b) {
  if (a.relevance < b.relevance) return -1;
  if (a.relevance > b.relevance) return 1;
  // string.Compare(other.text, this.text, InvariantCulture) - ordinal here
  if (b.text < a.text) return -1;
  if (b.text > a.text) return 1;
  return 0;
}

/** EditDistance.PriorityQueue (:149-210) - a min-heap under
 *  compareMatches, kept verbatim because the drop path reads
 *  Peek() after every Dequeue. */
class PriorityQueue {
  constructor() { this.data = []; }

  enqueue(item) {
    this.data.push(item);
    let childIndex = this.data.length - 1;
    while (childIndex > 0) {
      const parentIndex = Math.trunc((childIndex - 1) / 2);
      if (compareMatches(this.data[childIndex], this.data[parentIndex]) >= 0) break;
      const tmp = this.data[childIndex];
      this.data[childIndex] = this.data[parentIndex];
      this.data[parentIndex] = tmp;
      childIndex = parentIndex;
    }
  }

  dequeue() {
    if (this.data.length === 0) throw new Error('PriorityQueue is empty');
    let lastIndex = this.data.length - 1;
    const frontItem = this.data[0];
    this.data[0] = this.data[lastIndex];
    this.data.pop();
    --lastIndex;
    let parentIndex = 0;
    for (;;) {
      let leftChildIndex = parentIndex * 2 + 1;
      if (leftChildIndex > lastIndex) break;
      const rightChildIndex = leftChildIndex + 1;
      if (rightChildIndex <= lastIndex
        && compareMatches(this.data[rightChildIndex], this.data[leftChildIndex]) < 0) {
        leftChildIndex = rightChildIndex;
      }
      if (compareMatches(this.data[parentIndex], this.data[leftChildIndex]) <= 0) break;
      const tmp = this.data[parentIndex];
      this.data[parentIndex] = this.data[leftChildIndex];
      this.data[leftChildIndex] = tmp;
      parentIndex = leftChildIndex;
    }
    return frontItem;
  }

  peek() {
    if (this.data.length === 0) throw new Error('PriorityQueue is empty');
    return this.data[0];
  }

  count() { return this.data.length; }
}

/** EditDistance (EditDistance.cs:9-250). The six cost functions are
 *  the whole configuration; DaggerfallDistance below is the one
 *  configuration the game ships. */
export class EditDistance {
  constructor(canonizeString, insertCost, deleteCost, replaceCost, seekCost, trimCost) {
    this.canonizeString = canonizeString;
    this.insertCost = insertCost;
    this.deleteCost = deleteCost;
    this.replaceCost = replaceCost;
    this.seekCost = seekCost;
    this.trimCost = trimCost;
    this.dictionary = [];
  }

  /** SetDictionary (:70-81): display -> canonized, DEDUPED by
   *  display (C#'s indexer assignment, which never throws) and
   *  ordered (SortedDictionary; ordinal here - see the header). */
  setDictionary(dictionary) {
    const byDisplay = new Map();
    for (const s of dictionary) byDisplay.set(s, this.canonizeString(s));
    this.dictionary = [...byDisplay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  /** GetDistance (:83-146). upperBound prunes: once no cell of a
   *  row is under it, no completion can be either. */
  getDistance(s1, s2, upperBound = Infinity) {
    const l1 = s1.length;
    const l2 = s2.length;

    let row = new Float64Array(l2 + 1);
    for (let j = 0; j <= l2; j++) row[j] = this.seekCost(s2, j);

    let futureRow = new Float64Array(l2 + 1);

    for (let i = 0; i < l1; i++) {
      let foundLesser = upperBound === Infinity;

      futureRow[0] = row[0] + this.deleteCost(s1[i]);
      if (!foundLesser && futureRow[0] <= upperBound) foundLesser = true;

      for (let j1 = 0; j1 < l2; j1++) {
        if (s1[i] === s2[j1]) {
          futureRow[j1 + 1] = row[j1];
        } else {
          futureRow[j1 + 1] = Math.min(
            Math.min(row[j1 + 1] + this.deleteCost(s1[i]),
              futureRow[j1] + this.insertCost(s2[j1])),
            row[j1] + this.replaceCost(s1[i], s2[j1]));
        }
        if (!foundLesser && futureRow[j1 + 1] <= upperBound) foundLesser = true;
      }
      if (!foundLesser) return Infinity;

      const temp = row;
      row = futureRow;
      futureRow = temp;
    }

    let min = Number.MAX_VALUE;   // C#'s float.MaxValue seed, kept
    for (let j = 0; j <= l2; j++) {
      const cost = row[j] + this.trimCost(s2, j);
      if (cost < min) min = cost;
    }
    return min;
  }

  /** FindBestMatches (:219-248). Returns DistanceMatch[] ordered
   *  best first. */
  findBestMatches(needle, ntop) {
    const canonizedNeedle = this.canonizeString(needle);
    const kept = new PriorityQueue();
    let worseKeptDistance = Infinity;
    for (const [display, canonized] of this.dictionary) {
      const answerDistance = this.getDistance(canonizedNeedle, canonized, worseKeptDistance);
      if (answerDistance < worseKeptDistance) {
        kept.enqueue({ text: display, distance: answerDistance, relevance: getRelevance(answerDistance) });
        if (kept.count() > ntop) {
          kept.dequeue();
          worseKeptDistance = kept.peek().distance;
        }
      }
    }
    // Dumped in reverse so the highest relevance lands first.
    const result = new Array(kept.count());
    for (let i = kept.count(); i-- > 0;) {
      const m = kept.dequeue();
      result[i] = distanceMatch(m.text, m.relevance);
    }
    return result;
  }
}

// DaggerfallDistance.GetDistance's paddings (:8-11) - "the cheaper
// the padding, the closer we get to plain substring search".
export const PREFIX_WORDS_PADDING = 0.8;
export const WORD_PREFIX_PADDING = 0.8;
export const WORD_SUFFIX_PADDING = 0.4;
export const SUFFIX_WORDS_PADDING = 0.4;

/** DaggerfallDistance.GetDistance (:5-61) - the one configuration
 *  the game ships, cost for cost. */
export function getDaggerfallDistance() {
  return new EditDistance(
    (s) => s.trim().toLowerCase(),
    // Inserting/deleting separators is cheap
    (c) => (isSeparator(c) ? 3 : 12),
    (c) => (isSeparator(c) ? 3 : 12),
    // fixing separators is cheap
    (c1, c2) => {
      if (isSeparator(c1) && isSeparator(c2)) return 3;
      return 18;
    },
    (s, stop) => {
      // exact prefix is very good
      if (stop === 0) return 0;
      // beginning of word is good
      const lastChar = s[stop - 1];
      if (isSeparator(lastChar)) return PREFIX_WORDS_PADDING * getNumberOfWords(s, 0, stop);
      // Otherwise small cost of longer prefixes
      let beginningOfWord = stop - 1;
      while (beginningOfWord > 0 && !isSeparator(s[beginningOfWord - 1])) beginningOfWord--;
      return WORD_PREFIX_PADDING * (stop - beginningOfWord)
        + PREFIX_WORDS_PADDING * getNumberOfWords(s, 0, beginningOfWord);
    },
    (s, start) => {
      const l = s.length;
      // exact suffix is very good
      if (start === l) return 0;
      // ending of word is good
      const firstChar = s[start];
      if (isSeparator(firstChar)) return SUFFIX_WORDS_PADDING * getNumberOfWords(s, start, l);
      // Otherwise small cost of longer suffixes
      let endOfWord = start + 1;
      while (endOfWord < l && !isSeparator(s[endOfWord])) endOfWord++;
      return WORD_SUFFIX_PADDING * (endOfWord - start)
        + SUFFIX_WORDS_PADDING * getNumberOfWords(s, endOfWord, l);
    });
}

/** DaggerfallTravelMapWindow.MatchesCutOff (:1533-1547): a perfect
 *  match keeps only perfect matches; otherwise everything at or
 *  above half the best relevance. */
export class MatchesCutOff {
  constructor(bestRelevance) {
    this.threshold = bestRelevance === 1 ? 1 : bestRelevance * 0.5;
  }

  keep(relevance) { return relevance >= this.threshold; }
}

// @ts-check
// NAME-F1 (2026-09-16, Mac: "a proper censoring system for players
// choosing their online name. Im seeing a lot of names like 'Cum'").
//
// ═══ THE PROBLEM THIS IS, AND THE ONE IT IS NOT ═══════════════════
//
// A word list is easy. A word list that does not refuse SCUNTHORPE is
// the whole job, and it is the reason this file is long enough to have
// a header.
//
// Two failures, and they pull opposite ways:
//   - a name that reads as a slur gets through because it was spelled
//     `C0ck` or `f_u_c_k` or `xXcumXx`;
//   - a real name is refused because a rude word hides inside it -
//     Cumberland, Scunthorpe, Penistone, Lightwater, Dickens,
//     Cockburn, Assisi, Shitterton (a real Dorset village).
//
// So the check runs in TWO STAGES and they are deliberately different:
//
//   1. NORMALISE hard. Fold case, map the leet alphabet onto letters,
//      drop everything that is not a letter, and collapse runs of the
//      same letter. `xX c0ck Xx` and `cccoooock` both become `xxcockxx`
//      -> the padding is still there but the word inside it is plain.
//      This stage is aggressive ON PURPOSE: it is not deciding
//      anything, it is only making the next stage's job possible.
//
//   2. MATCH softly. A word matches when it stands as a WORD in what
//      is left - at a boundary, or wrapped only in the padding players
//      actually use (`x`, `_`, `-`, digits, and a leading/trailing
//      `the`). `cumberland` does not match `cum` because `berland` is
//      not padding; `xxcumxx` does, because `xx` is.
//
// THE COST, SAID PLAINLY. Stage 2 is where the judgement lives and it
// will be wrong in both directions sometimes: a determined player will
// find a spelling this does not hold (`kum`, `c u m b` with a letter
// that normalises away), and one day a real name will be refused. The
// first is a losing arms race by nature - the list is a speed bump,
// not a wall - and the second is why the refusal says WHICH word it
// caught, so a player with a legitimate name knows what to change and
// can tell someone the filter is wrong.
//
// WHAT IS NOT HERE. Chat lines. Mac asked for names, and a name is not
// a chat line: it is permanent, it hangs over a player's head in the
// world, and it is read by everyone who never chose to talk to them. A
// line scrolls away. `sanitizeChat` is untouched.
//
// Not a DFU member: Daggerfall Unity has no online names. Ledger A row
// (ONLINE).

/**
 * THE LEET ALPHABET. Only the mappings players actually use; a wider
 * table starts folding real letters together and manufactures false
 * positives out of nothing.
 */
const LEET = new Map(Object.entries({
  0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g',
  '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't', '(': 'c', '<': 'c', '£': 'l',
}));

/** The letters a padded name wraps a word in. `x` is the common one
 *  (`xXnameXx`); digits and the separators come in with it - though by
 *  stage 2 the separators are already gone, so this is really about
 *  `x`, and it is kept explicit because that is what it means. */
const PAD = /^[x_\-0-9]*$/;

/**
 * ENGLISH TAILS, and the reason stage 2 is not a bare word boundary.
 *
 * `Wanker` and `Tits` are the word plus an ordinary suffix, and a
 * boundary check lets both through. Allowing a SHORT, CLOSED set of
 * tails catches them - and the set has to stay short, because every
 * entry is a new way to refuse a real name. These are the ones that
 * turn a noun into a plural, an agent or a verb; `us` and `an` are
 * deliberately NOT here, which is what keeps `Titus` and `Titan`.
 */
const TAILS = Object.freeze(['s', 'es', 'z', 'er', 'ers', 'ed', 'ing', 'y', 'ie', 'ies']);

/**
 * Stage 1. Case folded, accents stripped, leet mapped, non-letters
 * dropped, runs of one letter collapsed to a single.
 *
 * The accent strip matters both ways: it stops `Çüm` sliding past, and
 * it is why the ORDERING in roster.js sorts accents with their base
 * letter - the same reading of "what letter is this really".
 */
export function normaliseName(name) {
  // NFKD splits `Ç` into `C` + a combining cedilla and folds the
  // compatibility forms; the a-z filter below then drops every mark
  // that is left. An explicit combining-mark strip stood here too and
  // a mutant proved it INERT - the second dead line this file grew,
  // after the `stretchable` flag. Both were written as belt-and-braces
  // and both were braces on braces; a line that cannot change an
  // answer is a line the next reader has to work out the purpose of.
  const flat = String(name ?? '').normalize('NFKD').toLowerCase();
  let out = '';
  for (const ch of flat) {
    const mapped = LEET.get(ch) ?? ch;
    if (mapped >= 'a' && mapped <= 'z') out += mapped;
  }
  return out;
}

/**
 * The stretched-letter form: `cccoooock` -> `cock`.
 *
 * THIS IS A SECOND READING, NOT PART OF THE FIRST, and the difference
 * is a bug this file already made once. Collapsing runs inside
 * `normaliseName` meant the LIST had to be written in collapsed
 * spelling too - so `ass`, `jizz`, `pussy` and `coon` could never
 * match anything, because a doubled letter cannot survive to be
 * found. Four dead entries, in a list that looked complete.
 *
 * Worse, collapsing MERGES words that are not the same: `coon` and
 * `con` both land on `con`, so a list written that way refuses anyone
 * called Con.
 *
 * So the collapse is its own form and every word is checked against
 * BOTH - the plain reading catches `ass` and `coon` as themselves, the
 * collapsed one catches `cccoooock`, and neither has to lie about the
 * other's spelling. The list is written the way the words are spelled.
 */
export const collapseRuns = (flat) => String(flat ?? '').replace(/(.)\1+/g, '$1');

/**
 * THE LIST. Kept short and kept obvious: the words that actually turn
 * up, not a dictionary of everything anyone has ever found rude. A
 * long list is a long list of false positives.
 *
 * Every entry is written as it looks AFTER normalisation - lowercase
 * letters only, no doubled letters (the collapse in stage 1 would
 * never produce them). `SLURS` is separated only so the reason a name
 * was refused can be honest about which kind it was.
 */
export const CRUDE = Object.freeze([
  'anus', 'arse', 'ass', 'bastard', 'bitch', 'bollock', 'boner', 'boob', 'clit',
  'cock', 'cum', 'cunt', 'dick', 'dildo', 'fuck', 'jizz', 'knob', 'minge',
  'nonce', 'penis', 'piss', 'prick', 'pussy', 'scrotum', 'semen', 'shit',
  'slut', 'smegma', 'spunk', 'testicle', 'tit', 'twat', 'vagina', 'wank', 'whore',
]);

/** Slurs and hate terms. Held apart from CRUDE because these are not
 *  a matter of taste and the refusal should not pretend they are.
 *  Written normalised, as above. */
export const SLURS = Object.freeze([
  'chink', 'coon', 'dyke', 'fag', 'faggot', 'gook', 'kike', 'nig', 'nigger',
  'paki', 'raghead', 'retard', 'spic', 'tard', 'tranny', 'wetback',
]);

/** Impersonation: a player calling themselves the room's authority.
 *  Not rude, and not allowed either - "Admin" in a chat line is a
 *  social-engineering tool, not an insult. */
export const IMPERSONATION = Object.freeze(['admin', 'moderator', 'mod', 'staf', 'sistem', 'ofical', 'server']);

/** Every entry must survive normalisation unchanged - lowercase
 *  letters only - or it is an entry that can never match. Checked in
 *  the pins by RUNNING the normaliser over the list rather than by
 *  reading it, so a dead entry cannot be added quietly. */
export const listIsNormalised = (words) => words.every((w) => normaliseName(w) === w);

const LISTS = Object.freeze([
  { kind: 'slur', words: SLURS },
  { kind: 'crude', words: CRUDE },
  { kind: 'impersonation', words: IMPERSONATION },
]);

/**
 * Stage 2. Does `word` stand as a WORD inside the normalised `flat`?
 *
 * Every occurrence is checked, and one is enough. What wraps it must
 * be nothing at all or padding - so `xxcumxx` is caught and
 * `cumberland` is not, and `thecum` is caught because a leading `the`
 * is padding a player reaches for the moment the bare name is refused.
 */
export function standsAlone(flat, word) {
  const strip = (s) => s.replace(/^the/, '').replace(/the$/, '');
  const tailOk = (s) => {
    if (PAD.test(s)) return true;
    // one tail, then padding again: `wankerxx`, `tits`
    for (const t of TAILS) if (s.startsWith(t) && PAD.test(s.slice(t.length))) return true;
    return false;
  };
  for (let i = flat.indexOf(word); i >= 0; i = flat.indexOf(word, i + 1)) {
    const before = strip(flat.slice(0, i));
    const after = strip(flat.slice(i + word.length));
    if (PAD.test(before) && tailOk(after)) return true;
  }
  return false;
}

/**
 * THE VERDICT. `{ ok: true }`, or `{ ok: false, kind, word, reason }`
 * - the word included, so the refusal can say what it caught and a
 * player with a real name knows the filter is wrong rather than
 * guessing at it.
 *
 * A name is also refused for having no letters at all: `___` and
 * `1234` are not names, and they are how a player gets past a list
 * without getting past a reader.
 */
export function checkName(name) {
  const raw = String(name ?? '').trim();
  const flat = normaliseName(raw);
  if (!flat) return { ok: false, kind: 'empty', word: '', reason: 'A name needs some letters in it.' };
  const stretched = collapseRuns(flat);
  for (const { kind, words } of LISTS) {
    for (const word of words) {
      // BOTH readings - see collapseRuns for why they are two - and
      // note that the word passed to the stretched one is the word AS
      // WRITTEN, never a collapsed copy of it.
      //
      // That is the whole guard, and it took a mutation campaign to see
      // it. An earlier cut collapsed the WORD too, so `coon` was
      // compared as `con` and anyone called Con was refused as a slur.
      // The fix was read as needing a `stretchable` test beside it -
      // and that test turned out to be inert: the stretched haystack
      // has no doubled letters by construction, so a word that HAS one
      // can never be found there anyway. A mutant forcing it true
      // changed nothing, which is how a dead guard announces itself.
      if (!standsAlone(flat, word) && !standsAlone(stretched, word)) continue;
      return {
        ok: false, kind, word,
        reason: kind === 'impersonation'
          ? `"${word}" is reserved - please pick a name that is not the server's.`
          : `That name reads as "${word}". Please pick another.`,
      };
    }
  }
  return { ok: true };
}

/** The one-word answer, for callers that only need the gate. */
export const nameAllowed = (name) => checkName(name).ok;

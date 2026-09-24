// THE CHARACTERS AS A READER COUNTS THEM - one law for every surface that cuts text for a person to read.
//
// A bare `slice` counts UTF-16 units, so a cut there can halve a surrogate pair (a stray replacement box after a
// face) or a joined emoji (a family cut to a man and a joiner). EMOTE1 met it first, in the chat bubble's cut
// (ui/nameLayer.js graphemeCut); JOURNAL1 met it again in the notebook, which has to break a run too long for its
// line (systems/notebook.js breakableNote). Both read their characters here, so the two cuts cannot come to disagree
// about what a character is.
//
// Intl.Segmenter where the runtime has one (grapheme clusters: a family, a flag, a letter with its marks), and whole
// code points where it does not - a surrogate pair is never split either way.

let segmenter = null;

/** The text as the reader's characters, in order: joined, they are the text again. */
export function graphemesOf(text) {
  const s = String(text ?? '');
  const Seg = globalThis.Intl?.Segmenter;
  if (!Seg) return Array.from(s);
  segmenter ??= new Seg(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(s), (g) => g.segment);
}

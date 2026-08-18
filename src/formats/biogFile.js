// BIOG*.TXT - the CHARGEN BIOGRAPHY question files (DFU BiogFile,
// MIT Daggerfall Workshop, Assets/Scripts/API/BiogFile.cs:44-146).
// One file per class per biography set: BIOG<class:2>T<set>.TXT, 12
// questions each, every answer carrying a list of EFFECTS the
// character creation applies.
//
// The format, verbatim as DFU's StringReader walk reads it:
// - blank lines (length <= 1) are skipped between questions;
// - a question's FIRST line leads with a number and a '.', and the
//   text is everything after the first '.' - `split('.', 2)[1]`;
// - a question may carry a SECOND line, taken when the next line
//   does NOT have a '.' at index 1 or 2 (that would be the next
//   answer or the next question);
// - answers run while the line has '.' at index 1 AND starts with a
//   LETTER ("a.", "b."); the answer text is `split('.')[1]`;
// - each answer's EFFECT lines follow until a line with '.' at index
//   1 or a blank line.
//
// The '#<id>' custom-backstory first line is a DFU EXTENSION for
// modded BIOGs; the shipping files do not use it, and it is parsed
// here so a modded file cannot desync the question walk.
//
// TWO of the rules above are DEFENSIVE in DFU and UNREACHABLE in the
// shipping data, because every question is preceded by a blank line
// and the effect loop stops there: the second-line check's '.'-at-2
// arm (a two-digit question header following a question with no blank
// between) and the answer loop's is-a-LETTER arm. They are ported
// because they are the law, but they get no pin of their own - a test
// would have to hand-build a file no producer mints, which is the
// vacuous pin the audit rules forbid. The CORPUS GATE over all 18
// shipping files is the real proof this walk is right.

export const BIOG_QUESTION_COUNT = 12;
export const BIOG_QUESTION_LINES = 2;
/** BiogFile.cs:47 - the classic backstory record base. */
export const DEFAULT_BACKSTORIES_START = 4116;

/** `split('.', 2)` in C# keeps the REMAINDER in the last element;
 *  JavaScript's second argument is a LIMIT that DISCARDS it, so a
 *  question containing another '.' would lose everything after it.
 *  This is the C# semantic. */
function splitFirst(line, sep) {
  const i = line.indexOf(sep);
  return i < 0 ? [line] : [line.slice(0, i), line.slice(i + 1)];
}

/** Parse one BIOG*.TXT. `text` is the decoded file. Returns
 *  { backstoryId, questions: [{ text: [l0, l1], answers: [...] }] }.
 *  backstoryId is null unless the file opens with the '#' extension -
 *  the caller applies DEFAULT_BACKSTORIES_START + classIndex. */
export function parseBiog(text, classIndex = 0) {
  const lines = text.split(/\r\n|\r|\n/);
  let p = 0;
  const next = () => (p < lines.length ? lines[p++] : null);
  let cur = next();
  let backstoryId = null;
  const questions = [];

  for (let i = 0; i < BIOG_QUESTION_COUNT; i++) {
    const q = { text: ['', ''], answers: [] };
    // skip blank lines (DFU: `while (curLine.Length <= 1)`)
    while (cur !== null && cur.length <= 1) cur = next();
    if (cur === null) break;

    if (i === 0 && cur[0] === '#') {
      const v = Number.parseInt(cur.slice(1), 10);
      backstoryId = Number.isFinite(v) ? v : DEFAULT_BACKSTORIES_START + classIndex;
      do { cur = next(); } while (cur !== null && cur.length <= 1);
      if (cur === null) break;
    }

    for (let j = 0; j < BIOG_QUESTION_LINES; j++) {
      if (cur === null) break;
      if (j === 0) {
        q.text[j] = (splitFirst(cur, '.')[1] ?? '').trim();
      } else if (cur.indexOf('.') !== 1 && cur.indexOf('.') !== 2) {
        q.text[j] = cur.trim();
      } else {
        break;
      }
      cur = next();
    }

    // answers: '.' at index 1 AND a letter first
    while (cur !== null && cur.indexOf('.') === 1 && /[a-zA-Z]/.test(cur[0])) {
      const answer = { text: (cur.split('.')[1] ?? '').trim(), effects: [] };
      cur = next();
      while (cur !== null && cur.indexOf('.') !== 1 && cur.length > 1) {
        answer.effects.push(cur.trim());
        cur = next();
      }
      q.answers.push(answer);
    }
    questions.push(q);
  }

  if (backstoryId === null) backstoryId = DEFAULT_BACKSTORIES_START + classIndex;
  return { backstoryId, questions };
}

/** BiogFile's own filename law (BiogFile.cs:69). */
export const biogFileName = (classIndex, set = 0) =>
  `BIOG${String(classIndex).padStart(2, '0')}T${set}.TXT`;

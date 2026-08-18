// U18: the CLASS QUESTIONS - the "generate class by answering
// questions" wizard path (WizardStages.GenerateClass). Verbatim from
// DFU CreateCharClassQuestions.cs (MIT, Daggerfall Workshop /
// Numidium): the TEXT.RSC 9000 question library, the FALL.EXE answer
// table, the ten-unique-question pick, and the CLASSES.DAT results
// walk that turns ten answers into a class index.
//
// The questionnaire lives in classic TEXT.RSC as ONE record - id 9000
// - whose forty questions are delimited by LITERAL '{' characters in
// the record text (DaggerfallStringTableImporter.SplitQuestionnaireRecord
// splits on '{' and keys them "9000.1".."9000.40"; splitText[0], the
// empty run before the first '{', is discarded). DFU reads the split
// keys back through its string table; the port reads the record and
// performs the same split.

export const CLASS_QUESTIONS_TEXT_ID = 9000;      // classQuestionsToken (:42)
export const QUESTION_COUNT = 10;                 // questionCount (:44)
export const NO_CLASS_INDEX = 255;                // noClassIndex (:45)
export const QUESTION_LIBRARY_SIZE = 40;          // questionCountInclusive (:216)

/** The path each answer steers toward: rows are questions 1..40,
 *  columns the answers (a, b, c); values 0 Warrior, 1 Rogue, 2 Mage.
 *  Ripped from FALL.EXE v1.07.213 at offset 0x0059820C
 *  (CreateCharClassQuestions.cs:526-565, comment and table verbatim). */
export const ANSWER_TABLE = Object.freeze([
  0, 2, 1,
  0, 2, 1,
  0, 1, 2,
  2, 0, 1,
  0, 1, 2,
  1, 0, 2,
  0, 1, 2,
  2, 0, 1,
  0, 2, 1,
  0, 1, 2,
  0, 1, 2,
  0, 1, 2,
  0, 2, 1,
  0, 1, 2,
  1, 0, 2,
  1, 2, 0,
  2, 0, 1,
  1, 0, 2,
  0, 1, 2,
  2, 0, 1,
  1, 0, 2,
  0, 1, 2,
  0, 2, 1,
  2, 1, 0,
  1, 0, 2,
  0, 2, 1,
  2, 1, 0,
  2, 0, 1,
  2, 1, 0,
  2, 1, 0,
  2, 0, 1,
  1, 0, 2,
  0, 2, 1,
  2, 1, 0,
  1, 2, 0,
  2, 0, 1,
  2, 0, 1,
  1, 2, 0,
  0, 1, 2,
  1, 2, 0,
]);

/** GetQuestions' library half (:214-236): the forty questions, each a
 *  multi-line string with its leading "N." number stripped. Per line,
 *  DFU splits on the \d+[.] expression and keeps the SECOND part when
 *  the split produced one - "If true the line contains the expression,
 *  which means it is the start of a question" - and the whole line
 *  otherwise. The split law is kept verbatim, quirk included: a
 *  number-dot ANYWHERE in a line truncates everything before it.
 *  Returns null when the record is missing (the caller logs loudly
 *  where DFU throws - the crash-class doctrine). */
export function parseQuestionLibrary(textRsc) {
  if (!textRsc?.hasRecord?.(CLASS_QUESTIONS_TEXT_ID)) return null;
  const parts = textRsc.plainText(CLASS_QUESTIONS_TEXT_ID)[0].split('{');
  const library = [];
  for (let q = 1; q <= QUESTION_LIBRARY_SIZE; q++) {
    const lines = (parts[q] ?? '').split('\n').map((line) => {
      const split = line.split(/\d+[.]/);
      return split.length > 1 ? split[1] : split[0];
    });
    library.push(lines.join('\n'));
  }
  return library;
}

/** DisplayQuestion's text half (:255-289): the question's non-empty
 *  lines, plus the indices of the rows containing "a)", "b)" and "c)"
 *  - the click law's boundaries. Contains, not starts-with, and the
 *  LAST matching row wins, verbatim. */
export function displayQuestion(questionText) {
  const lines = questionText.split('\n').filter((x) => x !== '');
  let aIndex = 0, bIndex = 0, cIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('a)')) aIndex = i;
    else if (lines[i].includes('b)')) bIndex = i;
    else if (lines[i].includes('c)')) cIndex = i;
  }
  return { lines, aIndex, bIndex, cIndex };
}

/** GetQuestions' pick half (:238-252): ten UNIQUE indices into the
 *  library - a random start, then a LINEAR PROBE past already-picked
 *  ones ("index = (index + 1) % count"). UnityEngine.Random is an
 *  engine PRNG (Ledger A), so `rolls` rides Math.random. */
export function pickQuestionIndices(librarySize, rolls = Math.random) {
  const picked = new Set();
  const indices = [];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    let index = Math.floor(rolls() * librarySize);
    while (picked.has(index)) index = (index + 1) % librarySize;
    picked.add(index);
    indices.push(index);
  }
  return indices;
}

/** The weights slot an answer increments (GetWeightIndex :305-308):
 *  weights[0] Warrior, [1] Rogue, [2] Mage. */
export function answerWeightIndex(questionLibraryIndex, column) {
  return ANSWER_TABLE[questionLibraryIndex * 3 + column];
}

/** WeightsToUint (:295-298). */
const weightsToUint = (w1, w2, w3) => (w1 | (w2 << 8) | (w3 << 16)) >>> 0;

/** GetHeaderIndex (:361-382): walk CLASSES.DAT's results table - all
 *  66 possible (warrior, rogue, mage) triples from offset 18, three
 *  bytes each - for the match, and return its header slot (four weight
 *  sets per class). -1 = no match ("shouldn't be possible unless the
 *  file is corrupted"). The loop bound is DFU's own quirk kept
 *  verbatim: resultsOffsetStart + maxHeaderOffset = 66, which happens
 *  to be exactly the number of triples summing to ten. */
export function getHeaderIndex(classData, weights) {
  const want = weightsToUint(weights[0], weights[1], weights[2]);
  let resultsOffset = 18;   // resultsOffsetStart
  for (let i = 0; i < 66; i++, resultsOffset += 3) {
    if (weightsToUint(classData[resultsOffset], classData[resultsOffset + 1], classData[resultsOffset + 2]) === want) {
      return Math.floor(i / 4);   // weightSetsPerClass
    }
  }
  return -1;
}

/** GetClassIndex (:390-398): the header byte, with the left nibble
 *  zeroed for slots past 3 - "Array used by FALL.EXE is the same as
 *  in CLASSES.DAT except bytes 0x04 through 0x11 have their left
 *  nibbles zeroed out". */
export function getClassIndex(headerIndex, classData) {
  let r = classData[headerIndex];
  if (headerIndex > 3) r &= 0x0f;
  return r;
}

/** Ten answers' weights -> the class index (CLASS<index>.CFG), or
 *  null when the results walk finds no match - the caller logs loudly
 *  where DFU throws. */
export function resolveClassIndex(classData, weights) {
  const headerIndex = getHeaderIndex(classData, weights);
  if (headerIndex === -1) return null;
  return getClassIndex(headerIndex, classData);
}
